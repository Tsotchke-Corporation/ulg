import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ULG_NATIVE_SURFACE_TEMPERATURE_COVERAGE_SCHEMA,
  ULG_NATIVE_SURFACE_TEMPERATURE_EXECUTION_SCHEMA,
  ULG_NATIVE_SURFACE_TEMPERATURE_LAYOUT_NAME,
  ULG_NATIVE_SURFACE_TEMPERATURE_PARAMS_BYTE_LENGTH,
  ULG_NATIVE_SURFACE_TEMPERATURE_ROWS_SCHEMA,
  ULG_NATIVE_SURFACE_TEMPERATURE_WGSL,
  createNativeSurfaceTemperatureParamsArray,
  encodeNativeSurfaceTemperatureRowsWebGpu
} from '../src/visualization/nativeSurfaceTemperatureWgsl.js';

function createMockCommandEncoder() {
  const calls = {
    beginComputePass: [],
    setPipeline: [],
    setBindGroup: [],
    dispatchWorkgroups: [],
    dispatchWorkgroupsIndirect: [],
    passEnd: 0,
    finish: 0
  };
  return {
    calls,
    beginComputePass(descriptor) {
      calls.beginComputePass.push(descriptor);
      return {
        setPipeline(pipeline) {
          calls.setPipeline.push(pipeline);
        },
        setBindGroup(index, bindGroup) {
          calls.setBindGroup.push({ index, bindGroup });
        },
        dispatchWorkgroups(x, y, z) {
          calls.dispatchWorkgroups.push([x, y, z]);
        },
        dispatchWorkgroupsIndirect(buffer, offset) {
          calls.dispatchWorkgroupsIndirect.push({ buffer, offset });
        },
        end() {
          calls.passEnd += 1;
        }
      };
    },
    finish() {
      calls.finish += 1;
      return { finished: true };
    }
  };
}

function createMockDevice() {
  const calls = {
    buffers: [],
    shaderModules: [],
    bindGroupLayouts: [],
    pipelineLayouts: [],
    computePipelines: [],
    bindGroups: [],
    queueSubmits: 0,
    queueWrites: 0,
    mapAsync: 0
  };
  const device = {
    calls,
    limits: {
      maxStorageBufferBindingSize: 1 << 24
    },
    queue: {
      submit() {
        calls.queueSubmits += 1;
      },
      writeBuffer(buffer, bufferOffset, data, dataOffset = 0, size) {
        calls.queueWrites += 1;
        const source = ArrayBuffer.isView(data)
          ? new Uint8Array(
              data.buffer,
              data.byteOffset + dataOffset,
              size ?? data.byteLength - dataOffset
            )
          : new Uint8Array(data, dataOffset, size ?? data.byteLength - dataOffset);
        new Uint8Array(buffer.storage, bufferOffset, source.byteLength).set(source);
      }
    },
    createBuffer(descriptor) {
      const storage = new ArrayBuffer(descriptor.size);
      const buffer = {
        ...descriptor,
        storage,
        destroyCount: 0,
        mapped: Boolean(descriptor.mappedAtCreation),
        getMappedRange() {
          assert.equal(buffer.mapped, true, 'only mapped-at-creation params are writable');
          return storage;
        },
        unmap() {
          buffer.mapped = false;
        },
        async mapAsync() {
          calls.mapAsync += 1;
        },
        destroy() {
          buffer.destroyCount += 1;
        }
      };
      calls.buffers.push(buffer);
      return buffer;
    },
    createShaderModule(descriptor) {
      const module = { descriptor };
      calls.shaderModules.push(module);
      return module;
    },
    createBindGroupLayout(descriptor) {
      const layout = { descriptor };
      calls.bindGroupLayouts.push(layout);
      return layout;
    },
    createPipelineLayout(descriptor) {
      const layout = { descriptor };
      calls.pipelineLayouts.push(layout);
      return layout;
    },
    createComputePipeline(descriptor) {
      const pipeline = { descriptor };
      calls.computePipelines.push(pipeline);
      return pipeline;
    },
    createBindGroup(descriptor) {
      const bindGroup = { descriptor };
      calls.bindGroups.push(bindGroup);
      return bindGroup;
    }
  };
  return device;
}

function sourceBuffer(size, label) {
  return { size, label };
}

function validFlatOptions(device = createMockDevice(), commandEncoder = createMockCommandEncoder()) {
  return {
    device,
    commandEncoder,
    compactPositionRowsBuffer: sourceBuffer(130 * 4 * 4, 'compact-positions'),
    compactPositionRowsBufferByteLength: 130 * 4 * 4,
    conservativeVertexRowCount: 130,
    compactPositionRowsStrideFloats: 4,
    actualVertexCounterBuffer: sourceBuffer(4, 'actual-vertex-counter'),
    actualVertexCounterBufferByteLength: 4,
    renderFieldScalarsBuffer: sourceBuffer(256 * 4, 'render-field'),
    renderFieldScalarsBufferByteLength: 256 * 4,
    fieldDimensions: [4, 3, 2],
    fieldStridesFloats: [8, 32, 96],
    fieldOffsetFloats: 1,
    surfaceGenerationId: 7,
    volumeGenerationId: 11,
    renderFieldVolumeGenerationId: 11
  };
}

test('native surface temperature WGSL preserves density-weighted eight-corner sampling', () => {
  assert.equal(
    ULG_NATIVE_SURFACE_TEMPERATURE_ROWS_SCHEMA,
    'peercompute.ulg.native-surface-temperature-rows.v0'
  );
  assert.equal(
    ULG_NATIVE_SURFACE_TEMPERATURE_LAYOUT_NAME,
    'peercompute.ulg.native-surface-temperature-f32-kelvin.v0'
  );
  assert.match(ULG_NATIVE_SURFACE_TEMPERATURE_WGSL, /DENSITY_LANE_OFFSET: u32 = 0u/);
  assert.match(ULG_NATIVE_SURFACE_TEMPERATURE_WGSL, /TEMPERATURE_LANE_OFFSET: u32 = 4u/);
  assert.match(
    ULG_NATIVE_SURFACE_TEMPERATURE_WGSL,
    /for \(var corner = 0u; corner < 8u; corner = corner \+ 1u\)/
  );
  assert.match(ULG_NATIVE_SURFACE_TEMPERATURE_WGSL, /let wx = select\(1\.0 - f\.x, f\.x/);
  assert.match(ULG_NATIVE_SURFACE_TEMPERATURE_WGSL, /let wy = select\(1\.0 - f\.y, f\.y/);
  assert.match(ULG_NATIVE_SURFACE_TEMPERATURE_WGSL, /let wz = select\(1\.0 - f\.z, f\.z/);
  assert.match(ULG_NATIVE_SURFACE_TEMPERATURE_WGSL, /let weight = wx \* wy \* wz \* sample\.density/);
  assert.match(
    ULG_NATIVE_SURFACE_TEMPERATURE_WGSL,
    /temperature_sum = temperature_sum \+ sample\.temperature_k \* weight/
  );
  assert.match(ULG_NATIVE_SURFACE_TEMPERATURE_WGSL, /weight_sum > 1\.0e-6/);
  assert.match(ULG_NATIVE_SURFACE_TEMPERATURE_WGSL, /temperature_rows_k: array<f32>/);
  assert.match(ULG_NATIVE_SURFACE_TEMPERATURE_WGSL, /fn plan_dispatch/);
  assert.match(
    ULG_NATIVE_SURFACE_TEMPERATURE_WGSL,
    /actual_vertex_counter\[0\],[\s\S]*?params\.conservative_vertex_row_count/
  );
  assert.match(ULG_NATIVE_SURFACE_TEMPERATURE_WGSL, /dispatch_args\[0\]/);
});

test('native surface temperature WGSL fails closed before borrowed-buffer reads', () => {
  assert.match(
    ULG_NATIVE_SURFACE_TEMPERATURE_WGSL,
    /row_index >= actual_vertex_row_count/
  );
  assert.match(
    ULG_NATIVE_SURFACE_TEMPERATURE_WGSL,
    /temperature_rows_k\[row_index\] = 0\.0;[\s\S]*?compact_position_rows\[position_offset \+ 0u\]/
  );
  assert.match(
    ULG_NATIVE_SURFACE_TEMPERATURE_WGSL,
    /TEMPERATURE_LANE_OFFSET >= params\.render_field_float_count - base/
  );
  assert.match(ULG_NATIVE_SURFACE_TEMPERATURE_WGSL, /finite_position\(grid_position\)/);
  assert.match(ULG_NATIVE_SURFACE_TEMPERATURE_WGSL, /sample\.valid == 0u[\s\S]*?return 0\.0/);
});

test('native surface temperature params describe exact source coverage', () => {
  const params = createNativeSurfaceTemperatureParamsArray({
    conservativeVertexRowCount: 130,
    compactPositionStrideFloats: 4,
    compactPositionFloatCount: 520,
    renderFieldFloatCount: 256,
    fieldDimensions: [4, 3, 2],
    fieldOffsetFloats: 1,
    fieldStridesFloats: [8, 32, 96]
  });
  assert.equal(params.byteLength, ULG_NATIVE_SURFACE_TEMPERATURE_PARAMS_BYTE_LENGTH);
  assert.deepEqual([...params.slice(0, 12)], [
    130, 4, 520, 256,
    4, 3, 2, 1,
    8, 32, 96, 65_535
  ]);
  assert.deepEqual([...params.slice(12)], [0, 0, 0, 0]);
});

test('temperature encoder dispatches on an external encoder with zero submits and durable coverage', () => {
  const device = createMockDevice();
  const firstEncoder = createMockCommandEncoder();
  const first = encodeNativeSurfaceTemperatureRowsWebGpu({
    device,
    commandEncoder: firstEncoder,
    compactPositions: {
      buffer: sourceBuffer(130 * 4 * 4, 'compact-positions'),
      byteLength: 130 * 4 * 4,
      rowCount: 130,
      strideFloats: 4,
      surfaceGenerationId: 7,
      volumeGenerationId: 11
    },
    actualVertexCounter: {
      buffer: sourceBuffer(4, 'actual-vertex-counter'),
      byteLength: 4
    },
    renderField: {
      buffer: sourceBuffer(256 * 4, 'render-field'),
      byteLength: 256 * 4,
      dims: [4, 3, 2],
      scalarStrides: [8, 32, 96],
      scalarOffsetFloats: 1,
      volumeGenerationId: 11
    }
  });

  assert.equal(first.schema, ULG_NATIVE_SURFACE_TEMPERATURE_EXECUTION_SCHEMA);
  assert.equal(first.temperatureRowsSchema, ULG_NATIVE_SURFACE_TEMPERATURE_ROWS_SCHEMA);
  assert.equal(first.pipelineCacheStatus, 'pipeline-cache-miss');
  assert.equal(first.temperatureRowsBufferByteLength, 130 * 4);
  assert.equal(first.temperatureRowsBufferRowCount, 130);
  assert.equal(first.temperatureRowsStrideFloats, 1);
  assert.equal(first.surfaceGenerationId, 7);
  assert.equal(first.volumeGenerationId, 11);
  assert.equal(first.additionalSubmitCount, 0);
  assert.equal(first.readbackPerformed, false);
  assert.equal(first.commandEncoderOwnership, 'caller-owned-external-command-encoder');
  assert.deepEqual(first.coverage, {
    schema: ULG_NATIVE_SURFACE_TEMPERATURE_COVERAGE_SCHEMA,
    status: 'gpu-counter-clamped-prefix-encoded-zero-initialized-tail',
    mode: 'gpu-counter-clamped-conservative-vertex-row-prefix',
    firstRow: 0,
    endRowExclusive: 130,
    rowCount: 130,
    conservativeVertexRowCount: 130,
    compactPositionRowCount: 130,
    encodedRowCountSource: 'gpu-actual-vertex-counter-clamped-to-conservative-capacity',
    unusedTailInitialization: 'webgpu-zero-initialized-fresh-output-buffer',
    outputStrideFloats: 1,
    outputByteLength: 520,
    surfaceGenerationId: 7,
    volumeGenerationId: 11,
    complete: true
  });
  assert.deepEqual(firstEncoder.calls.dispatchWorkgroups, [[1, undefined, undefined]]);
  assert.equal(firstEncoder.calls.dispatchWorkgroupsIndirect.length, 1);
  assert.equal(firstEncoder.calls.dispatchWorkgroupsIndirect[0].buffer, first.dispatchArgsBuffer);
  assert.equal(firstEncoder.calls.dispatchWorkgroupsIndirect[0].offset, 0);
  assert.equal(first.dispatchArgsBufferByteLength, 12);
  assert.equal(first.dispatchMode, 'dispatchWorkgroupsIndirect');
  assert.equal(first.workgroupCountX, null);
  assert.equal(first.workgroupCountXUpperBound, 3);
  assert.equal(first.workgroupCountYUpperBound, 1);
  assert.equal(first.commandPassCount, 2);
  assert.equal(firstEncoder.calls.passEnd, 2);
  assert.equal(firstEncoder.calls.finish, 0);
  assert.equal(device.calls.queueSubmits, 0);
  assert.equal(device.calls.queueWrites, 1);
  assert.equal(device.calls.mapAsync, 0);

  const params = new Uint32Array(first.paramsBuffer.storage);
  assert.deepEqual([...params.slice(0, 12)], [
    130, 4, 520, 256,
    4, 3, 2, 1,
    8, 32, 96, 65_535
  ]);

  const secondEncoder = createMockCommandEncoder();
  const second = encodeNativeSurfaceTemperatureRowsWebGpu({
    ...validFlatOptions(device, secondEncoder)
  });
  assert.equal(second.pipelineCacheStatus, 'pipeline-cache-hit');
  assert.equal(device.calls.shaderModules.length, 1);
  assert.equal(device.calls.computePipelines.length, 2);
  assert.equal(
    device.calls.computePipelines[0].descriptor.compute.module,
    device.calls.computePipelines[1].descriptor.compute.module
  );
  assert.deepEqual(secondEncoder.calls.dispatchWorkgroups, [[1, undefined, undefined]]);
  assert.equal(secondEncoder.calls.dispatchWorkgroupsIndirect.length, 1);
  assert.equal(device.calls.queueSubmits, 0);

  const firstOutput = first.temperatureRowsBuffer;
  const firstParams = first.paramsBuffer;
  const firstDispatchArgs = first.dispatchArgsBuffer;
  assert.equal(first.destroy(), true);
  assert.equal(first.destroyed, true);
  assert.equal(first.status, 'native-surface-temperature-resources-destroyed');
  assert.equal(first.destroy(), false);
  assert.equal(firstOutput.destroyCount, 1);
  assert.equal(firstParams.destroyCount, 1);
  assert.equal(firstDispatchArgs.destroyCount, 1);
  assert.equal(second.destroy(), true);
});

test('temperature encoder admits explicitly authored null dense-volume generations', () => {
  const device = createMockDevice();
  const commandEncoder = createMockCommandEncoder();
  const result = encodeNativeSurfaceTemperatureRowsWebGpu({
    device,
    commandEncoder,
    compactPositions: {
      buffer: sourceBuffer(3 * 4 * 4, 'dense-compact-positions'),
      byteLength: 3 * 4 * 4,
      rowCount: 3,
      strideFloats: 4,
      surfaceGenerationId: 9,
      volumeGenerationId: null
    },
    actualVertexCounter: {
      buffer: sourceBuffer(4, 'dense-actual-vertex-counter'),
      byteLength: 4
    },
    renderField: {
      buffer: sourceBuffer(8 * 4, 'dense-render-field'),
      byteLength: 8 * 4,
      dims: [1, 1, 1],
      scalarStrides: [8, 8, 8],
      scalarOffsetFloats: 0,
      volumeGenerationId: null
    },
    generation: {
      surfaceGenerationId: 9,
      volumeGenerationId: null
    }
  });
  assert.equal(result.surfaceGenerationId, 9);
  assert.equal(result.volumeGenerationId, null);
  assert.equal(result.coverage.volumeGenerationId, null);
  assert.equal(result.destroy(), true);
});

test('temperature encoder rejects incomplete or generation-ambiguous coverage before allocation', () => {
  const cases = [
    {
      name: 'missing external encoder',
      patch: { commandEncoder: null },
      error: /commandEncoder is required/
    },
    {
      name: 'zero conservative rows',
      patch: { conservativeVertexRowCount: 0 },
      error: /conservativeVertexRowCount must be positive/
    },
    {
      name: 'position row lacks xyz',
      patch: { compactPositionRowsStrideFloats: 2 },
      error: /must contain xyz/
    },
    {
      name: 'position buffer does not cover rows',
      patch: {
        compactPositionRowsBuffer: sourceBuffer(128, 'short-positions'),
        compactPositionRowsBufferByteLength: 128
      },
      error: /does not cover every conservative vertex row/
    },
    {
      name: 'missing GPU actual vertex counter',
      patch: { actualVertexCounterBuffer: null },
      error: /actualVertexCounterBuffer is required/
    },
    {
      name: 'zero field dimension',
      patch: { fieldDimensions: [4, 0, 2] },
      error: /fieldDimensions\[1\] must be positive/
    },
    {
      name: 'field cannot reach temperature lane',
      patch: {
        renderFieldScalarsBuffer: sourceBuffer(64, 'short-field'),
        renderFieldScalarsBufferByteLength: 64
      },
      error: /does not cover density lane 0 and temperature lane \+4/
    },
    {
      name: 'missing surface generation',
      patch: { surfaceGenerationId: null },
      error: /surfaceGenerationId must be explicitly authored/
    },
    {
      name: 'missing render-field volume generation',
      patch: { renderFieldVolumeGenerationId: undefined },
      error: /renderFieldVolumeGenerationId must be explicitly authored/
    },
    {
      name: 'generation descriptors disagree',
      patch: {
        generation: { surfaceGenerationId: 8, volumeGenerationId: 11 },
        compactPositions: { surfaceGenerationId: 7, volumeGenerationId: 11 }
      },
      error: /surfaceGenerationId metadata disagrees/
    },
    {
      name: 'compact-position descriptor omits volume generation',
      patch: {
        compactPositions: { surfaceGenerationId: 7 }
      },
      error: /compactPositions\.volumeGenerationId must be explicitly authored/
    },
    {
      name: 'render-field descriptor omits volume generation',
      patch: {
        renderField: {}
      },
      error: /renderField\.volumeGenerationId must be explicitly authored/
    },
    {
      name: 'generation descriptor omits volume generation',
      patch: {
        generation: { surfaceGenerationId: 7 }
      },
      error: /generation\.volumeGenerationId must be explicitly authored/
    },
    {
      name: 'render-field volume generation disagrees',
      patch: {
        renderField: { volumeGenerationId: 12 }
      },
      error: /volumeGenerationId metadata disagrees/
    },
    {
      name: 'null and numbered volume generations disagree',
      patch: {
        renderFieldVolumeGenerationId: null
      },
      error: /volumeGenerationId metadata disagrees/
    }
  ];

  for (const { name, patch, error } of cases) {
    const device = createMockDevice();
    const options = { ...validFlatOptions(device), ...patch };
    assert.throws(
      () => encodeNativeSurfaceTemperatureRowsWebGpu(options),
      error,
      name
    );
    assert.equal(device.calls.buffers.length, 0, `${name}: allocated before validation`);
    assert.equal(device.calls.shaderModules.length, 0, `${name}: compiled before validation`);
    assert.equal(device.calls.queueSubmits, 0, `${name}: submitted work`);
  }
});
