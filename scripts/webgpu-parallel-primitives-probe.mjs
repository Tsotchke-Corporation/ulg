import { writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const baseUrl = process.env.ULG_PRIMITIVES_BASE_URL || 'https://127.0.0.1:5173/';
const outputPath = process.env.ULG_PRIMITIVES_OUTPUT || '/tmp/ulg-webgpu-parallel-primitives.json';
const largeCount = Math.max(513, Math.round(Number(
  process.env.ULG_PRIMITIVES_ELEMENT_COUNT || 10_003
)));
const largeMaxDispatchDimension = Math.max(
  8,
  Math.ceil(Math.sqrt(Math.ceil(largeCount / 256)))
);
const largeKeyWordCount = Math.max(
  1,
  Math.min(8, Math.round(Number(process.env.ULG_PRIMITIVES_KEY_WORD_COUNT || 2)))
);

function chromiumArgs() {
  const extra = String(process.env.ULG_PRIMITIVES_CHROMIUM_ARGS || '').trim();
  return [
    '--use-angle=vulkan',
    '--enable-features=Vulkan,UseSkiaRenderer',
    '--enable-unsafe-webgpu',
    ...(extra ? extra.split(/\s+/) : [])
  ];
}

async function main() {
  const startedAt = new Date().toISOString();
  const browser = await chromium.launch({ headless: true, args: chromiumArgs() });
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const result = await page.evaluate(async ({
      count,
      maxDispatchDimension,
      largeKeyWords
    }) => {
      const module = await import(`/src/runtime/webgpuRadixScanUnique.js?probe=${Date.now()}`);
      const adapter = await navigator.gpu?.requestAdapter();
      if (!adapter) {
        return { status: 'unsupported', reason: 'navigator.gpu returned no adapter' };
      }
      const device = await adapter.requestDevice();
      const validationErrors = [];
      device.addEventListener('uncapturederror', (event) => {
        validationErrors.push(event.error?.message || String(event.error));
      });

      const runCase = async ({ name, keys, keyWordCount, maxDispatchDimension }) => {
        const elementCount = keys.length / keyWordCount;
        const keyBuffer = device.createBuffer({
          label: `${name}-keys`,
          size: keys.byteLength,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });
        device.queue.writeBuffer(keyBuffer, 0, keys);
        const runtime = module.createWebGpuStableRadixScanUnique(device, {
          maxElementCount: elementCount,
          maxKeyWordCount: keyWordCount,
          maxComputeWorkgroupsPerDimension: maxDispatchDimension,
          label: name
        });
        const encoder = device.createCommandEncoder({ label: `${name}-encoder` });
        const encodeStartedAt = performance.now();
        const execution = runtime.encodeSortUnique(encoder, {
          keyBuffer,
          elementCount,
          keyWordCount,
          keyStrideWords: keyWordCount,
          generationId: name === 'small-exact' ? 1 : 2
        });
        const encodeWallMs = performance.now() - encodeStartedAt;
        const sortedReadback = device.createBuffer({
          label: `${name}-sorted-readback`,
          size: elementCount * Uint32Array.BYTES_PER_ELEMENT,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        const evidenceReadback = device.createBuffer({
          label: `${name}-evidence-readback`,
          size: 8 * Uint32Array.BYTES_PER_ELEMENT,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        const offsetsReadback = device.createBuffer({
          label: `${name}-offsets-readback`,
          size: (elementCount + 1) * Uint32Array.BYTES_PER_ELEMENT,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        encoder.copyBufferToBuffer(
          execution.sortedIndicesBuffer,
          0,
          sortedReadback,
          0,
          sortedReadback.size
        );
        encoder.copyBufferToBuffer(
          execution.uniqueEvidenceBuffer,
          0,
          evidenceReadback,
          0,
          evidenceReadback.size
        );
        encoder.copyBufferToBuffer(
          execution.uniqueOffsetsBuffer,
          0,
          offsetsReadback,
          0,
          offsetsReadback.size
        );
        const submittedAt = performance.now();
        device.queue.submit([encoder.finish()]);
        await device.queue.onSubmittedWorkDone();
        const queueFenceMs = performance.now() - submittedAt;

        await sortedReadback.mapAsync(GPUMapMode.READ);
        const sorted = new Uint32Array(sortedReadback.getMappedRange()).slice();
        sortedReadback.unmap();
        await evidenceReadback.mapAsync(GPUMapMode.READ);
        const evidence = new Uint32Array(evidenceReadback.getMappedRange()).slice();
        evidenceReadback.unmap();
        await offsetsReadback.mapAsync(GPUMapMode.READ);
        const offsets = new Uint32Array(offsetsReadback.getMappedRange()).slice();
        offsetsReadback.unmap();

        let orderValid = true;
        let stabilityValid = true;
        let permutationValid = true;
        let offsetsMonotone = true;
        const seen = new Uint8Array(elementCount);
        for (let sortedPosition = 0; sortedPosition < elementCount; sortedPosition += 1) {
          const sourceIndex = sorted[sortedPosition];
          if (sourceIndex >= elementCount || seen[sourceIndex]) {
            permutationValid = false;
            continue;
          }
          seen[sourceIndex] = 1;
          if (sortedPosition === 0) continue;
          const previousIndex = sorted[sortedPosition - 1];
          let comparison = 0;
          for (let word = 0; word < keyWordCount; word += 1) {
            const left = keys[previousIndex * keyWordCount + word];
            const right = keys[sourceIndex * keyWordCount + word];
            if (left === right) continue;
            comparison = left < right ? -1 : 1;
            break;
          }
          if (comparison > 0) orderValid = false;
          if (comparison === 0 && previousIndex > sourceIndex) stabilityValid = false;
        }
        for (let index = 0; index < elementCount; index += 1) {
          if (!seen[index]) permutationValid = false;
        }
        const uniqueCount = evidence[2];
        for (let index = 1; index <= uniqueCount; index += 1) {
          if (offsets[index] < offsets[index - 1]) offsetsMonotone = false;
        }
        const sentinelValid = offsets[uniqueCount] === elementCount;
        const pass = orderValid && stabilityValid && permutationValid
          && offsetsMonotone && sentinelValid
          && evidence[0] === (name === 'small-exact' ? 1 : 2)
          && evidence[1] === elementCount
          && evidence[3] === 1
          && evidence[4] === 0;

        runtime.releaseTransientBuffers(execution);
        runtime.destroy();
        keyBuffer.destroy();
        sortedReadback.destroy();
        evidenceReadback.destroy();
        offsetsReadback.destroy();
        return {
          name,
          status: pass ? 'pass' : 'fail',
          elementCount,
          keyWordCount,
          maxDispatchDimension,
          radixPassCount: execution.radixPassCount,
          encodedDispatchCount: execution.encodedDispatchCount,
          encodedComputePassCount: execution.encodedComputePassCount,
          bindGroupCreationCount: execution.bindGroupCreationCount,
          encodeWallMs,
          orderValid,
          stabilityValid,
          permutationValid,
          offsetsMonotone,
          sentinelValid,
          uniqueCount,
          evidence: Array.from(evidence),
          sortedPrefix: Array.from(sorted.slice(0, Math.min(16, sorted.length))),
          queueFenceMs
        };
      };

      const small = new Uint32Array([
        1, 2,
        0, 5,
        1, 2,
        0, 1,
        0xffffffff, 0,
        0, 5,
        1, 1
      ]);
      const large = new Uint32Array(count * largeKeyWords);
      let state = 0x12345678;
      for (let index = 0; index < count; index += 1) {
        for (let word = 0; word < largeKeyWords; word += 1) {
          state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
          large[index * largeKeyWords + word] = word === 0
            ? ((state >>> 20) & 255)
            : ((state >>> 8) & 4095);
        }
      }
      const cases = [
        await runCase({
          name: 'small-exact',
          keys: small,
          keyWordCount: 2,
          maxDispatchDimension: 4
        }),
        await runCase({
          name: 'large-hierarchical-2d',
          keys: large,
          keyWordCount: largeKeyWords,
          maxDispatchDimension
        })
      ];
      device.destroy();
      return {
        status: cases.every((entry) => entry.status === 'pass')
          && validationErrors.length === 0 ? 'pass' : 'fail',
        cases,
        validationErrors
      };
    }, {
      count: largeCount,
      maxDispatchDimension: largeMaxDispatchDimension,
      largeKeyWords: largeKeyWordCount
    });

    const artifact = {
      schema: 'peercompute.ulg.webgpu-parallel-primitives-probe.v0',
      startedAt,
      completedAt: new Date().toISOString(),
      baseUrl,
      ...result
    };
    await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify(artifact)}\n`);
    if (artifact.status !== 'pass') process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

await main();
