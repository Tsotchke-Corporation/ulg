import {
  SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT,
  SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY,
  ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_PARITY_SCHEMA,
  ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_UPDATE_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  ULG_SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import {
  SEPARATION_BIN_CAPACITY,
  mlsMpmG2pReconstructWgsl,
  mlsMpmParticleSeparationApplyWgsl,
  mlsMpmParticleSeparationBinFillWgsl,
  mlsMpmParticleSeparationComputeWgsl
} from '../../../ulg-gpu-abi/src/wgsl.js';
import {
  mlsMpmG2pReconstructCanonicalSpatialWgsl,
  mlsMpmG2pReconstructCanonicalSpatialUnobservedWgsl,
  mlsMpmParticleSeparationApplyCanonicalSpatialWgsl,
  mlsMpmParticleSeparationApplyCanonicalSpatialUnobservedWgsl,
  mlsMpmParticleSeparationBinFillCanonicalSpatialWgsl,
  mlsMpmParticleSeparationBinFillCanonicalSpatialUnobservedWgsl,
  mlsMpmParticleSeparationComputeCanonicalSpatialWgsl,
  mlsMpmParticleSeparationComputeCanonicalSpatialUnobservedWgsl,
  SCHROEDER_MECHANICS_SPATIAL_AUTHORITY_EVIDENCE_BYTES,
  SCHROEDER_SPATIAL_EPOCH_WITH_MECHANICS_EVIDENCE_BYTES
} from '../../../ulg-gpu-abi/src/schroederMechanicsSpatialAuthorityWgsl.js';
import {
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_SEPARATION_V1
} from '../../../ulg-gpu-abi/src/schroederSpatialExactNear.js';
import { requestOpticalGpuDevice } from '../material/opticalGpuBuffers.js';
import { computeBufferBinding, createCachedExplicitComputePipeline, deferSubmittedWorkCleanup } from '../webgpuComputeLayout.js';
import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
  MLS_MPM_PARTICLE_SEPARATION_RELAXATION_DEFAULT,
  MLS_MPM_PARTICLE_SEPARATION_VELOCITY_DAMPING_DEFAULT,
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
  MLS_MPM_MECHANICS_FIELD_MODE_DISABLED,
  MLS_MPM_MECHANICS_FIELD_MODE_REQUIRED
} from './sphGridGpuKernel.js';
import {
  validateLocallySubmittedSchroederSpatialParentFieldCoarseTerminalGpu,
  validateLocallySubmittedSchroederSpatialParentFieldFineCorrectionGpu,
  validateSchroederCrossLevelRefluxLedgerGpuOwnership
} from './schroederSpatialParentFieldMechanicsWorkspaceGpu.js';
import {
  claimSchroederFusedCoarseTerminalStageProducer,
  claimSchroederFusedFineSubstepStageProducer,
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
  MLS_MPM_PARTICLE_SEPARATION_RELAXATION_DEFAULT,
  MLS_MPM_PARTICLE_SEPARATION_VELOCITY_DAMPING_DEFAULT
};
import { MLS_MPM_GPU_GRID_VELOCITY_FLOATS } from './sphGridUpdateGpuKernel.js';

export {
  ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_PARITY_SCHEMA,
  ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_SCHEMA,
  mlsMpmG2pReconstructWgsl
};

const GPU_BUFFER_USAGE = {
  MAP_READ: globalThis.GPUBufferUsage?.MAP_READ ?? 1,
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64
};

const GPU_MAP_MODE = {
  READ: globalThis.GPUMapMode?.READ ?? 1
};

const DEFAULT_BOX_DIMS_M = Object.freeze([5, 5, 5]);
const G2P_SCOPE = 'mls-mpm-g2p-velocity-affine-deformation-reconstruction';
const FULL_READBACK_MODE = 'full-parity-readback';
const NO_FULL_READBACK_MODE = 'no-full-readback';
const SCHROEDER_LEVEL_ASSIGNMENT_FLOATS = SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT.length;
const EOS_MODEL_IDS = Object.freeze({
  disabled: 0,
  taitCondensed: 1
});
export const MLS_MPM_CONDENSED_VOLUME_STRAIN_TOLERANCE = 5e-2;
const CONDENSED_MIN_VOLUME_RATIO_J = 1 - MLS_MPM_CONDENSED_VOLUME_STRAIN_TOLERANCE;
const CONDENSED_MAX_VOLUME_RATIO_J = 1 + MLS_MPM_CONDENSED_VOLUME_STRAIN_TOLERANCE;
const CONDENSED_MAX_VOLUME_RATIO_CHANGE_PER_STEP = 1.5;
export const MLS_MPM_G2P_MIN_VOLUME_RATIO_J = 0.1;
export const MLS_MPM_G2P_MAX_RADIUS_GROWTH_RATIO = 4;
export const MLS_MPM_G2P_MAX_VOLUME_RATIO_J = MLS_MPM_G2P_MAX_RADIUS_GROWTH_RATIO ** 3;
export const ULG_MLS_MPM_G2P_PARTICLE_SCALE_STABILITY_SCHEMA =
  'peercompute.ulg.mls-mpm-g2p-particle-scale-stability.v0';
const G2P_PARAMS_BYTES = 80;
const G2P_CANONICAL_PARAMS_BYTES = 144;
const SEPARATION_PARAMS_BYTES = 48;
const SEPARATION_BIN_MAX_CELLS = 262144;
const SCHROEDER_SPATIAL_EPOCH_SCHEMA = 'peercompute.ulg.schroeder-spatial-epoch.v1';
const SCHROEDER_SPATIAL_EPOCH_GENERATION_SCHEMA =
  'peercompute.ulg.schroeder-spatial-epoch-generation.v1';
const refluxDummyBuffers = new WeakMap();
const fusedG2pClaims = new WeakMap();
const fusedG2pOrigins = new WeakMap();

function crossLevelRefluxBindingBuffer(device, parentFieldWorkspace) {
  const ledger = parentFieldWorkspace?.refluxLedger ?? null;
  if (ledger) {
    if (
      ledger.schema !== ULG_SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_SCHEMA
      || ![
        'schroeder-cross-level-reflux-ledger-gpu-ready',
        'schroeder-cross-level-reflux-ledger-arena-local'
      ].includes(ledger.status)
      || ledger.buffer !== parentFieldWorkspace.refluxLedgerBuffer
      || !webGpuBufferMatchesDevice(ledger.buffer, device)
      || (
        ledger.status === 'schroeder-cross-level-reflux-ledger-gpu-ready'
        && !validateSchroederCrossLevelRefluxLedgerGpuOwnership(device, ledger, {
          minimumCoarseFieldCapacity: ledger.rowCapacity,
          fineLevel: parentFieldWorkspace.parentFieldView?.fineLevel,
          coarseLevel: parentFieldWorkspace.parentFieldView?.coarseLevel,
          coarseGridSpacingM:
            parentFieldWorkspace.parentFieldView?.coarseFieldView?.gridSpacingM
        })
      )
    ) {
      throw canonicalSpatialExecutionError(
        'cross-level-reflux-ledger-rejected',
        'Required parent-field G2P received an invalid or foreign reflux ledger'
      );
    }
    return ledger.buffer;
  }
  let buffer = refluxDummyBuffers.get(device);
  if (!buffer) {
    buffer = tagWebGpuBufferDevice(device.createBuffer({
      label: 'ulg-mls-mpm-g2p-empty-cross-level-reflux',
      size: 16,
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
    }), device);
    refluxDummyBuffers.set(device, buffer);
  }
  return buffer;
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

function exactArrayMatches(value, snapshot) {
  return Array.isArray(value)
    && value.length === snapshot.length
    && snapshot.every((entry, index) => Object.is(value[index], entry));
}

const SPH_PARTICLE_STATE_STRIDE_BYTES =
  SPH_GPU_PARTICLE_STATE_FLOATS * Float32Array.BYTES_PER_ELEMENT;
const SPH_PARTICLE_THERMO_STRIDE_BYTES =
  SPH_GPU_PARTICLE_THERMO_FLOATS * Float32Array.BYTES_PER_ELEMENT;
const SPH_PARTICLE_IDENTITY_STRIDE_BYTES =
  SPH_GPU_PARTICLE_IDENTITY_UINTS * Uint32Array.BYTES_PER_ELEMENT;
const MLS_MPM_PARTICLE_MECHANICS_STRIDE_BYTES =
  MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS * Float32Array.BYTES_PER_ELEMENT;

function fusedParticleUploadAbiMatches(
  device,
  sphParticleUpload,
  mlsMpmParticleUpload,
  particleCount
) {
  if (!Number.isSafeInteger(particleCount) || particleCount <= 0) return false;
  const expected = {
    state: particleCount * SPH_PARTICLE_STATE_STRIDE_BYTES,
    thermo: particleCount * SPH_PARTICLE_THERMO_STRIDE_BYTES,
    identity: particleCount * SPH_PARTICLE_IDENTITY_STRIDE_BYTES,
    mechanics: particleCount * MLS_MPM_PARTICLE_MECHANICS_STRIDE_BYTES
  };
  const buffers = [
    [sphParticleUpload?.stateBuffer, expected.state],
    [sphParticleUpload?.thermoBuffer, expected.thermo],
    [sphParticleUpload?.identityBuffer, expected.identity],
    [mlsMpmParticleUpload?.mechanicsBuffer, expected.mechanics]
  ];
  return Boolean(
    sphParticleUpload?.particleCount === particleCount
    && mlsMpmParticleUpload?.particleCount === particleCount
    && sphParticleUpload?.stateStrideBytes === SPH_PARTICLE_STATE_STRIDE_BYTES
    && sphParticleUpload?.thermoStrideBytes === SPH_PARTICLE_THERMO_STRIDE_BYTES
    && sphParticleUpload?.identityStrideBytes
      === SPH_PARTICLE_IDENTITY_STRIDE_BYTES
    && mlsMpmParticleUpload?.mechanicsStrideBytes
      === MLS_MPM_PARTICLE_MECHANICS_STRIDE_BYTES
    && sphParticleUpload?.stateBufferByteLength === expected.state
    && sphParticleUpload?.thermoBufferByteLength === expected.thermo
    && sphParticleUpload?.identityBufferByteLength === expected.identity
    && mlsMpmParticleUpload?.mechanicsBufferByteLength === expected.mechanics
    && buffers.every(([buffer, minimumByteLength]) => {
      const size = Number(buffer?.size);
      return buffer
        && buffer.destroyed !== true
        && Number.isFinite(size)
        && size >= minimumByteLength
        && webGpuBufferMatchesDevice(buffer, device);
    })
  );
}

function captureFusedG2pInputSnapshot({
  transaction,
  transactionMode,
  gridUpdate,
  sphParticleUpload,
  mlsMpmParticleUpload,
  schroederSpatialEpochGeneration,
  schroederSelectedLevel,
  dt,
  boxDimsM,
  internalPressureScale,
  liquidWallDampingAlpha,
  liquidWallDampingDistanceM
}) {
  const continuation = transaction.particleContinuation;
  return Object.freeze({
    transaction,
    transactionMode,
    continuation,
    gridUpdate,
    sourceProjection: gridUpdate.sourceProjection,
    previousGridUpdate: gridUpdate.previousGridUpdate,
    fieldExecution: gridUpdate.mechanicsFieldViewExecution,
    fieldBuffer: gridUpdate.mechanicsFieldViewBuffer,
    parentFieldWorkspace: gridUpdate.parentFieldMechanicsWorkspaceExecution,
    gridDt: gridUpdate.dt,
    gridBoxDimsM: Object.freeze([...gridUpdate.boxDimsM]),
    gridSpacingM: gridUpdate.gridSpacingM,
    gridDims: Object.freeze([...gridUpdate.gridDims]),
    gridNodeCount: gridUpdate.gridNodeCount,
    gridShift: gridUpdate.gridShift,
    internalPressureScale: Number(internalPressureScale),
    sourceInternalPressureScale:
      gridUpdate.sourceProjection?.internalPressureScale,
    liquidWallDampingAlpha: Number(liquidWallDampingAlpha),
    liquidWallDampingDistanceM: Number(liquidWallDampingDistanceM),
    schroederSpatialEpochGeneration,
    schroederSelectedLevel,
    dt,
    boxDimsM: Object.freeze([...boxDimsM]),
    sphParticleUpload,
    mlsMpmParticleUpload,
    particleCount: sphParticleUpload.particleCount,
    stateBuffer: sphParticleUpload.stateBuffer,
    thermoBuffer: sphParticleUpload.thermoBuffer,
    identityBuffer: sphParticleUpload.identityBuffer,
    mechanicsBuffer: mlsMpmParticleUpload.mechanicsBuffer,
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
    identityBufferSize: Number(sphParticleUpload.identityBuffer?.size),
    mechanicsBufferSize: Number(mlsMpmParticleUpload.mechanicsBuffer?.size)
  });
}

function fusedG2pInputSnapshotMatches(device, snapshot, current) {
  const {
    transaction,
    transactionMode,
    gridUpdate,
    sphParticleUpload,
    mlsMpmParticleUpload,
    schroederSpatialEpochGeneration,
    schroederSelectedLevel,
    dt,
    boxDimsM,
    internalPressureScale,
    liquidWallDampingAlpha,
    liquidWallDampingDistanceM
  } = current;
  return Boolean(
    snapshot
    && transaction === snapshot.transaction
    && transactionMode === snapshot.transactionMode
    && transaction?.particleContinuation === snapshot.continuation
    && gridUpdate === snapshot.gridUpdate
    && gridUpdate?.sourceProjection === snapshot.sourceProjection
    && gridUpdate?.previousGridUpdate === snapshot.previousGridUpdate
    && gridUpdate?.mechanicsFieldViewExecution === snapshot.fieldExecution
    && gridUpdate?.mechanicsFieldViewBuffer === snapshot.fieldBuffer
    && gridUpdate?.parentFieldMechanicsWorkspaceExecution
      === snapshot.parentFieldWorkspace
    && Object.is(gridUpdate?.dt, snapshot.gridDt)
    && exactArrayMatches(gridUpdate?.boxDimsM, snapshot.gridBoxDimsM)
    && Object.is(gridUpdate?.gridSpacingM, snapshot.gridSpacingM)
    && exactArrayMatches(gridUpdate?.gridDims, snapshot.gridDims)
    && gridUpdate?.gridNodeCount === snapshot.gridNodeCount
    && gridUpdate?.gridShift === snapshot.gridShift
    && Object.is(
      gridUpdate?.sourceProjection?.internalPressureScale,
      snapshot.sourceInternalPressureScale
    )
    && sphParticleUpload === snapshot.sphParticleUpload
    && mlsMpmParticleUpload === snapshot.mlsMpmParticleUpload
    && sphParticleUpload?.stateBuffer === snapshot.stateBuffer
    && sphParticleUpload?.thermoBuffer === snapshot.thermoBuffer
    && sphParticleUpload?.identityBuffer === snapshot.identityBuffer
    && mlsMpmParticleUpload?.mechanicsBuffer === snapshot.mechanicsBuffer
    && sphParticleUpload?.stateStrideBytes === snapshot.stateStrideBytes
    && sphParticleUpload?.thermoStrideBytes === snapshot.thermoStrideBytes
    && sphParticleUpload?.identityStrideBytes === snapshot.identityStrideBytes
    && mlsMpmParticleUpload?.mechanicsStrideBytes
      === snapshot.mechanicsStrideBytes
    && sphParticleUpload?.stateBufferByteLength
      === snapshot.stateBufferByteLength
    && sphParticleUpload?.thermoBufferByteLength
      === snapshot.thermoBufferByteLength
    && sphParticleUpload?.identityBufferByteLength
      === snapshot.identityBufferByteLength
    && mlsMpmParticleUpload?.mechanicsBufferByteLength
      === snapshot.mechanicsBufferByteLength
    && Number(sphParticleUpload?.stateBuffer?.size) === snapshot.stateBufferSize
    && Number(sphParticleUpload?.thermoBuffer?.size) === snapshot.thermoBufferSize
    && Number(sphParticleUpload?.identityBuffer?.size)
      === snapshot.identityBufferSize
    && Number(mlsMpmParticleUpload?.mechanicsBuffer?.size)
      === snapshot.mechanicsBufferSize
    && fusedParticleUploadAbiMatches(
      device,
      sphParticleUpload,
      mlsMpmParticleUpload,
      snapshot.particleCount
    )
    && schroederSpatialEpochGeneration
      === snapshot.schroederSpatialEpochGeneration
    && schroederSelectedLevel === snapshot.schroederSelectedLevel
    && Object.is(dt, snapshot.dt)
    && exactArrayMatches(boxDimsM, snapshot.boxDimsM)
    && Object.is(Number(internalPressureScale), snapshot.internalPressureScale)
    && Object.is(
      Number(liquidWallDampingAlpha),
      snapshot.liquidWallDampingAlpha
    )
    && Object.is(
      Number(liquidWallDampingDistanceM),
      snapshot.liquidWallDampingDistanceM
    )
  );
}

function fusedG2pMatchesOrigin(reconstruction, origin, {
  transaction = null,
  terminalTransaction = null,
  macroAuthority = null,
  microepochAuthority = null,
  particleContinuation = null,
  fieldExecution = null,
  priorArtifact = null,
  proposalMode = null
} = {}) {
  const coarseTerminal = origin?.transactionMode === 'coarse-terminal';
  return Boolean(
    origin
    && (origin.transactionMode === 'fine' || coarseTerminal)
    && origin.destroyed !== true
    && reconstruction === origin.reconstruction
    && reconstruction?.schema === ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_SCHEMA
    && reconstruction?.backend === 'webgpu'
    && reconstruction?.status === 'reconstructed'
    && (coarseTerminal
      ? reconstruction?.fusedCoarseTerminalTransaction === origin.transaction
        && reconstruction?.fusedFineSubstepTransaction == null
        && reconstruction?.terminalMicroepochAuthority
          === origin.microepochAuthority
        && reconstruction?.fineMicroepochAuthority == null
      : reconstruction?.fusedFineSubstepTransaction === origin.transaction
        && reconstruction?.fusedCoarseTerminalTransaction == null
        && reconstruction?.fineMicroepochAuthority === origin.microepochAuthority
        && reconstruction?.terminalMicroepochAuthority == null)
    && reconstruction?.sourceGridUpdate === origin.sourceGridUpdate
    && reconstruction?.sourceParticleContinuation === origin.particleContinuation
    && reconstruction?.proposalMode === origin.proposalMode
    && reconstruction?.mechanicalProposalApplied === false
    && reconstruction?.mechanicsFieldViewExecution === origin.fieldExecution
    && reconstruction?.mechanicsFieldViewBuffer === origin.fieldBuffer
    && reconstruction?.stateBuffer === origin.outputStateBuffer
    && reconstruction?.mechanicsBuffer === origin.outputMechanicsBuffer
    && webGpuBufferMatchesDevice(origin.outputStateBuffer, origin.device)
    && webGpuBufferMatchesDevice(origin.outputMechanicsBuffer, origin.device)
    && origin.outputStateBuffer?.destroyed !== true
    && origin.outputMechanicsBuffer?.destroyed !== true
    && Number(origin.outputStateBuffer?.size) === origin.outputStateBufferSize
    && Number(origin.outputMechanicsBuffer?.size)
      === origin.outputMechanicsBufferSize
    && origin.outputStateBufferSize >= origin.stateBufferByteLength
    && origin.outputMechanicsBufferSize >= origin.mechanicsBufferByteLength
    && reconstruction?.stateBufferByteLength === origin.stateBufferByteLength
    && reconstruction?.mechanicsBufferByteLength
      === origin.mechanicsBufferByteLength
    && reconstruction?.retainedOutputParticleBuffers === true
    && reconstruction?.readbackMode === NO_FULL_READBACK_MODE
    && reconstruction?.fullReadbackPerformed === false
    && reconstruction?.normalHotLoopReadbackFree === true
    && reconstruction?.particleCount === origin.particleCount
    && Object.is(reconstruction?.dt, origin.dt)
    && Object.is(
      reconstruction?.internalPressureScale,
      origin.internalPressureScale
    )
    && Object.is(
      reconstruction?.liquidWallDampingAlpha,
      origin.liquidWallDampingAlpha
    )
    && Object.is(
      reconstruction?.liquidWallDampingDistanceM,
      origin.liquidWallDampingDistanceM
    )
    && reconstruction?.stateStrideFloats === SPH_GPU_PARTICLE_STATE_FLOATS
    && reconstruction?.mechanicsStrideFloats
      === MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS
    && exactArrayMatches(reconstruction?.boxDimsM, origin.boxDimsM)
    && Object.is(reconstruction?.gridSpacingM, origin.gridSpacingM)
    && exactArrayMatches(reconstruction?.gridDims, origin.gridDims)
    && reconstruction?.gridNodeCount === origin.gridNodeCount
    && reconstruction?.gridShift === origin.gridShift
    && reconstruction?.schroederSelectedLevel === origin.selectedLevel
    && reconstruction?.schroederSpatialEpochGeneration
      === origin.canonicalGeneration
    && origin.transaction?.macroAuthority === origin.macroAuthority
    && origin.transaction?.microepochAuthority === origin.microepochAuthority
    && origin.transaction?.particleContinuation === origin.particleContinuation
    && (coarseTerminal
      ? origin.transaction?.coarseFieldView === origin.fieldExecution
      : origin.transaction?.fineFieldView === origin.fieldExecution)
    && origin.transaction?.proposalMode === origin.proposalMode
    && origin.sourceGridUpdate?.mechanicsFieldViewExecution
      === origin.fieldExecution
    && origin.sourceGridUpdate?.mechanicsFieldViewBuffer === origin.fieldBuffer
    && Object.is(origin.sourceGridUpdate?.dt, origin.dt)
    && exactArrayMatches(origin.sourceGridUpdate?.boxDimsM, origin.boxDimsM)
    && Object.is(origin.sourceGridUpdate?.gridSpacingM, origin.gridSpacingM)
    && exactArrayMatches(origin.sourceGridUpdate?.gridDims, origin.gridDims)
    && origin.sourceGridUpdate?.gridNodeCount === origin.gridNodeCount
    && origin.sourceGridUpdate?.gridShift === origin.gridShift
    && Object.is(
      origin.sourceGridUpdate?.sourceProjection?.internalPressureScale,
      origin.internalPressureScale
    )
    && origin.particleContinuation?.sphParticleUpload === origin.sphParticleUpload
    && origin.particleContinuation?.mlsMpmParticleUpload
      === origin.mlsMpmParticleUpload
    && origin.particleContinuation?.stateBuffer === origin.inputStateBuffer
    && origin.particleContinuation?.thermoBuffer === origin.thermoBuffer
    && origin.particleContinuation?.identityBuffer === origin.identityBuffer
    && origin.particleContinuation?.mechanicsBuffer === origin.inputMechanicsBuffer
    && origin.sphParticleUpload?.stateBuffer === origin.inputStateBuffer
    && origin.sphParticleUpload?.thermoBuffer === origin.thermoBuffer
    && origin.sphParticleUpload?.identityBuffer === origin.identityBuffer
    && origin.mlsMpmParticleUpload?.mechanicsBuffer === origin.inputMechanicsBuffer
    && origin.sphParticleUpload?.particleCount === origin.particleCount
    && origin.mlsMpmParticleUpload?.particleCount === origin.particleCount
    && origin.sphParticleUpload?.stateStrideBytes === origin.stateStrideBytes
    && origin.sphParticleUpload?.thermoStrideBytes === origin.thermoStrideBytes
    && origin.sphParticleUpload?.identityStrideBytes
      === origin.identityStrideBytes
    && origin.mlsMpmParticleUpload?.mechanicsStrideBytes
      === origin.mechanicsStrideBytes
    && origin.sphParticleUpload?.stateBufferByteLength
      === origin.inputStateBufferByteLength
    && origin.sphParticleUpload?.thermoBufferByteLength
      === origin.thermoBufferByteLength
    && origin.sphParticleUpload?.identityBufferByteLength
      === origin.identityBufferByteLength
    && origin.mlsMpmParticleUpload?.mechanicsBufferByteLength
      === origin.inputMechanicsBufferByteLength
    && Number(origin.inputStateBuffer?.size) === origin.inputStateBufferSize
    && Number(origin.thermoBuffer?.size) === origin.thermoBufferSize
    && Number(origin.identityBuffer?.size) === origin.identityBufferSize
    && Number(origin.inputMechanicsBuffer?.size)
      === origin.inputMechanicsBufferSize
    && fusedParticleUploadAbiMatches(
      origin.device,
      origin.sphParticleUpload,
      origin.mlsMpmParticleUpload,
      origin.particleCount
    )
    && origin.inputStateBufferByteLength
      === origin.particleCount * origin.stateStrideBytes
    && origin.thermoBufferByteLength
      === origin.particleCount * origin.thermoStrideBytes
    && origin.identityBufferByteLength
      === origin.particleCount * origin.identityStrideBytes
    && origin.inputMechanicsBufferByteLength
      === origin.particleCount * origin.mechanicsStrideBytes
    && origin.stateBufferByteLength
      === origin.particleCount * origin.stateStrideBytes
    && origin.mechanicsBufferByteLength
      === origin.particleCount * origin.mechanicsStrideBytes
    && (coarseTerminal
      ? validateSchroederFusedCoarseTerminalTransaction(
          origin.device,
          origin.transaction,
          {
            macroAuthority: origin.macroAuthority,
            microepochAuthority: origin.microepochAuthority,
            particleContinuation: origin.particleContinuation
          }
        )
      : validateSchroederFusedFineSubstepTransaction(
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
        ordinal: origin.transaction.substepOrdinal,
        sphParticleUpload: origin.sphParticleUpload,
        mlsMpmParticleUpload: origin.mlsMpmParticleUpload,
        stateBuffer: origin.inputStateBuffer,
        thermoBuffer: origin.thermoBuffer,
        identityBuffer: origin.identityBuffer,
        mechanicsBuffer: origin.inputMechanicsBuffer
      }
    )
    && (coarseTerminal
      ? validateLocallySubmittedSchroederSpatialParentFieldCoarseTerminalGpu(
          origin.device,
          origin.sourceGridUpdate,
          {
            terminalTransaction: origin.transaction,
            macroAuthority: origin.macroAuthority,
            microepochAuthority: origin.microepochAuthority,
            particleContinuation: origin.particleContinuation,
            fieldExecution: origin.fieldExecution,
            mutationSegment: origin.transaction.coarseTerminalMutation,
            priorArtifact: origin.sourceGridUpdate.previousGridUpdate,
            requireDeferred: true,
            proposalMode: origin.proposalMode
          }
        )
      : validateLocallySubmittedSchroederSpatialParentFieldFineCorrectionGpu(
          origin.device,
          origin.sourceGridUpdate,
          {
            transaction: origin.transaction,
            macroAuthority: origin.macroAuthority,
            microepochAuthority: origin.microepochAuthority,
            particleContinuation: origin.particleContinuation,
            fieldExecution: origin.fieldExecution,
            mutationSegment: origin.transaction.fineCorrectionMutation,
            priorArtifact: origin.sourceGridUpdate.previousGridUpdate,
            requireDeferred: true,
            proposalMode: origin.proposalMode
          }
        ))
    && (coarseTerminal
      ? transaction == null
        && (terminalTransaction == null
          || terminalTransaction === origin.transaction)
      : terminalTransaction == null
        && (transaction == null || transaction === origin.transaction))
    && (macroAuthority == null || macroAuthority === origin.macroAuthority)
    && (microepochAuthority == null
      || microepochAuthority === origin.microepochAuthority)
    && (particleContinuation == null
      || particleContinuation === origin.particleContinuation)
    && (fieldExecution == null || fieldExecution === origin.fieldExecution)
    && (priorArtifact == null || priorArtifact === origin.sourceGridUpdate)
    && (proposalMode == null || proposalMode === origin.proposalMode)
  );
}

function durableSubmittedFusedG2pOutputMatchesOrigin(
  device,
  reconstruction,
  origin,
  { terminalTransaction = null } = {}
) {
  const receipt = origin?.durableProducerRetirementReceipt;
  return Boolean(
    origin?.deviceId === webGpuDeviceId(device)
    && origin.transactionMode === 'coarse-terminal'
    && origin.destroyed !== true
    && origin.outputStateRetired !== true
    && origin.outputMechanicsRetired !== true
    && receipt?.device === device
    && receipt.deviceId === origin.deviceId
    && receipt.reconstruction === reconstruction
    && receipt.transaction === origin.transaction
    && receipt.transactionMode === origin.transactionMode
    && receipt.sourceGridUpdate === origin.sourceGridUpdate
    && receipt.outputStateBuffer === origin.outputStateBuffer
    && receipt.outputMechanicsBuffer === origin.outputMechanicsBuffer
    && receipt.outputStateBufferSize === origin.outputStateBufferSize
    && receipt.outputMechanicsBufferSize === origin.outputMechanicsBufferSize
    && receipt.stateBufferByteLength === origin.stateBufferByteLength
    && receipt.mechanicsBufferByteLength === origin.mechanicsBufferByteLength
    && receipt.particleCount === origin.particleCount
    && receipt.outputStateBuffer === reconstruction?.stateBuffer
    && receipt.outputMechanicsBuffer === reconstruction?.mechanicsBuffer
    && receipt.outputStateBuffer?.destroyed !== true
    && receipt.outputMechanicsBuffer?.destroyed !== true
    && webGpuBufferMatchesDevice(receipt.outputStateBuffer, device)
    && webGpuBufferMatchesDevice(receipt.outputMechanicsBuffer, device)
    && Number(receipt.outputStateBuffer?.size)
      === receipt.outputStateBufferSize
    && Number(receipt.outputMechanicsBuffer?.size)
      === receipt.outputMechanicsBufferSize
    && receipt.outputStateBufferSize >= receipt.stateBufferByteLength
    && receipt.outputMechanicsBufferSize >= receipt.mechanicsBufferByteLength
    && reconstruction?.schema === ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_SCHEMA
    && reconstruction?.backend === 'webgpu'
    && reconstruction?.status === 'reconstructed'
    && reconstruction?.fusedCoarseTerminalTransaction === receipt.transaction
    && reconstruction?.fusedFineSubstepTransaction == null
    && reconstruction?.stateBufferByteLength === receipt.stateBufferByteLength
    && reconstruction?.mechanicsBufferByteLength
      === receipt.mechanicsBufferByteLength
    && reconstruction?.particleCount === receipt.particleCount
    && reconstruction?.stateStrideFloats === SPH_GPU_PARTICLE_STATE_FLOATS
    && reconstruction?.mechanicsStrideFloats
      === MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS
    && reconstruction?.retainedOutputParticleBuffers === true
    && reconstruction?.readbackMode === NO_FULL_READBACK_MODE
    && reconstruction?.fullReadbackPerformed === false
    && reconstruction?.normalHotLoopReadbackFree === true
    && (terminalTransaction == null
      || terminalTransaction === receipt.transaction)
  );
}

export function validateLocallySubmittedMlsMpmFusedG2p(
  device,
  reconstruction,
  options = {}
) {
  const origin = reconstruction && fusedG2pOrigins.get(reconstruction);
  return origin?.deviceId === webGpuDeviceId(device)
    && fusedG2pMatchesOrigin(reconstruction, origin, options);
}

/** Retire retained state/mechanics outputs independently. */
export function destroyRetainedMlsMpmG2pOutputComponents(
  reconstruction,
  {
    state = false,
    mechanics = false
  } = {}
) {
  const source = reconstruction?.gpuResult || reconstruction;
  if (
    source?.retainedOutputParticleBuffers !== true
    || typeof source.destroyOutputParticleBufferComponents !== 'function'
  ) return false;
  return source.destroyOutputParticleBufferComponents({ state, mechanics });
}

function fusedG2pOutputUploadsMatchOrigin(
  device,
  origin,
  sphParticleUpload,
  mlsMpmParticleUpload
) {
  return Boolean(
    sphParticleUpload?.schema === ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA
    && sphParticleUpload?.status === 'webgpu-uploaded'
    && mlsMpmParticleUpload?.schema
      === ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA
    && mlsMpmParticleUpload?.status === 'webgpu-uploaded'
    && sphParticleUpload?.stateBuffer === origin?.outputStateBuffer
    && sphParticleUpload?.thermoBuffer === origin?.thermoBuffer
    && sphParticleUpload?.identityBuffer === origin?.identityBuffer
    && mlsMpmParticleUpload?.mechanicsBuffer === origin?.outputMechanicsBuffer
    && fusedParticleUploadAbiMatches(
      device,
      sphParticleUpload,
      mlsMpmParticleUpload,
      origin?.particleCount
    )
  );
}

export function claimLocallySubmittedMlsMpmFusedG2pOutputForContinuation(
  device,
  reconstruction,
  {
    nextOrdinal,
    nextSphParticleUpload,
    nextMlsMpmParticleUpload,
    ...options
  } = {}
) {
  const origin = reconstruction && fusedG2pOrigins.get(reconstruction);
  if (
    origin?.deviceId !== webGpuDeviceId(device)
    || origin.transactionMode !== 'fine'
    || origin.outputOwnership !== 'producer'
    || !fusedG2pMatchesOrigin(reconstruction, origin, options)
    || Number(nextOrdinal) !== origin.transaction.substepOrdinal + 1
    || !fusedG2pOutputUploadsMatchOrigin(
      device,
      origin,
      nextSphParticleUpload,
      nextMlsMpmParticleUpload
    )
  ) {
    return false;
  }
  origin.outputOwnership = 'canonical-continuation';
  return true;
}

export function claimLocallySubmittedMlsMpmFusedCoarseTerminalG2pOutput(
  device,
  reconstruction,
  {
    terminalTransaction = null,
    finalSphParticleUpload = null,
    finalMlsMpmParticleUpload = null
  } = {}
) {
  const origin = reconstruction && fusedG2pOrigins.get(reconstruction);
  if (
    origin?.deviceId !== webGpuDeviceId(device)
    || origin.transactionMode !== 'coarse-terminal'
    || origin.transaction !== terminalTransaction
    || origin.outputOwnership !== 'producer'
    || !fusedG2pMatchesOrigin(reconstruction, origin, {
      terminalTransaction,
      macroAuthority: terminalTransaction?.macroAuthority,
      microepochAuthority: terminalTransaction?.microepochAuthority,
      particleContinuation: terminalTransaction?.particleContinuation,
      fieldExecution: terminalTransaction?.coarseFieldView,
      priorArtifact: reconstruction?.sourceGridUpdate,
      proposalMode: 'proposal-deferred-to-post-mechanics'
    })
    || !fusedG2pOutputUploadsMatchOrigin(
      device,
      origin,
      finalSphParticleUpload,
      finalMlsMpmParticleUpload
    )
  ) {
    return false;
  }
  const durableClaimReceipt = Object.freeze({
    reconstruction,
    terminalTransaction,
    sourceGridUpdate: origin.sourceGridUpdate,
    finalSphParticleUpload,
    finalMlsMpmParticleUpload,
    stateBuffer: origin.outputStateBuffer,
    mechanicsBuffer: origin.outputMechanicsBuffer,
    stateBufferSize: origin.outputStateBufferSize,
    mechanicsBufferSize: origin.outputMechanicsBufferSize,
    stateBufferByteLength: origin.stateBufferByteLength,
    mechanicsBufferByteLength: origin.mechanicsBufferByteLength,
    particleCount: origin.particleCount,
    dt: origin.dt,
    selectedLevel: origin.selectedLevel,
    gridSpacingM: origin.gridSpacingM,
    gridNodeCount: origin.gridNodeCount,
    gridShift: origin.gridShift,
    boxDimsM: origin.boxDimsM,
    gridDims: origin.gridDims
  });
  origin.claimedFinalSphParticleUpload = finalSphParticleUpload;
  origin.claimedFinalMlsMpmParticleUpload = finalMlsMpmParticleUpload;
  origin.durableClaimReceipt = durableClaimReceipt;
  origin.outputOwnership = 'coarse-terminal-output';
  return true;
}

export function validateClaimedLocallySubmittedMlsMpmFusedCoarseTerminalG2pOutput(
  device,
  reconstruction,
  {
    terminalTransaction = null,
    finalSphParticleUpload = null,
    finalMlsMpmParticleUpload = null
  } = {}
) {
  const origin = reconstruction && fusedG2pOrigins.get(reconstruction);
  const receipt = origin?.durableClaimReceipt;
  return Boolean(
    origin?.deviceId === webGpuDeviceId(device)
    && origin.transactionMode === 'coarse-terminal'
    && origin.outputOwnership === 'coarse-terminal-output'
    && origin.destroyed !== true
    && receipt?.reconstruction === reconstruction
    && receipt.terminalTransaction === origin.transaction
    && receipt.sourceGridUpdate === origin.sourceGridUpdate
    && receipt.finalSphParticleUpload === origin.claimedFinalSphParticleUpload
    && receipt.finalMlsMpmParticleUpload
      === origin.claimedFinalMlsMpmParticleUpload
    && receipt.stateBuffer === origin.outputStateBuffer
    && receipt.mechanicsBuffer === origin.outputMechanicsBuffer
    && receipt.stateBuffer === reconstruction?.stateBuffer
    && receipt.mechanicsBuffer === reconstruction?.mechanicsBuffer
    && receipt.stateBuffer?.destroyed !== true
    && receipt.mechanicsBuffer?.destroyed !== true
    && Number(receipt.stateBuffer?.size) === receipt.stateBufferSize
    && Number(receipt.mechanicsBuffer?.size) === receipt.mechanicsBufferSize
    && reconstruction?.stateBufferByteLength === receipt.stateBufferByteLength
    && reconstruction?.mechanicsBufferByteLength
      === receipt.mechanicsBufferByteLength
    && reconstruction?.particleCount === receipt.particleCount
    && Object.is(reconstruction?.dt, receipt.dt)
    && reconstruction?.schroederSelectedLevel === receipt.selectedLevel
    && Object.is(reconstruction?.gridSpacingM, receipt.gridSpacingM)
    && reconstruction?.gridNodeCount === receipt.gridNodeCount
    && reconstruction?.gridShift === receipt.gridShift
    && exactArrayMatches(reconstruction?.boxDimsM, receipt.boxDimsM)
    && exactArrayMatches(reconstruction?.gridDims, receipt.gridDims)
    && (terminalTransaction == null
      || terminalTransaction === receipt.terminalTransaction)
    && (finalSphParticleUpload == null
      || finalSphParticleUpload === receipt.finalSphParticleUpload)
    && (finalMlsMpmParticleUpload == null
      || finalMlsMpmParticleUpload === receipt.finalMlsMpmParticleUpload)
  );
}

export function retireLocallySubmittedMlsMpmFusedCoarseTerminalG2pOutputAfter(
  device,
  reconstruction,
  {
    terminalTransaction = null,
    after = null
  } = {}
) {
  const origin = reconstruction && fusedG2pOrigins.get(reconstruction);
  if (
    origin?.deviceId !== webGpuDeviceId(device)
    || origin.transactionMode !== 'coarse-terminal'
    || origin.transaction !== terminalTransaction
    || ![
      'producer',
      'producer-retiring',
      'coarse-terminal-output',
      'coarse-terminal-output-retiring'
    ]
      .includes(origin.outputOwnership)
  ) {
    throw new Error(
      'claimed coarse-terminal G2P output retirement is stale or foreign'
    );
  }
  if (origin.destroyed === true) return Promise.resolve(true);
  if (origin.outputRetirementPromise) return origin.outputRetirementPromise;
  if (!after || typeof after.then !== 'function') {
    throw new TypeError(
      'claimed coarse-terminal G2P output retirement requires an owner fence'
    );
  }
  const producerOwned = ['producer', 'producer-retiring'].includes(
    origin.outputOwnership
  );
  const firstAttempt = !origin.outputOwnership.endsWith('-retiring');
  const exactOutput = producerOwned
    ? durableSubmittedFusedG2pOutputMatchesOrigin(
      device,
      reconstruction,
      origin,
      { terminalTransaction }
    )
    : validateClaimedLocallySubmittedMlsMpmFusedCoarseTerminalG2pOutput(
      device,
      reconstruction,
      { terminalTransaction }
    );
  if (firstAttempt && !exactOutput) {
    throw new Error(
      'coarse-terminal G2P output lost its authenticated producer receipt'
    );
  }
  origin.outputOwnership = producerOwned
    ? 'producer-retiring'
    : 'coarse-terminal-output-retiring';
  origin.outputRetirementFailureReason = null;
  origin.outputRetirementPromise = Promise.resolve(after).then((confirmed) => {
    if (confirmed !== true) {
      throw new Error('coarse-terminal G2P output owner fence was not confirmed');
    }
    const errors = [];
    if (producerOwned) {
      try {
        if (reconstruction.destroyOutputParticleBuffers?.() !== true) {
          throw new Error(
            'coarse-terminal producer did not confirm output destruction'
          );
        }
        origin.outputStateRetired = true;
        origin.outputMechanicsRetired = true;
      } catch (error) {
        errors.push(error);
      }
    } else {
      if (!origin.outputStateRetired) {
        try {
          origin.outputStateBuffer?.destroy?.();
          origin.outputStateRetired = true;
        } catch (error) {
          errors.push(error);
        }
      }
      if (!origin.outputMechanicsRetired) {
        try {
          origin.outputMechanicsBuffer?.destroy?.();
          origin.outputMechanicsRetired = true;
        } catch (error) {
          errors.push(error);
        }
      }
    }
    if (errors.length > 0) {
      throw errors.length === 1
        ? errors[0]
        : new AggregateError(
          errors,
          'coarse-terminal G2P output retirement was incomplete'
        );
    }
    origin.destroyed = true;
    origin.outputOwnership = 'coarse-terminal-output-retired';
    return true;
  }).then(
    (retired) => {
      origin.outputRetirementPromise = null;
      return retired;
    },
    (error) => {
      origin.outputRetirementFailureReason = error instanceof Error
        ? error.message
        : String(error);
      origin.outputRetirementPromise = null;
      throw error;
    }
  );
  return origin.outputRetirementPromise;
}

function registerSubmittedFusedG2p(device, reconstruction, {
  transaction,
  transactionMode,
  sourceGridUpdate,
  sphParticleUpload,
  mlsMpmParticleUpload,
  canonicalGeneration,
  selectedLevel,
  inputStateBuffer,
  thermoBuffer,
  identityBuffer,
  inputMechanicsBuffer,
  outputStateBuffer,
  outputMechanicsBuffer,
  internalPressureScale,
  liquidWallDampingAlpha,
  liquidWallDampingDistanceM
}) {
  const deviceId = webGpuDeviceId(device);
  const durableProducerRetirementReceipt = Object.freeze({
    device,
    deviceId,
    reconstruction,
    transaction,
    transactionMode,
    sourceGridUpdate,
    outputStateBuffer,
    outputMechanicsBuffer,
    outputStateBufferSize: Number(outputStateBuffer?.size),
    outputMechanicsBufferSize: Number(outputMechanicsBuffer?.size),
    stateBufferByteLength: reconstruction.stateBufferByteLength,
    mechanicsBufferByteLength: reconstruction.mechanicsBufferByteLength,
    particleCount: reconstruction.particleCount
  });
  const origin = Object.seal({
    device,
    deviceId,
    reconstruction,
    transaction,
    transactionMode,
    macroAuthority: transaction.macroAuthority,
    microepochAuthority: transaction.microepochAuthority,
    particleContinuation: transaction.particleContinuation,
    proposalMode: 'proposal-deferred-to-post-mechanics',
    sourceGridUpdate,
    fieldExecution: transactionMode === 'coarse-terminal'
      ? transaction.coarseFieldView
      : transaction.fineFieldView,
    fieldBuffer: transactionMode === 'coarse-terminal'
      ? transaction.coarseFieldView.fieldViewBuffer
      : transaction.fineFieldView.fieldViewBuffer,
    sphParticleUpload,
    mlsMpmParticleUpload,
    canonicalGeneration,
    selectedLevel,
    inputStateBuffer,
    thermoBuffer,
    identityBuffer,
    inputMechanicsBuffer,
    outputStateBuffer,
    outputMechanicsBuffer,
    stateStrideBytes:
      SPH_GPU_PARTICLE_STATE_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    thermoStrideBytes:
      SPH_GPU_PARTICLE_THERMO_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    identityStrideBytes:
      SPH_GPU_PARTICLE_IDENTITY_UINTS * Uint32Array.BYTES_PER_ELEMENT,
    mechanicsStrideBytes:
      MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    inputStateBufferByteLength: sphParticleUpload.stateBufferByteLength,
    thermoBufferByteLength: sphParticleUpload.thermoBufferByteLength,
    identityBufferByteLength: sphParticleUpload.identityBufferByteLength,
    inputMechanicsBufferByteLength:
      mlsMpmParticleUpload.mechanicsBufferByteLength,
    inputStateBufferSize: Number(inputStateBuffer?.size),
    thermoBufferSize: Number(thermoBuffer?.size),
    identityBufferSize: Number(identityBuffer?.size),
    inputMechanicsBufferSize: Number(inputMechanicsBuffer?.size),
    outputStateBufferSize: Number(outputStateBuffer?.size),
    outputMechanicsBufferSize: Number(outputMechanicsBuffer?.size),
    stateBufferByteLength: reconstruction.stateBufferByteLength,
    mechanicsBufferByteLength: reconstruction.mechanicsBufferByteLength,
    particleCount: reconstruction.particleCount,
    dt: reconstruction.dt,
    internalPressureScale,
    liquidWallDampingAlpha,
    liquidWallDampingDistanceM,
    boxDimsM: Object.freeze([...reconstruction.boxDimsM]),
    gridSpacingM: reconstruction.gridSpacingM,
    gridDims: Object.freeze([...reconstruction.gridDims]),
    gridNodeCount: reconstruction.gridNodeCount,
    gridShift: reconstruction.gridShift,
    outputOwnership: 'producer',
    claimedFinalSphParticleUpload: null,
    claimedFinalMlsMpmParticleUpload: null,
    durableClaimReceipt: null,
    durableProducerRetirementReceipt,
    outputStateRetired: false,
    outputMechanicsRetired: false,
    outputRetirementPromise: null,
    outputRetirementFailureReason: null,
    destroyed: false
  });
  if (!fusedG2pMatchesOrigin(reconstruction, origin, {
    ...(transactionMode === 'coarse-terminal'
      ? { terminalTransaction: transaction }
      : { transaction }),
    macroAuthority: transaction.macroAuthority,
    microepochAuthority: transaction.microepochAuthority,
    particleContinuation: transaction.particleContinuation,
    fieldExecution: transactionMode === 'coarse-terminal'
      ? transaction.coarseFieldView
      : transaction.fineFieldView,
    priorArtifact: sourceGridUpdate,
    proposalMode: 'proposal-deferred-to-post-mechanics'
  })) {
    throw new TypeError(
      'submitted fused G2P does not match its exact correction and continuation inputs'
    );
  }
  fusedG2pOrigins.set(reconstruction, origin);
  return reconstruction;
}

function fusedG2pInputsAdmitted({
  device,
  transaction,
  transactionMode,
  gridUpdate,
  sphParticleState,
  mlsMpmParticleState,
  sphParticleUpload,
  mlsMpmParticleUpload,
  schroederSpatialEpochGeneration,
  schroederSelectedLevel,
  schroederSpatialMechanicalProposal,
  dt,
  boxDimsM,
  internalPressureScale,
  liquidWallDampingAlpha,
  liquidWallDampingDistanceM,
  mechanicsFieldMode,
  retainOutputParticleBuffers,
  readbackMode,
  canonicalSpatialRequired,
  submissionObserved = false
}) {
  const coarseTerminal = transactionMode === 'coarse-terminal';
  const continuation = transaction?.particleContinuation ?? null;
  const microepoch = transaction?.microepochAuthority ?? null;
  const fieldExecution = coarseTerminal
    ? transaction?.coarseFieldView ?? null
    : transaction?.fineFieldView ?? null;
  const publicationLock = coarseTerminal
    ? transaction?.coarsePublicationLock ?? null
    : transaction?.publicationLock ?? null;
  return Boolean(
    transaction
    && gridUpdate
    && (transactionMode === 'fine' || coarseTerminal)
    && microepoch?.generation === schroederSpatialEpochGeneration
    && microepoch?.canonicalEpoch?.generation === schroederSpatialEpochGeneration
    && (coarseTerminal
      ? microepoch?.parentFieldView?.coarseFieldView === fieldExecution
      : microepoch?.fineFieldView === fieldExecution
        && microepoch?.publicationLock === publicationLock)
    && schroederSelectedLevel === (coarseTerminal
      ? transaction.macroAuthority?.coarseLevel
      : transaction.macroAuthority?.fineLevel)
    && schroederSpatialMechanicalProposal == null
    && canonicalSpatialRequired === true
    && mechanicsFieldMode === MLS_MPM_MECHANICS_FIELD_MODE_REQUIRED
    && retainOutputParticleBuffers === true
    && readbackMode === NO_FULL_READBACK_MODE
    && Object.is(Number(dt), coarseTerminal
      ? transaction.macroAuthority?.macroDt
      : transaction.macroAuthority?.fineDt)
    && exactArrayMatches(boxDimsM, gridUpdate.boxDimsM)
    && Object.is(
      Number(internalPressureScale),
      gridUpdate.sourceProjection?.internalPressureScale
    )
    && Object.is(Number(liquidWallDampingAlpha), 0)
    && Object.is(Number(liquidWallDampingDistanceM), 0)
    && sphParticleState?.particleCount === continuation?.sphParticleUpload?.particleCount
    && mlsMpmParticleState?.particleCount
      === continuation?.mlsMpmParticleUpload?.particleCount
    && sphParticleState?.particleCount === mlsMpmParticleState?.particleCount
    && (sphParticleState?.stateStrideBytes == null
      || sphParticleState.stateStrideBytes
        === SPH_GPU_PARTICLE_STATE_FLOATS * Float32Array.BYTES_PER_ELEMENT)
    && (mlsMpmParticleState?.mechanicsStrideBytes == null
      || mlsMpmParticleState.mechanicsStrideBytes
        === MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS * Float32Array.BYTES_PER_ELEMENT)
    && sphParticleUpload === continuation?.sphParticleUpload
    && mlsMpmParticleUpload === continuation?.mlsMpmParticleUpload
    && fusedParticleUploadAbiMatches(
      device,
      sphParticleUpload,
      mlsMpmParticleUpload,
      sphParticleState?.particleCount
    )
    && sphParticleUpload?.schema === ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA
    && mlsMpmParticleUpload?.schema
      === ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA
    && sphParticleUpload?.stateStrideBytes
      === SPH_GPU_PARTICLE_STATE_FLOATS * Float32Array.BYTES_PER_ELEMENT
    && sphParticleUpload?.thermoStrideBytes
      === SPH_GPU_PARTICLE_THERMO_FLOATS * Float32Array.BYTES_PER_ELEMENT
    && mlsMpmParticleUpload?.mechanicsStrideBytes
      === MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS * Float32Array.BYTES_PER_ELEMENT
    && sphParticleUpload?.stateBufferByteLength
      === sphParticleUpload.particleCount
        * SPH_GPU_PARTICLE_STATE_FLOATS * Float32Array.BYTES_PER_ELEMENT
    && sphParticleUpload?.thermoBufferByteLength
      === sphParticleUpload.particleCount
        * SPH_GPU_PARTICLE_THERMO_FLOATS * Float32Array.BYTES_PER_ELEMENT
    && mlsMpmParticleUpload?.mechanicsBufferByteLength
      === mlsMpmParticleUpload.particleCount
        * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS * Float32Array.BYTES_PER_ELEMENT
    && sphParticleUpload?.stateBuffer === continuation?.stateBuffer
    && sphParticleUpload?.thermoBuffer === continuation?.thermoBuffer
    && sphParticleUpload?.identityBuffer === continuation?.identityBuffer
    && mlsMpmParticleUpload?.mechanicsBuffer === continuation?.mechanicsBuffer
    && webGpuBufferMatchesDevice(continuation?.stateBuffer, device)
    && webGpuBufferMatchesDevice(continuation?.thermoBuffer, device)
    && webGpuBufferMatchesDevice(continuation?.mechanicsBuffer, device)
    && Number(continuation?.stateBuffer?.size ?? 0)
      >= continuation.sphParticleUpload.particleCount
        * SPH_GPU_PARTICLE_STATE_FLOATS * Float32Array.BYTES_PER_ELEMENT
    && Number(continuation?.mechanicsBuffer?.size ?? 0)
      >= continuation.mlsMpmParticleUpload.particleCount
        * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS * Float32Array.BYTES_PER_ELEMENT
    && (continuation?.identityBuffer == null
      || webGpuBufferMatchesDevice(continuation.identityBuffer, device))
    && fieldExecution?.ownerRuntime?.isStatePublicationLockActive?.(
      fieldExecution,
      publicationLock
    ) === true
    && (coarseTerminal
      ? validateSchroederFusedCoarseTerminalTransaction(device, transaction, {
          stage: submissionObserved ? null : 'g2p',
          macroAuthority: transaction.macroAuthority,
          microepochAuthority: transaction.microepochAuthority,
          particleContinuation: continuation,
          artifact: submissionObserved ? null : gridUpdate
        })
      : validateSchroederFusedFineSubstepTransaction(device, transaction, {
          stage: submissionObserved ? null : 'g2p',
          macroAuthority: transaction.macroAuthority,
          microepochAuthority: transaction.microepochAuthority,
          particleContinuation: continuation,
          artifact: submissionObserved ? null : gridUpdate
        }))
    && validateSchroederCanonicalParticleContinuation(
      device,
      continuation,
      {
        macroAuthority: transaction.macroAuthority,
        ordinal: transaction.substepOrdinal,
        sphParticleUpload,
        mlsMpmParticleUpload,
        stateBuffer: continuation.stateBuffer,
        thermoBuffer: continuation.thermoBuffer,
        identityBuffer: continuation.identityBuffer,
        mechanicsBuffer: continuation.mechanicsBuffer
      }
    )
    && (coarseTerminal
      ? validateLocallySubmittedSchroederSpatialParentFieldCoarseTerminalGpu(
          device,
          gridUpdate,
          {
            terminalTransaction: transaction,
            macroAuthority: transaction.macroAuthority,
            microepochAuthority: transaction.microepochAuthority,
            particleContinuation: continuation,
            fieldExecution,
            mutationSegment: transaction.coarseTerminalMutation,
            priorArtifact: gridUpdate.previousGridUpdate,
            requireDeferred: true,
            proposalMode: 'proposal-deferred-to-post-mechanics'
          }
        )
      : validateLocallySubmittedSchroederSpatialParentFieldFineCorrectionGpu(
          device,
          gridUpdate,
          {
            transaction,
            macroAuthority: transaction.macroAuthority,
            microepochAuthority: transaction.microepochAuthority,
            particleContinuation: continuation,
            fieldExecution,
            mutationSegment: transaction.fineCorrectionMutation,
            priorArtifact: gridUpdate.previousGridUpdate,
            requireDeferred: true,
            proposalMode: 'proposal-deferred-to-post-mechanics'
          }
        ))
  );
}

function particleWallClearanceM(restVolumeM3, boxDimsM = DEFAULT_BOX_DIMS_M, gridSpacingM = 0) {
  const volume = finiteNumber(restVolumeM3, 0);
  if (!(volume > 0)) return 0;
  const minDim = Math.min(...boxDimsM.filter((value) => value > 0));
  let clearance = 0.5 * Math.cbrt(volume);
  // Half-cell cap: matches g2p_particle_wall_clearance in the WGSL — a
  // clearance beyond half a grid cell is a phantom forbidden shell that
  // pinned low-density (gas) particles far from the walls.
  const spacing = finiteNumber(gridSpacingM, 0);
  if (spacing > 0) clearance = Math.min(clearance, 0.5 * spacing);
  return Number.isFinite(minDim) && minDim > 0
    ? Math.min(clearance, 0.49 * minDim)
    : clearance;
}

function assertInputs({ sphParticleState, mlsMpmParticleState, gridUpdate, requireUpdatedGridNodes = true }) {
  if (sphParticleState?.schema !== ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA) {
    throw new TypeError('MLS-MPM G2P requires a packed SPH GPU particle buffer');
  }
  if (mlsMpmParticleState?.schema !== ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA) {
    throw new TypeError('MLS-MPM G2P requires a packed MLS-MPM GPU particle buffer');
  }
  if (sphParticleState.particleCount !== mlsMpmParticleState.particleCount) {
    throw new RangeError('SPH and MLS-MPM particle counts must match');
  }
  if (
    gridUpdate?.schema !== ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA
    && gridUpdate?.schema !== ULG_MLS_MPM_GPU_GRID_UPDATE_EXECUTION_SCHEMA
    && gridUpdate?.updateSchema !== ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA
  ) {
    throw new TypeError('MLS-MPM G2P requires a grid update artifact');
  }
  if (requireUpdatedGridNodes && !(gridUpdate.updatedGridNodes instanceof Float32Array)) {
    throw new TypeError('MLS-MPM G2P requires Float32Array updatedGridNodes');
  }
}

function quadraticWeights(fx) {
  const a = 1.5 - fx;
  const b = fx - 1;
  const c = fx - 0.5;
  return [0.5 * a * a, 0.75 - b * b, 0.5 * c * c];
}

function det3(F) {
  return F[0] * (F[4] * F[8] - F[5] * F[7])
    - F[1] * (F[3] * F[8] - F[5] * F[6])
    + F[2] * (F[3] * F[7] - F[4] * F[6]);
}

function multiplyGradF(F, C, dt) {
  const grad = [
    1 + dt * C[0], dt * C[1], dt * C[2],
    dt * C[3], 1 + dt * C[4], dt * C[5],
    dt * C[6], dt * C[7], 1 + dt * C[8]
  ];
  return [
    grad[0] * F[0] + grad[1] * F[3] + grad[2] * F[6],
    grad[0] * F[1] + grad[1] * F[4] + grad[2] * F[7],
    grad[0] * F[2] + grad[1] * F[5] + grad[2] * F[8],
    grad[3] * F[0] + grad[4] * F[3] + grad[5] * F[6],
    grad[3] * F[1] + grad[4] * F[4] + grad[5] * F[7],
    grad[3] * F[2] + grad[4] * F[5] + grad[5] * F[8],
    grad[6] * F[0] + grad[7] * F[3] + grad[8] * F[6],
    grad[6] * F[1] + grad[7] * F[4] + grad[8] * F[7],
    grad[6] * F[2] + grad[7] * F[5] + grad[8] * F[8]
  ];
}

function isotropicF(volumeRatioJ) {
  const s = Math.cbrt(Math.max(volumeRatioJ, 1e-12));
  return [s, 0, 0, 0, s, 0, 0, 0, s];
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function condensedTargetVolumeRatioJ(rawNextJ, previousJ) {
  const previousBounded = clamp(
    finiteNumber(previousJ, 1),
    CONDENSED_MIN_VOLUME_RATIO_J,
    CONDENSED_MAX_VOLUME_RATIO_J
  );
  const lower = Math.max(
    CONDENSED_MIN_VOLUME_RATIO_J,
    previousBounded / CONDENSED_MAX_VOLUME_RATIO_CHANGE_PER_STEP
  );
  const upper = Math.min(
    CONDENSED_MAX_VOLUME_RATIO_J,
    previousBounded * CONDENSED_MAX_VOLUME_RATIO_CHANGE_PER_STEP
  );
  return clamp(finiteNumber(rawNextJ, previousBounded), lower, upper);
}

function isCondensedMechanicsRow(mechanics, mechanicsOffset) {
  const solidFlag = mechanics[mechanicsOffset + 20];
  const eosModelId = Math.round(mechanics[mechanicsOffset + 26]);
  return solidFlag > 0.5 || eosModelId === EOS_MODEL_IDS.taitCondensed;
}

// 0 = excluded (gas/EOS-disabled), 1 = liquid, 2 = solid. Mirrors
// separation_phase_class in mlsMpmParticleSeparationComputeWgsl.
function separationPhaseClass(mechanics, mechanicsOffset) {
  if (mechanics[mechanicsOffset + 20] > 0.5) return 2;
  const eosModelId = mechanics[mechanicsOffset + 26];
  if (eosModelId > 0.5 && eosModelId < 1.5) return 1;
  return 0;
}

/**
 * Excluded-volume particle separation (CPU mirror of the WGSL pass).
 * MLS-MPM J is reconstructed from the grid velocity gradient, so two
 * particles inside one grid cell sample the same velocity field and their
 * overlap never registers as compression. This pass projects pair overlap
 * out at the particle level: pair rest distance derives from each particle's
 * rest volume (cbrt(V0)), corrections are inverse-mass weighted and
 * symmetric (momentum/COM conserving). Optional pair-normal velocity damping
 * is independent of the position projection. Solid-solid pairs are skipped (the elastic
 * constitutive law owns intra-lattice repulsion); gas is skipped (gas EOS
 * owns compressibility). Mutates state in place.
 */
export function applyMlsMpmParticleSeparationCpu({
  state,
  mechanics,
  particleCount,
  boxDimsM = DEFAULT_BOX_DIMS_M,
  relaxation = MLS_MPM_PARTICLE_SEPARATION_RELAXATION_DEFAULT,
  normalVelocityDamping = MLS_MPM_PARTICLE_SEPARATION_VELOCITY_DAMPING_DEFAULT,
  gridSpacingM = 0
} = {}) {
  const alpha = Math.max(finiteNumber(relaxation, 0), 0);
  const beta = clamp(finiteNumber(normalVelocityDamping, 0), 0, 1);
  if (!(alpha > 0 || beta > 0) || !(particleCount > 1)) return { correctedCount: 0 };
  const dims = finiteVector3(boxDimsM, DEFAULT_BOX_DIMS_M);
  const corrections = new Float64Array(particleCount * 6);
  const stateStride = SPH_GPU_PARTICLE_STATE_FLOATS;
  const mechanicsStride = MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS;
  let correctedCount = 0;
  for (let i = 0; i < particleCount; i += 1) {
    const iState = i * stateStride;
    const iMech = i * mechanicsStride;
    const phaseClass = separationPhaseClass(mechanics, iMech);
    if (phaseClass === 0) continue;
    const massI = state[iState + 3];
    if (!(massI > 0)) continue;
    const restVolumeI = Math.max(mechanics[iMech + 19], 0);
    if (!(restVolumeI > 0)) continue;
    const dSelf = Math.cbrt(Math.max(restVolumeI, 1e-18));
    const wSelf = 1 / Math.max(massI, 1e-30);
    let dxX = 0; let dxY = 0; let dxZ = 0;
    let dvX = 0; let dvY = 0; let dvZ = 0;
    for (let other = 0; other < particleCount; other += 1) {
      if (other === i) continue;
      const oState = other * stateStride;
      const massOther = state[oState + 3];
      if (!(massOther > 0)) continue;
      const oMech = other * mechanicsStride;
      const otherClass = separationPhaseClass(mechanics, oMech);
      if (otherClass === 0) continue;
      if (phaseClass === 2 && otherClass === 2) continue;
      const restVolumeOther = Math.max(mechanics[oMech + 19], 0);
      if (!(restVolumeOther > 0)) continue;
      const pairRestDistance = 0.5 * (dSelf + Math.cbrt(Math.max(restVolumeOther, 1e-18)));
      const deltaX = state[iState] - state[oState];
      const deltaY = state[iState + 1] - state[oState + 1];
      const deltaZ = state[iState + 2] - state[oState + 2];
      let dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ);
      if (dist >= pairRestDistance) continue;
      let nX = 0; let nY = 1; let nZ = 0;
      if (dist > 1e-9) {
        nX = deltaX / dist; nY = deltaY / dist; nZ = deltaZ / dist;
      } else {
        nY = i > other ? 1 : -1;
        dist = 0;
      }
      const wOther = 1 / Math.max(massOther, 1e-30);
      const share = wSelf / (wSelf + wOther);
      const push = alpha * share * (pairRestDistance - dist);
      dxX += push * nX; dxY += push * nY; dxZ += push * nZ;
      const approach = (state[iState + 4] - state[oState + 4]) * nX
        + (state[iState + 5] - state[oState + 5]) * nY
        + (state[iState + 6] - state[oState + 6]) * nZ;
      if (approach < 0) {
        const impulse = -beta * share * approach;
        dvX += impulse * nX; dvY += impulse * nY; dvZ += impulse * nZ;
      }
    }
    const dxLen = Math.sqrt(dxX * dxX + dxY * dxY + dxZ * dxZ);
    const maxStep = 0.5 * dSelf;
    if (dxLen > maxStep) {
      const scale = maxStep / dxLen;
      dxX *= scale; dxY *= scale; dxZ *= scale;
    }
    if (dxLen > 0 || dvX !== 0 || dvY !== 0 || dvZ !== 0) {
      const base = i * 6;
      corrections[base] = dxX; corrections[base + 1] = dxY; corrections[base + 2] = dxZ;
      corrections[base + 3] = dvX; corrections[base + 4] = dvY; corrections[base + 5] = dvZ;
      correctedCount += 1;
    }
  }
  if (correctedCount === 0) return { correctedCount };
  for (let i = 0; i < particleCount; i += 1) {
    const base = i * 6;
    if (corrections[base] === 0 && corrections[base + 1] === 0 && corrections[base + 2] === 0
      && corrections[base + 3] === 0 && corrections[base + 4] === 0 && corrections[base + 5] === 0) continue;
    const iState = i * stateStride;
    const iMech = i * mechanicsStride;
    const position = [
      state[iState] + corrections[base],
      state[iState + 1] + corrections[base + 1],
      state[iState + 2] + corrections[base + 2]
    ];
    const velocity = [
      state[iState + 4] + corrections[base + 3],
      state[iState + 5] + corrections[base + 4],
      state[iState + 6] + corrections[base + 5]
    ];
    const wallClearance = particleWallClearanceM(mechanics[iMech + 19], dims, gridSpacingM);
    for (let axis = 0; axis < 3; axis += 1) {
      const lower = wallClearance;
      const upper = Math.max(lower, dims[axis] - wallClearance);
      if (position[axis] < lower) {
        position[axis] = lower;
        if (velocity[axis] < 0) velocity[axis] = 0;
      } else if (position[axis] > upper) {
        position[axis] = upper;
        if (velocity[axis] > 0) velocity[axis] = 0;
      }
    }
    state[iState] = position[0];
    state[iState + 1] = position[1];
    state[iState + 2] = position[2];
    state[iState + 4] = velocity[0];
    state[iState + 5] = velocity[1];
    state[iState + 6] = velocity[2];
  }
  return { correctedCount };
}

function stabilizeCondensedF(nextF, rawNextJ, previousJ, solid) {
  const targetJ = condensedTargetVolumeRatioJ(rawNextJ, previousJ);
  if (!solid) {
    return {
      nextF: isotropicF(targetJ),
      nextJ: targetJ
    };
  }
  if (!(rawNextJ > 1e-12)) {
    return {
      nextF: isotropicF(targetJ),
      nextJ: targetJ
    };
  }
  const scale = Math.cbrt(targetJ / rawNextJ);
  return {
    nextF: nextF.map((value) => value * scale),
    nextJ: targetJ
  };
}

function stabilizeGeneralParticleScaleF(nextF, rawNextJ) {
  const numericJ = Number(rawNextJ);
  const finiteRawJ = Number.isFinite(numericJ);
  const finiteF = Array.isArray(nextF)
    && nextF.length === 9
    && nextF.every((value) => Number.isFinite(Number(value)));
  if (!finiteF || !finiteRawJ) {
    const targetJ = clamp(finiteNumber(rawNextJ, 1), MLS_MPM_G2P_MIN_VOLUME_RATIO_J, MLS_MPM_G2P_MAX_VOLUME_RATIO_J);
    return {
      nextF: isotropicF(targetJ),
      nextJ: targetJ,
      capped: true,
      invalid: true,
      rawVolumeRatioJ: finiteRawJ ? numericJ : null,
      reason: 'non-finite-deformation'
    };
  }
  if (numericJ < MLS_MPM_G2P_MIN_VOLUME_RATIO_J) {
    return {
      nextF: isotropicF(MLS_MPM_G2P_MIN_VOLUME_RATIO_J),
      nextJ: MLS_MPM_G2P_MIN_VOLUME_RATIO_J,
      capped: true,
      invalid: false,
      rawVolumeRatioJ: numericJ,
      reason: 'below-min-volume-ratio'
    };
  }
  if (numericJ > MLS_MPM_G2P_MAX_VOLUME_RATIO_J) {
    const scale = Math.cbrt(MLS_MPM_G2P_MAX_VOLUME_RATIO_J / Math.max(numericJ, 1e-12));
    const scaledF = nextF.map((value) => value * scale);
    if (scaledF.every((value) => Number.isFinite(value))) {
      return {
        nextF: scaledF,
        nextJ: MLS_MPM_G2P_MAX_VOLUME_RATIO_J,
        capped: true,
        invalid: false,
        rawVolumeRatioJ: numericJ,
        reason: 'above-max-volume-ratio'
      };
    }
    return {
      nextF: isotropicF(MLS_MPM_G2P_MAX_VOLUME_RATIO_J),
      nextJ: MLS_MPM_G2P_MAX_VOLUME_RATIO_J,
      capped: true,
      invalid: true,
      rawVolumeRatioJ: numericJ,
      reason: 'above-max-volume-ratio-non-finite-scale'
    };
  }
  return {
    nextF,
    nextJ: numericJ,
    capped: false,
    invalid: false,
    rawVolumeRatioJ: numericJ,
    reason: null
  };
}

function summarizeG2pParticleScaleStability({
  backend,
  particleCount,
  mechanics,
  capCount = null,
  invalidCount = null,
  maxRawVolumeRatioJ = null,
  cappedSamples = [],
  source = null
} = {}) {
  const count = Math.max(0, Math.round(finiteNumber(particleCount, 0)));
  const stride = MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS;
  const hasMechanics = mechanics instanceof Float32Array && mechanics.length >= count * stride;
  let minEffectiveVolumeRatioJ = Number.POSITIVE_INFINITY;
  let maxEffectiveVolumeRatioJ = 0;
  let effectiveFiniteCount = 0;
  if (hasMechanics) {
    for (let index = 0; index < count; index += 1) {
      const j = Number(mechanics[index * stride + 18]);
      if (!Number.isFinite(j)) continue;
      effectiveFiniteCount += 1;
      minEffectiveVolumeRatioJ = Math.min(minEffectiveVolumeRatioJ, j);
      maxEffectiveVolumeRatioJ = Math.max(maxEffectiveVolumeRatioJ, j);
    }
  }
  const knownCapCount = Number.isFinite(Number(capCount)) ? Math.max(0, Math.round(Number(capCount))) : null;
  const knownInvalidCount = Number.isFinite(Number(invalidCount)) ? Math.max(0, Math.round(Number(invalidCount))) : null;
  const policySource = source || (backend === 'webgpu'
    ? 'webgpu-g2p-shader'
    : 'cpu-reference-g2p-deformation-update');
  const status = knownCapCount > 0
    ? 'particle-scale-cap-applied'
    : (hasMechanics
        ? 'particle-scale-bounded'
        : 'gpu-g2p-cap-policy-applied-in-shader');
  return {
    schema: ULG_MLS_MPM_G2P_PARTICLE_SCALE_STABILITY_SCHEMA,
    status,
    source: policySource,
    particleCount: count,
    mechanicsStrideFloats: stride,
    mechanicsVolumeRatioJOffset: 18,
    minVolumeRatioJAllowed: MLS_MPM_G2P_MIN_VOLUME_RATIO_J,
    maxRadiusGrowthRatioAllowed: MLS_MPM_G2P_MAX_RADIUS_GROWTH_RATIO,
    maxVolumeRatioJAllowed: MLS_MPM_G2P_MAX_VOLUME_RATIO_J,
    policyAppliedInG2p: true,
    policyAppliedInShader: backend === 'webgpu',
    capCountKnown: knownCapCount != null,
    capCount: knownCapCount,
    invalidCountKnown: knownInvalidCount != null,
    invalidCount: knownInvalidCount,
    effectiveFiniteCount,
    minEffectiveVolumeRatioJ: effectiveFiniteCount > 0 ? minEffectiveVolumeRatioJ : null,
    maxEffectiveVolumeRatioJ: effectiveFiniteCount > 0 ? maxEffectiveVolumeRatioJ : null,
    maxRawVolumeRatioJ: Number.isFinite(Number(maxRawVolumeRatioJ))
      ? Number(maxRawVolumeRatioJ)
      : (effectiveFiniteCount > 0 ? maxEffectiveVolumeRatioJ : null),
    cappedSamples: cappedSamples.slice(0, 8)
  };
}

function gridIndex(gridUpdate, i, j, k) {
  const [, gny, gnz] = gridUpdate.gridDims;
  return ((i + gridUpdate.gridShift) * gny + (j + gridUpdate.gridShift)) * gnz + (k + gridUpdate.gridShift);
}

function inRange(gridUpdate, i, j, k) {
  const [gnx, gny, gnz] = gridUpdate.gridDims;
  return i + gridUpdate.gridShift >= 0 && i + gridUpdate.gridShift < gnx
    && j + gridUpdate.gridShift >= 0 && j + gridUpdate.gridShift < gny
    && k + gridUpdate.gridShift >= 0 && k + gridUpdate.gridShift < gnz;
}

function outputEnvelope({
  backend,
  sphParticleState,
  mlsMpmParticleState,
  gridUpdate,
  state,
  mechanics,
  dt,
  boxDimsM,
  internalPressureScale = 1,
  readbackMode = FULL_READBACK_MODE,
  particleScaleStability = null,
  schroederSpatialAuthority = null,
  schroederLevelFilter = null,
  separationCanonicalSpatialAuthorityGate = false
}) {
  const noFullReadback = readbackMode === NO_FULL_READBACK_MODE;
  const particleScaleStabilitySummary = particleScaleStability || summarizeG2pParticleScaleStability({
    backend,
    particleCount: sphParticleState?.particleCount ?? 0,
    mechanics,
    source: backend === 'webgpu' ? 'webgpu-g2p-shader' : 'cpu-reference-g2p-deformation-update'
  });
  return {
    schema: ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_SCHEMA,
    backend,
    status: 'reconstructed',
    kernelScope: G2P_SCOPE,
    sourceSchemas: {
      sphParticleState: sphParticleState.schema,
      mlsMpmParticleState: mlsMpmParticleState.schema,
      gridUpdate: gridUpdate.schema
    },
    particleCount: sphParticleState.particleCount,
    gridNodeCount: gridUpdate.gridNodeCount,
    gridSpacingM: gridUpdate.gridSpacingM,
    gridDims: [...gridUpdate.gridDims],
    gridShift: gridUpdate.gridShift,
    dt,
    boxDimsM: [...boxDimsM],
    internalPressureScale,
    stateStrideFloats: SPH_GPU_PARTICLE_STATE_FLOATS,
    thermoStrideFloats: SPH_GPU_PARTICLE_THERMO_FLOATS,
    mechanicsStrideFloats: MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
    state,
    mechanics,
    readbackMode,
    fullReadbackPerformed: !noFullReadback,
    normalHotLoopReadbackFree: noFullReadback,
    particleScaleStability: particleScaleStabilitySummary,
    particleScaleStabilitySchema: particleScaleStabilitySummary.schema,
    particleScaleStabilityStatus: particleScaleStabilitySummary.status,
    particleScalePolicyAppliedInG2p: particleScaleStabilitySummary.policyAppliedInG2p === true,
    particleScaleMaxVolumeRatioJAllowed: particleScaleStabilitySummary.maxVolumeRatioJAllowed,
    particleScaleMaxRadiusGrowthRatioAllowed: particleScaleStabilitySummary.maxRadiusGrowthRatioAllowed,
    schroederSpatialAuthority: schroederSpatialAuthority
      ? { ...schroederSpatialAuthority }
      : null,
    schroederSpatialAuthorityEnabled: schroederSpatialAuthority?.enabled === true,
    schroederSpatialAuthorityStatus: schroederSpatialAuthority?.status ?? null,
    schroederLevelFilter: schroederLevelFilter ? { ...schroederLevelFilter } : null,
    schroederAuthorityBindingMode:
      schroederLevelFilter?.authorityBindingMode ?? 'precanonical-unfiltered',
    oldLevelAssignmentLookupRemoved:
      schroederLevelFilter?.oldLevelAssignmentLookupRemoved === true,
    separationCanonicalSpatialAuthorityGate:
      separationCanonicalSpatialAuthorityGate === true,
    mechanicsFieldMode:
      gridUpdate.mechanicsFieldMode ?? MLS_MPM_MECHANICS_FIELD_MODE_DISABLED,
    mechanicsFieldViewEnabled:
      gridUpdate.mechanicsFieldViewEnabled === true,
    mechanicsFieldViewExecution:
      gridUpdate.mechanicsFieldViewExecution ?? null,
    mechanicsFieldViewBuffer:
      gridUpdate.mechanicsFieldViewBuffer ?? null,
    mechanicsFieldViewByteLength:
      gridUpdate.mechanicsFieldViewByteLength ?? 0,
    mechanicsFieldViewOwned: false,
    gridStateAuthority:
      gridUpdate.gridStateAuthority ?? 'dense-mls-mpm-grid-state',
    denseGridAuthoritative:
      gridUpdate.denseGridAuthoritative !== false,
    p2gProjectionValidation: false,
    stressProjectionValidation: false,
    gridUpdateValidation: false,
    g2pValidation: false,
    gridValidation: false,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

export function reconstructMlsMpmG2pCpu({
  sphParticleState,
  mlsMpmParticleState,
  gridUpdate,
  dt = gridUpdate?.dt ?? mlsMpmParticleState?.mechanicsDtS ?? 0,
  boxDimsM = DEFAULT_BOX_DIMS_M,
  internalPressureScale = 1,
  liquidWallDampingAlpha = mlsMpmParticleState?.liquidWallDampingAlpha ?? 0,
  liquidWallDampingDistanceM = mlsMpmParticleState?.liquidWallDampingDistanceM ?? 0,
  particleSeparationRelaxation = mlsMpmParticleState?.particleSeparationRelaxation
    ?? MLS_MPM_PARTICLE_SEPARATION_RELAXATION_DEFAULT,
  particleSeparationVelocityDamping = mlsMpmParticleState?.particleSeparationVelocityDamping
    ?? MLS_MPM_PARTICLE_SEPARATION_VELOCITY_DAMPING_DEFAULT
} = {}) {
  assertInputs({ sphParticleState, mlsMpmParticleState, gridUpdate });
  const dtSeconds = finiteNumber(dt, 0);
  const dims = finiteVector3(boxDimsM, DEFAULT_BOX_DIMS_M);
  const invDx = 1 / gridUpdate.gridSpacingM;
  const state = new Float32Array(sphParticleState.state);
  const mechanics = new Float32Array(mlsMpmParticleState.mechanics);
  let particleScaleCapCount = 0;
  let particleScaleInvalidCount = 0;
  let maxRawVolumeRatioJ = 0;
  const cappedSamples = [];

  for (let particleIndex = 0; particleIndex < sphParticleState.particleCount; particleIndex += 1) {
    const stateOffset = particleIndex * SPH_GPU_PARTICLE_STATE_FLOATS;
    const mechanicsOffset = particleIndex * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS;
    const position0 = [state[stateOffset], state[stateOffset + 1], state[stateOffset + 2]];
    const pGrid = position0.map((value) => value * invDx);
    const base = pGrid.map((value) => Math.floor(value - 0.5));
    const weights = [
      quadraticWeights(pGrid[0] - base[0]),
      quadraticWeights(pGrid[1] - base[1]),
      quadraticWeights(pGrid[2] - base[2])
    ];
    const velocity = [0, 0, 0];
    const C = new Array(9).fill(0);
    let sampledWeight = 0;
    for (let a = 0; a < 3; a += 1) for (let b = 0; b < 3; b += 1) for (let c = 0; c < 3; c += 1) {
      const i = base[0] + a;
      const j = base[1] + b;
      const k = base[2] + c;
      if (!inRange(gridUpdate, i, j, k)) continue;
      const w = weights[0][a] * weights[1][b] * weights[2][c];
      const nodeIndex = gridIndex(gridUpdate, i, j, k);
      const gridOffset = nodeIndex * MLS_MPM_GPU_GRID_VELOCITY_FLOATS;
      const gridMass = gridUpdate.updatedGridNodes[gridOffset];
      const gridStatus = gridUpdate.updatedGridNodes[gridOffset + 7];
      if (!(gridMass > 0) && !(gridStatus > 0)) continue;
      sampledWeight += w;
      const gv = [
        gridUpdate.updatedGridNodes[gridOffset + 1],
        gridUpdate.updatedGridNodes[gridOffset + 2],
        gridUpdate.updatedGridNodes[gridOffset + 3]
      ];
      velocity[0] += w * gv[0];
      velocity[1] += w * gv[1];
      velocity[2] += w * gv[2];
      const dpos = [
        (i - pGrid[0]) * gridUpdate.gridSpacingM,
        (j - pGrid[1]) * gridUpdate.gridSpacingM,
        (k - pGrid[2]) * gridUpdate.gridSpacingM
      ];
      const s = 4 * invDx * invDx * w;
      C[0] += s * gv[0] * dpos[0]; C[1] += s * gv[0] * dpos[1]; C[2] += s * gv[0] * dpos[2];
      C[3] += s * gv[1] * dpos[0]; C[4] += s * gv[1] * dpos[1]; C[5] += s * gv[1] * dpos[2];
      C[6] += s * gv[2] * dpos[0]; C[7] += s * gv[2] * dpos[1]; C[8] += s * gv[2] * dpos[2];
    }
    if (sampledWeight > 1e-8 && sampledWeight < 1 - 1e-6) {
      const normalization = 1 / sampledWeight;
      velocity[0] *= normalization;
      velocity[1] *= normalization;
      velocity[2] *= normalization;
      for (let index = 0; index < C.length; index += 1) C[index] *= normalization;
    }
    const position = [
      position0[0] + dtSeconds * velocity[0],
      position0[1] + dtSeconds * velocity[1],
      position0[2] + dtSeconds * velocity[2]
    ];
    const solid = mechanics[mechanicsOffset + 20] > 0.5;
    const condensed = isCondensedMechanicsRow(mechanics, mechanicsOffset);
    const wallClearance = particleWallClearanceM(mechanics[mechanicsOffset + 19], dims, gridUpdate.gridSpacingM);
    for (let axis = 0; axis < 3; axis += 1) {
      const lower = wallClearance;
      const upper = Math.max(lower, dims[axis] - wallClearance);
      if (position[axis] < lower) {
        position[axis] = lower;
        if (velocity[axis] < 0) velocity[axis] = 0;
      } else if (position[axis] > upper) {
        position[axis] = upper;
        if (velocity[axis] > 0) velocity[axis] = 0;
      }
    }
    const wallDampingAlpha = clamp(finiteNumber(liquidWallDampingAlpha, 0), 0, 1);
    const wallDampingDistance = Math.max(finiteNumber(liquidWallDampingDistanceM, 0), 1e-9);
    if (!solid && condensed && wallDampingAlpha > 0) {
      const floorDistance = Math.max(0, position[1] - wallClearance);
      if (floorDistance < wallDampingDistance) {
        const q = 1 - (floorDistance / wallDampingDistance);
        const keep = clamp(1 - wallDampingAlpha * q * q, 0, 1);
        velocity[0] *= keep;
        velocity[1] *= keep;
        velocity[2] *= keep;
      }
    }
    state[stateOffset] = position[0];
    state[stateOffset + 1] = position[1];
    state[stateOffset + 2] = position[2];
    state[stateOffset + 4] = velocity[0];
    state[stateOffset + 5] = velocity[1];
    state[stateOffset + 6] = velocity[2];

    const eosModelId = Math.round(mechanics[mechanicsOffset + 26]);
    const F = Array.from(mechanics.slice(mechanicsOffset, mechanicsOffset + 9));
    const pressureScale = finiteNumber(internalPressureScale, 1);
    const deformationDisabled = !solid && (eosModelId === EOS_MODEL_IDS.disabled || pressureScale === 0);
    const effectiveC = deformationDisabled ? new Array(9).fill(0) : C;
    let nextF = F;
    let nextJ = finiteNumber(mechanics[mechanicsOffset + 18], det3(F));
    if (!deformationDisabled) {
      nextF = multiplyGradF(F, effectiveC, dtSeconds);
      nextJ = det3(nextF);
      if (condensed) {
        const stabilized = stabilizeCondensedF(
          nextF,
          nextJ,
          mechanics[mechanicsOffset + 18],
          solid
        );
        nextF = stabilized.nextF;
        nextJ = stabilized.nextJ;
      } else if (!solid) {
        nextF = isotropicF(Math.max(nextJ, 0.05));
        nextJ = det3(nextF);
      }
    }
    const scaleStability = stabilizeGeneralParticleScaleF(nextF, nextJ);
    maxRawVolumeRatioJ = Math.max(maxRawVolumeRatioJ, finiteNumber(scaleStability.rawVolumeRatioJ, 0));
    if (scaleStability.capped) {
      particleScaleCapCount += 1;
      if (scaleStability.invalid) particleScaleInvalidCount += 1;
      if (cappedSamples.length < 8) {
        cappedSamples.push({
          particleIndex,
          rawVolumeRatioJ: scaleStability.rawVolumeRatioJ,
          volumeRatioJ: scaleStability.nextJ,
          rawRadiusGrowthRatio: scaleStability.rawVolumeRatioJ != null
            ? Math.cbrt(Math.max(scaleStability.rawVolumeRatioJ, 1e-12))
            : null,
          radiusGrowthRatio: Math.cbrt(Math.max(scaleStability.nextJ, 1e-12)),
          reason: scaleStability.reason
        });
      }
    }
    nextF = scaleStability.nextF;
    nextJ = scaleStability.nextJ;
    mechanics.set(nextF, mechanicsOffset);
    mechanics.set(effectiveC, mechanicsOffset + 9);
    mechanics[mechanicsOffset + 18] = nextJ;
  }

  applyMlsMpmParticleSeparationCpu({
    state,
    mechanics,
    particleCount: sphParticleState.particleCount,
    boxDimsM: dims,
    relaxation: particleSeparationRelaxation,
    normalVelocityDamping: particleSeparationVelocityDamping,
    gridSpacingM: gridUpdate.gridSpacingM
  });

  return outputEnvelope({
    backend: 'cpu-reference',
    sphParticleState,
    mlsMpmParticleState,
    gridUpdate,
    state,
    mechanics,
    dt: dtSeconds,
    boxDimsM: dims,
    internalPressureScale,
    particleScaleStability: summarizeG2pParticleScaleStability({
      backend: 'cpu-reference',
      particleCount: sphParticleState.particleCount,
      mechanics,
      capCount: particleScaleCapCount,
      invalidCount: particleScaleInvalidCount,
      maxRawVolumeRatioJ,
      cappedSamples,
      source: 'cpu-reference-g2p-deformation-update'
    })
  });
}

function writeStorageBuffer(device, label, data) {
  const byteLength = Math.max(4, data.byteLength);
  const buffer = device.createBuffer({
    label,
    size: byteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
  });
  try {
    if (data.byteLength > 0) device.queue.writeBuffer(buffer, 0, data);
  } catch (error) {
    try {
      buffer.destroy?.();
    } catch {
      // Preserve the originating upload failure.
    }
    throw error;
  }
  return buffer;
}

function createSchroederSpatialAuthorityBinding({
  device,
  schroederSpatialEpochGeneration = null,
  canonicalSpatialRequired = false
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
  const schemaRejected = schroederSpatialEpochGeneration != null && (
    schroederSpatialEpochGeneration?.schema !== SCHROEDER_SPATIAL_EPOCH_GENERATION_SCHEMA
    || execution?.schema !== SCHROEDER_SPATIAL_EPOCH_SCHEMA
  );
  const overlayRejected =
    schroederSpatialEpochGeneration?.source?.phaseVolumeAssignmentOverlayEnabled === true;
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
    && !schemaRejected
    && !overlayRejected
    && !queryProfileRejected
    && !released;
  if (!enabled) {
    const status = deviceMismatch.mismatch
      ? 'canonical-spatial-directory-rejected-device'
      : (evidenceBufferTooSmall
          ? 'canonical-spatial-directory-rejected-evidence-capacity'
          : (overlayRejected
              ? 'canonical-spatial-directory-rejected-overlay-authority'
              : (schemaRejected
                  ? 'canonical-spatial-directory-rejected-schema'
                  : (queryProfileRejected
                      ? 'canonical-spatial-directory-rejected-query-geometry'
                      : (released
                          ? 'canonical-spatial-directory-rejected-released-generation'
                          : (canonicalIntent
                              ? 'canonical-spatial-directory-requested-but-unavailable'
                              : 'canonical-spatial-directory-not-provided'))))));
    if (canonicalIntent) {
      const error = new Error(
        `Canonical MLS-MPM G2P spatial authority rejected before submission: ${status}`
      );
      error.code = 'ERR_CANONICAL_SPATIAL_AUTHORITY_REJECTED';
      error.status = status;
      throw error;
    }
    return {
      enabled: false,
      required: canonicalSpatialRequired === true,
      status,
      directoryBuffer: null,
      evidenceBuffer: null,
      retainedDirectoryBuffer: false,
      oldLevelAssignmentLookupRemoved: false,
      authorityBindingMode: 'precanonical-level-assignment'
    };
  }
  return {
    enabled: true,
    required: canonicalSpatialRequired === true,
    status: 'canonical-spatial-directory-bound-for-g2p-level-admission',
    directoryBuffer,
    evidenceBuffer,
    retainedDirectoryBuffer: true,
    oldLevelAssignmentLookupRemoved: true,
    authorityBindingMode: 'canonical-spatial-epoch',
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
    directoryBufferByteLength: execution.layout?.byteLength
      ?? directoryBuffer.size
      ?? 0,
    evidenceBufferByteLength: execution.evidenceBufferByteLength
      ?? evidenceBuffer.size
      ?? SCHROEDER_SPATIAL_EPOCH_WITH_MECHANICS_EVIDENCE_BYTES,
    sourceDeviceId: deviceMismatch.sourceDeviceId,
    consumerDeviceId: deviceMismatch.consumerDeviceId
  };
}

function schroederSpatialAuthorityMetadata(binding = null) {
  if (!binding) return null;
  const {
    directoryBuffer: _directoryBuffer,
    evidenceBuffer: _evidenceBuffer,
    ...metadata
  } = binding;
  return metadata;
}

function canonicalMechanicalProposalAdmitted({
  proposal,
  generation,
  spatialAuthority,
  device
} = {}) {
  const separationReceipt = proposal?.consumerReceipt?.('separation') ?? null;
  return Boolean(
    proposal
    && Object.isFrozen(proposal)
    && proposal.schema === 'peercompute.ulg.schroeder-spatial-mechanical-proposal.v1'
    && proposal.status === 'schroeder-spatial-mechanical-proposal-submitted'
    && proposal.ready === true
    && proposal.releaseScheduled !== true
    && proposal.released !== true
    && proposal.generation === generation
    && proposal.generationId === spatialAuthority?.generationId
    && proposal.supportEpoch === spatialAuthority?.supportEpoch
    && proposal.traversalCount === 1
    && proposal.privateBuildCount === 0
    && proposal.fixedCandidateBuildCount === 0
    && proposal.exhaustiveTraversalCount === 0
    && proposal.fullParticleReadbackPerformed === false
    && typeof proposal.encodeApply === 'function'
    && proposal.proposalBuffer
    && webGpuDeviceMismatchInfo({ buffer: proposal.proposalBuffer, device }).mismatch === false
    && proposal.evidence?.buffer
    && webGpuDeviceMismatchInfo({ buffer: proposal.evidence.buffer, device }).mismatch === false
    && separationReceipt
    && Object.isFrozen(separationReceipt)
    && separationReceipt.status === 'schroeder-spatial-epoch-consumer-receipt-finalized'
    && separationReceipt.gpuAuthenticated === true
    && separationReceipt.consumerId === 'separation'
    && separationReceipt.supportProfileId === SCHROEDER_SPATIAL_SUPPORT_PROFILE_SEPARATION_V1
    && separationReceipt.generationId === spatialAuthority?.generationId
    && separationReceipt.traversalCount === 1
    && separationReceipt.privateLookupBuildCount === 0
    && separationReceipt.fixedCandidateBuildCount === 0
    && separationReceipt.exhaustiveTraversalCount === 0
  );
}

function createParamsArray({
  particleCount,
  gridUpdate,
  dt,
  boxDimsM,
  internalPressureScale,
  liquidWallDampingAlpha = 0,
  liquidWallDampingDistanceM = 0,
  schroederActiveNodeFilterEnabled = false,
  schroederLevelFilterEnabled = false,
  schroederSelectedLevel = -1
}) {
  const buffer = new ArrayBuffer(G2P_PARAMS_BYTES);
  const view = new DataView(buffer);
  view.setUint32(0, particleCount, true);
  view.setUint32(4, gridUpdate.gridNodeCount, true);
  view.setUint32(8, gridUpdate.gridDims[0], true);
  view.setUint32(12, gridUpdate.gridDims[1], true);
  view.setUint32(16, gridUpdate.gridDims[2], true);
  view.setUint32(20, gridUpdate.gridShift, true);
  view.setUint32(24, schroederActiveNodeFilterEnabled ? 1 : 0, true);
  view.setInt32(28, Math.round(finiteNumber(schroederSelectedLevel, -1)), true);
  view.setFloat32(32, gridUpdate.gridSpacingM, true);
  view.setFloat32(36, 1 / gridUpdate.gridSpacingM, true);
  view.setFloat32(40, dt, true);
  view.setFloat32(44, boxDimsM[0], true);
  view.setFloat32(48, boxDimsM[1], true);
  view.setFloat32(52, boxDimsM[2], true);
  view.setFloat32(56, finiteNumber(internalPressureScale, 1), true);
  view.setFloat32(60, clamp(finiteNumber(liquidWallDampingAlpha, 0), 0, 1), true);
  view.setFloat32(64, Math.max(finiteNumber(liquidWallDampingDistanceM, 0), 0), true);
  view.setUint32(68, SCHROEDER_LEVEL_ASSIGNMENT_FLOATS, true);
  view.setUint32(72, schroederLevelFilterEnabled ? 1 : 0, true);
  return buffer;
}

function createCanonicalParamsArray({
  schroederSpatialDirectory,
  spatialEvidenceEnabled = false,
  ...baseParams
}) {
  const buffer = new ArrayBuffer(G2P_CANONICAL_PARAMS_BYTES);
  new Uint8Array(buffer).set(new Uint8Array(createParamsArray(baseParams)));
  const view = new DataView(buffer);
  view.setUint32(76, 1, true);
  view.setUint32(80, Math.max(0, Math.round(finiteNumber(
    schroederSpatialDirectory?.storageGeneration,
    0
  ))), true);
  view.setUint32(84, Math.max(0, Math.round(finiteNumber(
    schroederSpatialDirectory?.positionEpoch,
    0
  ))), true);
  view.setUint32(88, Math.max(0, Math.round(finiteNumber(
    schroederSpatialDirectory?.topologyEpoch,
    0
  ))), true);
  view.setUint32(92, schroederSpatialDirectory?.required === true ? 1 : 0, true);
  view.setUint32(96, Math.max(0, Math.round(finiteNumber(
    schroederSpatialDirectory?.generationId,
    0
  ))), true);
  view.setUint32(100, Math.max(0, Math.round(finiteNumber(
    schroederSpatialDirectory?.deviceOrdinal,
    0
  ))), true);
  view.setUint32(104, Math.max(0, Math.round(finiteNumber(
    schroederSpatialDirectory?.laneOrdinal,
    0
  ))), true);
  view.setUint32(108, Math.max(0, Math.round(finiteNumber(
    schroederSpatialDirectory?.leaseToken,
    0
  ))), true);
  view.setUint32(112, Math.max(0, Math.round(finiteNumber(
    schroederSpatialDirectory?.sourceFamilyId,
    0
  ))), true);
  view.setUint32(116, Math.max(0, Math.round(finiteNumber(
    schroederSpatialDirectory?.physicsTick,
    0
  ))), true);
  view.setUint32(120, Math.max(0, Math.round(finiteNumber(
    schroederSpatialDirectory?.physicsSubstep,
    0
  ))), true);
  view.setUint32(124, Math.max(0, Math.round(finiteNumber(
    schroederSpatialDirectory?.chartEpoch,
    0
  ))), true);
  view.setUint32(128, Math.max(0, Math.round(finiteNumber(
    schroederSpatialDirectory?.levelEpoch,
    0
  ))), true);
  view.setUint32(132, Math.max(0, Math.round(finiteNumber(
    schroederSpatialDirectory?.supportEpoch,
    0
  ))), true);
  view.setUint32(136, spatialEvidenceEnabled === true ? 1 : 0, true);
  view.setUint32(140, Math.max(0, Math.round(finiteNumber(
    baseParams.gridUpdate?.mechanicsFieldMutationOutputOrdinal,
    0
  ))), true);
  return buffer;
}

/**
 * Largest pair rest distance in the current mechanics rows (cbrt of the
 * per-particle rest volume). Used to size the separation neighbor-bin cells
 * so a 3x3x3 cell scan covers every interacting pair. Cached on the
 * mechanics array since rest volumes only drift on phase change (the 1.25
 * sizing margin in the caller absorbs that drift).
 */
export function maxSeparationRestDistanceM(mechanics, particleCount) {
  if (!(mechanics instanceof Float32Array) || mechanics.length === 0) return 0;
  let maxVolume = 0;
  const count = Math.min(
    Math.max(0, Math.floor(particleCount)),
    Math.floor(mechanics.length / MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS)
  );
  for (let index = 0; index < count; index += 1) {
    const volume = mechanics[index * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS + 19];
    if (volume > maxVolume) maxVolume = volume;
  }
  return maxVolume > 0 ? Math.cbrt(maxVolume) : 0;
}

function separationBinPlan({ boxDimsM, maxPairRestDistanceM, minCellSizeM = 0 }) {
  const restDistance = finiteNumber(maxPairRestDistanceM, 0);
  if (!(restDistance > 0)) return null;
  // 1.25 margin over the largest rest distance absorbs phase-change rest
  // volume drift while keeping the 3x3x3 scan complete. minCellSizeM lets a
  // sharing consumer (thermal conduction, support 2h with scan radius <= 3)
  // demand cells large enough that its clamped scan still covers its support.
  let cellSizeM = Math.max(1.25 * restDistance, finiteNumber(minCellSizeM, 0));
  const dims = boxDimsM;
  const cellsFor = (size) => [0, 1, 2].map((axis) => Math.max(1, Math.ceil(dims[axis] / size)));
  let counts = cellsFor(cellSizeM);
  let total = counts[0] * counts[1] * counts[2];
  while (total > SEPARATION_BIN_MAX_CELLS) {
    cellSizeM *= 2;
    counts = cellsFor(cellSizeM);
    total = counts[0] * counts[1] * counts[2];
  }
  return { cellSizeM, nx: counts[0], ny: counts[1], nz: counts[2], cellCount: total };
}

/**
 * Encode the excluded-volume separation passes onto an existing command
 * encoder, after G2P has written post-integration particle state. Pass 1
 * fills fixed-capacity grid-cell bins, pass 2 scans the 3x3x3 cell
 * neighborhood from the frozen state and writes per-particle corrections
 * (race-free: each thread writes only its own rows), pass 3 applies the
 * corrections to the state buffer in place and re-clamps to the sealed box.
 * Pass `scratch` (from a previous call on the same encoder sequence) to
 * reuse the bin/corrections/params buffers across fused substeps.
 * Returns transient buffers the caller must destroy after submission.
 */
export function encodeMlsMpmParticleSeparationPasses(device, encoder, {
  stateBuffer,
  mechanicsBuffer,
  authorityRestoreStateBuffer = null,
  authorityRestoreMechanicsBuffer = null,
  particleCount,
  boxDimsM = DEFAULT_BOX_DIMS_M,
  relaxation = MLS_MPM_PARTICLE_SEPARATION_RELAXATION_DEFAULT,
  normalVelocityDamping = MLS_MPM_PARTICLE_SEPARATION_VELOCITY_DAMPING_DEFAULT,
  maxPairRestDistanceM = 0,
  minCellSizeM = 0,
  gridSpacingM = 0,
  spatialAuthorityEvidenceBuffer = null,
  spatialAuthorityEvidenceObserved = false,
  scratch = null
} = {}) {
  const alpha = Math.max(finiteNumber(relaxation, 0), 0);
  const beta = clamp(finiteNumber(normalVelocityDamping, 0), 0, 1);
  if (!(alpha > 0 || beta > 0) || !(particleCount > 1) || !stateBuffer || !mechanicsBuffer) {
    return { enabled: false, transientBuffers: scratch?.transientBuffers || [], scratch };
  }
  const dims = finiteVector3(boxDimsM, DEFAULT_BOX_DIMS_M);
  const canonicalSpatialAuthority = Boolean(spatialAuthorityEvidenceBuffer);
  const canonicalSpatialAuthorityObserved = canonicalSpatialAuthority
    && spatialAuthorityEvidenceObserved === true;
  const binPlan = separationBinPlan({ boxDimsM: dims, maxPairRestDistanceM, minCellSizeM });
  if (!binPlan) {
    return { enabled: false, transientBuffers: scratch?.transientBuffers || [], scratch };
  }
  if (
    canonicalSpatialAuthority
    && (!authorityRestoreStateBuffer || !authorityRestoreMechanicsBuffer)
  ) {
    throw new TypeError(
      'Canonical particle separation requires immutable state and mechanics restore buffers'
    );
  }
  if (
    canonicalSpatialAuthority
    && (
      authorityRestoreStateBuffer === stateBuffer
      || authorityRestoreStateBuffer === mechanicsBuffer
      || authorityRestoreMechanicsBuffer === stateBuffer
      || authorityRestoreMechanicsBuffer === mechanicsBuffer
      || authorityRestoreStateBuffer === authorityRestoreMechanicsBuffer
    )
  ) {
    throw new TypeError(
      'Canonical particle separation restore buffers must be distinct immutable inputs'
    );
  }
  let activeScratch = scratch;
  if (!activeScratch
    || activeScratch.particleCount !== particleCount
    || activeScratch.cellCount !== binPlan.cellCount) {
    const paramsBuffer = device.createBuffer({
      label: 'ulg-mls-mpm-separation-params',
      size: SEPARATION_PARAMS_BYTES,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
    });
    const paramsData = new ArrayBuffer(SEPARATION_PARAMS_BYTES);
    const view = new DataView(paramsData);
    view.setUint32(0, particleCount >>> 0, true);
    view.setFloat32(4, alpha, true);
    view.setFloat32(8, dims[0], true);
    view.setFloat32(12, dims[1], true);
    view.setFloat32(16, dims[2], true);
    view.setFloat32(20, beta, true);
    view.setUint32(24, binPlan.nx >>> 0, true);
    view.setUint32(28, binPlan.ny >>> 0, true);
    view.setUint32(32, binPlan.nz >>> 0, true);
    view.setUint32(36, SEPARATION_BIN_CAPACITY >>> 0, true);
    view.setFloat32(40, binPlan.cellSizeM, true);
    // grid_spacing_m: caps the wall clearance at half a cell (matches G2P).
    view.setFloat32(44, Math.max(finiteNumber(gridSpacingM, 0), 0), true);
    device.queue.writeBuffer(paramsBuffer, 0, paramsData);
    const correctionsBuffer = device.createBuffer({
      label: 'ulg-mls-mpm-separation-corrections',
      size: Math.max(4, particleCount * 32),
      usage: GPU_BUFFER_USAGE.STORAGE
    });
    // Combined layout: counts prefix [0, cellCount), then entry slots. One
    // buffer keeps every consumer within the default 10-storage-buffer
    // per-stage device limit.
    const binsBuffer = device.createBuffer({
      label: 'ulg-mls-mpm-separation-bins',
      size: Math.max(4, binPlan.cellCount * (1 + SEPARATION_BIN_CAPACITY) * 4),
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
    });
    activeScratch = {
      particleCount,
      cellCount: binPlan.cellCount,
      paramsBuffer,
      correctionsBuffer,
      binsBuffer,
      // Shared neighbor-bin contract for sibling consumers (thermal pair
      // conduction) encoded in the same submission after the bin fill.
      neighborBins: {
        binsBuffer,
        capacity: SEPARATION_BIN_CAPACITY,
        nx: binPlan.nx,
        ny: binPlan.ny,
        nz: binPlan.nz,
        cellSizeM: binPlan.cellSizeM,
        cellCount: binPlan.cellCount
      },
      transientBuffers: [paramsBuffer, correctionsBuffer, binsBuffer]
    };
  }
  const binFillPipelineInfo = createCachedExplicitComputePipeline(device, {
    cacheKey: canonicalSpatialAuthority
      ? `ulg-mls-mpm-particle-separation-bin-fill.v5.canonical-spatial.${canonicalSpatialAuthorityObserved
          ? 'observed'
          : 'unobserved'}`
      : 'ulg-mls-mpm-particle-separation-bin-fill.v4.precanonical',
    label: 'ulg-mls-mpm-particle-separation-bin-fill',
    code: canonicalSpatialAuthority
      ? (canonicalSpatialAuthorityObserved
          ? mlsMpmParticleSeparationBinFillCanonicalSpatialWgsl
          : mlsMpmParticleSeparationBinFillCanonicalSpatialUnobservedWgsl)
      : mlsMpmParticleSeparationBinFillWgsl,
    entryPoint: 'main',
    bindings: [
      computeBufferBinding(0, canonicalSpatialAuthority ? 'storage' : 'read-only-storage'),
      computeBufferBinding(1, canonicalSpatialAuthority ? 'storage' : 'read-only-storage'),
      computeBufferBinding(2, 'storage'),
      computeBufferBinding(3, 'uniform'),
      ...(canonicalSpatialAuthority
        ? [
            computeBufferBinding(4, 'read-only-storage'),
            computeBufferBinding(5, 'read-only-storage'),
            computeBufferBinding(6, 'read-only-storage')
          ]
        : [])
    ]
  });
  const computePipelineInfo = createCachedExplicitComputePipeline(device, {
    cacheKey: canonicalSpatialAuthority
      ? `ulg-mls-mpm-particle-separation-compute.v6.canonical-spatial.${canonicalSpatialAuthorityObserved
          ? 'observed'
          : 'unobserved'}`
      : 'ulg-mls-mpm-particle-separation-compute.v5.precanonical',
    label: 'ulg-mls-mpm-particle-separation-compute',
    code: canonicalSpatialAuthority
      ? (canonicalSpatialAuthorityObserved
          ? mlsMpmParticleSeparationComputeCanonicalSpatialWgsl
          : mlsMpmParticleSeparationComputeCanonicalSpatialUnobservedWgsl)
      : mlsMpmParticleSeparationComputeWgsl,
    entryPoint: 'main',
    bindings: [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'storage'),
      computeBufferBinding(3, 'uniform'),
      computeBufferBinding(4, 'read-only-storage'),
      ...(canonicalSpatialAuthority ? [computeBufferBinding(5, 'read-only-storage')] : [])
    ]
  });
  const applyPipelineInfo = createCachedExplicitComputePipeline(device, {
    cacheKey: canonicalSpatialAuthority
      ? `ulg-mls-mpm-particle-separation-apply.v5.canonical-spatial.${canonicalSpatialAuthorityObserved
          ? 'observed'
          : 'unobserved'}`
      : 'ulg-mls-mpm-particle-separation-apply.v4.precanonical',
    label: 'ulg-mls-mpm-particle-separation-apply',
    code: canonicalSpatialAuthority
      ? (canonicalSpatialAuthorityObserved
          ? mlsMpmParticleSeparationApplyCanonicalSpatialWgsl
          : mlsMpmParticleSeparationApplyCanonicalSpatialUnobservedWgsl)
      : mlsMpmParticleSeparationApplyWgsl,
    entryPoint: 'main',
    bindings: [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'storage'),
      computeBufferBinding(3, 'uniform'),
      ...(canonicalSpatialAuthority ? [computeBufferBinding(4, 'read-only-storage')] : [])
    ]
  });
  const binFillBindGroup = device.createBindGroup({
    layout: binFillPipelineInfo.bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: stateBuffer } },
      { binding: 1, resource: { buffer: mechanicsBuffer } },
      { binding: 2, resource: { buffer: activeScratch.binsBuffer } },
      { binding: 3, resource: { buffer: activeScratch.paramsBuffer } },
      ...(canonicalSpatialAuthority
        ? [
            { binding: 4, resource: { buffer: spatialAuthorityEvidenceBuffer } },
            { binding: 5, resource: { buffer: authorityRestoreStateBuffer } },
            { binding: 6, resource: { buffer: authorityRestoreMechanicsBuffer } }
          ]
        : [])
    ]
  });
  const computeBindGroup = device.createBindGroup({
    layout: computePipelineInfo.bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: stateBuffer } },
      { binding: 1, resource: { buffer: mechanicsBuffer } },
      { binding: 2, resource: { buffer: activeScratch.correctionsBuffer } },
      { binding: 3, resource: { buffer: activeScratch.paramsBuffer } },
      { binding: 4, resource: { buffer: activeScratch.binsBuffer } },
      ...(canonicalSpatialAuthority
        ? [{ binding: 5, resource: { buffer: spatialAuthorityEvidenceBuffer } }]
        : [])
    ]
  });
  const applyBindGroup = device.createBindGroup({
    layout: applyPipelineInfo.bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: activeScratch.correctionsBuffer } },
      { binding: 1, resource: { buffer: mechanicsBuffer } },
      { binding: 2, resource: { buffer: stateBuffer } },
      { binding: 3, resource: { buffer: activeScratch.paramsBuffer } },
      ...(canonicalSpatialAuthority
        ? [{ binding: 4, resource: { buffer: spatialAuthorityEvidenceBuffer } }]
        : [])
    ]
  });
  encoder.clearBuffer(activeScratch.binsBuffer, 0, Math.max(4, activeScratch.cellCount * 4));
  const workgroups = Math.max(1, Math.ceil(particleCount / 64));
  const binFillPass = encoder.beginComputePass();
  binFillPass.setPipeline(binFillPipelineInfo.pipeline);
  binFillPass.setBindGroup(0, binFillBindGroup);
  binFillPass.dispatchWorkgroups(workgroups);
  binFillPass.end();
  const computePass = encoder.beginComputePass();
  computePass.setPipeline(computePipelineInfo.pipeline);
  computePass.setBindGroup(0, computeBindGroup);
  computePass.dispatchWorkgroups(workgroups);
  computePass.end();
  const applyPass = encoder.beginComputePass();
  applyPass.setPipeline(applyPipelineInfo.pipeline);
  applyPass.setBindGroup(0, applyBindGroup);
  applyPass.dispatchWorkgroups(workgroups);
  applyPass.end();
  return {
    enabled: true,
    transientBuffers: activeScratch.transientBuffers,
    scratch: activeScratch,
    canonicalSpatialAuthorityGate: canonicalSpatialAuthority,
    canonicalAuthorityRestoreFolded: canonicalSpatialAuthority,
    canonicalSpatialAuthorityEvidenceObserved: canonicalSpatialAuthorityObserved
  };
}

export async function runMlsMpmG2pWebGpu({
  device,
  sphParticleState,
  mlsMpmParticleState,
  gridUpdate,
  sphParticleUpload = null,
  mlsMpmParticleUpload = null,
  updatedGridBuffer = null,
  dt = gridUpdate?.dt ?? mlsMpmParticleState?.mechanicsDtS ?? 0,
  boxDimsM = DEFAULT_BOX_DIMS_M,
  internalPressureScale = 1,
  liquidWallDampingAlpha = mlsMpmParticleState?.liquidWallDampingAlpha ?? 0,
  liquidWallDampingDistanceM = mlsMpmParticleState?.liquidWallDampingDistanceM ?? 0,
  particleSeparationRelaxation = mlsMpmParticleState?.particleSeparationRelaxation
    ?? MLS_MPM_PARTICLE_SEPARATION_RELAXATION_DEFAULT,
  particleSeparationVelocityDamping = mlsMpmParticleState?.particleSeparationVelocityDamping
    ?? MLS_MPM_PARTICLE_SEPARATION_VELOCITY_DAMPING_DEFAULT,
  schroederLevelAssignment = null,
  schroederActiveNodeList = null,
  schroederSelectedLevel = null,
  schroederSpatialEpochGeneration = null,
  schroederSpatialMechanicalProposal = null,
  fusedFineSubstepTransaction = null,
  fusedCoarseTerminalTransaction = null,
  canonicalSpatialRequired = false,
  observeCanonicalSpatialAuthority = false,
  mechanicsFieldMode = gridUpdate?.mechanicsFieldMode
    ?? MLS_MPM_MECHANICS_FIELD_MODE_DISABLED,
  retainOutputParticleBuffers = false,
  readbackMode = FULL_READBACK_MODE
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runMlsMpmG2pWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  if (
    fusedFineSubstepTransaction != null
    && fusedCoarseTerminalTransaction != null
  ) {
    throw new TypeError(
      'G2P accepts either a fused fine transaction or fused coarse-terminal transaction, never both'
    );
  }
  const fineArtifactTransaction = gridUpdate?.fusedFineSubstepTransaction ?? null;
  const coarseArtifactTransaction =
    gridUpdate?.fusedCoarseTerminalTransaction ?? null;
  if (
    (fineArtifactTransaction != null
      && fineArtifactTransaction !== fusedFineSubstepTransaction)
    || (coarseArtifactTransaction != null
      && coarseArtifactTransaction !== fusedCoarseTerminalTransaction)
    || (fusedFineSubstepTransaction != null
      && (fineArtifactTransaction !== fusedFineSubstepTransaction
        || coarseArtifactTransaction != null))
    || (fusedCoarseTerminalTransaction != null
      && (coarseArtifactTransaction !== fusedCoarseTerminalTransaction
        || fineArtifactTransaction != null))
  ) {
    throw new TypeError(
      'G2P fused artifact brand and transaction mode must match exactly'
    );
  }
  if (schroederActiveNodeList) {
    // The compacted active-node list is tile/node-aligned, not
    // particle-parallel; using it as a per-particle G2P filter silently
    // froze the simulation. Callers must pass the level assignment.
    throw new TypeError(
      'runMlsMpmG2pWebGpu no longer accepts schroederActiveNodeList; pass schroederLevelAssignment (particle-parallel rows) instead'
    );
  }
  if (
    mechanicsFieldMode !== MLS_MPM_MECHANICS_FIELD_MODE_DISABLED
    && mechanicsFieldMode !== MLS_MPM_MECHANICS_FIELD_MODE_REQUIRED
  ) {
    throw new RangeError(
      `mechanicsFieldMode must be '${MLS_MPM_MECHANICS_FIELD_MODE_DISABLED}' or '${MLS_MPM_MECHANICS_FIELD_MODE_REQUIRED}'`
    );
  }
  assertInputs({ sphParticleState, mlsMpmParticleState, gridUpdate });
  // A selected generation is the sole mechanics authority. Resolve and
  // authenticate it before allocating transient outputs, and never inspect a
  // legacy assignment payload in canonical mode.
  const schroederSpatialAuthority = createSchroederSpatialAuthorityBinding({
    device,
    schroederSpatialEpochGeneration,
    canonicalSpatialRequired
  });
  const canonicalSpatialAuthority = schroederSpatialAuthority.enabled === true;
  const mechanicsFieldRequired =
    mechanicsFieldMode === MLS_MPM_MECHANICS_FIELD_MODE_REQUIRED;
  if (mechanicsFieldRequired && !canonicalSpatialAuthority) {
    throw canonicalSpatialExecutionError(
      'mechanics-field-canonical-generation-required',
      'Required mechanics-field G2P needs one selected canonical spatial generation'
    );
  }
  if (
    mechanicsFieldRequired
    && gridUpdate.mechanicsFieldMode !== MLS_MPM_MECHANICS_FIELD_MODE_REQUIRED
  ) {
    throw canonicalSpatialExecutionError(
      'mechanics-field-grid-update-mode-rejected',
      'Required mechanics-field G2P needs an explicitly required upstream grid update'
    );
  }
  if (
    !mechanicsFieldRequired
    && gridUpdate.mechanicsFieldMode === MLS_MPM_MECHANICS_FIELD_MODE_REQUIRED
  ) {
    throw canonicalSpatialExecutionError(
      'mechanics-field-mode-required',
      'A required mechanics-field grid update cannot be consumed through dense G2P mode'
    );
  }
  if (mechanicsFieldRequired && readbackMode !== NO_FULL_READBACK_MODE) {
    throw canonicalSpatialExecutionError(
      'mechanics-field-resident-readback-mode-required',
      'Required mechanics-field G2P supports resident no-full-readback execution only'
    );
  }
  if (!mechanicsFieldRequired && gridUpdate.mechanicsFieldViewEnabled === true) {
    throw canonicalSpatialExecutionError(
      'mechanics-field-mode-required',
      'A mechanics-field grid update must be consumed with mechanicsFieldMode required'
    );
  }
  if (canonicalSpatialAuthority && (
    typeof schroederSelectedLevel !== 'number'
    || !Number.isInteger(schroederSelectedLevel)
    || schroederSelectedLevel < -0x8000_0000
    || schroederSelectedLevel > 0x7fff_ffff
  )) {
    throw canonicalSpatialExecutionError(
      'canonical-spatial-selected-level-rejected',
      'Canonical WebGPU MLS-MPM G2P requires an exact i32 selected Schroeder level'
    );
  }
  const dtSeconds = finiteNumber(dt, 0);
  const dims = finiteVector3(boxDimsM, DEFAULT_BOX_DIMS_M);
  const fusedTransaction = fusedFineSubstepTransaction
    ?? fusedCoarseTerminalTransaction;
  const fusedG2p = fusedTransaction != null;
  const fusedTransactionMode = fusedCoarseTerminalTransaction != null
    ? 'coarse-terminal'
    : 'fine';
  const fusedAdmissionInputs = {
    device,
    transaction: fusedTransaction,
    transactionMode: fusedTransactionMode,
    gridUpdate,
    sphParticleState,
    mlsMpmParticleState,
    sphParticleUpload,
    mlsMpmParticleUpload,
    schroederSpatialEpochGeneration,
    schroederSelectedLevel,
    schroederSpatialMechanicalProposal,
    dt: dtSeconds,
    boxDimsM: dims,
    internalPressureScale,
    liquidWallDampingAlpha,
    liquidWallDampingDistanceM,
    mechanicsFieldMode,
    retainOutputParticleBuffers,
    readbackMode,
    canonicalSpatialRequired
  };
  if (fusedG2p && !fusedG2pInputsAdmitted(fusedAdmissionInputs)) {
    throw canonicalSpatialExecutionError(
      'fused-g2p-provenance-rejected',
      'Fused G2P requires the exact correction or terminal field artifact, continuation, timing, and deferred-proposal transaction'
    );
  }
  const fusedInputSnapshot = fusedG2p
    ? captureFusedG2pInputSnapshot(fusedAdmissionInputs)
    : null;
  const fusedInputsRemainAdmitted = ({ submissionObserved = false } = {}) => (
    !fusedG2p || Boolean(
    fusedG2pInputsAdmitted({
      ...fusedAdmissionInputs,
      submissionObserved
    })
    && fusedG2pInputSnapshotMatches(
      device,
      fusedInputSnapshot,
      fusedAdmissionInputs
    )
    )
  );
  let fusedG2pClaim = null;
  let fusedStageProducerCapability = null;
  if (fusedG2p) {
    if (fusedG2pClaims.has(fusedTransaction)) {
      throw canonicalSpatialExecutionError(
        'fused-g2p-transaction-already-claimed',
        'Fused G2P transaction already has an exact producer claim'
      );
    }
    fusedStageProducerCapability = fusedTransactionMode === 'coarse-terminal'
      ? claimSchroederFusedCoarseTerminalStageProducer(
          device,
          fusedTransaction,
          { stage: 'g2p', priorArtifact: gridUpdate }
        )
      : claimSchroederFusedFineSubstepStageProducer(
          device,
          fusedTransaction,
          { stage: 'g2p', priorArtifact: gridUpdate }
        );
    fusedG2pClaim = Object.freeze({
      transaction: fusedTransaction,
      transactionMode: fusedTransactionMode,
      sourceGridUpdate: gridUpdate,
      particleContinuation: fusedTransaction.particleContinuation,
      producerCapability: fusedStageProducerCapability
    });
    fusedG2pClaims.set(fusedTransaction, fusedG2pClaim);
  }
  const fusedProducerClaimRemainsExact = (options = {}) => !fusedG2p || Boolean(
    fusedInputsRemainAdmitted(options)
    && fusedG2pClaims.get(fusedTransaction) === fusedG2pClaim
    && fusedG2pClaim?.producerCapability === fusedStageProducerCapability
    && fusedStageProducerCapability != null
  );
  const allocationLedger = new Set();
  let allocationCleanupDelegated = false;
  const ownAllocation = (resource) => {
    if (resource?.destroy) allocationLedger.add(resource);
    return resource;
  };
  const createOwnedTaggedBuffer = (descriptor) => {
    const buffer = ownAllocation(device.createBuffer(descriptor));
    return tagWebGpuBufferDevice(buffer, device);
  };
  const destroyOwnedAllocation = (resource) => {
    if (!resource || !allocationLedger.has(resource)) return false;
    try {
      resource.destroy?.();
      allocationLedger.delete(resource);
    } catch {
      // Cleanup must never replace the producer's originating result/error.
      return false;
    }
    return true;
  };
  const destroyAllocationLedger = () => {
    for (let attempt = 0; attempt < 2 && allocationLedger.size > 0; attempt += 1) {
      for (const resource of [...allocationLedger]) {
        destroyOwnedAllocation(resource);
      }
    }
  };
  let returnedRetainedOutputBuffers = false;
  let separationTransientBuffers = [];
  let fusedG2pQueueSubmitted = false;
  let fusedG2pCommitted = false;
  let fusedG2pArtifact = null;
  let fusedG2pArtifactLifecycleDelegated = false;
  let outputParticleBuffersDestroyed = false;
  let outputStateBufferDestroyed = false;
  let outputMechanicsBufferDestroyed = false;
  try {
  // Never size GPU output buffers from the CPU arrays alone: under
  // GPU-resident continuation the CPU copies can be stale or detached
  // (byteLength 0), which would allocate 4-byte outputs and fail every
  // downstream binding. particleCount * stride is authoritative.
  const stateByteLength = fusedG2p
    ? fusedTransaction.particleContinuation.sphParticleUpload
      .particleCount
      * SPH_GPU_PARTICLE_STATE_FLOATS * Float32Array.BYTES_PER_ELEMENT
    : Math.max(
        sphParticleState.state.byteLength,
        sphParticleState.particleCount * (sphParticleState.stateStrideBytes
          ?? SPH_GPU_PARTICLE_STATE_FLOATS * Float32Array.BYTES_PER_ELEMENT)
      );
  const mechanicsByteLength = fusedG2p
    ? fusedTransaction.particleContinuation.mlsMpmParticleUpload
      .particleCount
      * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS * Float32Array.BYTES_PER_ELEMENT
    : Math.max(
        mlsMpmParticleState.mechanics.byteLength,
        mlsMpmParticleState.particleCount * (mlsMpmParticleState.mechanicsStrideBytes
          ?? MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS * Float32Array.BYTES_PER_ELEMENT)
      );
  const borrowedStateBuffer = sphParticleUpload?.status === 'webgpu-uploaded' ? sphParticleUpload.stateBuffer : null;
  const borrowedThermoBuffer = sphParticleUpload?.status === 'webgpu-uploaded' ? sphParticleUpload.thermoBuffer : null;
  const borrowedMechanicsBuffer = mlsMpmParticleUpload?.status === 'webgpu-uploaded' ? mlsMpmParticleUpload.mechanicsBuffer : null;
  if (mechanicsFieldRequired && updatedGridBuffer) {
    throw canonicalSpatialExecutionError(
      'mechanics-field-dense-grid-buffer-rejected',
      'Required mechanics-field G2P cannot accept an explicit dense updated-grid buffer'
    );
  }
  let mechanicsFieldKernelBundle = null;
  let mechanicsFieldBinding = null;
  let mechanicsFieldViewBuffer = null;
  let parentFieldWorkspace = null;
  if (mechanicsFieldRequired) {
    mechanicsFieldKernelBundle = await import('./sphMlsMpmGpuStep.js');
    if (!fusedInputsRemainAdmitted()) {
      throw canonicalSpatialExecutionError(
        'fused-g2p-provenance-lost-after-import',
        'Fused G2P lost its exact terminal artifact or continuation before encoding'
      );
    }
    mechanicsFieldBinding =
      mechanicsFieldKernelBundle.createFusedSchroederActiveNodeBinding({
        device,
        schroederSpatialEpochGeneration,
        canonicalSpatialRequired: true,
        gridSpec: {
          gridNodeCount: gridUpdate.gridNodeCount,
          gridDims: Array.from(gridUpdate.gridDims || []),
          shift: gridUpdate.gridShift,
          gridSpacingM: gridUpdate.gridSpacingM
        },
        selectedLevel: schroederSelectedLevel,
        particleStateBuffer: borrowedStateBuffer,
        particleIdentityBuffer: sphParticleUpload?.identityBuffer ?? null,
        labelPrefix: 'ulg-mls-mpm-staged-g2p'
      });
    mechanicsFieldViewBuffer = gridUpdate.mechanicsFieldViewBuffer ?? null;
    const fieldExecution = gridUpdate.mechanicsFieldViewExecution ?? null;
    const fieldRuntime = fieldExecution?.ownerRuntime ?? null;
    const mutationOrdinal = gridUpdate.mechanicsFieldMutationOutputOrdinal;
    const sourceProjection = gridUpdate.sourceProjection ?? null;
    const previousGridUpdate = gridUpdate.previousGridUpdate ?? null;
    const mutationLineageMatches = previousGridUpdate == null
      ? sourceProjection?.mechanicsFieldMutationOutputOrdinal
        === gridUpdate.mechanicsFieldMutationInputOrdinal
      : previousGridUpdate?.mechanicsFieldViewExecution === fieldExecution
        && previousGridUpdate?.sourceProjection === sourceProjection
        && sourceProjection?.mechanicsFieldMutationOutputOrdinal
          === previousGridUpdate?.mechanicsFieldMutationInputOrdinal
        && previousGridUpdate?.mechanicsFieldMutationOutputOrdinal
          === gridUpdate.mechanicsFieldMutationInputOrdinal
        && previousGridUpdate?.mechanicsFieldMutationOutputStateEncoding
          === SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT;
    const fusedFieldExecution = fusedTransactionMode === 'coarse-terminal'
      ? fusedTransaction?.coarseFieldView ?? null
      : fusedTransaction?.fineFieldView ?? null;
    const fusedPublicationLock = fusedTransactionMode === 'coarse-terminal'
      ? fusedTransaction?.coarsePublicationLock ?? null
      : fusedTransaction?.publicationLock ?? null;
    const fusedFieldProvenanceAdmitted = !fusedG2p || Boolean(
      fieldExecution === fusedFieldExecution
      && fieldRuntime?.isStatePublicationLockActive?.(
        fieldExecution,
        fusedPublicationLock
      ) === true
      && (fusedTransactionMode === 'coarse-terminal'
        ? validateLocallySubmittedSchroederSpatialParentFieldCoarseTerminalGpu(
            device,
            gridUpdate,
            {
              terminalTransaction: fusedTransaction,
              macroAuthority: fusedTransaction.macroAuthority,
              microepochAuthority: fusedTransaction.microepochAuthority,
              particleContinuation: fusedTransaction.particleContinuation,
              fieldExecution,
              mutationSegment: fusedTransaction.coarseTerminalMutation,
              priorArtifact: previousGridUpdate,
              requireDeferred: true,
              proposalMode: 'proposal-deferred-to-post-mechanics'
            }
          )
        : validateLocallySubmittedSchroederSpatialParentFieldFineCorrectionGpu(
            device,
            gridUpdate,
            {
              transaction: fusedTransaction,
              macroAuthority: fusedTransaction.macroAuthority,
              microepochAuthority: fusedTransaction.microepochAuthority,
              particleContinuation: fusedTransaction.particleContinuation,
              fieldExecution,
              mutationSegment: fusedTransaction.fineCorrectionMutation,
              priorArtifact: previousGridUpdate,
              requireDeferred: true,
              proposalMode: 'proposal-deferred-to-post-mechanics'
            }
          ))
    );
    if (
      mechanicsFieldBinding.mechanicsFieldViewEnabled !== true
      || mechanicsFieldBinding.mechanicsFieldViewBuffer !== mechanicsFieldViewBuffer
      || mechanicsFieldBinding.mechanicsFieldViewExecution
        !== gridUpdate.mechanicsFieldViewExecution
      || (
        gridUpdate.fieldStateUpdateSubmittedInPlace !== true
        && gridUpdate.fieldStateUpdatedInPlace !== true
      )
      || gridUpdate.gridStateAuthority
        !== 'schroeder-spatial-mechanics-field-view-v1'
      || gridUpdate.denseGridAuthoritative !== false
      || !webGpuBufferMatchesDevice(mechanicsFieldViewBuffer, device)
      || gridUpdate.mechanicsFieldMutationOutputStateEncoding
        !== SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT
      || sourceProjection?.mechanicsFieldViewExecution !== fieldExecution
      || mutationLineageMatches !== true
      || (fusedG2p
        ? fusedFieldProvenanceAdmitted !== true
        : fieldRuntime?.isCurrentStateArtifact?.(fieldExecution, {
            mutationOrdinal,
            stateEncoding:
              SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT
          }) !== true)
    ) {
      throw canonicalSpatialExecutionError(
        'mechanics-field-grid-update-provenance-rejected',
        'Required mechanics-field G2P could not authenticate the exact updated field view'
      );
    }
    parentFieldWorkspace =
      gridUpdate.parentFieldMechanicsWorkspaceExecution ?? null;
    if (parentFieldWorkspace) {
      let terminalSubmitted = false;
      let terminalArtifactMatches = false;
      try {
        terminalSubmitted =
          gridUpdate.parentFieldMechanicsTerminalSubmitted === true
          && parentFieldWorkspace.terminalSubmitted === true
          && parentFieldWorkspace.released !== true
          && parentFieldWorkspace.ownerRuntime?.ownsExecution?.(
            parentFieldWorkspace
          ) === true
          && parentFieldWorkspace.ownerRuntime?.isTerminalSubmitted?.(
            parentFieldWorkspace
          ) === true;
        terminalArtifactMatches = parentFieldWorkspace.terminalKind
          === 'fine-correction'
          ? parentFieldWorkspace.fineCorrectedGridUpdate === gridUpdate
            && parentFieldWorkspace.fineGridUpdate === previousGridUpdate
            && parentFieldWorkspace.fineFieldView === fieldExecution
            && parentFieldWorkspace.parentFieldView?.fineFieldView
              === fieldExecution
            && parentFieldWorkspace.parentFieldView?.fineLevel
              === schroederSelectedLevel
          : parentFieldWorkspace.terminalKind === 'coarse-terminal'
            && parentFieldWorkspace.coarseGridUpdate === gridUpdate
            && parentFieldWorkspace.inputCoarseGridUpdate === previousGridUpdate
            && parentFieldWorkspace.coarseFieldView === fieldExecution
            && parentFieldWorkspace.parentFieldView?.coarseFieldView
              === fieldExecution
            && parentFieldWorkspace.parentFieldView?.coarseLevel
              === schroederSelectedLevel;
      } catch {
        terminalSubmitted = false;
        terminalArtifactMatches = false;
      }
      if (!terminalSubmitted || !terminalArtifactMatches) {
        throw canonicalSpatialExecutionError(
          'parent-field-mechanics-terminal-provenance-rejected',
          'Required mechanics-field G2P needs the exact artifact from its live submitted parent-field terminal operation'
        );
      }
    }
  }
  const borrowedGridBuffer = mechanicsFieldRequired
    ? mechanicsFieldViewBuffer
    : (updatedGridBuffer
      || gridUpdate.gpuResult?.updatedGridBuffer
      || gridUpdate.updatedGridBuffer
      || null);
  const crossLevelRefluxBuffer = mechanicsFieldRequired
    ? crossLevelRefluxBindingBuffer(device, parentFieldWorkspace)
    : null;
  assertInputs({
    sphParticleState,
    mlsMpmParticleState,
    gridUpdate,
    requireUpdatedGridNodes: !borrowedGridBuffer
  });
  const stateBuffer = borrowedStateBuffer || ownAllocation(writeStorageBuffer(device, 'ulg-mls-mpm-g2p-sph-state-in', sphParticleState.state));
  const thermoBuffer = borrowedThermoBuffer || ownAllocation(writeStorageBuffer(device, 'ulg-mls-mpm-g2p-sph-thermo-in', sphParticleState.thermo));
  const mechanicsBuffer = borrowedMechanicsBuffer || ownAllocation(writeStorageBuffer(device, 'ulg-mls-mpm-g2p-mechanics-in', mlsMpmParticleState.mechanics));
  const gridBuffer = borrowedGridBuffer || ownAllocation(writeStorageBuffer(device, 'ulg-mls-mpm-g2p-grid-in', gridUpdate.updatedGridNodes));
  const outStateBuffer = createOwnedTaggedBuffer({ label: 'ulg-mls-mpm-g2p-state-out', size: Math.max(4, stateByteLength), usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC });
  const outMechanicsBuffer = createOwnedTaggedBuffer({ label: 'ulg-mls-mpm-g2p-mechanics-out', size: Math.max(4, mechanicsByteLength), usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC });
  const paramsBuffer = !canonicalSpatialAuthority
    ? ownAllocation(device.createBuffer({
        label: 'ulg-mls-mpm-g2p-params',
        size: G2P_PARAMS_BYTES,
        usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
      }))
    : ownAllocation(device.createBuffer({
        label: 'ulg-mls-mpm-g2p-params',
        size: G2P_CANONICAL_PARAMS_BYTES,
        usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
      }));
  const borrowedAssignmentBuffer = canonicalSpatialAuthority
    ? null
    : (schroederLevelAssignment?.assignmentBuffer
        || schroederLevelAssignment?.buffer
        || null);
  const assignmentRows = !canonicalSpatialAuthority
    && schroederLevelAssignment?.assignments instanceof Float32Array
    ? schroederLevelAssignment.assignments
    : null;
  const schroederActiveNodeFilterEnabled = canonicalSpatialAuthority || Boolean(
    (borrowedAssignmentBuffer || assignmentRows)
    && Number.isFinite(Number(schroederSelectedLevel))
  );
  const schroederLevelFilterEnabled = schroederActiveNodeFilterEnabled;
  const ownsSchroederAuthorityBuffer = !canonicalSpatialAuthority
    && !borrowedAssignmentBuffer;
  const schroederAuthorityBuffer = canonicalSpatialAuthority
    ? schroederSpatialAuthority.evidenceBuffer
    : (borrowedAssignmentBuffer || ownAllocation(writeStorageBuffer(
        device,
        schroederActiveNodeFilterEnabled
          ? 'ulg-mls-mpm-g2p-schroeder-level-assignments-in'
          : 'ulg-mls-mpm-g2p-schroeder-level-assignments-dummy',
        assignmentRows || new Float32Array(SCHROEDER_LEVEL_ASSIGNMENT_FLOATS)
      )));
  const schroederLevelFilter = {
    enabled: schroederLevelFilterEnabled,
    selectedLevel: schroederLevelFilterEnabled ? schroederSelectedLevel : null,
    assignmentStrideFloats: SCHROEDER_LEVEL_ASSIGNMENT_FLOATS,
    retainedAssignmentBuffer: !canonicalSpatialAuthority && Boolean(borrowedAssignmentBuffer),
    assignmentBufferByteLength: canonicalSpatialAuthority ? 0 : (assignmentRows?.byteLength ?? 0),
    assignmentBufferSource: canonicalSpatialAuthority
      ? null
      : (borrowedAssignmentBuffer
          ? 'retained-schroeder-level-assignment-buffer'
          : (schroederLevelFilterEnabled
              ? 'uploaded-schroeder-level-assignment-rows'
              : 'dummy-schroeder-level-assignment-row')),
    authorityBindingMode: canonicalSpatialAuthority
      ? 'canonical-spatial-epoch'
      : (schroederLevelFilterEnabled
          ? 'precanonical-level-assignment'
          : 'precanonical-unfiltered'),
    oldLevelAssignmentLookupRemoved: canonicalSpatialAuthority,
    spatialEvidenceEnabled: canonicalSpatialAuthority
      && observeCanonicalSpatialAuthority === true,
    spatialEvidenceBufferByteLength: canonicalSpatialAuthority
      ? SCHROEDER_MECHANICS_SPATIAL_AUTHORITY_EVIDENCE_BYTES
      : 0
  };
  const noFullReadback = readbackMode === NO_FULL_READBACK_MODE;
  const stateReadBuffer = noFullReadback
    ? null
    : ownAllocation(device.createBuffer({ label: 'ulg-mls-mpm-g2p-state-readback', size: Math.max(4, stateByteLength), usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST }));
  const mechanicsReadBuffer = noFullReadback
    ? null
    : ownAllocation(device.createBuffer({ label: 'ulg-mls-mpm-g2p-mechanics-readback', size: Math.max(4, mechanicsByteLength), usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST }));
  try {
    if (fusedG2p) {
      if (!fusedInputsRemainAdmitted()) {
        throw canonicalSpatialExecutionError(
          'fused-g2p-provenance-lost-before-encoding',
          'Fused G2P lost its exact terminal artifact or continuation before encoding'
        );
      }
      if (fusedG2pClaims.get(fusedTransaction) !== fusedG2pClaim) {
        throw canonicalSpatialExecutionError(
          'fused-g2p-transaction-claim-lost',
          'Fused G2P lost its exact producer claim before encoding'
        );
      }
    }
    const paramsOptions = {
      particleCount: sphParticleState.particleCount,
      gridUpdate,
      dt: dtSeconds,
      boxDimsM: dims,
      internalPressureScale,
      liquidWallDampingAlpha,
      liquidWallDampingDistanceM,
      schroederActiveNodeFilterEnabled,
      schroederLevelFilterEnabled,
      schroederSelectedLevel: schroederLevelFilterEnabled
        ? Math.round(Number(schroederSelectedLevel))
        : -1,
      schroederSpatialDirectory: schroederSpatialAuthority,
      spatialEvidenceEnabled: canonicalSpatialAuthority
        && observeCanonicalSpatialAuthority === true
    };
    if (!canonicalSpatialAuthority) {
      device.queue.writeBuffer(paramsBuffer, 0, createParamsArray(paramsOptions));
    } else {
      device.queue.writeBuffer(paramsBuffer, 0, createCanonicalParamsArray(paramsOptions));
    }
    if (!fusedProducerClaimRemainsExact()) {
      throw canonicalSpatialExecutionError(
        'fused-g2p-provenance-lost-after-params-write',
        'Fused G2P lost its frozen input family or exact producer claim after parameter upload'
      );
    }
    const g2pShader = canonicalSpatialAuthority
      ? (observeCanonicalSpatialAuthority === true
          ? (mechanicsFieldRequired
              ? mechanicsFieldKernelBundle
                .mlsMpmG2pReconstructCanonicalSpatialMechanicsFieldWgsl
              : mlsMpmG2pReconstructCanonicalSpatialWgsl)
          : (mechanicsFieldRequired
              ? mechanicsFieldKernelBundle
                .mlsMpmG2pReconstructCanonicalSpatialUnobservedMechanicsFieldWgsl
              : mlsMpmG2pReconstructCanonicalSpatialUnobservedWgsl))
      : mlsMpmG2pReconstructWgsl;
    const g2pVariant = canonicalSpatialAuthority
      ? `canonical-spatial-epoch.${mechanicsFieldRequired ? 'field.v3-reflux' : 'v7'}.${observeCanonicalSpatialAuthority === true
          ? 'observed'
          : 'unobserved'}`
      : 'precanonical-level-assignment.v5';
    const g2pBindings = [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, mechanicsFieldRequired
        ? 'storage'
        : 'read-only-storage'),
      computeBufferBinding(2, 'read-only-storage'),
      computeBufferBinding(3, mechanicsFieldRequired
        ? 'storage'
        : 'read-only-storage'),
      computeBufferBinding(4, 'storage'),
      computeBufferBinding(5, 'storage'),
      computeBufferBinding(6, 'uniform'),
      computeBufferBinding(7, canonicalSpatialAuthority ? 'storage' : 'read-only-storage'),
      ...(canonicalSpatialAuthority ? [computeBufferBinding(8, 'read-only-storage')] : [])
    ];
    const { pipeline, bindGroupLayout } = createCachedExplicitComputePipeline(device, {
      cacheKey: `ulg-mls-mpm-g2p-reconstruct.${g2pVariant}`,
      label: 'ulg-mls-mpm-g2p-reconstruct',
      code: g2pShader,
      entryPoint: 'main',
      bindings: g2pBindings
    });
    const canonicalFinalize = canonicalSpatialAuthority
      ? createCachedExplicitComputePipeline(device, {
        cacheKey: `ulg-mls-mpm-g2p-reconstruct.finalize-authority.${g2pVariant}`,
        label: 'ulg-mls-mpm-g2p-finalize-spatial-authority',
        code: g2pShader,
        entryPoint: 'finalize_canonical_spatial_authority',
        bindings: g2pBindings
      })
      : null;
    const energyReceiptPipelines = mechanicsFieldRequired
      ? [
          ['claim', 'claim_g2p_energy_receipt'],
          ['measure', 'measure_g2p_energy_receipt'],
          ['consume-field', 'consume_g2p_energy_receipt'],
          ['consume-fine-reflux', 'consume_g2p_fine_reflux_receipt'],
          ['consume-coarse-reflux', 'consume_g2p_coarse_reflux_receipt']
        ].map(([stage, entryPoint]) => createCachedExplicitComputePipeline(device, {
          cacheKey: `ulg-mls-mpm-g2p-reconstruct.field-energy-${stage}.v2`,
          label: `ulg-mls-mpm-g2p-field-energy-${stage}`,
          code: g2pShader,
          entryPoint,
          bindings: g2pBindings
        }))
      : [];
    const g2pEntries = [
      { binding: 0, resource: { buffer: stateBuffer } },
      { binding: 1, resource: { buffer: mechanicsFieldRequired
        ? crossLevelRefluxBuffer
        : thermoBuffer } },
      { binding: 2, resource: { buffer: mechanicsBuffer } },
      { binding: 3, resource: { buffer: gridBuffer } },
      { binding: 4, resource: { buffer: outStateBuffer } },
      { binding: 5, resource: { buffer: outMechanicsBuffer } },
      { binding: 6, resource: { buffer: paramsBuffer } },
      { binding: 7, resource: { buffer: schroederAuthorityBuffer } },
      ...(canonicalSpatialAuthority
        ? [{ binding: 8, resource: { buffer: schroederSpatialAuthority.directoryBuffer } }]
        : [])
    ];
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: g2pEntries
    });
    const canonicalFinalizeBindGroup = canonicalFinalize
      ? device.createBindGroup({
        layout: canonicalFinalize.bindGroupLayout,
        entries: g2pEntries
      })
      : null;
    const energyReceiptBindGroups = energyReceiptPipelines.map(
      (pipelineInfo) => device.createBindGroup({
        layout: pipelineInfo.bindGroupLayout,
        entries: g2pEntries
      })
    );
    const encoder = device.createCommandEncoder();
    if (mechanicsFieldRequired) {
      const claimReceiptPass = encoder.beginComputePass();
      claimReceiptPass.setPipeline(energyReceiptPipelines[0].pipeline);
      claimReceiptPass.setBindGroup(0, energyReceiptBindGroups[0]);
      claimReceiptPass.dispatchWorkgroups(1);
      claimReceiptPass.end();
    }
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.max(1, Math.ceil(sphParticleState.particleCount / 64)));
    pass.end();
    let separation;
    if (canonicalSpatialAuthority) {
      if (fusedG2p) {
        separation = {
          enabled: false,
          transientBuffers: [],
          scratch: null,
          canonicalSpatialAuthorityGate: true,
          canonicalAuthorityRestoreFolded: false,
          canonicalSpatialAuthorityEvidenceObserved:
            observeCanonicalSpatialAuthority === true,
          canonicalProposalSource: 'deferred-to-post-mechanics',
          privateBinBuildCount: 0,
          fixedCandidateBuildCount: 0,
          exhaustiveParticleScanCount: 0
        };
      } else {
        if (
        !canonicalMechanicalProposalAdmitted({
          proposal: schroederSpatialMechanicalProposal,
          generation: schroederSpatialEpochGeneration,
          spatialAuthority: schroederSpatialAuthority,
          device
        })
        ) {
          throw new Error(
            'Canonical G2P requires one authenticated pre-integration contact/separation proposal'
          );
        }
        schroederSpatialMechanicalProposal.encodeApply(encoder, {
          stateBuffer: outStateBuffer,
          mechanicsBuffer,
          selectedLevel: schroederSelectedLevel
        });
        separation = {
          enabled: true,
          transientBuffers: [],
          scratch: null,
          canonicalSpatialAuthorityGate: true,
          canonicalAuthorityRestoreFolded: false,
          canonicalSpatialAuthorityEvidenceObserved:
            observeCanonicalSpatialAuthority === true,
          canonicalProposalSource: 'pre-integration-ss-spatial-epoch.v1',
          privateBinBuildCount: 0,
          fixedCandidateBuildCount: 0,
          exhaustiveParticleScanCount: 0
        };
      }
    } else {
      separation = encodeMlsMpmParticleSeparationPasses(device, encoder, {
        stateBuffer: outStateBuffer,
        mechanicsBuffer: outMechanicsBuffer,
        particleCount: sphParticleState.particleCount,
        boxDimsM: dims,
        relaxation: particleSeparationRelaxation,
        normalVelocityDamping: particleSeparationVelocityDamping,
        maxPairRestDistanceM: maxSeparationRestDistanceM(
          mlsMpmParticleState.mechanics,
          sphParticleState.particleCount
        ),
        gridSpacingM: gridUpdate.gridSpacingM
      });
    }
    separationTransientBuffers = separation.transientBuffers;
    for (const transientBuffer of separationTransientBuffers) {
      ownAllocation(transientBuffer);
    }
    if (mechanicsFieldRequired) {
      const measureReceiptPass = encoder.beginComputePass();
      measureReceiptPass.setPipeline(energyReceiptPipelines[1].pipeline);
      measureReceiptPass.setBindGroup(0, energyReceiptBindGroups[1]);
      measureReceiptPass.dispatchWorkgroups(
        Math.max(1, Math.ceil(sphParticleState.particleCount / 64))
      );
      measureReceiptPass.end();
      for (let receiptStage = 2;
        receiptStage < energyReceiptPipelines.length;
        receiptStage += 1) {
        const consumeReceiptPass = encoder.beginComputePass();
        consumeReceiptPass.setPipeline(
          energyReceiptPipelines[receiptStage].pipeline
        );
        consumeReceiptPass.setBindGroup(
          0,
          energyReceiptBindGroups[receiptStage]
        );
        consumeReceiptPass.dispatchWorkgroups(1);
        consumeReceiptPass.end();
      }
    }
    // Receipt consumption can reject a candidate after the particle pass.
    // Restore from the canonical input only after every receipt stage so the
    // caller can never observe a failed transaction's output buffers.
    if (canonicalFinalize && separation.canonicalAuthorityRestoreFolded !== true) {
      const finalizePass = encoder.beginComputePass();
      finalizePass.setPipeline(canonicalFinalize.pipeline);
      finalizePass.setBindGroup(0, canonicalFinalizeBindGroup);
      finalizePass.dispatchWorkgroups(
        Math.max(1, Math.ceil(sphParticleState.particleCount / 64))
      );
      finalizePass.end();
    }
    if (!noFullReadback) {
      encoder.copyBufferToBuffer(outStateBuffer, 0, stateReadBuffer, 0, Math.max(4, stateByteLength));
      encoder.copyBufferToBuffer(outMechanicsBuffer, 0, mechanicsReadBuffer, 0, Math.max(4, mechanicsByteLength));
    }
    const commandBuffer = encoder.finish();
    if (!fusedProducerClaimRemainsExact()) {
      throw canonicalSpatialExecutionError(
        'fused-g2p-provenance-lost-before-submit',
        'Fused G2P lost its frozen input family or exact producer claim after command encoding'
      );
    }
    device.queue.submit([commandBuffer]);
    fusedG2pQueueSubmitted = true;
    if (fusedG2p) {
      if (fusedTransactionMode === 'coarse-terminal') {
        markSchroederFusedCoarseTerminalStageSubmissionObserved(
          device,
          fusedTransaction,
          {
            stage: 'g2p',
            producerCapability: fusedStageProducerCapability
          }
        );
      } else {
        markSchroederFusedFineSubstepStageSubmissionObserved(
          device,
          fusedTransaction,
          {
            stage: 'g2p',
            producerCapability: fusedStageProducerCapability
          }
        );
      }
    }
    if (!fusedProducerClaimRemainsExact({ submissionObserved: true })) {
      throw canonicalSpatialExecutionError(
        'fused-g2p-provenance-lost-after-submit',
        'Fused G2P lost its frozen input family before exact fused artifact publication'
      );
    }
    let state = new Float32Array();
    let mechanics = new Float32Array();
    if (!noFullReadback) {
      await stateReadBuffer.mapAsync(GPU_MAP_MODE.READ);
      await mechanicsReadBuffer.mapAsync(GPU_MAP_MODE.READ);
      state = new Float32Array(stateReadBuffer.getMappedRange()).slice(0, sphParticleState.state.length);
      mechanics = new Float32Array(mechanicsReadBuffer.getMappedRange()).slice(0, mlsMpmParticleState.mechanics.length);
      stateReadBuffer.unmap();
      mechanicsReadBuffer.unmap();
    }
    const reconstruction = outputEnvelope({
      backend: 'webgpu',
      sphParticleState,
      mlsMpmParticleState,
      gridUpdate,
      state,
      mechanics,
      dt: dtSeconds,
      boxDimsM: dims,
      internalPressureScale,
      readbackMode: noFullReadback ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE,
      schroederSpatialAuthority: schroederSpatialAuthorityMetadata(
        schroederSpatialAuthority
      ),
      schroederLevelFilter,
      separationCanonicalSpatialAuthorityGate:
        separation.canonicalSpatialAuthorityGate === true
    });
    reconstruction.mechanicsFieldMode = mechanicsFieldMode;
    if (retainOutputParticleBuffers) {
      reconstruction.stateBuffer = outStateBuffer;
      reconstruction.mechanicsBuffer = outMechanicsBuffer;
      reconstruction.stateBufferByteLength = stateByteLength;
      reconstruction.mechanicsBufferByteLength = mechanicsByteLength;
      reconstruction.retainedOutputParticleBuffers = true;
      reconstruction.destroyOutputParticleBufferComponents = ({
        state = false,
        mechanics = false
      } = {}) => {
        if (state !== true && mechanics !== true) return false;
        const origin = fusedG2pOrigins.get(reconstruction);
        if (origin && ![
          'producer',
          'producer-retiring'
        ].includes(origin.outputOwnership)) return false;
        const errors = [];
        for (let attempt = 0; attempt < 2; attempt += 1) {
          if (state === true && !outputStateBufferDestroyed) {
            try {
              outStateBuffer.destroy?.();
              outputStateBufferDestroyed = true;
              if (origin) origin.outputStateRetired = true;
            } catch (error) {
              errors.push(error);
            }
          }
          if (mechanics === true && !outputMechanicsBufferDestroyed) {
            try {
              outMechanicsBuffer.destroy?.();
              outputMechanicsBufferDestroyed = true;
              if (origin) origin.outputMechanicsRetired = true;
            } catch (error) {
              errors.push(error);
            }
          }
        }
        if (outputStateBufferDestroyed && outputMechanicsBufferDestroyed) {
          outputParticleBuffersDestroyed = true;
          if (origin) origin.destroyed = true;
        }
        const requestedComplete = (state !== true || outputStateBufferDestroyed)
          && (mechanics !== true || outputMechanicsBufferDestroyed);
        if (requestedComplete) return true;
        throw errors.length === 1
          ? errors[0]
          : new AggregateError(
              errors,
              'retained G2P output component destruction was incomplete'
            );
      };
      reconstruction.destroyOutputParticleBuffers = () => {
        if (outputParticleBuffersDestroyed) return false;
        return reconstruction.destroyOutputParticleBufferComponents({
          state: true,
          mechanics: true
        });
      };
      if (!fusedG2p) returnedRetainedOutputBuffers = true;
    }
    if (fusedG2p) {
      Object.defineProperties(reconstruction, {
        stateBuffer: {
          value: outStateBuffer,
          enumerable: true,
          configurable: false,
          writable: false
        },
        mechanicsBuffer: {
          value: outMechanicsBuffer,
          enumerable: true,
          configurable: false,
          writable: false
        },
        stateBufferByteLength: {
          value: stateByteLength,
          enumerable: true,
          configurable: false,
          writable: false
        },
        mechanicsBufferByteLength: {
          value: mechanicsByteLength,
          enumerable: true,
          configurable: false,
          writable: false
        },
        retainedOutputParticleBuffers: {
          value: true,
          enumerable: true,
          configurable: false,
          writable: false
        },
        ...(fusedTransactionMode === 'coarse-terminal'
          ? {
              fusedCoarseTerminalTransaction: {
                value: fusedTransaction,
                enumerable: false,
                configurable: false,
                writable: false
              },
              terminalMicroepochAuthority: {
                value: fusedTransaction.microepochAuthority,
                enumerable: false,
                configurable: false,
                writable: false
              }
            }
          : {
              fusedFineSubstepTransaction: {
                value: fusedTransaction,
                enumerable: false,
                configurable: false,
                writable: false
              },
              fineMicroepochAuthority: {
                value: fusedTransaction.microepochAuthority,
                enumerable: false,
                configurable: false,
                writable: false
              }
            }),
        sourceGridUpdate: {
          value: gridUpdate,
          enumerable: true,
          configurable: false,
          writable: false
        },
        sourceParticleContinuation: {
          value: fusedTransaction.particleContinuation,
          enumerable: false,
          configurable: false,
          writable: false
        },
        proposalMode: {
          value: 'proposal-deferred-to-post-mechanics',
          enumerable: true,
          configurable: false,
          writable: false
        },
        mechanicalProposalApplied: {
          value: false,
          enumerable: true,
          configurable: false,
          writable: false
        },
        liquidWallDampingAlpha: {
          value: Number(liquidWallDampingAlpha),
          enumerable: true,
          configurable: false,
          writable: false
        },
        liquidWallDampingDistanceM: {
          value: Number(liquidWallDampingDistanceM),
          enumerable: true,
          configurable: false,
          writable: false
        },
        schroederSelectedLevel: {
          value: schroederSelectedLevel,
          enumerable: true,
          configurable: false,
          writable: false
        },
        schroederSpatialEpochGeneration: {
          value: schroederSpatialEpochGeneration,
          enumerable: false,
          configurable: false,
          writable: false
        }
      });
      fusedG2pArtifact = reconstruction;
      try {
        registerSubmittedFusedG2p(device, reconstruction, {
          transaction: fusedTransaction,
          transactionMode: fusedTransactionMode,
          sourceGridUpdate: gridUpdate,
          sphParticleUpload,
          mlsMpmParticleUpload,
          canonicalGeneration: schroederSpatialEpochGeneration,
          selectedLevel: schroederSelectedLevel,
          inputStateBuffer: borrowedStateBuffer,
          thermoBuffer: borrowedThermoBuffer,
          identityBuffer: sphParticleUpload.identityBuffer ?? null,
          inputMechanicsBuffer: borrowedMechanicsBuffer,
          outputStateBuffer: outStateBuffer,
          outputMechanicsBuffer: outMechanicsBuffer,
          internalPressureScale: Number(internalPressureScale),
          liquidWallDampingAlpha: Number(liquidWallDampingAlpha),
          liquidWallDampingDistanceM: Number(liquidWallDampingDistanceM)
        });
        if (fusedTransactionMode === 'coarse-terminal') {
          markSchroederFusedCoarseTerminalStageSubmitted(
            device,
            fusedTransaction,
            {
              stage: 'g2p',
              artifact: reconstruction,
              priorArtifact: gridUpdate,
              producerCapability: fusedStageProducerCapability
            }
          );
        } else {
          markSchroederFusedFineSubstepStageSubmitted(
            device,
            fusedTransaction,
            {
              stage: 'g2p',
              artifact: reconstruction,
              priorArtifact: gridUpdate,
              producerCapability: fusedStageProducerCapability
            }
          );
        }
        fusedG2pArtifactLifecycleDelegated = true;
        fusedStageProducerCapability = null;
        returnedRetainedOutputBuffers = true;
        if (!validateLocallySubmittedMlsMpmFusedG2p(
          device,
          reconstruction,
          {
            ...(fusedTransactionMode === 'coarse-terminal'
              ? { terminalTransaction: fusedTransaction }
              : { transaction: fusedTransaction }),
            macroAuthority: fusedTransaction.macroAuthority,
            microepochAuthority: fusedTransaction.microepochAuthority,
            particleContinuation: fusedTransaction.particleContinuation,
            fieldExecution: fusedTransactionMode === 'coarse-terminal'
              ? fusedTransaction.coarseFieldView
              : fusedTransaction.fineFieldView,
            priorArtifact: gridUpdate,
            proposalMode: 'proposal-deferred-to-post-mechanics'
          }
        )) {
          throw canonicalSpatialExecutionError(
            'fused-g2p-publication-provenance-lost',
            'Fused G2P lost its exact input or output family during lifecycle publication'
          );
        }
        fusedG2pCommitted = true;
      } catch (error) {
        if (!fusedG2pArtifactLifecycleDelegated) {
          fusedG2pOrigins.delete(reconstruction);
        }
        throw error;
      }
    }
    return reconstruction;
  } finally {
    if (fusedG2p && fusedG2pClaim && !fusedG2pCommitted) {
      if (fusedG2pArtifact && !fusedG2pArtifactLifecycleDelegated) {
        fusedG2pOrigins.delete(fusedG2pArtifact);
      }
      if (fusedG2pQueueSubmitted) {
        try {
          const reason = new Error(
            'G2P submitted before exact fused artifact publication'
          );
          if (fusedTransactionMode === 'coarse-terminal') {
            quarantineSchroederFusedCoarseTerminalTransaction(
              device,
              fusedTransaction,
              reason
            );
          } else {
            quarantineSchroederFusedFineSubstepTransaction(
              device,
              fusedTransaction,
              reason
            );
          }
        } catch {
          // Preserve the originating post-submit failure.
        }
        fusedStageProducerCapability = null;
      } else if (fusedStageProducerCapability != null) {
        try {
          if (fusedTransactionMode === 'coarse-terminal') {
            releaseSchroederFusedCoarseTerminalStageProducer(
              device,
              fusedTransaction,
              fusedStageProducerCapability
            );
          } else {
            releaseSchroederFusedFineSubstepStageProducer(
              device,
              fusedTransaction,
              fusedStageProducerCapability
            );
          }
          fusedStageProducerCapability = null;
        } catch {
          // Preserve the originating pre-submit failure.
        }
      }
    }
    const cleanup = () => {
      if (!borrowedStateBuffer) destroyOwnedAllocation(stateBuffer);
      if (!borrowedThermoBuffer) destroyOwnedAllocation(thermoBuffer);
      if (!borrowedMechanicsBuffer) destroyOwnedAllocation(mechanicsBuffer);
      if (!borrowedGridBuffer) destroyOwnedAllocation(gridBuffer);
      if (!retainOutputParticleBuffers || !returnedRetainedOutputBuffers) {
        if (!outputParticleBuffersDestroyed) {
          outputParticleBuffersDestroyed = true;
          destroyOwnedAllocation(outStateBuffer);
          destroyOwnedAllocation(outMechanicsBuffer);
        }
      } else {
        allocationLedger.delete(outStateBuffer);
        allocationLedger.delete(outMechanicsBuffer);
      }
      if (ownsSchroederAuthorityBuffer) {
        destroyOwnedAllocation(schroederAuthorityBuffer);
      }
      destroyOwnedAllocation(paramsBuffer);
      for (const transientBuffer of separationTransientBuffers) {
        destroyOwnedAllocation(transientBuffer);
      }
      destroyOwnedAllocation(stateReadBuffer);
      destroyOwnedAllocation(mechanicsReadBuffer);
      destroyAllocationLedger();
    };
    if (noFullReadback && fusedG2pQueueSubmitted) {
      try {
        allocationCleanupDelegated =
          deferSubmittedWorkCleanup(device, cleanup) === true;
      } catch {
        allocationCleanupDelegated = false;
        cleanup();
      }
    } else {
      cleanup();
    }
  }
  } finally {
    if (
      fusedG2p
      && fusedStageProducerCapability != null
      && fusedG2pQueueSubmitted !== true
    ) {
      try {
        if (fusedTransactionMode === 'coarse-terminal') {
          releaseSchroederFusedCoarseTerminalStageProducer(
            device,
            fusedTransaction,
            fusedStageProducerCapability
          );
        } else {
          releaseSchroederFusedFineSubstepStageProducer(
            device,
            fusedTransaction,
            fusedStageProducerCapability
          );
        }
        fusedStageProducerCapability = null;
      } catch {
        // Preserve the originating pre-submit allocation/admission failure.
      }
    }
    if (
      fusedG2pClaim
      && fusedG2pClaims.get(fusedTransaction) === fusedG2pClaim
    ) {
      fusedG2pClaims.delete(fusedTransaction);
    }
    if (!allocationCleanupDelegated) destroyAllocationLedger();
  }
}

function createNoFullReadbackParityReport(tolerance = 5e-2) {
  return {
    schema: ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_PARITY_SCHEMA,
    status: 'not-run-no-full-readback',
    tolerance,
    maxStateAbs: null,
    maxMechanicsAbs: null,
    lengthMismatch: null,
    reason: 'Full G2P particle readback and CPU parity were skipped for resident WebGPU execution',
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

function createCanonicalSpatialParityReport(tolerance = 5e-2) {
  return {
    schema: ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_PARITY_SCHEMA,
    status: 'not-run-canonical-spatial-authority',
    tolerance,
    maxStateAbs: null,
    maxMechanicsAbs: null,
    lengthMismatch: null,
    reason: 'Unfiltered CPU G2P is not a valid oracle for canonical directory authority',
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

function canonicalSpatialExecutionError(status, reason, cause = null) {
  const error = new Error(`Canonical MLS-MPM G2P execution rejected: ${reason}`);
  error.code = 'ERR_CANONICAL_SPATIAL_AUTHORITY_REJECTED';
  error.status = status;
  if (cause != null) error.cause = cause;
  return error;
}

export function createMlsMpmG2pParityReport({ cpuReference, gpuResult, tolerance = 5e-2 } = {}) {
  if (!(cpuReference?.state instanceof Float32Array) || !(gpuResult?.state instanceof Float32Array)) {
    return { schema: ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_PARITY_SCHEMA, status: 'fail', tolerance, maxStateAbs: Infinity, maxMechanicsAbs: Infinity, lengthMismatch: true, scientificValidation: false, sphValidation: false, phaseChangeValidation: false, fullPhysicsValidation: false };
  }
  const stateCount = Math.min(cpuReference.state.length, gpuResult.state.length);
  const mechanicsCount = Math.min(cpuReference.mechanics.length, gpuResult.mechanics.length);
  let maxStateAbs = 0;
  let maxMechanicsAbs = 0;
  for (let i = 0; i < stateCount; i += 1) maxStateAbs = Math.max(maxStateAbs, Math.abs(cpuReference.state[i] - gpuResult.state[i]));
  for (let i = 0; i < mechanicsCount; i += 1) maxMechanicsAbs = Math.max(maxMechanicsAbs, Math.abs(cpuReference.mechanics[i] - gpuResult.mechanics[i]));
  const lengthMismatch = cpuReference.state.length !== gpuResult.state.length || cpuReference.mechanics.length !== gpuResult.mechanics.length;
  return {
    schema: ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_PARITY_SCHEMA,
    status: !lengthMismatch && maxStateAbs <= tolerance && maxMechanicsAbs <= tolerance ? 'pass' : 'fail',
    tolerance,
    maxStateAbs,
    maxMechanicsAbs,
    lengthMismatch,
    particleCount: cpuReference.particleCount ?? gpuResult.particleCount ?? 0,
    cpuBackend: cpuReference.backend,
    gpuBackend: gpuResult.backend,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

function executionFromReconstruction(reconstruction, { cpuReference = null, gpuResult = null, webgpuStatus, webgpuParity = null } = {}) {
  return {
    schema: ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_EXECUTION_SCHEMA,
    reconstructionSchema: reconstruction?.schema || ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_SCHEMA,
    backend: reconstruction?.backend || 'cpu-reference',
    status: reconstruction?.status || 'reconstructed',
    kernelScope: G2P_SCOPE,
    particleCount: reconstruction?.particleCount ?? 0,
    gridNodeCount: reconstruction?.gridNodeCount ?? 0,
    gridSpacingM: reconstruction?.gridSpacingM ?? 0,
    gridDims: reconstruction?.gridDims ?? [],
    gridShift: reconstruction?.gridShift ?? 1,
    dt: reconstruction?.dt ?? 0,
    internalPressureScale: reconstruction?.internalPressureScale ?? 1,
    stateStrideFloats: SPH_GPU_PARTICLE_STATE_FLOATS,
    mechanicsStrideFloats: MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
    state: reconstruction?.state ?? new Float32Array(),
    mechanics: reconstruction?.mechanics ?? new Float32Array(),
    stateBuffer: reconstruction?.stateBuffer ?? null,
    mechanicsBuffer: reconstruction?.mechanicsBuffer ?? null,
    stateBufferByteLength: reconstruction?.stateBufferByteLength ?? 0,
    mechanicsBufferByteLength: reconstruction?.mechanicsBufferByteLength ?? 0,
    retainedOutputParticleBuffers: Boolean(reconstruction?.retainedOutputParticleBuffers),
    destroyOutputParticleBuffers: reconstruction?.destroyOutputParticleBuffers ?? null,
    destroyOutputParticleBufferComponents:
      reconstruction?.destroyOutputParticleBufferComponents ?? null,
    readbackMode: reconstruction?.readbackMode ?? FULL_READBACK_MODE,
    fullReadbackPerformed: reconstruction?.fullReadbackPerformed ?? true,
    normalHotLoopReadbackFree: reconstruction?.normalHotLoopReadbackFree ?? false,
    particleScaleStability: reconstruction?.particleScaleStability ?? null,
    particleScaleStabilitySchema: reconstruction?.particleScaleStabilitySchema ?? null,
    particleScaleStabilityStatus: reconstruction?.particleScaleStabilityStatus ?? null,
    particleScalePolicyAppliedInG2p: reconstruction?.particleScalePolicyAppliedInG2p === true,
    particleScaleMaxVolumeRatioJAllowed: reconstruction?.particleScaleMaxVolumeRatioJAllowed ?? null,
    particleScaleMaxRadiusGrowthRatioAllowed: reconstruction?.particleScaleMaxRadiusGrowthRatioAllowed ?? null,
    schroederSpatialAuthority: reconstruction?.schroederSpatialAuthority ?? null,
    schroederSpatialAuthorityEnabled:
      reconstruction?.schroederSpatialAuthorityEnabled === true,
    schroederSpatialAuthorityStatus:
      reconstruction?.schroederSpatialAuthorityStatus ?? null,
    schroederLevelFilter: reconstruction?.schroederLevelFilter ?? null,
    schroederAuthorityBindingMode:
      reconstruction?.schroederAuthorityBindingMode ?? 'precanonical-unfiltered',
    oldLevelAssignmentLookupRemoved:
      reconstruction?.oldLevelAssignmentLookupRemoved === true,
    separationCanonicalSpatialAuthorityGate:
      reconstruction?.separationCanonicalSpatialAuthorityGate === true,
    mechanicsFieldMode:
      reconstruction?.mechanicsFieldMode ?? MLS_MPM_MECHANICS_FIELD_MODE_DISABLED,
    mechanicsFieldViewEnabled:
      reconstruction?.mechanicsFieldViewEnabled === true,
    mechanicsFieldViewExecution:
      reconstruction?.mechanicsFieldViewExecution ?? null,
    mechanicsFieldViewBuffer:
      reconstruction?.mechanicsFieldViewBuffer ?? null,
    mechanicsFieldViewByteLength:
      reconstruction?.mechanicsFieldViewByteLength ?? 0,
    mechanicsFieldViewOwned: false,
    gridStateAuthority:
      reconstruction?.gridStateAuthority ?? 'dense-mls-mpm-grid-state',
    denseGridAuthoritative:
      reconstruction?.denseGridAuthoritative !== false,
    cpuReference,
    gpuResult,
    webgpuStatus,
    webgpuParity,
    p2gProjectionValidation: false,
    stressProjectionValidation: false,
    gridUpdateValidation: false,
    g2pValidation: false,
    gridValidation: false,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
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

export async function runMlsMpmG2pWithOptionalWebGpu({
  sphParticleState,
  mlsMpmParticleState,
  gridUpdate,
  sphParticleUpload = null,
  mlsMpmParticleUpload = null,
  updatedGridBuffer = null,
  dt = gridUpdate?.dt ?? mlsMpmParticleState?.mechanicsDtS ?? 0,
  boxDimsM = DEFAULT_BOX_DIMS_M,
  internalPressureScale = 1,
  liquidWallDampingAlpha = mlsMpmParticleState?.liquidWallDampingAlpha ?? 0,
  liquidWallDampingDistanceM = mlsMpmParticleState?.liquidWallDampingDistanceM ?? 0,
  particleSeparationRelaxation = mlsMpmParticleState?.particleSeparationRelaxation
    ?? MLS_MPM_PARTICLE_SEPARATION_RELAXATION_DEFAULT,
  particleSeparationVelocityDamping = mlsMpmParticleState?.particleSeparationVelocityDamping
    ?? MLS_MPM_PARTICLE_SEPARATION_VELOCITY_DAMPING_DEFAULT,
  schroederLevelAssignment = null,
  schroederSelectedLevel = null,
  schroederSpatialEpochGeneration = null,
  schroederSpatialMechanicalProposal = null,
  fusedFineSubstepTransaction = null,
  fusedCoarseTerminalTransaction = null,
  canonicalSpatialRequired = false,
  observeCanonicalSpatialAuthority = false,
  mechanicsFieldMode = gridUpdate?.mechanicsFieldMode
    ?? MLS_MPM_MECHANICS_FIELD_MODE_DISABLED,
  preferWebGpu = false,
  navigatorRef = globalThis.navigator,
  device = null,
  deviceResult = null,
  parityTolerance = 5e-2,
  retainOutputParticleBuffers = false,
  onDeviceLost = null,
  webGpuRunner = runMlsMpmG2pWebGpu,
  readbackMode = FULL_READBACK_MODE
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
  let cpuReference = null;
  const getCpuReference = () => {
    if (!cpuReference) {
      cpuReference = reconstructMlsMpmG2pCpu({
        sphParticleState,
        mlsMpmParticleState,
        gridUpdate,
        dt,
        boxDimsM,
        internalPressureScale,
        liquidWallDampingAlpha,
        liquidWallDampingDistanceM,
        particleSeparationRelaxation,
        particleSeparationVelocityDamping
      });
    }
    return cpuReference;
  };
  if (!preferWebGpu) {
    if (canonicalSpatialIntent) {
      throw canonicalSpatialExecutionError(
        'canonical-spatial-webgpu-not-requested',
        'canonical directory authority cannot fall back to unfiltered CPU G2P'
      );
    }
    const reference = getCpuReference();
    return executionFromReconstruction(reference, { cpuReference: reference, webgpuStatus: { status: 'not-requested', reason: 'WebGPU MLS-MPM G2P path not requested' } });
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
      return executionFromReconstruction(reference, { cpuReference: reference, webgpuStatus: { status: resolvedDeviceResult.status, reason: resolvedDeviceResult.reason, fallback: 'cpu-reference' } });
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
      return executionFromReconstruction(reference, { cpuReference: reference, webgpuStatus: { status: 'webgpu-device-lost-fallback', reason: describeDeviceLost(lostInfo), fallback: 'cpu-reference' } });
    }
    const gpuResult = await webGpuRunner({
      device: resolvedDeviceResult.device,
      sphParticleState,
      mlsMpmParticleState,
      gridUpdate,
      sphParticleUpload,
      mlsMpmParticleUpload,
      updatedGridBuffer,
      dt,
      boxDimsM,
      internalPressureScale,
      liquidWallDampingAlpha,
      liquidWallDampingDistanceM,
      particleSeparationRelaxation,
      particleSeparationVelocityDamping,
      schroederLevelAssignment,
      schroederSelectedLevel,
      schroederSpatialEpochGeneration,
      schroederSpatialMechanicalProposal,
      fusedFineSubstepTransaction,
      fusedCoarseTerminalTransaction,
      canonicalSpatialRequired,
      observeCanonicalSpatialAuthority,
      mechanicsFieldMode,
      retainOutputParticleBuffers,
      readbackMode: noFullReadback ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE
    });
    await Promise.resolve();
    if (lostInfo) {
      gpuResult.destroyOutputParticleBuffers?.();
      if (canonicalSpatialIntent) {
        throw canonicalSpatialExecutionError(
          'canonical-spatial-webgpu-device-lost',
          describeDeviceLost(lostInfo)
        );
      }
      const reference = getCpuReference();
      return executionFromReconstruction(reference, { cpuReference: reference, gpuResult, webgpuStatus: { status: 'webgpu-device-lost-fallback', reason: describeDeviceLost(lostInfo), fallback: 'cpu-reference' } });
    }
    if (noFullReadback) {
      return executionFromReconstruction(gpuResult, {
        cpuReference: null,
        gpuResult,
        webgpuStatus: {
          status: 'webgpu-executed-no-full-readback',
          reason: 'WebGPU MLS-MPM G2P executed without full particle readback'
        },
        webgpuParity: createNoFullReadbackParityReport(parityTolerance)
      });
    }
    if (canonicalSpatialIntent) {
      return executionFromReconstruction(gpuResult, {
        cpuReference: null,
        gpuResult,
        webgpuStatus: {
          status: 'webgpu-executed-canonical-spatial-authority',
          reason: 'Canonical directory-authoritative G2P executed without CPU fallback'
        },
        webgpuParity: createCanonicalSpatialParityReport(parityTolerance)
      });
    }
    const reference = getCpuReference();
    const webgpuParity = createMlsMpmG2pParityReport({ cpuReference: reference, gpuResult, tolerance: parityTolerance });
    if (webgpuParity.status !== 'pass') {
      gpuResult.destroyOutputParticleBuffers?.();
      return executionFromReconstruction(reference, { cpuReference: reference, gpuResult, webgpuStatus: { status: 'webgpu-parity-failed', reason: 'CPU/WebGPU MLS-MPM G2P parity exceeded tolerance', fallback: 'cpu-reference' }, webgpuParity });
    }
    return executionFromReconstruction(gpuResult, { cpuReference: reference, gpuResult, webgpuStatus: { status: 'webgpu-executed', reason: 'CPU/WebGPU MLS-MPM G2P parity passed' }, webgpuParity });
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
    return executionFromReconstruction(reference, { cpuReference: reference, webgpuStatus: { status: 'webgpu-error-fallback', reason: error instanceof Error ? error.message : String(error), fallback: 'cpu-reference' } });
  }
}
