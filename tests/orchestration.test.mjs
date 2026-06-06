import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ArtifactCache } from '../src/runtime/ArtifactCache.js';
import { ChildWorkerLeaseManager } from '../src/runtime/ChildWorkerLeaseManager.js';
import { ComputeServiceRegistry } from '../src/runtime/ComputeServiceRegistry.js';
import { GpuBroker } from '../src/runtime/GpuBroker.js';

const REDUCED_MAGNETAR_FIDELITY_RUNTIME_SCOPE = Object.freeze({
  schema: 'ulg.magnetar.fidelity-runtime-scope.v0',
  fidelityTier: 'reduced-calibrated-runtime-fixture',
  runtimeScope: 'reduced-scalar-reference-contract',
  readinessClaim: 'integration-tolerance-gate-only',
  reducedCalibratedRuntimeFixture: true,
  hostRuntimeSmokeFixture: false,
  fullFidelityMagnetarSimulation: false,
  fullPhysicsValidation: false,
  excludedPhysics: [
    'charge-conserving-pic',
    'spectral-angular-radiation-transport',
    'gr-or-grmhd-spacetime-solve',
    'full-resistive-mhd-or-force-free-magnetosphere',
    'validated-production-magnetar-closure'
  ]
});

function createCalibratedReferenceInventory() {
  return [
    {
      id: 'magnetosphere-mhd-reference',
      family: 'magnetosphere-mhd',
      provider: 'moonlab',
      solverId: 'moonlab-analytic-dipole-field-v0',
      schema: 'moonlab.magnetar.calibrated-reference.v0',
      role: 'peercompute-scientific-tolerance-input',
      contractHash: 'sha256:f85763af06f271c414d55e29884ee7b0d5738a4a7ec9351493964b98f8d4e1ec',
      unitsHash: 'sha256:b9ef2d46ec5f2d0c1fb8a2866012e9340a67f188ebc8a579b93ce61e72f4b4a5',
      fieldMap: {
        radiusMeters: 'outputs.radialSamples[].radiusMeters',
        magneticFieldTesla: 'outputs.radialSamples[].magneticFieldTesla',
        normalizedField: 'outputs.radialSamples[].normalizedField'
      },
      fieldTolerances: {
        magneticFieldTeslaRel: 1e-12,
        normalizedFieldAbs: 1e-12
      },
      fieldObservedDeltas: {
        magneticFieldTeslaRel: 0,
        normalizedFieldAbs: 0
      },
      status: 'calibrated-reference-ready',
      ready: true,
      scientificCoverage: true,
      fidelityRuntimeScope: REDUCED_MAGNETAR_FIDELITY_RUNTIME_SCOPE,
      scope: 'analytic-dipole-magnetosphere-reference-not-full-mhd',
      validationStatus: 'pass',
      validation: { status: 'pass', evidence: ['Analytic dipole radial field reference.'] },
      blocker: null,
      blockers: []
    },
    {
      id: 'pic-kinetic-plasma-reference',
      family: 'pic-kinetic-plasma',
      provider: 'moonlab',
      solverId: 'moonlab-reduced-pic-kinetic-plasma-reference-v0',
      schema: 'moonlab.magnetar.calibrated-reference.v0',
      role: 'peercompute-scientific-tolerance-input',
      contractHash: 'sha256:68b239d81e8c3178b7964817528d583e2b84c47a31987d7607f59618cf7f00a1',
      unitsHash: 'sha256:1a42bc97970912101434b47cd0db6401af477b65c65d97c1d873889d54eb151b',
      fieldMap: { particleCount: 'peercompute.solar.picPlasmaPatch.particleCount' },
      fieldTolerances: { particleCountAbs: 0 },
      fieldObservedDeltas: { particleCountAbs: 0 },
      status: 'calibrated-reference-ready',
      ready: true,
      scientificCoverage: true,
      fidelityRuntimeScope: REDUCED_MAGNETAR_FIDELITY_RUNTIME_SCOPE,
      scope: 'supplied-calibrated-reference-contract',
      validationStatus: 'pass',
      validation: { status: 'pass', evidence: ['Reduced PIC scalar tolerance contract.'] },
      blocker: null,
      blockers: []
    },
    {
      id: 'radiation-transport-reference',
      family: 'radiation-transport',
      provider: 'moonlab',
      solverId: 'moonlab-reduced-grey-radiation-reference-v0',
      schema: 'moonlab.magnetar.calibrated-reference.v0',
      role: 'peercompute-scientific-tolerance-input',
      contractHash: 'sha256:521b40cbfb2fbd6c708b64f87b593f72d887af6dce6a4a6cbd8a717c75c97f6f',
      unitsHash: 'sha256:eac86c07adc0411e96d6e1ea282f4bd303c785fdff9cdfbb2d9083004f4d6ff2',
      fieldMap: { totalRadiationEnergy: 'peercompute.solar.radiationOpacity.totalRadiationEnergy' },
      fieldTolerances: { totalRadiationEnergyRel: 1e-6 },
      fieldObservedDeltas: { totalRadiationEnergyRel: 0 },
      status: 'calibrated-reference-ready',
      ready: true,
      scientificCoverage: true,
      fidelityRuntimeScope: REDUCED_MAGNETAR_FIDELITY_RUNTIME_SCOPE,
      scope: 'supplied-calibrated-reference-contract',
      validationStatus: 'pass',
      validation: { status: 'pass', evidence: ['Reduced grey-radiation scalar tolerance contract.'] },
      blocker: null,
      blockers: []
    },
    {
      id: 'relativistic-correction-reference',
      family: 'relativistic-correction',
      provider: 'moonlab',
      solverId: 'moonlab-reduced-post-newtonian-reference-v0',
      schema: 'moonlab.magnetar.calibrated-reference.v0',
      role: 'peercompute-scientific-tolerance-input',
      contractHash: 'sha256:a0ecf0be90480f842776d608a2504e7bd2ebb112b0cfcfdb5cc12b6bdfd14fd8',
      unitsHash: 'sha256:0f66c80a4432a9f187fbdf55c6bd75ce2f1f344702c940ffcaea4c96e44f7035',
      fieldMap: { meanLorentzFactor: 'peercompute.solar.relativity.meanLorentzFactor' },
      fieldTolerances: { meanLorentzFactorAbs: 1e-6 },
      fieldObservedDeltas: { meanLorentzFactorAbs: 0 },
      status: 'calibrated-reference-ready',
      ready: true,
      scientificCoverage: true,
      fidelityRuntimeScope: REDUCED_MAGNETAR_FIDELITY_RUNTIME_SCOPE,
      scope: 'supplied-calibrated-reference-contract',
      validationStatus: 'pass',
      validation: { status: 'pass', evidence: ['Reduced post-Newtonian scalar tolerance contract.'] },
      blocker: null,
      blockers: []
    }
  ];
}

function createMoonLabWebGpuParityScopeFixture() {
  return {
    schema: 'moonlab.webgpu.complex64-parity-scope.v0',
    status: 'scope-ready-backend-unavailable',
    contractReady: true,
    contractValidation: { valid: true },
    reducedFixtureOnly: true,
    backendAvailable: false,
    fullFidelityMagnetarSimulation: false,
    fullPhysicsValidation: false,
    blockers: [
      'browser-webgpu-adapter-unavailable',
      'native-webgpu-operation-coverage-not-yet-recorded',
      'browser-webgpu-kernel-parity-not-executed'
    ],
    webgpuParity: {
      executed: false,
      passed: false,
      maxProbabilityAbsDiff: null,
      tolerance: 0.00001,
      reason: 'browser WebGPU adapter unavailable'
    },
    browserKernelProbe: {
      schema: 'moonlab.webgpu.complex64-probability-kernel-probe.v0',
      probeKind: 'browser-webgpu-complex64-probability-kernel',
      kernel: 'compute_probabilities',
      executed: false,
      passed: false,
      coveredNativeOperations: [],
      fixtureResults: [],
      maxProbabilityAbsDiff: null,
      tolerance: 0.00001,
      reason: 'browser WebGPU adapter unavailable'
    },
    browserNativeOperationProbe: {
      schema: 'moonlab.webgpu.complex64-native-operation-probe.v0',
      probeKind: 'browser-webgpu-complex64-native-operation-probe',
      executed: false,
      passed: false,
      coveredNativeOperations: [],
      operationResults: [
        {
          operation: 'hadamard',
          executed: false,
          passed: false,
          covered: false,
          fixtureResults: [],
          maxAmplitudeAbsDiff: null,
          tolerance: 0.00001,
          blocker: 'native-operation-probe-not-executed',
          reason: 'browser WebGPU adapter unavailable'
        },
        {
          operation: 'pauli_x',
          executed: false,
          passed: false,
          covered: false,
          fixtureResults: [],
          maxAmplitudeAbsDiff: null,
          tolerance: 0.00001,
          blocker: 'native-operation-probe-not-executed',
          reason: 'browser WebGPU adapter unavailable'
        }
      ],
      maxAmplitudeAbsDiff: null,
      tolerance: 0.00001,
      reason: 'browser WebGPU adapter unavailable'
    },
    complex64Preflight: {
      mode: 'cpu-complex64-rounding-preflight',
      executed: true,
      passed: true,
      maxProbabilityAbsDiff: 2.980232227667301e-8,
      tolerance: 0.00001
    },
    fidelityRuntimeScope: {
      schema: 'ulg.magnetar.fidelity-runtime-scope.v0',
      fidelityTier: 'reduced-calibrated-runtime-fixture',
      runtimeScope: 'browser-webgpu-complex64-reduced-fixture-parity',
      readinessClaim: 'integration-tolerance-gate-only',
      reducedCalibratedRuntimeFixture: true,
      hostRuntimeSmokeFixture: true,
      fullFidelityMagnetarSimulation: false,
      fullPhysicsValidation: false
    }
  };
}

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
  assert.match(ref.uri, /^artifact:\/\/sha256:[0-9a-f]{64}$/);
  assert.match(ref.artifactHash, /^sha256:[0-9a-f]{64}$/);
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

test('artifact cache summarizes Eshkol magnetar descriptor closure metadata', async () => {
  const cache = new ArtifactCache();
  const ref = await cache.put({
    sourceService: 'eshkol',
    closureId: 'eshkol:magnetar-fixture',
    closureKind: 'magnetar-closure-descriptor-fixture',
    execution: {
      serviceWorkerSafe: true,
      entryExport: 'main',
      entrySignature: { parameters: ['i32', 'i32'], results: ['i32'] },
      hasStartSection: false,
      imports: Array.from({ length: 33 }, (_, index) => ({
        module: 'env',
        name: `import_${index}`,
        kind: index < 9 ? 'function' : 'global'
      })),
      exports: [{ name: 'main', kind: 'function' }],
      wasmMetadata: {
        functionCount: 41,
        types: [
          { parameters: [], results: [] },
          { parameters: ['i32', 'i32'], results: ['i32'] }
        ]
      },
      module: {
        url: 'magnetar-closure.wasm',
        sha256: 'sha256:38902bb4b3f5ed8abf513a4d739ff9ca99727696df271c3ff17127575785b947'
      }
    },
    validity: {
      requiresDynamicCode: false,
      requiresHostImports: true
    },
    runtime: {
      bundleManifest: {
        schema: 'eshkol.ulg.closure-bundle.v0',
        manualDeploy: {
          copyFiles: [
            'magnetar-closure.ulg.json',
            'magnetar-closure.wasm',
            'eshkol-host-imports.js',
            'schemas/ulg/closure_artifact.schema.json'
          ],
          preserveRelativeUrls: true
        },
        hostImports: {
          path: 'eshkol-host-imports.js',
          sha256: 'sha256:host',
          factory: 'createEshkolHostImportObject',
          global: 'EshkolHostImports',
          domFree: true
        }
      }
    },
    validation: {
      status: 'descriptor-only',
      validationMode: 'eshkol-static-magnetar-closure-descriptor',
      outputSemantics: {
        schema: 'eshkol.ulg.closure-output-semantics.v0',
        semanticRole: 'expected-output-smoke',
        semanticScope: 'smoke-fixture',
        scientificScope: 'none',
        entryExport: 'main',
        entryArgs: [0, 0],
        expectedEntryResult: 0,
        stdout: {
          encoding: 'utf-8',
          expectedText: '1048560\n10485441048528\n',
          sha256: 'sha256:34a23605b7cacbeb83ef3391ae049c0bbcf38651b552eb9630eeca2165ca5768',
          byteLength: 23
        },
        scientificValidation: false
      },
      closureDescriptor: {
        schema: 'eshkol.ulg.magnetar-closure-descriptor.v0',
        descriptorRole: 'magnetar-closure-contract-seed',
        entryExport: 'main',
        fixtureChecksum: 50,
        scientificValidation: false,
        tensorContract: {
          coordinateSystem: 'normalized-radial-cell',
          interpolation: 'reduced-fixture-table-contract',
          inputIds: ['magnetar-state-vector', 'closure-control-vector'],
          outputIds: ['magnetar-closure-update', 'closure-residual']
        },
        descriptorBinding: {
          schema: 'eshkol.ulg.magnetar-closure-descriptor-binding.v0',
          fidelityRuntimeScope: {
            schema: 'ulg.magnetar.fidelity-runtime-scope.v0',
            fidelityTier: 'host-runtime-smoke-fixture',
            runtimeScope: 'eshkol-host-runtime-smoke-fixture',
            readinessClaim: 'host-runtime-output-semantics-only',
            reducedCalibratedRuntimeFixture: false,
            hostRuntimeSmokeFixture: true,
            fullFidelityMagnetarSimulation: false,
            fullPhysicsValidation: false,
            excludedPhysics: [
              'charge-conserving-pic',
              'spectral-angular-radiation-transport',
              'gr-or-grmhd-spacetime-solve',
              'full-resistive-mhd-or-force-free-magnetosphere',
              'validated-production-magnetar-closure'
            ]
          },
          ulgInterpolationTable: {
            schema: 'eshkol.ulg.magnetar-closure-interpolation-table.v0',
            id: 'ulg:magnetar-radial-cell-interpolation-table:v0',
            status: 'computed-fixture',
            fixtureScope: 'reduced-smoke-fixture-not-magnetar-physics',
            scientificValidation: false,
            sampleCount: 4,
            sampleIds: [
              'moonlab:magnetosphere-mhd-reference',
              'moonlab:pic-kinetic-plasma-reference',
              'moonlab:radiation-transport-reference',
              'moonlab:relativistic-correction-reference'
            ],
            contentHash: 'sha256:82ca16463d7ffe1d170adb266be61c3959b22a6c352751e99f0f510738a14165',
            samples: [
              { id: 'moonlab:magnetosphere-mhd-reference' },
              { id: 'moonlab:pic-kinetic-plasma-reference' },
              { id: 'moonlab:radiation-transport-reference' },
              { id: 'moonlab:relativistic-correction-reference' }
            ]
          },
          closureTensorRuntimeContract: {
            schema: 'eshkol.ulg.magnetar-closure-tensor-runtime-contract.v0',
            contractId: 'eshkol:magnetar-closure-tensor-runtime-contract:v0',
            status: 'declared-fixture-contract',
            runtimeAbi: 'wasm32-unknown-unknown:eshkol-host-imports-smoke-v0',
            executionClaim: 'metadata-and-smoke-output-only',
            entryExport: 'main',
            tensorMemoryModel: 'host-managed-linear-f64',
            coordinateSystem: 'normalized-radial-cell',
            inputTensorIds: ['magnetar-state-vector', 'closure-control-vector'],
            outputTensorIds: ['magnetar-closure-update', 'closure-residual'],
            interpolationTable: {
              id: 'ulg:magnetar-radial-cell-interpolation-table:v0',
              schema: 'eshkol.ulg.magnetar-closure-interpolation-table.v0',
              contentHash: 'sha256:82ca16463d7ffe1d170adb266be61c3959b22a6c352751e99f0f510738a14165',
              sampleCount: 4
            },
            sampleShapeValidation: {
              schema: 'eshkol.ulg.tensor-sample-shape-validation.v0',
              status: 'pass',
              validatedSampleCount: 4,
              validatedInputTensorIds: ['magnetar-state-vector', 'closure-control-vector'],
              validatedOutputTensorIds: ['magnetar-closure-update', 'closure-residual'],
              scientificValidation: false
            },
            linearMemoryBinding: {
              schema: 'eshkol.ulg.tensor-linear-memory-binding.v0',
              bindingId: 'eshkol:magnetar-closure-linear-memory-binding:v0',
              status: 'host-layout-smoke-bound-not-consumed',
              runtimeStatus: 'host-layout-smoke-only',
              executionClaim: 'tensor-buffer-layout-only',
              entryExportConsumesOffsets: false,
              elementType: 'f64',
              elementByteLength: 8,
              alignmentBytes: 8,
              memoryImport: {
                module: 'env',
                name: '__linear_memory',
                baseOffset: 131072,
                totalByteLength: 168,
                minimumPages: 3,
                pageSizeBytes: 65536,
                byteOrder: 'little-endian'
              },
              tensors: [
                {
                  id: 'magnetar-state-vector',
                  direction: 'input',
                  dtype: 'f64',
                  layout: 'dense-row-major',
                  shape: [8],
                  byteOffset: 131072,
                  byteLength: 64,
                  elementOffset: 16384,
                  elementCount: 8,
                  consumedByEntryExport: false
                },
                {
                  id: 'closure-control-vector',
                  direction: 'input',
                  dtype: 'f64',
                  layout: 'dense-row-major',
                  shape: [4],
                  byteOffset: 131136,
                  byteLength: 32,
                  elementOffset: 16392,
                  elementCount: 4,
                  consumedByEntryExport: false
                },
                {
                  id: 'magnetar-closure-update',
                  direction: 'output',
                  dtype: 'f64',
                  layout: 'dense-row-major',
                  shape: [8],
                  byteOffset: 131168,
                  byteLength: 64,
                  elementOffset: 16396,
                  elementCount: 8,
                  consumedByEntryExport: false
                },
                {
                  id: 'closure-residual',
                  direction: 'output',
                  dtype: 'f64',
                  layout: 'dense-row-major',
                  shape: [1],
                  byteOffset: 131232,
                  byteLength: 8,
                  elementOffset: 16404,
                  elementCount: 1,
                  consumedByEntryExport: false
                }
              ],
              smokeBinding: {
                schema: 'eshkol.ulg.tensor-linear-memory-smoke-binding.v0',
                status: 'host-layout-smoke-passed',
                sampleSource: 'validation.closureDescriptor.descriptorBinding.ulgInterpolationTable.samples[0]',
                writeTensorIds: ['magnetar-state-vector', 'closure-control-vector'],
                readbackTensorIds: ['magnetar-state-vector', 'closure-control-vector'],
                outputTensorIds: ['magnetar-closure-update', 'closure-residual'],
                outputInitialization: 'host-smoke-only-not-entry-export-produced',
                scientificValidation: false
              },
              entryExportOffsetProbe: {
                schema: 'eshkol.ulg.tensor-entry-export-offset-probe.v0',
                status: 'abi-blocked',
                entryExport: 'main',
                entrySignature: {
                  parameters: ['i32', 'i32'],
                  results: ['i32']
                },
                attemptedEntryArgs: [
                  {
                    label: 'zero-runtime-entry-args',
                    args: [0, 0],
                    expectedEntryResult: 0
                  },
                  {
                    label: 'declared-input-byte-offsets',
                    args: [131072, 131136],
                    expectedEntryResult: 0
                  }
                ],
                entryExportConsumesOffsets: false,
                outputTensorsProducedByEntryExport: false,
                changedBytesInDeclaredTensorRange: 0,
                observedStdoutInvariantAcrossArgs: true,
                runtimeScope: 'deterministic-host-runtime-smoke-stubs',
                hostImportOptions: {
                  factory: 'createEshkolHostImportObject',
                  runtimeSmokeStubs: true,
                  stubScope: 'deterministic-instantiation-only'
                },
                blocker: 'main-export-accepts-two-i32-runtime-args-but-does-not-read-or-write-host-managed-tensor-offsets',
                scientificValidation: false,
                fullPhysicsValidation: false
              },
              scientificValidation: false,
              fullPhysicsValidation: false,
              fullFidelityMagnetarSimulation: false
            },
            contractHash: 'sha256:4d16bf10f236832da92974cd341bb40a533cb2fe7c7ceab67ff8f6758645c95f',
            runtimeStatus: 'declared-not-executed',
            scientificValidation: false,
            fullPhysicsValidation: false
          },
          productionHandlerBoundary: {
            schema: 'eshkol.ulg.production-handler-boundary.v0',
            handlerId: 'eshkol:magnetar-closure:main:v0',
            handlerKind: 'wasm-export-tensor-closure',
            dispatchSchema: 'peercompute.ulg.dispatch-service-handler-context.v0',
            status: 'declared-not-executed',
            handlerReady: false,
            runtimeExecution: false,
            entryExport: 'main',
            runtimeAbi: 'wasm32-unknown-unknown:eshkol-host-imports-smoke-v0',
            tensorMemoryModel: 'host-managed-linear-f64',
            inputTensorIds: ['magnetar-state-vector', 'closure-control-vector'],
            outputTensorIds: ['magnetar-closure-update', 'closure-residual'],
            moduleRef: {
              source: 'artifact.execution.module',
              contentAddressing: 'required',
              sha256Field: 'artifact.execution.module.sha256'
            },
            hostImports: {
              source: 'bundle.hostImports',
              required: true,
              factory: 'createEshkolHostImportObject'
            },
            allowedExecutionClaims: ['metadata-and-smoke-output-only'],
            blockers: [
              'production-magnetar-handler-not-implemented',
              'wasm-tensor-memory-binding-not-executed',
              'wasm-entry-export-does-not-consume-tensor-offsets',
              'wasm-main-export-offset-args-leave-declared-tensor-range-unchanged',
              'host-imports-require-runtime-smoke-stubs-for-magnetar-fixture',
              'full-physics-validation-not-run'
            ],
            tensorMemoryBinding: {
              source: 'validation.closureDescriptor.descriptorBinding.closureTensorRuntimeContract.linearMemoryBinding',
              status: 'host-layout-smoke-bound-not-consumed',
              executionClaim: 'tensor-buffer-layout-only',
              entryExportConsumesOffsets: false
            },
            derivativeStatus: 'declared-not-computed',
            scientificValidation: false,
            fullPhysicsValidation: false,
            fullFidelityMagnetarSimulation: false
          }
        },
        nextContractFields: [
          'ulgInterpolationTableId',
          'moonlabClosureSurfaceSampleIds',
          'peercomputeProductTopologyBinding'
        ]
      }
    }
  });
  const summary = await cache.getSummary(ref);
  assert.equal(summary.artifactKind, 'closure');
  assert.equal(summary.validationStatus, 'descriptor-only');
  assert.equal(summary.closureKind, 'magnetar-closure-descriptor-fixture');
  assert.equal(summary.closureModuleUrl, 'magnetar-closure.wasm');
  assert.equal(summary.closureServiceWorkerSafe, true);
  assert.equal(summary.closureRequiresDynamicCode, false);
  assert.equal(summary.closureImportCount, 33);
  assert.equal(summary.closureRuntimeFunctionImportCount, 9);
  assert.equal(summary.closureWasmFunctionCount, 41);
  assert.equal(summary.closureBundleCopyFileCount, 4);
  assert.equal(summary.closureBundlePreserveRelativeUrls, true);
  assert.equal(summary.closureDescriptorSchema, 'eshkol.ulg.magnetar-closure-descriptor.v0');
  assert.equal(summary.closureDescriptorReady, true);
  assert.equal(summary.closureDescriptorRole, 'magnetar-closure-contract-seed');
  assert.equal(summary.closureDescriptorEntryExport, 'main');
  assert.equal(summary.closureDescriptorFixtureChecksum, 50);
  assert.equal(summary.closureDescriptorScientificValidation, false);
  assert.deepEqual(summary.closureDescriptorFidelityRuntimeScope, {
    schema: 'ulg.magnetar.fidelity-runtime-scope.v0',
    fidelityTier: 'host-runtime-smoke-fixture',
    runtimeScope: 'eshkol-host-runtime-smoke-fixture',
    readinessClaim: 'host-runtime-output-semantics-only',
    reducedCalibratedRuntimeFixture: false,
    hostRuntimeSmokeFixture: true,
    fullFidelityMagnetarSimulation: false,
    fullPhysicsValidation: false,
    excludedPhysics: [
      'charge-conserving-pic',
      'spectral-angular-radiation-transport',
      'gr-or-grmhd-spacetime-solve',
      'full-resistive-mhd-or-force-free-magnetosphere',
      'validated-production-magnetar-closure'
    ]
  });
  assert.equal(summary.closureDescriptorCoordinateSystem, 'normalized-radial-cell');
  assert.equal(summary.closureDescriptorInterpolation, 'reduced-fixture-table-contract');
  assert.deepEqual(summary.closureDescriptorInputIds, ['magnetar-state-vector', 'closure-control-vector']);
  assert.deepEqual(summary.closureDescriptorOutputIds, ['magnetar-closure-update', 'closure-residual']);
  assert.deepEqual(summary.closureDescriptorNextContractFields, [
    'ulgInterpolationTableId',
    'moonlabClosureSurfaceSampleIds',
    'peercomputeProductTopologyBinding'
  ]);
  assert.equal(summary.closureInterpolationTableSchema, 'eshkol.ulg.magnetar-closure-interpolation-table.v0');
  assert.equal(summary.closureInterpolationTableId, 'ulg:magnetar-radial-cell-interpolation-table:v0');
  assert.equal(summary.closureInterpolationTableStatus, 'computed-fixture');
  assert.equal(summary.closureInterpolationTableFixtureScope, 'reduced-smoke-fixture-not-magnetar-physics');
  assert.equal(summary.closureInterpolationTableScientificValidation, false);
  assert.equal(summary.closureInterpolationTableSampleCount, 4);
  assert.equal(summary.closureInterpolationTablePayloadSampleCount, 4);
  assert.deepEqual(summary.closureInterpolationTableSampleIds, [
    'moonlab:magnetosphere-mhd-reference',
    'moonlab:pic-kinetic-plasma-reference',
    'moonlab:radiation-transport-reference',
    'moonlab:relativistic-correction-reference'
  ]);
  assert.equal(summary.closureInterpolationTableContentHash, 'sha256:82ca16463d7ffe1d170adb266be61c3959b22a6c352751e99f0f510738a14165');
  assert.equal(summary.closureTensorRuntimeContractSchema, 'eshkol.ulg.magnetar-closure-tensor-runtime-contract.v0');
  assert.equal(summary.closureTensorRuntimeContractId, 'eshkol:magnetar-closure-tensor-runtime-contract:v0');
  assert.equal(summary.closureTensorRuntimeContractStatus, 'declared-fixture-contract');
  assert.equal(summary.closureTensorRuntimeContractReady, true);
  assert.equal(summary.closureTensorRuntimeContractHash, 'sha256:4d16bf10f236832da92974cd341bb40a533cb2fe7c7ceab67ff8f6758645c95f');
  assert.equal(summary.closureTensorRuntimeRuntimeAbi, 'wasm32-unknown-unknown:eshkol-host-imports-smoke-v0');
  assert.equal(summary.closureTensorRuntimeExecutionClaim, 'metadata-and-smoke-output-only');
  assert.equal(summary.closureTensorRuntimeEntryExport, 'main');
  assert.equal(summary.closureTensorRuntimeMemoryModel, 'host-managed-linear-f64');
  assert.equal(summary.closureTensorRuntimeCoordinateSystem, 'normalized-radial-cell');
  assert.deepEqual(summary.closureTensorRuntimeInputTensorIds, ['magnetar-state-vector', 'closure-control-vector']);
  assert.deepEqual(summary.closureTensorRuntimeOutputTensorIds, ['magnetar-closure-update', 'closure-residual']);
  assert.equal(summary.closureTensorRuntimeInterpolationTableId, 'ulg:magnetar-radial-cell-interpolation-table:v0');
  assert.equal(summary.closureTensorRuntimeInterpolationTableContentHash, 'sha256:82ca16463d7ffe1d170adb266be61c3959b22a6c352751e99f0f510738a14165');
  assert.equal(summary.closureTensorRuntimeInterpolationTableSampleCount, 4);
  assert.equal(summary.closureTensorRuntimeSampleShapeValidationSchema, 'eshkol.ulg.tensor-sample-shape-validation.v0');
  assert.equal(summary.closureTensorRuntimeSampleShapeValidationStatus, 'pass');
  assert.equal(summary.closureTensorRuntimeSampleShapeValidatedSampleCount, 4);
  assert.equal(summary.closureTensorRuntimeScientificValidation, false);
  assert.equal(summary.closureTensorRuntimeFullPhysicsValidation, false);
  assert.equal(summary.closureTensorLinearMemoryBindingSchema, 'eshkol.ulg.tensor-linear-memory-binding.v0');
  assert.equal(summary.closureTensorLinearMemoryBindingId, 'eshkol:magnetar-closure-linear-memory-binding:v0');
  assert.equal(summary.closureTensorLinearMemoryBindingStatus, 'host-layout-smoke-bound-not-consumed');
  assert.equal(summary.closureTensorLinearMemoryBindingReady, true);
  assert.equal(summary.closureTensorLinearMemoryRuntimeStatus, 'host-layout-smoke-only');
  assert.equal(summary.closureTensorLinearMemoryExecutionClaim, 'tensor-buffer-layout-only');
  assert.equal(summary.closureTensorLinearMemoryElementType, 'f64');
  assert.equal(summary.closureTensorLinearMemoryElementByteLength, 8);
  assert.equal(summary.closureTensorLinearMemoryAlignmentBytes, 8);
  assert.equal(summary.closureTensorLinearMemoryEntryExportConsumesOffsets, false);
  assert.equal(summary.closureTensorLinearMemoryBaseOffset, 131072);
  assert.equal(summary.closureTensorLinearMemoryTotalByteLength, 168);
  assert.equal(summary.closureTensorLinearMemoryMinimumPages, 3);
  assert.equal(summary.closureTensorLinearMemoryTensorCount, 4);
  assert.deepEqual(summary.closureTensorLinearMemoryTensorIds, [
    'magnetar-state-vector',
    'closure-control-vector',
    'magnetar-closure-update',
    'closure-residual'
  ]);
  assert.deepEqual(summary.closureTensorLinearMemoryTensors.map((tensor) => tensor.byteOffset), [
    131072,
    131136,
    131168,
    131232
  ]);
  assert.deepEqual(summary.closureTensorLinearMemoryTensors.map((tensor) => tensor.byteLength), [
    64,
    32,
    64,
    8
  ]);
  assert.deepEqual(summary.closureTensorLinearMemoryTensors.map((tensor) => tensor.consumedByEntryExport), [
    false,
    false,
    false,
    false
  ]);
  assert.equal(summary.closureTensorLinearMemorySmokeBindingSchema, 'eshkol.ulg.tensor-linear-memory-smoke-binding.v0');
  assert.equal(summary.closureTensorLinearMemorySmokeBindingStatus, 'host-layout-smoke-passed');
  assert.equal(summary.closureTensorLinearMemorySmokeBindingOutputInitialization, 'host-smoke-only-not-entry-export-produced');
  assert.equal(summary.closureTensorEntryExportOffsetProbeSchema, 'eshkol.ulg.tensor-entry-export-offset-probe.v0');
  assert.equal(summary.closureTensorEntryExportOffsetProbeStatus, 'abi-blocked');
  assert.equal(summary.closureTensorEntryExportOffsetProbeEntryExport, 'main');
  assert.equal(summary.closureTensorEntryExportConsumesOffsets, false);
  assert.equal(summary.closureTensorEntryExportOutputTensorsProduced, false);
  assert.equal(summary.closureTensorEntryExportChangedBytesInDeclaredTensorRange, 0);
  assert.equal(summary.closureTensorEntryExportObservedStdoutInvariantAcrossArgs, true);
  assert.equal(
    summary.closureTensorEntryExportOffsetProbeBlocker,
    'main-export-accepts-two-i32-runtime-args-but-does-not-read-or-write-host-managed-tensor-offsets'
  );
  assert.equal(summary.closureProductionHandlerBoundarySchema, 'eshkol.ulg.production-handler-boundary.v0');
  assert.equal(summary.closureProductionHandlerBoundaryStatus, 'declared-not-executed');
  assert.equal(summary.closureProductionHandlerBoundaryDeclared, true);
  assert.equal(summary.closureProductionHandlerBoundaryHandlerId, 'eshkol:magnetar-closure:main:v0');
  assert.equal(summary.closureProductionHandlerBoundaryHandlerKind, 'wasm-export-tensor-closure');
  assert.equal(summary.closureProductionHandlerBoundaryDispatchSchema, 'peercompute.ulg.dispatch-service-handler-context.v0');
  assert.equal(summary.closureProductionHandlerReady, false);
  assert.equal(summary.closureProductionHandlerRuntimeExecution, false);
  assert.equal(summary.closureProductionHandlerEntryExport, 'main');
  assert.equal(summary.closureProductionHandlerRuntimeAbi, 'wasm32-unknown-unknown:eshkol-host-imports-smoke-v0');
  assert.equal(summary.closureProductionHandlerTensorMemoryModel, 'host-managed-linear-f64');
  assert.deepEqual(summary.closureProductionHandlerInputTensorIds, ['magnetar-state-vector', 'closure-control-vector']);
  assert.deepEqual(summary.closureProductionHandlerOutputTensorIds, ['magnetar-closure-update', 'closure-residual']);
  assert.equal(summary.closureProductionHandlerDerivativeStatus, 'declared-not-computed');
  assert.equal(summary.closureProductionHandlerScientificValidation, false);
  assert.equal(summary.closureProductionHandlerFullPhysicsValidation, false);
  assert.equal(summary.closureProductionHandlerFullFidelityMagnetarSimulation, false);
  assert.deepEqual(summary.closureProductionHandlerAllowedExecutionClaims, ['metadata-and-smoke-output-only']);
  assert.deepEqual(summary.closureProductionHandlerBoundaryBlockers, [
    'production-magnetar-handler-not-implemented',
    'wasm-tensor-memory-binding-not-executed',
    'wasm-entry-export-does-not-consume-tensor-offsets',
    'wasm-main-export-offset-args-leave-declared-tensor-range-unchanged',
    'host-imports-require-runtime-smoke-stubs-for-magnetar-fixture',
    'full-physics-validation-not-run'
  ]);
  assert.deepEqual(summary.closureProductionHandlerTensorMemoryBinding, {
    source: 'validation.closureDescriptor.descriptorBinding.closureTensorRuntimeContract.linearMemoryBinding',
    status: 'host-layout-smoke-bound-not-consumed',
    executionClaim: 'tensor-buffer-layout-only',
    entryExportConsumesOffsets: false
  });
  assert.equal(summary.closureOutputSemanticsSchema, 'eshkol.ulg.closure-output-semantics.v0');
  assert.equal(summary.closureOutputSemanticsReady, true);
  assert.equal(summary.closureOutputSemanticScope, 'smoke-fixture');
  assert.equal(summary.closureOutputScientificScope, 'none');
  assert.equal(summary.closureOutputScientificValidation, false);
  assert.equal(summary.closureOutputExpectedEntryExport, 'main');
  assert.deepEqual(summary.closureOutputExpectedEntryArgs, [0, 0]);
  assert.equal(summary.closureOutputExpectedEntryResult, 0);
  assert.equal(summary.closureOutputExpectedStdoutSha256, 'sha256:34a23605b7cacbeb83ef3391ae049c0bbcf38651b552eb9630eeca2165ca5768');
  assert.equal(summary.closureOutputExpectedStdoutByteLength, 23);
  assert.equal(summary.closureReady, true);
});

test('artifact cache summarizes MoonLab magnetar calibration metadata', async () => {
  const cache = new ArtifactCache();
  const calibratedReferenceInventory = createCalibratedReferenceInventory();
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
      references: calibratedReferenceInventory
    },
    parity: {
      schema: 'peercompute.ulg.quantum-response-parity.v0',
      status: 'pass',
      comparisons: [
        { mode: 'moonlab-wasm-core', status: 'pass' },
        { mode: 'moonlab-webgpu', status: 'unsupported' }
      ]
    },
    webGpuParityScope: createMoonLabWebGpuParityScopeFixture(),
    calibrationArtifacts: {
      magnetarDipoleIsing: {
        schema: 'peercompute.ulg.magnetar-dipole-ising-calibration.v0',
        validation: { status: 'pass' },
        parity: { status: 'pass', metrics: { maxEnergyDelta: 0 } },
        reference: magnetarReference,
        references: calibratedReferenceInventory,
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
  assert.equal(summary.moonlabWebGpuParityScopeSchema, 'moonlab.webgpu.complex64-parity-scope.v0');
  assert.equal(summary.moonlabWebGpuParityScopeStatus, 'scope-ready-backend-unavailable');
  assert.equal(summary.moonlabWebGpuParityScopeReady, true);
  assert.equal(summary.moonlabWebGpuParityScopeContractReady, true);
  assert.equal(summary.moonlabWebGpuParityScopeReducedFixtureOnly, true);
  assert.equal(summary.moonlabWebGpuParityScopeBackendAvailable, false);
  assert.equal(summary.moonlabWebGpuParityExecuted, false);
  assert.equal(summary.moonlabWebGpuParityPassed, false);
  assert.equal(summary.moonlabWebGpuParityMaxProbabilityAbsDiff, null);
  assert.equal(summary.moonlabWebGpuParityTolerance, 0.00001);
  assert.equal(summary.moonlabWebGpuProbabilityKernelProbeSchema, 'moonlab.webgpu.complex64-probability-kernel-probe.v0');
  assert.equal(summary.moonlabWebGpuProbabilityKernelProbeDeclared, true);
  assert.equal(summary.moonlabWebGpuProbabilityKernelProbeKind, 'browser-webgpu-complex64-probability-kernel');
  assert.equal(summary.moonlabWebGpuProbabilityKernel, 'compute_probabilities');
  assert.equal(summary.moonlabWebGpuProbabilityKernelExecuted, false);
  assert.equal(summary.moonlabWebGpuProbabilityKernelPassed, false);
  assert.deepEqual(summary.moonlabWebGpuProbabilityKernelCoveredNativeOperations, []);
  assert.equal(summary.moonlabWebGpuProbabilityKernelMaxProbabilityAbsDiff, null);
  assert.equal(summary.moonlabWebGpuProbabilityKernelTolerance, 0.00001);
  assert.equal(summary.moonlabWebGpuNativeOperationProbeSchema, 'moonlab.webgpu.complex64-native-operation-probe.v0');
  assert.equal(summary.moonlabWebGpuNativeOperationProbeDeclared, true);
  assert.equal(summary.moonlabWebGpuNativeOperationProbeKind, 'browser-webgpu-complex64-native-operation-probe');
  assert.equal(summary.moonlabWebGpuNativeOperationProbeExecuted, false);
  assert.equal(summary.moonlabWebGpuNativeOperationProbePassed, false);
  assert.deepEqual(summary.moonlabWebGpuNativeOperationCoveredOperations, []);
  assert.equal(summary.moonlabWebGpuNativeOperationProbeOperationCount, 2);
  assert.equal(summary.moonlabWebGpuNativeOperationProbeCoveredOperationCount, 0);
  assert.equal(summary.moonlabWebGpuNativeOperationProbeOperationResults[0].operation, 'hadamard');
  assert.equal(summary.moonlabWebGpuNativeOperationProbeOperationResults[0].executed, false);
  assert.equal(summary.moonlabWebGpuNativeOperationProbeOperationResults[0].passed, false);
  assert.equal(summary.moonlabWebGpuNativeOperationProbeOperationResults[0].covered, false);
  assert.equal(summary.moonlabWebGpuNativeOperationProbeOperationResults[0].blocker, 'native-operation-probe-not-executed');
  assert.equal(summary.moonlabWebGpuNativeOperationProbeOperationResults[1].operation, 'pauli_x');
  assert.equal(summary.moonlabWebGpuNativeOperationProbeOperationResults[1].executed, false);
  assert.equal(summary.moonlabWebGpuNativeOperationProbeOperationResults[1].passed, false);
  assert.equal(summary.moonlabWebGpuNativeOperationProbeOperationResults[1].covered, false);
  assert.equal(summary.moonlabWebGpuNativeOperationProbeOperationResults[1].blocker, 'native-operation-probe-not-executed');
  assert.equal(summary.moonlabWebGpuHadamardNativeOperationDeclared, true);
  assert.equal(summary.moonlabWebGpuHadamardNativeOperationExecuted, false);
  assert.equal(summary.moonlabWebGpuHadamardNativeOperationPassed, false);
  assert.equal(summary.moonlabWebGpuHadamardNativeOperationCovered, false);
  assert.equal(summary.moonlabWebGpuHadamardNativeOperationBlocker, 'native-operation-probe-not-executed');
  assert.equal(summary.moonlabWebGpuPauliXNativeOperationDeclared, true);
  assert.equal(summary.moonlabWebGpuPauliXNativeOperationExecuted, false);
  assert.equal(summary.moonlabWebGpuPauliXNativeOperationPassed, false);
  assert.equal(summary.moonlabWebGpuPauliXNativeOperationCovered, false);
  assert.equal(summary.moonlabWebGpuPauliXNativeOperationBlocker, 'native-operation-probe-not-executed');
  assert.equal(summary.moonlabComplex64PreflightPassed, true);
  assert.equal(summary.moonlabComplex64PreflightMaxProbabilityAbsDiff, 2.980232227667301e-8);
  assert.equal(summary.moonlabComplex64PreflightTolerance, 0.00001);
  assert.equal(summary.moonlabWebGpuParityScopeFullFidelityMagnetarSimulation, false);
  assert.equal(summary.moonlabWebGpuParityScopeFullPhysicsValidation, false);
  assert.equal(summary.moonlabWebGpuParityScopeFidelityRuntimeScope.runtimeScope, 'browser-webgpu-complex64-reduced-fixture-parity');
  assert.deepEqual(summary.moonlabWebGpuParityScopeBlockers, [
    'browser-webgpu-adapter-unavailable',
    'native-webgpu-operation-coverage-not-yet-recorded',
    'browser-webgpu-kernel-parity-not-executed'
  ]);
  assert.equal(summary.calibrationArtifactCount, 1);
  assert.equal(summary.calibrationReadyCount, 1);
  assert.equal(summary.outputReferenceCount, 5);
  assert.equal(summary.outputReferenceReadyCount, 5);
  assert.equal(summary.outputReferences[0].schema, 'moonlab.magnetar-dipole-ising-reference.v0');
  assert.equal(summary.outputReferences[0].contractHash, 'sha256:f85763af06f271c414d55e29884ee7b0d5738a4a7ec9351493964b98f8d4e1ec');
  assert.equal(summary.outputReferences[1].family, 'magnetosphere-mhd');
  assert.equal(summary.outputReferences[1].status, 'calibrated-reference-ready');
  assert.equal(summary.outputReferences[1].validationStatus, 'pass');
  assert.equal(summary.outputReferences[1].ready, true);
  assert.equal(summary.outputReferences[1].scientificCoverage, true);
  assert.deepEqual(summary.outputReferences[1].fidelityRuntimeScope, REDUCED_MAGNETAR_FIDELITY_RUNTIME_SCOPE);
  assert.equal(summary.outputReferences[1].solverId, 'moonlab-analytic-dipole-field-v0');
  assert.deepEqual(summary.outputReferences.slice(1).map((reference) => reference.ready), [
    true,
    true,
    true,
    true
  ]);
  assert.equal(summary.magnetarCalibratedReferenceCount, 4);
  assert.equal(summary.magnetarCalibratedReferenceReadyCount, 4);
  assert.equal(summary.magnetarCalibratedReferenceScientificCoverageCount, 4);
  assert.deepEqual(summary.magnetarCalibratedReferences.map((reference) => reference.family), [
    'magnetosphere-mhd',
    'pic-kinetic-plasma',
    'radiation-transport',
    'relativistic-correction'
  ]);
  assert.equal(summary.magnetarCalibratedReferences[0].blocker, null);
  assert.equal(summary.magnetarCalibratedReferences[0].fidelityRuntimeScope.fullFidelityMagnetarSimulation, false);
  assert.equal(summary.magnetarCalibratedReferences[0].fidelityRuntimeScope.fullPhysicsValidation, false);
  assert.equal(summary.calibrationArtifacts[0].referenceCount, 5);
  assert.equal(summary.calibrationArtifacts[0].referenceReadyCount, 5);
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
