import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ULG_SCHROEDER_WORKER_LANE_COMPUTE_MANAGER_COMPLETION_SCHEMA,
  ULG_SCHROEDER_WORKER_HIERARCHY_CONFIG_SCHEMA,
  ULG_SCHROEDER_WORKER_LANE_SEQUENCE_CONTRACT_SCHEMA,
  ULG_WORKER_RESIDENT_SCHEDULE_TERMINAL_REFLUX_RECEIPT_SCHEMA,
  createSchroederWorkerHierarchyConfig,
  createSchroederWorkerResidentStepOptions,
  createSchroederWorkerLaneSequenceContract,
  estimateSchroederWorkerLaneSeedUploadBytes,
  runSchroederWorkerLaneScheduleWithAuthority
} from '../src/runtime/sph/schroederWorkerLaneControlPlane.js';
import {
  attachResidentStateManagerCommitBridge
} from '../src/runtime/peercomputeResidentCommitBridge.js';

function authorityFixture() {
  const calls = [];
  const warmByScope = new Map();
  const stateManager = {
    commitDelta(delta) {
      const scope = delta.scope;
      const entries = warmByScope.get(scope) || {};
      entries[delta.taskId] = {
        version: delta.version,
        ts: delta.timestamp,
        payload: structuredClone(delta.payload)
      };
      warmByScope.set(scope, entries);
    },
    getWarmDeltas(scope) {
      return warmByScope.get(scope) || {};
    }
  };
  const activeLeases = new Map();
  const computeManager = {
    acquireGpuResidentLaneLease(spec) {
      calls.push(['acquire', spec]);
      const lease = {
        ...structuredClone(spec),
        leaseId: `${spec.laneId}:lease:test`
      };
      activeLeases.set(lease.leaseId, lease);
      return lease;
    },
    completeGpuResidentLaneLease(leaseId, options) {
      calls.push(['complete', leaseId, options]);
      const lease = activeLeases.get(leaseId);
      assert.ok(lease);
      activeLeases.delete(leaseId);
      lease.status = options.completed === true
        ? 'completed'
        : 'completed-unsatisfied-fence';
      return {
        lease,
        gpuFence: {
          schema: 'peercompute.compute.gpu-fence-report.v0',
          status: options.status,
          method: options.method,
          fenceSatisfied: options.completed === true,
          laneId: lease.laneId,
          stateKey: lease.stateKey,
          queueCompletionStatus: options.queueCompletionStatus,
          queueCompletionMethod: options.queueCompletionMethod,
          retainedBufferRefs: [...options.retainedBufferRefs]
        }
      };
    },
    rejectGpuResidentLaneLease(leaseId, reason) {
      calls.push(['reject', leaseId, reason]);
      activeLeases.delete(leaseId);
      return { leaseId, reason };
    },
    commitDelta(delta) {
      calls.push(['commit', delta]);
      stateManager.commitDelta(delta);
    }
  };
  return { calls, computeManager, stateManager, activeLeases };
}

function terminalScheduleFence({
  scheduleId,
  laneId,
  stateKey,
  completedStepCount,
  method = 'worker-device.queue.onSubmittedWorkDone',
  fenceSatisfied = true,
  authorityAdmissionReady = fenceSatisfied,
  terminalRefluxReceipt = null
}) {
  return {
    status: fenceSatisfied ? 'gpu-fence-satisfied' : 'gpu-fence-unsatisfied',
    required: true,
    fenceSatisfied,
    scope: 'resident-schedule-terminal',
    terminalScheduleFence: true,
    authorityAdmissionReady,
    scheduleId,
    laneId,
    stateKey,
    completedStepCount,
    queueCompletionStatus: fenceSatisfied
      ? 'queue-work-completed'
      : 'queue-completion-error',
    queueCompletionMethod: method,
    ...(terminalRefluxReceipt ? { terminalRefluxReceipt } : {})
  };
}

function terminalRefluxScheduleReceipt({
  scheduleId,
  laneId,
  stateKey,
  stepCount,
  admitted = true
}) {
  return {
    schema: ULG_WORKER_RESIDENT_SCHEDULE_TERMINAL_REFLUX_RECEIPT_SCHEMA,
    status: admitted
      ? 'terminal-reflux-schedule-receipt-admitted'
      : 'terminal-reflux-receipt-rejected',
    required: true,
    scheduleId,
    laneId,
    stateKey,
    expectedStepCount: stepCount,
    observedStepCount: stepCount,
    admittedStepCount: admitted ? stepCount : Math.max(0, stepCount - 1),
    firstRejectedStepOrdinal: admitted ? null : Math.max(1, stepCount - 1),
    allStepsAdmitted: admitted
  };
}

test('worker hierarchy config freezes every executable switch, including false', () => {
  const enabled = createSchroederWorkerHierarchyConfig({
    selectedLevel: 1,
    baseGridSpacingM: 0.125,
    minLevel: 0,
    maxLevel: 1,
    tileCellCount: 8,
    spatialArenaCount: 4,
    enableTwoLevelMechanics: true,
    twoLevelMechanicsAuthority: 'authoritative',
    twoLevelFineSubstepCount: 4,
    enableMechanicsFieldPairV2: true,
    enablePortableSummary: true,
    enableActiveNodeIndex: true,
    enableActiveNodeSortedIndex: true,
    activeNodeSortedIndexPolicyMode: 'canonical-radix',
    lawNeighborTraversalPolicyMode: 'exact-near-cell-tree',
    lawNeighborCandidateReadbackMode: 'compact-terminal',
    enableLawQueue: true,
    enableLawNeighborCandidates: true,
    enableCrossLevelCoupling: true,
    enablePhaseVolumeMigration: true
  });
  assert.equal(enabled.schema, ULG_SCHROEDER_WORKER_HIERARCHY_CONFIG_SCHEMA);
  assert.equal(enabled.status, 'schroeder-worker-hierarchy-config-ready');
  assert.equal(Object.isFrozen(enabled), true);
  assert.equal(enabled.enableTwoLevelMechanics, true);
  assert.equal(enabled.twoLevelMechanicsAuthority, 'authoritative');
  assert.equal(enabled.twoLevelFineSubstepCount, 4);
  assert.equal(enabled.enableLawQueue, true);
  assert.equal(enabled.enableLawNeighborCandidates, true);
  assert.equal(enabled.enableCrossLevelCoupling, true);
  assert.equal(enabled.enablePhaseVolumeMigration, true);
  assert.deepEqual(structuredClone(enabled), { ...enabled });
  assert.equal(
    createSchroederWorkerHierarchyConfig({ ...enabled }).signature,
    enabled.signature,
    'the exact executable graph must have one deterministic lane signature'
  );

  const disabled = createSchroederWorkerHierarchyConfig({
    selectedLevel: 0,
    minLevel: 0,
    maxLevel: 0,
    enableTwoLevelMechanics: false,
    enableMechanicsFieldPairV2: false,
    enablePortableSummary: false,
    enableActiveNodeIndex: false,
    enableActiveNodeSortedIndex: false,
    enableLawQueue: false,
    enableLawNeighborCandidates: false,
    enableCrossLevelCoupling: false,
    enablePhaseVolumeMigration: false
  });
  for (const field of [
    'enableTwoLevelMechanics',
    'enableMechanicsFieldPairV2',
    'enablePortableSummary',
    'enableActiveNodeIndex',
    'enableActiveNodeSortedIndex',
    'enableLawQueue',
    'enableLawNeighborCandidates',
    'enableCrossLevelCoupling',
    'enablePhaseVolumeMigration'
  ]) {
    assert.equal(disabled[field], false, `${field} must cross the boundary as false`);
  }
  assert.notEqual(disabled.signature, enabled.signature);

  assert.throws(
    () => createSchroederWorkerHierarchyConfig({ minLevel: 2, maxLevel: 1 }),
    /minLevel/
  );
  assert.throws(
    () => createSchroederWorkerHierarchyConfig({
      selectedLevel: 2,
      minLevel: 0,
      maxLevel: 1
    }),
    /selectedLevel/
  );
  assert.throws(
    () => createSchroederWorkerHierarchyConfig({
      enableTwoLevelMechanics: true,
      twoLevelMechanicsAuthority: 'authoritative',
      twoLevelFineSubstepCount: 1
    }),
    /at least two fine substeps/
  );
  assert.throws(
    () => createSchroederWorkerHierarchyConfig({ twoLevelFineSubstepCount: 5 }),
    /expected an integer/
  );
});

test('worker-lane sequence contract exposes the hierarchy and presentation dependencies', () => {
  const contract = createSchroederWorkerLaneSequenceContract({
    laneId: 'lane:a',
    stateKey: 'state:a',
    stepCount: 16
  });
  assert.equal(contract.schema, ULG_SCHROEDER_WORKER_LANE_SEQUENCE_CONTRACT_SCHEMA);
  assert.equal(contract.authority, 'NodeKernel/ComputeManager/StateManager');
  assert.equal(contract.executionOwner, 'offscreen-presentation-worker');
  assert.equal(contract.stepCount, 16);
  assert.equal(contract.defaultEnabled, true);
  assert.deepEqual(
    contract.passDagStages.map((stage) => stage.id),
    ['schroederSpatialEpoch', 'schroederHierarchyMechanics', 'residentRenderCandidate']
  );
  assert.deepEqual(
    contract.passDagStages[1].dependsOn,
    ['schroederSpatialEpoch']
  );
  assert.deepEqual(
    contract.passDagStages[2].dependsOn,
    ['schroederHierarchyMechanics']
  );
});

test('seed upload budget counts each cloneable particle row family exactly once', () => {
  assert.equal(estimateSchroederWorkerLaneSeedUploadBytes({
    sphParticleState: {
      state: new Float32Array(8),
      thermo: new Float32Array(12),
      identity: new Uint32Array(4)
    },
    mlsMpmParticleState: { mechanics: new Float32Array(16) }
  }), (8 + 12 + 4 + 16) * 4);
});

test('resident step options cross the worker boundary without functions or page GPU resources', () => {
  const gpuBuffer = { destroy() {}, byteLength: 256 };
  const options = createSchroederWorkerResidentStepOptions({
    internalPressureScale: 0.75,
    stageMechanicsTraceEnabled: true,
    thermalMaterialTable: {
      rows: new Float32Array([1, 2, 3]),
      helper() {},
      deviceBuffer: gpuBuffer
    },
    thermalStepOptions: {
      conductionRate: 0.2,
      thermalResponseGraphUpload: { stateBuffer: gpuBuffer }
    },
    p2gRunner() {},
    device: { createCommandEncoder() {} }
  });
  assert.equal(options.internalPressureScale, 0.75);
  assert.equal(options.stageMechanicsTraceEnabled, true);
  assert.deepEqual([...options.thermalMaterialTable.rows], [1, 2, 3]);
  assert.equal(options.thermalMaterialTable.helper, undefined);
  assert.equal(options.thermalMaterialTable.deviceBuffer, undefined);
  assert.equal(options.thermalStepOptions.thermalResponseGraphUpload, undefined);
  assert.equal(options.p2gRunner, undefined);
  assert.doesNotThrow(() => structuredClone(options));
});

test('worker schedule is leased by ComputeManager and committed through StateManager', async () => {
  const fixture = authorityFixture();
  const result = await runSchroederWorkerLaneScheduleWithAuthority({
    computeManager: fixture.computeManager,
    stateManager: fixture.stateManager,
    laneId: 'lane:a',
    stateKey: 'state:a',
    scheduleId: 'schedule:1',
    stepCount: 16,
    seedRequired: true,
    seedUploadBytes: 4096,
    executeSchedule: async ({ lease, residentSequenceLaneContract }) => {
      assert.equal(lease.laneId, 'lane:a');
      assert.equal(residentSequenceLaneContract.stepCount, 16);
      return {
        schema: 'peercompute.ulg.worker-resident-schedule-result.v0',
        status: 'worker-resident-schedule-completed',
        scheduleId: 'schedule:1',
        laneId: 'lane:a',
        stateKey: 'state:a',
        completedStepCount: 16,
        retainedBufferRefs: ['worker:state', 'worker:thermo'],
        gpuFence: terminalScheduleFence({
          scheduleId: 'schedule:1',
          laneId: 'lane:a',
          stateKey: 'state:a',
          completedStepCount: 16,
          method: 'queue.onSubmittedWorkDone'
        })
      };
    }
  });
  assert.equal(result.status, 'state-manager-committed-worker-schedule');
  assert.equal(result.gpuFence.fenceSatisfied, true);
  assert.equal(
    result.computeManagerCompletion.schema,
    ULG_SCHROEDER_WORKER_LANE_COMPUTE_MANAGER_COMPLETION_SCHEMA
  );
  assert.equal(result.computeManagerCompletion.status, 'completed');
  assert.equal(
    result.computeManagerCompletion.leaseId,
    'lane:a:lease:test'
  );
  assert.equal(result.stateManagerCommit.accepted, true);
  assert.equal(result.stateManagerCommit.status, 'committed');
  assert.deepEqual(fixture.calls.map(([kind]) => kind), [
    'acquire',
    'complete',
    'commit'
  ]);
  assert.equal(fixture.calls[0][1].copyBudget.uploadBytes, 4096);
  assert.equal(fixture.calls[0][1].copyBudget.readbackBytes, 0);
  assert.equal(fixture.activeLeases.size, 0);
});

test('authoritative two-level schedules require an exact terminal reflux receipt before StateManager commit', async () => {
  const admitted = authorityFixture();
  const scheduleId = 'schedule:terminal-reflux';
  const laneId = 'lane:terminal-reflux';
  const stateKey = 'state:terminal-reflux';
  const stepCount = 3;
  const result = await runSchroederWorkerLaneScheduleWithAuthority({
    computeManager: admitted.computeManager,
    stateManager: admitted.stateManager,
    laneId,
    stateKey,
    scheduleId,
    stepCount,
    twoLevelTerminalRefluxReceiptRequired: true,
    executeSchedule: async ({
      twoLevelTerminalRefluxReceiptRequired
    }) => {
      assert.equal(twoLevelTerminalRefluxReceiptRequired, true);
      return {
        schema: 'peercompute.ulg.worker-resident-schedule-result.v0',
        status: 'worker-resident-schedule-completed',
        scheduleId,
        laneId,
        stateKey,
        completedStepCount: stepCount,
        retainedBufferRefs: ['worker:state'],
        gpuFence: terminalScheduleFence({
          scheduleId,
          laneId,
          stateKey,
          completedStepCount: stepCount,
          terminalRefluxReceipt: terminalRefluxScheduleReceipt({
            scheduleId,
            laneId,
            stateKey,
            stepCount
          })
        })
      };
    }
  });
  assert.equal(result.stateManagerCommit.accepted, true);
  assert.equal(
    admitted.calls[0][1].copyBudget.compactSummaryBytes,
    stepCount * 136 * Uint32Array.BYTES_PER_ELEMENT
  );
  assert.equal(admitted.calls[0][1].copyBudget.readbackBytes, 0);

  for (const [suffix, terminalRefluxReceipt] of [
    ['missing', null],
    ['rejected', terminalRefluxScheduleReceipt({
      scheduleId: `${scheduleId}:rejected`,
      laneId: `${laneId}:rejected`,
      stateKey: `${stateKey}:rejected`,
      stepCount,
      admitted: false
    })]
  ]) {
    const fixture = authorityFixture();
    const currentScheduleId = `${scheduleId}:${suffix}`;
    const currentLaneId = `${laneId}:${suffix}`;
    const currentStateKey = `${stateKey}:${suffix}`;
    await assert.rejects(
      runSchroederWorkerLaneScheduleWithAuthority({
        computeManager: fixture.computeManager,
        stateManager: fixture.stateManager,
        laneId: currentLaneId,
        stateKey: currentStateKey,
        scheduleId: currentScheduleId,
        stepCount,
        twoLevelTerminalRefluxReceiptRequired: true,
        executeSchedule: async () => ({
          status: 'worker-resident-schedule-completed',
          scheduleId: currentScheduleId,
          laneId: currentLaneId,
          stateKey: currentStateKey,
          completedStepCount: stepCount,
          gpuFence: terminalScheduleFence({
            scheduleId: currentScheduleId,
            laneId: currentLaneId,
            stateKey: currentStateKey,
            completedStepCount: stepCount,
            authorityAdmissionReady: true,
            terminalRefluxReceipt
          })
        })
      }),
      /terminal reflux receipt was not exactly admitted/
    );
    assert.deepEqual(fixture.calls.map(([kind]) => kind), [
      'acquire',
      'reject'
    ]);
  }
});

test('worker-device queue fence spelling is admitted and normalized for ComputeManager', async () => {
  const fixture = authorityFixture();
  const result = await runSchroederWorkerLaneScheduleWithAuthority({
    computeManager: fixture.computeManager,
    stateManager: fixture.stateManager,
    laneId: 'lane:worker-device-fence',
    stateKey: 'state:worker-device-fence',
    scheduleId: 'schedule:worker-device-fence',
    executeSchedule: async () => ({
      scheduleId: 'schedule:worker-device-fence',
      laneId: 'lane:worker-device-fence',
      stateKey: 'state:worker-device-fence',
      completedStepCount: 1,
      retainedBufferRefs: ['worker:state'],
      gpuFence: terminalScheduleFence({
        scheduleId: 'schedule:worker-device-fence',
        laneId: 'lane:worker-device-fence',
        stateKey: 'state:worker-device-fence',
        completedStepCount: 1
      })
    })
  });

  assert.equal(result.stateManagerCommit.accepted, true);
  assert.equal(
    fixture.calls.find(([kind]) => kind === 'complete')?.[2]?.queueCompletionMethod,
    'queue.onSubmittedWorkDone'
  );
});

test('a cancelled partial worker schedule commits exactly its terminally fenced steps', async () => {
  const fixture = authorityFixture();
  const result = await runSchroederWorkerLaneScheduleWithAuthority({
    computeManager: fixture.computeManager,
    stateManager: fixture.stateManager,
    laneId: 'lane:cancelled-partial',
    stateKey: 'state:cancelled-partial',
    scheduleId: 'schedule:cancelled-partial',
    stepCount: 3,
    executeSchedule: async () => ({
      schema: 'peercompute.ulg.worker-resident-schedule-result.v0',
      status: 'worker-resident-schedule-cancelled',
      scheduleId: 'schedule:cancelled-partial',
      laneId: 'lane:cancelled-partial',
      stateKey: 'state:cancelled-partial',
      completedStepCount: 1,
      cancelled: true,
      retainedBufferRefs: ['worker:state'],
      gpuFence: terminalScheduleFence({
        scheduleId: 'schedule:cancelled-partial',
        laneId: 'lane:cancelled-partial',
        stateKey: 'state:cancelled-partial',
        completedStepCount: 1
      })
    })
  });

  assert.equal(result.scheduleResult.cancelled, true);
  assert.equal(result.scheduleResult.completedStepCount, 1);
  assert.equal(result.stateManagerCommit.accepted, true);
  const committedDelta = fixture.calls.find(([kind]) => kind === 'commit')?.[1];
  assert.equal(
    committedDelta?.payload?.status,
    'worker-resident-schedule-cancelled'
  );
  assert.equal(committedDelta?.payload?.completedStepCount, 1);
  assert.equal(committedDelta?.payload?.gpuAuthoritativeState, true);
  assert.equal(
    committedDelta?.payload?.finalStep?.gpuAuthoritativeState,
    true
  );
  assert.deepEqual(fixture.calls.map(([kind]) => kind), [
    'acquire',
    'complete',
    'commit'
  ]);
});

test('worker schedule failure rejects the ComputeManager lease and never commits', async () => {
  const fixture = authorityFixture();
  await assert.rejects(
    runSchroederWorkerLaneScheduleWithAuthority({
      computeManager: fixture.computeManager,
      stateManager: fixture.stateManager,
      laneId: 'lane:b',
      stateKey: 'state:b',
      scheduleId: 'schedule:2',
      executeSchedule: async () => {
        throw new Error('worker exploded');
      }
    }),
    /worker exploded/
  );
  assert.deepEqual(fixture.calls.map(([kind]) => kind), ['acquire', 'reject']);
  assert.equal(fixture.activeLeases.size, 0);
});

test('non-terminal worker fences fail closed before StateManager commit', async () => {
  const fixture = authorityFixture();
  await assert.rejects(
    runSchroederWorkerLaneScheduleWithAuthority({
      computeManager: fixture.computeManager,
      stateManager: fixture.stateManager,
      laneId: 'lane:c',
      stateKey: 'state:c',
      scheduleId: 'schedule:3',
      executeSchedule: async () => ({
        scheduleId: 'schedule:3',
        laneId: 'lane:c',
        stateKey: 'state:c',
        completedStepCount: 1,
        gpuFence: {
          status: 'gpu-fence-satisfied',
          queueCompletionMethod: 'same-worker-webgpu-queue-in-order',
          fenceSatisfied: true
        }
      })
    }),
    /requires a terminal schedule fence attestation/
  );
  assert.deepEqual(fixture.calls.map(([kind]) => kind), ['acquire', 'reject']);
});

test('terminal worker fence identity mismatches fail closed before commit', async () => {
  const fixture = authorityFixture();
  await assert.rejects(
    runSchroederWorkerLaneScheduleWithAuthority({
      computeManager: fixture.computeManager,
      stateManager: fixture.stateManager,
      laneId: 'lane:mismatch',
      stateKey: 'state:mismatch',
      scheduleId: 'schedule:mismatch',
      executeSchedule: async () => ({
        scheduleId: 'schedule:mismatch',
        laneId: 'lane:mismatch',
        stateKey: 'state:mismatch',
        completedStepCount: 1,
        gpuFence: terminalScheduleFence({
          scheduleId: 'schedule:other',
          laneId: 'lane:mismatch',
          stateKey: 'state:mismatch',
          completedStepCount: 1
        })
      })
    }),
    /fence identity does not match/
  );
  assert.deepEqual(fixture.calls.map(([kind]) => kind), ['acquire', 'reject']);
});

test('unsatisfied terminal worker fences fail closed before commit', async () => {
  const fixture = authorityFixture();
  await assert.rejects(
    runSchroederWorkerLaneScheduleWithAuthority({
      computeManager: fixture.computeManager,
      stateManager: fixture.stateManager,
      laneId: 'lane:unsatisfied',
      stateKey: 'state:unsatisfied',
      scheduleId: 'schedule:unsatisfied',
      executeSchedule: async () => ({
        scheduleId: 'schedule:unsatisfied',
        laneId: 'lane:unsatisfied',
        stateKey: 'state:unsatisfied',
        completedStepCount: 1,
        gpuFence: terminalScheduleFence({
          scheduleId: 'schedule:unsatisfied',
          laneId: 'lane:unsatisfied',
          stateKey: 'state:unsatisfied',
          completedStepCount: 1,
          fenceSatisfied: false
        })
      })
    }),
    /GPU fence was not satisfied/
  );
  assert.deepEqual(fixture.calls.map(([kind]) => kind), ['acquire', 'reject']);
});

test('fractional and over-count worker results fail before authority commit', async () => {
  for (const [suffix, completedStepCount, fenceStepCount] of [
    ['fractional', 1.9, 1],
    ['over', 2, 2]
  ]) {
    const fixture = authorityFixture();
    const scheduleId = `schedule:${suffix}-count`;
    const laneId = `lane:${suffix}-count`;
    const stateKey = `state:${suffix}-count`;
    await assert.rejects(
      runSchroederWorkerLaneScheduleWithAuthority({
        computeManager: fixture.computeManager,
        stateManager: fixture.stateManager,
        laneId,
        stateKey,
        scheduleId,
        stepCount: 1,
        executeSchedule: async () => ({
          status: 'worker-resident-schedule-cancelled',
          scheduleId,
          laneId,
          stateKey,
          completedStepCount,
          gpuFence: terminalScheduleFence({
            scheduleId,
            laneId,
            stateKey,
            completedStepCount: fenceStepCount
          })
        })
      }),
      /completedStepCount is not an admissible exact integer/
    );
    assert.deepEqual(fixture.calls.map(([kind]) => kind), [
      'acquire',
      'reject'
    ]);
  }
});

test('worker schedule authority integrates with real PeerCompute managers', async (t) => {
  const computeUrl = new URL(
    '../../peercompute/peercompute/src/peercompute/computeManager/ComputeManager.js',
    import.meta.url
  );
  const stateUrl = new URL(
    '../../peercompute/peercompute/src/peercompute/stateManager/StateManager.js',
    import.meta.url
  );
  const { ComputeManager } = await import(computeUrl.href);
  const { StateManager } = await import(stateUrl.href);
  const computeManager = new ComputeManager({
    enableWorkers: false,
    gpuDeviceId: 'gpu-device:schroeder-worker-authority-test'
  });
  const stateManager = new StateManager(null, {
    docName: `schroeder-worker-authority-${Date.now()}`,
    enablePersistence: false,
    disableNetworkProvider: true,
    disableBroadcast: true,
    deltaNamespace: 'deltas'
  });
  await stateManager.initialize({
    nodeId: 'schroeder-worker-authority-test-node',
    topology: 'single-node',
    createdAt: Date.now()
  });
  t.after(() => stateManager.destroy?.());
  attachResidentStateManagerCommitBridge({ computeManager, stateManager });
  await computeManager.initialize();

  const result = await runSchroederWorkerLaneScheduleWithAuthority({
    computeManager,
    stateManager,
    laneId: 'lane:real-managers',
    stateKey: 'state:real-managers',
    scheduleId: 'schedule:real-managers',
    stepCount: 2,
    executeSchedule: async () => ({
      schema: 'peercompute.ulg.worker-resident-schedule-result.v0',
      status: 'worker-resident-schedule-completed',
      scheduleId: 'schedule:real-managers',
      laneId: 'lane:real-managers',
      stateKey: 'state:real-managers',
      completedStepCount: 2,
      retainedBufferRefs: ['worker:state'],
      gpuFence: terminalScheduleFence({
        scheduleId: 'schedule:real-managers',
        laneId: 'lane:real-managers',
        stateKey: 'state:real-managers',
        completedStepCount: 2,
        method: 'queue.onSubmittedWorkDone'
      })
    })
  });

  assert.equal(result.stateManagerCommit.accepted, true);
  assert.equal(result.gpuResidentLaneExecution.gpuFence.fenceSatisfied, true);
  const stats = computeManager.getStats();
  assert.equal(stats.gpuResidentLanes.activeLeaseCount, 0);
  assert.equal(stats.gpuResidentLanes.completedLeaseCount, 1);
});
