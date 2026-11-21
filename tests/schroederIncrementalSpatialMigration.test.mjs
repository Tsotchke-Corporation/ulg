import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SCHROEDER_INCREMENTAL_CERTIFICATE_WORDS,
  SCHROEDER_INCREMENTAL_FALLBACK_FLAG,
  SCHROEDER_INCREMENTAL_MIGRATION_MODE,
  ULG_SCHROEDER_INCREMENTAL_SPATIAL_CERTIFICATE_SCHEMA,
  ULG_SCHROEDER_INCREMENTAL_SPATIAL_MIGRATION_SCHEMA,
  createSchroederIncrementalSpatialMigrationEncoder,
  createSchroederIncrementalSpatialMigrationWgsl,
  createSchroederIncrementalSpatialScratchLayout,
  parseSchroederIncrementalSpatialCertificate
} from '../src/runtime/sph/schroederIncrementalSpatialMigrationGpu.js';
import {
  createSchroederSpatialEpochGpu,
  registerSchroederIncrementalSpatialMigrationEncoderFactory
} from '../src/runtime/sph/schroederSpatialEpochGpu.js';

test('A2 scratch layout partitions all CSR migration regions without overlap', () => {
  const layout = createSchroederIncrementalSpatialScratchLayout({
    maxSourceCount: 131072,
    cellCapacity: 131072,
    maxMovedMembers: 16384
  });
  assert.equal(layout.oldIncomingGroupOffset, 0);
  assert.equal(layout.oldIncomingGroupWords, 131072);
  assert.ok(layout.movedFlagOffset >= layout.oldIncomingGroupWords);
  assert.ok(layout.totalWords > 131072 * 4);
  assert.equal(layout.byteLength, layout.totalWords * 4);
  assert.equal(layout.atomicTotalWords, SCHROEDER_INCREMENTAL_CERTIFICATE_WORDS + 131072);
});

test('A2 certificate parser decodes conservative displacement ratio and fallback flags', () => {
  const words = new Uint32Array(SCHROEDER_INCREMENTAL_CERTIFICATE_WORDS);
  const floats = new Float32Array(words.buffer);
  words[0] = SCHROEDER_INCREMENTAL_MIGRATION_MODE.ADJACENT_CELL_REPAIR;
  words[1] = SCHROEDER_INCREMENTAL_FALLBACK_FLAG.NONE;
  words[2] = 42;
  words[3] = 19;
  words[4] = 5;
  words[5] = 3;
  words[6] = 1020;
  floats[7] = 0.375;
  words[8] = 1;
  words[9] = 7;
  words[10] = 6;
  words[11] = 1;
  const cert = parseSchroederIncrementalSpatialCertificate(words);
  assert.equal(cert.schema, ULG_SCHROEDER_INCREMENTAL_SPATIAL_CERTIFICATE_SCHEMA);
  assert.equal(cert.modeName, 'adjacent-cell-repair');
  assert.equal(cert.movedMemberCount, 42);
  assert.equal(cert.dirtyOldCellCount, 19);
  assert.equal(cert.insertedCellCount, 5);
  assert.equal(cert.droppedCellCount, 3);
  assert.equal(cert.admittedCellCount, 1020);
  assert.equal(cert.maxDisplacementRatio, 0.375);
  assert.equal(cert.maxCellJumpLinf, 1);
  assert.equal(cert.generationId, 7);
  assert.equal(cert.predecessorGenerationId, 6);
  assert.equal(cert.admitted, true);
});

test('A2 WGSL generator binds <= 8 storage buffers and defines all 16 single-pass stages', () => {
  const layout = createSchroederIncrementalSpatialScratchLayout({
    maxSourceCount: 4096,
    cellCapacity: 4096,
    maxMovedMembers: 1024
  });
  const wgsl = createSchroederIncrementalSpatialMigrationWgsl(layout);
  assert.equal(typeof ULG_SCHROEDER_INCREMENTAL_SPATIAL_MIGRATION_SCHEMA, 'string');
  const storageDecls = wgsl.match(/var<storage,/g) || [];
  assert.equal(storageDecls.length, 7, 'uses 7 storage buffers (<= 8 WebGPU minimum)');
  for (const fnName of [
    'detect_moved_members',
    'sort_moved_chunks',
    'merge_w1024',
    'merge_w8192',
    'classify_moved_groups',
    'scan_old_cells_local',
    'scan_old_cells_top',
    'scan_old_cells_add',
    'emit_surviving_old_cells',
    'emit_brand_new_cells',
    'copy_clean_old_members',
    'copy_brand_new_cell_members',
    'merge_dirty_cell_members',
    'finalize_migrated_directory'
  ]) {
    assert.ok(wgsl.includes(`fn ${fnName}`), `missing entry point ${fnName}`);
  }
});

test('A2 live spatial epoch runtime uses 1-pass incremental CSR migration on successor steps and falls back on contract changes', () => {
  registerSchroederIncrementalSpatialMigrationEncoderFactory(createSchroederIncrementalSpatialMigrationEncoder);
  const buffers = [];
  const createMockBuffer = ({ label, size, usage }) => {
    const b = { label, size, usage, destroyed: false, destroy() { this.destroyed = true; } };
    buffers.push(b);
    return b;
  };
  const mockDevice = {
    limits: { maxComputeWorkgroupsPerDimension: 65535, maxStorageBuffersPerShaderStage: 8 },
    createBuffer: createMockBuffer,
    createShaderModule: ({ code }) => ({ code }),
    createBindGroupLayout: (desc) => ({ desc }),
    createPipelineLayout: (desc) => ({ desc }),
    createComputePipeline: (desc) => ({ desc, getBindGroupLayout: () => ({}) }),
    createBindGroup: (desc) => ({ desc }),
    queue: { writeBuffer() {}, submit() {}, onSubmittedWorkDone: () => Promise.resolve() }
  };
  const createMockEncoder = () => ({
    clearBuffer() {},
    copyBufferToBuffer() {},
    beginComputePass() {
      return { setBindGroup() {}, setPipeline() {}, dispatchWorkgroups() {}, dispatchWorkgroupsIndirect() {}, end() {} };
    },
    finish() { return {}; }
  });

  const runtime = createSchroederSpatialEpochGpu(mockDevice, {
    maxSourceCount: 64,
    cellCapacity: 64,
    arenaCount: 2,
    enableIncrementalMigration: true
  });
  const srcA = createMockBuffer({ label: 'src-a', size: 64 * 64, usage: 0x80 });
  const srcB = createMockBuffer({ label: 'src-b', size: 64 * 64, usage: 0x80 });

  // Generation 1: bootstrap uses full radix
  const exec1 = runtime.encode(createMockEncoder(), {
    sourceBuffer: srcA,
    sourceCount: 32,
    sortMode: 'lexicographic-u32x5',
    generationId: 1,
    topologyEpoch: 1
  });
  assert.equal(exec1.a2IncrementalMigration.mode, 'full-radix');
  assert.ok(exec1.radixPassCount > 0);
  runtime.markExecutionSubmitted(exec1);

  // Generation 2: same contract -> 1-pass incremental CSR into distinct immutable arena!
  const exec2 = runtime.encode(createMockEncoder(), {
    sourceBuffer: srcB,
    sourceCount: 32,
    sortMode: 'lexicographic-u32x5',
    generationId: 2,
    topologyEpoch: 1
  });
  assert.equal(exec2.a2IncrementalMigration.mode, 'incremental-gpu-encoded');
  assert.equal(exec2.a2IncrementalMigration.predecessorGenerationId, 1);
  assert.equal(exec2.encodedComputePassCount, 1);
  assert.equal(exec2.encodedDispatchCount, 16);
  assert.equal(exec2.radixPassCount, 0);
  assert.notEqual(exec2.directoryBuffer, exec1.directoryBuffer, 'must write to distinct immutable arena');
  runtime.markExecutionSubmitted(exec2);

  // Release exec1 queue-ordered, then generation 3 with changed topologyEpoch -> falls back to full radix
  assert.equal(runtime.releaseExecutionQueueOrdered(exec1), true);
  const exec3 = runtime.encode(createMockEncoder(), {
    sourceBuffer: srcA,
    sourceCount: 32,
    sortMode: 'lexicographic-u32x5',
    generationId: 3,
    topologyEpoch: 2
  });
  assert.equal(exec3.a2IncrementalMigration.mode, 'full-radix');
  assert.ok(exec3.radixPassCount > 0);
  runtime.markExecutionSubmitted(exec3);

  assert.equal(runtime.releaseExecutionQueueOrdered(exec2), true);
  assert.equal(runtime.releaseExecutionQueueOrdered(exec3), true);
  assert.equal(runtime.destroy(), true);
});
