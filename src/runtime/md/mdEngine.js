// General molecular-dynamics engine (NVE / NVT) in a periodic cubic box.
//
// Material-agnostic: it takes a pair potential and integrates the particles. The same engine,
// with no per-material code, is what the property estimators sample to derive density, heat
// capacity, thermal expansion, bulk modulus, melting, and latent heat. Velocity-Verlet with
// minimum-image periodic boundaries; a velocity-rescaling thermostat for NVT; energy and the
// virial (for pressure) are accumulated every force evaluation.

export const BOLTZMANN_J_PER_K = 1.380649e-23;

function minimumImage(d, boxLengthM) {
  return d - boxLengthM * Math.round(d / boxLengthM);
}

export function createMdSystem({ positions, velocities, massKg, boxLengthM, potential }) {
  const n = positions.length;
  const masses = Array.isArray(massKg) ? massKg : positions.map(() => massKg);
  return {
    n,
    boxLengthM,
    potential,
    masses,
    x: positions.map((p) => [...p]),
    // Unwrapped coordinates (no periodic wrapping) for mean-squared-displacement / diffusion.
    xUnwrapped: positions.map((p) => [...p]),
    v: velocities ? velocities.map((p) => [...p]) : positions.map(() => [0, 0, 0]),
    potentialEnergyJ: 0,
    virialJ: 0
  };
}

// Compute forces, potential energy, and the virial Σ r·F (for the pressure). Returns the force
// array; stores energy + virial on the system.
function computeForces(sys) {
  const { n, x, boxLengthM, potential } = sys;
  const forces = x.map(() => [0, 0, 0]);
  let energy = 0;
  let virial = 0;
  const rc = potential.cutoffM;
  const rc2 = rc * rc;
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      let dx = minimumImage(x[i][0] - x[j][0], boxLengthM);
      let dy = minimumImage(x[i][1] - x[j][1], boxLengthM);
      let dz = minimumImage(x[i][2] - x[j][2], boxLengthM);
      const r2 = dx * dx + dy * dy + dz * dz;
      if (r2 >= rc2 || r2 === 0) continue;
      const r = Math.sqrt(r2);
      const fScalar = potential.forceScalarN(r); // = -dU/dr, >0 repulsive
      energy += potential.energyJ(r);
      virial += fScalar * r;
      const fx = (fScalar / r) * dx;
      const fy = (fScalar / r) * dy;
      const fz = (fScalar / r) * dz;
      forces[i][0] += fx; forces[i][1] += fy; forces[i][2] += fz;
      forces[j][0] -= fx; forces[j][1] -= fy; forces[j][2] -= fz;
    }
  }
  sys.potentialEnergyJ = energy;
  sys.virialJ = virial;
  return forces;
}

export function kineticEnergyJ(sys) {
  let ke = 0;
  for (let i = 0; i < sys.n; i += 1) {
    const m = sys.masses[i];
    ke += 0.5 * m * (sys.v[i][0] ** 2 + sys.v[i][1] ** 2 + sys.v[i][2] ** 2);
  }
  return ke;
}

// Instantaneous temperature from equipartition: (3/2) N kB T = KE (3N DOF).
export function instantaneousTemperatureK(sys) {
  return (2 * kineticEnergyJ(sys)) / (3 * sys.n * BOLTZMANN_J_PER_K);
}

// Instantaneous virial pressure: P = (N kB T + W/3) / V.
export function instantaneousPressurePa(sys) {
  const volume = sys.boxLengthM ** 3;
  const nkt = sys.n * BOLTZMANN_J_PER_K * instantaneousTemperatureK(sys);
  return (nkt + sys.virialJ / 3) / volume;
}

function rescaleToTemperature(sys, targetTempK) {
  const current = instantaneousTemperatureK(sys);
  if (current <= 0) return;
  const lambda = Math.sqrt(targetTempK / current);
  for (let i = 0; i < sys.n; i += 1) {
    sys.v[i][0] *= lambda; sys.v[i][1] *= lambda; sys.v[i][2] *= lambda;
  }
}

/**
 * Run the engine for `steps` velocity-Verlet steps of `dt`. With `thermostatTempK` it rescales
 * velocities to that temperature (NVT); without it the run is NVE. After `equilibrationSteps`,
 * per-step samples of temperature/pressure/total energy are accumulated for the estimators.
 */
export function runMd(sys, { steps, dtS, thermostatTempK = null, equilibrationSteps = 0 } = {}) {
  let forces = computeForces(sys);
  const samples = { temperatureK: [], pressurePa: [], totalEnergyJ: [], potentialEnergyJ: [], meanSquaredDisplacementM2: [] };
  let msdReference = null;
  let sampleTimeS = 0;
  for (let s = 0; s < steps; s += 1) {
    for (let i = 0; i < sys.n; i += 1) {
      const m = sys.masses[i];
      for (let d = 0; d < 3; d += 1) {
        sys.v[i][d] += 0.5 * (forces[i][d] / m) * dtS;
        const step = sys.v[i][d] * dtS;
        sys.xUnwrapped[i][d] += step;
        sys.x[i][d] += step;
        // wrap the periodic image; the unwrapped copy keeps the true trajectory for diffusion
        sys.x[i][d] -= sys.boxLengthM * Math.floor(sys.x[i][d] / sys.boxLengthM);
      }
    }
    forces = computeForces(sys);
    for (let i = 0; i < sys.n; i += 1) {
      const m = sys.masses[i];
      for (let d = 0; d < 3; d += 1) sys.v[i][d] += 0.5 * (forces[i][d] / m) * dtS;
    }
    if (thermostatTempK != null) rescaleToTemperature(sys, thermostatTempK);
    if (s >= equilibrationSteps) {
      if (!msdReference) msdReference = sys.xUnwrapped.map((p) => [...p]);
      else sampleTimeS += dtS;
      let msd = 0;
      for (let i = 0; i < sys.n; i += 1) {
        msd += (sys.xUnwrapped[i][0] - msdReference[i][0]) ** 2
          + (sys.xUnwrapped[i][1] - msdReference[i][1]) ** 2
          + (sys.xUnwrapped[i][2] - msdReference[i][2]) ** 2;
      }
      samples.temperatureK.push(instantaneousTemperatureK(sys));
      samples.pressurePa.push(instantaneousPressurePa(sys));
      samples.potentialEnergyJ.push(sys.potentialEnergyJ);
      samples.totalEnergyJ.push(sys.potentialEnergyJ + kineticEnergyJ(sys));
      samples.meanSquaredDisplacementM2.push(msd / sys.n);
    }
  }
  samples.sampleTimeS = sampleTimeS;
  return samples;
}
