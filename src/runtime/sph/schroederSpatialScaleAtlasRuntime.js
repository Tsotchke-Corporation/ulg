import {
  SCHROEDER_DYADIC_SCALE_GLOBAL_MAX_LEVEL,
  SCHROEDER_DYADIC_SCALE_GLOBAL_MIN_LEVEL,
  SCHROEDER_SCALE_CHART_NO_PARENT,
  SCHROEDER_SPATIAL_MAX_CONTIGUOUS_CHAIN_LEVELS,
  ULG_SCHROEDER_SPATIAL_SCALE_ATLAS_SCHEMA,
  combineDoubleFloatToFloat64,
  createSchroederScaleAtlasPlan,
  createSchroederScaleChartDescriptor,
  dyadicLevelSpanOrdersOfMagnitude,
  dyadicScaleSpacingM,
  packSchroederScaleAtlasChartTable,
  rebasePositionChildToParent,
  rebasePositionParentToChild,
  schroederScaleAtlasChartRebaseWgsl,
  splitFloat64ToDoubleFloat
} from '../../../ulg-gpu-abi/src/index.js';
import {
  computeBufferBinding,
  createCachedExplicitBindGroup,
  createCachedExplicitComputePipeline
} from '../webgpuComputeLayout.js';

export const ULG_SCHROEDER_DYNAMIC_SCALE_ATLAS_RUNTIME_SCHEMA =
  'peercompute.ulg.schroeder-dynamic-scale-atlas-runtime.v1';
export const ULG_SCHROEDER_DYNAMIC_HIERARCHY_LOD_CONTROLLER_SCHEMA =
  'peercompute.ulg.schroeder-dynamic-hierarchy-lod-controller.v1';
export const SCHROEDER_ATLAS_MIGRATION_RECEIPT_MAGIC = 0x5341_4d47; // 'SAMG'
export const SCHROEDER_ATLAS_MIGRATION_RECEIPT_WORDS = 16;
export const SCHROEDER_ATLAS_MIGRATION_RECEIPT_BYTES =
  SCHROEDER_ATLAS_MIGRATION_RECEIPT_WORDS * Uint32Array.BYTES_PER_ELEMENT;
export const SCHROEDER_ATLAS_PARTICLE_STRIDE_WORDS = 16;
export const SCHROEDER_ATLAS_PARTICLE_STRIDE_BYTES =
  SCHROEDER_ATLAS_PARTICLE_STRIDE_WORDS * Uint32Array.BYTES_PER_ELEMENT;

const USAGE_STORAGE = 0x0080;
const USAGE_UNIFORM = 0x0040;
const USAGE_COPY_DST = 0x0008;
const USAGE_COPY_SRC = 0x0004;
const USAGE_MAP_READ = 0x0001;

function cross3(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function add3(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function sub3(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function clampInt(value, lo, hi) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function positiveFinite(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Dynamic 40-OOM Multi-Chart Atlas Runtime:
 *
 * Manages sparse runtime creation, particle migration across arbitrary dyadic
 * levels L in [-64, +96] (> 48 OOM) with double-float origin rebasing and exact
 * mass / linear-momentum / angular-momentum / energy conservation, and
 * hysteresis-guarded retirement of empty sparse charts.
 */
export function createDynamicSchroederScaleAtlasRuntime({
  referenceSpacingM = 1.0,
  rootGlobalBaseLevel = 0,
  rootLocalMinLevel = 0,
  rootLocalMaxLevel = 2,
  rootLabel = 'root-chart',
  maxActiveCharts = 64,
  minIdleEpochsBeforeRetire = 4
} = {}) {
  const refSpacing = positiveFinite(referenceSpacingM, 1.0);
  const maxCharts = clampInt(maxActiveCharts, 1, 1024);
  const idleRetireThreshold = clampInt(minIdleEpochsBeforeRetire, 1, 1024);

  let nextChartId = 1;
  let epoch = 0;

  const rootChart = createSchroederScaleChartDescriptor({
    chartId: 0,
    globalBaseLevel: rootGlobalBaseLevel,
    localMinLevel: rootLocalMinLevel,
    localMaxLevel: rootLocalMaxLevel,
    referenceSpacingM: refSpacing,
    localBaseSpacingM: 1.0,
    originInParentUnits: [0, 0, 0],
    parentChartId: null,
    label: rootLabel
  });

  // Map<chartId, { chart, occupancy, idleEpochs, createdEpoch, lastActiveEpoch, boundaryFlux }>
  const entries = new Map();
  entries.set(0, {
    chart: rootChart,
    occupancy: 0,
    idleEpochs: 0,
    createdEpoch: 0,
    lastActiveEpoch: 0,
    boundaryFlux: null
  });

  /**
   * Publish a physical boundary flux payload (stellar wind/CME/flare, Dyson
   * transmission, orbital tidal heating Q_tidal, etc.) onto a chart so child
   * charts in the Schroeder Scale Atlas inherit live parent forcing.
   */
  function publishChartBoundaryFlux(chartId, flux = {}) {
    const entry = entries.get(chartId);
    if (!entry) throw new RangeError(`Unknown chartId ${chartId}`);
    const prev = entry.boundaryFlux || {};
    const merged = Object.freeze({
      ...prev,
      ...flux,
      chartId,
      epoch
    });
    entry.boundaryFlux = merged;
    entry.lastActiveEpoch = epoch;
    return merged;
  }

  /**
   * Resolve inherited parent->child boundary flux along the ancestry chain
   * `[root, ..., parent, chart]` (child overrides only fields it explicitly sets;
   * multiplicative transmittances like `dysonTransmittedFluxFrac` compose across scales).
   */
  function resolveInheritedBoundaryFlux(chartId) {
    const chain = findAncestryChain(chartId).reverse(); // root -> ... -> chart
    const resolved = {
      schema: 'peercompute.ulg.schroeder-scale-boundary-flux.v1',
      chartId,
      epoch,
      stellarWindPressureNPa: 2.0,
      cmeShockBoost: 0.0,
      flareXuvFluxMul: 1.0,
      dysonCoveringFrac: 0.0,
      dysonTransmittedFluxFrac: 1.0,
      dysonWasteTempK: 0.0,
      tidalHeatingW: 0.0,
      tidalHeatFluxWPerM2: 0.0,
      hostLuminositySolar: 1.0,
      contributingCharts: []
    };
    for (const c of chain) {
      const bf = entries.get(c.chartId)?.boundaryFlux;
      if (!bf) continue;
      resolved.contributingCharts.push(c.chartId);
      if (Number.isFinite(Number(bf.stellarWindPressureNPa))) {
        resolved.stellarWindPressureNPa = Math.max(0, Number(bf.stellarWindPressureNPa));
      }
      if (Number.isFinite(Number(bf.cmeShockBoost))) {
        resolved.cmeShockBoost = Math.max(resolved.cmeShockBoost, Number(bf.cmeShockBoost));
      }
      if (Number.isFinite(Number(bf.flareXuvFluxMul))) {
        resolved.flareXuvFluxMul = Math.max(0.01, resolved.flareXuvFluxMul * Number(bf.flareXuvFluxMul));
      }
      if (Number.isFinite(Number(bf.dysonCoveringFrac))) {
        resolved.dysonCoveringFrac = Math.max(0, Math.min(0.992, Number(bf.dysonCoveringFrac)));
      }
      if (Number.isFinite(Number(bf.dysonTransmittedFluxFrac))) {
        resolved.dysonTransmittedFluxFrac = Math.max(0.008, Math.min(1.0, resolved.dysonTransmittedFluxFrac * Number(bf.dysonTransmittedFluxFrac)));
      }
      if (Number.isFinite(Number(bf.dysonWasteTempK)) && Number(bf.dysonWasteTempK) > 0) {
        resolved.dysonWasteTempK = Number(bf.dysonWasteTempK);
      }
      if (Number.isFinite(Number(bf.tidalHeatingW))) {
        resolved.tidalHeatingW = Math.max(0, Number(bf.tidalHeatingW));
      }
      if (Number.isFinite(Number(bf.tidalHeatFluxWPerM2))) {
        resolved.tidalHeatFluxWPerM2 = Math.max(0, Number(bf.tidalHeatFluxWPerM2));
      }
      if (Number.isFinite(Number(bf.hostLuminositySolar)) && Number(bf.hostLuminositySolar) > 0) {
        resolved.hostLuminositySolar = Number(bf.hostLuminositySolar);
      }
    }
    resolved.contributingCharts = Object.freeze(resolved.contributingCharts);
    return Object.freeze(resolved);
  }

  function snapshotAtlas() {
    const charts = [...entries.values()]
      .sort((a, b) => a.chart.chartId - b.chart.chartId)
      .map((entry) => entry.chart);
    return createSchroederScaleAtlasPlan({
      referenceSpacingM: refSpacing,
      charts
    });
  }

  function findAncestryChain(chartId) {
    const chain = [];
    const seen = new Set();
    let cur = chartId;
    while (cur != null) {
      if (seen.has(cur)) throw new Error(`Cycle detected in scale atlas at chart ${cur}`);
      seen.add(cur);
      const entry = entries.get(cur);
      if (!entry) throw new RangeError(`Unknown chartId ${cur}`);
      chain.push(entry.chart);
      cur = entry.chart.parentChartId;
    }
    return chain; // [chart, parent, ..., root]
  }

  function selectBestParentForLevel(targetGlobalLevel) {
    // Prefer an existing chart whose globalBaseLevel is >= targetGlobalLevel
    // and closest to targetGlobalLevel; otherwise choose the coarsest chart
    // (highest globalBaseLevel) or root (0).
    let best = entries.get(0).chart;
    let bestScore = Infinity;
    for (const { chart } of entries.values()) {
      const diff = chart.globalBaseLevel - targetGlobalLevel;
      const score = diff >= 0 ? diff : 1000 - diff;
      if (score < bestScore) {
        bestScore = score;
        best = chart;
      }
    }
    return best;
  }

  /**
   * Find an active chart covering `targetGlobalLevel` (within its local level
   * span) or dynamically spawn a new sparse chart anchored at that level with
   * exact double-float origin rebasing into its parent chart.
   */
  function ensureChartForScaleLevel({
    targetGlobalLevel,
    originInParentUnits = null,
    parentChartId = null,
    localSpanLevels = 3,
    forceNew = false,
    label = null
  } = {}) {
    const level = clampInt(
      targetGlobalLevel,
      SCHROEDER_DYADIC_SCALE_GLOBAL_MIN_LEVEL,
      SCHROEDER_DYADIC_SCALE_GLOBAL_MAX_LEVEL
    );
    const originMatches = (chart) => {
      if (originInParentUnits == null) return true;
      for (let a = 0; a < 3; a += 1) {
        const existing = combineDoubleFloatToFloat64(chart.originHi[a], chart.originLo[a]);
        if (Math.abs(existing - Number(originInParentUnits[a] ?? 0)) > 1e-6) return false;
      }
      return true;
    };
    if (!forceNew) {
      for (const entry of entries.values()) {
        const c = entry.chart;
        if (
          level >= c.globalMinLevel
          && level <= c.globalMaxLevel
          && (parentChartId == null || c.parentChartId === parentChartId || c.chartId === parentChartId)
          && originMatches(c)
        ) {
          entry.idleEpochs = 0;
          entry.lastActiveEpoch = epoch;
          return Object.freeze({ chart: c, created: false, chartId: c.chartId });
        }
      }
    }
    const resolvedOrigin = originInParentUnits ?? [0, 0, 0];
    if (entries.size >= maxCharts) {
      throw new RangeError(`Dynamic scale atlas reached maxActiveCharts=${maxCharts}`);
    }
    const parent = parentChartId != null
      ? (entries.get(parentChartId)?.chart ?? null)
      : selectBestParentForLevel(level);
    if (!parent) {
      throw new RangeError(`Parent chart ${parentChartId} not found in dynamic scale atlas`);
    }
    const span = clampInt(localSpanLevels, 1, SCHROEDER_SPATIAL_MAX_CONTIGUOUS_CHAIN_LEVELS);
    const localMax = Math.min(
      span - 1,
      SCHROEDER_DYADIC_SCALE_GLOBAL_MAX_LEVEL - level
    );
    const chartId = nextChartId++;
    const chart = createSchroederScaleChartDescriptor({
      chartId,
      globalBaseLevel: level,
      localMinLevel: 0,
      localMaxLevel: Math.max(0, localMax),
      referenceSpacingM: refSpacing,
      localBaseSpacingM: 1.0,
      originInParentUnits: resolvedOrigin,
      parentChartId: parent.chartId,
      label: label ?? `dynamic-chart-L${level}-id${chartId}`
    });
    entries.set(chartId, {
      chart,
      occupancy: 0,
      idleEpochs: 0,
      createdEpoch: epoch,
      lastActiveEpoch: epoch
    });
    return Object.freeze({ chart, created: true, chartId });
  }

  /**
   * Rebase one particle from `sourceChartId` to `targetChartId` across an
   * arbitrary multi-hop chart tree (up to 48+ OOM) while conserving mass,
   * linear momentum, total energy, and angular momentum (exact parallel-axis
   * shift at every chart hop).
   */
  function migrateParticleBetweenCharts({
    sourceChartId,
    targetChartId,
    posLocal = [0, 0, 0],
    posLocalLo = [0, 0, 0],
    massKg = 1.0,
    linearMomentumKgMPerS = [0, 0, 0],
    angularMomentumKgM2PerS = [0, 0, 0],
    energyJ = 0.0
  } = {}) {
    const srcEntry = entries.get(sourceChartId);
    const dstEntry = entries.get(targetChartId);
    if (!srcEntry || !dstEntry) {
      throw new RangeError(`Migration requires live source (${sourceChartId}) and target (${targetChartId}) charts`);
    }
    if (sourceChartId === targetChartId) {
      return Object.freeze({
        sourceChartId,
        targetChartId,
        hops: 0,
        posLocalHi: [...posLocal],
        posLocalLo: [...posLocalLo],
        massKg,
        linearMomentumKgMPerS: [...linearMomentumKgMPerS],
        angularMomentumKgM2PerS: [...angularMomentumKgM2PerS],
        energyJ
      });
    }

    const srcChain = findAncestryChain(sourceChartId);
    const dstChain = findAncestryChain(targetChartId);
    const dstSet = new Set(dstChain.map((c) => c.chartId));
    const lcaChart = srcChain.find((c) => dstSet.has(c.chartId));
    if (!lcaChart) {
      throw new Error(`No common ancestor between charts ${sourceChartId} and ${targetChartId}`);
    }

    // Lift source -> LCA with exact double-float rebasing and parallel-axis angular momentum shift.
    let posF64 = [
      combineDoubleFloatToFloat64(posLocal[0], posLocalLo[0]),
      combineDoubleFloatToFloat64(posLocal[1], posLocalLo[1]),
      combineDoubleFloatToFloat64(posLocal[2], posLocalLo[2])
    ];
    let angMom = [
      Number(angularMomentumKgM2PerS[0]),
      Number(angularMomentumKgM2PerS[1]),
      Number(angularMomentumKgM2PerS[2])
    ];
    const linMom = [
      Number(linearMomentumKgMPerS[0]),
      Number(linearMomentumKgMPerS[1]),
      Number(linearMomentumKgMPerS[2])
    ];
    let hops = 0;

    for (const c of srcChain) {
      if (c.chartId === lcaChart.chartId) break;
      const parent = entries.get(c.parentChartId).chart;
      posF64 = [...rebasePositionChildToParent(posF64, c, parent)];
      const originM = [
        combineDoubleFloatToFloat64(c.originHi[0], c.originLo[0]) * dyadicScaleSpacingM(parent.globalBaseLevel, refSpacing),
        combineDoubleFloatToFloat64(c.originHi[1], c.originLo[1]) * dyadicScaleSpacingM(parent.globalBaseLevel, refSpacing),
        combineDoubleFloatToFloat64(c.originHi[2], c.originLo[2]) * dyadicScaleSpacingM(parent.globalBaseLevel, refSpacing)
      ];
      angMom = add3(angMom, cross3(originM, linMom));
      hops += 1;
    }

    // Descend LCA -> target with exact inverse double-float rebasing and inverse parallel-axis shift.
    const descent = [];
    for (const c of dstChain) {
      if (c.chartId === lcaChart.chartId) break;
      descent.push(c);
    }
    descent.reverse();
    for (const c of descent) {
      const parent = entries.get(c.parentChartId).chart;
      posF64 = [...rebasePositionParentToChild(posF64, parent, c)];
      const originM = [
        combineDoubleFloatToFloat64(c.originHi[0], c.originLo[0]) * dyadicScaleSpacingM(parent.globalBaseLevel, refSpacing),
        combineDoubleFloatToFloat64(c.originHi[1], c.originLo[1]) * dyadicScaleSpacingM(parent.globalBaseLevel, refSpacing),
        combineDoubleFloatToFloat64(c.originHi[2], c.originLo[2]) * dyadicScaleSpacingM(parent.globalBaseLevel, refSpacing)
      ];
      angMom = sub3(angMom, cross3(originM, linMom));
      hops += 1;
    }

    const splitX = splitFloat64ToDoubleFloat(posF64[0]);
    const splitY = splitFloat64ToDoubleFloat(posF64[1]);
    const splitZ = splitFloat64ToDoubleFloat(posF64[2]);

    srcEntry.occupancy = Math.max(0, srcEntry.occupancy - 1);
    dstEntry.occupancy += 1;
    dstEntry.idleEpochs = 0;
    dstEntry.lastActiveEpoch = epoch;

    return Object.freeze({
      sourceChartId,
      targetChartId,
      lcaChartId: lcaChart.chartId,
      hops,
      posLocalHi: Object.freeze([splitX[0], splitY[0], splitZ[0]]),
      posLocalLo: Object.freeze([splitX[1], splitY[1], splitZ[1]]),
      posLocalF64: Object.freeze(posF64),
      massKg,
      linearMomentumKgMPerS: Object.freeze(linMom),
      angularMomentumKgM2PerS: Object.freeze(angMom),
      energyJ
    });
  }

  function setChartOccupancy(chartId, count) {
    const entry = entries.get(chartId);
    if (!entry) throw new RangeError(`Unknown chartId ${chartId}`);
    entry.occupancy = Math.max(0, Math.floor(Number(count) || 0));
    if (entry.occupancy > 0) {
      entry.idleEpochs = 0;
      entry.lastActiveEpoch = epoch;
    }
  }

  /**
   * Advance one schedule epoch and retire sparse leaf charts that have remained
   * empty for at least `minIdleEpochsBeforeRetire` epochs.
   */
  function advanceEpochAndRetireEmptyCharts({ keepRoot = true } = {}) {
    epoch += 1;
    const retiredChartIds = [];
    // Compute live parent references so we never retire a chart that still has live children.
    const parentRefCount = new Map();
    for (const { chart } of entries.values()) {
      if (chart.parentChartId != null) {
        parentRefCount.set(chart.parentChartId, (parentRefCount.get(chart.parentChartId) || 0) + 1);
      }
    }
    for (const [chartId, entry] of [...entries.entries()]) {
      if (entry.occupancy > 0) {
        entry.idleEpochs = 0;
        continue;
      }
      entry.idleEpochs += 1;
      if (keepRoot && chartId === 0) continue;
      if ((parentRefCount.get(chartId) || 0) > 0) continue;
      if (entry.idleEpochs >= idleRetireThreshold) {
        entries.delete(chartId);
        retiredChartIds.push(chartId);
      }
    }
    return Object.freeze({
      epoch,
      retiredChartIds: Object.freeze(retiredChartIds),
      activeChartCount: entries.size
    });
  }

  function summary() {
    const atlas = snapshotAtlas();
    return Object.freeze({
      schema: ULG_SCHROEDER_DYNAMIC_SCALE_ATLAS_RUNTIME_SCHEMA,
      atlasSchema: ULG_SCHROEDER_SPATIAL_SCALE_ATLAS_SCHEMA,
      epoch,
      activeChartCount: entries.size,
      globalMinLevel: atlas.minGlobalLevel,
      globalMaxLevel: atlas.maxGlobalLevel,
      dyadicSpanLevels: atlas.dyadicSpanLevels,
      ordersOfMagnitude: dyadicLevelSpanOrdersOfMagnitude(atlas.minGlobalLevel, atlas.maxGlobalLevel),
      occupancies: Object.freeze(
        Object.fromEntries([...entries.entries()].map(([id, e]) => [id, e.occupancy]))
      )
    });
  }

  return Object.freeze({
    schema: ULG_SCHROEDER_DYNAMIC_SCALE_ATLAS_RUNTIME_SCHEMA,
    ensureChartForScaleLevel,
    migrateParticleBetweenCharts,
    setChartOccupancy,
    publishChartBoundaryFlux,
    resolveInheritedBoundaryFlux,
    advanceEpochAndRetireEmptyCharts,
    snapshotAtlas,
    summary
  });
}

/**
 * Dynamic Hierarchy LOD & Hardware-Budgeted Coarsen/Refine Controller:
 *
 * Implements plan/todo/SS/dynamic-hierarchy-lod.md: evaluates compact GPU
 * physical-demand receipts and live hardware step wall-time vs target Sync Hz
 * budget at committed schedule boundaries, with hysteresis bands so active
 * level counts never thrash frame-to-frame.
 */
export function createDynamicHierarchyLodController({
  initialActiveLevelCount = 3,
  minActiveLevelCount = 1,
  maxActiveLevelCount = SCHROEDER_SPATIAL_MAX_CONTIGUOUS_CHAIN_LEVELS,
  targetSyncHz = 12,
  stepsPerSchedule = 4,
  refineHeadroomRatio = 0.65,
  coarsenOverloadRatio = 1.25,
  refineHoldSchedules = 3,
  coarsenHoldSchedules = 4,
  volumeRatioRefineThreshold = 6.0,
  thermalGradientRefineThresholdKPerM = 500.0,
  minStorageBuffersPerStage = 12,
  estimatedBytesPerLevel = 4 * 1024 * 1024
} = {}) {
  const minLevels = clampInt(minActiveLevelCount, 1, SCHROEDER_SPATIAL_MAX_CONTIGUOUS_CHAIN_LEVELS);
  const maxLevels = clampInt(maxActiveLevelCount, minLevels, SCHROEDER_SPATIAL_MAX_CONTIGUOUS_CHAIN_LEVELS);
  let activeLevelCount = clampInt(initialActiveLevelCount, minLevels, maxLevels);
  let refineStreak = 0;
  let coarsenStreak = 0;
  let transitionCount = 0;
  let lastAction = 'hold';
  let lastReason = 'initial';

  function hardwareMaxLevelCap(deviceLimits = null) {
    if (!deviceLimits || typeof deviceLimits !== 'object') return maxLevels;
    const maxStorage = Number(deviceLimits.maxStorageBuffersPerShaderStage);
    if (Number.isFinite(maxStorage) && maxStorage > 0 && maxStorage < minStorageBuffersPerStage) {
      return minLevels;
    }
    const maxBuf = Number(deviceLimits.maxBufferSize);
    if (Number.isFinite(maxBuf) && maxBuf > 0) {
      const memCap = Math.max(minLevels, Math.floor((maxBuf * 0.25) / Math.max(65536, estimatedBytesPerLevel)));
      return Math.min(maxLevels, memCap);
    }
    return maxLevels;
  }

  /**
   * Evaluate one committed schedule boundary.
   */
  function evaluateScheduleBoundary({
    scheduleWallMs,
    maxVolumeRatio = 1.0,
    maxThermalGradientKPerM = 0.0,
    activeInterfaceCount = 0,
    deviceLimits = null
  } = {}) {
    const budgetMs = 1000 / Math.max(1, positiveFinite(targetSyncHz, 12));
    const wallMs = positiveFinite(scheduleWallMs, budgetMs);
    const utilization = wallMs / budgetMs;
    const hwCap = hardwareMaxLevelCap(deviceLimits);
    const effectiveMax = Math.max(minLevels, Math.min(maxLevels, hwCap));

    const physicalDemandHigh = (
      Number(maxVolumeRatio) >= volumeRatioRefineThreshold
      || Number(maxThermalGradientKPerM) >= thermalGradientRefineThresholdKPerM
      || Number(activeInterfaceCount) > 0
    );

    let action = 'hold';
    let reason = 'within-hysteresis-band';

    // Immediate hardware safety clamp if device cap dropped below current active levels.
    if (activeLevelCount > effectiveMax) {
      activeLevelCount = effectiveMax;
      refineStreak = 0;
      coarsenStreak = 0;
      transitionCount += 1;
      action = 'coarsen';
      reason = 'hardware-memory-cap';
    } else if (utilization >= coarsenOverloadRatio && activeLevelCount > minLevels) {
      coarsenStreak += 1;
      refineStreak = 0;
      if (coarsenStreak >= coarsenHoldSchedules) {
        activeLevelCount -= 1;
        coarsenStreak = 0;
        transitionCount += 1;
        action = 'coarsen';
        reason = 'hardware-step-budget-overload';
      } else {
        reason = `coarsen-hysteresis-${coarsenStreak}-of-${coarsenHoldSchedules}`;
      }
    } else if (
      physicalDemandHigh
      && utilization <= refineHeadroomRatio
      && activeLevelCount < effectiveMax
    ) {
      refineStreak += 1;
      coarsenStreak = 0;
      if (refineStreak >= refineHoldSchedules) {
        activeLevelCount += 1;
        refineStreak = 0;
        transitionCount += 1;
        action = 'refine';
        reason = 'physical-demand-with-hardware-headroom';
      } else {
        reason = `refine-hysteresis-${refineStreak}-of-${refineHoldSchedules}`;
      }
    } else {
      refineStreak = 0;
      coarsenStreak = 0;
    }

    lastAction = action;
    lastReason = reason;
    return Object.freeze({
      schema: ULG_SCHROEDER_DYNAMIC_HIERARCHY_LOD_CONTROLLER_SCHEMA,
      action,
      reason,
      activeLevelCount,
      minLevel: 0,
      maxLevel: activeLevelCount - 1,
      effectiveMaxLevelCount: effectiveMax,
      scheduleBudgetMs: budgetMs,
      scheduleWallMs: wallMs,
      stepsPerSchedule,
      hardwareBudgetUtilization: utilization,
      physicalDemandHigh,
      refineStreak,
      coarsenStreak,
      transitionCount
    });
  }

  function snapshot() {
    return Object.freeze({
      schema: ULG_SCHROEDER_DYNAMIC_HIERARCHY_LOD_CONTROLLER_SCHEMA,
      activeLevelCount,
      minLevels,
      maxLevels,
      lastAction,
      lastReason,
      transitionCount
    });
  }

  return Object.freeze({
    schema: ULG_SCHROEDER_DYNAMIC_HIERARCHY_LOD_CONTROLLER_SCHEMA,
    evaluateScheduleBoundary,
    snapshot
  });
}

// ---------------------------------------------------------------------------
// GPU-Resident Multi-Chart Particle Migration Kernel (40+ OOM double-float)
// ---------------------------------------------------------------------------

export const schroederScaleAtlasMigrationWgsl = /* wgsl */ `
${schroederScaleAtlasChartRebaseWgsl}

struct AtlasMigrationParticle {
  chart_id: u32,
  target_chart_id: u32,
  mass_kg: f32,
  energy_j: f32,
  pos_hi: vec3<f32>,
  pad0: f32,
  pos_lo: vec3<f32>,
  pad1: f32,
  lin_mom: vec3<f32>,
  pad2: f32,
  ang_mom: vec3<f32>,
  pad3: f32,
};

struct AtlasMigrationParams {
  particle_count: u32,
  chart_count: u32,
  reference_spacing_m: f32,
  pad0: u32,
};

@group(0) @binding(0) var<storage, read> charts: array<SchroederScaleChartRecord>;
@group(0) @binding(1) var<storage, read> src_particles: array<AtlasMigrationParticle>;
@group(0) @binding(2) var<storage, read_write> dst_particles: array<AtlasMigrationParticle>;
@group(0) @binding(3) var<storage, read_write> receipt: array<atomic<u32>>;
@group(0) @binding(4) var<uniform> params: AtlasMigrationParams;

const NO_PARENT: u32 = ${SCHROEDER_SCALE_CHART_NO_PARENT}u;
const RECEIPT_MAGIC: u32 = ${SCHROEDER_ATLAS_MIGRATION_RECEIPT_MAGIC}u;
const MAX_HOPS: u32 = 32u;

fn mig_finite(v: f32) -> bool {
  return (bitcast<u32>(v) & 0x7f800000u) != 0x7f800000u;
}

fn mig_finite3(v: vec3<f32>) -> bool {
  return mig_finite(v.x) && mig_finite(v.y) && mig_finite(v.z);
}

fn mig_find_chart(chart_id: u32) -> u32 {
  if (chart_id < params.chart_count && charts[chart_id].chart_id == chart_id) {
    return chart_id;
  }
  for (var i = 0u; i < params.chart_count; i = i + 1u) {
    if (charts[i].chart_id == chart_id) {
      return i;
    }
  }
  return NO_PARENT;
}

@compute @workgroup_size(1)
fn init_migration_receipt() {
  for (var i = 0u; i < 16u; i = i + 1u) {
    atomicStore(&receipt[i], 0u);
  }
  atomicStore(&receipt[0], RECEIPT_MAGIC);
  atomicStore(&receipt[1], 1u);
}

@compute @workgroup_size(64)
fn migrate_particles_across_charts(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= params.particle_count) { return; }
  let p = src_particles[idx];
  var out = p;

  if (p.chart_id == p.target_chart_id) {
    dst_particles[idx] = out;
    atomicAdd(&receipt[3], 1u);
    return;
  }

  let src_idx = mig_find_chart(p.chart_id);
  let dst_idx = mig_find_chart(p.target_chart_id);
  if (src_idx == NO_PARENT || dst_idx == NO_PARENT) {
    atomicOr(&receipt[2], 1u);
    dst_particles[idx] = out;
    return;
  }

  // Lift from source chart to root chart (exact double-float + parallel-axis).
  var pos_hi = p.pos_hi;
  var pos_lo = p.pos_lo;
  var ang = p.ang_mom;
  let mom = p.lin_mom;
  var cur = src_idx;
  var hops = 0u;
  for (var step = 0u; step < MAX_HOPS; step = step + 1u) {
    let c = charts[cur];
    if (c.parent_chart_id == NO_PARENT || (c.flags & 1u) == 0u) { break; }
    let parent_idx = mig_find_chart(c.parent_chart_id);
    if (parent_idx == NO_PARENT) {
      atomicOr(&receipt[2], 2u);
      return;
    }
    let parent = charts[parent_idx];
    let rebased = ss_atlas_rebase_child_to_parent(pos_hi + pos_lo, c);
    pos_hi = rebased[0];
    pos_lo = rebased[1];
    let origin_m = ss_atlas_dyadic_scale_vec3(c.origin_hi, parent.global_base_level) * params.reference_spacing_m;
    ang = ang + cross(origin_m, mom);
    cur = parent_idx;
    hops = hops + 1u;
  }

  // Record descent path from root to target chart.
  var path: array<u32, 32>;
  var depth = 0u;
  var walk = dst_idx;
  for (var step = 0u; step < MAX_HOPS; step = step + 1u) {
    let c = charts[walk];
    if (c.parent_chart_id == NO_PARENT || (c.flags & 1u) == 0u) { break; }
    path[depth] = walk;
    depth = depth + 1u;
    let parent_idx = mig_find_chart(c.parent_chart_id);
    if (parent_idx == NO_PARENT) {
      atomicOr(&receipt[2], 4u);
      return;
    }
    walk = parent_idx;
  }

  // Descend root -> target chart with exact inverse rebasing + inverse parallel-axis shift.
  for (var k = 0u; k < depth; k = k + 1u) {
    let child_idx = path[depth - 1u - k];
    let c = charts[child_idx];
    let parent_idx = mig_find_chart(c.parent_chart_id);
    let parent = charts[parent_idx];
    let child_pos = ss_atlas_rebase_parent_to_child(pos_hi, pos_lo, c);
    pos_hi = child_pos;
    pos_lo = vec3<f32>(0.0);
    let origin_m = ss_atlas_dyadic_scale_vec3(c.origin_hi, parent.global_base_level) * params.reference_spacing_m;
    ang = ang - cross(origin_m, mom);
    hops = hops + 1u;
  }

  if (!mig_finite3(pos_hi) || !mig_finite3(ang) || !mig_finite(p.mass_kg) || !mig_finite(p.energy_j)) {
    atomicOr(&receipt[2], 8u);
    return;
  }

  out.chart_id = p.target_chart_id;
  out.pos_hi = pos_hi;
  out.pos_lo = pos_lo;
  out.ang_mom = ang;
  dst_particles[idx] = out;
  atomicAdd(&receipt[3], 1u);
  atomicAdd(&receipt[4], 1u);
  atomicAdd(&receipt[5], hops);
}

@compute @workgroup_size(1)
fn seal_migration_receipt() {
  let err = atomicLoad(&receipt[2]);
  let processed = atomicLoad(&receipt[3]);
  let ok = (err == 0u) && (processed == params.particle_count);
  atomicStore(&receipt[1], select(5u, 3u, ok));
}
`;

export function packScaleAtlasMigrationParticles(particles = []) {
  const words = new Uint32Array(particles.length * 20);
  const view = new DataView(words.buffer);
  for (let i = 0; i < particles.length; i += 1) {
    const p = particles[i];
    const base = i * 80;
    const posHi = p.posLocalHi ?? p.posLocal ?? [0, 0, 0];
    const posLo = p.posLocalLo ?? [0, 0, 0];
    const mom = p.linearMomentumKgMPerS ?? [0, 0, 0];
    const ang = p.angularMomentumKgM2PerS ?? [0, 0, 0];
    view.setUint32(base + 0, (p.chartId >>> 0), true);
    view.setUint32(base + 4, ((p.targetChartId ?? p.chartId) >>> 0), true);
    view.setFloat32(base + 8, Number(p.massKg ?? 1), true);
    view.setFloat32(base + 12, Number(p.energyJ ?? 0), true);
    view.setFloat32(base + 16, Number(posHi[0] ?? 0), true);
    view.setFloat32(base + 20, Number(posHi[1] ?? 0), true);
    view.setFloat32(base + 24, Number(posHi[2] ?? 0), true);
    view.setFloat32(base + 28, 0, true);
    view.setFloat32(base + 32, Number(posLo[0] ?? 0), true);
    view.setFloat32(base + 36, Number(posLo[1] ?? 0), true);
    view.setFloat32(base + 40, Number(posLo[2] ?? 0), true);
    view.setFloat32(base + 44, 0, true);
    view.setFloat32(base + 48, Number(mom[0] ?? 0), true);
    view.setFloat32(base + 52, Number(mom[1] ?? 0), true);
    view.setFloat32(base + 56, Number(mom[2] ?? 0), true);
    view.setFloat32(base + 60, 0, true);
    view.setFloat32(base + 64, Number(ang[0] ?? 0), true);
    view.setFloat32(base + 68, Number(ang[1] ?? 0), true);
    view.setFloat32(base + 72, Number(ang[2] ?? 0), true);
    view.setFloat32(base + 76, 0, true);
  }
  return words;
}

export async function runSchroederScaleAtlasMigrationWebGpu(device, {
  atlas,
  particles
} = {}) {
  const packedCharts = packSchroederScaleAtlasChartTable(atlas);
  const packedParticles = packScaleAtlasMigrationParticles(particles);
  const bindings = [
    computeBufferBinding(0, 'read-only-storage'),
    computeBufferBinding(1, 'read-only-storage'),
    computeBufferBinding(2, 'storage'),
    computeBufferBinding(3, 'storage'),
    computeBufferBinding(4, 'uniform')
  ];
  const initPipe = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-scale-atlas-mig-init.v1',
    label: 'ulg-scale-atlas-mig-init',
    code: schroederScaleAtlasMigrationWgsl,
    entryPoint: 'init_migration_receipt',
    bindings
  });
  const migPipe = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-scale-atlas-mig-run.v1',
    label: 'ulg-scale-atlas-mig-run',
    code: schroederScaleAtlasMigrationWgsl,
    entryPoint: 'migrate_particles_across_charts',
    bindings
  });
  const sealPipe = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-scale-atlas-mig-seal.v1',
    label: 'ulg-scale-atlas-mig-seal',
    code: schroederScaleAtlasMigrationWgsl,
    entryPoint: 'seal_migration_receipt',
    bindings
  });

  const chartBuf = device.createBuffer({
    label: 'ulg-scale-atlas-mig-charts',
    size: packedCharts.byteLength,
    usage: USAGE_STORAGE | USAGE_COPY_DST
  });
  const srcBuf = device.createBuffer({
    label: 'ulg-scale-atlas-mig-src',
    size: packedParticles.byteLength,
    usage: USAGE_STORAGE | USAGE_COPY_DST
  });
  const dstBuf = device.createBuffer({
    label: 'ulg-scale-atlas-mig-dst',
    size: packedParticles.byteLength,
    usage: USAGE_STORAGE | USAGE_COPY_SRC
  });
  const receiptBuf = device.createBuffer({
    label: 'ulg-scale-atlas-mig-receipt',
    size: SCHROEDER_ATLAS_MIGRATION_RECEIPT_BYTES,
    usage: USAGE_STORAGE | USAGE_COPY_SRC
  });
  const paramsBuf = device.createBuffer({
    label: 'ulg-scale-atlas-mig-params',
    size: 16,
    usage: USAGE_UNIFORM | USAGE_COPY_DST
  });
  const readReceipt = device.createBuffer({
    label: 'ulg-scale-atlas-mig-receipt-read',
    size: SCHROEDER_ATLAS_MIGRATION_RECEIPT_BYTES,
    usage: USAGE_MAP_READ | USAGE_COPY_DST
  });
  const readDst = device.createBuffer({
    label: 'ulg-scale-atlas-mig-dst-read',
    size: packedParticles.byteLength,
    usage: USAGE_MAP_READ | USAGE_COPY_DST
  });

  try {
    device.queue.writeBuffer(chartBuf, 0, packedCharts);
    device.queue.writeBuffer(srcBuf, 0, packedParticles);
    const paramBytes = new ArrayBuffer(16);
    const pView = new DataView(paramBytes);
    pView.setUint32(0, particles.length >>> 0, true);
    pView.setUint32(4, atlas.chartCount >>> 0, true);
    pView.setFloat32(8, Number(atlas.referenceSpacingM ?? 1.0), true);
    pView.setUint32(12, 0, true);
    device.queue.writeBuffer(paramsBuf, 0, paramBytes);

    const entries = [
      { binding: 0, resource: { buffer: chartBuf } },
      { binding: 1, resource: { buffer: srcBuf } },
      { binding: 2, resource: { buffer: dstBuf } },
      { binding: 3, resource: { buffer: receiptBuf } },
      { binding: 4, resource: { buffer: paramsBuf } }
    ];
    const initBg = createCachedExplicitBindGroup(device, { layout: initPipe.bindGroupLayout, entries });
    const migBg = createCachedExplicitBindGroup(device, { layout: migPipe.bindGroupLayout, entries });
    const sealBg = createCachedExplicitBindGroup(device, { layout: sealPipe.bindGroupLayout, entries });

    const encoder = device.createCommandEncoder({ label: 'ulg-scale-atlas-migration' });
    const pass = encoder.beginComputePass({ label: 'ulg-scale-atlas-migration-pass' });
    pass.setPipeline(initPipe.pipeline);
    pass.setBindGroup(0, initBg);
    pass.dispatchWorkgroups(1);
    pass.setPipeline(migPipe.pipeline);
    pass.setBindGroup(0, migBg);
    pass.dispatchWorkgroups(Math.max(1, Math.ceil(particles.length / 64)));
    pass.setPipeline(sealPipe.pipeline);
    pass.setBindGroup(0, sealBg);
    pass.dispatchWorkgroups(1);
    pass.end();
    encoder.copyBufferToBuffer(receiptBuf, 0, readReceipt, 0, SCHROEDER_ATLAS_MIGRATION_RECEIPT_BYTES);
    encoder.copyBufferToBuffer(dstBuf, 0, readDst, 0, packedParticles.byteLength);
    device.queue.submit([encoder.finish()]);

    await Promise.all([readReceipt.mapAsync(1), readDst.mapAsync(1)]);
    const rWords = new Uint32Array(readReceipt.getMappedRange().slice(0));
    const dstBytes = readDst.getMappedRange().slice(0);
    readReceipt.unmap();
    readDst.unmap();

    const dstView = new DataView(dstBytes);
    const migratedParticles = [];
    for (let i = 0; i < particles.length; i += 1) {
      const b = i * 80;
      migratedParticles.push(Object.freeze({
        chartId: dstView.getUint32(b + 0, true),
        targetChartId: dstView.getUint32(b + 4, true),
        massKg: dstView.getFloat32(b + 8, true),
        energyJ: dstView.getFloat32(b + 12, true),
        posLocalHi: Object.freeze([
          dstView.getFloat32(b + 16, true),
          dstView.getFloat32(b + 20, true),
          dstView.getFloat32(b + 24, true)
        ]),
        posLocalLo: Object.freeze([
          dstView.getFloat32(b + 32, true),
          dstView.getFloat32(b + 36, true),
          dstView.getFloat32(b + 40, true)
        ]),
        linearMomentumKgMPerS: Object.freeze([
          dstView.getFloat32(b + 48, true),
          dstView.getFloat32(b + 52, true),
          dstView.getFloat32(b + 56, true)
        ]),
        angularMomentumKgM2PerS: Object.freeze([
          dstView.getFloat32(b + 64, true),
          dstView.getFloat32(b + 68, true),
          dstView.getFloat32(b + 72, true)
        ])
      }));
    }

    return Object.freeze({
      receipt: Object.freeze({
        magic: rWords[0],
        status: rWords[1],
        errorMask: rWords[2],
        processedCount: rWords[3],
        migratedCount: rWords[4],
        totalHops: rWords[5],
        verified: rWords[0] === SCHROEDER_ATLAS_MIGRATION_RECEIPT_MAGIC && rWords[1] === 3 && rWords[2] === 0
      }),
      particles: Object.freeze(migratedParticles)
    });
  } finally {
    chartBuf.destroy();
    srcBuf.destroy();
    dstBuf.destroy();
    receiptBuf.destroy();
    paramsBuf.destroy();
    readReceipt.destroy();
    readDst.destroy();
  }
}
