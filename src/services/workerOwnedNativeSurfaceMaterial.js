import {
  SPH_NATIVE_WEBGPU_BACKGROUND_WGSL,
  SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_CAMERA_UNIFORM_BYTE_LENGTH
} from '../visualization/nativeSurfaceMaterialWgsl.js';
import {
  WORKER_NATIVE_SURFACE_MOTION_WGSL,
  WORKER_NATIVE_SURFACE_MOTION_UNIFORM_BYTES
} from '../visualization/workerNativeSurfaceMotionWgsl.js';
import { buildGgxPrefilteredLatlongMips } from '../visualization/nativeEnvironmentPrefilter.js';
import {
  OPTICAL_GPU_RECORD_FLOATS,
  OPTICAL_GPU_SPECTRAL_SAMPLE_FLOATS,
  ULG_OPTICAL_GPU_TABLE_SCHEMA,
  uploadOpticalGpuTable
} from '../runtime/material/opticalGpuBuffers.js';
import { deferSubmittedWorkCleanup } from '../runtime/webgpuComputeLayout.js';

export const WORKER_NATIVE_SURFACE_MATERIAL_SCHEMA =
  'peercompute.ulg.worker-native-surface-material.v0';
export const WORKER_NATIVE_SURFACE_UNIFORM_BYTES =
  SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_CAMERA_UNIFORM_BYTE_LENGTH;

const BUFFER_STORAGE_COPY_DST = 128 | 8;
const TEXTURE_BINDING_COPY_DST = 4 | 2;
const TEXTURE_RENDER_BINDING = 16 | 4;
const finite = (values, count) => (Array.isArray(values) || ArrayBuffer.isView(values))
  && values.length === count && Array.from(values).every(Number.isFinite);

function sameBytes(left, right) {
  if (left.byteLength !== right.byteLength) return false;
  const a = new Uint8Array(left.buffer, left.byteOffset, left.byteLength);
  const b = new Uint8Array(right.buffer, right.byteOffset, right.byteLength);
  return a.every((value, index) => value === b[index]);
}

function sameOpticalTable(left, right) {
  return left.schema === right.schema && left.recordCount === right.recordCount
    && left.spectralSampleCount === right.spectralSampleCount
    && left.recordStrideBytes === right.recordStrideBytes
    && left.spectralSampleStrideBytes === right.spectralSampleStrideBytes
    && sameBytes(left.records, right.records) && sameBytes(left.spectralSamples, right.spectralSamples);
}

/** Copy only cold optical closure records, never resident dynamics. */
export function snapshotWorkerNativeSurfaceMaterial(input) {
  const table = input?.opticalTable;
  if (input?.schema !== WORKER_NATIVE_SURFACE_MATERIAL_SCHEMA
    || table?.schema !== ULG_OPTICAL_GPU_TABLE_SCHEMA
    || !(table.records instanceof Float32Array)
    || !(table.spectralSamples instanceof Float32Array)
    || !Number.isSafeInteger(table.recordCount) || table.recordCount <= 0
    || !Number.isSafeInteger(table.spectralSampleCount) || table.spectralSampleCount < 0
    || table.recordStrideFloats !== OPTICAL_GPU_RECORD_FLOATS
    || table.recordStrideBytes !== OPTICAL_GPU_RECORD_FLOATS * 4
    || table.spectralSampleStrideFloats !== OPTICAL_GPU_SPECTRAL_SAMPLE_FLOATS
    || table.spectralSampleStrideBytes !== OPTICAL_GPU_SPECTRAL_SAMPLE_FLOATS * 4
    || table.records.length !== table.recordCount * OPTICAL_GPU_RECORD_FLOATS
    || table.spectralSamples.length !== table.spectralSampleCount * OPTICAL_GPU_SPECTRAL_SAMPLE_FLOATS
    || !table.records.every(Number.isFinite) || !table.spectralSamples.every(Number.isFinite)) {
    throw new TypeError('worker native surface requires the exact finite optical closure table');
  }
  return Object.freeze({
    ...input,
    lightingProfile: Object.freeze({ ...input.lightingProfile }),
    backgroundClearValue: Object.freeze({ ...input.backgroundClearValue }),
    opticalTable: Object.freeze({
      schema: table.schema,
      recordCount: table.recordCount,
      recordStrideFloats: OPTICAL_GPU_RECORD_FLOATS,
      recordStrideBytes: OPTICAL_GPU_RECORD_FLOATS * 4,
      spectralSampleCount: table.spectralSampleCount,
      spectralSampleStrideFloats: OPTICAL_GPU_SPECTRAL_SAMPLE_FLOATS,
      spectralSampleStrideBytes: OPTICAL_GPU_SPECTRAL_SAMPLE_FLOATS * 4,
      records: new Float32Array(table.records),
      spectralSamples: new Float32Array(table.spectralSamples)
    })
  });
}

// This is the existing compact page-native camera ABI, not another optics model.
export function buildWorkerNativeSurfaceUniformValues(frame, surface, inverse) {
  const values = new Float32Array(WORKER_NATIVE_SURFACE_UNIFORM_BYTES / 4);
  const integers = new Uint32Array(values.buffer);
  if (!finite(frame.viewProjectionMatrix, 16) || !finite(inverse, 16)) {
    throw new TypeError('native surface requires finite forward and inverse camera matrices');
  }
  values.set(frame.viewProjectionMatrix, 0);
  values.set(inverse, 64);
  const metadata = surface.metadata || {};
  const draw = surface.translation?.surfaceDraw || {};
  const vertices = surface.translation?.surfaceVertices || {};
  const transform = surface.translation?.positionTransform
    || surface.descriptor?.positionTransform || {};
  const clamp = surface.translation?.positionClamp || {};
  const appearance = frame.nativeSurfaceAppearance || frame.request?.nativeSurfaceMaterial || {};
  const lighting = appearance.lightingProfile || {};
  integers[16] = vertices.compactPositionRowsVertexCount ?? vertices.compactPositionRowsBufferRowCount ?? 0;
  integers[17] = vertices.compactPositionRowsStrideFloats ?? draw.compactPositionRowsStrideFloats ?? 4;
  integers[18] = surface.descriptor?.surfaceIndex || 0;
  values[20] = Number(metadata.materialId) || 0;
  values[21] = Number(metadata.phaseId) || 0;
  values[22] = Number(metadata.opticalStateId) || 0;
  values[23] = Number(metadata.density) || 0;
  values[24] = Number(surface.descriptor?.isovalue) || 0;
  values[26] = Number(metadata.transparencyClassId) || 0;
  values[27] = Number(metadata.depthWriteFlag) === 0 ? 0 : 1;
  values[28] = Number(metadata.renderOrder) || 0;
  values.set([0, 1, 0], 29);
  const transformed = transform.enabled === true;
  values[32] = transformed && Number.isFinite(transform.scaleM) ? transform.scaleM : 1;
  values.set(transformed && finite(transform.originM, 3) ? transform.originM : [0, 0, 0], 33);
  values[36] = transformed && Number.isFinite(transform.gridBias) ? transform.gridBias : 0;
  values[37] = transformed ? 1 : 0;
  values[38] = Number(lighting.nativeAmbientSuppression) || 0;
  values[39] = Number(lighting.nativeDirectSuppression) || 0;
  if (clamp.enabled === true && finite(clamp.minM, 3) && finite(clamp.maxM, 3)) {
    values.set(clamp.minM, 40); values.set(clamp.maxM, 43); values[46] = 1;
  }
  values[47] = Number(lighting.nativeEnvironmentSuppression) || 0;
  const dims = frame.boxDimsM;
  // The box diagonal is a conservative geometric upper bound on a ray path.
  // No fabricated constant thickness is used for transmission.
  values[51] = finite(dims, 3) ? Math.hypot(...dims) / 2 : 0;
  values.set(finite(frame.cameraPositionM, 3) ? frame.cameraPositionM : [0, 0, 0], 60);
  values[63] = Math.max(0, Number(metadata.emissiveTemperatureK) || 0);
  return values;
}

export function buildWorkerNativeSurfaceMotionUniformValues(frame, surface, cameraValues) {
  const values = new Float32Array(WORKER_NATIVE_SURFACE_MOTION_UNIFORM_BYTES / 4);
  if (!frame.motionField?.buffer) return values;
  const words = new Uint32Array(values.buffer);
  words[0] = surface.descriptor?.fieldOffset ?? 0;
  words[1] = surface.metadata?.resolution ?? 0;
  words[2] = frame.motionField.rowCount;
  values[4] = Math.max(0, Number(frame.drawMotionAgeS) || 0);
  values[5] = Math.abs(cameraValues[32]); // same one-field-cell presentation cap
  return values;
}

export function workerNativeSurfaceKind(surface) {
  const metadata = surface?.metadata || {};
  if (metadata.renderLayer === 'vapor-surface'
    || Number(metadata.transparencyClassId) === 1) return 'vapor';
  return metadata.renderLayer === 'refractive-surface'
    || Number(metadata.transparencyClassId) === 2 ? 'refractive' : 'opaque';
}

/** Shared native shader, with worker-owned presentation resources only. */
export function createWorkerOwnedNativeSurfaceMaterial({
  device, format, depthFormat, onAppearanceReady = null,
  fetchImage = (...args) => globalThis.fetch(...args),
  decodeImage = (...args) => globalThis.createImageBitmap(...args),
  createEnvironmentCanvas = (width, height) => new globalThis.OffscreenCanvas(width, height),
  createBackgroundCanvas = createEnvironmentCanvas
}) {
  let disposed = false;
  let targets = null;
  const frames = new Map();
  const backgrounds = new Map();
  const opticalTables = new Set();
  const owned = new Set();
  const own = (resource) => { owned.add(resource); return resource; };
  const retire = (resources) => {
    const unique = [...new Set(resources.filter(resource => resource && owned.has(resource)))];
    for (const resource of unique) owned.delete(resource);
    if (unique.length === 0) return;
    deferSubmittedWorkCleanup(device, () => {
      for (const resource of unique) resource.destroy?.();
    });
  };
  const sampler = device.createSampler({
    magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear',
    addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge'
  });
  const environmentSampler = device.createSampler({
    magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear',
    addressModeU: 'repeat', addressModeV: 'clamp-to-edge'
  });
  const dummyColor = own(device.createTexture({
    label: 'ulg-worker-native-dummy-color', size: [1, 1], format: 'rgba8unorm',
    usage: TEXTURE_BINDING_COPY_DST
  }));
  device.queue.writeTexture({ texture: dummyColor }, new Uint8Array([0, 0, 0, 255]),
    { bytesPerRow: 4 }, [1, 1]);
  const dummyDepth = own(device.createTexture({
    label: 'ulg-worker-native-dummy-back-depth', size: [1, 1], format: 'depth32float',
    usage: TEXTURE_RENDER_BINDING
  }));
  const emptyTemperature = own(device.createBuffer({
    label: 'ulg-worker-native-no-vertex-temperature', size: 16, usage: BUFFER_STORAGE_COPY_DST
  }));
  const emptyMotion = own(device.createBuffer({
    label: 'ulg-worker-native-no-motion', size: 16, usage: BUFFER_STORAGE_COPY_DST
  }));
  const shader = device.createShaderModule({
    label: 'ulg-worker-shared-native-surface', code: WORKER_NATIVE_SURFACE_MOTION_WGSL
  });
  const dataLayout = device.createBindGroupLayout({ entries: [
    { binding: 0, visibility: 1, buffer: { type: 'read-only-storage' } },
    { binding: 1, visibility: 3, buffer: { type: 'uniform' } },
    { binding: 2, visibility: 2, buffer: { type: 'read-only-storage' } },
    { binding: 3, visibility: 2, buffer: { type: 'read-only-storage' } },
    { binding: 4, visibility: 1, buffer: { type: 'read-only-storage' } },
    { binding: 5, visibility: 1, buffer: { type: 'read-only-storage' } },
    { binding: 6, visibility: 1, buffer: { type: 'read-only-storage' } },
    { binding: 7, visibility: 1, buffer: { type: 'uniform', minBindingSize: WORKER_NATIVE_SURFACE_MOTION_UNIFORM_BYTES } }
  ] });
  const opticsLayout = device.createBindGroupLayout({ entries: [
    { binding: 0, visibility: 2, texture: { sampleType: 'float' } },
    { binding: 1, visibility: 2, sampler: { type: 'filtering' } },
    { binding: 2, visibility: 2, texture: { sampleType: 'float' } },
    { binding: 3, visibility: 2, sampler: { type: 'filtering' } },
    { binding: 4, visibility: 2, texture: { sampleType: 'depth' } }
  ] });
  const layout = device.createPipelineLayout({ bindGroupLayouts: [dataLayout, opticsLayout] });
  const createPipeline = (descriptor) => device.createRenderPipelineAsync
    ? device.createRenderPipelineAsync(descriptor)
    : Promise.resolve(device.createRenderPipeline(descriptor));
  const pipelines = {};
  const premultiplied = {
    color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
    alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
  };
  const ready = (async () => {
    const info = await shader.getCompilationInfo?.();
    const errors = info?.messages?.filter((message) => message.type === 'error') || [];
    if (errors.length) throw new Error(errors.map((message) => message.message).join('; '));
    await Promise.all(['opaque', 'vapor', 'backface'].map(async (kind) => {
      const backface = kind === 'backface';
      pipelines[kind] = await createPipeline({
        label: `ulg-worker-native-surface-${kind}`, layout,
        vertex: { module: shader, entryPoint: 'vs_main' },
        ...(backface ? {} : { fragment: {
          module: shader, entryPoint: 'fs_main',
          targets: [{ format, ...(kind === 'vapor' ? { blend: premultiplied } : {}) }]
        } }),
        primitive: { topology: 'triangle-list', cullMode: backface ? 'front' : 'back' },
        depthStencil: {
          format: backface ? 'depth32float' : depthFormat,
          depthWriteEnabled: kind !== 'vapor', depthCompare: backface ? 'less' : 'less-equal'
        }
      });
    }));
    const backgroundShader = device.createShaderModule({ code: SPH_NATIVE_WEBGPU_BACKGROUND_WGSL });
    pipelines.background = await createPipeline({
      label: 'ulg-worker-native-background', layout: 'auto',
      vertex: { module: backgroundShader, entryPoint: 'vs_main' },
      fragment: { module: backgroundShader, entryPoint: 'fs_main', targets: [{ format }] },
      primitive: { topology: 'triangle-list' },
      depthStencil: { format: depthFormat, depthWriteEnabled: false, depthCompare: 'always' }
    });
  })();

  const notifyAppearance = (entry) => {
    if (disposed || backgrounds.get(entry.url) !== entry || entry.refs <= 0) return;
    try { onAppearanceReady?.({ backgroundImageUrl: entry.url, status: entry.status, error: entry.error }); }
    catch { /* A redraw notification cannot invalidate resident geometry. */ }
  };
  const releaseImageCanvas = (canvas) => {
    // OffscreenCanvas has no close(); shrinking releases its cold image backing.
    if (canvas) { canvas.width = 1; canvas.height = 1; }
  };
  const acquireBackground = (url) => {
    if (!url) return null;
    let entry = backgrounds.get(url);
    if (!entry) {
      entry = { url, refs: 0, texture: null, status: 'pending', error: null,
        environmentTexture: null, environmentStatus: 'pending', environmentError: null,
        abort: new AbortController() };
      backgrounds.set(url, entry);
      // Image I/O is deliberately outside the serial render lane. Missing or
      // slow scenery must never hold a source frame or stop temporal motion.
      entry.ready = Promise.resolve().then(async () => {
        const response = await fetchImage(url, { signal: entry.abort.signal });
        if (!response.ok) throw new Error(`native background image HTTP ${response.status}`);
        if (disposed || backgrounds.get(url) !== entry) return;
        const bitmap = await decodeImage(await response.blob());
        let uploadCanvas = null;
        try {
          if (disposed || backgrounds.get(url) !== entry) return;
          // Match the page-native background upload cap and aspect rounding.
          const sourceWidth = Math.max(1, Number(bitmap.width) || 1);
          const sourceHeight = Math.max(1, Number(bitmap.height) || 1);
          const maxDeviceDimension = Math.max(1,
            Math.floor(Number(device.limits?.maxTextureDimension2D) || 2048));
          const maxUploadDimension = Math.min(2048, maxDeviceDimension);
          const resizeScale = Math.min(1, maxUploadDimension / Math.max(sourceWidth, sourceHeight));
          entry.width = Math.max(1, Math.round(sourceWidth * resizeScale));
          entry.height = Math.max(1, Math.round(sourceHeight * resizeScale));
          // Exact page upload path: read decoded cold image pixels, not GPU
          // physics/render buffers. writeTexture owns the copied bytes before
          // the temporary canvas backing and bitmap are released.
          uploadCanvas = createBackgroundCanvas(entry.width, entry.height);
          const context2d = uploadCanvas.getContext('2d', { willReadFrequently: true });
          if (!context2d) throw new Error('native background resize sampler unavailable');
          context2d.drawImage(bitmap, 0, 0, entry.width, entry.height);
          const imagePixels = context2d.getImageData(0, 0, entry.width, entry.height).data;
          const sourceBytesPerRow = entry.width * 4;
          const uploadBytesPerRow = Math.ceil(sourceBytesPerRow / 256) * 256;
          let uploadPixels = imagePixels;
          if (uploadBytesPerRow !== sourceBytesPerRow) {
            uploadPixels = new Uint8Array(uploadBytesPerRow * entry.height);
            for (let row = 0; row < entry.height; row++) {
              uploadPixels.set(imagePixels.subarray(row * sourceBytesPerRow, (row + 1) * sourceBytesPerRow),
                row * uploadBytesPerRow);
            }
          }
          entry.texture = own(device.createTexture({
            label: 'ulg-worker-native-background-image', size: [entry.width, entry.height, 1],
            format: 'rgba8unorm', usage: TEXTURE_BINDING_COPY_DST
          }));
          device.queue.writeTexture({ texture: entry.texture }, uploadPixels,
            { bytesPerRow: uploadBytesPerRow, rowsPerImage: entry.height }, [entry.width, entry.height, 1]);
          releaseImageCanvas(uploadCanvas); uploadCanvas = null;
          entry.status = 'ready';
          // Reuse the page-native cold image prefilter exactly: this samples
          // a decoded image, never physics or a rendered GPU framebuffer.
          let environmentCanvas = null;
          try {
            const width = 256, height = 128, mipLevelCount = 9;
            environmentCanvas = createEnvironmentCanvas(width, height);
            const context2d = environmentCanvas.getContext('2d', { willReadFrequently: true });
            if (!context2d) throw new Error('native environment 2D image sampler unavailable');
            context2d.drawImage(bitmap, 0, 0, width, height);
            const levels = buildGgxPrefilteredLatlongMips({
              pixels: context2d.getImageData(0, 0, width, height).data,
              width, height, mipLevelCount, sampleCount: 64
            });
            entry.environmentTexture = own(device.createTexture({
              label: 'ulg-worker-native-environment-prefilter', size: [width, height],
              format: 'rgba8unorm', mipLevelCount, usage: TEXTURE_BINDING_COPY_DST
            }));
            for (let level = 0; level < levels.length; level++) {
              device.queue.writeTexture({ texture: entry.environmentTexture, mipLevel: level },
                levels[level].pixels, { bytesPerRow: levels[level].width * 4, rowsPerImage: levels[level].height },
                [levels[level].width, levels[level].height, 1]);
            }
            entry.environmentStatus = 'ready';
          } catch (error) {
            retire([entry.environmentTexture]); entry.environmentTexture = null;
            entry.environmentStatus = 'failed'; entry.environmentError = String(error?.message || error);
          } finally { releaseImageCanvas(environmentCanvas); }
        } finally { releaseImageCanvas(uploadCanvas); bitmap.close(); }
      }).catch(error => {
        retire([entry.texture]); entry.texture = null;
        entry.status = 'failed'; entry.error = String(error?.message || error);
        entry.environmentStatus = 'unavailable-background-failed';
      }).finally(() => notifyAppearance(entry));
    }
    entry.refs += 1;
    return entry;
  };
  const releaseBackground = (entry) => {
    if (!entry || --entry.refs > 0) return;
    if (backgrounds.get(entry.url) === entry) backgrounds.delete(entry.url);
    entry.abort.abort();
    retire([entry.texture, entry.environmentTexture]);
  };
  const acquireOptical = (table) => {
    for (const cached of opticalTables) {
      if (sameOpticalTable(cached.table, table)) { cached.refs += 1; return cached; }
    }
    const buffers = uploadOpticalGpuTable(device, table);
    own(buffers.recordsBuffer); own(buffers.spectralSamplesBuffer);
    const entry = { buffers, refs: 1, table: {
      ...table, records: new Float32Array(table.records), spectralSamples: new Float32Array(table.spectralSamples)
    } };
    opticalTables.add(entry);
    return entry;
  };
  const releaseOptical = (entry) => {
    if (!entry || --entry.refs > 0) return;
    opticalTables.delete(entry);
    retire([entry.buffers.recordsBuffer, entry.buffers.spectralSamplesBuffer]);
  };
  const releaseFrame = (frame) => {
    const entry = frames.get(frame);
    if (!entry) return;
    frames.delete(frame);
    releaseBackground(entry.background);
    releaseOptical(entry.optical);
    retire([entry.backgroundUniform, ...[...entry.bindGroups.values()].map(binding => binding.motionUniform)]);
  };
  const prepare = async (frame, viewportSize) => {
    await ready;
    if (disposed) throw new Error('worker native material disposed');
    const [width, height] = viewportSize.map(Math.floor);
    if (!(Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0)) {
      throw new TypeError('native material viewport unavailable');
    }
    if (!targets || targets.width !== width || targets.height !== height) {
      if (targets) retire([targets.color, targets.backDepth]);
      targets = {
        width, height,
        color: own(device.createTexture({ label: 'ulg-worker-native-scene-copy',
          size: [width, height], format, usage: TEXTURE_BINDING_COPY_DST })),
        backDepth: own(device.createTexture({ label: 'ulg-worker-native-back-depth',
          size: [width, height], format: 'depth32float', usage: TEXTURE_RENDER_BINDING }))
      };
    }
    const input = frame.request.nativeSurfaceMaterial;
    const appearance = frame.nativeSurfaceAppearance || input;
    let entry = frames.get(frame);
    if (!entry) {
      const optical = acquireOptical(input.opticalTable);
      try {
        entry = { optical, background: null, backgroundUrl: null,
          bindGroups: new Map(), backgroundUniform: own(device.createBuffer({
            label: 'ulg-worker-native-background-uniform', size: 16, usage: 64 | 8
          })) };
        frames.set(frame, entry);
      } catch (error) {
        releaseOptical(optical);
        throw error;
      }
    }
    const backgroundUrl = appearance.backgroundImageUrl || null;
    if (entry.backgroundUrl !== backgroundUrl) {
      releaseBackground(entry.background);
      entry.backgroundUrl = backgroundUrl;
      entry.background = acquireBackground(backgroundUrl);
    }
    const environment = entry.background?.environmentTexture || dummyColor;
    if (entry.opticsTargets !== targets || entry.environmentTexture !== environment) {
      entry.opticsBindGroup = device.createBindGroup({ layout: opticsLayout, entries: [
      { binding: 0, resource: targets.color.createView() },
      { binding: 1, resource: sampler },
      { binding: 2, resource: environment.createView() },
      { binding: 3, resource: environmentSampler },
      { binding: 4, resource: targets.backDepth.createView() }
      ] });
      entry.opaqueOpticsBindGroup = device.createBindGroup({ layout: opticsLayout, entries: [
      { binding: 0, resource: dummyColor.createView() },
      { binding: 1, resource: sampler },
      { binding: 2, resource: environment.createView() },
      { binding: 3, resource: environmentSampler },
      { binding: 4, resource: dummyDepth.createView() }
      ] });
      entry.opticsTargets = targets;
      entry.environmentTexture = environment;
    }
    entry.diagnostics = getDiagnostics(frame);
    return entry;
  };
  const draw = (pass, frame, surface, { inverse, refractive = false, backface = false } = {}) => {
    const entry = frames.get(frame);
    const vertices = surface.translation?.surfaceVertices;
    const indirect = surface.translation?.surfaceDraw?.drawIndirectRowsBuffer;
    if (disposed || !entry || !vertices?.compactPositionRowsBuffer || !vertices?.compactNormalRowsBuffer
      || !indirect || !surface.uniformBuffer) return false;
    const cameraValues = buildWorkerNativeSurfaceUniformValues(frame, surface, inverse);
    device.queue.writeBuffer(surface.uniformBuffer, 0, cameraValues);
    const temperatures = surface.translation?.surfaceDraw?.compactTemperatureRowsBuffer || emptyTemperature;
    const motion = frame.motionField?.buffer || emptyMotion;
    const inputs = [vertices.compactPositionRowsBuffer, surface.uniformBuffer,
      entry.optical.buffers.recordsBuffer, entry.optical.buffers.spectralSamplesBuffer,
      vertices.compactNormalRowsBuffer, temperatures, motion];
    let binding = entry.bindGroups.get(surface);
    if (!binding) {
      binding = { motionUniform: own(device.createBuffer({
        label: 'ulg-worker-native-surface-motion-uniform',
        size: WORKER_NATIVE_SURFACE_MOTION_UNIFORM_BYTES, usage: 64 | 8
      })) };
      entry.bindGroups.set(surface, binding);
    }
    if (!binding.inputs || inputs.some((buffer, index) => buffer !== binding.inputs[index])) {
      binding.bindGroup = device.createBindGroup({
      layout: dataLayout, entries: [
        { binding: 0, resource: { buffer: vertices.compactPositionRowsBuffer } },
        { binding: 1, resource: { buffer: surface.uniformBuffer } },
        { binding: 2, resource: { buffer: entry.optical.buffers.recordsBuffer } },
        { binding: 3, resource: { buffer: entry.optical.buffers.spectralSamplesBuffer } },
        { binding: 4, resource: { buffer: vertices.compactNormalRowsBuffer } },
        { binding: 5, resource: { buffer: temperatures } },
        { binding: 6, resource: { buffer: motion } },
        { binding: 7, resource: { buffer: binding.motionUniform } }
      ]
      });
      binding.inputs = inputs;
    }
    binding.temperatureMode = temperatures === emptyTemperature
      ? 'uniform-temperature-fallback' : 'retained-compact-temperature-rows';
    device.queue.writeBuffer(binding.motionUniform, 0,
      buildWorkerNativeSurfaceMotionUniformValues(frame, surface, cameraValues));
    pass.setPipeline(pipelines[backface ? 'backface' : workerNativeSurfaceKind(surface) === 'vapor' ? 'vapor' : 'opaque']);
    pass.setBindGroup(0, binding.bindGroup);
    pass.setBindGroup(1, refractive ? entry.opticsBindGroup : entry.opaqueOpticsBindGroup);
    pass.drawIndirect(indirect, 0);
    return true;
  };
  const drawBackground = (pass, frame) => {
    const entry = frames.get(frame);
    if (!entry?.background?.texture) return false;
    const imageAspect = entry.background.width / entry.background.height;
    const screenAspect = targets.width / targets.height;
    const cover = imageAspect > screenAspect ? [screenAspect / imageAspect, 1]
      : [1, imageAspect / screenAspect];
    device.queue.writeBuffer(entry.backgroundUniform, 0, new Float32Array([...cover, 0, 0]));
    pass.setPipeline(pipelines.background);
    if (entry.backgroundBindTexture !== entry.background.texture) {
      entry.backgroundBindGroup = device.createBindGroup({ layout: pipelines.background.getBindGroupLayout(0), entries: [
      { binding: 0, resource: entry.background.texture.createView() },
      { binding: 1, resource: sampler },
      { binding: 2, resource: { buffer: entry.backgroundUniform } }
      ] });
      entry.backgroundBindTexture = entry.background.texture;
    }
    pass.setBindGroup(0, entry.backgroundBindGroup);
    pass.draw(3);
    return true;
  };
  const getDiagnostics = (frame) => {
    const entry = frames.get(frame);
    return Object.freeze({
      backgroundStatus: entry?.background?.status || 'not-requested',
      backgroundError: entry?.background?.error || null,
      backgroundImageUrl: entry?.backgroundUrl || null,
      environmentPrefilterStatus: entry?.background?.environmentStatus || 'not-requested',
      environmentPrefilterError: entry?.background?.environmentError || null,
      environmentLightingSource: entry?.background?.environmentTexture
        ? 'native-ggx-prefilter-256x128-9mips-64samples' : 'native-analytic-fallback',
      opticalTableCacheEntryCount: opticalTables.size,
      temperatureModes: [...new Set(Array.from(entry?.bindGroups?.values() ?? [])
        .map(binding => binding.temperatureMode).filter(Boolean))]
    });
  };
  const clearValue = (frame) => {
    const appearance = frame?.nativeSurfaceAppearance || frame?.request?.nativeSurfaceMaterial || {};
    if (appearance.backgroundImageUrl) return { r: 0, g: 0, b: 0, a: 1 };
    const clear = appearance.backgroundClearValue;
    if (clear && ['r', 'g', 'b'].every(key => Number.isFinite(clear[key]) && clear[key] >= 0 && clear[key] <= 1)
      && clear.a === 1) return { r: clear.r, g: clear.g, b: clear.b, a: 1 };
    const hex = String(appearance.backgroundColor || '').replace(/^#/, '');
    if (/^[0-9a-f]{6}$/i.test(hex)) return {
      r: parseInt(hex.slice(0, 2), 16) / 255, g: parseInt(hex.slice(2, 4), 16) / 255,
      b: parseInt(hex.slice(4, 6), 16) / 255, a: 1
    };
    return { r: 0, g: 0, b: 0, a: 1 };
  };
  return { ready, prepare, draw, drawBackground, releaseFrame, getDiagnostics, clearValue,
    transferFrame(source, target) {
      const entry = frames.get(source);
      if (entry && source !== target) { releaseFrame(target); frames.delete(source); frames.set(target, entry); }
    },
    copySceneColor(encoder, colorTexture) {
      encoder.copyTextureToTexture({ texture: colorTexture }, { texture: targets.color },
        [targets.width, targets.height]);
    },
    backDepthView() { return targets.backDepth.createView(); },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const frame of frames.keys()) releaseFrame(frame);
      retire([...owned]);
    }
  };
}
