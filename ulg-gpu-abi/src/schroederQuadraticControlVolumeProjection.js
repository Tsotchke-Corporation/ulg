// Geometry only: the production occupancy and pressure transpose execute on GPU.
// These immutable descriptors encode positions as signed grid cells and local
// fractions, so translated domains do not lose their boundary geometry to f32.
export const SCHROEDER_QUADRATIC_CONTROL_VOLUME_PROJECTION_VERSION = 1;
export const ULG_SCHROEDER_QUADRATIC_CONTROL_VOLUME_DESCRIPTOR_SCHEMA =
  'peercompute.ulg.schroeder-quadratic-control-volume-descriptor.v1';

const bitsScratch = new DataView(new ArrayBuffer(4));
const bits = (x) => { bitsScratch.setFloat32(0, x, true); return bitsScratch.getUint32(0, true); };
const float = (x) => { bitsScratch.setUint32(0, x, true); return bitsScratch.getFloat32(0, true); };
const int = (x, label, low = -2147483648, high = 2147483647) => {
  if (!Number.isInteger(x) || x < low || x > high) throw new RangeError(`${label} is outside its integer range`);
  return x;
};
const triple = (x, label, parser) => {
  if ((!Array.isArray(x) && !ArrayBuffer.isView(x)) || x.length !== 3) throw new TypeError(`${label} must be a vec3`);
  return Object.freeze(Array.from(x, (v, i) => parser(v, `${label}[${i}]`)));
};
const finite = (x, label) => {
  if (!Number.isFinite(x)) throw new RangeError(`${label} must be finite`);
  return x;
};
function coordinate(value, spacing, label) {
  const q = finite(value, label) / spacing;
  let cell = Math.floor(q);
  let fraction = Math.fround(q - cell);
  if (fraction === 1) { cell++; fraction = 0; }
  int(cell, `${label} cell`);
  if (!(fraction >= 0 && fraction < 1)) throw new RangeError(`${label} fraction is invalid`);
  return [cell >>> 0, bits(fraction)];
}
function geometryWords(d) {
  return [d.version, bits(d.gridSpacingM), ...d.gridCellOrigin.map((x) => x >>> 0),
    ...d.gridDims, d.gridNodeCount, d.chartId, d.selectedLevel >>> 0, ...d.boundsWords];
}
export function schroederQuadraticControlVolumeDescriptorSeal(descriptor) {
  let hash = 2166136261;
  for (const word of geometryWords(descriptor)) hash = Math.imul((hash ^ word) >>> 0, 16777619) >>> 0;
  return hash;
}
export function createSchroederQuadraticControlVolumeDescriptor(options = {}) {
  const g = options.grid ?? options;
  const spacing = Math.fround(finite(g.gridSpacingM, 'gridSpacingM'));
  if (!(spacing > 0) || !Number.isFinite(spacing)) throw new RangeError('gridSpacingM must be positive finite f32');
  const dims = triple(g.gridDims, 'gridDims', (x, label) => int(x, label, 1));
  const count = int(g.gridNodeCount, 'gridNodeCount', 1, 4294967295);
  if (dims.reduce((a, b) => a * b, 1) !== count) throw new RangeError('gridNodeCount must equal gridDims product');
  const shift = g.gridShift === undefined ? undefined : int(g.gridShift, 'gridShift', 0);
  const origin = triple(g.gridCellOrigin ?? [- (shift ?? 0), - (shift ?? 0), - (shift ?? 0)], 'gridCellOrigin', int);
  if (shift !== undefined && origin.some((v) => v !== -shift)) throw new RangeError('gridShift and gridCellOrigin disagree');
  for (let axis = 0; axis < 3; axis++) int(origin[axis] + dims[axis] - 1, 'grid extent');
  const lower = triple(options.boxMinM, 'boxMinM', finite);
  const upper = triple(options.boxMaxM, 'boxMaxM', finite);
  const boundsWords = [];
  for (let axis = 0; axis < 3; axis++) {
    if (!(upper[axis] > lower[axis])) throw new RangeError('box bounds must be strictly ordered');
    const lo = coordinate(lower[axis], spacing, 'boxMinM');
    const hi = coordinate(upper[axis], spacing, 'boxMaxM');
    if ((hi[0] | 0) < (lo[0] | 0) || ((hi[0] | 0) === (lo[0] | 0) && !(float(hi[1]) > float(lo[1])))) {
      throw new RangeError('box bounds collapse in canonical f32 coordinates');
    }
    boundsWords.push(...lo, ...hi);
  }
  const d = { schema: ULG_SCHROEDER_QUADRATIC_CONTROL_VOLUME_DESCRIPTOR_SCHEMA,
    version: SCHROEDER_QUADRATIC_CONTROL_VOLUME_PROJECTION_VERSION,
    gridSpacingM: spacing, gridDims: dims, gridNodeCount: count,
    gridCellOrigin: origin, ...(shift === undefined ? {} : { gridShift: shift }),
    chartId: int(g.chartId ?? 0, 'chartId', 0, 4294967295),
    selectedLevel: int(g.selectedLevel ?? 0, 'selectedLevel'),
    boundsWords: Object.freeze(boundsWords) };
  d.seal = schroederQuadraticControlVolumeDescriptorSeal(d);
  return Object.freeze(d);
}

export function validateSchroederQuadraticControlVolumeDescriptor(d, expectedGrid = {}) {
  if (!d || !Object.isFrozen(d) || Object.values(Object.getOwnPropertyDescriptors(d)).some((p) => !('value' in p))) {
    throw new TypeError('quadratic control-volume descriptor must be immutable own data');
  }
  for (const key of ['schema', 'version', 'seal', 'gridSpacingM', 'gridDims',
    'gridNodeCount', 'gridCellOrigin', 'chartId', 'selectedLevel', 'boundsWords']) {
    if (!Object.hasOwn(d, key)) throw new TypeError(`quadratic control-volume ${key} must be immutable own data`);
  }
  if (!d || d.schema !== ULG_SCHROEDER_QUADRATIC_CONTROL_VOLUME_DESCRIPTOR_SCHEMA
      || d.version !== SCHROEDER_QUADRATIC_CONTROL_VOLUME_PROJECTION_VERSION) throw new TypeError('quadratic control-volume descriptor schema/version mismatch');
  if (!Array.isArray(d.boundsWords) || d.boundsWords.length !== 12) throw new TypeError('quadratic control-volume boundsWords must contain 12 words');
  for (const name of ['boundsWords', 'gridDims', 'gridCellOrigin']) {
    if (!Object.isFrozen(d[name]) || Object.values(Object.getOwnPropertyDescriptors(d[name])).some((p) => !('value' in p))) {
      throw new TypeError(`quadratic control-volume ${name} must be immutable own data`);
    }
    for (let i = 0; i < d[name].length; i++) {
      if (!Object.hasOwn(d[name], i)) throw new TypeError(`quadratic control-volume ${name} indices must be immutable own data`);
    }
  }
  for (const w of d.boundsWords) int(w, 'bounds word', 0, 4294967295);
  // Validate the encoded geometry directly: do not reconstruct world coordinates.
  const dims = triple(d.gridDims, 'gridDims', (x, label) => int(x, label, 1));
  const origin = triple(d.gridCellOrigin, 'gridCellOrigin', int);
  int(d.gridNodeCount, 'gridNodeCount', 1, 4294967295);
  int(d.chartId, 'chartId', 0, 4294967295); int(d.selectedLevel, 'selectedLevel');
  if (d.gridShift !== undefined && (int(d.gridShift, 'gridShift', 0) < 0 || origin.some((v) => v !== -d.gridShift))) throw new RangeError('gridShift and gridCellOrigin disagree');
  if (!(d.gridSpacingM > 0) || !Number.isFinite(d.gridSpacingM) || Math.fround(d.gridSpacingM) !== d.gridSpacingM
      || dims.reduce((a, b) => a * b, 1) !== d.gridNodeCount) throw new RangeError('quadratic control-volume grid is invalid');
  for (let axis = 0; axis < 3; axis++) {
    int(origin[axis] + dims[axis] - 1, 'grid extent');
    const j = axis * 4;
    if (!axisValid(d.boundsWords[j] | 0, float(d.boundsWords[j + 1]), d.boundsWords[j + 2] | 0, float(d.boundsWords[j + 3]))) throw new RangeError('quadratic control-volume bounds are invalid');
  }
  if (schroederQuadraticControlVolumeDescriptorSeal(d) !== d.seal) throw new RangeError('quadratic control-volume descriptor seal mismatch');
  const expected = expectedGrid.grid ?? expectedGrid;
  for (const key of ['gridNodeCount', 'chartId', 'selectedLevel']) {
    if (expected[key] !== undefined && d[key] !== expected[key]) throw new RangeError(`quadratic control-volume ${key} mismatch`);
  }
  if (expected.gridSpacingM !== undefined && d.gridSpacingM !== Math.fround(expected.gridSpacingM)) throw new RangeError('quadratic control-volume gridSpacingM mismatch');
  const expectedOrigin = expected.gridCellOrigin ?? (expected.gridShift === undefined ? undefined : [-expected.gridShift, -expected.gridShift, -expected.gridShift]);
  for (const [key, values] of [['gridDims', expected.gridDims], ['gridCellOrigin', expectedOrigin]]) {
    if (values !== undefined && (!values || values.length !== 3 || values.some((x, i) => x !== d[key][i]))) throw new RangeError(`quadratic control-volume ${key} mismatch`);
  }
  for (const [key, offset] of [['boxMinM', 0], ['boxMaxM', 2]]) {
    const values = expectedGrid[key] ?? expected[key];
    if (values !== undefined) {
      triple(values, key, finite);
      for (let a = 0; a < 3; a++) {
        const pair = coordinate(values[a], d.gridSpacingM, key);
        if (pair.some((w, i) => w !== d.boundsWords[a * 4 + offset + i])) throw new RangeError(`quadratic control-volume ${key} mismatch`);
      }
    }
  }
  return d;
}

function axisValid(lc, lf, uc, uf) {
  return Number.isInteger(lc) && Number.isInteger(uc) && Number.isFinite(lf) && Number.isFinite(uf)
    && lf >= 0 && lf < 1 && uf >= 0 && uf < 1 && (uc > lc || (uc === lc && uf > lf));
}
function local(node, cell, fraction) { return Math.max(-4, Math.min(4, cell - node + fraction)); }
function squareIntegral(lo, hi) { return (hi - lo) * (lo * lo + lo * hi + hi * hi) / 6; }
function basisIntegral(a, b) {
  let sum = 0;
  let lo = Math.max(a, -1.5), hi = Math.min(b, -0.5);
  if (hi > lo) sum += squareIntegral(lo + 1.5, hi + 1.5);
  lo = Math.max(a, -0.5); hi = Math.min(b, 0.5);
  if (hi > lo) sum += (hi - lo) * (0.75 - (lo * lo + lo * hi + hi * hi) / 3);
  lo = Math.max(a, 0.5); hi = Math.min(b, 1.5);
  if (hi > lo) sum += squareIntegral(1.5 - hi, 1.5 - lo);
  return sum;
}
function prefixIntegral(a, b) {
  let sum = Math.max(0, Math.min(b, -1.5) - a);
  let lo = Math.max(a, -1.5), hi = Math.min(b, -0.5);
  if (hi > lo) { const u = lo + 1.5, v = hi + 1.5; sum += (hi - lo) * (1 - (u * u + u * v + v * v) / 6); }
  lo = Math.max(a, -0.5); hi = Math.min(b, 0.5);
  if (hi > lo) sum += squareIntegral(0.5 - hi, 0.5 - lo);
  return sum;
}
export function schroederQuadraticControlVolumePrimalAxisExtent(cell, lc, lf, uc, uf) {
  if (!axisValid(lc, lf, uc, uf)) return -1;
  if (cell < lc || cell > uc) return 0;
  return Math.max(0, (cell === uc ? uf : 1) - (cell === lc ? lf : 0));
}
export function schroederQuadraticControlVolumePrimalAxisCenterFraction(cell, lc, lf, uc, uf) {
  const extent = schroederQuadraticControlVolumePrimalAxisExtent(cell, lc, lf, uc, uf);
  return extent > 0 ? (cell === lc ? lf : 0) + extent * 0.5 : -1;
}
export function schroederQuadraticControlVolumeAxisProjection(node, lc, lf, uc, uf) {
  const invalid = { cell0: 0, cell1: 0, weight0: 0, weight1: 0, capacity: 0, valid: 0 };
  if (!axisValid(lc, lf, uc, uf) || !Number.isInteger(node)) return invalid;
  const a = local(node, lc, lf), b = local(node, uc, uf);
  const capacity = basisIntegral(a, b);
  if (!(capacity > 0)) return { ...invalid, valid: 1 };
  let cell0, weight0;
  if (a <= -1.5 && b >= 1.5) { cell0 = node - 1; weight0 = 0.5; }
  else if (lc === uc || (uc === lc + 1 && uf === 0)) { cell0 = lc; weight0 = 1; }
  else if (a + b >= 0) {
    const start = lf + prefixIntegral(a, b);
    const whole = Math.floor(start);
    cell0 = lc + whole;
    weight0 = Math.min(1, (1 - (start - whole)) / capacity);
  } else {
    const end = uf - prefixIntegral(-b, -a);
    const whole = Math.ceil(end) - 1;
    const last = uc + whole;
    const lastWeight = Math.min(1, (end - whole) / capacity);
    if (lastWeight === 1) { cell0 = last; weight0 = 1; }
    else { cell0 = last - 1; weight0 = 1 - lastWeight; }
  }
  const weight1 = 1 - weight0;
  if (!(capacity <= 1 && weight0 > 0 && weight0 <= 1)
      || schroederQuadraticControlVolumePrimalAxisExtent(cell0, lc, lf, uc, uf) <= 0
      || (weight1 > 0 && schroederQuadraticControlVolumePrimalAxisExtent(cell0 + 1, lc, lf, uc, uf) <= 0)) return invalid;
  if (cell0 < -2147483648 || cell0 > 2147483647 || (cell0 === 2147483647 && weight1 > 0)) return invalid;
  return { cell0, cell1: weight1 > 0 ? cell0 + 1 : cell0, weight0, weight1, capacity, valid: 1 };
}
