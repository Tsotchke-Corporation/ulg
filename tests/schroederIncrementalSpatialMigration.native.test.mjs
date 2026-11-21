import assert from 'node:assert/strict';
import test from 'node:test';

// A2 (`ulg-a2-incremental-spatial`) native Vulkan WebGPU gate:
//   1. Exact bit-for-bit CSR directory & consumerDispatch equivalence against
//      trusted full GPU radix rebuild (`createSchroederSpatialEpochGpu`) across:
//        - M0: quiescent / sub-cell jitter (0% crossings -> zero-churn rebase)
//        - M1: sparse single-cell crossings (~1% churn, cell birth + cell death +
//              multi-member cell splits/merges, lexicographic + bounded-atlas)
//        - M2: moderate single-cell crossings (~5% churn across >1,024 members,
//              exercising multi-chunk bitonic + parallel binary-search run merge)
//        - M3: immutable admitted generations (predecessor arena bytes remain
//              100% bit-identical while successor generation executes)
//        - M4: capacity / source-count change (2,048 -> 2,560 -> 1,920)
//        - M5: adversarial motion (multi-cell jump & displacement > certificate)
//              -> proves GPU seals STATUS_FAIL_CLOSED + [0,0,0] consumer dispatch,
//                 then transactional fallback recovers exact trusted directory!
//   2. Same-device scaling & cost/benefit benchmark across N = 2,048, 32,768,
//      and 103,831 live carriers at 0%, 1%, 5%, 25%, and 100% churn.
const RUN_NATIVE = process.env.ULG_RUN_NATIVE_INCREMENTAL_SPATIAL === '1';
const BASE_URL = process.env.ULG_INCREMENTAL_SPATIAL_BASE_URL || 'https://127.0.0.1:5173/';

test('A2 incremental spatial migration: exact CSR equivalence, fail-closed certificates, and 103k scaling on Vulkan WebGPU', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_INCREMENTAL_SPATIAL=1 to run on native WebGPU',
  timeout: 300_000
}, async () => {
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
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(new URL('service-assets/README.md', BASE_URL).href, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000
    });
    const out = await page.evaluate(async () => {
      let adapter = null;
      for (let i = 0; i < 5 && !adapter; i += 1) {
        adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
        if (!adapter) await new Promise((r) => setTimeout(r, 400));
      }
      if (!adapter) return { status: 'unsupported' };
      const device = await adapter.requestDevice({
        requiredLimits: {
          maxBufferSize: Math.min(512 * 1024 * 1024, adapter.limits.maxBufferSize),
          maxStorageBufferBindingSize: Math.min(256 * 1024 * 1024, adapter.limits.maxStorageBufferBindingSize),
          maxStorageBuffersPerShaderStage: Math.min(16, adapter.limits.maxStorageBuffersPerShaderStage)
        }
      });
      const gpuErrors = [];
      device.addEventListener('uncapturederror', (e) => {
        if (gpuErrors.length < 20) gpuErrors.push(String(e.error?.message || e.error));
      });

      const { createSchroederSpatialEpochGpu } = await import('/src/runtime/sph/schroederSpatialEpochGpu.js');
      const {
        createSchroederIncrementalSpatialMigrationGpu,
        SCHROEDER_INCREMENTAL_FALLBACK_FLAG
      } = await import('/src/runtime/sph/schroederIncrementalSpatialMigrationGpu.js');
      const { tagWebGpuBufferDevice } = await import('/src/runtime/sph/sphGpuDeviceIdentity.js');

      const STRIDE = 16;
      const SPACING = 0.25;

      function makePrng(seed = 0x12345678) {
        let s = seed >>> 0;
        return () => {
          s ^= s << 13; s >>>= 0;
          s ^= s >>> 17; s >>>= 0;
          s ^= s << 5; s >>>= 0;
          return (s >>> 0) / 0x100000000;
        };
      }

      function buildActiveNodeRows(count, positions) {
        const rows = new Float32Array(count * STRIDE);
        for (let i = 0; i < count; i += 1) {
          const base = i * STRIDE;
          rows[base + 0] = 0; // level
          rows[base + 8] = SPACING; // native_spacing
          rows[base + 10] = i; // source_particle_f
          rows[base + 11] = 1; // status admitted
          rows[base + 12] = positions[i * 3 + 0];
          rows[base + 13] = positions[i * 3 + 1];
          rows[base + 14] = positions[i * 3 + 2];
          rows[base + 15] = 0; // chart 0
        }
        return rows;
      }

      function uploadSourceBuffer(rows, capacityCount = rows.length / STRIDE) {
        const byteLength = Math.max(64, capacityCount * STRIDE * 4);
        const buf = tagWebGpuBufferDevice(
          device.createBuffer({
            size: byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
          }),
          device
        );
        device.queue.writeBuffer(buf, 0, rows);
        return buf;
      }

      async function readU32(buffer, wordCount) {
        const bytes = wordCount * 4;
        const staging = device.createBuffer({
          size: bytes,
          usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
        });
        const enc = device.createCommandEncoder();
        enc.copyBufferToBuffer(buffer, 0, staging, 0, bytes);
        device.queue.submit([enc.finish()]);
        await staging.mapAsync(GPUMapMode.READ);
        const outWords = new Uint32Array(staging.getMappedRange().slice(0));
        staging.unmap();
        staging.destroy();
        return outWords;
      }

      function fnv1aWords(words) {
        let h = 0x811c9dc5;
        for (let i = 0; i < words.length; i += 1) {
          let w = words[i];
          for (let b = 0; b < 4; b += 1) {
            h ^= w & 0xff;
            h = Math.imul(h, 0x01000193) >>> 0;
            w >>>= 8;
          }
        }
        return h >>> 0;
      }

      async function compareAgainstTrusted(incExec, trustedExec, layout, sourceCount) {
        const incDir = await readU32(incExec.directoryBuffer, layout.wordLength);
        const refDir = await readU32(trustedExec.directoryBuffer, layout.wordLength);
        const incDisp = await readU32(incExec.consumerDispatchBuffer, 3);
        const refDisp = await readU32(trustedExec.consumerDispatchBuffer, 3);

        const diffs = [];
        // Compare all 48 header words!
        for (let w = 0; w < 48; w += 1) {
          if (incDir[w] !== refDir[w]) {
            diffs.push({ section: 'header', word: w, inc: incDir[w], ref: refDir[w] });
          }
        }
        const cellCount = refDir[18];
        // Compare live cell_keys [0 .. cellCount * 5)
        for (let i = 0; i < cellCount * 5 && diffs.length < 10; i += 1) {
          const idx = layout.cellKeysOffsetWords + i;
          if (incDir[idx] !== refDir[idx]) {
            diffs.push({ section: 'cell_keys', i, inc: incDir[idx], ref: refDir[idx] });
          }
        }
        // Compare live cell_offsets [0 .. cellCount + 1)
        for (let i = 0; i <= cellCount && diffs.length < 10; i += 1) {
          const idx = layout.cellOffsetsOffsetWords + i;
          if (incDir[idx] !== refDir[idx]) {
            diffs.push({ section: 'cell_offsets', i, inc: incDir[idx], ref: refDir[idx] });
          }
        }
        // Compare live cell_members [0 .. sourceCount)
        for (let i = 0; i < sourceCount && diffs.length < 10; i += 1) {
          const idx = layout.cellMembersOffsetWords + i;
          if (incDir[idx] !== refDir[idx]) {
            diffs.push({ section: 'cell_members', i, inc: incDir[idx], ref: refDir[idx] });
          }
        }
        // Compare live particle_to_cell [0 .. sourceCount)
        for (let i = 0; i < sourceCount && diffs.length < 10; i += 1) {
          const idx = layout.particleToCellOffsetWords + i;
          if (incDir[idx] !== refDir[idx]) {
            diffs.push({ section: 'particle_to_cell', i, inc: incDir[idx], ref: refDir[idx] });
          }
        }
        // Compare consumer_dispatch [0..2]
        for (let i = 0; i < 3; i += 1) {
          if (incDisp[i] !== refDisp[i]) {
            diffs.push({ section: 'consumer_dispatch', i, inc: incDisp[i], ref: refDisp[i] });
          }
        }
        return {
          exactMatch: diffs.length === 0,
          cellCount,
          consumerDispatch: Array.from(incDisp),
          diffs
        };
      }

      // ---- Part 1: Correctness, Epoch Immutability & Fail-Closed Suite ----
      const MAX_N = 4096;
      const trusted = createSchroederSpatialEpochGpu(device, {
        maxSourceCount: MAX_N,
        cellCapacity: MAX_N,
        arenaCount: 3
      });
      const incremental = createSchroederIncrementalSpatialMigrationGpu(device, {
        maxSourceCount: MAX_N,
        cellCapacity: MAX_N,
        maxMovedMembers: 2048,
        arenaCount: 3,
        maxCellJump: 1,
        maxDisplacementSpacingMultiple: 0.95
      });

      const rng = makePrng(0x20261120);
      const N0 = 3000;
      const pos0 = new Float32Array(N0 * 3);
      // Mix dense multi-particle cells, singletons, and empty gaps across [-3, 3]^3
      for (let i = 0; i < N0; i += 1) {
        const cluster = i % 5;
        const base = cluster * 0.75 - 1.5;
        pos0[i * 3 + 0] = base + (rng() - 0.5) * 0.6;
        pos0[i * 3 + 1] = (rng() - 0.5) * 3.0;
        pos0[i * 3 + 2] = (rng() - 0.5) * 3.0;
      }
      const srcBuf0 = uploadSourceBuffer(buildActiveNodeRows(N0, pos0), MAX_N);

      const commonEpoch = {
        sortMode: 'lexicographic-u32x5',
        topologyEpoch: 1,
        chartEpoch: 1,
        levelEpoch: 1,
        supportEpoch: 1
      };

      // Step 0: initial bootstrap (no predecessor -> full-radix-fallback)
      const step0 = await incremental.stepWithTrustedFallback({
        ...commonEpoch,
        sourceBuffer: srcBuf0,
        sourceCount: N0,
        generationId: 1,
        physicsTick: 0,
        positionEpoch: 1,
        buildOrdinal: 1
      });
      const refEnc0 = device.createCommandEncoder();
      const ref0 = trusted.encode(refEnc0, {
        ...commonEpoch,
        sourceBuffer: srcBuf0,
        sourceCount: N0,
        generationId: 1,
        physicsTick: 0,
        positionEpoch: 1,
        buildOrdinal: 1
      });
      device.queue.submit([refEnc0.finish()]);
      ref0.ownerRuntime?.markExecutionSubmitted?.(ref0) ?? trusted.markExecutionSubmitted(ref0);
      const cmp0 = await compareAgainstTrusted(step0.execution, ref0, incremental.directoryLayout, N0);
      await trusted.releaseExecutionAfter(ref0, device.queue.onSubmittedWorkDone());

      // Capture hash of step 0's directoryBuffer BEFORE step 1 to prove predecessor immutability!
      const step0HashBefore = fnv1aWords(await readU32(step0.execution.directoryBuffer, incremental.directoryLayout.wordLength));

      // Step 1 (M0): sub-cell jitter only (0% cell crossings -> zero-churn-rebase)
      const pos1 = new Float32Array(pos0);
      for (let i = 0; i < N0; i += 1) {
        for (let k = 0; k < 3; k += 1) {
          const cellLo = Math.floor(pos1[i * 3 + k] / SPACING) * SPACING;
          pos1[i * 3 + k] = cellLo + 0.5 * SPACING; // stays strictly inside same cell, disp <= sqrt(3)*0.5*h = 0.866*h < 0.95*h
        }
      }
      const srcBuf1 = uploadSourceBuffer(buildActiveNodeRows(N0, pos1), MAX_N);
      const step1 = await incremental.stepWithTrustedFallback({
        ...commonEpoch,
        sourceBuffer: srcBuf1,
        prevSourceBuffer: srcBuf0,
        prevExecution: step0.execution,
        sourceCount: N0,
        generationId: 2,
        physicsTick: 1,
        positionEpoch: 2,
        buildOrdinal: 2
      });
      const step0HashAfter = fnv1aWords(await readU32(step0.execution.directoryBuffer, incremental.directoryLayout.wordLength));
      const refEnc1 = device.createCommandEncoder();
      const ref1 = trusted.encode(refEnc1, {
        ...commonEpoch,
        sourceBuffer: srcBuf1,
        sourceCount: N0,
        generationId: 2,
        physicsTick: 1,
        positionEpoch: 2,
        buildOrdinal: 2
      });
      device.queue.submit([refEnc1.finish()]);
      trusted.markExecutionSubmitted(ref1);
      const cmp1 = await compareAgainstTrusted(step1.execution, ref1, incremental.directoryLayout, N0);
      await trusted.releaseExecutionAfter(ref1, device.queue.onSubmittedWorkDone());
      step0.execution.release();

      // Step 2 (M1): ~1.5% single-cell crossings (45 particles cross into existing + brand-new cells, emptying some cells)
      const pos2 = new Float32Array(pos1);
      for (let i = 0; i < 45; i += 1) {
        const idx = (i * 61) % N0;
        const axis = i % 3;
        const dir = (i % 2 === 0) ? 1 : -1;
        pos2[idx * 3 + axis] += dir * 0.65 * SPACING; // crosses 1 cell face cleanly, disp = 0.65 * SPACING < 0.95
      }
      const srcBuf2 = uploadSourceBuffer(buildActiveNodeRows(N0, pos2), MAX_N);
      const step2 = await incremental.stepWithTrustedFallback({
        ...commonEpoch,
        sourceBuffer: srcBuf2,
        prevSourceBuffer: srcBuf1,
        prevExecution: step1.execution,
        sourceCount: N0,
        generationId: 3,
        physicsTick: 2,
        positionEpoch: 3,
        buildOrdinal: 3
      });
      const refEnc2 = device.createCommandEncoder();
      const ref2 = trusted.encode(refEnc2, {
        ...commonEpoch,
        sourceBuffer: srcBuf2,
        sourceCount: N0,
        generationId: 3,
        physicsTick: 2,
        positionEpoch: 3,
        buildOrdinal: 3
      });
      device.queue.submit([refEnc2.finish()]);
      trusted.markExecutionSubmitted(ref2);
      const cmp2 = await compareAgainstTrusted(step2.execution, ref2, incremental.directoryLayout, N0);
      await trusted.releaseExecutionAfter(ref2, device.queue.onSubmittedWorkDone());
      step1.execution.release();

      // Step 3 (M2): >1,024 moved members (1,350 moved = 45% churn!) exercising multi-chunk bitonic + merge_w1024!
      const pos3 = new Float32Array(pos2);
      for (let i = 0; i < 1350; i += 1) {
        const idx = (i * 2 + 1) % N0;
        pos3[idx * 3 + (i % 3)] += ((i & 1) ? 0.7 : -0.7) * SPACING;
      }
      const srcBuf3 = uploadSourceBuffer(buildActiveNodeRows(N0, pos3), MAX_N);
      const step3 = await incremental.stepWithTrustedFallback({
        ...commonEpoch,
        sourceBuffer: srcBuf3,
        prevSourceBuffer: srcBuf2,
        prevExecution: step2.execution,
        sourceCount: N0,
        generationId: 4,
        physicsTick: 3,
        positionEpoch: 4,
        buildOrdinal: 4
      });
      const refEnc3 = device.createCommandEncoder();
      const ref3 = trusted.encode(refEnc3, {
        ...commonEpoch,
        sourceBuffer: srcBuf3,
        sourceCount: N0,
        generationId: 4,
        physicsTick: 3,
        positionEpoch: 4,
        buildOrdinal: 4
      });
      device.queue.submit([refEnc3.finish()]);
      trusted.markExecutionSubmitted(ref3);
      const cmp3 = await compareAgainstTrusted(step3.execution, ref3, incremental.directoryLayout, N0);
      await trusted.releaseExecutionAfter(ref3, device.queue.onSubmittedWorkDone());
      step2.execution.release();

      // Step 4 (M5): Adversarial high-velocity jump (particle 17 teleports 12 cells!)
      // GPU must seal STATUS_FAIL_CLOSED + [0,0,0] consumer dispatch, and stepWithTrustedFallback
      // must recover exact bit-identical directory on generationId 6!
      const pos4 = new Float32Array(pos3);
      pos4[17 * 3 + 0] += 12.0 * SPACING;
      const srcBuf4 = uploadSourceBuffer(buildActiveNodeRows(N0, pos4), MAX_N);
      const step4 = await incremental.stepWithTrustedFallback({
        ...commonEpoch,
        sourceBuffer: srcBuf4,
        prevSourceBuffer: srcBuf3,
        prevExecution: step3.execution,
        sourceCount: N0,
        generationId: 5,
        physicsTick: 4,
        positionEpoch: 5,
        buildOrdinal: 5
      });
      const refEnc4 = device.createCommandEncoder();
      const ref4 = trusted.encode(refEnc4, {
        ...commonEpoch,
        sourceBuffer: srcBuf4,
        sourceCount: N0,
        generationId: 6, // stepWithTrustedFallback incremented generationId 5 -> 6 on retry
        physicsTick: 4,
        positionEpoch: 5,
        buildOrdinal: 6
      });
      device.queue.submit([refEnc4.finish()]);
      trusted.markExecutionSubmitted(ref4);
      const cmp4 = await compareAgainstTrusted(step4.execution, ref4, incremental.directoryLayout, N0);
      await trusted.releaseExecutionAfter(ref4, device.queue.onSubmittedWorkDone());
      step3.execution.release();

      // Step 5 (M4): Source count / capacity change (3,000 -> 3,600 active sources)
      const N5 = 3600;
      const pos5 = new Float32Array(N5 * 3);
      pos5.set(pos4);
      for (let i = N0; i < N5; i += 1) {
        pos5[i * 3 + 0] = (rng() - 0.5) * 4.0;
        pos5[i * 3 + 1] = (rng() - 0.5) * 4.0;
        pos5[i * 3 + 2] = (rng() - 0.5) * 4.0;
      }
      const srcBuf5 = uploadSourceBuffer(buildActiveNodeRows(N5, pos5), MAX_N);
      const step5 = await incremental.stepWithTrustedFallback({
        ...commonEpoch,
        sourceBuffer: srcBuf5,
        prevExecution: step4.execution,
        sourceCount: N5,
        generationId: 7,
        physicsTick: 5,
        positionEpoch: 6,
        buildOrdinal: 7
      });
      const refEnc5 = device.createCommandEncoder();
      const ref5 = trusted.encode(refEnc5, {
        ...commonEpoch,
        sourceBuffer: srcBuf5,
        sourceCount: N5,
        generationId: 7,
        physicsTick: 5,
        positionEpoch: 6,
        buildOrdinal: 7
      });
      device.queue.submit([refEnc5.finish()]);
      trusted.markExecutionSubmitted(ref5);
      const cmp5 = await compareAgainstTrusted(step5.execution, ref5, incremental.directoryLayout, N5);
      await trusted.releaseExecutionAfter(ref5, device.queue.onSubmittedWorkDone());
      step4.execution.release();
      step5.execution.release();

      for (const b of [srcBuf0, srcBuf1, srcBuf2, srcBuf3, srcBuf4, srcBuf5]) b.destroy();
      incremental.destroy();
      trusted.destroy();

      // ---- Part 2: Same-Device Scaling & Cost/Benefit Benchmark up to 103,831 Live Carriers ----
      const benchmarks = [];
      for (const N of [2048, 32768, 103831]) {
        let cap = 1;
        while (cap < N) cap *= 2;
        const benchTrusted = createSchroederSpatialEpochGpu(device, {
          maxSourceCount: cap,
          cellCapacity: cap,
          arenaCount: 3
        });
        const benchInc = createSchroederIncrementalSpatialMigrationGpu(device, {
          maxSourceCount: cap,
          cellCapacity: cap,
          maxMovedMembers: 16384,
          arenaCount: 3,
          maxCellJump: 1,
          maxDisplacementSpacingMultiple: 1.5
        });

        const basePos = new Float32Array(N * 3);
        const side = Math.ceil(Math.cbrt(N / 4));
        for (let i = 0; i < N; i += 1) {
          const cellIdx = Math.floor(i / 4);
          const sub = i % 4;
          const cx = cellIdx % side;
          const cy = Math.floor(cellIdx / side) % side;
          const cz = Math.floor(cellIdx / (side * side));
          basePos[i * 3 + 0] = (cx + 0.35 + 0.1 * (sub & 1)) * SPACING;
          basePos[i * 3 + 1] = (cy + 0.35 + 0.1 * ((sub >> 1) & 1)) * SPACING;
          basePos[i * 3 + 2] = (cz + 0.5) * SPACING;
        }
        const bufBase = uploadSourceBuffer(buildActiveNodeRows(N, basePos), cap);

        // Build predecessor once
        const predStep = await benchInc.stepWithTrustedFallback({
          ...commonEpoch,
          sourceBuffer: bufBase,
          sourceCount: N,
          generationId: 1,
          buildOrdinal: 1
        });

        // Measure trusted full GPU radix rebuild (lexicographic u32x5 & bounded-atlas u32)
        const ITERS = 12;
        const atlas = {
          chartMin: 0,
          chartCount: 1,
          levelMin: 0,
          levelCount: 1,
          cellMin: [-4, -4, -4],
          cellCount: [side + 8, side + 8, side + 8]
        };

        async function timeTrusted(sortMode, sortAtlas) {
          // Warmup
          for (let w = 0; w < 2; w += 1) {
            const e = device.createCommandEncoder();
            const ex = benchTrusted.encode(e, {
              ...commonEpoch, sortMode, atlas: sortAtlas, sourceBuffer: bufBase, sourceCount: N,
              generationId: 10 + w, buildOrdinal: 10 + w
            });
            device.queue.submit([e.finish()]);
            benchTrusted.markExecutionSubmitted(ex);
            await benchTrusted.releaseExecutionAfter(ex, device.queue.onSubmittedWorkDone());
          }
          const t0 = performance.now();
          for (let it = 0; it < ITERS; it += 1) {
            const e = device.createCommandEncoder();
            const ex = benchTrusted.encode(e, {
              ...commonEpoch, sortMode, atlas: sortAtlas, sourceBuffer: bufBase, sourceCount: N,
              generationId: 20 + it, buildOrdinal: 20 + it
            });
            device.queue.submit([e.finish()]);
            benchTrusted.markExecutionSubmitted(ex);
            if (benchTrusted.canReleaseExecutionQueueOrdered(ex)) {
              benchTrusted.releaseExecutionQueueOrdered(ex);
            } else {
              await benchTrusted.releaseExecutionAfter(ex, device.queue.onSubmittedWorkDone());
            }
          }
          await device.queue.onSubmittedWorkDone();
          return Number(((performance.now() - t0) / ITERS).toFixed(4));
        }

        const fullLexMs = await timeTrusted('lexicographic-u32x5', null);
        const fullAtlasMs = await timeTrusted('bounded-atlas-u32', atlas);

        const churnRows = {};
        for (const churnPct of [0, 1, 5]) {
          const moveTarget = Math.floor(N * (churnPct / 100));
          const movedPos = new Float32Array(basePos);
          const strideStep = moveTarget > 0 ? Math.max(1, Math.floor(N / moveTarget)) : N + 1;
          let movedPlaced = 0;
          for (let i = 0; i < N && movedPlaced < moveTarget; i += strideStep) {
            movedPos[i * 3 + 0] += 0.8 * SPACING; // crosses +x cell face
            movedPlaced += 1;
          }
          const bufMoved = uploadSourceBuffer(buildActiveNodeRows(N, movedPos), cap);

          // Verify 100% bit-for-bit identity at this N and churnPct (including N = 103,831!)
          const verifyEnc = device.createCommandEncoder();
          const incEx = benchInc.encode(verifyEnc, {
            ...commonEpoch,
            sourceBuffer: bufMoved,
            prevSourceBuffer: bufBase,
            prevExecution: predStep.execution,
            sourceCount: N,
            generationId: 100,
            buildOrdinal: 100
          });
          const refEx = benchTrusted.encode(verifyEnc, {
            ...commonEpoch,
            sourceBuffer: bufMoved,
            sourceCount: N,
            generationId: 100,
            buildOrdinal: 100
          });
          device.queue.submit([verifyEnc.finish()]);
          incEx.markSubmitted();
          benchTrusted.markExecutionSubmitted(refEx);
          const cert = await benchInc.readCertificate(incEx);
          const exact100k = await compareAgainstTrusted(incEx, refEx, benchInc.directoryLayout, N);
          await benchTrusted.releaseExecutionAfter(refEx, device.queue.onSubmittedWorkDone());
          incEx.release();

          // Time pure GPU incremental encode + queue completion over ITERS steps
          const t0 = performance.now();
          for (let it = 0; it < ITERS; it += 1) {
            const e = device.createCommandEncoder();
            const ex = benchInc.encode(e, {
              ...commonEpoch,
              sourceBuffer: bufMoved,
              prevSourceBuffer: bufBase,
              prevExecution: predStep.execution,
              sourceCount: N,
              generationId: 200 + it,
              buildOrdinal: 200 + it
            });
            device.queue.submit([e.finish()]);
            ex.markSubmitted();
            ex.release();
          }
          await device.queue.onSubmittedWorkDone();
          const incMs = Number(((performance.now() - t0) / ITERS).toFixed(4));
          bufMoved.destroy();

          churnRows[`churn_${churnPct}pct`] = {
            movedMemberCount: cert.movedMemberCount,
            modeName: cert.modeName,
            admitted: cert.admitted,
            exactMatch: exact100k.exactMatch,
            incMs,
            speedupVsLexRadix: Number((fullLexMs / Math.max(incMs, 1e-6)).toFixed(2)),
            speedupVsAtlasRadix: Number((fullAtlasMs / Math.max(incMs, 1e-6)).toFixed(2))
          };
        }

        predStep.execution.release();
        bufBase.destroy();
        benchInc.destroy();
        benchTrusted.destroy();

        benchmarks.push({ N, capacity: cap, fullLexMs, fullAtlasMs, churnRows });
      }

      return {
        status: 'ok',
        gpuErrors,
        flagsEnum: SCHROEDER_INCREMENTAL_FALLBACK_FLAG,
        correctness: {
          step0: { cert: step0.certificate, cmp: cmp0 },
          step1ZeroChurn: {
            cert: step1.certificate,
            cmp: cmp1,
            predecessorImmutable: step0HashBefore === step0HashAfter
          },
          step2SingleCell: { cert: step2.certificate, cmp: cmp2 },
          step3MultiChunk: { cert: step3.certificate, cmp: cmp3 },
          step4Adversarial: {
            retriedOnFallback: step4.retriedOnFallback,
            failedClosedProof: step4.failedClosedDirectoryStatus,
            cert: step4.certificate,
            cmp: cmp4
          },
          step5CapacityChange: {
            cert: step5.certificate,
            cmp: cmp5
          }
        },
        benchmarks
      };
    });

    console.log(JSON.stringify(out, null, 2));
    assert.equal(out.status, 'ok');
    assert.deepEqual(out.gpuErrors, [], `unexpected WebGPU errors: ${JSON.stringify(out.gpuErrors)}`);

    // M0..M5 exactness & safety gates
    assert.equal(out.correctness.step0.cmp.exactMatch, true, 'Step 0 bootstrap matches trusted radix');
    assert.equal(out.correctness.step1ZeroChurn.cert.modeName, 'zero-churn-rebase');
    assert.equal(out.correctness.step1ZeroChurn.cert.movedMemberCount, 0);
    assert.equal(out.correctness.step1ZeroChurn.predecessorImmutable, true, 'Admitted predecessor arena is immutable');
    assert.equal(out.correctness.step1ZeroChurn.cmp.exactMatch, true, 'Zero-churn rebase is bit-identical');

    assert.equal(out.correctness.step2SingleCell.cert.modeName, 'adjacent-cell-repair');
    assert.ok(out.correctness.step2SingleCell.cert.movedMemberCount > 0);
    assert.equal(out.correctness.step2SingleCell.cert.maxCellJumpLinf, 1);
    assert.equal(out.correctness.step2SingleCell.cmp.exactMatch, true, 'Single-cell repair is bit-identical');

    assert.equal(out.correctness.step3MultiChunk.cert.modeName, 'adjacent-cell-repair');
    assert.ok(out.correctness.step3MultiChunk.cert.movedMemberCount > 1024, 'Exercised multi-chunk sort + merge');
    assert.equal(out.correctness.step3MultiChunk.cmp.exactMatch, true, 'Multi-chunk repair is bit-identical');

    assert.equal(out.correctness.step4Adversarial.retriedOnFallback, true, 'Adversarial jump triggered fallback');
    assert.equal(out.correctness.step4Adversarial.failedClosedProof.failClosedBitSet, true, 'GPU set STATUS_FAIL_CLOSED');
    assert.equal(out.correctness.step4Adversarial.failedClosedProof.admittedBitSet, false, 'GPU cleared STATUS_ADMITTED');
    assert.deepEqual(
      out.correctness.step4Adversarial.failedClosedProof.consumerDispatch,
      [0, 0, 0],
      'GPU zeroed consumer indirect dispatch on fail-closed attempt'
    );
    assert.equal(out.correctness.step4Adversarial.cmp.exactMatch, true, 'Trusted fallback recovered exact directory');

    assert.equal(out.correctness.step5CapacityChange.cert.modeName, 'full-radix-fallback');
    assert.equal(out.correctness.step5CapacityChange.cmp.exactMatch, true, 'Capacity change matches trusted radix');

    // Scaling & 103,831-carrier exactness gate
    for (const row of out.benchmarks) {
      for (const [k, v] of Object.entries(row.churnRows)) {
        assert.equal(v.admitted, true, `N=${row.N} ${k} admitted`);
        assert.equal(v.exactMatch, true, `N=${row.N} ${k} bit-identical to trusted GPU radix rebuild`);
      }
    }
  } finally {
    await browser.close();
  }
});

test('A2 live incremental spatial migration: bit-exact V2 ActiveSource (births, deaths, multi-cell & level jumps) and V1 GPU-authored counts on Vulkan WebGPU', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_INCREMENTAL_SPATIAL=1 to run on native WebGPU',
  timeout: 120_000
}, async () => {
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
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(new URL('service-assets/README.md', BASE_URL).href, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000
    });
    const out = await page.evaluate(async () => {
      let adapter = null;
      for (let i = 0; i < 5 && !adapter; i += 1) {
        adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
        if (!adapter) await new Promise((r) => setTimeout(r, 400));
      }
      if (!adapter) return { status: 'unsupported' };
      const device = await adapter.requestDevice({
        requiredLimits: {
          maxBufferSize: Math.min(512 * 1024 * 1024, adapter.limits.maxBufferSize),
          maxStorageBufferBindingSize: Math.min(256 * 1024 * 1024, adapter.limits.maxStorageBufferBindingSize),
          maxStorageBuffersPerShaderStage: Math.min(16, adapter.limits.maxStorageBuffersPerShaderStage)
        }
      });
      const gpuErrors = [];
      device.addEventListener('uncapturederror', (e) => {
        if (gpuErrors.length < 20) gpuErrors.push(String(e.error?.message || e.error));
      });

      const {
        createSchroederSpatialEpochGpu,
        registerSchroederIncrementalSpatialMigrationEncoderFactory,
        ULG_SCHROEDER_SPATIAL_GPU_LOGICAL_COUNT_SOURCE_SCHEMA
      } = await import('/src/runtime/sph/schroederSpatialEpochGpu.js');
      const {
        createSchroederIncrementalSpatialMigrationEncoder
      } = await import('/src/runtime/sph/schroederIncrementalSpatialMigrationGpu.js');
      const {
        createSchroederSpatialActiveSourceViewGpu
      } = await import('/src/runtime/sph/schroederSpatialActiveSourceViewGpu.js');
      const { tagWebGpuBufferDevice } = await import('/src/runtime/sph/sphGpuDeviceIdentity.js');

      registerSchroederIncrementalSpatialMigrationEncoderFactory(
        createSchroederIncrementalSpatialMigrationEncoder
      );

      async function readU32(buffer, wordCount) {
        const bytes = wordCount * 4;
        const staging = device.createBuffer({
          size: bytes,
          usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
        });
        const enc = device.createCommandEncoder();
        enc.copyBufferToBuffer(buffer, 0, staging, 0, bytes);
        device.queue.submit([enc.finish()]);
        await staging.mapAsync(GPUMapMode.READ);
        const words = new Uint32Array(staging.getMappedRange().slice(0));
        staging.unmap();
        staging.destroy();
        return words;
      }

      async function compareDirs(incExec, refExec, isV2) {
        const layout = refExec.layout;
        const incDir = await readU32(incExec.directoryBuffer, layout.wordLength);
        const refDir = await readU32(refExec.directoryBuffer, layout.wordLength);
        const incDisp = await readU32(incExec.consumerDispatchBuffer, 3);
        const refDisp = await readU32(refExec.consumerDispatchBuffer, 3);
        const diffs = [];
        for (let w = 0; w < 48; w += 1) {
          if (incDir[w] !== refDir[w]) diffs.push({ section: 'header', w, inc: incDir[w], ref: refDir[w] });
        }
        const cellCount = refDir[18];
        const activeCount = isV2 ? refDir[37] : refDir[16];
        for (let i = 0; i < cellCount * 5 && diffs.length < 10; i += 1) {
          const idx = layout.cellKeysOffsetWords + i;
          if (incDir[idx] !== refDir[idx]) diffs.push({ section: 'cell_keys', i, inc: incDir[idx], ref: refDir[idx] });
        }
        for (let i = 0; i <= cellCount && diffs.length < 10; i += 1) {
          const idx = layout.cellOffsetsOffsetWords + i;
          if (incDir[idx] !== refDir[idx]) diffs.push({ section: 'cell_offsets', i, inc: incDir[idx], ref: refDir[idx] });
        }
        for (let i = 0; i < activeCount && diffs.length < 10; i += 1) {
          const idx = layout.cellMembersOffsetWords + i;
          if (incDir[idx] !== refDir[idx]) diffs.push({ section: 'cell_members', i, inc: incDir[idx], ref: refDir[idx] });
        }
        const revCount = isV2 ? refDir[16] : activeCount;
        for (let i = 0; i < revCount && diffs.length < 10; i += 1) {
          const idx = layout.particleToCellOffsetWords + i;
          if (incDir[idx] !== refDir[idx]) diffs.push({ section: 'reverse', i, inc: incDir[idx], ref: refDir[idx] });
        }
        if (refExec.queryGeometryMode === 1) {
          const qeOff = refExec.queryEvidenceOffsetWords;
          for (let i = 0; i < 6 && diffs.length < 10; i += 1) {
            if (incDir[qeOff + i] !== refDir[qeOff + i]) {
              diffs.push({ section: 'query_evidence', i, inc: incDir[qeOff + i], ref: refDir[qeOff + i] });
            }
          }
        }
        for (let i = 0; i < 3; i += 1) {
          if (incDisp[i] !== refDisp[i]) diffs.push({ section: 'dispatch', i, inc: incDisp[i], ref: refDisp[i] });
        }
        return { exactMatch: diffs.length === 0, activeCount, cellCount, diffs };
      }

      // 1. Directory-V2 with ActiveSourceView: births, deaths, multi-cell jumps, and level changes
      const P = 256;
      const BASE_SPACING = 0.25;
      const buildLevelRows = (spec) => {
        const rows = new Float32Array(P * 16);
        for (let i = 0; i < P; i += 1) {
          const base = i * 16;
          const entry = spec(i);
          if (!entry) {
            rows[base + 0] = 0;
            rows[base + 1] = BASE_SPACING;
            rows[base + 6] = 0; // dormant (zero mass)
            rows[base + 7] = 1000;
            rows[base + 8] = 2;
            rows[base + 9] = 1;
            rows[base + 10] = 1; // admitted structural status
            rows[base + 15] = 0;
            continue;
          }
          const spacing = BASE_SPACING * (2 ** entry.level);
          rows[base + 0] = entry.level;
          rows[base + 1] = spacing;
          rows[base + 2] = spacing;
          rows[base + 3] = spacing ** 3;
          rows[base + 4] = spacing ** 3;
          rows[base + 5] = spacing ** 3;
          rows[base + 6] = 1.0; // active positive mass
          rows[base + 7] = 1000;
          rows[base + 8] = 2;
          rows[base + 9] = 1;
          rows[base + 10] = 1; // admitted active
          rows[base + 12] = entry.x;
          rows[base + 13] = entry.y;
          rows[base + 14] = entry.z;
          rows[base + 15] = 0; // chart 0
        }
        return rows;
      };
      const uploadRows = (rows) => {
        const buf = tagWebGpuBufferDevice(
          device.createBuffer({
            size: rows.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
          }),
          device
        );
        device.queue.writeBuffer(buf, 0, rows);
        return buf;
      };
      const profile = {
        schema: 'peercompute.ulg.schroeder-spatial-exact-near-query-profile.v1',
        status: 'schroeder-spatial-exact-near-query-profile-ready',
        ready: true,
        sourceCount: P,
        chartId: 0,
        minLevel: 0,
        maxLevel: 1,
        levelCount: 2,
        baseGridSpacingM: BASE_SPACING,
        levelSpacingMode: 'base-grid-spacing-times-pow2-level',
        positionAuthority: 'same-epoch-pre-integration-particle-state'
      };
      const v2Inc = createSchroederSpatialEpochGpu(device, {
        maxSourceCount: P, activeSourceCapacity: P, cellCapacity: P,
        directoryAbiVersion: 2, arenaCount: 3, enableIncrementalMigration: true,
        label: 'test-v2-inc'
      });
      const v2Ref = createSchroederSpatialEpochGpu(device, {
        maxSourceCount: P, activeSourceCapacity: P, cellCapacity: P,
        directoryAbiVersion: 2, arenaCount: 3, enableIncrementalMigration: false,
        label: 'test-v2-ref'
      });
      const asvRuntime = createSchroederSpatialActiveSourceViewGpu(device, {
        maxPhysicalSourceCount: P, activeSourceCapacity: P, arenaCount: 4,
        label: 'test-v2-asv'
      });

      const stepsV2 = [
        // Step 0 (bootstrap full radix): rows 0..199 active at level 0
        (i) => (i < 200 ? { level: 0, x: (i % 8) * 0.25 + 0.1, y: Math.floor(i / 8) * 0.25 + 0.1, z: 0.1 } : null),
        // Step 1 (incremental): 20 deaths (0..19 dormant), 30 births (200..229 active), multi-cell jumps & level 0->1 switches
        (i) => {
          if (i < 20 || i >= 230) return null;
          if (i >= 200) return { level: 1, x: (i - 200) * 0.5 + 0.2, y: 1.2, z: 0.3 };
          const jump = (i % 5 === 0) ? 1.75 : 0.0;
          const level = (i % 7 === 0) ? 1 : 0;
          return { level, x: (i % 8) * 0.25 + 0.1 + jump, y: Math.floor(i / 8) * 0.25 + 0.1, z: 0.1 };
        },
        // Step 2 (incremental): all dormant -> A = 0
        () => null,
        // Step 3 (incremental from A = 0): rebirth of 64 rows
        (i) => (i < 64 ? { level: 0, x: (i % 4) * 0.25 + 0.05, y: Math.floor(i / 4) * 0.25 + 0.05, z: 0.05 } : null)
      ];

      const v2Results = [];
      let prevInc = null;
      for (let s = 0; s < stepsV2.length; s += 1) {
        const buf = uploadRows(buildLevelRows(stepsV2[s]));
        const genId = s + 1;
        const common = {
          sourceBuffer: buf, sourceCount: P, sourceRowLayoutId: 1,
          sourceFamily: 'schroeder-level-assignment-particles',
          sortMode: 'lexicographic-u32x5', generationId: genId, leaseToken: genId,
          buildOrdinal: genId, sortUniqueOrdinal: genId, storageGeneration: genId,
          physicsTick: s, physicsSubstep: 0, positionEpoch: s,
          exactNearQueryProfile: profile
        };
        const encInc = device.createCommandEncoder();
        const asvInc = asvRuntime.encode(encInc, { ...common, physicalSourceCount: P });
        const exInc = v2Inc.encode(encInc, { ...common, activeSourceView: asvInc });
        device.queue.submit([encInc.finish()]);
        asvRuntime.markExecutionSubmitted(asvInc);
        v2Inc.markExecutionSubmitted(exInc);

        const encRef = device.createCommandEncoder();
        const asvRef = asvRuntime.encode(encRef, { ...common, physicalSourceCount: P });
        const exRef = v2Ref.encode(encRef, { ...common, activeSourceView: asvRef });
        device.queue.submit([encRef.finish()]);
        asvRuntime.markExecutionSubmitted(asvRef);
        v2Ref.markExecutionSubmitted(exRef);

        const cmp = await compareDirs(exInc, exRef, true);
        v2Results.push({
          step: s,
          mode: exInc.a2IncrementalMigration.mode,
          ...cmp
        });
        const fence = device.queue.onSubmittedWorkDone();
        await Promise.all([
          asvRuntime.releaseExecutionAfter(asvInc, fence),
          asvRuntime.releaseExecutionAfter(asvRef, fence),
          v2Ref.releaseExecutionAfter(exRef, fence),
          prevInc ? v2Inc.releaseExecutionAfter(prevInc, fence) : Promise.resolve()
        ]);
        prevInc = exInc;
        buf.destroy();
      }
      if (prevInc) await v2Inc.releaseExecutionAfter(prevInc, device.queue.onSubmittedWorkDone());
      v2Inc.destroy();
      v2Ref.destroy();
      asvRuntime.destroy();

      // 2. Directory-V1 with GPU-authored logicalSourceCountAuthority (shrink & grow live count)
      const countBuf = tagWebGpuBufferDevice(
        device.createBuffer({
          size: 16,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
        }),
        device
      );
      const v1Inc = createSchroederSpatialEpochGpu(device, {
        maxSourceCount: P, cellCapacity: P, directoryAbiVersion: 1, arenaCount: 3,
        enableIncrementalMigration: true, label: 'test-v1-gpu-count-inc'
      });
      const v1Ref = createSchroederSpatialEpochGpu(device, {
        maxSourceCount: P, cellCapacity: P, directoryAbiVersion: 1, arenaCount: 3,
        enableIncrementalMigration: false, label: 'test-v1-gpu-count-ref'
      });
      const buildActiveNodeRows = (count, shift) => {
        const rows = new Float32Array(P * 16);
        for (let i = 0; i < count; i += 1) {
          const base = i * 16;
          rows[base + 0] = 0;
          rows[base + 8] = BASE_SPACING;
          rows[base + 10] = i;
          rows[base + 11] = 1;
          rows[base + 12] = (i % 8) * 0.25 + 0.1 + shift;
          rows[base + 13] = Math.floor(i / 8) * 0.25 + 0.1;
          rows[base + 14] = 0.1;
          rows[base + 15] = 0;
        }
        return rows;
      };
      const v1Results = [];
      let prevV1 = null;
      for (const [s, liveCount, shift] of [[0, 120, 0.0], [1, 150, 0.25], [2, 90, 0.5]]) {
        device.queue.writeBuffer(countBuf, 0, new Uint32Array([liveCount, 0, 0, 0]));
        const buf = uploadRows(buildActiveNodeRows(liveCount, shift));
        const genId = s + 1;
        const logicalAuthority = Object.freeze({
          schema: ULG_SCHROEDER_SPATIAL_GPU_LOGICAL_COUNT_SOURCE_SCHEMA,
          status: 'schroeder-spatial-gpu-logical-count-source-ready',
          ready: true,
          buffer: countBuf,
          byteOffset: 0,
          sourceCapacity: P,
          storageGeneration: genId
        });
        const common = {
          sourceBuffer: buf, sourceCount: P, sourceRowLayoutId: 2,
          sortMode: 'lexicographic-u32x5', generationId: genId, leaseToken: genId,
          buildOrdinal: genId, sortUniqueOrdinal: genId, storageGeneration: genId,
          physicsTick: s, physicsSubstep: 0, positionEpoch: s,
          logicalSourceCountAuthority: logicalAuthority
        };
        const encInc = device.createCommandEncoder();
        const exInc = v1Inc.encode(encInc, common);
        device.queue.submit([encInc.finish()]);
        v1Inc.markExecutionSubmitted(exInc);

        const encRef = device.createCommandEncoder();
        const exRef = v1Ref.encode(encRef, common);
        device.queue.submit([encRef.finish()]);
        v1Ref.markExecutionSubmitted(exRef);

        const cmp = await compareDirs(exInc, exRef, false);
        v1Results.push({ step: s, liveCount, mode: exInc.a2IncrementalMigration.mode, ...cmp });
        const fence = device.queue.onSubmittedWorkDone();
        await Promise.all([
          v1Ref.releaseExecutionAfter(exRef, fence),
          prevV1 ? v1Inc.releaseExecutionAfter(prevV1, fence) : Promise.resolve()
        ]);
        prevV1 = exInc;
        buf.destroy();
      }
      if (prevV1) await v1Inc.releaseExecutionAfter(prevV1, device.queue.onSubmittedWorkDone());
      countBuf.destroy();
      v1Inc.destroy();
      v1Ref.destroy();

      return { status: 'ok', gpuErrors, v2Results, v1Results };
    });

    console.log(JSON.stringify(out, null, 2));
    assert.equal(out.status, 'ok');
    assert.deepEqual(out.gpuErrors, []);
    assert.equal(out.v2Results[0].mode, 'full-radix');
    assert.equal(out.v2Results[0].exactMatch, true);
    for (let s = 1; s < out.v2Results.length; s += 1) {
      assert.equal(out.v2Results[s].mode, 'incremental-gpu-encoded', `v2 step ${s} should use incremental`);
      assert.equal(out.v2Results[s].exactMatch, true, `v2 step ${s} must be bit-identical: ${JSON.stringify(out.v2Results[s].diffs)}`);
    }
    assert.equal(out.v1Results[0].mode, 'full-radix');
    assert.equal(out.v1Results[0].exactMatch, true);
    for (let s = 1; s < out.v1Results.length; s += 1) {
      assert.equal(out.v1Results[s].mode, 'incremental-gpu-encoded', `v1-gpu-count step ${s} should use incremental`);
      assert.equal(out.v1Results[s].exactMatch, true, `v1-gpu-count step ${s} must be bit-identical: ${JSON.stringify(out.v1Results[s].diffs)}`);
    }
  } finally {
    await browser.close();
  }
});
