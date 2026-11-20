// A4 resident GPU evaluator (plan/todo/a3-a4-regional-and-multidimensional-closures.md,
// "Resident GPU evaluators remain"): any response function fitted by
// fitResponseFunction (localClosureFitCache.js) with 1-3 axes, packed into one
// f32 storage table and evaluated in WGSL with the same tensor Chebyshev
// layout as the host. Evaluation stays strict: a point outside the fitted box
// returns ok = 0 and no value; nothing extrapolates. Source-fingerprint and
// regime checks remain host-side (they are properties of the table's
// adoption, not of a GPU lookup).
//
// Table layout (f32):
//   [0] function count, [1] coefficient base (float index), [2..3] reserved,
//   then one 16-float record per function at 4 + 16 i:
//     axes, coefficient offset (from the base), n0, n1, n2 (terms per axis),
//     lo0, hi0, lo1, hi1, lo2, hi2, relative residual bound, 0, 0, 0, 0
//   then all coefficients, row-major over axes ((i0 n1 + i1) n2 + i2).

export const RESPONSE_FUNCTION_GPU_SCHEMA = 'peercompute.ulg.response-function-gpu-table.v1';
export const RESPONSE_FUNCTION_GPU_RECORD_FLOATS = 16;
export const RESPONSE_FUNCTION_GPU_HEADER_FLOATS = 4;
export const RESPONSE_FUNCTION_GPU_MAX_AXES = 3;
export const RESPONSE_FUNCTION_GPU_MAX_TERMS = 32;

/** Pack fitted response functions (fitResponseFunction results) for the GPU. */
export function packResponseFunctionsForGpu(responseFunctions) {
  if (!Array.isArray(responseFunctions) || responseFunctions.length === 0) {
    throw new TypeError('packResponseFunctionsForGpu needs at least one response function');
  }
  const records = [];
  const coefficients = [];
  for (const fn of responseFunctions) {
    const axes = fn?.axes;
    if (!Array.isArray(axes) || axes.length < 1 || axes.length > RESPONSE_FUNCTION_GPU_MAX_AXES) {
      throw new RangeError(`a GPU response function needs 1-${RESPONSE_FUNCTION_GPU_MAX_AXES} axes`);
    }
    const terms = axes.map((axis) => axis.degree + 1);
    if (terms.some((n) => !Number.isInteger(n) || n < 1 || n > RESPONSE_FUNCTION_GPU_MAX_TERMS)) {
      throw new RangeError(`each axis needs 1-${RESPONSE_FUNCTION_GPU_MAX_TERMS} Chebyshev terms`);
    }
    const expected = terms.reduce((a, b) => a * b, 1);
    if (!fn.coefficients || fn.coefficients.length !== expected) {
      throw new RangeError(`coefficient count ${fn.coefficients?.length} does not match the axis terms (${expected})`);
    }
    const bound = fn.residuals?.relativeBound;
    if (!Number.isFinite(bound) || bound < 0 || !Number.isFinite(Math.fround(bound))) {
      throw new RangeError('a GPU response function needs a finite nonnegative residual bound');
    }
    if (!Array.from(fn.coefficients).every(value => Number.isFinite(value) && Number.isFinite(Math.fround(value)))) {
      throw new RangeError('GPU response coefficients must remain finite in f32');
    }
    const record = new Array(RESPONSE_FUNCTION_GPU_RECORD_FLOATS).fill(0);
    record[0] = axes.length;
    record[1] = coefficients.length;
    terms.forEach((n, a) => { record[2 + a] = n; });
    for (let a = axes.length; a < RESPONSE_FUNCTION_GPU_MAX_AXES; a += 1) record[2 + a] = 1;
    axes.forEach((axis, a) => {
      const lo = Math.fround(axis.lo), hi = Math.fround(axis.hi);
      const width = Math.fround(hi - lo), scale = Math.fround(2 / width);
      if (!Number.isFinite(axis.lo) || !Number.isFinite(axis.hi) || !Number.isFinite(width)
        || !(hi > lo) || !Number.isFinite(scale) || !(scale > 0)) {
        throw new RangeError('GPU response domains and derivative scales must be representable in f32');
      }
      record[5 + 2 * a] = lo; record[6 + 2 * a] = hi;
    });
    record[11] = bound;
    records.push(...record);
    coefficients.push(...fn.coefficients);
  }
  const base = RESPONSE_FUNCTION_GPU_HEADER_FLOATS + records.length;
  if (base + coefficients.length >= 2 ** 24) throw new RangeError('response function table exceeds exact f32 indexing');
  const data = new Float32Array(base + coefficients.length);
  data[0] = responseFunctions.length;
  data[1] = base;
  data.set(records, RESPONSE_FUNCTION_GPU_HEADER_FLOATS);
  data.set(coefficients, base);
  return Object.freeze({ schema: RESPONSE_FUNCTION_GPU_SCHEMA, functionCount: responseFunctions.length, data });
}

/**
 * WGSL for rf_eval(index, x) -> vec2(value, ok), plus rf_eval_differential
 * returning the value, gradient and symmetric Hessian of that SAME tensor.
 * Derivatives include physical-axis normalization; this does not certify
 * derivative residuals against the source law. The consumer declares the
 * table as `var<storage, read> <tableName>: array<f32>`.
 */
export function responseFunctionGpuWgsl(tableName = 'rf_table') {
  return /* wgsl */ `
fn rf_finite(x: f32) -> bool { return abs(x) <= 3.4028234e38; }
fn rf_index(x: f32) -> bool { return x >= 0.0 && x < 16777216.0 && floor(x) == x; }

struct RfCoordinates {
  base: u32,
  terms: vec3<u32>,
  t: vec3<f32>,
  scale: vec3<f32>,
  ok: u32,
};

// Validate before integer casts or indexed reads. Pending GPU tables and
// malformed artifacts never acquire validity through robust out-of-bounds zeros.
fn rf_coordinates(index: u32, x: vec3<f32>) -> RfCoordinates {
  var out: RfCoordinates;
  let length = arrayLength(&${tableName});
  if (length < ${RESPONSE_FUNCTION_GPU_HEADER_FLOATS}u) { return out; }
  let count_f = ${tableName}[0];
  let base_f = ${tableName}[1];
  if (!rf_index(count_f) || !rf_index(base_f)) { return out; }
  let count = u32(count_f);
  let table_base = u32(base_f);
  if (count > (length - ${RESPONSE_FUNCTION_GPU_HEADER_FLOATS}u) / ${RESPONSE_FUNCTION_GPU_RECORD_FLOATS}u
    || index >= count || table_base > length
    || table_base < ${RESPONSE_FUNCTION_GPU_HEADER_FLOATS}u + count * ${RESPONSE_FUNCTION_GPU_RECORD_FLOATS}u) { return out; }
  let r = ${RESPONSE_FUNCTION_GPU_HEADER_FLOATS}u + index * ${RESPONSE_FUNCTION_GPU_RECORD_FLOATS}u;
  let axes_f = ${tableName}[r];
  let offset_f = ${tableName}[r + 1u];
  if (!rf_index(axes_f) || axes_f < 1.0 || axes_f > 3.0 || !rf_index(offset_f)) { return out; }
  let axes = u32(axes_f);
  let offset = u32(offset_f);
  if (offset > length - table_base) { return out; }
  out.base = table_base + offset;
  for (var a = 0u; a < 3u; a = a + 1u) {
    let terms = ${tableName}[r + 2u + a];
    if (!rf_index(terms) || terms < 1.0 || terms > ${RESPONSE_FUNCTION_GPU_MAX_TERMS}.0
      || (a >= axes && terms != 1.0)) { return RfCoordinates(); }
    out.terms[a] = u32(terms);
    if (a < axes) {
      let lo = ${tableName}[r + 5u + 2u * a];
      let hi = ${tableName}[r + 6u + 2u * a];
      let width = hi - lo;
      if (!rf_finite(lo) || !rf_finite(hi) || !rf_finite(width) || !(width > 0.0)
        || !rf_finite(x[a]) || !(x[a] >= lo && x[a] <= hi)) { return RfCoordinates(); }
      out.scale[a] = 2.0 / width;
      if (!rf_finite(out.scale[a]) || !(out.scale[a] > 0.0)) { return RfCoordinates(); }
      out.t[a] = clamp(2.0 * ((x[a] - lo) / width) - 1.0, -1.0, 1.0);
    }
  }
  let terms = out.terms.x * out.terms.y * out.terms.z;
  let bound = ${tableName}[r + 11u];
  if (terms > length - out.base || !rf_finite(bound) || bound < 0.0) { return RfCoordinates(); }
  out.ok = 1u;
  return out;
}

fn rf_chebyshev(t: f32, n: u32) -> array<f32, ${RESPONSE_FUNCTION_GPU_MAX_TERMS}> {
  var out: array<f32, ${RESPONSE_FUNCTION_GPU_MAX_TERMS}>;
  out[0] = 1.0;
  if (n > 1u) { out[1] = t; }
  for (var k = 2u; k < n; k = k + 1u) { out[k] = 2.0 * t * out[k - 1u] - out[k - 2u]; }
  return out;
}

// Strict: ok = 0 outside the fitted box (no extrapolation) or for a bad index.
fn rf_eval(index: u32, x_in: vec3<f32>) -> vec2<f32> {
  let coordinates = rf_coordinates(index, x_in);
  if (coordinates.ok == 0u) { return vec2<f32>(0.0); }
  let base = coordinates.base;
  let n0 = coordinates.terms.x;
  let n1 = coordinates.terms.y;
  let n2 = coordinates.terms.z;
  let t = coordinates.t;
  let tx = rf_chebyshev(t.x, n0);
  let ty = rf_chebyshev(t.y, n1);
  let tz = rf_chebyshev(t.z, n2);
  var sum = 0.0;
  for (var i = 0u; i < n0; i = i + 1u) {
    for (var j = 0u; j < n1; j = j + 1u) {
      for (var k = 0u; k < n2; k = k + 1u) {
        sum = sum + ${tableName}[base + (i * n1 + j) * n2 + k] * tx[i] * ty[j] * tz[k];
      }
    }
  }
  if (!rf_finite(sum)) { return vec2<f32>(0.0); }
  return vec2<f32>(sum, 1.0);
}

struct RfBasisDifferential {
  value: array<f32, ${RESPONSE_FUNCTION_GPU_MAX_TERMS}>,
  first: array<f32, ${RESPONSE_FUNCTION_GPU_MAX_TERMS}>,
  second: array<f32, ${RESPONSE_FUNCTION_GPU_MAX_TERMS}>,
};

fn rf_basis_differential(t: f32, n: u32) -> RfBasisDifferential {
  var out: RfBasisDifferential;
  out.value[0] = 1.0;
  if (n > 1u) { out.value[1] = t; out.first[1] = 1.0; }
  for (var k = 2u; k < n; k = k + 1u) {
    out.value[k] = 2.0 * t * out.value[k - 1u] - out.value[k - 2u];
    out.first[k] = 2.0 * out.value[k - 1u] + 2.0 * t * out.first[k - 1u] - out.first[k - 2u];
    out.second[k] = 4.0 * out.first[k - 1u] + 2.0 * t * out.second[k - 1u] - out.second[k - 2u];
  }
  return out;
}

struct RfDifferential {
  value: f32,
  gradient: vec3<f32>,
  hessian: mat3x3<f32>,
  ok: u32,
};

fn rf_scale_second(value: f32, first_scale: f32, second_scale: f32) -> f32 {
  // An explicit zero branch is necessary: GPU contraction can combine the
  // scales before multiplying a zero derivative, producing 0 * infinity.
  if (value == 0.0 || first_scale == 0.0 || second_scale == 0.0) { return 0.0; }
  return (value * first_scale) * second_scale;
}

fn rf_eval_differential(index: u32, x: vec3<f32>) -> RfDifferential {
  var out: RfDifferential;
  let c = rf_coordinates(index, x);
  if (c.ok == 0u) { return out; }
  let bx = rf_basis_differential(c.t.x, c.terms.x);
  let by = rf_basis_differential(c.t.y, c.terms.y);
  let bz = rf_basis_differential(c.t.z, c.terms.z);
  for (var i = 0u; i < c.terms.x; i = i + 1u) {
    for (var j = 0u; j < c.terms.y; j = j + 1u) {
      for (var k = 0u; k < c.terms.z; k = k + 1u) {
        let a = ${tableName}[c.base + (i * c.terms.y + j) * c.terms.z + k];
        out.value += a * bx.value[i] * by.value[j] * bz.value[k];
        out.gradient += a * vec3<f32>(bx.first[i] * by.value[j] * bz.value[k],
          bx.value[i] * by.first[j] * bz.value[k], bx.value[i] * by.value[j] * bz.first[k]);
        out.hessian[0][0] += a * bx.second[i] * by.value[j] * bz.value[k];
        out.hessian[1][1] += a * bx.value[i] * by.second[j] * bz.value[k];
        out.hessian[2][2] += a * bx.value[i] * by.value[j] * bz.second[k];
        out.hessian[0][1] += a * bx.first[i] * by.first[j] * bz.value[k];
        out.hessian[0][2] += a * bx.first[i] * by.value[j] * bz.first[k];
        out.hessian[1][2] += a * bx.value[i] * by.first[j] * bz.first[k];
      }
    }
  }
  out.gradient *= c.scale;
  for (var column = 0u; column < 3u; column += 1u) {
    for (var row = 0u; row < 3u; row += 1u) {
      out.hessian[column][row] = rf_scale_second(out.hessian[column][row], c.scale[row], c.scale[column]);
    }
    if (!all(abs(out.hessian[column]) <= vec3<f32>(3.4028234e38))) { return RfDifferential(); }
  }
  out.hessian[1][0] = out.hessian[0][1];
  out.hessian[2][0] = out.hessian[0][2];
  out.hessian[2][1] = out.hessian[1][2];
  if (!rf_finite(out.value) || !all(abs(out.gradient) <= vec3<f32>(3.4028234e38))) { return RfDifferential(); }
  out.ok = 1u;
  return out;
}
`;
}
