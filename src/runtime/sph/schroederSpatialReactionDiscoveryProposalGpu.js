import {
  SCHROEDER_SPATIAL_EXACT_NEAR_EXPECTATION_V1_UNIFORM_BYTES,
  SCHROEDER_SPATIAL_EXACT_NEAR_EXPECTATION_V2_UNIFORM_BYTES,
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_REACTION_DISCOVERY_V1,
  ULG_SCHROEDER_SPATIAL_EXACT_NEAR_GPU_EVIDENCE_SCHEMA
} from '../../../ulg-gpu-abi/src/schroederSpatialExactNear.js';
import {
  createSchroederSpatialExactNearTraversalV1Wgsl,
  createSchroederSpatialExactNearTraversalV2Wgsl
} from '../../../ulg-gpu-abi/src/schroederSpatialExactNearTraversalWgsl.js';
import {
  createSchroederSpatialExactNearCellTreeTraversalV1Wgsl,
  createSchroederSpatialExactNearCellTreeTraversalV2Wgsl
} from '../../../ulg-gpu-abi/src/schroederSpatialExactNearCellTreeWgsl.js';
import {
  SCHROEDER_SPATIAL_EPOCH_V2_VERSION,
  SCHROEDER_SPATIAL_EPOCH_VERSION,
  ULG_SPH_GPU_REACTION_TABLE_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import {
  computeBufferBinding,
  createCachedExplicitComputePipeline
} from '../webgpuComputeLayout.js';
import {
  finalizeSchroederSpatialExactNearConsumerReceipt,
  isFinalizedSchroederSpatialExactNearConsumerReceipt,
  resolveSchroederSpatialExactNearConsumerGeneration
} from './schroederSpatialEpochGpu.js';
import {
  resolveSchroederSpatialExactNearCellTreeForConsumer
} from './schroederSpatialExactNearCellTreeGpu.js';
import {
  tagWebGpuBufferDevice,
  typedArrayContentFingerprint,
  webGpuBufferDevice,
  webGpuBufferMatchesDevice
} from './sphGpuDeviceIdentity.js';
import {
  schroederAuthorityTypedArrayFingerprint
} from './schroederAuthorityFingerprint.js';
import {
  createGpuReadbackTelemetry
} from './sphGpuReadbackTelemetry.js';
import {
  SPH_REACTION_ACTIVATION_OBSERVATION_ENCODED_COUNT_BIAS,
  SPH_REACTION_ACTIVATION_OBSERVATION_ENCODED_FAILURE_WORD,
  SPH_REACTION_ACTIVATION_OBSERVATION_PUBLIC_FAILURE_WORD,
  SPH_REACTION_MOTION_ENVELOPE_MAX_EXACT_COUNT,
  SPH_REACTION_MOTION_ENVELOPE_PREDICATE_REVISION,
  ULG_SPH_REACTION_ACTIVATION_OBSERVATION_FATAL_ERROR_CODE,
  ULG_SPH_REACTION_ACTIVATION_OBSERVATION_SCHEMA,
  assertSphReactionMotionEnvelopeBoxDimsMatch,
  assertSphReactionMotionEnvelopeRulePrefix,
  isExactSphReactionMotionEnvelope,
  sphReactionMotionEnvelopeWgsl
} from './sphReactionMotionEnvelope.js';

export const ULG_SCHROEDER_SPATIAL_REACTION_DISCOVERY_PROPOSAL_SCHEMA =
  'peercompute.ulg.schroeder-spatial-reaction-discovery-proposal.v1';
export const ULG_SCHROEDER_SPATIAL_REACTION_ACTIVATION_OBSERVATION_SCHEMA =
  ULG_SPH_REACTION_ACTIVATION_OBSERVATION_SCHEMA;
export const SCHROEDER_SPATIAL_REACTION_ACTIVATION_PREDICATE_REVISION =
  SPH_REACTION_MOTION_ENVELOPE_PREDICATE_REVISION;
export const SCHROEDER_SPATIAL_REACTION_CURRENT_STATE_PREDICATE_REVISION =
  'canonical-reaction-exact-current-state-v1';
export const SCHROEDER_SPATIAL_REACTION_DISCOVERY_CONSUMER_ID =
  'reaction-discovery';
// Bump whenever the shared WGSL module changes. The per-device compute
// pipeline cache deliberately keys on this declared version rather than
// hashing shader source at runtime; the S9D marker prevents a long-lived
// WebGPU device (including Vite HMR) from retaining the pre-aggregation
// proposal module.
export const SCHROEDER_SPATIAL_REACTION_DISCOVERY_PIPELINE_CACHE_VERSION =
  'v12-zero-failure-biased-activation-watch';
export const SCHROEDER_SPATIAL_REACTION_DISCOVERY_PROPOSAL_ROW_LAYOUT =
  Object.freeze([
    'partnerParticleIndex:f32',
    'reactionIndex:f32',
    'reactantRole:f32',
    'distanceSquaredM2:f32'
  ]);
export const SCHROEDER_SPATIAL_REACTION_DISCOVERY_PROPOSAL_ROW_FLOATS = 4;
// Keep the original receipt words stable. Tree traversal diagnostics are
// append-only so existing certificate and identity offsets remain ABI-stable.
export const SCHROEDER_SPATIAL_REACTION_DISCOVERY_EVIDENCE_WORDS = 27;
export const SCHROEDER_SPATIAL_REACTION_DISCOVERY_EVIDENCE_LAYOUT =
  Object.freeze([
    'sourceDispatchCount:u32',
    'directoryAdmissionCount:u32',
    'directoryRejectionCount:u32',
    'candidateVisitCount:u32',
    'compatiblePairCount:u32',
    'malformedTraversalCount:u32',
    'proposalCount:u32',
    'sealedRowCount:u32',
    'sourceIdentityRejectionCount:u32',
    'supportProfileId:u32',
    'generationId:u32',
    'supportEpoch:u32',
    'particleCount:u32',
    'reactionCount:u32',
    'privateLookupBuildCount:u32',
    'overflowCount:u32',
    // Indexed mode increments these only after an exact spatial peer has
    // survived source admission. They distinguish the immutable material-pair
    // rule lookup from the caller-owned full-table fallback.
    'ruleIndexPairLookupCount:u32',
    'ruleIndexPairMissCount:u32',
    'ruleIndexRuleVisitCount:u32',
    'fullRuleScanRuleVisitCount:u32',
    // The displacement certificate lives in this existing resident evidence
    // allocation so reaction traversal can bind the shared tree within the
    // portable eight-storage-binding limit.
    'maximumDisplacementBits:u32',
    'displacementCertificateStatusBits:u32',
    'authorityActiveCount:u32',
    'currentActiveCount:u32',
    // These record the shared exact-cell view's work independently from
    // candidate predicate visits. They are diagnostic counters only: no
    // traversal budget or fallback policy is derived from them.
    'exactCellTreeNodeVisitCount:u32',
    'exactCellTreeLeafVisitCount:u32',
    'exactCellTreeMemberVisitCount:u32'
  ]);

const WORKGROUP_SIZE = 64;
const REACTION_RECORD_VEC4S = 3;
const REACTION_RECORD_FLOATS = REACTION_RECORD_VEC4S * 4;
const MAX_EXACT_F32_INTEGER =
  SPH_REACTION_MOTION_ENVELOPE_MAX_EXACT_COUNT;
const PARAMS_BYTES = 96;
const DISPLACEMENT_CERTIFICATE_READY_F32_BITS = 0x3f80_0000;
const REACTION_DISCOVERY_EVIDENCE_MAXIMUM_DISPLACEMENT_BITS = 20;
const REACTION_DISCOVERY_EVIDENCE_CERTIFICATE_STATUS_BITS = 21;
const REACTION_DISCOVERY_EVIDENCE_AUTHORITY_ACTIVE_COUNT = 22;
const REACTION_DISCOVERY_EVIDENCE_CURRENT_ACTIVE_COUNT = 23;
const REACTION_DISCOVERY_EVIDENCE_TREE_NODE_VISITS = 24;
const REACTION_DISCOVERY_EVIDENCE_TREE_LEAF_VISITS = 25;
const REACTION_DISCOVERY_EVIDENCE_TREE_MEMBER_VISITS = 26;
const REACTION_ACTIVATION_OBSERVATION_SENTINEL =
  SPH_REACTION_ACTIVATION_OBSERVATION_PUBLIC_FAILURE_WORD;
const REACTION_ACTIVATION_OBSERVATION_ENCODED_FAILURE =
  SPH_REACTION_ACTIVATION_OBSERVATION_ENCODED_FAILURE_WORD;
const REACTION_ACTIVATION_OBSERVATION_COUNT_BIAS =
  SPH_REACTION_ACTIVATION_OBSERVATION_ENCODED_COUNT_BIAS;
const REACTION_ACTIVATION_OBSERVATION_BYTES = Uint32Array.BYTES_PER_ELEMENT;
const REACTION_ACTIVATION_CONTROL_WORDS = 4;
const REACTION_ACTIVATION_CONTROL_BYTES =
  REACTION_ACTIVATION_CONTROL_WORDS * Uint32Array.BYTES_PER_ELEMENT;
const REACTION_RULE_INDEX_SCHEMA =
  'peercompute.ulg.schroeder-spatial-reaction-rule-index.v1';
const REACTION_RULE_INDEX_MODE_FULL_SCAN = 0;
const REACTION_RULE_INDEX_MODE_MATERIAL_PAIR = 1;
const REACTION_RULE_INDEX_PAIR_FLOATS = 4;
const REACTION_RULE_INDEX_RULES_PER_VEC4 = 4;
const REACTION_DISCOVERY_STORAGE_BINDING_COUNT = 8;
const reactionDiscoveryArenaCaches = new WeakMap();
const reactionDiscoveryProposalRecords = new WeakMap();
const reactionRuleIndexUploads = new WeakMap();
const reactionObservationDeviceTerminalSignals = new WeakMap();

const GPU_BUFFER_USAGE = {
  MAP_READ: globalThis.GPUBufferUsage?.MAP_READ ?? 1,
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64
};
const GPU_MAP_MODE = { READ: globalThis.GPUMapMode?.READ ?? 1 };

function reactionObservationDeviceTerminalSignalFor(device) {
  if (!device?.lost?.then) return null;
  let signal = reactionObservationDeviceTerminalSignals.get(device);
  if (signal) return signal;
  signal = { observed: false, promise: null };
  reactionObservationDeviceTerminalSignals.set(device, signal);
  const settle = () => {
    signal.observed = true;
    return 'device-terminal';
  };
  // The signal captures no proposal or arena. All observations on one device
  // share this listener, so released generations remain collectible while the
  // device's lost promise is still pending.
  signal.promise = Promise.resolve(device.lost).then(settle, settle);
  return signal;
}

function reactionActivationObservationFailure(error, mapAsyncCount) {
  const failure = error instanceof Error
    ? error
    : new Error(String(error));
  try {
    Object.defineProperty(
      failure,
      'reactionActivationObservationMapAsyncCount',
      {
        value: mapAsyncCount,
        enumerable: false,
        configurable: false,
        writable: false
      }
    );
    return failure;
  } catch {
    const wrapped = new Error(failure.message, { cause: failure });
    wrapped.name = failure.name;
    Object.defineProperty(
      wrapped,
      'reactionActivationObservationMapAsyncCount',
      { value: mapAsyncCount }
    );
    return wrapped;
  }
}

function fatalReactionActivationObservationFailure(error, ErrorType = Error) {
  const failure = error instanceof Error
    ? error
    : new ErrorType(String(error));
  try {
    Object.defineProperties(failure, {
      code: {
        value: ULG_SPH_REACTION_ACTIVATION_OBSERVATION_FATAL_ERROR_CODE
      },
      reactionActivationObservationFatal: { value: true }
    });
    return failure;
  } catch {
    const wrapped = new ErrorType(failure.message, { cause: failure });
    wrapped.code = ULG_SPH_REACTION_ACTIVATION_OBSERVATION_FATAL_ERROR_CODE;
    wrapped.reactionActivationObservationFatal = true;
    return wrapped;
  }
}

function exactPositiveU32(value, label, max = 0xffff_ffff) {
  if (
    typeof value !== 'number'
    || !Number.isSafeInteger(value)
    || value < 1
    || value > max
  ) {
    throw new RangeError(`${label} must be an integer in [1, ${max}]`);
  }
  return value;
}

function exactPositiveDeviceLimit(device, name) {
  const value = device?.limits?.[name];
  if (
    typeof value !== 'number'
    || !Number.isSafeInteger(value)
    || value < 1
  ) {
    throw new RangeError(
      `reaction discovery requires exact device.limits.${name}`
    );
  }
  return value;
}

function reactionDiscoveryDeviceLimits(device) {
  const limits = Object.freeze({
    maxBufferSize: exactPositiveDeviceLimit(device, 'maxBufferSize'),
    maxStorageBufferBindingSize: exactPositiveDeviceLimit(
      device,
      'maxStorageBufferBindingSize'
    ),
    maxUniformBufferBindingSize: exactPositiveDeviceLimit(
      device,
      'maxUniformBufferBindingSize'
    ),
    maxStorageBuffersPerShaderStage: exactPositiveDeviceLimit(
      device,
      'maxStorageBuffersPerShaderStage'
    ),
    maxComputeWorkgroupsPerDimension: exactPositiveDeviceLimit(
      device,
      'maxComputeWorkgroupsPerDimension'
    )
  });
  if (
    limits.maxStorageBuffersPerShaderStage
      < REACTION_DISCOVERY_STORAGE_BINDING_COUNT
  ) {
    throw new RangeError(
      'reaction discovery requires eight storage buffers per shader stage'
    );
  }
  return limits;
}

function checkedPositiveProduct(
  values,
  label,
  maximum = Number.MAX_SAFE_INTEGER
) {
  let product = 1;
  for (const value of values) {
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new RangeError(`${label} factors must be positive safe integers`);
    }
    if (product > Math.floor(maximum / value)) {
      throw new RangeError(`${label} exceeds its exact integer domain`);
    }
    product *= value;
  }
  return product;
}

function finitePositive(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive finite number`);
  }
  return value;
}

function beginReactionDiscoveryTimestampSpan(
  gpuTimestampRecorder,
  encoder,
  descriptor
) {
  return gpuTimestampRecorder?.active === true
    && typeof gpuTimestampRecorder.beginEncoderSpan === 'function'
    && typeof gpuTimestampRecorder.endEncoderSpan === 'function'
    ? gpuTimestampRecorder.beginEncoderSpan(encoder, descriptor)
    : null;
}

function endReactionDiscoveryTimestampSpan(
  gpuTimestampRecorder,
  encoder,
  token
) {
  if (!token) return;
  gpuTimestampRecorder.endEncoderSpan(encoder, token);
}

function requireBuffer(device, buffer, label) {
  if (
    !buffer
    || webGpuBufferDevice(buffer) !== device
    || !webGpuBufferMatchesDevice(buffer, device)
  ) {
    throw new TypeError(`${label} must be a live buffer on the canonical generation device`);
  }
  return buffer;
}

function requireMinimumBufferBytes(buffer, byteLength, label) {
  if (
    !Number.isSafeInteger(byteLength)
    || byteLength < 4
  ) {
    throw new RangeError(`${label} requires an exact positive byte length`);
  }
  if (
    typeof buffer?.size !== 'number'
    || !Number.isSafeInteger(buffer.size)
    || buffer.size < byteLength
  ) {
    throw new RangeError(
      `${label} has ${String(buffer?.size)} bytes; ${byteLength} required`
    );
  }
  return buffer;
}

function requireStorageBufferPrefix(
  buffer,
  byteLength,
  label,
  limits
) {
  requireStorageCapacity(limits, byteLength, label);
  requireMinimumBufferBytes(buffer, byteLength, label);
  requireBufferCapacity(limits, buffer.size, label);
  return buffer;
}

function exactBufferBindingResource(buffer, size) {
  return { buffer, offset: 0, size };
}

function requireBufferCapacity(limits, byteLength, label) {
  if (!Number.isSafeInteger(byteLength) || byteLength < 4) {
    throw new RangeError(`${label} byte length is not safely addressable`);
  }
  if (byteLength > limits.maxBufferSize) {
    throw new RangeError(
      `${label} requires ${byteLength} bytes; maxBufferSize is ${limits.maxBufferSize}`
    );
  }
  return byteLength;
}

function requireStorageCapacity(limits, byteLength, label) {
  requireBufferCapacity(limits, byteLength, label);
  if (byteLength > limits.maxStorageBufferBindingSize) {
    throw new RangeError(
      `${label} requires ${byteLength} bytes; maxStorageBufferBindingSize is ${limits.maxStorageBufferBindingSize}`
    );
  }
  return byteLength;
}

function requireUniformCapacity(limits, byteLength, label) {
  requireBufferCapacity(limits, byteLength, label);
  if (byteLength > limits.maxUniformBufferBindingSize) {
    throw new RangeError(
      `${label} requires ${byteLength} bytes; maxUniformBufferBindingSize is ${limits.maxUniformBufferBindingSize}`
    );
  }
  return byteLength;
}

function createBuffer(device, limits, label, size, usage) {
  requireBufferCapacity(limits, size, label);
  const buffer = tagWebGpuBufferDevice(device.createBuffer({
    label,
    size,
    usage
  }), device);
  if (buffer?.size !== size) {
    try { buffer?.destroy?.(); } catch {}
    throw new RangeError(`${label} was not created at its exact requested size`);
  }
  return buffer;
}

function powerOfTwoByteCapacity(requiredBytes, maximum, label) {
  requireBufferCapacity({ maxBufferSize: maximum }, requiredBytes, label);
  let capacity = 4;
  while (capacity < requiredBytes) {
    if (capacity > Math.floor(maximum / 2)) {
      throw new RangeError(`${label} cannot grow to an exact power-of-two capacity`);
    }
    capacity *= 2;
  }
  return capacity;
}

function arenaCacheForDevice(device) {
  let cache = reactionDiscoveryArenaCaches.get(device);
  if (!cache) {
    cache = new Map();
    reactionDiscoveryArenaCaches.set(device, cache);
  }
  return cache;
}

function destroyArenaEntry(entry) {
  entry.proposalBuffer?.destroy?.();
  entry.evidenceBuffer?.destroy?.();
  entry.evidenceReadbackBuffer?.destroy?.();
  entry.activationObservationWordBuffer?.destroy?.();
  entry.activationObservationReadbackBuffer?.destroy?.();
  entry.expectationBuffer?.destroy?.();
  entry.paramsBuffer?.destroy?.();
  entry.reactionRecordBuffer?.destroy?.();
  entry.destroyed = true;
}

function acquireReactionDiscoveryArenaResources({
  device,
  limits,
  generation,
  directoryAbiVersion,
  expectationBufferByteLength,
  proposalBytes,
  localReactionRecordBytes,
  observeGpuEvidence = false,
  captureActivationObservation = false
}) {
  const arenaIndex = generation?.execution?.arenaIndex;
  if (!Number.isInteger(arenaIndex) || arenaIndex < 0) {
    throw new TypeError('reaction discovery requires a canonical generation arena index');
  }
  if (
    directoryAbiVersion !== SCHROEDER_SPATIAL_EPOCH_VERSION
    && directoryAbiVersion !== SCHROEDER_SPATIAL_EPOCH_V2_VERSION
  ) {
    throw new RangeError(
      `unsupported reaction discovery arena ABI version: ${
        directoryAbiVersion
      }`
    );
  }
  if (
    !Number.isInteger(expectationBufferByteLength)
    || expectationBufferByteLength < 4
  ) {
    throw new RangeError(
      'reaction discovery expectation buffer byte length must be positive'
    );
  }
  requireStorageCapacity(
    limits,
    proposalBytes,
    'reaction discovery proposal buffer'
  );
  requireStorageCapacity(
    limits,
    SCHROEDER_SPATIAL_REACTION_DISCOVERY_EVIDENCE_WORDS
      * Uint32Array.BYTES_PER_ELEMENT,
    'reaction discovery evidence buffer'
  );
  requireUniformCapacity(
    limits,
    expectationBufferByteLength,
    'reaction discovery expectation buffer'
  );
  requireUniformCapacity(
    limits,
    PARAMS_BYTES,
    'reaction discovery params buffer'
  );
  if (observeGpuEvidence === true) {
    requireBufferCapacity(
      limits,
      SCHROEDER_SPATIAL_REACTION_DISCOVERY_EVIDENCE_WORDS
        * Uint32Array.BYTES_PER_ELEMENT,
      'reaction discovery evidence readback buffer'
    );
  }
  if (captureActivationObservation === true) {
    requireStorageCapacity(
      limits,
      REACTION_ACTIVATION_CONTROL_BYTES,
      'reaction discovery activation control buffer'
    );
    requireBufferCapacity(
      limits,
      REACTION_ACTIVATION_OBSERVATION_BYTES,
      'reaction discovery activation readback buffer'
    );
  }
  if (localReactionRecordBytes > 0) {
    requireStorageCapacity(
      limits,
      localReactionRecordBytes,
      'reaction discovery reaction record buffer'
    );
  }
  const cache = arenaCacheForDevice(device);
  const arenaKey = `${directoryAbiVersion}:${arenaIndex}`;
  let entry = cache.get(arenaKey) || null;
  if (entry?.inUse === true) {
    if (entry.generation?.execution?.released === true) {
      if (entry.activationObservationLease === entry.lease) {
        throw new Error(
          `reaction discovery arena ${arenaIndex} remains pinned by a pending activation observation`
        );
      }
      entry.inUse = false;
      entry.generation = null;
      entry.generationId = null;
      entry.lease = null;
    } else {
      throw new Error(
        `reaction discovery arena ${arenaIndex} is already leased by generation ${entry.generationId}`
      );
    }
  }
  if (
    entry?.inUse === false
    && entry.generation
    && entry.generation.execution?.released !== true
  ) {
    throw new Error(
      `reaction discovery arena ${arenaIndex} remains quarantined by live generation ${entry.generationId}`
    );
  }
  let bufferCreationCount = 0;
  if (!entry || entry.destroyed === true) {
    entry = {
      arenaKey,
      arenaIndex,
      directoryAbiVersion,
      expectationBufferByteLength,
      proposalBuffer: null,
      proposalCapacityBytes: 0,
      evidenceBuffer: null,
      evidenceReadbackBuffer: null,
      activationObservationWordBuffer: null,
      activationObservationReadbackBuffer: null,
      expectationBuffer: null,
      paramsBuffer: null,
      reactionRecordBuffer: null,
      reactionRecordCapacityBytes: 0,
      generation: null,
      generationId: null,
      inUse: false,
      lease: null,
      activationObservationLease: null,
      destroyed: false,
      totalBufferCreationCount: 0,
      acquisitionCount: 0
    };
    cache.set(arenaKey, entry);
  }
  if (
    entry.directoryAbiVersion !== directoryAbiVersion
    || entry.expectationBufferByteLength !== expectationBufferByteLength
  ) {
    throw new Error(
      `reaction discovery arena ${arenaIndex} ABI identity mismatch`
    );
  }
  if (entry.proposalCapacityBytes < proposalBytes) {
    entry.proposalBuffer?.destroy?.();
    entry.proposalCapacityBytes = powerOfTwoByteCapacity(
      proposalBytes,
      Math.min(limits.maxBufferSize, limits.maxStorageBufferBindingSize),
      'reaction discovery cached proposal buffer'
    );
    requireStorageCapacity(
      limits,
      entry.proposalCapacityBytes,
      'reaction discovery cached proposal buffer'
    );
    entry.proposalBuffer = createBuffer(
      device,
      limits,
      `ulg-schroeder-spatial-reaction-discovery-proposals-arena-${arenaIndex}`,
      entry.proposalCapacityBytes,
      GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
    );
    bufferCreationCount += 1;
  }
  if (!entry.evidenceBuffer) {
    entry.evidenceBuffer = createBuffer(
      device,
      limits,
      `ulg-schroeder-spatial-reaction-discovery-evidence-arena-${arenaIndex}`,
      SCHROEDER_SPATIAL_REACTION_DISCOVERY_EVIDENCE_WORDS
        * Uint32Array.BYTES_PER_ELEMENT,
      GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
    );
    bufferCreationCount += 1;
  }
  if (observeGpuEvidence === true && !entry.evidenceReadbackBuffer) {
    entry.evidenceReadbackBuffer = createBuffer(
      device,
      limits,
      `ulg-schroeder-spatial-reaction-discovery-evidence-readback-arena-${arenaIndex}`,
      SCHROEDER_SPATIAL_REACTION_DISCOVERY_EVIDENCE_WORDS
        * Uint32Array.BYTES_PER_ELEMENT,
      GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    );
    bufferCreationCount += 1;
  }
  if (
    captureActivationObservation === true
    && !entry.activationObservationWordBuffer
  ) {
    entry.activationObservationWordBuffer = createBuffer(
      device,
      limits,
      `ulg-schroeder-spatial-reaction-activation-word-arena-${arenaIndex}`,
      REACTION_ACTIVATION_CONTROL_BYTES,
      GPU_BUFFER_USAGE.STORAGE
        | GPU_BUFFER_USAGE.COPY_SRC
        | GPU_BUFFER_USAGE.COPY_DST
    );
    bufferCreationCount += 1;
  }
  if (
    captureActivationObservation === true
    && !entry.activationObservationReadbackBuffer
  ) {
    entry.activationObservationReadbackBuffer = createBuffer(
      device,
      limits,
      `ulg-schroeder-spatial-reaction-activation-readback-arena-${arenaIndex}`,
      REACTION_ACTIVATION_OBSERVATION_BYTES,
      GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    );
    bufferCreationCount += 1;
  }
  if (!entry.expectationBuffer) {
    entry.expectationBuffer = createBuffer(
      device,
      limits,
      `ulg-schroeder-spatial-reaction-discovery-expectation-v${
        directoryAbiVersion
      }-arena-${arenaIndex}`,
      expectationBufferByteLength,
      GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
    );
    bufferCreationCount += 1;
  }
  if (!entry.paramsBuffer) {
    entry.paramsBuffer = createBuffer(
      device,
      limits,
      `ulg-schroeder-spatial-reaction-discovery-params-arena-${arenaIndex}`,
      PARAMS_BYTES,
      GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
    );
    bufferCreationCount += 1;
  }
  if (
    localReactionRecordBytes > 0
    && entry.reactionRecordCapacityBytes < localReactionRecordBytes
  ) {
    entry.reactionRecordBuffer?.destroy?.();
    entry.reactionRecordCapacityBytes = powerOfTwoByteCapacity(
      localReactionRecordBytes,
      Math.min(limits.maxBufferSize, limits.maxStorageBufferBindingSize),
      'reaction discovery cached reaction record buffer'
    );
    requireStorageCapacity(
      limits,
      entry.reactionRecordCapacityBytes,
      'reaction discovery cached reaction record buffer'
    );
    entry.reactionRecordBuffer = createBuffer(
      device,
      limits,
      `ulg-schroeder-spatial-reaction-discovery-records-arena-${arenaIndex}`,
      entry.reactionRecordCapacityBytes,
      GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
    );
    bufferCreationCount += 1;
  }
  const lease = Object.freeze({
    arenaIndex,
    generationId: generation.execution.generationId,
    acquisitionOrdinal: entry.acquisitionCount + 1
  });
  entry.acquisitionCount += 1;
  entry.totalBufferCreationCount += bufferCreationCount;
  entry.inUse = true;
  entry.generation = generation;
  entry.generationId = generation.execution.generationId;
  entry.lease = lease;
  entry.activationObservationLease = captureActivationObservation === true
    ? lease
    : null;
  return { entry, lease, bufferCreationCount };
}

function releaseReactionDiscoveryArenaResources(entry, lease) {
  if (!entry || entry.lease !== lease || entry.inUse !== true) return false;
  entry.inUse = false;
  entry.lease = null;
  entry.activationObservationLease = null;
  return true;
}

/** Destroy idle per-arena buffers, normally only when the owning device exits. */
export function destroySchroederSpatialReactionDiscoveryProposalCache(device) {
  const cache = reactionDiscoveryArenaCaches.get(device);
  if (!cache) return false;
  for (const entry of cache.values()) {
    if (entry.inUse === true) {
      throw new Error(
        `cannot destroy leased reaction discovery arena ${entry.arenaIndex}`
      );
    }
    if (entry.generation && entry.generation.execution?.released !== true) {
      throw new Error(
        `cannot destroy live reaction discovery arena ${entry.arenaIndex}`
      );
    }
  }
  for (const entry of cache.values()) destroyArenaEntry(entry);
  cache.clear();
  reactionDiscoveryArenaCaches.delete(device);
  return true;
}

/**
 * Validate the narrow handoff consumed by the canonical reaction resolver.
 * Receipt authenticity, generation identity, device ownership, row shape, and
 * live buffer capacity are all checked here so the chemistry kernel need not
 * duplicate spatial-control-plane rules.
 */
export function resolveSchroederSpatialReactionDiscoveryProposalForConsumer(
  proposal,
  {
    device,
    generation,
    particleCount = generation?.source?.sourceCount,
    reactionCount = proposal?.reactionCount,
    reactionTable = null,
    sourceStateBuffer = null,
    sourceThermoBuffer = null
  } = {}
) {
  const reject = (status, reason) => Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_REACTION_DISCOVERY_PROPOSAL_SCHEMA,
    status,
    reason,
    ready: false,
    admitted: false
  });
  const authenticRecord = reactionDiscoveryProposalRecords.get(proposal);
  let currentReactionFingerprint = null;
  try {
    currentReactionFingerprint = reactionTable
      ? schroederAuthorityTypedArrayFingerprint(
          reactionRecordArray(reactionTable).combined,
          'reaction-table-combined-records-v2'
        )
      : null;
  } catch {
    return reject(
      'schroeder-spatial-reaction-discovery-proposal-rejected-authenticity',
      'reaction discovery proposal was not issued for this exact generation and buffer family'
    );
  }
  if (
    !authenticRecord
    || authenticRecord.proposal !== proposal
    || authenticRecord.generation !== generation
    || authenticRecord.directoryAbiVersion
      !== generation?.execution?.abiVersion
    || authenticRecord.directoryAbiVersion
      !== proposal?.directoryAbiVersion
    || authenticRecord.directoryBuffer !== generation?.execution?.directoryBuffer
    || authenticRecord.exactNearCellTree !== generation?.exactNearCellTree
    || authenticRecord.exactNearCellTree !== proposal?.exactNearCellTree
    || authenticRecord.exactNearCellTreeBuffer
      !== proposal?.exactNearCellTreeBuffer
    || authenticRecord.positionAuthorityStateBuffer
      !== (generation?.source?.sourceStateBuffer
        ?? generation?.source?.exactNearQueryProfile?.sourceStateBuffer)
    || authenticRecord.sourceCurrentStateBuffer !== proposal?.sourceCurrentStateBuffer
    || authenticRecord.sourceThermoBuffer !== proposal?.sourceThermoBuffer
    || !reactionTable
    || authenticRecord.reactionTable !== reactionTable
    || authenticRecord.reactionTableFingerprint !== currentReactionFingerprint
    || authenticRecord.reactionRecordBuffer !== proposal?.reactionRecordBuffer
    || authenticRecord.reactionDiscoveryPayloadFingerprint
      !== proposal?.reactionDiscoveryPayloadFingerprint
    || authenticRecord.reactionRuleIndex !== proposal?.reactionRuleIndex
    || authenticRecord.displacementCertificateBuffer
      !== proposal?.displacementCertificateBuffer
    || !sourceStateBuffer
    || !sourceThermoBuffer
    || authenticRecord.sourceCurrentStateBuffer !== sourceStateBuffer
    || authenticRecord.sourceThermoBuffer !== sourceThermoBuffer
    || authenticRecord.expectationBuffer !== proposal?.expectationBuffer
    || authenticRecord.receipt !== proposal?.receipt
  ) {
    return reject(
      'schroeder-spatial-reaction-discovery-proposal-rejected-authenticity',
      'reaction discovery proposal was not issued for this exact generation and buffer family'
    );
  }
  if (
    proposal?.schema !== ULG_SCHROEDER_SPATIAL_REACTION_DISCOVERY_PROPOSAL_SCHEMA
    || proposal.ready !== true
    || proposal.released === true
  ) {
    return reject(
      'schroeder-spatial-reaction-discovery-proposal-rejected-contract',
      'reaction discovery proposal is not a live submitted v1 artifact'
    );
  }
  if (
    proposal.consumerId !== SCHROEDER_SPATIAL_REACTION_DISCOVERY_CONSUMER_ID
    || proposal.supportProfileId
      !== SCHROEDER_SPATIAL_SUPPORT_PROFILE_REACTION_DISCOVERY_V1
    || proposal.proposalRowStrideFloats
      !== SCHROEDER_SPATIAL_REACTION_DISCOVERY_PROPOSAL_ROW_FLOATS
    || proposal.traversalCount !== 1
    || proposal.privateLookupBuildCount !== 0
    || proposal.fixedCandidateBuildCount !== 0
    || proposal.exhaustiveTraversalCount !== 0
    || proposal.candidateBudget !== null
    || proposal.fullReadbackPerformed !== false
    || (
      proposal.directoryAbiVersion !== SCHROEDER_SPATIAL_EPOCH_VERSION
      && proposal.directoryAbiVersion
        !== SCHROEDER_SPATIAL_EPOCH_V2_VERSION
    )
    || proposal.directoryAbiVersion !== generation?.execution?.abiVersion
  ) {
    return reject(
      'schroeder-spatial-reaction-discovery-proposal-rejected-invariants',
      'reaction discovery proposal violates the exact-near residency contract'
    );
  }
  if (
    proposal.generation !== generation
    || proposal.generationId !== generation?.execution?.generationId
    || generation?.execution?.released === true
    || generation?.releaseScheduled === true
  ) {
    return reject(
      'schroeder-spatial-reaction-discovery-proposal-rejected-generation',
      'reaction discovery proposal is not bound to the live consumer generation'
    );
  }
  if (
    proposal.particleCount !== particleCount
    || proposal.reactionCount !== reactionCount
  ) {
    return reject(
      'schroeder-spatial-reaction-discovery-proposal-rejected-count',
      'reaction discovery proposal count does not match the chemistry consumer'
    );
  }
  if (!isFinalizedSchroederSpatialExactNearConsumerReceipt(proposal.receipt)) {
    return reject(
      'schroeder-spatial-reaction-discovery-proposal-rejected-receipt',
      'reaction discovery proposal lacks an authentic finalized consumer receipt'
    );
  }
  if (
    proposal.receipt.consumerId !== proposal.consumerId
    || proposal.receipt.supportProfileId !== proposal.supportProfileId
    || proposal.receipt.generationId !== proposal.generationId
  ) {
    return reject(
      'schroeder-spatial-reaction-discovery-proposal-rejected-receipt-identity',
      'reaction discovery receipt identity does not match the artifact'
    );
  }
  if (
    !proposal.proposalBuffer
    || !proposal.evidenceBuffer
    || !proposal.reactionRecordBuffer
    || !proposal.directoryBuffer
    || !proposal.exactNearCellTree
    || !proposal.exactNearCellTreeBuffer
    || !proposal.expectationBuffer
    || !proposal.positionAuthorityStateBuffer
    || !proposal.sourceCurrentStateBuffer
    || !proposal.sourceThermoBuffer
    || !proposal.displacementCertificateBuffer
    || proposal.displacementCertificateBuffer !== proposal.evidenceBuffer
    || !webGpuBufferMatchesDevice(proposal.proposalBuffer, device)
    || !webGpuBufferMatchesDevice(proposal.evidenceBuffer, device)
    || !webGpuBufferMatchesDevice(proposal.reactionRecordBuffer, device)
    || !webGpuBufferMatchesDevice(proposal.directoryBuffer, device)
    || proposal.exactNearCellTree !== generation?.exactNearCellTree
    || proposal.exactNearCellTree?.released === true
    || proposal.exactNearCellTreeBuffer
      !== proposal.exactNearCellTree?.treeBuffer
    || !webGpuBufferMatchesDevice(proposal.exactNearCellTreeBuffer, device)
    || !webGpuBufferMatchesDevice(proposal.expectationBuffer, device)
    || !webGpuBufferMatchesDevice(proposal.positionAuthorityStateBuffer, device)
    || !webGpuBufferMatchesDevice(proposal.sourceCurrentStateBuffer, device)
    || !webGpuBufferMatchesDevice(proposal.sourceThermoBuffer, device)
    || !webGpuBufferMatchesDevice(proposal.displacementCertificateBuffer, device)
  ) {
    return reject(
      'schroeder-spatial-reaction-discovery-proposal-rejected-device',
      'reaction discovery buffers do not belong to the consumer device'
    );
  }
  const requiredProposalBytes = particleCount
    * SCHROEDER_SPATIAL_REACTION_DISCOVERY_PROPOSAL_ROW_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  if (
    proposal.proposalBufferByteLength !== requiredProposalBytes
    || !Number.isSafeInteger(proposal.proposalBuffer.size)
    || proposal.proposalBuffer.size < requiredProposalBytes
  ) {
    return reject(
      'schroeder-spatial-reaction-discovery-proposal-rejected-capacity',
      'reaction discovery proposal buffer is smaller than its authenticated row set'
    );
  }
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_REACTION_DISCOVERY_PROPOSAL_SCHEMA,
    status: 'schroeder-spatial-reaction-discovery-proposal-admitted',
    reason: null,
    ready: true,
    admitted: true,
    generation,
    proposalBuffer: proposal.proposalBuffer,
    evidenceBuffer: proposal.evidenceBuffer,
    reactionRecordBuffer: proposal.reactionRecordBuffer,
    directoryBuffer: proposal.directoryBuffer,
    exactNearCellTree: proposal.exactNearCellTree,
    exactNearCellTreeBuffer: proposal.exactNearCellTreeBuffer,
    expectationBuffer: proposal.expectationBuffer,
    positionAuthorityStateBuffer: proposal.positionAuthorityStateBuffer,
    sourceCurrentStateBuffer: proposal.sourceCurrentStateBuffer,
    sourceThermoBuffer: proposal.sourceThermoBuffer,
    displacementCertificateBuffer: proposal.displacementCertificateBuffer,
    particleCount,
    reactionCount,
    generationId: proposal.generationId,
    epochIdentity: proposal.epochIdentity,
    receipt: proposal.receipt
  });
}

function reactionRecordArray(
  reactionTable,
  { requireExactPrefixMirror = false } = {}
) {
  if (reactionTable?.schema !== ULG_SPH_GPU_REACTION_TABLE_SCHEMA) {
    throw new TypeError('canonical reaction discovery requires a packed SPH reaction table');
  }
  const reactionCount = exactPositiveU32(
    reactionTable.reactionCount,
    'reactionTable.reactionCount',
    MAX_EXACT_F32_INTEGER
  );
  if (!(reactionTable.records instanceof Float32Array)) {
    throw new TypeError('reactionTable.records must be a Float32Array');
  }
  if (
    typeof SharedArrayBuffer === 'function'
    && reactionTable.records.buffer instanceof SharedArrayBuffer
  ) {
    throw new TypeError('reactionTable.records cannot use shared mutable storage');
  }
  const requiredFloats = reactionCount * REACTION_RECORD_FLOATS;
  if (reactionTable.records.length !== requiredFloats) {
    throw new RangeError(
      `reactionTable.records has ${reactionTable.records.length} floats; exactly ${requiredFloats} required`
    );
  }
  const combined = reactionTable.combinedRecords instanceof Float32Array
    ? reactionTable.combinedRecords
    : reactionTable.records;
  if (
    typeof SharedArrayBuffer === 'function'
    && combined.buffer instanceof SharedArrayBuffer
  ) {
    throw new TypeError(
      'reactionTable.combinedRecords cannot use shared mutable storage'
    );
  }
  if (combined.length < requiredFloats) {
    throw new RangeError('reaction table combined records do not contain every reaction header');
  }
  if (
    requireExactPrefixMirror === true
    && reactionTable.combinedRecords instanceof Float32Array
  ) {
    for (let index = 0; index < requiredFloats; index += 1) {
      if (!Object.is(reactionTable.records[index], combined[index])) {
        throw new TypeError(
          'reaction table combined-record prefix does not match records'
        );
      }
    }
  }
  if (
    Object.hasOwn(reactionTable, 'recordStrideFloats')
    && reactionTable.recordStrideFloats !== REACTION_RECORD_FLOATS
  ) {
    throw new RangeError('reactionTable.recordStrideFloats must equal 12');
  }
  if (
    Object.hasOwn(reactionTable, 'combinedRecordCount')
    && (
      !Number.isSafeInteger(reactionTable.combinedRecordCount)
      || reactionTable.combinedRecordCount !== combined.length / 4
    )
  ) {
    throw new RangeError('reactionTable.combinedRecordCount is inconsistent');
  }
  return { reactionCount, combined };
}

function reactionRuleIndexFallback({
  combined,
  reason
}) {
  const recordVec4Count = combined.length % 4 === 0
    ? combined.length / 4
    : 0;
  return Object.freeze({
    schema: REACTION_RULE_INDEX_SCHEMA,
    mode: 'full-rule-scan',
    modeCode: REACTION_RULE_INDEX_MODE_FULL_SCAN,
    reason,
    upload: combined,
    pairOffsetVec4s: 0,
    pairCount: 0,
    ruleOffsetVec4s: 0,
    ruleCount: 0,
    recordVec4Count
  });
}

/**
 * The reaction table prefix is a public shared ABI consumed by the reaction
 * resolve/product stages. Discovery owns the private suffix below: a sorted
 * `(min(materialA, materialB), max(...)) -> [original reaction indexes]`
 * index. Appending it keeps the public prefix byte-identical and avoids an
 * additional storage binding.
 */
function createReactionRuleIndexUpload({
  combined,
  reactionCount,
  allowIndex,
  fallbackReason = 'material-pair-index-unavailable'
}) {
  if (allowIndex !== true) {
    return reactionRuleIndexFallback({
      combined,
      reason: fallbackReason
    });
  }
  if (combined.length % 4 !== 0) {
    return reactionRuleIndexFallback({
      combined,
      reason: 'reaction-record-prefix-not-vec4-aligned'
    });
  }

  const pairMap = new Map();
  for (let reactionIndex = 0; reactionIndex < reactionCount; reactionIndex += 1) {
    const offset = reactionIndex * REACTION_RECORD_FLOATS;
    const materialA = Math.fround(combined[offset]);
    const materialB = Math.fround(combined[offset + 1]);
    const activationTemperatureK = Math.fround(combined[offset + 3]);
    const contactRadiusM = Math.fround(combined[offset + 5]);
    const phaseMaskA = Math.fround(combined[offset + 6]);
    const phaseMaskB = Math.fround(combined[offset + 7]);
    const status = Math.fround(combined[offset + 8]);
    // Index only rows that survive every immutable predicate in the WGSL.
    // Dynamic phase, temperature, distance, role, and source-state checks
    // remain inside the exact rule evaluation below.
    if (
      status !== 1
      || !Number.isFinite(materialA)
      || !Number.isFinite(materialB)
      || materialA === materialB
      || !Number.isFinite(activationTemperatureK)
      || !Number.isFinite(contactRadiusM)
      || contactRadiusM <= 0
      || !Number.isFinite(phaseMaskA)
      || !Number.isFinite(phaseMaskB)
    ) {
      continue;
    }
    const materialLo = Math.min(materialA, materialB);
    const materialHi = Math.max(materialA, materialB);
    const key = `${materialLo}:${materialHi}`;
    let entry = pairMap.get(key);
    if (!entry) {
      entry = { materialLo, materialHi, ruleIndexes: [] };
      pairMap.set(key, entry);
    }
    // The source scan is ascending, so preserving append order retains the
    // original deterministic reaction-index tie break.
    entry.ruleIndexes.push(reactionIndex);
  }

  const entries = [...pairMap.values()].sort((left, right) => (
    left.materialLo - right.materialLo
    || left.materialHi - right.materialHi
  ));
  const ruleIndexes = entries.flatMap((entry) => entry.ruleIndexes);
  const pairOffsetVec4s = combined.length / 4;
  const ruleOffsetVec4s = pairOffsetVec4s + entries.length;
  const paddedRuleCount = Math.ceil(
    ruleIndexes.length / REACTION_RULE_INDEX_RULES_PER_VEC4
  ) * REACTION_RULE_INDEX_RULES_PER_VEC4;
  const upload = new Float32Array(
    combined.length
    + entries.length * REACTION_RULE_INDEX_PAIR_FLOATS
    + paddedRuleCount
  );
  upload.set(combined);
  let pairOffset = combined.length;
  let ruleOffset = 0;
  for (const entry of entries) {
    upload[pairOffset] = entry.materialLo;
    upload[pairOffset + 1] = entry.materialHi;
    upload[pairOffset + 2] = ruleOffset;
    upload[pairOffset + 3] = entry.ruleIndexes.length;
    pairOffset += REACTION_RULE_INDEX_PAIR_FLOATS;
    ruleOffset += entry.ruleIndexes.length;
  }
  upload.set(ruleIndexes, combined.length + entries.length * REACTION_RULE_INDEX_PAIR_FLOATS);
  return Object.freeze({
    schema: REACTION_RULE_INDEX_SCHEMA,
    mode: 'material-pair-indexed',
    modeCode: REACTION_RULE_INDEX_MODE_MATERIAL_PAIR,
    reason: null,
    upload,
    pairOffsetVec4s,
    pairCount: entries.length,
    ruleOffsetVec4s,
    ruleCount: ruleIndexes.length,
    recordVec4Count: upload.length / 4
  });
}

function cachedReactionRuleIndexUpload({
  reactionTable,
  combined,
  reactionCount,
  allowIndex,
  fallbackReason,
  reactionTableFingerprint
}) {
  if (allowIndex !== true) {
    return reactionRuleIndexFallback({
      combined,
      reason: fallbackReason
    });
  }
  const cached = reactionRuleIndexUploads.get(reactionTable);
  if (
    cached
    && cached.reactionTableFingerprint === reactionTableFingerprint
    && cached.reactionCount === reactionCount
    && cached.combined === combined
  ) {
    return cached.reactionRuleIndex;
  }
  const reactionRuleIndex = createReactionRuleIndexUpload({
    combined,
    reactionCount,
    allowIndex,
    fallbackReason
  });
  reactionRuleIndexUploads.set(reactionTable, {
    reactionTableFingerprint,
    reactionCount,
    combined,
    reactionRuleIndex
  });
  return reactionRuleIndex;
}

/**
 * The discovery traversal needs one complete broad-phase envelope. Contact
 * radii are immutable reaction-table data, so reducing them on the host does
 * not inspect particle state or introduce a spatial fallback/readback.
 */
export function maxReactionContactRadiusM(reactionTable) {
  const { reactionCount, combined } = reactionRecordArray(reactionTable);
  let maximum = 0;
  for (let reactionIndex = 0; reactionIndex < reactionCount; reactionIndex += 1) {
    const offset = reactionIndex * REACTION_RECORD_FLOATS;
    const status = combined[offset + 8];
    const radius = combined[offset + 5];
    if (Math.round(status) !== 1 || !Number.isFinite(radius) || radius <= 0) continue;
    maximum = Math.max(maximum, Math.fround(radius));
  }
  return maximum;
}

function createParamsArray({
  particleCount,
  reactionCount,
  maximumContactRadiusM,
  reactionRuleIndex,
  collectDiagnosticEvidence = false,
  reactionMotionEnvelope = null
}) {
  const data = new ArrayBuffer(PARAMS_BYTES);
  const view = new DataView(data);
  view.setUint32(0, exactPositiveU32(
    particleCount,
    'particleCount',
    MAX_EXACT_F32_INTEGER
  ), true);
  view.setUint32(4, exactPositiveU32(
    reactionCount,
    'reactionCount',
    MAX_EXACT_F32_INTEGER
  ), true);
  view.setUint32(8, REACTION_RECORD_VEC4S, true);
  view.setUint32(12, SCHROEDER_SPATIAL_SUPPORT_PROFILE_REACTION_DISCOVERY_V1, true);
  view.setFloat32(16, maximumContactRadiusM > 0
    ? finitePositive(maximumContactRadiusM, 'maximumContactRadiusM')
    : 0, true);
  view.setUint32(20, 16, true);
  view.setUint32(24, 3, true);
  view.setUint32(28, 2, true);
  view.setUint32(32, reactionRuleIndex.modeCode, true);
  view.setUint32(36, reactionRuleIndex.pairOffsetVec4s, true);
  view.setUint32(40, reactionRuleIndex.pairCount, true);
  view.setUint32(44, reactionRuleIndex.ruleOffsetVec4s, true);
  view.setUint32(48, reactionRuleIndex.ruleCount, true);
  view.setUint32(52, reactionRuleIndex.recordVec4Count, true);
  // The last word in the original 64-byte prefix now carries the exact sealed
  // thermal/phase/rest-volume writer latch. The diagnostic word remains off
  // the production hot path when evidence collection is disabled.
  view.setUint32(56, collectDiagnosticEvidence === true ? 1 : 0, true);
  view.setUint32(
    60,
    reactionMotionEnvelope?.thermalPhaseEvolutionEnabled === true ? 1 : 0,
    true
  );
  view.setUint32(
    64,
    reactionMotionEnvelope?.maxFutureSubsteps ?? 0,
    true
  );
  view.setUint32(
    68,
    reactionMotionEnvelope?.separationDisplacementEnabled === true ? 1 : 0,
    true
  );
  view.setUint32(
    72,
    reactionMotionEnvelope?.cflFactorF32Bits ?? 0,
    true
  );
  view.setUint32(
    76,
    reactionMotionEnvelope?.gridSpacingF32Bits ?? 0,
    true
  );
  view.setUint32(
    80,
    reactionMotionEnvelope?.boxDimsF32Bits?.[0] ?? 0,
    true
  );
  view.setUint32(
    84,
    reactionMotionEnvelope?.boxDimsF32Bits?.[1] ?? 0,
    true
  );
  view.setUint32(
    88,
    reactionMotionEnvelope?.boxDimsF32Bits?.[2] ?? 0,
    true
  );
  view.setUint32(
    92,
    reactionMotionEnvelope?.contactCorrectionEnabled === true ? 1 : 0,
    true
  );
  return data;
}

function createReactionDiscoveryProposalWgsl(directoryAbiVersion) {
  const directoryV2 =
    directoryAbiVersion === SCHROEDER_SPATIAL_EPOCH_V2_VERSION;
  if (
    !directoryV2
    && directoryAbiVersion !== SCHROEDER_SPATIAL_EPOCH_VERSION
  ) {
    throw new RangeError(
      `unsupported reaction discovery directory ABI version: ${
        directoryAbiVersion
      }`
    );
  }
  const exactNearTraversalWgsl = (
    directoryV2
      ? createSchroederSpatialExactNearTraversalV2Wgsl
      : createSchroederSpatialExactNearTraversalV1Wgsl
  )({
    directoryBindingName: 'spatial_directory'
  });
  const exactNearCellTreeTraversalWgsl = (
    directoryV2
      ? createSchroederSpatialExactNearCellTreeTraversalV2Wgsl
      : createSchroederSpatialExactNearCellTreeTraversalV1Wgsl
  )({
    treeBindingName: 'exact_near_cell_tree',
    directoryBindingName: 'spatial_directory'
  });
  const exactNearExpectationType = directoryV2
    ? 'SchroederSpatialExactNearExpectationV2'
    : 'SchroederSpatialExactNearExpectationV1';

  return /* wgsl */ `
struct ReactionDiscoveryParams {
  particle_count: u32,
  reaction_count: u32,
  reaction_record_stride_vec4s: u32,
  support_profile_id: u32,
  maximum_contact_radius_m: f32,
  active_node_stride_floats: u32,
  thermo_stride_vec4s: u32,
  state_stride_vec4s: u32,
  reaction_rule_index_mode: u32,
  reaction_rule_index_pair_offset_vec4s: u32,
  reaction_rule_index_pair_count: u32,
  reaction_rule_index_rule_offset_vec4s: u32,
  reaction_rule_index_rule_count: u32,
  reaction_rule_index_record_vec4_count: u32,
  collect_diagnostic_evidence: u32,
  activation_thermal_phase_evolution_enabled: u32,
  activation_max_future_substeps: u32,
  activation_separation_enabled: u32,
  activation_cfl_factor: f32,
  activation_grid_spacing_m: f32,
  activation_box_dim_x_m: f32,
  activation_box_dim_y_m: f32,
  activation_box_dim_z_m: f32,
  activation_contact_correction_enabled: u32,
};

@group(0) @binding(0) var<storage, read> source_state_authority: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> source_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> source_state: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> reaction_records: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> spatial_directory: array<u32>;
@group(0) @binding(5) var<storage, read> exact_near_cell_tree: array<u32>;
@group(0) @binding(6) var<storage, read_write> reaction_proposals: array<vec4<f32>>;
@group(0) @binding(7) var<storage, read_write> traversal_evidence: array<atomic<u32>>;
@group(0) @binding(8) var<uniform> spatial_expectation: ${exactNearExpectationType};
@group(0) @binding(9) var<uniform> params: ReactionDiscoveryParams;
@group(0) @binding(10) var<storage, read_write> reaction_activation_observation: array<atomic<u32>>;

${exactNearTraversalWgsl}
${exactNearCellTreeTraversalWgsl}
${sphReactionMotionEnvelopeWgsl}

const REACTION_DISCOVERY_INVALID_INDEX: f32 = -1.0;
const REACTION_DISCOVERY_MAX_F32: f32 = 3.402823e38;
const REACTION_DISCOVERY_CERTIFICATE_READY_BITS: u32 = 0x3f800000u;
const REACTION_DISCOVERY_CERTIFICATE_REJECTED_BITS: u32 = 0x40000000u;
const REACTION_DISCOVERY_RULE_INDEX_MODE_FULL_SCAN: u32 = 0u;
const REACTION_DISCOVERY_RULE_INDEX_MODE_MATERIAL_PAIR: u32 = 1u;
const REACTION_DISCOVERY_RULE_INDEX_RULES_PER_VEC4: u32 = 4u;
const REACTION_DISCOVERY_EVIDENCE_OVERFLOW: u32 = 15u;
const REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_PAIR_LOOKUPS: u32 = 16u;
const REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_PAIR_MISSES: u32 = 17u;
const REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_RULE_VISITS: u32 = 18u;
const REACTION_DISCOVERY_EVIDENCE_FULL_RULE_SCAN_VISITS: u32 = 19u;
const REACTION_DISCOVERY_EVIDENCE_MAXIMUM_DISPLACEMENT_BITS: u32 = 20u;
const REACTION_DISCOVERY_EVIDENCE_CERTIFICATE_STATUS_BITS: u32 = 21u;
const REACTION_DISCOVERY_EVIDENCE_AUTHORITY_ACTIVE_COUNT: u32 = 22u;
const REACTION_DISCOVERY_EVIDENCE_CURRENT_ACTIVE_COUNT: u32 = 23u;
const REACTION_DISCOVERY_EVIDENCE_TREE_NODE_VISITS: u32 = 24u;
const REACTION_DISCOVERY_EVIDENCE_TREE_LEAF_VISITS: u32 = 25u;
const REACTION_DISCOVERY_EVIDENCE_TREE_MEMBER_VISITS: u32 = 26u;
const REACTION_ACTIVATION_OBSERVATION_ENCODED_FAILURE: u32 = 0u;
const REACTION_ACTIVATION_OBSERVATION_COUNT_BIAS: u32 = 1u;
const REACTION_ACTIVATION_RESULT_WORD: u32 = 0u;
const REACTION_ACTIVATION_TRIGGERED_SOURCE_COUNT_WORD: u32 = 1u;
const REACTION_ACTIVATION_MAX_REST_DIAMETER_BITS_WORD: u32 = 2u;
const REACTION_ACTIVATION_FAILURE_WORD: u32 = 3u;

fn reaction_discovery_invalid_proposal() -> vec4<f32> {
  return vec4<f32>(
    REACTION_DISCOVERY_INVALID_INDEX,
    REACTION_DISCOVERY_INVALID_INDEX,
    0.0,
    REACTION_DISCOVERY_MAX_F32
  );
}

// This is the immediate path for completion and fail-closed counters. The
// candidate/tree diagnostics below are deliberately the only batched fields.
fn reaction_discovery_increment_control_counter(counter_index: u32) {
  let previous = atomicAdd(&traversal_evidence[counter_index], 1u);
  if (previous == 0xffffffffu) {
    atomicStore(&traversal_evidence[REACTION_DISCOVERY_EVIDENCE_OVERFLOW], 1u);
  }
}

// S9D_HOT_COUNTER_AGGREGATION_BEGIN
// These are invocation-private accumulators. They are observable only when
// requested, and never participate in traversal, rule selection, or sealing
// except to fail closed on an arithmetic overflow.
var<private> reaction_discovery_hot_candidate_visits: u32;
var<private> reaction_discovery_hot_compatible_pairs: u32;
var<private> reaction_discovery_hot_rule_index_pair_lookups: u32;
var<private> reaction_discovery_hot_rule_index_pair_misses: u32;
var<private> reaction_discovery_hot_rule_index_rule_visits: u32;
var<private> reaction_discovery_hot_full_rule_scan_visits: u32;
var<private> reaction_discovery_hot_tree_node_visits: u32;
var<private> reaction_discovery_hot_tree_leaf_visits: u32;
var<private> reaction_discovery_hot_tree_member_visits: u32;
var<private> reaction_discovery_hot_counter_overflow: u32;

fn reaction_discovery_reset_hot_counters() {
  reaction_discovery_hot_candidate_visits = 0u;
  reaction_discovery_hot_compatible_pairs = 0u;
  reaction_discovery_hot_rule_index_pair_lookups = 0u;
  reaction_discovery_hot_rule_index_pair_misses = 0u;
  reaction_discovery_hot_rule_index_rule_visits = 0u;
  reaction_discovery_hot_full_rule_scan_visits = 0u;
  reaction_discovery_hot_tree_node_visits = 0u;
  reaction_discovery_hot_tree_leaf_visits = 0u;
  reaction_discovery_hot_tree_member_visits = 0u;
  reaction_discovery_hot_counter_overflow = 0u;
}

fn reaction_discovery_increment_hot_counter(counter_index: u32) {
  if (
    params.collect_diagnostic_evidence == 0u
    || reaction_discovery_hot_counter_overflow != 0u
  ) {
    return;
  }
  switch (counter_index) {
    case 3u: {
      if (reaction_discovery_hot_candidate_visits == 0xffffffffu) {
        reaction_discovery_hot_counter_overflow = 1u;
      } else {
        reaction_discovery_hot_candidate_visits =
          reaction_discovery_hot_candidate_visits + 1u;
      }
    }
    case 4u: {
      if (reaction_discovery_hot_compatible_pairs == 0xffffffffu) {
        reaction_discovery_hot_counter_overflow = 1u;
      } else {
        reaction_discovery_hot_compatible_pairs =
          reaction_discovery_hot_compatible_pairs + 1u;
      }
    }
    case REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_PAIR_LOOKUPS: {
      if (reaction_discovery_hot_rule_index_pair_lookups == 0xffffffffu) {
        reaction_discovery_hot_counter_overflow = 1u;
      } else {
        reaction_discovery_hot_rule_index_pair_lookups =
          reaction_discovery_hot_rule_index_pair_lookups + 1u;
      }
    }
    case REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_PAIR_MISSES: {
      if (reaction_discovery_hot_rule_index_pair_misses == 0xffffffffu) {
        reaction_discovery_hot_counter_overflow = 1u;
      } else {
        reaction_discovery_hot_rule_index_pair_misses =
          reaction_discovery_hot_rule_index_pair_misses + 1u;
      }
    }
    case REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_RULE_VISITS: {
      if (reaction_discovery_hot_rule_index_rule_visits == 0xffffffffu) {
        reaction_discovery_hot_counter_overflow = 1u;
      } else {
        reaction_discovery_hot_rule_index_rule_visits =
          reaction_discovery_hot_rule_index_rule_visits + 1u;
      }
    }
    case REACTION_DISCOVERY_EVIDENCE_FULL_RULE_SCAN_VISITS: {
      if (reaction_discovery_hot_full_rule_scan_visits == 0xffffffffu) {
        reaction_discovery_hot_counter_overflow = 1u;
      } else {
        reaction_discovery_hot_full_rule_scan_visits =
          reaction_discovery_hot_full_rule_scan_visits + 1u;
      }
    }
    case REACTION_DISCOVERY_EVIDENCE_TREE_NODE_VISITS: {
      if (reaction_discovery_hot_tree_node_visits == 0xffffffffu) {
        reaction_discovery_hot_counter_overflow = 1u;
      } else {
        reaction_discovery_hot_tree_node_visits =
          reaction_discovery_hot_tree_node_visits + 1u;
      }
    }
    case REACTION_DISCOVERY_EVIDENCE_TREE_LEAF_VISITS: {
      if (reaction_discovery_hot_tree_leaf_visits == 0xffffffffu) {
        reaction_discovery_hot_counter_overflow = 1u;
      } else {
        reaction_discovery_hot_tree_leaf_visits =
          reaction_discovery_hot_tree_leaf_visits + 1u;
      }
    }
    case REACTION_DISCOVERY_EVIDENCE_TREE_MEMBER_VISITS: {
      if (reaction_discovery_hot_tree_member_visits == 0xffffffffu) {
        reaction_discovery_hot_counter_overflow = 1u;
      } else {
        reaction_discovery_hot_tree_member_visits =
          reaction_discovery_hot_tree_member_visits + 1u;
      }
    }
    default: {}
  }
}

fn reaction_discovery_flush_hot_counter(counter_index: u32, count: u32) -> bool {
  if (count == 0u) {
    return true;
  }
  let previous = atomicAdd(&traversal_evidence[counter_index], count);
  return previous <= 0xffffffffu - count;
}

fn reaction_discovery_flush_hot_counters() -> bool {
  if (params.collect_diagnostic_evidence == 0u) {
    return true;
  }
  let candidate_visits_admitted = reaction_discovery_flush_hot_counter(
    3u,
    reaction_discovery_hot_candidate_visits
  );
  let compatible_pairs_admitted = reaction_discovery_flush_hot_counter(
    4u,
    reaction_discovery_hot_compatible_pairs
  );
  let pair_lookups_admitted = reaction_discovery_flush_hot_counter(
    REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_PAIR_LOOKUPS,
    reaction_discovery_hot_rule_index_pair_lookups
  );
  let pair_misses_admitted = reaction_discovery_flush_hot_counter(
    REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_PAIR_MISSES,
    reaction_discovery_hot_rule_index_pair_misses
  );
  let rule_visits_admitted = reaction_discovery_flush_hot_counter(
    REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_RULE_VISITS,
    reaction_discovery_hot_rule_index_rule_visits
  );
  let full_scan_visits_admitted = reaction_discovery_flush_hot_counter(
    REACTION_DISCOVERY_EVIDENCE_FULL_RULE_SCAN_VISITS,
    reaction_discovery_hot_full_rule_scan_visits
  );
  let tree_node_visits_admitted = reaction_discovery_flush_hot_counter(
    REACTION_DISCOVERY_EVIDENCE_TREE_NODE_VISITS,
    reaction_discovery_hot_tree_node_visits
  );
  let tree_leaf_visits_admitted = reaction_discovery_flush_hot_counter(
    REACTION_DISCOVERY_EVIDENCE_TREE_LEAF_VISITS,
    reaction_discovery_hot_tree_leaf_visits
  );
  let tree_member_visits_admitted = reaction_discovery_flush_hot_counter(
    REACTION_DISCOVERY_EVIDENCE_TREE_MEMBER_VISITS,
    reaction_discovery_hot_tree_member_visits
  );
  if (
    reaction_discovery_hot_counter_overflow != 0u
    || !candidate_visits_admitted
    || !compatible_pairs_admitted
    || !pair_lookups_admitted
    || !pair_misses_admitted
    || !rule_visits_admitted
    || !full_scan_visits_admitted
    || !tree_node_visits_admitted
    || !tree_leaf_visits_admitted
    || !tree_member_visits_admitted
  ) {
    atomicStore(&traversal_evidence[REACTION_DISCOVERY_EVIDENCE_OVERFLOW], 1u);
    return false;
  }
  return true;
}

fn reaction_discovery_increment_counter(counter_index: u32) {
  if (
    counter_index == 3u
    || counter_index == 4u
    || counter_index == REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_PAIR_LOOKUPS
    || counter_index == REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_PAIR_MISSES
    || counter_index == REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_RULE_VISITS
    || counter_index == REACTION_DISCOVERY_EVIDENCE_FULL_RULE_SCAN_VISITS
    || counter_index == REACTION_DISCOVERY_EVIDENCE_TREE_NODE_VISITS
    || counter_index == REACTION_DISCOVERY_EVIDENCE_TREE_LEAF_VISITS
    || counter_index == REACTION_DISCOVERY_EVIDENCE_TREE_MEMBER_VISITS
  ) {
    reaction_discovery_increment_hot_counter(counter_index);
    return;
  }
  reaction_discovery_increment_control_counter(counter_index);
}
// S9D_HOT_COUNTER_AGGREGATION_END

fn reaction_discovery_source_row_admitted(source_index: u32) -> bool {
  let offset = source_index * params.state_stride_vec4s;
  if (
    offset >= arrayLength(&source_state_authority)
    || offset >= arrayLength(&source_state)
  ) {
    return false;
  }
  let authority_position_mass = source_state_authority[offset];
  let current_position_mass = source_state[offset];
  return all(vec3<bool>(
      ss_exact_near_finite(authority_position_mass.x),
      ss_exact_near_finite(authority_position_mass.y),
      ss_exact_near_finite(authority_position_mass.z)
    ))
    && all(vec3<bool>(
      ss_exact_near_finite(current_position_mass.x),
      ss_exact_near_finite(current_position_mass.y),
      ss_exact_near_finite(current_position_mass.z)
    ))
    && ss_exact_near_finite(authority_position_mass.w)
    && ss_exact_near_finite(current_position_mass.w);
}

fn reaction_discovery_position(source_index: u32) -> vec3<f32> {
  return source_state[source_index * params.state_stride_vec4s].xyz;
}

fn reaction_discovery_thermo0(source_index: u32) -> vec4<f32> {
  return source_thermo[source_index * params.thermo_stride_vec4s];
}

fn reaction_discovery_mass(source_index: u32) -> f32 {
  return source_state[source_index * params.state_stride_vec4s].w;
}

fn reaction_discovery_phase_mask_satisfied(mask_f: f32, phase_id_f: f32) -> bool {
  if (
    !ss_exact_near_finite(mask_f)
    || !ss_exact_near_finite(phase_id_f)
    || mask_f < 0.0
    || phase_id_f < 0.0
  ) {
    return false;
  }
  let mask = u32(mask_f + 0.5);
  if (mask == 0u) {
    return true;
  }
  let phase_id = u32(phase_id_f + 0.5);
  return phase_id < 31u && (mask & (1u << phase_id)) != 0u;
}

// One invocation authenticates one source row. Non-negative finite f32 bit
// patterns preserve numeric order as u32, so atomicMax is an exact parallel
// reduction for the maximum displacement. Dispatch ordering makes the sealed
// certificate visible to the traversal without a host fence or readback.
@compute @workgroup_size(${WORKGROUP_SIZE})
fn prepare_displacement_certificate(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let source_index = global_id.x;
  if (
    source_index >= params.particle_count
    || arrayLength(&traversal_evidence)
      < REACTION_DISCOVERY_EVIDENCE_TREE_MEMBER_VISITS + 1u
  ) {
    return;
  }
  if (!reaction_discovery_source_row_admitted(source_index)) {
    atomicStore(
      &traversal_evidence[REACTION_DISCOVERY_EVIDENCE_CERTIFICATE_STATUS_BITS],
      REACTION_DISCOVERY_CERTIFICATE_REJECTED_BITS
    );
    return;
  }
  let offset = source_index * params.state_stride_vec4s;
  let authority_position_mass = source_state_authority[offset];
  let current_position_mass = source_state[offset];
  let source_active = authority_position_mass.w > 0.0;
  let current_active = current_position_mass.w > 0.0;
  atomicAdd(
    &traversal_evidence[REACTION_DISCOVERY_EVIDENCE_AUTHORITY_ACTIVE_COUNT],
    select(0u, 1u, source_active)
  );
  atomicAdd(
    &traversal_evidence[REACTION_DISCOVERY_EVIDENCE_CURRENT_ACTIVE_COUNT],
    select(0u, 1u, current_active)
  );
  if (source_active != current_active) {
    atomicStore(
      &traversal_evidence[REACTION_DISCOVERY_EVIDENCE_CERTIFICATE_STATUS_BITS],
      REACTION_DISCOVERY_CERTIFICATE_REJECTED_BITS
    );
    return;
  }
  if (!source_active) {
    return;
  }
  let displacement_m = length(
    current_position_mass.xyz - authority_position_mass.xyz
  );
  if (!ss_exact_near_finite(displacement_m) || displacement_m < 0.0) {
    atomicStore(
      &traversal_evidence[REACTION_DISCOVERY_EVIDENCE_CERTIFICATE_STATUS_BITS],
      REACTION_DISCOVERY_CERTIFICATE_REJECTED_BITS
    );
    return;
  }
  atomicMax(
    &traversal_evidence[REACTION_DISCOVERY_EVIDENCE_MAXIMUM_DISPLACEMENT_BITS],
    bitcast<u32>(displacement_m)
  );
}

struct ReactionRuleIndexInteger {
  admitted: u32,
  value: u32,
};

struct ReactionRuleIndexLookup {
  indexed: u32,
  found: u32,
  rule_begin: u32,
  rule_count: u32,
};

fn reaction_discovery_rule_index_integer(value: f32) -> ReactionRuleIndexInteger {
  if (
    !ss_exact_near_finite(value)
    || value < 0.0
    || value > 16777215.0
    || floor(value) != value
  ) {
    return ReactionRuleIndexInteger(0u, 0u);
  }
  return ReactionRuleIndexInteger(1u, u32(value));
}

fn reaction_discovery_rule_index_available() -> bool {
  if (
    params.reaction_rule_index_mode
      != REACTION_DISCOVERY_RULE_INDEX_MODE_MATERIAL_PAIR
    || params.reaction_rule_index_record_vec4_count
      > arrayLength(&reaction_records)
  ) {
    return false;
  }
  let reaction_prefix_vec4s =
    params.reaction_count * params.reaction_record_stride_vec4s;
  if (
    params.reaction_rule_index_pair_offset_vec4s < reaction_prefix_vec4s
    || params.reaction_rule_index_pair_offset_vec4s
      > params.reaction_rule_index_rule_offset_vec4s
    || params.reaction_rule_index_pair_count
      > params.reaction_rule_index_rule_offset_vec4s
        - params.reaction_rule_index_pair_offset_vec4s
    || params.reaction_rule_index_rule_count > 0xfffffffcu
  ) {
    return false;
  }
  let rule_vec4_count = (
    params.reaction_rule_index_rule_count
      + (REACTION_DISCOVERY_RULE_INDEX_RULES_PER_VEC4 - 1u)
  ) / REACTION_DISCOVERY_RULE_INDEX_RULES_PER_VEC4;
  return params.reaction_rule_index_rule_offset_vec4s
      <= params.reaction_rule_index_record_vec4_count
    && rule_vec4_count
      <= params.reaction_rule_index_record_vec4_count
        - params.reaction_rule_index_rule_offset_vec4s;
}

fn reaction_discovery_pair_less(
  left_lo: f32,
  left_hi: f32,
  right_lo: f32,
  right_hi: f32
) -> bool {
  return left_lo < right_lo || (left_lo == right_lo && left_hi < right_hi);
}

fn reaction_discovery_rule_index_lookup(
  self_material: f32,
  other_material: f32
) -> ReactionRuleIndexLookup {
  if (
    !reaction_discovery_rule_index_available()
    || !ss_exact_near_finite(self_material)
    || !ss_exact_near_finite(other_material)
  ) {
    return ReactionRuleIndexLookup(0u, 0u, 0u, 0u);
  }
  let material_lo = min(self_material, other_material);
  let material_hi = max(self_material, other_material);
  var lower = 0u;
  var upper = params.reaction_rule_index_pair_count;
  var iteration = 0u;
  loop {
    if (lower >= upper || iteration >= params.reaction_rule_index_pair_count) {
      break;
    }
    let middle = lower + (upper - lower) / 2u;
    let entry = reaction_records[
      params.reaction_rule_index_pair_offset_vec4s + middle
    ];
    if (
      !ss_exact_near_finite(entry.x)
      || !ss_exact_near_finite(entry.y)
      || entry.x >= entry.y
    ) {
      return ReactionRuleIndexLookup(0u, 0u, 0u, 0u);
    }
    if (reaction_discovery_pair_less(entry.x, entry.y, material_lo, material_hi)) {
      lower = middle + 1u;
    } else {
      upper = middle;
    }
    iteration = iteration + 1u;
  }
  if (lower >= params.reaction_rule_index_pair_count) {
    return ReactionRuleIndexLookup(1u, 0u, 0u, 0u);
  }
  let entry = reaction_records[
    params.reaction_rule_index_pair_offset_vec4s + lower
  ];
  if (
    !ss_exact_near_finite(entry.x)
    || !ss_exact_near_finite(entry.y)
    || entry.x >= entry.y
  ) {
    return ReactionRuleIndexLookup(0u, 0u, 0u, 0u);
  }
  if (entry.x != material_lo || entry.y != material_hi) {
    return ReactionRuleIndexLookup(1u, 0u, 0u, 0u);
  }
  let rule_begin = reaction_discovery_rule_index_integer(entry.z);
  let rule_count = reaction_discovery_rule_index_integer(entry.w);
  if (
    rule_begin.admitted == 0u
    || rule_count.admitted == 0u
    || rule_count.value == 0u
    || rule_begin.value > params.reaction_rule_index_rule_count
    || rule_count.value
      > params.reaction_rule_index_rule_count - rule_begin.value
  ) {
    return ReactionRuleIndexLookup(0u, 0u, 0u, 0u);
  }
  return ReactionRuleIndexLookup(
    1u,
    1u,
    rule_begin.value,
    rule_count.value
  );
}

fn reaction_discovery_rule_index_rule_at(
  rule_offset: u32
) -> ReactionRuleIndexInteger {
  let row = reaction_records[
    params.reaction_rule_index_rule_offset_vec4s
      + rule_offset / REACTION_DISCOVERY_RULE_INDEX_RULES_PER_VEC4
  ];
  let lane = rule_offset % REACTION_DISCOVERY_RULE_INDEX_RULES_PER_VEC4;
  var value = row.x;
  if (lane == 1u) {
    value = row.y;
  } else if (lane == 2u) {
    value = row.z;
  } else if (lane == 3u) {
    value = row.w;
  }
  return reaction_discovery_rule_index_integer(value);
}

fn reaction_discovery_consider_reaction(
  self_index: u32,
  other_index: u32,
  self_material: f32,
  other_material: f32,
  self_thermo0: vec4<f32>,
  other_thermo0: vec4<f32>,
  distance_squared: f32,
  reaction_index: u32,
  best: ptr<function, vec4<f32>>
) {
  if (reaction_index >= params.reaction_count) {
    return;
  }
  let reaction_base = reaction_index * params.reaction_record_stride_vec4s;
  let row0 = reaction_records[reaction_base];
  let row1 = reaction_records[reaction_base + 1u];
  let row2 = reaction_records[reaction_base + 2u];
  if (row2.x != 1.0 || !ss_exact_near_finite(row1.y) || row1.y <= 0.0) {
    return;
  }
  if (
    !all(vec4<bool>(
      ss_exact_near_finite(self_thermo0.x),
      ss_exact_near_finite(self_thermo0.y),
      ss_exact_near_finite(self_thermo0.z),
      ss_exact_near_finite(other_thermo0.x)
    ))
    || !ss_exact_near_finite(other_thermo0.y)
    || !ss_exact_near_finite(other_thermo0.z)
    || !ss_exact_near_finite(row0.w)
    || !ss_exact_near_finite(row1.z)
    || !ss_exact_near_finite(row1.w)
    || row0.x == row0.y
  ) {
    return;
  }
  var role = 0.0;
  var self_phase_mask = 0.0;
  var other_phase_mask = 0.0;
  if (self_material == row0.x && other_material == row0.y) {
    role = 1.0;
    self_phase_mask = row1.z;
    other_phase_mask = row1.w;
  } else if (self_material == row0.y && other_material == row0.x) {
    role = 2.0;
    self_phase_mask = row1.w;
    other_phase_mask = row1.z;
  } else {
    return;
  }
  if (
    !reaction_discovery_phase_mask_satisfied(self_phase_mask, self_thermo0.y)
    || !reaction_discovery_phase_mask_satisfied(other_phase_mask, other_thermo0.y)
    || max(self_thermo0.z, other_thermo0.z) < row0.w
  ) {
    return;
  }
  if (distance_squared > row1.y * row1.y) {
    return;
  }
  reaction_discovery_increment_counter(4u);
  let current_partner = select(0xffffffffu, u32((*best).x + 0.5), (*best).x >= 0.0);
  let current_reaction = select(0xffffffffu, u32((*best).y + 0.5), (*best).y >= 0.0);
  if (
    distance_squared < (*best).w
    || (
      distance_squared == (*best).w
      && (
        other_index < current_partner
        || (other_index == current_partner && reaction_index < current_reaction)
      )
    )
  ) {
    *best = vec4<f32>(
      f32(other_index),
      f32(reaction_index),
      role,
      distance_squared
    );
  }
}

fn reaction_discovery_consider_all_reactions(
  self_index: u32,
  other_index: u32,
  self_material: f32,
  other_material: f32,
  self_thermo0: vec4<f32>,
  other_thermo0: vec4<f32>,
  distance_squared: f32,
  best: ptr<function, vec4<f32>>
) {
  for (
    var reaction_index = 0u;
    reaction_index < params.reaction_count;
    reaction_index = reaction_index + 1u
  ) {
    reaction_discovery_increment_counter(
      REACTION_DISCOVERY_EVIDENCE_FULL_RULE_SCAN_VISITS
    );
    reaction_discovery_consider_reaction(
      self_index,
      other_index,
      self_material,
      other_material,
      self_thermo0,
      other_thermo0,
      distance_squared,
      reaction_index,
      best
    );
  }
}

fn reaction_discovery_consider_indexed_reactions(
  self_index: u32,
  other_index: u32,
  self_material: f32,
  other_material: f32,
  self_thermo0: vec4<f32>,
  other_thermo0: vec4<f32>,
  distance_squared: f32,
  lookup: ReactionRuleIndexLookup,
  best: ptr<function, vec4<f32>>
) {
  var previous_reaction_index = 0u;
  for (
    var rule_ordinal = 0u;
    rule_ordinal < lookup.rule_count;
    rule_ordinal = rule_ordinal + 1u
  ) {
    let decoded = reaction_discovery_rule_index_rule_at(
      lookup.rule_begin + rule_ordinal
    );
    if (
      decoded.admitted == 0u
      || decoded.value >= params.reaction_count
      || (rule_ordinal > 0u && decoded.value <= previous_reaction_index)
    ) {
      reaction_discovery_consider_all_reactions(
        self_index,
        other_index,
        self_material,
        other_material,
        self_thermo0,
        other_thermo0,
        distance_squared,
        best
      );
      return;
    }
    previous_reaction_index = decoded.value;
  }
  for (
    var rule_ordinal = 0u;
    rule_ordinal < lookup.rule_count;
    rule_ordinal = rule_ordinal + 1u
  ) {
    let reaction_index = reaction_discovery_rule_index_rule_at(
      lookup.rule_begin + rule_ordinal
    ).value;
    reaction_discovery_increment_counter(
      REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_RULE_VISITS
    );
    reaction_discovery_consider_reaction(
      self_index,
      other_index,
      self_material,
      other_material,
      self_thermo0,
      other_thermo0,
      distance_squared,
      reaction_index,
      best
    );
  }
}

fn reaction_discovery_consider_pair(
  self_index: u32,
  other_index: u32,
  self_material: f32,
  self_position: vec3<f32>,
  best: ptr<function, vec4<f32>>
) {
  if (other_index == self_index || other_index >= params.particle_count) {
    return;
  }
  reaction_discovery_increment_counter(3u);
  if (!reaction_discovery_source_row_admitted(other_index)) {
    reaction_discovery_increment_control_counter(8u);
    return;
  }
  if (reaction_discovery_mass(other_index) <= 0.0) {
    return;
  }
  let self_thermo0 = reaction_discovery_thermo0(self_index);
  let other_thermo0 = reaction_discovery_thermo0(other_index);
  let other_material = other_thermo0.x;
  let other_position = reaction_discovery_position(other_index);
  let displacement = self_position - other_position;
  let distance_squared = dot(displacement, displacement);
  if (!ss_exact_near_finite(distance_squared)) {
    reaction_discovery_increment_control_counter(5u);
    return;
  }
  let lookup = reaction_discovery_rule_index_lookup(
    self_material,
    other_material
  );
  if (lookup.indexed != 0u) {
    reaction_discovery_increment_counter(
      REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_PAIR_LOOKUPS
    );
    if (lookup.found == 0u) {
      reaction_discovery_increment_counter(
        REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_PAIR_MISSES
      );
      return;
    }
    reaction_discovery_consider_indexed_reactions(
      self_index,
      other_index,
      self_material,
      other_material,
      self_thermo0,
      other_thermo0,
      distance_squared,
      lookup,
      best
    );
    return;
  }
  reaction_discovery_consider_all_reactions(
    self_index,
    other_index,
    self_material,
    other_material,
    self_thermo0,
    other_thermo0,
    distance_squared,
    best
  );
}

@compute @workgroup_size(${WORKGROUP_SIZE})
fn propose(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }
  reaction_proposals[particle_index] = reaction_discovery_invalid_proposal();
  reaction_discovery_reset_hot_counters();
  atomicAdd(&traversal_evidence[0u], 1u);
  if (
    spatial_expectation.support_profile_id != params.support_profile_id
    || !ss_exact_near_directory_admitted(spatial_expectation)
    || !ss_exact_cell_tree_admitted(spatial_expectation)
    || arrayLength(&traversal_evidence)
      < REACTION_DISCOVERY_EVIDENCE_TREE_MEMBER_VISITS + 1u
    || atomicLoad(
      &traversal_evidence[REACTION_DISCOVERY_EVIDENCE_CERTIFICATE_STATUS_BITS]
    )
      != REACTION_DISCOVERY_CERTIFICATE_READY_BITS
  ) {
    atomicAdd(&traversal_evidence[2u], 1u);
    return;
  }
  atomicAdd(&traversal_evidence[1u], 1u);
  if (
    arrayLength(&source_thermo) < params.particle_count * params.thermo_stride_vec4s
    || arrayLength(&source_state) < params.particle_count * params.state_stride_vec4s
    || arrayLength(&reaction_records)
      < params.reaction_count * params.reaction_record_stride_vec4s
    || !reaction_discovery_source_row_admitted(particle_index)
  ) {
    reaction_discovery_increment_control_counter(8u);
    return;
  }
  if (reaction_discovery_mass(particle_index) <= 0.0) {
    return;
  }
  if (
    !ss_exact_near_finite(params.maximum_contact_radius_m)
    || params.maximum_contact_radius_m < 0.0
  ) {
    reaction_discovery_increment_control_counter(5u);
    return;
  }
  if (params.maximum_contact_radius_m == 0.0) {
    return;
  }

  let self_position = reaction_discovery_position(particle_index);
  let self_material = reaction_discovery_thermo0(particle_index).x;
  let certified_search_radius_m = params.maximum_contact_radius_m
    + max(bitcast<f32>(atomicLoad(
      &traversal_evidence[REACTION_DISCOVERY_EVIDENCE_MAXIMUM_DISPLACEMENT_BITS]
    )), 0.0);
  if (!ss_exact_near_finite(certified_search_radius_m)) {
    reaction_discovery_increment_control_counter(5u);
    return;
  }
  var best = reaction_discovery_invalid_proposal();
  var malformed = false;

  let query_extent = vec3<f32>(certified_search_radius_m);
  let query_minimum = self_position - query_extent;
  let query_maximum = self_position + query_extent;
  let tree_cell_count = exact_near_cell_tree[18u];
  let tree_leaf_capacity = exact_near_cell_tree[20u];
  let tree_leaf_offset = tree_leaf_capacity - 1u;
  let tree_node_capacity = exact_near_cell_tree[21u];
  let tree_depth = exact_near_cell_tree[23u];
  // This is a complete-tree-depth proof, not a per-source candidate budget.
  // The builder rejects depths above 30, so all pending siblings fit here.
  var node_stack: array<u32, 32>;
  var stack_count = 0u;
  if (
    tree_node_capacity == 0u
    || tree_depth >= 32u
    || !ss_exact_near_finite(query_minimum.x)
    || !ss_exact_near_finite(query_minimum.y)
    || !ss_exact_near_finite(query_minimum.z)
    || !ss_exact_near_finite(query_maximum.x)
    || !ss_exact_near_finite(query_maximum.y)
    || !ss_exact_near_finite(query_maximum.z)
    || !all(query_minimum <= query_maximum)
  ) {
    malformed = true;
  } else {
    node_stack[0u] = 0u;
    stack_count = 1u;
    for (
      var node_iteration = 0u;
      node_iteration < tree_node_capacity && stack_count > 0u;
      node_iteration = node_iteration + 1u
    ) {
      stack_count = stack_count - 1u;
      let node_index = node_stack[stack_count];
      if (node_index >= tree_node_capacity) {
        malformed = true;
        break;
      }
      reaction_discovery_increment_counter(
        REACTION_DISCOVERY_EVIDENCE_TREE_NODE_VISITS
      );
      if (!ss_exact_cell_tree_node_intersects(
        node_index,
        query_minimum,
        query_maximum
      )) {
        continue;
      }
      if (ss_exact_cell_tree_node_is_leaf(node_index)) {
        reaction_discovery_increment_counter(
          REACTION_DISCOVERY_EVIDENCE_TREE_LEAF_VISITS
        );
        let cell_index = ss_exact_cell_tree_leaf_cell_index(node_index);
        if (
          node_index < tree_leaf_offset
          || cell_index >= tree_cell_count
          || cell_index >= spatial_expectation.expected_cell_capacity
        ) {
          malformed = true;
          break;
        }
        let member_range = ss_exact_near_cell_member_range(
          spatial_expectation,
          cell_index
        );
        if (member_range.admitted == 0u) {
          malformed = true;
          break;
        }
        for (
          var member_offset = member_range.begin;
          member_offset < member_range.end;
          member_offset = member_offset + 1u
        ) {
          reaction_discovery_increment_counter(
            REACTION_DISCOVERY_EVIDENCE_TREE_MEMBER_VISITS
          );
          let lookup = ss_exact_near_source_at_member(
            spatial_expectation,
            member_offset
          );
          if (lookup.admitted == 0u) {
            malformed = true;
            break;
          }
          reaction_discovery_consider_pair(
            particle_index,
            lookup.source_index,
            self_material,
            self_position,
            &best
          );
        }
        if (malformed) {
          break;
        }
        continue;
      }
      if (
        node_index >= tree_leaf_offset
        || !ss_exact_cell_tree_node_is_internal(node_index)
      ) {
        malformed = true;
        break;
      }
      let left_child = node_index * 2u + 1u;
      let right_child = left_child + 1u;
      if (
        right_child >= tree_node_capacity
        || stack_count + 2u > 32u
      ) {
        malformed = true;
        break;
      }
      // Right then left preserves complete-tree canonical leaf order.
      node_stack[stack_count] = right_child;
      node_stack[stack_count + 1u] = left_child;
      stack_count = stack_count + 2u;
    }
    if (stack_count != 0u) {
      malformed = true;
    }
  }

  if (!reaction_discovery_flush_hot_counters()) {
    malformed = true;
  }
  if (malformed) {
    reaction_discovery_increment_control_counter(5u);
    return;
  }
  if (best.x >= 0.0 && best.y >= 0.0) {
    reaction_proposals[particle_index] = best;
    reaction_discovery_increment_counter(6u);
  }
}

// This second dispatch performs no lookup. It turns any directory, source, or
// traversal rejection into a complete invalid proposal set before a later
// chemistry kernel can observe the artifact.
@compute @workgroup_size(${WORKGROUP_SIZE})
fn seal(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }
  let fail_closed = atomicLoad(&traversal_evidence[2u]) != 0u
    || atomicLoad(&traversal_evidence[5u]) != 0u
    || atomicLoad(&traversal_evidence[8u]) != 0u
    || atomicLoad(&traversal_evidence[REACTION_DISCOVERY_EVIDENCE_OVERFLOW]) != 0u
    || atomicLoad(&traversal_evidence[0u]) != params.particle_count
    || atomicLoad(&traversal_evidence[1u]) != params.particle_count;
  if (fail_closed) {
    reaction_proposals[particle_index] = reaction_discovery_invalid_proposal();
  }
  reaction_discovery_increment_counter(7u);
}

fn reaction_activation_fail_closed() {
  atomicOr(
    &reaction_activation_observation[REACTION_ACTIVATION_FAILURE_WORD],
    0x80000000u
  );
}

fn reaction_activation_source_row_admitted(source_index: u32) -> bool {
  let state_offset = source_index * params.state_stride_vec4s;
  let thermo_offset = source_index * params.thermo_stride_vec4s;
  if (
    state_offset + 1u >= arrayLength(&source_state)
    || thermo_offset + 2u >= arrayLength(&source_thermo)
  ) {
    return false;
  }
  for (var row = 0u; row < 2u; row = row + 1u) {
    if (!reaction_motion_vec4_finite(source_state[state_offset + row])) {
      return false;
    }
  }
  for (var row = 0u; row < 3u; row = row + 1u) {
    if (!reaction_motion_vec4_finite(source_thermo[thermo_offset + row])) {
      return false;
    }
  }
  // The mutation shader's wildcard phase mask bypasses phase conversion.
  // Refuse a negative phase here so the watch cannot seal a false zero.
  return source_thermo[thermo_offset].y >= 0.0;
}

// Binding 0 is intentionally rebound to the terminal mechanics family for
// this entry point. The declaration is a raw vec4 array, so the exact same
// shader module can retain the canonical position authority for proposal
// production while the watch-only pipeline certifies row4.w rest volumes.
@compute @workgroup_size(${WORKGROUP_SIZE})
fn prepare_activation_motion_bounds(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let source_index = global_id.x;
  if (source_index >= params.particle_count) {
    return;
  }
  if (
    arrayLength(&reaction_activation_observation) < 4u
    || params.activation_max_future_substeps == 0u
    || !reaction_motion_finite(params.activation_cfl_factor)
    || !(params.activation_cfl_factor > 0.0)
    || !reaction_motion_finite(params.activation_grid_spacing_m)
    || !(params.activation_grid_spacing_m > 0.0)
    || params.activation_separation_enabled > 1u
    || params.activation_contact_correction_enabled > 1u
    || params.activation_thermal_phase_evolution_enabled > 1u
    || !reaction_motion_box_dims_admitted(vec3<f32>(
      params.activation_box_dim_x_m,
      params.activation_box_dim_y_m,
      params.activation_box_dim_z_m
    ))
    || arrayLength(&source_state_authority) < params.particle_count * 8u
    || !reaction_activation_source_row_admitted(source_index)
  ) {
    reaction_activation_fail_closed();
    return;
  }
  let mechanics_offset = source_index * 8u;
  for (var row = 0u; row < 8u; row = row + 1u) {
    if (!reaction_motion_vec4_finite(
      source_state_authority[mechanics_offset + row]
    )) {
      reaction_activation_fail_closed();
      return;
    }
  }
  let position_mass = source_state[
    source_index * params.state_stride_vec4s
  ];
  if (position_mass.w <= 0.0) {
    return;
  }
  if (!reaction_motion_position_inside_box(
    position_mass.xyz,
    vec3<f32>(
      params.activation_box_dim_x_m,
      params.activation_box_dim_y_m,
      params.activation_box_dim_z_m
    )
  )) {
    reaction_activation_fail_closed();
    return;
  }
  if (
    params.activation_separation_enabled == 0u
    && params.activation_contact_correction_enabled == 0u
  ) {
    return;
  }
  let rest_volume_m3 = source_state_authority[source_index * 8u + 4u].w;
  let diameter_m = reaction_motion_rest_diameter_upper(rest_volume_m3);
  if (!(diameter_m > 0.0) || !reaction_motion_finite(diameter_m)) {
    reaction_activation_fail_closed();
    return;
  }
  atomicMax(
    &reaction_activation_observation[
      REACTION_ACTIVATION_MAX_REST_DIAMETER_BITS_WORD
    ],
    bitcast<u32>(diameter_m)
  );
}

fn reaction_activation_pair_triggered(
  self_index: u32,
  other_index: u32,
  relative_reach_m: f32
) -> bool {
  if (other_index == self_index || other_index >= params.particle_count) {
    return false;
  }
  if (!reaction_activation_source_row_admitted(other_index)) {
    reaction_activation_fail_closed();
    return false;
  }
  let other_position_mass = source_state[
    other_index * params.state_stride_vec4s
  ];
  if (other_position_mass.w <= 0.0) {
    return false;
  }
  let self_position_mass = source_state[
    self_index * params.state_stride_vec4s
  ];
  let self_thermo0 = source_thermo[
    self_index * params.thermo_stride_vec4s
  ];
  let other_thermo0 = source_thermo[
    other_index * params.thermo_stride_vec4s
  ];
  let distance_m = length(self_position_mass.xyz - other_position_mass.xyz);
  if (!reaction_motion_finite(distance_m)) {
    reaction_activation_fail_closed();
    return false;
  }
  for (
    var reaction_index = 0u;
    reaction_index < params.reaction_count;
    reaction_index = reaction_index + 1u
  ) {
    let reaction_base = reaction_index
      * params.reaction_record_stride_vec4s;
    let row0 = reaction_records[reaction_base];
    let row1 = reaction_records[reaction_base + 1u];
    let row2 = reaction_records[reaction_base + 2u];
    if (row2.x != 1.0) {
      continue;
    }
    if (
      !all(vec4<bool>(
        reaction_motion_finite(row0.x),
        reaction_motion_finite(row0.y),
        reaction_motion_finite(row0.z),
        reaction_motion_finite(row0.w)
      ))
      || !all(vec4<bool>(
        reaction_motion_finite(row1.x),
        reaction_motion_finite(row1.y),
        reaction_motion_finite(row1.z),
        reaction_motion_finite(row1.w)
      ))
      || !reaction_motion_finite(row2.x)
      || row0.x == row0.y
    ) {
      reaction_activation_fail_closed();
      continue;
    }
    // A ready zero-radius rule cannot mutate. Match the dedicated watcher by
    // treating it as a deterministic non-match instead of malformed input.
    if (!(row1.y > 0.0)) {
      continue;
    }
    var self_phase_mask = 0.0;
    var other_phase_mask = 0.0;
    if (self_thermo0.x == row0.x && other_thermo0.x == row0.y) {
      self_phase_mask = row1.z;
      other_phase_mask = row1.w;
    } else if (
      self_thermo0.x == row0.y && other_thermo0.x == row0.x
    ) {
      self_phase_mask = row1.w;
      other_phase_mask = row1.z;
    } else {
      continue;
    }
    if (
      !reaction_discovery_phase_mask_satisfied(
        self_phase_mask,
        self_thermo0.y
      )
      || !reaction_discovery_phase_mask_satisfied(
        other_phase_mask,
        other_thermo0.y
      )
      || max(self_thermo0.z, other_thermo0.z) < row0.w
    ) {
      continue;
    }
    let expanded_radius_m = reaction_motion_upward(
      row1.y + relative_reach_m
    );
    if (!reaction_motion_finite(expanded_radius_m)) {
      reaction_activation_fail_closed();
      continue;
    }
    if (distance_m <= expanded_radius_m) {
      return true;
    }
  }
  return false;
}

@compute @workgroup_size(${WORKGROUP_SIZE})
fn watch_activation_motion_envelope(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }
  var triggered = false;
  var malformed = false;
  if (
    arrayLength(&reaction_activation_observation) < 4u
    || spatial_expectation.support_profile_id != params.support_profile_id
    || !ss_exact_near_directory_admitted(spatial_expectation)
    || !ss_exact_cell_tree_admitted(spatial_expectation)
    || arrayLength(&reaction_records)
      < params.reaction_count * params.reaction_record_stride_vec4s
    || !reaction_activation_source_row_admitted(particle_index)
  ) {
    malformed = true;
  }
  let position_mass = source_state[
    particle_index * params.state_stride_vec4s
  ];
  if (
    !malformed
    && params.activation_thermal_phase_evolution_enabled != 0u
  ) {
    // A dynamic thermal/phase/rest-volume writer can satisfy the reaction
    // predicate or enlarge/activate a carrier without terminal motion. Count
    // every fixed carrier slot positive before consulting terminal mass,
    // temperature, phase, rest diameter, or spatial reach.
    triggered = true;
  }
  if (!malformed && position_mass.w > 0.0 && !triggered) {
    let max_rest_diameter_m = bitcast<f32>(atomicLoad(
      &reaction_activation_observation[
        REACTION_ACTIVATION_MAX_REST_DIAMETER_BITS_WORD
      ]
    ));
    let max_abs_position_m = max(
      abs(position_mass.x),
      max(abs(position_mass.y), abs(position_mass.z))
    );
    let relative_reach_m = reaction_motion_relative_reach_upper(
      params.activation_max_future_substeps,
      params.activation_cfl_factor,
      params.activation_grid_spacing_m,
      max_rest_diameter_m,
      params.activation_separation_enabled != 0u,
      params.activation_contact_correction_enabled != 0u,
      vec3<f32>(
        params.activation_box_dim_x_m,
        params.activation_box_dim_y_m,
        params.activation_box_dim_z_m
      ),
      max_abs_position_m,
      params.maximum_contact_radius_m
    );
    let certified_search_radius_m = reaction_motion_upward(
      reaction_motion_upward(params.maximum_contact_radius_m)
        + reaction_motion_upward(bitcast<f32>(atomicLoad(
          &traversal_evidence[
            REACTION_DISCOVERY_EVIDENCE_MAXIMUM_DISPLACEMENT_BITS
          ]
        )))
        + relative_reach_m
    );
    if (
      !reaction_motion_finite(relative_reach_m)
      || !reaction_motion_finite(certified_search_radius_m)
      || !(certified_search_radius_m >= 0.0)
    ) {
      malformed = true;
    } else if (certified_search_radius_m > 0.0) {
      let query_extent = vec3<f32>(certified_search_radius_m);
      let query_minimum = position_mass.xyz - query_extent;
      let query_maximum = position_mass.xyz + query_extent;
      let tree_cell_count = exact_near_cell_tree[18u];
      let tree_leaf_capacity = exact_near_cell_tree[20u];
      let tree_leaf_offset = tree_leaf_capacity - 1u;
      let tree_node_capacity = exact_near_cell_tree[21u];
      let tree_depth = exact_near_cell_tree[23u];
      var node_stack: array<u32, 32>;
      var stack_count = 0u;
      if (
        tree_node_capacity == 0u
        || tree_depth >= 32u
        || !all(vec3<bool>(
          reaction_motion_finite(query_minimum.x),
          reaction_motion_finite(query_minimum.y),
          reaction_motion_finite(query_minimum.z)
        ))
        || !all(vec3<bool>(
          reaction_motion_finite(query_maximum.x),
          reaction_motion_finite(query_maximum.y),
          reaction_motion_finite(query_maximum.z)
        ))
        || !all(query_minimum <= query_maximum)
      ) {
        malformed = true;
      } else {
        node_stack[0u] = 0u;
        stack_count = 1u;
        for (
          var node_iteration = 0u;
          node_iteration < tree_node_capacity && stack_count > 0u;
          node_iteration = node_iteration + 1u
        ) {
          stack_count = stack_count - 1u;
          let node_index = node_stack[stack_count];
          if (node_index >= tree_node_capacity) {
            malformed = true;
            break;
          }
          if (!ss_exact_cell_tree_node_intersects(
            node_index,
            query_minimum,
            query_maximum
          )) {
            continue;
          }
          if (ss_exact_cell_tree_node_is_leaf(node_index)) {
            let cell_index = ss_exact_cell_tree_leaf_cell_index(node_index);
            if (
              node_index < tree_leaf_offset
              || cell_index >= tree_cell_count
              || cell_index >= spatial_expectation.expected_cell_capacity
            ) {
              malformed = true;
              break;
            }
            let member_range = ss_exact_near_cell_member_range(
              spatial_expectation,
              cell_index
            );
            if (member_range.admitted == 0u) {
              malformed = true;
              break;
            }
            for (
              var member_offset = member_range.begin;
              member_offset < member_range.end;
              member_offset = member_offset + 1u
            ) {
              let lookup = ss_exact_near_source_at_member(
                spatial_expectation,
                member_offset
              );
              if (lookup.admitted == 0u) {
                malformed = true;
                break;
              }
              if (reaction_activation_pair_triggered(
                particle_index,
                lookup.source_index,
                relative_reach_m
              )) {
                triggered = true;
                break;
              }
            }
            if (malformed || triggered) {
              break;
            }
            continue;
          }
          if (
            node_index >= tree_leaf_offset
            || !ss_exact_cell_tree_node_is_internal(node_index)
          ) {
            malformed = true;
            break;
          }
          let left_child = node_index * 2u + 1u;
          let right_child = left_child + 1u;
          if (right_child >= tree_node_capacity || stack_count + 2u > 32u) {
            malformed = true;
            break;
          }
          node_stack[stack_count] = right_child;
          node_stack[stack_count + 1u] = left_child;
          stack_count = stack_count + 2u;
        }
        if (stack_count != 0u && !triggered) {
          malformed = true;
        }
      }
    }
  }
  if (malformed) {
    reaction_activation_fail_closed();
  }
  if (triggered) {
    atomicAdd(
      &reaction_activation_observation[
        REACTION_ACTIVATION_TRIGGERED_SOURCE_COUNT_WORD
      ],
      1u
    );
  }
  atomicAdd(
    &reaction_activation_observation[REACTION_ACTIVATION_FAILURE_WORD],
    1u
  );
}

@compute @workgroup_size(1)
fn seal_activation_motion_watch(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  if (global_id.x != 0u || arrayLength(&reaction_activation_observation) < 4u) {
    return;
  }
  let control = atomicLoad(
    &reaction_activation_observation[REACTION_ACTIVATION_FAILURE_WORD]
  );
  let triggered_source_count = atomicLoad(
    &reaction_activation_observation[
      REACTION_ACTIVATION_TRIGGERED_SOURCE_COUNT_WORD
    ]
  );
  let admitted = (control & 0x80000000u) == 0u
    && (control & 0x7fffffffu) == params.particle_count
    && triggered_source_count <= params.particle_count
    && atomicLoad(&traversal_evidence[0u]) == params.particle_count
    && atomicLoad(&traversal_evidence[1u]) == params.particle_count
    && atomicLoad(&traversal_evidence[2u]) == 0u
    && atomicLoad(&traversal_evidence[5u]) == 0u
    && atomicLoad(&traversal_evidence[7u]) == params.particle_count
    && atomicLoad(&traversal_evidence[8u]) == 0u
    && atomicLoad(&traversal_evidence[REACTION_DISCOVERY_EVIDENCE_OVERFLOW]) == 0u
    && atomicLoad(
      &traversal_evidence[REACTION_DISCOVERY_EVIDENCE_CERTIFICATE_STATUS_BITS]
    ) == REACTION_DISCOVERY_CERTIFICATE_READY_BITS;
  atomicStore(
    &reaction_activation_observation[REACTION_ACTIVATION_RESULT_WORD],
    select(
      REACTION_ACTIVATION_OBSERVATION_ENCODED_FAILURE,
      triggered_source_count + REACTION_ACTIVATION_OBSERVATION_COUNT_BIAS,
      admitted
    )
  );
}

// The schedule boundary maps only this word. An encoded one is a trustworthy
// public zero only when
// the same GPU submission proves every completion/admission field that the
// optional 27-word diagnostic readback validates on the host. Any torn,
// rejected, or overflowing traversal remains WebGPU's zero-initialized
// fail-closed word. particle_count is capped far below u32 overflow.
@compute @workgroup_size(1)
fn reduce_activation_watch(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  if (
    global_id.x != 0u
    || arrayLength(&traversal_evidence)
      < REACTION_DISCOVERY_EVIDENCE_TREE_MEMBER_VISITS + 1u
    || arrayLength(&reaction_activation_observation) < 1u
  ) {
    return;
  }
  let proposal_count = atomicLoad(&traversal_evidence[6u]);
  let admitted = atomicLoad(&traversal_evidence[0u]) == params.particle_count
    && atomicLoad(&traversal_evidence[1u]) == params.particle_count
    && atomicLoad(&traversal_evidence[2u]) == 0u
    && atomicLoad(&traversal_evidence[5u]) == 0u
    && proposal_count <= params.particle_count
    && atomicLoad(&traversal_evidence[7u]) == params.particle_count
    && atomicLoad(&traversal_evidence[8u]) == 0u
    && atomicLoad(&traversal_evidence[9u]) == params.support_profile_id
    && atomicLoad(&traversal_evidence[10u])
      == spatial_expectation.expected_generation_id
    && atomicLoad(&traversal_evidence[11u])
      == spatial_expectation.expected_support_epoch
    && atomicLoad(&traversal_evidence[12u]) == params.particle_count
    && atomicLoad(&traversal_evidence[13u]) == params.reaction_count
    && atomicLoad(&traversal_evidence[14u]) == 0u
    && atomicLoad(&traversal_evidence[REACTION_DISCOVERY_EVIDENCE_OVERFLOW]) == 0u
    && atomicLoad(
      &traversal_evidence[REACTION_DISCOVERY_EVIDENCE_CERTIFICATE_STATUS_BITS]
    ) == REACTION_DISCOVERY_CERTIFICATE_READY_BITS;
  atomicStore(
    &reaction_activation_observation[0u],
    select(
      REACTION_ACTIVATION_OBSERVATION_ENCODED_FAILURE,
      proposal_count + REACTION_ACTIVATION_OBSERVATION_COUNT_BIAS,
      admitted
    )
  );
}
`;
}

export const schroederSpatialReactionDiscoveryProposalWgsl =
  createReactionDiscoveryProposalWgsl(SCHROEDER_SPATIAL_EPOCH_VERSION);
export const schroederSpatialReactionDiscoveryProposalV2Wgsl =
  createReactionDiscoveryProposalWgsl(SCHROEDER_SPATIAL_EPOCH_V2_VERSION);

function reactionDiscoveryTraversalProgramForDirectoryAbiVersion(
  directoryAbiVersion
) {
  const directoryV2 =
    directoryAbiVersion === SCHROEDER_SPATIAL_EPOCH_V2_VERSION;
  if (
    directoryAbiVersion !== SCHROEDER_SPATIAL_EPOCH_VERSION
    && !directoryV2
  ) {
    const error = new TypeError(
      `reaction discovery does not support directory ABI version ${
        directoryAbiVersion
      }`
    );
    error.code =
      'ERR_SCHROEDER_REACTION_DISCOVERY_UNSUPPORTED_DIRECTORY_ABI';
    throw error;
  }
  return Object.freeze({
    directoryAbiVersion,
    expectationBufferByteLength: directoryV2
      ? SCHROEDER_SPATIAL_EXACT_NEAR_EXPECTATION_V2_UNIFORM_BYTES
      : SCHROEDER_SPATIAL_EXACT_NEAR_EXPECTATION_V1_UNIFORM_BYTES,
    shaderCode: directoryV2
      ? schroederSpatialReactionDiscoveryProposalV2Wgsl
      : schroederSpatialReactionDiscoveryProposalWgsl,
    cacheKeySuffix: `directory-v${directoryAbiVersion}`,
    exactNearCellTreeTraversal: directoryV2
      ? 'canonical-complete-binary-cell-aabb-leaf-streaming-v2'
      : 'canonical-complete-binary-cell-aabb-leaf-streaming-v1'
  });
}

function resolveReactionDiscoveryTraversalProgram(
  authentication,
  generation
) {
  const directoryAbiVersion = authentication?.directoryAbiVersion;
  const generationAbiVersion = generation?.execution?.abiVersion;
  const traversalProgram =
    reactionDiscoveryTraversalProgramForDirectoryAbiVersion(
      directoryAbiVersion
    );
  if (generationAbiVersion !== directoryAbiVersion) {
    const error = new TypeError(
      'reaction discovery authentication/generation directory ABI mismatch'
    );
    error.code =
      'ERR_SCHROEDER_REACTION_DISCOVERY_DIRECTORY_ABI_MISMATCH';
    throw error;
  }
  if (
    authentication.expectationUniformBytes
      !== traversalProgram.expectationBufferByteLength
    || authentication.expectationData?.byteLength
      !== traversalProgram.expectationBufferByteLength
  ) {
    const error = new TypeError(
      'reaction discovery expectation ABI does not match the directory ABI'
    );
    error.code =
      'ERR_SCHROEDER_REACTION_DISCOVERY_EXPECTATION_ABI_MISMATCH';
    throw error;
  }
  return traversalProgram;
}

// Dynamic-law chemistry is table data.  These are the fixed, material-
// agnostic discovery passes for one spatial-directory ABI.  Keeping the
// descriptor table shared by prewarm and encode prevents an envelope breach
// from becoming a shader-compilation boundary.
function reactionDiscoveryPipelineDescriptorsForTraversalProgram(
  traversalProgram
) {
  const version = SCHROEDER_SPATIAL_REACTION_DISCOVERY_PIPELINE_CACHE_VERSION;
  const suffix = traversalProgram.cacheKeySuffix;
  const labelVersion = traversalProgram.directoryAbiVersion;
  const activationObservationBindings = [
    computeBufferBinding(7, 'storage'),
    computeBufferBinding(8, 'uniform'),
    computeBufferBinding(9, 'uniform'),
    computeBufferBinding(10, 'storage')
  ];
  const descriptor = ({ cacheFamily, label, entryPoint, bindings }) =>
    Object.freeze({
      cacheKey: `${cacheFamily}.${version}.${suffix}`,
      label: `${label}-v${labelVersion}`,
      code: traversalProgram.shaderCode,
      entryPoint,
      bindings
    });
  return Object.freeze({
    schema:
      'peercompute.ulg.schroeder-spatial-reaction-discovery-pipeline-descriptors.v0',
    directoryAbiVersion: traversalProgram.directoryAbiVersion,
    displacement: descriptor({
      cacheFamily: 'ulg-schroeder-spatial-reaction-discovery-displacement',
      label: 'ulg-schroeder-spatial-reaction-discovery-displacement',
      entryPoint: 'prepare_displacement_certificate',
      bindings: [
        computeBufferBinding(0, 'read-only-storage'),
        computeBufferBinding(2, 'read-only-storage'),
        computeBufferBinding(7, 'storage'),
        computeBufferBinding(9, 'uniform')
      ]
    }),
    proposal: descriptor({
      cacheFamily: 'ulg-schroeder-spatial-reaction-discovery-proposal',
      label: 'ulg-schroeder-spatial-reaction-discovery-proposal',
      entryPoint: 'propose',
      bindings: [
        computeBufferBinding(0, 'read-only-storage'),
        computeBufferBinding(1, 'read-only-storage'),
        computeBufferBinding(2, 'read-only-storage'),
        computeBufferBinding(3, 'read-only-storage'),
        computeBufferBinding(4, 'read-only-storage'),
        computeBufferBinding(5, 'read-only-storage'),
        computeBufferBinding(6, 'storage'),
        computeBufferBinding(7, 'storage'),
        computeBufferBinding(8, 'uniform'),
        computeBufferBinding(9, 'uniform')
      ]
    }),
    seal: descriptor({
      cacheFamily: 'ulg-schroeder-spatial-reaction-discovery-proposal',
      label: 'ulg-schroeder-spatial-reaction-discovery-seal',
      entryPoint: 'seal',
      bindings: [
        computeBufferBinding(6, 'storage'),
        computeBufferBinding(7, 'storage'),
        computeBufferBinding(9, 'uniform')
      ]
    }),
    activationMotionBounds: descriptor({
      cacheFamily:
        'ulg-schroeder-spatial-reaction-discovery-activation-bounds',
      label:
        'ulg-schroeder-spatial-reaction-discovery-activation-bounds',
      entryPoint: 'prepare_activation_motion_bounds',
      bindings: [
        computeBufferBinding(0, 'read-only-storage'),
        computeBufferBinding(1, 'read-only-storage'),
        computeBufferBinding(2, 'read-only-storage'),
        computeBufferBinding(9, 'uniform'),
        computeBufferBinding(10, 'storage')
      ]
    }),
    activationMotionWatch: descriptor({
      cacheFamily:
        'ulg-schroeder-spatial-reaction-discovery-activation-watch',
      label:
        'ulg-schroeder-spatial-reaction-discovery-activation-watch',
      entryPoint: 'watch_activation_motion_envelope',
      bindings: [
        computeBufferBinding(1, 'read-only-storage'),
        computeBufferBinding(2, 'read-only-storage'),
        computeBufferBinding(3, 'read-only-storage'),
        computeBufferBinding(4, 'read-only-storage'),
        computeBufferBinding(5, 'read-only-storage'),
        computeBufferBinding(7, 'storage'),
        computeBufferBinding(8, 'uniform'),
        computeBufferBinding(9, 'uniform'),
        computeBufferBinding(10, 'storage')
      ]
    }),
    activationObservationWithMotion: descriptor({
      cacheFamily: 'ulg-schroeder-spatial-reaction-discovery-activation',
      label: 'ulg-schroeder-spatial-reaction-discovery-activation',
      entryPoint: 'seal_activation_motion_watch',
      bindings: activationObservationBindings
    }),
    activationObservationWithoutMotion: descriptor({
      cacheFamily: 'ulg-schroeder-spatial-reaction-discovery-activation',
      label: 'ulg-schroeder-spatial-reaction-discovery-activation',
      entryPoint: 'reduce_activation_watch',
      bindings: activationObservationBindings
    })
  });
}

export function schroederSpatialReactionDiscoveryPipelineDescriptors({
  directoryAbiVersion = SCHROEDER_SPATIAL_EPOCH_VERSION
} = {}) {
  return reactionDiscoveryPipelineDescriptorsForTraversalProgram(
    reactionDiscoveryTraversalProgramForDirectoryAbiVersion(
      directoryAbiVersion
    )
  );
}

export function enumerateSchroederSpatialReactionDiscoveryPrewarmPipelineDescriptors({
  directoryAbiVersions = [
    SCHROEDER_SPATIAL_EPOCH_VERSION,
    SCHROEDER_SPATIAL_EPOCH_V2_VERSION
  ]
} = {}) {
  return directoryAbiVersions.flatMap((directoryAbiVersion) => {
    const table = schroederSpatialReactionDiscoveryPipelineDescriptors({
      directoryAbiVersion
    });
    return [
      table.displacement,
      table.proposal,
      table.seal,
      table.activationMotionBounds,
      table.activationMotionWatch,
      table.activationObservationWithMotion,
      table.activationObservationWithoutMotion
    ];
  });
}

function createResidentGpuEvidence({
  authentication,
  proposalBuffer,
  evidenceBuffer,
  observedEvidence = null,
  byteLength,
  capacityByteLength = byteLength
}) {
  const residentCountersObserved = observedEvidence != null;
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_EXACT_NEAR_GPU_EVIDENCE_SCHEMA,
    status: 'schroeder-spatial-exact-near-gpu-authenticated',
    gpuAuthenticated: true,
    consumerId: authentication.consumerId,
    supportProfileId: authentication.supportProfileId,
    generationId: authentication.generationId,
    epochIdentity: authentication.epochIdentity,
    traversalCount: 1,
    candidateVisitCount: observedEvidence?.candidateVisitCount ?? 0,
    exactCellTreeNodeVisitCount:
      observedEvidence?.exactCellTreeNodeVisitCount ?? 0,
    exactCellTreeLeafVisitCount:
      observedEvidence?.exactCellTreeLeafVisitCount ?? 0,
    exactCellTreeMemberVisitCount:
      observedEvidence?.exactCellTreeMemberVisitCount ?? 0,
    consumerMaskHitCount: observedEvidence?.compatiblePairCount ?? 0,
    migratedProposalCount: observedEvidence?.proposalCount ?? 0,
    ruleIndexPairLookupCount:
      observedEvidence?.ruleIndexPairLookupCount ?? 0,
    ruleIndexPairMissCount:
      observedEvidence?.ruleIndexPairMissCount ?? 0,
    ruleIndexRuleVisitCount:
      observedEvidence?.ruleIndexRuleVisitCount ?? 0,
    fullRuleScanRuleVisitCount:
      observedEvidence?.fullRuleScanRuleVisitCount ?? 0,
    candidateBytesRequired: byteLength,
    candidateBytesAdmitted: byteLength,
    candidateBytesCapacity: capacityByteLength,
    candidateOverflowBytes: 0,
    privateLookupBuildCount: 0,
    fixedCandidateBuildCount: 0,
    exhaustiveTraversalCount: 0,
    overflowed: false,
    partialPublication: false,
    fallbackObserved: false,
    fullReadbackPerformed: false,
    residentCounterBuffer: evidenceBuffer,
    residentProposalBuffer: proposalBuffer,
    residentCountersObserved,
    compactReadbackByteLength: residentCountersObserved
      ? SCHROEDER_SPATIAL_REACTION_DISCOVERY_EVIDENCE_WORDS
        * Uint32Array.BYTES_PER_ELEMENT
      : 0,
    observationMode: residentCountersObserved
      ? 'explicit-compact-diagnostic-observation'
      : 'gpu-resident-seal-unobserved',
    failClosedSealDispatchCount: 1
  });
}

/**
 * Discover at most one deterministic fully eligible candidate per particle
 * from the immutable canonical version-matched ss-spatial-epoch directory.
 * The caller must
 * supply the post-thermal state/thermo family. A GPU displacement certificate
 * expands the frozen E* lookup and rejects any intervening active-mask change;
 * the reaction stage still rechecks every predicate before mutating topology.
 */
export async function runSchroederSpatialReactionDiscoveryProposalWebGpu({
  device,
  generation,
  sphParticleState = null,
  sphParticleUpload = null,
  positionAuthorityStateBuffer = null,
  sourceStateBuffer = null,
  sourceThermoBuffer = null,
  sourceMechanicsBuffer = null,
  reactionTable,
  reactionMotionEnvelope = null,
  boxDimsM = null,
  reactionRecordBuffer = null,
  gpuTimestampRecorder = null,
  collectGpuResidentDiagnosticEvidence = false,
  observeGpuEvidence = false,
  captureActivationObservation = false
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer || !device.queue?.submit) {
    throw new TypeError('canonical reaction discovery requires a WebGPU-like device');
  }
  const deviceLimits = reactionDiscoveryDeviceLimits(device);
  if (typeof collectGpuResidentDiagnosticEvidence !== 'boolean') {
    throw new TypeError(
      'collectGpuResidentDiagnosticEvidence must be a boolean'
    );
  }
  if (typeof captureActivationObservation !== 'boolean') {
    throw new TypeError('captureActivationObservation must be a boolean');
  }
  if (
    reactionMotionEnvelope != null
    && !isExactSphReactionMotionEnvelope(reactionMotionEnvelope)
  ) {
    throw new TypeError(
      'reactionMotionEnvelope must be an exact sealed reaction motion envelope'
    );
  }
  if (reactionMotionEnvelope && captureActivationObservation !== true) {
    throw new TypeError(
      'reactionMotionEnvelope requires captureActivationObservation'
    );
  }
  if (reactionMotionEnvelope) {
    assertSphReactionMotionEnvelopeBoxDimsMatch(
      reactionMotionEnvelope,
      boxDimsM,
      'reaction discovery boxDimsM'
    );
  }
  const particleCount = exactPositiveU32(
    generation?.source?.sourceCount,
    'generation.source.sourceCount',
    MAX_EXACT_F32_INTEGER
  );
  if (
    sphParticleState?.particleCount != null
    && sphParticleState.particleCount !== particleCount
  ) {
    throw new RangeError('reaction discovery particle count does not match the canonical epoch');
  }
  const { reactionCount, combined } = reactionRecordArray(reactionTable, {
    requireExactPrefixMirror: captureActivationObservation === true
  });
  if (captureActivationObservation === true) {
    assertSphReactionMotionEnvelopeRulePrefix(
      combined,
      reactionCount,
      'reactionTable'
    );
  }
  const reactionTableFingerprint =
    schroederAuthorityTypedArrayFingerprint(
      combined,
      'reaction-table-combined-records-v2'
    );
  const materialPairIndexRequested = reactionRecordBuffer == null && reactionCount > 1;
  const reactionRuleIndex = cachedReactionRuleIndexUpload({
    reactionTable,
    combined,
    reactionCount,
    allowIndex: materialPairIndexRequested,
    fallbackReason: reactionRecordBuffer
      ? 'borrowed-caller-reaction-record-buffer'
      : 'single-reaction-full-scan-is-cheaper',
    reactionTableFingerprint
  });
  const reactionRecordUpload = reactionRuleIndex.upload;
  const reactionDiscoveryPayloadFingerprint = typedArrayContentFingerprint(
    reactionRecordUpload
  );
  const maximumContactRadiusM = maxReactionContactRadiusM(reactionTable);
  const currentStateBuffer = requireBuffer(
    device,
    sourceStateBuffer || sphParticleUpload?.stateBuffer,
    'reaction discovery sourceStateBuffer'
  );
  const generationPositionAuthorityBuffer = generation?.source?.sourceStateBuffer
    ?? generation?.source?.exactNearQueryProfile?.sourceStateBuffer
    ?? null;
  const positionStateBuffer = requireBuffer(
    device,
    positionAuthorityStateBuffer || generationPositionAuthorityBuffer,
    'reaction discovery positionAuthorityStateBuffer'
  );
  if (
    !generationPositionAuthorityBuffer
    || positionStateBuffer !== generationPositionAuthorityBuffer
  ) {
    throw new TypeError(
      'reaction discovery position authority must be the exact source-state buffer retained by the canonical generation'
    );
  }
  const thermoBuffer = requireBuffer(
    device,
    sourceThermoBuffer || sphParticleUpload?.thermoBuffer,
    'reaction discovery sourceThermoBuffer'
  );
  const mechanicsBuffer = reactionMotionEnvelope
    ? requireBuffer(
        device,
        sourceMechanicsBuffer,
        'reaction discovery sourceMechanicsBuffer'
      )
    : null;
  const canonicalSourceBuffer = requireBuffer(
    device,
    generation?.source?.sourceBuffer ?? generation?.source?.activeNodeBuffer,
    'reaction discovery canonical sourceBuffer'
  );
  const stateBufferByteLength = checkedPositiveProduct(
    [particleCount, 2, 4, Float32Array.BYTES_PER_ELEMENT],
    'reaction discovery state buffer byte length'
  );
  const thermoBufferByteLength = checkedPositiveProduct(
    [particleCount, 3, 4, Float32Array.BYTES_PER_ELEMENT],
    'reaction discovery thermo buffer byte length'
  );
  const mechanicsBufferByteLength = checkedPositiveProduct(
    [particleCount, 8, 4, Float32Array.BYTES_PER_ELEMENT],
    'reaction discovery mechanics buffer byte length'
  );
  requireStorageBufferPrefix(
    currentStateBuffer,
    stateBufferByteLength,
    'reaction discovery sourceStateBuffer',
    deviceLimits
  );
  requireStorageBufferPrefix(
    positionStateBuffer,
    stateBufferByteLength,
    'reaction discovery positionAuthorityStateBuffer',
    deviceLimits
  );
  requireStorageBufferPrefix(
    thermoBuffer,
    thermoBufferByteLength,
    'reaction discovery sourceThermoBuffer',
    deviceLimits
  );
  if (mechanicsBuffer) {
    requireStorageBufferPrefix(
      mechanicsBuffer,
      mechanicsBufferByteLength,
      'reaction discovery sourceMechanicsBuffer',
      deviceLimits
    );
  }
  const authentication = resolveSchroederSpatialExactNearConsumerGeneration(
    generation,
    {
      device,
      runtime: generation.runtime,
      consumerId: SCHROEDER_SPATIAL_REACTION_DISCOVERY_CONSUMER_ID,
      supportProfileId: SCHROEDER_SPATIAL_SUPPORT_PROFILE_REACTION_DISCOVERY_V1,
      sourceBuffer: canonicalSourceBuffer,
      expected: {
        generationId: generation.execution?.generationId,
        sourceCount: particleCount,
        storageGeneration: generation.execution?.storageGeneration,
        physicsTick: generation.execution?.physicsTick,
        physicsSubstep: generation.execution?.physicsSubstep,
        positionEpoch: generation.execution?.positionEpoch,
        topologyEpoch: generation.execution?.topologyEpoch,
        supportEpoch: generation.execution?.supportEpoch
      }
    }
  );
  if (authentication?.ready !== true || authentication.authenticated !== true) {
    throw new TypeError(
      authentication?.reason || 'reaction discovery could not authenticate the canonical generation'
    );
  }
  const traversalProgram = resolveReactionDiscoveryTraversalProgram(
    authentication,
    generation
  );
  const directoryBuffer = requireBuffer(
    device,
    authentication.directoryBuffer,
    'reaction discovery canonical directoryBuffer'
  );
  const exactNearCellTreeConsumer =
    resolveSchroederSpatialExactNearCellTreeForConsumer(
      generation?.exactNearCellTree,
      {
        device,
        spatialExecution: generation?.execution,
        supportProfileId:
          SCHROEDER_SPATIAL_SUPPORT_PROFILE_REACTION_DISCOVERY_V1
      }
    );
  if (exactNearCellTreeConsumer.ready !== true) {
    throw new TypeError(
      'reaction discovery requires the submitted same-epoch exact-near cell tree'
    );
  }
  const exactNearCellTreeBuffer = requireBuffer(
    device,
    exactNearCellTreeConsumer.treeBuffer,
    'reaction discovery exactNearCellTreeBuffer'
  );

  requireStorageBufferPrefix(
    directoryBuffer,
    directoryBuffer.size,
    'reaction discovery canonical directoryBuffer',
    deviceLimits
  );
  requireStorageBufferPrefix(
    exactNearCellTreeBuffer,
    exactNearCellTreeBuffer.size,
    'reaction discovery exactNearCellTreeBuffer',
    deviceLimits
  );
  requireStorageCapacity(
    deviceLimits,
    reactionRecordUpload.byteLength,
    'reaction discovery reaction record buffer'
  );
  const proposalByteLength = checkedPositiveProduct(
    [
      particleCount,
      SCHROEDER_SPATIAL_REACTION_DISCOVERY_PROPOSAL_ROW_FLOATS,
      Float32Array.BYTES_PER_ELEMENT
    ],
    'reaction discovery proposal buffer byte length'
  );
  requireStorageCapacity(
    deviceLimits,
    proposalByteLength,
    'reaction discovery proposal buffer'
  );
  requireUniformCapacity(
    deviceLimits,
    traversalProgram.expectationBufferByteLength,
    'reaction discovery expectation buffer'
  );
  requireUniformCapacity(
    deviceLimits,
    PARAMS_BYTES,
    'reaction discovery params buffer'
  );
  const workgroups = Math.max(1, Math.ceil(particleCount / WORKGROUP_SIZE));
  if (
    !Number.isSafeInteger(workgroups)
    || workgroups > deviceLimits.maxComputeWorkgroupsPerDimension
  ) {
    throw new RangeError(
      `reaction discovery requires ${workgroups} workgroups; device limit is ${deviceLimits.maxComputeWorkgroupsPerDimension}`
    );
  }
  const arenaResources = acquireReactionDiscoveryArenaResources({
    device,
    limits: deviceLimits,
    generation,
    directoryAbiVersion: traversalProgram.directoryAbiVersion,
    expectationBufferByteLength:
      traversalProgram.expectationBufferByteLength,
    proposalBytes: proposalByteLength,
    localReactionRecordBytes: reactionRecordBuffer
      ? 0
      : reactionRecordUpload.byteLength,
    observeGpuEvidence: observeGpuEvidence === true,
    captureActivationObservation: captureActivationObservation === true
  });
  const { entry: arenaEntry, lease: arenaLease } = arenaResources;
  try {
  const resolvedReactionRecordBuffer = reactionRecordBuffer
    ? requireBuffer(device, reactionRecordBuffer, 'reaction discovery reactionRecordBuffer')
    : arenaEntry.reactionRecordBuffer;
  requireStorageBufferPrefix(
    resolvedReactionRecordBuffer,
    reactionRecordUpload.byteLength,
    'reaction discovery reactionRecordBuffer',
    deviceLimits
  );
  // Establish the exact immutable prefix snapshot. The owned arena receives
  // the private discovery suffix too; borrowed caller buffers deliberately
  // retain the prefix-only full-scan route.
  device.queue.writeBuffer(resolvedReactionRecordBuffer, 0, reactionRecordUpload);

  const proposalBuffer = arenaEntry.proposalBuffer;
  const evidenceInitial = new Uint32Array(
    SCHROEDER_SPATIAL_REACTION_DISCOVERY_EVIDENCE_WORDS
  );
  evidenceInitial[9] = SCHROEDER_SPATIAL_SUPPORT_PROFILE_REACTION_DISCOVERY_V1;
  evidenceInitial[10] = authentication.generationId;
  evidenceInitial[11] = authentication.epochIdentity.supportEpoch;
  evidenceInitial[12] = particleCount;
  evidenceInitial[13] = reactionCount;
  evidenceInitial[
    REACTION_DISCOVERY_EVIDENCE_CERTIFICATE_STATUS_BITS
  ] = DISPLACEMENT_CERTIFICATE_READY_F32_BITS;
  const evidenceBuffer = arenaEntry.evidenceBuffer;
  const evidenceReadbackBuffer = observeGpuEvidence === true
    ? arenaEntry.evidenceReadbackBuffer
    : null;
  const activationObservationWordBuffer = captureActivationObservation === true
    ? arenaEntry.activationObservationWordBuffer
    : null;
  const activationObservationReadbackBuffer = captureActivationObservation === true
    ? arenaEntry.activationObservationReadbackBuffer
    : null;
  // The four certificate words are resident fields of evidenceBuffer. Keeping
  // this public alias avoids changing downstream receipt shape while freeing
  // the ninth storage binding for the shared exact-cell tree.
  const displacementCertificateBuffer = evidenceBuffer;
  const expectationBuffer = arenaEntry.expectationBuffer;
  const paramsBuffer = arenaEntry.paramsBuffer;
  requireMinimumBufferBytes(
    expectationBuffer,
    traversalProgram.expectationBufferByteLength,
    'reaction discovery expectationBuffer'
  );
  device.queue.writeBuffer(expectationBuffer, 0, authentication.expectationData);
  device.queue.writeBuffer(paramsBuffer, 0, createParamsArray({
    particleCount,
    reactionCount,
    maximumContactRadiusM,
    reactionRuleIndex,
    collectDiagnosticEvidence:
      collectGpuResidentDiagnosticEvidence === true
      || observeGpuEvidence === true,
    reactionMotionEnvelope
  }));
  device.queue.writeBuffer(evidenceBuffer, 0, evidenceInitial);
  if (captureActivationObservation === true) {
    device.queue.writeBuffer(
      activationObservationWordBuffer,
      0,
      new Uint32Array([
        REACTION_ACTIVATION_OBSERVATION_ENCODED_FAILURE,
        0,
        0,
        0
      ])
    );
    // WebGPU zero initialization and this explicit cached reset share the same
    // fail-closed encoding. A validation-dropped copy cannot replay success.
    device.queue.writeBuffer(
      activationObservationReadbackBuffer,
      0,
      new Uint32Array([REACTION_ACTIVATION_OBSERVATION_ENCODED_FAILURE])
    );
  }

  const pipelineDescriptors =
    reactionDiscoveryPipelineDescriptorsForTraversalProgram(
      traversalProgram
    );
  const displacementPipeline = createCachedExplicitComputePipeline(
    device,
    pipelineDescriptors.displacement
  );
  const proposalPipeline = createCachedExplicitComputePipeline(
    device,
    pipelineDescriptors.proposal
  );
  const sealPipeline = createCachedExplicitComputePipeline(
    device,
    pipelineDescriptors.seal
  );
  const activationMotionBoundsPipeline = reactionMotionEnvelope
    ? createCachedExplicitComputePipeline(
        device,
        pipelineDescriptors.activationMotionBounds
      )
    : null;
  const activationMotionWatchPipeline = reactionMotionEnvelope
    ? createCachedExplicitComputePipeline(
        device,
        pipelineDescriptors.activationMotionWatch
      )
    : null;
  const activationObservationPipeline = captureActivationObservation === true
    ? createCachedExplicitComputePipeline(
        device,
        reactionMotionEnvelope
          ? pipelineDescriptors.activationObservationWithMotion
          : pipelineDescriptors.activationObservationWithoutMotion
      )
    : null;
  const proposalBindGroup = device.createBindGroup({
    label: 'ulg-schroeder-spatial-reaction-discovery-proposal-bindings',
    layout: proposalPipeline.bindGroupLayout,
    entries: [
      { binding: 0, resource: exactBufferBindingResource(
        positionStateBuffer,
        stateBufferByteLength
      ) },
      { binding: 1, resource: exactBufferBindingResource(
        thermoBuffer,
        thermoBufferByteLength
      ) },
      { binding: 2, resource: exactBufferBindingResource(
        currentStateBuffer,
        stateBufferByteLength
      ) },
      { binding: 3, resource: exactBufferBindingResource(
        resolvedReactionRecordBuffer,
        reactionRecordUpload.byteLength
      ) },
      { binding: 4, resource: exactBufferBindingResource(
        directoryBuffer,
        directoryBuffer.size
      ) },
      { binding: 5, resource: exactBufferBindingResource(
        exactNearCellTreeBuffer,
        exactNearCellTreeBuffer.size
      ) },
      { binding: 6, resource: exactBufferBindingResource(
        proposalBuffer,
        proposalByteLength
      ) },
      { binding: 7, resource: exactBufferBindingResource(
        evidenceBuffer,
        evidenceInitial.byteLength
      ) },
      { binding: 8, resource: exactBufferBindingResource(
        expectationBuffer,
        traversalProgram.expectationBufferByteLength
      ) },
      { binding: 9, resource: exactBufferBindingResource(
        paramsBuffer,
        PARAMS_BYTES
      ) }
    ]
  });
  const displacementBindGroup = device.createBindGroup({
    label: 'ulg-schroeder-spatial-reaction-discovery-displacement-bindings',
    layout: displacementPipeline.bindGroupLayout,
    entries: [
      { binding: 0, resource: exactBufferBindingResource(
        positionStateBuffer,
        stateBufferByteLength
      ) },
      { binding: 2, resource: exactBufferBindingResource(
        currentStateBuffer,
        stateBufferByteLength
      ) },
      { binding: 7, resource: exactBufferBindingResource(
        evidenceBuffer,
        evidenceInitial.byteLength
      ) },
      { binding: 9, resource: exactBufferBindingResource(
        paramsBuffer,
        PARAMS_BYTES
      ) }
    ]
  });
  const sealBindGroup = device.createBindGroup({
    label: 'ulg-schroeder-spatial-reaction-discovery-seal-bindings',
    layout: sealPipeline.bindGroupLayout,
    entries: [
      { binding: 6, resource: exactBufferBindingResource(
        proposalBuffer,
        proposalByteLength
      ) },
      { binding: 7, resource: exactBufferBindingResource(
        evidenceBuffer,
        evidenceInitial.byteLength
      ) },
      { binding: 9, resource: exactBufferBindingResource(
        paramsBuffer,
        PARAMS_BYTES
      ) }
    ]
  });
  const activationMotionBoundsBindGroup = activationMotionBoundsPipeline
    ? device.createBindGroup({
        label:
          'ulg-schroeder-spatial-reaction-discovery-activation-bounds-bindings',
        layout: activationMotionBoundsPipeline.bindGroupLayout,
        entries: [
          { binding: 0, resource: exactBufferBindingResource(
            mechanicsBuffer,
            mechanicsBufferByteLength
          ) },
          { binding: 1, resource: exactBufferBindingResource(
            thermoBuffer,
            thermoBufferByteLength
          ) },
          { binding: 2, resource: exactBufferBindingResource(
            currentStateBuffer,
            stateBufferByteLength
          ) },
          { binding: 9, resource: exactBufferBindingResource(
            paramsBuffer,
            PARAMS_BYTES
          ) },
          {
            binding: 10,
            resource: exactBufferBindingResource(
              activationObservationWordBuffer,
              REACTION_ACTIVATION_CONTROL_BYTES
            )
          }
        ]
      })
    : null;
  const activationMotionWatchBindGroup = activationMotionWatchPipeline
    ? device.createBindGroup({
        label:
          'ulg-schroeder-spatial-reaction-discovery-activation-watch-bindings',
        layout: activationMotionWatchPipeline.bindGroupLayout,
        entries: [
          { binding: 1, resource: exactBufferBindingResource(
            thermoBuffer,
            thermoBufferByteLength
          ) },
          { binding: 2, resource: exactBufferBindingResource(
            currentStateBuffer,
            stateBufferByteLength
          ) },
          { binding: 3, resource: exactBufferBindingResource(
            resolvedReactionRecordBuffer,
            reactionRecordUpload.byteLength
          ) },
          { binding: 4, resource: exactBufferBindingResource(
            directoryBuffer,
            directoryBuffer.size
          ) },
          { binding: 5, resource: exactBufferBindingResource(
            exactNearCellTreeBuffer,
            exactNearCellTreeBuffer.size
          ) },
          { binding: 7, resource: exactBufferBindingResource(
            evidenceBuffer,
            evidenceInitial.byteLength
          ) },
          { binding: 8, resource: exactBufferBindingResource(
            expectationBuffer,
            traversalProgram.expectationBufferByteLength
          ) },
          { binding: 9, resource: exactBufferBindingResource(
            paramsBuffer,
            PARAMS_BYTES
          ) },
          {
            binding: 10,
            resource: exactBufferBindingResource(
              activationObservationWordBuffer,
              REACTION_ACTIVATION_CONTROL_BYTES
            )
          }
        ]
      })
    : null;
  const activationObservationBindGroup = activationObservationPipeline
    ? device.createBindGroup({
        label: 'ulg-schroeder-spatial-reaction-discovery-activation-bindings',
        layout: activationObservationPipeline.bindGroupLayout,
        entries: [
          { binding: 7, resource: exactBufferBindingResource(
            evidenceBuffer,
            evidenceInitial.byteLength
          ) },
          { binding: 8, resource: exactBufferBindingResource(
            expectationBuffer,
            traversalProgram.expectationBufferByteLength
          ) },
          { binding: 9, resource: exactBufferBindingResource(
            paramsBuffer,
            PARAMS_BYTES
          ) },
          {
            binding: 10,
            resource: exactBufferBindingResource(
              activationObservationWordBuffer,
              REACTION_ACTIVATION_CONTROL_BYTES
            )
          }
        ]
      })
    : null;
  const encoder = device.createCommandEncoder({
    label: 'ulg-schroeder-spatial-reaction-discovery'
  });
  const timestampDescriptor = (stage) => ({
    producerId: `schroeder-spatial-reaction-discovery:${stage}`,
    stage,
    spanClass: 'same-production-command-encoder-profiled-pass',
    generationId: authentication.generationId,
    particleCount,
    reactionCount,
    productionPassGroupingPreserved: true
  });
  const displacementTimestampSpan = beginReactionDiscoveryTimestampSpan(
    gpuTimestampRecorder,
    encoder,
    timestampDescriptor('spatial-displacement-certificate')
  );
  const displacementPass = encoder.beginComputePass({
    label: 'ulg-schroeder-spatial-reaction-discovery-displacement-certificate'
  });
  displacementPass.setPipeline(displacementPipeline.pipeline);
  displacementPass.setBindGroup(0, displacementBindGroup);
  displacementPass.dispatchWorkgroups(workgroups);
  displacementPass.end();
  endReactionDiscoveryTimestampSpan(
    gpuTimestampRecorder,
    encoder,
    displacementTimestampSpan
  );
  const proposalTimestampSpan = beginReactionDiscoveryTimestampSpan(
    gpuTimestampRecorder,
    encoder,
    timestampDescriptor('candidate-traversal')
  );
  const proposalPass = encoder.beginComputePass({
    label: 'ulg-schroeder-spatial-reaction-discovery-proposal'
  });
  proposalPass.setPipeline(proposalPipeline.pipeline);
  proposalPass.setBindGroup(0, proposalBindGroup);
  proposalPass.dispatchWorkgroups(workgroups);
  proposalPass.end();
  endReactionDiscoveryTimestampSpan(
    gpuTimestampRecorder,
    encoder,
    proposalTimestampSpan
  );
  const sealTimestampSpan = beginReactionDiscoveryTimestampSpan(
    gpuTimestampRecorder,
    encoder,
    timestampDescriptor('proposal-seal')
  );
  const sealPass = encoder.beginComputePass({
    label: 'ulg-schroeder-spatial-reaction-discovery-seal'
  });
  sealPass.setPipeline(sealPipeline.pipeline);
  sealPass.setBindGroup(0, sealBindGroup);
  sealPass.dispatchWorkgroups(workgroups);
  sealPass.end();
  endReactionDiscoveryTimestampSpan(
    gpuTimestampRecorder,
    encoder,
    sealTimestampSpan
  );
  if (activationMotionBoundsPipeline) {
    const boundsPass = encoder.beginComputePass({
      label:
        'ulg-schroeder-spatial-reaction-discovery-activation-motion-bounds'
    });
    boundsPass.setPipeline(activationMotionBoundsPipeline.pipeline);
    boundsPass.setBindGroup(0, activationMotionBoundsBindGroup);
    boundsPass.dispatchWorkgroups(workgroups);
    boundsPass.end();
    const watchPass = encoder.beginComputePass({
      label:
        'ulg-schroeder-spatial-reaction-discovery-activation-motion-watch'
    });
    watchPass.setPipeline(activationMotionWatchPipeline.pipeline);
    watchPass.setBindGroup(0, activationMotionWatchBindGroup);
    watchPass.dispatchWorkgroups(workgroups);
    watchPass.end();
  }
  if (activationObservationPipeline) {
    const activationObservationPass = encoder.beginComputePass({
      label: 'ulg-schroeder-spatial-reaction-discovery-activation-reduction'
    });
    activationObservationPass.setPipeline(
      activationObservationPipeline.pipeline
    );
    activationObservationPass.setBindGroup(0, activationObservationBindGroup);
    activationObservationPass.dispatchWorkgroups(1);
    activationObservationPass.end();
    encoder.copyBufferToBuffer(
      activationObservationWordBuffer,
      0,
      activationObservationReadbackBuffer,
      0,
      REACTION_ACTIVATION_OBSERVATION_BYTES
    );
  }
  if (observeGpuEvidence === true) {
    encoder.copyBufferToBuffer(
      evidenceBuffer,
      0,
      evidenceReadbackBuffer,
      0,
      SCHROEDER_SPATIAL_REACTION_DISCOVERY_EVIDENCE_WORDS
        * Uint32Array.BYTES_PER_ELEMENT
    );
  }
  device.queue.submit([encoder.finish()]);

  let observedEvidence = null;
  if (observeGpuEvidence === true) {
    let evidenceWords;
    let evidenceMapped = false;
    try {
      await evidenceReadbackBuffer.mapAsync(GPU_MAP_MODE.READ);
      evidenceMapped = true;
      evidenceWords = new Uint32Array(
        evidenceReadbackBuffer.getMappedRange(),
        0,
        SCHROEDER_SPATIAL_REACTION_DISCOVERY_EVIDENCE_WORDS
      ).slice();
    } catch (error) {
      releaseReactionDiscoveryArenaResources(arenaEntry, arenaLease);
      throw error;
    } finally {
      if (evidenceMapped) evidenceReadbackBuffer.unmap();
    }
    observedEvidence = Object.freeze({
      sourceDispatchCount: evidenceWords[0],
      directoryAdmissionCount: evidenceWords[1],
      directoryRejectionCount: evidenceWords[2],
      candidateVisitCount: evidenceWords[3],
      compatiblePairCount: evidenceWords[4],
      malformedTraversalCount: evidenceWords[5],
      proposalCount: evidenceWords[6],
      sealedRowCount: evidenceWords[7],
      sourceIdentityRejectionCount: evidenceWords[8],
      supportProfileId: evidenceWords[9],
      generationId: evidenceWords[10],
      supportEpoch: evidenceWords[11],
      particleCount: evidenceWords[12],
      reactionCount: evidenceWords[13],
      privateLookupBuildCount: evidenceWords[14],
      overflowCount: evidenceWords[15],
      ruleIndexPairLookupCount: evidenceWords[16],
      ruleIndexPairMissCount: evidenceWords[17],
      ruleIndexRuleVisitCount: evidenceWords[18],
      fullRuleScanRuleVisitCount: evidenceWords[19],
      maximumDisplacementBits: evidenceWords[
        REACTION_DISCOVERY_EVIDENCE_MAXIMUM_DISPLACEMENT_BITS
      ],
      displacementCertificateStatusBits: evidenceWords[
        REACTION_DISCOVERY_EVIDENCE_CERTIFICATE_STATUS_BITS
      ],
      authorityActiveCount: evidenceWords[
        REACTION_DISCOVERY_EVIDENCE_AUTHORITY_ACTIVE_COUNT
      ],
      currentActiveCount: evidenceWords[
        REACTION_DISCOVERY_EVIDENCE_CURRENT_ACTIVE_COUNT
      ],
      exactCellTreeNodeVisitCount: evidenceWords[
        REACTION_DISCOVERY_EVIDENCE_TREE_NODE_VISITS
      ],
      exactCellTreeLeafVisitCount: evidenceWords[
        REACTION_DISCOVERY_EVIDENCE_TREE_LEAF_VISITS
      ],
      exactCellTreeMemberVisitCount: evidenceWords[
        REACTION_DISCOVERY_EVIDENCE_TREE_MEMBER_VISITS
      ]
    });
    if (
      observedEvidence.sourceDispatchCount !== particleCount
      || observedEvidence.directoryAdmissionCount !== particleCount
      || observedEvidence.directoryRejectionCount !== 0
      || observedEvidence.malformedTraversalCount !== 0
      || observedEvidence.proposalCount > particleCount
      || observedEvidence.sealedRowCount !== particleCount
      || observedEvidence.sourceIdentityRejectionCount !== 0
      || observedEvidence.supportProfileId
        !== SCHROEDER_SPATIAL_SUPPORT_PROFILE_REACTION_DISCOVERY_V1
      || observedEvidence.generationId !== authentication.generationId
      || observedEvidence.supportEpoch !== authentication.epochIdentity.supportEpoch
      || observedEvidence.particleCount !== particleCount
      || observedEvidence.reactionCount !== reactionCount
      || observedEvidence.privateLookupBuildCount !== 0
      || observedEvidence.overflowCount !== 0
      || observedEvidence.displacementCertificateStatusBits
        !== DISPLACEMENT_CERTIFICATE_READY_F32_BITS
    ) {
      releaseReactionDiscoveryArenaResources(arenaEntry, arenaLease);
      throw new Error(
        `Canonical reaction discovery GPU completion evidence was missing or rejected: ${JSON.stringify(observedEvidence)}`
      );
    }
  }

  const gpuEvidence = createResidentGpuEvidence({
    authentication,
    proposalBuffer,
    evidenceBuffer,
    observedEvidence,
    byteLength: proposalByteLength,
    capacityByteLength: arenaEntry.proposalCapacityBytes
  });
  const receipt = finalizeSchroederSpatialExactNearConsumerReceipt(
    authentication,
    gpuEvidence
  );
  let destroyed = false;
  let proposalRecord = null;
  // Per-arena uniforms are intentionally retained. The spatial runtime cannot
  // reuse this arena until its generation retires, so no submitted-work
  // callback or transient buffer destruction is required between ticks.
  const cleanupTemporaryBuffersAfterSubmittedWork = () => false;
  const destroy = () => {
    if (destroyed) return false;
    destroyed = true;
    if (proposalRecord?.activationObservationInFlight === true) {
      proposalRecord.releaseAfterActivationObservation = true;
      return true;
    }
    return releaseReactionDiscoveryArenaResources(arenaEntry, arenaLease);
  };

  const proposalArtifact = {
    schema: ULG_SCHROEDER_SPATIAL_REACTION_DISCOVERY_PROPOSAL_SCHEMA,
    status: 'schroeder-spatial-reaction-discovery-proposal-submitted',
    ready: true,
    backend: 'webgpu',
    consumerId: SCHROEDER_SPATIAL_REACTION_DISCOVERY_CONSUMER_ID,
    supportProfileId: SCHROEDER_SPATIAL_SUPPORT_PROFILE_REACTION_DISCOVERY_V1,
    particleCount,
    reactionCount,
    maximumContactRadiusM,
    generation,
    generationId: authentication.generationId,
    epochIdentity: authentication.epochIdentity,
    sourcePositionAuthority:
      'exact-canonical-generation-source-state-buffer',
    sourceCurrentStateAuthority: currentStateBuffer === positionStateBuffer
      ? 'same-buffer-as-canonical-position-authority'
      : 'same-device-current-state-with-canonical-position-authority',
    sourceThermalAuthority: 'same-device-current-thermo-buffer',
    positionAuthorityIdentityExact: true,
    activationValidation:
      'post-thermal-proposal-filtered-and-revalidated-before-mutation',
    proposalSelection:
      'post-thermal-nearest-phase-temperature-material-contact-then-partner-then-reaction',
    displacementCertification:
      'gpu-parallel-e-star-to-current-state-maximum-displacement-and-active-mask-equality',
    displacementCertificateBuffer,
    displacementCertificateStorage:
      'traversal-evidence-words-20-through-23',
    sourceCurrentStateBuffer: currentStateBuffer,
    sourceThermoBuffer: thermoBuffer,
    sourceMechanicsBuffer: mechanicsBuffer,
    proposalBuffer,
    proposalBufferByteLength: proposalByteLength,
    proposalBufferCapacityByteLength: arenaEntry.proposalCapacityBytes,
    proposalRowLayout: SCHROEDER_SPATIAL_REACTION_DISCOVERY_PROPOSAL_ROW_LAYOUT,
    proposalRowStrideFloats: SCHROEDER_SPATIAL_REACTION_DISCOVERY_PROPOSAL_ROW_FLOATS,
    reactionRecordBuffer: resolvedReactionRecordBuffer,
    reactionTable,
    reactionTableFingerprint,
    reactionDiscoveryPayloadFingerprint,
    reactionRuleIndex,
    reactionRecordPrefixByteLength: combined.byteLength,
    reactionRecordUploadByteLength: reactionRecordUpload.byteLength,
    reactionRecordBufferOwned: false,
    reactionRecordBufferOwnership: reactionRecordBuffer
      ? 'borrowed-caller-buffer'
      : 'per-device-canonical-generation-arena-cache',
    reactionRecordBufferCapacityByteLength: reactionRecordBuffer
      ? Number(reactionRecordBuffer.size) || combined.byteLength
      : arenaEntry.reactionRecordCapacityBytes,
    evidenceBuffer,
    evidenceBufferByteLength: evidenceInitial.byteLength,
    directoryBuffer,
    exactNearCellTree: exactNearCellTreeConsumer.tree,
    exactNearCellTreeBuffer,
    directoryAbiVersion: traversalProgram.directoryAbiVersion,
    exactNearCellTreeTraversal:
      traversalProgram.exactNearCellTreeTraversal,
    expectationBuffer,
    positionAuthorityStateBuffer: positionStateBuffer,
    expectationBufferByteLength:
      traversalProgram.expectationBufferByteLength,
    evidenceLayout: SCHROEDER_SPATIAL_REACTION_DISCOVERY_EVIDENCE_LAYOUT,
    observedEvidence,
    evidenceObservationRequested: observeGpuEvidence === true,
    evidenceObservationMode: observeGpuEvidence === true
      ? 'explicit-compact-diagnostic-observation'
      : 'gpu-resident-seal-unobserved',
    evidenceObservationReadbackByteLength: observeGpuEvidence === true
      ? SCHROEDER_SPATIAL_REACTION_DISCOVERY_EVIDENCE_WORDS
        * Uint32Array.BYTES_PER_ELEMENT
      : 0,
    activationObservationRequested: captureActivationObservation === true,
    activationObservationMode: captureActivationObservation === true
      ? 'deferred-schedule-terminal-four-byte-map'
      : 'not-requested',
    activationObservationReadbackByteLength:
      captureActivationObservation === true
        ? REACTION_ACTIVATION_OBSERVATION_BYTES
        : 0,
    activationObservationPredicateRevision:
      reactionMotionEnvelope
        ? SCHROEDER_SPATIAL_REACTION_ACTIVATION_PREDICATE_REVISION
        : SCHROEDER_SPATIAL_REACTION_CURRENT_STATE_PREDICATE_REVISION,
    activationObservationProducerRoute: 'canonical-schroeder',
    activationObservationSampleStage:
      reactionMotionEnvelope
        ? 'canonical-post-thermal-pre-reaction-motion-envelope'
        : 'canonical-post-thermal-pre-reaction-exact-current-state',
    activationObservationNodeDomain:
      reactionMotionEnvelope
        ? 'fixed-phase-carrier-slot'
        : 'primary-carrier-particle',
    reactionMotionEnvelope,
    activationMotionEnvelopeEnabled: Boolean(reactionMotionEnvelope),
    activationMotionBoundsDispatchCount: reactionMotionEnvelope ? 1 : 0,
    activationMotionWatchDispatchCount: reactionMotionEnvelope ? 1 : 0,
    authentication,
    gpuEvidence,
    receipt,
    bufferOwnership: 'per-device-canonical-generation-arena-cache',
    spatialArenaIndex: arenaEntry.arenaIndex,
    arenaAcquisitionOrdinal: arenaLease.acquisitionOrdinal,
    bufferCreationCount: arenaResources.bufferCreationCount,
    arenaTotalBufferCreationCount: arenaEntry.totalBufferCreationCount,
    arenaWarmReuse: arenaResources.bufferCreationCount === 0,
    traversalCount: 1,
    displacementCertificateDispatchCount: 1,
    displacementCertificateWorkgroupCount: workgroups,
    displacementCertificateReductionStrategy:
      'particle-parallel-atomic-u32-max-and-topology-reduction',
    sealDispatchCount: 1,
    directoryBuildCount: 0,
    privateLookupBuildCount: 0,
    fixedCandidateBuildCount: 0,
    exhaustiveTraversalCount: 0,
    candidateBudget: null,
    candidateMaterialization: 'one-deterministic-best-row-per-source',
    fallbackObserved: false,
    fullReadbackPerformed: false,
    fullParticleReadbackPerformed: false,
    fullParticleReadbackFree: true,
    ...createGpuReadbackTelemetry({
      scope: 'schroeder-spatial-reaction-discovery-proposal',
      mapAsyncCount: observeGpuEvidence === true ? 1 : 0,
      readbackBytes: observeGpuEvidence === true
        ? evidenceInitial.byteLength
        : 0
    }),
    readbackMode: 'no-full-readback',
    cleanupTemporaryBuffersAfterSubmittedWork,
    destroy,
    get released() {
      return destroyed;
    }
  };
  proposalRecord = {
    proposal: proposalArtifact,
    device,
    generation,
    directoryAbiVersion: traversalProgram.directoryAbiVersion,
    directoryBuffer,
    exactNearCellTree: exactNearCellTreeConsumer.tree,
    exactNearCellTreeBuffer,
    expectationBuffer,
    positionAuthorityStateBuffer: positionStateBuffer,
    sourceCurrentStateBuffer: currentStateBuffer,
    sourceThermoBuffer: thermoBuffer,
    sourceMechanicsBuffer: mechanicsBuffer,
    displacementCertificateBuffer,
    reactionTable,
    reactionCount,
    reactionRecords: combined,
    reactionTableFingerprint,
    reactionDiscoveryPayloadFingerprint,
    reactionRuleIndex,
    reactionRecordBuffer: resolvedReactionRecordBuffer,
    reactionMotionEnvelope,
    receipt,
    arenaEntry,
    arenaLease,
    activationObservationWordBuffer,
    activationObservationReadbackBuffer,
    activationObservationConsumed: false,
    activationObservationInFlight: false,
    releaseAfterActivationObservation: false,
    activationObservationDeviceTerminalSignal:
      captureActivationObservation === true
        ? reactionObservationDeviceTerminalSignalFor(device)
        : null
  };
  reactionDiscoveryProposalRecords.set(proposalArtifact, proposalRecord);
  return Object.freeze(proposalArtifact);
  } catch (error) {
    releaseReactionDiscoveryArenaResources(arenaEntry, arenaLease);
    throw error;
  }
}

function assertReactionActivationObservationAuthenticity(
  record,
  proposal,
  resolvedDevice
) {
  if (!resolvedDevice || resolvedDevice !== record.device) {
    throw fatalReactionActivationObservationFailure(
      'reaction activation observation buffers do not match the proposal device',
      TypeError
    );
  }
  let currentTable;
  let currentFingerprint;
  try {
    currentTable = reactionRecordArray(record.reactionTable, {
      requireExactPrefixMirror: true
    });
    assertSphReactionMotionEnvelopeRulePrefix(
      currentTable.combined,
      currentTable.reactionCount,
      'reactionTable'
    );
    currentFingerprint = schroederAuthorityTypedArrayFingerprint(
      currentTable.combined,
      'reaction-table-combined-records-v2'
    );
  } catch (error) {
    throw fatalReactionActivationObservationFailure(error, TypeError);
  }
  if (
    record.proposal !== proposal
    || record.generation !== proposal.generation
    || record.directoryAbiVersion !== proposal.directoryAbiVersion
    || record.reactionTable !== proposal.reactionTable
    || currentTable.reactionCount !== record.reactionCount
    || currentTable.reactionCount !== proposal.reactionCount
    || currentTable.combined !== record.reactionRecords
    || record.reactionTableFingerprint !== proposal.reactionTableFingerprint
    || currentFingerprint !== proposal.reactionTableFingerprint
    || record.sourceCurrentStateBuffer !== proposal.sourceCurrentStateBuffer
    || record.sourceThermoBuffer !== proposal.sourceThermoBuffer
    || record.sourceMechanicsBuffer !== proposal.sourceMechanicsBuffer
    || record.reactionMotionEnvelope !== proposal.reactionMotionEnvelope
    || (
      record.reactionMotionEnvelope != null
      && !isExactSphReactionMotionEnvelope(record.reactionMotionEnvelope)
    )
    || record.receipt !== proposal.receipt
    || !isFinalizedSchroederSpatialExactNearConsumerReceipt(proposal.receipt)
    || !record.activationObservationWordBuffer
    || !record.activationObservationReadbackBuffer
    || record.activationObservationWordBuffer
      !== record.arenaEntry?.activationObservationWordBuffer
    || record.activationObservationReadbackBuffer
      !== record.arenaEntry?.activationObservationReadbackBuffer
    || !webGpuBufferMatchesDevice(
      record.activationObservationWordBuffer,
      resolvedDevice
    )
    || !webGpuBufferMatchesDevice(
      record.activationObservationReadbackBuffer,
      resolvedDevice
    )
    || record.activationObservationWordBuffer.size
      !== REACTION_ACTIVATION_CONTROL_BYTES
    || record.activationObservationReadbackBuffer.size
      !== REACTION_ACTIVATION_OBSERVATION_BYTES
    || proposal.activationObservationReadbackByteLength
      !== REACTION_ACTIVATION_OBSERVATION_BYTES
  ) {
    throw fatalReactionActivationObservationFailure(
      'reaction activation observation proposal failed immutable authenticity',
      TypeError
    );
  }
  return true;
}

/**
 * Decode the one-word reaction trigger only after the owning schedule has
 * satisfied its terminal queue fence. The copy was encoded in the proposal's
 * production submission; this function performs no submit and maps exactly
 * four bytes once. A GPU-produced sentinel is an authenticated fail-closed
 * result, while a forged/stale artifact or host mapping failure rejects so the
 * schedule owner can materialize its own conservative observation receipt.
 */
export async function observeSchroederSpatialReactionDiscoveryActivation(
  proposal,
  { device = null } = {}
) {
  let mapAsyncCount = 0;
  try {
  const record = reactionDiscoveryProposalRecords.get(proposal);
  if (
    !record
    || record.proposal !== proposal
    || proposal?.schema
      !== ULG_SCHROEDER_SPATIAL_REACTION_DISCOVERY_PROPOSAL_SCHEMA
    || proposal.ready !== true
    || proposal.released === true
  ) {
    throw fatalReactionActivationObservationFailure(
      'reaction activation observation requires a live authentic proposal',
      TypeError
    );
  }
  if (proposal.activationObservationRequested !== true) {
    throw fatalReactionActivationObservationFailure(
      'reaction activation observation was not requested',
      TypeError
    );
  }
  if (record.activationObservationConsumed === true) {
    throw fatalReactionActivationObservationFailure(
      'reaction activation observation was already consumed'
    );
  }
  if (
    !record.arenaEntry
    || record.arenaEntry.inUse !== true
    || record.arenaEntry.lease !== record.arenaLease
    || record.arenaEntry.activationObservationLease !== record.arenaLease
  ) {
    throw fatalReactionActivationObservationFailure(
      'reaction activation observation lost its authenticated arena lease',
      TypeError
    );
  }
  const resolvedDevice = device || webGpuBufferDevice(
    record.activationObservationReadbackBuffer
  );
  // The generation may already be queue-ordered for retirement by the time
  // the schedule terminal fence resolves. Authenticate the immutable proposal
  // record directly rather than requiring the generation to remain live; the
  // retained arena lease owns this already-copied readback word until destroy.
  assertReactionActivationObservationAuthenticity(
    record,
    proposal,
    resolvedDevice
  );
  const readbackBuffer = record.activationObservationReadbackBuffer;

  record.activationObservationConsumed = true;
  record.activationObservationInFlight = true;
  let mapped = false;
  let rawEvidenceWord;
  try {
    mapAsyncCount = 1;
    if (record.activationObservationDeviceTerminalSignal?.observed) {
      throw new Error(
        'reaction activation observation aborted because the WebGPU device was lost'
      );
    }
    const mapPromise = Promise.resolve(
      readbackBuffer.mapAsync(GPU_MAP_MODE.READ)
    );
    // Device loss can settle before an implementation rejects its pending
    // map. Keep the late rejection handled after the fail-closed race exits.
    mapPromise.catch(() => {});
    const completion = record.activationObservationDeviceTerminalSignal?.promise
      ? await Promise.race([
          mapPromise.then(() => 'mapped'),
          record.activationObservationDeviceTerminalSignal.promise
        ])
      : await mapPromise.then(() => 'mapped');
    if (completion !== 'mapped') {
      throw new Error(
        'reaction activation observation aborted because the WebGPU device was lost while MAP_READ was pending'
      );
    }
    mapped = true;
    const mappedRange = readbackBuffer.getMappedRange(
      0,
      REACTION_ACTIVATION_OBSERVATION_BYTES
    );
    if (
      !mappedRange
      || typeof mappedRange.byteLength !== 'number'
      || mappedRange.byteLength !== REACTION_ACTIVATION_OBSERVATION_BYTES
    ) {
      throw fatalReactionActivationObservationFailure(
        'reaction activation observation returned a malformed mapped range',
        RangeError
      );
    }
    rawEvidenceWord = new Uint32Array(
      mappedRange,
      0,
      1
    )[0];
  } finally {
    try {
      if (mapped) readbackBuffer.unmap();
    } finally {
      record.activationObservationInFlight = false;
      if (record.releaseAfterActivationObservation === true) {
        releaseReactionDiscoveryArenaResources(
          record.arenaEntry,
          record.arenaLease
        );
      }
    }
  }

  // The reaction table can change while MAP_READ is pending. Repeat the full
  // immutable count/identity/fingerprint check before admitting copied bytes.
  assertReactionActivationObservationAuthenticity(
    record,
    proposal,
    resolvedDevice
  );
  const uncertainty = rawEvidenceWord
    === REACTION_ACTIVATION_OBSERVATION_ENCODED_FAILURE;
  if (
    !uncertainty
    && (
      !Number.isSafeInteger(rawEvidenceWord)
      || rawEvidenceWord < REACTION_ACTIVATION_OBSERVATION_COUNT_BIAS
      || rawEvidenceWord
        > proposal.particleCount + REACTION_ACTIVATION_OBSERVATION_COUNT_BIAS
    )
  ) {
    throw fatalReactionActivationObservationFailure(
      'reaction activation observation word exceeded its authenticated source domain',
      RangeError
    );
  }
  const triggeredSourceCount = uncertainty
    ? null
    : rawEvidenceWord - REACTION_ACTIVATION_OBSERVATION_COUNT_BIAS;
  if (
    !uncertainty
    && proposal.reactionMotionEnvelope?.thermalPhaseEvolutionEnabled === true
    && triggeredSourceCount !== proposal.particleCount
  ) {
    throw fatalReactionActivationObservationFailure(
      'thermal/phase-latched reaction activation observation did not trigger every fixed carrier slot'
    );
  }
  const publicEvidenceWord = uncertainty
    ? REACTION_ACTIVATION_OBSERVATION_SENTINEL
    : triggeredSourceCount;
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_REACTION_ACTIVATION_OBSERVATION_SCHEMA,
    status: uncertainty
      ? 'reaction-activation-observation-uncertain'
      : 'reaction-activation-observation-ready',
    predicateRevision:
      proposal.activationObservationPredicateRevision,
    producerRoute: proposal.activationObservationProducerRoute,
    sampleStage: proposal.activationObservationSampleStage,
    nodeDomain: proposal.activationObservationNodeDomain,
    motionEnvelope: proposal.reactionMotionEnvelope,
    shadowOnly: true,
    routingAuthority: false,
    observationSucceeded: !uncertainty,
    triggered: uncertainty || triggeredSourceCount > 0,
    triggeredSourceCount,
    uncertainty,
    rawEvidenceWord: publicEvidenceWord,
    particleCount: proposal.particleCount,
    reactionCount: proposal.reactionCount,
    reactionTableFingerprint: proposal.reactionTableFingerprint,
    mapAsyncCount: 1,
    readbackByteLength: REACTION_ACTIVATION_OBSERVATION_BYTES,
    fullParticleReadbackPerformed: false
  });
  } catch (error) {
    throw reactionActivationObservationFailure(error, mapAsyncCount);
  }
}
