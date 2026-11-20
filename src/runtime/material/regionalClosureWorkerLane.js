import { ReservationLedger } from '../../../../peercompute/peercompute/src/peercompute/stateManager/ReservationLedger.js';
import {
  createRegionalClosureSamplerGpu,
  encodeRegionalClosureEvaluate,
  encodeRegionalClosureScheduleBoundary,
  encodeRegionalClosureVerify
} from './regionalClosureSamplerGpu.js';
import { packResponseFunctionsForGpu } from './responseFunctionGpu.js';

export const REGIONAL_CLOSURE_WORKER_LANE_SCHEMA = 'ulg.regional-closure-worker-lane.v1';

// Default normalized Tait EOS stiffness generator K(rho/rho0) / (rho0 c^2) = (rho/rho0)^7,
// matching the packed Tait EOS evaluated by sphImplicitPressureGpu.js and Eshkol AD.
export const DEFAULT_TAIT_EOS_REGIONAL_GENERATOR_WGSL = /* wgsl */ `
fn a3_regime(x: vec3<f32>) -> u32 {
  if (!(x.x > 0.25 && x.x < 4.0)) { return 0xffffffffu; }
  return 1u;
}
fn a3_generator(x: vec3<f32>) -> f32 {
  let r = x.x;
  let r2 = r * r;
  return r2 * r2 * r2 * r;
}
`;

const lanes = new WeakMap();

function requireLiveLane(lane) {
  const state = lanes.get(lane);
  if (!state || state.closed) throw new Error('A3 regional closure worker lane is closed');
  return state;
}

const LANE_KEY = 'regional-closure-generation';

/**
 * Create a G5-reserved resident GPU A3 regional closure lane wrapping
 * `regionalClosureSamplerGpu.js`. Schedule boundaries promote pending GPU or
 * Eshkol-derived A4 response tables under bounded ReservationLedger CAS control.
 */
export function createRegionalClosureWorkerLane(device, {
  name = 'ulg-regional-closure-lane',
  maxGenerations = 3,
  generatorWgsl = DEFAULT_TAIT_EOS_REGIONAL_GENERATOR_WGSL,
  axes = 1,
  regionCapacity = 16,
  memberCapacity = 4096,
  degrees = [8],
  tolerances = [1e-4],
  margin = 0.25,
  policy = 'async',
  relativeTolerance = 1e-5,
  heldOutPerAxis = 3,
  safetyFactor = 2
} = {}) {
  const ledger = new ReservationLedger({ name, maxKeys: Math.max(1, maxGenerations) });
  let sampler = null;
  let initialToken = null;
  try {
    sampler = createRegionalClosureSamplerGpu(device, {
      generatorWgsl,
      axes,
      regionCapacity,
      memberCapacity,
      degrees,
      tolerances,
      margin,
      policy,
      relativeTolerance,
      heldOutPerAxis,
      safetyFactor
    });
    const res = ledger.reserve({ key: LANE_KEY, consumerId: 'generation:0' });
    if (!res.ok) throw new Error(`G5 reservation rejected for initial lane: ${res.reason}`);
    initialToken = res.token;
    const commit = ledger.commit(initialToken, { admissionId: 'gpu-regional-sampler:0' });
    if (!commit.ok) throw new Error(`G5 commit rejected for initial lane: ${commit.reason}`);
    const handle = Object.freeze({ schema: REGIONAL_CLOSURE_WORKER_LANE_SCHEMA });
    lanes.set(handle, {
      device,
      ledger,
      sampler,
      closed: false,
      ordinal: 0,
      adoptedScheduleIds: [],
      externalSourceFingerprint: null,
      externalTableBuffer: null
    });
    return handle;
  } catch (error) {
    if (initialToken) ledger.cancel(initialToken);
    if (sampler) {
      for (const buffer of Object.values(sampler.buffers)) buffer.destroy();
    }
    ledger.destroy();
    throw error;
  }
}

export function regionalClosureLaneBindings(lane) {
  const state = requireLiveLane(lane);
  return Object.freeze({
    ordinal: state.ordinal,
    tableBuffer: state.externalTableBuffer ?? state.sampler.buffers.table,
    samplerTableBuffer: state.sampler.buffers.table,
    controlBuffer: state.sampler.buffers.control,
    regionStateBuffer: state.sampler.buffers.regionState,
    valuesBuffer: state.sampler.buffers.values,
    externalSourceFingerprint: state.externalSourceFingerprint
  });
}

export function encodeRegionalClosureLaneEvaluate(lane, encoder, {
  membersBuffer,
  regionCount,
  memberCount
}) {
  const state = requireLiveLane(lane);
  state.sampler.writeParams({ regionCount, memberCount });
  encodeRegionalClosureEvaluate(encoder, state.sampler, {
    membersBuffer,
    regionCount,
    memberCount
  });
}

export function encodeRegionalClosureLaneVerify(lane, encoder, {
  membersBuffer,
  memberCount
}) {
  const state = requireLiveLane(lane);
  encodeRegionalClosureVerify(encoder, state.sampler, { membersBuffer, memberCount });
}

/**
 * Promote pending GPU regional fits at a schedule boundary under G5
 * ReservationLedger CAS control.
 */
export function encodeRegionalClosureLaneAdopt(lane, encoder, {
  membersBuffer,
  regionCount,
  scheduleId = null
}) {
  const state = requireLiveLane(lane);
  const nextOrdinal = state.ordinal + 1;
  state.ledger.retire(LANE_KEY);
  const res = state.ledger.reserve({ key: LANE_KEY, consumerId: `generation:${nextOrdinal}` });
  if (!res.ok) throw new Error(`G5 reservation rejected on lane adopt: ${res.reason}`);
  encodeRegionalClosureScheduleBoundary(encoder, state.sampler, {
    membersBuffer,
    regionCount
  });
  state.ledger.commit(res.token, { admissionId: `gpu-regional-sampler:${nextOrdinal}` });
  state.ordinal = nextOrdinal;
  state.externalSourceFingerprint = null;
  if (state.externalTableBuffer) {
    state.externalTableBuffer.destroy();
    state.externalTableBuffer = null;
  }
  if (scheduleId) state.adoptedScheduleIds.push(scheduleId);
  return Object.freeze({
    adopted: true,
    ordinal: state.ordinal,
    scheduleId,
    tableBuffer: state.sampler.buffers.table
  });
}

/**
 * Adopt an externally fitted A4 / Eshkol-AD response table (from
 * `deriveEosStiffnessResponse` or an A6 warm worker) into the lane under G5
 * ReservationLedger CAS authority, retiring the superseded table buffer.
 */
export function adoptExternalRegionalResponseTable(lane, responseFunctionsOrPacked, {
  scheduleId = null,
  sourceFingerprint = 'eshkol-external-a4'
} = {}) {
  const state = requireLiveLane(lane);
  const packed = responseFunctionsOrPacked?.data instanceof Float32Array
    ? responseFunctionsOrPacked
    : packResponseFunctionsForGpu(
        Array.isArray(responseFunctionsOrPacked)
          ? responseFunctionsOrPacked
          : [responseFunctionsOrPacked]
      );
  const nextOrdinal = state.ordinal + 1;
  let nextBuffer = null;
  try {
    nextBuffer = state.device.createBuffer({
      label: `ulg-a3-external-response-table-gen-${nextOrdinal}`,
      size: Math.max(16, packed.data.byteLength),
      usage: 0x80 | 0x08
    });
    state.device.queue.writeBuffer(nextBuffer, 0, packed.data);
  } catch (error) {
    nextBuffer?.destroy?.();
    throw error;
  }
  const previousExternal = state.externalTableBuffer;
  state.ledger.retire(LANE_KEY);
  const res = state.ledger.reserve({ key: LANE_KEY, consumerId: `generation:${nextOrdinal}` });
  if (!res.ok) {
    nextBuffer.destroy();
    throw new Error(`G5 reservation rejected on external table adopt: ${res.reason}`);
  }
  state.ledger.attach(res.token, () => {
    if (state.externalTableBuffer === nextBuffer) state.externalTableBuffer = null;
    nextBuffer.destroy();
  });
  state.ledger.commit(res.token, { admissionId: `${sourceFingerprint}:${nextOrdinal}` });
  state.externalTableBuffer = nextBuffer;
  state.externalSourceFingerprint = sourceFingerprint;
  state.ordinal = nextOrdinal;
  if (scheduleId) state.adoptedScheduleIds.push(scheduleId);
  // Previous external table was destroyed by ledger.retire(LANE_KEY) if attached; guard in case it wasn't.
  if (previousExternal && previousExternal !== nextBuffer) {
    try { previousExternal.destroy(); } catch { /* Already destroyed by retire. */ }
  }
  return Object.freeze({
    adopted: true,
    ordinal: state.ordinal,
    scheduleId,
    sourceFingerprint,
    tableBuffer: nextBuffer,
    packedFloatCount: packed.data.length
  });
}

export function destroyRegionalClosureWorkerLane(lane) {
  const state = lanes.get(lane);
  if (!state || state.closed) return;
  state.closed = true;
  state.ledger.destroy();
  if (state.externalTableBuffer) {
    try { state.externalTableBuffer.destroy(); } catch { /* Destroyed by ledger. */ }
    state.externalTableBuffer = null;
  }
  for (const buffer of Object.values(state.sampler.buffers)) buffer.destroy();
}
