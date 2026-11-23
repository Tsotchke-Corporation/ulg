/**
 * Live SPH Studio Runtime Bridge for Phase 8 Nuclear Decay, Exact Nucleon
 * Inventory Conservation, Thermal Deposition, and Frank-Tamm Cherenkov Glow.
 *
 * Strict Star Spec & honesty invariants:
 *  - Zero overhead when no radioactive isotope is present (`enabled: false`).
 *  - Nucleon number A and charge Z are conserved analytically at every step.
 *  - Cherenkov emission is strictly gated by β = v / c > 1 / n(medium);
 *    below threshold or in vacuum (n = 1.0) it fails closed (`active: false`,
 *    `srgb: [0, 0, 0]`).
 *  - Every output carries `validation.scientificValidation = false` until
 *    validated against ENDF/B and Geant4 transport benchmarks.
 */

import {
  NUCLEAR_DECAY_CHANNELS,
  ULG_CHERENKOV_CLOSURE_SCHEMA,
  ULG_ISOTOPE_INVENTORY_SCHEMA,
  evaluateCherenkovClosure,
  packNuclearChannelRows,
  relativisticBetaFromKineticEnergyMeV,
  stepIsotopeInventoryLedger
} from '../material/nuclearCherenkovClosure.js';

export const ULG_SPH_NUCLEAR_CHERENKOV_STATE_SCHEMA =
  'peercompute.ulg.sph-nuclear-cherenkov-state.v1';

const AMU_KG = 1.66053906660e-27;
const ELECTRON_REST_MEV = 0.51099895;

// Naturally radioactive elements whose default nuclide maps to an explicit
// Phase 8 decay channel when no explicit `body.isotope` override is provided.
const NATURAL_RADIOISOTOPE_BY_MATERIAL = Object.freeze({
  u: 'U-238'
});

const SUPPORTED_ISOTOPES_BY_ELEMENT = Object.freeze({
  u: Object.freeze(['U-238']),
  co: Object.freeze(['Co-60']),
  cs: Object.freeze(['Cs-137']),
  h: Object.freeze(['H-3'])
});

export function supportedIsotopesForMaterial(materialKey) {
  const key = String(materialKey || '').trim().toLowerCase();
  return SUPPORTED_ISOTOPES_BY_ELEMENT[key] || Object.freeze([]);
}

export function normalizeIsotopeKey(raw) {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed || trimmed.toLowerCase() === 'stable' || trimmed.toLowerCase() === 'none') {
    return null;
  }
  const canonical = Object.keys(NUCLEAR_DECAY_CHANNELS).find(
    (k) => k.toLowerCase() === trimmed.toLowerCase()
  );
  return canonical || null;
}

export function resolveBodyIsotopeChannel(body) {
  if (!body || typeof body !== 'object') return null;
  const explicit = normalizeIsotopeKey(body.isotope);
  if (explicit) return NUCLEAR_DECAY_CHANNELS[explicit] || null;
  const matKey = String(body.material || '').trim().toLowerCase();
  const natural = NATURAL_RADIOISOTOPE_BY_MATERIAL[matKey] || null;
  return natural ? NUCLEAR_DECAY_CHANNELS[natural] || null : null;
}

/**
 * Derive the surrounding dielectric medium's visible refractive index from the
 * active simulation bodies and environment mode. Never hardcodes glow: vacuum
 * has n = 1.0 (threshold β = 1.0 -> unreachable for massive particles!).
 */
export function resolveSurroundingDielectricMedium({
  bodies = [],
  environmentMode = 'vacuum',
  materialProperties = null
} = {}) {
  const list = Array.isArray(bodies) ? bodies : [];
  let hasLiquidWater = false;
  let hasIce = false;
  for (const body of list) {
    const mat = String(body?.material || '').trim().toLowerCase();
    if (mat === 'h2o') {
      const T = Number(body?.temperatureK ?? 293.15);
      if (T >= 273.15 && T < 373.15) hasLiquidWater = true;
      else if (T < 273.15) hasIce = true;
    }
  }
  if (hasLiquidWater) {
    return Object.freeze({ medium: 'h2o-liquid', refractiveIndex: 1.333 });
  }
  if (hasIce) {
    return Object.freeze({ medium: 'h2o-solid', refractiveIndex: 1.309 });
  }
  if (String(environmentMode || '').toLowerCase() === 'air') {
    return Object.freeze({ medium: 'air-gas', refractiveIndex: 1.000293 });
  }
  // Check if any non-radioactive dielectric optical IOR is provided
  if (materialProperties && typeof materialProperties === 'object') {
    for (const [k, props] of Object.entries(materialProperties)) {
      if (k === 'h2o' && props?.phases?.some((p) => p?.name === 'liquid')) {
        return Object.freeze({ medium: 'h2o-liquid', refractiveIndex: 1.333 });
      }
    }
  }
  return Object.freeze({ medium: 'vacuum', refractiveIndex: 1.0 });
}

/**
 * Characteristic relativistic secondary electron kinetic energy (MeV) emitted
 * directly (beta-minus) or via Compton scattering of decay gammas in a medium.
 * Alpha-only channels without high-energy gammas/betas have negligible
 * relativistic electron kinetic energy -> fail closed below Cherenkov threshold.
 */
export function characteristicSecondaryElectronEnergyMeV(channel) {
  if (!channel) return 0;
  // Direct beta-minus endpoint / mean energy plus Compton edge for MeV gammas:
  // Compton edge E_C = E_gamma / (1 + m_e c^2 / (2 E_gamma)).
  const directBetaMeV = channel.qValueMeV * (channel.betaFraction || 0);
  const gammaTotalMeV = channel.qValueMeV * (channel.gammaFraction || 0);
  // Co-60 emits two ~1.25 MeV gammas (Q*gammaFrac ~ 2.51 MeV -> ~1.25 MeV/photon -> Compton edge ~1.04 MeV)
  const photonMeV = gammaTotalMeV > 1.8 ? gammaTotalMeV * 0.5 : gammaTotalMeV;
  const comptonEdgeMeV = photonMeV > 0.25
    ? photonMeV / (1 + ELECTRON_REST_MEV / (2 * photonMeV))
    : 0;
  return Math.max(directBetaMeV, comptonEdgeMeV);
}

/**
 * Create a live Phase 8 Nuclear Decay & Frank-Tamm Cherenkov runtime controller
 * for SPH Studio scenes.
 */
export function createSphNuclearCherenkovController({
  bodies = [],
  particles = null,
  materialProperties = null,
  environmentMode = 'vacuum'
} = {}) {
  const sourceEntries = [];
  const list = Array.isArray(bodies) ? bodies : [];

  for (let i = 0; i < list.length; i += 1) {
    const body = list[i];
    const channel = resolveBodyIsotopeChannel(body);
    if (!channel) continue;
    const matKey = String(body.material || '').trim();
    const props = materialProperties?.[matKey] || materialProperties?.[matKey.toLowerCase()] || null;
    const densityKgPerM3 = Number(
      props?.phases?.find((p) => p?.name === 'solid')?.densityKgPerM3
      ?? props?.phases?.[0]?.densityKgPerM3
      ?? props?.densityKgPerM3
      ?? 8900
    );
    const size = Array.isArray(body.sizeM) ? body.sizeM : [0.2, 0.2, 0.2];
    const volumeM3 = Math.max(1e-9, Math.abs(Number(size[0]) || 0.2) * Math.abs(Number(size[1]) || 0.2) * Math.abs(Number(size[2]) || 0.2));
    let bodyMassKg = densityKgPerM3 * volumeM3;

    // If particles are already constructed, sum exact body particle mass!
    if (Array.isArray(particles) && particles.length > 0) {
      let massSum = 0;
      const domainId = Number(body.domainId) || (i + 1);
      for (const p of particles) {
        const pDomain = Number(p.initialBodyDomainId ?? p.renderDomainId ?? 0);
        if (pDomain === domainId || (pDomain === 0 && String(p.material || '').toLowerCase() === matKey.toLowerCase())) {
          massSum += Number(p.massKg) || 0;
        }
      }
      if (massSum > 0) bodyMassKg = massSum;
    }

    const atomCount = bodyMassKg / (channel.A * AMU_KG);
    sourceEntries.push({
      bodyId: body.id || `body-${i + 1}`,
      domainId: Number(body.domainId) || (i + 1),
      material: matKey,
      isotope: channel.isotope,
      channel,
      massKg: bodyMassKg,
      centerM: Array.isArray(body.centerM) ? [...body.centerM] : [0, 0.2, 0],
      radiusM: 0.5 * Math.cbrt(volumeM3),
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

  // Evaluate initial Cherenkov state strictly from physics (β vs 1/n)
  function evaluateAllSourcesCherenkov() {
    let anyActive = false;
    let peakPhotonsPerMeter = 0;
    let dominant = null;
    const perSource = [];

    for (const src of sourceEntries) {
      const electronMeV = characteristicSecondaryElectronEnergyMeV(src.channel);
      const beta = relativisticBetaFromKineticEnergyMeV(electronMeV, ELECTRON_REST_MEV);
      const cherenkov = evaluateCherenkovClosure({
        beta,
        refractiveIndex: mediumInfo.refractiveIndex,
        chargeZ: 1
      });
      const rec = {
        bodyId: src.bodyId,
        domainId: src.domainId,
        material: src.material,
        isotope: src.isotope,
        daughterIsotope: src.channel.daughterIsotope,
        mode: src.channel.mode,
        centerM: [...src.centerM],
        radiusM: src.radiusM,
        secondaryElectronMeV: electronMeV,
        beta,
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
      const ledger = stepIsotopeInventoryLedger(src.inventory, dt);
      src.inventory = ledger.nextInventory.map((item) => ({ ...item }));
      stepDecays += ledger.totalDecays;
      stepDepositedJ += ledger.depositedThermalEnergyJ;
      stepPowerW += ledger.thermalPowerW;
      if (ledger.nucleonConservationRelError > maxNucleonRelError) {
        maxNucleonRelError = ledger.nucleonConservationRelError;
      }

      // Deposit exact decay heat into matching radioactive particles when present
      if (Array.isArray(liveParticles) && liveParticles.length > 0 && ledger.depositedThermalEnergyJ > 0) {
        let totalMatMass = 0;
        const matched = [];
        for (const p of liveParticles) {
          const pDomain = Number(p.initialBodyDomainId ?? p.renderDomainId ?? 0);
          if (pDomain === src.domainId || (pDomain === 0 && String(p.material || '').toLowerCase() === src.material.toLowerCase())) {
            matched.push(p);
            totalMatMass += Number(p.massKg) || 0;
          }
        }
        if (matched.length > 0 && totalMatMass > 0) {
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
    step,
    getSnapshot
  });
}
