// Deterministic initialization for the MD engine: a cubic lattice of particles in a periodic box
// and Maxwell–Boltzmann velocities at a target temperature (centre-of-mass removed, exact T).

import { BOLTZMANN_J_PER_K } from './mdEngine.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rng) {
  // Box–Muller
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Simple-cubic lattice of nPerSide^3 particles with the given spacing; box length = nPerSide*spacing.
 */
export function cubicLattice({ nPerSide, spacingM }) {
  const positions = [];
  for (let i = 0; i < nPerSide; i += 1) {
    for (let j = 0; j < nPerSide; j += 1) {
      for (let k = 0; k < nPerSide; k += 1) {
        positions.push([(i + 0.5) * spacingM, (j + 0.5) * spacingM, (k + 0.5) * spacingM]);
      }
    }
  }
  return { positions, boxLengthM: nPerSide * spacingM };
}

/**
 * Maxwell–Boltzmann velocities at temperatureK for particles of mass massKg, with the
 * centre-of-mass velocity removed and the kinetic energy rescaled to give exactly the target T.
 */
export function maxwellBoltzmannVelocities({ n, massKg, temperatureK, seed = 1 }) {
  const rng = mulberry32(seed);
  const sigma = Math.sqrt((BOLTZMANN_J_PER_K * temperatureK) / massKg);
  const v = [];
  const com = [0, 0, 0];
  for (let i = 0; i < n; i += 1) {
    const vi = [gaussian(rng) * sigma, gaussian(rng) * sigma, gaussian(rng) * sigma];
    v.push(vi);
    com[0] += vi[0]; com[1] += vi[1]; com[2] += vi[2];
  }
  for (let i = 0; i < n; i += 1) for (let d = 0; d < 3; d += 1) v[i][d] -= com[d] / n;
  // Rescale to exactly the target temperature (3N - 3 DOF after COM removal ≈ 3N for large N).
  let ke = 0;
  for (let i = 0; i < n; i += 1) ke += 0.5 * massKg * (v[i][0] ** 2 + v[i][1] ** 2 + v[i][2] ** 2);
  const currentT = (2 * ke) / (3 * n * BOLTZMANN_J_PER_K);
  const lambda = Math.sqrt(temperatureK / currentT);
  for (let i = 0; i < n; i += 1) for (let d = 0; d < 3; d += 1) v[i][d] *= lambda;
  return v;
}
