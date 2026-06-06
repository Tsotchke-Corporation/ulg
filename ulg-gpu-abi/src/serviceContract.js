import {
  ULG_GPU_ABI_VERSION,
  ULG_IR_VERSION,
  createProvenanceBlock,
  hashPayload
} from './index.js';

export const ULG_SERVICE_PROTOCOL_VERSION = '0.5';

export const ULG_SERVICE_IDS = Object.freeze({
  eshkol: 'eshkol',
  moonlab: 'moonlab'
});

export const ULG_TASK_KINDS = Object.freeze({
  closureDerive: 'eshkol.closure.derive',
  quantumResponse: 'moonlab.quantum.response'
});

export const ULG_ARTIFACT_KINDS = Object.freeze({
  closure: 'closure',
  quantumResponse: 'quantum-response'
});

export const ULG_SERVICE_ASSET_ROOT = '/service-assets';

export const ULG_DEFAULT_SUPPORTED_DTYPES = Object.freeze(['f32', 'complex64']);
export const ULG_DEFAULT_SUPPORTED_LAYOUTS = Object.freeze(['soa', 'interleaved', 'row-major']);

export const ULG_SERVICE_CAPABILITIES = deepFreeze({
  [ULG_SERVICE_IDS.eshkol]: [
    'ulg.closure.derive',
    'ulg.table.generate',
    'ulg.validation.reference'
  ],
  [ULG_SERVICE_IDS.moonlab]: [
    'ulg.quantum.response',
    'ulg.parity.cpu_webgpu',
    'ulg.tensor.contract'
  ]
});

export const ULG_SERVICE_TASK_KINDS = deepFreeze({
  [ULG_SERVICE_IDS.eshkol]: [ULG_TASK_KINDS.closureDerive],
  [ULG_SERVICE_IDS.moonlab]: [ULG_TASK_KINDS.quantumResponse]
});

const SERVICE_CONTRACTS = deepFreeze({
  [ULG_SERVICE_IDS.eshkol]: {
    capabilities: ULG_SERVICE_CAPABILITIES[ULG_SERVICE_IDS.eshkol],
    taskKinds: ULG_SERVICE_TASK_KINDS[ULG_SERVICE_IDS.eshkol],
    toleranceProfile: 'scientific-default',
    outputArtifactKind: ULG_ARTIFACT_KINDS.closure
  },
  [ULG_SERVICE_IDS.moonlab]: {
    capabilities: ULG_SERVICE_CAPABILITIES[ULG_SERVICE_IDS.moonlab],
    taskKinds: ULG_SERVICE_TASK_KINDS[ULG_SERVICE_IDS.moonlab],
    toleranceProfile: 'quantum-response-demo',
    outputArtifactKind: ULG_ARTIFACT_KINDS.quantumResponse
  }
});

const DEFAULT_CHILD_WORKER_POLICY = Object.freeze({
  allowed: true,
  maxChildren: 4,
  allowedModules: Object.freeze([]),
  sameOriginOnly: true
});

const DEFAULT_SERVICE_RESOURCES = Object.freeze({
  maxWasmMemoryBytes: 64 * 1024 * 1024,
  maxGpuMemoryBytes: 32 * 1024 * 1024,
  maxCpuWorkers: 4,
  maxTaskMs: 30_000
});

const DEFAULT_TASK_RESOURCES = Object.freeze({
  childWorkers: 2,
  gpu: 'optional',
  wasmMemoryBytes: 8 * 1024 * 1024,
  gpuMemoryBytes: 4 * 1024 * 1024,
  priority: 'simulation'
});

export function listUlgServiceContracts() {
  return Object.keys(SERVICE_CONTRACTS).map((serviceId) => getUlgServiceContract(serviceId));
}

export function getUlgServiceContract(serviceId) {
  const contract = SERVICE_CONTRACTS[serviceId];
  if (!contract) {
    throw new RangeError(`Unsupported ULG serviceId: ${serviceId}`);
  }
  return {
    serviceId,
    capabilities: [...contract.capabilities],
    taskKinds: [...contract.taskKinds],
    toleranceProfile: contract.toleranceProfile,
    outputArtifactKind: contract.outputArtifactKind
  };
}

export function createUlgServiceAssetSpec({
  serviceId,
  rootPath = ULG_SERVICE_ASSET_ROOT,
  loaderFile,
  wasmFile,
  locateFileProbe,
  coreProbeWorkerModule,
  required = []
}) {
  if (!serviceId) {
    throw new Error('serviceId is required for ULG service asset specs');
  }

  const baseUrl = joinUrl(rootPath, serviceId, '');
  const files = compact({
    loaderModule: loaderFile,
    wasmModule: wasmFile
  });

  return compact({
    serviceId,
    rootPath,
    baseUrl,
    loaderModule: loaderFile ? joinUrl(baseUrl, loaderFile) : undefined,
    wasmModule: wasmFile ? joinUrl(baseUrl, wasmFile) : undefined,
    locateFileProbe,
    coreProbeWorkerModule,
    required,
    files
  });
}

export function createMoonLabServiceAssetSpec(options = {}) {
  return createUlgServiceAssetSpec({
    serviceId: ULG_SERVICE_IDS.moonlab,
    loaderFile: 'moonlab.js',
    wasmFile: 'moonlab.wasm',
    locateFileProbe: 'moonlab.wasm',
    coreProbeWorkerModule: '/workers/moonlab-core-probe.worker.js',
    required: ['loaderModule', 'wasmModule'],
    ...options
  });
}

export function createUlgServiceManifest({
  serviceId,
  version = '0.5.0-demo',
  runtime = 'js',
  workerModule,
  loaderModule,
  wasmModule,
  initExport,
  serviceAssets,
  childWorkerModule,
  childWorkers = {},
  resources = {},
  capabilities,
  taskKinds,
  abi = {},
  validation = {}
}) {
  if (!workerModule) {
    throw new Error('workerModule is required for ULG service manifests');
  }

  const contract = getUlgServiceContract(serviceId);
  const resolvedLoaderModule = loaderModule ?? serviceAssets?.loaderModule;
  const resolvedWasmModule = wasmModule ?? serviceAssets?.wasmModule;
  const allowedModules = [...(childWorkers.allowedModules ?? [])];
  if (childWorkerModule && !allowedModules.includes(childWorkerModule)) {
    allowedModules.push(childWorkerModule);
  }
  if (serviceAssets?.coreProbeWorkerModule && !allowedModules.includes(serviceAssets.coreProbeWorkerModule)) {
    allowedModules.push(serviceAssets.coreProbeWorkerModule);
  }
  const entry = compact({
    workerModule,
    loaderModule: resolvedLoaderModule,
    wasmModule: resolvedWasmModule,
    initExport,
    serviceAssets
  });

  return {
    serviceId,
    version,
    runtime,
    entry,
    childWorkers: {
      ...DEFAULT_CHILD_WORKER_POLICY,
      ...childWorkers,
      allowedModules
    },
    resources: {
      ...DEFAULT_SERVICE_RESOURCES,
      ...resources
    },
    capabilities: [...(capabilities ?? contract.capabilities)],
    taskKinds: [...(taskKinds ?? contract.taskKinds)],
    abi: {
      ulgIrVersion: ULG_IR_VERSION,
      gpuAbiVersion: ULG_GPU_ABI_VERSION,
      supportedDTypes: [...ULG_DEFAULT_SUPPORTED_DTYPES],
      supportedLayouts: [...ULG_DEFAULT_SUPPORTED_LAYOUTS],
      ...abi
    },
    validation: {
      requiresCpuReference: true,
      toleranceProfile: contract.toleranceProfile,
      parityModes: ['wasm-reference', 'js-dummy-reference'],
      ...validation
    }
  };
}

export function createUlgTaskCapsule({
  taskId,
  rootTaskId = taskId,
  serviceId,
  taskKind,
  inputs = [],
  outputs,
  units = { units: 'demo' },
  unitsHash,
  input = {},
  inputHash,
  method,
  methodHash,
  deterministicSeed = 'ulg-demo-seed',
  resources = {},
  validation = {},
  provenance,
  provenanceNotes = ['ulg-service-contract']
}) {
  if (!taskId) {
    throw new Error('taskId is required for ULG task capsules');
  }

  const contract = getUlgServiceContract(serviceId);
  const resolvedTaskKind = taskKind ?? contract.taskKinds[0];
  const resolvedMethod = method ?? { serviceId, taskKind: resolvedTaskKind, version: '0.5-demo' };
  const resolvedInputHash = inputHash ?? hashPayload(input);
  const resolvedMethodHash = methodHash ?? hashPayload(resolvedMethod);

  return {
    taskId,
    rootTaskId,
    serviceId,
    taskKind: resolvedTaskKind,
    inputs,
    outputs: outputs ?? [{ artifactKind: contract.outputArtifactKind }],
    unitsHash: unitsHash ?? hashPayload(units),
    inputHash: resolvedInputHash,
    methodHash: resolvedMethodHash,
    deterministicSeed,
    resources: {
      ...DEFAULT_TASK_RESOURCES,
      ...resources
    },
    validation: {
      mode: 'self',
      toleranceProfile: 'demo-parity',
      ...validation
    },
    provenance: provenance ?? createProvenanceBlock({
      sourceService: serviceId,
      methodHash: resolvedMethodHash,
      inputHash: resolvedInputHash,
      deterministicSeed,
      notes: provenanceNotes
    })
  };
}

function compact(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

function joinUrl(...parts) {
  const [first = '', ...rest] = parts;
  let path = String(first).replace(/\/+$/, '');
  for (const part of rest) {
    const value = String(part);
    if (value === '') {
      path = `${path}/`;
      continue;
    }
    path = `${path}/${value.replace(/^\/+|\/+$/g, '')}`;
  }
  return path || '/';
}

function deepFreeze(value) {
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => deepFreeze(item)));
  }
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      value[key] = deepFreeze(value[key]);
    }
    return Object.freeze(value);
  }
  return value;
}
