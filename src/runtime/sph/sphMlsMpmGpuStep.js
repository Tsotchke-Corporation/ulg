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
import {
  runSphThermalStepWebGpu
} from './sphThermalGpuKernel.js';
import {
  runSphReactionStepWebGpu
} from './sphReactionGpuKernel.js';
import {
  createResidentProductMassHandle,
  mergeResidentGasSpeciesLedgers
} from './sphReactionGpuSummary.js';

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
const ULG_MLS_MPM_RESIDENT_STAGE_TIMING_SCHEMA = 'peercompute.ulg.mls-mpm-resident-stage-timing.v0';
const GPU_BUFFER_USAGE = {
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128
};

function nowMs() {
  return typeof globalThis.performance?.now === 'function'
    ? globalThis.performance.now()
    : Date.now();
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

function reactionSummaryDiagnostics(reactionStep) {
  const reactionResult = reactionStep?.result || reactionStep;
  const summary = reactionResult?.reactionSummary || null;
  const residentProductMass = residentProductMassFromReactionStep(reactionStep);
  return {
    reactionSummaryAvailable: Boolean(summary?.reactionSummaryAvailable),
    reactionSummaryStatus: summary?.status || reactionResult?.reactionSummaryStatus || (reactionResult ? 'not-run' : 'not-required'),
    reactionSummaryReadbackMode: summary?.readbackMode ?? null,
    reactionSummaryReadbackByteLength: summary?.compactReadbackByteLength ?? 0,
    reactionSummaryReductionStrategy: summary?.reductionStrategy ?? null,
    reactionVisibleProductMassKg: summary?.visibleProductMassKg ?? null,
    reactionVisibleGasProductMassKg: summary?.visibleGasProductMassKg ?? null,
    reactionOutputGasPhaseMassKg: summary?.outputGasPhaseMassKg ?? null,
    reactionChangedMaterialCount: summary?.changedMaterialCount ?? null,
    reactionChangedMassCount: summary?.changedMassCount ?? null,
    reactionCanonicalEventCount: summary?.canonicalReactionEventCount ?? null,
    reactionConsumedReactantMassKg: summary?.consumedReactantMassKg ?? null,
    reactionExpectedProductMassKg: summary?.expectedProductMassKg ?? null,
    reactionRawProductMassKg: summary?.rawProductMassKg ?? null,
    reactionLedgerVisibleProductMassKg: summary?.ledgerVisibleProductMassKg ?? null,
    reactionLedgerUnplacedProductMassKg: summary?.ledgerUnplacedProductMassKg ?? null,
    reactionLedgerGasProductMassKg: summary?.ledgerGasProductMassKg ?? null,
    reactionLedgerVisibleGasProductMassKg: summary?.ledgerVisibleGasProductMassKg ?? null,
    reactionLedgerUnplacedGasProductMassKg: summary?.ledgerUnplacedGasProductMassKg ?? null,
    reactionSealedBoxGasProductMoles: summary?.sealedBoxGasProductMoles ?? null,
    reactionHeatJ: summary?.reactionHeatJ ?? null,
    reactionLedgerMassResidualKg: summary?.ledgerMassResidualKg ?? null,
    reactionLedgerReadyEventCount: summary?.ledgerReadyEventCount ?? null,
    reactionLedgerProblemEventCount: summary?.ledgerProblemEventCount ?? null,
    reactionProposalMutualPairCount: summary?.proposalMutualPairCount ?? null,
    reactionCompactLedgerAvailable: summary?.compactLedgerAvailable ?? false,
    reactionProductInventoryCount: summary?.productInventoryCount ?? 0,
    reactionProductInventoryReadbackByteLength: summary?.productInventoryReadbackByteLength ?? 0,
    reactionProductEventRowCount: summary?.productEventRowCount ?? 0,
    reactionProductEventActiveEventCount: summary?.productEventActiveEventCount ?? 0,
    reactionProductEventReadbackByteLength: summary?.productEventReadbackByteLength ?? 0,
    reactionProductEventBufferByteLength: summary?.productEventBufferByteLength ?? 0,
    reactionProductEventBufferRetained: summary?.productEventBufferRetained ?? false,
    reactionResidentProductMassStatus: residentProductMass?.status ?? null,
    reactionResidentProductMassBufferRetained: residentProductMass?.productEventBufferRetained ?? false,
    reactionResidentProductMassBufferByteLength: residentProductMass?.productEventBufferByteLength ?? 0,
    reactionResidentProductMassProductEventRowCount: residentProductMass?.productEventRowCount ?? 0,
    reactionResidentProductMassUnplacedProductMassKg: residentProductMass?.unplacedProductMassKg ?? null,
    reactionResidentProductMassUnplacedGasProductMassKg: residentProductMass?.unplacedGasProductMassKg ?? null,
    reactionResidentProductMassEosCouplingStatus: residentProductMass?.eosCouplingStatus ?? null,
    reactionProductInventory: summary?.productInventory
      ? {
          ...summary.productInventory,
          records: Array.isArray(summary.productInventory.records)
            ? summary.productInventory.records.map((row) => ({ ...row }))
            : [],
          byMaterial: Object.fromEntries(
            Object.entries(summary.productInventory.byMaterial || {})
              .map(([key, row]) => [key, { ...row, productTermIndices: [...(row.productTermIndices || [])] }])
          )
        }
      : null,
    reactionAtomResidualCount: summary?.atomResidualCount ?? 0,
    reactionAtomResidualReadbackByteLength: summary?.atomResidualReadbackByteLength ?? 0,
    reactionAtomResidualSummary: summary?.atomResidualSummary
      ? {
          ...summary.atomResidualSummary,
          records: Array.isArray(summary.atomResidualSummary.records)
            ? summary.atomResidualSummary.records.map((row) => ({ ...row }))
            : [],
          atomResidualMolByZ: { ...(summary.atomResidualSummary.atomResidualMolByZ || {}) }
        }
      : null,
    reactionStrictGateStatus: summary?.strictReactionGate?.status ?? null,
    reactionStrictGateBlockers: Array.isArray(summary?.strictReactionGate?.blockers)
      ? [...summary.strictReactionGate.blockers]
      : [],
    reactionStrictGate: summary?.strictReactionGate
      ? {
          ...summary.strictReactionGate,
          blockers: [...(summary.strictReactionGate.blockers || [])],
          warnings: [...(summary.strictReactionGate.warnings || [])],
          provisionalEnergetics: (summary.strictReactionGate.provisionalEnergetics || []).map((row) => ({ ...row }))
        }
      : null,
    reactionGasSpeciesLedgerCount: summary?.gasSpeciesLedgerCount ?? 0,
    reactionGasSpeciesReadbackByteLength: summary?.gasSpeciesReadbackByteLength ?? 0,
    reactionGasSpeciesLedger: summary?.gasSpeciesLedger
      ? {
          ...summary.gasSpeciesLedger,
          records: Array.isArray(summary.gasSpeciesLedger.records)
            ? summary.gasSpeciesLedger.records.map((row) => ({ ...row }))
            : [],
          bySpecies: Object.fromEntries(
            Object.entries(summary.gasSpeciesLedger.bySpecies || {})
              .map(([key, row]) => [key, { ...row, gasProductIndices: [...(row.gasProductIndices || [])] }])
          )
        }
      : null,
    reactionSummaryVisibleOnly: summary?.visibleOnly ?? null,
    reactionSummaryUnplacedProductInventoryIncluded: summary?.unplacedProductInventoryIncluded ?? null
  };
}

function nonzeroSummaryValue(value, tolerance = 1e-12) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && Math.abs(numeric) > tolerance;
}

function reactionOutputMutatesParticles(reactionStep) {
  const reactionResult = reactionStep?.result || reactionStep;
  if (!reactionResult) return false;
  const hasOutputBuffers = Boolean(
    reactionResult.stateBuffer || reactionResult.thermoBuffer || reactionResult.mechanicsBuffer
  );
  if (!hasOutputBuffers) return false;
  const summary = reactionResult.reactionSummary || null;
  if (!summary?.reactionSummaryAvailable) return true;
  return [
    summary.changedMaterialCount,
    summary.changedMassCount,
    summary.visibleProductMassKg,
    summary.visibleGasProductMassKg,
    summary.outputGasPhaseMassKg,
    summary.canonicalReactionEventCount,
    summary.consumedReactantMassKg,
    summary.expectedProductMassKg,
    summary.rawProductMassKg,
    summary.ledgerVisibleProductMassKg,
    summary.ledgerUnplacedProductMassKg,
    summary.ledgerGasProductMassKg,
    summary.ledgerVisibleGasProductMassKg,
    summary.ledgerUnplacedGasProductMassKg,
    summary.sealedBoxGasProductMoles,
    summary.reactionHeatJ,
    summary.ledgerReadyEventCount,
    summary.ledgerProblemEventCount,
    summary.productEventActiveEventCount
  ].some((value) => nonzeroSummaryValue(value));
}

function pressureInterfaceGridForceDiagnostics(gridUpdate) {
  return {
    pressureInterfaceForceSolverSchema: gridUpdate?.pressureInterfaceForceSolverSchema ?? null,
    pressureInterfaceForceSolverStatus: gridUpdate?.pressureInterfaceForceSolverStatus ?? null,
    pressureInterfaceForceCouplingStatus: gridUpdate?.pressureInterfaceForceCouplingStatus ?? null,
    pressureInterfaceForceApplicationStatus: gridUpdate?.pressureInterfaceForceApplicationStatus ?? null,
    pressureInterfaceForceRowCount: gridUpdate?.pressureInterfaceForceRowCount ?? 0,
    pressureInterfaceAppliedImpulseNSeconds: [...(gridUpdate?.pressureInterfaceAppliedImpulseNSeconds ?? [0, 0, 0])],
    pressureInterfaceAppliedImpulseMagnitudeNSeconds: gridUpdate?.pressureInterfaceAppliedImpulseMagnitudeNSeconds ?? 0,
    pressureInterfaceAppliedImpulseSource: gridUpdate?.pressureInterfaceAppliedImpulseSource ?? null,
    pressureInterfaceImpulseProofStatus: gridUpdate?.pressureInterfaceImpulseProofStatus ?? null,
    pressureInterfaceForceConsumerStatus: gridUpdate?.pressureInterfaceForceConsumerStatus ?? null
  };
}

export function compactMlsMpmResidentStepDiagnostics({
  sphParticleState,
  mlsMpmParticleState,
  p2gGridProjection,
  gridUpdate,
  g2pReconstruction,
  reactionStep = null,
  compactGpuSummary = null,
  readbackMode = FULL_READBACK_MODE
} = {}) {
  assertPackedInputs({ sphParticleState, mlsMpmParticleState });
  const reactionSummary = reactionSummaryDiagnostics(reactionStep);
  const pressureInterfaceGridForce = pressureInterfaceGridForceDiagnostics(gridUpdate);
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
      phaseMassKg: compactGpuSummary.phaseMassKg,
      temperatureMassWeightedMeanK: compactGpuSummary.temperatureMassWeightedMeanK,
      minTemperatureK: compactGpuSummary.minTemperatureK,
      maxTemperatureK: compactGpuSummary.maxTemperatureK,
      thermalReadyCount: compactGpuSummary.thermalReadyCount,
      thermalProblemCount: compactGpuSummary.thermalProblemCount,
      finiteTemperatureCount: compactGpuSummary.finiteTemperatureCount,
      phaseMassTotalKg: compactGpuSummary.phaseMassTotalKg,
      thermalPhaseSummaryAvailable: compactGpuSummary.thermalPhaseSummaryAvailable,
      thermalSummaryStatus: compactGpuSummary.thermalSummaryStatus,
      readbackMode,
      compactGpuSummaryAvailable: true,
      compactGpuSummaryStatus: compactGpuSummary.status,
      compactGpuSummaryReadbackMode: compactGpuSummary.readbackMode,
      compactReadbackByteLength: compactGpuSummary.compactReadbackByteLength ?? 0,
      compactSummaryReductionStrategy: compactGpuSummary.reductionStrategy ?? null,
      ...pressureInterfaceGridForce,
      ...reactionSummary,
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
      phaseMassKg: null,
      temperatureMassWeightedMeanK: null,
      minTemperatureK: null,
      maxTemperatureK: null,
      thermalReadyCount: null,
      thermalProblemCount: null,
      finiteTemperatureCount: null,
      phaseMassTotalKg: null,
      thermalPhaseSummaryAvailable: false,
      thermalSummaryStatus: compactGpuSummary?.thermalSummaryStatus ?? null,
      readbackMode,
      compactGpuSummaryAvailable: false,
      compactGpuSummaryStatus: compactGpuSummary?.status ?? 'not-run',
      compactGpuSummaryReason: compactGpuSummary?.reason ?? null,
      ...pressureInterfaceGridForce,
      ...reactionSummary,
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
    phaseMassKg: null,
    temperatureMassWeightedMeanK: null,
    minTemperatureK: null,
    maxTemperatureK: null,
    thermalReadyCount: null,
    thermalProblemCount: null,
    finiteTemperatureCount: null,
    phaseMassTotalKg: null,
    thermalPhaseSummaryAvailable: false,
    thermalSummaryStatus: compactGpuSummary?.thermalSummaryStatus ?? null,
    readbackMode,
    compactGpuSummaryAvailable: false,
    compactGpuSummaryStatus: compactGpuSummary?.status ?? 'not-run',
    compactGpuSummaryReason: compactGpuSummary?.reason ?? null,
    ...pressureInterfaceGridForce,
    ...reactionSummary,
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

function retainedThermalOutputBuffers(thermalStep) {
  const source = thermalStep?.result || thermalStep;
  return {
    stateBuffer: source?.stateBuffer || null,
    thermoBuffer: source?.thermoBuffer || null,
    stateBufferByteLength: source?.stateBufferByteLength || 0,
    thermoBufferByteLength: source?.thermoBufferByteLength || 0,
    destroyOutputParticleBuffers: source?.destroyOutputParticleBuffers || null
  };
}

function retainedReactionOutputBuffers(reactionStep) {
  const source = reactionStep?.result || reactionStep;
  const residentProductMass = residentProductMassFromReactionStep(reactionStep);
  return {
    stateBuffer: source?.stateBuffer || null,
    thermoBuffer: source?.thermoBuffer || null,
    mechanicsBuffer: source?.mechanicsBuffer || null,
    stateBufferByteLength: source?.stateBufferByteLength || 0,
    thermoBufferByteLength: source?.thermoBufferByteLength || 0,
    mechanicsBufferByteLength: source?.mechanicsBufferByteLength || 0,
    residentProductMass,
    destroyOutputParticleBuffers: source?.destroyOutputParticleBuffers || null
  };
}

function residentProductMassFromReactionStep(reactionStep) {
  const source = reactionStep?.result || reactionStep;
  return source?.residentProductMass || createResidentProductMassHandle(source?.reactionSummary || null);
}

function isSameResidentProductMass(left, right) {
  if (!left || !right) return false;
  if (left === right) return true;
  return Boolean(left.productEventBuffer && left.productEventBuffer === right.productEventBuffer);
}

function canMergeResidentProductMassBuffers(device, left, right) {
  return Boolean(
    device?.createBuffer
    && device.queue?.submit
    && left?.productEventBuffer
    && right?.productEventBuffer
    && left.productEventBuffer !== right.productEventBuffer
    && left.productEventStrideFloats === right.productEventStrideFloats
    && left.productEventStrideBytes === right.productEventStrideBytes
    && (left.productEventBufferByteLength ?? 0) > 0
    && (right.productEventBufferByteLength ?? 0) > 0
  );
}

function residentProductMassSourceRowCounts(handle) {
  const prior = handle?.productEventSourceRowCounts || handle?.mergeSourceProductEventRowCounts;
  if (Array.isArray(prior) && prior.length > 0) return prior.map((value) => Math.max(0, Math.round(Number(value) || 0)));
  return [Math.max(0, Math.round(Number(handle?.productEventRowCount) || 0))];
}

function residentProductMassSourceByteLengths(handle) {
  const prior = handle?.mergeSourceProductEventBufferByteLengths;
  if (Array.isArray(prior) && prior.length > 0) return prior.map((value) => Math.max(0, Math.round(Number(value) || 0)));
  return [Math.max(0, Math.round(Number(handle?.productEventBufferByteLength) || 0))];
}

async function mergeResidentProductMassBuffersWebGpu({
  device,
  inputResidentProductMass = null,
  emittedResidentProductMass = null
} = {}) {
  if (!inputResidentProductMass) return emittedResidentProductMass;
  if (!emittedResidentProductMass) return inputResidentProductMass;
  if (isSameResidentProductMass(inputResidentProductMass, emittedResidentProductMass)) {
    return emittedResidentProductMass;
  }
  if (!canMergeResidentProductMassBuffers(device, inputResidentProductMass, emittedResidentProductMass)) {
    return emittedResidentProductMass;
  }
  const inputByteLength = inputResidentProductMass.productEventBufferByteLength ?? 0;
  const emittedByteLength = emittedResidentProductMass.productEventBufferByteLength ?? 0;
  const mergedByteLength = inputByteLength + emittedByteLength;
  const sourceRowCounts = [
    ...residentProductMassSourceRowCounts(inputResidentProductMass),
    ...residentProductMassSourceRowCounts(emittedResidentProductMass)
  ];
  const sourceByteLengths = [
    ...residentProductMassSourceByteLengths(inputResidentProductMass),
    ...residentProductMassSourceByteLengths(emittedResidentProductMass)
  ];
  const gasSpeciesLedger = mergeResidentGasSpeciesLedgers(
    inputResidentProductMass.gasSpeciesLedger,
    emittedResidentProductMass.gasSpeciesLedger
  );
  const mergedBuffer = device.createBuffer({
    label: 'ulg-sph-resident-product-mass-merged-product-events',
    size: Math.max(4, mergedByteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  });
  const encoder = device.createCommandEncoder();
  encoder.copyBufferToBuffer(inputResidentProductMass.productEventBuffer, 0, mergedBuffer, 0, inputByteLength);
  encoder.copyBufferToBuffer(emittedResidentProductMass.productEventBuffer, 0, mergedBuffer, inputByteLength, emittedByteLength);
  device.queue.submit([encoder.finish()]);
  if (device.queue?.onSubmittedWorkDone) {
    await device.queue.onSubmittedWorkDone();
  }
  let destroyed = false;
  return {
    schema: inputResidentProductMass.schema || emittedResidentProductMass.schema,
    status: 'resident-product-mass-merged-gpu-resident',
    source: 'resident-product-mass-merged-product-events',
    productEventBuffer: mergedBuffer,
    productEventBufferRetained: true,
    productEventBufferByteLength: mergedByteLength,
    productEventRowCount: (inputResidentProductMass.productEventRowCount ?? 0)
      + (emittedResidentProductMass.productEventRowCount ?? 0),
    productEventActiveEventCount: (inputResidentProductMass.productEventActiveEventCount ?? 0)
      + (emittedResidentProductMass.productEventActiveEventCount ?? 0),
    productEventStrideFloats: emittedResidentProductMass.productEventStrideFloats,
    productEventStrideBytes: emittedResidentProductMass.productEventStrideBytes,
    productEventGenerationCount: sourceRowCounts.length,
    productEventSourceRowCounts: sourceRowCounts,
    productInventorySchema: emittedResidentProductMass.productInventorySchema || inputResidentProductMass.productInventorySchema || null,
    productInventoryCount: (inputResidentProductMass.productInventoryCount ?? 0)
      + (emittedResidentProductMass.productInventoryCount ?? 0),
    gasSpeciesLedgerSchema: gasSpeciesLedger?.schema
      ?? emittedResidentProductMass.gasSpeciesLedgerSchema
      ?? inputResidentProductMass.gasSpeciesLedgerSchema
      ?? null,
    gasSpeciesLedger,
    gasSpeciesLedgerCount: gasSpeciesLedger?.recordCount
      ?? ((inputResidentProductMass.gasSpeciesLedgerCount ?? 0) + (emittedResidentProductMass.gasSpeciesLedgerCount ?? 0)),
    gasSpeciesReadbackByteLength: (inputResidentProductMass.gasSpeciesReadbackByteLength ?? 0)
      + (emittedResidentProductMass.gasSpeciesReadbackByteLength ?? 0),
    sealedBoxGasProductMoles: (inputResidentProductMass.sealedBoxGasProductMoles ?? 0)
      + (emittedResidentProductMass.sealedBoxGasProductMoles ?? 0),
    visibleProductMassKg: (inputResidentProductMass.visibleProductMassKg ?? 0)
      + (emittedResidentProductMass.visibleProductMassKg ?? 0),
    unplacedProductMassKg: (inputResidentProductMass.unplacedProductMassKg ?? 0)
      + (emittedResidentProductMass.unplacedProductMassKg ?? 0),
    unplacedGasProductMassKg: (inputResidentProductMass.unplacedGasProductMassKg ?? 0)
      + (emittedResidentProductMass.unplacedGasProductMassKg ?? 0),
    consumeMassPolicy: 'unplaced-product-mass-only',
    visibleMassAlreadyInParticleBuffers: true,
    mergePolicy: 'gpu-buffer-concat-preserve-sparse-product-event-rows',
    mergeSourceProductEventBufferCount: sourceByteLengths.length,
    mergeSourceProductEventRowCounts: sourceRowCounts,
    mergeSourceProductEventBufferByteLengths: sourceByteLengths,
    eosCouplingStatus: emittedResidentProductMass.eosCouplingStatus ?? inputResidentProductMass.eosCouplingStatus ?? null,
    forceCouplingStatus: emittedResidentProductMass.forceCouplingStatus ?? inputResidentProductMass.forceCouplingStatus ?? null,
    destroyResidentProductMassBuffers() {
      if (destroyed) return;
      destroyed = true;
      mergedBuffer.destroy?.();
    },
    scientificValidation: false,
    chemistryValidation: false,
    gasValidation: false,
    sphValidation: false,
    fullPhysicsValidation: false
  };
}

function residentProductMassMergeStatus({ inputResidentProductMass = null, emittedResidentProductMass = null, mergedResidentProductMass = null } = {}) {
  if (mergedResidentProductMass?.status === 'resident-product-mass-merged-gpu-resident') {
    return 'resident-product-mass-merged-gpu-resident';
  }
  if (inputResidentProductMass && emittedResidentProductMass) {
    return 'resident-product-mass-merge-pending';
  }
  if (emittedResidentProductMass) return 'resident-product-mass-emitted-only';
  if (inputResidentProductMass) return 'resident-product-mass-input-only';
  return null;
}

function preservedResidentProductMassList({
  preserveResidentProductMass = null,
  preserveResidentProductMassHandles = []
} = {}) {
  return [
    preserveResidentProductMass,
    ...(Array.isArray(preserveResidentProductMassHandles) ? preserveResidentProductMassHandles : [])
  ].filter(Boolean);
}

function isPreservedResidentProductMass(candidate, preservedHandles) {
  return preservedHandles.some((handle) => isSameResidentProductMass(candidate, handle));
}

function destroyResidentProductMassFromStep(step, {
  preserveResidentProductMass = null,
  preserveResidentProductMassHandles = [],
  destroyInputResidentProductMass = false
} = {}) {
  const preservedHandles = preservedResidentProductMassList({
    preserveResidentProductMass,
    preserveResidentProductMassHandles
  });
  const candidates = [
    step?.residentProductMass || null,
    step?.emittedResidentProductMass || residentProductMassFromReactionStep(step?.reactionStep),
    destroyInputResidentProductMass ? step?.inputResidentProductMass || null : null
  ];
  const destroyed = [];
  for (const residentProductMass of candidates) {
    if (!residentProductMass) continue;
    if (isPreservedResidentProductMass(residentProductMass, preservedHandles)) continue;
    if (destroyed.some((item) => isSameResidentProductMass(item, residentProductMass))) continue;
    residentProductMass.destroyResidentProductMassBuffers?.();
    destroyed.push(residentProductMass);
  }
}

function buildNextParticleUploads({
  sphParticleState,
  mlsMpmParticleState,
  sphParticleUpload,
  g2pReconstruction,
  thermalStep = null,
  reactionStep = null,
  inputResidentProductMass = null,
  mergedResidentProductMass = null,
  particlePingPong
}) {
  const retained = retainedG2pOutputBuffers(g2pReconstruction);
  const thermal = retainedThermalOutputBuffers(thermalStep);
  const reaction = retainedReactionOutputBuffers(reactionStep);
  const reactionMutatesParticles = reactionOutputMutatesParticles(reactionStep);
  const stateBuffer = (reactionMutatesParticles ? reaction.stateBuffer : null) || retained.stateBuffer || thermal.stateBuffer;
  const thermoBuffer = (reactionMutatesParticles ? reaction.thermoBuffer : null)
    || thermal.thermoBuffer
    || (sphParticleUpload?.status === 'webgpu-uploaded' ? sphParticleUpload.thermoBuffer : null);
  const mechanicsBuffer = (reactionMutatesParticles ? reaction.mechanicsBuffer : null) || retained.mechanicsBuffer;
  const residentProductMass = mergedResidentProductMass || reaction.residentProductMass || inputResidentProductMass || null;
  if (!stateBuffer || !mechanicsBuffer) return null;
  if (!thermoBuffer) return null;
  return {
    residentProductMass,
    sphParticleUpload: {
      schema: ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
      status: 'webgpu-uploaded',
      sourceSchema: sphParticleState.schema,
      particleCount: sphParticleState.particleCount,
      stateStrideBytes: sphParticleState.stateStrideBytes,
      thermoStrideBytes: sphParticleState.thermoStrideBytes,
      stateBuffer,
      thermoBuffer,
      ownsStateBuffer: true,
      ownsThermoBuffer: Boolean(reaction.thermoBuffer || thermal.thermoBuffer),
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
      mechanicsBuffer,
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

async function residentStepEnvelope({
  sphParticleState,
  mlsMpmParticleState,
  sphParticleUpload = null,
  mlsMpmParticleUpload = null,
  p2gGridProjection,
  gridUpdate,
  g2pReconstruction,
  thermalStep = null,
  reactionStep = null,
  compactGpuSummary = null,
  dt,
  gravityMPerS2,
  boxDimsM,
  cflFactor,
  preferWebGpu,
  device = null,
  sourceSlot = 0,
  inputResidentProductMass = null,
  pressureInterfaceForceSolver = null,
  stageTiming = null
}) {
  const optionalStages = [thermalStep, reactionStep].filter(Boolean).map((stage) => stage?.result || stage);
  const stages = [p2gGridProjection, gridUpdate, g2pReconstruction, ...optionalStages];
  const backend = executionBackend(stages);
  const stageBuffersRetained = hasRetainedStageBuffers({ p2gGridProjection, gridUpdate });
  const g2pOutput = retainedG2pOutputBuffers(g2pReconstruction);
  const thermalOutput = retainedThermalOutputBuffers(thermalStep);
  const reactionOutput = retainedReactionOutputBuffers(reactionStep);
  const reactionOutputParticleMutation = reactionOutputMutatesParticles(reactionStep);
  const nextUsesReactionState = Boolean(reactionOutputParticleMutation && reactionOutput.stateBuffer);
  const nextUsesReactionThermo = Boolean(reactionOutputParticleMutation && reactionOutput.thermoBuffer);
  const nextUsesReactionMechanics = Boolean(reactionOutputParticleMutation && reactionOutput.mechanicsBuffer);
  const nextUsesThermalState = Boolean(!nextUsesReactionState && !g2pOutput.stateBuffer && thermalOutput.stateBuffer);
  const nextUsesThermalThermo = Boolean(!nextUsesReactionThermo && thermalOutput.thermoBuffer);
  const emittedResidentProductMass = reactionOutput.residentProductMass || null;
  const residentProductMass = await mergeResidentProductMassBuffersWebGpu({
    device,
    inputResidentProductMass,
    emittedResidentProductMass
  });
  const mergeStatus = residentProductMassMergeStatus({
    inputResidentProductMass,
    emittedResidentProductMass,
    mergedResidentProductMass: residentProductMass
  });
  const g2pOutputBuffersRetained = Boolean(g2pOutput.stateBuffer && g2pOutput.mechanicsBuffer);
  const thermalOutputRequired = Boolean(thermalStep);
  const reactionOutputRequired = Boolean(reactionStep);
  const thermalOutputBuffersRetained = thermalOutputRequired && Boolean(thermalOutput.stateBuffer && thermalOutput.thermoBuffer);
  const reactionOutputBuffersRetained = reactionOutputRequired && Boolean(reactionOutput.stateBuffer && reactionOutput.thermoBuffer && reactionOutput.mechanicsBuffer);
  const thermalOutputSatisfied = !thermalOutputRequired || thermalOutputBuffersRetained;
  const reactionOutputSatisfied = !reactionOutputRequired || reactionOutputBuffersRetained;
  const residentBuffersRetained = stageBuffersRetained
    && g2pOutputBuffersRetained
    && thermalOutputSatisfied
    && reactionOutputSatisfied;
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
    thermalStep,
    reactionStep,
    inputResidentProductMass,
    mergedResidentProductMass: residentProductMass,
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
    thermalStep,
    reactionStep,
    compactGpuSummary,
    readbackMode
  });
  const stageStatusSummary = {
    p2g: stageStatus(p2gGridProjection),
    gridUpdate: stageStatus(gridUpdate),
    g2p: stageStatus(g2pReconstruction),
    thermal: stageStatus(thermalStep?.result || thermalStep),
    reaction: stageStatus(reactionStep?.result || reactionStep)
  };
  const stageBackendSummary = {
    p2g: p2gGridProjection?.backend || null,
    gridUpdate: gridUpdate?.backend || null,
    g2p: g2pReconstruction?.backend || null,
    thermal: thermalStep?.backend || thermalStep?.result?.backend || null,
    reaction: reactionStep?.backend || reactionStep?.result?.backend || null
  };

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
    state: (reactionStep?.state?.length ? reactionStep.state : (thermalStep?.state?.length ? thermalStep.state : g2pReconstruction?.state)) ?? new Float32Array(),
    mechanics: (reactionStep?.mechanics?.length ? reactionStep.mechanics : g2pReconstruction?.mechanics) ?? new Float32Array(),
    p2gGridProjection,
    gridUpdate,
    g2pReconstruction,
    thermalStep,
    reactionStep,
    inputResidentProductMass,
    inputResidentProductMassStatus: inputResidentProductMass?.status ?? null,
    inputResidentProductMassProductEventRowCount: inputResidentProductMass?.productEventRowCount ?? 0,
    emittedResidentProductMass,
    emittedResidentProductMassStatus: emittedResidentProductMass?.status ?? null,
    emittedResidentProductMassProductEventRowCount: emittedResidentProductMass?.productEventRowCount ?? 0,
    residentProductMass,
    residentProductMassStatus: residentProductMass?.status ?? null,
    residentProductMassBufferRetained: residentProductMass?.productEventBufferRetained ?? false,
    residentProductMassBufferByteLength: residentProductMass?.productEventBufferByteLength ?? 0,
    residentProductMassProductEventRowCount: residentProductMass?.productEventRowCount ?? 0,
    residentProductMassUnplacedProductMassKg: residentProductMass?.unplacedProductMassKg ?? null,
    residentProductMassUnplacedGasProductMassKg: residentProductMass?.unplacedGasProductMassKg ?? null,
    residentProductMassGasSpeciesLedgerCount: residentProductMass?.gasSpeciesLedgerCount ?? 0,
    residentProductMassSealedBoxGasProductMoles: residentProductMass?.sealedBoxGasProductMoles ?? null,
    residentProductMassEosCouplingStatus: residentProductMass?.eosCouplingStatus ?? null,
    residentProductMassMergeStatus: mergeStatus,
    residentProductMassGenerationCount: residentProductMass?.productEventGenerationCount
      ?? ((inputResidentProductMass ? 1 : 0) + (emittedResidentProductMass ? 1 : 0)),
    mergedResidentProductMassProductEventRowCount: residentProductMass?.productEventRowCount ?? 0,
    residentProductMassMergedBufferByteLength: residentProductMass?.status === 'resident-product-mass-merged-gpu-resident'
      ? (residentProductMass.productEventBufferByteLength ?? 0)
      : 0,
    residentProductMassMergedInputBufferRetained: Boolean(inputResidentProductMass?.productEventBufferRetained),
    residentProductMassMergedEmittedBufferRetained: Boolean(emittedResidentProductMass?.productEventBufferRetained),
    residentProductMassGridCouplingStatus: p2gGridProjection?.residentProductMassGridCouplingStatus
      ?? p2gGridProjection?.gpuResult?.residentProductMassGridCouplingStatus
      ?? null,
    pressureInterfaceForceSolver,
    pressureInterfaceForceSolverSchema: gridUpdate?.pressureInterfaceForceSolverSchema ?? null,
    pressureInterfaceForceSolverStatus: gridUpdate?.pressureInterfaceForceSolverStatus ?? null,
    pressureInterfaceForceCouplingStatus: gridUpdate?.pressureInterfaceForceCouplingStatus ?? null,
    pressureInterfaceForceApplicationStatus: gridUpdate?.pressureInterfaceForceApplicationStatus ?? null,
    pressureInterfaceForceRowCount: gridUpdate?.pressureInterfaceForceRowCount ?? 0,
    pressureInterfaceAppliedImpulseNSeconds: [...(gridUpdate?.pressureInterfaceAppliedImpulseNSeconds ?? [0, 0, 0])],
    pressureInterfaceAppliedImpulseMagnitudeNSeconds: gridUpdate?.pressureInterfaceAppliedImpulseMagnitudeNSeconds ?? 0,
    pressureInterfaceAppliedImpulseSource: gridUpdate?.pressureInterfaceAppliedImpulseSource ?? null,
    pressureInterfaceImpulseProofStatus: gridUpdate?.pressureInterfaceImpulseProofStatus ?? null,
    pressureInterfaceForceConsumerStatus: gridUpdate?.pressureInterfaceForceConsumerStatus ?? null,
    stageStatus: stageStatusSummary,
    stageBackends: stageBackendSummary,
    stageTiming: stageTiming
      ? {
          ...stageTiming,
          backend,
          readbackMode,
          stageStatus: stageStatusSummary,
          stageBackends: stageBackendSummary
        }
      : null,
    residentBuffersRetained,
    stageBuffersRetained,
    g2pOutputBuffersRetained,
    thermalOutputBuffersRetained,
    reactionOutputBuffersRetained,
    residentBufferMode: residentBuffersRetained ? 'retained-stage-and-output-buffers' : 'cpu-artifact-fallback',
    particlePingPong,
    nextParticleUploads,
    nextParticleBufferMode: nextParticleUploads
      ? (nextUsesReactionState ? 'retained-reaction-output-buffers' : (thermalOutput.stateBuffer ? 'retained-thermal-output-and-g2p-mechanics-buffers' : 'retained-g2p-output-buffers'))
      : 'not-available',
    nextParticleStateBufferByteLength: (nextUsesReactionState ? reactionOutput.stateBufferByteLength : 0) || g2pOutput.stateBufferByteLength || thermalOutput.stateBufferByteLength,
    nextParticleThermoBufferByteLength: (nextUsesReactionThermo ? reactionOutput.thermoBufferByteLength : 0) || thermalOutput.thermoBufferByteLength,
    nextParticleMechanicsBufferByteLength: (nextUsesReactionMechanics ? reactionOutput.mechanicsBufferByteLength : 0) || g2pOutput.mechanicsBufferByteLength,
    g2pStateBufferReplacedByThermalStep: nextUsesThermalState,
    thermalThermoBufferHandoffStatus: thermalStep
      ? (nextUsesThermalThermo
        ? 'thermal-thermo-buffer-drives-next-particles'
        : 'thermal-thermo-buffer-skipped')
      : null,
    thermalStateBufferHandoffStatus: thermalStep
      ? (nextUsesThermalState
        ? 'thermal-state-buffer-drives-next-particles'
        : 'thermal-state-buffer-skipped-mechanical-state-from-g2p')
      : null,
    thermalOutputReplacedByReactionStep: nextUsesReactionState,
    g2pMechanicsBufferReplacedByReactionStep: nextUsesReactionMechanics,
    reactionOutputParticleMutation,
    reactionOutputBufferHandoffStatus: reactionStep
      ? (reactionOutputParticleMutation
        ? 'reaction-output-buffers-drive-next-particles'
        : 'reaction-output-buffers-skipped-no-particle-mutation')
      : null,
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
  residentProductMass = null,
  pressureInterfaceForceRowsBuffer = null,
  pressureInterfaceForceSolver = null,
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
  thermalMaterialTable = null,
  thermalStepRunner = runSphThermalStepWebGpu,
  thermalStepOptions = {},
  reactionTable = null,
  reactionStepRunner = runSphReactionStepWebGpu,
  reactionStepOptions = {},
  sourceSlot = sphParticleUpload?.slot ?? 0,
  readbackMode = FULL_READBACK_MODE
} = {}) {
  assertPackedInputs({ sphParticleState, mlsMpmParticleState });
  const dims = finiteVector3(boxDimsM, DEFAULT_BOX_DIMS_M);
  const gravity = finiteVector3(gravityMPerS2, DEFAULT_GRAVITY_M_PER_S2);
  const dtSeconds = finiteNumber(dt, 0);
  const requestedReadbackMode = readbackMode === NO_FULL_READBACK_MODE ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE;
  const stageTimingStartMs = nowMs();
  const stageMs = {};
  const recordStageMs = (name, startMs) => {
    stageMs[name] = Math.max(0, nowMs() - startMs);
  };
  const timedStage = async (name, runStage) => {
    const startMs = nowMs();
    try {
      return await runStage();
    } finally {
      recordStageMs(name, startMs);
    }
  };
  let lostInfo = null;
  let resolvedDeviceResult = deviceResult;
  const deviceAcquireStartMs = nowMs();
  try {
    if (preferWebGpu && !device && !deviceResult) {
      resolvedDeviceResult = await requestOpticalGpuDevice(navigatorRef, {
        onDeviceLost(info) {
          lostInfo = info;
          if (typeof onDeviceLost === 'function') onDeviceLost(info);
        }
      });
    }
  } finally {
    recordStageMs('deviceAcquire', deviceAcquireStartMs);
  }
  const resolvedDevice = device || resolvedDeviceResult?.device || null;
  const sharedDeviceResult = resolvedDevice
    ? { status: 'webgpu-device-ready', reason: device ? 'provided device' : (resolvedDeviceResult?.reason || 'resident step shared device'), device: resolvedDevice }
    : resolvedDeviceResult;

  const p2gGridProjection = await timedStage('p2gGridProjection', () => runMlsMpmP2gGridProjectionWithOptionalWebGpu({
    sphParticleState,
    mlsMpmParticleState,
    sphParticleUpload,
    mlsMpmParticleUpload,
    gridSpacingM,
    boxDimsM: dims,
    dt: dtSeconds,
    residentProductMass,
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
  }));

  const gridUpdate = await timedStage('gridUpdate', () => runMlsMpmGridUpdateWithOptionalWebGpu({
    p2gGridProjection,
    p2gGridBuffer: p2gGridProjection?.gpuResult?.gridBuffer ?? p2gGridProjection?.gridBuffer ?? null,
    pressureInterfaceForceRowsBuffer,
    pressureInterfaceForceSolver,
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
  }));

  const g2pReconstruction = await timedStage('g2pReconstruction', () => runMlsMpmG2pWithOptionalWebGpu({
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
  }));

  let thermalStep = null;
  stageMs.thermalStep = 0;
  if (
    thermalMaterialTable
    && typeof thermalStepRunner === 'function'
    && g2pReconstruction?.backend === 'webgpu'
    && sphParticleUpload?.status === 'webgpu-uploaded'
  ) {
    const g2pOutput = retainedG2pOutputBuffers(g2pReconstruction);
    if (g2pOutput.stateBuffer) {
      thermalStep = await timedStage('thermalStep', () => thermalStepRunner({
        device: resolvedDevice,
        sphParticleState,
        thermalMaterialTable,
        sphParticleUpload,
        sourceStateBuffer: g2pOutput.stateBuffer,
        sourceThermoBuffer: sphParticleUpload.thermoBuffer,
        boxDimsM: dims,
        dtS: dtSeconds,
        retainOutputParticleBuffers: true,
        readbackMode: requestedReadbackMode,
        ...thermalStepOptions
      }));
    }
  }

  let reactionStep = null;
  stageMs.reactionStep = 0;
  if (
    reactionTable?.reactionCount > 0
    && thermalMaterialTable
    && typeof reactionStepRunner === 'function'
    && g2pReconstruction?.backend === 'webgpu'
    && sphParticleUpload?.status === 'webgpu-uploaded'
  ) {
    const g2pOutput = retainedG2pOutputBuffers(g2pReconstruction);
    const thermalOutput = retainedThermalOutputBuffers(thermalStep);
    const sourceStateBuffer = thermalOutput.stateBuffer || g2pOutput.stateBuffer;
    const sourceThermoBuffer = thermalOutput.thermoBuffer || sphParticleUpload.thermoBuffer;
    if (sourceStateBuffer && sourceThermoBuffer && g2pOutput.mechanicsBuffer) {
      reactionStep = await timedStage('reactionStep', () => reactionStepRunner({
        device: resolvedDevice,
        sphParticleState,
        mlsMpmParticleState,
        reactionTable,
        thermalMaterialTable,
        sphParticleUpload,
        mlsMpmParticleUpload,
        sourceStateBuffer,
        sourceThermoBuffer,
        sourceMechanicsBuffer: g2pOutput.mechanicsBuffer,
        retainOutputParticleBuffers: true,
        readbackMode: requestedReadbackMode,
        ...reactionStepOptions
      }));
    }
  }

  const hasWebGpuLikeSummaryDevice = Boolean(resolvedDevice?.createBuffer && resolvedDevice.queue?.writeBuffer);
  const customSummaryRunner = summaryRunner && summaryRunner !== runMlsMpmResidentSummaryWebGpu;
  let compactGpuSummary = null;
  stageMs.compactSummary = 0;
  if (
    requestedReadbackMode === NO_FULL_READBACK_MODE
    && typeof summaryRunner === 'function'
    && (hasWebGpuLikeSummaryDevice || customSummaryRunner)
  ) {
    try {
      compactGpuSummary = await timedStage('compactSummary', () => summaryRunner({
        device: resolvedDevice,
        sphParticleState,
        mlsMpmParticleState,
        sphParticleUpload,
        mlsMpmParticleUpload,
        gridUpdate,
        g2pReconstruction,
        thermalStep,
        reactionStep
      }));
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
  const stageTiming = {
    schema: ULG_MLS_MPM_RESIDENT_STAGE_TIMING_SCHEMA,
    totalMs: Math.max(0, nowMs() - stageTimingStartMs),
    stageMs: { ...stageMs },
    requestedReadbackMode,
    preferWebGpu,
    compactSummaryRequested: requestedReadbackMode === NO_FULL_READBACK_MODE,
    thermalRequested: Boolean(thermalMaterialTable),
    reactionRequested: Boolean(reactionTable?.reactionCount > 0),
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };

  return await residentStepEnvelope({
    sphParticleState,
    mlsMpmParticleState,
    p2gGridProjection,
    gridUpdate,
    g2pReconstruction,
    thermalStep,
    reactionStep,
    inputResidentProductMass: residentProductMass,
    compactGpuSummary,
    dt: dtSeconds,
    gravityMPerS2: gravity,
    boxDimsM: dims,
    cflFactor,
    preferWebGpu,
    device: resolvedDevice,
    sphParticleUpload,
    mlsMpmParticleUpload,
    sourceSlot,
    pressureInterfaceForceSolver,
    stageTiming
  });
}

export function destroyMlsMpmResidentStepBuffers(step, {
  preserveResidentProductMass = null,
  preserveResidentProductMassHandles = [],
  destroyInputResidentProductMass = false
} = {}) {
  step?.p2gGridProjection?.gpuResult?.destroyGridBuffer?.();
  step?.p2gGridProjection?.destroyGridBuffer?.();
  step?.gridUpdate?.gpuResult?.destroyUpdatedGridBuffer?.();
  step?.gridUpdate?.destroyUpdatedGridBuffer?.();
  if (step?.nextParticleUploads) {
    const usedStateBuffer = step.nextParticleUploads.sphParticleUpload?.stateBuffer || null;
    const usedThermoBuffer = step.nextParticleUploads.sphParticleUpload?.thermoBuffer || null;
    const usedMechanicsBuffer = step.nextParticleUploads.mlsMpmParticleUpload?.mechanicsBuffer || null;
    const g2pOutput = retainedG2pOutputBuffers(step.g2pReconstruction);
    const thermalOutput = retainedThermalOutputBuffers(step.thermalStep);
    const reactionOutput = retainedReactionOutputBuffers(step.reactionStep);
    destroySphGpuParticleBuffers(step.nextParticleUploads.sphParticleUpload);
    destroyMlsMpmGpuParticleBuffers(step.nextParticleUploads.mlsMpmParticleUpload);
    if (g2pOutput.stateBuffer && g2pOutput.stateBuffer !== usedStateBuffer) g2pOutput.stateBuffer.destroy?.();
    if (g2pOutput.mechanicsBuffer && g2pOutput.mechanicsBuffer !== usedMechanicsBuffer) g2pOutput.mechanicsBuffer.destroy?.();
    if (thermalOutput.stateBuffer && thermalOutput.stateBuffer !== usedStateBuffer) thermalOutput.stateBuffer.destroy?.();
    if (thermalOutput.thermoBuffer && thermalOutput.thermoBuffer !== usedThermoBuffer) thermalOutput.thermoBuffer.destroy?.();
    if (reactionOutput.stateBuffer && reactionOutput.stateBuffer !== usedStateBuffer) reactionOutput.stateBuffer.destroy?.();
    if (reactionOutput.thermoBuffer && reactionOutput.thermoBuffer !== usedThermoBuffer) reactionOutput.thermoBuffer.destroy?.();
    if (reactionOutput.mechanicsBuffer && reactionOutput.mechanicsBuffer !== usedMechanicsBuffer) reactionOutput.mechanicsBuffer.destroy?.();
    destroyResidentProductMassFromStep(step, {
      preserveResidentProductMass,
      preserveResidentProductMassHandles,
      destroyInputResidentProductMass
    });
  } else if (step?.g2pReconstruction?.destroyOutputParticleBuffers) {
    step.g2pReconstruction.destroyOutputParticleBuffers();
  } else if (step?.reactionStep?.destroyOutputParticleBuffers) {
    step.reactionStep.destroyOutputParticleBuffers();
  } else if (step?.thermalStep?.destroyOutputParticleBuffers) {
    step.thermalStep.destroyOutputParticleBuffers();
  } else {
    step?.g2pReconstruction?.gpuResult?.destroyOutputParticleBuffers?.();
  }
}

function cloneSphParticleStateForNext(source, step) {
  const noFullReadback = step.readbackMode === NO_FULL_READBACK_MODE;
  const reactionResult = step.reactionStep?.result || step.reactionStep;
  const thermalResult = step.thermalStep?.result || step.thermalStep;
  return {
    ...source,
    status: noFullReadback ? 'gpu-resident-unread-ready' : 'gpu-resident-readback-ready',
    step: step.particlePingPong?.nextStep ?? ((source.step ?? 0) + 1),
    time: step.particlePingPong?.nextTime ?? ((source.time ?? 0) + (step.dt ?? 0)),
    state: noFullReadback ? source.state : (reactionResult?.state?.length ? reactionResult.state : (thermalResult?.state?.length ? thermalResult.state : step.state)),
    cpuStateStale: noFullReadback,
    thermo: noFullReadback ? source.thermo : (reactionResult?.thermo?.length ? reactionResult.thermo : (thermalResult?.thermo?.length ? thermalResult.thermo : source.thermo))
  };
}

function cloneMlsMpmParticleStateForNext(source, step) {
  const noFullReadback = step.readbackMode === NO_FULL_READBACK_MODE;
  const reactionResult = step.reactionStep?.result || step.reactionStep;
  return {
    ...source,
    status: noFullReadback ? 'gpu-resident-unread-ready' : 'gpu-resident-readback-ready',
    step: step.particlePingPong?.nextStep ?? ((source.step ?? 0) + 1),
    time: step.particlePingPong?.nextTime ?? ((source.time ?? 0) + (step.dt ?? 0)),
    mechanics: noFullReadback ? source.mechanics : (reactionResult?.mechanics?.length ? reactionResult.mechanics : step.mechanics),
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
    stageTiming: step.stageTiming
      ? {
          schema: step.stageTiming.schema,
          totalMs: step.stageTiming.totalMs,
          stageMs: { ...(step.stageTiming.stageMs || {}) },
          backend: step.stageTiming.backend || step.backend,
          readbackMode: step.stageTiming.readbackMode || step.readbackMode
        }
      : null,
    residentBuffersRetained: step.residentBuffersRetained,
    stageBuffersRetained: step.stageBuffersRetained,
    g2pOutputBuffersRetained: step.g2pOutputBuffersRetained,
    thermalStepRetained: Boolean(step.thermalStep?.retainedOutputParticleBuffers || step.thermalStep?.result?.retainedOutputParticleBuffers),
    reactionStepRetained: Boolean(step.reactionStep?.retainedOutputParticleBuffers || step.reactionStep?.result?.retainedOutputParticleBuffers),
    residentProductMassStatus: step.residentProductMassStatus ?? null,
    residentProductMassBufferRetained: step.residentProductMassBufferRetained ?? false,
    residentProductMassBufferByteLength: step.residentProductMassBufferByteLength ?? 0,
    residentProductMassProductEventRowCount: step.residentProductMassProductEventRowCount ?? 0,
    residentProductMassUnplacedProductMassKg: step.residentProductMassUnplacedProductMassKg ?? null,
    residentProductMassUnplacedGasProductMassKg: step.residentProductMassUnplacedGasProductMassKg ?? null,
    residentProductMassGasSpeciesLedgerCount: step.residentProductMassGasSpeciesLedgerCount ?? 0,
    residentProductMassSealedBoxGasProductMoles: step.residentProductMassSealedBoxGasProductMoles ?? null,
    residentProductMassEosCouplingStatus: step.residentProductMassEosCouplingStatus ?? null,
    residentProductMassMergeStatus: step.residentProductMassMergeStatus ?? null,
    residentProductMassGenerationCount: step.residentProductMassGenerationCount ?? 0,
    inputResidentProductMassProductEventRowCount: step.inputResidentProductMassProductEventRowCount ?? 0,
    emittedResidentProductMassProductEventRowCount: step.emittedResidentProductMassProductEventRowCount ?? 0,
    mergedResidentProductMassProductEventRowCount: step.mergedResidentProductMassProductEventRowCount ?? 0,
    residentProductMassMergedBufferByteLength: step.residentProductMassMergedBufferByteLength ?? 0,
    residentProductMassMergedInputBufferRetained: step.residentProductMassMergedInputBufferRetained ?? false,
    residentProductMassMergedEmittedBufferRetained: step.residentProductMassMergedEmittedBufferRetained ?? false,
    pressureInterfaceForceSolverSchema: step.pressureInterfaceForceSolverSchema ?? null,
    pressureInterfaceForceSolverStatus: step.pressureInterfaceForceSolverStatus ?? null,
    pressureInterfaceForceCouplingStatus: step.pressureInterfaceForceCouplingStatus ?? null,
    pressureInterfaceForceApplicationStatus: step.pressureInterfaceForceApplicationStatus ?? null,
    pressureInterfaceForceRowCount: step.pressureInterfaceForceRowCount ?? 0,
    pressureInterfaceAppliedImpulseNSeconds: [...(step.pressureInterfaceAppliedImpulseNSeconds ?? [0, 0, 0])],
    pressureInterfaceAppliedImpulseMagnitudeNSeconds: step.pressureInterfaceAppliedImpulseMagnitudeNSeconds ?? 0,
    pressureInterfaceAppliedImpulseSource: step.pressureInterfaceAppliedImpulseSource ?? null,
    pressureInterfaceImpulseProofStatus: step.pressureInterfaceImpulseProofStatus ?? null,
    pressureInterfaceForceConsumerStatus: step.pressureInterfaceForceConsumerStatus ?? null,
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
      compactGpuSummaryStatus: step.diagnostics?.compactGpuSummaryStatus ?? null,
      reactionSummaryAvailable: step.diagnostics?.reactionSummaryAvailable ?? false,
      reactionSummaryStatus: step.diagnostics?.reactionSummaryStatus ?? null,
      reactionCanonicalEventCount: step.diagnostics?.reactionCanonicalEventCount ?? null,
      reactionConsumedReactantMassKg: step.diagnostics?.reactionConsumedReactantMassKg ?? null,
      reactionLedgerVisibleProductMassKg: step.diagnostics?.reactionLedgerVisibleProductMassKg ?? null,
      reactionLedgerUnplacedProductMassKg: step.diagnostics?.reactionLedgerUnplacedProductMassKg ?? null,
      reactionLedgerGasProductMassKg: step.diagnostics?.reactionLedgerGasProductMassKg ?? null,
      reactionLedgerVisibleGasProductMassKg: step.diagnostics?.reactionLedgerVisibleGasProductMassKg ?? null,
      reactionLedgerUnplacedGasProductMassKg: step.diagnostics?.reactionLedgerUnplacedGasProductMassKg ?? null,
      reactionSealedBoxGasProductMoles: step.diagnostics?.reactionSealedBoxGasProductMoles ?? null,
      reactionHeatJ: step.diagnostics?.reactionHeatJ ?? null,
      reactionLedgerMassResidualKg: step.diagnostics?.reactionLedgerMassResidualKg ?? null,
	      reactionCompactLedgerAvailable: step.diagnostics?.reactionCompactLedgerAvailable ?? false,
      reactionProductInventoryCount: step.diagnostics?.reactionProductInventoryCount ?? 0,
      reactionProductInventoryReadbackByteLength: step.diagnostics?.reactionProductInventoryReadbackByteLength ?? 0,
      reactionProductEventRowCount: step.diagnostics?.reactionProductEventRowCount ?? 0,
      reactionProductEventActiveEventCount: step.diagnostics?.reactionProductEventActiveEventCount ?? 0,
      reactionProductEventReadbackByteLength: step.diagnostics?.reactionProductEventReadbackByteLength ?? 0,
      reactionProductEventBufferByteLength: step.diagnostics?.reactionProductEventBufferByteLength ?? 0,
      reactionProductEventBufferRetained: step.diagnostics?.reactionProductEventBufferRetained ?? false,
      reactionResidentProductMassStatus: step.diagnostics?.reactionResidentProductMassStatus ?? null,
      reactionResidentProductMassBufferRetained: step.diagnostics?.reactionResidentProductMassBufferRetained ?? false,
      reactionResidentProductMassBufferByteLength: step.diagnostics?.reactionResidentProductMassBufferByteLength ?? 0,
      reactionResidentProductMassProductEventRowCount: step.diagnostics?.reactionResidentProductMassProductEventRowCount ?? 0,
      reactionResidentProductMassUnplacedProductMassKg: step.diagnostics?.reactionResidentProductMassUnplacedProductMassKg ?? null,
      reactionResidentProductMassUnplacedGasProductMassKg: step.diagnostics?.reactionResidentProductMassUnplacedGasProductMassKg ?? null,
      reactionResidentProductMassEosCouplingStatus: step.diagnostics?.reactionResidentProductMassEosCouplingStatus ?? null,
	      reactionAtomResidualCount: step.diagnostics?.reactionAtomResidualCount ?? 0,
      reactionAtomResidualReadbackByteLength: step.diagnostics?.reactionAtomResidualReadbackByteLength ?? 0,
      reactionStrictGateStatus: step.diagnostics?.reactionStrictGateStatus ?? null,
      reactionStrictGateBlockers: [...(step.diagnostics?.reactionStrictGateBlockers || [])],
      reactionGasSpeciesLedgerCount: step.diagnostics?.reactionGasSpeciesLedgerCount ?? 0,
      reactionGasSpeciesReadbackByteLength: step.diagnostics?.reactionGasSpeciesReadbackByteLength ?? 0,
      pressureInterfaceForceSolverSchema: step.diagnostics?.pressureInterfaceForceSolverSchema ?? null,
      pressureInterfaceForceSolverStatus: step.diagnostics?.pressureInterfaceForceSolverStatus ?? null,
      pressureInterfaceForceCouplingStatus: step.diagnostics?.pressureInterfaceForceCouplingStatus ?? null,
      pressureInterfaceForceApplicationStatus: step.diagnostics?.pressureInterfaceForceApplicationStatus ?? null,
      pressureInterfaceForceRowCount: step.diagnostics?.pressureInterfaceForceRowCount ?? 0,
      pressureInterfaceAppliedImpulseNSeconds: [...(step.diagnostics?.pressureInterfaceAppliedImpulseNSeconds ?? [0, 0, 0])],
      pressureInterfaceAppliedImpulseMagnitudeNSeconds: step.diagnostics?.pressureInterfaceAppliedImpulseMagnitudeNSeconds ?? 0,
      pressureInterfaceAppliedImpulseSource: step.diagnostics?.pressureInterfaceAppliedImpulseSource ?? null,
      pressureInterfaceImpulseProofStatus: step.diagnostics?.pressureInterfaceImpulseProofStatus ?? null,
      pressureInterfaceForceConsumerStatus: step.diagnostics?.pressureInterfaceForceConsumerStatus ?? null
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
  let residentProductMass = args.residentProductMass ?? args.nextParticleUploads?.residentProductMass ?? null;
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
      residentProductMass,
      sourceSlot
    });
    step.sequenceIndex = index;
    stepSummaries.push(summarizeResidentStepForSequence(step, index));
    const carriedResidentProductMass = step.nextParticleUploads?.residentProductMass ?? step.residentProductMass ?? null;
    if (finalStep && !retainIntermediateSteps) {
      destroyMlsMpmResidentStepBuffers(finalStep, {
        preserveResidentProductMass: carriedResidentProductMass,
        preserveResidentProductMassHandles: [
          step.inputResidentProductMass,
          step.emittedResidentProductMass,
          carriedResidentProductMass
        ].filter(Boolean),
        destroyInputResidentProductMass: true
      });
    } else if (finalStep) {
      retainedSteps.push(finalStep);
    }
    finalStep = step;
    sphParticleState = cloneSphParticleStateForNext(sphParticleState, step);
    mlsMpmParticleState = cloneMlsMpmParticleStateForNext(mlsMpmParticleState, step);
    sphParticleUpload = step.nextParticleUploads?.sphParticleUpload ?? null;
    mlsMpmParticleUpload = step.nextParticleUploads?.mlsMpmParticleUpload ?? null;
    residentProductMass = carriedResidentProductMass;
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
    nextResidentProductMass: residentProductMass,
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
    destroyMlsMpmResidentStepBuffers(step, { destroyInputResidentProductMass: true });
  }
  destroyMlsMpmResidentStepBuffers(execution?.finalStep, { destroyInputResidentProductMass: true });
}
