// Conservative SPH operators (demo plan P4).
//
// A textbook compressible-SPH kernel and field operators: cubic-spline kernel, density by
// summation, ideal-gas pressure, and the *symmetric* momentum + thermal-energy operators with
// Monaghan artificial viscosity. The symmetric pressure form makes total momentum exactly
// conserved (pairwise equal/opposite forces) and total energy conserved in the inviscid smooth
// limit; artificial viscosity converts kinetic energy to heat without losing total energy.
//
// CPU reference, dimension-generic (D = 2 or 3). Evidence-only: nothing here claims validated
// physics. Material EOS coupling beyond ideal gas (Tait/condensed) is a later slice.

const NORMALIZATION = { 1: 2 / 3, 2: 10 / (7 * Math.PI), 3: 1 / Math.PI };

function vsub(a, b) {
  return a.map((value, i) => value - b[i]);
}

function vdot(a, b) {
  return a.reduce((sum, value, i) => sum + value * b[i], 0);
}

function vlen(a) {
  return Math.sqrt(vdot(a, a));
}

/**
 * Cubic-spline kernel value W(r, h) for dimension D.
 */
export function cubicSplineKernel(r, h, dimension) {
  const sigma = NORMALIZATION[dimension] / h ** dimension;
  const q = r / h;
  if (q < 1) return sigma * (1 - 1.5 * q * q + 0.75 * q * q * q);
  if (q < 2) return sigma * 0.25 * (2 - q) ** 3;
  return 0;
}

/**
 * Radial derivative dW/dr of the cubic-spline kernel for dimension D.
 */
export function cubicSplineKernelGradientMagnitude(r, h, dimension) {
  const sigma = NORMALIZATION[dimension] / h ** dimension;
  const q = r / h;
  if (q < 1) return (sigma / h) * (-3 * q + 2.25 * q * q);
  if (q < 2) return (sigma / h) * (-0.75 * (2 - q) ** 2);
  return 0;
}

/**
 * Kernel gradient vector grad_i W(r_ij, h) = (dW/dr) * (x_i - x_j)/r.
 */
export function kernelGradient(xi, xj, h, dimension) {
  const dx = vsub(xi, xj);
  const r = vlen(dx);
  if (r <= 0) return dx.map(() => 0);
  const dWdr = cubicSplineKernelGradientMagnitude(r, h, dimension);
  return dx.map((value) => (dWdr * value) / r);
}

/**
 * Density by summation: rho_i = sum_j m_j W(r_ij, h) (includes self).
 */
export function computeDensities(particles, h, dimension) {
  return particles.map((pi) => {
    let rho = 0;
    for (const pj of particles) {
      const r = vlen(vsub(pi.x, pj.x));
      if (r < 2 * h) rho += pj.massKg * cubicSplineKernel(r, h, dimension);
    }
    return rho;
  });
}

/**
 * Ideal-gas pressure p = (gamma - 1) * rho * u, with sound speed c = sqrt(gamma * p / rho).
 */
export function idealGasPressure(rho, specificInternalEnergyJPerKg, gamma) {
  const p = (gamma - 1) * rho * Math.max(0, specificInternalEnergyJPerKg);
  const c = Math.sqrt(Math.max(0, (gamma * p) / Math.max(rho, 1e-30)));
  return { pressurePa: p, soundSpeedMPerS: c };
}

function artificialViscosity({ vij, xij, r2, rhoBar, cBar, h, alpha, beta, epsilon }) {
  const vr = vdot(vij, xij);
  if (vr >= 0) return 0; // only for approaching pairs
  const mu = (h * vr) / (r2 + epsilon * h * h);
  return (-alpha * cBar * mu + beta * mu * mu) / rhoBar;
}

/**
 * Symmetric momentum accelerations and thermal-energy rates for all particles.
 * Returns { accelerations: [vec], energyRates: [J/kg/s], pressures, soundSpeeds, densities }.
 */
export function computeAccelerationsAndEnergyRates(particles, options = {}) {
  const {
    h,
    dimension,
    gamma = 1.4,
    gravity = null,
    alpha = 0,
    beta = 0,
    epsilon = 0.01
  } = options;
  const densities = computeDensities(particles, h, dimension);
  const pressures = [];
  const soundSpeeds = [];
  for (let i = 0; i < particles.length; i += 1) {
    const { pressurePa, soundSpeedMPerS } = idealGasPressure(densities[i], particles[i].specificInternalEnergyJPerKg, gamma);
    pressures.push(pressurePa);
    soundSpeeds.push(soundSpeedMPerS);
  }
  const accelerations = particles.map((p) => p.x.map(() => 0));
  const energyRates = particles.map(() => 0);
  for (let i = 0; i < particles.length; i += 1) {
    const pi = particles[i];
    const termI = pressures[i] / (densities[i] * densities[i]);
    for (let j = 0; j < particles.length; j += 1) {
      if (j === i) continue;
      const pj = particles[j];
      const xij = vsub(pi.x, pj.x);
      const r = vlen(xij);
      if (r >= 2 * h || r <= 0) continue;
      const gradW = kernelGradient(pi.x, pj.x, h, dimension);
      const termJ = pressures[j] / (densities[j] * densities[j]);
      const vij = vsub(pi.v, pj.v);
      const visc = artificialViscosity({
        vij,
        xij,
        r2: r * r,
        rhoBar: 0.5 * (densities[i] + densities[j]),
        cBar: 0.5 * (soundSpeeds[i] + soundSpeeds[j]),
        h,
        alpha,
        beta,
        epsilon
      });
      const coeff = termI + termJ + visc;
      for (let d = 0; d < pi.x.length; d += 1) {
        accelerations[i][d] -= pj.massKg * coeff * gradW[d];
      }
      energyRates[i] += 0.5 * pj.massKg * coeff * vdot(vij, gradW);
    }
    if (Array.isArray(gravity)) {
      for (let d = 0; d < pi.x.length; d += 1) accelerations[i][d] += gravity[d];
    }
  }
  return { accelerations, energyRates, pressures, soundSpeeds, densities };
}
