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
  const ref = await cache.put({
    sourceService: 'eshkol',
    closureKind: 'wasm-reference',
    execution: {
      serviceWorkerSafe: true,
      module: { url: 'hello.wasm', sha256: 'sha256:abc' }
    },
    validity: {
      requiresDynamicCode: false,
      requiresHostImports: true
    },
    runtime: {
      bundleManifest: {
        schema: 'eshkol.ulg.closure-bundle.v0',
        copyFiles: ['hello.ulg.json', 'hello.wasm', 'schemas/ulg/closure_artifact.schema.json'],
        preserveRelativeUrls: true
      }
    },
    validation: { status: 'pass' },
    value: 1
  });
  assert.match(ref.uri, /^artifact:\/\/ulg:/);
  assert.equal((await cache.get(ref)).value, 1);
  const summary = await cache.getSummary(ref);
  assert.equal(summary.schema, 'peercompute.ulg.artifact-summary.v0');
  assert.equal(summary.artifactKind, 'closure');
  assert.equal(summary.closureKind, 'wasm-reference');
  assert.equal(summary.closureModuleUrl, 'hello.wasm');
  assert.equal(summary.closureServiceWorkerSafe, true);
  assert.equal(summary.closureRequiresDynamicCode, false);
  assert.equal(summary.closureRequiresHostImports, true);
  assert.equal(summary.closureBundlePreserveRelativeUrls, true);
  assert.equal(summary.closureBundleCopyFileCount, 3);
  assert.equal(summary.closureReady, true);
  assert.equal(cache.list()[0].artifactSummary.artifactKind, 'closure');
});

test('artifact cache summarizes MoonLab magnetar calibration metadata', async () => {
  const cache = new ArtifactCache();
  const ref = await cache.put({
    sourceService: 'moonlab',
    responseDescriptor: {
      schema: 'peercompute.ulg.quantum-response-descriptor.v0'
    },
    parity: {
      schema: 'peercompute.ulg.quantum-response-parity.v0',
      status: 'pass',
      comparisons: [
        { mode: 'moonlab-wasm-core', status: 'pass' },
        { mode: 'moonlab-webgpu', status: 'unsupported' }
      ]
    },
    calibrationArtifacts: {
      magnetarDipoleIsing: {
        schema: 'peercompute.ulg.magnetar-dipole-ising-calibration.v0',
        validation: { status: 'pass' },
        parity: { status: 'pass', metrics: { maxEnergyDelta: 0 } },
        summary: {
          groundState: { bitString: '000' },
          maxEnergyDelta: 0,
          evaluatedBitstrings: 8
        }
      }
    },
    validation: {
      status: 'pass'
    }
  });
  const summary = await cache.getSummary(ref);
  assert.equal(summary.schema, 'peercompute.ulg.artifact-summary.v0');
  assert.equal(summary.artifactKind, 'quantum-response');
  assert.equal(summary.validationStatus, 'pass');
  assert.equal(summary.parityReady, true);
  assert.equal(summary.unsupportedParityModeCount, 1);
  assert.deepEqual(summary.unsupportedParityModes, ['moonlab-webgpu']);
  assert.equal(summary.calibrationArtifactCount, 1);
  assert.equal(summary.calibrationReadyCount, 1);
  assert.equal(summary.magnetarDipoleIsingReady, true);
  assert.equal(summary.magnetarDipoleIsingGroundState, '000');
  assert.equal(summary.magnetarDipoleIsingMaxEnergyDelta, 0);
  assert.equal(summary.magnetarDipoleIsingEvaluatedBitstrings, 8);
});
