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
      entryExport: 'main',
      entrySignature: {
        parameters: ['i32', 'i32'],
        results: ['i32']
      },
      hasStartSection: false,
      startFunctionIndex: null,
      imports: [
        { module: 'env', name: 'memory', kind: 'memory' },
        { module: 'env', name: '__stack_pointer', kind: 'global' },
        { module: 'env', name: '__indirect_function_table', kind: 'table' },
        { module: 'env', name: 'eshkol_runtime_init', kind: 'function' },
        { module: 'env', name: 'fputc', kind: 'function' }
      ],
      exports: [
        { name: 'main', kind: 'function' }
      ],
      wasmMetadata: {
        functionCount: 18,
        hasStartSection: false,
        startFunctionIndex: null,
        types: [
          { parameters: [], results: [] },
          { parameters: ['i32', 'i32'], results: ['i32'] }
        ]
      },
      module: { url: 'hello.wasm', sha256: 'sha256:abc' }
    },
    validity: {
      requiresDynamicCode: false,
      requiresHostImports: true
    },
    runtime: {
      bundleManifest: {
        schema: 'eshkol.ulg.closure-bundle.v0',
        copyFiles: ['hello.ulg.json', 'hello.wasm', 'eshkol-host-imports.js', 'schemas/ulg/closure_artifact.schema.json'],
        hostImports: {
          path: 'eshkol-host-imports.js',
          sha256: 'sha256:host',
          factory: 'createEshkolHostImportObject',
          global: 'EshkolHostImports',
          domFree: true
        },
        preserveRelativeUrls: true
      }
    },
    validation: {
      status: 'pass',
      outputSemantics: {
        schema: 'eshkol.ulg.closure-output-semantics.v0',
        semanticScope: 'smoke-fixture',
        scientificScope: 'none',
        entryExport: 'main',
        entryArgs: [0, 0],
        expectedEntryResult: 0,
        stdout: {
          sha256: 'sha256:675d2e8686b6a85ffaa5751fba535c108d23ba941f1890d0a102619ec2cdf20d',
          byteLength: 16
        },
        scientificValidation: false
      }
    },
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
  assert.equal(summary.closureEntryExport, 'main');
  assert.deepEqual(summary.closureEntrySignature, {
    parameters: ['i32', 'i32'],
    results: ['i32']
  });
  assert.equal(summary.closureHasStartSection, false);
  assert.equal(summary.closureStartFunctionIndex, null);
  assert.equal(summary.closureImportCount, 5);
  assert.equal(summary.closureExportCount, 1);
  assert.equal(summary.closureRuntimeFunctionImportCount, 2);
  assert.equal(summary.closureRuntimeMemoryImportCount, 1);
  assert.equal(summary.closureRuntimeGlobalImportCount, 1);
  assert.equal(summary.closureRuntimeTableImportCount, 1);
  assert.equal(summary.closureWasmFunctionCount, 18);
  assert.equal(summary.closureWasmTypeCount, 2);
  assert.equal(summary.closureBundlePreserveRelativeUrls, true);
  assert.equal(summary.closureBundleCopyFileCount, 4);
  assert.equal(summary.closureHostImportsPath, 'eshkol-host-imports.js');
  assert.equal(summary.closureHostImportsFactory, 'createEshkolHostImportObject');
  assert.equal(summary.closureHostImportsDomFree, true);
  assert.equal(summary.closureOutputSemanticsSchema, 'eshkol.ulg.closure-output-semantics.v0');
  assert.equal(summary.closureOutputSemanticsReady, true);
  assert.equal(summary.closureOutputSemanticScope, 'smoke-fixture');
  assert.equal(summary.closureOutputScientificScope, 'none');
  assert.equal(summary.closureOutputScientificValidation, false);
  assert.equal(summary.closureOutputExpectedEntryExport, 'main');
  assert.deepEqual(summary.closureOutputExpectedEntryArgs, [0, 0]);
  assert.equal(summary.closureOutputExpectedEntryResult, 0);
  assert.equal(summary.closureOutputExpectedStdoutSha256, 'sha256:675d2e8686b6a85ffaa5751fba535c108d23ba941f1890d0a102619ec2cdf20d');
  assert.equal(summary.closureOutputExpectedStdoutByteLength, 16);
  assert.equal(summary.closureReady, true);
  assert.equal(cache.list()[0].artifactSummary.artifactKind, 'closure');
});

test('artifact cache summarizes MoonLab magnetar calibration metadata', async () => {
  const cache = new ArtifactCache();
  const magnetarReference = {
    schema: 'moonlab.magnetar-dipole-ising-reference.v0',
    role: 'peercompute-reference-tolerance-input',
    contractHash: 'sha256:f85763af06f271c414d55e29884ee7b0d5738a4a7ec9351493964b98f8d4e1ec',
    energyUnits: 'normalized-ising',
    observables: {
      groundState: {
        bitString: '000',
        referenceEnergy: -1.6712962962963
      }
    },
    tolerances: {
      energyAbs: 1e-9,
      maxObservedEnergyDelta: 0
    },
    validation: {
      parityPassed: true
    }
  };
  const ref = await cache.put({
    sourceService: 'moonlab',
    responseDescriptor: {
      schema: 'peercompute.ulg.quantum-response-descriptor.v0'
    },
    outputs: {
      reference: magnetarReference,
      references: [magnetarReference]
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
        reference: magnetarReference,
        summary: {
          groundState: { bitString: '000', referenceEnergy: -1.6712962962963, energyUnits: 'normalized-ising' },
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
  assert.equal(summary.outputReferenceCount, 1);
  assert.equal(summary.outputReferenceReadyCount, 1);
  assert.equal(summary.outputReferences[0].schema, 'moonlab.magnetar-dipole-ising-reference.v0');
  assert.equal(summary.outputReferences[0].contractHash, 'sha256:f85763af06f271c414d55e29884ee7b0d5738a4a7ec9351493964b98f8d4e1ec');
  assert.equal(summary.calibrationArtifacts[0].referenceCount, 1);
  assert.equal(summary.calibrationArtifacts[0].referenceReadyCount, 1);
  assert.equal(summary.magnetarDipoleIsingReady, true);
  assert.equal(summary.magnetarDipoleIsingGroundState, '000');
  assert.equal(summary.magnetarDipoleIsingMaxEnergyDelta, 0);
  assert.equal(summary.magnetarDipoleIsingEvaluatedBitstrings, 8);
  assert.equal(summary.magnetarReferenceReady, true);
  assert.equal(summary.magnetarReferenceSchema, 'moonlab.magnetar-dipole-ising-reference.v0');
  assert.equal(summary.magnetarReferenceRole, 'peercompute-reference-tolerance-input');
  assert.equal(summary.magnetarReferenceContractHash, 'sha256:f85763af06f271c414d55e29884ee7b0d5738a4a7ec9351493964b98f8d4e1ec');
  assert.equal(summary.magnetarReferenceEnergyUnits, 'normalized-ising');
  assert.equal(summary.magnetarReferenceGroundStateBitString, '000');
  assert.equal(summary.magnetarReferenceGroundStateEnergy, -1.6712962962963);
  assert.equal(summary.magnetarReferenceToleranceEnergyAbs, 1e-9);
  assert.equal(summary.magnetarReferenceMaxObservedEnergyDelta, 0);
  assert.equal(summary.magnetarReferenceValidationStatus, 'pass');
});

test('artifact cache summarizes MoonLab output reference arrays without calibration references', async () => {
  const cache = new ArtifactCache();
  const ref = await cache.put({
    sourceService: 'moonlab',
    responseDescriptor: {
      schema: 'peercompute.ulg.quantum-response-descriptor.v0'
    },
    outputs: {
      references: [{
        schema: 'moonlab.magnetar-dipole-ising-reference.v0',
        role: 'peercompute-reference-tolerance-input',
        contractHash: 'sha256:f85763af06f271c414d55e29884ee7b0d5738a4a7ec9351493964b98f8d4e1ec',
        energyUnits: 'normalized-ising',
        observables: {
          groundState: {
            bitString: '000',
            referenceEnergy: -1.6712962962963
          }
        },
        tolerances: {
          energyAbs: 1e-9,
          maxObservedEnergyDelta: 0
        },
        validation: {
          parityPassed: true
        }
      }]
    },
    parity: {
      schema: 'peercompute.ulg.quantum-response-parity.v0',
      status: 'pass',
      comparisons: []
    },
    calibrationArtifacts: {
      magnetarDipoleIsing: {
        schema: 'peercompute.ulg.magnetar-dipole-ising-calibration.v0',
        validation: { status: 'pass' },
        parity: { status: 'pass', metrics: { maxEnergyDelta: 0 } },
        summary: {
          groundState: { bitString: '000', referenceEnergy: -1.6712962962963, energyUnits: 'normalized-ising' },
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
  assert.equal(summary.outputReferenceCount, 1);
  assert.equal(summary.outputReferenceReadyCount, 1);
  assert.equal(summary.magnetarReferenceReady, true);
  assert.equal(summary.magnetarReferenceSchema, 'moonlab.magnetar-dipole-ising-reference.v0');
  assert.equal(summary.magnetarReferenceContractHash, 'sha256:f85763af06f271c414d55e29884ee7b0d5738a4a7ec9351493964b98f8d4e1ec');
  assert.equal(summary.magnetarReferenceEnergyUnits, 'normalized-ising');
  assert.equal(summary.magnetarReferenceGroundStateBitString, '000');
  assert.equal(summary.magnetarReferenceGroundStateEnergy, -1.6712962962963);
  assert.equal(summary.magnetarReferenceToleranceEnergyAbs, 1e-9);
  assert.equal(summary.magnetarReferenceMaxObservedEnergyDelta, 0);
  assert.equal(summary.magnetarReferenceValidationStatus, 'pass');
});
