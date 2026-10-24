import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_WGSL as native
} from '../src/visualization/nativeSurfaceMaterialWgsl.js';
import { ISOSURFACE_MOTION_WGSL } from '../src/visualization/isosurfaceMotionWgsl.js';
import {
  WORKER_NATIVE_SURFACE_MOTION_WGSL as worker,
  WORKER_NATIVE_SURFACE_MOTION_UNIFORM_BYTES
} from '../src/visualization/workerNativeSurfaceMotionWgsl.js';

test('worker motion changes only the native vertex entry, leaving every optical function and camera byte unchanged', () => {
  const vertex = /@vertex\nfn vs_main\(@builtin\(vertex_index\) vertex_index: u32\) -> VertexOut \{[\s\S]*?\n\}\n/;
  const nativeStart = worker.indexOf('struct CameraUniform') - native.indexOf('struct CameraUniform');
  assert.ok(nativeStart > 0);
  assert.equal(worker.slice(nativeStart).replace(vertex, ''), native.replace(vertex, ''));
  assert.equal((worker.match(/@vertex\nfn vs_main/g) || []).length, 1);
  assert.equal(worker.slice(worker.indexOf('@fragment')), native.slice(native.indexOf('@fragment')));
  assert.equal(worker.match(/struct CameraUniform \{[\s\S]*?\};/)[0],
    native.match(/struct CameraUniform \{[\s\S]*?\};/)[0]);
});

test('retained weighted motion has separate bindings and preserves optical and temperature vertex lanes', () => {
  assert.equal(WORKER_NATIVE_SURFACE_MOTION_UNIFORM_BYTES, 32);
  assert.equal(worker.split(ISOSURFACE_MOTION_WGSL).length - 1, 1);
  assert.match(worker, /@group\(0\) @binding\(6\) var<storage, read> isosurface_motion_rows: array<vec4<f32>>/);
  assert.match(worker, /@group\(0\) @binding\(7\) var<uniform> surface_motion: WorkerSurfaceMotionUniform/);
  assert.match(worker, /compact_position\(vertex_index\) \+ vec3<f32>\(camera_data.position_grid_bias\)/);
  assert.match(worker, /compact_world_position\(vertex_index\) \+ motion.displacement/);
  assert.match(worker, /out.normal = motion.normal/);
  for (const lane of ['material_id', 'phase_id', 'optical_state_id']) {
    assert.ok(worker.includes(`out.${lane} = camera_data.${lane};`));
  }
  assert.match(worker, /vertex_index < arrayLength\(&compact_vertex_temperatures_k\)/);
  assert.match(worker, /vertex_temperature_k = compact_vertex_temperatures_k\[vertex_index\]/);
  assert.match(worker, /out.emissive_temperature_k = vertex_temperature_k/);
  assert.doesNotMatch(worker, /var<storage, read_write>/);
});
