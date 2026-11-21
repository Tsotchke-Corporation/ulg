export const ULG_SCHROEDER_SPATIAL_SCALE_ATLAS_SCHEMA =
  'peercompute.ulg.schroeder-spatial-scale-atlas.v1';
export const ULG_SCHROEDER_SPATIAL_SCALE_CHART_SCHEMA =
  'peercompute.ulg.schroeder-spatial-scale-chart.v1';

// Global dyadic scale ladder: dx_global(L) = referenceSpacingM * 2^L.
// L in [-64, +96] gives 161 dyadic levels = 2^160 ~= 1.46e48 (> 48 orders of
// magnitude), comfortably exceeding the 40-OOM target (10^40 ~= 2^132.88) from
// sub-femtometer nuclear scales (~1e-19 m) to cosmic horizon scales (~1e28 m).
export const SCHROEDER_DYADIC_SCALE_GLOBAL_MIN_LEVEL = -64;
export const SCHROEDER_DYADIC_SCALE_GLOBAL_MAX_LEVEL = 96;
export const SCHROEDER_DYADIC_SCALE_SPAN_LEVELS =
  SCHROEDER_DYADIC_SCALE_GLOBAL_MAX_LEVEL
  - SCHROEDER_DYADIC_SCALE_GLOBAL_MIN_LEVEL + 1;
export const SCHROEDER_DYADIC_SCALE_TARGET_OOM = 40;

// Maximum contiguous 2:1 chained mechanics levels resident inside one spatial
// chart (2^15 = 32,768x continuous ratio within a single chart with O(1)
// WebGPU storage bindings). Wider spans compose multiple sparse scale charts
// linked by exact double-float origin rebasing + dyadic power-of-2 scaling.
export const SCHROEDER_SPATIAL_MAX_CONTIGUOUS_CHAIN_LEVELS = 16;

// Packed GPU record layout per scale chart (16 u32 words = 64 bytes):
//   [0]:  chartId:u32
//   [1]:  parentChartId:u32 (0xffffffff = root chart)
//   [2]:  globalBaseLevel:i32-bits
//   [3]:  parentRelativeLevelOffset:i32-bits (child.globalBaseLevel - parent.globalBaseLevel)
//   [4]:  localMinLevel:i32-bits
//   [5]:  localMaxLevel:i32-bits
//   [6]:  localBaseSpacingM:f32-bits (well-conditioned O(1) f32 spacing in chart units)
//   [7]:  flags:u32 (bit 0 = hasParent)
//   [8]:  originHiX:f32-bits (chart origin in parent-chart or world units, high f32)
//   [9]:  originHiY:f32-bits
//   [10]: originHiZ:f32-bits
//   [11]: reserved0:u32
//   [12]: originLoX:f32-bits (exact residual low f32: origin = originHi + originLo)
//   [13]: originLoY:f32-bits
//   [14]: originLoZ:f32-bits
//   [15]: reserved1:u32
export const SCHROEDER_SCALE_CHART_RECORD_WORDS = 16;
export const SCHROEDER_SCALE_CHART_RECORD_BYTES =
  SCHROEDER_SCALE_CHART_RECORD_WORDS * Uint32Array.BYTES_PER_ELEMENT;
export const SCHROEDER_SCALE_CHART_NO_PARENT = 0xffff_ffff;

const LOG10_OF_2 = Math.LN2 / Math.LN10;
const MAX_EXACT_CHART_ID = 0x00ff_ffff;
const F32_MIN_NORMAL = 2 ** -126;
const F32_MAX_FINITE = 3.4028234663852886e38;

function requireInteger(value, label, min, max) {
  const num = Number(value);
  if (!Number.isInteger(num) || num < min || num > max) {
    throw new RangeError(`${label} must be an integer in [${min}, ${max}]`);
  }
  return num;
}

function requirePositiveFinite(value, label) {
  const num = Number(value);
  if (!Number.isFinite(num) || !(num > 0)) {
    throw new RangeError(`${label} must be a positive finite number`);
  }
  return num;
}

function requireFiniteVec3(value, label) {
  if ((!Array.isArray(value) && !ArrayBuffer.isView(value)) || value.length !== 3) {
    throw new TypeError(`${label} must be a 3-element vector`);
  }
  const out = [Number(value[0]), Number(value[1]), Number(value[2])];
  if (out.some((entry) => !Number.isFinite(entry))) {
    throw new RangeError(`${label} components must be finite`);
  }
  return out;
}

function float32Bits(value) {
  const f32 = new Float32Array(1);
  f32[0] = value;
  return new Uint32Array(f32.buffer)[0] >>> 0;
}

/**
 * Split an f64 coordinate into an exact non-overlapping double-float `(hi, lo)`
 * f32 pair matching `schroederSolidMultilevelGpu.js` SOL-6 chart rebasing.
 */
export function splitFloat64ToDoubleFloat(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw new RangeError('Double-float split requires a finite number');
  }
  const hi = Math.fround(num);
  const lo = Math.fround(num - hi);
  return Object.freeze([hi, lo]);
}

export function combineDoubleFloatToFloat64(hi, lo) {
  return Number(hi) + Number(lo);
}

/**
 * Exact f64 dyadic grid spacing at any global level in [-64, +96] (> 48 OOM).
 * Multiplication by an exact power of 2 in IEEE-754 f64 alters only the
 * exponent field and introduces zero mantissa rounding error.
 */
export function dyadicScaleSpacingM(globalLevel, referenceSpacingM = 1.0) {
  const level = requireInteger(
    globalLevel,
    'globalLevel',
    SCHROEDER_DYADIC_SCALE_GLOBAL_MIN_LEVEL,
    SCHROEDER_DYADIC_SCALE_GLOBAL_MAX_LEVEL
  );
  const ref = requirePositiveFinite(referenceSpacingM, 'referenceSpacingM');
  const spacing = ref * (2 ** level);
  if (!Number.isFinite(spacing) || !(spacing > 0)) {
    throw new RangeError(`dyadicScaleSpacingM overflowed f64 at level ${level}`);
  }
  return spacing;
}

export function dyadicLevelSpanOrdersOfMagnitude(minGlobalLevel, maxGlobalLevel) {
  const minL = requireInteger(
    minGlobalLevel,
    'minGlobalLevel',
    SCHROEDER_DYADIC_SCALE_GLOBAL_MIN_LEVEL,
    SCHROEDER_DYADIC_SCALE_GLOBAL_MAX_LEVEL
  );
  const maxL = requireInteger(
    maxGlobalLevel,
    'maxGlobalLevel',
    minL,
    SCHROEDER_DYADIC_SCALE_GLOBAL_MAX_LEVEL
  );
  return (maxL - minL) * LOG10_OF_2;
}

/**
 * Create a chart-anchored dyadic scale regime descriptor.
 *
 * Inside the chart, GPU kernels operate on chart-local normalized spacings
 * `localBaseSpacingM * 2^localLevel` (always well-conditioned in f32, avoiding
 * both the 1e-6 m active-row clamp and f32 overflow/underflow), while the
 * chart anchors exact physical scale `referenceSpacingM * 2^globalBaseLevel`
 * and double-float origin `(originHi, originLo)` in parent-chart coordinates.
 */
export function createSchroederScaleChartDescriptor({
  chartId = 0,
  globalBaseLevel = 0,
  localMinLevel = 0,
  localMaxLevel = 0,
  referenceSpacingM = 1.0,
  localBaseSpacingM = 1.0,
  originInParentUnits = [0, 0, 0],
  parentChartId = null,
  label = null
} = {}) {
  const resolvedChartId = requireInteger(chartId, 'chartId', 0, MAX_EXACT_CHART_ID);
  const resolvedParentChartId = parentChartId == null
    ? null
    : requireInteger(parentChartId, 'parentChartId', 0, MAX_EXACT_CHART_ID);
  if (resolvedParentChartId === resolvedChartId) {
    throw new RangeError('Scale chart cannot be its own parent');
  }
  const baseLevel = requireInteger(
    globalBaseLevel,
    'globalBaseLevel',
    SCHROEDER_DYADIC_SCALE_GLOBAL_MIN_LEVEL,
    SCHROEDER_DYADIC_SCALE_GLOBAL_MAX_LEVEL
  );
  const minLocal = requireInteger(
    localMinLevel,
    'localMinLevel',
    -SCHROEDER_SPATIAL_MAX_CONTIGUOUS_CHAIN_LEVELS,
    SCHROEDER_SPATIAL_MAX_CONTIGUOUS_CHAIN_LEVELS
  );
  const maxLocal = requireInteger(
    localMaxLevel,
    'localMaxLevel',
    minLocal,
    minLocal + SCHROEDER_SPATIAL_MAX_CONTIGUOUS_CHAIN_LEVELS - 1
  );
  const localLevelCount = maxLocal - minLocal + 1;
  const globalMinLevel = baseLevel + minLocal;
  const globalMaxLevel = baseLevel + maxLocal;
  if (
    globalMinLevel < SCHROEDER_DYADIC_SCALE_GLOBAL_MIN_LEVEL
    || globalMaxLevel > SCHROEDER_DYADIC_SCALE_GLOBAL_MAX_LEVEL
  ) {
    throw new RangeError(
      `Chart global levels [${globalMinLevel}, ${globalMaxLevel}] exceed [${SCHROEDER_DYADIC_SCALE_GLOBAL_MIN_LEVEL}, ${SCHROEDER_DYADIC_SCALE_GLOBAL_MAX_LEVEL}]`
    );
  }
  const refSpacing = requirePositiveFinite(referenceSpacingM, 'referenceSpacingM');
  const localBaseF32 = Math.fround(requirePositiveFinite(localBaseSpacingM, 'localBaseSpacingM'));
  const localMinSpacingF32 = Math.fround(localBaseF32 * (2 ** minLocal));
  const localMaxSpacingF32 = Math.fround(localBaseF32 * (2 ** maxLocal));
  if (
    !(localMinSpacingF32 >= F32_MIN_NORMAL)
    || !(localMaxSpacingF32 <= F32_MAX_FINITE)
    || !Number.isFinite(localMinSpacingF32)
    || !Number.isFinite(localMaxSpacingF32)
  ) {
    throw new RangeError('Chart-local f32 spacings must remain strictly finite normal floats');
  }
  const origin = requireFiniteVec3(originInParentUnits, 'originInParentUnits');
  const originHi = [];
  const originLo = [];
  for (let axis = 0; axis < 3; axis += 1) {
    const [hi, lo] = splitFloat64ToDoubleFloat(origin[axis]);
    originHi.push(hi);
    originLo.push(lo);
  }
  const physicalBaseSpacingM = dyadicScaleSpacingM(baseLevel, refSpacing);
  const physicalMinSpacingM = dyadicScaleSpacingM(globalMinLevel, refSpacing);
  const physicalMaxSpacingM = dyadicScaleSpacingM(globalMaxLevel, refSpacing);
  const activeGlobalLevels = Object.freeze(
    Array.from({ length: localLevelCount }, (_, idx) => globalMinLevel + idx)
  );
  const localLevelSpacingsF32 = Object.freeze(
    Array.from({ length: localLevelCount }, (_, idx) => Math.fround(localBaseF32 * (2 ** (minLocal + idx))))
  );
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_SCALE_CHART_SCHEMA,
    chartId: resolvedChartId,
    parentChartId: resolvedParentChartId,
    label: label == null ? `chart-${resolvedChartId}` : String(label),
    globalBaseLevel: baseLevel,
    localMinLevel: minLocal,
    localMaxLevel: maxLocal,
    localLevelCount,
    globalMinLevel,
    globalMaxLevel,
    activeGlobalLevels,
    referenceSpacingM: refSpacing,
    localBaseSpacingM: localBaseF32,
    localLevelSpacingsF32,
    physicalBaseSpacingM,
    physicalMinSpacingM,
    physicalMaxSpacingM,
    originInParentUnits: Object.freeze(origin),
    originHi: Object.freeze(originHi),
    originLo: Object.freeze(originLo)
  });
}

/**
 * Validate and compile a sparse multi-chart dyadic scale atlas spanning up to
 * 161 global dyadic levels (> 48 orders of magnitude) while allocating GPU
 * residency ONLY for active populated levels (never O(L_max - L_min)).
 */
export function createSchroederScaleAtlasPlan({
  charts = [],
  referenceSpacingM = 1.0
} = {}) {
  const refSpacing = requirePositiveFinite(referenceSpacingM, 'referenceSpacingM');
  if (!Array.isArray(charts) || charts.length < 1) {
    throw new TypeError('Scale atlas requires at least one chart descriptor');
  }
  const normalized = charts.map((entry) => (
    entry?.schema === ULG_SCHROEDER_SPATIAL_SCALE_CHART_SCHEMA
      ? entry
      : createSchroederScaleChartDescriptor({ referenceSpacingM: refSpacing, ...entry })
  ));
  const byId = new Map();
  for (const chart of normalized) {
    if (byId.has(chart.chartId)) {
      throw new RangeError(`Duplicate chartId ${chart.chartId} in scale atlas`);
    }
    if (chart.referenceSpacingM !== refSpacing) {
      throw new RangeError(
        `Chart ${chart.chartId} referenceSpacingM (${chart.referenceSpacingM}) disagrees with atlas (${refSpacing})`
      );
    }
    byId.set(chart.chartId, chart);
  }
  // Validate parent references and acyclicity (rooted forest/tree).
  const rootChartIds = [];
  for (const chart of normalized) {
    if (chart.parentChartId == null) {
      rootChartIds.push(chart.chartId);
      continue;
    }
    if (!byId.has(chart.parentChartId)) {
      throw new RangeError(
        `Chart ${chart.chartId} references missing parentChartId ${chart.parentChartId}`
      );
    }
    const visited = new Set([chart.chartId]);
    let cursor = byId.get(chart.parentChartId);
    while (cursor != null) {
      if (visited.has(cursor.chartId)) {
        throw new RangeError(`Cycle detected in scale atlas parent chain at chart ${cursor.chartId}`);
      }
      visited.add(cursor.chartId);
      cursor = cursor.parentChartId == null ? null : byId.get(cursor.parentChartId);
    }
  }
  if (rootChartIds.length < 1) {
    throw new RangeError('Scale atlas requires at least one root chart');
  }
  const activeLevelSet = new Set();
  let minGlobalLevel = Infinity;
  let maxGlobalLevel = -Infinity;
  let totalResidentLocalLevels = 0;
  for (const chart of normalized) {
    totalResidentLocalLevels += chart.localLevelCount;
    if (chart.globalMinLevel < minGlobalLevel) minGlobalLevel = chart.globalMinLevel;
    if (chart.globalMaxLevel > maxGlobalLevel) maxGlobalLevel = chart.globalMaxLevel;
    for (const lvl of chart.activeGlobalLevels) activeLevelSet.add(lvl);
  }
  const activeGlobalLevels = Object.freeze([...activeLevelSet].sort((a, b) => a - b));
  const dyadicSpanLevels = maxGlobalLevel - minGlobalLevel + 1;
  const ordersOfMagnitude = dyadicLevelSpanOrdersOfMagnitude(minGlobalLevel, maxGlobalLevel);
  const dynamicRangeRatio = 2 ** (maxGlobalLevel - minGlobalLevel);
  const sparseOccupancyRatio = activeGlobalLevels.length / dyadicSpanLevels;

  // Build parent-relative level offsets for every chart.
  const chartEntries = Object.freeze(normalized.map((chart) => {
    const parent = chart.parentChartId == null ? null : byId.get(chart.parentChartId);
    const parentRelativeLevelOffset = parent == null
      ? 0
      : chart.globalBaseLevel - parent.globalBaseLevel;
    return Object.freeze({
      ...chart,
      parentRelativeLevelOffset,
      scaleToParentFactor: 2 ** parentRelativeLevelOffset
    });
  }));

  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_SCALE_ATLAS_SCHEMA,
    status: 'schroeder-spatial-scale-atlas-ready',
    referenceSpacingM: refSpacing,
    charts: chartEntries,
    chartCount: chartEntries.length,
    rootChartIds: Object.freeze(rootChartIds),
    minGlobalLevel,
    maxGlobalLevel,
    dyadicSpanLevels,
    activeGlobalLevels,
    activeLevelCount: activeGlobalLevels.length,
    totalResidentLocalLevels,
    sparseOccupancyRatio,
    ordersOfMagnitude,
    dynamicRangeRatio,
    supports40OomTarget:
      SCHROEDER_DYADIC_SCALE_SPAN_LEVELS * LOG10_OF_2 >= SCHROEDER_DYADIC_SCALE_TARGET_OOM,
    minPhysicalSpacingM: dyadicScaleSpacingM(minGlobalLevel, refSpacing),
    maxPhysicalSpacingM: dyadicScaleSpacingM(maxGlobalLevel, refSpacing)
  });
}

/**
 * Pack an atlas plan into a flat GPU-ready Uint32Array chart table
 * (`SCHROEDER_SCALE_CHART_RECORD_WORDS` u32 words per chart).
 */
export function packSchroederScaleAtlasChartTable(atlasPlan) {
  if (!atlasPlan || atlasPlan.schema !== ULG_SCHROEDER_SPATIAL_SCALE_ATLAS_SCHEMA) {
    throw new TypeError('packSchroederScaleAtlasChartTable requires a scale atlas plan');
  }
  const words = new Uint32Array(atlasPlan.chartCount * SCHROEDER_SCALE_CHART_RECORD_WORDS);
  const view = new DataView(words.buffer);
  for (let i = 0; i < atlasPlan.chartCount; i += 1) {
    const chart = atlasPlan.charts[i];
    const byteBase = i * SCHROEDER_SCALE_CHART_RECORD_BYTES;
    view.setUint32(byteBase + 0, chart.chartId >>> 0, true);
    view.setUint32(
      byteBase + 4,
      chart.parentChartId == null ? SCHROEDER_SCALE_CHART_NO_PARENT : (chart.parentChartId >>> 0),
      true
    );
    view.setInt32(byteBase + 8, chart.globalBaseLevel | 0, true);
    view.setInt32(byteBase + 12, chart.parentRelativeLevelOffset | 0, true);
    view.setInt32(byteBase + 16, chart.localMinLevel | 0, true);
    view.setInt32(byteBase + 20, chart.localMaxLevel | 0, true);
    view.setUint32(byteBase + 24, float32Bits(chart.localBaseSpacingM), true);
    view.setUint32(byteBase + 28, chart.parentChartId == null ? 0 : 1, true);
    view.setUint32(byteBase + 32, float32Bits(chart.originHi[0]), true);
    view.setUint32(byteBase + 36, float32Bits(chart.originHi[1]), true);
    view.setUint32(byteBase + 40, float32Bits(chart.originHi[2]), true);
    view.setUint32(byteBase + 44, 0, true);
    view.setUint32(byteBase + 48, float32Bits(chart.originLo[0]), true);
    view.setUint32(byteBase + 52, float32Bits(chart.originLo[1]), true);
    view.setUint32(byteBase + 56, float32Bits(chart.originLo[2]), true);
    view.setUint32(byteBase + 60, 0, true);
  }
  return words;
}

/**
 * Rebase a local position from a child chart into its direct parent chart (or
 * vice versa) using exact double-float origin coordinates and exact dyadic
 * power-of-2 scaling `2^(child.globalBaseLevel - parent.globalBaseLevel)`.
 *
 * Physical identity:
 *   x_parent = origin_child_in_parent + x_child * 2^(L_child - L_parent)
 *   x_child  = (x_parent - origin_child_in_parent) * 2^(L_parent - L_child)
 */
export function rebasePositionChildToParent(localPosChild, childChart, parentChart) {
  const pos = requireFiniteVec3(localPosChild, 'localPosChild');
  if (childChart.parentChartId !== parentChart.chartId) {
    throw new TypeError('rebasePositionChildToParent requires a direct parent-child chart pair');
  }
  const deltaExp = childChart.globalBaseLevel - parentChart.globalBaseLevel;
  const scale = 2 ** deltaExp;
  const out = [0, 0, 0];
  for (let axis = 0; axis < 3; axis += 1) {
    const origin = combineDoubleFloatToFloat64(childChart.originHi[axis], childChart.originLo[axis]);
    out[axis] = origin + pos[axis] * scale;
  }
  return Object.freeze(out);
}

export function rebasePositionParentToChild(localPosParent, parentChart, childChart) {
  const pos = requireFiniteVec3(localPosParent, 'localPosParent');
  if (childChart.parentChartId !== parentChart.chartId) {
    throw new TypeError('rebasePositionParentToChild requires a direct parent-child chart pair');
  }
  const deltaExp = parentChart.globalBaseLevel - childChart.globalBaseLevel;
  const invScale = 2 ** deltaExp;
  const out = [0, 0, 0];
  for (let axis = 0; axis < 3; axis += 1) {
    const origin = combineDoubleFloatToFloat64(childChart.originHi[axis], childChart.originLo[axis]);
    out[axis] = (pos[axis] - origin) * invScale;
  }
  return Object.freeze(out);
}

/**
 * Rebase a conserved multipole / aggregate summary (mass, center-of-mass /
 * first moment, linear momentum, angular momentum about chart origin, kinetic
 * and internal energy, bounding radius) from a child chart into its parent
 * chart without losing conservation across arbitrary dyadic scale jumps.
 *
 * By the parallel-axis / origin-shift theorem:
 *   M_parent  = M_child
 *   P_parent  = P_child                                     (physical m/s)
 *   r_parent  = origin_child + r_child * 2^(L_c - L_p)
 *   L_parent  = L_child + (origin_child_m x P_child)        (exact physical N*m*s)
 *   E_parent  = E_child
 */
export function rebaseAggregateMomentChildToParent(aggregate, childChart, parentChart) {
  if (childChart.parentChartId !== parentChart.chartId) {
    throw new TypeError('rebaseAggregateMomentChildToParent requires a direct parent-child chart pair');
  }
  const massKg = Number(aggregate.massKg);
  if (!Number.isFinite(massKg) || massKg < 0) {
    throw new RangeError('aggregate.massKg must be finite and nonnegative');
  }
  const comChild = requireFiniteVec3(aggregate.comLocal, 'aggregate.comLocal');
  const momentum = requireFiniteVec3(aggregate.linearMomentumKgMPerS, 'aggregate.linearMomentumKgMPerS');
  const angular = requireFiniteVec3(aggregate.angularMomentumKgM2PerS, 'aggregate.angularMomentumKgM2PerS');
  const radiusChild = Number(aggregate.boundingRadiusLocal ?? 0);
  const comParent = rebasePositionChildToParent(comChild, childChart, parentChart);
  const scale = 2 ** (childChart.globalBaseLevel - parentChart.globalBaseLevel);
  const parentSpacingM = parentChart.physicalBaseSpacingM;
  const originM = [0, 1, 2].map((axis) => (
    combineDoubleFloatToFloat64(childChart.originHi[axis], childChart.originLo[axis]) * parentSpacingM
  ));
  const shiftTorque = [
    originM[1] * momentum[2] - originM[2] * momentum[1],
    originM[2] * momentum[0] - originM[0] * momentum[2],
    originM[0] * momentum[1] - originM[1] * momentum[0]
  ];
  return Object.freeze({
    chartId: parentChart.chartId,
    massKg,
    comLocal: comParent,
    firstMomentLocal: Object.freeze(comParent.map((c) => c * massKg)),
    linearMomentumKgMPerS: Object.freeze([...momentum]),
    angularMomentumKgM2PerS: Object.freeze([
      angular[0] + shiftTorque[0],
      angular[1] + shiftTorque[1],
      angular[2] + shiftTorque[2]
    ]),
    kineticEnergyJ: Number(aggregate.kineticEnergyJ ?? 0),
    internalEnergyJ: Number(aggregate.internalEnergyJ ?? 0),
    boundingRadiusLocal: radiusChild * scale
  });
}

/**
 * Canonical builder for an N-level 2:1 contiguous Schroeder mechanics chain
 * (`levelCount` in [2, SCHROEDER_SPATIAL_MAX_CONTIGUOUS_CHAIN_LEVELS]) with
 * exact f32 2:1 grid spacing ratios and guaranteed container containment.
 */
export function buildSchroederMechanicsChainLevelSpecs({
  boxDimsM,
  fineGridSpacingM,
  levelCount,
  minLevel = 0,
  gridSpecFactory
} = {}) {
  const dims = requireFiniteVec3(boxDimsM, 'boxDimsM');
  if (dims.some((d) => !(d > 0))) {
    throw new RangeError('boxDimsM must be positive');
  }
  const count = requireInteger(
    levelCount,
    'levelCount',
    2,
    SCHROEDER_SPATIAL_MAX_CONTIGUOUS_CHAIN_LEVELS
  );
  const baseMinLevel = requireInteger(
    minLevel,
    'minLevel',
    SCHROEDER_DYADIC_SCALE_GLOBAL_MIN_LEVEL,
    SCHROEDER_DYADIC_SCALE_GLOBAL_MAX_LEVEL - count + 1
  );
  const fineDx = Math.fround(requirePositiveFinite(fineGridSpacingM, 'fineGridSpacingM'));
  if (typeof gridSpecFactory !== 'function') {
    throw new TypeError('buildSchroederMechanicsChainLevelSpecs requires a gridSpecFactory function');
  }
  const levels = [];
  let spacing = fineDx;
  for (let i = 0; i < count; i += 1) {
    if (i > 0) {
      spacing = Math.fround(spacing * 2);
      if (!Number.isFinite(spacing) || !(spacing > 0)) {
        throw new RangeError(`Chain grid spacing overflowed f32 at level index ${i}`);
      }
    }
    const spec = gridSpecFactory({ boxDimsM: dims, gridSpacingM: spacing });
    const gridDims = Array.from(spec.gridDims ?? []);
    const gridShift = Number(spec.gridShift ?? spec.shift ?? 0);
    const gridNodeCount = Number(spec.gridNodeCount);
    const gridSpacingM = Math.fround(Number(spec.gridSpacingM ?? spacing));
    if (gridSpacingM !== spacing) {
      throw new RangeError(
        `gridSpecFactory altered exact 2:1 f32 spacing at level ${baseMinLevel + i}: ${gridSpacingM} !== ${spacing}`
      );
    }
    levels.push(Object.freeze({
      selectedLevel: baseMinLevel + i,
      mechanicsGrid: Object.freeze({
        gridNodeCount,
        gridDims: Object.freeze(gridDims),
        gridShift,
        gridSpacingM,
        boxDimsM: Object.freeze([...(spec.boxDimsM ?? dims)])
      })
    }));
  }
  return Object.freeze(levels);
}

/**
 * Reusable GPU-native WGSL helper module for 40-OOM chart-anchored double-float
 * coordinate rebasing and safe dyadic power-of-2 exponent scaling (avoids both
 * single-step exp2 overflow for |delta_level| > 126 and u32 bitshift wrap).
 */
export const schroederScaleAtlasChartRebaseWgsl = /* wgsl */ `
struct SchroederScaleChartRecord {
  chart_id: u32,
  parent_chart_id: u32,
  global_base_level: i32,
  parent_relative_level_offset: i32,
  local_min_level: i32,
  local_max_level: i32,
  local_base_spacing_m: f32,
  flags: u32,
  origin_hi: vec3<f32>,
  reserved0: u32,
  origin_lo: vec3<f32>,
  reserved1: u32,
};

fn ss_atlas_two_sum(a: f32, b: f32) -> vec2<f32> {
  let s = a + b;
  let v = s - a;
  let e = (a - (s - v)) + (b - v);
  return vec2<f32>(s, e);
}

fn ss_atlas_df_add_vec3(
  ahi: vec3<f32>,
  alo: vec3<f32>,
  bhi: vec3<f32>,
  blo: vec3<f32>
) -> array<vec3<f32>, 2> {
  let sx = ss_atlas_two_sum(ahi.x, bhi.x);
  let sy = ss_atlas_two_sum(ahi.y, bhi.y);
  let sz = ss_atlas_two_sum(ahi.z, bhi.z);
  let rx = ss_atlas_two_sum(sx.x, sx.y + alo.x + blo.x);
  let ry = ss_atlas_two_sum(sy.x, sy.y + alo.y + blo.y);
  let rz = ss_atlas_two_sum(sz.x, sz.y + alo.z + blo.z);
  return array<vec3<f32>, 2>(
    vec3<f32>(rx.x, ry.x, rz.x),
    vec3<f32>(rx.y, ry.y, rz.y)
  );
}

fn ss_atlas_df_sub_to_f32(
  ahi: vec3<f32>,
  alo: vec3<f32>,
  bhi: vec3<f32>,
  blo: vec3<f32>
) -> vec3<f32> {
  return (ahi - bhi) + (alo - blo);
}

// Multiply by 2^delta_exp safely across > 128 dyadic levels (40+ OOM) by
// stepping in <= 64-level chunks so intermediate exp2() never overflows f32.
fn ss_atlas_dyadic_scale_vec3(v: vec3<f32>, delta_exp: i32) -> vec3<f32> {
  var out = v;
  var rem = delta_exp;
  for (var step = 0u; step < 4u; step = step + 1u) {
    if (rem == 0) { break; }
    let chunk = clamp(rem, -64, 64);
    out = out * exp2(f32(chunk));
    rem = rem - chunk;
  }
  return out;
}

fn ss_atlas_rebase_child_to_parent(
  local_pos_child: vec3<f32>,
  child_chart: SchroederScaleChartRecord
) -> array<vec3<f32>, 2> {
  let scaled = ss_atlas_dyadic_scale_vec3(
    local_pos_child,
    child_chart.parent_relative_level_offset
  );
  return ss_atlas_df_add_vec3(
    child_chart.origin_hi,
    child_chart.origin_lo,
    scaled,
    vec3<f32>(0.0)
  );
}

fn ss_atlas_rebase_parent_to_child(
  parent_pos_hi: vec3<f32>,
  parent_pos_lo: vec3<f32>,
  child_chart: SchroederScaleChartRecord
) -> vec3<f32> {
  let rel = ss_atlas_df_sub_to_f32(
    parent_pos_hi,
    parent_pos_lo,
    child_chart.origin_hi,
    child_chart.origin_lo
  );
  return ss_atlas_dyadic_scale_vec3(
    rel,
    -child_chart.parent_relative_level_offset
  );
}
`;
