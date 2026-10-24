import assert from 'node:assert/strict';
import test from 'node:test';
import { compileSphGasConstitutive, evaluateSphGasSoundSpeed, assertSphMechanicsGasLayout,
  assertSphReactionGasLayout } from '../ulg-gpu-abi/src/sphGasConstitutive.js';
import { buildMlsMpmMechanicsMaterialTable, findMechanicsMaterialPhaseRecord } from '../src/runtime/sph/sphMechanicsMaterialTable.js';
import { buildSphReactionTable } from '../src/runtime/sph/sphReactionGpuKernel.js';
import { reactionTablesExactlyEqual } from '../src/runtime/sph/sphStaticTableInputs.js';
import { packSphPhaseCarrierClosureRows } from '../src/runtime/sph/sphPhaseCarrierTransferGpu.js';
import { refreshMlsMpmMechanicsCpu, uploadMlsMpmMechanicsMaterialPhaseRecords,
  uploadedMechanicsMaterialPhaseRecordsMatch } from '../src/runtime/sph/sphMechanicsRefreshGpuKernel.js';
import { ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA, ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA } from '../ulg-gpu-abi/src/index.js';
import { createReferenceMaterialClosures } from '../src/runtime/material/materialClosures.js';
import { specificInternalEnergyJPerKg } from '../src/runtime/material/thermoState.js';
import { createSphState } from '../src/runtime/sph/sphState.js';
import { buildMlsMpmGpuParticleBuffers } from '../src/runtime/sph/sphGpuBuffers.js';

// Manufactured R_specific=100, Cp=400, gamma=4/3. No empirical calibration.
const gas = { name: 'gas', cpJPerKgK: 400, densityKgPerM3: 1, temperatureK: 900 };
const liquid = { name: 'liquid', cpJPerKgK: 400, densityKgPerM3: 1000, bulkModulusPa: 1e6 };
const material = { molarMassKgPerMol: 8.314462618 / 100, phases: [liquid, gas] };
const properties = { probe: material };
const near = (a, b) => assert.ok(Number.isFinite(a) && Math.abs(a - b) <= Math.max(2e-5, Math.abs(b) * 2e-7), `${a} != ${b}`);
const expected = (t, options) => Math.max(options.cflMaxSoundSpeedMPerS > 0
  ? Math.min(Math.sqrt(400 / 300 * 100 * t), options.cflMaxSoundSpeedMPerS)
  : Math.sqrt(400 / 300 * 100 * t) * (options.soundSpeedScale ?? 1), options.minGasSoundSpeedMPerS ?? 40);

for (const options of [{}, { soundSpeedScale: .25 }, { cflMaxSoundSpeedMPerS: 180, soundSpeedScale: .01 },
  { cflMaxSoundSpeedMPerS: 20, minGasSoundSpeedMPerS: 40 }, { soundSpeedScale: .001, minGasSoundSpeedMPerS: 5 }]) {
  test(`gas c(T) evaluates before numerical limits: ${JSON.stringify(options)}`, () => {
    const law = compileSphGasConstitutive(material, gas, options);
    const table = buildMlsMpmMechanicsMaterialTable(properties, options);
    const materialId = table.records[0];
    for (const t of [1, 100, 400, 900, 3600]) {
      near(evaluateSphGasSoundSpeed(law, t), expected(t, options));
      near(findMechanicsMaterialPhaseRecord(table, materialId, 3, t).soundSpeedMPerS, expected(t, options));
    }
    assert.equal(table.recordStrideFloats, 12);
    assert.equal(table.phaseRecordCount, 2);
    assert.equal(assertSphMechanicsGasLayout(table), 6);
    assert.deepEqual(Array.from(table.records.subarray(24, 28)), [0, 0, 0, 0]);
    assert.equal(findMechanicsMaterialPhaseRecord(table, materialId, 2, NaN).soundSpeedMPerS,
      findMechanicsMaterialPhaseRecord(table, materialId, 2, 400).soundSpeedMPerS, 'condensed unchanged');
  });
}

test('invalid cold parameters and live temperatures fail closed', () => {
  const law = compileSphGasConstitutive(material, gas);
  for (const t of [0, -1, NaN, Infinity, 1e40, Number.MIN_VALUE]) assert.equal(evaluateSphGasSoundSpeed(law, t), -1);
  for (const key of ['soundSpeedScale', 'cflMaxSoundSpeedMPerS', 'minGasSoundSpeedMPerS']) {
    for (const value of [-1, NaN, Infinity, 1e40]) assert.throws(() => compileSphGasConstitutive(material, gas, { [key]: value }));
  }
  for (const mass of [0, -1, NaN, Infinity, 1e-45]) assert.throws(() => compileSphGasConstitutive({ molarMassKgPerMol: mass }, gas));
  assert.deepEqual(compileSphGasConstitutive({}, liquid), [0, 0, 0, 0]);
});

test('actual MLS packer honors explicit CFL option before the global scale', () => {
  const h2o = createReferenceMaterialClosures().h2o.properties;
  const state = createSphState({ smoothingLengthM: .1, particles: [{ material: 'h2o', massKg: .001, x: [0, 0, 0], v: [0, 0, 0],
    specificInternalEnergyJPerKg: specificInternalEnergyJPerKg(h2o, 800) }] });
  const result = buildMlsMpmGpuParticleBuffers(state, { materialProperties: { h2o },
    cflMaxSoundSpeedMPerS: 600, soundSpeedScale: .01, minGasSoundSpeedMPerS: 0 });
  assert.equal(result.cflMaxSoundSpeedMPerS, 600);
  assert.equal(result.mechanics[25], 600);
});

test('closure preserves phase and thermal material prefixes, with an exact law tail', () => {
  const mechanics = buildMlsMpmMechanicsMaterialTable(properties);
  const thermal = { segments: Float32Array.from({ length: 12 }, (_, i) => i), records: Float32Array.from({ length: 8 }, (_, i) => i + 100) };
  const closure = packSphPhaseCarrierClosureRows(thermal, mechanics);
  assert.equal(closure.mechanicsRecordCount, 2);
  assert.equal(closure.materialRecordOffsetVec4, 9);
  assert.deepEqual(closure.values.slice(12, 36), mechanics.records.slice(0, 24));
  assert.deepEqual(closure.values.slice(36, 44), thermal.records);
  assert.deepEqual(closure.values.slice(44), mechanics.records.slice(24));
  for (const mutate of [t => t.records = t.records.slice(0, -1), t => t.gasConstitutiveOffsetVec4++,
    t => t.phaseRecordCount++, t => t.records[24] = 1, t => t.records[28] = -1,
    t => delete t.gasConstitutiveSchema]) {
    const table = buildMlsMpmMechanicsMaterialTable(properties); mutate(table);
    assert.throws(() => assertSphMechanicsGasLayout(table));
    assert.throws(() => packSphPhaseCarrierClosureRows(thermal, table));
  }
});

test('reaction cap and combined-tail cache identity are shared with mechanics', () => {
  const reactions = [{ a: 'a', b: 'b', product: 'probe' }];
  const options = { materialProperties: properties, cflMaxSoundSpeedMPerS: 180, soundSpeedScale: .01, minGasSoundSpeedMPerS: 0 };
  const table = buildSphReactionTable(reactions, options);
  const copy = buildSphReactionTable(reactions, options);
  assert.equal(table.productPhaseRecords[18], 180, 'reaction builder honors CFL');
  assert.equal(assertSphReactionGasLayout(table), table.gasConstitutiveOffsetVec4);
  assert.equal(reactionTablesExactlyEqual(table, copy), true);
  copy.combinedRecords[copy.gasConstitutiveOffsetVec4 * 4 + 4] *= 2;
  assert.equal(reactionTablesExactlyEqual(table, copy), false);
  assert.throws(() => assertSphReactionGasLayout(copy));
  copy.gasConstitutiveRecords[4] *= 2;
  assert.doesNotThrow(() => assertSphReactionGasLayout(copy));
  assert.equal(reactionTablesExactlyEqual(table, copy), false);
});

test('reaction tail cannot be stripped of its version or extended with arbitrary bytes', () => {
  for (const mutate of [t => { delete t.gasConstitutiveSchema; delete t.gasConstitutiveRecords; delete t.gasConstitutiveOffsetVec4; },
    t => { t.combinedRecords = new Float32Array([...t.combinedRecords, 0, 0, 0, 0]); t.combinedRecordCount++; }]) {
    const table = buildSphReactionTable([{ a: 'a', b: 'b', product: 'probe' }], { materialProperties: properties });
    mutate(table); assert.throws(() => assertSphReactionGasLayout(table));
  }
});

test('legacy reaction tables may omit a redundant count, but never unknown combined bytes', () => {
  const records = new Float32Array(12);
  const table = { records, combinedRecords: records };
  assert.equal(assertSphReactionGasLayout(table), 0);
  for (const combinedRecordCount of [NaN, Infinity, -1, 0, 3.5, 0x1_0000_0000]) {
    assert.throws(() => assertSphReactionGasLayout({ ...table, combinedRecordCount }));
  }
  assert.equal(assertSphReactionGasLayout({ ...table, combinedRecordCount: 3 }), 0);
  assert.throws(() => assertSphReactionGasLayout({ ...table, combinedRecords: new Float32Array(16) }));
  const typed = buildSphReactionTable([{ a: 'a', b: 'b', product: 'probe' }], { materialProperties: properties });
  delete typed.combinedRecordCount;
  assert.throws(() => assertSphReactionGasLayout(typed), 'new-schema count remains mandatory');
  delete typed.gasConstitutiveSchema; delete typed.gasConstitutiveRecords; delete typed.gasConstitutiveOffsetVec4;
  assert.throws(() => assertSphReactionGasLayout(typed), 'missing legacy count cannot hide a downgraded tail');
});

test('refresh uses live T and rejects a bad second row atomically', () => {
  const table = buildMlsMpmMechanicsMaterialTable(properties, { minGasSoundSpeedMPerS: 0 });
  const id = table.records[0];
  const sph = { schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA, particleCount: 2,
    state: new Float32Array([0, 0, 0, 1, 0, 0, 0, 10, 0, 0, 0, 1, 0, 0, 0, 20]),
    thermo: new Float32Array([id, 3, 100, 1, 0, 0, 1, 0, 1, 1, 1, 1, id, 3, 400, 1, 0, 0, 1, 0, 1, 1, 1, 1]) };
  const mls = { schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA, particleCount: 2, mechanics: new Float32Array(64) };
  for (const i of [0, 32]) {
    for (const lane of [0, 4, 8, 18, 19, 21, 27, 31]) mls.mechanics[i + lane] = 1;
    mls.mechanics[i + 25] = 300; mls.mechanics[i + 26] = 2;
  }
  const result = refreshMlsMpmMechanicsCpu({ sphParticleState: sph, mlsMpmParticleState: mls, mechanicsMaterialTable: table });
  near(result.mechanics[25], expected(100, { minGasSoundSpeedMPerS: 0 }));
  near(result.mechanics[57], expected(400, { minGasSoundSpeedMPerS: 0 }));
  for (const bad of [0, -1, NaN, Infinity]) {
    sph.thermo[14] = bad;
    const rejected = refreshMlsMpmMechanicsCpu({ sphParticleState: sph, mlsMpmParticleState: mls, mechanicsMaterialTable: table });
    assert.deepEqual(rejected.mechanics, mls.mechanics);
    assert.equal(rejected.authorityValidationFailureCount, 1);
  }
});

test('uploaded mechanics identity includes law tail and malformed layouts allocate nothing', () => {
  const table = buildMlsMpmMechanicsMaterialTable(properties);
  let allocations = 0;
  const device = { createBuffer: () => { allocations++; return { destroy() {} }; }, queue: { writeBuffer() {} } };
  const upload = uploadMlsMpmMechanicsMaterialPhaseRecords(device, table);
  assert.equal(uploadedMechanicsMaterialPhaseRecordsMatch(upload, table, device), true);
  table.records[28] *= 2;
  assert.equal(uploadedMechanicsMaterialPhaseRecordsMatch(upload, table, device), false);
  table.records[28] = -1;
  assert.throws(() => uploadMlsMpmMechanicsMaterialPhaseRecords(device, table));
  assert.equal(allocations, 1);
  upload.destroyMechanicsMaterialPhaseUpload();
});
