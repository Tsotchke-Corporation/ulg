export const ULG_RESIDENT_STATE_AUTHORITY_LEDGER_SCHEMA = 'peercompute.ulg.resident-state-authority-ledger.v0';
export const ULG_RESIDENT_STATE_AUTHORITY_ENTRY_SCHEMA = 'peercompute.ulg.resident-state-authority-entry.v0';
export const ULG_RESIDENT_STATE_AUTHORITY_SUMMARY_SCHEMA = 'peercompute.ulg.resident-state-authority-summary.v0';

export const RESIDENT_STATE_FAMILIES = Object.freeze({
  PARTICLE_KINEMATICS: 'particle-kinematics',
  MECHANICS: 'mechanics',
  THERMO_PHASE: 'thermo-phase',
  GRID_ACCUMULATORS: 'grid-accumulators',
  GRID_UPDATE: 'grid-update',
  REACTION_PRODUCTS: 'reaction-products',
  GAS_PRESSURE: 'gas-pressure',
  PRESSURE_INTERFACE: 'pressure-interface',
  SCHROEDER_FAR_FORCE: 'schroeder-far-force',
  SCHROEDER_PARTICLE_STORAGE: 'schroeder-particle-storage',
  RENDER_SURFACE: 'render-surface',
  DIAGNOSTICS: 'diagnostics'
});

const KNOWN_FAMILY_SET = new Set(Object.values(RESIDENT_STATE_FAMILIES));

function cleanString(value, fallback = null) {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function cleanList(value) {
  if (value == null) return [];
  if (!Array.isArray(value)) return [String(value)].map((entry) => cleanString(entry)).filter(Boolean);
  return value.map((entry) => cleanString(entry)).filter(Boolean);
}

function cloneOwner(owner) {
  return owner ? {
    family: owner.family,
    ownerStage: owner.ownerStage,
    status: owner.status,
    mutationMode: owner.mutationMode,
    backend: owner.backend,
    validationStatus: owner.validationStatus,
    source: owner.source,
    stageIndex: owner.stageIndex,
    writes: [...(owner.writes || [])],
    reads: [...(owner.reads || [])],
    borrowedBuffers: [...(owner.borrowedBuffers || [])],
    destroyedBuffers: [...(owner.destroyedBuffers || [])],
    nextConsumers: [...(owner.nextConsumers || [])],
    warnings: [...(owner.warnings || [])],
    blockers: [...(owner.blockers || [])]
  } : null;
}

function normalizeFamily(family) {
  const normalized = cleanString(family);
  if (!normalized) {
    throw new Error('Resident authority entry requires a state family');
  }
  return normalized;
}

function normalizeEntry(entry = {}, index = 0) {
  const family = normalizeFamily(entry.family);
  const authoritative = entry.authoritative !== false;
  const ownerStage = cleanString(entry.ownerStage || entry.stage || entry.owner, authoritative ? null : 'non-authoritative');
  if (authoritative && !ownerStage) {
    throw new Error(`Resident authority entry for ${family} requires ownerStage`);
  }
  const warnings = cleanList(entry.warnings);
  if (!KNOWN_FAMILY_SET.has(family)) {
    warnings.push(`unknown-resident-state-family:${family}`);
  }
  const blockers = cleanList(entry.blockers);
  return {
    schema: ULG_RESIDENT_STATE_AUTHORITY_ENTRY_SCHEMA,
    family,
    ownerStage,
    authoritative,
    status: cleanString(entry.status, authoritative ? 'authoritative' : 'observed'),
    mutationMode: cleanString(entry.mutationMode, authoritative ? 'authoritative' : 'diagnostic'),
    backend: cleanString(entry.backend),
    validationStatus: cleanString(entry.validationStatus, 'not-validated'),
    source: cleanString(entry.source),
    reads: cleanList(entry.reads),
    writes: cleanList(entry.writes),
    borrowedBuffers: cleanList(entry.borrowedBuffers),
    destroyedBuffers: cleanList(entry.destroyedBuffers),
    nextConsumers: cleanList(entry.nextConsumers),
    warnings,
    blockers,
    stageIndex: Number.isInteger(entry.stageIndex) ? entry.stageIndex : index
  };
}

export function createResidentStateAuthorityLedger({
  ledgerId = null,
  stateKey = null,
  step = null,
  time = null,
  scope = 'resident-state',
  entries = [],
  warnings = [],
  blockers = []
} = {}) {
  const ledger = {
    schema: ULG_RESIDENT_STATE_AUTHORITY_LEDGER_SCHEMA,
    ledgerId: cleanString(ledgerId, `${scope}:authority-ledger`),
    scope,
    stateKey: cleanString(stateKey),
    step,
    time,
    entries: [],
    familyOwners: {},
    warnings: cleanList(warnings),
    blockers: cleanList(blockers),
    authoritativeFamilyCount: 0,
    familyCount: 0,
    status: 'resident-authority-ledger-empty',
    scientificValidation: false,
    fullPhysicsValidation: false
  };
  for (const entry of entries) {
    addResidentStateAuthorityEntry(ledger, entry);
  }
  return finalizeResidentStateAuthorityLedger(ledger);
}

export function addResidentStateAuthorityEntry(ledger, entry) {
  if (ledger?.schema !== ULG_RESIDENT_STATE_AUTHORITY_LEDGER_SCHEMA) {
    throw new TypeError('Expected a resident state authority ledger');
  }
  const normalized = normalizeEntry(entry, ledger.entries.length);
  ledger.entries.push(normalized);
  if (normalized.authoritative) {
    const existingOwner = ledger.familyOwners[normalized.family] ?? null;
    if (existingOwner && existingOwner.ownerStage !== normalized.ownerStage) {
      ledger.blockers.push([
        'resident-state-authority-conflict',
        normalized.family,
        existingOwner.ownerStage,
        normalized.ownerStage
      ].join(':'));
    } else {
      ledger.familyOwners[normalized.family] = cloneOwner(normalized);
    }
  }
  ledger.warnings.push(...normalized.warnings);
  ledger.blockers.push(...normalized.blockers);
  return ledger;
}

export function finalizeResidentStateAuthorityLedger(ledger) {
  if (ledger?.schema !== ULG_RESIDENT_STATE_AUTHORITY_LEDGER_SCHEMA) {
    throw new TypeError('Expected a resident state authority ledger');
  }
  ledger.familyCount = Object.keys(ledger.familyOwners).length;
  ledger.authoritativeFamilyCount = ledger.familyCount;
  ledger.warnings = [...new Set(cleanList(ledger.warnings))];
  ledger.blockers = [...new Set(cleanList(ledger.blockers))];
  ledger.status = ledger.blockers.length > 0
    ? 'resident-authority-ledger-blocked'
    : (ledger.familyCount > 0 ? 'resident-authority-ledger-ready' : 'resident-authority-ledger-empty');
  return ledger;
}

export function assertResidentStateAuthorityLedger(ledger, {
  requiredFamilies = []
} = {}) {
  if (ledger?.schema !== ULG_RESIDENT_STATE_AUTHORITY_LEDGER_SCHEMA) {
    throw new TypeError('Expected a resident state authority ledger');
  }
  const missing = cleanList(requiredFamilies).filter((family) => !ledger.familyOwners[family]);
  if (missing.length > 0) {
    throw new Error(`Resident state authority missing families: ${missing.join(', ')}`);
  }
  if (ledger.blockers?.length > 0) {
    throw new Error(`Resident state authority blocked: ${ledger.blockers.join(', ')}`);
  }
  return true;
}

export function summarizeResidentStateAuthorityLedger(ledger) {
  if (!ledger) return null;
  if (ledger.schema !== ULG_RESIDENT_STATE_AUTHORITY_LEDGER_SCHEMA) {
    throw new TypeError('Expected a resident state authority ledger');
  }
  return {
    schema: ULG_RESIDENT_STATE_AUTHORITY_SUMMARY_SCHEMA,
    ledgerId: ledger.ledgerId,
    stateKey: ledger.stateKey,
    step: ledger.step,
    time: ledger.time,
    status: ledger.status,
    familyCount: ledger.familyCount,
    authoritativeFamilyCount: ledger.authoritativeFamilyCount,
    familyOwners: Object.fromEntries(
      Object.entries(ledger.familyOwners).map(([family, owner]) => [family, cloneOwner(owner)])
    ),
    warnings: [...(ledger.warnings || [])],
    blockers: [...(ledger.blockers || [])],
    scientificValidation: false,
    fullPhysicsValidation: false
  };
}

export function buildMlsMpmResidentStepAuthorityLedger({
  step = null,
  time = null,
  readbackMode = null,
  backend = null,
  stageStatus = {},
  stageBackends = {},
  schroederFarForceDeltaFusion = null,
  schroederParticleStorageAdoption = null,
  nextUsesSchroederFarForceState = false,
  nextUsesSchroederParticleStorageMaterialization = false,
  nextUsesPhaseCarrierTransfer = false,
  thermalStep = null,
  reactionStep = null,
  reactionOutputParticleMutation = false,
  nextUsesReactionState = false,
  nextUsesReactionThermo = false,
  nextUsesReactionMechanics = false,
  nextUsesMechanicsRefresh = false,
  nextUsesThermalState = false,
  nextUsesThermalThermo = false,
  residentProductMass = null,
  inputResidentProductMass = null,
  emittedResidentProductMass = null,
  pressureInterfaceForceSolverStatus = null,
  pressureInterfaceForceApplicationStatus = null,
  pressureInterfaceForceRowCount = 0,
  compactGpuSummary = null,
  residentBuffersRetained = false
} = {}) {
  const entries = [];
  const warnings = [];
  const thermalActive = Boolean(thermalStep);
  const reactionActive = Boolean(reactionStep);
  const schroederFarForceActive = Boolean(schroederFarForceDeltaFusion);
  const schroederParticleStorageActive = Boolean(schroederParticleStorageAdoption);
  if (readbackMode === 'no-full-readback') {
    warnings.push('cpu-mirrors-stale-unless-admitted-readback');
  } else {
    warnings.push('full-readback-mode-cpu-mirror-may-be-current-debug-artifact');
  }
  if (thermalActive && !nextUsesThermalState) {
    warnings.push('thermal-stage-not-particle-kinematics-authority');
  }
  if (thermalActive && !nextUsesReactionMechanics && !nextUsesMechanicsRefresh) {
    warnings.push('thermal-stage-not-mechanics-authority');
  }
  if (thermalActive && nextUsesThermalState && !nextUsesReactionMechanics && !nextUsesMechanicsRefresh) {
    warnings.push('mechanics-constitutive-refresh-pending-after-thermal-state');
  }
  if (reactionActive && !reactionOutputParticleMutation) {
    warnings.push('reaction-no-op-not-particle-authority');
  }

  const add = (family, ownerStage, options = {}) => {
    entries.push({
      family,
      ownerStage,
      backend: options.backend ?? backend,
      stageIndex: entries.length,
      ...options
    });
  };

  add(RESIDENT_STATE_FAMILIES.GRID_ACCUMULATORS, 'p2g-grid-projection', {
    status: stageStatus.p2g || 'not-run',
    backend: stageBackends.p2g || backend,
    reads: [
      RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS,
      RESIDENT_STATE_FAMILIES.MECHANICS,
      RESIDENT_STATE_FAMILIES.REACTION_PRODUCTS
    ],
    writes: [RESIDENT_STATE_FAMILIES.GRID_ACCUMULATORS],
    nextConsumers: ['grid-update']
  });
  add(RESIDENT_STATE_FAMILIES.GRID_UPDATE, 'grid-update', {
    status: stageStatus.gridUpdate || 'not-run',
    backend: stageBackends.gridUpdate || backend,
    reads: [RESIDENT_STATE_FAMILIES.GRID_ACCUMULATORS, RESIDENT_STATE_FAMILIES.PRESSURE_INTERFACE],
    writes: [RESIDENT_STATE_FAMILIES.GRID_UPDATE],
    nextConsumers: ['g2p']
  });

  const particleOwner = nextUsesSchroederParticleStorageMaterialization
    ? 'schroeder-particle-storage-materialization'
    : (nextUsesPhaseCarrierTransfer
    ? 'phase-carrier-transfer-v2'
    : (nextUsesReactionState
    ? 'reaction-step'
    : (nextUsesThermalState
      ? 'thermal-phase-step'
      : (nextUsesSchroederFarForceState ? 'schroeder-far-force-delta-fusion' : 'g2p'))));
  add(RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS, particleOwner, {
    status: nextUsesSchroederParticleStorageMaterialization
      ? 'schroeder-particle-storage-materialized-state-drives-next-particles'
      : (nextUsesPhaseCarrierTransfer
      ? 'phase-carrier-transfer-state-drives-next-particles'
      : (nextUsesReactionState
      ? 'reaction-output-buffers-drive-next-particles'
      : (nextUsesThermalState
        ? 'thermal-state-buffer-drives-next-particles'
        : (nextUsesSchroederFarForceState
          ? 'schroeder-far-force-delta-fused-state-buffer-drives-next-particles'
          : 'g2p-output-drives-next-particles')))),
    backend: nextUsesSchroederParticleStorageMaterialization
      ? (schroederParticleStorageAdoption?.backend || backend)
      : (nextUsesPhaseCarrierTransfer
      ? (stageBackends.phaseCarrierTransfer || backend)
      : (nextUsesReactionState
      ? (stageBackends.reaction || backend)
      : (nextUsesThermalState
        ? (stageBackends.thermal || backend)
        : (nextUsesSchroederFarForceState
          ? (stageBackends.schroederFarForceDeltaFusion || backend)
          : (stageBackends.g2p || backend))))),
    reads: nextUsesSchroederParticleStorageMaterialization
      ? [RESIDENT_STATE_FAMILIES.SCHROEDER_PARTICLE_STORAGE]
      : (nextUsesPhaseCarrierTransfer
      ? [
        RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS,
        RESIDENT_STATE_FAMILIES.THERMO_PHASE,
        RESIDENT_STATE_FAMILIES.MECHANICS
      ]
      : (nextUsesReactionState
      ? [RESIDENT_STATE_FAMILIES.REACTION_PRODUCTS]
      : (nextUsesSchroederFarForceState
        ? [RESIDENT_STATE_FAMILIES.GRID_UPDATE, RESIDENT_STATE_FAMILIES.SCHROEDER_FAR_FORCE]
        : [RESIDENT_STATE_FAMILIES.GRID_UPDATE]))),
    writes: [RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS],
    nextConsumers: ['next-resident-step']
  });

  if (schroederFarForceActive) {
    add(RESIDENT_STATE_FAMILIES.SCHROEDER_FAR_FORCE, 'schroeder-far-force-delta-fusion', {
      status: stageStatus.schroederFarForceDeltaFusion || 'schroeder-far-force-delta-fusion-observed',
      backend: stageBackends.schroederFarForceDeltaFusion || backend,
      reads: [RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS],
      writes: [RESIDENT_STATE_FAMILIES.SCHROEDER_FAR_FORCE],
      nextConsumers: ['particle-kinematics', 'diagnostics']
    });
  }

  if (schroederParticleStorageActive) {
    add(RESIDENT_STATE_FAMILIES.SCHROEDER_PARTICLE_STORAGE, 'schroeder-particle-storage-materialization', {
      status: schroederParticleStorageAdoption?.status || 'schroeder-particle-storage-materialization-observed',
      backend: schroederParticleStorageAdoption?.backend || backend,
      reads: [
        RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS,
        RESIDENT_STATE_FAMILIES.MECHANICS,
        RESIDENT_STATE_FAMILIES.THERMO_PHASE
      ],
      writes: [RESIDENT_STATE_FAMILIES.SCHROEDER_PARTICLE_STORAGE],
      borrowedBuffers: [
        schroederParticleStorageAdoption?.stateBuffer ? 'schroeder-materialized-state-buffer' : null,
        schroederParticleStorageAdoption?.thermoBuffer ? 'schroeder-materialized-thermo-buffer' : null,
        schroederParticleStorageAdoption?.mechanicsBuffer ? 'schroeder-materialized-mechanics-buffer' : null
      ].filter(Boolean),
      nextConsumers: nextUsesSchroederParticleStorageMaterialization
        ? ['particle-kinematics', 'mechanics', 'thermo-phase', 'next-resident-step']
        : ['diagnostics'],
      warnings: schroederParticleStorageAdoption?.warnings || [],
      blockers: schroederParticleStorageAdoption?.blockers || []
    });
  }

  const mechanicsOwner = nextUsesSchroederParticleStorageMaterialization
    ? 'schroeder-particle-storage-materialization'
    : (nextUsesMechanicsRefresh
    ? 'mechanics-constitutive-refresh'
    : (nextUsesPhaseCarrierTransfer
      ? 'phase-carrier-transfer-v2'
      : (nextUsesReactionMechanics ? 'reaction-step' : 'g2p')));
  add(RESIDENT_STATE_FAMILIES.MECHANICS, mechanicsOwner, {
    status: nextUsesSchroederParticleStorageMaterialization
      ? 'schroeder-particle-storage-materialized-mechanics-drives-next-particles'
      : (nextUsesMechanicsRefresh
        ? 'mechanics-constitutive-refresh-drives-next-particles'
        : (nextUsesPhaseCarrierTransfer
          ? 'phase-carrier-transfer-mechanics-drives-next-particles'
          : (nextUsesReactionMechanics
            ? 'reaction-mechanics-output-drives-next-particles'
            : 'g2p-mechanics-output-drives-next-particles'))),
    backend: nextUsesSchroederParticleStorageMaterialization
      ? (schroederParticleStorageAdoption?.backend || backend)
      : (nextUsesMechanicsRefresh
      ? (stageBackends.mechanicsRefresh || backend)
      : (nextUsesPhaseCarrierTransfer
        ? (stageBackends.phaseCarrierTransfer || backend)
        : (nextUsesReactionMechanics
          ? (stageBackends.reaction || backend)
          : (stageBackends.g2p || backend)))),
    reads: nextUsesSchroederParticleStorageMaterialization
      ? [RESIDENT_STATE_FAMILIES.SCHROEDER_PARTICLE_STORAGE]
      : (nextUsesMechanicsRefresh
        ? [
          RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS,
          RESIDENT_STATE_FAMILIES.THERMO_PHASE,
          RESIDENT_STATE_FAMILIES.MECHANICS
        ]
        : (nextUsesPhaseCarrierTransfer
          ? [
            RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS,
            RESIDENT_STATE_FAMILIES.THERMO_PHASE,
            RESIDENT_STATE_FAMILIES.MECHANICS
          ]
          : (nextUsesReactionMechanics
            ? [RESIDENT_STATE_FAMILIES.REACTION_PRODUCTS]
            : [RESIDENT_STATE_FAMILIES.GRID_UPDATE]))),
    writes: [RESIDENT_STATE_FAMILIES.MECHANICS],
    nextConsumers: ['next-p2g', 'next-g2p']
  });

  const thermoOwner = nextUsesSchroederParticleStorageMaterialization
    ? 'schroeder-particle-storage-materialization'
    : (nextUsesPhaseCarrierTransfer
    ? 'phase-carrier-transfer-v2'
    : (nextUsesReactionThermo
    ? 'reaction-step'
    : (nextUsesThermalThermo ? 'thermal-phase-step' : 'source-thermo-buffer')));
  add(RESIDENT_STATE_FAMILIES.THERMO_PHASE, thermoOwner, {
    status: nextUsesSchroederParticleStorageMaterialization
      ? 'schroeder-particle-storage-materialized-thermo-drives-next-particles'
      : (nextUsesPhaseCarrierTransfer
      ? 'phase-carrier-transfer-thermo-drives-next-particles'
      : (nextUsesReactionThermo
      ? 'reaction-thermo-output-drives-next-particles'
      : (nextUsesThermalThermo ? 'thermal-thermo-buffer-drives-next-particles' : 'source-thermo-buffer-retained'))),
    backend: nextUsesSchroederParticleStorageMaterialization
      ? (schroederParticleStorageAdoption?.backend || backend)
      : (nextUsesPhaseCarrierTransfer
      ? (stageBackends.phaseCarrierTransfer || backend)
      : (nextUsesReactionThermo
      ? (stageBackends.reaction || backend)
      : (nextUsesThermalThermo ? (stageBackends.thermal || backend) : backend))),
    reads: nextUsesSchroederParticleStorageMaterialization
      ? [RESIDENT_STATE_FAMILIES.SCHROEDER_PARTICLE_STORAGE]
      : (nextUsesPhaseCarrierTransfer
      ? [
        RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS,
        RESIDENT_STATE_FAMILIES.THERMO_PHASE
      ]
      : (nextUsesReactionThermo
      ? [RESIDENT_STATE_FAMILIES.REACTION_PRODUCTS]
      : [RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS])),
    writes: [RESIDENT_STATE_FAMILIES.THERMO_PHASE],
    nextConsumers: ['next-resident-step', 'reaction-step']
  });

  if (residentProductMass || inputResidentProductMass || emittedResidentProductMass || reactionActive) {
    add(RESIDENT_STATE_FAMILIES.REACTION_PRODUCTS, residentProductMass ? 'resident-product-mass-handle' : 'reaction-step', {
      status: residentProductMass?.status || (reactionActive ? 'reaction-products-none-or-diagnostic' : 'carried-product-state'),
      backend: stageBackends.reaction || backend,
      reads: [RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS, RESIDENT_STATE_FAMILIES.THERMO_PHASE],
      writes: [RESIDENT_STATE_FAMILIES.REACTION_PRODUCTS],
      borrowedBuffers: residentProductMass?.productEventBufferRetained ? ['product-event-buffer'] : [],
      nextConsumers: ['next-p2g', 'pressure-eos', 'render-field']
    });
  }

  if (residentProductMass?.gasSpeciesLedgerCount || residentProductMass?.sealedBoxGasProductMoles || pressureInterfaceForceSolverStatus) {
    add(RESIDENT_STATE_FAMILIES.GAS_PRESSURE, residentProductMass ? 'resident-gas-product-ledger' : 'pressure-interface-force-solver', {
      status: residentProductMass?.gasSpeciesLedgerCount
        ? 'resident-gas-species-ledger-authority'
        : (pressureInterfaceForceSolverStatus || 'pressure-interface-force-solver-observed'),
      backend: stageBackends.reaction || backend,
      reads: [RESIDENT_STATE_FAMILIES.REACTION_PRODUCTS],
      writes: [RESIDENT_STATE_FAMILIES.GAS_PRESSURE],
      nextConsumers: ['grid-update', 'pressure-interface-extraction']
    });
  }

  if (pressureInterfaceForceRowCount > 0 || pressureInterfaceForceApplicationStatus || pressureInterfaceForceSolverStatus) {
    add(RESIDENT_STATE_FAMILIES.PRESSURE_INTERFACE, 'grid-update-pressure-interface-consumer', {
      status: pressureInterfaceForceApplicationStatus || pressureInterfaceForceSolverStatus || 'pressure-interface-observed',
      backend: stageBackends.gridUpdate || backend,
      reads: [RESIDENT_STATE_FAMILIES.GAS_PRESSURE, RESIDENT_STATE_FAMILIES.GRID_ACCUMULATORS],
      writes: [RESIDENT_STATE_FAMILIES.PRESSURE_INTERFACE],
      nextConsumers: ['grid-update', 'diagnostics']
    });
  }

  add(RESIDENT_STATE_FAMILIES.DIAGNOSTICS, compactGpuSummary ? 'compact-summary' : 'resident-step-envelope', {
    status: compactGpuSummary?.status || 'resident-step-diagnostics-ready',
    mutationMode: 'diagnostic',
    reads: [
      RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS,
      RESIDENT_STATE_FAMILIES.MECHANICS,
      RESIDENT_STATE_FAMILIES.THERMO_PHASE,
      RESIDENT_STATE_FAMILIES.GRID_UPDATE
    ],
    writes: [RESIDENT_STATE_FAMILIES.DIAGNOSTICS],
    warnings: residentBuffersRetained ? [] : ['resident-buffers-not-retained-authority-debug-only']
  });

  entries.push({
    family: RESIDENT_STATE_FAMILIES.RENDER_SURFACE,
    ownerStage: 'render-stage-not-authority',
    authoritative: false,
    status: 'render-output-not-physics-authority',
    mutationMode: 'diagnostic',
    reads: [RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS, RESIDENT_STATE_FAMILIES.THERMO_PHASE],
    writes: [RESIDENT_STATE_FAMILIES.RENDER_SURFACE],
    warnings: ['render-stage-must-not-create-pressure-physics']
  });

  return createResidentStateAuthorityLedger({
    ledgerId: `mls-mpm-resident-step:${step ?? 'unknown'}`,
    stateKey: 'mls-mpm-resident-step',
    step,
    time,
    scope: 'mls-mpm-resident-step',
    entries,
    warnings
  });
}
