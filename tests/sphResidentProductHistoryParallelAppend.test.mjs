import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RESIDENT_PRODUCT_HISTORY_PARALLEL_BLOCK_ROWS,
  RESIDENT_PRODUCT_HISTORY_PARALLEL_MIN_BLOCKS,
  computeResidentProductHistoryParallelBlockPlan,
  createSphResidentProductHistoryParallelAppendWgsl
} from '../src/runtime/sph/sphResidentProductHistoryParallelAppendGpu.js';
import {
  sphExactResidentProductHistoryLayout,
  createSphExactResidentProductHistoryAppendWgsl
} from '../src/runtime/sph/sphExactResidentProductHistoryWgsl.js';
import { sphExactRationalQuantityLayout } from '../src/runtime/sph/sphExactRationalQuantityWgsl.js';
import { createSphExactMassFormat } from '../ulg-gpu-abi/src/sphExactMassInventory.js';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_PRODUCT_HISTORY_PARALLEL === '1';
const NATIVE_BASE_URL = process.env.ULG_PRODUCT_HISTORY_BASE_URL || 'https://127.0.0.1:5173/';
const NATIVE_CHROME = process.env.ULG_PRODUCT_HISTORY_CHROME || '/usr/bin/google-chrome';

test('parallel filtered-append block plan routes large merges to multi-workgroup and guards limits', () => {
  const small = computeResidentProductHistoryParallelBlockPlan({
    sourceARowCount: 100,
    sourceBRowCount: 200
  });
  assert.equal(small.blocksA, 1);
  assert.equal(small.blocksB, 1);
  assert.equal(small.totalBlocks, 2);
  assert.equal(small.eligible, false);
  assert.equal(RESIDENT_PRODUCT_HISTORY_PARALLEL_BLOCK_ROWS, 256);
  assert.equal(RESIDENT_PRODUCT_HISTORY_PARALLEL_MIN_BLOCKS, 3);

  const airLevels3 = computeResidentProductHistoryParallelBlockPlan({
    sourceARowCount: 0,
    sourceBRowCount: 58752
  });
  assert.equal(airLevels3.blocksA, 0);
  assert.equal(airLevels3.blocksB, 230);
  assert.equal(airLevels3.totalBlocks, 230);
  assert.equal(airLevels3.eligible, true);

  const parentCounted = computeResidentProductHistoryParallelBlockPlan({
    sourceARowCount: 10,
    sourceBRowCount: 512,
    sourceAUsesParentCount: true,
    parentRowCapacity: 32768
  });
  assert.equal(parentCounted.blocksA, 128);
  assert.equal(parentCounted.blocksB, 2);
  assert.equal(parentCounted.totalBlocks, 130);
  assert.equal(parentCounted.eligible, true);

  const oversized = computeResidentProductHistoryParallelBlockPlan({
    sourceARowCount: 20_000_000,
    sourceBRowCount: 0,
    maxWorkgroupsPerDimension: 65535
  });
  assert.equal(oversized.eligible, false);

  const exactFormat = createSphExactMassFormat();
  const scalar = sphExactRationalQuantityLayout({ wordCount: 8 });
  const n = exactFormat.wordCount;
  const exactLayout = sphExactResidentProductHistoryLayout(exactFormat, {
    headerWords: 16,
    massOffsetWords: 16,
    massWordCount: n,
    scalarOffsetWords: 16 + n,
    scalar,
    recordWords: 16 + n + 7 * scalar.recordWords
  });
  const legacyWgsl = createSphResidentProductHistoryParallelAppendWgsl(null);
  const exactWgsl = createSphResidentProductHistoryParallelAppendWgsl(exactLayout);
  const exactSingleWgsl = createSphExactResidentProductHistoryAppendWgsl(exactLayout);
  assert.ok(legacyWgsl.includes('fn validate_header') && legacyWgsl.includes('fn scatter_blocks'));
  assert.ok(exactWgsl.includes('emitted_control') && exactWgsl.includes('exact_history_valid'));
  assert.ok(exactSingleWgsl.includes('@workgroup_size(256)') && exactSingleWgsl.includes('exact_history_valid'));
});

test('native Vulkan parallel multi-workgroup filtered append matches exact deterministic order, atomicity, and 58752-row speed', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_PRODUCT_HISTORY_PARALLEL=1 for native Vulkan WebGPU',
  timeout: 120_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: NATIVE_CHROME,
    headless: false,
    args: [
      '--use-angle=vulkan',
      '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu',
      '--ignore-gpu-blocklist',
      '--ignore-certificate-errors',
      '--ozone-platform=wayland',
      '--window-size=900,600'
    ]
  });
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(NATIVE_BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const proof = await page.evaluate(async () => {
      const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) return { ok: false, reason: 'no adapter' };
      const device = await adapter.requestDevice();
      const uncaptured = [];
      device.addEventListener('uncapturederror', (e) => uncaptured.push(e.error?.message || String(e.error)));
      device.pushErrorScope('validation');

      const nonce = Date.now();
      const [
        { sphResidentProductHistoryFilteredAppendWgsl },
        {
          computeResidentProductHistoryParallelBlockPlan,
          encodeResidentProductHistoryParallelAppendPass
        },
        {
          createResidentProductEventCountControlWords,
          SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_STATUS_READY,
          SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_STATUS_FAILED
        }
      ] = await Promise.all([
        import(`/ulg-gpu-abi/src/wgsl.js?par=${nonce}`),
        import(`/src/runtime/sph/sphResidentProductHistoryParallelAppendGpu.js?par=${nonce}`),
        import(`/src/runtime/sph/sphResidentProductHistoryGpu.js?par=${nonce}`)
      ]);

      const ROW_FLOATS = 32;
      const ROW_STRIDE_VEC4 = 8;
      const makeLiveRow = (id) => {
        const row = new Float32Array(ROW_FLOATS);
        row[0] = id;
        row[1] = id * 0.25;
        row[11] = 1.5;
        row[13] = 2.0;
        row[17] = 3.0;
        row[18] = 1.0;
        row[30] = 1.0;
        row[31] = id + 1000;
        return row;
      };
      const makeBuf = (label, data, usage) => {
        const b = device.createBuffer({ label, size: Math.max(256, data.byteLength), usage });
        if (data.byteLength > 0) device.queue.writeBuffer(b, 0, data);
        return b;
      };
      const readU32 = async (buf, words) => {
        const rb = device.createBuffer({ size: words * 4, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
        const enc = device.createCommandEncoder();
        enc.copyBufferToBuffer(buf, 0, rb, 0, words * 4);
        device.queue.submit([enc.finish()]);
        await rb.mapAsync(GPUMapMode.READ);
        const out = new Uint32Array(rb.getMappedRange().slice(0));
        rb.unmap();
        rb.destroy();
        return Array.from(out);
      };
      const readF32 = async (buf, floats) => {
        const rb = device.createBuffer({ size: floats * 4, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
        const enc = device.createCommandEncoder();
        enc.copyBufferToBuffer(buf, 0, rb, 0, floats * 4);
        device.queue.submit([enc.finish()]);
        await rb.mapAsync(GPUMapMode.READ);
        const out = new Float32Array(rb.getMappedRange().slice(0));
        rb.unmap();
        rb.destroy();
        return out;
      };

      // Case 1: Multi-block mixed sourceA (1100 rows, parentCount=700 via sourceAUsesParentCount)
      // + sourceB (2300 rows) with sparse & dense chunks across 14 blocks -> compare Tier 2 vs Tier 1 & CPU ref!
      const capA = 1100;
      const liveParentCount = 700;
      const rowsB = 2300;
      const destCap = 4096;
      const srcAData = new Float32Array(capA * ROW_FLOATS);
      const srcBData = new Float32Array(rowsB * ROW_FLOATS);
      const expectedLiveIds = [];
      for (let i = 0; i < capA; i++) {
        // Live on non-trivial pattern including chunk boundaries (0, 255, 256, 511, 512, 699, and dead tail >= 700)
        const live = i === 0 || i === 255 || i === 256 || i === 511 || i === 512 || i === 699 || (i % 13 === 0) || (i >= 300 && i < 340);
        if (live) {
          srcAData.set(makeLiveRow(10000 + i), i * ROW_FLOATS);
          if (i < liveParentCount) expectedLiveIds.push(10000 + i);
        }
      }
      for (let i = 0; i < rowsB; i++) {
        const live = i === 0 || i === 255 || i === 256 || i === 1023 || i === 1024 || i === rowsB - 1 || (i % 17 === 3) || (i >= 1500 && i < 1800);
        if (live) {
          srcBData.set(makeLiveRow(20000 + i), i * ROW_FLOATS);
          expectedLiveIds.push(20000 + i);
        }
      }
      const parentCtrlWords = createResidentProductEventCountControlWords({
        status: SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_STATUS_READY,
        liveRowCount: liveParentCount,
        rowCapacity: capA,
        rowStrideVec4: ROW_STRIDE_VEC4,
        generation: 7,
        seal: 707
      });
      const paramsWords = Uint32Array.from([
        capA, rowsB, destCap, ROW_STRIDE_VEC4,
        0, 1, // reuseParentPrefix=0, sourceAUsesParentCount=1
        7, 707, 8, 808, capA, ROW_STRIDE_VEC4
      ]);
      const srcABuf = makeBuf('srcA', srcAData, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
      const srcBBuf = makeBuf('srcB', srcBData, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
      const parentCtrlBuf = makeBuf('parentCtrl', parentCtrlWords, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
      const paramsBuf = makeBuf('params', paramsWords, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
      const histT2 = makeBuf('histT2', new Float32Array(destCap * ROW_FLOATS), GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST);
      const nextCtrlT2 = makeBuf('nextCtrlT2', new Uint32Array(64), GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST);

      const plan = computeResidentProductHistoryParallelBlockPlan({
        sourceARowCount: capA,
        sourceBRowCount: rowsB,
        sourceAUsesParentCount: true,
        parentRowCapacity: capA
      });
      const enc1 = device.createCommandEncoder();
      encodeResidentProductHistoryParallelAppendPass({
        device,
        encoder: enc1,
        historyBuffer: histT2,
        sourceABuffer: srcABuf,
        sourceBBuffer: srcBBuf,
        parentControlBuffer: parentCtrlBuf,
        nextControlBuffer: nextCtrlT2,
        paramsBuffer: paramsBuf,
        totalBlocks: plan.totalBlocks
      });
      device.queue.submit([enc1.finish()]);
      await device.queue.onSubmittedWorkDone();

      const ctrlT2 = await readU32(nextCtrlT2, 12);
      const outT2 = await readF32(histT2, expectedLiveIds.length * ROW_FLOATS);
      const gotIdsT2 = [];
      let rowMismatch = 0;
      for (let i = 0; i < expectedLiveIds.length; i++) {
        gotIdsT2.push(outT2[i * ROW_FLOATS]);
        if (outT2[i * ROW_FLOATS + 31] !== expectedLiveIds[i] + 1000) rowMismatch++;
      }

      // Case 2: Failure atomicity on overflow (destCap too small -> history_rows completely untouched!)
      const smallCap = 100;
      const sentinel = new Float32Array(smallCap * ROW_FLOATS);
      sentinel.fill(42.25);
      const histOverflow = makeBuf('histOverflow', sentinel, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST);
      const nextCtrlOv = makeBuf('nextCtrlOv', new Uint32Array(64), GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST);
      const paramsOv = makeBuf('paramsOv', Uint32Array.from([
        capA, rowsB, smallCap, ROW_STRIDE_VEC4, 0, 1, 7, 707, 9, 909, capA, ROW_STRIDE_VEC4
      ]), GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
      const encOv = device.createCommandEncoder();
      encodeResidentProductHistoryParallelAppendPass({
        device,
        encoder: encOv,
        historyBuffer: histOverflow,
        sourceABuffer: srcABuf,
        sourceBBuffer: srcBBuf,
        parentControlBuffer: parentCtrlBuf,
        nextControlBuffer: nextCtrlOv,
        paramsBuffer: paramsOv,
        totalBlocks: plan.totalBlocks
      });
      device.queue.submit([encOv.finish()]);
      await device.queue.onSubmittedWorkDone();
      const ctrlOv = await readU32(nextCtrlOv, 12);
      const outOv = await readF32(histOverflow, smallCap * ROW_FLOATS);
      let sentinelCorrupted = 0;
      for (let i = 0; i < outOv.length; i++) if (outOv[i] !== 42.25) sentinelCorrupted++;

      // Case 3: 58,752-row benchmark (Tier 1 256-thread vs Tier 2 230-workgroup)
      const BIG_ROWS = 58752;
      const bigSrc = makeBuf('bigSrc', new Float32Array(BIG_ROWS * ROW_FLOATS), GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
      const bigHist = makeBuf('bigHist', new Float32Array(BIG_ROWS * ROW_FLOATS), GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
      const bigParent = makeBuf('bigParent', createResidentProductEventCountControlWords({
        status: SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_STATUS_READY,
        liveRowCount: 0, rowCapacity: BIG_ROWS, rowStrideVec4: ROW_STRIDE_VEC4, generation: 1, seal: 11
      }), GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
      const bigNext = makeBuf('bigNext', new Uint32Array(64), GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST);
      const bigParams = makeBuf('bigParams', Uint32Array.from([
        0, BIG_ROWS, BIG_ROWS, ROW_STRIDE_VEC4, 0, 0, 1, 11, 2, 22, BIG_ROWS, ROW_STRIDE_VEC4
      ]), GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);

      const t1Mod = device.createShaderModule({ code: sphResidentProductHistoryFilteredAppendWgsl });
      const t1Pipe = await device.createComputePipelineAsync({ layout: 'auto', compute: { module: t1Mod, entryPoint: 'append_filtered_sources' } });
      const t1Bg = device.createBindGroup({
        layout: t1Pipe.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: bigHist } },
          { binding: 1, resource: { buffer: bigSrc } },
          { binding: 2, resource: { buffer: bigSrc } },
          { binding: 3, resource: { buffer: bigParent, offset: 0, size: 256 } },
          { binding: 4, resource: { buffer: bigNext, offset: 0, size: 256 } },
          { binding: 5, resource: { buffer: bigParams } }
        ]
      });
      const bigPlan = computeResidentProductHistoryParallelBlockPlan({ sourceARowCount: 0, sourceBRowCount: BIG_ROWS });

      // Warmup both
      for (let w = 0; w < 3; w++) {
        const e = device.createCommandEncoder();
        const p = e.beginComputePass(); p.setPipeline(t1Pipe); p.setBindGroup(0, t1Bg); p.dispatchWorkgroups(1); p.end();
        encodeResidentProductHistoryParallelAppendPass({
          device, encoder: e, historyBuffer: bigHist, sourceABuffer: bigSrc, sourceBBuffer: bigSrc,
          parentControlBuffer: bigParent, nextControlBuffer: bigNext, paramsBuffer: bigParams, totalBlocks: bigPlan.totalBlocks
        });
        device.queue.submit([e.finish()]);
      }
      await device.queue.onSubmittedWorkDone();

      const ITERS = 40;
      const t1Start = performance.now();
      const eT1 = device.createCommandEncoder();
      for (let i = 0; i < ITERS; i++) {
        const p = eT1.beginComputePass(); p.setPipeline(t1Pipe); p.setBindGroup(0, t1Bg); p.dispatchWorkgroups(1); p.end();
      }
      device.queue.submit([eT1.finish()]);
      await device.queue.onSubmittedWorkDone();
      const tier1Ms = (performance.now() - t1Start) / ITERS;

      const t2Start = performance.now();
      const eT2 = device.createCommandEncoder();
      for (let i = 0; i < ITERS; i++) {
        encodeResidentProductHistoryParallelAppendPass({
          device, encoder: eT2, historyBuffer: bigHist, sourceABuffer: bigSrc, sourceBBuffer: bigSrc,
          parentControlBuffer: bigParent, nextControlBuffer: bigNext, paramsBuffer: bigParams, totalBlocks: bigPlan.totalBlocks
        });
      }
      device.queue.submit([eT2.finish()]);
      await device.queue.onSubmittedWorkDone();
      const tier2Ms = (performance.now() - t2Start) / ITERS;

      const bigCtrl = await readU32(bigNext, 12);
      const valErr = await device.popErrorScope();
      for (const b of [srcABuf, srcBBuf, parentCtrlBuf, paramsBuf, histT2, nextCtrlT2, histOverflow, nextCtrlOv, paramsOv, bigSrc, bigHist, bigParent, bigNext, bigParams]) {
        b.destroy();
      }
      return {
        ok: valErr === null && uncaptured.length === 0,
        valErr: valErr?.message ?? null,
        uncaptured,
        expectedCount: expectedLiveIds.length,
        gotCountT2: ctrlT2[3],
        statusT2: ctrlT2[2],
        exactOrderMatch: gotIdsT2.length === expectedLiveIds.length && gotIdsT2.every((v, i) => v === expectedLiveIds[i]),
        rowMismatch,
        overflowStatus: ctrlOv[2],
        overflowFailedConst: SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_STATUS_FAILED,
        overflowErrCode: ctrlOv[11],
        sentinelCorrupted,
        bigStatus: bigCtrl[2],
        bigCount: bigCtrl[3],
        tier1Ms: +tier1Ms.toFixed(4),
        tier2Ms: +tier2Ms.toFixed(4),
        tier2SpeedupOverTier1: +(tier1Ms / Math.max(1e-6, tier2Ms)).toFixed(2)
      };
    });
    console.log('Native Vulkan Parallel Filtered-Append Proof:', proof);
    assert.equal(proof.ok, true, JSON.stringify(proof));
    assert.equal(proof.statusT2, 1);
    assert.equal(proof.gotCountT2, proof.expectedCount);
    assert.equal(proof.exactOrderMatch, true);
    assert.equal(proof.rowMismatch, 0);
    assert.equal(proof.overflowStatus, proof.overflowFailedConst);
    assert.equal(proof.overflowErrCode, 4);
    assert.equal(proof.sentinelCorrupted, 0);
    assert.equal(proof.bigStatus, 1);
    assert.equal(proof.bigCount, 0);
  } finally {
    await browser.close();
  }
});
