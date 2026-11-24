export const ULG_RESIDENT_BUFFER_LEASE_LEDGER_SCHEMA = 'peercompute.ulg.resident-buffer-lease-ledger.v0';
export const ULG_RESIDENT_BUFFER_RESOURCE_SCHEMA = 'peercompute.ulg.resident-buffer-resource.v0';
export const ULG_RESIDENT_BUFFER_LEASE_SCHEMA = 'peercompute.ulg.resident-buffer-lease.v0';
export const ULG_RESIDENT_BUFFER_LEASE_SUMMARY_SCHEMA = 'peercompute.ulg.resident-buffer-lease-summary.v0';
export const ULG_RESIDENT_MODULE_LEASE_HANDLE_SCHEMA = 'peercompute.ulg.resident-module-buffer-lease.v1';
export const ULG_RESIDENT_MODULE_CHECKPOINT_SCHEMA = 'peercompute.ulg.resident-module-checkpoint.v1';

function cleanString(value, fallback = null) {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function cleanList(value) {
  if (value == null) return [];
  if (!Array.isArray(value)) return [cleanString(value)].filter(Boolean);
  return value.map((entry) => cleanString(entry)).filter(Boolean);
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function uniqueList(value) {
  return [...new Set(cleanList(value))];
}

function resourceActiveLeases(ledger, resourceKey) {
  return ledger.leases.filter((lease) => lease.resourceKey === resourceKey && lease.status === 'active');
}

function clearDestroyOwnerBlockers(ledger, resourceKey) {
  ledger.blockers = ledger.blockers.filter(
    (blocker) => blocker !== `destroy-owner-refused:${resourceKey}`
      && !blocker.startsWith(`destroy-owner-failed:${resourceKey}:`)
  );
}

function refreshResidentBufferLeaseLedger(ledger) {
  const activeByResource = new Map();
  let activeLeaseCount = 0;
  for (const lease of ledger.leases) {
    if (lease.status === 'active') {
      activeLeaseCount += 1;
      activeByResource.set(lease.resourceKey, (activeByResource.get(lease.resourceKey) || 0) + 1);
    }
  }
  const resources = Object.values(ledger.resources);
  let destroyedResourceCount = 0;
  for (const resource of resources) {
    resource.activeLeaseCount = activeByResource.get(resource.resourceKey) || 0;
    if (resource.destroyed) destroyedResourceCount += 1;
  }
  ledger.resourceCount = resources.length;
  ledger.activeLeaseCount = activeLeaseCount;
  ledger.destroyedResourceCount = destroyedResourceCount;
  ledger.skippedDestroyCount = ledger.events.filter((event) => event.status === 'destroy-skipped-active-lease').length;
  ledger.pendingDestroyCount = ledger.events.filter(
    (event) => event.status === 'destroy-scheduled-owner-pending'
  ).length;
  ledger.warnings = uniqueList(ledger.warnings);
  ledger.blockers = uniqueList(ledger.blockers);
  ledger.status = ledger.blockers.length > 0
    ? 'resident-buffer-lease-ledger-blocked'
    : (ledger.activeLeaseCount > 0
      ? 'resident-buffer-lease-ledger-active'
      : (ledger.pendingDestroyCount > 0
        ? 'resident-buffer-lease-ledger-cleanup-pending'
        : (ledger.destroyedResourceCount > 0
          ? 'resident-buffer-lease-ledger-cleaned'
          : (ledger.resourceCount > 0 ? 'resident-buffer-lease-ledger-ready' : 'resident-buffer-lease-ledger-empty'))));
  return ledger;
}

export function createResidentBufferLeaseLedger({
  ledgerId = null,
  stateKey = null,
  step = null,
  time = null,
  scope = 'resident-buffer-leases',
  resources = [],
  warnings = [],
  blockers = []
} = {}) {
  const ledger = {
    schema: ULG_RESIDENT_BUFFER_LEASE_LEDGER_SCHEMA,
    ledgerId: cleanString(ledgerId, `${scope}:buffer-lease-ledger`),
    stateKey: cleanString(stateKey),
    scope,
    step,
    time,
    resources: {},
    leases: [],
    events: [],
    warnings: cleanList(warnings),
    blockers: cleanList(blockers),
    resourceCount: 0,
    activeLeaseCount: 0,
    destroyedResourceCount: 0,
    skippedDestroyCount: 0,
    pendingDestroyCount: 0,
    status: 'resident-buffer-lease-ledger-empty'
  };
  for (const resource of resources) {
    registerResidentBufferResource(ledger, resource);
  }
  return refreshResidentBufferLeaseLedger(ledger);
}

export function residentProductMassResourceKey(role, residentProductMass) {
  const label = cleanString(
    residentProductMass?.productEventBuffer?.label
      ?? residentProductMass?.source
      ?? residentProductMass?.status,
    'product-events'
  );
  const rows = finiteNumber(residentProductMass?.productEventRowCount, 0);
  const bytes = finiteNumber(residentProductMass?.productEventBufferByteLength, 0);
  return `${cleanString(role, 'resident-product-mass')}:${label}:${rows}:${bytes}`;
}

export function registerResidentBufferResource(ledger, resource = {}) {
  if (ledger?.schema !== ULG_RESIDENT_BUFFER_LEASE_LEDGER_SCHEMA) {
    throw new TypeError('Expected a resident buffer lease ledger');
  }
  const resourceKey = cleanString(resource.resourceKey);
  if (!resourceKey) {
    throw new Error('Resident buffer resource requires resourceKey');
  }
  if (ledger.resources[resourceKey]) {
    return ledger.resources[resourceKey];
  }
  const normalized = {
    schema: ULG_RESIDENT_BUFFER_RESOURCE_SCHEMA,
    resourceKey,
    resourceKind: cleanString(resource.resourceKind, 'unknown-buffer'),
    stateFamily: cleanString(resource.stateFamily),
    ownerStage: cleanString(resource.ownerStage),
    producerStage: cleanString(resource.producerStage),
    source: cleanString(resource.source),
    status: cleanString(resource.status, 'resource-retained'),
    retained: resource.retained !== false,
    byteLength: finiteNumber(resource.byteLength, 0),
    rowCount: finiteNumber(resource.rowCount, 0),
    bufferLabel: cleanString(resource.bufferLabel),
    expectedConsumers: uniqueList(resource.expectedConsumers),
    activeLeaseCount: 0,
    destroyed: false,
    destroyStatus: 'destroy-not-requested',
    warnings: cleanList(resource.warnings),
    blockers: cleanList(resource.blockers),
    stageIndex: Number.isInteger(resource.stageIndex) ? resource.stageIndex : Object.keys(ledger.resources).length
  };
  ledger.resources[resourceKey] = normalized;
  ledger.warnings.push(...normalized.warnings);
  ledger.blockers.push(...normalized.blockers);
  refreshResidentBufferLeaseLedger(ledger);
  return normalized;
}

export function addResidentBufferLease(ledger, {
  leaseId = null,
  resourceKey,
  consumerStage,
  reason = 'borrowed-buffer',
  readOnly = true,
  status = 'active'
} = {}) {
  if (ledger?.schema !== ULG_RESIDENT_BUFFER_LEASE_LEDGER_SCHEMA) {
    throw new TypeError('Expected a resident buffer lease ledger');
  }
  const key = cleanString(resourceKey);
  if (!key || !ledger.resources[key]) {
    throw new Error(`Resident buffer lease requires registered resource: ${key || 'missing'}`);
  }
  const lease = {
    schema: ULG_RESIDENT_BUFFER_LEASE_SCHEMA,
    leaseId: cleanString(leaseId, `${key}:lease:${ledger.leases.length}`),
    resourceKey: key,
    consumerStage: cleanString(consumerStage, 'unknown-consumer'),
    reason: cleanString(reason, 'borrowed-buffer'),
    readOnly: Boolean(readOnly),
    status: cleanString(status, 'active')
  };
  ledger.leases.push(lease);
  refreshResidentBufferLeaseLedger(ledger);
  return lease;
}

export function releaseResidentBufferLease(ledger, leaseId, {
  status = 'released'
} = {}) {
  if (ledger?.schema !== ULG_RESIDENT_BUFFER_LEASE_LEDGER_SCHEMA) {
    throw new TypeError('Expected a resident buffer lease ledger');
  }
  const lease = ledger.leases.find((candidate) => candidate.leaseId === leaseId);
  if (!lease) return null;
  lease.status = cleanString(status, 'released');
  refreshResidentBufferLeaseLedger(ledger);
  return lease;
}

export function canDestroyResidentBuffer(ledger, resourceKey) {
  if (ledger?.schema !== ULG_RESIDENT_BUFFER_LEASE_LEDGER_SCHEMA) {
    throw new TypeError('Expected a resident buffer lease ledger');
  }
  const key = cleanString(resourceKey);
  const resource = key ? ledger.resources[key] : null;
  const activeLeases = key ? resourceActiveLeases(ledger, key) : [];
  return {
    resourceKey: key,
    resource,
    activeLeases,
    activeLeaseCount: activeLeases.length,
    canDestroy: activeLeases.length === 0,
    status: activeLeases.length === 0 ? 'destroy-allowed' : 'destroy-blocked-active-lease'
  };
}

export function destroyResidentBufferWithLease(ledger, resourceKey, destroyFn, {
  force = false,
  reason = 'cleanup'
} = {}) {
  const decision = canDestroyResidentBuffer(ledger, resourceKey);
  const resource = decision.resource;
  if (!resource) {
    const event = {
      resourceKey: cleanString(resourceKey, 'unknown-resource'),
      status: 'destroy-skipped-missing-resource',
      reason: cleanString(reason, 'cleanup')
    };
    ledger.events.push(event);
    ledger.warnings.push(`destroy-skipped-missing-resource:${event.resourceKey}`);
    refreshResidentBufferLeaseLedger(ledger);
    return event;
  }
  // An asynchronous owner handoff is itself the exclusive destruction lease.
  // Replaying cleanup while that handoff is unresolved must observe the exact
  // same event/promise instead of invoking the owner a second time.
  if (resource.pendingDestroyEvent) return resource.pendingDestroyEvent;
  if (resource.destroyed && resource.completedDestroyEvent) {
    return resource.completedDestroyEvent;
  }
  if (!decision.canDestroy && !force) {
    const event = {
      resourceKey,
      status: 'destroy-skipped-active-lease',
      reason: cleanString(reason, 'cleanup'),
      activeLeaseCount: decision.activeLeaseCount,
      activeLeaseIds: decision.activeLeases.map((lease) => lease.leaseId)
    };
    resource.destroyStatus = event.status;
    ledger.events.push(event);
    ledger.warnings.push(`destroy-skipped-active-lease:${resourceKey}`);
    refreshResidentBufferLeaseLedger(ledger);
    return event;
  }
  if (typeof destroyFn === 'function') {
    const destroyResult = destroyFn();
    if (destroyResult?.then) {
      resource.destroyStatus = 'destroy-scheduled-owner-pending';
      const event = {
        resourceKey,
        status: resource.destroyStatus,
        reason: cleanString(reason, 'cleanup'),
        activeLeaseCount: decision.activeLeaseCount
      };
      ledger.events.push(event);
      Object.defineProperty(resource, 'pendingDestroyEvent', {
        value: event,
        writable: true,
        configurable: true,
        enumerable: false
      });
      refreshResidentBufferLeaseLedger(ledger);
      const completion = Promise.resolve(destroyResult).then(
        (released) => {
          resource.pendingDestroyEvent = null;
          if (released !== true) {
            resource.destroyStatus = 'destroy-owner-refused';
            event.status = resource.destroyStatus;
            ledger.blockers.push(`destroy-owner-refused:${resourceKey}`);
          } else {
            resource.destroyed = true;
            resource.destroyStatus = force && decision.activeLeaseCount > 0
              ? 'destroyed-force-active-lease'
              : 'destroyed';
            event.status = resource.destroyStatus;
            Object.defineProperty(resource, 'completedDestroyEvent', {
              value: event,
              writable: true,
              configurable: true,
              enumerable: false
            });
            clearDestroyOwnerBlockers(ledger, resourceKey);
          }
          refreshResidentBufferLeaseLedger(ledger);
          return event;
        },
        (error) => {
          resource.pendingDestroyEvent = null;
          resource.destroyStatus = 'destroy-owner-failed';
          event.status = resource.destroyStatus;
          event.error = cleanString(error?.message, String(error));
          ledger.blockers.push(
            `destroy-owner-failed:${resourceKey}:${event.error}`
          );
          refreshResidentBufferLeaseLedger(ledger);
          return event;
        }
      );
      Object.defineProperty(event, 'completion', {
        value: completion,
        enumerable: false
      });
      return event;
    }
    if (destroyResult === false) {
      resource.destroyStatus = 'destroy-owner-refused';
      const event = {
        resourceKey,
        status: resource.destroyStatus,
        reason: cleanString(reason, 'cleanup'),
        activeLeaseCount: decision.activeLeaseCount
      };
      ledger.events.push(event);
      ledger.blockers.push(`destroy-owner-refused:${resourceKey}`);
      refreshResidentBufferLeaseLedger(ledger);
      return event;
    }
    resource.destroyed = true;
    resource.destroyStatus = force && decision.activeLeaseCount > 0
      ? 'destroyed-force-active-lease'
      : 'destroyed';
    clearDestroyOwnerBlockers(ledger, resourceKey);
  } else {
    resource.destroyStatus = 'destroy-noop-no-destroy-fn';
  }
  const event = {
    resourceKey,
    status: resource.destroyStatus,
    reason: cleanString(reason, 'cleanup'),
    activeLeaseCount: decision.activeLeaseCount
  };
  ledger.events.push(event);
  if (resource.destroyed) {
    Object.defineProperty(resource, 'completedDestroyEvent', {
      value: event,
      writable: true,
      configurable: true,
      enumerable: false
    });
  }
  refreshResidentBufferLeaseLedger(ledger);
  return event;
}

export function summarizeResidentBufferLeaseLedger(ledger) {
  if (!ledger) return null;
  if (ledger.schema !== ULG_RESIDENT_BUFFER_LEASE_LEDGER_SCHEMA) {
    throw new TypeError('Expected a resident buffer lease ledger');
  }
  return {
    schema: ULG_RESIDENT_BUFFER_LEASE_SUMMARY_SCHEMA,
    ledgerId: ledger.ledgerId,
    stateKey: ledger.stateKey,
    scope: ledger.scope,
    step: ledger.step,
    time: ledger.time,
    status: ledger.status,
    resourceCount: ledger.resourceCount,
    activeLeaseCount: ledger.activeLeaseCount,
    destroyedResourceCount: ledger.destroyedResourceCount,
    skippedDestroyCount: ledger.skippedDestroyCount,
    pendingDestroyCount: ledger.pendingDestroyCount,
    resources: Object.fromEntries(
      Object.entries(ledger.resources).map(([key, resource]) => [key, {
        resourceKey: resource.resourceKey,
        resourceKind: resource.resourceKind,
        stateFamily: resource.stateFamily,
        ownerStage: resource.ownerStage,
        producerStage: resource.producerStage,
        status: resource.status,
        retained: resource.retained,
        byteLength: resource.byteLength,
        rowCount: resource.rowCount,
        bufferLabel: resource.bufferLabel,
        expectedConsumers: [...(resource.expectedConsumers || [])],
        activeLeaseCount: resource.activeLeaseCount,
        destroyed: resource.destroyed,
        destroyStatus: resource.destroyStatus
      }])
    ),
    leases: ledger.leases.map((lease) => ({ ...lease })),
    events: ledger.events.map((event) => ({ ...event })),
    warnings: [...(ledger.warnings || [])],
    blockers: [...(ledger.blockers || [])]
  };
}

export function buildMlsMpmResidentStepBufferLeaseLedger({
  step = null,
  time = null,
  stateKey = 'mls-mpm-resident-step',
  inputResidentProductMass = null,
  emittedResidentProductMass = null,
  residentProductMass = null,
  nextParticleUploads = null,
  schroederParticleStorageAdoption = null,
  pressureInterfaceForceRowCount = 0,
  compactGpuSummary = null
} = {}) {
  const ledger = createResidentBufferLeaseLedger({
    ledgerId: `mls-mpm-resident-step:${step ?? 'unknown'}:buffer-leases`,
    stateKey,
    step,
    time,
    scope: 'mls-mpm-resident-step-buffer-leases'
  });
  const productResources = [
    {
      role: 'input-resident-product-mass',
      handle: inputResidentProductMass,
      ownerStage: 'previous-resident-step',
      producerStage: 'previous-resident-step',
      expectedConsumers: ['p2g-grid-projection']
    },
    {
      role: 'emitted-resident-product-mass',
      handle: emittedResidentProductMass,
      ownerStage: 'reaction-step',
      producerStage: 'reaction-step',
      expectedConsumers: residentProductMass && residentProductMass !== emittedResidentProductMass
        ? ['resident-product-mass-merge']
        : ['next-resident-step']
    },
    {
      role: 'resident-product-mass',
      handle: residentProductMass,
      ownerStage: 'resident-product-mass-handle',
      producerStage: residentProductMass === emittedResidentProductMass
        ? 'reaction-step'
        : (residentProductMass === inputResidentProductMass ? 'previous-resident-step' : 'resident-product-mass-merge'),
      expectedConsumers: ['next-p2g', 'pressure-eos', 'render-field']
    }
  ];
  for (const { role, handle, ownerStage, producerStage, expectedConsumers } of productResources) {
    if (!handle?.productEventBufferRetained && !handle?.productEventBuffer) continue;
    if (role !== 'resident-product-mass' && handle === residentProductMass) continue;
    const resourceKey = residentProductMassResourceKey(role, handle);
    registerResidentBufferResource(ledger, {
      resourceKey,
      resourceKind: 'resident-product-event-buffer',
      stateFamily: 'reaction-products',
      ownerStage,
      producerStage,
      source: handle.source,
      status: handle.status,
      retained: Boolean(handle.productEventBufferRetained || handle.productEventBuffer),
      byteLength: handle.productEventBufferByteLength,
      rowCount: handle.productEventRowCount,
      bufferLabel: handle.productEventBuffer?.label,
      expectedConsumers
    });
    if (role === 'resident-product-mass' && nextParticleUploads?.residentProductMass === handle) {
      addResidentBufferLease(ledger, {
        resourceKey,
        consumerStage: 'next-resident-step',
        reason: 'carried-resident-product-mass'
      });
    }
  }
  if (schroederParticleStorageAdoption?.adopted === true) {
    const registerAdoptedParticleBuffer = ({
      role,
      buffer,
      stateFamily,
      byteLength,
      rowCount,
      strideBytes
    }) => {
      if (!buffer) return;
      const resourceKey = `schroeder-particle-storage:${role}:${buffer.label || byteLength || 'buffer'}`;
      registerResidentBufferResource(ledger, {
        resourceKey,
        resourceKind: 'schroeder-materialized-particle-buffer',
        stateFamily,
        ownerStage: 'schroeder-particle-storage-materialization',
        producerStage: 'schroeder-particle-storage-materialization',
        source: schroederParticleStorageAdoption.sourceStatus || schroederParticleStorageAdoption.status,
        status: schroederParticleStorageAdoption.status,
        retained: true,
        byteLength,
        rowCount,
        strideBytes,
        bufferLabel: buffer.label,
        expectedConsumers: ['next-resident-step']
      });
      addResidentBufferLease(ledger, {
        resourceKey,
        consumerStage: 'next-resident-step',
        reason: 'adopted-schroeder-particle-storage'
      });
    };
    registerAdoptedParticleBuffer({
      role: 'sph-state',
      buffer: schroederParticleStorageAdoption.stateBuffer,
      stateFamily: 'particle-kinematics',
      byteLength: schroederParticleStorageAdoption.stateBufferByteLength,
      rowCount: schroederParticleStorageAdoption.authoritativeParticleCount,
      strideBytes: schroederParticleStorageAdoption.stateStrideBytes
    });
    registerAdoptedParticleBuffer({
      role: 'sph-thermo',
      buffer: schroederParticleStorageAdoption.thermoBuffer,
      stateFamily: 'thermo-phase',
      byteLength: schroederParticleStorageAdoption.thermoBufferByteLength,
      rowCount: schroederParticleStorageAdoption.authoritativeParticleCount,
      strideBytes: schroederParticleStorageAdoption.thermoStrideBytes
    });
    registerAdoptedParticleBuffer({
      role: 'mls-mpm-mechanics',
      buffer: schroederParticleStorageAdoption.mechanicsBuffer,
      stateFamily: 'mechanics',
      byteLength: schroederParticleStorageAdoption.mechanicsBufferByteLength,
      rowCount: schroederParticleStorageAdoption.authoritativeParticleCount,
      strideBytes: schroederParticleStorageAdoption.mechanicsStrideBytes
    });
  }
  if (pressureInterfaceForceRowCount > 0) {
    registerResidentBufferResource(ledger, {
      resourceKey: `pressure-interface-force-rows:${pressureInterfaceForceRowCount}`,
      resourceKind: 'pressure-interface-force-rows',
      stateFamily: 'pressure-interface',
      ownerStage: 'grid-update-pressure-interface-consumer',
      producerStage: 'pressure-interface-force-solver',
      status: 'pressure-interface-force-rows-observed',
      retained: true,
      rowCount: pressureInterfaceForceRowCount,
      expectedConsumers: ['grid-update', 'diagnostics', 'optional-render-preview']
    });
  }
  if (compactGpuSummary?.compactGpuSummaryAvailable || compactGpuSummary?.status) {
    registerResidentBufferResource(ledger, {
      resourceKey: `compact-summary:${compactGpuSummary.status || 'observed'}`,
      resourceKind: 'compact-diagnostic-summary',
      stateFamily: 'diagnostics',
      ownerStage: 'compact-summary',
      producerStage: 'compact-summary',
      status: compactGpuSummary.status,
      retained: false,
      byteLength: compactGpuSummary.compactReadbackByteLength,
      expectedConsumers: ['diagnostics-overlay']
    });
  }
  return refreshResidentBufferLeaseLedger(ledger);
}

function stableModulePayloadHash(payload) {
  const text = JSON.stringify(payload);
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (ch + i), 0x85ebca6b) >>> 0;
  }
  return `fnv1a64:${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

function normalizeLayoutDescriptor(layout = {}) {
  const src = layout && typeof layout === 'object' ? layout : {};
  return Object.freeze({
    tensorId: cleanString(src.tensorId, 'state'),
    dtype: cleanString(src.dtype, 'f32'),
    layout: cleanString(src.layout, 'interleaved'),
    strideElements: Math.max(1, Math.floor(finiteNumber(src.strideElements, 1))),
    strideBytes: Math.max(4, Math.floor(finiteNumber(src.strideBytes, 4))),
    fields: Object.freeze(Array.isArray(src.fields) ? src.fields.map((f) => String(f)) : [])
  });
}

/**
 * Host-owned resident buffer session for external/pluggable simulation modules
 * (e.g., Eshkol N-body gravity, comoving cosmological charts, or quantum field
 * samplers sharing one GPUDevice). Supplies host-issued resource keys, step
 * numbers, layout descriptors, epoch-fenced read leases, and portable
 * checkpoints; resetting the session invalidates every previously issued handle
 * fail-closed.
 */
export function createResidentModuleBufferSession({
  sessionId = null,
  moduleId = 'simulation-module',
  device = null,
  layout = {},
  initialStep = 0
} = {}) {
  const resolvedModuleId = cleanString(moduleId, 'simulation-module');
  const resolvedSessionId = cleanString(sessionId, `${resolvedModuleId}:session:0`);
  const defaultLayout = normalizeLayoutDescriptor(layout);

  let resetEpoch = 0;
  let stepIndex = Math.max(0, Math.floor(finiteNumber(initialStep, 0)));
  let disposed = false;
  let nextHandleOrdinal = 1;
  let currentDevice = device || null;

  // Map<resourceKey, { buffer, destroyFn, layout, stepIndex, resetEpoch, byteLength, rowCount, portableSnapshotFn }>
  const liveBuffers = new Map();
  // Map<handleId, { leaseId, resourceKey, resetEpoch, stepIndex, released }>
  const issuedHandles = new Map();

  let ledger = createResidentBufferLeaseLedger({
    ledgerId: `${resolvedSessionId}:epoch:${resetEpoch}`,
    stateKey: resolvedModuleId,
    step: stepIndex,
    scope: 'resident-module-buffer-session'
  });

  function makeVersionedResourceKey(baseKey) {
    const cleanBase = cleanString(baseKey, 'state');
    return `${resolvedSessionId}:e${resetEpoch}:s${stepIndex}:${cleanBase}`;
  }

  function resolveLiveEntry(resourceKeyOrBase) {
    const key = cleanString(resourceKeyOrBase);
    if (!key) return null;
    if (liveBuffers.has(key)) return { resourceKey: key, entry: liveBuffers.get(key) };
    for (const [fullKey, entry] of liveBuffers.entries()) {
      if (entry.baseKey === key) return { resourceKey: fullKey, entry };
    }
    return null;
  }

  function pruneRetiredLedgerEntries(candidateResourceKey = null) {
    // Keep only active leases so long-running 60 Hz sessions stay strictly O(1) in memory and CPU.
    if (ledger.leases.length > 0) {
      let writeIdx = 0;
      for (let i = 0; i < ledger.leases.length; i += 1) {
        if (ledger.leases[i].status === 'active') {
          ledger.leases[writeIdx++] = ledger.leases[i];
        }
      }
      ledger.leases.length = writeIdx;
    }
    const keysToCheck = candidateResourceKey
      ? [candidateResourceKey]
      : Object.keys(ledger.resources);
    let pruned = false;
    for (const key of keysToCheck) {
      if (liveBuffers.has(key)) continue;
      const hasActive = ledger.leases.some((l) => l.resourceKey === key && l.status === 'active');
      if (!hasActive && ledger.resources[key]) {
        delete ledger.resources[key];
        pruned = true;
      }
    }
    if (pruned || candidateResourceKey) {
      refreshResidentBufferLeaseLedger(ledger);
    }
  }

  function publishBuffer({
    resourceKey = 'bodies',
    buffer = null,
    destroyFn = null,
    byteLength = 0,
    rowCount = 0,
    layout: bufferLayout = null,
    stateFamily = 'module-state',
    ownerStage = resolvedModuleId,
    producerStage = resolvedModuleId,
    stepIndex: nextStep = stepIndex,
    portableSnapshotFn = null,
    expectedConsumers = ['renderer', 'next-step']
  } = {}) {
    if (disposed) {
      const err = new RangeError(`Resident buffer session ${resolvedSessionId} is disposed`);
      err.code = 'ERR_DISPOSED_RESIDENT_BUFFER_SESSION';
      throw err;
    }
    const baseKey = cleanString(resourceKey, 'state');
    const resolvedStep = Math.max(0, Math.floor(finiteNumber(nextStep, stepIndex)));
    stepIndex = resolvedStep;
    ledger.step = stepIndex;

    // Retire any previous generation for the same baseKey; destroy its GPU buffer if unleased and replaced.
    const previous = resolveLiveEntry(baseKey);
    if (previous) {
      liveBuffers.delete(previous.resourceKey);
      if (previous.destroyFn && previous.buffer !== buffer) {
        destroyResidentBufferWithLease(ledger, previous.resourceKey, previous.destroyFn, {
          reason: 'superseded-by-publish',
          step: resolvedStep
        });
      }
      pruneRetiredLedgerEntries(previous.resourceKey);
    }

    const versionedKey = makeVersionedResourceKey(baseKey);
    const normalizedLayout = bufferLayout ? normalizeLayoutDescriptor(bufferLayout) : defaultLayout;
    const resolvedByteLength = finiteNumber(
      byteLength,
      finiteNumber(buffer?.size, rowCount * normalizedLayout.strideBytes)
    );
    const resolvedRowCount = finiteNumber(
      rowCount,
      normalizedLayout.strideBytes > 0 ? Math.floor(resolvedByteLength / normalizedLayout.strideBytes) : 0
    );

    registerResidentBufferResource(ledger, {
      resourceKey: versionedKey,
      resourceKind: 'resident-module-buffer',
      stateFamily: cleanString(stateFamily, 'module-state'),
      ownerStage: cleanString(ownerStage, resolvedModuleId),
      producerStage: cleanString(producerStage, resolvedModuleId),
      source: resolvedSessionId,
      status: 'resource-retained',
      retained: true,
      byteLength: resolvedByteLength,
      rowCount: resolvedRowCount,
      bufferLabel: cleanString(buffer?.label, versionedKey),
      expectedConsumers
    });

    const entry = {
      baseKey,
      resourceKey: versionedKey,
      buffer,
      destroyFn: typeof destroyFn === 'function'
        ? destroyFn
        : (typeof buffer?.destroy === 'function' ? () => { buffer.destroy(); return true; } : null),
      layout: normalizedLayout,
      stepIndex: resolvedStep,
      resetEpoch,
      byteLength: resolvedByteLength,
      rowCount: resolvedRowCount,
      portableSnapshotFn: typeof portableSnapshotFn === 'function' ? portableSnapshotFn : null
    };
    liveBuffers.set(versionedKey, entry);

    return Object.freeze({
      sessionId: resolvedSessionId,
      moduleId: resolvedModuleId,
      resourceKey: versionedKey,
      baseKey,
      resetEpoch,
      stepIndex: resolvedStep,
      layout: normalizedLayout,
      byteLength: resolvedByteLength,
      rowCount: resolvedRowCount
    });
  }

  function validateLeaseHandle(handle) {
    if (!handle || handle.schema !== ULG_RESIDENT_MODULE_LEASE_HANDLE_SCHEMA) {
      return Object.freeze({ ok: false, reason: 'invalid-lease-handle-schema' });
    }
    if (disposed) {
      return Object.freeze({ ok: false, reason: 'session-disposed' });
    }
    if (handle.sessionId !== resolvedSessionId) {
      return Object.freeze({ ok: false, reason: 'session-mismatch' });
    }
    if (handle.resetEpoch !== resetEpoch) {
      return Object.freeze({ ok: false, reason: 'stale-reset-epoch' });
    }
    const tracked = issuedHandles.get(handle.handleId);
    if (!tracked) {
      return Object.freeze({ ok: false, reason: 'unknown-or-revoked-handle' });
    }
    if (tracked.released) {
      return Object.freeze({ ok: false, reason: 'lease-released' });
    }
    const resource = ledger.resources[handle.resourceKey];
    if (!resource || resource.destroyed) {
      return Object.freeze({ ok: false, reason: 'resource-destroyed' });
    }
    const lease = ledger.leases.find((item) => item.leaseId === handle.leaseId);
    if (!lease || lease.status !== 'active') {
      return Object.freeze({ ok: false, reason: `lease-not-active:${lease?.status || 'missing'}` });
    }
    return Object.freeze({ ok: true, reason: 'valid' });
  }

  function assertValidLeaseHandle(handle) {
    const verdict = validateLeaseHandle(handle);
    if (!verdict.ok) {
      const err = new RangeError(
        `Rejected stale or invalid resident buffer lease (${handle?.handleId || 'unknown'}): ${verdict.reason}`
      );
      err.code = 'ERR_STALE_RESIDENT_BUFFER_LEASE';
      err.reason = verdict.reason;
      throw err;
    }
    return verdict;
  }

  function borrowBufferReadLease({
    resourceKey = 'bodies',
    consumerStage = 'external-consumer',
    reason = 'module-read-lease'
  } = {}) {
    if (disposed) {
      const err = new RangeError(`Cannot borrow lease from disposed session ${resolvedSessionId}`);
      err.code = 'ERR_DISPOSED_RESIDENT_BUFFER_SESSION';
      throw err;
    }
    const found = resolveLiveEntry(resourceKey);
    if (!found) {
      const err = new RangeError(`Resident buffer resource not published: ${resourceKey}`);
      err.code = 'ERR_MISSING_RESIDENT_BUFFER_RESOURCE';
      throw err;
    }
    const { resourceKey: fullKey, entry } = found;
    const handleId = `${resolvedSessionId}:h${resetEpoch}:${nextHandleOrdinal++}`;
    const lease = addResidentBufferLease(ledger, {
      leaseId: `${handleId}:lease`,
      resourceKey: fullKey,
      consumerStage: cleanString(consumerStage, 'external-consumer'),
      reason: cleanString(reason, 'module-read-lease'),
      readOnly: true
    });
    const tracked = {
      handleId,
      leaseId: lease.leaseId,
      resourceKey: fullKey,
      resetEpoch,
      stepIndex: entry.stepIndex,
      released: false
    };
    issuedHandles.set(handleId, tracked);

    const handle = Object.freeze({
      schema: ULG_RESIDENT_MODULE_LEASE_HANDLE_SCHEMA,
      handleId,
      leaseId: lease.leaseId,
      sessionId: resolvedSessionId,
      moduleId: resolvedModuleId,
      resourceKey: fullKey,
      baseKey: entry.baseKey,
      resetEpoch,
      stepIndex: entry.stepIndex,
      layout: entry.layout,
      byteLength: entry.byteLength,
      rowCount: entry.rowCount,
      readOnly: true,
      device: currentDevice,
      buffer: entry.buffer,
      isCurrent: () => validateLeaseHandle(handle).ok,
      release: () => {
        if (tracked.released) return false;
        tracked.released = true;
        issuedHandles.delete(handleId);
        if (tracked.resetEpoch === resetEpoch) {
          releaseResidentBufferLease(ledger, lease.leaseId, { status: 'released' });
          pruneRetiredLedgerEntries(tracked.resourceKey);
        }
        return true;
      }
    });
    return handle;
  }

  async function createPortableCheckpoint({
    resourceKey = 'bodies',
    values = null,
    metadata = {}
  } = {}) {
    if (disposed) {
      throw new RangeError(`Cannot checkpoint disposed session ${resolvedSessionId}`);
    }
    const found = resolveLiveEntry(resourceKey);
    const entry = found?.entry || null;
    const layoutDesc = entry?.layout || defaultLayout;
    let resolvedValues = values;
    if (resolvedValues == null && entry?.portableSnapshotFn) {
      resolvedValues = await entry.portableSnapshotFn();
    }
    const serializedValues = resolvedValues == null
      ? []
      : (ArrayBuffer.isView(resolvedValues) ? Array.from(resolvedValues) : Array.from(resolvedValues));
    const core = {
      schema: ULG_RESIDENT_MODULE_CHECKPOINT_SCHEMA,
      sessionId: resolvedSessionId,
      moduleId: resolvedModuleId,
      baseKey: entry?.baseKey || cleanString(resourceKey, 'bodies'),
      resetEpoch,
      stepIndex: entry?.stepIndex ?? stepIndex,
      layout: layoutDesc,
      rowCount: entry?.rowCount ?? (layoutDesc.strideElements > 0 ? Math.floor(serializedValues.length / layoutDesc.strideElements) : 0),
      values: serializedValues,
      metadata: metadata && typeof metadata === 'object' ? { ...metadata } : {}
    };
    return Object.freeze({
      ...core,
      payloadHash: stableModulePayloadHash({
        moduleId: core.moduleId,
        stepIndex: core.stepIndex,
        layout: core.layout,
        values: core.values
      }),
      createdAt: new Date().toISOString()
    });
  }

  function reset({
    nextStep = 0,
    destroyBuffers = true,
    reason = 'session-reset',
    device: replacementDevice = undefined
  } = {}) {
    const revokedHandleCount = issuedHandles.size;
    for (const tracked of issuedHandles.values()) {
      tracked.released = true;
      if (tracked.resetEpoch === resetEpoch) {
        releaseResidentBufferLease(ledger, tracked.leaseId, { status: 'revoked-on-reset' });
      }
    }
    issuedHandles.clear();

    const destroyedResources = [];
    for (const [fullKey, entry] of liveBuffers.entries()) {
      if (destroyBuffers && entry.destroyFn) {
        const event = destroyResidentBufferWithLease(ledger, fullKey, entry.destroyFn, {
          force: true,
          reason
        });
        destroyedResources.push({ resourceKey: fullKey, status: event.status });
      }
    }
    liveBuffers.clear();

    resetEpoch += 1;
    stepIndex = Math.max(0, Math.floor(finiteNumber(nextStep, 0)));
    if (replacementDevice !== undefined) {
      currentDevice = replacementDevice;
    }
    ledger = createResidentBufferLeaseLedger({
      ledgerId: `${resolvedSessionId}:epoch:${resetEpoch}`,
      stateKey: resolvedModuleId,
      step: stepIndex,
      scope: 'resident-module-buffer-session'
    });

    return Object.freeze({
      sessionId: resolvedSessionId,
      moduleId: resolvedModuleId,
      resetEpoch,
      stepIndex,
      revokedHandleCount,
      destroyedResources: Object.freeze(destroyedResources)
    });
  }

  async function restoreFromCheckpoint(checkpoint, {
    uploadFn = null,
    device: replacementDevice = undefined,
    reason = 'checkpoint-restore'
  } = {}) {
    if (!checkpoint || checkpoint.schema !== ULG_RESIDENT_MODULE_CHECKPOINT_SCHEMA) {
      throw new TypeError('Expected a valid peercompute.ulg.resident-module-checkpoint.v1 payload');
    }
    const expectedHash = stableModulePayloadHash({
      moduleId: checkpoint.moduleId,
      stepIndex: checkpoint.stepIndex,
      layout: checkpoint.layout,
      values: checkpoint.values
    });
    if (checkpoint.payloadHash !== expectedHash) {
      const err = new Error('Checkpoint integrity mismatch: payloadHash does not match checkpoint contents');
      err.code = 'ERR_CORRUPT_RESIDENT_CHECKPOINT';
      throw err;
    }
    const resetReceipt = reset({
      nextStep: checkpoint.stepIndex,
      destroyBuffers: true,
      reason,
      device: replacementDevice
    });
    const uploaded = typeof uploadFn === 'function'
      ? await uploadFn(checkpoint, { device: currentDevice, resetEpoch })
      : null;
    const published = publishBuffer({
      resourceKey: checkpoint.baseKey || 'bodies',
      buffer: uploaded?.buffer ?? null,
      destroyFn: uploaded?.destroyFn ?? null,
      byteLength: uploaded?.byteLength ?? (checkpoint.values.length * Float32Array.BYTES_PER_ELEMENT),
      rowCount: checkpoint.rowCount,
      layout: checkpoint.layout,
      stepIndex: checkpoint.stepIndex,
      portableSnapshotFn: uploaded?.portableSnapshotFn ?? (() => Float32Array.from(checkpoint.values))
    });
    return Object.freeze({
      restored: true,
      resetReceipt,
      published,
      checkpointHash: checkpoint.payloadHash
    });
  }

  function dispose() {
    if (disposed) return;
    reset({ nextStep: 0, destroyBuffers: true, reason: 'session-disposed' });
    disposed = true;
  }

  function summary() {
    return Object.freeze({
      sessionId: resolvedSessionId,
      moduleId: resolvedModuleId,
      resetEpoch,
      stepIndex,
      disposed,
      hasDevice: Boolean(currentDevice),
      liveResourceKeys: Object.freeze([...liveBuffers.keys()]),
      activeHandleCount: [...issuedHandles.values()].filter((h) => !h.released && h.resetEpoch === resetEpoch).length,
      ledger: summarizeResidentBufferLeaseLedger(ledger)
    });
  }

  return Object.freeze({
    sessionId: resolvedSessionId,
    moduleId: resolvedModuleId,
    get resetEpoch() { return resetEpoch; },
    get stepIndex() { return stepIndex; },
    get disposed() { return disposed; },
    publishBuffer,
    borrowBufferReadLease,
    validateLeaseHandle,
    assertValidLeaseHandle,
    createPortableCheckpoint,
    reset,
    restoreFromCheckpoint,
    dispose,
    summary
  });
}
