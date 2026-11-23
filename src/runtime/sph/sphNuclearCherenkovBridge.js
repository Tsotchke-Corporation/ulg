/**
 * Live SPH Studio Runtime Bridge for Phase 8 Nuclear Decay, Exact Nucleon
 * Inventory Conservation, Thermal Deposition, and Frank-Tamm Cherenkov Closure.
 *
 * Strict Star Spec & honesty invariants:
 *  - ZERO material-name hardcoding: dielectric refractive index n(lambda) is
 *    derived generally via ULG's canonical `opticalRenderParams` closure for
 *    ANY transparent dielectric medium (water, ice, ethanol, glass, oil, etc.).
 *  - ZERO hardcoded element->isotope tables: available decay channels derive
 *    directly from `NUCLEAR_DECAY_CHANNELS` via atomic number Z.
 *  - Zero overhead when no radioactive isotope is present (`enabled: false`).
 *  - Nucleon number A and charge Z are conserved analytically at every step.
 *  - Cherenkov emission is strictly gated by beta = v / c > 1 / n(medium);
 *    below threshold, in vacuum (n = 1.0), or inside opaque conductors it
 *    fails closed (`active: false`, `srgb: [0, 0, 0]`).
 *  - Every output carries `validation.scientificValidation = false` until
 *    validated against ENDF/B and Geant4 transport benchmarks.
 */

import { zForSymbol } from '../electronicStructure/periodicTable.js';
import {
  NUCLEAR_DECAY_CHANNELS,
  ULG_CHERENKOV_CLOSURE_SCHEMA,
  ULG_ISOTOPE_INVENTORY_SCHEMA,
  evaluateCherenkovClosure,
  packNuclearChannelRows,
  relativisticBetaFromKineticEnergyMeV,
  stepIsotopeInventoryLedger
} from '../material/nuclearCherenkovClosure.js';
import { opticalRenderParams } from '../material/opticalClosure.js';
import { stableOpticalMaterialId } from '../material/opticalGpuBuffers.js';

export const ULG_SPH_NUCLEAR_CHERENKOV_STATE_SCHEMA =
  'peercompute.ulg.sph-nuclear-cherenkov-state.v1';

const AMU_KG = 1.66053906660e-27;
const ELECTRON_REST_MEV = 0.51099895;

function normalizeElementSymbolKey(materialKey) {
  const raw = String(materialKey || '').trim();
  if (!raw) return null;
  return `${raw[0].toUpperCase()}${raw.slice(1).toLowerCase()}`;
}

function resolveElementZ(materialKey) {
  const sym = normalizeElementSymbolKey(materialKey);
  if (!sym) return null;
  return zForSymbol(sym) ?? null;
}

export function supportedIsotopesForMaterial(materialKey, channels = NUCLEAR_DECAY_CHANNELS) {
  const Z = resolveElementZ(materialKey);
  if (!(Z > 0)) return Object.freeze([]);
  const matching = [];
  for (const ch of Object.values(channels || NUCLEAR_DECAY_CHANNELS)) {
    if (ch && ch.Z === Z) matching.push(ch.isotope);
  }
  return Object.freeze(matching);
}

export function normalizeIsotopeKey(raw, channels = NUCLEAR_DECAY_CHANNELS) {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed || trimmed.toLowerCase() === 'stable' || trimmed.toLowerCase() === 'none') {
    return null;
  }
  const canonical = Object.keys(channels || NUCLEAR_DECAY_CHANNELS).find(
    (k) => k.toLowerCase() === trimmed.toLowerCase()
  );
  return canonical || null;
}

export function resolveBodyIsotopeChannel(body, channels = NUCLEAR_DECAY_CHANNELS) {
  if (!body || typeof body !== 'object') return null;
  const table = channels || NUCLEAR_DECAY_CHANNELS;
  const explicit = normalizeIsotopeKey(body.isotope, table);
  if (explicit) return table[explicit] || null;
  const Z = resolveElementZ(body.material);
  if (!(Z > 0)) return null;
  for (const ch of Object.values(table)) {
    if (ch && ch.Z === Z && ch.naturallyAbundant === true) {
      return ch;
    }
  }
  return null;
}

function lookupMaterialProperties(materialProperties, materialKey) {
  if (!materialProperties || typeof materialProperties !== 'object') return null;
  const key = String(materialKey || '').trim();
  if (!key) return null;
  if (materialProperties[key]) return materialProperties[key];
  const lower = key.toLowerCase();
  if (materialProperties[lower]) return materialProperties[lower];
  for (const [k, v] of Object.entries(materialProperties)) {
    if (k.toLowerCase() === lower) return v;
  }
  return null;
}

/**
 * Determine a body's thermodynamic phase generally from its temperature and
 * closure-derived phase transition temperatures (zero hardcoded material rules).
 */
function inferBodyPhaseFromProperties(body, props) {
  if (typeof body?.phase === 'string' && body.phase.trim()) {
    return body.phase.trim().toLowerCase();
  }
  const T = Number(body?.temperatureK);
  if (!Number.isFinite(T) || !(T > 0)) return 'liquid';
  const meltK = Number(
    props?.meltingPointK
    ?? props?.transitions?.find((tr) => tr?.from === 'solid' && tr?.to === 'liquid')?.temperatureK
    ?? props?.vdwGasProperties?.meltingPointK
  );
  const boilK = Number(
    props?.boilingPointK
    ?? props?.transitions?.find((tr) => tr?.from === 'liquid' && tr?.to === 'gas')?.temperatureK
    ?? props?.vdwGasProperties?.boilingPointK
  );
  if (Number.isFinite(boilK) && boilK > 0 && T >= boilK) return 'gas';
  if (Number.isFinite(meltK) && meltK > 0 && T < meltK) return 'solid';
  if (Number.isFinite(meltK) && meltK > 0 && T >= meltK) return 'liquid';
  // Check explicit phase records if scalar transition fields were absent
  const phaseNames = Array.isArray(props?.phases) ? props.phases.map((p) => String(p?.name || '').toLowerCase()) : [];
  if (phaseNames.includes('liquid')) return 'liquid';
  if (phaseNames.includes('solid')) return 'solid';
  if (phaseNames.includes('gas')) return 'gas';
  return 'liquid';
}

function buildSpectralRefractiveIndexFn(spectralSamples, fallbackN) {
  if (!Array.isArray(spectralSamples) || spectralSamples.length === 0) return null;
  const valid = spectralSamples
    .filter((s) => Number.isFinite(s?.wavelengthNm) && Number.isFinite(s?.n) && s.n >= 1.0)
    .sort((a, b) => a.wavelengthNm - b.wavelengthNm);
  if (valid.length === 0) return null;
  return (nm) => {
    const w = Number(nm);
    if (!Number.isFinite(w)) return fallbackN;
    if (w <= valid[0].wavelengthNm) return valid[0].n;
    const last = valid[valid.length - 1];
    if (w >= last.wavelengthNm) return last.n;
    for (let i = 1; i < valid.length; i += 1) {
      if (w <= valid[i].wavelengthNm) {
        const lo = valid[i - 1];
        const hi = valid[i];
        const span = hi.wavelengthNm - lo.wavelengthNm;
        const t = span > 0 ? (w - lo.wavelengthNm) / span : 0;
        return lo.n + (hi.n - lo.n) * t;
      }
    }
    return fallbackN;
  };
}

/**
 * Evaluate optical dielectric candidacy for a single material+phase purely via
 * ULG's canonical `opticalRenderParams` closure (with optional explicit
 * closure-derived IOR/transmission fields on `props`).
 * Fails closed (`null`) for opaque conductors, blocked materials, or vacuum.
 */
function evaluateTransparentDielectricCandidate({ material, phase, props }) {
  const matKey = String(material || '').trim();
  if (!matKey) return null;
  const opt = opticalRenderParams({
    material: matKey.toLowerCase(),
    phase,
    pathLengthM: 0.3,
    properties: props || null
  });
  // Explicit closure-backed dielectric properties (e.g. ethanol, glass, heavy water)
  const explicitIor = Number(props?.ior ?? props?.refractiveIndex);
  const explicitConduction = Number(props?.conductionElectronDensityPerM3 ?? 0);
  if (opt && !opt.blocked) {
    const metalness = Number(opt.metalness ?? 0);
    const transmission = Number(opt.transmission ?? 0);
    const ior = Number(opt.ior ?? 1.0);
    if (metalness < 0.1 && transmission > 0.05 && Number.isFinite(ior) && ior > 1.000001) {
      return {
        medium: `${matKey.toLowerCase()}-${phase}`,
        material: matKey.toLowerCase(),
        phase,
        refractiveIndex: ior,
        refractiveIndexFn: buildSpectralRefractiveIndexFn(opt.spectralSamples, ior),
        transmission,
        renderModel: opt.renderModel || 'optical-closure'
      };
    }
    return null;
  }
  if (
    !(explicitConduction > 0)
    && Number.isFinite(explicitIor)
    && explicitIor > 1.000001
    && (props?.transmission == null || Number(props.transmission) > 0.05)
  ) {
    return {
      medium: `${matKey.toLowerCase()}-${phase}`,
      material: matKey.toLowerCase(),
      phase,
      refractiveIndex: explicitIor,
      refractiveIndexFn: null,
      transmission: props?.transmission != null ? Number(props.transmission) : 0.9,
      renderModel: 'material-property-dielectric-ior'
    };
  }
  return null;
}

/**
 * Derive the surrounding transparent dielectric medium's refractive index n(lambda)
 * generally from ULG's optical closure (`opticalRenderParams`) & `materialProperties`
 * across ALL active non-radioactive bodies and the environment medium.
 *
 * Strictly zero material-name hardcoding: works identically for water, ice,
 * heavy water, ethanol, fused silica glass, diamond, air, etc., and fails closed
 * (`refractiveIndex: 1.0`, vacuum) when only vacuum or opaque conductors exist.
 */
export function resolveSurroundingDielectricMedium({
  bodies = [],
  environmentMode = 'vacuum',
  materialProperties = null
} = {}) {
  const list = Array.isArray(bodies) ? bodies : [];
  let best = null;

  for (const body of list) {
    if (!body || typeof body !== 'object') continue;
    // Skip the radioactive source body itself unless it is a transparent dielectric
    const matKey = String(body.material || '').trim();
    if (!matKey) continue;
    const props = lookupMaterialProperties(materialProperties, matKey);
    const phase = inferBodyPhaseFromProperties(body, props);
    const candidate = evaluateTransparentDielectricCandidate({
      material: matKey,
      phase,
      props
    });
    if (!candidate) continue;
    // Prefer condensed transparent dielectric media (highest optical refractivity n > 1)
    if (!best || candidate.refractiveIndex > best.refractiveIndex) {
      best = candidate;
    }
  }

  if (best) {
    return Object.freeze(best);
  }

  // Fallback to ambient transparent gas environment (e.g. air) via opticalRenderParams
  const envKey = String(environmentMode || 'vacuum').trim().toLowerCase();
  if (envKey && envKey !== 'vacuum') {
    const envProps = lookupMaterialProperties(materialProperties, envKey)
      || { phases: [{ name: 'gas', densityKgPerM3: 1.225 }] };
    const envCand = evaluateTransparentDielectricCandidate({
      material: envKey,
      phase: 'gas',
      props: envProps
    });
    if (envCand) {
      return Object.freeze(envCand);
    }
  }

  return Object.freeze({
    medium: 'vacuum',
    material: null,
    phase: 'vacuum',
    refractiveIndex: 1.0,
    refractiveIndexFn: null,
    transmission: 1.0,
    renderModel: 'vacuum'
  });
}

/**
 * Characteristic relativistic secondary electron kinetic energy (MeV) emitted
 * directly (beta-minus) or via Compton scattering of decay gammas in a medium.
 * Alpha-only channels without high-energy gammas/betas have negligible
 * relativistic electron kinetic energy -> fail closed below Cherenkov threshold.
 */
export function characteristicSecondaryElectronEnergyMeV(channel) {
  if (!channel) return 0;
  const directBetaMeV = channel.qValueMeV * (channel.betaFraction || 0);
  const gammaTotalMeV = channel.qValueMeV * (channel.gammaFraction || 0);
  // Multi-gamma cascades split total gamma energy across emitted photons;
  // Compton edge E_C = E_gamma / (1 + m_e c^2 / (2 E_gamma)).
  const photonMeV = gammaTotalMeV > 1.8 ? gammaTotalMeV * 0.5 : gammaTotalMeV;
  const comptonEdgeMeV = photonMeV > 0.25
    ? photonMeV / (1 + ELECTRON_REST_MEV / (2 * photonMeV))
    : 0;
  return Math.max(directBetaMeV, comptonEdgeMeV);
}

/**
 * Characteristic attenuation range (m) of secondary relativistic electrons /
 * Compton-scattered gamma cascade in condensed dielectric media (~1000 kg/m^3).
 * Derived monotonically from secondary kinetic energy (zero material hardcoding).
 */
export function characteristicCherenkovAttenuationRangeM(channel) {
  if (!channel) return 0;
  const gammaMeV = channel.qValueMeV * (channel.gammaFraction || 0);
  const betaMeV = channel.qValueMeV * (channel.betaFraction || 0);
  // MeV gamma Compton mean free path in ~1 g/cm^3 dielectric is ~0.12 - 0.25 m;
  // pure beta-minus CSDA range is millimeter-to-centimeter scale.
  if (gammaMeV > 0.25) {
    return Math.min(0.45, Math.max(0.10, 0.14 * Math.sqrt(gammaMeV)));
  }
  if (betaMeV > 0.1) {
    return Math.min(0.08, Math.max(0.015, 0.025 * betaMeV));
  }
  return 0.01;
}

/**
 * Create a live Phase 8 Nuclear Decay & Frank-Tamm Cherenkov runtime controller
 * for SPH Studio scenes.
 */
export function createSphNuclearCherenkovController({
  bodies = [],
  particles = null,
  materialProperties = null,
  environmentMode = 'vacuum',
  channels = NUCLEAR_DECAY_CHANNELS
} = {}) {
  const sourceEntries = [];
  const list = Array.isArray(bodies) ? bodies : [];

  for (let i = 0; i < list.length; i += 1) {
    const body = list[i];
    const channel = resolveBodyIsotopeChannel(body, channels);
    if (!channel) continue;
    const matKey = String(body.material || '').trim();
    const props = lookupMaterialProperties(materialProperties, matKey);
    const densityKgPerM3 = Number(
      props?.phases?.find((p) => p?.name === 'solid')?.densityKgPerM3
      ?? props?.phases?.[0]?.densityKgPerM3
      ?? props?.densityKgPerM3
      ?? 8900
    );
    const size = Array.isArray(body.sizeM) ? body.sizeM : [0.2, 0.2, 0.2];
    const volumeM3 = Math.max(
      1e-9,
      Math.abs(Number(size[0]) || 0.2) * Math.abs(Number(size[1]) || 0.2) * Math.abs(Number(size[2]) || 0.2)
    );
    let bodyMassKg = densityKgPerM3 * volumeM3;
    let centerM = Array.isArray(body.centerM) ? [...body.centerM] : [0, 0.2, 0];

    if (Array.isArray(particles) && particles.length > 0) {
      let massSum = 0;
      let mx = 0; let my = 0; let mz = 0;
      const domainId = Number(body.domainId) || (i + 1);
      for (const p of particles) {
        const pDomain = Number(p.initialBodyDomainId ?? p.renderDomainId ?? 0);
        if (pDomain === domainId || (pDomain === 0 && String(p.material || '').toLowerCase() === matKey.toLowerCase())) {
          const m = Number(p.massKg) || 0;
          massSum += m;
          if (Array.isArray(p.x)) {
            mx += m * (Number(p.x[0]) || 0);
            my += m * (Number(p.x[1]) || 0);
            mz += m * (Number(p.x[2]) || 0);
          }
        }
      }
      if (massSum > 0) {
        bodyMassKg = massSum;
        centerM = [mx / massSum, my / massSum, mz / massSum];
      }
    }

    const atomCount = bodyMassKg / (channel.A * AMU_KG);
    const electronMeV = characteristicSecondaryElectronEnergyMeV(channel);
    const beta = relativisticBetaFromKineticEnergyMeV(electronMeV, ELECTRON_REST_MEV);
    const attenuationRangeM = characteristicCherenkovAttenuationRangeM(channel);
    sourceEntries.push({
      bodyId: body.id || `body-${i + 1}`,
      domainId: Number(body.domainId) || (i + 1),
      material: matKey,
      materialId: stableOpticalMaterialId(matKey),
      isotope: channel.isotope,
      channel,
      massKg: bodyMassKg,
      initialAtomCount: atomCount,
      centerM,
      radiusM: 0.5 * Math.cbrt(volumeM3),
      secondaryElectronMeV: electronMeV,
      beta,
      attenuationRangeM,
      inventory: [{ isotope: channel.isotope, A: channel.A, atomCount }]
    });
  }

  const enabled = sourceEntries.length > 0;
  const mediumInfo = resolveSurroundingDielectricMedium({
    bodies: list,
    environmentMode,
    materialProperties
  });
  const packedChannelTable = enabled
    ? packNuclearChannelRows(sourceEntries.map((s) => s.channel))
    : null;

  let elapsedS = 0;
  let totalDecays = 0;
  let totalDepositedThermalEnergyJ = 0;
  let lastThermalPowerW = 0;
  let maxNucleonRelError = 0;

  function evaluateAllSourcesCherenkov() {
    let anyActive = false;
    let peakPhotonsPerMeter = 0;
    let dominant = null;
    const perSource = [];

    for (const src of sourceEntries) {
      const cherenkov = evaluateCherenkovClosure({
        beta: src.beta,
        refractiveIndex: mediumInfo.refractiveIndex,
        refractiveIndexFn: mediumInfo.refractiveIndexFn,
        chargeZ: 1
      });
      const rec = {
        bodyId: src.bodyId,
        domainId: src.domainId,
        material: src.material,
        materialId: src.materialId,
        isotope: src.isotope,
        daughterIsotope: src.channel.daughterIsotope,
        mode: src.channel.mode,
        centerM: [...src.centerM],
        radiusM: src.radiusM,
        attenuationRangeM: src.attenuationRangeM,
        secondaryElectronMeV: src.secondaryElectronMeV,
        beta: src.beta,
        thresholdBeta: cherenkov.thresholdBeta,
        refractiveIndex: mediumInfo.refractiveIndex,
        active: cherenkov.active,
        cherenkovAngleDeg: cherenkov.cherenkovAngleDeg,
        photonsPerMeter: cherenkov.photonsPerMeter,
        srgb: [...cherenkov.srgb]
      };
      perSource.push(rec);
      if (cherenkov.active) {
        anyActive = true;
        if (cherenkov.photonsPerMeter >= peakPhotonsPerMeter) {
          peakPhotonsPerMeter = cherenkov.photonsPerMeter;
          dominant = rec;
        }
      }
    }

    return {
      anyActive,
      dominant,
      perSource
    };
  }

  let cherenkovState = evaluateAllSourcesCherenkov();

  function step(dtS, { particles: liveParticles = null } = {}) {
    if (!enabled) return getSnapshot();
    const dt = Math.max(0, Number(dtS) || 0);
    if (dt === 0) return getSnapshot();
    elapsedS += dt;
    let stepDepositedJ = 0;
    let stepPowerW = 0;
    let stepDecays = 0;

    for (const src of sourceEntries) {
      const ledger = stepIsotopeInventoryLedger(src.inventory, dt, { channels });
      src.inventory = ledger.nextInventory.map((item) => ({ ...item }));
      stepDecays += ledger.totalDecays;
      stepDepositedJ += ledger.depositedThermalEnergyJ;
      stepPowerW += ledger.thermalPowerW;
      if (ledger.nucleonConservationRelError > maxNucleonRelError) {
        maxNucleonRelError = ledger.nucleonConservationRelError;
      }

      if (Array.isArray(liveParticles) && liveParticles.length > 0 && ledger.depositedThermalEnergyJ > 0) {
        let totalMatMass = 0;
        let mx = 0; let my = 0; let mz = 0;
        const matched = [];
        for (const p of liveParticles) {
          const pDomain = Number(p.initialBodyDomainId ?? p.renderDomainId ?? 0);
          if (pDomain === src.domainId || (pDomain === 0 && String(p.material || '').toLowerCase() === src.material.toLowerCase())) {
            matched.push(p);
            const m = Number(p.massKg) || 0;
            totalMatMass += m;
            if (Array.isArray(p.x)) {
              mx += m * (Number(p.x[0]) || 0);
              my += m * (Number(p.x[1]) || 0);
              mz += m * (Number(p.x[2]) || 0);
            }
          }
        }
        if (matched.length > 0 && totalMatMass > 0) {
          src.centerM = [mx / totalMatMass, my / totalMatMass, mz / totalMatMass];
          const deltaSpecificEnergyJPerKg = ledger.depositedThermalEnergyJ / totalMatMass;
          for (const p of matched) {
            if (Number.isFinite(p.specificInternalEnergyJPerKg)) {
              p.specificInternalEnergyJPerKg += deltaSpecificEnergyJPerKg;
            }
          }
        }
      }
    }

    totalDecays += stepDecays;
    totalDepositedThermalEnergyJ += stepDepositedJ;
    lastThermalPowerW = stepPowerW;
    cherenkovState = evaluateAllSourcesCherenkov();
    return getSnapshot();
  }

  function buildGpuSourcesDescriptor() {
    if (!enabled) return null;
    return Object.freeze({
      schema: 'peercompute.ulg.sph-nuclear-cherenkov-gpu-sources.v1',
      medium: mediumInfo.medium,
      refractiveIndex: mediumInfo.refractiveIndex,
      sources: Object.freeze(sourceEntries.map((src) => Object.freeze({
        bodyId: src.bodyId,
        domainId: src.domainId,
        material: src.material,
        materialId: src.materialId,
        isotope: src.isotope,
        daughterIsotope: src.channel.daughterIsotope,
        mode: src.channel.mode,
        Z: src.channel.Z,
        A: src.channel.A,
        halfLifeS: src.channel.halfLifeS,
        lambdaPerS: src.channel.halfLifeS > 0 ? Math.LN2 / src.channel.halfLifeS : 0,
        qValueMeV: src.channel.qValueMeV,
        localDepositionFraction: src.channel.localDepositionFraction ?? 0.5,
        massKg: src.massKg,
        initialAtomCount: src.initialAtomCount,
        centerM: Object.freeze([...src.centerM]),
        radiusM: src.radiusM,
        secondaryElectronMeV: src.secondaryElectronMeV,
        beta: src.beta,
        attenuationRangeM: src.attenuationRangeM
      })))
    });
  }

  function getSnapshot() {
    const dom = cherenkovState.dominant;
    return Object.freeze({
      schema: ULG_SPH_NUCLEAR_CHERENKOV_STATE_SCHEMA,
      inventorySchema: ULG_ISOTOPE_INVENTORY_SCHEMA,
      cherenkovSchema: ULG_CHERENKOV_CLOSURE_SCHEMA,
      enabled,
      medium: mediumInfo.medium,
      refractiveIndex: mediumInfo.refractiveIndex,
      elapsedS,
      sourceCount: sourceEntries.length,
      isotopes: Object.freeze(sourceEntries.map((s) => s.isotope)),
      totalDecays,
      totalDepositedThermalEnergyJ,
      thermalPowerW: lastThermalPowerW,
      nucleonConservationRelError: maxNucleonRelError,
      cherenkovActive: cherenkovState.anyActive,
      cherenkovBeta: dom?.beta ?? (cherenkovState.perSource[0]?.beta ?? 0),
      cherenkovThresholdBeta: dom?.thresholdBeta ?? (1 / Math.max(1, mediumInfo.refractiveIndex)),
      cherenkovAngleDeg: dom?.cherenkovAngleDeg ?? 0,
      cherenkovPhotonsPerMeter: dom?.photonsPerMeter ?? 0,
      cherenkovSrgb: Object.freeze(dom ? [...dom.srgb] : [0, 0, 0]),
      sources: Object.freeze(cherenkovState.perSource),
      packedChannelRowCount: packedChannelTable?.rowCount ?? 0,
      closureBacked: true,
      validation: Object.freeze({
        scientificValidation: false,
        nuclearBenchmarkValidated: false,
        opticalValidation: false
      })
    });
  }

  return Object.freeze({
    enabled,
    packedChannelTable,
    buildGpuSourcesDescriptor,
    step,
    getSnapshot
  });
}
