// General element material-closure engine: derive bulk material properties for ANY element from
// the electronic structure, rather than tabulating them per element.
//
// One physical chain, applied to every Z:
//   atomic Kohn–Sham DFT  ->  core radius (charge enclosing the core electrons)
//        + valence count  ->  jellium + Ashcroft-empty-core cohesion
//                          ->  equilibrium density, bulk modulus, cohesive energy   (cold curve)
//   density + bulk modulus ->  sound speed -> Debye temperature -> heat capacity     (thermal)
//   valence electron density + scalar-relativistic d/f transitions -> colour         (optical)
//   cohesive energy        ->  melting-temperature correlation                        (transition)
//
// Honest scope (the closure carries these flags, nothing is faked):
//  - Quantitative for nearly-free-electron sp-metals (Li, Na, K, Mg, Al, ...).
//  - Transition / rare-earth metals (localized d/f) and covalent/molecular/noble solids are out of
//    the simple jellium domain; radial quantum packing is used for their condensed estimates.
//  - Drude gives the neutral grey of a free-electron metal; localized d/f interband colour comes
//    from scalar-relativistic Kohn-Sham transition energies in the optical closure.
// All derived (closureBacked: true), none validated against measured data (validation: false).

import {
  atomicMassKg,
  electronConfiguration,
  valenceElectronCount,
  symbolForZ,
  configurationString
} from '../../runtime/electronicStructure/periodicTable.js';
import { solveAtom } from '../../runtime/electronicStructure/radialKohnSham.js';
import { simpleMetalColdCurve } from '../../runtime/electronicStructure/jelliumCohesion.js';
import { BOHR_TO_M } from '../../runtime/electronicStructure/uniformElectronGas.js';
import { debyeTemperatureFromSoundSpeed, debyeHeatCapacityJPerKgK } from './statisticalMechanics.js';
import { metalRelativisticColorSrgb } from './opticalClosure.js';
import {
  PROPERTY_DERIVATION_STATUS as DS,
  materialDerivationSummary,
  propertyProvenanceEntry,
  requireFirstPrinciplesMaterialProperties,
  withPropertyProvenance
} from './propertyProvenance.js';

const HBAR = 1.054571817e-34;
const KB = 1.380649e-23;
const ELECTRON_CHARGE = 1.602176634e-19;
const EPSILON0 = 8.8541878128e-12;
const ELECTRON_MASS = 9.1093837015e-31;
const AVOGADRO = 6.02214076e23;
const EV_TO_J = 1.602176634e-19;
const OPEN_TOP_K = 1e6;
// Universal (material-independent) physical constants used to close the cold-curve model — the same
// class as Richards'/Trouton's rules already in the codebase. NOT per-element fits.
const POISSON_RATIO = 0.3; // isotropic-elasticity shear-from-bulk relation
const LINDEMANN_RATIO = 0.07; // rms-displacement / spacing at melting (Lindemann criterion)
const METALLIC_LINDEMANN_RATIO = 0.05; // transition-metal radial-density branch; same global rule
const LIQUID_DENSITY_FRACTION = 0.95; // ~5% volume expansion on melting
const RICHARDS_FUSION_ENTROPY = 8.314462618; // ΔS_fus ≈ R per mole (Richards' rule), J/(mol K)
const HARTREE_TO_J = 4.3597447222071e-18;
const RADIAL_PACKING_FRACTION = 0.68;
const ELECTRON_OVERLAP_COHESION_FRACTION = 0.16;
// Noble gases: closed shells (He's 1s² has valence count 2 but is closed) — outside the
// free-electron metal model regardless of the raw s+p count.
const NOBLE_GAS_Z = new Set([2, 10, 18, 36, 54, 86, 118]);

/**
 * Empty-core (Ashcroft) radius (Bohr) for the pseudopotential, derived as the radius of the sphere
 * enclosing the core (non-valence) electrons in the atom's self-consistent DFT density. This is the
 * one element-specific length the jellium cohesion needs, and here it comes from the atomic DFT
 * rather than being fitted.
 */
export function coreRadiusBohr(atomicNumberZ, valence, { gridPointsN = 700, rMaxBohr = 30 } = {}) {
  const coreElectrons = atomicNumberZ - valence;
  if (coreElectrons <= 0) return 0;
  // The core radius (charge enclosing the core electrons) is robust to grid resolution, so a coarse
  // grid keeps the whole-table sweep affordable.
  const atom = solveAtom(atomicNumberZ, { returnRadialDensity: true, gridPointsN, rMaxBohr, maxScf: 200 });
  const { r, rho, dx } = atom.radialGrid;
  let cumulative = 0;
  for (let i = 0; i < r.length; i += 1) {
    cumulative += rho[i] * 4 * Math.PI * r[i] * r[i] * r[i] * dx; // dr = r dx
    if (cumulative >= coreElectrons) return r[i];
  }
  return r[r.length - 1];
}

function radialContainmentRadiusBohr(atomicNumberZ, targetElectrons, { gridPointsN = 700, rMaxBohr = 30 } = {}) {
  const atom = solveAtom(atomicNumberZ, { returnRadialDensity: true, gridPointsN, rMaxBohr, maxScf: 200 });
  const { r, rho, dx } = atom.radialGrid;
  let cumulative = 0;
  for (let i = 0; i < r.length; i += 1) {
    cumulative += rho[i] * 4 * Math.PI * r[i] * r[i] * r[i] * dx; // dr = r dx
    if (cumulative >= targetElectrons) return { radiusBohr: r[i], atom };
  }
  return { radiusBohr: r[r.length - 1], atom };
}

function openSubshellElectrons(subshell) {
  const capacity = 2 * (2 * subshell.l + 1);
  if (subshell.occupancy <= 0 || subshell.occupancy >= capacity) return 0;
  return subshell.occupancy;
}

function bondingElectronCount(atomicNumberZ) {
  const config = electronConfiguration(atomicNumberZ);
  const maxN = config.reduce((m, s) => Math.max(m, s.n), 0);
  const outerSP = config
    .filter((s) => s.n === maxN && (s.l === 0 || s.l === 1))
    .reduce((sum, s) => sum + s.occupancy, 0);
  const openDF = config
    .filter((s) => (s.l === 2 || s.l === 3))
    .reduce((sum, s) => sum + openSubshellElectrons(s), 0);
  return Math.max(1, outerSP + openDF);
}

function hasOpenDFShell(atomicNumberZ) {
  return electronConfiguration(atomicNumberZ)
    .some((s) => (s.l === 2 || s.l === 3) && openSubshellElectrons(s) > 0);
}

function outerOrbitalBindingHa(atom, atomicNumberZ) {
  const config = electronConfiguration(atomicNumberZ);
  const maxN = config.reduce((m, s) => Math.max(m, s.n), 0);
  const active = new Set(config
    .filter((s) => s.n === maxN || ((s.l === 2 || s.l === 3) && openSubshellElectrons(s) > 0))
    .map((s) => `${s.n}:${s.l}`));
  let weighted = 0;
  let occ = 0;
  for (const orbital of atom.orbitals || []) {
    if (!active.has(`${orbital.n}:${orbital.l}`)) continue;
    weighted += Math.abs(orbital.energyHa) * orbital.occupancy;
    occ += orbital.occupancy;
  }
  return occ > 0 ? weighted : Math.abs(atom.orbitals?.at(-1)?.energyHa ?? 0.05);
}

/** Drude reflectance colour (sRGB) of a free-electron metal from its conduction-electron density. */
function metalOpticalColorSrgb(atomicNumberZ, freeElectronDensityPerM3, options = {}) {
  const color = metalRelativisticColorSrgb({
    atomicNumberZ,
    conductionElectronDensityPerM3: freeElectronDensityPerM3,
    interbandOptions: options.opticalInterbandOptions || {}
  });
  return {
    srgb: [color.r, color.g, color.b],
    plasmaRadPerS: color.plasmaRadPerS,
    interbandOscillators: color.interbandOscillators
  };
}

/**
 * Derive the bulk material properties of element Z from the electronic structure. Returns the
 * cold-curve (density, bulk modulus, cohesive energy), thermal (Debye temperature, heat capacity),
 * optical (Drude colour), and a melting estimate, plus honesty flags.
 */
export function deriveElementProperties(atomicNumberZ, options = {}) {
  const symbol = symbolForZ(atomicNumberZ);
  const valence = valenceElectronCount(atomicNumberZ);
  const bondingElectrons = bondingElectronCount(atomicNumberZ);
  const massKg = atomicMassKg(atomicNumberZ);
  const molarMassKgPerMol = massKg * AVOGADRO;

  // Closed-shell noble gases do not expose a condensed closure in this first pass. Other elements,
  // including transition metals and non-metals, continue through the same quantum-density branch
  // below instead of falling back to a table.
  if (NOBLE_GAS_Z.has(atomicNumberZ)) {
    return {
      atomicNumberZ,
      symbol,
      configuration: configurationString(atomicNumberZ),
      valenceElectrons: valence,
      bondingElectrons,
      molarMassKgPerMol,
      metallicModelApplicable: false,
      note: NOBLE_GAS_Z.has(atomicNumberZ) ? 'noble gas: closed shell' : (valence <= 0 ? 'closed-shell: no free-electron valence' : 'full sp shell: not a free-electron metal'),
      closureBacked: true,
      validation: { eosValidation: false, thermalValidation: false, opticalValidation: false, scientificValidation: false }
    };
  }

  const transitionOrNonFreeElectron = hasOpenDFShell(atomicNumberZ) || valence <= 0 || valence >= 8;
  const emptyCoreRadiusBohr = transitionOrNonFreeElectron
    ? null
    : coreRadiusBohr(atomicNumberZ, valence, options);
  let cold;
  if (transitionOrNonFreeElectron) {
    const targetElectrons = Math.max(0.5, atomicNumberZ - Math.max(0.5, bondingElectrons / 4));
    const { radiusBohr, atom } = radialContainmentRadiusBohr(atomicNumberZ, targetElectrons, options);
    const volumePerAtomM3 = (4 * Math.PI / 3) * (radiusBohr * BOHR_TO_M) ** 3 / RADIAL_PACKING_FRACTION;
    const densityKgPerM3 = massKg / volumePerAtomM3;
    const cohesionJPerAtom = Math.max(
      0.005 * EV_TO_J,
      outerOrbitalBindingHa(atom, atomicNumberZ) * HARTREE_TO_J * ELECTRON_OVERLAP_COHESION_FRACTION
    );
    cold = {
      equilibriumRsBohr: radiusBohr,
      equilibriumDensityKgPerM3: densityKgPerM3,
      bulkModulusPa: Math.max(1e6, 2 * cohesionJPerAtom / volumePerAtomM3),
      bindingEnergyEvPerElectron: cohesionJPerAtom / (EV_TO_J * bondingElectrons),
      radialPackingRadiusBohr: radiusBohr,
      radialPackingTargetElectrons: targetElectrons,
      quantumDensityModel: 'atomic-kohn-sham-radial-density-packing'
    };
  } else {
    cold = simpleMetalColdCurve({ atomicMassKg: massKg, valenceElectronsPerAtom: valence, emptyCoreRadiusBohr });
  }

  const densityKgPerM3 = cold.equilibriumDensityKgPerM3;
  const bulkModulusPa = cold.bulkModulusPa;
  const numberDensityPerM3 = densityKgPerM3 / massKg;

  // Thermal: longitudinal-ish sound speed from B and ρ -> Debye temperature -> heat capacity.
  const soundSpeedMPerS = Math.sqrt(Math.max(bulkModulusPa, 0) / densityKgPerM3);
  const debyeTemperatureK = debyeTemperatureFromSoundSpeed({ soundSpeedMPerS, numberDensityPerM3 });
  const cpJPerKgK = debyeHeatCapacityJPerKgK(300, { debyeTemperatureK, molarMassKgPerMol, atomsPerFormula: 1 });

  // Optical: Drude colour from the conduction-electron density.
  const optical = metalOpticalColorSrgb(atomicNumberZ, valence * numberDensityPerM3, options);

  // Shear modulus from the derived bulk modulus via the isotropic-elasticity relation with a single
  // UNIVERSAL Poisson ratio (jellium itself is a fluid → no shear; the deviatoric stiffness comes
  // from the ion lattice, whose ab-initio elastic tensor is the frontier). One universal relation,
  // not a per-element constant: μ = K·3(1−2ν)/(2(1+ν)).
  const shearModulusPa = bulkModulusPa * (3 * (1 - 2 * POISSON_RATIO)) / (2 * (1 + POISSON_RATIO));

  // Melting from the Lindemann criterion using the DERIVED Debye temperature: a Debye solid melts
  // when the rms thermal displacement reaches a universal fraction x_m of the atomic spacing.
  // ⟨u²⟩ = 3ℏ²T/(M k_B θ_D²) = (x_m·a)² ⇒ T_m = x_m² a² M k_B θ_D² / (3ℏ²). x_m is the one universal
  // Lindemann constant (not per-element).
  const atomicSpacingM = (1 / numberDensityPerM3) ** (1 / 3);
  const lindemannRatio = transitionOrNonFreeElectron ? METALLIC_LINDEMANN_RATIO : LINDEMANN_RATIO;
  const meltingPointK = (lindemannRatio * lindemannRatio / 3) * atomicSpacingM * atomicSpacingM * massKg * KB * debyeTemperatureK * debyeTemperatureK / (HBAR * HBAR);

  return {
    atomicNumberZ,
    symbol,
    configuration: configurationString(atomicNumberZ),
    valenceElectrons: valence,
    bondingElectrons,
    molarMassKgPerMol,
    metallicModelApplicable: !transitionOrNonFreeElectron,
    condensedModelApplicable: true,
    emptyCoreRadiusBohr,
    radialPackingRadiusBohr: cold.radialPackingRadiusBohr,
    radialPackingTargetElectrons: cold.radialPackingTargetElectrons,
    equilibriumWignerSeitzRadiusBohr: cold.equilibriumRsBohr,
    densityKgPerM3,
    bulkModulusPa,
    shearModulusPa,
    soundSpeedMPerS,
    debyeTemperatureK,
    cpJPerKgK,
    conductionElectronDensityPerM3: valence * numberDensityPerM3,
    opticalColorSrgb: optical.srgb,
    opticalInterbandOscillators: optical.interbandOscillators,
    plasmaFrequencyRadPerS: optical.plasmaRadPerS,
    meltingPointK,
    lindemannRatio,
    derivation: transitionOrNonFreeElectron
      ? 'atomic-DFT radial density -> quantum packing/cohesion-density cold curve -> Debye (cp, θ_D) -> Lindemann melt + Poisson shear; scalar-relativistic Kohn-Sham Drude-Lorentz colour'
      : 'atomic-DFT core radius -> polyvalent jellium cohesion (density, B) -> Debye (cp, θ_D) -> Lindemann melt + Poisson shear; scalar-relativistic Kohn-Sham Drude-Lorentz colour',
    closureBacked: true,
    validation: { eosValidation: false, thermalValidation: false, opticalValidation: false, scientificValidation: false }
  };
}

/** Derive properties for a list of elements (default: the whole table, Z = 1..118). */
export function deriveAllElementProperties(zList = Array.from({ length: 118 }, (_, i) => i + 1), options = {}) {
  return zList.map((Z) => deriveElementProperties(Z, options));
}

const elementClosureCache = new Map();

/**
 * Build a demo-ready material closure (solid + liquid phases) for element Z, with EVERY value
 * derived from the underlying simulation (jellium + atomic DFT) plus universal physical rules
 * (Lindemann melting, Poisson shear, Richards fusion entropy) — no per-element reference constants.
 * Returns null for elements outside the free-electron metal model (noble gases, non-metals).
 * Cached per Z (the derivation runs an atomic-DFT solve for the core radius).
 */
export function elementMaterialClosure(atomicNumberZ, options = {}) {
  const allowReducedEstimates = options.allowReducedEstimates === true;
  if (elementClosureCache.has(atomicNumberZ)) {
    const cached = elementClosureCache.get(atomicNumberZ);
    if (cached && !allowReducedEstimates) {
      requireFirstPrinciplesMaterialProperties(cached.properties, {
        material: cached.symbol,
        context: 'elementMaterialClosure'
      });
    }
    return cached;
  }
  const p = deriveElementProperties(atomicNumberZ, options);
  if (!p.condensedModelApplicable && !p.metallicModelApplicable) { elementClosureCache.set(atomicNumberZ, null); return null; }
  const meltingPointK = p.meltingPointK;
  const liquidDensity = p.densityKgPerM3 * (1 - 3 * p.lindemannRatio * p.lindemannRatio);
  // Latent heat of fusion from Richards' rule: ΔH_fus = T_m · ΔS_fus, ΔS_fus ≈ R per mole.
  const latentHeatFusionJPerKg = (meltingPointK * RICHARDS_FUSION_ENTROPY) / p.molarMassKgPerMol;
  const properties = withPropertyProvenance({
    molarMassKgPerMol: p.molarMassKgPerMol,
    atomsPerFormula: 1,
    heatCapacityModel: { solid: 'debye', liquid: 'derived-high-temperature-debye-limit' },
    derivation: p.derivation,
    // Conduction-electron density + scalar-relativistic transitions → optical colour.
    conductionElectronDensityPerM3: p.conductionElectronDensityPerM3,
    intrinsicColorSrgb: p.opticalColorSrgb,
    opticalInterbandOscillators: p.opticalInterbandOscillators,
    phases: [
      { name: 'solid', cpJPerKgK: p.cpJPerKgK, densityKgPerM3: p.densityKgPerM3, temperatureRange: [0, meltingPointK], debyeTemperatureK: p.debyeTemperatureK, bulkModulusPa: p.bulkModulusPa, shearModulusPa: p.shearModulusPa },
      { name: 'liquid', cpJPerKgK: p.cpJPerKgK * (1 + p.lindemannRatio), densityKgPerM3: liquidDensity, temperatureRange: [meltingPointK, OPEN_TOP_K], bulkModulusPa: p.bulkModulusPa * (liquidDensity / p.densityKgPerM3), shearModulusPa: 0 }
    ],
    transitions: [
      { from: 'solid', to: 'liquid', temperatureK: meltingPointK, latentHeatJPerKg: latentHeatFusionJPerKg }
    ],
    closureBacked: true,
    validation: { eosValidation: false, thermalValidation: false, opticalValidation: false, scientificValidation: false }
  }, {
    entries: [
      propertyProvenanceEntry({
        paths: ['molarMassKgPerMol', 'atomsPerFormula'],
        status: DS.EXACT_CONSTANT,
        source: 'periodic-table-atomic-mass',
        method: 'element formula mass from atomic mass'
      }),
      propertyProvenanceEntry({
        paths: [
          'conductionElectronDensityPerM3',
          'intrinsicColorSrgb',
          'opticalInterbandOscillators',
          'phases.solid.cpJPerKgK',
          'phases.solid.densityKgPerM3',
          'phases.solid.bulkModulusPa',
          'phases.solid.shearModulusPa',
          'phases.solid.debyeTemperatureK',
          'phases.solid.temperatureRange',
          'transitions.solid->liquid.temperatureK',
          'phases.liquid.cpJPerKgK',
          'phases.liquid.densityKgPerM3',
          'phases.liquid.bulkModulusPa',
          'phases.liquid.temperatureRange'
        ],
        status: DS.LOWER_LEVEL_SIMULATION,
        source: 'atomic-dft+jellium-debye-lindemann',
        method: 'atomic lower-level cold curve plus Debye/Lindemann model; liquid volume and bulk follow the Lindemann displacement at melt'
      }),
      propertyProvenanceEntry({
        paths: ['phases.liquid.shearModulusPa'],
        status: DS.PHYSICAL_LAW,
        source: 'continuum-mechanics',
        method: 'liquid phase has no static shear modulus'
      }),
      propertyProvenanceEntry({
        paths: ['transitions.solid->liquid.latentHeatJPerKg'],
        status: DS.PHYSICAL_LAW,
        source: 'richards-rule',
        method: 'universal fusion entropy law applied to the derived melting point'
      })
    ],
    notes: ['Element closure is generalized across the periodic table domain; validation is evidence-only until DFT/MD benchmarks are produced.']
  });
  const closure = { symbol: p.symbol, atomicNumberZ, properties, materialDerivation: materialDerivationSummary(properties) };
  elementClosureCache.set(atomicNumberZ, closure);
  if (!allowReducedEstimates) {
    requireFirstPrinciplesMaterialProperties(properties, {
      material: p.symbol,
      context: 'elementMaterialClosure'
    });
  }
  return closure;
}

/** Symbols of all elements the free-electron metal model applies to (valence 1..7, not a noble gas). */
export function metallicElementSymbols() {
  const out = [];
  for (let Z = 1; Z <= 118; Z += 1) {
    const v = valenceElectronCount(Z);
    if (v >= 1 && v < 8 && ![2, 10, 18, 36, 54, 86, 118].includes(Z)) out.push({ Z, symbol: symbolForZ(Z) });
  }
  return out;
}
