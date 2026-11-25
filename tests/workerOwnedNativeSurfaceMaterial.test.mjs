import assert from 'node:assert/strict';
import test from 'node:test';
import {
  WORKER_NATIVE_SURFACE_MATERIAL_SCHEMA,
  WORKER_NATIVE_SURFACE_UNIFORM_BYTES,
  buildWorkerNativeSurfaceMotionUniformValues,
  buildWorkerNativeSurfaceUniformValues,
  createWorkerOwnedNativeSurfaceMaterial,
  snapshotWorkerNativeSurfaceMaterial,
  workerNativeSurfaceKind
} from '../src/services/workerOwnedNativeSurfaceMaterial.js';
import {
  OPTICAL_GPU_RECORD_FLOATS, OPTICAL_GPU_SPECTRAL_SAMPLE_FLOATS,
  ULG_OPTICAL_GPU_TABLE_SCHEMA
} from '../src/runtime/material/opticalGpuBuffers.js';
import { WORKER_NATIVE_SURFACE_MOTION_WGSL } from '../src/visualization/workerNativeSurfaceMotionWgsl.js';

const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const settle = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function input(overrides = {}) {
  return {
    schema: WORKER_NATIVE_SURFACE_MATERIAL_SCHEMA,
    lightingProfile: { nativeAmbientSuppression: 0.2, nativeDirectSuppression: 0.3, nativeEnvironmentSuppression: 0.4 },
    backgroundColor: '#204080', backgroundImageUrl: null,
    opticalTable: {
      schema: ULG_OPTICAL_GPU_TABLE_SCHEMA,
      recordCount: 1, recordStrideFloats: OPTICAL_GPU_RECORD_FLOATS, recordStrideBytes: OPTICAL_GPU_RECORD_FLOATS * 4,
      spectralSampleCount: 0, spectralSampleStrideFloats: OPTICAL_GPU_SPECTRAL_SAMPLE_FLOATS,
      spectralSampleStrideBytes: OPTICAL_GPU_SPECTRAL_SAMPLE_FLOATS * 4,
      records: new Float32Array(OPTICAL_GPU_RECORD_FLOATS), spectralSamples: new Float32Array(0)
    },
    ...overrides
  };
}
function frame(material = input()) {
  return {
    request: { nativeSurfaceMaterial: snapshotWorkerNativeSurfaceMaterial(material) },
    viewProjectionMatrix: identity, cameraPositionM: [2, 3, 4], boxDimsM: [2, 4, 4],
    drawMotionAgeS: 0.125, motionField: { buffer: { label: 'borrowed-motion' }, rowCount: 64 }
  };
}
function surface() {
  return {
    uniformBuffer: { label: 'borrowed-camera' },
    metadata: { materialId: 7, phaseId: 2, opticalStateId: 0, density: 998,
      transparencyClassId: 2, depthWriteFlag: 1, renderOrder: 8, emissiveTemperatureK: 400, resolution: 3 },
    descriptor: { surfaceIndex: 2, isovalue: 0.75, fieldOffset: 8 },
    translation: {
      positionTransform: { enabled: true, originM: [1, 2, 3], scaleM: 0.125, gridBias: -0.5 },
      positionClamp: { enabled: true, minM: [-1, -2, -3], maxM: [1, 2, 3] },
      surfaceVertices: { compactPositionRowsBuffer: { label: 'borrowed-positions' },
        compactNormalRowsBuffer: { label: 'borrowed-normals' }, compactPositionRowsVertexCount: 6,
        compactPositionRowsStrideFloats: 4 },
      surfaceDraw: { drawIndirectRowsBuffer: { label: 'borrowed-indirect' },
        compactTemperatureRowsBuffer: { label: 'borrowed-temperatures' } }
    }
  };
}
function rig(options = {}) {
  const buffers = [], textures = [], samplers = [], pipelines = [], bindGroups = [], writes = [], textureWrites = [], externalCopies = [];
  const resource = descriptor => ({ ...descriptor, destroyCount: 0,
    destroy() { this.destroyCount++; }, createView() { return { texture: this }; } });
  const device = {
    createBuffer(descriptor) { const value = resource(descriptor); buffers.push(value); return value; },
    createTexture(descriptor) { const value = resource(descriptor); textures.push(value); return value; },
    createSampler(descriptor) { samplers.push(descriptor); return descriptor; },
    createShaderModule(descriptor) { return { ...descriptor, async getCompilationInfo() { return { messages: [] }; } }; },
    createBindGroupLayout(descriptor) { return descriptor; },
    createPipelineLayout(descriptor) { return descriptor; },
    createBindGroup(descriptor) { bindGroups.push(descriptor); return descriptor; },
    async createRenderPipelineAsync(descriptor) {
      const value = { ...descriptor, getBindGroupLayout: () => ({}) }; pipelines.push(value); return value;
    },
    queue: {
      writeBuffer(buffer, offset, values) { writes.push({ buffer, offset, bytes: new Uint8Array(values.buffer, values.byteOffset, values.byteLength).slice() }); },
      writeTexture(destination, values, layout, size) { textureWrites.push({ destination,
        values: new Uint8Array(values.buffer, values.byteOffset, values.byteLength).slice(), layout, size }); },
      copyExternalImageToTexture(source, destination, size) { externalCopies.push({ source, destination, size }); },
      onSubmittedWorkDone: () => Promise.resolve()
    }
  };
  const material = createWorkerOwnedNativeSurfaceMaterial({ device, format: 'bgra8unorm', depthFormat: 'depth24plus',
    createBackgroundCanvas: (width, height) => ({ width, height, getContext: () => ({
      drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(width * height * 4) })
    }) }), ...options });
  const actions = [];
  const pass = {
    setPipeline(value) { actions.push(['pipeline', value]); },
    setBindGroup(index, value) { actions.push(['group', index, value]); },
    drawIndirect(buffer, offset) { actions.push(['indirect', buffer, offset]); },
    draw(count) { actions.push(['draw', count]); }
  };
  return { material, device, buffers, textures, samplers, pipelines, bindGroups, writes, textureWrites, externalCopies, pass, actions };
}

test('cold material snapshot clones the exact optical ABI and rejects malformed tables', () => {
  const original = input();
  original.opticalTable.records[0] = 7;
  const copy = snapshotWorkerNativeSurfaceMaterial(original);
  original.opticalTable.records[0] = 9;
  original.lightingProfile.nativeAmbientSuppression = 1;
  assert.equal(copy.opticalTable.records[0], 7);
  assert.equal(copy.lightingProfile.nativeAmbientSuppression, 0.2);
  assert.ok(Object.isFrozen(copy));
  for (const changes of [
    { recordStrideBytes: 0 }, { spectralSampleStrideBytes: 0 }, { recordCount: 0 },
    { records: new Float32Array(1) }, { spectralSamples: new Float32Array(1) },
    { records: new Float32Array(OPTICAL_GPU_RECORD_FLOATS).fill(NaN) }
  ]) assert.throws(() => snapshotWorkerNativeSurfaceMaterial({ ...original,
    opticalTable: { ...original.opticalTable, ...changes } }), /exact finite optical/);
});

test('native camera is the unchanged 320-byte ABI and motion uses a separate one-cell-capped 32-byte uniform', () => {
  const f = frame(), s = surface();
  const values = buildWorkerNativeSurfaceUniformValues(f, s, identity);
  const words = new Uint32Array(values.buffer);
  assert.equal(WORKER_NATIVE_SURFACE_UNIFORM_BYTES, 320);
  assert.equal(values.byteLength, 320);
  assert.deepEqual([...values.slice(0, 16)], identity);
  assert.deepEqual([...values.slice(64, 80)], identity);
  assert.deepEqual([...words.slice(16, 19)], [6, 4, 2]);
  assert.deepEqual([...values.slice(20, 25)], [7, 2, 0, 998, 0.75]);
  assert.deepEqual([...values.slice(32, 38)], [0.125, 1, 2, 3, -0.5, 1]);
  assert.deepEqual([...values.slice(40, 47)], [-1, -2, -3, 1, 2, 3, 1]);
  assert.equal(values[51], 3);
  assert.deepEqual([...values.slice(60, 64)], [2, 3, 4, 400]);
  const motion = buildWorkerNativeSurfaceMotionUniformValues(f, s, values);
  assert.equal(motion.byteLength, 32);
  assert.deepEqual([...new Uint32Array(motion.buffer).slice(0, 4)], [8, 3, 64, 0]);
  assert.deepEqual([...motion.slice(4)], [0.125, 0.125, 0, 0]);
  assert.deepEqual([...buildWorkerNativeSurfaceMotionUniformValues({ ...f, motionField: null }, s, values)], Array(8).fill(0));
  s.translation.positionTransform.enabled = false;
  s.translation.positionClamp.enabled = false;
  const disabled = buildWorkerNativeSurfaceUniformValues(f, s, identity);
  assert.deepEqual([...disabled.slice(32, 38)], [1, 0, 0, 0, 0, 0]);
  assert.deepEqual([...disabled.slice(40, 47)], Array(7).fill(0));
  assert.throws(() => buildWorkerNativeSurfaceUniformValues({ ...f, viewProjectionMatrix: [] }, s, identity), /finite forward/);
});

test('native pipelines retain back-depth culling, opaque depth writes and premultiplied vapor', async () => {
  const r = rig(); await r.material.ready;
  for (const p of r.pipelines.filter(p => p.label.includes('surface-'))) {
    assert.equal(p.vertex.module.code, WORKER_NATIVE_SURFACE_MOTION_WGSL);
  }
  const opaque = r.pipelines.find(p => p.label.endsWith('-opaque'));
  const vapor = r.pipelines.find(p => p.label.endsWith('-vapor'));
  const back = r.pipelines.find(p => p.label.endsWith('-backface'));
  const background = r.pipelines.find(p => p.label.endsWith('-background'));
  assert.equal(opaque.primitive.cullMode, 'back'); assert.equal(opaque.depthStencil.depthWriteEnabled, true);
  assert.equal(vapor.depthStencil.depthWriteEnabled, false);
  assert.equal(vapor.fragment.targets[0].blend.color.srcFactor, 'one');
  assert.equal(back.primitive.cullMode, 'front'); assert.equal(back.depthStencil.format, 'depth32float');
  assert.equal(back.fragment, undefined);
  assert.equal(background.depthStencil.depthWriteEnabled, false);
  assert.equal(background.depthStencil.depthCompare, 'always');
  assert.equal(workerNativeSurfaceKind(surface()), 'refractive');
  assert.equal(workerNativeSurfaceKind({ metadata: { phaseId: 3 } }), 'opaque');
  assert.equal(workerNativeSurfaceKind({}), 'opaque');
  r.material.dispose();
});

test('surface pass classification matches native render layers and transparency classes, not phase or optical IDs', () => {
  for (const [metadata, expected] of [
    [{ renderLayer: 'vapor-surface' }, 'vapor'],
    [{ renderLayer: 'refractive-surface' }, 'refractive'],
    [{ transparencyClassId: 1 }, 'vapor'],
    [{ transparencyClassId: 2 }, 'refractive'],
    [{ renderLayer: 'refractive-surface', transparencyClassId: 1 }, 'vapor'],
    [{ renderLayer: 'vapor-surface', transparencyClassId: 2 }, 'vapor'],
    [{ phaseId: 3, opticalStateId: 4, transparencyClassId: 0 }, 'opaque'],
    [{ phaseId: 3, opticalStateId: 4, transparencyClassId: 2 }, 'refractive']
  ]) assert.equal(workerNativeSurfaceKind({ metadata }), expected);
});

test('draw binds real compact temperatures and retained motion identically for front and rear depth, and rejects missing buffers', async () => {
  const r = rig(), f = frame(), s = surface();
  await r.material.prepare(f, [640, 480]);
  assert.equal(r.material.draw(r.pass, f, s, { inverse: identity, backface: true }), true);
  assert.equal(r.material.draw(r.pass, f, s, { inverse: identity, refractive: true }), true);
  const groups = r.actions.filter(a => a[0] === 'group' && a[1] === 0).map(a => a[2]);
  assert.equal(groups[0], groups[1]);
  assert.equal(groups[0].entries[5].resource.buffer, s.translation.surfaceDraw.compactTemperatureRowsBuffer);
  assert.equal(groups[0].entries[6].resource.buffer, f.motionField.buffer);
  const motionWrites = r.writes.filter(w => w.buffer.label === 'ulg-worker-native-surface-motion-uniform');
  assert.equal(motionWrites.length, 2); assert.deepEqual(motionWrites[0].bytes, motionWrites[1].bytes);
  assert.deepEqual(r.material.getDiagnostics(f).temperatureModes, ['retained-compact-temperature-rows']);
  delete s.translation.surfaceDraw.compactTemperatureRowsBuffer;
  assert.equal(r.material.draw(r.pass, f, s, { inverse: identity }), true);
  assert.deepEqual(r.material.getDiagnostics(f).temperatureModes, ['uniform-temperature-fallback']);
  const fallback = r.bindGroups.at(-1).entries[5].resource.buffer;
  assert.equal(fallback.label, 'ulg-worker-native-no-vertex-temperature');
  delete s.translation.surfaceVertices.compactNormalRowsBuffer;
  assert.equal(r.material.draw(r.pass, f, s, { inverse: identity }), false);
  r.material.dispose(); await settle();
  assert.ok(r.buffers.every(b => b.destroyCount === 1));
  assert.equal(s.uniformBuffer.destroyCount, undefined, 'borrowed camera is presenter-owned');
});

test('identical optical uploads are shared across source frames and retired only after the final reference', async () => {
  const r = rig(), a = frame(), b = frame();
  await r.material.prepare(a, [640, 480]);
  await r.material.prepare(b, [640, 480]);
  const records = () => r.buffers.filter(b => b.label === 'ulg-optical-material-records');
  assert.equal(records().length, 1);
  assert.equal(r.material.getDiagnostics(b).opticalTableCacheEntryCount, 1);
  r.material.releaseFrame(a); await settle(); assert.equal(records()[0].destroyCount, 0);
  const different = input(); different.opticalTable.records[0] = 1;
  const c = frame(different); await r.material.prepare(c, [640, 480]);
  assert.equal(records().length, 2);
  assert.equal(r.material.getDiagnostics(c).opticalTableCacheEntryCount, 2);
  r.material.transferFrame(b, c); await settle();
  assert.equal(records()[1].destroyCount, 1); assert.equal(records()[0].destroyCount, 0);
  r.material.releaseFrame(b); assert.equal(records()[0].destroyCount, 0);
  r.material.dispose(); r.material.dispose(); await settle();
  assert.ok([...r.buffers, ...r.textures].every(resource => resource.destroyCount === 1));
});

test('pending and failed scenery never block native physics drawing and notify a late redraw', async () => {
  const pending = deferred(), notifications = [];
  const r = rig({ fetchImage: () => pending.promise, onAppearanceReady: event => notifications.push(event) });
  const f = frame(input({ backgroundImageUrl: '/missing.jpg' }));
  await r.material.prepare(f, [640, 480]);
  assert.equal(r.material.getDiagnostics(f).backgroundStatus, 'pending');
  assert.equal(r.material.draw(r.pass, f, surface(), { inverse: identity }), true);
  assert.equal(r.material.drawBackground(r.pass, f), false);
  pending.reject(new Error('offline')); await settle();
  assert.equal(r.material.getDiagnostics(f).backgroundStatus, 'failed');
  assert.match(r.material.getDiagnostics(f).backgroundError, /offline/);
  assert.equal(notifications.length, 1); assert.equal(notifications[0].status, 'failed');
  assert.equal(r.material.draw(r.pass, f, surface(), { inverse: identity }), true);
  assert.deepEqual(r.material.clearValue(f), { r: 0, g: 0, b: 0, a: 1 });
  r.material.dispose();
});

test('decoded background and exact cold GGX prefilter are adopted on redraw with repeat environment sampling', async () => {
  let closes = 0, environmentCanvas;
  const notifications = [], pixels = new Uint8ClampedArray(256 * 128 * 4).fill(128);
  const r = rig({
    fetchImage: async () => ({ ok: true, blob: async () => ({}) }),
    decodeImage: async () => ({ width: 800, height: 400, close() { closes++; } }),
    createEnvironmentCanvas: (width, height) => {
      assert.deepEqual([width, height], [256, 128]);
      environmentCanvas = { width, height,
        getContext: () => ({ drawImage() {}, getImageData: () => ({ data: pixels }) }) };
      return environmentCanvas;
    },
    onAppearanceReady: event => notifications.push(event)
  });
  const f = frame(input({ backgroundImageUrl: '/scene.jpg' }));
  await r.material.prepare(f, [640, 480]); await settle();
  assert.equal(closes, 1); assert.equal(notifications.length, 1);
  assert.deepEqual([environmentCanvas.width, environmentCanvas.height], [1, 1]);
  assert.equal(r.material.getDiagnostics(f).environmentPrefilterStatus, 'ready');
  const levels = r.textureWrites.filter(w => w.destination.texture.label === 'ulg-worker-native-environment-prefilter');
  assert.equal(levels.length, 9);
  assert.deepEqual(levels.map(l => l.destination.mipLevel), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  await r.material.prepare(f, [640, 480]);
  const optics = r.bindGroups.findLast(g => g.entries.some(e => e.binding === 4 && e.resource.texture));
  assert.equal(optics.entries[2].resource.texture.label, 'ulg-worker-native-environment-prefilter');
  assert.equal(optics.entries[3].resource.addressModeU, 'repeat');
  assert.equal(r.material.drawBackground(r.pass, f), true);
  const cover = r.writes.findLast(w => w.buffer.label === 'ulg-worker-native-background-uniform');
  assert.ok(Math.abs(new Float32Array(cover.bytes.buffer)[0] - 2 / 3) < 1e-6);
  assert.equal(r.externalCopies.length, 0);
  assert.equal(r.textureWrites.filter(w => w.destination.texture.label === 'ulg-worker-native-background-image').length, 1);
  r.material.dispose(); await settle();
  assert.ok(r.textures.every(texture => texture.destroyCount === 1));
});

test('oversized backgrounds use the exact native 2048/device-limit cap and release resized image backing', async () => {
  for (const [sourceSize, limit, expected] of [
    [[8000, 4000], 16384, [2048, 1024]],
    [[2000, 8000], 1024, [256, 1024]],
    [[8000, 3000], undefined, [2048, 768]]
  ]) {
    let closes = 0, resizeCanvas; const resizedDraws = [];
    const r = rig({
      fetchImage: async () => ({ ok: true, blob: async () => ({}) }),
      decodeImage: async () => ({ width: sourceSize[0], height: sourceSize[1], close() { closes++; } }),
      createBackgroundCanvas: (width, height) => {
        assert.deepEqual([width, height], expected);
        resizeCanvas = { width, height, getContext: () => ({ drawImage: (...args) => resizedDraws.push(args),
          getImageData: () => ({ data: new Uint8ClampedArray(width * height * 4) }) }) };
        return resizeCanvas;
      },
      createEnvironmentCanvas: () => { throw new Error('unused environment fixture'); }
    });
    r.device.limits = { maxTextureDimension2D: limit };
    const f = frame(input({ backgroundImageUrl: '/large.jpg' }));
    await r.material.prepare(f, [640, 480]); await settle();
    assert.equal(r.material.getDiagnostics(f).backgroundStatus, 'ready');
    assert.deepEqual(r.textures.find(t => t.label === 'ulg-worker-native-background-image').size, [...expected, 1]);
    assert.deepEqual(r.textureWrites.find(w => w.destination.texture.label === 'ulg-worker-native-background-image').size, [...expected, 1]);
    assert.equal(r.externalCopies.length, 0);
    assert.deepEqual(resizedDraws[0].slice(1), [0, 0, ...expected]);
    assert.deepEqual([resizeCanvas.width, resizeCanvas.height], [1, 1]);
    assert.equal(closes, 1);
    assert.equal(r.material.drawBackground(r.pass, f), true);
    r.material.dispose(); await settle();
    assert.ok(r.textures.every(texture => texture.destroyCount === 1));
  }
});

test('background uploads cold RGBA bytes before canvas disposal, preserving page-native row padding and color values', async () => {
  for (const width of [3, 64]) {
    const height = 2, events = [], pixels = new Uint8ClampedArray(width * height * 4);
    for (let index = 0; index < pixels.length; index++) pixels[index] = (index * 7 + 13) % 256;
    let canvasWidth = width, canvasHeight = height;
    const r = rig({ fetchImage: async () => ({ ok: true, blob: async () => ({}) }),
      decodeImage: async () => ({ width, height, close() { events.push('bitmap-close'); } }),
      createBackgroundCanvas: (w, h) => {
        assert.deepEqual([w, h], [width, height]);
        return {
          set width(value) { canvasWidth = value; events.push('canvas-shrink'); },
          set height(value) { canvasHeight = value; },
          getContext(kind, options) {
            assert.equal(kind, '2d');
            assert.deepEqual(options, { willReadFrequently: true });
            return {
              drawImage(_bitmap, ...args) { assert.deepEqual(args, [0, 0, width, height]); events.push('draw-image'); },
              getImageData(...args) { assert.deepEqual(args, [0, 0, width, height]); events.push('read-cold-image'); return { data: pixels }; }
            };
          }
        };
      },
      createEnvironmentCanvas: () => { throw new Error('environment omitted in image-upload fixture'); }
    });
    const writeTexture = r.device.queue.writeTexture;
    r.device.queue.writeTexture = (...args) => { events.push('write-texture'); writeTexture(...args); };
    const f = frame(input({ backgroundImageUrl: '/colored.jpg' }));
    await r.material.prepare(f, [640, 480]); await settle();
    assert.equal(r.material.getDiagnostics(f).backgroundStatus, 'ready');
    const upload = r.textureWrites.find(w => w.destination.texture.label === 'ulg-worker-native-background-image');
    const rowBytes = Math.ceil(width * 4 / 256) * 256;
    assert.deepEqual(upload.layout, { bytesPerRow: rowBytes, rowsPerImage: height });
    assert.deepEqual(upload.size, [width, height, 1]);
    assert.equal(upload.destination.texture.usage, 4 | 2);
    for (let row = 0; row < height; row++) {
      assert.deepEqual([...upload.values.slice(row * rowBytes, row * rowBytes + width * 4)],
        [...pixels.slice(row * width * 4, (row + 1) * width * 4)]);
      assert.ok(upload.values.slice(row * rowBytes + width * 4, (row + 1) * rowBytes).every(value => value === 0));
    }
    assert.deepEqual(events, ['draw-image', 'read-cold-image', 'write-texture', 'canvas-shrink', 'bitmap-close']);
    assert.deepEqual([canvasWidth, canvasHeight], [1, 1]);
    assert.equal(r.externalCopies.length, 0);
    assert.equal(r.material.drawBackground(r.pass, f), true);
    const group = r.actions.find(a => a[0] === 'group')[2];
    assert.equal(group.entries[0].resource.texture, upload.destination.texture);
    r.material.dispose();
  }
});

test('failed resize or texture upload releases both bitmap and resize canvas without blocking physics', async () => {
  for (const failure of ['resize', 'upload']) {
    let closes = 0, resizeCanvas;
    const r = rig({ fetchImage: async () => ({ ok: true, blob: async () => ({}) }),
      decodeImage: async () => ({ width: 4000, height: 2000, close() { closes++; } }),
      createBackgroundCanvas: (width, height) => {
        resizeCanvas = { width, height, getContext: () => failure === 'resize' ? null : {
          drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(width * height * 4) }) } };
        return resizeCanvas;
      } });
    if (failure === 'upload') r.device.queue.writeTexture = () => { throw new Error('upload failed'); };
    const f = frame(input({ backgroundImageUrl: '/large.jpg' }));
    await r.material.prepare(f, [640, 480]); await settle();
    assert.equal(closes, 1); assert.deepEqual([resizeCanvas.width, resizeCanvas.height], [1, 1]);
    assert.equal(r.material.getDiagnostics(f).backgroundStatus, 'failed');
    assert.equal(r.material.draw(r.pass, f, surface(), { inverse: identity }), true);
    r.material.dispose(); await settle();
    assert.ok(r.textures.every(texture => texture.destroyCount === 1));
  }
});

test('prefilter failure preserves a successfully decoded background and reports analytic lighting fallback', async () => {
  const r = rig({ fetchImage: async () => ({ ok: true, blob: async () => ({}) }),
    decodeImage: async () => ({ width: 2, height: 2, close() {} }),
    createEnvironmentCanvas: () => { throw new Error('no image sampler'); } });
  const f = frame(input({ backgroundImageUrl: '/scene.jpg' }));
  await r.material.prepare(f, [640, 480]); await settle();
  const diagnostics = r.material.getDiagnostics(f);
  assert.equal(diagnostics.backgroundStatus, 'ready');
  assert.equal(diagnostics.environmentPrefilterStatus, 'failed');
  assert.equal(diagnostics.environmentLightingSource, 'native-analytic-fallback');
  assert.equal(r.material.drawBackground(r.pass, f), true);
  r.material.dispose();
});

test('HTTP and decode failures settle as visible diagnostics without blocking geometry or leaking images', async () => {
  for (const failure of ['http', 'decode']) {
    const r = rig({ fetchImage: async () => ({ ok: failure !== 'http', status: 404, blob: async () => ({}) }),
      decodeImage: async () => { throw new Error('unsupported bitmap'); } });
    const f = frame(input({ backgroundImageUrl: '/scene.jpg' }));
    await r.material.prepare(f, [640, 480]); await settle();
    assert.equal(r.material.getDiagnostics(f).backgroundStatus, 'failed');
    assert.match(r.material.getDiagnostics(f).backgroundError, failure === 'http' ? /HTTP 404/ : /unsupported bitmap/);
    assert.equal(r.material.draw(r.pass, f, surface(), { inverse: identity }), true);
    assert.equal(r.externalCopies.length, 0);
    r.material.dispose(); await settle();
    assert.ok([...r.buffers, ...r.textures].every(resource => resource.destroyCount === 1));
  }
});

test('appearance changes and viewport resize rebuild only presentation resources, retaining optical uploads', async () => {
  const fetching = deferred(); let requestedUrl, aborted = false;
  const r = rig({ fetchImage: (url, { signal }) => {
    requestedUrl = url; signal.addEventListener('abort', () => { aborted = true; }); return fetching.promise;
  } });
  const f = frame(input({ backgroundImageUrl: '/old.jpg' }));
  await r.material.prepare(f, [640, 480]); await settle();
  assert.equal(requestedUrl, '/old.jpg');
  const oldTargets = r.textures.filter(t => [
    'ulg-worker-native-scene-copy',
    'ulg-worker-native-back-depth',
    'ulg-worker-native-opaque-depth'
  ].includes(t.label));
  assert.equal(oldTargets.length, 3);
  f.nativeSurfaceAppearance = { backgroundImageUrl: null, backgroundColor: '#123456' };
  await r.material.prepare(f, [800, 600]); await settle();
  assert.equal(aborted, true);
  assert.equal(r.material.getDiagnostics(f).backgroundStatus, 'not-requested');
  assert.equal(r.buffers.filter(b => b.label === 'ulg-optical-material-records').length, 1);
  assert.ok(oldTargets.every(t => t.destroyCount === 1));
  const copies = [];
  const encoderStub = { copyTextureToTexture: (...args) => copies.push(args) };
  r.material.copySceneColor(encoderStub, { label: 'canvas' });
  assert.equal(r.material.copyOpaqueDepth(encoderStub, { label: 'opaque-depth' }), true);
  assert.deepEqual(copies[0][2], [800, 600]);
  assert.equal(copies[1][0].texture.label, 'opaque-depth');
  assert.equal(copies[1][1].texture.label, 'ulg-worker-native-opaque-depth');
  assert.deepEqual(copies[1][2], [800, 600]);
  assert.equal(r.material.backDepthView().texture.label, 'ulg-worker-native-back-depth');
  const s = surface();
  assert.equal(r.material.draw(r.pass, f, s, { inverse: identity, refractive: true, hasOpaqueDepth: true }), true);
  assert.equal(r.material.draw(r.pass, f, s, { inverse: identity, refractive: true, hasOpaqueDepth: false }), true);
  const group1Draws = r.actions.filter(a => a[0] === 'group' && a[1] === 1).slice(-2).map(a => a[2]);
  assert.equal(group1Draws[0].entries[5].resource.texture.label, 'ulg-worker-native-opaque-depth');
  assert.equal(group1Draws[1].entries[5].resource.texture.label, 'ulg-worker-native-dummy-opaque-depth');
  fetching.resolve({ ok: true }); await settle();
  assert.equal(r.externalCopies.length, 0);
  await assert.rejects(r.material.prepare(f, [Infinity, 1]), /viewport unavailable/);
  r.material.dispose(); await settle();
  assert.ok([...r.buffers, ...r.textures].every(resource => resource.destroyCount === 1));
});

test('late decoded imagery cannot upload or trigger a redraw after its frame retires', async () => {
  const decoding = deferred(); let started = false, closes = 0, notifications = 0;
  const r = rig({ fetchImage: async () => ({ ok: true, blob: async () => ({}) }),
    decodeImage: () => { started = true; return decoding.promise; },
    onAppearanceReady: () => notifications++ });
  const f = frame(input({ backgroundImageUrl: '/scene.jpg' }));
  await r.material.prepare(f, [640, 480]); await settle(); assert.equal(started, true);
  r.material.dispose();
  decoding.resolve({ width: 2, height: 2, close() { closes++; } }); await settle();
  assert.equal(closes, 1); assert.equal(r.externalCopies.length, 0); assert.equal(notifications, 0);
  assert.ok([...r.buffers, ...r.textures].every(resource => resource.destroyCount === 1));
});

test('clear values retain display-space encoding and never admit nonfinite channels', async () => {
  const r = rig(); await r.material.ready;
  assert.deepEqual(r.material.clearValue(frame()), { r: 32 / 255, g: 64 / 255, b: 128 / 255, a: 1 });
  const f = frame(); f.nativeSurfaceAppearance = { backgroundClearValue: { r: 0.1, g: 0.2, b: 0.3, a: 1 } };
  assert.deepEqual(r.material.clearValue(f), { r: 0.1, g: 0.2, b: 0.3, a: 1 });
  f.nativeSurfaceAppearance.backgroundClearValue.r = NaN;
  assert.deepEqual(r.material.clearValue(f), { r: 0, g: 0, b: 0, a: 1 });
  r.material.dispose();
});
