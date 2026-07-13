import { writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { Matrix4, PerspectiveCamera, Vector3 } from 'three';

const baseUrl = process.env.ULG_REFRACTION_SCIENCE_BASE_URL || 'http://127.0.0.1:5320/';
const outputPath = process.env.ULG_REFRACTION_SCIENCE_OUTPUT
  || '/tmp/ulg-native-refraction-science-probe.json';

const EVIDENCE_FLOAT_COUNT = 128;
const EVIDENCE_BYTE_LENGTH = EVIDENCE_FLOAT_COUNT * Float32Array.BYTES_PER_ELEMENT;

function projectionFixture(aspect) {
  const camera = new PerspectiveCamera(55, aspect, 0.1, 100);
  camera.position.set(1.4, 0.8, 3.2);
  camera.lookAt(0.2, -0.1, -2);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  const viewProjection = new Matrix4().multiplyMatrices(
    camera.projectionMatrix,
    camera.matrixWorldInverse
  );
  const inverseViewProjection = viewProjection.clone().invert();
  const worldFromCamera = (x, y, z) => new Vector3(x, y, z)
    .applyMatrix4(camera.matrixWorld)
    .toArray();
  return {
    viewProjection: viewProjection.elements,
    inverseViewProjection: inverseViewProjection.elements,
    roundtripSource: worldFromCamera(0.35, -0.2, -4),
    behindCamera: worldFromCamera(0, 0, 1),
    offscreen: worldFromCamera(100, 0, -4),
    beforeNearPlane: worldFromCamera(0, 0, -0.05)
  };
}

function chromiumArgs() {
  const extra = String(process.env.ULG_REFRACTION_SCIENCE_CHROMIUM_ARGS || '').trim();
  return [
    '--use-angle=vulkan',
    '--enable-features=Vulkan,UseSkiaRenderer',
    '--enable-unsafe-webgpu',
    ...(extra ? extra.split(/\s+/) : [])
  ];
}

function nearlyEqual(left, right, tolerance = 1e-5) {
  return Number.isFinite(left) && Number.isFinite(right)
    && Math.abs(left - right) <= tolerance;
}

function scienceChecks(result) {
  const evidence = result.evidence || [];
  const checks = [
    ['gpu-executed', result.status === 'gpu-evidence-ready'],
    ['fixed-evidence-byte-length', result.evidenceByteLength === EVIDENCE_BYTE_LENGTH],
    ['one-submit', result.submitCount === 1],
    ['one-diagnostic-map', result.mapCount === 1],
    ['thin-and-thick-valid', evidence[2] === 1 && evidence[5] === 1],
    ['thickness-doubles-path', nearlyEqual(evidence[3], 2 * evidence[0])],
    ['thickness-doubles-lateral-displacement', nearlyEqual(evidence[4], 2 * evidence[1])],
    ['rigid-translation-preserves-path', nearlyEqual(evidence[6], evidence[0])],
    ['rigid-translation-preserves-displacement', nearlyEqual(evidence[7], evidence[1])],
    ['unit-index-path-valid', evidence[8] === 1],
    ['unit-index-straight-path-length', nearlyEqual(evidence[9], 0.2)],
    ['unit-index-zero-lateral-displacement', Math.abs(evidence[10]) <= 1e-6],
    ['unit-index-exits-at-rear-point', nearlyEqual(evidence[11], 0)
      && nearlyEqual(evidence[12], 0)
      && nearlyEqual(evidence[13], -0.2)],
    ['rgb-dispersion-paths-valid', evidence[14] === 1 && evidence[16] === 1
      && evidence[18] === 1],
    ['rgb-dispersion-exit-uvs-ordered-distinct', evidence[15] < evidence[17]
      && evidence[17] < evidence[19]],
    ['larger-k-lowers-red-transmission', evidence[23] < evidence[20]],
    ['larger-k-lowers-green-transmission', evidence[24] < evidence[21]],
    ['larger-k-lowers-blue-transmission', evidence[25] < evidence[22]],
    ['missing-rear-surface-fails-closed', evidence[26] === 0],
    ['zero-thickness-rear-surface-fails-closed', evidence[27] === 0],
    ['open-backward-path-fails-closed', evidence[28] === 0],
    ['projection-valid', evidence[29] === 1],
    ['projection-unprojection-roundtrip-valid', evidence[30] === 1],
    ['projection-unprojection-roundtrip-x', Math.abs(evidence[31]) <= 1e-6],
    ['projection-unprojection-roundtrip-y', Math.abs(evidence[32]) <= 1e-6],
    ['projection-unprojection-roundtrip-z', Math.abs(evidence[33]) <= 1e-6],
    ['projection-uv-x', nearlyEqual(evidence[34], 0.6)],
    ['projection-uv-y', nearlyEqual(evidence[35], 0.65)],
    ['projection-depth', nearlyEqual(evidence[36], 0.6)],
    ['invalid-extinction-fails-closed', evidence[37] === 0
      && evidence[38] === 0 && evidence[39] === 0],
    ['perspective-projection-roundtrip-valid', evidence[40] === 1 && evidence[41] === 1],
    ['perspective-projection-roundtrip-bounded', evidence[42] <= 1e-5],
    ['dpr-one-fragment-roundtrip-valid', evidence[43] === 1 && evidence[44] === 1],
    ['dpr-one-fragment-roundtrip-bounded', evidence[45] <= 0.02],
    ['dpr-one-uv-quantization-bounded', evidence[46] <= 0.002],
    ['dpr-two-fragment-roundtrip-valid', evidence[47] === 1 && evidence[48] === 1],
    ['dpr-two-fragment-roundtrip-bounded', evidence[49] <= 0.01],
    ['dpr-two-uv-quantization-bounded', evidence[50] <= 0.001],
    ['aspect-resize-roundtrip-valid', evidence[51] === 1
      && evidence[52] === 1 && evidence[53] === 1],
    ['aspect-resize-roundtrip-bounded', evidence[54] <= 0.02],
    ['aspect-resize-recomputed-projection', evidence[55] > 1e-4],
    ['behind-camera-projection-fails-closed', evidence[56] === 0],
    ['offscreen-projection-fails-closed', evidence[57] === 0],
    ['depth-out-of-range-projection-fails-closed', evidence[58] === 0],
    ['invalid-unprojection-fails-closed', evidence[59] === 0
      && evidence[60] === 0 && evidence[61] === 0
      && evidence[77] === 0 && evidence[78] === 0],
    ['fragment-pixel-bounds-fail-closed', evidence[62] === 1
      && evidence[63] === 0 && evidence[64] === 0
      && evidence[65] === 0 && evidence[66] === 0],
    ['rear-depth-valid-external-entry-admitted', evidence[67] === 1],
    ['rear-depth-invalid-cases-fail-closed', evidence[68] === 0
      && evidence[69] === 0 && evidence[70] === 0
      && evidence[71] === 0 && evidence[72] === 0
      && evidence[73] === 0 && evidence[74] === 0
      && evidence[75] === 0],
    ['near-plane-depth-is-out-of-range', evidence[79] < 0],
    ['production-surface-shader-compiles', result.productionShaderCompilationErrorCount === 0],
    ['validation-errors-empty', (result.validationErrors || []).length === 0],
    ['uncaptured-errors-empty', (result.uncapturedErrors || []).length === 0]
  ];
  return checks.map(([name, passed]) => ({ name, passed: Boolean(passed) }));
}

async function main() {
  const startedAt = new Date().toISOString();
  const wideProjectionFixture = projectionFixture(16 / 9);
  const squareProjectionFixture = projectionFixture(1);
  const browser = await chromium.launch({ headless: true, args: chromiumArgs() });
  let result;
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    result = await page.evaluate(async ({
      evidenceFloatCount,
      evidenceByteLength,
      wideProjectionFixture,
      squareProjectionFixture
    }) => {
      const module = await import(
        `/src/visualization/nativeRefractionTransportWgsl.js?scienceProbe=${Date.now()}`
      );
      const sceneModule = await import(
        `/src/visualization/sphPhaseScene.js?scienceProbe=${Date.now()}`
      );
      const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) {
        return {
          status: 'unsupported',
          reason: 'navigator.gpu returned no adapter',
          evidence: [],
          evidenceByteLength,
          submitCount: 0,
          mapCount: 0,
          validationErrors: [],
          uncapturedErrors: []
        };
      }
      const device = await adapter.requestDevice();
      const uncapturedErrors = [];
      device.addEventListener('uncapturederror', (event) => {
        uncapturedErrors.push(event.error?.message || String(event.error));
      });
      const wgslNumber = (value) => {
        const encoded = Number(value).toPrecision(12);
        return encoded.includes('.') || /e/i.test(encoded) ? encoded : `${encoded}.0`;
      };
      const wgslVec3 = (values) => `vec3<f32>(${values.map(wgslNumber).join(', ')})`;
      const wgslMat4 = (values) => `mat4x4<f32>(\n${[0, 4, 8, 12]
        .map((offset) => `    vec4<f32>(${values.slice(offset, offset + 4).map(wgslNumber).join(', ')})`)
        .join(',\n')}\n  )`;
      const wideViewProjection = wgslMat4(wideProjectionFixture.viewProjection);
      const wideInverseViewProjection = wgslMat4(wideProjectionFixture.inverseViewProjection);
      const squareViewProjection = wgslMat4(squareProjectionFixture.viewProjection);
      const squareInverseViewProjection = wgslMat4(squareProjectionFixture.inverseViewProjection);
      const shaderCode = `${module.ULG_NATIVE_REFRACTION_TRANSPORT_WGSL}

@group(0) @binding(0) var<storage, read_write> evidence: array<f32>;

@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (global_id.x != 0u) { return; }
  let identity = mat4x4<f32>(
    vec4<f32>(1.0, 0.0, 0.0, 0.0),
    vec4<f32>(0.0, 1.0, 0.0, 0.0),
    vec4<f32>(0.0, 0.0, 1.0, 0.0),
    vec4<f32>(0.0, 0.0, 0.0, 1.0)
  );
  let entry = vec3<f32>(0.0, 0.0, 0.0);
  let thin_back = vec3<f32>(0.0, 0.0, -0.2);
  let thick_back = vec3<f32>(0.0, 0.0, -0.4);
  let incident = vec3<f32>(0.0, 0.0, -1.0);
  let normal = normalize(vec3<f32>(-0.55, 0.0, 1.0));
  let internal = refract(incident, normal, 1.0 / 1.33);
  let thin = refracted_path_to_back_plane(
    entry, thin_back, 1.0, internal, identity, 10.0
  );
  let thick = refracted_path_to_back_plane(
    entry, thick_back, 1.0, internal, identity, 10.0
  );
  let translation = vec3<f32>(0.12, -0.08, 0.15);
  let translated = refracted_path_to_back_plane(
    entry + translation,
    thin_back + translation,
    1.0,
    internal,
    identity,
    10.0
  );
  let unit_index = refracted_path_to_back_plane(
    entry,
    thin_back,
    1.0,
    refract(incident, normal, 1.0),
    identity,
    10.0
  );
  let red = refracted_path_to_back_plane(
    entry, thin_back, 1.0, refract(incident, normal, 1.0 / 1.31), identity, 10.0
  );
  let green = refracted_path_to_back_plane(
    entry, thin_back, 1.0, refract(incident, normal, 1.0 / 1.34), identity, 10.0
  );
  let blue = refracted_path_to_back_plane(
    entry, thin_back, 1.0, refract(incident, normal, 1.0 / 1.38), identity, 10.0
  );
  let wavelengths_m = vec3<f32>(630.0e-9, 530.0e-9, 480.0e-9);
  let paths_m = vec3<f32>(thin.path_m);
  let transmission_low_k = refraction_beer_lambert_from_extinction_rgb(
    vec3<f32>(1.0e-9), wavelengths_m, paths_m
  );
  let transmission_high_k = refraction_beer_lambert_from_extinction_rgb(
    vec3<f32>(2.0e-9), wavelengths_m, paths_m
  );
  let missing_rear = refracted_path_to_back_plane(
    entry, thin_back, 0.0, internal, identity, 10.0
  );
  let zero_thickness = refracted_path_to_back_plane(
    entry, entry, 1.0, internal, identity, 10.0
  );
  let open_backward = refracted_path_to_back_plane(
    entry, thin_back, 1.0, vec3<f32>(0.0, 0.0, 1.0), identity, 10.0
  );
  let roundtrip_source = vec3<f32>(0.2, -0.3, 0.2);
  let projected = refraction_project_world_to_uv(roundtrip_source, identity);
  let unprojected = refraction_unproject_uv_depth(projected.uv, projected.depth, identity);
  let roundtrip_error = unprojected.world_position - roundtrip_source;
  let invalid_extinction = refraction_beer_lambert_from_extinction_rgb(
    vec3<f32>(-1.0), wavelengths_m, paths_m
  );
  let wide_view_projection = ${wideViewProjection};
  let wide_inverse_view_projection = ${wideInverseViewProjection};
  let square_view_projection = ${squareViewProjection};
  let square_inverse_view_projection = ${squareInverseViewProjection};
  let perspective_source = ${wgslVec3(wideProjectionFixture.roundtripSource)};
  let perspective_projected = refraction_project_world_to_uv(
    perspective_source,
    wide_view_projection
  );
  let perspective_unprojected = refraction_unproject_uv_depth(
    perspective_projected.uv,
    perspective_projected.depth,
    wide_inverse_view_projection
  );
  let perspective_roundtrip_error = length(
    perspective_unprojected.world_position - perspective_source
  );
  let dpr_one_pixel = refraction_surface_pixel(
    perspective_projected.uv * vec2<f32>(640.0, 360.0),
    vec2<u32>(640u, 360u)
  );
  let dpr_one_unprojected = refraction_unproject_uv_depth(
    dpr_one_pixel.uv,
    perspective_projected.depth,
    wide_inverse_view_projection
  );
  let dpr_one_roundtrip_error = length(dpr_one_unprojected.world_position - perspective_source);
  let dpr_one_uv_error = length(dpr_one_pixel.uv - perspective_projected.uv);
  let dpr_two_pixel = refraction_surface_pixel(
    perspective_projected.uv * vec2<f32>(1280.0, 720.0),
    vec2<u32>(1280u, 720u)
  );
  let dpr_two_unprojected = refraction_unproject_uv_depth(
    dpr_two_pixel.uv,
    perspective_projected.depth,
    wide_inverse_view_projection
  );
  let dpr_two_roundtrip_error = length(dpr_two_unprojected.world_position - perspective_source);
  let dpr_two_uv_error = length(dpr_two_pixel.uv - perspective_projected.uv);
  let resized_source = ${wgslVec3(squareProjectionFixture.roundtripSource)};
  let resized_projected = refraction_project_world_to_uv(resized_source, square_view_projection);
  let resized_pixel = refraction_surface_pixel(
    resized_projected.uv * vec2<f32>(800.0),
    vec2<u32>(800u)
  );
  let resized_unprojected = refraction_unproject_uv_depth(
    resized_pixel.uv,
    resized_projected.depth,
    square_inverse_view_projection
  );
  let resized_roundtrip_error = length(resized_unprojected.world_position - resized_source);
  let behind_camera = refraction_project_world_to_uv(
    ${wgslVec3(wideProjectionFixture.behindCamera)},
    wide_view_projection
  );
  let offscreen = refraction_project_world_to_uv(
    ${wgslVec3(wideProjectionFixture.offscreen)},
    wide_view_projection
  );
  let before_near_plane = refraction_project_world_to_uv(
    ${wgslVec3(wideProjectionFixture.beforeNearPlane)},
    wide_view_projection
  );
  let invalid_uv_unprojection = refraction_unproject_uv_depth(
    vec2<f32>(-0.01, 0.5),
    0.5,
    wide_inverse_view_projection
  );
  let invalid_depth_unprojection = refraction_unproject_uv_depth(
    vec2<f32>(0.5),
    1.01,
    wide_inverse_view_projection
  );
  let singular = mat4x4<f32>(
    vec4<f32>(0.0),
    vec4<f32>(0.0),
    vec4<f32>(0.0),
    vec4<f32>(0.0)
  );
  let singular_unprojection = refraction_unproject_uv_depth(vec2<f32>(0.5), 0.5, singular);
  let runtime_nan_bits = global_id.y | 0x7fc00000u;
  let nan = bitcast<f32>(runtime_nan_bits);
  let valid_pixel = refraction_surface_pixel(vec2<f32>(0.5, 359.5), vec2<u32>(640u, 360u));
  let negative_pixel = refraction_surface_pixel(vec2<f32>(-0.5, 10.5), vec2<u32>(640u, 360u));
  let high_pixel = refraction_surface_pixel(vec2<f32>(640.0, 10.5), vec2<u32>(640u, 360u));
  let nan_pixel = refraction_surface_pixel(vec2<f32>(nan, 10.5), vec2<u32>(640u, 360u));
  let dummy_pixel = refraction_surface_pixel(vec2<f32>(0.5), vec2<u32>(1u));
  let rear_entry = vec3<f32>(0.0);
  let rear_world = vec3<f32>(0.0, 0.0, -0.2);
  let outward_normal = vec3<f32>(0.0, 0.0, 1.0);
  let view_to_camera = vec3<f32>(0.0, 0.0, 1.0);
  let admitted_rear = refraction_rear_surface_admitted(
    0.4, 0.6, rear_entry, rear_world, outward_normal, view_to_camera, 1.0
  );
  let clear_rear = refraction_rear_surface_admitted(
    0.4, 1.0, rear_entry, rear_world, outward_normal, view_to_camera, 1.0
  );
  let unordered_rear = refraction_rear_surface_admitted(
    0.4, 0.3, rear_entry, rear_world, outward_normal, view_to_camera, 1.0
  );
  let camera_inside_rear = refraction_rear_surface_admitted(
    0.4, 0.6, rear_entry, rear_world, -outward_normal, view_to_camera, 1.0
  );
  let invalid_bounds_rear = refraction_rear_surface_admitted(
    0.4, 0.6, rear_entry, rear_world, outward_normal, view_to_camera, 0.0
  );
  let nan_rear = refraction_rear_surface_admitted(
    0.4, 0.6, rear_entry, rear_world, outward_normal, view_to_camera, nan
  );
  let excessive_rear = refraction_rear_surface_admitted(
    0.4, 0.6, rear_entry, rear_world, outward_normal, view_to_camera, 0.1
  );
  let zero_normal_rear = refraction_rear_surface_admitted(
    0.4, 0.6, rear_entry, rear_world, vec3<f32>(0.0), view_to_camera, 1.0
  );
  let zero_view_rear = refraction_rear_surface_admitted(
    0.4, 0.6, rear_entry, rear_world, outward_normal, vec3<f32>(0.0), 1.0
  );
  let high_uv_unprojection = refraction_unproject_uv_depth(
    vec2<f32>(1.01, 0.5), 0.5, wide_inverse_view_projection
  );
  let negative_depth_unprojection = refraction_unproject_uv_depth(
    vec2<f32>(0.5), -0.01, wide_inverse_view_projection
  );

  evidence[0] = thin.path_m;
  evidence[1] = thin.lateral_displacement_m;
  evidence[2] = thin.valid;
  evidence[3] = thick.path_m;
  evidence[4] = thick.lateral_displacement_m;
  evidence[5] = thick.valid;
  evidence[6] = translated.path_m;
  evidence[7] = translated.lateral_displacement_m;
  evidence[8] = unit_index.valid;
  evidence[9] = unit_index.path_m;
  evidence[10] = unit_index.lateral_displacement_m;
  evidence[11] = unit_index.exit_world.x;
  evidence[12] = unit_index.exit_world.y;
  evidence[13] = unit_index.exit_world.z;
  evidence[14] = red.valid;
  evidence[15] = red.exit_uv.x;
  evidence[16] = green.valid;
  evidence[17] = green.exit_uv.x;
  evidence[18] = blue.valid;
  evidence[19] = blue.exit_uv.x;
  evidence[20] = transmission_low_k.r;
  evidence[21] = transmission_low_k.g;
  evidence[22] = transmission_low_k.b;
  evidence[23] = transmission_high_k.r;
  evidence[24] = transmission_high_k.g;
  evidence[25] = transmission_high_k.b;
  evidence[26] = missing_rear.valid;
  evidence[27] = zero_thickness.valid;
  evidence[28] = open_backward.valid;
  evidence[29] = projected.valid;
  evidence[30] = unprojected.valid;
  evidence[31] = roundtrip_error.x;
  evidence[32] = roundtrip_error.y;
  evidence[33] = roundtrip_error.z;
  evidence[34] = projected.uv.x;
  evidence[35] = projected.uv.y;
  evidence[36] = projected.depth;
  evidence[37] = invalid_extinction.r;
  evidence[38] = invalid_extinction.g;
  evidence[39] = invalid_extinction.b;
  evidence[40] = perspective_projected.valid;
  evidence[41] = perspective_unprojected.valid;
  evidence[42] = perspective_roundtrip_error;
  evidence[43] = dpr_one_pixel.valid;
  evidence[44] = dpr_one_unprojected.valid;
  evidence[45] = dpr_one_roundtrip_error;
  evidence[46] = dpr_one_uv_error;
  evidence[47] = dpr_two_pixel.valid;
  evidence[48] = dpr_two_unprojected.valid;
  evidence[49] = dpr_two_roundtrip_error;
  evidence[50] = dpr_two_uv_error;
  evidence[51] = resized_projected.valid;
  evidence[52] = resized_pixel.valid;
  evidence[53] = resized_unprojected.valid;
  evidence[54] = resized_roundtrip_error;
  evidence[55] = abs(resized_projected.uv.x - perspective_projected.uv.x);
  evidence[56] = behind_camera.valid;
  evidence[57] = offscreen.valid;
  evidence[58] = before_near_plane.valid;
  evidence[59] = invalid_uv_unprojection.valid;
  evidence[60] = invalid_depth_unprojection.valid;
  evidence[61] = singular_unprojection.valid;
  evidence[62] = valid_pixel.valid;
  evidence[63] = negative_pixel.valid;
  evidence[64] = high_pixel.valid;
  evidence[65] = nan_pixel.valid;
  evidence[66] = dummy_pixel.valid;
  evidence[67] = admitted_rear;
  evidence[68] = clear_rear;
  evidence[69] = unordered_rear;
  evidence[70] = camera_inside_rear;
  evidence[71] = invalid_bounds_rear;
  evidence[72] = nan_rear;
  evidence[73] = excessive_rear;
  evidence[74] = zero_normal_rear;
  evidence[75] = zero_view_rear;
  evidence[77] = high_uv_unprojection.valid;
  evidence[78] = negative_depth_unprojection.valid;
  evidence[79] = before_near_plane.depth;
}`;

      device.pushErrorScope('validation');
      const shaderModule = device.createShaderModule({
        label: 'ulg-native-refraction-science-gate',
        code: shaderCode
      });
      const productionShaderModule = device.createShaderModule({
        label: 'ulg-native-refraction-production-surface',
        code: sceneModule.SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_WGSL
      });
      const compilationInfo = typeof shaderModule.getCompilationInfo === 'function'
        ? await shaderModule.getCompilationInfo()
        : { messages: [] };
      const productionCompilationInfo = typeof productionShaderModule.getCompilationInfo === 'function'
        ? await productionShaderModule.getCompilationInfo()
        : { messages: [] };
      const compilationErrors = [...(compilationInfo.messages || [])]
        .filter((message) => message.type === 'error')
        .map((message) => message.message);
      const productionCompilationErrors = [...(productionCompilationInfo.messages || [])]
        .filter((message) => message.type === 'error')
        .map((message) => message.message);
      compilationErrors.push(...productionCompilationErrors);
      if (compilationErrors.length > 0) {
        const validationError = await device.popErrorScope();
        device.destroy();
        return {
          status: 'shader-compilation-error',
          helperSchema: module.ULG_NATIVE_REFRACTION_TRANSPORT_WGSL_SCHEMA,
          evidence: [],
          evidenceByteLength,
          submitCount: 0,
          mapCount: 0,
          validationErrors: [
            ...compilationErrors,
            ...(validationError ? [validationError.message || String(validationError)] : [])
          ],
          productionShaderCompilationErrorCount: productionCompilationErrors.length,
          uncapturedErrors
        };
      }
      const pipeline = await device.createComputePipelineAsync({
        label: 'ulg-native-refraction-science-gate',
        layout: 'auto',
        compute: { module: shaderModule, entryPoint: 'main' }
      });
      const evidenceBuffer = device.createBuffer({
        label: 'ulg-native-refraction-science-evidence',
        size: evidenceByteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
      });
      const readbackBuffer = device.createBuffer({
        label: 'ulg-native-refraction-science-readback',
        size: evidenceByteLength,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
      });
      const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: evidenceBuffer } }]
      });
      const encoder = device.createCommandEncoder({
        label: 'ulg-native-refraction-science-gate'
      });
      const pass = encoder.beginComputePass({
        label: 'ulg-native-refraction-science-gate'
      });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.dispatchWorkgroups(1);
      pass.end();
      encoder.copyBufferToBuffer(
        evidenceBuffer,
        0,
        readbackBuffer,
        0,
        evidenceByteLength
      );
      device.queue.submit([encoder.finish()]);
      const submitCount = 1;
      await device.queue.onSubmittedWorkDone();
      await readbackBuffer.mapAsync(GPUMapMode.READ);
      const mapCount = 1;
      const evidence = Array.from(
        new Float32Array(readbackBuffer.getMappedRange()).slice(0, evidenceFloatCount)
      );
      readbackBuffer.unmap();
      const validationError = await device.popErrorScope();
      const validationErrors = [
        ...compilationErrors,
        ...(validationError ? [validationError.message || String(validationError)] : [])
      ];
      evidenceBuffer.destroy();
      readbackBuffer.destroy();
      device.destroy();
      return {
        status: 'gpu-evidence-ready',
        helperSchema: module.ULG_NATIVE_REFRACTION_TRANSPORT_WGSL_SCHEMA,
        evidence,
        evidenceByteLength,
        submitCount,
        mapCount,
        validationErrors,
        productionShaderCompilationErrorCount: productionCompilationErrors.length,
        uncapturedErrors
      };
    }, {
      evidenceFloatCount: EVIDENCE_FLOAT_COUNT,
      evidenceByteLength: EVIDENCE_BYTE_LENGTH,
      wideProjectionFixture,
      squareProjectionFixture
    });
  } finally {
    await browser.close();
  }

  const checks = scienceChecks(result);
  const { status: executionStatus, ...resultFields } = result;
  const artifact = {
    schema: 'peercompute.ulg.native-refraction-science-probe.v0',
    status: checks.every((check) => check.passed) ? 'pass' : 'fail',
    executionStatus,
    startedAt,
    completedAt: new Date().toISOString(),
    baseUrl,
    checks,
    ...resultFields
  };
  await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(artifact)}\n`);
  if (artifact.status !== 'pass') process.exitCode = 1;
}

await main();
