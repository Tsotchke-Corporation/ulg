import { createToleranceReport } from '../../ulg-gpu-abi/src/index.js';

export const ULG_CARRIER_INVARIANTS_SCHEMA = 'peercompute.ulg.carrier-invariants.v0';
export const ULG_CARRIER_INVARIANT_DRIFT_SCHEMA = 'peercompute.ulg.carrier-invariant-drift.v0';

function normalizeBodies(state = {}) {
  if (Array.isArray(state.bodies)) {
    return state.bodies.map((body, index) => ({
      id: body.id || `body-${index}`,
      x: Number(body.x),
      v: Number(body.v),
      mass: Number(body.mass ?? 1)
    }));
  }
  const positions = state.positions || [];
  const velocities = state.velocities || [];
  const masses = state.masses || [];
  return positions.map((x, index) => ({
    id: `body-${index}`,
    x: Number(x),
    v: Number(velocities[index] ?? 0),
    mass: Number(masses[index] ?? 1)
  }));
}

function assertTwoBodyState(bodies) {
  if (bodies.length !== 2) {
    throw new Error('Phase 1 carrier runtime expects exactly two bodies');
  }
  for (const body of bodies) {
    if (!Number.isFinite(body.x) || !Number.isFinite(body.v) || !Number.isFinite(body.mass) || body.mass <= 0) {
      throw new Error('Carrier body state must contain finite x/v and positive mass');
    }
  }
}

export function computeInvariants(state, closureHandle) {
  const bodies = normalizeBodies(state);
  assertTwoBodyState(bodies);
  const dx = bodies[1].x - bodies[0].x;
  const r = Math.abs(dx);
  const sample = closureHandle.sample({ r });
  const kineticEnergy = bodies.reduce((total, body) => total + 0.5 * body.mass * body.v * body.v, 0);
  const momentum = bodies.reduce((total, body) => total + body.mass * body.v, 0);
  return {
    schema: ULG_CARRIER_INVARIANTS_SCHEMA,
    step: Number.isFinite(state.step) ? state.step : 0,
    time: Number.isFinite(state.time) ? state.time : 0,
    separation: r,
    potentialEnergy: sample.value,
    kineticEnergy,
    totalEnergy: kineticEnergy + sample.value,
    momentum
  };
}

export function invariantDriftReport(series, toleranceProfile = {}) {
  if (!Array.isArray(series) || series.length === 0) {
    throw new Error('Invariant drift report requires a non-empty invariant series');
  }
  const profile = {
    name: toleranceProfile.name || 'toy-carrier-reference',
    energyAbs: Number(toleranceProfile.energyAbs ?? 1e-3),
    momentumAbs: Number(toleranceProfile.momentumAbs ?? 1e-9)
  };
  const first = series[0];
  const energyDeltas = series.map((entry) => Math.abs(entry.totalEnergy - first.totalEnergy));
  const momentumDeltas = series.map((entry) => Math.abs(entry.momentum - first.momentum));
  const maxEnergyDriftAbs = Math.max(...energyDeltas);
  const maxMomentumDriftAbs = Math.max(...momentumDeltas);
  const status = maxEnergyDriftAbs <= profile.energyAbs && maxMomentumDriftAbs <= profile.momentumAbs
    ? 'pass'
    : 'warn';
  return {
    schema: ULG_CARRIER_INVARIANT_DRIFT_SCHEMA,
    ...createToleranceReport({
      status,
      toleranceProfile: profile.name,
      metrics: {
        initialEnergy: first.totalEnergy,
        finalEnergy: series[series.length - 1].totalEnergy,
        maxEnergyDriftAbs,
        energyToleranceAbs: profile.energyAbs,
        initialMomentum: first.momentum,
        finalMomentum: series[series.length - 1].momentum,
        maxMomentumDriftAbs,
        momentumToleranceAbs: profile.momentumAbs,
        sampleCount: series.length
      },
      provenance: {
        sourceService: 'ulg-runtime',
        methodHash: 'toy-carrier-invariant-drift',
        inputHash: 'runtime-series',
        codeVersion: 'ulg-demo',
        deterministicSeed: 'toy-carrier-reference',
        createdAt: new Date().toISOString(),
        notes: ['cpu-reference-carrier-runtime']
      }
    })
  };
}
