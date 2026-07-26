import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SPH_GPU_RENDER_FIELD_CELL_FLOATS,
  SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS,
  SPH_GPU_RENDER_ROW_FLOATS,
  buildSphRenderFieldSurfaceTable
} from '../src/runtime/sph/sphRenderGpuKernel.js';
import {
  SPH_RENDER_FIELD_SOURCE_LOCAL_TESTING,
  SPH_RENDER_FIELD_SOURCE_LOCAL_MODE_DIAGNOSTIC_NO_READBACK,
  buildSphRenderFieldSourceLocalWebGpu,
  SOURCE_LOCAL_ACCUM_LANES,
  SPLAT_PHASE_SINGLE,
  SPLAT_PHASE_MOMENTS_ONLY,
  SPH_RENDER_FIELD_SOURCE_LOCAL_MODE_PRODUCTION,
  SPLAT_PHASE_SMEARED_PRIMARY
} from '../src/runtime/sph/sphRenderFieldSourceLocalGpu.js';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_RENDER_SOURCE_LOCAL === '1';
const NATIVE_BASE_URL = process.env.ULG_RENDER_SOURCE_LOCAL_BASE_URL
  || 'https://127.0.0.1:5174/';
const NATIVE_CHROME = process.env.ULG_RENDER_SOURCE_LOCAL_CHROME
  || '/usr/bin/google-chrome';

function fakeComputeDevice() {
  const buffers = [];
  const shaderModules = [];
  const bindGroups = [];
  const dispatches = [];
  const submissions = [];
  let mapAsyncCalls = 0;

  const device = {
    limits: {
      maxBufferSize: 1024 * 1024 * 1024,
      maxStorageBufferBindingSize: 1024 * 1024 * 1024
    },
    queue: {
      writeBuffer(buffer, offset, data) {
        buffer.writes.push({ offset, byteLength: data.byteLength ?? 0 });
      },
      submit(commands) {
        submissions.push(commands);
      },
      async onSubmittedWorkDone() {
        return undefined;
      }
    },
    createBuffer(descriptor) {
      const buffer = {
        ...descriptor,
        writes: [],
        destroyed: false,
        destroy() {
          this.destroyed = true;
        },
        async mapAsync() {
          mapAsyncCalls += 1;
          return undefined;
        },
        getMappedRange() {
          return new ArrayBuffer(this.size);
        },
        unmap() {}
      };
      buffers.push(buffer);
      return buffer;
    },
    createShaderModule(descriptor) {
      shaderModules.push(descriptor);
      return descriptor;
    },
    createBindGroupLayout(descriptor) {
      return descriptor;
    },
    createPipelineLayout(descriptor) {
      return descriptor;
    },
    createComputePipeline(descriptor) {
      const pipeline = {
        descriptor,
        getBindGroupLayout() {
          return { auto: true, label: `${descriptor.label}-auto-layout` };
        }
      };
      return pipeline;
    },
    createBindGroup(descriptor) {
      bindGroups.push(descriptor);
      return descriptor;
    },
    createCommandEncoder() {
      return {
        beginComputePass() {
          let currentPipeline = null;
          return {
            setPipeline(pipeline) {
              currentPipeline = pipeline;
            },
            setBindGroup() {},
            dispatchWorkgroups(x = 1, y = 1, z = 1) {
              dispatches.push({
                label: currentPipeline?.descriptor?.label ?? null,
                x,
                y,
                z
              });
            },
            end() {}
          };
        },
        copyBufferToBuffer() {},
        finish() {
          return { finished: true };
        }
      };
    }
  };

  return {
    device,
    buffers,
    shaderModules,
    bindGroups,
    dispatches,
    submissions,
    get mapAsyncCalls() {
      return mapAsyncCalls;
    }
  };
}

function renderRowsForSurface(surfaceTable) {
  const surface = surfaceTable.metadata[0];
  const rows = new Float32Array(SPH_GPU_RENDER_ROW_FLOATS);
  rows.set([
    2.5, 2.5, 2.5, 1,
    surface.materialId, surface.phaseId, 900, 1,
    1, 0.2, 1, surface.renderDomainId,
    1, 0.12, 1, 101325,
    0.25, 3, -2, 1
  ]);
  return rows;
}

function singleSurfaceTable() {
  return buildSphRenderFieldSurfaceTable([
    {
      surfaceKey: 'water-liquid',
      material: 'H2O',
      phase: 'liquid',
      renderKey: 'H2O',
      resolution: 8,
      isolation: 80,
      subtract: 24,
      radiusNorm: 0.05,
      colorLinear: [0.2, 0.6, 1]
    }
  ]);
}

test('generic source-local shadow builder emits standard v1 field rows without a dense particle loop', async () => {
  const surfaceTable = buildSphRenderFieldSurfaceTable([
    {
      surfaceKey: 'water-liquid',
      material: 'H2O',
      phase: 'liquid',
      renderKey: 'H2O',
      resolution: 8,
      isolation: 80,
      subtract: 24,
      particleRadiusScale: 1,
      colorLinear: [0.2, 0.6, 1]
    }
  ]);
  const { device, buffers, shaderModules, bindGroups, dispatches, submissions } = fakeComputeDevice();
  const result = await buildSphRenderFieldSourceLocalWebGpu({
    device,
    renderRows: renderRowsForSurface(surfaceTable),
    surfaceTable,
    particleCount: 1,
    maxSplatCellsPerSource: 343
  });

  assert.equal(result.schema, surfaceTable.schema);
  assert.equal(result.backend, 'webgpu-source-local-shadow');
  assert.equal(result.sourceLocalStrategy, 'shadow');
  assert.equal(result.sourceLocalShadowOnly, true);
  assert.equal(result.sourceLocalUsableForPresentation, false);
  assert.equal(result.renderFieldReadback, true);
  assert.equal(result.normalHotLoopReadbackFree, false);
  assert.equal(result.productEventCount, 0);
  assert.equal(result.fieldRows.length, surfaceTable.totalFieldCells * SPH_GPU_RENDER_FIELD_CELL_FLOATS);
  assert.deepEqual(result.rowLayout, [
    'density:f32',
    'paletteLinearR:f32',
    'paletteLinearG:f32',
    'paletteLinearB:f32',
    'temperatureK:f32',
    'reserved0:f32',
    'reserved1:f32',
    'reserved2:f32'
  ]);
  assert.ok(result.sourceLocalEstimatedCellVisits < result.sourceLocalDenseCellParticlePairs);
  assert.deepEqual(dispatches, [
    { label: 'ulg-sph-render-field-source-local-shadow-splat', x: 1, y: 1, z: 1 },
    { label: 'ulg-sph-render-field-source-local-shadow-resolve', x: 8, y: 1, z: 1 }
  ]);
  assert.equal(submissions.length, 3);
  assert.equal(bindGroups.length, 2);
  assert.equal(bindGroups[0].entries[2].resource.buffer.label, 'ulg-sph-render-field-source-local-accum');
  assert.equal(bindGroups[1].entries[2].resource.buffer.label, 'ulg-sph-render-field-source-local-cells');
  assert.ok(shaderModules.some((module) => /render_phase_weight/.test(module.code)));
  assert.ok(shaderModules.some((module) => /particle_radius_scale/.test(module.code)));
  assert.ok(shaderModules.some((module) => /row1\.z \* value/.test(module.code)));
  // Accumulation must be atomic and must detect overflow. It deliberately uses
  // atomicAdd rather than a compare-exchange retry loop: a metaball field is
  // maximally contended -- many particles write the same cells by construction
  // -- so a CAS loop makes every thread spin. atomicAdd is one instruction and
  // still returns the previous value, which is what the overflow check reads.
  assert.ok(shaderModules.some((module) => /atomicAdd\(destination, value\)/.test(module.code)));
  assert.ok(shaderModules.some((module) => /atomicStore\(overflow, 1u\)/.test(module.code)));
  assert.ok(
    !shaderModules.some((module) => /atomicCompareExchangeWeak/.test(module.code)),
    'the contended accumulation path must not reintroduce a CAS retry loop'
  );
  assert.ok(!shaderModules.some((module) => /for \(var particle_index/.test(module.code)));
  assert.match(SPH_RENDER_FIELD_SOURCE_LOCAL_TESTING.sphRenderFieldSourceLocalSplatWgsl, /phase_partitioned_metaball_strength/);
  assert.match(SPH_RENDER_FIELD_SOURCE_LOCAL_TESTING.sphRenderFieldSourceLocalResolveWgsl, /mean_temperature_k/);
  assert.ok(buffers.filter((buffer) => /source-local/.test(buffer.label)).every((buffer) => buffer.destroyed));
});

test('generic source-local diagnostic retains an owned no-readback field behind queue-fenced leases', async () => {
  const surfaceTable = buildSphRenderFieldSurfaceTable([
    {
      surfaceKey: 'water-liquid',
      material: 'H2O',
      phase: 'liquid',
      renderKey: 'H2O',
      resolution: 8,
      isolation: 80,
      subtract: 24,
      particleRadiusScale: 1,
      colorLinear: [0.2, 0.6, 1]
    }
  ]);
  const fake = fakeComputeDevice();
  const result = await buildSphRenderFieldSourceLocalWebGpu({
    device: fake.device,
    renderRows: renderRowsForSurface(surfaceTable),
    surfaceTable,
    particleCount: 1,
    sourceLocalMode: SPH_RENDER_FIELD_SOURCE_LOCAL_MODE_DIAGNOSTIC_NO_READBACK,
    readbackMode: 'no-full-readback',
    retainFieldRowsBuffer: true,
    retainSurfaceBuffer: true,
    waitForQueueCompletion: false,
    deferCleanup: true,
    useQueueFenceForCleanup: true,
    maxSplatCellsPerSource: 343
  });

  assert.equal(result.backend, 'webgpu-source-local-diagnostic');
  assert.equal(result.status, 'render-field-source-local-diagnostic-submitted');
  assert.equal(result.sourceLocalStrategy, 'diagnostic-no-readback');
  assert.equal(result.sourceLocalDiagnosticNoReadback, true);
  assert.equal(result.sourceLocalUsableForPresentation, false);
  assert.equal(result.sourceLocalEligible, false);
  assert.equal(result.sourceLocalOverflow, null);
  assert.equal(result.renderFieldReadback, false);
  assert.equal(result.fullReadbackPerformed, false);
  assert.equal(result.normalHotLoopReadbackFree, true);
  assert.equal(result.fieldRows.length, 0);
  assert.equal(result.fieldRowsBufferRetained, true);
  assert.equal(result.fieldRowsBufferOwnedByResult, true);
  assert.equal(result.surfaceBufferRetained, true);
  assert.equal(result.renderFieldDeferredCleanup, true);
  assert.equal(fake.mapAsyncCalls, 0);
  assert.equal(fake.submissions.length, 1);
  assert.deepEqual(fake.dispatches, [
    { label: 'ulg-sph-render-field-source-local-shadow-splat', x: 1, y: 1, z: 1 },
    { label: 'ulg-sph-render-field-source-local-shadow-resolve', x: 8, y: 1, z: 1 }
  ]);
  await fake.device.queue.onSubmittedWorkDone();
  await Promise.resolve();
  assert.equal(fake.buffers.find((buffer) => buffer.label === 'ulg-sph-render-field-source-local-accum').destroyed, true);
  assert.equal(result.fieldRowsBuffer.destroyed, false);
  assert.equal(result.surfaceBuffer.destroyed, false);
  assert.equal(result.residentBufferLeaseActiveLeaseCount, 2);

  result.destroyRenderFieldBuffers();
  assert.equal(result.fieldRowsBuffer.destroyed, false);
  assert.equal(result.surfaceBuffer.destroyed, false);
  result.releaseRenderFieldBufferLeases();
  result.destroyRenderFieldBuffers();
  assert.equal(result.fieldRowsBuffer.destroyed, true);
  assert.equal(result.surfaceBuffer.destroyed, true);
  assert.equal(result.residentBufferLeaseActiveLeaseCount, 0);
});

test('generic source-local builder routes normal no-readback and product inputs to exact dense GPU fallback', async () => {
  const surfaceTable = buildSphRenderFieldSurfaceTable([
    {
      surfaceKey: 'water-liquid',
      material: 'H2O',
      phase: 'liquid',
      renderKey: 'H2O',
      resolution: 8,
      isolation: 80,
      subtract: 24,
      radiusNorm: 0.05,
      colorLinear: [0.2, 0.6, 1]
    }
  ]);
  const noReadback = fakeComputeDevice();
  const noReadbackResult = await buildSphRenderFieldSourceLocalWebGpu({
    device: noReadback.device,
    renderRows: renderRowsForSurface(surfaceTable),
    surfaceTable,
    particleCount: 1,
    readbackMode: 'no-full-readback',
    waitForQueueCompletion: false
  });
  assert.equal(noReadbackResult.backend, 'webgpu');
  assert.equal(noReadbackResult.sourceLocalStrategy, 'dense-fallback');
  assert.equal(noReadbackResult.sourceLocalFallbackReason, 'shadow-parity-requires-full-readback');
  assert.equal(noReadbackResult.normalHotLoopReadbackFree, true);
  assert.ok(!noReadback.dispatches.some((entry) => /source-local/.test(entry.label)));
  assert.ok(noReadback.dispatches.some((entry) => entry.label === 'ulg-sph-render-field'));

  const smearInput = fakeComputeDevice();
  const smearResult = await buildSphRenderFieldSourceLocalWebGpu({
    device: smearInput.device,
    renderRows: renderRowsForSurface(surfaceTable),
    surfaceTable,
    particleCount: 1,
    renderSmearDtS: 1 / 60
  });
  // Velocity smear runs source-local through the four-pass sequence, verified
  // against the dense gather by the native parity arm.
  assert.equal(smearResult.sourceLocalStrategy, 'shadow');
  assert.ok(!smearResult.sourceLocalFallbackReason);
  const smearPasses = smearInput.dispatches.filter((e) => /source-local/.test(e.label));
  assert.equal(smearPasses.length, 4, 'smear needs splat, resolve, splat, resolve');
  // Without smear the sequence must stay at the original two passes, so a
  // scene that does not need the correction pays nothing for it.
  const noSmearInput = fakeComputeDevice();
  const noSmearResult = await buildSphRenderFieldSourceLocalWebGpu({
    device: noSmearInput.device,
    renderRows: renderRowsForSurface(surfaceTable),
    surfaceTable,
    particleCount: 1,
    renderSmearDtS: 0
  });
  assert.equal(noSmearResult.sourceLocalStrategy, 'shadow');
  assert.equal(
    noSmearInput.dispatches.filter((entry) => /source-local/.test(entry.label)).length,
    2
  );

  const productInput = fakeComputeDevice();
  const productResult = await buildSphRenderFieldSourceLocalWebGpu({
    device: productInput.device,
    renderRows: renderRowsForSurface(surfaceTable),
    surfaceTable,
    particleCount: 1,
    productEventRows: new Float32Array(SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS),
    productEventCount: 1
  });
  // Product events used to force the dense fallback. They now have their own
  // splat pass, so the field is built source-local: particle splat, product
  // splat, resolve.
  assert.equal(productResult.sourceLocalStrategy, 'shadow');
  assert.ok(!productResult.sourceLocalFallbackReason);
  const productLabels = productInput.dispatches
    .filter((entry) => /source-local/.test(entry.label))
    .map((entry) => entry.label);
  assert.equal(productLabels.length, 3);
  assert.match(productLabels[1], /product-splat/, 'product events splat after the particles');
  assert.ok(!productInput.dispatches.some((entry) => entry.label === 'ulg-sph-render-field'));

  // With no events the product pass must not be encoded at all.
  const noProductInput = fakeComputeDevice();
  await buildSphRenderFieldSourceLocalWebGpu({
    device: noProductInput.device,
    renderRows: renderRowsForSurface(surfaceTable),
    surfaceTable,
    particleCount: 1,
    productEventCount: 0
  });
  assert.ok(!noProductInput.dispatches.some((entry) => /product-splat/.test(entry.label)));
});

test('native Vulkan source-local shadow compiles and stays close to dense phase-volume/PBR lanes', {
  skip: RUN_NATIVE
    ? false
    : 'set ULG_RUN_NATIVE_RENDER_SOURCE_LOCAL=1 for native Vulkan WebGPU',
  timeout: 180_000
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
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(NATIVE_BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    native = await page.evaluate(async () => {
      const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) return { status: 'unsupported', reason: 'WebGPU adapter unavailable' };
      const device = await adapter.requestDevice();
      const uncaptured = [];
      device.addEventListener('uncapturederror', (event) => {
        uncaptured.push(event.error?.message || String(event.error));
      });
      device.pushErrorScope('validation');
      try {
        const [sourceLocal, render] = await Promise.all([
          import('/src/runtime/sph/sphRenderFieldSourceLocalGpu.js'),
          import('/src/runtime/sph/sphRenderGpuKernel.js')
        ]);
        const surfaceTable = render.buildSphRenderFieldSurfaceTable([
          {
            surfaceKey: 'native-water-liquid',
            material: 'H2O',
            phase: 'liquid',
            renderKey: 'H2O',
            resolution: 8,
            isolation: 80,
            subtract: 24,
            particleRadiusScale: 1,
            colorLinear: [0.2, 0.6, 1]
          }
        ]);
        const surface = surfaceTable.metadata[0];
        const rows = new Float32Array(render.SPH_GPU_RENDER_ROW_FLOATS);
        rows.set([
          2.5, 2.5, 2.5, 1,
          surface.materialId, surface.phaseId, 900, 1,
          1, 0.2, 1, surface.renderDomainId,
          1, 0.12, 1, 101325,
          0.25, 3, -2, 1
        ]);
        const shared = {
          device,
          renderRows: rows,
          surfaceTable,
          particleCount: 1,
          fieldPadding: 0.22,
          refEdgeM: 10,
          readbackMode: 'full-parity-readback'
        };
        const shadow = await sourceLocal.buildSphRenderFieldSourceLocalWebGpu({
          ...shared,
          maxSplatCellsPerSource: 4096
        });
        const dense = await render.buildSphRenderFieldWebGpu(shared);
        const overflow = await sourceLocal.buildSphRenderFieldSourceLocalWebGpu({
          ...shared,
          maxSplatCellsPerSource: 1
        });
        const diagnostic = await sourceLocal.buildSphRenderFieldSourceLocalWebGpu({
          ...shared,
          sourceLocalMode: sourceLocal.SPH_RENDER_FIELD_SOURCE_LOCAL_MODE_DIAGNOSTIC_NO_READBACK,
          readbackMode: 'no-full-readback',
          retainFieldRowsBuffer: true,
          retainSurfaceBuffer: true,
          waitForQueueCompletion: false,
          deferCleanup: true,
          useQueueFenceForCleanup: true,
          maxSplatCellsPerSource: 4096
        });
        // The base arm above exercises none of the three parity paths that were
        // previously refused, so each gets its own arm compared against the
        // dense field built with the same inputs. Without these, the four-pass
        // smear and the product-event splat are only structurally tested.
        const smearShared = { ...shared, renderSmearDtS: 1 / 60 };
        const smearShadow = await sourceLocal.buildSphRenderFieldSourceLocalWebGpu({
          ...smearShared,
          maxSplatCellsPerSource: 4096
        });
        const smearDense = await render.buildSphRenderFieldWebGpu(smearShared);
        const productRows = new Float32Array(render.SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS);
        productRows[0] = 5; productRows[1] = 5; productRows[2] = 5;
        productRows[4] = 1;   // materialId, matching the surface
        productRows[11] = 0;  // phaseId unset -> admitted by both paths
        productRows[13] = 1;  // unplacedMassKg
        productRows[18] = 1;  // status: placed
        const productShared = {
          ...shared,
          productEventRows: productRows,
          productEventCount: 1
        };
        const productShadow = await sourceLocal.buildSphRenderFieldSourceLocalWebGpu({
          ...productShared,
          maxSplatCellsPerSource: 4096
        });
        const productDense = await render.buildSphRenderFieldWebGpu(productShared);
        const compareFields = (a, b) => {
          let density = 0;
          let palette = 0;
          let temperature = 0;
          for (let offset = 0; offset < a.fieldRows.length; offset += 8) {
            density = Math.max(density, Math.abs(a.fieldRows[offset] - b.fieldRows[offset]));
            for (let lane = 1; lane <= 3; lane += 1) {
              palette = Math.max(palette, Math.abs(
                a.fieldRows[offset + lane] - b.fieldRows[offset + lane]
              ));
            }
            temperature = Math.max(temperature, Math.abs(
              a.fieldRows[offset + 4] - b.fieldRows[offset + 4]
            ));
          }
          return { density, palette, temperature };
        };
        // A single particle has zero dispersion by construction
        // (<|v|^2> - |<v>|^2 = 0), so the arm above proves the four-pass
        // sequence does not corrupt anything but never exercises the
        // correction. Two nearby particles with opposing velocities give a
        // bridging cell real dispersion, which is the case the whole mechanism
        // exists for.
        const divergingRows = new Float32Array(render.SPH_GPU_RENDER_ROW_FLOATS * 2);
        divergingRows.set(rows, 0);
        divergingRows.set(rows, render.SPH_GPU_RENDER_ROW_FLOATS);
        divergingRows[render.SPH_GPU_RENDER_ROW_FLOATS + 0] = 2.9;
        divergingRows[17] = 4; divergingRows[18] = 0; divergingRows[19] = 0;
        divergingRows[render.SPH_GPU_RENDER_ROW_FLOATS + 17] = -4;
        divergingRows[render.SPH_GPU_RENDER_ROW_FLOATS + 18] = 0;
        divergingRows[render.SPH_GPU_RENDER_ROW_FLOATS + 19] = 0;
        const divergingShared = {
          ...shared,
          renderRows: divergingRows,
          particleCount: 2,
          renderSmearDtS: 1 / 60
        };
        const divergingShadow = await sourceLocal.buildSphRenderFieldSourceLocalWebGpu({
          ...divergingShared,
          maxSplatCellsPerSource: 4096
        });
        const divergingDense = await render.buildSphRenderFieldWebGpu(divergingShared);
        const divergingDelta = compareFields(divergingDense, divergingShadow);
        let maxDivergingSmearSq = 0;
        for (let offset = 0; offset < divergingShadow.fieldRows.length; offset += 8) {
          maxDivergingSmearSq = Math.max(maxDivergingSmearSq, divergingShadow.fieldRows[offset + 5]);
        }
        const smearDelta = compareFields(smearDense, smearShadow);
        // Isolates the failure: does smear change the dense field at all, and
        // does it change ours? If ours is unchanged, our correction is inert.
        const denseSmearEffect = compareFields(dense, smearDense);
        // smear_sq is published into lane 5 of each cell (second vec4, .y), so
        // the correction itself is directly observable rather than inferred.
        let maxSmearSq = 0;
        let maxShadowDensity = 0;
        let maxSmearShadowDensity = 0;
        for (let offset = 0; offset < smearShadow.fieldRows.length; offset += 8) {
          maxSmearSq = Math.max(maxSmearSq, smearShadow.fieldRows[offset + 5]);
          maxShadowDensity = Math.max(maxShadowDensity, shadow.fieldRows[offset]);
          maxSmearShadowDensity = Math.max(maxSmearShadowDensity, smearShadow.fieldRows[offset]);
        }
        const shadowSmearEffect = compareFields(shadow, smearShadow);
        const productDelta = compareFields(productDense, productShadow);
        let maxDensityAbs = 0;
        let maxPaletteAbs = 0;
        let maxTemperatureAbs = 0;
        for (let offset = 0; offset < dense.fieldRows.length; offset += 8) {
          maxDensityAbs = Math.max(maxDensityAbs, Math.abs(
            dense.fieldRows[offset] - shadow.fieldRows[offset]
          ));
          for (let lane = 1; lane <= 3; lane += 1) {
            maxPaletteAbs = Math.max(maxPaletteAbs, Math.abs(
              dense.fieldRows[offset + lane] - shadow.fieldRows[offset + lane]
            ));
          }
          maxTemperatureAbs = Math.max(maxTemperatureAbs, Math.abs(
            dense.fieldRows[offset + 4] - shadow.fieldRows[offset + 4]
          ));
        }
        await device.queue.onSubmittedWorkDone();
        await Promise.resolve();
        const diagnosticLeaseCountBeforeRelease = diagnostic.residentBufferLeaseActiveLeaseCount;
        const diagnosticRetainedBuffers = Boolean(
          diagnostic.fieldRowsBuffer
          && diagnostic.surfaceBuffer
          && diagnostic.fieldRowsBufferRetained
          && diagnostic.surfaceBufferRetained
        );
        diagnostic.destroyRenderFieldBuffers();
        const diagnosticDestroyBlockedByLease = diagnostic.residentBufferLeaseSummary.skippedDestroyCount;
        diagnostic.releaseRenderFieldBufferLeases();
        diagnostic.destroyRenderFieldBuffers();
        const diagnosticDestroyedBufferCount = diagnostic.residentBufferLeaseSummary.destroyedResourceCount;
        const validationError = await device.popErrorScope();
        return {
          status: validationError ? 'validation-error' : 'complete',
          validationError: validationError?.message || null,
          uncaptured,
          shadowStatus: shadow.status,
          shadowOverflow: shadow.sourceLocalOverflow,
          shadowPresentationUsable: shadow.sourceLocalUsableForPresentation,
          overflowStatus: overflow.status,
          overflowFlag: overflow.sourceLocalOverflow,
          diagnosticStatus: diagnostic.status,
          diagnosticReadback: diagnostic.renderFieldReadback,
          diagnosticHotLoopReadbackFree: diagnostic.normalHotLoopReadbackFree,
          diagnosticPresentationUsable: diagnostic.sourceLocalUsableForPresentation,
          diagnosticRetainedBuffers,
          diagnosticLeaseCountBeforeRelease,
          diagnosticDestroyBlockedByLease,
          diagnosticDestroyedBufferCount,
          smearDelta,
          denseSmearEffect,
          maxSmearSq,
          divergingDelta,
          maxDivergingSmearSq,
          maxShadowDensity,
          maxSmearShadowDensity,
          shadowSmearEffect,
          smearStrategy: smearShadow.sourceLocalStrategy,
          productDelta,
          productStrategy: productShadow.sourceLocalStrategy,
          maxDensityAbs,
          maxPaletteAbs,
          maxTemperatureAbs
        };
      } catch (error) {
        await device.popErrorScope();
        return { status: 'error', reason: error?.message || String(error), uncaptured };
      }
    });
  } finally {
    await browser.close();
  }

  assert.equal(native.status, 'complete', native.reason || native.validationError || JSON.stringify(native));
  assert.deepEqual(native.uncaptured, []);
  assert.equal(native.shadowStatus, 'render-field-shadow-built');
  assert.equal(native.shadowOverflow, false);
  assert.equal(native.shadowPresentationUsable, false);
  assert.equal(native.overflowStatus, 'render-field-shadow-overflow');
  assert.equal(native.overflowFlag, true);
  assert.equal(native.diagnosticStatus, 'render-field-source-local-diagnostic-submitted');
  assert.equal(native.diagnosticReadback, false);
  assert.equal(native.diagnosticHotLoopReadbackFree, true);
  assert.equal(native.diagnosticPresentationUsable, false);
  assert.equal(native.diagnosticRetainedBuffers, true);
  assert.equal(native.diagnosticLeaseCountBeforeRelease, 2);
  assert.equal(native.diagnosticDestroyBlockedByLease, 2);
  assert.equal(native.diagnosticDestroyedBufferCount, 2);
  assert.ok(native.maxDensityAbs <= 1e-3, JSON.stringify(native));
  assert.ok(native.maxPaletteAbs <= 1e-3, JSON.stringify(native));
  assert.ok(native.maxTemperatureAbs <= 2, JSON.stringify(native));

  assert.equal(native.productStrategy, 'shadow', 'product events must not fall back to dense');
  assert.ok(native.productDelta.density <= 1e-3, `product density ${JSON.stringify(native.productDelta)}`);
  // Velocity smear is refused, so it must land on the dense gather and match it
  // exactly. When the four-pass implementation is fixed, flip this to the
  // 'shadow' strategy and the 1e-3 tolerances used above -- this arm is the
  // gate that caught the implementation perturbing a field the dense path
  // leaves untouched.
  assert.equal(native.smearStrategy, 'shadow');
  // Single particle: zero dispersion, so the four-pass sequence must reproduce
  // the dense field exactly rather than perturb it.
  assert.ok(
    native.smearDelta.density <= 1e-3,
    `smearDelta=${JSON.stringify(native.smearDelta)} maxSmearSq=${native.maxSmearSq} shadowDensity=${native.maxShadowDensity} smearShadowDensity=${native.maxSmearShadowDensity}`
  );
  assert.ok(native.smearDelta.palette <= 1e-3, JSON.stringify(native.smearDelta));

  // Two diverging particles: the correction must actually engage, and still
  // land on the dense field.
  assert.ok(
    native.maxDivergingSmearSq > 0,
    `dispersion never engaged: maxDivergingSmearSq=${native.maxDivergingSmearSq}`
  );
  assert.ok(
    native.divergingDelta.density <= 1e-3,
    `diverging density ${JSON.stringify(native.divergingDelta)} smearSq=${native.maxDivergingSmearSq}`
  );
  assert.ok(
    native.divergingDelta.palette <= 1e-3,
    `diverging palette ${JSON.stringify(native.divergingDelta)}`
  );
  assert.ok(native.productDelta.palette <= 1e-3, `product palette ${JSON.stringify(native.productDelta)}`);
});

test('accumulator lane count matches between both shaders and the host', () => {
  // The lane count appears in the splat WGSL, the resolve WGSL, and the host
  // buffer allocation. A mismatch does not fail to compile -- it silently
  // misaligns every cell's channels, so pin all three together.
  const { sphRenderFieldSourceLocalSplatWgsl, sphRenderFieldSourceLocalResolveWgsl } =
    SPH_RENDER_FIELD_SOURCE_LOCAL_TESTING;
  const laneOf = (source) => {
    const match = /const ACCUM_LANES: u32 = (\d+)u;/.exec(source);
    assert.ok(match, 'ACCUM_LANES must be declared');
    return Number(match[1]);
  };
  assert.equal(laneOf(sphRenderFieldSourceLocalSplatWgsl), SOURCE_LOCAL_ACCUM_LANES);
  assert.equal(laneOf(sphRenderFieldSourceLocalResolveWgsl), SOURCE_LOCAL_ACCUM_LANES);
});

test('velocity moments are gated on a non-zero smear interval', () => {
  // Scenes without smear must not pay the extra atomics.
  const { sphRenderFieldSourceLocalSplatWgsl } = SPH_RENDER_FIELD_SOURCE_LOCAL_TESTING;
  assert.match(
    sphRenderFieldSourceLocalSplatWgsl,
    /if \(params\.render_smear_dt_s > 0\.0 && params\.splat_phase != 2u\) \{/,
    'moments accumulate only when smear is on, and never during the phase that consumes them'
  );
  // Signed components must be split, not clamped: the accumulator is unsigned.
  assert.match(sphRenderFieldSourceLocalSplatWgsl, /quantize\(max\(-vw\.x, 0\.0\)/);
  assert.match(sphRenderFieldSourceLocalSplatWgsl, /quantize\(max\(-vw\.z, 0\.0\)/);
});

test('splat and resolve params structs stay identical', () => {
  // Both shaders bind the same uniform buffer, so any divergence in field
  // order or count silently misreads every scalar after the first difference.
  const { sphRenderFieldSourceLocalSplatWgsl, sphRenderFieldSourceLocalResolveWgsl } =
    SPH_RENDER_FIELD_SOURCE_LOCAL_TESTING;
  const structOf = (source) => {
    const match = /struct SourceLocalParams \{([\s\S]*?)\};/.exec(source);
    assert.ok(match, 'SourceLocalParams must be declared');
    return match[1]
      .split('\n')
      .map((line) => line.replace(/\/\/.*$/, '').trim())
      .filter(Boolean);
  };
  assert.deepEqual(
    structOf(sphRenderFieldSourceLocalSplatWgsl),
    structOf(sphRenderFieldSourceLocalResolveWgsl)
  );
});

test('the dispersion reduce is weighted and clamped non-negative', () => {
  const { sphRenderFieldSourceLocalResolveWgsl } = SPH_RENDER_FIELD_SOURCE_LOCAL_TESTING;
  // sigma_v^2 = <|v|^2> - |<v>|^2 can go slightly negative from fixed-point
  // rounding; a negative variance would produce NaN through sqrt.
  assert.match(
    sphRenderFieldSourceLocalResolveWgsl,
    /max\(mean_v2 - dot\(mean_v, mean_v\), 0\.0\)/
  );
  // Zero smear interval must leave the correction exactly off.
  assert.match(sphRenderFieldSourceLocalResolveWgsl, /var smear_sq = 0\.0;/);
});

test('the smear phases partition the accumulator lanes without overlap', () => {
  // Phase 1 must write only the moment lanes and phase 2 only the primary
  // lanes. If either wrote both, the four-pass sequence would double-count,
  // because nothing is cleared between the passes.
  const { sphRenderFieldSourceLocalSplatWgsl } = SPH_RENDER_FIELD_SOURCE_LOCAL_TESTING;
  assert.match(
    sphRenderFieldSourceLocalSplatWgsl,
    /if \(params\.splat_phase != 1u\) \{/,
    'primary lanes must be skipped during the moments-only phase'
  );
  assert.match(
    sphRenderFieldSourceLocalSplatWgsl,
    /params\.splat_phase == 2u\n?\s*\);/,
    'the smear offset must only be applied in the consuming phase'
  );
});

test('phase constants match the values the shader branches on', () => {
  assert.equal(SPLAT_PHASE_SINGLE, 0);
  assert.equal(SPLAT_PHASE_MOMENTS_ONLY, 1);
  assert.equal(SPLAT_PHASE_SMEARED_PRIMARY, 2);
});

test('successor lineage is authenticated, not bypassed, on the source-local path', async () => {
  // The dense builder refuses to build a field from branded successor rows it
  // cannot authenticate. If the source-local path accepted them instead, it
  // would be a way around that check rather than an equivalent of it.
  const input = fakeComputeDevice();
  const surfaceTable = singleSurfaceTable();
  await assert.rejects(
    () => buildSphRenderFieldSourceLocalWebGpu({
      device: input.device,
      renderRows: renderRowsForSurface(surfaceTable),
      surfaceTable,
      particleCount: 1,
      schroederSpatialSourceFamily: { id: 'unbranded-family' },
      renderRowsSource: null
    }),
    /successor render field requires exact branded render rows/
  );
});

test('successor lineage still refuses unauthenticated product events', async () => {
  // Matches the dense path, which rejects the combination outright.
  const input = fakeComputeDevice();
  const surfaceTable = singleSurfaceTable();
  // The source-local path declines the combination and hands off to the dense
  // builder, which refuses it outright. Refusing everywhere is the point: the
  // fallback must not become a way to get the forbidden combination built.
  await assert.rejects(
    () => buildSphRenderFieldSourceLocalWebGpu({
      device: input.device,
      renderRows: renderRowsForSurface(surfaceTable),
      surfaceTable,
      particleCount: 1,
      schroederSpatialSourceFamily: { id: 'branded-family' },
      productEventCount: 1,
      productEventRows: new Float32Array(SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS)
    }),
    /no unauthenticated product-event source/
  );
});

test('production mode publishes into the caller pooled buffer and is presentable', async () => {
  const input = fakeComputeDevice();
  const surfaceTable = singleSurfaceTable();
  const pooled = input.device.createBuffer({
    label: 'pooled-field-rows',
    size: surfaceTable.totalFieldCells * 8 * 4,
    usage: 0
  });
  const result = await buildSphRenderFieldSourceLocalWebGpu({
    device: input.device,
    renderRows: renderRowsForSurface(surfaceTable),
    surfaceTable,
    particleCount: 1,
    sourceLocalMode: SPH_RENDER_FIELD_SOURCE_LOCAL_MODE_PRODUCTION,
    targetFieldRowsBuffer: pooled
  });
  assert.equal(result.sourceLocalStrategy, 'production');
  assert.equal(result.sourceLocalShadowOnly, false);
  assert.equal(result.sourceLocalUsableForPresentation, true);
  assert.equal(result.backend, 'webgpu-source-local');
  // The pooled buffer belongs to the caller and must survive the builder.
  assert.ok(!pooled.destroyed, 'a caller-owned buffer must not be destroyed');
});

test('production without a pooled target is refused rather than silently allocating', async () => {
  const input = fakeComputeDevice();
  const surfaceTable = singleSurfaceTable();
  const result = await buildSphRenderFieldSourceLocalWebGpu({
    device: input.device,
    renderRows: renderRowsForSurface(surfaceTable),
    surfaceTable,
    particleCount: 1,
    sourceLocalMode: SPH_RENDER_FIELD_SOURCE_LOCAL_MODE_PRODUCTION
  });
  assert.equal(result.sourceLocalStrategy, 'dense-fallback');
  assert.equal(result.sourceLocalFallbackReason, 'production-requires-a-pooled-field-rows-target');
});

test('shadow mode still refuses a pooled target', async () => {
  // Shadow exists to be compared against the dense gather; writing into the
  // renderer's live buffer would disturb what is being presented.
  const input = fakeComputeDevice();
  const surfaceTable = singleSurfaceTable();
  const result = await buildSphRenderFieldSourceLocalWebGpu({
    device: input.device,
    renderRows: renderRowsForSurface(surfaceTable),
    surfaceTable,
    particleCount: 1,
    // Correctly sized: an undersized buffer would be rejected by the dense
    // fallback instead, which would test the wrong thing.
    targetFieldRowsBuffer: input.device.createBuffer({
      label: 't',
      size: surfaceTable.totalFieldCells * 8 * 4,
      usage: 0
    })
  });
  assert.equal(result.sourceLocalFallbackReason, 'shadow-mode-does-not-publish-pooled-output');
  assert.equal(result.sourceLocalStrategy, 'dense-fallback');
});
