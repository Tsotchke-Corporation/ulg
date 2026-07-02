import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SCHROEDER_PARTICLE_STORAGE_COUNT_SUMMARY_ROW_LAYOUT
} from '../ulg-gpu-abi/src/index.js';
import { schroederParticleStorageCountSummaryWgsl } from '../ulg-gpu-abi/src/wgsl.js';
import {
  SCHROEDER_PARTICLE_STORAGE_COUNT_SUMMARY_FLOATS,
  ULG_SCHROEDER_PARTICLE_STORAGE_COUNT_SUMMARY_SCHEMA,
  createSchroederParticleStorageCountSummaryParamsArray,
  createSchroederParticleStorageCountSummaryPlan,
  decodeSchroederParticleStorageCountSummaryRow
} from '../src/runtime/sph/schroederParticleStorageCountGpu.js';

test('count summary schema, layout, and plan are stable', () => {
  assert.equal(
    ULG_SCHROEDER_PARTICLE_STORAGE_COUNT_SUMMARY_SCHEMA,
    'peercompute.ulg.schroeder-particle-storage-count-summary.v0'
  );
  assert.equal(SCHROEDER_PARTICLE_STORAGE_COUNT_SUMMARY_FLOATS, 16);
  assert.equal(SCHROEDER_PARTICLE_STORAGE_COUNT_SUMMARY_ROW_LAYOUT[5], 'admittedParticleCountDelta:f32');
  assert.equal(SCHROEDER_PARTICLE_STORAGE_COUNT_SUMMARY_ROW_LAYOUT[11], 'authoritativeParticleCount:f32');
  const plan = createSchroederParticleStorageCountSummaryPlan({
    materializationRowCount: 5,
    sourceParticleCount: 3
  });
  assert.equal(plan.materializationRowCount, 5);
  assert.equal(plan.sourceParticleCount, 3);
  assert.equal(plan.countPolicy, 'append-only-freed-slots-await-compaction');
  assert.equal(plan.summaryByteLength, 64);
  assert.equal(plan.fullParticleReadbackRequired, false);
});

test('count summary params array encodes row count, stride, and source count', () => {
  const plan = createSchroederParticleStorageCountSummaryPlan({
    materializationRowCount: 7,
    materializationStrideFloats: 32,
    sourceParticleCount: 4,
    flags: 9
  });
  const view = new DataView(createSchroederParticleStorageCountSummaryParamsArray(plan));
  assert.equal(view.getUint32(0, true), 7);
  assert.equal(view.getUint32(4, true), 32);
  assert.equal(view.getUint32(8, true), 4);
  assert.equal(view.getUint32(12, true), 9);
});

test('count summary decoder maps the 16-float row', () => {
  const row = new Float32Array(16);
  row[0] = 3;
  row[1] = 2;
  row[2] = 2;
  row[3] = 2;
  row[4] = 1;
  row[5] = 2;
  row[6] = 8;
  row[7] = 8;
  row[9] = 1;
  row[10] = 3;
  row[11] = 5;
  row[14] = 1;
  const decoded = decodeSchroederParticleStorageCountSummaryRow(row);
  assert.equal(decoded.materializationRowCount, 3);
  assert.equal(decoded.admittedRowCount, 2);
  assert.equal(decoded.appendedTargetSlotCount, 2);
  assert.equal(decoded.freedSourceSlotCount, 1);
  assert.equal(decoded.admittedParticleCountDelta, 2);
  assert.equal(decoded.sourceMassKg, 8);
  assert.equal(decoded.targetMassKg, 8);
  assert.equal(decoded.blockedRowCount, 1);
  assert.equal(decoded.sourceParticleCount, 3);
  assert.equal(decoded.authoritativeParticleCount, 5);
  assert.equal(decodeSchroederParticleStorageCountSummaryRow(new Float32Array(4)), null);
});

test('count summary WGSL declares append-only reduction over materialization rows', () => {
  assert.match(schroederParticleStorageCountSummaryWgsl, /struct SchroederParticleStorageCountSummaryParams/);
  assert.match(schroederParticleStorageCountSummaryWgsl, /@compute @workgroup_size\(64\)/);
  assert.match(schroederParticleStorageCountSummaryWgsl, /var<storage, read> materialization_rows/);
  assert.match(schroederParticleStorageCountSummaryWgsl, /var<storage, read_write> summary_row/);
  assert.match(schroederParticleStorageCountSummaryWgsl, /written_start >= f32\(params\.source_particle_count\)/);
});
