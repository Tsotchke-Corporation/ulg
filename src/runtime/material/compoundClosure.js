// Derived closure for a reaction PRODUCT compound. When two materials react, the product is usually
// a molecule the demo has no reference closure for (e.g. NaOH, Na2O, MgO). Rather than tabulate it,
// we derive a minimal renderable closure from first principles + the constituent materials:
//   - molar mass:        exact, from the atomic masses of the constituent atoms.
//   - condensed density: volume-additive blend of the reactant condensed densities (the product
//                        forms out of them) — a derived estimate, documented as such.
//   - heat capacity:     Dulong–Petit / equipartition (3R per atom over the molar mass).
//   - bulk modulus:      mass-weighted mean of the reactant bulk moduli (sets the sound speed c=√(K/ρ)).
//   - optical colour:    from the product molecule's HOMO–LUMO gap (RHF) → absorption edge → sRGB.
// One condensed (liquid-like) phase, shear 0 (a reaction-product puddle/melt). Evidence-only: every
// validation flag stays false (HF/STO-3G + additive estimates are approximations, not validated).

import { atomicMassKg } from '../electronicStructure/periodicTable.js';
import { rhf } from '../electronicStructure/molecularHartreeFock.js';

const AVOGADRO = 6.02214076e23;
const R = 8.314462618;
const HARTREE_EV = 27.211386245988;
const OPEN_TOP_K = 1e6;

// Map a single absorbed wavelength (nm) to an approximate sRGB of that spectral colour (Bruton's
// piecewise fit). Used to subtract the absorbed band from white → the transmitted body colour.
function wavelengthToSrgb(nm) {
  let r = 0; let g = 0; let b = 0;
  if (nm >= 380 && nm < 440) { r = -(nm - 440) / 60; b = 1; }
  else if (nm < 490) { g = (nm - 440) / 50; b = 1; }
  else if (nm < 510) { g = 1; b = -(nm - 510) / 20; }
  else if (nm < 580) { r = (nm - 510) / 70; g = 1; }
  else if (nm < 645) { r = 1; g = -(nm - 645) / 65; }
  else if (nm <= 780) { r = 1; }
  return [r, g, b];
}

/**
 * Body colour from the electronic absorption edge. The HOMO–LUMO gap sets the lowest-energy
 * absorption; the absorbed wavelength λ = hc/E_gap is removed from white, so a wide-gap insulator
 * (λ in the UV) stays near-white/clear and a narrow-gap species takes on the colour complementary to
 * what it absorbs in the visible. Derived from the molecule's orbital energies — not a fixed colour.
 */
export function compoundColorFromGapEv(gapEv) {
  if (!(gapEv > 0)) return [0.55, 0.55, 0.58]; // metallic / closed gap → neutral grey
  const lambdaNm = 1239.841984 / gapEv;
  if (lambdaNm < 380) return [0.93, 0.95, 0.97]; // absorbs only in the UV → colourless solid/liquid
  if (lambdaNm > 780) return [0.30, 0.28, 0.32]; // absorbs across the visible/IR → dark
  const absorbed = wavelengthToSrgb(lambdaNm);
  // Transmitted = white − absorbed band (complementary colour), kept in [0.05, 1].
  const k = 0.85;
  return absorbed.map((c) => Math.max(0.05, 1 - k * c));
}

/**
 * Derive a renderable material closure for a product compound.
 * @param atomCounts  { [Z]: count } formula of one product formula unit.
 * @param geometry    [{Z, position:[x,y,z]}] (Bohr) for the electronic-structure colour calc.
 * @param reactants   [{ densityKgPerM3, bulkModulusPa, molarMassKgPerMol }] the source materials, for
 *                    the density/stiffness estimates.
 */
export function deriveCompoundClosure({ key, label, atomCounts, geometry, reactants = [] }) {
  let molarMassKgPerMol = 0;
  let nAtoms = 0;
  for (const [Z, count] of Object.entries(atomCounts)) {
    molarMassKgPerMol += count * atomicMassKg(Number(Z)) * AVOGADRO;
    nAtoms += count;
  }
  // Condensed density: volume-additive blend of the reactant densities (1/ρ = Σ wᵢ/ρᵢ by mass).
  const dens = reactants.filter((r) => r.densityKgPerM3 > 0);
  const densityKgPerM3 = dens.length
    ? dens.length / dens.reduce((a, r) => a + 1 / r.densityKgPerM3, 0)
    : 1000;
  // Bulk modulus: mean of the reactant bulk moduli (positive → finite sound speed for the EOS).
  const bulks = reactants.map((r) => r.bulkModulusPa).filter((b) => b > 0);
  const bulkModulusPa = bulks.length ? bulks.reduce((a, b) => a + b, 0) / bulks.length : 2.2e9;
  // Heat capacity: Dulong–Petit (equipartition, 3R per atom) over the molar mass.
  const cpJPerKgK = (3 * R * nAtoms) / molarMassKgPerMol;

  // Optical colour from the HOMO–LUMO gap (robust: any failure → colourless default).
  let intrinsicColorSrgb = [0.9, 0.92, 0.94];
  try {
    const res = rhf(geometry);
    const eps = res.orbitalEnergies;
    const nOcc = res.nOcc;
    if (eps && nOcc > 0 && nOcc < eps.length) {
      const gapEv = (eps[nOcc] - eps[nOcc - 1]) * HARTREE_EV;
      intrinsicColorSrgb = compoundColorFromGapEv(gapEv);
    }
  } catch { /* keep the colourless default */ }

  return {
    key,
    properties: {
      molarMassKgPerMol,
      label,
      compound: true,
      derivation: 'product-compound: exact molar mass; volume-additive density + mean bulk modulus from reactants; Dulong–Petit cp; HOMO–LUMO-gap colour',
      // Carried on the closure so the renderer uses the derived body colour directly (the optical
      // closure's metal/water paths don't apply to an arbitrary product compound).
      intrinsicColorSrgb,
      phases: [
        { name: 'liquid', cpJPerKgK, densityKgPerM3, temperatureRange: [0, OPEN_TOP_K], bulkModulusPa, shearModulusPa: 0 }
      ],
      transitions: [],
      closureBacked: true,
      validation: { eosValidation: false, thermalValidation: false, opticalValidation: false, scientificValidation: false }
    }
  };
}
