import assert from 'node:assert/strict';
import test from 'node:test';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_PHASE_VOLUME_MOMENT === '1';
const NATIVE_BASE_URL = process.env.ULG_PHASE_VOLUME_RECEIPT_NATIVE_BASE_URL
  || 'https://127.0.0.1:5174/';

test('native receipt WGSL fails closed when either authenticated field count header is corrupt', {
  skip: RUN_NATIVE
    ? false
    : 'set ULG_RUN_NATIVE_PHASE_VOLUME_MOMENT=1 for native WebGPU receipt-header coverage',
  timeout: 120_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: process.env.ULG_PHASE_VOLUME_RECEIPT_CHROME
      || '/usr/bin/google-chrome',
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
    await page.goto(NATIVE_BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const native = await page.evaluate(async () => {
      const adapter = await navigator.gpu?.requestAdapter({
        powerPreference: 'high-performance'
      });
      if (!adapter) return { status: 'unsupported', reason: 'WebGPU adapter unavailable' };
      const device = await adapter.requestDevice();
      const uncapturedErrors = [];
      device.addEventListener('uncapturederror', (event) => {
        uncapturedErrors.push(event.error?.message || String(event.error));
      });
      device.pushErrorScope('validation');

      const nonce = Date.now();
      const receiptAbi = await import(
        `/ulg-gpu-abi/src/schroederSpatialPhaseVolumeReceipt.js?nativeReceiptHeader=${nonce}`
      );
      const receiptWgsl = await import(
        `/ulg-gpu-abi/src/schroederSpatialPhaseVolumeReceiptWgsl.js?nativeReceiptHeader=${nonce}`
      );
      const momentAbi = await import(
        `/ulg-gpu-abi/src/schroederSpatialPhaseVolumeMoment.js?nativeReceiptHeader=${nonce}`
      );
      const fieldAbi = await import(
        `/ulg-gpu-abi/src/schroederSpatialMechanicsFieldView.js?nativeReceiptHeader=${nonce}`
      );

      const sourceCount = 1;
      const sourceCapacity = 1;
      const fieldCapacity = 27;
      const fieldCount = 1;
      const identity = {
        generationId: 31,
        deviceOrdinal: 5,
        laneOrdinal: 7,
        leaseToken: 11,
        sourceFamilyId: 13,
        storageGeneration: 17,
        physicsTick: 19,
        physicsSubstep: 0,
        positionEpoch: 23,
        topologyEpoch: 29,
        chartEpoch: 37,
        levelEpoch: 41,
        supportEpoch: 43,
        completionOrdinal: 47
      };
      const layout = receiptAbi.createSchroederSpatialPhaseVolumeReceiptLayout({
        sourceCapacity,
        fieldCapacity
      });
      const plan = receiptAbi.createSchroederSpatialPhaseVolumeReceiptPlan({
        sourceCount,
        sourceCapacity,
        fieldCapacity,
        selectedLevel: 0,
        gridNodeCount: 8,
        gridSpacingM: 0.25,
        ...identity
      });
      const fieldLayout =
        fieldAbi.createSchroederSpatialMechanicsFieldViewLayout({
          sourceCapacity,
          fieldCapacity
        });
      const shader = device.createShaderModule({
        label: 'native-phase-volume-receipt-header-authentication',
        code: receiptWgsl.createSchroederSpatialPhaseVolumeReceiptWgsl(layout)
      });
      const compilation = await shader.getCompilationInfo();
      const compilationErrors = compilation.messages
        .filter((message) => message.type === 'error')
        .map((message) => message.message);
      if (compilationErrors.length > 0) {
        return { status: 'shader-error', compilationErrors, uncapturedErrors };
      }
      const pipelines = Object.fromEntries([
        'reduce_phase_volume_receipt_sources',
        'reduce_phase_volume_receipt_fields',
        'finalize_phase_volume_receipt'
      ].map((entryPoint) => [
        entryPoint,
        device.createComputePipeline({
          label: `native-phase-volume-receipt-${entryPoint}`,
          layout: 'auto',
          compute: { module: shader, entryPoint }
        })
      ]));

      const f32Bits = (value) => {
        const bytes = new ArrayBuffer(Float32Array.BYTES_PER_ELEMENT);
        const view = new DataView(bytes);
        view.setFloat32(0, value, true);
        return view.getUint32(0, true);
      };
      const paramsData = () => {
        const bytes = new ArrayBuffer(receiptAbi.SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_PARAMS_BYTES);
        const view = new DataView(bytes);
        const u32 = (word, value) => view.setUint32(
          word * Uint32Array.BYTES_PER_ELEMENT,
          Number(value) >>> 0,
          true
        );
        u32(0, plan.sourceCount);
        u32(1, plan.sourceCapacity);
        u32(2, plan.fieldCapacity);
        u32(3, plan.candidateCount);
        view.setInt32(4 * Uint32Array.BYTES_PER_ELEMENT, plan.selectedLevel, true);
        u32(5, plan.gridNodeCount);
        view.setFloat32(6 * Uint32Array.BYTES_PER_ELEMENT, plan.gridSpacingM, true);
        view.setFloat32(7 * Uint32Array.BYTES_PER_ELEMENT, 1 / plan.gridSpacingM, true);
        u32(8, plan.generationId);
        u32(9, plan.deviceOrdinal);
        u32(10, plan.laneOrdinal);
        u32(11, plan.leaseToken);
        u32(12, plan.sourceFamilyId);
        u32(13, plan.storageGeneration);
        u32(14, plan.physicsTick);
        u32(15, plan.physicsSubstep);
        u32(16, plan.positionEpoch);
        u32(17, plan.topologyEpoch);
        u32(18, plan.chartEpoch);
        u32(19, plan.levelEpoch);
        u32(20, plan.supportEpoch);
        u32(21, plan.completionOrdinal);
        u32(22, plan.layout.sourceGroupCapacity);
        u32(23, plan.layout.fieldGroupCapacity);
        u32(24, plan.layout.sourcePartialOffsetVec4);
        u32(25, plan.layout.fieldPartialOffsetVec4);
        u32(26, plan.layout.fieldConditioningOffsetVec4);
        u32(27, plan.layout.partialVec4Capacity);
        u32(28, plan.sourceMechanicsStrideFloats);
        u32(29, plan.rawVolumeRatioJMechanicsWord);
        u32(30, plan.rawRestVolumeMechanicsWord);
        return bytes;
      };
      const writeIdentity = (words, offset) => {
        words[offset + 3] = identity.generationId;
        words[offset + 4] = identity.deviceOrdinal;
        words[offset + 5] = identity.laneOrdinal;
        words[offset + 6] = identity.leaseToken;
        words[offset + 7] = identity.sourceFamilyId;
        words[offset + 8] = identity.storageGeneration;
        words[offset + 9] = identity.physicsTick;
        words[offset + 10] = identity.physicsSubstep;
        words[offset + 11] = identity.positionEpoch;
        words[offset + 12] = identity.topologyEpoch;
        words[offset + 13] = identity.chartEpoch;
        words[offset + 14] = identity.levelEpoch;
        words[offset + 15] = identity.supportEpoch;
      };
      const makeMomentControl = () => {
        const words = new Uint32Array(
          momentAbi.SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_HEADER_WORDS
        );
        words[0] = momentAbi.SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_MAGIC;
        words[1] = momentAbi.SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_VERSION;
        words[2] = momentAbi.SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STATUS_READY
          | momentAbi.SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STATUS_ADMITTED;
        writeIdentity(words, 0);
        words[16] = sourceCount;
        words[17] = sourceCapacity;
        words[18] = fieldCount;
        words[19] = fieldCapacity;
        words[20] = 0;
        words[21] = plan.gridNodeCount;
        words[22] = f32Bits(plan.gridSpacingM);
        words[23] = identity.completionOrdinal;
        words[24] = 96;
        words[25] = 4;
        words[26] = fieldAbi.SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_WORDS;
        words[27] = fieldAbi.SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_DESCRIPTOR_WORDS;
        words[28] = 0;
        words[29] = momentAbi.SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_ROW_WORDS;
        words[30] = fieldCount * momentAbi.SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_ROW_WORDS;
        words[31] = fieldCapacity * momentAbi.SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_ROW_WORDS;
        words[32] = plan.candidateCount;
        words[33] = 18;
        words[34] = 19;
        words[35] = 32;
        words[36] = 16;
        words[37] = 0;
        words[38] = 0;
        words[39] = 0;
        words[40] = plan.candidateCount;
        words[41] = fieldCapacity - fieldCount;
        words[42] = 0;
        words[43] = 0;
        words[44] = 1;
        words[45] = 0;
        words[46] = 1;
        words[47] = 1;
        words[48] = 1;
        words[49] = momentAbi.SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_HEADER_WORDS;
        words[50] = 4;
        words[51] = 2;
        words[52] = fieldAbi.SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_MAGIC;
        words[53] = fieldAbi.SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_VERSION;
        words[54] = 1;
        return words;
      };
      const makeMechanicsField = () => {
        const wordLength = fieldLayout.wordLength;
        const words = new Uint32Array(wordLength);
        words[0] = fieldAbi.SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_MAGIC;
        words[1] = fieldAbi.SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_VERSION;
        words[2] = fieldAbi.SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_READY
          | fieldAbi.SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_ADMITTED;
        writeIdentity(words, 0);
        words[16] = sourceCount;
        words[17] = 0;
        words[18] = plan.gridNodeCount;
        words[19] = 2;
        words[20] = 2;
        words[21] = 2;
        words[22] = 1;
        words[23] = f32Bits(plan.gridSpacingM);
        words[24] = fieldAbi.SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_WORDS;
        words[25] = fieldAbi.SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_DESCRIPTOR_WORDS;
        words[26] = fieldLayout.keyOffsetWords;
        words[27] = fieldAbi.SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_KEY_WORDS;
        words[28] = fieldLayout.accumulatorOffsetWords;
        words[29] = fieldAbi.SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_ACCUMULATOR_WORDS;
        words[30] = fieldLayout.stateOffsetWords;
        words[31] = fieldAbi.SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATE_WORDS;
        words[32] = fieldCapacity;
        words[33] = plan.candidateCount;
        words[34] = fieldCount;
        words[35] = 0;
        words[36] = 0;
        words[37] = 0;
        words[38] = identity.completionOrdinal;
        words[39] = 1;
        words[40] = 1;
        // v4 required words bound the immutable pressure tail that follows the
        // full state-capacity bank, matching the mechanics-field producer.
        words[41] =
          fieldLayout.pressureOffsetWords
          + fieldCount
            * fieldAbi.SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_PRESSURE_WORDS;
        words[42] = wordLength;
        words[43] = 0;
        words[44] = 1;
        words[45] = 1;
        words[46] = 1;
        words[54] = sourceCount;
        words[55] = 1;
        words[56] = 1;
        words[57] = 1;
        words[58] = 0;
        words[59] = 0;
        words[60] = 1;
        words[61] = 1;
        words[62] = 1;
        words[63] = 0;
        // One exact selected source descriptor at the canonical descriptor
        // offset.  The key rows below begin at word 96.
        words[64] = 1;
        words[65] = 7;
        words[66] = 0;
        words[67] = 1;
        words[96] = 0;
        words[97] = 1;
        words[98] = 7;
        words[99] = 0;
        return words;
      };
      const makeMomentRows = () => {
        const words = new Uint32Array(
          fieldCapacity * momentAbi.SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_ROW_WORDS
        );
        words[0] = 0;
        words[1] = 1;
        words[2] = 7;
        words[3] = 0;
        words[4] = f32Bits(0.006);
        words[5] = f32Bits(0);
        words[6] = f32Bits(0);
        words[7] = f32Bits(0);
        words[8] = plan.candidateCount;
        words[9] = momentAbi.SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STATUS_READY
          | momentAbi.SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STATUS_ADMITTED;
        return words;
      };
      const createBuffer = (label, size, usage) => device.createBuffer({ label, size, usage });
      const destroyAll = (buffers) => {
        for (const buffer of buffers) buffer.destroy();
      };
      const runCase = async (corruption = null) => {
        const sourceMechanics = new Float32Array(32);
        sourceMechanics[18] = 2;
        sourceMechanics[19] = 0.003;
        const sourceAssignments = new Float32Array(16);
        sourceAssignments[0] = 0;
        sourceAssignments[1] = plan.gridSpacingM;
        sourceAssignments[6] = 1;
        sourceAssignments[8] = 1;
        sourceAssignments[9] = 7;
        sourceAssignments[10] = 1;
        const momentControl = makeMomentControl();
        const mechanicsField = makeMechanicsField();
        if (corruption === 'moment-field-count') momentControl[18] = 2;
        if (corruption === 'mechanics-field-count') mechanicsField[34] = 2;
        if (corruption === 'off-level-active-descriptor') sourceAssignments[0] = 1;
        if (corruption === 'selected-inactive-descriptor') mechanicsField[67] = 0;
        if (corruption === 'out-of-range-assignment') sourceAssignments[8] = 16777216;
        const momentRows = makeMomentRows();
        const sourceAssignmentsBuffer = createBuffer(
          `native-receipt-source-assignments-${corruption || 'valid'}`,
          sourceAssignments.byteLength,
          GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        );
        const sourceMechanicsBuffer = createBuffer(
          `native-receipt-source-mechanics-${corruption || 'valid'}`,
          sourceMechanics.byteLength,
          GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        );
        const momentControlBuffer = createBuffer(
          `native-receipt-moment-control-${corruption || 'valid'}`,
          momentControl.byteLength,
          GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        );
        const momentRowsBuffer = createBuffer(
          `native-receipt-moment-rows-${corruption || 'valid'}`,
          momentRows.byteLength,
          GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        );
        const mechanicsFieldBuffer = createBuffer(
          `native-receipt-mechanics-field-${corruption || 'valid'}`,
          mechanicsField.byteLength,
          GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        );
        const partialBuffer = createBuffer(
          `native-receipt-partials-${corruption || 'valid'}`,
          layout.partialByteLength,
          GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        );
        const receiptControlBuffer = createBuffer(
          `native-receipt-control-${corruption || 'valid'}`,
          layout.controlByteLength,
          GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
        );
        const paramsBuffer = createBuffer(
          `native-receipt-params-${corruption || 'valid'}`,
          receiptAbi.SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_PARAMS_BYTES,
          GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        );
        const readbackBuffer = createBuffer(
          `native-receipt-readback-${corruption || 'valid'}`,
          layout.controlByteLength,
          GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        );
        const buffers = [
          sourceAssignmentsBuffer,
          sourceMechanicsBuffer,
          momentControlBuffer,
          momentRowsBuffer,
          mechanicsFieldBuffer,
          partialBuffer,
          receiptControlBuffer,
          paramsBuffer,
          readbackBuffer
        ];
        try {
          device.queue.writeBuffer(sourceAssignmentsBuffer, 0, sourceAssignments);
          device.queue.writeBuffer(sourceMechanicsBuffer, 0, sourceMechanics);
          device.queue.writeBuffer(momentControlBuffer, 0, momentControl);
          device.queue.writeBuffer(momentRowsBuffer, 0, momentRows);
          device.queue.writeBuffer(mechanicsFieldBuffer, 0, mechanicsField);
          device.queue.writeBuffer(paramsBuffer, 0, paramsData());
          const entries = [
            { binding: 0, resource: { buffer: sourceMechanicsBuffer } },
            { binding: 1, resource: { buffer: momentControlBuffer } },
            { binding: 2, resource: { buffer: momentRowsBuffer } },
            { binding: 3, resource: { buffer: mechanicsFieldBuffer } },
            { binding: 4, resource: { buffer: partialBuffer } },
            { binding: 5, resource: { buffer: receiptControlBuffer } },
            { binding: 6, resource: { buffer: paramsBuffer } }
          ];
          const sourceEntries = [
            ...entries,
            { binding: 7, resource: { buffer: sourceAssignmentsBuffer } }
          ];
          // The source pass reads raw V0*J; the later two passes intentionally
          // do not. Build entry-point-specific groups so the browser's native
          // layout optimizer cannot hide an accidental binding dependency.
          const bindGroups = {
            reduce_phase_volume_receipt_sources: device.createBindGroup({
              layout: pipelines.reduce_phase_volume_receipt_sources.getBindGroupLayout(0),
              entries: sourceEntries
            }),
            reduce_phase_volume_receipt_fields: device.createBindGroup({
              layout: pipelines.reduce_phase_volume_receipt_fields.getBindGroupLayout(0),
              entries: entries.slice(1)
            }),
            finalize_phase_volume_receipt: device.createBindGroup({
              layout: pipelines.finalize_phase_volume_receipt.getBindGroupLayout(0),
              entries: entries.slice(1)
            })
          };
          const encoder = device.createCommandEncoder({
            label: `native-receipt-header-${corruption || 'valid'}`
          });
          encoder.clearBuffer(partialBuffer);
          encoder.clearBuffer(receiptControlBuffer);
          for (const [entryPoint, workgroups] of [
            ['reduce_phase_volume_receipt_sources', 1],
            ['reduce_phase_volume_receipt_fields', 1],
            ['finalize_phase_volume_receipt', 1]
          ]) {
            const pass = encoder.beginComputePass({ label: entryPoint });
            pass.setPipeline(pipelines[entryPoint]);
            pass.setBindGroup(0, bindGroups[entryPoint]);
            pass.dispatchWorkgroups(workgroups);
            pass.end();
          }
          encoder.copyBufferToBuffer(
            receiptControlBuffer,
            0,
            readbackBuffer,
            0,
            layout.controlByteLength
          );
          device.queue.submit([encoder.finish()]);
          await readbackBuffer.mapAsync(GPUMapMode.READ);
          const control = new Uint32Array(readbackBuffer.getMappedRange()).slice();
          readbackBuffer.unmap();
          const floats = new Float32Array(control.buffer);
          return {
            statusFlags: control[2],
            abiVersion: control[1],
            globalSourceCount: control[16],
            globalCandidateCount: control[20],
            fieldCount: control[18],
            selectedSourceCount: control[47],
            selectedCandidateCount: control[48],
            publicValues: Array.from(floats.slice(30, 41)),
            terminalSeal: control[59]
          };
        } finally {
          destroyAll(buffers);
        }
      };
      const valid = await runCase();
      const corruptMomentFieldCount = await runCase('moment-field-count');
      const corruptMechanicsFieldCount = await runCase('mechanics-field-count');
      const offLevelActiveDescriptor = await runCase('off-level-active-descriptor');
      const selectedInactiveDescriptor = await runCase('selected-inactive-descriptor');
      const outOfRangeAssignment = await runCase('out-of-range-assignment');
      const validationError = await device.popErrorScope();
      return {
        status: 'ok',
        receiptFlags: {
          ready: receiptAbi.SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_STATUS_READY,
          admitted: receiptAbi.SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_STATUS_ADMITTED,
          failClosed: receiptAbi.SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_STATUS_FAIL_CLOSED,
          invalidSource: receiptAbi.SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_STATUS_INVALID_SOURCE,
          momentRejected: receiptAbi.SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_STATUS_MOMENT_REJECTED,
          identityMismatch: receiptAbi.SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_STATUS_IDENTITY_MISMATCH
        },
        valid,
        corruptMomentFieldCount,
        corruptMechanicsFieldCount,
        offLevelActiveDescriptor,
        selectedInactiveDescriptor,
        outOfRangeAssignment,
        validationError: validationError?.message || null,
        uncapturedErrors
      };
    });

    assert.notEqual(native.status, 'unsupported', native.reason);
    assert.equal(native.status, 'ok', native.compilationErrors?.join('\n'));
    assert.equal(native.validationError, null, native.validationError);
    assert.deepEqual(native.uncapturedErrors, []);
    assert.equal(
      native.valid.statusFlags,
      native.receiptFlags.ready | native.receiptFlags.admitted
    );
    assert.equal(native.valid.abiVersion, 2);
    assert.equal(native.valid.globalSourceCount, 1);
    assert.equal(native.valid.globalCandidateCount, 27);
    assert.equal(native.valid.selectedSourceCount, 1);
    assert.equal(native.valid.selectedCandidateCount, 27);
    assert.equal(native.valid.fieldCount, 1);
    assert.ok(Math.abs(native.valid.publicValues[0] - 0.006) < 2e-5);
    assert.ok(Math.abs(native.valid.publicValues[1] - 0.006) < 2e-5);
    assert.ok(Math.abs(native.valid.publicValues[2]) < 2e-5);
    assert.notEqual(native.valid.terminalSeal, 0);

    for (const result of [
      native.corruptMomentFieldCount,
      native.corruptMechanicsFieldCount
    ]) {
      assert.notEqual(result.statusFlags & native.receiptFlags.failClosed, 0);
      assert.equal(result.statusFlags & native.receiptFlags.ready, 0);
      assert.equal(result.statusFlags & native.receiptFlags.admitted, 0);
      assert.notEqual(result.statusFlags & native.receiptFlags.momentRejected, 0);
      assert.equal(result.fieldCount, 0);
      assert.deepEqual(result.publicValues, Array(11).fill(0));
      assert.notEqual(result.terminalSeal, 0);
    }
    for (const result of [
      native.offLevelActiveDescriptor,
      native.selectedInactiveDescriptor
    ]) {
      assert.notEqual(result.statusFlags & native.receiptFlags.failClosed, 0);
      assert.equal(result.statusFlags & native.receiptFlags.ready, 0);
      assert.equal(result.statusFlags & native.receiptFlags.admitted, 0);
      assert.notEqual(result.statusFlags & native.receiptFlags.identityMismatch, 0);
      assert.equal(result.fieldCount, 0);
      assert.deepEqual(result.publicValues, Array(11).fill(0));
      assert.notEqual(result.terminalSeal, 0);
    }
    assert.notEqual(native.outOfRangeAssignment.statusFlags & native.receiptFlags.failClosed, 0);
    assert.notEqual(native.outOfRangeAssignment.statusFlags & native.receiptFlags.invalidSource, 0);
    assert.equal(native.outOfRangeAssignment.statusFlags & native.receiptFlags.ready, 0);
    assert.equal(native.outOfRangeAssignment.statusFlags & native.receiptFlags.admitted, 0);
    assert.equal(native.outOfRangeAssignment.fieldCount, 0);
    assert.deepEqual(native.outOfRangeAssignment.publicValues, Array(11).fill(0));
    assert.notEqual(native.outOfRangeAssignment.terminalSeal, 0);
  } finally {
    await browser.close();
  }
});

test('native directory-v2 phase volume is sparse, mixed-level, physical-id stable, and A=0 exact', {
  skip: RUN_NATIVE
    ? false
    : 'set ULG_RUN_NATIVE_PHASE_VOLUME_MOMENT=1 for native directory-v2 phase-volume coverage',
  timeout: 120_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: process.env.ULG_PHASE_VOLUME_RECEIPT_CHROME
      || '/usr/bin/google-chrome',
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
    await page.goto(NATIVE_BASE_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000
    });
    const native = await page.evaluate(async () => {
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
      const [momentAbi, momentWgsl, receiptAbi, receiptWgsl, fieldAbi, activeAbi] =
        await Promise.all([
          import(`/ulg-gpu-abi/src/schroederSpatialPhaseVolumeMoment.js?v2native=${nonce}`),
          import(`/ulg-gpu-abi/src/schroederSpatialPhaseVolumeMomentWgsl.js?v2native=${nonce}`),
          import(`/ulg-gpu-abi/src/schroederSpatialPhaseVolumeReceipt.js?v2native=${nonce}`),
          import(`/ulg-gpu-abi/src/schroederSpatialPhaseVolumeReceiptWgsl.js?v2native=${nonce}`),
          import(`/ulg-gpu-abi/src/schroederSpatialMechanicsFieldView.js?v2native=${nonce}`),
          import(`/ulg-gpu-abi/src/schroederSpatialActiveSourceView.js?v2native=${nonce}`)
        ]);

      const physicalSourceCount = 8;
      const sourceCapacity = 8;
      const fieldCapacity = sourceCapacity * 27;
      const selectedLevel = 0;
      const gridSpacingM = 0.25;
      const identity = {
        generationId: 131,
        deviceOrdinal: 5,
        laneOrdinal: 7,
        leaseToken: 11,
        sourceFamilyId: 13,
        storageGeneration: 17,
        physicsTick: 19,
        physicsSubstep: 0,
        positionEpoch: 23,
        topologyEpoch: 29,
        chartEpoch: 37,
        levelEpoch: 41,
        supportEpoch: 43,
        completionOrdinal: 147
      };
      const momentLayout = momentAbi.createSchroederSpatialPhaseVolumeMomentLayout({
        sourceCapacity,
        fieldCapacity
      });
      const receiptLayout = receiptAbi.createSchroederSpatialPhaseVolumeReceiptLayout({
        sourceCapacity,
        fieldCapacity
      });
      const fieldLayout = fieldAbi.createSchroederSpatialMechanicsFieldViewLayout({
        sourceCapacity
      });
      const activeLayout = activeAbi.createSchroederSpatialActiveSourceViewLayout({
        physicalSourceCapacity: sourceCapacity,
        activeSourceCapacity: sourceCapacity
      });
      const momentPlan = momentAbi.createSchroederSpatialPhaseVolumeMomentPlan({
        sourceCount: physicalSourceCount,
        sourceCapacity,
        fieldCapacity,
        selectedLevel,
        gridNodeCount: 27,
        gridSpacingM,
        ...identity,
        sourceAuthorityVersion: 2
      });
      const receiptPlan = receiptAbi.createSchroederSpatialPhaseVolumeReceiptPlan({
        sourceCount: physicalSourceCount,
        sourceCapacity,
        fieldCapacity,
        selectedLevel,
        gridNodeCount: 27,
        gridSpacingM,
        ...identity,
        sourceAuthorityVersion: 2
      });
      const momentShader = device.createShaderModule({
        label: 'native-phase-volume-moment-v2',
        code: momentWgsl.createSchroederSpatialPhaseVolumeMomentWgsl(
          momentLayout,
          { sourceAuthorityVersion: 2 }
        )
      });
      const receiptShader = device.createShaderModule({
        label: 'native-phase-volume-receipt-v2',
        code: receiptWgsl.createSchroederSpatialPhaseVolumeReceiptWgsl(
          receiptLayout,
          { sourceAuthorityVersion: 2 }
        )
      });
      const compilationErrors = [];
      for (const shader of [momentShader, receiptShader]) {
        const info = await shader.getCompilationInfo();
        compilationErrors.push(...info.messages
          .filter((message) => message.type === 'error')
          .map((message) => message.message));
      }
      if (compilationErrors.length > 0) {
        return { status: 'shader-error', compilationErrors, uncapturedErrors };
      }
      const createPipelines = (shader, names) => Object.fromEntries(
        names.map((entryPoint) => [
          entryPoint,
          device.createComputePipeline({
            layout: 'auto',
            compute: { module: shader, entryPoint }
          })
        ])
      );
      const momentPipelines = createPipelines(momentShader, [
        'emit_phase_volume_moment_contributions',
        'materialize_phase_volume_moment_ranges',
        'reduce_phase_volume_moments',
        'finalize_phase_volume_moments'
      ]);
      const receiptPipelines = createPipelines(receiptShader, [
        'reduce_phase_volume_receipt_sources',
        'reduce_phase_volume_receipt_fields',
        'finalize_phase_volume_receipt'
      ]);
      const f32Bits = (value) => {
        const words = new Uint32Array(1);
        new Float32Array(words.buffer)[0] = value;
        return words[0];
      };
      const paramsBytes = (plan, receipt = false) => {
        const byteLength = receipt
          ? receiptAbi.SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_PARAMS_BYTES
          : momentAbi.SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_PARAMS_BYTES;
        const bytes = new ArrayBuffer(byteLength);
        const view = new DataView(bytes);
        const u32 = (word, value) => view.setUint32(
          word * Uint32Array.BYTES_PER_ELEMENT,
          Number(value) >>> 0,
          true
        );
        u32(0, physicalSourceCount);
        u32(1, sourceCapacity);
        u32(2, fieldCapacity);
        u32(3, fieldCapacity);
        view.setInt32(4 * 4, selectedLevel, true);
        u32(5, 27);
        view.setFloat32(6 * 4, gridSpacingM, true);
        view.setFloat32(7 * 4, 1 / gridSpacingM, true);
        for (const [word, key] of [
          [8, 'generationId'],
          [9, 'deviceOrdinal'],
          [10, 'laneOrdinal'],
          [11, 'leaseToken'],
          [12, 'sourceFamilyId'],
          [13, 'storageGeneration'],
          [14, 'physicsTick'],
          [15, 'physicsSubstep'],
          [16, 'positionEpoch'],
          [17, 'topologyEpoch'],
          [18, 'chartEpoch'],
          [19, 'levelEpoch'],
          [20, 'supportEpoch'],
          [21, 'completionOrdinal']
        ]) u32(word, identity[key]);
        if (receipt) {
          u32(22, receiptLayout.sourceGroupCapacity);
          u32(23, receiptLayout.fieldGroupCapacity);
          u32(24, receiptLayout.sourcePartialOffsetVec4);
          u32(25, receiptLayout.fieldPartialOffsetVec4);
          u32(26, receiptLayout.fieldConditioningOffsetVec4);
          u32(27, receiptLayout.partialVec4Capacity);
          u32(28, plan.sourceMechanicsStrideFloats);
          u32(29, plan.rawVolumeRatioJMechanicsWord);
          u32(30, plan.rawRestVolumeMechanicsWord);
        } else {
          u32(22, plan.assignmentStrideFloats);
          u32(23, plan.mechanicsStrideFloats);
          u32(24, plan.rawVolumeRatioJMechanicsWord);
          u32(25, plan.rawRestVolumeMechanicsWord);
          u32(26, plan.sourceRowLayoutId);
        }
        return bytes;
      };
      const writeIdentity = (words) => {
        for (const [word, key] of [
          [3, 'generationId'],
          [4, 'deviceOrdinal'],
          [5, 'laneOrdinal'],
          [6, 'leaseToken'],
          [7, 'sourceFamilyId'],
          [8, 'storageGeneration'],
          [9, 'physicsTick'],
          [10, 'physicsSubstep'],
          [11, 'positionEpoch'],
          [12, 'topologyEpoch'],
          [13, 'chartEpoch'],
          [14, 'levelEpoch'],
          [15, 'supportEpoch']
        ]) words[word] = identity[key];
      };
      const activeDispatchShape = (count) => [
        Math.ceil(count / 64),
        1,
        1
      ];
      const fieldDispatchShape = (count) => count === 0
        ? [0, 0, 0]
        : [Math.ceil(count / 64), 1, 1];
      const positiveHalfCellStencils = [];
      for (let ox = 0; ox < 3; ox += 1) {
        for (let oy = 0; oy < 3; oy += 1) {
          for (let oz = 0; oz < 3; oz += 1) {
            const ordinal = ox * 9 + oy * 3 + oz;
            if (ox < 2 && oy < 2 && oz < 2) {
              positiveHalfCellStencils.push({
                ordinal,
                node: ((1 + ox) * 3 + (1 + oy)) * 3 + (1 + oz)
              });
            }
          }
        }
      }
      const makeActiveSource = (activePhysical) => {
        const activeCount = activePhysical.length;
        const words = new Uint32Array(activeLayout.wordLength);
        words.fill(0xffff_ffff, activeLayout.activeToPhysicalOffsetWords);
        words.fill(0, 0, activeLayout.activeToPhysicalOffsetWords);
        words[0] = activeAbi.SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_MAGIC;
        words[1] = activeAbi.SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_VERSION;
        words[2] = activeAbi.SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_READY
          | activeAbi.SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_ADMITTED;
        writeIdentity(words);
        words[16] = physicalSourceCount;
        words[17] = sourceCapacity;
        words[18] = activeCount;
        words[19] = sourceCapacity;
        words[20] = physicalSourceCount - activeCount;
        words[21] = 0;
        words[22] = 0;
        words[23] = 1;
        words[24] = 16;
        words[25] = activeLayout.activeToPhysicalOffsetWords;
        words[26] = activeLayout.physicalToActiveOffsetWords;
        words[27] = activeLayout.wordLength;
        words[28] = activeLayout.headerWords + activeCount + physicalSourceCount;
        words[29] = identity.completionOrdinal;
        words[30] = identity.completionOrdinal;
        words[32] = physicalSourceCount;
        words[33] = activeCount;
        words[34] = activeCount;
        words[35] = activeCount;
        words[36] = activeCount === 0 ? 0 : Math.max(...activePhysical) + 1;
        words[37] = 64;
        words[38] = 65535;
        words[40] = 48;
        words[41] = 51;
        words[42] = 54;
        words[43] = activeCount * 27;
        words[44] = sourceCapacity * 27;
        words[47] = identity.completionOrdinal ^ identity.generationId;
        words.set(activeDispatchShape(activeCount), 48);
        words.set(activeDispatchShape(activeCount * 27), 51);
        words.set(activeDispatchShape(physicalSourceCount), 54);
        for (const [activeOrdinal, physical] of activePhysical.entries()) {
          words[activeLayout.activeToPhysicalOffsetWords + activeOrdinal] = physical;
          words[activeLayout.physicalToActiveOffsetWords + physical] = activeOrdinal;
        }
        return words;
      };
      const makeField = ({ activeCount, selectedPhysical }) => {
        const fieldCount = selectedPhysical.length === 0
          ? 0
          : positiveHalfCellStencils.length;
        const words = new Uint32Array(fieldLayout.wordLength);
        words[0] = fieldAbi.SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_MAGIC;
        words[1] = fieldAbi.SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_VERSION;
        words[2] = fieldAbi.SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_READY
          | fieldAbi.SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_ADMITTED;
        writeIdentity(words);
        words[16] = physicalSourceCount;
        words[17] = selectedLevel;
        words[18] = 27;
        words[19] = 3;
        words[20] = 3;
        words[21] = 3;
        words[22] = 0;
        words[23] = f32Bits(gridSpacingM);
        words[24] = fieldLayout.descriptorOffsetWords;
        words[25] = fieldAbi.SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_DESCRIPTOR_WORDS;
        words[26] = fieldLayout.keyOffsetWords;
        words[27] = fieldAbi.SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_KEY_WORDS;
        words[28] = fieldLayout.accumulatorOffsetWords;
        words[29] = fieldAbi.SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_ACCUMULATOR_WORDS;
        words[30] = fieldLayout.stateOffsetWords;
        words[31] = fieldAbi.SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATE_WORDS;
        words[32] = fieldCapacity;
        words[33] = activeCount * 27;
        words[34] = fieldCount;
        words[35] = 0;
        words[36] = 0;
        words[37] = 0;
        words[38] = identity.completionOrdinal;
        words[39] = 1;
        words[40] = 1;
        words[41] = fieldLayout.pressureOffsetWords
          + fieldCount
            * fieldAbi.SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_PRESSURE_WORDS;
        words[42] = fieldLayout.wordLength;
        words[43] = 0;
        const fieldDispatch = fieldDispatchShape(fieldCount);
        words.set(fieldDispatch, 44);
        words[54] = physicalSourceCount;
        words[55] = 1;
        words[56] = 1;
        words[57] = 1;
        words[58] = 0;
        words[59] = 0;
        words.set(fieldDispatch, 60);
        words[63] = 0;
        for (const physical of selectedPhysical) {
          const descriptor = fieldLayout.descriptorOffsetWords
            + physical * fieldAbi.SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_DESCRIPTOR_WORDS;
          words[descriptor] = 1;
          words[descriptor + 1] = 7;
          words[descriptor + 2] = 0;
          words[descriptor + 3] = 1;
          for (let ordinal = 0; ordinal < 27; ordinal += 1) {
            const fieldIndex = positiveHalfCellStencils.findIndex(
              (entry) => entry.ordinal === ordinal
            );
            words[descriptor + 4 + ordinal] = fieldIndex < 0
              ? 0xffff_ffff
              : fieldIndex;
          }
        }
        for (let fieldIndex = 0; fieldIndex < fieldCount; fieldIndex += 1) {
          const key = fieldLayout.keyOffsetWords
            + fieldIndex * fieldAbi.SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_KEY_WORDS;
          words[key] = positiveHalfCellStencils[fieldIndex].node;
          words[key + 1] = 1;
          words[key + 2] = 7;
          words[key + 3] = 0;
        }
        return words;
      };
      const makeSources = ({ activePhysical, selectedPhysical }) => {
        const assignments = new Float32Array(sourceCapacity * 16);
        const mechanics = new Float32Array(sourceCapacity * 32);
        for (const physical of activePhysical) {
          const assignment = physical * 16;
          assignments[assignment] = selectedPhysical.includes(physical) ? 0 : 1;
          assignments[assignment + 1] = gridSpacingM;
          assignments[assignment + 6] = 1;
          assignments[assignment + 8] = 1;
          assignments[assignment + 9] = 7;
          assignments[assignment + 10] = 1;
          // Exact half-cell alignment has two positive weights per axis.
          // Directory-v2 authenticates the other 19 logical stencil slots as
          // omitted zero support while retaining eight physical field keys.
          assignments[assignment + 12] = 0.375;
          assignments[assignment + 13] = 0.375;
          assignments[assignment + 14] = 0.375;
          mechanics[physical * 32 + 18] = 2;
          mechanics[physical * 32 + 19] = 0.003;
        }
        return { assignments, mechanics };
      };
      const makeStableOrder = ({ activePhysical, selectedPhysical }) => {
        const selectedOrdinals = activePhysical
          .map((physical, activeOrdinal) => ({ physical, activeOrdinal }))
          .filter(({ physical }) => selectedPhysical.includes(physical))
          .map(({ activeOrdinal }) => activeOrdinal);
        const offLevelOrdinals = activePhysical
          .map((physical, activeOrdinal) => ({ physical, activeOrdinal }))
          .filter(({ physical }) => !selectedPhysical.includes(physical))
          .map(({ activeOrdinal }) => activeOrdinal);
        const values = [];
        for (let stencil = 0; stencil < 27; stencil += 1) {
          for (const activeOrdinal of selectedOrdinals) {
            values.push(activeOrdinal * 27 + stencil);
          }
        }
        for (const activeOrdinal of offLevelOrdinals) {
          for (let stencil = 0; stencil < 27; stencil += 1) {
            values.push(activeOrdinal * 27 + stencil);
          }
        }
        const order = new Uint32Array(momentLayout.candidateCapacity);
        order.fill(0xffff_ffff);
        order.set(values);
        return order;
      };
      const createBuffer = (label, dataOrSize, usage) => {
        const size = typeof dataOrSize === 'number'
          ? dataOrSize
          : dataOrSize.byteLength;
        const buffer = device.createBuffer({ label, size, usage });
        if (typeof dataOrSize !== 'number') {
          device.queue.writeBuffer(buffer, 0, dataOrSize);
        }
        return buffer;
      };
      const runCase = async ({ activePhysical, selectedPhysical, label }) => {
        const activeWords = makeActiveSource(activePhysical);
        const fieldWords = makeField({
          activeCount: activePhysical.length,
          selectedPhysical
        });
        const { assignments, mechanics } = makeSources({
          activePhysical,
          selectedPhysical
        });
        const stableOrder = makeStableOrder({
          activePhysical,
          selectedPhysical
        });
        const activeBuffer = createBuffer(
          `${label}-active`,
          activeWords,
          GPUBufferUsage.STORAGE
            | GPUBufferUsage.COPY_DST
            | GPUBufferUsage.INDIRECT
        );
        const fieldBuffer = createBuffer(
          `${label}-field`,
          fieldWords,
          GPUBufferUsage.STORAGE
            | GPUBufferUsage.COPY_DST
            | GPUBufferUsage.INDIRECT
        );
        const assignmentBuffer = createBuffer(
          `${label}-assignments`,
          assignments,
          GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        );
        const mechanicsBuffer = createBuffer(
          `${label}-mechanics`,
          mechanics,
          GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        );
        const orderBuffer = createBuffer(
          `${label}-order`,
          stableOrder,
          GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        );
        const momentParams = createBuffer(
          `${label}-moment-params`,
          paramsBytes(momentPlan),
          GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        );
        const momentControl = createBuffer(
          `${label}-moment-control`,
          momentLayout.controlByteLength,
          GPUBufferUsage.STORAGE
            | GPUBufferUsage.COPY_DST
        );
        const momentRows = createBuffer(
          `${label}-moment-rows`,
          momentLayout.momentByteLength,
          GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        );
        const contributions = createBuffer(
          `${label}-contributions`,
          momentLayout.candidateContributionByteLength,
          GPUBufferUsage.STORAGE
            | GPUBufferUsage.COPY_DST
        );
        const scratch = createBuffer(
          `${label}-scratch`,
          momentLayout.scratchByteLength,
          GPUBufferUsage.STORAGE
            | GPUBufferUsage.COPY_DST
        );
        const receiptParams = createBuffer(
          `${label}-receipt-params`,
          paramsBytes(receiptPlan, true),
          GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        );
        const receiptControl = createBuffer(
          `${label}-receipt-control`,
          receiptLayout.controlByteLength,
          GPUBufferUsage.STORAGE
            | GPUBufferUsage.COPY_SRC
            | GPUBufferUsage.COPY_DST
        );
        const receiptPartials = createBuffer(
          `${label}-receipt-partials`,
          receiptLayout.partialByteLength,
          GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        );
        const readback = createBuffer(
          `${label}-readback`,
          receiptLayout.controlByteLength,
          GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        );
        const buffers = [
          activeBuffer,
          fieldBuffer,
          assignmentBuffer,
          mechanicsBuffer,
          orderBuffer,
          momentParams,
          momentControl,
          momentRows,
          contributions,
          scratch,
          receiptParams,
          receiptControl,
          receiptPartials,
          readback
        ];
        try {
          const momentEntries = {
            assignment: { binding: 0, resource: { buffer: assignmentBuffer } },
            mechanics: { binding: 1, resource: { buffer: mechanicsBuffer } },
            field: { binding: 2, resource: { buffer: fieldBuffer } },
            order: { binding: 3, resource: { buffer: orderBuffer } },
            contributions: { binding: 4, resource: { buffer: contributions } },
            scratch: { binding: 5, resource: { buffer: scratch } },
            control: { binding: 6, resource: { buffer: momentControl } },
            rows: { binding: 7, resource: { buffer: momentRows } },
            params: { binding: 8, resource: { buffer: momentParams } },
            active: { binding: 9, resource: { buffer: activeBuffer } }
          };
          const momentGroups = {
            emit_phase_volume_moment_contributions: device.createBindGroup({
              layout: momentPipelines.emit_phase_volume_moment_contributions
                .getBindGroupLayout(0),
              entries: [
                momentEntries.assignment,
                momentEntries.mechanics,
                momentEntries.field,
                momentEntries.order,
                momentEntries.contributions,
                momentEntries.scratch,
                momentEntries.control,
                momentEntries.params,
                momentEntries.active
              ]
            }),
            materialize_phase_volume_moment_ranges: device.createBindGroup({
              layout: momentPipelines.materialize_phase_volume_moment_ranges
                .getBindGroupLayout(0),
              entries: [
                momentEntries.field,
                momentEntries.scratch,
                momentEntries.control,
                momentEntries.params,
                momentEntries.active
              ]
            }),
            reduce_phase_volume_moments: device.createBindGroup({
              layout: momentPipelines.reduce_phase_volume_moments
                .getBindGroupLayout(0),
              entries: [
                momentEntries.field,
                momentEntries.contributions,
                momentEntries.scratch,
                momentEntries.control,
                momentEntries.rows,
                momentEntries.params,
                momentEntries.active
              ]
            }),
            finalize_phase_volume_moments: device.createBindGroup({
              layout: momentPipelines.finalize_phase_volume_moments
                .getBindGroupLayout(0),
              entries: [
                momentEntries.field,
                momentEntries.control,
                momentEntries.params,
                momentEntries.active
              ]
            })
          };
          const receiptEntries = {
            mechanics: { binding: 0, resource: { buffer: mechanicsBuffer } },
            momentControl: { binding: 1, resource: { buffer: momentControl } },
            momentRows: { binding: 2, resource: { buffer: momentRows } },
            field: { binding: 3, resource: { buffer: fieldBuffer } },
            partials: { binding: 4, resource: { buffer: receiptPartials } },
            control: { binding: 5, resource: { buffer: receiptControl } },
            params: { binding: 6, resource: { buffer: receiptParams } },
            assignments: { binding: 7, resource: { buffer: assignmentBuffer } },
            active: { binding: 8, resource: { buffer: activeBuffer } }
          };
          const receiptCommon = [
            receiptEntries.momentControl,
            receiptEntries.momentRows,
            receiptEntries.field,
            receiptEntries.partials,
            receiptEntries.control,
            receiptEntries.params,
            receiptEntries.active
          ];
          const receiptGroups = {
            reduce_phase_volume_receipt_sources: device.createBindGroup({
              layout: receiptPipelines.reduce_phase_volume_receipt_sources
                .getBindGroupLayout(0),
              entries: [
                receiptEntries.mechanics,
                ...receiptCommon.slice(0, 6),
                receiptEntries.assignments,
                receiptEntries.active
              ]
            }),
            reduce_phase_volume_receipt_fields: device.createBindGroup({
              layout: receiptPipelines.reduce_phase_volume_receipt_fields
                .getBindGroupLayout(0),
              entries: receiptCommon
            }),
            finalize_phase_volume_receipt: device.createBindGroup({
              layout: receiptPipelines.finalize_phase_volume_receipt
                .getBindGroupLayout(0),
              entries: receiptCommon
            })
          };
          const encoder = device.createCommandEncoder({ label });
          encoder.clearBuffer(momentControl);
          encoder.clearBuffer(momentRows);
          encoder.clearBuffer(scratch);
          for (const [entryPoint, indirectBuffer, indirectOffset] of [
            [
              'emit_phase_volume_moment_contributions',
              activeBuffer,
              activeLayout.candidateDispatchOffsetBytes
            ],
            [
              'materialize_phase_volume_moment_ranges',
              activeBuffer,
              activeLayout.candidateDispatchOffsetBytes
            ],
            [
              'reduce_phase_volume_moments',
              fieldBuffer,
              fieldLayout.dispatchOffsetWords * 4
            ]
          ]) {
            const pass = encoder.beginComputePass({ label: `${label}-${entryPoint}` });
            pass.setPipeline(momentPipelines[entryPoint]);
            pass.setBindGroup(0, momentGroups[entryPoint]);
            pass.dispatchWorkgroupsIndirect(indirectBuffer, indirectOffset);
            pass.end();
          }
          {
            const entryPoint = 'finalize_phase_volume_moments';
            const pass = encoder.beginComputePass({ label: `${label}-${entryPoint}` });
            pass.setPipeline(momentPipelines[entryPoint]);
            pass.setBindGroup(0, momentGroups[entryPoint]);
            pass.dispatchWorkgroups(1);
            pass.end();
          }
          encoder.clearBuffer(receiptControl);
          encoder.clearBuffer(receiptPartials);
          for (const [entryPoint, indirectBuffer, indirectOffset] of [
            [
              'reduce_phase_volume_receipt_sources',
              activeBuffer,
              activeLayout.activeDispatchOffsetBytes
            ],
            [
              'reduce_phase_volume_receipt_fields',
              fieldBuffer,
              fieldLayout.dispatchOffsetWords * 4
            ]
          ]) {
            const pass = encoder.beginComputePass({ label: `${label}-${entryPoint}` });
            pass.setPipeline(receiptPipelines[entryPoint]);
            pass.setBindGroup(0, receiptGroups[entryPoint]);
            pass.dispatchWorkgroupsIndirect(indirectBuffer, indirectOffset);
            pass.end();
          }
          {
            const entryPoint = 'finalize_phase_volume_receipt';
            const pass = encoder.beginComputePass({ label: `${label}-${entryPoint}` });
            pass.setPipeline(receiptPipelines[entryPoint]);
            pass.setBindGroup(0, receiptGroups[entryPoint]);
            pass.dispatchWorkgroups(1);
            pass.end();
          }
          encoder.copyBufferToBuffer(
            receiptControl,
            0,
            readback,
            0,
            receiptLayout.controlByteLength
          );
          device.queue.submit([encoder.finish()]);
          await readback.mapAsync(GPUMapMode.READ);
          const control = new Uint32Array(readback.getMappedRange()).slice();
          readback.unmap();
          const floats = new Float32Array(control.buffer);
          return {
            statusFlags: control[2],
            globalSourceCount: control[16],
            fieldCount: control[18],
            globalCandidateCount: control[20],
            selectedSourceCount: control[47],
            selectedCandidateCount: control[48],
            selectedSourceVolumeM3: floats[30],
            fieldVolumeM3: floats[31],
            residualM3: floats[32],
            terminalSeal: control[59],
            sourceAuthorityVersion: control[60],
            physicalSourceCount: control[61],
            activeSourceCountAuthorityWord: control[62],
            candidateCountAuthorityWord: control[63]
          };
        } finally {
          for (const buffer of buffers) buffer.destroy();
        }
      };

      const sparseMixed = await runCase({
        activePhysical: [1, 5, 7],
        selectedPhysical: [1, 7],
        label: 'native-phase-volume-v2-sparse-mixed'
      });
      const empty = await runCase({
        activePhysical: [],
        selectedPhysical: [],
        label: 'native-phase-volume-v2-empty'
      });
      await device.queue.onSubmittedWorkDone();
      const validationError = await device.popErrorScope();
      return {
        status: 'ok',
        ready:
          receiptAbi.SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_STATUS_READY,
        admitted:
          receiptAbi.SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_STATUS_ADMITTED,
        sparseMixed,
        empty,
        validationError: validationError?.message || null,
        uncapturedErrors
      };
    });

    assert.notEqual(native.status, 'unsupported', native.reason);
    assert.equal(native.status, 'ok', native.compilationErrors?.join('\n'));
    assert.equal(native.validationError, null, native.validationError);
    assert.deepEqual(native.uncapturedErrors, []);
    for (const result of [native.sparseMixed, native.empty]) {
      assert.equal(
        result.statusFlags,
        native.ready | native.admitted,
        JSON.stringify(result)
      );
      assert.equal(result.sourceAuthorityVersion, 2);
      assert.equal(result.physicalSourceCount, 8);
      assert.equal(result.activeSourceCountAuthorityWord, 18);
      assert.equal(result.candidateCountAuthorityWord, 43);
      assert.notEqual(result.terminalSeal, 0);
    }
    assert.equal(native.sparseMixed.globalSourceCount, 3);
    assert.equal(native.sparseMixed.globalCandidateCount, 81);
    assert.equal(native.sparseMixed.selectedSourceCount, 2);
    assert.equal(native.sparseMixed.selectedCandidateCount, 54);
    assert.equal(native.sparseMixed.fieldCount, 8);
    assert.ok(Math.abs(native.sparseMixed.selectedSourceVolumeM3 - 0.012) < 2e-5);
    assert.ok(Math.abs(native.sparseMixed.fieldVolumeM3 - 0.012) < 2e-5);
    assert.ok(Math.abs(native.sparseMixed.residualM3) < 2e-5);
    assert.equal(native.empty.globalSourceCount, 0);
    assert.equal(native.empty.globalCandidateCount, 0);
    assert.equal(native.empty.selectedSourceCount, 0);
    assert.equal(native.empty.selectedCandidateCount, 0);
    assert.equal(native.empty.fieldCount, 0);
    assert.equal(native.empty.selectedSourceVolumeM3, 0);
    assert.equal(native.empty.fieldVolumeM3, 0);
    assert.equal(native.empty.residualM3, 0);
  } finally {
    await browser.close();
  }
});
