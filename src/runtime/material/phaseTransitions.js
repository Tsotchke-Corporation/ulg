// Phase-transition thermodynamics: latent heats derived from transition temperatures via the
// standard entropy-of-transition laws.
//
// These are *phenomenological physical laws* (real thermodynamics with near-universal empirical
// entropy constants), one rung below the ab-initio Debye/Drude derivations:
//  - Richards' rule: entropy of fusion ΔS_fus ≈ R for simple (metallic) solids -> L_fus = T_m ΔS_fus / M.
//  - Trouton's rule: entropy of vaporization ΔS_vap ≈ 88 J/(mol K) -> L_vap = T_b ΔS_vap / M.
//
// They DERIVE the latent heat from the transition temperature + a transition entropy. The
// universal entropy constants are accurate (~10%) for simple substances but break for
// associated/hydrogen-bonded liquids (water): water's ΔS_vap is ~109, not 88, because the
// hydrogen-bond network raises the cohesive energy. Where the universal rule is known to fail,
// the caller should supply the material entropy (ultimately from cohesive-energy microphysics)
// rather than pretend the universal constant is first-principles.

const R = 8.314462618;

// Richards' rule: entropy of fusion ~ R for close-packed metals.
export const RICHARDS_ENTROPY_OF_FUSION_J_PER_MOL_K = R;
// Trouton's rule: entropy of vaporization ~ 88 J/(mol K) for non-associated liquids.
export const TROUTON_ENTROPY_OF_VAPORIZATION_J_PER_MOL_K = 88;

/**
 * Latent heat of fusion (J/kg) = T_m · ΔS_fus / M. ΔS_fus defaults to Richards' rule (R).
 */
export function latentHeatOfFusionJPerKg({ meltingPointK, molarMassKgPerMol, entropyOfFusionJPerMolK = RICHARDS_ENTROPY_OF_FUSION_J_PER_MOL_K }) {
  return (meltingPointK * entropyOfFusionJPerMolK) / molarMassKgPerMol;
}

/**
 * Latent heat of vaporization (J/kg) = T_b · ΔS_vap / M. ΔS_vap defaults to Trouton's rule (88).
 */
export function latentHeatOfVaporizationJPerKg({ boilingPointK, molarMassKgPerMol, entropyOfVaporizationJPerMolK = TROUTON_ENTROPY_OF_VAPORIZATION_J_PER_MOL_K }) {
  return (boilingPointK * entropyOfVaporizationJPerMolK) / molarMassKgPerMol;
}

/**
 * Clausius–Clapeyron boiling point (K) at a target pressure, given a reference boiling point and
 * the latent heat: ln(P/P_ref) = −(L M / R)(1/T − 1/T_ref). Derives the *pressure dependence* of
 * boiling from the latent heat (the reference point itself is an input).
 */
export function clausiusClapeyronBoilingPointK({
  referenceBoilingPointK,
  referencePressurePa,
  targetPressurePa,
  latentHeatJPerKg,
  molarMassKgPerMol
}) {
  const Lmolar = latentHeatJPerKg * molarMassKgPerMol;
  const invT = 1 / referenceBoilingPointK - (R / Lmolar) * Math.log(targetPressurePa / referencePressurePa);
  return 1 / invT;
}
