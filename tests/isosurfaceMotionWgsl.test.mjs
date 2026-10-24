import assert from 'node:assert/strict';
import test from 'node:test';
import { ISOSURFACE_MOTION_WGSL as source } from '../src/visualization/isosurfaceMotionWgsl.js';

// Source contracts only. Numerical execution is covered by the opt-in native
// manufactured-state test, never by a CPU mirror of the GPU interpolator.
test('isosurface motion samples a read-only sidecar with row-based x-fastest addressing', () => {
  assert.match(source, /fn sample_isosurface_motion\([\s\S]*?field_offset: u32, resolution: u32, row_count: u32/);
  assert.match(source, /displacement: vec3<f32>,\s*normal: vec3<f32>/);
  assert.match(source, /isosurface_motion_rows\[field_offset \+ cell.x \+ resolution \* cell.y \+ slab \* cell.z\]/);
  assert.doesNotMatch(source, /@group|@binding|var<storage|@compute|@vertex|@fragment/);
  assert.doesNotMatch(source, /isosurface_motion_rows\[[^\]]+\]\s*=/);
  assert.doesNotMatch(source, /density_lane|optical_records|state_rows|material_id|scenario/i);
});

test('isosurface motion divides interpolated weighted moments and uses their quotient-rule gradient', () => {
  assert.match(source, /corner < 8u/);
  assert.match(source, /moment \+= row \* \(w.x \* w.y \* w.z\)/);
  assert.match(source, /let velocity = moment.xyz \/ moment.w/);
  for (const axis of ['x', 'y', 'z']) {
    assert.ok(source.includes(`(d${axis}.xyz - velocity * d${axis}.w) / moment.w / grid_scale_m`));
    assert.ok(source.includes(`age_s * active_axes.${axis}`));
  }
  assert.doesNotMatch(source, /row.xyz\s*\/\s*row.w/);
  assert.match(source, /row.w == 0.0 && any\(row.xyz != vec3<f32>\(0.0\)\)/);
  assert.match(source, /!\(moment.w > 0.0\)\) \{ return held; \}/);
});

test('motion bounds row access and fails closed for nonfinite, empty, and invalid requests', () => {
  assert.match(source, /min\(row_count, arrayLength\(&isosurface_motion_rows\)\)/);
  const guard = source.indexOf('if (field_offset >= available)');
  const squareGuard = source.indexOf('if (resolution > remaining / resolution)');
  const square = source.indexOf('let slab = resolution * resolution');
  const cubeGuard = source.indexOf('if (resolution > remaining / slab)');
  const read = source.indexOf('let row = isosurface_motion_rows[');
  assert.ok(guard >= 0 && guard < squareGuard && squareGuard < square && square < cubeGuard && cubeGuard < read);
  assert.match(source, /resolution < 2u/);
  for (const value of ['grid_scale_m', 'age_s', 'max_displacement_m']) {
    assert.ok(source.includes(`!isosurface_motion_finite(${value}) || !(${value} > 0.0)`));
  }
  assert.match(source, /value == value && abs\(value\) < 1.0e30/);
});

test('capped deformation transports normals with the matching cofactor without determinant division', () => {
  assert.match(source, /if \(magnitude >= max_displacement_m\)/);
  assert.match(source, /displacement = max_displacement_m \* direction/);
  for (const axis of ['x', 'y', 'z']) {
    assert.ok(source.includes(`j${axis} = saturation_scale * (j${axis} - direction * dot(direction, j${axis}))`));
  }
  assert.match(source, /cross\(jy, jz\) \* source_normal.x/);
  assert.match(source, /cross\(jz, jx\) \* source_normal.y/);
  assert.match(source, /cross\(jx, jy\) \* source_normal.z/);
  assert.match(source, /isosurface_motion_unit\(transported_normal, source_normal\)/);
  assert.doesNotMatch(source, /inverse\(|determinant\(/);
});
