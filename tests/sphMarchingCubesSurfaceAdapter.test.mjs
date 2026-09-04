import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SPH_GPU_RENDER_FIELD_CELL_ROW_LAYOUT,
  SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_ROW_LAYOUT,
  SPH_GPU_RENDER_SURFACE_DRAW_ROW_LAYOUT,
  SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT,
  ULG_SPH_GPU_RENDER_FIELD_SCHEMA,
  ULG_SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_SCHEMA,
  ULG_SPH_GPU_RENDER_SURFACE_DRAW_SCHEMA,
  ULG_SPH_GPU_RENDER_SURFACE_VERTICES_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import {
  ULG_MARCHING_CUBES_EXTENSION_POSITION_VERTEX_FORMAT,
  ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_EXECUTION_SCHEMA,
  ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_PREFLIGHT_SCHEMA,
  ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_TRANSLATION_SCHEMA,
  WEBGPU_MARCHING_CUBES_SCALAR_BUFFER_LAYOUT_NAME,
  WEBGPU_MARCHING_CUBES_SCALAR_BUFFER_VOLUME_SOURCE,
  WEBGPU_MARCHING_CUBES_COMPACT_POSITION_ROWS_SCHEMA,
  WEBGPU_MARCHING_CUBES_NORMAL_BUFFER_DESCRIPTOR_SCHEMA,
  WEBGPU_MARCHING_CUBES_PACKED_NORMAL_ENCODING,
  WEBGPU_MARCHING_CUBES_PACKED_NORMAL_LAYOUT_NAME,
  WEBGPU_MARCHING_CUBES_PACKED_NORMAL_ROWS_SCHEMA,
  WEBGPU_MARCHING_CUBES_INDIRECT_DRAW_ROWS_SCHEMA,
  WEBGPU_MARCHING_CUBES_PREFLIGHT_SCHEMA,
  WEBGPU_MARCHING_CUBES_SURFACE_DRAW_ROWS_SCHEMA,
  WEBGPU_MARCHING_CUBES_SURFACE_EXECUTION_SCHEMA,
  WEBGPU_MARCHING_CUBES_SURFACE_OUTPUT_DESCRIPTOR_SCHEMA,
  WEBGPU_MARCHING_CUBES_SURFACE_ROW_METADATA_SCHEMA,
  WEBGPU_MARCHING_CUBES_SURFACE_SCHEMA,
  buildWebGpuMarchingCubesExtensionSurfaceRowsWebGpu,
  createUlgRenderFieldBufferVolumeDescriptor,
  createUlgWebGpuMarchingCubesExtensionAdapter,
  summarizeWebGpuMarchingCubesExtensionExecution,
  translateWebGpuMarchingCubesSurfaceToUlgRows,
  webGpuMarchingCubesExtensionCompactSurfaceDrawWgsl,
  webGpuMarchingCubesExtensionSurfaceRowsWgsl
} from '../src/runtime/sph/sphMarchingCubesSurfaceAdapter.js';

const GPU_BUFFER_USAGE_VERTEX = 32;

function extensionExecution({
  status = 'surface-ready',
  ok = true,
  vertexCount = 3,
  vertexStrideFloats = 4,
  vertexFormat = ULG_MARCHING_CUBES_EXTENSION_POSITION_VERTEX_FORMAT,
  bufferRetained = true,
  readback = false,
  resourceOwnershipStatus = 'same-device',
  includeRowMetadata = false,
  includeOutputDescriptors = false,
  topLevelBuffer = true,
  vertexCountMode = null,
  vertexRowsBudget = null,
  vertexRowsBudgetClamped = null,
  conservativeWorstCaseVertexCount = null,
  actualVertexCounterBuffer = null,
  actualVertexCounterBufferByteLength = 0,
  drawIndirectBuffer = null,
  drawIndirectBufferByteLength = drawIndirectBuffer?.size ?? 0,
  includePackedNormals = false,
  surfaceGenerationId = 7,
  volumeGenerationId = 42,
  normalSign = -1
} = {}) {
  const buffer = bufferRetained ? { label: 'surface-buffer', size: vertexCount * vertexStrideFloats * 4 } : null;
  const normalBuffer = includePackedNormals && bufferRetained
    ? { label: 'packed-normal-buffer', size: vertexCount * Uint32Array.BYTES_PER_ELEMENT }
    : null;
  const resourceOwnership = {
    ok: resourceOwnershipStatus !== 'cross-device-resource',
    status: resourceOwnershipStatus
  };
  const rowMetadata = includeRowMetadata ? {
    schema: WEBGPU_MARCHING_CUBES_SURFACE_ROW_METADATA_SCHEMA,
    status: buffer ? 'surface-position-rows-resident' : 'surface-position-rows-empty',
    readback: false,
    fullReadback: false,
    rowCount: vertexCount,
    triangleCount: vertexCount / 3,
    position: {
      schema: WEBGPU_MARCHING_CUBES_COMPACT_POSITION_ROWS_SCHEMA,
      family: 'position',
      status: buffer ? 'position-rows-resident' : 'position-rows-empty',
      available: Boolean(buffer),
      rowLayout: ['positionX:f32', 'positionY:f32', 'positionZ:f32', 'padding:f32'],
      rowStrideFloats: vertexStrideFloats,
      rowStrideBytes: vertexStrideFloats * Float32Array.BYTES_PER_ELEMENT,
      rowCount: vertexCount,
      buffer,
      bufferByteLength: vertexCount * vertexStrideFloats * 4,
      bufferRetained: Boolean(bufferRetained && buffer),
      resourceOwnership,
      readback: false
    },
    normal: includePackedNormals ? {
      schema: WEBGPU_MARCHING_CUBES_PACKED_NORMAL_ROWS_SCHEMA,
      status: 'normal-rows-resident',
      available: true,
      buffer: normalBuffer,
      bufferRetained: true,
      bufferByteLength: normalBuffer.size,
      rowCount: vertexCount,
      rowStrideBytes: Uint32Array.BYTES_PER_ELEMENT,
      layoutName: WEBGPU_MARCHING_CUBES_PACKED_NORMAL_LAYOUT_NAME,
      encoding: WEBGPU_MARCHING_CUBES_PACKED_NORMAL_ENCODING,
      semantic: 'oriented-scalar-gradient',
      sourceSemantic: 'scalar-gradient',
      normalSign,
      resourceOwnership,
      normalBufferDescriptor: {
        schema: WEBGPU_MARCHING_CUBES_NORMAL_BUFFER_DESCRIPTOR_SCHEMA,
        status: 'normal-rows-resident',
        available: true,
        buffer: normalBuffer,
        bufferRetained: true,
        bufferByteLength: normalBuffer.size,
        rowCount: vertexCount,
        rowStrideBytes: Uint32Array.BYTES_PER_ELEMENT,
        layoutName: WEBGPU_MARCHING_CUBES_PACKED_NORMAL_LAYOUT_NAME,
        rowSchema: WEBGPU_MARCHING_CUBES_PACKED_NORMAL_ROWS_SCHEMA,
        encoding: WEBGPU_MARCHING_CUBES_PACKED_NORMAL_ENCODING,
        semantic: 'oriented-scalar-gradient',
        sourceSemantic: 'scalar-gradient',
        normalSign,
        resourceOwnership,
        generation: {
          surfaceGenerationId,
          pairedPositionSurfaceGenerationId: surfaceGenerationId,
          volumeGenerationId,
          sameSubmitAsPosition: true
        },
        lifetime: {
          owner: 'surface-result',
          pairedWithPositionBuffer: true
        },
        producer: {
          stage: 'marchingCubesVertexEmit',
          timestampSpanLabel: 'marchingCubesVertexEmit',
          additionalSubmitCount: 0
        }
      }
    } : {
      status: 'normal-rows-not-produced',
      available: false
    },
    material: {
      status: 'material-rows-not-produced',
      available: false
    }
  } : null;
  const outputDescriptors = includeOutputDescriptors ? {
    schema: WEBGPU_MARCHING_CUBES_SURFACE_OUTPUT_DESCRIPTOR_SCHEMA,
    status: buffer ? 'surface-outputs-resident' : 'surface-outputs-empty',
    topology: 'triangle-list',
    readback: false,
    fullReadback: false,
    retainedBuffers: {
      position: buffer,
      normal: normalBuffer
    },
    rows: {
      position: {
        schema: WEBGPU_MARCHING_CUBES_COMPACT_POSITION_ROWS_SCHEMA,
        family: 'position',
        status: buffer ? 'position-rows-resident' : 'position-rows-empty',
        available: Boolean(buffer),
        layoutName: 'peercompute.webgpu-marching-cubes.layout.compact-position-f32x4.v0',
        rowLayout: ['positionX:f32', 'positionY:f32', 'positionZ:f32', 'padding:f32'],
        rowStrideFloats: vertexStrideFloats,
        rowStrideBytes: vertexStrideFloats * Float32Array.BYTES_PER_ELEMENT,
        rowCount: vertexCount,
        buffer,
        bufferByteLength: vertexCount * vertexStrideFloats * 4,
        bufferRetained: Boolean(bufferRetained && buffer),
        resourceOwnership,
        readback: false
      },
      normal: includePackedNormals ? rowMetadata.normal : {
        status: 'normal-rows-not-produced',
        available: false
      },
      material: {
        status: 'material-rows-not-produced',
        available: false
      },
      draw: {
        schema: WEBGPU_MARCHING_CUBES_SURFACE_DRAW_ROWS_SCHEMA,
        status: 'draw-rows-not-produced',
        available: false
      },
      indirect: {
        schema: WEBGPU_MARCHING_CUBES_INDIRECT_DRAW_ROWS_SCHEMA,
        status: 'indirect-draw-rows-not-produced',
        available: false
      }
    },
    materialPayload: {
      schema: 'peercompute.webgpu-marching-cubes.material-metadata.v0',
      available: true,
      payload: { materialId: 7 }
    },
    pbrPayload: {
      schema: 'peercompute.webgpu-marching-cubes.pbr-metadata.v0',
      available: true,
      payload: { roughnessFactor: 0.4 }
    }
  } : null;
  return {
    schema: WEBGPU_MARCHING_CUBES_SURFACE_EXECUTION_SCHEMA,
    adapterId: 'webgpu-marching-cubes',
    backend: 'webgpu',
    status,
    ok,
    ownsDevice: false,
    ownerDeviceId: 'gpu-device-1',
    readback,
    surfaceVertexReadback: readback,
    webgpuStatus: { status: ok ? 'executed' : 'blocked', reason: ok ? null : status },
    result: {
      schema: WEBGPU_MARCHING_CUBES_SURFACE_SCHEMA,
      status: ok ? 'surface-ready' : 'surface-device-check-failed',
      vertexCount,
      vertexCountMode,
      vertexRowsBudget,
      vertexRowsBudgetClamped,
      conservativeWorstCaseVertexCount,
      actualVertexCounterBuffer,
      actualVertexCounterBufferByteLength,
      drawIndirectBuffer,
      drawIndirectBufferByteLength,
      triangleCount: vertexCount / 3,
      vertexStrideFloats,
      vertexStrideBytes: vertexStrideFloats * Float32Array.BYTES_PER_ELEMENT,
      vertexFormat,
      buffer: topLevelBuffer ? buffer : null,
      bufferByteLength: vertexCount * vertexStrideFloats * 4,
      bufferRetained: topLevelBuffer ? bufferRetained : false,
      resourceOwnership: topLevelBuffer ? resourceOwnership : null,
      surfaceGenerationId,
      volumeGenerationId,
      normalBuffer,
      normalBufferByteLength: normalBuffer?.size ?? 0,
      normalEncoding: includePackedNormals ? WEBGPU_MARCHING_CUBES_PACKED_NORMAL_ENCODING : null,
      normalSemantic: includePackedNormals ? 'oriented-scalar-gradient' : null,
      normalSourceSemantic: includePackedNormals ? 'scalar-gradient' : null,
      normalSign,
      normalProducerStage: includePackedNormals ? 'marchingCubesVertexEmit' : null,
      normalTimestampSpanLabel: includePackedNormals ? 'marchingCubesVertexEmit' : null,
      normalAdditionalSubmitCount: includePackedNormals ? 0 : null,
      rowMetadata,
      outputDescriptors
    }
  };
}

function assertApprox(actual, expected, epsilon = 1e-6) {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `expected ${actual} to be within ${epsilon} of ${expected}`
  );
}

function fakeExtensionSurfaceDevice({
  failCreateBufferLabel = null,
  failCreateBindGroup = false,
  failWriteBufferLabel = null,
  failQueueSubmit = false,
  failSubmittedWorkDoneSync = false,
  failMapAsyncLabel = null
} = {}) {
  const shaderModules = [];
  const bindGroups = [];
  const dispatches = [];
  const copies = [];
  const createdBuffers = [];
  const queueWrites = [];
  const queueSubmissions = [];
  const device = {
    queue: {
      writeBuffer(buffer, offset, data) {
        if (buffer?.label === failWriteBufferLabel) {
          throw new Error(`injected writeBuffer failure: ${buffer.label}`);
        }
        queueWrites.push({ buffer, offset, byteLength: data?.byteLength ?? 0 });
      },
      submit(commands) {
        if (failQueueSubmit) {
          throw new Error('injected queue.submit failure');
        }
        queueSubmissions.push(commands);
        this.submitted = commands;
      },
      onSubmittedWorkDone() {
        if (failSubmittedWorkDoneSync) {
          throw new Error('injected onSubmittedWorkDone scheduling failure');
        }
        return Promise.resolve();
      }
    },
    createBuffer({ label, size, usage }) {
      if (label === failCreateBufferLabel) {
        throw new Error(`injected createBuffer failure: ${label}`);
      }
      const buffer = {
        label,
        size,
        usage,
        destroyed: false,
        async mapAsync() {
          if (label === failMapAsyncLabel) {
            throw new Error(`injected mapAsync failure: ${label}`);
          }
        },
        getMappedRange() {
          return new ArrayBuffer(size);
        },
        unmap() {
          this.unmapped = true;
        },
        destroy() {
          this.destroyed = true;
          this.destroyCount = (this.destroyCount ?? 0) + 1;
        }
      };
      createdBuffers.push(buffer);
      return buffer;
    },
    createShaderModule({ label, code }) {
      const module = { label, code };
      shaderModules.push(module);
      return module;
    },
    createComputePipeline({ label, layout, compute }) {
      return {
        label,
        layout,
        compute,
        getBindGroupLayout(index) {
          return { index, entryPoint: compute.entryPoint };
        }
      };
    },
    createBindGroup({ layout, entries }) {
      if (failCreateBindGroup) {
        throw new Error('injected createBindGroup failure');
      }
      const bindGroup = { layout, entries };
      bindGroups.push(bindGroup);
      return bindGroup;
    },
    createCommandEncoder() {
      return {
        beginComputePass() {
          return {
            setPipeline(pipeline) {
              this.pipeline = pipeline;
            },
            setBindGroup(index, bindGroup) {
              this.bindGroup = { index, bindGroup };
            },
            dispatchWorkgroups(count) {
              dispatches.push({ count, pipeline: this.pipeline, bindGroup: this.bindGroup?.bindGroup });
            },
            end() {
              this.ended = true;
            }
          };
        },
        copyBufferToBuffer(source, sourceOffset, destination, destinationOffset, size) {
          copies.push({ source, sourceOffset, destination, destinationOffset, size });
        },
        finish() {
          return { dispatches: [...dispatches], copies: [...copies] };
        }
      };
    }
  };
  return {
    device,
    shaderModules,
    bindGroups,
    dispatches,
    copies,
    createdBuffers,
    queueWrites,
    queueSubmissions
  };
}

test('ULG exposes retained render-field buffers as native MC scalar-buffer volumes', () => {
  const device = { label: 'ulg-render-device' };
  const scalarBuffer = {
    label: 'ulg-render-field-rows',
    size: Float32Array.BYTES_PER_ELEMENT * SPH_GPU_RENDER_FIELD_CELL_ROW_LAYOUT.length * 8 ** 3 * 2,
    device
  };
  const surfaceTable = {
    schema: ULG_SPH_GPU_RENDER_FIELD_SCHEMA,
    surfaceCount: 2,
    metadata: [
      {
        surfaceKey: 'h2o|h2o|liquid|domain:base',
        material: 'h2o',
        phase: 'liquid',
        renderKey: 'h2o',
        renderDomainId: 1,
        renderDomainKey: 'base',
        resolution: 8,
        fieldOffset: 0,
        fieldCellCount: 8 ** 3,
        isolation: 14
      },
      {
        surfaceKey: 'h2o|h2o|liquid|domain:drop',
        material: 'h2o',
        phase: 'liquid',
        renderKey: 'h2o',
        renderDomainId: 2,
        renderDomainKey: 'drop',
        resolution: 8,
        fieldOffset: 8 ** 3,
        fieldCellCount: 8 ** 3,
        isolation: 14
      }
    ]
  };
  const renderField = {
    schema: ULG_SPH_GPU_RENDER_FIELD_SCHEMA,
    backend: 'webgpu',
    surfaceTable,
    surfaceCount: 2,
    rowLayout: [...SPH_GPU_RENDER_FIELD_CELL_ROW_LAYOUT],
    rowStrideFloats: SPH_GPU_RENDER_FIELD_CELL_ROW_LAYOUT.length,
    totalFieldCells: 8 ** 3 * 2,
    fieldRowsBufferRetained: true,
    fieldRowsBuffer: scalarBuffer,
    fieldRowsBufferByteLength: scalarBuffer.size,
    fieldPadding: 0.22,
    refEdgeM: 5
  };

  const descriptor = createUlgRenderFieldBufferVolumeDescriptor({
    device,
    renderField,
    surfaceIndex: 1
  });

  assert.equal(descriptor.ok, true);
  assert.equal(descriptor.status, 'ulg-render-field-buffer-volume-descriptor-ready');
  assert.equal(descriptor.extensionDescriptorFactory, 'createBufferVolumeDescriptor');
  assert.equal(descriptor.sourceType, WEBGPU_MARCHING_CUBES_SCALAR_BUFFER_VOLUME_SOURCE);
  assert.equal(descriptor.scalarLayoutName, WEBGPU_MARCHING_CUBES_SCALAR_BUFFER_LAYOUT_NAME);
  assert.equal(descriptor.scalarBuffer, scalarBuffer);
  assert.equal(descriptor.storageBuffer, scalarBuffer);
  assert.equal(descriptor.buffer, scalarBuffer);
  assert.deepEqual(descriptor.dims, [8, 8, 8]);
  assert.deepEqual(descriptor.scalarStrides, [8, 64, 512]);
  assert.equal(descriptor.scalarOffset, 8 ** 3 * 8);
  assert.equal(descriptor.scalarOffsetBytes, 8 ** 3 * 8 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(descriptor.scalarLane, 'density');
  assert.equal(descriptor.scalarLaneIndex, 0);
  assert.equal(descriptor.rowStrideFloats, 64);
  assert.equal(descriptor.sliceStrideFloats, 512);
  assert.equal(descriptor.cellRowStrideFloats, 8);
  assert.equal(descriptor.positionTransformStatus, 'ulg-render-field-grid-to-world-transform-ready');
  assert.equal(descriptor.positionTransform.enabled, true);
  assert.equal(descriptor.positionTransform.resolution, 8);
  assert.equal(descriptor.positionTransform.gridBias, -0.5);
  assertApprox(descriptor.positionTransform.scaleM, 5 / ((1 - 2 * 0.22) * 8));
  assert.deepEqual(descriptor.positionTransform.originM, [
    -0.22 * 5 / (1 - 2 * 0.22),
    -0.22 * 5 / (1 - 2 * 0.22),
    -0.22 * 5 / (1 - 2 * 0.22)
  ]);
  assert.equal(descriptor.isovalue, 14);
  assert.equal(descriptor.surfaceExtractionIsovalueSource, 'render-field-surface-isolation');
  assert.equal(descriptor.surfaceExtractionPolicyApplied, false);
  assert.equal(
    descriptor.surfaceExtractionPolicyApplicationStatus,
    'algorithm-surface-policy-not-applied-render-field-isolation-authoritative'
  );
  assert.equal(descriptor.surfaceExtractionPolicyStatus, 'algorithm-surface-policy-rows-not-supplied');
  assert.equal(descriptor.sameDeviceStatus, 'same-device');
  assert.equal(descriptor.nativeConsumerKind, 'native-webgpu-marching-cubes-buffer-volume');
  assert.equal(descriptor.nativeRequiredAdapter, 'webgpu-marching-cubes.buffer-volume.v0');

  const policyDescriptor = createUlgRenderFieldBufferVolumeDescriptor({
    device,
    renderField,
    surfaceIndex: 1,
    algorithmMaterialSurfaceExtractionRows: {
      schema: 'peercompute.ulg.algorithm-material-surface-extraction-rows.v0',
      status: 'algorithm-derived-surface-extraction-rows-ready',
      rowCount: 2,
      rows: [
        {
          schema: 'peercompute.ulg.algorithm-material-surface-extraction-row.v0',
          role: 'base',
          material: 'h2o',
          phase: 'liquid',
          isovalue: 0.65,
          isovaluePolicy: 'density-kernel-half-occupancy',
          smoothingRadiusM: 0.3,
          voxelSizeM: 0.15,
          normalScaleM: 0.3,
          strictSourceOfTruth: false,
          rendererAuthority: 'not-renderer-authoritative-surface-policy-row'
        },
        {
          schema: 'peercompute.ulg.algorithm-material-surface-extraction-row.v0',
          role: 'drop',
          material: 'h2o',
          phase: 'liquid',
          isovalue: 0.5,
          isovaluePolicy: 'density-kernel-half-occupancy',
          smoothingRadiusM: 0.2,
          voxelSizeM: 0.1,
          normalScaleM: 0.2,
          strictSourceOfTruth: false,
          rendererAuthority: 'not-renderer-authoritative-surface-policy-row'
        }
      ]
    }
  });
  assert.equal(policyDescriptor.ok, true);
  assert.equal(policyDescriptor.isovalue, 14);
  assert.equal(policyDescriptor.isolation, 14);
  assert.equal(policyDescriptor.surfaceExtractionIsovalueSource, 'render-field-surface-isolation');
  assert.equal(policyDescriptor.surfaceExtractionPolicyApplied, false);
  assert.equal(
    policyDescriptor.surfaceExtractionPolicyApplicationStatus,
    'algorithm-surface-policy-not-applied-render-field-isolation-authoritative'
  );
  assert.equal(policyDescriptor.surfaceExtractionPolicyRequestedIsovalue, 0.5);
  assert.equal(
    policyDescriptor.surfaceExtractionPolicyRendererAuthority,
    'not-renderer-authoritative-surface-policy-row'
  );
  assert.equal(policyDescriptor.surfaceExtractionPolicyStrictSourceOfTruth, false);
  assert.equal(policyDescriptor.surfaceExtractionPolicyStatus, 'algorithm-surface-policy-row-selected');
  assert.equal(policyDescriptor.surfaceExtractionPolicyRole, 'drop');
  assert.equal(policyDescriptor.surfaceExtractionPolicyIsovaluePolicy, 'density-kernel-half-occupancy');
  assert.equal(policyDescriptor.surfaceExtractionPolicySmoothingRadiusM, 0.2);

  const incompatibleRoleDescriptor = createUlgRenderFieldBufferVolumeDescriptor({
    device,
    renderField,
    surfaceIndex: 1,
    surface: {
      ...surfaceTable.metadata[1],
      material: 'naoh',
      renderKey: 'naoh'
    },
    algorithmMaterialSurfaceExtractionRows: {
      schema: 'peercompute.ulg.algorithm-material-surface-extraction-rows.v0',
      status: 'algorithm-derived-surface-extraction-rows-ready',
      rowCount: 1,
      rows: [{
        schema: 'peercompute.ulg.algorithm-material-surface-extraction-row.v0',
        role: 'drop',
        material: 'Na',
        phase: 'solid',
        isovalue: 0.5,
        strictSourceOfTruth: false,
        rendererAuthority: 'not-renderer-authoritative-surface-policy-row'
      }]
    }
  });
  assert.equal(incompatibleRoleDescriptor.ok, true);
  assert.equal(incompatibleRoleDescriptor.isovalue, 14);
  assert.equal(
    incompatibleRoleDescriptor.surfaceExtractionPolicyStatus,
    'algorithm-surface-policy-row-not-found'
  );
  assert.equal(incompatibleRoleDescriptor.surfaceExtractionPolicyRequestedIsovalue, null);

  const wrongRoleDescriptor = createUlgRenderFieldBufferVolumeDescriptor({
    device,
    renderField,
    surfaceIndex: 1,
    algorithmMaterialSurfaceExtractionRows: {
      schema: 'peercompute.ulg.algorithm-material-surface-extraction-rows.v0',
      status: 'algorithm-derived-surface-extraction-rows-ready',
      rowCount: 1,
      rows: [{
        schema: 'peercompute.ulg.algorithm-material-surface-extraction-row.v0',
        role: 'base',
        material: 'h2o',
        phase: 'liquid',
        isovalue: 0.5,
        strictSourceOfTruth: false,
        rendererAuthority: 'not-renderer-authoritative-surface-policy-row'
      }]
    }
  });
  assert.equal(wrongRoleDescriptor.ok, true);
  assert.equal(wrongRoleDescriptor.isovalue, 14);
  assert.equal(wrongRoleDescriptor.surfaceExtractionPolicyStatus, 'algorithm-surface-policy-row-not-found');
  assert.equal(wrongRoleDescriptor.surfaceExtractionPolicyRole, null);

  const missingIsolationDescriptor = createUlgRenderFieldBufferVolumeDescriptor({
    device,
    renderField,
    surfaceIndex: 1,
    surface: {
      ...surfaceTable.metadata[1],
      isolation: null
    },
    algorithmMaterialSurfaceExtractionRows: {
      schema: 'peercompute.ulg.algorithm-material-surface-extraction-rows.v0',
      status: 'algorithm-derived-surface-extraction-rows-ready',
      rowCount: 1,
      rows: [{
        schema: 'peercompute.ulg.algorithm-material-surface-extraction-row.v0',
        role: 'drop',
        material: 'h2o',
        phase: 'liquid',
        isovalue: 0.5,
        strictSourceOfTruth: false,
        rendererAuthority: 'not-renderer-authoritative-surface-policy-row'
      }]
    }
  });
  assert.equal(missingIsolationDescriptor.ok, false);
  assert.equal(
    missingIsolationDescriptor.status,
    'ulg-render-field-buffer-volume-blocked-missing-isolation'
  );
  assert.equal(missingIsolationDescriptor.surfaceExtractionPolicyApplied, false);
  assert.equal(missingIsolationDescriptor.surfaceExtractionPolicyRequestedIsovalue, 0.5);
  assert.equal(
    missingIsolationDescriptor.surfaceExtractionPolicyApplicationStatus,
    'algorithm-surface-policy-not-applied-render-field-isolation-required'
  );

  const tooSmall = createUlgRenderFieldBufferVolumeDescriptor({
    device,
    renderField: {
      ...renderField,
      fieldRowsBuffer: { label: 'small-field', size: 16, device },
      fieldRowsBufferByteLength: 16
    },
    surfaceIndex: 1
  });
  assert.equal(tooSmall.ok, false);
  assert.equal(tooSmall.status, 'ulg-render-field-buffer-volume-blocked-undersized-buffer');
  assert.equal(tooSmall.scalarRequiredByteLength > tooSmall.scalarBufferByteLength, true);

  const crossDevice = createUlgRenderFieldBufferVolumeDescriptor({
    device,
    renderField: {
      ...renderField,
      fieldRowsBuffer: {
        label: 'other-device-field',
        size: scalarBuffer.size,
        device: { label: 'other-device' }
      }
    },
    surfaceIndex: 0
  });
  assert.equal(crossDevice.ok, false);
  assert.equal(crossDevice.status, 'ulg-render-field-buffer-volume-blocked-cross-device');
  assert.equal(crossDevice.sameDeviceStatus, 'cross-device-resource');
});

test('ULG summarizes extension compact position buffers as translation-ready but not direct row-compatible', () => {
  const summary = summarizeWebGpuMarchingCubesExtensionExecution(extensionExecution({
    vertexRowsBudget: 12000,
    vertexRowsBudgetClamped: true,
    conservativeWorstCaseVertexCount: 48000
  }));

  assert.equal(summary.schema, ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_EXECUTION_SCHEMA);
  assert.equal(summary.status, 'extension-surface-ready-needs-ulg-row-translation');
  assert.equal(summary.extensionExecutionSchema, WEBGPU_MARCHING_CUBES_SURFACE_EXECUTION_SCHEMA);
  assert.equal(summary.extensionSurfaceSchema, WEBGPU_MARCHING_CUBES_SURFACE_SCHEMA);
  assert.equal(summary.extensionVertexFormat, ULG_MARCHING_CUBES_EXTENSION_POSITION_VERTEX_FORMAT);
  assert.equal(summary.extensionVertexStrideFloats, 4);
  assert.equal(summary.extensionVertexCount, 3);
  assert.equal(summary.extensionVertexRowsBudget, 12000);
  assert.equal(summary.extensionVertexRowsBudgetClamped, true);
  assert.equal(summary.extensionConservativeWorstCaseVertexCount, 48000);
  assert.equal(summary.readyForUlgSurfaceVertexRows, false);
  assert.equal(summary.requiresUlgVertexRowTranslation, true);
  assert.equal(summary.requiresUlgDrawMetadata, true);
  assert.equal(summary.hotLoopSafe, true);
  assert.equal(summary.surfaceVertexSchema, ULG_SPH_GPU_RENDER_SURFACE_VERTICES_SCHEMA);
  assert.equal(summary.surfaceVertexRowStrideFloats, SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT.length);
  assert.deepEqual(summary.surfaceDrawRowLayout, [...SPH_GPU_RENDER_SURFACE_DRAW_ROW_LAYOUT]);
  assert.equal(summary.surfaceDrawSchema, ULG_SPH_GPU_RENDER_SURFACE_DRAW_SCHEMA);
  assert.deepEqual(summary.surfaceDrawIndirectRowLayout, [...SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_ROW_LAYOUT]);
  assert.equal(summary.surfaceDrawIndirectSchema, ULG_SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_SCHEMA);
});

test('ULG consumes extension compact position row metadata without legacy top-level buffers', async () => {
  const { device, bindGroups } = fakeExtensionSurfaceDevice();
  const execution = extensionExecution({
    includeRowMetadata: true,
    topLevelBuffer: false,
    vertexCount: 3
  });
  const rowBuffer = execution.result.rowMetadata.position.buffer;
  const summary = summarizeWebGpuMarchingCubesExtensionExecution(execution);

  assert.equal(summary.status, 'extension-surface-ready-needs-ulg-row-translation');
  assert.equal(summary.extensionBufferRetained, true);
  assert.equal(summary.extensionBufferByteLength, rowBuffer.size);
  assert.equal(summary.extensionRowMetadataSchema, WEBGPU_MARCHING_CUBES_SURFACE_ROW_METADATA_SCHEMA);
  assert.equal(summary.extensionPositionRowsSchema, WEBGPU_MARCHING_CUBES_COMPACT_POSITION_ROWS_SCHEMA);
  assert.equal(summary.extensionPositionRowsStatus, 'position-rows-resident');
  assert.equal(summary.extensionPositionRowsAvailable, true);
  assert.equal(summary.extensionPositionRowsReadback, false);
  assert.equal(summary.extensionNormalRowsStatus, 'normal-rows-not-produced');
  assert.equal(summary.extensionMaterialRowsStatus, 'material-rows-not-produced');
  assert.equal(summary.hotLoopSafe, true);

  const translated = await buildWebGpuMarchingCubesExtensionSurfaceRowsWebGpu({
    device,
    extensionExecution: execution,
    readbackMode: 'no-full-readback'
  });

  assert.equal(translated.status, 'extension-surface-translated-resident-webgpu');
  assert.equal(bindGroups[0].entries[0].resource.buffer, rowBuffer);
});

test('ULG consumes extension output descriptors without row metadata or legacy top-level buffers', async () => {
  const { device, bindGroups, createdBuffers } = fakeExtensionSurfaceDevice();
  const execution = extensionExecution({
    includeOutputDescriptors: true,
    includeRowMetadata: false,
    topLevelBuffer: false,
    vertexCount: 3
  });
  const descriptorBuffer = execution.result.outputDescriptors.rows.position.buffer;
  const summary = summarizeWebGpuMarchingCubesExtensionExecution(execution);

  assert.equal(summary.status, 'extension-surface-ready-needs-ulg-row-translation');
  assert.equal(summary.extensionBufferRetained, true);
  assert.equal(summary.extensionBufferByteLength, descriptorBuffer.size);
  assert.equal(summary.extensionOutputDescriptorSchema, WEBGPU_MARCHING_CUBES_SURFACE_OUTPUT_DESCRIPTOR_SCHEMA);
  assert.equal(summary.extensionOutputDescriptorStatus, 'surface-outputs-resident');
  assert.equal(summary.extensionOutputDescriptorTopology, 'triangle-list');
  assert.equal(summary.extensionRowMetadataSchema, null);
  assert.equal(summary.extensionPositionRowsSchema, WEBGPU_MARCHING_CUBES_COMPACT_POSITION_ROWS_SCHEMA);
  assert.equal(summary.extensionPositionRowsStatus, 'position-rows-resident');
  assert.equal(summary.extensionPositionRowsAvailable, true);
  assert.equal(summary.extensionPositionRowsLayoutName, 'peercompute.webgpu-marching-cubes.layout.compact-position-f32x4.v0');
  assert.equal(summary.extensionDrawRowsStatus, 'draw-rows-not-produced');
  assert.equal(summary.extensionDrawRowsAvailable, false);
  assert.equal(summary.extensionIndirectDrawRowsStatus, 'indirect-draw-rows-not-produced');
  assert.equal(summary.extensionIndirectDrawRowsAvailable, false);
  assert.equal(summary.extensionMaterialMetadataAvailable, true);
  assert.equal(summary.extensionPbrMetadataAvailable, true);
  assert.equal(summary.hotLoopSafe, true);

  const translated = await buildWebGpuMarchingCubesExtensionSurfaceRowsWebGpu({
    device,
    extensionExecution: execution,
    positionTransformResolution: 8,
    fieldPadding: 0.22,
    refEdgeM: 5,
    readbackMode: 'no-full-readback'
  });

  assert.equal(translated.status, 'extension-surface-translated-resident-webgpu');
  assert.equal(translated.positionTransformStatus, 'ulg-render-field-grid-to-world-transform-ready');
  assert.equal(translated.surfaceVertices.positionTransformStatus, 'ulg-render-field-grid-to-world-transform-ready');
  assert.equal(translated.surfaceDraw.positionTransformStatus, 'ulg-render-field-grid-to-world-transform-ready');
  assert.equal(createdBuffers.find((buffer) => buffer.label === 'ulg-sph-extension-surface-translation-params')?.size, 160);
  assert.equal(bindGroups[0].entries[0].resource.buffer, descriptorBuffer);
});

test('ULG GPU builder binds extension retained vertex counter for conservative outputs', async () => {
  const { device, bindGroups, createdBuffers } = fakeExtensionSurfaceDevice();
  const actualVertexCounterBuffer = { label: 'extension-actual-vertex-counter', size: 4 };
  const execution = extensionExecution({
    vertexCount: 45,
    vertexCountMode: 'conservative-upper-bound',
    actualVertexCounterBuffer,
    actualVertexCounterBufferByteLength: 4
  });
  const summary = summarizeWebGpuMarchingCubesExtensionExecution(execution);

  assert.equal(summary.extensionVertexCountMode, 'conservative-upper-bound');
  assert.equal(summary.extensionActualVertexCounterBufferRetained, true);

  const translated = await buildWebGpuMarchingCubesExtensionSurfaceRowsWebGpu({
    device,
    extensionExecution: execution,
    readbackMode: 'no-full-readback'
  });

  assert.equal(translated.status, 'extension-surface-translated-resident-webgpu');
  assert.equal(translated.surfaceVertices.vertexCountMode, 'conservative-upper-bound');
  assert.equal(translated.surfaceVertices.sourceVertexCounterMode, 'extension-gpu-vertex-counter');
  assert.equal(translated.surfaceVertices.sourceVertexCounterBufferBound, true);
  assert.equal(translated.surfaceVertices.sourceVertexCounterBufferRetained, true);
  assert.equal(translated.surfaceDraw.vertexCountMode, 'conservative-upper-bound');
  assert.equal(translated.surfaceDraw.sourceVertexCounterMode, 'extension-gpu-vertex-counter');
  assert.equal(translated.surfaceDraw.sourceVertexCounterBufferBound, true);
  assert.equal(translated.surfaceDraw.sourceVertexCounterBufferRetained, true);
  assert.equal(bindGroups[0].entries[5].resource.buffer, actualVertexCounterBuffer);
  assert.equal(createdBuffers.some((buffer) => buffer.label === 'ulg-sph-extension-surface-source-vertex-count'), false);
});

test('ULG wrapper preserves caller-owned device and adapter swapability', async () => {
  const device = { label: 'scene-device' };
  const volume = { label: 'resident-render-field-volume' };
  let factoryCalled = 0;
  let preflightCalled = 0;
  const wrapper = createUlgWebGpuMarchingCubesExtensionAdapter({
    device,
    volume,
    adapterFactory({ device: receivedDevice, volume: receivedVolume }) {
      factoryCalled += 1;
      assert.equal(receivedDevice, device);
      assert.equal(receivedVolume, volume);
      return {
        schema: 'peercompute.webgpu-marching-cubes.surface-adapter.v0',
        preflight(request) {
          preflightCalled += 1;
          assert.equal(request.volume, volume);
          assert.equal(request.isovalue, 0.5);
          return {
            schema: WEBGPU_MARCHING_CUBES_PREFLIGHT_SCHEMA,
            ok: true,
            status: 'ready',
            deviceChecks: [{ ok: true, status: 'same-device', label: 'volume.device' }]
          };
        },
        async extractSurface(request) {
          assert.equal(request.volume, volume);
          assert.equal(request.isovalue, 0.5);
          return extensionExecution();
        }
      };
    }
  });

  assert.equal(wrapper.ownsDevice, false);
  const execution = await wrapper.extractSurface({ isovalue: 0.5 });

  assert.equal(factoryCalled, 1);
  assert.equal(preflightCalled, 1);
  assert.equal(execution.schema, ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_EXECUTION_SCHEMA);
  assert.equal(execution.status, 'extension-surface-ready-needs-ulg-row-translation');
  assert.equal(execution.ownsDevice, false);
  assert.equal(execution.preflight.schema, ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_PREFLIGHT_SCHEMA);
  assert.equal(execution.preflight.status, 'extension-preflight-ready');
  assert.equal(execution.preflight.extensionPreflightSchema, WEBGPU_MARCHING_CUBES_PREFLIGHT_SCHEMA);
  assert.equal(execution.extensionAdapterSchema, 'peercompute.webgpu-marching-cubes.surface-adapter.v0');
  assert.equal(execution.readyForUlgSurfaceVertexRows, false);
  assert.equal(execution.requiresUlgVertexRowTranslation, true);
  assert.equal(execution.hotLoopSafe, true);
});

test('ULG wrapper stops extraction when extension preflight blocks', async () => {
  let extractCalled = false;
  const wrapper = createUlgWebGpuMarchingCubesExtensionAdapter({
    device: { label: 'expected-device' },
    volume: { label: 'foreign-volume' },
    adapter: {
      schema: 'peercompute.webgpu-marching-cubes.surface-adapter.v0',
      preflight() {
        return {
          schema: WEBGPU_MARCHING_CUBES_PREFLIGHT_SCHEMA,
          ok: false,
          status: 'preflight-check-failed',
          deviceChecks: [
            { ok: false, status: 'cross-device-volume', label: 'volume.device' }
          ]
        };
      },
      async extractSurface() {
        extractCalled = true;
        return extensionExecution();
      }
    }
  });

  const execution = await wrapper.extractSurface({ isovalue: 0.25 });

  assert.equal(extractCalled, false);
  assert.equal(execution.schema, ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_EXECUTION_SCHEMA);
  assert.equal(execution.status, 'extension-surface-preflight-blocked');
  assert.equal(execution.reason, 'preflight-check-failed');
  assert.equal(execution.preflight.schema, ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_PREFLIGHT_SCHEMA);
  assert.equal(execution.preflight.status, 'extension-preflight-blocked');
  assert.equal(execution.preflight.deviceChecks[0].status, 'cross-device-volume');
  assert.equal(execution.readyForUlgSurfaceVertexRows, false);
  assert.equal(execution.hotLoopSafe, false);
});

test('ULG wrapper propagates extension same-device blockers before renderer integration', async () => {
  const wrapper = createUlgWebGpuMarchingCubesExtensionAdapter({
    device: { label: 'expected-device' },
    volume: { label: 'foreign-volume' },
    adapter: {
      schema: 'peercompute.webgpu-marching-cubes.surface-adapter.v0',
      async extractSurface() {
        return {
          ...extensionExecution({ ok: false, status: 'same-device-check-failed', vertexCount: 0, bufferRetained: false }),
          status: 'same-device-check-failed',
          deviceChecks: [
            { ok: false, status: 'cross-device-volume', label: 'volume.device' }
          ],
          result: {
            schema: WEBGPU_MARCHING_CUBES_SURFACE_SCHEMA,
            status: 'surface-device-check-failed',
            reason: 'cross-device-volume',
            vertexCount: 0,
            triangleCount: 0,
            vertexStrideFloats: 4,
            vertexStrideBytes: 16,
            vertexFormat: ULG_MARCHING_CUBES_EXTENSION_POSITION_VERTEX_FORMAT,
            buffer: null,
            bufferRetained: false,
            resourceOwnership: null
          }
        };
      }
    }
  });

  const execution = await wrapper.extractSurface({ isovalue: 0.25 });

  assert.equal(execution.status, 'extension-surface-same-device-check-failed');
  assert.equal(execution.readyForUlgSurfaceVertexRows, false);
  assert.equal(execution.requiresUlgVertexRowTranslation, true);
  assert.equal(execution.hotLoopSafe, false);
  assert.equal(execution.summary.reason, 'same-device-check-failed');
});

test('ULG wrapper forwards extension adapter error diagnostics', async () => {
  const nativeError = {
    name: 'OperationError',
    status: 'error',
    stage: 'native-engine-extract-surface',
    message: 'A valid external Instance reference no longer exists.',
    stack: 'OperationError: A valid external Instance reference no longer exists.'
  };
  const wrapper = createUlgWebGpuMarchingCubesExtensionAdapter({
    device: { label: 'expected-device' },
    volume: { label: 'resident-volume' },
    adapter: {
      schema: 'peercompute.webgpu-marching-cubes.surface-adapter.v0',
      async extractSurface() {
        return {
          ...extensionExecution({ ok: false, status: 'surface-error', vertexCount: 0, bufferRetained: false }),
          status: 'surface-error',
          webgpuStatus: {
            status: 'error',
            reason: nativeError.message,
            error: nativeError
          },
          errors: [nativeError]
        };
      }
    }
  });

  const execution = await wrapper.extractSurface({ isovalue: 0.25 });

  assert.equal(execution.status, 'extension-surface-execution-blocked');
  assert.equal(execution.reason, nativeError.message);
  assert.equal(execution.errors[0], nativeError);
  assert.equal(execution.errorName, 'OperationError');
  assert.equal(execution.errorStatus, 'error');
  assert.equal(execution.errorStage, 'native-engine-extract-surface');
  assert.equal(execution.summary.extensionErrorStack, nativeError.stack);
});

test('ULG translates extension compact position rows into native surface vertices and draw metadata', () => {
  const translation = translateWebGpuMarchingCubesSurfaceToUlgRows({
    extensionExecution: extensionExecution(),
    positionRows: new Float32Array([
      0, 0, 0, 1,
      1, 0, 0, 1,
      0, 1, 0, 1
    ]),
    surfaceIndex: 2,
    materialId: 42,
    phaseId: 3,
    opticalStateId: 7,
    material: 'h2o',
    phase: 'liquid',
    density: 1000,
    isolation: 0.5,
    sourceVoxelLinearIndex: 11,
    transparencyClassId: 4,
    depthWriteFlag: 1,
    renderOrder: 9
  });

  assert.equal(translation.schema, ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_TRANSLATION_SCHEMA);
  assert.equal(translation.status, 'extension-surface-translated-to-ulg-rows');
  assert.equal(translation.hotLoopGpuTranslationRequired, false);
  assert.equal(translation.sourceVertexCount, 3);
  assert.equal(translation.translatedVertexCount, 3);
  assert.equal(translation.ignoredTrailingVertexCount, 0);

  const vertices = translation.surfaceVertices;
  assert.equal(vertices.schema, ULG_SPH_GPU_RENDER_SURFACE_VERTICES_SCHEMA);
  assert.equal(vertices.status, 'surface-vertices-ready');
  assert.equal(vertices.vertexCount, 3);
  assert.equal(vertices.triangleCount, 1);
  assert.deepEqual(vertices.rowLayout, [...SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT]);
  assert.equal(vertices.rowStrideFloats, SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT.length);
  assert.equal(vertices.surfaceVertexReadback, true);
  assert.equal(vertices.surfaces.length, 1);
  assert.equal(vertices.surfaces[0].surfaceIndex, 2);
  assert.equal(vertices.surfaces[0].material, 'h2o');
  assert.equal(vertices.surfaces[0].phase, 'liquid');

  const rowStride = SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT.length;
  const firstVertex = [...vertices.vertexRows.slice(0, rowStride)];
  assert.deepEqual(firstVertex.slice(0, 8), [
    2,
    42,
    3,
    0,
    0,
    0,
    0,
    0
  ]);
  assert.deepEqual(firstVertex.slice(8, 16), [
    0,
    0,
    1,
    7,
    1000,
    0.5,
    11,
    1
  ]);
  assert.deepEqual([...vertices.vertexRows.slice(rowStride + 5, rowStride + 8)], [1, 0, 0]);
  assert.deepEqual([...vertices.vertexRows.slice(rowStride * 2 + 5, rowStride * 2 + 8)], [0, 1, 0]);

  const draw = translation.surfaceDraw;
  assert.equal(draw.schema, ULG_SPH_GPU_RENDER_SURFACE_DRAW_SCHEMA);
  assert.equal(draw.drawIndirectSchema, ULG_SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_SCHEMA);
  assert.equal(draw.status, 'surface-draw-metadata-ready');
  assert.equal(draw.surfaceCount, 1);
  assert.equal(draw.activeSurfaceCount, 1);
  assert.equal(draw.vertexCount, 3);
  assert.equal(draw.triangleCount, 1);
  assert.deepEqual(draw.rowLayout, [...SPH_GPU_RENDER_SURFACE_DRAW_ROW_LAYOUT]);
  assert.deepEqual(draw.drawIndirectRowLayout, [...SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_ROW_LAYOUT]);

  const drawRow = [...draw.drawRows];
  assert.deepEqual(drawRow.slice(0, 12), [
    2,
    42,
    3,
    7,
    0,
    3,
    0,
    1,
    9,
    4,
    1,
    1
  ]);
  assertApprox(drawRow[12], 0.5);
  assertApprox(drawRow[13], 0.5);
  assertApprox(drawRow[14], 0);
  assertApprox(drawRow[15], Math.hypot(0.5, 0.5, 0));
  assert.deepEqual([...draw.drawIndirectRows], [3, 1, 0, 0]);
  assert.equal(draw.surfaces[0].indirectRowIndex, 0);
  assert.equal(draw.surfaces[0].indirectOffsetBytes, 0);
});

test('ULG maps extension grid-local compact positions into render-field world meters', () => {
  const translation = translateWebGpuMarchingCubesSurfaceToUlgRows({
    extensionExecution: extensionExecution(),
    positionRows: new Float32Array([
      0.5, 0.5, 0.5, 1,
      1.5, 0.5, 0.5, 1,
      0.5, 1.5, 0.5, 1
    ]),
    positionTransformResolution: 8,
    fieldPadding: 0.22,
    refEdgeM: 5
  });

  const span = 1 - 2 * 0.22;
  const scaleM = 5 / (span * 8);
  const originM = -0.22 * 5 / span;
  const rowStride = SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT.length;
  const firstVertexPosition = [...translation.surfaceVertices.vertexRows.slice(5, 8)];
  const secondVertexPosition = [...translation.surfaceVertices.vertexRows.slice(rowStride + 5, rowStride + 8)];
  const thirdVertexPosition = [...translation.surfaceVertices.vertexRows.slice(rowStride * 2 + 5, rowStride * 2 + 8)];

  assert.equal(translation.positionTransformStatus, 'ulg-render-field-grid-to-world-transform-ready');
  for (const value of firstVertexPosition) assertApprox(value, originM);
  assertApprox(secondVertexPosition[0], originM + scaleM);
  assertApprox(secondVertexPosition[1], originM);
  assertApprox(secondVertexPosition[2], originM);
  assertApprox(thirdVertexPosition[0], originM);
  assertApprox(thirdVertexPosition[1], originM + scaleM);
  assertApprox(thirdVertexPosition[2], originM);
  assert.deepEqual([...translation.surfaceDraw.drawIndirectRows], [3, 1, 0, 0]);
});

test('ULG clamps extension compact positions to world-space surface bounds', () => {
  const translation = translateWebGpuMarchingCubesSurfaceToUlgRows({
    extensionExecution: extensionExecution(),
    positionRows: new Float32Array([
      0.5, 0.5, 0.5, 1,
      2.5, 0.5, 0.5, 1,
      0.5, 1.5, 0.5, 1
    ]),
    positionTransformResolution: 8,
    fieldPadding: 0.22,
    refEdgeM: 5,
    positionClampMinM: [0, 0, 0],
    positionClampMaxM: [5, 5, 5]
  });

  const rowStride = SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT.length;
  const firstVertexPosition = [...translation.surfaceVertices.vertexRows.slice(5, 8)];
  const secondVertexPosition = [...translation.surfaceVertices.vertexRows.slice(rowStride + 5, rowStride + 8)];

  assert.equal(translation.positionClampStatus, 'position-clamp-ready');
  assert.deepEqual(firstVertexPosition, [0, 0, 0]);
  assert.ok(secondVertexPosition[0] > 0);
  assert.equal(secondVertexPosition[1], 0);
  assert.equal(secondVertexPosition[2], 0);
  assert.ok(translation.surfaceDraw.surfaces[0].boundsCenterM.every((value) => value >= 0 && value <= 5));
  assert.ok(translation.surfaceDraw.surfaces[0].boundsRadiusM > 0);
});

test('ULG reports retained extension buffers need a GPU translation kernel when CPU positions are absent', () => {
  const translation = translateWebGpuMarchingCubesSurfaceToUlgRows({
    extensionExecution: extensionExecution()
  });

  assert.equal(translation.schema, ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_TRANSLATION_SCHEMA);
  assert.equal(translation.status, 'extension-surface-translation-needs-position-readback-or-gpu-kernel');
  assert.equal(translation.sourceBufferRetained, true);
  assert.equal(translation.hotLoopGpuTranslationRequired, true);
  assert.equal(translation.surfaceVertices, null);
  assert.equal(translation.surfaceDraw, null);
});

test('ULG translation preserves extension blockers instead of manufacturing render rows', () => {
  const translation = translateWebGpuMarchingCubesSurfaceToUlgRows({
    extensionExecution: extensionExecution({
      ok: false,
      status: 'same-device-check-failed',
      vertexCount: 0,
      bufferRetained: false
    })
  });

  assert.equal(translation.schema, ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_TRANSLATION_SCHEMA);
  assert.equal(translation.status, 'extension-surface-translation-blocked');
  assert.equal(translation.surfaceVertices, null);
  assert.equal(translation.surfaceDraw, null);
  assert.equal(translation.summary.status, 'extension-surface-same-device-check-failed');
});

test('ULG GPU builder translates retained extension compact positions into resident surface draw buffers', async () => {
  const { device, shaderModules, bindGroups, dispatches, createdBuffers, queueWrites } = fakeExtensionSurfaceDevice();
  const execution = extensionExecution({ vertexCount: 3 });

  const result = await buildWebGpuMarchingCubesExtensionSurfaceRowsWebGpu({
    device,
    extensionExecution: execution,
    surfaceIndex: 5,
    materialId: 12,
    phaseId: 2,
    opticalStateId: 8,
    material: 'h2o',
    phase: 'liquid',
    density: 998,
    isolation: 0.25,
    positionClampMinM: [0, 0, 0],
    positionClampMaxM: [5, 5, 5],
    readbackMode: 'no-full-readback',
    retainVertexRowsBuffer: true,
    retainDrawRowsBuffer: true,
    retainDrawIndirectRowsBuffer: true
  });

  assert.equal(result.schema, ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_TRANSLATION_SCHEMA);
  assert.equal(result.backend, 'webgpu');
  assert.equal(result.status, 'extension-surface-translated-resident-webgpu');
  assert.equal(result.sourceBufferBound, true);
  assert.equal(result.sourceBufferRetained, true);
  assert.equal(result.sourceVertexCount, 3);
  assert.equal(result.translatedVertexCount, 3);
  assert.equal(result.triangleCount, 1);
  assert.equal(result.queueCompletionStatus, 'queue-work-completed');
  assert.equal(result.queueCompletionMethod, 'queue.onSubmittedWorkDone');
  assert.equal(result.hotLoopGpuTranslationRequired, false);
  assert.equal(result.positionTransformStatus, 'position-transform-disabled');
  assert.equal(result.positionClampStatus, 'position-clamp-ready');
  assert.equal(result.translationPipelineCacheStatus, 'pipeline-cache-miss');
  assert.equal(result.translationPipelineCreated, true);
  assert.equal(result.translationBindGroupCreated, true);
  assert.equal(result.translationCommandEncoderCreated, true);
  assert.equal(result.translationWorkgroupCountX, 1);
  assert.equal(result.translationSubmissionObserved, true);
  assert.equal(result.vertexRowsBufferClearStatus, 'skipped-no-full-readback-indirect-draw');

  assert.equal(result.surfaceVertices.schema, ULG_SPH_GPU_RENDER_SURFACE_VERTICES_SCHEMA);
  assert.equal(result.surfaceVertices.backend, 'webgpu');
  assert.equal(result.surfaceVertices.vertexCount, 3);
  assert.equal(result.surfaceVertices.triangleCount, 1);
  assert.equal(result.surfaceVertices.vertexRowsBufferRetained, true);
  assert.equal(result.surfaceVertices.vertexRowsBufferRowCount, 3);
  assert.equal(result.surfaceVertices.vertexRowsBufferByteLength, 3 * SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT.length * 4);
  assert.equal(result.surfaceVertices.surfaceVertexReadback, false);
  assert.equal(result.surfaceVertices.vertexRows.length, 0);
  assert.equal(result.surfaceVertices.translationPipelineCacheStatus, 'pipeline-cache-miss');
  assert.equal(result.surfaceVertices.vertexRowsBufferClearStatus, 'skipped-no-full-readback-indirect-draw');
  assert.equal(result.surfaceVertices.surfaces[0].surfaceIndex, 5);
  assert.equal(result.surfaceVertices.surfaces[0].indirectRowIndex, 0);
  assert.equal(result.surfaceVertices.surfaces[0].indirectOffsetBytes, 0);
  assert.equal(result.surfaceVertices.surfaces[0].vertexOffset, 0);
  assert.equal(result.surfaceVertices.surfaces[0].vertexCount, 3);
  assert.deepEqual(result.surfaceVertices.surfaces[0].boundsCenterM, [2.5, 2.5, 2.5]);
  assertApprox(result.surfaceVertices.surfaces[0].boundsRadiusM, Math.hypot(2.5, 2.5, 2.5));
  assert.equal(
    (createdBuffers.find((buffer) => buffer.label === 'ulg-sph-extension-surface-vertices')?.usage
      & GPU_BUFFER_USAGE_VERTEX),
    GPU_BUFFER_USAGE_VERTEX
  );

  assert.equal(result.surfaceDraw.schema, ULG_SPH_GPU_RENDER_SURFACE_DRAW_SCHEMA);
  assert.equal(result.surfaceDraw.backend, 'webgpu');
  assert.equal(result.surfaceDraw.activeSurfaceCount, 1);
  assert.equal(result.surfaceDraw.vertexCount, 3);
  assert.equal(result.surfaceDraw.triangleCount, 1);
  assert.equal(result.surfaceDraw.drawRowsBufferRetained, true);
  assert.equal(result.surfaceDraw.drawIndirectRowsBufferRetained, true);
  assert.equal(result.surfaceDraw.compactedVertexRowsBufferRetained, true);
  assert.equal(result.surfaceDraw.drawRowsByteLength, SPH_GPU_RENDER_SURFACE_DRAW_ROW_LAYOUT.length * 4);
  assert.equal(result.surfaceDraw.drawIndirectRowsByteLength, SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_ROW_LAYOUT.length * 4);
  assert.equal(result.surfaceDraw.surfaceDrawReadback, false);
  assert.equal(result.surfaceDraw.compactedVertexRowsBuffer, result.surfaceVertices.vertexRowsBuffer);
  assert.equal(result.surfaceDraw.translationPipelineCacheStatus, 'pipeline-cache-miss');
  assert.equal(result.surfaceDraw.vertexRowsBufferClearStatus, 'skipped-no-full-readback-indirect-draw');
  assert.equal(result.surfaceDraw.surfaces[0].status, 'surface-draw-summary-not-read');
  assert.equal(result.surfaceDraw.surfaces[0].indirectRowIndex, 0);
  assert.equal(result.surfaceDraw.surfaces[0].indirectOffsetBytes, 0);
  assert.equal(result.surfaceDraw.surfaces[0].vertexOffset, 0);
  assert.equal(result.surfaceDraw.surfaces[0].vertexCount, 3);

  assert.equal(result.residentBufferLeaseLedgerStatus, 'resident-buffer-lease-ledger-active');
  assert.equal(result.residentBufferLeaseResourceCount, 3);
  assert.equal(result.residentBufferLeaseActiveLeaseCount, 3);
  assert.equal(shaderModules.length, 1);
  assert.equal(shaderModules[0].code, webGpuMarchingCubesExtensionSurfaceRowsWgsl);
  assert.match(shaderModules[0].code, /SurfaceTranslationParams|compact_position_rows|surface_draw_indirect_rows/);
  assert.equal(bindGroups.length, 1);
  // Binding 6 carries the density field (or a dummy) for gradient normals.
  assert.equal(bindGroups[0].entries.length, 7);
  assert.equal(
    bindGroups[0].entries[6].resource.buffer.label,
    'ulg-sph-extension-surface-field-gradient-dummy'
  );
  assert.equal(bindGroups[0].entries[0].resource.buffer, execution.result.buffer);
  assert.equal(bindGroups[0].entries[1].resource.buffer.label, 'ulg-sph-extension-surface-vertices');
  assert.equal(bindGroups[0].entries[2].resource.buffer.label, 'ulg-sph-extension-surface-draw');
  assert.equal(bindGroups[0].entries[3].resource.buffer.label, 'ulg-sph-extension-surface-draw-indirect');
  assert.equal(bindGroups[0].entries[5].resource.buffer.label, 'ulg-sph-extension-surface-source-vertex-count');
  assert.deepEqual(dispatches.map((dispatch) => dispatch.count), [1]);
  assert.ok(createdBuffers.some((buffer) => buffer.label === 'ulg-sph-extension-surface-translation-params'));
  assert.ok(queueWrites.some((write) => write.buffer.label === 'ulg-sph-extension-surface-translation-params' && write.byteLength === 160));
  assert.equal(queueWrites.some((write) => write.buffer.label === 'ulg-sph-extension-surface-vertices'), false);

  const retainedBuffers = [
    result.surfaceVertices.vertexRowsBuffer,
    result.surfaceDraw.drawRowsBuffer,
    result.surfaceDraw.drawIndirectRowsBuffer
  ];
  result.destroyExtensionSurfaceBuffers();
  assert.equal(result.residentBufferLeaseSummary.skippedDestroyCount, 3);
  assert.equal(retainedBuffers.every((buffer) => buffer.destroyed === false), true);
  result.releaseExtensionSurfaceBufferLeases();
  assert.equal(result.residentBufferLeaseLedgerStatus, 'resident-buffer-lease-ledger-ready');
  result.destroyExtensionSurfaceBuffers();
  assert.equal(result.residentBufferLeaseLedgerStatus, 'resident-buffer-lease-ledger-cleaned');
  assert.equal(retainedBuffers.every((buffer) => buffer.destroyed === true), true);
});

test('ULG GPU builder retires every partial owned allocation on construction failure', async () => {
  const failureCases = [
    { failCreateBufferLabel: 'ulg-sph-extension-surface-draw' },
    { failCreateBufferLabel: 'ulg-sph-extension-surface-draw-indirect' },
    { failCreateBufferLabel: 'ulg-sph-extension-surface-translation-params' },
    { failCreateBufferLabel: 'ulg-sph-extension-surface-source-vertex-count' },
    { failCreateBufferLabel: 'ulg-sph-extension-surface-field-gradient-dummy' },
    { failCreateBindGroup: true },
    { failWriteBufferLabel: 'ulg-sph-extension-surface-draw' },
    { failWriteBufferLabel: 'ulg-sph-extension-surface-translation-params' },
    { failQueueSubmit: true }
  ];
  for (const injectedFailure of failureCases) {
    const { device, createdBuffers } = fakeExtensionSurfaceDevice(
      injectedFailure
    );
    await assert.rejects(
      buildWebGpuMarchingCubesExtensionSurfaceRowsWebGpu({
        device,
        extensionExecution: extensionExecution({ vertexCount: 3 }),
        readbackMode: 'no-full-readback',
        waitForQueueCompletion: false
      }),
      /injected/
    );
    const ownedBuffers = createdBuffers.filter((buffer) =>
      buffer.label?.startsWith('ulg-sph-extension-surface-'));
    assert.ok(ownedBuffers.length > 0, JSON.stringify(injectedFailure));
    assert.equal(
      ownedBuffers.every((buffer) => (
        buffer.destroyed === true
        && buffer.destroyCount === 1
      )),
      true,
      `partial allocation leaked or retired twice: ${JSON.stringify(injectedFailure)}`
    );
  }
});

test('ULG GPU builder retires transient allocations when cleanup-fence scheduling throws synchronously', async () => {
  const { device, createdBuffers } = fakeExtensionSurfaceDevice({
    failSubmittedWorkDoneSync: true
  });
  const result = await buildWebGpuMarchingCubesExtensionSurfaceRowsWebGpu({
    device,
    extensionExecution: extensionExecution({ vertexCount: 3 }),
    readbackMode: 'no-full-readback',
    waitForQueueCompletion: false
  });
  const retainedBuffers = new Set([
    result.surfaceVertices.vertexRowsBuffer,
    result.surfaceDraw.drawRowsBuffer,
    result.surfaceDraw.drawIndirectRowsBuffer
  ]);
  const ownedBuffers = createdBuffers.filter((buffer) =>
    buffer.label?.startsWith('ulg-sph-extension-surface-'));
  const transientBuffers = ownedBuffers.filter((buffer) =>
    !retainedBuffers.has(buffer));
  assert.ok(transientBuffers.length > 0);
  assert.equal(
    transientBuffers.every((buffer) => (
      buffer.destroyed === true
      && buffer.destroyCount === 1
    )),
    true
  );
  assert.equal(
    [...retainedBuffers].every((buffer) => buffer.destroyed === false),
    true
  );

  result.destroyExtensionSurfaceBuffers({
    force: true,
    releaseLeases: true,
    reason: 'cleanup-fence-scheduling-test'
  });
  assert.equal(
    ownedBuffers.every((buffer) => (
      buffer.destroyed === true
      && buffer.destroyCount === 1
    )),
    true
  );
});

test('ULG GPU builder retires readback staging and outer buffers after map failure', async () => {
  const { device, createdBuffers } = fakeExtensionSurfaceDevice({
    failMapAsyncLabel: 'ulg-sph-extension-surface-vertex-readback'
  });
  await assert.rejects(
    buildWebGpuMarchingCubesExtensionSurfaceRowsWebGpu({
      device,
      extensionExecution: extensionExecution({ vertexCount: 3 }),
      readbackMode: 'full-parity-readback'
    }),
    /injected mapAsync failure/
  );
  await Promise.resolve();
  await Promise.resolve();
  const ownedBuffers = createdBuffers.filter((buffer) =>
    buffer.label?.startsWith('ulg-sph-extension-surface-'));
  assert.ok(ownedBuffers.some((buffer) =>
    buffer.label === 'ulg-sph-extension-surface-vertex-readback'));
  assert.equal(
    ownedBuffers.every((buffer) => (
      buffer.destroyed === true
      && buffer.destroyCount === 1
    )),
    true
  );
});

test('ULG GPU builder never destroys extension-owned buffers on pre-submit failure', async () => {
  const { device, createdBuffers } = fakeExtensionSurfaceDevice({
    failWriteBufferLabel: 'ulg-sph-extension-surface-draw'
  });
  const extensionDrawIndirectBuffer = {
    label: 'extension-draw-indirect',
    size: SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_ROW_LAYOUT.length
      * Uint32Array.BYTES_PER_ELEMENT,
    destroyed: false,
    destroy() { this.destroyed = true; }
  };
  const execution = extensionExecution({
    vertexCount: 9,
    includeRowMetadata: true,
    includeOutputDescriptors: true,
    includePackedNormals: true,
    drawIndirectBuffer: extensionDrawIndirectBuffer
  });
  for (const borrowed of [execution.result.buffer, execution.result.normalBuffer]) {
    borrowed.destroyed = false;
    borrowed.destroy = function () { this.destroyed = true; };
  }
  await assert.rejects(
    buildWebGpuMarchingCubesExtensionSurfaceRowsWebGpu({
      device,
      extensionExecution: execution,
      readbackMode: 'no-full-readback',
      translateVertexRows: false,
      allowExtensionDrawIndirectBuffer: true,
      waitForQueueCompletion: false
    }),
    /injected writeBuffer failure/
  );
  assert.equal(execution.result.buffer.destroyed, false);
  assert.equal(execution.result.normalBuffer.destroyed, false);
  assert.equal(extensionDrawIndirectBuffer.destroyed, false);
  assert.equal(
    createdBuffers.every((buffer) => (
      buffer.destroyed === true
      && buffer.destroyCount === 1
    )),
    true
  );
});

test('ULG GPU builder reuses the extension surface translation pipeline on the same device', async () => {
  const { device, shaderModules, queueWrites } = fakeExtensionSurfaceDevice();

  const first = await buildWebGpuMarchingCubesExtensionSurfaceRowsWebGpu({
    device,
    extensionExecution: extensionExecution({ vertexCount: 3 }),
    readbackMode: 'no-full-readback',
    waitForQueueCompletion: false
  });
  const second = await buildWebGpuMarchingCubesExtensionSurfaceRowsWebGpu({
    device,
    extensionExecution: extensionExecution({ vertexCount: 6 }),
    readbackMode: 'no-full-readback',
    waitForQueueCompletion: false
  });

  assert.equal(first.translationPipelineCacheStatus, 'pipeline-cache-miss');
  assert.equal(second.translationPipelineCacheStatus, 'pipeline-cache-hit');
  assert.equal(shaderModules.length, 1);
  assert.equal(queueWrites.some((write) => write.buffer.label === 'ulg-sph-extension-surface-vertices'), false);
});

test('ULG GPU builder retains compact position rows without borrowing extension indirect draw by default', async () => {
  const { device, shaderModules, bindGroups, dispatches, createdBuffers, queueWrites } = fakeExtensionSurfaceDevice();
  const extensionDrawIndirectBuffer = {
    label: 'extension-draw-indirect',
    size: SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_ROW_LAYOUT.length * Uint32Array.BYTES_PER_ELEMENT,
    destroyed: false,
    destroy() {
      this.destroyed = true;
    }
  };
  const execution = extensionExecution({
    vertexCount: 9,
    includeRowMetadata: true,
    includeOutputDescriptors: true,
    includePackedNormals: true,
    vertexCountMode: 'gpu-counter',
    drawIndirectBuffer: extensionDrawIndirectBuffer
  });

  const result = await buildWebGpuMarchingCubesExtensionSurfaceRowsWebGpu({
    device,
    extensionExecution: execution,
    readbackMode: 'no-full-readback',
    translateVertexRows: false,
    waitForQueueCompletion: false
  });

  assert.equal(result.status, 'extension-surface-compact-position-direct-resident-webgpu');
  assert.equal(result.directCompactPositionDraw, true);
  assert.equal(result.hotLoopUlgVertexRowExpansionSkipped, true);
  assert.equal(result.translationPipelineCacheStatus, 'pipeline-cache-miss');
  assert.equal(result.vertexRowsBufferClearStatus, 'skipped-direct-compact-position-draw');
  assert.equal(result.directCompactPositionDrawIndirectSource, 'ulg-compact-position-draw-metadata-kernel');
  assert.equal(result.drawIndirectRowsOwnership, 'ulg-owned-retained-buffer');
  assert.equal(result.compactPositionRowsBufferRetained, true);
  assert.equal(result.compactPositionRowsBufferByteLength, 9 * 4 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(result.compactPositionRowsVertexCount, 9);
  assert.equal(result.compactPositionRowsStrideFloats, 4);
  assert.equal(result.compactNormalRowsBufferRetained, true);
  assert.equal(result.compactNormalRowsBuffer, execution.result.normalBuffer);
  assert.equal(result.compactNormalRowsBufferByteLength, 9 * Uint32Array.BYTES_PER_ELEMENT);
  assert.equal(result.compactNormalRowsBufferRowCount, 9);
  assert.equal(result.compactNormalRowsEncoding, WEBGPU_MARCHING_CUBES_PACKED_NORMAL_ENCODING);
  assert.equal(result.compactNormalRowsSurfaceGenerationId, 7);
  assert.equal(result.compactPositionRowsSurfaceGenerationId, 7);
  assert.equal(result.compactNormalRowsAdditionalSubmitCount, 0);

  assert.equal(result.surfaceVertices.status, 'surface-vertices-resident-extension-compact-position-direct');
  assert.equal(result.surfaceVertices.directCompactPositionDraw, true);
  assert.equal(result.surfaceVertices.vertexRowsBufferRetained, false);
  assert.equal(result.surfaceVertices.vertexRowsBufferByteLength, 0);
  assert.equal(result.surfaceVertices.compactPositionRowsBufferRetained, true);
  assert.equal(result.surfaceVertices.compactPositionRowsBuffer, execution.result.buffer);

  assert.equal(result.surfaceDraw.status, 'surface-draw-resident-extension-compact-position-direct');
  assert.equal(result.surfaceDraw.directCompactPositionDraw, true);
  assert.equal(result.surfaceDraw.compactionMode, 'webgpu-extension-compact-position-direct-draw-metadata');
  assert.equal(result.surfaceDraw.compactedVertexRowsBufferRetained, false);
  assert.equal(result.surfaceDraw.compactedVertexRowsBufferByteLength, 0);
  assert.equal(result.surfaceDraw.compactPositionRowsBufferRetained, true);
  assert.equal(result.surfaceDraw.compactPositionRowsBuffer, execution.result.buffer);
  assert.equal(result.surfaceDraw.drawRowsBufferRetained, true);
  assert.equal(result.surfaceDraw.drawIndirectRowsBufferRetained, true);
  assert.equal(result.surfaceDraw.drawIndirectRowsBuffer.label, 'ulg-sph-extension-surface-draw-indirect');
  assert.equal(result.surfaceDraw.drawIndirectRowsOwnership, 'ulg-owned-retained-buffer');
  assert.equal(
    result.surfaceDraw.directCompactPositionDrawIndirectSource,
    'ulg-compact-position-draw-metadata-kernel'
  );

  assert.equal(createdBuffers.some((buffer) => buffer.label === 'ulg-sph-extension-surface-vertices'), false);
  assert.equal(createdBuffers.some((buffer) => buffer.label === 'ulg-sph-extension-surface-draw-indirect'), true);
  assert.equal(createdBuffers.some((buffer) => buffer.label === 'ulg-sph-extension-surface-translation-params'), true);
  assert.equal(shaderModules.length, 1);
  assert.equal(shaderModules[0].code, webGpuMarchingCubesExtensionCompactSurfaceDrawWgsl);
  assert.equal(bindGroups.length, 1);
  assert.equal(bindGroups[0].entries[1].resource.buffer.label, 'ulg-sph-extension-surface-draw-indirect');
  assert.deepEqual(dispatches.map((dispatch) => dispatch.count), [1]);
  assert.equal(queueWrites.some((write) => write.buffer.label === 'ulg-sph-extension-surface-vertices'), false);
  assert.equal(queueWrites.some((write) => write.buffer.label === 'ulg-sph-extension-surface-translation-params'), true);
  assert.equal(result.residentBufferLeaseResourceCount, 4);
  assert.equal(result.residentBufferLeaseActiveLeaseCount, 4);

  const retainedBuffers = [
    result.surfaceDraw.drawRowsBuffer,
    result.surfaceDraw.drawIndirectRowsBuffer
  ];
  result.releaseExtensionSurfaceBufferLeases();
  result.destroyExtensionSurfaceBuffers();
  assert.equal(result.residentBufferLeaseLedgerStatus, 'resident-buffer-lease-ledger-cleaned');
  assert.equal(retainedBuffers.every((buffer) => buffer.destroyed === true), true);
  assert.equal(extensionDrawIndirectBuffer.destroyed, false);
  assert.equal(execution.result.buffer.destroyed, undefined);
  assert.equal(execution.result.normalBuffer.destroyed, undefined);
});

test('ULG GPU builder reuses opted-in extension indirect draw without an adapter compute submit', async () => {
  const {
    device,
    shaderModules,
    bindGroups,
    dispatches,
    createdBuffers,
    queueWrites,
    queueSubmissions
  } = fakeExtensionSurfaceDevice();
  const extensionDrawIndirectBuffer = {
    label: 'extension-draw-indirect',
    size: SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_ROW_LAYOUT.length * Uint32Array.BYTES_PER_ELEMENT,
    destroyed: false,
    destroy() {
      this.destroyed = true;
    }
  };
  const execution = extensionExecution({
    vertexCount: 45,
    includeRowMetadata: true,
    includeOutputDescriptors: true,
    includePackedNormals: true,
    vertexCountMode: 'conservative-upper-bound',
    drawIndirectBuffer: extensionDrawIndirectBuffer
  });

  const result = await buildWebGpuMarchingCubesExtensionSurfaceRowsWebGpu({
    device,
    extensionExecution: execution,
    readbackMode: 'no-full-readback',
    translateVertexRows: false,
    allowExtensionDrawIndirectBuffer: true,
    waitForQueueCompletion: false
  });

  assert.equal(result.directCompactPositionDraw, true);
  assert.equal(
    result.directCompactPositionDrawIndirectSource,
    'webgpu-marching-cubes-extension-draw-indirect-buffer'
  );
  assert.equal(result.drawIndirectRowsOwnership, 'extension-owned-retained-buffer');
  assert.equal(result.surfaceDraw.drawIndirectRowsBuffer, extensionDrawIndirectBuffer);
  assert.equal(result.surfaceDraw.drawIndirectRowsOwnership, 'extension-owned-retained-buffer');
  assert.equal(result.translationPipelineCacheStatus, 'skipped-extension-draw-indirect-buffer');
  assert.equal(result.translationPipelineCreated, false);
  assert.equal(result.translationBindGroupCreated, false);
  assert.equal(result.translationCommandEncoderCreated, false);
  assert.equal(result.translationWorkgroupCountX, 0);
  assert.equal(result.translationSubmissionObserved, false);
  assert.equal(result.queueCompletionStatus, 'queue-work-not-required');
  assert.equal(result.queueCompletionMethod, 'extension-owned-draw-indirect-buffer');
  assert.equal(shaderModules.length, 0);
  assert.equal(bindGroups.length, 0);
  assert.equal(dispatches.length, 0);
  assert.equal(queueSubmissions.length, 0);
  assert.equal(
    createdBuffers.some((buffer) => buffer.label === 'ulg-sph-extension-surface-draw-indirect'),
    false
  );
  assert.equal(
    createdBuffers.some((buffer) => buffer.label === 'ulg-sph-extension-surface-translation-params'),
    false
  );
  assert.equal(
    createdBuffers.some((buffer) => buffer.label === 'ulg-sph-extension-surface-source-vertex-count'),
    false
  );
  assert.equal(
    queueWrites.some((write) => write.buffer.label === 'ulg-sph-extension-surface-translation-params'),
    false
  );

  const ownedDrawRowsBuffer = result.surfaceDraw.drawRowsBuffer;
  result.releaseExtensionSurfaceBufferLeases();
  result.destroyExtensionSurfaceBuffers();
  assert.equal(result.residentBufferLeaseLedgerStatus, 'resident-buffer-lease-ledger-cleaned');
  assert.equal(ownedDrawRowsBuffer.destroyed, true);
  assert.equal(extensionDrawIndirectBuffer.destroyed, false);
});

test('ULG GPU builder fails closed when compact draw has no packed normal generation', async () => {
  const { device } = fakeExtensionSurfaceDevice();
  const execution = extensionExecution({
    vertexCount: 9,
    includeRowMetadata: true,
    includeOutputDescriptors: true,
    includePackedNormals: false,
    vertexCountMode: 'gpu-counter'
  });

  await assert.rejects(
    buildWebGpuMarchingCubesExtensionSurfaceRowsWebGpu({
      device,
      extensionExecution: execution,
      readbackMode: 'no-full-readback',
      translateVertexRows: false,
      waitForQueueCompletion: false
    }),
    /generation-matched packed normals \(packed-normal-buffer-unavailable\)/
  );
});

test('ULG GPU builder fails closed when packed normals do not match the position generation', async () => {
  const { device } = fakeExtensionSurfaceDevice();
  const execution = extensionExecution({
    vertexCount: 9,
    includeRowMetadata: true,
    includeOutputDescriptors: true,
    includePackedNormals: true,
    vertexCountMode: 'gpu-counter',
    surfaceGenerationId: 11
  });
  execution.result.outputDescriptors.rows.normal.normalBufferDescriptor
    .generation.surfaceGenerationId = 10;

  await assert.rejects(
    buildWebGpuMarchingCubesExtensionSurfaceRowsWebGpu({
      device,
      extensionExecution: execution,
      readbackMode: 'no-full-readback',
      translateVertexRows: false,
      waitForQueueCompletion: false
    }),
    /generation-matched packed normals \(packed-normal-generation-mismatch\)/
  );
});

test('ULG GPU builder requires each packed-normal pairing ID to be descriptor-authored', async (t) => {
  const cases = [
    ['surfaceGenerationId', 'extensionNormalSurfaceGenerationIdAuthored'],
    [
      'pairedPositionSurfaceGenerationId',
      'extensionNormalPairedPositionSurfaceGenerationIdAuthored'
    ],
    ['volumeGenerationId', 'extensionNormalVolumeGenerationIdAuthored']
  ];

  for (const [generationField, summaryField] of cases) {
    await t.test(generationField, async () => {
      const { device } = fakeExtensionSurfaceDevice();
      const execution = extensionExecution({
        vertexCount: 9,
        includeRowMetadata: true,
        includeOutputDescriptors: true,
        includePackedNormals: true,
        vertexCountMode: 'conservative-upper-bound',
        surfaceGenerationId: 11,
        volumeGenerationId: 42
      });
      delete execution.result.outputDescriptors.rows.normal.normalBufferDescriptor
        .generation[generationField];

      const summary = summarizeWebGpuMarchingCubesExtensionExecution(execution);
      assert.equal(summary[summaryField], false);
      assert.equal(summary.extensionPackedNormalReady, false);
      assert.equal(summary.extensionPackedNormalStatus, 'packed-normal-generation-mismatch');
      assert.equal(execution.result.surfaceGenerationId, 11);
      assert.equal(execution.result.volumeGenerationId, 42);

      await assert.rejects(
        buildWebGpuMarchingCubesExtensionSurfaceRowsWebGpu({
          device,
          extensionExecution: execution,
          readbackMode: 'no-full-readback',
          translateVertexRows: false,
          waitForQueueCompletion: false
        }),
        /generation-matched packed normals \(packed-normal-generation-mismatch\)/
      );
    });
  }
});

test('ULG GPU builder falls back to compact draw metadata when extension indirect output is absent', async () => {
  const { device, shaderModules, bindGroups, dispatches, createdBuffers, queueWrites } = fakeExtensionSurfaceDevice();
  const execution = extensionExecution({
    vertexCount: 9,
    includeRowMetadata: true,
    includeOutputDescriptors: true,
    includePackedNormals: true,
    vertexCountMode: 'gpu-counter'
  });

  const result = await buildWebGpuMarchingCubesExtensionSurfaceRowsWebGpu({
    device,
    extensionExecution: execution,
    readbackMode: 'no-full-readback',
    translateVertexRows: false,
    waitForQueueCompletion: false
  });

  assert.equal(result.directCompactPositionDraw, true);
  assert.equal(result.translationPipelineCacheStatus, 'pipeline-cache-miss');
  assert.equal(result.directCompactPositionDrawIndirectSource, 'ulg-compact-position-draw-metadata-kernel');
  assert.equal(result.drawIndirectRowsOwnership, 'ulg-owned-retained-buffer');
  assert.equal(result.surfaceDraw.drawIndirectRowsOwnership, 'ulg-owned-retained-buffer');
  assert.equal(result.surfaceDraw.drawIndirectRowsBuffer.label, 'ulg-sph-extension-surface-draw-indirect');
  assert.equal(createdBuffers.some((buffer) => buffer.label === 'ulg-sph-extension-surface-vertices'), false);
  assert.equal(shaderModules.length, 1);
  assert.equal(shaderModules[0].code, webGpuMarchingCubesExtensionCompactSurfaceDrawWgsl);
  assert.match(shaderModules[0].code, /SurfaceTranslationParams|actual_triangle_count|surface_draw_indirect_rows/);
  assert.equal(bindGroups.length, 1);
  assert.equal(bindGroups[0].entries.length, 4);
  assert.equal(bindGroups[0].entries[0].resource.buffer.label, 'ulg-sph-extension-surface-draw');
  assert.equal(bindGroups[0].entries[1].resource.buffer.label, 'ulg-sph-extension-surface-draw-indirect');
  assert.equal(bindGroups[0].entries[2].resource.buffer.label, 'ulg-sph-extension-surface-translation-params');
  assert.equal(bindGroups[0].entries[3].resource.buffer.label, 'ulg-sph-extension-surface-source-vertex-count');
  assert.deepEqual(dispatches.map((dispatch) => dispatch.count), [1]);
  assert.equal(queueWrites.some((write) => write.buffer.label === 'ulg-sph-extension-surface-vertices'), false);
  assert.equal(result.residentBufferLeaseResourceCount, 4);
  assert.equal(result.residentBufferLeaseActiveLeaseCount, 4);

  const retainedBuffers = [
    result.surfaceDraw.drawRowsBuffer,
    result.surfaceDraw.drawIndirectRowsBuffer
  ];
  result.releaseExtensionSurfaceBufferLeases();
  result.destroyExtensionSurfaceBuffers();
  assert.equal(result.residentBufferLeaseLedgerStatus, 'resident-buffer-lease-ledger-cleaned');
  assert.equal(retainedBuffers.every((buffer) => buffer.destroyed === true), true);
});

test('ULG GPU builder exposes full-readback rows for the Three compact scene bridge', async () => {
  const { device, queueWrites } = fakeExtensionSurfaceDevice();
  const result = await buildWebGpuMarchingCubesExtensionSurfaceRowsWebGpu({
    device,
    extensionExecution: extensionExecution({ vertexCount: 3 }),
    readbackMode: 'full-parity-readback',
    retainVertexRowsBuffer: false,
    retainDrawRowsBuffer: false,
    retainDrawIndirectRowsBuffer: false
  });

  assert.equal(result.surfaceVertices.surfaceVertexReadback, true);
  assert.equal(result.vertexRowsBufferClearStatus, 'cleared-for-readback');
  assert.equal(result.surfaceVertices.vertexRowsBufferClearStatus, 'cleared-for-readback');
  assert.equal(result.surfaceVertices.vertexRows.length, 3 * SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT.length);
  assert.equal(result.surfaceDraw.surfaceDrawReadback, true);
  assert.equal(result.surfaceDraw.compactedVertexRows, result.surfaceVertices.vertexRows);
  assert.equal(result.surfaceDraw.compactedVertexRowsByteLength, result.surfaceVertices.vertexRows.byteLength);
  assert.equal(result.surfaceDraw.compactedVertexRowsBufferRetained, false);
  assert.equal(result.surfaceDraw.surfaces[0].status, 'surface-draw-ready');
  assert.equal(queueWrites.some((write) => write.buffer.label === 'ulg-sph-extension-surface-vertices'), true);
});

test('ULG GPU builder rejects extension buffers reported on a different GPUDevice', async () => {
  const { device } = fakeExtensionSurfaceDevice();
  await assert.rejects(
    buildWebGpuMarchingCubesExtensionSurfaceRowsWebGpu({
      device,
      extensionExecution: extensionExecution({
        resourceOwnershipStatus: 'cross-device-resource'
      })
    }),
    /not owned by this GPUDevice/
  );
});
