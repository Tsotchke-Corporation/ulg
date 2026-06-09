// SPH particle state (demo plan P4).
//
// A minimal carrier state: a set of particles with position/velocity vectors, mass, and specific
// internal energy, plus the smoothing length and dimension. Mass is conserved exactly (it is set
// once per particle and never changes), so resolution sets accuracy, not the material law.

export const ULG_SPH_STATE_SCHEMA = 'peercompute.ulg.sph-state.v0';

function assertVector(value, dimension, label) {
  if (!Array.isArray(value) || value.length !== dimension || value.some((v) => !Number.isFinite(v))) {
    throw new Error(`${label} must be a length-${dimension} finite vector`);
  }
  return [...value];
}

export function createSphState({ particles = [], smoothingLengthM, dimension = 3, time = 0, step = 0 } = {}) {
  if (!Number.isFinite(smoothingLengthM) || smoothingLengthM <= 0) {
    throw new Error('createSphState requires a positive smoothingLengthM');
  }
  return {
    schema: ULG_SPH_STATE_SCHEMA,
    dimension,
    smoothingLengthM,
    time,
    step,
    particles: particles.map((p, index) => ({
      id: p.id ?? `p${index}`,
      material: p.material ?? 'unknown',
      x: assertVector(p.x, dimension, `particles[${index}].x`),
      v: assertVector(p.v ?? new Array(dimension).fill(0), dimension, `particles[${index}].v`),
      massKg: Number(p.massKg),
      specificInternalEnergyJPerKg: Number(p.specificInternalEnergyJPerKg ?? 0)
    }))
  };
}

export function cloneSphState(state) {
  return {
    ...state,
    particles: state.particles.map((p) => ({ ...p, x: [...p.x], v: [...p.v] }))
  };
}

export function totalMassKg(state) {
  return state.particles.reduce((sum, p) => sum + p.massKg, 0);
}
