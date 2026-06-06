import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ArtifactCache } from '../src/runtime/ArtifactCache.js';
import { ChildWorkerLeaseManager } from '../src/runtime/ChildWorkerLeaseManager.js';
import { ComputeServiceRegistry } from '../src/runtime/ComputeServiceRegistry.js';
import { GpuBroker } from '../src/runtime/GpuBroker.js';

test('registry resolves services by task kind', async () => {
  const registry = new ComputeServiceRegistry();
  await registry.register({
    serviceId: 'eshkol',
    version: '0.5',
    runtime: 'js',
    entry: { workerModule: '/worker.js' },
    childWorkers: { allowed: true, maxChildren: 2, allowedModules: ['/child.js'], sameOriginOnly: true },
    resources: {},
    capabilities: ['ulg.closure.derive'],
    taskKinds: ['eshkol.closure.derive'],
    abi: { ulgIrVersion: '0.5', gpuAbiVersion: '0.5', supportedDTypes: ['f32'], supportedLayouts: ['soa'] },
    validation: { requiresCpuReference: true, toleranceProfile: 'demo', parityModes: [] }
  });
  assert.equal(registry.resolve('eshkol.closure.derive')[0].serviceId, 'eshkol');
});

test('child-worker leases enforce allowed modules and quotas', async () => {
  const leases = new ChildWorkerLeaseManager();
  const lease = await leases.request('root-a', {
    rootTaskId: 'task-a',
    module: '/child.js',
    workerType: 'classic',
    count: 2,
    allowed: true,
    maxChildren: 2,
    allowedModules: ['/child.js']
  });
  assert.equal(lease.count, 2);
  assert.equal(lease.workerType, 'classic');
  await assert.rejects(() => leases.request('root-a', {
    rootTaskId: 'task-a',
    module: '/child.js',
    count: 1,
    allowed: true,
    maxChildren: 2,
    allowedModules: ['/child.js']
  }), /quota exceeded/);
  await leases.revokeByRootTask('task-a');
  assert.equal(leases.list()[0].status, 'revoked');
});

test('GPU broker reports CPU fallback when WebGPU is unavailable', async () => {
  const broker = new GpuBroker({ navigatorRef: {} });
  const caps = await broker.probe();
  assert.equal(caps.supported, false);
  const lease = await broker.requestLease({ gpu: 'optional', priority: 'simulation', rootTaskId: 'task-a' });
  assert.equal(lease.status, 'fallback');
});

test('artifact cache returns content-addressed refs', async () => {
  const cache = new ArtifactCache();
  const ref = await cache.put({ sourceService: 'eshkol', closureKind: 'demo', value: 1 });
  assert.match(ref.uri, /^artifact:\/\/ulg:/);
  assert.equal((await cache.get(ref)).value, 1);
});
