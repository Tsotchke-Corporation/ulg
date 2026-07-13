import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  ULG_NATIVE_REFRACTION_TRANSPORT_WGSL,
  ULG_NATIVE_REFRACTION_TRANSPORT_WGSL_SCHEMA
} from '../src/visualization/nativeRefractionTransportWgsl.js';
import {
  SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_WGSL,
  SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL
} from '../src/visualization/sphPhaseScene.js';

function occurrenceCount(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

test('shared native refraction WGSL owns geometric projection and Beer-Lambert transport', () => {
  assert.equal(
    ULG_NATIVE_REFRACTION_TRANSPORT_WGSL_SCHEMA,
    'peercompute.ulg.native-refraction-transport-wgsl.v0'
  );
  assert.match(ULG_NATIVE_REFRACTION_TRANSPORT_WGSL, /fn refraction_project_world_to_uv/);
  assert.match(ULG_NATIVE_REFRACTION_TRANSPORT_WGSL, /fn refraction_unproject_uv_depth/);
  assert.match(ULG_NATIVE_REFRACTION_TRANSPORT_WGSL, /fn refraction_surface_pixel/);
  assert.match(ULG_NATIVE_REFRACTION_TRANSPORT_WGSL, /fn refraction_rear_surface_admitted/);
  assert.match(ULG_NATIVE_REFRACTION_TRANSPORT_WGSL, /fn refracted_path_to_back_plane/);
  assert.match(
    ULG_NATIVE_REFRACTION_TRANSPORT_WGSL,
    /rear_surface_valid > 0\.5/
  );
  assert.match(ULG_NATIVE_REFRACTION_TRANSPORT_WGSL, /lateral_displacement_m/);
  assert.match(
    ULG_NATIVE_REFRACTION_TRANSPORT_WGSL,
    /fn refraction_beer_lambert_transmission_rgb/
  );
  assert.match(
    ULG_NATIVE_REFRACTION_TRANSPORT_WGSL,
    /fn refraction_beer_lambert_from_extinction_rgb/
  );
  assert.match(ULG_NATIVE_REFRACTION_TRANSPORT_WGSL, /12\.566370614359172/);
  assert.doesNotMatch(
    ULG_NATIVE_REFRACTION_TRANSPORT_WGSL,
    /mapAsync|queue\.|navigator|cpu/i
  );
});

test('production native surface shaders embed the exact shared refraction WGSL once', () => {
  for (const source of [
    SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL,
    SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_WGSL
  ]) {
    assert.ok(source.includes(ULG_NATIVE_REFRACTION_TRANSPORT_WGSL));
    assert.equal(
      occurrenceCount(source, /fn refracted_path_to_back_plane\s*\(/g),
      1
    );
    assert.equal(
      occurrenceCount(source, /fn refraction_beer_lambert_from_extinction_rgb\s*\(/g),
      1
    );
    assert.match(source, /backface\.valid,[\s\S]*?camera_data\.view_projection/);
    assert.match(source, /refraction_beer_lambert_from_extinction_rgb\(/);
    assert.doesNotMatch(
      source,
      /let absorption_rgb_per_m = 12\.566370614359172/
    );
  }
  assert.match(
    SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_WGSL,
    /refraction_unproject_uv_depth\([\s\S]*?camera_data\.inverse_view_projection/
  );
  assert.match(
    SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_WGSL,
    /refraction_surface_pixel\(in\.position\.xy, dimensions\)/
  );
  assert.match(
    SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_WGSL,
    /refraction_rear_surface_admitted\([\s\S]*?in\.normal,[\s\S]*?resident_view_direction/
  );
  assert.doesNotMatch(
    SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_WGSL,
    /min\(u32\(max\(floor\(in\.position/
  );
});

test('manufactured native refraction probe executes the shared WGSL into bounded evidence', () => {
  const source = readFileSync(
    new URL('../scripts/native-refraction-science-probe.mjs', import.meta.url),
    'utf8'
  );
  assert.match(source, /nativeRefractionTransportWgsl\.js\?scienceProbe=/);
  assert.match(source, /module\.ULG_NATIVE_REFRACTION_TRANSPORT_WGSL/);
  assert.match(source, /createComputePipelineAsync/);
  assert.match(source, /EVIDENCE_FLOAT_COUNT = 128/);
  assert.match(source, /EVIDENCE_BYTE_LENGTH = EVIDENCE_FLOAT_COUNT/);
  assert.match(source, /pass\.dispatchWorkgroups\(1\)/);
  assert.match(source, /readbackBuffer\.mapAsync\(GPUMapMode\.READ\)/);
  for (const invariant of [
    'thickness-doubles-path',
    'thickness-doubles-lateral-displacement',
    'rigid-translation-preserves-path',
    'unit-index-straight-path-length',
    'rgb-dispersion-exit-uvs-ordered-distinct',
    'larger-k-lowers-red-transmission',
    'missing-rear-surface-fails-closed',
    'projection-unprojection-roundtrip-valid',
    'perspective-projection-roundtrip-valid',
    'dpr-two-fragment-roundtrip-valid',
    'aspect-resize-roundtrip-valid',
    'behind-camera-projection-fails-closed',
    'fragment-pixel-bounds-fail-closed',
    'rear-depth-invalid-cases-fail-closed'
  ]) {
    assert.ok(source.includes(invariant), `missing manufactured invariant ${invariant}`);
  }
});
