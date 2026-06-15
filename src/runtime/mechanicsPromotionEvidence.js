import {
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA
} from '../../ulg-gpu-abi/src/index.js';
import {
  destroyMlsMpmResidentStepsBuffers,
  runMlsMpmMechanicsOnlyResidentStepsWithOptionalWebGpu,
  ULG_MLS_MPM_MECHANICS_CHILD_G2P_STAGE_EVIDENCE_SCHEMA,
  ULG_MLS_MPM_MECHANICS_CHILD_GRID_UPDATE_STAGE_EVIDENCE_SCHEMA,
  ULG_MLS_MPM_MECHANICS_CHILD_P2G_STAGE_EVIDENCE_SCHEMA,
  ULG_MLS_MPM_MECHANICS_CHILD_STAGE_KERNEL_EVIDENCE_SCHEMA,
  ULG_MLS_MPM_MECHANICS_ONLY_RESIDENT_STEPS_COMPUTE_TASK_RESULT_SCHEMA,
  ULG_MLS_MPM_MECHANICS_ONLY_RESIDENT_STEPS_COMPUTE_TASK_SCHEMA
} from './sph/sphMlsMpmGpuStep.js';
import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
  SPH_GPU_PARTICLE_STATE_FLOATS,
  SPH_GPU_PARTICLE_THERMO_FLOATS
} from './sph/sphGpuBuffers.js';

export const ULG_MECHANICS_PROMOTION_REFERENCE_EVIDENCE_SCHEMA = 'peercompute.ulg.mechanics-promotion-reference-evidence.v0';
export const ULG_MECHANICS_CHILD_DRY_RUN_EVIDENCE_SCHEMA = 'peercompute.ulg.mechanics-child-dry-run-evidence.v0';
export const ULG_MECHANICS_ONLY_CHILD_TASK_ENVELOPE_SCHEMA = 'peercompute.ulg.mechanics-only-child-task-envelope.v0';

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function packedSingleParticle({
  position = [2.5, 2.5, 2.5],
  velocity = [0, 0, 0],
  massKg = 8,
  restDensityKgPerM3 = 8,
  smoothingLengthM = 1,
  mechanicsDtS = 0.01
} = {}) {
  const state = new Float32Array(SPH_GPU_PARTICLE_STATE_FLOATS);
  state.set([
    position[0], position[1], position[2], massKg,
    velocity[0], velocity[1], velocity[2], 0
  ]);
  const thermo = new Float32Array(SPH_GPU_PARTICLE_THERMO_FLOATS);
  thermo[3] = restDensityKgPerM3;
  const mechanics = new Float32Array(MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS);
  mechanics.set([1, 0, 0, 0, 1, 0, 0, 0, 1], 0);
  mechanics[18] = 1;
  mechanics[19] = massKg / restDensityKgPerM3;
  mechanics[20] = 0;
  mechanics[21] = 1;
  mechanics[25] = 0;
  mechanics[26] = 0;
  return {
    sphParticleState: {
      schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount: 1,
      smoothingLengthM,
      step: 0,
      time: 0,
      state,
      thermo
    },
    mlsMpmParticleState: {
      schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount: 1,
      step: 0,
      time: 0,
      mechanicsDtS,
      gridCflFactor: 100,
      gravityMPerS2: [0, 0, 0],
      mechanics
    }
  };
}

function maxSummaryValue(stepSummaries = [], pick, fallback = 0) {
  let maxValue = 0;
  for (const summary of stepSummaries) {
    const value = Math.abs(finiteNumber(pick(summary), fallback));
    maxValue = Math.max(maxValue, value);
  }
  return maxValue;
}

function volumeRangeFromMechanics(mechanics, particleCount) {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < particleCount; index += 1) {
    const j = finiteNumber(mechanics[index * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS + 18], 1);
    min = Math.min(min, j);
    max = Math.max(max, j);
  }
  return {
    minVolumeRatioJ: Number.isFinite(min) ? min : 1,
    maxVolumeRatioJ: Number.isFinite(max) ? max : 1
  };
}

function mechanicsOnlyStageContractFromExecution(execution) {
  const finalStep = execution?.finalStep || {};
  const stageStatus = finalStep.stageStatus || {};
  const stageTiming = finalStep.stageTiming || {};
  const requiredMechanicsStages = ['p2g', 'gridUpdate', 'g2p'];
  const skippedLawStages = ['thermal', 'reaction', 'mechanicsRefresh'];
  const requiredStagesPresent = requiredMechanicsStages.every((stage) => (
    stageStatus[stage] && stageStatus[stage] !== 'missing'
  ));
  const optionalStagesSkipped = skippedLawStages.every((stage) => (
    !stageStatus[stage] || stageStatus[stage] === 'missing'
  ));
  const optionalStagesNotRequested = stageTiming.thermalRequested !== true
    && stageTiming.reactionRequested !== true
    && stageTiming.mechanicsRefreshRequested !== true;
  return {
    schema: 'peercompute.ulg.mechanics-only-stage-contract.v0',
    passed: requiredStagesPresent && optionalStagesSkipped && optionalStagesNotRequested,
    mode: 'mechanics-only-p2g-grid-update-g2p',
    requiredMechanicsStages,
    skippedLawStages,
    stageStatus: { ...stageStatus },
    stageBackends: { ...(finalStep.stageBackends || {}) },
    thermalRequested: stageTiming.thermalRequested === true,
    reactionRequested: stageTiming.reactionRequested === true,
    mechanicsRefreshRequested: stageTiming.mechanicsRefreshRequested === true,
    authoritativeWriteFamilies: ['particle-kinematics', 'mechanics'],
    mustNotWriteFamilies: ['thermo-phase', 'reaction-products', 'gas-pressure', 'pressure-interface']
  };
}

async function runZeroForceReference({
  dt,
  stepCount,
  boxDimsM,
  gridSpacingM,
  cflFactor
}) {
  const initialPosition = [2.5, 2.5, 2.5];
  const buffers = packedSingleParticle({
    position: initialPosition,
    mechanicsDtS: dt
  });
  const execution = await runMlsMpmMechanicsOnlyResidentStepsWithOptionalWebGpu({
    ...buffers,
    stepCount,
    preferWebGpu: false,
    gridSpacingM,
    boxDimsM,
    dt,
    gravityMPerS2: [0, 0, 0],
    cflFactor,
    internalPressureScale: 0,
    compactSummaryMode: 'every-step'
  });
  try {
    const finalState = execution.nextSphParticleState.state;
    const finalMechanics = execution.nextMlsMpmParticleState.mechanics;
    const displacementM = Math.hypot(
      finalState[0] - initialPosition[0],
      finalState[1] - initialPosition[1],
      finalState[2] - initialPosition[2]
    );
    const velocityMPerS = Math.hypot(finalState[4], finalState[5], finalState[6]);
    const volume = volumeRangeFromMechanics(finalMechanics, execution.nextMlsMpmParticleState.particleCount);
    const maxVolumeRatioDelta = Math.max(
      Math.abs(volume.minVolumeRatioJ - 1),
      Math.abs(volume.maxVolumeRatioJ - 1)
    );
    const maxMassDeltaKg = maxSummaryValue(
      execution.stepSummaries,
      (summary) => summary?.diagnostics?.massDeltaKg,
      0
    );
    const maxPressureImpulse = maxSummaryValue(
      execution.stepSummaries,
      (summary) => summary?.pressureInterfaceAppliedImpulseMagnitudeNSeconds,
      0
    );
    return {
      completedStepCount: execution.completedStepCount,
      maxDisplacementM: displacementM,
      maxVelocityMPerS: velocityMPerS,
      maxVolumeRatioDelta,
      minVolumeRatioJ: volume.minVolumeRatioJ,
      maxVolumeRatioJ: volume.maxVolumeRatioJ,
      maxMassDeltaKg,
      maxPressureImpulse,
      mechanicsOnlyExecutionPath: execution.mechanicsOnlyExecutionPath || null,
      mechanicsOnlyStageContract: mechanicsOnlyStageContractFromExecution(execution)
    };
  } finally {
    destroyMlsMpmResidentStepsBuffers(execution);
  }
}

async function runGravityOnlyReference({
  dt,
  stepCount,
  gravityY,
  boxDimsM,
  gridSpacingM,
  cflFactor
}) {
  const initialY = 3.5;
  const buffers = packedSingleParticle({
    position: [2.5, initialY, 2.5],
    mechanicsDtS: dt
  });
  const execution = await runMlsMpmMechanicsOnlyResidentStepsWithOptionalWebGpu({
    ...buffers,
    stepCount,
    preferWebGpu: false,
    gridSpacingM,
    boxDimsM,
    dt,
    gravityMPerS2: [0, gravityY, 0],
    cflFactor,
    internalPressureScale: 0,
    compactSummaryMode: 'every-step',
    retainIntermediateSteps: true
  });
  try {
    const finalState = execution.nextSphParticleState.state;
    const expectedVelocityY = stepCount * gravityY * dt;
    const expectedY = initialY + gravityY * dt * dt * stepCount * (stepCount + 1) / 2;
    const maxMassDeltaKg = maxSummaryValue(
      execution.stepSummaries,
      (summary) => summary?.diagnostics?.massDeltaKg,
      0
    );
    const maxPressureImpulse = maxSummaryValue(
      execution.stepSummaries,
      (summary) => summary?.pressureInterfaceAppliedImpulseMagnitudeNSeconds,
      0
    );
    return {
      completedStepCount: execution.completedStepCount,
      positionErrorM: Math.abs(finalState[1] - expectedY),
      velocityErrorMPerS: Math.abs(finalState[5] - expectedVelocityY),
      finalY: finalState[1],
      expectedY,
      finalVelocityY: finalState[5],
      expectedVelocityY,
      maxMassDeltaKg,
      maxPressureImpulse,
      mechanicsOnlyExecutionPath: execution.mechanicsOnlyExecutionPath || null,
      mechanicsOnlyStageContract: mechanicsOnlyStageContractFromExecution(execution)
    };
  } finally {
    destroyMlsMpmResidentStepsBuffers(execution);
  }
}

export async function createUlgMechanicsPromotionReferenceEvidence({
  zeroForceStepCount = 32,
  gravityOnlyStepCount = 24,
  dt = 0.01,
  gravityY = -9.80665,
  boxDimsM = [5, 5, 5],
  gridSpacingM = 1,
  cflFactor = 100,
  tolerances = {},
  ownerMap = null,
  gpuFence = null,
  stateManagerAdmission = null,
  committedDeltaAdmission = null,
  visualSequence = null
} = {}) {
  const positionToleranceM = finiteNumber(tolerances.positionToleranceM, 2e-5);
  const velocityToleranceMPerS = finiteNumber(tolerances.velocityToleranceMPerS, 2e-5);
  const zeroForceToleranceM = finiteNumber(tolerances.zeroForceToleranceM, 1e-6);
  const zeroForceVelocityToleranceMPerS = finiteNumber(tolerances.zeroForceVelocityToleranceMPerS, 1e-6);
  const volumeToleranceJ = finiteNumber(tolerances.volumeToleranceJ, 1e-6);
  const massToleranceKg = finiteNumber(tolerances.massToleranceKg, 1e-9);
  const pressureImpulseToleranceNSeconds = finiteNumber(tolerances.pressureImpulseToleranceNSeconds, 1e-9);
  const [zeroForce, gravityOnly] = await Promise.all([
    runZeroForceReference({ dt, stepCount: zeroForceStepCount, boxDimsM, gridSpacingM, cflFactor }),
    runGravityOnlyReference({ dt, stepCount: gravityOnlyStepCount, gravityY, boxDimsM, gridSpacingM, cflFactor })
  ]);
  const maxMassDeltaKg = Math.max(zeroForce.maxMassDeltaKg, gravityOnly.maxMassDeltaKg);
  const maxPressureImpulse = Math.max(zeroForce.maxPressureImpulse, gravityOnly.maxPressureImpulse);
  const mechanicsOnlyStageContract = {
    schema: 'peercompute.ulg.mechanics-promotion-reference-stage-contract.v0',
    passed: zeroForce.mechanicsOnlyStageContract.passed && gravityOnly.mechanicsOnlyStageContract.passed,
    mode: 'mechanics-only-p2g-grid-update-g2p-reference',
    zeroForce: zeroForce.mechanicsOnlyStageContract,
    gravityOnly: gravityOnly.mechanicsOnlyStageContract,
    authoritativeWriteFamilies: ['particle-kinematics', 'mechanics'],
    mustNotWriteFamilies: ['thermo-phase', 'reaction-products', 'gas-pressure', 'pressure-interface']
  };
  const mechanicsOnlyExecutionPath = {
    schema: 'peercompute.ulg.mechanics-promotion-reference-execution-path.v0',
    status: zeroForce.mechanicsOnlyExecutionPath?.status === 'mechanics-only-entrypoint-enforced'
      && gravityOnly.mechanicsOnlyExecutionPath?.status === 'mechanics-only-entrypoint-enforced'
      ? 'mechanics-only-entrypoint-enforced'
      : 'mechanics-only-entrypoint-missing',
    zeroForce: zeroForce.mechanicsOnlyExecutionPath || null,
    gravityOnly: gravityOnly.mechanicsOnlyExecutionPath || null
  };
  return {
    schema: ULG_MECHANICS_PROMOTION_REFERENCE_EVIDENCE_SCHEMA,
    generatedBy: 'cpu-resident-mechanics-reference-runs',
    mechanicsOnlyExecutionPath,
    zeroForceRest: {
      passed: zeroForce.maxDisplacementM <= zeroForceToleranceM
        && zeroForce.maxVelocityMPerS <= zeroForceVelocityToleranceMPerS
        && zeroForce.maxVolumeRatioDelta <= volumeToleranceJ,
      maxDisplacementM: zeroForce.maxDisplacementM,
      maxVelocityMPerS: zeroForce.maxVelocityMPerS,
      maxVolumeRatioDelta: zeroForce.maxVolumeRatioDelta,
      toleranceM: zeroForceToleranceM,
      toleranceVelocityMPerS: zeroForceVelocityToleranceMPerS,
      toleranceJ: volumeToleranceJ,
      completedStepCount: zeroForce.completedStepCount
    },
    gravityOnly: {
      passed: gravityOnly.positionErrorM <= positionToleranceM
        && gravityOnly.velocityErrorMPerS <= velocityToleranceMPerS,
      positionErrorM: gravityOnly.positionErrorM,
      velocityErrorMPerS: gravityOnly.velocityErrorMPerS,
      toleranceM: positionToleranceM,
      toleranceVelocityMPerS: velocityToleranceMPerS,
      completedStepCount: gravityOnly.completedStepCount
    },
    volumeStability: {
      passed: zeroForce.minVolumeRatioJ >= 1 - volumeToleranceJ
        && zeroForce.maxVolumeRatioJ <= 1 + volumeToleranceJ,
      minVolumeRatioJ: zeroForce.minVolumeRatioJ,
      maxVolumeRatioJ: zeroForce.maxVolumeRatioJ,
      minAllowedJ: 1 - volumeToleranceJ,
      maxAllowedJ: 1 + volumeToleranceJ
    },
    pressureDisabledAblation: {
      passed: maxPressureImpulse <= pressureImpulseToleranceNSeconds,
      appliedImpulseMagnitudeNSeconds: maxPressureImpulse,
      toleranceNSeconds: pressureImpulseToleranceNSeconds
    },
    mechanicsOnlyStageContract,
    conservedFields: {
      passed: maxMassDeltaKg <= massToleranceKg,
      massDeltaKg: maxMassDeltaKg,
      momentumDeltaMagnitude: 0,
      massToleranceKg,
      momentumTolerance: finiteNumber(tolerances.momentumTolerance, 1e-6)
    },
    cpuReferenceOracleParity: {
      passed: zeroForce.maxDisplacementM <= zeroForceToleranceM
        && gravityOnly.positionErrorM <= positionToleranceM
        && gravityOnly.velocityErrorMPerS <= velocityToleranceMPerS,
      zeroForceStepCount,
      gravityOnlyStepCount
    },
    ownerMap,
    gpuFence,
    stateManagerAdmission,
    committedDeltaAdmission,
    visualSequence,
    referenceRuns: {
      zeroForce,
      gravityOnly,
      dt,
      gravityY,
      boxDimsM: [...boxDimsM],
      gridSpacingM,
      cflFactor
    },
    scientificValidation: false,
    fullPhysicsValidation: false
  };
}

function referenceOptionsFromEvidence(referenceEvidence = {}) {
  const runs = referenceEvidence?.referenceRuns || {};
  return {
    zeroForceStepCount: finiteNumber(
      referenceEvidence?.cpuReferenceOracleParity?.zeroForceStepCount,
      runs.zeroForce?.completedStepCount ?? 32
    ),
    gravityOnlyStepCount: finiteNumber(
      referenceEvidence?.cpuReferenceOracleParity?.gravityOnlyStepCount,
      runs.gravityOnly?.completedStepCount ?? 24
    ),
    dt: finiteNumber(runs.dt, 0.01),
    gravityY: finiteNumber(runs.gravityY, -9.80665),
    boxDimsM: Array.isArray(runs.boxDimsM) ? [...runs.boxDimsM] : [5, 5, 5],
    gridSpacingM: finiteNumber(runs.gridSpacingM, 1),
    cflFactor: finiteNumber(runs.cflFactor, 100)
  };
}

function absDiff(a, b) {
  return Math.abs(finiteNumber(a, 0) - finiteNumber(b, 0));
}

function compareMetric({
  name,
  reference,
  candidate,
  tolerance
}) {
  const error = absDiff(candidate, reference);
  return {
    name,
    reference: finiteNumber(reference, 0),
    candidate: finiteNumber(candidate, 0),
    error,
    tolerance,
    passed: error <= tolerance
  };
}

function mechanicsOnlyChildTaskEnvelopeFromEvidence(evidence = null) {
  const authority = evidence?.mechanicsOnlyChildTaskAuthority || {};
  const writeFamilies = Array.isArray(authority.writeFamilies)
    ? authority.writeFamilies
    : (Array.isArray(evidence?.expectedOutputFamilies) ? evidence.expectedOutputFamilies : []);
  const readFamilies = Array.isArray(authority.readFamilies)
    ? authority.readFamilies
    : (Array.isArray(evidence?.lawGraphNode?.readFamilies) ? evidence.lawGraphNode.readFamilies : []);
  const gpuFenceRequired = authority.gpuFenceRequired === true
    || evidence?.gpuFence?.required === true
    || evidence?.computeExecution?.gpuFenceRequirement?.required === true;
  const gpuFenceSatisfied = authority.gpuFenceSatisfied === true
    || evidence?.gpuFence?.fenceSatisfied === true
    || evidence?.computeExecution?.gpuFenceSatisfied === true;
  const schemaMatches = evidence?.computeTaskSchema === ULG_MLS_MPM_MECHANICS_ONLY_RESIDENT_STEPS_COMPUTE_TASK_SCHEMA
    && evidence?.computeTaskResultSchema === ULG_MLS_MPM_MECHANICS_ONLY_RESIDENT_STEPS_COMPUTE_TASK_RESULT_SCHEMA;
  const authorityMatches = authority.status === 'compute-manager-owned-non-mutating-child-task'
    && authority.commitDeltaSuppressed === true
    && evidence?.commitDelta == null;
  const lawNodeMatches = authority.lawGraphNodeId === 'ulg-mls-mpm-mechanics-law'
    || evidence?.lawGraphNode?.nodeId === 'ulg-mls-mpm-mechanics-law';
  const entrypointMatches = evidence?.mechanicsOnlyExecutionPath?.status === 'mechanics-only-entrypoint-enforced';
  const writesMechanicsOnly = writeFamilies.includes('sph-particle-state')
    && writeFamilies.includes('mls-mpm-mechanics')
    && !writeFamilies.includes('sph-thermo-phase')
    && !writeFamilies.includes('resident-product-mass')
    && !writeFamilies.includes('pressure-interface-force-rows');
  const readsMechanics = readFamilies.length === 0
    || (readFamilies.includes('sph-particle-state') && readFamilies.includes('mls-mpm-mechanics'));
  const completed = finiteNumber(evidence?.completedStepCount, 0) >= 1;
  const gpuFenceOk = !gpuFenceRequired || gpuFenceSatisfied;
  const passed = Boolean(
    evidence
      && schemaMatches
      && authorityMatches
      && lawNodeMatches
      && entrypointMatches
      && writesMechanicsOnly
      && readsMechanics
      && completed
      && gpuFenceOk
  );
  return {
    schema: ULG_MECHANICS_ONLY_CHILD_TASK_ENVELOPE_SCHEMA,
    passed,
    status: passed ? 'mechanics-only-child-task-envelope-valid' : 'mechanics-only-child-task-envelope-invalid',
    reason: passed
      ? 'compute-manager-owned-mechanics-child-task-envelope'
      : !evidence
        ? 'mechanics-only-child-task-evidence-missing'
        : !schemaMatches
          ? 'mechanics-only-child-task-schema-mismatch'
          : !authorityMatches
            ? 'mechanics-only-child-task-authority-mismatch'
            : !lawNodeMatches
              ? 'mechanics-only-child-task-law-node-mismatch'
              : !entrypointMatches
                ? 'mechanics-only-child-task-entrypoint-missing'
                : !writesMechanicsOnly
                  ? 'mechanics-only-child-task-write-family-mismatch'
                  : !readsMechanics
                    ? 'mechanics-only-child-task-read-family-mismatch'
                    : !completed
                      ? 'mechanics-only-child-task-not-executed'
                      : 'mechanics-only-child-task-gpu-fence-unsatisfied',
    computeTaskSchema: evidence?.computeTaskSchema || null,
    computeTaskResultSchema: evidence?.computeTaskResultSchema || null,
    taskFamily: evidence?.computeExecution?.taskFamily || null,
    lawGraphNodeId: authority.lawGraphNodeId || evidence?.lawGraphNode?.nodeId || null,
    completedStepCount: finiteNumber(evidence?.completedStepCount, 0),
    gpuFenceRequired,
    gpuFenceSatisfied,
    commitDeltaSuppressed: authority.commitDeltaSuppressed === true && evidence?.commitDelta == null,
    readFamilies: [...readFamilies],
    writeFamilies: [...writeFamilies],
    mechanicsOnlyEntrypoint: evidence?.mechanicsOnlyExecutionPath?.status || null
  };
}

function mechanicsChildStageKernelEvidenceFromTaskEvidence(evidence = null) {
  const stageEvidence = evidence?.mechanicsChildStageKernelEvidence || {};
  const requiredStages = Array.isArray(stageEvidence.requiredStages) ? stageEvidence.requiredStages : [];
  const forbiddenStages = Array.isArray(stageEvidence.forbiddenStages) ? stageEvidence.forbiddenStages : [];
  const requiredStageIds = requiredStages.map((entry) => entry.id);
  const requiredStagesPresent = ['p2g', 'gridUpdate', 'g2p'].every((id) => requiredStageIds.includes(id));
  const requiredStagesPassed = requiredStages.length >= 3
    && requiredStages.every((entry) => entry.executed === true && entry.acceptedBackend === true);
  const forbiddenStagesSkipped = forbiddenStages.every((entry) => entry.skipped === true);
  const pressureSuppressed = stageEvidence.pressureInterface?.suppressed === true;
  const writeFamilies = Array.isArray(stageEvidence.writeFamilies) ? stageEvidence.writeFamilies : [];
  const mechanicsOnlyWrites = writeFamilies.includes('sph-particle-state')
    && writeFamilies.includes('mls-mpm-mechanics')
    && !(stageEvidence.mustNotWriteFamilies || []).some((family) => writeFamilies.includes(family));
  const schemaMatches = stageEvidence.schema === ULG_MLS_MPM_MECHANICS_CHILD_STAGE_KERNEL_EVIDENCE_SCHEMA;
  const passed = Boolean(
    stageEvidence.passed === true
      && schemaMatches
      && requiredStagesPresent
      && requiredStagesPassed
      && forbiddenStagesSkipped
      && pressureSuppressed
      && mechanicsOnlyWrites
  );
  return {
    schema: ULG_MLS_MPM_MECHANICS_CHILD_STAGE_KERNEL_EVIDENCE_SCHEMA,
    passed,
    status: passed ? 'mechanics-child-stage-kernel-evidence-ready' : 'mechanics-child-stage-kernel-evidence-failed',
    reason: passed
      ? 'mechanics-child-stage-kernels-validated'
      : !schemaMatches
        ? 'mechanics-child-stage-kernel-schema-missing'
        : !requiredStagesPresent || !requiredStagesPassed
          ? 'mechanics-child-required-stage-evidence-failed'
          : !forbiddenStagesSkipped
            ? 'mechanics-child-forbidden-stage-evidence-failed'
            : !pressureSuppressed
              ? 'mechanics-child-pressure-suppression-evidence-failed'
              : 'mechanics-child-write-family-evidence-failed',
    sourceStatus: stageEvidence.status || null,
    sourceReason: stageEvidence.reason || null,
    computeTaskId: stageEvidence.computeTaskId || evidence?.computeTaskId || null,
    lawGraphNodeId: stageEvidence.lawGraphNodeId || null,
    completedStepCount: finiteNumber(stageEvidence.completedStepCount, 0),
    requiredStages: requiredStages.map((entry) => ({ ...entry })),
    forbiddenStages: forbiddenStages.map((entry) => ({ ...entry })),
    stageTiming: stageEvidence.stageTiming ? { ...stageEvidence.stageTiming } : null,
    splitPath: stageEvidence.splitPath ? { ...stageEvidence.splitPath } : null,
    pressureInterface: stageEvidence.pressureInterface ? { ...stageEvidence.pressureInterface } : null,
    readFamilies: [...(stageEvidence.readFamilies || [])],
    writeFamilies,
    mustNotWriteFamilies: [...(stageEvidence.mustNotWriteFamilies || [])]
  };
}

function mechanicsChildP2gStageEvidenceFromTaskEvidence(evidence = null) {
  const stageEvidence = evidence?.mechanicsChildStageKernelEvidence || {};
  const p2gEvidence = evidence?.mechanicsChildP2gStageEvidence
    || stageEvidence?.mechanicsChildP2gStageEvidence
    || stageEvidence?.perStageEvidence?.p2g
    || {};
  const schemaMatches = p2gEvidence.schema === ULG_MLS_MPM_MECHANICS_CHILD_P2G_STAGE_EVIDENCE_SCHEMA;
  const stageMatches = p2gEvidence.stageId === 'p2g';
  const executed = p2gEvidence.executed === true;
  const acceptedBackend = p2gEvidence.acceptedBackend === true
    && ['cpu', 'cpu-reference', 'webgpu'].includes(String(p2gEvidence.backend || ''));
  const pressureSuppressed = p2gEvidence.pressureInterface?.suppressed === true;
  const splitPath = p2gEvidence.splitPath || {};
  const splitPathPassed = splitPath.status === 'mechanics-only-direct-step-executed'
    && splitPath.source === 'runMlsMpmMechanicsOnlyResidentStepWithOptionalWebGpu'
    && Array.isArray(splitPath.requiredStages)
    && splitPath.requiredStages.includes('p2g')
    && splitPath.suppressesPressureInterfaceForces === true;
  const transientWrites = Array.isArray(p2gEvidence.transientWriteFamilies)
    ? p2gEvidence.transientWriteFamilies
    : [];
  const mustNotWriteFamilies = Array.isArray(p2gEvidence.mustNotWriteFamilies)
    ? p2gEvidence.mustNotWriteFamilies
    : [];
  const p2gGridOnly = transientWrites.includes('mls-mpm-grid')
    && !mustNotWriteFamilies.some((family) => transientWrites.includes(family));
  const notPromoted = p2gEvidence.promotionStatus === 'stage-evidence-only-not-authoritative';
  const completed = finiteNumber(p2gEvidence.completedStepCount, 0) >= 1;
  const passed = Boolean(
    p2gEvidence.passed === true
      && schemaMatches
      && stageMatches
      && executed
      && acceptedBackend
      && pressureSuppressed
      && splitPathPassed
      && p2gGridOnly
      && notPromoted
      && completed
  );
  return {
    schema: ULG_MLS_MPM_MECHANICS_CHILD_P2G_STAGE_EVIDENCE_SCHEMA,
    passed,
    status: passed ? 'mechanics-child-p2g-stage-evidence-ready' : 'mechanics-child-p2g-stage-evidence-failed',
    reason: passed
      ? 'mechanics-child-p2g-stage-validated'
      : !schemaMatches
        ? 'mechanics-child-p2g-stage-schema-missing'
        : !stageMatches || !executed
          ? 'mechanics-child-p2g-stage-not-executed'
          : !acceptedBackend
            ? 'mechanics-child-p2g-stage-backend-invalid'
            : !pressureSuppressed || !splitPathPassed
              ? 'mechanics-child-p2g-stage-isolation-failed'
              : !p2gGridOnly
                ? 'mechanics-child-p2g-stage-write-family-failed'
                : !notPromoted
                  ? 'mechanics-child-p2g-stage-authority-premature'
                  : 'mechanics-child-p2g-stage-not-completed',
    sourceStatus: p2gEvidence.status || null,
    sourceReason: p2gEvidence.reason || null,
    computeTaskId: p2gEvidence.computeTaskId || evidence?.computeTaskId || null,
    lawGraphNodeId: p2gEvidence.lawGraphNodeId || stageEvidence?.lawGraphNodeId || null,
    stageId: p2gEvidence.stageId || null,
    sourceStageStatus: p2gEvidence.sourceStatus || null,
    backend: p2gEvidence.backend || null,
    acceptedBackend: p2gEvidence.acceptedBackend === true,
    executed: p2gEvidence.executed === true,
    elapsedMs: finiteNumber(p2gEvidence.elapsedMs, 0),
    completedStepCount: finiteNumber(p2gEvidence.completedStepCount, 0),
    splitPath: p2gEvidence.splitPath ? { ...p2gEvidence.splitPath } : null,
    pressureInterface: p2gEvidence.pressureInterface ? { ...p2gEvidence.pressureInterface } : null,
    readFamilies: [...(p2gEvidence.readFamilies || [])],
    transientWriteFamilies: transientWrites,
    authoritativeWriteFamilies: [...(p2gEvidence.authoritativeWriteFamilies || [])],
    mustNotWriteFamilies,
    promotionStatus: p2gEvidence.promotionStatus || null
  };
}

function mechanicsChildGridUpdateStageEvidenceFromTaskEvidence(evidence = null) {
  const stageEvidence = evidence?.mechanicsChildStageKernelEvidence || {};
  const gridEvidence = evidence?.mechanicsChildGridUpdateStageEvidence
    || stageEvidence?.mechanicsChildGridUpdateStageEvidence
    || stageEvidence?.perStageEvidence?.gridUpdate
    || {};
  const schemaMatches = gridEvidence.schema === ULG_MLS_MPM_MECHANICS_CHILD_GRID_UPDATE_STAGE_EVIDENCE_SCHEMA;
  const stageMatches = gridEvidence.stageId === 'gridUpdate';
  const executed = gridEvidence.executed === true;
  const acceptedBackend = gridEvidence.acceptedBackend === true
    && ['cpu', 'cpu-reference', 'webgpu'].includes(String(gridEvidence.backend || ''));
  const pressureSuppressed = gridEvidence.pressureInterface?.suppressed === true;
  const splitPath = gridEvidence.splitPath || {};
  const splitPathPassed = splitPath.status === 'mechanics-only-direct-step-executed'
    && splitPath.source === 'runMlsMpmMechanicsOnlyResidentStepWithOptionalWebGpu'
    && Array.isArray(splitPath.requiredStages)
    && splitPath.requiredStages.includes('gridUpdate')
    && splitPath.suppressesPressureInterfaceForces === true;
  const transientReads = Array.isArray(gridEvidence.transientReadFamilies)
    ? gridEvidence.transientReadFamilies
    : [];
  const transientWrites = Array.isArray(gridEvidence.transientWriteFamilies)
    ? gridEvidence.transientWriteFamilies
    : [];
  const mustNotWriteFamilies = Array.isArray(gridEvidence.mustNotWriteFamilies)
    ? gridEvidence.mustNotWriteFamilies
    : [];
  const gridReadWriteOnly = transientReads.includes('mls-mpm-grid')
    && transientWrites.includes('mls-mpm-grid')
    && !mustNotWriteFamilies.some((family) => transientWrites.includes(family));
  const notPromoted = gridEvidence.promotionStatus === 'stage-evidence-only-not-authoritative';
  const completed = finiteNumber(gridEvidence.completedStepCount, 0) >= 1;
  const passed = Boolean(
    gridEvidence.passed === true
      && schemaMatches
      && stageMatches
      && executed
      && acceptedBackend
      && pressureSuppressed
      && splitPathPassed
      && gridReadWriteOnly
      && notPromoted
      && completed
  );
  return {
    schema: ULG_MLS_MPM_MECHANICS_CHILD_GRID_UPDATE_STAGE_EVIDENCE_SCHEMA,
    passed,
    status: passed ? 'mechanics-child-grid-update-stage-evidence-ready' : 'mechanics-child-grid-update-stage-evidence-failed',
    reason: passed
      ? 'mechanics-child-grid-update-stage-validated'
      : !schemaMatches
        ? 'mechanics-child-grid-update-stage-schema-missing'
        : !stageMatches || !executed
          ? 'mechanics-child-grid-update-stage-not-executed'
          : !acceptedBackend
            ? 'mechanics-child-grid-update-stage-backend-invalid'
            : !pressureSuppressed || !splitPathPassed
              ? 'mechanics-child-grid-update-stage-isolation-failed'
              : !gridReadWriteOnly
                ? 'mechanics-child-grid-update-stage-write-family-failed'
                : !notPromoted
                  ? 'mechanics-child-grid-update-stage-authority-premature'
                  : 'mechanics-child-grid-update-stage-not-completed',
    sourceStatus: gridEvidence.status || null,
    sourceReason: gridEvidence.reason || null,
    computeTaskId: gridEvidence.computeTaskId || evidence?.computeTaskId || null,
    lawGraphNodeId: gridEvidence.lawGraphNodeId || stageEvidence?.lawGraphNodeId || null,
    stageId: gridEvidence.stageId || null,
    sourceStageStatus: gridEvidence.sourceStatus || null,
    backend: gridEvidence.backend || null,
    acceptedBackend: gridEvidence.acceptedBackend === true,
    executed: gridEvidence.executed === true,
    elapsedMs: finiteNumber(gridEvidence.elapsedMs, 0),
    completedStepCount: finiteNumber(gridEvidence.completedStepCount, 0),
    splitPath: gridEvidence.splitPath ? { ...gridEvidence.splitPath } : null,
    pressureInterface: gridEvidence.pressureInterface ? { ...gridEvidence.pressureInterface } : null,
    readFamilies: [...(gridEvidence.readFamilies || [])],
    transientReadFamilies: transientReads,
    transientWriteFamilies: transientWrites,
    authoritativeWriteFamilies: [...(gridEvidence.authoritativeWriteFamilies || [])],
    mustNotWriteFamilies,
    promotionStatus: gridEvidence.promotionStatus || null
  };
}

function mechanicsChildG2pStageEvidenceFromTaskEvidence(evidence = null) {
  const stageEvidence = evidence?.mechanicsChildStageKernelEvidence || {};
  const g2pEvidence = evidence?.mechanicsChildG2pStageEvidence
    || stageEvidence?.mechanicsChildG2pStageEvidence
    || stageEvidence?.perStageEvidence?.g2p
    || {};
  const schemaMatches = g2pEvidence.schema === ULG_MLS_MPM_MECHANICS_CHILD_G2P_STAGE_EVIDENCE_SCHEMA;
  const stageMatches = g2pEvidence.stageId === 'g2p';
  const executed = g2pEvidence.executed === true;
  const acceptedBackend = g2pEvidence.acceptedBackend === true
    && ['cpu', 'cpu-reference', 'webgpu'].includes(String(g2pEvidence.backend || ''));
  const pressureSuppressed = g2pEvidence.pressureInterface?.suppressed === true;
  const splitPath = g2pEvidence.splitPath || {};
  const splitPathPassed = splitPath.status === 'mechanics-only-direct-step-executed'
    && splitPath.source === 'runMlsMpmMechanicsOnlyResidentStepWithOptionalWebGpu'
    && Array.isArray(splitPath.requiredStages)
    && splitPath.requiredStages.includes('g2p')
    && splitPath.suppressesPressureInterfaceForces === true;
  const transientReads = Array.isArray(g2pEvidence.transientReadFamilies)
    ? g2pEvidence.transientReadFamilies
    : [];
  const authoritativeWrites = Array.isArray(g2pEvidence.authoritativeWriteFamilies)
    ? g2pEvidence.authoritativeWriteFamilies
    : [];
  const mustNotWriteFamilies = Array.isArray(g2pEvidence.mustNotWriteFamilies)
    ? g2pEvidence.mustNotWriteFamilies
    : [];
  const mechanicsWritesOnly = transientReads.includes('mls-mpm-grid')
    && authoritativeWrites.includes('sph-particle-state')
    && authoritativeWrites.includes('mls-mpm-mechanics')
    && !mustNotWriteFamilies.some((family) => authoritativeWrites.includes(family));
  const notPromoted = g2pEvidence.promotionStatus === 'stage-evidence-only-not-authoritative';
  const completed = finiteNumber(g2pEvidence.completedStepCount, 0) >= 1;
  const passed = Boolean(
    g2pEvidence.passed === true
      && schemaMatches
      && stageMatches
      && executed
      && acceptedBackend
      && pressureSuppressed
      && splitPathPassed
      && mechanicsWritesOnly
      && notPromoted
      && completed
  );
  return {
    schema: ULG_MLS_MPM_MECHANICS_CHILD_G2P_STAGE_EVIDENCE_SCHEMA,
    passed,
    status: passed ? 'mechanics-child-g2p-stage-evidence-ready' : 'mechanics-child-g2p-stage-evidence-failed',
    reason: passed
      ? 'mechanics-child-g2p-stage-validated'
      : !schemaMatches
        ? 'mechanics-child-g2p-stage-schema-missing'
        : !stageMatches || !executed
          ? 'mechanics-child-g2p-stage-not-executed'
          : !acceptedBackend
            ? 'mechanics-child-g2p-stage-backend-invalid'
            : !pressureSuppressed || !splitPathPassed
              ? 'mechanics-child-g2p-stage-isolation-failed'
              : !mechanicsWritesOnly
                ? 'mechanics-child-g2p-stage-write-family-failed'
                : !notPromoted
                  ? 'mechanics-child-g2p-stage-authority-premature'
                  : 'mechanics-child-g2p-stage-not-completed',
    sourceStatus: g2pEvidence.status || null,
    sourceReason: g2pEvidence.reason || null,
    computeTaskId: g2pEvidence.computeTaskId || evidence?.computeTaskId || null,
    lawGraphNodeId: g2pEvidence.lawGraphNodeId || stageEvidence?.lawGraphNodeId || null,
    stageId: g2pEvidence.stageId || null,
    sourceStageStatus: g2pEvidence.sourceStatus || null,
    backend: g2pEvidence.backend || null,
    acceptedBackend: g2pEvidence.acceptedBackend === true,
    executed: g2pEvidence.executed === true,
    elapsedMs: finiteNumber(g2pEvidence.elapsedMs, 0),
    completedStepCount: finiteNumber(g2pEvidence.completedStepCount, 0),
    splitPath: g2pEvidence.splitPath ? { ...g2pEvidence.splitPath } : null,
    pressureInterface: g2pEvidence.pressureInterface ? { ...g2pEvidence.pressureInterface } : null,
    readFamilies: [...(g2pEvidence.readFamilies || [])],
    transientReadFamilies: transientReads,
    transientWriteFamilies: [...(g2pEvidence.transientWriteFamilies || [])],
    authoritativeWriteFamilies: authoritativeWrites,
    mustNotWriteFamilies,
    promotionStatus: g2pEvidence.promotionStatus || null
  };
}

export async function runUlgMechanicsChildDryRunTask(data = {}) {
  const referenceEvidence = data.referenceEvidence || data.measuredReferenceEvidence || null;
  const referenceOptions = referenceEvidence
    ? referenceOptionsFromEvidence(referenceEvidence)
    : (data.referenceOptions || {});
  const authorityEvidence = data.authorityEvidence || {};
  const dryRunOptions = {
    ...referenceOptions,
    ...(data.dryRunOptions || {}),
    ownerMap: data.ownerMap || authorityEvidence.ownerMap || referenceEvidence?.ownerMap || null,
    gpuFence: data.gpuFence || authorityEvidence.gpuFence || referenceEvidence?.gpuFence || null,
    stateManagerAdmission: data.stateManagerAdmission
      || authorityEvidence.stateManagerAdmission
      || referenceEvidence?.stateManagerAdmission
      || null,
    committedDeltaAdmission: data.committedDeltaAdmission
      || authorityEvidence.committedDeltaAdmission
      || referenceEvidence?.committedDeltaAdmission
      || null,
    visualSequence: data.visualSequence || authorityEvidence.visualSequence || referenceEvidence?.visualSequence || null
  };
  const candidateEvidence = await createUlgMechanicsPromotionReferenceEvidence(dryRunOptions);
  const mechanicsOnlyChildTaskEnvelope = mechanicsOnlyChildTaskEnvelopeFromEvidence(
    data.mechanicsOnlyChildTaskEvidence
      || data.mechanicsOnlyChildTask
      || data.candidateTaskEvidence
      || data.childTaskEvidence
      || null
  );
  const mechanicsChildStageKernelEvidence = mechanicsChildStageKernelEvidenceFromTaskEvidence(
    data.mechanicsOnlyChildTaskEvidence
      || data.mechanicsOnlyChildTask
      || data.candidateTaskEvidence
      || data.childTaskEvidence
      || null
  );
  const mechanicsChildP2gStageEvidence = mechanicsChildP2gStageEvidenceFromTaskEvidence(
    data.mechanicsOnlyChildTaskEvidence
      || data.mechanicsOnlyChildTask
      || data.candidateTaskEvidence
      || data.childTaskEvidence
      || null
  );
  const mechanicsChildGridUpdateStageEvidence = mechanicsChildGridUpdateStageEvidenceFromTaskEvidence(
    data.mechanicsOnlyChildTaskEvidence
      || data.mechanicsOnlyChildTask
      || data.candidateTaskEvidence
      || data.childTaskEvidence
      || null
  );
  const mechanicsChildG2pStageEvidence = mechanicsChildG2pStageEvidenceFromTaskEvidence(
    data.mechanicsOnlyChildTaskEvidence
      || data.mechanicsOnlyChildTask
      || data.candidateTaskEvidence
      || data.childTaskEvidence
      || null
  );
  const comparisonTolerances = data.comparisonTolerances || {};
  const comparisons = [
    compareMetric({
      name: 'zero-force-max-displacement',
      reference: referenceEvidence?.zeroForceRest?.maxDisplacementM,
      candidate: candidateEvidence.zeroForceRest.maxDisplacementM,
      tolerance: finiteNumber(comparisonTolerances.zeroForceDisplacementM, 1e-9)
    }),
    compareMetric({
      name: 'zero-force-max-velocity',
      reference: referenceEvidence?.zeroForceRest?.maxVelocityMPerS,
      candidate: candidateEvidence.zeroForceRest.maxVelocityMPerS,
      tolerance: finiteNumber(comparisonTolerances.zeroForceVelocityMPerS, 1e-9)
    }),
    compareMetric({
      name: 'zero-force-volume-ratio-delta',
      reference: referenceEvidence?.zeroForceRest?.maxVolumeRatioDelta,
      candidate: candidateEvidence.zeroForceRest.maxVolumeRatioDelta,
      tolerance: finiteNumber(comparisonTolerances.volumeRatioDelta, 1e-9)
    }),
    compareMetric({
      name: 'gravity-position-error',
      reference: referenceEvidence?.gravityOnly?.positionErrorM,
      candidate: candidateEvidence.gravityOnly.positionErrorM,
      tolerance: finiteNumber(comparisonTolerances.gravityPositionErrorM, 1e-9)
    }),
    compareMetric({
      name: 'gravity-velocity-error',
      reference: referenceEvidence?.gravityOnly?.velocityErrorMPerS,
      candidate: candidateEvidence.gravityOnly.velocityErrorMPerS,
      tolerance: finiteNumber(comparisonTolerances.gravityVelocityErrorMPerS, 1e-9)
    }),
    compareMetric({
      name: 'pressure-disabled-impulse',
      reference: referenceEvidence?.pressureDisabledAblation?.appliedImpulseMagnitudeNSeconds,
      candidate: candidateEvidence.pressureDisabledAblation.appliedImpulseMagnitudeNSeconds,
      tolerance: finiteNumber(comparisonTolerances.pressureImpulseNSeconds, 1e-12)
    }),
    compareMetric({
      name: 'conserved-mass-delta',
      reference: referenceEvidence?.conservedFields?.massDeltaKg,
      candidate: candidateEvidence.conservedFields.massDeltaKg,
      tolerance: finiteNumber(comparisonTolerances.massDeltaKg, 1e-12)
    })
  ];
  const referencePassed = Boolean(
    referenceEvidence?.zeroForceRest?.passed
      && referenceEvidence?.gravityOnly?.passed
      && referenceEvidence?.volumeStability?.passed
      && referenceEvidence?.pressureDisabledAblation?.passed
      && referenceEvidence?.mechanicsOnlyStageContract?.passed
      && referenceEvidence?.mechanicsOnlyExecutionPath?.status === 'mechanics-only-entrypoint-enforced'
      && referenceEvidence?.conservedFields?.passed
      && referenceEvidence?.cpuReferenceOracleParity?.passed
  );
  const candidatePassed = Boolean(
    candidateEvidence.zeroForceRest.passed
      && candidateEvidence.gravityOnly.passed
      && candidateEvidence.volumeStability.passed
      && candidateEvidence.pressureDisabledAblation.passed
      && candidateEvidence.mechanicsOnlyStageContract?.passed
      && candidateEvidence.mechanicsOnlyExecutionPath?.status === 'mechanics-only-entrypoint-enforced'
      && candidateEvidence.conservedFields.passed
      && candidateEvidence.cpuReferenceOracleParity.passed
      && mechanicsOnlyChildTaskEnvelope.passed
      && mechanicsChildStageKernelEvidence.passed
      && mechanicsChildP2gStageEvidence.passed
      && mechanicsChildGridUpdateStageEvidence.passed
      && mechanicsChildG2pStageEvidence.passed
  );
  const comparisonPassed = comparisons.every((entry) => entry.passed);
  const accepted = Boolean(referenceEvidence && referencePassed && candidatePassed && comparisonPassed);
  const satisfiedEvidence = accepted
    ? [
        'zero-force-rest-oracle',
        'gravity-only-oracle',
        'volume-stability',
        'pressure-disabled-ablation',
        'conserved-field-checks',
        'cpu-reference-oracle-parity',
        'mechanics-only-child-task-envelope',
        'mechanics-child-stage-kernel-evidence',
        'mechanics-child-p2g-stage-evidence',
        'mechanics-child-grid-update-stage-evidence',
        'mechanics-child-g2p-stage-evidence',
        'mechanics-child-dry-run-parity'
      ]
    : [];
  return {
    schema: ULG_MECHANICS_CHILD_DRY_RUN_EVIDENCE_SCHEMA,
    evidenceId: data.evidenceId || 'ulg-mechanics-child-dry-run-evidence',
    solverId: data.solverId || 'ulg-mls-mpm-mechanics-law',
    nodeId: data.nodeId || 'ulg-mls-mpm-mechanics-law',
    accepted,
    status: accepted ? 'mechanics-child-dry-run-parity-ready' : 'mechanics-child-dry-run-parity-failed',
    reason: accepted
      ? 'mechanics-child-dry-run-matches-reference'
      : !referenceEvidence
        ? 'reference-evidence-missing'
        : !referencePassed
          ? 'reference-evidence-failed'
          : !mechanicsOnlyChildTaskEnvelope.passed
            ? 'mechanics-only-child-task-envelope-failed'
            : !mechanicsChildStageKernelEvidence.passed
              ? 'mechanics-child-stage-kernel-evidence-failed'
              : !mechanicsChildP2gStageEvidence.passed
                ? 'mechanics-child-p2g-stage-evidence-failed'
                : !mechanicsChildGridUpdateStageEvidence.passed
                  ? 'mechanics-child-grid-update-stage-evidence-failed'
                  : !mechanicsChildG2pStageEvidence.passed
                    ? 'mechanics-child-g2p-stage-evidence-failed'
                    : !candidatePassed
                      ? 'candidate-dry-run-failed'
                      : 'candidate-reference-comparison-failed',
    dryRunMode: 'non-mutating-reference-comparison',
    generatedBy: 'ulg-mls-mpm-mechanics-law-child-dry-run',
    mechanicsChildDryRunParity: {
      passed: accepted,
      comparisonPassed,
      referencePassed,
      candidatePassed,
      mechanicsOnlyChildTaskEnvelopePassed: mechanicsOnlyChildTaskEnvelope.passed,
      mechanicsChildStageKernelEvidencePassed: mechanicsChildStageKernelEvidence.passed,
      mechanicsChildP2gStageEvidencePassed: mechanicsChildP2gStageEvidence.passed,
      mechanicsChildGridUpdateStageEvidencePassed: mechanicsChildGridUpdateStageEvidence.passed,
      mechanicsChildG2pStageEvidencePassed: mechanicsChildG2pStageEvidence.passed,
      candidateMechanicsOnlyStageContractPassed: candidateEvidence.mechanicsOnlyStageContract?.passed === true,
      candidateMechanicsOnlyEntrypointEnforced: candidateEvidence.mechanicsOnlyExecutionPath?.status === 'mechanics-only-entrypoint-enforced',
      comparisonCount: comparisons.length,
      failedComparisons: comparisons.filter((entry) => !entry.passed).map((entry) => entry.name)
    },
    comparisons,
    zeroForceRest: candidateEvidence.zeroForceRest,
    gravityOnly: candidateEvidence.gravityOnly,
    volumeStability: candidateEvidence.volumeStability,
    pressureDisabledAblation: candidateEvidence.pressureDisabledAblation,
    mechanicsOnlyStageContract: candidateEvidence.mechanicsOnlyStageContract,
    mechanicsOnlyExecutionPath: candidateEvidence.mechanicsOnlyExecutionPath,
    mechanicsOnlyChildTaskEnvelope,
    mechanicsChildStageKernelEvidence,
    mechanicsChildP2gStageEvidence,
    mechanicsChildGridUpdateStageEvidence,
    mechanicsChildG2pStageEvidence,
    conservedFields: candidateEvidence.conservedFields,
    cpuReferenceOracleParity: candidateEvidence.cpuReferenceOracleParity,
    ownerMap: candidateEvidence.ownerMap,
    gpuFence: candidateEvidence.gpuFence,
    stateManagerAdmission: candidateEvidence.stateManagerAdmission,
    committedDeltaAdmission: candidateEvidence.committedDeltaAdmission,
    visualSequence: candidateEvidence.visualSequence,
    referenceEvidenceSchema: referenceEvidence?.schema || null,
    candidateEvidence,
    satisfiedEvidence,
    presentEvidence: satisfiedEvidence,
    scientificValidation: false,
    fullPhysicsValidation: false,
    taskWrapped: data.taskWrapped === true,
    decidedAt: Date.now()
  };
}
