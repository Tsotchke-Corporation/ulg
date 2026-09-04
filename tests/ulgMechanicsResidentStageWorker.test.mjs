import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
  ULG_SPH_GPU_REACTION_TABLE_SCHEMA,
  ULG_REACTION_CLOSURE_SCHEMA,
  SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT,
  MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT,
  SPH_GPU_REACTION_ATOM_TERM_ROW_LAYOUT,
  SPH_GPU_REACTION_GAS_PRODUCT_ROW_LAYOUT,
  SPH_GPU_REACTION_HEADER_ROW_LAYOUT,
  SPH_GPU_REACTION_PRODUCT_PHASE_ROW_LAYOUT,
  SPH_GPU_REACTION_PRODUCT_TERM_ROW_LAYOUT,
  SPH_GPU_REACTION_REACTANT_TERM_ROW_LAYOUT,
  SPH_GPU_REACTION_RECORD_ROW_LAYOUT,
  SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_ADMITTED,
  SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_READY,
  SCHROEDER_CROSS_LEVEL_REFLUX_PHASE_CONSUMED,
  SCHROEDER_CROSS_LEVEL_REFLUX_TERMINAL_RECEIPT_CONSUMED,
  createSchroederCrossLevelRefluxLedgerHeader
} from '../ulg-gpu-abi/src/index.js';
import {
  ULG_MECHANICS_RESIDENT_STAGE_WORKER_RESULT_SCHEMA,
  ULG_WORKER_RESIDENT_SCHEDULE_MAX_STEP_COUNT,
  ULG_WORKER_RESIDENT_SCHEDULE_CONTROL_PLANE_YIELD_RECEIPT_SCHEMA,
  ULG_WORKER_RESIDENT_SCHEDULE_QUEUE_DRAIN_INTERVAL_STEPS,
  ULG_WORKER_RESIDENT_SCHEDULE_STEP_SUMMARY_RING_CAPACITY,
  ULG_WORKER_RESIDENT_SCHEDULE_PROGRESS_SCHEMA,
  ULG_WORKER_RESIDENT_SCHEDULE_RESULT_SCHEMA,
  ULG_WORKER_RESIDENT_SCHEDULE_STEP_SUMMARY_SCHEMA,
  ULG_WORKER_SCHEDULE_DYNAMIC_LAW_OBSERVATION_SCHEMA,
  ULG_WORKER_SCHROEDER_EPOCH_SEAL_SCHEMA,
  ULG_WORKER_SCHROEDER_LANE_SEED_LINEAGE_WORD_FIELDS,
  ULG_WORKER_SCHROEDER_LANE_SEED_STAGE_SCHEMA,
  ULG_WORKER_SCHROEDER_SAME_LEVEL_MECHANICS_STAGE_SCHEMA,
  ULG_WORKER_SCHROEDER_SPATIAL_EPOCH_STAGE_SCHEMA,
  cancelUlgMechanicsResidentStageWorkerSchedule,
  createWorkerSchroederLaneLevelAssignmentProvider,
  exportUlgMechanicsResidentStageWorkerRetainedCompactSnapshot,
  releaseUlgMechanicsResidentStageWorkerLane,
  resolveUlgMechanicsResidentStageWorkerRetainedParticleState,
  resolveUlgMechanicsResidentStageWorkerDeviceResult,
  runUlgMechanicsResidentStageWorkerPayload,
  runUlgMechanicsResidentStageWorkerSchedulePayload
} from '../src/services/ulgMechanicsResidentStage.worker.js';
import {
  buildSphDispersedMediumGpuBuffers,
  validateSphDispersedMediumGpuBufferAuthority
} from '../src/runtime/sph/sphDispersedMediumGpuBuffers.js';
import {
  createSchroederTargetScheduleAuthority,
  createSchroederTargetScheduleConfiguration,
  createSchroederTargetScheduleProviderAuthority,
  createSchroederWorkerHierarchyConfig,
  schroederTargetScheduleConfigurationReceipt,
  validateSchroederWorkerScheduleExecutionRouteReceipt
} from '../src/runtime/sph/schroederWorkerLaneControlPlane.js';
import {
  SCHROEDER_DYNAMIC_LAW_ROUTING_AUTHORITY,
  SCHROEDER_DYNAMIC_LAW_ROUTING_EXECUTION_GATE,
  SCHROEDER_DYNAMIC_LAW_ROUTING_SHADOW_ONLY
} from '../src/runtime/sph/schroederDynamicLawRoutingContract.js';
import {
  SPH_CANONICAL_CONTACT_MOTION_BOUND_REVISION,
  SPH_CANONICAL_CONTACT_POSITION_TRUST_DIAMETERS
} from '../src/runtime/sph/sphCanonicalContactMotionBound.js';
import {
  releaseSchroederSpatialEpochGenerationAfterQueue,
  runSchroederSpatialEpochGenerationWebGpu,
  validateSchroederSpatialEpochGenerationLevelAssignment
} from '../src/runtime/sph/schroederSpatialEpochGpu.js';
import {
  createSchroederSameLevelMechanicsSpatialEpochTransaction,
  runSchroederLevelAssignmentWebGpu,
  runSchroederSameLevelMechanicsWebGpu
} from '../src/runtime/sph/schroederHierarchyGpu.js';
import {
  ULG_SPH_GAS_PRESSURE_AUTHORITY_TELEMETRY_SCHEMA,
  ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA,
  isExactSphSpatialGasPressureAuthoritySource
} from '../src/runtime/sph/sphSpatialGasLedgerEosGpu.js';
import * as sphSpatialGasLedgerEosGpu from '../src/runtime/sph/sphSpatialGasLedgerEosGpu.js';
import {
  isExactSphPressureInterfaceCompletionReceipt,
  runSphPressureInterfaceForceRowsWebGpu
} from '../src/runtime/sph/sphPressureInterfaceGpuKernel.js';
import {
  tagResidentProductMassDevice,
  tagWebGpuBufferDevice,
  webGpuDeviceId
} from '../src/runtime/sph/sphGpuDeviceIdentity.js';
import {
  diagnoseUploadedMechanicsMaterialPhaseRecordsMatch
} from '../src/runtime/sph/sphMechanicsRefreshGpuKernel.js';
import {
  publishUlgPressureInterfaceGasCellFieldAdmission,
  publishUlgPressureInterfaceGasCellFieldImportSource
} from '../src/runtime/peercomputeBrowserResidentHost.js';
import {
  SCHROEDER_FUSED_TERMINAL_REFLUX_RECEIPT_TARGET_OPTION,
  ULG_SCHROEDER_FUSED_TERMINAL_REFLUX_RECEIPT_COPY_SCHEMA
} from '../src/runtime/sph/schroederFusedFineSubstepGpu.js';
import {
  SPH_GPU_PARTICLE_IDENTITY_UINTS,
  uploadSphGpuParticleDispersedMediumOpticsSidecar
} from '../src/runtime/sph/sphGpuBuffers.js';
import {
  mergeResidentProductMassBuffersWebGpu,
  runMlsMpmResidentStepsWithOptionalWebGpu,
  transferTopologyStableSphDispersedMediumOpticsOwnership
} from '../src/runtime/sph/sphMlsMpmGpuStep.js';
import {
  ULG_WORKER_TIER0_PRESENTATION_QOS_BOUNDARY_PROOF_SCHEMA,
  ULG_WORKER_TIER0_PRESENTATION_QOS_BOUNDARY_PROOF_STATUS,
  ULG_WORKER_TIER0_PRESENTATION_QOS_MAX_SUBSTEPS_PER_SUBMISSION,
  createWorkerTier0PresentationQosPlan,
  resolveWorkerTier0PresentationQosSubsteps
} from '../src/runtime/sph/sphWorkerPresentationQos.js';
import {
  ULG_SPH_REACTION_MOTION_ENVELOPE_WATCH_PROPOSAL_SCHEMA,
  runCanonicalSphReactionMotionEnvelopeWatchWebGpu
} from '../src/runtime/sph/sphReactionMotionEnvelopeWatchGpu.js';
import {
  SPH_REACTION_ACTIVATION_OBSERVATION_ENCODED_COUNT_BIAS,
  isExactSphReactionMotionEnvelope
} from '../src/runtime/sph/sphReactionMotionEnvelope.js';
import {
  buildSphThermalMaterialTable
} from '../src/runtime/sph/sphThermalGpuKernel.js';
import {
  createReferenceMaterialClosures
} from '../src/runtime/material/materialClosures.js';

const NATIVE_MESSAGE_CHANNEL = globalThis.MessageChannel;

test('worker Tier0 presentation QoS is one shared route-generic policy', () => {
  assert.equal(
    ULG_WORKER_TIER0_PRESENTATION_QOS_MAX_SUBSTEPS_PER_SUBMISSION,
    2
  );
  assert.equal(resolveWorkerTier0PresentationQosSubsteps({
    requestedStepCount: 64,
    presentationRequested: true
  }), 2);
  assert.equal(resolveWorkerTier0PresentationQosSubsteps({
    requestedStepCount: 64,
    presentationRequested: false
  }), 64);
  assert.equal(resolveWorkerTier0PresentationQosSubsteps(), null);
  const plan = createWorkerTier0PresentationQosPlan({
    requestedStepCount: 64,
    presentationRequested: true,
    targetHz: 60,
    dtS: 0.001
  });
  const noPresentationPlan = createWorkerTier0PresentationQosPlan({
    requestedStepCount: 64,
    presentationRequested: false,
    targetHz: 60,
    dtS: 0.001
  });
  assert.equal(plan.effectiveSubstepsPerSubmission, 2);
  assert.equal(plan.presentationSlotCount, 32);
  assert.equal(plan.expectedWallHorizonS, 32 / 60);
  assert.equal(plan.simulationHorizonS, 0.064);
  assert.equal(plan.presentationRequested, true);
  assert.equal(noPresentationPlan.effectiveSubstepsPerSubmission, 64);
  assert.equal(noPresentationPlan.presentationSlotCount, 1);
  assert.equal(noPresentationPlan.presentationRequested, false);
  assert.equal(Object.isFrozen(plan), true);
});

function instrumentResidentScheduleMessageChannels(testContext) {
  const previousMessageChannel = globalThis.MessageChannel;
  const stats = {
    constructionCount: 0,
    port1CloseCount: 0,
    port2CloseCount: 0
  };
  class InstrumentedMessageChannel {
    constructor() {
      stats.constructionCount += 1;
      const channel = new NATIVE_MESSAGE_CHANNEL();
      this.port1 = {
        get onmessage() { return channel.port1.onmessage; },
        set onmessage(handler) { channel.port1.onmessage = handler; },
        get onmessageerror() { return channel.port1.onmessageerror; },
        set onmessageerror(handler) {
          channel.port1.onmessageerror = handler;
        },
        start() { channel.port1.start(); },
        close() {
          stats.port1CloseCount += 1;
          channel.port1.close();
        }
      };
      this.port2 = {
        postMessage(...args) { channel.port2.postMessage(...args); },
        close() {
          stats.port2CloseCount += 1;
          channel.port2.close();
        }
      };
    }
  }
  globalThis.MessageChannel = InstrumentedMessageChannel;
  testContext.after(() => {
    globalThis.MessageChannel = previousMessageChannel;
  });
  return stats;
}

function manualBuffers({
  position = [1.25, 1.25, 1.25],
  velocity = [0, 0, 0],
  massKg = 8,
  smoothingLengthM = 1,
  restDensityKgPerM3 = 8,
  mechanicsDtS = 0.1
} = {}) {
  const state = new Float32Array([
    position[0], position[1], position[2], massKg,
    velocity[0], velocity[1], velocity[2], 123
  ]);
  const thermo = new Float32Array(12);
  thermo[3] = restDensityKgPerM3;
  const mechanics = new Float32Array(MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length);
  mechanics.set([1, 0, 0, 0, 1, 0, 0, 0, 1], 0);
  mechanics[18] = 1;
  mechanics[19] = massKg / restDensityKgPerM3;
  mechanics[20] = 1;
  mechanics[21] = 1;
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
      gridCflFactor: 10,
      gravityMPerS2: [0, 0, 0],
      mechanics
    }
  };
}

function authorizedReactionWatchTable(records, { gasProductCount = 0 } = {}) {
  assert.ok(records instanceof Float32Array);
  assert.equal(
    records.length % SPH_GPU_REACTION_RECORD_ROW_LAYOUT.length,
    0
  );
  const reactionCount =
    records.length / SPH_GPU_REACTION_RECORD_ROW_LAYOUT.length;
  const reactionHeaders = new Float32Array(
    reactionCount * SPH_GPU_REACTION_HEADER_ROW_LAYOUT.length
  );
  const reactantTermRecords = new Float32Array(0);
  const productTermCount = gasProductCount > 0 ? 1 : 0;
  const productTermRecords = new Float32Array(
    productTermCount * SPH_GPU_REACTION_PRODUCT_TERM_ROW_LAYOUT.length
  );
  const gasProductRecords = new Float32Array(
    gasProductCount * SPH_GPU_REACTION_GAS_PRODUCT_ROW_LAYOUT.length
  );
  if (gasProductCount > 0) {
    reactionHeaders[4] = productTermCount;
    reactionHeaders[6] = gasProductCount;
    reactionHeaders[10] = 1;
    productTermRecords.set([
      0, 7, 1, 0.018, 1, 1, 3, 1,
      0, 0, 4, 0, 0, 7, 0, 0
    ]);
    gasProductRecords.set([
      0, 0, 7, 1, 0.018, 1, 1, 0
    ]);
  }
  const atomTermRecords = new Float32Array(0);
  const productPhaseRecords = new Float32Array(0);
  const combinedRecords = new Float32Array([
    ...records,
    ...productPhaseRecords,
    ...reactionHeaders,
    ...reactantTermRecords,
    ...productTermRecords,
    ...gasProductRecords,
    ...atomTermRecords
  ]);
  return Object.freeze({
    schema: ULG_SPH_GPU_REACTION_TABLE_SCHEMA,
    reactionClosureSchema: ULG_REACTION_CLOSURE_SCHEMA,
    status: 'derived-reaction-table-ready',
    reactionCount,
    reactionHeaderCount: reactionCount,
    reactantTermCount: 0,
    productTermCount,
    gasProductCount,
    atomTermCount: 0,
    productPhaseCount: 0,
    combinedRecordCount: combinedRecords.length / 4,
    recordLayout: [...SPH_GPU_REACTION_RECORD_ROW_LAYOUT],
    reactionHeaderLayout: [...SPH_GPU_REACTION_HEADER_ROW_LAYOUT],
    reactantTermLayout: [...SPH_GPU_REACTION_REACTANT_TERM_ROW_LAYOUT],
    productTermLayout: [...SPH_GPU_REACTION_PRODUCT_TERM_ROW_LAYOUT],
    gasProductLayout: [...SPH_GPU_REACTION_GAS_PRODUCT_ROW_LAYOUT],
    atomTermLayout: [...SPH_GPU_REACTION_ATOM_TERM_ROW_LAYOUT],
    productPhaseLayout: [...SPH_GPU_REACTION_PRODUCT_PHASE_ROW_LAYOUT],
    recordStrideFloats: SPH_GPU_REACTION_RECORD_ROW_LAYOUT.length,
    reactionHeaderStrideFloats: SPH_GPU_REACTION_HEADER_ROW_LAYOUT.length,
    reactantTermStrideFloats:
      SPH_GPU_REACTION_REACTANT_TERM_ROW_LAYOUT.length,
    productTermStrideFloats:
      SPH_GPU_REACTION_PRODUCT_TERM_ROW_LAYOUT.length,
    gasProductStrideFloats:
      SPH_GPU_REACTION_GAS_PRODUCT_ROW_LAYOUT.length,
    atomTermStrideFloats: SPH_GPU_REACTION_ATOM_TERM_ROW_LAYOUT.length,
    productPhaseStrideFloats:
      SPH_GPU_REACTION_PRODUCT_PHASE_ROW_LAYOUT.length,
    records,
    reactionHeaders,
    reactantTermRecords,
    productTermRecords,
    gasProductRecords,
    atomTermRecords,
    productPhaseRecords,
    combinedRecords
  });
}

function thermalPhaseLatchReactionWatchTable() {
  const records = new Float32Array([
    1, 2, 3, 100,
    -100, 1, 1, 1,
    1, 0, 0, 0
  ]);
  return authorizedReactionWatchTable(records);
}

function lawsQuiescentSingleLaneBuffers(options = {}) {
  const base = manualBuffers(options);
  const phaseCarrierPlan = {
    schema: 'peercompute.ulg.sph-phase-carrier-plan.v2',
    status: 'phase-lane-capacity-ready',
    lineageCapacity: 1,
    primaryCapacity: 1,
    phaseLaneCount: 1,
    phaseLaneStride: 1,
    companionStart: 1,
    companionCapacity: 0,
    particleCapacity: 1,
    stableLaneAddress: 'phaseLane*phaseLaneStride+lineageIndex',
    phaseCompanionLanesRequired: false,
    reason: 'laws-quiescent'
  };
  return {
    sphParticleState: {
      ...base.sphParticleState,
      identity: new Uint32Array([101]),
      identityRevision: 'tier0-laws-quiescent-identity',
      phaseCarrierPlan
    },
    mlsMpmParticleState: {
      ...base.mlsMpmParticleState,
      phaseCarrierPlan: { ...phaseCarrierPlan }
    }
  };
}

function phaseCarrierBuffers(options = {}) {
  const base = manualBuffers(options);
  const phaseLaneCount = 4;
  const stateStride = base.sphParticleState.state.length;
  const thermoStride = base.sphParticleState.thermo.length;
  const mechanicsStride = base.mlsMpmParticleState.mechanics.length;
  const state = new Float32Array(stateStride * phaseLaneCount);
  const thermo = new Float32Array(thermoStride * phaseLaneCount);
  const mechanics = new Float32Array(mechanicsStride * phaseLaneCount);
  for (let phaseLane = 0; phaseLane < phaseLaneCount; phaseLane += 1) {
    state.set(base.sphParticleState.state, phaseLane * stateStride);
    thermo.set(base.sphParticleState.thermo, phaseLane * thermoStride);
    mechanics.set(base.mlsMpmParticleState.mechanics, phaseLane * mechanicsStride);
    if (phaseLane > 0) {
      state[phaseLane * stateStride + 3] = 0;
      state[phaseLane * stateStride + 4] = 0;
      state[phaseLane * stateStride + 5] = 0;
      state[phaseLane * stateStride + 6] = 0;
      mechanics[phaseLane * mechanicsStride + 19] = 0;
    }
  }
  const phaseCarrierPlan = {
    schema: 'peercompute.ulg.sph-phase-carrier-plan.v2',
    status: 'phase-lane-capacity-ready',
    lineageCapacity: 1,
    primaryCapacity: 1,
    phaseLaneCount,
    phaseLaneStride: 1,
    companionStart: 1,
    companionCapacity: 3,
    particleCapacity: 4,
    stableLaneAddress: 'phaseLane*phaseLaneStride+lineageIndex',
    localOnlyArray: [1, 2, 3],
    localOnlyBuffer: { label: 'must-not-cross-worker-metadata-boundary' }
  };
  return {
    sphParticleState: {
      ...base.sphParticleState,
      particleCount: 4,
      state,
      thermo,
      phaseCarrierPlan
    },
    mlsMpmParticleState: {
      ...base.mlsMpmParticleState,
      particleCount: 4,
      mechanics,
      phaseCarrierPlan: { ...phaseCarrierPlan }
    }
  };
}

function stage(id, reads = [], writes = []) {
  return {
    id,
    lawNodeId: `ulg-mls-mpm-mechanics-${id}-stage`,
    runtimeTarget: 'gpu-hub-resident-stage-worker',
    reads,
    writes
  };
}

function payload(stageRecord, context, input = null, {
  laneId = 'ulg:test:mechanics-worker-lane',
  stateKey = 'ulg:test:mechanics-worker-state'
} = {}) {
  return {
    stage: stageRecord,
    input,
    lease: {
      laneId,
      stateKey,
      queueFencePolicy: 'queue.onSubmittedWorkDone-before-admission'
    },
    context: {
      ulgMechanicsResidentStageWorker: context
    }
  };
}

class FakeGpuBuffer {
  constructor({
    label = null,
    size = 4,
    usage = 0,
    mappedAtCreation = false
  } = {}) {
    this.label = label;
    this.size = Math.max(4, Math.round(Number(size) || 4));
    this.usage = usage;
    this.bytes = new Uint8Array(this.size);
    this.destroyed = false;
    this.destroyCount = 0;
    this.mapState = mappedAtCreation ? 'mapped' : 'unmapped';
    this.mappedAtCreation = mappedAtCreation;
  }

  mapAsync() {
    if (this.destroyed) throw new Error(`${this.label || 'buffer'} was destroyed`);
    this.mapState = 'mapped';
    return Promise.resolve();
  }

  getMappedRange(offset = 0, size = this.bytes.byteLength - offset) {
    if (this.destroyed) throw new Error(`${this.label || 'buffer'} was destroyed`);
    const start = Math.max(0, Math.round(Number(offset) || 0));
    const end = Math.min(this.bytes.byteLength, start + Math.max(0, Math.round(Number(size) || 0)));
    return start === 0 && end === this.bytes.byteLength
      ? this.bytes.buffer
      : this.bytes.buffer.slice(start, end);
  }

  unmap() { this.mapState = 'unmapped'; }

  destroy() {
    this.destroyCount += 1;
    this.destroyed = true;
    this.mapState = 'unmapped';
  }
}

function createFakeGpuDevice() {
  return {
    lost: new Promise(() => {}),
    pushErrorScope() {},
    async popErrorScope() { return null; },
    limits: {
      maxBufferSize: 256 * 1024 * 1024,
      maxStorageBufferBindingSize: 128 * 1024 * 1024,
      maxUniformBufferBindingSize: 64 * 1024,
      maxStorageBuffersPerShaderStage: 16,
      maxComputeWorkgroupsPerDimension: 65_535,
      maxComputeWorkgroupStorageSize: 32 * 1024,
      minUniformBufferOffsetAlignment: 256
    },
    createBuffer(descriptor = {}) {
      return new FakeGpuBuffer(descriptor);
    },
    createShaderModule(descriptor = {}) {
      return { ...descriptor };
    },
    createComputePipeline(descriptor = {}) {
      return {
        ...descriptor,
        getBindGroupLayout(index) {
          return { index, entryPoint: descriptor.compute?.entryPoint || null };
        }
      };
    },
    createBindGroup(descriptor = {}) {
      return { ...descriptor };
    },
    createCommandEncoder() {
      const ops = [];
      return {
        copyBufferToBuffer(source, sourceOffset, target, targetOffset, size) {
          ops.push({ type: 'copy', source, sourceOffset, target, targetOffset, size });
        },
        clearBuffer(buffer, offset = 0, size = buffer.size - offset) {
          ops.push({ type: 'clear', buffer, offset, size });
        },
        beginComputePass() {
          return {
            setPipeline() {},
            setBindGroup() {},
            dispatchWorkgroups() {},
            dispatchWorkgroupsIndirect() {},
            end() {}
          };
        },
        finish() {
          return ops;
        }
      };
    },
    queue: {
      writeBufferCalls: [],
      submitCalls: [],
      writeBuffer(buffer, offset, data) {
        if (buffer.destroyed) throw new Error(`${buffer.label || 'buffer'} was destroyed`);
        const bytes = data instanceof ArrayBuffer
          ? new Uint8Array(data)
          : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        buffer.bytes.set(bytes, Math.max(0, Math.round(Number(offset) || 0)));
        this.writeBufferCalls.push({ buffer, offset, byteLength: bytes.byteLength });
      },
      submit(commandBuffers) {
        this.submitCalls.push(commandBuffers);
        for (const commandBuffer of commandBuffers || []) {
          for (const op of commandBuffer || []) {
            if (op.type === 'clear') {
              if (op.buffer.destroyed) {
                throw new Error(`${op.buffer.label || 'buffer'} was destroyed`);
              }
              const offset = Math.max(0, Math.round(Number(op.offset) || 0));
              const size = Math.max(0, Math.round(Number(op.size) || 0));
              op.buffer.bytes.fill(0, offset, Math.min(op.buffer.size, offset + size));
              continue;
            }
            if (op.source.destroyed) throw new Error(`${op.source.label || 'source'} was destroyed`);
            if (op.target.destroyed) throw new Error(`${op.target.label || 'target'} was destroyed`);
            const sourceOffset = Math.max(0, Math.round(Number(op.sourceOffset) || 0));
            const targetOffset = Math.max(0, Math.round(Number(op.targetOffset) || 0));
            const size = Math.max(0, Math.round(Number(op.size) || 0));
            op.target.bytes.set(op.source.bytes.subarray(sourceOffset, sourceOffset + size), targetOffset);
          }
        }
      },
      onSubmittedWorkDone() {
        this.submittedWorkDoneCount = (this.submittedWorkDoneCount || 0) + 1;
        return Promise.resolve();
      }
    }
  };
}

function fakeStorageBuffer(device, label, rows) {
  const buffer = device.createBuffer({
    label,
    size: Math.max(4, rows.byteLength),
    usage: 128 | 4 | 8
  });
  device.queue.writeBuffer(buffer, 0, rows);
  return buffer;
}

function workerGasOccupancyGenerationFixture(device, {
  particleCount,
  storageGeneration,
  physicsTick,
  physicsSubstep,
  positionEpoch,
  topologyEpoch,
  chartEpoch,
  levelEpoch,
  supportEpoch
}) {
  const taggedBuffer = (label, size) => tagWebGpuBufferDevice(
    device.createBuffer({ label, size, usage: 128 | 8 }),
    device
  );
  const assignmentBuffer = taggedBuffer(
    'worker-v4-gas-level-assignment',
    particleCount * SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT.length
      * Float32Array.BYTES_PER_ELEMENT
  );
  const sourceStateBuffer = taggedBuffer(
    'worker-v4-gas-state',
    particleCount * 8 * Float32Array.BYTES_PER_ELEMENT
  );
  const sourceMechanicsBuffer = taggedBuffer(
    'worker-v4-gas-mechanics-v0j',
    particleCount * 32 * Float32Array.BYTES_PER_ELEMENT
  );
  const particleIdentityBuffer = taggedBuffer(
    'worker-v4-gas-identity',
    particleCount * Uint32Array.BYTES_PER_ELEMENT
  );
  const levelAssignment = {
    schema: 'peercompute.ulg.schroeder-level-assignment-execution.v0',
    status: 'schroeder-level-assignment-submitted',
    bufferFamilyGenerationStatus:
      'schroeder-particle-buffer-family-generation-ready',
    particleCount,
    assignmentStrideFloats: SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT.length,
    assignmentBuffer,
    assignmentBufferByteLength: assignmentBuffer.size,
    sourceStateBuffer,
    sourceStateBufferBorrowed: true,
    sourceMechanicsBuffer,
    sourceMechanicsBufferBorrowed: true,
    sourceMechanicsBufferByteLength: sourceMechanicsBuffer.size,
    storageGeneration,
    physicsTick,
    physicsSubstep,
    positionEpoch,
    topologyEpoch,
    chartEpoch,
    levelEpoch,
    supportEpoch,
    minLevel: 0,
    maxLevel: 0,
    chartId: 0,
    baseGridSpacingM: 1
  };
  const generation = runSchroederSpatialEpochGenerationWebGpu({
    device,
    levelAssignment,
    particleCount,
    particleIdentityBuffer,
    particleIdentityStrideWords: 1,
    selectedLevel: 0,
    mechanicsGrid: {
      selectedLevel: 0,
      gridDims: [2, 2, 2],
      gridNodeCount: 8,
      gridShift: 1,
      gridSpacingM: 1
    },
    exactNearCellTreeEnabled: false
  });
  assert.equal(generation.ready, true, generation.reason);
  assert.equal(generation.mechanicsLevelViews.length, 1);
  assert.ok(generation.mechanicsLevelViews[0].phaseVolumeMoment);
  return generation;
}

test('ULG mechanics resident stage worker device resolver adopts a supplied worker device result', async () => {
  let requestCount = 0;
  const device = { label: 'presentation-worker-webgpu-device' };
  const supplied = {
    status: 'presentation-worker-device-ready',
    reason: 'offscreen canvas already owns device',
    device
  };

  const result = await resolveUlgMechanicsResidentStageWorkerDeviceResult({
    preferWebGpu: true,
    providedDeviceResult: supplied,
    requestDeviceResult: async () => {
      requestCount += 1;
      return { status: 'unexpected-requested-device', device: { label: 'unexpected' } };
    }
  });

  assert.equal(result.device, device);
  assert.equal(result.status, 'presentation-worker-device-ready');
  assert.equal(result.workerDeviceSource, 'provided-device-result');
  assert.equal(result.workerDeviceProvided, true);
  assert.equal(requestCount, 0);
});

test('ULG mechanics resident stage worker device resolver wraps a supplied worker device', async () => {
  let requestCount = 0;
  const device = {
    createBuffer() {
      return { label: 'supplied-worker-buffer' };
    },
    queue: {
      writeBuffer() {}
    }
  };

  const result = await resolveUlgMechanicsResidentStageWorkerDeviceResult({
    preferWebGpu: true,
    providedDevice: device,
    requestDeviceResult: async () => {
      requestCount += 1;
      return { status: 'unexpected-requested-device', device: { label: 'unexpected' } };
    }
  });

  assert.equal(result.device, device);
  assert.equal(result.status, 'webgpu-ready-supplied-worker-device');
  assert.equal(result.workerDeviceSource, 'provided-device');
  assert.equal(result.workerDeviceProvided, true);
  assert.equal(requestCount, 0);
});

test('ULG mechanics resident stage worker runs P2G, grid update, and G2P through one retained lane store', async () => {
  const buffers = manualBuffers();
  const context = {
    schema: 'peercompute.ulg.mechanics-resident-stage-worker-context.v0',
    taskIdPrefix: 'ulg:test:mechanics-worker',
    preferWebGpu: false,
    readbackMode: 'full-parity-readback',
    common: {
      ...buffers,
      gridSpacingM: buffers.sphParticleState.smoothingLengthM,
      boxDimsM: [5, 5, 5],
      dt: buffers.mlsMpmParticleState.mechanicsDtS,
      gravityMPerS2: [0, 0, 0],
      cflFactor: 10
    }
  };

  const p2g = await runUlgMechanicsResidentStageWorkerPayload(payload(
    stage('p2g', ['sph-particle-state', 'mls-mpm-mechanics'], ['mls-mpm-grid']),
    context
  ));
  assert.equal(p2g.summary.schema, ULG_MECHANICS_RESIDENT_STAGE_WORKER_RESULT_SCHEMA);
  assert.equal(p2g.summary.status, 'worker-stage-completed');
  assert.equal(p2g.value.workerResidentStage.stageId, 'p2g');
  assert.equal(p2g.value.workerResidentStage.retainedWithinWorker, true);
  assert.equal(p2g.value.workerResidentStage.workerWebGpuRequested, false);
  assert.equal(p2g.value.workerResidentStage.workerDeviceCached, false);
  assert.equal(p2g.value.computeTaskId, 'ulg:test:mechanics-worker:p2g');

  const gridUpdate = await runUlgMechanicsResidentStageWorkerPayload(payload(
    stage('gridUpdate', ['mls-mpm-grid'], ['mls-mpm-grid']),
    context,
    p2g.value
  ));
  assert.equal(gridUpdate.value.workerResidentStage.stageId, 'gridUpdate');
  assert.equal(gridUpdate.value.computeTaskId, 'ulg:test:mechanics-worker:gridUpdate');
  assert.equal(gridUpdate.value.gpuFence.fenceSatisfied, true);

  const g2p = await runUlgMechanicsResidentStageWorkerPayload(payload(
    stage('g2p', ['mls-mpm-grid', 'sph-particle-state', 'mls-mpm-mechanics'], ['sph-particle-state', 'mls-mpm-mechanics']),
    context,
    gridUpdate.value
  ));
  assert.equal(g2p.value.workerResidentStage.stageId, 'g2p');
  assert.equal(g2p.value.computeTaskId, 'ulg:test:mechanics-worker:g2p');
  assert.equal(g2p.value.gpuFence.fenceSatisfied, true);
  assert.ok(g2p.retainedBufferRefs.includes('sph-state-buffer'));
  assert.ok(g2p.retainedBufferRefs.includes('mls-mpm-mechanics-buffer'));
});

test('ULG resident stage worker can run pressure interface force-row stage', async () => {
  const context = {
    schema: 'peercompute.ulg.mechanics-resident-stage-worker-context.v0',
    taskIdPrefix: 'ulg:test:pressure-interface-worker',
    preferWebGpu: false,
    readbackMode: 'full-parity-readback',
    common: {
      boxDimsM: [2, 2, 2],
      gasPressureSummary: {
        schema: 'peercompute.ulg.sph-sealed-gas-pressure-summary.v0',
        status: 'synthetic-pressure',
        totalPressurePa: 120000,
        boxVolumeM3: 8,
        boxDimsM: [2, 2, 2],
        bySpecies: {},
        strictReactionGate: { status: 'strict-reaction-gate-pass', blockers: [] }
      },
      materialInterfaceField: {
        schema: 'peercompute.ulg.sph-material-interface-field.v0',
        status: 'material-interface-field-ready',
        surfaceCount: 1,
        readySurfaceCount: 1,
        totalSurfaceAreaM2: 2,
        elementCount: 2,
        interfaceSourceKeySchema: 'peercompute.ulg.sph-interface-source-key.v0',
        interfaceSourceKeyStatus: 'interface-source-key-retained',
        interfaceSourceKeyBuffer: {
          label: 'worker-pressure-interface-source-key-buffer',
          async mapAsync() {},
          getMappedRange() {
            return new ArrayBuffer(0);
          }
        },
        interfaceSourceKeyBufferRetained: true,
        interfaceSourceKeyRowCount: 2,
        interfaceSourceKeyReadyCount: 2,
        interfaceSourceKeyStrideFloats: 4,
        interfaceSourceKeySurfaceIndexFallbackEnabled: false,
        elements: [
          {
            status: 'interface-element-ready',
            surfaceIndex: 0,
            surfaceKey: 'h2o|liquid',
            material: 'h2o',
            phase: 'liquid',
            materialId: 1,
            phaseId: 2,
            axisId: 0,
            centroidM: [0.5, 1, 1],
            areaM2: 1,
            normalAreaVectorM2: [1, 0, 0]
          },
          {
            status: 'interface-element-ready',
            surfaceIndex: 0,
            surfaceKey: 'h2o|liquid',
            material: 'h2o',
            phase: 'liquid',
            materialId: 1,
            phaseId: 2,
            axisId: 0,
            centroidM: [1.5, 1, 1],
            areaM2: 1,
            normalAreaVectorM2: [-1, 0, 0]
          }
        ]
      }
    }
  };

  const pressure = await runUlgMechanicsResidentStageWorkerPayload(payload(
    stage('pressureInterface', ['resident-gas-pressure', 'sph-material-interface-field'], ['pressure-interface-force-rows']),
    context,
    null,
    {
      laneId: 'ulg:test:pressure-interface-worker-lane',
      stateKey: 'ulg:test:pressure-interface-worker-state'
    }
  ));

  assert.equal(pressure.value.workerResidentStage.stageId, 'pressureInterface');
  assert.equal(pressure.value.computeTaskId, 'ulg:test:pressure-interface-worker:pressureInterface');
  assert.equal(pressure.value.pressureInterfaceStageTaskEvidence.passed, true);
  assert.equal(pressure.value.pressureInterfaceStageTaskAuthority.authoritativeStateMutation, false);
  assert.equal(pressure.value.pressureInterfaceStageTaskAuthority.gridForceApplicationApproved, false);
  assert.equal(pressure.value.pressureInterfaceForceSolver.forceRowCount, 2);
  assert.ok(pressure.retainedBufferRefs.includes('pressure-interface-force-rows-buffer'));
  assert.ok(pressure.retainedBufferRefs.includes('sph-interface-source-key-buffer'));
  assert.ok(
    pressure.value.workerResidentStage.workerRetainedBufferRefs
      .some((ref) => ref.includes('interfaceSourceKeyBuffer'))
  );
});

test('ULG resident stage worker can run gas-cell EOS producer stage', async () => {
  const spatialGasSpeciesLedger = {
    schema: 'peercompute.ulg.sph-spatial-gas-species-ledger.v0',
    status: 'spatial-gas-species-ledger-ready',
    spatialGasSourceBufferRetained: true,
    retainedSpatialGasSourceBufferRefs: ['resident-product-mass-buffer'],
    cellDims: [2, 1, 1],
    cellCount: 2,
    cells: [
      {
        index: 0,
        gridIndex: [0, 0, 0],
        centerM: [0.5, 1, 1],
        volumeM3: 4,
        bySpecies: {
          h2: { material: 'h2', massKg: 0.04, moles: 200, temperatureK: 300 }
        }
      },
      {
        index: 1,
        gridIndex: [1, 0, 0],
        centerM: [1.5, 1, 1],
        volumeM3: 4,
        bySpecies: {
          h2: { material: 'h2', massKg: 0.06, moles: 300, temperatureK: 300 }
        }
      }
    ]
  };
  const context = {
    schema: 'peercompute.ulg.mechanics-resident-stage-worker-context.v0',
    taskIdPrefix: 'ulg:test:gas-cell-eos-worker',
    preferWebGpu: false,
    readbackMode: 'full-parity-readback',
    common: {
      boxDimsM: [2, 2, 2],
      gasPressureSummary: {
        schema: 'peercompute.ulg.sph-sealed-gas-pressure-summary.v0',
        status: 'gpu-resident-reaction-pressure-summary',
        source: 'gpu-resident-product-mass-gas-species-ledger',
        totalPressurePa: 180000,
        boxVolumeM3: 8,
        boxDimsM: [2, 2, 2],
        bySpecies: {},
        spatialGasSpeciesLedger
      }
    }
  };

  const eos = await runUlgMechanicsResidentStageWorkerPayload(payload(
    stage('gasCellEosProducer', ['resident-spatial-gas-species-ledger', 'resident-product-mass'], ['resident-gas-pressure']),
    context,
    null,
    {
      laneId: 'ulg:test:gas-cell-eos-worker-lane',
      stateKey: 'ulg:test:gas-cell-eos-worker-state'
    }
  ));

  assert.equal(eos.value.workerResidentStage.stageId, 'gasCellEosProducer');
  assert.equal(eos.value.computeTaskId, 'ulg:test:gas-cell-eos-worker:gasCellEosProducer');
  assert.equal(eos.value.gasCellEosProducerStageTaskEvidence.passed, true);
  assert.equal(eos.value.gasCellEosProducerStageTaskAuthority.authoritativeStateMutation, false);
  assert.equal(eos.value.gasCellField.localPressureGradientReady, true);
  assert.equal(eos.value.pressureInterfaceGasPressureCellRowCount, 2);
  assert.equal(eos.value.retainedGasCellFieldSourceReady, false);
});

test('ULG resident worker carries one exact CPU-seeded gas owner into pressure without a host fence', async () => {
  const device = createFakeGpuDevice();
  const wrongDevice = createFakeGpuDevice();
  let hostFenceCalls = 0;
  device.queue.onSubmittedWorkDone = () => {
    hostFenceCalls += 1;
    return new Promise(() => {});
  };
  const spatialGasSpeciesLedger = {
    schema: 'peercompute.ulg.sph-spatial-gas-species-ledger.v0',
    status: 'spatial-gas-species-ledger-ready',
    cellDims: [2, 1, 1],
    cellCount: 2,
    cells: [
      {
        index: 0,
        gridIndex: [0, 0, 0],
        centerM: [0.5, 1, 1],
        volumeM3: 4,
        bySpecies: {
          h2: { material: 'h2', massKg: 0.04, moles: 200, temperatureK: 300 }
        }
      },
      {
        index: 1,
        gridIndex: [1, 0, 0],
        centerM: [1.5, 1, 1],
        volumeM3: 4,
        bySpecies: {
          h2: { material: 'h2', massKg: 0.06, moles: 300, temperatureK: 300 }
        }
      }
    ]
  };
  const materialInterfaceField = {
    schema: 'peercompute.ulg.sph-material-interface-field.v0',
    status: 'material-interface-field-ready',
    surfaceCount: 1,
    readySurfaceCount: 1,
    totalSurfaceAreaM2: 2,
    elementCount: 2,
    elements: [
      {
        status: 'interface-element-ready',
        surfaceIndex: 0,
        surfaceKey: 'h2o|liquid',
        material: 'h2o',
        phase: 'liquid',
        materialId: 1,
        phaseId: 2,
        axisId: 0,
        centroidM: [0.5, 1, 1],
        areaM2: 1,
        normalAreaVectorM2: [1, 0, 0]
      },
      {
        status: 'interface-element-ready',
        surfaceIndex: 0,
        surfaceKey: 'h2o|liquid',
        material: 'h2o',
        phase: 'liquid',
        materialId: 1,
        phaseId: 2,
        axisId: 0,
        centroidM: [1.5, 1, 1],
        areaM2: 1,
        normalAreaVectorM2: [-1, 0, 0]
      }
    ]
  };
  let exactPressureResult = null;
  let exactPressureReceipt = null;
  let gridUpdateAttemptCount = 0;
  let gridObservedExactForceRowsBuffer = null;
  const mechanicsBuffers = manualBuffers({
    position: [0.5, 0.5, 0.5],
    smoothingLengthM: 1,
    mechanicsDtS: 0.05
  });
  const lane = {
    laneId: 'ulg:test:worker-cpu-seeded-gas-lane',
    stateKey: 'ulg:test:worker-cpu-seeded-gas-state'
  };
  const context = {
    schema: 'peercompute.ulg.mechanics-resident-stage-worker-context.v0',
    taskIdPrefix: 'ulg:test:worker-cpu-seeded-gas',
    preferWebGpu: true,
    readbackMode: 'no-full-readback',
    residentStagePlanStageOrder: [
      'gasCellEosProducer',
      'pressureInterface',
      'gridUpdate'
    ],
    common: {
      device,
      ...mechanicsBuffers,
      gridSpacingM: 1,
      dt: 0.05,
      gravityMPerS2: [0, 0, 0],
      cflFactor: 10,
      boxDimsM: [2, 2, 2],
      gasPressureSummary: {
        schema: 'peercompute.ulg.sph-sealed-gas-pressure-summary.v0',
        status: 'gpu-resident-reaction-pressure-summary',
        source: 'gpu-resident-product-mass-gas-species-ledger',
        totalPressurePa: 180000,
        boxVolumeM3: 8,
        boxDimsM: [2, 2, 2],
        bySpecies: {},
        spatialGasSpeciesLedger
      },
      materialInterfaceField
    },
    stageOptions: {
      pressureInterface: {
        async pressureInterfaceForceRowsWebGpuRunner(args) {
          exactPressureResult =
            await runSphPressureInterfaceForceRowsWebGpu(args);
          exactPressureReceipt =
            exactPressureResult.pressureCompletionReceipt;
          const copiedResult = {
            ...exactPressureResult,
            pressureCompletionReceipt: exactPressureReceipt
          };
          assert.equal(
            isExactSphPressureInterfaceCompletionReceipt(
              exactPressureReceipt,
              wrongDevice,
              exactPressureResult
            ),
            false
          );
          assert.equal(
            isExactSphPressureInterfaceCompletionReceipt(
              exactPressureReceipt,
              device,
              copiedResult
            ),
            false
          );
          return exactPressureResult;
        }
      },
      gridUpdate: {
        async webGpuRunner(args) {
          gridUpdateAttemptCount += 1;
          gridObservedExactForceRowsBuffer =
            args.pressureInterfaceForceRowsBuffer;
          assert.equal(
            args.pressureInterfaceForceRowsBuffer,
            exactPressureResult.forceRowsBuffer
          );
          assert.equal(
            args.pressureInterfaceForceSolver.gridForceApplicationApproved,
            true
          );
          assert.equal(
            args.pressureInterfaceGridForceAdmission
              .pressureInterfacePublication.schema,
            'peercompute.ulg.worker-exact-pressure-interface-grid-handoff.v1'
          );
          if (gridUpdateAttemptCount === 1) {
            throw new Error('synthetic gridUpdate failure before queue submit');
          }
          const updatedGridBuffer = tagWebGpuBufferDevice(
            device.createBuffer({
              label: 'worker-exact-pressure-grid-update-out',
              size: Math.max(
                4,
                args.p2gGridProjection.gridNodeCount
                  * 4
                  * Float32Array.BYTES_PER_ELEMENT
              ),
              usage: 128 | 4
            }),
            device
          );
          device.queue.submit([[]]);
          return {
            backend: 'webgpu',
            status: 'updated',
            particleCount: args.p2gGridProjection.particleCount || 1,
            gridSpacingM: args.p2gGridProjection.gridSpacingM,
            gridDims: [...args.p2gGridProjection.gridDims],
            gridNodeCount: args.p2gGridProjection.gridNodeCount,
            gridNodeStrideFloats: 4,
            gridNodeStrideBytes: 4 * Float32Array.BYTES_PER_ELEMENT,
            updatedGridNodes: new Float32Array(0),
            updatedGridBuffer,
            updatedGridBufferByteLength: updatedGridBuffer.size,
            pressureInterfaceForceSolver:
              args.pressureInterfaceForceSolver,
            pressureInterfaceGridForceAdmissionStatus:
              'pressure-interface-grid-force-consumption-approved',
            pressureInterfaceGridForceAdmissionApproved: true,
            pressureInterfaceForceApplicationStatus:
              'pressure-interface-grid-force-consumer-submitted-unverified',
            pressureInterfaceForceConsumerStatus:
              'grid-momentum-impulse-submitted-unverified-no-full-readback',
            pressureInterfaceForceRowCount:
              args.pressureInterfaceForceSolver.forceRowCount,
            pressureInterfaceForceRowsBufferSubmitted: true,
            pressureInterfaceImpulseProofStatus:
              'submitted-retained-pressure-force-row-buffer-to-gpu-grid-update-no-full-readback',
            pressureInterfaceAppliedImpulseMagnitudeNSeconds: 0,
            readbackMode: 'no-full-readback',
            fullReadbackPerformed: false,
            normalHotLoopReadbackFree: true,
            queueCompletionStatus: 'queue-submitted-cleanup-deferred',
            queueCompletionMethod: 'same-worker-webgpu-queue-in-order'
          };
        }
      }
    }
  };
  const settlesWithoutHostFence = async (promise, label) => {
    let timeout;
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error(`${label} awaited the never-resolving host fence`)),
            250
          );
        })
      ]);
    } finally {
      clearTimeout(timeout);
    }
  };

  const p2gContext = {
    ...context,
    preferWebGpu: false,
    readbackMode: 'full-parity-readback',
    stageOptions: {}
  };
  const p2g = await runUlgMechanicsResidentStageWorkerPayload(payload(
    stage(
      'p2g',
      ['sph-particle-state', 'mls-mpm-mechanics'],
      ['mls-mpm-grid']
    ),
    p2gContext,
    null,
    lane
  ));
  assert.equal(p2g.value.mechanicsP2gStageTaskEvidence.passed, true);

  const eos = await settlesWithoutHostFence(
    runUlgMechanicsResidentStageWorkerPayload(payload(
      stage(
        'gasCellEosProducer',
        ['resident-spatial-gas-species-ledger', 'resident-product-mass'],
        ['resident-gas-pressure']
      ),
      context,
      null,
      lane
    )),
    'gasCellEosProducer'
  );
  assert.equal(eos.value.backend, 'webgpu');
  assert.equal(eos.value.queueCompletionStatus, 'queue-submitted-same-worker-final-consumer-fence-deferred');
  assert.equal(eos.value.gpuFence.fenceSatisfied, true);
  assert.equal(eos.value.gasCellEosProducerStageTaskEvidence.passed, true);
  assert.equal(eos.value.gasCellEosProducerStageTaskEvidence.gpuPressureAuthorityReady, true);
  assert.equal(eos.value.gasCellEosProducerStageTaskAuthority.gpuFenceSatisfied, true);
  assert.equal(eos.value.cpuSeededGasPressureAuthority, undefined);
  assert.equal(eos.value.gasCellField, undefined);
  assert.equal(eos.value.gasCellFieldSnapshot, undefined);
  assert.equal(eos.value.gasPressureCellRows, undefined);
  assert.equal(eos.value.gasPressureCellsBuffer, undefined);
  assert.deepEqual(eos.value.retainedGasPressureBufferRefs, []);
  assert.doesNotThrow(() => structuredClone(eos.value));

  const pressure = await settlesWithoutHostFence(
    runUlgMechanicsResidentStageWorkerPayload(payload(
      stage(
        'pressureInterface',
        ['resident-gas-pressure', 'sph-material-interface-field'],
        ['pressure-interface-force-rows']
      ),
      context,
      null,
      lane
    )),
    'pressureInterface'
  );
  assert.equal(pressure.value.backend, 'webgpu');
  assert.equal(
    pressure.value.retainedGasPressureRowsStatus,
    'cpu-seeded-gas-pressure-authority-admitted-exact-source'
  );
  assert.equal(
    pressure.value.workerResidentStage.workerQueueFence
      .pressureCompletionReceiptValidated,
    true
  );
  assert.equal(
    pressure.value.workerResidentStage.workerQueueFence.queueCompletionStatus,
    'queue-submitted-same-worker-grid-update-handoff-no-host-wait'
  );
  assert.equal(
    pressure.value.workerResidentStage.workerRetainedGasCellEosReleaseStatus,
    'gas-cell-eos-final-consumer-retired-queue-ordered-after-pressure-submit'
  );
  assert.equal(
    pressure.value.pressureInterfaceStageTaskAuthority.gpuFenceSatisfied,
    true
  );
  assert.equal(
    pressure.value.pressureInterfaceStageTaskAuthority.gpuFenceStatus,
    'gpu-fence-satisfied'
  );
  assert.equal(
    pressure.value.pressureInterfaceStageTaskAuthority
      .gpuFenceDelegationStatus,
    'satisfied-worker-exact-pressure-completion-receipt'
  );
  assert.equal(Object.hasOwn(pressure.value, 'pressureCompletionReceipt'), false);
  assert.equal(Object.hasOwn(pressure.value, 'cpuSeededGasPressureAuthority'), false);
  assert.doesNotThrow(() => structuredClone(pressure.value));
  assert.equal(hostFenceCalls, 0);
  assert.equal(
    device.queue.writeBufferCalls.filter(({ buffer }) => (
      buffer.label === 'ulg-sph-gas-cell-eos-cpu-seeded-pressure-rows'
    )).length,
    1
  );
  assert.equal(
    device.queue.writeBufferCalls.filter(({ buffer }) => (
      buffer.label === 'ulg-sph-pressure-interface-gas-cells-in'
    )).length,
    0
  );
  assert.equal(device.queue.submitCalls.length, 1);
  assert.equal(
    isExactSphPressureInterfaceCompletionReceipt(
      exactPressureReceipt,
      device,
      exactPressureResult
    ),
    false
  );

  await assert.rejects(
    settlesWithoutHostFence(
      runUlgMechanicsResidentStageWorkerPayload(payload(
        stage('gridUpdate', ['mls-mpm-grid'], ['mls-mpm-grid']),
        context,
        p2g.value,
        lane
      )),
      'failed gridUpdate'
    ),
    /synthetic gridUpdate failure before queue submit/
  );
  assert.equal(gridUpdateAttemptCount, 1);
  assert.equal(gridObservedExactForceRowsBuffer, exactPressureResult.forceRowsBuffer);
  assert.equal(exactPressureResult.forceRowsBuffer.destroyed, false);
  assert.equal(exactPressureResult.forceRowsBuffer.destroyCount, 0);
  assert.equal(hostFenceCalls, 0);

  const gridUpdate = await settlesWithoutHostFence(
    runUlgMechanicsResidentStageWorkerPayload(payload(
      stage('gridUpdate', ['mls-mpm-grid'], ['mls-mpm-grid']),
      context,
      p2g.value,
      lane
    )),
    'gridUpdate'
  );
  assert.equal(gridUpdateAttemptCount, 2);
  assert.equal(gridUpdate.value.backend, 'webgpu');
  assert.equal(
    gridUpdate.value.pressureInterfaceGridForceAdmissionApproved,
    true
  );
  assert.equal(
    gridUpdate.value.pressureInterfaceForceRowsBufferSubmitted,
    undefined
  );
  assert.equal(
    gridUpdate.value.gpuResult.pressureInterfaceForceRowsBufferSubmitted,
    true
  );
  assert.equal(
    gridUpdate.value.mechanicsGridUpdateStageTaskEvidence.passed,
    true
  );
  assert.equal(
    gridUpdate.value.mechanicsGridUpdateStageTaskEvidence.pressureInterface
      .retainedBufferSubmittedAndApproved,
    true
  );
  assert.equal(
    gridUpdate.value.workerResidentStage.workerQueueFence
      .pressureInterfaceForceRowsRetiredAfterGridSubmit,
    true
  );
  assert.equal(
    gridUpdate.value.workerResidentStage.workerQueueFence
      .queueCompletionStatus,
    'queue-submitted-worker-retained-grid-no-host-wait'
  );
  assert.equal(exactPressureResult.forceRowsBuffer.destroyed, true);
  assert.equal(exactPressureResult.forceRowsBuffer.destroyCount, 1);
  assert.equal(hostFenceCalls, 0);
  assert.equal(device.queue.submitCalls.length, 2);

  const replayContext = {
    ...context,
    stageOptions: {
      ...context.stageOptions,
      gridUpdate: {
        async webGpuRunner(args) {
          assert.notEqual(
            args.pressureInterfaceGridForceAdmission
              ?.pressureInterfacePublication?.schema,
            'peercompute.ulg.worker-exact-pressure-interface-grid-handoff.v1'
          );
          throw new Error('replayed worker pressure-grid admission rejected');
        }
      }
    }
  };
  const replayedGridUpdate = await settlesWithoutHostFence(
    runUlgMechanicsResidentStageWorkerPayload(payload(
      stage('gridUpdate', ['mls-mpm-grid'], ['mls-mpm-grid']),
      replayContext,
      p2g.value,
      lane
    )),
    'replayed gridUpdate'
  );
  assert.equal(replayedGridUpdate.value.backend, 'cpu-reference');
  assert.equal(
    replayedGridUpdate.value.pressureInterfaceGridForceAdmissionApproved,
    false
  );
  assert.equal(
    replayedGridUpdate.value.mechanicsGridUpdateStageTaskEvidence
      .pressureInterface.retainedBufferSubmittedAndApproved,
    false
  );
  assert.equal(exactPressureResult.forceRowsBuffer.destroyCount, 1);
  assert.equal(hostFenceCalls, 0);

  const rejectedLane = {
    laneId: 'ulg:test:worker-cpu-seeded-gas-rejected-lane',
    stateKey: 'ulg:test:worker-cpu-seeded-gas-rejected-state'
  };
  const rejectedContext = {
    ...context,
    taskIdPrefix: 'ulg:test:worker-cpu-seeded-gas-rejected',
    stageOptions: {
      pressureInterface: {
        async pressureInterfaceForceRowsWebGpuRunner(args) {
          const exactResult =
            await runSphPressureInterfaceForceRowsWebGpu(args);
          return {
            ...exactResult,
            pressureCompletionReceipt: Object.freeze({
              schema: exactResult.pressureCompletionReceipt.schema,
              status: exactResult.pressureCompletionReceipt.status,
              forged: true
            })
          };
        }
      }
    }
  };
  await settlesWithoutHostFence(
    runUlgMechanicsResidentStageWorkerPayload(payload(
      stage(
        'gasCellEosProducer',
        ['resident-spatial-gas-species-ledger', 'resident-product-mass'],
        ['resident-gas-pressure']
      ),
      rejectedContext,
      null,
      rejectedLane
    )),
    'rejected gasCellEosProducer'
  );
  const rejectedPressure = await settlesWithoutHostFence(
    runUlgMechanicsResidentStageWorkerPayload(payload(
      stage(
        'pressureInterface',
        ['resident-gas-pressure', 'sph-material-interface-field'],
        ['pressure-interface-force-rows']
      ),
      rejectedContext,
      null,
      rejectedLane
    )),
    'rejected pressureInterface'
  );
  assert.equal(
    rejectedPressure.value.workerResidentStage.workerQueueFence
      .pressureCompletionReceiptRejected,
    true
  );
  assert.equal(
    rejectedPressure.value.workerResidentStage.workerQueueFence
      .fenceSatisfied,
    false
  );
  assert.equal(
    rejectedPressure.value.workerResidentStage
      .workerRetainedGasCellEosReleaseStatus,
    'gas-cell-eos-final-consumer-retired-queue-ordered-after-pressure-submit'
  );
  assert.equal(
    rejectedPressure.value.pressureInterfaceStageTaskAuthority
      .gpuFenceSatisfied,
    false
  );
  assert.equal(
    rejectedPressure.value.pressureInterfaceStageTaskAuthority.gpuFenceStatus,
    'gpu-fence-unsatisfied'
  );
  assert.equal(
    Object.hasOwn(rejectedPressure.value, 'pressureCompletionReceipt'),
    false
  );
  assert.equal(
    Object.hasOwn(rejectedPressure.value, 'cpuSeededGasPressureAuthority'),
    false
  );
  assert.equal(
    rejectedPressure.retainedBufferRefs.some((ref) => (
      /gas[-_ ]?pressure|gaspressure/i.test(ref)
    )),
    false
  );
  assert.equal(hostFenceCalls, 0);
});

test('ULG resident worker keeps exact v4 gas authority internal and exports non-bindable telemetry', async () => {
  const device = createFakeGpuDevice();
  const productRows = new Float32Array(2 * 32);
  for (let index = 0; index < 2; index += 1) {
    const offset = index * 32;
    productRows[offset] = 0.5 + index;
    productRows[offset + 1] = 1;
    productRows[offset + 2] = 1;
    productRows[offset + 3] = 0.02;
    productRows[offset + 4] = 7;
    productRows[offset + 5] = 0;
    productRows[offset + 7] = index;
    productRows[offset + 8] = -1;
    productRows[offset + 9] = 10;
    productRows[offset + 10] = 1;
    productRows[offset + 11] = 2;
    productRows[offset + 13] = 0.02;
    productRows[offset + 14] = 1;
    productRows[offset + 15] = 0.002;
    productRows[offset + 16] = 300;
    productRows[offset + 18] = 1;
    productRows[offset + 23] = 1;
  }
  const productEventBuffer = fakeStorageBuffer(
    device,
    'worker-v4-spatial-gas-product-events',
    productRows
  );
  const residentProductMass = tagResidentProductMassDevice({
    schema: 'peercompute.ulg.sph-resident-product-mass.v0',
    status: 'resident-product-mass-buffer-retained',
    productEventBuffer,
    productEventBufferRetained: true,
    productEventBufferByteLength: productRows.byteLength,
    productEventRowCount: 2,
    productEventStrideFloats: 32
  }, device);
  const spatialGasEpochIdentity = {
    storageGeneration: 91,
    physicsTick: 90,
    physicsSubstep: 1,
    positionEpoch: 201,
    topologyEpoch: 202,
    chartEpoch: 203,
    levelEpoch: 204,
    supportEpoch: 205
  };
  const schroederSpatialEpochGeneration =
    workerGasOccupancyGenerationFixture(device, {
      particleCount: 2,
      ...spatialGasEpochIdentity
    });
  const materialInterfaceField = {
    schema: 'peercompute.ulg.sph-material-interface-field.v0',
    status: 'material-interface-field-ready',
    surfaceCount: 1,
    readySurfaceCount: 1,
    totalSurfaceAreaM2: 2,
    elementCount: 2,
    elements: [
      {
        status: 'interface-element-ready',
        surfaceIndex: 0,
        surfaceKey: 'h2o|liquid',
        material: 'h2o',
        phase: 'liquid',
        materialId: 1,
        phaseId: 2,
        axisId: 0,
        centroidM: [0.5, 1, 1],
        areaM2: 1,
        normalAreaVectorM2: [1, 0, 0],
        gapM: 0.1,
        normalVelocityMPerS: 0,
        representativeMassKg: 0
      },
      {
        status: 'interface-element-ready',
        surfaceIndex: 0,
        surfaceKey: 'h2o|liquid',
        material: 'h2o',
        phase: 'liquid',
        materialId: 1,
        phaseId: 2,
        axisId: 0,
        centroidM: [1.5, 1, 1],
        areaM2: 1,
        normalAreaVectorM2: [-1, 0, 0],
        gapM: 0.1,
        normalVelocityMPerS: 0,
        representativeMassKg: 0
      }
    ]
  };
  const lane = {
    laneId: 'ulg:test:worker-v4-gas-authority-lane',
    stateKey: 'ulg:test:worker-v4-gas-authority-state'
  };
  const hotBuffers = new Map();
  const warmDeltas = [];
  const stateManager = {
    setHotBuffer(key, value) {
      hotBuffers.set(key, value);
    },
    getHotBuffer(key) {
      return hotBuffers.get(key) || null;
    },
    commitDelta(delta) {
      warmDeltas.push(delta);
      return delta;
    }
  };
  let exactSourceObserved = null;
  let hostBoundaryVerified = false;
  const context = {
    schema: 'peercompute.ulg.mechanics-resident-stage-worker-context.v0',
    taskIdPrefix: 'ulg:test:worker-v4-gas-authority',
    preferWebGpu: true,
    readbackMode: 'no-full-readback',
    includePressureInterfaceStage: true,
    common: {
      device,
      boxDimsM: [2, 2, 2],
      residentProductMass,
      productEventBuffer,
      productEventRowCount: 2,
      productEventStrideFloats: 32,
      spatialGasCellSizeM: 1,
      spatialGasSupportVolumeFallbackM3: 1,
      spatialGasEpochIdentity,
      schroederSpatialEpochGeneration,
      gasPressureSummary: {
        schema: 'peercompute.ulg.sph-sealed-gas-pressure-summary.v0',
        status: 'gpu-resident-reaction-pressure-summary',
        totalPressurePa: 101325,
        boxVolumeM3: 8,
        boxDimsM: [2, 2, 2],
        bySpecies: {},
        strictReactionGate: { status: 'strict-reaction-gate-pass', blockers: [] }
      },
      materialInterfaceField
    },
    stageOptions: {
      pressureInterface: {
        async pressureInterfaceForceRowsWebGpuRunner(args) {
          const source = args.retainedGasPressureCellImport
            ?.retainedGasCellFieldSource;
          assert.equal(isExactSphSpatialGasPressureAuthoritySource(source), true);
          assert.equal(
            args.retainedGasPressureCellImport
              .pressureInterfaceGasCellFieldAdmission
              .retainedGasCellFieldSource,
            source
          );
          assert.equal(args.retainedGasPressureCellsBuffer ?? null, null);
          assert.equal('gasPressureCellsBuffer' in source, false);
          assert.equal('retainedGasPressureCellsBuffer' in source, false);
          assert.equal('pressureInterfaceGasPressureCellsBuffer' in source, false);
          assert.equal('gasAuthorityControlBuffer' in source, false);
          exactSourceObserved = source;
          if (!hostBoundaryVerified) {
            const admissionPublication =
              publishUlgPressureInterfaceGasCellFieldAdmission({
                stateManager,
                cacheKey: lane.laneId,
                stateKey: lane.stateKey,
                source
              });
            assert.equal(
              admissionPublication.retainedGasCellFieldSource,
              source
            );
            assert.equal(
              admissionPublication.pressureInterfaceGasCellFieldAdmission
                .retainedGasCellFieldSource,
              source
            );
            assert.equal(
              admissionPublication.pressureInterfaceGasPressureCellRowCount,
              0
            );
            assert.ok(
              admissionPublication.pressureInterfaceGasPressureCellRowCapacity > 0
            );
            assert.equal(
              admissionPublication.gasPressureCellLogicalCountGpuAuthored,
              true
            );
            const admissionHot = hotBuffers.get(
              admissionPublication.hotBufferKey
            );
            assert.equal(admissionHot.retainedGasCellFieldSource, source);
            assert.equal(
              admissionHot.pressureInterfaceGasCellFieldAdmission
                .retainedGasCellFieldSource,
              source
            );
            const admissionWarm = warmDeltas.at(-1);
            const admissionTelemetry =
              admissionWarm.payload.retainedGasCellFieldSource;
            assert.equal(
              admissionTelemetry.schema,
              ULG_SPH_GAS_PRESSURE_AUTHORITY_TELEMETRY_SCHEMA
            );
            assert.equal(admissionTelemetry.telemetryOnly, true);
            assert.equal(admissionTelemetry.bindable, false);
            assert.equal(
              isExactSphSpatialGasPressureAuthoritySource(admissionTelemetry),
              false
            );
            assert.doesNotThrow(() => structuredClone(admissionWarm.payload));
            assertTransportHasNoGasCapability(admissionWarm.payload);
            assert.throws(
              () => publishUlgPressureInterfaceGasCellFieldAdmission({
                stateManager,
                cacheKey: `${lane.laneId}:telemetry-replay`,
                stateKey: lane.stateKey,
                source: admissionWarm.payload
              }),
              /requires a ready local snapshot, retained same-device source, or worker-local retained source/
            );
            assert.throws(
              () => publishUlgPressureInterfaceGasCellFieldImportSource({
                stateManager,
                cacheKey: `${lane.laneId}:forged-buffer`,
                stateKey: lane.stateKey,
                source: {
                  retainedGasCellFieldSource: source,
                  gasPressureCellsBuffer: { label: 'forged-gas-pressure-buffer' }
                },
                pressureInterfaceGasCellFieldAdmission:
                  admissionPublication.pressureInterfaceGasCellFieldAdmission
              }),
              /rejects raw gasPressureCellsBuffer/
            );
            assert.throws(
              () => publishUlgPressureInterfaceGasCellFieldImportSource({
                stateManager,
                cacheKey: `${lane.laneId}:legacy-mask`,
                stateKey: lane.stateKey,
                source: {
                  schema: 'peercompute.ulg.sph-retained-gas-cell-eos-source.v1',
                  status: 'retained-gas-cell-eos-source-submitted',
                  ready: true,
                  retainedGasCellFieldSource: source,
                  admission: {
                    retainedGasCellFieldSource: source,
                    gasPressureCellsBuffer: {
                      label: 'legacy-wrapper-forged-gas-pressure-buffer'
                    }
                  }
                },
                pressureInterfaceGasCellFieldAdmission:
                  admissionPublication.pressureInterfaceGasCellFieldAdmission
              }),
              /rejects raw gasPressureCellsBuffer/
            );
            let browserWrapperGetterCount = 0;
            const accessorWrapper = {};
            Object.defineProperty(accessorWrapper, 'retainedGasCellFieldSource', {
              enumerable: true,
              get() {
                browserWrapperGetterCount += 1;
                return source;
              }
            });
            assert.throws(
              () => publishUlgPressureInterfaceGasCellFieldImportSource({
                stateManager,
                cacheKey: `${lane.laneId}:accessor-wrapper`,
                stateKey: lane.stateKey,
                source: accessorWrapper,
                pressureInterfaceGasCellFieldAdmission:
                  admissionPublication.pressureInterfaceGasCellFieldAdmission
              }),
              /must be an own data property/
            );
            assert.equal(browserWrapperGetterCount, 0);

            const exactV1Wrapper = {
              schema: 'peercompute.ulg.sph-retained-gas-cell-eos-source.v1',
              status: 'retained-gas-cell-eos-source-submitted',
              ready: true,
              retainedGasCellFieldSource: source
            };
            const wrappedAdmissionPublication =
              publishUlgPressureInterfaceGasCellFieldAdmission({
                stateManager,
                cacheKey: `${lane.laneId}:exact-v1-wrapper`,
                stateKey: lane.stateKey,
                source: exactV1Wrapper
              });
            assert.equal(
              wrappedAdmissionPublication.retainedGasCellFieldSource,
              source
            );
            assert.equal(
              wrappedAdmissionPublication.pressureInterfaceGasPressureCellRowCount,
              0
            );
            assert.ok(
              wrappedAdmissionPublication
                .pressureInterfaceGasPressureCellRowCapacity > 0
            );
            const wrappedImportPublication =
              publishUlgPressureInterfaceGasCellFieldImportSource({
                stateManager,
                cacheKey: `${lane.laneId}:exact-v1-wrapper`,
                stateKey: lane.stateKey,
                source: exactV1Wrapper,
                pressureInterfaceGasCellFieldAdmission:
                  wrappedAdmissionPublication
                    .pressureInterfaceGasCellFieldAdmission
              });
            assert.equal(
              wrappedImportPublication.retainedGasCellFieldSource,
              source
            );
            assert.equal(
              wrappedImportPublication.pressureInterfaceGasPressureCellRowCount,
              0
            );
            assert.ok(
              wrappedImportPublication
                .pressureInterfaceGasPressureCellRowCapacity > 0
            );

            for (const [schema, message] of [
              [
                ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA,
                /forged current schema/
              ],
              [
                'peercompute.ulg.sph-retained-gas-cell-eos-source.v2',
                /retired v2\/v3 wrappers/
              ],
              [
                'peercompute.ulg.sph-retained-gas-cell-eos-source.v3',
                /retired v2\/v3 wrappers/
              ]
            ]) {
              assert.throws(
                () => publishUlgPressureInterfaceGasCellFieldAdmission({
                  stateManager,
                  cacheKey: `${lane.laneId}:protected-wrapper:${schema}`,
                  stateKey: lane.stateKey,
                  source: {
                    schema,
                    retainedGasCellFieldSource: source
                  }
                }),
                message
              );
            }

            assert.throws(
              () => publishUlgPressureInterfaceGasCellFieldImportSource({
                stateManager,
                cacheKey: `${lane.laneId}:null-raw-alias`,
                stateKey: lane.stateKey,
                source: {
                  schema: 'peercompute.ulg.sph-retained-gas-cell-eos-source.v1',
                  retainedGasCellFieldSource: source,
                  gasPressureCellsBuffer: null
                },
                pressureInterfaceGasCellFieldAdmission:
                  admissionPublication.pressureInterfaceGasCellFieldAdmission
              }),
              /rejects raw gasPressureCellsBuffer/
            );
            let browserControlGetterCount = 0;
            const accessorControlAliasWrapper = {
              schema: 'peercompute.ulg.sph-retained-gas-cell-eos-source.v1',
              retainedGasCellFieldSource: source
            };
            Object.defineProperty(
              accessorControlAliasWrapper,
              'gasAuthorityControlBuffer',
              {
                enumerable: true,
                get() {
                  browserControlGetterCount += 1;
                  return null;
                }
              }
            );
            assert.throws(
              () => publishUlgPressureInterfaceGasCellFieldImportSource({
                stateManager,
                cacheKey: `${lane.laneId}:accessor-control-alias`,
                stateKey: lane.stateKey,
                source: accessorControlAliasWrapper,
                pressureInterfaceGasCellFieldAdmission:
                  admissionPublication.pressureInterfaceGasCellFieldAdmission
              }),
              /must be an own data property/
            );
            assert.equal(browserControlGetterCount, 0);

            let browserSchemaGetterCount = 0;
            const accessorSchemaWrapper = {
              retainedGasCellFieldSource: source
            };
            Object.defineProperty(accessorSchemaWrapper, 'schema', {
              enumerable: true,
              get() {
                browserSchemaGetterCount += 1;
                return ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA;
              }
            });
            assert.throws(
              () => publishUlgPressureInterfaceGasCellFieldAdmission({
                stateManager,
                cacheKey: `${lane.laneId}:accessor-schema`,
                stateKey: lane.stateKey,
                source: accessorSchemaWrapper
              }),
              /must be an own data property/
            );
            assert.equal(browserSchemaGetterCount, 0);
            assert.throws(
              () => publishUlgPressureInterfaceGasCellFieldImportSource({
                stateManager,
                cacheKey: `${lane.laneId}:mismatched-admission`,
                stateKey: lane.stateKey,
                source,
                pressureInterfaceGasCellFieldAdmission: {
                  ...admissionPublication.pressureInterfaceGasCellFieldAdmission,
                  retainedGasCellFieldSource: admissionTelemetry
                }
              }),
              /requires admission for the same producer-issued source identity/
            );

            const importPublication =
              publishUlgPressureInterfaceGasCellFieldImportSource({
                stateManager,
                cacheKey: lane.laneId,
                stateKey: lane.stateKey,
                source,
                pressureInterfaceGasCellFieldAdmission:
                  admissionPublication.pressureInterfaceGasCellFieldAdmission
              });
            assert.equal(importPublication.retainedGasCellFieldSource, source);
            assert.equal(
              importPublication.pressureInterfaceGasCellFieldImport
                .retainedGasCellFieldSource,
              source
            );
            assert.equal('gasPressureCellsBuffer' in importPublication, false);
            assert.equal('retainedGasPressureCellsBuffer' in importPublication, false);
            assert.equal('gasAuthorityControlBuffer' in importPublication, false);
            assert.equal(
              importPublication.pressureInterfaceGasPressureCellRowCount,
              0
            );
            assert.ok(
              importPublication.pressureInterfaceGasPressureCellRowCapacity > 0
            );
            assert.equal(
              importPublication.gasPressureCellLogicalCountGpuAuthored,
              true
            );
            const importHot = hotBuffers.get(importPublication.hotBufferKey);
            assert.equal(importHot.retainedGasCellFieldSource, source);
            assert.equal(
              importHot.pressureInterfaceGasCellFieldImport
                .retainedGasCellFieldSource,
              source
            );
            assert.equal('gasPressureCellsBuffer' in importHot, false);
            assert.equal('retainedGasPressureCellsBuffer' in importHot, false);
            assert.equal('gasAuthorityControlBuffer' in importHot, false);
            const importWarm = warmDeltas.at(-1);
            const importTelemetry =
              importWarm.payload.retainedGasCellFieldSource;
            assert.equal(
              importTelemetry.schema,
              ULG_SPH_GAS_PRESSURE_AUTHORITY_TELEMETRY_SCHEMA
            );
            assert.equal(importTelemetry.telemetryOnly, true);
            assert.equal(importTelemetry.bindable, false);
            assert.equal(
              isExactSphSpatialGasPressureAuthoritySource(importTelemetry),
              false
            );
            assert.equal('gasPressureCellsBuffer' in importWarm.payload, false);
            assert.equal(
              'gasPressureCellsBuffer'
                in importWarm.payload.pressureInterfaceGasCellFieldImport,
              false
            );
            assert.equal(
              'releaseAfterFinalConsumerQueue'
                in importWarm.payload.pressureInterfaceGasCellFieldImport,
              false
            );
            assert.doesNotThrow(() => structuredClone(importWarm.payload));
            assertTransportHasNoGasCapability(importWarm.payload);

            const secondEpochIdentity = Object.fromEntries(
              Object.entries(spatialGasEpochIdentity).map(([key, value]) => (
                [key, value + 100]
              ))
            );
            const secondSpatialGeneration =
              workerGasOccupancyGenerationFixture(device, {
                particleCount: 2,
                ...secondEpochIdentity
              });
            const secondMechanicsField = secondSpatialGeneration
              .mechanicsLevelViews.at(-1).mechanicsFieldView;
            const secondExecution = await sphSpatialGasLedgerEosGpu
              .runSphSpatialGasLedgerEosRetainedWebGpu({
                device,
                residentProductMass,
                epochIdentity: secondEpochIdentity,
                schroederSpatialEpochGeneration: secondSpatialGeneration,
                spatialGasGrid: {
                  selectedLevel: secondMechanicsField.selectedLevel,
                  gridDims: [...secondMechanicsField.gridDims],
                  gridNodeCount: secondMechanicsField.gridNodeCount,
                  gridShift: secondMechanicsField.gridShift,
                  gridSpacingM: secondMechanicsField.gridSpacingM
                },
                boxMinM: [0, 0, 0],
                boxMaxM: [2, 2, 2],
                spatialGasCellSizeM: 1,
                spatialGasSupportVolumeFallbackM3: 0,
                level: 0,
                laneId: `${lane.laneId}:second-exact-authority`
              });
            assert.equal(secondExecution.ready, true, secondExecution.reason);
            const secondExactSource =
              secondExecution.retainedGasCellFieldSource;
            assert.equal(
              isExactSphSpatialGasPressureAuthoritySource(secondExactSource),
              true
            );

            const runAvailableExactWorkerImport = async (
              suffix,
              pressureImport,
              workerDevice = device
            ) => runUlgMechanicsResidentStageWorkerPayload(payload(
              stage(
                'pressureInterface',
                ['resident-gas-pressure', 'sph-material-interface-field'],
                ['pressure-interface-force-rows']
              ),
              {
                schema: 'peercompute.ulg.mechanics-resident-stage-worker-context.v0',
                taskIdPrefix: `ulg:test:worker-v4-available-hostile-${suffix}`,
                preferWebGpu: false,
                readbackMode: 'full-parity-readback',
                common: {
                  device: workerDevice,
                  boxDimsM: [2, 2, 2],
                  gasPressureSummary: context.common.gasPressureSummary,
                  materialInterfaceField,
                  pressureInterfaceGasCellFieldImport: pressureImport
                }
              },
              null,
              {
                laneId: `ulg:test:worker-v4-available-hostile-${suffix}-lane`,
                stateKey: `ulg:test:worker-v4-available-hostile-${suffix}-state`
              }
            ));
            const assertRejectedWithoutPreflightPressureRef = (
              result,
              expectedStatus
            ) => {
              assert.equal(
                result.value.workerResidentStage
                  .workerRetainedGasCellFieldImportInputStatus,
                expectedStatus
              );
              assert.equal(
                result.value.workerResidentStage
                  .workerRetainedGasCellFieldImportApplied,
                false
              );
              assert.equal(
                (result.value.gpuResidentLaneRequirement?.retainedBufferRefs
                  || []).includes('resident-gas-pressure-cells-buffer'),
                false
              );
            };
            const primaryApprovedAdmission =
              admissionPublication.pressureInterfaceGasCellFieldAdmission;
            const secondaryApprovedAdmission = {
              ...primaryApprovedAdmission,
              retainedGasCellFieldSource: secondExactSource
            };
            const multipleExactRejected =
              await runAvailableExactWorkerImport(
                'multiple-exact-identities',
                {
                  schema: 'peercompute.ulg.sph-retained-gas-cell-eos-source.v1',
                  retainedGasCellFieldSource: source,
                  pressureInterfaceGasCellFieldAdmission:
                    primaryApprovedAdmission,
                  admission: secondaryApprovedAdmission
                }
              );
            assertRejectedWithoutPreflightPressureRef(
              multipleExactRejected,
              'blocked-ambiguous-exact-v4-gas-pressure-authority'
            );

            const mismatchedAdmissionRejected =
              await runAvailableExactWorkerImport(
                'mismatched-approved-admission',
                {
                  schema: 'peercompute.ulg.sph-retained-gas-cell-eos-source.v1',
                  retainedGasCellFieldSource: source,
                  pressureInterfaceGasCellFieldAdmission: {
                    ...primaryApprovedAdmission,
                    retainedGasCellFieldSource: admissionTelemetry
                  }
                }
              );
            assertRejectedWithoutPreflightPressureRef(
              mismatchedAdmissionRejected,
              'blocked-exact-v4-gas-pressure-authority-admission-identity-mismatch'
            );

            const ambiguousAdmissionRejected =
              await runAvailableExactWorkerImport(
                'ambiguous-approved-admissions',
                {
                  schema: 'peercompute.ulg.sph-retained-gas-cell-eos-source.v1',
                  retainedGasCellFieldSource: source,
                  pressureInterfaceGasCellFieldAdmission:
                    primaryApprovedAdmission,
                  admission: {
                    ...primaryApprovedAdmission,
                    retainedGasCellFieldSource: source
                  }
                }
              );
            assertRejectedWithoutPreflightPressureRef(
              ambiguousAdmissionRejected,
              'blocked-exact-v4-gas-pressure-authority-admission-ambiguous'
            );

            const forgedCapacityRejected =
              await runAvailableExactWorkerImport(
                'forged-public-capacity',
                {
                  schema: 'peercompute.ulg.sph-retained-gas-cell-eos-source.v1',
                  retainedGasCellFieldSource: source,
                  pressureInterfaceGasPressureCellRowCapacity: 0x7fff_ffff,
                  pressureInterfaceGasPressureCellRowStrideFloats: 1
                }
              );
            assertRejectedWithoutPreflightPressureRef(
              forgedCapacityRejected,
              'blocked-exact-v4-gas-pressure-authority-admission-missing'
            );

            const wrongDevice = createFakeGpuDevice();
            const wrongDeviceRejected =
              await runAvailableExactWorkerImport(
                'wrong-device-forged-capacity',
                {
                  schema: 'peercompute.ulg.sph-retained-gas-cell-eos-source.v1',
                  retainedGasCellFieldSource: source,
                  pressureInterfaceGasCellFieldAdmission:
                    primaryApprovedAdmission,
                  pressureInterfaceGasPressureCellRowCapacity: 0x7fff_ffff,
                  pressureInterfaceGasPressureCellRowStrideFloats: 1
                },
                wrongDevice
              );
            assertRejectedWithoutPreflightPressureRef(
              wrongDeviceRejected,
              'blocked-exact-v4-gas-pressure-authority-device-mismatch'
            );
            assert.equal(
              sphSpatialGasLedgerEosGpu
                .releaseSphSpatialGasLedgerEosAfterQueue(secondExecution),
              true
            );
            assert.equal(await secondExecution.releasePromise, true);
            assert.equal(
              releaseSchroederSpatialEpochGenerationAfterQueue(
                secondSpatialGeneration,
                device
              ),
              true
            );
            assert.equal(
              await secondSpatialGeneration.releasePromise,
              true
            );
            hostBoundaryVerified = true;
          }
          const result = await runSphPressureInterfaceForceRowsWebGpu(args);
          assert.equal(source.gasPressureAuthorityConsumerSubmitted, true);
          assert.throws(
            () => publishUlgPressureInterfaceGasCellFieldAdmission({
              stateManager,
              cacheKey: `${lane.laneId}:submitted-replay`,
              stateKey: lane.stateKey,
              source
            }),
            /rejects unavailable exact v4 authority lifecycle/
          );
          return result;
        }
      }
    }
  };

  const spatial = await runUlgMechanicsResidentStageWorkerPayload(payload(
    stage(
      'spatialGasLedgerProducer',
      ['resident-product-mass'],
      ['resident-spatial-gas-species-ledger']
    ),
    context,
    null,
    lane
  ));
  const {
    schroederSpatialEpochGeneration: _occupancyGeneration,
    ...consumerCommon
  } = context.common;
  const consumerContext = {
    ...context,
    common: consumerCommon
  };
  assert.equal(spatial.value.retainedGasCellFieldSourceReady, true);
  assert.equal(
    spatial.value.retainedGasCellFieldSource.schema,
    ULG_SPH_GAS_PRESSURE_AUTHORITY_TELEMETRY_SCHEMA
  );
  assert.equal(spatial.value.retainedSpatialGasLedgerSource ?? null, null);
  assert.equal(spatial.value.spatialGasLedgerEosExecution ?? null, null);

  const eos = await runUlgMechanicsResidentStageWorkerPayload(payload(
    stage(
      'gasCellEosProducer',
      ['resident-spatial-gas-species-ledger', 'resident-product-mass'],
      ['resident-gas-pressure']
    ),
    consumerContext,
    null,
    lane
  ));
  const telemetry = eos.value.retainedGasCellFieldSource;
  assert.equal(telemetry.schema, ULG_SPH_GAS_PRESSURE_AUTHORITY_TELEMETRY_SCHEMA);
  assert.equal(telemetry.telemetryOnly, true);
  assert.equal(telemetry.bindable, false);
  assert.equal(isExactSphSpatialGasPressureAuthoritySource(telemetry), false);
  assert.equal(eos.value.gasPressureCellsBuffer, undefined);
  assert.equal(eos.value.retainedGasPressureCellsBuffer, undefined);
  assert.equal(eos.value.gasAuthorityControlBuffer, undefined);
  assert.deepEqual(eos.value.workerRetainedGasPressureBufferRefs || [], []);
  assert.equal(
    eos.retainedBufferRefs.some((ref) => /gas[-_ ]?pressure/i.test(ref)),
    false
  );
  assert.equal(
    'bindSphSpatialGasPressureAuthority' in sphSpatialGasLedgerEosGpu,
    false
  );
  const seen = new WeakSet();
  const forbiddenTransportKeys = new Set([
    'gasPressureCellsBuffer',
    'retainedGasPressureCellsBuffer',
    'pressureInterfaceGasPressureCellsBuffer',
    'gasAuthorityControlBuffer',
    'retainedGasAuthorityControlBuffer',
    'pressureInterfaceGasAuthorityControlBuffer',
    'releaseAfterFinalConsumerQueue',
    'deferredCleanupReadbackTelemetrySnapshot'
  ]);
  const assertTransportHasNoGasCapability = (value) => {
    if (value == null || typeof value !== 'object') {
      assert.notEqual(typeof value, 'function');
      return;
    }
    if (seen.has(value)) return;
    seen.add(value);
    assert.equal(value instanceof FakeGpuBuffer, false);
    assert.equal(isExactSphSpatialGasPressureAuthoritySource(value), false);
    if (value.schema === 'peercompute.ulg.worker-retained-buffer-ref.v0') {
      assert.equal(/gas[-_ ]?pressure|gaspressure/i.test(`${value.ref} ${value.path}`), false);
    }
    for (const [key, nested] of Object.entries(value)) {
      assert.equal(
        forbiddenTransportKeys.has(key),
        false,
        `worker transport leaked forbidden gas authority key ${key}`
      );
      assertTransportHasNoGasCapability(nested);
    }
  };
  assertTransportHasNoGasCapability(eos.value);
  assert.doesNotThrow(() => structuredClone(eos.value));

  const pressure = await runUlgMechanicsResidentStageWorkerPayload(payload(
    stage(
      'pressureInterface',
      ['resident-gas-pressure', 'sph-material-interface-field'],
      ['pressure-interface-force-rows']
    ),
    consumerContext,
    null,
    lane
  ));
  assert.ok(exactSourceObserved);
  assert.equal(
    hostBoundaryVerified,
    true,
    JSON.stringify({
      status: pressure.value.status,
      webgpuStatus: pressure.value.webgpuStatus,
      retainedGasPressureRowsStatus: pressure.value.retainedGasPressureRowsStatus
    })
  );
  assert.equal(pressure.value.pressureInterfaceForceSolver.pressureModelId, 2);
  assert.equal(pressure.value.pressureInterfaceGasPressureCellRowCount, 0);
  assert.ok(pressure.value.pressureInterfaceGasPressureCellRowCapacity > 0);
  assert.equal(
    pressure.value.pressureInterfaceGasPressureCellLogicalCountGpuAuthored,
    true
  );
  assert.equal(
    pressure.value
      .pressureInterfaceGasCellFieldImportRetainedLocalPressureGradientReady,
    false
  );
  assert.equal(
    pressure.value.pressureInterfaceGasPressureAuthorityReady,
    true
  );
  assert.equal(
    pressure.value.gpuResidentLaneRequirement.retainedBufferRefs
      .includes('resident-gas-pressure-cells-buffer'),
    false
  );
  assert.equal(pressure.value.gasPressureAuthorityConsumerSubmitted, true);
  assert.equal(
    pressure.value.retainedGasPressureRowsStatus,
    'retained-gas-pressure-authority-v4-admitted-exact-source'
  );
  assert.equal(
    pressure.value.workerResidentStage.workerRetainedGasCellEosReleaseStatus,
    'gas-cell-eos-final-consumer-retired-queue-ordered-after-pressure-submit'
  );
  assert.equal(
    pressure.value.workerResidentStage.workerQueueFence.queueCompletionMethod,
    'worker-device.queue.onSubmittedWorkDone'
  );
  assert.notEqual(
    pressure.value.workerResidentStage.workerQueueFence
      .finalConsumerReleaseFenceUsed,
    true
  );
  assertTransportHasNoGasCapability(pressure.value);
  assert.doesNotThrow(() => structuredClone(pressure.value));

  const runHostileExactWorkerImport = async (suffix, pressureImport) => (
    runUlgMechanicsResidentStageWorkerPayload(payload(
      stage(
        'pressureInterface',
        ['resident-gas-pressure', 'sph-material-interface-field'],
        ['pressure-interface-force-rows']
      ),
      {
        schema: 'peercompute.ulg.mechanics-resident-stage-worker-context.v0',
        taskIdPrefix: `ulg:test:worker-v4-hostile-${suffix}`,
        preferWebGpu: false,
        readbackMode: 'full-parity-readback',
        common: {
          device,
          boxDimsM: [2, 2, 2],
          gasPressureSummary: context.common.gasPressureSummary,
          materialInterfaceField,
          pressureInterfaceGasCellFieldImport: pressureImport
        }
      },
      null,
      {
        laneId: `ulg:test:worker-v4-hostile-${suffix}-lane`,
        stateKey: `ulg:test:worker-v4-hostile-${suffix}-state`
      }
    ))
  );
  const exactAdmission = {
    schema: 'peercompute.ulg.pressure-interface-gas-cell-field-admission.v0',
    status: 'pressure-interface-gas-cell-field-consumption-approved',
    gasCellFieldConsumptionApproved: true,
    retainedGasCellFieldSource: exactSourceObserved
  };
  let workerRawAliasGetterCount = 0;
  const accessorRawAliasImport = {
    schema: 'peercompute.ulg.pressure-interface-gas-cell-field-import.v0',
    status: 'pressure-interface-gas-cell-field-import-ready',
    retainedGasCellFieldSource: exactSourceObserved,
    pressureInterfaceGasCellFieldAdmission: exactAdmission
  };
  Object.defineProperty(accessorRawAliasImport, 'gasPressureCellsBuffer', {
    enumerable: true,
    get() {
      workerRawAliasGetterCount += 1;
      return { label: 'worker-accessor-forged-gas-pressure-buffer' };
    }
  });
  const accessorRejected = await runHostileExactWorkerImport(
    'accessor-raw-alias',
    accessorRawAliasImport
  );
  assert.equal(
    accessorRejected.value.workerResidentStage
      .workerRetainedGasCellFieldImportInputStatus,
    'blocked-exact-v4-gas-pressure-authority-raw-alias-accessor'
  );
  assert.equal(
    accessorRejected.value.workerResidentStage
      .workerRetainedGasCellFieldImportApplied,
    false
  );
  assert.equal(workerRawAliasGetterCount, 0);

  let workerWrapperGetterCount = 0;
  const accessorWrapperImport = {
    schema: 'peercompute.ulg.pressure-interface-gas-cell-field-import.v0',
    status: 'pressure-interface-gas-cell-field-import-ready'
  };
  Object.defineProperty(accessorWrapperImport, 'retainedGasCellFieldSource', {
    enumerable: true,
    get() {
      workerWrapperGetterCount += 1;
      return exactSourceObserved;
    }
  });
  const accessorWrapperRejected = await runHostileExactWorkerImport(
    'accessor-wrapper',
    accessorWrapperImport
  );
  assert.equal(
    accessorWrapperRejected.value.workerResidentStage
      .workerRetainedGasCellFieldImportInputStatus,
    'blocked-gas-pressure-authority-wrapper-accessor'
  );
  assert.equal(workerWrapperGetterCount, 0);

  const nestedAliasRejected = await runHostileExactWorkerImport(
    'nested-legacy-mask',
    {
      schema: 'peercompute.ulg.sph-retained-gas-cell-eos-source.v1',
      status: 'retained-gas-cell-eos-source-submitted',
      ready: true,
      admission: {
        retainedGasCellFieldSource: exactSourceObserved,
        gasPressureCellsBuffer: {
          label: 'worker-nested-forged-gas-pressure-buffer'
        }
      }
    }
  );
  assert.equal(
    nestedAliasRejected.value.workerResidentStage
      .workerRetainedGasCellFieldImportInputStatus,
    'blocked-exact-v4-gas-pressure-authority-raw-alias'
  );
  assert.equal(
    nestedAliasRejected.value.workerResidentStage
      .workerRetainedGasCellFieldImportApplied,
    false
  );

  const nullAliasRejected = await runHostileExactWorkerImport(
    'null-raw-alias',
    {
      schema: 'peercompute.ulg.sph-retained-gas-cell-eos-source.v1',
      status: 'retained-gas-cell-eos-source-submitted',
      ready: true,
      retainedGasCellFieldSource: exactSourceObserved,
      gasAuthorityControlBuffer: null
    }
  );
  assert.equal(
    nullAliasRejected.value.workerResidentStage
      .workerRetainedGasCellFieldImportInputStatus,
    'blocked-exact-v4-gas-pressure-authority-raw-alias'
  );
  assert.equal(
    nullAliasRejected.value.workerResidentStage
      .workerRetainedGasCellFieldImportApplied,
    false
  );

  const legacyRawSource = {
    schema: 'peercompute.ulg.sph-retained-gas-cell-eos-source.v1',
    status: 'retained-gas-cell-eos-source-submitted',
    ready: true,
    localPressureGradientReady: true,
    gasPressureCellsBuffer: {
      label: 'worker-protected-schema-legacy-pressure-buffer'
    },
    pressureInterfaceGasPressureCellRowCount: 1,
    pressureInterfaceGasPressureCellRowStrideFloats: 12
  };
  for (const [suffix, schema, expectedStatus] of [
    [
      'forged-current-v4',
      ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA,
      'blocked-forged-exact-v4-gas-pressure-authority-schema'
    ],
    [
      'retired-v2',
      'peercompute.ulg.sph-retained-gas-cell-eos-source.v2',
      'blocked-retired-gas-pressure-authority-schema'
    ],
    [
      'retired-v3',
      'peercompute.ulg.sph-retained-gas-cell-eos-source.v3',
      'blocked-retired-gas-pressure-authority-schema'
    ]
  ]) {
    const protectedSchemaRejected = await runHostileExactWorkerImport(
      suffix,
      {
        schema,
        retainedGasCellFieldSource: legacyRawSource
      }
    );
    assert.equal(
      protectedSchemaRejected.value.workerResidentStage
        .workerRetainedGasCellFieldImportInputStatus,
      expectedStatus
    );
    assert.equal(
      protectedSchemaRejected.value.workerResidentStage
        .workerRetainedGasCellFieldImportApplied,
      false
    );
  }

  const exactV1MaskRejectedAsUnavailable =
    await runHostileExactWorkerImport(
      'exact-v1-schema-mask',
      {
        schema: 'peercompute.ulg.sph-retained-gas-cell-eos-source.v1',
        retainedGasCellFieldSource: exactSourceObserved
      }
    );
  assert.equal(
    exactV1MaskRejectedAsUnavailable.value.workerResidentStage
      .workerRetainedGasCellFieldImportInputStatus,
    'blocked-exact-v4-gas-pressure-authority-unavailable'
  );

  let workerBorrowedGetterCount = 0;
  const borrowedGetterWrapper = {
    schema: 'peercompute.ulg.sph-retained-gas-cell-eos-source.v1',
    retainedGasCellFieldSource: exactSourceObserved
  };
  Object.defineProperty(
    borrowedGetterWrapper,
    'gasPressureAuthorityConsumerBorrowed',
    {
      enumerable: true,
      get() {
        workerBorrowedGetterCount += 1;
        return false;
      }
    }
  );
  const borrowedGetterRejectedAsUnavailable =
    await runHostileExactWorkerImport(
      'public-borrowed-getter',
      borrowedGetterWrapper
    );
  assert.equal(
    borrowedGetterRejectedAsUnavailable.value.workerResidentStage
      .workerRetainedGasCellFieldImportInputStatus,
    'blocked-exact-v4-gas-pressure-authority-unavailable'
  );
  assert.equal(workerBorrowedGetterCount, 0);

  let workerSchemaGetterCount = 0;
  const schemaGetterWrapper = {
    retainedGasCellFieldSource: exactSourceObserved
  };
  Object.defineProperty(schemaGetterWrapper, 'schema', {
    enumerable: true,
    get() {
      workerSchemaGetterCount += 1;
      return ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA;
    }
  });
  const schemaGetterRejected = await runHostileExactWorkerImport(
    'schema-getter',
    schemaGetterWrapper
  );
  assert.equal(
    schemaGetterRejected.value.workerResidentStage
      .workerRetainedGasCellFieldImportInputStatus,
    'blocked-gas-pressure-authority-schema-accessor'
  );
  assert.equal(workerSchemaGetterCount, 0);

  const descriptorTrapCounts = new Map();
  const descriptorGetCounts = new Map();
  const descriptorTrapAdmission = {
    schema: 'peercompute.ulg.pressure-interface-gas-cell-field-admission.v0',
    status: 'pressure-interface-gas-cell-field-consumption-approved',
    gasCellFieldConsumptionApproved: true,
    retainedGasCellFieldSource: exactSourceObserved
  };
  const descriptorTrapTarget = {
    schema: 'peercompute.ulg.sph-retained-gas-cell-eos-source.v1',
    retainedGasCellFieldSource: exactSourceObserved,
    pressureInterfaceGasCellFieldAdmission: descriptorTrapAdmission,
    pressureInterfaceGasPressureCellRowCapacity:
      exactSourceObserved.pressureInterfaceGasPressureCellRowCapacity,
    pressureInterfaceGasPressureCellRowStrideFloats: 12
  };
  const descriptorTrapImport = new Proxy(descriptorTrapTarget, {
    getOwnPropertyDescriptor(target, key) {
      const count = (descriptorTrapCounts.get(key) || 0) + 1;
      descriptorTrapCounts.set(key, count);
      const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
      if (!descriptor || count === 1) return descriptor;
      if (key === 'schema') {
        return { ...descriptor, value: ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA };
      }
      if (key === 'retainedGasCellFieldSource') {
        return { ...descriptor, value: legacyRawSource };
      }
      if (key === 'pressureInterfaceGasCellFieldAdmission') {
        return {
          ...descriptor,
          value: {
            ...descriptorTrapAdmission,
            gasCellFieldConsumptionApproved: false,
            retainedGasCellFieldSource: legacyRawSource
          }
        };
      }
      if (key === 'pressureInterfaceGasPressureCellRowCapacity') {
        return { ...descriptor, value: 0 };
      }
      return descriptor;
    },
    get(target, key, receiver) {
      descriptorGetCounts.set(key, (descriptorGetCounts.get(key) || 0) + 1);
      return Reflect.get(target, key, receiver);
    }
  });
  const descriptorTrapRejectedAsUnavailable =
    await runHostileExactWorkerImport(
      'descriptor-snapshot-toctou',
      descriptorTrapImport
    );
  assert.equal(
    descriptorTrapRejectedAsUnavailable.value.workerResidentStage
      .workerRetainedGasCellFieldImportInputStatus,
    'blocked-exact-v4-gas-pressure-authority-unavailable'
  );
  for (const key of [
    'schema',
    'retainedGasCellFieldSource',
    'pressureInterfaceGasCellFieldAdmission',
    'pressureInterfaceGasPressureCellRowCapacity',
    'pressureInterfaceGasPressureCellRowStrideFloats'
  ]) {
    assert.equal(
      descriptorTrapCounts.get(key),
      1,
      `worker graph must capture ${key} exactly once across preflight/apply`
    );
    assert.equal(
      descriptorGetCounts.get(key) || 0,
      0,
      `worker graph must not invoke hostile ${key} reads`
    );
  }

  const inheritedCurrentSchemaRejected =
    await runHostileExactWorkerImport(
      'inherited-current-schema',
      Object.create(exactSourceObserved)
    );
  assert.equal(
    inheritedCurrentSchemaRejected.value.workerResidentStage
      .workerRetainedGasCellFieldImportInputStatus,
    'blocked-forged-exact-v4-gas-pressure-authority-schema'
  );
  const retiredSchemaPrototype = {
    schema: 'peercompute.ulg.sph-retained-gas-cell-eos-source.v3'
  };
  const inheritedRetiredSchemaWrapper = Object.create(
    retiredSchemaPrototype
  );
  Object.defineProperty(
    inheritedRetiredSchemaWrapper,
    'retainedGasCellFieldSource',
    {
      enumerable: true,
      configurable: true,
      writable: true,
      value: legacyRawSource
    }
  );
  const inheritedRetiredSchemaRejected =
    await runHostileExactWorkerImport(
      'inherited-retired-schema',
      inheritedRetiredSchemaWrapper
    );
  assert.equal(
    inheritedRetiredSchemaRejected.value.workerResidentStage
      .workerRetainedGasCellFieldImportInputStatus,
    'blocked-retired-gas-pressure-authority-schema'
  );

  let prototypeSchemaGetterCount = 0;
  const accessorSchemaPrototype = {};
  Object.defineProperty(accessorSchemaPrototype, 'schema', {
    get() {
      prototypeSchemaGetterCount += 1;
      return ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA;
    }
  });
  const accessorSchemaPrototypeWrapper = Object.create(
    accessorSchemaPrototype
  );
  Object.defineProperty(
    accessorSchemaPrototypeWrapper,
    'retainedGasCellFieldSource',
    {
      enumerable: true,
      configurable: true,
      writable: true,
      value: exactSourceObserved
    }
  );
  const inheritedSchemaAccessorRejected =
    await runHostileExactWorkerImport(
      'inherited-schema-accessor',
      accessorSchemaPrototypeWrapper
    );
  assert.equal(
    inheritedSchemaAccessorRejected.value.workerResidentStage
      .workerRetainedGasCellFieldImportInputStatus,
    'blocked-gas-pressure-authority-schema-accessor'
  );
  assert.equal(prototypeSchemaGetterCount, 0);

  const submittedReplayRejected = await runHostileExactWorkerImport(
    'submitted-replay',
    {
      schema: 'peercompute.ulg.pressure-interface-gas-cell-field-import.v0',
      status: 'pressure-interface-gas-cell-field-import-ready',
      retainedGasCellFieldSource: exactSourceObserved,
      pressureInterfaceGasCellFieldAdmission: exactAdmission
    }
  );
  assert.equal(
    submittedReplayRejected.value.workerResidentStage
      .workerRetainedGasCellFieldImportInputStatus,
    'blocked-exact-v4-gas-pressure-authority-unavailable'
  );
  assert.equal(Object.isFrozen(exactSourceObserved), true);
  assert.equal(
    Reflect.set(
      exactSourceObserved,
      'schema',
      'peercompute.ulg.sph-retained-gas-cell-eos-source.v1'
    ),
    false
  );
  assert.equal(
    exactSourceObserved.schema,
    ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA
  );

  const echoContext = {
    schema: 'peercompute.ulg.mechanics-resident-stage-worker-context.v0',
    taskIdPrefix: 'ulg:test:worker-v4-gas-authority-echo',
    preferWebGpu: false,
    readbackMode: 'full-parity-readback',
    common: {
      boxDimsM: [2, 2, 2],
      gasPressureSummary: context.common.gasPressureSummary,
      materialInterfaceField,
      pressureInterfaceGasCellFieldImport: {
        schema: 'peercompute.ulg.pressure-interface-gas-cell-field-import.v0',
        status: 'pressure-interface-gas-cell-field-import-ready',
        retainedGasCellFieldSource: telemetry,
        workerRetainedGasPressureBufferRefs: [
          'ulg-worker:forged:gasCellEosProducer:gas-pressure'
        ],
        pressureInterfaceGasPressureCellRowCount: 1,
        pressureInterfaceGasPressureCellRowStrideFloats: 12,
        pressureInterfaceGasPressureCellRowByteLength: 48
      }
    }
  };
  const echoed = await runUlgMechanicsResidentStageWorkerPayload(payload(
    stage(
      'pressureInterface',
      ['resident-gas-pressure', 'sph-material-interface-field'],
      ['pressure-interface-force-rows']
    ),
    echoContext,
    null,
    {
      laneId: 'ulg:test:worker-v4-gas-authority-echo-lane',
      stateKey: 'ulg:test:worker-v4-gas-authority-echo-state'
    }
  ));
  assert.equal(
    echoed.value.workerResidentStage
      .workerRetainedGasCellFieldImportInputStatus,
    'blocked-gas-pressure-authority-telemetry-non-bindable'
  );
  assert.equal(
    echoed.value.workerResidentStage
      .workerRetainedGasCellFieldImportApplied,
    false
  );
  assert.equal(
    releaseSchroederSpatialEpochGenerationAfterQueue(
      schroederSpatialEpochGeneration,
      device
    ),
    false
  );
  assert.equal(await schroederSpatialEpochGeneration.releasePromise, true);
});

test('ULG resident stage worker retires gas-cell owners when pressure is omitted or the lane aborts', async () => {
  const spatialGasSpeciesLedger = {
    schema: 'peercompute.ulg.sph-spatial-gas-species-ledger.v0',
    status: 'spatial-gas-species-ledger-ready',
    cellDims: [1, 1, 1],
    cellCount: 1,
    cells: [{
      index: 0,
      gridIndex: [0, 0, 0],
      centerM: [0.5, 0.5, 0.5],
      volumeM3: 1,
      bySpecies: {
        h2: { material: 'h2', massKg: 0.01, moles: 5, temperatureK: 300 }
      }
    }]
  };
  const makeContext = (device, includePressureInterfaceStage) => ({
    schema: 'peercompute.ulg.mechanics-resident-stage-worker-context.v0',
    taskIdPrefix: `ulg:test:worker-gas-finalizer:${includePressureInterfaceStage}`,
    preferWebGpu: true,
    readbackMode: 'no-full-readback',
    includePressureInterfaceStage,
    common: {
      device,
      boxDimsM: [1, 1, 1],
      gasPressureSummary: {
        schema: 'peercompute.ulg.sph-sealed-gas-pressure-summary.v0',
        status: 'gpu-resident-reaction-pressure-summary',
        totalPressurePa: 101325,
        boxVolumeM3: 1,
        boxDimsM: [1, 1, 1],
        bySpecies: {},
        spatialGasSpeciesLedger
      }
    }
  });

  const omittedDevice = createFakeGpuDevice();
  const omittedLane = {
    laneId: 'ulg:test:worker-gas-finalizer-omitted-lane',
    stateKey: 'ulg:test:worker-gas-finalizer-omitted-state'
  };
  const omitted = await runUlgMechanicsResidentStageWorkerPayload(payload(
    stage('gasCellEosProducer', ['resident-spatial-gas-species-ledger'], ['resident-gas-pressure']),
    makeContext(omittedDevice, false),
    null,
    omittedLane
  ));
  assert.equal(
    omitted.value.workerResidentStage.workerRetainedGasCellEosReleaseStatus,
    'gas-cell-eos-final-consumer-release-scheduled-after-pressure-omitted'
  );
  assert.equal(
    omitted.value.workerResidentStage.workerRetainedGasCellEosReleaseScheduled,
    true
  );
  assert.equal(
    omitted.value.workerResidentStage.workerQueueFence.cpuQueueFenceBypassed,
    true
  );
  assert.equal(omittedDevice.queue.submittedWorkDoneCount || 0, 0);

  const abortedDevice = createFakeGpuDevice();
  const abortedLane = {
    laneId: 'ulg:test:worker-gas-finalizer-aborted-lane',
    stateKey: 'ulg:test:worker-gas-finalizer-aborted-state'
  };
  const abortedContext = makeContext(abortedDevice, true);
  const retained = await runUlgMechanicsResidentStageWorkerPayload(payload(
    stage('gasCellEosProducer', ['resident-spatial-gas-species-ledger'], ['resident-gas-pressure']),
    abortedContext,
    null,
    abortedLane
  ));
  assert.equal(
    retained.value.workerResidentStage.workerRetainedGasCellEosReleaseScheduled,
    false
  );
  assert.equal(
    retained.value.workerResidentStage.workerQueueFence.finalConsumerFenceDeferred,
    true
  );
  const queueFenceCountBeforeAbort = abortedDevice.queue.submittedWorkDoneCount || 0;
  const finalizerContext = {
    ...abortedContext,
    gasCellEosFinalConsumerPressureStageStatus: 'lane-aborted'
  };
  const finalized = await runUlgMechanicsResidentStageWorkerPayload(payload(
    stage('gasCellEosFinalizer', ['resident-gas-pressure'], []),
    finalizerContext,
    retained.value,
    abortedLane
  ));
  assert.equal(finalized.value.releaseScheduled, true);
  assert.equal(
    finalized.value.status,
    'gas-cell-eos-final-consumer-release-scheduled-after-lane-abort'
  );
  assert.equal(finalized.value.releaseConfirmed, true);
  assert.equal(
    abortedDevice.queue.submittedWorkDoneCount || 0,
    queueFenceCountBeforeAbort
  );
  const repeated = await runUlgMechanicsResidentStageWorkerPayload(payload(
    stage('gasCellEosFinalizer', ['resident-gas-pressure'], []),
    finalizerContext,
    finalized.value,
    abortedLane
  ));
  assert.equal(repeated.value.releaseScheduled, true);
  assert.equal(repeated.value.releaseAlreadyScheduled, true);
  assert.equal(
    abortedDevice.queue.submittedWorkDoneCount || 0,
    queueFenceCountBeforeAbort
  );
});

test('ULG resident stage worker can run spatial gas ledger producer stage', async () => {
  const compactRows = new Float32Array([
    0.5, 1, 1, 7, 0.04, 100, 300, 1, 0, 0, 1, 1,
    1.5, 1, 1, 7, 0.06, 200, 300, 1, 0, 1, 1, 1
  ]);
  const context = {
    schema: 'peercompute.ulg.mechanics-resident-stage-worker-context.v0',
    taskIdPrefix: 'ulg:test:spatial-gas-worker',
    preferWebGpu: false,
    readbackMode: 'full-parity-readback',
    common: {
      boxDimsM: [2, 2, 2],
      productEventCompactRows: compactRows,
      productEventRowCount: 2,
      residentProductMass: {
        schema: 'peercompute.ulg.sph-resident-product-mass.v0',
        status: 'resident-product-mass-buffer-retained',
        productEventBuffer: { label: 'worker-spatial-product-events' },
        productEventBufferRetained: true,
        productEventBufferByteLength: 2 * 32 * 4,
        productEventRowCount: 2,
        productEventStrideFloats: 32
      },
      reactionTable: {
        schema: 'peercompute.ulg.sph-gpu-reaction-table.v1',
        productTermMetadata: [
          { productTermIndex: 0, material: 'h2', routing: 'gas' }
        ]
      }
    }
  };

  const spatial = await runUlgMechanicsResidentStageWorkerPayload(payload(
    stage('spatialGasLedgerProducer', ['resident-product-mass'], ['resident-spatial-gas-species-ledger']),
    context,
    null,
    {
      laneId: 'ulg:test:spatial-gas-worker-lane',
      stateKey: 'ulg:test:spatial-gas-worker-state'
    }
  ));

  assert.equal(spatial.value.workerResidentStage.stageId, 'spatialGasLedgerProducer');
  assert.equal(spatial.value.computeTaskId, 'ulg:test:spatial-gas-worker:spatialGasLedgerProducer');
  assert.equal(spatial.value.spatialGasLedgerProducerStageTaskEvidence.passed, true);
  assert.equal(spatial.value.spatialGasLedgerProducerStageTaskAuthority.authoritativeStateMutation, false);
  assert.equal(spatial.value.spatialGasSpeciesLedger.status, 'spatial-gas-species-ledger-ready');
  assert.equal(spatial.value.spatialGasSpeciesLedger.cellCount, 2);
  assert.equal(spatial.value.fullProductEventReadbackPerformed, false);
  assert.equal(spatial.value.retainedSpatialGasLedgerSourceReady, false);
});

test('standalone spatial gas stage does not infer particle authority from a retained lane without the particle policy bit', async () => {
  const device = createFakeGpuDevice();
  const buffers = lawsQuiescentSingleLaneBuffers();
  buffers.sphParticleState.thermo.set([
    7, 3, 293.15, 1,
    0, 0, 1, 0,
    1, 6.02214076e23, 1, 0.1
  ]);
  const laneOptions = {
    laneId: 'ulg:test:standalone-particle-gas-lane',
    stateKey: 'ulg:test:standalone-particle-gas-state'
  };
  try {
    await runUlgMechanicsResidentStageWorkerPayload(payload(
      workerLaneSeedStage(),
      workerSchroederStageContext(device, buffers, {
        schroederLaneSeed: workerLaneSeedStageOptions({
          hotBufferKey: 'ulg:sph-resident:standalone-particle-gas',
          particleCount: 1,
          rematerializationSeedOverrides: {
            identityRequired: true,
            identityRevision: 'standalone-particle-gas-identity',
            identitySchema: ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
            identityStrideBytes:
              SPH_GPU_PARTICLE_IDENTITY_UINTS
              * Uint32Array.BYTES_PER_ELEMENT,
            particleIdentityMutationApproved: true,
            requiresAuthoritativeFourBufferRows: true,
            outputParticleCapacity: 1
          }
        })
      }),
      null,
      laneOptions
    ));
    await runUlgMechanicsResidentStageWorkerPayload(payload(
      stage(
        'schroederSpatialEpoch',
        ['schroeder-level-assignment'],
        ['schroeder-spatial-epoch']
      ),
      workerSchroederStageContext(device, buffers, {
        schroederSpatialEpoch: {
          selectedLevel: 0,
          mechanicsGrid: WORKER_SEED_MECHANICS_GRID,
          exactNearCellTreeEnabled: false,
          mechanicsFieldViewsRequired: true,
          phaseVolumeSidecarsRequired: true
        }
      }),
      null,
      laneOptions
    ));
    const spatial = await runUlgMechanicsResidentStageWorkerPayload(payload(
      stage(
        'spatialGasLedgerProducer',
        [
          'sph-particle-state',
          'sph-thermo-phase',
          'schroeder-spatial-epoch'
        ],
        ['resident-spatial-gas-species-ledger']
      ),
      workerSchroederStageContext(device, buffers, {
        spatialGasLedgerProducer: {}
      }),
      null,
      laneOptions
    ));
    assert.equal(spatial.value.backend, 'cpu-reference');
    assert.equal(
      spatial.value.status,
      'spatial-gas-ledger-producer-stage-blocked',
      JSON.stringify({
        reason: spatial.value.reason,
        webgpuStatus: spatial.value.webgpuStatus
      })
    );
    assert.equal(spatial.value.spatialGasCandidateSourceMode, undefined);
    assert.equal(spatial.value.spatialGenerationId, undefined);
    assert.equal(spatial.value.retainedSpatialGasLedgerSourceReady, false);
    assert.equal(
      spatial.value.reason,
      'spatial-gas-ledger-empty-or-unavailable'
    );
  } finally {
    releaseUlgMechanicsResidentStageWorkerLane(laneOptions);
  }
});

test('ULG resident stage worker can run thermal phase stage and adopt retained thermo output', async () => {
  const buffers = manualBuffers();
  const sourceStateBuffer = { label: 'worker-g2p-state' };
  const sourceThermoBuffer = { label: 'worker-source-thermo' };
  const outputStateBuffer = { label: 'worker-thermal-state' };
  const outputThermoBuffer = { label: 'worker-thermal-thermo' };
  const thermalInputs = [];
  const context = {
    schema: 'peercompute.ulg.mechanics-resident-stage-worker-context.v0',
    taskIdPrefix: 'ulg:test:thermal-worker',
    preferWebGpu: false,
    readbackMode: 'full-parity-readback',
    common: {
      ...buffers,
      thermalMaterialTable: { schema: 'peercompute.ulg.sph-gpu-thermal-material-table.v0' },
      sphParticleUpload: {
        status: 'webgpu-uploaded',
        stateBuffer: sourceStateBuffer,
        thermoBuffer: sourceThermoBuffer
      },
      sourceStateBuffer,
      sourceThermoBuffer,
      boxDimsM: [5, 5, 5],
      dtS: buffers.mlsMpmParticleState.mechanicsDtS,
      thermalStepRunner(args) {
        thermalInputs.push(args);
        return {
          schema: 'peercompute.ulg.sph-gpu-thermal-step-execution.v0',
          backend: 'webgpu',
          status: 'webgpu-accepted',
          webgpuStatus: { status: 'webgpu-executed' },
          result: {
            schema: 'peercompute.ulg.sph-gpu-thermal-step.v0',
            backend: 'webgpu',
            status: 'thermal-step-executed',
            particleCount: buffers.sphParticleState.particleCount,
            state: new Float32Array(),
            thermo: new Float32Array(),
            stateBuffer: outputStateBuffer,
            thermoBuffer: outputThermoBuffer,
            stateBufferByteLength: buffers.sphParticleState.state.byteLength,
            thermoBufferByteLength: buffers.sphParticleState.thermo.byteLength,
            retainedOutputParticleBuffers: true,
            readbackMode: 'full-parity-readback',
            fullReadbackPerformed: true
          }
        };
      }
    }
  };

  const thermal = await runUlgMechanicsResidentStageWorkerPayload(payload(
    stage('thermalPhase', ['sph-particle-state', 'sph-thermo-phase'], ['sph-thermo-phase']),
    context
  ));

  assert.equal(thermal.value.workerResidentStage.stageId, 'thermalPhase');
  assert.equal(thermal.value.computeTaskId, 'ulg:test:thermal-worker:thermalPhase');
  assert.equal(thermal.value.thermalPhaseStageTaskEvidence.passed, true);
  assert.equal(thermal.value.thermalPhaseStageTaskAuthority.authoritativeStateMutation, false);
  assert.equal(thermal.value.workerResidentStage.workerRetainedThermoOutputStatus, 'adopted-worker-retained-thermo-output');
  assert.ok(thermal.retainedBufferRefs.includes('sph-state-buffer'));
  assert.ok(thermal.retainedBufferRefs.includes('sph-thermo-buffer'));
  assert.equal(thermalInputs.length, 1);
  assert.equal(thermalInputs[0].sourceStateBuffer, sourceStateBuffer);
  assert.equal(thermalInputs[0].sourceThermoBuffer, sourceThermoBuffer);
  assert.equal(thermalInputs[0].retainOutputParticleBuffers, true);
});

test('ULG resident stage worker can run reaction product stage with retained particle and product outputs', async () => {
  const buffers = manualBuffers();
  const sourceStateBuffer = { label: 'worker-reaction-state-source' };
  const sourceThermoBuffer = { label: 'worker-reaction-thermo-source' };
  const sourceMechanicsBuffer = { label: 'worker-reaction-mechanics-source' };
  const outputStateBuffer = { label: 'worker-reaction-state-output' };
  const outputThermoBuffer = { label: 'worker-reaction-thermo-output' };
  const outputMechanicsBuffer = { label: 'worker-reaction-mechanics-output' };
  const productEventBuffer = { label: 'worker-reaction-product-events' };
  const reactionInputs = [];
  const context = {
    schema: 'peercompute.ulg.mechanics-resident-stage-worker-context.v0',
    taskIdPrefix: 'ulg:test:reaction-worker',
    preferWebGpu: false,
    readbackMode: 'full-parity-readback',
    common: {
      ...buffers,
      reactionTable: { schema: 'peercompute.ulg.sph-gpu-reaction-table.v1', reactionCount: 1, productTermCount: 1, gasProductCount: 0 },
      thermalMaterialTable: { schema: 'peercompute.ulg.sph-gpu-thermal-material-table.v0' },
      sphParticleUpload: {
        status: 'webgpu-uploaded',
        stateBuffer: sourceStateBuffer,
        thermoBuffer: sourceThermoBuffer
      },
      mlsMpmParticleUpload: {
        status: 'webgpu-uploaded',
        mechanicsBuffer: sourceMechanicsBuffer
      },
      sourceStateBuffer,
      sourceThermoBuffer,
      sourceMechanicsBuffer,
      reactionStepRunner(args) {
        reactionInputs.push(args);
        return {
          schema: 'peercompute.ulg.sph-gpu-reaction-step-execution.v0',
          backend: 'webgpu',
          status: 'webgpu-accepted',
          webgpuStatus: { status: 'webgpu-executed' },
          result: {
            schema: 'peercompute.ulg.sph-gpu-reaction-step.v0',
            backend: 'webgpu',
            status: 'reaction-step-executed',
            particleCount: buffers.sphParticleState.particleCount,
            reactionCount: 1,
            productTermCount: 1,
            gasProductCount: 0,
            state: new Float32Array(),
            thermo: new Float32Array(),
            mechanics: new Float32Array(),
            stateBuffer: outputStateBuffer,
            thermoBuffer: outputThermoBuffer,
            mechanicsBuffer: outputMechanicsBuffer,
            stateBufferByteLength: buffers.sphParticleState.state.byteLength,
            thermoBufferByteLength: buffers.sphParticleState.thermo.byteLength,
            mechanicsBufferByteLength: buffers.mlsMpmParticleState.mechanics.byteLength,
            retainedOutputParticleBuffers: true,
            residentProductMass: {
              schema: 'peercompute.ulg.sph-resident-product-mass.v0',
              status: 'resident-product-mass-buffer-retained',
              productEventBuffer,
              productEventBufferRetained: true,
              productEventBufferByteLength: 64,
              productEventRowCount: 1
            },
            residentProductMassStatus: 'resident-product-mass-buffer-retained',
            residentProductMassBufferRetained: true,
            readbackMode: 'full-parity-readback',
            fullReadbackPerformed: true
          }
        };
      }
    }
  };

  const reaction = await runUlgMechanicsResidentStageWorkerPayload(payload(
    stage('reactionProduct', ['sph-particle-state', 'sph-thermo-phase', 'mls-mpm-mechanics'], ['sph-particle-state', 'sph-thermo-phase', 'mls-mpm-mechanics', 'resident-product-mass']),
    context,
    null,
    {
      laneId: 'ulg:test:reaction-worker-lane',
      stateKey: 'ulg:test:reaction-worker-state'
    }
  ));

  assert.equal(reaction.value.workerResidentStage.stageId, 'reactionProduct');
  assert.equal(reaction.value.computeTaskId, 'ulg:test:reaction-worker:reactionProduct');
  assert.equal(reaction.value.reactionProductStageTaskEvidence.passed, true);
  assert.equal(reaction.value.reactionProductStageTaskAuthority.authoritativeStateMutation, false);
  assert.equal(reaction.value.workerResidentStage.workerRetainedThermoOutputStatus, 'adopted-worker-retained-thermo-output');
  assert.ok(reaction.retainedBufferRefs.includes('sph-state-buffer'));
  assert.ok(reaction.retainedBufferRefs.includes('sph-thermo-buffer'));
  assert.ok(reaction.retainedBufferRefs.includes('mls-mpm-mechanics-buffer'));
  assert.ok(reaction.retainedBufferRefs.includes('resident-product-mass-buffer'));
  assert.equal(reactionInputs.length, 1);
  assert.equal(reactionInputs[0].sourceStateBuffer, sourceStateBuffer);
  assert.equal(reactionInputs[0].sourceThermoBuffer, sourceThermoBuffer);
  assert.equal(reactionInputs[0].sourceMechanicsBuffer, sourceMechanicsBuffer);
  assert.equal(reactionInputs[0].retainOutputParticleBuffers, true);
});

test('ULG resident stage worker exports compact snapshots from export-owned G2P source copies', async () => {
  const device = createFakeGpuDevice();
  const buffers = phaseCarrierBuffers({
    position: [1.5, 1.75, 2.25],
    velocity: [0.25, -0.5, 0.75],
    massKg: 4,
    restDensityKgPerM3: 8
  });
  const laneId = 'ulg:test:compact-snapshot-export-lane';
  const stateKey = 'ulg:test:compact-snapshot-export-state';
  const inputStateBuffer = fakeStorageBuffer(device, 'worker-input-sph-state', buffers.sphParticleState.state);
  const inputThermoBuffer = fakeStorageBuffer(device, 'worker-input-sph-thermo', buffers.sphParticleState.thermo);
  const inputMechanicsBuffer = fakeStorageBuffer(device, 'worker-input-mls-mpm-mechanics', buffers.mlsMpmParticleState.mechanics);
  const updatedGridBuffer = fakeStorageBuffer(device, 'worker-g2p-updated-grid', new Float32Array([1, 0, 0, 0]));
  const g2pStateRows = new Float32Array(buffers.sphParticleState.state);
  g2pStateRows[0] = 2.125;
  g2pStateRows[4] = 0.5;
  const g2pMechanicsRows = new Float32Array(buffers.mlsMpmParticleState.mechanics);
  g2pMechanicsRows[18] = 1.125;
  g2pMechanicsRows[19] = 0.5;
  const transientG2pStateBuffer = fakeStorageBuffer(device, 'transient-g2p-state', g2pStateRows);
  const transientG2pMechanicsBuffer = fakeStorageBuffer(device, 'transient-g2p-mechanics', g2pMechanicsRows);
  const g2pInputs = [];
  const context = {
    schema: 'peercompute.ulg.mechanics-resident-stage-worker-context.v0',
    taskIdPrefix: 'ulg:test:compact-snapshot-export-worker',
    preferWebGpu: true,
    readbackMode: 'no-full-readback',
    retainedCompactSnapshotExportRequested: true,
    captureRetainedCompactSnapshotExportSources: true,
    common: {
      ...buffers,
      device,
      sphParticleUpload: {
        status: 'webgpu-uploaded',
        stateBuffer: inputStateBuffer,
        thermoBuffer: inputThermoBuffer
      },
      mlsMpmParticleUpload: {
        status: 'webgpu-uploaded',
        mechanicsBuffer: inputMechanicsBuffer
      },
      boxDimsM: [5, 5, 5],
      dt: buffers.mlsMpmParticleState.mechanicsDtS,
      webGpuRunner(args) {
        g2pInputs.push(args);
        return {
          schema: 'peercompute.ulg.mls-mpm-g2p-webgpu-result.v0',
          backend: 'webgpu',
          status: 'reconstructed',
          particleCount: buffers.sphParticleState.particleCount,
          gridNodeCount: 1,
          stateBuffer: transientG2pStateBuffer,
          mechanicsBuffer: transientG2pMechanicsBuffer,
          stateBufferByteLength: g2pStateRows.byteLength,
          mechanicsBufferByteLength: g2pMechanicsRows.byteLength,
          stateStrideFloats: 8,
          mechanicsStrideFloats: MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length,
          retainedOutputParticleBuffers: true,
          readbackMode: 'no-full-readback',
          fullReadbackPerformed: false,
          normalHotLoopReadbackFree: true,
          internalPressureScale: 0,
          webgpuStatus: { status: 'webgpu-executed-no-full-readback' }
        };
      }
    }
  };

  const g2p = await runUlgMechanicsResidentStageWorkerPayload(payload(
    stage('g2p', ['mls-mpm-grid', 'sph-particle-state', 'mls-mpm-mechanics'], ['sph-particle-state', 'mls-mpm-mechanics']),
    context,
    {
      backend: 'webgpu',
      status: 'grid-updated',
      updatedGridBuffer,
      updatedGridBufferByteLength: 16,
      dt: buffers.mlsMpmParticleState.mechanicsDtS
    },
    { laneId, stateKey }
  ));

  assert.equal(g2pInputs.length, 1);
  assert.equal(g2p.value.workerResidentStage.stageId, 'g2p');
  assert.equal(
    g2p.value.workerResidentStage.compactSnapshotExportSourceStatus,
    'worker-retained-compact-snapshot-export-sources-ready'
  );
  assert.equal(g2p.value.workerResidentStage.compactSnapshotExportOwnedSourcesReady, true);
  assert.equal(g2p.summary.compactSnapshotExportOwnedSourcesReady, true);

  transientG2pStateBuffer.destroy();
  transientG2pMechanicsBuffer.destroy();

  const exported = await exportUlgMechanicsResidentStageWorkerRetainedCompactSnapshot({
    device,
    laneId,
    stateKey,
    cacheKey: 'ulg:test:compact-snapshot-export-cache',
    particleCount: buffers.sphParticleState.particleCount,
    step: 1,
    time: 0.1,
    smoothingLengthM: buffers.sphParticleState.smoothingLengthM,
    phaseCarrierPlan: buffers.sphParticleState.phaseCarrierPlan
  });

  assert.equal(exported.status, 'worker-retained-compact-snapshot-exported');
  assert.equal(exported.portableSnapshotAvailable, true);
  assert.equal(exported.crossPeerReplayReady, true);
  assert.equal(exported.compactBufferSnapshot.schema, 'peercompute.ulg.remote-task-graph-compact-buffer-snapshot.v0');
  assert.deepEqual([...exported.compactBufferSnapshot.sphState], [...g2pStateRows]);
  assert.deepEqual([...exported.compactBufferSnapshot.mlsMpmMechanics], [...g2pMechanicsRows]);
  assert.deepEqual([...exported.compactBufferSnapshot.sphThermo], [...buffers.sphParticleState.thermo]);
  assert.deepEqual(exported.compactBufferSnapshot.phaseCarrierPlan, {
    schema: 'peercompute.ulg.sph-phase-carrier-plan.v2',
    status: 'phase-lane-capacity-ready',
    lineageCapacity: 1,
    primaryCapacity: 1,
    phaseLaneCount: 4,
    phaseLaneStride: 1,
    companionStart: 1,
    companionCapacity: 3,
    particleCapacity: 4,
    stableLaneAddress: 'phaseLane*phaseLaneStride+lineageIndex'
  });
  assert.notStrictEqual(
    exported.compactBufferSnapshot.phaseCarrierPlan,
    buffers.sphParticleState.phaseCarrierPlan
  );
  assert.equal(
    Object.hasOwn(exported.compactBufferSnapshot.phaseCarrierPlan, 'localOnlyBuffer'),
    false
  );
  assert.equal(
    Object.hasOwn(exported.compactBufferSnapshot.phaseCarrierPlan, 'localOnlyArray'),
    false
  );

  const rejected = await exportUlgMechanicsResidentStageWorkerRetainedCompactSnapshot({
    device,
    laneId,
    stateKey,
    particleCount: buffers.sphParticleState.particleCount,
    phaseCarrierPlan: {
      ...buffers.sphParticleState.phaseCarrierPlan,
      particleCapacity: 1
    }
  });
  assert.equal(rejected.status, 'worker-retained-compact-snapshot-export-blocked');
  assert.equal(
    rejected.reason,
    'worker-retained-compact-snapshot-phase-carrier-plan-particle-count-mismatch'
  );
  assert.match(rejected.errorMessage, /phaseCarrierPlan does not match particleCount 4/);
});

test('ULG resident stage worker rematerializes adopted storage from a descriptor seed and reuses it across schedules', async () => {
  const buffers = phaseCarrierBuffers();
  const device = createFakeGpuDevice();
  const seed = {
    schema: 'peercompute.ulg.schroeder-adopted-particle-storage-portable-materialization-seed.v0',
    status: 'schroeder-adopted-particle-storage-portable-materialization-seed-ready',
    ready: true,
    hotBufferKey: 'ulg:sph-resident-schroeder-adopted-storage:test-seed',
    authoritativeParticleCount: buffers.sphParticleState.particleCount,
    phaseCarrierPlan: buffers.sphParticleState.phaseCarrierPlan,
    materializationMode: 'peer-local-gpu-rematerialization-from-descriptor-seed'
  };
  const context = {
    schema: 'peercompute.ulg.mechanics-resident-stage-worker-context.v0',
    taskIdPrefix: 'ulg:test:adopted-storage-worker',
    preferWebGpu: false,
    readbackMode: 'full-parity-readback',
    common: {
      ...buffers,
      deviceResult: { device },
      useSchroederAdoptedParticleStorageWorkerRematerialization: true,
      schroederAdoptedParticleStorageWorkerRematerializationSeed: seed,
      gridSpacingM: buffers.sphParticleState.smoothingLengthM,
      boxDimsM: [5, 5, 5],
      dt: buffers.mlsMpmParticleState.mechanicsDtS,
      gravityMPerS2: [0, 0, 0],
      cflFactor: 10
    }
  };
  const laneOptions = {
    laneId: 'ulg:test:adopted-storage-worker-lane',
    stateKey: 'ulg:test:adopted-storage-worker-state'
  };
  const p2gStage = stage('p2g', ['sph-particle-state', 'mls-mpm-mechanics'], ['mls-mpm-grid']);

  const first = await runUlgMechanicsResidentStageWorkerPayload(
    payload(p2gStage, context, null, laneOptions)
  );
  const firstRemat = first.value.workerResidentStage.workerAdoptedStorageRematerialization;
  assert.equal(
    first.value.workerResidentStage.workerAdoptedStorageRematerializationStatus,
    'worker-rematerialized-adopted-storage'
  );
  assert.equal(first.value.workerResidentStage.workerAdoptedStorageRematerializationApplied, true);
  assert.equal(firstRemat.reusedRetainedBuffers, false);
  assert.equal(firstRemat.hotBufferKey, seed.hotBufferKey);
  assert.equal(firstRemat.rawGpuBufferPeerComputeTransfer, false);
  assert.deepEqual(firstRemat.phaseCarrierPlan, {
    schema: 'peercompute.ulg.sph-phase-carrier-plan.v2',
    status: 'phase-lane-capacity-ready',
    lineageCapacity: 1,
    primaryCapacity: 1,
    phaseLaneCount: 4,
    phaseLaneStride: 1,
    companionStart: 1,
    companionCapacity: 3,
    particleCapacity: 4,
    stableLaneAddress: 'phaseLane*phaseLaneStride+lineageIndex'
  });
  assert.equal(firstRemat.phaseCarrierPlanPropagatedToUploads, true);
  assert.equal(Object.hasOwn(firstRemat.phaseCarrierPlan, 'localOnlyBuffer'), false);
  assert.equal(Object.hasOwn(firstRemat.phaseCarrierPlan, 'localOnlyArray'), false);
  assert.equal(firstRemat.stateBufferByteLength, buffers.sphParticleState.state.byteLength);
  assert.equal(
    first.value.workerResidentStage.workerRetainedContinuationInputStatus,
    'skipped-worker-retained-g2p-input-superseded-by-adopted-storage'
  );

  const second = await runUlgMechanicsResidentStageWorkerPayload(
    payload(p2gStage, context, null, laneOptions)
  );
  assert.equal(
    second.value.workerResidentStage.workerAdoptedStorageRematerialization.reusedRetainedBuffers,
    true
  );

  // A seed whose authoritative count does not match the packed rows must
  // fail honest instead of rematerializing a stale particle set.
  const mismatchContext = {
    ...context,
    common: {
      ...context.common,
      schroederAdoptedParticleStorageWorkerRematerializationSeed: {
        ...seed,
        hotBufferKey: 'ulg:sph-resident-schroeder-adopted-storage:test-seed-grown',
        authoritativeParticleCount: buffers.sphParticleState.particleCount + 4
      }
    }
  };
  const blocked = await runUlgMechanicsResidentStageWorkerPayload(
    payload(p2gStage, mismatchContext, null, {
      laneId: 'ulg:test:adopted-storage-worker-lane-mismatch',
      stateKey: 'ulg:test:adopted-storage-worker-state-mismatch'
    })
  );
  assert.equal(
    blocked.value.workerResidentStage.workerAdoptedStorageRematerializationStatus,
    'blocked-worker-adopted-storage-rematerialization-row-count-mismatch'
  );
  assert.equal(blocked.value.workerResidentStage.workerAdoptedStorageRematerializationApplied, false);

  const conflictingPlanContext = {
    ...context,
    common: {
      ...context.common,
      schroederAdoptedParticleStorageWorkerRematerializationSeed: {
        ...seed,
        hotBufferKey: 'ulg:sph-resident-schroeder-adopted-storage:test-seed-conflicting-phase-plan',
        phaseCarrierPlan: {
          ...buffers.sphParticleState.phaseCarrierPlan,
          stableLaneAddress: 'differentPhaseLaneAddress'
        }
      }
    }
  };
  const conflictingPlan = await runUlgMechanicsResidentStageWorkerPayload(
    payload(p2gStage, conflictingPlanContext, null, {
      laneId: 'ulg:test:adopted-storage-worker-lane-conflicting-phase-plan',
      stateKey: 'ulg:test:adopted-storage-worker-state-conflicting-phase-plan'
    })
  );
  assert.equal(
    conflictingPlan.value.workerResidentStage.workerAdoptedStorageRematerializationStatus,
    'blocked-worker-adopted-storage-rematerialization-phase-carrier-plan-mismatch'
  );
  assert.equal(
    conflictingPlan.value.workerResidentStage.workerAdoptedStorageRematerializationApplied,
    false
  );
  assert.match(
    conflictingPlan.value.workerResidentStage.workerAdoptedStorageRematerialization.errorMessage,
    /phaseCarrierPlan metadata conflicts across inputs/
  );
});

test('ULG resident stage worker fails closed until arbitrary-domain rematerialization has four authoritative buffers', async () => {
  const buffers = manualBuffers();
  buffers.sphParticleState.identity = Uint32Array.from([7]);
  buffers.sphParticleState.identityRequired = true;
  buffers.sphParticleState.identitySchema = ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA;
  buffers.sphParticleState.identityStrideBytes = Uint32Array.BYTES_PER_ELEMENT;
  buffers.sphParticleState.cpuStateStale = true;
  buffers.sphParticleState.cpuIdentityStale = true;
  buffers.mlsMpmParticleState.cpuStateStale = true;
  const device = createFakeGpuDevice();
  const seed = {
    schema: 'peercompute.ulg.schroeder-adopted-particle-storage-portable-materialization-seed.v0',
    status: 'schroeder-adopted-particle-storage-portable-materialization-seed-ready',
    ready: true,
    hotBufferKey: 'ulg:sph-resident-schroeder-adopted-storage:identity-seed',
    authoritativeParticleCount: 1,
    outputParticleCapacity: 1,
    identityRequired: true,
    identityRevision: 'identity-revision:7',
    identitySchema: ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
    identityStrideBytes: Uint32Array.BYTES_PER_ELEMENT,
    particleIdentityMutationApproved: true,
    requiresAuthoritativeFourBufferRows: true,
    renderDomainKeys: { 7: 'body-seven' }
  };
  const context = {
    taskIdPrefix: 'ulg:test:adopted-storage-worker-identity',
    preferWebGpu: false,
    readbackMode: 'full-parity-readback',
    common: {
      ...buffers,
      deviceResult: { device },
      useSchroederAdoptedParticleStorageWorkerRematerialization: true,
      schroederAdoptedParticleStorageWorkerRematerializationSeed: seed,
      gridSpacingM: buffers.sphParticleState.smoothingLengthM,
      boxDimsM: [5, 5, 5],
      dt: buffers.mlsMpmParticleState.mechanicsDtS,
      gravityMPerS2: [0, 0, 0],
      cflFactor: 10
    }
  };
  const p2gStage = stage('p2g', ['sph-particle-state'], ['mls-mpm-grid']);
  const blocked = await runUlgMechanicsResidentStageWorkerPayload(payload(p2gStage, context, null, {
    laneId: 'ulg:test:adopted-storage-worker-identity-blocked-lane',
    stateKey: 'ulg:test:adopted-storage-worker-identity-blocked-state'
  }));
  assert.equal(
    blocked.value.workerResidentStage.workerAdoptedStorageRematerializationStatus,
    'blocked-worker-adopted-storage-rematerialization-authoritative-four-buffer-snapshot-required'
  );
  assert.equal(blocked.value.workerResidentStage.workerAdoptedStorageRematerializationApplied, false);

  buffers.sphParticleState.cpuStateStale = false;
  buffers.sphParticleState.cpuIdentityStale = false;
  buffers.mlsMpmParticleState.cpuStateStale = false;
  const accepted = await runUlgMechanicsResidentStageWorkerPayload(payload(p2gStage, context, null, {
    laneId: 'ulg:test:adopted-storage-worker-identity-ready-lane',
    stateKey: 'ulg:test:adopted-storage-worker-identity-ready-state'
  }));
  const rematerialization = accepted.value.workerResidentStage.workerAdoptedStorageRematerialization;
  assert.equal(rematerialization.status, 'worker-rematerialized-adopted-storage');
  assert.equal(rematerialization.identityRequired, true);
  assert.equal(rematerialization.identityRevision, seed.identityRevision);
  assert.equal(rematerialization.identityBufferByteLength, Uint32Array.BYTES_PER_ELEMENT);
});

// --- Schroeder Simulation (SS) worker-lane stages (refactor increment W1) ---
// These tests drive the REAL spatial epoch generation builder on the
// synthetic fake-device fixture (same pattern as
// tests/schroederSpatialEpochGpu.test.mjs) and pin the mechanics-stage
// plumbing through the injectable
// stageOptions.schroederSameLevelMechanics.schroederSameLevelMechanicsRunner
// seam, which defaults to the real runSchroederSameLevelMechanicsWebGpu.
// The browser worker/device route is asserted separately by
// plan/refactor/w4-worker-lane-verify.mjs; this suite keeps the component
// contracts deterministic and independently runnable in Node.

function workerSchroederLevelAssignmentFixture(device, {
  particleCount = 2,
  storageGeneration = 11,
  physicsTick = 13,
  physicsSubstep = 0,
  positionEpoch = 17,
  topologyEpoch = 19,
  chartEpoch = 23,
  levelEpoch = 29,
  supportEpoch = 31,
  sourceStateBuffer = undefined,
  sourceThermoBuffer = undefined,
  sourceMechanicsBuffer = undefined,
  label = 'worker-ss-lane'
} = {}) {
  const taggedBuffer = (bufferLabel, size) => tagWebGpuBufferDevice(
    device.createBuffer({ label: bufferLabel, size, usage: 128 | 8 }),
    device
  );
  const assignmentBuffer = taggedBuffer(
    `${label}-assignment`,
    particleCount * SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT.length
      * Float32Array.BYTES_PER_ELEMENT
  );
  const resolvedSourceStateBuffer = sourceStateBuffer === undefined
    ? taggedBuffer(
        `${label}-state`,
        particleCount * 8 * Float32Array.BYTES_PER_ELEMENT
      )
    : sourceStateBuffer;
  const resolvedSourceMechanicsBuffer = sourceMechanicsBuffer === undefined
    ? null
    : sourceMechanicsBuffer;
  const resolvedSourceThermoBuffer = sourceThermoBuffer === undefined
    ? null
    : sourceThermoBuffer;
  return {
    schema: 'peercompute.ulg.schroeder-level-assignment-execution.v0',
    status: 'schroeder-level-assignment-submitted',
    bufferFamilyGenerationStatus:
      'schroeder-particle-buffer-family-generation-ready',
    particleCount,
    assignmentStrideFloats: SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT.length,
    assignmentBuffer,
    assignmentBufferByteLength: assignmentBuffer.size,
    ...(resolvedSourceStateBuffer
      ? {
          sourceStateBuffer: resolvedSourceStateBuffer,
          sourceStateBufferBorrowed: true
        }
      : {}),
    ...(resolvedSourceMechanicsBuffer
      ? {
          sourceMechanicsBuffer: resolvedSourceMechanicsBuffer,
          sourceMechanicsBufferBorrowed: true,
          sourceMechanicsProvenanceStatus:
            'schroeder-spatial-directory-source-mechanics-v0j-ready'
        }
      : {}),
    ...(resolvedSourceThermoBuffer
      ? {
          sourceThermoBuffer: resolvedSourceThermoBuffer,
          sourceThermoBufferBorrowed: true
        }
      : {}),
    storageGeneration,
    physicsTick,
    physicsSubstep,
    positionEpoch,
    topologyEpoch,
    chartEpoch,
    levelEpoch,
    supportEpoch,
    minLevel: 0,
    maxLevel: 0,
    chartId: 0,
    baseGridSpacingM: 1
  };
}

function workerSchroederStageContext(device, buffers, stageOptions = {}) {
  const mechanicsOptions = stageOptions.schroederSameLevelMechanics;
  const resolvedStageOptions = mechanicsOptions
    ? {
        ...stageOptions,
        schroederSameLevelMechanics: {
          ...mechanicsOptions,
          residentStepOptions: {
            gasPressureMechanicsBoundaryEnabled: false,
            ...(mechanicsOptions.residentStepOptions || {})
          }
        }
      }
    : stageOptions;
  return {
    schema: 'peercompute.ulg.mechanics-resident-stage-worker-context.v0',
    taskIdPrefix: 'ulg:test:schroeder-worker',
    preferWebGpu: true,
    readbackMode: 'no-full-readback',
    common: {
      ...buffers,
      deviceResult: { device },
      boxDimsM: [5, 5, 5],
      dt: buffers.mlsMpmParticleState.mechanicsDtS,
      gravityMPerS2: [0, 0, 0],
      cflFactor: 10
    },
    stageOptions: resolvedStageOptions
  };
}

function assertNoWorkerGpuBuffers(value, path = 'result', seen = new Set()) {
  if (value == null || typeof value !== 'object') return;
  if (seen.has(value)) return;
  seen.add(value);
  const bufferLike = typeof value.mapAsync === 'function'
    || typeof value.getMappedRange === 'function'
    || value.constructor?.name === 'GPUBuffer'
    || value.constructor?.name === 'FakeGpuBuffer';
  assert.equal(bufferLike, false, `GPU buffer leaked into worker result at ${path}`);
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return;
  for (const [key, entry] of Object.entries(value)) {
    assertNoWorkerGpuBuffers(entry, `${path}.${key}`, seen);
  }
}

test('authoritative two-level worker epoch mounts the exact read-only S9-C interface proposal', async () => {
  const device = createFakeGpuDevice();
  const buffers = manualBuffers();
  const particleCount = 1;
  const laneOptions = {
    laneId: 'ulg:test:schroeder-worker-two-level-s9c-lane',
    stateKey: 'ulg:test:schroeder-worker-two-level-s9c-state'
  };
  const taggedBuffer = (label, size) => tagWebGpuBufferDevice(
    device.createBuffer({ label, size, usage: 128 | 8 | 4 }),
    device
  );
  const mechanicsBuffer = taggedBuffer(
    'worker-two-level-s9c-mechanics',
    particleCount * 32 * Float32Array.BYTES_PER_ELEMENT
  );
  const thermoBuffer = taggedBuffer(
    'worker-two-level-s9c-thermo',
    particleCount * 12 * Float32Array.BYTES_PER_ELEMENT
  );
  const levelAssignment = {
    ...workerSchroederLevelAssignmentFixture(device, {
      particleCount,
      sourceThermoBuffer: thermoBuffer,
      sourceMechanicsBuffer: mechanicsBuffer,
      label: 'worker-two-level-s9c'
    }),
    minLevel: 0,
    maxLevel: 1
  };
  const identityBuffer = taggedBuffer(
    'worker-two-level-s9c-identity',
    particleCount * Uint32Array.BYTES_PER_ELEMENT
  );
  const sphParticleUpload = {
    schema: ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
    status: 'webgpu-uploaded',
    particleCount,
    stateBuffer: levelAssignment.sourceStateBuffer,
    thermoBuffer,
    identityBuffer
  };
  const mlsMpmParticleUpload = {
    schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
    status: 'webgpu-uploaded',
    particleCount,
    mechanicsBuffer
  };
  let generationArgs = null;
  let generation = null;

  try {
    const epoch = await runUlgMechanicsResidentStageWorkerPayload(payload(
      stage(
        'schroederSpatialEpoch',
        ['schroeder-level-assignment'],
        ['schroeder-spatial-epoch']
      ),
      workerSchroederStageContext(device, buffers, {
        schroederSpatialEpoch: {
          levelAssignment,
          particleIdentityBuffer: identityBuffer,
          particleIdentityStrideWords: 1,
          selectedLevel: 0,
          // Deliberately differ from the canonical mechanics spacing. The
          // worker must not build the epoch hierarchy from the SPH/common
          // support spacing when the exact Schroeder geometry is supplied.
          gridSpacingM: 5,
          baseGridSpacingM: 1,
          minLevel: 0,
          maxLevel: 1,
          enableTwoLevelMechanics: true,
          twoLevelMechanicsAuthority: 'authoritative',
          enableMechanicsFieldPairV2: true,
          exactNearCellTreeEnabled: false,
          sphParticleUpload,
          mlsMpmParticleUpload,
          async schroederSpatialEpochGenerationRunner(args) {
            generationArgs = args;
            generation = await runSchroederSpatialEpochGenerationWebGpu(args);
            return generation;
          }
        }
      }),
      null,
      laneOptions
    ));

    assert.equal(generationArgs.phaseVolumeInterfaceProposalEnabled, true);
    assert.equal(generationArgs.mechanicsFieldPairV2Enabled, true);
    assert.equal(
      generationArgs.activeSourceCapacity,
      particleCount,
      'the worker initial epoch must share the controller sparse-capacity key'
    );
    assert.equal(
      generationArgs.directArenaCount,
      4,
      'authoritative two-level worker epochs must share the controller arena family'
    );
    assert.equal(generationArgs.mechanicsLevels.length, 2);
    assert.equal(generationArgs.mechanicsLevels[0].mechanicsGrid.gridSpacingM, 1);
    assert.equal(generationArgs.mechanicsLevels[1].mechanicsGrid.gridSpacingM, 2);
    assert.equal(generation.phaseVolumeInterfaceProposalEnabled, true);
    assert.equal(generation.mechanicsLevelCount, 2);
    assert.ok(generation.phaseVolumeInterfaceProposal);
    assert.equal(
      generation.phaseVolumeInterfaceProposalRuntime.ownsExecution(
        generation.phaseVolumeInterfaceProposal
      ),
      true
    );
    assert.equal(generation.phaseVolumeInterfaceProposal.twoLevel, true);
    assert.equal(generation.phaseVolumeInterfaceProposal.submitPerformed, true);
    assert.equal(
      validateSchroederSpatialEpochGenerationLevelAssignment(generation, {
        device,
        levelAssignment,
        sphParticleUpload,
        mlsMpmParticleUpload
      }),
      true
    );
    assert.equal(
      validateSchroederSpatialEpochGenerationLevelAssignment(generation, {
        device,
        levelAssignment: { ...levelAssignment },
        sphParticleUpload,
        mlsMpmParticleUpload
      }),
      false,
      'a copied public assignment cannot borrow the generation lineage'
    );
    assert.equal(epoch.value.epochSeal.mechanicsLevelCount, 2);
    assert.deepEqual(epoch.value.epochSeal.mechanicsLevels, [0, 1]);
    assert.equal(epoch.value.generationSummary.activeSourceCapacity, particleCount);
    assert.equal(epoch.value.generationSummary.directArenaCount, 4);
    assertNoWorkerGpuBuffers(epoch, 'twoLevelS9cEpoch');

    let authoritativeTwoLevelRunnerCallCount = 0;
    const reachedAuthoritativeTwoLevelRunner = new Error(
      'reached exact seeded authoritative two-level runner'
    );
    await assert.rejects(
      runUlgMechanicsResidentStageWorkerPayload(payload(
        stage(
          'schroederSameLevelMechanics',
          ['schroeder-spatial-epoch', 'sph-particle-state', 'mls-mpm-mechanics'],
          ['sph-particle-state', 'mls-mpm-mechanics']
        ),
        workerSchroederStageContext(device, buffers, {
          schroederSameLevelMechanics: {
            expectedSpatialEpochSeal: epoch.value.epochSeal,
            enableTwoLevelMechanics: true,
            twoLevelMechanicsAuthority: 'authoritative',
            enableMechanicsFieldPairV2: true,
            async schroederSameLevelMechanicsRunner(args) {
              const schroederSpatialEpochTransaction =
                createSchroederSameLevelMechanicsSpatialEpochTransaction({
                  device,
                  generation: args.spatialEpochGeneration,
                  sphParticleUpload: args.sphParticleUpload,
                  mlsMpmParticleUpload: args.mlsMpmParticleUpload,
                  residentStepOptions: args.residentStepOptions,
                  twoLevelAuthoritative: true
                });
              await assert.rejects(
                runSchroederSameLevelMechanicsWebGpu({
                  ...args,
                  levelAssignment: { ...args.levelAssignment },
                  schroederSpatialEpochTransaction
                }),
                (error) => {
                  assert.equal(
                    error?.code,
                    'ERR_SCHROEDER_TWO_LEVEL_SPATIAL_TRANSACTION_REQUIRED'
                  );
                  return true;
                }
              );
              return runSchroederSameLevelMechanicsWebGpu({
                ...args,
                schroederSpatialEpochTransaction,
                enableLawQueue: false,
                enableLawNeighborCandidates: false,
                enableCrossLevelCoupling: false,
                enablePressureInterfaceOwnerScope: false,
                async twoLevelMechanicsRunner() {
                  authoritativeTwoLevelRunnerCallCount += 1;
                  throw reachedAuthoritativeTwoLevelRunner;
                }
              });
            }
          }
        }),
        epoch.value,
        laneOptions
      )),
      (error) => {
        assert.match(
          error?.message ?? '',
          /reached exact seeded authoritative two-level runner/
        );
        return true;
      }
    );
    assert.equal(
      authoritativeTwoLevelRunnerCallCount,
      1,
      'the exact seeded assignment/generation transaction must pass hierarchy admission'
    );
  } finally {
    releaseUlgMechanicsResidentStageWorkerLane(laneOptions);
  }
});

test('ULG resident stage worker chains schroederSpatialEpoch and schroederSameLevelMechanics through one retained SS lane', async () => {
  const device = createFakeGpuDevice();
  const deviceId = webGpuDeviceId(device);
  const buffers = manualBuffers();
  const laneOptions = {
    laneId: 'ulg:test:schroeder-worker-lane',
    stateKey: 'ulg:test:schroeder-worker-state'
  };
  const particleCount = 2;
  const taggedBuffer = (label, size) => tagWebGpuBufferDevice(
    device.createBuffer({ label, size, usage: 128 | 8 }),
    device
  );
  const levelAssignment = workerSchroederLevelAssignmentFixture(device, {
    particleCount,
    label: 'worker-ss-chain-step0'
  });
  const particleIdentityBuffer = taggedBuffer(
    'worker-ss-chain-identity',
    particleCount * Uint32Array.BYTES_PER_ELEMENT
  );
  const initialThermoBuffer = taggedBuffer(
    'worker-ss-chain-thermo',
    particleCount * 12 * Float32Array.BYTES_PER_ELEMENT
  );
  const initialMechanicsBuffer = taggedBuffer(
    'worker-ss-chain-mechanics',
    particleCount * 32 * Float32Array.BYTES_PER_ELEMENT
  );
  const mechanicsGrid = {
    selectedLevel: 0,
    gridDims: [2, 2, 2],
    gridNodeCount: 8,
    gridShift: 1,
    gridSpacingM: 1
  };
  const epochStageOptions = {
    levelAssignment,
    particleIdentityBuffer,
    particleIdentityStrideWords: 1,
    selectedLevel: 0,
    mechanicsGrid,
    exactNearCellTreeEnabled: false,
    residentStepOptions: {
      residentGpuTimestampProfilingRequested: true
    },
    sphParticleUpload: {
      particleCount,
      stateBuffer: levelAssignment.sourceStateBuffer,
      thermoBuffer: initialThermoBuffer,
      identityBuffer: particleIdentityBuffer
    },
    mlsMpmParticleUpload: {
      particleCount,
      mechanicsBuffer: initialMechanicsBuffer
    }
  };

  // Step 0 epoch: the REAL generation builder runs in the worker stage.
  const epoch = await runUlgMechanicsResidentStageWorkerPayload(
    payload(
      stage(
        'schroederSpatialEpoch',
        ['schroeder-level-assignment'],
        ['schroeder-spatial-epoch']
      ),
      workerSchroederStageContext(device, buffers, {
        schroederSpatialEpoch: epochStageOptions
      }),
      null,
      laneOptions
    ),
    // A caller-spoofed options object cannot acquire the module-private
    // schedule fence-deferral capability.
    { deferQueueFenceToResidentScheduleTerminal: true }
  );
  assert.equal(epoch.value.schema, ULG_WORKER_SCHROEDER_SPATIAL_EPOCH_STAGE_SCHEMA);
  assert.equal(epoch.value.status, 'worker-schroeder-spatial-epoch-retained');
  assert.equal(epoch.value.epochRetainedInLane, true);
  assert.equal(epoch.value.epochStepOrdinal, 0);
  assert.equal(epoch.value.levelAssignmentSource, 'stage-option-level-assignment');
  const epochSeal = epoch.value.epochSeal;
  assert.equal(epochSeal.schema, ULG_WORKER_SCHROEDER_EPOCH_SEAL_SCHEMA);
  assert.equal(epochSeal.deviceId, deviceId);
  assert.equal(epochSeal.consumerDeviceId, deviceId);
  assert.ok(Number.isInteger(epochSeal.generationId) && epochSeal.generationId > 0);
  assert.equal(epochSeal.storageGeneration, levelAssignment.storageGeneration);
  assert.equal(epochSeal.physicsTick, levelAssignment.physicsTick);
  assert.equal(epochSeal.positionEpoch, levelAssignment.positionEpoch);
  assert.equal(epochSeal.topologyEpoch, levelAssignment.topologyEpoch);
  assert.equal(epochSeal.mechanicsLevelCount, 1);
  assert.match(epoch.value.directoryBufferRef.ref, /^ulg-worker:/);
  assert.match(epoch.value.levelAssignmentBufferRef.ref, /^ulg-worker:/);
  assert.ok(epoch.retainedBufferRefs.includes(epoch.value.directoryBufferRef.ref));
  assert.ok(epoch.retainedBufferRefs.includes(epoch.value.levelAssignmentBufferRef.ref));
  assert.equal(epoch.value.workerResidentStage.stageId, 'schroederSpatialEpoch');
  assert.equal(
    epoch.value.workerResidentStage.cloneableResultReturned,
    true,
    'standalone stages must retain the public clone-safe transport envelope'
  );
  assert.equal(epoch.value.gpuFence.fenceSatisfied, true);
  assertNoWorkerGpuBuffers(epoch, 'epoch');
  structuredClone(epoch.value);

  // Step 0 mechanics: consumes the lane-retained epoch generation across
  // messages through the injectable kernel-runner seam.
  const nextStateBuffer = taggedBuffer(
    'worker-ss-chain-next-state',
    particleCount * 8 * Float32Array.BYTES_PER_ELEMENT
  );
  const nextThermoBuffer = taggedBuffer(
    'worker-ss-chain-next-thermo',
    particleCount * 12 * Float32Array.BYTES_PER_ELEMENT
  );
  const nextIdentityBuffer = taggedBuffer(
    'worker-ss-chain-next-identity',
    particleCount * Uint32Array.BYTES_PER_ELEMENT
  );
  const nextMechanicsBuffer = taggedBuffer(
    'worker-ss-chain-next-mechanics',
    particleCount * 32 * Float32Array.BYTES_PER_ELEMENT
  );
  const finalRenderProxySubmitFusion = Object.freeze({
    status: 'final-render-proxy-submit-fused',
    eligible: true,
    fused: true,
    borrowed: false,
    realSubmitCount: 1,
    submittedCommandBufferCount: 3,
    heldSubmitCount: 2,
    writeThroughCount: 1,
    staleWriteFlushCount: 0,
    fenceFlushCount: 0,
    postSubmitCleanupCount: 1,
    openAfter: false,
    reasons: Object.freeze([])
  });
  const observedStepZero = {};
  const mechanics = await runUlgMechanicsResidentStageWorkerPayload(payload(
    stage(
      'schroederSameLevelMechanics',
      ['schroeder-spatial-epoch', 'sph-particle-state', 'mls-mpm-mechanics'],
      ['sph-particle-state', 'mls-mpm-mechanics']
    ),
    workerSchroederStageContext(device, buffers, {
      schroederSameLevelMechanics: {
        expectedSpatialEpochSeal: epochSeal,
        enableTwoLevelMechanics: true,
        twoLevelMechanicsAuthority: 'authoritative',
        twoLevelFineSubstepCount: 3,
        residentStepOptions: {
          residentGpuTimestampProfilingRequested: true
        },
        async schroederSameLevelMechanicsRunner(args) {
          observedStepZero.args = args;
          assert.equal(args.gpuTimestampRecorder?.active, true);
          assert.equal(
            args.gpuTimestampRecorder.encoderTimestampProfile()
              .timestampQueryRequested,
            true
          );
          await args.gpuTimestampRecorder.measureQueueStage({
            producerId: 'test-two-level:fine-0-p2g',
            stage: 'fine-0-p2g'
          }, async () => true);
          const queueStageGpuMs = args.gpuTimestampRecorder.stageGpuMs();
          const queueStageGpuStats = args.gpuTimestampRecorder.stageGpuStats();
          return {
            status: 'schroeder-same-level-mechanics-completed',
            selectedLevel: 0,
            finalRenderProxyBuildStatus:
              'final-render-proxy-published-from-exact-committed-successor',
            finalRenderProxySubmitFusionStatus:
              'final-render-proxy-submit-fused',
            finalRenderProxySubmitFusion,
            residentStep: {
              backend: 'webgpu',
              status: 'resident-step-completed',
              readbackMode: 'no-full-readback',
              stageStatus: { p2g: 'completed', g2p: 'completed' },
              stageBackends: { p2g: 'webgpu', g2p: 'webgpu' },
              stageTiming: {
                schema: 'peercompute.ulg.mls-mpm-resident-stage-timing.v0',
                totalMs: null,
                stageMs: {},
                stageGpuMs: null,
                gpuTimestampProfile: null,
                queueStageGpuMs,
                queueStageGpuStats,
                queueStageGpuSummaryStatus:
                  'gpu-timestamp-recorder-stage-summary-ready',
                queueStageGpuRecorderSchema:
                  args.gpuTimestampRecorder.schema,
                queueStageGpuRecorderKind:
                  args.gpuTimestampRecorder.recorderKind,
                queueStageGpuRecorderCapabilities:
                  args.gpuTimestampRecorder.capabilities
              },
              postMechanicsClosure: {
                schema: 'peercompute.ulg.mls-mpm-post-mechanics-closure.v1',
                status: 'post-mechanics-closure-complete',
                backend: 'webgpu',
                executedStageOrder: [
                  'thermal-phase',
                  'reaction-discovery',
                  'reaction-product',
                  'phase-carrier-transfer-v2',
                  'mechanics-constitutive-refresh'
                ],
                thermalStep: {
                  status: 'thermal-step-executed'
                },
                reactionStep: {
                  status: 'reaction-step-executed'
                },
                phaseCarrierTransferStep: {
                  status: 'phase-carrier-transfer-submitted'
                },
                mechanicsRefreshStep: {
                  status: 'mechanics-constitutive-refresh-executed'
                },
                fullParticleReadbackFree: true,
                residentContinuationReady: true
              },
              nextParticleUploads: {
                sphParticleUpload: {
                  particleCount,
                  stateBuffer: nextStateBuffer,
                  thermoBuffer: nextThermoBuffer,
                  identityBuffer: nextIdentityBuffer
                },
                mlsMpmParticleUpload: {
                  particleCount,
                  mechanicsBuffer: nextMechanicsBuffer
                }
              }
            },
            schroederSpatialEpochReleasePromise: Promise.resolve(true),
            currentSchroederSpatialEpochGenerationSummary: () => ({
              status: 'synthetic-generation-summary'
            })
          };
        }
      }
    }),
    epoch.value,
    laneOptions
  ));
  const stepZeroArgs = observedStepZero.args;
  assert.equal(stepZeroArgs.device, device);
  assert.equal(stepZeroArgs.spatialEpochGeneration.ready, true);
  assert.equal(
    stepZeroArgs.spatialEpochGeneration.execution.generationId,
    epochSeal.generationId
  );
  assert.equal(stepZeroArgs.enableSpatialEpochGeneration, false);
  assert.equal(
    stepZeroArgs.enableCanonicalSingleLevelQueueOrderedCleanup,
    false,
    'standalone W1 calls must retain conservative submitted-work cleanup'
  );
  assert.equal(stepZeroArgs.enableTwoLevelMechanics, true);
  assert.equal(stepZeroArgs.twoLevelMechanicsAuthority, 'authoritative');
  assert.equal(stepZeroArgs.twoLevelFineSubstepCount, 3);
  assert.equal(
    stepZeroArgs.gpuTimestampRecorder.schema,
    'peercompute.ulg.sph-gpu-queue-stage-recorder.v0'
  );
  assert.equal(
    stepZeroArgs.gpuTimestampRecorder.encoderTimestampProfile().status,
    'gpu-timestamp-encoder-stage-recorder-destroyed'
  );
  assert.ok(
    mechanics.value.hierarchyStageSummary.residentStageTiming
      .queueStageGpuMs['fine-0-p2g'] >= 0
  );
  assert.equal(
    mechanics.value.hierarchyStageSummary.residentStageTiming
      .queueStageGpuStats['fine-0-p2g'].count,
    1
  );
  assert.equal(
    mechanics.value.hierarchyStageSummary.residentStageTiming
      .queueStageGpuRecorderKind,
    'queue-fence-stage-summary'
  );
  assert.equal(
    stepZeroArgs.residentStepOptions.summaryRunner,
    undefined,
    'standalone W1 calls must retain the resident runner default contract'
  );
  assert.equal(stepZeroArgs.levelAssignment, levelAssignment);
  assert.equal(
    stepZeroArgs.sphParticleUpload.stateBuffer,
    levelAssignment.sourceStateBuffer
  );
  assert.equal(
    stepZeroArgs.mlsMpmParticleUpload.mechanicsBuffer,
    initialMechanicsBuffer
  );
  assert.equal(
    mechanics.value.schema,
    ULG_WORKER_SCHROEDER_SAME_LEVEL_MECHANICS_STAGE_SCHEMA
  );
  assert.equal(
    mechanics.value.status,
    'worker-schroeder-same-level-mechanics-completed'
  );
  assert.equal(mechanics.value.epochConsumed, true);
  assert.equal(mechanics.value.epochReleaseScheduled, true);
  assert.equal(mechanics.value.epochSeal.generationId, epochSeal.generationId);
  assert.equal(
    mechanics.value.hierarchyStageSummary.status,
    'worker-schroeder-hierarchy-stage-summary-ready'
  );
  assert.equal(mechanics.value.hierarchyStageSummary.mechanicsLevelCount, 1);
  assert.equal(mechanics.value.hierarchyStageSummary.twoLevelMechanicsEnabled, true);
  assert.equal(
    mechanics.value.hierarchyStageSummary.twoLevelMechanicsAuthority,
    'authoritative'
  );
  assert.equal(mechanics.value.hierarchyStageSummary.fullParticleReadbackPerformed, false);
  assert.equal(
    mechanics.value.hierarchyStageSummary.finalRenderProxyBuildStatus,
    'final-render-proxy-published-from-exact-committed-successor'
  );
  assert.equal(
    mechanics.value.hierarchyStageSummary.finalRenderProxySubmitFusionStatus,
    'final-render-proxy-submit-fused'
  );
  assert.deepEqual(
    mechanics.value.hierarchyStageSummary.finalRenderProxySubmitFusion,
    finalRenderProxySubmitFusion
  );
  assert.notStrictEqual(
    mechanics.value.hierarchyStageSummary.finalRenderProxySubmitFusion,
    finalRenderProxySubmitFusion
  );
  assert.notStrictEqual(
    mechanics.value.hierarchyStageSummary.finalRenderProxySubmitFusion.reasons,
    finalRenderProxySubmitFusion.reasons
  );
  assert.deepEqual(
    mechanics.value.hierarchyStageSummary.postMechanicsClosure,
    {
      schema: 'peercompute.ulg.mls-mpm-post-mechanics-closure.v1',
      status: 'post-mechanics-closure-complete',
      backend: 'webgpu',
      executedStageOrder: [
        'thermal-phase',
        'reaction-discovery',
        'reaction-product',
        'phase-carrier-transfer-v2',
        'mechanics-constitutive-refresh'
      ],
      thermalStatus: 'thermal-step-executed',
      reactionStatus: 'reaction-step-executed',
      mechanicsRefreshStatus: 'mechanics-constitutive-refresh-executed',
      phaseCarrierTransferStatus: 'phase-carrier-transfer-submitted',
      fullParticleReadbackFree: true,
      residentContinuationReady: true
    }
  );
  assert.equal(
    mechanics.value.schroederSummary.spatialEpochGenerationSummary.status,
    'synthetic-generation-summary'
  );
  assert.match(mechanics.value.postStep.stateBufferRef.ref, /^ulg-worker:/);
  assert.match(mechanics.value.postStep.thermoBufferRef.ref, /^ulg-worker:/);
  assert.match(mechanics.value.postStep.identityBufferRef.ref, /^ulg-worker:/);
  assert.match(mechanics.value.postStep.mechanicsBufferRef.ref, /^ulg-worker:/);
  assert.ok(mechanics.retainedBufferRefs.includes(
    mechanics.value.postStep.stateBufferRef.ref
  ));
  assert.equal(
    mechanics.value.workerResidentStage.cloneableResultReturned,
    true,
    'standalone mechanics must retain the public clone-safe transport envelope'
  );
  assert.equal(mechanics.value.gpuFence.fenceSatisfied, true);
  assertNoWorkerGpuBuffers(mechanics, 'mechanics');
  structuredClone(mechanics.value);
  // The worker owns the injected generation's release; it settles after the
  // step's queue submissions.
  assert.equal(
    await stepZeroArgs.spatialEpochGeneration.releasePromise,
    true
  );

  // Step 1 epoch: the next spatial epoch consumes the post-step particle
  // buffers retained by the mechanics stage in the same lane.
  const levelAssignmentStepOne = workerSchroederLevelAssignmentFixture(device, {
    particleCount,
    storageGeneration: 12,
    physicsTick: 14,
    positionEpoch: 18,
    topologyEpoch: 19,
    sourceStateBuffer: null,
    label: 'worker-ss-chain-step1'
  });
  const epochStepOne = await runUlgMechanicsResidentStageWorkerPayload(payload(
    stage(
      'schroederSpatialEpoch',
      ['schroeder-level-assignment'],
      ['schroeder-spatial-epoch']
    ),
    workerSchroederStageContext(device, buffers, {
      schroederSpatialEpoch: {
        levelAssignment: levelAssignmentStepOne,
        useWorkerRetainedParticleBuffers: true,
        particleIdentityStrideWords: 1,
        selectedLevel: 0,
        mechanicsGrid,
        exactNearCellTreeEnabled: false
      }
    }),
    mechanics.value,
    laneOptions
  ));
  assert.equal(
    epochStepOne.value.levelAssignmentSource,
    'stage-option-level-assignment-with-worker-retained-particle-buffers'
  );
  assert.equal(epochStepOne.value.epochStepOrdinal, 1);
  assert.equal(epochStepOne.value.epochSeal.storageGeneration, 12);
  assert.equal(epochStepOne.value.epochSeal.physicsTick, 14);
  assert.notEqual(
    epochStepOne.value.epochSeal.generationId,
    epochSeal.generationId
  );
  assertNoWorkerGpuBuffers(epochStepOne, 'epochStepOne');

  // Step 1 mechanics: proves the alternating pair is one SS step chain —
  // the second epoch was built against the first step's post-step state
  // buffer, and the second mechanics step consumes those same retained
  // buffers.
  const observedStepOne = {};
  const mechanicsStepOne = await runUlgMechanicsResidentStageWorkerPayload(payload(
    stage(
      'schroederSameLevelMechanics',
      ['schroeder-spatial-epoch', 'sph-particle-state', 'mls-mpm-mechanics'],
      ['sph-particle-state', 'mls-mpm-mechanics']
    ),
    workerSchroederStageContext(device, buffers, {
      schroederSameLevelMechanics: {
        expectedSpatialEpochSeal: epochStepOne.value.epochSeal,
        async schroederSameLevelMechanicsRunner(args) {
          observedStepOne.args = args;
          return {
            status: 'schroeder-same-level-mechanics-completed',
            selectedLevel: 0,
            residentStep: {
              backend: 'webgpu',
              status: 'resident-step-completed',
              readbackMode: 'no-full-readback',
              stageStatus: {},
              stageBackends: {},
              nextParticleUploads: {
                sphParticleUpload: {
                  particleCount,
                  stateBuffer: taggedBuffer('worker-ss-chain-step1-state', 64),
                  thermoBuffer: taggedBuffer('worker-ss-chain-step1-thermo', 96),
                  identityBuffer: taggedBuffer('worker-ss-chain-step1-identity', 8)
                },
                mlsMpmParticleUpload: {
                  particleCount,
                  mechanicsBuffer:
                    taggedBuffer('worker-ss-chain-step1-mechanics', 256)
                }
              }
            },
            schroederSpatialEpochReleasePromise: Promise.resolve(true)
          };
        }
      }
    }),
    epochStepOne.value,
    laneOptions
  ));
  const stepOneArgs = observedStepOne.args;
  assert.equal(
    stepOneArgs.gpuTimestampRecorder,
    undefined,
    'profiling must not create a queue-stage recorder outside two-level mode'
  );
  assert.equal(stepOneArgs.sphParticleUpload.stateBuffer, nextStateBuffer);
  assert.equal(stepOneArgs.sphParticleUpload.thermoBuffer, nextThermoBuffer);
  assert.equal(stepOneArgs.sphParticleUpload.identityBuffer, nextIdentityBuffer);
  assert.equal(
    stepOneArgs.mlsMpmParticleUpload.mechanicsBuffer,
    nextMechanicsBuffer
  );
  assert.equal(
    stepOneArgs.spatialEpochGeneration.source.sourceStateBuffer,
    nextStateBuffer
  );
  assert.equal(
    stepOneArgs.spatialEpochGeneration.execution.storageGeneration,
    12
  );
  assert.equal(mechanicsStepOne.value.epochConsumed, true);
  assert.equal(mechanicsStepOne.value.epochReleaseScheduled, true);
  assertNoWorkerGpuBuffers(mechanicsStepOne, 'mechanicsStepOne');
});

test('ULG resident stage worker SS stages fail closed on missing epoch and identity mismatch', async () => {
  const device = createFakeGpuDevice();
  const buffers = manualBuffers();
  const particleCount = 2;
  const mechanicsGrid = {
    selectedLevel: 0,
    gridDims: [2, 2, 2],
    gridNodeCount: 8,
    gridShift: 1,
    gridSpacingM: 1
  };
  const mechanicsStage = stage(
    'schroederSameLevelMechanics',
    ['schroeder-spatial-epoch'],
    ['sph-particle-state']
  );
  const epochStage = stage(
    'schroederSpatialEpoch',
    ['schroeder-level-assignment'],
    ['schroeder-spatial-epoch']
  );

  // A mechanics stage with no retained epoch in the lane fails closed.
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerPayload(payload(
      mechanicsStage,
      workerSchroederStageContext(device, buffers, {}),
      null,
      {
        laneId: 'ulg:test:schroeder-guard-empty-lane',
        stateKey: 'ulg:test:schroeder-guard-empty-state'
      }
    )),
    /lane-epoch-missing/
  );

  // An epoch stage without any level-assignment source fails closed.
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerPayload(payload(
      epochStage,
      workerSchroederStageContext(device, buffers, {
        schroederSpatialEpoch: {}
      }),
      null,
      {
        laneId: 'ulg:test:schroeder-guard-no-source-lane',
        stateKey: 'ulg:test:schroeder-guard-no-source-state'
      }
    )),
    /level-assignment-source-missing/
  );

  // A generation the real builder refuses is a structured stage error, not a
  // silent fallback.
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerPayload(payload(
      epochStage,
      workerSchroederStageContext(device, buffers, {
        schroederSpatialEpoch: {
          levelAssignment: {
            ...workerSchroederLevelAssignmentFixture(device, {
              particleCount,
              label: 'worker-ss-guard-not-ready'
            }),
            bufferFamilyGenerationStatus: 'schroeder-particle-buffer-family-generation-blocked'
          },
          mechanicsGrid,
          exactNearCellTreeEnabled: false
        }
      }),
      null,
      {
        laneId: 'ulg:test:schroeder-guard-not-ready-lane',
        stateKey: 'ulg:test:schroeder-guard-not-ready-state'
      }
    )),
    /generation-not-ready/
  );

  // Retain a real epoch, then pin the guard set that protects it.
  const guardLane = {
    laneId: 'ulg:test:schroeder-guard-retained-lane',
    stateKey: 'ulg:test:schroeder-guard-retained-state'
  };
  const levelAssignment = workerSchroederLevelAssignmentFixture(device, {
    particleCount,
    label: 'worker-ss-guard-retained'
  });
  const epoch = await runUlgMechanicsResidentStageWorkerPayload(payload(
    epochStage,
    workerSchroederStageContext(device, buffers, {
      schroederSpatialEpoch: {
        levelAssignment,
        selectedLevel: 0,
        mechanicsGrid,
        exactNearCellTreeEnabled: false,
        sphParticleUpload: {
          particleCount,
          stateBuffer: levelAssignment.sourceStateBuffer
        }
      }
    }),
    null,
    guardLane
  ));
  assert.equal(epoch.value.epochRetainedInLane, true);

  // A second epoch stage must not silently supersede an unconsumed epoch.
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerPayload(payload(
      epochStage,
      workerSchroederStageContext(device, buffers, {
        schroederSpatialEpoch: {
          levelAssignment: workerSchroederLevelAssignmentFixture(device, {
            particleCount,
            label: 'worker-ss-guard-second-epoch'
          }),
          mechanicsGrid,
          exactNearCellTreeEnabled: false
        }
      }),
      null,
      guardLane
    )),
    /unconsumed-epoch-retained/
  );

  // Generation identity mismatch: the caller-pinned seal must match the
  // retained generation's own identity words.
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerPayload(payload(
      mechanicsStage,
      workerSchroederStageContext(device, buffers, {
        schroederSameLevelMechanics: {
          expectedSpatialEpochSeal: {
            ...epoch.value.epochSeal,
            generationId: epoch.value.epochSeal.generationId + 999
          },
          async schroederSameLevelMechanicsRunner() {
            throw new Error('kernel must not run on identity mismatch');
          }
        }
      }),
      null,
      guardLane
    )),
    /epoch-seal-mismatch/
  );

  // Cross-device consumption of a retained epoch fails closed.
  const foreignDevice = createFakeGpuDevice();
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerPayload(payload(
      mechanicsStage,
      workerSchroederStageContext(foreignDevice, buffers, {
        schroederSameLevelMechanics: {
          async schroederSameLevelMechanicsRunner() {
            throw new Error('kernel must not run on device mismatch');
          }
        }
      }),
      null,
      guardLane
    )),
    /epoch-device-mismatch/
  );

  // The lane epoch is still intact after the rejections; a valid mechanics
  // stage still consumes it, and a consumed epoch cannot be consumed twice.
  const mechanics = await runUlgMechanicsResidentStageWorkerPayload(payload(
    mechanicsStage,
    workerSchroederStageContext(device, buffers, {
      schroederSameLevelMechanics: {
        expectedSpatialEpochSeal: epoch.value.epochSeal,
        async schroederSameLevelMechanicsRunner() {
          return {
            status: 'schroeder-same-level-mechanics-completed',
            residentStep: {
              backend: 'webgpu',
              status: 'resident-step-completed',
              nextParticleUploads: null
            }
          };
        }
      }
    }),
    null,
    guardLane
  ));
  assert.equal(mechanics.value.epochConsumed, true);
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerPayload(payload(
      mechanicsStage,
      workerSchroederStageContext(device, buffers, {
        schroederSameLevelMechanics: {
          async schroederSameLevelMechanicsRunner() {
            throw new Error('kernel must not run on a consumed epoch');
          }
        }
      }),
      null,
      guardLane
    )),
    /lane-epoch-already-consumed/
  );
});

// --- SS worker-side batched schedule driver (refactor increment W2) ---
// The schedule driver loops the W1 stage pair internally; these tests drive
// the REAL spatial epoch generation builder on the synthetic fake-device
// fixture with per-step level assignments whose identity words advance, and
// pin the mechanics side through the injectable
// stageOptions.schroederSameLevelMechanics.schroederSameLevelMechanicsRunner
// seam exactly like the W1 tests above.
// The real browser WebGPU schedule route is asserted separately by
// plan/refactor/w4-worker-lane-verify.mjs.

function writeWorkerTerminalRefluxReceiptTarget(target, {
  rolledBack = false,
  ownerGeneration = 1,
  cflIntervalRejectTrace = null
} = {}) {
  const words = createSchroederCrossLevelRefluxLedgerHeader({
    rowCapacity: 1,
    completionOrdinal: target.expectedCompletionOrdinal,
    fineSubstepCount: target.expectedFineSubstepCount,
    fineLevel: target.expectedFineLevel,
    coarseLevel: target.expectedCoarseLevel,
    coarseGridSpacingM: 1,
    macroOwnerId: target.expectedCompletionOrdinal,
    macroOwnerGeneration: ownerGeneration
  });
  words[2] = SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_READY
    | SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_ADMITTED;
  words[4] = 1;
  words[8] = target.expectedFineSubstepCount;
  words[9] = 1;
  words[15] = target.expectedFineSubstepCount;
  words[59] = SCHROEDER_CROSS_LEVEL_REFLUX_PHASE_CONSUMED;
  words[80] = SCHROEDER_CROSS_LEVEL_REFLUX_TERMINAL_RECEIPT_CONSUMED;
  words[81] = 0x12340000 + target.stepOrdinal;
  words[95] = words[81];
  words[96] = 1;
  words[97] = words[98];
  words[99] = 1;
  words[100] = 1;
  words[101] = 1;
  words[102] = 1;
  words[103] = 1;
  words[111] = words[98] + 1;
  words[118] = 1;
  words[119] = 1;
  words[120] = target.expectedFineSubstepCount;
  words[121] = 1;
  words[122] = rolledBack ? 1 : 0;
  words[124] = 0xffff_ffff;
  words[125] = 0;
  if (cflIntervalRejectTrace) {
    const stageCode = {
      fine: 0,
      coarse: 1,
      seal: 2
    }[cflIntervalRejectTrace.stage];
    const priorRegimeCode = {
      guard: 0,
      audit: 1,
      outside: 2,
      invalid: 3
    }[cflIntervalRejectTrace.priorRegime ?? 'invalid'];
    const fieldOrdinal = stageCode === 2
      ? 0xffff
      : Math.min(0xffff, cflIntervalRejectTrace.fieldOrdinal ?? 0);
    words[124] = (
      0xc700_0000
      | ((stageCode & 3) << 22)
      | (cflIntervalRejectTrace.phaseIntervalValid === true ? 1 << 21 : 0)
      | (cflIntervalRejectTrace.fullIntervalValid === true ? 1 << 20 : 0)
      | (cflIntervalRejectTrace.localIntervalOverlap === true ? 1 << 19 : 0)
      | ((priorRegimeCode & 3) << 17)
      | (cflIntervalRejectTrace.fieldOrdinalOverflow === true ? 1 << 16 : 0)
      | fieldOrdinal
    ) >>> 0;
    const payload = stageCode === 2
      ? [
          cflIntervalRejectTrace.globalAlphaInterval?.lower ?? 0,
          cflIntervalRejectTrace.globalAlphaInterval?.upper ?? 0,
          0, 0, 0, 0, 0, 0, 0, 0, 0
        ]
      : [
          ...(cflIntervalRejectTrace.priorVelocityMPerS ?? [0, 0, 0]),
          ...(cflIntervalRejectTrace.phaseDeltaVelocityMPerS ?? [0, 0, 0]),
          ...(cflIntervalRejectTrace.fullDeltaVelocityMPerS ?? [0, 0, 0]),
          cflIntervalRejectTrace.maximumVelocityMPerS ?? 0,
          cflIntervalRejectTrace.correctionCeilingMPerS ?? 0
        ];
    new Float32Array(words.buffer).set(payload, 125);
  }
  target.targetBuffer.bytes.set(
    new Uint8Array(words.buffer, words.byteOffset, words.byteLength),
    target.targetOffsetBytes
  );
  return {
    schema: ULG_SCHROEDER_FUSED_TERMINAL_REFLUX_RECEIPT_COPY_SCHEMA,
    status: 'terminal-reflux-header-copy-submitted-unverified',
    scheduleId: target.scheduleId,
    laneId: target.laneId,
    stateKey: target.stateKey,
    stepOrdinal: target.stepOrdinal,
    targetOffsetBytes: target.targetOffsetBytes,
    targetByteLength: target.targetByteLength,
    completionOrdinal: target.expectedCompletionOrdinal,
    macroOwnerId: target.expectedCompletionOrdinal,
    ownerGeneration,
    fineSubstepCount: target.expectedFineSubstepCount,
    fineLevel: target.expectedFineLevel,
    coarseLevel: target.expectedCoarseLevel,
    queueSubmissionStatus: 'copy-submitted-unverified'
  };
}

function uploadWorkerTestDispersedMediumOptics(
  device,
  sphParticleUpload,
  label
) {
  const particleCount = sphParticleUpload.particleCount;
  return uploadSphGpuParticleDispersedMediumOpticsSidecar(
    device,
    buildSphDispersedMediumGpuBuffers(
      Array.from({ length: particleCount }, (_, index) => ({
        dispersedMediumOptics: {
          dispersedMaterialId: 3,
          dispersedPhaseId: 2,
          opticalStateId: 7,
          dispersedMassKg: 0.01 + index * 0.001,
          scatteringCrossSectionM2: 0.2,
          absorptionCrossSectionM2: 0.03,
          scatteringAsymmetryCrossSectionM2: 0.05
        }
      }))
    ),
    {
      label,
      sourceSphUpload: sphParticleUpload
    }
  );
}

function attachWorkerTestDispersedMediumOptics(
  sphParticleUpload,
  optics,
  { ownsBuffer }
) {
  Object.assign(sphParticleUpload, {
    dispersedMediumOptics: optics,
    dispersedMediumOpticsAuthority: optics.authority,
    dispersedMediumOpticsBuffer: optics.buffer,
    dispersedMediumOpticsRowCount: optics.rowCount,
    dispersedMediumOpticsRowStrideFloats: optics.rowStrideFloats,
    dispersedMediumOpticsBufferByteLength: optics.bufferByteLength,
    ownsDispersedMediumOpticsBuffer: ownsBuffer
  });
  return sphParticleUpload;
}

function workerScheduleFixture({
  laneSuffix = 'a',
  failAtStep = null,
  withHierarchyCleanupClaims = false,
  omitHierarchyFinalConsumerAtStep = null,
  ineligibleHierarchyCleanupAtStep = null,
  withCarriedResidentProductMass = false,
  withSurfaceStressEvidence = false,
  invalidSurfaceStressAtStep = null,
  withTwoLevelEvidence = false,
  invalidTwoLevelCommitAtStep = null,
  invalidTwoLevelCflFactorAtStep = null,
  cflIntervalRejectTraceAtStep = null,
  cflIntervalRejectTrace = null
} = {}) {
  const device = createFakeGpuDevice();
  const buffers = manualBuffers();
  const particleCount = 2;
  const phaseCarrierPlan = {
    schema: 'peercompute.ulg.sph-phase-carrier-plan.v1',
    status: 'phase-companion-capacity-ready',
    primaryCapacity: 1,
    companionStart: 1,
    companionCapacity: 1,
    particleCapacity: 2
  };
  const taggedBuffer = (label, size) => tagWebGpuBufferDevice(
    device.createBuffer({ label, size, usage: 128 | 8 | 4 }),
    device
  );
  const identityRows = Uint32Array.from([101, 202]);
  const taggedIdentityBuffer = (label) => {
    const buffer = taggedBuffer(label, identityRows.byteLength);
    device.queue.writeBuffer(buffer, 0, identityRows);
    return buffer;
  };
  const mechanicsBuffer = taggedBuffer(
    `worker-ss-schedule-${laneSuffix}-mechanics`,
    particleCount * 32 * Float32Array.BYTES_PER_ELEMENT
  );
  let latestMechanicsBuffer = mechanicsBuffer;
  const mechanicsGrid = {
    selectedLevel: 0,
    gridDims: [2, 2, 2],
    gridNodeCount: 8,
    gridShift: 1,
    gridSpacingM: 1
  };
  // Identity words advance per step: the schedule contract requires every
  // step to build a fresh sealed generation against an advanced epoch.
  const levelAssignmentForStep = (stepOrdinal) => ({
    ...workerSchroederLevelAssignmentFixture(device, {
      particleCount,
      storageGeneration: 11 + (stepOrdinal - 1),
      physicsTick: 13 + (stepOrdinal - 1),
      positionEpoch: 17 + (stepOrdinal - 1),
      topologyEpoch: 19,
      sourceStateBuffer: stepOrdinal === 1 ? undefined : null,
      sourceMechanicsBuffer: withTwoLevelEvidence
        ? latestMechanicsBuffer
        : undefined,
      label: `worker-ss-schedule-${laneSuffix}-step${stepOrdinal}`
    }),
    ...(withTwoLevelEvidence ? { minLevel: 0, maxLevel: 1 } : {})
  });
  const stepOneAssignment = levelAssignmentForStep(1);
  const identityBuffer = taggedIdentityBuffer(
    `worker-ss-schedule-${laneSuffix}-identity`
  );
  const thermoBuffer = taggedBuffer(
    `worker-ss-schedule-${laneSuffix}-thermo`,
    particleCount * 12 * Float32Array.BYTES_PER_ELEMENT
  );
  const runnerCalls = [];
  const hierarchyCleanupClaims = [];
  const hierarchyFinalConsumers = [];
  const hierarchyCleanupObservations = [];
  const residentProductMasses = [];
  const residentProductMassDestroyCountByOrdinal = new Map();
  const mechanicsRunner = async (args) => {
    runnerCalls.push(args);
    const ordinal = runnerCalls.length;
    if (failAtStep != null && ordinal === failAtStep) {
      throw new Error(`injected mechanics failure at schedule step ${failAtStep}`);
    }
    const hierarchyCleanupClaim = {
      schema: 'peercompute.ulg.test-hierarchy-cleanup-claim.v0',
      ordinal
    };
    const hierarchyFinalConsumer = {
      schema: 'peercompute.ulg.test-hierarchy-final-consumer.v0',
      ordinal
    };
    hierarchyCleanupClaims.push(hierarchyCleanupClaim);
    hierarchyFinalConsumers.push(hierarchyFinalConsumer);
    const hierarchyCleanupEligible = Boolean(
      withHierarchyCleanupClaims
      && ordinal !== ineligibleHierarchyCleanupAtStep
    );
    const inputResidentProductMass = withCarriedResidentProductMass
      ? args.residentStepOptions?.residentProductMass ?? null
      : null;
    const residentProductMass = withCarriedResidentProductMass
      ? {
          status: 'resident-product-mass-buffer-retained',
          source: `worker-test-product-mass-${ordinal}`,
          productEventBufferRetained: true,
          productEventBufferByteLength: 16,
          productEventRowCount: 1,
          destroyResidentProductMassBuffers() {
            residentProductMassDestroyCountByOrdinal.set(
              ordinal,
              (residentProductMassDestroyCountByOrdinal.get(ordinal) || 0) + 1
            );
            return true;
          }
        }
      : null;
    if (residentProductMass) residentProductMasses.push(residentProductMass);
    const surfaceStressSubmission = withSurfaceStressEvidence
      ? {
          schema:
            'peercompute.ulg.schroeder-phase-volume-surface-stress-submission.v2',
          status:
            'eighteen-pass-central-bond-surface-stress-submitted-unverified',
          requested: true,
          submitted: true,
          dispatchCount: ordinal === invalidSurfaceStressAtStep ? 17 : 18,
          entryPoints: [
            'stage_surface_stress_x_even',
            'stage_surface_stress_x_odd',
            'stage_surface_stress_y_even',
            'stage_surface_stress_y_odd',
            'stage_surface_stress_z_even',
            'stage_surface_stress_z_odd',
            'stage_surface_stress_xy_positive_even',
            'stage_surface_stress_xy_positive_odd',
            'stage_surface_stress_xy_negative_even',
            'stage_surface_stress_xy_negative_odd',
            'stage_surface_stress_xz_positive_even',
            'stage_surface_stress_xz_positive_odd',
            'stage_surface_stress_xz_negative_even',
            'stage_surface_stress_xz_negative_odd',
            'stage_surface_stress_yz_positive_even',
            'stage_surface_stress_yz_positive_odd',
            'stage_surface_stress_yz_negative_even',
            'stage_surface_stress_yz_negative_odd'
          ],
          lifecycleDispatchCount: 21,
          lifecycleMode:
            'standalone-s9ab-initialize-ambient-eighteen-central-bonds-validate-commit',
          ambientBuoyancyMode:
            'field-local-s9ab-current-volume-ambient-source',
          generationId:
            args.spatialEpochGeneration?.execution?.generationId ?? null,
          selectedLevel: args.selectedLevel ?? 0,
          levelRole: 'single',
          twoLevel: false,
          fieldCompletionOrdinal: ordinal,
          materialTableSchema:
            'peercompute.ulg.mls-mpm-mechanics-material-table.v0',
          phaseRecordCount: 1,
          positiveSurfaceTensionPhaseRecordCount: 1,
          surfaceTensionCoefficientStatus:
            'positive-surface-tension-coefficient-ready',
          authority:
            'exact-s9-phase-volume-moment-and-mechanics-material-records',
          verification: 'queue-submitted-no-full-readback'
        }
      : null;
    const nextMechanicsBuffer = taggedBuffer(
      `worker-ss-schedule-${laneSuffix}-next-mechanics-${ordinal}`,
      particleCount * 32 * Float32Array.BYTES_PER_ELEMENT
    );
    latestMechanicsBuffer = nextMechanicsBuffer;
    const stageMechanicsTrace = args.residentStepOptions
      ?.stageMechanicsTraceEnabled === true
      ? Object.freeze({
          schema: 'peercompute.ulg.test-stage-mechanics-trace.v0',
          status: 'test-stage-mechanics-trace-ready',
          ordinal
        })
      : null;
    const canonicalSpatialAuthorityTrace = args.residentStepOptions
      ?.stageMechanicsTraceEnabled === true
      || args.residentStepOptions
        ?.observeCanonicalSpatialAuthority === true
      ? Object.freeze({
          schema: 'peercompute.ulg.test-canonical-authority-trace.v0',
          status: 'test-canonical-authority-trace-admitted',
          ordinal
        })
      : null;
    const terminalRefluxReceiptCopy = withTwoLevelEvidence
      ? writeWorkerTerminalRefluxReceiptTarget(
          args.residentStepOptions?.[
            SCHROEDER_FUSED_TERMINAL_REFLUX_RECEIPT_TARGET_OPTION
          ],
          {
            rolledBack: ordinal === invalidTwoLevelCommitAtStep
              || ordinal === cflIntervalRejectTraceAtStep,
            ownerGeneration: 1000 + ordinal,
            cflIntervalRejectTrace:
              ordinal === cflIntervalRejectTraceAtStep
                ? cflIntervalRejectTrace
                : null
          }
        )
      : null;
    return {
      status: 'schroeder-same-level-mechanics-completed',
      selectedLevel: 0,
      ...(withTwoLevelEvidence
        ? {
            twoLevelMechanics: {
              cflFactor: ordinal === invalidTwoLevelCflFactorAtStep
                ? 0.6
                : args.cflFactor
            }
          }
        : {}),
      ...(withHierarchyCleanupClaims
        ? {
            canonicalSingleLevelQueueOrderedCleanupEligible:
              hierarchyCleanupEligible,
            ...(ordinal === omitHierarchyFinalConsumerAtStep
              ? {}
              : {
                  queueOrderedFinalConsumerCapability:
                    hierarchyFinalConsumer
                })
          }
        : {}),
      residentStep: {
        backend: 'webgpu',
        status: withTwoLevelEvidence
          ? 'schroeder-two-level-authoritative-step-executed'
          : 'resident-step-completed',
        readbackMode: 'no-full-readback',
        stageStatus: { p2g: 'completed', g2p: 'completed' },
        stageBackends: { p2g: 'webgpu', g2p: 'webgpu' },
        stageMechanicsTrace,
        canonicalSpatialAuthorityTrace,
        stageTiming: {
          schema: 'peercompute.ulg.test-resident-stage-timing.v0',
          totalMs: ordinal + 0.5,
          stageMs: { p2g: ordinal + 0.25, compactSummary: 0 },
          compactSummaryRequested: false,
          queueFenceMs: { compactSummaryMapAsync: null },
          queueFenceStatus: { fusedMechanicsSequence: null },
          queueFenceMethod: { fusedMechanicsSequence: null }
        },
        ...(withSurfaceStressEvidence
          ? {
              phaseVolumeSurfaceStressSubmission: surfaceStressSubmission
            }
          : {}),
        ...(withTwoLevelEvidence
          ? {
              twoLevelMechanicsAuthority: 'authoritative',
              twoLevelMechanicsStatus:
                'schroeder-two-level-mechanics-completed',
              twoLevelFineSubstepCount: 2,
              twoLevelAuthoritativeCommitVerified: true,
              twoLevelTerminalRefluxReceiptCopy:
                terminalRefluxReceiptCopy
            }
          : {}),
        ...(withHierarchyCleanupClaims
          ? {
              canonicalSingleLevelQueueOrderedCleanupEligible:
                hierarchyCleanupEligible,
              schroederHierarchyArtifactTransferCleanupClaims: [
                hierarchyCleanupClaim
              ],
              localRetainedRenderBuffers: {
                buffers: [],
                destroyRetainedBuffers({
                  queueOrderedFinalConsumer = null
                } = {}) {
                  hierarchyCleanupObservations.push({
                    ordinal,
                    queueOrderedFinalConsumer
                  });
                  if (queueOrderedFinalConsumer == null) {
                    device.queue.onSubmittedWorkDone();
                  }
                  return true;
                }
              }
            }
          : {}),
        ...(inputResidentProductMass
          ? { inputResidentProductMass }
          : {}),
        ...(residentProductMass ? { residentProductMass } : {}),
        nextParticleUploads: {
          sphParticleUpload: {
            particleCount,
            step: ordinal,
            time: ordinal * 0.001,
            slot: ordinal % 2,
            sourceSlot: (ordinal + 1) % 2,
            nextSlot: ordinal % 2,
            topologyEpoch: 19,
            identityRevision: 'worker-schedule-fixture-identity',
            identityRequired: true,
            identitySchema: ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
            identityStrideBytes:
              SPH_GPU_PARTICLE_IDENTITY_UINTS * Uint32Array.BYTES_PER_ELEMENT,
            identityBufferByteLength: identityRows.byteLength,
            renderDomainKeys: {
              101: 'worker-schedule-body-one',
              202: 'worker-schedule-body-two'
            },
            phaseCarrierPlan,
            stateBuffer: taggedBuffer(
              `worker-ss-schedule-${laneSuffix}-next-state-${ordinal}`,
              particleCount * 8 * Float32Array.BYTES_PER_ELEMENT
            ),
            thermoBuffer: taggedBuffer(
              `worker-ss-schedule-${laneSuffix}-next-thermo-${ordinal}`,
              particleCount * 12 * Float32Array.BYTES_PER_ELEMENT
            ),
            identityBuffer: taggedIdentityBuffer(
              `worker-ss-schedule-${laneSuffix}-next-identity-${ordinal}`
            )
          },
          mlsMpmParticleUpload: {
            particleCount,
            step: ordinal,
            time: ordinal * 0.001,
            slot: ordinal % 2,
            sourceSlot: (ordinal + 1) % 2,
            nextSlot: ordinal % 2,
            phaseCarrierPlan,
            mechanicsBuffer: nextMechanicsBuffer
          },
          ...(residentProductMass ? { residentProductMass } : {})
        }
      },
      schroederSpatialEpochReleasePromise: Promise.resolve(true),
      currentSchroederSpatialEpochGenerationSummary: () => ({
        status: 'synthetic-generation-summary'
      })
    };
  };
  const stageOptions = {
    schroederSpatialEpoch: {
      levelAssignment: stepOneAssignment,
      particleIdentityBuffer: identityBuffer,
      particleIdentityStrideWords: 1,
      selectedLevel: 0,
      mechanicsGrid,
      exactNearCellTreeEnabled: false,
      sphParticleUpload: {
        particleCount,
        phaseCarrierPlan,
        stateBuffer: stepOneAssignment.sourceStateBuffer,
        thermoBuffer,
        identityBuffer,
        identityRequired: true,
        identitySchema: ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
        identityStrideBytes:
          SPH_GPU_PARTICLE_IDENTITY_UINTS * Uint32Array.BYTES_PER_ELEMENT,
        identityBufferByteLength: identityRows.byteLength,
        identityRevision: 'worker-schedule-fixture-identity',
        renderDomainKeys: {
          101: 'worker-schedule-body-one',
          202: 'worker-schedule-body-two'
        }
      },
      mlsMpmParticleUpload: {
        particleCount,
        phaseCarrierPlan,
        mechanicsBuffer
      },
      // Continuation steps get an advanced assignment; the fake mechanics
      // runner never commits a successor source family, so this is the
      // synthetic stand-in for the kernel-committed continuation.
      scheduleStepOptionsProvider: ({ stepOrdinal }) => ({
        levelAssignment: levelAssignmentForStep(runnerCalls.length + 1),
        particleIdentityStrideWords: 1
      })
    },
    schroederSameLevelMechanics: {
      schroederSameLevelMechanicsRunner: mechanicsRunner
    }
  };
  return {
    device,
    buffers,
    particleCount,
    mechanicsGrid,
    stageOptions,
    runnerCalls,
    hierarchyCleanupClaims,
    hierarchyFinalConsumers,
    hierarchyCleanupObservations,
    residentProductMasses,
    residentProductMassDestroyCountByOrdinal,
    phaseCarrierPlan,
    identityRows,
    levelAssignmentForStep,
    taggedBuffer
  };
}

function schedulePayload(context, schedule, {
  laneId = 'ulg:test:schroeder-schedule-lane',
  stateKey = 'ulg:test:schroeder-schedule-state'
} = {}) {
  return {
    schedule,
    lease: {
      laneId,
      stateKey,
      queueFencePolicy: 'queue.onSubmittedWorkDone-before-admission'
    },
    context: {
      ulgMechanicsResidentStageWorker: context
    }
  };
}

test('canonical retained particle state exposes the exact private worker lane family without changing cloneable receipts', async () => {
  const fixture = workerScheduleFixture({
    laneSuffix: 'private-retained-particle-family',
    withCarriedResidentProductMass: true
  });
  const laneOptions = {
    laneId: 'ulg:test:private-retained-particle-family-lane',
    stateKey: 'ulg:test:private-retained-particle-family-state'
  };
  const successorSourceFamily = Object.freeze({
    schema: 'peercompute.ulg.test-successor-source-family.v0',
    status: 'test-successor-source-family-retained',
    sourceGenerationId: 77
  });
  const sourceSphUpload =
    fixture.stageOptions.schroederSpatialEpoch.sphParticleUpload;
  const sourceMlsUpload =
    fixture.stageOptions.schroederSpatialEpoch.mlsMpmParticleUpload;
  Object.assign(sourceSphUpload, {
    storageGeneration: 11,
    bufferFamilyGeneration: 11,
    topologyEpoch: 19
  });
  Object.assign(sourceMlsUpload, {
    storageGeneration: 11,
    bufferFamilyGeneration: 11,
    topologyEpoch: 19
  });
  const dispersedMediumOptics = uploadWorkerTestDispersedMediumOptics(
    fixture.device,
    sourceSphUpload,
    'private-retained-particle-family-dispersed-medium'
  );
  const mechanicsRunner = fixture.stageOptions.schroederSameLevelMechanics
    .schroederSameLevelMechanicsRunner;
  fixture.stageOptions.schroederSameLevelMechanics
    .schroederSameLevelMechanicsRunner = async (args) => {
      const execution = await mechanicsRunner(args);
      const nextSphUpload =
        execution.residentStep.nextParticleUploads.sphParticleUpload;
      const supersededIdentityBuffer = nextSphUpload.identityBuffer;
      Object.assign(nextSphUpload, {
        storageGeneration: 12,
        bufferFamilyGeneration: 12,
        topologyEpoch: 19,
        identityBuffer: args.sphParticleUpload.identityBuffer
      });
      attachWorkerTestDispersedMediumOptics(
        nextSphUpload,
        args.sphParticleUpload.dispersedMediumOptics,
        { ownsBuffer: false }
      );
      transferTopologyStableSphDispersedMediumOpticsOwnership({
        sourceSphUpload: args.sphParticleUpload,
        targetSphUpload: nextSphUpload
      });
      supersededIdentityBuffer.destroy();
      execution.residentStep.schroederSpatialSuccessorSourceFamily =
        successorSourceFamily;
      return execution;
    };

  try {
    const result = await runUlgMechanicsResidentStageWorkerSchedulePayload(
      schedulePayload(
        workerSchroederStageContext(
          fixture.device,
          fixture.buffers,
          fixture.stageOptions
        ),
        {
          stepCount: 1,
          scheduleId: 'ulg:test:private-retained-particle-family-schedule'
        },
        laneOptions
      )
    );
    const retained =
      resolveUlgMechanicsResidentStageWorkerRetainedParticleState({
        ...laneOptions,
        sourceStageId: 'schroederSameLevelMechanics'
      });

    assert.equal(retained.status, 'worker-retained-particle-state-ready');
    assert.equal(retained.retainedWithinWorker, true);
    assert.equal(retained.sameWorkerPrivateReferences, true);
    assert.equal(retained.postMessageTransportAllowed, false);
    assert.strictEqual(
      retained.sphParticleUpload.stateBuffer,
      retained.sourceStateBuffer
    );
    assert.strictEqual(
      retained.sphParticleUpload.thermoBuffer,
      retained.sourceThermoBuffer
    );
    assert.strictEqual(
      retained.mlsMpmParticleUpload.mechanicsBuffer,
      retained.sourceMechanicsBuffer
    );
    assert.strictEqual(
      retained.advancedStateMetadata.sphParticleState,
      retained.sphParticleState
    );
    assert.strictEqual(
      retained.advancedStateMetadata.mlsMpmParticleState,
      retained.mlsMpmParticleState
    );
    assert.equal(retained.sphParticleState.step, 1);
    assert.equal(retained.mlsMpmParticleState.step, 1);
    assert.strictEqual(retained.successorSourceFamily, successorSourceFamily);
    assert.strictEqual(
      retained.residentProductMass,
      fixture.residentProductMasses[0]
    );
    assert.strictEqual(
      retained.dispersedMediumOptics,
      retained.sphParticleUpload.dispersedMediumOptics
    );
    assert.strictEqual(retained.dispersedMediumOptics, dispersedMediumOptics);
    assert.strictEqual(
      retained.sphParticleUpload.dispersedMediumOpticsBuffer,
      dispersedMediumOptics.buffer
    );
    assert.equal(
      retained.sphParticleUpload.ownsDispersedMediumOpticsBuffer,
      true
    );
    assert.equal(sourceSphUpload.ownsDispersedMediumOpticsBuffer, false);
    assert.equal(
      validateSphDispersedMediumGpuBufferAuthority(
        fixture.device,
        retained.dispersedMediumOptics.authority,
        {
          buffer: retained.dispersedMediumOptics.buffer,
          particleCount: retained.particleCount,
          rowCount: retained.dispersedMediumOptics.rowCount,
          rowStrideFloats: retained.dispersedMediumOptics.rowStrideFloats
        }
      ),
      true
    );
    const sidecarFields = [
      'dispersedMediumOptics',
      'dispersedMediumOpticsAuthority',
      'dispersedMediumOpticsBuffer',
      'dispersedMediumOpticsRowCount',
      'dispersedMediumOpticsRowStrideFloats',
      'dispersedMediumOpticsBufferByteLength',
      'ownsDispersedMediumOpticsBuffer'
    ];
    const exactSidecarDescriptor = Object.fromEntries(
      sidecarFields.map((field) => [field, retained.sphParticleUpload[field]])
    );
    Object.assign(retained.sphParticleUpload, {
      dispersedMediumOptics: null,
      dispersedMediumOpticsAuthority: null,
      dispersedMediumOpticsBuffer: null,
      dispersedMediumOpticsRowCount: 0,
      dispersedMediumOpticsRowStrideFloats: 0,
      dispersedMediumOpticsBufferByteLength: 0,
      ownsDispersedMediumOpticsBuffer: false
    });
    for (const field of [
      'dispersedMediumOpticsRowCount',
      'dispersedMediumOpticsRowStrideFloats',
      'dispersedMediumOpticsBufferByteLength'
    ]) {
      for (const malformedValue of ['0', false, '', Number.NaN, 1]) {
        retained.sphParticleUpload[field] = malformedValue;
        const rejected =
          resolveUlgMechanicsResidentStageWorkerRetainedParticleState({
            ...laneOptions,
            sourceStageId: 'schroederSameLevelMechanics'
          });
        assert.equal(
          rejected.status,
          'worker-retained-particle-state-dispersed-medium-remap-required',
          `worker must advertise ${field}=${String(malformedValue)}`
        );
        retained.sphParticleUpload[field] = 0;
      }
    }
    Object.assign(retained.sphParticleUpload, exactSidecarDescriptor);
    assert.equal(
      resolveUlgMechanicsResidentStageWorkerRetainedParticleState({
        ...laneOptions,
        sourceStageId: 'schroederSameLevelMechanics'
      }).status,
      'worker-retained-particle-state-ready'
    );

    // The schedule's public transport remains clone-safe and never carries
    // any of the raw worker-local aliases returned by the direct resolver.
    assert.equal('sphParticleUpload' in result, false);
    assert.equal('mlsMpmParticleUpload' in result, false);
    assert.equal('successorSourceFamily' in result, false);
    assert.equal('residentProductMass' in result, false);
    assert.equal('advancedStateMetadata' in result, false);
    assert.equal('dispersedMediumOptics' in result, false);
    assertNoWorkerGpuBuffers(result, 'privateRetainedParticleFamilyResult');
    structuredClone(result);
  } finally {
    releaseUlgMechanicsResidentStageWorkerLane(laneOptions);
  }

  const released =
    resolveUlgMechanicsResidentStageWorkerRetainedParticleState({
      ...laneOptions,
      sourceStageId: 'schroederSameLevelMechanics'
    });
  assert.equal(released.status, 'worker-retained-particle-state-missing-lane');
  assert.equal(released.sameWorkerPrivateReferences, false);
  assert.equal('sphParticleUpload' in released, false);
  assert.equal('advancedStateMetadata' in released, false);
  assert.equal(dispersedMediumOptics.buffer.destroyed, true);
  assert.equal(dispersedMediumOptics.destroyed, true);
  assert.equal(
    validateSphDispersedMediumGpuBufferAuthority(
      fixture.device,
      dispersedMediumOptics.authority
    ),
    false
  );
});

test('worker lane retirement defers the exact retained dispersed-medium family until its parent borrow drains', async () => {
  const fixture = workerScheduleFixture({
    laneSuffix: 'borrowed-dispersed-medium-retirement'
  });
  const laneOptions = {
    laneId: 'ulg:test:borrowed-dispersed-medium-retirement-lane',
    stateKey: 'ulg:test:borrowed-dispersed-medium-retirement-state'
  };
  const sourceSphUpload =
    fixture.stageOptions.schroederSpatialEpoch.sphParticleUpload;
  const sourceMlsUpload =
    fixture.stageOptions.schroederSpatialEpoch.mlsMpmParticleUpload;
  Object.assign(sourceSphUpload, {
    storageGeneration: 11,
    bufferFamilyGeneration: 11,
    topologyEpoch: 19
  });
  Object.assign(sourceMlsUpload, {
    storageGeneration: 11,
    bufferFamilyGeneration: 11,
    topologyEpoch: 19
  });
  const dispersedMediumOptics = uploadWorkerTestDispersedMediumOptics(
    fixture.device,
    sourceSphUpload,
    'borrowed-dispersed-medium-retirement'
  );
  const mechanicsRunner = fixture.stageOptions.schroederSameLevelMechanics
    .schroederSameLevelMechanicsRunner;
  fixture.stageOptions.schroederSameLevelMechanics
    .schroederSameLevelMechanicsRunner = async (args) => {
      const execution = await mechanicsRunner(args);
      const nextSphUpload =
        execution.residentStep.nextParticleUploads.sphParticleUpload;
      const supersededIdentityBuffer = nextSphUpload.identityBuffer;
      Object.assign(nextSphUpload, {
        storageGeneration: 12,
        bufferFamilyGeneration: 12,
        topologyEpoch: 19,
        identityBuffer: args.sphParticleUpload.identityBuffer
      });
      attachWorkerTestDispersedMediumOptics(
        nextSphUpload,
        args.sphParticleUpload.dispersedMediumOptics,
        { ownsBuffer: false }
      );
      transferTopologyStableSphDispersedMediumOpticsOwnership({
        sourceSphUpload: args.sphParticleUpload,
        targetSphUpload: nextSphUpload
      });
      supersededIdentityBuffer.destroy();
      return execution;
    };

  let borrowedUpload = null;
  let borrowedStateBuffer = null;
  try {
    await runUlgMechanicsResidentStageWorkerSchedulePayload(
      schedulePayload(
        workerSchroederStageContext(
          fixture.device,
          fixture.buffers,
          fixture.stageOptions
        ),
        {
          stepCount: 1,
          scheduleId:
            'ulg:test:borrowed-dispersed-medium-retirement-schedule'
        },
        laneOptions
      )
    );
    const retained =
      resolveUlgMechanicsResidentStageWorkerRetainedParticleState({
        ...laneOptions,
        sourceStageId: 'schroederSameLevelMechanics'
      });
    assert.equal(retained.status, 'worker-retained-particle-state-ready');
    borrowedUpload = retained.sphParticleUpload;
    borrowedStateBuffer = borrowedUpload.stateBuffer;
    assert.strictEqual(
      borrowedUpload.dispersedMediumOptics,
      dispersedMediumOptics
    );
    assert.equal(borrowedUpload.__ulgActiveBorrowCount, 0);

    borrowedUpload.__ulgActiveBorrowCount += 1;
    const release = releaseUlgMechanicsResidentStageWorkerLane(laneOptions);
    assert.equal(release.status, 'worker-resident-lane-released');
    assert.equal(dispersedMediumOptics.buffer.destroyed, false);
    assert.equal(dispersedMediumOptics.buffer.destroyCount, 0);
    assert.notEqual(dispersedMediumOptics.destroyed, true);
    assert.equal(borrowedStateBuffer.destroyed, false);
    assert.equal(
      validateSphDispersedMediumGpuBufferAuthority(
        fixture.device,
        dispersedMediumOptics.authority,
        {
          buffer: dispersedMediumOptics.buffer,
          particleCount: fixture.particleCount,
          rowCount: dispersedMediumOptics.rowCount,
          rowStrideFloats: dispersedMediumOptics.rowStrideFloats
        }
      ),
      true
    );

    borrowedUpload.__ulgActiveBorrowCount -= 1;
    assert.equal(dispersedMediumOptics.buffer.destroyed, true);
    assert.equal(dispersedMediumOptics.buffer.destroyCount, 1);
    assert.equal(dispersedMediumOptics.destroyed, true);
    assert.equal(borrowedStateBuffer.destroyed, true);
    assert.equal(
      validateSphDispersedMediumGpuBufferAuthority(
        fixture.device,
        dispersedMediumOptics.authority
      ),
      false
    );
  } finally {
    if (borrowedUpload?.__ulgActiveBorrowCount > 0) {
      borrowedUpload.__ulgActiveBorrowCount = 0;
    }
    releaseUlgMechanicsResidentStageWorkerLane(laneOptions);
  }
});

test('worker schedule executes the exact enabled and disabled hierarchy policy', async () => {
  const executableFields = [
    'enablePortableSummary',
    'enableActiveNodeIndex',
    'enableActiveNodeSortedIndex',
    'enableLawQueue',
    'enableLawNeighborCandidates',
    'enableCrossLevelCoupling',
    'enablePhaseVolumeMigration'
  ];

  for (const enabled of [true, false]) {
    const suffix = enabled ? 'policy-enabled' : 'policy-disabled';
    const fixture = workerScheduleFixture({ laneSuffix: suffix });
    fixture.buffers.gridSpacingM = 0.25;
    const laneOptions = {
      laneId: `ulg:test:${suffix}-lane`,
      stateKey: `ulg:test:${suffix}-state`
    };
    const hierarchyConfig = createSchroederWorkerHierarchyConfig({
      selectedLevel: 0,
      minLevel: 0,
      maxLevel: 0,
      enableTwoLevelMechanics: false,
      enableMechanicsFieldPairV2: false,
      enablePortableSummary: enabled,
      enableActiveNodeIndex: enabled,
      enableActiveNodeSortedIndex: enabled,
      activeNodeSortedIndexPolicyMode: enabled ? 'canonical-radix' : null,
      lawNeighborTraversalPolicyMode: enabled ? 'exact-near-cell-tree' : null,
      lawNeighborCandidateReadbackMode: enabled ? 'compact-terminal' : null,
      enableLawQueue: enabled,
      enableLawNeighborCandidates: enabled,
      enableCrossLevelCoupling: enabled,
      enablePhaseVolumeMigration: enabled
    });
    Object.assign(fixture.stageOptions.schroederSameLevelMechanics, {
      hierarchyConfig,
      ...Object.fromEntries(
        executableFields.map((field) => [field, hierarchyConfig[field]])
      ),
      activeNodeSortedIndexPolicyMode:
        hierarchyConfig.activeNodeSortedIndexPolicyMode,
      lawNeighborTraversalPolicyMode:
        hierarchyConfig.lawNeighborTraversalPolicyMode,
      lawNeighborCandidateReadbackMode:
        hierarchyConfig.lawNeighborCandidateReadbackMode
    });
    fixture.stageOptions.schroederSpatialEpoch.scheduleStepOptionsProvider = null;
    fixture.stageOptions.schroederSameLevelMechanics.residentStepOptions = {};

    try {
      const result = await runUlgMechanicsResidentStageWorkerSchedulePayload(
        schedulePayload(
          workerSchroederStageContext(
            fixture.device,
            fixture.buffers,
            fixture.stageOptions
          ),
          { stepCount: 1, scheduleId: `ulg:test:${suffix}-schedule` },
          laneOptions
        )
      );
      assert.equal(result.status, 'worker-resident-schedule-completed');
      assert.equal(fixture.runnerCalls.length, 1);
      for (const field of executableFields) {
        assert.equal(
          fixture.runnerCalls[0][field],
          enabled,
          `${field} must reach the hierarchy runner as ${enabled}`
        );
      }
      assert.equal(result.nextScheduleLawActivationObservation, null);
      assert.equal(
        fixture.runnerCalls[0].activeNodeSortedIndexPolicyMode ?? null,
        hierarchyConfig.activeNodeSortedIndexPolicyMode
      );
      assert.equal(
        fixture.runnerCalls[0].lawNeighborTraversalPolicyMode ?? null,
        hierarchyConfig.lawNeighborTraversalPolicyMode
      );
      assert.equal(
        fixture.runnerCalls[0].lawNeighborCandidateReadbackMode ?? null,
        hierarchyConfig.lawNeighborCandidateReadbackMode
      );
      assert.deepEqual(
        result.perStepSummaries.lastStep.hierarchyStageSummary.hierarchyConfig,
        {
          schema: hierarchyConfig.schema,
          status: hierarchyConfig.status,
          signature: hierarchyConfig.signature,
          selectedLevel: 0,
          minLevel: 0,
          maxLevel: 0,
          enableTwoLevelMechanics: false,
          twoLevelMechanicsAuthority: 'observation',
          twoLevelFineSubstepCount: 1,
          enableMechanicsFieldPairV2: false,
          enablePortableSummary: enabled,
          enableActiveNodeIndex: enabled,
          enableActiveNodeSortedIndex: enabled,
          enableLawQueue: enabled,
          enableLawNeighborCandidates: enabled,
          enableCrossLevelCoupling: enabled,
          enablePhaseVolumeMigration: enabled
        }
      );
      structuredClone(result);
    } finally {
      releaseUlgMechanicsResidentStageWorkerLane(laneOptions);
    }
  }
});

test('schedule provider overrides cannot clear sidecars or mechanics views required by the derived law activation', async () => {
  const fixture = workerScheduleFixture({
    laneSuffix: 'provider-required-view-seal'
  });
  fixture.stageOptions.schroederSameLevelMechanics
    .enablePhaseVolumeMigration = true;
  const baseProvider = fixture.stageOptions.schroederSpatialEpoch
    .scheduleStepOptionsProvider;
  let providerCallCount = 0;
  fixture.stageOptions.schroederSpatialEpoch.scheduleStepOptionsProvider =
    async (args) => {
      providerCallCount += 1;
      return {
        ...(await baseProvider(args)),
        enablePhaseVolumeMigration: false,
        phaseVolumeSidecarsRequired: false,
        mechanicsFieldViewsRequired: false
      };
    };
  const laneOptions = {
    laneId: 'ulg:test:provider-required-view-seal-lane',
    stateKey: 'ulg:test:provider-required-view-seal-state'
  };
  try {
    const result = await runUlgMechanicsResidentStageWorkerSchedulePayload(
      schedulePayload(
        workerSchroederStageContext(
          fixture.device,
          fixture.buffers,
          fixture.stageOptions
        ),
        {
          stepCount: 2,
          scheduleId: 'ulg:test:provider-required-view-seal'
        },
        laneOptions
      )
    );
    assert.equal(result.status, 'worker-resident-schedule-completed');
    assert.equal(providerCallCount, 1);
    assert.equal(result.lawActivationReceipt.phaseVolumeMigration, true);
    assert.equal(result.lawActivationReceipt.phaseVolumeSidecars, true);
    assert.equal(result.lawActivationReceipt.mechanicsFieldViews, true);
    assert.equal(fixture.runnerCalls.length, 2);
    for (const runnerOptions of fixture.runnerCalls) {
      assert.equal(runnerOptions.enablePhaseVolumeMigration, true);
      assert.equal(
        runnerOptions.spatialEpochGeneration.phaseVolumeSidecarsEnabled,
        true
      );
      assert.ok(runnerOptions.spatialEpochGeneration.mechanicsFieldView);
    }
  } finally {
    releaseUlgMechanicsResidentStageWorkerLane(laneOptions);
  }
});

test('ULG resident stage worker runs a batched resident schedule with a fresh sealed epoch per step', async (t) => {
  const messageChannelStats = instrumentResidentScheduleMessageChannels(t);
  const fixture = workerScheduleFixture({ laneSuffix: 'batch' });
  fixture.stageOptions.schroederSameLevelMechanics.residentStepOptions = {
    mechanicsMaterialTable: {
      schema: 'peercompute.ulg.mls-mpm-mechanics-material-table.v0',
      phaseRecordCount: 1,
      records: new Float32Array([1, 2, 3, 4])
    }
  };
  fixture.stageOptions.schroederSameLevelMechanics
    .stageMechanicsTraceEnabled = true;
  const laneOptions = {
    laneId: 'ulg:test:schroeder-schedule-batch-lane',
    stateKey: 'ulg:test:schroeder-schedule-batch-state'
  };
  const progressEnvelopes = [];
  const result = await runUlgMechanicsResidentStageWorkerSchedulePayload(
    schedulePayload(
      workerSchroederStageContext(fixture.device, fixture.buffers, fixture.stageOptions),
      { stepCount: 3, scheduleId: 'ulg:test:schedule-batch' },
      laneOptions
    ),
    { postProgress: (progress) => progressEnvelopes.push(progress) }
  );
  assert.equal(result.schema, ULG_WORKER_RESIDENT_SCHEDULE_RESULT_SCHEMA);
  assert.equal(result.status, 'worker-resident-schedule-completed');
  assert.equal(result.scheduleId, 'ulg:test:schedule-batch');
  assert.equal(result.cancelled, false);
  assert.equal(result.requestedStepCount, 3);
  assert.equal(result.completedStepCount, 3);
  assert.equal(result.submitBurstObservation.opened, false);
  assert.equal(result.submitBurstObservation.stats, null);
  const cumulativeSubmitStats =
    result.submitBurstObservation.cumulativeStats;
  assert.ok(cumulativeSubmitStats);
  assert.equal(cumulativeSubmitStats.open, false);
  assert.ok(Number.isInteger(cumulativeSubmitStats.directSubmitTotal));
  assert.ok(Number.isInteger(cumulativeSubmitStats.flushCount));
  assert.equal(
    cumulativeSubmitStats.directSubmitTotal
      + cumulativeSubmitStats.flushCount,
    fixture.device.queue.submitCalls.length,
    'passive wrapper counters must equal the fake queue native-submit census'
  );
  assert.equal(
    result.controlPlaneYieldReceipt.schema,
    ULG_WORKER_RESIDENT_SCHEDULE_CONTROL_PLANE_YIELD_RECEIPT_SCHEMA
  );
  assert.equal(result.controlPlaneYieldReceipt.mode, 'message-channel');
  assert.equal(
    result.controlPlaneYieldReceipt.mechanism,
    'message-channel-task'
  );
  assert.equal(
    result.controlPlaneYieldReceipt.scheduledYieldOpportunityCount,
    2
  );
  assert.equal(result.controlPlaneYieldReceipt.yieldRequestCount, 2);
  assert.equal(result.controlPlaneYieldReceipt.completedYieldCount, 2);
  assert.equal(result.controlPlaneYieldReceipt.messageChannelCreated, true);
  assert.equal(result.controlPlaneYieldReceipt.messageChannelYieldCount, 2);
  assert.equal(result.controlPlaneYieldReceipt.timerFallbackYieldCount, 0);
  assert.equal(result.controlPlaneYieldReceipt.ownedPortCount, 2);
  assert.equal(result.controlPlaneYieldReceipt.closedPortCount, 2);
  assert.equal(result.controlPlaneYieldReceipt.portsClosed, true);
  assert.equal(messageChannelStats.constructionCount, 1);
  assert.equal(messageChannelStats.port1CloseCount, 1);
  assert.equal(messageChannelStats.port2CloseCount, 1);
  assert.equal(result.controlPlaneYieldReceipt.firstBeforeStepOrdinal, 2);
  assert.equal(result.controlPlaneYieldReceipt.lastBeforeStepOrdinal, 3);
  assert.equal(
    result.controlPlaneYieldReceipt.cancellationObservedAfterYield,
    false
  );
  assert.equal(
    result.queueDrainIntervalSteps,
    ULG_WORKER_RESIDENT_SCHEDULE_QUEUE_DRAIN_INTERVAL_STEPS
  );
  assert.equal(result.queueDrainCheckpointCount, 0);
  assert.deepEqual(result.queueDrainCheckpoints, []);
  assert.equal(fixture.runnerCalls.length, 3);
  const mechanicsStaticUploads = fixture.device.queue.writeBufferCalls.filter(
    (call) => call.buffer?.label
      === 'ulg-mls-mpm-mechanics-material-phase-records'
  );
  assert.equal(
    mechanicsStaticUploads.length,
    1,
    'the worker lane must upload an immutable mechanics phase table only once'
  );
  const retainedMechanicsUpload =
    fixture.runnerCalls[0].residentStepOptions.mechanicsRefreshOptions
      .mechanicsMaterialPhaseUpload;
  assert.ok(retainedMechanicsUpload?.recordsBuffer);
  fixture.runnerCalls.forEach((call, index) => {
    assert.equal(
      call.enableCanonicalSingleLevelQueueOrderedCleanup,
      true,
      'the private schedule must authenticate queue-ordered single-level cleanup'
    );
    assert.equal(
      call.residentStepOptions.summaryRunner,
      null,
      'the private no-readback schedule must suppress the default compact summary map'
    );
    assert.equal(
      call.residentStepOptions.stageMechanicsTraceEnabled,
      index === fixture.runnerCalls.length - 1,
      'schedule-scoped mechanics tracing must run only for the published terminal step'
    );
    assert.equal(
      call.residentStepOptions.mechanicsRefreshOptions
        .mechanicsMaterialPhaseUpload,
      retainedMechanicsUpload,
      'every step must reuse the same lane-local mechanics table upload'
    );
  });

  // One progress envelope per step (progressEverySteps defaults to 1), with
  // monotonically advancing epoch identity words and no GPU buffers.
  assert.equal(progressEnvelopes.length, 3);
  progressEnvelopes.forEach((progress, index) => {
    assert.equal(progress.schema, ULG_WORKER_RESIDENT_SCHEDULE_PROGRESS_SCHEMA);
    assert.equal(progress.scheduleId, 'ulg:test:schedule-batch');
    assert.equal(progress.stepOrdinal, index + 1);
    assert.equal(progress.completedStepCount, index + 1);
    assert.equal(progress.epochIdentity.positionEpoch, 17 + index);
    assert.equal(progress.epochIdentity.physicsTick, 13 + index);
    assert.equal(progress.epochIdentity.storageGeneration, 11 + index);
    if (index > 0) {
      assert.ok(
        progress.epochIdentity.positionEpoch
          > progressEnvelopes[index - 1].epochIdentity.positionEpoch
      );
      assert.ok(
        progress.epochIdentity.physicsTick
          > progressEnvelopes[index - 1].epochIdentity.physicsTick
      );
    }
    assert.equal(
      progress.stepSummary.schema,
      ULG_WORKER_RESIDENT_SCHEDULE_STEP_SUMMARY_SCHEMA
    );
    assert.equal(progress.stepSummary.stepOrdinal, index + 1);
    assert.equal(progress.stepSummary.epochConsumed, true);
    assert.equal(
      progress.stepSummary.epochReleaseMode,
      'queue-ordered-after-final-consumer-no-host-fence'
    );
    assert.equal(progress.stepSummary.gpuFenceSatisfied, false);
    assert.equal(
      progress.stepSummary.gpuFenceStatus,
      'gpu-fence-deferred-to-resident-schedule-terminal'
    );
    assert.equal(progress.stepSummary.sameWorkerQueueOrdered, true);
    assert.equal(progress.stepSummary.terminalScheduleFenceSatisfied, false);
    assert.equal(progress.stepSummary.authorityAdmissionReady, false);
    assert.equal(
      progress.stepSummary.hierarchyStageSummary
        .residentStageTiming.compactSummaryRequested,
      false
    );
    assert.equal(
      progress.stepSummary.hierarchyStageSummary
        .residentStageTiming.stageMs.compactSummary,
      0
    );
    assert.ok(Number.isFinite(progress.stepSummary.epochStageElapsedMs));
    assert.ok(Number.isFinite(progress.stepSummary.mechanicsStageElapsedMs));
    assert.ok(
      progress.stepSummary.stepElapsedMs
        >= progress.stepSummary.epochStageElapsedMs
          + progress.stepSummary.mechanicsStageElapsedMs
    );
    for (const ref of progress.stepSummary.retainedBufferRefs) {
      assert.match(ref, /^ulg-worker:/);
    }
    assertNoWorkerGpuBuffers(progress, `progress[${index}]`);
    structuredClone(progress);
  });

  // Every step consumed its own fresh sealed generation.
  assert.equal(result.perStepSummaries.ring.length, 3);
  assert.equal(result.perStepSummaries.droppedStepCount, 0);
  assert.equal(result.perStepSummaries.totalStepCount, 3);
  const generationIds = result.perStepSummaries.ring.map((entry) => entry.generationId);
  assert.equal(new Set(generationIds).size, 3);
  result.perStepSummaries.ring.forEach((entry, index) => {
    assert.equal(entry.stepOrdinal, index + 1);
    assert.equal(entry.positionEpoch, 17 + index);
    assert.equal(entry.physicsTick, 13 + index);
    assert.equal(entry.mechanicsStatus, 'worker-schroeder-same-level-mechanics-completed');
  });
  assert.equal(result.perStepSummaries.lastStep.stepOrdinal, 3);
  assert.equal(
    result.perStepSummaries.lastStep.hierarchyStageSummary
      .stageMechanicsTraceRequested,
    true
  );
  assert.deepEqual(
    result.perStepSummaries.lastStep.hierarchyStageSummary
      .stageMechanicsTrace,
    {
      schema: 'peercompute.ulg.test-stage-mechanics-trace.v0',
      status: 'test-stage-mechanics-trace-ready',
      ordinal: 3
    }
  );
  assert.deepEqual(
    result.perStepSummaries.lastStep.hierarchyStageSummary
      .canonicalSpatialAuthorityTrace,
    {
      schema: 'peercompute.ulg.test-canonical-authority-trace.v0',
      status: 'test-canonical-authority-trace-admitted',
      ordinal: 3
    }
  );
  assert.equal(
    result.perStepSummaries.lastStep.epochSeal.schema,
    ULG_WORKER_SCHROEDER_EPOCH_SEAL_SCHEMA
  );
  assert.equal(result.finalEpochIdentity.positionEpoch, 19);
  assert.equal(result.finalEpochIdentity.physicsTick, 15);
  assert.equal(result.finalEpochIdentity.storageGeneration, 13);
  assert.ok(result.retainedBufferRefs.length > 0);
  for (const ref of result.retainedBufferRefs) {
    assert.match(ref, /^ulg-worker:/);
  }
  assert.equal(result.gpuFence.fenceSatisfied, true);
  assert.equal(result.gpuFence.terminalScheduleFence, true);
  assert.equal(result.gpuFence.scope, 'resident-schedule-terminal');
  assert.equal(result.gpuFence.authorityAdmissionReady, true);
  assert.equal(result.gpuFence.scheduleId, 'ulg:test:schedule-batch');
  assert.equal(result.gpuFence.completedStepCount, 3);
  assert.equal(
    result.gpuFence.queueCompletionMethod,
    'worker-device.queue.onSubmittedWorkDone'
  );
  assert.equal(
    result.perStepSummaries.lastStep.coveredByScheduleTerminalFence,
    true
  );
  assert.equal(
    result.perStepSummaries.lastStep.terminalScheduleFenceSatisfied,
    true
  );
  assert.equal(result.perStepSummaries.lastStep.stageFenceSatisfied, false);
  assert.equal(result.perStepSummaries.lastStep.gpuFenceSatisfied, true);
  assert.equal(
    result.perStepSummaries.lastStep.gpuFenceStatus,
    'gpu-fence-satisfied-by-resident-schedule-terminal'
  );
  assertNoWorkerGpuBuffers(result, 'scheduleResult');
  structuredClone(result);

  const retainedParticleState =
    resolveUlgMechanicsResidentStageWorkerRetainedParticleState({
      laneId: laneOptions.laneId,
      stateKey: laneOptions.stateKey,
      sourceStageId: 'schroederSameLevelMechanics'
    });
  assert.equal(retainedParticleState.status, 'worker-retained-particle-state-ready');
  assert.equal(
    retainedParticleState.retainedThermoBufferSourceStage,
    'schroederSameLevelMechanics'
  );
  assert.equal(retainedParticleState.retainedThermoBufferSeededFromCpu, false);
  assert.equal(retainedParticleState.retainedThermoBufferCopySrc, true);
  assert.ok(retainedParticleState.mechanicsBufferByteLength > 0);
  const retainedParticleStateWithStaleCallerShape =
    resolveUlgMechanicsResidentStageWorkerRetainedParticleState({
      laneId: laneOptions.laneId,
      stateKey: laneOptions.stateKey,
      sourceStageId: 'schroederSameLevelMechanics',
      particleCount: 1,
      stateStrideFloats: 1,
      thermoStrideFloats: 1,
      stateByteLength: 4,
      thermoByteLength: 4
    });
  assert.equal(
    retainedParticleStateWithStaleCallerShape.particleCount,
    retainedParticleState.particleCount
  );
  assert.equal(
    retainedParticleStateWithStaleCallerShape.stateBufferByteLength,
    retainedParticleState.stateBufferByteLength
  );
  assert.equal(
    retainedParticleStateWithStaleCallerShape.thermoBufferByteLength,
    retainedParticleState.thermoBufferByteLength
  );

  const retainedSnapshot =
    await exportUlgMechanicsResidentStageWorkerRetainedCompactSnapshot({
      device: fixture.device,
      laneId: laneOptions.laneId,
      stateKey: laneOptions.stateKey,
      sourceStageId: 'schroederSameLevelMechanics',
      particleCount: fixture.particleCount,
      step: result.completedStepCount,
      time: result.completedStepCount * 0.001
    });
  assert.equal(retainedSnapshot.status, 'worker-retained-compact-snapshot-exported');
  assert.equal(retainedSnapshot.thermoSource, 'worker-retained-thermo-gpu-readback');
  assert.equal(retainedSnapshot.retainedThermoBufferSeededFromCpu, false);
  assert.equal(retainedSnapshot.retainedThermoBufferCopySrc, true);
  assert.equal(
    retainedSnapshot.compactBufferSnapshot.sharedSlotIdentityVerified,
    true
  );
  assert.deepEqual(retainedSnapshot.compactBufferSnapshot.sphSlotIdentity, {
    slot: 1,
    sourceSlot: 0,
    nextSlot: 1
  });
  assert.deepEqual(
    retainedSnapshot.compactBufferSnapshot.mechanicsSlotIdentity,
    retainedSnapshot.compactBufferSnapshot.sphSlotIdentity
  );
  assert.equal(retainedSnapshot.compactBufferSnapshot.topologyEpoch, 19);
  assert.equal(
    retainedSnapshot.compactBufferSnapshot.identityRevision,
    'worker-schedule-fixture-identity'
  );
  assert.equal(retainedSnapshot.compactBufferSnapshot.identityRequired, true);
  assert.equal(
    retainedSnapshot.compactBufferSnapshot.identitySchema,
    ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA
  );
  assert.equal(
    retainedSnapshot.compactBufferSnapshot.identityStrideUints,
    SPH_GPU_PARTICLE_IDENTITY_UINTS
  );
  assert.equal(
    retainedSnapshot.compactBufferSnapshot.identityStrideBytes,
    SPH_GPU_PARTICLE_IDENTITY_UINTS * Uint32Array.BYTES_PER_ELEMENT
  );
  assert.equal(
    retainedSnapshot.compactBufferSnapshot.sphIdentityByteLength,
    fixture.identityRows.byteLength
  );
  assert.ok(
    retainedSnapshot.compactBufferSnapshot.sphIdentity instanceof Uint32Array
  );
  assert.deepEqual(
    [...retainedSnapshot.compactBufferSnapshot.sphIdentity],
    [...fixture.identityRows]
  );
  assert.deepEqual(retainedSnapshot.compactBufferSnapshot.renderDomainKeys, {
    101: 'worker-schedule-body-one',
    202: 'worker-schedule-body-two'
  });
  assert.equal(
    retainedSnapshot.sphIdentityByteLength,
    fixture.identityRows.byteLength
  );
  assert.equal(
    retainedSnapshot.readbackByteLength,
    retainedSnapshot.sphStateByteLength
      + retainedSnapshot.sphThermoByteLength
      + retainedSnapshot.sphIdentityByteLength
      + retainedSnapshot.mlsMpmMechanicsByteLength
  );
  assert.equal(
    retainedSnapshot.compactBufferSnapshot.workerLineageMetadata.status,
    'worker-retained-compact-snapshot-lineage-metadata-ready'
  );
  assert.deepEqual(
    retainedSnapshot.compactBufferSnapshot.sphPhaseCarrierPlan,
    fixture.phaseCarrierPlan
  );
  assert.deepEqual(
    retainedSnapshot.compactBufferSnapshot.mechanicsPhaseCarrierPlan,
    fixture.phaseCarrierPlan
  );

  // The steps chained: step N's mechanics consumed step N-1's post-step
  // buffers, and each mechanics stage consumed that step's own generation.
  assert.equal(
    fixture.runnerCalls[1].sphParticleUpload.stateBuffer.label,
    'worker-ss-schedule-batch-next-state-1'
  );
  assert.equal(
    fixture.runnerCalls[2].sphParticleUpload.stateBuffer.label,
    'worker-ss-schedule-batch-next-state-2'
  );
  assert.equal(
    fixture.runnerCalls[1].spatialEpochGeneration.execution.positionEpoch,
    18
  );
  assert.equal(
    fixture.runnerCalls[2].spatialEpochGeneration.execution.positionEpoch,
    19
  );
});

test('ULG one-step canonical resident schedule has no control-plane yield boundary', async (t) => {
  const messageChannelStats = instrumentResidentScheduleMessageChannels(t);
  const fixture = workerScheduleFixture({ laneSuffix: 'one-step-no-yield' });
  const laneOptions = {
    laneId: 'ulg:test:one-step-no-yield-lane',
    stateKey: 'ulg:test:one-step-no-yield-state'
  };
  try {
    const result = await runUlgMechanicsResidentStageWorkerSchedulePayload(
      schedulePayload(
        workerSchroederStageContext(
          fixture.device,
          fixture.buffers,
          fixture.stageOptions
        ),
        { stepCount: 1, scheduleId: 'ulg:test:one-step-no-yield' },
        laneOptions
      )
    );
    assert.equal(result.completedStepCount, 1);
    assert.equal(
      result.controlPlaneYieldReceipt.mechanism,
      'none-single-step-canonical'
    );
    assert.equal(
      result.controlPlaneYieldReceipt.scheduledYieldOpportunityCount,
      0
    );
    assert.equal(result.controlPlaneYieldReceipt.yieldRequestCount, 0);
    assert.equal(result.controlPlaneYieldReceipt.completedYieldCount, 0);
    assert.equal(result.controlPlaneYieldReceipt.portsClosed, true);
    assert.equal(messageChannelStats.constructionCount, 0);
    assert.equal(messageChannelStats.port1CloseCount, 0);
    assert.equal(messageChannelStats.port2CloseCount, 0);
  } finally {
    releaseUlgMechanicsResidentStageWorkerLane(laneOptions);
  }
});

test('ULG private resident schedule stage returns bypass public deep transport walks', async () => {
  const fixture = workerScheduleFixture({
    laneSuffix: 'private-stage-transport'
  });
  const laneOptions = {
    laneId: 'ulg:test:private-stage-transport-lane',
    stateKey: 'ulg:test:private-stage-transport-state'
  };
  const baseMechanicsRunner =
    fixture.stageOptions.schroederSameLevelMechanics
      .schroederSameLevelMechanicsRunner;
  const privateEpochQueueTimeline = Object.freeze([
    Object.freeze({ stage: 'private-epoch-start', atMs: 0 }),
    Object.freeze({ stage: 'private-epoch-end', atMs: 0.25 })
  ]);
  const privateStageGpuMs = Object.freeze({ p2g: 0.125, g2p: 0.25 });
  const privateQueueStageGpuMs = Object.freeze({
    'fine-0-p2g': 0.375,
    'terminal-coarse-g2p': 0.625
  });
  const privateQueueStageGpuStats = Object.freeze({
    'fine-0-p2g': Object.freeze({
      totalMs: 0.375,
      count: 1,
      maxMs: 0.375,
      meanMs: 0.375
    }),
    'terminal-coarse-g2p': Object.freeze({
      totalMs: 0.625,
      count: 1,
      maxMs: 0.625,
      meanMs: 0.625
    })
  });
  const privateGpuTimestampProfile = Object.freeze({
    schema: 'peercompute.ulg.test-gpu-timestamp-profile.v0',
    stageGpuMs: privateStageGpuMs
  });
  const privateDisabledStageTrace = Object.freeze({
    schema: 'peercompute.ulg.sph-stage-mechanics-trace.v0',
    status: 'stage-mechanics-trace-disabled',
    stages: Object.freeze([])
  });
  const privateDisabledCanonicalTrace = Object.freeze({
    schema: 'peercompute.ulg.test-canonical-authority-trace.v0',
    status: 'canonical-spatial-authority-trace-disabled',
    stages: Object.freeze([])
  });
  fixture.stageOptions.schroederSpatialEpoch.residentStepOptions = {
    residentGpuTimestampProfilingRequested: true
  };
  fixture.stageOptions.schroederSpatialEpoch
    .schroederSpatialEpochGenerationRunner = async (args) => {
      const generation =
        await runSchroederSpatialEpochGenerationWebGpu(args);
      generation.readGenerationQueueTimeline = async () =>
        privateEpochQueueTimeline;
      return generation;
    };
  let probeArmed = true;
  let publicTransportWalkCount = 0;
  const privateOnlySummary = { status: 'private-stage-summary' };
  Object.defineProperty(privateOnlySummary, 'publicTransportWalkProbe', {
    enumerable: true,
    get() {
      if (probeArmed) publicTransportWalkCount += 1;
      return 'must-not-be-walked';
    }
  });
  fixture.stageOptions.schroederSameLevelMechanics
    .schroederSameLevelMechanicsRunner = async (args) => {
      const result = await baseMechanicsRunner(args);
      result.residentStep.stageTiming.stageGpuMs = privateStageGpuMs;
      result.residentStep.stageTiming.gpuTimestampProfile =
        privateGpuTimestampProfile;
      result.residentStep.stageTiming.queueStageGpuMs =
        privateQueueStageGpuMs;
      result.residentStep.stageTiming.queueStageGpuStats =
        privateQueueStageGpuStats;
      result.residentStep.stageTiming.queueStageGpuSummaryStatus =
        'gpu-timestamp-recorder-stage-summary-ready';
      result.residentStep.stageTiming.queueStageGpuRecorderSchema =
        'peercompute.ulg.sph-gpu-queue-stage-recorder.v0';
      result.residentStep.stageTiming.queueStageGpuRecorderKind =
        'queue-fence-stage-summary';
      result.residentStep.stageTiming.queueStageGpuRecorderCapabilities = {
        measureQueueStage: true,
        encoderSpans: false,
        stageGpuMs: true,
        stageGpuStats: true
      };
      result.residentStep.stageMechanicsTrace = privateDisabledStageTrace;
      result.residentStep.canonicalSpatialAuthorityTrace =
        privateDisabledCanonicalTrace;
      return {
        ...result,
        currentSchroederSpatialEpochGenerationSummary: () =>
          privateOnlySummary
      };
    };
  const progressEnvelopes = [];

  try {
    const result = await runUlgMechanicsResidentStageWorkerSchedulePayload(
      schedulePayload(
        workerSchroederStageContext(
          fixture.device,
          fixture.buffers,
          fixture.stageOptions
        ),
        {
          stepCount: 1,
          scheduleId: 'ulg:test:private-stage-transport-schedule'
        },
        laneOptions
      ),
      {
        postProgress: (progress) => progressEnvelopes.push(progress)
      }
    );

    assert.equal(result.status, 'worker-resident-schedule-completed');
    assert.equal(
      publicTransportWalkCount,
      0,
      'private internal stage results must not enter the public deep clone/ref walk'
    );
    assert.equal(progressEnvelopes.length, 1);
    assert.equal(
      progressEnvelopes[0].stepSummary.epochRetainedBufferRefs.length,
      3
    );
    assert.equal(progressEnvelopes[0].stepSummary.retainedBufferRefs.length, 4);
    assert.equal(result.retainedBufferRefs.length, 4);
    assert.strictEqual(
      result.perStepSummaries.ring[0].epochQueueTimeline,
      privateEpochQueueTimeline,
      'the private epoch result must bypass the public clone transport'
    );
    assert.strictEqual(
      result.perStepSummaries.lastStep.hierarchyStageSummary
        .residentStageTiming.stageGpuMs,
      privateStageGpuMs,
      'the primary profiled stage timing map must remain intact'
    );
    assert.equal(
      result.perStepSummaries.lastStep.hierarchyStageSummary
        .residentStageTiming.gpuTimestampProfile.stageGpuMs,
      null,
      'the private result must preserve the established timing-alias shape'
    );
    assert.deepEqual(
      result.perStepSummaries.lastStep.hierarchyStageSummary
        .residentStageTiming.queueStageGpuMs,
      privateQueueStageGpuMs,
      'queue-fence timing must retain its distinct clone-safe transport map'
    );
    assert.deepEqual(
      result.perStepSummaries.ring[0].queueStageGpuMs,
      privateQueueStageGpuMs,
      'the bounded per-step ring must expose queue-stage attribution'
    );
    assert.deepEqual(
      result.perStepSummaries.ring[0].queueStageGpuStats,
      privateQueueStageGpuStats
    );
    assert.equal(
      result.perStepSummaries.ring[0].queueStageGpuSummaryStatus,
      'gpu-timestamp-recorder-stage-summary-ready'
    );
    assert.equal(
      result.perStepSummaries.lastStep.hierarchyStageSummary
        .stageMechanicsTrace,
      null,
      'an unrequested disabled trace must retain the legacy alias shape'
    );
    assert.equal(
      result.perStepSummaries.lastStep.hierarchyStageSummary
        .canonicalSpatialAuthorityTrace,
      null,
      'an unrequested canonical trace alias must retain the legacy shape'
    );
    assertNoWorkerGpuBuffers(progressEnvelopes[0], 'privateStageProgress');
    assertNoWorkerGpuBuffers(result, 'privateStageScheduleResult');
    structuredClone(progressEnvelopes[0]);
    structuredClone(result);
    assert.equal(
      publicTransportWalkCount,
      0,
      'private-only raw diagnostics must not leak into published schedule receipts'
    );
  } finally {
    probeArmed = false;
    releaseUlgMechanicsResidentStageWorkerLane({
      ...laneOptions,
      reason: 'private schedule stage transport test complete'
    });
  }
});

test('ULG resident stage worker blocks compact export from a short explicit identity buffer', async () => {
  const fixture = workerScheduleFixture({ laneSuffix: 'short-identity' });
  const laneOptions = {
    laneId: 'ulg:test:schroeder-short-identity-lane',
    stateKey: 'ulg:test:schroeder-short-identity-state'
  };
  const mechanicsRunner = fixture.stageOptions.schroederSameLevelMechanics
    .schroederSameLevelMechanicsRunner;
  fixture.stageOptions.schroederSameLevelMechanics
    .schroederSameLevelMechanicsRunner = async (args) => {
      const result = await mechanicsRunner(args);
      result.residentStep.nextParticleUploads.sphParticleUpload.identityBuffer =
        fixture.taggedBuffer(
          'worker-ss-schedule-short-identity-truncated',
          fixture.identityRows.byteLength - Uint32Array.BYTES_PER_ELEMENT
        );
      return result;
    };

  try {
    const scheduleResult =
      await runUlgMechanicsResidentStageWorkerSchedulePayload(
        schedulePayload(
          workerSchroederStageContext(
            fixture.device,
            fixture.buffers,
            fixture.stageOptions
          ),
          { stepCount: 1, scheduleId: 'ulg:test:schedule-short-identity' },
          laneOptions
        )
      );
    assert.equal(scheduleResult.status, 'worker-resident-schedule-completed');

    const exported =
      await exportUlgMechanicsResidentStageWorkerRetainedCompactSnapshot({
        device: fixture.device,
        laneId: laneOptions.laneId,
        stateKey: laneOptions.stateKey,
        sourceStageId: 'schroederSameLevelMechanics',
        particleCount: fixture.particleCount,
        step: 1,
        time: 0.001
      });

    assert.equal(
      exported.status,
      'worker-retained-compact-snapshot-export-blocked'
    );
    assert.equal(
      exported.reason,
      'worker-retained-compact-snapshot-readback-failed'
    );
    assert.match(
      exported.errorMessage,
      /sph-identity readback requires a retained source buffer/
    );
  } finally {
    releaseUlgMechanicsResidentStageWorkerLane({
      ...laneOptions,
      reason: 'short identity export test complete'
    });
  }
});

test('ULG resident schedules preserve one exact static mechanics table across continuation payloads', async () => {
  const fixture = workerScheduleFixture({
    laneSuffix: 'static-mechanics-table-continuation'
  });
  const mechanicsMaterialTable = {
    schema: 'peercompute.ulg.mls-mpm-mechanics-material-table.v0',
    phaseRecordCount: 1,
    records: new Float32Array([1, 2, 3, 4])
  };
  const laneOptions = {
    laneId: 'ulg:test:static-mechanics-table-continuation-lane',
    stateKey: 'ulg:test:static-mechanics-table-continuation-state'
  };
  fixture.stageOptions.schroederSameLevelMechanics.residentStepOptions = {
    mechanicsMaterialTable
  };

  await runUlgMechanicsResidentStageWorkerSchedulePayload(
    schedulePayload(
      workerSchroederStageContext(
        fixture.device,
        fixture.buffers,
        fixture.stageOptions
      ),
      { stepCount: 1, scheduleId: 'ulg:test:static-table-schedule-1' },
      laneOptions
    )
  );
  const retainedUpload = fixture.runnerCalls[0].residentStepOptions
    .mechanicsRefreshOptions.mechanicsMaterialPhaseUpload;

  fixture.stageOptions.schroederSameLevelMechanics.residentStepOptions = {};
  await runUlgMechanicsResidentStageWorkerSchedulePayload(
    schedulePayload(
      workerSchroederStageContext(
        fixture.device,
        fixture.buffers,
        fixture.stageOptions
      ),
      { stepCount: 1, scheduleId: 'ulg:test:static-table-schedule-2' },
      laneOptions
    )
  );
  assert.strictEqual(
    fixture.runnerCalls[1].residentStepOptions.mechanicsMaterialTable,
    mechanicsMaterialTable
  );
  assert.strictEqual(
    fixture.runnerCalls[1].residentStepOptions.mechanicsRefreshOptions
      .mechanicsMaterialPhaseUpload,
    retainedUpload
  );
  assert.equal(
    diagnoseUploadedMechanicsMaterialPhaseRecordsMatch(
      retainedUpload,
      fixture.runnerCalls[1].residentStepOptions.mechanicsMaterialTable,
      fixture.device
    ).matches,
    true
  );

  fixture.stageOptions.schroederSameLevelMechanics.residentStepOptions = {
    mechanicsMaterialTable: {
      ...mechanicsMaterialTable,
      records: new Float32Array([1, 2, 3, 5])
    }
  };
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerSchedulePayload(
      schedulePayload(
        workerSchroederStageContext(
          fixture.device,
          fixture.buffers,
          fixture.stageOptions
        ),
        { stepCount: 1, scheduleId: 'ulg:test:static-table-schedule-3' },
        laneOptions
      )
    ),
    (error) => {
      assert.equal(
        error?.residentScheduleError?.reason,
        'static-mechanics-material-phase-authority-drift'
      );
      assert.equal(
        error?.residentScheduleError?.scheduleId,
        'ulg:test:static-table-schedule-3'
      );
      assert.equal(error?.residentScheduleError?.stepOrdinal, 1);
      assert.equal(
        error?.residentScheduleError?.authorityDiagnostics
          ?.materialUpload?.fingerprintMatch,
        false
      );
      return true;
    }
  );
  assert.equal(
    fixture.runnerCalls.length,
    2,
    'a drifted static table must fail before the mechanics kernel runs'
  );
  releaseUlgMechanicsResidentStageWorkerLane({
    ...laneOptions,
    reason: 'static mechanics table continuation test complete'
  });
});

test('ULG resident schedule aggregates exact surface-stress evidence without retaining every step receipt', async () => {
  const run = async ({ laneSuffix, invalidSurfaceStressAtStep = null }) => {
    const fixture = workerScheduleFixture({
      laneSuffix,
      withSurfaceStressEvidence: true,
      invalidSurfaceStressAtStep
    });
    fixture.stageOptions.schroederSameLevelMechanics.residentStepOptions = {
      mechanicsMaterialTable: {
        schema: 'peercompute.ulg.mls-mpm-mechanics-material-table.v0',
        phaseRecordCount: 1,
        surfaceTensionEnabled: true,
        positiveSurfaceTensionPhaseRecordCount: 1,
        surfaceTensionCoefficientStatus:
          'positive-surface-tension-coefficient-ready',
        records: new Float32Array([1, 2, 3, 4])
      }
    };
    return runUlgMechanicsResidentStageWorkerSchedulePayload(
      schedulePayload(
        workerSchroederStageContext(
          fixture.device,
          fixture.buffers,
          fixture.stageOptions
        ),
        { stepCount: 3, scheduleId: `ulg:test:${laneSuffix}` },
        {
          laneId: `ulg:test:${laneSuffix}-lane`,
          stateKey: `ulg:test:${laneSuffix}-state`
        }
      )
    );
  };

  const exact = await run({ laneSuffix: 'surface-stress-exact' });
  const exactEvidence =
    exact.perStepSummaries.phaseVolumeSurfaceStress;
  assert.equal(
    exactEvidence.schema,
    'peercompute.ulg.worker-resident-schedule-surface-stress-evidence.v0'
  );
  assert.equal(exactEvidence.required, true);
  assert.equal(exactEvidence.observedStepCount, 3);
  assert.equal(exactEvidence.expectedSubmissionCount, 3);
  assert.equal(exactEvidence.exactSubmissionCount, 3);
  assert.equal(exactEvidence.submissionEvidenceComplete, true);
  assert.equal(exactEvidence.firstIncompleteStepOrdinal, null);
  assert.equal(exactEvidence.finalSubmissionStepOrdinal, 3);
  assert.equal(exactEvidence.finalSubmission.dispatchCount, 18);
  assert.equal(
    exact.perStepSummaries.lastStep.hierarchyStageSummary
      .phaseVolumeSurfaceStressSubmission,
    null,
    'private stage transport must preserve the established cycle-alias shape'
  );
  assertNoWorkerGpuBuffers(exact, 'surfaceStressExactSchedule');
  structuredClone(exact);

  const inexact = await run({
    laneSuffix: 'surface-stress-inexact',
    invalidSurfaceStressAtStep: 2
  });
  const inexactEvidence =
    inexact.perStepSummaries.phaseVolumeSurfaceStress;
  assert.equal(inexactEvidence.exactSubmissionCount, 2);
  assert.equal(inexactEvidence.submissionEvidenceComplete, false);
  assert.equal(inexactEvidence.firstIncompleteStepOrdinal, 2);
  assert.equal(inexactEvidence.finalSubmissionStepOrdinal, 3);
  assertNoWorkerGpuBuffers(inexact, 'surfaceStressInexactSchedule');
  structuredClone(inexact);
});

test('ULG resident schedule two-level evidence remains complete beyond the summary ring', async () => {
  const run = async ({
    laneSuffix,
    stepCount,
    invalidCommitAt = null,
    invalidCflAt = null,
    cflIntervalRejectTraceAtStep = null,
    cflIntervalRejectTrace = null,
    observeCanonicalSpatialAuthority = false,
    requestedCflFactor = 0.8
  }) => {
    const fixture = workerScheduleFixture({
      laneSuffix,
      withTwoLevelEvidence: true,
      invalidTwoLevelCommitAtStep: invalidCommitAt,
      invalidTwoLevelCflFactorAtStep: invalidCflAt,
      cflIntervalRejectTraceAtStep,
      cflIntervalRejectTrace
    });
    for (const stageId of [
      'schroederSpatialEpoch',
      'schroederSameLevelMechanics'
    ]) {
      fixture.stageOptions[stageId].enableTwoLevelMechanics = true;
      fixture.stageOptions[stageId].twoLevelMechanicsAuthority =
        'authoritative';
      fixture.stageOptions[stageId].twoLevelFineSubstepCount = 2;
    }
    fixture.stageOptions.schroederSameLevelMechanics.cflFactor =
      requestedCflFactor;
    fixture.stageOptions.schroederSameLevelMechanics.residentStepOptions = {
      ...(fixture.stageOptions.schroederSameLevelMechanics
        .residentStepOptions || {}),
      observeCanonicalSpatialAuthority
    };
    const result = await runUlgMechanicsResidentStageWorkerSchedulePayload(
      schedulePayload(
        workerSchroederStageContext(
          fixture.device,
          fixture.buffers,
          fixture.stageOptions
        ),
        { stepCount, scheduleId: `ulg:test:${laneSuffix}` },
        {
          laneId: `ulg:test:${laneSuffix}-lane`,
          stateKey: `ulg:test:${laneSuffix}-state`
        }
      )
    );
    return { fixture, result };
  };

  const { result: exact } = await run({
    laneSuffix: 'two-level-evidence-exact',
    stepCount: ULG_WORKER_RESIDENT_SCHEDULE_STEP_SUMMARY_RING_CAPACITY + 1
  });
  assert.equal(
    exact.perStepSummaries.ring.length,
    ULG_WORKER_RESIDENT_SCHEDULE_STEP_SUMMARY_RING_CAPACITY
  );
  assert.equal(exact.perStepSummaries.droppedStepCount, 1);
  const exactEvidence = exact.perStepSummaries.twoLevelMechanics;
  assert.equal(
    exactEvidence.schema,
    'peercompute.ulg.worker-resident-schedule-two-level-mechanics-evidence.v0'
  );
  assert.equal(
    exactEvidence.observedStepCount,
    ULG_WORKER_RESIDENT_SCHEDULE_STEP_SUMMARY_RING_CAPACITY + 1
  );
  assert.equal(
    exactEvidence.exactAuthoritativeStepCount,
    ULG_WORKER_RESIDENT_SCHEDULE_STEP_SUMMARY_RING_CAPACITY + 1
  );
  assert.equal(exactEvidence.cflFactorEvidenceRequired, true);
  assert.equal(exactEvidence.cflFactorRequested, 0.8);
  assert.equal(
    exactEvidence.cflFactorObservedStepCount,
    ULG_WORKER_RESIDENT_SCHEDULE_STEP_SUMMARY_RING_CAPACITY + 1
  );
  assert.equal(
    exactEvidence.exactCflFactorCount,
    ULG_WORKER_RESIDENT_SCHEDULE_STEP_SUMMARY_RING_CAPACITY + 1
  );
  assert.equal(exactEvidence.firstCflFactorMismatchStepOrdinal, null);
  assert.equal(exactEvidence.lastCflFactor, 0.8);
  assert.equal(exactEvidence.lastStep.twoLevelCflFactor, 0.8);
  assert.equal(exactEvidence.coverageComplete, true);
  assert.equal(exactEvidence.firstIncompleteStepOrdinal, null);
  assert.equal(exactEvidence.terminalRefluxReceiptRequired, true);
  assert.equal(
    exactEvidence.terminalRefluxAdmittedStepCount,
    ULG_WORKER_RESIDENT_SCHEDULE_STEP_SUMMARY_RING_CAPACITY + 1
  );
  assert.equal(
    exactEvidence.terminalRefluxReceipt.status,
    'terminal-reflux-schedule-receipt-admitted'
  );
  assertNoWorkerGpuBuffers(exact, 'twoLevelExactSchedule');
  structuredClone(exact);

  await assert.rejects(
    run({
      laneSuffix: 'two-level-evidence-inexact',
      stepCount: 2,
      invalidCommitAt: 2,
      observeCanonicalSpatialAuthority: true
    }),
    (error) => {
      assert.equal(
        error?.residentScheduleError?.reason,
        'schedule-terminal-reflux-receipt-rejected'
      );
      const receipt = error?.residentScheduleError?.terminalGpuFence
        ?.terminalRefluxReceipt;
      assert.equal(receipt?.status, 'terminal-reflux-receipt-rejected');
      assert.equal(receipt?.expectedStepCount, 2);
      assert.equal(receipt?.observedStepCount, 2);
      assert.equal(receipt?.admittedStepCount, 1);
      assert.equal(receipt?.firstRejectedStepOrdinal, 2);
      assert.equal(
        receipt?.firstRejectedDiagnostic?.mutationRollbackCount,
        1
      );
      const diagnostics = error?.residentScheduleError
        ?.authorityDiagnostics;
      assert.equal(
        diagnostics?.schema,
        'peercompute.ulg.worker-resident-schedule-terminal-reflux-diagnostic.v0'
      );
      assert.equal(diagnostics?.firstRejectedStepOrdinal, 2);
      assert.equal(
        diagnostics?.hierarchyStageSummary
          ?.stageMechanicsTraceRequested,
        false
      );
      assert.deepEqual(
        diagnostics?.hierarchyStageSummary
          ?.canonicalSpatialAuthorityTrace,
        {
          schema: 'peercompute.ulg.test-canonical-authority-trace.v0',
          status: 'test-canonical-authority-trace-admitted',
          ordinal: 2
        }
      );
      assertNoWorkerGpuBuffers(
        error.residentScheduleError,
        'twoLevelRejectedScheduleError'
      );
      structuredClone(error.residentScheduleError);
      return true;
    }
  );

  const cflTraceCases = [
    {
      laneSuffix: 'two-level-cfl-fine-trace',
      input: {
        stage: 'fine',
        fieldOrdinal: 321,
        priorRegime: 'audit',
        phaseIntervalValid: true,
        fullIntervalValid: false,
        localIntervalOverlap: false,
        priorVelocityMPerS: [1.25, -2.5, 3.75],
        phaseDeltaVelocityMPerS: [0.5, 0.25, -0.75],
        fullDeltaVelocityMPerS: [0.75, 0.5, -1],
        maximumVelocityMPerS: 4.5,
        correctionCeilingMPerS: 0.125
      },
      expectedStage: 'fine-validator'
    },
    {
      laneSuffix: 'two-level-cfl-coarse-trace',
      input: {
        stage: 'coarse',
        fieldOrdinal: 654,
        priorRegime: 'outside',
        phaseIntervalValid: true,
        fullIntervalValid: true,
        localIntervalOverlap: true,
        priorVelocityMPerS: [-11, 12, -13],
        phaseDeltaVelocityMPerS: [0.125, 0.25, 0.5],
        fullDeltaVelocityMPerS: [0.25, 0.5, 1],
        maximumVelocityMPerS: 14,
        correctionCeilingMPerS: 0
      },
      expectedStage: 'coarse-validator'
    },
    {
      laneSuffix: 'two-level-cfl-seal-trace',
      input: {
        stage: 'seal',
        priorRegime: 'invalid',
        phaseIntervalValid: true,
        fullIntervalValid: true,
        localIntervalOverlap: false,
        globalAlphaInterval: { lower: 0.75, upper: 0.5 }
      },
      expectedStage: 'global-interval-seal'
    }
  ];
  for (const traceCase of cflTraceCases) {
    await assert.rejects(
      run({
        laneSuffix: traceCase.laneSuffix,
        stepCount: 3,
        cflIntervalRejectTraceAtStep: 2,
        cflIntervalRejectTrace: traceCase.input
      }),
      (error) => {
        const diagnostic = error?.residentScheduleError?.terminalGpuFence
          ?.terminalRefluxReceipt?.firstRejectedDiagnostic;
        const trace = diagnostic?.cflIntervalRejectTrace;
        assert.equal(trace?.status, 'capture-complete');
        assert.equal(trace?.stage, traceCase.expectedStage);
        assert.equal(trace?.headerEvidenceRepurposed, true);
        assert.equal(diagnostic?.headerEvidenceRepurposed, true);
        assert.equal(diagnostic?.statusCaptureMissingCount, null);
        assert.equal(diagnostic?.operatorSplitValid, null);
        assert.equal(diagnostic?.phaseVolumeTransportValid, null);
        assert.equal(diagnostic?.ambientBoundaryValid, null);
        assert.equal(trace?.rawPayloadWords?.length, 11);
        if (traceCase.input.stage === 'seal') {
          assert.deepEqual(
            trace.globalAlphaInterval,
            traceCase.input.globalAlphaInterval
          );
          assert.equal(trace.fieldOrdinal, null);
        } else {
          assert.equal(trace.fieldOrdinal, traceCase.input.fieldOrdinal);
          assert.deepEqual(
            trace.priorVelocityMPerS,
            traceCase.input.priorVelocityMPerS
          );
          assert.deepEqual(
            trace.phaseDeltaVelocityMPerS,
            traceCase.input.phaseDeltaVelocityMPerS
          );
          assert.deepEqual(
            trace.fullDeltaVelocityMPerS,
            traceCase.input.fullDeltaVelocityMPerS
          );
          assert.equal(
            trace.maximumVelocityMPerS,
            traceCase.input.maximumVelocityMPerS
          );
          assert.equal(
            trace.correctionCeilingMPerS,
            traceCase.input.correctionCeilingMPerS
          );
        }
        return true;
      }
    );
  }

  await assert.rejects(
    run({
      laneSuffix: 'two-level-cfl-inexact',
      stepCount: 3,
      invalidCflAt: 2
    }),
    (error) => {
      assert.equal(
        error?.residentScheduleError?.reason,
        'schedule-two-level-mechanics-evidence-incomplete'
      );
      const evidence = error?.residentScheduleError
        ?.twoLevelMechanicsEvidence;
      assert.equal(evidence?.cflFactorRequested, 0.8);
      assert.equal(evidence?.cflFactorObservedStepCount, 3);
      assert.equal(evidence?.exactCflFactorCount, 2);
      assert.equal(evidence?.firstCflFactorMismatchStepOrdinal, 2);
      assert.equal(evidence?.coverageComplete, false);
      assert.equal(
        error?.residentScheduleError?.controlPlaneYieldReceipt
          ?.completedYieldCount,
        2
      );
      assert.equal(
        error?.residentScheduleError?.controlPlaneYieldReceipt?.portsClosed,
        true
      );
      return true;
    }
  );

  const invalidFixture = workerScheduleFixture({
    laneSuffix: 'two-level-cfl-invalid-input',
    withTwoLevelEvidence: true
  });
  for (const stageId of [
    'schroederSpatialEpoch',
    'schroederSameLevelMechanics'
  ]) {
    invalidFixture.stageOptions[stageId].enableTwoLevelMechanics = true;
    invalidFixture.stageOptions[stageId].twoLevelMechanicsAuthority =
      'authoritative';
  }
  invalidFixture.stageOptions.schroederSameLevelMechanics.cflFactor = 0;
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerSchedulePayload(
      schedulePayload(
        workerSchroederStageContext(
          invalidFixture.device,
          invalidFixture.buffers,
          invalidFixture.stageOptions
        ),
        {
          stepCount: 1,
          scheduleId: 'ulg:test:two-level-cfl-invalid-input'
        },
        {
          laneId: 'ulg:test:two-level-cfl-invalid-input-lane',
          stateKey: 'ulg:test:two-level-cfl-invalid-input-state'
        }
      )
    ),
    (error) => {
      assert.equal(
        error?.residentScheduleError?.reason,
        'schedule-two-level-cfl-factor-invalid'
      );
      return true;
    }
  );
  assert.equal(invalidFixture.runnerCalls.length, 0);
});

test('ULG resident schedule preserves dynamic product history while reapplying seed-time static options', async () => {
  const fixture = workerScheduleFixture({
    laneSuffix: 'static-options-product-history',
    withCarriedResidentProductMass: true
  });
  fixture.stageOptions.schroederSameLevelMechanics.residentStepOptions = {
    internalPressureScale: 0.75,
    reactionStepOptions: {
      enableReactions: true
    }
  };

  const result = await runUlgMechanicsResidentStageWorkerSchedulePayload(
    schedulePayload(
      workerSchroederStageContext(
        fixture.device,
        fixture.buffers,
        fixture.stageOptions
      ),
      {
        stepCount: 3,
        scheduleId: 'ulg:test:static-options-product-history'
      },
      {
        laneId: 'ulg:test:static-options-product-history-lane',
        stateKey: 'ulg:test:static-options-product-history-state'
      }
    )
  );

  assert.equal(result.completedStepCount, 3);
  assert.equal(fixture.runnerCalls.length, 3);
  assert.equal(
    fixture.runnerCalls[0].residentStepOptions.residentProductMass,
    undefined,
    'the fresh seed has no prior product-history owner'
  );
  assert.strictEqual(
    fixture.runnerCalls[1].residentStepOptions.residentProductMass,
    fixture.residentProductMasses[0],
    'step 2 consumes the exact product-history owner committed by step 1'
  );
  assert.strictEqual(
    fixture.runnerCalls[2].residentStepOptions.residentProductMass,
    fixture.residentProductMasses[1],
    'step 3 consumes the exact product-history owner committed by step 2'
  );
  for (const call of fixture.runnerCalls) {
    assert.equal(call.residentStepOptions.internalPressureScale, 0.75);
    assert.equal(call.residentStepOptions.reactionStepOptions.enableReactions, true);
  }
});

test('ULG short resident schedule crosses epoch arena capacity behind one terminal host fence', async () => {
  const fixture = workerScheduleFixture({ laneSuffix: 'one-terminal-fence' });
  fixture.stageOptions.schroederSpatialEpoch.spatialEpochArenaCount = 2;
  const progressEnvelopes = [];
  let resolveTerminalFence;
  const terminalFencePromise = new Promise((resolve) => {
    resolveTerminalFence = resolve;
  });
  let submittedWorkDoneCount = 0;
  fixture.device.queue.onSubmittedWorkDone = () => {
    submittedWorkDoneCount += 1;
    return terminalFencePromise;
  };
  const laneOptions = {
    laneId: 'ulg:test:one-terminal-fence-lane',
    stateKey: 'ulg:test:one-terminal-fence-state'
  };
  let scheduleSettled = false;
  const schedulePromise = runUlgMechanicsResidentStageWorkerSchedulePayload(
    schedulePayload(
      workerSchroederStageContext(
        fixture.device,
        fixture.buffers,
        fixture.stageOptions
      ),
      { stepCount: 5, scheduleId: 'ulg:test:one-terminal-fence' },
      laneOptions
    ),
    { postProgress: (progress) => progressEnvelopes.push(progress) }
  ).finally(() => {
    scheduleSettled = true;
  });

  for (let attempt = 0; attempt < 100 && progressEnvelopes.length < 5; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  assert.equal(fixture.runnerCalls.length, 5);
  assert.equal(progressEnvelopes.length, 5);
  assert.equal(scheduleSettled, false);
  assert.equal(submittedWorkDoneCount, 1);
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerSchedulePayload(
      schedulePayload(
        workerSchroederStageContext(
          fixture.device,
          fixture.buffers,
          fixture.stageOptions
        ),
        { stepCount: 1, scheduleId: 'ulg:test:one-terminal-fence-overlap' },
        laneOptions
      )
    ),
    /lane-schedule-already-active/
  );
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerPayload(payload(
      stage(
        'schroederSpatialEpoch',
        ['schroeder-level-assignment'],
        ['schroeder-spatial-epoch']
      ),
      workerSchroederStageContext(
        fixture.device,
        fixture.buffers,
        fixture.stageOptions
      ),
      null,
      laneOptions
    )),
    (error) => error?.code === 'ERR_ULG_WORKER_RESIDENT_SCHEDULE_LANE_BUSY'
  );

  resolveTerminalFence();
  const result = await schedulePromise;
  assert.equal(result.completedStepCount, 5);
  assert.equal(result.gpuFence.terminalScheduleFence, true);
  assert.equal(result.gpuFence.fenceSatisfied, true);
  assert.equal(submittedWorkDoneCount, 1);
});

test('ULG resident schedule bounds queued work with non-authoritative 16-step drain checkpoints', async () => {
  const fixture = workerScheduleFixture({ laneSuffix: 'bounded-queue-drain' });
  const fenceStartRunnerCounts = [];
  const originalFence =
    fixture.device.queue.onSubmittedWorkDone.bind(fixture.device.queue);
  fixture.device.queue.onSubmittedWorkDone = (...args) => {
    fenceStartRunnerCounts.push(fixture.runnerCalls.length);
    return originalFence(...args);
  };
  const stepCount = ULG_WORKER_RESIDENT_SCHEDULE_QUEUE_DRAIN_INTERVAL_STEPS + 1;
  const result = await runUlgMechanicsResidentStageWorkerSchedulePayload(
    schedulePayload(
      workerSchroederStageContext(
        fixture.device,
        fixture.buffers,
        fixture.stageOptions
      ),
      { stepCount, scheduleId: 'ulg:test:bounded-queue-drain' },
      {
        laneId: 'ulg:test:bounded-queue-drain-lane',
        stateKey: 'ulg:test:bounded-queue-drain-state'
      }
    )
  );

  assert.equal(result.completedStepCount, stepCount);
  assert.equal(result.queueDrainCheckpointCount, 1);
  assert.equal(result.queueDrainCheckpoints.length, 1);
  const [checkpoint] = result.queueDrainCheckpoints;
  assert.equal(
    checkpoint.completedStepCount,
    ULG_WORKER_RESIDENT_SCHEDULE_QUEUE_DRAIN_INTERVAL_STEPS
  );
  assert.equal(checkpoint.scope, 'resident-schedule-queue-drain-checkpoint');
  assert.equal(checkpoint.terminalScheduleFence, false);
  assert.equal(checkpoint.fenceSatisfied, true);
  assert.equal(checkpoint.authorityAdmissionReady, false);
  assert.equal(checkpoint.stateManagerCommitReady, false);
  assert.equal(
    checkpoint.queueCompletionMethod,
    'worker-device.queue.onSubmittedWorkDone'
  );
  assert.equal(result.gpuFence.terminalScheduleFence, true);
  assert.equal(result.gpuFence.fenceSatisfied, true);
  assert.equal(result.gpuFence.authorityAdmissionReady, true);
  assert.equal(
    fixture.device.queue.submittedWorkDoneCount,
    3,
    'the lagged drain starts a fence at the loop seed and after each '
      + 'satisfied checkpoint (awaited at the NEXT boundary), plus the '
      + 'terminal authority fence'
  );
  assert.deepEqual(
    fenceStartRunnerCounts,
    [0, ULG_WORKER_RESIDENT_SCHEDULE_QUEUE_DRAIN_INTERVAL_STEPS, stepCount],
    'the first drain fence starts after the authenticated step-1 epoch but '
      + 'before mechanics, the next starts after step 16, and the terminal '
      + 'authority fence starts only after step 17'
  );
  assertNoWorkerGpuBuffers(result, 'boundedQueueDrainScheduleResult');
  structuredClone(result);
});

test('ULG canonical schedule at the drain interval has no unused lag seed', async () => {
  const fixture = workerScheduleFixture({ laneSuffix: 'exact-drain-interval' });
  const fenceStartRunnerCounts = [];
  const originalFence =
    fixture.device.queue.onSubmittedWorkDone.bind(fixture.device.queue);
  fixture.device.queue.onSubmittedWorkDone = (...args) => {
    fenceStartRunnerCounts.push(fixture.runnerCalls.length);
    return originalFence(...args);
  };
  const stepCount = ULG_WORKER_RESIDENT_SCHEDULE_QUEUE_DRAIN_INTERVAL_STEPS;
  const result = await runUlgMechanicsResidentStageWorkerSchedulePayload(
    schedulePayload(
      workerSchroederStageContext(
        fixture.device,
        fixture.buffers,
        fixture.stageOptions
      ),
      { stepCount, scheduleId: 'ulg:test:exact-drain-interval' },
      {
        laneId: 'ulg:test:exact-drain-interval-lane',
        stateKey: 'ulg:test:exact-drain-interval-state'
      }
    )
  );

  assert.equal(result.completedStepCount, stepCount);
  assert.equal(result.queueDrainCheckpointCount, 0);
  assert.deepEqual(result.queueDrainCheckpoints, []);
  assert.equal(result.gpuFence.terminalScheduleFence, true);
  assert.equal(result.gpuFence.fenceSatisfied, true);
  assert.deepEqual(
    fenceStartRunnerCounts,
    [stepCount],
    'an exact-interval schedule never reaches an intermediate boundary, so '
      + 'only its authoritative terminal fence may start'
  );
});

test('ULG canonical lagged drain seeds early and advances at prior boundaries for 33/64 steps', async () => {
  const interval = ULG_WORKER_RESIDENT_SCHEDULE_QUEUE_DRAIN_INTERVAL_STEPS;
  for (const stepCount of [33, 64]) {
    const fixture = workerScheduleFixture({
      laneSuffix: `lagged-drain-order-${stepCount}`
    });
    const fenceStartRunnerCounts = [];
    const originalFence =
      fixture.device.queue.onSubmittedWorkDone.bind(fixture.device.queue);
    fixture.device.queue.onSubmittedWorkDone = (...args) => {
      fenceStartRunnerCounts.push(fixture.runnerCalls.length);
      return originalFence(...args);
    };
    const result = await runUlgMechanicsResidentStageWorkerSchedulePayload(
      schedulePayload(
        workerSchroederStageContext(
          fixture.device,
          fixture.buffers,
          fixture.stageOptions
        ),
        {
          stepCount,
          scheduleId: `ulg:test:lagged-drain-order-${stepCount}`
        },
        {
          laneId: `ulg:test:lagged-drain-order-${stepCount}-lane`,
          stateKey: `ulg:test:lagged-drain-order-${stepCount}-state`
        }
      )
    );
    const checkpointBoundaries = [];
    for (let boundary = interval; boundary < stepCount; boundary += interval) {
      checkpointBoundaries.push(boundary);
    }
    assert.equal(result.completedStepCount, stepCount);
    assert.deepEqual(
      result.queueDrainCheckpoints.map((entry) => entry.completedStepCount),
      checkpointBoundaries
    );
    assert.deepEqual(
      fenceStartRunnerCounts,
      [0, ...checkpointBoundaries, stepCount],
      `the ${stepCount}-step schedule must seed before mechanics, advance one `
        + 'lagged fence after every prior boundary, and finish with the '
        + 'terminal authority fence'
    );
  }
});

test('ULG resident schedule fails closed and poisons the lane when a queue-drain checkpoint rejects', async () => {
  const fixture = workerScheduleFixture({ laneSuffix: 'queue-drain-fail' });
  let submittedWorkDoneCount = 0;
  const fenceStartRunnerCounts = [];
  fixture.device.queue.onSubmittedWorkDone = () => {
    fenceStartRunnerCounts.push(fixture.runnerCalls.length);
    submittedWorkDoneCount += 1;
    return Promise.reject(new Error('injected queue-drain checkpoint rejection'));
  };
  const laneOptions = {
    laneId: 'ulg:test:queue-drain-fail-lane',
    stateKey: 'ulg:test:queue-drain-fail-state'
  };
  const stepCount = ULG_WORKER_RESIDENT_SCHEDULE_QUEUE_DRAIN_INTERVAL_STEPS + 1;
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerSchedulePayload(
      schedulePayload(
        workerSchroederStageContext(
          fixture.device,
          fixture.buffers,
          fixture.stageOptions
        ),
        { stepCount, scheduleId: 'ulg:test:queue-drain-fail' },
        laneOptions
      )
    ),
    (error) => {
      const detail = error.residentScheduleError;
      assert.equal(
        detail?.reason,
        'schedule-queue-drain-checkpoint-unsatisfied'
      );
      assert.equal(
        detail?.stepOrdinal,
        ULG_WORKER_RESIDENT_SCHEDULE_QUEUE_DRAIN_INTERVAL_STEPS
      );
      assert.equal(detail?.queueDrainCheckpoint?.terminalScheduleFence, false);
      assert.equal(detail?.queueDrainCheckpoint?.fenceSatisfied, false);
      assert.match(
        detail?.queueDrainCheckpoint?.queueCompletionErrorMessage,
        /injected queue-drain checkpoint rejection/
      );
      assert.equal(detail?.terminalGpuFence?.terminalScheduleFence, true);
      assert.equal(
        detail?.terminalGpuFence?.terminalDerivedFromQueueDrainCheckpoint,
        true
      );
      assert.equal(detail?.terminalGpuFence?.fenceSatisfied, false);
      assert.equal(detail?.terminalGpuFence?.authorityAdmissionReady, false);
      return true;
    }
  );
  assert.equal(
    fixture.runnerCalls.length,
    ULG_WORKER_RESIDENT_SCHEDULE_QUEUE_DRAIN_INTERVAL_STEPS,
    'step 17 must never start after a failed step-16 drain'
  );
  assert.equal(
    submittedWorkDoneCount,
    1,
    'a failed checkpoint must not trigger a second blind terminal queue call'
  );
  assert.deepEqual(
    fenceStartRunnerCounts,
    [0],
    'the rejected fence was seeded before step-1 mechanics and its rejection '
      + 'is consumed only at the step-16 checkpoint'
  );
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerSchedulePayload(
      schedulePayload(
        workerSchroederStageContext(
          fixture.device,
          fixture.buffers,
          fixture.stageOptions
        ),
        { stepCount: 1, scheduleId: 'ulg:test:queue-drain-fail-reuse' },
        laneOptions
      )
    ),
    /lane-terminal-fence-poisoned/
  );
});

test('ULG resident schedule bridges hierarchy cleanup claims to the next submitted step', async () => {
  const fixture = workerScheduleFixture({
    laneSuffix: 'hierarchy-cleanup-bridge',
    withHierarchyCleanupClaims: true
  });
  const result = await runUlgMechanicsResidentStageWorkerSchedulePayload(
    schedulePayload(
      workerSchroederStageContext(
        fixture.device,
        fixture.buffers,
        fixture.stageOptions
      ),
      { stepCount: 5, scheduleId: 'ulg:test:hierarchy-cleanup-bridge' },
      {
        laneId: 'ulg:test:hierarchy-cleanup-bridge-lane',
        stateKey: 'ulg:test:hierarchy-cleanup-bridge-state'
      }
    )
  );

  assert.equal(result.completedStepCount, 5);
  assert.deepEqual(fixture.runnerCalls[0].queueOrderedProducerClaims, []);
  for (let index = 1; index < fixture.runnerCalls.length; index += 1) {
    assert.deepEqual(
      fixture.runnerCalls[index].queueOrderedProducerClaims,
      [fixture.hierarchyCleanupClaims[index - 1]]
    );
  }
  assert.equal(fixture.hierarchyCleanupObservations.length, 4);
  fixture.hierarchyCleanupObservations.forEach((observation, index) => {
    assert.strictEqual(
      observation.queueOrderedFinalConsumer,
      fixture.hierarchyFinalConsumers[index + 1]
    );
  });
  assert.equal(
    fixture.device.queue.submittedWorkDoneCount,
    1,
    'the terminal schedule fence is the only host queue fence'
  );

  const continuationResult =
    await runUlgMechanicsResidentStageWorkerSchedulePayload(
      schedulePayload(
        workerSchroederStageContext(
          fixture.device,
          fixture.buffers,
          fixture.stageOptions
        ),
        {
          stepCount: 2,
          scheduleId: 'ulg:test:hierarchy-cleanup-bridge-continuation'
        },
        {
          laneId: 'ulg:test:hierarchy-cleanup-bridge-lane',
          stateKey: 'ulg:test:hierarchy-cleanup-bridge-state'
        }
      )
    );
  assert.equal(continuationResult.completedStepCount, 2);
  assert.deepEqual(
    fixture.runnerCalls[5].queueOrderedProducerClaims,
    [fixture.hierarchyCleanupClaims[4]],
    'the first step of a later schedule consumes the prior batch terminal claim'
  );
  assert.strictEqual(
    fixture.hierarchyCleanupObservations[4].queueOrderedFinalConsumer,
    fixture.hierarchyFinalConsumers[5]
  );
  assert.equal(
    fixture.device.queue.submittedWorkDoneCount,
    2,
    'each schedule adds exactly its terminal host queue fence'
  );
});

test('ULG resident schedule preserves prior product mass when hierarchy final-consumer authority is missing', async () => {
  const fixture = workerScheduleFixture({
    laneSuffix: 'hierarchy-final-consumer-missing',
    withHierarchyCleanupClaims: true,
    omitHierarchyFinalConsumerAtStep: 2,
    withCarriedResidentProductMass: true
  });
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerSchedulePayload(
      schedulePayload(
        workerSchroederStageContext(
          fixture.device,
          fixture.buffers,
          fixture.stageOptions
        ),
        {
          stepCount: 2,
          scheduleId: 'ulg:test:hierarchy-final-consumer-missing'
        },
        {
          laneId: 'ulg:test:hierarchy-final-consumer-missing-lane',
          stateKey: 'ulg:test:hierarchy-final-consumer-missing-state'
        }
      )
    ),
    (error) => {
      assert.equal(
        error.residentScheduleError?.reason,
        'schedule-hierarchy-final-consumer-capability-missing'
      );
      assert.equal(error.residentScheduleError?.stepOrdinal, 2);
      assert.equal(
        error.residentScheduleError?.terminalGpuFence?.terminalScheduleFence,
        true
      );
      assert.equal(
        error.residentScheduleError?.terminalGpuFence?.fenceSatisfied,
        true
      );
      return true;
    }
  );

  assert.equal(fixture.runnerCalls.length, 2);
  assert.strictEqual(
    fixture.runnerCalls[1].residentStepOptions.residentProductMass,
    fixture.residentProductMasses[0],
    'step 2 consumes the exact product-mass handle committed by step 1'
  );
  assert.equal(
    fixture.residentProductMassDestroyCountByOrdinal.get(1) || 0,
    0,
    'the unadopted step cleanup preserves the prior committed handle'
  );
  assert.equal(
    fixture.residentProductMassDestroyCountByOrdinal.get(2),
    1,
    'the unadopted step may retire only its newly produced handle'
  );
});

test('ULG resident schedule rejects hierarchy claims whose cleanup authority did not seal', async () => {
  const fixture = workerScheduleFixture({
    laneSuffix: 'hierarchy-cleanup-ineligible',
    withHierarchyCleanupClaims: true,
    ineligibleHierarchyCleanupAtStep: 1
  });
  const laneOptions = {
    laneId: 'ulg:test:hierarchy-cleanup-ineligible-lane',
    stateKey: 'ulg:test:hierarchy-cleanup-ineligible-state'
  };
  const sourceSphUpload =
    fixture.stageOptions.schroederSpatialEpoch.sphParticleUpload;
  const sourceMlsUpload =
    fixture.stageOptions.schroederSpatialEpoch.mlsMpmParticleUpload;
  Object.assign(sourceSphUpload, {
    storageGeneration: 11,
    bufferFamilyGeneration: 11,
    topologyEpoch: 19
  });
  Object.assign(sourceMlsUpload, {
    storageGeneration: 11,
    bufferFamilyGeneration: 11,
    topologyEpoch: 19
  });
  const dispersedMediumOptics = uploadWorkerTestDispersedMediumOptics(
    fixture.device,
    sourceSphUpload,
    'hierarchy-cleanup-ineligible-dispersed-medium'
  );
  let rejectedSphUpload = null;
  const mechanicsRunner = fixture.stageOptions.schroederSameLevelMechanics
    .schroederSameLevelMechanicsRunner;
  fixture.stageOptions.schroederSameLevelMechanics
    .schroederSameLevelMechanicsRunner = async (args) => {
      const execution = await mechanicsRunner(args);
      const nextSphUpload =
        execution.residentStep.nextParticleUploads.sphParticleUpload;
      const supersededIdentityBuffer = nextSphUpload.identityBuffer;
      Object.assign(nextSphUpload, {
        storageGeneration: 12,
        bufferFamilyGeneration: 12,
        topologyEpoch: 19,
        identityBuffer: args.sphParticleUpload.identityBuffer
      });
      rejectedSphUpload = nextSphUpload;
      attachWorkerTestDispersedMediumOptics(
        nextSphUpload,
        args.sphParticleUpload.dispersedMediumOptics,
        { ownsBuffer: false }
      );
      transferTopologyStableSphDispersedMediumOpticsOwnership({
        sourceSphUpload: args.sphParticleUpload,
        targetSphUpload: nextSphUpload
      });
      supersededIdentityBuffer.destroy();
      return execution;
    };
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerSchedulePayload(
      schedulePayload(
        workerSchroederStageContext(
          fixture.device,
          fixture.buffers,
          fixture.stageOptions
        ),
        {
          stepCount: 2,
          scheduleId: 'ulg:test:hierarchy-cleanup-ineligible'
        },
        laneOptions
      )
    ),
    (error) => {
      assert.equal(
        error.residentScheduleError?.reason,
        'schedule-hierarchy-cleanup-authority-missing'
      );
      assert.equal(error.residentScheduleError?.stepOrdinal, 1);
      assert.equal(
        error.residentScheduleError?.terminalGpuFence?.fenceSatisfied,
        true
      );
      return true;
    }
  );
  assert.equal(fixture.runnerCalls.length, 1);
  assert.equal(sourceSphUpload.ownsDispersedMediumOpticsBuffer, true);
  assert.equal(rejectedSphUpload.ownsDispersedMediumOpticsBuffer, false);
  assert.strictEqual(
    rejectedSphUpload.dispersedMediumOptics,
    sourceSphUpload.dispersedMediumOptics
  );
  assert.equal(dispersedMediumOptics.buffer.destroyed, false);
  releaseUlgMechanicsResidentStageWorkerLane({
    ...laneOptions,
    reason: 'hierarchy-cleanup-ineligible-test-complete'
  });
  assert.equal(dispersedMediumOptics.buffer.destroyed, true);
  assert.equal(dispersedMediumOptics.destroyed, true);
});

test('ULG resident schedule retains the adopted sidecar owner when predecessor cleanup throws', async () => {
  const fixture = workerScheduleFixture({
    laneSuffix: 'predecessor-cleanup-owner-retention'
  });
  const laneOptions = {
    laneId: 'ulg:test:predecessor-cleanup-owner-retention-lane',
    stateKey: 'ulg:test:predecessor-cleanup-owner-retention-state'
  };
  const sourceSph =
    fixture.stageOptions.schroederSpatialEpoch.sphParticleUpload;
  const sourceMls =
    fixture.stageOptions.schroederSpatialEpoch.mlsMpmParticleUpload;
  const auxiliaryFields = [
    {
      source: sourceSph,
      buffer: 'materialPropertyBankWarmInputBuffer',
      rowCount: 'materialPropertyBankWarmInputRowCount',
      owns: 'ownsMaterialPropertyBankWarmInputBuffer',
      label: 'worker-cleanup-owner-sph-warm',
      rows: 2
    },
    {
      source: sourceSph,
      buffer: 'materialPropertyBankParticleSizeBuffer',
      rowCount: 'materialPropertyBankParticleSizeRowCount',
      owns: 'ownsMaterialPropertyBankParticleSizeBuffer',
      label: 'worker-cleanup-owner-sph-particle-size',
      rows: 2
    },
    {
      source: sourceMls,
      buffer: 'materialPropertyBankWarmInputBuffer',
      rowCount: 'materialPropertyBankWarmInputRowCount',
      owns: 'ownsMaterialPropertyBankWarmInputBuffer',
      label: 'worker-cleanup-owner-mls-warm',
      rows: 3
    },
    {
      source: sourceMls,
      buffer: 'materialPropertyBankParticleSizeBuffer',
      rowCount: 'materialPropertyBankParticleSizeRowCount',
      owns: 'ownsMaterialPropertyBankParticleSizeBuffer',
      label: 'worker-cleanup-owner-mls-particle-size',
      rows: 2
    }
  ];
  for (const fields of auxiliaryFields) {
    fields.source[fields.buffer] = fixture.taggedBuffer(fields.label, 32);
    fields.source[fields.rowCount] = fields.rows;
    fields.source[fields.owns] = true;
  }
  Object.assign(sourceSph, {
    ownsStateBuffer: true,
    ownsThermoBuffer: true,
    ownsIdentityBuffer: true,
    identityOwnership: 'worker-cleanup-owner-source'
  });
  sourceMls.ownsMechanicsBuffer = true;

  const baseRunner = fixture.stageOptions.schroederSameLevelMechanics
    .schroederSameLevelMechanicsRunner;
  const producedSteps = [];
  let injectedCleanupFailureCount = 0;
  let poisonedSuccessorOwnerReleaseCount = 0;
  const poisonedSuccessorOwnerBuffer = fixture.taggedBuffer(
    'worker-cleanup-owner-poisoned-successor-owner-buffer',
    16
  );
  fixture.stageOptions.schroederSameLevelMechanics
    .schroederSameLevelMechanicsRunner = async (args) => {
      const result = await baseRunner(args);
      const residentStep = result.residentStep;
      const nextSph = residentStep.nextParticleUploads.sphParticleUpload;
      const nextMls = residentStep.nextParticleUploads.mlsMpmParticleUpload;
      Object.assign(nextSph, {
        ownsStateBuffer: true,
        ownsThermoBuffer: true
      });
      nextMls.ownsMechanicsBuffer = true;

      const discardedIdentityBuffer = nextSph.identityBuffer;
      discardedIdentityBuffer.destroy();
      nextSph.identityBuffer = args.sphParticleUpload.identityBuffer;
      nextSph.identityBufferByteLength =
        args.sphParticleUpload.identityBufferByteLength;
      nextSph.identityRevision = args.sphParticleUpload.identityRevision;
      nextSph.ownsIdentityBuffer = true;
      nextSph.identityOwnership = 'worker-cleanup-owner-successor';
      assert.equal(args.sphParticleUpload.ownsIdentityBuffer, true);
      args.sphParticleUpload.ownsIdentityBuffer = false;
      args.sphParticleUpload.identityOwnership =
        'transferred-to-worker-cleanup-owner-successor';

      for (const fields of auxiliaryFields) {
        const source = fields.source === sourceSph
          ? args.sphParticleUpload
          : args.mlsMpmParticleUpload;
        const target = fields.source === sourceSph ? nextSph : nextMls;
        assert.equal(source[fields.owns], true);
        target[fields.buffer] = source[fields.buffer];
        target[fields.rowCount] = source[fields.rowCount];
        target[fields.owns] = true;
        source[fields.owns] = false;
      }

      if (producedSteps.length === 0) {
        const predecessorMechanicsBuffer = nextMls.mechanicsBuffer;
        const destroy = predecessorMechanicsBuffer.destroy.bind(
          predecessorMechanicsBuffer
        );
        predecessorMechanicsBuffer.destroy = () => {
          if (injectedCleanupFailureCount === 0) {
            injectedCleanupFailureCount += 1;
            throw new Error('injected predecessor resident cleanup failure');
          }
          return destroy();
        };
      } else {
        residentStep.localRetainedRenderBuffers = {
          buffers: [{
            family: 'test-poisoned-successor-owner',
            buffer: poisonedSuccessorOwnerBuffer
          }],
          destroyRetainedBuffers() {
            poisonedSuccessorOwnerReleaseCount += 1;
            poisonedSuccessorOwnerBuffer.destroy();
            return true;
          }
        };
      }
      producedSteps.push(residentStep);
      return result;
    };

  await assert.rejects(
    runUlgMechanicsResidentStageWorkerSchedulePayload(
      schedulePayload(
        workerSchroederStageContext(
          fixture.device,
          fixture.buffers,
          fixture.stageOptions
        ),
        {
          stepCount: 2,
          scheduleId: 'ulg:test:predecessor-cleanup-owner-retention'
        },
        laneOptions
      )
    ),
    (error) => {
      assert.equal(
        error.residentScheduleError?.reason,
        'previous-resident-step-cleanup-failed'
      );
      assert.equal(error.residentScheduleError?.stepOrdinal, 2);
      assert.equal(
        error.residentScheduleError?.terminalGpuFence?.fenceSatisfied,
        true
      );
      return true;
    }
  );

  assert.equal(producedSteps.length, 2);
  const predecessorSph =
    producedSteps[0].nextParticleUploads.sphParticleUpload;
  const predecessorMls =
    producedSteps[0].nextParticleUploads.mlsMpmParticleUpload;
  const successorSph =
    producedSteps[1].nextParticleUploads.sphParticleUpload;
  const successorMls =
    producedSteps[1].nextParticleUploads.mlsMpmParticleUpload;
  assert.equal(predecessorSph.ownsIdentityBuffer, false);
  assert.equal(successorSph.ownsIdentityBuffer, true);
  assert.strictEqual(successorSph.identityBuffer, predecessorSph.identityBuffer);
  assert.equal(predecessorSph.stateBuffer.destroyed, true);
  assert.equal(predecessorSph.thermoBuffer.destroyed, true);
  assert.equal(predecessorSph.identityBuffer.destroyed, false);
  assert.equal(predecessorMls.mechanicsBuffer.destroyed, false);
  assert.equal(successorSph.stateBuffer.destroyed, false);
  assert.equal(successorSph.thermoBuffer.destroyed, false);
  assert.equal(successorSph.identityBuffer.destroyed, false);
  assert.equal(successorMls.mechanicsBuffer.destroyed, false);
  for (const fields of auxiliaryFields) {
    const predecessor = fields.source === sourceSph
      ? predecessorSph
      : predecessorMls;
    const successor = fields.source === sourceSph
      ? successorSph
      : successorMls;
    assert.equal(predecessor[fields.owns], false, fields.label);
    assert.equal(successor[fields.owns], true, fields.label);
    assert.strictEqual(successor[fields.buffer], predecessor[fields.buffer]);
    assert.equal(successor[fields.buffer].destroyCount, 0, fields.label);
  }
  assert.equal(injectedCleanupFailureCount, 1);

  await assert.rejects(
    runUlgMechanicsResidentStageWorkerPayload(payload(
      stage(
        'schroederSpatialEpoch',
        ['schroeder-level-assignment'],
        ['schroeder-spatial-epoch']
      ),
      workerSchroederStageContext(
        fixture.device,
        fixture.buffers,
        fixture.stageOptions
      ),
      null,
      laneOptions
    )),
    (error) => {
      assert.equal(
        error.code,
        'ERR_ULG_WORKER_RESIDENT_SCHEDULE_LANE_POISONED'
      );
      assert.equal(
        error.residentSchedulePoison?.reason,
        'previous-resident-step-cleanup-failed'
      );
      return true;
    }
  );

  const release = releaseUlgMechanicsResidentStageWorkerLane({
    ...laneOptions,
    reason: 'test-predecessor-cleanup-owner-retention-complete'
  });
  assert.equal(release.status, 'worker-resident-lane-released');
  assert.equal(poisonedSuccessorOwnerReleaseCount, 1);
  assert.equal(poisonedSuccessorOwnerBuffer.destroyed, true);
  assert.equal(predecessorSph.identityBuffer.destroyed, true);
  assert.equal(predecessorMls.mechanicsBuffer.destroyed, true);
  assert.equal(successorSph.stateBuffer.destroyed, true);
  assert.equal(successorSph.thermoBuffer.destroyed, true);
  assert.equal(successorSph.identityBuffer.destroyed, true);
  assert.equal(successorMls.mechanicsBuffer.destroyed, true);
  for (const fields of auxiliaryFields) {
    assert.equal(fields.source[fields.buffer].destroyed, true, fields.label);
    assert.ok(fields.source[fields.buffer].destroyCount >= 1, fields.label);
  }
});

test('ULG resident schedule keeps SS transport refs bounded across 256 persistent-lane steps', async () => {
  const fixture = workerScheduleFixture({ laneSuffix: 'bounded-transport-refs' });
  const laneOptions = {
    laneId: 'ulg:test:bounded-transport-refs-lane',
    stateKey: 'ulg:test:bounded-transport-refs-state'
  };
  const registryCounts = [];
  const progressRetainedRefs = [];
  const runSchedule = (scheduleId) =>
    runUlgMechanicsResidentStageWorkerSchedulePayload(
      schedulePayload(
        workerSchroederStageContext(
          fixture.device,
          fixture.buffers,
          fixture.stageOptions
        ),
        { stepCount: 128, scheduleId },
        laneOptions
      ),
      {
        postProgress: (progress) => {
          registryCounts.push(
            progress.stepSummary.retainedBufferRegistryEntryCount
          );
          progressRetainedRefs.push([
            ...progress.stepSummary.retainedBufferRefs
          ]);
        }
      }
    );

  const first = await runSchedule('ulg:test:bounded-transport-refs:first');
  const countAfterFirst = registryCounts.at(-1);
  const second = await runSchedule('ulg:test:bounded-transport-refs:second');
  const countAfterSecond = registryCounts.at(-1);

  assert.equal(first.completedStepCount, 128);
  assert.equal(second.completedStepCount, 128);
  assert.equal(registryCounts.length, 256);
  assert.ok(Number.isSafeInteger(countAfterFirst) && countAfterFirst > 0);
  assert.equal(countAfterSecond, countAfterFirst);
  assert.ok(
    registryCounts.every((count) => count === registryCounts[0]),
    'the registry reaches its fixed path-shaped bound on step 1'
  );
  assert.ok(
    registryCounts[0] <= 16,
    `the SS transport registry stays at a small explicit bound (got ${
      registryCounts[0]
    })`
  );
  assert.deepEqual(
    second.retainedBufferRefs,
    progressRetainedRefs.at(-1),
    'the terminal result exports only the final step transport refs'
  );
  assert.equal(
    progressRetainedRefs[0].some((ref) => second.retainedBufferRefs.includes(ref)),
    false,
    'superseded first-step refs are absent from the final result'
  );
  assert.equal(
    fixture.device.queue.submittedWorkDoneCount,
    18,
    'each 128-step schedule seeds one lagged-drain fence, starts one after '
      + 'each of its seven satisfied checkpoints, and closes with its '
      + 'terminal fence'
  );
});

test('ULG resident schedule rejects a non-WebGPU stage before terminal authority admission', async () => {
  const fixture = workerScheduleFixture({ laneSuffix: 'cpu-fallback' });
  const webGpuRunner =
    fixture.stageOptions.schroederSameLevelMechanics
      .schroederSameLevelMechanicsRunner;
  fixture.stageOptions.schroederSameLevelMechanics
    .schroederSameLevelMechanicsRunner = async (args) => {
      const result = await webGpuRunner(args);
      return {
        ...result,
        residentStep: { ...result.residentStep, backend: 'cpu' }
      };
    };
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerSchedulePayload(
      schedulePayload(
        workerSchroederStageContext(
          fixture.device,
          fixture.buffers,
          fixture.stageOptions
        ),
        { stepCount: 1, scheduleId: 'ulg:test:schedule-cpu-fallback' },
        {
          laneId: 'ulg:test:schedule-cpu-fallback-lane',
          stateKey: 'ulg:test:schedule-cpu-fallback-state'
        }
      )
    ),
    (error) => {
      assert.equal(
        error.residentScheduleError?.reason,
        'schedule-stage-terminal-fence-deferral-missing'
      );
      assert.equal(
        error.residentScheduleError?.terminalGpuFence?.fenceSatisfied,
        true
      );
      return true;
    }
  );
});

test('ULG long canonical cancellation keeps its early drain seed non-authoritative', async () => {
  const fixture = workerScheduleFixture({ laneSuffix: 'long-cancel-seed' });
  const laneOptions = {
    laneId: 'ulg:test:long-cancel-seed-lane',
    stateKey: 'ulg:test:long-cancel-seed-state'
  };
  const scheduleId = 'ulg:test:long-cancel-seed';
  const requestedStepCount =
    ULG_WORKER_RESIDENT_SCHEDULE_QUEUE_DRAIN_INTERVAL_STEPS + 1;
  const fenceStartRunnerCounts = [];
  const originalFence =
    fixture.device.queue.onSubmittedWorkDone.bind(fixture.device.queue);
  fixture.device.queue.onSubmittedWorkDone = (...args) => {
    fenceStartRunnerCounts.push(fixture.runnerCalls.length);
    return originalFence(...args);
  };
  const result = await runUlgMechanicsResidentStageWorkerSchedulePayload(
    schedulePayload(
      workerSchroederStageContext(
        fixture.device,
        fixture.buffers,
        fixture.stageOptions
      ),
      { stepCount: requestedStepCount, scheduleId },
      laneOptions
    ),
    {
      postProgress: (progress) => {
        if (progress.stepOrdinal === 1) {
          cancelUlgMechanicsResidentStageWorkerSchedule(scheduleId);
        }
      }
    }
  );
  assert.equal(result.requestedStepCount, requestedStepCount);
  assert.equal(result.completedStepCount, 1);
  assert.equal(result.cancelled, true);
  assert.equal(result.queueDrainCheckpointCount, 0);
  assert.deepEqual(result.queueDrainCheckpoints, []);
  assert.equal(result.gpuFence.terminalScheduleFence, true);
  assert.equal(result.gpuFence.fenceSatisfied, true);
  assert.equal(result.gpuFence.completedStepCount, 1);
  assert.deepEqual(
    fenceStartRunnerCounts,
    [0, 1],
    'the early lag seed never substitutes for the terminal authority fence '
      + 'when a long requested schedule cancels before its first checkpoint'
  );
});

test('ULG resident stage worker schedule cancellation finishes the in-flight step and leaves the lane usable', async (t) => {
  const messageChannelStats = instrumentResidentScheduleMessageChannels(t);
  const fixture = workerScheduleFixture({ laneSuffix: 'cancel' });
  const laneOptions = {
    laneId: 'ulg:test:schroeder-schedule-cancel-lane',
    stateKey: 'ulg:test:schroeder-schedule-cancel-state'
  };
  const scheduleId = 'ulg:test:schedule-cancel';
  // Cancelling an id with no active schedule is a truthful no-op.
  assert.equal(
    cancelUlgMechanicsResidentStageWorkerSchedule(scheduleId).cancelRequested,
    false
  );
  const progressEnvelopes = [];
  const cancellationChannel = new NATIVE_MESSAGE_CHANNEL();
  let cancellationAck = null;
  cancellationChannel.port1.onmessage = () => {
    cancellationAck = cancelUlgMechanicsResidentStageWorkerSchedule(scheduleId);
  };
  cancellationChannel.port1.start?.();
  let result;
  try {
    result = await runUlgMechanicsResidentStageWorkerSchedulePayload(
      schedulePayload(
        workerSchroederStageContext(
          fixture.device,
          fixture.buffers,
          fixture.stageOptions
        ),
        { stepCount: 3, scheduleId },
        laneOptions
      ),
      {
        postProgress: (progress) => {
          progressEnvelopes.push(progress);
          if (progress.stepOrdinal === 1) {
            // Queue the cancel on another local unshipped MessagePort before
            // the schedule posts its own next-step MessageChannel yield.
            cancellationChannel.port2.postMessage(null);
          }
        }
      }
    );
  } finally {
    cancellationChannel.port1.close();
    cancellationChannel.port2.close();
  }
  assert.equal(cancellationAck?.cancelRequested, true);
  assert.equal(cancellationAck?.scheduleId, scheduleId);
  assert.equal(result.status, 'worker-resident-schedule-cancelled');
  assert.equal(result.cancelled, true);
  // The in-flight step completes, then a real task yield admits the queued
  // cancel message before step 2 begins.
  assert.equal(result.completedStepCount, 1);
  assert.equal(result.completedStepCount, fixture.runnerCalls.length);
  assert.equal(result.completedStepCount, progressEnvelopes.length);
  assert.equal(
    result.controlPlaneYieldReceipt.scheduledYieldOpportunityCount,
    2
  );
  assert.equal(result.controlPlaneYieldReceipt.yieldRequestCount, 1);
  assert.equal(result.controlPlaneYieldReceipt.completedYieldCount, 1);
  assert.equal(result.controlPlaneYieldReceipt.messageChannelYieldCount, 1);
  assert.equal(result.controlPlaneYieldReceipt.timerFallbackYieldCount, 0);
  assert.equal(result.controlPlaneYieldReceipt.firstBeforeStepOrdinal, 2);
  assert.equal(result.controlPlaneYieldReceipt.lastBeforeStepOrdinal, 2);
  assert.equal(
    result.controlPlaneYieldReceipt.cancellationObservedAfterYield,
    true
  );
  assert.equal(
    result.controlPlaneYieldReceipt.cancellationObservedBeforeStepOrdinal,
    2
  );
  assert.equal(result.controlPlaneYieldReceipt.closedPortCount, 2);
  assert.equal(result.controlPlaneYieldReceipt.portsClosed, true);
  assert.equal(messageChannelStats.constructionCount, 1);
  assert.equal(messageChannelStats.port1CloseCount, 1);
  assert.equal(messageChannelStats.port2CloseCount, 1);
  assert.equal(result.perStepSummaries.ring.length, result.completedStepCount);
  assert.equal(
    result.finalEpochIdentity.positionEpoch,
    17 + (result.completedStepCount - 1)
  );
  assert.equal(result.gpuFence.terminalScheduleFence, true);
  assert.equal(result.gpuFence.fenceSatisfied, true);
  assert.equal(result.gpuFence.completedStepCount, 1);
  assert.equal(fixture.device.queue.submittedWorkDoneCount, 1);
  assertNoWorkerGpuBuffers(result, 'cancelledScheduleResult');
  structuredClone(result);

  // The lane is still usable by a follow-up single-stage message: the last
  // completed step consumed its epoch and retained its post-step buffers.
  const followUp = await runUlgMechanicsResidentStageWorkerPayload(payload(
    stage(
      'schroederSpatialEpoch',
      ['schroeder-level-assignment'],
      ['schroeder-spatial-epoch']
    ),
    workerSchroederStageContext(fixture.device, fixture.buffers, {
      schroederSpatialEpoch: {
        levelAssignment: fixture.levelAssignmentForStep(result.completedStepCount + 1),
        useWorkerRetainedParticleBuffers: true,
        particleIdentityStrideWords: 1,
        selectedLevel: 0,
        mechanicsGrid: fixture.mechanicsGrid,
        exactNearCellTreeEnabled: false
      }
    }),
    null,
    laneOptions
  ));
  assert.equal(followUp.value.status, 'worker-schroeder-spatial-epoch-retained');
  assert.equal(
    followUp.value.levelAssignmentSource,
    'stage-option-level-assignment-with-worker-retained-particle-buffers'
  );
});

test('ULG partial cancellation emits only unmeasured watch uncertainty and burns it exactly once', async () => {
  const device = createFakeGpuDevice();
  const buffers = lawsQuiescentSingleLaneBuffers();
  const laneOptions = {
    laneId: 'ulg:test:cancelled-reaction-watch-lane',
    stateKey: 'ulg:test:cancelled-reaction-watch-state'
  };
  const reactionTable = thermalPhaseLatchReactionWatchTable();
  try {
    await runUlgMechanicsResidentStageWorkerPayload(payload(
      workerLaneSeedStage(),
      workerSchroederStageContext(device, buffers, {
        schroederLaneSeed: workerLaneSeedStageOptions({
          hotBufferKey: 'ulg:sph-resident:cancelled-reaction-watch',
          particleCount: 1,
          rematerializationSeedOverrides: {
            identityRequired: true,
            identityRevision: 'cancelled-reaction-watch-identity',
            identitySchema: ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
            identityStrideBytes:
              SPH_GPU_PARTICLE_IDENTITY_UINTS
              * Uint32Array.BYTES_PER_ELEMENT,
            particleIdentityMutationApproved: true,
            requiresAuthoritativeFourBufferRows: true,
            outputParticleCapacity: 1
          }
        })
      }),
      null,
      laneOptions
    ));

    const classifierOptions = {
      minLevel: 0,
      maxLevel: 0,
      chartId: 0,
      baseGridSpacingM: 1
    };
    const laneProvider = createWorkerSchroederLaneLevelAssignmentProvider({
      ...laneOptions,
      classifierOptions,
      levelAssignmentRunner: runSchroederLevelAssignmentWebGpu
    });
    const mechanicsFixture = workerSeededMechanicsRunnerFixture(device, {
      labelPrefix: 'worker-cancelled-reaction-watch',
      particleCount: 1
    });
    const epochOptions = {
      selectedLevel: 0,
      mechanicsGrid: WORKER_SEED_MECHANICS_GRID,
      exactNearCellTreeEnabled: false,
      mechanicsFieldViewsRequired: false,
      scheduleStepOptionsProvider: laneProvider
    };
    const residentStepOptions = {
      contactSolverEnabled: true,
      ambientPressurePa: 0,
      reactionActivationWatchTable: reactionTable
    };
    const mechanicsOptions = {
      schroederSameLevelMechanicsRunner: mechanicsFixture.runner,
      residentStepOptions
    };
    const scheduleId = 'ulg:test:cancelled-reaction-watch-schedule';
    const targetScheduleAuthority = workerTargetScheduleAuthority({
      scheduleId,
      laneId: laneOptions.laneId,
      stateKey: laneOptions.stateKey,
      stepCount: 3,
      residentStepOptions,
      epochOptions,
      mechanicsOptions,
      providerKind: 'worker-lane-assignment-only',
      classifierOptions
    });
    const cancellationChannel = new MessageChannel();
    let cancellationAck = null;
    cancellationChannel.port1.onmessage = () => {
      cancellationAck =
        cancelUlgMechanicsResidentStageWorkerSchedule(scheduleId);
    };
    cancellationChannel.port1.start?.();
    let result;
    try {
      result = await runUlgMechanicsResidentStageWorkerSchedulePayload(
        schedulePayload(
          workerSchroederStageContext(device, buffers, {
            schroederSpatialEpoch: epochOptions,
            schroederSameLevelMechanics: mechanicsOptions
          }),
          {
            stepCount: 3,
            scheduleId,
            targetScheduleAuthority: structuredClone(targetScheduleAuthority)
          },
          laneOptions
        ),
        {
          postProgress(progress) {
            if (progress.stepOrdinal === 1) {
              cancellationChannel.port2.postMessage(null);
            }
          }
        }
      );
    } finally {
      cancellationChannel.port1.close();
      cancellationChannel.port2.close();
    }
    assert.equal(cancellationAck?.cancelRequested, true);
    assert.equal(result.status, 'worker-resident-schedule-cancelled');
    assert.equal(result.cancelled, true);
    assert.equal(result.completedStepCount, 1);
    assert.equal(result.controlPlaneYieldReceipt.yieldRequestCount, 1);
    assert.equal(result.controlPlaneYieldReceipt.completedYieldCount, 1);
    assert.equal(
      result.controlPlaneYieldReceipt.cancellationObservedAfterYield,
      true
    );
    assert.equal(
      result.controlPlaneYieldReceipt.cancellationObservedBeforeStepOrdinal,
      2
    );
    assert.equal(result.controlPlaneYieldReceipt.portsClosed, true);
    const observation = result.nextScheduleLawActivationObservation;
    assert.equal(observation.observationSucceeded, false);
    assert.equal(observation.uncertainty, true);
    assert.equal(observation.triggered, true);
    assert.equal(observation.triggeredSourceCount, null);
    assert.equal(observation.rawEvidenceWord, null);
    assert.equal(observation.mapAsyncCount, 0);
    assert.equal(observation.readbackByteLength, 0);
    assert.equal(
      observation.routingAuthority,
      SCHROEDER_DYNAMIC_LAW_ROUTING_AUTHORITY
    );
    assert.equal(
      observation.shadowOnly,
      SCHROEDER_DYNAMIC_LAW_ROUTING_SHADOW_ONLY
    );
    validateSchroederWorkerScheduleExecutionRouteReceipt(result, {
      scheduleId,
      laneId: laneOptions.laneId,
      stateKey: laneOptions.stateKey,
      requestedStepCount: 3,
      targetScheduleAuthority
    });

    const continuationScheduleId = observation.targetScheduleRequestId;
    let continuationAssignmentOrdinal = 0;
    const continuationLaneProvider =
      createWorkerSchroederLaneLevelAssignmentProvider({
        ...laneOptions,
        classifierOptions,
        async levelAssignmentRunner(args) {
          continuationAssignmentOrdinal += 1;
          const sphUpload = args.sphParticleUpload;
          return workerSchroederLevelAssignmentFixture(device, {
            particleCount: sphUpload.particleCount,
            storageGeneration: sphUpload.storageGeneration,
            physicsTick: sphUpload.physicsTick,
            physicsSubstep: sphUpload.physicsSubstep,
            positionEpoch: sphUpload.positionEpoch,
            topologyEpoch: sphUpload.topologyEpoch,
            chartEpoch: sphUpload.chartEpoch,
            levelEpoch: sphUpload.levelEpoch,
            supportEpoch: sphUpload.supportEpoch,
            sourceStateBuffer: sphUpload.stateBuffer,
            sourceThermoBuffer: sphUpload.thermoBuffer,
            sourceMechanicsBuffer:
              args.mlsMpmParticleUpload.mechanicsBuffer,
            label:
              `worker-cancelled-watch-continuation-${
                continuationAssignmentOrdinal
              }`
          });
        }
      });
    const continuationEpochOptions = {
      ...epochOptions,
      scheduleStepOptionsProvider: continuationLaneProvider
    };
    const continuationAuthority = workerTargetScheduleAuthority({
      scheduleId: continuationScheduleId,
      laneId: laneOptions.laneId,
      stateKey: laneOptions.stateKey,
      sourceLineage: result.finalMechanicsLineage,
      predecessorDynamicLawObservation: observation,
      stepCount: 3,
      residentStepOptions,
      epochOptions: continuationEpochOptions,
      mechanicsOptions,
      providerKind: 'worker-lane-assignment-only',
      classifierOptions
    });
    const continuation =
      await runUlgMechanicsResidentStageWorkerSchedulePayload(
        schedulePayload(
          workerSchroederStageContext(device, buffers, {
            schroederSpatialEpoch: continuationEpochOptions,
            schroederSameLevelMechanics: mechanicsOptions
          }),
          {
            stepCount: 3,
            scheduleId: continuationScheduleId,
            targetScheduleAuthority: structuredClone(continuationAuthority)
          },
          laneOptions
        )
      );
    assert.equal(
      continuation.predecessorTargetTokenConsumption
        .targetScheduleRequestId,
      continuationScheduleId
    );
    assert.equal(
      continuation.predecessorTargetTokenConsumption
        .conservativeActivationRequired,
      false,
      'a cancelled partial schedule burns its dormant continuation token without authorizing conservative activation'
    );
    const runnerCallCount = mechanicsFixture.runnerCalls.length;
    await assert.rejects(
      runUlgMechanicsResidentStageWorkerSchedulePayload(
        schedulePayload(
          workerSchroederStageContext(device, buffers, {
            schroederSpatialEpoch: continuationEpochOptions,
            schroederSameLevelMechanics: mechanicsOptions
          }),
          {
            stepCount: 3,
            scheduleId: continuationScheduleId,
            targetScheduleAuthority: structuredClone(continuationAuthority)
          },
          laneOptions
        )
      ),
      /predecessor-target-token-replayed/
    );
    assert.equal(mechanicsFixture.runnerCalls.length, runnerCallCount);
  } finally {
    releaseUlgMechanicsResidentStageWorkerLane(laneOptions);
  }
});

test('ULG resident stage worker schedule aborts fail-closed on a mid-batch stage error and stays consistent', async (t) => {
  const messageChannelStats = instrumentResidentScheduleMessageChannels(t);
  const fixture = workerScheduleFixture({ laneSuffix: 'fail', failAtStep: 2 });
  const laneOptions = {
    laneId: 'ulg:test:schroeder-schedule-fail-lane',
    stateKey: 'ulg:test:schroeder-schedule-fail-state'
  };
  const progressEnvelopes = [];
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerSchedulePayload(
      schedulePayload(
        workerSchroederStageContext(fixture.device, fixture.buffers, fixture.stageOptions),
        { stepCount: 3, scheduleId: 'ulg:test:schedule-fail' },
        laneOptions
      ),
      { postProgress: (progress) => progressEnvelopes.push(progress) }
    ),
    (error) => {
      const detail = error.residentScheduleError;
      assert.ok(detail, 'schedule errors carry a cloneable residentScheduleError');
      assert.equal(detail.scheduleId, 'ulg:test:schedule-fail');
      assert.equal(detail.stepOrdinal, 2);
      assert.match(detail.message, /injected mechanics failure at schedule step 2/);
      // The W1 finally-block released leases and the driver released the
      // step's unconsumed epoch: the lane snapshot is consistent.
      assert.equal(detail.laneState.epochConsumed, true);
      assert.equal(detail.laneState.epochReleasedWithoutMechanicsStep, true);
      assert.equal(detail.laneState.postStepUploadsRetained, true);
      assert.equal(detail.terminalGpuFence.terminalScheduleFence, true);
      assert.equal(detail.terminalGpuFence.fenceSatisfied, true);
      assert.equal(detail.terminalGpuFence.completedStepCount, 1);
      assert.equal(detail.terminalGpuFenceSatisfied, true);
      assert.equal(
        detail.controlPlaneYieldReceipt.schema,
        ULG_WORKER_RESIDENT_SCHEDULE_CONTROL_PLANE_YIELD_RECEIPT_SCHEMA
      );
      assert.equal(detail.controlPlaneYieldReceipt.yieldRequestCount, 1);
      assert.equal(detail.controlPlaneYieldReceipt.completedYieldCount, 1);
      assert.equal(detail.controlPlaneYieldReceipt.messageChannelYieldCount, 1);
      assert.equal(detail.controlPlaneYieldReceipt.closedPortCount, 2);
      assert.equal(detail.controlPlaneYieldReceipt.portsClosed, true);
      assertNoWorkerGpuBuffers(detail, 'residentScheduleError');
      structuredClone(detail);
      return true;
    }
  );
  assert.equal(progressEnvelopes.length, 1);
  assert.equal(fixture.runnerCalls.length, 2);
  assert.equal(fixture.device.queue.submittedWorkDoneCount, 1);
  assert.equal(messageChannelStats.constructionCount, 1);
  assert.equal(messageChannelStats.port1CloseCount, 1);
  assert.equal(messageChannelStats.port2CloseCount, 1);

  // A follow-up single 'run-resident-stage' epoch message on the same lane
  // still works: the aborted schedule left no pinned unconsumed epoch.
  const followUp = await runUlgMechanicsResidentStageWorkerPayload(payload(
    stage(
      'schroederSpatialEpoch',
      ['schroeder-level-assignment'],
      ['schroeder-spatial-epoch']
    ),
    workerSchroederStageContext(fixture.device, fixture.buffers, {
      schroederSpatialEpoch: {
        levelAssignment: fixture.levelAssignmentForStep(2),
        useWorkerRetainedParticleBuffers: true,
        particleIdentityStrideWords: 1,
        selectedLevel: 0,
        mechanicsGrid: fixture.mechanicsGrid,
        exactNearCellTreeEnabled: false
      }
    }),
    null,
    laneOptions
  ));
  assert.equal(followUp.value.status, 'worker-schroeder-spatial-epoch-retained');
  assert.equal(
    followUp.value.levelAssignmentSource,
    'stage-option-level-assignment-with-worker-retained-particle-buffers'
  );
});

test('ULG canonical schedule closes its unused yielder after a first-step stage failure', async (t) => {
  const messageChannelStats = instrumentResidentScheduleMessageChannels(t);
  const fixture = workerScheduleFixture({
    laneSuffix: 'first-step-fail',
    failAtStep: 1
  });
  const laneOptions = {
    laneId: 'ulg:test:first-step-fail-lane',
    stateKey: 'ulg:test:first-step-fail-state'
  };
  try {
    await assert.rejects(
      runUlgMechanicsResidentStageWorkerSchedulePayload(
        schedulePayload(
          workerSchroederStageContext(
            fixture.device,
            fixture.buffers,
            fixture.stageOptions
          ),
          { stepCount: 3, scheduleId: 'ulg:test:first-step-fail' },
          laneOptions
        )
      ),
      (error) => {
        const receipt = error.residentScheduleError?.controlPlaneYieldReceipt;
        assert.equal(error.residentScheduleError?.stepOrdinal, 1);
        assert.equal(receipt?.scheduledYieldOpportunityCount, 2);
        assert.equal(receipt?.yieldRequestCount, 0);
        assert.equal(receipt?.completedYieldCount, 0);
        assert.equal(receipt?.messageChannelCreated, true);
        assert.equal(receipt?.closedPortCount, 2);
        assert.equal(receipt?.portsClosed, true);
        assert.equal(receipt?.cancellationObservedAfterYield, false);
        return true;
      }
    );
    assert.equal(messageChannelStats.constructionCount, 1);
    assert.equal(messageChannelStats.port1CloseCount, 1);
    assert.equal(messageChannelStats.port2CloseCount, 1);
  } finally {
    releaseUlgMechanicsResidentStageWorkerLane(laneOptions);
  }
});

test('ULG resident stage worker schedule fails closed when a step does not advance the epoch identity', async () => {
  const fixture = workerScheduleFixture({ laneSuffix: 'stale' });
  // A provider that hands step 2 the SAME identity words as step 1 models a
  // scheduler trying to amortize by reusing a stale position epoch.
  fixture.stageOptions.schroederSpatialEpoch.scheduleStepOptionsProvider = () => ({
    levelAssignment: fixture.levelAssignmentForStep(1),
    particleIdentityStrideWords: 1
  });
  const laneOptions = {
    laneId: 'ulg:test:schroeder-schedule-stale-lane',
    stateKey: 'ulg:test:schroeder-schedule-stale-state'
  };
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerSchedulePayload(
      schedulePayload(
        workerSchroederStageContext(fixture.device, fixture.buffers, fixture.stageOptions),
        { stepCount: 2, scheduleId: 'ulg:test:schedule-stale' },
        laneOptions
      )
    ),
    (error) => {
      assert.match(error.message, /epoch-identity-regressed/);
      assert.equal(error.residentScheduleError.stepOrdinal, 2);
      assert.equal(error.residentScheduleError.reason, 'epoch-identity-regressed');
      assert.equal(error.residentScheduleError.laneState.epochConsumed, true);
      assert.equal(
        error.residentScheduleError.terminalGpuFence.terminalScheduleFence,
        true
      );
      assert.equal(
        error.residentScheduleError.terminalGpuFence.fenceSatisfied,
        true
      );
      return true;
    }
  );
  // Only step 1's mechanics ran; the stale step-2 generation was released
  // before it could feed a mechanics step, and the lane stays usable.
  assert.equal(fixture.runnerCalls.length, 1);
  assert.equal(fixture.device.queue.submittedWorkDoneCount, 1);
  const followUp = await runUlgMechanicsResidentStageWorkerPayload(payload(
    stage(
      'schroederSpatialEpoch',
      ['schroeder-level-assignment'],
      ['schroeder-spatial-epoch']
    ),
    workerSchroederStageContext(fixture.device, fixture.buffers, {
      schroederSpatialEpoch: {
        levelAssignment: fixture.levelAssignmentForStep(2),
        useWorkerRetainedParticleBuffers: true,
        particleIdentityStrideWords: 1,
        selectedLevel: 0,
        mechanicsGrid: fixture.mechanicsGrid,
        exactNearCellTreeEnabled: false
      }
    }),
    null,
    laneOptions
  ));
  assert.equal(followUp.value.status, 'worker-schroeder-spatial-epoch-retained');
});

test('ULG resident stage worker schedule rejects a failed terminal queue fence', async (t) => {
  const messageChannelStats = instrumentResidentScheduleMessageChannels(t);
  const fixture = workerScheduleFixture({ laneSuffix: 'terminal-fence-fail' });
  fixture.device.queue.onSubmittedWorkDone = () => Promise.reject(
    new Error('injected terminal queue fence rejection')
  );
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerSchedulePayload(
      schedulePayload(
        workerSchroederStageContext(
          fixture.device,
          fixture.buffers,
          fixture.stageOptions
        ),
        { stepCount: 2, scheduleId: 'ulg:test:schedule-terminal-fence-fail' },
        {
          laneId: 'ulg:test:schedule-terminal-fence-fail-lane',
          stateKey: 'ulg:test:schedule-terminal-fence-fail-state'
        }
      )
    ),
    (error) => {
      assert.equal(
        error.residentScheduleError?.reason,
        'schedule-terminal-gpu-fence-unsatisfied'
      );
      assert.equal(
        error.residentScheduleError?.terminalGpuFence?.terminalScheduleFence,
        true
      );
      assert.equal(
        error.residentScheduleError?.terminalGpuFence?.fenceSatisfied,
        false
      );
      assert.match(
        error.residentScheduleError?.terminalGpuFence?.queueCompletionErrorMessage,
        /injected terminal queue fence rejection/
      );
      assert.equal(
        error.residentScheduleError?.controlPlaneYieldReceipt
          ?.yieldRequestCount,
        1
      );
      assert.equal(
        error.residentScheduleError?.controlPlaneYieldReceipt
          ?.completedYieldCount,
        1
      );
      assert.equal(
        error.residentScheduleError?.controlPlaneYieldReceipt
          ?.messageChannelYieldCount,
        1
      );
      assert.equal(
        error.residentScheduleError?.controlPlaneYieldReceipt?.closedPortCount,
        2
      );
      assert.equal(
        error.residentScheduleError?.controlPlaneYieldReceipt?.portsClosed,
        true
      );
      return true;
    }
  );
  assert.equal(messageChannelStats.constructionCount, 1);
  assert.equal(messageChannelStats.port1CloseCount, 1);
  assert.equal(messageChannelStats.port2CloseCount, 1);
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerSchedulePayload(
      schedulePayload(
        workerSchroederStageContext(
          fixture.device,
          fixture.buffers,
          fixture.stageOptions
        ),
        {
          stepCount: 1,
          scheduleId: 'ulg:test:schedule-terminal-fence-fail-reuse'
        },
        {
          laneId: 'ulg:test:schedule-terminal-fence-fail-lane',
          stateKey: 'ulg:test:schedule-terminal-fence-fail-state'
        }
      )
    ),
    /lane-terminal-fence-poisoned/
  );
});

test('ULG resident stage worker refuses a concurrent schedule on one lane fail-closed', async () => {
  const fixture = workerScheduleFixture({ laneSuffix: 'concurrent' });
  const laneOptions = {
    laneId: 'ulg:test:schroeder-schedule-concurrent-lane',
    stateKey: 'ulg:test:schroeder-schedule-concurrent-state'
  };
  const context = workerSchroederStageContext(
    fixture.device,
    fixture.buffers,
    fixture.stageOptions
  );
  const first = runUlgMechanicsResidentStageWorkerSchedulePayload(
    schedulePayload(
      context,
      { stepCount: 2, scheduleId: 'ulg:test:schedule-concurrent-a' },
      laneOptions
    )
  );
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerSchedulePayload(
      schedulePayload(
        context,
        { stepCount: 1, scheduleId: 'ulg:test:schedule-concurrent-b' },
        laneOptions
      )
    ),
    /lane-schedule-already-active/
  );
  const firstResult = await first;
  assert.equal(firstResult.status, 'worker-resident-schedule-completed');
  assert.equal(firstResult.completedStepCount, 2);
  // The refusal was per-active-schedule, not permanent: the lane admits a
  // new schedule once the first completes.
  const second = await runUlgMechanicsResidentStageWorkerSchedulePayload(
    schedulePayload(
      context,
      { stepCount: 1, scheduleId: 'ulg:test:schedule-concurrent-c' },
      laneOptions
    )
  );
  assert.equal(second.status, 'worker-resident-schedule-completed');
  assert.equal(second.completedStepCount, 1);
});

test('ULG resident stage worker refuses schedules with invalid or over-cap step counts', async () => {
  assert.equal(ULG_WORKER_RESIDENT_SCHEDULE_MAX_STEP_COUNT, 128);
  const fixture = workerScheduleFixture({ laneSuffix: 'cap' });
  const laneOptions = {
    laneId: 'ulg:test:schroeder-schedule-cap-lane',
    stateKey: 'ulg:test:schroeder-schedule-cap-state'
  };
  const context = workerSchroederStageContext(
    fixture.device,
    fixture.buffers,
    fixture.stageOptions
  );
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerSchedulePayload(schedulePayload(
      context,
      {
        stepCount: ULG_WORKER_RESIDENT_SCHEDULE_MAX_STEP_COUNT + 1,
        scheduleId: 'ulg:test:schedule-over-cap'
      },
      laneOptions
    )),
    /schedule-step-count-over-cap/
  );
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerSchedulePayload(schedulePayload(
      context,
      { stepCount: 0, scheduleId: 'ulg:test:schedule-zero' },
      laneOptions
    )),
    /schedule-step-count-invalid/
  );
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerSchedulePayload(schedulePayload(
      context,
      { scheduleId: 'ulg:test:schedule-missing-count' },
      laneOptions
    )),
    /schedule-step-count-invalid/
  );
  // The refusals left no active-schedule registration behind: a valid
  // schedule on the same lane runs to completion.
  const result = await runUlgMechanicsResidentStageWorkerSchedulePayload(
    schedulePayload(
      context,
      { stepCount: 1, scheduleId: 'ulg:test:schedule-cap-valid' },
      laneOptions
    )
  );
  assert.equal(result.status, 'worker-resident-schedule-completed');
  assert.equal(result.completedStepCount, 1);
});

// --- SS worker-lane seed stage (refactor increment W4a) ---
// A fresh worker lane starts an SS schedule from a structured-cloneable seed
// descriptor: the W1 adopted-storage rematerialization rebuilds the four
// particle-storage buffers on the worker device, the caller-supplied lineage
// words are stamped onto those uploads, the REAL
// resolveSchroederParticleBufferFamilyGeneration verdict gates the seed, and
// the REAL runSchroederLevelAssignmentWebGpu runs on the fake device (the
// injectable stageOptions.schroederLaneSeed.levelAssignmentRunner seam is
// exercised only by the device-mismatch refusal below).

const WORKER_LANE_SEED_DEFAULT_LINEAGE = Object.freeze({
  storageGeneration: 11,
  physicsTick: 13,
  physicsSubstep: 0,
  positionEpoch: 17,
  topologyEpoch: 19,
  chartEpoch: 23,
  levelEpoch: 29,
  supportEpoch: 31
});

function workerTargetScheduleAuthority({
  scheduleId,
  targetScheduleRequestId = `${scheduleId}:next-law-route`,
  laneId,
  stateKey,
  sourceLineage = WORKER_LANE_SEED_DEFAULT_LINEAGE,
  sourceParticleCount = 1,
  sourcePhaseLaneCount = 1,
  predecessorDynamicLawObservation = null,
  predecessorTargetScheduleAuthority = null,
  prospectiveTargetConfiguration = null,
  stepCount,
  residentStepOptions,
  epochOptions,
  mechanicsOptions,
  providerKind = 'none',
  classifierOptions = null,
  dtS = 0.1,
  gridSpacingM = 1,
  cflFactor = 10,
  boxDimsM = [5, 5, 5]
}) {
  const persistedResidentStepOptions = {
    ...(residentStepOptions || {}),
    thermalStepOptions: {
      ...(residentStepOptions?.thermalStepOptions || {})
    },
    reactionStepOptions: {
      ...(residentStepOptions?.reactionStepOptions || {})
    },
    mechanicsRefreshOptions: {
      ...(residentStepOptions?.mechanicsRefreshOptions || {})
    }
  };
  return createSchroederTargetScheduleAuthority({
    sourceScheduleId: scheduleId,
    targetScheduleRequestId,
    laneId,
    stateKey,
    sourceLineage,
    sourceParticleCount,
    sourcePhaseLaneCount,
    predecessorDynamicLawObservation,
    predecessorTargetScheduleAuthority,
    prospectiveTargetConfiguration,
    maxFutureSubsteps: stepCount,
    dtS,
    gridSpacingM,
    cflFactor,
    boxDimsM,
    residentStepOptions: persistedResidentStepOptions,
    epochOptions,
    mechanicsOptions,
    hierarchyConfig: mechanicsOptions?.hierarchyConfig ?? null,
    particleGasLedgerActionable:
      residentStepOptions?.particleGasLedgerActionable === true,
    scheduleStepOptionsProvider:
      createSchroederTargetScheduleProviderAuthority({
        kind: providerKind,
        classifierOptions
      })
  });
}

function workerLaneSeedStage() {
  return stage(
    'schroederLaneSeed',
    ['sph-particle-state', 'mls-mpm-mechanics'],
    ['schroeder-level-assignment']
  );
}

function workerLaneSeedStageOptions({
  hotBufferKey = 'ulg:sph-resident-schroeder-adopted-storage:lane-seed',
  particleCount = 1,
  lineage = WORKER_LANE_SEED_DEFAULT_LINEAGE,
  seedOptionOverrides = {},
  rematerializationSeedOverrides = {}
} = {}) {
  return {
    useSchroederAdoptedParticleStorageWorkerRematerialization: true,
    schroederAdoptedParticleStorageWorkerRematerializationSeed: {
      schema: 'peercompute.ulg.schroeder-adopted-particle-storage-portable-materialization-seed.v0',
      status: 'schroeder-adopted-particle-storage-portable-materialization-seed-ready',
      ready: true,
      hotBufferKey,
      authoritativeParticleCount: particleCount,
      materializationMode: 'peer-local-gpu-rematerialization-from-descriptor-seed',
      ...rematerializationSeedOverrides
    },
    schroederLaneSeed: {
      ...(lineage ? { lineage: { ...lineage } } : {}),
      minLevel: 0,
      maxLevel: 0,
      chartId: 0,
      baseGridSpacingM: 1,
      ...seedOptionOverrides
    }
  };
}

function workerSeededMechanicsRunnerFixture(device, {
  labelPrefix,
  particleCount = 1,
  capacityParticleCount = particleCount
}) {
  const particleCapacity = Math.max(particleCount, capacityParticleCount);
  const taggedBuffer = (label, size) => tagWebGpuBufferDevice(
    device.createBuffer({ label, size, usage: 128 | 8 }),
    device
  );
  const runnerCalls = [];
  const residentProductMasses = [];
  const runner = async (args) => {
    runnerCalls.push(args);
    const ordinal = runnerCalls.length;
    const sourceLineage = Object.fromEntries(
      ULG_WORKER_SCHROEDER_LANE_SEED_LINEAGE_WORD_FIELDS.map(
        (field) => [field, Number(args.sphParticleUpload?.[field])]
      )
    );
    const terminalLineage = Object.values(sourceLineage).every(
      Number.isSafeInteger
    )
      ? {
          ...sourceLineage,
          storageGeneration: sourceLineage.storageGeneration + 1,
          physicsTick: sourceLineage.physicsTick + 1,
          physicsSubstep: 0,
          positionEpoch: sourceLineage.positionEpoch + 1
        }
      : null;
    const residentProductMass = {
      schema: 'peercompute.ulg.test-worker-resident-product-mass.v0',
      ordinal
    };
    residentProductMasses.push(residentProductMass);
    return {
      status: 'schroeder-same-level-mechanics-completed',
      selectedLevel: 0,
      residentStep: {
        backend: 'webgpu',
        status: 'resident-step-completed',
        readbackMode: 'no-full-readback',
        stageStatus: { p2g: 'completed', g2p: 'completed' },
        stageBackends: { p2g: 'webgpu', g2p: 'webgpu' },
        residentProductMass,
        nextParticleUploads: {
          sphParticleUpload: {
            schema: ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
            status: 'webgpu-uploaded',
            particleCount,
            ...(terminalLineage || {}),
            ...(terminalLineage
              ? {
                  bufferFamilyGeneration:
                    terminalLineage.storageGeneration
                }
              : {}),
            stateBuffer: taggedBuffer(
              `${labelPrefix}-next-state-${ordinal}`,
              particleCapacity * 8 * Float32Array.BYTES_PER_ELEMENT
            ),
            stateStrideBytes: 8 * Float32Array.BYTES_PER_ELEMENT,
            stateBufferByteLength:
              particleCapacity * 8 * Float32Array.BYTES_PER_ELEMENT,
            thermoBuffer: taggedBuffer(
              `${labelPrefix}-next-thermo-${ordinal}`,
              particleCapacity * 12 * Float32Array.BYTES_PER_ELEMENT
            ),
            thermoStrideBytes: 12 * Float32Array.BYTES_PER_ELEMENT,
            thermoBufferByteLength:
              particleCapacity * 12 * Float32Array.BYTES_PER_ELEMENT,
            identityBuffer: taggedBuffer(
              `${labelPrefix}-next-identity-${ordinal}`,
              particleCapacity * Uint32Array.BYTES_PER_ELEMENT
            ),
            identityRequired: true,
            identitySchema: ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
            identityStrideBytes:
              SPH_GPU_PARTICLE_IDENTITY_UINTS
              * Uint32Array.BYTES_PER_ELEMENT,
            identityBufferByteLength:
              particleCapacity * Uint32Array.BYTES_PER_ELEMENT,
            identityRevision: `${labelPrefix}-identity`
          },
          mlsMpmParticleUpload: {
            schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
            status: 'webgpu-uploaded',
            particleCount,
            ...(terminalLineage || {}),
            ...(terminalLineage
              ? {
                  bufferFamilyGeneration:
                    terminalLineage.storageGeneration
                }
              : {}),
            mechanicsBuffer: taggedBuffer(
              `${labelPrefix}-next-mechanics-${ordinal}`,
              particleCapacity * 32 * Float32Array.BYTES_PER_ELEMENT
            ),
            mechanicsStrideBytes:
              32 * Float32Array.BYTES_PER_ELEMENT,
            mechanicsBufferByteLength:
              particleCapacity * 32 * Float32Array.BYTES_PER_ELEMENT
          }
        }
      },
      schroederSpatialEpochReleasePromise: Promise.resolve(true),
      currentSchroederSpatialEpochGenerationSummary: () => ({
        status: 'synthetic-generation-summary'
      })
    };
  };
  return { runner, runnerCalls, residentProductMasses };
}

const WORKER_SEED_MECHANICS_GRID = Object.freeze({
  selectedLevel: 0,
  gridDims: [2, 2, 2],
  gridNodeCount: 8,
  gridShift: 1,
  gridSpacingM: 1
});

test('ULG resident stage worker seeds a fresh SS lane from a cloneable descriptor and a 2-step schedule advances beyond the seeded lineage', async () => {
  // The W4b scene hand-off contract: exactly these words, every one REQUIRED.
  assert.deepEqual([...ULG_WORKER_SCHROEDER_LANE_SEED_LINEAGE_WORD_FIELDS], [
    'storageGeneration',
    'physicsTick',
    'physicsSubstep',
    'positionEpoch',
    'topologyEpoch',
    'chartEpoch',
    'levelEpoch',
    'supportEpoch'
  ]);
  const device = createFakeGpuDevice();
  const buffers = manualBuffers();
  const particleCount = 1;
  const laneOptions = {
    laneId: 'ulg:test:schroeder-seed-schedule-lane',
    stateKey: 'ulg:test:schroeder-seed-schedule-state'
  };
  const seedLineage = WORKER_LANE_SEED_DEFAULT_LINEAGE;

  const seeded = await runUlgMechanicsResidentStageWorkerPayload(payload(
    workerLaneSeedStage(),
    workerSchroederStageContext(device, buffers, {
      schroederLaneSeed: workerLaneSeedStageOptions({
        hotBufferKey: 'ulg:sph-resident-schroeder-adopted-storage:seed-schedule',
        particleCount
      })
    }),
    null,
    laneOptions
  ));
  assert.equal(seeded.value.schema, ULG_WORKER_SCHROEDER_LANE_SEED_STAGE_SCHEMA);
  assert.equal(seeded.value.status, 'worker-schroeder-lane-seeded');
  assert.equal(seeded.value.laneSeeded, true);
  assert.equal(seeded.value.seedRetainedInLane, true);
  // The REAL family resolver's verdict, published truthfully.
  assert.equal(
    seeded.value.bufferFamilyGenerationStatus,
    'schroeder-particle-buffer-family-generation-ready'
  );
  assert.equal(seeded.value.bufferFamilyGeneration.ready, true);
  assert.equal(
    seeded.value.bufferFamilyGeneration.storageGeneration,
    seedLineage.storageGeneration
  );
  // The REAL level-assignment runner executed on the fake device (no seam).
  assert.equal(
    seeded.value.levelAssignmentRunnerSource,
    'real-runSchroederLevelAssignmentWebGpu'
  );
  assert.equal(
    seeded.value.levelAssignmentSummary.status,
    'schroeder-level-assignment-submitted'
  );
  assert.equal(
    seeded.value.levelAssignmentSummary.bufferFamilyGenerationStatus,
    'schroeder-particle-buffer-family-generation-ready'
  );
  assert.equal(seeded.value.levelAssignmentSummary.assignmentStrideFloats, 16);
  for (const field of ULG_WORKER_SCHROEDER_LANE_SEED_LINEAGE_WORD_FIELDS) {
    assert.equal(
      seeded.value.levelAssignmentSummary[field],
      seedLineage[field],
      `seeded assignment lineage word ${field}`
    );
  }
  assert.deepEqual(seeded.value.seedLineage, { ...seedLineage });
  assert.equal(
    seeded.value.workerResidentStage.workerAdoptedStorageRematerializationApplied,
    true
  );
  assert.match(seeded.value.seedLevelAssignmentBufferRef.ref, /^ulg-worker:/);
  assert.ok(seeded.retainedBufferRefs.includes(
    seeded.value.seedLevelAssignmentBufferRef.ref
  ));
  assert.equal(seeded.value.gpuFence.fenceSatisfied, true);
  assertNoWorkerGpuBuffers(seeded, 'seeded');
  structuredClone(seeded.value);

  // 2-step schedule: step 1 consumes the seeded assignment; step 2 continues
  // from the kernel-committed stand-in with advanced identity words.
  const continuationAssignment = workerSchroederLevelAssignmentFixture(device, {
    particleCount,
    storageGeneration: seedLineage.storageGeneration + 1,
    physicsTick: seedLineage.physicsTick + 1,
    positionEpoch: seedLineage.positionEpoch + 1,
    sourceStateBuffer: null,
    label: 'worker-ss-seeded-step2'
  });
  const mechanicsFixture = workerSeededMechanicsRunnerFixture(device, {
    labelPrefix: 'worker-ss-seeded-schedule',
    particleCount
  });
  const progressEnvelopes = [];
  const scheduleResult = await runUlgMechanicsResidentStageWorkerSchedulePayload(
    schedulePayload(
      workerSchroederStageContext(device, buffers, {
        schroederSpatialEpoch: {
          selectedLevel: 0,
          mechanicsGrid: WORKER_SEED_MECHANICS_GRID,
          exactNearCellTreeEnabled: false,
          scheduleStepOptionsProvider: () => ({
            levelAssignment: continuationAssignment
          })
        },
        schroederSameLevelMechanics: {
          schroederSameLevelMechanicsRunner: mechanicsFixture.runner
        }
      }),
      { stepCount: 2, scheduleId: 'ulg:test:seeded-schedule' },
      laneOptions
    ),
    { postProgress: (progress) => progressEnvelopes.push(progress) }
  );
  assert.equal(scheduleResult.status, 'worker-resident-schedule-completed');
  assert.equal(scheduleResult.completedStepCount, 2);
  assert.equal(scheduleResult.executionRouteReceipt.route, 'canonical-schroeder');
  assert.ok(
    scheduleResult.executionRouteReceipt.blockers.includes(
      'phase-carrier-plan-not-single-lane-quiescent'
    ),
    'an absent phase plan cannot prove that Tier0 has no companion lanes'
  );
  assert.equal(mechanicsFixture.runnerCalls.length, 2);
  assert.equal(
    mechanicsFixture.runnerCalls[0].sphParticleState,
    buffers.sphParticleState,
    'the first mechanics step reuses the packed state cloned once by the seed'
  );
  assert.equal(
    mechanicsFixture.runnerCalls[0].mlsMpmParticleState,
    buffers.mlsMpmParticleState,
    'the first mechanics step reuses the mechanics state cloned once by the seed'
  );
  assert.equal(
    mechanicsFixture.runnerCalls[1].residentStepOptions.residentProductMass,
    mechanicsFixture.residentProductMasses[0],
    'the next step consumes the exact worker-local product-mass owner'
  );
  // Step 1 consumed the retained seeded assignment and carries EXACTLY the
  // seeded identity words.
  assert.equal(
    progressEnvelopes[0].stepSummary.levelAssignmentSource,
    'worker-lane-seeded-level-assignment'
  );
  assert.equal(
    progressEnvelopes[0].epochIdentity.physicsTick,
    seedLineage.physicsTick
  );
  assert.equal(
    progressEnvelopes[0].epochIdentity.positionEpoch,
    seedLineage.positionEpoch
  );
  assert.equal(
    progressEnvelopes[0].epochIdentity.storageGeneration,
    seedLineage.storageGeneration
  );
  // Step 2 (and the schedule's final identity) advanced beyond the seeded
  // lineage baseline.
  assert.equal(
    progressEnvelopes[1].stepSummary.levelAssignmentSource,
    'stage-option-level-assignment-with-worker-retained-particle-buffers'
  );
  assert.ok(
    scheduleResult.finalEpochIdentity.physicsTick > seedLineage.physicsTick
  );
  assert.ok(
    scheduleResult.finalEpochIdentity.positionEpoch > seedLineage.positionEpoch
  );
  assert.equal(
    scheduleResult.finalEpochIdentity.storageGeneration,
    seedLineage.storageGeneration + 1
  );
  const ring = scheduleResult.perStepSummaries.ring;
  assert.equal(ring.length, 2);
  assert.equal(ring[0].physicsTick, seedLineage.physicsTick);
  assert.equal(ring[0].positionEpoch, seedLineage.positionEpoch);
  assert.equal(ring[1].physicsTick, seedLineage.physicsTick + 1);
  assert.equal(ring[1].positionEpoch, seedLineage.positionEpoch + 1);
  // Step 1's mechanics consumed the seed-stamped rematerialized uploads and
  // the seeded execution itself; step 2 consumed step 1's post-step buffers.
  const stepOneArgs = mechanicsFixture.runnerCalls[0];
  assert.equal(
    stepOneArgs.sphParticleUpload.stateBuffer.label,
    'ulg-worker-adopted-storage-state'
  );
  assert.equal(
    stepOneArgs.sphParticleUpload.storageGeneration,
    seedLineage.storageGeneration
  );
  assert.equal(
    stepOneArgs.levelAssignment.bufferFamilyGenerationStatus,
    'schroeder-particle-buffer-family-generation-ready'
  );
  assert.equal(
    stepOneArgs.levelAssignment.storageGeneration,
    seedLineage.storageGeneration
  );
  assert.equal(
    stepOneArgs.spatialEpochGeneration.execution.storageGeneration,
    seedLineage.storageGeneration
  );
  const stepTwoArgs = mechanicsFixture.runnerCalls[1];
  assert.equal(
    stepTwoArgs.sphParticleUpload.stateBuffer.label,
    'worker-ss-seeded-schedule-next-state-1'
  );
  assert.equal(
    stepTwoArgs.spatialEpochGeneration.execution.positionEpoch,
    seedLineage.positionEpoch + 1
  );
  for (const ref of scheduleResult.retainedBufferRefs) {
    assert.match(ref, /^ulg-worker:/);
  }
  assertNoWorkerGpuBuffers(scheduleResult, 'seededScheduleResult');
  structuredClone(scheduleResult);
  progressEnvelopes.forEach((progress, index) => {
    assertNoWorkerGpuBuffers(progress, `seededProgress[${index}]`);
    structuredClone(progress);
  });
});

test('ULG worker schedule derives particle gas actionability from the exact current upload and enabled boundary policy', async () => {
  const device = createFakeGpuDevice();
  const buffers = lawsQuiescentSingleLaneBuffers();
  const laneOptions = {
    laneId: 'ulg:test:particle-gas-schedule-lane',
    stateKey: 'ulg:test:particle-gas-schedule-state'
  };
  try {
    await runUlgMechanicsResidentStageWorkerPayload(payload(
      workerLaneSeedStage(),
      workerSchroederStageContext(device, buffers, {
        schroederLaneSeed: workerLaneSeedStageOptions({
          hotBufferKey: 'ulg:sph-resident:particle-gas-schedule',
          particleCount: 1,
          rematerializationSeedOverrides: {
            identityRequired: true,
            identityRevision: 'particle-gas-schedule-identity',
            identitySchema: ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
            identityStrideBytes:
              SPH_GPU_PARTICLE_IDENTITY_UINTS
              * Uint32Array.BYTES_PER_ELEMENT,
            particleIdentityMutationApproved: true,
            requiresAuthoritativeFourBufferRows: true,
            outputParticleCapacity: 1
          }
        })
      }),
      null,
      laneOptions
    ));
    const residentStepOptions = {
      contactSolverEnabled: false,
      ambientPressurePa: 0,
      gasPressureMechanicsBoundaryEnabled: true,
      particleGasLedgerActionable: true
    };
    const epochOptions = {
      selectedLevel: 0,
      mechanicsGrid: WORKER_SEED_MECHANICS_GRID,
      exactNearCellTreeEnabled: false,
      mechanicsFieldViewsRequired: false
    };
    const mechanicsFixture = workerSeededMechanicsRunnerFixture(device, {
      labelPrefix: 'worker-particle-gas-schedule',
      particleCount: 1,
      capacityParticleCount: 2
    });
    const mechanicsOptions = {
      schroederSameLevelMechanicsRunner: mechanicsFixture.runner,
      residentStepOptions
    };
    const scheduleId = 'ulg:test:particle-gas-schedule';
    const targetScheduleAuthority = workerTargetScheduleAuthority({
      scheduleId,
      laneId: laneOptions.laneId,
      stateKey: laneOptions.stateKey,
      stepCount: 1,
      residentStepOptions,
      epochOptions,
      mechanicsOptions
    });
    const result = await runUlgMechanicsResidentStageWorkerSchedulePayload(
      schedulePayload(
        workerSchroederStageContext(device, buffers, {
          schroederSpatialEpoch: epochOptions,
          schroederSameLevelMechanics: mechanicsOptions
        }),
        {
          stepCount: 1,
          scheduleId,
          targetScheduleAuthority: structuredClone(targetScheduleAuthority)
        },
        laneOptions
      )
    );
    assert.equal(result.status, 'worker-resident-schedule-completed');
    assert.equal(
      targetScheduleAuthority.writerSet.particleGasLedgerActionable,
      true
    );
    assert.equal(
      targetScheduleAuthority.writerSet.retainedProductGasBoundaryActionable,
      false
    );
    assert.equal(targetScheduleAuthority.writerSet.gasBoundaryActionable, true);
    assert.equal(targetScheduleAuthority.writerSet.phaseVolumeSidecars, true);
    assert.equal(targetScheduleAuthority.writerSet.contactSolverRequested, false);
    assert.equal(
      targetScheduleAuthority.writerSet.contactSolverEscalatedForDynamicLaws,
      false
    );
    assert.equal(targetScheduleAuthority.writerSet.contactSolver, false);
    assert.equal(result.lawActivationReceipt.particleGasLedgerActionable, true);
    assert.equal(
      result.lawActivationReceipt.retainedProductGasBoundaryActionable,
      false
    );
    assert.equal(result.lawActivationReceipt.gasBoundaryActionable, true);
    assert.equal(result.lawActivationReceipt.phaseVolumeSidecars, true);
    assert.equal(result.lawActivationReceipt.contactSolverRequested, false);
    assert.equal(
      result.lawActivationReceipt.contactSolverEscalatedForDynamicLaws,
      false
    );
    assert.equal(result.lawActivationReceipt.contactSolver, false);
    assert.ok(
      result.executionRouteReceipt.blockers.includes(
        'gas-boundary-actionable'
      )
    );
    assert.equal(
      result.executionRouteReceipt.blockers.includes('contact-solver-active'),
      false
    );
    assert.equal(mechanicsFixture.runnerCalls.length, 1);
    assert.equal(
      mechanicsFixture.runnerCalls[0].residentStepOptions.contactSolverEnabled,
      false
    );
    assert.equal(
      mechanicsFixture.runnerCalls[0].residentStepOptions
        .gasPressureMechanicsBoundaryEnabled,
      true
    );
    assert.equal(
      mechanicsFixture.runnerCalls[0].residentStepOptions
        .particleGasLedgerActionable,
      true
    );
    assert.equal(
      mechanicsFixture.runnerCalls[0].spatialEpochGeneration
        .phaseVolumeSidecarsEnabled,
      true
    );

    const laneProvider = createWorkerSchroederLaneLevelAssignmentProvider({
      ...laneOptions,
      classifierOptions: {
        minLevel: 0,
        maxLevel: 0,
        chartId: 0,
        baseGridSpacingM: 1
      }
    });
    const continuationOptions = await laneProvider();
    assert.equal(
      continuationOptions.levelAssignment.status,
      'schroeder-level-assignment-submitted'
    );
    await runUlgMechanicsResidentStageWorkerPayload(payload(
      stage(
        'schroederSpatialEpoch',
        ['schroeder-level-assignment'],
        ['schroeder-spatial-epoch']
      ),
      workerSchroederStageContext(device, buffers, {
        schroederSpatialEpoch: {
          ...continuationOptions,
          useWorkerRetainedParticleBuffers: true,
          selectedLevel: 0,
          mechanicsGrid: WORKER_SEED_MECHANICS_GRID,
          exactNearCellTreeEnabled: false,
          mechanicsFieldViewsRequired: true,
          phaseVolumeSidecarsRequired: true
        }
      }),
      null,
      laneOptions
    ));
    const standaloneSpatial =
      await runUlgMechanicsResidentStageWorkerPayload(payload(
        stage(
          'spatialGasLedgerProducer',
          [
            'sph-particle-state',
            'sph-thermo-phase',
            'schroeder-spatial-epoch'
          ],
          ['resident-spatial-gas-species-ledger']
        ),
        workerSchroederStageContext(device, buffers, {
          spatialGasLedgerProducer: {}
        }),
        null,
        laneOptions
      ));
    assert.equal(standaloneSpatial.value.backend, 'webgpu');
    assert.equal(
      standaloneSpatial.value.status,
      'spatial-gas-ledger-producer-stage-ready',
      standaloneSpatial.value.reason
    );
    assert.equal(
      standaloneSpatial.value.spatialGasCandidateSourceMode,
      'particle-only'
    );
    assert.equal(standaloneSpatial.value.particleCount, 1);
    assert.equal(
      standaloneSpatial.value.retainedSpatialGasLedgerSourceReady,
      true
    );
  } finally {
    releaseUlgMechanicsResidentStageWorkerLane(laneOptions);
  }
});

test('ULG worker schedule keeps an exact particle family gas-inactive when source actionability is false', async () => {
  const device = createFakeGpuDevice();
  const buffers = lawsQuiescentSingleLaneBuffers();
  const laneOptions = {
    laneId: 'ulg:test:omitted-particle-gas-policy-lane',
    stateKey: 'ulg:test:omitted-particle-gas-policy-state'
  };
  try {
    await runUlgMechanicsResidentStageWorkerPayload(payload(
      workerLaneSeedStage(),
      workerSchroederStageContext(device, buffers, {
        schroederLaneSeed: workerLaneSeedStageOptions({
          hotBufferKey: 'ulg:sph-resident:omitted-particle-gas-policy',
          particleCount: 1,
          rematerializationSeedOverrides: {
            identityRequired: true,
            identityRevision: 'omitted-particle-gas-policy-identity',
            identitySchema: ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
            identityStrideBytes:
              SPH_GPU_PARTICLE_IDENTITY_UINTS
              * Uint32Array.BYTES_PER_ELEMENT,
            particleIdentityMutationApproved: true,
            requiresAuthoritativeFourBufferRows: true,
            outputParticleCapacity: 1
          }
        })
      }),
      null,
      laneOptions
    ));
    const residentStepOptions = {
      contactSolverEnabled: false,
      ambientPressurePa: 0,
      gasPressureMechanicsBoundaryEnabled: true,
      particleGasLedgerActionable: false
    };
    assert.equal(
      residentStepOptions.gasPressureMechanicsBoundaryEnabled,
      true
    );
    const epochOptions = {
      selectedLevel: 0,
      mechanicsGrid: WORKER_SEED_MECHANICS_GRID,
      exactNearCellTreeEnabled: false,
      mechanicsFieldViewsRequired: false
    };
    const mechanicsFixture = workerSeededMechanicsRunnerFixture(device, {
      labelPrefix: 'worker-omitted-particle-gas-policy',
      particleCount: 1
    });
    const mechanicsOptions = {
      schroederSameLevelMechanicsRunner: mechanicsFixture.runner,
      residentStepOptions
    };
    const scheduleId = 'ulg:test:omitted-particle-gas-policy';
    const targetScheduleAuthority = workerTargetScheduleAuthority({
      scheduleId,
      laneId: laneOptions.laneId,
      stateKey: laneOptions.stateKey,
      stepCount: 1,
      residentStepOptions,
      epochOptions,
      mechanicsOptions
    });
    const result = await runUlgMechanicsResidentStageWorkerSchedulePayload(
      schedulePayload(
        workerSchroederStageContext(device, buffers, {
          schroederSpatialEpoch: epochOptions,
          schroederSameLevelMechanics: mechanicsOptions
        }),
        {
          stepCount: 1,
          scheduleId,
          targetScheduleAuthority: structuredClone(targetScheduleAuthority)
        },
        laneOptions
      )
    );
    assert.equal(result.status, 'worker-resident-schedule-completed');
    assert.equal(
      targetScheduleAuthority.writerSet.particleGasLedgerActionable,
      false
    );
    assert.equal(targetScheduleAuthority.writerSet.gasBoundaryActionable, false);
    assert.equal(targetScheduleAuthority.writerSet.phaseVolumeSidecars, false);
    assert.equal(result.lawActivationReceipt.particleGasLedgerActionable, false);
    assert.equal(result.lawActivationReceipt.gasBoundaryActionable, false);
    assert.equal(result.lawActivationReceipt.phaseVolumeSidecars, false);
    assert.equal(
      result.executionRouteReceipt.blockers.includes('gas-boundary-actionable'),
      false
    );
    assert.equal(mechanicsFixture.runnerCalls.length, 1);
    const runnerOptions = mechanicsFixture.runnerCalls[0];
    assert.equal(runnerOptions.sphParticleUpload.particleCount, 1);
    assert.ok(runnerOptions.sphParticleUpload.stateBuffer);
    assert.ok(runnerOptions.sphParticleUpload.thermoBuffer);
    assert.ok(runnerOptions.sphParticleUpload.identityBuffer);
    assert.equal(
      runnerOptions.residentStepOptions.gasPressureMechanicsBoundaryEnabled,
      false,
      'the worker narrows enabled policy to the exact actionable schedule bit before mechanics'
    );
    assert.equal(
      runnerOptions.residentStepOptions.particleGasLedgerActionable,
      false
    );
    assert.equal(
      runnerOptions.spatialEpochGeneration.phaseVolumeSidecarsEnabled,
      false
    );
  } finally {
    releaseUlgMechanicsResidentStageWorkerLane(laneOptions);
  }
});

test('ULG worker schedule selects Tier0 from the first contact-free seed receipt and adopts one exact fused terminal family', async (t) => {
  const messageChannelStats = instrumentResidentScheduleMessageChannels(t);
  const device = createFakeGpuDevice();
  const originalQueueSubmit = device.queue.submit.bind(device.queue);
  let exactZeroTier0WatchPending = true;
  device.queue.submit = (commandBuffers) => {
    for (const commandBuffer of commandBuffers || []) {
      for (const operation of commandBuffer || []) {
        if (
          exactZeroTier0WatchPending
          && operation.type === 'copy'
          && operation.source?.label
            === 'ulg-tier0-reaction-motion-watch-control'
        ) {
          new Uint32Array(operation.source.bytes.buffer)[0] =
            SPH_REACTION_ACTIVATION_OBSERVATION_ENCODED_COUNT_BIAS;
          exactZeroTier0WatchPending = false;
        }
      }
    }
    return originalQueueSubmit(commandBuffers);
  };
  const buffers = lawsQuiescentSingleLaneBuffers();
  const laneOptions = {
    laneId: 'ulg:test:tier0-first-seed-lane',
    stateKey: 'ulg:test:tier0-first-seed-state'
  };
  const scheduleId = 'ulg:test:tier0-first-seed-schedule';
  const secondScheduleId = `${scheduleId}:continuation`;
  const stepCount = 3;
  let trustedAssignmentProviderCallCount = 0;
  const trustedAssignmentProvider =
    createWorkerSchroederLaneLevelAssignmentProvider({
      ...laneOptions,
      async levelAssignmentRunner() {
        trustedAssignmentProviderCallCount += 1;
        throw new Error('Tier0 must not invoke its assignment-only provider');
      }
    });
  const dormantReactionRecords = new Float32Array([
    1, 2, 3, 100,
    -100, 1, 1, 1,
    1, 0, 0, 0
  ]);
  const dormantReactionWatchTable =
    authorizedReactionWatchTable(dormantReactionRecords);
  const seedLineage = WORKER_LANE_SEED_DEFAULT_LINEAGE;
  const seeded = await runUlgMechanicsResidentStageWorkerPayload(payload(
    workerLaneSeedStage(),
    workerSchroederStageContext(device, buffers, {
      schroederLaneSeed: workerLaneSeedStageOptions({
        hotBufferKey: 'ulg:sph-resident:tier0-first-seed',
        particleCount: 1,
        rematerializationSeedOverrides: {
          identityRequired: true,
          identityRevision: 'tier0-laws-quiescent-identity',
          identitySchema: ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
          identityStrideBytes:
            SPH_GPU_PARTICLE_IDENTITY_UINTS * Uint32Array.BYTES_PER_ELEMENT,
          particleIdentityMutationApproved: true,
          requiresAuthoritativeFourBufferRows: true,
          outputParticleCapacity: 1
        }
      })
    }),
    null,
    laneOptions
  ));
  assert.equal(seeded.value.status, 'worker-schroeder-lane-seeded');
  const boundaryEvents = [];
  const originalCreateBuffer = device.createBuffer.bind(device);
  device.createBuffer = (descriptor = {}) => {
    const buffer = originalCreateBuffer(descriptor);
    if (descriptor.label === 'ulg-tier0-reaction-motion-watch-readback') {
      const originalMapAsync = buffer.mapAsync.bind(buffer);
      buffer.mapAsync = (...args) => {
        boundaryEvents.push('activation-map');
        return originalMapAsync(...args);
      };
    }
    return buffer;
  };
  const originalFence = device.queue.onSubmittedWorkDone.bind(device.queue);
  device.queue.onSubmittedWorkDone = (...args) => {
    boundaryEvents.push('queue-fence');
    return originalFence(...args);
  };
  const submissionsBeforeSchedule = device.queue.submitCalls.length;
  const fencesBeforeSchedule = device.queue.submittedWorkDoneCount || 0;
  const tier0EpochOptions = {
    selectedLevel: 0,
    mechanicsFieldViewsRequired: false,
    scheduleStepOptionsProvider: trustedAssignmentProvider
  };
  const tier0ResidentStepOptions = {
    contactSolverEnabled: false,
    ambientPressurePa: 0,
    activeGridSafetyCells: 1,
    reactionActivationWatchTable: dormantReactionWatchTable
  };
  const targetScheduleAuthority = workerTargetScheduleAuthority({
    scheduleId,
    targetScheduleRequestId: secondScheduleId,
    laneId: laneOptions.laneId,
    stateKey: laneOptions.stateKey,
    sourceLineage: seedLineage,
    stepCount,
    residentStepOptions: tier0ResidentStepOptions,
    epochOptions: tier0EpochOptions,
    mechanicsOptions: { residentStepOptions: tier0ResidentStepOptions },
    providerKind: 'worker-lane-assignment-only'
  });
  const tier0WorkerContext = (residentStepOptions) =>
    workerSchroederStageContext(device, buffers, {
      schroederSpatialEpoch: tier0EpochOptions,
      schroederSameLevelMechanics: { residentStepOptions }
    });
  const tier0SchedulePayload = (residentStepOptions) => schedulePayload(
    tier0WorkerContext(residentStepOptions),
    { stepCount, scheduleId, targetScheduleAuthority },
    laneOptions
  );
  const assertDormantWatchAuthorityRejectsBeforeGpu = async (
    residentStepOptions,
    label
  ) => {
    const submitCount = device.queue.submitCalls.length;
    const fenceCount = device.queue.submittedWorkDoneCount || 0;
    const writeCount = device.queue.writeBufferCalls.length;
    const boundaryEventCount = boundaryEvents.length;
    const providerCallCount = trustedAssignmentProviderCallCount;
    await assert.rejects(
      runUlgMechanicsResidentStageWorkerSchedulePayload(
        tier0SchedulePayload(residentStepOptions)
      ),
      (error) => {
        assert.equal(
          error.code,
          'ERR_ULG_WORKER_RESIDENT_SCHEDULE_TARGET_SCHEDULE_AUTHORITY_MISMATCH',
          label
        );
        assert.equal(error.reason, 'target-schedule-authority-mismatch', label);
        assert.equal(
          error.residentScheduleError?.stageId,
          'target-schedule-authority-preflight',
          label
        );
        assert.equal(error.residentScheduleError?.stepOrdinal, 0, label);
        return true;
      }
    );
    assert.equal(device.queue.submitCalls.length, submitCount, label);
    assert.equal(
      device.queue.submittedWorkDoneCount || 0,
      fenceCount,
      label
    );
    assert.equal(device.queue.writeBufferCalls.length, writeCount, label);
    assert.equal(boundaryEvents.length, boundaryEventCount, label);
    assert.equal(
      trustedAssignmentProviderCallCount,
      providerCallCount,
      label
    );
  };
  const {
    reactionActivationWatchTable: ignoredDormantWatchTable,
    ...omittedDormantWatchOptions
  } = tier0ResidentStepOptions;
  await assertDormantWatchAuthorityRejectsBeforeGpu(
    omittedDormantWatchOptions,
    'omitting the main-authored dormant table must reject before GPU work'
  );
  const driftedDormantReactionRecords = new Float32Array(
    dormantReactionRecords
  );
  driftedDormantReactionRecords[0] += 1;
  await assertDormantWatchAuthorityRejectsBeforeGpu(
    {
      ...tier0ResidentStepOptions,
      reactionActivationWatchTable: {
        ...dormantReactionWatchTable,
        records: driftedDormantReactionRecords,
        combinedRecords: driftedDormantReactionRecords
      }
    },
    'drifting the dormant table fingerprint must reject before GPU work'
  );

  const presentationBoundaries = [];
  const tier0Progress = [];
  const result = await runUlgMechanicsResidentStageWorkerSchedulePayload(
    tier0SchedulePayload(tier0ResidentStepOptions),
    {
      postProgress: (progress) => tier0Progress.push(progress),
      onTier0PresentationSubmissionBoundary: async (boundary) => {
        assert.equal(Object.isFrozen(boundary), true);
        presentationBoundaries.push(boundary);
        await device.queue.onSubmittedWorkDone();
        boundaryEvents.push('presentation-boundary');
        return {
          schema: ULG_WORKER_TIER0_PRESENTATION_QOS_BOUNDARY_PROOF_SCHEMA,
          status: ULG_WORKER_TIER0_PRESENTATION_QOS_BOUNDARY_PROOF_STATUS,
          ...boundary,
          motionFrameSubmittedSerial: presentationBoundaries.length,
          motionFrameSerial: presentationBoundaries.length,
          gpuCompleted: true,
          gpuCompletionMethod: 'worker-device.queue.onSubmittedWorkDone',
          presentationOpportunity: true,
          presentationOpportunityMethod:
            'worker-request-animation-frame-after-gpu-completion',
          queuePrefixCoveredPhysics: true,
          presentationQueueCompletionCount: presentationBoundaries.length,
          presentationQueueCompletionSerial: presentationBoundaries.length,
          presentationQueueCompletionMethod:
            'worker-device.queue.onSubmittedWorkDone',
          presentationQueueCompletionScope:
            'worker-offscreen-shared-device-queue-frame-proof',
          physicsQueuePrefixCoverage: 'physics-queue-prefix-included',
          physicsContinuationBlocked: true,
          presentationQosHostQueueFenceCount: 1
        };
      }
    }
  );
  const outerRouteAdmission =
    validateSchroederWorkerScheduleExecutionRouteReceipt(result, {
      scheduleId,
      laneId: laneOptions.laneId,
      stateKey: laneOptions.stateKey,
      requestedStepCount: stepCount,
      targetScheduleAuthority
    });

  assert.equal(result.status, 'worker-resident-schedule-completed');
  assert.equal(result.completedStepCount, stepCount);
  assert.equal(result.cancelled, false);
  assert.equal(
    result.controlPlaneYieldReceipt.schema,
    ULG_WORKER_RESIDENT_SCHEDULE_CONTROL_PLANE_YIELD_RECEIPT_SCHEMA
  );
  assert.equal(
    result.controlPlaneYieldReceipt.status,
    'worker-resident-schedule-control-plane-yield-not-required'
  );
  assert.equal(result.controlPlaneYieldReceipt.mode, 'none');
  assert.equal(
    result.controlPlaneYieldReceipt.mechanism,
    'none-atomic-tier0'
  );
  assert.equal(result.controlPlaneYieldReceipt.yieldRequestCount, 0);
  assert.equal(result.controlPlaneYieldReceipt.completedYieldCount, 0);
  assert.equal(result.controlPlaneYieldReceipt.messageChannelCreated, false);
  assert.equal(result.controlPlaneYieldReceipt.messageChannelYieldCount, 0);
  assert.equal(result.controlPlaneYieldReceipt.timerFallbackYieldCount, 0);
  assert.equal(result.controlPlaneYieldReceipt.ownedPortCount, 0);
  assert.equal(result.controlPlaneYieldReceipt.closedPortCount, 0);
  assert.equal(result.controlPlaneYieldReceipt.portsClosed, true);
  assert.equal(messageChannelStats.constructionCount, 0);
  assert.equal(messageChannelStats.port1CloseCount, 0);
  assert.equal(messageChannelStats.port2CloseCount, 0);
  assert.equal(
    outerRouteAdmission.route,
    'tier0-fused-resident-sequence'
  );
  assert.equal(result.lawActivationReceipt.contactSolver, false);
  assert.equal(result.lawActivationReceipt.contactSolverRequested, false);
  assert.equal(
    result.lawActivationReceipt.contactSolverEscalatedForDynamicLaws,
    false
  );
  assert.equal(result.lawActivationReceipt.thermal, false);
  assert.equal(result.lawActivationReceipt.reaction, false);
  assert.equal(result.lawActivationReceipt.mechanicsFieldViews, false);
  assert.equal(targetScheduleAuthority.writerSet.reaction, false);
  assert.equal(targetScheduleAuthority.tableFingerprints.reactionTable, null);
  assert.notEqual(
    targetScheduleAuthority.tableFingerprints.reactionActivationWatchTable,
    null
  );
  assert.equal(
    targetScheduleAuthority.tableFingerprints.watchReactionTableSource,
    'reaction-activation-watch-table'
  );
  assert.equal(
    result.executionRouteReceipt.status,
    'tier0-fused-resident-sequence-admitted'
  );
  assert.equal(
    result.executionRouteReceipt.route,
    'tier0-fused-resident-sequence'
  );
  assert.deepEqual(result.executionRouteReceipt.blockers, []);
  assert.equal(
    result.executionRouteReceipt.transition,
    'fresh-to-tier0-schedule-boundary'
  );
  assert.equal(
    result.executionRouteReceipt.topologyAttestation.status,
    'tier0-topology-quiescence-attested'
  );
  assert.equal(
    result.executionRouteReceipt.execution.commandSubmissionCount,
    2
  );
  assert.equal(
    result.executionRouteReceipt.execution.submissionMode,
    'queue-ordered-presentation-qos-chunks'
  );
  assert.deepEqual(
    result.executionRouteReceipt.execution.submissionStepCounts,
    [2, 1]
  );
  assert.equal(
    result.executionRouteReceipt.execution.maxSubstepsPerSubmission,
    2
  );
  assert.equal(
    result.executionRouteReceipt.execution.presentationBoundaryCount,
    1
  );
  assert.equal(
    result.executionRouteReceipt.execution
      .presentationBoundaryCompletedCount,
    1
  );
  assert.equal(
    result.executionRouteReceipt.execution.presentationBoundaryFailureCount,
    0
  );
  assert.equal(
    result.executionRouteReceipt.execution.presentationQosHostQueueFenceCount,
    1
  );
  assert.equal(
    result.executionRouteReceipt.execution.logicalAuthorityPublicationCount,
    1
  );
  assert.equal(
    result.executionRouteReceipt.execution
      .intermediateAuthorityPublicationCount,
    0
  );
  assert.equal(
    result.executionRouteReceipt.execution.internalPositionSubstepCount,
    stepCount
  );
  assert.equal(
    result.executionRouteReceipt.execution.canonicalSpatialEpochGenerated,
    false
  );
  assert.equal(
    result.executionRouteReceipt.execution.fullParticleReadbackFree,
    true
  );
  assert.equal(
    result.executionRouteReceipt.execution.residentContinuationReady,
    true
  );
  assert.equal(
    result.executionRouteReceipt.execution.submittedCleanupRelease.status,
    'tier0-submitted-cleanup-released-after-terminal-fence'
  );
  assert.deepEqual(result.executionRouteReceipt.lineage.source, {
    ...seedLineage
  });
  const expectedLineage = {
    storageGeneration: seedLineage.storageGeneration + 1,
    physicsTick: seedLineage.physicsTick + stepCount,
    physicsSubstep: 0,
    positionEpoch: seedLineage.positionEpoch + 1,
    topologyEpoch: seedLineage.topologyEpoch,
    chartEpoch: seedLineage.chartEpoch,
    levelEpoch: seedLineage.levelEpoch,
    supportEpoch: seedLineage.supportEpoch
  };
  assert.deepEqual(result.finalEpochIdentity, expectedLineage);
  assert.deepEqual(
    result.executionRouteReceipt.lineage.target,
    expectedLineage
  );
  assert.equal(result.finalEpochSeal, null);
  assert.equal(result.retainedBufferRefs.length, 4);
  assert.deepEqual(
    result.executionRouteReceipt.retainedBufferRefs,
    result.retainedBufferRefs
  );
  assert.equal(
    result.executionRouteReceipt.supersededFamilyRetirement.status,
    'tier0-superseded-family-retired-after-terminal-fence'
  );
  assert.equal(
    result.executionRouteReceipt.supersededFamilyRetirement
      .seedAssignmentRetired,
    true
  );
  assert.equal(
    device.queue.submitCalls.length - submissionsBeforeSchedule,
    2,
    'Tier0 may split queue work while retaining one logical terminal adoption'
  );
  assert.equal(
    (device.queue.submittedWorkDoneCount || 0) - fencesBeforeSchedule,
    2,
    'Tier0 must prove its presentation boundary and terminal queue fence'
  );
  assert.equal(result.gpuFence.fenceSatisfied, true);
  const reactionObservation = result.nextScheduleLawActivationObservation;
  assert.equal(
    reactionObservation.status,
    'dynamic-law-routing-observation-ready'
  );
  assert.equal(reactionObservation.observationSucceeded, true);
  assert.equal(reactionObservation.triggered, false);
  assert.equal(reactionObservation.triggeredSourceCount, 0);
  assert.equal(reactionObservation.rawEvidenceWord, 0);
  assert.equal(
    reactionObservation.producerRoute,
    'tier0-fused-resident-sequence'
  );
  assert.equal(
    reactionObservation.sampleStage,
    'tier0-terminal-post-separation-motion-envelope'
  );
  assert.equal(
    reactionObservation.routingAuthority,
    SCHROEDER_DYNAMIC_LAW_ROUTING_AUTHORITY
  );
  assert.equal(
    reactionObservation.shadowOnly,
    SCHROEDER_DYNAMIC_LAW_ROUTING_SHADOW_ONLY
  );
  assert.equal(
    reactionObservation.targetScheduleRequestId,
    targetScheduleAuthority.targetScheduleRequestId
  );
  assert.equal(
    reactionObservation.targetScheduleAuthorityFingerprint,
    targetScheduleAuthority.requestFingerprint
  );
  assert.equal(
    reactionObservation.reactionTableFingerprint,
    targetScheduleAuthority.tableFingerprints.watchReactionTableFingerprint
  );
  assert.deepEqual(
    result.executionRouteReceipt.targetScheduleAuthority,
    targetScheduleAuthority
  );
  assert.equal(
    reactionObservation.executionGating,
    SCHROEDER_DYNAMIC_LAW_ROUTING_EXECUTION_GATE
  );
  assert.equal(reactionObservation.motionEnvelope.maxFutureSubsteps, stepCount);
  assert.equal(
    reactionObservation.motionEnvelope.separationDisplacementEnabled,
    true
  );
  assert.equal(
    reactionObservation.motionEnvelope.contactCorrectionEnabled,
    false
  );
  assert.equal(
    reactionObservation.motionEnvelope.thermalPhaseEvolutionEnabled,
    false
  );
  assert.equal(
    reactionObservation.motionEnvelope.futureRestDiameterBoundStatus,
    'terminal-upper-under-declared-no-writer-premise'
  );
  assert.deepEqual(reactionObservation.motionEnvelope.boxDimsM, [5, 5, 5]);
  assert.equal(reactionObservation.mapAsyncCount, 1);
  assert.equal(
    reactionObservation.readbackByteLength,
    Uint32Array.BYTES_PER_ELEMENT
  );
  assert.equal(
    reactionObservation.failureReason,
    null
  );
  assert.deepEqual(presentationBoundaries, [{
    submissionOrdinal: 1,
    completedSubstepCount: 2,
    totalSubstepCount: stepCount,
    chunkStepCount: 2
  }]);
  assert.deepEqual(tier0Progress, []);
  assert.deepEqual(boundaryEvents, [
    'queue-fence',
    'presentation-boundary',
    'queue-fence',
    'activation-map'
  ]);
  assert.equal(
    result.perStepSummaries.ring.length
      + result.perStepSummaries.droppedStepCount,
    result.perStepSummaries.totalStepCount
  );
  assert.equal(result.executionRouteReceipt.authority.computeManager, 'pending');
  assert.equal(result.executionRouteReceipt.authority.stateManager, 'pending');
  assertNoWorkerGpuBuffers(result, 'tier0ScheduleResult');
  structuredClone(result);

  const secondSubmissionsBefore = device.queue.submitCalls.length;
  const secondFencesBefore = device.queue.submittedWorkDoneCount || 0;
  const continuationEpochOptions = tier0EpochOptions;
  const continuationTargetScheduleAuthority = workerTargetScheduleAuthority({
    scheduleId: secondScheduleId,
    laneId: laneOptions.laneId,
    stateKey: laneOptions.stateKey,
    sourceLineage: expectedLineage,
    predecessorDynamicLawObservation: reactionObservation,
    stepCount,
    residentStepOptions: tier0ResidentStepOptions,
    epochOptions: continuationEpochOptions,
    mechanicsOptions: { residentStepOptions: tier0ResidentStepOptions },
    providerKind: 'worker-lane-assignment-only'
  });
  const continuationWorkerContext = () => workerSchroederStageContext(
    device,
    buffers,
    {
      schroederSpatialEpoch: continuationEpochOptions,
      schroederSameLevelMechanics: {
        residentStepOptions: tier0ResidentStepOptions
      }
    }
  );
  const continuationPayload = (targetAuthority) => schedulePayload(
    continuationWorkerContext(),
    {
      stepCount,
      scheduleId: secondScheduleId,
      targetScheduleAuthority: targetAuthority
    },
    laneOptions
  );
  const assertPredecessorTokenRejectsBeforeGpu = async (
    targetAuthority,
    expectedReason,
    label,
    rejectedPayload = continuationPayload(targetAuthority)
  ) => {
    const submitCount = device.queue.submitCalls.length;
    const fenceCount = device.queue.submittedWorkDoneCount || 0;
    const writeCount = device.queue.writeBufferCalls.length;
    const boundaryEventCount = boundaryEvents.length;
    const providerCallCount = trustedAssignmentProviderCallCount;
    await assert.rejects(
      runUlgMechanicsResidentStageWorkerSchedulePayload(
        rejectedPayload
      ),
      (error) => {
        assert.equal(error.reason, expectedReason, label);
        assert.equal(
          error.code,
          `ERR_ULG_WORKER_RESIDENT_SCHEDULE_${
            expectedReason.toUpperCase().replaceAll('-', '_')
          }`,
          label
        );
        assert.equal(
          error.residentScheduleError?.stageId,
          'predecessor-target-token-preflight',
          label
        );
        assert.equal(error.residentScheduleError?.stepOrdinal, 0, label);
        if (expectedReason === 'predecessor-target-token-replayed') {
          assert.equal(
            error.residentScheduleError?.laneState
              ?.lastConsumedDynamicLawTargetScheduleRequestId,
            reactionObservation.targetScheduleRequestId,
            label
          );
        }
        return true;
      }
    );
    assert.equal(device.queue.submitCalls.length, submitCount, label);
    assert.equal(
      device.queue.submittedWorkDoneCount || 0,
      fenceCount,
      label
    );
    assert.equal(device.queue.writeBufferCalls.length, writeCount, label);
    assert.equal(boundaryEvents.length, boundaryEventCount, label);
    assert.equal(
      trustedAssignmentProviderCallCount,
      providerCallCount,
      label
    );
  };

  const missingPredecessorAuthority = workerTargetScheduleAuthority({
    scheduleId: secondScheduleId,
    laneId: laneOptions.laneId,
    stateKey: laneOptions.stateKey,
    sourceLineage: expectedLineage,
    stepCount,
    residentStepOptions: tier0ResidentStepOptions,
    epochOptions: continuationEpochOptions,
    mechanicsOptions: { residentStepOptions: tier0ResidentStepOptions },
    providerKind: 'worker-lane-assignment-only'
  });
  await assertPredecessorTokenRejectsBeforeGpu(
    missingPredecessorAuthority,
    'predecessor-target-token-missing',
    'missing predecessor token'
  );

  const predecessorMismatchCases = [
    ['terminal-lineage', (observation) => {
      observation.terminalLineage.physicsTick += 1;
    }],
    ['authority-fingerprint', (observation) => {
      observation.targetScheduleAuthorityFingerprint =
        `sha256:schroeder-target-schedule-authority-v5:${'0'.repeat(64)}`;
    }]
  ];
  for (const [label, mutate] of predecessorMismatchCases) {
    const forgedObservation = structuredClone(reactionObservation);
    mutate(forgedObservation);
    const forgedAuthority = workerTargetScheduleAuthority({
      scheduleId: secondScheduleId,
      laneId: laneOptions.laneId,
      stateKey: laneOptions.stateKey,
      sourceLineage: forgedObservation.terminalLineage,
      predecessorDynamicLawObservation: forgedObservation,
      stepCount,
      residentStepOptions: tier0ResidentStepOptions,
      epochOptions: continuationEpochOptions,
      mechanicsOptions: { residentStepOptions: tier0ResidentStepOptions },
      providerKind: 'worker-lane-assignment-only'
    });
    await assertPredecessorTokenRejectsBeforeGpu(
      forgedAuthority,
      'predecessor-target-token-mismatch',
      label
    );
  }

  const continuation = await runUlgMechanicsResidentStageWorkerSchedulePayload(
    continuationPayload(continuationTargetScheduleAuthority)
  );
  validateSchroederWorkerScheduleExecutionRouteReceipt(continuation, {
    scheduleId: secondScheduleId,
    laneId: laneOptions.laneId,
    stateKey: laneOptions.stateKey,
    requestedStepCount: stepCount,
    targetScheduleAuthority: continuationTargetScheduleAuthority
  });
  const predecessorConsumption =
    continuation.predecessorTargetTokenConsumption;
  assert.deepEqual(
    continuation.executionRouteReceipt.predecessorTargetTokenConsumption,
    predecessorConsumption
  );
  assert.equal(
    predecessorConsumption.status,
    'predecessor-target-token-consumed-before-route-selection'
  );
  assert.equal(
    predecessorConsumption.targetScheduleRequestId,
    secondScheduleId
  );
  assert.equal(predecessorConsumption.conservativeActivationRequired, false);
  assert.equal(predecessorConsumption.consumedBeforeGpuWork, true);
  assert.equal(
    continuation.executionRouteReceipt.transition,
    'tier0-continuation'
  );
  assert.equal(trustedAssignmentProviderCallCount, 0);
  assert.deepEqual(
    continuation.executionRouteReceipt.lineage.source,
    expectedLineage
  );
  assert.equal(continuation.retainedBufferRefs.length, 4);
  assert.equal(device.queue.submitCalls.length - secondSubmissionsBefore, 1);
  assert.equal(
    (device.queue.submittedWorkDoneCount || 0) - secondFencesBefore,
    1
  );
  assert.equal(
    continuation.perStepSummaries.ring.length
      + continuation.perStepSummaries.droppedStepCount,
    continuation.perStepSummaries.totalStepCount
  );
  assert.equal(
    continuation.nextScheduleLawActivationObservation.motionEnvelope
      .thermalPhaseEvolutionEnabled,
    false,
    'the branded assignment-only provider preserves the static latch premise'
  );
  assert.deepEqual(
    continuation.executionRouteReceipt.targetScheduleAuthority
      .predecessorDynamicLawObservation,
    reactionObservation,
    'the uncertain predecessor observation is consumed exactly as authored'
  );
  assertNoWorkerGpuBuffers(continuation, 'tier0ContinuationScheduleResult');
  structuredClone(continuation);

  await assertPredecessorTokenRejectsBeforeGpu(
    continuationTargetScheduleAuthority,
    'predecessor-target-token-replayed',
    'replayed predecessor token'
  );

  const restartSourceLineage = continuation.finalMechanicsLineage;
  const restartPredecessorObservation =
    continuation.nextScheduleLawActivationObservation;
  const restartScheduleId =
    restartPredecessorObservation.targetScheduleRequestId;
  assert.equal(
    releaseUlgMechanicsResidentStageWorkerLane({
      ...laneOptions,
      reason: 'predecessor-token-worker-restart'
    }).released,
    true
  );
  await runUlgMechanicsResidentStageWorkerPayload(payload(
    workerLaneSeedStage(),
    workerSchroederStageContext(device, buffers, {
      schroederLaneSeed: workerLaneSeedStageOptions({
        hotBufferKey: 'ulg:sph-resident:tier0-predecessor-restart',
        particleCount: 1,
        lineage: restartSourceLineage,
        rematerializationSeedOverrides: {
          identityRequired: true,
          identityRevision: 'tier0-predecessor-restart-identity',
          identitySchema: ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
          identityStrideBytes:
            SPH_GPU_PARTICLE_IDENTITY_UINTS * Uint32Array.BYTES_PER_ELEMENT,
          particleIdentityMutationApproved: true,
          requiresAuthoritativeFourBufferRows: true,
          outputParticleCapacity: 1
        }
      })
    }),
    null,
    laneOptions
  ));
  const restartTargetScheduleAuthority = workerTargetScheduleAuthority({
    scheduleId: restartScheduleId,
    laneId: laneOptions.laneId,
    stateKey: laneOptions.stateKey,
    sourceLineage: restartSourceLineage,
    predecessorDynamicLawObservation: restartPredecessorObservation,
    stepCount,
    residentStepOptions: tier0ResidentStepOptions,
    epochOptions: continuationEpochOptions,
    mechanicsOptions: { residentStepOptions: tier0ResidentStepOptions },
    providerKind: 'worker-lane-assignment-only'
  });
  await assertPredecessorTokenRejectsBeforeGpu(
    restartTargetScheduleAuthority,
    'predecessor-target-token-state-unavailable',
    'worker restart discarded retained predecessor authority',
    schedulePayload(
      continuationWorkerContext(),
      {
        stepCount,
        scheduleId: restartScheduleId,
        targetScheduleAuthority: restartTargetScheduleAuthority
      },
      laneOptions
    )
  );
  releaseUlgMechanicsResidentStageWorkerLane({
    ...laneOptions,
    reason: 'predecessor-token-worker-restart-test-complete'
  });
});

test('Tier0 forwards a reaction motion envelope only when a dormant watch is requested', async () => {
  const workerSource = await readFile(
    new URL(
      '../src/services/ulgMechanicsResidentStage.worker.js',
      import.meta.url
    ),
    'utf8'
  );
  const tier0CallStart = workerSource.indexOf(
    'const tier0Execution = await runTier0FusedResidentSequence({'
  );
  const tier0CallEnd = workerSource.indexOf(
    'tier0ExecutionResult = tier0Execution;',
    tier0CallStart
  );
  assert.ok(tier0CallStart >= 0 && tier0CallEnd > tier0CallStart);
  const tier0Call = workerSource.slice(tier0CallStart, tier0CallEnd);
  assert.match(
    tier0Call,
    /reactionActivationWatchTable:\s*scheduleReactionActivationWatchRequested\s*\? scheduleReactionActivationWatchTable\s*:\s*null/
  );
  assert.match(
    tier0Call,
    /reactionActivationMotionEnvelope:\s*scheduleReactionActivationWatchRequested\s*\? scheduleReactionActivationMotionEnvelope\s*:\s*null/
  );
});

test('ULG worker rejects malformed multi-submit Tier0 authority before terminal adoption', async () => {
  const device = createFakeGpuDevice();
  const buffers = lawsQuiescentSingleLaneBuffers();
  const laneOptions = {
    laneId: 'ulg:test:tier0-malformed-qos-lane',
    stateKey: 'ulg:test:tier0-malformed-qos-state'
  };
  const seedLineage = WORKER_LANE_SEED_DEFAULT_LINEAGE;
  try {
    await runUlgMechanicsResidentStageWorkerPayload(payload(
      workerLaneSeedStage(),
      workerSchroederStageContext(device, buffers, {
        schroederLaneSeed: workerLaneSeedStageOptions({
          hotBufferKey: 'ulg:sph-resident:tier0-malformed-qos',
          particleCount: 1,
          rematerializationSeedOverrides: {
            identityRequired: true,
            identityRevision: 'tier0-malformed-qos-identity',
            identitySchema: ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
            identityStrideBytes:
              SPH_GPU_PARTICLE_IDENTITY_UINTS
              * Uint32Array.BYTES_PER_ELEMENT,
            particleIdentityMutationApproved: true,
            requiresAuthoritativeFourBufferRows: true,
            outputParticleCapacity: 1
          }
        })
      }),
      null,
      laneOptions
    ));
    const residentStepOptions = {
      contactSolverEnabled: false,
      ambientPressurePa: 0,
      activeGridSafetyCells: 1
    };
    const scheduleId = 'ulg:test:tier0-malformed-qos-schedule';
    let presentationBoundaryCount = 0;
    await assert.rejects(
      runUlgMechanicsResidentStageWorkerSchedulePayload(
        schedulePayload(
          workerSchroederStageContext(device, buffers, {
            schroederSpatialEpoch: {
              selectedLevel: 0,
              mechanicsFieldViewsRequired: false
            },
            schroederSameLevelMechanics: { residentStepOptions }
          }),
          { stepCount: 3, scheduleId },
          laneOptions
        ),
        {
          onTier0PresentationSubmissionBoundary: async () => {
            presentationBoundaryCount += 1;
          },
          runTier0FusedResidentSequence: async (options) => {
            const execution =
              await runMlsMpmResidentStepsWithOptionalWebGpu(options);
            return {
              ...execution,
              fusedResidentSequence: {
                ...execution.fusedResidentSequence,
                submissionStepCounts: [2, 2]
              }
            };
          }
        }
      ),
      (error) => {
        assert.equal(
          error.reason,
          'tier0-fused-terminal-publication-invalid'
        );
        assert.ok(
          error.residentScheduleError?.tier0ValidationFailures?.includes(
            'fused-submission-authority'
          )
        );
        return true;
      }
    );
    assert.equal(presentationBoundaryCount, 1);
    const retained =
      resolveUlgMechanicsResidentStageWorkerRetainedParticleState({
        ...laneOptions,
        sourceStageId: 'schroederSameLevelMechanics'
      });
    assert.equal(retained.status, 'worker-retained-particle-state-ready');
    assert.equal(retained.sphParticleUpload.physicsTick, seedLineage.physicsTick);
    assert.equal(
      retained.sphParticleUpload.storageGeneration,
      seedLineage.storageGeneration
    );
  } finally {
    releaseUlgMechanicsResidentStageWorkerLane({
      ...laneOptions,
      reason: 'tier0-malformed-qos-test-complete'
    });
  }
});

test('ULG worker consumes a presealed dormant reaction transition and seals its active S2 continuation', async () => {
  const device = createFakeGpuDevice();
  const originalQueueSubmit = device.queue.submit.bind(device.queue);
  let nextTier0WatchTriggeredSourceCount = null;
  device.queue.submit = (commandBuffers) => {
    for (const commandBuffer of commandBuffers || []) {
      for (const operation of commandBuffer || []) {
        if (
          operation.type === 'copy'
          && operation.source?.label
            === 'ulg-tier0-reaction-motion-watch-control'
          && Number.isSafeInteger(nextTier0WatchTriggeredSourceCount)
        ) {
          new Uint32Array(operation.source.bytes.buffer)[0] =
            nextTier0WatchTriggeredSourceCount
            + SPH_REACTION_ACTIVATION_OBSERVATION_ENCODED_COUNT_BIAS;
          nextTier0WatchTriggeredSourceCount = null;
        }
      }
    }
    return originalQueueSubmit(commandBuffers);
  };
  const buffers = lawsQuiescentSingleLaneBuffers();
  const laneOptions = {
    laneId: 'ulg:test:prospective-reaction-transition-lane',
    stateKey: 'ulg:test:prospective-reaction-transition-state'
  };
  const s0ScheduleId = 'ulg:test:prospective-reaction-transition:s0';
  const s1ScheduleId = 'ulg:test:prospective-reaction-transition:s1';
  const s2ScheduleId = 'ulg:test:prospective-reaction-transition:s2';
  const stepCount = 2;
  const classifierOptions = {
    minLevel: 0,
    maxLevel: 0,
    chartId: 0,
    baseGridSpacingM: 1
  };
  let assignmentOrdinal = 0;
  const laneProvider = createWorkerSchroederLaneLevelAssignmentProvider({
    ...laneOptions,
    classifierOptions,
    async levelAssignmentRunner(args) {
      assignmentOrdinal += 1;
      const sphUpload = args.sphParticleUpload;
      return workerSchroederLevelAssignmentFixture(device, {
        particleCount: sphUpload.particleCount,
        storageGeneration: sphUpload.storageGeneration,
        physicsTick: sphUpload.physicsTick,
        physicsSubstep: sphUpload.physicsSubstep,
        positionEpoch: sphUpload.positionEpoch,
        topologyEpoch: sphUpload.topologyEpoch,
        chartEpoch: sphUpload.chartEpoch,
        levelEpoch: sphUpload.levelEpoch,
        supportEpoch: sphUpload.supportEpoch,
        sourceStateBuffer: sphUpload.stateBuffer,
        sourceThermoBuffer: sphUpload.thermoBuffer,
        sourceMechanicsBuffer: args.mlsMpmParticleUpload.mechanicsBuffer,
        label: `worker-prospective-reaction-assignment-${assignmentOrdinal}`
      });
    }
  });
  const epochOptions = {
    selectedLevel: 0,
    mechanicsGrid: WORKER_SEED_MECHANICS_GRID,
    exactNearCellTreeEnabled: false,
    mechanicsFieldViewsRequired: false,
    scheduleStepOptionsProvider: laneProvider
  };
  const reactionTable = authorizedReactionWatchTable(new Float32Array([
    1, 2, 3, 100,
    -100, 1, 1, 1,
    1, 0, 0, 0
  ]), { gasProductCount: 1 });
  const dormantResidentStepOptions = {
    contactSolverEnabled: false,
    ambientPressurePa: 0,
    activeGridSafetyCells: 1,
    gasPressureMechanicsBoundaryEnabled: true,
    particleGasLedgerActionable: false,
    reactionActivationWatchTable: reactionTable
  };
  const activeResidentStepOptions = {
    contactSolverEnabled: false,
    ambientPressurePa: 0,
    activeGridSafetyCells: 1,
    gasPressureMechanicsBoundaryEnabled: true,
    particleGasLedgerActionable: true,
    reactionTable,
    reactionActivationWatchTable: null
  };
  const mechanicsFixture = workerSeededMechanicsRunnerFixture(device, {
    labelPrefix: 'worker-prospective-reaction-transition',
    particleCount: 4
  });
  const activeMechanicsOptions = {
    schroederSameLevelMechanicsRunner: mechanicsFixture.runner,
    residentStepOptions: activeResidentStepOptions
  };
  const seedProspectiveLane = () =>
    runUlgMechanicsResidentStageWorkerPayload(payload(
      workerLaneSeedStage(),
      workerSchroederStageContext(device, buffers, {
        schroederLaneSeed: workerLaneSeedStageOptions({
          hotBufferKey: 'ulg:sph-resident:prospective-reaction-transition',
          particleCount: 1,
          rematerializationSeedOverrides: {
            identityRequired: true,
            identityRevision: 'prospective-reaction-transition-identity',
            identitySchema: ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
            identityStrideBytes:
              SPH_GPU_PARTICLE_IDENTITY_UINTS
              * Uint32Array.BYTES_PER_ELEMENT,
            particleIdentityMutationApproved: true,
            requiresAuthoritativeFourBufferRows: true,
            outputParticleCapacity: 1
          }
        })
      }),
      null,
      laneOptions
    ));
  try {
    await seedProspectiveLane();

    const activePrototypeAuthority = workerTargetScheduleAuthority({
      scheduleId: 'ulg:test:prospective-reaction-transition:prototype',
      laneId: laneOptions.laneId,
      stateKey: laneOptions.stateKey,
      stepCount,
      residentStepOptions: activeResidentStepOptions,
      epochOptions,
      mechanicsOptions: activeMechanicsOptions,
      providerKind: 'worker-lane-assignment-only',
      classifierOptions
    });
    const prospectiveTargetConfiguration =
      schroederTargetScheduleConfigurationReceipt(activePrototypeAuthority);
    const s0Authority = workerTargetScheduleAuthority({
      scheduleId: s0ScheduleId,
      targetScheduleRequestId: s1ScheduleId,
      laneId: laneOptions.laneId,
      stateKey: laneOptions.stateKey,
      stepCount,
      residentStepOptions: dormantResidentStepOptions,
      epochOptions,
      mechanicsOptions: {
        residentStepOptions: dormantResidentStepOptions
      },
      providerKind: 'worker-lane-assignment-only',
      classifierOptions,
      prospectiveTargetConfiguration
    });
    nextTier0WatchTriggeredSourceCount = 1;
    const s0 = await runUlgMechanicsResidentStageWorkerSchedulePayload(
      schedulePayload(
        workerSchroederStageContext(device, buffers, {
          schroederSpatialEpoch: epochOptions,
          schroederSameLevelMechanics: {
            residentStepOptions: dormantResidentStepOptions
          }
        }),
        {
          stepCount,
          scheduleId: s0ScheduleId,
          targetScheduleAuthority: structuredClone(s0Authority)
        },
        laneOptions
      )
    );
    assert.equal(s0.executionRouteReceipt.route, 'tier0-fused-resident-sequence');
    assert.equal(s0.lawActivationReceipt.reaction, false);
    assert.equal(s0.lawActivationReceipt.contactSolver, false);
    assert.equal(s0.lawActivationReceipt.particleGasLedgerActionable, false);
    assert.equal(s0.lawActivationReceipt.gasBoundaryActionable, false);
    assert.equal(s0.lawActivationReceipt.phaseVolumeSidecars, false);
    assert.equal(s0.lawActivationReceipt.mechanicsFieldViews, false);
    const s0Observation = s0.nextScheduleLawActivationObservation;
    assert.equal(
      s0Observation.status,
      'dynamic-law-routing-observation-ready'
    );
    assert.equal(s0Observation.observationSucceeded, true);
    assert.equal(s0Observation.triggered, true);
    assert.equal(s0Observation.triggeredSourceCount, 1);
    assert.equal(s0Observation.uncertainty, false);
    assert.equal(s0Observation.rawEvidenceWord, 1);
    assert.equal(s0Observation.failureReason, null);

    const s1Authority = workerTargetScheduleAuthority({
      scheduleId: s1ScheduleId,
      targetScheduleRequestId: s2ScheduleId,
      laneId: laneOptions.laneId,
      stateKey: laneOptions.stateKey,
      sourceLineage: s0.finalMechanicsLineage,
      predecessorDynamicLawObservation: s0Observation,
      predecessorTargetScheduleAuthority: s0Authority,
      stepCount,
      residentStepOptions: activeResidentStepOptions,
      epochOptions,
      mechanicsOptions: activeMechanicsOptions,
      providerKind: 'worker-lane-assignment-only',
      classifierOptions
    });
    assert.equal(
      s1Authority.predecessorDynamicLawTransition.transitionFingerprint,
      s0Authority.prospectiveDynamicLawTransition.transitionFingerprint
    );
    const forgedS1Authority = structuredClone(s1Authority);
    forgedS1Authority.predecessorDynamicLawTransition.transitionFingerprint =
      `sha256:schroeder-prospective-dynamic-law-transition-v0:${'0'.repeat(64)}`;
    const submissionsBeforeForgery = device.queue.submitCalls.length;
    await assert.rejects(
      runUlgMechanicsResidentStageWorkerSchedulePayload(schedulePayload(
        workerSchroederStageContext(device, buffers, {
          schroederSpatialEpoch: epochOptions,
          schroederSameLevelMechanics: activeMechanicsOptions
        }),
        {
          stepCount,
          scheduleId: s1ScheduleId,
          targetScheduleAuthority: forgedS1Authority
        },
        laneOptions
      )),
      (error) => {
        assert.equal(error.reason, 'target-schedule-authority-mismatch');
        assert.equal(
          error.residentScheduleError?.stageId,
          'target-schedule-authority-preflight'
        );
        return true;
      }
    );
    assert.equal(device.queue.submitCalls.length, submissionsBeforeForgery);

    const callerOwnedS1Authority = structuredClone(s1Authority);
    let callerAuthorityMutatedAfterAdmission = false;
    const latchedActiveMechanicsOptions = {
      ...activeMechanicsOptions,
      async schroederSameLevelMechanicsRunner(args) {
        if (!callerAuthorityMutatedAfterAdmission) {
          callerAuthorityMutatedAfterAdmission = true;
          callerOwnedS1Authority.requestFingerprint =
            `sha256:schroeder-target-schedule-authority-v5:${'0'.repeat(64)}`;
          callerOwnedS1Authority.writerSet.reaction = false;
        }
        return mechanicsFixture.runner(args);
      }
    };
    const s1 = await runUlgMechanicsResidentStageWorkerSchedulePayload(
      schedulePayload(
        workerSchroederStageContext(device, buffers, {
          schroederSpatialEpoch: epochOptions,
          schroederSameLevelMechanics: latchedActiveMechanicsOptions
        }),
        {
          stepCount,
          scheduleId: s1ScheduleId,
          targetScheduleAuthority: callerOwnedS1Authority
        },
        laneOptions
      )
    );
    assert.equal(callerAuthorityMutatedAfterAdmission, true);
    assert.equal(
      s1.executionRouteReceipt.targetScheduleAuthority.requestFingerprint,
      s1Authority.requestFingerprint,
      'the worker receipt must retain the entry-latched authority fingerprint'
    );
    assert.equal(
      s1.executionRouteReceipt.targetScheduleAuthority.writerSet.reaction,
      true,
      'callback-time caller mutation must not alter worker-local authority'
    );
    assert.equal(s1.executionRouteReceipt.route, 'canonical-schroeder');
    assert.equal(s1.lawActivationReceipt.reaction, true);
    assert.equal(s1.lawActivationReceipt.particleGasLedgerActionable, true);
    assert.equal(s1.lawActivationReceipt.gasBoundaryActionable, true);
    assert.equal(s1.lawActivationReceipt.phaseVolumeSidecars, true);
    assert.equal(s1.lawActivationReceipt.mechanicsFieldViews, true);
    assert.equal(s1.lawActivationReceipt.contactSolverRequested, false);
    assert.equal(s1.lawActivationReceipt.contactSolver, true);
    assert.equal(
      s1.lawActivationReceipt.contactSolverEscalatedForDynamicLaws,
      true
    );
    assert.equal(mechanicsFixture.runnerCalls.length, stepCount);
    for (const runnerOptions of mechanicsFixture.runnerCalls) {
      assert.equal(
        runnerOptions.residentStepOptions
          .gasPressureMechanicsBoundaryEnabled,
        true
      );
      assert.equal(
        runnerOptions.residentStepOptions.particleGasLedgerActionable,
        true
      );
      assert.equal(
        runnerOptions.spatialEpochGeneration.phaseVolumeSidecarsEnabled,
        true
      );
      assert.ok(runnerOptions.spatialEpochGeneration.mechanicsFieldView);
    }
    assert.equal(
      s1.predecessorTargetTokenConsumption.configurationContinuityMode,
      'prospective-reaction-dormant-to-executing'
    );
    assert.equal(
      s1.predecessorTargetTokenConsumption
        .prospectiveDynamicLawTransitionFingerprint,
      s0Authority.prospectiveDynamicLawTransition.transitionFingerprint
    );
    assert.equal(
      s1.executionRouteReceipt.targetScheduleAuthority.tableFingerprints
        .reactionActivationWatchTable,
      null
    );
    assert.notEqual(
      s1.executionRouteReceipt.targetScheduleAuthority.tableFingerprints
        .reactionTable,
      null
    );
    const dynamicCarrierTransition =
      s1.executionRouteReceipt.phaseCarrierOneToFourTransition;
    assert.equal(
      dynamicCarrierTransition.status,
      'phase-carrier-one-to-four-adopted-terminal-fence-satisfied'
    );
    assert.equal(
      dynamicCarrierTransition.trigger,
      'authenticated-dynamic-reaction-successor'
    );
    assert.equal(dynamicCarrierTransition.routingAuthority, true);
    assert.equal(dynamicCarrierTransition.dynamicLawRoutingAuthority, true);
    assert.equal(
      dynamicCarrierTransition.terminalParticleCount,
      dynamicCarrierTransition.sourceParticleCount * 4
    );
    assert.equal(dynamicCarrierTransition.mapAsyncCount, 0);
    assert.equal(dynamicCarrierTransition.readbackBytes, 0);
    assert.equal(dynamicCarrierTransition.terminalFenceSatisfied, true);
    assert.equal(dynamicCarrierTransition.supersededSourceRetired, true);

    const s1Observation = s1.nextScheduleLawActivationObservation;
    const s2Authority = workerTargetScheduleAuthority({
      scheduleId: s2ScheduleId,
      laneId: laneOptions.laneId,
      stateKey: laneOptions.stateKey,
      sourceLineage: s1.finalMechanicsLineage,
      sourceParticleCount: dynamicCarrierTransition.terminalParticleCount,
      sourcePhaseLaneCount:
        s1.executionRouteReceipt.phaseCarrierOneToFourTransition
          ?.terminalPhaseCarrierPlan?.phaseLaneCount ?? 1,
      predecessorDynamicLawObservation: s1Observation,
      predecessorTargetScheduleAuthority: s1Authority,
      stepCount,
      residentStepOptions: activeResidentStepOptions,
      epochOptions,
      mechanicsOptions: activeMechanicsOptions,
      providerKind: 'worker-lane-assignment-only',
      classifierOptions
    });
    assert.equal(
      s2Authority.predecessorDynamicLawTransition,
      null,
      'S2 exact continuity must not consume a second reaction transition'
    );
    assert.equal(
      s2Authority.writerSet.reaction,
      true
    );
    assert.equal(
      s2Authority.tableFingerprints.reactionActivationWatchTable,
      null,
      'the sealed S2 target must not revert to its dormant watch'
    );
    const s2 = await runUlgMechanicsResidentStageWorkerSchedulePayload(
      schedulePayload(
        workerSchroederStageContext(device, buffers, {
          schroederSpatialEpoch: epochOptions,
          schroederSameLevelMechanics: activeMechanicsOptions
        }),
        {
          stepCount,
          scheduleId: s2ScheduleId,
          targetScheduleAuthority: structuredClone(s2Authority)
        },
        laneOptions
      )
    );
    validateSchroederWorkerScheduleExecutionRouteReceipt(s2, {
      scheduleId: s2ScheduleId,
      laneId: laneOptions.laneId,
      stateKey: laneOptions.stateKey,
      requestedStepCount: stepCount,
      targetScheduleAuthority: s2Authority
    });
    assert.equal(s2.executionRouteReceipt.route, 'canonical-schroeder');
    assert.equal(s2.lawActivationReceipt.reaction, true);
    assert.equal(s2.lawActivationReceipt.particleGasLedgerActionable, true);
    assert.equal(s2.lawActivationReceipt.gasBoundaryActionable, true);
    assert.equal(s2.phaseCarrierOneToFourTransition, null);
    assert.equal(
      s2.predecessorTargetTokenConsumption.configurationContinuityMode,
      'exact-configuration-continuation'
    );
    assert.equal(
      s2.predecessorTargetTokenConsumption
        .prospectiveDynamicLawTransitionFingerprint,
      null
    );
    assert.equal(
      s2.executionRouteReceipt.targetScheduleAuthority.writerSet.reaction,
      true
    );
    assert.equal(
      s2.executionRouteReceipt.targetScheduleAuthority.tableFingerprints
        .reactionActivationWatchTable,
      null
    );

    releaseUlgMechanicsResidentStageWorkerLane({
      ...laneOptions,
      reason: 'prospective-reaction-transition-zero-reseed'
    });
    await seedProspectiveLane();
    nextTier0WatchTriggeredSourceCount = 0;
    const zeroS0 = await runUlgMechanicsResidentStageWorkerSchedulePayload(
      schedulePayload(
        workerSchroederStageContext(device, buffers, {
          schroederSpatialEpoch: epochOptions,
          schroederSameLevelMechanics: {
            residentStepOptions: dormantResidentStepOptions
          }
        }),
        {
          stepCount,
          scheduleId: s0ScheduleId,
          targetScheduleAuthority: structuredClone(s0Authority)
        },
        laneOptions
      )
    );
    const zeroObservation = zeroS0.nextScheduleLawActivationObservation;
    assert.equal(
      zeroObservation.status,
      'dynamic-law-routing-observation-ready'
    );
    assert.equal(zeroObservation.observationSucceeded, true);
    assert.equal(zeroObservation.triggered, false);
    assert.equal(zeroObservation.triggeredSourceCount, 0);
    assert.equal(zeroObservation.uncertainty, false);
    assert.equal(zeroObservation.rawEvidenceWord, 0);
    assert.equal(zeroObservation.failureReason, null);
    assert.throws(
      () => workerTargetScheduleAuthority({
        scheduleId: s1ScheduleId,
        targetScheduleRequestId: s2ScheduleId,
        laneId: laneOptions.laneId,
        stateKey: laneOptions.stateKey,
        sourceLineage: zeroS0.finalMechanicsLineage,
        predecessorDynamicLawObservation: zeroObservation,
        predecessorTargetScheduleAuthority: s0Authority,
        stepCount,
        residentStepOptions: activeResidentStepOptions,
        epochOptions,
        mechanicsOptions: activeMechanicsOptions,
        providerKind: 'worker-lane-assignment-only',
        classifierOptions
      }),
      /not prospectively authorized/,
      'a trustworthy successful-zero observation must not activate S1'
    );

    const submitCountBeforeZeroMismatch = device.queue.submitCalls.length;
    const writeCountBeforeZeroMismatch = device.queue.writeBufferCalls.length;
    const fenceCountBeforeZeroMismatch =
      device.queue.submittedWorkDoneCount || 0;
    const assignmentCountBeforeZeroMismatch = assignmentOrdinal;
    await assert.rejects(
      runUlgMechanicsResidentStageWorkerSchedulePayload(schedulePayload(
        workerSchroederStageContext(device, buffers, {
          schroederSpatialEpoch: epochOptions,
          schroederSameLevelMechanics: activeMechanicsOptions
        }),
        {
          stepCount,
          scheduleId: s1ScheduleId,
          targetScheduleAuthority: structuredClone(s1Authority)
        },
        laneOptions
      )),
      (error) => {
        assert.equal(error.reason, 'predecessor-target-token-mismatch');
        assert.equal(
          error.residentScheduleError?.stageId,
          'predecessor-target-token-preflight'
        );
        return true;
      }
    );
    assert.equal(device.queue.submitCalls.length, submitCountBeforeZeroMismatch);
    assert.equal(
      device.queue.writeBufferCalls.length,
      writeCountBeforeZeroMismatch
    );
    assert.equal(
      device.queue.submittedWorkDoneCount || 0,
      fenceCountBeforeZeroMismatch
    );
    assert.equal(assignmentOrdinal, assignmentCountBeforeZeroMismatch);
  } finally {
    releaseUlgMechanicsResidentStageWorkerLane({
      ...laneOptions,
      reason: 'prospective-reaction-transition-test-complete'
    });
  }
});

test('ULG worker authenticates a retained product arena for a multi-step S1-to-S2 gas transition', async () => {
  const device = createFakeGpuDevice();
  const buffers = lawsQuiescentSingleLaneBuffers();
  const laneOptions = {
    laneId: 'ulg:test:retained-product-gas-transition-lane',
    stateKey: 'ulg:test:retained-product-gas-transition-state'
  };
  const s1ScheduleId = 'ulg:test:retained-product-gas-transition:s1';
  const s2ScheduleId = 'ulg:test:retained-product-gas-transition:s2';
  const stepCount = 2;
  const classifierOptions = {
    minLevel: 0,
    maxLevel: 0,
    chartId: 0,
    baseGridSpacingM: 1
  };
  let assignmentOrdinal = 0;
  const laneProvider = createWorkerSchroederLaneLevelAssignmentProvider({
    ...laneOptions,
    classifierOptions,
    async levelAssignmentRunner(args) {
      assignmentOrdinal += 1;
      const sphUpload = args.sphParticleUpload;
      return workerSchroederLevelAssignmentFixture(device, {
        particleCount: sphUpload.particleCount,
        storageGeneration: sphUpload.storageGeneration,
        physicsTick: sphUpload.physicsTick,
        physicsSubstep: sphUpload.physicsSubstep,
        positionEpoch: sphUpload.positionEpoch,
        topologyEpoch: sphUpload.topologyEpoch,
        chartEpoch: sphUpload.chartEpoch,
        levelEpoch: sphUpload.levelEpoch,
        supportEpoch: sphUpload.supportEpoch,
        sourceStateBuffer: sphUpload.stateBuffer,
        sourceThermoBuffer: sphUpload.thermoBuffer,
        sourceMechanicsBuffer: args.mlsMpmParticleUpload.mechanicsBuffer,
        label: `worker-retained-product-gas-assignment-${assignmentOrdinal}`
      });
    }
  });
  const epochOptions = {
    selectedLevel: 0,
    mechanicsGrid: WORKER_SEED_MECHANICS_GRID,
    exactNearCellTreeEnabled: false,
    mechanicsFieldViewsRequired: false,
    scheduleStepOptionsProvider: laneProvider
  };
  const reactionTable = authorizedReactionWatchTable(new Float32Array([
    1, 2, 3, 100,
    -100, 1, 1, 1,
    1, 0, 0, 0
  ]));
  const activeResidentStepOptions = {
    contactSolverEnabled: false,
    ambientPressurePa: 0,
    activeGridSafetyCells: 1,
    reactionTable,
    reactionActivationWatchTable: null
  };
  const sourceProductBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'worker-retained-product-gas-source-events',
    size: 128,
    usage: 128 | 4 | 8
  }), device);
  const emittedProductMass = tagResidentProductMassDevice({
    schema: 'peercompute.ulg.sph-resident-product-mass.v0',
    status: 'resident-product-mass-buffer-retained',
    source: 'worker-retained-product-gas-test-source',
    productEventBuffer: sourceProductBuffer,
    productEventBufferRetained: true,
    productEventBufferByteLength: 128,
    productEventRowCount: 1,
    productEventActiveEventCount: 1,
    productEventStrideFloats: 32,
    productEventStrideBytes: 128,
    productEventGenerationCount: 1,
    productEventSourceRowCounts: [1],
    mergeSourceProductEventBufferCount: 1,
    mergeSourceProductEventRowCounts: [1],
    mergeSourceProductEventBufferByteLengths: [128],
    productInventoryCount: 1,
    gasSpeciesLedgerCount: 0,
    gasSpeciesReadbackByteLength: 0,
    sealedBoxGasProductMoles: 0,
    visibleProductMassKg: 0,
    unplacedProductMassKg: 1,
    unplacedGasProductMassKg: 0,
    consumeMassPolicy: 'unplaced-product-mass-only',
    visibleMassAlreadyInParticleBuffers: true,
    destroyResidentProductMassBuffers() {
      sourceProductBuffer.destroy();
    }
  }, device);
  const retainedProductMass = await mergeResidentProductMassBuffersWebGpu({
    device,
    emittedResidentProductMass: emittedProductMass,
    allowHostCompactionObservation: false
  });
  const mechanicsFixture = workerSeededMechanicsRunnerFixture(device, {
    labelPrefix: 'worker-retained-product-gas-transition',
    particleCount: 1
  });
  const productMechanicsOptions = {
    async schroederSameLevelMechanicsRunner(args) {
      const result = await mechanicsFixture.runner(args);
      result.residentStep.residentProductMass = retainedProductMass;
      return result;
    },
    residentStepOptions: activeResidentStepOptions
  };
  const previousGpuBufferUsage = globalThis.GPUBufferUsage;
  const previousGpuMapMode = globalThis.GPUMapMode;
  globalThis.GPUBufferUsage = {
    ...(previousGpuBufferUsage || {}),
    COPY_DST: previousGpuBufferUsage?.COPY_DST ?? 8,
    MAP_READ: previousGpuBufferUsage?.MAP_READ ?? 1
  };
  globalThis.GPUMapMode = {
    ...(previousGpuMapMode || {}),
    READ: previousGpuMapMode?.READ ?? 1
  };
  try {
    await runUlgMechanicsResidentStageWorkerPayload(payload(
      workerLaneSeedStage(),
      workerSchroederStageContext(device, buffers, {
        schroederLaneSeed: workerLaneSeedStageOptions({
          hotBufferKey: 'ulg:sph-resident:retained-product-gas-transition',
          particleCount: 1,
          rematerializationSeedOverrides: {
            identityRequired: true,
            identityRevision: 'retained-product-gas-transition-identity',
            identitySchema: ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
            identityStrideBytes:
              SPH_GPU_PARTICLE_IDENTITY_UINTS
              * Uint32Array.BYTES_PER_ELEMENT,
            particleIdentityMutationApproved: true,
            requiresAuthoritativeFourBufferRows: true,
            outputParticleCapacity: 1
          }
        })
      }),
      null,
      laneOptions
    ));

    const prospectiveTargetConfiguration =
      createSchroederTargetScheduleConfiguration({
        maxFutureSubsteps: stepCount,
        dtS: 0.1,
        gridSpacingM: 1,
        cflFactor: 10,
        boxDimsM: [5, 5, 5],
        residentStepOptions: {
          ...activeResidentStepOptions,
          thermalStepOptions: {},
          reactionStepOptions: {},
          mechanicsRefreshOptions: {}
        },
        epochOptions,
        mechanicsOptions: productMechanicsOptions,
        hierarchyConfig: productMechanicsOptions.hierarchyConfig ?? null,
        scheduleStepOptionsProvider:
          createSchroederTargetScheduleProviderAuthority({
            kind: 'worker-lane-assignment-only',
            classifierOptions
          }),
        retainedProductGasBoundaryActionable: true
      });
    const s1Authority = workerTargetScheduleAuthority({
      scheduleId: s1ScheduleId,
      targetScheduleRequestId: s2ScheduleId,
      laneId: laneOptions.laneId,
      stateKey: laneOptions.stateKey,
      stepCount,
      residentStepOptions: activeResidentStepOptions,
      epochOptions,
      mechanicsOptions: productMechanicsOptions,
      providerKind: 'worker-lane-assignment-only',
      classifierOptions,
      prospectiveTargetConfiguration
    });
    assert.equal(
      s1Authority.prospectiveDynamicLawTransition.kind,
      'retained-product-gas-boundary-inactive-to-actionable'
    );
    const s1 = await runUlgMechanicsResidentStageWorkerSchedulePayload(
      schedulePayload(
        workerSchroederStageContext(device, buffers, {
          schroederSpatialEpoch: epochOptions,
          schroederSameLevelMechanics: productMechanicsOptions
        }),
        {
          stepCount,
          scheduleId: s1ScheduleId,
          targetScheduleAuthority: structuredClone(s1Authority)
        },
        laneOptions
      )
    );
    const writerEvidence = s1.nextScheduleLawActivationObservation
      .prospectiveWriterEvidence;
    const productHistoryEvidence = s1.perStepSummaries.lastStep
      .hierarchyStageSummary.residentProductHistory;
    assert.equal(
      productHistoryEvidence.schema,
      'peercompute.ulg.worker-resident-product-history-evidence.v0'
    );
    assert.equal(
      productHistoryEvidence.status,
      'worker-resident-product-history-evidence-ready'
    );
    assert.equal(
      productHistoryEvidence.residentProductMassStatus,
      'resident-product-mass-merged-gpu-resident'
    );
    assert.equal(productHistoryEvidence.productEventBufferRetained, true);
    assert.equal(
      productHistoryEvidence.compactionStatus,
      'product-event-filtered-append-gpu-count-resident'
    );
    assert.equal(
      productHistoryEvidence.gpuCommitStatus,
      'gpu-conditioned-publication-commit-pending'
    );
    assert.equal(
      productHistoryEvidence.arenaStatus,
      'resident-product-history-arena-gpu-commit-pending'
    );
    assert.ok(productHistoryEvidence.generation > 0);
    assert.ok(productHistoryEvidence.seal > 0);
    assert.equal(writerEvidence.gasBoundaryActionable, true);
    assert.equal(
      writerEvidence.status,
      'worker-retained-product-gas-boundary-actionable'
    );
    assert.ok(writerEvidence.productHistoryArenaIdentity);
    if (writerEvidence.productHistoryLiveBoundObservation) {
      assert.equal(
        writerEvidence.productHistoryLiveBoundObservation.observedLiveRowCount,
        0
      );
      assert.equal(
        writerEvidence.productHistoryArenaIdentity.countAuthorityGeneration,
        writerEvidence.productHistoryLiveBoundObservation.arenaIdentity
          .countAuthorityGeneration
      );
    }
    assert.equal(writerEvidence.terminalGpuFenceSatisfied, true);
    assert.equal(writerEvidence.scheduleCancelled, false);

    const s2Authority = workerTargetScheduleAuthority({
      scheduleId: s2ScheduleId,
      laneId: laneOptions.laneId,
      stateKey: laneOptions.stateKey,
      sourceLineage: s1.finalMechanicsLineage,
      predecessorDynamicLawObservation:
        s1.nextScheduleLawActivationObservation,
      predecessorTargetScheduleAuthority: s1Authority,
      stepCount,
      residentStepOptions: activeResidentStepOptions,
      epochOptions,
      mechanicsOptions: productMechanicsOptions,
      providerKind: 'worker-lane-assignment-only',
      classifierOptions
    });
    assert.equal(s2Authority.writerSet.gasBoundaryActionable, true);
    assert.equal(
      s2Authority.writerSet.retainedProductGasBoundaryActionable,
      true
    );
    assert.equal(
      s2Authority.predecessorDynamicLawTransition.transitionFingerprint,
      s1Authority.prospectiveDynamicLawTransition.transitionFingerprint
    );
    const s2 = await runUlgMechanicsResidentStageWorkerSchedulePayload(
      schedulePayload(
        workerSchroederStageContext(device, buffers, {
          schroederSpatialEpoch: epochOptions,
          schroederSameLevelMechanics: productMechanicsOptions
        }),
        {
          stepCount,
          scheduleId: s2ScheduleId,
          targetScheduleAuthority: structuredClone(s2Authority)
        },
        laneOptions
      )
    );
    assert.equal(s2.lawActivationReceipt.gasBoundaryActionable, true);
    assert.equal(
      s2.lawActivationReceipt.retainedProductGasBoundaryActionable,
      true
    );
    assert.equal(
      s2.predecessorTargetTokenConsumption.configurationContinuityMode,
      'prospective-retained-product-gas-boundary-actionable'
    );
    assert.equal(
      s2.predecessorTargetTokenConsumption.conservativeActivationRequired,
      true
    );
    assert.ok(
      s2.executionRouteReceipt.blockers.includes('gas-boundary-actionable')
    );
  } finally {
    releaseUlgMechanicsResidentStageWorkerLane({
      ...laneOptions,
      reason: 'retained-product-gas-transition-test-complete'
    });
    try { emittedProductMass.destroyResidentProductMassBuffers(); } catch {}
    if (previousGpuBufferUsage === undefined) {
      delete globalThis.GPUBufferUsage;
    } else {
      globalThis.GPUBufferUsage = previousGpuBufferUsage;
    }
    if (previousGpuMapMode === undefined) {
      delete globalThis.GPUMapMode;
    } else {
      globalThis.GPUMapMode = previousGpuMapMode;
    }
  }
});

test('ULG worker rejects an unsealed provider before dynamic-watch execution', async () => {
  const device = createFakeGpuDevice();
  const buffers = lawsQuiescentSingleLaneBuffers();
  const laneOptions = {
    laneId: 'ulg:test:tier0-provider-guard-lane',
    stateKey: 'ulg:test:tier0-provider-guard-state'
  };
  await runUlgMechanicsResidentStageWorkerPayload(payload(
    workerLaneSeedStage(),
    workerSchroederStageContext(device, buffers, {
      schroederLaneSeed: workerLaneSeedStageOptions({
        hotBufferKey: 'ulg:sph-resident:tier0-provider-guard',
        particleCount: 1,
        rematerializationSeedOverrides: {
          identityRequired: true,
          identityRevision: 'tier0-provider-guard-identity',
          identitySchema: ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
          identityStrideBytes:
            SPH_GPU_PARTICLE_IDENTITY_UINTS * Uint32Array.BYTES_PER_ELEMENT,
          particleIdentityMutationApproved: true,
          requiresAuthoritativeFourBufferRows: true,
          outputParticleCapacity: 1
        }
      })
    }),
    null,
    laneOptions
  ));

  const continuationAssignment = workerSchroederLevelAssignmentFixture(
    device,
    {
      particleCount: 1,
      storageGeneration:
        WORKER_LANE_SEED_DEFAULT_LINEAGE.storageGeneration + 1,
      physicsTick: WORKER_LANE_SEED_DEFAULT_LINEAGE.physicsTick + 1,
      positionEpoch: WORKER_LANE_SEED_DEFAULT_LINEAGE.positionEpoch + 1,
      sourceStateBuffer: null,
      label: 'worker-tier0-provider-guard-step2'
    }
  );
  let providerCallCount = 0;
  const mechanicsFixture = workerSeededMechanicsRunnerFixture(device, {
    labelPrefix: 'worker-tier0-provider-guard',
    particleCount: 1
  });
  const scheduleId = 'ulg:test:tier0-provider-guard-schedule';
  const submissionsBefore = device.queue.submitCalls.length;
  try {
    await assert.rejects(
      runUlgMechanicsResidentStageWorkerSchedulePayload(
        schedulePayload(
          workerSchroederStageContext(device, buffers, {
            schroederSpatialEpoch: {
              selectedLevel: 0,
              mechanicsGrid: WORKER_SEED_MECHANICS_GRID,
              exactNearCellTreeEnabled: false,
              mechanicsFieldViewsRequired: false,
              async scheduleStepOptionsProvider() {
                providerCallCount += 1;
                return { levelAssignment: continuationAssignment };
              }
            },
            schroederSameLevelMechanics: {
              schroederSameLevelMechanicsRunner: mechanicsFixture.runner,
              residentStepOptions: {
                contactSolverEnabled: false,
                ambientPressurePa: 0,
                reactionTable:
                  thermalPhaseLatchReactionWatchTable()
              }
            }
          }),
          { stepCount: 2, scheduleId },
          laneOptions
        )
      ),
      (error) => {
        assert.equal(
          error.code,
          'ERR_ULG_WORKER_RESIDENT_SCHEDULE_TARGET_SCHEDULE_AUTHORITY_REQUIRED'
        );
        assert.equal(error.reason, 'target-schedule-authority-required');
        assert.equal(
          error.residentScheduleError?.stageId,
          'target-schedule-authority-preflight'
        );
        return true;
      }
    );
    assert.equal(providerCallCount, 0);
    assert.equal(mechanicsFixture.runnerCalls.length, 0);
    assert.equal(device.queue.submitCalls.length, submissionsBefore);
  } finally {
    releaseUlgMechanicsResidentStageWorkerLane(laneOptions);
  }
});

test('ULG worker schedule activates a dynamic law by rebuilding the first canonical SS epoch from the exact Tier0 terminal family', async () => {
  const device = createFakeGpuDevice();
  const buffers = lawsQuiescentSingleLaneBuffers();
  const laneOptions = {
    laneId: 'ulg:test:tier0-canonical-transition-lane',
    stateKey: 'ulg:test:tier0-canonical-transition-state'
  };
  await runUlgMechanicsResidentStageWorkerPayload(payload(
    workerLaneSeedStage(),
    workerSchroederStageContext(device, buffers, {
      schroederLaneSeed: workerLaneSeedStageOptions({
        hotBufferKey: 'ulg:sph-resident:tier0-canonical-transition',
        particleCount: 1,
        rematerializationSeedOverrides: {
          identityRequired: true,
          identityRevision: 'tier0-canonical-transition-identity',
          identitySchema: ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
          identityStrideBytes:
            SPH_GPU_PARTICLE_IDENTITY_UINTS * Uint32Array.BYTES_PER_ELEMENT,
          particleIdentityMutationApproved: true,
          requiresAuthoritativeFourBufferRows: true,
          outputParticleCapacity: 1
        }
      })
    }),
    null,
    laneOptions
  ));

  const tier0StepCount = 2;
  const tier0 = await runUlgMechanicsResidentStageWorkerSchedulePayload(
    schedulePayload(
      workerSchroederStageContext(device, buffers, {
        schroederSpatialEpoch: {
          selectedLevel: 0,
          mechanicsFieldViewsRequired: false
        },
        schroederSameLevelMechanics: {
          residentStepOptions: {
            contactSolverEnabled: false,
            ambientPressurePa: 0,
            activeGridSafetyCells: 1
          }
        }
      }),
      {
        stepCount: tier0StepCount,
        scheduleId: 'ulg:test:tier0-before-law-activation'
      },
      laneOptions
    )
  );
  const tier0TerminalLineage = tier0.finalMechanicsLineage;
  assert.equal(tier0.executionRouteReceipt.route, 'tier0-fused-resident-sequence');
  assert.equal(tier0.finalEpochSeal, null);
  assert.deepEqual(tier0.finalEpochIdentity, tier0TerminalLineage);
  const continuationAssignment = workerSchroederLevelAssignmentFixture(
    device,
    {
      particleCount: 1,
      storageGeneration: tier0TerminalLineage.storageGeneration + 1,
      physicsTick: tier0TerminalLineage.physicsTick + 1,
      positionEpoch: tier0TerminalLineage.positionEpoch + 1,
      sourceStateBuffer: null,
      label: 'worker-tier0-canonical-transition-step2'
    }
  );

  const classifierCalls = [];
  const laneProvider = createWorkerSchroederLaneLevelAssignmentProvider({
    ...laneOptions,
    classifierOptions: {
      minLevel: 0,
      maxLevel: 0,
      chartId: 0,
      baseGridSpacingM: 1
    },
    async levelAssignmentRunner(args) {
      classifierCalls.push(args);
      return runSchroederLevelAssignmentWebGpu(args);
    }
  });
  let providerCallCount = 0;
  const mechanicsFixture = workerSeededMechanicsRunnerFixture(device, {
    labelPrefix: 'worker-tier0-canonical-transition',
    particleCount: 1
  });
  const canonicalScheduleId = 'ulg:test:canonical-after-law-activation';
  const canonical = await runUlgMechanicsResidentStageWorkerSchedulePayload(
    schedulePayload(
      workerSchroederStageContext(device, buffers, {
        schroederSpatialEpoch: {
          selectedLevel: 0,
          mechanicsGrid: WORKER_SEED_MECHANICS_GRID,
          exactNearCellTreeEnabled: false,
          mechanicsFieldViewsRequired: false,
          async scheduleStepOptionsProvider() {
            providerCallCount += 1;
            return providerCallCount === 1
              ? laneProvider()
              : { levelAssignment: continuationAssignment };
          }
        },
        schroederSameLevelMechanics: {
          enableLawQueue: true,
          schroederSameLevelMechanicsRunner: mechanicsFixture.runner,
          residentStepOptions: {
            contactSolverEnabled: false,
            ambientPressurePa: 0
          }
        }
      }),
      { stepCount: 2, scheduleId: canonicalScheduleId },
      laneOptions
    )
  );
  const outerRouteAdmission =
    validateSchroederWorkerScheduleExecutionRouteReceipt(canonical, {
      scheduleId: canonicalScheduleId,
      laneId: laneOptions.laneId,
      stateKey: laneOptions.stateKey,
      requestedStepCount: 2
    });

  assert.equal(providerCallCount, 2);
  assert.equal(classifierCalls.length, 1);
  const classifierCall = classifierCalls[0];
  assert.equal(mechanicsFixture.runnerCalls.length, 2);
  assert.equal(canonical.lawActivationReceipt.lawQueue, true);
  assert.equal(canonical.lawActivationReceipt.contactSolverRequested, false);
  assert.equal(
    canonical.lawActivationReceipt.contactSolverEscalatedForDynamicLaws,
    true
  );
  assert.equal(canonical.lawActivationReceipt.contactSolver, true);
  assert.equal(
    mechanicsFixture.runnerCalls[0].residentStepOptions.contactSolverEnabled,
    true
  );
  assert.equal(canonical.executionRouteReceipt.route, 'canonical-schroeder');
  assert.equal(outerRouteAdmission.route, 'canonical-schroeder');
  assert.deepEqual(
    canonical.executionRouteReceipt.blockers,
    [
      'schedule-step-options-provider-present',
      'contact-solver-active',
      'law-queue-active'
    ]
  );
  assert.equal(
    canonical.executionRouteReceipt.transition,
    'tier0-to-canonical-schedule-boundary'
  );
  assert.ok(canonical.finalEpochSeal);
  for (const field of ULG_WORKER_SCHROEDER_LANE_SEED_LINEAGE_WORD_FIELDS) {
    assert.equal(
      classifierCall.sphParticleUpload[field],
      tier0TerminalLineage[field],
      `first classifier source ${field}`
    );
    assert.equal(
      canonical.finalEpochSeal[field],
      mechanicsFixture.runnerCalls[1].sphParticleUpload[field],
      `terminal canonical generation ${field}`
    );
  }
  assert.deepEqual(
    canonical.executionRouteReceipt.lineage.source,
    tier0TerminalLineage
  );
  assert.equal(
    classifierCall.sphParticleUpload,
    mechanicsFixture.runnerCalls[0].sphParticleUpload
  );
  assert.equal(
    classifierCall.mlsMpmParticleUpload,
    mechanicsFixture.runnerCalls[0].mlsMpmParticleUpload
  );
  assertNoWorkerGpuBuffers(canonical, 'canonicalAfterTier0');
  structuredClone(canonical);
});

test('ULG worker materializes exact 1-to-4 carriers before a static thermal canonical transition', async () => {
  const device = createFakeGpuDevice();
  const buffers = lawsQuiescentSingleLaneBuffers();
  const laneOptions = {
    laneId: 'ulg:test:tier0-one-to-four-lane',
    stateKey: 'ulg:test:tier0-one-to-four-state'
  };
  try {
    await runUlgMechanicsResidentStageWorkerPayload(payload(
      workerLaneSeedStage(),
      workerSchroederStageContext(device, buffers, {
        schroederLaneSeed: workerLaneSeedStageOptions({
          hotBufferKey: 'ulg:sph-resident:tier0-one-to-four',
          particleCount: 1,
          rematerializationSeedOverrides: {
            identityRequired: true,
            identityRevision: 'tier0-one-to-four-identity',
            identitySchema: ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
            identityStrideBytes:
              SPH_GPU_PARTICLE_IDENTITY_UINTS * Uint32Array.BYTES_PER_ELEMENT,
            particleIdentityMutationApproved: true,
            requiresAuthoritativeFourBufferRows: true,
            outputParticleCapacity: 1
          }
        })
      }),
      null,
      laneOptions
    ));

    const tier0 = await runUlgMechanicsResidentStageWorkerSchedulePayload(
      schedulePayload(
        workerSchroederStageContext(device, buffers, {
          schroederSpatialEpoch: {
            selectedLevel: 0,
            mechanicsFieldViewsRequired: false
          },
          schroederSameLevelMechanics: {
            residentStepOptions: {
              contactSolverEnabled: false,
              ambientPressurePa: 0,
              activeGridSafetyCells: 1
            }
          }
        }),
        {
          stepCount: 2,
          scheduleId: 'ulg:test:tier0-before-one-to-four'
        },
        laneOptions
      )
    );
    const tier0TerminalLineage = tier0.finalMechanicsLineage;
    assert.equal(
      tier0.executionRouteReceipt.route,
      'tier0-fused-resident-sequence'
    );

    const classifierCalls = [];
    const classifierOptions = {
      minLevel: 0,
      maxLevel: 0,
      chartId: 0,
      baseGridSpacingM: 1
    };
    const laneProvider = createWorkerSchroederLaneLevelAssignmentProvider({
      ...laneOptions,
      classifierOptions,
      async levelAssignmentRunner(args) {
        classifierCalls.push(args);
        return runSchroederLevelAssignmentWebGpu(args);
      }
    });
    const mechanicsFixture = workerSeededMechanicsRunnerFixture(device, {
      labelPrefix: 'worker-tier0-one-to-four',
      particleCount: 4
    });
    const referenceClosures = createReferenceMaterialClosures();
    const thermalMaterialTable = buildSphThermalMaterialTable({
      h2o: referenceClosures.h2o.properties
    });
    const scheduleId = 'ulg:test:thermal-after-tier0-one-to-four';
    const retainedContinuationScheduleId =
      'ulg:test:thermal-four-lane-retained-continuation';
    const reactionTable = thermalPhaseLatchReactionWatchTable();
    const canonicalEpochOptions = {
      selectedLevel: 0,
      mechanicsGrid: WORKER_SEED_MECHANICS_GRID,
      exactNearCellTreeEnabled: false,
      mechanicsFieldViewsRequired: false,
      scheduleStepOptionsProvider: laneProvider
    };
    const canonicalResidentStepOptions = {
      contactSolverEnabled: false,
      ambientPressurePa: 0,
      thermalMaterialTable,
      reactionTable
    };
    const canonicalMechanicsOptions = {
      schroederSameLevelMechanicsRunner: mechanicsFixture.runner,
      residentStepOptions: canonicalResidentStepOptions
    };
    const targetScheduleAuthority = workerTargetScheduleAuthority({
      scheduleId,
      targetScheduleRequestId: retainedContinuationScheduleId,
      laneId: laneOptions.laneId,
      stateKey: laneOptions.stateKey,
      sourceLineage: tier0TerminalLineage,
      stepCount: 1,
      residentStepOptions: canonicalResidentStepOptions,
      epochOptions: canonicalEpochOptions,
      mechanicsOptions: canonicalMechanicsOptions,
      providerKind: 'worker-lane-assignment-only',
      classifierOptions
    });
    const canonical =
      await runUlgMechanicsResidentStageWorkerSchedulePayload(
        schedulePayload(
          workerSchroederStageContext(device, buffers, {
            schroederSpatialEpoch: canonicalEpochOptions,
            schroederSameLevelMechanics: canonicalMechanicsOptions
          }),
          { stepCount: 1, scheduleId, targetScheduleAuthority },
          laneOptions
        )
      );
    const admitted = validateSchroederWorkerScheduleExecutionRouteReceipt(
      canonical,
      {
        scheduleId,
        laneId: laneOptions.laneId,
        stateKey: laneOptions.stateKey,
        requestedStepCount: 1,
        targetScheduleAuthority
      }
    );
    const transition = canonical.phaseCarrierOneToFourTransition;

    assert.equal(admitted.route, 'canonical-schroeder');
    assert.equal(canonical.lawActivationReceipt.thermal, true);
    assert.equal(
      mechanicsFixture.runnerCalls[0].residentStepOptions
        .reactionActivationMotionEnvelope.thermalPhaseEvolutionEnabled,
      true
    );
    assert.equal(
      canonical.nextScheduleLawActivationObservation.motionEnvelope
        .futureRestDiameterBoundStatus,
      'future-upper-unclaimed-trigger-positive'
    );
    assert.equal(
      canonical.nextScheduleLawActivationObservation.shadowOnly,
      SCHROEDER_DYNAMIC_LAW_ROUTING_SHADOW_ONLY
    );
    assert.equal(
      canonical.nextScheduleLawActivationObservation.routingAuthority,
      SCHROEDER_DYNAMIC_LAW_ROUTING_AUTHORITY
    );
    assert.equal(
      canonical.nextScheduleLawActivationObservation.targetScheduleRequestId,
      targetScheduleAuthority.targetScheduleRequestId
    );
    assert.equal(
      canonical.nextScheduleLawActivationObservation
        .targetScheduleAuthorityFingerprint,
      targetScheduleAuthority.requestFingerprint
    );
    assert.equal(
      canonical.nextScheduleLawActivationObservation.executionGating,
      SCHROEDER_DYNAMIC_LAW_ROUTING_EXECUTION_GATE
    );
    assert.equal(
      canonical.executionRouteReceipt.transition,
      'tier0-one-to-four-to-canonical-schedule-boundary'
    );
    assert.equal(transition.sourceParticleCount, 1);
    assert.equal(transition.terminalParticleCount, 4);
    assert.equal(transition.companionParticleCount, 3);
    assert.equal(transition.countSummary.exactCountAuthority, true);
    assert.equal(transition.commandSubmissionCount, 1);
    assert.equal(transition.fullParticleReadbackPerformed, false);
    assert.equal(transition.mapAsyncCount, 0);
    assert.equal(transition.readbackBytes, 0);
    assert.equal(transition.routingAuthority, false);
    assert.equal(transition.dynamicLawRoutingAuthority, false);
    assert.equal(
      transition.validationErrorScopeStatus,
      'validation-error-scope-clean'
    );
    assert.equal(transition.validationErrorObserved, false);
    assert.match(
      transition.materializationKernelRevision,
      /reserved-companions-v0$/
    );
    assert.match(
      transition.identityCorrespondenceRevision,
      /lane-major-v0$/
    );
    assert.equal(
      transition.terminalIdentityRevision,
      `${transition.sourceIdentityRevision}:phase-carrier-1-to-4:1->4:sg${
        transition.terminalLineage.storageGeneration
      }:te${transition.terminalLineage.topologyEpoch}`
    );
    assert.equal(
      transition.auxiliaryBufferOwnershipTransfer
        .terminalOwnershipAdopted,
      true
    );
    assert.equal(canonical.particleCardinality.sourceParticleCount, 1);
    assert.equal(canonical.particleCardinality.targetParticleCount, 4);
    assert.equal(
      canonical.particleCardinality.terminalStepParticleCount,
      4
    );
    assert.equal(
      canonical.particleCardinality.exactTargetParticleFamily,
      true
    );
    assert.deepEqual(transition.sourceLineage, tier0TerminalLineage);
    assert.deepEqual(transition.terminalLineage, {
      ...tier0TerminalLineage,
      storageGeneration: tier0TerminalLineage.storageGeneration + 1,
      topologyEpoch: tier0TerminalLineage.topologyEpoch + 1
    });
    assert.equal(
      transition.sourceRetirement.status,
      'phase-carrier-one-to-four-source-retired-after-terminal-fence'
    );
    assert.equal(transition.sourceRetirement.retiredSourceBufferCount, 4);
    assert.equal(classifierCalls.length, 1);
    assert.equal(classifierCalls[0].sphParticleUpload.particleCount, 4);
    assert.equal(
      classifierCalls[0].sphParticleUpload.phaseCarrierPlan.phaseLaneCount,
      4
    );
    assert.equal(
      classifierCalls[0].sphParticleUpload.identityBuffer.label,
      'ulg-sph-phase-carrier-one-to-four-identity'
    );
    assert.equal(mechanicsFixture.runnerCalls.length, 1);
    assert.equal(
      mechanicsFixture.runnerCalls[0].sphParticleUpload.particleCount,
      4
    );
    assert.equal(
      mechanicsFixture.runnerCalls[0].mlsMpmParticleUpload.particleCount,
      4
    );
    assert.deepEqual(
      canonical.executionRouteReceipt.lineage.source,
      tier0TerminalLineage
    );
    assert.equal(
      canonical.executionRouteReceipt.lineage.topologyChanged,
      true
    );
    assertNoWorkerGpuBuffers(canonical, 'oneToFourCanonicalResult');
    structuredClone(canonical);

    const retainedContinuationAssignment =
      workerSchroederLevelAssignmentFixture(device, {
        particleCount: 4,
        storageGeneration:
          canonical.finalMechanicsLineage.storageGeneration,
        physicsTick: canonical.finalMechanicsLineage.physicsTick,
        physicsSubstep: canonical.finalMechanicsLineage.physicsSubstep,
        positionEpoch: canonical.finalMechanicsLineage.positionEpoch,
        topologyEpoch: canonical.finalMechanicsLineage.topologyEpoch,
        chartEpoch: canonical.finalMechanicsLineage.chartEpoch,
        levelEpoch: canonical.finalMechanicsLineage.levelEpoch,
        supportEpoch: canonical.finalMechanicsLineage.supportEpoch,
        sourceStateBuffer: null,
        label: 'worker-four-lane-retained-continuation'
      });
    let retainedProviderCallCount = 0;
    const retainedContinuationProvider =
      createWorkerSchroederLaneLevelAssignmentProvider({
        ...laneOptions,
        classifierOptions,
        async levelAssignmentRunner() {
          retainedProviderCallCount += 1;
          return retainedContinuationAssignment;
        }
      });
    const retainedContinuationEpochOptions = {
      ...canonicalEpochOptions,
      scheduleStepOptionsProvider: retainedContinuationProvider
    };
    const retainedContinuationAuthority = workerTargetScheduleAuthority({
      scheduleId: retainedContinuationScheduleId,
      laneId: laneOptions.laneId,
      stateKey: laneOptions.stateKey,
      sourceLineage: canonical.finalMechanicsLineage,
      sourceParticleCount: 4,
      sourcePhaseLaneCount: 4,
      predecessorDynamicLawObservation:
        canonical.nextScheduleLawActivationObservation,
      stepCount: 1,
      residentStepOptions: canonicalResidentStepOptions,
      epochOptions: retainedContinuationEpochOptions,
      mechanicsOptions: canonicalMechanicsOptions,
      providerKind: 'worker-lane-assignment-only',
      classifierOptions
    });
    const retainedContinuation =
      await runUlgMechanicsResidentStageWorkerSchedulePayload(
        schedulePayload(
          workerSchroederStageContext(device, buffers, {
            schroederSpatialEpoch: retainedContinuationEpochOptions,
            schroederSameLevelMechanics: canonicalMechanicsOptions
          }),
          {
            stepCount: 1,
            scheduleId: retainedContinuationScheduleId,
            targetScheduleAuthority: retainedContinuationAuthority
          },
          laneOptions
        )
      );
    const retainedContinuationAdmission =
      validateSchroederWorkerScheduleExecutionRouteReceipt(
        retainedContinuation,
        {
          scheduleId: retainedContinuationScheduleId,
          laneId: laneOptions.laneId,
          stateKey: laneOptions.stateKey,
          requestedStepCount: 1,
          targetScheduleAuthority: retainedContinuationAuthority
        }
      );
    const retainedPredecessorConsumption =
      retainedContinuation.predecessorTargetTokenConsumption;
    assert.equal(retainedContinuationAdmission.route, 'canonical-schroeder');
    assert.deepEqual(
      retainedContinuation.executionRouteReceipt
        .predecessorTargetTokenConsumption,
      retainedPredecessorConsumption
    );
    assert.equal(
      retainedPredecessorConsumption.targetScheduleRequestId,
      retainedContinuationScheduleId
    );
    assert.equal(retainedPredecessorConsumption.sourceParticleCount, 4);
    assert.equal(retainedPredecessorConsumption.sourcePhaseLaneCount, 4);
    assert.equal(retainedPredecessorConsumption.consumedBeforeGpuWork, true);
    assert.equal(retainedProviderCallCount, 1);
    assert.equal(
      retainedContinuationAuthority.sourcePhaseLaneCount,
      4
    );
    assert.equal(retainedContinuationAuthority.sourceParticleCount, 4);
    assert.deepEqual(
      retainedContinuation.executionRouteReceipt.lineage.source,
      canonical.finalMechanicsLineage
    );
    assert.equal(
      retainedContinuation.executionRouteReceipt.transition,
      'fresh-or-canonical-continuation'
    );
    assert.equal(retainedContinuation.phaseCarrierOneToFourTransition, null);
    assert.equal(
      retainedContinuation.particleCardinality.sourceParticleCount,
      4
    );
    assert.equal(
      retainedContinuation.particleCardinality.targetParticleCount,
      4
    );
    assert.equal(
      retainedContinuation.nextScheduleLawActivationObservation
        .targetScheduleAuthorityFingerprint,
      retainedContinuationAuthority.requestFingerprint
    );
    assertNoWorkerGpuBuffers(
      retainedContinuation,
      'fourLaneRetainedContinuationResult'
    );
    structuredClone(retainedContinuation);
  } finally {
    releaseUlgMechanicsResidentStageWorkerLane({
      ...laneOptions,
      reason: 'one-to-four worker test complete'
    });
  }
});

test('ULG worker maps a terminal canonical dormant reaction watch only after its schedule fence', async () => {
  const device = createFakeGpuDevice();
  const buffers = lawsQuiescentSingleLaneBuffers();
  const laneOptions = {
    laneId: 'ulg:test:reaction-shadow-watch-lane',
    stateKey: 'ulg:test:reaction-shadow-watch-state'
  };
  const reactionRecords = new Float32Array([
    1, 2, 3, 100,
    -100, 1, 1, 1,
    1, 0, 0, 0
  ]);
  const reactionTable = authorizedReactionWatchTable(reactionRecords);

  try {
    await runUlgMechanicsResidentStageWorkerPayload(payload(
      workerLaneSeedStage(),
      workerSchroederStageContext(device, buffers, {
        schroederLaneSeed: workerLaneSeedStageOptions({
          hotBufferKey: 'ulg:sph-resident:reaction-shadow-watch',
          particleCount: 1,
          rematerializationSeedOverrides: {
            identityRequired: true,
            identityRevision: 'reaction-shadow-watch-identity',
            identitySchema: ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
            identityStrideBytes:
              SPH_GPU_PARTICLE_IDENTITY_UINTS * Uint32Array.BYTES_PER_ELEMENT,
            particleIdentityMutationApproved: true,
            requiresAuthoritativeFourBufferRows: true,
            outputParticleCapacity: 1
          }
        })
      }),
      null,
      laneOptions
    ));

    const boundaryEvents = [];
    const originalCreateBuffer = device.createBuffer.bind(device);
    device.createBuffer = (descriptor = {}) => {
      const buffer = originalCreateBuffer(descriptor);
      if (descriptor.label?.includes('reaction-motion-watch-readback')) {
        const originalMapAsync = buffer.mapAsync.bind(buffer);
        buffer.mapAsync = (...args) => {
          boundaryEvents.push('activation-map');
          return originalMapAsync(...args);
        };
      }
      return buffer;
    };
    const originalSubmit = device.queue.submit.bind(device.queue);
    device.queue.submit = (commandBuffers) => {
      for (const commandBuffer of commandBuffers || []) {
        for (const operation of commandBuffer || []) {
          if (
            operation.type === 'copy'
            && operation.source?.label?.includes(
              'reaction-motion-watch-control'
            )
          ) {
            // The private GPU word biases real counts by one; zero remains
            // the fail-closed/uninitialized value.
            new Uint32Array(operation.source.bytes.buffer)[0] = 2;
          }
        }
      }
      return originalSubmit(commandBuffers);
    };
    const originalFence = device.queue.onSubmittedWorkDone.bind(device.queue);
    device.queue.onSubmittedWorkDone = (...args) => {
      boundaryEvents.push('queue-fence');
      return originalFence(...args);
    };

    const mechanicsFixture = workerSeededMechanicsRunnerFixture(device, {
      labelPrefix: 'worker-reaction-shadow-watch',
      particleCount: 1
    });
    const mechanicsRunner = async (args) => {
      const result = await mechanicsFixture.runner(args);
      assert.equal(
        args.residentStepOptions.captureReactionActivationObservation,
        true
      );
      assert.equal(args.residentStepOptions.reactionTable, undefined);
      assert.equal(
        args.residentStepOptions.reactionActivationWatchTable,
        reactionTable
      );
      assert.equal(
        isExactSphReactionMotionEnvelope(
          args.residentStepOptions.reactionActivationMotionEnvelope
        ),
        true
      );
      assert.equal(
        Object.isFrozen(
          args.residentStepOptions.reactionActivationMotionEnvelope?.boxDimsM
        ),
        true
      );
      assert.equal(
        args.residentStepOptions.reactionActivationMotionEnvelope
          ?.maxFutureSubsteps,
        1
      );
      assert.equal(
        args.residentStepOptions.reactionActivationMotionEnvelope
          ?.separationDisplacementEnabled,
        true
      );
      assert.equal(
        args.residentStepOptions.reactionActivationMotionEnvelope
          ?.contactCorrectionEnabled,
        false
      );
      assert.equal(
        args.residentStepOptions.reactionActivationMotionEnvelope
          ?.thermalPhaseEvolutionEnabled,
        false
      );
      assert.deepEqual(
        args.residentStepOptions.reactionActivationMotionEnvelope?.boxDimsM,
        [5, 5, 5]
      );
      const terminalUploads = result.residentStep.nextParticleUploads;
      const proposal =
        runCanonicalSphReactionMotionEnvelopeWatchWebGpu({
          device,
          terminalStateBuffer:
            terminalUploads.sphParticleUpload.stateBuffer,
          terminalThermoBuffer:
            terminalUploads.sphParticleUpload.thermoBuffer,
          terminalMechanicsBuffer:
            terminalUploads.mlsMpmParticleUpload.mechanicsBuffer,
          reactionTable,
          reactionMotionEnvelope:
            args.residentStepOptions.reactionActivationMotionEnvelope,
          particleCount: terminalUploads.sphParticleUpload.particleCount,
          boxDimsM: [5, 5, 5]
        });
      Object.defineProperty(
        result.residentStep,
        'reactionActivationObservationProposal',
        {
          configurable: true,
          enumerable: false,
          value: proposal
        }
      );
      return result;
    };
    const scheduleId = 'ulg:test:reaction-shadow-watch-schedule';
    const reactionWatchEpochOptions = {
      selectedLevel: 0,
      mechanicsGrid: WORKER_SEED_MECHANICS_GRID,
      exactNearCellTreeEnabled: true,
      mechanicsFieldViewsRequired: false
    };
    const reactionWatchResidentStepOptions = {
      contactSolverEnabled: false,
      ambientPressurePa: 0,
      reactionActivationWatchTable: reactionTable
    };
    const reactionWatchMechanicsOptions = {
      schroederSameLevelMechanicsRunner: mechanicsRunner,
      residentStepOptions: reactionWatchResidentStepOptions
    };
    const targetScheduleAuthority = workerTargetScheduleAuthority({
      scheduleId,
      laneId: laneOptions.laneId,
      stateKey: laneOptions.stateKey,
      stepCount: 1,
      residentStepOptions: reactionWatchResidentStepOptions,
      epochOptions: reactionWatchEpochOptions,
      mechanicsOptions: reactionWatchMechanicsOptions
    });
    const result = await runUlgMechanicsResidentStageWorkerSchedulePayload(
      schedulePayload(
        workerSchroederStageContext(device, buffers, {
          schroederSpatialEpoch: reactionWatchEpochOptions,
          schroederSameLevelMechanics: reactionWatchMechanicsOptions
        }),
        {
          stepCount: 1,
          scheduleId,
          targetScheduleAuthority: structuredClone(targetScheduleAuthority)
        },
        laneOptions
      )
    );
    const outerAdmission =
      validateSchroederWorkerScheduleExecutionRouteReceipt(result, {
        scheduleId,
        laneId: laneOptions.laneId,
        stateKey: laneOptions.stateKey,
        requestedStepCount: 1,
        targetScheduleAuthority
      });

    const observation = result.nextScheduleLawActivationObservation;
    assert.equal(outerAdmission.route, 'canonical-schroeder');
    assert.equal(
      observation.schema,
      ULG_WORKER_SCHEDULE_DYNAMIC_LAW_OBSERVATION_SCHEMA
    );
    assert.equal(observation.status, 'dynamic-law-routing-observation-ready');
    assert.equal(
      observation.shadowOnly,
      SCHROEDER_DYNAMIC_LAW_ROUTING_SHADOW_ONLY
    );
    assert.equal(
      observation.routingAuthority,
      SCHROEDER_DYNAMIC_LAW_ROUTING_AUTHORITY
    );
    assert.equal(
      observation.targetScheduleRequestId,
      targetScheduleAuthority.targetScheduleRequestId
    );
    assert.equal(
      observation.targetScheduleAuthorityFingerprint,
      targetScheduleAuthority.requestFingerprint
    );
    assert.equal(observation.producerRoute, 'canonical-schroeder');
    assert.equal(
      observation.sampleStage,
      'canonical-terminal-published-carrier-family-motion-envelope'
    );
    assert.equal(observation.nodeDomain, 'fixed-phase-carrier-slot');
    assert.equal(observation.motionEnvelope.maxFutureSubsteps, 1);
    assert.equal(observation.motionEnvelope.contactCorrectionEnabled, false);
    assert.equal(observation.motionEnvelope.thermalPhaseEvolutionEnabled, false);
    assert.equal(
      observation.motionEnvelope.futureRestDiameterBoundStatus,
      'terminal-upper-under-declared-no-writer-premise'
    );
    assert.equal(
      observation.motionEnvelope.separationDisplacementEnabled,
      true
    );
    assert.equal(
      observation.motionEnvelope.contactMotionBoundRevision,
      SPH_CANONICAL_CONTACT_MOTION_BOUND_REVISION
    );
    assert.equal(
      observation.motionEnvelope.contactPositionTrustDiameters,
      SPH_CANONICAL_CONTACT_POSITION_TRUST_DIAMETERS
    );
    assert.deepEqual(observation.motionEnvelope.boxDimsM, [5, 5, 5]);
    assert.equal(
      observation.executionGating,
      SCHROEDER_DYNAMIC_LAW_ROUTING_EXECUTION_GATE
    );
    assert.equal(observation.observationSucceeded, true);
    assert.equal(observation.triggered, true);
    assert.equal(observation.triggeredSourceCount, 1);
    assert.equal(observation.mapAsyncCount, 1);
    assert.equal(observation.readbackByteLength, Uint32Array.BYTES_PER_ELEMENT);
    assert.deepEqual(observation.terminalLineage, result.finalMechanicsLineage);
    assert.deepEqual(
      result.executionRouteReceipt.nextScheduleLawActivationObservation,
      observation
    );
    assert.equal(result.lawActivationReceipt.reaction, false);
    assert.equal(
      targetScheduleAuthority.tableFingerprints.watchReactionTableSource,
      'reaction-activation-watch-table'
    );
    assert.equal(
      result.lawActivationReceipt.activationAuthority,
      'schedule-config-static-declaration-no-readback'
    );
    assert.deepEqual(boundaryEvents, ['queue-fence', 'activation-map']);
    assertNoWorkerGpuBuffers(result, 'reactionShadowWatchResult');
    structuredClone(result);
  } finally {
    releaseUlgMechanicsResidentStageWorkerLane(laneOptions);
  }
});

test('ULG worker treats an unauthenticated compact watch proposal as fatal evidence', async () => {
  const device = createFakeGpuDevice();
  const buffers = lawsQuiescentSingleLaneBuffers();
  const laneOptions = {
    laneId: 'ulg:test:forged-reaction-watch-lane',
    stateKey: 'ulg:test:forged-reaction-watch-state'
  };
  const reactionTable = thermalPhaseLatchReactionWatchTable();
  try {
    await runUlgMechanicsResidentStageWorkerPayload(payload(
      workerLaneSeedStage(),
      workerSchroederStageContext(device, buffers, {
        schroederLaneSeed: workerLaneSeedStageOptions({
          hotBufferKey: 'ulg:sph-resident:forged-reaction-watch',
          particleCount: 1,
          rematerializationSeedOverrides: {
            identityRequired: true,
            identityRevision: 'forged-reaction-watch-identity',
            identitySchema: ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
            identityStrideBytes:
              SPH_GPU_PARTICLE_IDENTITY_UINTS
              * Uint32Array.BYTES_PER_ELEMENT,
            particleIdentityMutationApproved: true,
            requiresAuthoritativeFourBufferRows: true,
            outputParticleCapacity: 1
          }
        })
      }),
      null,
      laneOptions
    ));

    let forgedDestroyCount = 0;
    const mechanicsFixture = workerSeededMechanicsRunnerFixture(device, {
      labelPrefix: 'worker-forged-reaction-watch',
      particleCount: 1
    });
    const mechanicsRunner = async (args) => {
      const result = await mechanicsFixture.runner(args);
      const forgedProposal = Object.freeze({
        schema: ULG_SPH_REACTION_MOTION_ENVELOPE_WATCH_PROPOSAL_SCHEMA,
        ready: true,
        destroy() { forgedDestroyCount += 1; }
      });
      Object.defineProperty(
        result.residentStep,
        'reactionActivationObservationProposal',
        {
          configurable: true,
          enumerable: false,
          value: forgedProposal
        }
      );
      return result;
    };
    const scheduleId = 'ulg:test:forged-reaction-watch-schedule';
    const epochOptions = {
      selectedLevel: 0,
      mechanicsGrid: WORKER_SEED_MECHANICS_GRID,
      exactNearCellTreeEnabled: false,
      mechanicsFieldViewsRequired: false
    };
    const residentStepOptions = {
      contactSolverEnabled: false,
      ambientPressurePa: 0,
      reactionTable
    };
    const mechanicsOptions = {
      schroederSameLevelMechanicsRunner: mechanicsRunner,
      residentStepOptions
    };
    const targetScheduleAuthority = workerTargetScheduleAuthority({
      scheduleId,
      laneId: laneOptions.laneId,
      stateKey: laneOptions.stateKey,
      stepCount: 1,
      residentStepOptions,
      epochOptions,
      mechanicsOptions
    });
    await assert.rejects(
      runUlgMechanicsResidentStageWorkerSchedulePayload(
        schedulePayload(
          workerSchroederStageContext(device, buffers, {
            schroederSpatialEpoch: epochOptions,
            schroederSameLevelMechanics: mechanicsOptions
          }),
          {
            stepCount: 1,
            scheduleId,
            targetScheduleAuthority: structuredClone(targetScheduleAuthority)
          },
          laneOptions
        )
      ),
      (error) => {
        assert.equal(
          error.reason,
          'reaction-activation-observation-malformed-evidence'
        );
        assert.match(
          error.message,
          /reaction-activation-observation-malformed-evidence/
        );
        return true;
      }
    );
    assert.equal(forgedDestroyCount, 1);
    await assert.rejects(
      runUlgMechanicsResidentStageWorkerSchedulePayload(
        schedulePayload(
          workerSchroederStageContext(device, buffers, {
            schroederSpatialEpoch: epochOptions,
            schroederSameLevelMechanics: mechanicsOptions
          }),
          {
            stepCount: 1,
            scheduleId: `${scheduleId}:must-not-consume-successor`
          },
          laneOptions
        )
      ),
      /lane-terminal-fence-poisoned/
    );
  } finally {
    releaseUlgMechanicsResidentStageWorkerLane(laneOptions);
  }
});

test('ULG worker rejects an authentic watch over a superseded terminal storage family before mapping', async () => {
  const device = createFakeGpuDevice();
  const buffers = lawsQuiescentSingleLaneBuffers();
  const laneOptions = {
    laneId: 'ulg:test:superseded-reaction-watch-lane',
    stateKey: 'ulg:test:superseded-reaction-watch-state'
  };
  const reactionTable = thermalPhaseLatchReactionWatchTable();
  let proposal = null;
  let watchMapCount = 0;
  const originalCreateBuffer = device.createBuffer.bind(device);
  device.createBuffer = (descriptor = {}) => {
    const buffer = originalCreateBuffer(descriptor);
    if (descriptor.label?.includes('reaction-motion-watch-readback')) {
      const mapAsync = buffer.mapAsync.bind(buffer);
      buffer.mapAsync = (...args) => {
        watchMapCount += 1;
        return mapAsync(...args);
      };
    }
    return buffer;
  };
  try {
    await runUlgMechanicsResidentStageWorkerPayload(payload(
      workerLaneSeedStage(),
      workerSchroederStageContext(device, buffers, {
        schroederLaneSeed: workerLaneSeedStageOptions({
          hotBufferKey: 'ulg:sph-resident:superseded-reaction-watch',
          particleCount: 1,
          rematerializationSeedOverrides: {
            identityRequired: true,
            identityRevision: 'superseded-reaction-watch-identity',
            identitySchema: ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
            identityStrideBytes:
              SPH_GPU_PARTICLE_IDENTITY_UINTS
              * Uint32Array.BYTES_PER_ELEMENT,
            particleIdentityMutationApproved: true,
            requiresAuthoritativeFourBufferRows: true,
            outputParticleCapacity: 1
          }
        })
      }),
      null,
      laneOptions
    ));

    const mechanicsFixture = workerSeededMechanicsRunnerFixture(device, {
      labelPrefix: 'worker-superseded-reaction-watch',
      particleCount: 1
    });
    const mechanicsRunner = async (args) => {
      const predecessorSphUpload = args.sphParticleUpload;
      const predecessorMlsUpload = args.mlsMpmParticleUpload;
      const result = await mechanicsFixture.runner(args);
      proposal = runCanonicalSphReactionMotionEnvelopeWatchWebGpu({
        device,
        terminalStateBuffer: predecessorSphUpload.stateBuffer,
        terminalThermoBuffer: predecessorSphUpload.thermoBuffer,
        terminalMechanicsBuffer: predecessorMlsUpload.mechanicsBuffer,
        reactionTable,
        reactionMotionEnvelope:
          args.residentStepOptions.reactionActivationMotionEnvelope,
        particleCount: predecessorSphUpload.particleCount,
        boxDimsM: [5, 5, 5]
      });
      Object.defineProperty(
        result.residentStep,
        'reactionActivationObservationProposal',
        {
          configurable: true,
          enumerable: false,
          value: proposal
        }
      );
      return result;
    };
    const scheduleId = 'ulg:test:superseded-reaction-watch-schedule';
    const epochOptions = {
      selectedLevel: 0,
      mechanicsGrid: WORKER_SEED_MECHANICS_GRID,
      exactNearCellTreeEnabled: true,
      mechanicsFieldViewsRequired: false
    };
    const residentStepOptions = {
      contactSolverEnabled: false,
      ambientPressurePa: 0,
      reactionActivationWatchTable: reactionTable
    };
    const mechanicsOptions = {
      schroederSameLevelMechanicsRunner: mechanicsRunner,
      residentStepOptions
    };
    const targetScheduleAuthority = workerTargetScheduleAuthority({
      scheduleId,
      laneId: laneOptions.laneId,
      stateKey: laneOptions.stateKey,
      stepCount: 1,
      residentStepOptions,
      epochOptions,
      mechanicsOptions
    });
    await assert.rejects(
      runUlgMechanicsResidentStageWorkerSchedulePayload(
        schedulePayload(
          workerSchroederStageContext(device, buffers, {
            schroederSpatialEpoch: epochOptions,
            schroederSameLevelMechanics: mechanicsOptions
          }),
          {
            stepCount: 1,
            scheduleId,
            targetScheduleAuthority: structuredClone(targetScheduleAuthority)
          },
          laneOptions
        )
      ),
      (error) => {
        assert.equal(
          error.reason,
          'reaction-activation-observation-malformed-evidence'
        );
        assert.match(error.message, /exact terminal particle storage family/);
        return true;
      }
    );
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(watchMapCount, 0);
    assert.equal(proposal?.released, true);
    await assert.rejects(
      runUlgMechanicsResidentStageWorkerSchedulePayload(
        schedulePayload(
          workerSchroederStageContext(device, buffers, {
            schroederSpatialEpoch: epochOptions,
            schroederSameLevelMechanics: mechanicsOptions
          }),
          { stepCount: 1, scheduleId: `${scheduleId}:poisoned-reuse` },
          laneOptions
        )
      ),
      /lane-terminal-fence-poisoned/
    );
  } finally {
    releaseUlgMechanicsResidentStageWorkerLane(laneOptions);
  }
});

test('ULG worker makes device loss during terminal watch observation fatal to the retained lane', async () => {
  const device = createFakeGpuDevice();
  let resolveDeviceLoss;
  device.lost = new Promise((resolve) => {
    resolveDeviceLoss = resolve;
  });
  const buffers = lawsQuiescentSingleLaneBuffers();
  const laneOptions = {
    laneId: 'ulg:test:lost-device-reaction-watch-lane',
    stateKey: 'ulg:test:lost-device-reaction-watch-state'
  };
  const reactionTable = thermalPhaseLatchReactionWatchTable();
  let proposal = null;
  let resolveMapStarted;
  const mapStarted = new Promise((resolve) => {
    resolveMapStarted = resolve;
  });
  const pendingMap = new Promise(() => {});
  const watchOwnedBuffers = [];
  const originalCreateBuffer = device.createBuffer.bind(device);
  device.createBuffer = (descriptor = {}) => {
    const buffer = originalCreateBuffer(descriptor);
    if (
      descriptor.label?.includes('reaction-motion-watch')
      || descriptor.label?.startsWith('ulg-mls-mpm-terminal-motion-watch-')
    ) {
      watchOwnedBuffers.push(buffer);
    }
    if (descriptor.label?.includes('reaction-motion-watch-readback')) {
      buffer.mapAsync = () => {
        resolveMapStarted();
        return pendingMap;
      };
    }
    return buffer;
  };
  try {
    await runUlgMechanicsResidentStageWorkerPayload(payload(
      workerLaneSeedStage(),
      workerSchroederStageContext(device, buffers, {
        schroederLaneSeed: workerLaneSeedStageOptions({
          hotBufferKey: 'ulg:sph-resident:lost-device-reaction-watch',
          particleCount: 1,
          rematerializationSeedOverrides: {
            identityRequired: true,
            identityRevision: 'lost-device-reaction-watch-identity',
            identitySchema: ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
            identityStrideBytes:
              SPH_GPU_PARTICLE_IDENTITY_UINTS
              * Uint32Array.BYTES_PER_ELEMENT,
            particleIdentityMutationApproved: true,
            requiresAuthoritativeFourBufferRows: true,
            outputParticleCapacity: 1
          }
        })
      }),
      null,
      laneOptions
    ));

    const mechanicsFixture = workerSeededMechanicsRunnerFixture(device, {
      labelPrefix: 'worker-lost-device-reaction-watch',
      particleCount: 1
    });
    const mechanicsRunner = async (args) => {
      const result = await mechanicsFixture.runner(args);
      const terminalUploads = result.residentStep.nextParticleUploads;
      proposal = runCanonicalSphReactionMotionEnvelopeWatchWebGpu({
        device,
        terminalStateBuffer:
          terminalUploads.sphParticleUpload.stateBuffer,
        terminalThermoBuffer:
          terminalUploads.sphParticleUpload.thermoBuffer,
        terminalMechanicsBuffer:
          terminalUploads.mlsMpmParticleUpload.mechanicsBuffer,
        reactionTable,
        reactionMotionEnvelope:
          args.residentStepOptions.reactionActivationMotionEnvelope,
        particleCount: terminalUploads.sphParticleUpload.particleCount,
        boxDimsM: [5, 5, 5]
      });
      Object.defineProperty(
        result.residentStep,
        'reactionActivationObservationProposal',
        {
          configurable: true,
          enumerable: false,
          value: proposal
        }
      );
      return result;
    };
    const scheduleId = 'ulg:test:lost-device-reaction-watch-schedule';
    const epochOptions = {
      selectedLevel: 0,
      mechanicsGrid: WORKER_SEED_MECHANICS_GRID,
      exactNearCellTreeEnabled: true,
      mechanicsFieldViewsRequired: false
    };
    const residentStepOptions = {
      contactSolverEnabled: false,
      ambientPressurePa: 0,
      reactionActivationWatchTable: reactionTable
    };
    const mechanicsOptions = {
      schroederSameLevelMechanicsRunner: mechanicsRunner,
      residentStepOptions
    };
    const targetScheduleAuthority = workerTargetScheduleAuthority({
      scheduleId,
      laneId: laneOptions.laneId,
      stateKey: laneOptions.stateKey,
      stepCount: 1,
      residentStepOptions,
      epochOptions,
      mechanicsOptions
    });
    const schedulePromise = runUlgMechanicsResidentStageWorkerSchedulePayload(
      schedulePayload(
        workerSchroederStageContext(device, buffers, {
          schroederSpatialEpoch: epochOptions,
          schroederSameLevelMechanics: mechanicsOptions
        }),
        {
          stepCount: 1,
          scheduleId,
          targetScheduleAuthority: structuredClone(targetScheduleAuthority)
        },
        laneOptions
      )
    );
    await mapStarted;
    resolveDeviceLoss({ reason: 'destroyed' });
    await assert.rejects(schedulePromise, (error) => {
      assert.equal(
        error.reason,
        'reaction-activation-observation-device-lost'
      );
      assert.match(error.message, /device was lost while MAP_READ was pending/);
      return true;
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(proposal?.released, true);
    assert.equal(proposal?.quarantined, false);
    assert.equal(watchOwnedBuffers.length, 6);
    assert.ok(watchOwnedBuffers.every(({ destroyCount }) => destroyCount === 1));
    await assert.rejects(
      runUlgMechanicsResidentStageWorkerSchedulePayload(
        schedulePayload(
          workerSchroederStageContext(device, buffers, {
            schroederSpatialEpoch: epochOptions,
            schroederSameLevelMechanics: mechanicsOptions
          }),
          { stepCount: 1, scheduleId: `${scheduleId}:poisoned-reuse` },
          laneOptions
        )
      ),
      /lane-terminal-fence-poisoned/
    );

    assert.equal(
      releaseUlgMechanicsResidentStageWorkerLane({
        ...laneOptions,
        reason: 'replace-lost-watch-device'
      }).released,
      true
    );
    const replacementDevice = createFakeGpuDevice();
    const reseeded = await runUlgMechanicsResidentStageWorkerPayload(payload(
      workerLaneSeedStage(),
      workerSchroederStageContext(replacementDevice, buffers, {
        schroederLaneSeed: workerLaneSeedStageOptions({
          hotBufferKey: 'ulg:sph-resident:replacement-reaction-watch',
          particleCount: 1,
          rematerializationSeedOverrides: {
            identityRequired: true,
            identityRevision: 'replacement-reaction-watch-identity',
            identitySchema: ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
            identityStrideBytes:
              SPH_GPU_PARTICLE_IDENTITY_UINTS
              * Uint32Array.BYTES_PER_ELEMENT,
            particleIdentityMutationApproved: true,
            requiresAuthoritativeFourBufferRows: true,
            outputParticleCapacity: 1
          }
        })
      }),
      null,
      laneOptions
    ));
    assert.equal(reseeded.value.status, 'worker-schroeder-lane-seeded');
  } finally {
    releaseUlgMechanicsResidentStageWorkerLane(laneOptions);
  }
});

test('ULG worker target authority rejects a malformed reaction table before schedule GPU work', async () => {
  const device = createFakeGpuDevice();
  const buffers = lawsQuiescentSingleLaneBuffers();
  const laneOptions = {
    laneId: 'ulg:test:tier0-malformed-reaction-lane',
    stateKey: 'ulg:test:tier0-malformed-reaction-state'
  };
  await runUlgMechanicsResidentStageWorkerPayload(payload(
    workerLaneSeedStage(),
    workerSchroederStageContext(device, buffers, {
      schroederLaneSeed: workerLaneSeedStageOptions({
        hotBufferKey: 'ulg:sph-resident:tier0-malformed-reaction',
        particleCount: 1,
        rematerializationSeedOverrides: {
          identityRequired: true,
          identityRevision: 'tier0-malformed-reaction-identity',
          identitySchema: ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
          identityStrideBytes:
            SPH_GPU_PARTICLE_IDENTITY_UINTS * Uint32Array.BYTES_PER_ELEMENT,
          particleIdentityMutationApproved: true,
          requiresAuthoritativeFourBufferRows: true,
          outputParticleCapacity: 1
        }
      })
    }),
    null,
    laneOptions
  ));

  const mechanicsFixture = workerSeededMechanicsRunnerFixture(device, {
    labelPrefix: 'worker-tier0-malformed-reaction',
    particleCount: 1
  });
  const scheduleId = 'ulg:test:tier0-malformed-reaction-schedule';
  const malformedReactionTable = {
    schema: 'peercompute.ulg.sph-gpu-reaction-table.v1',
    status: 'no-derived-reactions',
    reactionCount: -1,
    combinedRecords: new Float32Array(0)
  };
  const malformedReactionEpochOptions = {
    selectedLevel: 0,
    mechanicsGrid: WORKER_SEED_MECHANICS_GRID,
    exactNearCellTreeEnabled: false,
    mechanicsFieldViewsRequired: false
  };
  const malformedReactionResidentStepOptions = {
    contactSolverEnabled: false,
    ambientPressurePa: 0,
    reactionTable: malformedReactionTable
  };
  const malformedReactionMechanicsOptions = {
    schroederSameLevelMechanicsRunner: mechanicsFixture.runner,
    residentStepOptions: malformedReactionResidentStepOptions
  };
  const submitCount = device.queue.submitCalls.length;
  const writeCount = device.queue.writeBufferCalls.length;
  assert.throws(
    () => workerTargetScheduleAuthority({
      scheduleId,
      laneId: laneOptions.laneId,
      stateKey: laneOptions.stateKey,
      stepCount: 1,
      residentStepOptions: malformedReactionResidentStepOptions,
      epochOptions: malformedReactionEpochOptions,
      mechanicsOptions: malformedReactionMechanicsOptions
    }),
    /authorized reaction watch table requires the ready packed v1 schema/
  );
  assert.equal(device.queue.submitCalls.length, submitCount);
  assert.equal(device.queue.writeBufferCalls.length, writeCount);
  assert.equal(mechanicsFixture.runnerCalls.length, 0);
  releaseUlgMechanicsResidentStageWorkerLane(laneOptions);
});

test('ULG resident stage worker retires superseded lanes and their GPU buffers before a fresh seed', async () => {
  const device = createFakeGpuDevice();
  const buffers = manualBuffers();
  const retiredLane = {
    laneId: 'ulg:test:schroeder-retired-lane',
    stateKey: 'ulg:test:schroeder-retired-state'
  };
  const replacementLane = {
    laneId: 'ulg:test:schroeder-replacement-lane',
    stateKey: 'ulg:test:schroeder-replacement-state'
  };
  const seed = (laneOptions, seedOptionOverrides = {}) =>
    runUlgMechanicsResidentStageWorkerPayload(payload(
      workerLaneSeedStage(),
      workerSchroederStageContext(device, buffers, {
        schroederLaneSeed: workerLaneSeedStageOptions({
          hotBufferKey: `ulg:sph-resident:${laneOptions.laneId}`,
          seedOptionOverrides
        })
      }),
      null,
      laneOptions
    ));

  const first = await seed(retiredLane);
  assert.equal(first.value.status, 'worker-schroeder-lane-seeded');
  const replacement = await seed(replacementLane, { retireLane: retiredLane });
  assert.equal(replacement.value.status, 'worker-schroeder-lane-seeded');
  assert.equal(
    replacement.value.retiredLaneReceipt?.status,
    'worker-resident-lane-released'
  );
  assert.equal(replacement.value.retiredLaneReceipt?.released, true);
  assert.ok(replacement.value.retiredLaneReceipt?.destroyedBufferCount > 0);
  assert.equal(
    releaseUlgMechanicsResidentStageWorkerLane(retiredLane).status,
    'worker-resident-lane-release-noop-missing'
  );
  assert.equal(
    releaseUlgMechanicsResidentStageWorkerLane(replacementLane).status,
    'worker-resident-lane-released'
  );
});

test('ULG resident stage worker lane seed fails closed on missing lineage words and never invents them', async () => {
  const device = createFakeGpuDevice();
  const buffers = manualBuffers();
  const laneOptions = {
    laneId: 'ulg:test:schroeder-seed-lineage-lane',
    stateKey: 'ulg:test:schroeder-seed-lineage-state'
  };
  const seedPayload = (lineage) => payload(
    workerLaneSeedStage(),
    workerSchroederStageContext(device, buffers, {
      schroederLaneSeed: workerLaneSeedStageOptions({
        hotBufferKey: 'ulg:sph-resident-schroeder-adopted-storage:seed-lineage',
        lineage
      })
    }),
    null,
    laneOptions
  );

  // A missing word is refused by name.
  const { positionEpoch: omitted, ...missingPositionEpoch } =
    WORKER_LANE_SEED_DEFAULT_LINEAGE;
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerPayload(seedPayload(missingPositionEpoch)),
    (error) => {
      assert.equal(error.reason, 'seed-lineage-missing');
      assert.equal(error.code, 'ERR_ULG_WORKER_SCHROEDER_SEED_LINEAGE_MISSING');
      assert.match(error.message, /positionEpoch/);
      return true;
    }
  );
  // A non-finite word is refused the same way.
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerPayload(seedPayload({
      ...WORKER_LANE_SEED_DEFAULT_LINEAGE,
      physicsTick: Number.NaN
    })),
    (error) => {
      assert.equal(error.reason, 'seed-lineage-missing');
      assert.match(error.message, /physicsTick/);
      return true;
    }
  );
  // A lineage object missing entirely is refused with the full word list.
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerPayload(seedPayload(null)),
    (error) => {
      assert.equal(error.reason, 'seed-lineage-missing');
      assert.match(error.message, /storageGeneration.*supportEpoch/);
      return true;
    }
  );
  // A malformed particle-storage descriptor is refused with the exact W1
  // machinery verdict (the seed reuses that machinery, never duplicates it).
  const notReadyOptions = workerLaneSeedStageOptions({
    hotBufferKey: 'ulg:sph-resident-schroeder-adopted-storage:seed-lineage'
  });
  notReadyOptions.schroederAdoptedParticleStorageWorkerRematerializationSeed = {
    ...notReadyOptions.schroederAdoptedParticleStorageWorkerRematerializationSeed,
    ready: false
  };
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerPayload(payload(
      workerLaneSeedStage(),
      workerSchroederStageContext(device, buffers, {
        schroederLaneSeed: notReadyOptions
      }),
      null,
      laneOptions
    )),
    (error) => {
      assert.equal(error.reason, 'seed-particle-storage-rematerialization-blocked');
      assert.match(
        error.message,
        /blocked-worker-adopted-storage-rematerialization-seed-not-ready/
      );
      return true;
    }
  );
  // A seed that never requested the W1 rematerialization is refused too.
  const noRematOptions = workerLaneSeedStageOptions({
    hotBufferKey: 'ulg:sph-resident-schroeder-adopted-storage:seed-lineage'
  });
  delete noRematOptions.useSchroederAdoptedParticleStorageWorkerRematerialization;
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerPayload(payload(
      workerLaneSeedStage(),
      workerSchroederStageContext(device, buffers, {
        schroederLaneSeed: noRematOptions
      }),
      null,
      laneOptions
    )),
    (error) => {
      assert.equal(error.reason, 'seed-particle-storage-rematerialization-blocked');
      return true;
    }
  );

  // The refusals did not poison the lane: a complete lineage still seeds it.
  const seeded = await runUlgMechanicsResidentStageWorkerPayload(
    seedPayload(WORKER_LANE_SEED_DEFAULT_LINEAGE)
  );
  assert.equal(seeded.value.status, 'worker-schroeder-lane-seeded');
  assertNoWorkerGpuBuffers(seeded, 'seededAfterRefusals');
  structuredClone(seeded.value);
});

test('ULG resident stage worker lane seed surfaces the real family-resolver rejection truthfully', async () => {
  const device = createFakeGpuDevice();
  const buffers = manualBuffers();
  const laneOptions = {
    laneId: 'ulg:test:schroeder-seed-family-lane',
    stateKey: 'ulg:test:schroeder-seed-family-state'
  };
  // storageGeneration 0 is a finite lineage word, but the REAL
  // resolveSchroederParticleBufferFamilyGeneration requires one matching
  // POSITIVE generation on both uploads — its verdict is surfaced verbatim.
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerPayload(payload(
      workerLaneSeedStage(),
      workerSchroederStageContext(device, buffers, {
        schroederLaneSeed: workerLaneSeedStageOptions({
          hotBufferKey: 'ulg:sph-resident-schroeder-adopted-storage:seed-family',
          lineage: { ...WORKER_LANE_SEED_DEFAULT_LINEAGE, storageGeneration: 0 }
        })
      }),
      null,
      laneOptions
    )),
    (error) => {
      assert.equal(error.reason, 'seed-family-generation-rejected');
      assert.equal(
        error.code,
        'ERR_ULG_WORKER_SCHROEDER_SEED_FAMILY_GENERATION_REJECTED'
      );
      assert.equal(
        error.bufferFamilyGeneration.schema,
        'peercompute.ulg.schroeder-particle-buffer-family-generation.v1'
      );
      assert.equal(
        error.bufferFamilyGeneration.status,
        'schroeder-particle-buffer-family-generation-rejected'
      );
      assert.equal(error.bufferFamilyGeneration.ready, false);
      assert.equal(error.bufferFamilyGeneration.sphStorageGeneration, null);
      assert.match(error.message, /one matching positive generation/);
      return true;
    }
  );
});

test('ULG resident stage worker lane seed refuses double-seeding, stepped lanes, and cross-device seam executions', async () => {
  const device = createFakeGpuDevice();
  const buffers = manualBuffers();
  const laneOptions = {
    laneId: 'ulg:test:schroeder-seed-double-lane',
    stateKey: 'ulg:test:schroeder-seed-double-state'
  };
  const seedPayload = () => payload(
    workerLaneSeedStage(),
    workerSchroederStageContext(device, buffers, {
      schroederLaneSeed: workerLaneSeedStageOptions({
        hotBufferKey: 'ulg:sph-resident-schroeder-adopted-storage:seed-double'
      })
    }),
    null,
    laneOptions
  );
  const seeded = await runUlgMechanicsResidentStageWorkerPayload(seedPayload());
  assert.equal(seeded.value.status, 'worker-schroeder-lane-seeded');

  // No reseed flag in this increment: an already-seeded lane refuses.
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerPayload(seedPayload()),
    (error) => {
      assert.equal(error.reason, 'lane-already-seeded');
      assert.equal(error.code, 'ERR_ULG_WORKER_SCHROEDER_LANE_ALREADY_SEEDED');
      return true;
    }
  );

  // Consume the seed with a step-1 epoch; the lane is now stepped and still
  // refuses a new seed, with the stepped reason.
  const epoch = await runUlgMechanicsResidentStageWorkerPayload(payload(
    stage(
      'schroederSpatialEpoch',
      ['schroeder-level-assignment'],
      ['schroeder-spatial-epoch']
    ),
    workerSchroederStageContext(device, buffers, {
      schroederSpatialEpoch: {
        selectedLevel: 0,
        mechanicsGrid: WORKER_SEED_MECHANICS_GRID,
        exactNearCellTreeEnabled: false
      }
    }),
    null,
    laneOptions
  ));
  assert.equal(
    epoch.value.levelAssignmentSource,
    'worker-lane-seeded-level-assignment'
  );
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerPayload(seedPayload()),
    (error) => {
      assert.equal(error.reason, 'lane-already-stepped');
      assert.equal(error.code, 'ERR_ULG_WORKER_SCHROEDER_LANE_ALREADY_STEPPED');
      return true;
    }
  );

  // The injectable seam exists for environments where the real runner cannot
  // execute — but a seam execution from another device fails closed.
  const foreignDevice = createFakeGpuDevice();
  const foreignAssignmentBuffer = tagWebGpuBufferDevice(
    foreignDevice.createBuffer({
      label: 'worker-ss-seed-foreign-assignment',
      size: 64,
      usage: 128 | 4
    }),
    foreignDevice
  );
  const seamObserved = {};
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerPayload(payload(
      workerLaneSeedStage(),
      workerSchroederStageContext(device, buffers, {
        schroederLaneSeed: workerLaneSeedStageOptions({
          hotBufferKey: 'ulg:sph-resident-schroeder-adopted-storage:seed-foreign',
          seedOptionOverrides: {
            async levelAssignmentRunner(args) {
              seamObserved.args = args;
              return {
                schema: 'peercompute.ulg.schroeder-level-assignment-execution.v0',
                status: 'schroeder-level-assignment-submitted',
                bufferFamilyGenerationStatus:
                  'schroeder-particle-buffer-family-generation-ready',
                particleCount: 1,
                assignmentStrideFloats: 16,
                assignmentBuffer: foreignAssignmentBuffer
              };
            }
          }
        })
      }),
      null,
      {
        laneId: 'ulg:test:schroeder-seed-foreign-lane',
        stateKey: 'ulg:test:schroeder-seed-foreign-state'
      }
    )),
    (error) => {
      assert.equal(error.reason, 'seed-device-mismatch');
      assert.equal(error.code, 'ERR_ULG_WORKER_SCHROEDER_SEED_DEVICE_MISMATCH');
      return true;
    }
  );
  // The seam received the lineage-stamped worker-device uploads.
  assert.equal(seamObserved.args.device, device);
  assert.equal(
    seamObserved.args.sphParticleUpload.storageGeneration,
    WORKER_LANE_SEED_DEFAULT_LINEAGE.storageGeneration
  );
  assert.equal(
    seamObserved.args.sphParticleUpload.stateBuffer.label,
    'ulg-worker-adopted-storage-state'
  );
  assert.equal(
    seamObserved.args.mlsMpmParticleUpload.storageGeneration,
    WORKER_LANE_SEED_DEFAULT_LINEAGE.storageGeneration
  );
});

test('ULG resident stage worker seeded lane works through single-stage messages and pins the seed lineage as the schedule baseline', async () => {
  const device = createFakeGpuDevice();
  const deviceId = webGpuDeviceId(device);
  const buffers = manualBuffers();
  const particleCount = 1;
  const seedLineage = WORKER_LANE_SEED_DEFAULT_LINEAGE;
  const laneOptions = {
    laneId: 'ulg:test:schroeder-seed-single-lane',
    stateKey: 'ulg:test:schroeder-seed-single-state'
  };
  const seeded = await runUlgMechanicsResidentStageWorkerPayload(payload(
    workerLaneSeedStage(),
    workerSchroederStageContext(device, buffers, {
      schroederLaneSeed: workerLaneSeedStageOptions({
        hotBufferKey: 'ulg:sph-resident-schroeder-adopted-storage:seed-single',
        particleCount
      })
    }),
    null,
    laneOptions
  ));
  assert.equal(seeded.value.status, 'worker-schroeder-lane-seeded');

  // While the seed is unconsumed the lane admits no competing payload source.
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerPayload(payload(
      stage(
        'schroederSpatialEpoch',
        ['schroeder-level-assignment'],
        ['schroeder-spatial-epoch']
      ),
      workerSchroederStageContext(device, buffers, {
        schroederSpatialEpoch: {
          levelAssignment: workerSchroederLevelAssignmentFixture(device, {
            particleCount,
            label: 'worker-ss-seed-single-conflict'
          }),
          selectedLevel: 0,
          mechanicsGrid: WORKER_SEED_MECHANICS_GRID,
          exactNearCellTreeEnabled: false
        }
      }),
      null,
      laneOptions
    )),
    (error) => {
      assert.equal(
        error.reason,
        'seeded-lane-conflicting-level-assignment-source'
      );
      return true;
    }
  );

  // A plain single-stage epoch message consumes the seeded assignment; the
  // sealed identity IS the seed lineage.
  const epoch = await runUlgMechanicsResidentStageWorkerPayload(payload(
    stage(
      'schroederSpatialEpoch',
      ['schroeder-level-assignment'],
      ['schroeder-spatial-epoch']
    ),
    workerSchroederStageContext(device, buffers, {
      schroederSpatialEpoch: {
        selectedLevel: 0,
        mechanicsGrid: WORKER_SEED_MECHANICS_GRID,
        exactNearCellTreeEnabled: false
      }
    }),
    null,
    laneOptions
  ));
  assert.equal(epoch.value.schema, ULG_WORKER_SCHROEDER_SPATIAL_EPOCH_STAGE_SCHEMA);
  assert.equal(
    epoch.value.levelAssignmentSource,
    'worker-lane-seeded-level-assignment'
  );
  assert.equal(epoch.value.epochStepOrdinal, 0);
  const epochSeal = epoch.value.epochSeal;
  assert.equal(epochSeal.deviceId, deviceId);
  for (const field of ULG_WORKER_SCHROEDER_LANE_SEED_LINEAGE_WORD_FIELDS) {
    assert.equal(epochSeal[field], seedLineage[field], `epoch seal word ${field}`);
  }
  assertNoWorkerGpuBuffers(epoch, 'seededSingleEpoch');
  structuredClone(epoch.value);

  const mechanicsFixture = workerSeededMechanicsRunnerFixture(device, {
    labelPrefix: 'worker-ss-seed-single',
    particleCount
  });
  const mechanics = await runUlgMechanicsResidentStageWorkerPayload(payload(
    stage(
      'schroederSameLevelMechanics',
      ['schroeder-spatial-epoch', 'sph-particle-state', 'mls-mpm-mechanics'],
      ['sph-particle-state', 'mls-mpm-mechanics']
    ),
    workerSchroederStageContext(device, buffers, {
      schroederSameLevelMechanics: {
        expectedSpatialEpochSeal: epochSeal,
        schroederSameLevelMechanicsRunner: mechanicsFixture.runner
      }
    }),
    epoch.value,
    laneOptions
  ));
  assert.equal(mechanics.value.epochConsumed, true);
  assert.equal(
    mechanicsFixture.runnerCalls[0].sphParticleUpload.stateBuffer.label,
    'ulg-worker-adopted-storage-state'
  );
  assert.equal(
    mechanicsFixture.runnerCalls[0].levelAssignment.storageGeneration,
    seedLineage.storageGeneration
  );
  assertNoWorkerGpuBuffers(mechanics, 'seededSingleMechanics');
  structuredClone(mechanics.value);

  // The seed lineage stays the lane's monotonicity baseline: a schedule step
  // that does NOT advance beyond the seeded words fails closed.
  const staleScheduleContext = workerSchroederStageContext(device, buffers, {
    schroederSpatialEpoch: {
      levelAssignment: workerSchroederLevelAssignmentFixture(device, {
        particleCount,
        sourceStateBuffer: null,
        label: 'worker-ss-seed-single-stale'
      }),
      useWorkerRetainedParticleBuffers: true,
      selectedLevel: 0,
      mechanicsGrid: WORKER_SEED_MECHANICS_GRID,
      exactNearCellTreeEnabled: false
    },
    schroederSameLevelMechanics: {
      schroederSameLevelMechanicsRunner: mechanicsFixture.runner
    }
  });
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerSchedulePayload(schedulePayload(
      staleScheduleContext,
      { stepCount: 1, scheduleId: 'ulg:test:seed-single-stale-schedule' },
      laneOptions
    )),
    (error) => {
      assert.equal(error.reason, 'epoch-identity-regressed');
      assert.match(error.message, /seeded lineage baseline/);
      assert.equal(error.residentScheduleError.stepOrdinal, 1);
      assert.equal(
        error.residentScheduleError.laneState.laneSeedRetained,
        true
      );
      assert.equal(
        error.residentScheduleError.laneState.laneSeedConsumed,
        true
      );
      return true;
    }
  );

  // A step that advances beyond the seeded words completes.
  const advancedScheduleContext = workerSchroederStageContext(device, buffers, {
    schroederSpatialEpoch: {
      levelAssignment: workerSchroederLevelAssignmentFixture(device, {
        particleCount,
        storageGeneration: seedLineage.storageGeneration + 1,
        physicsTick: seedLineage.physicsTick + 1,
        positionEpoch: seedLineage.positionEpoch + 1,
        sourceStateBuffer: null,
        label: 'worker-ss-seed-single-advanced'
      }),
      useWorkerRetainedParticleBuffers: true,
      selectedLevel: 0,
      mechanicsGrid: WORKER_SEED_MECHANICS_GRID,
      exactNearCellTreeEnabled: false
    },
    schroederSameLevelMechanics: {
      schroederSameLevelMechanicsRunner: mechanicsFixture.runner
    }
  });
  const advanced = await runUlgMechanicsResidentStageWorkerSchedulePayload(
    schedulePayload(
      advancedScheduleContext,
      { stepCount: 1, scheduleId: 'ulg:test:seed-single-advanced-schedule' },
      laneOptions
    )
  );
  assert.equal(advanced.status, 'worker-resident-schedule-completed');
  assert.equal(advanced.completedStepCount, 1);
  assert.equal(
    advanced.finalEpochIdentity.physicsTick,
    seedLineage.physicsTick + 1
  );
  assert.equal(
    advanced.finalEpochIdentity.positionEpoch,
    seedLineage.positionEpoch + 1
  );
  assertNoWorkerGpuBuffers(advanced, 'seededAdvancedSchedule');
  structuredClone(advanced);
});
