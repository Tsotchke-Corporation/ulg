// Fit an interatomic potential to ab-initio energies — the bridge from MoonLab/DFT to the MD
// engine. This is the one per-material input to the general property engine: given a computed
// energy-vs-separation curve (e.g. MoonLab's H2 dissociation curve), fit a Morse potential and
// hand it to the engine through the standard pair-potential interface. No engine change; any
// material's properties then come from running MD on its fitted potential.

import { H2_DISSOCIATION_CURVE } from '../material/microphysicsData.js';

const HARTREE_TO_J = 4.3597447222071e-18;
const ANGSTROM_TO_M = 1e-10;

/**
 * Morse potential V(r) = D_e[(1 − e^{−a(r−r_e)})^2 − 1], with V(r_e) = −D_e and V(∞) = 0.
 * Conforms to the pair-potential interface (energy in J, force = −dV/dr in N, cutoff in m).
 */
export function morsePotential({ dissociationEnergyJ, equilibriumM, widthPerM, cutoffM }) {
  const rc = cutoffM ?? equilibriumM * 6;
  const vAt = (r) => {
    const e = Math.exp(-widthPerM * (r - equilibriumM));
    return dissociationEnergyJ * ((1 - e) ** 2 - 1);
  };
  const vShift = vAt(rc);
  return {
    name: 'morse',
    cutoffM: rc,
    params: { dissociationEnergyJ, equilibriumM, widthPerM },
    energyJ(r) {
      if (r >= rc) return 0;
      return vAt(r) - vShift;
    },
    // f(r) = −dV/dr = −2 D_e a e^{−a(r−r_e)} (1 − e^{−a(r−r_e)})
    forceScalarN(r) {
      if (r >= rc) return 0;
      const e = Math.exp(-widthPerM * (r - equilibriumM));
      return -2 * dissociationEnergyJ * widthPerM * e * (1 - e);
    }
  };
}

/**
 * Fit a Morse potential to (r, E) samples. r_e is the curve minimum, D_e the well depth relative
 * to the dissociation asymptote, and the width a is found by least-squares over the bound region.
 */
export function fitMorsePotential({ samples, dissociationEnergy = null, fitMaxR = Infinity }) {
  const pts = [...samples].sort((a, b) => a.r - b.r);
  let minIdx = 0;
  for (let i = 1; i < pts.length; i += 1) if (pts[i].E < pts[minIdx].E) minIdx = i;
  const equilibrium = pts[minIdx].r;
  const eMin = pts[minIdx].E;
  const eInf = dissociationEnergy != null ? dissociationEnergy : pts[pts.length - 1].E;
  const De = eInf - eMin; // well depth (positive)
  // Shift the data so the asymptote is 0; fit only the bound region (avoid large-r model artifacts).
  const fitPts = pts.filter((p) => p.r <= fitMaxR).map((p) => ({ r: p.r, v: p.E - eInf }));
  let bestA = 1;
  let bestErr = Infinity;
  for (let a = 0.5; a <= 8; a += 0.01) {
    let err = 0;
    for (const p of fitPts) {
      const e = Math.exp(-a * (p.r - equilibrium));
      const vMorse = De * ((1 - e) ** 2 - 1);
      err += (vMorse - p.v) ** 2;
    }
    if (err < bestErr) { bestErr = err; bestA = a; }
  }
  return { equilibrium, dissociationEnergy: De, width: bestA, rmsErr: Math.sqrt(bestErr / fitPts.length), asymptote: eInf };
}

/**
 * Fit a Morse potential to MoonLab's H2 dissociation curve and return it ready for the MD engine
 * (SI units). Uses the theoretical two-atom dissociation limit (−1.0 Ha) as the asymptote and
 * fits over the bound region. Demonstrates the ab-initio → potential → MD pipeline end to end.
 */
export function fitMoonlabH2Potential() {
  const samples = H2_DISSOCIATION_CURVE.map((p) => ({ r: p.bondAngstrom, E: p.totalEnergyHa }));
  const fit = fitMorsePotential({ samples, dissociationEnergy: -1.0, fitMaxR: 1.6 });
  return {
    fitAngstromHartree: fit,
    potential: morsePotential({
      dissociationEnergyJ: fit.dissociationEnergy * HARTREE_TO_J,
      equilibriumM: fit.equilibrium * ANGSTROM_TO_M,
      widthPerM: fit.width / ANGSTROM_TO_M,
      cutoffM: 3.0 * ANGSTROM_TO_M
    })
  };
}
