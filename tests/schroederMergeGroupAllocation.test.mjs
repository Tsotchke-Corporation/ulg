import assert from 'node:assert/strict';
import { test } from 'node:test';
import { schroederParticleStorageAllocationWgsl } from '../ulg-gpu-abi/src/wgsl.js';

test('particle-storage allocation WGSL declares exact merge-group leader election', () => {
  assert.match(schroederParticleStorageAllocationWgsl, /fn ss_psal_coarsen_row/);
  assert.match(schroederParticleStorageAllocationWgsl, /fn ss_psal_merge_group/);
  // Coarsen bit set, refine bit clear.
  assert.match(schroederParticleStorageAllocationWgsl, /& 2u\) != 0u && \(status_bits & 4u\) == 0u/);
  // Group scan keys on the aggregate node index column.
  assert.match(schroederParticleStorageAllocationWgsl, /apply_rows\[other_offset \+ 21u\]/);
  // Leader is the minimum source particle index in the cell.
  assert.match(schroederParticleStorageAllocationWgsl, /min\(group\.leader_source_index/);
  // Exactly one child slot for the leader, one freed slot per member, and
  // lone coarsen rows request nothing.
  assert.match(schroederParticleStorageAllocationWgsl, /allocation_count = select\(0\.0, 1\.0, is_leader\);/);
  assert.match(schroederParticleStorageAllocationWgsl, /group\.member_count >= 2u/);
});
