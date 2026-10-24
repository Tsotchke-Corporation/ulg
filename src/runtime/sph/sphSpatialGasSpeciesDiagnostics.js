import {
  ULG_SPH_GPU_THERMAL_MATERIAL_TABLE_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import {
  computeBufferBinding,
  createCachedExplicitComputePipeline
} from '../webgpuComputeLayout.js';
import {
  sphSpatialGasSpeciesDiagnosticsWgsl,
  SPH_SPATIAL_GAS_SPECIES_DIAGNOSTIC_ROW_WORDS,
  SPH_SPATIAL_GAS_SPECIES_DIAGNOSTIC_MAGIC,
  SPH_SPATIAL_GAS_SPECIES_DIAGNOSTIC_VERSION,
  SPH_SPATIAL_GAS_SPECIES_DIAGNOSTIC_STATUS,
  ULG_SPH_SPATIAL_GAS_SPECIES_DIAGNOSTIC_SCHEMA
} from './sphSpatialGasSpeciesDiagnosticsWgsl.js';

const STORAGE = globalThis.GPUBufferUsage?.STORAGE ?? 128;
const UNIFORM = globalThis.GPUBufferUsage?.UNIFORM ?? 64;
const COPY_SRC = globalThis.GPUBufferUsage?.COPY_SRC ?? 4;
const COPY_DST = globalThis.GPUBufferUsage?.COPY_DST ?? 8;
const ROW_BYTES = SPH_SPATIAL_GAS_SPECIES_DIAGNOSTIC_ROW_WORDS * 4;

// Copy only static closure parameters. No gas inventory, temperature, position
// or phase state is materialized on the host by this optional diagnostic.
export function normalizeSphSpatialGasSpeciesDiagnostics(options, device, capacity) {
  if (options == null) return null;
  const materialId = options.materialId;
  const table = options.thermalMaterialTable;
  if (!Number.isInteger(materialId) || materialId < 1 || materialId > 0x00ff_ffff) {
    throw new TypeError('Species diagnostic requires an exact f32 material ID');
  }
  if (table?.schema !== ULG_SPH_GPU_THERMAL_MATERIAL_TABLE_SCHEMA
    || !(table.records instanceof Float32Array)
    || !(table.segments instanceof Float32Array)
    || table.records.length % 8 !== 0 || table.segments.length % 12 !== 0) {
    throw new TypeError('Species diagnostic requires the packed thermal material/segment table');
  }
  const values = new Float32Array(Math.max(1, table.records.length + table.segments.length));
  values.set(table.records);
  values.set(table.segments, table.records.length);
  // A content checksum for diagnostic attribution, not a security seal.
  let closureChecksum = 0x811c9dc5;
  for (const byte of new Uint8Array(values.buffer)) {
    closureChecksum = Math.imul(closureChecksum ^ byte, 0x01000193) >>> 0;
  }
  const closureCapacityBytes = 2 ** Math.ceil(Math.log2(Math.max(4, values.byteLength)));
  const maximum = Math.min(
    device.limits?.maxBufferSize ?? Infinity,
    device.limits?.maxStorageBufferBindingSize ?? Infinity
  );
  if (!Number.isSafeInteger(capacity) || capacity < 1
    || capacity * ROW_BYTES > maximum || closureCapacityBytes > maximum) {
    throw new RangeError('Species diagnostic exceeds the device storage-buffer limit');
  }
  return Object.freeze({
    materialId,
    materialRecordCount: table.records.length / 8,
    thermalSegmentCount: table.segments.length / 12,
    thermalOffsetFloats: table.records.length,
    closureFingerprint: `fnv1a32:${closureChecksum.toString(16).padStart(8, '0')}`,
    values,
    closureCapacityBytes
  });
}

// The EOS arena is the owner. Old closure allocations are retained on geometric
// growth until that arena is destroyed: a queue-ordered release is not a host
// completion fence. Growth is bounded by device limits and the geometric sum.
export function encodeSphSpatialGasSpeciesDiagnostics({
  device, slot, allocate, encoder, eosEntries, eosWgsl, options,
  productBuffer, productByteLength, productCapacity, productStride,
  particleCount, dispatch
}) {
  if (!options) return null;
  const retain = (label, size, usage) => {
    const buffer = allocate(device, { label: `${slot.label}-species-${label}`, size, usage });
    slot.speciesDiagnosticBuffers.push(buffer);
    return buffer;
  };
  slot.speciesDiagnosticParamsBuffer ??= retain('params', 32, UNIFORM | COPY_DST);
  slot.speciesDiagnosticRowsBuffer ??= retain(
    'rows', slot.capacity * ROW_BYTES, STORAGE | COPY_SRC | COPY_DST
  );
  if (!slot.speciesDiagnosticClosureBuffer
    || slot.speciesDiagnosticClosureBuffer.size < options.closureCapacityBytes) {
    slot.speciesDiagnosticClosureBuffer = retain(
      'closure', options.closureCapacityBytes, STORAGE | COPY_DST
    );
  }
  const params = new ArrayBuffer(32);
  const view = new DataView(params);
  view.setFloat32(0, options.materialId, true);
  [options.materialRecordCount, options.thermalSegmentCount,
    options.thermalOffsetFloats, productCapacity, productStride, particleCount]
    .forEach((value, index) => view.setUint32(4 + index * 4, value, true));
  device.queue.writeBuffer(slot.speciesDiagnosticParamsBuffer, 0, params);
  device.queue.writeBuffer(slot.speciesDiagnosticClosureBuffer, 0, options.values);
  const pipeline = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-sph-spatial-gas-species-diagnostic.v2',
    label: 'ulg-sph-spatial-gas-species-diagnostic',
    code: `${eosWgsl}\n${sphSpatialGasSpeciesDiagnosticsWgsl}`,
    entryPoint: 'diagnose_species_cells',
    bindings: [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'storage'),
      computeBufferBinding(3, 'uniform'),
      computeBufferBinding(4, 'storage'),
      computeBufferBinding(7, 'uniform'),
      computeBufferBinding(8, 'read-only-storage'),
      computeBufferBinding(9, 'read-only-storage'),
      computeBufferBinding(10, 'storage')
    ]
  });
  const bindGroup = device.createBindGroup({
    label: `${slot.label}-species-diagnostic-bind-group`,
    layout: pipeline.bindGroupLayout,
    entries: [
      ...eosEntries,
      { binding: 7, resource: { buffer: slot.speciesDiagnosticParamsBuffer } },
      { binding: 8, resource: { buffer: slot.speciesDiagnosticClosureBuffer } },
      { binding: 9, resource: { buffer: productBuffer, offset: 0, size: productByteLength } },
      { binding: 10, resource: { buffer: slot.speciesDiagnosticRowsBuffer } }
    ]
  });
  const pass = encoder.beginComputePass({ label: `${slot.label}-species-diagnostic-pass` });
  pass.setPipeline(pipeline.pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(dispatch, 1, 1);
  pass.end();
  return Object.freeze({
    schema: ULG_SPH_SPATIAL_GAS_SPECIES_DIAGNOSTIC_SCHEMA,
    status: 'gpu-submitted-diagnostic-only',
    materialId: options.materialId,
    closureFingerprint: options.closureFingerprint,
    materialRecordCount: options.materialRecordCount,
    thermalSegmentCount: options.thermalSegmentCount,
    cellCapacity: slot.capacity,
    rowWords: SPH_SPATIAL_GAS_SPECIES_DIAGNOSTIC_ROW_WORDS,
    diagnosticOnly: true,
    authoritativeStateMutation: false,
    saturationModel: 'reduced-constant-latent-heat-carrier-inverse',
    scientificValidation: false,
    dispatchCount: 1,
    readbackPerformed: false
  });
}

export function decodeSphSpatialGasSpeciesDiagnosticPacket(buffer, record, cellIndex) {
  const words = new Uint32Array(buffer);
  const values = new Float32Array(buffer);
  if (words.length !== SPH_SPATIAL_GAS_SPECIES_DIAGNOSTIC_ROW_WORDS
    || words[0] !== SPH_SPATIAL_GAS_SPECIES_DIAGNOSTIC_MAGIC
    || words[1] !== SPH_SPATIAL_GAS_SPECIES_DIAGNOSTIC_VERSION
    || words[3] !== record.executionGeneration
    || words[4] !== record.storageGeneration
    || words[5] !== record.spatialGenerationId
    || words[6] !== record.gasControlVolumeDescriptor.seal
    || words[7] !== cellIndex || values[8] !== record.speciesDiagnostics.materialId) {
    throw new Error('Species diagnostic packet does not match its retained source identity');
  }
  return Object.freeze({
    ...record.speciesDiagnostics,
    status: 'observed-diagnostic-snapshot',
    statusFlags: words[2],
    partialPressureReady: (words[2]
      & SPH_SPATIAL_GAS_SPECIES_DIAGNOSTIC_STATUS.PARTIAL_PRESSURE_READY) !== 0,
    saturationReady: (words[2]
      & SPH_SPATIAL_GAS_SPECIES_DIAGNOSTIC_STATUS.SATURATION_READY) !== 0,
    executionGeneration: words[3],
    storageGeneration: words[4],
    spatialGenerationId: words[5],
    geometrySeal: words[6],
    cellIndex,
    speciesMoles: values[9],
    speciesMoleTemperatureK: values[10],
    speciesPartialPressurePa: values[11],
    totalCellPressurePa: values[12],
    freeVolumeM3: values[13],
    speciesTemperatureMinK: values[14],
    speciesTemperatureMaxK: values[15],
    cellTemperatureMinK: values[16],
    cellTemperatureMaxK: values[17],
    saturationPressurePa: values[18],
    supersaturationRatio: values[19],
    logSaturationOverReference: values[20],
    productSourceCount: words[21],
    particleSourceCount: words[22],
    rawWords: Object.freeze(Array.from(words)),
    readbackPerformed: true,
    readbackByteLength: ROW_BYTES,
    mapAsyncCount: 1,
    hostMaterializedRowCount: 0
  });
}
