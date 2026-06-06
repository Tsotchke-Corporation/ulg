self.addEventListener('message', (event) => {
  const message = event.data;
  if (message.type === 'start') {
    runMoonLabCoreProbe(message).catch((error) => {
      self.postMessage({
        type: 'complete',
        childId: message.childId,
        coreProbe: {
          status: 'error',
          reason: String(error?.message ?? error)
        }
      });
    });
  }
  if (message.type === 'cancel') {
    self.postMessage({ type: 'cancelled', childId: message.childId });
    self.close();
  }
});

let modulePromise = null;

async function runMoonLabCoreProbe({ childId, serviceAssets = {} }) {
  self.postMessage({ type: 'progress', childId, progress: 0.15, sample: 0 });
  const module = await loadMoonLabModule(serviceAssets);
  self.postMessage({ type: 'progress', childId, progress: 0.55, sample: 0.5 });

  const state = module._quantum_state_create(2);
  if (!state) {
    throw new Error('quantum_state_create returned null');
  }

  try {
    const bellError = module._create_bell_state_phi_plus(state, 0, 1);
    const probabilities = [0n, 1n, 2n, 3n].map((basis) => (
      module._quantum_state_get_probability(state, basis)
    ));
    const expected = [0.5, 0, 0, 0.5];
    const probabilitySum = probabilities.reduce((sum, value) => sum + value, 0);
    const maxProbabilityError = probabilities.reduce((maxError, probability, index) => (
      Math.max(maxError, Math.abs(probability - expected[index]))
    ), 0);
    const purity = module._quantum_state_purity(state);
    const entropy = module._quantum_state_entropy(state);

    self.postMessage({
      type: 'complete',
      childId,
      coreProbe: {
        status: 'ready',
        sample: 'bell_phi_plus',
        bellError,
        probabilities,
        expectedProbabilities: expected,
        maxProbabilityError,
        probabilitySum,
        purity,
        entropy,
        responseDescriptor: createBellPhiPlusResponseDescriptor({
          probabilities,
          expected,
          probabilitySum,
          purity,
          entropy
        }),
        parity: createBellPhiPlusParityReport({
          probabilities,
          expected,
          probabilitySum,
          purity,
          entropy,
          maxProbabilityError
        }),
        exports: {
          create: typeof module._quantum_state_create,
          destroy: typeof module._quantum_state_destroy,
          bellPhiPlus: typeof module._create_bell_state_phi_plus
        },
        loaderModule: serviceAssets.loaderModule,
        wasmModule: serviceAssets.wasmModule
      }
    });
  } finally {
    module._quantum_state_destroy(state);
  }
}

function createBellPhiPlusResponseDescriptor({
  probabilities,
  expected,
  probabilitySum,
  purity,
  entropy
}) {
  return {
    schema: 'peercompute.ulg.quantum-response-descriptor.v0',
    sample: 'bell_phi_plus',
    qubitCount: 2,
    basis: {
      kind: 'computational',
      ordering: 'little-endian-basis-index',
      states: ['00', '01', '10', '11']
    },
    representation: {
      state: 'state_vector',
      amplitudeDType: 'complex64',
      probabilityDType: 'f64',
      probabilityLayout: 'basis-index-vector'
    },
    deterministic: true,
    expectedProbabilities: expected,
    observedProbabilities: probabilities,
    invariants: {
      probabilitySum,
      normalizationDelta: Math.abs(probabilitySum - 1),
      purity,
      entropy
    }
  };
}

function createBellPhiPlusParityReport({
  probabilities,
  expected,
  probabilitySum,
  purity,
  entropy,
  maxProbabilityError
}) {
  const tolerance = 1e-9;
  const normalizationDelta = Math.abs(probabilitySum - 1);
  return {
    schema: 'peercompute.ulg.quantum-response-parity.v0',
    sample: 'bell_phi_plus',
    status: maxProbabilityError <= tolerance && normalizationDelta <= tolerance ? 'pass' : 'warn',
    tolerance,
    reference: {
      mode: 'analytic-bell-phi-plus',
      probabilities: expected
    },
    comparisons: [
      {
        mode: 'moonlab-wasm-core',
        status: maxProbabilityError <= tolerance ? 'pass' : 'warn',
        observedProbabilities: probabilities,
        maxProbabilityError,
        normalizationDelta,
        purity,
        entropy
      },
      {
        mode: 'moonlab-webgpu',
        status: 'unsupported',
        reason: 'moonlab-webgpu-response-kernel-unavailable',
        maxProbabilityError: null
      }
    ],
    metrics: {
      maxProbabilityError,
      normalizationDelta,
      parityGap: null,
      unsupportedModeCount: 1
    }
  };
}

async function loadMoonLabModule(serviceAssets) {
  if (!modulePromise) {
    const loaderModule = toAbsoluteUrl(serviceAssets.loaderModule ?? '/service-assets/moonlab/moonlab.js');
    importScripts(loaderModule);
    const moduleFactory = globalThis.MoonlabModule;
    if (!moduleFactory) {
      throw new Error('MoonlabModule was not registered by the runtime loader');
    }
    modulePromise = moduleFactory({
      locateFile(path) {
        if (path.endsWith('.wasm')) {
          return toAbsoluteUrl(serviceAssets.wasmModule ?? '/service-assets/moonlab/moonlab.wasm');
        }
        if (serviceAssets.baseUrl) {
          return toAbsoluteUrl(new URL(path, toAbsoluteUrl(serviceAssets.baseUrl)).href);
        }
        return path;
      }
    }).then((module) => module.ready ?? module);
  }
  return modulePromise;
}

function toAbsoluteUrl(value) {
  return new URL(value, self.location.href).href;
}
