import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SCHROEDER_SPATIAL_FIELD_CONSUMER_DIRECT_DISPATCH_MAGIC,
  SCHROEDER_SPATIAL_FIELD_CONSUMER_DISPATCH_SNAPSHOT_OFFSET_BYTES,
  SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_PARAMS_BYTES,
  schroederSpatialPhaseVolumeSurfaceStressTransportWgsl,
  schroederSpatialPhaseVolumeTransportWgsl
} from '../ulg-gpu-abi/src/index.js';
import { mlsMpmMechanicsFieldGridUpdateWgsl } from '../src/runtime/sph/sphMlsMpmGpuStep.js';
import { consumerDispatchMaxLinearGroups } from '../src/runtime/sph/schroederSpatialMechanicsFieldViewGpu.js';

// A1: the mechanics-field grid-update sequence launches its field consumers
// with direct 1D dispatches instead of dispatchWorkgroupsIndirect (about 0.3 ms
// of Chromium GPU-process validation each). Exactness rests on every consumer
// entry admitting only workgroups the staged indirect launch would have run,
// before any other statement, and only when the host armed the snapshot.
// Live evidence: identical rigid-frame hashes for direct and forced-indirect
// Iron Ice runs at step 336 (scripts/a1-ab-check.mjs).

const firstStatement = (wgsl, entry) => {
  const start = wgsl.indexOf(`\nfn ${entry}(`);
  assert.ok(start >= 0, `${entry} exists`);
  const body = wgsl.indexOf(') {\n', start) + 4;
  return wgsl.slice(body, wgsl.indexOf('\n', body)).trim();
};

test('A1: every converted field consumer guards on the dispatch snapshot first', () => {
  const guard = 'if (direct_dispatch_excludes(workgroup_id)) { return; }';
  for (const [wgsl, entries] of [
    [mlsMpmMechanicsFieldGridUpdateWgsl,
      ['clear_heat_rows', 'main', 'contact_fields', 'summarize_heat_rows']],
    [schroederSpatialPhaseVolumeTransportWgsl,
      ['stage_transport', 'validate_staged_transport', 'commit_transport']],
    [schroederSpatialPhaseVolumeSurfaceStressTransportWgsl,
      ['initialize_surface_stress', 'dispatch_surface_stress_pass',
        'validate_surface_stress', 'commit_surface_stress']]
  ]) {
    for (const entry of entries) assert.equal(firstStatement(wgsl, entry), guard, entry);
    // Inert unless the host wrote the magic; excludes 2D/3D launches and
    // everything at or past the staged x*y (z == 0 means rejected: nothing runs).
    assert.match(wgsl, new RegExp(`FIELD_CONSUMER_DIRECT_DISPATCH_MAGIC: u32 = ${
      SCHROEDER_SPATIAL_FIELD_CONSUMER_DIRECT_DISPATCH_MAGIC}u;`));
    assert.match(wgsl, /workgroup_id\.y != 0u \|\| workgroup_id\.z != 0u/);
  }
  // The single-entry surface-stress stages all route through the guarded helper.
  const stages = [...schroederSpatialPhaseVolumeSurfaceStressTransportWgsl
    .matchAll(/@compute[^\n]*\nfn (stage_surface_stress_\w+)\(/g)].map((m) => m[1]);
  assert.equal(stages.length, 18);
  for (const stage of stages) {
    // Bodies are either one line ("{ dispatch_...(...); }") or two.
    const at = schroederSpatialPhaseVolumeSurfaceStressTransportWgsl.indexOf(`\nfn ${stage}(`);
    const text = schroederSpatialPhaseVolumeSurfaceStressTransportWgsl.slice(at,
      schroederSpatialPhaseVolumeSurfaceStressTransportWgsl.indexOf('}', at) + 1);
    assert.match(text,
      /\) \{\s*dispatch_surface_stress_pass\(local_id, workgroup_id, \d+u, [01]u\);\s*\}$/, stage);
  }
});

test('A1: the snapshot occupies the last 16 bytes of the shared params uniform', () => {
  assert.equal(SCHROEDER_SPATIAL_FIELD_CONSUMER_DISPATCH_SNAPSHOT_OFFSET_BYTES + 16,
    SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_PARAMS_BYTES);
  // The grid-update view pads to the same offset; the transport views rename
  // their reserved12..15 words.
  assert.match(mlsMpmMechanicsFieldGridUpdateWgsl,
    /shared_transport_params: array<vec4<u32>, 10>,[\s\S]*dispatch_snapshot: vec4<u32>,/);
  for (const wgsl of [schroederSpatialPhaseVolumeTransportWgsl,
    schroederSpatialPhaseVolumeSurfaceStressTransportWgsl]) {
    assert.match(wgsl, /dispatch_snapshot_x: u32,\s*dispatch_snapshot_y: u32,\s*dispatch_snapshot_z: u32,\s*dispatch_snapshot_w: u32,\s*};/);
  }
});

test('A1: direct consumer launches only when the capacity cannot fold into 2D', () => {
  assert.equal(consumerDispatchMaxLinearGroups(50976, 65535), 797);
  assert.equal(consumerDispatchMaxLinearGroups(64, 65535), 1);
  assert.equal(consumerDispatchMaxLinearGroups(65535 * 64 + 1, 65535), null);
  assert.equal(consumerDispatchMaxLinearGroups(0, 65535), null);
  assert.equal(consumerDispatchMaxLinearGroups(100, 0), null);
});
