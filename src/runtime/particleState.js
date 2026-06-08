export const ULG_PARTICLE_STATE_SCHEMA = 'peercompute.ulg.particle-state.v0';

function finiteNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new TypeError(`${label} must be finite`);
  }
  return number;
}

function optionalFiniteNumber(value, label) {
  if (value == null) return null;
  return finiteNumber(value, label);
}

function inferDimensionsFromParticles(particles, fallback) {
  if (Number.isInteger(fallback) && fallback > 0) {
    return fallback;
  }
  const firstPosition = particles.find((particle) => Array.isArray(particle.position))?.position;
  if (firstPosition?.length > 0) {
    return firstPosition.length;
  }
  if (particles.some((particle) => particle.z != null)) return 3;
  if (particles.some((particle) => particle.y != null)) return 2;
  return 1;
}

function readParticles(state) {
  if (Array.isArray(state)) return state;
  if (Array.isArray(state?.bodies)) return state.bodies;
  if (Array.isArray(state?.particles)) return state.particles;
  return null;
}

function readVector(source, dimensions, label) {
  const values = Array.isArray(source) ? source : [source, 0, 0];
  const vector = [];
  for (let axis = 0; axis < dimensions; axis += 1) {
    vector.push(finiteNumber(values[axis] ?? 0, `${label}[${axis}]`));
  }
  return vector;
}

function normalizeFromParticles(state, options) {
  const particles = readParticles(state);
  const dimensions = inferDimensionsFromParticles(particles, options.dimensions);
  const ids = [];
  const positions = [];
  const velocities = [];
  const masses = [];
  const smoothingLengths = [];
  particles.forEach((particle, index) => {
    const id = particle?.id || `particle-${index}`;
    ids.push(id);
    positions.push(readVector(
      Array.isArray(particle?.position) ? particle.position : [particle?.x, particle?.y ?? 0, particle?.z ?? 0],
      dimensions,
      `${id}.position`
    ));
    velocities.push(readVector(
      Array.isArray(particle?.velocity) ? particle.velocity : [particle?.v ?? particle?.vx ?? 0, particle?.vy ?? 0, particle?.vz ?? 0],
      dimensions,
      `${id}.velocity`
    ));
    const mass = finiteNumber(particle?.mass ?? 1, `${id}.mass`);
    if (mass <= 0) {
      throw new RangeError(`${id}.mass must be positive`);
    }
    masses.push(mass);
    smoothingLengths.push(optionalFiniteNumber(
      particle?.smoothingLength ?? particle?.h ?? options.defaultSmoothingLength,
      `${id}.smoothingLength`
    ));
  });
  return {
    dimensions,
    ids,
    positions,
    velocities,
    masses,
    smoothingLengths
  };
}

function normalizeFromArrays(state, options) {
  if (!Array.isArray(state?.ids) || !Array.isArray(state?.positions)) {
    throw new TypeError('particle state requires particles, bodies, or ids/positions arrays');
  }
  const dimensions = Number.isInteger(options.dimensions) && options.dimensions > 0
    ? options.dimensions
    : (Array.isArray(state.positions[0]) ? state.positions[0].length : 1);
  const ids = state.ids.map((id, index) => id || `particle-${index}`);
  const positions = state.positions.map((position, index) => readVector(position, dimensions, `${ids[index]}.position`));
  const velocities = ids.map((id, index) => readVector(state.velocities?.[index] ?? [], dimensions, `${id}.velocity`));
  const masses = ids.map((id, index) => {
    const mass = finiteNumber(state.masses?.[index] ?? 1, `${id}.mass`);
    if (mass <= 0) {
      throw new RangeError(`${id}.mass must be positive`);
    }
    return mass;
  });
  const smoothingLengths = ids.map((id, index) => optionalFiniteNumber(
    state.smoothingLengths?.[index] ?? options.defaultSmoothingLength,
    `${id}.smoothingLength`
  ));
  return {
    dimensions,
    ids,
    positions,
    velocities,
    masses,
    smoothingLengths
  };
}

export function normalizeParticleState(state = {}, {
  dimensions = null,
  defaultSmoothingLength = null
} = {}) {
  const normalized = readParticles(state)
    ? normalizeFromParticles(state, { dimensions, defaultSmoothingLength })
    : normalizeFromArrays(state, { dimensions, defaultSmoothingLength });
  return {
    schema: ULG_PARTICLE_STATE_SCHEMA,
    dimensions: normalized.dimensions,
    count: normalized.ids.length,
    ids: normalized.ids,
    positions: normalized.positions,
    velocities: normalized.velocities,
    masses: normalized.masses,
    smoothingLengths: normalized.smoothingLengths,
    step: Number.isFinite(Number(state?.step)) ? Number(state.step) : 0,
    time: Number.isFinite(Number(state?.time)) ? Number(state.time) : 0
  };
}
