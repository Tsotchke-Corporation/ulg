import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS,
  SPH_GPU_RENDER_FIELD_CELL_FLOATS,
  SPH_GPU_RENDER_ROW_FLOATS,
  buildSphRenderFieldSurfaceTable
} from '../src/runtime/sph/sphRenderGpuKernel.js';
import {
  acquireSphMaterialInterfaceSourceFieldLocalGpuLane,
  buildSphMaterialInterfaceSourceFieldLocalWebGpu,
  createSphMaterialInterfaceSourceFieldLocalGpuLane,
  destroySphMaterialInterfaceSourceFieldLocalGpuLanePool,
  summarizeSphMaterialInterfaceSourceFieldLocalGpuLanePool
} from '../src/runtime/sph/sphMaterialInterfaceSourceFieldLocalGpu.js';

function fakeComputeDevice() {
  const buffers = [];
  const shaderModules = [];
  const bindGroups = [];
  const dispatches = [];
  const indirectDispatches = [];
  const submissions = [];
  const copies = [];
  const clears = [];
  const pipelines = [];
  let fenceCount = 0;
  let mapCount = 0;

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
        fenceCount += 1;
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
          mapCount += 1;
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
            dispatchWorkgroupsIndirect(buffer, offset = 0) {
              indirectDispatches.push({
                label: currentPipeline?.descriptor?.label ?? null,
                entryPoint: currentPipeline?.descriptor?.compute?.entryPoint ?? null,
                buffer,
                offset
              });
            },
            end() {}
          };
        },
        copyBufferToBuffer(source, sourceOffset, target, targetOffset, byteLength) {
          copies.push({ source, sourceOffset, target, targetOffset, byteLength });
        },
        clearBuffer(buffer, offset = 0, byteLength = buffer.size - offset) {
          clears.push({ buffer, offset, byteLength });
        },
        finish() {
          return { finished: true };
        }
      };
    }
  };

  return {
    device,
    buffers,
    shaderModules,
    bindGroups,
    dispatches,
    indirectDispatches,
    submissions,
    copies,
    clears,
    pipelines,
    get fenceCount() {
      return fenceCount;
    },
    get mapCount() {
      return mapCount;
    }
  };
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

test('resident source-field lane encodes current state and thermo generations without submit, map, or fence', () => {
  const surfaceTable = buildSphRenderFieldSurfaceTable([{
    surfaceKey: 'H2O|liquid',
    material: 'H2O',
    phase: 'liquid',
    renderKey: 'H2O',
    resolution: 8,
    isolation: 80,
    subtract: 24,
    radiusNorm: 0.05,
    colorLinear: [0.2, 0.5, 1]
  }]);
  const harness = fakeComputeDevice();
  const { device } = harness;
  const lane = createSphMaterialInterfaceSourceFieldLocalGpuLane(device, {
    surfaceTable,
    particleCapacity: 2,
    productEventCapacity: 0,
    renderDomainBaseCount: 1,
    renderDomainDropCount: 1,
    paramsSlotCount: 4,
    generationBase: 10,
    label: 'test-resident-source-field-lane'
  });
  const particleStateBuffer = device.createBuffer({
    label: 'test-current-particle-state',
    size: 2 * 8 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const particleThermoBuffer = device.createBuffer({
    label: 'test-current-particle-thermo',
    size: 2 * 12 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const laneExecutionIdentity = {
    laneId: 'test-pressure-lane',
    stateKey: 'test/pressure-state',
    sourceFamily: 'sph-particle-state',
    leaseId: 'test-pressure-lease',
    taskId: 'test-pressure-task'
  };
  const encoder = device.createCommandEncoder();
  const first = lane.encodeGeneration(encoder, {
    particleStateBuffer,
    particleThermoBuffer,
    particleCount: 2,
    sourceStep: 4,
    sourceSlot: 0,
    substepIndex: 0,
    residentNeighborhoodIdentity: {
      generation: 8,
      positionEpoch: 8,
      sourceCount: 2,
      authoritative: true,
      ...laneExecutionIdentity
    },
    laneExecutionIdentity
  });
  const second = lane.encodeGeneration(encoder, {
    particleStateBuffer,
    particleThermoBuffer,
    particleCount: 2,
    sourceStep: 5,
    sourceSlot: 1,
    substepIndex: 1,
    residentNeighborhoodIdentity: {
      generation: 10,
      positionEpoch: 10,
      sourceCount: 2,
      authoritative: true,
      ...laneExecutionIdentity
    },
    laneExecutionIdentity
  });

  assert.equal(first.sourceFieldGeneration, 10);
  assert.equal(second.sourceFieldGeneration, 11);
  assert.equal(first.sourcePositionEpoch, 8);
  assert.equal(second.sourcePositionEpoch, 10);
  assert.equal(second.generationToken.sourceNeighborhoodGeneration, 10);
  assert.equal(second.generationToken.sourceNeighborhoodTaskId, 'test-pressure-task');
  assert.equal(second.generationToken.sourceSlot, 1);
  assert.equal(second.generationToken.substepIndex, 1);
  assert.equal(first.generationToken.queueSubmitPerformed, false);
  assert.equal(first.generationToken.mapPerformed, false);
  assert.equal(first.generationToken.queueFenceAwaited, false);
  assert.equal(first.fieldRowsBuffer, second.fieldRowsBuffer);
  assert.equal(first.sourceIndexFieldBuffer, second.sourceIndexFieldBuffer);
  assert.equal(first.fieldRowsBufferReused, false);
  assert.equal(second.fieldRowsBufferReused, true);
  assert.equal(first.sourceRenderField.renderFieldInputSource, 'resident-particle-state-thermo-direct');
  assert.equal(harness.submissions.length, 0);
  assert.equal(harness.mapCount, 0);
  assert.equal(harness.fenceCount, 0);
  assert.equal(harness.clears.length, 4);
  assert.deepEqual(
    harness.clears.map((entry) => entry.buffer.label),
    [
      'test-resident-source-field-lane-density-atomic',
      'test-resident-source-field-lane-source-index-atomic',
      'test-resident-source-field-lane-density-atomic',
      'test-resident-source-field-lane-source-index-atomic'
    ]
  );
  assert.deepEqual(
    lane.paramsBuffer.writes.map((entry) => entry.offset),
    [0, lane.paramsSlotByteLength]
  );
  const directShader = harness.shaderModules.find(
    (module) => module.label === 'test-resident-source-field-lane-particle-splat'
  )?.code;
  assert.match(directShader, /var<storage, read> sph_state/);
  assert.match(directShader, /var<storage, read> sph_thermo/);
  assert.match(directShader, /particle_render_domain_id/);
  assert.doesNotMatch(directShader, /render_rows/);

  const submitted = lane.markSubmitted({ submissionSerial: 7 });
  assert.equal(submitted.generationCount, 2);
  assert.deepEqual(submitted.sourceFieldGenerations, [10, 11]);
  assert.equal(submitted.queueInteractionPerformed, false);
  assert.equal(first.generationToken.queueSubmitPerformed, true);
  assert.equal(first.generationToken.submissionSerial, 7);
  assert.equal(lane.getState().unsubmittedGenerationCount, 0);
  assert.equal(lane.getState().submissionCount, 1);
  const ownedBuffers = lane.allocationEntries().map((entry) => entry.buffer);
  assert.equal(lane.destroy(), true);
  assert.ok(ownedBuffers.every((buffer) => buffer.destroyed === true));
});

test('resident source-field lane splits particles from GPU-exact product prefix work', () => {
  const surfaceTable = buildSphRenderFieldSurfaceTable([
    {
      surfaceKey: 'H2O|liquid',
      material: 'H2O',
      phase: 'liquid',
      renderKey: 'H2O',
      resolution: 6,
      isolation: 80,
      subtract: 24,
      radiusNorm: 0.05,
      colorLinear: [0.2, 0.5, 1]
    },
    {
      surfaceKey: 'H2O|gas',
      material: 'H2O',
      phase: 'gas',
      renderKey: 'H2O',
      resolution: 6,
      isolation: 24,
      subtract: 16,
      radiusNorm: 0.08,
      colorLinear: [0.8, 0.9, 1]
    }
  ]);
  const harness = fakeComputeDevice();
  const { device } = harness;
  const productEventCountUpperBound = 4096;
  const lane = createSphMaterialInterfaceSourceFieldLocalGpuLane(device, {
    surfaceTable,
    particleCapacity: 2,
    productEventCapacity: productEventCountUpperBound,
    paramsSlotCount: 2,
    label: 'test-exact-product-prefix-source-field-lane'
  });
  const particleStateBuffer = device.createBuffer({
    label: 'test-exact-product-prefix-state',
    size: 2 * 8 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const particleThermoBuffer = device.createBuffer({
    label: 'test-exact-product-prefix-thermo',
    size: 2 * 12 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const productEventBuffer = device.createBuffer({
    label: 'test-exact-product-prefix-events',
    size: productEventCountUpperBound
      * SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS
      * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const productEventMetadataBuffer = device.createBuffer({
    label: 'test-exact-product-prefix-metadata',
    size: 16 * Uint32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const productEventDispatchIndirectBuffer = device.createBuffer({
    label: 'test-exact-product-prefix-dispatch',
    size: 3 * Uint32Array.BYTES_PER_ELEMENT,
    usage: 128 | 256
  });

  const generation = lane.encodeGeneration(device.createCommandEncoder(), {
    particleStateBuffer,
    particleThermoBuffer,
    productEventBuffer,
    productEventMetadataBuffer,
    productEventDispatchIndirectBuffer,
    particleCount: 2,
    productEventCount: productEventCountUpperBound,
    sourceStep: 0,
    residentNeighborhoodIdentity: {
      generation: 0,
      positionEpoch: 0,
      sourceCount: 2
    },
    productEventCountAuthority: 'gpu-authored-arena-active-count-indirect'
  });

  assert.equal(generation.productEventExactPrefixDispatch, true);
  assert.equal(generation.productEventDispatchMode, 'gpu-authored-exact-active-prefix-indirect');
  assert.equal(generation.productEventMetadataValidation, 'shader-fail-closed-arena-metadata-v1');
  assert.equal(generation.productEventSurfaceTraversal, 'event-row-parallel-surface-loop');
  assert.deepEqual(generation.sourceRenderField.sourceLocalParticleDispatchWorkgroups, {
    x: 1,
    y: 2,
    z: 1
  });
  assert.equal(
    generation.sourceRenderField.sourceLocalProductEventDispatchWorkgroupsUpperBound,
    64
  );
  assert.deepEqual(
    harness.dispatches.map(({ label, x, y, z }) => ({ label, x, y, z })),
    [
      {
        label: 'test-exact-product-prefix-source-field-lane-particle-splat',
        x: 1,
        y: 2,
        z: 1
      },
      {
        label: 'ulg-sph-material-interface-source-local-resolve',
        x: 4,
        y: 2,
        z: 1
      }
    ]
  );
  assert.equal(harness.indirectDispatches.length, 1);
  assert.equal(
    harness.indirectDispatches[0].label,
    'test-exact-product-prefix-source-field-lane-product-splat-exact'
  );
  assert.equal(harness.indirectDispatches[0].entryPoint, 'splat_product_events_exact');
  assert.equal(harness.indirectDispatches[0].buffer, productEventDispatchIndirectBuffer);
  assert.equal(harness.indirectDispatches[0].offset, 0);
  const exactShader = harness.shaderModules.find(
    (module) => module.label
      === 'test-exact-product-prefix-source-field-lane-product-splat-exact'
  )?.code;
  assert.match(exactShader, /fn exact_product_event_prefix_count/);
  assert.match(exactShader, /occupied_count != active_count/);
  assert.match(exactShader, /active_count > params\.product_event_count/);
  assert.match(exactShader, /for \(var surface_index = 0u;/);
  assert.doesNotMatch(exactShader, /source_index - params\.particle_count/);

  assert.throws(
    () => lane.encodeGeneration(device.createCommandEncoder(), {
      particleStateBuffer,
      particleThermoBuffer,
      productEventBuffer,
      productEventMetadataBuffer,
      particleCount: 2,
      productEventCount: 1,
      sourceStep: 1,
      residentNeighborhoodIdentity: {
        generation: 1,
        positionEpoch: 1,
        sourceCount: 2
      }
    }),
    /requires both metadata and indirect buffers/
  );
  assert.equal(lane.cancelBeforeSubmit().generationCount, 1);
  assert.equal(lane.destroy(), true);
});

test('source-field vec4 storage bindings retain an ABI-valid minimum for empty topology', async () => {
  const surfaceTable = buildSphRenderFieldSurfaceTable([]);
  assert.equal(surfaceTable.surfaceCount, 0);
  assert.equal(surfaceTable.totalFieldCells, 0);
  assert.equal(surfaceTable.records.byteLength, 0);
  const harness = fakeComputeDevice();
  const { device } = harness;
  const lane = createSphMaterialInterfaceSourceFieldLocalGpuLane(device, {
    surfaceTable,
    particleCapacity: 1,
    paramsSlotCount: 1,
    label: 'test-empty-topology-source-field-lane'
  });
  assert.equal(lane.surfaceBuffer.size, 16);
  assert.equal(lane.surfaceBufferByteLength, 16);
  assert.equal(lane.surfaceBufferPayloadByteLength, 0);
  assert.equal(lane.fieldRowsBuffer.size, 16);
  assert.equal(lane.fieldRowsBufferByteLength, 16);
  assert.equal(lane.fieldRowByteLength, 0);
  assert.equal(lane.sourceIndexFieldBuffer.size, 4);
  assert.equal(lane.sourceIndexFieldByteLength, 4);
  assert.equal(lane.sourceIndexFieldPayloadByteLength, 0);
  assert.equal(lane.surfaceBuffer.writes.length, 0);

  const particleStateBuffer = device.createBuffer({
    label: 'test-empty-topology-state',
    size: 8 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const particleThermoBuffer = device.createBuffer({
    label: 'test-empty-topology-thermo',
    size: 12 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const generation = lane.encodeGeneration(device.createCommandEncoder(), {
    particleStateBuffer,
    particleThermoBuffer,
    particleCount: 1,
    sourceStep: 0,
    residentNeighborhoodIdentity: {
      generation: 0,
      positionEpoch: 0,
      sourceCount: 1
    }
  });
  assert.equal(generation.surfaceBufferByteLength, 16);
  assert.equal(generation.surfaceBufferPayloadByteLength, 0);
  assert.equal(generation.fieldRowsBufferByteLength, 16);
  assert.equal(generation.fieldRowsBufferPayloadByteLength, 0);
  assert.equal(generation.sourceIndexFieldBufferByteLength, 4);
  assert.equal(generation.sourceIndexFieldBufferPayloadByteLength, 0);
  assert.equal(lane.cancelBeforeSubmit().generationCount, 1);
  lane.destroy();

  const standalone = await buildSphMaterialInterfaceSourceFieldLocalWebGpu({
    device,
    renderRows: new Float32Array(SPH_GPU_RENDER_ROW_FLOATS),
    surfaceTable,
    particleCount: 1,
    readbackMode: 'no-full-readback',
    waitForQueueCompletion: false,
    deferCleanup: false
  });
  assert.equal(standalone.surfaceBuffer.size, 16);
  assert.equal(standalone.surfaceBufferByteLength, 16);
  assert.equal(standalone.surfaceBufferPayloadByteLength, 0);
  assert.equal(standalone.fieldRowsBuffer.size, 16);
  assert.equal(standalone.fieldRowsBufferByteLength, 16);
  assert.equal(standalone.fieldRowsBufferPayloadByteLength, 0);
  assert.equal(standalone.sourceIndexFieldBuffer.size, 4);
  assert.equal(standalone.sourceIndexFieldBufferByteLength, 4);
  assert.equal(standalone.sourceIndexFieldBufferPayloadByteLength, 0);
  standalone.destroyMaterialInterfaceSourceFieldBuffers();
});

test('resident source-field lane fails closed when owned capacity or topology replacement is required', () => {
  const surfaceTable = buildSphRenderFieldSurfaceTable([{
    surfaceKey: 'Fe|solid',
    material: 'Fe',
    phase: 'solid',
    renderKey: 'Fe',
    resolution: 6,
    isolation: 80,
    subtract: 24,
    radiusNorm: 0.05,
    colorLinear: [0.8, 0.3, 0.1]
  }]);
  const changedSurfaceTable = buildSphRenderFieldSurfaceTable([{
    surfaceKey: 'Fe|solid',
    material: 'Fe',
    phase: 'solid',
    renderKey: 'Fe',
    resolution: 6,
    isolation: 81,
    subtract: 24,
    radiusNorm: 0.05,
    colorLinear: [0.8, 0.3, 0.1]
  }]);
  const harness = fakeComputeDevice();
  const lane = createSphMaterialInterfaceSourceFieldLocalGpuLane(harness.device, {
    surfaceTable,
    particleCapacity: 2,
    productEventCapacity: 1,
    paramsSlotCount: 1,
    label: 'test-source-field-admission-lane'
  });
  assert.equal(lane.capacityAdmission({ particleCount: 2, productEventCount: 1 }).admitted, true);
  assert.deepEqual(
    lane.capacityAdmission({ particleCount: 3, productEventCount: 2 }).reasons,
    ['particle-capacity-exceeded']
  );
  const borrowedProductAdmission = lane.capacityAdmission({
    particleCount: 2,
    productEventCount: 8
  });
  assert.equal(borrowedProductAdmission.admitted, true);
  assert.equal(borrowedProductAdmission.productEventCapacityOwnedByLane, false);
  assert.equal(
    borrowedProductAdmission.productEventCapacityAdmission,
    'borrowed-buffer-validated-at-encode'
  );
  assert.deepEqual(
    lane.capacityAdmission({ surfaceTable: changedSurfaceTable }).reasons,
    ['surface-topology-mismatch']
  );
  assert.deepEqual(
    lane.capacityAdmission({ device: fakeComputeDevice().device }).reasons,
    ['device-mismatch']
  );
  const particleStateBuffer = harness.device.createBuffer({
    label: 'test-admission-state',
    size: 3 * 8 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const particleThermoBuffer = harness.device.createBuffer({
    label: 'test-admission-thermo',
    size: 3 * 12 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  assert.throws(
    () => lane.encodeGeneration(harness.device.createCommandEncoder(), {
      particleStateBuffer,
      particleThermoBuffer,
      particleCount: 3,
      sourceStep: 0,
      residentNeighborhoodIdentity: { generation: 0, positionEpoch: 0, sourceCount: 3 }
    }),
    (error) => error?.code === 'ULG_MATERIAL_INTERFACE_SOURCE_FIELD_LANE_REPLACEMENT_REQUIRED'
      && error.admission?.replacementRequired === true
  );
  lane.encodeGeneration(harness.device.createCommandEncoder(), {
    particleStateBuffer,
    particleThermoBuffer,
    particleCount: 2,
    sourceStep: 0,
    residentNeighborhoodIdentity: { generation: 0, positionEpoch: 0, sourceCount: 2 }
  });
  assert.throws(
    () => lane.encodeGeneration(harness.device.createCommandEncoder(), {
      particleStateBuffer,
      particleThermoBuffer,
      particleCount: 2,
      sourceStep: 1,
      residentNeighborhoodIdentity: { generation: 1, positionEpoch: 1, sourceCount: 2 }
    }),
    (error) => error?.code === 'ULG_MATERIAL_INTERFACE_SOURCE_FIELD_LANE_PARAMS_EXHAUSTED'
  );
  assert.throws(
    () => lane.destroy(),
    (error) => error?.code === 'ULG_MATERIAL_INTERFACE_SOURCE_FIELD_LANE_UNSUBMITTED_GENERATIONS'
  );
  assert.equal(lane.cancelBeforeSubmit().generationCount, 1);
  assert.equal(lane.destroy(), true);
});

test('source-field lane pool rejects overlapping unsubmitted work and reuses immediately after caller submit', () => {
  const surfaceTable = buildSphRenderFieldSurfaceTable([{
    surfaceKey: 'H2O|liquid',
    material: 'H2O',
    phase: 'liquid',
    renderKey: 'H2O',
    resolution: 6,
    isolation: 80,
    subtract: 24,
    radiusNorm: 0.05,
    colorLinear: [0.2, 0.5, 1]
  }]);
  const harness = fakeComputeDevice();
  const options = {
    surfaceTable,
    particleCapacity: 2,
    paramsSlotCount: 2,
    poolMaxEntries: 1,
    laneId: 'test-pooled-pressure-lane',
    stateKey: 'test/pooled-pressure-state'
  };
  const first = acquireSphMaterialInterfaceSourceFieldLocalGpuLane(harness.device, options);
  const stateBuffer = harness.device.createBuffer({
    label: 'test-pooled-state',
    size: 2 * 8 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const thermoBuffer = harness.device.createBuffer({
    label: 'test-pooled-thermo',
    size: 2 * 12 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const encoder = harness.device.createCommandEncoder();
  first.encodeGeneration(encoder, {
    particleStateBuffer: stateBuffer,
    particleThermoBuffer: thermoBuffer,
    particleCount: 2,
    sourceStep: 0,
    residentNeighborhoodIdentity: { generation: 0, positionEpoch: 0, sourceCount: 2 }
  });
  assert.throws(
    () => acquireSphMaterialInterfaceSourceFieldLocalGpuLane(harness.device, options),
    (error) => error?.code
      === 'ULG_MATERIAL_INTERFACE_SOURCE_FIELD_LANE_POOL_OVERLAPPING_UNSUBMITTED_ACQUISITION'
  );
  assert.throws(
    () => first.release(),
    (error) => error?.code
      === 'ULG_MATERIAL_INTERFACE_SOURCE_FIELD_LANE_POOL_RELEASE_BEFORE_SUBMIT'
  );
  harness.device.queue.submit([encoder.finish()]);
  first.markSubmitted({ submissionSerial: 1 });
  assert.equal(first.release(), true);

  const second = acquireSphMaterialInterfaceSourceFieldLocalGpuLane(harness.device, options);
  assert.equal(second.reused, true);
  assert.equal(second.lane, first.lane);
  assert.equal(second.queueFenceRequiredForReuse, false);
  assert.equal(harness.fenceCount, 0);
  assert.equal(second.release(), true);
  const summary = summarizeSphMaterialInterfaceSourceFieldLocalGpuLanePool(harness.device);
  assert.equal(summary.maxEntries, 4);
  assert.equal(summary.entryCount, 1);
  assert.equal(summary.reuseCount, 1);
  const laneBuffers = first.lane.allocationEntries().map((entry) => entry.buffer);
  const destroyed = destroySphMaterialInterfaceSourceFieldLocalGpuLanePool(harness.device);
  assert.equal(destroyed.deferredEntryCount, 1);
  assert.ok(laneBuffers.every((buffer) => buffer.destroyed === false));
});

test('source-field lane pool reuses all owned storage while borrowed product input grows', () => {
  const surfaceTable = buildSphRenderFieldSurfaceTable([{
    surfaceKey: 'NaOH|liquid',
    material: 'NaOH',
    phase: 'liquid',
    renderKey: 'NaOH',
    resolution: 6,
    isolation: 80,
    subtract: 24,
    radiusNorm: 0.05,
    colorLinear: [0.7, 0.75, 0.8]
  }]);
  const harness = fakeComputeDevice();
  const baseOptions = {
    surfaceTable,
    particleCapacity: 2,
    productEventCapacity: 1,
    paramsSlotCount: 2,
    laneId: 'test-borrowed-product-pressure-lane',
    stateKey: 'test/borrowed-product-pressure-state'
  };
  const stateBuffer = harness.device.createBuffer({
    label: 'test-borrowed-product-state',
    size: 2 * 8 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const thermoBuffer = harness.device.createBuffer({
    label: 'test-borrowed-product-thermo',
    size: 2 * 12 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const productBuffer = harness.device.createBuffer({
    label: 'test-borrowed-product-events',
    size: 8 * SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });

  const first = acquireSphMaterialInterfaceSourceFieldLocalGpuLane(
    harness.device,
    baseOptions
  );
  const ownedBuffers = first.lane.allocationEntries().map((entry) => entry.buffer);
  assert.equal(ownedBuffers.length, 6);
  const firstEncoder = harness.device.createCommandEncoder();
  first.encodeGeneration(firstEncoder, {
    particleStateBuffer: stateBuffer,
    particleThermoBuffer: thermoBuffer,
    productEventBuffer: productBuffer,
    particleCount: 2,
    productEventCount: 1,
    sourceStep: 0,
    residentNeighborhoodIdentity: {
      generation: 0,
      positionEpoch: 0,
      sourceCount: 2
    }
  });
  harness.device.queue.submit([firstEncoder.finish()]);
  first.markSubmitted({ submissionSerial: 1 });
  first.release();

  const second = acquireSphMaterialInterfaceSourceFieldLocalGpuLane(
    harness.device,
    { ...baseOptions, productEventCapacity: 8 }
  );
  assert.equal(second.reused, true);
  assert.equal(second.grown, false);
  assert.equal(second.lane, first.lane);
  assert.deepEqual(
    second.lane.allocationEntries().map((entry) => entry.buffer),
    ownedBuffers
  );
  const undersizedProductBuffer = harness.device.createBuffer({
    label: 'test-undersized-borrowed-product-events',
    size: SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const secondEncoder = harness.device.createCommandEncoder();
  assert.throws(
    () => second.encodeGeneration(secondEncoder, {
      particleStateBuffer: stateBuffer,
      particleThermoBuffer: thermoBuffer,
      productEventBuffer: undersizedProductBuffer,
      particleCount: 2,
      productEventCount: 8,
      sourceStep: 1,
      residentNeighborhoodIdentity: {
        generation: 1,
        positionEpoch: 1,
        sourceCount: 2
      }
    }),
    /productEventBuffer is too small/
  );
  second.encodeGeneration(secondEncoder, {
    particleStateBuffer: stateBuffer,
    particleThermoBuffer: thermoBuffer,
    productEventBuffer: productBuffer,
    particleCount: 2,
    productEventCount: 8,
    sourceStep: 1,
    residentNeighborhoodIdentity: {
      generation: 1,
      positionEpoch: 1,
      sourceCount: 2
    }
  });
  harness.device.queue.submit([secondEncoder.finish()]);
  second.markSubmitted({ submissionSerial: 2 });
  second.release();

  const summary = summarizeSphMaterialInterfaceSourceFieldLocalGpuLanePool(
    harness.device
  );
  assert.equal(summary.createCount, 1);
  assert.equal(summary.reuseCount, 1);
  assert.equal(summary.growCount, 0);
  assert.equal(summary.entries[0].productEventCapacity, 8);
  assert.equal(summary.entries[0].productEventCapacityOwnedByLane, false);
  assert.equal(
    summary.entries[0].productEventCapacityAdmission,
    'borrowed-buffer-validated-at-encode'
  );
  assert.equal(
    summary.entries[0].laneState.maxBorrowedProductEventCount,
    8
  );
  assert.equal(harness.submissions.length, 2);
  assert.equal(harness.fenceCount, 0);
  assert.equal(harness.mapCount, 0);
  destroySphMaterialInterfaceSourceFieldLocalGpuLanePool(harness.device);
});

test('source-field lane pool grows capacity and retires submitted storage behind shared cleanup', async () => {
  const surfaceTable = buildSphRenderFieldSurfaceTable([{
    surfaceKey: 'Fe|solid',
    material: 'Fe',
    phase: 'solid',
    renderKey: 'Fe',
    resolution: 6,
    isolation: 80,
    subtract: 24,
    radiusNorm: 0.05,
    colorLinear: [0.8, 0.3, 0.1]
  }]);
  const harness = fakeComputeDevice();
  const baseOptions = {
    surfaceTable,
    particleCapacity: 2,
    productEventCapacity: 0,
    paramsSlotCount: 2,
    laneId: 'test-grow-pressure-lane',
    stateKey: 'test/grow-pressure-state'
  };
  const first = acquireSphMaterialInterfaceSourceFieldLocalGpuLane(
    harness.device,
    baseOptions
  );
  const stateBuffer = harness.device.createBuffer({
    label: 'test-grow-state',
    size: 2 * 8 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const thermoBuffer = harness.device.createBuffer({
    label: 'test-grow-thermo',
    size: 2 * 12 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const encoder = harness.device.createCommandEncoder();
  first.encodeGeneration(encoder, {
    particleStateBuffer: stateBuffer,
    particleThermoBuffer: thermoBuffer,
    particleCount: 2,
    sourceStep: 0,
    residentNeighborhoodIdentity: { generation: 0, positionEpoch: 0, sourceCount: 2 }
  });
  harness.device.queue.submit([encoder.finish()]);
  first.markSubmitted({ submissionSerial: 1 });
  first.release();
  const retiredBuffers = first.lane.allocationEntries().map((entry) => entry.buffer);

  const grown = acquireSphMaterialInterfaceSourceFieldLocalGpuLane(harness.device, {
    ...baseOptions,
    particleCapacity: 5,
    productEventCapacity: 3,
    paramsSlotCount: 4
  });
  assert.equal(grown.grown, true);
  assert.notEqual(grown.lane, first.lane);
  assert.equal(grown.lane.particleCapacity, 5);
  assert.equal(grown.lane.productEventCapacity, 3);
  assert.equal(grown.lane.paramsSlotCount, 4);
  assert.equal(grown.retirementStatus, 'retirement-deferred-until-device-queue-fence');
  assert.ok(retiredBuffers.every((buffer) => buffer.destroyed === false));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(harness.fenceCount, 1);
  assert.ok(retiredBuffers.every((buffer) => buffer.destroyed === true));
  grown.release();
  const summary = summarizeSphMaterialInterfaceSourceFieldLocalGpuLanePool(harness.device);
  assert.equal(summary.entryCount, 1);
  assert.equal(summary.growCount, 1);
  assert.equal(summary.pendingRetirementCount, 0);
  assert.equal(summary.retirementCompletedCount, 1);
  const destroyed = destroySphMaterialInterfaceSourceFieldLocalGpuLanePool(harness.device);
  assert.equal(destroyed.destroyedEntryCount, 1);
});

test('source-field lane pool remains structurally bounded and teardown blocks active leases', () => {
  const surfaceTable = buildSphRenderFieldSurfaceTable([{
    surfaceKey: 'Na|solid',
    material: 'Na',
    phase: 'solid',
    renderKey: 'Na',
    resolution: 4,
    isolation: 80,
    subtract: 24,
    radiusNorm: 0.05,
    colorLinear: [0.7, 0.7, 0.7]
  }]);
  const harness = fakeComputeDevice();
  let firstLane = null;
  for (let index = 0; index < 5; index += 1) {
    const acquisition = acquireSphMaterialInterfaceSourceFieldLocalGpuLane(harness.device, {
      surfaceTable,
      particleCapacity: 1,
      poolMaxEntries: 4,
      laneId: `bounded-lane-${index}`,
      stateKey: 'test/bounded-state'
    });
    firstLane ??= acquisition.lane;
    acquisition.release();
  }
  const summary = summarizeSphMaterialInterfaceSourceFieldLocalGpuLanePool(harness.device);
  assert.equal(summary.maxEntries, 4);
  assert.equal(summary.entryCount, 4);
  assert.equal(summary.evictionCount, 1);
  assert.equal(firstLane.getState().destroyed, true);
  const active = acquireSphMaterialInterfaceSourceFieldLocalGpuLane(harness.device, {
    surfaceTable,
    particleCapacity: 1,
    poolMaxEntries: 4,
    laneId: 'bounded-lane-4',
    stateKey: 'test/bounded-state'
  });
  const blocked = destroySphMaterialInterfaceSourceFieldLocalGpuLanePool(harness.device);
  assert.equal(blocked.status, 'material-interface-source-field-lane-pool-destroy-blocked-active-acquisitions');
  assert.equal(blocked.blockedActiveAcquisitionCount, 1);
  active.release();
  const destroyed = destroySphMaterialInterfaceSourceFieldLocalGpuLanePool(harness.device);
  assert.equal(destroyed.destroyedEntryCount, 4);
});
