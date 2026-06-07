import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ArtifactCache } from '../src/runtime/ArtifactCache.js';
import { ChildWorkerLeaseManager } from '../src/runtime/ChildWorkerLeaseManager.js';
import { ComputeServiceRegistry } from '../src/runtime/ComputeServiceRegistry.js';
import { GpuBroker } from '../src/runtime/GpuBroker.js';

const ESHKOL_PRODUCTION_REQUIRED_NON_STUB_IMPORTS = Object.freeze([
  'eshkol_is_bignum_tagged',
  'eshkol_rational_to_double',
  'eshkol_bignum_to_double',
  'eshkol_bignum_binary_tagged',
  'eshkol_is_rational_tagged_ptr',
  'eshkol_rational_binary_tagged_ptr',
  'eshkol_bignum_from_overflow',
  'arena_allocate',
  'arena_allocate_vector_with_header',
  'eshkol_shapes_equal',
  'arena_allocate_tensor_with_header',
  'eshkol_broadcast_elementwise_f64',
  'arena_allocate_ad_node_with_header',
  'arena_tape_add_node',
  'eshkol_make_exception_with_header',
  'eshkol_raise',
  'eshkol_intern_symbol_lookup',
  'arena_allocate_cons_with_header',
  'arena_tagged_cons_set_ptr',
  'arena_tagged_cons_set_int64',
  'arena_tagged_cons_set_double',
  'arena_tagged_cons_set_null',
  'eshkol_lambda_registry_add'
]);
const ESHKOL_PRODUCTION_READINESS_REQUIREMENTS = Object.freeze([
  'non-stub-host-runtime-imports',
  'validated-f64-tensor-memory-imports',
  'full-physics-validation-pass'
]);
const ESHKOL_PRODUCTION_BLOCKERS = Object.freeze([
  'full-physics-validation-not-run'
]);
const ESHKOL_PRODUCTION_HANDLER_CONTRACT_REQUIRED_EVIDENCE = Object.freeze([
  'content-addressed-wasm-module',
  'entry-export-main-signature-i32-i32-to-i32',
  'production-candidate-host-imports',
  'validated-f64-tensor-memory-binding',
  'production-candidate-runtime-probe',
  'production-magnetar-handler-implementation',
  'production-handler-runtime-execution',
  'full-physics-validation-pass'
]);
const ESHKOL_PRODUCTION_DISPATCH_CHECKS = Object.freeze([
  'artifact-module-sha256-matches-module-ref',
  'entry-export-main-signature-i32-i32-to-i32',
  'production-handler-contract-declared',
  'non-stub-host-imports-present',
  'f64-tensor-memory-binding-validated',
  'production-candidate-runtime-probe-passed',
  'runtime-smoke-stubs-rejected-for-production',
  'handler-ready-flag-true',
  'runtime-execution-flag-true',
  'full-physics-validation-evidence-present'
]);
const ESHKOL_PRODUCTION_DISPATCH_PASSED_CHECKS = Object.freeze([
  'artifact-module-sha256-matches-module-ref',
  'entry-export-main-signature-i32-i32-to-i32',
  'production-handler-contract-declared',
  'non-stub-host-imports-present',
  'f64-tensor-memory-binding-validated',
  'production-candidate-runtime-probe-passed',
  'runtime-smoke-stubs-rejected-for-production',
  'handler-ready-flag-true',
  'runtime-execution-flag-true'
]);
const ESHKOL_PRODUCTION_DISPATCH_BLOCKED_CHECKS = Object.freeze([
  'full-physics-validation-evidence-present'
]);
const ESHKOL_FULL_PHYSICS_RUNTIME_EVIDENCE_FAMILIES = Object.freeze([
  'magnetosphere-mhd',
  'pic-kinetic-plasma',
  'radiation-transport',
  'relativistic-correction',
  'cross-family-conservation-coupling'
]);
const ESHKOL_FULL_PHYSICS_RUNTIME_EVIDENCE_SCHEMAS = Object.freeze([
  'peercompute.multiscale.magnetosphere-mhd.runtime-validation.v0',
  'peercompute.multiscale.pic-kinetic-plasma.runtime-validation.v0',
  'peercompute.multiscale.radiation-transport.runtime-validation.v0',
  'peercompute.multiscale.relativistic-correction.runtime-validation.v0',
  'peercompute.multiscale.cross-family-conservation-coupling.runtime-validation.v0'
]);
const ESHKOL_FULL_PHYSICS_REQUIRED_HASH_FIELDS = Object.freeze([
  'referenceHash',
  'toleranceHash',
  'runtimeOutputHash',
  'evidenceHash'
]);

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
    status: 'scope-ready-backend-detected',
    contractReady: true,
    contractValidation: { valid: true },
    reducedFixtureOnly: true,
    backendAvailable: true,
    requireBackend: true,
    browserBackendPreflight: {
      schema: 'moonlab.webgpu.complex64-browser-backend-preflight.v0',
      probeKind: 'browser-webgpu-adapter-device-preflight',
      runtime: 'browser-harness',
      stage: 'device-acquired',
      navigatorGpuAvailable: true,
      adapterAvailable: true,
      deviceAcquired: true,
      reason: 'browser WebGPU adapter and device were acquired for reduced-fixture probe execution'
    },
    fullFidelityMagnetarSimulation: false,
    fullPhysicsValidation: false,
    blockers: [],
    webgpuParity: {
      executed: true,
      passed: true,
      maxProbabilityAbsDiff: 0,
      tolerance: 0.00001,
      reason: 'browser WebGPU probes covered all required reduced complex64 operations within tolerance; full runtime backend and full physics validation remain out of scope'
    },
    browserKernelProbe: {
      schema: 'moonlab.webgpu.complex64-probability-kernel-probe.v0',
      probeKind: 'browser-webgpu-complex64-probability-kernel',
      kernel: 'compute_probabilities',
      executed: true,
      passed: true,
      coveredNativeOperations: ['compute_probabilities'],
      fixtureResults: [{ fixtureId: 'bell-2q-hadamard-cnot-probabilities', passed: true, maxProbabilityAbsDiff: 0 }],
      maxProbabilityAbsDiff: 0,
      tolerance: 0.00001,
      reason: 'browser WebGPU compute_probabilities kernel matched reduced complex64 fixture probabilities'
    },
    browserNativeOperationProbe: {
      schema: 'moonlab.webgpu.complex64-native-operation-probe.v0',
      probeKind: 'browser-webgpu-complex64-native-operation-probe',
      executed: true,
      passed: true,
      coveredNativeOperations: ['hadamard', 'pauli_x', 'pauli_z', 'cnot'],
      operationResults: [
        {
          operation: 'hadamard',
          executed: true,
          passed: true,
          covered: true,
          fixtureResults: [{ fixtureId: 'hadamard-1q-zero-state-amplitudes', passed: true }],
          maxAmplitudeAbsDiff: 2.9802322387695312e-8,
          tolerance: 0.00001,
          reason: 'browser WebGPU native hadamard operation kernel matched reduced complex64 fixture amplitudes'
        },
        {
          operation: 'pauli_x',
          executed: true,
          passed: true,
          covered: true,
          fixtureResults: [{ fixtureId: 'pauli-x-1q-zero-state-amplitudes', passed: true }],
          maxAmplitudeAbsDiff: 0,
          tolerance: 0.00001,
          reason: 'browser WebGPU native pauli_x operation kernel matched reduced complex64 fixture amplitudes'
        },
        {
          operation: 'pauli_z',
          executed: true,
          passed: true,
          covered: true,
          fixtureResults: [{ fixtureId: 'pauli-z-1q-one-state-amplitudes', passed: true }],
          maxAmplitudeAbsDiff: 0,
          tolerance: 0.00001,
          reason: 'browser WebGPU native pauli_z operation kernel matched reduced complex64 fixture amplitudes'
        },
        {
          operation: 'cnot',
          executed: true,
          passed: true,
          covered: true,
          fixtureResults: [{ fixtureId: 'cnot-2q-bell-basis-amplitudes', passed: true }],
          maxAmplitudeAbsDiff: 0,
          tolerance: 0.00001,
          reason: 'browser WebGPU native cnot operation kernel matched reduced complex64 fixture amplitudes'
        }
      ],
      maxAmplitudeAbsDiff: 2.9802322387695312e-8,
      tolerance: 0.00001,
      reason: 'browser WebGPU native operation kernels matched reduced complex64 fixture amplitudes'
    },
    coverage: {
      nativeWebGpu: [
        { operation: 'hadamard', covered: true, required: true, fallbackAllowed: false, status: 'covered-by-browser-webgpu' },
        { operation: 'pauli_x', covered: true, required: true, fallbackAllowed: false, status: 'covered-by-browser-webgpu' },
        { operation: 'pauli_z', covered: true, required: true, fallbackAllowed: false, status: 'covered-by-browser-webgpu' },
        { operation: 'cnot', covered: true, required: true, fallbackAllowed: false, status: 'covered-by-browser-webgpu' },
        { operation: 'compute_probabilities', covered: true, required: true, fallbackAllowed: false, status: 'covered-by-browser-webgpu' }
      ],
      cpuFallbackExcluded: [
        {
          operation: 'phase',
          fallbackAllowed: true,
          excludedFromNativeCoverage: true,
          status: 'cpu-fallback-excluded-from-native-parity'
        }
      ]
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

function createMoonLabWebGpuParityHandoffSummaryFixture() {
  return {
    schema: 'moonlab.webgpu.complex64-parity-handoff-summary.v0',
    sourceSchema: 'moonlab.webgpu.complex64-parity-scope.v0',
    artifactKind: 'browser-webgpu-complex64-parity-handoff-summary',
    status: 'scope-ready-backend-detected',
    generatedAt: '2026-06-07T04:20:00.000Z',
    backendAvailable: true,
    requireBackend: true,
    contractValidationValid: true,
    reducedFixtureOnly: true,
    reducedFixtureWebGpuParityReady: true,
    runtimeBackendReady: false,
    readinessClaim: 'integration-tolerance-gate-only',
    fullFidelityMagnetarSimulation: false,
    fullPhysicsValidation: false,
    backendPreflight: {
      schema: 'moonlab.webgpu.complex64-browser-backend-preflight.v0',
      runtime: 'browser-harness',
      stage: 'device-acquired',
      navigatorGpuAvailable: true,
      adapterAvailable: true,
      deviceAcquired: true
    },
    nativeCoverage: {
      required: ['hadamard', 'pauli_x', 'pauli_z', 'cnot', 'compute_probabilities'],
      covered: ['hadamard', 'pauli_x', 'pauli_z', 'cnot', 'compute_probabilities'],
      missing: [],
      excluded: ['phase']
    },
    webgpuParity: {
      executed: true,
      passed: true,
      maxProbabilityAbsDiff: 0,
      tolerance: 0.00001
    },
    probes: {
      probabilityKernel: {
        executed: true,
        passed: true,
        coveredNativeOperations: ['compute_probabilities'],
        maxProbabilityAbsDiff: 0,
        tolerance: 0.00001
      },
      nativeOperations: {
        executed: true,
        passed: true,
        coveredNativeOperations: ['hadamard', 'pauli_x', 'pauli_z', 'cnot'],
        maxAmplitudeAbsDiff: 2.9802322387695312e-8,
        tolerance: 0.00001
      }
    },
    blockers: [],
    validationErrors: []
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
      assetProbe: {
        assets: [
          { kind: 'hostImportsModule', url: '/service-assets/eshkol/closures/hello/eshkol-host-imports.js', status: 'ready' }
        ]
      },
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
      },
      hostImportsFactory: {
        status: 'ready',
        module: '/service-assets/eshkol/closures/hello/eshkol-host-imports.js',
        factoryReady: true,
        requirementsSchema: 'eshkol.ulg.production-host-import-candidate.v0',
        requirementsStatus: 'production-candidate-runtime-imports-implemented',
        runtimeScope: 'production-candidate-host-imports',
        implementationStatus: 'production-candidate-runtime-imports-present',
        requiredNonStubImportCount: 23
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
  assert.equal(summary.closureHostImportsModule, '/service-assets/eshkol/closures/hello/eshkol-host-imports.js');
  assert.equal(summary.closureHostImportsAssetStatus, 'ready');
  assert.equal(summary.closureHostImportsFactoryStatus, 'ready');
  assert.equal(summary.closureHostImportsFactoryReady, true);
  assert.equal(summary.closureHostImportsRequirementsSchema, 'eshkol.ulg.production-host-import-candidate.v0');
  assert.equal(summary.closureHostImportsRequirementsStatus, 'production-candidate-runtime-imports-implemented');
  assert.equal(summary.closureHostImportsRuntimeScope, 'production-candidate-host-imports');
  assert.equal(summary.closureHostImportsImplementationStatus, 'production-candidate-runtime-imports-present');
  assert.equal(summary.closureHostImportsRequiredNonStubImportCount, 23);
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
      imports: Array.from({ length: 32 }, (_, index) => ({
        module: 'env',
        name: `import_${index}`,
        kind: index < 29 ? 'function' : (index === 29 ? 'memory' : (index === 30 ? 'global' : 'table'))
      })),
      exports: [
        { name: 'scheme_main', kind: 'function' },
        { name: 'main', kind: 'function' }
      ],
      wasmMetadata: {
        functionCount: 42,
        types: Array.from({ length: 111 }, (_, index) => (
          index === 0
            ? { parameters: ['i32', 'i32'], results: ['i32'] }
            : { parameters: [], results: [] }
        ))
      },
      module: {
        url: 'magnetar-closure.wasm',
        sha256: 'sha256:e0a3c7d280678a8c1e40865daeab6601dc8a6a64cfa5b29b7b6bfcaddc86c5aa'
      }
    },
    validity: {
      requiresDynamicCode: false,
      requiresHostImports: true
    },
    runtime: {
      assetProbe: {
        assets: [
          {
            kind: 'hostImportsModule',
            url: '/service-assets/eshkol/closures/magnetar-closure/eshkol-host-imports.js',
            status: 'ready'
          }
        ]
      },
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
      },
      hostImportsFactory: {
        status: 'ready',
        module: '/service-assets/eshkol/closures/magnetar-closure/eshkol-host-imports.js',
        factoryReady: true,
        requirementsSchema: 'eshkol.ulg.production-host-import-candidate.v0',
        requirementsStatus: 'production-candidate-runtime-imports-implemented',
        runtimeScope: 'production-candidate-host-imports',
        implementationStatus: 'production-candidate-runtime-imports-present',
        requiredNonStubImportCount: 23
      }
    },
    validation: {
      status: 'runtime-smoke',
      validationMode: 'eshkol-deterministic-magnetar-tensor-abi-smoke',
      outputSemantics: {
        schema: 'eshkol.ulg.closure-output-semantics.v0',
        semanticRole: 'expected-output-smoke',
        semanticScope: 'smoke-fixture',
        scientificScope: 'none',
        entryExport: 'main',
        entryArgs: [131072, 131136],
        expectedEntryResult: 0,
        stdout: {
          encoding: 'utf-8',
          expectedText: '',
          sha256: 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          byteLength: 0
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
            runtimeAbi: 'wasm32-unknown-unknown:eshkol-host-imports-production-candidate-v0',
            executionClaim: 'deterministic-tensor-runtime-smoke-only',
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
              status: 'entry-export-runtime-smoke-passed',
              runtimeStatus: 'deterministic-host-runtime-smoke-executed',
              executionClaim: 'deterministic-tensor-runtime-smoke-only',
              entryExportConsumesOffsets: true,
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
                  consumedByEntryExport: true
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
                  consumedByEntryExport: true
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
                  consumedByEntryExport: true
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
                  consumedByEntryExport: true
                }
              ],
              smokeBinding: {
                schema: 'eshkol.ulg.tensor-linear-memory-smoke-binding.v0',
                status: 'entry-export-runtime-smoke-passed',
                sampleSource: 'validation.closureDescriptor.descriptorBinding.ulgInterpolationTable.samples[0]',
                writeTensorIds: ['magnetar-state-vector', 'closure-control-vector'],
                readbackTensorIds: ['magnetar-state-vector', 'closure-control-vector'],
                outputTensorIds: ['magnetar-closure-update', 'closure-residual'],
                entryExportConsumesOffsets: true,
                outputInitialization: 'entry-export-produced',
                scientificValidation: false
              },
              entryExportOffsetProbe: {
                schema: 'eshkol.ulg.tensor-entry-export-offset-probe.v0',
                status: 'runtime-smoke-passed',
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
                entryExportConsumesOffsets: true,
                outputTensorsProducedByEntryExport: true,
                changedBytesInDeclaredTensorRange: 64,
                observedStdoutInvariantAcrossArgs: false,
                runtimeScope: 'deterministic-host-runtime-smoke-stubs',
                hostImportOptions: {
                  factory: 'createEshkolHostImportObject',
                  runtimeSmokeStubs: true,
                  f64TensorMemoryImports: true,
                  stubScope: 'deterministic-f64-linear-memory-smoke'
                },
                blocker: 'none-for-deterministic-runtime-smoke-production-physics-unvalidated',
                scientificValidation: false,
                fullPhysicsValidation: false
              },
              scientificValidation: false,
              fullPhysicsValidation: false,
              fullFidelityMagnetarSimulation: false
            },
            contractHash: 'sha256:2289b8c8068f1a033cda20f09f30a33f2e41588b8ee2ccd1143100f2fe87dd64',
            runtimeStatus: 'deterministic-runtime-smoke-executed',
            scientificValidation: false,
            fullPhysicsValidation: false
          },
          productionHandlerBoundary: {
            schema: 'eshkol.ulg.production-handler-boundary.v0',
            handlerId: 'eshkol:magnetar-closure:main:v0',
            handlerKind: 'wasm-export-tensor-closure',
            dispatchSchema: 'peercompute.ulg.dispatch-service-handler-context.v0',
            status: 'production-handler-runtime-smoke-executed',
            handlerReady: true,
            runtimeExecution: true,
            entryExport: 'main',
            runtimeAbi: 'wasm32-unknown-unknown:eshkol-host-imports-production-candidate-v0',
            tensorMemoryModel: 'host-managed-linear-f64',
            inputTensorIds: ['magnetar-state-vector', 'closure-control-vector'],
            outputTensorIds: ['magnetar-closure-update', 'closure-residual'],
            moduleRef: {
              source: 'artifact.execution.module',
              contentAddressing: 'required',
              sha256Field: 'artifact.execution.module.sha256'
            },
            productionHandlerContract: {
              schema: 'eshkol.ulg.production-handler-contract.v0',
              status: 'implemented-runtime-smoke-pending-full-physics',
              handlerId: 'eshkol:magnetar-closure:main:v0',
              dispatchSchema: 'peercompute.ulg.dispatch-service-handler-context.v0',
              entryExport: 'main',
              runtimeAbi: 'wasm32-unknown-unknown:eshkol-host-imports-production-candidate-v0',
              tensorMemoryModel: 'host-managed-linear-f64',
              inputTensorIds: ['magnetar-state-vector', 'closure-control-vector'],
              outputTensorIds: ['magnetar-closure-update', 'closure-residual'],
              invocation: {
                moduleSource: 'artifact.execution.module',
                entryExport: 'main',
                argumentMode: 'linear-memory-offsets',
                parameterTypes: ['i32', 'i32'],
                resultTypes: ['i32'],
                inputOffsetParam: 0,
                outputOffsetParam: 1,
                expectedReturn: 0
              },
              requiredEvidence: [...ESHKOL_PRODUCTION_HANDLER_CONTRACT_REQUIRED_EVIDENCE],
              blockedBy: [...ESHKOL_PRODUCTION_BLOCKERS]
            },
            productionHandlerImplementation: {
              schema: 'eshkol.ulg.production-handler-implementation.v0',
              status: 'implemented-production-candidate-runtime-smoke',
              handlerId: 'eshkol:magnetar-closure:main:v0',
              handlerKind: 'wasm-export-tensor-closure',
              implementationScope: 'deterministic-magnetar-tensor-abi-smoke',
              moduleSource: 'artifact.execution.module',
              entryExport: 'main',
              runtimeAbi: 'wasm32-unknown-unknown:eshkol-host-imports-production-candidate-v0',
              dispatchSchema: 'peercompute.ulg.dispatch-service-handler-context.v0',
              tensorMemoryModel: 'host-managed-linear-f64',
              inputTensorIds: ['magnetar-state-vector', 'closure-control-vector'],
              outputTensorIds: ['magnetar-closure-update', 'closure-residual'],
              invocation: {
                moduleSource: 'artifact.execution.module',
                entryExport: 'main',
                argumentMode: 'linear-memory-offsets',
                parameterTypes: ['i32', 'i32'],
                resultTypes: ['i32'],
                inputOffsetParam: 0,
                outputOffsetParam: 1,
                expectedReturn: 0
              },
              executionClaim: 'production-candidate-host-import-runtime-smoke-only',
              evidence: [
                'content-addressed-wasm-module',
                'entry-export-main-signature-i32-i32-to-i32',
                'production-candidate-host-imports',
                'validated-f64-tensor-memory-binding',
                'production-candidate-runtime-probe'
              ],
              scientificValidation: false,
              fullPhysicsValidation: false,
              fullFidelityMagnetarSimulation: false,
              blockedBy: [...ESHKOL_PRODUCTION_BLOCKERS]
            },
            hostImports: {
              source: 'bundle.hostImports',
              required: true,
              factory: 'createEshkolHostImportObject',
              runtimeScope: 'production-candidate-host-imports',
              implementationStatus: 'production-candidate-runtime-imports-present',
              productionCandidate: {
                schema: 'eshkol.ulg.production-host-import-candidate.v0',
                status: 'production-candidate-runtime-imports-implemented',
                factory: 'createEshkolHostImportObject',
                smokeRuntimeAbi: 'wasm32-unknown-unknown:eshkol-host-imports-smoke-v0',
                productionRuntimeAbi: 'wasm32-unknown-unknown:eshkol-host-imports-production-candidate-v0',
                runtimeScope: 'production-candidate-host-imports',
                implementationStatus: 'production-candidate-runtime-imports-present',
                runtimeSmokeStubsAllowed: false,
                tensorMemoryImports: ['ulg_read_f64', 'ulg_write_f64'],
                requiredNonStubImports: [...ESHKOL_PRODUCTION_REQUIRED_NON_STUB_IMPORTS],
                readinessRequires: [...ESHKOL_PRODUCTION_READINESS_REQUIREMENTS],
                blockedBy: [...ESHKOL_PRODUCTION_BLOCKERS]
              }
            },
            allowedExecutionClaims: [
              'deterministic-tensor-runtime-smoke-only',
              'production-candidate-host-import-runtime-smoke-only'
            ],
            blockers: [...ESHKOL_PRODUCTION_BLOCKERS],
            tensorMemoryBinding: {
              source: 'validation.closureDescriptor.descriptorBinding.closureTensorRuntimeContract.linearMemoryBinding',
              status: 'entry-export-runtime-smoke-passed',
              executionClaim: 'deterministic-tensor-runtime-smoke-only',
              entryExportConsumesOffsets: true
            },
            productionCandidateRuntimeProbe: {
              schema: 'eshkol.ulg.production-candidate-runtime-probe.v0',
              status: 'production-candidate-runtime-smoke-passed',
              runtimeScope: 'production-candidate-host-imports',
              implementationStatus: 'production-candidate-runtime-imports-present',
              executionClaim: 'production-candidate-host-import-runtime-smoke-only',
              entryExport: 'main',
              entryArgs: [131072, 131136],
              expectedEntryResult: 0,
              sampleSource: 'validation.closureDescriptor.descriptorBinding.ulgInterpolationTable.samples[0]',
              linearMemoryBindingSource: 'validation.closureDescriptor.descriptorBinding.closureTensorRuntimeContract.linearMemoryBinding',
              changedBytesInDeclaredTensorRange: 64,
              outputTensorsProducedByEntryExport: true,
              productionHandlerReady: true,
              productionHandlerRuntimeExecution: true,
              scientificValidation: false,
              fullPhysicsValidation: false,
              fullFidelityMagnetarSimulation: false,
              hostImportOptions: {
                factory: 'createEshkolHostImportObject',
                productionCandidateRuntimeImports: true,
                runtimeSmokeStubs: false,
                f64TensorMemoryImports: true
              },
              hostImportCallCounts: {
                ulg_read_f64: 12,
                ulg_write_f64: 9
              },
              blocker: 'full-physics-validation-not-run'
            },
            productionHandlerRuntimeExecution: {
              schema: 'eshkol.ulg.production-handler-runtime-execution.v0',
              status: 'production-handler-runtime-smoke-executed',
              handlerId: 'eshkol:magnetar-closure:main:v0',
              moduleSource: 'artifact.execution.module',
              entryExport: 'main',
              runtimeAbi: 'wasm32-unknown-unknown:eshkol-host-imports-production-candidate-v0',
              runtimeScope: 'production-candidate-host-imports',
              executionClaim: 'production-candidate-host-import-runtime-smoke-only',
              argumentMode: 'linear-memory-offsets',
              parameterTypes: ['i32', 'i32'],
              resultTypes: ['i32'],
              entryArgs: [131072, 131136],
              entryResult: 0,
              sampleSource: 'validation.closureDescriptor.descriptorBinding.ulgInterpolationTable.samples[0]',
              linearMemoryBindingSource: 'validation.closureDescriptor.descriptorBinding.closureTensorRuntimeContract.linearMemoryBinding',
              changedBytesInDeclaredTensorRange: 64,
              outputTensorsProducedByEntryExport: true,
              hostImportCallCounts: {
                ulg_read_f64: 12,
                ulg_write_f64: 9
              },
              scientificValidation: false,
              fullPhysicsValidation: false,
              fullFidelityMagnetarSimulation: false,
              blockedBy: [...ESHKOL_PRODUCTION_BLOCKERS]
            },
            fullPhysicsValidationRequirements: {
              schema: 'eshkol.ulg.full-physics-validation-requirements.v0',
              status: 'declared-not-run',
              ready: false,
              validationScope: 'magnetar-production-handler-full-physics',
              producerSchema: 'peercompute.multiscale.scenario-runtime-evidence-manifest.v0',
              requiredValidationSchema: 'peercompute.multiscale.scenario-scientific-runtime-validation.v0',
              requiredValidationScope: 'magnetar-scientific-runtime-reference-validation',
              requiredRuntimeEvidenceFamilies: [...ESHKOL_FULL_PHYSICS_RUNTIME_EVIDENCE_FAMILIES],
              requiredHashFields: [...ESHKOL_FULL_PHYSICS_REQUIRED_HASH_FIELDS],
              requiredRuntimeEvidence: ESHKOL_FULL_PHYSICS_RUNTIME_EVIDENCE_FAMILIES.map((family, index) => ({
                family,
                schema: ESHKOL_FULL_PHYSICS_RUNTIME_EVIDENCE_SCHEMAS[index],
                status: 'required-not-provided',
                required: true
              })),
              blockedBy: [...ESHKOL_PRODUCTION_BLOCKERS]
            },
            dispatchPreflight: {
              schema: 'eshkol.ulg.production-handler-dispatch-preflight.v0',
              status: 'blocked',
              ready: false,
              dispatchSchema: 'peercompute.ulg.dispatch-service-handler-context.v0',
              entryExport: 'main',
              currentRuntimeAbi: 'wasm32-unknown-unknown:eshkol-host-imports-production-candidate-v0',
              requiredRuntimeAbi: 'wasm32-unknown-unknown:eshkol-host-imports-production-candidate-v0',
              moduleContentAddressing: 'required',
              moduleSha256Field: 'artifact.execution.module.sha256',
              tensorMemoryBindingSource: 'validation.closureDescriptor.descriptorBinding.closureTensorRuntimeContract.linearMemoryBinding',
              hostImportsCandidateSource: 'productionHandlerBoundary.hostImports.productionCandidate',
              requiredChecks: [...ESHKOL_PRODUCTION_DISPATCH_CHECKS],
              rejectedRuntimeScopes: ['deterministic-runtime-smoke-stubs'],
              runtimeSmokeStubsAllowed: false,
              handlerReadyRequired: true,
              runtimeExecutionRequired: true,
              fullPhysicsValidationRequired: true,
              scientificValidationRequired: true,
              blockedBy: [...ESHKOL_PRODUCTION_BLOCKERS],
              checkResults: [
                {
                  check: 'artifact-module-sha256-matches-module-ref',
                  status: 'pass',
                  ready: true,
                  evidenceSource: 'artifact.execution.module.sha256'
                },
                {
                  check: 'entry-export-main-signature-i32-i32-to-i32',
                  status: 'pass',
                  ready: true,
                  evidenceSource: 'artifact.execution.entrySignature'
                },
                {
                  check: 'production-handler-contract-declared',
                  status: 'pass',
                  ready: true,
                  evidenceSource: 'productionHandlerBoundary.productionHandlerContract'
                },
                {
                  check: 'non-stub-host-imports-present',
                  status: 'pass',
                  ready: true,
                  evidenceSource: 'productionHandlerBoundary.hostImports',
                  observed: {
                    runtimeScope: 'production-candidate-host-imports',
                    implementationStatus: 'production-candidate-runtime-imports-present',
                    runtimeAbi: 'wasm32-unknown-unknown:eshkol-host-imports-production-candidate-v0',
                    productionRuntimeAbi: 'wasm32-unknown-unknown:eshkol-host-imports-production-candidate-v0'
                  }
                },
                {
                  check: 'f64-tensor-memory-binding-validated',
                  status: 'pass',
                  ready: true,
                  evidenceSource: 'productionHandlerBoundary.tensorMemoryBinding'
                },
                {
                  check: 'production-candidate-runtime-probe-passed',
                  status: 'pass',
                  ready: true,
                  evidenceSource: 'productionHandlerBoundary.productionCandidateRuntimeProbe',
                  observed: {
                    status: 'production-candidate-runtime-smoke-passed',
                    runtimeScope: 'production-candidate-host-imports',
                    executionClaim: 'production-candidate-host-import-runtime-smoke-only',
                    changedBytesInDeclaredTensorRange: 64,
                    hostImportCallCounts: {
                      ulg_read_f64: 12,
                      ulg_write_f64: 9
                    }
                  }
                },
                {
                  check: 'runtime-smoke-stubs-rejected-for-production',
                  status: 'pass',
                  ready: true,
                  evidenceSource: 'productionHandlerBoundary.dispatchPreflight'
                },
                {
                  check: 'handler-ready-flag-true',
                  status: 'pass',
                  ready: true,
                  evidenceSource: 'productionHandlerBoundary.productionHandlerImplementation'
                },
                {
                  check: 'runtime-execution-flag-true',
                  status: 'pass',
                  ready: true,
                  evidenceSource: 'productionHandlerBoundary.productionHandlerRuntimeExecution'
                },
                {
                  check: 'full-physics-validation-evidence-present',
                  status: 'blocked',
                  ready: false,
                  evidenceSource: 'productionHandlerBoundary.fullPhysicsValidationRequirements',
                  observed: {
                    schema: 'eshkol.ulg.full-physics-validation-requirements.v0',
                    status: 'declared-not-run',
                    scientificValidation: false,
                    fullPhysicsValidation: false,
                    requiredRuntimeEvidenceFamilies: [...ESHKOL_FULL_PHYSICS_RUNTIME_EVIDENCE_FAMILIES]
                  },
                  blocker: 'full-physics-validation-not-run'
                }
              ],
              checkSummary: {
                schema: 'eshkol.ulg.production-handler-dispatch-preflight-check-summary.v0',
                status: 'blocked',
                ready: false,
                computedBy: 'eshkol-ulg-closure-artifact-v0.3',
                totalRequiredCheckCount: ESHKOL_PRODUCTION_DISPATCH_CHECKS.length,
                passedCount: ESHKOL_PRODUCTION_DISPATCH_PASSED_CHECKS.length,
                blockedCount: ESHKOL_PRODUCTION_DISPATCH_BLOCKED_CHECKS.length,
                passedChecks: [...ESHKOL_PRODUCTION_DISPATCH_PASSED_CHECKS],
                blockedChecks: [...ESHKOL_PRODUCTION_DISPATCH_BLOCKED_CHECKS]
              }
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
  assert.equal(summary.validationStatus, 'runtime-smoke');
  assert.equal(summary.closureKind, 'magnetar-closure-descriptor-fixture');
  assert.equal(summary.closureModuleUrl, 'magnetar-closure.wasm');
  assert.equal(summary.closureServiceWorkerSafe, true);
  assert.equal(summary.closureRequiresDynamicCode, false);
  assert.equal(summary.closureImportCount, 32);
  assert.equal(summary.closureExportCount, 2);
  assert.equal(summary.closureRuntimeFunctionImportCount, 29);
  assert.equal(summary.closureWasmFunctionCount, 42);
  assert.equal(summary.closureWasmTypeCount, 111);
  assert.equal(summary.closureBundleCopyFileCount, 4);
  assert.equal(summary.closureBundlePreserveRelativeUrls, true);
  assert.equal(summary.closureHostImportsModule, '/service-assets/eshkol/closures/magnetar-closure/eshkol-host-imports.js');
  assert.equal(summary.closureHostImportsAssetStatus, 'ready');
  assert.equal(summary.closureHostImportsFactoryStatus, 'ready');
  assert.equal(summary.closureHostImportsFactoryReady, true);
  assert.equal(summary.closureHostImportsRuntimeScope, 'production-candidate-host-imports');
  assert.equal(summary.closureHostImportsRequiredNonStubImportCount, 23);
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
  assert.equal(summary.closureTensorRuntimeContractHash, 'sha256:2289b8c8068f1a033cda20f09f30a33f2e41588b8ee2ccd1143100f2fe87dd64');
  assert.equal(
    summary.closureTensorRuntimeRuntimeAbi,
    'wasm32-unknown-unknown:eshkol-host-imports-production-candidate-v0'
  );
  assert.equal(summary.closureTensorRuntimeExecutionClaim, 'deterministic-tensor-runtime-smoke-only');
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
  assert.equal(summary.closureTensorLinearMemoryBindingStatus, 'entry-export-runtime-smoke-passed');
  assert.equal(summary.closureTensorLinearMemoryBindingReady, true);
  assert.equal(summary.closureTensorLinearMemoryRuntimeStatus, 'deterministic-host-runtime-smoke-executed');
  assert.equal(summary.closureTensorLinearMemoryExecutionClaim, 'deterministic-tensor-runtime-smoke-only');
  assert.equal(summary.closureTensorLinearMemoryElementType, 'f64');
  assert.equal(summary.closureTensorLinearMemoryElementByteLength, 8);
  assert.equal(summary.closureTensorLinearMemoryAlignmentBytes, 8);
  assert.equal(summary.closureTensorLinearMemoryEntryExportConsumesOffsets, true);
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
    true,
    true,
    true,
    true
  ]);
  assert.equal(summary.closureTensorLinearMemorySmokeBindingSchema, 'eshkol.ulg.tensor-linear-memory-smoke-binding.v0');
  assert.equal(summary.closureTensorLinearMemorySmokeBindingStatus, 'entry-export-runtime-smoke-passed');
  assert.equal(summary.closureTensorLinearMemorySmokeBindingEntryExportConsumesOffsets, true);
  assert.equal(summary.closureTensorLinearMemorySmokeBindingOutputInitialization, 'entry-export-produced');
  assert.equal(summary.closureTensorEntryExportOffsetProbeSchema, 'eshkol.ulg.tensor-entry-export-offset-probe.v0');
  assert.equal(summary.closureTensorEntryExportOffsetProbeStatus, 'runtime-smoke-passed');
  assert.equal(summary.closureTensorEntryExportOffsetProbeEntryExport, 'main');
  assert.equal(summary.closureTensorEntryExportConsumesOffsets, true);
  assert.equal(summary.closureTensorEntryExportOutputTensorsProduced, true);
  assert.equal(summary.closureTensorEntryExportChangedBytesInDeclaredTensorRange, 64);
  assert.equal(summary.closureTensorEntryExportObservedStdoutInvariantAcrossArgs, false);
  assert.equal(
    summary.closureTensorEntryExportOffsetProbeBlocker,
    'none-for-deterministic-runtime-smoke-production-physics-unvalidated'
  );
  assert.equal(summary.closureProductionHandlerBoundarySchema, 'eshkol.ulg.production-handler-boundary.v0');
  assert.equal(summary.closureProductionHandlerBoundaryStatus, 'production-handler-runtime-smoke-executed');
  assert.equal(summary.closureProductionHandlerBoundaryDeclared, true);
  assert.equal(summary.closureProductionHandlerBoundaryHandlerId, 'eshkol:magnetar-closure:main:v0');
  assert.equal(summary.closureProductionHandlerBoundaryHandlerKind, 'wasm-export-tensor-closure');
  assert.equal(summary.closureProductionHandlerBoundaryDispatchSchema, 'peercompute.ulg.dispatch-service-handler-context.v0');
  assert.equal(summary.closureProductionHandlerReady, true);
  assert.equal(summary.closureProductionHandlerRuntimeExecution, true);
  assert.equal(summary.closureProductionHandlerEntryExport, 'main');
  assert.equal(
    summary.closureProductionHandlerRuntimeAbi,
    'wasm32-unknown-unknown:eshkol-host-imports-production-candidate-v0'
  );
  assert.equal(summary.closureProductionHandlerTensorMemoryModel, 'host-managed-linear-f64');
  assert.deepEqual(summary.closureProductionHandlerInputTensorIds, ['magnetar-state-vector', 'closure-control-vector']);
  assert.deepEqual(summary.closureProductionHandlerOutputTensorIds, ['magnetar-closure-update', 'closure-residual']);
  assert.equal(summary.closureProductionHandlerDerivativeStatus, 'declared-not-computed');
  assert.equal(summary.closureProductionHandlerScientificValidation, false);
  assert.equal(summary.closureProductionHandlerFullPhysicsValidation, false);
  assert.equal(summary.closureProductionHandlerFullFidelityMagnetarSimulation, false);
  assert.deepEqual(summary.closureProductionHandlerAllowedExecutionClaims, [
    'deterministic-tensor-runtime-smoke-only',
    'production-candidate-host-import-runtime-smoke-only'
  ]);
  assert.deepEqual(summary.closureProductionHandlerBoundaryBlockers, [...ESHKOL_PRODUCTION_BLOCKERS]);
  assert.deepEqual(summary.closureProductionHandlerTensorMemoryBinding, {
    source: 'validation.closureDescriptor.descriptorBinding.closureTensorRuntimeContract.linearMemoryBinding',
    status: 'entry-export-runtime-smoke-passed',
    executionClaim: 'deterministic-tensor-runtime-smoke-only',
    entryExportConsumesOffsets: true
  });
  assert.equal(summary.closureProductionHandlerContractSchema, 'eshkol.ulg.production-handler-contract.v0');
  assert.equal(summary.closureProductionHandlerContractStatus, 'implemented-runtime-smoke-pending-full-physics');
  assert.equal(summary.closureProductionHandlerContractDeclared, true);
  assert.equal(summary.closureProductionHandlerContractHandlerId, 'eshkol:magnetar-closure:main:v0');
  assert.equal(
    summary.closureProductionHandlerContractDispatchSchema,
    'peercompute.ulg.dispatch-service-handler-context.v0'
  );
  assert.equal(summary.closureProductionHandlerContractEntryExport, 'main');
  assert.equal(
    summary.closureProductionHandlerContractRuntimeAbi,
    'wasm32-unknown-unknown:eshkol-host-imports-production-candidate-v0'
  );
  assert.equal(summary.closureProductionHandlerContractTensorMemoryModel, 'host-managed-linear-f64');
  assert.deepEqual(
    summary.closureProductionHandlerContractInputTensorIds,
    ['magnetar-state-vector', 'closure-control-vector']
  );
  assert.deepEqual(
    summary.closureProductionHandlerContractOutputTensorIds,
    ['magnetar-closure-update', 'closure-residual']
  );
  assert.equal(summary.closureProductionHandlerContractInvocationModuleSource, 'artifact.execution.module');
  assert.equal(summary.closureProductionHandlerContractInvocationEntryExport, 'main');
  assert.equal(summary.closureProductionHandlerContractInvocationArgumentMode, 'linear-memory-offsets');
  assert.deepEqual(summary.closureProductionHandlerContractInvocationParameterTypes, ['i32', 'i32']);
  assert.deepEqual(summary.closureProductionHandlerContractInvocationResultTypes, ['i32']);
  assert.equal(summary.closureProductionHandlerContractInvocationInputOffsetParam, 0);
  assert.equal(summary.closureProductionHandlerContractInvocationOutputOffsetParam, 1);
  assert.equal(summary.closureProductionHandlerContractInvocationExpectedReturn, 0);
  assert.deepEqual(
    summary.closureProductionHandlerContractRequiredEvidence,
    [...ESHKOL_PRODUCTION_HANDLER_CONTRACT_REQUIRED_EVIDENCE]
  );
  assert.equal(
    summary.closureProductionHandlerContractRequiredEvidenceCount,
    ESHKOL_PRODUCTION_HANDLER_CONTRACT_REQUIRED_EVIDENCE.length
  );
  assert.deepEqual(summary.closureProductionHandlerContractBlockedBy, [...ESHKOL_PRODUCTION_BLOCKERS]);
  assert.equal(summary.closureProductionHandlerImplementationSchema, 'eshkol.ulg.production-handler-implementation.v0');
  assert.equal(summary.closureProductionHandlerImplementationStatus, 'implemented-production-candidate-runtime-smoke');
  assert.equal(summary.closureProductionHandlerImplementationReady, true);
  assert.equal(summary.closureProductionHandlerImplementationScope, 'deterministic-magnetar-tensor-abi-smoke');
  assert.equal(
    summary.closureProductionHandlerImplementationExecutionClaim,
    'production-candidate-host-import-runtime-smoke-only'
  );
  assert.equal(summary.closureProductionHandlerImplementationEvidenceCount, 5);
  assert.deepEqual(summary.closureProductionHandlerImplementationBlockedBy, [...ESHKOL_PRODUCTION_BLOCKERS]);
  assert.equal(summary.closureProductionHandlerRuntimeExecutionSchema, 'eshkol.ulg.production-handler-runtime-execution.v0');
  assert.equal(summary.closureProductionHandlerRuntimeExecutionStatus, 'production-handler-runtime-smoke-executed');
  assert.equal(summary.closureProductionHandlerRuntimeExecutionReady, true);
  assert.deepEqual(summary.closureProductionHandlerRuntimeExecutionEntryArgs, [131072, 131136]);
  assert.equal(summary.closureProductionHandlerRuntimeExecutionEntryResult, 0);
  assert.equal(summary.closureProductionHandlerRuntimeExecutionChangedBytesInDeclaredTensorRange, 64);
  assert.equal(summary.closureProductionHandlerRuntimeExecutionOutputTensorsProduced, true);
  assert.deepEqual(summary.closureProductionHandlerRuntimeExecutionHostImportCallCounts, {
    ulg_read_f64: 12,
    ulg_write_f64: 9
  });
  assert.deepEqual(summary.closureProductionHandlerRuntimeExecutionBlockedBy, [...ESHKOL_PRODUCTION_BLOCKERS]);
  assert.equal(
    summary.closureFullPhysicsValidationRequirementsSchema,
    'eshkol.ulg.full-physics-validation-requirements.v0'
  );
  assert.equal(summary.closureFullPhysicsValidationRequirementsStatus, 'declared-not-run');
  assert.equal(summary.closureFullPhysicsValidationRequirementsDeclared, true);
  assert.equal(summary.closureFullPhysicsValidationRequirementsReady, false);
  assert.equal(
    summary.closureFullPhysicsValidationRequirementsValidationScope,
    'magnetar-production-handler-full-physics'
  );
  assert.equal(
    summary.closureFullPhysicsValidationRequirementsRequiredValidationSchema,
    'peercompute.multiscale.scenario-scientific-runtime-validation.v0'
  );
  assert.equal(
    summary.closureFullPhysicsValidationRequirementsRequiredValidationScope,
    'magnetar-scientific-runtime-reference-validation'
  );
  assert.deepEqual(
    summary.closureFullPhysicsValidationRequiredRuntimeEvidenceFamilies,
    [...ESHKOL_FULL_PHYSICS_RUNTIME_EVIDENCE_FAMILIES]
  );
  assert.equal(summary.closureFullPhysicsValidationRequiredRuntimeEvidenceCount, 5);
  assert.deepEqual(
    summary.closureFullPhysicsValidationRequiredHashFields,
    [...ESHKOL_FULL_PHYSICS_REQUIRED_HASH_FIELDS]
  );
  assert.deepEqual(summary.closureFullPhysicsValidationRequirementsBlockedBy, [...ESHKOL_PRODUCTION_BLOCKERS]);
  assert.equal(summary.closureProductionCandidateRuntimeProbeSchema, 'eshkol.ulg.production-candidate-runtime-probe.v0');
  assert.equal(summary.closureProductionCandidateRuntimeProbeStatus, 'production-candidate-runtime-smoke-passed');
  assert.equal(summary.closureProductionCandidateRuntimeProbeReady, true);
  assert.equal(
    summary.closureProductionCandidateRuntimeProbeExecutionClaim,
    'production-candidate-host-import-runtime-smoke-only'
  );
  assert.equal(summary.closureProductionCandidateRuntimeProbeRuntimeScope, 'production-candidate-host-imports');
  assert.equal(
    summary.closureProductionCandidateRuntimeProbeImplementationStatus,
    'production-candidate-runtime-imports-present'
  );
  assert.equal(summary.closureProductionCandidateRuntimeProbeEntryExport, 'main');
  assert.deepEqual(summary.closureProductionCandidateRuntimeProbeEntryArgs, [131072, 131136]);
  assert.equal(summary.closureProductionCandidateRuntimeProbeExpectedEntryResult, 0);
  assert.equal(summary.closureProductionCandidateRuntimeProbeChangedBytesInDeclaredTensorRange, 64);
  assert.equal(summary.closureProductionCandidateRuntimeProbeOutputTensorsProduced, true);
  assert.equal(summary.closureProductionCandidateRuntimeProbeProductionHandlerReady, true);
  assert.equal(summary.closureProductionCandidateRuntimeProbeProductionHandlerRuntimeExecution, true);
  assert.equal(summary.closureProductionCandidateRuntimeProbeScientificValidation, false);
  assert.equal(summary.closureProductionCandidateRuntimeProbeFullPhysicsValidation, false);
  assert.equal(summary.closureProductionCandidateRuntimeProbeFullFidelityMagnetarSimulation, false);
  assert.deepEqual(summary.closureProductionCandidateRuntimeProbeHostImportOptions, {
    factory: 'createEshkolHostImportObject',
    productionCandidateRuntimeImports: true,
    runtimeSmokeStubs: false,
    f64TensorMemoryImports: true
  });
  assert.deepEqual(summary.closureProductionCandidateRuntimeProbeHostImportCallCounts, {
    ulg_read_f64: 12,
    ulg_write_f64: 9
  });
  assert.equal(
    summary.closureProductionCandidateRuntimeProbeBlocker,
    'full-physics-validation-not-run'
  );
  assert.equal(summary.closureProductionHostImportsRuntimeScope, 'production-candidate-host-imports');
  assert.equal(
    summary.closureProductionHostImportsImplementationStatus,
    'production-candidate-runtime-imports-present'
  );
  assert.equal(summary.closureProductionHostImportCandidateSchema, 'eshkol.ulg.production-host-import-candidate.v0');
  assert.equal(summary.closureProductionHostImportCandidateStatus, 'production-candidate-runtime-imports-implemented');
  assert.equal(
    summary.closureProductionHostImportCandidateProductionRuntimeAbi,
    'wasm32-unknown-unknown:eshkol-host-imports-production-candidate-v0'
  );
  assert.equal(summary.closureProductionHostImportCandidateRuntimeSmokeStubsAllowed, false);
  assert.deepEqual(
    summary.closureProductionHostImportCandidateRequiredNonStubImports,
    [...ESHKOL_PRODUCTION_REQUIRED_NON_STUB_IMPORTS]
  );
  assert.deepEqual(summary.closureProductionHostImportCandidateTensorMemoryImports, ['ulg_read_f64', 'ulg_write_f64']);
  assert.deepEqual(
    summary.closureProductionHostImportCandidateReadinessRequires,
    [...ESHKOL_PRODUCTION_READINESS_REQUIREMENTS]
  );
  assert.deepEqual(summary.closureProductionHostImportCandidateBlockedBy, [...ESHKOL_PRODUCTION_BLOCKERS]);
  assert.equal(
    summary.closureProductionDispatchPreflightSchema,
    'eshkol.ulg.production-handler-dispatch-preflight.v0'
  );
  assert.equal(summary.closureProductionDispatchPreflightStatus, 'blocked');
  assert.equal(summary.closureProductionDispatchPreflightReady, false);
  assert.equal(
    summary.closureProductionDispatchPreflightDispatchSchema,
    'peercompute.ulg.dispatch-service-handler-context.v0'
  );
  assert.equal(
    summary.closureProductionDispatchPreflightCurrentRuntimeAbi,
    'wasm32-unknown-unknown:eshkol-host-imports-production-candidate-v0'
  );
  assert.equal(
    summary.closureProductionDispatchPreflightRequiredRuntimeAbi,
    'wasm32-unknown-unknown:eshkol-host-imports-production-candidate-v0'
  );
  assert.equal(summary.closureProductionDispatchPreflightRuntimeSmokeStubsAllowed, false);
  assert.deepEqual(summary.closureProductionDispatchPreflightRequiredChecks, [...ESHKOL_PRODUCTION_DISPATCH_CHECKS]);
  assert.deepEqual(summary.closureProductionDispatchPreflightRejectedRuntimeScopes, [
    'deterministic-runtime-smoke-stubs'
  ]);
  assert.deepEqual(summary.closureProductionDispatchPreflightBlockedBy, [...ESHKOL_PRODUCTION_BLOCKERS]);
  assert.equal(
    summary.closureProductionDispatchPreflightCheckSummarySchema,
    'eshkol.ulg.production-handler-dispatch-preflight-check-summary.v0'
  );
  assert.equal(summary.closureProductionDispatchPreflightTotalRequiredCheckCount, ESHKOL_PRODUCTION_DISPATCH_CHECKS.length);
  assert.equal(summary.closureProductionDispatchPreflightPassedCheckCount, ESHKOL_PRODUCTION_DISPATCH_PASSED_CHECKS.length);
  assert.equal(summary.closureProductionDispatchPreflightBlockedCheckCount, ESHKOL_PRODUCTION_DISPATCH_BLOCKED_CHECKS.length);
  assert.deepEqual(
    summary.closureProductionDispatchPreflightPassedChecks,
    [...ESHKOL_PRODUCTION_DISPATCH_PASSED_CHECKS]
  );
  assert.deepEqual(
    summary.closureProductionDispatchPreflightBlockedChecks,
    [...ESHKOL_PRODUCTION_DISPATCH_BLOCKED_CHECKS]
  );
  assert.deepEqual(
    summary.closureProductionDispatchPreflightCheckResults.map((entry) => entry.check),
    [...ESHKOL_PRODUCTION_DISPATCH_CHECKS]
  );
  assert.equal(summary.closureOutputSemanticsSchema, 'eshkol.ulg.closure-output-semantics.v0');
  assert.equal(summary.closureOutputSemanticsReady, true);
  assert.equal(summary.closureOutputSemanticScope, 'smoke-fixture');
  assert.equal(summary.closureOutputScientificScope, 'none');
  assert.equal(summary.closureOutputScientificValidation, false);
  assert.equal(summary.closureOutputExpectedEntryExport, 'main');
  assert.deepEqual(summary.closureOutputExpectedEntryArgs, [131072, 131136]);
  assert.equal(summary.closureOutputExpectedEntryResult, 0);
  assert.equal(summary.closureOutputExpectedStdoutSha256, 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(summary.closureOutputExpectedStdoutByteLength, 0);
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
    webGpuParityHandoffSummary: createMoonLabWebGpuParityHandoffSummaryFixture(),
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
  assert.equal(summary.moonlabWebGpuParityScopeStatus, 'scope-ready-backend-detected');
  assert.equal(summary.moonlabWebGpuParityScopeReady, true);
  assert.equal(summary.moonlabWebGpuParityScopeContractReady, true);
  assert.equal(summary.moonlabWebGpuParityScopeReducedFixtureOnly, true);
  assert.equal(summary.moonlabWebGpuParityScopeBackendAvailable, true);
  assert.equal(summary.moonlabWebGpuBrowserBackendPreflightSchema, 'moonlab.webgpu.complex64-browser-backend-preflight.v0');
  assert.equal(summary.moonlabWebGpuBrowserBackendPreflightDeclared, true);
  assert.equal(summary.moonlabWebGpuBrowserBackendPreflightProbeKind, 'browser-webgpu-adapter-device-preflight');
  assert.equal(summary.moonlabWebGpuBrowserBackendPreflightRuntime, 'browser-harness');
  assert.equal(summary.moonlabWebGpuBrowserBackendPreflightStage, 'device-acquired');
  assert.equal(summary.moonlabWebGpuBrowserBackendPreflightNavigatorGpuAvailable, true);
  assert.equal(summary.moonlabWebGpuBrowserBackendPreflightAdapterAvailable, true);
  assert.equal(summary.moonlabWebGpuBrowserBackendPreflightDeviceAcquired, true);
  assert.match(summary.moonlabWebGpuBrowserBackendPreflightReason, /adapter and device were acquired/);
  assert.equal(summary.moonlabWebGpuParityExecuted, true);
  assert.equal(summary.moonlabWebGpuParityPassed, true);
  assert.equal(summary.moonlabWebGpuParityMaxProbabilityAbsDiff, 0);
  assert.equal(summary.moonlabWebGpuParityTolerance, 0.00001);
  assert.equal(summary.moonlabWebGpuProbabilityKernelProbeSchema, 'moonlab.webgpu.complex64-probability-kernel-probe.v0');
  assert.equal(summary.moonlabWebGpuProbabilityKernelProbeDeclared, true);
  assert.equal(summary.moonlabWebGpuProbabilityKernelProbeKind, 'browser-webgpu-complex64-probability-kernel');
  assert.equal(summary.moonlabWebGpuProbabilityKernel, 'compute_probabilities');
  assert.equal(summary.moonlabWebGpuProbabilityKernelExecuted, true);
  assert.equal(summary.moonlabWebGpuProbabilityKernelPassed, true);
  assert.deepEqual(summary.moonlabWebGpuProbabilityKernelCoveredNativeOperations, ['compute_probabilities']);
  assert.equal(summary.moonlabWebGpuProbabilityKernelMaxProbabilityAbsDiff, 0);
  assert.equal(summary.moonlabWebGpuProbabilityKernelTolerance, 0.00001);
  assert.equal(summary.moonlabWebGpuNativeOperationProbeSchema, 'moonlab.webgpu.complex64-native-operation-probe.v0');
  assert.equal(summary.moonlabWebGpuNativeOperationProbeDeclared, true);
  assert.equal(summary.moonlabWebGpuNativeOperationProbeKind, 'browser-webgpu-complex64-native-operation-probe');
  assert.equal(summary.moonlabWebGpuNativeOperationProbeExecuted, true);
  assert.equal(summary.moonlabWebGpuNativeOperationProbePassed, true);
  assert.deepEqual(summary.moonlabWebGpuNativeOperationCoveredOperations, [
    'hadamard',
    'pauli_x',
    'pauli_z',
    'cnot'
  ]);
  assert.equal(summary.moonlabWebGpuNativeOperationProbeOperationCount, 4);
  assert.equal(summary.moonlabWebGpuNativeOperationProbeCoveredOperationCount, 4);
  assert.deepEqual(summary.moonlabWebGpuNativeOperationProbeDeclaredOperations, [
    'hadamard',
    'pauli_x',
    'pauli_z',
    'cnot'
  ]);
  assert.deepEqual(summary.moonlabWebGpuNativeOperationProbeBlockedOperations, []);
  assert.deepEqual(summary.moonlabWebGpuNativeOperationProbeTargetOperations, [
    'hadamard',
    'pauli_x',
    'pauli_z',
    'cnot'
  ]);
  assert.deepEqual(summary.moonlabWebGpuNativeOperationProbeMissingTargetOperations, []);
  assert.equal(summary.moonlabWebGpuNativeOperationProbeOperationResults[0].operation, 'hadamard');
  assert.equal(summary.moonlabWebGpuNativeOperationProbeOperationResults[0].executed, true);
  assert.equal(summary.moonlabWebGpuNativeOperationProbeOperationResults[0].passed, true);
  assert.equal(summary.moonlabWebGpuNativeOperationProbeOperationResults[0].covered, true);
  assert.equal(summary.moonlabWebGpuNativeOperationProbeOperationResults[0].blocker, null);
  assert.equal(summary.moonlabWebGpuNativeOperationProbeOperationResults[1].operation, 'pauli_x');
  assert.equal(summary.moonlabWebGpuNativeOperationProbeOperationResults[1].executed, true);
  assert.equal(summary.moonlabWebGpuNativeOperationProbeOperationResults[1].passed, true);
  assert.equal(summary.moonlabWebGpuNativeOperationProbeOperationResults[1].covered, true);
  assert.equal(summary.moonlabWebGpuNativeOperationProbeOperationResults[1].blocker, null);
  assert.equal(summary.moonlabWebGpuNativeOperationProbeOperationResults[2].operation, 'pauli_z');
  assert.equal(summary.moonlabWebGpuNativeOperationProbeOperationResults[2].executed, true);
  assert.equal(summary.moonlabWebGpuNativeOperationProbeOperationResults[2].passed, true);
  assert.equal(summary.moonlabWebGpuNativeOperationProbeOperationResults[2].covered, true);
  assert.equal(summary.moonlabWebGpuNativeOperationProbeOperationResults[2].blocker, null);
  assert.equal(summary.moonlabWebGpuNativeOperationProbeOperationResults[3].operation, 'cnot');
  assert.equal(summary.moonlabWebGpuNativeOperationProbeOperationResults[3].executed, true);
  assert.equal(summary.moonlabWebGpuNativeOperationProbeOperationResults[3].passed, true);
  assert.equal(summary.moonlabWebGpuNativeOperationProbeOperationResults[3].covered, true);
  assert.equal(summary.moonlabWebGpuNativeOperationProbeOperationResults[3].blocker, null);
  assert.equal(summary.moonlabWebGpuHadamardNativeOperationDeclared, true);
  assert.equal(summary.moonlabWebGpuHadamardNativeOperationExecuted, true);
  assert.equal(summary.moonlabWebGpuHadamardNativeOperationPassed, true);
  assert.equal(summary.moonlabWebGpuHadamardNativeOperationCovered, true);
  assert.equal(summary.moonlabWebGpuHadamardNativeOperationBlocker, null);
  assert.equal(summary.moonlabWebGpuPauliXNativeOperationDeclared, true);
  assert.equal(summary.moonlabWebGpuPauliXNativeOperationExecuted, true);
  assert.equal(summary.moonlabWebGpuPauliXNativeOperationPassed, true);
  assert.equal(summary.moonlabWebGpuPauliXNativeOperationCovered, true);
  assert.equal(summary.moonlabWebGpuPauliXNativeOperationBlocker, null);
  assert.equal(summary.moonlabComplex64PreflightPassed, true);
  assert.equal(summary.moonlabComplex64PreflightMaxProbabilityAbsDiff, 2.980232227667301e-8);
  assert.equal(summary.moonlabComplex64PreflightTolerance, 0.00001);
  assert.equal(summary.moonlabWebGpuParityScopeFullFidelityMagnetarSimulation, false);
  assert.equal(summary.moonlabWebGpuParityScopeFullPhysicsValidation, false);
  assert.equal(summary.moonlabWebGpuParityScopeFidelityRuntimeScope.runtimeScope, 'browser-webgpu-complex64-reduced-fixture-parity');
  assert.deepEqual(summary.moonlabWebGpuParityScopeBlockers, []);
  assert.equal(summary.moonlabWebGpuParityHandoffSummarySchema, 'moonlab.webgpu.complex64-parity-handoff-summary.v0');
  assert.equal(summary.moonlabWebGpuParityHandoffSummarySourceSchema, 'moonlab.webgpu.complex64-parity-scope.v0');
  assert.equal(
    summary.moonlabWebGpuParityHandoffSummaryArtifactKind,
    'browser-webgpu-complex64-parity-handoff-summary'
  );
  assert.equal(summary.moonlabWebGpuParityHandoffSummaryStatus, 'scope-ready-backend-detected');
  assert.equal(summary.moonlabWebGpuParityHandoffSummaryReady, true);
  assert.equal(summary.moonlabWebGpuParityHandoffSummaryReadinessClaim, 'integration-tolerance-gate-only');
  assert.equal(summary.moonlabWebGpuParityHandoffSummaryReducedFixtureOnly, true);
  assert.equal(summary.moonlabWebGpuParityHandoffSummaryReducedFixtureWebGpuParityReady, true);
  assert.equal(summary.moonlabWebGpuParityHandoffSummaryRuntimeBackendReady, false);
  assert.equal(summary.moonlabWebGpuParityHandoffSummaryBackendAvailable, true);
  assert.equal(summary.moonlabWebGpuParityHandoffSummaryBackendPreflightStage, 'device-acquired');
  assert.deepEqual(summary.moonlabWebGpuParityHandoffSummaryRequiredOperations, [
    'hadamard',
    'pauli_x',
    'pauli_z',
    'cnot',
    'compute_probabilities'
  ]);
  assert.deepEqual(summary.moonlabWebGpuParityHandoffSummaryCoveredOperations, [
    'hadamard',
    'pauli_x',
    'pauli_z',
    'cnot',
    'compute_probabilities'
  ]);
  assert.deepEqual(summary.moonlabWebGpuParityHandoffSummaryMissingOperations, []);
  assert.deepEqual(summary.moonlabWebGpuParityHandoffSummaryExcludedOperations, ['phase']);
  assert.deepEqual(summary.moonlabWebGpuParityHandoffSummaryBlockers, []);
  assert.deepEqual(summary.moonlabWebGpuParityHandoffSummaryValidationErrors, []);
  assert.equal(summary.moonlabWebGpuParityHandoffSummaryFullFidelityMagnetarSimulation, false);
  assert.equal(summary.moonlabWebGpuParityHandoffSummaryFullPhysicsValidation, false);
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
