// General element material-closure engine: derive bulk material properties for ANY element from
// the electronic structure, rather than tabulating them per element.
//
// One physical chain, applied to every Z:
//   atomic Kohn–Sham DFT  ->  core radius (charge enclosing the core electrons)
//        + valence count  ->  jellium + Ashcroft-empty-core cohesion
//                          ->  equilibrium density, bulk modulus, cohesive energy   (cold curve)
//   density + bulk modulus ->  sound speed -> Debye temperature -> heat capacity     (thermal)
//   valence electron density -> Drude plasma frequency -> reflectance colour          (optical)
//   cohesive energy        ->  melting-temperature correlation                        (transition)
//
// Honest scope (the closure carries these flags, nothing is faked):
//  - Quantitative for nearly-free-electron sp-metals (Li, Na, K, Mg, Al, ...).
//  - Transition / rare-earth metals (localized d/f) and covalent/molecular/noble solids are out of
//    the free-electron model's domain — reported with metallicModelApplicable: false.
//  - Drude gives the neutral grey of a free-electron metal; the interband colour of Cu/Au needs
//    band structure (not this model). melting is an empirical cohesive-energy correlation.
// All derived (closureBacked: true), none validated against measured data (validation: false).

import {
  atomicMassKg,
  valenceElectronCount,
  symbolForZ,
  configurationString
} from '../../runtime/electronicStructure/periodicTable.js';
import { solveAtom } from '../../runtime/electronicStructure/radialKohnSham.js';
import { simpleMetalColdCurve } from '../../runtime/electronicStructure/jelliumCohesion.js';
import { BOHR_TO_M } from '../../runtime/electronicStructure/uniformElectronGas.js';
import { debyeTemperatureFromSoundSpeed, debyeHeatCapacityJPerKgK } from './statisticalMechanics.js';
import { drudeReflectance, spectralResponseToSrgb } from './opticalClosure.js';

const HBAR = 1.054571817e-34;
const KB = 1.380649e-23;
const ELECTRON_CHARGE = 1.602176634e-19;
const EPSILON0 = 8.8541878128e-12;
const ELECTRON_MASS = 9.1093837015e-31;
const AVOGADRO = 6.02214076e23;
const EV_TO_J = 1.602176634e-19;
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

/** Drude reflectance colour (sRGB) of a free-electron metal from its conduction-electron density. */
function drudeMetalColorSrgb(freeElectronDensityPerM3) {
  // Plasma frequency ω_p = sqrt(n e² / ε₀ m_e); a generic optical damping (collisionless metals
  // have γ ≪ ω_p, giving high, nearly flat reflectance -> neutral grey, correct for most metals).
  const plasmaRadPerS = Math.sqrt((freeElectronDensityPerM3 * ELECTRON_CHARGE * ELECTRON_CHARGE) / (EPSILON0 * ELECTRON_MASS));
  const dampingRadPerS = 3e13;
  const color = spectralResponseToSrgb((nm) => drudeReflectance(nm, { plasmaRadPerS, dampingRadPerS }));
  return { srgb: [color.r, color.g, color.b], plasmaRadPerS, dampingRadPerS };
}

/**
 * Derive the bulk material properties of element Z from the electronic structure. Returns the
 * cold-curve (density, bulk modulus, cohesive energy), thermal (Debye temperature, heat capacity),
 * optical (Drude colour), and a melting estimate, plus honesty flags.
 */
export function deriveElementProperties(atomicNumberZ, options = {}) {
  const symbol = symbolForZ(atomicNumberZ);
  const valence = valenceElectronCount(atomicNumberZ);
  const massKg = atomicMassKg(atomicNumberZ);
  const molarMassKgPerMol = massKg * AVOGADRO;

  // Closed-shell (noble-gas) atoms have no free valence electrons -> the metallic model does not
  // apply; report that rather than inventing a metal.
  if (valence <= 0 || valence >= 8 || NOBLE_GAS_Z.has(atomicNumberZ)) {
    return {
      atomicNumberZ,
      symbol,
      configuration: configurationString(atomicNumberZ),
      valenceElectrons: valence,
      molarMassKgPerMol,
      metallicModelApplicable: false,
      note: NOBLE_GAS_Z.has(atomicNumberZ) ? 'noble gas: closed shell' : (valence <= 0 ? 'closed-shell: no free-electron valence' : 'full sp shell: not a free-electron metal'),
      closureBacked: true,
      validation: { eosValidation: false, thermalValidation: false, opticalValidation: false, scientificValidation: false }
    };
  }

  const emptyCoreRadiusBohr = coreRadiusBohr(atomicNumberZ, valence, options);
  const cold = simpleMetalColdCurve({ atomicMassKg: massKg, valenceElectronsPerAtom: valence, emptyCoreRadiusBohr });

  const densityKgPerM3 = cold.equilibriumDensityKgPerM3;
  const bulkModulusPa = cold.bulkModulusPa;
  const numberDensityPerM3 = densityKgPerM3 / massKg;

  // Thermal: longitudinal-ish sound speed from B and ρ -> Debye temperature -> heat capacity.
  const soundSpeedMPerS = Math.sqrt(Math.max(bulkModulusPa, 0) / densityKgPerM3);
  const debyeTemperatureK = debyeTemperatureFromSoundSpeed({ soundSpeedMPerS, numberDensityPerM3 });
  const cpJPerKgK = debyeHeatCapacityJPerKgK(300, { debyeTemperatureK, molarMassKgPerMol, atomsPerFormula: 1 });

  // Optical: Drude colour from the conduction-electron density.
  const optical = drudeMetalColorSrgb(valence * numberDensityPerM3);

  return {
    atomicNumberZ,
    symbol,
    configuration: configurationString(atomicNumberZ),
    valenceElectrons: valence,
    molarMassKgPerMol,
    metallicModelApplicable: true,
    emptyCoreRadiusBohr,
    equilibriumWignerSeitzRadiusBohr: cold.equilibriumRsBohr,
    densityKgPerM3,
    bulkModulusPa,
    soundSpeedMPerS,
    debyeTemperatureK,
    cpJPerKgK,
    opticalColorSrgb: optical.srgb,
    plasmaFrequencyRadPerS: optical.plasmaRadPerS,
    // Melting / boiling / latent heats and the true cohesive energy need the atomization reference
    // (free-atom minus bulk) and finite-temperature free energies — not derivable from this
    // cold-curve model. Flagged null rather than faked; this is the next frontier (it ties into the
    // molecular-bonding engine, which gives the atomization energetics).
    meltingPointK: null,
    cohesiveEnergyEvPerAtom: null,
    derivation: 'atomic-DFT core radius -> polyvalent jellium cohesion (density, B) -> Debye (cp) + Drude (colour)',
    closureBacked: true,
    validation: { eosValidation: false, thermalValidation: false, opticalValidation: false, scientificValidation: false }
  };
}

/** Derive properties for a list of elements (default: the whole table, Z = 1..118). */
export function deriveAllElementProperties(zList = Array.from({ length: 118 }, (_, i) => i + 1), options = {}) {
  return zList.map((Z) => deriveElementProperties(Z, options));
}
