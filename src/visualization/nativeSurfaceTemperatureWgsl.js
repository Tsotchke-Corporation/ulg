import {
  computeBufferBinding,
  createCachedExplicitComputePipeline
} from '../runtime/webgpuComputeLayout.js';

export const ULG_NATIVE_SURFACE_TEMPERATURE_ROWS_SCHEMA =
  'peercompute.ulg.native-surface-temperature-rows.v0';
export const ULG_NATIVE_SURFACE_TEMPERATURE_COVERAGE_SCHEMA =
  'peercompute.ulg.native-surface-temperature-coverage.v0';
export const ULG_NATIVE_SURFACE_TEMPERATURE_EXECUTION_SCHEMA =
  'peercompute.ulg.native-surface-temperature-execution.v0';
export const ULG_NATIVE_SURFACE_TEMPERATURE_LAYOUT_NAME =
  'peercompute.ulg.native-surface-temperature-f32-kelvin.v0';

export const ULG_NATIVE_SURFACE_TEMPERATURE_WORKGROUP_SIZE = 64;
export const ULG_NATIVE_SURFACE_TEMPERATURE_PARAMS_BYTE_LENGTH = 64;

const GPU_BUFFER_USAGE = {
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  INDIRECT: globalThis.GPUBufferUsage?.INDIRECT ?? 256
};

const UINT32_MAX = 0xffff_ffff;
const FLOAT_BYTES = Float32Array.BYTES_PER_ELEMENT;

/**
 * Encodes the legacy native-surface temperature sample once per GPU-counter
 * admitted row inside a conservative marching-cubes allocation. Empty field
 * corners do not dilute surface temperature: the trilinear weight is
 * multiplied by density lane 0 before temperature lane +4 is accumulated.
 */
export const ULG_NATIVE_SURFACE_TEMPERATURE_WGSL = /* wgsl */ `
const DENSITY_LANE_OFFSET: u32 = 0u;
const TEMPERATURE_LANE_OFFSET: u32 = 4u;

struct TemperatureParams {
  conservative_vertex_row_count: u32,
  compact_position_stride_floats: u32,
  compact_position_float_count: u32,
  render_field_float_count: u32,
  field_dim_x: u32,
  field_dim_y: u32,
  field_dim_z: u32,
  field_offset_floats: u32,
  field_stride_x_floats: u32,
  field_stride_y_floats: u32,
  field_stride_z_floats: u32,
  max_workgroups_per_dimension: u32,
  _reserved_1: u32,
  _reserved_2: u32,
  _reserved_3: u32,
  _reserved_4: u32,
};

struct FieldCorner {
  density: f32,
  temperature_k: f32,
  valid: u32,
};

@group(0) @binding(0) var<storage, read> compact_position_rows: array<f32>;
@group(0) @binding(1) var<storage, read> render_field_scalars: array<f32>;
@group(0) @binding(2) var<storage, read_write> temperature_rows_k: array<f32>;
@group(0) @binding(3) var<uniform> params: TemperatureParams;
@group(0) @binding(4) var<storage, read> actual_vertex_counter: array<u32>;
@group(0) @binding(5) var<storage, read_write> dispatch_args: array<u32>;

fn finite_scalar(value: f32) -> bool {
  return value == value && abs(value) < 1.0e30;
}

fn finite_position(value: vec3<f32>) -> bool {
  return all(value == value) && all(abs(value) < vec3<f32>(1.0e30));
}

fn field_corner(ix: i32, iy: i32, iz: i32) -> FieldCorner {
  let cx = clamp(ix, 0, i32(params.field_dim_x) - 1);
  let cy = clamp(iy, 0, i32(params.field_dim_y) - 1);
  let cz = clamp(iz, 0, i32(params.field_dim_z) - 1);
  let base = params.field_offset_floats
    + u32(cx) * params.field_stride_x_floats
    + u32(cy) * params.field_stride_y_floats
    + u32(cz) * params.field_stride_z_floats;
  if (base >= params.render_field_float_count) {
    return FieldCorner(0.0, 0.0, 0u);
  }
  if (TEMPERATURE_LANE_OFFSET >= params.render_field_float_count - base) {
    return FieldCorner(0.0, 0.0, 0u);
  }
  let density = render_field_scalars[base + DENSITY_LANE_OFFSET];
  let temperature_k = render_field_scalars[base + TEMPERATURE_LANE_OFFSET];
  if (!finite_scalar(density) || !finite_scalar(temperature_k)) {
    return FieldCorner(0.0, 0.0, 0u);
  }
  return FieldCorner(max(density, 0.0), temperature_k, 1u);
}

fn field_temperature_sample(grid_position: vec3<f32>) -> f32 {
  let maximum_grid_position = vec3<f32>(
    f32(params.field_dim_x - 1u),
    f32(params.field_dim_y - 1u),
    f32(params.field_dim_z - 1u)
  );
  let p = clamp(grid_position, vec3<f32>(0.0), maximum_grid_position);
  let base = floor(p);
  let f = p - base;
  let ix = i32(base.x);
  let iy = i32(base.y);
  let iz = i32(base.z);
  var temperature_sum = 0.0;
  var weight_sum = 0.0;
  for (var corner = 0u; corner < 8u; corner = corner + 1u) {
    let dx = i32(corner & 1u);
    let dy = i32((corner >> 1u) & 1u);
    let dz = i32((corner >> 2u) & 1u);
    let wx = select(1.0 - f.x, f.x, dx == 1);
    let wy = select(1.0 - f.y, f.y, dy == 1);
    let wz = select(1.0 - f.z, f.z, dz == 1);
    let sample = field_corner(ix + dx, iy + dy, iz + dz);
    if (sample.valid == 0u) {
      return 0.0;
    }
    let weight = wx * wy * wz * sample.density;
    temperature_sum = temperature_sum + sample.temperature_k * weight;
    weight_sum = weight_sum + weight;
  }
  if (!(weight_sum > 1.0e-6)) {
    return 0.0;
  }
  let temperature_k = temperature_sum / weight_sum;
  return select(0.0, temperature_k, finite_scalar(temperature_k));
}

@compute @workgroup_size(1)
fn plan_dispatch(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (any(global_id != vec3<u32>(0u))) {
    return;
  }
  let actual_vertex_row_count = min(
    actual_vertex_counter[0],
    params.conservative_vertex_row_count
  );
  let total_workgroup_count =
    (actual_vertex_row_count + ${ULG_NATIVE_SURFACE_TEMPERATURE_WORKGROUP_SIZE - 1}u)
      / ${ULG_NATIVE_SURFACE_TEMPERATURE_WORKGROUP_SIZE}u;
  if (total_workgroup_count == 0u) {
    dispatch_args[0] = 0u;
    dispatch_args[1] = 1u;
    dispatch_args[2] = 1u;
    return;
  }
  let workgroup_count_x = min(
    total_workgroup_count,
    params.max_workgroups_per_dimension
  );
  dispatch_args[0] = workgroup_count_x;
  dispatch_args[1] =
    (total_workgroup_count + workgroup_count_x - 1u) / workgroup_count_x;
  dispatch_args[2] = 1u;
}

@compute @workgroup_size(${ULG_NATIVE_SURFACE_TEMPERATURE_WORKGROUP_SIZE})
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row_index = global_id.x
    + global_id.y
      * params.max_workgroups_per_dimension
      * ${ULG_NATIVE_SURFACE_TEMPERATURE_WORKGROUP_SIZE}u;
  let actual_vertex_row_count = min(
    actual_vertex_counter[0],
    params.conservative_vertex_row_count
  );
  if (row_index >= actual_vertex_row_count) {
    return;
  }
  // Every admitted invocation writes a fail-closed value before touching
  // either borrowed source buffer.
  temperature_rows_k[row_index] = 0.0;
  if (params.compact_position_stride_floats < 3u
    || params.compact_position_float_count < 3u) {
    return;
  }
  let maximum_safe_row =
    (params.compact_position_float_count - 3u)
      / params.compact_position_stride_floats;
  if (row_index > maximum_safe_row) {
    return;
  }
  let position_offset = row_index * params.compact_position_stride_floats;
  let grid_position = vec3<f32>(
    compact_position_rows[position_offset + 0u],
    compact_position_rows[position_offset + 1u],
    compact_position_rows[position_offset + 2u]
  );
  if (!finite_position(grid_position)
    || params.field_dim_x == 0u
    || params.field_dim_y == 0u
    || params.field_dim_z == 0u) {
    return;
  }
  temperature_rows_k[row_index] = field_temperature_sample(grid_position);
}
`;

function requiredObject(value, label) {
  if (!value || (typeof value !== 'object' && typeof value !== 'function')) {
    throw new TypeError(`${label} is required`);
  }
  return value;
}

function nonNegativeSafeInteger(value, label) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0 || number > UINT32_MAX) {
    throw new RangeError(`${label} must be a non-negative uint32 integer`);
  }
  return number;
}

function positiveSafeInteger(value, label) {
  const number = nonNegativeSafeInteger(value, label);
  if (number <= 0) {
    throw new RangeError(`${label} must be positive`);
  }
  return number;
}

function bufferByteLength(buffer, authoredByteLength, label) {
  const candidate = authoredByteLength ?? buffer?.size;
  const byteLength = positiveSafeInteger(candidate, `${label}ByteLength`);
  if (byteLength % FLOAT_BYTES !== 0) {
    throw new RangeError(`${label}ByteLength must be aligned to f32 rows`);
  }
  if (Number.isFinite(Number(buffer?.size)) && byteLength > Number(buffer.size)) {
    throw new RangeError(`${label}ByteLength exceeds the GPU buffer size`);
  }
  return byteLength;
}

function vector3Uint(value, label) {
  if (!(Array.isArray(value) || ArrayBuffer.isView(value)) || value.length < 3) {
    throw new TypeError(`${label} must contain three uint32 integers`);
  }
  return [
    positiveSafeInteger(value[0], `${label}[0]`),
    positiveSafeInteger(value[1], `${label}[1]`),
    positiveSafeInteger(value[2], `${label}[2]`)
  ];
}

function authoredGenerationId(value, label) {
  if (value == null) {
    throw new TypeError(`${label} must be explicitly authored`);
  }
  return nonNegativeSafeInteger(value, label);
}

function authoredNullableGenerationId(value, label) {
  if (value === undefined) {
    throw new TypeError(`${label} must be explicitly authored (null is allowed)`);
  }
  return value === null ? null : nonNegativeSafeInteger(value, label);
}

function hasOwn(value, property) {
  return Boolean(value && Object.prototype.hasOwnProperty.call(value, property));
}

function requireDescriptorProperty(descriptor, property, label) {
  if (descriptor && !hasOwn(descriptor, property)) {
    throw new TypeError(`${label}.${property} must be explicitly authored`);
  }
}

function assertMatchingGenerationValue(primary, secondary, label) {
  if (primary !== secondary) {
    throw new RangeError(`${label} metadata disagrees across source descriptors`);
  }
}

function assertStorageBindingLimit(device, byteLength, label) {
  const limit = Number(device?.limits?.maxStorageBufferBindingSize);
  if (Number.isFinite(limit) && limit > 0 && byteLength > limit) {
    throw new RangeError(`${label} exceeds maxStorageBufferBindingSize`);
  }
}

/**
 * Pack the immutable uniform payload used by the temperature encoder.
 * Exported so integration diagnostics can decode the exact admitted ranges.
 */
export function createNativeSurfaceTemperatureParamsArray({
  conservativeVertexRowCount,
  compactPositionStrideFloats,
  compactPositionFloatCount,
  renderFieldFloatCount,
  fieldDimensions,
  fieldOffsetFloats,
  fieldStridesFloats,
  maxComputeWorkgroupsPerDimension = 65_535
}) {
  const values = new Uint32Array(ULG_NATIVE_SURFACE_TEMPERATURE_PARAMS_BYTE_LENGTH / 4);
  values[0] = conservativeVertexRowCount;
  values[1] = compactPositionStrideFloats;
  values[2] = compactPositionFloatCount;
  values[3] = renderFieldFloatCount;
  values[4] = fieldDimensions[0];
  values[5] = fieldDimensions[1];
  values[6] = fieldDimensions[2];
  values[7] = fieldOffsetFloats;
  values[8] = fieldStridesFloats[0];
  values[9] = fieldStridesFloats[1];
  values[10] = fieldStridesFloats[2];
  values[11] = maxComputeWorkgroupsPerDimension;
  return values;
}

/**
 * Encode generation-owned per-vertex temperatures into a caller-owned command
 * encoder. This function never finishes or submits the encoder and performs no
 * GPU readback. The returned output and params buffers remain caller-owned
 * until `destroy()` is invoked after the enclosing submit fence has settled.
 */
export function encodeNativeSurfaceTemperatureRowsWebGpu({
  device,
  commandEncoder,
  compactPositions = null,
  actualVertexCounter = null,
  renderField = null,
  generation = null,
  compactPositionRowsBuffer = compactPositions?.buffer ?? null,
  compactPositionRowsBufferByteLength = compactPositions?.byteLength,
  conservativeVertexRowCount = compactPositions?.rowCount,
  compactPositionRowsStrideFloats = compactPositions?.strideFloats,
  actualVertexCounterBuffer = actualVertexCounter?.buffer ?? null,
  actualVertexCounterBufferByteLength = actualVertexCounter?.byteLength,
  renderFieldScalarsBuffer = renderField?.buffer ?? null,
  renderFieldScalarsBufferByteLength = renderField?.byteLength,
  fieldDimensions = renderField?.dims,
  fieldStridesFloats = renderField?.scalarStrides,
  fieldOffsetFloats = renderField?.scalarOffsetFloats ?? renderField?.scalarOffset ?? 0,
  surfaceGenerationId = generation?.surfaceGenerationId
    ?? compactPositions?.surfaceGenerationId,
  volumeGenerationId = hasOwn(generation, 'volumeGenerationId')
    ? generation.volumeGenerationId
    : (hasOwn(compactPositions, 'volumeGenerationId')
        ? compactPositions.volumeGenerationId
        : undefined),
  renderFieldVolumeGenerationId = hasOwn(renderField, 'volumeGenerationId')
    ? renderField.volumeGenerationId
    : undefined,
  label = 'ulg-native-surface-temperature-rows'
} = {}) {
  requiredObject(device, 'device');
  if (typeof device.createBuffer !== 'function'
    || typeof device.createShaderModule !== 'function'
    || typeof device.createComputePipeline !== 'function'
    || typeof device.createBindGroup !== 'function') {
    throw new TypeError('device must provide the required WebGPU compute methods');
  }
  requiredObject(commandEncoder, 'commandEncoder');
  if (typeof commandEncoder.beginComputePass !== 'function') {
    throw new TypeError('commandEncoder must be a caller-owned GPUCommandEncoder');
  }
  requiredObject(compactPositionRowsBuffer, 'compactPositionRowsBuffer');
  requiredObject(actualVertexCounterBuffer, 'actualVertexCounterBuffer');
  requiredObject(renderFieldScalarsBuffer, 'renderFieldScalarsBuffer');

  requireDescriptorProperty(compactPositions, 'surfaceGenerationId', 'compactPositions');
  requireDescriptorProperty(compactPositions, 'volumeGenerationId', 'compactPositions');
  requireDescriptorProperty(renderField, 'volumeGenerationId', 'renderField');
  requireDescriptorProperty(generation, 'surfaceGenerationId', 'generation');
  requireDescriptorProperty(generation, 'volumeGenerationId', 'generation');
  const resolvedSurfaceGenerationId = authoredGenerationId(
    surfaceGenerationId,
    'surfaceGenerationId'
  );
  if (compactPositions) {
    assertMatchingGenerationValue(
      resolvedSurfaceGenerationId,
      authoredGenerationId(
        compactPositions.surfaceGenerationId,
        'compactPositions.surfaceGenerationId'
      ),
      'surfaceGenerationId'
    );
  }
  if (generation) {
    assertMatchingGenerationValue(
      resolvedSurfaceGenerationId,
      authoredGenerationId(
        generation.surfaceGenerationId,
        'generation.surfaceGenerationId'
      ),
      'surfaceGenerationId'
    );
  }
  const resolvedVolumeGenerationId = authoredNullableGenerationId(
    volumeGenerationId,
    'volumeGenerationId'
  );
  const resolvedRenderFieldVolumeGenerationId = authoredNullableGenerationId(
    renderFieldVolumeGenerationId,
    'renderFieldVolumeGenerationId'
  );
  assertMatchingGenerationValue(
    resolvedVolumeGenerationId,
    resolvedRenderFieldVolumeGenerationId,
    'volumeGenerationId'
  );
  if (renderField) {
    assertMatchingGenerationValue(
      resolvedVolumeGenerationId,
      authoredNullableGenerationId(
        renderField.volumeGenerationId,
        'renderField.volumeGenerationId'
      ),
      'volumeGenerationId'
    );
  }
  if (compactPositions) {
    assertMatchingGenerationValue(
      resolvedVolumeGenerationId,
      authoredNullableGenerationId(
        compactPositions.volumeGenerationId,
        'compactPositions.volumeGenerationId'
      ),
      'volumeGenerationId'
    );
  }
  if (generation) {
    assertMatchingGenerationValue(
      resolvedVolumeGenerationId,
      authoredNullableGenerationId(
        generation.volumeGenerationId,
        'generation.volumeGenerationId'
      ),
      'volumeGenerationId'
    );
  }
  const rowCount = positiveSafeInteger(
    conservativeVertexRowCount,
    'conservativeVertexRowCount'
  );
  const positionStrideFloats = positiveSafeInteger(
    compactPositionRowsStrideFloats,
    'compactPositionRowsStrideFloats'
  );
  if (positionStrideFloats < 3) {
    throw new RangeError('compactPositionRowsStrideFloats must contain xyz');
  }
  const positionByteLength = bufferByteLength(
    compactPositionRowsBuffer,
    compactPositionRowsBufferByteLength,
    'compactPositionRowsBuffer'
  );
  const positionFloatCount = positionByteLength / FLOAT_BYTES;
  const requiredPositionFloatCount = rowCount * positionStrideFloats;
  if (!Number.isSafeInteger(requiredPositionFloatCount)
    || requiredPositionFloatCount > UINT32_MAX
    || requiredPositionFloatCount > positionFloatCount) {
    throw new RangeError('compact position buffer does not cover every conservative vertex row');
  }
  const counterByteLength = bufferByteLength(
    actualVertexCounterBuffer,
    actualVertexCounterBufferByteLength,
    'actualVertexCounterBuffer'
  );
  if (counterByteLength < Uint32Array.BYTES_PER_ELEMENT) {
    throw new RangeError('actualVertexCounterBuffer must contain one u32 counter');
  }

  const resolvedFieldDimensions = vector3Uint(fieldDimensions, 'fieldDimensions');
  const resolvedFieldStrides = vector3Uint(fieldStridesFloats, 'fieldStridesFloats');
  const resolvedFieldOffset = nonNegativeSafeInteger(fieldOffsetFloats, 'fieldOffsetFloats');
  const fieldByteLength = bufferByteLength(
    renderFieldScalarsBuffer,
    renderFieldScalarsBufferByteLength,
    'renderFieldScalarsBuffer'
  );
  const fieldFloatCount = fieldByteLength / FLOAT_BYTES;
  const maximumFieldLane = resolvedFieldOffset
    + (resolvedFieldDimensions[0] - 1) * resolvedFieldStrides[0]
    + (resolvedFieldDimensions[1] - 1) * resolvedFieldStrides[1]
    + (resolvedFieldDimensions[2] - 1) * resolvedFieldStrides[2]
    + 4;
  if (!Number.isSafeInteger(maximumFieldLane)
    || maximumFieldLane > UINT32_MAX
    || maximumFieldLane >= fieldFloatCount) {
    throw new RangeError('render field buffer does not cover density lane 0 and temperature lane +4');
  }

  const outputByteLength = rowCount * FLOAT_BYTES;
  const maxComputeWorkgroupsPerDimension = positiveSafeInteger(
    device?.limits?.maxComputeWorkgroupsPerDimension ?? 65_535,
    'maxComputeWorkgroupsPerDimension'
  );
  assertStorageBindingLimit(device, positionByteLength, 'compact position binding');
  assertStorageBindingLimit(device, fieldByteLength, 'render field binding');
  assertStorageBindingLimit(device, outputByteLength, 'temperature output binding');
  assertStorageBindingLimit(
    device,
    Uint32Array.BYTES_PER_ELEMENT,
    'actual vertex counter binding'
  );

  const params = createNativeSurfaceTemperatureParamsArray({
    conservativeVertexRowCount: rowCount,
    compactPositionStrideFloats: positionStrideFloats,
    compactPositionFloatCount: positionFloatCount,
    renderFieldFloatCount: fieldFloatCount,
    fieldDimensions: resolvedFieldDimensions,
    fieldOffsetFloats: resolvedFieldOffset,
    fieldStridesFloats: resolvedFieldStrides,
    maxComputeWorkgroupsPerDimension
  });

  let outputBuffer = null;
  let paramsBuffer = null;
  let dispatchArgsBuffer = null;
  try {
    outputBuffer = device.createBuffer({
      label: `${label}-output`,
      size: outputByteLength,
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
    });
    paramsBuffer = device.createBuffer({
      label: `${label}-params`,
      size: ULG_NATIVE_SURFACE_TEMPERATURE_PARAMS_BYTE_LENGTH,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST,
      mappedAtCreation: true
    });
    const mappedParams = paramsBuffer.getMappedRange();
    new Uint8Array(mappedParams).set(
      new Uint8Array(params.buffer, params.byteOffset, params.byteLength)
    );
    paramsBuffer.unmap();

    dispatchArgsBuffer = device.createBuffer({
      label: `${label}-dispatch-indirect`,
      size: 3 * Uint32Array.BYTES_PER_ELEMENT,
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.INDIRECT
    });

    const {
      pipeline: dispatchPlanPipeline,
      bindGroupLayout: dispatchPlanBindGroupLayout,
      cacheStatus: dispatchPlanPipelineCacheStatus
    } = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-native-surface-temperature-dispatch-plan.v0',
      label: 'ulg-native-surface-temperature-dispatch-plan',
      code: ULG_NATIVE_SURFACE_TEMPERATURE_WGSL,
      entryPoint: 'plan_dispatch',
      bindings: [
        computeBufferBinding(3, 'uniform'),
        computeBufferBinding(4, 'read-only-storage'),
        computeBufferBinding(5, 'storage')
      ]
    });
    const {
      pipeline,
      bindGroupLayout,
      cacheStatus: temperaturePipelineCacheStatus
    } =
      createCachedExplicitComputePipeline(device, {
        cacheKey: 'ulg-native-surface-temperature-rows.v1-indirect',
        label: 'ulg-native-surface-temperature-rows',
        code: ULG_NATIVE_SURFACE_TEMPERATURE_WGSL,
        entryPoint: 'main',
        bindings: [
          computeBufferBinding(0, 'read-only-storage'),
          computeBufferBinding(1, 'read-only-storage'),
          computeBufferBinding(2, 'storage'),
          computeBufferBinding(3, 'uniform'),
          computeBufferBinding(4, 'read-only-storage')
        ]
      });
    const dispatchPlanBindGroup = device.createBindGroup({
      label: `${label}-dispatch-plan-bind-group`,
      layout: dispatchPlanBindGroupLayout,
      entries: [
        {
          binding: 3,
          resource: {
            buffer: paramsBuffer,
            size: ULG_NATIVE_SURFACE_TEMPERATURE_PARAMS_BYTE_LENGTH
          }
        },
        {
          binding: 4,
          resource: {
            buffer: actualVertexCounterBuffer,
            size: Uint32Array.BYTES_PER_ELEMENT
          }
        },
        {
          binding: 5,
          resource: {
            buffer: dispatchArgsBuffer,
            size: 3 * Uint32Array.BYTES_PER_ELEMENT
          }
        }
      ]
    });
    const bindGroup = device.createBindGroup({
      label: `${label}-bind-group`,
      layout: bindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: compactPositionRowsBuffer, size: positionByteLength }
        },
        {
          binding: 1,
          resource: { buffer: renderFieldScalarsBuffer, size: fieldByteLength }
        },
        {
          binding: 2,
          resource: { buffer: outputBuffer, size: outputByteLength }
        },
        {
          binding: 3,
          resource: {
            buffer: paramsBuffer,
            size: ULG_NATIVE_SURFACE_TEMPERATURE_PARAMS_BYTE_LENGTH
          }
        },
        {
          binding: 4,
          resource: {
            buffer: actualVertexCounterBuffer,
            size: Uint32Array.BYTES_PER_ELEMENT
          }
        }
      ]
    });
    const dispatchPlanPass = commandEncoder.beginComputePass({
      label: `${label}-dispatch-plan-pass`
    });
    dispatchPlanPass.setPipeline(dispatchPlanPipeline);
    dispatchPlanPass.setBindGroup(0, dispatchPlanBindGroup);
    dispatchPlanPass.dispatchWorkgroups(1);
    dispatchPlanPass.end();

    const pass = commandEncoder.beginComputePass({
      label: `${label}-compute-pass`
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    if (typeof pass.dispatchWorkgroupsIndirect !== 'function') {
      throw new TypeError('commandEncoder compute pass must support dispatchWorkgroupsIndirect');
    }
    pass.dispatchWorkgroupsIndirect(dispatchArgsBuffer, 0);
    pass.end();

    let destroyed = false;
    const coverage = {
      schema: ULG_NATIVE_SURFACE_TEMPERATURE_COVERAGE_SCHEMA,
      status: 'gpu-counter-clamped-prefix-encoded-zero-initialized-tail',
      mode: 'gpu-counter-clamped-conservative-vertex-row-prefix',
      firstRow: 0,
      endRowExclusive: rowCount,
      rowCount,
      conservativeVertexRowCount: rowCount,
      compactPositionRowCount: rowCount,
      encodedRowCountSource: 'gpu-actual-vertex-counter-clamped-to-conservative-capacity',
      unusedTailInitialization: 'webgpu-zero-initialized-fresh-output-buffer',
      outputStrideFloats: 1,
      outputByteLength,
      surfaceGenerationId: resolvedSurfaceGenerationId,
      volumeGenerationId: resolvedVolumeGenerationId,
      complete: true
    };
    const pipelineCacheStatus =
      dispatchPlanPipelineCacheStatus === temperaturePipelineCacheStatus
        ? dispatchPlanPipelineCacheStatus
        : 'mixed-pipeline-cache-status';
    const result = {
      schema: ULG_NATIVE_SURFACE_TEMPERATURE_EXECUTION_SCHEMA,
      temperatureRowsSchema: ULG_NATIVE_SURFACE_TEMPERATURE_ROWS_SCHEMA,
      temperatureRowsLayoutName: ULG_NATIVE_SURFACE_TEMPERATURE_LAYOUT_NAME,
      status: 'native-surface-temperature-command-encoded',
      backend: 'webgpu',
      encoding: 'f32-kelvin',
      semantic: 'density-weighted-render-field-temperature-k',
      densityLaneOffsetFloats: 0,
      temperatureLaneOffsetFloats: 4,
      surfaceGenerationId: resolvedSurfaceGenerationId,
      volumeGenerationId: resolvedVolumeGenerationId,
      coverage,
      temperatureRowsBuffer: outputBuffer,
      temperatureRowsBufferByteLength: outputByteLength,
      temperatureRowsBufferRowCount: rowCount,
      temperatureRowsStrideFloats: 1,
      temperatureRowsOwnership: 'ulg-owned-generation-buffer',
      paramsBuffer,
      paramsBufferByteLength: ULG_NATIVE_SURFACE_TEMPERATURE_PARAMS_BYTE_LENGTH,
      paramsBufferOwnership: 'ulg-owned-generation-buffer',
      dispatchArgsBuffer,
      dispatchArgsBufferByteLength: 3 * Uint32Array.BYTES_PER_ELEMENT,
      dispatchArgsBufferOwnership: 'ulg-owned-generation-buffer',
      actualVertexCounterBufferByteLength: counterByteLength,
      actualVertexCounterMode: 'gpu-actual-vertex-counter-clamped-to-conservative-capacity',
      compactPositionRowsBufferByteLength: positionByteLength,
      compactPositionRowsStrideFloats: positionStrideFloats,
      renderFieldScalarsBufferByteLength: fieldByteLength,
      fieldDimensions: [...resolvedFieldDimensions],
      fieldStridesFloats: [...resolvedFieldStrides],
      fieldOffsetFloats: resolvedFieldOffset,
      workgroupCountX: null,
      workgroupCountXUpperBound: Math.min(
        maxComputeWorkgroupsPerDimension,
        Math.ceil(rowCount / ULG_NATIVE_SURFACE_TEMPERATURE_WORKGROUP_SIZE)
      ),
      workgroupCountYUpperBound: Math.max(1, Math.ceil(
        Math.ceil(rowCount / ULG_NATIVE_SURFACE_TEMPERATURE_WORKGROUP_SIZE)
          / maxComputeWorkgroupsPerDimension
      )),
      maxComputeWorkgroupsPerDimension,
      dispatchMode: 'dispatchWorkgroupsIndirect',
      pipelineCacheStatus,
      dispatchPlanPipelineCacheStatus,
      temperaturePipelineCacheStatus,
      commandEncoderOwnership: 'caller-owned-external-command-encoder',
      commandPassCount: 2,
      additionalSubmitCount: 0,
      readbackPerformed: false,
      fullReadbackPerformed: false,
      destroyed: false,
      destroy() {
        if (destroyed) return false;
        destroyed = true;
        outputBuffer.destroy?.();
        paramsBuffer.destroy?.();
        dispatchArgsBuffer.destroy?.();
        result.destroyed = true;
        result.status = 'native-surface-temperature-resources-destroyed';
        return true;
      }
    };
    return result;
  } catch (error) {
    outputBuffer?.destroy?.();
    paramsBuffer?.destroy?.();
    dispatchArgsBuffer?.destroy?.();
    throw error;
  }
}
