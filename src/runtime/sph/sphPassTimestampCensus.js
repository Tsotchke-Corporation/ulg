import { wrapWorkerQueueRealSubmit } from '../webgpuComputeLayout.js';
// Diagnostic-only per-pass GPU timing for one device: every compute pass
// encoded after arming gets beginning/end timestamp writes (unless it already
// has its own), and the GPU durations are summed by pass label. The stage
// brackets of residentGpuTimestampProfile=1 say which stage is slow; this says
// which pass inside it.
//
// It patches only the given device instance (createCommandEncoder and its
// queue's submit), needs the 'timestamp-query' feature (requested under
// residentGpuTimestampProfile=1), and adds one resolve, one copy and one
// mapAsync per profiled encoder. Never enabled in a production frame.
const MAX_PASSES_PER_ENCODER = 512;
const QUERY_BYTES = 8;
const USAGE = Object.freeze({
  MAP_READ: globalThis.GPUBufferUsage?.MAP_READ ?? 1,
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  QUERY_RESOLVE: globalThis.GPUBufferUsage?.QUERY_RESOLVE ?? 512
});

function normalizedLabel(label) {
  return String(label || 'unlabelled-compute-pass').replace(/\d+/g, '#').slice(0, 120);
}

export function armSphPassTimestampCensus(device, { mode = globalThis.__ulgPassCensusMode ?? 'full' } = {}) {
  // Diagnostic split (probe-only): 'timestamps-only' writes pass timestamps
  // but never resolves or reads them; 'readback-only' resolves, copies and maps
  // a small buffer per encoder without timestamp writes.
  if (!device?.features?.has?.('timestamp-query')) {
    return { status: 'timestamp-query-unavailable' };
  }
  if (device.__ulgPassTimestampCensus) return device.__ulgPassTimestampCensus;
  const totals = new Map();
  const pool = [];
  const pendingByCommandBuffer = new WeakMap();
  let profiledEncoders = 0;
  let overflowPasses = 0;
  let readbackFailures = 0;
  const takeSlot = () => pool.pop() ?? {
    querySet: device.createQuerySet({ type: 'timestamp', count: MAX_PASSES_PER_ENCODER * 2 }),
    resolve: device.createBuffer({ size: MAX_PASSES_PER_ENCODER * 2 * QUERY_BYTES,
      usage: USAGE.QUERY_RESOLVE | USAGE.COPY_SRC }),
    read: device.createBuffer({ size: MAX_PASSES_PER_ENCODER * 2 * QUERY_BYTES,
      usage: USAGE.MAP_READ | USAGE.COPY_DST })
  };
  const originalCreateCommandEncoder = device.createCommandEncoder.bind(device);
  let encoderOrdinal = 0;
  device.createCommandEncoder = (descriptor) => {
    const encoder = originalCreateCommandEncoder(descriptor);
    encoderOrdinal += 1;
    // 'sparse': the full census on 1 encoder in 20 (samples pass times while
    // leaving most encoders untouched).
    if (mode === 'sparse' && encoderOrdinal % 20 !== 0) return encoder;
    let slot = null;
    const labels = [];
    const originalBegin = encoder.beginComputePass.bind(encoder);
    encoder.beginComputePass = (passDescriptor = {}) => {
      if (passDescriptor?.timestampWrites) return originalBegin(passDescriptor);
      if (mode === 'readback-only' || mode === 'wrap-only' || mode === 'copy-no-map' || mode === 'map-no-copy') {
        slot ??= takeSlot();
        labels.push(normalizedLabel(passDescriptor?.label));
        return originalBegin(passDescriptor);
      }
      if (labels.length >= MAX_PASSES_PER_ENCODER) {
        overflowPasses += 1;
        return originalBegin(passDescriptor);
      }
      slot ??= takeSlot();
      const index = labels.length;
      labels.push(normalizedLabel(passDescriptor?.label));
      return originalBegin({
        ...passDescriptor,
        timestampWrites: {
          querySet: slot.querySet,
          beginningOfPassWriteIndex: index * 2,
          endOfPassWriteIndex: index * 2 + 1
        }
      });
    };
    const originalFinish = encoder.finish.bind(encoder);
    encoder.finish = (finishDescriptor) => {
      const copyless = mode === 'timestamps-only' || mode === 'wrap-only' || mode === 'map-no-copy';
      if (slot && labels.length && !copyless) {
        const bytes = labels.length * 2 * QUERY_BYTES;
        if (mode === 'full') encoder.resolveQuerySet(slot.querySet, 0, labels.length * 2, slot.resolve, 0);
        encoder.copyBufferToBuffer(slot.resolve, 0, slot.read, 0, bytes);
      }
      const commandBuffer = originalFinish(finishDescriptor);
      if ((mode === 'timestamps-only' || mode === 'wrap-only' || mode === 'copy-no-map') && slot) { pool.push(slot); slot = null; }
      if (slot && labels.length) pendingByCommandBuffer.set(commandBuffer, { slot, labels });
      return commandBuffer;
    };
    return encoder;
  };
  const queue = device.queue;
  // Map only after the real submit: below the worker submit burst when one is
  // armed (wrapWorkerQueueRealSubmit). Wrapping queue.submit above a burst
  // mapped buffers of held, not-yet-submitted command buffers, which failed
  // the burst's flush and dropped every step's work (2026-11-16: 1,151 of
  // 1,152 Iron Ice steps rolled back, which read as a 2.5x "speedup").
  const censusSubmit = (originalSubmit) => (commandBuffers) => {
    const result = originalSubmit(commandBuffers);
    for (const commandBuffer of commandBuffers || []) {
      const pending = pendingByCommandBuffer.get(commandBuffer);
      if (!pending) continue;
      pendingByCommandBuffer.delete(commandBuffer);
      profiledEncoders += 1;
      const { slot, labels } = pending;
      slot.read.mapAsync(USAGE.MAP_READ, 0, labels.length * 2 * QUERY_BYTES).then(() => {
        const times = new BigUint64Array(slot.read.getMappedRange(0, labels.length * 2 * QUERY_BYTES));
        labels.forEach((label, index) => {
          const begin = times[index * 2];
          const end = times[index * 2 + 1];
          const row = totals.get(label) ?? { count: 0, ns: 0 };
          row.count += 1;
          if (end > begin) row.ns += Number(end - begin);
          totals.set(label, row);
        });
        slot.read.unmap();
        pool.push(slot);
      }, () => { readbackFailures += 1; });
    }
    return result;
  };
  if (!wrapWorkerQueueRealSubmit(device, censusSubmit)) {
    queue.submit = censusSubmit(queue.submit.bind(queue));
  }
  const census = Object.freeze({
    status: 'armed',
    reset() { totals.clear(); profiledEncoders = 0; overflowPasses = 0; readbackFailures = 0; },
    read() {
      const rows = [...totals.entries()]
        .map(([label, row]) => ({ label, count: row.count, totalMs: row.ns / 1e6 }))
        .sort((a, b) => b.totalMs - a.totalMs);
      return { profiledEncoders, overflowPasses, readbackFailures, poolSize: pool.length, rows };
    }
  });
  Object.defineProperty(device, '__ulgPassTimestampCensus', { value: census, configurable: true });
  return census;
}
