// General interatomic pair-potential interface for the molecular-dynamics engine.
//
// The potential is the ONLY material-specific input to the general property engine: everything
// else (density, heat capacity, thermal expansion, bulk modulus, melting, latent heat) is
// measured uniformly from MD. A potential exposes energy U(r) and the scalar pair force
// f(r) = -dU/dr, plus a cutoff. Lennard-Jones is the canonical analytic form; a tabulated pair
// potential lets an ab-initio/closure-derived potential (e.g. fit to MoonLab energies) plug in
// through the same interface with no engine changes.

const BOLTZMANN_J_PER_K = 1.380649e-23;
const AVOGADRO_PER_MOL = 6.02214076e23;
const GAS_CONSTANT_J_PER_MOL_K = BOLTZMANN_J_PER_K * AVOGADRO_PER_MOL;

/**
 * Neufeld, Janzen & Aziz (1972) reduced collision integral Omega^(2,2)*(T*)
 * for a Lennard-Jones (12-6) pair potential (valid 0.3 <= T* <= 100, < 0.1% err).
 */
export function neufeldOmega22(reducedTemperature) {
  const tStar = Math.max(0.3, Math.min(1000, Number(reducedTemperature)));
  return (
    1.16145 * (tStar ** -0.14874)
    + 0.52487 * Math.exp(-0.77320 * tStar)
    + 2.16178 * Math.exp(-2.43787 * tStar)
  );
}

/**
 * First-principles dilute-gas dynamic viscosity (Chapman-Enskog) and thermal
 * conductivity (Modified Eucken) derived from Lennard-Jones pair potential
 * parameters (sigmaM, epsilonJ) and molar mass.
 */
export function deriveDiluteGasTransportFromPairPotential({
  molarMassKgPerMol,
  sigmaM,
  epsilonJ,
  temperatureK = 298.15,
  cvMolarJPerMolK = 1.5 * GAS_CONSTANT_J_PER_MOL_K
} = {}) {
  const M = Number(molarMassKgPerMol);
  const sigma = Number(sigmaM);
  const eps = Number(epsilonJ);
  const T = Number(temperatureK);
  const Cv = Number(cvMolarJPerMolK);
  if (!(M > 0) || !(sigma > 0) || !(eps > 0) || !(T > 0)) {
    return null;
  }
  const m = M / AVOGADRO_PER_MOL;
  const tStar = (BOLTZMANN_J_PER_K * T) / eps;
  const omega22 = neufeldOmega22(tStar);
  // Chapman-Enskog first-order viscosity: mu = (5/16) sqrt(pi m k_B T) / (pi sigma^2 Omega22)
  const dynamicViscosityPaS =
    (5 / 16) * Math.sqrt(Math.PI * m * BOLTZMANN_J_PER_K * T) / (Math.PI * sigma * sigma * omega22);
  // Modified Eucken relation (reduces to exact monatomic 15/4 R mu / M when Cv = 3/2 R)
  const effectiveCv = Number.isFinite(Cv) && Cv > 0 ? Cv : 1.5 * GAS_CONSTANT_J_PER_MOL_K;
  const thermalConductivityWPerMK =
    (dynamicViscosityPaS / M) * (1.32 * effectiveCv + 1.77 * GAS_CONSTANT_J_PER_MOL_K);
  return Object.freeze({
    dynamicViscosityPaS,
    thermalConductivityWPerMK,
    reducedTemperature: tStar,
    omega22,
    temperatureK: T,
    method: 'chapman-enskog-modified-eucken-lj'
  });
}

/**
 * Lennard-Jones potential U(r) = 4ε[(σ/r)^12 − (σ/r)^6], cut and shifted at rCut.
 * Returns { energyJ, forceScalarN, cutoffM } where forceScalar = -dU/dr (positive = repulsive).
 */
export function lennardJones({ epsilonJ, sigmaM, cutoffM = 2.5 * sigmaM } = {}) {
  const uAt = (r) => {
    const sr6 = (sigmaM / r) ** 6;
    return 4 * epsilonJ * (sr6 * sr6 - sr6);
  };
  const uShift = uAt(cutoffM);
  return {
    cutoffM,
    name: 'lennard-jones',
    energyJ(r) {
      if (r >= cutoffM) return 0;
      return uAt(r) - uShift;
    },
    // f(r) = -dU/dr = 24ε/r [2(σ/r)^12 − (σ/r)^6]
    forceScalarN(r) {
      if (r >= cutoffM) return 0;
      const sr6 = (sigmaM / r) ** 6;
      return (24 * epsilonJ / r) * (2 * sr6 * sr6 - sr6);
    }
  };
}

/**
 * Tabulated pair potential from sampled (r, U) points (e.g. an ab-initio/closure-derived curve).
 * Linear interpolation of U; force from the analytic derivative of the interpolant. This is how a
 * MoonLab/DFT cohesive curve becomes an MD potential without touching the engine.
 */
export function tabulatedPairPotential({ samples, cutoffM } = {}) {
  const pts = [...samples].sort((a, b) => a.r - b.r);
  const rMax = cutoffM ?? pts[pts.length - 1].r;
  const uShift = 0;
  function bracket(r) {
    for (let i = 1; i < pts.length; i += 1) {
      if (r <= pts[i].r) return [pts[i - 1], pts[i]];
    }
    return [pts[pts.length - 2], pts[pts.length - 1]];
  }
  return {
    cutoffM: rMax,
    name: 'tabulated',
    energyJ(r) {
      if (r >= rMax || r <= pts[0].r) return r <= pts[0].r ? pts[0].U : 0;
      const [a, b] = bracket(r);
      const t = (r - a.r) / (b.r - a.r);
      return a.U + t * (b.U - a.U) - uShift;
    },
    forceScalarN(r) {
      if (r >= rMax || r <= pts[0].r) return 0;
      const [a, b] = bracket(r);
      return -(b.U - a.U) / (b.r - a.r); // -dU/dr (constant within the segment)
    }
  };
}
