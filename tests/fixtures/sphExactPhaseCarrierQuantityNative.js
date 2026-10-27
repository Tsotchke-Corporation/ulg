import { createSphExactMassFormat } from '../../ulg-gpu-abi/src/sphExactMassInventory.js';
import { sphExactPlacementQuantityLayout } from '../../src/runtime/sph/sphExactPlacementQuantityWgsl.js';
import { prepareSphExactPhaseCarrierMass } from '../../src/runtime/sph/sphExactPhaseCarrierMassGpu.js';
import { prepareSphExactPhaseCarrierQuantities } from '../../src/runtime/sph/sphExactPhaseCarrierQuantityGpu.js';
import { tagWebGpuBufferDevice } from '../../src/runtime/sph/sphGpuDeviceIdentity.js';
import { referenceExactRationalQuantity, referenceRationalQuantityProjection } from './sphExactRationalQuantityNative.js';

const words = (n, length) => Array.from({ length }, (_, i) => Number((n >> BigInt(i * 32)) & 0xffffffffn));
const integer = values => Array.from(values).reduceRight((n, v) => (n << 32n) | BigInt(v), 0n);
const gcd = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; };
const fraction = (n, d = 1n) => { const g = gcd(n, d) || 1n; return { n: n / g, d: d / g }; };
const add = (a, b) => fraction(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a, b) => add(a, { n: -b.n, d: b.d });
const mul = (a, b) => fraction(a.n * b.n, a.d * b.d);
const div = (a, b) => fraction(a.n * b.d, a.d * b.n);
const equal = (a, b) => a.n * b.d === b.n * a.d;
const zero = () => fraction(0n);
const f32bits = value => new Uint32Array(new Float32Array([value]).buffer)[0];
const packedScalar = (value, layout) => {
  const v = referenceExactRationalQuantity({ wordCount: layout.scalar.wordCount },
    { a: { numerator: value.n, denominator: value.d, exponent: 0 } });
  if (v.error) throw Error('Fixture rational exceeds capacity');
  return [v.negative, v.error, v.exponent >>> 0, 0,
    ...words(v.numerator, layout.scalar.wordCount), ...words(v.denominator, layout.scalar.wordCount)];
};
const unpackScalar = (input, layout, row, field) => {
  const offset = row * layout.recordWords + layout.scalarOffsetWords + field * layout.scalar.recordWords;
  const n = integer(input.slice(offset + 4, offset + 4 + layout.scalar.wordCount)) * (input[offset] ? -1n : 1n);
  const d = integer(input.slice(offset + 4 + layout.scalar.wordCount, offset + layout.scalar.recordWords));
  const exponent = input[offset + 2] | 0;
  if (input[offset + 1] || !d) throw Error('Invalid output scalar');
  return fraction(exponent >= 0 ? n << BigInt(exponent) : n, exponent < 0 ? d << BigInt(-exponent) : d);
};

export async function runPhaseQuantityFormatNative(device, options) {
  const format = createSphExactMassFormat(options);
  const initial = sphExactPlacementQuantityLayout(format, { particleCount: 4, eventCapacity: 1 });
  const layout = Object.freeze({ ...initial, rowCount: 4, wordLength: initial.recordWords * 4 });
  const unit = 1n << BigInt(-format.quantumExponent), coefficients = [unit + 37n, 2n * unit + 11n, 0n, 0n];
  const masses = coefficients.map(m => fraction(m, unit));
  const velocities = [[fraction(2n), fraction(-1n), fraction(1n, 2n)], [fraction(-1n, 4n), fraction(1n, 2n), fraction(-1n)],
    [zero(), zero(), zero()], [zero(), zero(), zero()]];
  const source = new Uint32Array(layout.wordLength), massWords = new Uint32Array(coefficients.flatMap(m => words(m, format.wordCount)));
  const thermo = new Float32Array(48), geometry = new Uint32Array(32);
  const sourceValues = [];
  for (let row = 0; row < 4; row++) {
    const p = velocities[row].map(v => mul(masses[row], v));
    const kineticSpecific = div(velocities[row].map(v => mul(v, v)).reduce(add, zero()), fraction(2n));
    const e = mul(masses[row], add(fraction(row === 0 ? 250n : 300n), kineticSpecific));
    const referenceVolume = div(masses[row], fraction(1000n));
    const values = [...p, e, referenceVolume, mul(referenceVolume, fraction(11n, 10n)), masses[row]];
    sourceValues.push(values);
    const at = row * layout.recordWords;
    source.set([1, 0, 1, row + 1, f32bits(.018), 1, row, 0, 0, format.wordCount, layout.scalar.wordCount, Number(coefficients[row] > 0n)], at);
    source.set(words(coefficients[row], format.wordCount), at + 16);
    values.forEach((v, field) => source.set(packedScalar(v, layout), at + layout.scalarOffsetWords + field * layout.scalar.recordWords));
    thermo[row * 12] = 1;
    thermo.set(row === 0 ? [.25, .75, 0, 0] : [0, 1, 0, 0], row * 12 + 4);
    geometry.set([f32bits(100), f32bits(300), 0, 0, row === 0 ? 0 : 1, row === 0 ? 0 : 1, f32bits(1000), 0], row * 8);
  }
  const result = [];
  for (const mode of ['split-merge', 'unreduced-source', 'unreduced-dyadic', 'invalid-source-denominator',
    'invalid-source-reserved', 'invalid-endpoint', 'invalid-density']) {
    const owned = [], allocate = desc => { const b = tagWebGpuBufferDevice(device.createBuffer(desc), device); owned.push(b); return b; };
    const upload = (label, value) => { const b = allocate({ label, size: value.byteLength, usage: 128 | 8 | 4 }); device.queue.writeBuffer(b, 0, value); return b; };
    const metadata = geometry.slice();
    const input = source.slice(), scalarAt = layout.scalarOffsetWords, n = layout.scalar.wordCount;
    if (mode === 'unreduced-source' || mode === 'unreduced-dyadic') {
      for (const at of [scalarAt + 4, scalarAt + 4 + n]) {
        input.set(words(integer(input.slice(at, at + n)) * (mode === 'unreduced-dyadic' ? 8n : 3n), n), at);
      }
    }
    if (mode === 'invalid-source-denominator') input.fill(0, scalarAt + 4 + n, scalarAt + 4 + 2 * n);
    if (mode === 'invalid-source-reserved') input[scalarAt + 3] = 1;
    const accepted = ['split-merge', 'unreduced-source', 'unreduced-dyadic'].includes(mode);
    if (mode === 'invalid-endpoint') metadata[0] = f32bits(Infinity);
    if (mode === 'invalid-density') metadata[6] = 0;
    try {
      const sourceMassBuffer = upload('phase-fixture-mass', massWords), sourceThermoBuffer = upload('phase-fixture-thermo', thermo);
      const sourceQuantityBuffer = upload('phase-fixture-quantities', input), geometryBuffer = upload('phase-fixture-geometry', metadata);
      const mass = await prepareSphExactPhaseCarrierMass({ device, format, lineageCapacity: 1,
        sourceMassBuffer, sourceThermoBuffer, allocate, validate() {} });
      const quantity = await prepareSphExactPhaseCarrierQuantities({ device, format, layout, sourceQuantityBuffer,
        packetMassBuffer: mass.packetMassBuffer, candidateMassBuffer: mass.massBuffer,
        geometryBuffer, validationBuffer: mass.validationBuffer, lineageCapacity: 1, allocate, validate() {} });
      const outputs = [quantity.quantityBuffer, quantity.projectionBuffer, mass.validationBuffer];
      const readers = outputs.map(b => allocate({ size: b.size, usage: 1 | 8 }));
      const encoder = device.createCommandEncoder(); mass.encode(encoder); quantity.encode(encoder); quantity.commit(encoder);
      outputs.forEach((b, i) => encoder.copyBufferToBuffer(b, 0, readers[i], 0, b.size));
      device.queue.submit([encoder.finish()]);
      const observed = await Promise.all(readers.map(async b => { await b.mapAsync(1); const x = new Uint32Array(b.getMappedRange().slice(0)); b.unmap(); return x; }));
      const checks = {};
      if (!accepted) {
        checks.rejected = observed[2][0] !== 0;
        checks.originalQuantitiesRetained = observed[0].every((word, i) => word === input[i]);
      } else {
        const child = coefficients[0] / 4n, expectedCoefficients = [child, coefficients[0] - child + coefficients[1], 0n, 0n];
        const firstMass = fraction(child, unit), firstP = velocities[0].map(v => mul(firstMass, v));
        const k = div(velocities[0].map(v => mul(v, v)).reduce(add, zero()), fraction(2n));
        const firstE = mul(firstMass, add(fraction(100n), k));
        const first = [...firstP, firstE], second = first.map((v, i) => sub(add(sourceValues[0][i], sourceValues[1][i]), v));
        const expected = [first, second, [zero(), zero(), zero(), zero()], [zero(), zero(), zero(), zero()]];
        checks.accepted = observed[2][0] === 0;
        checks.mass = expectedCoefficients.every((coefficient, row) => integer(observed[0].slice(row * layout.recordWords + 16,
          row * layout.recordWords + 16 + format.wordCount)) === coefficient);
        checks.extensives = expected.every((values, row) => values.every((v, field) => equal(unpackScalar(observed[0], layout, row, field), v)));
        checks.totalMomentumEnergy = [0, 1, 2, 3].every(field => equal(
          [0, 1, 2, 3].map(row => unpackScalar(observed[0], layout, row, field)).reduce(add, zero()),
          sourceValues.map(values => values[field]).reduce(add, zero())));
        checks.volumes = expectedCoefficients.every((coefficient, row) => {
          const massValue = fraction(coefficient, unit), v0 = div(massValue, fraction(1000n));
          return equal(unpackScalar(observed[0], layout, row, 4), v0)
            && equal(unpackScalar(observed[0], layout, row, 5), mul(v0, row === 0 ? fraction(1n) : fraction(11n, 10n)))
            && equal(unpackScalar(observed[0], layout, row, 6), massValue);
        });
        checks.projections = [0, 1].every(row => {
          const m = fraction(expectedCoefficients[row], unit), p = expected[row].slice(0, 3);
          const e = expected[row][3], kinetic = div(p.map(v => mul(v, v)).reduce(add, zero()), mul(fraction(2n), m));
          const v0 = div(m, fraction(1000n)), j = row === 0 ? fraction(1n) : fraction(11n, 10n);
          const values = [m, ...p.map(v => div(v, m)), div(sub(e, kinetic), m), v0, mul(v0, j), j];
          return values.every((v, field) => observed[1][row * 8 + field] === referenceRationalQuantityProjection({ numerator: v.n < 0n ? -v.n : v.n,
            denominator: v.d, negative: Number(v.n < 0n), exponent: 0 }).bits);
        });
      }
      result.push({ name: mode, checks, matches: Object.values(checks).every(Boolean), errors: observed[2][0], massConserved: accepted ? checks.mass : checks.originalQuantitiesRetained });
    } finally { await device.queue.onSubmittedWorkDone(); owned.forEach(b => b.destroy()); }
  }
  return result;
}
