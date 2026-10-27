import { prepareSphExactPhaseCarrierMass } from '../../src/runtime/sph/sphExactPhaseCarrierMassGpu.js';
import { tagWebGpuBufferDevice } from '../../src/runtime/sph/sphGpuDeviceIdentity.js';
import { createSphExactMassFormat } from '../../ulg-gpu-abi/src/sphExactMassInventory.js';

export function runPhaseMassFormatNative(device, options) {
  return runPhaseMassNative(device, createSphExactMassFormat(options));
}

const toWords = (n, width) => Array.from({ length: width }, (_, i) => Number((n >> BigInt(i * 32)) & 0xffffffffn));
const fromWords = words => Array.from(words).reduceRight((n, word) => (n << 32n) | BigInt(word), 0n);
// Independent integer oracle. Every binary32 fraction is a whole count in
// 2^-149 units, so direct BigInt multiply/divide gives cumulative shares
// without reproducing the shader's normalized limb representation.
const fractionUnits = value => {
  const bits = new Uint32Array(new Float32Array([value]).buffer)[0];
  const encoded = (bits >>> 23) & 255;
  return BigInt((bits & 0x7fffff) | (encoded ? 0x800000 : 0)) << BigInt(Math.max(0, encoded - 1));
};

export function phaseMassCases(format) {
  const max = (1n << BigInt(format.wordCount * 32)) - 1n;
  const masses = [1n, (1n << BigInt(format.wordCount * 32 - 2)) + 37n, 31n, 0n];
  const pure = phase => Array.from({ length: 4 }, (_, i) => Number(i === phase));
  return [
    { name: 'one-hot-relocation', masses, fractions: [pure(2), pure(0), pure(1), pure(3)] },
    { name: 'split-and-merge-low-limbs', masses, fractions: [[.25, .75, 0, 0], [.5, .5, 0, 0], pure(1), pure(3)] },
    { name: 'last-quantum-retained', masses: [1n, 0n, 0n, 0n], fractions: [[.5, .5, 0, 0], pure(0), pure(0), pure(0)] },
    { name: 'non-dyadic-ratio-of-f32-weights', masses, fractions: [[.1, .9, 0, 0], pure(2), pure(0), pure(0)] },
    { name: 'nonadjacent-phase-pair', masses, fractions: [[.1, 0, 0, .9], pure(2), pure(0), pure(0)] },
    { name: 'last-two-phase-pair', masses, fractions: [[0, 0, .625, .375], pure(1), pure(0), pure(0)] },
    { name: 'single-weight-roundoff', masses, fractions: [[0, 0, 0, 1 - 2 ** -24], pure(1), pure(0), pure(0)] },
    { name: 'merge-overflow', masses: [max, 1n, 0n, 0n], fractions: [pure(2), pure(2), pure(2), pure(2)], rejects: true },
    { name: 'negative-fraction', masses, fractions: [[-.2, 1.2, 0, 0], pure(0), pure(0), pure(0)], rejects: true },
    { name: 'nan-fraction', masses, fractions: [[NaN, 1, 0, 0], pure(0), pure(0), pure(0)], rejects: true },
    { name: 'missing-fraction', masses, fractions: [[0, 0, 0, 0], pure(0), pure(0), pure(0)], rejects: true },
    { name: 'inconsistent-species', masses, fractions: [pure(0), pure(0), pure(0), pure(0)], differentMaterial: true, rejects: true },
    { name: 'small-fraction-capacity', masses, fractions: [[1, 2 ** -40, 0, 0], pure(2), pure(0), pure(0)], rejects: format.wordCount === 1 },
    { name: 'subnormal-fraction-bits', masses: [masses[1], 0n, 0n, 0n],
      fractions: [[1, 2 ** -149, 0, 0], pure(0), pure(0), pure(0)], rejects: format.wordCount === 1 },
    { name: 'independent-lineages', masses: [1n, 5n, masses[1], 17n, 0n, 3n, 9n, 0n],
      fractions: [pure(2), pure(1), pure(0), pure(3), pure(0), pure(2), pure(2), pure(0)] },
    { name: 'all-lanes-full-capacity', masses: [max, max, max, max], fractions: [pure(0), pure(1), pure(2), pure(3)] },
    { name: 'bad-lineage-rolls-back-whole-stage', masses: [1n, 5n, 3n, 17n, 0n, 3n, 9n, 0n],
      fractions: [pure(2), [.2, .3, .5, 0], pure(0), pure(3), pure(0), pure(2), pure(2), pure(0)], rejects: true }
  ];
}

export async function runPhaseMassNative(device, format, rows = phaseMassCases(format)) {
  const results = [];
  for (const row of rows) {
    const count = row.masses.length, lineageCapacity = count / 4;
    const resources = [];
    const allocate = description => { const b = tagWebGpuBufferDevice(device.createBuffer(description), device); resources.push(b); return b; };
    const inputMass = new Uint32Array(row.masses.flatMap(m => toWords(m, format.wordCount)));
    const thermo = new Float32Array(count * 12);
    row.fractions.forEach((fractions, i) => { thermo[i * 12] = row.differentMaterial && i === 1 ? 2 : 1;
      thermo.set(fractions, i * 12 + 4); });
    const sourceMassBuffer = allocate({ size: inputMass.byteLength, usage: 128 | 8 });
    const sourceThermoBuffer = allocate({ size: thermo.byteLength, usage: 128 | 8 });
    device.queue.writeBuffer(sourceMassBuffer, 0, inputMass); device.queue.writeBuffer(sourceThermoBuffer, 0, thermo);
    try {
      const stage = await prepareSphExactPhaseCarrierMass({ device, format, lineageCapacity,
        sourceMassBuffer, sourceThermoBuffer, allocate, validate() {} });
      const outputs = [stage.massBuffer, stage.packetMassBuffer, stage.validationBuffer];
      const reads = outputs.map(source => allocate({ size: source.size, usage: 1 | 8 }));
      const encoder = device.createCommandEncoder(); stage.encode(encoder);
      outputs.forEach((source, i) => encoder.copyBufferToBuffer(source, 0, reads[i], 0, source.size));
      device.queue.submit([encoder.finish()]);
      const observed = await Promise.all(reads.map(async b => { await b.mapAsync(1); const words = new Uint32Array(b.getMappedRange().slice(0)); b.unmap(); return words; }));
      const actual = Array.from({ length: count }, (_, i) => fromWords(observed[0].slice(i * format.wordCount, (i + 1) * format.wordCount)));
      const expected = Array(count).fill(0n), packets = [];
      if (!row.rejects) for (let source = 0; source < count; source++) {
        const weights = row.fractions[source].map(fractionUnits), denominator = weights.reduce((a, b) => a + b);
        let prefix = 0n;
        for (let phase = 0; phase < 4; phase++) {
          const next = prefix + weights[phase];
          const packet = row.masses[source] * next / denominator - row.masses[source] * prefix / denominator;
          expected[phase * lineageCapacity + source % lineageCapacity] += packet;
          packets.push(...toWords(packet, format.wordCount)); prefix = next;
        }
      }
      const matches = row.rejects
        ? observed[2][0] !== 0 && actual.every((mass, i) => mass === row.masses[i]) && observed[1].every(word => word === 0)
        : observed[2][0] === 0 && actual.every((mass, i) => mass === expected[i]) && observed[1].every((word, i) => word === packets[i]);
      results.push({ name: row.name, matches, errors: observed[2][0], rejected: Boolean(row.rejects),
        massConserved: actual.reduce((a, b) => a + b) === row.masses.reduce((a, b) => a + b),
        ...(!matches ? { actual: actual.map(String), expected: expected.map(String),
          packets: Array.from(observed[1]), expectedPackets: packets, control: Array.from(observed[2]) } : {}) });
    } finally { await device.queue.onSubmittedWorkDone(); resources.forEach(b => b.destroy()); }
  }
  return results;
}
