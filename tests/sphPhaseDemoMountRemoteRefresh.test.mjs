import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  SPH_REMOTE_RESIDENT_TASK_GRAPH_REFRESH_SCHEMA,
  runRemoteResidentTaskGraphRefreshPrelude
} from '../src/visualization/sphPhaseDemoMount.js';

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
