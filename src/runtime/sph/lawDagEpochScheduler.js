// Canonical Law-DAG Epoch Scheduler (`src/runtime/sph/lawDagEpochScheduler.js`).
//
// Enforces ULG's Schroeder Simulation (SS) Law Adapter Contract at runtime:
//   1. Mechanically validates every registered stage schedule against
//      `assertValidLawAdapterSchedule` (exclusive writers, ordered read-before-
//      write handoffs, zero simultaneous write+accumulate, zero legacy private
//      grids when `requireCanonicalSsAuthority: true`).
//   2. Hoists shared SS spatial derived-view queries ONCE per immutable epoch
//      across all stages sharing the same `adapterMode` (cell-local, exact-near,
//      cross-level, aggregate-far, solid-proxy, surface-interface).
//   3. Derives and verifies WebGPU `GPUBindGroupLayoutEntry[]` directly from
//      each stage's Law Adapter descriptor (`assertBindGroupMatchesLawDescriptor`).
//   4. Tracks every epoch/transient GPU buffer through a step-scoped
//      `GpuResourceLeaseScope` and asserts `assertDrained()` at epoch boundary.

import {
  CANONICAL_ULG_LAW_ADAPTERS,
  LAW_SPATIAL_AUTHORITIES,
  assertBindGroupMatchesLawDescriptor,
  assertValidLawAdapterSchedule,
  generateBindGroupLayoutEntriesFromLawDescriptor
} from './lawAdapterContract.js';
import { createGpuResourceLeaseScope } from './gpuResourceLease.js';

export const ULG_LAW_DAG_EPOCH_SCHEDULE_SCHEMA =
  'peercompute.ulg.law-dag-epoch-schedule.v1';

/**
 * Resolve a canonical Law Adapter descriptor by id from `CANONICAL_ULG_LAW_ADAPTERS`.
 */
export function getCanonicalLawAdapterDescriptor(stageId) {
  const id = String(stageId || '').trim();
  const found = CANONICAL_ULG_LAW_ADAPTERS.find((s) => s.id === id) || null;
  if (!found) {
    const err = new RangeError(`Unknown canonical ULG law adapter stage "${id}"`);
    err.code = 'ERR_UNKNOWN_CANONICAL_LAW_ADAPTER';
    throw err;
  }
  return found;
}

/**
 * Create a validated, lease-enforcing Law-DAG Epoch Scheduler for one immutable
 * SS spatial epoch.
 */
export function createLawDagEpochScheduler({
  epochId = 'ss-epoch',
  epochGeneration = 1,
  stages = CANONICAL_ULG_LAW_ADAPTERS,
  requiredStageOrder = null,
  requireCanonicalSsAuthority = true,
  requireExtendedMetadata = true
} = {}) {
  const stageList = Array.isArray(stages) ? [...stages] : [];
  const resolvedOrder = Array.isArray(requiredStageOrder) && requiredStageOrder.length > 0
    ? [...requiredStageOrder]
    : stageList.map((s) => s?.id).filter(Boolean);

  const schedulePlan = Object.freeze({
    requiredStageOrder: Object.freeze(resolvedOrder),
    stages: Object.freeze(stageList)
  });

  const validation = assertValidLawAdapterSchedule(schedulePlan, {
    requireExtendedMetadata
  });

  if (requireCanonicalSsAuthority && validation.debt.length > 0) {
    const err = new Error(
      `Law-DAG epoch "${epochId}" rejected legacy-private-grid debt: ${validation.debt.join(', ')}`
    );
    err.code = 'ERR_LAW_DAG_LEGACY_PRIVATE_GRID';
    err.debt = validation.debt;
    throw err;
  }

  const stageById = new Map(stageList.map((s) => [s.id, s]));
  // Pre-compute shared SS derived-view hoisting groups: multiple laws sharing an
  // adapterMode read one hoisted view built once against the immutable epoch!
  const stagesByAdapterMode = new Map();
  for (const s of stageList) {
    const mode = s.adapterMode || 'cell-local';
    if (!stagesByAdapterMode.has(mode)) stagesByAdapterMode.set(mode, []);
    stagesByAdapterMode.get(mode).push(s.id);
  }

  const leaseScope = createGpuResourceLeaseScope({
    scopeId: `law-dag:${epochId}:g${epochGeneration}`,
    epoch: epochGeneration
  });

  const hoistedViews = new Map();
  const hoistedViewLeases = new Map();
  let hoistedViewBuilds = 0;
  let hoistedViewReuses = 0;
  const validatedStageBindGroups = new Set();

  return Object.freeze({
    schema: ULG_LAW_DAG_EPOCH_SCHEDULE_SCHEMA,
    epochId: String(epochId),
    epochGeneration,
    validation,
    leaseScope,
    stageIds: Object.freeze(stageList.map((s) => s.id)),
    hoistingPlan: Object.freeze(
      Object.fromEntries(
        [...stagesByAdapterMode.entries()].map(([mode, ids]) => [mode, Object.freeze([...ids])])
      )
    ),

    getStageDescriptor(stageId) {
      const desc = stageById.get(stageId);
      if (!desc) {
        const err = new RangeError(`Stage "${stageId}" is not registered in Law-DAG epoch "${epochId}"`);
        err.code = 'ERR_LAW_DAG_UNKNOWN_STAGE';
        throw err;
      }
      return desc;
    },

    deriveBindGroupLayoutEntries(stageId, resourceBindingTable, options = {}) {
      const desc = this.getStageDescriptor(stageId);
      return generateBindGroupLayoutEntriesFromLawDescriptor(desc, resourceBindingTable, options);
    },

    assertStageBindGroup(stageId, resourceBindingTable, boundEntries, options = {}) {
      const desc = this.getStageDescriptor(stageId);
      const entries = assertBindGroupMatchesLawDescriptor(desc, resourceBindingTable, boundEntries, options);
      validatedStageBindGroups.add(stageId);
      return entries;
    },

    /**
     * Acquire an immutable SS derived view for `adapterMode`, building it ONCE
     * per epoch and reusing it across all subsequent laws sharing that view.
     */
    acquireHoistedSpatialView(adapterMode, buildViewFn, { onRelease = null } = {}) {
      const mode = String(adapterMode || 'cell-local');
      if (hoistedViews.has(mode)) {
        hoistedViewReuses += 1;
        return hoistedViews.get(mode);
      }
      if (typeof buildViewFn !== 'function') {
        throw new TypeError(`acquireHoistedSpatialView("${mode}") requires a buildViewFn`);
      }
      const view = buildViewFn();
      hoistedViews.set(mode, view);
      hoistedViewBuilds += 1;
      const lease = leaseScope.issue(view, {
        label: `ss-hoisted-view:${mode}`,
        producer: 'ss-spatial-epoch',
        expectedConsumers: stagesByAdapterMode.get(mode) || [],
        onRelease
      });
      hoistedViewLeases.set(mode, lease);
      return view;
    },

    issueStageLease(resource, options) {
      return leaseScope.issue(resource, options);
    },

    releaseHoistedViews() {
      for (const [mode, lease] of hoistedViewLeases.entries()) {
        leaseScope.release(lease, { by: 'law-dag-epoch-end', allowAlreadyReleased: true });
        hoistedViewLeases.delete(mode);
      }
      hoistedViews.clear();
    },

    /**
     * Execute registered stage callbacks in validated topological order,
     * release hoisted SS views, and enforce zero leaked GPU resource leases!
     */
    async executeEpoch(stageExecutors = {}, {
      viewBuilders = {},
      requireAllReleased = false
    } = {}) {
      const executedStages = [];
      try {
        for (const stage of stageList) {
          const exec = stageExecutors[stage.id];
          if (typeof exec !== 'function') continue;
          const mode = stage.adapterMode || 'cell-local';
          let sharedView = null;
          if (typeof viewBuilders[mode] === 'function') {
            sharedView = this.acquireHoistedSpatialView(mode, viewBuilders[mode]);
          }
          const result = await exec({
            descriptor: stage,
            sharedView,
            leaseScope,
            scheduler: this
          });
          executedStages.push(Object.freeze({
            id: stage.id,
            adapterMode: mode,
            spatialAuthority: stage.spatialAuthority || LAW_SPATIAL_AUTHORITIES.CANONICAL_SS_EPOCH,
            status: result?.status ?? 'executed'
          }));
        }
      } finally {
        this.releaseHoistedViews();
      }
      const leaseSnapshot = leaseScope.assertDrained({ requireAllReleased });
      return Object.freeze({
        schema: ULG_LAW_DAG_EPOCH_SCHEDULE_SCHEMA,
        epochId: String(epochId),
        epochGeneration,
        executedStages: Object.freeze(executedStages),
        validatedStageBindGroups: Object.freeze([...validatedStageBindGroups]),
        hoistedViewBuilds,
        hoistedViewReuses,
        zeroWriteConflicts: validation.valid,
        zeroLegacyPrivateGrids: validation.debt.length === 0,
        leaseSnapshot
      });
    },

    snapshot() {
      return Object.freeze({
        schema: ULG_LAW_DAG_EPOCH_SCHEDULE_SCHEMA,
        epochId: String(epochId),
        epochGeneration,
        stageCount: stageList.length,
        hoistedViewBuilds,
        hoistedViewReuses,
        validatedStageBindGroups: Object.freeze([...validatedStageBindGroups]),
        leaseSnapshot: leaseScope.snapshot()
      });
    }
  });
}
