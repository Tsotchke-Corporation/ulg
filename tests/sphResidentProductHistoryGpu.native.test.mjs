import assert from 'node:assert/strict';
import test from 'node:test';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_PRODUCT_HISTORY === '1';
const NATIVE_BASE_URL = process.env.ULG_PRODUCT_HISTORY_BASE_URL
  || 'https://127.0.0.1:5174/';
const NATIVE_CHROME = process.env.ULG_PRODUCT_HISTORY_CHROME
  || '/usr/bin/google-chrome';

test('native WebGPU filters, seals, and failure-atomically branches resident product history', {
  skip: RUN_NATIVE
    ? false
    : 'set ULG_RUN_NATIVE_PRODUCT_HISTORY=1 for native Vulkan WebGPU',
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
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(NATIVE_BASE_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000
    });
    native = await page.evaluate(async () => {
      const adapter = await navigator.gpu?.requestAdapter({
        powerPreference: 'high-performance'
      });
      if (!adapter) {
        return { status: 'unsupported', reason: 'WebGPU adapter unavailable' };
      }
      const device = await adapter.requestDevice();
      const uncapturedErrors = [];
      device.addEventListener('uncapturederror', (event) => {
        uncapturedErrors.push(event.error?.message || String(event.error));
      });
      device.pushErrorScope('validation');

      const nonce = Date.now();
      const [
        { sphResidentProductHistoryFilteredAppendWgsl },
        {
          createResidentProductEventCountControlWords,
          SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_PREFIX_BYTES,
          SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_MAGIC,
          SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_STATUS_FAILED,
          SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_STATUS_READY
        },
        { mergeResidentProductMassBuffersWebGpu },
        { tagResidentProductMassDevice }
      ] = await Promise.all([
        import(`/ulg-gpu-abi/src/wgsl.js?nativeProductHistory=${nonce}`),
        import(
          `/src/runtime/sph/sphResidentProductHistoryGpu.js`
            + `?nativeProductHistory=${nonce}`
        ),
        import(
          `/src/runtime/sph/sphMlsMpmGpuStep.js`
            + `?nativeProductHistory=${nonce}`
        ),
        import(
          `/src/runtime/sph/sphGpuDeviceIdentity.js`
            + `?nativeProductHistory=${nonce}`
        )
      ]);

      const module = device.createShaderModule({
        label: 'native-resident-product-history-filtered-append',
        code: sphResidentProductHistoryFilteredAppendWgsl
      });
      const compilationInfo = await module.getCompilationInfo();
      const compilationErrors = compilationInfo.messages
        .filter((message) => message.type === 'error')
        .map((message) => message.message);
      const pipeline = await device.createComputePipelineAsync({
        label: 'native-resident-product-history-filtered-append',
        layout: 'auto',
        compute: {
          module,
          entryPoint: 'append_filtered_sources'
        }
      });

      const ROW_FLOATS = 32;
      const ROW_STRIDE_VEC4 = 8;
      const CONTROL_BYTES = 256;
      const HISTORY_ERROR_CAPACITY = 4;

      const liveRow = (id) => {
        const row = new Float32Array(ROW_FLOATS);
        row[0] = id;
        row[11] = 1;
        row[13] = 1;
        row[17] = 1;
        row[18] = 1;
        row[30] = 1;
        return row;
      };
      const rows = (...sourceRows) => {
        const packed = new Float32Array(sourceRows.length * ROW_FLOATS);
        sourceRows.forEach((row, index) => {
          packed.set(row, index * ROW_FLOATS);
        });
        return packed;
      };
      const storageBuffer = (label, contents) => {
        const byteLength = Math.max(4, contents.byteLength);
        const buffer = device.createBuffer({
          label,
          size: byteLength,
          usage:
            GPUBufferUsage.STORAGE
            | GPUBufferUsage.COPY_DST
            | GPUBufferUsage.COPY_SRC
        });
        if (contents.byteLength > 0) {
          device.queue.writeBuffer(buffer, 0, contents);
        }
        return buffer;
      };
      const controlWords = ({
        liveRowCount,
        rowCapacity,
        generation,
        seal
      }) => createResidentProductEventCountControlWords({
        status: SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_STATUS_READY,
        liveRowCount,
        rowCapacity,
        rowStrideVec4: ROW_STRIDE_VEC4,
        generation,
        seal
      });
      const appendParams = ({
        sourceARowCount,
        sourceBRowCount,
        rowCapacity,
        reuseParentPrefix,
        sourceAUsesParentCount,
        parentGeneration,
        parentSeal,
        nextGeneration,
        nextSeal,
        parentRowCapacity
      }) => Uint32Array.from([
        sourceARowCount,
        sourceBRowCount,
        rowCapacity,
        ROW_STRIDE_VEC4,
        reuseParentPrefix ? 1 : 0,
        sourceAUsesParentCount ? 1 : 0,
        parentGeneration,
        parentSeal,
        nextGeneration,
        nextSeal,
        parentRowCapacity,
        ROW_STRIDE_VEC4
      ]);
      const readBytes = async (buffer, byteLength, sourceOffset = 0) => {
        const readback = device.createBuffer({
          label: 'native-resident-product-history-readback',
          size: byteLength,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        const encoder = device.createCommandEncoder();
        encoder.copyBufferToBuffer(
          buffer,
          sourceOffset,
          readback,
          0,
          byteLength
        );
        device.queue.submit([encoder.finish()]);
        await readback.mapAsync(GPUMapMode.READ);
        const bytes = readback.getMappedRange().slice(0, byteLength);
        readback.unmap();
        readback.destroy();
        return bytes;
      };
      const runCase = async ({
        label,
        initialHistory,
        sourceA,
        sourceB,
        params,
        parentControlBuffer,
        parentControlOffset = 0,
        nextControlBuffer,
        nextControlOffset = 0
      }) => {
        const historyBuffer = storageBuffer(`${label}-history`, initialHistory);
        const sourceABuffer = storageBuffer(`${label}-source-a`, sourceA);
        const sourceBBuffer = storageBuffer(`${label}-source-b`, sourceB);
        const paramsBuffer = device.createBuffer({
          label: `${label}-params`,
          size: params.byteLength,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        device.queue.writeBuffer(paramsBuffer, 0, params);
        const bindGroup = device.createBindGroup({
          label: `${label}-bind-group`,
          layout: pipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: historyBuffer } },
            { binding: 1, resource: { buffer: sourceABuffer } },
            { binding: 2, resource: { buffer: sourceBBuffer } },
            {
              binding: 3,
              resource: {
                buffer: parentControlBuffer,
                offset: parentControlOffset,
                size: CONTROL_BYTES
              }
            },
            {
              binding: 4,
              resource: {
                buffer: nextControlBuffer,
                offset: nextControlOffset,
                size: CONTROL_BYTES
              }
            },
            { binding: 5, resource: { buffer: paramsBuffer } }
          ]
        });
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginComputePass();
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.dispatchWorkgroups(1);
        pass.end();
        device.queue.submit([encoder.finish()]);
        await device.queue.onSubmittedWorkDone();
        const [historyBytes, nextControlBytes] = await Promise.all([
          readBytes(historyBuffer, initialHistory.byteLength),
          readBytes(nextControlBuffer, 48, nextControlOffset)
        ]);
        historyBuffer.destroy();
        sourceABuffer.destroy();
        sourceBBuffer.destroy();
        paramsBuffer.destroy();
        return {
          history: Array.from(new Float32Array(historyBytes)),
          nextControl: Array.from(new Uint32Array(nextControlBytes))
        };
      };

      const stableA11 = liveRow(11);
      const stableA12 = liveRow(12);
      stableA12[18] = 0;
      const stableA13 = liveRow(13);
      stableA13[30] = 0;
      const stableA14 = liveRow(14);
      const stableB21 = liveRow(21);
      stableB21[11] = 0;
      const stableB22 = liveRow(22);
      stableB22[17] = 0;
      const stableB23 = liveRow(23);
      stableB23[13] = 0;
      const stableB24 = liveRow(24);
      const stableB25 = liveRow(25);
      const stableHistory = new Float32Array(8 * ROW_FLOATS);
      const stableParentControlContents = controlWords({
        liveRowCount: 0,
        rowCapacity: 8,
        generation: 1,
        seal: 101
      });
      const stableParentControlBuffer = storageBuffer(
        'stable-parent-control',
        stableParentControlContents
      );
      const stableNextControlBuffer = storageBuffer(
        'stable-next-control',
        new Uint32Array(64)
      );
      const stable = await runCase({
        label: 'stable-filter',
        initialHistory: stableHistory,
        sourceA: rows(stableA11, stableA12, stableA13, stableA14),
        sourceB: rows(stableB21, stableB22, stableB23, stableB24, stableB25),
        params: appendParams({
          sourceARowCount: 4,
          sourceBRowCount: 5,
          rowCapacity: 8,
          reuseParentPrefix: false,
          sourceAUsesParentCount: false,
          parentGeneration: 1,
          parentSeal: 101,
          nextGeneration: 2,
          nextSeal: 202,
          parentRowCapacity: 8
        }),
        parentControlBuffer: stableParentControlBuffer,
        nextControlBuffer: stableNextControlBuffer
      });
      stable.expectedPrefix = Array.from(rows(
        stableA11,
        stableA14,
        stableB24,
        stableB25
      ));
      stableParentControlBuffer.destroy();
      stableNextControlBuffer.destroy();

      const overflowRow31 = liveRow(31);
      const overflowSentinel = new Float32Array(ROW_FLOATS);
      for (let index = 0; index < ROW_FLOATS; index += 1) {
        overflowSentinel[index] = 99 + index / 100;
      }
      const overflowInitialHistory = rows(
        overflowRow31,
        overflowSentinel
      );
      const overflowParentControlContents = controlWords({
        liveRowCount: 1,
        rowCapacity: 2,
        generation: 3,
        seal: 303
      });
      const overflowParentControlBuffer = storageBuffer(
        'overflow-parent-control',
        overflowParentControlContents
      );
      const overflowNextControlBuffer = storageBuffer(
        'overflow-next-control',
        new Uint32Array(64)
      );
      const overflow = await runCase({
        label: 'overflow-atomic',
        initialHistory: overflowInitialHistory,
        sourceA: rows(liveRow(32), liveRow(33)),
        sourceB: rows(new Float32Array(ROW_FLOATS)),
        params: appendParams({
          sourceARowCount: 2,
          sourceBRowCount: 0,
          rowCapacity: 2,
          reuseParentPrefix: true,
          sourceAUsesParentCount: false,
          parentGeneration: 3,
          parentSeal: 303,
          nextGeneration: 4,
          nextSeal: 404,
          parentRowCapacity: 2
        }),
        parentControlBuffer: overflowParentControlBuffer,
        nextControlBuffer: overflowNextControlBuffer
      });
      overflow.initialHistory = Array.from(overflowInitialHistory);
      overflow.parentControl = Array.from(new Uint32Array(
        await readBytes(overflowParentControlBuffer, 48, 0)
      ));
      overflow.expectedParentControl = Array.from(
        overflowParentControlContents.slice(0, 12)
      );
      overflowParentControlBuffer.destroy();
      overflowNextControlBuffer.destroy();

      const branchParentRows = rows(liveRow(41), liveRow(42));
      const branchParentControlContents = controlWords({
        liveRowCount: 2,
        rowCapacity: 2,
        generation: 5,
        seal: 505
      });
      const branchParentControlBuffer = storageBuffer(
        'branch-parent-control',
        branchParentControlContents
      );
      const branchNextControlBuffer = storageBuffer(
        'branch-next-control',
        new Uint32Array(64)
      );
      const branch = await runCase({
        label: 'larger-destination-branch',
        initialHistory: new Float32Array(4 * ROW_FLOATS),
        sourceA: branchParentRows,
        sourceB: rows(liveRow(43)),
        params: appendParams({
          sourceARowCount: 2,
          sourceBRowCount: 1,
          rowCapacity: 4,
          reuseParentPrefix: false,
          sourceAUsesParentCount: true,
          parentGeneration: 5,
          parentSeal: 505,
          nextGeneration: 6,
          nextSeal: 606,
          parentRowCapacity: 2
        }),
        parentControlBuffer: branchParentControlBuffer,
        nextControlBuffer: branchNextControlBuffer
      });
      branchParentControlBuffer.destroy();
      branchNextControlBuffer.destroy();

      const runtimeSourceBuffers = [];
      const runtimeProductHandle = (label, id, {
        rowCount = 1
      } = {}) => {
        const productRows = new Float32Array(rowCount * ROW_FLOATS);
        productRows.set(liveRow(id), 0);
        const productEventBuffer = storageBuffer(label, productRows);
        runtimeSourceBuffers.push(productEventBuffer);
        let destroyed = false;
        return tagResidentProductMassDevice({
          schema: 'peercompute.ulg.sph-resident-product-mass.v0',
          status: 'resident-product-mass-buffer-retained',
          source: 'native-product-history-runtime-integration',
          productEventBuffer,
          productEventBufferRetained: true,
          productEventBufferByteLength: productRows.byteLength,
          productEventRowCount: rowCount,
          productEventActiveEventCount: 1,
          productEventStrideFloats: ROW_FLOATS,
          productEventStrideBytes: ROW_FLOATS * Float32Array.BYTES_PER_ELEMENT,
          productEventGenerationCount: 1,
          productEventSourceRowCounts: [rowCount],
          mergeSourceProductEventBufferCount: 1,
          mergeSourceProductEventRowCounts: [rowCount],
          mergeSourceProductEventBufferByteLengths: [
            productRows.byteLength
          ],
          visibleProductMassKg: 0,
          unplacedProductMassKg: 1,
          unplacedGasProductMassKg: 0,
          sealedBoxGasProductMoles: 0,
          consumeMassPolicy: 'unplaced-product-mass-only',
          visibleMassAlreadyInParticleBuffers: true,
          destroyResidentProductMassBuffers() {
            if (destroyed) return null;
            destroyed = true;
            productEventBuffer.destroy();
            return true;
          }
        }, device);
      };
      const runtimeSeed = runtimeProductHandle('runtime-history-seed', 51);
      const runtimeEmittedA = runtimeProductHandle(
        'runtime-history-emitted-a',
        52
      );
      const runtimeFirst = await mergeResidentProductMassBuffersWebGpu({
        device,
        inputResidentProductMass: runtimeSeed,
        emittedResidentProductMass: runtimeEmittedA,
        allowHostCompactionObservation: false
      });
      const runtimeEmittedB = runtimeProductHandle(
        'runtime-history-emitted-b',
        53,
        { rowCount: 32767 }
      );
      const runtimeSecond = await mergeResidentProductMassBuffersWebGpu({
        device,
        inputResidentProductMass: runtimeFirst,
        emittedResidentProductMass: runtimeEmittedB,
        allowHostCompactionObservation: false
      });
      const runtimeFirstAuthority =
        runtimeFirst.productEventRowCountAuthority;
      runtimeFirst.destroyResidentProductMassBuffers();
      const runtimeEmittedC = runtimeProductHandle(
        'runtime-history-emitted-c',
        54,
        {
          rowCount:
            65537 - runtimeSecond.productEventLiveRowCountUpperBound
        }
      );
      const runtimeThird = await mergeResidentProductMassBuffersWebGpu({
        device,
        inputResidentProductMass: runtimeSecond,
        emittedResidentProductMass: runtimeEmittedC,
        allowHostCompactionObservation: false
      });
      const runtimeEmittedD = runtimeProductHandle(
        'runtime-history-emitted-ceiling-clamp',
        55,
        {
          rowCount:
            262145 - runtimeThird.productEventLiveRowCountUpperBound
        }
      );
      const runtimeFourth = await mergeResidentProductMassBuffersWebGpu({
        device,
        inputResidentProductMass: runtimeThird,
        emittedResidentProductMass: runtimeEmittedD,
        allowHostCompactionObservation: false
      });
      const runtimeEmittedE = runtimeProductHandle(
        'runtime-history-emitted-after-ceiling-clamp',
        56
      );
      const runtimeFifth = await mergeResidentProductMassBuffersWebGpu({
        device,
        inputResidentProductMass: runtimeFourth,
        emittedResidentProductMass: runtimeEmittedE,
        allowHostCompactionObservation: false
      });
      await device.queue.onSubmittedWorkDone();
      const runtimeGrownLiveCount = new Uint32Array(await readBytes(
        runtimeSecond.productEventLiveCountAuthority.controlBuffer,
        Uint32Array.BYTES_PER_ELEMENT,
        runtimeSecond.productEventLiveCountAuthority.liveRowCountOffsetBytes
      ))[0];
      const runtimeSixteenLiveCount = new Uint32Array(await readBytes(
        runtimeThird.productEventLiveCountAuthority.controlBuffer,
        Uint32Array.BYTES_PER_ELEMENT,
        runtimeThird.productEventLiveCountAuthority.liveRowCountOffsetBytes
      ))[0];
      const runtimeCeilingControlPrefix = Array.from(new Uint32Array(
        await readBytes(
          runtimeFourth.productEventLiveCountAuthority.controlBuffer,
          SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_PREFIX_BYTES,
          runtimeFourth.productEventLiveCountAuthority.controlOffsetBytes
        )
      ));
      const runtimePostCeilingLiveCount = new Uint32Array(await readBytes(
        runtimeFifth.productEventLiveCountAuthority.controlBuffer,
        Uint32Array.BYTES_PER_ELEMENT,
        runtimeFifth.productEventLiveCountAuthority.liveRowCountOffsetBytes
      ))[0];
      const runtimeIntegration = {
        firstCountControlBufferDiffersFromSecond:
          runtimeFirst.productEventLiveCountAuthority.controlBuffer
          !== runtimeSecond.productEventLiveCountAuthority.controlBuffer,
        firstDataBufferDiffersFromGrown:
          runtimeFirst.productEventBuffer !== runtimeSecond.productEventBuffer,
        sixteenDataBufferDiffersFromGrown:
          runtimeSecond.productEventBuffer !== runtimeThird.productEventBuffer,
        ceilingDataBufferDiffersFromPrior:
          runtimeThird.productEventBuffer !== runtimeFourth.productEventBuffer,
        ceilingDataBufferReusedByNext:
          runtimeFourth.productEventBuffer === runtimeFifth.productEventBuffer,
        grownLiveRowCount: runtimeGrownLiveCount,
        sixteenLiveRowCount: runtimeSixteenLiveCount,
        ceilingControlPrefix: runtimeCeilingControlPrefix,
        ceilingExpectedGeneration:
          runtimeFourth.productEventLiveCountAuthority.expectedGeneration,
        ceilingExpectedSeal:
          runtimeFourth.productEventLiveCountAuthority.expectedSeal,
        postCeilingLiveRowCount: runtimePostCeilingLiveCount,
        grownCapacityByteLength:
          runtimeSecond.productEventBufferByteLength,
        grownUpperBound:
          runtimeSecond.productEventLiveRowCountUpperBound,
        sixteenCapacityByteLength:
          runtimeThird.productEventBufferByteLength,
        sixteenUpperBound:
          runtimeThird.productEventLiveRowCountUpperBound,
        capacityProgressionByteLengths: [
          runtimeFirst.productEventBufferByteLength,
          runtimeSecond.productEventBufferByteLength,
          runtimeThird.productEventBufferByteLength,
          runtimeFourth.productEventBufferByteLength
        ],
        ceilingCapacityByteLength:
          runtimeFourth.productEventBufferByteLength,
        ceilingUpperBound:
          runtimeFourth.productEventLiveRowCountUpperBound,
        postCeilingUpperBound:
          runtimeFifth.productEventLiveRowCountUpperBound,
        firstAuthority: runtimeFirstAuthority,
        secondAuthority:
          runtimeSecond.productEventRowCountAuthority,
        thirdAuthority:
          runtimeThird.productEventRowCountAuthority,
        ceilingAuthorityStatus:
          runtimeFourth.productEventLiveCountAuthority.status,
        ceilingControlPrefixByteLength:
          runtimeFourth.productEventLiveCountAuthority
            .controlPrefixByteLength,
        secondCompactionStatus:
          runtimeSecond.productEventCompactionStatus,
        secondCapacityGrowthPerformed:
          runtimeSecond.productEventHistoryCapacityGrowthPerformed,
        thirdCapacityGrowthPerformed:
          runtimeThird.productEventHistoryCapacityGrowthPerformed,
        ceilingCapacityGrowthPerformed:
          runtimeFourth.productEventHistoryCapacityGrowthPerformed,
        postCeilingCapacityGrowthPerformed:
          runtimeFifth.productEventHistoryCapacityGrowthPerformed,
        secondHostFenceAwaited:
          runtimeSecond.productEventMergeHostFenceAwaited,
        thirdHostFenceAwaited:
          runtimeThird.productEventMergeHostFenceAwaited,
        ceilingHostFenceAwaited:
          runtimeFourth.productEventMergeHostFenceAwaited,
        postCeilingHostFenceAwaited:
          runtimeFifth.productEventMergeHostFenceAwaited
      };
      runtimeSecond.destroyResidentProductMassBuffers();
      await Promise.resolve(runtimeThird.destroyResidentProductMassBuffers());
      runtimeFourth.destroyResidentProductMassBuffers();
      await Promise.resolve(runtimeFifth.destroyResidentProductMassBuffers());
      runtimeSeed.destroyResidentProductMassBuffers();
      runtimeEmittedA.destroyResidentProductMassBuffers();
      runtimeEmittedB.destroyResidentProductMassBuffers();
      runtimeEmittedC.destroyResidentProductMassBuffers();
      runtimeEmittedD.destroyResidentProductMassBuffers();
      runtimeEmittedE.destroyResidentProductMassBuffers();
      await device.queue.onSubmittedWorkDone();

      await device.queue.onSubmittedWorkDone();
      const validationError = await device.popErrorScope();
      return {
        status: 'executed',
        constants: {
          magic: SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_MAGIC,
          ready: SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_STATUS_READY,
          failed: SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_STATUS_FAILED,
          capacityError: HISTORY_ERROR_CAPACITY
        },
        compilationErrors,
        uncapturedErrors,
        validationError: validationError?.message || null,
        stable,
        overflow,
        branch,
        runtimeIntegration
      };
    });
  } finally {
    await browser.close();
  }

  assert.equal(
    native.status,
    'executed',
    native.reason || 'native WebGPU must be available when the release gate is enabled'
  );
  assert.deepEqual(native.compilationErrors, []);
  assert.deepEqual(native.uncapturedErrors, []);
  assert.equal(native.validationError, null);

  const { magic, ready, failed, capacityError } = native.constants;
  assert.deepEqual(
    native.stable.history.slice(0, native.stable.expectedPrefix.length),
    native.stable.expectedPrefix
  );
  assert.ok(
    native.stable.history
      .slice(native.stable.expectedPrefix.length)
      .every((value) => value === 0),
    'stable filtering must leave the unused destination tail zero'
  );
  assert.deepEqual(native.stable.nextControl, [
    magic, 1, ready, 4, 8, 8, 2, 202, 1, 1, 1, 0
  ]);

  assert.deepEqual(
    native.overflow.history,
    native.overflow.initialHistory,
    'overflow must not partially overwrite the append destination'
  );
  assert.deepEqual(
    native.overflow.parentControl,
    native.overflow.expectedParentControl,
    'overflow must not mutate the immutable parent record'
  );
  assert.deepEqual(native.overflow.nextControl, [
    magic, 1, failed, 0, 2, 8, 4, 404, 0, 1, 1, capacityError
  ]);

  const branchIds = [];
  for (let row = 0; row < 4; row += 1) {
    branchIds.push(native.branch.history[row * 32]);
  }
  assert.deepEqual(branchIds, [41, 42, 43, 0]);
  assert.deepEqual(native.branch.nextControl, [
    magic, 1, ready, 3, 4, 8, 6, 606, 1, 1, 1, 0
  ]);

  const {
    ceilingControlPrefix,
    ceilingExpectedGeneration,
    ceilingExpectedSeal,
    ...runtimeIntegration
  } = native.runtimeIntegration;
  assert.deepEqual(ceilingControlPrefix, [
    magic,
    1,
    ready,
    5,
    262144,
    8,
    ceilingExpectedGeneration,
    ceilingExpectedSeal
  ]);
  assert.deepEqual(runtimeIntegration, {
    firstCountControlBufferDiffersFromSecond: true,
    firstDataBufferDiffersFromGrown: true,
    sixteenDataBufferDiffersFromGrown: true,
    ceilingDataBufferDiffersFromPrior: true,
    ceilingDataBufferReusedByNext: true,
    grownLiveRowCount: 3,
    sixteenLiveRowCount: 4,
    postCeilingLiveRowCount: 6,
    grownCapacityByteLength: 8 * 1024 * 1024,
    grownUpperBound: 32769,
    sixteenCapacityByteLength: 16 * 1024 * 1024,
    sixteenUpperBound: 65537,
    capacityProgressionByteLengths: [
      4 * 1024 * 1024,
      8 * 1024 * 1024,
      16 * 1024 * 1024,
      32 * 1024 * 1024
    ],
    ceilingCapacityByteLength: 32 * 1024 * 1024,
    ceilingUpperBound: 262144,
    postCeilingUpperBound: 262144,
    firstAuthority: 'gpu-authored-filtered-live-prefix',
    secondAuthority: 'gpu-authored-filtered-live-prefix',
    thirdAuthority: 'gpu-authored-filtered-live-prefix',
    ceilingAuthorityStatus: 'gpu-conditioned-publication-commit-pending',
    ceilingControlPrefixByteLength: 32,
    secondCompactionStatus:
      'product-event-filtered-append-gpu-count-resident',
    secondCapacityGrowthPerformed: true,
    thirdCapacityGrowthPerformed: true,
    ceilingCapacityGrowthPerformed: true,
    postCeilingCapacityGrowthPerformed: false,
    secondHostFenceAwaited: false,
    thirdHostFenceAwaited: false,
    ceilingHostFenceAwaited: false,
    postCeilingHostFenceAwaited: false
  });
});
