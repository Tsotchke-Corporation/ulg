import {
  addResidentBufferLease,
  createResidentBufferLeaseLedger,
  destroyResidentBufferWithLease,
  registerResidentBufferResource,
  releaseResidentBufferLease,
  summarizeResidentBufferLeaseLedger
} from '../residentBufferLease.js';
import {
  SCHROEDER_SPATIAL_EPOCH_CONSUMER_ARTIFACT_FAMILY
} from './schroederSpatialEpochTransaction.js';

export { SCHROEDER_SPATIAL_EPOCH_CONSUMER_ARTIFACT_FAMILY };

export const ULG_SCHROEDER_HIERARCHY_ARTIFACT_LEDGER_SCHEMA =
  'peercompute.ulg.schroeder-hierarchy-artifact-ledger.v0';
export const ULG_SCHROEDER_HIERARCHY_ARTIFACT_LEDGER_SUMMARY_SCHEMA =
  'peercompute.ulg.schroeder-hierarchy-artifact-ledger-summary.v0';

const TRANSFER_CLASSES = new Set(['render', 'next-tick', 'continuation']);
const RETIREMENT_AUTHORITIES = new Set(['ledger-consumer', 'external-owner']);
const runtimeByLedger = new WeakMap();

const GENERATION_BOUND_ARTIFACT_FAMILIES = new Set(
  Object.values(SCHROEDER_SPATIAL_EPOCH_CONSUMER_ARTIFACT_FAMILY)
);

function exactNearConsumerArtifactSpecs(specificProposalFields) {
  return [
    {
      role: 'proposal',
      fields: [...specificProposalFields, 'proposalBuffer'],
      destroyMethod: 'destroyProposalBuffer'
    },
    {
      role: 'candidate-offsets',
      fields: ['candidateOffsetBuffer', 'pairOffsetBuffer'],
      destroyMethod: 'destroyCandidateBuffers'
    },
    {
      role: 'candidate-members',
      fields: ['candidateMemberBuffer', 'pairMemberBuffer'],
      destroyMethod: 'destroyCandidateBuffers'
    },
    {
      role: 'consumer-receipt',
      fields: ['consumerReceiptBuffer', 'authenticationReceiptBuffer', 'receiptBuffer'],
      destroyMethod: 'destroyConsumerReceiptBuffer'
    },
    {
      role: 'diagnostic-counter',
      fields: ['diagnosticCounterBuffer'],
      destroyMethod: 'destroyDiagnosticCounterBuffer'
    }
  ];
}

const PARTICLE_BUFFER_SPECS = [
  { role: 'particle-state', fields: ['particleStateBuffer'], destroyMethod: 'destroyParticleBuffers' },
  { role: 'particle-thermo', fields: ['particleThermoBuffer'], destroyMethod: 'destroyParticleBuffers' },
  { role: 'particle-mechanics', fields: ['particleMechanicsBuffer'], destroyMethod: 'destroyParticleBuffers' },
  { role: 'particle-identity', fields: ['particleIdentityBuffer'], destroyMethod: 'destroyParticleBuffers' }
];

const FAMILY_BUFFER_SPECS = Object.freeze({
  'level-assignment': [
    { role: 'assignment', fields: ['assignmentBuffer'], destroyMethod: 'destroyAssignmentBuffer' }
  ],
  'final-render-level-assignment': [
    { role: 'assignment', fields: ['assignmentBuffer'], destroyMethod: 'destroyAssignmentBuffer' }
  ],
  'phase-volume-assignment-overlay-index': [
    { role: 'index', fields: ['indexBuffer'], destroyMethod: 'destroyIndexBuffer' }
  ],
  'active-node-list': [
    { role: 'active-nodes', fields: ['activeNodeBuffer'], destroyMethod: 'destroyActiveNodeBuffer' }
  ],
  'final-render-active-node-list': [
    { role: 'active-nodes', fields: ['activeNodeBuffer'], destroyMethod: 'destroyActiveNodeBuffer' }
  ],
  'coarse-active-node-list': [
    { role: 'active-nodes', fields: ['activeNodeBuffer'], destroyMethod: 'destroyActiveNodeBuffer' }
  ],
  'active-node-index': [
    { role: 'bucket-count', fields: ['bucketCountBuffer'], destroyMethod: 'destroyIndexBuffers' },
    { role: 'bucket-slot', fields: ['bucketSlotBuffer'], destroyMethod: 'destroyIndexBuffers' },
    { role: 'node-bucket-slot', fields: ['nodeBucketSlotBuffer'], destroyMethod: 'destroyIndexBuffers' },
    { role: 'overflow-counter', fields: ['overflowCounterBuffer'], destroyMethod: 'destroyIndexBuffers' }
  ],
  'active-node-sorted-index': [
    { role: 'bucket-count', fields: ['bucketCountBuffer'], destroyMethod: 'destroyIndexBuffers' },
    { role: 'bucket-range-offset', fields: ['bucketRangeOffsetBuffer'], destroyMethod: 'destroyIndexBuffers' },
    { role: 'bucket-cursor', fields: ['bucketCursorBuffer'], destroyMethod: 'destroyIndexBuffers' },
    { role: 'sorted-active-index', fields: ['sortedActiveIndexBuffer'], destroyMethod: 'destroyIndexBuffers' },
    { role: 'diagnostic-counter', fields: ['diagnosticCounterBuffer'], destroyMethod: 'destroyIndexBuffers' }
  ],
  'law-queue': [
    { role: 'law-queue', fields: ['lawQueueBuffer'], destroyMethod: 'destroyLawQueueBuffer' }
  ],
  'law-neighbor-candidates': [
    {
      role: 'neighbor-candidates',
      fields: ['neighborCandidateBuffer'],
      destroyMethod: 'destroyNeighborCandidateBuffer'
    },
    {
      role: 'source-candidate-spans',
      fields: ['sourceCandidateSpanBuffer'],
      destroyMethod: 'destroySourceCandidateSpanBuffer'
    },
    {
      role: 'diagnostic-counter',
      fields: ['diagnosticCounterBuffer'],
      destroyMethod: 'destroyDiagnosticCounterBuffer'
    }
  ],
  'cross-level-coupling': [
    { role: 'cross-level', fields: ['crossLevelBuffer'], destroyMethod: 'destroyCrossLevelBuffer' }
  ],
  'conservation-summary': [
    { role: 'summary', fields: ['summaryBuffer'], destroyMethod: 'destroySummaryBuffer' }
  ],
  'cross-level-transfer': [
    { role: 'transfer', fields: ['transferBuffer'], destroyMethod: 'destroyTransferBuffer' }
  ],
  'cross-level-state-delta': [
    { role: 'state-delta', fields: ['stateDeltaBuffer'], destroyMethod: 'destroyStateDeltaBuffer' }
  ],
  'cross-level-state-delta-merge': [
    {
      role: 'merged-state-delta',
      fields: ['mergedStateDeltaBuffer'],
      destroyMethod: 'destroyMergedStateDeltaBuffer'
    }
  ],
  'hierarchy-aggregate': [
    { role: 'aggregate', fields: ['aggregateBuffer'], destroyMethod: 'destroyAggregateBuffer' }
  ],
  'hierarchy-aggregate-node': [
    { role: 'aggregate-nodes', fields: ['aggregateNodeBuffer'], destroyMethod: 'destroyAggregateNodeBuffer' }
  ],
  'phase-volume-target-aggregate': [
    { role: 'aggregate', fields: ['aggregateBuffer'], destroyMethod: 'destroyAggregateBuffer' }
  ],
  'phase-volume-target-aggregate-node': [
    { role: 'aggregate-nodes', fields: ['aggregateNodeBuffer'], destroyMethod: 'destroyAggregateNodeBuffer' }
  ],
  'far-aggregate-candidates': [
    {
      role: 'candidates',
      fields: ['farAggregateCandidateBuffer'],
      destroyMethod: 'destroyFarAggregateCandidateBuffer'
    }
  ],
  'far-aggregate-force-summary': [
    { role: 'force-summary', fields: ['forceSummaryBuffer'], destroyMethod: 'destroyForceSummaryBuffer' }
  ],
  'far-aggregate-diagnostic-summary': [
    {
      role: 'diagnostic-summary',
      fields: ['diagnosticSummaryBuffer'],
      destroyMethod: 'destroyDiagnosticSummaryBuffer'
    }
  ],
  'far-aggregate-law-consumer': [
    { role: 'law-consumer', fields: ['lawConsumerBuffer'], destroyMethod: 'destroyLawConsumerBuffer' }
  ],
  'far-aggregate-law-consumer-diagnostic-summary': [
    {
      role: 'diagnostic-summary',
      fields: ['diagnosticSummaryBuffer', 'lawConsumerDiagnosticSummaryBuffer'],
      destroyMethod: 'destroyDiagnosticSummaryBuffer'
    }
  ],
  'far-aggregate-gas-state-delta': [
    {
      role: 'gas-state-delta',
      fields: ['gasStateDeltaBuffer', 'stateDeltaBuffer'],
      destroyMethod: 'destroyGasStateDeltaBuffer'
    }
  ],
  'far-aggregate-gas-cell-import': [
    {
      role: 'gas-pressure-cells',
      fields: [
        'gasPressureCellsBuffer',
        'pressureInterfaceGasPressureCellsBuffer',
        'retainedGasPressureCellsBuffer'
      ],
      destroyMethod: 'destroyGasPressureCellsBuffer'
    }
  ],
  'far-aggregate-force-application': [
    {
      role: 'force-application',
      fields: ['forceApplicationBuffer'],
      destroyMethod: 'destroyForceApplicationBuffer'
    }
  ],
  'phase-volume-migration': [
    { role: 'migration', fields: ['migrationBuffer'], destroyMethod: 'destroyMigrationBuffer' }
  ],
  'phase-volume-split-merge-proposal': [
    { role: 'proposal', fields: ['proposalBuffer'], destroyMethod: 'destroyProposalBuffer' }
  ],
  'phase-volume-split-merge-apply': [
    { role: 'apply', fields: ['applyBuffer'], destroyMethod: 'destroyApplyBuffer' }
  ],
  'particle-storage-allocation': [
    { role: 'allocation', fields: ['allocationBuffer'], destroyMethod: 'destroyAllocationBuffer' }
  ],
  'particle-storage-slot-assignment': [
    {
      role: 'slot-assignment',
      fields: ['slotAssignmentBuffer'],
      destroyMethod: 'destroySlotAssignmentBuffer'
    }
  ],
  'particle-storage-materialization': [
    ...PARTICLE_BUFFER_SPECS,
    {
      role: 'materialization-rows',
      fields: ['materializationBuffer'],
      destroyMethod: 'destroyMaterializationBuffer'
    }
  ],
  'particle-storage-compaction': [...PARTICLE_BUFFER_SPECS],
  'phase-volume-level-update': [
    { role: 'level-update', fields: ['levelUpdateBuffer'], destroyMethod: 'destroyLevelUpdateBuffer' }
  ],
  'phase-volume-diagnostic-summary': [
    { role: 'summary', fields: ['summaryBuffer'], destroyMethod: 'destroySummaryBuffer' }
  ],
  [SCHROEDER_SPATIAL_EPOCH_CONSUMER_ARTIFACT_FAMILY.PRESSURE_CONTACT_INTERFACE]:
    exactNearConsumerArtifactSpecs([
      'pressureContactInterfaceProposalBuffer',
      'forceProposalBuffer',
      'forceRowsBuffer'
    ]),
  [SCHROEDER_SPATIAL_EPOCH_CONSUMER_ARTIFACT_FAMILY.REACTION_DISCOVERY]:
    exactNearConsumerArtifactSpecs([
      'reactionDiscoveryProposalBuffer',
      'reactionProposalBuffer'
    ]),
  // Placement decisions/control/completion staging are verification scratch,
  // destroyed by their producer. The durable result is an immutable branded
  // CPU receipt, so this family intentionally publishes no resident buffers.
  [SCHROEDER_SPATIAL_EPOCH_CONSUMER_ARTIFACT_FAMILY.REACTION_PRODUCT_PLACEMENT]: [],
  [SCHROEDER_SPATIAL_EPOCH_CONSUMER_ARTIFACT_FAMILY.SEPARATION]:
    exactNearConsumerArtifactSpecs([
      'separationProposalBuffer',
      'mechanicsDeltaBuffer'
    ]),
  [SCHROEDER_SPATIAL_EPOCH_CONSUMER_ARTIFACT_FAMILY.THERMAL_CONDUCTION]:
    exactNearConsumerArtifactSpecs([
      'thermalConductionProposalBuffer',
      'thermalDeltaBuffer'
    ]),
  [SCHROEDER_SPATIAL_EPOCH_CONSUMER_ARTIFACT_FAMILY.THERMAL_RADIATION]:
    exactNearConsumerArtifactSpecs([
      'thermalRadiationProposalBuffer',
      'radiationDeltaBuffer'
    ]),
  [SCHROEDER_SPATIAL_EPOCH_CONSUMER_ARTIFACT_FAMILY.LOCAL_MATERIAL_INTERFACE]:
    exactNearConsumerArtifactSpecs([
      'localMaterialInterfaceProposalBuffer',
      'materialInterfaceDeltaBuffer',
      'stateDeltaBuffer'
    ])
});

function cleanString(value, fallback = null) {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function exactSpatialEpochGenerationId(value, label) {
  if (
    typeof value !== 'number'
    || !Number.isInteger(value)
    || value < 0
    || value > 0xffff_ffff
  ) {
    throw new TypeError(`${label} requires an exact u32 spatial epoch generation id`);
  }
  return value;
}

function resolveArtifactSpatialEpochGenerationId(ledger, family, value) {
  if (!GENERATION_BOUND_ARTIFACT_FAMILIES.has(family)) return null;
  if (ledger.spatialEpochGenerationId === null) {
    throw new Error(
      `Generation-bound Schroeder hierarchy artifact family ${family} requires a bound spatial epoch ledger`
    );
  }
  const generationId = exactSpatialEpochGenerationId(
    value,
    `Generation-bound Schroeder hierarchy artifact family ${family}`
  );
  if (generationId !== ledger.spatialEpochGenerationId) {
    throw new Error(
      `Generation-bound Schroeder hierarchy artifact family ${family} identifies spatial epoch ${generationId}; expected ${ledger.spatialEpochGenerationId}`
    );
  }
  return generationId;
}

function uniqueStrings(values) {
  return [...new Set((values || []).map((value) => cleanString(value)).filter(Boolean))];
}

function equivalentDestroyAuthority(left, right) {
  if (left === right) return true;
  const isGpuBufferDestroy = (value) => value === 'gpu-buffer-destroy'
    || value?.endsWith(':gpu-buffer-destroy') === true;
  return isGpuBufferDestroy(left) && isGpuBufferDestroy(right);
}

function assertLedger(ledger) {
  if (ledger?.schema !== ULG_SCHROEDER_HIERARCHY_ARTIFACT_LEDGER_SCHEMA) {
    throw new TypeError('Expected a Schroeder hierarchy artifact ledger');
  }
  const runtime = runtimeByLedger.get(ledger);
  if (!runtime) throw new TypeError('Schroeder hierarchy artifact ledger runtime is unavailable');
  return runtime;
}

function recordBlocker(ledger, blocker) {
  ledger.blockers = uniqueStrings([...(ledger.blockers || []), blocker]);
}

function recordWarning(ledger, warning) {
  ledger.warnings = uniqueStrings([...(ledger.warnings || []), warning]);
}

function refreshLedger(ledger) {
  const runtime = assertLedger(ledger);
  const resources = runtime.resources;
  ledger.resourceCount = resources.length;
  ledger.aliasCount = resources.reduce(
    (count, resource) => count + Math.max(0, resource.aliases.length - 1),
    0
  );
  ledger.ownedResourceCount = resources.filter((resource) => resource.owned).length;
  ledger.borrowedResourceCount = resources.filter((resource) => !resource.owned).length;
  ledger.generationBoundResourceCount = resources.filter(
    (resource) => resource.spatialEpochGenerationId !== null
  ).length;
  ledger.transferredResourceCount = resources.filter((resource) => Boolean(resource.transfer)).length;
  ledger.pendingTransferCount = resources.filter(
    (resource) => resource.transfer?.status === 'active'
  ).length;
  ledger.retirementAttemptedResourceCount = resources.filter(
    (resource) => resource.retirementAttempted
  ).length;
  ledger.destroyedResourceCount = resources.filter((resource) => resource.destroyed).length;
  ledger.failedDestroyResourceCount = resources.filter(
    (resource) => resource.destroyStatus === 'destroy-failed'
  ).length;
  ledger.unretiredOwnedResourceCount = resources.filter(
    (resource) => resource.owned
      && !resource.destroyed
      && !resource.externallyOwned
  ).length;
  ledger.baseLeaseSummary = summarizeResidentBufferLeaseLedger(runtime.baseLedger);
  ledger.status = ledger.blockers.length > 0
    ? 'schroeder-hierarchy-artifact-ledger-blocked'
    : (ledger.pendingTransferCount > 0
      ? 'schroeder-hierarchy-artifact-ledger-transferred'
      : (ledger.retirementCompleted
        ? 'schroeder-hierarchy-artifact-ledger-retired'
        : (ledger.resourceCount > 0
          ? 'schroeder-hierarchy-artifact-ledger-ready'
          : 'schroeder-hierarchy-artifact-ledger-empty')));
  return ledger;
}

function byteLengthFor(buffer, artifact, fields) {
  const candidates = [
    buffer?.size,
    ...fields.flatMap((field) => [
      artifact?.[`${field}ByteLength`],
      artifact?.[field.replace(/Buffer$/, 'BufferByteLength')],
      artifact?.[field.replace(/Buffer$/, 'ByteLength')]
    ])
  ];
  return Math.max(0, Math.round(finiteNumber(candidates.find((value) => Number.isFinite(Number(value))), 0)));
}

function groupDestroyer(runtime, artifact, destroyMethod, buffer, {
  allowGroupFallback = false
} = {}) {
  // Prefer one physical destructor per canonical buffer. Group hooks are only
  // a fallback for test doubles or adapters that do not expose GPUBuffer.destroy;
  // otherwise retiring one sibling could invalidate another sibling's lease.
  if (typeof buffer?.destroy === 'function') {
    let invoked = false;
    return {
      destroy: () => {
        if (invoked) return false;
        invoked = true;
        buffer.destroy();
        return true;
      },
      destroyAuthority: 'gpu-buffer-destroy'
    };
  }
  if (
    allowGroupFallback
    && artifact
    && destroyMethod
    && typeof artifact[destroyMethod] === 'function'
  ) {
    let methods = runtime.groupDestroyers.get(artifact);
    if (!methods) {
      methods = new Map();
      runtime.groupDestroyers.set(artifact, methods);
    }
    if (!methods.has(destroyMethod)) {
      let invoked = false;
      methods.set(destroyMethod, () => {
        if (invoked) return false;
        invoked = true;
        artifact[destroyMethod]();
        return true;
      });
    }
    return {
      destroy: methods.get(destroyMethod),
      destroyAuthority: `artifact-method:${destroyMethod}`
    };
  }
  return { destroy: null, destroyAuthority: 'no-destroy-authority' };
}

function resolveRecord(runtime, keyOrAlias) {
  if (keyOrAlias && (typeof keyOrAlias === 'object' || typeof keyOrAlias === 'function')) {
    return runtime.byBuffer.get(keyOrAlias) || null;
  }
  return runtime.byKey.get(cleanString(keyOrAlias)) || null;
}

function retireRecord(ledger, resource, { reason, allowTransferred = false } = {}) {
  const runtime = assertLedger(ledger);
  if (resource.retirementAttempted) return false;
  if (!resource.owned) {
    resource.retirementStatus = 'retirement-skipped-borrowed-resource';
    return false;
  }
  if (resource.transfer && !allowTransferred) {
    resource.retirementStatus = 'retirement-delegated-to-transfer-owner';
    return false;
  }
  if (resource.externallyOwned) {
    resource.retirementStatus = 'retirement-delegated-to-external-owner';
    return false;
  }
  if (typeof resource.destroy !== 'function') {
    resource.retirementStatus = 'retirement-blocked-no-destroy-authority';
    resource.destroyStatus = 'destroy-blocked-no-destroy-authority';
    recordBlocker(ledger, `artifact-destroy-authority-missing:${resource.canonicalKey}`);
    return false;
  }
  resource.retirementAttempted = true;
  resource.retirementReason = cleanString(reason, 'hierarchy-artifact-cleanup');
  try {
    const event = destroyResidentBufferWithLease(
      runtime.baseLedger,
      resource.canonicalKey,
      resource.destroy,
      { reason: resource.retirementReason }
    );
    resource.destroyed = event.status === 'destroyed'
      || event.status === 'destroyed-force-active-lease';
    resource.destroyStatus = event.status;
    resource.retirementStatus = resource.destroyed
      ? 'retirement-completed'
      : event.status;
    ledger.events.push({
      resourceKey: resource.canonicalKey,
      status: resource.retirementStatus,
      reason: resource.retirementReason
    });
  } catch (error) {
    const message = cleanString(error?.message, 'unknown-destroy-error');
    resource.destroyStatus = 'destroy-failed';
    resource.retirementStatus = 'retirement-failed';
    resource.destroyError = message;
    ledger.events.push({
      resourceKey: resource.canonicalKey,
      status: 'retirement-failed',
      reason: resource.retirementReason,
      error: message
    });
    recordBlocker(ledger, `artifact-destroy-failed:${resource.canonicalKey}:${message}`);
  }
  return true;
}

function selectResources(runtime, { keys = null, families = null, roles = null } = {}) {
  const selectedKeys = keys == null ? null : new Set(Array.isArray(keys) ? keys : [keys]);
  const selectedFamilies = families == null
    ? null
    : new Set(Array.isArray(families) ? families : [families]);
  const selectedRoles = roles == null ? null : new Set(Array.isArray(roles) ? roles : [roles]);
  return runtime.resources.filter((resource) => (
    (!selectedKeys || [...selectedKeys].some((key) => resolveRecord(runtime, key) === resource))
    && (resource.memberships || [{ family: resource.family, role: resource.role }]).some(
      (membership) => (
        (!selectedFamilies || selectedFamilies.has(membership.family))
        && (!selectedRoles || selectedRoles.has(membership.role))
      )
    )
  ));
}

function runRetirementPass(ledger, options = {}) {
  const runtime = assertLedger(ledger);
  const resources = selectResources(runtime, options);
  for (const resource of resources) {
    retireRecord(ledger, resource, options);
  }
  refreshLedger(ledger);
  return summarizeSchroederHierarchyArtifactLedger(ledger);
}

function scheduleAfter(ledger, {
  after = null,
  submitted = true,
  requireConfirmedTrue = false,
  scheduleKey,
  reason,
  cleanup
}) {
  const runtime = assertLedger(ledger);
  if (runtime.schedules.has(scheduleKey)) return runtime.schedules.get(scheduleKey);
  const invoke = () => {
    try {
      return cleanup();
    } catch (error) {
      const message = cleanString(error?.message, 'unknown-retirement-error');
      recordBlocker(ledger, `artifact-retirement-pass-failed:${scheduleKey}:${message}`);
      refreshLedger(ledger);
      return summarizeSchroederHierarchyArtifactLedger(ledger);
    }
  };
  const clearResolvedFenceBlockers = () => {
    const blockerMarkers = [
      `artifact-retirement-fence-unconfirmed:${scheduleKey}:`,
      `artifact-retirement-fence-rejected:${scheduleKey}:`
    ];
    const blockerCountBefore = ledger.blockers.length;
    ledger.blockers = ledger.blockers.filter(
      (blocker) => !blockerMarkers.some((marker) => blocker.startsWith(marker))
    );
    if (ledger.blockers.length < blockerCountBefore) {
      recordWarning(
        ledger,
        `artifact-retirement-fence-retry-confirmed:${scheduleKey}`
      );
    }
  };
  const blockUnconfirmedFence = ({ status, message }) => {
    recordBlocker(ledger, `${status}:${scheduleKey}:${message}`);
    ledger.events.push({
      status: `${status}-cleanup-blocked`,
      reason: cleanString(reason, 'hierarchy-artifact-cleanup'),
      error: message
    });
    // A failed fence attempt must be retryable. Keeping the cached schedule
    // would permanently suppress a later owner-confirmed retirement.
    runtime.schedules.delete(scheduleKey);
    refreshLedger(ledger);
    return summarizeSchroederHierarchyArtifactLedger(ledger);
  };
  const confirmAndInvoke = (confirmed) => {
    if (confirmed === false || (requireConfirmedTrue && confirmed !== true)) {
      return blockUnconfirmedFence({
        status: 'artifact-retirement-fence-unconfirmed',
        message: requireConfirmedTrue
          ? 'generation owner did not return exact true'
          : 'fence authority returned false'
      });
    }
    clearResolvedFenceBlockers();
    return invoke();
  };
  let completion;
  if (after && typeof after.then === 'function') {
    completion = Promise.resolve(after).then(
      confirmAndInvoke,
      (error) => {
        const message = cleanString(error?.message, 'unknown-fence-error');
        return blockUnconfirmedFence({
          status: 'artifact-retirement-fence-rejected',
          message
        });
      }
    );
  } else if (submitted && typeof runtime.deferCleanup === 'function') {
    completion = new Promise((resolve) => {
      let scheduled;
      try {
        scheduled = runtime.deferCleanup(
          () => resolve(Promise.resolve().then(() => confirmAndInvoke(true))),
          (error) => resolve(Promise.resolve().then(() => blockUnconfirmedFence({
            status: 'artifact-retirement-fence-rejected',
            message: cleanString(error?.message, 'unknown-fence-error')
          })))
        );
      } catch (error) {
        resolve(Promise.resolve().then(() => blockUnconfirmedFence({
          status: 'artifact-retirement-fence-rejected',
          message: cleanString(error?.message, 'unknown-fence-error')
        })));
        return;
      }
      if (scheduled === false) {
        resolve(Promise.resolve().then(() => blockUnconfirmedFence({
          status: 'artifact-retirement-fence-unconfirmed',
          message: 'deferred cleanup authority did not schedule a fence'
        })));
      }
    });
  } else if (!submitted) {
    completion = Promise.resolve(invoke());
  } else {
    recordBlocker(ledger, `artifact-retirement-fence-missing:${scheduleKey}`);
    ledger.events.push({
      status: 'retirement-not-scheduled-missing-fence',
      reason: cleanString(reason, 'hierarchy-artifact-cleanup')
    });
    refreshLedger(ledger);
    completion = Promise.resolve(summarizeSchroederHierarchyArtifactLedger(ledger));
  }
  runtime.schedules.set(scheduleKey, completion);
  return completion;
}

export function createSchroederHierarchyArtifactLedger({
  ledgerId = null,
  generationId = null,
  step = null,
  time = null,
  deferCleanup = null
} = {}) {
  const resolvedLedgerId = cleanString(
    ledgerId,
    `schroeder-hierarchy:${generationId ?? step ?? 'unknown'}:artifact-ledger`
  );
  const ledger = {
    schema: ULG_SCHROEDER_HIERARCHY_ARTIFACT_LEDGER_SCHEMA,
    ledgerId: resolvedLedgerId,
    generationId,
    spatialEpochGenerationId: null,
    step,
    time,
    status: 'schroeder-hierarchy-artifact-ledger-empty',
    resources: {},
    transfers: [],
    events: [],
    warnings: [],
    blockers: [],
    resourceCount: 0,
    aliasCount: 0,
    ownedResourceCount: 0,
    borrowedResourceCount: 0,
    generationBoundResourceCount: 0,
    transferredResourceCount: 0,
    pendingTransferCount: 0,
    retirementAttemptedResourceCount: 0,
    destroyedResourceCount: 0,
    failedDestroyResourceCount: 0,
    unretiredOwnedResourceCount: 0,
    retirementScheduled: false,
    retirementCompleted: false,
    sealed: false,
    baseLeaseSummary: null
  };
  runtimeByLedger.set(ledger, {
    baseLedger: createResidentBufferLeaseLedger({
      ledgerId: `${resolvedLedgerId}:resident-buffer-leases`,
      stateKey: 'schroeder-hierarchy-artifacts',
      step,
      time,
      scope: 'schroeder-hierarchy-artifact-leases'
    }),
    byBuffer: new WeakMap(),
    byKey: new Map(),
    resources: [],
    groupDestroyers: new WeakMap(),
    schedules: new Map(),
    deferCleanup: typeof deferCleanup === 'function' ? deferCleanup : null
  });
  return refreshLedger(ledger);
}

export function bindSchroederHierarchyArtifactLedgerSpatialEpoch(
  ledger,
  generationId
) {
  assertLedger(ledger);
  if (
    !Number.isInteger(generationId)
    || generationId < 0
    || generationId > 0xffffffff
  ) {
    throw new TypeError('Schroeder hierarchy artifact ledger requires an exact u32 spatial epoch generation id');
  }
  if (
    ledger.spatialEpochGenerationId !== null
    && ledger.spatialEpochGenerationId !== generationId
  ) {
    throw new Error(
      `Schroeder hierarchy artifact ledger is already bound to spatial epoch generation ${ledger.spatialEpochGenerationId}`
    );
  }
  if (ledger.spatialEpochGenerationId === null) {
    ledger.spatialEpochGenerationId = generationId;
    ledger.events.push({
      status: 'artifact-ledger-spatial-epoch-bound',
      spatialEpochGenerationId: generationId
    });
  }
  return summarizeSchroederHierarchyArtifactLedger(ledger);
}

export function registerSchroederHierarchyArtifact(ledger, {
  resourceKey,
  aliases = [],
  family = 'unknown',
  role = 'buffer',
  buffer,
  owned = true,
  destroy = null,
  destroyAuthority = null,
  producerStage = null,
  byteLength = 0,
  rowCount = 0,
  expectedConsumers = [],
  spatialEpochGenerationId = null
} = {}) {
  const runtime = assertLedger(ledger);
  if (ledger.sealed) {
    throw new Error(`Schroeder hierarchy artifact ledger is sealed: ${ledger.ledgerId}`);
  }
  if (!buffer || (typeof buffer !== 'object' && typeof buffer !== 'function')) return null;
  const key = cleanString(resourceKey);
  if (!key) throw new Error('Schroeder hierarchy artifact requires resourceKey');
  const allKeys = uniqueStrings([key, ...aliases]);
  const normalizedFamily = cleanString(family, 'unknown');
  const normalizedRole = cleanString(role, 'buffer');
  const resolvedSpatialEpochGenerationId =
    resolveArtifactSpatialEpochGenerationId(
      ledger,
      normalizedFamily,
      spatialEpochGenerationId
    );
  const existingByBuffer = runtime.byBuffer.get(buffer) || null;
  for (const alias of allKeys) {
    const existingByKey = runtime.byKey.get(alias);
    if (existingByKey && existingByKey !== existingByBuffer) {
      throw new Error(`Schroeder hierarchy artifact key already identifies another buffer: ${alias}`);
    }
  }
  if (existingByBuffer) {
    if (existingByBuffer.owned !== Boolean(owned)) {
      throw new Error(`Schroeder hierarchy artifact ownership conflict: ${key}`);
    }
    const authority = cleanString(destroyAuthority);
    if (
      authority
      && existingByBuffer.destroyAuthority
      && !equivalentDestroyAuthority(authority, existingByBuffer.destroyAuthority)
    ) {
      throw new Error(`Schroeder hierarchy artifact destroy-authority conflict: ${key}`);
    }
    if (
      resolvedSpatialEpochGenerationId !== null
      && existingByBuffer.spatialEpochGenerationId !== null
      && existingByBuffer.spatialEpochGenerationId !== resolvedSpatialEpochGenerationId
    ) {
      throw new Error(
        `Schroeder hierarchy artifact spatial epoch generation conflict: ${key}`
      );
    }
    if (resolvedSpatialEpochGenerationId !== null) {
      existingByBuffer.spatialEpochGenerationId = resolvedSpatialEpochGenerationId;
    }
    for (const alias of allKeys) {
      runtime.byKey.set(alias, existingByBuffer);
      if (!existingByBuffer.aliases.includes(alias)) existingByBuffer.aliases.push(alias);
    }
    if (!existingByBuffer.memberships.some((membership) => (
      membership.family === normalizedFamily && membership.role === normalizedRole
    ))) {
      existingByBuffer.memberships.push({
        family: normalizedFamily,
        role: normalizedRole
      });
      existingByBuffer.memberships.sort((left, right) => (
        left.family.localeCompare(right.family) || left.role.localeCompare(right.role)
      ));
    }
    existingByBuffer.aliases.sort();
    ledger.resources[existingByBuffer.canonicalKey].aliases = [...existingByBuffer.aliases];
    ledger.resources[existingByBuffer.canonicalKey].families = uniqueStrings(
      existingByBuffer.memberships.map((membership) => membership.family)
    ).sort();
    ledger.resources[existingByBuffer.canonicalKey].roles = uniqueStrings(
      existingByBuffer.memberships.map((membership) => membership.role)
    ).sort();
    ledger.resources[existingByBuffer.canonicalKey].memberships =
      existingByBuffer.memberships.map((membership) => ({ ...membership }));
    ledger.resources[existingByBuffer.canonicalKey].spatialEpochGenerationId =
      existingByBuffer.spatialEpochGenerationId;
    refreshLedger(ledger);
    return existingByBuffer;
  }
  const resolvedDestroy = typeof destroy === 'function'
    ? destroy
    : (typeof buffer.destroy === 'function' ? () => buffer.destroy() : null);
  const resource = {
    buffer,
    canonicalKey: key,
    aliases: [...allKeys].sort(),
    family: normalizedFamily,
    role: normalizedRole,
    memberships: [{ family: normalizedFamily, role: normalizedRole }],
    owned: Boolean(owned),
    producerStage: cleanString(producerStage, normalizedFamily),
    byteLength: Math.max(0, Math.round(finiteNumber(byteLength, 0))),
    rowCount: Math.max(0, Math.round(finiteNumber(rowCount, 0))),
    bufferLabel: cleanString(buffer.label),
    spatialEpochGenerationId: resolvedSpatialEpochGenerationId,
    destroy: resolvedDestroy,
    destroyAuthority: cleanString(
      destroyAuthority,
      resolvedDestroy ? 'gpu-buffer-destroy' : 'no-destroy-authority'
    ),
    transfer: null,
    externallyOwned: false,
    retirementAttempted: false,
    retirementStatus: 'retirement-not-requested',
    retirementReason: null,
    destroyed: false,
    destroyStatus: 'destroy-not-requested',
    destroyError: null
  };
  if (resource.owned && typeof resource.destroy !== 'function') {
    recordBlocker(ledger, `artifact-destroy-authority-missing:${key}`);
  }
  runtime.byBuffer.set(buffer, resource);
  for (const alias of resource.aliases) runtime.byKey.set(alias, resource);
  runtime.resources.push(resource);
  registerResidentBufferResource(runtime.baseLedger, {
    resourceKey: key,
    resourceKind: 'schroeder-hierarchy-gpu-artifact',
    stateFamily: normalizedFamily,
    ownerStage: resource.owned ? 'schroeder-hierarchy-generation' : 'caller-external-owner',
    producerStage: resource.producerStage,
    retained: true,
    byteLength: resource.byteLength,
    rowCount: resource.rowCount,
    bufferLabel: resource.bufferLabel,
    expectedConsumers
  });
  ledger.resources[key] = {
    resourceKey: key,
    aliases: [...resource.aliases],
    family: normalizedFamily,
    role: normalizedRole,
    families: [normalizedFamily],
    roles: [normalizedRole],
    memberships: [{ family: normalizedFamily, role: normalizedRole }],
    owned: resource.owned,
    producerStage: resource.producerStage,
    byteLength: resource.byteLength,
    rowCount: resource.rowCount,
    bufferLabel: resource.bufferLabel,
    spatialEpochGenerationId: resource.spatialEpochGenerationId
  };
  refreshLedger(ledger);
  return resource;
}

export function registerSchroederHierarchyArtifactFamily(ledger, {
  family,
  artifact,
  owned = true,
  producerStage = null,
  expectedConsumers = [],
  spatialEpochGenerationId = artifact?.spatialEpochGenerationId ?? null
} = {}) {
  const runtime = assertLedger(ledger);
  const normalizedFamily = cleanString(family);
  const specs = FAMILY_BUFFER_SPECS[normalizedFamily];
  if (!specs) throw new Error(`Unknown Schroeder hierarchy artifact family: ${normalizedFamily || 'missing'}`);
  if (!artifact || typeof artifact !== 'object') return [];
  // Generation authority is a family-level contract, including receipt-only
  // families that deliberately publish no resident buffers. Validating only
  // inside the buffer loop lets an empty-spec family bypass epoch identity.
  resolveArtifactSpatialEpochGenerationId(
    ledger,
    normalizedFamily,
    spatialEpochGenerationId
  );
  const registered = [];
  for (const spec of specs) {
    const populatedFields = spec.fields.filter((field) => artifact[field]);
    const buffer = populatedFields.length > 0 ? artifact[populatedFields[0]] : null;
    if (!buffer) continue;
    const divergentField = populatedFields.find((field) => artifact[field] !== buffer);
    if (divergentField) {
      throw new Error(
        `Schroeder hierarchy artifact aliases identify different buffers: ${normalizedFamily}:${spec.role}:${divergentField}`
      );
    }
    const resourceKey = `${normalizedFamily}:${spec.role}`;
    const aliases = populatedFields.slice(1).map((field) => `${normalizedFamily}:${field}`);
    const authority = groupDestroyer(runtime, artifact, spec.destroyMethod, buffer, {
      // A grouped fallback is safe only for a one-buffer family. For
      // multi-buffer families it could destroy a sibling still held by a
      // render, next-tick, or continuation lease, so fail closed instead.
      allowGroupFallback: specs.length === 1
    });
    const resource = registerSchroederHierarchyArtifact(ledger, {
      resourceKey,
      aliases,
      family: normalizedFamily,
      role: spec.role,
      buffer,
      owned,
      destroy: authority.destroy,
      destroyAuthority: `${normalizedFamily}:${authority.destroyAuthority}`,
      producerStage: producerStage || normalizedFamily,
      byteLength: byteLengthFor(buffer, artifact, populatedFields),
      expectedConsumers,
      spatialEpochGenerationId
    });
    if (resource && !registered.includes(resource)) registered.push(resource);
  }
  return registered;
}

export function transferSchroederHierarchyArtifact(ledger, keyOrAlias, {
  transferClass,
  consumerStage = null,
  reason = null,
  retirementAuthority = transferClass === 'continuation' ? 'external-owner' : 'ledger-consumer'
} = {}) {
  const runtime = assertLedger(ledger);
  if (ledger.sealed) {
    throw new Error(`Schroeder hierarchy artifact ledger is sealed: ${ledger.ledgerId}`);
  }
  const normalizedClass = cleanString(transferClass);
  if (!TRANSFER_CLASSES.has(normalizedClass)) {
    throw new Error(`Unsupported Schroeder hierarchy artifact transfer class: ${normalizedClass || 'missing'}`);
  }
  const normalizedAuthority = cleanString(retirementAuthority);
  if (!RETIREMENT_AUTHORITIES.has(normalizedAuthority)) {
    throw new Error(`Unsupported Schroeder hierarchy retirement authority: ${normalizedAuthority || 'missing'}`);
  }
  const resource = resolveRecord(runtime, keyOrAlias);
  if (!resource) throw new Error(`Unknown Schroeder hierarchy artifact: ${cleanString(keyOrAlias, 'missing')}`);
  if (resource.retirementAttempted || resource.destroyed) {
    throw new Error(`Schroeder hierarchy artifact was already retired: ${resource.canonicalKey}`);
  }
  if (resource.transfer) {
    if (
      resource.transfer.transferClass !== normalizedClass
      || resource.transfer.retirementAuthority !== normalizedAuthority
    ) {
      throw new Error(`Schroeder hierarchy artifact already transferred to another owner: ${resource.canonicalKey}`);
    }
    return resource.transfer;
  }
  const lease = addResidentBufferLease(runtime.baseLedger, {
    leaseId: `${resource.canonicalKey}:${normalizedClass}:lease`,
    resourceKey: resource.canonicalKey,
    consumerStage: cleanString(consumerStage, `${normalizedClass}-consumer`),
    reason: cleanString(reason, `${normalizedClass}-artifact-transfer`)
  });
  const transfer = {
    resourceKey: resource.canonicalKey,
    transferClass: normalizedClass,
    consumerStage: lease.consumerStage,
    reason: lease.reason,
    retirementAuthority: normalizedAuthority,
    leaseId: lease.leaseId,
    status: 'active'
  };
  resource.transfer = transfer;
  ledger.transfers.push(transfer);
  ledger.events.push({
    resourceKey: resource.canonicalKey,
    status: 'artifact-transfer-active',
    transferClass: normalizedClass,
    consumerStage: transfer.consumerStage
  });
  refreshLedger(ledger);
  return transfer;
}

export function transferSchroederHierarchyArtifactFamily(ledger, family, options = {}) {
  const runtime = assertLedger(ledger);
  const resources = selectResources(runtime, {
    families: family,
    roles: options.roles ?? null
  });
  return resources.map((resource) => transferSchroederHierarchyArtifact(
    ledger,
    resource.canonicalKey,
    options
  ));
}

export function retireDiscardedSchroederHierarchyArtifacts(ledger, {
  reason = 'discarded-before-submission',
  keys = null,
  families = null,
  roles = null
} = {}) {
  return runRetirementPass(ledger, {
    reason,
    keys,
    families,
    roles,
    allowTransferred: false
  });
}

export function scheduleSchroederHierarchyArtifactRetirement(ledger, {
  after = null,
  submitted = true,
  requireConfirmedTrue = false,
  reason = 'generation-owner-fence-completed'
} = {}) {
  assertLedger(ledger);
  ledger.sealed = true;
  ledger.retirementScheduled = true;
  refreshLedger(ledger);
  return scheduleAfter(ledger, {
    after,
    submitted,
    requireConfirmedTrue,
    scheduleKey: 'generation-retirement',
    reason,
    cleanup: () => {
      runRetirementPass(ledger, { reason, allowTransferred: false });
      ledger.retirementCompleted = true;
      refreshLedger(ledger);
      return summarizeSchroederHierarchyArtifactLedger(ledger);
    }
  });
}

export function releaseSchroederHierarchyArtifactTransfers(ledger, {
  transferClass,
  after = null,
  submitted = true,
  requireConfirmedTrue = false,
  reason = null,
  keys = null,
  families = null,
  roles = null
} = {}) {
  const runtime = assertLedger(ledger);
  const normalizedClass = cleanString(transferClass);
  if (!TRANSFER_CLASSES.has(normalizedClass)) {
    throw new Error(`Unsupported Schroeder hierarchy artifact transfer class: ${normalizedClass || 'missing'}`);
  }
  const resources = selectResources(runtime, { keys, families, roles }).filter(
    (resource) => resource.transfer?.transferClass === normalizedClass
      && resource.transfer.status === 'active'
  );
  if (resources.length === 0) {
    return Promise.resolve(summarizeSchroederHierarchyArtifactLedger(ledger));
  }
  const releaseReason = cleanString(reason, `${normalizedClass}-consumer-released`);
  const releaseScope = resources.map((resource) => resource.canonicalKey).sort().join(',');
  return scheduleAfter(ledger, {
    after,
    submitted,
    requireConfirmedTrue,
    scheduleKey: `transfer-release:${normalizedClass}:${releaseScope}`,
    reason: releaseReason,
    cleanup: () => {
      for (const resource of resources) {
        const transfer = resource.transfer;
        releaseResidentBufferLease(runtime.baseLedger, transfer.leaseId, {
          status: transfer.retirementAuthority === 'external-owner'
            ? 'ownership-transferred'
            : 'released'
        });
        transfer.status = transfer.retirementAuthority === 'external-owner'
          ? 'ownership-transferred'
          : 'released';
        ledger.events.push({
          resourceKey: resource.canonicalKey,
          status: `artifact-transfer-${transfer.status}`,
          transferClass: normalizedClass,
          reason: releaseReason
        });
        if (transfer.retirementAuthority === 'external-owner') {
          resource.externallyOwned = true;
          resource.retirementStatus = 'retirement-delegated-to-external-owner';
        } else {
          retireRecord(ledger, resource, { reason: releaseReason, allowTransferred: true });
        }
      }
      refreshLedger(ledger);
      return summarizeSchroederHierarchyArtifactLedger(ledger);
    }
  });
}

export function reclaimSchroederHierarchyArtifactTransfers(ledger, {
  after = null,
  submitted = true,
  requireConfirmedTrue = false,
  reason = 'hierarchy-execution-failed-before-transfer-handoff'
} = {}) {
  const runtime = assertLedger(ledger);
  const resources = runtime.resources.filter(
    (resource) => resource.transfer?.status === 'active'
  );
  if (resources.length === 0) {
    return Promise.resolve(summarizeSchroederHierarchyArtifactLedger(ledger));
  }
  return scheduleAfter(ledger, {
    after,
    submitted,
    requireConfirmedTrue,
    scheduleKey: 'transfer-reclaim:failed-execution',
    reason,
    cleanup: () => {
      for (const resource of resources) {
        releaseResidentBufferLease(runtime.baseLedger, resource.transfer.leaseId, {
          status: 'reclaimed-after-failed-handoff'
        });
        resource.transfer.status = 'reclaimed-after-failed-handoff';
        resource.externallyOwned = false;
        ledger.events.push({
          resourceKey: resource.canonicalKey,
          status: 'artifact-transfer-reclaimed-after-failed-handoff',
          transferClass: resource.transfer.transferClass,
          reason
        });
        retireRecord(ledger, resource, { reason, allowTransferred: true });
      }
      refreshLedger(ledger);
      return summarizeSchroederHierarchyArtifactLedger(ledger);
    }
  });
}

export function schroederHierarchyArtifactBufferLifecycle(ledger, buffer) {
  if (!ledger || !buffer) return null;
  const runtime = assertLedger(ledger);
  const resource = resolveRecord(runtime, buffer);
  if (!resource) return null;
  return {
    resourceKey: resource.canonicalKey,
    family: resource.family,
    role: resource.role,
    families: uniqueStrings(resource.memberships.map((membership) => membership.family)).sort(),
    roles: uniqueStrings(resource.memberships.map((membership) => membership.role)).sort(),
    memberships: resource.memberships.map((membership) => ({ ...membership })),
    spatialEpochGenerationId: resource.spatialEpochGenerationId,
    owned: resource.owned,
    transfer: resource.transfer ? { ...resource.transfer } : null,
    externallyOwned: resource.externallyOwned,
    retirementAttempted: resource.retirementAttempted,
    retirementStatus: resource.retirementStatus,
    destroyed: resource.destroyed,
    destroyStatus: resource.destroyStatus
  };
}

export function summarizeSchroederHierarchyArtifactLedger(ledger) {
  const runtime = assertLedger(ledger);
  refreshLedger(ledger);
  return {
    schema: ULG_SCHROEDER_HIERARCHY_ARTIFACT_LEDGER_SUMMARY_SCHEMA,
    ledgerId: ledger.ledgerId,
    generationId: ledger.generationId,
    spatialEpochGenerationId: ledger.spatialEpochGenerationId,
    step: ledger.step,
    time: ledger.time,
    status: ledger.status,
    resourceCount: ledger.resourceCount,
    aliasCount: ledger.aliasCount,
    ownedResourceCount: ledger.ownedResourceCount,
    borrowedResourceCount: ledger.borrowedResourceCount,
    generationBoundResourceCount: ledger.generationBoundResourceCount,
    transferredResourceCount: ledger.transferredResourceCount,
    pendingTransferCount: ledger.pendingTransferCount,
    retirementAttemptedResourceCount: ledger.retirementAttemptedResourceCount,
    destroyedResourceCount: ledger.destroyedResourceCount,
    failedDestroyResourceCount: ledger.failedDestroyResourceCount,
    unretiredOwnedResourceCount: ledger.unretiredOwnedResourceCount,
    retirementScheduled: ledger.retirementScheduled,
    retirementCompleted: ledger.retirementCompleted,
    sealed: ledger.sealed,
    resources: Object.fromEntries(runtime.resources.map((resource) => [resource.canonicalKey, {
      resourceKey: resource.canonicalKey,
      aliases: [...resource.aliases],
      family: resource.family,
      role: resource.role,
      families: uniqueStrings(resource.memberships.map((membership) => membership.family)).sort(),
      roles: uniqueStrings(resource.memberships.map((membership) => membership.role)).sort(),
      memberships: resource.memberships.map((membership) => ({ ...membership })),
      spatialEpochGenerationId: resource.spatialEpochGenerationId,
      owned: resource.owned,
      producerStage: resource.producerStage,
      byteLength: resource.byteLength,
      rowCount: resource.rowCount,
      bufferLabel: resource.bufferLabel,
      transfer: resource.transfer ? { ...resource.transfer } : null,
      externallyOwned: resource.externallyOwned,
      retirementAttempted: resource.retirementAttempted,
      retirementStatus: resource.retirementStatus,
      destroyed: resource.destroyed,
      destroyStatus: resource.destroyStatus,
      destroyError: resource.destroyError
    }])),
    transfers: ledger.transfers.map((transfer) => ({ ...transfer })),
    events: ledger.events.map((event) => ({ ...event })),
    baseLeaseSummary: summarizeResidentBufferLeaseLedger(runtime.baseLedger),
    warnings: [...ledger.warnings],
    blockers: [...ledger.blockers]
  };
}
