import {
  ensureSchroederSolidRigidFamilyForUpload,
  latestSchroederDeformableSolidSurfaceFamily,
  latestSchroederSolidRigidFamily,
  schroederSolidRigidFamilyForUpload
} from '../runtime/sph/schroederSolidRigidLane.js';
import { encodeSchroederSolidIsosurfaceFieldSplatWebGpu } from '../runtime/sph/schroederSolidIsosurfaceFieldGpu.js';
import { createSchroederSolidMemberShapeRenderer } from '../runtime/sph/schroederSolidShapeCarrier.js';
import { createSchroederDeformableSolidSurfaceRenderer } from '../runtime/sph/schroederSolidDeformableShapeGpu.js';
import {
  SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS,
  SPH_GPU_RENDER_FIELD_CELL_FLOATS,
  buildSphRenderFieldWebGpu,
  extractSphRenderRowsWebGpu
} from '../runtime/sph/sphRenderGpuKernel.js';
import {
  productEventLiveCountCopyDescriptor,
  residentProductEventCountAuthorityRegistered,
  validateProductEventLiveCountCopyDescriptor
} from '../runtime/sph/sphResidentProductHistoryGpu.js';
import {
  beginSphGpuParticleUploadLedgerParcelsBorrow,
  sphGpuParticleUploadAdvertisesDispersedMediumOptics
} from '../runtime/sph/sphGpuBuffers.js';
import { encodeSphLedgerParcelOpticsWebGpu } from '../runtime/sph/sphLedgerParcelOpticsGpu.js';
import {
  beginSphDispersedMediumGpuBufferBorrow
} from '../runtime/sph/sphDispersedMediumGpuBuffers.js';
import {
  bindUlgWebGpuMarchingCubesVolumeSuccessorLineage,
  buildWebGpuMarchingCubesExtensionSurfaceRowsWebGpu,
  createUlgRenderFieldBufferVolumeDescriptor,
  createUlgWebGpuMarchingCubesExtensionAdapter
} from '../runtime/sph/sphMarchingCubesSurfaceAdapter.js';
import {
  SPH_PARTICIPATING_MEDIUM_DESCRIPTOR_STATUS,
  SPH_PARTICIPATING_MEDIUM_PACKED_FRAME_STATUS,
  createSphParticipatingMediumDescriptor,
  createSphParticipatingMediumGpu,
  destroySphParticipatingMediumPackedFrame,
  encodeSphParticipatingMediumPack,
  encodeSphParticipatingMediumRender
} from '../runtime/sph/sphParticipatingMediumGpu.js';
import { deferSubmittedWorkCleanup } from '../runtime/webgpuComputeLayout.js';
import { ISOSURFACE_MOTION_WGSL } from '../visualization/isosurfaceMotionWgsl.js';
import { encodeNativeSurfaceTemperatureRowsWebGpu } from '../visualization/nativeSurfaceTemperatureWgsl.js';
import { createIsosurfaceMotionPacing, createPresentationPauseClock, isosurfaceMotionAge, resumeIsosurfaceMotionPacing, slowIsosurfaceMotionPacing, snapshotIsosurfaceSourceTimingBootstrap } from './workerOwnedIsosurfaceMotion.js';
import {
  createWorkerOwnedNativeSurfaceMaterial,
  snapshotWorkerNativeSurfaceMaterial,
  workerNativeSurfaceKind,
  WORKER_NATIVE_SURFACE_UNIFORM_BYTES
} from './workerOwnedNativeSurfaceMaterial.js';
import {
  ULG_WORKER_PRESENTATION_FRAME_QUEUE_COMPLETION_SCOPE,
  ULG_WORKER_PRESENTATION_PHYSICS_PREFIX_INCLUDED,
  ULG_WORKER_PRESENTATION_PHYSICS_PREFIX_NOT_ATTRIBUTED
} from '../runtime/sph/sphWorkerPresentationQos.js';
import {
  createBufferVolumeDescriptor,
  createMarchingCubesSurfaceAdapter
} from 'three-webgpu-marching-cubes';

export const ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_SCHEMA =
  'peercompute.ulg.worker-offscreen-resident-isosurface-presentation.v0';
export const ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_REQUEST_SCHEMA =
  'peercompute.ulg.worker-offscreen-resident-isosurface-request.v0';
export const ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_ENQUEUED_STATUS =
  'worker-offscreen-resident-isosurface-presentation-enqueued';
export const ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS =
  'worker-offscreen-resident-isosurface-presentation-rendered';
export const ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_FAILED_STATUS =
  'worker-offscreen-resident-isosurface-presentation-failed';
export const ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_SUPERSEDED_STATUS =
  'worker-offscreen-resident-isosurface-presentation-superseded';
export const ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_GEOMETRY =
  'worker-owned-true-isosurface';
export const ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_FRAME_SCHEMA =
  'peercompute.ulg.worker-offscreen-resident-isosurface-presentation-frame.v0';

const ULG_SPH_GPU_RENDER_FIELD_SCHEMA =
  'peercompute.ulg.sph-gpu-render-field.v1';
// A1: physics may wait for a busy render lane (a retained submission gap) only
// when no lane frame has completed for this long: about 30 presented frames/s.
export const RETAINED_GAP_STARVATION_MS = 1000 / 30;

// Convert a Three.js column-major OpenGL-NDC (z in [-w, w]) view-projection
// matrix into WebGPU-NDC (z in [0, w]) so opaque rigid solid meshes write
// bit-consistent depth values alongside workerNativeSurfaceMotionWgsl
// (`clip.z = clip.z * 0.5 + clip.w * 0.5`).
export function threeViewProjectionToWebGpuClipMatrix(viewProjectionMatrix) {
  const out = new Float32Array(16);
  for (let i = 0; i < 16; i += 1) out[i] = Number(viewProjectionMatrix[i]) || 0;
  for (let c = 0; c < 4; c += 1) {
    const base = c * 4;
    out[base + 2] = 0.5 * out[base + 2] + 0.5 * out[base + 3];
  }
  return out;
}
const NO_FULL_READBACK_MODE = 'no-full-readback';
const CONSERVATIVE_NO_READBACK_MODE = 'gpu-conservative-no-readback';
const DEFAULT_DEPTH_FORMAT = 'depth24plus';
const PARTICIPATING_MEDIUM_PRESENTATION_SCHEMA =
  'peercompute.ulg.worker-participating-medium-presentation.v0';
const PARTICIPATING_MEDIUM_NOT_REQUESTED_STATUS = 'not-requested';
const PARTICIPATING_MEDIUM_READY_STATUS =
  SPH_PARTICIPATING_MEDIUM_DESCRIPTOR_STATUS.ready;
const PARTICIPATING_MEDIUM_EMPTY_STATUS =
  SPH_PARTICIPATING_MEDIUM_DESCRIPTOR_STATUS.empty;
const PARTICIPATING_MEDIUM_BLOCKED_STATUS =
  SPH_PARTICIPATING_MEDIUM_DESCRIPTOR_STATUS.blocked;
const ORDINARY_PRESENTATION_PASS_ORDER = Object.freeze([
  'ordered-isosurface-and-overlay'
]);
const HYBRID_PRESENTATION_PASS_ORDER = Object.freeze([
  'opaque-isosurface',
  'depth-clipped-participating-medium',
  'transparent-isosurface-and-overlay'
]);
const BUFFER_USAGE_COPY_SRC = 0x04;
const BUFFER_USAGE_COPY_DST = 0x08;
const BUFFER_USAGE_UNIFORM = 0x40;
const BUFFER_USAGE_STORAGE = 0x80;

// Only a completed GPU draw whose browser callback timed out is retryable.
// GPU errors, absent observers and arbitrary callback failures stay fatal.
class PresentationOpportunityTimeoutError extends Error {}

const workerOwnedIsosurfaceWgsl = /* wgsl */`
struct SurfaceUniforms {
  view_projection: mat4x4<f32>,
  origin_scale: vec4<f32>,
  grid_bias_alpha: vec4<f32>,
  color_roughness: vec4<f32>,
  camera_emissive: vec4<f32>,
  optical: vec4<f32>,
  motion_grid: vec4<u32>,
  motion: vec4<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: SurfaceUniforms;
@group(0) @binding(1) var<storage, read> isosurface_motion_rows: array<vec4<f32>>;

${ISOSURFACE_MOTION_WGSL}

struct VertexInput {
  @location(0) grid_position: vec4<f32>,
  @location(1) packed_normal: u32,
};

struct VertexOutput {
  @builtin(position) clip_position: vec4<f32>,
  @location(0) world_position: vec3<f32>,
  @location(1) world_normal: vec3<f32>,
};

fn decode_snorm16(bits: u32) -> f32 {
  let raw = i32(bits & 0xffffu);
  let signed = select(raw, raw - 65536, raw >= 32768);
  return clamp(f32(signed) / 32767.0, -1.0, 1.0);
}

fn decode_octahedral_normal(packed: u32) -> vec3<f32> {
  let e = vec2<f32>(
    decode_snorm16(packed),
    decode_snorm16(packed >> 16u)
  );
  var normal = vec3<f32>(e.x, e.y, 1.0 - abs(e.x) - abs(e.y));
  if (normal.z < 0.0) {
    let prior = normal.xy;
    normal.x = (1.0 - abs(prior.y)) * select(-1.0, 1.0, prior.x >= 0.0);
    normal.y = (1.0 - abs(prior.x)) * select(-1.0, 1.0, prior.y >= 0.0);
  }
  return normalize(normal);
}

@vertex
fn vertex_main(input: VertexInput) -> VertexOutput {
  let motion = sample_isosurface_motion(
    input.grid_position.xyz + uniforms.grid_bias_alpha.xyz,
    uniforms.origin_scale.w, decode_octahedral_normal(input.packed_normal),
    uniforms.motion.x, uniforms.motion.y,
    uniforms.motion_grid.x, uniforms.motion_grid.y, uniforms.motion_grid.z
  );
  let world_position = uniforms.origin_scale.xyz
    + (input.grid_position.xyz + uniforms.grid_bias_alpha.xyz)
      * uniforms.origin_scale.w + motion.displacement;
  var output: VertexOutput;
  var clip = uniforms.view_projection * vec4<f32>(world_position, 1.0);
  clip.z = clip.z * 0.5 + clip.w * 0.5;
  if (clip.w <= 0.0) {
    clip = vec4<f32>(2.0, 2.0, 1.0, 1.0);
  }
  output.clip_position = clip;
  output.world_position = world_position;
  output.world_normal = motion.normal;
  return output;
}

fn blackbody_tint(temperature_k: f32) -> vec3<f32> {
  let heat = clamp((temperature_k - 800.0) / 2200.0, 0.0, 1.0);
  return mix(vec3<f32>(1.0, 0.22, 0.025), vec3<f32>(1.0, 0.92, 0.68), heat);
}

@fragment
fn fragment_main(input: VertexOutput) -> @location(0) vec4<f32> {
  let normal = normalize(input.world_normal);
  let light_direction = normalize(vec3<f32>(0.38, 0.82, 0.42));
  let view_direction = normalize(uniforms.camera_emissive.xyz - input.world_position);
  let half_direction = normalize(light_direction + view_direction);
  let diffuse = 0.18 + 0.82 * max(dot(normal, light_direction), 0.0);
  let roughness = clamp(uniforms.color_roughness.w, 0.05, 1.0);
  let specular_power = mix(96.0, 8.0, roughness);
  let specular = pow(max(dot(normal, half_direction), 0.0), specular_power);
  let fresnel = pow(1.0 - max(dot(normal, view_direction), 0.0), 3.0);
  let transparency_class = uniforms.optical.x;
  let phase_id = uniforms.optical.y;
  let closure_optics_authoritative = uniforms.optical.w > 0.5;
  let closure_vapor_surface = closure_optics_authoritative
    && ((transparency_class > 0.5 && transparency_class < 1.5)
      || (phase_id > 2.5 && phase_id < 3.5));
  let emissive_temperature_k = uniforms.camera_emissive.w;
  let emissive_strength = clamp((emissive_temperature_k - 800.0) / 1500.0, 0.0, 2.5);
  var color = uniforms.color_roughness.rgb * diffuse;
  color += vec3<f32>(1.0) * specular * mix(0.16, 0.72, 1.0 - roughness);
  color += uniforms.color_roughness.rgb * fresnel * select(0.12, 0.42, transparency_class > 0.5);
  color += blackbody_tint(emissive_temperature_k) * emissive_strength;
  var alpha = uniforms.grid_bias_alpha.w;
  if (transparency_class > 0.5 && transparency_class < 1.5) {
    if (!closure_optics_authoritative) {
      color = mix(color, vec3<f32>(0.88, 0.92, 0.96), 0.28 + fresnel * 0.34);
      alpha *= 0.20 + 0.42 * fresnel;
    }
  } else if (transparency_class >= 1.5) {
    alpha *= 0.64 + 0.28 * fresnel;
  } else if (phase_id > 2.5 && phase_id < 3.5) {
    if (!closure_optics_authoritative) {
      alpha *= 0.34;
    }
  }
  let minimum_alpha = select(0.015, 0.0, closure_vapor_surface);
  return vec4<f32>(max(color, vec3<f32>(0.0)), clamp(alpha, minimum_alpha, 1.0));
}
`;

function nowMs() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function gpuBufferUsage(name, fallback) {
  return globalThis.GPUBufferUsage?.[name] ?? fallback;
}

function isGpuBufferLike(value) {
  return Boolean(
    value
    && typeof value === 'object'
    && (
      value.constructor?.name === 'GPUBuffer'
      || typeof value.mapAsync === 'function'
      || typeof value.getMappedRange === 'function'
    )
  );
}

export function resolveWorkerOwnedIsosurfaceProductEventSource({
  device,
  retained
} = {}) {
  const source = retained?.residentProductMass ?? null;
  if (!source) {
    return Object.freeze({
      productEventBuffer: null,
      productEventSource: null,
      productEventCount: 0,
      productEventLiveCountDescriptor: null
    });
  }
  const productEventBuffer = source.productEventBuffer ?? null;
  const declaredRowCount = Number(source.productEventRowCount);
  const declaredRowCapacity = Number(
    source.productEventRowCapacity ?? source.productEventRowCount
  );
  const advertisesProductEvents = Boolean(
    productEventBuffer
    || source.productEventLiveCountAuthority
    || residentProductEventCountAuthorityRegistered(source)
    || (Number.isFinite(declaredRowCount) && declaredRowCount > 0)
    || (Number.isFinite(declaredRowCapacity) && declaredRowCapacity > 0)
  );
  if (!advertisesProductEvents) {
    return Object.freeze({
      productEventBuffer: null,
      productEventSource: null,
      productEventCount: 0,
      productEventLiveCountDescriptor: null
    });
  }
  const descriptor = productEventBuffer
    ? productEventLiveCountCopyDescriptor(source, device)
    : null;
  const rowCapacity = descriptor?.expectedRowCapacity ?? 0;
  const requiredByteLength = rowCapacity
    * SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  if (
    source.productEventBufferRetained !== true
    || !productEventBuffer
    || !descriptor
    || !validateProductEventLiveCountCopyDescriptor(
      descriptor,
      { handle: source, device }
    )
    || descriptor.hostObserved !== false
    || !Number.isSafeInteger(rowCapacity)
    || rowCapacity <= 0
    || descriptor.rowCapacity !== rowCapacity
    || descriptor.expectedRowStrideVec4
      !== SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS / 4
    || descriptor.rowStrideFloats !== SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS
    || !Number.isSafeInteger(declaredRowCount)
    || declaredRowCount !== rowCapacity
    || !Number.isSafeInteger(declaredRowCapacity)
    || declaredRowCapacity !== rowCapacity
    || !(Number(productEventBuffer.size) >= requiredByteLength)
  ) {
    throw new TypeError(
      'worker-owned isosurface requires an exact retained product-event buffer and authenticated GPU live-count capacity'
    );
  }
  return Object.freeze({
    productEventBuffer,
    productEventSource: source,
    productEventCount: rowCapacity,
    productEventLiveCountDescriptor: descriptor
  });
}

function beginWorkerOwnedIsosurfaceProductEventSourceBorrow(source) {
  if (!source) return null;
  if (!Object.hasOwn(source, '__ulgActiveBorrowCount')) {
    throw new TypeError(
      'worker-owned isosurface requires a borrowable retained product-event source'
    );
  }
  const previousCount = Math.max(
    0,
    Math.floor(Number(source.__ulgActiveBorrowCount) || 0)
  );
  source.__ulgActiveBorrowCount = previousCount + 1;
  if (Number(source.__ulgActiveBorrowCount) !== previousCount + 1) {
    throw new TypeError(
      'worker-owned isosurface could not pin its retained product-event source'
    );
  }
  let released = false;
  return () => {
    if (released) return false;
    released = true;
    source.__ulgActiveBorrowCount = Math.max(
      0,
      (Number(source.__ulgActiveBorrowCount) || 0) - 1
    );
    return true;
  };
}

function beginWorkerOwnedIsosurfaceDispersedMediumBorrow(
  device,
  sphParticleUpload
) {
  const sidecarAdvertised =
    sphGpuParticleUploadAdvertisesDispersedMediumOptics(sphParticleUpload);
  if (!sidecarAdvertised) return null;
  const sidecar = sphParticleUpload?.dispersedMediumOptics ?? null;
  const particleCount = Number(sphParticleUpload?.particleCount);
  const rowCount = Number(sidecar?.rowCount);
  const rowStrideFloats = Number(sidecar?.rowStrideFloats);
  const bufferByteLength = Number(sidecar?.bufferByteLength);
  const expectedBufferByteLength = rowCount
    * rowStrideFloats
    * Float32Array.BYTES_PER_ELEMENT;
  if (
    !sidecar
    || sidecar.ownsBuffer !== true
    || sidecar.destroyed === true
    || sphParticleUpload.ownsDispersedMediumOpticsBuffer !== true
    || sphParticleUpload.dispersedMediumOpticsAuthority !== sidecar.authority
    || sphParticleUpload.dispersedMediumOpticsBuffer !== sidecar.buffer
    || sphParticleUpload.dispersedMediumOpticsRowCount !== sidecar.rowCount
    || sphParticleUpload.dispersedMediumOpticsRowStrideFloats
      !== sidecar.rowStrideFloats
    || sphParticleUpload.dispersedMediumOpticsBufferByteLength
      !== sidecar.bufferByteLength
    || !Number.isSafeInteger(particleCount)
    || particleCount <= 0
    || sidecar.particleCount !== particleCount
    || !Number.isSafeInteger(rowCount)
    || rowCount !== particleCount
    || !Number.isSafeInteger(rowStrideFloats)
    || rowStrideFloats <= 0
    || !Number.isSafeInteger(bufferByteLength)
    || bufferByteLength <= 0
    || bufferByteLength !== expectedBufferByteLength
    || !Number.isSafeInteger(Number(sidecar.buffer?.size))
    || Number(sidecar.buffer?.size) !== bufferByteLength
  ) {
    throw new TypeError(
      'worker-owned isosurface rejected torn dispersed-medium particle-upload aliases'
    );
  }
  return Object.freeze({
    sidecar,
    release: beginSphDispersedMediumGpuBufferBorrow(device, sidecar)
  });
}

export function snapshotWorkerOwnedSurfaceMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') {
    throw new TypeError(
      'worker-owned isosurface requires object surface metadata'
    );
  }
  const snapshot = { ...metadata };
  if (Array.isArray(metadata.boundsCenterM) || ArrayBuffer.isView(metadata.boundsCenterM)) {
    snapshot.boundsCenterM = Object.freeze(Array.from(metadata.boundsCenterM));
  }
  if (
    Array.isArray(metadata.colorLinear)
    || ArrayBuffer.isView(metadata.colorLinear)
  ) {
    snapshot.colorLinear = Object.freeze(Array.from(metadata.colorLinear));
  }
  if (
    Array.isArray(metadata.opticalScatteringSourceLinear)
    || ArrayBuffer.isView(metadata.opticalScatteringSourceLinear)
  ) {
    snapshot.opticalScatteringSourceLinear = Object.freeze(
      Array.from(metadata.opticalScatteringSourceLinear)
    );
  }
  if (metadata.opticalState && typeof metadata.opticalState === 'object') {
    snapshot.opticalState = Object.freeze({ ...metadata.opticalState });
  }
  return Object.freeze(snapshot);
}

function finiteVector(value, length) {
  if (!(Array.isArray(value) || ArrayBuffer.isView(value)) || value.length !== length) {
    return null;
  }
  const vector = Array.from(value, Number);
  return vector.every(Number.isFinite) ? vector : null;
}

function invertMatrix4(value) {
  const matrix = finiteVector(value, 16);
  if (!matrix) return null;
  const rows = Array.from({ length: 4 }, (_unused, row) => (
    Array.from({ length: 8 }, (_unusedColumn, column) => (
      column < 4
        ? matrix[column * 4 + row]
        : (column - 4 === row ? 1 : 0)
    ))
  ));
  for (let column = 0; column < 4; column += 1) {
    let pivotRow = column;
    for (let row = column + 1; row < 4; row += 1) {
      if (Math.abs(rows[row][column]) > Math.abs(rows[pivotRow][column])) {
        pivotRow = row;
      }
    }
    const pivot = rows[pivotRow][column];
    if (!Number.isFinite(pivot) || Math.abs(pivot) <= 1e-12) return null;
    if (pivotRow !== column) {
      [rows[column], rows[pivotRow]] = [rows[pivotRow], rows[column]];
    }
    for (let entry = 0; entry < 8; entry += 1) {
      rows[column][entry] /= pivot;
    }
    for (let row = 0; row < 4; row += 1) {
      if (row === column) continue;
      const factor = rows[row][column];
      if (factor === 0) continue;
      for (let entry = 0; entry < 8; entry += 1) {
        rows[row][entry] -= factor * rows[column][entry];
      }
    }
  }
  const inverse = new Float32Array(16);
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      const valueAtEntry = rows[row][column + 4];
      if (!Number.isFinite(valueAtEntry)) return null;
      inverse[column * 4 + row] = valueAtEntry;
    }
  }
  return inverse;
}

function isCollectiveOpticalSurface(metadata) {
  const hasExplicitCollectiveMarker = Boolean(
    metadata?.collectiveOpticalRoute === true
    || metadata?.collectiveOpticalRouteSchema != null
    || metadata?.collectiveOpticalRouteKey != null
    || metadata?.collectiveOpticalRouteId != null
  );
  if (hasExplicitCollectiveMarker) return true;
  if (metadata?.opticalStateId == null) return false;
  const opticalStateId = Number(metadata?.opticalStateId);
  return !Number.isSafeInteger(opticalStateId) || opticalStateId !== 0;
}

function workerOwnedParticipatingMediumPresentation(frame) {
  const medium = frame?.participatingMedium ?? null;
  const status = medium?.status ?? PARTICIPATING_MEDIUM_NOT_REQUESTED_STATUS;
  const ready = status === PARTICIPATING_MEDIUM_READY_STATUS
    && Boolean(medium?.packedFrame);
  const collectiveOpticalSurfaceCount = Math.max(
    0,
    Number(medium?.collectiveSurfaceCount) || 0
  );
  return Object.freeze({
    schema: PARTICIPATING_MEDIUM_PRESENTATION_SCHEMA,
    status,
    presentationComposition: collectiveOpticalSurfaceCount > 0
      ? 'marching-cubes-isosurfaces-plus-participating-medium'
      : 'marching-cubes-isosurfaces',
    marchingCubesSurfaceCount: frame?.surfaces?.length ?? 0,
    collectiveOpticalSurfaceCount,
    participatingMediumAggregateDrawCount: ready ? 1 : 0,
    collectiveOpticalShellFallbackCount: 0,
    participatingMediumDepthClipped: ready,
    participatingMediumPremultipliedAlpha: ready,
    presentationPassOrder: frame?.presentationPassOrder ?? (ready
      ? HYBRID_PRESENTATION_PASS_ORDER
      : ORDINARY_PRESENTATION_PASS_ORDER)
  });
}

export function buildWorkerOwnedIsosurfaceSurfaceUniformValues(
  frame = {},
  surface = {}
) {
  const metadata = surface.metadata || {};
  const transform = surface.translation?.positionTransform
    || surface.descriptor?.positionTransform
    || {};
  const values = new Float32Array(44);
  const viewProjectionMatrix = finiteVector(frame.viewProjectionMatrix, 16) || [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ];
  values.set(viewProjectionMatrix, 0);
  const origin = finiteVector(transform.originM, 3) || [0, 0, 0];
  values.set(origin, 16);
  values[19] = Number(transform.scaleM) || 1;
  const gridBias = Number.isFinite(Number(transform.gridBias))
    ? Number(transform.gridBias)
    : -0.5;
  values[20] = gridBias;
  values[21] = gridBias;
  values[22] = gridBias;
  const transparencyClassId = Math.max(
    0,
    Number(metadata.transparencyClassId) || 0
  );
  const phaseId = Math.max(0, Number(metadata.phaseId) || 0);
  const closureOpticsAuthoritative =
    Number(metadata.opticalResponseAuthorityFlag) > 0;
  const vaporSurface = (transparencyClassId > 0.5 && transparencyClassId < 1.5)
    || (phaseId > 2.5 && phaseId < 3.5);
  const effectiveOpacity = Number(metadata.opticalEffectiveOpacity);
  values[23] = closureOpticsAuthoritative && vaporSurface
    ? Math.min(1, Math.max(0, Number.isFinite(effectiveOpacity) ? effectiveOpacity : 0))
    : 1;
  const color = finiteVector(metadata.colorLinear, 3) || [0.72, 0.82, 0.94];
  values.set(color, 24);
  const opticalRoughness = Number(metadata.opticalRoughness);
  values[27] = Number.isFinite(opticalRoughness)
    ? Math.min(1, Math.max(0.05, opticalRoughness))
    : (transparencyClassId > 0 ? 0.12 : 0.42);
  values.set(finiteVector(frame.cameraPositionM, 3) || [0, 0, 0], 28);
  values[31] = Math.max(0, Number(metadata.emissiveTemperatureK) || 0);
  values[32] = transparencyClassId;
  values[33] = phaseId;
  values[34] = Number(metadata.depthWriteFlag) === 0 ? 0 : 1;
  values[35] = closureOpticsAuthoritative ? 1 : 0;
  if (frame.motionField?.buffer) {
    const words = new Uint32Array(values.buffer);
    words[36] = surface.descriptor?.fieldOffset ?? 0;
    words[37] = surface.metadata?.resolution ?? 0;
    words[38] = frame.motionField.rowCount;
    values[40] = Math.max(0, Number(frame.drawMotionAgeS) || 0);
    // One field-cell edge bounds presentation deformation. It is not a
    // mechanics displacement clamp and never changes the captured source.
    values[41] = Math.abs(values[19]);
  }
  return values;
}

export function summarizeWorkerOwnedIsosurfaceOpticalPresentation(
  surfaces = []
) {
  const metadata = (Array.isArray(surfaces) ? surfaces : [])
    .map((surface) => surface?.metadata ?? surface)
    .filter(Boolean);
  const gasRows = metadata.filter((row) => {
    const transparencyClassId = Number(row.transparencyClassId) || 0;
    const phaseId = Number(row.phaseId) || 0;
    return (transparencyClassId > 0.5 && transparencyClassId < 1.5)
      || (phaseId > 2.5 && phaseId < 3.5);
  });
  const closureRows = gasRows.filter(
    (row) => Number(row.opticalResponseAuthorityFlag) > 0
  );
  const visibleRows = closureRows.filter(
    (row) => Number(row.opticalEffectiveOpacity) > 0
  );
  return Object.freeze({
    schema: 'peercompute.ulg.worker-isosurface-optical-presentation.v0',
    status: gasRows.length === 0
      ? 'no-gas-surfaces'
      : (closureRows.length === gasRows.length
        ? 'all-gas-surfaces-closure-governed'
        : 'gas-surface-optical-authority-incomplete'),
    gasSurfaceCount: gasRows.length,
    closureGovernedGasSurfaceCount: closureRows.length,
    visibleClosureGasSurfaceCount: visibleRows.length,
    opticallyThinHiddenGasSurfaceCount: closureRows.length - visibleRows.length,
    allGasSurfacesClosureGoverned:
      gasRows.length > 0 && closureRows.length === gasRows.length,
    heuristicGasOpacityUsed: gasRows.length > closureRows.length,
    opticalProvenanceSources: [...new Set(
      closureRows.map((row) => row.opticalProvenanceSource).filter(Boolean)
    )].sort()
  });
}

function compactError(error) {
  return {
    errorName: error instanceof Error ? error.name : null,
    errorMessage: error instanceof Error ? error.message : String(error),
    errorStack: error instanceof Error ? String(error.stack || '').slice(0, 2000) : null
  };
}

function presentationReceiptBase(extra = {}) {
  return Object.freeze({
    schema: ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_SCHEMA,
    presentationGeometry:
      ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_GEOMETRY,
    sameDevicePresentation: true,
    gpuToCpuReadbackBytes: 0,
    fullParticleReadbackPerformed: false,
    fullParticleReadbackFree: true,
    authoritativeStateMutation: false,
    scientificValidation: false,
    sphValidation: false,
    fullPhysicsValidation: false,
    ...extra
  });
}

export function resolveWorkerOwnedIsosurfaceAdmission({
  request = null,
  retained = null
} = {}) {
  const surfaceTable = request?.surfaceTable;
  const viewProjectionMatrix = finiteVector(request?.viewProjectionMatrix, 16);
  const cameraPositionM = finiteVector(request?.cameraPositionM, 3);
  const reasons = [];
  let nativeSurfaceMaterial = null;
  try {
    nativeSurfaceMaterial = snapshotWorkerNativeSurfaceMaterial(request?.nativeSurfaceMaterial);
  } catch {
    reasons.push('native-surface-material');
  }
  if (request?.schema !== ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_REQUEST_SCHEMA) {
    reasons.push('request-schema');
  }
  if (request?.enabled !== true) reasons.push('request-disabled');
  if (
    surfaceTable?.schema !== ULG_SPH_GPU_RENDER_FIELD_SCHEMA
    || !(surfaceTable?.records instanceof Float32Array)
    || !Array.isArray(surfaceTable?.metadata)
    || surfaceTable.metadata.length !== Number(surfaceTable.surfaceCount)
    || surfaceTable.surfaceCount <= 0
    || surfaceTable.totalFieldCells <= 0
  ) {
    reasons.push('surface-table');
  }
  if (!viewProjectionMatrix) reasons.push('view-projection');
  if (!cameraPositionM) reasons.push('camera-position');
  if (!Number.isFinite(Number(request?.fieldPadding))) reasons.push('field-padding');
  if (!(Number(request?.refEdgeM) > 0)) reasons.push('reference-edge');
  if (
    retained?.status !== 'worker-retained-particle-state-ready'
    || retained?.sameWorkerPrivateReferences !== true
    || retained?.postMessageTransportAllowed !== false
  ) {
    reasons.push('same-worker-retained-authority');
  }
  if (
    !retained?.sphParticleState
    || !retained?.mlsMpmParticleState
    || !retained?.sphParticleUpload
    || !retained?.mlsMpmParticleUpload
    || (
      !retained?.successorSourceFamily
      && retained?.executionMode !== 'tier0-fused-resident-sequence'
    )
  ) {
    reasons.push('retained-private-references');
  }
  if (
    !isGpuBufferLike(retained?.sourceStateBuffer)
    || !isGpuBufferLike(retained?.sourceThermoBuffer)
    || !isGpuBufferLike(retained?.sourceMechanicsBuffer)
    || !isGpuBufferLike(retained?.sourceIdentityBuffer)
  ) {
    reasons.push('retained-gpu-buffers');
  }
  return Object.freeze({
    ok: reasons.length === 0,
    status: reasons.length === 0
      ? 'worker-owned-isosurface-admission-ready'
      : 'worker-owned-isosurface-admission-blocked',
    reason: reasons.length === 0 ? null : reasons.join(','),
    blockers: Object.freeze(reasons),
    surfaceCount: Math.max(0, Math.floor(Number(surfaceTable?.surfaceCount) || 0)),
    totalFieldCells: Math.max(0, Math.floor(Number(surfaceTable?.totalFieldCells) || 0)),
    particleCount: Math.max(0, Math.floor(Number(retained?.particleCount) || 0)),
    viewProjectionMatrix,
    cameraPositionM,
    nativeSurfaceMaterial
  });
}

function descriptorSignature(descriptor = {}) {
  return [
    descriptor.surfaceIndex ?? 0,
    descriptor.surfaceKey ?? '',
    ...(descriptor.dims || []),
    ...(descriptor.scalarStrides || []),
    descriptor.scalarOffset ?? 0,
    descriptor.scalarBufferByteLength ?? 0,
    descriptor.normalSign ?? -1,
    descriptor.scalarType ?? 'f32'
  ].join('|');
}

function volumeFromDescriptor(descriptor) {
  return createBufferVolumeDescriptor({
    device: descriptor.device,
    scalarBuffer: descriptor.scalarBuffer,
    dims: descriptor.dims,
    scalarStrides: descriptor.scalarStrides,
    scalarOffset: descriptor.scalarOffset,
    bufferByteLength: descriptor.scalarBufferByteLength,
    scalarType: descriptor.scalarType || 'f32',
    normalSign: descriptor.normalSign,
    label: descriptor.label
      || `ulg-worker-isosurface-${descriptor.surfaceKey || descriptor.surfaceIndex || 0}`,
    source: descriptor.source || 'ulg-render-field-density-storage-buffer'
  });
}

function rawExtensionExecution(wrapped) {
  return wrapped?.extensionExecution || null;
}

function releaseExtensionFrameSurface(surface, reason) {
  try { surface?.releaseTemperatureRows?.(); } catch { /* Continue independent mesh retirement. */ }
  try {
    surface?.translation?.destroyExtensionSurfaceBuffers?.({
      force: true,
      releaseLeases: true,
      reason
    });
  } catch {
    // Best-effort teardown; the extension result still owns the actual mesh.
  }
  try {
    surface?.rawExecution?.result?.release?.();
  } catch {
    // Device teardown is the final ownership boundary.
  }
  try {
    surface?.uniformBuffer?.destroy?.();
  } catch {
    // Device teardown is the final ownership boundary.
  }
}

export function createWorkerOwnedIsosurfacePresenter({
  device,
  context,
  format,
  depthFormat = DEFAULT_DEPTH_FORMAT,
  getDepthView,
  getViewportSize = null,
  drawOverlay = null,
  onTerminal = null,
  onFrameSubmitted = null,
  waitForPresentationOpportunity = null,
  getFramebufferEpoch = null,
  nextPresentationQueueCompletionSerial = null,
  temporalNowMs = nowMs,
  // The worker supplies its pre-creation history when this presenter is lazy.
  presentationPauseClock = createPresentationPauseClock(),
  captureRenderRows = extractSphRenderRowsWebGpu,
  buildRenderField = buildSphRenderFieldWebGpu,
  buildPresentationFrame = null,
  createNativeSurfaceMaterial = createWorkerOwnedNativeSurfaceMaterial,
  createParticipatingMediumDescriptor = createSphParticipatingMediumDescriptor,
  createParticipatingMediumGpu = createSphParticipatingMediumGpu,
  encodeParticipatingMediumPack = encodeSphParticipatingMediumPack,
  encodeParticipatingMediumRender = encodeSphParticipatingMediumRender,
  destroyParticipatingMediumPackedFrame =
    destroySphParticipatingMediumPackedFrame
} = {}) {
  if (!device?.createBuffer || !device?.queue?.submit) {
    throw new TypeError('worker-owned isosurface presenter requires a WebGPU device');
  }
  if (!context?.getCurrentTexture || !format) {
    throw new TypeError('worker-owned isosurface presenter requires a configured WebGPU canvas context');
  }
  if (typeof getDepthView !== 'function') {
    throw new TypeError('worker-owned isosurface presenter requires a depth-view provider');
  }
  if (typeof getFramebufferEpoch !== 'function') {
    throw new TypeError(
      'worker-owned isosurface presenter requires a framebuffer-epoch provider'
    );
  }

  let disposed = false;
  let generation = 0;
  let invalidationEpoch = 0;
  let running = false;
  let pumpPromise = null;
  let activeJob = null;
  let latestJob = null;
  let currentFrame = null;
  let recoveryCandidate = null;
  let redrawRequestSequence = 0;
  let presentationPlaying = true;
  let presentationPlaybackRevision = 0;
  let presentationMotionController = new AbortController();
  let latestViewProjectionMatrix = null;
  let latestCameraPositionM = null;
  let latestNativeSurfaceAppearance = null;
  let nativeMaterial = null;
  let mostRecentSubmittedGeneration = 0;
  let temporalLoopToken = 0;
  let temporalDelayHandle = null;
  let releaseTemporalDelay = null;
  let emptyMotionBuffer = null;
  let renderLaneTail = Promise.resolve();
  let retainedSubmissionGap = null;
  let retainedSubmissionGapWaiter = null;
  const retireRetainedSubmissionGap = () => {
    retainedSubmissionGap?.abort();
    retainedSubmissionGapWaiter?.abort();
  };
  let redrawPumpPromise = null;
  let pendingRedraw = null;
  let captureInFlightCount = 0;
  let resizeRetryInvalidationEpoch = null;
  const captureQuiescenceWaiters = new Set();
  let fieldRowsBuffer = null;
  let fieldRowsBufferByteLength = 0;
  let shaderModule = null;
  let opaquePipeline = null;
  let transparentPipeline = null;
  let pipelinePromise = null;
  let participatingMediumRuntime = null;
  let firstDrawValidated = false;
  let presentationQueueCompletionCount = 0;
  const adapterCache = new Map();

  const terminal = (job, status, extra = {}) => {
    try {
      onTerminal?.(presentationReceiptBase({
        status,
        requestGeneration: job.generation,
        sourceCapturedBeforePhysicsContinuation: true,
        ...job.receiptFields,
        ...extra,
        updatedAtMs: nowMs()
      }));
    } catch {
      // Telemetry must never affect presentation ownership.
    }
  };

  const releaseCapturedRows = (captured, reason) => {
    if (!captured) return;
    const destroyCapturedRows = () => {
      try {
        captured.destroyRenderRowsBuffer?.({ reason });
      } catch {
        try {
          captured.destroyRenderRowsBuffer?.();
        } catch {
          // One broken cleanup must not suppress the remaining job releases.
        }
      }
    };
    try {
      deferSubmittedWorkCleanup(device, destroyCapturedRows);
    } catch {
      // A queue that cannot even construct its completion promise offers no
      // safer retirement boundary. Release best-effort and keep unwinding the
      // product-event and dispersed-medium ownership captured by this job.
      destroyCapturedRows();
    }
  };

  const releaseProductEventSourceBorrow = (job) => {
    if (!job || job.productEventSourceBorrowReleased) return false;
    job.productEventSourceBorrowReleased = true;
    return job.releaseProductEventSourceBorrow?.() === true;
  };

  const releaseDispersedMediumSourceBorrow = (job) => {
    if (!job || job.dispersedMediumSourceBorrowReleased) return false;
    job.dispersedMediumSourceBorrowReleased = true;
    return job.releaseDispersedMediumSourceBorrow?.() === true;
  };

  // The ledger parcel family is read by the frame's last submission (the
  // medium pack encoder), so its borrow ends with the job, not at the
  // render-field boundary.
  const releaseLedgerParcelsBorrow = (job) => {
    if (!job?.ledgerParcelsBorrow) return;
    const borrow = job.ledgerParcelsBorrow;
    job.ledgerParcelsBorrow = null;
    borrow.release();
  };

  const releaseFrame = (frame, reason) => {
    if (!frame) return;
    nativeMaterial?.releaseFrame(frame);
    if (frame.motionField) {
      const motionField = frame.motionField;
      frame.motionField = null;
      deferSubmittedWorkCleanup(device, () => motionField.destroy());
    }
    for (const surface of frame.surfaces || []) {
      releaseExtensionFrameSurface(surface, reason);
    }
    const medium = frame.participatingMedium;
    if (medium?.packedFrame && medium.released !== true) {
      medium.released = true;
      try {
        destroyParticipatingMediumPackedFrame(medium.packedFrame);
      } catch {
        // Device teardown is the final ownership boundary.
      }
    }
  };

  const retireRecoveryCandidate = (reason) => {
    const candidate = recoveryCandidate;
    recoveryCandidate = null;
    if (candidate) {
      // A preparation await can still create frame-owned material resources
      // after its GPU fence. Retire only after that whole render-lane user.
      void onRenderLane(() => {
        deferSubmittedWorkCleanup(device, () => releaseFrame(candidate.frame, reason));
      }).catch(() => {});
    }
  };

  const retireTemperatureRows = (rows) => {
    if (!rows) return;
    try { deferSubmittedWorkCleanup(device, () => rows.destroy()); }
    catch { rows.destroy(); } // Device teardown may not provide a completion promise.
  };

  const ensureParticipatingMediumRuntime = () => {
    participatingMediumRuntime ||= createParticipatingMediumGpu(device, {
      colorFormat: format,
      depthFormat
    });
    return participatingMediumRuntime;
  };

  const ensureNativeMaterial = () => {
    nativeMaterial ||= createNativeSurfaceMaterial({
      device, format, depthFormat,
      onAppearanceReady() {
        if (!disposed) void scheduleRedraw({ reason: 'worker-native-appearance-ready' }).catch(() => {});
      }
    });
    return nativeMaterial;
  };

  const releaseAdapterEntry = async (entry) => {
    if (!entry || entry.released) return;
    entry.released = true;
    try {
      await entry.wrapper?.adapter?.release?.({ destroyDevice: false });
    } catch {
      // The caller-owned device remains authoritative.
    }
  };

  const releaseAdapterCache = async () => {
    const entries = [...adapterCache.values()];
    adapterCache.clear();
    await Promise.all(entries.map(releaseAdapterEntry));
  };

  const ensureFieldRowsBuffer = async (requiredByteLength) => {
    if (fieldRowsBuffer && fieldRowsBufferByteLength >= requiredByteLength) {
      return fieldRowsBuffer;
    }
    await releaseAdapterCache();
    fieldRowsBuffer?.destroy?.();
    fieldRowsBufferByteLength = Math.max(4, Math.ceil(requiredByteLength));
    fieldRowsBuffer = device.createBuffer({
      label: 'ulg-worker-owned-isosurface-render-field',
      size: fieldRowsBufferByteLength,
      usage:
        gpuBufferUsage('STORAGE', BUFFER_USAGE_STORAGE)
        | gpuBufferUsage('COPY_SRC', BUFFER_USAGE_COPY_SRC)
        | gpuBufferUsage('COPY_DST', BUFFER_USAGE_COPY_DST)
    });
    return fieldRowsBuffer;
  };

  const adapterForDescriptor = async (descriptor) => {
    const signature = descriptorSignature(descriptor);
    const cached = adapterCache.get(signature);
    if (
      cached
      && !cached.released
      && cached.scalarBuffer === descriptor.scalarBuffer
    ) {
      return cached;
    }
    if (cached) await releaseAdapterEntry(cached);
    const volume = volumeFromDescriptor(descriptor);
    const wrapper = createUlgWebGpuMarchingCubesExtensionAdapter({
      device,
      volume,
      adapterId: 'webgpu-marching-cubes.buffer-volume.v0',
      adapterFactory({ device: adapterDevice, volume: adapterVolume }) {
        return createMarchingCubesSurfaceAdapter({
          device: adapterDevice,
          volume: adapterVolume,
          adapterId: 'webgpu-marching-cubes.buffer-volume.v0'
        });
      }
    });
    const entry = {
      signature,
      scalarBuffer: descriptor.scalarBuffer,
      volume,
      wrapper,
      released: false
    };
    adapterCache.set(signature, entry);
    return entry;
  };

  const ensurePipelines = async () => {
    if (opaquePipeline && transparentPipeline) return;
    if (pipelinePromise) return pipelinePromise;
    pipelinePromise = (async () => {
    emptyMotionBuffer ||= device.createBuffer({
      label: 'ulg-worker-isosurface-empty-motion', size: 16,
      usage: gpuBufferUsage('STORAGE', BUFFER_USAGE_STORAGE)
    });
    shaderModule ||= device.createShaderModule({
      label: 'ulg-worker-owned-isosurface-shader',
      code: workerOwnedIsosurfaceWgsl
    });
    if (typeof shaderModule.getCompilationInfo === 'function') {
      const compilationInfo = await shaderModule.getCompilationInfo();
      const errors = (compilationInfo?.messages || []).filter(
        (message) => message?.type === 'error'
      );
      if (errors.length > 0) {
        throw new Error(
          errors.map((message) => message.message).join('; ')
        );
      }
    }
    const baseDescriptor = {
      layout: 'auto',
      vertex: {
        module: shaderModule,
        entryPoint: 'vertex_main',
        buffers: [
          {
            arrayStride: 16,
            stepMode: 'vertex',
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x4' }
            ]
          },
          {
            arrayStride: 4,
            stepMode: 'vertex',
            attributes: [
              { shaderLocation: 1, offset: 0, format: 'uint32' }
            ]
          }
        ]
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'none'
      },
      multisample: { count: 1 }
    };
    const createPipeline = typeof device.createRenderPipelineAsync === 'function'
      ? (descriptor) => device.createRenderPipelineAsync(descriptor)
      : (descriptor) => Promise.resolve(device.createRenderPipeline(descriptor));
    [opaquePipeline, transparentPipeline] = await Promise.all([
      createPipeline({
      label: 'ulg-worker-owned-isosurface-opaque',
      ...baseDescriptor,
      fragment: {
        module: shaderModule,
        entryPoint: 'fragment_main',
        targets: [{ format }]
      },
      depthStencil: {
        format: depthFormat,
        depthWriteEnabled: true,
        depthCompare: 'less-equal'
      }
      }),
      createPipeline({
      label: 'ulg-worker-owned-isosurface-transparent',
      ...baseDescriptor,
      fragment: {
        module: shaderModule,
        entryPoint: 'fragment_main',
        targets: [{
          format,
          blend: {
            color: {
              srcFactor: 'src-alpha',
              dstFactor: 'one-minus-src-alpha',
              operation: 'add'
            },
            alpha: {
              srcFactor: 'one',
              dstFactor: 'one-minus-src-alpha',
              operation: 'add'
            }
          }
        }]
      },
      depthStencil: {
        format: depthFormat,
        depthWriteEnabled: false,
        depthCompare: 'less-equal'
      }
      })
    ]);
    })();
    try {
      await pipelinePromise;
    } finally {
      pipelinePromise = null;
    }
  };

  const surfaceUniformValues = buildWorkerOwnedIsosurfaceSurfaceUniformValues;

  const orderedFrameSurfaces = (frame) => [...(frame.surfaces || [])].sort(
    (left, right) => {
      const draw = surface => surface.translation?.surfaceDraw?.surfaces?.[0] || surface.metadata || {};
      const layer = surface => Number.isFinite(Number(draw(surface).renderOrder))
        ? Number(draw(surface).renderOrder) : Number(draw(surface).transparencyClassId) || 0;
      const depth = surface => {
        const center = finiteVector(draw(surface).boundsCenterM, 3);
        const camera = finiteVector(frame.cameraPositionM, 3);
        return center && camera ? center.reduce((sum, value, i) => sum + (value - camera[i]) ** 2, 0) : 0;
      };
      // Match native page ordering: authored layer first, then current-camera
      // depth within that layer. No hot geometry readback or fabricated bounds.
      return layer(left) - layer(right)
        || (workerNativeSurfaceKind(left) === 'opaque'
          ? depth(left) - depth(right) : depth(right) - depth(left));
    }
  );

  const drawIsosurface = (pass, frame, surface) => {
    const vertices = surface.translation?.surfaceVertices;
    const draw = surface.translation?.surfaceDraw;
    if (
      !vertices?.compactPositionRowsBuffer
      || !vertices?.compactNormalRowsBuffer
      || !draw?.drawIndirectRowsBuffer
    ) return false;
    const transparent = Number(surface.metadata?.transparencyClassId) > 0;
    const pipeline = transparent ? transparentPipeline : opaquePipeline;
    device.queue.writeBuffer(
      surface.uniformBuffer,
      0,
      surfaceUniformValues(frame, surface)
    );
    if (!surface.bindGroups.has(pipeline)) {
      surface.bindGroups.set(pipeline, device.createBindGroup({
        label:
          `ulg-worker-owned-isosurface-bind-group-${surface.descriptor.surfaceIndex}`,
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: surface.uniformBuffer } },
          { binding: 1, resource: { buffer: frame.motionField?.buffer || emptyMotionBuffer } }
        ]
      }));
    }
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, surface.bindGroups.get(pipeline));
    pass.setVertexBuffer(0, vertices.compactPositionRowsBuffer);
    pass.setVertexBuffer(1, vertices.compactNormalRowsBuffer);
    pass.drawIndirect(draw.drawIndirectRowsBuffer, 0);
    return true;
  };

  // G3 SOL-1: rigid shape carriers in the opaque pass. The vertex shader emits
  // each live member's exposed voxel faces and reads the pose from the
  // resident frame buffer the sim lane writes (melted members vanish).
  let solidShapeRenderer = null;
  let deformableSolidRenderer = null;
  const SOLID_SHAPE_COLORS = Object.freeze({ h2o: [0.78, 0.9, 0.98], ice: [0.78, 0.9, 0.98], fe: [0.55, 0.56, 0.6] });
  const drawSolidRigidShapes = (pass, frame) => {
    // When the live rigid members were splatted into the marching-cubes solid
    // isosurface field, skip the legacy flat voxel-cube overlay.
    if (frame?.solidRigidIsosurfaceSplatted === true) return false;
    // Copy-back presentation routes carry no step upload: fall back to the
    // family this device last stepped.
    const family = frame?.solidRigidFamily ?? latestSchroederSolidRigidFamily(device);
    if (!family || family.destroyed || family.device !== device || !Array.isArray(frame.viewProjectionMatrix)) return false;
    solidShapeRenderer ??= createSchroederSolidMemberShapeRenderer(device, { colorFormat: format, depthFormat });
    solidShapeRenderer.draw(pass, family, {
      viewProjection: threeViewProjectionToWebGpuClipMatrix(frame.viewProjectionMatrix),
      colorLinear: SOLID_SHAPE_COLORS[String(family.materials?.[0]).toLowerCase()] ?? [0.7, 0.7, 0.72]
    });
    return true;
  };
  const drawDeformableSolidSurfaces = (pass, frame) => {
    const family = frame?.deformableSolidFamily ?? latestSchroederDeformableSolidSurfaceFamily(device);
    if (!family || family.destroyed || family.device !== device || !Array.isArray(frame.viewProjectionMatrix)) return false;
    deformableSolidRenderer ??= createSchroederDeformableSolidSurfaceRenderer(device, { colorFormat: format, depthFormat });
    const viewProjection = threeViewProjectionToWebGpuClipMatrix(frame.viewProjectionMatrix);
    for (const entry of family.entries) {
      deformableSolidRenderer.draw(pass, entry.stage, {
        viewProjection,
        colorLinear: SOLID_SHAPE_COLORS[String(entry.material).toLowerCase()] ?? [0.76, 0.58, 0.36]
      });
    }
    return true;
  };

  const renderFrame = async (frame, {
    viewProjectionMatrix = frame.viewProjectionMatrix,
    cameraPositionM = frame.cameraPositionM,
    reason = 'worker-owned-isosurface-frame',
    allowLaggedGeneration = false,
    requiresVisibleFrame = false,
    requiresRecoverableFrame = false,
    playbackRevision = null,
    motionOnly = false,
    submissionBoundary = null,
    onSubmissionQueued = null,
    submissionDeadlineMs = null,
    expectedFramebufferEpoch = null,
    signal = null,
    motionAgeS = frame.lastDisplayedMotionAgeS || 0
  } = {}) => {
    let submissionQueued = false;
    const frameIsCurrent = () => Boolean(
      !disposed
      && signal?.aborted !== true
      && (submissionQueued || submissionDeadlineMs == null
        || (Number.isFinite(submissionDeadlineMs)
          && temporalNowMs() <= submissionDeadlineMs))
      && (playbackRevision == null || playbackRevision === presentationPlaybackRevision)
      && (!motionOnly || presentationPlaying)
      && frame?.invalidationEpoch === invalidationEpoch
      && (expectedFramebufferEpoch == null
        || Number(getFramebufferEpoch()) === expectedFramebufferEpoch)
      && frame.generation >= mostRecentSubmittedGeneration
      && (!requiresVisibleFrame || currentFrame === frame)
      && (!requiresRecoverableFrame || recoveryCandidate?.frame === frame)
      && (
        generation === frame.generation
        || allowLaggedGeneration === true
      )
    );
    if (!frameIsCurrent()) return false;
    const packedMedium = frame.participatingMedium?.status
      === PARTICIPATING_MEDIUM_READY_STATUS
      ? frame.participatingMedium.packedFrame
      : null;
    const readyParticipatingMediumRuntime = packedMedium
      ? ensureParticipatingMediumRuntime()
      : null;
    await Promise.all([
      ensureNativeMaterial().ready,
      readyParticipatingMediumRuntime?.ready
    ]);
    if (!frameIsCurrent()) return false;
    // Camera state is independent of captured physics. Read it immediately
    // before encoding so neither a slow field build nor pipeline setup can
    // restore the camera snapshot carried by an older source request.
    const nextViewProjection = latestViewProjectionMatrix
      || finiteVector(viewProjectionMatrix, 16);
    const nextCameraPosition = latestCameraPositionM
      || finiteVector(cameraPositionM, 3);
    if (nextViewProjection) frame.viewProjectionMatrix = [...nextViewProjection];
    if (nextCameraPosition) frame.cameraPositionM = [...nextCameraPosition];
    const material = ensureNativeMaterial();
    const sizeTexture = typeof getViewportSize === 'function' ? null : context.getCurrentTexture();
    const viewportSize = finiteVector(typeof getViewportSize === 'function'
      ? getViewportSize() : [sizeTexture?.width, sizeTexture?.height], 2);
    if (!viewportSize || viewportSize.some(value => !(value > 0))) {
      throw new Error('native material presentation requires a positive viewport');
    }
    let preparedAppearance;
    do {
      preparedAppearance = latestNativeSurfaceAppearance;
      frame.nativeSurfaceAppearance = preparedAppearance || frame.request.nativeSurfaceMaterial;
      await material.prepare(frame, viewportSize);
      if (!frameIsCurrent()) return false;
    } while (preparedAppearance !== latestNativeSurfaceAppearance);
    // Preparation may yield; the camera that wins that wait must also govern
    // the replacement, refraction reconstruction, and retained motion.
    if (latestViewProjectionMatrix) frame.viewProjectionMatrix = [...latestViewProjectionMatrix];
    if (latestCameraPositionM) frame.cameraPositionM = [...latestCameraPositionM];
    const inverseViewProjectionMatrix = invertMatrix4(frame.viewProjectionMatrix);
    if (!inverseViewProjectionMatrix) throw new Error('native material requires an invertible camera');
    motionAgeS = Math.max(motionAgeS, frame.lastDisplayedMotionAgeS || 0);
    frame.drawMotionAgeS = motionAgeS;
    const validateThisDraw = !firstDrawValidated
      && typeof device.pushErrorScope === 'function'
      && typeof device.popErrorScope === 'function';
    let validationScopeOpen = false;
    const closeValidationScope = async () => {
      if (!validationScopeOpen) return null;
      validationScopeOpen = false;
      return device.popErrorScope();
    };
    let submittedFramebufferEpoch;
    let submittedAtMs;
    let submittedPassOrder;
    if (validateThisDraw) {
      device.pushErrorScope('validation');
      validationScopeOpen = true;
    }
    try {
      const encoder = device.createCommandEncoder({
        label: 'ulg-worker-owned-isosurface-presentation'
      });
      const colorTexture = context.getCurrentTexture();
      const colorView = colorTexture.createView();
      const depthView = getDepthView();
      const orderedSurfaces = orderedFrameSurfaces(frame);
      const passOrder = ['opaque-isosurface'];
      const drawNative = (pass, surface, options = {}) => {
        if (material.draw(pass, frame, surface, {
          inverse: inverseViewProjectionMatrix, ...options
        }) !== true) throw new Error('native isosurface draw is missing mandatory GPU buffers');
      };
      const opaquePass = encoder.beginRenderPass({
        label: 'ulg-worker-owned-isosurface-opaque-pass',
        colorAttachments: [{
          view: colorView, clearValue: material.clearValue(frame),
          loadOp: 'clear', storeOp: 'store'
        }],
        depthStencilAttachment: {
          view: depthView, depthClearValue: 1,
          depthLoadOp: 'clear', depthStoreOp: 'store'
        }
      });
      try {
        material.drawBackground(opaquePass, frame);
        const activeDeformableFamily = frame?.deformableSolidFamily
          ?? latestSchroederDeformableSolidSurfaceFamily(device);
        const deformableSolidDomainIds = (
          activeDeformableFamily
          && !activeDeformableFamily.destroyed
          && activeDeformableFamily.device === device
          && Array.isArray(frame.viewProjectionMatrix)
        )
          ? new Set(
              activeDeformableFamily.entries
                .map((entry) => Number(entry.domainId))
                .filter((id) => Number.isFinite(id) && id > 0)
            )
          : null;
        for (const surface of orderedSurfaces) {
          if (workerNativeSurfaceKind(surface) !== 'opaque') continue;
          // Explicit SOL-4 deformable solid carriers render their watertight
          // material-space surface mesh directly; skip duplicate solid metaballs
          // for the same renderDomainId while keeping any melted liquid surfaces.
          if (
            deformableSolidDomainIds
            && Number(surface?.metadata?.phaseId) === 1
            && deformableSolidDomainIds.has(Number(surface?.metadata?.renderDomainId))
          ) {
            continue;
          }
          drawNative(opaquePass, surface);
        }
        // Rigid & deformable solid shape carriers draw inside the opaque pass (no separate pass).
        drawSolidRigidShapes(opaquePass, frame);
        drawDeformableSolidSurfaces(opaquePass, frame);
      } finally { opaquePass.end(); }

      // Each condensed surface gets its own rear-depth map and scene-color
      // snapshot. Front and rear passes use the same camera and motion age.
      // The native fragment writes alpha one with depth, not an alpha shell.
      const refractiveSurfaces = orderedSurfaces.filter(surface =>
        workerNativeSurfaceKind(surface) === 'refractive');
      if (refractiveSurfaces.length) passOrder.push('refractive-isosurface');
      for (const surface of refractiveSurfaces) {
        material.copySceneColor(encoder, colorTexture);
        const backPass = encoder.beginRenderPass({
          label: 'ulg-worker-owned-isosurface-refractive-backface-pass',
          colorAttachments: [],
          depthStencilAttachment: {
            view: material.backDepthView(), depthClearValue: 1,
            depthLoadOp: 'clear', depthStoreOp: 'store'
          }
        });
        try { drawNative(backPass, surface, { backface: true }); }
        finally { backPass.end(); }
        const frontPass = encoder.beginRenderPass({
          label: 'ulg-worker-owned-isosurface-refractive-pass',
          colorAttachments: [{ view: colorView, loadOp: 'load', storeOp: 'store' }],
          depthStencilAttachment: {
            view: depthView, depthLoadOp: 'load', depthStoreOp: 'store'
          }
        });
        try { drawNative(frontPass, surface, { refractive: true }); }
        finally { frontPass.end(); }
      }
      if (packedMedium) {
        passOrder.push('depth-clipped-participating-medium');
        const volumePass = encoder.beginRenderPass({
          label: 'ulg-worker-owned-participating-medium-pass',
          colorAttachments: [{ view: colorView, loadOp: 'load', storeOp: 'store' }]
        });
        try {
          await encodeParticipatingMediumRender(
            readyParticipatingMediumRuntime, volumePass, {
              packedFrame: packedMedium, inverseViewProjectionMatrix,
              cameraPositionM: frame.cameraPositionM, viewportSize,
              depthTextureView: depthView, lightDirection: [0.38, 0.82, 0.42],
              motionField: frame.motionField,
              motionAgeS: frame.drawMotionAgeS || 0
            }
          );
        } finally { volumePass.end(); }
      }
      passOrder.push('transparent-isosurface-and-overlay');
      const vaporPass = encoder.beginRenderPass({
        label: 'ulg-worker-owned-isosurface-transparent-overlay-pass',
        colorAttachments: [{ view: colorView, loadOp: 'load', storeOp: 'store' }],
        depthStencilAttachment: {
          view: depthView, depthLoadOp: 'load', depthStoreOp: 'discard'
        }
      });
      try {
        for (const surface of orderedSurfaces) {
          if (workerNativeSurfaceKind(surface) === 'vapor') drawNative(vaporPass, surface);
        }
        drawOverlay?.(vaporPass, frame.viewProjectionMatrix, frame.boxDimsM);
      } finally { vaporPass.end(); }
      submittedPassOrder = Object.freeze(passOrder);
      if (!frameIsCurrent()) {
        await closeValidationScope();
        return false;
      }
      submittedFramebufferEpoch = Number(getFramebufferEpoch());
      if (
        !Number.isSafeInteger(submittedFramebufferEpoch)
        || submittedFramebufferEpoch <= 0
      ) {
        throw new Error(
          'worker-owned isosurface framebuffer epoch is unavailable'
        );
      }
      const commandBuffer = encoder.finish();
      submittedAtMs = nowMs();
      // Timer tasks can be overdue behind preparation/encoding microtasks.
      // Check the monotonic deadline at the actual submission boundary too.
      if (Number(getFramebufferEpoch()) !== submittedFramebufferEpoch || !frameIsCurrent()) {
        await closeValidationScope();
        return false;
      }
      device.queue.submit([commandBuffer]);
      submissionQueued = true;
      frame.lastSubmittedMotionAgeS = motionAgeS;
      mostRecentSubmittedGeneration = Math.max(mostRecentSubmittedGeneration, frame.generation);
      // Once validated, install the queue fence without yielding: a later
      // physics microtask could otherwise join the shared submit burst and
      // unnecessarily extend this presentation's completion wait.
      const validationError = validationScopeOpen ? await closeValidationScope() : null;
      if (validationError) {
        throw new Error(
          validationError.message || String(validationError)
        );
      }
      if (validateThisDraw) firstDrawValidated = true;
    } catch (error) {
      try {
        await closeValidationScope();
      } catch {
        // Preserve the originating presentation error.
      }
      throw error;
    }
    if (
      !frameIsCurrent()
      || Number(getFramebufferEpoch()) !== submittedFramebufferEpoch
    ) return false;
    if (typeof device.queue?.onSubmittedWorkDone !== 'function') {
      throw new Error(
        'worker-owned isosurface presentation queue completion is unavailable'
      );
    }
    const presentationQueueCompletionSerial =
      typeof nextPresentationQueueCompletionSerial === 'function'
        ? Number(nextPresentationQueueCompletionSerial())
        : presentationQueueCompletionCount + 1;
    if (
      !Number.isSafeInteger(presentationQueueCompletionSerial)
      || presentationQueueCompletionSerial <= presentationQueueCompletionCount
    ) {
      throw new Error(
        'worker-owned isosurface presentation queue completion serial did not advance'
      );
    }
    presentationQueueCompletionCount = presentationQueueCompletionSerial;
    const queueCompletion = device.queue.onSubmittedWorkDone();
    let gpuCompletionObserved = false;
    void Promise.resolve(queueCompletion).then(
      () => { gpuCompletionObserved = true; },
      () => {} // The original fence is still awaited below for its exact error.
    );
    const opportunityCompletion = (() => {
      try {
        if (typeof waitForPresentationOpportunity !== 'function') {
          throw new Error(
            'worker-owned isosurface presentation opportunity observer is unavailable'
          );
        }
        return Promise.resolve(waitForPresentationOpportunity({
          afterGpuCompletion: queueCompletion,
          isCurrent: () => frameIsCurrent()
            && Number(getFramebufferEpoch()) === submittedFramebufferEpoch,
          signal
        })).then(opportunity => {
          if (opportunity?.available === true && !gpuCompletionObserved) {
            throw new Error(
              'worker-owned isosurface presentation opportunity preceded GPU completion'
            );
          }
          return opportunity;
        });
      } catch (error) {
        return Promise.reject(error);
      }
    })();
    // An injected observer may reject before the GPU fence settles. Retain
    // that rejection for the normal await, without an unhandled early error.
    void opportunityCompletion.catch(() => {});
    // Private scheduling acknowledgement, NOT a frame or physics proof. A
    // caller may queue later physics now; this lane still owns the draw until
    // its exact fence and post-GPU opportunity have both completed below.
    onSubmissionQueued?.();
    await queueCompletion;
    if (
      !frameIsCurrent()
      || Number(getFramebufferEpoch()) !== submittedFramebufferEpoch
    ) return false;
    const gpuCompletedAtMs = nowMs();
    const opportunity = await opportunityCompletion;
    const opportunityTimedOut = opportunity?.available === false
      && opportunity.method === 'worker-request-animation-frame-timeout';
    if (
      !opportunityTimedOut
      && (!frameIsCurrent()
        || Number(getFramebufferEpoch()) !== submittedFramebufferEpoch)
    ) return false;
    if (opportunity?.available !== true) {
      // Preserve a real timeout through resize so it still spends the
      // committed job's existing retry budget; stale outcomes are not misses.
      const OpportunityError = opportunityTimedOut
        ? PresentationOpportunityTimeoutError : Error;
      throw new OpportunityError(
        'worker-owned isosurface lacked a post-GPU presentation opportunity'
      );
    }
    const presentedAtMs = Number.isFinite(Number(opportunity.observedAtMs))
      ? Number(opportunity.observedAtMs)
      : nowMs();
    const opticalPresentation =
      summarizeWorkerOwnedIsosurfaceOpticalPresentation(
        frame.opticalMetadataSnapshots || frame.surfaces
      );
    frame.presentationPassOrder = submittedPassOrder;
    const participatingMediumPresentation =
      workerOwnedParticipatingMediumPresentation(frame);
    const proof = Object.freeze({
      presentationFrameSchema:
        ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_FRAME_SCHEMA,
      presentationFrameStatus:
        'worker-owned-isosurface-presentation-opportunity',
      presentationFrameAdmitted: true,
      nativeMaterialShader: 'existing-native-compact-surface-with-retained-motion',
      condensedDepthTestEnabled: true,
      condensedDepthWriteEnabled: true,
      vaporDepthTestEnabled: true,
      vaporDepthWriteEnabled: false,
      isosurfaceTemporalPresentation: motionAgeS > 0,
      isosurfacePresentationMotionAgeS: motionAgeS,
      isosurfacePresentationSourceTimeS: frame.sourceTimeS ?? null,
      isosurfacePresentationMotionMethod: motionAgeS > 0
        ? 'bounded-gpu-field-velocity-extrapolation' : 'committed-source-mesh',
      presentationOnly: motionAgeS > 0,
      authoritativeStateMutation: false,
      presentationFrameGpuCompleted: true,
      presentationFrameGpuCompletionMethod:
        'worker-device.queue.onSubmittedWorkDone',
      presentationFramePresentationOpportunity: true,
      presentationFramePresentationOpportunityMethod:
        opportunity.method ?? null,
      presentationFrameSubmitToGpuCompleteMs: Math.max(
        0,
        gpuCompletedAtMs - submittedAtMs
      ),
      presentationFrameSubmitToPresentationOpportunityMs: Math.max(
        0,
        presentedAtMs - submittedAtMs
      ),
      presentationQueueCompletionCount,
      presentationQueueCompletionSerial,
      presentationQueueCompletionMethod:
        'worker-device.queue.onSubmittedWorkDone',
      presentationQueueCompletionScope:
        ULG_WORKER_PRESENTATION_FRAME_QUEUE_COMPLETION_SCOPE,
      physicsQueuePrefixCoverage:
        submissionBoundary
          ? ULG_WORKER_PRESENTATION_PHYSICS_PREFIX_INCLUDED
          : ULG_WORKER_PRESENTATION_PHYSICS_PREFIX_NOT_ATTRIBUTED,
      physicsHostQueueFenceParticipation: submissionBoundary ? true : null,
      ...(submissionBoundary ? {
        physicsContinuationBlocked: true,
        presentationQosHostQueueFenceCount: 1,
        motionPresentationQosBoundary: submissionBoundary
      } : {}),
      workerFramebufferEpoch: submittedFramebufferEpoch,
      workerOwnedOpticalPresentation: opticalPresentation,
      workerOwnedParticipatingMediumPresentation:
        participatingMediumPresentation,
      presentationComposition:
        participatingMediumPresentation.presentationComposition,
      marchingCubesSurfaceCount:
        participatingMediumPresentation.marchingCubesSurfaceCount,
      collectiveOpticalSurfaceCount:
        participatingMediumPresentation.collectiveOpticalSurfaceCount,
      participatingMediumStatus: participatingMediumPresentation.status,
      participatingMediumAggregateDrawCount:
        participatingMediumPresentation.participatingMediumAggregateDrawCount,
      collectiveOpticalShellFallbackCount:
        participatingMediumPresentation.collectiveOpticalShellFallbackCount,
      participatingMediumDepthClipped:
        participatingMediumPresentation.participatingMediumDepthClipped,
      participatingMediumPremultipliedAlpha:
        participatingMediumPresentation.participatingMediumPremultipliedAlpha,
      presentationPassOrder:
        participatingMediumPresentation.presentationPassOrder
    });
    frame.lastDisplayedMotionAgeS = motionAgeS;
    try {
      onFrameSubmitted?.({
        reason,
        generation: frame.generation,
        surfaceCount: frame.totalSurfaceCount ?? frame.surfaces.length,
        sphStep: frame.sphStep,
        ...proof
      });
    } catch {
      // Frame accounting is diagnostic-only.
    }
    return proof;
  };

  let pendingSourceProgressToken = 0;
  // Renders queued or running on the lane, and when the lane last completed a
  // visible frame. The lane's frames hold it through GPU completion and the next
  // presentation opportunity (rAF), so a retained submission gap queued behind
  // them gates physics on display frames (A1: about 44 ms of every 63 ms Iron
  // Ice step). Physics is offered a gap freely only while the lane is idle; it
  // may wait for a busy lane only when presentation is starving (no frame for
  // RETAINED_GAP_STARVATION_MS), which bounds both sides.
  let renderLaneDepth = 0;
  let lastLaneFrameCompletedAtMs = null;
  const onRenderLane = (render) => {
    renderLaneDepth += 1;
    const scheduled = renderLaneTail.then(render);
    const settled = scheduled.then((proof) => {
      renderLaneDepth -= 1;
      if (proof) lastLaneFrameCompletedAtMs = temporalNowMs();
    }, () => { renderLaneDepth -= 1; });
    renderLaneTail = settled;
    return scheduled;
  };
  const presentationStarving = () => lastLaneFrameCompletedAtMs == null
    || temporalNowMs() - lastLaneFrameCompletedAtMs > RETAINED_GAP_STARVATION_MS;
  const scheduleRenderFrame = (frame, options) =>
    onRenderLane(() => renderFrame(frame, options));

  const retainedSubmissionGapEligible = (frame) => {
    if (disposed || !presentationPlaying || currentFrame !== frame
      || !frame?.motionField?.buffer || !frame.motionPacing
      || frame.invalidationEpoch !== invalidationEpoch
      || frame.generation < mostRecentSubmittedGeneration) return false;
    const ageS = isosurfaceMotionAge(frame.motionPacing, temporalNowMs());
    return ageS > (frame.lastDisplayedMotionAgeS || 0)
      && ageS < frame.motionPacing.maxSimulationAgeS;
  };
  // Unless presentation is starving, physics never waits behind an in-flight
  // frame: no gap while the render lane is occupied, and no prospective wait
  // for a pending predecessor's full proof.
  const hasRetainedSubmissionGapOpportunity = ({ waitForPendingSlot = false } = {}) => {
    if (typeof waitForPendingSlot !== 'boolean' || retainedSubmissionGapWaiter) return false;
    const starving = presentationStarving();
    if (!starving && (retainedSubmissionGap || renderLaneDepth > 0)) return false;
    return (waitForPendingSlot || !retainedSubmissionGap)
      && retainedSubmissionGapEligible(currentFrame);
  };

  const stopTemporalPresentation = () => {
    temporalLoopToken += 1;
    if (temporalDelayHandle != null) globalThis.clearTimeout(temporalDelayHandle);
    temporalDelayHandle = null;
    releaseTemporalDelay?.();
    releaseTemporalDelay = null;
  };

  const startTemporalPresentation = (frame) => {
    stopTemporalPresentation();
    if (!presentationPlaying || !frame?.motionField?.buffer || !frame.motionPacing) return;
    const token = temporalLoopToken;
    const playbackRevision = presentationPlaybackRevision;
    const signal = presentationMotionController.signal;
    const current = () => !disposed && currentFrame === frame
      && presentationPlaying && playbackRevision === presentationPlaybackRevision
      && frame.invalidationEpoch === invalidationEpoch && temporalLoopToken === token;
    const coalesced = Symbol('coalesced-isosurface-temporal-frame');
    let retryingOpportunity = false;
    // One outstanding draw on the same render lane. Queue completion and its
    // post-GPU presentation opportunity already pace the loop; do not add a
    // second rAF wait, which would halve cadence on a 60 Hz display.
    void (async () => {
      while (current()) {
        const startedAtMs = temporalNowMs();
        const ageS = isosurfaceMotionAge(frame.motionPacing, startedAtMs);
        if (ageS == null || (retryingOpportunity
          && ageS >= frame.motionPacing.maxSimulationAgeS)) return;
        if (ageS > (frame.lastDisplayedMotionAgeS || 0)) {
          let proof;
          try {
            proof = await onRenderLane(() => {
              if (!current()) return false;
              // A canonical boundary ahead on this lane may already have
              // displayed the age sampled above. Re-sample after waiting;
              // never clamp a queued animation job into a duplicate draw.
              const freshAgeS = isosurfaceMotionAge(frame.motionPacing, temporalNowMs());
              if (freshAgeS == null || (retryingOpportunity
                && freshAgeS >= frame.motionPacing.maxSimulationAgeS)) return false;
              if (!(freshAgeS > (frame.lastDisplayedMotionAgeS || 0))) return coalesced;
              return renderFrame(frame, {
                reason: 'worker-owned-isosurface-temporal-presentation',
                allowLaggedGeneration: true,
                requiresVisibleFrame: true,
                playbackRevision, motionOnly: true, signal,
                motionAgeS: freshAgeS
              });
            });
          } catch (error) {
            if (!(error instanceof PresentationOpportunityTimeoutError)) throw error;
            if (!current()) return;
            frame.temporalPresentationError = error.message;
            const retryAgeS = isosurfaceMotionAge(frame.motionPacing, temporalNowMs());
            // Failed waits never advance displayed age. Bound retries by the
            // actual wall horizon, including time spent waiting on the lane.
            if (!Number.isFinite(retryAgeS)
              || retryAgeS >= frame.motionPacing.maxSimulationAgeS) return;
            retryingOpportunity = true;
            proof = coalesced;
          }
          if (!proof || !current()) return;
          // A skip is private scheduling state, not a rendered-frame proof.
          // Keep the loop paced and alive for the next advancing age.
          if (proof !== coalesced) {
            retryingOpportunity = false;
            frame.temporalPresentationError = null;
            publishRenderedTerminal(frame, 'presentation-only retained GPU field motion', proof);
          }
        }
        if ((frame.lastDisplayedMotionAgeS || 0) >= frame.motionPacing.maxSimulationAgeS) return;
        const remainingMs = 1000 / frame.motionPacing.targetHz - (temporalNowMs() - startedAtMs);
        if (remainingMs > 0 && current()) {
          await new Promise(resolve => {
            releaseTemporalDelay = resolve;
            temporalDelayHandle = globalThis.setTimeout(() => {
              temporalDelayHandle = null;
              releaseTemporalDelay = null;
              resolve();
            }, remainingMs);
          });
        }
      }
    })().catch(error => {
      // A presentation failure must not become a physics schedule failure.
      if (current()) frame.temporalPresentationError = String(error?.message || error);
    });
  };

  const publishRenderedTerminal = (frame, reason, proof) => {
    const participatingMediumPresentation =
      workerOwnedParticipatingMediumPresentation(frame);
    const submittedSurfaceCount = frame.surfaces.length
      + participatingMediumPresentation.participatingMediumAggregateDrawCount;
    terminal(
      {
        generation: frame.generation,
        receiptFields: frame.receiptFields
      },
      ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS,
      {
        reason,
        surfaceCount: frame.totalSurfaceCount ?? frame.surfaces.length,
        submittedSurfaceCount,
        activeSurfaceCount: null,
        indirectDrawCount: submittedSurfaceCount,
        depthAttachmentFormat: depthFormat,
        depthAttachmentReady: true,
        boxWireframeDrawCount: frame.boxDimsM ? 1 : 0,
        boxDimsM: frame.boxDimsM ? [...frame.boxDimsM] : null,
        nonemptySurfaceCountMode: 'gpu-indirect-not-read-back',
        triangleCountMode: 'gpu-indirect-not-read-back',
        readbackMode: NO_FULL_READBACK_MODE,
        ...proof
      }
    );
  };

  // G2 Phase 6: parcel droplets join the H2O collective route's optical depth
  // after the gather and before the medium pack (sphLedgerParcelOpticsGpu.js).
  const encodeLedgerParcelOptics = (job, encoder, renderField, descriptor) => {
    const parcels = job.ledgerParcelsBorrow?.parcels ?? null;
    if (!parcels || parcels.device !== device || globalThis.__ulgDisableLedgerParcelOptics) return null;
    const metadata = renderField.surfaceTable.metadata;
    const surfaceIndex = descriptor.consumedSurfaceIndices.find(
      (index) => Number(metadata[index]?.materialId) === parcels.vaporMaterialId
    );
    const route = surfaceIndex == null ? null : metadata[surfaceIndex];
    const stats = (globalThis.__ulgLedgerParcelOptics ??= { frames: 0, routed: 0, unrouted: 0 });
    stats.frames++;
    if (!route) { stats.unrouted++; return null; }
    stats.routed++;
    return encodeSphLedgerParcelOpticsWebGpu({ device, encoder, parcels,
      fieldRowsBuffer: descriptor.fieldRowsBuffer, fieldOffset: Number(route.fieldOffset),
      resolution: Number(route.resolution), fieldPadding: Number(renderField.fieldPadding),
      refEdgeM: Number(renderField.refEdgeM) });
  };

  const buildFrame = async (job, captured) => {
    if (
      (captured?.dispersedMediumOptics ?? null)
      !== job.dispersedMediumOptics
    ) {
      throw new TypeError(
        'worker-owned isosurface capture did not retain its exact dispersed-medium sidecar'
      );
    }
    const requiredFieldBytes = job.request.surfaceTable.totalFieldCells
      * SPH_GPU_RENDER_FIELD_CELL_FLOATS
      * Float32Array.BYTES_PER_ELEMENT;
    const targetFieldRowsBuffer = await ensureFieldRowsBuffer(requiredFieldBytes);
    const productEvents = job.productEvents;
    const renderField = await buildRenderField({
      device,
      renderRows: captured.renderRows,
      renderRowsBuffer: captured.renderRowsBuffer,
      renderRowsSource: captured,
      dispersedMediumOptics: job.dispersedMediumOptics,
      schroederSpatialSourceFamily: captured.schroederSpatialSourceFamily,
      surfaceTable: job.request.surfaceTable,
      particleCount: captured.particleCount,
      productEventBuffer: productEvents.productEventBuffer,
      productEventSource: productEvents.productEventSource,
      productEventCount: productEvents.productEventCount,
      productEventLiveCountDescriptor:
        productEvents.productEventLiveCountDescriptor,
      fieldPadding: Number(job.request.fieldPadding),
      refEdgeM: Number(job.request.refEdgeM),
      renderSmearDtS: Math.max(0, Number(job.request.renderSmearDtS) || 0),
      readbackMode: NO_FULL_READBACK_MODE,
      retainFieldRowsBuffer: true,
      retainMotionFieldBuffer: true,
      retainSurfaceBuffer: false,
      waitForQueueCompletion: false,
      deferCleanup: true,
      targetFieldRowsBuffer,
      targetFieldRowsBufferByteLength: fieldRowsBufferByteLength
    });
    // buildRenderField resolves only after its same-device queue submission.
    // The immutable product source may be recycled by the next continuation
    // after that ordered consumer boundary, but not while this job is queued
    // or the render-field submission is still being assembled.
    releaseProductEventSourceBorrow(job);
    releaseDispersedMediumSourceBorrow(job);
    releaseCapturedRows(captured, 'worker-isosurface-render-field-submitted');
    job.capturedReleased = true;

    // Extension extraction yields repeatedly. Capture presentation values at
    // the render-field publication boundary so a later caller mutation cannot
    // retarget material/phase routing or optical uniforms mid-frame.
    const surfaceMetadataSnapshots = renderField.surfaceTable.metadata.map(
      snapshotWorkerOwnedSurfaceMetadata
    );
    const descriptors = surfaceMetadataSnapshots.map((_snapshot, surfaceIndex) =>
      createUlgRenderFieldBufferVolumeDescriptor({
        device,
        renderField,
        // The adapter's successor contract authenticates this exact object
        // identity. Descriptor construction is synchronous, before any yield;
        // the copied snapshot is used only by post-await presentation work.
        surface: renderField.surfaceTable.metadata[surfaceIndex],
        surfaceIndex
      }));
    const blockedDescriptor = descriptors.find((descriptor) => descriptor?.ok !== true);
    if (blockedDescriptor) {
      renderField.destroyRenderFieldBuffers?.({
        force: true,
        releaseLeases: true,
        reason: 'worker-isosurface-descriptor-blocked'
      });
      throw new Error(blockedDescriptor.reason || blockedDescriptor.status);
    }

    let surfaceDescriptorEntries;
    let collectiveSurfaceIndices;
    let participatingMediumDescriptor = null;
    let consumedCollectiveSurfaceIndices = new Set();
    let marchingCubesDescriptors;
    try {
      surfaceDescriptorEntries = Object.freeze(descriptors.map(
        (descriptor, surfaceIndex) => Object.freeze({
          descriptor,
          metadata: surfaceMetadataSnapshots[surfaceIndex]
        })
      ));
      collectiveSurfaceIndices = surfaceMetadataSnapshots
        .map((metadata, surfaceIndex) => (
          isCollectiveOpticalSurface(metadata) ? surfaceIndex : -1
        ))
        .filter((surfaceIndex) => surfaceIndex >= 0);
      if (collectiveSurfaceIndices.length > 0) {
        const collectiveSurfaceDescriptors = collectiveSurfaceIndices.map(
          (surfaceIndex) => surfaceDescriptorEntries[surfaceIndex]
        );
        participatingMediumDescriptor = createParticipatingMediumDescriptor({
          device,
          renderField,
          surfaceDescriptors: collectiveSurfaceDescriptors
        });
        const descriptorStatus = participatingMediumDescriptor?.status;
        if (![
          PARTICIPATING_MEDIUM_READY_STATUS,
          PARTICIPATING_MEDIUM_EMPTY_STATUS,
          PARTICIPATING_MEDIUM_BLOCKED_STATUS
        ].includes(descriptorStatus)) {
          throw new TypeError(
            'participating-medium descriptor returned an unknown route status'
          );
        }
        const consumedIndices =
          participatingMediumDescriptor.consumedSurfaceIndices;
        if (!Array.isArray(consumedIndices)) {
          throw new TypeError(
            'participating-medium descriptor omitted consumed surface indices'
          );
        }
        consumedCollectiveSurfaceIndices = new Set(consumedIndices);
        const expectedCollectiveSurfaceIndices = new Set(
          collectiveSurfaceIndices
        );
        const exactConsumption =
          consumedCollectiveSurfaceIndices.size
            === expectedCollectiveSurfaceIndices.size
          && [...consumedCollectiveSurfaceIndices].every((surfaceIndex) => (
            Number.isSafeInteger(surfaceIndex)
            && expectedCollectiveSurfaceIndices.has(surfaceIndex)
          ));
        if (!exactConsumption) {
          throw new TypeError(
            'participating-medium descriptor did not consume the exact collective optical route set'
          );
        }
      }
      marchingCubesDescriptors = descriptors.filter(
        (_descriptor, surfaceIndex) => (
          !consumedCollectiveSurfaceIndices.has(surfaceIndex)
        )
      );
    } catch (error) {
      renderField.destroyRenderFieldBuffers?.({
        force: true,
        releaseLeases: true,
        reason: 'worker-participating-medium-descriptor-failed'
      });
      throw error;
    }

    const encoder = device.createCommandEncoder({
      label: 'ulg-worker-owned-isosurface-marching-cubes'
    });
    const extracted = [];
    const translatedSurfaces = [];
    let participatingMediumPackedFrame = null;
    let ledgerParcelOpticsParams = null;
    let solidIsosurfaceParams = null;
    const activeSolidRigidFamily = job.solidRigidFamily ?? null;
    let solidRigidIsosurfaceSplatted = false;
    try {
      if (activeSolidRigidFamily) {
        solidIsosurfaceParams = encodeSchroederSolidIsosurfaceFieldSplatWebGpu({
          device,
          encoder,
          family: activeSolidRigidFamily,
          renderField
        });
        solidRigidIsosurfaceSplatted = Boolean(solidIsosurfaceParams);
      }
      for (const descriptor of marchingCubesDescriptors) {
        const entry = await adapterForDescriptor(descriptor);
        bindUlgWebGpuMarchingCubesVolumeSuccessorLineage({
          device,
          descriptor,
          volume: entry.volume
        });
        const wrapped = await entry.wrapper.extractSurface({
          volume: entry.volume,
          isovalue: descriptor.isovalue,
          ownsBuffer: true,
          readbackMode: CONSERVATIVE_NO_READBACK_MODE,
          vertexRowsBudget: Math.max(3, Math.floor(Number(job.request.vertexRowsBudget) || 3)),
          commandEncoder: encoder
        });
        const rawExecution = rawExtensionExecution(wrapped);
        if (rawExecution?.ok === false || !rawExecution?.result) {
          throw new Error(
            wrapped?.reason
            || rawExecution?.status
            || 'worker-owned marching-cubes extraction failed'
          );
        }
        const item = { descriptor, wrapped, rawExecution, temperatureRows: null };
        extracted.push(item);
        const result = rawExecution.result;
        const position = result.outputDescriptors?.rows?.position || result.rowMetadata?.position;
        const positionBuffer = position?.buffer || result.outputDescriptors?.retainedBuffers?.position || result.buffer;
        const counterBuffer = result.actualVertexCounterBuffer || result.vertexCounterBuffer;
        // Same encoder, exact extraction generations, and the still-retained
        // scalar field. The actual vertex prefix stays entirely GPU-owned.
        item.temperatureRows = encodeNativeSurfaceTemperatureRowsWebGpu({
          device, commandEncoder: encoder,
          compactPositions: {
            buffer: positionBuffer,
            byteLength: position?.bufferByteLength ?? result.bufferByteLength ?? positionBuffer?.size,
            rowCount: position?.rowCount ?? result.vertexCount,
            strideFloats: position?.rowStrideFloats ?? result.vertexStrideFloats,
            surfaceGenerationId: result.surfaceGenerationId,
            volumeGenerationId: result.volumeGenerationId
          },
          actualVertexCounter: {
            buffer: counterBuffer,
            byteLength: result.actualVertexCounterBufferByteLength ?? result.vertexCounterBufferByteLength ?? counterBuffer?.size
          },
          renderField: {
            buffer: descriptor.scalarBuffer, byteLength: descriptor.scalarBufferByteLength,
            dims: descriptor.dims, scalarStrides: descriptor.scalarStrides,
            scalarOffsetFloats: descriptor.scalarOffset, volumeGenerationId: result.volumeGenerationId
          },
          generation: { surfaceGenerationId: result.surfaceGenerationId, volumeGenerationId: result.volumeGenerationId }
        });
      }
      if (
        participatingMediumDescriptor?.status
          === PARTICIPATING_MEDIUM_READY_STATUS
      ) {
        ledgerParcelOpticsParams = encodeLedgerParcelOptics(
          job, encoder, renderField, participatingMediumDescriptor
        );
        participatingMediumPackedFrame = await encodeParticipatingMediumPack(
          ensureParticipatingMediumRuntime(),
          encoder,
          participatingMediumDescriptor
        );
        if (
          participatingMediumPackedFrame?.status
            !== SPH_PARTICIPATING_MEDIUM_PACKED_FRAME_STATUS
          || participatingMediumPackedFrame.readback !== false
        ) {
          throw new TypeError(
            'participating-medium pack did not return an exact GPU-resident no-readback frame'
          );
        }
      }
      device.queue.submit([encoder.finish()]);
      if (solidIsosurfaceParams) {
        const params = solidIsosurfaceParams;
        solidIsosurfaceParams = null;
        void deferSubmittedWorkCleanup(device, () => params.destroy());
      }
      if (ledgerParcelOpticsParams) {
        const params = ledgerParcelOpticsParams;
        ledgerParcelOpticsParams = null;
        void deferSubmittedWorkCleanup(device, () => params.destroy());
      }
      for (const item of extracted) {
        item.rawExecution.result?.retireTemporaryResourcesAfterSubmit?.();
      }

      const surfaces = [];
      for (const item of extracted) {
        const descriptor = item.descriptor;
        const metadata = surfaceMetadataSnapshots[descriptor.surfaceIndex];
        const translation = await buildWebGpuMarchingCubesExtensionSurfaceRowsWebGpu({
          device,
          extensionExecution: item.rawExecution,
          schroederSpatialSourceFamily: renderField.schroederSpatialSourceFamily,
          surfaceIndex: descriptor.surfaceIndex,
          materialId: metadata.materialId,
          phaseId: metadata.phaseId,
          opticalStateId: metadata.opticalStateId,
          material: metadata.material,
          phase: metadata.phase,
          renderKey: metadata.renderKey,
          surfaceKey: metadata.surfaceKey,
          isolation: descriptor.isovalue,
          transparencyClassId: metadata.transparencyClassId,
          depthWriteFlag: metadata.depthWriteFlag,
          renderOrder: metadata.renderOrder,
          positionTransform: descriptor.positionTransform,
          positionTransformResolution: metadata.resolution,
          sourceVoxelLinearIndex: descriptor.fieldOffset,
          fieldPadding: renderField.fieldPadding,
          refEdgeM: renderField.refEdgeM,
          positionGridBias: descriptor.positionTransformGridBias,
          fieldGradient: {
            buffer: descriptor.scalarBuffer,
            scalarOffsetFloats: descriptor.scalarOffset,
            rowStrideFloats: descriptor.cellRowStrideFloats,
            resolution: metadata.resolution
          },
          readbackMode: NO_FULL_READBACK_MODE,
          compactSummaryReadback: false,
          translateVertexRows: false,
          allowExtensionDrawIndirectBuffer: true,
          retainVertexRowsBuffer: true,
          retainDrawRowsBuffer: true,
          retainDrawIndirectRowsBuffer: true,
          waitForQueueCompletion: false
        });
        const uniformBuffer = device.createBuffer({
          label: `ulg-worker-owned-isosurface-uniform-${descriptor.surfaceIndex}`,
          size: WORKER_NATIVE_SURFACE_UNIFORM_BYTES,
          usage:
            gpuBufferUsage('UNIFORM', BUFFER_USAGE_UNIFORM)
            | gpuBufferUsage('COPY_DST', BUFFER_USAGE_COPY_DST)
        });
        const temperature = item.temperatureRows;
        translation.nativeSurfaceTemperatureRows = temperature;
        Object.assign(translation.surfaceDraw, {
          compactTemperatureRowsBuffer: temperature.temperatureRowsBuffer,
          compactTemperatureRowsBufferRetained: true,
          compactTemperatureRowsBufferByteLength: temperature.temperatureRowsBufferByteLength,
          compactTemperatureRowsBufferRowCount: temperature.temperatureRowsBufferRowCount,
          compactTemperatureRowsStrideFloats: temperature.temperatureRowsStrideFloats,
          compactTemperatureRowsSchema: temperature.temperatureRowsSchema,
          compactTemperatureRowsLayoutName: temperature.temperatureRowsLayoutName,
          compactTemperatureRowsEncoding: temperature.encoding,
          compactTemperatureRowsSemantic: temperature.semantic,
          compactTemperatureRowsSurfaceGenerationId: temperature.surfaceGenerationId,
          compactTemperatureRowsVolumeGenerationId: temperature.volumeGenerationId,
          compactTemperatureRowsCoverageSchema: temperature.coverage.schema,
          compactTemperatureRowsCoverageComplete: temperature.coverage.complete,
          compactTemperatureRowsCoverageRowCount: temperature.coverage.rowCount,
          compactTemperatureRowsOwnership: temperature.temperatureRowsOwnership,
          compactTemperatureRowsAdditionalSubmitCount: 0
        });
        surfaces.push({
          descriptor,
          metadata,
          translation,
          rawExecution: item.rawExecution,
          uniformBuffer,
          releaseTemperatureRows: () => retireTemperatureRows(temperature),
          bindGroups: new Map()
        });
        translatedSurfaces.push(surfaces[surfaces.length - 1]);
      }
      const motionField = renderField.takeMotionField?.() || null;
      renderField.destroyRenderFieldBuffers?.({
        force: true,
        releaseLeases: true,
        reason: 'worker-isosurface-extraction-submitted'
      });
      return {
        generation: job.generation,
        invalidationEpoch: job.invalidationEpoch,
        sphStep: job.sphStep,
        sourceTimeS: job.sourceTimeS,
        motionField,
        request: job.request,
        receiptFields: job.receiptFields,
        viewProjectionMatrix: [...job.admission.viewProjectionMatrix],
        cameraPositionM: [...job.admission.cameraPositionM],
        boxDimsM: finiteVector(job.request.boxDimsM, 3),
        totalSurfaceCount: surfaceMetadataSnapshots.length,
        opticalMetadataSnapshots: surfaceMetadataSnapshots,
        participatingMedium: participatingMediumDescriptor
          ? {
              status: participatingMediumDescriptor.status,
              reason: participatingMediumDescriptor.reason ?? null,
              collectiveSurfaceCount: collectiveSurfaceIndices.length,
              consumedSurfaceCount:
                consumedCollectiveSurfaceIndices.size,
              packedFrame: participatingMediumPackedFrame,
              released: false
            }
          : null,
        solidRigidFamily: activeSolidRigidFamily ?? null,
        solidRigidIsosurfaceSplatted,
        surfaces
      };
    } catch (error) {
      // Never submitted: nothing queued references the optics params.
      solidIsosurfaceParams?.destroy();
      ledgerParcelOpticsParams?.destroy();
      renderField.destroyRenderFieldBuffers?.({
        force: true,
        releaseLeases: true,
        reason: 'worker-isosurface-extraction-failed'
      });
      for (const surface of translatedSurfaces) {
        releaseExtensionFrameSurface(
          surface,
          'worker-isosurface-partial-translation-failed'
        );
      }
      const translatedExecutions = new Set(
        translatedSurfaces.map((surface) => surface.rawExecution)
      );
      for (const item of extracted) {
        if (translatedExecutions.has(item.rawExecution)) continue;
        if (item.temperatureRows) {
          retireTemperatureRows(item.temperatureRows);
        }
        try {
          item.rawExecution?.result?.release?.();
        } catch {
          // Preserve the originating error.
        }
      }
      if (participatingMediumPackedFrame) {
        try {
          destroyParticipatingMediumPackedFrame(
            participatingMediumPackedFrame
          );
        } catch {
          // Preserve the originating error.
        }
      }
      throw error;
    }
  };

  const admitCommittedFrame = (frame, sourceTimingBootstrap, reason, proof) => {
    const previousFrame = currentFrame;
    currentFrame = frame;
    currentFrame.sourcePresentedAtMs = temporalNowMs();
    currentFrame.sourcePresentationPausedWallMs = presentationPauseClock.pausedAt(currentFrame.sourcePresentedAtMs);
    const previousPausedWallMs = previousFrame
      ? previousFrame.sourcePresentationPausedWallMs : frame.sourceTimingPausedWallMs;
    currentFrame.motionPacing = createIsosurfaceMotionPacing(
      currentFrame, previousFrame, currentFrame.sourcePresentedAtMs,
      sourceTimingBootstrap,
      { pausedWallDeltaMs: previousPausedWallMs == null ? NaN
        : currentFrame.sourcePresentationPausedWallMs - previousPausedWallMs }
    );
    startTemporalPresentation(currentFrame);
    if (previousFrame) {
      deferSubmittedWorkCleanup(device, () => {
        releaseFrame(previousFrame, 'worker-isosurface-replaced');
      });
    }
    publishRenderedTerminal(currentFrame, reason, proof);
  };

  const processJobs = async () => {
    if (running || disposed) return;
    running = true;
    try {
      while (latestJob && !disposed) {
        const job = latestJob;
        latestJob = null;
        activeJob = job;
        let captured = null;
        let frame = null;
        try {
          captured = await job.capturePromise;
          if (job.invalidationEpoch !== invalidationEpoch || disposed) {
            terminal(
              job,
              ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_SUPERSEDED_STATUS,
              { reason: 'the worker-owned isosurface presentation was invalidated' }
            );
            continue;
          }
          frame = await (buildPresentationFrame ?? buildFrame)(job, captured);
          frame.request = job.request;
          frame.sourceTimeS = job.sourceTimeS;
          frame.sourceTimingPausedWallMs = job.sourceTimingPausedWallMs;
          if (job.invalidationEpoch !== invalidationEpoch || disposed) {
            const resizeRebaseAllowed = Boolean(
              !disposed
              && job.invalidationEpoch !== invalidationEpoch
              && generation === job.generation
              && resizeRetryInvalidationEpoch === invalidationEpoch
            );
            if (resizeRebaseAllowed) {
              // A framebuffer-only resize does not invalidate the captured
              // physics source. Rebase the completed replacement frame so a
              // resize that lands during field/mesh construction cannot
              // leave the cleared canvas blank until the next schedule.
              job.invalidationEpoch = invalidationEpoch;
              frame.invalidationEpoch = invalidationEpoch;
            } else {
              releaseFrame(
                frame,
                'worker-isosurface-superseded-before-presentation'
              );
              frame = null;
              terminal(
                job,
                ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_SUPERSEDED_STATUS,
                { reason: 'the worker-owned isosurface presentation was invalidated' }
              );
              continue;
            }
          }
          if (
            currentFrame
            && currentFrame.generation >= frame.generation
          ) {
            releaseFrame(frame, 'worker-isosurface-older-than-visible-frame');
            frame = null;
            terminal(
              job,
              ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_SUPERSEDED_STATUS,
              { reason: 'a newer isosurface generation is already visible' }
            );
            continue;
          }
          // Retry only the exact post-GPU callback timeout, once per immutable
          // committed job (including its resize rebases). The failed wait has
          // already paced this retry. It produced no proof, but its GPU serial
          // and submitted-generation high-water mark must remain consumed:
          // retaining the old admission does not imply its pixels stayed up.
          let opportunityRetryUsed = false;
          const retryJobIsCurrent = () => !disposed
            && activeJob === job && generation === job.generation;
          const drawCommittedFrame = async (reason) => {
            for (;;) {
              try {
                return await onRenderLane(() => {
                  if (opportunityRetryUsed && !retryJobIsCurrent()) return false;
                  return renderFrame(frame, {
                    reason,
                    allowLaggedGeneration: !opportunityRetryUsed
                  });
                });
              } catch (error) {
                if (!(error instanceof PresentationOpportunityTimeoutError)) throw error;
                // A cancellation is supersession even if it coincides with
                // the final allowed wait. Never resurrect it via a resize.
                if (!retryJobIsCurrent()) return false;
                if (opportunityRetryUsed) throw error;
                opportunityRetryUsed = true;
              }
            }
          };
          let presentationProof = await drawCommittedFrame('committed-worker-isosurface');
          while (
            !presentationProof?.presentationFrameAdmitted
            && frame.invalidationEpoch !== invalidationEpoch
            // clear/dispose advance the generation. A later resize marker
            // must never authorize a pre-clear frame to inherit the newest
            // page-owned framebuffer epoch.
            && generation === job.generation
            && resizeRetryInvalidationEpoch === invalidationEpoch
            // Every retry must consume a strictly newer framebuffer epoch.
            // This admits any finite resize storm without a spin: each
            // attempt awaits its GPU/presentation proof, while clear,
            // dispose, or a newer committed generation terminates the loop.
            && invalidationEpoch > frame.invalidationEpoch
            && !disposed
          ) {
            const nextInvalidationEpoch = invalidationEpoch;
            job.invalidationEpoch = nextInvalidationEpoch;
            frame.invalidationEpoch = nextInvalidationEpoch;
            presentationProof = await drawCommittedFrame('committed-worker-isosurface-after-resize');
          }
          if (!presentationProof?.presentationFrameAdmitted) {
            if (frame.invalidationEpoch !== invalidationEpoch || disposed
              || generation !== job.generation) {
              releaseFrame(
                frame,
                'worker-isosurface-invalidated-during-presentation'
              );
              frame = null;
              terminal(
                job,
                ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_SUPERSEDED_STATUS,
                {
                  reason:
                    'the worker-owned isosurface presentation was invalidated during submit'
                }
              );
              continue;
            }
            throw new Error('worker-owned isosurface frame was not current at submit');
          }
          admitCommittedFrame(
            frame, job.sourceTimingBootstrap,
            'same-device retained state rendered as true isosurface',
            presentationProof
          );
          frame = null;
        } catch (error) {
          if (error instanceof PresentationOpportunityTimeoutError
            && frame && !disposed
            && frame.generation === generation
            && frame.generation === mostRecentSubmittedGeneration
            && frame.invalidationEpoch === invalidationEpoch) {
            // Both automatic attempts are spent. Keep just this immutable
            // source's owned presentation resources, never its physics job.
            // No timer/proof is created; only a later explicit input can try
            // a new draw. Inputs already queued during those waits cannot
            // turn the failed job into an automatic third attempt.
            retireRecoveryCandidate('worker-isosurface-recovery-replaced');
            recoveryCandidate = Object.freeze({
              frame,
              sourceTimingBootstrap: job.sourceTimingBootstrap,
              parkedAfterRedrawSequence: redrawRequestSequence
            });
            frame = null;
          }
          if (frame) releaseFrame(frame, 'worker-isosurface-build-failed');
          terminal(
            job,
            ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_FAILED_STATUS,
            {
              reason: error instanceof Error ? error.message : String(error),
              ...compactError(error)
            }
          );
        } finally {
          if (captured && !job.capturedReleased) {
            releaseCapturedRows(captured, 'worker-isosurface-capture-retired');
          }
          releaseProductEventSourceBorrow(job);
          releaseDispersedMediumSourceBorrow(job);
          releaseLedgerParcelsBorrow(job);
          activeJob = null;
        }
      }
    } finally {
      running = false;
    }
  };

  const scheduleProcessJobs = () => {
    if (pumpPromise || disposed) return;
    const scheduled = processJobs();
    pumpPromise = scheduled;
    void scheduled.finally(() => {
      if (pumpPromise === scheduled) pumpPromise = null;
      if (latestJob && !disposed) scheduleProcessJobs();
    });
  };

  const retireQueuedJob = (job, reason) => {
    if (!job) return;
    releaseProductEventSourceBorrow(job);
    releaseDispersedMediumSourceBorrow(job);
    releaseLedgerParcelsBorrow(job);
    void job.capturePromise.then((captured) => {
      releaseCapturedRows(captured, 'worker-isosurface-queued-job-superseded');
    }).catch(() => {});
    terminal(
      job,
      ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_SUPERSEDED_STATUS,
      { reason }
    );
  };

  const retirePendingRedraw = () => {
    if (!pendingRedraw) return;
    pendingRedraw.resolve(false);
    pendingRedraw = null;
  };

  const wakeCaptureQuiescenceWaiters = () => {
    for (const resolve of captureQuiescenceWaiters) resolve();
    captureQuiescenceWaiters.clear();
  };

  const finishCapture = () => {
    captureInFlightCount = Math.max(0, captureInFlightCount - 1);
    if (captureInFlightCount === 0) wakeCaptureQuiescenceWaiters();
  };

  const waitForCaptureQuiescence = () => {
    if (captureInFlightCount === 0) return Promise.resolve();
    return new Promise((resolve) => captureQuiescenceWaiters.add(resolve));
  };

  const pumpRedraws = async () => {
    while (pendingRedraw && !disposed) {
      const recovery = pendingRedraw.allowCandidateRecovery
        && pendingRedraw.requestSequence > (recoveryCandidate?.parkedAfterRedrawSequence ?? Infinity)
        && recoveryCandidate?.frame.generation === generation
        && recoveryCandidate.frame.generation === mostRecentSubmittedGeneration
        && recoveryCandidate.frame.invalidationEpoch === invalidationEpoch
        ? recoveryCandidate : null;
      const visibleFrameReady = recovery || currentFrame
        && currentFrame.invalidationEpoch === invalidationEpoch
        && currentFrame.generation >= mostRecentSubmittedGeneration;
      if (!visibleFrameReady) {
        // Wait only when no admitted frame can be drawn. A replacement that
        // already submitted owns the render lane; never repaint its old mesh.
        if (pumpPromise) {
          await pumpPromise.catch(() => {});
          continue;
        }
        if (captureInFlightCount > 0) {
          await waitForCaptureQuiescence();
          continue;
        }
      }
      const redraw = pendingRedraw;
      pendingRedraw = null;
      const redrawFrame = recovery?.frame || currentFrame;
      if (
        !visibleFrameReady
      ) {
        redraw.resolve(false);
        continue;
      }
      try {
        const presentationProof = await scheduleRenderFrame(redrawFrame, {
          ...redraw.options,
          allowLaggedGeneration: !recovery,
          requiresVisibleFrame: !recovery,
          requiresRecoverableFrame: Boolean(recovery)
        });
        if (recovery && presentationProof && recoveryCandidate === recovery
          && redrawFrame.generation === generation
          && redrawFrame.invalidationEpoch === invalidationEpoch && !disposed) {
          recoveryCandidate = null;
          admitCommittedFrame(redrawFrame, recovery.sourceTimingBootstrap,
            redraw.options.reason, presentationProof);
          redraw.resolve(true);
          continue;
        }
        const redrawFrameStillVisible = Boolean(
          !recovery
          &&
          presentationProof
          && currentFrame === redrawFrame
          && redrawFrame.invalidationEpoch === invalidationEpoch
          && redrawFrame.generation >= mostRecentSubmittedGeneration
          && !disposed
        );
        if (redrawFrameStillVisible) {
          publishRenderedTerminal(
            redrawFrame,
            redraw.options.reason,
            presentationProof
          );
        } else if (!disposed && !pendingRedraw
          && (activeJob || latestJob || captureInFlightCount > 0)) {
          // A replacement may have won the lane after this redraw was queued.
          // Carry the request once through that replacement instead of losing
          // the camera update or publishing the retired frame.
          pendingRedraw = redraw;
          continue;
        }
        redraw.resolve(redrawFrameStillVisible);
      } catch (error) {
        if (recovery && recoveryCandidate?.frame.generation === recovery.frame.generation
          && !(error instanceof PresentationOpportunityTimeoutError)) {
          retireRecoveryCandidate('worker-isosurface-recovery-failed');
        }
        redraw.reject(error);
      }
    }
  };

  const ensureRedrawPump = () => {
    if (redrawPumpPromise || disposed || !pendingRedraw) return;
    const scheduled = pumpRedraws();
    redrawPumpPromise = scheduled;
    void scheduled.finally(() => {
      if (redrawPumpPromise === scheduled) redrawPumpPromise = null;
      ensureRedrawPump();
    });
  };

  const scheduleRedraw = (options, { allowCandidateRecovery = false } = {}) => {
    if (disposed) return Promise.resolve(false);
    const requestSequence = ++redrawRequestSequence;
    const viewProjection = finiteVector(options?.viewProjectionMatrix, 16);
    const cameraPosition = finiteVector(options?.cameraPositionM, 3);
    if (viewProjection) latestViewProjectionMatrix = [...viewProjection];
    if (cameraPosition) latestCameraPositionM = [...cameraPosition];
    if (options?.nativeSurfaceAppearance != null) {
      latestNativeSurfaceAppearance = structuredClone(options.nativeSurfaceAppearance);
    }
    if (
      disposed
      || (
        !currentFrame
        && !recoveryCandidate
        && captureInFlightCount === 0
        && !activeJob
        && !latestJob
      )
    ) return Promise.resolve(false);
    let resolveRedraw;
    let rejectRedraw;
    const result = new Promise((resolve, reject) => {
      resolveRedraw = resolve;
      rejectRedraw = reject;
    });
    retirePendingRedraw();
    pendingRedraw = {
      options,
      allowCandidateRecovery,
      requestSequence,
      resolve: resolveRedraw,
      reject: rejectRedraw
    };
    ensureRedrawPump();
    return result;
  };

  return Object.freeze({
    async enqueue({
      request,
      retained,
      sphStep = null,
      receiptFields = {},
      sourceTimingBootstrap = null
    } = {}) {
      if (disposed) {
        return presentationReceiptBase({
          status: ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_FAILED_STATUS,
          reason: 'worker-owned isosurface presenter is disposed',
          ...receiptFields
        });
      }
      const admission = resolveWorkerOwnedIsosurfaceAdmission({ request, retained });
      if (!admission.ok) {
        return presentationReceiptBase({
          status: ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_FAILED_STATUS,
          reason: admission.reason,
          admission,
          ...receiptFields
        });
      }
      // Cold material records belong to this source admission, not the mutable
      // caller request or a later camera/appearance update.
      request = { ...request, nativeSurfaceMaterial: admission.nativeSurfaceMaterial };
      generation += 1;
      retireRecoveryCandidate('worker-isosurface-recovery-superseded');
      const jobGeneration = generation;
      const retainedTime = retained.sphParticleUpload?.time;
      const sourceTimeS = typeof retainedTime === 'number' && Number.isFinite(retainedTime)
        ? retainedTime : null;
      sourceTimingBootstrap = snapshotIsosurfaceSourceTimingBootstrap(sourceTimingBootstrap);
      const sourceTimingPausedWallMs = sourceTimingBootstrap
        ? presentationPauseClock.pausedAt(sourceTimingBootstrap.sourceObservedAtMs) : null;
      const captureInvalidationEpoch = invalidationEpoch;
      let productEvents;
      let releaseProductEventBorrow = null;
      let releaseDispersedMediumBorrow = null;
      let dispersedMediumOptics = null;
      try {
        const dispersedMediumBorrow =
          beginWorkerOwnedIsosurfaceDispersedMediumBorrow(
            device,
            retained.sphParticleUpload
          );
        dispersedMediumOptics = dispersedMediumBorrow?.sidecar ?? null;
        releaseDispersedMediumBorrow = dispersedMediumBorrow?.release ?? null;
        productEvents = resolveWorkerOwnedIsosurfaceProductEventSource({
          device,
          retained
        });
        releaseProductEventBorrow =
          beginWorkerOwnedIsosurfaceProductEventSourceBorrow(
            productEvents.productEventSource
          );
      } catch (error) {
        releaseDispersedMediumBorrow?.();
        releaseProductEventBorrow?.();
        return presentationReceiptBase({
          status: ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_FAILED_STATUS,
          reason: error instanceof Error ? error.message : String(error),
          requestGeneration: jobGeneration,
          sourceCapturedBeforePhysicsContinuation: false,
          admission,
          ...receiptFields,
          ...compactError(error),
          updatedAtMs: nowMs()
        });
      }
      let captured;
      captureInFlightCount += 1;
      try {
        captured = await captureRenderRows({
          device,
          sphParticleState: retained.sphParticleState,
          mlsMpmParticleState: retained.mlsMpmParticleState,
          sphParticleUpload: retained.sphParticleUpload,
          mlsMpmParticleUpload: retained.mlsMpmParticleUpload,
          sourceStateBuffer: retained.sourceStateBuffer,
          sourceThermoBuffer: retained.sourceThermoBuffer,
          sourceIdentityBuffer: retained.sourceIdentityBuffer,
          sourceMechanicsBuffer: retained.sourceMechanicsBuffer,
          schroederSpatialSourceFamily: retained.successorSourceFamily,
          retainRenderRowsBuffer: true,
          readbackMode: NO_FULL_READBACK_MODE
        });
      } catch (error) {
        finishCapture();
        releaseProductEventBorrow?.();
        releaseDispersedMediumBorrow?.();
        return presentationReceiptBase({
          status: ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_FAILED_STATUS,
          reason: error instanceof Error ? error.message : String(error),
          requestGeneration: jobGeneration,
          sourceCapturedBeforePhysicsContinuation: false,
          admission,
          ...receiptFields,
          ...compactError(error),
          updatedAtMs: nowMs()
        });
      }
      finishCapture();
      if (
        (captured?.dispersedMediumOptics ?? null)
        !== dispersedMediumOptics
      ) {
        releaseProductEventBorrow?.();
        releaseDispersedMediumBorrow?.();
        releaseCapturedRows(
          captured,
          'worker-isosurface-dispersed-medium-capture-mismatch'
        );
        return presentationReceiptBase({
          status: ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_FAILED_STATUS,
          reason:
            'worker-owned isosurface capture did not retain its exact dispersed-medium sidecar',
          requestGeneration: jobGeneration,
          sourceCapturedBeforePhysicsContinuation: true,
          admission,
          ...receiptFields,
          updatedAtMs: nowMs()
        });
      }
      const captureInvalidated = Boolean(
        disposed
        || captureInvalidationEpoch !== invalidationEpoch
      );
      // A resize invalidates only framebuffer geometry, not the captured
      // retained physics state, so that capture may be rendered once against
      // the newest size. A clear/dispose intentionally retires content and
      // must never let a pre-clear capture inherit the new framebuffer epoch.
      const resizeRetryAllowed = Boolean(
        !disposed
        && captureInvalidated
        // resize preserves the request generation; clear/dispose advances it.
        // A later resize must never resurrect a capture that crossed a clear.
        && generation === jobGeneration
        && resizeRetryInvalidationEpoch === invalidationEpoch
      );
      if (captureInvalidated && !resizeRetryAllowed) {
        releaseProductEventBorrow?.();
        releaseDispersedMediumBorrow?.();
        releaseCapturedRows(
          captured,
          'worker-isosurface-capture-invalidated-before-enqueue'
        );
        return presentationReceiptBase({
          status:
            ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_SUPERSEDED_STATUS,
          reason:
            'worker-owned isosurface source capture was invalidated before enqueue',
          requestGeneration: jobGeneration,
          sourceCapturedBeforePhysicsContinuation: true,
          admission,
          ...receiptFields,
          updatedAtMs: nowMs()
        });
      }
      const job = {
        sourceTimeS,
        sourceTimingBootstrap,
        sourceTimingPausedWallMs,
        generation: jobGeneration,
        request,
        retained,
        admission,
        sphStep,
        receiptFields,
        productEvents,
        dispersedMediumOptics,
        // Borrowed after admission: every earlier return path ends before it.
        ledgerParcelsBorrow: beginSphGpuParticleUploadLedgerParcelsBorrow(retained.sphParticleUpload),
        // G3 coherent rigid bodies: splatted into the marching-cubes solid
        // isosurface field (with fallback to their resident frame buffer).
        solidRigidFamily:
          schroederSolidRigidFamilyForUpload(retained.sphParticleUpload)
          ?? (retained.sphParticleState?.rigidBodies
            ? ensureSchroederSolidRigidFamilyForUpload(
                retained.sphParticleUpload,
                retained.sphParticleState.rigidBodies,
                device
              )
            : null),
        releaseProductEventSourceBorrow: releaseProductEventBorrow,
        productEventSourceBorrowReleased: false,
        releaseDispersedMediumSourceBorrow: releaseDispersedMediumBorrow,
        dispersedMediumSourceBorrowReleased: false,
        capturePromise: Promise.resolve(captured),
        invalidationEpoch: resizeRetryAllowed
          ? invalidationEpoch
          : captureInvalidationEpoch,
        capturedReleased: false
      };
      if (latestJob) {
        retireQueuedJob(
          latestJob,
          'a newer committed isosurface request replaced this queued request'
        );
      }
      latestJob = job;
      scheduleProcessJobs();
      return presentationReceiptBase({
        status: ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_ENQUEUED_STATUS,
        reason: 'exact committed retained source capture submitted before continuation',
        requestGeneration: jobGeneration,
        sourceCapturedBeforePhysicsContinuation: true,
        surfaceCount: admission.surfaceCount,
        totalFieldCells: admission.totalFieldCells,
        particleCount: admission.particleCount,
        readbackMode: NO_FULL_READBACK_MODE,
        ...receiptFields,
        updatedAtMs: nowMs()
      });
    },
    setPresentationPlaying(value) {
      if (typeof value !== 'boolean') throw new TypeError('presentation playing must be a boolean');
      if (disposed || value === presentationPlaying) return false;
      const atMs = temporalNowMs();
      presentationPauseClock.setPlaying(value, atMs);
      presentationPlaying = value;
      presentationPlaybackRevision += 1;
      presentationMotionController.abort();
      presentationMotionController = new AbortController();
      stopTemporalPresentation();
      if (value) {
        if (currentFrame?.motionPacing) {
          currentFrame.motionPacing = resumeIsosurfaceMotionPacing(
            currentFrame.motionPacing, atMs, currentFrame.lastDisplayedMotionAgeS || 0);
          startTemporalPresentation(currentFrame);
        }
      } else if (currentFrame && currentFrame.lastSubmittedMotionAgeS
        > (currentFrame.lastDisplayedMotionAgeS || 0)) {
        // Revoking a pending proof cannot undo its submitted pixels. Repaint
        // the admitted age after that lane drains, without admitting a parked
        // source or granting another committed callback-timeout attempt.
        void scheduleRedraw({ reason: 'worker-isosurface-pause-frozen-redraw',
          playbackRevision: presentationPlaybackRevision }).catch(() => {});
      }
      return true;
    },
    async redraw({
      viewProjectionMatrix = null,
      cameraPositionM = null,
      nativeSurfaceAppearance = null,
      reason = 'worker-owned-isosurface-camera-redraw'
    } = {}) {
      return scheduleRedraw({
        viewProjectionMatrix,
        cameraPositionM,
        nativeSurfaceAppearance,
        reason
      }, { allowCandidateRecovery: true });
    },
    beginPendingSourceProgress({ scheduleId, laneId, stateKey, presentationLaneEpoch,
      sourceTimeS, totalStepCount } = {}) {
      const token = ++pendingSourceProgressToken;
      const epoch = invalidationEpoch;
      const startedAtMs = temporalNowMs();
      const startedPausedWallMs = presentationPauseClock.pausedAt(startedAtMs);
      if (disposed
        || typeof scheduleId !== 'string' || !scheduleId.trim()
        || typeof laneId !== 'string' || !laneId.trim()
        || typeof stateKey !== 'string' || !stateKey.trim()
        || !Number.isSafeInteger(presentationLaneEpoch) || presentationLaneEpoch <= 0
        || typeof sourceTimeS !== 'number' || !Number.isFinite(sourceTimeS) || sourceTimeS < 0
        || !Number.isSafeInteger(totalStepCount) || totalStepCount <= 1
        || !Number.isFinite(startedAtMs) || startedAtMs < 0) return null;
      let frame = null;
      let lastStep = 0;
      let lastObservedAtMs = startedAtMs;
      let closed = false;
      return (progress) => {
        if (closed || disposed || !presentationPlaying
          || token !== pendingSourceProgressToken || epoch !== invalidationEpoch
          || (frame && currentFrame !== frame)
          || progress?.scheduleId !== scheduleId) return false;
        const step = progress.stepOrdinal;
        const atMs = temporalNowMs();
        if (!Number.isSafeInteger(step) || step <= lastStep || step > totalStepCount
          || progress.completedStepCount !== step
          || !Number.isFinite(atMs) || atMs < lastObservedAtMs) return false;
        lastStep = step;
        lastObservedAtMs = atMs;
        if (step === totalStepCount) { closed = true; return false; }
        // Physics may resume once source capture is safe, before the new mesh
        // reaches the screen. Bind lazily to that exact source, never to the
        // predecessor still visible when the schedule began.
        if (!frame) {
          const candidate = currentFrame;
          if (!candidate?.motionField?.buffer || !candidate.motionPacing
            || candidate.invalidationEpoch !== epoch
            || candidate.sourceTimeS !== sourceTimeS
            || candidate.receiptFields?.laneId !== laneId
            || candidate.receiptFields?.stateKey !== stateKey
            || candidate.receiptFields?.presentationLaneEpoch !== presentationLaneEpoch) return false;
          frame = candidate;
        }
        const activeWallMs = atMs - startedAtMs
          - (presentationPauseClock.pausedAt(atMs) - startedPausedWallMs);
        const remainingWallS = activeWallMs / 1000 * (totalStepCount - step) / step;
        const pacing = slowIsosurfaceMotionPacing(frame.motionPacing, atMs,
          remainingWallS, frame.lastDisplayedMotionAgeS || 0);
        if (pacing === frame.motionPacing) return false;
        frame.motionPacing = pacing;
        // No draw, restart, GPU read, or proof publication here. The existing
        // autonomous and boundary paths sample the new monotonic segment.
        return true;
      };
    },
    hasSubmissionBoundaryOpportunity() {
      const frame = currentFrame;
      if (disposed || !presentationPlaying || !frame?.motionField?.buffer || !frame.motionPacing
        || frame.invalidationEpoch !== invalidationEpoch) return false;
      return isosurfaceMotionAge(frame.motionPacing, temporalNowMs())
        > (frame.lastDisplayedMotionAgeS || 0);
    },
    hasRetainedSubmissionGapOpportunity,
    presentRetainedSubmissionGap({ signal = null, waitForPendingSlot = false } = {}) {
      if (signal?.aborted || !hasRetainedSubmissionGapOpportunity({ waitForPendingSlot })) {
        return Promise.resolve(false);
      }
      const frame = currentFrame;
      const requestEpoch = invalidationEpoch;
      const expectedFramebufferEpoch = Number(getFramebufferEpoch());
      if (!Number.isSafeInteger(expectedFramebufferEpoch) || expectedFramebufferEpoch <= 0) {
        return Promise.resolve(false);
      }
      // One entry deadline includes a prospective slot wait, render-lane wait,
      // appearance preparation and encoding. Slot release never renews it.
      const submissionDeadlineMs = temporalNowMs() + 1000 / 60;
      const predecessor = retainedSubmissionGap;
      const controller = new AbortController();
      const motionSignal = AbortSignal.any([
        controller.signal, presentationMotionController.signal,
        ...(signal ? [signal] : [])
      ]);
      const playbackRevision = presentationPlaybackRevision;
      let acknowledge;
      let acknowledged = false;
      const queued = new Promise(resolve => { acknowledge = resolve; });
      let resolveAborted;
      const aborted = new Promise(resolve => { resolveAborted = resolve; });
      let resolveCompleted;
      const gap = { abort: () => controller.abort(),
        completed: new Promise(resolve => { resolveCompleted = resolve; }) };
      let timer = null;
      const settle = value => {
        if (acknowledged) return;
        acknowledged = true;
        globalThis.clearTimeout(timer);
        acknowledge(value);
      };
      const onAbort = () => {
        settle(false);
        resolveAborted(false);
      };
      motionSignal.addEventListener('abort', onAbort, { once: true });
      const finish = succeeded => {
        settle(false);
        motionSignal.removeEventListener('abort', onAbort);
        if (retainedSubmissionGap === gap) retainedSubmissionGap = null;
        if (retainedSubmissionGapWaiter === gap) retainedSubmissionGapWaiter = null;
        // Separate from the early ack: only a drained, successful full proof
        // allows a prospective waiter to claim the now-vacant slot.
        resolveCompleted(succeeded === true && !motionSignal.aborted);
      };
      const requestIsCurrent = () => !motionSignal.aborted && !disposed
        && presentationPlaying && playbackRevision === presentationPlaybackRevision
        && invalidationEpoch === requestEpoch && currentFrame === frame
        && frame.invalidationEpoch === requestEpoch
        && Number(getFramebufferEpoch()) === expectedFramebufferEpoch
        && temporalNowMs() <= submissionDeadlineMs;
      // Waiting for an older render or a cold appearance must not hold up
      // physics indefinitely. Abort revokes a late submit; a successful ack
      // cancels only this timer, never the still-pending presentation proof.
      timer = globalThis.setTimeout(() => controller.abort(), 1000 / 60);
      const claimAndRender = () => {
        try {
          if (!requestIsCurrent() || retainedSubmissionGap
            || !retainedSubmissionGapEligible(frame)) {
            finish(false);
            return;
          }
          // Atomically exchange the single prospective waiter for the single
          // active slot, then join the existing FIFO lane without another await.
          if (retainedSubmissionGapWaiter === gap) retainedSubmissionGapWaiter = null;
          retainedSubmissionGap = gap;
          void onRenderLane(async () => {
            if (!requestIsCurrent() || !retainedSubmissionGapEligible(frame)) return false;
            const ageS = isosurfaceMotionAge(frame.motionPacing, temporalNowMs());
            const proof = await renderFrame(frame, {
              reason: 'worker-owned-isosurface-retained-submission-gap',
              allowLaggedGeneration: true, requiresVisibleFrame: true,
              playbackRevision, motionOnly: true, signal: motionSignal,
              motionAgeS: ageS, submissionDeadlineMs, expectedFramebufferEpoch,
              onSubmissionQueued: () => settle(true)
            });
            if (proof) publishRenderedTerminal(frame,
              'presentation-only retained mesh between physics submissions', proof);
            return proof;
          }).then(proof => finish(Boolean(proof)), () => finish(false));
        } catch {
          // Provider rechecks may throw before the lane owns this request,
          // including after an older proof releases the prospective waiter.
          finish(false);
        }
      };
      if (predecessor) {
        retainedSubmissionGapWaiter = gap;
        // Never occupy the render lane while waiting for its predecessor.
        // Timeout/cancellation affects only this request, not the older proof.
        void Promise.race([predecessor.completed, aborted]).then(succeeded => {
          if (succeeded === true) claimAndRender();
          else finish(false);
        }, () => finish(false));
      } else claimAndRender();
      return queued;
    },
    presentSubmissionBoundary(boundary, { signal = null } = {}) {
      if (signal?.aborted || disposed || !presentationPlaying || !boundary
        || !['submissionOrdinal', 'completedSubstepCount', 'totalSubstepCount', 'chunkStepCount']
          .every(key => Number.isSafeInteger(boundary[key]) && boundary[key] > 0)
        || boundary.completedSubstepCount >= boundary.totalSubstepCount
        || boundary.chunkStepCount > boundary.completedSubstepCount) return Promise.resolve(false);
      const submissionBoundary = Object.freeze({ ...boundary });
      const playbackRevision = presentationPlaybackRevision;
      const motionSignal = signal
        ? AbortSignal.any([signal, presentationMotionController.signal])
        : presentationMotionController.signal;
      return onRenderLane(async () => {
        if (motionSignal.aborted || playbackRevision !== presentationPlaybackRevision) return false;
        const frame = currentFrame;
        if (!frame?.motionField?.buffer || !frame.motionPacing) return false;
        // Select source and age on the lane, not when the callback was queued:
        // the autonomous loop or a replacement may have progressed meanwhile.
        const ageS = isosurfaceMotionAge(frame.motionPacing, temporalNowMs());
        if (!(ageS > (frame.lastDisplayedMotionAgeS || 0))) return false;
        const proof = await renderFrame(frame, {
          reason: 'worker-owned-isosurface-submission-boundary',
          allowLaggedGeneration: true, requiresVisibleFrame: true,
          motionAgeS: ageS, submissionBoundary, signal: motionSignal,
          playbackRevision, motionOnly: true
        });
        if (!proof) return false;
        publishRenderedTerminal(frame, 'presentation-only retained mesh at submission boundary', proof);
        return proof;
      });
    },
    async resize({
      viewProjectionMatrix = null,
      cameraPositionM = null,
      reason = 'worker-owned-isosurface-presentation-resize'
    } = {}) {
      if (disposed) return false;
      retireRetainedSubmissionGap();
      stopTemporalPresentation();
      const previousInvalidationEpoch = invalidationEpoch;
      invalidationEpoch += 1;
      resizeRetryInvalidationEpoch = invalidationEpoch;
      if (recoveryCandidate) {
        const candidate = recoveryCandidate;
        const invalidatedFrame = candidate.frame;
        if (invalidatedFrame.generation === generation
          && invalidatedFrame.invalidationEpoch === previousInvalidationEpoch) {
          // A later framebuffer resize preserves this source, not its failed
          // proof. Move ownership exactly once and require a new epoch/fence.
          const rebasedFrame = { ...invalidatedFrame, invalidationEpoch };
          recoveryCandidate = Object.freeze({ ...candidate, frame: rebasedFrame });
          // Keep the logical rebase synchronous (including input ordering),
          // but move resources after any old-wrapper prepare/submit finishes.
          // Each resize queues its transfer before the corresponding redraw.
          void onRenderLane(() => {
            nativeMaterial?.transferFrame(invalidatedFrame, rebasedFrame);
            invalidatedFrame.surfaces = [];
            invalidatedFrame.participatingMedium = null;
            invalidatedFrame.motionField = null;
          }).catch(() => {
            if (recoveryCandidate?.frame.generation === rebasedFrame.generation) {
              retireRecoveryCandidate('worker-isosurface-recovery-resize-transfer-failed');
            }
          });
        } else {
          retireRecoveryCandidate('worker-isosurface-recovery-resize-invalidated');
        }
      }
      const replacementPending = Boolean(
        captureInFlightCount > 0
        || activeJob
        || latestJob
        || recoveryCandidate
      );
      if (currentFrame && !replacementPending) {
        const invalidatedFrame = currentFrame;
        currentFrame = {
          ...invalidatedFrame,
          invalidationEpoch,
          surfaces: invalidatedFrame.surfaces
        };
        nativeMaterial?.transferFrame(invalidatedFrame, currentFrame);
        invalidatedFrame.surfaces = [];
        invalidatedFrame.participatingMedium = null;
        invalidatedFrame.motionField = null;
      }
      const redrawn = await scheduleRedraw({
        viewProjectionMatrix,
        cameraPositionM,
        reason
      }, { allowCandidateRecovery: true });
      if (redrawn) startTemporalPresentation(currentFrame);
      return redrawn;
    },
    clear({ reason = 'worker-owned-isosurface-presentation-clear' } = {}) {
      if (disposed) return false;
      retireRetainedSubmissionGap();
      stopTemporalPresentation();
      invalidationEpoch += 1;
      resizeRetryInvalidationEpoch = null;
      generation += 1;
      retireRecoveryCandidate(reason);
      latestViewProjectionMatrix = null;
      latestCameraPositionM = null;
      latestNativeSurfaceAppearance = null;
      retirePendingRedraw();
      retireQueuedJob(latestJob, reason);
      latestJob = null;
      const previousFrame = currentFrame;
      currentFrame = null;
      if (previousFrame) {
        deferSubmittedWorkCleanup(device, () => {
          releaseFrame(previousFrame, reason);
        });
      }
      return true;
    },
    getStatus() {
      const participatingMediumPresentation =
        workerOwnedParticipatingMediumPresentation(currentFrame);
      return Object.freeze({
        schema: ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_SCHEMA,
        status: disposed
          ? 'worker-owned-isosurface-presenter-disposed'
          : 'worker-owned-isosurface-presenter-ready',
        generation,
        presentationPlaying,
        presentationPlaybackRevision,
        running,
        activeGeneration: activeJob?.generation ?? null,
        queuedGeneration: latestJob?.generation ?? null,
        visibleGeneration: currentFrame?.generation ?? null,
        recoverableGeneration: recoveryCandidate?.frame.generation ?? null,
        recoverableSphStep: recoveryCandidate?.frame.sphStep ?? null,
        visibleSphStep: currentFrame?.sphStep ?? null,
        visibleSourceTimeS: currentFrame?.sourceTimeS ?? null,
        temporalMotionReady: Boolean(currentFrame?.motionField?.buffer && currentFrame?.motionPacing),
        temporalMotionAgeS: currentFrame?.lastDisplayedMotionAgeS || 0,
        temporalPresentationError: currentFrame?.temporalPresentationError || null,
        visibleSurfaceCount:
          currentFrame?.totalSurfaceCount
          ?? currentFrame?.surfaces?.length
          ?? 0,
        visibleMarchingCubesSurfaceCount:
          currentFrame?.surfaces?.length ?? 0,
        presentationComposition:
          participatingMediumPresentation.presentationComposition,
        participatingMediumStatus:
          participatingMediumPresentation.status,
        collectiveOpticalSurfaceCount:
          participatingMediumPresentation.collectiveOpticalSurfaceCount,
        participatingMediumAggregateDrawCount:
          participatingMediumPresentation.participatingMediumAggregateDrawCount,
        collectiveOpticalShellFallbackCount:
          participatingMediumPresentation.collectiveOpticalShellFallbackCount,
        fieldRowsBufferByteLength,
        adapterCacheEntryCount: adapterCache.size
      });
    },
    async dispose() {
      if (disposed) return;
      retireRetainedSubmissionGap();
      stopTemporalPresentation();
      disposed = true;
      invalidationEpoch += 1;
      resizeRetryInvalidationEpoch = null;
      generation += 1;
      retireRecoveryCandidate('worker-isosurface-recovery-dispose');
      retirePendingRedraw();
      wakeCaptureQuiescenceWaiters();
      retireQueuedJob(latestJob, 'worker-owned isosurface presenter disposed');
      latestJob = null;
      await Promise.all([
        waitForCaptureQuiescence(),
        pumpPromise?.catch?.(() => {}),
        redrawPumpPromise?.catch?.(() => {}),
        renderLaneTail?.catch?.(() => {})
      ]);
      releaseFrame(currentFrame, 'worker-isosurface-presenter-dispose');
      currentFrame = null;
      await releaseAdapterCache();
      nativeMaterial?.dispose();
      nativeMaterial = null;
      fieldRowsBuffer?.destroy?.();
      fieldRowsBuffer = null;
      fieldRowsBufferByteLength = 0;
      emptyMotionBuffer?.destroy?.();
      emptyMotionBuffer = null;
      try {
        participatingMediumRuntime?.destroy?.();
      } catch {
        // The caller-owned device remains the final teardown boundary.
      }
      participatingMediumRuntime = null;
      opaquePipeline = null;
      transparentPipeline = null;
      pipelinePromise = null;
      shaderModule = null;
    }
  });
}
