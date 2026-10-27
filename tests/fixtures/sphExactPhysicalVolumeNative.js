import { createSphExactMassFormat } from '../../ulg-gpu-abi/src/sphExactMassInventory.js';
import { SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_WORDS,
  SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_VERSION } from '../../ulg-gpu-abi/src/sphReactionProductPlacementReceipt.js';
import { sphExactPlacementQuantityLayout } from '../../src/runtime/sph/sphExactPlacementQuantityWgsl.js';
import { sphExactPlacementCaptureLayout } from '../../src/runtime/sph/sphExactPlacementCaptureWgsl.js';
import { sphExactPlacementReceiverCaloricLayout } from '../../src/runtime/sph/sphExactPlacementReceiverCaloricWgsl.js';
import { sphExactPlacementPhysicalApplyLayout, createSphExactPlacementPhysicalApplyWgsl,
  encodeSphExactPlacementPhysicalApplyParams, SPH_EXACT_PHYSICAL_APPLY_EVIDENCE_MAGIC }
  from '../../src/runtime/sph/sphExactPlacementPhysicalApplyWgsl.js';
import { prewarmCachedExplicitComputePipeline, computeBufferBinding } from '../../src/runtime/webgpuComputeLayout.js';

// Numeric kernel regression only: pending evidence is seeded to isolate these
// volume checks. This fixture creates no resident owner or publication capability.
export async function runExactPhysicalVolumeNative(device, wordCount = 9, report = () => {}, options = {}) {
  const fraction = (n, d = 1n) => [BigInt(n), BigInt(d)];
  const old = fraction(2, 1000), next = fraction(3, 1000);
  const tiny = 1n << 160n;
  const cases = [
    { name: 'positive-increment' },
    { name: 'equivalent-binary-factor', oldVolume: fraction(4, 2000), volume: fraction(6, 2000) },
    { name: 'equivalent-odd-factor', old: fraction(1, 3), oldVolume: fraction(3, 9), next: fraction(1, 2), volume: fraction(7, 14) },
    { name: 'wide-equivalent-ratio', old: fraction(1), oldVolume: fraction((1n << 256n) - 1n, (1n << 256n) - 1n), next: fraction(3, 2) },
    { name: 'sub-f32-increment', old: fraction(1), next: fraction(tiny + 1n, tiny) },
    { name: 'old-volume-mismatch', oldVolume: fraction(1, 1000), reject: true },
    { name: 'new-volume-mismatch', volume: fraction(4, 1000), reject: true },
    { name: 'same-f32-distinct-volumes', next: fraction(1), volume: fraction(tiny + 1n, tiny), reject: true },
    { name: 'zero-increment', next: old, reject: true },
    { name: 'negative-increment', next: fraction(1, 1000), reject: true },
    { name: 'invalid-old-denominator', oldVolume: fraction(1, 0), reject: true },
    { name: 'matching-invalid-old-denominators', old: fraction(1, 0), oldVolume: fraction(1, 0), reject: true },
    { name: 'invalid-new-denominator', volume: fraction(1, 0), reject: true },
    { name: 'invalid-new-header', reserved: 1, reject: true },
    { name: 'wrong-stage', stage: 158, reject: true }
  ];
  const count = options.particleCapacity ?? cases.length;
  const dispatchRows = options.dispatchRowCount ?? count;
  if (!Number.isSafeInteger(count) || count < cases.length
      || !Number.isSafeInteger(dispatchRows) || dispatchRows < cases.length || dispatchRows > count) {
    throw RangeError('Volume fixture requires capacity and dispatch covering every case');
  }
  const format = createSphExactMassFormat({ wordCount, quantumExponent: wordCount === 1 ? -8 : wordCount === 9 ? -149 : -1074 });
  const q = sphExactPlacementQuantityLayout(format, { particleCount: count, eventCapacity: count });
  const capture = sphExactPlacementCaptureLayout(format, q);
  const caloric = sphExactPlacementReceiverCaloricLayout(format, q, { receiverCapacity: count, maxIntervals: 1 });
  const layout = sphExactPlacementPhysicalApplyLayout(format, q, caloric, capture);
  const current = new Uint32Array(layout.currentWordLength), merged = new Uint32Array(layout.outputQuantityWordLength);
  const evidence = new Uint32Array(layout.evidenceWordLength), map = new Uint32Array(layout.mapWordLength);
  map.fill(0xffffffff, 0, count);
  function writeScalar(words, at, [n, d]) {
    words[at] = Number(n < 0n); if (n < 0n) n = -n;
    for (let i = 0; i < q.scalar.wordCount; i++) {
      words[at + 4 + i] = Number(n & 0xffffffffn);
      words[at + 4 + q.scalar.wordCount + i] = Number(d & 0xffffffffn);
      n >>= 32n; d >>= 32n;
    }
    if (n || d) throw Error('Volume fixture exceeds scalar capacity');
  }
  for (const [i, c] of cases.entries()) {
    const source = (q.currentRowOffset + i) * q.recordWords + q.scalarOffsetWords;
    const target = i * q.recordWords + q.scalarOffsetWords;
    writeScalar(current, source + 4 * q.scalar.recordWords, c.old ?? old);
    writeScalar(current, source + 5 * q.scalar.recordWords, c.oldVolume ?? c.old ?? old);
    writeScalar(merged, target + 4 * q.scalar.recordWords, c.next ?? next);
    writeScalar(merged, target + 5 * q.scalar.recordWords, c.volume ?? c.next ?? next);
    merged[target + 5 * q.scalar.recordWords + 3] = c.reserved ?? 0;
    evidence.set([SPH_EXACT_PHYSICAL_APPLY_EVIDENCE_MAGIC, 1, c.stage ?? 159, 0, i, i, 0, 0], i * layout.evidenceRecordWords);
    map[i] = i;
  }
  const placement = new Uint32Array(16);
  placement.set([count, count, 0, 2, 3, 8]); placement[15] = SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_VERSION;
  const params = encodeSphExactPlacementPhysicalApplyParams(layout, placement,
    { phaseRecordCount: 1, gasConstitutiveOffset: 0, graphRecordCount: 1 });
  const resources = [];
  const buffer = (data, usage = 128 | 4 | 8) => {
    const b = device.createBuffer({ size: typeof data === 'number' ? data : data.byteLength, usage });
    resources.push(b); if (typeof data !== 'number') device.queue.writeBuffer(b, 0, data); return b;
  };
  try {
    const bs = [buffer(layout.packedPhysicalWordLength * 4), buffer(current), buffer(merged), buffer(map),
      buffer(layout.caloricWordLength * 4), buffer(3 * 16), buffer(16), buffer(layout.captureWordLength * 4),
      buffer(count * 6 * 16), buffer(layout.candidateWordLength * 4),
      buffer(SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_WORDS * 4), buffer(evidence), buffer(params, 64 | 8)];
    const code = createSphExactPlacementPhysicalApplyWgsl(format, q, caloric, capture);
    const types = Array(9).fill('read-only-storage').concat(['storage', 'storage', 'storage', 'uniform']);
    const pipelines = [];
    for (const entryPoint of ['validate_exact_receiver_old_volume_identity', 'validate_exact_receiver_rest_delta', 'validate_exact_receiver_volume_delta']) {
      report({ event: 'compile-start', entryPoint, wordCount });
      const p = await prewarmCachedExplicitComputePipeline(device, { code, entryPoint, label: entryPoint,
        cacheKey: `physical-volume-${wordCount}-${entryPoint}`, bindings: types.map((type, binding) => computeBufferBinding(binding, type)) });
      if (!p.pipeline) throw p.error ?? Error('Volume pipeline unavailable');
      pipelines.push({ ...p, entryPoint }); report({ event: 'compile-complete', entryPoint, wordCount });
    }
    const readback = buffer(evidence.byteLength, 1 | 8);
    for (const p of pipelines) {
      const group = device.createBindGroup({ layout: p.bindGroupLayout, entries: bs.map((buffer, binding) => ({ binding, resource: { buffer } })) });
      const encoder = device.createCommandEncoder(), pass = encoder.beginComputePass();
      report({ event: 'dispatch-start', entryPoint: p.entryPoint, wordCount, dispatchRows });
      pass.setPipeline(p.pipeline); pass.setBindGroup(0, group); pass.dispatchWorkgroups(dispatchRows); pass.end();
      device.queue.submit([encoder.finish()]); await device.queue.onSubmittedWorkDone();
      report({ event: 'dispatch-complete', entryPoint: p.entryPoint, wordCount, dispatchRows });
    }
    const encoder = device.createCommandEncoder(); encoder.copyBufferToBuffer(bs[11], 0, readback, 0, evidence.byteLength);
    device.queue.submit([encoder.finish()]); await readback.mapAsync(1);
    const out = new Uint32Array(readback.getMappedRange()).slice(); readback.unmap();
    const results = cases.map((c, i) => {
      const at = i * layout.evidenceRecordWords, stage = out[at + 2], error = out[at + 3];
      let pass = c.reject ? stage === 3 && error !== 0 : stage === 162 && error === 0;
      if (!c.reject) {
        const scalar = at + 40 + caloric.scalar.recordWords;
        let n = 0n, d = 0n;
        for (let limb = caloric.scalar.wordCount - 1; limb >= 0; limb--) {
          n = (n << 32n) | BigInt(out[scalar + 4 + limb]);
          d = (d << 32n) | BigInt(out[scalar + 4 + caloric.scalar.wordCount + limb]);
        }
        if (out[scalar]) n = -n;
        const exponent = out[scalar + 2] | 0;
        if (exponent < 0) d <<= BigInt(-exponent); else n <<= BigInt(exponent);
        const [an, ad] = c.old ?? old, [bn, bd] = c.next ?? next;
        pass &&= out[scalar + 1] === 0 && out[scalar + 3] === 0 && d > 0n && n * ad * bd === (bn * ad - an * bd) * d;
      }
      return { name: c.name, stage, error, pass };
    });
    return { wordCount, particleCapacity: count, dispatchRows, results, pass: results.every(r => r.pass) };
  } finally { for (const b of resources) b.destroy(); }
}
