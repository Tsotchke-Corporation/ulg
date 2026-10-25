import { createSphReactionProductEventCompactWgsl } from '../../ulg-gpu-abi/src/wgsl.js';
import { SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX as I,
  SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_WORDS as RECEIPT_WORDS } from '../../ulg-gpu-abi/src/sphReactionProductPlacementReceipt.js';
import { validateSphExactMassFormat } from '../../ulg-gpu-abi/src/sphExactMassInventory.js';
import { deferConfirmedSubmittedWorkCleanup } from '../../src/runtime/webgpuComputeLayout.js';

const integer = words => [...words].reverse().reduce((n, word) => (n << 32n) | BigInt(word), 0n);
const writeInteger = (words, at, n, count) => { for (let i = 0; i < count; i++) { words[at + i] = Number(n & 0xffffffffn); n >>= 32n; } };

export function exactReactionEventCompactionCases(n) {
  const stride = 8 + 3 * n, rows = 130;
  const make = name => {
    const events = new Uint32Array(rows * 32), companions = new Uint32Array(rows * stride);
    for (let row = 0; row < rows; row++) {
      for (let word = 0; word < 32; word++) events[row * 32 + word] = 0x3f800000 + row * 32 + word;
      const live = row % 3 !== 0 || [63, 64, 127, 128].includes(row), at = row * stride;
      if (!live && row % 2 !== 0) continue;
      companions.set([Math.floor(row / 2), 7, 2, 13, Number(live), 1, 0, 0], at);
      if (!live) continue;
      const mass = row === 64 ? 1n : (1n << BigInt(32 * n - 1)) + BigInt(row + 1);
      const direct = row % 4 === 0 ? mass : mass / 3n;
      writeInteger(companions, at + 8, mass, n); writeInteger(companions, at + 8 + n, direct, n);
      writeInteger(companions, at + 8 + 2 * n, mass - direct, n);
      if (row === 64) { events[row * 32 + 3] = 0; events[row * 32 + 12] = 0; events[row * 32 + 13] = 0;
        events[row * 32 + 15] = 1; events[row * 32 + 16] = 0x80000000; }
    }
    return { name, events, companions, rowCount: rows, eventStride: 8, groupCount: 3, reserved: 0,
      outputCapacity: rows, outputCompanionWords: rows * stride, prefixCapacity: rows,
      groupCapacity: 3, offsetCapacity: 3, countWords: 2, receiptWords: RECEIPT_WORDS };
  };
  const cases = [make('stable-130-cross-group-hidden-direct')];
  const mutate = (name, change) => { const value = make(name); change(value); cases.push(value); };
  mutate('empty-logical-prefix', x => { x.rowCount = 0; x.groupCount = 0; });
  mutate('zero-only-diagnostic-prefix', x => { x.companions.fill(0); for (let row = 0; row < rows; row++) x.companions.set([row, 7, 2, 13, 0, 1, 0, 0], row * stride); });
  mutate('full-direct-all-rows', x => { for (let row = 0; row < rows; row++) {
    const at = row * stride; x.companions.set([row, 7, 2, 13, 1, 1, 0, 0], at);
    x.companions.fill(0, at + 8, at + stride); x.companions[at + 8] = 1; x.companions[at + 8 + n] = 1;
  } });
  for (const [name, offset, value] of [['activity-mismatch', 4, 0], ['missing-ready', 5, 0],
    ['writer-error', 6, 32], ['reserved-word', 7, 1], ['invalid-material', 3, 0],
    ['invalid-term-sentinel', 1, 0xffffffff], ['invalid-species-ordinal', 2, 1]]) {
    mutate(name, x => { x.companions[64 * stride + offset] = value; });
  }
  mutate('partially-written-inactive-header', x => { x.companions[3 * stride] = 12; });
  mutate('wrong-partition-last-group', x => { x.companions[128 * stride + 8 + 2 * n] = 1; });
  mutate('partition-carry-overflow', x => { const at = 64 * stride; x.companions.fill(0, at + 8, at + stride);
    x.companions[at + 4] = 0; x.companions.fill(0xffffffff, at + 8 + n, at + 8 + 2 * n); x.companions[at + 8 + 2 * n] = 1; });
  mutate('short-source-companion', x => { x.companions = x.companions.slice(0, -1); });
  mutate('mismatched-output-companion-capacity', x => { x.outputCompanionWords -= stride; });
  mutate('insufficient-matching-output-capacity', x => { x.outputCapacity = 1; x.outputCompanionWords = stride; });
  mutate('wrong-group-count', x => { x.groupCount = 2; });
  mutate('short-prefix', x => { x.prefixCapacity = rows - 1; });
  mutate('short-group-offsets', x => { x.offsetCapacity = 2; });
  mutate('short-count-control', x => { x.countWords = 1; });
  mutate('short-receipt', x => { x.receiptWords = RECEIPT_WORDS - 1; });
  mutate('wrong-event-stride', x => { x.eventStride = 9; });
  mutate('nonzero-params-reserved', x => { x.reserved = 1; });
  return cases;
}

/** Independent stable filtering oracle: no prefix scan or shader arithmetic. */
export function referenceExactReactionEventCompaction(input, n) {
  const stride = 8 + 3 * n;
  const invalid = () => ({ error: 1, liveCount: 0, sourceRows: [], events: [], companions: [] });
  if (input.eventStride !== 8 || input.reserved !== 0 || input.groupCount !== Math.ceil(input.rowCount / 64)
    || input.countWords < 2 || input.receiptWords < RECEIPT_WORDS
    || input.events.length % 32 || input.companions.length % stride
    || input.events.length / 32 !== input.companions.length / stride
    || input.outputCompanionWords !== input.outputCapacity * stride
    || input.rowCount > input.events.length / 32 || input.prefixCapacity < input.rowCount
    || input.groupCapacity < input.groupCount || input.offsetCapacity < input.groupCount) return invalid();
  const sourceRows = [];
  for (let row = 0; row < input.rowCount; row++) {
    const at = row * stride, h = input.companions.subarray(at, at + 8);
    const mass = integer(input.companions.subarray(at + 8, at + 8 + n));
    const direct = integer(input.companions.subarray(at + 8 + n, at + 8 + 2 * n));
    const residual = integer(input.companions.subarray(at + 8 + 2 * n, at + stride));
    if (h[4] > 1 || h[5] > 1 || h[6] || h[7] || h[4] !== Number(mass !== 0n)
      || mass !== direct + residual || (mass !== 0n && h[5] !== 1)
      || (h[5] === 0 && h.subarray(0, 5).some(word => word !== 0))
      || (h[5] === 1 && (h[0] === 0xffffffff || h[1] === 0xffffffff || h[2] < 2
        || h[2] === 0xffffffff || h[3] === 0 || h[3] === 0xffffffff))) return invalid();
    if (mass) sourceRows.push(row);
  }
  if (sourceRows.length > input.outputCapacity) return invalid();
  return { error: 0, liveCount: sourceRows.length, sourceRows,
    events: sourceRows.flatMap(row => [...input.events.subarray(row * 32, (row + 1) * 32)]),
    companions: sourceRows.flatMap(row => [...input.companions.subarray(row * stride, (row + 1) * stride)]) };
}

export async function runExactReactionEventCompactionNative(device, format, { onProgress = null, cases: supplied = null } = {}) {
  validateSphExactMassFormat(format);
  const n = format.wordCount, cases = supplied ?? exactReactionEventCompactionCases(n), results = [];
  const progress = value => { try { const pending = onProgress?.({ wordCount: n, ...value });
    if (pending?.then) void Promise.resolve(pending).catch(() => {}); } catch {} };
  progress({ phase: 'compiling' });
  const module = device.createShaderModule({ code: createSphReactionProductEventCompactWgsl({ exactCompanion: { massWordCount: n } }) });
  const errors = (await module.getCompilationInfo()).messages.filter(x => x.type === 'error');
  if (errors.length) throw new Error(errors.map(x => `${x.lineNum}: ${x.message}`).join('\n'));
  const binding = (binding, type) => ({ binding, visibility: 4, buffer: { type } });
  const bindGroupLayout = device.createBindGroupLayout({ entries: Array.from({ length: 10 }, (_, index) =>
    binding(index, index === 3 ? 'uniform' : index === 0 || index === 8 ? 'read-only-storage' : 'storage')) });
  const layout = device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });
  const pipelines = [];
  for (const entryPoint of ['count_placement_rows', 'scan_placement_row_groups', 'scatter_placement_rows']) {
    pipelines.push(await device.createComputePipelineAsync({ layout, compute: { module, entryPoint } }));
  }
  for (const input of cases) {
    const owned = []; let submitted = false, mapped = null;
    const allocate = (label, bytes, usage) => { const buffer = device.createBuffer({ label, size: Math.max(4, bytes), usage }); owned.push(buffer); return buffer; };
    try {
      const expected = referenceExactReactionEventCompaction(input, n), sizes = [input.events.byteLength, input.outputCapacity * 128,
        input.countWords * 4, 16, input.receiptWords * 4, input.prefixCapacity * 4, input.groupCapacity * 4,
        input.offsetCapacity * 4, input.companions.byteLength, input.outputCompanionWords * 4];
      const buffers = sizes.map((bytes, index) => allocate(`event-compact-${input.name}-${index}`, bytes, (index === 3 ? 64 : 128) | 4 | 8));
      device.queue.writeBuffer(buffers[0], 0, input.events); device.queue.writeBuffer(buffers[8], 0, input.companions);
      device.queue.writeBuffer(buffers[3], 0, new Uint32Array([input.rowCount, input.eventStride, input.groupCount, input.reserved]));
      const sentinel = 0x3f123456;
      device.queue.writeBuffer(buffers[1], 0, new Uint32Array(sizes[1] / 4).fill(sentinel));
      device.queue.writeBuffer(buffers[9], 0, new Uint32Array(sizes[9] / 4).fill(sentinel));
      const indices = [0, 8, 1, 9, 2, 4], offsets = [];
      let readBytes = 0; for (const index of indices) { offsets.push(readBytes / 4); readBytes += sizes[index]; }
      const readback = allocate('event-compact-readback', readBytes, 1 | 8);
      const group = device.createBindGroup({ layout: bindGroupLayout, entries: buffers.map((buffer, binding) => ({ binding, resource: { buffer } })) });
      const encoder = device.createCommandEncoder();
      for (let i = 0; i < pipelines.length; i++) {
        const pass = encoder.beginComputePass(); pass.setPipeline(pipelines[i]); pass.setBindGroup(0, group);
        pass.dispatchWorkgroups(i === 1 ? 1 : Math.max(1, Math.ceil(input.rowCount / 64))); pass.end();
      }
      indices.forEach((index, j) => encoder.copyBufferToBuffer(buffers[index], 0, readback, offsets[j] * 4, sizes[index]));
      const command = encoder.finish(); submitted = true; device.queue.submit([command]);
      await readback.mapAsync(1); mapped = readback;
      const words = new Uint32Array(readback.getMappedRange()).slice(); readback.unmap(); mapped = null;
      const slice = j => words.subarray(offsets[j], offsets[j] + sizes[indices[j]] / 4);
      const sourceUnchanged = input.events.every((v, i) => slice(0)[i] === v) && input.companions.every((v, i) => slice(1)[i] === v);
      const actualEvents = slice(2), actualCompanions = slice(3), control = slice(4), receipt = slice(5);
      const errorObserved = input.countWords >= 2 ? control[1] : receipt[I.compactionOverflowCount];
      const matches = sourceUnchanged && control[0] === expected.liveCount && errorObserved === expected.error
        && (expected.error ? actualEvents.every(v => v === sentinel) && actualCompanions.every(v => v === sentinel)
          : expected.events.every((v, i) => actualEvents[i] === v) && expected.companions.every((v, i) => actualCompanions[i] === v))
        && (input.receiptWords < RECEIPT_WORDS || (receipt[I.activeEventCount] === expected.liveCount
          && receipt[I.compactionOverflowCount] === expected.error
          && receipt[I.compactScatterPassCount] === Number(!expected.error)));
      results.push({ name: input.name, sourceUnchanged, expected: { liveCount: expected.liveCount, error: expected.error, sourceRows: expected.sourceRows },
        control: [...control], receipt: [...receipt], events: [...actualEvents.slice(0, expected.events.length)],
        companions: [...actualCompanions.slice(0, expected.companions.length)], matches });
      progress({ phase: 'case-complete', name: input.name, matches });
    } finally {
      if (mapped) mapped.unmap();
      const cleanup = () => { const errors = []; for (const buffer of owned) try { buffer.destroy(); } catch (error) { errors.push(error); }
        if (errors.length) throw new AggregateError(errors, 'Event compaction native cleanup failed'); };
      if (submitted) {
        const queueCompleted = await deferConfirmedSubmittedWorkCleanup(device, cleanup);
        if (!queueCompleted) throw new Error('Exact event compaction device was lost during retirement');
      } else cleanup();
    }
  }
  return { wordCount: n, caseCount: results.length, physicalPublicationAdmitted: false,
    pass: results.every(row => row.matches), cases: results };
}
