// General interatomic pair-potential interface for the molecular-dynamics engine.
//
// The potential is the ONLY material-specific input to the general property engine: everything
// else (density, heat capacity, thermal expansion, bulk modulus, melting, latent heat) is
// measured uniformly from MD. A potential exposes energy U(r) and the scalar pair force
// f(r) = -dU/dr, plus a cutoff. Lennard-Jones is the canonical analytic form; a tabulated pair
// potential lets an ab-initio/closure-derived potential (e.g. fit to MoonLab energies) plug in
// through the same interface with no engine changes.

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
