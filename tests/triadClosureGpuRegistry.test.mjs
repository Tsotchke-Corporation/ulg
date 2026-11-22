import test from 'node:test';
import assert from 'node:assert/strict';

import {
  destroyTriadClosureRegistry,
  getTriadClosureDeviceStatus,
  getTriadClosureGpuBinding,
  packUnpackedResponseSlices,
  registerGasResponseTableOnDevice,
  registerTriadClosureBundleOnDevice,
  triadClosureMechanicsRefreshWgsl,
  unpackPackedResponseTable
} from '../src/runtime/material/triadClosureGpuRegistry.js';
import { synthesizeMoonlabFirstPrinciplesClosures } from '../src/runtime/material/moonlabColdMissSynthesis.js';
import { buildMaterialGasResponseFunctions } from '../src/runtime/material/gasResponseFunctions.js';
import { stableOpticalMaterialId } from '../src/runtime/material/opticalGpuBuffers.js';

function createMockGpuDevice(maxStorageBuffersPerShaderStage = 12) {
  const writes = [];
  const created = [];
  return {
    writes,
    created,
    limits: {
      maxStorageBuffersPerShaderStage,
      maxBufferSize: 128 * 1024 * 1024,
      maxStorageBufferBindingSize: 128 * 1024 * 1024
    },
    queue: {
      writeBuffer(buffer, offset, data) {
        writes.push({ label: buffer.label, offset, byteLength: data.byteLength });
      },
      submit() {},
      onSubmittedWorkDone() {
        return Promise.resolve();
      }
    },
    createBuffer(desc) {
      const buf = { ...desc, destroyed: false, destroy() { this.destroyed = true; } };
      created.push(buf);
      return buf;
    }
  };
}

test('triadClosureGpuRegistry merges A4 gas and Triad 5-slot closures into one unified GPU table and material map', async () => {
  const device = createMockGpuDevice(12);
  const gasBundle = buildMaterialGasResponseFunctions({
    n2: {
      molarMassKgPerMol: 0.0280134,
      atomsPerFormula: 2,
      phases: [{ name: 'gas', densityKgPerM3: 1.16, cpJPerKgK: 1040, temperatureK: 293.15 }]
    }
  });
  const gasSlices = unpackPackedResponseTable(gasBundle.packedGpuTable.data);
  assert.equal(gasSlices.length, 6);
  const repacked = packUnpackedResponseSlices(gasSlices);
  assert.equal(repacked.length, gasBundle.packedGpuTable.data.length);
  for (let i = 0; i < repacked.length; i++) {
    assert.equal(repacked[i], gasBundle.packedGpuTable.data[i]);
  }

  const gasStatus = registerGasResponseTableOnDevice(device, {
    a4GasResponseTable: gasBundle.packedGpuTable,
    a4GasResponseByMaterial: gasBundle.byMaterial
  });
  assert.equal(gasStatus.active, true);
  assert.equal(gasStatus.gasMaterialCount, 1);
  assert.equal(gasStatus.triadMaterialCount, 0);
  assert.equal(gasStatus.functionCount, 4);

  const synth = await synthesizeMoonlabFirstPrinciplesClosures({
    material: 'fe',
    molarMassKgPerMol: 0.055845,
    atomsPerFormula: 1,
    cohesiveEnergyEvPerAtom: 4.28,
    debyeTemperatureK: 470,
    molecularDiameterM: 2.52e-10,
    refDensityKgPerM3: 7874,
    meltTemperatureK: 1811,
    temperatureRangeK: [240, 1200]
  });

  const triadStatus = registerTriadClosureBundleOnDevice(device, {
    materialKey: 'fe',
    materialId: stableOpticalMaterialId('fe'),
    packedData: synth.gpuBundle.packed.data,
    sourceFingerprint: synth.provenanceFingerprint,
    g6DebyeSamples: synth.g6DebyeSamples
  });
  assert.equal(triadStatus.active, true);
  assert.equal(triadStatus.triadMaterialCount, 1);
  assert.equal(triadStatus.gasMaterialCount, 1);
  assert.equal(triadStatus.materialCount, 2);
  assert.equal(triadStatus.functionCount, 9);
  assert.ok(triadStatus.generation >= 2);

  const binding = getTriadClosureGpuBinding(device);
  assert.equal(binding.active, true);
  assert.ok(binding.tableBuffer);
  assert.ok(binding.materialMapBuffer);
  assert.ok(binding.receiptBuffer);

  const wgsl = triadClosureMechanicsRefreshWgsl();
  assert.match(wgsl, /fn apply_triad_a4_mechanics_envelopes\(/);
  assert.match(wgsl, /triad_eval_helmholtz\(/);
  assert.match(wgsl, /triad_eval_solid_hyperelastic\(/);
  assert.match(wgsl, /triad_eval_transport\(/);

  assert.equal(destroyTriadClosureRegistry(device), true);
  assert.equal(getTriadClosureDeviceStatus(device).active, false);
});
