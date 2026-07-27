import {
  MLS_MPM_GPU_GRID_NODE_ROW_LAYOUT,
  SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_MOMENTUM_GRADIENT,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_CONSUMER_LOCAL,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_CONSUMER_CROSS_LEVEL,
  SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY,
  SPH_GPU_REACTION_PRODUCT_EVENT_ROW_LAYOUT,
  ULG_MLS_MPM_GPU_GRID_PROJECTION_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_PROJECTION_PARITY_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import { mlsMpmP2gGridProjectionWgsl } from '../../../ulg-gpu-abi/src/wgsl.js';
import {
  mlsMpmP2gGridProjectionCanonicalSpatialWgsl,
  mlsMpmP2gGridProjectionCanonicalSpatialUnobservedWgsl,
  SCHROEDER_MECHANICS_SPATIAL_AUTHORITY_EVIDENCE_BYTES,
  SCHROEDER_MECHANICS_SPATIAL_AUTHORITY_EVIDENCE_OFFSET_WORDS,
  SCHROEDER_SPATIAL_EPOCH_WITH_MECHANICS_EVIDENCE_BYTES
} from '../../../ulg-gpu-abi/src/schroederMechanicsSpatialAuthorityWgsl.js';
import { requestOpticalGpuDevice } from '../material/opticalGpuBuffers.js';
import { computeBufferBinding, createCachedExplicitComputePipeline } from '../webgpuComputeLayout.js';
import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
  SPH_GPU_PARTICLE_IDENTITY_UINTS,
  SPH_GPU_PARTICLE_STATE_FLOATS,
  SPH_GPU_PARTICLE_THERMO_FLOATS
} from './sphGpuBuffers.js';
import {
  tagWebGpuBufferDevice,
  webGpuBufferMatchesDevice,
  webGpuDeviceId,
  webGpuDeviceMismatchInfo
} from './sphGpuDeviceIdentity.js';
import {
  claimSchroederFusedCoarseTerminalStageProducer,
  claimSchroederFusedFineSubstepStageProducer,
  discardSchroederFusedCoarseTerminalTransaction,
  discardSchroederFusedFineSubstepTransaction,
  markSchroederFusedCoarseTerminalStageSubmissionObserved,
  markSchroederFusedCoarseTerminalStageSubmitted,
  markSchroederFusedFineSubstepStageSubmissionObserved,
  markSchroederFusedFineSubstepStageSubmitted,
  quarantineSchroederFusedCoarseTerminalTransaction,
  quarantineSchroederFusedFineSubstepTransaction,
  releaseSchroederFusedCoarseTerminalStageProducer,
  releaseSchroederFusedFineSubstepStageProducer,
  validateSchroederCanonicalParticleContinuation,
  validateSchroederFusedCoarseTerminalTransaction,
  validateSchroederFusedFineSubstepTransaction
} from './schroederFusedFineSubstepGpu.js';

export {
  ULG_MLS_MPM_GPU_GRID_PROJECTION_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_PROJECTION_PARITY_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA,
  mlsMpmP2gGridProjectionWgsl
};

export const MLS_MPM_GPU_GRID_NODE_FLOATS = MLS_MPM_GPU_GRID_NODE_ROW_LAYOUT.length;
const SCHROEDER_LEVEL_ASSIGNMENT_FLOATS = SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT.length;
export const SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS = SPH_GPU_REACTION_PRODUCT_EVENT_ROW_LAYOUT.length;
export const ULG_MLS_MPM_P2G_BACKEND_POLICY_SCHEMA = 'peercompute.ulg.mls-mpm-p2g-backend-policy.v0';
export const MLS_MPM_P2G_BACKEND_CPU_REFERENCE = 'cpu-reference';
export const MLS_MPM_P2G_BACKEND_RESIDENT_SCATTER = 'resident-scatter';
export const MLS_MPM_P2G_BACKEND_OCEAN_TILED_EXPERIMENTAL = 'ocean-tiled-experimental';
export const MLS_MPM_MECHANICS_FIELD_MODE_DISABLED = 'disabled';
export const MLS_MPM_MECHANICS_FIELD_MODE_REQUIRED = 'required';

const GPU_BUFFER_USAGE = {
  MAP_READ: globalThis.GPUBufferUsage?.MAP_READ ?? 1,
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  INDIRECT: globalThis.GPUBufferUsage?.INDIRECT ?? 256,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64
};

const GPU_MAP_MODE = {
  READ: globalThis.GPUMapMode?.READ ?? 1
};

const DEFAULT_BOX_DIMS_M = Object.freeze([5, 5, 5]);
const DEFAULT_GRID_SHIFT = 1;
const GRID_SCOPE = 'particle-parallel-scatter-p2g-stress-momentum-projection';
const FULL_READBACK_MODE = 'full-parity-readback';
const NO_FULL_READBACK_MODE = 'no-full-readback';
const EMPTY_PRODUCT_EVENT_STORAGE_ROWS = new Float32Array(SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS);
const P2G_ACCUMULATOR_COMPONENTS = 4;
const P2G_PARAMS_BYTES = 144;
const MECHANICS_FIELD_P2G_PARAMS_BYTES = 160;
const SPH_PARTICLE_STATE_STRIDE_BYTES =
  SPH_GPU_PARTICLE_STATE_FLOATS * Float32Array.BYTES_PER_ELEMENT;
const SPH_PARTICLE_THERMO_STRIDE_BYTES =
  SPH_GPU_PARTICLE_THERMO_FLOATS * Float32Array.BYTES_PER_ELEMENT;
const SPH_PARTICLE_IDENTITY_STRIDE_BYTES =
  SPH_GPU_PARTICLE_IDENTITY_UINTS * Uint32Array.BYTES_PER_ELEMENT;
const MLS_MPM_PARTICLE_MECHANICS_STRIDE_BYTES =
  MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS * Float32Array.BYTES_PER_ELEMENT;
const SCHROEDER_SPATIAL_EPOCH_SCHEMA = 'peercompute.ulg.schroeder-spatial-epoch.v1';
const SCHROEDER_SPATIAL_EPOCH_GENERATION_SCHEMA =
  'peercompute.ulg.schroeder-spatial-epoch-generation.v1';
const mechanicsFieldP2gOrigins = new WeakMap();
const mechanicsFieldP2gClaims = new WeakMap();
const TAIT_EXPONENT = 7;
const EOS_MODEL_IDS = Object.freeze({
  disabled: 0,
  taitCondensed: 1,
  gasLinearized: 2
});

function exactParticleBufferByteLength(particleCount, strideBytes) {
  return particleCount * strideBytes;
}

function fusedParticleUploadAbiMatches(
  device,
  sphParticleUpload,
  mlsMpmParticleUpload,
  particleCount
) {
  if (!Number.isSafeInteger(particleCount) || particleCount <= 0) return false;
  const stateBufferByteLength = exactParticleBufferByteLength(
    particleCount,
    SPH_PARTICLE_STATE_STRIDE_BYTES
  );
  const thermoBufferByteLength = exactParticleBufferByteLength(
    particleCount,
    SPH_PARTICLE_THERMO_STRIDE_BYTES
  );
  const mechanicsBufferByteLength = exactParticleBufferByteLength(
    particleCount,
    MLS_MPM_PARTICLE_MECHANICS_STRIDE_BYTES
  );
  const identityBufferByteLength = exactParticleBufferByteLength(
    particleCount,
    SPH_PARTICLE_IDENTITY_STRIDE_BYTES
  );
  const buffers = [
    [sphParticleUpload?.stateBuffer, stateBufferByteLength],
    [sphParticleUpload?.thermoBuffer, thermoBufferByteLength],
    [mlsMpmParticleUpload?.mechanicsBuffer, mechanicsBufferByteLength]
  ];
  return Boolean(
    sphParticleUpload?.schema === ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA
    && mlsMpmParticleUpload?.schema
      === ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA
    && sphParticleUpload?.particleCount === particleCount
    && mlsMpmParticleUpload?.particleCount === particleCount
    && sphParticleUpload?.stateStrideBytes === SPH_PARTICLE_STATE_STRIDE_BYTES
    && sphParticleUpload?.thermoStrideBytes === SPH_PARTICLE_THERMO_STRIDE_BYTES
    && sphParticleUpload?.identityStrideBytes
      === SPH_PARTICLE_IDENTITY_STRIDE_BYTES
    && mlsMpmParticleUpload?.mechanicsStrideBytes
      === MLS_MPM_PARTICLE_MECHANICS_STRIDE_BYTES
    && sphParticleUpload?.stateBufferByteLength === stateBufferByteLength
    && sphParticleUpload?.thermoBufferByteLength === thermoBufferByteLength
    && sphParticleUpload?.identityBufferByteLength === identityBufferByteLength
    && mlsMpmParticleUpload?.mechanicsBufferByteLength
      === mechanicsBufferByteLength
    && buffers.every(([buffer, requiredByteLength]) => {
      const bufferSize = Number(buffer?.size);
      return Boolean(
        buffer
        && buffer.destroyed !== true
        && Number.isFinite(bufferSize)
        && bufferSize >= requiredByteLength
        && webGpuBufferMatchesDevice(buffer, device)
      );
    })
    && sphParticleUpload?.identityBuffer
    && sphParticleUpload.identityBuffer.destroyed !== true
    && Number.isFinite(Number(sphParticleUpload.identityBuffer.size))
    && Number(sphParticleUpload.identityBuffer.size) >= identityBufferByteLength
    && webGpuBufferMatchesDevice(sphParticleUpload.identityBuffer, device)
  );
}

function mechanicsFieldP2gMatchesOrigin(projection, origin, options = {}) {
  const fine = origin?.transactionMode === 'fine';
  const terminal = origin?.transactionMode === 'coarse-terminal';
  return Boolean(
    origin
    && projection === origin.projection
    && projection?.backend === 'webgpu'
    && projection?.status === 'projected'
    && (fine
      ? projection?.fusedFineSubstepTransaction === origin.transaction
        && projection?.fineMicroepochAuthority === origin.microepochAuthority
        && projection?.fusedCoarseTerminalTransaction == null
      : terminal
        ? projection?.fusedCoarseTerminalTransaction === origin.transaction
        && projection?.terminalMicroepochAuthority === origin.microepochAuthority
        && projection?.fusedFineSubstepTransaction == null
      : false)
    && projection?.sourceParticleContinuation === origin.particleContinuation
    && projection?.proposalMode === origin.proposalMode
    && projection?.mechanicsFieldViewExecution === origin.fieldExecution
    && projection?.mechanicsFieldViewBuffer === origin.fieldBuffer
    && origin.fieldExecution?.ownerRuntime === origin.fieldRuntime
    && origin.fieldRuntime?.ownsExecution?.(origin.fieldExecution) === true
    && origin.fieldRuntime?.isExecutionSubmitted?.(origin.fieldExecution) === true
    && origin.fieldExecution?.stableCandidateOrderBuffer
      === origin.stableCandidateOrderBuffer
    && origin.fieldExecution?.stableCandidateOrderCount
      === origin.stableCandidateOrderCount
    && origin.fieldExecution?.stableCandidateOrderPolicy
      === origin.stableCandidateOrderPolicy
    && origin.fieldExecution?.ownsStableCandidateOrderBuffer === false
    && origin.stableCandidateOrderBuffer?.destroyed !== true
    && Number(origin.stableCandidateOrderBuffer?.size)
      === origin.stableCandidateOrderBufferSize
    && webGpuBufferMatchesDevice(origin.stableCandidateOrderBuffer, origin.device)
    && projection?.mechanicsFieldMutationInputOrdinal === origin.inputOrdinal
    && projection?.mechanicsFieldMutationOutputOrdinal === origin.outputOrdinal
    && projection?.mechanicsFieldMutationInputStateEncoding === origin.inputEncoding
    && projection?.mechanicsFieldMutationOutputStateEncoding === origin.outputEncoding
    && Object.is(projection?.ambientPressurePa, origin.pressureAmbientPressurePa)
    && Object.is(projection?.internalPressureScale, origin.pressureInternalScale)
    && projection?.mechanicsFieldPressureRequiredConsumerMask
      === origin.pressureRequiredConsumerMask
    && projection?.dt === origin.dt
    && projection?.gridSpacingM === origin.gridSpacingM
    && projection?.gridNodeCount === origin.gridNodeCount
    && projection?.gridShift === origin.gridShift
    && projection?.particleCount === origin.particleCount
    && Array.isArray(projection?.gridDims)
    && projection.gridDims.length === origin.gridDims.length
    && origin.gridDims.every((value, index) => projection.gridDims[index] === value)
    && origin.sphParticleUpload?.stateBuffer === origin.stateBuffer
    && origin.sphParticleUpload?.thermoBuffer === origin.thermoBuffer
    && origin.sphParticleUpload?.identityBuffer === origin.identityBuffer
    && origin.mlsMpmParticleUpload?.mechanicsBuffer === origin.mechanicsBuffer
    && origin.sphParticleUpload?.particleCount === origin.particleCount
    && origin.mlsMpmParticleUpload?.particleCount === origin.particleCount
    && origin.sphParticleUpload?.stateStrideBytes === origin.stateStrideBytes
    && origin.sphParticleUpload?.thermoStrideBytes === origin.thermoStrideBytes
    && origin.sphParticleUpload?.identityStrideBytes === origin.identityStrideBytes
    && origin.mlsMpmParticleUpload?.mechanicsStrideBytes
      === origin.mechanicsStrideBytes
    && origin.sphParticleUpload?.stateBufferByteLength
      === origin.stateBufferByteLength
    && origin.sphParticleUpload?.thermoBufferByteLength
      === origin.thermoBufferByteLength
    && origin.sphParticleUpload?.identityBufferByteLength
      === origin.identityBufferByteLength
    && origin.mlsMpmParticleUpload?.mechanicsBufferByteLength
      === origin.mechanicsBufferByteLength
    && Number(origin.stateBuffer?.size) === origin.stateBufferSize
    && Number(origin.thermoBuffer?.size) === origin.thermoBufferSize
    && Number(origin.mechanicsBuffer?.size) === origin.mechanicsBufferSize
    && Number(origin.identityBuffer?.size) === origin.identityBufferSize
    && fusedParticleUploadAbiMatches(
      origin.device,
      origin.sphParticleUpload,
      origin.mlsMpmParticleUpload,
      origin.particleCount
    )
    && origin.transaction?.macroAuthority === origin.macroAuthority
    && origin.transaction?.microepochAuthority === origin.microepochAuthority
    && origin.transaction?.particleContinuation === origin.particleContinuation
    && origin.transaction?.p2gMutation === origin.mutationSegment
    && Object.is(
      origin.dt,
      fine ? origin.macroAuthority?.fineDt : origin.macroAuthority?.macroDt
    )
    && origin.selectedLevel === (fine
      ? origin.macroAuthority?.fineLevel
      : origin.macroAuthority?.coarseLevel)
    && projection?.schroederLevelFilter?.selectedLevel === origin.selectedLevel
    && origin.canonicalGeneration === origin.microepochAuthority?.generation
    && origin.fieldExecution === (fine
      ? origin.transaction?.fineFieldView
      : origin.transaction?.coarseFieldView)
    && origin.proposalMode === 'proposal-deferred-to-post-mechanics'
    && (fine
      ? validateSchroederFusedFineSubstepTransaction(
          origin.device,
          origin.transaction,
          {
            macroAuthority: origin.macroAuthority,
            microepochAuthority: origin.microepochAuthority,
            particleContinuation: origin.particleContinuation
          }
        )
      : validateSchroederFusedCoarseTerminalTransaction(
          origin.device,
          origin.transaction,
          {
            macroAuthority: origin.macroAuthority,
            microepochAuthority: origin.microepochAuthority,
            particleContinuation: origin.particleContinuation
          }
        ))
    && validateSchroederCanonicalParticleContinuation(
      origin.device,
      origin.particleContinuation,
      {
        macroAuthority: origin.macroAuthority,
        sphParticleUpload: origin.sphParticleUpload,
        mlsMpmParticleUpload: origin.mlsMpmParticleUpload,
        stateBuffer: origin.stateBuffer,
        thermoBuffer: origin.thermoBuffer,
        identityBuffer: origin.identityBuffer,
        mechanicsBuffer: origin.mechanicsBuffer
      }
    )
    && (fine
      ? (options.transaction == null || options.transaction === origin.transaction)
        && options.terminalTransaction == null
      : (options.terminalTransaction == null
          || options.terminalTransaction === origin.transaction)
        && options.transaction == null)
    && (options.macroAuthority == null
      || options.macroAuthority === origin.macroAuthority)
    && (options.microepochAuthority == null
      || options.microepochAuthority === origin.microepochAuthority)
    && (options.particleContinuation == null
      || options.particleContinuation === origin.particleContinuation)
    && (options.fieldExecution == null
      || options.fieldExecution === origin.fieldExecution)
    && (options.mutationSegment == null
      || options.mutationSegment === origin.mutationSegment)
    && (options.requireDeferred !== true
      || origin.proposalMode === 'proposal-deferred-to-post-mechanics')
    && (options.proposalMode == null
      || options.proposalMode === origin.proposalMode)
    && options.priorArtifact == null
  );
}

function registerSubmittedMechanicsFieldP2g(
  device,
  projection,
  {
    transaction,
    particleContinuation,
    mutationSegment,
    sphParticleUpload,
    mlsMpmParticleUpload,
    transactionMode = 'fine',
    canonicalGeneration = null,
    selectedLevel = null
  }
) {
  const origin = Object.freeze({
    device,
    deviceId: webGpuDeviceId(device),
    projection,
    transaction,
    transactionMode,
    macroAuthority: transaction.macroAuthority,
    microepochAuthority: transaction.microepochAuthority,
    particleContinuation,
    mutationSegment,
    proposalMode: 'proposal-deferred-to-post-mechanics',
    fieldExecution: projection.mechanicsFieldViewExecution,
    fieldBuffer: projection.mechanicsFieldViewBuffer,
    fieldRuntime: projection.mechanicsFieldViewExecution?.ownerRuntime ?? null,
    stableCandidateOrderBuffer:
      projection.mechanicsFieldViewExecution?.stableCandidateOrderBuffer ?? null,
    stableCandidateOrderBufferSize: Number(
      projection.mechanicsFieldViewExecution?.stableCandidateOrderBuffer?.size
    ),
    stableCandidateOrderCount:
      projection.mechanicsFieldViewExecution?.stableCandidateOrderCount ?? null,
    stableCandidateOrderPolicy:
      projection.mechanicsFieldViewExecution?.stableCandidateOrderPolicy ?? null,
    inputOrdinal: projection.mechanicsFieldMutationInputOrdinal,
    outputOrdinal: projection.mechanicsFieldMutationOutputOrdinal,
    inputEncoding: projection.mechanicsFieldMutationInputStateEncoding,
    outputEncoding: projection.mechanicsFieldMutationOutputStateEncoding,
    // Pressure-law provenance. The pressure rows this P2G sealed are only
    // meaningful together with the law that produced them, so the exact
    // ambient reference, EOS gauge scale, and declared consumer mask are bound
    // to the originating transaction alongside the mutation ordinals.
    pressureAmbientPressurePa: projection.ambientPressurePa,
    pressureInternalScale: projection.internalPressureScale,
    pressureRequiredConsumerMask:
      projection.mechanicsFieldPressureRequiredConsumerMask,
    dt: projection.dt,
    gridSpacingM: projection.gridSpacingM,
    gridNodeCount: projection.gridNodeCount,
    gridShift: projection.gridShift,
    gridDims: Object.freeze([...projection.gridDims]),
    sphParticleUpload,
    mlsMpmParticleUpload,
    stateBuffer: sphParticleUpload.stateBuffer,
    thermoBuffer: sphParticleUpload.thermoBuffer,
    identityBuffer: sphParticleUpload.identityBuffer ?? null,
    mechanicsBuffer: mlsMpmParticleUpload.mechanicsBuffer,
    particleCount: projection.particleCount,
    stateStrideBytes: sphParticleUpload.stateStrideBytes,
    thermoStrideBytes: sphParticleUpload.thermoStrideBytes,
    identityStrideBytes: sphParticleUpload.identityStrideBytes,
    mechanicsStrideBytes: mlsMpmParticleUpload.mechanicsStrideBytes,
    stateBufferByteLength: sphParticleUpload.stateBufferByteLength,
    thermoBufferByteLength: sphParticleUpload.thermoBufferByteLength,
    identityBufferByteLength: sphParticleUpload.identityBufferByteLength,
    mechanicsBufferByteLength: mlsMpmParticleUpload.mechanicsBufferByteLength,
    stateBufferSize: Number(sphParticleUpload.stateBuffer?.size),
    thermoBufferSize: Number(sphParticleUpload.thermoBuffer?.size),
    mechanicsBufferSize: Number(mlsMpmParticleUpload.mechanicsBuffer?.size),
    identityBufferSize: Number(sphParticleUpload.identityBuffer?.size),
    canonicalGeneration,
    selectedLevel
  });
  if (!mechanicsFieldP2gMatchesOrigin(projection, origin, {
    ...(transactionMode === 'fine'
      ? { transaction }
      : { terminalTransaction: transaction }),
    macroAuthority: transaction.macroAuthority,
    microepochAuthority: transaction.microepochAuthority,
    particleContinuation,
    fieldExecution: projection.mechanicsFieldViewExecution,
    mutationSegment,
    requireDeferred: true,
    proposalMode: 'proposal-deferred-to-post-mechanics'
  })) {
    throw new TypeError(
      'submitted mechanics-field P2G does not match its exact fused producer inputs'
    );
  }
  mechanicsFieldP2gOrigins.set(projection, origin);
  return projection;
}

export function validateLocallySubmittedMlsMpmMechanicsFieldP2g(
  device,
  projection,
  options = {}
) {
  const origin = mechanicsFieldP2gOrigins.get(projection);
  return origin?.deviceId === webGpuDeviceId(device)
    && mechanicsFieldP2gMatchesOrigin(projection, origin, options);
}

export function resolveMlsMpmP2gBackendPolicy({
  requestedBackend = MLS_MPM_P2G_BACKEND_RESIDENT_SCATTER,
  supportsOceanTiledKernel = false
} = {}) {
  const normalizedRequestedBackend = typeof requestedBackend === 'string' && requestedBackend.trim()
    ? requestedBackend.trim()
    : MLS_MPM_P2G_BACKEND_RESIDENT_SCATTER;
  if (normalizedRequestedBackend === MLS_MPM_P2G_BACKEND_CPU_REFERENCE) {
    return {
      schema: ULG_MLS_MPM_P2G_BACKEND_POLICY_SCHEMA,
      status: 'cpu-reference-backend-selected',
      requestedBackend: normalizedRequestedBackend,
      effectiveBackend: MLS_MPM_P2G_BACKEND_CPU_REFERENCE,
      fallbackBackend: null,
      fallbackReason: null,
      experimentalBackendRequested: false,
      oceanTiledKernelAvailable: false,
      kernelScope: 'cpu-reference-p2g-stress-momentum-projection',
      dispatchTopology: 'cpu-reference-particle-loop',
      particleLoopInHotPath: true,
      gridWriteMode: 'cpu-grid-accumulate'
    };
  }
  const aliases = new Set([
    MLS_MPM_P2G_BACKEND_RESIDENT_SCATTER,
    'current',
    'current-resident',
    'webgpu-scatter',
    'particle-parallel-scatter'
  ]);
  if (aliases.has(normalizedRequestedBackend)) {
    return {
      schema: ULG_MLS_MPM_P2G_BACKEND_POLICY_SCHEMA,
      status: 'resident-scatter-backend-selected',
      requestedBackend: normalizedRequestedBackend,
      effectiveBackend: MLS_MPM_P2G_BACKEND_RESIDENT_SCATTER,
      fallbackBackend: null,
      fallbackReason: null,
      experimentalBackendRequested: false,
      oceanTiledKernelAvailable: false,
      kernelScope: GRID_SCOPE,
      dispatchTopology: 'particle-parallel-scatter',
      particleLoopInHotPath: false,
      gridWriteMode: 'atomic-grid-accumulator-scatter'
    };
  }
  if (normalizedRequestedBackend === MLS_MPM_P2G_BACKEND_OCEAN_TILED_EXPERIMENTAL) {
    const effectiveBackend = supportsOceanTiledKernel
      ? MLS_MPM_P2G_BACKEND_OCEAN_TILED_EXPERIMENTAL
      : MLS_MPM_P2G_BACKEND_RESIDENT_SCATTER;
    return {
      schema: ULG_MLS_MPM_P2G_BACKEND_POLICY_SCHEMA,
      status: supportsOceanTiledKernel
        ? 'ocean-tiled-backend-selected'
        : 'ocean-tiled-backend-fallback-resident-scatter',
      requestedBackend: normalizedRequestedBackend,
      effectiveBackend,
      fallbackBackend: supportsOceanTiledKernel ? null : MLS_MPM_P2G_BACKEND_RESIDENT_SCATTER,
      fallbackReason: supportsOceanTiledKernel ? null : 'ocean-tiled-p2g-kernel-not-available',
      experimentalBackendRequested: true,
      oceanTiledKernelAvailable: supportsOceanTiledKernel,
      kernelScope: supportsOceanTiledKernel ? 'ocean-tiled-p2g-stress-momentum-projection' : GRID_SCOPE,
      dispatchTopology: supportsOceanTiledKernel ? 'tile-parallel-scatter' : 'particle-parallel-scatter',
      particleLoopInHotPath: false,
      gridWriteMode: supportsOceanTiledKernel
        ? 'tile-local-accumulator-flush'
        : 'atomic-grid-accumulator-scatter'
    };
  }
  return {
    schema: ULG_MLS_MPM_P2G_BACKEND_POLICY_SCHEMA,
    status: 'unknown-backend-fallback-resident-scatter',
    requestedBackend: normalizedRequestedBackend,
    effectiveBackend: MLS_MPM_P2G_BACKEND_RESIDENT_SCATTER,
    fallbackBackend: MLS_MPM_P2G_BACKEND_RESIDENT_SCATTER,
    fallbackReason: 'unknown-p2g-backend',
    experimentalBackendRequested: false,
    oceanTiledKernelAvailable: false,
    kernelScope: GRID_SCOPE,
    dispatchTopology: 'particle-parallel-scatter',
    particleLoopInHotPath: false,
    gridWriteMode: 'atomic-grid-accumulator-scatter'
  };
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function finiteVector3(value, fallback) {
  const source = Array.isArray(value) ? value : fallback;
  return [
    finiteNumber(source?.[0], fallback[0]),
    finiteNumber(source?.[1], fallback[1]),
    finiteNumber(source?.[2], fallback[2])
  ];
}

function normalizeSchroederLevelFilter({
  schroederLevelAssignment = null,
  schroederSelectedLevel = null
} = {}) {
  const filterEnabled = schroederLevelAssignment
    && Number.isFinite(Number(schroederSelectedLevel));
  const assignmentStrideFloats = Math.max(1, Math.round(finiteNumber(
    schroederLevelAssignment?.assignmentStrideFloats,
    SCHROEDER_LEVEL_ASSIGNMENT_FLOATS
  )));
  return {
    enabled: Boolean(filterEnabled),
    selectedLevel: Math.round(finiteNumber(schroederSelectedLevel, 0)),
    assignmentStrideFloats
  };
}

function particlePassesSchroederLevelFilter(particleIndex, filter, assignmentRows = null) {
  if (!filter?.enabled) return true;
  if (!(assignmentRows instanceof Float32Array)) return false;
  const offset = particleIndex * filter.assignmentStrideFloats;
  return Math.round(finiteNumber(assignmentRows[offset], Number.NaN)) === filter.selectedLevel;
}

function assertPackedInputs({ sphParticleState, mlsMpmParticleState }) {
  if (sphParticleState?.schema !== ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA) {
    throw new TypeError('MLS-MPM grid projection requires a packed SPH GPU particle buffer');
  }
  if (mlsMpmParticleState?.schema !== ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA) {
    throw new TypeError('MLS-MPM grid projection requires a packed MLS-MPM GPU particle buffer');
  }
  if (sphParticleState.particleCount !== mlsMpmParticleState.particleCount) {
    throw new RangeError('SPH and MLS-MPM particle buffer counts must match');
  }
}

export function createMlsMpmGridSpec({
  boxDimsM = DEFAULT_BOX_DIMS_M,
  gridSpacingM,
  shift = DEFAULT_GRID_SHIFT
} = {}) {
  const dims = finiteVector3(boxDimsM, DEFAULT_BOX_DIMS_M);
  // The spacing is consumed by WGSL as f32. Derive the host grid topology
  // from that exact ABI value too; otherwise a non-binary spacing can publish
  // field-view dimensions from the JS double while P2G authenticates against
  // the rounded GPU value (most visibly at half-cell rounding boundaries).
  const dx = Math.fround(finiteNumber(gridSpacingM, 0));
  if (!(dx > 0)) throw new RangeError('createMlsMpmGridSpec requires a positive gridSpacingM');
  const gridDims = [
    Math.round(dims[0] / dx) + 5,
    Math.round(dims[1] / dx) + 5,
    Math.round(dims[2] / dx) + 5
  ];
  return {
    gridSpacingM: dx,
    invGridSpacingM: 1 / dx,
    boxDimsM: dims,
    shift,
    gridDims,
    gridNodeCount: gridDims[0] * gridDims[1] * gridDims[2]
  };
}

function quadraticWeights(fx) {
  const a = 1.5 - fx;
  const b = fx - 1;
  const c = fx - 0.5;
  return [0.5 * a * a, 0.75 - b * b, 0.5 * c * c];
}

function gridNodeCoords(nodeIndex, gridSpec) {
  const [, gny, gnz] = gridSpec.gridDims;
  const plane = gny * gnz;
  const i = Math.floor(nodeIndex / plane);
  const rem = nodeIndex - i * plane;
  const j = Math.floor(rem / gnz);
  const k = rem - j * gnz;
  return {
    i,
    j,
    k,
    nodeI: i - gridSpec.shift,
    nodeJ: j - gridSpec.shift,
    nodeK: k - gridSpec.shift
  };
}

function gridNodeIndexFromCoords(i, j, k, gridSpec) {
  if (
    i < 0 || j < 0 || k < 0
    || i >= gridSpec.gridDims[0]
    || j >= gridSpec.gridDims[1]
    || k >= gridSpec.gridDims[2]
  ) {
    return -1;
  }
  return (i * gridSpec.gridDims[1] + j) * gridSpec.gridDims[2] + k;
}

function det3(F) {
  return F[0] * (F[4] * F[8] - F[5] * F[7])
    - F[1] * (F[3] * F[8] - F[5] * F[6])
    + F[2] * (F[3] * F[7] - F[4] * F[6]);
}

function corotatedCauchyStress(F, mu, lambda) {
  const [f0, f1, f2, f3, f4, f5, f6, f7, f8] = F;
  let r0 = f0; let r1 = f1; let r2 = f2;
  let r3 = f3; let r4 = f4; let r5 = f5;
  let r6 = f6; let r7 = f7; let r8 = f8;
  for (let it = 0; it < 12; it += 1) {
    const det = r0 * (r4 * r8 - r5 * r7) - r1 * (r3 * r8 - r5 * r6) + r2 * (r3 * r7 - r4 * r6);
    if (Math.abs(det) < 1e-12) break;
    const id = 1 / det;
    const t0 = (r4 * r8 - r5 * r7) * id; const t3 = (r2 * r7 - r1 * r8) * id; const t6 = (r1 * r5 - r2 * r4) * id;
    const t1 = (r5 * r6 - r3 * r8) * id; const t4 = (r0 * r8 - r2 * r6) * id; const t7 = (r2 * r3 - r0 * r5) * id;
    const t2 = (r3 * r7 - r4 * r6) * id; const t5 = (r1 * r6 - r0 * r7) * id; const t8 = (r0 * r4 - r1 * r3) * id;
    const n0 = 0.5 * (r0 + t0); const n1 = 0.5 * (r1 + t1); const n2 = 0.5 * (r2 + t2);
    const n3 = 0.5 * (r3 + t3); const n4 = 0.5 * (r4 + t4); const n5 = 0.5 * (r5 + t5);
    const n6 = 0.5 * (r6 + t6); const n7 = 0.5 * (r7 + t7); const n8 = 0.5 * (r8 + t8);
    const diff = Math.abs(n0 - r0) + Math.abs(n4 - r4) + Math.abs(n8 - r8);
    r0 = n0; r1 = n1; r2 = n2; r3 = n3; r4 = n4; r5 = n5; r6 = n6; r7 = n7; r8 = n8;
    if (diff < 1e-10) break;
  }
  const J = det3(F);
  if (Math.abs(J) < 1e-12) return new Array(9).fill(0);
  const jid = 1 / J;
  const ft0 = (f4 * f8 - f5 * f7) * jid; const ft3 = (f2 * f7 - f1 * f8) * jid; const ft6 = (f1 * f5 - f2 * f4) * jid;
  const ft1 = (f5 * f6 - f3 * f8) * jid; const ft4 = (f0 * f8 - f2 * f6) * jid; const ft7 = (f2 * f3 - f0 * f5) * jid;
  const ft2 = (f3 * f7 - f4 * f6) * jid; const ft5 = (f1 * f6 - f0 * f7) * jid; const ft8 = (f0 * f4 - f1 * f3) * jid;
  const c = lambda * (J - 1) * J;
  const p0 = 2 * mu * (f0 - r0) + c * ft0; const p1 = 2 * mu * (f1 - r1) + c * ft1; const p2 = 2 * mu * (f2 - r2) + c * ft2;
  const p3 = 2 * mu * (f3 - r3) + c * ft3; const p4 = 2 * mu * (f4 - r4) + c * ft4; const p5 = 2 * mu * (f5 - r5) + c * ft5;
  const p6 = 2 * mu * (f6 - r6) + c * ft6; const p7 = 2 * mu * (f7 - r7) + c * ft7; const p8 = 2 * mu * (f8 - r8) + c * ft8;
  return [
    (p0 * f0 + p1 * f1 + p2 * f2) * jid, (p0 * f3 + p1 * f4 + p2 * f5) * jid, (p0 * f6 + p1 * f7 + p2 * f8) * jid,
    (p3 * f0 + p4 * f1 + p5 * f2) * jid, (p3 * f3 + p4 * f4 + p5 * f5) * jid, (p3 * f6 + p4 * f7 + p5 * f8) * jid,
    (p6 * f0 + p7 * f1 + p8 * f2) * jid, (p6 * f3 + p7 * f4 + p8 * f5) * jid, (p6 * f6 + p7 * f7 + p8 * f8) * jid
  ];
}

function pressureFromPackedParticle({
  densityKgPerM3,
  restDensityKgPerM3,
  soundSpeedMPerS,
  eosModelId,
  internalPressureScale = 1,
  ambientPressurePa = 0,
  gasFraction = null
}) {
  if (!(densityKgPerM3 > 0) || !(restDensityKgPerM3 > 0)) return 0;
  const pressureScale = finiteNumber(internalPressureScale, 1);
  if (pressureScale === 0) return 0;
  if (Math.round(eosModelId) === EOS_MODEL_IDS.gasLinearized) {
    // Admitted gas particles carry an explicit phase fraction and use the
    // same ambient-referenced, CFL-reduced closure as the resident WGSL path.
    // The rest density is defined at one standard atmosphere; scaling it by
    // ambient pressure gives the density at which gauge pressure is zero.
    // Positionless product-event sidecars do not carry that fraction yet, so
    // they retain the bounded packed linearized closure below.
    if (gasFraction !== null && gasFraction !== undefined) {
      const admittedGasFraction = Math.min(1, Math.max(0, finiteNumber(gasFraction, 0)));
      const referenceDensityKgPerM3 = restDensityKgPerM3
        * Math.max(0, finiteNumber(ambientPressurePa, 0)) / 101325;
      const partialPressurePa = soundSpeedMPerS * soundSpeedMPerS
        * (densityKgPerM3 - referenceDensityKgPerM3);
      return pressureScale * admittedGasFraction * partialPressurePa;
    }
    if (!(soundSpeedMPerS > 0)) return 0;
    return pressureScale * Math.max(0, soundSpeedMPerS * soundSpeedMPerS * (densityKgPerM3 - restDensityKgPerM3));
  }
  if (Math.round(eosModelId) === EOS_MODEL_IDS.taitCondensed) {
    if (!(soundSpeedMPerS > 0)) return 0;
    const ratio = densityKgPerM3 / Math.max(restDensityKgPerM3, 1e-9);
    const stiffnessPa = restDensityKgPerM3 * soundSpeedMPerS * soundSpeedMPerS / TAIT_EXPONENT;
    // Cavitation clamp (WGSL packed_pressure parity): unbounded signed Tait
    // tension is bulk-scale artificial cohesion and drives the MLS-MPM
    // tensile pairing instability (mm-separation pairs, pearl-string clumps).
    const pressurePa = Math.max(
      stiffnessPa * (ratio ** TAIT_EXPONENT - 1),
      -0.05 * stiffnessPa
    );
    return pressureScale * pressurePa;
  }
  return 0;
}

function addNewtonianViscousStress(stress, C, dynamicViscosityPaS) {
  const mu = Math.max(finiteNumber(dynamicViscosityPaS, 0), 0);
  if (!(mu > 0)) return stress;
  const divThird = (C[0] + C[4] + C[8]) / 3;
  stress[0] += 2 * mu * (C[0] - divThird);
  stress[4] += 2 * mu * (C[4] - divThird);
  stress[8] += 2 * mu * (C[8] - divThird);
  const s01 = mu * (C[1] + C[3]);
  const s02 = mu * (C[2] + C[6]);
  const s12 = mu * (C[5] + C[7]);
  stress[1] += s01; stress[3] += s01;
  stress[2] += s02; stress[6] += s02;
  stress[5] += s12; stress[7] += s12;
  return stress;
}

function stressTensorForPackedParticle({
  sphParticleState,
  mlsMpmParticleState,
  stateOffset,
  thermoOffset,
  mechanicsOffset,
  internalPressureScale = 1,
  ambientPressurePa = 0,
  externalGaugePressurePa = 0,
  externalGaugePressureEnabled = false
}) {
  const F = [
    mlsMpmParticleState.mechanics[mechanicsOffset],
    mlsMpmParticleState.mechanics[mechanicsOffset + 1],
    mlsMpmParticleState.mechanics[mechanicsOffset + 2],
    mlsMpmParticleState.mechanics[mechanicsOffset + 3],
    mlsMpmParticleState.mechanics[mechanicsOffset + 4],
    mlsMpmParticleState.mechanics[mechanicsOffset + 5],
    mlsMpmParticleState.mechanics[mechanicsOffset + 6],
    mlsMpmParticleState.mechanics[mechanicsOffset + 7],
    mlsMpmParticleState.mechanics[mechanicsOffset + 8]
  ];
  const restVolumeM3 = mlsMpmParticleState.mechanics[mechanicsOffset + 19];
  const J = finiteNumber(mlsMpmParticleState.mechanics[mechanicsOffset + 18], det3(F));
  const volumeM3 = Math.max(restVolumeM3 * Math.max(J, 1e-9), 1e-30);
  const densityKgPerM3 = sphParticleState.state[stateOffset + 3] / volumeM3;
  const restDensityKgPerM3 = sphParticleState.thermo[thermoOffset + 3];
  const solidFlag = mlsMpmParticleState.mechanics[mechanicsOffset + 20];
  const shearModulusPa = mlsMpmParticleState.mechanics[mechanicsOffset + 23];
  const lambdaPa = mlsMpmParticleState.mechanics[mechanicsOffset + 24];
  let stress;
  if (solidFlag > 0.5 && shearModulusPa > 0) {
    stress = corotatedCauchyStress(F, shearModulusPa, lambdaPa);
  } else {
    const pressurePa = pressureFromPackedParticle({
      densityKgPerM3,
      restDensityKgPerM3,
      soundSpeedMPerS: mlsMpmParticleState.mechanics[mechanicsOffset + 25],
      eosModelId: mlsMpmParticleState.mechanics[mechanicsOffset + 26],
      internalPressureScale,
      ambientPressurePa,
      gasFraction: sphParticleState.thermo[thermoOffset + 6]
    }) + finiteNumber(internalPressureScale, 1) * Math.max(
      finiteNumber(mlsMpmParticleState.mechanics[mechanicsOffset + 28], 0),
      0
    );
    stress = addNewtonianViscousStress(
      [-pressurePa, 0, 0, 0, -pressurePa, 0, 0, 0, -pressurePa],
      Array.from(mlsMpmParticleState.mechanics.slice(mechanicsOffset + 9, mechanicsOffset + 18)),
      mlsMpmParticleState.mechanics[mechanicsOffset + 29]
    );
  }

  if (externalGaugePressureEnabled === true) {
    // Gas pressure is an EXTERNAL traction on condensed matter. In this P2G
    // weak form internal EOS pressure uses sigma=-pI and expands a free body,
    // so the equivalent inward boundary load has the opposite sign: +pI.
    // Weighting by solid+liquid excludes both gas and plasma carriers while
    // remaining continuous through phase transitions.
    const condensedFraction = Math.min(1, Math.max(0,
      finiteNumber(sphParticleState.thermo[thermoOffset + 4], 0)
      + finiteNumber(sphParticleState.thermo[thermoOffset + 5], 0)
    ));
    const externalPressurePa = finiteNumber(externalGaugePressurePa, 0) * condensedFraction;
    stress[0] += externalPressurePa;
    stress[4] += externalPressurePa;
    stress[8] += externalPressurePa;
  }
  return stress;
}

function productEventRowsFromResidentProductMass(residentProductMass) {
  if (residentProductMass?.productEventRows instanceof Float32Array) return residentProductMass.productEventRows;
  if (residentProductMass?.productEventValues instanceof Float32Array) return residentProductMass.productEventValues;
  if (residentProductMass?.productEvents?.values instanceof Float32Array) return residentProductMass.productEvents.values;
  return null;
}

function productEventRecordsFromResidentProductMass(residentProductMass) {
  if (Array.isArray(residentProductMass?.productEventRecords)) return residentProductMass.productEventRecords;
  if (Array.isArray(residentProductMass?.productEvents?.records)) return residentProductMass.productEvents.records;
  return null;
}

function productEventRowCountFromResidentProductMass(residentProductMass, productEventRows = null) {
  const explicitRows = Math.max(0, Math.round(finiteNumber(residentProductMass?.productEventRowCount, 0)));
  if (productEventRows instanceof Float32Array) {
    const rowsFromBuffer = Math.floor(productEventRows.length / SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS);
    return explicitRows > 0 ? Math.min(explicitRows, rowsFromBuffer) : rowsFromBuffer;
  }
  if (residentProductMass?.productEventBuffer) return explicitRows;
  const records = productEventRecordsFromResidentProductMass(residentProductMass);
  return records?.length ?? explicitRows;
}

function residentProductMassGridCouplingStatus({ residentProductMass, productEventCount, backend }) {
  if (!residentProductMass) return null;
  if (productEventCount > 0) {
    return backend === 'webgpu'
      ? 'resident-product-mass-bound-to-p2g-grid'
      : 'resident-product-mass-coupled-to-cpu-p2g-grid';
  }
  if (residentProductMass.productEventBufferRetained || residentProductMass.productEventBuffer) {
    return 'resident-product-mass-buffer-retained-empty';
  }
  return 'resident-product-mass-summary-only-p2g-force-pending';
}

function splatProductMassPointToGrid({
  px,
  py,
  pz,
  massKg,
  velocityMPerS = [0, 0, 0],
  supportVolumeM3 = 0,
  restDensityKgPerM3 = 0,
  soundSpeedMPerS = 0,
  eosModelId = 0,
  internalPressureScale = 1,
  dtSeconds = 0,
  gridSpec,
  gridNodes,
  activateNode
}) {
  if (!(massKg > 0)) return false;
  const pressurePa = supportVolumeM3 > 0 && dtSeconds !== 0
    ? pressureFromPackedParticle({
      densityKgPerM3: massKg / Math.max(supportVolumeM3, 1e-30),
      restDensityKgPerM3,
      soundSpeedMPerS,
      eosModelId,
      internalPressureScale
    })
    : 0;
  const diagonalAffine = pressurePa !== 0
    ? (-dtSeconds * supportVolumeM3 * 4 * gridSpec.invGridSpacingM * gridSpec.invGridSpacingM) * -pressurePa
    : 0;
  const pGridX = px * gridSpec.invGridSpacingM;
  const pGridY = py * gridSpec.invGridSpacingM;
  const pGridZ = pz * gridSpec.invGridSpacingM;
  const baseX = Math.floor(pGridX - 0.5);
  const baseY = Math.floor(pGridY - 0.5);
  const baseZ = Math.floor(pGridZ - 0.5);
  const wx = quadraticWeights(pGridX - baseX);
  const wy = quadraticWeights(pGridY - baseY);
  const wz = quadraticWeights(pGridZ - baseZ);
  let deposited = false;
  for (let ox = 0; ox < 3; ox += 1) {
    const i = baseX + ox + gridSpec.shift;
    const nodeX = (baseX + ox) * gridSpec.gridSpacingM;
    for (let oy = 0; oy < 3; oy += 1) {
      const j = baseY + oy + gridSpec.shift;
      const nodeY = (baseY + oy) * gridSpec.gridSpacingM;
      for (let oz = 0; oz < 3; oz += 1) {
        const k = baseZ + oz + gridSpec.shift;
        const nodeIndex = gridNodeIndexFromCoords(i, j, k, gridSpec);
        if (nodeIndex < 0) continue;
        const weight = wx[ox] * wy[oy] * wz[oz];
        if (weight === 0) continue;
        const nodeZ = (baseZ + oz) * gridSpec.gridSpacingM;
        const nodeOffset = activateNode(nodeIndex, nodeX, nodeY, nodeZ);
        gridNodes[nodeOffset] += weight * massKg;
        const dx = nodeX - px;
        const dy = nodeY - py;
        const dz = nodeZ - pz;
        gridNodes[nodeOffset + 1] += weight * (massKg * finiteNumber(velocityMPerS[0], 0) + diagonalAffine * dx);
        gridNodes[nodeOffset + 2] += weight * (massKg * finiteNumber(velocityMPerS[1], 0) + diagonalAffine * dy);
        gridNodes[nodeOffset + 3] += weight * (massKg * finiteNumber(velocityMPerS[2], 0) + diagonalAffine * dz);
        deposited = true;
      }
    }
  }
  return deposited;
}

function splatResidentProductMassToGridCpu({
  residentProductMass,
  gridSpec,
  gridNodes,
  activateNode,
  dtSeconds = 0,
  internalPressureScale = 1
}) {
  if (!residentProductMass) {
    return {
      productEventCount: 0,
      coupledEventCount: 0,
      coupledUnplacedMassKg: 0
    };
  }
  const productEventRows = productEventRowsFromResidentProductMass(residentProductMass);
  const productEventCount = productEventRowCountFromResidentProductMass(residentProductMass, productEventRows);
  let coupledEventCount = 0;
  let coupledUnplacedMassKg = 0;
  if (productEventRows instanceof Float32Array) {
    const rowLimit = Math.min(
      productEventCount,
      Math.floor(productEventRows.length / SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS)
    );
    for (let row = 0; row < rowLimit; row += 1) {
      const offset = row * SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS;
      const statusCode = productEventRows[offset + 18];
      const unplacedMassKg = productEventRows[offset + 13];
      if (statusCode !== 1 || !(unplacedMassKg > 0)) continue;
      const deposited = splatProductMassPointToGrid({
        px: productEventRows[offset],
        py: productEventRows[offset + 1],
        pz: productEventRows[offset + 2],
        massKg: unplacedMassKg,
        velocityMPerS: [
          productEventRows[offset + 20],
          productEventRows[offset + 21],
          productEventRows[offset + 22]
        ],
        supportVolumeM3: productEventRows[offset + 23],
        restDensityKgPerM3: productEventRows[offset + 17],
        soundSpeedMPerS: productEventRows[offset + 27],
        eosModelId: productEventRows[offset + 28],
        internalPressureScale,
        dtSeconds,
        gridSpec,
        gridNodes,
        activateNode
      });
      if (!deposited) continue;
      coupledEventCount += 1;
      coupledUnplacedMassKg += unplacedMassKg;
    }
    return {
      productEventCount,
      coupledEventCount,
      coupledUnplacedMassKg
    };
  }

  const records = productEventRecordsFromResidentProductMass(residentProductMass);
  if (Array.isArray(records)) {
    for (const record of records) {
      const statusCode = Number(record?.statusCode);
      if (Number.isFinite(statusCode) && statusCode !== 1) continue;
      if (record?.status && record.status !== 'ready') continue;
      const position = Array.isArray(record?.positionM) ? record.positionM : null;
      const unplacedMassKg = finiteNumber(record?.unplacedMassKg, 0);
      if (!position || !(unplacedMassKg > 0)) continue;
      const deposited = splatProductMassPointToGrid({
        px: finiteNumber(position[0], 0),
        py: finiteNumber(position[1], 0),
        pz: finiteNumber(position[2], 0),
        massKg: unplacedMassKg,
        velocityMPerS: Array.isArray(record?.velocityMPerS) ? record.velocityMPerS : [0, 0, 0],
        supportVolumeM3: finiteNumber(record?.supportVolumeM3, 0),
        restDensityKgPerM3: finiteNumber(record?.restDensityKgPerM3, 0),
        soundSpeedMPerS: finiteNumber(record?.soundSpeedMPerS, 0),
        eosModelId: finiteNumber(record?.eosModelId, 0),
        internalPressureScale,
        dtSeconds,
        gridSpec,
        gridNodes,
        activateNode
      });
      if (!deposited) continue;
      coupledEventCount += 1;
      coupledUnplacedMassKg += unplacedMassKg;
    }
  }
  return {
    productEventCount,
    coupledEventCount,
    coupledUnplacedMassKg
  };
}

function outputEnvelope({
  backend,
  sphParticleState,
  mlsMpmParticleState,
  gridSpec,
  gridNodes,
  dt = 0,
  internalPressureScale = 1,
  ambientPressurePa = 0,
  externalGaugePressurePa = 0,
  externalGaugePressureEnabled = false,
  readbackMode = FULL_READBACK_MODE,
  p2gBackendPolicy = null,
  residentProductMass = null,
  residentProductMassProductEventCount = 0,
  residentProductMassCoupledEventCount = null,
  residentProductMassCoupledUnplacedMassKg = null,
  residentProductMassProductEventBufferDeviceMismatch = false,
  residentProductMassProductEventBufferSourceDeviceId = null,
  residentProductMassProductEventBufferConsumerDeviceId = null,
  schroederLevelFilter = null,
  schroederSpatialDirectory = null
}) {
  const noFullReadback = readbackMode === NO_FULL_READBACK_MODE;
  const resolvedP2gBackendPolicy = p2gBackendPolicy || resolveMlsMpmP2gBackendPolicy({
    requestedBackend: backend === MLS_MPM_P2G_BACKEND_CPU_REFERENCE
      ? MLS_MPM_P2G_BACKEND_CPU_REFERENCE
      : MLS_MPM_P2G_BACKEND_RESIDENT_SCATTER
  });
  return {
    schema: ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA,
    backend,
    status: 'projected',
    kernelScope: GRID_SCOPE,
    p2gBackendPolicy: resolvedP2gBackendPolicy,
    p2gBackendPolicyStatus: resolvedP2gBackendPolicy.status,
    p2gBackendRequested: resolvedP2gBackendPolicy.requestedBackend,
    p2gBackendEffective: resolvedP2gBackendPolicy.effectiveBackend,
    p2gBackendFallbackReason: resolvedP2gBackendPolicy.fallbackReason,
    particleCount: sphParticleState.particleCount,
    sourceSchemas: {
      sphParticleState: sphParticleState.schema,
      mlsMpmParticleState: mlsMpmParticleState.schema
    },
    sourceStep: sphParticleState.step ?? mlsMpmParticleState.step ?? 0,
    sourceTime: sphParticleState.time ?? mlsMpmParticleState.time ?? 0,
    dt,
    gridSpacingM: gridSpec.gridSpacingM,
    gridDims: [...gridSpec.gridDims],
    gridNodeCount: gridSpec.gridNodeCount,
    gridShift: gridSpec.shift,
    gridNodeLayout: [...MLS_MPM_GPU_GRID_NODE_ROW_LAYOUT],
    gridNodeStrideFloats: MLS_MPM_GPU_GRID_NODE_FLOATS,
    gridNodeStrideBytes: MLS_MPM_GPU_GRID_NODE_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    gridNodes,
    internalPressureScale,
    ambientPressurePa: Math.max(0, finiteNumber(ambientPressurePa, 0)),
    ambientPressureAppliedInStressProjection: true,
    externalGaugePressurePa: finiteNumber(externalGaugePressurePa, 0),
    externalGaugePressureEnabled: externalGaugePressureEnabled === true,
    externalGaugePressureAppliedInStressProjection:
      externalGaugePressureEnabled === true && finiteNumber(dt, 0) !== 0,
    externalGaugePressureTarget: 'condensed-particle-solid-plus-liquid-fraction',
    schroederLevelFilter: schroederLevelFilter ? { ...schroederLevelFilter } : null,
    schroederLevelFilterEnabled: schroederLevelFilter?.enabled === true,
    schroederSelectedLevel: schroederLevelFilter?.enabled === true ? schroederLevelFilter.selectedLevel : null,
    schroederSpatialDirectory: schroederSpatialDirectory
      ? { ...schroederSpatialDirectory }
      : null,
    schroederSpatialDirectoryEnabled: schroederSpatialDirectory?.enabled === true,
    schroederSpatialDirectoryStatus: schroederSpatialDirectory?.status ?? null,
    schroederSpatialDirectoryFallback:
      schroederSpatialDirectory?.fallbackToLevelAssignment === true,
    schroederSpatialDirectoryFallbackScope: 'host-binding-only',
    schroederSpatialHostBindingAdmitted:
      schroederSpatialDirectory?.hostBindingAdmitted === true,
    schroederSpatialHostBindingFallback:
      schroederSpatialDirectory?.hostBindingFallback === true,
    schroederSpatialGpuAdmissionObserved:
      schroederSpatialDirectory?.gpuAdmissionObserved === true,
    schroederSpatialGpuAdmissionStatus:
      schroederSpatialDirectory?.gpuAdmissionStatus ?? null,
    schroederSpatialGpuFallbackObserved:
      schroederSpatialDirectory?.gpuFallbackObserved ?? null,
    readbackMode,
    fullReadbackPerformed: !noFullReadback,
    normalHotLoopReadbackFree: noFullReadback,
    p2gProjectionValidation: false,
    stressProjectionValidation: false,
    gridValidation: false,
    g2pValidation: false,
    residentProductMass,
    residentProductMassStatus: residentProductMass?.status ?? null,
    residentProductMassInputProductEventCount: residentProductMassProductEventCount,
    residentProductMassCoupledEventCount,
    residentProductMassCoupledUnplacedMassKg,
    residentProductMassConsumeMassPolicy: residentProductMass?.consumeMassPolicy ?? null,
    residentProductMassGridCouplingStatus: residentProductMassProductEventBufferDeviceMismatch
      ? 'blocked-cross-device-product-event-buffer'
      : residentProductMassGridCouplingStatus({
          residentProductMass,
          productEventCount: residentProductMassProductEventCount,
          backend
        }),
    residentProductMassProductEventBufferDeviceMismatch,
    residentProductMassProductEventBufferSourceDeviceId,
    residentProductMassProductEventBufferConsumerDeviceId,
    residentProductMassEosCouplingStatus: residentProductMass?.eosCouplingStatus ?? null,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

export function projectMlsMpmP2gGridCpu({
  sphParticleState,
  mlsMpmParticleState,
  gridSpacingM = sphParticleState?.smoothingLengthM,
  boxDimsM = DEFAULT_BOX_DIMS_M,
  dt = mlsMpmParticleState?.mechanicsDtS ?? 0,
  residentProductMass = null,
  internalPressureScale = 1,
  ambientPressurePa = 0,
  externalGaugePressurePa = 0,
  externalGaugePressureEnabled = false,
  p2gBackend = MLS_MPM_P2G_BACKEND_CPU_REFERENCE,
  schroederLevelAssignment = null,
  schroederSelectedLevel = null
} = {}) {
  assertPackedInputs({ sphParticleState, mlsMpmParticleState });
  const gridSpec = createMlsMpmGridSpec({ boxDimsM, gridSpacingM });
  const dtSeconds = finiteNumber(dt, 0);
  const schroederFilter = normalizeSchroederLevelFilter({ schroederLevelAssignment, schroederSelectedLevel });
  const schroederAssignmentRows = schroederLevelAssignment?.assignments instanceof Float32Array
    ? schroederLevelAssignment.assignments
    : null;
  if (schroederFilter.enabled && !(schroederAssignmentRows instanceof Float32Array)) {
    throw new TypeError('CPU MLS-MPM P2G Schroeder level filtering requires assignment rows');
  }
  const p2gBackendPolicy = resolveMlsMpmP2gBackendPolicy({
    requestedBackend: p2gBackend === MLS_MPM_P2G_BACKEND_CPU_REFERENCE
      ? MLS_MPM_P2G_BACKEND_CPU_REFERENCE
      : p2gBackend
  });
  const gridNodes = new Float32Array(gridSpec.gridNodeCount * MLS_MPM_GPU_GRID_NODE_FLOATS);
  const activeNodeIndices = [];

  const activateNode = (nodeIndex, nodeX, nodeY, nodeZ) => {
    const nodeOffset = nodeIndex * MLS_MPM_GPU_GRID_NODE_FLOATS;
    if (gridNodes[nodeOffset + 7] === 0) {
      gridNodes[nodeOffset + 4] = nodeX;
      gridNodes[nodeOffset + 5] = nodeY;
      gridNodes[nodeOffset + 6] = nodeZ;
      gridNodes[nodeOffset + 7] = 1;
      activeNodeIndices.push(nodeIndex);
    }
    return nodeOffset;
  };

  for (let particleIndex = 0; particleIndex < sphParticleState.particleCount; particleIndex += 1) {
    if (!particlePassesSchroederLevelFilter(particleIndex, schroederFilter, schroederAssignmentRows)) {
      continue;
    }
    const stateOffset = particleIndex * SPH_GPU_PARTICLE_STATE_FLOATS;
    const thermoOffset = particleIndex * SPH_GPU_PARTICLE_THERMO_FLOATS;
    const mechanicsOffset = particleIndex * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS;
    const px = sphParticleState.state[stateOffset];
    const py = sphParticleState.state[stateOffset + 1];
    const pz = sphParticleState.state[stateOffset + 2];
    const particleMass = sphParticleState.state[stateOffset + 3];
    const vx = sphParticleState.state[stateOffset + 4];
    const vy = sphParticleState.state[stateOffset + 5];
    const vz = sphParticleState.state[stateOffset + 6];
    const pGridX = px * gridSpec.invGridSpacingM;
    const pGridY = py * gridSpec.invGridSpacingM;
    const pGridZ = pz * gridSpec.invGridSpacingM;
    const baseX = Math.floor(pGridX - 0.5);
    const baseY = Math.floor(pGridY - 0.5);
    const baseZ = Math.floor(pGridZ - 0.5);
    const wx = quadraticWeights(pGridX - baseX);
    const wy = quadraticWeights(pGridY - baseY);
    const wz = quadraticWeights(pGridZ - baseZ);
    const C0 = mlsMpmParticleState.mechanics[mechanicsOffset + 9];
    const C1 = mlsMpmParticleState.mechanics[mechanicsOffset + 10];
    const C2 = mlsMpmParticleState.mechanics[mechanicsOffset + 11];
    const C3 = mlsMpmParticleState.mechanics[mechanicsOffset + 12];
    const C4 = mlsMpmParticleState.mechanics[mechanicsOffset + 13];
    const C5 = mlsMpmParticleState.mechanics[mechanicsOffset + 14];
    const C6 = mlsMpmParticleState.mechanics[mechanicsOffset + 15];
    const C7 = mlsMpmParticleState.mechanics[mechanicsOffset + 16];
    const C8 = mlsMpmParticleState.mechanics[mechanicsOffset + 17];
    const restVolumeM3 = Math.max(mlsMpmParticleState.mechanics[mechanicsOffset + 19], 0);
    const J = Math.max(mlsMpmParticleState.mechanics[mechanicsOffset + 18], 1e-9);
    const volumeM3 = restVolumeM3 * J;
    const sigma = dtSeconds !== 0 && volumeM3 > 0
      ? stressTensorForPackedParticle({
        sphParticleState,
        mlsMpmParticleState,
        stateOffset,
        thermoOffset,
        mechanicsOffset,
        internalPressureScale,
        ambientPressurePa,
        externalGaugePressurePa,
        externalGaugePressureEnabled
      })
      : null;
    const stressScale = -dtSeconds * volumeM3 * 4 * gridSpec.invGridSpacingM * gridSpec.invGridSpacingM;
    const aff0 = particleMass * C0 + stressScale * (sigma?.[0] ?? 0);
    const aff1 = particleMass * C1 + stressScale * (sigma?.[1] ?? 0);
    const aff2 = particleMass * C2 + stressScale * (sigma?.[2] ?? 0);
    const aff3 = particleMass * C3 + stressScale * (sigma?.[3] ?? 0);
    const aff4 = particleMass * C4 + stressScale * (sigma?.[4] ?? 0);
    const aff5 = particleMass * C5 + stressScale * (sigma?.[5] ?? 0);
    const aff6 = particleMass * C6 + stressScale * (sigma?.[6] ?? 0);
    const aff7 = particleMass * C7 + stressScale * (sigma?.[7] ?? 0);
    const aff8 = particleMass * C8 + stressScale * (sigma?.[8] ?? 0);

    for (let ox = 0; ox < 3; ox += 1) {
      const i = baseX + ox + gridSpec.shift;
      const nodeX = (baseX + ox) * gridSpec.gridSpacingM;
      for (let oy = 0; oy < 3; oy += 1) {
        const j = baseY + oy + gridSpec.shift;
        const nodeY = (baseY + oy) * gridSpec.gridSpacingM;
        for (let oz = 0; oz < 3; oz += 1) {
          const k = baseZ + oz + gridSpec.shift;
          const nodeIndex = gridNodeIndexFromCoords(i, j, k, gridSpec);
          if (nodeIndex < 0) continue;
          const weight = wx[ox] * wy[oy] * wz[oz];
          if (weight === 0) continue;
          const nodeZ = (baseZ + oz) * gridSpec.gridSpacingM;
          const nodeOffset = activateNode(nodeIndex, nodeX, nodeY, nodeZ);
          const dx = nodeX - px;
          const dy = nodeY - py;
          const dz = nodeZ - pz;
          const affineX = aff0 * dx + aff1 * dy + aff2 * dz;
          const affineY = aff3 * dx + aff4 * dy + aff5 * dz;
          const affineZ = aff6 * dx + aff7 * dy + aff8 * dz;
          gridNodes[nodeOffset] += weight * particleMass;
          gridNodes[nodeOffset + 1] += weight * (particleMass * vx + affineX);
          gridNodes[nodeOffset + 2] += weight * (particleMass * vy + affineY);
          gridNodes[nodeOffset + 3] += weight * (particleMass * vz + affineZ);
        }
      }
    }
  }

  const productMassContribution = splatResidentProductMassToGridCpu({
    residentProductMass,
    gridSpec,
    gridNodes,
    activateNode,
    dtSeconds,
    internalPressureScale
  });

  for (const nodeIndex of activeNodeIndices) {
    const offset = nodeIndex * MLS_MPM_GPU_GRID_NODE_FLOATS;
    gridNodes[offset + 7] = gridNodes[offset] > 0 ? 1 : 0;
  }

  return outputEnvelope({
    backend: 'cpu-reference',
    sphParticleState,
    mlsMpmParticleState,
    gridSpec,
    gridNodes,
    dt: dtSeconds,
    internalPressureScale,
    ambientPressurePa,
    externalGaugePressurePa,
    externalGaugePressureEnabled,
    p2gBackendPolicy,
    residentProductMass,
    schroederLevelFilter: schroederFilter,
    residentProductMassProductEventCount: productMassContribution.productEventCount,
    residentProductMassCoupledEventCount: productMassContribution.coupledEventCount,
    residentProductMassCoupledUnplacedMassKg: productMassContribution.coupledUnplacedMassKg
  });
}

function writeStorageBuffer(device, label, data, trackOwnedBuffer = null) {
  const byteLength = Math.max(4, data.byteLength);
  const buffer = device.createBuffer({
    label,
    size: byteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
  });
  if (typeof trackOwnedBuffer === 'function') trackOwnedBuffer(buffer);
  try {
    if (data.byteLength > 0) device.queue.writeBuffer(buffer, 0, data);
  } catch (error) {
    if (typeof trackOwnedBuffer !== 'function') {
      try {
        buffer.destroy?.();
      } catch {
        // Preserve the write failure.
      }
    }
    throw error;
  }
  return buffer;
}

function createSchroederSpatialDirectoryBinding({
  device,
  schroederSpatialEpochGeneration = null,
  canonicalSpatialRequired = false,
  labelPrefix = 'ulg-mls-mpm-p2g'
} = {}) {
  const execution = schroederSpatialEpochGeneration?.execution || null;
  const directoryBuffer = execution?.directoryBuffer || null;
  const evidenceBuffer = execution?.evidenceBuffer || null;
  const directoryDeviceMismatch = directoryBuffer
    ? webGpuDeviceMismatchInfo({ buffer: directoryBuffer, device })
    : { mismatch: false, sourceDeviceId: null, consumerDeviceId: null };
  const evidenceDeviceMismatch = evidenceBuffer
    ? webGpuDeviceMismatchInfo({ buffer: evidenceBuffer, device })
    : { mismatch: false, sourceDeviceId: null, consumerDeviceId: null };
  const deviceMismatch = directoryDeviceMismatch.mismatch
    ? directoryDeviceMismatch
    : evidenceDeviceMismatch;
  const evidenceBufferTooSmall = Number.isFinite(Number(evidenceBuffer?.size))
    && Number(evidenceBuffer.size) < SCHROEDER_SPATIAL_EPOCH_WITH_MECHANICS_EVIDENCE_BYTES;
  const overlayRejected =
    schroederSpatialEpochGeneration?.source?.phaseVolumeAssignmentOverlayEnabled === true;
  const schemaRejected = Boolean(schroederSpatialEpochGeneration) && (
    schroederSpatialEpochGeneration?.schema !== SCHROEDER_SPATIAL_EPOCH_GENERATION_SCHEMA
    || execution?.schema !== SCHROEDER_SPATIAL_EPOCH_SCHEMA
  );
  const released = execution?.released === true;
  const queryProfileRejected = schroederSpatialEpochGeneration != null && (
    execution?.sourceAdapterId !== SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY
    || execution?.exactNearQueryProfile?.ready !== true
    || execution?.queryGeometryEvidence !== execution?.exactNearQueryProfile
  );
  const canonicalIntent = canonicalSpatialRequired === true
    || schroederSpatialEpochGeneration?.selected === true;
  const enabled = schroederSpatialEpochGeneration?.selected === true
    && schroederSpatialEpochGeneration?.ready === true
    && execution?.submitPerformed === true
    && Boolean(directoryBuffer)
    && Boolean(evidenceBuffer)
    && !deviceMismatch.mismatch
    && !evidenceBufferTooSmall
    && !overlayRejected
    && !schemaRejected
    && !queryProfileRejected
    && !released;
  if (enabled) {
    return {
      enabled: true,
      required: canonicalSpatialRequired === true,
      buffer: directoryBuffer,
      evidenceBuffer,
      ownsBuffer: false,
      retainedBuffer: true,
      generationId: execution.generationId,
      storageGeneration: execution.storageGeneration,
      positionEpoch: execution.positionEpoch,
      topologyEpoch: execution.topologyEpoch,
      deviceOrdinal: execution.deviceOrdinal,
      laneOrdinal: execution.laneOrdinal,
      leaseToken: execution.leaseToken,
      sourceFamilyId: execution.sourceFamilyId,
      physicsTick: execution.physicsTick,
      physicsSubstep: execution.physicsSubstep,
      chartEpoch: execution.chartEpoch,
      levelEpoch: execution.levelEpoch,
      supportEpoch: execution.supportEpoch,
      byteLength: execution.layout?.byteLength ?? directoryBuffer.size ?? 0,
      evidenceBufferByteLength: execution.evidenceBufferByteLength
        ?? evidenceBuffer.size
        ?? SCHROEDER_SPATIAL_EPOCH_WITH_MECHANICS_EVIDENCE_BYTES,
      sourceDeviceId: deviceMismatch.sourceDeviceId,
      consumerDeviceId: deviceMismatch.consumerDeviceId,
      status: 'canonical-spatial-directory-bound-for-p2g-level-admission',
      hostBindingAdmitted: true,
      hostBindingFallback: false,
      gpuAdmissionObserved: false,
      gpuAdmissionStatus: 'shader-validates-at-dispatch-no-host-readback',
      gpuFallbackObserved: null,
      fallbackToLevelAssignment: false
    };
  }
  let status = 'canonical-spatial-directory-not-provided';
  if (deviceMismatch.mismatch) status = 'canonical-spatial-directory-rejected-device';
  else if (evidenceBufferTooSmall) status = 'canonical-spatial-directory-rejected-evidence-capacity';
  else if (overlayRejected) status = 'canonical-spatial-directory-rejected-overlay-authority';
  else if (schemaRejected) status = 'canonical-spatial-directory-rejected-schema';
  else if (queryProfileRejected) status = 'canonical-spatial-directory-rejected-query-geometry';
  else if (released) status = 'canonical-spatial-directory-rejected-released-generation';
  else if (canonicalIntent) status = 'canonical-spatial-directory-requested-but-unavailable';
  else if (schroederSpatialEpochGeneration) status = 'canonical-spatial-directory-not-ready';
  if (canonicalIntent) {
    const error = new Error(
      `Canonical MLS-MPM P2G spatial authority rejected before submission: ${status}`
    );
    error.code = 'ERR_CANONICAL_SPATIAL_AUTHORITY_REJECTED';
    error.status = status;
    throw error;
  }
  return {
    enabled: false,
    required: canonicalSpatialRequired === true,
    buffer: null,
    evidenceBuffer: null,
    ownsBuffer: false,
    retainedBuffer: false,
    generationId: null,
    storageGeneration: 0,
    positionEpoch: 0,
    topologyEpoch: 0,
    deviceOrdinal: 0,
    laneOrdinal: 0,
    leaseToken: 0,
    sourceFamilyId: 0,
    physicsTick: 0,
    physicsSubstep: 0,
    chartEpoch: 0,
    levelEpoch: 0,
    supportEpoch: 0,
    byteLength: 48 * Uint32Array.BYTES_PER_ELEMENT,
    evidenceBufferByteLength: 0,
    sourceDeviceId: deviceMismatch.sourceDeviceId,
    consumerDeviceId: deviceMismatch.consumerDeviceId,
    status,
    hostBindingAdmitted: false,
    hostBindingFallback: true,
    gpuAdmissionObserved: false,
    gpuAdmissionStatus: 'not-applicable-host-binding-fallback',
    gpuFallbackObserved: null,
    fallbackToLevelAssignment: true
  };
}

function schroederSpatialDirectoryMetadata(binding = null) {
  return {
    enabled: binding?.enabled === true,
    required: binding?.required === true,
    retainedBuffer: binding?.retainedBuffer === true,
    generationId: binding?.generationId ?? null,
    storageGeneration: binding?.storageGeneration ?? null,
    positionEpoch: binding?.positionEpoch ?? null,
    topologyEpoch: binding?.topologyEpoch ?? null,
    deviceOrdinal: binding?.deviceOrdinal ?? null,
    laneOrdinal: binding?.laneOrdinal ?? null,
    leaseToken: binding?.leaseToken ?? null,
    sourceFamilyId: binding?.sourceFamilyId ?? null,
    physicsTick: binding?.physicsTick ?? null,
    physicsSubstep: binding?.physicsSubstep ?? null,
    chartEpoch: binding?.chartEpoch ?? null,
    levelEpoch: binding?.levelEpoch ?? null,
    supportEpoch: binding?.supportEpoch ?? null,
    byteLength: binding?.byteLength ?? 0,
    evidenceBufferByteLength: binding?.evidenceBufferByteLength ?? 0,
    sourceDeviceId: binding?.sourceDeviceId ?? null,
    consumerDeviceId: binding?.consumerDeviceId ?? null,
    status: binding?.status ?? null,
    hostBindingAdmitted: binding?.hostBindingAdmitted === true,
    hostBindingFallback: binding?.hostBindingFallback === true,
    gpuAdmissionObserved: binding?.gpuAdmissionObserved === true,
    gpuAdmissionStatus: binding?.gpuAdmissionStatus ?? null,
    gpuFallbackObserved: binding?.gpuFallbackObserved ?? null,
    fallbackToLevelAssignment: binding?.fallbackToLevelAssignment === true
  };
}

export function createProjectionParamsArray(
  gridSpec,
  particleCount,
  dt,
  productEventCount = 0,
  internalPressureScale = 1,
  schroederLevelFilter = null,
  ambientPressurePa = 0,
  externalGaugePressurePa = 0,
  externalGaugePressureEnabled = false,
  schroederSpatialDirectory = null
) {
  const buffer = new ArrayBuffer(P2G_PARAMS_BYTES);
  const view = new DataView(buffer);
  view.setUint32(0, particleCount, true);
  view.setUint32(4, gridSpec.gridNodeCount, true);
  view.setUint32(8, gridSpec.gridDims[0], true);
  view.setUint32(12, gridSpec.gridDims[1], true);
  view.setUint32(16, gridSpec.gridDims[2], true);
  view.setUint32(20, gridSpec.shift, true);
  view.setFloat32(24, gridSpec.gridSpacingM, true);
  view.setFloat32(28, gridSpec.invGridSpacingM, true);
  view.setFloat32(32, finiteNumber(dt, 0), true);
  view.setUint32(36, Math.max(0, Math.round(finiteNumber(productEventCount, 0))), true);
  view.setFloat32(40, finiteNumber(internalPressureScale, 1), true);
  view.setUint32(44, schroederLevelFilter?.enabled === true ? 1 : 0, true);
  view.setInt32(48, Math.round(finiteNumber(schroederLevelFilter?.selectedLevel, 0)), true);
  view.setUint32(52, Math.max(1, Math.round(finiteNumber(
    schroederLevelFilter?.assignmentStrideFloats,
    SCHROEDER_LEVEL_ASSIGNMENT_FLOATS
  ))), true);
  view.setUint32(56, schroederSpatialDirectory?.enabled === true ? 1 : 0, true);
  view.setUint32(60, Math.max(0, Math.round(finiteNumber(
    schroederSpatialDirectory?.storageGeneration,
    0
  ))), true);
  // grid_density_pressure_enabled + pads: the standalone runner keeps the
  // spatial-density EOS term off (no previous-substep grid available); the
  // fused resident sequence enables it.
  view.setUint32(64, 0, true);
  // ambient_pressure_pa: the gauge reference for the ideal-gas partial
  // pressure. 0 = vacuum box (default); a uniform atmosphere would exert no
  // net force on immersed bodies, so gas stress is measured relative to it.
  view.setFloat32(68, Math.max(0, finiteNumber(ambientPressurePa, 0)), true);
  view.setFloat32(72, finiteNumber(externalGaugePressurePa, 0), true);
  view.setUint32(76, externalGaugePressureEnabled === true ? 1 : 0, true);
  view.setUint32(80, Math.max(0, Math.round(finiteNumber(
    schroederSpatialDirectory?.positionEpoch,
    0
  ))), true);
  view.setUint32(84, Math.max(0, Math.round(finiteNumber(
    schroederSpatialDirectory?.topologyEpoch,
    0
  ))), true);
  view.setUint32(88, schroederSpatialDirectory?.required === true ? 1 : 0, true);
  view.setUint32(92, Math.max(0, Math.round(finiteNumber(
    schroederSpatialDirectory?.generationId,
    0
  ))), true);
  view.setUint32(96, Math.max(0, Math.round(finiteNumber(
    schroederSpatialDirectory?.deviceOrdinal,
    0
  ))), true);
  view.setUint32(100, Math.max(0, Math.round(finiteNumber(
    schroederSpatialDirectory?.laneOrdinal,
    0
  ))), true);
  view.setUint32(104, Math.max(0, Math.round(finiteNumber(
    schroederSpatialDirectory?.leaseToken,
    0
  ))), true);
  view.setUint32(108, Math.max(0, Math.round(finiteNumber(
    schroederSpatialDirectory?.sourceFamilyId,
    0
  ))), true);
  view.setUint32(112, Math.max(0, Math.round(finiteNumber(
    schroederSpatialDirectory?.physicsTick,
    0
  ))), true);
  view.setUint32(116, Math.max(0, Math.round(finiteNumber(
    schroederSpatialDirectory?.physicsSubstep,
    0
  ))), true);
  view.setUint32(120, Math.max(0, Math.round(finiteNumber(
    schroederSpatialDirectory?.chartEpoch,
    0
  ))), true);
  view.setUint32(124, Math.max(0, Math.round(finiteNumber(
    schroederSpatialDirectory?.levelEpoch,
    0
  ))), true);
  view.setUint32(128, Math.max(0, Math.round(finiteNumber(
    schroederSpatialDirectory?.supportEpoch,
    0
  ))), true);
  view.setUint32(132, schroederLevelFilter?.spatialEvidenceEnabled === true ? 1 : 0, true);
  return buffer;
}

export async function runMlsMpmP2gGridProjectionWebGpu({
  device,
  sphParticleState,
  mlsMpmParticleState,
  sphParticleUpload = null,
  mlsMpmParticleUpload = null,
  schroederLevelAssignment = null,
  schroederSelectedLevel = null,
  schroederSpatialEpochGeneration = null,
  canonicalSpatialRequired = false,
  observeCanonicalSpatialAuthority = false,
  mechanicsFieldMode = MLS_MPM_MECHANICS_FIELD_MODE_DISABLED,
  canonicalParticleContinuation = null,
  fusedFineSubstepTransaction = null,
  fusedCoarseTerminalTransaction = null,
  // A projection whose pressure rows are read by the cross-level phase-volume
  // operator must declare CROSS_LEVEL required even when it carries no fused
  // transaction of its own: the coarse predictor projection is consumed by the
  // parent workspace before the coarse local grid update ever runs.
  pressureCrossLevelConsumerRequired = false,
  gridSpacingM = sphParticleState?.smoothingLengthM,
  boxDimsM = DEFAULT_BOX_DIMS_M,
  dt = mlsMpmParticleState?.mechanicsDtS ?? 0,
  residentProductMass = null,
  internalPressureScale = 1,
  ambientPressurePa = 0,
  externalGaugePressurePa = 0,
  externalGaugePressureEnabled = false,
  retainGridBuffer = false,
  readbackMode = FULL_READBACK_MODE,
  p2gBackend = MLS_MPM_P2G_BACKEND_RESIDENT_SCATTER
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runMlsMpmP2gGridProjectionWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  if (fusedFineSubstepTransaction != null
      && fusedCoarseTerminalTransaction != null) {
    throw new TypeError(
      'P2G accepts either a fused fine transaction or fused coarse-terminal transaction, never both'
    );
  }
  assertPackedInputs({ sphParticleState, mlsMpmParticleState });
  if (
    mechanicsFieldMode !== MLS_MPM_MECHANICS_FIELD_MODE_DISABLED
    && mechanicsFieldMode !== MLS_MPM_MECHANICS_FIELD_MODE_REQUIRED
  ) {
    throw new RangeError(
      `mechanicsFieldMode must be '${MLS_MPM_MECHANICS_FIELD_MODE_DISABLED}' or '${MLS_MPM_MECHANICS_FIELD_MODE_REQUIRED}'`
    );
  }
  const fusedFineSubstep = fusedFineSubstepTransaction != null;
  const fusedCoarseTerminal = fusedCoarseTerminalTransaction != null;
  const fusedTransaction = fusedFineSubstepTransaction
    ?? fusedCoarseTerminalTransaction;
  const fusedTransactionMode = fusedFineSubstep
    ? 'fine'
    : fusedCoarseTerminal
      ? 'coarse-terminal'
      : null;
  let fusedProducerClaim = null;
  if (fusedTransaction != null) {
    const macroAuthority = fusedTransaction.macroAuthority;
    const microepochAuthority = fusedTransaction.microepochAuthority;
    const expectedLevel = fusedFineSubstep
      ? macroAuthority?.fineLevel
      : macroAuthority?.coarseLevel;
    const expectedDt = fusedFineSubstep
      ? macroAuthority?.fineDt
      : macroAuthority?.macroDt;
    const expectedField = fusedFineSubstep
      ? fusedTransaction.fineFieldView
      : fusedTransaction.coarseFieldView;
    const transactionAdmitted = fusedFineSubstep
      ? validateSchroederFusedFineSubstepTransaction(
          device,
          fusedTransaction,
          {
            stage: 'p2g',
            macroAuthority,
            microepochAuthority,
            particleContinuation: canonicalParticleContinuation
          }
        )
      : validateSchroederFusedCoarseTerminalTransaction(
          device,
          fusedTransaction,
          {
            stage: 'p2g',
            macroAuthority,
            microepochAuthority,
            particleContinuation: canonicalParticleContinuation
          }
        );
    const fusedAdmissionBlockers = [
      ...(transactionAdmitted === true ? [] : ['transaction-not-admitted']),
      ...(canonicalSpatialRequired === true ? [] : ['canonical-spatial-not-required']),
      ...(mechanicsFieldMode === MLS_MPM_MECHANICS_FIELD_MODE_REQUIRED
        ? [] : ['mechanics-field-not-required']),
      ...(canonicalParticleContinuation === fusedTransaction.particleContinuation
        ? [] : ['continuation-identity-mismatch']),
      ...(sphParticleState.particleCount > 0
        ? [] : ['invalid-sph-particle-count']),
      ...(sphParticleState.particleCount
        === canonicalParticleContinuation?.sphParticleUpload?.particleCount
        ? [] : ['sph-continuation-count-mismatch']),
      ...(mlsMpmParticleState.particleCount === sphParticleState.particleCount
        ? [] : ['mls-state-count-mismatch']),
      ...(canonicalParticleContinuation?.mlsMpmParticleUpload?.particleCount
        === sphParticleState.particleCount
        ? [] : ['mls-continuation-count-mismatch']),
      ...(sphParticleUpload === canonicalParticleContinuation?.sphParticleUpload
        ? [] : ['sph-upload-identity-mismatch']),
      ...(mlsMpmParticleUpload === canonicalParticleContinuation?.mlsMpmParticleUpload
        ? [] : ['mls-upload-identity-mismatch']),
      ...(fusedParticleUploadAbiMatches(
        device,
        sphParticleUpload,
        mlsMpmParticleUpload,
        sphParticleState.particleCount
      ) ? [] : ['particle-upload-abi-mismatch']),
      ...(schroederSpatialEpochGeneration === microepochAuthority?.generation
        ? [] : ['spatial-generation-identity-mismatch']),
      ...(schroederSelectedLevel === expectedLevel
        ? [] : ['selected-level-mismatch']),
      ...(expectedField?.selectedLevel === expectedLevel
        ? [] : ['field-level-mismatch']),
      ...(Object.is(Number(gridSpacingM), Number(expectedField?.gridSpacingM))
        ? [] : ['grid-spacing-mismatch']),
      ...(Object.is(Number(dt), Number(expectedDt))
        ? [] : ['timestep-mismatch']),
      ...(readbackMode === NO_FULL_READBACK_MODE
        ? [] : ['readback-mode-mismatch'])
    ];
    if (fusedAdmissionBlockers.length > 0) {
      const error = new TypeError(
        `${fusedFineSubstep
          ? 'Fused fine P2G requires its exact pending transaction and particle continuation'
          : 'fused coarse-terminal P2G requires exact E_r/C_r, level, and macro timestep'}: ${fusedAdmissionBlockers.join(',')}`
      );
      error.code = fusedFineSubstep
        ? 'ERR_SCHROEDER_FUSED_FINE_P2G_ADMISSION'
        : 'ERR_SCHROEDER_FUSED_COARSE_P2G_ADMISSION';
      error.blockers = Object.freeze([...fusedAdmissionBlockers]);
      throw error;
    }
    if (mechanicsFieldP2gClaims.has(fusedTransaction)) {
      throw new Error('fused P2G transaction already has an active producer');
    }
    const producerCapability = fusedFineSubstep
      ? claimSchroederFusedFineSubstepStageProducer(
          device,
          fusedTransaction,
          { stage: 'p2g' }
        )
      : claimSchroederFusedCoarseTerminalStageProducer(
          device,
          fusedTransaction,
          { stage: 'p2g' }
        );
    fusedProducerClaim = Object.freeze({
      transaction: fusedTransaction,
      mode: fusedTransactionMode,
      producerCapability
    });
    mechanicsFieldP2gClaims.set(fusedTransaction, fusedProducerClaim);
  }
  const ownedAllocationEntries = new Set();
  let allocationCleanupDelegated = false;
  let gridBufferAllocationEntry = null;
  const trackOwnedBuffer = (buffer) => {
    if (buffer?.destroy) ownedAllocationEntries.add(buffer);
    return buffer;
  };
  const cleanupOwnedBuffers = () => {
    for (let attempt = 0;
      attempt < 2 && ownedAllocationEntries.size > 0;
      attempt += 1) {
      for (const buffer of [...ownedAllocationEntries]) {
        try {
          buffer.destroy?.();
          ownedAllocationEntries.delete(buffer);
        } catch {
          // Continue through the complete allocation ledger and retry once.
          // A throwing destructor must not strand later owned buffers.
        }
      }
    }
  };
  const scheduleOwnedBufferCleanup = (submitted, deferCleanup) => {
    if (!submitted || !deferCleanup) {
      cleanupOwnedBuffers();
      return;
    }
    try {
      const fence = device.queue?.onSubmittedWorkDone?.();
      if (!fence?.then) {
        cleanupOwnedBuffers();
      } else {
        allocationCleanupDelegated = true;
        Promise.resolve(fence)
          .catch(() => null)
          .finally(cleanupOwnedBuffers);
      }
    } catch {
      cleanupOwnedBuffers();
    }
  };
  try {
  const gridSpec = createMlsMpmGridSpec({ boxDimsM, gridSpacingM });
  const p2gBackendPolicy = resolveMlsMpmP2gBackendPolicy({
    requestedBackend: p2gBackend,
    supportsOceanTiledKernel: false
  });
  const outputByteLength = gridSpec.gridNodeCount * MLS_MPM_GPU_GRID_NODE_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const accumulatorElementCount = Math.max(1, gridSpec.gridNodeCount * P2G_ACCUMULATOR_COMPONENTS);
  const accumulatorByteLength = accumulatorElementCount * Int32Array.BYTES_PER_ELEMENT;
  const borrowedStateBuffer = sphParticleUpload?.status === 'webgpu-uploaded' ? sphParticleUpload.stateBuffer : null;
  const borrowedThermoBuffer = sphParticleUpload?.status === 'webgpu-uploaded' ? sphParticleUpload.thermoBuffer : null;
  const borrowedMechanicsBuffer = mlsMpmParticleUpload?.status === 'webgpu-uploaded'
    ? mlsMpmParticleUpload.mechanicsBuffer
    : null;
  const productEventRows = productEventRowsFromResidentProductMass(residentProductMass);
  // Resolve canonical intent before touching assignment rows. A selected
  // generation is authoritative: malformed/contradictory legacy assignment
  // data must be structurally irrelevant, never a fallback source.
  const schroederSpatialDirectory = createSchroederSpatialDirectoryBinding({
    device,
    schroederSpatialEpochGeneration,
    canonicalSpatialRequired
  });
  const canonicalSpatialAuthority = schroederSpatialDirectory.enabled === true;
  let mechanicsFieldKernelBundle = null;
  let mechanicsFieldBinding = null;
  if (mechanicsFieldMode === MLS_MPM_MECHANICS_FIELD_MODE_REQUIRED) {
    if (!canonicalSpatialAuthority) {
      throw new TypeError(
        'Required mechanics-field P2G needs one selected canonical spatial generation'
      );
    }
    mechanicsFieldKernelBundle = await import('./sphMlsMpmGpuStep.js');
    mechanicsFieldBinding =
      mechanicsFieldKernelBundle.createFusedSchroederActiveNodeBinding({
        device,
        schroederSpatialEpochGeneration,
        canonicalSpatialRequired,
        gridSpec,
        selectedLevel: schroederSelectedLevel,
        particleStateBuffer: sphParticleUpload?.stateBuffer ?? null,
        particleIdentityBuffer: sphParticleUpload?.identityBuffer ?? null,
        canonicalParticleContinuation,
        labelPrefix: 'ulg-mls-mpm-staged-p2g'
      });
  }
  const mechanicsFieldViewEnabled = Boolean(
    mechanicsFieldBinding?.mechanicsFieldViewEnabled
  );
  if (
    mechanicsFieldMode === MLS_MPM_MECHANICS_FIELD_MODE_REQUIRED
    && !mechanicsFieldViewEnabled
  ) {
    throw new Error(
      'Required mechanics-field P2G could not authenticate the exact generation-owned field view'
    );
  }
  const mechanicsFieldExecution = mechanicsFieldViewEnabled
    ? mechanicsFieldBinding.mechanicsFieldViewExecution
    : null;
  let mechanicsFieldParticleFamilyAdmitted = !mechanicsFieldViewEnabled;
  if (mechanicsFieldViewEnabled) {
    const particleCount = sphParticleState.particleCount;
    const expectedCandidateCount = particleCount
      * mechanicsFieldKernelBundle.MECHANICS_FIELD_P2G_STENCIL_SIZE;
    mechanicsFieldParticleFamilyAdmitted = Boolean(
      Number.isSafeInteger(expectedCandidateCount)
      && expectedCandidateCount >= 0
      && expectedCandidateCount < 0xffff_ffff
      && mlsMpmParticleState.particleCount === particleCount
      && fusedParticleUploadAbiMatches(
        device,
        sphParticleUpload,
        mlsMpmParticleUpload,
        particleCount
      )
      && mechanicsFieldExecution?.sourceCount === particleCount
      && mechanicsFieldExecution?.candidateCount === expectedCandidateCount
      && mechanicsFieldExecution?.stableCandidateOrderCount
        === expectedCandidateCount
    );
    if (!mechanicsFieldParticleFamilyAdmitted && fusedTransaction == null) {
      const error = new TypeError(
        'Required mechanics-field P2G needs one exact particle/upload/source/candidate family'
      );
      error.code = 'ERR_MECHANICS_FIELD_P2G_PARTICLE_FAMILY_MISMATCH';
      throw error;
    }
  }
  const mechanicsFieldMutationRuntime = mechanicsFieldExecution?.ownerRuntime ?? null;
  let mechanicsFieldMutationToken = null;
  let mechanicsFieldMutationCommitted = false;
  let p2gQueueSubmitted = false;
  let schroederFilter;
  let schroederAssignmentRows = null;
  let borrowedSchroederAssignmentBuffer = null;
  if (canonicalSpatialAuthority) {
    if (
      typeof schroederSelectedLevel !== 'number'
      || !Number.isInteger(schroederSelectedLevel)
      || schroederSelectedLevel < -0x8000_0000
      || schroederSelectedLevel > 0x7fff_ffff
    ) {
      throw canonicalSpatialExecutionError(
        'canonical-spatial-selected-level-rejected',
        'Canonical WebGPU MLS-MPM P2G requires an exact i32 selected Schroeder level'
      );
    }
    schroederFilter = {
      enabled: true,
      selectedLevel: schroederSelectedLevel,
      assignmentStrideFloats: SCHROEDER_LEVEL_ASSIGNMENT_FLOATS,
      retainedAssignmentBuffer: false,
      assignmentBufferByteLength: 0,
      assignmentBufferSource: null,
      authorityBindingMode: 'canonical-spatial-epoch',
      oldLevelAssignmentLookupRemoved: true,
      spatialEvidenceEnabled: observeCanonicalSpatialAuthority === true,
      spatialEvidenceBufferByteLength:
        SCHROEDER_MECHANICS_SPATIAL_AUTHORITY_EVIDENCE_BYTES
    };
  } else {
    schroederFilter = normalizeSchroederLevelFilter({
      schroederLevelAssignment,
      schroederSelectedLevel
    });
    schroederFilter = {
      ...schroederFilter,
      authorityBindingMode: schroederFilter.enabled
        ? 'precanonical-level-assignment'
        : 'precanonical-unfiltered',
      oldLevelAssignmentLookupRemoved: false,
      spatialEvidenceEnabled: false,
      spatialEvidenceBufferByteLength: 0
    };
    schroederAssignmentRows = schroederLevelAssignment?.assignments instanceof Float32Array
      ? schroederLevelAssignment.assignments
      : null;
    borrowedSchroederAssignmentBuffer = schroederFilter.enabled
      ? (schroederLevelAssignment?.assignmentBuffer || null)
      : null;
    if (
      schroederFilter.enabled
      && !borrowedSchroederAssignmentBuffer
      && !(schroederAssignmentRows instanceof Float32Array)
    ) {
      throw new TypeError(
        'WebGPU MLS-MPM P2G Schroeder level filtering requires retained assignment buffer or assignment rows'
      );
    }
  }
  if (!canonicalSpatialAuthority) {
    schroederSpatialDirectory.buffer = writeStorageBuffer(
      device,
      'ulg-mls-mpm-p2g-schroeder-spatial-directory-dummy',
      new Uint32Array(48),
      trackOwnedBuffer
    );
    schroederSpatialDirectory.ownsBuffer = true;
  }
  const rawBorrowedProductEventBuffer = residentProductMass?.productEventBuffer || null;
  const productEventBufferMismatch = rawBorrowedProductEventBuffer && !(productEventRows instanceof Float32Array)
    ? webGpuDeviceMismatchInfo({
        buffer: rawBorrowedProductEventBuffer,
        residentProductMass,
        device
      })
    : { mismatch: false, sourceDeviceId: null, consumerDeviceId: null };
  const borrowedProductEventBuffer = rawBorrowedProductEventBuffer
    && webGpuBufferMatchesDevice(rawBorrowedProductEventBuffer, device)
    ? rawBorrowedProductEventBuffer
    : null;
  const productEventCount = borrowedProductEventBuffer || productEventRows instanceof Float32Array
    ? productEventRowCountFromResidentProductMass(residentProductMass, productEventRows)
    : 0;
  if (mechanicsFieldViewEnabled && productEventCount > 0) {
    throw new Error(
      'Mechanics-field P2G requires product events to be materialized into the admitted particle family first'
    );
  }
  const stateBuffer = borrowedStateBuffer || writeStorageBuffer(
    device,
    'ulg-mls-mpm-p2g-sph-state-in',
    sphParticleState.state,
    trackOwnedBuffer
  );
  const thermoBuffer = borrowedThermoBuffer || writeStorageBuffer(
    device,
    'ulg-mls-mpm-p2g-sph-thermo-in',
    sphParticleState.thermo,
    trackOwnedBuffer
  );
  const mechanicsBuffer = borrowedMechanicsBuffer || writeStorageBuffer(
    device,
    'ulg-mls-mpm-p2g-mechanics-in',
    mlsMpmParticleState.mechanics,
    trackOwnedBuffer
  );
  const productEventBuffer = borrowedProductEventBuffer
    || tagWebGpuBufferDevice(writeStorageBuffer(
      device,
      'ulg-mls-mpm-p2g-resident-product-events-in',
      productEventRows instanceof Float32Array && productEventRows.length >= SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS
        ? productEventRows
        : EMPTY_PRODUCT_EVENT_STORAGE_ROWS,
      trackOwnedBuffer
    ), device);
  const schroederAuthorityBuffer = canonicalSpatialAuthority
    ? (mechanicsFieldBinding?.evidenceBuffer
      ?? schroederSpatialDirectory.evidenceBuffer)
    : (borrowedSchroederAssignmentBuffer || writeStorageBuffer(
        device,
        schroederFilter.enabled
          ? 'ulg-mls-mpm-p2g-schroeder-level-assignments-in'
          : 'ulg-mls-mpm-p2g-schroeder-level-assignments-dummy',
        schroederFilter.enabled
          ? schroederAssignmentRows
          : new Float32Array(SCHROEDER_LEVEL_ASSIGNMENT_FLOATS),
        trackOwnedBuffer
      ));
  const gridBuffer = mechanicsFieldViewEnabled
    ? null
    : device.createBuffer({
        label: 'ulg-mls-mpm-p2g-grid-out',
        size: Math.max(4, outputByteLength),
        usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
      });
  gridBufferAllocationEntry = trackOwnedBuffer(gridBuffer);
  const mechanicsFieldP2gContributionByteLength = mechanicsFieldViewEnabled
    ? sphParticleState.particleCount
      * mechanicsFieldKernelBundle.MECHANICS_FIELD_P2G_STENCIL_SIZE
      * mechanicsFieldKernelBundle.MECHANICS_FIELD_P2G_CONTRIBUTION_FLOATS
      * Float32Array.BYTES_PER_ELEMENT
    : 0;
  if (!Number.isSafeInteger(mechanicsFieldP2gContributionByteLength)) {
    throw new RangeError(
      'Mechanics-field staged deterministic P2G contribution storage exceeds the safe byte range'
    );
  }
  const mechanicsFieldContributionBuffer = mechanicsFieldViewEnabled
    ? device.createBuffer({
        label: 'ulg-mls-mpm-staged-p2g-deterministic-field-contributions',
        size: Math.max(4, mechanicsFieldP2gContributionByteLength),
        usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
      })
    : null;
  if (mechanicsFieldContributionBuffer) {
    trackOwnedBuffer(mechanicsFieldContributionBuffer);
  }
  const accumulatorBuffer = mechanicsFieldViewEnabled
    ? null
    : device.createBuffer({
        label: 'ulg-mls-mpm-p2g-grid-accumulators',
        size: Math.max(4, accumulatorByteLength),
        usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
      });
  if (accumulatorBuffer) trackOwnedBuffer(accumulatorBuffer);
  const paramsBuffer = device.createBuffer(mechanicsFieldViewEnabled ? {
    label: 'ulg-mls-mpm-p2g-mechanics-field-params',
    size: MECHANICS_FIELD_P2G_PARAMS_BYTES,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  } : {
    label: 'ulg-mls-mpm-p2g-params',
    size: P2G_PARAMS_BYTES,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  trackOwnedBuffer(paramsBuffer);
  const compactMechanicsIndirectBuffer = mechanicsFieldViewEnabled
    ? device.createBuffer({
        label: 'ulg-mls-mpm-staged-p2g-compact-mechanics-indirect',
        size: 3 * Uint32Array.BYTES_PER_ELEMENT,
        usage: GPU_BUFFER_USAGE.COPY_DST | GPU_BUFFER_USAGE.INDIRECT
      })
    : null;
  if (compactMechanicsIndirectBuffer) {
    trackOwnedBuffer(compactMechanicsIndirectBuffer);
  }
  const mechanicsFieldIndirectBuffer = mechanicsFieldViewEnabled
    ? device.createBuffer({
        label: 'ulg-mls-mpm-staged-p2g-mechanics-field-indirect',
        size: 3 * Uint32Array.BYTES_PER_ELEMENT,
        usage: GPU_BUFFER_USAGE.COPY_DST | GPU_BUFFER_USAGE.INDIRECT
      })
    : null;
  if (mechanicsFieldIndirectBuffer) {
    trackOwnedBuffer(mechanicsFieldIndirectBuffer);
  }
  const noFullReadback = readbackMode === NO_FULL_READBACK_MODE;
  if (mechanicsFieldViewEnabled && !noFullReadback) {
    throw new Error(
      'Mechanics-field staged P2G supports resident no-full-readback execution only'
    );
  }
  if (mechanicsFieldViewEnabled && retainGridBuffer) {
    throw new Error(
      'Mechanics-field staged P2G does not publish dense-grid retained state'
    );
  }
  const readBuffer = noFullReadback
    ? null
    : device.createBuffer({
      label: 'ulg-mls-mpm-p2g-grid-readback',
      size: Math.max(4, outputByteLength),
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
  if (readBuffer) trackOwnedBuffer(readBuffer);
  try {
    if (mechanicsFieldViewEnabled) {
      const mutationState = mechanicsFieldMutationRuntime?.stateMutationState?.(
        mechanicsFieldExecution
      );
      if (
        !Number.isSafeInteger(mutationState?.ordinal)
        || mutationState.ordinal < 0
        || !Number.isSafeInteger(mutationState?.encoding)
        || mutationState.encoding < 0
        || typeof mechanicsFieldMutationRuntime?.reserveStateMutation !== 'function'
        || typeof mechanicsFieldMutationRuntime?.markStateMutationSubmitted !== 'function'
        || typeof mechanicsFieldMutationRuntime?.discardStateMutation !== 'function'
        || typeof mechanicsFieldMutationRuntime?.quarantineStateMutation !== 'function'
      ) {
        throw new TypeError(
          'Required mechanics-field P2G needs exact mutable-field operation provenance'
        );
      }
      if (fusedTransaction != null) {
        const fusedParticleInputsStillAdmitted = Boolean(
          sphParticleState.particleCount > 0
          && mlsMpmParticleState.particleCount
            === sphParticleState.particleCount
          && canonicalParticleContinuation?.sphParticleUpload?.particleCount
            === sphParticleState.particleCount
          && canonicalParticleContinuation?.mlsMpmParticleUpload?.particleCount
            === sphParticleState.particleCount
          && sphParticleUpload
            === canonicalParticleContinuation?.sphParticleUpload
          && mlsMpmParticleUpload
            === canonicalParticleContinuation?.mlsMpmParticleUpload
          && fusedParticleUploadAbiMatches(
            device,
            sphParticleUpload,
            mlsMpmParticleUpload,
            sphParticleState.particleCount
          )
        );
        const terminalTransactionAdmitted = fusedCoarseTerminal
          ? canonicalParticleContinuation
              === fusedCoarseTerminalTransaction.particleContinuation
            && fusedCoarseTerminalTransaction.coarseFieldView
              === mechanicsFieldExecution
            && schroederSpatialEpochGeneration
              === fusedCoarseTerminalTransaction.microepochAuthority.generation
            && schroederSelectedLevel
              === fusedCoarseTerminalTransaction.macroAuthority.coarseLevel
            && sphParticleUpload
              === canonicalParticleContinuation.sphParticleUpload
            && mlsMpmParticleUpload
              === canonicalParticleContinuation.mlsMpmParticleUpload
            && Object.is(
              Number(dt),
              fusedCoarseTerminalTransaction.macroAuthority.macroDt
            )
            && validateSchroederFusedCoarseTerminalTransaction(
              device,
              fusedCoarseTerminalTransaction,
              {
                stage: 'p2g',
                macroAuthority:
                  fusedCoarseTerminalTransaction.macroAuthority,
                microepochAuthority:
                  fusedCoarseTerminalTransaction.microepochAuthority,
                particleContinuation: canonicalParticleContinuation
              }
            )
          : false;
        const fineTransactionAdmitted = fusedFineSubstep
          ? canonicalParticleContinuation
              === fusedFineSubstepTransaction.particleContinuation
            && fusedFineSubstepTransaction.fineFieldView
              === mechanicsFieldExecution
            && Object.is(
              Number(dt),
              fusedFineSubstepTransaction.macroAuthority?.fineDt
            )
            && validateSchroederFusedFineSubstepTransaction(
              device,
              fusedFineSubstepTransaction,
              {
                stage: 'p2g',
                particleContinuation: canonicalParticleContinuation
              }
            )
          : false;
        if (
          mechanicsFieldP2gClaims.get(fusedTransaction)
            !== fusedProducerClaim
          || !fusedParticleInputsStillAdmitted
          || !mechanicsFieldParticleFamilyAdmitted
          || !(fineTransactionAdmitted || terminalTransactionAdmitted)
        ) {
          throw new TypeError(
            'fused P2G producer claim or exact transaction provenance is stale'
          );
        }
        mechanicsFieldMutationToken = fusedTransaction.p2gMutation;
      } else {
        mechanicsFieldMutationToken =
          mechanicsFieldMutationRuntime.reserveStateMutation(
            mechanicsFieldExecution,
            {
              expectedOrdinal: mutationState.ordinal,
              expectedEncoding: mutationState.encoding,
              outputEncoding:
                SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_MOMENTUM_GRADIENT,
              operation: 'p2g-mass-momentum-gradient-submitted'
            }
          );
      }
    }
    // Declare exactly the consumers that will run. Carrying a fused
    // transaction does not imply cross-level pressure consumption: the coarse
    // terminal projection is fused yet is never read by the cross-level
    // operator, and a field that declares a consumer which never claims it
    // blocks G2P forever on required == claimed == consumed. Bound once here
    // so the published pressure provenance records the exact mask uploaded.
    const mechanicsFieldPressureRequiredConsumerMask =
      SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_CONSUMER_LOCAL
        | (pressureCrossLevelConsumerRequired === true
          ? SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_CONSUMER_CROSS_LEVEL
          : 0);
    device.queue.writeBuffer(
      paramsBuffer,
      0,
      mechanicsFieldViewEnabled
        ? mechanicsFieldKernelBundle.createFusedP2gParamsArray(
            gridSpec,
            sphParticleState.particleCount,
            dt,
            internalPressureScale,
            schroederFilter,
            mechanicsFieldBinding,
            false,
            ambientPressurePa,
            externalGaugePressurePa,
            externalGaugePressureEnabled,
            mechanicsFieldMutationToken,
            mechanicsFieldPressureRequiredConsumerMask
          )
        : createProjectionParamsArray(
            gridSpec,
            sphParticleState.particleCount,
            dt,
            productEventCount,
            internalPressureScale,
            schroederFilter,
            ambientPressurePa,
            externalGaugePressurePa,
            externalGaugePressureEnabled,
            schroederSpatialDirectory
          )
    );
    const p2gBindings = [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'read-only-storage'),
      computeBufferBinding(3, 'storage'),
      computeBufferBinding(4, 'uniform'),
      computeBufferBinding(5, mechanicsFieldViewEnabled ? 'storage' : 'read-only-storage'),
      computeBufferBinding(6, mechanicsFieldViewEnabled ? 'read-only-storage' : 'storage'),
      computeBufferBinding(7, canonicalSpatialAuthority ? 'storage' : 'read-only-storage'),
      computeBufferBinding(8, 'read-only-storage')
    ];
    const p2gShader = mechanicsFieldViewEnabled
      ? (observeCanonicalSpatialAuthority === true
          ? mechanicsFieldKernelBundle
            .mlsMpmP2gGridProjectionCanonicalSpatialMechanicsFieldWgsl
          : mechanicsFieldKernelBundle
            .mlsMpmP2gGridProjectionCanonicalSpatialUnobservedMechanicsFieldWgsl)
      : canonicalSpatialAuthority
      ? (observeCanonicalSpatialAuthority === true
          ? mlsMpmP2gGridProjectionCanonicalSpatialWgsl
          : mlsMpmP2gGridProjectionCanonicalSpatialUnobservedWgsl)
      : mlsMpmP2gGridProjectionWgsl;
    const p2gVariant = mechanicsFieldViewEnabled
      ? `canonical-spatial-mechanics-field-deterministic-reduction.v4.${
        observeCanonicalSpatialAuthority === true ? 'observed' : 'unobserved'}`
      : canonicalSpatialAuthority
      ? `canonical-spatial-epoch.v10.${observeCanonicalSpatialAuthority === true
          ? 'observed'
          : 'unobserved'}`
      : 'precanonical-level-assignment.v9';
    const { pipeline, bindGroupLayout } = createCachedExplicitComputePipeline(device, {
      cacheKey: `ulg-mls-mpm-p2g-grid-projection.scatter.${p2gVariant}`,
      label: 'ulg-mls-mpm-p2g-grid-projection',
      code: p2gShader,
      entryPoint: 'main',
      bindings: p2gBindings
    });
    const { pipeline: productPipeline, bindGroupLayout: productBindGroupLayout } = createCachedExplicitComputePipeline(device, {
      cacheKey: `ulg-mls-mpm-p2g-grid-projection.product-scatter.${p2gVariant}`,
      label: 'ulg-mls-mpm-p2g-product-event-scatter',
      code: p2gShader,
      entryPoint: 'scatter_product_events',
      bindings: p2gBindings
    });
    const { pipeline: finalizePipeline, bindGroupLayout: finalizeBindGroupLayout } = createCachedExplicitComputePipeline(device, {
      cacheKey: `ulg-mls-mpm-p2g-grid-projection.finalize.${p2gVariant}`,
      label: 'ulg-mls-mpm-p2g-grid-finalize',
      code: p2gShader,
      entryPoint: 'finalize_grid',
      bindings: p2gBindings
    });
    const compactPreflightPipelineInfos = mechanicsFieldViewEnabled
      ? mechanicsFieldKernelBundle.COMPACT_MECHANICS_PREFLIGHT_ENTRY_POINTS.map(
          (stage) => createCachedExplicitComputePipeline(device, {
            cacheKey: `ulg-mls-mpm-staged-p2g.${p2gVariant}.${stage.id}`,
            label: `ulg-mls-mpm-staged-p2g-${stage.id}`,
            code: p2gShader,
            entryPoint: stage.entryPoint,
            bindings: p2gBindings
          })
        )
      : [];
    const fieldPreflightPipelineInfos = mechanicsFieldViewEnabled
      ? mechanicsFieldKernelBundle.MECHANICS_FIELD_PREFLIGHT_ENTRY_POINTS.map(
          (stage) => createCachedExplicitComputePipeline(device, {
            cacheKey: `ulg-mls-mpm-staged-p2g.${p2gVariant}.${stage.id}`,
            label: `ulg-mls-mpm-staged-p2g-${stage.id}`,
            code: p2gShader,
            entryPoint: stage.entryPoint,
            bindings: p2gBindings
          })
        )
      : [];
    const compactValidationPipelineInfo = mechanicsFieldViewEnabled
      ? createCachedExplicitComputePipeline(device, {
          cacheKey: `ulg-mls-mpm-staged-p2g.${p2gVariant}.validate-compact`,
          label: 'ulg-mls-mpm-staged-p2g-validate-compact-mechanics',
          code: p2gShader,
          entryPoint: 'validate_compact_mechanics_nodes',
          bindings: p2gBindings
        })
      : null;
    const fieldValidationPipelineInfo = mechanicsFieldViewEnabled
      ? createCachedExplicitComputePipeline(device, {
          cacheKey: `ulg-mls-mpm-staged-p2g.${p2gVariant}.validate-fields`,
          label: 'ulg-mls-mpm-staged-p2g-validate-mechanics-fields',
          code: p2gShader,
          entryPoint: 'validate_mechanics_field_keys',
          bindings: p2gBindings
        })
      : null;
    const fieldClearPipelineInfo = mechanicsFieldViewEnabled
      ? createCachedExplicitComputePipeline(device, {
          cacheKey: `ulg-mls-mpm-staged-p2g.${p2gVariant}.clear-fields`,
          label: 'ulg-mls-mpm-staged-p2g-clear-mechanics-fields',
          code: p2gShader,
          entryPoint: 'clear_accumulators',
          bindings: p2gBindings
        })
      : null;
    const fieldSealPipelineInfo = mechanicsFieldViewEnabled
      ? createCachedExplicitComputePipeline(device, {
          cacheKey: `ulg-mls-mpm-staged-p2g.${p2gVariant}.seal-momentum-state`,
          label: 'ulg-mls-mpm-staged-p2g-seal-momentum-state',
          code: p2gShader,
          entryPoint: 'seal_mechanics_field_momentum_state',
          bindings: p2gBindings
        })
      : null;
    const p2gEntries = [
        { binding: 0, resource: { buffer: stateBuffer } },
        { binding: 1, resource: { buffer: thermoBuffer } },
        { binding: 2, resource: { buffer: mechanicsBuffer } },
        { binding: 3, resource: { buffer: mechanicsFieldViewEnabled
          ? mechanicsFieldBinding.mechanicsFieldViewBuffer
          : accumulatorBuffer } },
        { binding: 4, resource: { buffer: paramsBuffer } },
        { binding: 5, resource: { buffer: mechanicsFieldViewEnabled
          ? mechanicsFieldContributionBuffer
          : productEventBuffer } },
        { binding: 6, resource: { buffer: mechanicsFieldViewEnabled
          ? mechanicsFieldExecution.stableCandidateOrderBuffer
          : gridBuffer } },
        { binding: 7, resource: { buffer: schroederAuthorityBuffer } },
        { binding: 8, resource: { buffer: mechanicsFieldBinding?.activeNodeBuffer
          ?? schroederSpatialDirectory.buffer } }
      ];
    const bindGroup = device.createBindGroup({ layout: bindGroupLayout, entries: p2gEntries });
    const productBindGroup = device.createBindGroup({ layout: productBindGroupLayout, entries: p2gEntries });
    const finalizeBindGroup = device.createBindGroup({ layout: finalizeBindGroupLayout, entries: p2gEntries });
    const compactPreflightBindGroups = compactPreflightPipelineInfos.map(
      (info) => device.createBindGroup({
        layout: info.bindGroupLayout,
        entries: p2gEntries
      })
    );
    const fieldPreflightBindGroups = fieldPreflightPipelineInfos.map(
      (info) => device.createBindGroup({
        layout: info.bindGroupLayout,
        entries: p2gEntries
      })
    );
    const compactValidationBindGroup = compactValidationPipelineInfo
      ? device.createBindGroup({
          layout: compactValidationPipelineInfo.bindGroupLayout,
          entries: p2gEntries
        })
      : null;
    const fieldValidationBindGroup = fieldValidationPipelineInfo
      ? device.createBindGroup({
          layout: fieldValidationPipelineInfo.bindGroupLayout,
          entries: p2gEntries
        })
      : null;
    const fieldClearBindGroup = fieldClearPipelineInfo
      ? device.createBindGroup({
          layout: fieldClearPipelineInfo.bindGroupLayout,
          entries: p2gEntries
        })
      : null;
    const fieldSealBindGroup = fieldSealPipelineInfo
      ? device.createBindGroup({
          layout: fieldSealPipelineInfo.bindGroupLayout,
          entries: p2gEntries
        })
      : null;
    const encoder = device.createCommandEncoder();
    if (canonicalSpatialAuthority) {
      const evidenceOffsetBytes =
        SCHROEDER_MECHANICS_SPATIAL_AUTHORITY_EVIDENCE_OFFSET_WORDS
        * Uint32Array.BYTES_PER_ELEMENT;
      if (typeof encoder.clearBuffer === 'function') {
        encoder.clearBuffer(
          schroederAuthorityBuffer,
          evidenceOffsetBytes,
          SCHROEDER_MECHANICS_SPATIAL_AUTHORITY_EVIDENCE_BYTES
        );
      } else {
        device.queue.writeBuffer(
          schroederAuthorityBuffer,
          evidenceOffsetBytes,
          new Uint32Array(
            SCHROEDER_MECHANICS_SPATIAL_AUTHORITY_EVIDENCE_BYTES
            / Uint32Array.BYTES_PER_ELEMENT
          )
        );
      }
    }
    if (mechanicsFieldViewEnabled) {
      if (
        typeof encoder.copyBufferToBuffer !== 'function'
        || typeof encoder.beginComputePass !== 'function'
      ) {
        throw new Error(
          'Mechanics-field staged P2G requires copyBufferToBuffer and indirect compute dispatch'
        );
      }
      const preflightPass = encoder.beginComputePass();
      for (let index = 0; index < compactPreflightPipelineInfos.length; index += 1) {
        preflightPass.setPipeline(compactPreflightPipelineInfos[index].pipeline);
        preflightPass.setBindGroup(0, compactPreflightBindGroups[index]);
        preflightPass.dispatchWorkgroups(1);
      }
      for (let index = 0; index < fieldPreflightPipelineInfos.length; index += 1) {
        preflightPass.setPipeline(fieldPreflightPipelineInfos[index].pipeline);
        preflightPass.setBindGroup(0, fieldPreflightBindGroups[index]);
        preflightPass.dispatchWorkgroups(1);
      }
      preflightPass.end();
      const copyIndirectArgs = () => {
        encoder.copyBufferToBuffer(
          mechanicsFieldBinding.mechanicsViewIndirectDispatchBuffer,
          mechanicsFieldBinding.mechanicsViewIndirectDispatchOffsetBytes,
          compactMechanicsIndirectBuffer,
          0,
          3 * Uint32Array.BYTES_PER_ELEMENT
        );
        encoder.copyBufferToBuffer(
          mechanicsFieldBinding.mechanicsFieldViewIndirectDispatchBuffer,
          mechanicsFieldBinding.mechanicsFieldViewIndirectDispatchOffsetBytes,
          mechanicsFieldIndirectBuffer,
          0,
          3 * Uint32Array.BYTES_PER_ELEMENT
        );
      };
      copyIndirectArgs();
      const validationPass = encoder.beginComputePass();
      validationPass.setPipeline(compactValidationPipelineInfo.pipeline);
      validationPass.setBindGroup(0, compactValidationBindGroup);
      validationPass.dispatchWorkgroupsIndirect(compactMechanicsIndirectBuffer, 0);
      validationPass.setPipeline(fieldValidationPipelineInfo.pipeline);
      validationPass.setBindGroup(0, fieldValidationBindGroup);
      validationPass.dispatchWorkgroupsIndirect(mechanicsFieldIndirectBuffer, 0);
      validationPass.end();
      copyIndirectArgs();
      const clearPass = encoder.beginComputePass();
      clearPass.setPipeline(fieldClearPipelineInfo.pipeline);
      clearPass.setBindGroup(0, fieldClearBindGroup);
      clearPass.dispatchWorkgroupsIndirect(mechanicsFieldIndirectBuffer, 0);
      clearPass.end();
    } else if (typeof encoder.clearBuffer === 'function') {
      encoder.clearBuffer(accumulatorBuffer, 0, Math.max(4, accumulatorByteLength));
    } else {
      device.queue.writeBuffer(accumulatorBuffer, 0, new Int32Array(accumulatorElementCount));
    }
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.max(1, Math.ceil(sphParticleState.particleCount / 64)));
    pass.end();
    if (productEventCount > 0) {
      const productPass = encoder.beginComputePass();
      productPass.setPipeline(productPipeline);
      productPass.setBindGroup(0, productBindGroup);
      productPass.dispatchWorkgroups(Math.max(1, Math.ceil(productEventCount / 64)));
      productPass.end();
    }
    const finalizePass = encoder.beginComputePass();
    finalizePass.setPipeline(finalizePipeline);
    finalizePass.setBindGroup(0, finalizeBindGroup);
    if (mechanicsFieldViewEnabled) {
      finalizePass.dispatchWorkgroupsIndirect(mechanicsFieldIndirectBuffer, 0);
    } else {
      finalizePass.dispatchWorkgroups(Math.max(1, Math.ceil(gridSpec.gridNodeCount / 64)));
    }
    finalizePass.end();
    if (mechanicsFieldViewEnabled) {
      const sealPass = encoder.beginComputePass();
      sealPass.setPipeline(fieldSealPipelineInfo.pipeline);
      sealPass.setBindGroup(0, fieldSealBindGroup);
      sealPass.dispatchWorkgroups(1);
      sealPass.end();
    }
    if (!noFullReadback) {
      if (!gridBuffer) {
        throw new Error('Dense P2G readback requires an allocated dense-grid buffer');
      }
      encoder.copyBufferToBuffer(gridBuffer, 0, readBuffer, 0, Math.max(4, outputByteLength));
    }
    device.queue.submit([encoder.finish()]);
    p2gQueueSubmitted = true;
    if (mechanicsFieldViewEnabled) {
      if (fusedTransaction != null) {
        if (fusedFineSubstep) {
          markSchroederFusedFineSubstepStageSubmissionObserved(
            device,
            fusedFineSubstepTransaction,
            {
              stage: 'p2g',
              producerCapability: fusedProducerClaim.producerCapability
            }
          );
        } else {
          markSchroederFusedCoarseTerminalStageSubmissionObserved(
            device,
            fusedCoarseTerminalTransaction,
            {
              stage: 'p2g',
              producerCapability: fusedProducerClaim.producerCapability
            }
          );
        }
      }
    }
    let gridNodes = new Float32Array();
    if (!noFullReadback) {
      await readBuffer.mapAsync(GPU_MAP_MODE.READ);
      gridNodes = new Float32Array(readBuffer.getMappedRange()).slice(0, gridSpec.gridNodeCount * MLS_MPM_GPU_GRID_NODE_FLOATS);
      readBuffer.unmap();
    }
    const projection = outputEnvelope({
      backend: 'webgpu',
      sphParticleState,
      mlsMpmParticleState,
      gridSpec,
      gridNodes,
      dt,
      internalPressureScale,
      ambientPressurePa,
      externalGaugePressurePa,
      externalGaugePressureEnabled,
      readbackMode: noFullReadback ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE,
      p2gBackendPolicy,
      residentProductMass,
      residentProductMassProductEventCount: productEventCount,
      residentProductMassCoupledEventCount: productEventCount > 0
        ? (residentProductMass?.productEventActiveEventCount ?? null)
        : 0,
      residentProductMassCoupledUnplacedMassKg: productEventCount > 0
        ? (residentProductMass?.unplacedProductMassKg ?? null)
        : 0,
      residentProductMassProductEventBufferDeviceMismatch: productEventBufferMismatch.mismatch,
      residentProductMassProductEventBufferSourceDeviceId: productEventBufferMismatch.sourceDeviceId,
      residentProductMassProductEventBufferConsumerDeviceId: productEventBufferMismatch.consumerDeviceId,
      schroederLevelFilter: schroederFilter,
      schroederSpatialDirectory: schroederSpatialDirectoryMetadata(
        schroederSpatialDirectory
      )
    });
    projection.mechanicsFieldViewEnabled = mechanicsFieldViewEnabled;
    projection.mechanicsFieldMode = mechanicsFieldMode;
    projection.mechanicsFieldView = mechanicsFieldViewEnabled
      ? mechanicsFieldBinding.mechanicsFieldViewBuffer
      : null;
    projection.mechanicsFieldViewBuffer = projection.mechanicsFieldView;
    projection.mechanicsFieldViewByteLength = mechanicsFieldViewEnabled
      ? Number(
          mechanicsFieldBinding.mechanicsFieldViewBuffer?.size
          ?? mechanicsFieldBinding.mechanicsFieldViewExecution?.layout?.byteLength
          ?? 0
        )
      : 0;
    projection.mechanicsFieldViewOwned = false;
    projection.mechanicsFieldViewExecution = mechanicsFieldViewEnabled
      ? mechanicsFieldBinding.mechanicsFieldViewExecution
      : null;
    projection.mechanicsFieldIndirectDispatchDimensions =
      mechanicsFieldViewEnabled ? 2 : 0;
    projection.mechanicsFieldIndirectDispatchLinearization =
      mechanicsFieldViewEnabled
        ? 'linearGroup=workgroup.x+workgroup.y*dispatchX'
        : null;
    projection.mechanicsFieldSourceDispatchWorkgroups =
      mechanicsFieldViewEnabled
        ? mechanicsFieldExecution.sourceDispatchWorkgroups
        : null;
    projection.mechanicsFieldCandidateDispatchWorkgroups =
      mechanicsFieldViewEnabled
        ? mechanicsFieldExecution.candidateDispatchWorkgroups
        : null;
    projection.mechanicsFieldMutationInputOrdinal =
      mechanicsFieldMutationToken?.expectedOrdinal ?? null;
    projection.mechanicsFieldMutationOutputOrdinal =
      mechanicsFieldMutationToken?.outputOrdinal ?? null;
    projection.mechanicsFieldMutationInputStateEncoding =
      mechanicsFieldMutationToken?.expectedEncoding ?? null;
    projection.mechanicsFieldMutationOutputStateEncoding =
      mechanicsFieldMutationToken?.outputEncoding ?? null;
    // The exact pressure law sealed into this field's pressure receipt. Every
    // downstream consumer authenticates against these, not against whatever
    // pressure parameters it happens to be called with.
    projection.mechanicsFieldPressureRequiredConsumerMask =
      mechanicsFieldViewEnabled
        ? mechanicsFieldPressureRequiredConsumerMask
        : null;
    projection.gridStateAuthority = mechanicsFieldViewEnabled
      ? 'schroeder-spatial-mechanics-field-view-v1'
      : 'dense-mls-mpm-grid-state';
    projection.denseGridAuthoritative = !mechanicsFieldViewEnabled;
    projection.denseGridBufferAllocatedBytes = Number(gridBuffer?.size ?? 0);
    projection.denseAccumulatorBufferAllocatedBytes = Number(
      accumulatorBuffer?.size ?? 0
    );
    projection.mechanicsFieldP2gContributionBufferAllocatedBytes = Number(
      mechanicsFieldContributionBuffer?.size ?? 0
    );
    projection.mechanicsFieldP2gReductionOrder = mechanicsFieldViewEnabled
      ? mechanicsFieldExecution.stableCandidateOrderPolicy
      : null;
    projection.mechanicsFieldP2gReductionMode = mechanicsFieldViewEnabled
      ? 'stable-radix-ordered-field-reduction'
      : null;
    if (fusedTransaction != null) {
      const transactionProperty = fusedFineSubstep
        ? 'fusedFineSubstepTransaction'
        : 'fusedCoarseTerminalTransaction';
      const microepochProperty = fusedFineSubstep
        ? 'fineMicroepochAuthority'
        : 'terminalMicroepochAuthority';
      Object.defineProperties(projection, {
        [transactionProperty]: {
          value: fusedTransaction,
          enumerable: false,
          configurable: false,
          writable: false
        },
        [microepochProperty]: {
          value: fusedTransaction.microepochAuthority,
          enumerable: false,
          configurable: false,
          writable: false
        },
        sourceParticleContinuation: {
          value: canonicalParticleContinuation,
          enumerable: false,
          configurable: false,
          writable: false
        },
        proposalMode: {
          value: 'proposal-deferred-to-post-mechanics',
          enumerable: false,
          configurable: false,
          writable: false
        }
      });
      registerSubmittedMechanicsFieldP2g(device, projection, {
        transaction: fusedTransaction,
        particleContinuation: canonicalParticleContinuation,
        mutationSegment: mechanicsFieldMutationToken,
        sphParticleUpload,
        mlsMpmParticleUpload,
        transactionMode: fusedTransactionMode,
        canonicalGeneration: schroederSpatialEpochGeneration,
        selectedLevel: schroederSelectedLevel
      });
      try {
        if (fusedFineSubstep) {
          markSchroederFusedFineSubstepStageSubmitted(
            device,
            fusedFineSubstepTransaction,
            {
              stage: 'p2g',
              artifact: projection,
              producerCapability: fusedProducerClaim.producerCapability
            }
          );
        } else {
          markSchroederFusedCoarseTerminalStageSubmitted(
            device,
            fusedCoarseTerminalTransaction,
            {
              stage: 'p2g',
              artifact: projection,
              producerCapability: fusedProducerClaim.producerCapability
            }
          );
        }
      } catch (error) {
        mechanicsFieldP2gOrigins.delete(projection);
        throw error;
      }
      mechanicsFieldMutationCommitted = true;
    }
    if (retainGridBuffer && gridBuffer) {
      projection.gridBuffer = gridBuffer;
      projection.gridBufferByteLength = outputByteLength;
      projection.destroyGridBuffer = () => gridBuffer.destroy?.();
      if (gridBufferAllocationEntry) {
        ownedAllocationEntries.delete(gridBufferAllocationEntry);
      }
    }
    if (mechanicsFieldViewEnabled && fusedTransaction == null) {
      mechanicsFieldMutationRuntime.markStateMutationSubmitted(
        mechanicsFieldMutationToken
      );
      mechanicsFieldMutationCommitted = true;
    }
    return projection;
  } finally {
    if (mechanicsFieldMutationToken && !mechanicsFieldMutationCommitted) {
      if (fusedTransaction != null) {
        try {
          if (p2gQueueSubmitted) {
            if (fusedFineSubstep) {
              quarantineSchroederFusedFineSubstepTransaction(
                device,
                fusedFineSubstepTransaction,
                new Error('P2G submission completed before fused artifact publication')
              );
            } else {
              quarantineSchroederFusedCoarseTerminalTransaction(
                device,
                fusedCoarseTerminalTransaction,
                new Error(
                  'coarse-terminal P2G submission completed before artifact publication'
                )
              );
            }
          } else {
            if (fusedFineSubstep) {
              releaseSchroederFusedFineSubstepStageProducer(
                device,
                fusedFineSubstepTransaction,
                fusedProducerClaim.producerCapability
              );
            } else {
              releaseSchroederFusedCoarseTerminalStageProducer(
                device,
                fusedCoarseTerminalTransaction,
                fusedProducerClaim.producerCapability
              );
            }
            if (fusedFineSubstep) {
              discardSchroederFusedFineSubstepTransaction(
                device,
                fusedFineSubstepTransaction,
                { discardedEncoder: true }
              );
            } else {
              discardSchroederFusedCoarseTerminalTransaction(
                device,
                fusedCoarseTerminalTransaction,
                { discardedEncoder: true }
              );
            }
          }
        } catch {
          // Preserve the originating P2G error; the exact field remains
          // pending or quarantined and therefore cannot be republished.
        }
      } else {
        try {
          if (p2gQueueSubmitted) {
            mechanicsFieldMutationRuntime.quarantineStateMutation(
              mechanicsFieldMutationToken,
              {
                submissionObserved: true,
                reason: new Error(
                  'P2G submission completed before mechanics-field artifact publication'
                )
              }
            );
          } else {
            mechanicsFieldMutationRuntime.discardStateMutation(
              mechanicsFieldMutationToken,
              { discardedEncoder: true }
            );
          }
        } catch {
          // Preserve the originating P2G error. A submitted mutation remains
          // pending or quarantined, so the field cannot be republished.
        }
      }
    }
    scheduleOwnedBufferCleanup(p2gQueueSubmitted, noFullReadback);
  }
  } finally {
    if (!allocationCleanupDelegated) cleanupOwnedBuffers();
    if (fusedProducerClaim != null) {
      try {
        if (fusedFineSubstep) {
          releaseSchroederFusedFineSubstepStageProducer(
            device,
            fusedFineSubstepTransaction,
            fusedProducerClaim.producerCapability
          );
        } else {
          releaseSchroederFusedCoarseTerminalStageProducer(
            device,
            fusedCoarseTerminalTransaction,
            fusedProducerClaim.producerCapability
          );
        }
      } catch {
        // Observed/submitted producers are consumed or quarantined, never
        // returned to the pre-submit pool by outer cleanup.
      }
    }
    if (fusedTransaction != null
        && mechanicsFieldP2gClaims.get(fusedTransaction)
          === fusedProducerClaim) {
      mechanicsFieldP2gClaims.delete(fusedTransaction);
    }
  }
}

function createNoFullReadbackParityReport(tolerance = 5e-2) {
  return {
    schema: ULG_MLS_MPM_GPU_GRID_PROJECTION_PARITY_SCHEMA,
    status: 'not-run-no-full-readback',
    tolerance,
    maxGridAbs: null,
    lengthMismatch: null,
    reason: 'Full P2G grid readback and CPU parity were skipped for resident WebGPU execution',
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

function createCanonicalSpatialParityReport(tolerance = 5e-2) {
  return {
    schema: ULG_MLS_MPM_GPU_GRID_PROJECTION_PARITY_SCHEMA,
    status: 'not-run-canonical-spatial-authority',
    tolerance,
    maxGridAbs: null,
    lengthMismatch: null,
    reason: 'Assignment-row CPU parity is not a valid oracle for canonical directory authority',
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

function canonicalSpatialExecutionError(status, reason, cause = null) {
  const error = new Error(`Canonical MLS-MPM P2G execution rejected: ${reason}`);
  error.code = 'ERR_CANONICAL_SPATIAL_AUTHORITY_REJECTED';
  error.status = status;
  if (cause != null) error.cause = cause;
  return error;
}

export function createMlsMpmP2gGridProjectionParityReport({ cpuReference, gpuResult, tolerance = 5e-2 } = {}) {
  const cpuGrid = cpuReference?.gridNodes;
  const gpuGrid = gpuResult?.gridNodes;
  if (!(cpuGrid instanceof Float32Array) || !(gpuGrid instanceof Float32Array)) {
    return {
      schema: ULG_MLS_MPM_GPU_GRID_PROJECTION_PARITY_SCHEMA,
      status: 'fail',
      tolerance,
      maxGridAbs: Number.POSITIVE_INFINITY,
      lengthMismatch: true,
      reason: 'missing grid projection buffers',
      cpuBackend: cpuReference?.backend || null,
      gpuBackend: gpuResult?.backend || null,
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  }
  const comparisonCount = Math.min(cpuGrid.length, gpuGrid.length);
  let maxGridAbs = 0;
  let ignoredInactivePositionMaxAbs = 0;
  let ignoredInactivePositionCount = 0;
  for (let index = 0; index < comparisonCount; index += 1) {
    const field = index % MLS_MPM_GPU_GRID_NODE_FLOATS;
    const rowOffset = index - field;
    const inactiveInBoth = (cpuGrid[rowOffset] ?? 0) === 0
      && (gpuGrid[rowOffset] ?? 0) === 0
      && (cpuGrid[rowOffset + 7] ?? 0) === 0
      && (gpuGrid[rowOffset + 7] ?? 0) === 0;
    const diff = Math.abs(cpuGrid[index] - gpuGrid[index]);
    if (inactiveInBoth && field >= 4 && field <= 6) {
      ignoredInactivePositionMaxAbs = Math.max(ignoredInactivePositionMaxAbs, diff);
      if (diff > tolerance) ignoredInactivePositionCount += 1;
      continue;
    }
    maxGridAbs = Math.max(maxGridAbs, diff);
  }
  const lengthMismatch = cpuGrid.length !== gpuGrid.length;
  const passed = !lengthMismatch && maxGridAbs <= tolerance;
  return {
    schema: ULG_MLS_MPM_GPU_GRID_PROJECTION_PARITY_SCHEMA,
    status: passed ? 'pass' : 'fail',
    tolerance,
    maxGridAbs,
    lengthMismatch,
    ignoredInactivePositionMaxAbs,
    ignoredInactivePositionCount,
    gridNodeCount: cpuReference?.gridNodeCount ?? gpuResult?.gridNodeCount ?? 0,
    cpuBackend: cpuReference.backend,
    gpuBackend: gpuResult.backend,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

function executionFromProjection(projection, {
  cpuReference = null,
  gpuResult = null,
  webgpuStatus,
  webgpuParity = null
} = {}) {
  return {
    schema: ULG_MLS_MPM_GPU_GRID_PROJECTION_EXECUTION_SCHEMA,
    projectionSchema: projection?.schema || ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA,
    backend: projection?.backend || 'cpu-reference',
    status: projection?.status || 'projected',
    kernelScope: GRID_SCOPE,
    particleCount: projection?.particleCount ?? 0,
    dt: projection?.dt ?? 0,
    gridSpacingM: projection?.gridSpacingM ?? 0,
    gridDims: projection?.gridDims ?? [],
    gridNodeCount: projection?.gridNodeCount ?? 0,
    gridShift: projection?.gridShift ?? 1,
    gridNodeStrideFloats: MLS_MPM_GPU_GRID_NODE_FLOATS,
    gridNodes: projection?.gridNodes ?? new Float32Array(),
    internalPressureScale: projection?.internalPressureScale ?? 1,
    ambientPressurePa: projection?.ambientPressurePa ?? 0,
    ambientPressureAppliedInStressProjection:
      projection?.ambientPressureAppliedInStressProjection === true,
    externalGaugePressurePa: projection?.externalGaugePressurePa ?? 0,
    externalGaugePressureEnabled: projection?.externalGaugePressureEnabled === true,
    externalGaugePressureAppliedInStressProjection:
      projection?.externalGaugePressureAppliedInStressProjection === true,
    externalGaugePressureTarget: projection?.externalGaugePressureTarget ?? null,
    schroederLevelFilter: projection?.schroederLevelFilter ?? null,
    schroederLevelFilterEnabled: projection?.schroederLevelFilterEnabled === true,
    schroederSelectedLevel: projection?.schroederSelectedLevel ?? null,
    schroederSpatialDirectory: projection?.schroederSpatialDirectory ?? null,
    schroederSpatialDirectoryEnabled:
      projection?.schroederSpatialDirectoryEnabled === true,
    schroederSpatialDirectoryStatus:
      projection?.schroederSpatialDirectoryStatus ?? null,
    schroederSpatialDirectoryFallback:
      projection?.schroederSpatialDirectoryFallback === true,
    schroederSpatialDirectoryFallbackScope:
      projection?.schroederSpatialDirectoryFallbackScope ?? 'host-binding-only',
    schroederSpatialHostBindingAdmitted:
      projection?.schroederSpatialHostBindingAdmitted === true,
    schroederSpatialHostBindingFallback:
      projection?.schroederSpatialHostBindingFallback === true,
    schroederSpatialGpuAdmissionObserved:
      projection?.schroederSpatialGpuAdmissionObserved === true,
    schroederSpatialGpuAdmissionStatus:
      projection?.schroederSpatialGpuAdmissionStatus ?? null,
    schroederSpatialGpuFallbackObserved:
      projection?.schroederSpatialGpuFallbackObserved ?? null,
    mechanicsFieldMode:
      projection?.mechanicsFieldMode ?? MLS_MPM_MECHANICS_FIELD_MODE_DISABLED,
    mechanicsFieldViewEnabled:
      projection?.mechanicsFieldViewEnabled === true,
    mechanicsFieldViewExecution:
      projection?.mechanicsFieldViewExecution ?? null,
    mechanicsFieldViewBuffer:
      projection?.mechanicsFieldViewBuffer ?? projection?.mechanicsFieldView ?? null,
    mechanicsFieldViewByteLength:
      projection?.mechanicsFieldViewByteLength ?? 0,
    mechanicsFieldViewOwned: false,
    mechanicsFieldMutationInputOrdinal:
      projection?.mechanicsFieldMutationInputOrdinal ?? null,
    mechanicsFieldMutationOutputOrdinal:
      projection?.mechanicsFieldMutationOutputOrdinal ?? null,
    mechanicsFieldMutationInputStateEncoding:
      projection?.mechanicsFieldMutationInputStateEncoding ?? null,
    mechanicsFieldMutationOutputStateEncoding:
      projection?.mechanicsFieldMutationOutputStateEncoding ?? null,
    mechanicsFieldPressureRequiredConsumerMask:
      projection?.mechanicsFieldPressureRequiredConsumerMask ?? null,
    gridStateAuthority:
      projection?.gridStateAuthority ?? 'dense-mls-mpm-grid-state',
    denseGridAuthoritative:
      projection?.denseGridAuthoritative !== false,
    denseGridBufferAllocatedBytes:
      projection?.denseGridBufferAllocatedBytes ?? 0,
    denseAccumulatorBufferAllocatedBytes:
      projection?.denseAccumulatorBufferAllocatedBytes ?? 0,
    mechanicsFieldP2gContributionBufferAllocatedBytes:
      projection?.mechanicsFieldP2gContributionBufferAllocatedBytes ?? 0,
    mechanicsFieldP2gReductionMode:
      projection?.mechanicsFieldP2gReductionMode ?? null,
    mechanicsFieldP2gReductionOrder:
      projection?.mechanicsFieldP2gReductionOrder ?? null,
    readbackMode: projection?.readbackMode ?? FULL_READBACK_MODE,
    fullReadbackPerformed: projection?.fullReadbackPerformed ?? true,
    normalHotLoopReadbackFree: projection?.normalHotLoopReadbackFree ?? false,
    p2gBackendPolicy: projection?.p2gBackendPolicy ?? null,
    p2gBackendPolicyStatus: projection?.p2gBackendPolicyStatus ?? null,
    p2gBackendRequested: projection?.p2gBackendRequested ?? null,
    p2gBackendEffective: projection?.p2gBackendEffective ?? null,
    p2gBackendFallbackReason: projection?.p2gBackendFallbackReason ?? null,
    cpuReference,
    gpuResult,
    webgpuStatus,
    webgpuParity,
    p2gProjectionValidation: false,
    stressProjectionValidation: false,
    gridValidation: false,
    g2pValidation: false,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    residentProductMass: projection?.residentProductMass ?? null,
    residentProductMassStatus: projection?.residentProductMassStatus ?? null,
    residentProductMassInputProductEventCount: projection?.residentProductMassInputProductEventCount ?? 0,
    residentProductMassCoupledEventCount: projection?.residentProductMassCoupledEventCount ?? null,
    residentProductMassCoupledUnplacedMassKg: projection?.residentProductMassCoupledUnplacedMassKg ?? null,
    residentProductMassConsumeMassPolicy: projection?.residentProductMassConsumeMassPolicy ?? null,
    residentProductMassGridCouplingStatus: projection?.residentProductMassGridCouplingStatus ?? null,
    residentProductMassEosCouplingStatus: projection?.residentProductMassEosCouplingStatus ?? null,
    fullPhysicsValidation: false
  };
}

function describeDeviceLost(info) {
  return info?.reason || info?.message || 'device lost';
}

function watchDeviceLost(device, onDeviceLost) {
  if (!device?.lost?.then) return;
  device.lost.then((info) => onDeviceLost(info)).catch((error) => onDeviceLost(error));
}

export async function runMlsMpmP2gGridProjectionWithOptionalWebGpu({
  sphParticleState,
  mlsMpmParticleState,
  sphParticleUpload = null,
  mlsMpmParticleUpload = null,
  schroederLevelAssignment = null,
  schroederSelectedLevel = null,
  schroederSpatialEpochGeneration = null,
  canonicalSpatialRequired = false,
  observeCanonicalSpatialAuthority = false,
  mechanicsFieldMode = MLS_MPM_MECHANICS_FIELD_MODE_DISABLED,
  gridSpacingM = sphParticleState?.smoothingLengthM,
  boxDimsM = DEFAULT_BOX_DIMS_M,
  dt = mlsMpmParticleState?.mechanicsDtS ?? 0,
  residentProductMass = null,
  internalPressureScale = 1,
  ambientPressurePa = 0,
  externalGaugePressurePa = 0,
  externalGaugePressureEnabled = false,
  preferWebGpu = false,
  navigatorRef = globalThis.navigator,
  device = null,
  deviceResult = null,
  parityTolerance = 5e-2,
  retainGridBuffer = false,
  onDeviceLost = null,
  webGpuRunner = runMlsMpmP2gGridProjectionWebGpu,
  readbackMode = FULL_READBACK_MODE,
  p2gBackend = MLS_MPM_P2G_BACKEND_RESIDENT_SCATTER
} = {}) {
  const noFullReadback = readbackMode === NO_FULL_READBACK_MODE;
  const canonicalSpatialIntent = canonicalSpatialRequired === true
    || schroederSpatialEpochGeneration?.selected === true;
  const mechanicsFieldRequired =
    mechanicsFieldMode === MLS_MPM_MECHANICS_FIELD_MODE_REQUIRED;
  if (
    mechanicsFieldMode !== MLS_MPM_MECHANICS_FIELD_MODE_DISABLED
    && !mechanicsFieldRequired
  ) {
    throw new RangeError(
      `mechanicsFieldMode must be '${MLS_MPM_MECHANICS_FIELD_MODE_DISABLED}' or '${MLS_MPM_MECHANICS_FIELD_MODE_REQUIRED}'`
    );
  }
  if (mechanicsFieldRequired && !canonicalSpatialIntent) {
    throw canonicalSpatialExecutionError(
      'mechanics-field-canonical-generation-required',
      'required mechanics-field P2G cannot use an assignment-row or CPU authority'
    );
  }
  let cpuReference = null;
  const getCpuReference = () => {
    if (!cpuReference) {
      cpuReference = projectMlsMpmP2gGridCpu({
        sphParticleState,
        mlsMpmParticleState,
        gridSpacingM,
        boxDimsM,
        dt,
        residentProductMass,
        internalPressureScale,
        ambientPressurePa,
        externalGaugePressurePa,
        externalGaugePressureEnabled,
        schroederLevelAssignment,
        schroederSelectedLevel,
        p2gBackend: MLS_MPM_P2G_BACKEND_CPU_REFERENCE
      });
    }
    return cpuReference;
  };
  if (!preferWebGpu) {
    if (canonicalSpatialIntent) {
      throw canonicalSpatialExecutionError(
        'canonical-spatial-webgpu-not-requested',
        'canonical directory authority cannot fall back to assignment-row CPU projection'
      );
    }
    const reference = getCpuReference();
    return executionFromProjection(reference, {
      cpuReference: reference,
      webgpuStatus: {
        status: 'not-requested',
        reason: 'WebGPU MLS-MPM P2G grid projection path not requested'
      }
    });
  }
  try {
    let lostInfo = null;
    const resolvedDeviceResult = device
      ? { status: 'webgpu-device-ready', reason: 'provided device', device }
      : (deviceResult || await requestOpticalGpuDevice(navigatorRef, {
        onDeviceLost(info) {
          lostInfo = info;
          if (typeof onDeviceLost === 'function') onDeviceLost(info);
        }
      }));
    if (resolvedDeviceResult.device && device) {
      watchDeviceLost(resolvedDeviceResult.device, (info) => {
        lostInfo = info;
        if (typeof onDeviceLost === 'function') onDeviceLost(info);
      });
    }
    if (!resolvedDeviceResult.device) {
      if (canonicalSpatialIntent) {
        throw canonicalSpatialExecutionError(
          'canonical-spatial-webgpu-device-unavailable',
          resolvedDeviceResult.reason || 'WebGPU device unavailable'
        );
      }
      const reference = getCpuReference();
      return executionFromProjection(reference, {
        cpuReference: reference,
        webgpuStatus: {
          status: resolvedDeviceResult.status,
          reason: resolvedDeviceResult.reason,
          fallback: 'cpu-reference'
        }
      });
    }
    await Promise.resolve();
    if (lostInfo) {
      if (canonicalSpatialIntent) {
        throw canonicalSpatialExecutionError(
          'canonical-spatial-webgpu-device-lost',
          describeDeviceLost(lostInfo)
        );
      }
      const reference = getCpuReference();
      return executionFromProjection(reference, {
        cpuReference: reference,
        webgpuStatus: {
          status: 'webgpu-device-lost-fallback',
          reason: describeDeviceLost(lostInfo),
          fallback: 'cpu-reference'
        }
      });
    }
    const gpuResult = await webGpuRunner({
      device: resolvedDeviceResult.device,
      sphParticleState,
      mlsMpmParticleState,
      sphParticleUpload,
      mlsMpmParticleUpload,
      schroederLevelAssignment,
      schroederSelectedLevel,
      schroederSpatialEpochGeneration,
      canonicalSpatialRequired,
      observeCanonicalSpatialAuthority,
      mechanicsFieldMode,
      gridSpacingM,
      boxDimsM,
      dt,
      residentProductMass,
      internalPressureScale,
      ambientPressurePa,
      externalGaugePressurePa,
      externalGaugePressureEnabled,
      retainGridBuffer,
      readbackMode: noFullReadback ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE,
      p2gBackend
    });
    await Promise.resolve();
    if (lostInfo) {
      if (canonicalSpatialIntent) {
        throw canonicalSpatialExecutionError(
          'canonical-spatial-webgpu-device-lost',
          describeDeviceLost(lostInfo)
        );
      }
      const reference = getCpuReference();
      return executionFromProjection(reference, {
        cpuReference: reference,
        gpuResult,
        webgpuStatus: {
          status: 'webgpu-device-lost-fallback',
          reason: describeDeviceLost(lostInfo),
          fallback: 'cpu-reference'
        }
      });
    }
    if (noFullReadback) {
      return executionFromProjection(gpuResult, {
        cpuReference: null,
        gpuResult,
        webgpuStatus: {
          status: 'webgpu-executed-no-full-readback',
          reason: 'WebGPU MLS-MPM P2G grid projection executed without full grid readback'
        },
        webgpuParity: createNoFullReadbackParityReport(parityTolerance)
      });
    }
    if (canonicalSpatialIntent) {
      return executionFromProjection(gpuResult, {
        cpuReference: null,
        gpuResult,
        webgpuStatus: {
          status: 'webgpu-executed-canonical-spatial-authority',
          reason: 'Canonical directory-authoritative P2G executed without assignment-row CPU fallback'
        },
        webgpuParity: createCanonicalSpatialParityReport(parityTolerance)
      });
    }
    const reference = getCpuReference();
    const webgpuParity = createMlsMpmP2gGridProjectionParityReport({
      cpuReference: reference,
      gpuResult,
      tolerance: parityTolerance
    });
    if (webgpuParity.status !== 'pass') {
      gpuResult.destroyGridBuffer?.();
      return executionFromProjection(reference, {
        cpuReference: reference,
        gpuResult,
        webgpuStatus: {
          status: 'webgpu-parity-failed',
          reason: 'CPU/WebGPU MLS-MPM P2G grid projection parity exceeded tolerance',
          fallback: 'cpu-reference'
        },
        webgpuParity
      });
    }
    return executionFromProjection(gpuResult, {
      cpuReference: reference,
      gpuResult,
      webgpuStatus: {
        status: 'webgpu-executed',
        reason: 'CPU/WebGPU MLS-MPM P2G grid projection parity passed'
      },
      webgpuParity
    });
  } catch (error) {
    if (canonicalSpatialIntent) {
      if (error?.code === 'ERR_CANONICAL_SPATIAL_AUTHORITY_REJECTED') throw error;
      throw canonicalSpatialExecutionError(
        'canonical-spatial-webgpu-execution-error',
        error instanceof Error ? error.message : String(error),
        error
      );
    }
    const reference = getCpuReference();
    return executionFromProjection(reference, {
      cpuReference: reference,
      webgpuStatus: {
        status: 'webgpu-error-fallback',
        reason: error instanceof Error ? error.message : String(error),
        fallback: 'cpu-reference'
      }
    });
  }
}
