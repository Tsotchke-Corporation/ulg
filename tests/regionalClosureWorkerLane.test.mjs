import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createRegionalClosureWorkerLane,
  regionalClosureLaneBindings,
  encodeRegionalClosureLaneEvaluate,
  encodeRegionalClosureLaneAdopt,
  adoptExternalRegionalResponseTable,
  destroyRegionalClosureWorkerLane,
  REGIONAL_CLOSURE_WORKER_LANE_SCHEMA
} from '../src/runtime/material/regionalClosureWorkerLane.js';
import { deriveEosStiffnessResponse, ESHKOL_EOS_MODEL } from '../src/runtime/material/eshkolEosStiffness.js';
import { residentSphWebGpuLimitsForAdapter } from '../src/runtime/webgpuDeviceLimits.js';
import { schroederThermalDormancyWgsl } from '../src/runtime/sph/schroederThermalDormancyGpu.js';
import { SPH_PHASE_SCENARIO_PRESETS } from '../src/runtime/sphPhaseScenarioPresets.js';

function fakeDevice() {
  const buffers = [];
  const dispatches = [];
  const device = {
    limits: { maxStorageBuffersPerShaderStage: 16 },
    createBuffer({ label = '', size, usage }) {
      const b = {
        label,
        size,
        usage,
        data: new ArrayBuffer(size),
        destroyed: false,
        destroy() { this.destroyed = true; }
      };
      buffers.push(b);
      return b;
    },
    createShaderModule(opts) { return opts; },
    createBindGroupLayout(opts) { return opts; },
    createPipelineLayout(opts) { return opts; },
    createComputePipeline(opts) { return opts; },
    createBindGroup(opts) { return opts; },
    createCommandEncoder() {
      return {
        beginComputePass({ label } = {}) {
          let entryPoint = null;
          return {
            setPipeline(p) { entryPoint = p.compute.entryPoint; },
            setBindGroup() {},
            dispatchWorkgroups(x) { dispatches.push({ label, entryPoint, x }); },
            end() {}
          };
        },
        finish() { return {}; }
      };
    },
    queue: {
      writeBuffer(buffer, offset, data) {
        const src = ArrayBuffer.isView(data)
          ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
          : new Uint8Array(data);
        new Uint8Array(buffer.data, offset, src.byteLength).set(src);
      },
      submit() {}
    }
  };
  return { device, buffers, dispatches };
}

test('A3 regional closure worker lane evaluates, adopts GPU & Eshkol-AD generations under G5 reservations, and releases buffers', async () => {
  const { device, buffers, dispatches } = fakeDevice();
  const membersBuffer = device.createBuffer({ label: 'members', size: 1024, usage: 0x80 });
  const lane = createRegionalClosureWorkerLane(device, {
    regionCapacity: 4,
    memberCapacity: 64
  });
  assert.equal(lane.schema, REGIONAL_CLOSURE_WORKER_LANE_SCHEMA);
  assert.equal(regionalClosureLaneBindings(lane).ordinal, 0);

  const enc1 = device.createCommandEncoder();
  encodeRegionalClosureLaneEvaluate(lane, enc1, { membersBuffer, regionCount: 2, memberCount: 32 });
  assert.ok(dispatches.some((d) => d.entryPoint === 'accumulate_envelope'));
  assert.ok(dispatches.some((d) => d.entryPoint === 'fit_now'));
  assert.ok(dispatches.some((d) => d.entryPoint === 'lookup_members'));
  assert.ok(dispatches.some((d) => d.entryPoint === 'fit_pending'));

  const enc2 = device.createCommandEncoder();
  const gpuAdopted = encodeRegionalClosureLaneAdopt(lane, enc2, {
    membersBuffer,
    regionCount: 2,
    scheduleId: 'sched:1'
  });
  assert.equal(gpuAdopted.adopted, true);
  assert.equal(gpuAdopted.ordinal, 1);
  assert.ok(dispatches.some((d) => d.entryPoint === 'adopt_pending'));

  // Bridge an Eshkol-AD stiffness response function into the lane under G5 reservations.
  const derived = await deriveEosStiffnessResponse({
    eosModel: ESHKOL_EOS_MODEL.TAIT,
    restDensityKgPerM3: 1000,
    soundSpeedMPerS: 20,
    sample: async (_def, _call, points) => points.map(([rho]) => rho * 400 * (rho / 1000) ** 6)
  });
  const extAdopted = adoptExternalRegionalResponseTable(lane, derived.responseFunction, {
    scheduleId: 'sched:2',
    sourceFingerprint: derived.program.sourceFingerprint
  });
  assert.equal(extAdopted.adopted, true);
  assert.equal(extAdopted.ordinal, 2);
  assert.equal(regionalClosureLaneBindings(lane).tableBuffer, extAdopted.tableBuffer);

  // Subsequent GPU adoption retires the external table buffer cleanly.
  const prevExternal = extAdopted.tableBuffer;
  const enc3 = device.createCommandEncoder();
  const gpuAdopted2 = encodeRegionalClosureLaneAdopt(lane, enc3, {
    membersBuffer,
    regionCount: 2,
    scheduleId: 'sched:3'
  });
  assert.equal(gpuAdopted2.ordinal, 3);
  assert.equal(prevExternal.destroyed, true);

  destroyRegionalClosureWorkerLane(lane);
  assert.throws(() => regionalClosureLaneBindings(lane), /closed/);
  assert.ok(buffers.filter((b) => b !== membersBuffer).every((b) => b.destroyed));
});

test('webgpuDeviceLimits requests 16 storage buffers when adapter supports it while keeping 12 on 12-slot adapters', () => {
  assert.equal(
    residentSphWebGpuLimitsForAdapter({ limits: { maxStorageBuffersPerShaderStage: 12 } })
      .requiredLimits.maxStorageBuffersPerShaderStage,
    12
  );
  assert.equal(
    residentSphWebGpuLimitsForAdapter({ limits: { maxStorageBuffersPerShaderStage: 32 } })
      .requiredLimits.maxStorageBuffersPerShaderStage,
    16
  );
  assert.equal(
    residentSphWebGpuLimitsForAdapter({ limits: { maxStorageBuffersPerShaderStage: 15 } })
      .requiredLimits.maxStorageBuffersPerShaderStage,
    15
  );
});

test('G4 thermal dormancy WGSL carries per-source uncertainty intervals and live presets default thermalPotential ON', () => {
  assert.match(schroederThermalDormancyWgsl, /uncertainty:\s*vec4<u32>/);
  assert.match(schroederThermalDormancyWgsl, /fn source_uncertainty\(i: u32\) -> f32/);
  assert.match(schroederThermalDormancyWgsl, /abs\(temps\[w\] - t\) \+ dt > params\.config\.y/);
  for (const preset of SPH_PHASE_SCENARIO_PRESETS) {
    assert.equal(preset.runtime.thermalPotential, '1', `${preset.id} defaults thermalPotential ON`);
  }
});
