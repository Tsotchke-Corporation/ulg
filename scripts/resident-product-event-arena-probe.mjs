import { writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const baseUrl = process.env.ULG_PRODUCT_ARENA_BASE_URL || 'https://127.0.0.1:5173/';
const outputPath = process.env.ULG_PRODUCT_ARENA_OUTPUT
  || '/tmp/ulg-resident-product-event-arena-probe.json';

function chromiumArgs() {
  return [
    '--use-angle=vulkan',
    '--enable-features=Vulkan,UseSkiaRenderer',
    '--enable-unsafe-webgpu'
  ];
}

async function main() {
  const startedAt = new Date().toISOString();
  const browser = await chromium.launch({ headless: true, args: chromiumArgs() });
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const result = await page.evaluate(async () => {
      const nonce = Date.now();
      const [module, wgsl] = await Promise.all([
        import(`/src/runtime/sph/residentProductEventArenaGpu.js?probe=${nonce}`),
        import(`/ulg-gpu-abi/src/wgsl.js?probe=${nonce}`)
      ]);
      const adapter = await navigator.gpu?.requestAdapter();
      if (!adapter) return { status: 'unsupported', reason: 'navigator.gpu returned no adapter' };
      const device = await adapter.requestDevice();
      const uncapturedErrors = [];
      device.addEventListener('uncapturederror', (event) => {
        uncapturedErrors.push(event.error?.message || String(event.error));
      });
      device.pushErrorScope('validation');

      const strideFloats = 32;
      const makeRows = (baseId, statuses) => {
        const rows = new Float32Array(statuses.length * strideFloats);
        statuses.forEach((status, index) => {
          const offset = index * strideFloats;
          rows[offset] = baseId + index;
          rows[offset + 13] = status ? 1 + index : 0;
          rows[offset + 18] = status ? 1 : 0;
        });
        return rows;
      };
      const makeBuffer = (label, rows) => {
        const buffer = device.createBuffer({
          label,
          size: rows.byteLength,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });
        device.queue.writeBuffer(buffer, 0, rows);
        return buffer;
      };
      const firstRows = makeRows(100, [true, false, true, false]);
      const secondRows = makeRows(200, [false, true, false, true]);
      const firstBuffer = makeBuffer('product-arena-first-source', firstRows);
      const secondBuffer = makeBuffer('product-arena-second-source', secondRows);
      const first = module.appendResidentProductEventArenaGpu(device, {
        strideFloats,
        sources: [{ buffer: firstBuffer, rowCount: 4, byteLength: firstRows.byteLength }]
      });
      const second = module.appendResidentProductEventArenaGpu(device, {
        arena: first.arena,
        strideFloats,
        sources: [{ buffer: secondBuffer, rowCount: 4, byteLength: secondRows.byteLength }]
      });

      const overflowArena = module.createResidentProductEventArenaGpu(device, {
        strideFloats,
        capacityRows: 4096,
        sourceCapacityRows: 4096,
        maxCapacityRows: 4096
      });
      device.queue.writeBuffer(
        overflowArena.metadataBuffer,
        module.SPH_RESIDENT_PRODUCT_EVENT_ARENA_METADATA.occupiedRowCount * 4,
        new Uint32Array([4096, 4096])
      );
      device.queue.writeBuffer(
        overflowArena.dispatchIndirectBuffer,
        0,
        new Uint32Array([64, 1, 1])
      );
      module.appendResidentProductEventArenaGpu(device, {
        arena: overflowArena,
        strideFloats,
        maxCapacityRows: 4096,
        sources: [{ buffer: firstBuffer, rowCount: 1, byteLength: firstRows.byteLength }]
      });

      const metadata = await module.mapResidentProductEventArenaMetadataDiagnostic(
        device,
        second.arena
      );
      const overflowMetadata = await module.mapResidentProductEventArenaMetadataDiagnostic(
        device,
        overflowArena
      );
      const compactByteLength = metadata.occupiedRowCount * strideFloats * 4;
      const rowsReadback = device.createBuffer({
        label: 'product-arena-rows-readback',
        size: Math.max(4, compactByteLength),
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
      });
      const indirectReadback = device.createBuffer({
        label: 'product-arena-indirect-readback',
        size: 12,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
      });
      const overflowIndirectReadback = device.createBuffer({
        label: 'product-arena-overflow-indirect-readback',
        size: 12,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
      });
      const p2gAccumulatorBuffer = device.createBuffer({
        label: 'product-arena-p2g-accumulator',
        size: 16,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });
      const p2gParamsBuffer = device.createBuffer({
        label: 'product-arena-p2g-params',
        size: 80,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      const p2gParams = new ArrayBuffer(80);
      const p2gView = new DataView(p2gParams);
      p2gView.setUint32(4, 1, true);
      p2gView.setUint32(8, 1, true);
      p2gView.setUint32(12, 1, true);
      p2gView.setUint32(16, 1, true);
      p2gView.setFloat32(24, 1, true);
      p2gView.setFloat32(28, 1, true);
      p2gView.setUint32(36, second.occupiedRowCountUpperBound, true);
      device.queue.writeBuffer(p2gParamsBuffer, 0, p2gParams);
      const p2gActiveNodeBuffer = device.createBuffer({
        label: 'product-arena-p2g-active-node-placeholder',
        size: 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });
      const productLayout = device.createBindGroupLayout({
        entries: [
          { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
          { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
          { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
          { binding: 8, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
          { binding: 9, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }
        ]
      });
      const productPipeline = await device.createComputePipelineAsync({
        label: 'product-arena-native-p2g-scatter',
        layout: device.createPipelineLayout({ bindGroupLayouts: [productLayout] }),
        compute: {
          module: device.createShaderModule({ code: wgsl.mlsMpmP2gGridProjectionWgsl }),
          entryPoint: 'scatter_product_events'
        }
      });
      const productBindGroup = device.createBindGroup({
        layout: productLayout,
        entries: [
          { binding: 3, resource: { buffer: p2gAccumulatorBuffer } },
          { binding: 4, resource: { buffer: p2gParamsBuffer } },
          { binding: 5, resource: { buffer: second.arena.buffer } },
          { binding: 8, resource: { buffer: p2gActiveNodeBuffer } },
          { binding: 9, resource: { buffer: second.arena.metadataBuffer } }
        ]
      });
      const encoder = device.createCommandEncoder();
      const productPass = encoder.beginComputePass();
      productPass.setPipeline(productPipeline);
      productPass.setBindGroup(0, productBindGroup);
      productPass.dispatchWorkgroupsIndirect(second.arena.dispatchIndirectBuffer, 0);
      productPass.end();
      if (compactByteLength > 0) {
        encoder.copyBufferToBuffer(second.arena.buffer, 0, rowsReadback, 0, compactByteLength);
      }
      encoder.copyBufferToBuffer(second.arena.dispatchIndirectBuffer, 0, indirectReadback, 0, 12);
      encoder.copyBufferToBuffer(
        overflowArena.dispatchIndirectBuffer,
        0,
        overflowIndirectReadback,
        0,
        12
      );
      device.queue.submit([encoder.finish()]);
      await rowsReadback.mapAsync(GPUMapMode.READ);
      const compactRows = new Float32Array(rowsReadback.getMappedRange()).slice();
      rowsReadback.unmap();
      await indirectReadback.mapAsync(GPUMapMode.READ);
      const indirect = new Uint32Array(indirectReadback.getMappedRange()).slice();
      indirectReadback.unmap();
      await overflowIndirectReadback.mapAsync(GPUMapMode.READ);
      const overflowIndirect = new Uint32Array(
        overflowIndirectReadback.getMappedRange()
      ).slice();
      overflowIndirectReadback.unmap();
      const validationError = await device.popErrorScope();
      const provenanceIds = Array.from({ length: metadata.occupiedRowCount }, (_, index) => (
        compactRows[index * strideFloats]
      ));
      const expectedIds = [100, 102, 201, 203];
      const stableOrder = provenanceIds.length === expectedIds.length
        && provenanceIds.every((value, index) => value === expectedIds[index]);
      const checks = {
        exactOccupiedCount: metadata.occupiedRowCount === 4,
        exactActiveCount: metadata.activeRowCount === 4,
        secondAppendCount: metadata.appendedRowCount === 2,
        stableSourceOrder: stableOrder,
        indirectExactPrefix: indirect[0] === 1 && indirect[1] === 1 && indirect[2] === 1,
        normalAppendReusedArena: second.reused && second.normalAppendAllocationFree,
        normalAppendNoHistoryCopy: second.historyCopiedRowCount === 0,
        normalAppendNoMapFenceReadback: !second.mapPerformed
          && !second.queueFenceAwaited
          && second.readbackBytes === 0,
        metadataAdmitted: metadata.admitted,
        overflowFailsClosed: overflowMetadata.overflowFlags === 1
          && overflowMetadata.appendAdmitted === false
          && overflowIndirect[0] === 0,
        nativeP2gMetadataGateSubmitted: true,
        validationClean: !validationError && uncapturedErrors.length === 0
      };
      const passed = Object.values(checks).every(Boolean);

      firstBuffer.destroy();
      secondBuffer.destroy();
      rowsReadback.destroy();
      indirectReadback.destroy();
      overflowIndirectReadback.destroy();
      p2gAccumulatorBuffer.destroy();
      p2gParamsBuffer.destroy();
      p2gActiveNodeBuffer.destroy();
      second.arena.destroy();
      overflowArena.destroy();
      return {
        schema: 'peercompute.ulg.resident-product-event-arena-native-probe.v0',
        status: passed ? 'pass' : 'fail',
        checks,
        metadata,
        provenanceIds,
        expectedIds,
        indirect: Array.from(indirect),
        overflowMetadata,
        overflowIndirect: Array.from(overflowIndirect),
        firstExecution: {
          queueSubmissionCount: first.queueSubmissionCount,
          mapPerformed: first.mapPerformed,
          queueFenceAwaited: first.queueFenceAwaited
        },
        secondExecution: {
          reused: second.reused,
          normalAppendAllocationFree: second.normalAppendAllocationFree,
          historyCopiedRowCount: second.historyCopiedRowCount,
          sourceCompactionPolicy: second.sourceCompactionPolicy
        },
        validationError: validationError?.message || null,
        uncapturedErrors
      };
    });
    const artifact = { startedAt, finishedAt: new Date().toISOString(), baseUrl, ...result };
    await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
    process.stdout.write(`${JSON.stringify(artifact, null, 2)}\n`);
    if (result.status !== 'pass') process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error?.stack || error}\n`);
  process.exitCode = 1;
});
