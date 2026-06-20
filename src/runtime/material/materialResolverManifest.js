export const MATERIAL_RESOLVER_MANIFEST_SCHEMA = 'peercompute.ulg.material-resolver-manifest.v0';

export const MATERIAL_RESOLVER_STATUS = Object.freeze({
  CPU_DERIVED: 'cpu-derived',
  CPU_DERIVED_GPU_LOOKUP_CONSUMED: 'cpu-derived-gpu-lookup-consumed',
  CPU_BUILT_GPU_CONSUMED: 'cpu-built-gpu-consumed',
  MIXED_WEBGPU_RUNTIME_CPU_PROPERTY_DERIVED: 'mixed-webgpu-runtime-cpu-property-derived',
  CPU_DERIVED_GPU_CONTACT_CONSUMED: 'cpu-derived-gpu-contact-consumed',
  CPU_EMISSION_ONLY_NUCLEAR_PLANNED: 'cpu-emission-only-nuclear-planned',
  CPU_CONTROL_PLANE_POLICY: 'cpu-control-plane-policy'
});

export const MATERIAL_RESOLVER_VALIDATION_FLAGS = Object.freeze([
  'cpuReferenceParity',
  'webgpuParity',
  'scientificValidation',
  'productionReadiness'
]);

function validationFlags() {
  return Object.fromEntries(MATERIAL_RESOLVER_VALIDATION_FLAGS.map((flag) => [flag, false]));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

const resolverFamilies = [
  {
    id: 'peercompute.ulg.material-resolver.electronic-structure-band-optics.v0',
    family: 'electronic-structure-band-optics',
    label: 'Electronic structure and band optics',
    cpu: {
      status: 'known-cpu-entrypoints',
      entrypoints: [
        { module: 'src/runtime/electronicStructure/radialKohnSham.js', exports: ['solveAtom', 'solveKohnShamAtomKH', 'radialStatesKH'] },
        { module: 'src/runtime/material/elementClosures.js', exports: ['deriveElementProperties', 'elementMaterialClosure'] },
        { module: 'src/runtime/material/opticalClosure.js', exports: ['relativisticInterbandOscillators', 'metalRelativisticColorSrgb'] }
      ]
    },
    webgpuResidencyTarget: {
      target: 'webgpu-derived-resident-electronic-row-family',
      residency: 'worker-owned radial-grid, SCF, eigensolver, orbital, and interband oscillator buffers feeding material and optical rows without CPU recomputation'
    },
    cacheKeyIngredients: [
      'atomicNumberZ',
      'electronConfiguration',
      'solverVariant',
      'radialGridShape',
      'scfTolerance',
      'spinRelativisticFlags',
      'interbandModelParameters',
      'schemaVersion',
      'generatorFingerprint'
    ],
    currentStatus: MATERIAL_RESOLVER_STATUS.CPU_DERIVED,
    validationFlags: validationFlags()
  },
  {
    id: 'peercompute.ulg.material-resolver.molecular-geometry-md.v0',
    family: 'molecular-geometry-md',
    label: 'Molecular geometry and MD',
    cpu: {
      status: 'known-cpu-entrypoints',
      entrypoints: [
        { module: 'src/runtime/electronicStructure/molecularHartreeFock.js', exports: ['rhf', 'uhf', 'mp2', 'optimizeGeometry', 'vibrationalFrequencies', 'bornOppenheimerMD'] },
        { module: 'src/runtime/electronicStructure/allElementMolecularSolver.js', exports: ['allElementMolecularEnergy', 'allElementReactionEnergyHa'] },
        { module: 'src/runtime/material/materialDerivation.js', exports: ['formulaUnitGeometry', 'deriveFormulaMaterialProperties'] }
      ]
    },
    webgpuResidencyTarget: {
      target: 'webgpu-derived-resident-molecular-row-family',
      residency: 'batched small-molecule matrix, SCF, geometry, Hessian, and Born-Oppenheimer work queues producing reusable molecular closure rows'
    },
    cacheKeyIngredients: [
      'formulaAtomVector',
      'charge',
      'spinMultiplicity',
      'initialGeometryHash',
      'basisOrHamiltonianMethod',
      'optimizerOrMdStepPolicy',
      'temperatureBucket',
      'schemaVersion',
      'generatorFingerprint'
    ],
    currentStatus: MATERIAL_RESOLVER_STATUS.CPU_DERIVED,
    validationFlags: validationFlags()
  },
  {
    id: 'peercompute.ulg.material-resolver.thermodynamic-phase-eos.v0',
    family: 'thermodynamic-phase-eos',
    label: 'Thermodynamic phase and EOS',
    cpu: {
      status: 'known-cpu-entrypoints',
      entrypoints: [
        { module: 'src/runtime/material/phaseEquilibrium.js', exports: ['stablePhaseAt', 'stablePhaseFromSpecificEnergy', 'equilibriumFromSpecificEnergy'] },
        { module: 'src/runtime/material/thermoState.js', exports: ['specificInternalEnergyJPerKg', 'heatCapacityJPerKgK', 'orderedSegments'] },
        { module: 'src/runtime/material/gruneisenEos.js', exports: ['densityAtTemperature', 'createGruneisenEosClosure'] },
        { module: 'src/runtime/sph/sphThermalGpuKernel.js', exports: ['buildSphThermalMaterialTable', 'buildSphThermalPhaseResponseTable', 'resolveThermalStateFromTable'] }
      ]
    },
    webgpuResidencyTarget: {
      target: 'webgpu-built-resident-phase-response-graph',
      residency: 'resident phase segments, latent-heat ladders, EOS rows, and thermal graph banks consumed by thermal, mechanics, gas, optics, and render kernels'
    },
    cacheKeyIngredients: [
      'materialClosureHash',
      'phaseSegmentHash',
      'transitionLedgerHash',
      'eosModelHash',
      'temperatureEnergyBucketPolicy',
      'pressureDomain',
      'schemaVersion',
      'generatorFingerprint'
    ],
    currentStatus: MATERIAL_RESOLVER_STATUS.CPU_BUILT_GPU_CONSUMED,
    validationFlags: validationFlags()
  },
  {
    id: 'peercompute.ulg.material-resolver.mechanical-properties.v0',
    family: 'mechanical-properties',
    label: 'Mechanical properties',
    cpu: {
      status: 'known-cpu-entrypoints',
      entrypoints: [
        { module: 'src/runtime/material/elementClosures.js', exports: ['deriveElementProperties'] },
        { module: 'src/runtime/sph/multiMaterialEos.js', exports: ['createPhaseAwareEos'] },
        { module: 'src/runtime/sph/mlsMpmCarrier.js', exports: ['createMlsMpmCarrier'] },
        { module: 'src/runtime/sph/sphMechanicsGpuKernel.js', exports: ['predictMlsMpmMechanicsCpu', 'runMlsMpmMechanicsPredictWebGpu'] }
      ]
    },
    webgpuResidencyTarget: {
      target: 'webgpu-resident-mechanics-material-rows',
      residency: 'phase-aware density, bulk/shear modulus, sound-speed, viscosity, transport, and mechanics reset rows updated from GPU material and phase outputs'
    },
    cacheKeyIngredients: [
      'materialClosureHash',
      'phaseStateHash',
      'eosRowLayoutVersion',
      'mechanicsModelVersion',
      'transportModelVersion',
      'gridAndParticleAbiVersion',
      'schemaVersion',
      'generatorFingerprint'
    ],
    currentStatus: MATERIAL_RESOLVER_STATUS.MIXED_WEBGPU_RUNTIME_CPU_PROPERTY_DERIVED,
    validationFlags: validationFlags()
  },
  {
    id: 'peercompute.ulg.material-resolver.optical-pbr-closures.v0',
    family: 'optical-pbr-closures',
    label: 'Optical PBR closures',
    cpu: {
      status: 'known-cpu-entrypoints',
      entrypoints: [
        { module: 'src/runtime/material/opticalClosure.js', exports: ['opticalRenderParams', 'metalRelativisticColorSrgb', 'waterDropletOpticalMicrophysics'] },
        { module: 'src/runtime/material/opticalGpuBuffers.js', exports: ['buildOpticalGpuTable', 'runOpticalGpuLookupWithOptionalWebGpu'] }
      ]
    },
    webgpuResidencyTarget: {
      target: 'webgpu-derived-resident-optical-pbr-row-family',
      residency: 'spectral, Drude-Lorentz, CIE, opacity, emission-coupled, vapor, and droplet-scattering rows derived on GPU from electronic, molecular, and thermodynamic state rows'
    },
    cacheKeyIngredients: [
      'materialClosureHash',
      'phaseStateHash',
      'opticalStateBucket',
      'pathLengthBucket',
      'spectralGridVersion',
      'microstructureSummaryHash',
      'electronicBandRowHash',
      'schemaVersion',
      'generatorFingerprint'
    ],
    currentStatus: MATERIAL_RESOLVER_STATUS.CPU_DERIVED_GPU_LOOKUP_CONSUMED,
    validationFlags: validationFlags()
  },
  {
    id: 'peercompute.ulg.material-resolver.reaction-energetics-products.v0',
    family: 'reaction-energetics-products',
    label: 'Reaction energetics and products',
    cpu: {
      status: 'known-cpu-entrypoints',
      entrypoints: [
        { module: 'src/runtime/chemistry/formula.js', exports: ['describeChemicalFormula', 'tallyFormulaSide'] },
        { module: 'src/runtime/chemistry/reactionCandidates.js', exports: ['discoverReactionCandidates'] },
        { module: 'src/runtime/sph/reactionDiscovery.js', exports: ['discoverReactions', 'createReactionDiscoveryCacheKey'] },
        { module: 'src/runtime/sph/reactiveChemistry.js', exports: ['deriveReactionEnthalpyJPerKg', 'reactiveStep'] },
        { module: 'src/runtime/sph/sphReactionGpuKernel.js', exports: ['buildSphReactionTable', 'runSphReactionStepWebGpu'] }
      ]
    },
    webgpuResidencyTarget: {
      target: 'webgpu-resident-balanced-reaction-closure-rows',
      residency: 'balanced candidate, product-closure, energetics, extent, gas-byproduct, pressure, and atom-ledger buffers consumed by contact and chemistry kernels'
    },
    cacheKeyIngredients: [
      'reactantAtomVectors',
      'candidateFamilyId',
      'balancedEquationHash',
      'reactantMaterialClosureHashes',
      'productMaterialClosureHashes',
      'thermochemistryMethodHash',
      'phaseRequirementHash',
      'schemaVersion',
      'generatorFingerprint'
    ],
    currentStatus: MATERIAL_RESOLVER_STATUS.CPU_DERIVED_GPU_CONTACT_CONSUMED,
    validationFlags: validationFlags()
  },
  {
    id: 'peercompute.ulg.material-resolver.radiation-nuclear-closures.v0',
    family: 'radiation-nuclear-closures',
    label: 'Radiation and nuclear closures',
    cpu: {
      status: 'partial-cpu-entrypoints',
      entrypoints: [
        { module: 'src/runtime/material/radiationClosure.js', exports: ['createRadiationClosure', 'incandescentColor', 'blackbodyColorSrgb'] }
      ]
    },
    webgpuResidencyTarget: {
      target: 'webgpu-resident-radiation-nuclear-source-rows',
      residency: 'isotope, decay-channel, fission/fusion, radiation-deposition, ionization, radiolysis, and Cherenkov source buffers coupled into thermal, chemistry, gas, and optical kernels'
    },
    cacheKeyIngredients: [
      'isotopeInventoryHash',
      'decayChannelLibraryVersion',
      'particleSpectrumHash',
      'mediumOpticalRowHash',
      'transportGridHash',
      'depositionCouplingVersion',
      'schemaVersion',
      'generatorFingerprint'
    ],
    currentStatus: MATERIAL_RESOLVER_STATUS.CPU_EMISSION_ONLY_NUCLEAR_PLANNED,
    validationFlags: validationFlags()
  },
  {
    id: 'peercompute.ulg.material-resolver.cache-fingerprint-policy.v0',
    family: 'cache-fingerprint-policy',
    label: 'Cache and fingerprint policy',
    cpu: {
      status: 'known-cpu-control-plane',
      entrypoints: [
        { module: 'src/runtime/material/propertyProvenance.js', exports: ['materialDerivationSummary', 'requireFirstPrinciplesMaterialProperties'] },
        { module: 'src/runtime/material/MaterialRegistry.js', exports: ['MaterialRegistry'] },
        { module: 'src/runtime/material/materialPropertyBank.js', exports: ['normalizeMaterialPropertyBank', 'materialPropertyBankWarmInput'] },
        { module: 'src/runtime/sph/sphLocalClosureCache.js', exports: ['createSphLocalCacheLookup', 'createPeerClosureCacheWrite'] },
        { module: 'src/runtime/sph/sphColdStartCache.js', exports: ['parseSphColdStartCacheSnapshot', 'emptySphStaticTableCache'] }
      ]
    },
    webgpuResidencyTarget: {
      target: 'cpu-validated-webgpu-resident-closure-graph-policy',
      residency: 'CPU validates schemas, provenance, cache guards, and graph program hashes once; accepted flat node, edge, and program rows stay GPU-resident for resolver execution'
    },
    cacheKeyIngredients: [
      'schemaVersion',
      'recordSchema',
      'methodVersion',
      'inputHash',
      'methodHash',
      'validityDomainHash',
      'lowerLevelClosureHashes',
      'materialPropertyBankSchemaVersion',
      'materialPropertyBankGeneratorFingerprint',
      'webgpuProgramHash',
      'abiLayoutHash',
      'generatorFingerprint'
    ],
    currentStatus: MATERIAL_RESOLVER_STATUS.CPU_CONTROL_PLANE_POLICY,
    validationFlags: validationFlags()
  }
];

export const MATERIAL_RESOLVER_MANIFEST = deepFreeze({
  schema: MATERIAL_RESOLVER_MANIFEST_SCHEMA,
  families: resolverFamilies.map((entry) => deepFreeze(entry))
});

export function materialResolverFamilies() {
  return MATERIAL_RESOLVER_MANIFEST.families;
}

export function materialResolverFamilyById(id) {
  return MATERIAL_RESOLVER_MANIFEST.families.find((entry) => entry.id === id) || null;
}

export function materialResolverFamilyIds() {
  return MATERIAL_RESOLVER_MANIFEST.families.map((entry) => entry.id);
}
