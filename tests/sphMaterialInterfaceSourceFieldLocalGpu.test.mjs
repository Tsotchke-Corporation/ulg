import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SPH_GPU_RENDER_FIELD_CELL_FLOATS,
  SPH_GPU_RENDER_ROW_FLOATS,
  buildSphRenderFieldSurfaceTable
} from '../src/runtime/sph/sphRenderGpuKernel.js';
import {
  buildSphMaterialInterfaceSourceFieldLocalWebGpu
} from '../src/runtime/sph/sphMaterialInterfaceSourceFieldLocalGpu.js';

function fakeComputeDevice() {
  const buffers = [];
  const shaderModules = [];
  const bindGroups = [];
  const dispatches = [];
  const submissions = [];
  const copies = [];
  const pipelines = [];

  const device = {
    limits: {
      maxBufferSize: 1024 * 1024 * 1024,
      maxStorageBufferBindingSize: 1024 * 1024 * 1024
    },
    queue: {
      writeBuffer(buffer, offset, data) {
        buffer.writes.push({ offset, byteLength: data.byteLength ?? 0 });
      },
      submit(commands) {
        submissions.push(commands);
      },
      async onSubmittedWorkDone() {
        return undefined;
      }
    },
    createBuffer(descriptor) {
      const buffer = {
        ...descriptor,
        writes: [],
        destroyed: false,
        destroy() {
          this.destroyed = true;
        },
        async mapAsync() {
          return undefined;
        },
        getMappedRange() {
          return new ArrayBuffer(this.size);
        },
        unmap() {}
      };
      buffers.push(buffer);
      return buffer;
    },
    createShaderModule(descriptor) {
      shaderModules.push(descriptor);
      return descriptor;
    },
    createBindGroupLayout(descriptor) {
      return descriptor;
    },
    createPipelineLayout(descriptor) {
      return descriptor;
    },
    createComputePipeline(descriptor) {
      const pipeline = {
        descriptor,
        getBindGroupLayout() {
          return { auto: true, label: `${descriptor.label}-auto-layout` };
        }
      };
      pipelines.push(pipeline);
      return pipeline;
    },
    createBindGroup(descriptor) {
      bindGroups.push(descriptor);
      return descriptor;
    },
    createCommandEncoder() {
      return {
        beginComputePass() {
          let currentPipeline = null;
          return {
            setPipeline(pipeline) {
              currentPipeline = pipeline;
            },
            setBindGroup() {},
            dispatchWorkgroups(x = 1, y = 1, z = 1) {
              dispatches.push({
                label: currentPipeline?.descriptor?.label ?? null,
                x,
                y,
                z
              });
            },
            end() {}
          };
        },
        copyBufferToBuffer(source, sourceOffset, target, targetOffset, byteLength) {
          copies.push({ source, sourceOffset, target, targetOffset, byteLength });
        },
        finish() {
          return { finished: true };
        }
      };
    }
  };

  return { device, buffers, shaderModules, bindGroups, dispatches, submissions, copies, pipelines };
}

test('source-local material interface field splats particles instead of dense cell-particle scans', async () => {
  const surfaceTable = buildSphRenderFieldSurfaceTable([
    {
      surfaceKey: 'Au|Au|solid',
      material: 'Au',
      phase: 'solid',
      renderKey: 'Au',
      resolution: 8,
      isolation: 80,
      subtract: 24,
      radiusNorm: 0.05,
      colorLinear: [1, 0.8, 0.2]
    }
  ]);
  const renderRows = new Float32Array(SPH_GPU_RENDER_ROW_FLOATS * 2);
  for (let index = 0; index < 2; index += 1) {
    const offset = index * SPH_GPU_RENDER_ROW_FLOATS;
    renderRows[offset] = 1 + index;
    renderRows[offset + 1] = 1;
    renderRows[offset + 2] = 1;
    renderRows[offset + 3] = 1;
    renderRows[offset + 4] = surfaceTable.metadata[0].materialId;
    renderRows[offset + 5] = surfaceTable.metadata[0].phaseId;
    renderRows[offset + 7] = 1;
  }

  const { device, shaderModules, bindGroups, dispatches, submissions } = fakeComputeDevice();
  const targetFieldRowsBuffer = device.createBuffer({
    label: 'test-pooled-source-local-field-rows',
    size: surfaceTable.totalFieldCells * SPH_GPU_RENDER_FIELD_CELL_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    usage: 0
  });

  const sourceField = await buildSphMaterialInterfaceSourceFieldLocalWebGpu({
    device,
    renderRows,
    surfaceTable,
    particleCount: 2,
    readbackMode: 'no-full-readback',
    waitForQueueCompletion: false,
    deferCleanup: true,
    useQueueFenceForCleanup: false,
    targetFieldRowsBuffer,
    targetFieldRowsBufferByteLength: targetFieldRowsBuffer.size
  });

  assert.equal(sourceField.schema, 'peercompute.ulg.sph-material-interface-source-field.v0');
  assert.equal(sourceField.backend, 'webgpu-source-local');
  assert.equal(sourceField.status, 'material-interface-source-field-ready');
  assert.equal(sourceField.sourceRenderFieldBackend, 'webgpu-source-local');
  assert.equal(sourceField.sourceLocalSourceField, true);
  assert.equal(sourceField.fieldRowsBuffer, targetFieldRowsBuffer);
  assert.equal(sourceField.fieldRowsBufferBorrowed, true);
  assert.equal(sourceField.fieldRowsBufferReused, true);
  assert.equal(sourceField.sourceIndexFieldStatus, 'source-local-source-index-field-retained');
  assert.equal(sourceField.sourceIndexFieldBufferRetained, true);
  assert.equal(sourceField.sourceIndexFieldBufferByteLength, surfaceTable.totalFieldCells * Uint32Array.BYTES_PER_ELEMENT);
  assert.equal(sourceField.sourceIndexFieldStrideUints, 1);
  assert.equal(sourceField.sourceIndexFieldBuffer.label, 'ulg-sph-material-interface-source-local-source-index-atomic');
  assert.equal(sourceField.queueCompletionStatus, 'queue-submitted-gpu-handoff-no-cpu-fence');
  assert.equal(sourceField.queueCompletionMethod, 'queue.submit(in-order-gpu-source-local-field-handoff)');
  assert.equal(sourceField.sourceLocalDenseCellParticlePairs, surfaceTable.totalFieldCells * 2);
  assert.ok(sourceField.sourceLocalEstimatedCellVisits < sourceField.sourceLocalDenseCellParticlePairs);
  assert.ok(sourceField.sourceLocalEstimatedVisitRatio > 0);
  assert.ok(sourceField.sourceLocalEstimatedVisitRatio < 1);

  assert.deepEqual(dispatches, [
    { label: 'ulg-sph-material-interface-source-local-splat', x: 1, y: 1, z: 1 },
    { label: 'ulg-sph-material-interface-source-local-resolve', x: 8, y: 1, z: 1 }
  ]);
  assert.equal(submissions.length, 1);
  assert.equal(bindGroups[0].entries[2].resource.buffer.label, 'ulg-sph-material-interface-source-local-density-atomic');
  assert.equal(bindGroups[0].entries[5].resource.buffer, sourceField.sourceIndexFieldBuffer);
  assert.equal(bindGroups[1].entries[2].resource.buffer, targetFieldRowsBuffer);
  assert.ok(shaderModules.some((module) => /array<atomic<u32>>/.test(module.code) && /atomicAdd/.test(module.code)));
  assert.ok(shaderModules.some((module) => /atomicCompareExchangeWeak/.test(module.code)));
  assert.ok(shaderModules.some((module) => /atomicLoad/.test(module.code) && /render_field_cells/.test(module.code)));

  sourceField.destroyMaterialInterfaceSourceFieldBuffers();
  assert.equal(targetFieldRowsBuffer.destroyed, false);
  assert.equal(sourceField.surfaceBuffer.destroyed, true);
  assert.equal(sourceField.sourceIndexFieldBuffer.destroyed, true);
});
