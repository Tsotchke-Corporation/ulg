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
const MAGNETAR_DIPOLE_ISING_REFERENCE_CONTRACT_HASH = 'sha256:f85763af06f271c414d55e29884ee7b0d5738a4a7ec9351493964b98f8d4e1ec';

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
    const magnetarDipoleIsing = createMagnetarDipoleIsingCalibration(module);

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
        magnetarDipoleIsing,
        exports: {
          create: typeof module._quantum_state_create,
          destroy: typeof module._quantum_state_destroy,
          bellPhiPlus: typeof module._create_bell_state_phi_plus,
          isingModelCreate: typeof module._ising_model_create,
          isingModelEvaluate: typeof module._ising_model_evaluate
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

function createMagnetarDipoleIsingCalibration(module) {
  assertIsingExports(module);
  const input = {
    surfaceMagneticFieldTesla: 100000000000,
    stellarRadiusMeters: 10000,
    radialSamplesMeters: [10000, 15000, 20000],
    couplingStrength: 0.125,
    bitstrings: [0, 1, 2, 3, 4, 5, 6, 7]
  };
  const fieldScaleTesla = input.surfaceMagneticFieldTesla;
  const localFields = input.radialSamplesMeters.map((radiusMeters) => (
    -magnetarDipoleFieldTesla(input, radiusMeters) / fieldScaleTesla
  ));
  const couplings = [
    { qubit1: 0, qubit2: 1, value: -input.couplingStrength },
    { qubit1: 1, qubit2: 2, value: -input.couplingStrength }
  ];
  const model = {
    localFields,
    couplings,
    fieldScaleTesla,
    physicalModel: 'axisymmetric-dipole-falloff',
    spinConvention: 'bit-0-plus-one-bit-1-minus-one'
  };
  const modelPtr = module._ising_model_create(localFields.length);
  if (!modelPtr) {
    throw new Error('ising_model_create returned null');
  }

  try {
    localFields.forEach((field, qubit) => {
      const result = module._ising_model_set_field(modelPtr, qubit, field);
      if (result !== 0) throw new Error(`ising_model_set_field failed for qubit ${qubit}`);
    });
    couplings.forEach((coupling) => {
      const result = module._ising_model_set_coupling(
        modelPtr,
        coupling.qubit1,
        coupling.qubit2,
        coupling.value
      );
      if (result !== 0) {
        throw new Error(`ising_model_set_coupling failed for qubits ${coupling.qubit1}/${coupling.qubit2}`);
      }
    });

    const radialSamples = input.radialSamplesMeters.map((radiusMeters, qubit) => {
      const magneticFieldTesla = magnetarDipoleFieldTesla(input, radiusMeters);
      return {
        qubit,
        radiusMeters,
        magneticFieldTesla,
        normalizedField: magneticFieldTesla / fieldScaleTesla,
        localField: localFields[qubit]
      };
    });
    const evaluations = input.bitstrings.map((bitstring) => {
      const observedEnergy = module._ising_model_evaluate(modelPtr, BigInt(bitstring));
      const referenceEnergy = evaluateIsingReferenceEnergy(model, bitstring);
      return {
        bitstring,
        bitString: bitstring.toString(2).padStart(localFields.length, '0'),
        spins: bitstringToSpins(bitstring, localFields.length),
        observedEnergy,
        referenceEnergy,
        energyDelta: observedEnergy - referenceEnergy
      };
    });
    const maxEnergyDelta = evaluations.reduce((maxDelta, evaluation) => (
      Math.max(maxDelta, Math.abs(evaluation.energyDelta))
    ), 0);
    const groundState = evaluations.reduce((best, evaluation) => (
      evaluation.observedEnergy < best.observedEnergy ? evaluation : best
    ), evaluations[0]);
    const monotonicDipoleField = radialSamples.every((sample, index) => (
      index === 0 || sample.magneticFieldTesla <= radialSamples[index - 1].magneticFieldTesla
    ));
    const tolerance = 1e-9;
    const energyUnits = 'normalized-ising';
    const referenceContract = {
      schema: 'moonlab.magnetar-dipole-ising-reference.v0',
      role: 'peercompute-reference-tolerance-input',
      target: 'magnetar-dipole-normalized-ising',
      contractHash: MAGNETAR_DIPOLE_ISING_REFERENCE_CONTRACT_HASH,
      energyUnits,
      hamiltonian: {
        form: 'H=sum_i localFields[i]*spins[i]+sum_c couplings[c].value*spins[c.qubit1]*spins[c.qubit2]',
        localFields: model.localFields,
        couplings: model.couplings,
        fieldScaleTesla: model.fieldScaleTesla,
        physicalModel: model.physicalModel,
        spinConvention: model.spinConvention,
        input: {
          surfaceMagneticFieldTesla: input.surfaceMagneticFieldTesla,
          stellarRadiusMeters: input.stellarRadiusMeters,
          radialSamplesMeters: input.radialSamplesMeters,
          couplingStrength: input.couplingStrength
        }
      },
      observables: {
        groundState: {
          bitstring: groundState.bitstring,
          bitString: groundState.bitString,
          referenceEnergy: groundState.referenceEnergy
        },
        energySpectrum: evaluations.map((evaluation) => ({
          bitstring: evaluation.bitstring,
          bitString: evaluation.bitString,
          spins: evaluation.spins,
          referenceEnergy: evaluation.referenceEnergy
        }))
      },
      tolerances: {
        energyAbs: tolerance,
        maxObservedEnergyDelta: maxEnergyDelta,
        numericPrecision: 'float64'
      },
      validation: {
        parityPassed: maxEnergyDelta <= tolerance,
        maxEnergyDelta,
        evaluatedBitstrings: evaluations.length
      }
    };

    return {
      schema: 'peercompute.ulg.magnetar-dipole-ising-calibration.v0',
      sample: 'magnetar_dipole_ising',
      taskKind: 'magnetar-dipole-ising-calibration',
      method: 'moonlab-wasm-ising-evaluator',
      representation: 'magnetar-dipole-normalized-ising-calibration',
      input,
      radialSamples,
      isingModel: model,
      evaluations,
      reference: referenceContract,
      responseDescriptor: {
        schema: 'peercompute.ulg.quantum-response-descriptor.v0',
        sample: 'magnetar_dipole_ising',
        qubitCount: localFields.length,
        basis: {
          kind: 'ising-bitstring',
          ordering: 'little-endian-spin-index',
          states: input.bitstrings.map((bitstring) => bitstring.toString(2).padStart(localFields.length, '0'))
        },
        representation: {
          state: 'ising-energy-landscape',
          energyDType: 'f64',
          fieldDType: 'f64',
          couplingDType: 'f64'
        },
        deterministic: true,
        expectedEnergies: evaluations.map((evaluation) => evaluation.referenceEnergy),
        observedEnergies: evaluations.map((evaluation) => evaluation.observedEnergy),
        invariants: {
          maxEnergyDelta,
          groundStateBitString: groundState.bitString,
          monotonicDipoleField
        }
      },
      parity: {
        schema: 'peercompute.ulg.quantum-response-parity.v0',
        sample: 'magnetar_dipole_ising',
        status: maxEnergyDelta <= tolerance && monotonicDipoleField ? 'pass' : 'warn',
        tolerance,
        reference: {
          mode: 'javascript-ising-energy-reference',
          energies: evaluations.map((evaluation) => evaluation.referenceEnergy)
        },
        comparisons: [
          {
            mode: 'moonlab-wasm-ising',
            status: maxEnergyDelta <= tolerance ? 'pass' : 'warn',
            observedEnergies: evaluations.map((evaluation) => evaluation.observedEnergy),
            maxEnergyDelta
          }
        ],
        metrics: {
          maxEnergyDelta,
          parityGap: maxEnergyDelta,
          unsupportedModeCount: 0
        }
      },
      validation: {
        status: maxEnergyDelta <= tolerance && monotonicDipoleField ? 'pass' : 'warn',
        checks: [
          {
            name: 'ising-energy-parity',
            passed: maxEnergyDelta <= tolerance,
            details: { maxEnergyDelta, tolerance }
          },
          {
            name: 'dipole-field-monotonicity',
            passed: monotonicDipoleField,
            details: {
              radialSamples: radialSamples.map(({ radiusMeters, magneticFieldTesla }) => ({
                radiusMeters,
                magneticFieldTesla
              }))
            }
          }
        ]
      },
      summary: {
        numQubits: localFields.length,
        evaluatedBitstrings: evaluations.length,
        groundState: {
          bitstring: groundState.bitstring,
          bitString: groundState.bitString,
          observedEnergy: groundState.observedEnergy,
          referenceEnergy: groundState.referenceEnergy,
          energyUnits
        },
        maxEnergyDelta,
        scope: 'calibration-probe-not-full-magnetar-simulation'
      }
    };
  } finally {
    module._ising_model_free(modelPtr);
  }
}

function assertIsingExports(module) {
  for (const name of [
    '_ising_model_create',
    '_ising_model_free',
    '_ising_model_set_coupling',
    '_ising_model_set_field',
    '_ising_model_evaluate'
  ]) {
    if (typeof module[name] !== 'function') {
      throw new Error(`MoonLab runtime missing ${name}`);
    }
  }
}

function magnetarDipoleFieldTesla(input, radiusMeters) {
  return input.surfaceMagneticFieldTesla * (input.stellarRadiusMeters / radiusMeters) ** 3;
}

function bitstringToSpins(bitstring, numQubits) {
  return Array.from({ length: numQubits }, (_, qubit) => (
    ((bitstring >> qubit) & 1) === 0 ? 1 : -1
  ));
}

function evaluateIsingReferenceEnergy(model, bitstring) {
  const spins = bitstringToSpins(bitstring, model.localFields.length);
  const fieldEnergy = model.localFields.reduce((total, field, qubit) => (
    total + field * spins[qubit]
  ), 0);
  const couplingEnergy = model.couplings.reduce((total, coupling) => (
    total + coupling.value * spins[coupling.qubit1] * spins[coupling.qubit2]
  ), 0);
  return fieldEnergy + couplingEnergy;
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
