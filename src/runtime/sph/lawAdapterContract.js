// Enforced Typed Law Adapter Contract for ULG / Schroeder Simulation (SS)
// (plan/todo/SS/schroeder-tree-and-algorithm-plan.md:129,
//  plan/ss-law-architecture-assessment.md).
//
// Validates every registered law stage's spatial adapter mode, read/write/
// accumulate resource lanes, paired (V0, J) volume representation, conserved
// quantities, validity envelope, fallback policy, and spatial authority
// (explicitly surfacing `legacy-private-grid` architectural debt).

export const ULG_LAW_ADAPTER_CONTRACT_SCHEMA =
  'peercompute.ulg.law-adapter-contract.v1';

export const LAW_ADAPTER_MODES = Object.freeze({
  CELL_LOCAL: 'cell-local',
  EXACT_NEAR: 'exact-near',
  CROSS_LEVEL: 'cross-level',
  AGGREGATE_FAR: 'aggregate-far',
  SOLID_PROXY: 'solid-proxy',
  SURFACE_INTERFACE: 'surface-interface',
  GLOBAL_REDUCTION: 'global-reduction'
});

const VALID_ADAPTER_MODES = new Set(Object.values(LAW_ADAPTER_MODES));

export const LAW_SPATIAL_AUTHORITIES = Object.freeze({
  CANONICAL_SS_EPOCH: 'canonical-ss-epoch',
  LEGACY_PRIVATE_GRID: 'legacy-private-grid'
});

const VALID_SPATIAL_AUTHORITIES = new Set(Object.values(LAW_SPATIAL_AUTHORITIES));

export const LAW_FALLBACK_POLICIES = Object.freeze({
  STRICT: 'strict',
  ASYNC: 'async',
  FROZEN: 'frozen',
  EXACT_SUBSTEP: 'exact-substep',
  DIRECT_PAIR: 'direct-pair',
  DORMANT_SKIP: 'dormant-skip',
  FAIL_CLOSED: 'fail-closed'
});

const VALID_FALLBACK_POLICIES = new Set(Object.values(LAW_FALLBACK_POLICIES));

export const DEFAULT_HANDOFF_COMPATIBLE_RESOURCES = Object.freeze([
  'sph-particle-state',
  'sph-thermo-phase',
  'mls-mpm-mechanics',
  'mls-mpm-grid-velocity',
  'exact-energy-ledger',
  'exact-mass-ledger',
  'solid-rigid-frames'
]);

function normalizeStringList(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((v) => String(v ?? '').trim()).filter(Boolean))];
}

/**
 * Validate a single Law Adapter descriptor against ULG's SS Law Adapter Contract.
 */
export function validateLawAdapterDescriptor(descriptor, { requireExtendedMetadata = false } = {}) {
  const errors = [];
  const debt = [];
  if (!descriptor || typeof descriptor !== 'object') {
    return Object.freeze({
      valid: false,
      errors: Object.freeze(['law-adapter-not-object']),
      debt: Object.freeze([])
    });
  }
  const id = String(descriptor.id ?? descriptor.lawId ?? '').trim();
  if (!id) {
    errors.push('law-adapter-missing-id');
  }
  const reads = normalizeStringList(descriptor.reads);
  const writes = normalizeStringList(descriptor.writes);
  const accumulates = normalizeStringList(descriptor.accumulates);
  const writeSet = new Set(writes);
  for (const acc of accumulates) {
    if (writeSet.has(acc)) {
      errors.push(`stage-writes-and-accumulates-same-resource:${id || 'unknown'}:${acc}`);
    }
  }
  if (descriptor.adapterMode !== undefined || requireExtendedMetadata) {
    if (!VALID_ADAPTER_MODES.has(descriptor.adapterMode)) {
      errors.push(`invalid-adapter-mode:${id || 'unknown'}:${String(descriptor.adapterMode)}`);
    }
  }
  if (descriptor.fallbackPolicy !== undefined || requireExtendedMetadata) {
    if (!VALID_FALLBACK_POLICIES.has(descriptor.fallbackPolicy)) {
      errors.push(`invalid-fallback-policy:${id || 'unknown'}:${String(descriptor.fallbackPolicy)}`);
    }
  }
  if (descriptor.spatialAuthority !== undefined || requireExtendedMetadata) {
    if (!VALID_SPATIAL_AUTHORITIES.has(descriptor.spatialAuthority)) {
      errors.push(`invalid-spatial-authority:${id || 'unknown'}:${String(descriptor.spatialAuthority)}`);
    } else if (descriptor.spatialAuthority === LAW_SPATIAL_AUTHORITIES.LEGACY_PRIVATE_GRID) {
      debt.push(`legacy-private-grid:${id || 'unknown'}`);
    }
  }
  if (requireExtendedMetadata) {
    if (!Array.isArray(descriptor.conservedQuantities)) {
      errors.push(`missing-conserved-quantities:${id || 'unknown'}`);
    }
    if (!descriptor.validityDomain || typeof descriptor.validityDomain !== 'object') {
      errors.push(`missing-validity-domain:${id || 'unknown'}`);
    }
    const pv = descriptor.pairedVolumeState;
    if (
      pv !== 'not-applicable'
      && !(pv && typeof pv === 'object' && typeof pv.v0Lane === 'string' && typeof pv.jLane === 'string')
    ) {
      errors.push(`invalid-paired-volume-state:${id || 'unknown'}`);
    }
  }
  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors),
    debt: Object.freeze(debt)
  });
}

/**
 * Validate a composed law schedule (stage order, exclusive single-writer vs
 * ordered read-before-write handoff, no simultaneous write+accumulate, and
 * explicit tracking of any legacy-private-grid architectural debt).
 */
export function validateLawAdapterSchedule(plan, {
  requireExtendedMetadata = false,
  handoffCompatibleResources = DEFAULT_HANDOFF_COMPATIBLE_RESOURCES
} = {}) {
  const errors = [];
  const debt = [];
  if (!plan || typeof plan !== 'object' || !Array.isArray(plan.stages)) {
    return Object.freeze({
      schema: ULG_LAW_ADAPTER_CONTRACT_SCHEMA,
      valid: false,
      errors: Object.freeze(['fused-law-plan-invalid-structure']),
      debt: Object.freeze([]),
      stageCount: 0,
      exclusiveWritersByResource: Object.freeze({}),
      accumulatorsByResource: Object.freeze({})
    });
  }
  const order = Array.isArray(plan.requiredStageOrder) ? plan.requiredStageOrder : [];
  const orderIndex = new Map(order.map((stageId, idx) => [stageId, idx]));
  const handoffSet = new Set(handoffCompatibleResources);
  const seenStageIds = new Set();
  const exclusiveWritersByResource = new Map();
  const accumulatorsByResource = new Map();

  for (const stage of plan.stages) {
    if (!stage || typeof stage !== 'object') {
      errors.push('stage-entry-not-object');
      continue;
    }
    const id = String(stage.id ?? stage.lawId ?? '').trim();
    if (!id) {
      errors.push('stage-missing-id');
      continue;
    }
    if (seenStageIds.has(id)) {
      errors.push(`duplicate-stage-id:${id}`);
    }
    seenStageIds.add(id);
    if (!requireExtendedMetadata && (!stage.lawNodeId || !stage.orderConstraint)) {
      errors.push(`stage-missing-contract-metadata:${id}`);
    }
    const descCheck = validateLawAdapterDescriptor(stage, { requireExtendedMetadata });
    for (const err of descCheck.errors) errors.push(err);
    for (const d of descCheck.debt) debt.push(d);

    const reads = normalizeStringList(stage.reads);
    const writes = normalizeStringList(stage.writes);
    const accumulates = normalizeStringList(stage.accumulates);
    for (const acc of accumulates) {
      if (!accumulatorsByResource.has(acc)) accumulatorsByResource.set(acc, []);
      accumulatorsByResource.get(acc).push(id);
    }
    for (const resource of writes) {
      if (!exclusiveWritersByResource.has(resource)) {
        exclusiveWritersByResource.set(resource, []);
      }
      const priorWriters = exclusiveWritersByResource.get(resource);
      if (priorWriters.length > 0) {
        const currentOrder = orderIndex.get(id);
        const priorOrder = orderIndex.get(priorWriters[priorWriters.length - 1]);
        const strictlyOrderedHandoff = (
          handoffSet.has(resource)
          && Number.isInteger(priorOrder)
          && Number.isInteger(currentOrder)
          && currentOrder > priorOrder
          && reads.includes(resource)
        );
        if (!strictlyOrderedHandoff) {
          errors.push(
            `illegal-double-writer:${resource}:${priorWriters[priorWriters.length - 1]}+${id}`
          );
        }
      }
      priorWriters.push(id);
    }
  }
  return Object.freeze({
    schema: ULG_LAW_ADAPTER_CONTRACT_SCHEMA,
    valid: errors.length === 0,
    errors: Object.freeze(errors),
    debt: Object.freeze(debt),
    stageCount: plan.stages.length,
    exclusiveWritersByResource: Object.freeze(
      Object.fromEntries([...exclusiveWritersByResource.entries()].map(([k, v]) => [k, Object.freeze([...v])]))
    ),
    accumulatorsByResource: Object.freeze(
      Object.fromEntries([...accumulatorsByResource.entries()].map(([k, v]) => [k, Object.freeze([...v])]))
    )
  });
}

export function assertValidLawAdapterSchedule(plan, options = {}) {
  const validation = validateLawAdapterSchedule(plan, options);
  if (!validation.valid) {
    const error = new Error(`Invalid ULG law adapter schedule: ${validation.errors.join(', ')}`);
    error.code = 'ERR_LAW_ADAPTER_SCHEDULE_INVALID';
    error.validation = validation;
    throw error;
  }
  return validation;
}

/**
 * Canonical typed Law Adapter descriptors for ULG's live WebGPU physics stages.
 */
export const CANONICAL_ULG_LAW_ADAPTERS = Object.freeze([
  Object.freeze({
    id: 'mls-mpm-p2g',
    lawNodeId: 'law:mechanics-p2g',
    orderConstraint: 'before:mls-mpm-grid-update',
    adapterMode: LAW_ADAPTER_MODES.CELL_LOCAL,
    spatialAuthority: LAW_SPATIAL_AUTHORITIES.CANONICAL_SS_EPOCH,
    reads: Object.freeze(['sph-particle-state', 'sph-thermo-phase', 'mls-mpm-mechanics']),
    writes: Object.freeze(['mls-mpm-grid-velocity']),
    accumulates: Object.freeze(['mls-mpm-grid-momentum']),
    pairedVolumeState: Object.freeze({ v0Lane: 'mls-mpm-mechanics.restVolume', jLane: 'mls-mpm-mechanics.F' }),
    conservedQuantities: Object.freeze(['mass', 'linear-momentum', 'angular-momentum']),
    validityDomain: Object.freeze({ cflMax: 1.0, requiresFiniteF: true }),
    fallbackPolicy: LAW_FALLBACK_POLICIES.EXACT_SUBSTEP
  }),
  Object.freeze({
    id: 'mls-mpm-grid-update',
    lawNodeId: 'law:mechanics-grid-update',
    orderConstraint: 'after:mls-mpm-p2g',
    adapterMode: LAW_ADAPTER_MODES.CELL_LOCAL,
    spatialAuthority: LAW_SPATIAL_AUTHORITIES.CANONICAL_SS_EPOCH,
    reads: Object.freeze(['mls-mpm-grid-velocity', 'mls-mpm-grid-momentum']),
    writes: Object.freeze(['mls-mpm-grid-velocity']),
    accumulates: Object.freeze([]),
    pairedVolumeState: 'not-applicable',
    conservedQuantities: Object.freeze(['linear-momentum']),
    validityDomain: Object.freeze({ finiteGravity: true }),
    fallbackPolicy: LAW_FALLBACK_POLICIES.FAIL_CLOSED
  }),
  Object.freeze({
    id: 'mls-mpm-g2p',
    lawNodeId: 'law:mechanics-g2p',
    orderConstraint: 'after:mls-mpm-grid-update',
    adapterMode: LAW_ADAPTER_MODES.CELL_LOCAL,
    spatialAuthority: LAW_SPATIAL_AUTHORITIES.CANONICAL_SS_EPOCH,
    reads: Object.freeze(['sph-particle-state', 'mls-mpm-mechanics', 'mls-mpm-grid-velocity']),
    writes: Object.freeze(['sph-particle-state', 'mls-mpm-mechanics']),
    accumulates: Object.freeze([]),
    pairedVolumeState: Object.freeze({ v0Lane: 'mls-mpm-mechanics.restVolume', jLane: 'mls-mpm-mechanics.F' }),
    conservedQuantities: Object.freeze(['mass', 'linear-momentum']),
    validityDomain: Object.freeze({ maxDisplacementCells: 1.0 }),
    fallbackPolicy: LAW_FALLBACK_POLICIES.EXACT_SUBSTEP
  }),
  Object.freeze({
    id: 'thermal-conduction-radiation',
    lawNodeId: 'law:thermal-conduction-radiation',
    orderConstraint: 'after:mls-mpm-g2p',
    adapterMode: LAW_ADAPTER_MODES.EXACT_NEAR,
    spatialAuthority: LAW_SPATIAL_AUTHORITIES.CANONICAL_SS_EPOCH,
    reads: Object.freeze(['sph-particle-state', 'sph-thermo-phase', 'exact-energy-ledger']),
    writes: Object.freeze(['sph-thermo-phase', 'exact-energy-ledger']),
    accumulates: Object.freeze(['thermal-flux-proposals']),
    pairedVolumeState: 'not-applicable',
    conservedQuantities: Object.freeze(['internal-energy-minus-entropy-2e-149']),
    validityDomain: Object.freeze({ temperatureMinK: 1e-3, usesG6Uncertainty: true }),
    fallbackPolicy: LAW_FALLBACK_POLICIES.DORMANT_SKIP
  }),
  Object.freeze({
    id: 'reaction-discovery-apply',
    lawNodeId: 'law:chemistry-reaction',
    orderConstraint: 'after:thermal-conduction-radiation',
    adapterMode: LAW_ADAPTER_MODES.EXACT_NEAR,
    spatialAuthority: LAW_SPATIAL_AUTHORITIES.CANONICAL_SS_EPOCH,
    reads: Object.freeze(['sph-particle-state', 'sph-thermo-phase', 'exact-mass-ledger', 'exact-energy-ledger']),
    writes: Object.freeze(['sph-particle-state', 'sph-thermo-phase', 'exact-mass-ledger', 'exact-energy-ledger']),
    accumulates: Object.freeze(['reaction-proposals']),
    pairedVolumeState: 'not-applicable',
    conservedQuantities: Object.freeze(['mass-2e-149', 'atoms', 'internal-energy-2e-149']),
    validityDomain: Object.freeze({ requiresBalancedStoichiometry: true }),
    fallbackPolicy: LAW_FALLBACK_POLICIES.DORMANT_SKIP
  }),
  Object.freeze({
    id: 'phase-carrier-transfer',
    lawNodeId: 'law:phase-change',
    orderConstraint: 'after:reaction-discovery-apply',
    adapterMode: LAW_ADAPTER_MODES.CELL_LOCAL,
    spatialAuthority: LAW_SPATIAL_AUTHORITIES.CANONICAL_SS_EPOCH,
    reads: Object.freeze(['sph-particle-state', 'sph-thermo-phase', 'mls-mpm-mechanics', 'exact-mass-ledger', 'exact-energy-ledger']),
    writes: Object.freeze(['sph-particle-state', 'sph-thermo-phase', 'mls-mpm-mechanics', 'exact-mass-ledger', 'exact-energy-ledger']),
    accumulates: Object.freeze([]),
    pairedVolumeState: Object.freeze({ v0Lane: 'mls-mpm-mechanics.restVolume', jLane: 'mls-mpm-mechanics.F' }),
    conservedQuantities: Object.freeze(['mass-2e-149', 'internal-energy-2e-149', 'linear-momentum']),
    validityDomain: Object.freeze({ usesPhaseWindowsAndG6Uncertainty: true }),
    fallbackPolicy: LAW_FALLBACK_POLICIES.DORMANT_SKIP
  }),
  Object.freeze({
    id: 'coherent-solids-rigid-and-coupling',
    lawNodeId: 'law:coherent-solids',
    orderConstraint: 'after:phase-carrier-transfer',
    adapterMode: LAW_ADAPTER_MODES.SOLID_PROXY,
    spatialAuthority: LAW_SPATIAL_AUTHORITIES.CANONICAL_SS_EPOCH,
    reads: Object.freeze(['solid-rigid-frames', 'sph-particle-state', 'sph-thermo-phase']),
    writes: Object.freeze(['solid-rigid-frames', 'sph-particle-state', 'sph-thermo-phase']),
    accumulates: Object.freeze(['solid-impulse-ledger']),
    pairedVolumeState: Object.freeze({ v0Lane: 'solid-members.restVolume', jLane: 'solid-frames.pose' }),
    conservedQuantities: Object.freeze(['mass', 'linear-momentum', 'angular-momentum', 'internal-energy']),
    validityDomain: Object.freeze({ requiresNonDegenerateInertia: true }),
    fallbackPolicy: LAW_FALLBACK_POLICIES.FAIL_CLOSED
  })
]);
