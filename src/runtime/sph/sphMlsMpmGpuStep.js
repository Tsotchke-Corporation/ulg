import {
  ULG_MLS_MPM_GPU_RESIDENT_STEP_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_RESIDENT_STEP_SCHEMA,
  ULG_MLS_MPM_GPU_RESIDENT_STEPS_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import { requestOpticalGpuDevice } from '../material/opticalGpuBuffers.js';
import {
  destroyMlsMpmGpuParticleBuffers,
  destroySphGpuParticleBuffers,
  SPH_GPU_PARTICLE_STATE_FLOATS,
  MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS
} from './sphGpuBuffers.js';
import { runMlsMpmP2gGridProjectionWithOptionalWebGpu } from './sphGridGpuKernel.js';
import { runMlsMpmGridUpdateWithOptionalWebGpu } from './sphGridUpdateGpuKernel.js';
import { runMlsMpmG2pWithOptionalWebGpu } from './sphG2pGpuKernel.js';
import {
  ULG_MLS_MPM_GPU_RESIDENT_SUMMARY_EXECUTION_SCHEMA,
  runMlsMpmResidentSummaryWebGpu
} from './sphMlsMpmGpuSummary.js';

export {
  ULG_MLS_MPM_GPU_RESIDENT_STEP_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_RESIDENT_STEP_SCHEMA,
  ULG_MLS_MPM_GPU_RESIDENT_STEPS_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_RESIDENT_SUMMARY_EXECUTION_SCHEMA
};

const STEP_SCOPE = 'mls-mpm-resident-step-p2g-grid-update-g2p';
const DEFAULT_BOX_DIMS_M = Object.freeze([5, 5, 5]);
const DEFAULT_GRAVITY_M_PER_S2 = Object.freeze([0, -9.80665, 0]);
const DEFAULT_CFL_FACTOR = 0.6;
const FULL_READBACK_MODE = 'full-parity-readback';
const NO_FULL_READBACK_MODE = 'no-full-readback';

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

function assertPackedInputs({ sphParticleState, mlsMpmParticleState }) {
  if (sphParticleState?.schema !== ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA) {
    throw new TypeError('MLS-MPM resident step requires a packed SPH GPU particle buffer');
  }
  if (mlsMpmParticleState?.schema !== ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA) {
    throw new TypeError('MLS-MPM resident step requires a packed MLS-MPM GPU particle buffer');
  }
  if (sphParticleState.particleCount !== mlsMpmParticleState.particleCount) {
    throw new RangeError('SPH and MLS-MPM particle counts must match');
  }
}

function summarizeParticles({ sourceState, sourceMechanics, nextState, nextMechanics, particleCount }) {
  let sourceMassKg = 0;
  let nextMassKg = 0;
  const sourceMomentumKgMPerS = [0, 0, 0];
  const nextMomentumKgMPerS = [0, 0, 0];
  let maxSpeedMPerS = 0;
  let maxDisplacementM = 0;
  let minVolumeRatioJ = Number.POSITIVE_INFINITY;
  let maxVolumeRatioJ = 0;

  for (let index = 0; index < particleCount; index += 1) {
    const stateOffset = index * SPH_GPU_PARTICLE_STATE_FLOATS;
    const mechanicsOffset = index * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS;
    const m0 = sourceState[stateOffset + 3] ?? 0;
    const m1 = nextState?.[stateOffset + 3] ?? m0;
    sourceMassKg += m0;
    nextMassKg += m1;
    for (let axis = 0; axis < 3; axis += 1) {
      sourceMomentumKgMPerS[axis] += m0 * (sourceState[stateOffset + 4 + axis] ?? 0);
      nextMomentumKgMPerS[axis] += m1 * (nextState?.[stateOffset + 4 + axis] ?? 0);
    }
    const vx = nextState?.[stateOffset + 4] ?? 0;
    const vy = nextState?.[stateOffset + 5] ?? 0;
    const vz = nextState?.[stateOffset + 6] ?? 0;
    maxSpeedMPerS = Math.max(maxSpeedMPerS, Math.hypot(vx, vy, vz));
    const dx = (nextState?.[stateOffset] ?? sourceState[stateOffset]) - sourceState[stateOffset];
    const dy = (nextState?.[stateOffset + 1] ?? sourceState[stateOffset + 1]) - sourceState[stateOffset + 1];
    const dz = (nextState?.[stateOffset + 2] ?? sourceState[stateOffset + 2]) - sourceState[stateOffset + 2];
    maxDisplacementM = Math.max(maxDisplacementM, Math.hypot(dx, dy, dz));
    const j = finiteNumber(nextMechanics?.[mechanicsOffset + 18] ?? sourceMechanics?.[mechanicsOffset + 18], 1);
    minVolumeRatioJ = Math.min(minVolumeRatioJ, j);
    maxVolumeRatioJ = Math.max(maxVolumeRatioJ, j);
  }

  return {
    sourceMassKg,
    nextMassKg,
    massDeltaKg: nextMassKg - sourceMassKg,
    sourceMomentumKgMPerS,
    nextMomentumKgMPerS,
    momentumDeltaKgMPerS: nextMomentumKgMPerS.map((value, axis) => value - sourceMomentumKgMPerS[axis]),
    maxSpeedMPerS,
    maxDisplacementM,
    minVolumeRatioJ: Number.isFinite(minVolumeRatioJ) ? minVolumeRatioJ : 0,
    maxVolumeRatioJ
  };
}

function summarizeActiveGridNodes(gridUpdate) {
  const nodes = gridUpdate?.updatedGridNodes;
  const stride = gridUpdate?.gridNodeStrideFloats ?? 8;
  if (!(nodes instanceof Float32Array) || stride <= 0) return 0;
  let activeNodes = 0;
  for (let offset = 0; offset < nodes.length; offset += stride) {
    if ((nodes[offset] ?? 0) > 0) activeNodes += 1;
  }
  return activeNodes;
}

export function compactMlsMpmResidentStepDiagnostics({
  sphParticleState,
  mlsMpmParticleState,
  p2gGridProjection,
  gridUpdate,
  g2pReconstruction,
  compactGpuSummary = null,
  readbackMode = FULL_READBACK_MODE
} = {}) {
  assertPackedInputs({ sphParticleState, mlsMpmParticleState });
  if (compactGpuSummary?.compactGpuSummaryAvailable) {
    return {
      particleCount: compactGpuSummary.particleCount,
      gridNodeCount: compactGpuSummary.gridNodeCount,
      activeGridNodeCount: compactGpuSummary.activeGridNodeCount,
      sourceMassKg: compactGpuSummary.sourceMassKg,
      nextMassKg: compactGpuSummary.nextMassKg,
      massDeltaKg: compactGpuSummary.massDeltaKg,
      sourceMomentumKgMPerS: compactGpuSummary.sourceMomentumKgMPerS,
      nextMomentumKgMPerS: compactGpuSummary.nextMomentumKgMPerS,
      momentumDeltaKgMPerS: compactGpuSummary.momentumDeltaKgMPerS,
      maxSpeedMPerS: compactGpuSummary.maxSpeedMPerS,
      maxDisplacementM: compactGpuSummary.maxDisplacementM,
      minVolumeRatioJ: compactGpuSummary.minVolumeRatioJ,
      maxVolumeRatioJ: compactGpuSummary.maxVolumeRatioJ,
      readbackMode,
      compactGpuSummaryAvailable: true,
      compactGpuSummaryStatus: compactGpuSummary.status,
      compactGpuSummaryReadbackMode: compactGpuSummary.readbackMode,
      compactReadbackByteLength: compactGpuSummary.compactReadbackByteLength ?? 0,
      compactSummaryReductionStrategy: compactGpuSummary.reductionStrategy ?? null,
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  }
  if (readbackMode === NO_FULL_READBACK_MODE) {
    return {
      particleCount: sphParticleState.particleCount,
      gridNodeCount: gridUpdate?.gridNodeCount ?? p2gGridProjection?.gridNodeCount ?? 0,
      activeGridNodeCount: null,
      sourceMassKg: null,
      nextMassKg: null,
      massDeltaKg: null,
      sourceMomentumKgMPerS: null,
      nextMomentumKgMPerS: null,
      momentumDeltaKgMPerS: null,
      maxSpeedMPerS: null,
      maxDisplacementM: null,
      minVolumeRatioJ: null,
      maxVolumeRatioJ: null,
      readbackMode,
      compactGpuSummaryAvailable: false,
      compactGpuSummaryStatus: compactGpuSummary?.status ?? 'not-run',
      compactGpuSummaryReason: compactGpuSummary?.reason ?? null,
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  }
  const particleSummary = summarizeParticles({
    sourceState: sphParticleState.state,
    sourceMechanics: mlsMpmParticleState.mechanics,
    nextState: g2pReconstruction?.state,
    nextMechanics: g2pReconstruction?.mechanics,
    particleCount: sphParticleState.particleCount
  });
  return {
    particleCount: sphParticleState.particleCount,
    gridNodeCount: gridUpdate?.gridNodeCount ?? p2gGridProjection?.gridNodeCount ?? 0,
    activeGridNodeCount: summarizeActiveGridNodes(gridUpdate),
    ...particleSummary,
    readbackMode,
    compactGpuSummaryAvailable: false,
    compactGpuSummaryStatus: compactGpuSummary?.status ?? 'not-run',
    compactGpuSummaryReason: compactGpuSummary?.reason ?? null,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

function stageStatus(stage) {
  return stage?.webgpuStatus?.status || stage?.status || 'missing';
}

function executionBackend(stages) {
  const backends = stages.map((stage) => stage?.backend || 'missing');
  if (backends.every((backend) => backend === 'webgpu')) return 'webgpu';
  if (backends.every((backend) => backend === 'cpu-reference')) return 'cpu-reference';
  return 'mixed-fallback';
}

function hasRetainedStageBuffers({ p2gGridProjection, gridUpdate }) {
  return Boolean(
    (p2gGridProjection?.gpuResult?.gridBuffer || p2gGridProjection?.gridBuffer)
    && (gridUpdate?.gpuResult?.updatedGridBuffer || gridUpdate?.updatedGridBuffer)
  );
}

function retainedG2pOutputBuffers(g2pReconstruction) {
  const source = g2pReconstruction?.gpuResult || g2pReconstruction;
  return {
    stateBuffer: source?.stateBuffer || null,
    mechanicsBuffer: source?.mechanicsBuffer || null,
    stateBufferByteLength: source?.stateBufferByteLength || 0,
    mechanicsBufferByteLength: source?.mechanicsBufferByteLength || 0,
    destroyOutputParticleBuffers: source?.destroyOutputParticleBuffers || null
  };
}

function buildNextParticleUploads({
  sphParticleState,
  mlsMpmParticleState,
  sphParticleUpload,
  g2pReconstruction,
  particlePingPong
}) {
  const retained = retainedG2pOutputBuffers(g2pReconstruction);
  if (!retained.stateBuffer || !retained.mechanicsBuffer) return null;
  const thermoBuffer = sphParticleUpload?.status === 'webgpu-uploaded' ? sphParticleUpload.thermoBuffer : null;
  if (!thermoBuffer) return null;
  return {
    sphParticleUpload: {
      schema: ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
      status: 'webgpu-uploaded',
      sourceSchema: sphParticleState.schema,
      particleCount: sphParticleState.particleCount,
      stateStrideBytes: sphParticleState.stateStrideBytes,
      thermoStrideBytes: sphParticleState.thermoStrideBytes,
      stateBuffer: retained.stateBuffer,
      thermoBuffer,
      ownsStateBuffer: true,
      ownsThermoBuffer: false,
      slot: particlePingPong.nextSlot,
      sourceSlot: particlePingPong.sourceSlot,
      nextSlot: particlePingPong.nextSlot,
      step: particlePingPong.nextStep,
      time: particlePingPong.nextTime,
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    },
    mlsMpmParticleUpload: {
      schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
      status: 'webgpu-uploaded',
      sourceSchema: mlsMpmParticleState.schema,
      particleCount: mlsMpmParticleState.particleCount,
      mechanicsStrideBytes: mlsMpmParticleState.mechanicsStrideBytes,
      mechanicsBuffer: retained.mechanicsBuffer,
      ownsMechanicsBuffer: true,
      slot: particlePingPong.nextSlot,
      sourceSlot: particlePingPong.sourceSlot,
      nextSlot: particlePingPong.nextSlot,
      step: particlePingPong.nextStep,
      time: particlePingPong.nextTime,
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    }
  };
}

function residentStepEnvelope({
  sphParticleState,
  mlsMpmParticleState,
  sphParticleUpload = null,
  mlsMpmParticleUpload = null,
  p2gGridProjection,
  gridUpdate,
  g2pReconstruction,
  compactGpuSummary = null,
  dt,
  gravityMPerS2,
  boxDimsM,
  cflFactor,
  preferWebGpu,
  sourceSlot = 0
}) {
  const stages = [p2gGridProjection, gridUpdate, g2pReconstruction];
  const backend = executionBackend(stages);
  const stageBuffersRetained = hasRetainedStageBuffers({ p2gGridProjection, gridUpdate });
  const g2pOutput = retainedG2pOutputBuffers(g2pReconstruction);
  const g2pOutputBuffersRetained = Boolean(g2pOutput.stateBuffer && g2pOutput.mechanicsBuffer);
  const residentBuffersRetained = stageBuffersRetained && g2pOutputBuffersRetained;
  const noFullReadback = residentBuffersRetained
    && stages.every((stage) => stage?.backend === 'webgpu' && stage?.readbackMode === NO_FULL_READBACK_MODE);
  const readbackMode = noFullReadback ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE;
  const sourceStep = finiteNumber(sphParticleState.step ?? mlsMpmParticleState.step, 0);
  const sourceTime = finiteNumber(sphParticleState.time ?? mlsMpmParticleState.time, 0);
  const particlePingPong = {
    sourceSlot,
    nextSlot: sourceSlot === 0 ? 1 : 0,
    step: sourceStep,
    nextStep: sourceStep + 1,
    time: sourceTime,
    nextTime: sourceTime + dt
  };
  const nextParticleUploads = buildNextParticleUploads({
    sphParticleState,
    mlsMpmParticleState,
    sphParticleUpload,
    g2pReconstruction,
    particlePingPong
  });
  const diagnostics = compactMlsMpmResidentStepDiagnostics({
    sphParticleState,
    mlsMpmParticleState,
    sphParticleUpload,
    mlsMpmParticleUpload,
    p2gGridProjection,
    gridUpdate,
    g2pReconstruction,
    compactGpuSummary,
    readbackMode
  });

  return {
    schema: ULG_MLS_MPM_GPU_RESIDENT_STEP_EXECUTION_SCHEMA,
    stepSchema: ULG_MLS_MPM_GPU_RESIDENT_STEP_SCHEMA,
    backend,
    status: backend === 'webgpu' ? 'resident-step-webgpu-executed' : 'resident-step-cpu-or-fallback',
    kernelScope: STEP_SCOPE,
    preferWebGpu,
    particleCount: sphParticleState.particleCount,
    gridNodeCount: gridUpdate?.gridNodeCount ?? p2gGridProjection?.gridNodeCount ?? 0,
    dt,
    gravityMPerS2: [...gravityMPerS2],
    boxDimsM: [...boxDimsM],
    cflFactor,
    stateStrideFloats: SPH_GPU_PARTICLE_STATE_FLOATS,
    mechanicsStrideFloats: MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
    state: g2pReconstruction?.state ?? new Float32Array(),
    mechanics: g2pReconstruction?.mechanics ?? new Float32Array(),
    p2gGridProjection,
    gridUpdate,
    g2pReconstruction,
    stageStatus: {
      p2g: stageStatus(p2gGridProjection),
      gridUpdate: stageStatus(gridUpdate),
      g2p: stageStatus(g2pReconstruction)
    },
    stageBackends: {
      p2g: p2gGridProjection?.backend || null,
      gridUpdate: gridUpdate?.backend || null,
      g2p: g2pReconstruction?.backend || null
    },
    residentBuffersRetained,
    stageBuffersRetained,
    g2pOutputBuffersRetained,
    residentBufferMode: residentBuffersRetained ? 'retained-stage-and-output-buffers' : 'cpu-artifact-fallback',
    particlePingPong,
    nextParticleUploads,
    nextParticleBufferMode: nextParticleUploads ? 'retained-g2p-output-buffers' : 'not-available',
    nextParticleStateBufferByteLength: g2pOutput.stateBufferByteLength,
    nextParticleMechanicsBufferByteLength: g2pOutput.mechanicsBufferByteLength,
    readbackMode,
    compactGpuSummary,
    normalHotLoopReadbackFree: noFullReadback,
    renderStateReadbackAvailable: !noFullReadback,
    gpuAuthoritativeState: false,
    diagnostics,
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

export async function runMlsMpmResidentStepWithOptionalWebGpu({
  sphParticleState,
  mlsMpmParticleState,
  sphParticleUpload = null,
  mlsMpmParticleUpload = null,
  gridSpacingM = sphParticleState?.smoothingLengthM,
  boxDimsM = DEFAULT_BOX_DIMS_M,
  dt = mlsMpmParticleState?.mechanicsDtS ?? 0,
  gravityMPerS2 = mlsMpmParticleState?.gravityMPerS2 ?? DEFAULT_GRAVITY_M_PER_S2,
  cflFactor = mlsMpmParticleState?.gridCflFactor || DEFAULT_CFL_FACTOR,
  preferWebGpu = false,
  navigatorRef = globalThis.navigator,
  device = null,
  deviceResult = null,
  parityTolerances = {},
  onDeviceLost = null,
  p2gRunner = undefined,
  gridUpdateRunner = undefined,
  g2pRunner = undefined,
  summaryRunner = runMlsMpmResidentSummaryWebGpu,
  sourceSlot = sphParticleUpload?.slot ?? 0,
  readbackMode = FULL_READBACK_MODE
} = {}) {
  assertPackedInputs({ sphParticleState, mlsMpmParticleState });
  const dims = finiteVector3(boxDimsM, DEFAULT_BOX_DIMS_M);
  const gravity = finiteVector3(gravityMPerS2, DEFAULT_GRAVITY_M_PER_S2);
  const dtSeconds = finiteNumber(dt, 0);
  const requestedReadbackMode = readbackMode === NO_FULL_READBACK_MODE ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE;
  let lostInfo = null;
  const resolvedDeviceResult = preferWebGpu && !device && !deviceResult
    ? await requestOpticalGpuDevice(navigatorRef, {
      onDeviceLost(info) {
        lostInfo = info;
        if (typeof onDeviceLost === 'function') onDeviceLost(info);
      }
    })
    : deviceResult;
  const resolvedDevice = device || resolvedDeviceResult?.device || null;
  const sharedDeviceResult = resolvedDevice
    ? { status: 'webgpu-device-ready', reason: device ? 'provided device' : (resolvedDeviceResult?.reason || 'resident step shared device'), device: resolvedDevice }
    : resolvedDeviceResult;

  const p2gGridProjection = await runMlsMpmP2gGridProjectionWithOptionalWebGpu({
    sphParticleState,
    mlsMpmParticleState,
    sphParticleUpload,
    mlsMpmParticleUpload,
    gridSpacingM,
    boxDimsM: dims,
    dt: dtSeconds,
    preferWebGpu,
    navigatorRef,
    device: resolvedDevice,
    deviceResult: sharedDeviceResult,
    parityTolerance: parityTolerances.p2g ?? 5e-2,
    retainGridBuffer: true,
    readbackMode: requestedReadbackMode,
    webGpuRunner: p2gRunner,
    onDeviceLost(info) {
      lostInfo = info;
      if (typeof onDeviceLost === 'function') onDeviceLost(info);
    }
  });

  const gridUpdate = await runMlsMpmGridUpdateWithOptionalWebGpu({
    p2gGridProjection,
    p2gGridBuffer: p2gGridProjection?.gpuResult?.gridBuffer ?? p2gGridProjection?.gridBuffer ?? null,
    dt: dtSeconds,
    gravityMPerS2: gravity,
    boxDimsM: dims,
    cflFactor,
    preferWebGpu: preferWebGpu && p2gGridProjection.backend === 'webgpu' && !lostInfo,
    navigatorRef,
    device: resolvedDevice,
    deviceResult: sharedDeviceResult,
    parityTolerance: parityTolerances.gridUpdate ?? 1e-5,
    retainUpdatedGridBuffer: true,
    readbackMode: requestedReadbackMode,
    webGpuRunner: gridUpdateRunner,
    onDeviceLost(info) {
      lostInfo = info;
      if (typeof onDeviceLost === 'function') onDeviceLost(info);
    }
  });

  const g2pReconstruction = await runMlsMpmG2pWithOptionalWebGpu({
    sphParticleState,
    mlsMpmParticleState,
    gridUpdate,
    sphParticleUpload,
    mlsMpmParticleUpload,
    updatedGridBuffer: gridUpdate?.gpuResult?.updatedGridBuffer ?? gridUpdate?.updatedGridBuffer ?? null,
    dt: dtSeconds,
    boxDimsM: dims,
    preferWebGpu: preferWebGpu && gridUpdate.backend === 'webgpu' && !lostInfo,
    navigatorRef,
    device: resolvedDevice,
    deviceResult: sharedDeviceResult,
    parityTolerance: parityTolerances.g2p ?? 5e-2,
    retainOutputParticleBuffers: true,
    readbackMode: requestedReadbackMode,
    webGpuRunner: g2pRunner,
    onDeviceLost(info) {
      lostInfo = info;
      if (typeof onDeviceLost === 'function') onDeviceLost(info);
    }
  });

  const hasWebGpuLikeSummaryDevice = Boolean(resolvedDevice?.createBuffer && resolvedDevice.queue?.writeBuffer);
  const customSummaryRunner = summaryRunner && summaryRunner !== runMlsMpmResidentSummaryWebGpu;
  let compactGpuSummary = null;
  if (
    requestedReadbackMode === NO_FULL_READBACK_MODE
    && typeof summaryRunner === 'function'
    && (hasWebGpuLikeSummaryDevice || customSummaryRunner)
  ) {
    try {
      compactGpuSummary = await summaryRunner({
        device: resolvedDevice,
        sphParticleState,
        mlsMpmParticleState,
        sphParticleUpload,
        mlsMpmParticleUpload,
        gridUpdate,
        g2pReconstruction
      });
    } catch (error) {
      compactGpuSummary = {
        schema: ULG_MLS_MPM_GPU_RESIDENT_SUMMARY_EXECUTION_SCHEMA,
        backend: 'webgpu',
        status: 'compact-summary-unavailable',
        reason: error instanceof Error ? error.message : String(error),
        compactGpuSummaryAvailable: false,
        scientificValidation: false,
        sphValidation: false,
        phaseChangeValidation: false,
        fullPhysicsValidation: false
      };
    }
  }

  return residentStepEnvelope({
    sphParticleState,
    mlsMpmParticleState,
    p2gGridProjection,
    gridUpdate,
    g2pReconstruction,
    compactGpuSummary,
    dt: dtSeconds,
    gravityMPerS2: gravity,
    boxDimsM: dims,
    cflFactor,
    preferWebGpu,
    sphParticleUpload,
    mlsMpmParticleUpload,
    sourceSlot
  });
}

export function destroyMlsMpmResidentStepBuffers(step) {
  step?.p2gGridProjection?.gpuResult?.destroyGridBuffer?.();
  step?.p2gGridProjection?.destroyGridBuffer?.();
  step?.gridUpdate?.gpuResult?.destroyUpdatedGridBuffer?.();
  step?.gridUpdate?.destroyUpdatedGridBuffer?.();
  if (step?.nextParticleUploads) {
    destroySphGpuParticleBuffers(step.nextParticleUploads.sphParticleUpload);
    destroyMlsMpmGpuParticleBuffers(step.nextParticleUploads.mlsMpmParticleUpload);
  } else if (step?.g2pReconstruction?.destroyOutputParticleBuffers) {
    step.g2pReconstruction.destroyOutputParticleBuffers();
  } else {
    step?.g2pReconstruction?.gpuResult?.destroyOutputParticleBuffers?.();
  }
}

function cloneSphParticleStateForNext(source, step) {
  const noFullReadback = step.readbackMode === NO_FULL_READBACK_MODE;
  return {
    ...source,
    status: noFullReadback ? 'gpu-resident-unread-ready' : 'gpu-resident-readback-ready',
    step: step.particlePingPong?.nextStep ?? ((source.step ?? 0) + 1),
    time: step.particlePingPong?.nextTime ?? ((source.time ?? 0) + (step.dt ?? 0)),
    state: noFullReadback ? source.state : step.state,
    cpuStateStale: noFullReadback,
    thermo: source.thermo
  };
}

function cloneMlsMpmParticleStateForNext(source, step) {
  const noFullReadback = step.readbackMode === NO_FULL_READBACK_MODE;
  return {
    ...source,
    status: noFullReadback ? 'gpu-resident-unread-ready' : 'gpu-resident-readback-ready',
    step: step.particlePingPong?.nextStep ?? ((source.step ?? 0) + 1),
    time: step.particlePingPong?.nextTime ?? ((source.time ?? 0) + (step.dt ?? 0)),
    mechanics: noFullReadback ? source.mechanics : step.mechanics,
    cpuStateStale: noFullReadback
  };
}

function summarizeResidentStepForSequence(step, index) {
  return {
    index,
    backend: step.backend,
    status: step.status,
    stageStatus: { ...step.stageStatus },
    stageBackends: { ...step.stageBackends },
    residentBuffersRetained: step.residentBuffersRetained,
    stageBuffersRetained: step.stageBuffersRetained,
    g2pOutputBuffersRetained: step.g2pOutputBuffersRetained,
    nextParticleBufferMode: step.nextParticleBufferMode,
    particlePingPong: { ...step.particlePingPong },
    diagnostics: {
      particleCount: step.diagnostics?.particleCount ?? 0,
      gridNodeCount: step.diagnostics?.gridNodeCount ?? 0,
      activeGridNodeCount: step.diagnostics?.activeGridNodeCount ?? null,
      massDeltaKg: step.diagnostics?.massDeltaKg ?? null,
      maxSpeedMPerS: step.diagnostics?.maxSpeedMPerS ?? null,
      maxDisplacementM: step.diagnostics?.maxDisplacementM ?? null,
      compactGpuSummaryAvailable: step.diagnostics?.compactGpuSummaryAvailable ?? false,
      compactGpuSummaryStatus: step.diagnostics?.compactGpuSummaryStatus ?? null
    },
    readbackMode: step.readbackMode,
    normalHotLoopReadbackFree: step.normalHotLoopReadbackFree,
    renderStateReadbackAvailable: step.renderStateReadbackAvailable,
    gpuAuthoritativeState: step.gpuAuthoritativeState,
    fullPhysicsValidation: false
  };
}

export async function runMlsMpmResidentStepsWithOptionalWebGpu({
  stepCount = 1,
  retainIntermediateSteps = false,
  ...args
} = {}) {
  const count = Math.max(1, Math.round(finiteNumber(stepCount, 1)));
  let sphParticleState = args.sphParticleState;
  let mlsMpmParticleState = args.mlsMpmParticleState;
  let sphParticleUpload = args.sphParticleUpload ?? null;
  let mlsMpmParticleUpload = args.mlsMpmParticleUpload ?? null;
  let sourceSlot = args.sourceSlot ?? sphParticleUpload?.slot ?? 0;
  let finalStep = null;
  const retainedSteps = [];
  const stepSummaries = [];

  for (let index = 0; index < count; index += 1) {
    const step = await runMlsMpmResidentStepWithOptionalWebGpu({
      ...args,
      sphParticleState,
      mlsMpmParticleState,
      sphParticleUpload,
      mlsMpmParticleUpload,
      sourceSlot
    });
    step.sequenceIndex = index;
    stepSummaries.push(summarizeResidentStepForSequence(step, index));
    if (finalStep && !retainIntermediateSteps) {
      destroyMlsMpmResidentStepBuffers(finalStep);
    } else if (finalStep) {
      retainedSteps.push(finalStep);
    }
    finalStep = step;
    sphParticleState = cloneSphParticleStateForNext(sphParticleState, step);
    mlsMpmParticleState = cloneMlsMpmParticleStateForNext(mlsMpmParticleState, step);
    sphParticleUpload = step.nextParticleUploads?.sphParticleUpload ?? null;
    mlsMpmParticleUpload = step.nextParticleUploads?.mlsMpmParticleUpload ?? null;
    sourceSlot = step.particlePingPong?.nextSlot ?? (sourceSlot === 0 ? 1 : 0);
  }

  return {
    schema: ULG_MLS_MPM_GPU_RESIDENT_STEPS_EXECUTION_SCHEMA,
    backend: finalStep?.backend || 'cpu-reference',
    status: 'resident-steps-executed',
    stepCount: count,
    completedStepCount: stepSummaries.length,
    retainIntermediateSteps,
    retainedIntermediateStepCount: retainedSteps.length,
    retainedSteps,
    finalStep,
    stepSummaries,
    nextSphParticleState: sphParticleState,
    nextMlsMpmParticleState: mlsMpmParticleState,
    nextParticleUploads: finalStep?.nextParticleUploads ?? null,
    nextParticleBufferMode: finalStep?.nextParticleBufferMode ?? 'not-available',
    readbackMode: finalStep?.readbackMode ?? FULL_READBACK_MODE,
    normalHotLoopReadbackFree: Boolean(finalStep?.normalHotLoopReadbackFree),
    renderStateReadbackAvailable: finalStep?.renderStateReadbackAvailable ?? true,
    gpuAuthoritativeState: false,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

export function destroyMlsMpmResidentStepsBuffers(execution) {
  for (const step of execution?.retainedSteps ?? []) {
    destroyMlsMpmResidentStepBuffers(step);
  }
  destroyMlsMpmResidentStepBuffers(execution?.finalStep);
}
