import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SPH_MATERIAL_INTERFACE_ELEMENT_ROW_LAYOUT,
  SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT
} from '../ulg-gpu-abi/src/index.js';
import {
  createPressureInterfaceParamsArray,
  packMaterialInterfaceElementRows,
  runSphPressureInterfaceForceRowsWebGpu
} from '../src/runtime/sph/sphPressureInterfaceGpuKernel.js';

function interfaceFieldFixture() {
  return {
    schema: 'peercompute.ulg.sph-material-interface-field.v0',
    status: 'material-interface-field-ready',
    surfaceCount: 1,
    readySurfaceCount: 1,
    totalSurfaceAreaM2: 2,
    elementCount: 2,
    elements: [
      {
        status: 'interface-element-ready',
        surfaceIndex: 0,
        surfaceKey: 'h2o|liquid',
        material: 'h2o',
        phase: 'liquid',
        materialId: 1,
        phaseId: 2,
        axisId: 0,
        centroidM: [0.5, 1, 1],
        areaM2: 1,
        normal: [1, 0, 0],
        normalAreaVectorM2: [1, 0, 0]
      },
      {
        status: 'interface-element-ready',
        surfaceIndex: 0,
        surfaceKey: 'h2o|liquid',
        material: 'h2o',
        phase: 'liquid',
        materialId: 1,
        phaseId: 2,
        axisId: 0,
        centroidM: [1.5, 1, 1],
        areaM2: 1,
        normal: [-1, 0, 0],
        normalAreaVectorM2: [-1, 0, 0]
      }
    ]
  };
}

function fakePressureDevice() {
  const createdBuffers = [];
  const writes = [];
  const bindGroups = [];
  const dispatches = [];
  const shaderModules = [];
  const submissions = [];
  const copies = [];
  return {
    createdBuffers,
    writes,
    bindGroups,
    dispatches,
    shaderModules,
    submissions,
    copies,
    queue: {
      writeBuffer(buffer, offset, data) {
        writes.push({ label: buffer.label, offset, byteLength: data?.byteLength ?? 0 });
      },
      submit(commands) {
        submissions.push(commands);
      },
      async onSubmittedWorkDone() {}
    },
    createBuffer({ label, size, usage }) {
      const buffer = {
        label,
        size,
        usage,
        destroyed: false,
        destroy() {
          this.destroyed = true;
        },
        async mapAsync() {},
        getMappedRange() {
          return new ArrayBuffer(size);
        },
        unmap() {
          this.unmapped = true;
        }
      };
      createdBuffers.push(buffer);
      return buffer;
    },
    createShaderModule({ code }) {
      const module = { code };
      shaderModules.push(module);
      return module;
    },
    createComputePipeline({ compute }) {
      return {
        compute,
        getBindGroupLayout(index) {
          return { index, entryPoint: compute.entryPoint };
        }
      };
    },
    createBindGroup({ layout, entries }) {
      const bindGroup = { layout, entries };
      bindGroups.push(bindGroup);
      return bindGroup;
    },
    createCommandEncoder() {
      return {
        beginComputePass() {
          return {
            setPipeline() {},
            setBindGroup() {},
            dispatchWorkgroups(count) {
              dispatches.push(count);
            },
            end() {}
          };
        },
        copyBufferToBuffer(source, sourceOffset, target, targetOffset, size) {
          copies.push({ source, sourceOffset, target, targetOffset, size });
        },
        finish() {
          return { command: 'finished' };
        }
      };
    }
  };
}

test('pressure/interface WebGPU producer packs material interface element rows', () => {
  const packed = packMaterialInterfaceElementRows(interfaceFieldFixture());

  assert.equal(packed.rowCount, 2);
  assert.equal(packed.rowStrideFloats, SPH_MATERIAL_INTERFACE_ELEMENT_ROW_LAYOUT.length);
  assert.equal(packed.rows.length, 2 * SPH_MATERIAL_INTERFACE_ELEMENT_ROW_LAYOUT.length);
  assert.deepEqual([...packed.rows.slice(0, 16)], [
    0, 1, 2, 0,
    0.5, 1, 1, 1,
    1, 0, 0, 1,
    0, 0, 0, 1
  ]);

  const params = createPressureInterfaceParamsArray({ elementCount: 2, pressurePa: 120000 });
  const view = new DataView(params);
  assert.equal(params.byteLength, 16);
  assert.equal(view.getUint32(0, true), 2);
  assert.equal(view.getFloat32(4, true), 120000);
});

test('pressure/interface WebGPU producer dispatches no-full retained force-row buffer', async () => {
  const device = fakePressureDevice();
  const result = await runSphPressureInterfaceForceRowsWebGpu({
    device,
    pressureFeedback: {
      schema: 'peercompute.ulg.sph-sealed-gas-pressure-feedback.v0',
      status: 'wall-pressure-ledger-ready',
      totalPressurePa: 120000,
      gasCellField: { uniformPressurePa: 120000 }
    },
    pressureInterfaceCoupling: {
      schema: 'peercompute.ulg.sph-pressure-interface-coupling.v0',
      status: 'pressure-interface-coupling-ready-for-solver',
      forceCouplingStatus: 'pressure-interface-coupling-ready'
    },
    materialInterfaceField: interfaceFieldFixture(),
    retainForceRowsBuffer: true,
    readbackMode: 'no-full-readback'
  });

  assert.equal(result.backend, 'webgpu');
  assert.equal(result.status, 'pressure-interface-stage-solver-ready');
  assert.equal(result.readbackMode, 'no-full-readback');
  assert.equal(result.fullReadbackPerformed, false);
  assert.equal(result.queueCompletionStatus, 'queue-submitted-cleanup-deferred');
  assert.equal(result.pressureInterfaceForceSolver.forceRowCount, 2);
  assert.equal(result.pressureInterfaceForceSolver.forceRowValues.length, 0);
  assert.equal(result.forceRowByteLength, 2 * SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT.length * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(result.forceRowsBuffer?.label, 'ulg-sph-pressure-interface-force-rows-out');
  assert.equal(device.dispatches[0], 1);
  assert.equal(device.submissions.length, 1);
  assert.equal(device.copies.length, 0);
  assert.ok(device.writes.some((entry) => entry.label === 'ulg-sph-pressure-interface-elements-in'));
  assert.ok(device.writes.some((entry) => entry.label === 'ulg-sph-pressure-interface-force-params'));
  assert.equal(result.pressureInterfaceForceSolver.conservationStatus, 'pairwise-equal-opposite-force-conservative');
});
