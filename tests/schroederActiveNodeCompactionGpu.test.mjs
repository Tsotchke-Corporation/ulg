import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SCHROEDER_ACTIVE_NODE_COMPACTION_KEY_WORDS,
  SCHROEDER_ACTIVE_NODE_COMPACTION_SCHEMA,
  runSchroederActiveNodeCompactionEvidenceWebGpu,
  schroederActiveNodeCompactionEmitWgsl,
  schroederActiveNodeCompactionKeyWgsl
} from '../src/runtime/sph/schroederActiveNodeCompactionGpu.js';
import {
  SCHROEDER_ACTIVE_NODE_ROW_LAYOUT,
  WEBGPU_RADIX_UNIQUE_EVIDENCE_ROW_LAYOUT
} from '../ulg-gpu-abi/src/index.js';
import { WEBGPU_RADIX_MAX_KEY_WORDS } from '../src/runtime/webgpuRadixScanUnique.js';

test('the key is exactly the fields that make two rows interchangeable', () => {
  // level, chart, min_tile.xyz, max_tile.xyz. If a consumer ever starts reading
  // a field that is not in this key, two rows sharing a key stop being
  // interchangeable and the compaction becomes lossy.
  const indices = [0, 15, 1, 2, 3, 4, 5, 6];
  for (const [word, rowIndex] of indices.entries()) {
    assert.match(
      schroederActiveNodeCompactionKeyWgsl,
      new RegExp(`sort_keys\\[key_at \\+ ${word}u\\] = order_key\\(active_nodes\\[at \\+ ${rowIndex}u\\]\\)`),
      `key word ${word} must come from active-node row field ${rowIndex}`
    );
  }
  assert.equal(indices.length, SCHROEDER_ACTIVE_NODE_COMPACTION_KEY_WORDS);
  assert.deepEqual(
    indices.map((index) => SCHROEDER_ACTIVE_NODE_ROW_LAYOUT[index]),
    [
      'levelId:f32',
      'chartId:f32',
      'tileMinX:f32',
      'tileMinY:f32',
      'tileMinZ:f32',
      'tileMaxX:f32',
      'tileMaxY:f32',
      'tileMaxZ:f32'
    ]
  );
});

test('the key fits the radix primitive without widening it', () => {
  assert.ok(
    SCHROEDER_ACTIVE_NODE_COMPACTION_KEY_WORDS <= WEBGPU_RADIX_MAX_KEY_WORDS,
    'the key must fit the existing sort, not require a wider one'
  );
});

test('signed tile coordinates are order-preserved, not raw bitcast', () => {
  // A support box crossing the origin produces negative tile coordinates. A
  // raw bitcast sorts those above every positive coordinate, which would split
  // one node into two groups and understate compaction.
  assert.match(schroederActiveNodeCompactionKeyWgsl, /\^ 0x80000000u/);
  assert.match(schroederActiveNodeCompactionKeyWgsl, /bitcast<u32>\(i32\(round\(value\)\)\)/);
});

test('a rejected row gets a sentinel key rather than joining a real node', () => {
  assert.match(schroederActiveNodeCompactionKeyWgsl, /sort_keys\[key_at \+ word\] = 0xffffffffu/);
  // And it is counted separately, so the host can subtract its group back out.
  assert.match(schroederActiveNodeCompactionKeyWgsl, /atomicAdd\(&row_evidence\[1\], 1u\)/);
  assert.match(schroederActiveNodeCompactionKeyWgsl, /atomicAdd\(&row_evidence\[0\], 1u\)/);
});

test('the status gate matches the active-node row layout', () => {
  assert.equal(SCHROEDER_ACTIVE_NODE_ROW_LAYOUT[11], 'status:f32');
  assert.match(schroederActiveNodeCompactionKeyWgsl, /let status = active_nodes\[at \+ 11u\]/);
});

test('unique_count is read from the field the radix actually writes', () => {
  // The evidence row is rebuilt field by field elsewhere in this tree; pinning
  // the index here catches a layout change that would otherwise read a
  // neighbouring counter and report a plausible wrong ratio.
  assert.equal(WEBGPU_RADIX_UNIQUE_EVIDENCE_ROW_LAYOUT[2], 'unique_count:u32');
});

test('an empty list reports skipped with a null ratio, not a fabricated one', async () => {
  const result = await runSchroederActiveNodeCompactionEvidenceWebGpu({
    device: { createBuffer() {}, queue: { writeBuffer() {} } },
    activeNodeBuffer: { label: 'empty' },
    rowCount: 0
  });
  assert.equal(result.schema, SCHROEDER_ACTIVE_NODE_COMPACTION_SCHEMA);
  assert.equal(result.status, 'schroeder-active-node-compaction-skipped-empty');
  assert.equal(result.compactionRatio, null, 'no rows means no ratio, not 0 and not Infinity');
});

test('a missing retained buffer is refused rather than silently skipped', async () => {
  await assert.rejects(
    () => runSchroederActiveNodeCompactionEvidenceWebGpu({
      device: { createBuffer() {}, queue: { writeBuffer() {} } },
      activeNodeList: { activeCandidateCount: 8 }
    }),
    /requires a retained active-node buffer/
  );
});

test('a non-WebGPU device is refused', async () => {
  await assert.rejects(
    () => runSchroederActiveNodeCompactionEvidenceWebGpu({ device: {} }),
    /requires a WebGPU-like device/
  );
});

test('the emit kernel derives the group from an inclusive head count, not a raw index', () => {
  // `sorted_group_indices` is an inclusive head count. Reading it as a group
  // index directly would put every particle on its neighbour's node -- a bug
  // that produces plausible geometry and wrong neighbours.
  assert.match(
    schroederActiveNodeCompactionEmitWgsl,
    /inclusive_head_count = sorted_group_indices\[sorted_position \+ 1u\]/
  );
  assert.match(schroederActiveNodeCompactionEmitWgsl, /let group_index = inclusive_head_count - 1u/);
  // The last sorted position has no successor to read, so it falls back to the
  // unique count rather than reading off the end.
  assert.match(schroederActiveNodeCompactionEmitWgsl, /var inclusive_head_count = unique_count/);
});

test('the representative is the group head, and only it writes a row', () => {
  assert.match(
    schroederActiveNodeCompactionEmitWgsl,
    /if \(sorted_position != unique_offsets\[group_index\]\) \{\s*return;/
  );
});

test('every particle gets an index, including non-representatives', () => {
  // The scatter must happen before the head test returns, or only one particle
  // per group would ever be given a node.
  const scatterAt = schroederActiveNodeCompactionEmitWgsl.indexOf('node_index_by_particle[source_index]');
  const headTestAt = schroederActiveNodeCompactionEmitWgsl.indexOf('unique_offsets[group_index]');
  assert.ok(scatterAt > 0 && headTestAt > 0);
  assert.ok(scatterAt < headTestAt, 'the scatter must precede the head early-return');
});

test('the sentinel group is written canonically zero, not from an arbitrary member', () => {
  // Rejected rows share one group. Copying any one member would publish that
  // particle's position as the whole group's.
  assert.match(
    schroederActiveNodeCompactionEmitWgsl,
    /compacted_nodes\[target_at \+ word\] = 0\.0;/
  );
});

test('the emit kernel bounds every index it trusts from the GPU', () => {
  for (const guard of [
    /source_index >= params\.row_count/,
    /group_index >= unique_count/,
    /group_index >= params\.node_capacity/,
    /sorted_position >= params\.row_count/
  ]) {
    assert.match(schroederActiveNodeCompactionEmitWgsl, guard);
  }
});

test('emitting is opt-in so measuring stays cheap', async () => {
  const result = await runSchroederActiveNodeCompactionEvidenceWebGpu({
    device: { createBuffer() {}, queue: { writeBuffer() {} } },
    activeNodeBuffer: { label: 'empty' },
    rowCount: 0
  });
  // The empty path returns before either pass, so it reports neither.
  assert.equal(result.compactedNodesEmitted, undefined);
});
