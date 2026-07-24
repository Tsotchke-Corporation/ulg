export const ULG_RESIDENT_BUFFER_LEASE_LEDGER_SCHEMA = 'peercompute.ulg.resident-buffer-lease-ledger.v0';
export const ULG_RESIDENT_BUFFER_RESOURCE_SCHEMA = 'peercompute.ulg.resident-buffer-resource.v0';
export const ULG_RESIDENT_BUFFER_LEASE_SCHEMA = 'peercompute.ulg.resident-buffer-lease.v0';
export const ULG_RESIDENT_BUFFER_LEASE_SUMMARY_SCHEMA = 'peercompute.ulg.resident-buffer-lease-summary.v0';

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
  for (const resource of Object.values(ledger.resources)) {
    resource.activeLeaseCount = resourceActiveLeases(ledger, resource.resourceKey).length;
  }
  ledger.resourceCount = Object.keys(ledger.resources).length;
  ledger.activeLeaseCount = ledger.leases.filter((lease) => lease.status === 'active').length;
  ledger.destroyedResourceCount = Object.values(ledger.resources).filter((resource) => resource.destroyed).length;
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
