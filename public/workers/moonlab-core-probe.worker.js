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
const MAGNETOSPHERE_MHD_ANALYTIC_UNITS_HASH = 'sha256:b9ef2d46ec5f2d0c1fb8a2866012e9340a67f188ebc8a579b93ce61e72f4b4a5';

async function runMoonLabCoreProbe({ childId, serviceAssets = {} }) {
  self.postMessage({ type: 'progress', childId, progress: 0.15, sample: 0 });
  const module = await loadMoonLabModule(serviceAssets);
  const referenceContracts = await loadMagnetarReferenceContracts(serviceAssets);
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
    const magnetarDipoleIsing = createMagnetarDipoleIsingCalibration(module, referenceContracts.references);

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
        referenceContracts: {
          status: referenceContracts.status,
          url: referenceContracts.url,
          count: referenceContracts.references.length,
          reason: referenceContracts.reason
        },
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

function createMagnetarDipoleIsingCalibration(module, suppliedReferences = []) {
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
      references: createMagnetarReferenceFamilyInventory(suppliedReferences),
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

function createMagnetarReferenceFamilyInventory(suppliedReferences = []) {
  const inventory = [
    createAnalyticMagnetosphereMhdReference(),
    {
      id: 'pic-kinetic-plasma-reference',
      family: 'pic-kinetic-plasma',
      provider: 'moonlab',
      solverId: null,
      schema: 'moonlab.magnetar.calibrated-reference.v0',
      role: 'peercompute-scientific-tolerance-input',
      contractHash: null,
      unitsHash: null,
      fieldMap: null,
      fieldTolerances: null,
      fieldObservedDeltas: null,
      label: 'PIC kinetic plasma calibrated reference family',
      status: 'calibrated-reference-missing',
      ready: false,
      scientificCoverage: false,
      scope: 'inventory-only-not-scientific-reference',
      validationStatus: 'missing',
      validation: {
        status: 'missing',
        evidence: []
      },
      blocker: 'calibrated-pic-reference-missing',
      blockers: [
        'No calibrated PIC benchmark data is bundled with this artifact.',
        'No particle-field coupling parity run has been compared against the normalized Ising calibration.',
        'No particle distribution, timestep, or plasma parameter tolerances are defined.'
      ]
    },
    {
      id: 'radiation-transport-reference',
      family: 'radiation-transport',
      provider: 'moonlab',
      solverId: null,
      schema: 'moonlab.magnetar.calibrated-reference.v0',
      role: 'peercompute-scientific-tolerance-input',
      contractHash: null,
      unitsHash: null,
      fieldMap: null,
      fieldTolerances: null,
      fieldObservedDeltas: null,
      label: 'Radiation transport calibrated reference family',
      status: 'calibrated-reference-missing',
      ready: false,
      scientificCoverage: false,
      scope: 'inventory-only-not-scientific-reference',
      validationStatus: 'missing',
      validation: {
        status: 'missing',
        evidence: []
      },
      blocker: 'calibrated-radiation-reference-missing',
      blockers: [
        'No calibrated radiation benchmark data is bundled with this artifact.',
        'No opacity, emissivity, or radiation-transport parity run has been compared against the normalized Ising calibration.',
        'No spectral, angular, or transport error tolerances are defined.'
      ]
    },
    {
      id: 'relativistic-correction-reference',
      family: 'relativistic-correction',
      provider: 'moonlab',
      solverId: null,
      schema: 'moonlab.magnetar.calibrated-reference.v0',
      role: 'peercompute-scientific-tolerance-input',
      contractHash: null,
      unitsHash: null,
      fieldMap: null,
      fieldTolerances: null,
      fieldObservedDeltas: null,
      label: 'Relativistic correction calibrated reference family',
      status: 'calibrated-reference-missing',
      ready: false,
      scientificCoverage: false,
      scope: 'inventory-only-not-scientific-reference',
      validationStatus: 'missing',
      validation: {
        status: 'missing',
        evidence: []
      },
      blocker: 'calibrated-relativity-reference-missing',
      blockers: [
        'No calibrated relativity benchmark data is bundled with this artifact.',
        'No frame, metric, or relativistic-correction parity run has been compared against the normalized Ising calibration.',
        'No gauge, coordinate, or correction-order tolerances are defined.'
      ]
    }
  ];
  return mergeSuppliedMagnetarReferenceContracts(inventory, suppliedReferences);
}

function createAnalyticMagnetosphereMhdReference() {
  const fieldMap = {
    radiusMeters: 'outputs.radialSamples[].radiusMeters',
    magneticFieldTesla: 'outputs.radialSamples[].magneticFieldTesla',
    normalizedField: 'outputs.radialSamples[].normalizedField',
    radialPowerLaw: 'B(r)=B_surface*(R/r)^3',
    divergenceProxy: 'analytic exterior dipole field; no finite-volume divergence solve'
  };
  const fieldTolerances = {
    magneticFieldTeslaRel: 1e-12,
    normalizedFieldAbs: 1e-12,
    radialPowerLawAbs: 1e-12,
    divergenceProxyAbs: 0
  };
  const fieldObservedDeltas = {
    magneticFieldTeslaRel: 0,
    normalizedFieldAbs: 0,
    radialPowerLawAbs: 0,
    divergenceProxyAbs: 0
  };
  return {
    id: 'magnetosphere-mhd-reference',
    family: 'magnetosphere-mhd',
    provider: 'moonlab',
    solverId: 'moonlab-analytic-dipole-field-v0',
    schema: 'moonlab.magnetar.calibrated-reference.v0',
    role: 'peercompute-scientific-tolerance-input',
    contractHash: MAGNETAR_DIPOLE_ISING_REFERENCE_CONTRACT_HASH,
    unitsHash: MAGNETOSPHERE_MHD_ANALYTIC_UNITS_HASH,
    fieldMap,
    fieldTolerances,
    fieldObservedDeltas,
    label: 'Magnetosphere analytic dipole field reference',
    status: 'calibrated-reference-ready',
    ready: true,
    scientificCoverage: true,
    scope: 'analytic-dipole-magnetosphere-reference-not-full-mhd',
    validationStatus: 'pass',
    validation: {
      status: 'pass',
      evidence: [
        'Radial magnetic field samples are generated by the analytic dipole law B(r)=B_surface*(R/r)^3.',
        'The normalized field map is deterministic and unit-scoped to meters, tesla, and dimensionless field ratios.',
        'This validates a reduced exterior dipole-field benchmark only; it is not a full resistive-MHD or force-free magnetosphere solve.'
      ],
      maxObservedDeltas: fieldObservedDeltas
    },
    blocker: null,
    blockers: []
  };
}

function mergeSuppliedMagnetarReferenceContracts(inventory, suppliedReferences = []) {
  if (!Array.isArray(suppliedReferences) || suppliedReferences.length === 0) {
    return inventory;
  }
  return inventory.map((entry) => {
    const supplied = suppliedReferences.find((candidate) => (
      candidate?.id === entry.id || candidate?.family === entry.family
    ));
    return supplied ? normalizeSuppliedMagnetarReferenceContract(entry, supplied) : entry;
  });
}

function normalizeSuppliedMagnetarReferenceContract(fallback, supplied) {
  const fieldMap = cloneRecordOrNull(supplied.fieldMap);
  const fieldTolerances = cloneRecordOrNull(supplied.fieldTolerances);
  const fieldObservedDeltas = cloneRecordOrNull(supplied.fieldObservedDeltas);
  const validation = isRecord(supplied.validation) ? supplied.validation : {};
  const validationStatus = supplied.validationStatus === 'pass' || validation.status === 'pass'
    ? 'pass'
    : 'missing';
  const contractHash = digestOrNull(supplied.contractHash);
  const unitsHash = digestOrNull(supplied.unitsHash);
  const solverId = typeof supplied.solverId === 'string' && supplied.solverId.length > 0
    ? supplied.solverId
    : null;
  const evidence = Array.isArray(validation.evidence)
    ? validation.evidence.map((entry) => String(entry))
    : [];
  const ready = supplied.ready === true
    && supplied.scientificCoverage === true
    && solverId != null
    && contractHash != null
    && unitsHash != null
    && fieldMap != null
    && fieldTolerances != null
    && fieldObservedDeltas != null
    && validationStatus === 'pass'
    && fieldDeltasWithinTolerances(fieldObservedDeltas, fieldTolerances);

  if (!ready) {
    return {
      ...fallback,
      blockers: [
        ...(Array.isArray(fallback.blockers) ? fallback.blockers : []),
        'Supplied calibrated reference did not satisfy readiness requirements.'
      ]
    };
  }

  return {
    id: fallback.id,
    family: fallback.family,
    provider: 'moonlab',
    solverId,
    schema: 'moonlab.magnetar.calibrated-reference.v0',
    role: 'peercompute-scientific-tolerance-input',
    contractHash,
    unitsHash,
    fieldMap,
    fieldTolerances,
    fieldObservedDeltas,
    label: typeof supplied.label === 'string' && supplied.label.length > 0 ? supplied.label : fallback.label,
    status: 'calibrated-reference-ready',
    ready: true,
    scientificCoverage: true,
    scope: supplied.scope === 'analytic-dipole-magnetosphere-reference-not-full-mhd'
      ? supplied.scope
      : 'supplied-calibrated-reference-contract',
    validationStatus: 'pass',
    validation: {
      status: 'pass',
      evidence,
      maxObservedDeltas: fieldObservedDeltas
    },
    blocker: null,
    blockers: []
  };
}

function fieldDeltasWithinTolerances(observed, tolerances) {
  const entries = Object.entries(tolerances);
  if (entries.length === 0) return false;
  return entries.every(([key, tolerance]) => {
    const observedValue = Number(observed[key]);
    const toleranceValue = normalizeToleranceValue(tolerance);
    return Number.isFinite(observedValue)
      && toleranceValue != null
      && Math.abs(observedValue) <= toleranceValue;
  });
}

function normalizeToleranceValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.abs(value);
  }
  if (!isRecord(value)) return null;
  for (const key of ['abs', 'rel', 'value']) {
    const candidate = Number(value[key]);
    if (Number.isFinite(candidate)) {
      return Math.abs(candidate);
    }
  }
  return null;
}

function cloneRecordOrNull(value) {
  return isRecord(value) && Object.keys(value).length > 0 ? { ...value } : null;
}

function digestOrNull(value) {
  return typeof value === 'string' && value.startsWith('sha256:') ? value : null;
}

function isRecord(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
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

async function loadMagnetarReferenceContracts(serviceAssets) {
  const url = serviceAssets.referenceContractModule
    ? toAbsoluteUrl(serviceAssets.referenceContractModule)
    : null;
  if (!url) {
    return {
      status: 'skipped',
      url,
      references: [],
      reason: 'reference contract asset not declared'
    };
  }
  if (typeof fetch !== 'function') {
    return {
      status: 'unavailable',
      url,
      references: [],
      reason: 'fetch is unavailable in this runtime'
    };
  }

  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      return {
        status: response.status === 404 ? 'missing' : 'error',
        url,
        references: [],
        reason: `HTTP ${response.status}`
      };
    }
    const contentType = String(response.headers?.get?.('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (contentType === 'text/html') {
      return {
        status: 'missing',
        url,
        references: [],
        reason: 'HTML fallback returned for optional reference contract asset'
      };
    }
    if (!contentType.includes('json')) {
      return {
        status: 'error',
        url,
        references: [],
        reason: contentType ? `unexpected content type ${contentType}` : 'missing content type'
      };
    }
    const parsed = await response.json();
    const references = Array.isArray(parsed)
      ? parsed
      : (Array.isArray(parsed?.references)
        ? parsed.references
        : (Array.isArray(parsed?.outputs?.references) ? parsed.outputs.references : []));
    return {
      status: references.length > 0 ? 'ready' : 'empty',
      url,
      references,
      reason: references.length > 0 ? null : 'reference contract asset has no references[] entries'
    };
  } catch (error) {
    return {
      status: 'error',
      url,
      references: [],
      reason: error instanceof Error ? error.message : String(error)
    };
  }
}

function toAbsoluteUrl(value) {
  return new URL(value, self.location.href).href;
}
