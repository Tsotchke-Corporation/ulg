import assert from 'node:assert/strict';
import test from 'node:test';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_WEBGPU === '1';
const BASE_URL = process.env.ULG_ELEMENTS_LAB_BASE_URL || 'https://127.0.0.1:5173/';

test('native Vulkan refraction rejects foreground opaque occluders (depth24plus copyOpaqueDepth) while refracting submerged objects behind water', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_WEBGPU=1 to run on native Vulkan WebGPU',
  timeout: 180_000
}, async (t) => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: [
      '--use-angle=vulkan',
      '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu',
      '--ignore-gpu-blocklist'
    ]
  });
  let result;
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    result = await page.evaluate(async () => {
      const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) return { status: 'unsupported' };
      const device = await adapter.requestDevice();
      const uncapturedErrors = [];
      device.addEventListener('uncapturederror', (ev) => {
        uncapturedErrors.push(ev.error?.message || String(ev.error));
      });
      device.pushErrorScope('validation');

      const matMod = await import('/src/services/workerOwnedNativeSurfaceMaterial.js');
      const optMod = await import('/src/runtime/material/opticalGpuBuffers.js');

      const width = 128;
      const height = 128;
      const format = 'rgba8unorm';
      const depthFormat = 'depth24plus';

      const material = matMod.createWorkerOwnedNativeSurfaceMaterial({
        device,
        format,
        depthFormat
      });
      await material.ready;

      // Optical table: one clear refractive dielectric matching OpticalMaterialRecord layout
      // (materialId=1, phaseId=2, IOR=1.55, transmission=0.98, blocked=0, status=1)
      const recFloats = optMod.OPTICAL_GPU_RECORD_FLOATS;
      const specFloats = optMod.OPTICAL_GPU_SPECTRAL_SAMPLE_FLOATS;
      const records = new Float32Array(recFloats);
      // Row 0: material_id, phase_id, spectral_offset, spectral_count
      records[0] = 1; records[1] = 2; records[2] = 0; records[3] = 0;
      // Row 1: base_color_linear (r, g, b), metalness
      records[4] = 0.95; records[5] = 0.98; records[6] = 1.0; records[7] = 0.0;
      // Row 2: roughness, transmission, opacity, ior
      records[8] = 0.04; records[9] = 0.98; records[10] = 1.0; records[11] = 1.55;
      // Row 3: attenuation_linear (r, g, b), attenuation_distance_m
      records[12] = 0.98; records[13] = 0.98; records[14] = 0.98; records[15] = 10.0;
      // Row 4: absorption, scattering, render_model_id (2), vertex_color_policy_id (1)
      records[16] = 0.01; records[17] = 0.0; records[18] = 2.0; records[19] = 1.0;
      // Row 5: optical_depth, blocked (0=valid), status (1=ready), optical_state_id (0)
      records[20] = 0.0; records[21] = 0.0; records[22] = 1.0; records[23] = 0.0;

      const opticalTable = {
        schema: optMod.ULG_OPTICAL_GPU_TABLE_SCHEMA,
        recordCount: 1,
        recordStrideFloats: recFloats,
        recordStrideBytes: recFloats * 4,
        spectralSampleCount: 0,
        spectralSampleStrideFloats: specFloats,
        spectralSampleStrideBytes: specFloats * 4,
        records,
        spectralSamples: new Float32Array(0)
      };

      const identity = [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
      ];

      // Octahedral snorm16x2 normal packer matching compact_packed_normal in nativeSurfaceMaterialWgsl.js
      const packOctNormal = (nx, ny, nz) => {
        const invL = 1 / Math.hypot(nx, ny, nz);
        let x = nx * invL;
        let y = ny * invL;
        const z = nz * invL;
        const sum = Math.abs(x) + Math.abs(y) + Math.abs(z);
        x /= sum;
        y /= sum;
        if (z < 0) {
          const ox = (1 - Math.abs(y)) * (x >= 0 ? 1 : -1);
          const oy = (1 - Math.abs(x)) * (y >= 0 ? 1 : -1);
          x = ox;
          y = oy;
        }
        const sx = Math.max(-32767, Math.min(32767, Math.round(x * 32767))) & 0xffff;
        const sy = Math.max(-32767, Math.min(32767, Math.round(y * 32767))) & 0xffff;
        return ((sy << 16) | sx) >>> 0;
      };

      // With identity OpenGL-style view_projection, vs_main maps clip.z = world.z * 0.5 + 0.5:
      //   zFront = 0.00 -> WebGPU depth 0.50
      //   zBack  = 0.40 -> WebGPU depth 0.70
      const makeQuadSurface = ({ zFront, zBack, nx, ny, nz }) => {
        const frontOct = packOctNormal(nx, ny, nz);
        const backOct = packOctNormal(0, 0, 1);
        // Front quad CCW (visible to back-culled front pass) + Back quad CW (visible to front-culled back pass)
        const pos = new Float32Array([
          // Front quad (6 verts, covers [-0.95, 0.95]^2 at zFront)
          -0.95, -0.95, zFront, 1,  0.95, -0.95, zFront, 1,  0.95,  0.95, zFront, 1,
          -0.95, -0.95, zFront, 1,  0.95,  0.95, zFront, 1, -0.95,  0.95, zFront, 1,
          // Back quad (6 verts, reversed winding so front-culling keeps it for backDepth pass)
          -0.95, -0.95, zBack, 1,   0.95,  0.95, zBack, 1,   0.95, -0.95, zBack, 1,
          -0.95, -0.95, zBack, 1,  -0.95,  0.95, zBack, 1,   0.95,  0.95, zBack, 1
        ]);
        const nrm = new Uint32Array([
          frontOct, frontOct, frontOct, frontOct, frontOct, frontOct,
          backOct, backOct, backOct, backOct, backOct, backOct
        ]);
        const posBuf = device.createBuffer({ size: pos.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
        const nrmBuf = device.createBuffer({ size: nrm.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
        const indBuf = device.createBuffer({ size: 16, usage: GPUBufferUsage.INDIRECT | GPUBufferUsage.COPY_DST });
        const uniBuf = device.createBuffer({ size: matMod.WORKER_NATIVE_SURFACE_UNIFORM_BYTES, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        device.queue.writeBuffer(posBuf, 0, pos);
        device.queue.writeBuffer(nrmBuf, 0, nrm);
        device.queue.writeBuffer(indBuf, 0, new Uint32Array([12, 1, 0, 0]));
        return {
          descriptor: { surfaceIndex: 0, isovalue: 0.5 },
          metadata: { materialId: 1, phaseId: 2, opticalStateId: 0, density: 1000, transparencyClassId: 2, depthWriteFlag: 1, renderOrder: 1 },
          uniformBuffer: uniBuf,
          translation: {
            surfaceVertices: {
              compactPositionRowsBuffer: posBuf,
              compactNormalRowsBuffer: nrmBuf,
              compactPositionRowsVertexCount: 12,
              compactPositionRowsStrideFloats: 4
            },
            surfaceDraw: { drawIndirectRowsBuffer: indBuf, compactPositionRowsStrideFloats: 4 },
            positionTransform: { enabled: false },
            positionClamp: { enabled: false }
          },
          destroy() { posBuf.destroy(); nrmBuf.destroy(); indBuf.destroy(); uniBuf.destroy(); }
        };
      };

      // Opaque quad helper shader to draw pure-BLUE background + pure-RED occluder at arbitrary Z depth
      const opaqueShader = device.createShaderModule({
        code: /* wgsl */ `
          struct QuadU { rect: vec4<f32>, color_z: vec4<f32> };
          @group(0) @binding(0) var<uniform> q: QuadU;
          @vertex fn vs(@builtin(vertex_index) vid: u32) -> @builtin(position) vec4<f32> {
            var corners = array<vec2<f32>, 6>(
              vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 0.0), vec2<f32>(1.0, 1.0),
              vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 1.0), vec2<f32>(0.0, 1.0)
            );
            let c = corners[vid];
            let x = mix(q.rect.x, q.rect.z, c.x);
            let y = mix(q.rect.y, q.rect.w, c.y);
            return vec4<f32>(x, y, q.color_z.w, 1.0);
          }
          @fragment fn fs() -> @location(0) vec4<f32> {
            return vec4<f32>(q.color_z.rgb, 1.0);
          }
        `
      });
      const opaquePipe = await device.createRenderPipelineAsync({
        layout: 'auto',
        vertex: { module: opaqueShader, entryPoint: 'vs' },
        fragment: { module: opaqueShader, entryPoint: 'fs', targets: [{ format }] },
        primitive: { topology: 'triangle-list' },
        depthStencil: { format: depthFormat, depthWriteEnabled: true, depthCompare: 'less-equal' }
      });

      const colorTex = device.createTexture({
        size: [width, height],
        format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
      });
      const depthTex = device.createTexture({
        size: [width, height],
        format: depthFormat,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.TEXTURE_BINDING
      });
      const bgUniBuf = device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      const redUniBuf = device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      const bgBg = device.createBindGroup({ layout: opaquePipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: bgUniBuf } }] });
      const redBg = device.createBindGroup({ layout: opaquePipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: redUniBuf } }] });

      // Wait: check refraction ray sign!
      // Camera at (0, 0, -2) looking toward +Z (identity VP maps z in [0, 1] -> WebGPU depth [0, 1]).
      // view_dir = normalize(cam - world) = (0, 0, -1). Incident = -view_dir = (0, 0, +1).
      // For Snell refraction with normal pointing toward camera (-Z) tilted slightly left (-0.55, 0, -0.835):
      // refract((0,0,1), (-0.55, 0, -0.835), 1/1.55) bends toward -normal = (+0.55, 0, +0.835), i.e. +X (RIGHT)!
      // Front face at z = 0.50 (needs CCW winding for +Z camera? Wait: in WebGPU NDC +X right, +Y up,
      // front-facing CCW in screen space has normal pointing toward -Z in LH/WebGPU NDC!).
      // Let's supply the front quad facing -Z (camera at z = -2) so normal (-0.55, 0, -0.835) has dot(normal, view_dir) > 0!
      const waterSurface = makeQuadSurface({
        zFront: 0.0,
        zBack: 0.40,
        nx: -0.58,
        ny: 0.0,
        nz: -0.815
      });

      const frame = {
        viewProjectionMatrix: identity,
        cameraPositionM: [0, 0, -2.0],
        boxDimsM: [4, 4, 4],
        drawMotionAgeS: 0,
        motionField: null,
        request: {
          nativeSurfaceMaterial: {
            schema: matMod.WORKER_NATIVE_SURFACE_MATERIAL_SCHEMA,
            lightingProfile: { nativeAmbientSuppression: 0, nativeDirectSuppression: 0, nativeEnvironmentSuppression: 0 },
            backgroundClearValue: { r: 0, g: 0, b: 0, a: 1 },
            opticalTable
          }
        }
      };
      await material.prepare(frame, [width, height]);

      const readPixel = async (px, py) => {
        const bytesPerRow = Math.ceil((width * 4) / 256) * 256;
        const readBuf = device.createBuffer({ size: bytesPerRow * height, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
        const enc = device.createCommandEncoder();
        enc.copyTextureToBuffer({ texture: colorTex }, { buffer: readBuf, bytesPerRow }, [width, height]);
        device.queue.submit([enc.finish()]);
        await readBuf.mapAsync(GPUMapMode.READ);
        const bytes = new Uint8Array(readBuf.getMappedRange().slice(0));
        readBuf.unmap();
        readBuf.destroy();
        const off = py * bytesPerRow + px * 4;
        return [bytes[off] / 255, bytes[off + 1] / 255, bytes[off + 2] / 255];
      };

      const renderCase = async ({ redDepth, useOpaqueDepthRejection, shiftX = 0, drawRed = true }) => {
        // Pure-BLUE background across entire viewport at depth 0.90
        device.queue.writeBuffer(bgUniBuf, 0, new Float32Array([-1, -1, 1, 1, 0.02, 0.12, 0.95, 0.90]));
        // Pure-RED opaque wall occupying x in [0.02 + shiftX, 0.90 + shiftX] at redDepth
        device.queue.writeBuffer(redUniBuf, 0, new Float32Array([0.02 + shiftX, -0.95, 0.90 + shiftX, 0.95, 0.98, 0.04, 0.04, redDepth]));

        const enc = device.createCommandEncoder();
        const opPass = enc.beginRenderPass({
          colorAttachments: [{ view: colorTex.createView(), clearValue: { r: 0, g: 0, b: 0, a: 1 }, loadOp: 'clear', storeOp: 'store' }],
          depthStencilAttachment: { view: depthTex.createView(), depthClearValue: 1.0, depthLoadOp: 'clear', depthStoreOp: 'store' }
        });
        opPass.setPipeline(opaquePipe);
        opPass.setBindGroup(0, bgBg);
        opPass.draw(6);
        if (drawRed) {
          opPass.setBindGroup(0, redBg);
          opPass.draw(6);
        }
        opPass.end();

        material.copySceneColor(enc, colorTex);
        const copiedOpaqueDepth = useOpaqueDepthRejection
          ? material.copyOpaqueDepth(enc, depthTex)
          : false;

        const backPass = enc.beginRenderPass({
          colorAttachments: [],
          depthStencilAttachment: { view: material.backDepthView(), depthClearValue: 1.0, depthLoadOp: 'clear', depthStoreOp: 'store' }
        });
        material.draw(backPass, frame, waterSurface, { inverse: identity, backface: true });
        backPass.end();

        const frontPass = enc.beginRenderPass({
          colorAttachments: [{ view: colorTex.createView(), loadOp: 'load', storeOp: 'store' }],
          depthStencilAttachment: { view: depthTex.createView(), depthLoadOp: 'load', depthStoreOp: 'store' }
        });
        material.draw(frontPass, frame, waterSurface, { inverse: identity, refractive: true, hasOpaqueDepth: copiedOpaqueDepth });
        frontPass.end();

        device.queue.submit([enc.finish()]);
        await device.queue.onSubmittedWorkDone();
        // Sample water pixel 2 px to the LEFT of the red wall edge (x_ndc = 0.02 + shiftX -> px = floor((x+1)*0.5*width))
        const edgePx = Math.floor(((0.02 + shiftX) + 1) * 0.5 * width);
        return readPixel(edgePx - 2, Math.floor(height * 0.5));
      };

      const pureBlueBaseline = await renderCase({ redDepth: 0.90, useOpaqueDepthRejection: true, shiftX: 0, drawRed: false });
      const fgRejected = await renderCase({ redDepth: 0.25, useOpaqueDepthRejection: true, shiftX: 0 });
      const fgUnfilteredControl = await renderCase({ redDepth: 0.25, useOpaqueDepthRejection: false, shiftX: 0 });
      const submergedRefracted = await renderCase({ redDepth: 0.82, useOpaqueDepthRejection: true, shiftX: 0 });
      const pureBlueShifted = await renderCase({ redDepth: 0.90, useOpaqueDepthRejection: true, shiftX: -0.25, drawRed: false });
      const fgRejectedShifted = await renderCase({ redDepth: 0.25, useOpaqueDepthRejection: true, shiftX: -0.25 });
      const submergedShifted = await renderCase({ redDepth: 0.82, useOpaqueDepthRejection: true, shiftX: -0.25 });

      const validationError = await device.popErrorScope();
      waterSurface.destroy();
      colorTex.destroy();
      depthTex.destroy();
      bgUniBuf.destroy();
      redUniBuf.destroy();
      material.dispose();
      device.destroy();

      return {
        status: 'ok',
        pureBlueBaseline,
        fgRejected,
        fgUnfilteredControl,
        submergedRefracted,
        pureBlueShifted,
        fgRejectedShifted,
        submergedShifted,
        validationError: validationError ? validationError.message : null,
        uncapturedErrors
      };
    });
  } finally {
    await browser.close();
  }

  if (result.status === 'unsupported') return;
  console.log('[native-refraction-fg-rejection]', JSON.stringify(result));
  assert.equal(result.validationError, null, `WebGPU validation error: ${result.validationError}`);
  assert.deepEqual(result.uncapturedErrors, []);

  // 1. Control proves without opaque-depth rejection, the foreground red wall DOES bleed through water!
  assert.ok(
    result.fgUnfilteredControl[0] > result.pureBlueBaseline[0] + 0.50 && result.fgUnfilteredControl[0] > 0.70,
    `Control without opaque-depth rejection must exhibit foreground red bleed (got ${JSON.stringify(result.fgUnfilteredControl)} vs pureBlue ${JSON.stringify(result.pureBlueBaseline)})`
  );
  // 2. With opaque-depth rejection ON, foreground red occluder (depth 0.25 < water 0.50) is REJECTED to exact blue baseline!
  assert.ok(
    Math.abs(result.fgRejected[0] - result.pureBlueBaseline[0]) < 0.02
      && Math.abs(result.fgRejected[2] - result.pureBlueBaseline[2]) < 0.02
      && result.fgRejected[2] > result.fgRejected[0] * 3.0,
    `Production foreground rejection must match pure-blue background with zero red bleed (got ${JSON.stringify(result.fgRejected)} vs pureBlue ${JSON.stringify(result.pureBlueBaseline)})`
  );
  // 3. When the exact same red wall is SUBMERGED behind water (depth 0.82 > 0.50), water MUST refract it faithfully!
  assert.ok(
    Math.abs(result.submergedRefracted[0] - result.fgUnfilteredControl[0]) < 0.02
      && result.submergedRefracted[0] > result.fgRejected[0] + 0.55,
    `Submerged red object behind water must refract cleanly (got ${JSON.stringify(result.submergedRefracted)} vs fg ${JSON.stringify(result.fgRejected)})`
  );
  // 4. Translation invariance: shifting the scene off-center preserves exact foreground rejection & submerged refraction!
  assert.ok(
    Math.abs(result.fgRejectedShifted[0] - result.pureBlueShifted[0]) < 0.02
      && result.submergedShifted[0] > result.fgRejectedShifted[0] + 0.55,
    `Off-origin shifted scene must preserve foreground rejection & submerged refraction (fg=${JSON.stringify(result.fgRejectedShifted)}, base=${JSON.stringify(result.pureBlueShifted)}, sub=${JSON.stringify(result.submergedShifted)})`
  );
  t.diagnostic('Real Vulkan depth24plus opaque-depth foreground refraction rejection & translation invariance verified');
});
