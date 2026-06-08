import { computeInvariants, invariantDriftReport } from './invariants.js';

export const ULG_CARRIER_DELTA_SCHEMA = 'peercompute.ulg.carrier-delta.v0';

export function createDefaultCarrierState({
  separation = 1.2,
  center = 0,
  velocity = 0,
  mass = 1
} = {}) {
  return {
    schema: 'peercompute.ulg.carrier-state.v0',
    step: 0,
    time: 0,
    bodies: [
      { id: 'carrier-a', x: center - separation / 2, v: velocity, mass },
      { id: 'carrier-b', x: center + separation / 2, v: -velocity, mass }
    ]
  };
}

function cloneState(state) {
  return {
    ...state,
    bodies: state.bodies.map((body) => ({ ...body }))
  };
}

function forcePair(state, closureHandle) {
  const [left, right] = state.bodies;
  const dx = right.x - left.x;
  const r = Math.abs(dx);
  const direction = dx >= 0 ? 1 : -1;
  const sample = closureHandle.sample({ r });
  const dEdr = sample.derivatives.dEdr;
  return {
    forces: [dEdr * direction, -dEdr * direction],
    sample,
    separation: r
  };
}

function assertState(state) {
  if (!Array.isArray(state?.bodies) || state.bodies.length !== 2) {
    throw new Error('Carrier runtime expects state.bodies with exactly two bodies');
  }
  for (const body of state.bodies) {
    if (!Number.isFinite(body.x) || !Number.isFinite(body.v) || !Number.isFinite(body.mass) || body.mass <= 0) {
      throw new Error('Carrier body state must contain finite x/v and positive mass');
    }
  }
}

export function createCarrierRuntime({
  closureHandle,
  dt = 0.002,
  integrator = 'velocity-verlet',
  toleranceProfile = {}
} = {}) {
  if (!closureHandle) {
    throw new Error('createCarrierRuntime requires a closureHandle');
  }
  if (integrator !== 'velocity-verlet') {
    throw new Error(`Unsupported carrier integrator: ${integrator}`);
  }
  const timestep = Number(dt);
  if (!Number.isFinite(timestep) || timestep <= 0) {
    throw new Error('Carrier runtime dt must be a positive finite number');
  }
  return {
    backend: 'cpu-reference',
    integrator,
    dt: timestep,
    init(state = createDefaultCarrierState()) {
      assertState(state);
      return cloneState(state);
    },
    step(state) {
      assertState(state);
      const before = cloneState(state);
      const firstForces = forcePair(before, closureHandle);
      const next = cloneState(before);
      next.step = (Number.isFinite(before.step) ? before.step : 0) + 1;
      next.time = (Number.isFinite(before.time) ? before.time : 0) + timestep;
      for (let index = 0; index < next.bodies.length; index += 1) {
        const body = next.bodies[index];
        const halfVelocity = body.v + 0.5 * (firstForces.forces[index] / body.mass) * timestep;
        body.x += halfVelocity * timestep;
        body.v = halfVelocity;
      }
      const secondForces = forcePair(next, closureHandle);
      for (let index = 0; index < next.bodies.length; index += 1) {
        const body = next.bodies[index];
        body.v += 0.5 * (secondForces.forces[index] / body.mass) * timestep;
      }
      const invariants = computeInvariants(next, closureHandle);
      return {
        state: next,
        invariants,
        delta: {
          schema: ULG_CARRIER_DELTA_SCHEMA,
          step: next.step,
          time: next.time,
          dt: timestep,
          integrator,
          closureId: closureHandle.closureId,
          separation: secondForces.separation,
          sampledPotentialEnergy: secondForces.sample.value,
          sampledDerivative: secondForces.sample.derivatives.dEdr,
          bodies: next.bodies.map((body, index) => ({
            id: body.id,
            x: body.x,
            v: body.v,
            dx: body.x - before.bodies[index].x,
            dv: body.v - before.bodies[index].v
          }))
        }
      };
    },
    run(initialState = createDefaultCarrierState(), steps = 1) {
      const stepCount = Number(steps);
      if (!Number.isInteger(stepCount) || stepCount < 1) {
        throw new Error('Carrier runtime steps must be a positive integer');
      }
      let state = this.init(initialState);
      const deltas = [];
      const invariantSeries = [computeInvariants(state, closureHandle)];
      for (let index = 0; index < stepCount; index += 1) {
        const result = this.step(state);
        state = result.state;
        deltas.push(result.delta);
        invariantSeries.push(result.invariants);
      }
      return {
        backend: this.backend,
        integrator,
        dt: timestep,
        steps: stepCount,
        finalState: state,
        deltas,
        invariantSeries,
        invariants: invariantDriftReport(invariantSeries, toleranceProfile)
      };
    }
  };
}
