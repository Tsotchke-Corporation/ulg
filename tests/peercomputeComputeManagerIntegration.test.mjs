import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  createMlsMpmMechanicsG2pStageComputeTask,
  createMlsMpmMechanicsGridUpdateStageComputeTask,
  createMlsMpmMechanicsP2gStageComputeTask,
  createMlsMpmMechanicsOnlyResidentStepsComputeTask,
  createMlsMpmResidentStepsComputeTask,
  runMlsMpmMechanicsOnlyResidentStepWithOptionalWebGpu,
  runMlsMpmMechanicsOnlyResidentStepWithComputeManagerStageTasks,
  runSphPressureInterfaceStageComputeTask,
  ULG_MLS_MPM_MECHANICS_STAGE_TASK_CHAIN_SCHEMA,
  ULG_MLS_MPM_MECHANICS_G2P_STAGE_COMPUTE_TASK_RESULT_SCHEMA,
  ULG_MLS_MPM_MECHANICS_G2P_STAGE_COMPUTE_TASK_SCHEMA,
  ULG_MLS_MPM_MECHANICS_GRID_UPDATE_STAGE_COMPUTE_TASK_RESULT_SCHEMA,
  ULG_MLS_MPM_MECHANICS_GRID_UPDATE_STAGE_COMPUTE_TASK_SCHEMA,
  ULG_MLS_MPM_MECHANICS_P2G_STAGE_COMPUTE_TASK_RESULT_SCHEMA,
  ULG_MLS_MPM_MECHANICS_P2G_STAGE_COMPUTE_TASK_SCHEMA,
  ULG_MLS_MPM_MECHANICS_ONLY_RESIDENT_STEPS_COMPUTE_TASK_RESULT_SCHEMA,
  ULG_MLS_MPM_MECHANICS_ONLY_RESIDENT_STEPS_COMPUTE_TASK_SCHEMA,
  ULG_MLS_MPM_RESIDENT_STEPS_COMPUTE_TASK_RESULT_SCHEMA,
  ULG_MLS_MPM_RESIDENT_STEPS_COMMIT_DELTA_SCHEMA,
  ULG_MLS_MPM_RESIDENT_STEPS_STATE_DELTA_SCHEMA,
  ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA,
  ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_IMPORT_SCHEMA,
  ULG_PRESSURE_INTERFACE_RETAINED_GAS_CELL_FIELD_SOURCE_SCHEMA,
  ULG_SPH_PRESSURE_INTERFACE_WORKER_COMPACT_PUBLICATION_CANDIDATE_SCHEMA,
  ULG_SPH_PRESSURE_INTERFACE_STAGE_COMPUTE_TASK_RESULT_SCHEMA,
  ULG_SPH_REACTION_PRODUCT_STAGE_COMPUTE_TASK_RESULT_SCHEMA,
  ULG_SPH_THERMAL_PHASE_STAGE_COMPUTE_TASK_RESULT_SCHEMA
} from '../src/runtime/sph/sphMlsMpmGpuStep.js';
import {
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import {
  buildMlsMpmGpuParticleBuffers,
  buildSphGpuParticleBuffers,
  MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
  SPH_GPU_PARTICLE_STATE_FLOATS,
  SPH_GPU_PARTICLE_THERMO_FLOATS
} from '../src/runtime/sph/sphGpuBuffers.js';
import {
  attachResidentStateManagerCommitBridge,
  readResidentStepsCommittedWarmDelta,
  ULG_RESIDENT_STATE_COMMIT_ADMISSION_SCHEMA
} from '../src/runtime/peercomputeResidentCommitBridge.js';
import {
  createPeerComputeResidentAuthorityHost,
  createUlgSphMlsMpmCompactHotBufferRefreshExecutor,
  createUlgSphMlsMpmHotBufferRefreshExecutor,
  buildUlgSphMlsMpmRemoteSeedTaskGraph,
  createUlgLawFamilyPromotionAdmission,
  createUlgLawFamilyPromotionAdmissionComputeTask,
  createUlgMechanicsChildDryRunTask,
  createUlgMechanicsPromotionEvidenceTask,
  createUlgResidentLawGraphManifest,
  createUlgResidentSolverDescriptors,
  summarizePeerComputeResidentAuthorityHost,
  ULG_SPH_MLS_MPM_SAME_DEVICE_HOT_BUFFER_SOURCE_PUBLICATION_SCHEMA,
  ULG_REMOTE_TASK_GRAPH_HOT_BUFFER_REFRESH_AUTHORITY_REPORT_SCHEMA,
  ULG_REMOTE_TASK_GRAPH_HOT_BUFFER_REFRESH_RESULT_SCHEMA,
  ULG_REMOTE_TASK_GRAPH_COMPACT_BUFFER_SNAPSHOT_SCHEMA,
  ULG_REMOTE_TASK_GRAPH_COMPACT_LOCAL_REFRESH_CONTRACT_SCHEMA,
  ULG_REMOTE_TASK_GRAPH_SAME_DEVICE_RETAINED_BUFFER_IMPORT_SCHEMA,
  ULG_REMOTE_TASK_GRAPH_SPH_MLS_MPM_GRAPH_SCHEMA,
  ULG_REMOTE_TASK_GRAPH_SPH_MLS_MPM_MECHANICS_STAGE_COMPACT_SEED_SCHEMA,
  ULG_REMOTE_TASK_GRAPH_SPH_MLS_MPM_MECHANICS_STAGE_SEED_NODE_SCHEMA,
  ULG_REMOTE_TASK_GRAPH_SPH_MLS_MPM_POST_STAGE_SEED_NODE_SCHEMA,
  ULG_REMOTE_TASK_GRAPH_SPH_MLS_MPM_SEED_NODE_SCHEMA,
  ULG_REMOTE_TASK_GRAPH_SUBMIT_REFRESH_REPORT_SCHEMA,
  ULG_REMOTE_TASK_GRAPH_STATE_SEED_PAYLOAD_SCHEMA,
  runUlgRemoteSphMlsMpmMechanicsStageSeedGraphNode,
  runUlgMechanicsPromotionEvidenceTask,
  selectRemoteGraphRefreshSeedPayload,
  ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_HOT_BUFFER_PUBLICATION_SCHEMA,
  ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_IMPORT_HOT_BUFFER_PUBLICATION_SCHEMA,
  ULG_PRESSURE_INTERFACE_WORKER_RETAINED_BUFFER_IMPORT_SCHEMA,
  ULG_PRESSURE_INTERFACE_WORKER_RETAINED_HOT_BUFFER_PUBLICATION_SCHEMA,
  ULG_REACTION_PRODUCT_WORKER_RETAINED_BUFFER_IMPORT_SCHEMA,
  ULG_REACTION_PRODUCT_WORKER_RETAINED_HOT_BUFFER_PUBLICATION_SCHEMA,
  ULG_RESIDENT_LAW_FAMILY_PROMOTION_ADMISSION_SCHEMA,
  ULG_RESIDENT_LAW_GRAPH_MANIFEST_SCHEMA,
  ULG_RESIDENT_LAW_FAMILY_METADATA_SCOPE,
  ULG_RESIDENT_LAW_STATE_FAMILY_CONTRACT_SCHEMA,
  ULG_RESIDENT_MECHANICS_PROMOTION_EVIDENCE_SCHEMA,
  ULG_RESIDENT_PASS_DAG_NODE_ID,
  ULG_RESIDENT_PASS_DAG_SOLVER_ID
} from '../src/runtime/peercomputeBrowserResidentHost.js';
import {
  createUlgMechanicsPromotionReferenceEvidence,
  runUlgMechanicsChildDryRunTask,
  ULG_MECHANICS_CHILD_DRY_RUN_EVIDENCE_SCHEMA,
  ULG_MECHANICS_PROMOTION_REFERENCE_EVIDENCE_SCHEMA
} from '../src/runtime/mechanicsPromotionEvidence.js';
import {
  RESIDENT_STATE_FAMILIES
} from '../src/runtime/residentStateAuthority.js';
import {
  buildSphPhaseDemoState
} from '../src/runtime/sphPhaseDemo.js';

const PEERCOMPUTE_COMPUTE_MANAGER_URL = new URL(
  '../../peercompute/peercompute/src/peercompute/computeManager/ComputeManager.js',
  import.meta.url
);
const PEERCOMPUTE_GPU_HUB_URL = new URL(
  '../../peercompute/peercompute/src/peercompute/gpu/GPUHubManager.js',
  import.meta.url
);
const PEERCOMPUTE_INDEX_URL = new URL(
  '../../peercompute/peercompute/src/peercompute/index.js',
  import.meta.url
);
const PEERCOMPUTE_NODE_KERNEL_URL = new URL(
  '../../peercompute/peercompute/src/peercompute/nodeKernel/NodeKernel.js',
  import.meta.url
);
const PEERCOMPUTE_STATE_MANAGER_URL = new URL(
  '../../peercompute/peercompute/src/peercompute/stateManager/StateManager.js',
  import.meta.url
);
const PEERCOMPUTE_REMOTE_QUORUM_URL = new URL(
  '../../peercompute/peercompute/src/peercompute/computeManager/RemoteResultQuorumValidator.js',
  import.meta.url
);
const PEERCOMPUTE_YJS_URL = new URL(
  '../../peercompute/node_modules/yjs/dist/yjs.mjs',
  import.meta.url
);
const ULG_REMOTE_RESIDENT_PLACEMENT_FIXTURE_URL = new URL(
  './fixtures/ulgRemoteResidentPlacementTask.mjs',
  import.meta.url
);
const ULG_MECHANICS_PROMOTION_EVIDENCE_MODULE_URL = new URL(
  '../src/runtime/mechanicsPromotionEvidence.js',
  import.meta.url
);
const ULG_MLS_MPM_GPU_STEP_MODULE_URL = new URL(
  '../src/runtime/sph/sphMlsMpmGpuStep.js',
  import.meta.url
);
const ULG_PEERCOMPUTE_BROWSER_RESIDENT_HOST_MODULE_URL = new URL(
  '../src/runtime/peercomputeBrowserResidentHost.js',
  import.meta.url
);

async function importPeerComputeManager(t) {
  try {
    await access(fileURLToPath(PEERCOMPUTE_COMPUTE_MANAGER_URL));
  } catch (error) {
    if (error?.code === 'ENOENT') {
      t.skip('sibling PeerCompute checkout is not available');
      return null;
    }
    throw error;
  }
  return import(PEERCOMPUTE_COMPUTE_MANAGER_URL.href);
}

async function importPeerComputeGPUHub(t) {
  try {
    await access(fileURLToPath(PEERCOMPUTE_GPU_HUB_URL));
  } catch (error) {
    if (error?.code === 'ENOENT') {
      t.skip('sibling PeerCompute GPUHub checkout is not available');
      return null;
    }
    throw error;
  }
  return import(PEERCOMPUTE_GPU_HUB_URL.href);
}

async function importPeerComputeStateManager(t) {
  try {
    await access(fileURLToPath(PEERCOMPUTE_STATE_MANAGER_URL));
  } catch (error) {
    if (error?.code === 'ENOENT') {
      t.skip('sibling PeerCompute checkout is not available');
      return null;
    }
    throw error;
  }
  return import(PEERCOMPUTE_STATE_MANAGER_URL.href);
}

async function importPeerComputeNodeKernel(t) {
  try {
    await access(fileURLToPath(PEERCOMPUTE_NODE_KERNEL_URL));
  } catch (error) {
    if (error?.code === 'ENOENT') {
      t.skip('sibling PeerCompute checkout is not available');
      return null;
    }
    throw error;
  }
  return import(PEERCOMPUTE_NODE_KERNEL_URL.href);
}

async function importPeerComputeRemoteQuorum(t) {
  try {
    await access(fileURLToPath(PEERCOMPUTE_REMOTE_QUORUM_URL));
  } catch (error) {
    if (error?.code === 'ENOENT') {
      t.skip('sibling PeerCompute checkout is not available');
      return null;
    }
    throw error;
  }
  return import(PEERCOMPUTE_REMOTE_QUORUM_URL.href);
}

async function importPeerComputeYjs(t) {
  try {
    await access(fileURLToPath(PEERCOMPUTE_YJS_URL));
  } catch (error) {
    if (error?.code === 'ENOENT') {
      t.skip('sibling PeerCompute Yjs dependency is not available');
      return null;
    }
    throw error;
  }
  return import(PEERCOMPUTE_YJS_URL.href);
}

function makeStartedKernel(NodeKernel, { nodeId, enableRemoteComputeResponder = false, ...config } = {}) {
  const kernel = new NodeKernel({ enableRemoteComputeResponder, ...config });
  kernel.nodeId = nodeId;
  kernel.isStarted = true;
  return kernel;
}

function createFakeWebGpuUploadDevice() {
  const createdBuffers = [];
  const writes = [];
  return {
    createdBuffers,
    writes,
    createBuffer({ label, size, usage }) {
      const buffer = {
        label,
        size,
        usage,
        destroyed: false,
        destroy() {
          this.destroyed = true;
        }
      };
      createdBuffers.push(buffer);
      return buffer;
    },
    queue: {
      writeBuffer(buffer, offset, data) {
        writes.push({
          label: buffer.label,
          offset,
          byteLength: data?.byteLength ?? 0
        });
      }
    }
  };
}

function connectInMemoryKernelMesh({
  requester,
  responders = [],
  requesterPeerId = 'peer-a'
} = {}) {
  const responderByPeerId = new Map(responders.map((entry) => [entry.peerId, entry.kernel]));
  requester.networkManager = {
    sendToPeer: async (peerId, message) => {
      const responder = responderByPeerId.get(peerId);
      if (!responder) throw new Error(`Unexpected requester peer ${peerId}`);
      if (message.type === 'compute-task') {
        await responder._handleComputeTask(requesterPeerId, message.data);
        return;
      }
      throw new Error(`Unexpected requester message type ${message.type}`);
    }
  };
  for (const { kernel, peerId } of responders) {
    kernel.networkManager = {
      sendToPeer: async (targetPeerId, message) => {
        assert.equal(targetPeerId, requesterPeerId);
        if (message.type === 'compute-result') {
          requester._handleComputeResult(peerId, message.data);
          return;
        }
        throw new Error(`Unexpected responder message type ${message.type}`);
      }
    };
  }
}

function connectInMemoryTaskGraphKernels({
  requester,
  responder,
  requesterPeerId = 'peer-a',
  responderPeerId = 'peer-b',
  messages = []
}) {
  requester.networkManager = {
    getNetworkStats() {
      return {
        isConnected: true,
        peerId: requesterPeerId,
        peerCount: 1,
        connections: 1
      };
    },
    async disconnect() {
      requester.isStarted = false;
    },
    sendToPeer: async (peerId, message) => {
      messages.push({ from: requesterPeerId, to: peerId, message });
      assert.equal(peerId, responderPeerId);
      await responder._handleNetworkMessage(requesterPeerId, message);
    }
  };
  responder.networkManager = {
    peerId: responderPeerId,
    getNetworkStats() {
      return {
        isConnected: true,
        peerId: responderPeerId,
        peerCount: 1,
        connections: 1
      };
    },
    async disconnect() {
      responder.isStarted = false;
    },
    sendToPeer: async (peerId, message) => {
      messages.push({ from: responderPeerId, to: peerId, message });
      assert.equal(peerId, requesterPeerId);
      await requester._handleNetworkMessage(responderPeerId, message);
    }
  };
}

function createInMemoryStateProviderMesh(peerIds = []) {
  const managers = new Map();
  const deliveries = [];
  for (const peerId of peerIds) {
    const manager = {
      peerId,
      handlers: [],
      broadcastLog: [],
      getLibp2pNode: () => ({ peerId }),
      addMessageHandler(handler) {
        this.handlers.push(handler);
      },
      getConnectedPeers() {
        return peerIds.filter((id) => id !== peerId);
      },
      async broadcast(message, options = {}) {
        const topic = options.topic || null;
        this.broadcastLog.push({ message, options });
        deliveries.push({
          from: peerId,
          type: message?.type || null,
          topic,
          byteLength: Array.isArray(message?.data) ? message.data.length : null
        });
        for (const [targetPeerId, target] of managers.entries()) {
          if (targetPeerId === peerId) continue;
          for (const handler of target.handlers) {
            await handler(peerId, message);
          }
        }
      },
      async sendToPeer(targetPeerId, message) {
        deliveries.push({
          from: peerId,
          to: targetPeerId,
          type: message?.type || null,
          topic: null,
          byteLength: Array.isArray(message?.data?.update)
            ? message.data.update.length
            : Array.isArray(message?.data)
              ? message.data.length
              : null
        });
        const target = managers.get(targetPeerId);
        if (!target) throw new Error(`Unknown in-memory provider peer ${targetPeerId}`);
        for (const handler of target.handlers) {
          await handler(peerId, message);
        }
      }
    };
    managers.set(peerId, manager);
  }
  return { managers, deliveries };
}

async function waitForWarmDelta(stateManager, { scope, taskId, timeoutMs = 500 } = {}) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const entry = stateManager.getWarmDeltas(scope)[taskId];
    if (entry) return entry;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  return null;
}

function minimalResidentState(step = 7) {
  return {
    sphParticleState: {
      schema: 'peercompute.ulg.sph-particle-state.v0',
      particleCount: 1,
      step,
      state: new Float32Array(16),
      thermo: new Float32Array(12),
      smoothingLengthM: 1
    },
    mlsMpmParticleState: {
      schema: 'peercompute.ulg.mls-mpm-particle-state.v0',
      particleCount: 1,
      step,
      mechanics: new Float32Array(12),
      mechanicsDtS: 1 / 60
    }
  };
}

function packedSingleMechanicsParticle({
  position = [2.5, 2.5, 2.5],
  velocity = [0, 0, 0],
  massKg = 8,
  restDensityKgPerM3 = 8,
  smoothingLengthM = 1,
  mechanicsDtS = 0.01,
  gravityMPerS2 = [0, 0, 0]
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
      gravityMPerS2,
      mechanics
    }
  };
}

function createContractTask(overrides = {}) {
  return createMlsMpmResidentStepsComputeTask({
    ...minimalResidentState(),
    modulePath: './unused-contract-module.js',
    taskId: 'ulg:test:peercompute-resident-steps-contract',
    laneId: 'ulg:test:peercompute-resident-lane',
    stateKey: 'ulg:test:peercompute-resident-state',
    domainKey: 'ulg:test:peercompute-domain',
    stepCount: 3,
    compactSummaryMode: 'final-only',
    readbackMode: 'no-full-readback',
    ...overrides
  });
}

async function createPassingMechanicsPromotionEvidence({ manifest } = {}) {
  return createUlgMechanicsPromotionReferenceEvidence({
    ownerMap: {
      passed: true,
      status: manifest?.stateFamilyOwnerMapStatus || 'single-current-owner-per-family',
      firstPromotionCandidateNodeId: manifest?.firstPromotionCandidateNodeId || 'ulg-mls-mpm-mechanics-law'
    },
    gpuFence: {
      passed: true,
      fenceSatisfied: true,
      sameDevice: true
    },
    stateManagerAdmission: {
      accepted: true,
      status: 'accepted'
    },
    committedDeltaAdmission: {
      accepted: true,
      status: 'accepted'
    },
    visualSequence: {
      passed: true,
      status: 'pass',
      failedCount: 0
    },
    conservedFields: {
      passed: true,
      massDeltaKg: 0,
      momentumDeltaMagnitude: 0,
      massToleranceKg: 1e-9,
      momentumTolerance: 1e-6
    }
  });
}

test('ULG resident solver descriptors publish executable pass-DAG plus metadata law-family nodes', async (t) => {
  const mod = await importPeerComputeManager(t);
  const gpuHubMod = await importPeerComputeGPUHub(t);
  const stateMod = await importPeerComputeStateManager(t);
  const nodeMod = await importPeerComputeNodeKernel(t);
  if (!mod || !gpuHubMod || !stateMod || !nodeMod) return;
  const { ComputeManager } = mod;
  const { GPUHubManager } = gpuHubMod;
  const { StateManager } = stateMod;
  const { NodeKernel } = nodeMod;
  const gpuHub = new GPUHubManager();
  const computeManager = new ComputeManager({
    enableWorkers: false,
    gpuDeviceId: 'gpu-device:ulg-solver-descriptors',
    gpuHub
  });
  const stateManager = new StateManager(null, {
    enablePersistence: false,
    disableNetworkProvider: true,
    disableBroadcast: true
  });
  await stateManager.initialize({
    nodeId: 'ulg-test-state-authority-node',
    topology: 'ulg-test-cache-artifact-authority',
    createdAt: Date.now()
  });
  t.after(() => stateManager.destroy?.());
  const authorityKernel = makeStartedKernel(NodeKernel, {
    nodeId: 'ulg-test-state-authority-node'
  });
  authorityKernel.computeManager = computeManager;
  authorityKernel.stateManager = stateManager;
  const expectedLawFamilyIds = [
    'ulg-mls-mpm-mechanics-law',
    'ulg-thermal-phase-law',
    'ulg-reaction-product-gas-law',
    'ulg-pressure-interface-law'
  ];
  const descriptors = createUlgResidentSolverDescriptors({
    computeTaskModulePath: './resident-pass-dag-task.js'
  });

  for (const descriptor of descriptors) {
    computeManager.registerSolver(descriptor);
  }

  const solvers = computeManager.listSolvers();
  const manifest = createUlgResidentLawGraphManifest({ descriptors: solvers });
  const passDag = solvers.find((solver) => solver.id === ULG_RESIDENT_PASS_DAG_SOLVER_ID);
  const lawFamilies = solvers
    .filter((solver) => solver.metadata?.parentLawGraphNodeId === ULG_RESIDENT_PASS_DAG_NODE_ID)
    .sort((a, b) => a.metadata.lawGraphNode.order - b.metadata.lawGraphNode.order);

  assert.equal(manifest.schema, ULG_RESIDENT_LAW_GRAPH_MANIFEST_SCHEMA);
  assert.equal(manifest.graphId, 'peercompute.ulg.local-sph-law-closure-graph');
  assert.equal(manifest.nodeCount, 5);
  assert.equal(manifest.edgeCount, 7);
  assert.deepEqual(manifest.executableNodeIds, [ULG_RESIDENT_PASS_DAG_NODE_ID]);
  assert.deepEqual(manifest.metadataOnlyNodeIds, expectedLawFamilyIds);
  assert.deepEqual(
    manifest.nodes.map((node) => node.nodeId),
    [ULG_RESIDENT_PASS_DAG_NODE_ID, ...expectedLawFamilyIds]
  );
  assert.equal(
    manifest.edges.filter((edge) => edge.relation === 'parent-pass-dag-child').length,
    4
  );
  assert.equal(
    manifest.edges.filter((edge) => edge.relation === 'data-dependency').length,
    3
  );
  assert.ok(manifest.readStateFamilies.includes('sedenion-periodic-table-scope'));
  assert.ok(manifest.writeStateFamilies.includes('resident-product-mass'));
  assert.ok(manifest.writeStateFamilies.includes('pressure-interface-force-rows'));
  assert.equal(manifest.stateFamilyOwnerMapStatus, 'single-current-owner-per-family');
  assert.deepEqual(manifest.stateFamilyOwnerConflicts, []);
  assert.equal(
    manifest.currentStateFamilyOwners[RESIDENT_STATE_FAMILIES.MECHANICS].nodeId,
    ULG_RESIDENT_PASS_DAG_NODE_ID
  );
  assert.equal(
    manifest.currentStateFamilyOwners[RESIDENT_STATE_FAMILIES.PRESSURE_INTERFACE].nodeId,
    ULG_RESIDENT_PASS_DAG_NODE_ID
  );
  assert.equal(
    manifest.currentStateFamilyOwners[RESIDENT_STATE_FAMILIES.GAS_PRESSURE].nodeId,
    ULG_RESIDENT_PASS_DAG_NODE_ID
  );
  assert.deepEqual(
    manifest.prospectiveStateFamilyOwners[RESIDENT_STATE_FAMILIES.MECHANICS].map((owner) => owner.nodeId),
    ['ulg-mls-mpm-mechanics-law']
  );
  assert.deepEqual(
    manifest.prospectiveStateFamilyOwners[RESIDENT_STATE_FAMILIES.THERMO_PHASE].map((owner) => owner.nodeId),
    ['ulg-thermal-phase-law']
  );
  assert.deepEqual(
    manifest.prospectiveStateFamilyOwners[RESIDENT_STATE_FAMILIES.GAS_PRESSURE].map((owner) => owner.nodeId),
    ['ulg-reaction-product-gas-law']
  );
  assert.equal(manifest.firstPromotionCandidateNodeId, 'ulg-mls-mpm-mechanics-law');
  assert.deepEqual(manifest.firstPromotionCandidateFamilies, [
    RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS,
    RESIDENT_STATE_FAMILIES.MECHANICS
  ]);
  assert.ok(manifest.authoritativeWriteResidentStateFamilies.includes(RESIDENT_STATE_FAMILIES.PRESSURE_INTERFACE));
  assert.ok(manifest.authoritativeWriteResidentStateFamilies.includes(RESIDENT_STATE_FAMILIES.GAS_PRESSURE));
  assert.equal(manifest.promotionPolicy.rule, 'metadata-only-until-gated');
  assert.ok(manifest.promotionPolicy.requiredGates.includes('state-manager-admission'));
  assert.ok(manifest.promotionPolicy.requiredGates.includes('visual-sequence-sanity'));

  assert.equal(passDag?.hasExecutor, true);
  assert.equal(passDag.runtime, 'js');
  assert.equal(passDag.module, './resident-pass-dag-task.js');
  assert.equal(passDag.metadata.lawGraphNode.nodeId, ULG_RESIDENT_PASS_DAG_NODE_ID);
  assert.equal(passDag.metadata.stateFamilyContract.schema, ULG_RESIDENT_LAW_STATE_FAMILY_CONTRACT_SCHEMA);
  assert.equal(passDag.metadata.stateFamilyContract.currentAuthority, true);
  assert.ok(passDag.metadata.stateFamilyContract.authoritativeWriteFamilies.includes(RESIDENT_STATE_FAMILIES.PRESSURE_INTERFACE));
  assert.ok(passDag.metadata.stateFamilyContract.transientWriteFamilies.includes(RESIDENT_STATE_FAMILIES.GRID_UPDATE));
  assert.deepEqual(lawFamilies.map((solver) => solver.id), expectedLawFamilyIds);

  for (const solver of lawFamilies) {
    const contract = solver.metadata.stateFamilyContract;
    assert.equal(solver.runtime, 'metadata');
    assert.equal(solver.hasExecutor, false);
    assert.equal(solver.warmDelta.scope, ULG_RESIDENT_LAW_FAMILY_METADATA_SCOPE);
    assert.equal(solver.webgpu.residency, 'gpu-lane-child-metadata');
    assert.equal(solver.webgpu.parentSolverId, ULG_RESIDENT_PASS_DAG_SOLVER_ID);
    assert.equal(solver.metadata.parentSolverId, ULG_RESIDENT_PASS_DAG_SOLVER_ID);
    assert.equal(solver.metadata.executableStatus, 'metadata-only-pass-dag-child');
    assert.equal(solver.metadata.lawGraphNode.parentNodeId, ULG_RESIDENT_PASS_DAG_NODE_ID);
    assert.equal(contract.schema, ULG_RESIDENT_LAW_STATE_FAMILY_CONTRACT_SCHEMA);
    assert.equal(contract.currentAuthority, false);
    assert.equal(contract.admissionMode, 'metadata-only-via-parent-pass-dag');
    assert.ok(contract.requiredAdmissionEvidence.includes('state-manager-admission'));
    assert.ok(solver.metadata.requiredBeforeIndependentExecution.includes('cpu-reference-oracle-parity'));
    assert.ok(solver.metadata.requiredBeforeIndependentExecution.includes('visual-sequence-sanity'));
    assert.throws(
      () => computeManager.submitSolverTask(solver.id, { stateKey: 'ulg:test:metadata-only-law-family' }),
      new RegExp(`Solver has no executable task target: ${solver.id}`)
    );
  }
  const mechanicsNode = manifest.nodes.find((node) => node.nodeId === 'ulg-mls-mpm-mechanics-law');
  assert.equal(mechanicsNode.currentAuthority, false);
  assert.equal(mechanicsNode.promotionStatus, 'first-promotion-candidate');
  assert.equal(mechanicsNode.promotionPriority, 1);
  assert.ok(mechanicsNode.mustNotWriteResidentStateFamilies.includes(RESIDENT_STATE_FAMILIES.THERMO_PHASE));
  assert.ok(mechanicsNode.requiredAdmissionEvidence.includes('gravity-only-oracle'));
  assert.ok(mechanicsNode.requiredAdmissionEvidence.includes('mechanics-only-child-task-envelope'));
  assert.ok(mechanicsNode.requiredAdmissionEvidence.includes('mechanics-child-stage-kernel-evidence'));
  assert.ok(mechanicsNode.requiredAdmissionEvidence.includes('mechanics-child-p2g-stage-evidence'));
  assert.ok(mechanicsNode.requiredAdmissionEvidence.includes('mechanics-child-grid-update-stage-evidence'));
  assert.ok(mechanicsNode.requiredAdmissionEvidence.includes('mechanics-child-g2p-stage-evidence'));

  const missingMechanicsAdmission = createUlgLawFamilyPromotionAdmission({
    computeManager,
    solverId: 'ulg-mls-mpm-mechanics-law'
  });
  assert.equal(missingMechanicsAdmission.schema, ULG_RESIDENT_LAW_FAMILY_PROMOTION_ADMISSION_SCHEMA);
  assert.equal(missingMechanicsAdmission.accepted, false);
  assert.equal(missingMechanicsAdmission.reason, 'required-evidence-missing');
  assert.equal(missingMechanicsAdmission.firstPromotionCandidateNodeId, 'ulg-mls-mpm-mechanics-law');
  assert.ok(missingMechanicsAdmission.missingEvidence.includes('cpu-reference-oracle-parity'));
  assert.ok(missingMechanicsAdmission.missingEvidence.includes('gravity-only-oracle'));
  assert.ok(missingMechanicsAdmission.missingEvidence.includes('mechanics-only-child-task-envelope'));
  assert.ok(missingMechanicsAdmission.missingEvidence.includes('mechanics-child-stage-kernel-evidence'));
  assert.ok(missingMechanicsAdmission.missingEvidence.includes('mechanics-child-p2g-stage-evidence'));
  assert.ok(missingMechanicsAdmission.missingEvidence.includes('mechanics-child-grid-update-stage-evidence'));
  assert.ok(missingMechanicsAdmission.missingEvidence.includes('mechanics-child-g2p-stage-evidence'));
  assert.ok(missingMechanicsAdmission.missingEvidence.includes('mechanics-child-dry-run-parity'));
  assert.deepEqual(missingMechanicsAdmission.admittedFamilies, []);

  const measuredMechanicsEvidence = await createPassingMechanicsPromotionEvidence({ manifest });
  assert.equal(measuredMechanicsEvidence.schema, ULG_MECHANICS_PROMOTION_REFERENCE_EVIDENCE_SCHEMA);
  assert.equal(measuredMechanicsEvidence.generatedBy, 'cpu-resident-mechanics-reference-runs');
  assert.equal(measuredMechanicsEvidence.zeroForceRest.passed, true);
  assert.equal(measuredMechanicsEvidence.gravityOnly.passed, true);
  assert.equal(measuredMechanicsEvidence.mechanicsOnlyStageContract.passed, true);
  assert.equal(measuredMechanicsEvidence.mechanicsOnlyExecutionPath.status, 'mechanics-only-entrypoint-enforced');
  assert.equal(
    measuredMechanicsEvidence.mechanicsOnlyExecutionPath.zeroForce.stepSource,
    'runMlsMpmMechanicsOnlyResidentStepWithOptionalWebGpu'
  );
  assert.equal(measuredMechanicsEvidence.referenceRuns.zeroForce.completedStepCount, 32);
  assert.equal(measuredMechanicsEvidence.referenceRuns.gravityOnly.completedStepCount, 24);

  await computeManager.initialize();
  const mechanicsOnlyResidentTask = createMlsMpmMechanicsOnlyResidentStepsComputeTask({
    ...packedSingleMechanicsParticle(),
    modulePath: ULG_MLS_MPM_GPU_STEP_MODULE_URL.href,
    taskId: 'ulg:test:mechanics-only-resident-steps-child',
    preferWebGpu: false,
    stepCount: 2,
    readbackMode: 'full-parity-readback'
  });
  assert.equal(mechanicsOnlyResidentTask.schema, ULG_MLS_MPM_MECHANICS_ONLY_RESIDENT_STEPS_COMPUTE_TASK_SCHEMA);
  assert.equal(mechanicsOnlyResidentTask.taskFamily, 'ulg-mls-mpm-mechanics-only-resident-steps');
  assert.equal(mechanicsOnlyResidentTask.residency, 'cpu-oracle');
  assert.equal(mechanicsOnlyResidentTask.exportName, 'runMlsMpmMechanicsOnlyResidentStepsComputeTask');
  assert.equal(mechanicsOnlyResidentTask.lawGraphNode.nodeId, 'ulg-mls-mpm-mechanics-law');
  assert.deepEqual(mechanicsOnlyResidentTask.writeFamilies, ['sph-particle-state', 'mls-mpm-mechanics']);
  assert.equal(Object.hasOwn(mechanicsOnlyResidentTask, 'gpuResidentLane'), false);
  const mechanicsOnlyResidentTaskResult = await computeManager.submitTask(mechanicsOnlyResidentTask);
  assert.equal(
    mechanicsOnlyResidentTaskResult.computeTaskResultSchema,
    ULG_MLS_MPM_MECHANICS_ONLY_RESIDENT_STEPS_COMPUTE_TASK_RESULT_SCHEMA
  );
  assert.equal(mechanicsOnlyResidentTaskResult.computeTaskSchema, ULG_MLS_MPM_MECHANICS_ONLY_RESIDENT_STEPS_COMPUTE_TASK_SCHEMA);
  assert.equal(mechanicsOnlyResidentTaskResult.mechanicsOnlyChildTask, true);
  assert.equal(mechanicsOnlyResidentTaskResult.completedStepCount, 2);
  assert.equal(mechanicsOnlyResidentTaskResult.mechanicsOnlyExecutionPath.status, 'mechanics-only-entrypoint-enforced');
  assert.equal(
    mechanicsOnlyResidentTaskResult.mechanicsOnlyExecutionPath.stepSource,
    'runMlsMpmMechanicsOnlyResidentStepWithOptionalWebGpu'
  );
  assert.equal(mechanicsOnlyResidentTaskResult.mechanicsOnlyChildTaskAuthority.status, 'compute-manager-owned-non-mutating-child-task');
  assert.equal(mechanicsOnlyResidentTaskResult.mechanicsOnlyChildTaskAuthority.commitDeltaSuppressed, true);
  assert.equal(mechanicsOnlyResidentTaskResult.mechanicsOnlyChildTaskAuthority.gpuFenceRequired, false);
  assert.equal(mechanicsOnlyResidentTaskResult.mechanicsChildStageKernelEvidence.passed, true);
  assert.deepEqual(
    mechanicsOnlyResidentTaskResult.mechanicsChildStageKernelEvidence.requiredStages.map((entry) => entry.id),
    ['p2g', 'gridUpdate', 'g2p']
  );
  assert.equal(mechanicsOnlyResidentTaskResult.mechanicsChildP2gStageEvidence.passed, true);
  assert.equal(mechanicsOnlyResidentTaskResult.mechanicsChildP2gStageEvidence.stageId, 'p2g');
  assert.equal(mechanicsOnlyResidentTaskResult.mechanicsChildP2gStageEvidence.promotionStatus, 'stage-evidence-only-not-authoritative');
  assert.equal(mechanicsOnlyResidentTaskResult.mechanicsChildGridUpdateStageEvidence.passed, true);
  assert.equal(mechanicsOnlyResidentTaskResult.mechanicsChildGridUpdateStageEvidence.stageId, 'gridUpdate');
  assert.equal(mechanicsOnlyResidentTaskResult.mechanicsChildGridUpdateStageEvidence.promotionStatus, 'stage-evidence-only-not-authoritative');
  assert.equal(mechanicsOnlyResidentTaskResult.mechanicsChildG2pStageEvidence.passed, true);
  assert.equal(mechanicsOnlyResidentTaskResult.mechanicsChildG2pStageEvidence.stageId, 'g2p');
  assert.equal(mechanicsOnlyResidentTaskResult.mechanicsChildG2pStageEvidence.promotionStatus, 'stage-evidence-only-not-authoritative');
  assert.equal(
    mechanicsOnlyResidentTaskResult.mechanicsChildStageKernelEvidence.perStageEvidence.p2g.schema,
    'peercompute.ulg.mechanics-child-p2g-stage-evidence.v0'
  );
  assert.equal(
    mechanicsOnlyResidentTaskResult.mechanicsChildStageKernelEvidence.perStageEvidence.gridUpdate.schema,
    'peercompute.ulg.mechanics-child-grid-update-stage-evidence.v0'
  );
  assert.equal(
    mechanicsOnlyResidentTaskResult.mechanicsChildStageKernelEvidence.perStageEvidence.g2p.schema,
    'peercompute.ulg.mechanics-child-g2p-stage-evidence.v0'
  );
  assert.equal(mechanicsOnlyResidentTaskResult.computeExecution.taskFamily, 'ulg-mls-mpm-mechanics-only-resident-steps');
  assert.equal(mechanicsOnlyResidentTaskResult.computeExecution.executionMode, 'inline');
  assert.equal(mechanicsOnlyResidentTaskResult.commitDelta, undefined);

  const mechanicsStageParticle = packedSingleMechanicsParticle();
  const mechanicsP2gStageTask = createMlsMpmMechanicsP2gStageComputeTask({
    ...mechanicsStageParticle,
    modulePath: ULG_MLS_MPM_GPU_STEP_MODULE_URL.href,
    taskId: 'ulg:test:mechanics-p2g-stage-child',
    preferWebGpu: false,
    readbackMode: 'full-parity-readback'
  });
  assert.equal(mechanicsP2gStageTask.schema, ULG_MLS_MPM_MECHANICS_P2G_STAGE_COMPUTE_TASK_SCHEMA);
  assert.equal(mechanicsP2gStageTask.taskFamily, 'ulg-mls-mpm-mechanics-p2g-stage');
  assert.equal(mechanicsP2gStageTask.residency, 'cpu-oracle');
  assert.equal(mechanicsP2gStageTask.exportName, 'runMlsMpmMechanicsP2gStageComputeTask');
  assert.equal(mechanicsP2gStageTask.lawGraphNode.nodeId, 'ulg-mls-mpm-mechanics-law');
  assert.deepEqual(mechanicsP2gStageTask.readFamilies, ['sph-particle-state', 'mls-mpm-mechanics']);
  assert.deepEqual(mechanicsP2gStageTask.writeFamilies, ['mls-mpm-grid']);
  const mechanicsP2gStageTaskResult = await computeManager.submitTask(mechanicsP2gStageTask);
  assert.equal(
    mechanicsP2gStageTaskResult.computeTaskResultSchema,
    ULG_MLS_MPM_MECHANICS_P2G_STAGE_COMPUTE_TASK_RESULT_SCHEMA
  );
  assert.equal(mechanicsP2gStageTaskResult.computeTaskSchema, ULG_MLS_MPM_MECHANICS_P2G_STAGE_COMPUTE_TASK_SCHEMA);
  assert.equal(mechanicsP2gStageTaskResult.mechanicsP2gStageTask, true);
  assert.equal(mechanicsP2gStageTaskResult.mechanicsP2gStageTaskAuthority.status, 'compute-manager-owned-non-mutating-p2g-stage-task');
  assert.equal(mechanicsP2gStageTaskResult.mechanicsP2gStageTaskAuthority.authoritativeStateMutation, false);
  assert.deepEqual(mechanicsP2gStageTaskResult.mechanicsP2gStageTaskAuthority.writeFamilies, ['mls-mpm-grid']);
  assert.equal(mechanicsP2gStageTaskResult.mechanicsP2gStageTaskEvidence.passed, true);
  assert.equal(mechanicsP2gStageTaskResult.mechanicsP2gStageTaskEvidence.stageId, 'p2g');
  assert.equal(mechanicsP2gStageTaskResult.mechanicsP2gStageTaskEvidence.promotionStatus, 'stage-task-evidence-only-not-authoritative');
  assert.deepEqual(mechanicsP2gStageTaskResult.mechanicsP2gStageTaskEvidence.transientWriteFamilies, ['mls-mpm-grid']);
  assert.equal(mechanicsP2gStageTaskResult.mechanicsP2gStageTaskEvidence.pressureInterface.suppressed, true);
  assert.equal(mechanicsP2gStageTaskResult.mechanicsP2gStageTaskEvidence.productInput.suppressed, true);
  assert.equal(mechanicsP2gStageTaskResult.gpuFence.fenceSatisfied, true);
  assert.equal(mechanicsP2gStageTaskResult.computeExecution.taskFamily, 'ulg-mls-mpm-mechanics-p2g-stage');
  assert.equal(mechanicsP2gStageTaskResult.computeExecution.executionMode, 'inline');

  const mechanicsGridUpdateStageTask = createMlsMpmMechanicsGridUpdateStageComputeTask({
    p2gGridProjection: mechanicsP2gStageTaskResult,
    modulePath: ULG_MLS_MPM_GPU_STEP_MODULE_URL.href,
    taskId: 'ulg:test:mechanics-grid-update-stage-child',
    preferWebGpu: false,
    readbackMode: 'full-parity-readback'
  });
  assert.equal(mechanicsGridUpdateStageTask.schema, ULG_MLS_MPM_MECHANICS_GRID_UPDATE_STAGE_COMPUTE_TASK_SCHEMA);
  assert.equal(mechanicsGridUpdateStageTask.taskFamily, 'ulg-mls-mpm-mechanics-grid-update-stage');
  assert.equal(mechanicsGridUpdateStageTask.residency, 'cpu-oracle');
  assert.equal(mechanicsGridUpdateStageTask.exportName, 'runMlsMpmMechanicsGridUpdateStageComputeTask');
  assert.equal(mechanicsGridUpdateStageTask.lawGraphNode.nodeId, 'ulg-mls-mpm-mechanics-law');
  assert.deepEqual(mechanicsGridUpdateStageTask.readFamilies, ['mls-mpm-grid']);
  assert.deepEqual(mechanicsGridUpdateStageTask.writeFamilies, ['mls-mpm-grid']);
  const mechanicsGridUpdateStageTaskResult = await computeManager.submitTask(mechanicsGridUpdateStageTask);
  assert.equal(
    mechanicsGridUpdateStageTaskResult.computeTaskResultSchema,
    ULG_MLS_MPM_MECHANICS_GRID_UPDATE_STAGE_COMPUTE_TASK_RESULT_SCHEMA
  );
  assert.equal(mechanicsGridUpdateStageTaskResult.computeTaskSchema, ULG_MLS_MPM_MECHANICS_GRID_UPDATE_STAGE_COMPUTE_TASK_SCHEMA);
  assert.equal(mechanicsGridUpdateStageTaskResult.mechanicsGridUpdateStageTask, true);
  assert.equal(mechanicsGridUpdateStageTaskResult.mechanicsGridUpdateStageTaskAuthority.status, 'compute-manager-owned-non-mutating-grid-update-stage-task');
  assert.equal(mechanicsGridUpdateStageTaskResult.mechanicsGridUpdateStageTaskAuthority.authoritativeStateMutation, false);
  assert.deepEqual(mechanicsGridUpdateStageTaskResult.mechanicsGridUpdateStageTaskAuthority.writeFamilies, ['mls-mpm-grid']);
  assert.equal(mechanicsGridUpdateStageTaskResult.mechanicsGridUpdateStageTaskEvidence.passed, true);
  assert.equal(mechanicsGridUpdateStageTaskResult.mechanicsGridUpdateStageTaskEvidence.stageId, 'gridUpdate');
  assert.equal(mechanicsGridUpdateStageTaskResult.mechanicsGridUpdateStageTaskEvidence.promotionStatus, 'stage-task-evidence-only-not-authoritative');
  assert.deepEqual(mechanicsGridUpdateStageTaskResult.mechanicsGridUpdateStageTaskEvidence.transientReadFamilies, ['mls-mpm-grid']);
  assert.deepEqual(mechanicsGridUpdateStageTaskResult.mechanicsGridUpdateStageTaskEvidence.transientWriteFamilies, ['mls-mpm-grid']);
  assert.equal(mechanicsGridUpdateStageTaskResult.mechanicsGridUpdateStageTaskEvidence.pressureInterface.suppressed, true);
  assert.equal(mechanicsGridUpdateStageTaskResult.gpuFence.fenceSatisfied, true);
  assert.equal(mechanicsGridUpdateStageTaskResult.computeExecution.taskFamily, 'ulg-mls-mpm-mechanics-grid-update-stage');
  assert.equal(mechanicsGridUpdateStageTaskResult.computeExecution.executionMode, 'inline');

  const mechanicsG2pStageTask = createMlsMpmMechanicsG2pStageComputeTask({
    ...mechanicsStageParticle,
    gridUpdate: mechanicsGridUpdateStageTaskResult,
    modulePath: ULG_MLS_MPM_GPU_STEP_MODULE_URL.href,
    taskId: 'ulg:test:mechanics-g2p-stage-child',
    preferWebGpu: false,
    readbackMode: 'full-parity-readback'
  });
  assert.equal(mechanicsG2pStageTask.schema, ULG_MLS_MPM_MECHANICS_G2P_STAGE_COMPUTE_TASK_SCHEMA);
  assert.equal(mechanicsG2pStageTask.taskFamily, 'ulg-mls-mpm-mechanics-g2p-stage');
  assert.equal(mechanicsG2pStageTask.residency, 'cpu-oracle');
  assert.equal(mechanicsG2pStageTask.exportName, 'runMlsMpmMechanicsG2pStageComputeTask');
  assert.equal(mechanicsG2pStageTask.lawGraphNode.nodeId, 'ulg-mls-mpm-mechanics-law');
  assert.deepEqual(mechanicsG2pStageTask.readFamilies, ['sph-particle-state', 'mls-mpm-mechanics', 'mls-mpm-grid']);
  assert.deepEqual(mechanicsG2pStageTask.writeFamilies, ['sph-particle-state', 'mls-mpm-mechanics']);
  const mechanicsG2pStageTaskResult = await computeManager.submitTask(mechanicsG2pStageTask);
  assert.equal(
    mechanicsG2pStageTaskResult.computeTaskResultSchema,
    ULG_MLS_MPM_MECHANICS_G2P_STAGE_COMPUTE_TASK_RESULT_SCHEMA
  );
  assert.equal(mechanicsG2pStageTaskResult.computeTaskSchema, ULG_MLS_MPM_MECHANICS_G2P_STAGE_COMPUTE_TASK_SCHEMA);
  assert.equal(mechanicsG2pStageTaskResult.mechanicsG2pStageTask, true);
  assert.equal(mechanicsG2pStageTaskResult.mechanicsG2pStageTaskAuthority.status, 'compute-manager-owned-non-mutating-g2p-stage-task');
  assert.equal(mechanicsG2pStageTaskResult.mechanicsG2pStageTaskAuthority.authoritativeStateMutation, false);
  assert.deepEqual(mechanicsG2pStageTaskResult.mechanicsG2pStageTaskAuthority.writeFamilies, ['sph-particle-state', 'mls-mpm-mechanics']);
  assert.equal(mechanicsG2pStageTaskResult.mechanicsG2pStageTaskEvidence.passed, true);
  assert.equal(mechanicsG2pStageTaskResult.mechanicsG2pStageTaskEvidence.stageId, 'g2p');
  assert.equal(mechanicsG2pStageTaskResult.mechanicsG2pStageTaskEvidence.promotionStatus, 'stage-task-evidence-only-not-authoritative');
  assert.deepEqual(mechanicsG2pStageTaskResult.mechanicsG2pStageTaskEvidence.transientReadFamilies, ['mls-mpm-grid']);
  assert.deepEqual(mechanicsG2pStageTaskResult.mechanicsG2pStageTaskEvidence.candidateWriteFamilies, ['sph-particle-state', 'mls-mpm-mechanics']);
  assert.deepEqual(mechanicsG2pStageTaskResult.mechanicsG2pStageTaskEvidence.authoritativeWriteFamilies, []);
  assert.equal(mechanicsG2pStageTaskResult.mechanicsG2pStageTaskEvidence.pressureInterface.suppressed, true);
  assert.equal(mechanicsG2pStageTaskResult.gpuFence.fenceSatisfied, true);
  assert.equal(mechanicsG2pStageTaskResult.computeExecution.taskFamily, 'ulg-mls-mpm-mechanics-g2p-stage');
  assert.equal(mechanicsG2pStageTaskResult.computeExecution.executionMode, 'inline');

  const stripStageRunnerRuntimeFields = ({
    defaultRunner: _defaultRunner,
    stageId: _stageId,
    webGpuRunner: _webGpuRunner,
    onDeviceLost: _onDeviceLost,
    navigatorRef: _navigatorRef,
    device: _device,
    deviceResult: _deviceResult,
    ...stageOptions
  }) => stageOptions;
  const submitReplacementP2gStage = (taskId) => (stageOptions) => computeManager.submitTask(
    createMlsMpmMechanicsP2gStageComputeTask({
      ...stripStageRunnerRuntimeFields(stageOptions),
      modulePath: ULG_MLS_MPM_GPU_STEP_MODULE_URL.href,
      taskId,
      preferWebGpu: false,
      readbackMode: 'full-parity-readback'
    })
  );
  const submitReplacementGridUpdateStage = (taskId) => (stageOptions) => computeManager.submitTask(
    createMlsMpmMechanicsGridUpdateStageComputeTask({
      ...stripStageRunnerRuntimeFields(stageOptions),
      modulePath: ULG_MLS_MPM_GPU_STEP_MODULE_URL.href,
      taskId,
      preferWebGpu: false,
      readbackMode: 'full-parity-readback'
    })
  );
  const submitReplacementG2pStage = (taskId) => (stageOptions) => computeManager.submitTask(
    createMlsMpmMechanicsG2pStageComputeTask({
      ...stripStageRunnerRuntimeFields(stageOptions),
      modulePath: ULG_MLS_MPM_GPU_STEP_MODULE_URL.href,
      taskId,
      preferWebGpu: false,
      readbackMode: 'full-parity-readback'
    })
  );

  const p2gStageReplacedStep = await runMlsMpmMechanicsOnlyResidentStepWithOptionalWebGpu({
    ...mechanicsStageParticle,
    preferWebGpu: false,
    readbackMode: 'full-parity-readback',
    p2gStageRunner: submitReplacementP2gStage('ulg:test:mechanics-child-p2g-stage-replacement')
  });
  assert.equal(p2gStageReplacedStep.mechanicsOnlySplitPath.status, 'mechanics-only-direct-step-executed');
  assert.deepEqual(p2gStageReplacedStep.mechanicsOnlySplitPath.stageTaskBoundaries, {
    p2g: true,
    gridUpdate: false,
    g2p: false
  });
  assert.equal(
    p2gStageReplacedStep.mechanicsOnlySplitPath.stageTaskEvidence.p2g.schema,
    'peercompute.ulg.mechanics-p2g-stage-task-evidence.v0'
  );
  assert.equal(p2gStageReplacedStep.mechanicsOnlySplitPath.stageTaskEvidence.p2g.passed, true);
  assert.equal(computeManager.getStats().byTaskFamily['ulg-mls-mpm-mechanics-p2g-stage'].completed, 2);

  const p2gGridUpdateReplacedStep = await runMlsMpmMechanicsOnlyResidentStepWithOptionalWebGpu({
    ...mechanicsStageParticle,
    preferWebGpu: false,
    readbackMode: 'full-parity-readback',
    p2gStageRunner: submitReplacementP2gStage('ulg:test:mechanics-child-p2g-stage-replacement-grid-chain'),
    gridUpdateStageRunner: submitReplacementGridUpdateStage('ulg:test:mechanics-child-grid-update-stage-replacement')
  });
  assert.deepEqual(p2gGridUpdateReplacedStep.mechanicsOnlySplitPath.stageTaskBoundaries, {
    p2g: true,
    gridUpdate: true,
    g2p: false
  });
  assert.equal(
    p2gGridUpdateReplacedStep.mechanicsOnlySplitPath.stageTaskEvidence.gridUpdate.schema,
    'peercompute.ulg.mechanics-grid-update-stage-task-evidence.v0'
  );
  assert.equal(p2gGridUpdateReplacedStep.mechanicsOnlySplitPath.stageTaskEvidence.gridUpdate.passed, true);
  assert.equal(computeManager.getStats().byTaskFamily['ulg-mls-mpm-mechanics-p2g-stage'].completed, 3);
  assert.equal(computeManager.getStats().byTaskFamily['ulg-mls-mpm-mechanics-grid-update-stage'].completed, 2);

  const allStageReplacedStep = await runMlsMpmMechanicsOnlyResidentStepWithOptionalWebGpu({
    ...mechanicsStageParticle,
    preferWebGpu: false,
    readbackMode: 'full-parity-readback',
    p2gStageRunner: submitReplacementP2gStage('ulg:test:mechanics-child-p2g-stage-replacement-full-chain'),
    gridUpdateStageRunner: submitReplacementGridUpdateStage('ulg:test:mechanics-child-grid-update-stage-replacement-full-chain'),
    g2pStageRunner: submitReplacementG2pStage('ulg:test:mechanics-child-g2p-stage-replacement')
  });
  assert.deepEqual(allStageReplacedStep.mechanicsOnlySplitPath.stageTaskBoundaries, {
    p2g: true,
    gridUpdate: true,
    g2p: true
  });
  assert.equal(
    allStageReplacedStep.mechanicsOnlySplitPath.stageTaskEvidence.g2p.schema,
    'peercompute.ulg.mechanics-g2p-stage-task-evidence.v0'
  );
  assert.equal(allStageReplacedStep.mechanicsOnlySplitPath.stageTaskEvidence.g2p.passed, true);
  assert.equal(computeManager.getStats().byTaskFamily['ulg-mls-mpm-mechanics-p2g-stage'].completed, 4);
  assert.equal(computeManager.getStats().byTaskFamily['ulg-mls-mpm-mechanics-grid-update-stage'].completed, 3);
  assert.equal(computeManager.getStats().byTaskFamily['ulg-mls-mpm-mechanics-g2p-stage'].completed, 2);

  const scheduledStageChainStep = await runMlsMpmMechanicsOnlyResidentStepWithComputeManagerStageTasks({
    ...mechanicsStageParticle,
    computeManager,
    nodeKernel: authorityKernel,
    modulePath: ULG_MLS_MPM_GPU_STEP_MODULE_URL.href,
    stageTaskIdPrefix: 'ulg:test:mechanics-stage-task-chain',
    preferWebGpu: false,
    readbackMode: 'full-parity-readback'
  });
  assert.equal(scheduledStageChainStep.mechanicsStageTaskChain.schema, ULG_MLS_MPM_MECHANICS_STAGE_TASK_CHAIN_SCHEMA);
  assert.equal(scheduledStageChainStep.mechanicsStageTaskChain.status, 'compute-manager-stage-task-chain-executed');
  assert.equal(scheduledStageChainStep.mechanicsStageTaskChain.schedulerStatus, 'peercompute-native-task-graph-used');
  assert.equal(scheduledStageChainStep.mechanicsStageTaskChain.nativeTaskGraphSchema, 'peercompute.compute.task-graph-result.v0');
  assert.equal(scheduledStageChainStep.mechanicsStageTaskChain.nativeTaskGraphStatus, 'completed');
  assert.deepEqual(scheduledStageChainStep.mechanicsStageTaskChain.nativeTaskGraphExecutionOrder, ['p2g', 'gridUpdate', 'g2p']);
  assert.equal(
    scheduledStageChainStep.mechanicsStageTaskChain.nativeTaskGraphCachePolicySchema,
    'peercompute.compute.task-graph-cache-policy.v0'
  );
  assert.equal(
    scheduledStageChainStep.mechanicsStageTaskChain.nativeTaskGraphCacheKeySource,
    'content-addressed-inputs'
  );
  assert.equal(
    scheduledStageChainStep.mechanicsStageTaskChain.nativeTaskGraphCacheInputsSchema,
    'peercompute.compute.task-graph-cache-inputs.v0'
  );
  assert.match(
    scheduledStageChainStep.mechanicsStageTaskChain.nativeTaskGraphCacheInputHash,
    /^fnv1a32-[0-9a-f]{8}$/
  );
  assert.match(
    scheduledStageChainStep.mechanicsStageTaskChain.nativeTaskGraphCacheKey,
    /^ulg-mechanics-stage-chain-local-oracle:fnv1a32-[0-9a-f]{8}$/
  );
  assert.equal(
    scheduledStageChainStep.mechanicsStageTaskChain.nativeTaskGraphCacheAdmissionStatus,
    'recorded-not-admitted'
  );
  assert.equal(
    scheduledStageChainStep.mechanicsStageTaskChain.nativeTaskGraphCacheArtifactSchema,
    'peercompute.compute.task-graph-cache-artifact.v0'
  );
  assert.equal(
    scheduledStageChainStep.mechanicsStageTaskChain.nativeTaskGraphCacheArtifactStatus,
    'recorded-not-admitted'
  );
  assert.equal(scheduledStageChainStep.mechanicsStageTaskChain.nativeTaskGraphCacheArtifactAdmitted, false);
  assert.match(
    scheduledStageChainStep.mechanicsStageTaskChain.nativeTaskGraphCacheArtifactResultHash,
    /^fnv1a32-[0-9a-f]{8}$/
  );
  assert.equal(scheduledStageChainStep.mechanicsStageTaskChain.nativeTaskGraphCacheStatus, 'recorded');
  assert.equal(
    scheduledStageChainStep.mechanicsStageTaskChain.nativeTaskGraphPlacementPolicySchema,
    'peercompute.compute.task-graph-placement-policy.v0'
  );
  assert.equal(
    scheduledStageChainStep.mechanicsStageTaskChain.nativeTaskGraphPlacementPolicy.requestedPlacement,
    'local-cpu-oracle'
  );
  assert.equal(scheduledStageChainStep.mechanicsStageTaskChain.nativeTaskGraphCancellationStatus, 'not-cancelled');
  assert.equal(scheduledStageChainStep.mechanicsStageTaskChain.nativeTaskGraphLeaseRequired, false);
  assert.equal(scheduledStageChainStep.mechanicsStageTaskChain.nativeTaskGraphLeaseStatus, 'not-required');
  assert.equal(
    scheduledStageChainStep.mechanicsStageTaskChain.nativeTaskGraphNodeKernelAuthoritySchema,
    'peercompute.nodekernel.task-graph-authority.v0'
  );
  assert.equal(
    scheduledStageChainStep.mechanicsStageTaskChain.nativeTaskGraphNodeKernelAuthorityStatus,
    'submitted-through-node-kernel'
  );
  assert.equal(
    scheduledStageChainStep.mechanicsStageTaskChain.nativeTaskGraphPlacementPreflightSchema,
    'peercompute.nodekernel.task-graph-placement-preflight.v0'
  );
  assert.equal(
    scheduledStageChainStep.mechanicsStageTaskChain.nativeTaskGraphPlacementPreflightStatus,
    'local-placement-accepted'
  );
  assert.equal(
    scheduledStageChainStep.mechanicsStageTaskChain.nativeTaskGraphAuthorityPath,
    'node-kernel-submit-task-graph'
  );
  assert.equal(
    scheduledStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStagePlanSchema,
    'peercompute.compute.gpu-resident-lane-stage-plan.v0'
  );
  assert.equal(
    scheduledStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStagePlanContractSchema,
    'peercompute.ulg.mls-mpm-mechanics-stage-lane-contract.v0'
  );
  assert.equal(scheduledStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStagePlanStatus, 'contract-stage-plan-ready');
  assert.equal(scheduledStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStagePlanDefaultEnabled, false);
  assert.equal(
    scheduledStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageExecutionSchema,
    'peercompute.compute.gpu-resident-lane-stage-execution.v0'
  );
  assert.equal(scheduledStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageExecutionStatus, 'completed');
  assert.equal(scheduledStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageExecutionCompletedStageCount, 3);
  assert.deepEqual(
    scheduledStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageExecutionStageOrder,
    ['p2g', 'gridUpdate', 'g2p']
  );
  assert.equal(scheduledStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageLeaseFenceStatus, 'queue-work-completed');
  assert.equal(scheduledStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageLeaseFenceSatisfied, true);
  assert.equal(scheduledStageChainStep.mechanicsStageTaskChain.computeManagerOwned, true);
  assert.equal(scheduledStageChainStep.mechanicsStageTaskChain.nodeKernelOwned, true);
  assert.equal(scheduledStageChainStep.mechanicsStageTaskChain.authoritativeStateMutation, false);
  assert.deepEqual(scheduledStageChainStep.mechanicsStageTaskChain.stageOrder, ['p2g', 'gridUpdate', 'g2p']);
  assert.deepEqual(scheduledStageChainStep.mechanicsStageTaskChain.stageTaskBoundaries, {
    p2g: true,
    gridUpdate: true,
    g2p: true
  });
  assert.equal(scheduledStageChainStep.mechanicsStageTaskChain.allStageTaskEvidencePassed, true);
  assert.equal(
    scheduledStageChainStep.mechanicsOnlySplitPath.stageTaskChain.schema,
    ULG_MLS_MPM_MECHANICS_STAGE_TASK_CHAIN_SCHEMA
  );
  assert.equal(computeManager.getStats().byTaskFamily['ulg-mls-mpm-mechanics-p2g-stage'].completed, 5);
  assert.equal(computeManager.getStats().byTaskFamily['ulg-mls-mpm-mechanics-grid-update-stage'].completed, 4);
  assert.equal(computeManager.getStats().byTaskFamily['ulg-mls-mpm-mechanics-g2p-stage'].completed, 3);

  assert.equal(typeof computeManager.submitTaskGraph, 'function');
  const nativeStageDag = await computeManager.submitTaskGraph({
    graphId: 'ulg:test:mechanics-native-stage-dag',
    cachePolicy: {
      mode: 'record-only',
      scope: 'ulg-test-mechanics-stage-dag'
    },
    cacheAdmission: {
      status: 'recorded-not-admitted',
      admitted: false,
      authority: 'ulg-test-state-manager-admission-required',
      validatorId: 'ulg-test-native-stage-dag',
      reason: 'test-record-only-cache-artifact'
    },
    cacheInputs: {
      graphFamily: 'ulg-test-mechanics-native-stage-dag',
      graphVersion: 'v0',
      lawGraphId: 'peercompute.ulg.local-sph-law-closure-graph',
      lawIds: ['ulg-mls-mpm-mechanics-law'],
      stateFamilies: ['sph-particle-state', 'mls-mpm-mechanics', 'mls-mpm-grid'],
      readFamilies: ['sph-particle-state', 'mls-mpm-mechanics'],
      writeFamilies: ['sph-particle-state', 'mls-mpm-mechanics'],
      closureRefs: ['mls-mpm-transfer-kernel', 'mechanics-material-table'],
      stateRefs: ['test-sph-state:v0', 'test-mls-state:v0'],
      values: {
        dtSeconds: mechanicsStageParticle.dt,
        particleCount: mechanicsStageParticle.sphParticleState.particleCount
      }
    },
    placementPolicy: {
      mode: 'local-cpu-oracle',
      locality: 'local-inline',
      authority: 'compute-manager',
      advisory: false
    },
    cancellation: {
      mode: 'cooperative'
    },
    gpuResidentLane: {
      required: true,
      laneId: 'ulg:test:mechanics-native-stage-dag:graph-lane',
      stateKey: 'ulg:test:mechanics-native-stage-dag:state',
      owner: 'ulg-test-native-stage-dag',
      readFamilies: ['sph-particle-state', 'mls-mpm-mechanics'],
      writeFamilies: ['sph-particle-state', 'mls-mpm-mechanics'],
      retainedBufferRefs: ['test-sph-state-buffer', 'test-mls-mpm-mechanics-buffer']
    },
    nodes: [
      {
        id: 'p2g',
        createTask: () => createMlsMpmMechanicsP2gStageComputeTask({
          ...mechanicsStageParticle,
          modulePath: ULG_MLS_MPM_GPU_STEP_MODULE_URL.href,
          taskId: 'ulg:test:native-stage-dag:p2g',
          preferWebGpu: false,
          readbackMode: 'full-parity-readback'
        })
      },
      {
        id: 'gridUpdate',
        dependsOn: ['p2g'],
        createTask: ({ getResult }) => createMlsMpmMechanicsGridUpdateStageComputeTask({
          p2gGridProjection: getResult('p2g'),
          modulePath: ULG_MLS_MPM_GPU_STEP_MODULE_URL.href,
          taskId: 'ulg:test:native-stage-dag:grid-update',
          preferWebGpu: false,
          readbackMode: 'full-parity-readback'
        })
      },
      {
        id: 'g2p',
        dependsOn: ['gridUpdate'],
        createTask: ({ getResult }) => createMlsMpmMechanicsG2pStageComputeTask({
          ...mechanicsStageParticle,
          gridUpdate: getResult('gridUpdate'),
          modulePath: ULG_MLS_MPM_GPU_STEP_MODULE_URL.href,
          taskId: 'ulg:test:native-stage-dag:g2p',
          preferWebGpu: false,
          readbackMode: 'full-parity-readback'
        })
      }
    ]
  });
  assert.equal(nativeStageDag.schema, 'peercompute.compute.task-graph-result.v0');
  assert.equal(nativeStageDag.status, 'completed');
  assert.deepEqual(nativeStageDag.executionOrder, ['p2g', 'gridUpdate', 'g2p']);
  assert.deepEqual(nativeStageDag.executionBatches, [['p2g'], ['gridUpdate'], ['g2p']]);
  assert.equal(nativeStageDag.cachePolicy.schema, 'peercompute.compute.task-graph-cache-policy.v0');
  assert.equal(nativeStageDag.cachePolicy.keySource, 'content-addressed-inputs');
  assert.equal(nativeStageDag.cachePolicy.inputs.schema, 'peercompute.compute.task-graph-cache-inputs.v0');
  assert.match(nativeStageDag.cacheInputHash, /^fnv1a32-[0-9a-f]{8}$/);
  assert.match(nativeStageDag.cacheKey, /^ulg-test-mechanics-stage-dag:fnv1a32-[0-9a-f]{8}$/);
  assert.equal(nativeStageDag.cacheAdmissionStatus, 'recorded-not-admitted');
  assert.equal(nativeStageDag.cacheArtifact.schema, 'peercompute.compute.task-graph-cache-artifact.v0');
  assert.equal(nativeStageDag.cacheArtifact.admitted, false);
  assert.equal(nativeStageDag.cacheArtifact.admission.validatorId, 'ulg-test-native-stage-dag');
  assert.match(nativeStageDag.cacheArtifact.resultHash, /^fnv1a32-[0-9a-f]{8}$/);
  assert.equal(computeManager.getTaskGraphCacheArtifact(nativeStageDag.cacheKey).schema, 'peercompute.compute.task-graph-cache-artifact.v0');
  assert.equal(computeManager.getStats().taskGraphCacheArtifactsWritten, 2);
  const nativeStageDagAdmission = authorityKernel.admitTaskGraphCacheArtifact(nativeStageDag.cacheKey, {
    validatorId: 'ulg-test-native-stage-dag-state-manager',
    reason: 'ulg-native-stage-dag-cache-artifact-admitted-after-cpu-oracle-evidence'
  });
  assert.equal(nativeStageDagAdmission.schema, 'peercompute.state.task-graph-cache-artifact-admission.v0');
  assert.equal(nativeStageDagAdmission.cacheKey, nativeStageDag.cacheKey);
  assert.equal(nativeStageDagAdmission.authority, 'node-kernel-state-manager');
  assert.equal(nativeStageDagAdmission.computeArtifactAdmitted, true);
  assert.equal(nativeStageDagAdmission.computeArtifactStatus, 'admitted-cache-artifact-recorded');
  assert.equal(
    stateManager.getTaskGraphCacheArtifactAdmission(nativeStageDag.cacheKey).validatorId,
    'ulg-test-native-stage-dag-state-manager'
  );
  assert.equal(computeManager.getTaskGraphCacheArtifact(nativeStageDag.cacheKey).admitted, true);
  assert.equal(computeManager.getStats().taskGraphCacheArtifactsAdmitted, 1);
  const nativeStageDagInvalidation = authorityKernel.invalidateTaskGraphCacheArtifact(nativeStageDag.cacheKey, {
    reason: 'ulg-native-stage-dag-cache-artifact-invalidated-for-law-update'
  });
  assert.equal(nativeStageDagInvalidation.schema, 'peercompute.state.task-graph-cache-artifact-invalidation.v0');
  assert.equal(nativeStageDagInvalidation.cacheKey, nativeStageDag.cacheKey);
  assert.equal(nativeStageDagInvalidation.computeArtifactStatus, 'invalidated');
  assert.equal(stateManager.getTaskGraphCacheArtifactAdmission(nativeStageDag.cacheKey).status, 'invalidated');
  assert.equal(computeManager.getTaskGraphCacheArtifact(nativeStageDag.cacheKey).admitted, false);
  assert.equal(computeManager.getStats().taskGraphCacheInvalidations, 1);
  assert.equal(nativeStageDag.cacheStatus, 'recorded');
  assert.equal(nativeStageDag.placementPolicy.schema, 'peercompute.compute.task-graph-placement-policy.v0');
  assert.equal(nativeStageDag.placementPolicy.requestedPlacement, 'local-cpu-oracle');
  assert.equal(nativeStageDag.cancellationStatus, 'not-cancelled');
  assert.equal(nativeStageDag.graphLeaseRequired, true);
  assert.equal(nativeStageDag.graphLeaseStatus, 'completed');
  assert.equal(nativeStageDag.graphLease.schema, 'peercompute.compute.gpu-resident-lane-lease.v0');
  assert.equal(nativeStageDag.graphLeaseExecution.schema, 'peercompute.compute.gpu-resident-lane-execution.v0');
  assert.equal(computeManager.cancelTaskGraph('ulg:test:missing-graph').status, 'not-found');
  assert.equal(nativeStageDag.nodeResults.p2g.mechanicsP2gStageTaskEvidence.passed, true);
  assert.equal(nativeStageDag.nodeResults.gridUpdate.mechanicsGridUpdateStageTaskEvidence.passed, true);
  assert.equal(nativeStageDag.nodeResults.g2p.mechanicsG2pStageTaskEvidence.passed, true);
  assert.equal(computeManager.getStats().byTaskFamily['ulg-mls-mpm-mechanics-p2g-stage'].completed, 6);
  assert.equal(computeManager.getStats().byTaskFamily['ulg-mls-mpm-mechanics-grid-update-stage'].completed, 5);
  assert.equal(computeManager.getStats().byTaskFamily['ulg-mls-mpm-mechanics-g2p-stage'].completed, 4);

  const laneExecutedStageChainStep = await runMlsMpmMechanicsOnlyResidentStepWithComputeManagerStageTasks({
    ...mechanicsStageParticle,
    computeManager,
    modulePath: ULG_MLS_MPM_GPU_STEP_MODULE_URL.href,
    stageTaskIdPrefix: 'ulg:test:mechanics-stage-lane-executor-chain',
    useNativeTaskGraph: false,
    preferWebGpu: false,
    readbackMode: 'full-parity-readback'
  });
  assert.equal(
    laneExecutedStageChainStep.mechanicsStageTaskChain.schedulerStatus,
    'ulg-helper-stage-runners-used-awaiting-gpu-graph-semantics'
  );
  assert.equal(
    laneExecutedStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStagePlanContractSchema,
    'peercompute.ulg.mls-mpm-mechanics-stage-lane-contract.v0'
  );
  assert.equal(laneExecutedStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageExecutionStatus, 'completed');
  assert.equal(laneExecutedStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageExecutionCompletedStageCount, 3);
  assert.deepEqual(
    laneExecutedStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageExecutionStageOrder,
    ['p2g', 'gridUpdate', 'g2p']
  );
  assert.equal(laneExecutedStageChainStep.mechanicsStageTaskChain.gpuHubResidentStageExecutorMode, 'registered');
  assert.equal(laneExecutedStageChainStep.mechanicsStageTaskChain.gpuHubResidentStageExecutorRegisteredCount, 3);
  assert.deepEqual(laneExecutedStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageExecutionExecutorSources, {
    p2g: 'gpu-hub-resident-stage-executor',
    gridUpdate: 'gpu-hub-resident-stage-executor',
    g2p: 'gpu-hub-resident-stage-executor'
  });
  assert.equal(laneExecutedStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageExecutionUsedGpuHubExecutors, true);
  assert.equal(laneExecutedStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageExecutionRequestedWorkerResidency, true);
  assert.deepEqual(laneExecutedStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageExecutionWorkerResidencyStatuses, {
    p2g: 'blocked-worker-backend-missing',
    gridUpdate: 'blocked-worker-backend-missing',
    g2p: 'blocked-worker-backend-missing'
  });
  assert.deepEqual(new Set(gpuHub.listResidentStageExecutors().map((entry) => entry.stageId)), new Set(['p2g', 'gridUpdate', 'g2p']));
  assert.deepEqual(laneExecutedStageChainStep.mechanicsStageTaskChain.stageTaskBoundaries, {
    p2g: true,
    gridUpdate: true,
    g2p: true
  });
  assert.equal(laneExecutedStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageLeaseFenceSatisfied, true);
  assert.equal(computeManager.getStats().byTaskFamily['ulg-mls-mpm-mechanics-p2g-stage'].completed, 7);
  assert.equal(computeManager.getStats().byTaskFamily['ulg-mls-mpm-mechanics-grid-update-stage'].completed, 6);
  assert.equal(computeManager.getStats().byTaskFamily['ulg-mls-mpm-mechanics-g2p-stage'].completed, 5);

  const laneExecutedWebGpuRequestedStageChainStep = await runMlsMpmMechanicsOnlyResidentStepWithComputeManagerStageTasks({
    ...mechanicsStageParticle,
    computeManager,
    modulePath: ULG_MLS_MPM_GPU_STEP_MODULE_URL.href,
    stageTaskIdPrefix: 'ulg:test:mechanics-stage-lane-executor-webgpu-requested-chain',
    useNativeTaskGraph: false,
    preferWebGpu: true,
    readbackMode: 'full-parity-readback',
    gpuResidentLaneId: 'ulg:test:mechanics-stage-lane-executor-webgpu-requested',
    gpuResidentLaneStateKey: 'ulg:test:mechanics-stage-lane-executor-webgpu-requested-state'
  });
  assert.equal(
    laneExecutedWebGpuRequestedStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageTaskLaneAligned,
    true
  );
  assert.deepEqual(laneExecutedWebGpuRequestedStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageTaskLaneIds, {
    p2g: 'ulg:test:mechanics-stage-lane-executor-webgpu-requested',
    gridUpdate: 'ulg:test:mechanics-stage-lane-executor-webgpu-requested',
    g2p: 'ulg:test:mechanics-stage-lane-executor-webgpu-requested'
  });
  assert.deepEqual(laneExecutedWebGpuRequestedStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageTaskStateKeys, {
    p2g: 'ulg:test:mechanics-stage-lane-executor-webgpu-requested-state',
    gridUpdate: 'ulg:test:mechanics-stage-lane-executor-webgpu-requested-state',
    g2p: 'ulg:test:mechanics-stage-lane-executor-webgpu-requested-state'
  });
  assert.deepEqual(laneExecutedWebGpuRequestedStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageTaskResidencies, {
    p2g: 'gpu-lane',
    gridUpdate: 'gpu-lane',
    g2p: 'gpu-lane'
  });
  assert.deepEqual(laneExecutedWebGpuRequestedStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageTaskFenceSatisfied, {
    p2g: true,
    gridUpdate: true,
    g2p: true
  });
  assert.deepEqual(laneExecutedWebGpuRequestedStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageExecutionExecutorSources, {
    p2g: 'gpu-hub-resident-stage-executor',
    gridUpdate: 'gpu-hub-resident-stage-executor',
    g2p: 'gpu-hub-resident-stage-executor'
  });
  assert.equal(laneExecutedWebGpuRequestedStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageExecutionUsedGpuHubExecutors, true);
  assert.deepEqual(laneExecutedWebGpuRequestedStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageExecutionWorkerResidencyStatuses, {
    p2g: 'blocked-worker-backend-missing',
    gridUpdate: 'blocked-worker-backend-missing',
    g2p: 'blocked-worker-backend-missing'
  });
  assert.ok(laneExecutedWebGpuRequestedStageChainStep.mechanicsStageTaskChain.submittedStageTasks.every((task) => (
    task.gpuResidentLaneLaneId === 'ulg:test:mechanics-stage-lane-executor-webgpu-requested'
    && task.gpuResidentLaneStateKey === 'ulg:test:mechanics-stage-lane-executor-webgpu-requested-state'
    && task.gpuFenceRequired === true
  )));
  assert.equal(computeManager.getStats().byTaskFamily['ulg-mls-mpm-mechanics-p2g-stage'].completed, 8);
  assert.equal(computeManager.getStats().byTaskFamily['ulg-mls-mpm-mechanics-grid-update-stage'].completed, 7);
  assert.equal(computeManager.getStats().byTaskFamily['ulg-mls-mpm-mechanics-g2p-stage'].completed, 6);

  const workerBridgeCalls = [];
  const gpuHubWorkerReadyStageChainStep = await runMlsMpmMechanicsOnlyResidentStepWithComputeManagerStageTasks({
    ...mechanicsStageParticle,
    computeManager,
    modulePath: ULG_MLS_MPM_GPU_STEP_MODULE_URL.href,
    stageTaskIdPrefix: 'ulg:test:mechanics-stage-gpuhub-worker-ready-chain',
    useNativeTaskGraph: false,
    preferWebGpu: true,
    readbackMode: 'full-parity-readback',
    gpuResidentLaneId: 'ulg:test:mechanics-stage-gpuhub-worker-ready',
    gpuResidentLaneStateKey: 'ulg:test:mechanics-stage-gpuhub-worker-ready-state',
    gpuHubResidentStageWorkerModuleUrl: '/workers/ulg-mechanics-resident-stage.worker.js',
    gpuHubResidentStageWorkerRunner: {
      async runStage({ stage, input, lease, executor }) {
        workerBridgeCalls.push({
          stageId: stage.id,
          inputSource: input?.source || null,
          workerStatus: executor?.workerPolicy?.status || null
        });
        const gpuResidentLaneRequirement = {
          laneId: lease.laneId,
          stateKey: lease.stateKey
        };
        const gpuFence = {
          schema: 'peercompute.compute.gpu-fence-report.v0',
          status: 'queue-work-completed',
          fenceSatisfied: true,
          required: true,
          laneId: lease.laneId,
          stateKey: lease.stateKey
        };
        const base = {
          backend: 'webgpu-worker-bridge-test',
          gpuResidentLaneRequirement,
          gpuFence,
          gpuFenceReport: gpuFence
        };
        if (stage.id === 'p2g') {
          return {
            value: {
              ...base,
              computeTaskResultSchema: ULG_MLS_MPM_MECHANICS_P2G_STAGE_COMPUTE_TASK_RESULT_SCHEMA,
              gridBufferByteLength: 96,
              mechanicsP2gStageTaskEvidence: { passed: true }
            },
            retainedBufferRefs: ['mls-mpm-p2g-grid-buffer'],
            summary: { backend: 'webgpu-worker-bridge-test', stage: 'p2g' }
          };
        }
        if (stage.id === 'gridUpdate') {
          return {
            value: {
              ...base,
              computeTaskResultSchema: ULG_MLS_MPM_MECHANICS_GRID_UPDATE_STAGE_COMPUTE_TASK_RESULT_SCHEMA,
              updatedGridBufferByteLength: 96,
              mechanicsGridUpdateStageTaskEvidence: { passed: true }
            },
            retainedBufferRefs: ['mls-mpm-grid-update-buffer'],
            summary: { backend: 'webgpu-worker-bridge-test', stage: 'gridUpdate' }
          };
        }
        return {
          value: {
            ...base,
            computeTaskResultSchema: ULG_MLS_MPM_MECHANICS_G2P_STAGE_COMPUTE_TASK_RESULT_SCHEMA,
            stateBufferByteLength: 64,
            mechanicsBufferByteLength: 64,
            mechanicsG2pStageTaskEvidence: { passed: true }
          },
          retainedBufferRefs: ['sph-state-buffer', 'mls-mpm-mechanics-buffer'],
          summary: { backend: 'webgpu-worker-bridge-test', stage: 'g2p' }
        };
      }
    }
  });
  assert.deepEqual(workerBridgeCalls.map((entry) => entry.stageId), ['p2g', 'gridUpdate', 'g2p']);
  assert.deepEqual(workerBridgeCalls.map((entry) => entry.workerStatus), ['worker-ready', 'worker-ready', 'worker-ready']);
  assert.deepEqual(gpuHubWorkerReadyStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageExecutionWorkerResidencyStatuses, {
    p2g: 'worker-ready',
    gridUpdate: 'worker-ready',
    g2p: 'worker-ready'
  });
  assert.equal(gpuHubWorkerReadyStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageExecutionWorkerRunnerSupplied, true);
  assert.equal(
    gpuHubWorkerReadyStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageExecutionWorkerModuleUrl,
    '/workers/ulg-mechanics-resident-stage.worker.js'
  );
  assert.equal(gpuHubWorkerReadyStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageExecutionUsedGpuHubExecutors, true);
  assert.deepEqual(gpuHubWorkerReadyStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageTaskBackends, {
    p2g: 'webgpu-worker-bridge-test',
    gridUpdate: 'webgpu-worker-bridge-test',
    g2p: 'webgpu-worker-bridge-test'
  });
  assert.deepEqual(gpuHubWorkerReadyStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageTaskFenceSatisfied, {
    p2g: true,
    gridUpdate: true,
    g2p: true
  });

  const thermalStageWorkerBridgeCalls = [];
  const pressureInterfaceStagePublicationPayloads = [];
  const thermalStagePublicationPayloads = [];
  const reactionProductStagePublicationPayloads = [];
  const gpuHubWorkerThermalStageChainStep = await runMlsMpmMechanicsOnlyResidentStepWithComputeManagerStageTasks({
    ...mechanicsStageParticle,
    computeManager,
    modulePath: ULG_MLS_MPM_GPU_STEP_MODULE_URL.href,
    stageTaskIdPrefix: 'ulg:test:mechanics-stage-gpuhub-worker-thermal-chain',
    useNativeTaskGraph: false,
    preferWebGpu: true,
    readbackMode: 'no-full-readback',
    includePressureInterfaceStage: true,
    approveSameFramePressureInterfaceGridForces: true,
    includeThermalPhaseStage: true,
    includeReactionProductStage: true,
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
    },
    thermalMaterialTable: { schema: 'test-thermal-material-table.v0' },
    thermalClosureGraphSet: { schema: 'test-thermal-closure-graph-set.v0' },
    thermalClosureGraphBank: null,
    thermalPhaseResponseTable: { schema: 'test-thermal-phase-response-table.v0' },
    reactionTable: { schema: 'test-reaction-table.v0', reactionCount: 1, productTermCount: 1, gasProductCount: 0 },
    reactionStepOptions: { resetMechanics: true },
    wallTemperaturesK: {},
    gpuResidentLaneId: 'ulg:test:mechanics-stage-gpuhub-worker-thermal',
    gpuResidentLaneStateKey: 'ulg:test:mechanics-stage-gpuhub-worker-thermal-state',
    gpuHubResidentStageWorkerModuleUrl: '/workers/ulg-mechanics-resident-stage.worker.js',
    gpuHubResidentPressureInterfaceStageWorkerOutputPublisher(payload) {
      pressureInterfaceStagePublicationPayloads.push(payload);
      return {
        schema: 'peercompute.ulg.pressure-interface-worker-retained-hot-buffer-publication.v0',
        status: 'worker-retained-pressure-interface-output-published',
        committed: true,
        hotBufferKey: 'ulg:test:pressure-interface-publication-hot-buffer',
        commitDeltaTaskId: 'ulg:test:pressure-interface-publication-delta'
      };
    },
    gpuHubResidentThermalStageWorkerOutputPublisher(payload) {
      thermalStagePublicationPayloads.push(payload);
      return {
        schema: 'peercompute.ulg.thermal-phase-worker-retained-hot-buffer-publication.v0',
        status: 'worker-retained-thermal-phase-output-published',
        committed: true,
        hotBufferKey: 'ulg:test:thermal-phase-publication-hot-buffer',
        commitDeltaTaskId: 'ulg:test:thermal-phase-publication-delta'
      };
    },
    gpuHubResidentReactionProductStageWorkerOutputPublisher(payload) {
      reactionProductStagePublicationPayloads.push(payload);
      return {
        schema: 'peercompute.ulg.reaction-product-worker-retained-hot-buffer-publication.v0',
        status: 'worker-retained-reaction-product-output-published',
        committed: true,
        hotBufferKey: 'ulg:test:reaction-product-publication-hot-buffer',
        commitDeltaTaskId: 'ulg:test:reaction-product-publication-delta'
      };
    },
    gpuHubResidentStageWorkerRunner: {
      async runStage({ stage, input, lease, executor, context }) {
        thermalStageWorkerBridgeCalls.push({
          stageId: stage.id,
          inputSource: input?.source || null,
          workerStatus: executor?.workerPolicy?.status || null,
          contextSchema: context?.ulgMechanicsResidentStageWorker?.schema || null,
          contextHasPressureInterface: Boolean(context?.ulgMechanicsResidentStageWorker?.common?.materialInterfaceField),
          contextHasGridForceAdmission: Boolean(context?.ulgMechanicsResidentStageWorker?.stageOptions?.gridUpdate?.pressureInterfaceGridForceAdmission),
          contextHasThermalTables: Boolean(context?.ulgMechanicsResidentStageWorker?.common?.thermalMaterialTable),
          contextHasReactionTable: Boolean(context?.ulgMechanicsResidentStageWorker?.common?.reactionTable)
        });
        const gpuResidentLaneRequirement = {
          laneId: lease.laneId,
          stateKey: lease.stateKey
        };
        const gpuFence = {
          schema: 'peercompute.compute.gpu-fence-report.v0',
          status: 'queue-work-completed',
          fenceSatisfied: true,
          required: true,
          laneId: lease.laneId,
          stateKey: lease.stateKey
        };
        const base = {
          backend: 'webgpu',
          status: 'webgpu-accepted-no-full-readback',
          readbackMode: 'no-full-readback',
          normalHotLoopReadbackFree: true,
          gpuResidentLaneRequirement,
          gpuFence,
          gpuFenceReport: gpuFence,
          workerResidentStage: {
            schema: 'peercompute.ulg.mechanics-resident-stage-worker-stage.v0',
            status: 'worker-stage-completed',
            workerWebGpuRequested: true,
            workerWebGpuStatus: 'worker-webgpu-ready',
            workerDeviceCached: true,
            workerQueueFenceSatisfied: true
          }
        };
        if (stage.id === 'p2g') {
          return {
            value: {
              ...base,
              computeTaskResultSchema: ULG_MLS_MPM_MECHANICS_P2G_STAGE_COMPUTE_TASK_RESULT_SCHEMA,
              gridBufferByteLength: 96,
              mechanicsP2gStageTaskEvidence: { schema: 'peercompute.ulg.mechanics-p2g-stage-task-evidence.v0', passed: true }
            },
            retainedBufferRefs: ['mls-mpm-p2g-grid-buffer', 'ulg-worker:test:p2g:grid'],
            summary: { backend: 'webgpu', stage: 'p2g' }
          };
        }
        if (stage.id === 'pressureInterface') {
          return {
            value: {
              ...base,
              backend: 'webgpu',
              status: 'pressure-interface-stage-solver-ready',
              computeTaskResultSchema: ULG_SPH_PRESSURE_INTERFACE_STAGE_COMPUTE_TASK_RESULT_SCHEMA,
              forceRowCount: 2,
              forceRowByteLength: 128,
              forceRowValues: new Float32Array(32),
              forceRowsBufferByteLength: 128,
              pressureInterfaceForceRowsRetained: true,
              pressureInterfaceForceRowsBufferRetained: true,
              gasPressureCellRowCount: 2,
              gasPressureCellRowStrideFloats: 12,
              gasPressureCellRowByteLength: 96,
              gasPressureCellRowsBufferRetained: true,
              pressureInterfaceGasCellFieldAdmission: {
                schema: ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA,
                status: 'pressure-interface-gas-cell-field-consumption-approved',
                gasCellFieldConsumptionApproved: true,
                sourceHotBufferKey: 'ulg:test:pressure-interface-local-gas-cells',
                retainedGasPressureBufferRefs: ['resident-gas-pressure-cells-buffer'],
                workerRetainedGasPressureBufferRefs: ['ulg-worker:test:pressureInterface:result.gasPressureCellsBuffer:2']
              },
              pressureInterfaceGasCellFieldAdmissionSchema: ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA,
              pressureInterfaceGasCellFieldAdmissionStatus: 'pressure-interface-gas-cell-field-consumption-approved',
              pressureInterfaceGasCellFieldAdmissionApproved: true,
              pressureInterfaceGasCellFieldConsumerStatus: 'admitted-local-gas-cell-field-consumer-ready',
              pressureInterfaceForceSolver: {
                schema: 'peercompute.ulg.sph-pressure-interface-force-solver.v0',
                backend: 'webgpu',
                status: 'pressure-interface-force-solver-ready',
                pressureFieldMode: 'local-gas-cell-pressure-gradient',
                pressureFieldResolution: 'structured-gas-cell-grid',
                localPressureGradientReady: true,
                localPressureGradientStatus: 'local-pressure-gradient-field-ready',
                localPressureGradientForceCouplingStatus: 'local-pressure-gradient-force-coupling-ready',
                forceRowCount: 2,
                forceRowStrideFloats: 16,
                forceRowByteLength: 128,
                forceRowsBufferByteLength: 128,
                pressureInterfaceForceRowsBufferRetained: true,
                gasPressureCellRowCount: 2,
                gasPressureCellRowStrideFloats: 12,
                gasPressureCellRowsBufferRetained: true,
                conservationStatus: 'pairwise-equal-opposite-force-conservative',
                conservationResidualMagnitudeN: 0
              },
              pressureInterfaceStageTask: true,
              pressureInterfaceStageTaskEvidence: {
                schema: 'peercompute.ulg.pressure-interface-stage-task-evidence.v0',
                passed: true
              },
              pressureInterfaceStageTaskAuthority: {
                schema: 'peercompute.ulg.pressure-interface-stage-task-authority.v0',
                authoritativeStateMutation: false,
                gridForceApplicationApproved: false
              }
            },
            retainedBufferRefs: [
              'pressure-interface-force-rows-buffer',
              'resident-gas-pressure-cells-buffer',
              'ulg-worker:test:pressureInterface:forceRows',
              'ulg-worker:test:pressureInterface:result.gasPressureCellsBuffer:2'
            ],
            summary: { backend: 'webgpu', stage: 'pressureInterface' }
          };
        }
        if (stage.id === 'gridUpdate') {
          const gridUpdateStageOptions = context?.ulgMechanicsResidentStageWorker?.stageOptions?.gridUpdate || {};
          return {
            value: {
              ...base,
              computeTaskResultSchema: ULG_MLS_MPM_MECHANICS_GRID_UPDATE_STAGE_COMPUTE_TASK_RESULT_SCHEMA,
              updatedGridBufferByteLength: 96,
              mechanicsGridUpdateStageTaskEvidence: { schema: 'peercompute.ulg.mechanics-grid-update-stage-task-evidence.v0', passed: true },
              pressureInterfaceGridForceAdmissionSchema: gridUpdateStageOptions.pressureInterfaceGridForceAdmission?.schema || null,
              pressureInterfaceGridForceAdmissionStatus: gridUpdateStageOptions.pressureInterfaceGridForceAdmission?.status || null,
              pressureInterfaceGridForceAdmissionApproved: gridUpdateStageOptions.pressureInterfaceGridForceAdmission?.gridForceApplicationApproved === true,
              pressureInterfaceGridForceAdmissionSourceHotBufferKey: gridUpdateStageOptions.pressureInterfaceGridForceAdmission?.hotBufferKey || null,
              pressureInterfaceForceApplicationStatus: gridUpdateStageOptions.pressureInterfaceGridForceAdmission
                ? 'pressure-interface-grid-force-consumer-applied'
                : 'not-applied',
              pressureInterfaceForceConsumerStatus: gridUpdateStageOptions.pressureInterfaceGridForceAdmission
                ? 'grid-momentum-impulse-consumed'
                : null,
              pressureInterfaceImpulseProofStatus: gridUpdateStageOptions.pressureInterfaceGridForceAdmission
                ? 'actual-grid-node-impulse'
                : null,
              pressureInterfaceForceRowCount: gridUpdateStageOptions.pressureInterfaceGridForceAdmission?.pressureInterfaceForceRowCount ?? 0
            },
            retainedBufferRefs: ['mls-mpm-grid-update-buffer', 'ulg-worker:test:gridUpdate:grid'],
            summary: { backend: 'webgpu', stage: 'gridUpdate' }
          };
        }
        if (stage.id === 'g2p') {
          return {
            value: {
              ...base,
              computeTaskResultSchema: ULG_MLS_MPM_MECHANICS_G2P_STAGE_COMPUTE_TASK_RESULT_SCHEMA,
              stateBufferByteLength: 64,
              mechanicsBufferByteLength: 64,
              mechanicsG2pStageTaskEvidence: { schema: 'peercompute.ulg.mechanics-g2p-stage-task-evidence.v0', passed: true },
              workerResidentStage: {
                ...base.workerResidentStage,
                workerRetainedThermoInputStatus: 'applied-worker-retained-thermo-input'
              }
            },
            retainedBufferRefs: ['sph-state-buffer', 'mls-mpm-mechanics-buffer', 'ulg-worker:test:g2p:state'],
            summary: { backend: 'webgpu', stage: 'g2p' }
          };
        }
        if (stage.id === 'thermalPhase') {
          return {
            value: {
              ...base,
              computeTaskResultSchema: ULG_SPH_THERMAL_PHASE_STAGE_COMPUTE_TASK_RESULT_SCHEMA,
              stateBufferByteLength: 64,
              thermoBufferByteLength: 64,
              retainedOutputParticleBuffers: true,
              fullReadbackPerformed: false,
              thermalPhaseStageTask: true,
              thermalPhaseStageTaskEvidence: {
                schema: 'peercompute.ulg.thermal-phase-stage-task-evidence.v0',
                passed: true
              },
              thermalPhaseStageTaskAuthority: {
                schema: 'peercompute.ulg.thermal-phase-stage-task-authority.v0',
                authoritativeStateMutation: false
              },
              workerResidentStage: {
                ...base.workerResidentStage,
                workerRetainedThermoInputStatus: 'applied-worker-retained-thermo-input',
                workerRetainedThermoOutputStatus: 'adopted-worker-retained-thermo-output'
              }
            },
            retainedBufferRefs: ['sph-thermo-buffer', 'ulg-worker:test:thermalPhase:thermo'],
            summary: { backend: 'webgpu', stage: 'thermalPhase' }
          };
        }
        return {
          value: {
            ...base,
            computeTaskResultSchema: ULG_SPH_REACTION_PRODUCT_STAGE_COMPUTE_TASK_RESULT_SCHEMA,
            stateBufferByteLength: 64,
            thermoBufferByteLength: 64,
            mechanicsBufferByteLength: 64,
            retainedOutputParticleBuffers: true,
            fullReadbackPerformed: false,
            productTermCount: 1,
            gasProductCount: 0,
            residentProductMassStatus: 'resident-product-mass-buffer-retained',
            residentProductMassBufferRetained: true,
            reactionProductStageTask: true,
            reactionProductStageTaskEvidence: {
              schema: 'peercompute.ulg.reaction-product-stage-task-evidence.v0',
              passed: true
            },
            reactionProductStageTaskAuthority: {
              schema: 'peercompute.ulg.reaction-product-stage-task-authority.v0',
              authoritativeStateMutation: false
            },
            workerResidentStage: {
              ...base.workerResidentStage,
              workerRetainedThermoInputStatus: 'applied-worker-retained-thermo-input',
              workerRetainedThermoOutputStatus: 'adopted-worker-retained-thermo-output'
            }
          },
          retainedBufferRefs: ['sph-state-buffer', 'sph-thermo-buffer', 'mls-mpm-mechanics-buffer', 'resident-product-mass-buffer', 'ulg-worker:test:reactionProduct:product'],
          summary: { backend: 'webgpu', stage: 'reactionProduct' }
        };
      }
    }
  });
  assert.deepEqual(
    thermalStageWorkerBridgeCalls.map((entry) => entry.stageId),
    ['p2g', 'pressureInterface', 'gridUpdate', 'g2p', 'thermalPhase', 'reactionProduct']
  );
  assert.deepEqual(
    thermalStageWorkerBridgeCalls.map((entry) => entry.workerStatus),
    ['worker-ready', 'worker-ready', 'worker-ready', 'worker-ready', 'worker-ready', 'worker-ready']
  );
  assert.equal(thermalStageWorkerBridgeCalls.at(-1).contextSchema, 'peercompute.ulg.mechanics-resident-stage-worker-context.v0');
  assert.equal(thermalStageWorkerBridgeCalls.at(-1).contextHasPressureInterface, true);
  assert.equal(thermalStageWorkerBridgeCalls.at(-1).contextHasThermalTables, true);
  assert.equal(thermalStageWorkerBridgeCalls.at(-1).contextHasReactionTable, true);
  assert.equal(
    thermalStageWorkerBridgeCalls.find((entry) => entry.stageId === 'gridUpdate')?.contextHasGridForceAdmission,
    true
  );
  assert.equal(gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageExecutionCompletedStageCount, 6);
  assert.deepEqual(
    gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageExecutionStageOrder,
    ['p2g', 'pressureInterface', 'gridUpdate', 'g2p', 'thermalPhase', 'reactionProduct']
  );
  assert.equal(gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.gpuHubResidentStageExecutorRegisteredCount, 6);
  assert.deepEqual(gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageExecutionExecutorSources, {
    p2g: 'gpu-hub-resident-stage-executor',
    pressureInterface: 'gpu-hub-resident-stage-executor',
    gridUpdate: 'gpu-hub-resident-stage-executor',
    g2p: 'gpu-hub-resident-stage-executor',
    thermalPhase: 'gpu-hub-resident-stage-executor',
    reactionProduct: 'gpu-hub-resident-stage-executor'
  });
  assert.equal(gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageExecutionUsedGpuHubExecutors, true);
  assert.deepEqual(gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageExecutionWorkerResidencyStatuses, {
    p2g: 'worker-ready',
    pressureInterface: 'worker-ready',
    gridUpdate: 'worker-ready',
    g2p: 'worker-ready',
    thermalPhase: 'worker-ready',
    reactionProduct: 'worker-ready'
  });
  assert.deepEqual(gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.stageOrder, ['p2g', 'pressureInterface', 'gridUpdate', 'g2p', 'thermalPhase', 'reactionProduct']);
  assert.equal(gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.stageTaskBoundaries.pressureInterface, true);
  assert.equal(gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.stageTaskBoundaries.thermalPhase, true);
  assert.equal(gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.stageTaskBoundaries.reactionProduct, true);
  assert.equal(gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.stageTaskResultSchemas.pressureInterface, ULG_SPH_PRESSURE_INTERFACE_STAGE_COMPUTE_TASK_RESULT_SCHEMA);
  assert.equal(gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.stageTaskResultSchemas.thermalPhase, ULG_SPH_THERMAL_PHASE_STAGE_COMPUTE_TASK_RESULT_SCHEMA);
  assert.equal(gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.stageTaskResultSchemas.reactionProduct, ULG_SPH_REACTION_PRODUCT_STAGE_COMPUTE_TASK_RESULT_SCHEMA);
  assert.equal(gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.stageTaskEvidenceSchemas.pressureInterface, 'peercompute.ulg.pressure-interface-stage-task-evidence.v0');
  assert.equal(gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.stageTaskEvidenceSchemas.thermalPhase, 'peercompute.ulg.thermal-phase-stage-task-evidence.v0');
  assert.equal(gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.stageTaskEvidenceSchemas.reactionProduct, 'peercompute.ulg.reaction-product-stage-task-evidence.v0');
  assert.equal(gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.stageTaskEvidencePassed.pressureInterface, true);
  assert.equal(gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.stageTaskEvidencePassed.thermalPhase, true);
  assert.equal(gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.stageTaskEvidencePassed.reactionProduct, true);
  assert.equal(gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.allStageTaskEvidencePassed, true);
  assert.equal(gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageTaskBackends.pressureInterface, 'webgpu');
  assert.equal(gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageTaskBackends.thermalPhase, 'webgpu');
  assert.equal(gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageTaskBackends.reactionProduct, 'webgpu');
  assert.equal(gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageTaskExecutionStatuses.pressureInterface, 'pressure-interface-stage-solver-ready');
  assert.equal(gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageTaskExecutionStatuses.thermalPhase, 'webgpu-accepted-no-full-readback');
  assert.equal(gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageTaskExecutionStatuses.reactionProduct, 'webgpu-accepted-no-full-readback');
  assert.equal(gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageTaskFenceSatisfied.pressureInterface, true);
  assert.equal(gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageTaskFenceSatisfied.thermalPhase, true);
  assert.equal(gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageTaskFenceSatisfied.reactionProduct, true);
  assert.equal(gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageTaskReadbackModes.pressureInterface, 'no-full-readback');
  assert.equal(gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageTaskReadbackModes.thermalPhase, 'no-full-readback');
  assert.equal(gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageTaskReadbackModes.reactionProduct, 'no-full-readback');
  assert.equal(gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageTaskNormalHotLoopReadbackFree.pressureInterface, true);
  assert.equal(gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageTaskNormalHotLoopReadbackFree.thermalPhase, true);
  assert.equal(gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageTaskNormalHotLoopReadbackFree.reactionProduct, true);
  assert.equal(
    gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.pressureInterfaceWorkerCompactPublicationCandidate?.schema,
    ULG_SPH_PRESSURE_INTERFACE_WORKER_COMPACT_PUBLICATION_CANDIDATE_SCHEMA
  );
  assert.equal(gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.pressureInterfaceWorkerCompactPublicationCandidateStatus, 'worker-retained-pressure-interface-publication-candidate-ready');
  assert.equal(gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.pressureInterfaceWorkerCompactPublicationStatus, 'worker-retained-pressure-interface-output-published');
  assert.equal(gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.pressureInterfaceWorkerCompactPublicationCommitted, true);
  assert.equal(
    gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.pressureInterfaceWorkerCompactPublicationHotBufferKey,
    'ulg:test:pressure-interface-publication-hot-buffer'
  );
  assert.equal(
    gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.pressureInterfaceSameFrameGridForceAdmissionStatus,
    'pressure-interface-grid-force-consumption-approved'
  );
  assert.equal(
    gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.pressureInterfaceSameFrameGridForceAdmissionApproved,
    true
  );
  assert.equal(
    gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.pressureInterfaceSameFrameGridForceAdmissionHotBufferKey,
    'ulg:test:pressure-interface-publication-hot-buffer'
  );
  assert.equal(gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.pressureInterfacePublishedForceRowCount, 2);
  assert.equal(gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.pressureInterfaceRetainedPressureBufferRefCount, 1);
  assert.equal(gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.pressureInterfaceWorkerRetainedPressureBufferRefCount, 1);
  assert.deepEqual(
    gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.pressureInterfaceWorkerCompactPublicationCandidate.workerRetainedGasPressureBufferRefs,
    ['ulg-worker:test:pressureInterface:result.gasPressureCellsBuffer:2']
  );
  assert.deepEqual(
    gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.pressureInterfaceWorkerCompactPublicationCandidate.retainedGasPressureBufferRefs,
    ['resident-gas-pressure-cells-buffer']
  );
  assert.equal(
    gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.pressureInterfaceWorkerCompactPublicationCandidate.retainedGasCellFieldSourceSchema,
    ULG_PRESSURE_INTERFACE_RETAINED_GAS_CELL_FIELD_SOURCE_SCHEMA
  );
  assert.equal(
    gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.pressureInterfaceWorkerCompactPublicationCandidate.retainedGasCellFieldSourceStatus,
    'pressure-interface-retained-gas-cell-field-source-ready'
  );
  assert.equal(
    gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.pressureInterfaceWorkerCompactPublicationCandidate.retainedGasCellFieldSourceReady,
    true
  );
  assert.deepEqual(
    gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.pressureInterfaceWorkerCompactPublicationCandidate.retainedSourceFamilies,
    ['resident-gas-pressure']
  );
  assert.equal(
    gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.pressureInterfaceRetainedGasCellFieldSourceSchema,
    ULG_PRESSURE_INTERFACE_RETAINED_GAS_CELL_FIELD_SOURCE_SCHEMA
  );
  assert.equal(
    gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.pressureInterfaceRetainedGasCellFieldSourceReady,
    true
  );
  assert.deepEqual(
    gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.pressureInterfaceRetainedSourceFamilies,
    ['resident-gas-pressure']
  );
  assert.equal(pressureInterfaceStagePublicationPayloads.length, 1);
  assert.equal(pressureInterfaceStagePublicationPayloads[0].sourceStage, 'pressureInterface');
  assert.equal(pressureInterfaceStagePublicationPayloads[0].sameFrameConsumerStage, 'gridUpdate');
  assert.deepEqual(pressureInterfaceStagePublicationPayloads[0].candidate.outputFamilies, ['pressure-interface-force-rows']);
  assert.equal(pressureInterfaceStagePublicationPayloads[0].candidate.publicationAuthority, 'nodekernel-state-manager-admission-required');
  assert.equal(pressureInterfaceStagePublicationPayloads[0].candidate.pressureInterfaceForceRowCount, 2);
  assert.deepEqual(pressureInterfaceStagePublicationPayloads[0].candidate.retainedPressureBufferRefs, ['pressure-interface-force-rows-buffer']);
  assert.deepEqual(pressureInterfaceStagePublicationPayloads[0].candidate.workerRetainedPressureBufferRefs, ['ulg-worker:test:pressureInterface:forceRows']);
  assert.deepEqual(
    pressureInterfaceStagePublicationPayloads[0].candidate.workerRetainedGasPressureBufferRefs,
    ['ulg-worker:test:pressureInterface:result.gasPressureCellsBuffer:2']
  );
  assert.deepEqual(
    pressureInterfaceStagePublicationPayloads[0].candidate.retainedGasPressureBufferRefs,
    ['resident-gas-pressure-cells-buffer']
  );
  assert.equal(gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.thermalWorkerCompactPublicationCandidateStatus, 'worker-retained-thermal-phase-publication-candidate-ready');
  assert.equal(gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.thermalWorkerCompactPublicationStatus, 'worker-retained-thermal-phase-output-published');
  assert.equal(gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.thermalWorkerCompactPublicationCommitted, true);
  assert.equal(gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.thermalWorkerCompactPublicationHotBufferKey, 'ulg:test:thermal-phase-publication-hot-buffer');
  assert.equal(gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.thermalWorkerRetainedThermoBufferRefCount, 1);
  assert.equal(thermalStagePublicationPayloads.length, 1);
  assert.equal(thermalStagePublicationPayloads[0].sourceStage, 'thermalPhase');
  assert.deepEqual(thermalStagePublicationPayloads[0].candidate.outputFamilies, ['sph-thermo-phase']);
  assert.equal(thermalStagePublicationPayloads[0].candidate.workerRetainedThermoBufferRefCount, 1);
  assert.equal(gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.reactionProductWorkerCompactPublicationCandidateStatus, 'worker-retained-reaction-product-publication-candidate-ready');
  assert.equal(gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.reactionProductWorkerCompactPublicationStatus, 'worker-retained-reaction-product-output-published');
  assert.equal(gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.reactionProductWorkerCompactPublicationCommitted, true);
  assert.equal(
    gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.reactionProductWorkerCompactPublicationHotBufferKey,
    'ulg:test:reaction-product-publication-hot-buffer'
  );
  assert.equal(gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.reactionProductWorkerRetainedProductBufferRefCount, 1);
  assert.equal(reactionProductStagePublicationPayloads.length, 1);
  assert.equal(reactionProductStagePublicationPayloads[0].sourceStage, 'reactionProduct');
  assert.deepEqual(reactionProductStagePublicationPayloads[0].candidate.outputFamilies, [
    'sph-particle-state',
    'sph-thermo-phase',
    'mls-mpm-mechanics',
    'resident-product-mass'
  ]);
  assert.equal(reactionProductStagePublicationPayloads[0].candidate.workerRetainedProductBufferRefCount, 1);
  assert.equal(
    gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageTaskLaneSummaries.pressureInterface.pressureInterfaceAuthoritativeMutation,
    false
  );
  assert.equal(
    gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageTaskLaneSummaries.pressureInterface.pressureInterfaceForceSolverStatus,
    'pressure-interface-force-solver-ready'
  );
  assert.equal(
    gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageTaskLaneSummaries.pressureInterface.pressureInterfaceForceRowCount,
    2
  );
  assert.equal(
    gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageTaskLaneSummaries.pressureInterface.pressureInterfaceForceRowsRetained,
    true
  );
  assert.equal(
    gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageTaskLaneSummaries.gridUpdate.pressureInterfaceGridForceAdmissionApproved,
    true
  );
  assert.equal(
    gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageTaskLaneSummaries.gridUpdate.pressureInterfaceForceApplicationStatus,
    'pressure-interface-grid-force-consumer-applied'
  );
  assert.equal(
    gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageTaskLaneSummaries.thermalPhase.workerRetainedThermoInputStatus,
    'applied-worker-retained-thermo-input'
  );
  assert.equal(
    gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageTaskLaneSummaries.thermalPhase.workerRetainedThermoOutputStatus,
    'adopted-worker-retained-thermo-output'
  );
  assert.equal(
    gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageTaskLaneSummaries.thermalPhase.thermalPhaseAuthoritativeMutation,
    false
  );
  assert.equal(
    gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageTaskLaneSummaries.reactionProduct.reactionProductAuthoritativeMutation,
    false
  );
  assert.equal(
    gpuHubWorkerThermalStageChainStep.mechanicsStageTaskChain.gpuResidentLaneStageTaskLaneSummaries.reactionProduct.reactionProductResidentProductMassBufferRetained,
    true
  );

  const mechanicsChildDryRun = await runUlgMechanicsChildDryRunTask({
    referenceEvidence: measuredMechanicsEvidence,
    mechanicsOnlyChildTaskEvidence: mechanicsOnlyResidentTaskResult
  });
  assert.equal(mechanicsChildDryRun.schema, ULG_MECHANICS_CHILD_DRY_RUN_EVIDENCE_SCHEMA);
  assert.equal(mechanicsChildDryRun.taskWrapped, false);
  assert.equal(mechanicsChildDryRun.accepted, true);
  assert.equal(mechanicsChildDryRun.dryRunMode, 'non-mutating-reference-comparison');
  assert.equal(mechanicsChildDryRun.mechanicsChildDryRunParity.passed, true);
  assert.equal(mechanicsChildDryRun.mechanicsOnlyChildTaskEnvelope.passed, true);
  assert.equal(mechanicsChildDryRun.mechanicsChildStageKernelEvidence.passed, true);
  assert.equal(mechanicsChildDryRun.mechanicsChildP2gStageEvidence.passed, true);
  assert.equal(mechanicsChildDryRun.mechanicsChildGridUpdateStageEvidence.passed, true);
  assert.equal(mechanicsChildDryRun.mechanicsChildG2pStageEvidence.passed, true);
  assert.equal(mechanicsChildDryRun.mechanicsOnlyStageContract.passed, true);
  assert.equal(mechanicsChildDryRun.mechanicsOnlyExecutionPath.status, 'mechanics-only-entrypoint-enforced');
  assert.equal(
    mechanicsChildDryRun.mechanicsOnlyExecutionPath.zeroForce.stepSource,
    'runMlsMpmMechanicsOnlyResidentStepWithOptionalWebGpu'
  );
  assert.deepEqual(mechanicsChildDryRun.mechanicsOnlyStageContract.authoritativeWriteFamilies, [
    RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS,
    RESIDENT_STATE_FAMILIES.MECHANICS
  ]);
  assert.ok(mechanicsChildDryRun.mechanicsOnlyStageContract.mustNotWriteFamilies.includes(RESIDENT_STATE_FAMILIES.THERMO_PHASE));
  assert.ok(mechanicsChildDryRun.satisfiedEvidence.includes('mechanics-only-child-task-envelope'));
  assert.ok(mechanicsChildDryRun.satisfiedEvidence.includes('mechanics-child-stage-kernel-evidence'));
  assert.ok(mechanicsChildDryRun.satisfiedEvidence.includes('mechanics-child-p2g-stage-evidence'));
  assert.ok(mechanicsChildDryRun.satisfiedEvidence.includes('mechanics-child-grid-update-stage-evidence'));
  assert.ok(mechanicsChildDryRun.satisfiedEvidence.includes('mechanics-child-g2p-stage-evidence'));
  assert.ok(mechanicsChildDryRun.satisfiedEvidence.includes('mechanics-child-dry-run-parity'));

  const mechanicsEvidenceArtifact = runUlgMechanicsPromotionEvidenceTask({
    requiredEvidence: missingMechanicsAdmission.requiredEvidence,
    mechanicsEvidence: mechanicsChildDryRun
  });
  assert.equal(mechanicsEvidenceArtifact.schema, ULG_RESIDENT_MECHANICS_PROMOTION_EVIDENCE_SCHEMA);
  assert.equal(mechanicsEvidenceArtifact.taskWrapped, false);
  assert.equal(mechanicsEvidenceArtifact.accepted, true);
  assert.deepEqual(mechanicsEvidenceArtifact.missingEvidence, []);
  assert.ok(mechanicsEvidenceArtifact.satisfiedEvidence.includes('zero-force-rest-oracle'));
  assert.ok(mechanicsEvidenceArtifact.satisfiedEvidence.includes('gravity-only-oracle'));
  assert.ok(mechanicsEvidenceArtifact.satisfiedEvidence.includes('cpu-reference-oracle-parity'));
  assert.ok(mechanicsEvidenceArtifact.satisfiedEvidence.includes('conserved-field-checks'));
  assert.ok(mechanicsEvidenceArtifact.satisfiedEvidence.includes('visual-sequence-sanity'));
  assert.ok(mechanicsEvidenceArtifact.satisfiedEvidence.includes('committed-delta-admission'));
  assert.ok(mechanicsEvidenceArtifact.satisfiedEvidence.includes('mechanics-only-child-task-envelope'));
  assert.ok(mechanicsEvidenceArtifact.satisfiedEvidence.includes('mechanics-child-stage-kernel-evidence'));
  assert.ok(mechanicsEvidenceArtifact.satisfiedEvidence.includes('mechanics-child-p2g-stage-evidence'));
  assert.ok(mechanicsEvidenceArtifact.satisfiedEvidence.includes('mechanics-child-grid-update-stage-evidence'));
  assert.ok(mechanicsEvidenceArtifact.satisfiedEvidence.includes('mechanics-child-g2p-stage-evidence'));
  assert.ok(mechanicsEvidenceArtifact.satisfiedEvidence.includes('mechanics-child-dry-run-parity'));
  assert.equal(mechanicsEvidenceArtifact.checks['volume-stability'].passed, true);
  assert.equal(mechanicsEvidenceArtifact.checks['mechanics-only-child-task-envelope'].passed, true);
  assert.equal(mechanicsEvidenceArtifact.checks['mechanics-child-stage-kernel-evidence'].passed, true);
  assert.equal(mechanicsEvidenceArtifact.checks['mechanics-child-p2g-stage-evidence'].passed, true);
  assert.equal(mechanicsEvidenceArtifact.checks['mechanics-child-grid-update-stage-evidence'].passed, true);
  assert.equal(mechanicsEvidenceArtifact.checks['mechanics-child-g2p-stage-evidence'].passed, true);
  assert.equal(mechanicsEvidenceArtifact.checks['mechanics-child-dry-run-parity'].passed, true);

  const completeEvidence = Object.fromEntries(
    missingMechanicsAdmission.requiredEvidence.map((key) => [key, true])
  );
  const admittedMechanics = createUlgLawFamilyPromotionAdmission({
    computeManager,
    solverId: 'ulg-mls-mpm-mechanics-law',
    evidence: completeEvidence
  });
  assert.equal(admittedMechanics.accepted, true);
  assert.equal(admittedMechanics.status, 'promotion-admission-accepted');
  assert.deepEqual(admittedMechanics.missingEvidence, []);
  assert.deepEqual(admittedMechanics.admittedFamilies, [
    RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS,
    RESIDENT_STATE_FAMILIES.MECHANICS
  ]);

  const admittedMechanicsFromEvidence = createUlgLawFamilyPromotionAdmission({
    computeManager,
    solverId: 'ulg-mls-mpm-mechanics-law',
    evidence: mechanicsEvidenceArtifact
  });
  assert.equal(admittedMechanicsFromEvidence.accepted, true);
  assert.deepEqual(admittedMechanicsFromEvidence.admittedFamilies, [
    RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS,
    RESIDENT_STATE_FAMILIES.MECHANICS
  ]);

  const blockedThermal = createUlgLawFamilyPromotionAdmission({
    computeManager,
    solverId: 'ulg-thermal-phase-law',
    evidence: completeEvidence
  });
  assert.equal(blockedThermal.accepted, false);
  assert.ok(blockedThermal.issues.includes('promotion-order-blocked'));

  const missingTaskResult = await computeManager.submitTask(createUlgLawFamilyPromotionAdmissionComputeTask({
    lawGraphManifest: manifest,
    solverId: 'ulg-mls-mpm-mechanics-law',
    taskId: 'ulg:test:mechanics-promotion-missing-evidence'
  }));
  assert.equal(missingTaskResult.schema, ULG_RESIDENT_LAW_FAMILY_PROMOTION_ADMISSION_SCHEMA);
  assert.equal(missingTaskResult.taskWrapped, true);
  assert.equal(missingTaskResult.accepted, false);
  assert.equal(missingTaskResult.reason, 'required-evidence-missing');

  const mechanicsChildDryRunTaskResult = await computeManager.submitTask(createUlgMechanicsChildDryRunTask({
    modulePath: ULG_MECHANICS_PROMOTION_EVIDENCE_MODULE_URL.href,
    referenceEvidence: measuredMechanicsEvidence,
    mechanicsOnlyChildTaskEvidence: mechanicsOnlyResidentTaskResult,
    taskId: 'ulg:test:mechanics-child-dry-run'
  }));
  assert.equal(mechanicsChildDryRunTaskResult.schema, ULG_MECHANICS_CHILD_DRY_RUN_EVIDENCE_SCHEMA);
  assert.equal(mechanicsChildDryRunTaskResult.taskWrapped, true);
  assert.equal(mechanicsChildDryRunTaskResult.accepted, true);
  assert.equal(mechanicsChildDryRunTaskResult.mechanicsChildDryRunParity.passed, true);
  assert.equal(mechanicsChildDryRunTaskResult.mechanicsOnlyChildTaskEnvelope.passed, true);
  assert.equal(mechanicsChildDryRunTaskResult.mechanicsChildStageKernelEvidence.passed, true);
  assert.equal(mechanicsChildDryRunTaskResult.mechanicsChildP2gStageEvidence.passed, true);
  assert.equal(mechanicsChildDryRunTaskResult.mechanicsChildGridUpdateStageEvidence.passed, true);
  assert.equal(mechanicsChildDryRunTaskResult.mechanicsChildG2pStageEvidence.passed, true);
  assert.equal(mechanicsChildDryRunTaskResult.mechanicsOnlyStageContract.passed, true);
  assert.equal(mechanicsChildDryRunTaskResult.mechanicsOnlyExecutionPath.status, 'mechanics-only-entrypoint-enforced');

  const mechanicsEvidenceTaskResult = await computeManager.submitTask(createUlgMechanicsPromotionEvidenceTask({
    requiredEvidence: missingMechanicsAdmission.requiredEvidence,
    mechanicsEvidence: mechanicsChildDryRunTaskResult,
    taskId: 'ulg:test:mechanics-promotion-evidence'
  }));
  assert.equal(mechanicsEvidenceTaskResult.schema, ULG_RESIDENT_MECHANICS_PROMOTION_EVIDENCE_SCHEMA);
  assert.equal(mechanicsEvidenceTaskResult.taskWrapped, true);
  assert.equal(mechanicsEvidenceTaskResult.accepted, true);
  assert.deepEqual(mechanicsEvidenceTaskResult.missingEvidence, []);

  const admittedTaskResult = await computeManager.submitTask(createUlgLawFamilyPromotionAdmissionComputeTask({
    lawGraphManifest: manifest,
    solverId: 'ulg-mls-mpm-mechanics-law',
    evidence: mechanicsEvidenceTaskResult,
    taskId: 'ulg:test:mechanics-promotion-admitted'
  }));
  assert.equal(admittedTaskResult.taskWrapped, true);
  assert.equal(admittedTaskResult.accepted, true);
  assert.deepEqual(admittedTaskResult.admittedFamilies, [
    RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS,
    RESIDENT_STATE_FAMILIES.MECHANICS
  ]);
  assert.equal(computeManager.getStats().byTaskFamily['ulg-law-family-promotion-admission'].completed, 2);
  assert.equal(computeManager.getStats().byTaskFamily['ulg-mls-mpm-mechanics-only-resident-steps'].completed, 1);
  assert.equal(computeManager.getStats().byTaskFamily['ulg-mechanics-child-dry-run'].completed, 1);
  assert.equal(computeManager.getStats().byTaskFamily['ulg-mechanics-promotion-evidence'].completed, 1);
});

test('ULG resident pass-DAG task runs through real PeerCompute GPU lane authority before commit', async (t) => {
  const mod = await importPeerComputeManager(t);
  if (!mod) return;
  const { ComputeManager } = mod;
  const computeManager = new ComputeManager({
    enableWorkers: false,
    gpuDeviceId: 'gpu-device:ulg-contract'
  });
  const deltas = [];
  computeManager.setCommitDeltaHandler((delta) => deltas.push(delta));
  await computeManager.initialize();

  const task = createContractTask();
  delete task.module;
  task.fn = (data) => {
    const retainedBufferRefs = [
      ...data.gpuFenceRequirement.retainedBufferRefs,
      'contract-output-buffer'
    ];
    return {
      schema: 'peercompute.ulg.mls-mpm-gpu-resident-steps-execution.v0',
      value: {
        ok: true,
        completedStepCount: data.stepCount,
        lawGraphNodeId: data.lawGraphNode.nodeId
      },
      lawGraphNode: data.lawGraphNode,
      gpuFence: {
        schema: 'peercompute.compute.gpu-fence-report.v0',
        status: 'queue-work-completed',
        method: 'queue.onSubmittedWorkDone',
        fenceSatisfied: true,
        required: true,
        laneId: data.gpuFenceRequirement.laneId,
        stateKey: data.gpuFenceRequirement.stateKey,
        queueFencePolicy: data.gpuFenceRequirement.queueFencePolicy,
        queueCompletionStatus: 'queue-work-completed',
        queueCompletionMethod: 'queue.onSubmittedWorkDone',
        retainedBufferRefs,
        source: 'ulg-contract-test'
      },
      commitDelta: {
        taskId: 'ulg:test:peercompute-resident-steps-contract',
        scope: 'ulg-sph-resident-pass-dag',
        version: data.stepCount,
        payload: {
          schema: 'peercompute.ulg.mls-mpm-resident-steps-delta.v0',
          status: 'contract-delta-ready',
          completedStepCount: data.stepCount,
          lawGraphNodeId: data.lawGraphNode.nodeId
        }
      }
    };
  };

  const result = await computeManager.submitTask(task);

  assert.equal(deltas.length, 1);
  assert.equal(deltas[0].scope, 'ulg-sph-resident-pass-dag');
  assert.equal(deltas[0].payload.completedStepCount, 3);
  assert.deepEqual(result.value, {
    ok: true,
    completedStepCount: 3,
    lawGraphNodeId: 'ulg-mls-mpm-sph-resident-pass-dag'
  });
  assert.equal(result.gpuResidentLaneExecution.schema, 'peercompute.compute.gpu-resident-lane-execution.v0');
  assert.equal(result.gpuResidentLaneExecution.gpuFence.fenceSatisfied, true);
  assert.equal(result.gpuResidentLaneExecution.gpuFence.laneId, 'ulg:test:peercompute-resident-lane');
  assert.deepEqual(result.gpuResidentLaneExecution.gpuFence.retainedBufferRefs, [
    'sph-state-buffer',
    'sph-thermo-buffer',
    'mls-mpm-mechanics-buffer',
    'contract-output-buffer'
  ]);
  assert.equal(result.computeExecution.schema, 'peercompute.compute.task-execution.v0');
  assert.equal(result.computeExecution.gpuFenceSatisfied, true);
  assert.equal(result.computeExecution.gpuResidentLaneRequirement.localExecution, 'inline');
  assert.equal(
    result.computeExecution.gpuResidentLaneRequirement.residentSequenceLaneContract.schema,
    'peercompute.ulg.mls-mpm-resident-sequence-lane-contract.v0'
  );
  assert.equal(
    result.computeExecution.gpuResidentLaneRequirement.residentSequenceLaneContract.sequenceMode,
    'per-step-resident-pass-dag'
  );
  assert.equal(result.computeExecution.gpuResidentLaneExecution.gpuFence.status, 'queue-work-completed');
  assert.equal(result.computeExecution.gpuResidentLaneExecution.stagePlan.schema, 'peercompute.compute.gpu-resident-lane-stage-plan.v0');
  assert.equal(result.computeExecution.gpuResidentLaneExecution.stagePlan.contractSchema, 'peercompute.ulg.mls-mpm-resident-sequence-lane-contract.v0');
  assert.equal(result.computeExecution.gpuResidentLaneExecution.stagePlan.stageCount, 4);
  assert.equal(result.computeExecution.gpuResidentLaneExecution.stagePlan.defaultEnabled, false);
  assert.equal(computeManager.getStats().gpuResidentLanes.activeLeaseCount, 0);
  assert.equal(computeManager.getStats().gpuResidentLanes.completedLeaseCount, 1);
});

test('ULG resident pass-DAG commit delta is admitted into real PeerCompute StateManager warm state', async (t) => {
  const computeMod = await importPeerComputeManager(t);
  const stateMod = await importPeerComputeStateManager(t);
  if (!computeMod || !stateMod) return;
  const { ComputeManager } = computeMod;
  const { StateManager } = stateMod;
  const computeManager = new ComputeManager({
    enableWorkers: false,
    gpuDeviceId: 'gpu-device:ulg-state-admission'
  });
  const stateManager = new StateManager(null, {
    docName: `ulg-state-admission-${Date.now()}`,
    enablePersistence: false,
    disableNetworkProvider: true,
    disableBroadcast: true,
    deltaNamespace: 'deltas'
  });
  const admissions = [];
  await stateManager.initialize({
    nodeId: 'ulg-test-node',
    topology: 'single-node',
    createdAt: Date.now()
  });
  t.after(() => stateManager.destroy?.());
  const bridge = attachResidentStateManagerCommitBridge({
    computeManager,
    stateManager,
    onAdmission: (admission) => admissions.push(admission)
  });
  await computeManager.initialize();

  const task = createContractTask({
    taskId: 'ulg:test:peercompute-resident-steps-state-admission',
    laneId: 'ulg:test:peercompute-resident-lane-state-admission',
    stateKey: 'ulg:test:peercompute-resident-state-admitted',
    stepCount: 2
  });
  delete task.module;
  task.fn = (data) => {
    const retainedBufferRefs = [
      ...data.gpuFenceRequirement.retainedBufferRefs,
      'state-admission-output-buffer'
    ];
    const gpuFence = {
      schema: 'peercompute.compute.gpu-fence-report.v0',
      status: 'queue-work-completed',
      method: 'queue.onSubmittedWorkDone',
      fenceSatisfied: true,
      required: true,
      laneId: data.gpuFenceRequirement.laneId,
      stateKey: data.gpuFenceRequirement.stateKey,
      queueFencePolicy: data.gpuFenceRequirement.queueFencePolicy,
      queueCompletionStatus: 'queue-work-completed',
      queueCompletionMethod: 'queue.onSubmittedWorkDone',
      retainedBufferRefs,
      source: 'ulg-state-admission-test'
    };
    return {
      schema: 'peercompute.ulg.mls-mpm-gpu-resident-steps-execution.v0',
      value: {
        ok: true,
        completedStepCount: data.stepCount,
        lawGraphNodeId: data.lawGraphNode.nodeId
      },
      lawGraphNode: data.lawGraphNode,
      gpuFence,
      commitDelta: {
        schema: 'peercompute.ulg.mls-mpm-resident-steps-commit-delta.v0',
        taskId: data.computeTaskId,
        scope: data.commitDeltaScope,
        version: data.stepCount,
        timestamp: Date.now(),
        payload: {
          schema: 'peercompute.ulg.mls-mpm-resident-steps-state-delta.v0',
          status: 'resident-steps-delta-ready',
          stateKey: data.commitDeltaStateKey,
          backend: 'webgpu',
          readbackMode: 'no-full-readback',
          requestedReadbackMode: 'no-full-readback',
          completedStepCount: data.stepCount,
          continuationAvailable: true,
          continuedFromResidentState: true,
          residentSourceMode: 'gpu-resident',
          lawGraphNode: data.lawGraphNode,
          outputFamilies: [...data.expectedOutputFamilies],
          gpuFence,
          retainedBufferRefs,
          gpuResidentLaneRequirement: data.gpuResidentLane,
          finalStep: {
            schema: 'peercompute.ulg.mls-mpm-resident-step-sequence-summary.v0',
            stepIndex: data.stepCount - 1,
            backend: 'webgpu',
            status: 'resident-step-webgpu-executed',
            readbackMode: 'no-full-readback',
            normalHotLoopReadbackFree: true,
            gpuAuthoritativeState: true,
            renderStateReadbackAvailable: false,
            diagnostics: {
              particleCount: 1,
              gpuResidentLaneFenceSatisfied: false
            }
          },
          stepSummaries: [],
          normalHotLoopReadbackFree: true,
          gpuAuthoritativeState: true,
          scientificValidation: false,
          sphValidation: false,
          phaseChangeValidation: false,
          fullPhysicsValidation: false
        }
      }
    };
  };

  const result = await computeManager.submitTask(task);
  const warm = stateManager.getWarmDeltas('ulg-sph-resident-pass-dag');
  const entry = warm[task.id];
  const readAdmission = readResidentStepsCommittedWarmDelta(stateManager, {
    delta: result.commitDelta,
    taskId: task.id,
    scope: 'ulg-sph-resident-pass-dag'
  });

  assert.equal(bridge.schema, 'peercompute.ulg.resident-state-commit-bridge.v0');
  assert.equal(admissions.length, 1);
  assert.equal(admissions[0].schema, ULG_RESIDENT_STATE_COMMIT_ADMISSION_SCHEMA);
  assert.equal(admissions[0].accepted, true);
  assert.equal(admissions[0].stateKey, 'ulg:test:peercompute-resident-state-admitted');
  assert.equal(admissions[0].gpuFenceSatisfied, true);
  assert.equal(result.value.completedStepCount, 2);
  assert.equal(result.gpuResidentLaneExecution.gpuFence.fenceSatisfied, true);
  assert.equal(entry.version, 2);
  assert.equal(entry.payload.schema, ULG_MLS_MPM_RESIDENT_STEPS_STATE_DELTA_SCHEMA);
  assert.equal(entry.payload.stateKey, 'ulg:test:peercompute-resident-state-admitted');
  assert.equal(entry.payload.completedStepCount, 2);
  assert.equal(entry.payload.gpuFence.fenceSatisfied, true);
  assert.equal(entry.payload.gpuFence.laneId, 'ulg:test:peercompute-resident-lane-state-admission');
  assert.deepEqual(entry.payload.outputFamilies, task.expectedOutputFamilies);
  assert.deepEqual(entry.payload.retainedBufferRefs, [
    'sph-state-buffer',
    'sph-thermo-buffer',
    'mls-mpm-mechanics-buffer',
    'state-admission-output-buffer'
  ]);
  assert.equal(entry.payload.normalHotLoopReadbackFree, true);
  assert.equal(entry.payload.gpuAuthoritativeState, true);
  assert.equal(readAdmission.accepted, true);
  assert.equal(readAdmission.status, 'committed');
  assert.equal(readAdmission.warmEntryFound, true);
  assert.equal(readAdmission.warmEntry.payload.stateKey, 'ulg:test:peercompute-resident-state-admitted');
});

test('ULG resident pass-DAG can commit after redundant NodeKernel remote placement quorum', async (t) => {
  const computeMod = await importPeerComputeManager(t);
  const stateMod = await importPeerComputeStateManager(t);
  const nodeMod = await importPeerComputeNodeKernel(t);
  const quorumMod = await importPeerComputeRemoteQuorum(t);
  const yjsMod = await importPeerComputeYjs(t);
  if (!computeMod || !stateMod || !nodeMod || !quorumMod || !yjsMod) return;
  const { ComputeManager } = computeMod;
  const { StateManager } = stateMod;
  const { NodeKernel } = nodeMod;
  const { createRemoteResultQuorumValidator } = quorumMod;
  const { encodeStateAsUpdate } = yjsMod;

  const requester = makeStartedKernel(NodeKernel, { nodeId: 'ulg-requester-node' });
  const responderB = makeStartedKernel(NodeKernel, {
    nodeId: 'ulg-responder-node-b',
    enableRemoteComputeResponder: true
  });
  const responderC = makeStartedKernel(NodeKernel, {
    nodeId: 'ulg-responder-node-c',
    enableRemoteComputeResponder: true
  });
  connectInMemoryKernelMesh({
    requester,
    responders: [
      { peerId: 'peer-b', kernel: responderB },
      { peerId: 'peer-c', kernel: responderC }
    ]
  });

  responderB.computeManager = new ComputeManager({ enableWorkers: false, gpuDeviceId: 'gpu-device:remote-b' });
  responderC.computeManager = new ComputeManager({ enableWorkers: false, gpuDeviceId: 'gpu-device:remote-c' });
  const responderDeltas = [];
  responderB.computeManager.setCommitDeltaHandler((delta) => responderDeltas.push(delta));
  responderC.computeManager.setCommitDeltaHandler((delta) => responderDeltas.push(delta));

  const stateManager = new StateManager(null, {
    docName: `ulg-remote-placement-admission-${Date.now()}`,
    enablePersistence: false,
    disableNetworkProvider: true,
    disableBroadcast: true,
    deltaNamespace: 'deltas'
  });
  await stateManager.initialize({
    nodeId: 'ulg-requester-state-node',
    topology: 'in-memory-remote-placement',
    createdAt: Date.now()
  });
  t.after(() => stateManager.destroy?.());
  const replicaStateManager = new StateManager(null, {
    docName: `ulg-remote-placement-replica-${Date.now()}`,
    enablePersistence: false,
    disableNetworkProvider: true,
    disableBroadcast: true,
    deltaNamespace: 'deltas'
  });
  await replicaStateManager.initialize({
    nodeId: 'ulg-replica-state-node',
    topology: 'in-memory-replicated-state',
    createdAt: Date.now()
  });
  t.after(() => replicaStateManager.destroy?.());

  const admissions = [];
  const placementExecutor = requester.createRedundantNetworkPlacementExecutor(['peer-b', 'peer-c'], {
    executorId: 'ulg-nodekernel-redundant-network-placement:peer-b:peer-c',
    timeoutMs: 1000,
    requestId: 'ulg-remote-resident-placement'
  });
  const requesterCompute = new ComputeManager({
    enableWorkers: false,
    gpuDeviceId: 'gpu-device:ulg-remote-requester',
    placementExecutor,
    placementExecutorId: placementExecutor.placementExecutorId,
    placementAdmissionId: 'ulg-remote-resident-admission',
    placementAdmission: () => ({
      schema: 'peercompute.ulg.remote-placement-admission.v0',
      accepted: true,
      reason: 'trusted-in-memory-ulg-resident-peer'
    }),
    placementTaskSignerId: 'ulg-remote-resident-signer',
    placementTaskSigner: (taskPacket) => ({
      signed: true,
      signerId: 'ulg-remote-resident-signer',
      signature: `sig:${taskPacket.taskHash}`,
      signatureAlgorithm: 'ulg-test-signature'
    }),
    placementResultValidator: createRemoteResultQuorumValidator({
      validationId: 'ulg-remote-resident-quorum',
      minReplicaCount: 2,
      minMatchingReplicas: 2
    })
  });
  attachResidentStateManagerCommitBridge({
    computeManager: requesterCompute,
    stateManager,
    onAdmission: (admission) => admissions.push(admission)
  });
  await requesterCompute.initialize();

  const task = createContractTask({
    taskId: 'ulg:test:remote-resident-placement',
    laneId: 'ulg:test:remote-resident-lane',
    stateKey: 'ulg:test:remote-resident-state',
    domainKey: 'ulg:test:remote-domain',
    stepCount: 2
  });
  task.module = ULG_REMOTE_RESIDENT_PLACEMENT_FIXTURE_URL.href;
  task.exportName = 'runUlgRemoteResidentPlacementTask';
  task.placementHint = {
    requestedPlacement: 'peer',
    recommendedPlacement: 'peer',
    advisoryOnly: false,
    solverKey: 'ulg-mls-mpm-sph-resident-steps',
    solverId: task.solverId,
    confidence: 1,
    targetReplicaCount: 2,
    peerId: 'peer-b',
    timeoutMs: 1000
  };

  const result = await requesterCompute.submitTask(task);
  const warm = stateManager.getWarmDeltas('ulg-sph-resident-pass-dag');
  const entry = warm[task.id];
  const stats = requesterCompute.getStats();
  const provenance = stats.taskPlacement.lastPlacement.provenance;

  assert.equal(result.schema, 'peercompute.ulg.remote-resident-placement-result.v0');
  assert.equal(result.completedStepCount, 2);
  assert.equal(result.stateKey, 'ulg:test:remote-resident-state');
  assert.equal(responderDeltas.length, 0);
  assert.equal(responderB.computeManager.getStats().totalTasksCompleted, 1);
  assert.equal(responderC.computeManager.getStats().totalTasksCompleted, 1);
  assert.equal(stats.remoteTasksCompleted, 1);
  assert.equal(stats.inlineTasksCompleted, 0);
  assert.equal(stats.taskPlacement.remoteRequested, 1);
  assert.equal(stats.taskPlacement.remoteExecuted, 1);
  assert.equal(provenance.schema, 'peercompute.compute.remote-placement-provenance.v0');
  assert.equal(provenance.executorId, 'ulg-nodekernel-redundant-network-placement:peer-b:peer-c');
  assert.equal(provenance.requestedPlacement, 'peer');
  assert.equal(provenance.taskFamily, 'ulg-mls-mpm-sph-resident-steps');
  assert.equal(provenance.solverId, 'ulg-mls-mpm-sph-resident-steps');
  assert.equal(provenance.taskSigned, true);
  assert.equal(provenance.signerId, 'ulg-remote-resident-signer');
  assert.equal(provenance.gpuFenceSatisfied, true);
  assert.equal(provenance.gpuFence.laneId, 'ulg:test:remote-resident-lane');
  assert.equal(provenance.redundantPlacement.primaryPeerId, 'peer-b');
  assert.deepEqual(provenance.redundantPlacement.replicaPeerIds, ['peer-c']);
  assert.equal(provenance.replicaSuccessCount, 1);
  assert.equal(provenance.validation.quorumSchema, 'peercompute.compute.remote-result-quorum.v0');
  assert.equal(provenance.validation.validationId, 'ulg-remote-resident-quorum');
  assert.equal(provenance.validation.valid, true);
  assert.equal(provenance.validation.reason, 'quorum-accepted');
  assert.equal(provenance.validation.totalResultCount, 2);
  assert.equal(provenance.validation.matchingResultCount, 2);
  assert.equal(admissions.length, 1);
  assert.equal(admissions[0].accepted, true);
  assert.equal(admissions[0].stateKey, 'ulg:test:remote-resident-state');
  assert.equal(admissions[0].gpuFenceSatisfied, true);
  assert.equal(entry.payload.schema, ULG_MLS_MPM_RESIDENT_STEPS_STATE_DELTA_SCHEMA);
  assert.equal(entry.payload.stateKey, 'ulg:test:remote-resident-state');
  assert.equal(entry.payload.completedStepCount, 2);
  assert.equal(entry.payload.gpuFence.fenceSatisfied, true);
  assert.equal(entry.payload.gpuFence.laneId, 'ulg:test:remote-resident-lane');
  assert.deepEqual(entry.payload.outputFamilies, task.expectedOutputFamilies);
  assert.deepEqual(entry.payload.retainedBufferRefs, [
    'sph-state-buffer',
    'sph-thermo-buffer',
    'mls-mpm-mechanics-buffer',
    'remote-placement-output-buffer'
  ]);
  const readAdmission = readResidentStepsCommittedWarmDelta(stateManager, {
    delta: {
      schema: ULG_MLS_MPM_RESIDENT_STEPS_COMMIT_DELTA_SCHEMA,
      taskId: task.id,
      scope: 'ulg-sph-resident-pass-dag',
      version: entry.version,
      payload: entry.payload
    },
    taskId: task.id,
    scope: 'ulg-sph-resident-pass-dag'
  });
  assert.equal(readAdmission.accepted, true);
  assert.equal(readAdmission.status, 'committed');
  const replicatedUpdate = encodeStateAsUpdate(stateManager.getYDoc());
  replicaStateManager.applyRemoteUpdate(replicatedUpdate);
  const replicaEntry = replicaStateManager.getWarmDeltas('ulg-sph-resident-pass-dag')[task.id];
  assert.equal(replicaEntry.payload.schema, ULG_MLS_MPM_RESIDENT_STEPS_STATE_DELTA_SCHEMA);
  assert.equal(replicaEntry.payload.stateKey, 'ulg:test:remote-resident-state');
  assert.equal(replicaEntry.payload.completedStepCount, 2);
  assert.equal(replicaEntry.payload.gpuFence.fenceSatisfied, true);
  const replicaReadAdmission = readResidentStepsCommittedWarmDelta(replicaStateManager, {
    delta: {
      schema: ULG_MLS_MPM_RESIDENT_STEPS_COMMIT_DELTA_SCHEMA,
      taskId: task.id,
      scope: 'ulg-sph-resident-pass-dag',
      version: replicaEntry.version,
      payload: replicaEntry.payload
    },
    taskId: task.id,
    scope: 'ulg-sph-resident-pass-dag'
  });
  assert.equal(replicaReadAdmission.accepted, true);
  assert.equal(replicaReadAdmission.status, 'committed');
});

test('PeerComputeProvider transports ULG resident StateManager warm deltas between peers', async (t) => {
  const stateMod = await importPeerComputeStateManager(t);
  if (!stateMod) return;
  const { StateManager } = stateMod;

  const mesh = createInMemoryStateProviderMesh(['provider-a', 'provider-b']);
  const topic = 'ulg-provider-state-sync';
  const sourceStateManager = new StateManager(mesh.managers.get('provider-a'), {
    docName: `ulg-provider-source-${Date.now()}`,
    topic,
    enablePersistence: false,
    disableNetworkProvider: false,
    disableBroadcast: true,
    deltaNamespace: 'deltas'
  });
  const replicaStateManager = new StateManager(mesh.managers.get('provider-b'), {
    docName: `ulg-provider-replica-${Date.now()}`,
    topic,
    enablePersistence: false,
    disableNetworkProvider: false,
    disableBroadcast: true,
    deltaNamespace: 'deltas'
  });
  const taskId = 'ulg:test:provider-transport-resident';
  const scope = 'ulg-sph-resident-pass-dag';
  const commitDelta = {
    schema: ULG_MLS_MPM_RESIDENT_STEPS_COMMIT_DELTA_SCHEMA,
    taskId,
    scope,
    version: 3,
    timestamp: 123456,
    payload: {
      schema: ULG_MLS_MPM_RESIDENT_STEPS_STATE_DELTA_SCHEMA,
      status: 'resident-steps-delta-ready',
      stateKey: 'ulg:test:provider-transport-state',
      backend: 'webgpu',
      readbackMode: 'no-full-readback',
      requestedReadbackMode: 'no-full-readback',
      completedStepCount: 3,
      continuationAvailable: true,
      continuedFromResidentState: true,
      residentSourceMode: 'gpu-resident',
      outputFamilies: ['particle-kinematics', 'mls-mpm-mechanics'],
      gpuFence: {
        schema: 'peercompute.compute.gpu-fence-report.v0',
        status: 'queue-work-completed',
        method: 'queue.onSubmittedWorkDone',
        fenceSatisfied: true,
        required: true,
        laneId: 'ulg:test:provider-transport-lane',
        stateKey: 'ulg:test:provider-transport-state'
      },
      retainedBufferRefs: ['sph-state-buffer', 'mls-mpm-mechanics-buffer'],
      normalHotLoopReadbackFree: true,
      gpuAuthoritativeState: true
    }
  };

  await sourceStateManager.initialize({
    nodeId: 'ulg-provider-source-node',
    topology: 'in-memory-provider-transport',
    createdAt: Date.now()
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.ok(sourceStateManager.libp2pProvider);
  sourceStateManager.commitDelta(commitDelta);
  mesh.deliveries.length = 0;

  await replicaStateManager.initialize({
    nodeId: 'ulg-provider-replica-node',
    topology: 'in-memory-provider-transport',
    createdAt: Date.now()
  });
  t.after(async () => {
    await sourceStateManager.destroy?.();
    await replicaStateManager.destroy?.();
  });
  assert.ok(replicaStateManager.libp2pProvider);

  const replicaEntry = await waitForWarmDelta(replicaStateManager, {
    scope,
    taskId,
    timeoutMs: 1000
  });
  assert.ok(replicaEntry);
  assert.equal(replicaEntry.version, 3);
  assert.equal(replicaEntry.payload.schema, ULG_MLS_MPM_RESIDENT_STEPS_STATE_DELTA_SCHEMA);
  assert.equal(replicaEntry.payload.stateKey, 'ulg:test:provider-transport-state');
  assert.equal(replicaEntry.payload.completedStepCount, 3);
  assert.equal(replicaEntry.payload.gpuFence.fenceSatisfied, true);

  const readAdmission = readResidentStepsCommittedWarmDelta(replicaStateManager, {
    delta: commitDelta,
    taskId,
    scope
  });
  assert.equal(readAdmission.accepted, true);
  assert.equal(readAdmission.status, 'committed');

  const syncRequest = mesh.deliveries.find((entry) => entry.type === 'yjs-sync-request');
  const syncResponse = mesh.deliveries.find((entry) => entry.type === 'yjs-sync-response');
  assert.equal(syncRequest?.from, 'provider-b');
  assert.equal(syncRequest?.topic, topic);
  assert.equal(syncResponse?.from, 'provider-a');
  assert.equal(syncResponse?.to, 'provider-b');
  assert.ok(syncResponse.byteLength > 0);
});

test('ULG resident StateManager bridge rejects deltas without satisfied payload fence evidence', async (t) => {
  const computeMod = await importPeerComputeManager(t);
  const stateMod = await importPeerComputeStateManager(t);
  if (!computeMod || !stateMod) return;
  const { ComputeManager } = computeMod;
  const { StateManager } = stateMod;
  const computeManager = new ComputeManager({
    enableWorkers: false,
    gpuDeviceId: 'gpu-device:ulg-state-rejection'
  });
  const stateManager = new StateManager(null, {
    docName: `ulg-state-rejection-${Date.now()}`,
    enablePersistence: false,
    disableNetworkProvider: true,
    disableBroadcast: true,
    deltaNamespace: 'deltas'
  });
  const admissions = [];
  await stateManager.initialize({
    nodeId: 'ulg-test-node',
    topology: 'single-node',
    createdAt: Date.now()
  });
  t.after(() => stateManager.destroy?.());
  attachResidentStateManagerCommitBridge({
    computeManager,
    stateManager,
    onAdmission: (admission) => admissions.push(admission)
  });
  await computeManager.initialize();

  const task = createContractTask({
    taskId: 'ulg:test:peercompute-resident-steps-state-rejection',
    laneId: 'ulg:test:peercompute-resident-lane-state-rejection',
    stateKey: 'ulg:test:peercompute-resident-state-rejected',
    stepCount: 2
  });
  delete task.module;
  task.fn = (data) => {
    const gpuFence = {
      schema: 'peercompute.compute.gpu-fence-report.v0',
      status: 'queue-work-completed',
      method: 'queue.onSubmittedWorkDone',
      fenceSatisfied: true,
      required: true,
      laneId: data.gpuFenceRequirement.laneId,
      stateKey: data.gpuFenceRequirement.stateKey,
      queueFencePolicy: data.gpuFenceRequirement.queueFencePolicy,
      queueCompletionStatus: 'queue-work-completed',
      queueCompletionMethod: 'queue.onSubmittedWorkDone',
      retainedBufferRefs: [...data.gpuFenceRequirement.retainedBufferRefs],
      source: 'ulg-state-rejection-test'
    };
    const payloadFence = {
      ...gpuFence,
      fenceSatisfied: false,
      status: 'payload-fence-unsatisfied'
    };
    return {
      schema: 'peercompute.ulg.mls-mpm-gpu-resident-steps-execution.v0',
      value: { ok: true, shouldNotCommit: true },
      lawGraphNode: data.lawGraphNode,
      gpuFence,
      commitDelta: {
        schema: 'peercompute.ulg.mls-mpm-resident-steps-commit-delta.v0',
        taskId: data.computeTaskId,
        scope: data.commitDeltaScope,
        version: data.stepCount,
        timestamp: Date.now(),
        payload: {
          schema: 'peercompute.ulg.mls-mpm-resident-steps-state-delta.v0',
          status: 'resident-steps-delta-ready',
          stateKey: data.commitDeltaStateKey,
          backend: 'webgpu',
          completedStepCount: data.stepCount,
          lawGraphNode: data.lawGraphNode,
          outputFamilies: [...data.expectedOutputFamilies],
          gpuFence: payloadFence,
          retainedBufferRefs: [...payloadFence.retainedBufferRefs],
          gpuResidentLaneRequirement: data.gpuResidentLane,
          normalHotLoopReadbackFree: true,
          gpuAuthoritativeState: true
        }
      }
    };
  };

  await assert.rejects(
    () => computeManager.submitTask(task),
    (error) => {
      assert.equal(error.code, 'ERR_ULG_RESIDENT_DELTA_REJECTED');
      assert.equal(error.admission.schema, ULG_RESIDENT_STATE_COMMIT_ADMISSION_SCHEMA);
      assert.equal(error.admission.reason, 'gpu-fence-unsatisfied');
      assert.deepEqual(error.admission.issues, ['gpu-fence-unsatisfied']);
      return true;
    }
  );

  assert.equal(admissions.length, 1);
  assert.equal(admissions[0].accepted, false);
  assert.deepEqual(stateManager.getWarmDeltas('ulg-sph-resident-pass-dag'), {});
  assert.equal(computeManager.getStats().totalTasksCompleted, 0);
  assert.equal(computeManager.getStats().totalTasksFailed, 1);
});

test('ULG resident pass-DAG task cannot commit through PeerCompute without a required GPU fence', async (t) => {
  const mod = await importPeerComputeManager(t);
  if (!mod) return;
  const { ComputeManager } = mod;
  const computeManager = new ComputeManager({
    enableWorkers: false,
    gpuDeviceId: 'gpu-device:ulg-contract'
  });
  const deltas = [];
  computeManager.setCommitDeltaHandler((delta) => deltas.push(delta));
  await computeManager.initialize();

  const task = createContractTask({
    taskId: 'ulg:test:peercompute-resident-steps-missing-fence'
  });
  delete task.module;
  task.fn = (data) => ({
    value: { ok: true, shouldNotCommit: true },
    commitDelta: {
      taskId: 'ulg:test:peercompute-resident-steps-missing-fence',
      scope: 'ulg-sph-resident-pass-dag',
      version: data.stepCount,
      payload: { shouldNotCommit: true }
    }
  });

  await assert.rejects(
    () => computeManager.submitTask(task),
    (error) => {
      assert.equal(error.code, 'ERR_COMPUTE_GPU_FENCE_UNSATISFIED');
      assert.equal(error.gpuFence.status, 'gpu-fence-report-missing');
      assert.equal(error.gpuFence.fenceSatisfied, false);
      return true;
    }
  );

  assert.equal(deltas.length, 0);
  assert.equal(computeManager.getStats().gpuResidentLanes.activeLeaseCount, 0);
  assert.equal(computeManager.getStats().gpuResidentLanes.completedLeaseCount, 1);
  assert.equal(computeManager.getStats().gpuResidentLanes.lastFence.status, 'gpu-fence-report-missing');
  assert.equal(computeManager.getStats().totalTasksCompleted, 0);
  assert.equal(computeManager.getStats().totalTasksFailed, 1);
});

test('ULG remote warm seed refresh rebuilds real SPH/MLS-MPM hot buffers through NodeKernel', async (t) => {
  const computeMod = await importPeerComputeManager(t);
  const stateMod = await importPeerComputeStateManager(t);
  const nodeMod = await importPeerComputeNodeKernel(t);
  if (!computeMod || !stateMod || !nodeMod) return;
  const { ComputeManager } = computeMod;
  const { StateManager } = stateMod;
  const {
    NodeKernel,
    NODE_KERNEL_REMOTE_TASK_GRAPH_HOT_BUFFER_REFRESH_SCHEMA,
    NODE_KERNEL_REMOTE_TASK_GRAPH_STATE_SEED_AUTHORITY_SCHEMA
  } = nodeMod;
  const computeManager = new ComputeManager({
    enableWorkers: false,
    enableWebGPU: true,
    gpuDeviceId: 'gpu-device:ulg-remote-seed-refresh'
  });
  await computeManager.initialize();
  const stateManager = new StateManager(null, {
    docName: `ulg-remote-seed-refresh-${Date.now()}`,
    enablePersistence: false,
    disableNetworkProvider: true,
    disableBroadcast: true,
    deltaNamespace: 'deltas'
  });
  await stateManager.initialize({
    nodeId: 'ulg-remote-seed-refresh-node',
    topology: 'single-node',
    createdAt: Date.now()
  });
  t.after(() => stateManager.destroy?.());

  const nodeKernel = makeStartedKernel(NodeKernel, {
    nodeId: 'ulg-remote-seed-refresh-node'
  });
  nodeKernel.computeManager = computeManager;
  nodeKernel.stateManager = stateManager;

  const demo = buildSphPhaseDemoState({
    allowFixtureMaterialProperties: true,
    dropMaterial: 'h2o',
    baseMaterial: 'h2o',
    dropTemperatureK: 300,
    baseTemperatureK: 300,
    dropParticleEdge: 1,
    baseParticleEdge: 1
  });
  const cacheKey = 'ulg-remote-seed-refresh:fnv1a32';
  const stateFamilies = [
    RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS,
    RESIDENT_STATE_FAMILIES.MECHANICS,
    RESIDENT_STATE_FAMILIES.THERMO_PHASE
  ];
  const remoteRetainedBufferRefs = [
    'remote:sph-state-buffer',
    'remote:sph-thermo-buffer',
    'remote:mls-mpm-mechanics-buffer'
  ];
  const stateSeedPayload = {
    schema: ULG_REMOTE_TASK_GRAPH_STATE_SEED_PAYLOAD_SCHEMA,
    cacheKey,
    stateKey: 'remote-state:ulg-sph-mls-mpm',
    state: demo.state,
    materialProperties: demo.materialProperties,
    step: demo.state.step ?? 0,
    time: demo.state.time ?? 0
  };
  const cacheArtifact = {
    schema: 'peercompute.compute.task-graph-cache-artifact.v0',
    cacheKey,
    artifactId: 'ulg-remote-seed-refresh-artifact',
    status: 'recorded-not-admitted',
    admitted: false,
    graphId: 'ulg-remote-seed-refresh-graph',
    resultHash: 'fnv1a32-ulg-remote-refresh-result',
    inputHash: 'fnv1a32-ulg-remote-refresh-input',
    stateSeedPayload,
    inputs: {
      stateFamilies,
      retainedBufferRefs: remoteRetainedBufferRefs
    }
  };
  const remoteResult = {
    schema: 'peercompute.compute.task-graph-result.v0',
    graphId: 'ulg-remote-seed-refresh-graph',
    status: 'completed',
    cacheKey,
    cacheInputHash: cacheArtifact.inputHash,
    cacheInputs: {
      stateFamilies,
      retainedBufferRefs: remoteRetainedBufferRefs
    },
    stateSeedPayload,
    graphLeaseRequired: true,
    graphLeaseStatus: 'completed',
    graphLeaseSpec: {
      schema: 'peercompute.compute.task-graph-gpu-resident-lane.v0',
      laneId: 'remote-lane:ulg-sph-mls-mpm',
      stateKey: 'remote-state:ulg-sph-mls-mpm',
      retainedBufferRefs: remoteRetainedBufferRefs
    },
    cacheArtifact
  };
  const admission = stateManager.admitTaskGraphCacheArtifact(cacheArtifact, {
    admissionId: 'ulg-remote-seed-refresh-admission',
    authority: 'node-kernel-state-manager',
    sourcePeerId: 'remote-peer:ulg',
    responderId: 'remote-node:ulg',
    reason: 'remote-task-graph-cache-artifact-admitted'
  });
  assert.equal(admission.admitted, true);
  const importReport = computeManager.importRemoteTaskGraphCacheResult(remoteResult, admission, {
    sourcePeerId: 'remote-peer:ulg',
    responderId: 'remote-node:ulg'
  });
  assert.equal(importReport.status, 'imported-admitted-remote-cache-result');
  assert.equal(importReport.retainedGpuLaneRefs.usableLocally, false);

  const committedSeed = nodeKernel.commitRemoteTaskGraphStateSeed(cacheKey, {
    allowedStateFamilies: stateFamilies,
    allowHotBufferRefresh: true,
    returnCommitDelta: true
  });
  assert.equal(committedSeed.schema, NODE_KERNEL_REMOTE_TASK_GRAPH_STATE_SEED_AUTHORITY_SCHEMA);
  assert.equal(committedSeed.status, 'warm-state-seed-committed');
  assert.equal(committedSeed.hotBufferRefreshRequired, true);
  assert.deepEqual(committedSeed.retainedBufferRefs, remoteRetainedBufferRefs);

  const device = createFakeWebGpuUploadDevice();
  const refreshExecutor = createUlgSphMlsMpmHotBufferRefreshExecutor({ device });
  const refresh = await nodeKernel.refreshRemoteTaskGraphHotBuffersFromSeed(cacheKey, {
    refreshExecutor,
    returnCommitDelta: true
  });

  assert.equal(refresh.schema, NODE_KERNEL_REMOTE_TASK_GRAPH_HOT_BUFFER_REFRESH_SCHEMA);
  assert.equal(refresh.status, 'hot-buffer-refresh-completed');
  assert.equal(refresh.refreshed, true);
  assert.equal(refresh.refreshResult.schema, ULG_REMOTE_TASK_GRAPH_HOT_BUFFER_REFRESH_RESULT_SCHEMA);
  assert.equal(refresh.refreshResult.status, 'ulg-sph-mls-mpm-hot-buffer-refresh-executed');
  assert.equal(refresh.refreshResult.sourceSchema, ULG_REMOTE_TASK_GRAPH_STATE_SEED_PAYLOAD_SCHEMA);
  assert.equal(refresh.refreshResult.particleCount, demo.state.particles.length);
  assert.equal(refresh.refreshResult.uploadSchemas.sph, ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA);
  assert.equal(refresh.refreshResult.uploadSchemas.mlsMpm, ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA);
  assert.equal(refresh.refreshResult.packedSchemas.sph, ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA);
  assert.equal(refresh.refreshResult.packedSchemas.mlsMpm, ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA);
  assert.ok(refresh.refreshResult.bytes.sphStateBytes > 0);
  assert.ok(refresh.refreshResult.bytes.sphThermoBytes > 0);
  assert.ok(refresh.refreshResult.bytes.mlsMpmMechanicsBytes > 0);
  assert.deepEqual(refresh.localBufferRefs, [
    `${refresh.refreshResult.hotBufferKey}:sph-state-buffer`,
    `${refresh.refreshResult.hotBufferKey}:sph-thermo-buffer`,
    `${refresh.refreshResult.hotBufferKey}:mls-mpm-mechanics-buffer`
  ]);
  assert.deepEqual(refresh.retainedBufferRefs, refresh.localBufferRefs);
  assert.equal(refresh.retainedBufferRefs.some((ref) => ref.startsWith('remote:')), false);
  assert.equal(refresh.execution.gpuFence.fenceSatisfied, true);
  assert.equal(refresh.execution.gpuFence.method, 'ulg-sph-mls-mpm-hot-buffer-refresh');
  assert.deepEqual(refresh.execution.gpuFence.retainedBufferRefs, refresh.localBufferRefs);
  assert.equal(refresh.commitDelta.scope, 'remote-task-graph-hot-buffer-refreshes');

  assert.deepEqual(device.createdBuffers.map((buffer) => buffer.label), [
    'ulg-sph-particle-state',
    'ulg-sph-particle-thermo',
    'ulg-mls-mpm-particle-mechanics'
  ]);
  assert.deepEqual(device.writes.map((write) => write.label), [
    'ulg-sph-particle-state',
    'ulg-sph-particle-thermo',
    'ulg-mls-mpm-particle-mechanics'
  ]);
  assert.equal(device.writes.every((write) => write.byteLength > 0), true);

  const hotBufferRecord = stateManager.getHotBuffer(refresh.refreshResult.hotBufferKey);
  assert.equal(hotBufferRecord.schema, ULG_REMOTE_TASK_GRAPH_HOT_BUFFER_REFRESH_RESULT_SCHEMA);
  assert.equal(hotBufferRecord.status, 'hot-buffer-refresh-stored');
  assert.equal(hotBufferRecord.sphUpload.schema, ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA);
  assert.equal(hotBufferRecord.mlsMpmUpload.schema, ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA);
  assert.equal(hotBufferRecord.sphPacked.particleCount, demo.state.particles.length);
  assert.equal(hotBufferRecord.mlsMpmPacked.particleCount, demo.state.particles.length);
  assert.equal(hotBufferRecord.sphUpload.stateBuffer.label, 'ulg-sph-particle-state');
  assert.equal(hotBufferRecord.sphUpload.thermoBuffer.label, 'ulg-sph-particle-thermo');
  assert.equal(hotBufferRecord.mlsMpmUpload.mechanicsBuffer.label, 'ulg-mls-mpm-particle-mechanics');

  const refreshDeltas = stateManager.getWarmDeltas('remote-task-graph-hot-buffer-refreshes');
  assert.equal(Object.keys(refreshDeltas).length, 1);
  assert.equal(
    refreshDeltas[`remote-task-graph-hot-buffer-refresh:${cacheKey}`].payload.refreshResult.schema,
    ULG_REMOTE_TASK_GRAPH_HOT_BUFFER_REFRESH_RESULT_SCHEMA
  );
  assert.equal(computeManager.getStats().gpuResidentLanes.activeLeaseCount, 0);
  assert.equal(computeManager.getStats().gpuResidentLanes.completedLeaseCount, 1);
});

test('ULG resident authority host refreshes admitted remote seeds into local SPH/MLS-MPM hot buffers', async (t) => {
  const computeMod = await importPeerComputeManager(t);
  const nodeMod = await importPeerComputeNodeKernel(t);
  const stateMod = await importPeerComputeStateManager(t);
  if (!computeMod || !nodeMod || !stateMod) return;
  const host = await createPeerComputeResidentAuthorityHost({
    nodeKernelModuleUrl: PEERCOMPUTE_NODE_KERNEL_URL.href,
    computeManagerModuleUrl: PEERCOMPUTE_COMPUTE_MANAGER_URL.href,
    stateManagerModuleUrl: PEERCOMPUTE_STATE_MANAGER_URL.href,
    remoteResultQuorumModuleUrl: PEERCOMPUTE_REMOTE_QUORUM_URL.href,
    computeTaskModulePath: ULG_MLS_MPM_GPU_STEP_MODULE_URL.href,
    enableWorkers: false,
    enablePersistence: false,
    disableNetworkProvider: true,
    disableBroadcast: true,
    nodeKernelConfig: {
      pubsubPeerDiscovery: false,
      maxConnections: 0,
      maxIncomingPendingConnections: 0,
      enableNetVizDebugTelemetry: false,
      enableNetVizSessionBroadcast: false,
      enableNetVizSessionDiscovery: false
    }
  });
  t.after(() => host.destroy?.());
  const summary = summarizePeerComputeResidentAuthorityHost(host);
  assert.equal(summary.nodeKernelReady, true);
  assert.equal(summary.residentSameDeviceHotBufferSourcePublicationReady, true);
  assert.equal(summary.residentRemoteSeedHotBufferRefreshReady, true);
  assert.equal(summary.residentRemoteSeedHotBufferRefreshExecutorReady, true);

  const demo = buildSphPhaseDemoState({
    allowFixtureMaterialProperties: true,
    dropMaterial: 'h2o',
    baseMaterial: 'h2o',
    dropTemperatureK: 300,
    baseTemperatureK: 300,
    dropParticleEdge: 1,
    baseParticleEdge: 1
  });
  const cacheKey = 'ulg-host-remote-seed-refresh:fnv1a32';
  const stateFamilies = [
    RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS,
    RESIDENT_STATE_FAMILIES.MECHANICS,
    RESIDENT_STATE_FAMILIES.THERMO_PHASE
  ];
  const remoteRetainedBufferRefs = [
    'remote-host:sph-state-buffer',
    'remote-host:sph-thermo-buffer',
    'remote-host:mls-mpm-mechanics-buffer'
  ];
  const stateSeedPayload = {
    schema: ULG_REMOTE_TASK_GRAPH_STATE_SEED_PAYLOAD_SCHEMA,
    cacheKey,
    stateKey: 'remote-state:ulg-host-sph-mls-mpm',
    state: demo.state,
    materialProperties: demo.materialProperties
  };
  const cacheArtifact = {
    schema: 'peercompute.compute.task-graph-cache-artifact.v0',
    cacheKey,
    artifactId: 'ulg-host-remote-seed-refresh-artifact',
    status: 'recorded-not-admitted',
    admitted: false,
    graphId: 'ulg-host-remote-seed-refresh-graph',
    resultHash: 'fnv1a32-ulg-host-remote-refresh-result',
    inputHash: 'fnv1a32-ulg-host-remote-refresh-input',
    stateSeedPayload,
    inputs: {
      stateFamilies,
      retainedBufferRefs: remoteRetainedBufferRefs
    }
  };
  const remoteResult = {
    schema: 'peercompute.compute.task-graph-result.v0',
    graphId: 'ulg-host-remote-seed-refresh-graph',
    status: 'completed',
    cacheKey,
    cacheInputHash: cacheArtifact.inputHash,
    cacheInputs: {
      stateFamilies,
      retainedBufferRefs: remoteRetainedBufferRefs
    },
    stateSeedPayload,
    graphLeaseRequired: true,
    graphLeaseStatus: 'completed',
    graphLeaseSpec: {
      schema: 'peercompute.compute.task-graph-gpu-resident-lane.v0',
      laneId: 'remote-host-lane:ulg-sph-mls-mpm',
      stateKey: 'remote-state:ulg-host-sph-mls-mpm',
      retainedBufferRefs: remoteRetainedBufferRefs
    },
    cacheArtifact
  };
  const admission = host.stateManager.admitTaskGraphCacheArtifact(cacheArtifact, {
    admissionId: 'ulg-host-remote-seed-refresh-admission',
    authority: 'node-kernel-state-manager',
    sourcePeerId: 'remote-peer:ulg-host',
    responderId: 'remote-node:ulg-host',
    reason: 'remote-task-graph-cache-artifact-admitted'
  });
  host.computeManager.importRemoteTaskGraphCacheResult(remoteResult, admission, {
    sourcePeerId: 'remote-peer:ulg-host',
    responderId: 'remote-node:ulg-host'
  });

  const device = createFakeWebGpuUploadDevice();
  const report = await host.refreshRemoteSeedHotBuffers(cacheKey, {
    device,
    returnCommitDelta: true
  });

  assert.equal(report.schema, ULG_REMOTE_TASK_GRAPH_HOT_BUFFER_REFRESH_AUTHORITY_REPORT_SCHEMA);
  assert.equal(report.status, 'remote-seed-hot-buffer-refresh-completed');
  assert.equal(report.refreshed, true);
  assert.equal(report.seed.status, 'warm-state-seed-committed');
  assert.equal(report.refresh.status, 'hot-buffer-refresh-completed');
  assert.equal(report.refresh.refreshResult.schema, ULG_REMOTE_TASK_GRAPH_HOT_BUFFER_REFRESH_RESULT_SCHEMA);
  assert.deepEqual(report.localBufferRefs, [
    `${report.hotBufferKey}:sph-state-buffer`,
    `${report.hotBufferKey}:sph-thermo-buffer`,
    `${report.hotBufferKey}:mls-mpm-mechanics-buffer`
  ]);
  assert.equal(report.localBufferRefs.some((ref) => ref.startsWith('remote-host:')), false);
  assert.deepEqual(device.createdBuffers.map((buffer) => buffer.label), [
    'ulg-sph-particle-state',
    'ulg-sph-particle-thermo',
    'ulg-mls-mpm-particle-mechanics'
  ]);
  const hotBufferRecord = host.stateManager.getHotBuffer(report.hotBufferKey);
  assert.equal(hotBufferRecord.schema, ULG_REMOTE_TASK_GRAPH_HOT_BUFFER_REFRESH_RESULT_SCHEMA);
  assert.equal(hotBufferRecord.sphUpload.stateBuffer.label, 'ulg-sph-particle-state');
  assert.equal(hotBufferRecord.mlsMpmUpload.mechanicsBuffer.label, 'ulg-mls-mpm-particle-mechanics');

});

test('ULG resident authority host admits worker-retained reaction/product output descriptors', async (t) => {
  const computeMod = await importPeerComputeManager(t);
  const nodeMod = await importPeerComputeNodeKernel(t);
  const stateMod = await importPeerComputeStateManager(t);
  if (!computeMod || !nodeMod || !stateMod) return;
  const host = await createPeerComputeResidentAuthorityHost({
    nodeKernelModuleUrl: PEERCOMPUTE_NODE_KERNEL_URL.href,
    computeManagerModuleUrl: PEERCOMPUTE_COMPUTE_MANAGER_URL.href,
    stateManagerModuleUrl: PEERCOMPUTE_STATE_MANAGER_URL.href,
    remoteResultQuorumModuleUrl: PEERCOMPUTE_REMOTE_QUORUM_URL.href,
    computeTaskModulePath: ULG_MLS_MPM_GPU_STEP_MODULE_URL.href,
    enableWorkers: false,
    enablePersistence: false,
    disableNetworkProvider: true,
    disableBroadcast: true,
    nodeKernelConfig: {
      pubsubPeerDiscovery: false,
      maxConnections: 0,
      maxIncomingPendingConnections: 0,
      enableNetVizDebugTelemetry: false,
      enableNetVizSessionBroadcast: false,
      enableNetVizSessionDiscovery: false
    }
  });
  t.after(() => host.destroy?.());

  const summary = summarizePeerComputeResidentAuthorityHost(host);
  assert.equal(summary.residentWorkerRetainedReactionProductPublicationReady, true);

  const candidate = {
    schema: 'peercompute.ulg.sph-reaction-product-worker-compact-publication-candidate.v0',
    candidateStatus: 'worker-retained-reaction-product-publication-candidate-ready',
    cacheKey: 'ulg:test:reaction-product-publication-cache',
    stateKey: 'ulg:test:reaction-product-publication-state',
    workerRetainedBufferRefs: [
      'ulg-worker:test:reactionProduct:state',
      'ulg-worker:test:reactionProduct:thermo',
      'ulg-worker:test:reactionProduct:mechanics',
      'ulg-worker:test:reactionProduct:product'
    ],
    workerRetainedProductBufferRefs: ['ulg-worker:test:reactionProduct:product'],
    workerRetainedProductBufferRefCount: 1,
    outputFamilies: [
      'sph-particle-state',
      'sph-thermo-phase',
      'mls-mpm-mechanics',
      'resident-product-mass'
    ]
  };
  const workerRunner = { id: 'test-reaction-product-worker-runner' };
  const publication = host.publishWorkerRetainedReactionProductStageOutput({
    candidate,
    workerRunner,
    workerModuleUrl: '/workers/ulg-mechanics-resident-stage.worker.js',
    sourceTaskId: 'ulg:test:reaction-product-stage-plan',
    sourceStage: 'reactionProduct'
  });

  assert.equal(publication.schema, ULG_REACTION_PRODUCT_WORKER_RETAINED_HOT_BUFFER_PUBLICATION_SCHEMA);
  assert.equal(publication.status, 'worker-retained-reaction-product-output-published');
  assert.equal(publication.committed, true);
  assert.equal(publication.sourceStage, 'reactionProduct');
  assert.deepEqual(publication.outputFamilies, candidate.outputFamilies);
  assert.deepEqual(publication.workerRetainedBufferRefs, candidate.workerRetainedBufferRefs);
  assert.equal(publication.workerRetainedBufferImport.schema, ULG_REACTION_PRODUCT_WORKER_RETAINED_BUFFER_IMPORT_SCHEMA);
  assert.equal(publication.workerRetainedBufferImport.copyMode, 'zero-copy-worker-retained-ref-descriptor');

  const hotRecord = host.stateManager.getHotBuffer(publication.hotBufferKey);
  assert.equal(hotRecord.schema, ULG_REACTION_PRODUCT_WORKER_RETAINED_HOT_BUFFER_PUBLICATION_SCHEMA);
  assert.equal(hotRecord.status, 'worker-retained-reaction-product-hot-buffer-source-stored');
  assert.equal(hotRecord.workerRunner, workerRunner);
  assert.equal(hotRecord.sourceStage, 'reactionProduct');
  assert.deepEqual(hotRecord.workerRetainedBufferRefs, candidate.workerRetainedBufferRefs);

  const warmDeltas = host.stateManager.getWarmDeltas('ulg-worker-retained-reaction-product-publications');
  const warmDelta = warmDeltas[publication.commitDeltaTaskId];
  assert.equal(warmDelta.payload.schema, ULG_REACTION_PRODUCT_WORKER_RETAINED_HOT_BUFFER_PUBLICATION_SCHEMA);
  assert.equal(warmDelta.payload.status, 'worker-retained-reaction-product-output-admitted');
  assert.equal(warmDelta.payload.hotBufferKey, publication.hotBufferKey);
  assert.equal(warmDelta.payload.workerLocal, true);
  assert.deepEqual(warmDelta.payload.outputFamilies, candidate.outputFamilies);
});

test('ULG resident authority host publishes admitted pressure/interface gas-cell field imports', async (t) => {
  const computeMod = await importPeerComputeManager(t);
  const nodeMod = await importPeerComputeNodeKernel(t);
  const stateMod = await importPeerComputeStateManager(t);
  if (!computeMod || !nodeMod || !stateMod) return;
  const host = await createPeerComputeResidentAuthorityHost({
    nodeKernelModuleUrl: PEERCOMPUTE_NODE_KERNEL_URL.href,
    computeManagerModuleUrl: PEERCOMPUTE_COMPUTE_MANAGER_URL.href,
    stateManagerModuleUrl: PEERCOMPUTE_STATE_MANAGER_URL.href,
    remoteResultQuorumModuleUrl: PEERCOMPUTE_REMOTE_QUORUM_URL.href,
    computeTaskModulePath: ULG_MLS_MPM_GPU_STEP_MODULE_URL.href,
    enableWorkers: false,
    enablePersistence: false,
    disableNetworkProvider: true,
    disableBroadcast: true,
    nodeKernelConfig: {
      pubsubPeerDiscovery: false,
      maxConnections: 0,
      maxIncomingPendingConnections: 0,
      enableNetVizDebugTelemetry: false,
      enableNetVizSessionBroadcast: false,
      enableNetVizSessionDiscovery: false
    }
  });
  t.after(() => host.destroy?.());

  const summary = summarizePeerComputeResidentAuthorityHost(host);
  assert.equal(summary.residentPressureInterfaceGasCellFieldAdmissionPublicationReady, true);
  assert.equal(summary.residentPressureInterfaceGasCellFieldImportPublicationReady, true);

  const gasCellFieldSnapshot = {
    localPressureGradientReady: true,
    cellDims: [2, 1, 1],
    cells: [
      {
        gridIndex: [0, 0, 0],
        centerM: [0.5, 1, 1],
        pressurePa: 120000,
        pressureGradientPaPerM: [0, 0, 0],
        volumeM3: 4
      },
      {
        gridIndex: [1, 0, 0],
        centerM: [1.5, 1, 1],
        pressurePa: 180000,
        pressureGradientPaPerM: [0, 0, 0],
        volumeM3: 4
      }
    ]
  };
  const admissionPublication = host.publishPressureInterfaceGasCellFieldAdmission({
    cacheKey: 'ulg:test:gas-cell-admission-cache',
    stateKey: 'ulg:test:gas-cell-admission-state',
    hotBufferKey: 'ulg:test:gas-cell-admission-hot-buffer',
    sourceTaskId: 'ulg:test:resident-gas-pressure-source',
    sourceStage: 'residentGasPressure',
    source: {
      schema: 'peercompute.ulg.sph-sealed-gas-pressure-summary.v0',
      spatialGasSpeciesLedgerSchema: 'peercompute.ulg.sph-spatial-gas-species-ledger.v0',
      spatialGasSpeciesLedgerStatus: 'spatial-gas-species-ledger-ready'
    },
    gasCellFieldSnapshot,
    retainedGasPressureBufferRefs: ['resident-gas-pressure-cells-buffer']
  });
  assert.equal(admissionPublication.schema, ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_HOT_BUFFER_PUBLICATION_SCHEMA);
  assert.equal(admissionPublication.status, 'pressure-interface-gas-cell-field-admission-published');
  assert.equal(admissionPublication.committed, true);
  assert.equal(admissionPublication.pressureInterfaceGasCellFieldAdmission.schema, ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA);
  assert.equal(admissionPublication.pressureInterfaceGasCellFieldAdmission.status, 'pressure-interface-gas-cell-field-consumption-approved');
  assert.equal(admissionPublication.pressureInterfaceGasCellFieldAdmission.sourceHotBufferKey, admissionPublication.hotBufferKey);
  assert.deepEqual(admissionPublication.pressureInterfaceGasCellFieldAdmission.retainedGasPressureBufferRefs, ['resident-gas-pressure-cells-buffer']);

  const pressureInterfaceGasCellFieldAdmission = admissionPublication.pressureInterfaceGasCellFieldAdmission;
  const publication = host.publishPressureInterfaceGasCellFieldImportSource({
    cacheKey: 'ulg:test:gas-cell-import-cache',
    stateKey: 'ulg:test:gas-cell-import-state',
    hotBufferKey: 'ulg:test:gas-cell-import-hot-buffer',
    sourceTaskId: 'ulg:test:resident-gas-pressure-source',
    sourceStage: 'residentGasPressure',
    gasCellFieldSnapshot,
    pressureInterfaceGasCellFieldAdmission,
    retainedGasPressureBufferRefs: ['resident-gas-pressure-cells-buffer']
  });

  assert.equal(publication.schema, ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_IMPORT_HOT_BUFFER_PUBLICATION_SCHEMA);
  assert.equal(publication.status, 'pressure-interface-gas-cell-field-import-published');
  assert.equal(publication.committed, true);
  assert.equal(publication.pressureInterfaceGasCellFieldImport.schema, ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_IMPORT_SCHEMA);
  assert.equal(publication.pressureInterfaceGasCellFieldImport.status, 'pressure-interface-gas-cell-field-import-ready');
  assert.equal(publication.pressureInterfaceGasCellFieldImport.sourceHotBufferKey, publication.hotBufferKey);
  assert.deepEqual(publication.pressureInterfaceGasCellFieldImport.retainedGasPressureBufferRefs, ['resident-gas-pressure-cells-buffer']);
  assert.equal(publication.pressureInterfaceGasCellFieldImport.pressureInterfaceGasPressureCellRowCount, 2);

  assert.throws(() => host.publishPressureInterfaceGasCellFieldImportSource({
    gasCellFieldSnapshot,
    pressureInterfaceGasCellFieldAdmission: {
      ...pressureInterfaceGasCellFieldAdmission,
      gasCellFieldConsumptionApproved: false
    },
    retainedGasPressureBufferRefs: ['resident-gas-pressure-cells-buffer']
  }), /requires admitted field-consumption evidence/);

  assert.throws(() => host.publishPressureInterfaceGasCellFieldImportSource({
    gasCellFieldSnapshot,
    pressureInterfaceGasCellFieldAdmission: {
      ...pressureInterfaceGasCellFieldAdmission,
      retainedGasPressureBufferRefs: []
    },
    retainedGasPressureBufferRefs: []
  }), /requires retained gas-cell buffer refs/);

  const hotRecord = host.stateManager.getHotBuffer(publication.hotBufferKey);
  assert.equal(hotRecord.schema, ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_IMPORT_HOT_BUFFER_PUBLICATION_SCHEMA);
  assert.equal(hotRecord.status, 'pressure-interface-gas-cell-field-import-hot-buffer-source-stored');
  assert.equal(hotRecord.pressureInterfaceGasCellFieldImport.schema, ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_IMPORT_SCHEMA);
  assert.deepEqual(hotRecord.retainedGasPressureBufferRefs, ['resident-gas-pressure-cells-buffer']);

  const warmDeltas = host.stateManager.getWarmDeltas('ulg-pressure-interface-gas-cell-field-imports');
  const warmDelta = warmDeltas[publication.commitDeltaTaskId];
  assert.equal(warmDelta.payload.schema, ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_IMPORT_HOT_BUFFER_PUBLICATION_SCHEMA);
  assert.equal(warmDelta.payload.status, 'pressure-interface-gas-cell-field-import-admitted');
  assert.equal(warmDelta.payload.hotBufferKey, publication.hotBufferKey);

  const admissionHotRecord = host.stateManager.getHotBuffer(admissionPublication.hotBufferKey);
  assert.equal(admissionHotRecord.schema, ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_HOT_BUFFER_PUBLICATION_SCHEMA);
  assert.equal(admissionHotRecord.status, 'pressure-interface-gas-cell-field-admission-hot-buffer-source-stored');
  const admissionWarmDeltas = host.stateManager.getWarmDeltas('ulg-pressure-interface-gas-cell-field-admissions');
  const admissionWarmDelta = admissionWarmDeltas[admissionPublication.commitDeltaTaskId];
  assert.equal(admissionWarmDelta.payload.schema, ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_HOT_BUFFER_PUBLICATION_SCHEMA);
  assert.equal(admissionWarmDelta.payload.status, 'pressure-interface-gas-cell-field-admission-admitted');
  assert.equal(admissionWarmDelta.payload.hotBufferKey, admissionPublication.hotBufferKey);
  assert.equal(warmDelta.payload.pressureInterfaceGasCellFieldImport.schema, ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_IMPORT_SCHEMA);

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
  const stageResult = await runSphPressureInterfaceStageComputeTask({
    computeTaskId: 'ulg:test:pressure-interface-stage-host-gas-cell-import',
    preferWebGpu: false,
    readbackMode: 'no-full-readback',
    gasPressureSummary: {
      schema: 'peercompute.ulg.sph-sealed-gas-pressure-summary.v0',
      status: 'synthetic-pressure',
      totalPressurePa: 120000,
      boxVolumeM3: 8,
      boxDimsM: [2, 2, 2],
      bySpecies: {},
      strictReactionGate: { status: 'strict-reaction-gate-pass', blockers: [] }
    },
    materialInterfaceField,
    pressureInterfaceGasCellFieldImport: publication.pressureInterfaceGasCellFieldImport,
    expectedOutputFamilies: ['pressure-interface-force-rows'],
    pressureInterfaceStageTask: true
  });
  assert.equal(stageResult.pressureInterfaceForceSolver.pressureFieldMode, 'local-gas-cell-pressure-gradient');
  assert.equal(stageResult.pressureInterfaceGasCellFieldImportReady, true);
  assert.equal(stageResult.pressureInterfaceGasCellFieldImportSourceHotBufferKey, publication.hotBufferKey);
  assert.deepEqual(stageResult.pressureInterfaceForceSolver.gasInterfacePressureRangePa, [120000, 180000]);
});

test('ULG resident authority host admits worker-retained pressure/interface force-row descriptors', async (t) => {
  const computeMod = await importPeerComputeManager(t);
  const nodeMod = await importPeerComputeNodeKernel(t);
  const stateMod = await importPeerComputeStateManager(t);
  if (!computeMod || !nodeMod || !stateMod) return;
  const host = await createPeerComputeResidentAuthorityHost({
    nodeKernelModuleUrl: PEERCOMPUTE_NODE_KERNEL_URL.href,
    computeManagerModuleUrl: PEERCOMPUTE_COMPUTE_MANAGER_URL.href,
    stateManagerModuleUrl: PEERCOMPUTE_STATE_MANAGER_URL.href,
    remoteResultQuorumModuleUrl: PEERCOMPUTE_REMOTE_QUORUM_URL.href,
    computeTaskModulePath: ULG_MLS_MPM_GPU_STEP_MODULE_URL.href,
    enableWorkers: false,
    enablePersistence: false,
    disableNetworkProvider: true,
    disableBroadcast: true,
    nodeKernelConfig: {
      pubsubPeerDiscovery: false,
      maxConnections: 0,
      maxIncomingPendingConnections: 0,
      enableNetVizDebugTelemetry: false,
      enableNetVizSessionBroadcast: false,
      enableNetVizSessionDiscovery: false
    }
  });
  t.after(() => host.destroy?.());

  const summary = summarizePeerComputeResidentAuthorityHost(host);
  assert.equal(summary.residentWorkerRetainedPressureInterfacePublicationReady, true);

  const candidate = {
    schema: ULG_SPH_PRESSURE_INTERFACE_WORKER_COMPACT_PUBLICATION_CANDIDATE_SCHEMA,
    candidateStatus: 'worker-retained-pressure-interface-publication-candidate-ready',
    cacheKey: 'ulg:test:pressure-interface-publication-cache',
    stateKey: 'ulg:test:pressure-interface-publication-state',
    workerRetainedBufferRefs: ['ulg-worker:test:pressureInterface:forceRows'],
    workerRetainedPressureBufferRefs: ['ulg-worker:test:pressureInterface:forceRows'],
    workerRetainedPressureBufferRefCount: 1,
    retainedPressureBufferRefs: ['pressure-interface-force-rows-buffer'],
    pressureInterfaceForceRowCount: 2,
    pressureInterfaceForceRowStrideFloats: 16,
    pressureInterfaceForceRowByteLength: 128,
    pressureInterfaceForceRowsBufferByteLength: 128,
    pressureInterfaceForceRowsBufferRetained: true,
    pressureInterfaceBufferResidency: 'worker-lane-gpu-buffer-retained',
    pressureInterfaceConsumerAccessProtocol: 'same-worker-lane-retained-buffer-ref',
    pressureFieldMode: 'local-gas-cell-pressure-gradient',
    pressureFieldResolution: 'structured-gas-cell-grid',
    localPressureGradientReady: true,
    localPressureGradientStatus: 'local-pressure-gradient-field-ready',
    localPressureGradientForceCouplingStatus: 'local-pressure-gradient-force-coupling-ready',
    pressureInterfaceGasCellFieldAdmissionSchema: ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA,
    pressureInterfaceGasCellFieldAdmissionStatus: 'pressure-interface-gas-cell-field-consumption-approved',
    pressureInterfaceGasCellFieldAdmissionApproved: true,
    pressureInterfaceGasCellFieldConsumerStatus: 'admitted-local-gas-cell-field-consumer-ready',
    workerRetainedGasPressureBufferRefs: ['ulg-worker:test:pressureInterface:gasCells'],
    retainedGasPressureBufferRefs: ['resident-gas-pressure-cells-buffer'],
    pressureInterfaceGasPressureCellRowCount: 2,
    pressureInterfaceGasPressureCellRowStrideFloats: 12,
    pressureInterfaceGasPressureCellRowByteLength: 96,
    pressureInterfaceGasPressureCellRowsBufferRetained: true,
    outputFamilies: ['pressure-interface-force-rows']
  };
  const workerRunner = { id: 'test-pressure-interface-worker-runner' };
  const publication = host.publishWorkerRetainedPressureInterfaceStageOutput({
    candidate,
    workerRunner,
    workerModuleUrl: '/workers/ulg-mechanics-resident-stage.worker.js',
    sourceTaskId: 'ulg:test:pressure-interface-stage-plan',
    sourceStage: 'pressureInterface'
  });

  assert.equal(publication.schema, ULG_PRESSURE_INTERFACE_WORKER_RETAINED_HOT_BUFFER_PUBLICATION_SCHEMA);
  assert.equal(publication.status, 'worker-retained-pressure-interface-output-published');
  assert.equal(publication.committed, true);
  assert.equal(publication.sourceStage, 'pressureInterface');
  assert.deepEqual(publication.outputFamilies, candidate.outputFamilies);
  assert.equal(publication.pressureInterfaceForceRowCount, 2);
  assert.equal(publication.pressureInterfaceForceRowStrideFloats, 16);
  assert.equal(publication.pressureInterfaceForceRowByteLength, 128);
  assert.equal(publication.pressureInterfaceForceRowsBufferByteLength, 128);
  assert.equal(publication.pressureInterfaceForceRowsBufferRetained, true);
  assert.equal(publication.pressureFieldMode, 'local-gas-cell-pressure-gradient');
  assert.equal(publication.localPressureGradientReady, true);
  assert.equal(publication.pressureInterfaceGasCellFieldAdmissionSchema, ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA);
  assert.equal(publication.pressureInterfaceGasCellFieldAdmissionStatus, 'pressure-interface-gas-cell-field-consumption-approved');
  assert.equal(publication.pressureInterfaceGasCellFieldAdmissionApproved, true);
  assert.equal(publication.pressureInterfaceGasCellFieldConsumerStatus, 'admitted-local-gas-cell-field-consumer-ready');
  assert.equal(publication.pressureInterfaceGasPressureCellRowCount, 2);
  assert.equal(publication.pressureInterfaceGasPressureCellRowStrideFloats, 12);
  assert.equal(publication.pressureInterfaceGasPressureCellRowByteLength, 96);
  assert.equal(publication.pressureInterfaceGasPressureCellRowsBufferRetained, true);
  assert.equal(publication.retainedGasCellFieldSourceSchema, ULG_PRESSURE_INTERFACE_RETAINED_GAS_CELL_FIELD_SOURCE_SCHEMA);
  assert.equal(publication.retainedGasCellFieldSourceStatus, 'pressure-interface-retained-gas-cell-field-source-ready');
  assert.equal(publication.retainedGasCellFieldSourceReady, true);
  assert.deepEqual(publication.retainedSourceFamilies, ['resident-gas-pressure']);
  assert.equal(publication.retainedGasCellFieldSource.schema, ULG_PRESSURE_INTERFACE_RETAINED_GAS_CELL_FIELD_SOURCE_SCHEMA);
  assert.equal(publication.retainedGasCellFieldSource.sourceHotBufferKey, publication.hotBufferKey);
  assert.deepEqual(publication.retainedGasCellFieldSource.workerRetainedGasPressureBufferRefs, candidate.workerRetainedGasPressureBufferRefs);
  assert.deepEqual(publication.retainedGasCellFieldSource.retainedGasPressureBufferRefs, candidate.retainedGasPressureBufferRefs);
  assert.equal(publication.bufferResidency, 'worker-lane-gpu-buffer-retained');
  assert.equal(publication.consumerAccessProtocol, 'same-worker-lane-retained-buffer-ref');
  assert.equal(publication.gridForceApplicationApproved, false);
  assert.deepEqual(publication.workerRetainedPressureBufferRefs, candidate.workerRetainedPressureBufferRefs);
  assert.deepEqual(publication.retainedPressureBufferRefs, candidate.retainedPressureBufferRefs);
  assert.deepEqual(publication.workerRetainedGasPressureBufferRefs, candidate.workerRetainedGasPressureBufferRefs);
  assert.deepEqual(publication.retainedGasPressureBufferRefs, candidate.retainedGasPressureBufferRefs);
  assert.equal(publication.workerRetainedBufferImport.schema, ULG_PRESSURE_INTERFACE_WORKER_RETAINED_BUFFER_IMPORT_SCHEMA);
  assert.equal(publication.workerRetainedBufferImport.copyMode, 'zero-copy-worker-retained-ref-descriptor');
  assert.equal(publication.workerRetainedBufferImport.bufferResidency, 'worker-lane-gpu-buffer-retained');
  assert.equal(publication.workerRetainedBufferImport.consumerAccessProtocol, 'same-worker-lane-retained-buffer-ref');
  assert.equal(publication.workerRetainedBufferImport.gridForceApplicationApproved, false);
  assert.equal(publication.workerRetainedBufferImport.pressureInterfaceGasPressureCellRowsBufferRetained, true);
  assert.equal(publication.workerRetainedBufferImport.pressureInterfaceGasCellFieldAdmissionApproved, true);
  assert.equal(publication.workerRetainedBufferImport.retainedGasCellFieldSourceSchema, ULG_PRESSURE_INTERFACE_RETAINED_GAS_CELL_FIELD_SOURCE_SCHEMA);
  assert.equal(publication.workerRetainedBufferImport.retainedGasCellFieldSourceReady, true);
  assert.deepEqual(publication.workerRetainedBufferImport.retainedSourceFamilies, ['resident-gas-pressure']);

  assert.throws(() => host.publishWorkerRetainedPressureInterfaceStageOutput({
    candidate: {
      ...candidate,
      pressureInterfaceForceRowsBufferRetained: false,
      pressureInterfaceBufferResidency: 'cloneable-force-row-array',
      pressureInterfaceConsumerAccessProtocol: 'cloneable-force-row-array'
    },
    workerRunner,
    workerModuleUrl: '/workers/ulg-mechanics-resident-stage.worker.js',
    sourceTaskId: 'ulg:test:pressure-interface-stage-plan-invalid',
    sourceStage: 'pressureInterface'
  }), /requires worker-lane GPU retained force-row buffers/);

  assert.throws(() => host.publishWorkerRetainedPressureInterfaceStageOutput({
    candidate: {
      ...candidate,
      pressureInterfaceGasCellFieldAdmissionSchema: null,
      pressureInterfaceGasCellFieldAdmissionStatus: 'pressure-interface-gas-cell-field-admission-required',
      pressureInterfaceGasCellFieldAdmissionApproved: false,
      pressureInterfaceGasCellFieldConsumerStatus: 'blocked-local-gas-cell-field-admission-required'
    },
    workerRunner,
    workerModuleUrl: '/workers/ulg-mechanics-resident-stage.worker.js',
    sourceTaskId: 'ulg:test:pressure-interface-stage-plan-local-gas-unadmitted',
    sourceStage: 'pressureInterface'
  }), /requires admitted gas-cell field consumption evidence/);

  assert.throws(() => host.publishWorkerRetainedPressureInterfaceStageOutput({
    candidate: {
      ...candidate,
      workerRetainedGasPressureBufferRefs: [],
      retainedGasPressureBufferRefs: [],
      pressureInterfaceGasPressureCellRowsBufferRetained: false
    },
    workerRunner,
    workerModuleUrl: '/workers/ulg-mechanics-resident-stage.worker.js',
    sourceTaskId: 'ulg:test:pressure-interface-stage-plan-local-gas-invalid',
    sourceStage: 'pressureInterface'
  }), /requires worker-lane GPU retained gas-cell buffers/);

  const hotRecord = host.stateManager.getHotBuffer(publication.hotBufferKey);
  assert.equal(hotRecord.schema, ULG_PRESSURE_INTERFACE_WORKER_RETAINED_HOT_BUFFER_PUBLICATION_SCHEMA);
  assert.equal(hotRecord.status, 'worker-retained-pressure-interface-hot-buffer-source-stored');
  assert.equal(hotRecord.workerRunner, workerRunner);
  assert.equal(hotRecord.sourceStage, 'pressureInterface');
  assert.deepEqual(hotRecord.workerRetainedPressureBufferRefs, candidate.workerRetainedPressureBufferRefs);
  assert.deepEqual(hotRecord.retainedPressureBufferRefs, candidate.retainedPressureBufferRefs);
  assert.equal(hotRecord.pressureInterfaceForceRowsBufferByteLength, 128);
  assert.equal(hotRecord.pressureInterfaceGasPressureCellRowByteLength, 96);
  assert.deepEqual(hotRecord.workerRetainedGasPressureBufferRefs, candidate.workerRetainedGasPressureBufferRefs);
  assert.equal(hotRecord.pressureInterfaceGasCellFieldAdmissionApproved, true);
  assert.equal(hotRecord.pressureInterfaceGasCellFieldConsumerStatus, 'admitted-local-gas-cell-field-consumer-ready');
  assert.equal(hotRecord.retainedGasCellFieldSourceSchema, ULG_PRESSURE_INTERFACE_RETAINED_GAS_CELL_FIELD_SOURCE_SCHEMA);
  assert.equal(hotRecord.retainedGasCellFieldSourceReady, true);
  assert.equal(hotRecord.retainedGasCellFieldSource.sourceHotBufferKey, publication.hotBufferKey);
  assert.deepEqual(hotRecord.retainedSourceFamilies, ['resident-gas-pressure']);
  assert.equal(hotRecord.bufferResidency, 'worker-lane-gpu-buffer-retained');
  assert.equal(hotRecord.consumerAccessProtocol, 'same-worker-lane-retained-buffer-ref');

  const warmDeltas = host.stateManager.getWarmDeltas('ulg-worker-retained-pressure-interface-publications');
  const warmDelta = warmDeltas[publication.commitDeltaTaskId];
  assert.equal(warmDelta.payload.schema, ULG_PRESSURE_INTERFACE_WORKER_RETAINED_HOT_BUFFER_PUBLICATION_SCHEMA);
  assert.equal(warmDelta.payload.status, 'worker-retained-pressure-interface-output-admitted');
  assert.equal(warmDelta.payload.hotBufferKey, publication.hotBufferKey);
  assert.equal(warmDelta.payload.workerLocal, true);
  assert.equal(warmDelta.payload.pressureInterfaceForceRowCount, 2);
  assert.equal(warmDelta.payload.pressureInterfaceForceRowsBufferByteLength, 128);
  assert.equal(warmDelta.payload.pressureInterfaceForceRowsBufferRetained, true);
  assert.equal(warmDelta.payload.pressureInterfaceGasPressureCellRowCount, 2);
  assert.equal(warmDelta.payload.pressureInterfaceGasPressureCellRowsBufferRetained, true);
  assert.equal(warmDelta.payload.pressureInterfaceGasCellFieldAdmissionSchema, ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA);
  assert.equal(warmDelta.payload.pressureInterfaceGasCellFieldAdmissionApproved, true);
  assert.deepEqual(warmDelta.payload.workerRetainedGasPressureBufferRefs, candidate.workerRetainedGasPressureBufferRefs);
  assert.equal(warmDelta.payload.retainedGasCellFieldSourceSchema, ULG_PRESSURE_INTERFACE_RETAINED_GAS_CELL_FIELD_SOURCE_SCHEMA);
  assert.equal(warmDelta.payload.retainedGasCellFieldSourceReady, true);
  assert.deepEqual(warmDelta.payload.retainedGasCellFieldSource.sourceFamilies, ['resident-gas-pressure']);
  assert.deepEqual(warmDelta.payload.retainedSourceFamilies, ['resident-gas-pressure']);
  assert.equal(warmDelta.payload.bufferResidency, 'worker-lane-gpu-buffer-retained');
  assert.equal(warmDelta.payload.consumerAccessProtocol, 'same-worker-lane-retained-buffer-ref');
  assert.equal(warmDelta.payload.gridForceApplicationApproved, false);
  assert.deepEqual(warmDelta.payload.outputFamilies, candidate.outputFamilies);
});

test('ULG resident authority host auto-refreshes local hot buffers after admitted remote task graph import', async (t) => {
  const computeMod = await importPeerComputeManager(t);
  const nodeMod = await importPeerComputeNodeKernel(t);
  const stateMod = await importPeerComputeStateManager(t);
  if (!computeMod || !nodeMod || !stateMod) return;
  const { NodeKernel } = nodeMod;
  const host = await createPeerComputeResidentAuthorityHost({
    nodeKernelModuleUrl: PEERCOMPUTE_NODE_KERNEL_URL.href,
    computeManagerModuleUrl: PEERCOMPUTE_COMPUTE_MANAGER_URL.href,
    stateManagerModuleUrl: PEERCOMPUTE_STATE_MANAGER_URL.href,
    remoteResultQuorumModuleUrl: PEERCOMPUTE_REMOTE_QUORUM_URL.href,
    computeTaskModulePath: ULG_MLS_MPM_GPU_STEP_MODULE_URL.href,
    enableWorkers: false,
    enablePersistence: false,
    disableNetworkProvider: true,
    disableBroadcast: true,
    nodeKernelConfig: {
      pubsubPeerDiscovery: false,
      maxConnections: 0,
      maxIncomingPendingConnections: 0,
      enableNetVizDebugTelemetry: false,
      enableNetVizSessionBroadcast: false,
      enableNetVizSessionDiscovery: false
    }
  });
  t.after(() => host.destroy?.());
  const responder = makeStartedKernel(NodeKernel, {
    nodeId: 'ulg-host-task-graph-refresh-responder',
    enableRemoteTaskGraphResponder: true
  });
  const messages = [];
  host.nodeKernel.isStarted = true;
  connectInMemoryTaskGraphKernels({
    requester: host.nodeKernel,
    responder,
    requesterPeerId: 'peer-a',
    responderPeerId: 'peer-b',
    messages
  });

  const demo = buildSphPhaseDemoState({
    allowFixtureMaterialProperties: true,
    dropMaterial: 'h2o',
    baseMaterial: 'h2o',
    dropTemperatureK: 300,
    baseTemperatureK: 300,
    dropParticleEdge: 1,
    baseParticleEdge: 1
  });
  const cacheKey = 'ulg-host-task-graph-auto-refresh:fnv1a32';
  const stateFamilies = [
    RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS,
    RESIDENT_STATE_FAMILIES.MECHANICS,
    RESIDENT_STATE_FAMILIES.THERMO_PHASE
  ];
  const remoteRetainedBufferRefs = [
    'remote-auto:sph-state-buffer',
    'remote-auto:sph-thermo-buffer',
    'remote-auto:mls-mpm-mechanics-buffer'
  ];
  const stateSeedPayload = {
    schema: ULG_REMOTE_TASK_GRAPH_STATE_SEED_PAYLOAD_SCHEMA,
    cacheKey,
    stateKey: 'remote-state:ulg-host-auto-sph-mls-mpm',
    state: demo.state,
    materialProperties: demo.materialProperties
  };
  responder.computeManager = {
    async submitTaskGraph(graph) {
      assert.equal(graph.placementPolicy.authority, 'node-kernel');
      assert.deepEqual(graph.placementPolicy.targetPeerIds, ['peer-b']);
      return {
        schema: 'peercompute.compute.task-graph-result.v0',
        graphId: graph.graphId,
        status: 'completed',
        nodeCount: graph.nodes.length,
        nodeResults: {
          law: {
            schema: 'peercompute.ulg.remote-auto-refresh-law-result.v0',
            ok: true
          }
        },
        cacheKey,
        cacheInputHash: 'fnv1a32-ulg-host-auto-refresh-input',
        cacheInputs: {
          stateFamilies,
          retainedBufferRefs: remoteRetainedBufferRefs
        },
        stateSeedPayload,
        graphLeaseRequired: true,
        graphLeaseStatus: 'completed',
        graphLeaseSpec: {
          schema: 'peercompute.compute.task-graph-gpu-resident-lane.v0',
          laneId: 'remote-auto-lane:ulg-sph-mls-mpm',
          stateKey: 'remote-state:ulg-host-auto-sph-mls-mpm',
          retainedBufferRefs: remoteRetainedBufferRefs
        },
        cacheArtifact: {
          schema: 'peercompute.compute.task-graph-cache-artifact.v0',
          cacheKey,
          artifactId: 'ulg-host-task-graph-auto-refresh-artifact',
          status: 'recorded-not-admitted',
          admitted: false,
          graphId: graph.graphId,
          resultHash: 'fnv1a32-ulg-host-auto-refresh-result',
          inputHash: 'fnv1a32-ulg-host-auto-refresh-input',
          stateSeedPayload,
          inputs: {
            stateFamilies,
            retainedBufferRefs: remoteRetainedBufferRefs
          }
        }
      };
    }
  };

  const device = createFakeWebGpuUploadDevice();
  const report = await host.submitTaskGraphWithRemoteSeedHotBufferRefresh({
    graphId: 'ulg-host-task-graph-auto-refresh',
    placementPolicy: {
      requestedPlacement: 'peer',
      advisory: false,
      targetPeerIds: ['peer-b'],
      admitRemoteTaskGraphCacheArtifact: true,
      remoteTaskGraphCacheArtifactValidatorId: 'ulg-host-auto-refresh-validator'
    },
    nodes: [{
      id: 'law',
      task: {
        id: 'ulg-host-task-graph-auto-refresh-law',
        runtime: 'js',
        module: '/tasks/ulg-host-auto-refresh-law.js',
        exportName: 'run',
        data: { ok: true }
      }
    }]
  }, {
    device,
    returnCommitDelta: true
  });

  assert.equal(messages[0].message.type, 'compute-task-graph');
  assert.equal(messages[1].message.type, 'compute-task-graph-result');
  assert.equal(report.schema, ULG_REMOTE_TASK_GRAPH_SUBMIT_REFRESH_REPORT_SCHEMA);
  assert.equal(report.status, 'task-graph-submitted-remote-seed-hot-buffer-refreshed');
  assert.equal(report.refreshed, true);
  assert.equal(report.remoteTaskGraphCacheArtifactPreflight.status, 'admitted-through-node-kernel-state-manager');
  assert.equal(report.remoteTaskGraphCacheArtifactPreflight.importedLocally, true);
  assert.equal(report.refreshReport.schema, ULG_REMOTE_TASK_GRAPH_HOT_BUFFER_REFRESH_AUTHORITY_REPORT_SCHEMA);
  assert.equal(report.refreshReport.seed.status, 'warm-state-seed-committed');
  assert.equal(report.refreshReport.refresh.status, 'hot-buffer-refresh-completed');
  assert.deepEqual(report.localBufferRefs, [
    `${report.hotBufferKey}:sph-state-buffer`,
    `${report.hotBufferKey}:sph-thermo-buffer`,
    `${report.hotBufferKey}:mls-mpm-mechanics-buffer`
  ]);
  assert.equal(report.localBufferRefs.some((ref) => ref.startsWith('remote-auto:')), false);
  assert.deepEqual(device.createdBuffers.map((buffer) => buffer.label), [
    'ulg-sph-particle-state',
    'ulg-sph-particle-thermo',
    'ulg-mls-mpm-particle-mechanics'
  ]);
  const hotBufferRecord = host.stateManager.getHotBuffer(report.hotBufferKey);
  assert.equal(hotBufferRecord.schema, ULG_REMOTE_TASK_GRAPH_HOT_BUFFER_REFRESH_RESULT_SCHEMA);
  assert.equal(hotBufferRecord.sphUpload.stateBuffer.label, 'ulg-sph-particle-state');
  assert.equal(hotBufferRecord.mlsMpmUpload.mechanicsBuffer.label, 'ulg-mls-mpm-particle-mechanics');

  const blockedCacheKey = 'ulg-host-task-graph-auto-refresh-blocked-reaction:fnv1a32';
  const blockedStateSeedPayload = {
    ...stateSeedPayload,
    cacheKey: blockedCacheKey,
    stateKey: 'remote-state:ulg-host-auto-blocked-reaction'
  };
  responder.computeManager = {
    async submitTaskGraph(graph) {
      return {
        schema: 'peercompute.compute.task-graph-result.v0',
        graphId: graph.graphId,
        status: 'completed',
        nodeCount: graph.nodes.length,
        nodeResults: {
          law: {
            schema: 'peercompute.ulg.remote-auto-refresh-blocked-law-result.v0',
            ok: true
          }
        },
        cacheKey: blockedCacheKey,
        cacheInputHash: 'fnv1a32-ulg-host-auto-refresh-blocked-input',
        cacheInputs: {
          stateFamilies: [...stateFamilies, RESIDENT_STATE_FAMILIES.REACTION_PRODUCTS],
          retainedBufferRefs: ['remote-auto-blocked:reaction-products-buffer']
        },
        stateSeedPayload: blockedStateSeedPayload,
        graphLeaseRequired: true,
        graphLeaseStatus: 'completed',
        graphLeaseSpec: {
          schema: 'peercompute.compute.task-graph-gpu-resident-lane.v0',
          laneId: 'remote-auto-lane:blocked-reaction',
          stateKey: 'remote-state:ulg-host-auto-blocked-reaction',
          retainedBufferRefs: ['remote-auto-blocked:reaction-products-buffer']
        },
        cacheArtifact: {
          schema: 'peercompute.compute.task-graph-cache-artifact.v0',
          cacheKey: blockedCacheKey,
          artifactId: 'ulg-host-task-graph-auto-refresh-blocked-artifact',
          status: 'recorded-not-admitted',
          admitted: false,
          graphId: graph.graphId,
          resultHash: 'fnv1a32-ulg-host-auto-refresh-blocked-result',
          inputHash: 'fnv1a32-ulg-host-auto-refresh-blocked-input',
          stateSeedPayload: blockedStateSeedPayload,
          inputs: {
            stateFamilies: [...stateFamilies, RESIDENT_STATE_FAMILIES.REACTION_PRODUCTS],
            retainedBufferRefs: ['remote-auto-blocked:reaction-products-buffer']
          }
        }
      };
    }
  };
  const blockedDevice = createFakeWebGpuUploadDevice();
  const blockedReport = await host.submitTaskGraphWithRemoteSeedHotBufferRefresh({
    graphId: 'ulg-host-task-graph-auto-refresh-blocked-reaction',
    placementPolicy: {
      requestedPlacement: 'peer',
      advisory: false,
      targetPeerIds: ['peer-b'],
      admitRemoteTaskGraphCacheArtifact: true
    },
    nodes: [{
      id: 'law',
      task: {
        id: 'ulg-host-task-graph-auto-refresh-blocked-law',
        runtime: 'js',
        module: '/tasks/ulg-host-auto-refresh-blocked-law.js',
        exportName: 'run'
      }
    }]
  }, {
    device: blockedDevice
  });
  assert.equal(blockedReport.schema, ULG_REMOTE_TASK_GRAPH_SUBMIT_REFRESH_REPORT_SCHEMA);
  assert.equal(blockedReport.status, 'task-graph-submitted-remote-seed-hot-buffer-refresh-blocked');
  assert.equal(blockedReport.refreshed, false);
  assert.equal(blockedReport.refreshReport.status, 'seed-commit-blocked');
  assert.equal(blockedReport.refreshReport.seed.status, 'blocked-by-policy');
  assert.equal(
    blockedReport.refreshReport.seed.policy.status,
    'blocked-state-family-policy'
  );
  assert.deepEqual(blockedReport.refreshReport.seed.policy.disallowedStateFamilies, [
    RESIDENT_STATE_FAMILIES.REACTION_PRODUCTS
  ]);
  assert.equal(blockedDevice.createdBuffers.length, 0);
});

test('ULG remote seed graph builder executes on a real responder ComputeManager and refreshes local hot buffers', async (t) => {
  const computeMod = await importPeerComputeManager(t);
  const nodeMod = await importPeerComputeNodeKernel(t);
  const stateMod = await importPeerComputeStateManager(t);
  if (!computeMod || !nodeMod || !stateMod) return;
  const { ComputeManager } = computeMod;
  const { NodeKernel } = nodeMod;
  const host = await createPeerComputeResidentAuthorityHost({
    nodeKernelModuleUrl: PEERCOMPUTE_NODE_KERNEL_URL.href,
    computeManagerModuleUrl: PEERCOMPUTE_COMPUTE_MANAGER_URL.href,
    stateManagerModuleUrl: PEERCOMPUTE_STATE_MANAGER_URL.href,
    remoteResultQuorumModuleUrl: PEERCOMPUTE_REMOTE_QUORUM_URL.href,
    computeTaskModulePath: ULG_MLS_MPM_GPU_STEP_MODULE_URL.href,
    enableWorkers: false,
    enablePersistence: false,
    disableNetworkProvider: true,
    disableBroadcast: true,
    nodeKernelConfig: {
      pubsubPeerDiscovery: false,
      maxConnections: 0,
      maxIncomingPendingConnections: 0,
      enableNetVizDebugTelemetry: false,
      enableNetVizSessionBroadcast: false,
      enableNetVizSessionDiscovery: false
    }
  });
  t.after(() => host.destroy?.());
  const responder = makeStartedKernel(NodeKernel, {
    nodeId: 'ulg-real-compute-remote-seed-responder',
    enableRemoteTaskGraphResponder: true
  });
  responder.computeManager = new ComputeManager({ enableWorkers: false });
  const messages = [];
  host.nodeKernel.isStarted = true;
  connectInMemoryTaskGraphKernels({
    requester: host.nodeKernel,
    responder,
    requesterPeerId: 'peer-a',
    responderPeerId: 'peer-b',
    messages
  });

  const demo = buildSphPhaseDemoState({
    allowFixtureMaterialProperties: true,
    dropMaterial: 'h2o',
    baseMaterial: 'h2o',
    dropTemperatureK: 300,
    baseTemperatureK: 300,
    dropParticleEdge: 1,
    baseParticleEdge: 1
  });
  const graph = buildUlgSphMlsMpmRemoteSeedTaskGraph({
    state: demo.state,
    materialProperties: demo.materialProperties,
    graphId: 'ulg-real-compute-remote-seed-graph',
    cacheKey: 'ulg-real-compute-remote-seed:fnv1a32',
    stateKey: 'remote-state:ulg-real-compute-remote-seed',
    seedTaskModulePath: ULG_PEERCOMPUTE_BROWSER_RESIDENT_HOST_MODULE_URL.href,
    postStageSeedTaskModulePath: ULG_PEERCOMPUTE_BROWSER_RESIDENT_HOST_MODULE_URL.href,
    includeMechanicsStageChain: true,
    includeMechanicsStageSeed: true,
    mechanicsStageTaskModulePath: ULG_MLS_MPM_GPU_STEP_MODULE_URL.href,
    mechanicsStageSeedTaskModulePath: ULG_PEERCOMPUTE_BROWSER_RESIDENT_HOST_MODULE_URL.href,
    mechanicsStagePreferWebGpu: false,
    includeResidentComputeStage: true,
    includePostStageSeed: true,
    residentTaskModulePath: ULG_MLS_MPM_GPU_STEP_MODULE_URL.href,
    residentPreferWebGpu: false,
    residentStepCount: 1,
    placementPolicy: {
      requestedPlacement: 'peer',
      advisory: false,
      targetPeerIds: ['peer-b'],
      admitRemoteTaskGraphCacheArtifact: true,
      remoteTaskGraphCacheArtifactValidatorId: 'ulg-real-compute-remote-seed-validator'
    }
  });
  assert.equal(graph.schema, ULG_REMOTE_TASK_GRAPH_SPH_MLS_MPM_GRAPH_SCHEMA);
  assert.equal(graph.nodes.length, 7);
  assert.equal(graph.nodes[0].task.exportName, 'runUlgRemoteSphMlsMpmStateSeedGraphNode');
  assert.equal(graph.nodes[1].id, 'ulg-sph-mls-mpm-mechanics-p2g');
  assert.deepEqual(graph.nodes[1].dependsOn, ['ulg-sph-mls-mpm-state-seed']);
  assert.equal(graph.nodes[2].id, 'ulg-sph-mls-mpm-mechanics-grid-update');
  assert.deepEqual(graph.nodes[2].dependsOn, ['ulg-sph-mls-mpm-mechanics-p2g']);
  assert.deepEqual(graph.nodes[2].resultInputs, {
    p2gGridProjection: 'ulg-sph-mls-mpm-mechanics-p2g'
  });
  assert.equal(graph.nodes[3].id, 'ulg-sph-mls-mpm-mechanics-g2p');
  assert.deepEqual(graph.nodes[3].dependsOn, ['ulg-sph-mls-mpm-mechanics-grid-update']);
  assert.deepEqual(graph.nodes[3].resultInputs, {
    gridUpdate: 'ulg-sph-mls-mpm-mechanics-grid-update'
  });
  assert.equal(graph.nodes[4].id, 'ulg-sph-mls-mpm-mechanics-stage-state-seed');
  assert.deepEqual(graph.nodes[4].dependsOn, ['ulg-sph-mls-mpm-mechanics-g2p']);
  assert.deepEqual(graph.nodes[4].resultInputs, {
    mechanicsG2pResult: 'ulg-sph-mls-mpm-mechanics-g2p'
  });
  assert.equal(graph.nodes[5].id, 'ulg-sph-mls-mpm-resident-steps');
  assert.deepEqual(graph.nodes[5].dependsOn, ['ulg-sph-mls-mpm-mechanics-stage-state-seed']);
  assert.equal(graph.nodes[6].id, 'ulg-sph-mls-mpm-post-stage-state-seed');
  assert.deepEqual(graph.nodes[6].dependsOn, ['ulg-sph-mls-mpm-resident-steps']);
  assert.deepEqual(graph.nodes[6].resultInputs, {
    residentStageResult: 'ulg-sph-mls-mpm-resident-steps'
  });
  assert.equal(graph.stateSeedPayload.schema, ULG_REMOTE_TASK_GRAPH_STATE_SEED_PAYLOAD_SCHEMA);

  const device = createFakeWebGpuUploadDevice();
  const report = await host.submitTaskGraphWithRemoteSeedHotBufferRefresh(graph, {
    device,
    returnCommitDelta: true
  });

  assert.equal(messages[0].message.type, 'compute-task-graph');
  assert.equal(messages[1].message.type, 'compute-task-graph-result');
  assert.equal(report.schema, ULG_REMOTE_TASK_GRAPH_SUBMIT_REFRESH_REPORT_SCHEMA);
  assert.equal(report.status, 'task-graph-submitted-remote-seed-hot-buffer-refreshed');
  assert.equal(report.refreshed, true);
  assert.equal(report.result.graphId, graph.graphId);
  assert.deepEqual(report.result.executionOrder, [
    'ulg-sph-mls-mpm-state-seed',
    'ulg-sph-mls-mpm-mechanics-p2g',
    'ulg-sph-mls-mpm-mechanics-grid-update',
    'ulg-sph-mls-mpm-mechanics-g2p',
    'ulg-sph-mls-mpm-mechanics-stage-state-seed',
    'ulg-sph-mls-mpm-resident-steps',
    'ulg-sph-mls-mpm-post-stage-state-seed'
  ]);
  assert.equal(report.result.stateSeedPayload.schema, ULG_REMOTE_TASK_GRAPH_STATE_SEED_PAYLOAD_SCHEMA);
  assert.equal(report.result.cacheArtifact.stateSeedPayload.schema, ULG_REMOTE_TASK_GRAPH_STATE_SEED_PAYLOAD_SCHEMA);
  assert.equal(
    report.result.nodeResults['ulg-sph-mls-mpm-state-seed'].schema,
    ULG_REMOTE_TASK_GRAPH_SPH_MLS_MPM_SEED_NODE_SCHEMA
  );
  assert.equal(
    report.result.nodeResults['ulg-sph-mls-mpm-mechanics-p2g'].computeTaskResultSchema,
    ULG_MLS_MPM_MECHANICS_P2G_STAGE_COMPUTE_TASK_RESULT_SCHEMA
  );
  assert.equal(report.result.nodeResults['ulg-sph-mls-mpm-mechanics-p2g'].mechanicsP2gStageTaskEvidence.passed, true);
  assert.equal(
    report.result.nodeResults['ulg-sph-mls-mpm-mechanics-grid-update'].computeTaskResultSchema,
    ULG_MLS_MPM_MECHANICS_GRID_UPDATE_STAGE_COMPUTE_TASK_RESULT_SCHEMA
  );
  assert.equal(
    report.result.nodeResults['ulg-sph-mls-mpm-mechanics-grid-update'].mechanicsGridUpdateStageTaskEvidence.passed,
    true
  );
  assert.equal(
    report.result.nodeResults['ulg-sph-mls-mpm-mechanics-g2p'].computeTaskResultSchema,
    ULG_MLS_MPM_MECHANICS_G2P_STAGE_COMPUTE_TASK_RESULT_SCHEMA
  );
  assert.equal(report.result.nodeResults['ulg-sph-mls-mpm-mechanics-g2p'].mechanicsG2pStageTaskEvidence.passed, true);
  assert.equal(
    report.result.nodeResults['ulg-sph-mls-mpm-mechanics-g2p'].mechanicsG2pStageTaskAuthority.status,
    'compute-manager-owned-non-mutating-g2p-stage-task'
  );
  const compactMechanicsSeed = runUlgRemoteSphMlsMpmMechanicsStageSeedGraphNode({
    stateSeedPayload: graph.stateSeedPayload,
    sourceNodeId: 'ulg-sph-mls-mpm-mechanics-g2p',
    mechanicsG2pResult: {
      computeTaskResultSchema: ULG_MLS_MPM_MECHANICS_G2P_STAGE_COMPUTE_TASK_RESULT_SCHEMA,
      status: 'reconstructed',
      backend: 'webgpu',
      readbackMode: 'no-full-readback',
      fullReadbackPerformed: false,
      normalHotLoopReadbackFree: true,
      particleCount: graph.stateSeedPayload.state.particles.length,
      stateBufferByteLength: graph.stateSeedPayload.state.particles.length
        * SPH_GPU_PARTICLE_STATE_FLOATS
        * Float32Array.BYTES_PER_ELEMENT,
      mechanicsBufferByteLength: graph.stateSeedPayload.state.particles.length
        * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS
        * Float32Array.BYTES_PER_ELEMENT,
      mechanicsG2pStageTaskEvidence: {
        outputBuffersRetained: true
      },
      gpuFence: {
        fenceSatisfied: true
      },
      dt: graph.stateSeedPayload.state.gpuMechanics?.dt ?? 5e-4
    }
  });
  assert.equal(
    compactMechanicsSeed.schema,
    ULG_REMOTE_TASK_GRAPH_SPH_MLS_MPM_MECHANICS_STAGE_SEED_NODE_SCHEMA
  );
  assert.equal(
    compactMechanicsSeed.status,
    'remote-sph-mls-mpm-mechanics-stage-compact-seed-not-refreshable'
  );
  assert.equal(compactMechanicsSeed.stateSeedPayload, null);
  assert.equal(compactMechanicsSeed.refreshableByDefault, false);
  assert.equal(compactMechanicsSeed.compactMechanicsStageSeed.schema, ULG_REMOTE_TASK_GRAPH_SPH_MLS_MPM_MECHANICS_STAGE_COMPACT_SEED_SCHEMA);
  assert.equal(compactMechanicsSeed.compactMechanicsStageSeed.admissionRequired, true);
  assert.equal(compactMechanicsSeed.compactMechanicsStageSeed.localRefreshRequired, true);
  assert.equal(compactMechanicsSeed.compactMechanicsStageSeed.gpuFenceSatisfied, true);
  assert.equal(
    compactMechanicsSeed.compactMechanicsStageSeed.localRefreshContract.schema,
    ULG_REMOTE_TASK_GRAPH_COMPACT_LOCAL_REFRESH_CONTRACT_SCHEMA
  );
  assert.equal(
    compactMechanicsSeed.compactMechanicsStageSeed.localRefreshContract.status,
    'local-source-materialization-required'
  );
  assert.equal(compactMechanicsSeed.compactMechanicsStageSeed.localRefreshContract.localSourceRequired, true);
  assert.equal(compactMechanicsSeed.compactMechanicsStageSeed.localRefreshContract.remoteRetainedRefsUsableLocally, false);
  assert.deepEqual(compactMechanicsSeed.compactMechanicsStageSeed.localRefreshContract.acceptedMaterializationModes, [
    'same-device-retained-buffer-import',
    'validated-compact-buffer-snapshot',
    'validated-local-state-seed'
  ]);
  assert.deepEqual(compactMechanicsSeed.compactMechanicsStageSeed.stateFamilies, [
    RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS,
    RESIDENT_STATE_FAMILIES.MECHANICS
  ]);
  const compactPreference = selectRemoteGraphRefreshSeedPayload({
    nodeResults: {
      'ulg-sph-mls-mpm-mechanics-stage-state-seed': compactMechanicsSeed
    }
  }, {
    preferMechanicsStageSeed: true
  });
  assert.equal(compactPreference.payload, null);
  assert.equal(compactPreference.source, 'remote-mechanics-stage-compact-seed-not-refreshable');
  assert.equal(compactPreference.blockRefresh, true);
  assert.equal(compactPreference.compactMechanicsStageCandidate.schema, ULG_REMOTE_TASK_GRAPH_SPH_MLS_MPM_MECHANICS_STAGE_COMPACT_SEED_SCHEMA);
  const compactRefreshExecutor = createUlgSphMlsMpmCompactHotBufferRefreshExecutor({});
  const blockedCompactExecutorResult = await compactRefreshExecutor({
    cacheKey: graph.cacheKey,
    compactCandidateAuthority: {
      compactCandidate: compactMechanicsSeed.compactMechanicsStageSeed
    }
  });
  assert.equal(blockedCompactExecutorResult.status, 'blocked-compact-candidate-local-source-required');
  assert.equal(blockedCompactExecutorResult.refreshed, false);
  assert.equal(blockedCompactExecutorResult.reason, 'compact-candidate-does-not-include-local-refresh-source');
  assert.equal(blockedCompactExecutorResult.localRefreshContract.schema, ULG_REMOTE_TASK_GRAPH_COMPACT_LOCAL_REFRESH_CONTRACT_SCHEMA);
  assert.equal(blockedCompactExecutorResult.localRefreshContract.localSourceRequired, true);
  assert.deepEqual(blockedCompactExecutorResult.localBufferRefs, []);
  assert.deepEqual(
    blockedCompactExecutorResult.remoteRetainedBufferRefs,
    compactMechanicsSeed.compactMechanicsStageSeed.retainedBufferRefs
  );
  const snapshotSphPacked = buildSphGpuParticleBuffers(graph.stateSeedPayload.state, {
    materialProperties: graph.stateSeedPayload.materialProperties || {}
  });
  const snapshotMlsMpmPacked = buildMlsMpmGpuParticleBuffers(graph.stateSeedPayload.state, {
    materialProperties: graph.stateSeedPayload.materialProperties || {}
  });
  const compactSnapshotDevice = createFakeWebGpuUploadDevice();
  const compactSnapshotExecutor = createUlgSphMlsMpmCompactHotBufferRefreshExecutor({
    device: compactSnapshotDevice,
    hotBufferKeyPrefix: 'compact-snapshot-test'
  });
  const compactSnapshotResult = await compactSnapshotExecutor({
    cacheKey: graph.cacheKey,
    stateManager: host.stateManager,
    compactCandidateAuthority: {
      compactCandidate: {
        ...compactMechanicsSeed.compactMechanicsStageSeed,
        compactBufferSnapshot: {
          schema: ULG_REMOTE_TASK_GRAPH_COMPACT_BUFFER_SNAPSHOT_SCHEMA,
          cacheKey: graph.cacheKey,
          stateKey: graph.stateSeedPayload.stateKey,
          particleCount: graph.stateSeedPayload.state.particles.length,
          step: graph.stateSeedPayload.step,
          time: graph.stateSeedPayload.time,
          sphState: snapshotSphPacked.state,
          sphThermo: snapshotSphPacked.thermo,
          mlsMpmMechanics: snapshotMlsMpmPacked.mechanics
        }
      }
    }
  });
  assert.equal(compactSnapshotResult.status, 'ulg-sph-mls-mpm-compact-snapshot-hot-buffer-refresh-executed');
  assert.equal(compactSnapshotResult.sourceMode, 'compact-buffer-snapshot');
  assert.equal(compactSnapshotResult.sourceSchema, ULG_REMOTE_TASK_GRAPH_COMPACT_BUFFER_SNAPSHOT_SCHEMA);
  assert.equal(compactSnapshotResult.compactCandidateHash, compactMechanicsSeed.compactMechanicsStageSeed.hash);
  assert.deepEqual(compactSnapshotResult.localBufferRefs, [
    `${compactSnapshotResult.hotBufferKey}:sph-state-buffer`,
    `${compactSnapshotResult.hotBufferKey}:sph-thermo-buffer`,
    `${compactSnapshotResult.hotBufferKey}:mls-mpm-mechanics-buffer`
  ]);
  assert.deepEqual(compactSnapshotDevice.createdBuffers.map((buffer) => buffer.label), [
    'ulg-sph-particle-state',
    'ulg-sph-particle-thermo',
    'ulg-mls-mpm-particle-mechanics'
  ]);
  const compactSnapshotHotBuffer = host.stateManager.getHotBuffer(compactSnapshotResult.hotBufferKey);
  assert.equal(compactSnapshotHotBuffer.schema, ULG_REMOTE_TASK_GRAPH_HOT_BUFFER_REFRESH_RESULT_SCHEMA);
  assert.equal(compactSnapshotHotBuffer.sourceMode, 'compact-buffer-snapshot');
  const liveSourcePublication = host.publishSameDeviceHotBufferSource({
    cacheKey: graph.cacheKey,
    stateKey: graph.stateSeedPayload.stateKey,
    hotBufferKeyPrefix: 'same-device-live-source-test',
    sphPacked: compactSnapshotHotBuffer.sphPacked,
    mlsMpmPacked: compactSnapshotHotBuffer.mlsMpmPacked,
    sphUpload: compactSnapshotHotBuffer.sphUpload,
    mlsMpmUpload: compactSnapshotHotBuffer.mlsMpmUpload,
    sourceSchema: ULG_MLS_MPM_MECHANICS_G2P_STAGE_COMPUTE_TASK_RESULT_SCHEMA,
    sourceMode: 'compute-manager-gpu-worker-output',
    sourceTaskId: 'ulg-sph-mls-mpm-mechanics-g2p',
    sourceNodeId: 'ulg-sph-mls-mpm-mechanics-g2p',
    sourceStage: 'mechanics-g2p'
  });
  assert.equal(
    liveSourcePublication.schema,
    ULG_SPH_MLS_MPM_SAME_DEVICE_HOT_BUFFER_SOURCE_PUBLICATION_SCHEMA
  );
  assert.equal(liveSourcePublication.status, 'same-device-hot-buffer-source-published');
  assert.equal(liveSourcePublication.sameDeviceRetainedBufferImport.sameDevice, true);
  assert.equal(
    liveSourcePublication.sameDeviceRetainedBufferImport.sourceHotBufferKey,
    liveSourcePublication.hotBufferKey
  );
  const liveSourceHotBuffer = host.stateManager.getHotBuffer(liveSourcePublication.hotBufferKey);
  assert.equal(liveSourceHotBuffer.status, 'hot-buffer-source-stored');
  assert.equal(liveSourceHotBuffer.sourceMode, 'compute-manager-gpu-worker-output');
  assert.strictEqual(liveSourceHotBuffer.sphUpload, compactSnapshotHotBuffer.sphUpload);
  assert.strictEqual(liveSourceHotBuffer.mlsMpmUpload, compactSnapshotHotBuffer.mlsMpmUpload);
  const compactMechanicsSeedWithSameDeviceSource = runUlgRemoteSphMlsMpmMechanicsStageSeedGraphNode({
    stateSeedPayload: graph.stateSeedPayload,
    sourceNodeId: 'ulg-sph-mls-mpm-mechanics-g2p',
    mechanicsG2pResult: {
      computeTaskResultSchema: ULG_MLS_MPM_MECHANICS_G2P_STAGE_COMPUTE_TASK_RESULT_SCHEMA,
      status: 'reconstructed',
      backend: 'webgpu',
      readbackMode: 'no-full-readback',
      fullReadbackPerformed: false,
      normalHotLoopReadbackFree: true,
      particleCount: graph.stateSeedPayload.state.particles.length,
      stateBufferByteLength: graph.stateSeedPayload.state.particles.length
        * SPH_GPU_PARTICLE_STATE_FLOATS
        * Float32Array.BYTES_PER_ELEMENT,
      mechanicsBufferByteLength: graph.stateSeedPayload.state.particles.length
        * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS
        * Float32Array.BYTES_PER_ELEMENT,
      mechanicsG2pStageTaskEvidence: {
        outputBuffersRetained: true
      },
      sameDeviceRetainedBufferImport: liveSourcePublication.sameDeviceRetainedBufferImport,
      gpuFence: {
        fenceSatisfied: true
      },
      dt: graph.stateSeedPayload.state.gpuMechanics?.dt ?? 5e-4
    }
  });
  assert.equal(
    compactMechanicsSeedWithSameDeviceSource.compactMechanicsStageSeed.sameDeviceRetainedBufferImport.schema,
    ULG_REMOTE_TASK_GRAPH_SAME_DEVICE_RETAINED_BUFFER_IMPORT_SCHEMA
  );
  assert.equal(
    compactMechanicsSeedWithSameDeviceSource.compactMechanicsStageSeed.sameDeviceRetainedBufferImport.sourceHotBufferKey,
    liveSourcePublication.hotBufferKey
  );
  assert.equal(
    compactMechanicsSeedWithSameDeviceSource.compactMechanicsStageSeed.outputBuffers.sameDeviceRetainedBufferImportAvailable,
    true
  );
  assert.equal(
    compactMechanicsSeedWithSameDeviceSource.compactMechanicsStageSeed.localRefreshContract.status,
    'same-device-local-source-ready'
  );
  assert.equal(
    compactMechanicsSeedWithSameDeviceSource.compactMechanicsStageSeed.localRefreshContract.localSourceRequired,
    false
  );
  assert.equal(
    compactMechanicsSeedWithSameDeviceSource.compactMechanicsStageSeed.localRefreshContract.availableLocalSources[0].sourceHotBufferKey,
    liveSourcePublication.hotBufferKey
  );
  assert.notEqual(
    compactMechanicsSeedWithSameDeviceSource.compactMechanicsStageSeed.hash,
    compactMechanicsSeed.compactMechanicsStageSeed.hash
  );
  const retainedImportDevice = createFakeWebGpuUploadDevice();
  const retainedImportExecutor = createUlgSphMlsMpmCompactHotBufferRefreshExecutor({
    device: retainedImportDevice,
    hotBufferKeyPrefix: 'same-device-retained-import-test'
  });
  const retainedImportResult = await retainedImportExecutor({
    cacheKey: graph.cacheKey,
    stateManager: host.stateManager,
    compactCandidateAuthority: {
      compactCandidate: compactMechanicsSeedWithSameDeviceSource.compactMechanicsStageSeed
    }
  });
  assert.equal(retainedImportResult.status, 'ulg-sph-mls-mpm-same-device-retained-buffer-imported');
  assert.equal(retainedImportResult.refreshed, true);
  assert.equal(retainedImportResult.sourceMode, 'same-device-retained-buffer-import');
  assert.equal(retainedImportResult.sourceSchema, ULG_REMOTE_TASK_GRAPH_SAME_DEVICE_RETAINED_BUFFER_IMPORT_SCHEMA);
  assert.equal(retainedImportResult.sameDevice, true);
  assert.equal(retainedImportResult.sameDeviceAliasOf, liveSourcePublication.hotBufferKey);
  assert.equal(retainedImportResult.copyMode, 'zero-copy-local-hot-buffer-alias');
  assert.deepEqual(retainedImportResult.localBufferRefs, liveSourcePublication.localBufferRefs);
  assert.deepEqual(retainedImportResult.copyBudget, {
    uploadBytes: 0,
    readbackBytes: 0,
    retainedBytes: 0,
    compactSummaryBytes: 0
  });
  assert.equal(retainedImportDevice.createdBuffers.length, 0);
  assert.equal(retainedImportDevice.writes.length, 0);
  const retainedImportHotBuffer = host.stateManager.getHotBuffer(retainedImportResult.hotBufferKey);
  assert.equal(retainedImportHotBuffer.schema, ULG_REMOTE_TASK_GRAPH_HOT_BUFFER_REFRESH_RESULT_SCHEMA);
  assert.equal(retainedImportHotBuffer.sourceMode, 'same-device-retained-buffer-import');
  assert.equal(retainedImportHotBuffer.sameDeviceAliasOf, liveSourcePublication.hotBufferKey);
  assert.strictEqual(retainedImportHotBuffer.sphUpload, liveSourceHotBuffer.sphUpload);
  assert.strictEqual(retainedImportHotBuffer.mlsMpmUpload, liveSourceHotBuffer.mlsMpmUpload);

  const originalSubmitTaskGraph = host.nodeKernel.submitTaskGraph;
  const originalCommitRemoteTaskGraphCompactCandidate = host.nodeKernel.commitRemoteTaskGraphCompactCandidate;
  const originalRefreshRemoteTaskGraphHotBuffersFromCompactCandidate =
    host.nodeKernel.refreshRemoteTaskGraphHotBuffersFromCompactCandidate;
  const compactAdmissionCalls = [];
  const compactRefreshCalls = [];
  try {
    host.nodeKernel.submitTaskGraph = async () => ({
      schema: 'peercompute.compute.task-graph-result.v0',
      status: 'completed',
      graphId: 'compact-mechanics-only-graph',
      cacheKey: graph.cacheKey,
      cacheArtifact: {
        cacheKey: graph.cacheKey
      },
      remoteTaskGraphCacheArtifactPreflight: {
        status: 'admitted-through-node-kernel-state-manager',
        importedLocally: true,
        cacheKey: graph.cacheKey
      },
      nodeResults: {
        'ulg-sph-mls-mpm-mechanics-stage-state-seed': compactMechanicsSeed
      }
    });
    host.nodeKernel.commitRemoteTaskGraphCompactCandidate = (cacheKey, options = {}) => {
      compactAdmissionCalls.push({
        cacheKey,
        options
      });
      return {
        status: 'compact-candidate-committed',
        committed: true,
        cacheKey,
        compactCandidate: options.compactMechanicsStageCandidate,
        commitDeltaScope: options.scope || 'remote-task-graph-compact-candidates',
        localRefreshRequired: options.compactMechanicsStageCandidate?.localRefreshRequired !== false,
        remoteRetainedRefsUsableLocally: false,
        hotBufferRefreshStatus: 'compact-candidate-local-refresh-required'
      };
    };
    host.nodeKernel.refreshRemoteTaskGraphHotBuffersFromCompactCandidate = async (cacheKey, options = {}) => {
      compactRefreshCalls.push({
        cacheKey,
        options
      });
      assert.equal(typeof options.refreshExecutor, 'function');
      const localExecutorResult = await options.refreshExecutor({
        cacheKey,
        compactCandidateAuthority: {
          compactCandidate: compactMechanicsSeed.compactMechanicsStageSeed
        },
        compactCandidate: compactMechanicsSeed.compactMechanicsStageSeed
      });
      assert.equal(localExecutorResult.status, 'blocked-compact-candidate-local-source-required');
      return {
        schema: 'peercompute.nodekernel.remote-task-graph-hot-buffer-refresh.v0',
        status: 'compact-hot-buffer-refresh-not-completed',
        refreshed: false,
        sourceMode: 'compact-candidate',
        cacheKey,
        reason: localExecutorResult.reason,
        refreshResult: localExecutorResult,
        compactCandidateAuthority: {
          schema: 'peercompute.nodekernel.remote-task-graph-compact-candidate-authority.v0',
          compactCandidate: compactMechanicsSeed.compactMechanicsStageSeed
        },
        localBufferRefs: []
      };
    };

    const compactOnlyReport = await host.submitTaskGraphWithRemoteSeedHotBufferRefresh({
      graphId: 'compact-mechanics-only-graph'
    }, {
      preferMechanicsStageSeed: true,
      returnCommitDelta: true,
      attemptCompactCandidateRefresh: true,
      useDefaultCompactRefreshExecutor: true,
      allowedStateFamilies: [
        RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS,
        RESIDENT_STATE_FAMILIES.MECHANICS,
        RESIDENT_STATE_FAMILIES.THERMO_PHASE
      ]
    });

    assert.equal(compactOnlyReport.status, 'task-graph-submitted-remote-seed-hot-buffer-refresh-blocked');
    assert.equal(compactOnlyReport.refreshed, false);
    assert.equal(compactOnlyReport.reason, 'mechanics-stage-compact-seed-requires-admitted-local-refresh-before-hot-buffer-refresh');
    assert.equal(compactOnlyReport.refreshSeedPayloadSource, 'remote-mechanics-stage-compact-seed-not-refreshable');
    assert.equal(compactOnlyReport.compactMechanicsStageCandidate.hash, compactMechanicsSeed.compactMechanicsStageSeed.hash);
    assert.equal(compactOnlyReport.compactCandidateAdmissionStatus, 'compact-candidate-committed');
    assert.equal(compactOnlyReport.compactCandidateAdmission.committed, true);
    assert.equal(compactOnlyReport.compactCandidateAdmission.remoteRetainedRefsUsableLocally, false);
    assert.equal(compactOnlyReport.compactCandidateAdmission.hotBufferRefreshStatus, 'compact-candidate-local-refresh-required');
    assert.equal(
      compactOnlyReport.compactCandidateRefreshReport.status,
      'remote-compact-candidate-hot-buffer-refresh-not-completed'
    );
    assert.equal(compactOnlyReport.compactCandidateRefreshReport.refresh.status, 'compact-hot-buffer-refresh-not-completed');
    assert.equal(
      compactOnlyReport.compactCandidateRefreshReport.refresh.reason,
      'compact-candidate-does-not-include-local-refresh-source'
    );
    assert.deepEqual(compactOnlyReport.compactCandidateRefreshReport.localBufferRefs, []);
    assert.equal(compactOnlyReport.refreshReport, null);
    assert.equal(compactOnlyReport.hotBufferKey, null);
    assert.deepEqual(compactOnlyReport.localBufferRefs, []);
    assert.equal(compactAdmissionCalls.length, 1);
    assert.equal(compactAdmissionCalls[0].cacheKey, graph.cacheKey);
    assert.equal(
      compactAdmissionCalls[0].options.compactMechanicsStageCandidate.hash,
      compactMechanicsSeed.compactMechanicsStageSeed.hash
    );
    assert.deepEqual(compactAdmissionCalls[0].options.allowedStateFamilies, [
      RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS,
      RESIDENT_STATE_FAMILIES.MECHANICS,
      RESIDENT_STATE_FAMILIES.THERMO_PHASE
    ]);
    assert.equal(compactRefreshCalls.length, 1);
    assert.equal(compactRefreshCalls[0].cacheKey, graph.cacheKey);
    assert.equal(compactRefreshCalls[0].options.compactCandidateTaskId, compactOnlyReport.compactCandidateAdmission.commitDeltaTaskId);
    assert.equal(compactRefreshCalls[0].options.candidateId, compactMechanicsSeed.compactMechanicsStageSeed.hash);
  } finally {
    host.nodeKernel.submitTaskGraph = originalSubmitTaskGraph;
    host.nodeKernel.commitRemoteTaskGraphCompactCandidate = originalCommitRemoteTaskGraphCompactCandidate;
    host.nodeKernel.refreshRemoteTaskGraphHotBuffersFromCompactCandidate =
      originalRefreshRemoteTaskGraphHotBuffersFromCompactCandidate;
  }

  assert.equal(
    report.result.nodeResults['ulg-sph-mls-mpm-mechanics-stage-state-seed'].schema,
    ULG_REMOTE_TASK_GRAPH_SPH_MLS_MPM_MECHANICS_STAGE_SEED_NODE_SCHEMA
  );
  assert.equal(
    report.result.nodeResults['ulg-sph-mls-mpm-mechanics-stage-state-seed'].stateSeedPayload.schema,
    ULG_REMOTE_TASK_GRAPH_STATE_SEED_PAYLOAD_SCHEMA
  );
  assert.equal(
    report.result.nodeResults['ulg-sph-mls-mpm-mechanics-stage-state-seed'].step,
    graph.stateSeedPayload.step + 1
  );
  assert.equal(report.result.nodeResults['ulg-sph-mls-mpm-mechanics-stage-state-seed'].authoritativeByDefault, false);
  assert.equal(
    report.result.nodeResults['ulg-sph-mls-mpm-resident-steps'].computeTaskResultSchema,
    ULG_MLS_MPM_RESIDENT_STEPS_COMPUTE_TASK_RESULT_SCHEMA
  );
  assert.equal(report.result.nodeResults['ulg-sph-mls-mpm-resident-steps'].backend, 'cpu-reference');
  assert.equal(report.result.nodeResults['ulg-sph-mls-mpm-resident-steps'].commitDelta, undefined);
  assert.equal(
    report.result.nodeResults['ulg-sph-mls-mpm-post-stage-state-seed'].schema,
    ULG_REMOTE_TASK_GRAPH_SPH_MLS_MPM_POST_STAGE_SEED_NODE_SCHEMA
  );
  assert.equal(
    report.result.nodeResults['ulg-sph-mls-mpm-post-stage-state-seed'].stateSeedPayload.schema,
    ULG_REMOTE_TASK_GRAPH_STATE_SEED_PAYLOAD_SCHEMA
  );
  assert.equal(report.result.nodeResults['ulg-sph-mls-mpm-post-stage-state-seed'].step, graph.stateSeedPayload.step + 1);
  assert.equal(report.refreshSeedPayloadSource, 'remote-post-stage-state-seed-node');
  assert.equal(report.remoteTaskGraphCacheArtifactPreflight.status, 'admitted-through-node-kernel-state-manager');
  assert.equal(report.remoteTaskGraphCacheArtifactPreflight.importedLocally, true);
  assert.equal(report.refreshReport.seed.status, 'warm-state-seed-committed');
  assert.equal(report.refreshReport.seed.stateSeedPayloadSource, 'nodekernel-call-validated-override');
  assert.equal(report.refreshReport.seed.stateSeedPayload.step, graph.stateSeedPayload.step + 1);
  assert.equal(report.refreshReport.refresh.status, 'hot-buffer-refresh-completed');
  assert.deepEqual(report.localBufferRefs, [
    `${report.hotBufferKey}:sph-state-buffer`,
    `${report.hotBufferKey}:sph-thermo-buffer`,
    `${report.hotBufferKey}:mls-mpm-mechanics-buffer`
  ]);
  assert.equal(report.localBufferRefs.some((ref) => ref.startsWith('remote-state:')), false);
  assert.deepEqual(device.createdBuffers.map((buffer) => buffer.label), [
    'ulg-sph-particle-state',
    'ulg-sph-particle-thermo',
    'ulg-mls-mpm-particle-mechanics'
  ]);
  const hotBufferRecord = host.stateManager.getHotBuffer(report.hotBufferKey);
  assert.equal(hotBufferRecord.schema, ULG_REMOTE_TASK_GRAPH_HOT_BUFFER_REFRESH_RESULT_SCHEMA);
  assert.equal(hotBufferRecord.step, graph.stateSeedPayload.step + 1);
  assert.equal(hotBufferRecord.sphUpload.stateBuffer.label, 'ulg-sph-particle-state');
  assert.equal(hotBufferRecord.mlsMpmUpload.mechanicsBuffer.label, 'ulg-mls-mpm-particle-mechanics');

  const mechanicsSeedDevice = createFakeWebGpuUploadDevice();
  const mechanicsSeedReport = await host.submitTaskGraphWithRemoteSeedHotBufferRefresh(graph, {
    device: mechanicsSeedDevice,
    returnCommitDelta: true,
    preferMechanicsStageSeed: true
  });
  assert.equal(mechanicsSeedReport.refreshSeedPayloadSource, 'remote-mechanics-stage-state-seed-node');
  assert.equal(
    mechanicsSeedReport.result.nodeResults['ulg-sph-mls-mpm-mechanics-stage-state-seed'].stateSeedPayload.mechanicsStageSeed.status,
    'mechanics-stage-state-seed-derived'
  );
  assert.equal(
    mechanicsSeedReport.refreshReport.seed.stateSeedPayload.state.status,
    'remote-mechanics-stage-full-readback-seed-ready'
  );
  assert.equal(mechanicsSeedReport.refreshReport.seed.stateSeedPayload.step, graph.stateSeedPayload.step + 1);
  assert.equal(mechanicsSeedReport.refreshReport.refresh.status, 'hot-buffer-refresh-completed');
});
