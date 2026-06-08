import { computeInvariants, invariantDriftReport } from './invariants.js';
import { evaluateEdgeMessages } from './edgeMessages.js';
import { createClosureDomainExitRefreshRequest, evaluateFieldClosureSamples } from './fieldClosureSamples.js';
import { evaluateFieldObservers } from './observers.js';
import { buildNeighborGraph } from './spatialHash.js';

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

function createCarrierObserverFields(state) {
  const separation = Math.abs(state.bodies[1].x - state.bodies[0].x);
  return {
    positionX: state.bodies.map((body) => body.x),
    velocityX: state.bodies.map((body) => body.v),
    mass: state.bodies.map((body) => body.mass),
    kineticEnergy: state.bodies.map((body) => 0.5 * body.mass * body.v * body.v),
    closureAxisR: state.bodies.map(() => separation)
  };
}

export function observeCarrierTopology(state, closureHandle) {
  const [left, right] = state.bodies;
  const dx = right.x - left.x;
  const r = Math.abs(dx);
  const radius = Math.max(r * 1.5, r + 1e-12, 1e-12);
  const graph = buildNeighborGraph({
    cellSize: Math.max(r, 1e-12),
    radius,
    dimensions: 1,
    bodies: state.bodies
  });
  const edgeMessages = evaluateEdgeMessages({ neighborGraph: graph, closureHandle });
  if (edgeMessages.outOfRangeCount > 0) {
    const edge = edgeMessages.outOfRangeEdges[0];
    const axisName = closureHandle.axisName || 'r';
    const domain = Array.isArray(closureHandle.validity?.[axisName])
      ? closureHandle.validity[axisName]
      : null;
    const error = new RangeError(edge.reason);
    error.closureDomainExit = {
      closureId: closureHandle.closureId || null,
      closureKind: closureHandle.closureKind || null,
      outputName: closureHandle.outputName || null,
      axisName,
      fieldName: 'closureAxisR',
      inputValue: edge.distance,
      domain,
      reason: edge.reason
    };
    throw error;
  }
  const [message] = edgeMessages.messages;
  if (!message) {
    throw new Error('Carrier topology force path produced no edge message');
  }
  const fieldObservers = evaluateFieldObservers({
    particles: state,
    neighborGraph: graph,
    fields: createCarrierObserverFields(state),
    radius,
    smoothingLength: radius,
    kernel: 'linear-compact-reference',
    includeSelf: true
  });
  const fieldClosureSamples = evaluateFieldClosureSamples({
    fieldObservers,
    closureHandle,
    fieldName: 'closureAxisR',
    axisName: closureHandle.axisName || 'r'
  });
  return {
    forces: [message.forceOnSource[0], message.forceOnTarget[0]],
    sample: {
      value: message.sampledPotentialEnergy,
      derivatives: { dEdr: message.sampledDerivative }
    },
    separation: message.distance,
    edgeMessageSummary: edgeMessages.summary,
    fieldObserverSummary: fieldObservers.summary,
    fieldClosureSampleSummary: fieldClosureSamples.summary
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
      const firstForces = observeCarrierTopology(before, closureHandle);
      const next = cloneState(before);
      next.step = (Number.isFinite(before.step) ? before.step : 0) + 1;
      next.time = (Number.isFinite(before.time) ? before.time : 0) + timestep;
      for (let index = 0; index < next.bodies.length; index += 1) {
        const body = next.bodies[index];
        const halfVelocity = body.v + 0.5 * (firstForces.forces[index] / body.mass) * timestep;
        body.x += halfVelocity * timestep;
        body.v = halfVelocity;
      }
      const secondForces = observeCarrierTopology(next, closureHandle);
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
          edgeMessageSummary: secondForces.edgeMessageSummary,
          fieldObserverSummary: secondForces.fieldObserverSummary,
          fieldClosureSampleSummary: secondForces.fieldClosureSampleSummary,
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
      let domainExit = null;
      for (let index = 0; index < stepCount; index += 1) {
        let result;
        try {
          result = this.step(state);
        } catch (error) {
          // A step that leaves the closure's sampled validity domain is a recoverable
          // signal, not a failure: halt cleanly, keep the deltas observed so far, and
          // surface a closure refresh request for the supervised runtime to act on.
          if (error instanceof RangeError && error.closureDomainExit) {
            domainExit = {
              ...error.closureDomainExit,
              atStep: Number.isFinite(state.step) ? state.step : index,
              completedSteps: deltas.length
            };
            break;
          }
          throw error;
        }
        state = result.state;
        deltas.push(result.delta);
        invariantSeries.push(result.invariants);
      }
      const closureRefreshRequest = domainExit
        ? createClosureDomainExitRefreshRequest({
            ...domainExit,
            reason: 'observed-field-outside-closure-domain',
            detail: domainExit.reason
          })
        : (deltas.at(-1)?.fieldClosureSampleSummary?.closureRefreshRequest ?? null);
      return {
        backend: this.backend,
        integrator,
        dt: timestep,
        steps: stepCount,
        requestedSteps: stepCount,
        completedSteps: deltas.length,
        finalState: state,
        deltas,
        invariantSeries,
        invariants: invariantDriftReport(invariantSeries, toleranceProfile),
        domainExit,
        closureRefreshRequest
      };
    }
  };
}
