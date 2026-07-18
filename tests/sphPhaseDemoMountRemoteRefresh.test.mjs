import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  ULG_MLS_MPM_GPU_RESIDENT_STEPS_EXECUTION_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import {
  SPH_PHASE_REBUILD_WORKER_STATUS_SCHEMA,
  SPH_RESIDENT_STAGE_ORDER_TRACE_SCHEMA,
  SPH_REMOTE_RESIDENT_TASK_GRAPH_REFRESH_SCHEMA,
  appendResidentStageOrderTrace,
  residentGpuContinuationEvidenceReady,
  runRemoteResidentTaskGraphRefreshPrelude,
  summarizeResidentStageOrderExecution,
  workerRebuildResetGate
} from '../src/visualization/sphPhaseDemoMount.js';

function retainedGpuContinuationExecution(overrides = {}) {
  return {
    schema: ULG_MLS_MPM_GPU_RESIDENT_STEPS_EXECUTION_SCHEMA,
    backend: 'webgpu',
    readbackMode: 'no-full-readback',
    continuationAvailable: true,
    nextSphParticleState: {
      schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount: 8
    },
    nextMlsMpmParticleState: {
      schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount: 8
    },
    nextParticleUploads: {
      sphParticleUpload: {
        schema: ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
        sourceSchema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
        status: 'webgpu-uploaded',
        particleCount: 8,
        stateBuffer: {},
        thermoBuffer: {}
      },
      mlsMpmParticleUpload: {
        schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
        sourceSchema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
        status: 'webgpu-uploaded',
        particleCount: 8,
        mechanicsBuffer: {}
      }
    },
    ...overrides
  };
}

test('resident GPU continuation accepts retained no-full-readback uploads', () => {
  assert.equal(
    residentGpuContinuationEvidenceReady(retainedGpuContinuationExecution()),
    true
  );
});

test('resident GPU continuation accepts compact conservation telemetry without a full particle readback', () => {
  assert.equal(
    residentGpuContinuationEvidenceReady(retainedGpuContinuationExecution({
      readbackMode: 'compact-grid-conservation-summary-readback',
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: true
    })),
    true
  );
});

test('resident GPU continuation fails closed for full readback or incomplete retained uploads', () => {
  assert.equal(
    residentGpuContinuationEvidenceReady(retainedGpuContinuationExecution({
      readbackMode: 'compact-grid-conservation-summary-readback',
      fullParticleReadbackPerformed: true,
      normalHotLoopReadbackFree: false
    })),
    false
  );
  assert.equal(
    residentGpuContinuationEvidenceReady(retainedGpuContinuationExecution({
      nextParticleUploads: {
        sphParticleUpload: {
          schema: ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
          sourceSchema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
          status: 'webgpu-uploaded',
          particleCount: 8,
          stateBuffer: {},
          thermoBuffer: {}
        },
        mlsMpmParticleUpload: {
          schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
          sourceSchema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
          status: 'webgpu-uploaded',
          particleCount: 8
        }
      }
    })),
    false
  );
});

test('resident GPU continuation rejects full readback claims while allowing compact telemetry', () => {
  assert.equal(
    residentGpuContinuationEvidenceReady(retainedGpuContinuationExecution({
      readbackMode: 'no-full-readback',
      fullParticleReadbackPerformed: true,
      normalHotLoopReadbackFree: false
    })),
    false
  );
  assert.equal(
    residentGpuContinuationEvidenceReady(retainedGpuContinuationExecution({
      readbackMode: 'no-full-readback',
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: false
    })),
    true
  );
  assert.equal(
    residentGpuContinuationEvidenceReady(retainedGpuContinuationExecution({
      readbackMode: 'no-full-readback',
      finalStep: {
        readbackMode: 'full-parity-readback'
      }
    })),
    false
  );
});

test('resident GPU continuation rejects non-canonical execution and particle schemas', () => {
  assert.equal(
    residentGpuContinuationEvidenceReady(retainedGpuContinuationExecution({
      schema: 'peercompute.ulg.mls-mpm-gpu-resident-steps-execution.future'
    })),
    false
  );
  assert.equal(
    residentGpuContinuationEvidenceReady(retainedGpuContinuationExecution({
      nextSphParticleState: {
        schema: 'peercompute.ulg.sph-gpu-particle-state.v0'
      }
    })),
    false
  );
  assert.equal(
    residentGpuContinuationEvidenceReady(retainedGpuContinuationExecution({
      nextMlsMpmParticleState: {
        schema: 'peercompute.ulg.mls-mpm-gpu-particle-state.v0'
      }
    })),
    false
  );
});

test('resident GPU continuation rejects destroyed or count-mismatched uploads', () => {
  const destroyed = retainedGpuContinuationExecution();
  destroyed.nextParticleUploads.sphParticleUpload.destroyed = true;
  assert.equal(residentGpuContinuationEvidenceReady(destroyed), false);

  const destroyedBuffer = retainedGpuContinuationExecution();
  destroyedBuffer.nextParticleUploads.mlsMpmParticleUpload.mechanicsBuffer.destroyed = true;
  assert.equal(residentGpuContinuationEvidenceReady(destroyedBuffer), false);

  const mismatchedUpload = retainedGpuContinuationExecution();
  mismatchedUpload.nextParticleUploads.mlsMpmParticleUpload.particleCount = 7;
  assert.equal(residentGpuContinuationEvidenceReady(mismatchedUpload), false);

  const mismatchedState = retainedGpuContinuationExecution();
  mismatchedState.nextMlsMpmParticleState.particleCount = 9;
  assert.equal(residentGpuContinuationEvidenceReady(mismatchedState), false);
});

test('remote resident task-graph refresh prelude is disabled by default', async () => {
  let factoryCalled = false;
  const report = await runRemoteResidentTaskGraphRefreshPrelude({
    graphFactory: () => {
      factoryCalled = true;
      return { id: 'should-not-run' };
    },
    host: {
      async submitTaskGraphWithRemoteSeedHotBufferRefresh() {
        throw new Error('disabled path submitted unexpectedly');
      }
    }
  });

  assert.equal(report.schema, SPH_REMOTE_RESIDENT_TASK_GRAPH_REFRESH_SCHEMA);
  assert.equal(report.status, 'disabled');
  assert.equal(report.enabled, false);
  assert.equal(report.submitted, false);
  assert.equal(report.refreshed, false);
  assert.equal(factoryCalled, false);
});

test('remote resident task-graph refresh prelude submits through the authority host when enabled', async () => {
  const calls = [];
  const context = {
    signature: 'resident-signature',
    stepCount: 2,
    readbackMode: 'no-full-readback'
  };
  const host = {
    async submitTaskGraphWithRemoteSeedHotBufferRefresh(graph, options) {
      calls.push({ graph, options });
      return {
        schema: 'peercompute.ulg.remote-task-graph-submit-refresh-report.v0',
        status: 'task-graph-submitted-remote-seed-hot-buffer-refreshed',
        remoteTaskGraphCacheArtifactPreflight: {
          status: 'admitted'
        },
        hotBufferRefresh: {
          status: 'refreshed-local-hot-buffers',
          hotBufferKey: 'ulg:sph-demo:test-hot-buffer',
          localRefs: [
            { refId: 'ulg-sph-particle-state', byteLength: 128 },
            { refId: 'ulg-sph-particle-thermo', byteLength: 64 }
          ]
        },
        seedPolicy: {
          status: 'local-refresh-required',
          disallowedStateFamilies: []
        }
      };
    }
  };

  const report = await runRemoteResidentTaskGraphRefreshPrelude({
    enabled: true,
    host,
    context,
    graphFactory: (input) => ({
      schema: 'peercompute.compute.task-graph.v0',
      id: `graph:${input.signature}`,
      taskCount: input.stepCount
    }),
    refreshOptions: ({ graph }) => ({
      cacheKey: `cache:${graph.id}`,
      device: { label: 'fake-webgpu-device' }
    })
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].graph.id, 'graph:resident-signature');
  assert.equal(calls[0].options.cacheKey, 'cache:graph:resident-signature');
  assert.equal(report.schema, SPH_REMOTE_RESIDENT_TASK_GRAPH_REFRESH_SCHEMA);
  assert.equal(report.status, 'task-graph-submitted-remote-seed-hot-buffer-refreshed');
  assert.equal(report.enabled, true);
  assert.equal(report.submitted, true);
  assert.equal(report.refreshed, true);
  assert.equal(report.graphId, 'graph:resident-signature');
  assert.equal(report.remoteCacheArtifactStatus, 'admitted');
  assert.equal(report.hotBufferRefreshStatus, 'refreshed-local-hot-buffers');
  assert.equal(report.hotBufferKey, 'ulg:sph-demo:test-hot-buffer');
  assert.equal(report.localRefCount, 2);
  assert.deepEqual(report.blockedStateFamilies, []);
});

test('remote resident task-graph refresh prelude reports missing authority wrapper without submitting', async () => {
  const report = await runRemoteResidentTaskGraphRefreshPrelude({
    enabled: true,
    host: {},
    graph: {
      schema: 'peercompute.compute.task-graph.v0',
      id: 'graph:missing-host'
    }
  });

  assert.equal(report.schema, SPH_REMOTE_RESIDENT_TASK_GRAPH_REFRESH_SCHEMA);
  assert.equal(report.status, 'unavailable-host-method-missing');
  assert.equal(report.enabled, true);
  assert.equal(report.submitted, false);
  assert.equal(report.refreshed, false);
});

test('remote resident task-graph refresh prelude keeps local resident execution available after errors', async () => {
  const report = await runRemoteResidentTaskGraphRefreshPrelude({
    enabled: true,
    host: {
      async submitTaskGraphWithRemoteSeedHotBufferRefresh() {
        throw new Error('remote refresh unavailable');
      }
    },
    graph: {
      schema: 'peercompute.compute.task-graph.v0',
      id: 'graph:error'
    }
  });

  assert.equal(report.schema, SPH_REMOTE_RESIDENT_TASK_GRAPH_REFRESH_SCHEMA);
  assert.equal(report.status, 'error-local-resident-continued');
  assert.equal(report.enabled, true);
  assert.equal(report.submitted, false);
  assert.equal(report.refreshed, false);
  assert.match(report.error, /remote refresh unavailable/);
});

test('worker rebuild reset gate invalidates stale in-flight rebuild generations', () => {
  const gate = workerRebuildResetGate({
    currentGeneration: 7,
    activeTask: {
      generation: 7,
      status: 'submitted',
      rootTaskId: 'old-worker-task'
    },
    reason: 'reset-button',
    nowMs: 123.5
  });

  assert.equal(gate.generation, 8);
  assert.equal(gate.activeWorkerRebuildTask, null);
  assert.equal(gate.workerStatus.schema, SPH_PHASE_REBUILD_WORKER_STATUS_SCHEMA);
  assert.equal(gate.workerStatus.status, 'cancelled-by-reset');
  assert.equal(gate.workerStatus.cancelledGeneration, 7);
  assert.equal(gate.workerStatus.generation, 8);
  assert.equal(gate.workerStatus.reason, 'reset-button');
  assert.equal(gate.workerStatus.previousStatus, 'submitted');
  assert.equal(gate.workerStatus.updatedAtMs, 123.5);
  assert.notEqual(7, gate.generation);
});

test('resident stage-order execution summary preserves authority and active-grid evidence', () => {
  const execution = {
    schema: 'peercompute.ulg.mls-mpm-gpu-resident-steps-execution.v0',
    status: 'resident-steps-executed',
    backend: 'webgpu',
    readbackMode: 'no-full-readback',
    stepCount: 2,
    completedStepCount: 2,
    continuationAvailable: true,
    normalHotLoopReadbackFree: true,
    finalStep: {
      status: 'resident-step-webgpu-executed',
      backend: 'webgpu',
      readbackMode: 'no-full-readback',
      sequenceIndex: 1,
      stageStatus: {
        p2g: 'p2g-complete',
        gridUpdate: 'grid-update-complete',
        g2p: 'g2p-complete'
      },
      stageBackends: {
        p2g: 'webgpu',
        gridUpdate: 'webgpu',
        g2p: 'webgpu'
      },
      stageTiming: {
        schema: 'peercompute.ulg.mls-mpm-stage-timing.v0',
        totalMs: 4.5,
        stageMs: { p2g: 1.2, gridUpdate: 0.8, g2p: 1.5 },
        compactSummaryScope: 'particle-visual',
        activeGridDispatch: {
          useActiveGrid: true,
          activeNodeCount: 42,
          gridNodeScanCount: 256,
          dispatchWorkgroups: 1,
          maxSpeedMPerS: 0.25,
          safetyCells: 2
        }
      },
      diagnostics: {
        particleCount: 64,
        gridNodeCount: 256,
        activeGridNodeCount: 42,
        activeGridNodeCountAvailable: true,
        maxDisplacementM: 0.0125,
        maxSpeedMPerS: 0.25,
        pressureInterfaceForceRowCount: 3
      },
      residentAuthorityFamilyOwners: {
        'particle-kinematics': {
          ownerStage: 'g2p',
          status: 'authoritative',
          mutationMode: 'retained-gpu-buffer',
          backend: 'webgpu',
          reads: ['grid-velocity'],
          writes: ['particle-state'],
          nextConsumers: ['render-field']
        }
      },
      residentBufferLeaseLedgerStatus: 'resident-buffer-leases-valid',
      residentBufferLeaseResourceCount: 4,
      residentBufferLeaseActiveLeaseCount: 3,
      nextParticleBufferMode: 'retained-g2p-output-buffers',
      nextParticleStateBufferByteLength: 2048,
      nextParticleMechanicsBufferByteLength: 8192
    }
  };

  const summary = summarizeResidentStageOrderExecution(execution);

  assert.equal(summary.available, true);
  assert.deepEqual(summary.stageOrder, ['p2g', 'gridUpdate', 'g2p']);
  assert.equal(summary.activeGridDispatch.activeGridNodeCount, 42);
  assert.equal(summary.activeGridDispatch.activeNodeCount, 42);
  assert.equal(summary.activeGridDispatch.dispatchNodeCount, 42);
  assert.equal(summary.diagnostics.maxDisplacementM, 0.0125);
  assert.equal(summary.residentAuthorityFamilyOwners['particle-kinematics'].ownerStage, 'g2p');
  assert.equal(summary.residentBufferLeaseLedgerStatus, 'resident-buffer-leases-valid');
  assert.equal(summary.nextParticleBufferMode, 'retained-g2p-output-buffers');
});

test('resident stage-order trace is capped and stores compact execution summaries', () => {
  let trace = appendResidentStageOrderTrace(null, {
    status: 'resident-reset-invalidated',
    reason: 'reset-button',
    generation: 3,
    updatedAtMs: 10
  }, { maxEvents: 2 });
  trace = appendResidentStageOrderTrace(trace, {
    status: 'resident-reset-particle-state-resynced',
    generation: 4,
    stepCount: 125,
    updatedAtMs: 20
  }, { maxEvents: 2 });
  trace = appendResidentStageOrderTrace(trace, {
    status: 'resident-execution-complete',
    generation: 4,
    scheduleToken: 7,
    stepCount: 2,
    readbackMode: 'no-full-readback',
    execution: {
      schema: 'peercompute.ulg.mls-mpm-gpu-resident-steps-execution.v0',
      status: 'resident-steps-executed',
      backend: 'webgpu',
      readbackMode: 'no-full-readback',
      completedStepCount: 2,
      finalStep: {
        stageStatus: { p2g: 'ok', gridUpdate: 'ok', g2p: 'ok' },
        diagnostics: { activeGridNodeCount: 12, maxDisplacementM: 0.01 }
      }
    },
    updatedAtMs: 30
  }, { maxEvents: 2 });

  assert.equal(trace.schema, SPH_RESIDENT_STAGE_ORDER_TRACE_SCHEMA);
  assert.equal(trace.eventCount, 3);
  assert.equal(trace.retainedEventCount, 2);
  assert.equal(trace.events[0].status, 'resident-reset-particle-state-resynced');
  assert.equal(trace.lastEvent.status, 'resident-execution-complete');
  assert.equal(trace.lastEvent.executionSummary.backend, 'webgpu');
  assert.equal(trace.lastEvent.executionSummary.diagnostics.activeGridNodeCount, 12);
});
