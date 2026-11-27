import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import * as sharedMaterial from '../src/visualization/nativeSurfaceMaterialWgsl.js';
import {
  ULG_NATIVE_REFRACTION_TRANSPORT_WGSL
} from '../src/visualization/nativeRefractionTransportWgsl.js';
import * as scene from '../src/visualization/sphPhaseScene.js';

// Captured after binding opaque_scene_depth (@group(1) @binding(5)), linear
// eye-depth foreground rejection (zNear=0.05..zFar=500 perspective precision),
// collapsing redundant identical RGB refraction lookups (2026-11-25), and
// wiring ULG's complex_normal_fresnel_rgb conductor Fresnel in Wave D1 (2026-11-27).
// These are generated-WGSL snapshots, not GPU validation. An intentional shader
// behavior change must review and update the snapshots.
const PRE_EXTRACTION_SHADERS = Object.freeze({
  SPH_NATIVE_WEBGPU_BACKGROUND_WGSL: {
    bytes: 1481,
    sha256: '4eec9414f2807388bee643fd5d2f38efbb98d68f308781aee14e077483997e06'
  },
  SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL: {
    bytes: 41817,
    sha256: 'ad8fb2ae43703df7f61d57f7d1bbe23a85db166b8125048b07dc67dd59190cf2'
  },
  SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_WGSL: {
    bytes: 47637,
    sha256: '6f437e3742bf90d056983351fa757ec21a24f6c388885a7565ef03a8e51bba1f'
  }
});

test('shared surface shaders exactly preserve the evaluated pre-extraction WGSL', () => {
  for (const [name, expected] of Object.entries(PRE_EXTRACTION_SHADERS)) {
    assert.equal(Buffer.byteLength(sharedMaterial[name]), expected.bytes, name);
    assert.equal(
      createHash('sha256').update(sharedMaterial[name]).digest('hex'),
      expected.sha256,
      name
    );
    assert.equal(scene[name], sharedMaterial[name], `${name} scene API re-export`);
  }
  const cameraName = 'SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_CAMERA_UNIFORM_BYTE_LENGTH';
  assert.equal(sharedMaterial[cameraName], 320);
  assert.equal(scene[cameraName], sharedMaterial[cameraName]);
});

test('shared compact material retains optical tables, rear-depth transport, and color encoding', () => {
  const source = sharedMaterial.SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_WGSL;
  assert.ok(source.includes(ULG_NATIVE_REFRACTION_TRANSPORT_WGSL));
  assert.equal(source.split(ULG_NATIVE_REFRACTION_TRANSPORT_WGSL).length - 1, 1);
  for (const declaration of [
    '@group(0) @binding(1) var<uniform> camera_data: CameraUniform;',
    '@group(0) @binding(2) var<storage, read> optical_records: array<vec4<f32>>;',
    '@group(0) @binding(3) var<storage, read> spectral_samples: array<vec4<f32>>;',
    '@group(1) @binding(0) var scene_color_copy: texture_2d<f32>;',
    '@group(1) @binding(2) var env_map: texture_2d<f32>;',
    '@group(1) @binding(4) var refractive_back_depth: texture_depth_2d;',
    '@group(1) @binding(5) var opaque_scene_depth: texture_depth_2d;'
  ]) assert.ok(source.includes(declaration), declaration);
  assert.match(source, /fn sample_refracted_scene_color_depth_rejected\(/);
  assert.match(source, /refraction_depth_filtered_weights\(/);
  assert.match(source, /let metalness = clamp\(optical\.metalness/);
  assert.match(source, /refractive_index = max\(optical\.ior, 1\.0\)/);
  assert.match(source, /optical\.transmission > 0\.01/);
  assert.match(source, /refraction_unproject_uv_depth\([\s\S]*?camera_data\.inverse_view_projection/);
  assert.match(source, /return blackbody_emission_rgb\(temperature_k\)/);
  assert.match(source, /display_lit = pow\(clamp\(lit,[\s\S]*?vec3<f32>\(1\.0 \/ 2\.2\)\)/);
  assert.match(source, /return vec4<f32>\(display_lit \* output_alpha, output_alpha\)/);
});

test('shared surface material module has no scene or runtime ownership dependency', () => {
  const source = readFileSync(
    new URL('../src/visualization/nativeSurfaceMaterialWgsl.js', import.meta.url),
    'utf8'
  );
  const imports = [...source.matchAll(/^import\s+[\s\S]*?\s+from\s+['"]([^'"]+)['"];$/gm)]
    .map((match) => match[1]);
  assert.deepEqual(imports, ['./nativeRefractionTransportWgsl.js']);
  assert.doesNotMatch(source, /sphPhaseScene|peercomputeBrowserResidentHost|\bdocument\.|\bnavigator\./);
  const sceneSource = readFileSync(
    new URL('../src/visualization/sphPhaseScene.js', import.meta.url),
    'utf8'
  );
  assert.doesNotMatch(sceneSource, /export const SPH_RESIDENT_SURFACE_DRAW_(?:OVERLAY_WGSL|COMPACT_POSITION_WGSL)\s*=/);
});

test('worker isosurface request forwards the existing native optical table and display settings', () => {
  const source = readFileSync(
    new URL('../src/visualization/sphPhaseScene.js', import.meta.url),
    'utf8'
  );
  const start = source.indexOf('  function workerOffscreenRetainedStageOutputRenderRequest(');
  const end = source.indexOf('  function workerOffscreenMechanicsStagePayload(', start);
  assert.ok(start >= 0 && end > start);
  const request = source.slice(start, end);
  assert.match(request, /nativeSurfaceMaterial:\s*\{\s*schema: 'peercompute\.ulg\.worker-native-surface-material\.v0'/);
  for (const field of [
    'schema', 'recordCount', 'recordStrideFloats', 'recordStrideBytes',
    'spectralSampleCount', 'spectralSampleStrideFloats', 'spectralSampleStrideBytes',
    'records', 'spectralSamples'
  ]) assert.ok(request.includes(`${field}: opticalGpuTable.${field}`), field);
  assert.match(request, /\.\.\.workerOffscreenNativeSurfaceAppearance\(\)/);
  assert.doesNotMatch(request, /buildOpticalGpuTable\(|deriveOptical|new Three\.Color/);
});

test('stationary worker presentation receives appearance changes without streaming optical records', () => {
  const source = readFileSync(
    new URL('../src/visualization/sphPhaseScene.js', import.meta.url),
    'utf8'
  );
  const appearanceStart = source.indexOf('  function workerOffscreenNativeSurfaceAppearance()');
  const appearanceEnd = source.indexOf('  scene.background =', appearanceStart);
  assert.ok(appearanceStart >= 0 && appearanceEnd > appearanceStart);
  const appearance = source.slice(appearanceStart, appearanceEnd);
  assert.match(appearance, /lightingProfile: \{ \.\.\.sceneLightingProfile \}/);
  assert.match(appearance, /backgroundImageUrl: sceneBackgroundImageUrl \|\| null/);
  assert.match(appearance, /backgroundColor: sceneBackgroundColorHex/);
  assert.match(appearance, /backgroundClearValue: residentSurfaceDrawBackgroundClearValue\(\)/);
  assert.doesNotMatch(appearance, /opticalGpuTable|(?:records|spectralSamples)\s*:/);
  const streamStart = source.indexOf('  function streamPreviewCameraIfLivePreviewOwnsDisplay()');
  const streamEnd = source.indexOf('  function animate()', streamStart);
  assert.ok(streamStart >= 0 && streamEnd > streamStart);
  const stream = source.slice(streamStart, streamEnd);
  assert.match(stream, /appearanceSignature = JSON\.stringify\(\[\s*sceneLightingMode, sceneBackgroundImageUrl, sceneBackgroundColorHex\s*\]\)/);
  assert.match(stream, /lastPostedPreviewViewProjection\s*&& appearanceSignature === lastPostedPreviewAppearanceSignature/);
  assert.match(stream, /lastPostedPreviewAppearanceSignature = appearanceSignature/);
  assert.match(stream, /nativeSurfaceAppearance: workerOffscreenNativeSurfaceAppearance\(\)/);
  assert.doesNotMatch(stream, /opticalGpuTable|(?:records|spectralSamples)\s*:/);
});
