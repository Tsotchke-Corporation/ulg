import assert from 'node:assert/strict';
import { test } from 'node:test';

const RUN_NATIVE =
  process.env.ULG_RUN_NATIVE_PARTICIPATING_MEDIUM === '1';
const NATIVE_BASE_URL =
  process.env.ULG_PARTICIPATING_MEDIUM_BASE_URL
  || 'https://fastbox.tail5c077c.ts.net:5173/';
const NATIVE_CHROME =
  process.env.ULG_PARTICIPATING_MEDIUM_CHROME
  || '/usr/bin/google-chrome';

function assertClose(actual, expected, label, tolerance = 0.08) {
  assert.ok(
    Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected}, received ${actual}`
  );
}

test('native participating-medium pack and render preserve aggregate optical physics', {
  skip: RUN_NATIVE
    ? false
    : 'set ULG_RUN_NATIVE_PARTICIPATING_MEDIUM=1 for native Vulkan WebGPU',
  timeout: 120_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: NATIVE_CHROME,
    headless: true,
    args: [
      '--use-angle=vulkan',
      '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu',
      '--ignore-gpu-blocklist'
    ]
  });

  let native;
  try {
    const page = await browser.newPage();
    await page.goto(NATIVE_BASE_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000
    });
    native = await page.evaluate(async () => {
      if (!window.isSecureContext) {
        return { status: 'insecure-context', url: window.location.href };
      }
      const adapter = await navigator.gpu?.requestAdapter({
        powerPreference: 'high-performance'
      });
      if (!adapter) return { status: 'adapter-unavailable' };
      const device = await adapter.requestDevice();
      const uncapturedErrors = [];
      device.addEventListener('uncapturederror', (event) => {
        uncapturedErrors.push(event.error?.message || String(event.error));
      });
      device.pushErrorScope('validation');
      device.pushErrorScope('internal');
      device.pushErrorScope('out-of-memory');

      let result;
      const ownedBuffers = [];
      const ownedTextures = [];
      const packedFrames = [];
      let runtime = null;
      try {
        const medium = await import(
          `/src/runtime/sph/sphParticipatingMediumGpu.js?native=${Date.now()}`
        );
        const adapterModule = await import(
          '/src/runtime/sph/sphMarchingCubesSurfaceAdapter.js'
        );
        const identity = await import('/src/runtime/sph/sphGpuDeviceIdentity.js');
        const opticalIdentity = await import(
          '/src/runtime/sph/sphOpticalRouteIdentity.js'
        );
        const abi = await import('/ulg-gpu-abi/src/index.js');

        const resolution = 2;
        const cellCount = resolution ** 3;
        const rowFloats = abi.SPH_GPU_RENDER_FIELD_CELL_ROW_LAYOUT.length;
        const makeField = (routeMoments) => {
          const routeCount = routeMoments.length;
          const fieldRows = new Float32Array(routeCount * cellCount * rowFloats);
          const metadata = [];
          for (let routeIndex = 0; routeIndex < routeCount; routeIndex += 1) {
            const route = routeMoments[routeIndex];
            const fieldOffset = routeIndex * cellCount;
            for (let cellIndex = 0; cellIndex < cellCount; cellIndex += 1) {
              const offset = (fieldOffset + cellIndex) * rowFloats;
              fieldRows[offset] = 1;
              fieldRows[offset + abi.SPH_GPU_RENDER_FIELD_CELL_ROW_LANES.temperatureK]
                = route.temperatureK;
              fieldRows[
                offset
                + abi.SPH_GPU_RENDER_FIELD_CELL_ROW_LANES.scatteringOpticalDepth
              ] = route.scatteringOpticalDepth;
              fieldRows[
                offset
                + abi.SPH_GPU_RENDER_FIELD_CELL_ROW_LANES.absorptionOpticalDepth
              ] = route.absorptionOpticalDepth;
              fieldRows[
                offset
                + abi.SPH_GPU_RENDER_FIELD_CELL_ROW_LANES
                  .scatteringAsymmetryOpticalDepth
              ] = route.scatteringAsymmetryOpticalDepth;
            }
            const opticalStateId = 101 + routeIndex;
            metadata.push(Object.freeze({
              index: routeIndex,
              surfaceKey: `native-collective-route-${routeIndex}`,
              material: `native-medium-${routeIndex}`,
              phase: 'gas',
              renderKey: `native-route-${routeIndex}`,
              renderDomainId: 10 + routeIndex,
              renderDomainKey: `native-carrier-${routeIndex}`,
              resolution,
              fieldOffset,
              fieldCellCount: cellCount,
              isolation: 0.5,
              colorLinear: Object.freeze([...route.scatteringColorLinear]),
              opticalScatteringSourceLinear: Object.freeze([
                ...route.scatteringColorLinear
              ]),
              opticalStateId,
              collectiveOpticalRoute: true,
              collectiveOpticalRouteSchema:
                opticalIdentity.COLLECTIVE_DISPERSED_MEDIUM_OPTICAL_ROUTE_SCHEMA,
              collectiveOpticalRouteKey: `native-collective-route-${routeIndex}`,
              collectiveOpticalRouteId: opticalStateId,
              opticalResponseAuthorityFlag: 1,
              opticalResponseReady: true,
              opticalVisibilityFlag: 1,
              opticalBlockedFlag: 0
            }));
          }
          const fieldRowsBuffer = identity.tagWebGpuBufferDevice(
            device.createBuffer({
              label: 'native-participating-medium-field-rows',
              size: fieldRows.byteLength,
              usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
            }),
            device
          );
          ownedBuffers.push(fieldRowsBuffer);
          device.queue.writeBuffer(fieldRowsBuffer, 0, fieldRows);
          const renderField = {
            schema: abi.ULG_SPH_GPU_RENDER_FIELD_SCHEMA,
            backend: 'webgpu',
            surfaceCount: routeCount,
            totalFieldCells: routeCount * cellCount,
            surfaceTable: {
              schema: abi.ULG_SPH_GPU_RENDER_FIELD_SCHEMA,
              surfaceCount: routeCount,
              totalFieldCells: routeCount * cellCount,
              metadata
            },
            rowLayout: [...abi.SPH_GPU_RENDER_FIELD_CELL_ROW_LAYOUT],
            rowStrideFloats: rowFloats,
            fieldRowsBufferRetained: true,
            fieldRowsBuffer,
            fieldRowsBufferByteLength: fieldRows.byteLength,
            fieldPadding: 0.25,
            refEdgeM: 1
          };
          const surfaceDescriptors = metadata.map((routeMetadata, surfaceIndex) =>
            Object.freeze({
              descriptor: adapterModule.createUlgRenderFieldBufferVolumeDescriptor({
                device,
                renderField,
                surfaceIndex
              }),
              metadata: routeMetadata
            }));
          const descriptor = medium.createSphParticipatingMediumDescriptor({
            device,
            renderField,
            surfaceDescriptors
          });
          return { descriptor, fieldRowsBuffer };
        };

        const probeModule = device.createShaderModule({
          label: 'native-participating-medium-test-only-probe',
          code: /* wgsl */`
struct ProbeParams {
  resolution: u32,
  cell_count: u32,
  reserved: vec2<u32>,
};

@group(0) @binding(0) var optical_volume: texture_3d<f32>;
@group(0) @binding(1) var scattering_volume: texture_3d<f32>;
@group(0) @binding(2) var<storage, read> source_indirect: array<u32>;
@group(0) @binding(3) var<uniform> params: ProbeParams;
@group(0) @binding(4) var<storage, read_write> copied_texels: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> copied_indirect: array<u32>;

@compute @workgroup_size(4, 4, 4)
fn probe_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (any(global_id >= vec3<u32>(params.resolution))) {
    return;
  }
  let cell_index = global_id.x
    + global_id.y * params.resolution
    + global_id.z * params.resolution * params.resolution;
  let coordinate = vec3<i32>(global_id);
  copied_texels[cell_index] = textureLoad(optical_volume, coordinate, 0);
  copied_texels[params.cell_count + cell_index]
    = textureLoad(scattering_volume, coordinate, 0);
  if (cell_index == 0u) {
    for (var index = 0u; index < 4u; index += 1u) {
      copied_indirect[index] = source_indirect[index];
    }
  }
}
`
        });
        const probeCompilation = await probeModule.getCompilationInfo();
        const probeCompilationErrors = probeCompilation.messages
          .filter((message) => message.type === 'error')
          .map((message) => ({
            lineNum: message.lineNum,
            linePos: message.linePos,
            message: message.message
          }));
        const probePipeline = await device.createComputePipelineAsync({
          label: 'native-participating-medium-test-only-probe',
          layout: 'auto',
          compute: { module: probeModule, entryPoint: 'probe_main' }
        });

        const readPackedFrame = async (encoder, frame) => {
          const texelBytes = 2 * cellCount * 4 * Float32Array.BYTES_PER_ELEMENT;
          const copiedTexels = device.createBuffer({
            label: 'native-participating-medium-copied-texels',
            size: texelBytes,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
          });
          const copiedIndirect = device.createBuffer({
            label: 'native-participating-medium-copied-indirect',
            size: 4 * Uint32Array.BYTES_PER_ELEMENT,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
          });
          const texelReadback = device.createBuffer({
            label: 'native-participating-medium-texel-readback',
            size: texelBytes,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
          });
          const indirectReadback = device.createBuffer({
            label: 'native-participating-medium-indirect-readback',
            size: 4 * Uint32Array.BYTES_PER_ELEMENT,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
          });
          const params = device.createBuffer({
            label: 'native-participating-medium-probe-params',
            size: 4 * Uint32Array.BYTES_PER_ELEMENT,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
          });
          for (const buffer of [
            copiedTexels,
            copiedIndirect,
            texelReadback,
            indirectReadback,
            params
          ]) ownedBuffers.push(buffer);
          device.queue.writeBuffer(
            params,
            0,
            new Uint32Array([resolution, cellCount, 0, 0])
          );
          const bindGroup = device.createBindGroup({
            label: 'native-participating-medium-test-only-probe',
            layout: probePipeline.getBindGroupLayout(0),
            entries: [
              { binding: 0, resource: frame.opticalTexture.createView() },
              { binding: 1, resource: frame.scatteringTexture.createView() },
              { binding: 2, resource: { buffer: frame.drawIndirectBuffer } },
              { binding: 3, resource: { buffer: params } },
              { binding: 4, resource: { buffer: copiedTexels } },
              { binding: 5, resource: { buffer: copiedIndirect } }
            ]
          });
          const pass = encoder.beginComputePass({
            label: 'native-participating-medium-test-only-probe'
          });
          pass.setPipeline(probePipeline);
          pass.setBindGroup(0, bindGroup);
          pass.dispatchWorkgroups(1, 1, 1);
          pass.end();
          encoder.copyBufferToBuffer(
            copiedTexels,
            0,
            texelReadback,
            0,
            texelBytes
          );
          encoder.copyBufferToBuffer(
            copiedIndirect,
            0,
            indirectReadback,
            0,
            4 * Uint32Array.BYTES_PER_ELEMENT
          );
          return async () => {
            await Promise.all([
              texelReadback.mapAsync(GPUMapMode.READ),
              indirectReadback.mapAsync(GPUMapMode.READ)
            ]);
            const texels = Array.from(new Float32Array(
              texelReadback.getMappedRange()
            ));
            const indirect = Array.from(new Uint32Array(
              indirectReadback.getMappedRange()
            ));
            texelReadback.unmap();
            indirectReadback.unmap();
            return {
              optical: texels.slice(0, cellCount * 4),
              scattering: texels.slice(cellCount * 4),
              indirect
            };
          };
        };

        runtime = medium.createSphParticipatingMediumGpu(device, {
          colorFormat: 'rgba8unorm',
          depthFormat: 'depth24plus',
          maxOpticalDepth: 80
        });
        await runtime.ready;

        const packAndRead = async (routes) => {
          const field = makeField(routes);
          if (!field.descriptor.ok) {
            throw new Error(`descriptor blocked: ${field.descriptor.reason}`);
          }
          const encoder = device.createCommandEncoder({
            label: 'native-participating-medium-pack-and-probe'
          });
          const frame = await medium.encodeSphParticipatingMediumPack(
            runtime,
            encoder,
            field.descriptor
          );
          packedFrames.push(frame);
          const finishRead = await readPackedFrame(encoder, frame);
          device.queue.submit([encoder.finish()]);
          return {
            frame,
            descriptorStatus: field.descriptor.status,
            probe: await finishRead()
          };
        };

        const active = await packAndRead([
          {
            temperatureK: 300,
            scatteringOpticalDepth: 120,
            absorptionOpticalDepth: 30,
            scatteringAsymmetryOpticalDepth: 60,
            scatteringColorLinear: [1, 0.5, 0.25]
          },
          {
            temperatureK: 900,
            scatteringOpticalDepth: 40,
            absorptionOpticalDepth: 10,
            scatteringAsymmetryOpticalDepth: Number.NaN,
            scatteringColorLinear: [0, 0.5, 1]
          }
        ]);
        const empty = await packAndRead([
          {
            temperatureK: 300,
            scatteringOpticalDepth: 0,
            absorptionOpticalDepth: 0,
            scatteringAsymmetryOpticalDepth: Number.NaN,
            scatteringColorLinear: [1, 1, 1]
          }
        ]);
        const noRouteDescriptor = medium.createSphParticipatingMediumDescriptor({
          device,
          renderField: null,
          surfaceDescriptors: []
        });

        const renderPack = await packAndRead([
          {
            temperatureK: 500,
            scatteringOpticalDepth: 0.4,
            absorptionOpticalDepth: 0.1,
            scatteringAsymmetryOpticalDepth: 0.08,
            scatteringColorLinear: [0.8, 0.9, 1]
          },
          {
            temperatureK: 700,
            scatteringOpticalDepth: 0.2,
            absorptionOpticalDepth: 0.05,
            scatteringAsymmetryOpticalDepth: -0.02,
            scatteringColorLinear: [1, 0.8, 0.6]
          }
        ]);

        const width = 32;
        const height = 32;
        const paddedBytesPerRow = 256;
        const makeDepth = (label) => {
          const texture = device.createTexture({
            label,
            size: [width, height, 1],
            format: 'depth24plus',
            usage:
              GPUTextureUsage.RENDER_ATTACHMENT
              | GPUTextureUsage.TEXTURE_BINDING
          });
          ownedTextures.push(texture);
          return texture;
        };
        const makeColor = (label) => {
          const texture = device.createTexture({
            label,
            size: [width, height, 1],
            format: 'rgba8unorm',
            usage:
              GPUTextureUsage.RENDER_ATTACHMENT
              | GPUTextureUsage.COPY_SRC
          });
          ownedTextures.push(texture);
          return texture;
        };
        const farDepth = makeDepth('native-participating-medium-far-depth');
        const nearDepth = makeDepth('native-participating-medium-near-depth');
        const farColor = makeColor('native-participating-medium-far-color');
        const nearColor = makeColor('native-participating-medium-near-color');
        const farReadback = device.createBuffer({
          label: 'native-participating-medium-far-color-readback',
          size: paddedBytesPerRow * height,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        const nearReadback = device.createBuffer({
          label: 'native-participating-medium-near-color-readback',
          size: paddedBytesPerRow * height,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        ownedBuffers.push(farReadback, nearReadback);

        const renderEncoder = device.createCommandEncoder({
          label: 'native-participating-medium-depth-clipping-render'
        });
        for (const [depthTexture, depthValue] of [
          [farDepth, 1],
          [nearDepth, 0.5]
        ]) {
          const clear = renderEncoder.beginRenderPass({
            colorAttachments: [],
            depthStencilAttachment: {
              view: depthTexture.createView(),
              depthClearValue: depthValue,
              depthLoadOp: 'clear',
              depthStoreOp: 'store'
            }
          });
          clear.end();
        }
        const identityMatrix = [
          1, 0, 0, 0,
          0, 1, 0, 0,
          0, 0, 1, 0,
          0, 0, 0, 1
        ];
        const renderReceipts = [];
        for (const [colorTexture, depthTexture] of [
          [farColor, farDepth],
          [nearColor, nearDepth]
        ]) {
          const pass = renderEncoder.beginRenderPass({
            colorAttachments: [{
              view: colorTexture.createView(),
              clearValue: { r: 0, g: 0, b: 0, a: 0 },
              loadOp: 'clear',
              storeOp: 'store'
            }]
          });
          renderReceipts.push(await medium.encodeSphParticipatingMediumRender(
            runtime,
            pass,
            {
              packedFrame: renderPack.frame,
              inverseViewProjectionMatrix: identityMatrix,
              cameraPositionM: [0, 0, -2],
              viewportSize: [width, height],
              depthTextureView: depthTexture.createView(),
              lightDirection: [0, 0, -1],
              lightIntensity: 0,
              ambientIntensity: 0.5,
              stepCount: 64
            }
          ));
          pass.end();
        }
        for (const [texture, readback] of [
          [farColor, farReadback],
          [nearColor, nearReadback]
        ]) {
          renderEncoder.copyTextureToBuffer(
            { texture },
            { buffer: readback, bytesPerRow: paddedBytesPerRow, rowsPerImage: height },
            { width, height, depthOrArrayLayers: 1 }
          );
        }
        device.queue.submit([renderEncoder.finish()]);
        await Promise.all([
          farReadback.mapAsync(GPUMapMode.READ),
          nearReadback.mapAsync(GPUMapMode.READ)
        ]);
        const summarizeColor = (buffer) => {
          const bytes = new Uint8Array(buffer.getMappedRange());
          let alphaSum = 0;
          let alphaMax = 0;
          let rgbMax = 0;
          for (let y = 0; y < height; y += 1) {
            const rowOffset = y * paddedBytesPerRow;
            for (let x = 0; x < width; x += 1) {
              const offset = rowOffset + x * 4;
              rgbMax = Math.max(rgbMax, bytes[offset], bytes[offset + 1], bytes[offset + 2]);
              alphaMax = Math.max(alphaMax, bytes[offset + 3]);
              alphaSum += bytes[offset + 3];
            }
          }
          return {
            meanAlpha: alphaSum / (width * height * 255),
            maxAlpha: alphaMax / 255,
            maxRgb: rgbMax / 255
          };
        };
        const farRender = summarizeColor(farReadback);
        const nearRender = summarizeColor(nearReadback);
        farReadback.unmap();
        nearReadback.unmap();

        await device.queue.onSubmittedWorkDone();
        result = {
          status: 'ok',
          secureContext: window.isSecureContext,
          adapterInfo: adapter.info ? {
            vendor: adapter.info.vendor || null,
            architecture: adapter.info.architecture || null,
            device: adapter.info.device || null,
            description: adapter.info.description || null
          } : null,
          textureFormat: medium.SPH_PARTICIPATING_MEDIUM_TEXTURE_FORMAT,
          probeCompilationErrors,
          active: {
            descriptorStatus: active.descriptorStatus,
            probe: active.probe
          },
          empty: {
            descriptorStatus: empty.descriptorStatus,
            noRouteDescriptorStatus: noRouteDescriptor.status,
            probe: empty.probe
          },
          render: {
            receipts: renderReceipts,
            far: farRender,
            near: nearRender
          }
        };
      } catch (error) {
        result = {
          status: 'execution-failed',
          error: error?.stack || error?.message || String(error)
        };
      } finally {
        for (const frame of packedFrames) {
          try { frame.destroy(); } catch {}
        }
        try { runtime?.destroy(); } catch {}
        for (const texture of ownedTextures) {
          try { texture.destroy(); } catch {}
        }
        for (const buffer of ownedBuffers) {
          try { buffer.destroy(); } catch {}
        }
      }

      try { await device.queue.onSubmittedWorkDone(); } catch {}
      const outOfMemoryError = await device.popErrorScope();
      const internalError = await device.popErrorScope();
      const validationError = await device.popErrorScope();
      device.destroy();
      return {
        ...result,
        outOfMemoryError: outOfMemoryError?.message || null,
        internalError: internalError?.message || null,
        validationError: validationError?.message || null,
        uncapturedErrors
      };
    });
  } finally {
    await browser.close();
  }

  assert.equal(native.status, 'ok', JSON.stringify(native, null, 2));
  assert.equal(native.secureContext, true, JSON.stringify(native));
  assert.equal(native.textureFormat, 'rgba16float');
  assert.deepEqual(native.probeCompilationErrors, [], JSON.stringify(native));
  assert.equal(native.outOfMemoryError, null, JSON.stringify(native));
  assert.equal(native.internalError, null, JSON.stringify(native));
  assert.equal(native.validationError, null, JSON.stringify(native));
  assert.deepEqual(native.uncapturedErrors, [], JSON.stringify(native));

  assert.equal(native.active.descriptorStatus, 'participating-medium-ready');
  assert.deepEqual(native.active.probe.indirect, [3, 1, 0, 0]);
  for (let cell = 0; cell < 8; cell += 1) {
    const opticalOffset = cell * 4;
    const colorOffset = cell * 4;
    const optical = native.active.probe.optical.slice(
      opticalOffset,
      opticalOffset + 4
    );
    const color = native.active.probe.scattering.slice(
      colorOffset,
      colorOffset + 4
    );
    assertClose(optical[0], 64, `cell ${cell} scattering`);
    assertClose(optical[1], 16, `cell ${cell} absorption`);
    assertClose(optical[0] / optical[1], 4, `cell ${cell} thick ratio`, 0.01);
    assertClose(optical[2], 24, `cell ${cell} sanitized asymmetry moment`);
    assertClose(optical[3], 450, `cell ${cell} extinction-weighted temperature`, 0.5);
    assertClose(color[0], 48, `cell ${cell} red scattering moment`);
    assertClose(color[1], 32, `cell ${cell} green scattering moment`);
    assertClose(color[2], 28, `cell ${cell} blue scattering moment`);
    assert.equal(color[3], 0);
  }

  assert.equal(native.empty.descriptorStatus, 'participating-medium-ready');
  assert.equal(native.empty.noRouteDescriptorStatus, 'participating-medium-empty');
  assert.deepEqual(native.empty.probe.indirect, [0, 1, 0, 0]);
  assert.ok(native.empty.probe.optical.every((value) => value === 0));
  assert.ok(native.empty.probe.scattering.every((value) => value === 0));

  assert.equal(native.render.receipts.length, 2);
  assert.ok(native.render.receipts.every(
    (receipt) => receipt.status === 'participating-medium-render-encoded'
  ));
  assert.ok(native.render.far.maxRgb > 0, JSON.stringify(native.render));
  assert.ok(native.render.far.maxAlpha > 0, JSON.stringify(native.render));
  assert.ok(
    native.render.far.meanAlpha > native.render.near.meanAlpha + 0.1,
    `near opaque depth must reduce volume opacity: ${JSON.stringify(native.render)}`
  );
});
