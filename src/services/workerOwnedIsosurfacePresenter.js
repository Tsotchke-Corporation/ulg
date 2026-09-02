import {
  SPH_GPU_RENDER_FIELD_CELL_FLOATS,
  buildSphRenderFieldWebGpu,
  extractSphRenderRowsWebGpu
} from '../runtime/sph/sphRenderGpuKernel.js';
import {
  bindUlgWebGpuMarchingCubesVolumeSuccessorLineage,
  buildWebGpuMarchingCubesExtensionSurfaceRowsWebGpu,
  createUlgRenderFieldBufferVolumeDescriptor,
  createUlgWebGpuMarchingCubesExtensionAdapter
} from '../runtime/sph/sphMarchingCubesSurfaceAdapter.js';
import { deferSubmittedWorkCleanup } from '../runtime/webgpuComputeLayout.js';
import {
  ULG_WORKER_PRESENTATION_FRAME_QUEUE_COMPLETION_SCOPE,
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
const NO_FULL_READBACK_MODE = 'no-full-readback';
const CONSERVATIVE_NO_READBACK_MODE = 'gpu-conservative-no-readback';
const DEFAULT_DEPTH_FORMAT = 'depth24plus';
const BUFFER_USAGE_COPY_SRC = 0x04;
const BUFFER_USAGE_COPY_DST = 0x08;
const BUFFER_USAGE_UNIFORM = 0x40;
const BUFFER_USAGE_STORAGE = 0x80;

const workerOwnedIsosurfaceWgsl = /* wgsl */`
struct SurfaceUniforms {
  view_projection: mat4x4<f32>,
  origin_scale: vec4<f32>,
  grid_bias_alpha: vec4<f32>,
  color_roughness: vec4<f32>,
  camera_emissive: vec4<f32>,
  optical: vec4<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: SurfaceUniforms;

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
  let world_position = uniforms.origin_scale.xyz
    + (input.grid_position.xyz + uniforms.grid_bias_alpha.xyz)
      * uniforms.origin_scale.w;
  var output: VertexOutput;
  var clip = uniforms.view_projection * vec4<f32>(world_position, 1.0);
  clip.z = clip.z * 0.5 + clip.w * 0.5;
  if (clip.w <= 0.0) {
    clip = vec4<f32>(2.0, 2.0, 1.0, 1.0);
  }
  output.clip_position = clip;
  output.world_position = world_position;
  output.world_normal = decode_octahedral_normal(input.packed_normal);
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
  let emissive_temperature_k = uniforms.camera_emissive.w;
  let emissive_strength = clamp((emissive_temperature_k - 800.0) / 1500.0, 0.0, 2.5);
  var color = uniforms.color_roughness.rgb * diffuse;
  color += vec3<f32>(1.0) * specular * mix(0.16, 0.72, 1.0 - roughness);
  color += uniforms.color_roughness.rgb * fresnel * select(0.12, 0.42, transparency_class > 0.5);
  color += blackbody_tint(emissive_temperature_k) * emissive_strength;
  var alpha = uniforms.grid_bias_alpha.w;
  if (transparency_class > 0.5 && transparency_class < 1.5) {
    color = mix(color, vec3<f32>(0.88, 0.92, 0.96), 0.28 + fresnel * 0.34);
    alpha *= 0.20 + 0.42 * fresnel;
  } else if (transparency_class >= 1.5) {
    alpha *= 0.64 + 0.28 * fresnel;
  } else if (phase_id > 2.5 && phase_id < 3.5) {
    alpha *= 0.34;
  }
  return vec4<f32>(max(color, vec3<f32>(0.0)), clamp(alpha, 0.015, 1.0));
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

function finiteVector(value, length) {
  if (!(Array.isArray(value) || ArrayBuffer.isView(value)) || value.length !== length) {
    return null;
  }
  const vector = Array.from(value, Number);
  return vector.every(Number.isFinite) ? vector : null;
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
    || !retained?.successorSourceFamily
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
    cameraPositionM
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
  drawOverlay = null,
  onTerminal = null,
  onFrameSubmitted = null,
  waitForPresentationOpportunity = null,
  getFramebufferEpoch = null,
  nextPresentationQueueCompletionSerial = null,
  captureRenderRows = extractSphRenderRowsWebGpu,
  buildPresentationFrame = null
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
  let renderLaneTail = Promise.resolve();
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
    deferSubmittedWorkCleanup(device, () => {
      try {
        captured.destroyRenderRowsBuffer?.({ reason });
      } catch {
        captured.destroyRenderRowsBuffer?.();
      }
    });
  };

  const releaseFrame = (frame, reason) => {
    if (!frame) return;
    for (const surface of frame.surfaces || []) {
      releaseExtensionFrameSurface(surface, reason);
    }
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

  const surfaceUniformValues = (frame, surface) => {
    const metadata = surface.metadata || {};
    const transform = surface.translation?.positionTransform
      || surface.descriptor?.positionTransform
      || {};
    const values = new Float32Array(36);
    values.set(frame.viewProjectionMatrix, 0);
    const origin = finiteVector(transform.originM, 3) || [0, 0, 0];
    values.set(origin, 16);
    values[19] = Number(transform.scaleM) || 1;
    const gridBias = Number.isFinite(Number(transform.gridBias))
      ? Number(transform.gridBias)
      : -0.5;
    values[20] = gridBias;
    values[21] = gridBias;
    values[22] = gridBias;
    values[23] = 1;
    const color = finiteVector(metadata.colorLinear, 3) || [0.72, 0.82, 0.94];
    values.set(color, 24);
    values[27] = Number(metadata.transparencyClassId) > 0 ? 0.12 : 0.42;
    values.set(frame.cameraPositionM, 28);
    values[31] = Math.max(0, Number(metadata.emissiveTemperatureK) || 0);
    values[32] = Math.max(0, Number(metadata.transparencyClassId) || 0);
    values[33] = Math.max(0, Number(metadata.phaseId) || 0);
    values[34] = Number(metadata.depthWriteFlag) === 0 ? 0 : 1;
    values[35] = 0;
    return values;
  };

  const renderFrame = async (frame, {
    viewProjectionMatrix = frame.viewProjectionMatrix,
    cameraPositionM = frame.cameraPositionM,
    reason = 'worker-owned-isosurface-frame',
    allowLaggedGeneration = false
  } = {}) => {
    const frameIsCurrent = () => Boolean(
      !disposed
      && frame?.invalidationEpoch === invalidationEpoch
      && (
        generation === frame.generation
        || allowLaggedGeneration === true
      )
    );
    if (!frameIsCurrent()) return false;
    const nextViewProjection = finiteVector(viewProjectionMatrix, 16);
    const nextCameraPosition = finiteVector(cameraPositionM, 3);
    if (nextViewProjection) frame.viewProjectionMatrix = nextViewProjection;
    if (nextCameraPosition) frame.cameraPositionM = nextCameraPosition;
    await ensurePipelines();
    if (!frameIsCurrent()) return false;
    const validateThisDraw = !firstDrawValidated
      && typeof device.pushErrorScope === 'function'
      && typeof device.popErrorScope === 'function';
    if (validateThisDraw) device.pushErrorScope('validation');
    const encoder = device.createCommandEncoder({
      label: 'ulg-worker-owned-isosurface-presentation'
    });
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
        loadOp: 'clear',
        storeOp: 'store'
      }],
      depthStencilAttachment: {
        view: getDepthView(),
        depthClearValue: 1,
        depthLoadOp: 'clear',
        depthStoreOp: 'discard'
      }
    });
    const orderedSurfaces = [...frame.surfaces].sort((left, right) => {
      const leftTransparent = Number(left.metadata?.transparencyClassId) > 0 ? 1 : 0;
      const rightTransparent = Number(right.metadata?.transparencyClassId) > 0 ? 1 : 0;
      return leftTransparent - rightTransparent
        || Number(left.metadata?.renderOrder || 0) - Number(right.metadata?.renderOrder || 0);
    });
    for (const surface of orderedSurfaces) {
      const vertices = surface.translation?.surfaceVertices;
      const draw = surface.translation?.surfaceDraw;
      if (
        !vertices?.compactPositionRowsBuffer
        || !vertices?.compactNormalRowsBuffer
        || !draw?.drawIndirectRowsBuffer
      ) continue;
      const transparent = Number(surface.metadata?.transparencyClassId) > 0;
      const pipeline = transparent ? transparentPipeline : opaquePipeline;
      device.queue.writeBuffer(
        surface.uniformBuffer,
        0,
        surfaceUniformValues(frame, surface)
      );
      if (!surface.bindGroups.has(pipeline)) {
        surface.bindGroups.set(pipeline, device.createBindGroup({
          label: `ulg-worker-owned-isosurface-bind-group-${surface.descriptor.surfaceIndex}`,
          layout: pipeline.getBindGroupLayout(0),
          entries: [{ binding: 0, resource: { buffer: surface.uniformBuffer } }]
        }));
      }
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, surface.bindGroups.get(pipeline));
      pass.setVertexBuffer(0, vertices.compactPositionRowsBuffer);
      pass.setVertexBuffer(1, vertices.compactNormalRowsBuffer);
      pass.drawIndirect(draw.drawIndirectRowsBuffer, 0);
    }
    drawOverlay?.(pass, frame.viewProjectionMatrix, frame.boxDimsM);
    pass.end();
    if (!frameIsCurrent()) {
      if (validateThisDraw) await device.popErrorScope();
      return false;
    }
    const submittedFramebufferEpoch = Number(getFramebufferEpoch());
    if (
      !Number.isSafeInteger(submittedFramebufferEpoch)
      || submittedFramebufferEpoch <= 0
    ) {
      if (validateThisDraw) await device.popErrorScope();
      throw new Error(
        'worker-owned isosurface framebuffer epoch is unavailable'
      );
    }
    const submittedAtMs = nowMs();
    device.queue.submit([encoder.finish()]);
    if (validateThisDraw) {
      const validationError = await device.popErrorScope();
      if (validationError) {
        throw new Error(
          validationError.message || String(validationError)
        );
      }
      firstDrawValidated = true;
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
    await device.queue.onSubmittedWorkDone();
    if (
      !frameIsCurrent()
      || Number(getFramebufferEpoch()) !== submittedFramebufferEpoch
    ) return false;
    const gpuCompletedAtMs = nowMs();
    if (typeof waitForPresentationOpportunity !== 'function') {
      throw new Error(
        'worker-owned isosurface presentation opportunity observer is unavailable'
      );
    }
    const opportunity = await waitForPresentationOpportunity();
    if (opportunity?.available !== true) {
      throw new Error(
        'worker-owned isosurface lacked a post-GPU presentation opportunity'
      );
    }
    if (
      !frameIsCurrent()
      || Number(getFramebufferEpoch()) !== submittedFramebufferEpoch
    ) return false;
    const presentedAtMs = Number.isFinite(Number(opportunity.observedAtMs))
      ? Number(opportunity.observedAtMs)
      : nowMs();
    const proof = Object.freeze({
      presentationFrameSchema:
        ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_FRAME_SCHEMA,
      presentationFrameStatus:
        'worker-owned-isosurface-presentation-opportunity',
      presentationFrameAdmitted: true,
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
        ULG_WORKER_PRESENTATION_PHYSICS_PREFIX_NOT_ATTRIBUTED,
      physicsHostQueueFenceParticipation: null,
      workerFramebufferEpoch: submittedFramebufferEpoch
    });
    try {
      onFrameSubmitted?.({
        reason,
        generation: frame.generation,
        surfaceCount: frame.surfaces.length,
        sphStep: frame.sphStep,
        ...proof
      });
    } catch {
      // Frame accounting is diagnostic-only.
    }
    return proof;
  };

  const scheduleRenderFrame = (frame, options) => {
    const scheduled = renderLaneTail.then(() => renderFrame(frame, options));
    renderLaneTail = scheduled.catch(() => {});
    return scheduled;
  };

  const publishRenderedTerminal = (frame, reason, proof) => {
    terminal(
      {
        generation: frame.generation,
        receiptFields: frame.receiptFields
      },
      ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS,
      {
        reason,
        surfaceCount: frame.surfaces.length,
        submittedSurfaceCount: frame.surfaces.length,
        activeSurfaceCount: null,
        indirectDrawCount: frame.surfaces.length,
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

  const buildFrame = async (job, captured) => {
    const requiredFieldBytes = job.request.surfaceTable.totalFieldCells
      * SPH_GPU_RENDER_FIELD_CELL_FLOATS
      * Float32Array.BYTES_PER_ELEMENT;
    const targetFieldRowsBuffer = await ensureFieldRowsBuffer(requiredFieldBytes);
    const renderField = await buildSphRenderFieldWebGpu({
      device,
      renderRows: captured.renderRows,
      renderRowsBuffer: captured.renderRowsBuffer,
      renderRowsSource: captured,
      schroederSpatialSourceFamily: captured.schroederSpatialSourceFamily,
      surfaceTable: job.request.surfaceTable,
      particleCount: captured.particleCount,
      productEventCount: 0,
      fieldPadding: Number(job.request.fieldPadding),
      refEdgeM: Number(job.request.refEdgeM),
      renderSmearDtS: Math.max(0, Number(job.request.renderSmearDtS) || 0),
      readbackMode: NO_FULL_READBACK_MODE,
      retainFieldRowsBuffer: true,
      retainSurfaceBuffer: false,
      waitForQueueCompletion: false,
      deferCleanup: true,
      targetFieldRowsBuffer,
      targetFieldRowsBufferByteLength: fieldRowsBufferByteLength
    });
    releaseCapturedRows(captured, 'worker-isosurface-render-field-submitted');
    job.capturedReleased = true;

    const descriptors = renderField.surfaceTable.metadata.map((surface, surfaceIndex) =>
      createUlgRenderFieldBufferVolumeDescriptor({
        device,
        renderField,
        surface,
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

    const encoder = device.createCommandEncoder({
      label: 'ulg-worker-owned-isosurface-marching-cubes'
    });
    const extracted = [];
    const translatedSurfaces = [];
    try {
      for (const descriptor of descriptors) {
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
        extracted.push({ descriptor, wrapped, rawExecution });
      }
      device.queue.submit([encoder.finish()]);
      for (const item of extracted) {
        item.rawExecution.result?.retireTemporaryResourcesAfterSubmit?.();
      }

      const surfaces = [];
      for (const item of extracted) {
        const descriptor = item.descriptor;
        const metadata = renderField.surfaceTable.metadata[descriptor.surfaceIndex];
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
          size: 36 * Float32Array.BYTES_PER_ELEMENT,
          usage:
            gpuBufferUsage('UNIFORM', BUFFER_USAGE_UNIFORM)
            | gpuBufferUsage('COPY_DST', BUFFER_USAGE_COPY_DST)
        });
        surfaces.push({
          descriptor,
          metadata,
          translation,
          rawExecution: item.rawExecution,
          uniformBuffer,
          bindGroups: new Map()
        });
        translatedSurfaces.push(surfaces[surfaces.length - 1]);
      }
      renderField.destroyRenderFieldBuffers?.({
        force: true,
        releaseLeases: true,
        reason: 'worker-isosurface-extraction-submitted'
      });
      return {
        generation: job.generation,
        invalidationEpoch: job.invalidationEpoch,
        sphStep: job.sphStep,
        request: job.request,
        receiptFields: job.receiptFields,
        viewProjectionMatrix: [...job.admission.viewProjectionMatrix],
        cameraPositionM: [...job.admission.cameraPositionM],
        boxDimsM: finiteVector(job.request.boxDimsM, 3),
        surfaces
      };
    } catch (error) {
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
        try {
          item.rawExecution?.result?.release?.();
        } catch {
          // Preserve the originating error.
        }
      }
      throw error;
    }
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
          let presentationProof = await scheduleRenderFrame(frame, {
            reason: 'committed-worker-isosurface',
            allowLaggedGeneration: true
          });
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
            presentationProof = await scheduleRenderFrame(frame, {
              reason: 'committed-worker-isosurface-after-resize',
              allowLaggedGeneration: true
            });
          }
          if (!presentationProof?.presentationFrameAdmitted) {
            if (frame.invalidationEpoch !== invalidationEpoch || disposed) {
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
          const previousFrame = currentFrame;
          currentFrame = frame;
          frame = null;
          if (previousFrame) {
            deferSubmittedWorkCleanup(device, () => {
              releaseFrame(previousFrame, 'worker-isosurface-replaced');
            });
          }
          publishRenderedTerminal(
            currentFrame,
            'same-device retained state rendered as true isosurface',
            presentationProof
          );
        } catch (error) {
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
    if (captureInFlightCount === 0 || disposed) return Promise.resolve();
    return new Promise((resolve) => captureQuiescenceWaiters.add(resolve));
  };

  const pumpRedraws = async () => {
    while (pendingRedraw && !disposed) {
      if (captureInFlightCount > 0) {
        await waitForCaptureQuiescence();
        continue;
      }
      if (activeJob || latestJob) {
        const committedPump = pumpPromise;
        if (committedPump) await committedPump.catch(() => {});
        else await Promise.resolve();
        continue;
      }
      const redraw = pendingRedraw;
      pendingRedraw = null;
      const redrawFrame = currentFrame;
      if (
        !redrawFrame
        || redrawFrame.generation !== generation
      ) {
        redraw.resolve(false);
        continue;
      }
      try {
        const presentationProof = await scheduleRenderFrame(redrawFrame, {
          ...redraw.options,
          allowLaggedGeneration: false
        });
        const redrawFrameStillVisible = Boolean(
          presentationProof
          && currentFrame === redrawFrame
          && redrawFrame.invalidationEpoch === invalidationEpoch
          && redrawFrame.generation === generation
          && !disposed
        );
        if (redrawFrameStillVisible) {
          publishRenderedTerminal(
            redrawFrame,
            redraw.options.reason,
            presentationProof
          );
        }
        redraw.resolve(redrawFrameStillVisible);
      } catch (error) {
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

  const scheduleRedraw = (options) => {
    if (
      disposed
      || (
        !currentFrame
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
      receiptFields = {}
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
      generation += 1;
      const jobGeneration = generation;
      const captureInvalidationEpoch = invalidationEpoch;
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
        generation: jobGeneration,
        request,
        retained,
        admission,
        sphStep,
        receiptFields,
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
    async redraw({
      viewProjectionMatrix = null,
      cameraPositionM = null,
      reason = 'worker-owned-isosurface-camera-redraw'
    } = {}) {
      return scheduleRedraw({
        viewProjectionMatrix,
        cameraPositionM,
        reason
      });
    },
    async resize({
      viewProjectionMatrix = null,
      cameraPositionM = null,
      reason = 'worker-owned-isosurface-presentation-resize'
    } = {}) {
      if (disposed) return false;
      invalidationEpoch += 1;
      resizeRetryInvalidationEpoch = invalidationEpoch;
      const replacementPending = Boolean(
        captureInFlightCount > 0
        || activeJob
        || latestJob
      );
      if (currentFrame && !replacementPending) {
        const invalidatedFrame = currentFrame;
        currentFrame = {
          ...invalidatedFrame,
          invalidationEpoch,
          surfaces: invalidatedFrame.surfaces
        };
        invalidatedFrame.surfaces = [];
      }
      return scheduleRedraw({
        viewProjectionMatrix,
        cameraPositionM,
        reason
      });
    },
    clear({ reason = 'worker-owned-isosurface-presentation-clear' } = {}) {
      if (disposed) return false;
      invalidationEpoch += 1;
      resizeRetryInvalidationEpoch = null;
      generation += 1;
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
      return Object.freeze({
        schema: ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_SCHEMA,
        status: disposed
          ? 'worker-owned-isosurface-presenter-disposed'
          : 'worker-owned-isosurface-presenter-ready',
        generation,
        running,
        activeGeneration: activeJob?.generation ?? null,
        queuedGeneration: latestJob?.generation ?? null,
        visibleGeneration: currentFrame?.generation ?? null,
        visibleSphStep: currentFrame?.sphStep ?? null,
        visibleSurfaceCount: currentFrame?.surfaces?.length ?? 0,
        fieldRowsBufferByteLength,
        adapterCacheEntryCount: adapterCache.size
      });
    },
    async dispose() {
      if (disposed) return;
      disposed = true;
      invalidationEpoch += 1;
      resizeRetryInvalidationEpoch = null;
      generation += 1;
      retirePendingRedraw();
      wakeCaptureQuiescenceWaiters();
      retireQueuedJob(latestJob, 'worker-owned isosurface presenter disposed');
      latestJob = null;
      await Promise.all([
        pumpPromise?.catch?.(() => {}),
        redrawPumpPromise?.catch?.(() => {}),
        renderLaneTail?.catch?.(() => {})
      ]);
      releaseFrame(currentFrame, 'worker-isosurface-presenter-dispose');
      currentFrame = null;
      await releaseAdapterCache();
      fieldRowsBuffer?.destroy?.();
      fieldRowsBuffer = null;
      fieldRowsBufferByteLength = 0;
      opaquePipeline = null;
      transparentPipeline = null;
      pipelinePromise = null;
      shaderModule = null;
    }
  });
}
