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
