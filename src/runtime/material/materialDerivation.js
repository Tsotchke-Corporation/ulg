import { createMaterialClosureArtifact, hashPayload } from '../../../ulg-gpu-abi/src/index.js';
import { atomicMassKg, symbolForZ, valenceElectronCount, zForSymbol } from '../electronicStructure/periodicTable.js';
import { allElementMolecularEnergy } from '../electronicStructure/allElementMolecularSolver.js';
import { atomizationEnergyHa, rhf, uhf } from '../electronicStructure/molecularHartreeFock.js';
import { anchorDerivedMaterialProperties } from './referenceBankAnchoring.js';
import { idealGasHeatCapacity } from '../electronicStructure/molecularThermochemistry.js';
import molecularVibrationsBank from '../../../data/material-properties/molecular-vibrations.json' with { type: 'json' };
import { PHYSICAL_CONSTANTS, idealGasDensityKgPerM3 } from '../materials/referenceMaterials.js';
import { deriveElementProperties, elementMaterialClosure } from './elementClosures.js';
import { latentHeatOfFusionJPerKg } from './phaseTransitions.js';
import { atomicNumberDensity, debyeHeatCapacityJPerKgK, debyeTemperatureFromSoundSpeed, gasMixtureThermal } from './statisticalMechanics.js';
import {
  PROPERTY_DERIVATION_STATUS as DS,
  assertNoUnprovenancedMaterialProperties,
  materialDerivationSummary,
  propertyProvenanceEntry,
  requireFirstPrinciplesMaterialProperties,
  withPropertyProvenance
} from './propertyProvenance.js';

const A = 1.8897259886;
const AVOGADRO = 6.02214076e23;
const R = 8.314462618;
const HARTREE_EV = 27.211386245988;
const HARTREE_J = 4.3597447222071e-18;
const OPEN_TOP_K = 1e6;
const STANDARD_TEMPERATURE_K = 273.15;
const BASIS_MAX_Z = 18;

const MOLECULAR_FREE_VOLUME = 2.0;
const INTERMOLECULAR_COHESION_FRACTION = 0.07;
const ELEMENTAL_COHESION_FRACTION = 0.35;
const BULK_FROM_COHESION_DENSITY = 0.8;
const MOLECULAR_LINDEMANN_RATIO = 0.14;

const MATERIAL_SPECS = Object.freeze({
  h2: { formula: 'H2', phaseModel: 'ideal-gas' },
  o2: { formula: 'O2', phaseModel: 'ideal-gas' },
  n2: { formula: 'N2', phaseModel: 'ideal-gas' },
  co2: { formula: 'CO2', phaseModel: 'ideal-gas' },
  ar: { formula: 'Ar', phaseModel: 'ideal-gas' },
  h2o: { formula: 'H2O', phaseModel: 'molecular-condensed' },
  air: {
    phaseModel: 'ideal-gas-mixture',
    components: [
      { formula: 'N2', moleFraction: 0.7808 },
      { formula: 'O2', moleFraction: 0.2095 },
      { formula: 'Ar', moleFraction: 0.0093 },
      { formula: 'CO2', moleFraction: 0.0004 }
    ]
  }
});

const ELEMENTAL_MOLECULAR_REFERENCE_SPECS = Object.freeze({
  H: { formula: 'H2', phaseModel: 'ideal-gas' },
  N: { formula: 'N2', phaseModel: 'ideal-gas' },
  O: { formula: 'O2', phaseModel: 'ideal-gas' },
  F: { formula: 'F2', phaseModel: 'ideal-gas' },
  Cl: { formula: 'Cl2', phaseModel: 'ideal-gas' },
  Br: { formula: 'Br2', phaseModel: 'molecular-condensed' },
  I: { formula: 'I2', phaseModel: 'molecular-condensed' }
});

export function elementalMolecularMaterialSpec(symbol) {
  const normalized = typeof symbol === 'string'
    ? symbol[0].toUpperCase() + symbol.slice(1).toLowerCase()
    : '';
  const spec = ELEMENTAL_MOLECULAR_REFERENCE_SPECS[normalized];
  return spec ? {
    ...spec,
    elementSymbol: normalized,
    elementalMolecularReference: true,
    source: 'ambient-elemental-molecular-reference-state'
  } : null;
}

function addCounts(target, source, multiplier = 1) {
  for (const [Z, count] of Object.entries(source)) {
    target[Z] = (target[Z] || 0) + count * multiplier;
  }
  return target;
}

export function parseChemicalFormula(formula) {
  if (typeof formula !== 'string' || formula.length === 0) throw new TypeError('formula must be a non-empty string');
  let i = 0;
  const parseNumber = () => {
    let digits = '';
    while (i < formula.length && /[0-9]/.test(formula[i])) digits += formula[i++];
    return digits ? Number(digits) : 1;
  };
  const parseGroup = () => {
    const counts = {};
    while (i < formula.length) {
      const ch = formula[i];
      if (ch === ')') { i += 1; break; }
      if (ch === '(') {
        i += 1;
        const inner = parseGroup();
        addCounts(counts, inner, parseNumber());
        continue;
      }
      if (!/[A-Z]/.test(ch)) throw new Error(`invalid formula '${formula}' at '${ch}'`);
      let symbol = formula[i++];
      if (i < formula.length && /[a-z]/.test(formula[i])) symbol += formula[i++];
      const Z = zForSymbol(symbol);
      if (Z == null) throw new Error(`unknown element symbol '${symbol}' in formula '${formula}'`);
      counts[Z] = (counts[Z] || 0) + parseNumber();
    }
    return counts;
  };
  const out = parseGroup();
  if (i !== formula.length) throw new Error(`could not parse formula '${formula}'`);
  return out;
}

export function canonicalFormula(atomCounts) {
  return Object.entries(atomCounts)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([Z, count]) => `${symbolForZ(Number(Z))}${count === 1 ? '' : count}`)
    .join('');
}

export function formulaMolarMassKgPerMol(atomCounts) {
  return Object.entries(atomCounts)
    .reduce((sum, [Z, count]) => sum + Number(count) * atomicMassKg(Number(Z)) * AVOGADRO, 0);
}

function atomCount(atomCounts) {
  return Object.values(atomCounts).reduce((sum, count) => sum + count, 0);
}

function expandedAtoms(atomCounts) {
  const atoms = [];
  for (const [Z, count] of Object.entries(atomCounts).sort(([a], [b]) => Number(b) - Number(a))) {
    for (let i = 0; i < count; i += 1) atoms.push(Number(Z));
  }
  return atoms;
}

function direction(i, n) {
  if (n === 1) return [0, 0, 1];
  const phi = Math.acos(1 - (2 * (i + 0.5)) / n);
  const theta = Math.PI * (1 + Math.sqrt(5)) * i;
  return [Math.sin(phi) * Math.cos(theta), Math.sin(phi) * Math.sin(theta), Math.cos(phi)];
}

export function formulaUnitGeometry(atomCounts) {
  const atoms = expandedAtoms(atomCounts);
  if (atoms.length === 0) return [];
  if (atoms.length === 1) return [{ Z: atoms[0], position: [0, 0, 0] }];
  if (atoms.length === 2) {
    const r = 1.15 * A;
    return [
      { Z: atoms[0], position: [0, 0, -0.5 * r] },
      { Z: atoms[1], position: [0, 0, 0.5 * r] }
    ];
  }
  // Central atom = highest covalent bonding capacity min(v, 8-v) from the
  // valence electron count (C:4 > N:3 > O:2 > H/F:1). The previous
  // "first Z > 1 after a descending sort" put O at the center of CO2, and
  // the optimizer dissociated the molecule from that topology.
  const bondingCapacity = (Z) => {
    const v = valenceElectronCount(Z);
    return Math.min(v, Math.max(1, 8 - v));
  };
  let centralIndex = 0;
  for (let i = 1; i < atoms.length; i += 1) {
    if (bondingCapacity(atoms[i]) > bondingCapacity(atoms[centralIndex])) centralIndex = i;
  }
  const central = atoms.splice(centralIndex, 1)[0];
  const out = [{ Z: central, position: [0, 0, 0] }];
  const shellRadius = 1.0 * A;
  atoms.forEach((Z, i) => {
    const d = direction(i, atoms.length);
    out.push({ Z, position: d.map((x) => x * shellRadius) });
  });
  return out;
}

function allInMolecularBasis(atomCounts) {
  return Object.keys(atomCounts).every((Z) => Number(Z) <= BASIS_MAX_Z);
}

function homoLumoColor(geometry) {
  try {
    const res = rhf(geometry);
    const eps = res.orbitalEnergies;
    if (eps && res.nOcc > 0 && res.nOcc < eps.length) {
      const gapEv = (eps[res.nOcc] - eps[res.nOcc - 1]) * HARTREE_EV;
      if (!(gapEv > 0)) return { color: [0.55, 0.55, 0.58], gapEv };
      const lambdaNm = 1239.841984 / gapEv;
      if (lambdaNm < 380) return { color: [0.93, 0.95, 0.97], gapEv };
      if (lambdaNm > 780) return { color: [0.30, 0.28, 0.32], gapEv };
      const t = (lambdaNm - 380) / 400;
      return { color: [Math.max(0.08, 1 - 0.9 * (1 - t)), Math.max(0.08, 1 - 0.55 * Math.sin(Math.PI * t)), Math.max(0.08, 1 - 0.9 * t)], gapEv };
    }
  } catch {
    // Heavy/open-shell formulas use the atomic-density optical proxy below.
  }
  return null;
}

// Lowest vertical electronic excitation of the free molecule from ΔSCF:
// E(lowest triplet) − E(ground singlet), both at the ground geometry. The
// Koopmans HOMO–LUMO gap overshoots badly (F2: 22 eV vs the observed ~4 eV
// band) because it drops electron–hole relaxation; the ΔSCF total-energy
// difference keeps it and lands in the right class (F2: 5.2 eV). This sets
// the centre of the gas visible-absorption band in the optical closure.
// Even-electron molecules only — open-shell ground states have no cheap
// spin-flip proxy, so they return null and stay optically unclosed.
const gasVerticalExcitationCache = new Map();

function gasVerticalExcitationEv(atomCounts, geometry) {
  // Single atoms have no molecular electronic band in this model (noble gases
  // are correctly colourless), and the breathing-mode scan would be meaningless.
  if (!allInMolecularBasis(atomCounts) || !Array.isArray(geometry) || geometry.length < 2) return null;
  const cacheKey = canonicalFormula(atomCounts);
  if (gasVerticalExcitationCache.has(cacheKey)) return gasVerticalExcitationCache.get(cacheKey);
  const excitation = computeGasVerticalExcitationEv(atomCounts, geometry);
  gasVerticalExcitationCache.set(cacheKey, excitation);
  return excitation;
}

function computeGasVerticalExcitationEv(atomCounts, geometry) {
  const electrons = Object.entries(atomCounts)
    .reduce((sum, [Z, count]) => sum + Number(Z) * Number(count), 0);
  if (!Number.isFinite(electrons) || electrons < 2 || electrons % 2 !== 0) return null;
  try {
    // "Vertical" means at the ground-state equilibrium geometry — the template
    // geometry's fixed 1.15 Å diatomic bond compresses F2 by 0.26 Å and inflates
    // the triplet gap from ~5 eV to ~17 eV. Banked harmonic-minimum geometries
    // are already optimized; otherwise relax the breathing mode (uniform scale s
    // on all positions), which is exact for diatomics.
    const banked = MOLECULAR_VIBRATIONS_BY_FORMULA.get(canonicalFormula(atomCounts));
    let groundGeometry = banked
      ? banked.optimizedAtoms.map((a) => ({ Z: a.Z, position: [...a.positionBohr] }))
      : null;
    let singlet = null;
    if (!groundGeometry) {
      const scaled = (s) => geometry.map((a) => ({ Z: a.Z, position: a.position.map((x) => x * s) }));
      let best = null;
      for (let s = 0.9; s <= 1.6001; s += 0.1) {
        let result = null;
        try {
          result = uhf(scaled(s), { multiplicity: 1 });
        } catch {
          continue;
        }
        if (result?.scfConverged && (!best || result.totalEnergyHa < best.energyHa)) {
          best = { s, energyHa: result.totalEnergyHa, result };
        }
      }
      if (!best) return null;
      for (const s of [best.s - 0.05, best.s + 0.05]) {
        try {
          const result = uhf(scaled(s), { multiplicity: 1 });
          if (result?.scfConverged && result.totalEnergyHa < best.energyHa) {
            best = { s, energyHa: result.totalEnergyHa, result };
          }
        } catch {
          // keep the coarse-scan minimum
        }
      }
      groundGeometry = scaled(best.s);
      singlet = best.result;
    } else {
      singlet = uhf(groundGeometry, { multiplicity: 1 });
    }
    const triplet = uhf(groundGeometry, { multiplicity: 3 });
    if (!singlet?.scfConverged || !triplet?.scfConverged) return null;
    const excitationEv = (triplet.totalEnergyHa - singlet.totalEnergyHa) * HARTREE_EV;
    return excitationEv > 0 ? excitationEv : null;
  } catch {
    return null;
  }
}

function formulaAtomicVolumes(atomCounts, options) {
  let volumePerFormulaM3 = 0;
  let weightedBulkPa = 0;
  let weightedConductionElectrons = 0;
  let totalAtoms = 0;
  for (const [ZRaw, count] of Object.entries(atomCounts)) {
    const Z = Number(ZRaw);
    const c = Number(count);
    const element = deriveElementProperties(Z, options);
    const density = element.densityKgPerM3 ?? 0;
    const atomicVolume = density > 0 ? atomicMassKg(Z) / density : atomicMassKg(Z) / 1;
    volumePerFormulaM3 += c * atomicVolume;
    weightedBulkPa += c * atomicVolume * (element.bulkModulusPa ?? 1e5);
    weightedConductionElectrons += c * (element.conductionElectronDensityPerM3 ?? 0) * atomicVolume;
    totalAtoms += c;
  }
  return {
    volumePerFormulaM3,
    bulkPa: volumePerFormulaM3 > 0 ? weightedBulkPa / volumePerFormulaM3 : 1e5,
    conductionElectronDensityPerM3: volumePerFormulaM3 > 0 ? weightedConductionElectrons / volumePerFormulaM3 : null,
    totalAtoms
  };
}

function molecularCohesionJPerFormula(atomCounts, geometry, elementVolumes, options = {}) {
  if (allInMolecularBasis(atomCounts)) {
    try {
      const atomization = atomizationEnergyHa(geometry, { moleculeOptions: options.moleculeOptions || {} });
      if (atomization.atomizationEnergyHa > 0) {
        return {
          value: atomization.atomizationEnergyHa * HARTREE_J * INTERMOLECULAR_COHESION_FRACTION,
          source: 'molecular-hartree-fock-atomization-energy',
          atomizationEnergyHa: atomization.atomizationEnergyHa
        };
      }
    } catch {
      // Use the atomic cold-curve fallback below for formulas the molecular solver cannot close.
    }
  }
  try {
    const molecular = allElementMolecularEnergy(geometry, options.allElementMolecularOptions || {});
    const atomizationHa = molecular.atomicReferenceEnergyHa - molecular.totalEnergyHa;
    if (atomizationHa > 0) {
      return {
        value: atomizationHa * HARTREE_J * INTERMOLECULAR_COHESION_FRACTION,
        source: 'all-element-atomic-kohn-sham-tight-binding-atomization-energy',
        atomizationEnergyHa: atomizationHa
      };
    }
  } catch {
    // Keep the material closure resolvable for exotic formulas; provenance records the fallback.
  }
  const value = Math.max(1e-22, elementVolumes.bulkPa * elementVolumes.volumePerFormulaM3 * ELEMENTAL_COHESION_FRACTION);
  return {
    value,
    source: 'atomic-dft-derived-elemental-cohesion-density',
    atomizationEnergyHa: null
  };
}

// Offline-derived harmonic vibrational frequencies (RHF/STO-3G optimized
// geometry + numerical Hessian, scripts/material-properties/
// generate-molecular-vibrations.mjs). Only records whose derivation closed on
// a bound harmonic minimum are trusted; everything else keeps equipartition,
// which is the exact ambient physics for species whose modes are frozen.
const MOLECULAR_VIBRATIONS_BY_FORMULA = new Map(
  (molecularVibrationsBank?.records || [])
    .filter((record) => record?.status === 'harmonic-minimum-closed'
      && Array.isArray(record.vibrationsCm1)
      && Array.isArray(record.optimizedAtoms)
      // Physical harmonic modes stay below ~4400 cm^-1 (H2 stretch); refuse
      // stale banks carrying collapsed-geometry pseudo-modes.
      && record.vibrationsCm1.every((nu) => nu > 50 && nu < 8000))
    .map((record) => [record.key, record])
);

function gasHeatCapacityForFormula(atomCounts, geometry, temperatureK, molarMassKgPerMol) {
  const banked = MOLECULAR_VIBRATIONS_BY_FORMULA.get(canonicalFormula(atomCounts));
  if (banked) {
    const bankedAtoms = banked.optimizedAtoms.map((a) => ({ Z: a.Z, position: [...a.positionBohr] }));
    const cp = idealGasHeatCapacity(bankedAtoms, banked.vibrationsCm1, temperatureK);
    // Rigid-rotor part (translation + rotation + R), no vibrations: the
    // exact base for a temperature-dependent gas energy segment where the
    // Einstein terms add on top (thermoState subdivides on these fields).
    const rigidRotorCpJPerMolK = (1.5 + (cp.linear ? 1 : 1.5) + 1) * R;
    return {
      cpJPerKgK: cp.cpJPerMolK / molarMassKgPerMol,
      rigidRotorCpJPerKgK: rigidRotorCpJPerMolK / molarMassKgPerMol,
      linear: cp.linear,
      model: 'molecular-rrho-harmonic-vibrations-banked',
      method: banked.method,
      vibrationsCm1: [...banked.vibrationsCm1]
    };
  }
  if (allInMolecularBasis(atomCounts)) {
    try {
      const cp = idealGasHeatCapacity(geometry, [], temperatureK).cpJPerMolK;
      return { cpJPerKgK: cp / molarMassKgPerMol, model: 'molecular-equipartition', vibrationsCm1: null };
    } catch {
      // Fall through to equipartition.
    }
  }
  const n = atomCount(atomCounts);
  const rotational = n <= 1 ? 0 : (n === 2 ? 1 : 1.5);
  const cvMolar = (1.5 + rotational) * R;
  return { cpJPerKgK: (cvMolar + R) / molarMassKgPerMol, model: 'atom-count-equipartition', vibrationsCm1: null };
}

export function deriveFormulaMaterialProperties({
  key = null,
  formula = null,
  atomCounts = null,
  geometry = null,
  phaseModel = 'molecular-condensed',
  options = {}
} = {}) {
  const counts = atomCounts || parseChemicalFormula(formula);
  const resolvedFormula = formula || canonicalFormula(counts);
  const molarMassKgPerMol = formulaMolarMassKgPerMol(counts);
  const atomsPerFormula = atomCount(counts);
  const geom = geometry || formulaUnitGeometry(counts);

  if (phaseModel === 'ideal-gas') {
    const gasHeat = gasHeatCapacityForFormula(counts, geom, STANDARD_TEMPERATURE_K, molarMassKgPerMol);
    const gasCp = gasHeat.cpJPerKgK;
    const gasDensity = idealGasDensityKgPerM3({
      pressurePa: PHYSICAL_CONSTANTS.standardAtmospherePa,
      temperatureK: STANDARD_TEMPERATURE_K,
      molarMassKgPerMol
    });
    // The live ΔSCF scan is seconds of Hartree-Fock per formula — far too slow
    // for the demo build path, where reaction discovery derives many candidate
    // products. Runtime band values come from reference-bank anchoring
    // (referenceBankAnchoring.js); pass options.deriveGasElectronicExcitation
    // to run the pure ΔSCF derivation here (tests, offline bank extension).
    const gasExcitationEv = options?.deriveGasElectronicExcitation
      ? gasVerticalExcitationEv(counts, geom)
      : null;
    return withPropertyProvenance({
      molarMassKgPerMol,
      atomsPerFormula,
      formula: resolvedFormula,
      idealGas: true,
      heatCapacityModel: { gas: gasHeat.model },
      gasVibrationsCm1: gasHeat.vibrationsCm1,
      gasElectronicExcitationEv: gasExcitationEv,
      gasElectronicBandFwhmEv: null,
      gasElectronicOscillatorStrength: null,
      phases: [{
        name: 'gas',
        cpJPerKgK: gasCp,
        gasVibrationsCm1: gasHeat.vibrationsCm1,
        gasRigidRotorCpJPerKgK: gasHeat.rigidRotorCpJPerKgK ?? null,
        densityKgPerM3: gasDensity,
        temperatureRange: [0, OPEN_TOP_K],
        bulkModulusPa: null,
        shearModulusPa: 0
      }],
      transitions: []
    }, {
      entries: [
        propertyProvenanceEntry({
          paths: ['molarMassKgPerMol', 'atomsPerFormula'],
          status: DS.EXACT_CONSTANT,
          source: 'periodic-table-atomic-masses',
          method: 'formula molar mass and atom count from parsed chemical formula',
          inputs: [resolvedFormula]
        }),
        propertyProvenanceEntry({
          paths: ['idealGas', 'phases.gas.cpJPerKgK', 'phases.gas.densityKgPerM3', 'phases.gas.temperatureRange', 'phases.gas.shearModulusPa'],
          status: DS.PHYSICAL_LAW,
          source: 'molecular-statistical-mechanics+ideal-gas-law',
          method: gasHeat.vibrationsCm1
            ? 'rigid-rotor plus banked harmonic-vibration Einstein heat capacity plus rho=pM/RT'
            : 'rigid-rotor/equipartition heat capacity plus rho=pM/RT'
        }),
        propertyProvenanceEntry({
          paths: ['gasElectronicExcitationEv', 'gasElectronicBandFwhmEv', 'gasElectronicOscillatorStrength'],
          status: DS.PHYSICAL_LAW,
          source: 'delta-scf-uhf-vertical-triplet-excitation',
          method: 'UHF total-energy difference E(triplet)-E(singlet) at the breathing-mode-relaxed ground geometry; null unless derivation requested (reference-bank anchoring supplies runtime band values)'
        })
      ],
      notes: [`${key || resolvedFormula} gas closure is derived from formula mass and molecular statistical mechanics.`]
    });
  }

  const elementVolumes = formulaAtomicVolumes(counts, options);
  const volumePerFormulaM3 = elementVolumes.volumePerFormulaM3 * MOLECULAR_FREE_VOLUME;
  const densityKgPerM3 = molarMassKgPerMol / (AVOGADRO * volumePerFormulaM3);
  const cohesion = molecularCohesionJPerFormula(counts, geom, elementVolumes, options);
  const cohesiveEnergyDensity = cohesion.value / volumePerFormulaM3;
  const bulkModulusPa = Math.max(1e6, cohesiveEnergyDensity * BULK_FROM_COHESION_DENSITY);
  const shearModulusPa = bulkModulusPa * 0.35;
  const numberDensity = atomicNumberDensity({ densityKgPerM3, molarMassKgPerMol, atomsPerFormula });
  const soundSpeedMPerS = Math.sqrt(bulkModulusPa / densityKgPerM3);
  const debyeTemperatureK = debyeTemperatureFromSoundSpeed({ soundSpeedMPerS, numberDensityPerM3: numberDensity });
  const cpSolid = debyeHeatCapacityJPerKgK(STANDARD_TEMPERATURE_K, { debyeTemperatureK, molarMassKgPerMol, atomsPerFormula });
  const highTemperatureCp = (3 * R * atomsPerFormula) / molarMassKgPerMol;
  const spacingM = (volumePerFormulaM3 / Math.max(1, atomsPerFormula)) ** (1 / 3);
  const massPerFormulaKg = molarMassKgPerMol / AVOGADRO;
  const meltingPointK = Math.max(1, (MOLECULAR_LINDEMANN_RATIO ** 2 / 3) * spacingM * spacingM * massPerFormulaKg * 1.380649e-23 * debyeTemperatureK * debyeTemperatureK / (1.054571817e-34 ** 2));
  const latentFusion = latentHeatOfFusionJPerKg({
    meltingPointK,
    molarMassKgPerMol,
    entropyOfFusionJPerMolK: R * Math.sqrt(atomsPerFormula)
  });
  const latentVaporizationJPerKg = Math.max(cohesion.value * AVOGADRO / molarMassKgPerMol, latentFusion * 2);
  const entropyVaporization = R * (10 + Math.sqrt(atomsPerFormula));
  const boilingPointK = Math.max(meltingPointK * 1.15, (latentVaporizationJPerKg * molarMassKgPerMol) / entropyVaporization);
  const condensedGasHeat = gasHeatCapacityForFormula(counts, geom, boilingPointK, molarMassKgPerMol);
  const gasCp = condensedGasHeat.cpJPerKgK;
  const gasDensity = idealGasDensityKgPerM3({
    pressurePa: PHYSICAL_CONSTANTS.standardAtmospherePa,
    temperatureK: boilingPointK,
    molarMassKgPerMol
  });
  const color = homoLumoColor(geom) || {
    color: elementVolumes.conductionElectronDensityPerM3 > 0 ? [0.74, 0.74, 0.76] : [0.9, 0.92, 0.94],
    gapEv: null
  };

  return withPropertyProvenance({
    molarMassKgPerMol,
    atomsPerFormula,
    formula: resolvedFormula,
    compound: true,
    derivation: `generic-formula-material: ${cohesion.source}; atomic-volume packing; Debye/Lindemann phase model`,
    intrinsicColorSrgb: color.color,
    electronicGapEv: color.gapEv,
    phases: [
      { name: 'solid', cpJPerKgK: cpSolid, densityKgPerM3, temperatureRange: [0, meltingPointK], debyeTemperatureK, bulkModulusPa, shearModulusPa },
      { name: 'liquid', cpJPerKgK: highTemperatureCp * (1 + MOLECULAR_LINDEMANN_RATIO), densityKgPerM3: densityKgPerM3 * (1 - 3 * MOLECULAR_LINDEMANN_RATIO * MOLECULAR_LINDEMANN_RATIO), temperatureRange: [meltingPointK, boilingPointK], bulkModulusPa: bulkModulusPa * 0.75, shearModulusPa: 0 },
      {
        name: 'gas',
        cpJPerKgK: gasCp,
        gasVibrationsCm1: condensedGasHeat.vibrationsCm1,
        gasRigidRotorCpJPerKgK: condensedGasHeat.rigidRotorCpJPerKgK ?? null,
        densityKgPerM3: gasDensity,
        temperatureRange: [boilingPointK, OPEN_TOP_K],
        bulkModulusPa: null,
        shearModulusPa: 0
      }
    ],
    transitions: [
      { from: 'solid', to: 'liquid', temperatureK: meltingPointK, latentHeatJPerKg: latentFusion },
      { from: 'liquid', to: 'gas', temperatureK: boilingPointK, latentHeatJPerKg: latentVaporizationJPerKg }
    ],
    closureBacked: true,
    validation: { eosValidation: false, thermalValidation: false, opticalValidation: false, scientificValidation: false }
  }, {
    entries: [
      propertyProvenanceEntry({
        paths: ['molarMassKgPerMol', 'atomsPerFormula'],
        status: DS.EXACT_CONSTANT,
        source: 'periodic-table-atomic-masses',
        method: 'formula molar mass and atom count from parsed chemical formula',
        inputs: [resolvedFormula]
      }),
      propertyProvenanceEntry({
        paths: [
          'intrinsicColorSrgb',
          'phases.*.cpJPerKgK',
          'phases.*.densityKgPerM3',
          'phases.solid.debyeTemperatureK',
          'phases.solid.bulkModulusPa',
          'phases.solid.shearModulusPa',
          'phases.liquid.bulkModulusPa',
          'phases.*.temperatureRange',
          'transitions.*.temperatureK',
          'transitions.*.latentHeatJPerKg'
        ],
        status: DS.LOWER_LEVEL_SIMULATION,
        source: 'generic-formula-electronic-structure+atomic-dft+statistical-mechanics',
        method: 'formula geometry/electronic energy or atomic DFT cohesion -> condensed EOS -> Debye/Lindemann phase model'
      }),
      propertyProvenanceEntry({
        paths: ['phases.liquid.shearModulusPa', 'phases.gas.shearModulusPa'],
        status: DS.PHYSICAL_LAW,
        source: 'continuum-mechanics',
        method: 'fluid phases have no static shear modulus'
      })
    ],
    notes: [`${key || resolvedFormula} closure uses the generic formula pipeline; validation remains evidence-only.`]
  });
}

function deriveMixtureProperties({ key, components }) {
  let molarMassKgPerMol = 0;
  let cvMolar = 0;
  const provenanceInputs = [];
  for (const component of components) {
    const atomCounts = parseChemicalFormula(component.formula);
    const molarMass = formulaMolarMassKgPerMol(atomCounts);
    const geometry = formulaUnitGeometry(atomCounts);
    const cp = gasHeatCapacityForFormula(atomCounts, geometry, STANDARD_TEMPERATURE_K, molarMass).cpJPerKgK;
    const cv = cp * molarMass - R;
    molarMassKgPerMol += component.moleFraction * molarMass;
    cvMolar += component.moleFraction * cv;
    provenanceInputs.push(`${component.formula}:${component.moleFraction}`);
  }
  if (!(molarMassKgPerMol > 0)) {
    const air = gasMixtureThermal();
    molarMassKgPerMol = air.molarMassKgPerMol;
    cvMolar = air.cvJPerKgK * air.molarMassKgPerMol;
  }
  const densityKgPerM3 = idealGasDensityKgPerM3({
    pressurePa: PHYSICAL_CONSTANTS.standardAtmospherePa,
    temperatureK: STANDARD_TEMPERATURE_K,
    molarMassKgPerMol
  });
  return withPropertyProvenance({
    molarMassKgPerMol,
    idealGas: true,
    mixture: true,
    heatCapacityModel: { gas: 'component-statistical-mechanics' },
    phases: [{ name: 'gas', cpJPerKgK: cvMolar / molarMassKgPerMol, densityKgPerM3, temperatureRange: [0, OPEN_TOP_K], bulkModulusPa: null, shearModulusPa: 0 }],
    transitions: []
  }, {
    entries: [
      propertyProvenanceEntry({
        paths: ['molarMassKgPerMol'],
        status: DS.EXACT_CONSTANT,
        source: 'declared-gas-mixture-composition',
        method: 'mole-fraction-weighted formula molar mass',
        inputs: provenanceInputs
      }),
      propertyProvenanceEntry({
        paths: ['idealGas', 'phases.gas.cpJPerKgK', 'phases.gas.densityKgPerM3', 'phases.gas.temperatureRange', 'phases.gas.shearModulusPa'],
        status: DS.PHYSICAL_LAW,
        source: 'component-statistical-mechanics+ideal-gas-law',
        method: 'component ideal-gas heat capacities mixed by mole fraction plus rho=pM/RT'
      })
    ],
    notes: [`${key} is a declared ideal-gas mixture; composition is an input condition, not a material-property fallback.`]
  });
}

export function resolveMaterialSpec(materialKey, overrides = {}) {
  if (overrides[materialKey]) return overrides[materialKey];
  const lower = typeof materialKey === 'string' ? materialKey.toLowerCase() : materialKey;
  if (MATERIAL_SPECS[lower]) return MATERIAL_SPECS[lower];
  const symbol = materialKey ? materialKey[0].toUpperCase() + materialKey.slice(1).toLowerCase() : '';
  const molecularElementSpec = elementalMolecularMaterialSpec(symbol);
  if (molecularElementSpec) return molecularElementSpec;
  if (zForSymbol(symbol) != null) return { formula: symbol, phaseModel: 'element' };
  if (/^[A-Z][A-Za-z0-9()]*$/.test(materialKey || '')) return { formula: materialKey, phaseModel: 'molecular-condensed' };
  if (/^[a-z0-9()]+$/.test(materialKey || '')) {
    const normalized = materialKey.replace(/(^|[0-9(])([a-z])/g, (_, p, c) => `${p}${c.toUpperCase()}`);
    return { formula: normalized, phaseModel: 'molecular-condensed' };
  }
  throw new Error(`Cannot resolve material spec for '${materialKey}'`);
}

export function deriveMaterialProperties(materialKey, options = {}) {
  const spec = resolveMaterialSpec(materialKey, options.materialSpecs || {});
  if (spec.phaseModel === 'ideal-gas-mixture') return deriveMixtureProperties({ key: materialKey, components: spec.components });
  if (spec.phaseModel === 'element') {
    const Z = zForSymbol(spec.formula);
    const closure = elementMaterialClosure(Z, options.elementOptions || {});
    if (closure) return closure.properties;
    return deriveFormulaMaterialProperties({ key: materialKey, formula: spec.formula, phaseModel: 'ideal-gas', options: options.elementOptions || {} });
  }
  return deriveFormulaMaterialProperties({
    key: materialKey,
    formula: spec.formula,
    atomCounts: spec.atomCounts,
    geometry: spec.geometry,
    phaseModel: spec.phaseModel,
    options: options.elementOptions || {}
  });
}

// Reference-anchored variant: derive first, then anchor phase boundaries with
// bank reference data (reference-fallback provenance, residuals retained).
// The strict first-principles gate is skipped only when anchoring applied -
// strict callers keep using createDerivedMaterialClosure directly.
export function createReferenceAnchoredMaterialClosure(materialKey, options = {}) {
  const derived = deriveMaterialProperties(materialKey, options);
  const anchoring = anchorDerivedMaterialProperties(derived, materialKey);
  if (!anchoring.anchored) return createDerivedMaterialClosure(materialKey, options);
  const properties = anchoring.properties;
  assertNoUnprovenancedMaterialProperties(properties);
  const materialDerivation = materialDerivationSummary(properties);
  const validityDomain = options.validityDomain || {
    temperatureK: [0, 6000],
    pressurePa: [1, 1e9],
    composition: properties.formula || 'pure'
  };
  const inputHash = hashPayload({ material: materialKey, spec: resolveMaterialSpec(materialKey, options.materialSpecs || {}), provenance: properties.propertyProvenance });
  const methodHash = hashPayload({ method: 'ulg.reference-anchored-material-derivation.v0', properties });
  const base = createMaterialClosureArtifact({
    closureFamily: 'material',
    closureId: `ulg-reference-anchored-${materialKey}-material-closure`,
    material: materialKey,
    inputRefs: [{ schema: 'ulg.first-principles-material-input.v0', material: materialKey, status: 'produced', inputHash }],
    producer: { service: 'ulg-runtime', commit: null, toolchain: 'generic-derivation+reference-bank-anchoring' },
    validityDomain,
    units: {
      density: 'kg/m^3',
      heatCapacity: 'J/(kg*K)',
      thermalConductivity: 'W/(m*K)',
      specificInternalEnergy: 'J/kg',
      latentHeat: 'J/kg',
      temperature: 'K'
    },
    properties,
    derivatives: true,
    materialDerivation,
    validation: { status: 'reference-bank-anchored-model-unvalidated', evidenceRefs: [] },
    provenance: {
      source: 'generic-first-principles-material-derivation+reference-bank-anchoring',
      inputHash,
      methodHash,
      notes: [
        `Material closure for ${materialKey}; phase boundaries anchored to the reference bank (residuals retained).`,
        `Anchored paths: ${anchoring.anchoredPaths.join(', ')}.`
      ]
    }
  });
  return {
    ...base,
    materialDerivation,
    referenceBankAnchoring: properties.referenceBankAnchoring,
    inputHash,
    methodHash,
    execution: { mode: 'generic-first-principles-material-derivation+reference-bank-anchoring' },
    validity: { temperatureK: validityDomain.temperatureK },
    provenance: { ...base.provenance, inputHash, methodHash }
  };
}

export function createDerivedMaterialClosure(materialKey, options = {}) {
  const properties = deriveMaterialProperties(materialKey, options);
  assertNoUnprovenancedMaterialProperties(properties);
  requireFirstPrinciplesMaterialProperties(properties, {
    material: materialKey,
    context: 'createDerivedMaterialClosure'
  });
  const materialDerivation = materialDerivationSummary(properties);
  const validityDomain = options.validityDomain || {
    temperatureK: [0, 6000],
    pressurePa: [1, 1e9],
    composition: properties.formula || (properties.mixture ? 'declared-mixture' : 'pure')
  };
  const inputHash = hashPayload({ material: materialKey, spec: resolveMaterialSpec(materialKey, options.materialSpecs || {}), provenance: properties.propertyProvenance });
  const methodHash = hashPayload({ method: 'ulg.generic-first-principles-material-derivation.v2', properties });
  const base = createMaterialClosureArtifact({
    closureFamily: 'material',
    closureId: `ulg-derived-${materialKey}-material-closure`,
    material: materialKey,
    inputRefs: [{ schema: 'ulg.first-principles-material-input.v0', material: materialKey, status: 'produced', inputHash }],
    producer: { service: 'ulg-runtime', commit: null, toolchain: 'generic-electronic-statmech-material-derivation' },
    validityDomain,
    units: {
      density: 'kg/m^3',
      heatCapacity: 'J/(kg*K)',
      specificInternalEnergy: 'J/kg',
      latentHeat: 'J/kg',
      temperature: 'K'
    },
    properties,
    derivatives: true,
    materialDerivation,
    validation: { status: 'first-principles-model-unvalidated', evidenceRefs: [] },
    provenance: {
      source: 'generic-first-principles-material-derivation',
      inputHash,
      methodHash,
      notes: [
        `Material closure for ${materialKey}; fullyLowerLevelDerived=${materialDerivation.fullyLowerLevelDerived}.`,
        'Derived values are model evidence, not measured validation.'
      ]
    }
  });
  return {
    ...base,
    materialDerivation,
    inputHash,
    methodHash,
    execution: { mode: 'generic-first-principles-material-derivation' },
    validity: { temperatureK: validityDomain.temperatureK },
    provenance: { ...base.provenance, inputHash, methodHash }
  };
}

export function createDerivedMaterialClosures(materialKeys, options = {}) {
  return Object.fromEntries(materialKeys.map((key) => [key, createDerivedMaterialClosure(key, options)]));
}
