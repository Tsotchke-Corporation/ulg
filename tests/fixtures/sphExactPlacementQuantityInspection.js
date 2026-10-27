import { referenceDyadic53Packet, dyadic53PacketWithinBound } from './sphTransferPacketReference.js';

// Independent BigInt fractions over the actual captured source and packet
// words. This never evaluates production rational helpers or f32 arithmetic.
const integer = words => [...words].reverse().reduce((n, word) => (n << 32n) | BigInt(word), 0n);
const abs = n => n < 0n ? -n : n;
const gcd = (a, b) => { while (b) [a, b] = [b, a % b]; return a; };

// Exact rounding-cell test, including ties to even, without converting a
// large rational numerator/denominator through Number.
function projects(value, bits) {
  const sub = (a, b) => add(a, { ...b, n: -b.n });
  const magnitude = bits & 0x7fffffff;
  if (magnitude >= 0x7f800000 || (value.n !== 0n && (value.n < 0n) !== Boolean(bits >>> 31))) return false;
  value = { ...value, n: abs(value.n) };
  if (!magnitude) return sub(multiply(scalar(1), rational(1n, 1n, -1)), value).n >= 0n;
  const here = scalar(magnitude), previous = scalar(magnitude - 1);
  const next = magnitude === 0x7f7fffff ? add(here, sub(here, previous)) : scalar(magnitude + 1);
  const low = sub(value, multiply(add(previous, here), rational(1n, 1n, -1)));
  const high = sub(multiply(add(here, next), rational(1n, 1n, -1)), value);
  return low.n >= 0n && high.n >= 0n && (!(magnitude & 1) || (low.n !== 0n && high.n !== 0n));
}

// Independent pair oracle: derive the transfer directly from the captured
// donor M/P/E and signed proposal, never from the production instruction DAG.
export function inspectExactVaporAerosolPair({ gasWords, liquidWords, outputWords, layout, format, edge, surfaceValues }) {
  const failures = [], check = (value, label) => { if (!value) failures.push(label); };
  const sub = (a, b) => add(a, { ...b, n: -b.n });
  const same = (a, b) => sub(a, b).n === 0n;
  const number = value => scalar(new Uint32Array(new Float32Array([value]).buffer)[0]);
  const load = (words, base = 0) => {
    const m = rational(integer(words.slice(base + layout.massOffsetWords, base + layout.massOffsetWords + format.wordCount)), 1n, format.quantumExponent);
    const fields = Array.from({ length: 7 }, (_, field) => {
      const at = base + layout.scalarOffsetWords + field * layout.scalar.recordWords, r = layout.scalar.wordCount;
      check(words[at + 1] === 0 && words[at + 3] === 0, `valid scalar ${base}:${field}`);
      return rational((words[at] ? -1n : 1n) * integer(words.slice(at + 4, at + 4 + r)),
        integer(words.slice(at + 4 + r, at + 4 + 2 * r)), words[at + 2] | 0);
    });
    return [m, ...fields];
  };
  const gas = load(gasWords), liquid = load(liquidWords), outGas = load(outputWords), outLiquid = load(outputWords, layout.recordWords);
  const dm = number(edge.deltaMassKg), donor = dm.n < 0n ? liquid : gas, fraction = divide(dm, donor[0]);
  const heat = add(add(number(edge.transportEnthalpyCorrectionJ), number(edge.conductiveHeatJ)), number(edge.pressureWorkIntoLiquidJ));
  const oldSurface = number(surfaceValues[1]), newSurface = number(surfaceValues[3]);
  const transfer = add(multiply(fraction, donor[4]), heat);
  check(same(outGas[0], sub(gas[0], dm)), 'gas exact debit');
  check(same(outLiquid[0], add(liquid[0], dm)), 'liquid exact credit');
  check(same(add(outGas[0], outLiquid[0]), add(gas[0], liquid[0])), 'mass conservation');
  for (let axis = 1; axis <= 3; axis++) {
    const moved = multiply(fraction, donor[axis]);
    check(same(outGas[axis], sub(gas[axis], moved)), `gas momentum ${axis}`);
    check(same(outLiquid[axis], add(liquid[axis], moved)), `liquid momentum ${axis}`);
    check(same(add(outGas[axis], outLiquid[axis]), add(gas[axis], liquid[axis])), `momentum conservation ${axis}`);
  }
  check(same(outGas[4], sub(gas[4], transfer)), 'gas energy debit');
  check(same(outLiquid[4], sub(add(liquid[4], transfer), sub(newSurface, oldSurface))), 'liquid energy credit');
  check(same(add(add(outGas[4], outLiquid[4]), newSurface), add(add(gas[4], liquid[4]), oldSurface)), 'bulk kinetic surface conservation');
  for (let field = 5; field <= 7; field++) {
    check(same(outGas[field], multiply(gas[field], divide(outGas[0], gas[0]))), `gas geometry ${field}`);
    check(same(outLiquid[field], multiply(liquid[field], divide(outLiquid[0], liquid[0]))), `liquid geometry ${field}`);
  }
  return { pass: failures.length === 0, failures, deltaMass: serial(dm), gasMassBefore: serial(gas[0]),
    gasMassAfter: serial(outGas[0]), liquidMassBefore: serial(liquid[0]), liquidMassAfter: serial(outLiquid[0]) };
}
function rational(n, d = 1n, e = 0) {
  if (d <= 0n) throw new Error('Oracle requires positive denominator');
  if (!n) return { n: 0n, d: 1n, e: 0 };
  const common = gcd(abs(n), d); n /= common; d /= common;
  while (!(n & 1n)) { n /= 2n; e++; }
  while (!(d & 1n)) { d /= 2n; e--; }
  return { n, d, e };
}
const multiply = (a, b) => rational(a.n * b.n, a.d * b.d, a.e + b.e);
const divide = (a, b) => {
  if (!b.n) throw new Error('Oracle zero divisor');
  return rational(a.n * b.d * (b.n < 0n ? -1n : 1n), a.d * abs(b.n), a.e - b.e);
};
const add = (a, b) => {
  const e = Math.min(a.e, b.e);
  return rational((a.n << BigInt(a.e - e)) * b.d + (b.n << BigInt(b.e - e)) * a.d, a.d * b.d, e);
};
function scalar(bits) {
  const exponent = (bits >>> 23) & 255;
  if (exponent === 255) throw new Error('Nonfinite captured quantity');
  return rational(BigInt((bits & 0x7fffff) | (exponent ? 0x800000 : 0)) * (bits >>> 31 ? -1n : 1n),
    1n, exponent ? exponent - 150 : -149);
}
const zero = () => rational(0n);
const serial = value => ({ numerator: String(value.n), denominator: String(value.d), exponent: value.e });

// Independent graph oracle over captured original inventories. Each packet
// comes from the original donor; final endpoint energies include the surface
// change once. No production topology, instruction schedule or sums are used.
export function inspectExactVaporAerosolGraph({ gasSources, liquidWords, outputWords,
  layout, format, edges, surfaceValues, projectionWords, cellPressure = null, dtSeconds = null,
  intervalScaleExponent = 0, donorWords = null, originalCellPressure = cellPressure,
  transportPacketMode = 'exact-rational' }) {
  const failures = [], check = (ok, label) => { if (!ok) failures.push(label); };
  if (!['exact-rational', 'rounded-dyadic-53'].includes(transportPacketMode)) throw new Error('Unknown oracle packet mode');
  let roundedPacketCount = 0;
  const numericalPacket = value => {
    if (transportPacketMode === 'exact-rational') return value;
    const rounded = referenceDyadic53Packet(value);
    check(dyadic53PacketWithinBound(value, rounded), `packet rounding bound ${roundedPacketCount++}`);
    return rounded;
  };
  const sub = (a, b) => add(a, { ...b, n: -b.n }), same = (a, b) => sub(a, b).n === 0n;
  const number = value => scalar(new Uint32Array(new Float32Array([value]).buffer)[0]);
  const intervalBits = new DataView(new ArrayBuffer(8)); intervalBits.setFloat64(0, dtSeconds ?? 1, true);
  const lo = BigInt(intervalBits.getUint32(0, true)), hi = intervalBits.getUint32(4, true), exponent = (hi >>> 20) & 2047;
  const interval = rational((BigInt((hi & 0xfffff) | (exponent ? 0x100000 : 0)) << 32n) | lo,
    1n, (exponent ? exponent - 1075 : -1074) + intervalScaleExponent);
  const packetNumber = value => multiply(number(value), interval);
  const load = (words, base = 0) => [rational(integer(words.slice(base + layout.massOffsetWords,
    base + layout.massOffsetWords + format.wordCount)), 1n, format.quantumExponent),
  ...Array.from({ length: 7 }, (_, field) => {
    const at = base + layout.scalarOffsetWords + field * layout.scalar.recordWords, r = layout.scalar.wordCount;
    check(words[at + 1] === 0 && words[at + 3] === 0, `valid scalar ${base}:${field}`);
    return rational((words[at] ? -1n : 1n) * integer(words.slice(at + 4, at + 4 + r)),
      integer(words.slice(at + 4 + r, at + 4 + 2 * r)), words[at + 2] | 0);
  })];
  const original = new Map(), expected = new Map(), actual = new Map(), writers = new Map();
  const stage = new Map();
  const keys = edge => [`g:${edge.gasKind}:${edge.gasIndex}`, `a:${edge.parcelIndex}`];
  for (const edge of edges) {
    const [gas, liquid] = keys(edge);
    if (!original.has(gas)) original.set(gas, load(gasSources[gas]));
    if (!original.has(liquid)) original.set(liquid, load(liquidWords, edge.parcelIndex * layout.recordWords));
  }
  for (const [key, values] of original) { expected.set(key, [...values]); writers.set(key, 0); }
  edges.forEach((edge, index) => keys(edge).forEach((key, endpoint) => {
    stage.set(key, donorWords ? load(donorWords, (index * 2 + endpoint) * layout.recordWords) : original.get(key));
  }));
  for (const edge of edges) {
    const [gas, liquid] = keys(edge), dm = packetNumber(edge.deltaMassKg);
    const donor = stage.get(dm.n < 0n ? liquid : gas), fraction = divide(dm, donor[0]);
    const packet = [dm, ...[1, 2, 3].map(axis => numericalPacket(multiply(fraction, donor[axis]))),
      numericalPacket([multiply(fraction, donor[4]), ...['transportEnthalpyCorrectionJ', 'conductiveHeatJ',
        'pressureWorkIntoLiquidJ'].map(name => packetNumber(edge[name]))].reduce(add))];
    for (let field = 0; field < 5; field++) {
      expected.get(gas)[field] = sub(expected.get(gas)[field], packet[field]);
      expected.get(liquid)[field] = add(expected.get(liquid)[field], packet[field]);
    }
  }
  const pressurePairs = new Set();
  const volumeChanges = new Map();
  if (cellPressure) for (const [index, edge] of edges.entries()) {
    const [gas, liquid] = keys(edge), pair = `${gas}/${liquid}`;
    if (pressurePairs.has(pair)) continue;
    pressurePairs.add(pair);
    const inputs = cellPressure.gases[gas];
    const dV = multiply(divide(sub(expected.get(liquid)[0], original.get(liquid)[0]), number(cellPressure.liquidDensity)),
      number(cellPressure.weights[index]));
    const pressure = divide(multiply(multiply(stage.get(gas)[0], number(inputs.temperature)),
      number(8.31446261815324)), multiply(number(inputs.molarMass), number(inputs.freeVolume)));
    const work = numericalPacket(multiply(pressure, dV));
    volumeChanges.set(gas, add(volumeChanges.get(gas) ?? zero(), dV));
    expected.get(gas)[4] = add(expected.get(gas)[4], work);
    expected.get(liquid)[4] = sub(expected.get(liquid)[4], work);
  }
  if (cellPressure) for (const [index, edge] of edges.entries()) {
    const [gas] = keys(edge);
    const remaining = sub(number(originalCellPressure.gases[gas].freeVolume), volumeChanges.get(gas));
    check(projects(remaining, projectionWords[index * 32 + 27]), `${gas}:remaining free volume`);
  }
  let oldSurface = zero(), newSurface = zero();
  for (const [key, values] of expected) {
    const before = original.get(key);
    for (let field = 5; field < 8; field++) values[field] = multiply(before[field], divide(values[0], before[0]));
    if (key.startsWith('a:')) {
      const parcel = Number(key.slice(2)), old = number(surfaceValues[parcel * 4 + 1]), next = number(surfaceValues[parcel * 4 + 3]);
      values[4] = sub(values[4], sub(next, old)); oldSurface = add(oldSurface, old); newSurface = add(newSurface, next);
    }
  }
  edges.forEach((edge, index) => keys(edge).forEach((key, endpoint) => {
    const values = load(outputWords, (index * 2 + endpoint) * layout.recordWords);
    values.forEach((value, field) => check(same(value, expected.get(key)[field]), `${key}:edge${index}:field${field}`));
    const kinetic = divide(values.slice(1, 4).map(v => multiply(v, v)).reduce(add), multiply(values[0], rational(2n)));
    const projectedValues = [values[0], ...values.slice(1, 4).map(v => divide(v, values[0])),
      divide(sub(values[4], kinetic), values[0]), ...values.slice(5)];
    const lanes = [endpoint, 2 + endpoint * 3, 3 + endpoint * 3, 4 + endpoint * 3,
      8 + endpoint, 10 + endpoint * 3, 11 + endpoint * 3, 12 + endpoint * 3];
    projectedValues.forEach((v, i) => check(projects(v, projectionWords[index * 32 + lanes[i]]), `${key}:view${lanes[i]}`));
    actual.set(key, values);
    if (projectionWords[index * 32 + 19 + endpoint] === index) writers.set(key, writers.get(key) + 1);
  }));
  for (const [key, count] of writers) check(count === 1, `${key}:one writer`);
  for (let field = 0; field < 5; field++) {
    const before = [...original.values()].map(values => values[field]).reduce(add);
    const after = [...actual.values()].map(values => values[field]).reduce(add);
    check(same(field === 4 ? add(before, oldSurface) : before, field === 4 ? add(after, newSurface) : after), `conserved field${field}`);
  }
  const changedGasEnergies = [...actual].filter(([key, values]) => key.startsWith('g:') && !same(values[4], original.get(key)[4])).map(([key]) => key);
  return { pass: failures.length === 0, failures, endpointCount: actual.size, edgeCount: edges.length,
    changedGasEnergies, pressurePairCount: pressurePairs.size, transportPacketMode, roundedPacketCount };
}

// Independent raw-word comparison against the original GPU producer's
// templates. Compacted companion identities, not compact row numbers, select
// the original product. Placement supplies only the routed position.
export function inspectExactResidualPhysical({ physical, templates, outputLayout, events, companions,
  companionStrideWords, count, terminalStatus }) {
  const failures = [], check = (ok, label) => { if (!ok) failures.push(label); };
  check(count[1] === 0 && count[0] <= outputLayout.denseEventCount, 'residual count');
  check(physical.length === outputLayout.denseEventCount * 52, 'physical extent');
  const live = terminalStatus === 1 ? count[0] : 0;
  check(terminalStatus === 1 || count[0] === 0, 'rollback has no residuals');
  for (let row = 0; row < live; row++) {
    const pair = companions[row * companionStrideWords], ordinal = companions[row * companionStrideWords + 2];
    check(pair < outputLayout.particleCount && ordinal >= 2 && ordinal < outputLayout.productCapacity + 2,
      `row${row}:template identity`);
    const source = outputLayout.eventParticleOffsetWords + (pair * outputLayout.productCapacity + ordinal - 2) * 64 + 12;
    for (let word = 0; word < 52; word++) {
      const expected = word < 3 ? events[row * 32 + word] : templates[source + word];
      check(physical[row * 52 + word] === expected, `row${row}:physical${word}`);
    }
  }
  check(physical.slice(live * 52).every(word => word === 0), 'physical tail cleared');
  return { matches: failures.length === 0, rows: live, fieldsPerRow: 52, failures };
}

export function inspectExactHistoryP2gProjection({ source, layout, count, projected, validation, gasViews = false }) {
  const failures = [], rows = [], check = (ok, label) => { if (!ok) failures.push(label); };
  const sub = (a, b) => add(a, { ...b, n: -b.n });
  check(validation[0] === 0 && validation[1] === 0x48503247, 'history projection accepted');
  check(count[2] === 1 && count[3] <= count[4] && count[11] === 0, 'original history count ready');
  for (let row = 0; row < count[3]; row++) {
    const at = row * layout.rowWords, q = at + layout.quantityOffsetWords, n = layout.massWordCount, r = layout.rationalWordCount;
    const mass = rational(integer(source.slice(q + 16, q + 16 + n)), 1n, layout.format.quantumExponent);
    const values = Array.from({ length: 7 }, (_, field) => {
      const s = q + 16 + n + field * layout.scalarWords;
      return rational(integer(source.slice(s + 4, s + 4 + r)) * (source[s] ? -1n : 1n),
        integer(source.slice(s + 4 + r, s + 4 + 2 * r)), source[s + 2] | 0);
    });
    const kinetic = divide(values.slice(0, 3).map(v => multiply(v, v)).reduce(add), multiply(mass, rational(2n)));
    const density = divide(mass, values[4]), internal = divide(sub(values[3], kinetic), mass);
    const expected = gasViews ? [mass, mass, divide(mass, scalar(source[q + 4])), density, internal, values[5],
      ...values.slice(0, 3).map(p => divide(p, mass)), zero()] : [mass, ...values.slice(0, 3), values[5], density, internal,
      mass, ...values.slice(0, 3).map(p => divide(p, mass)), internal, density,
      divide(values[5], values[4]), values[4], values[6]];
    const offsets = gasViews ? [3, 13, 9, 17, 19, 23, 20, 21, 22, 12] : [13, 20, 21, 22, 23, 17, 19, 35, 36, 37, 38, 39, 43, 70, 71, 83];
    const stride = gasViews ? 32 : 84;
    expected.forEach((v, field) => check(projects(v, projected[row * stride + offsets[field]]), `row${row}:projection${offsets[field]}`));
    for (let word = 0; word < 32; word++) if (!offsets.includes(word)) {
      check(source[at + word] === projected[row * stride + word], `row${row}:event${word}`);
    }
    for (let word = 0; !gasViews && word < 52; word++) if (!offsets.includes(word + 32)) {
      check(source[at + layout.physicalOffsetWords + word] === projected[row * 84 + 32 + word], `row${row}:physical${word}`);
    }
    rows.push({ row, expected: expected.map(serial) });
  }
  check(projected.slice(count[3] * (gasViews ? 32 : 84)).every(word => word === 0), 'inactive projection tail clear');
  return { matches: failures.length === 0, failures, rows };
}

// Independent retained-source reaction oracle. It uses the actual debits and
// material-table constants, never the production arithmetic instruction list.
export function inspectExactCarriedReaction({ source, sourceState, layout, packet, selected, compiled, energyEntries }) {
  const failures = [], check = (ok, label) => { if (!ok) failures.push(label); };
  const same = (a, b) => a.n === b.n && a.d === b.d && a.e === b.e;
  const sub = (a, b) => add(a, { ...b, n: -b.n });
  const bits = value => new Uint32Array(new Float32Array([value]).buffer)[0];
  const load = (words, at) => rational(integer(words.slice(at + 4, at + 4 + layout.scalar.wordCount))
    * (words[at] ? -1n : 1n), integer(words.slice(at + 4 + layout.scalar.wordCount, at + layout.scalar.recordWords)), words[at + 2] | 0);
  const n = selected.format.wordCount, q = selected.format.quantumExponent, rows = [];
  const mass = (words, at) => rational(integer(words.slice(at, at + n)), 1n, q);
  const kinetic = (p, m) => divide(p.map(v => multiply(v, v)).reduce(add), multiply(m, rational(2n)));
  check(selected.extensiveEncoding === 'rational', 'rational packet encoding');
  for (let row = 0; row < selected.particleCount; row++) {
    const out = row * selected.recordWords;
    if (packet[out] !== 1) continue;
    const rx = packet[out + 4], token = compiled[rx], entry = energyEntries[rx];
    const species = out + selected.speciesOffsetWords;
    check(packet[species] === 1 && packet[species + 1] === 0, `species ready:${row}:${packet[species + 1]}`);
    const a = packet[out + 2], b = packet[out + 3];
    const original = [a, b].map(index => ({ mass: mass(source, index * layout.recordWords + layout.massOffsetWords),
      values: Array.from({ length: 7 }, (_, field) => load(source, index * layout.recordWords + layout.scalarOffsetWords + field * layout.scalar.recordWords)) }));
    const debit = [mass(packet, out + 12 + n), mass(packet, out + 12 + 2 * n)], total = add(...debit);
    const fractions = debit.map((m, side) => divide(m, original[side].mass));
    const consumed = Array.from({ length: 4 }, (_, field) => original.map((v, side) => multiply(v.values[field], fractions[side])).reduce(add));
    const sourceK = original.map((v, side) => multiply(kinetic(v.values.slice(0, 3), v.mass), fractions[side])).reduce(add);
    const reference = debit.map((m, side) => multiply(m, scalar(bits(entry.reactants[side].uRef)))).reduce(add);
    const sensible = sub(consumed[3], reference), comK = kinetic(consumed.slice(0, 3), total);
    const scale = rational(token.reactantWeightSum * token.reactantWeightScale.coefficient, 1n, token.reactantWeightScale.exponent);
    const formation = multiply(divide(total, scale), scalar(bits(entry.deltaPhysical)));
    const target = sub(sub(sensible, comK), formation);
    const ext = out + selected.extensiveOffsetWords, cal = out + selected.caloricOffsetWords;
    if (packet[out + 9] !== 1 || packet[out + 10] !== 0) {
      check(false, `source/caloric ready:${row}`);
      rows.push({ row, header: [...packet.slice(out, out + 12)], caloricHeader: [...packet.slice(cal, cal + 16)] });
      continue;
    }
    const velocity = [0, 1, 2].map(axis => scalar(packet[ext + axis]));
    const projectedK = multiply(total, divide(velocity.map(v => multiply(v, v)).reduce(add), rational(2n)));
    const expected = [...consumed.slice(0, 3), sub(consumed[3], sourceK), sourceK, reference, sensible,
      ...velocity.map((v, axis) => sub(consumed[axis], multiply(total, v))), projectedK, sub(sensible, projectedK)];
    expected.forEach((v, field) => {
      const at = ext + 4 + field * layout.scalar.recordWords;
      check(packet[at + 1] === 0 && same(v, load(packet, at)), `extensive:${row}:${field}`);
    });
    const ec = selected.caloricWordCount, ecAt = field => cal + 16 + field * (ec + 2);
    const denominator = integer(packet.slice(ecAt(1) + 2, ecAt(1) + 2 + ec));
    const calValue = field => rational(integer(packet.slice(ecAt(field) + 2, ecAt(field) + 2 + ec))
      * (packet[ecAt(field)] ? -1n : 1n), denominator, q - 299 - packet[cal + 6]);
    check(same(target, calValue(0)), `caloric target:${row}`);
    if (packet[cal] !== 1 || packet[cal + 1] !== 0) {
      check(false, `caloric ready:${row}`);
      rows.push({ row, target: serial(target), actualTarget: serial(calValue(0)),
        caloricHeader: [...packet.slice(cal, cal + 16)], domain: [entry.tMin, entry.tMax],
        sourceInternalSpecific: original.map(v => serial(divide(sub(v.values[3], kinetic(v.values.slice(0, 3), v.mass)), v.mass))),
        productStates: [...packet.slice(cal + selected.caloricProductOffsetWords, cal + selected.caloricRecordWords)] });
      continue;
    }
    let internal = zero(), productSensible = zero(), productReference = zero();
    for (let term = 0; term < packet[out + 5]; term++) {
      const m = mass(packet, out + 12 + 7 * n + term * (4 + 3 * n) + 4);
      const state = cal + selected.caloricProductOffsetWords + (2 * selected.caloricProductCapacity + term) * 8;
      const u = scalar(packet[state + 4]), ref = scalar(packet[state + 6]);
      internal = add(internal, multiply(m, u)); productSensible = add(productSensible, multiply(m, sub(u, ref)));
      productReference = add(productReference, multiply(m, ref));
    }
    const caloricResidual = sub(target, productSensible), correction = sub(comK, projectedK);
    check(same(caloricResidual, calValue(4)), `chosen caloric residual:${row}`);
    const residual = add(caloricResidual, correction), productTotal = add(add(internal, projectedK), residual);
    const energy = out + selected.productEnergyOffsetWords;
    check(packet[energy] === 1 && packet[energy + 1] === 0, `product energy ready:${row}`);
    [correction, residual, productTotal].forEach((v, field) => {
      const at = energy + 8 + field * layout.scalar.recordWords;
      check(packet[at + 1] === 0 && same(v, load(packet, at)), `product energy:${row}:${field}`);
    });
    check(same(productTotal, sub(add(consumed[3], sub(productReference, reference)), formation)), `formation balance:${row}`);
    rows.push({ row, a, b, target: serial(target), productTotal: serial(productTotal),
      nonDyadicInputs: original.some(v => v.values.slice(0, 4).some(x => x.d !== 1n)),
      roundedReseedWouldLoseEnergy: sourceState ? original.some((v, side) => {
        const at = [a, b][side] * 8 + 4, velocities = [0, 1, 2].map(axis => scalar(sourceState[at + axis]));
        const projectedK = divide(velocities.map(x => multiply(x, x)).reduce(add), rational(2n));
        return !same(v.values[3], multiply(v.mass, add(scalar(sourceState[at + 3]), projectedK)));
      }) : null });
  }
  check(rows.length > 0, 'at least one actual repeated reaction');
  return { matches: failures.length === 0, failures, rows };
}

export function inspectExactG2pQuantities({ before, after, sourceState, sourceMechanics,
  state, mechanics, increments, layout, format, validation }) {
  const failures = [], check = (ok, label) => { if (!ok) failures.push(label); };
  const same = (a, b) => a.n === b.n && a.d === b.d && a.e === b.e;
  const sub = (a, b) => add(a, { ...b, n: -b.n });
  const load = (words, at) => {
    const n = layout.scalar.wordCount;
    return rational(integer(words.slice(at + 4, at + 4 + n)) * (words[at] ? -1n : 1n),
      integer(words.slice(at + 4 + n, at + 4 + 2 * n)), words[at + 2] | 0);
  };
  const projects = (v, bits) => {
    const magnitude = bits & 0x7fffffff;
    if (magnitude >= 0x7f800000 || (v.n !== 0n && (v.n < 0n) !== Boolean(bits >>> 31))) return false;
    v = { ...v, n: abs(v.n) };
    if (!magnitude) return sub(multiply(scalar(1), rational(1n, 1n, -1)), v).n >= 0n;
    const here = scalar(magnitude), previous = scalar(magnitude - 1);
    const next = magnitude === 0x7f7fffff ? add(here, sub(here, previous)) : scalar(magnitude + 1);
    const low = multiply(add(previous, here), rational(1n, 1n, -1));
    const high = multiply(add(here, next), rational(1n, 1n, -1));
    return sub(v, low).n >= 0n && sub(high, v).n >= 0n
      && (!(magnitude & 1) || (!same(v, low) && !same(v, high)));
  };
  check(validation.every(word => word === 0), 'accepted quantity arithmetic');
  check(before.length === after.length, 'complete carrier storage');
  let activeRows = 0, changedMomentumRows = 0, changedEnergyRows = 0, changedVolumeRows = 0;
  for (let row = 0; row < layout.rowCount; row++) {
    const at = row * layout.recordWords;
    const units = integer(before.slice(at + layout.massOffsetWords, at + layout.massOffsetWords + format.wordCount));
    const offset = field => at + layout.scalarOffsetWords + field * layout.scalar.recordWords;
    if (!units) { check(before.slice(at, at + layout.recordWords).every((word, i) => word === after[at + i]), `zero row:${row}`); continue; }
    activeRows++;
    for (let i = 0; i < layout.scalarOffsetWords; i++) check(before[at + i] === after[at + i], `identity/mass:${row}:${i}`);
    const mass = rational(units, 1n, format.quantumExponent), old = Array.from({ length: 7 }, (_, field) => load(before, offset(field)));
    const momentum = [0, 1, 2].map(axis => add(old[axis], multiply(mass,
      sub(scalar(increments[row * 12 + 6 + axis]), scalar(sourceState[row * 8 + 4 + axis])))));
    const kinetic = values => divide(values.map(v => multiply(v, v)).reduce(add), multiply(mass, rational(2n)));
    const nextKinetic = kinetic(momentum);
    const energy = add(add(old[3], multiply(mass,
      sub(scalar(increments[row * 12 + 9]), scalar(sourceState[row * 8 + 7])))), sub(nextKinetic, kinetic(old.slice(0, 3))));
    const restRatio = divide(scalar(increments[row * 12 + 10]), scalar(sourceMechanics[row * 32 + 19]));
    const rest = multiply(old[4], restRatio);
    const volume = multiply(multiply(old[5], restRatio), divide(scalar(increments[row * 12 + 11]), scalar(sourceMechanics[row * 32 + 18])));
    const expected = [...momentum, energy, rest, volume, old[6]];
    expected.forEach((v, field) => {
      check(after[offset(field) + 1] === 0, `scalar status:${row}:${field}`);
      check(same(v, load(after, offset(field))), `exact update:${row}:${layout.fields[field]}`);
    });
    if (momentum.some((v, axis) => !same(v, old[axis]))) changedMomentumRows++;
    if (!same(energy, old[3])) changedEnergyRows++;
    if (!same(volume, old[5])) changedVolumeRows++;
    const views = [...momentum.map(p => divide(p, mass)), divide(sub(energy, nextKinetic), mass), rest, divide(volume, rest)];
    const bits = [...state.slice(row * 8 + 4, row * 8 + 8), mechanics[row * 32 + 19], mechanics[row * 32 + 18]];
    views.forEach((v, field) => check(projects(v, bits[field]), `projection:${row}:${field}`));
  }
  return { matches: failures.length === 0, failures, activeRows, changedMomentumRows, changedEnergyRows, changedVolumeRows };
}

export function inspectExactPublishedQuantities({ before, after, state, thermo, mechanics, layout, format }) {
  const failures = [], check = (ok, label) => { if (!ok) failures.push(label); };
  const sub = (a, b) => add(a, { ...b, n: -b.n });
  const same = (a, b) => a.n === b.n && a.d === b.d && a.e === b.e;
  const load = (words, at) => {
    const n = layout.scalar.wordCount;
    return rational(integer(words.slice(at + 4, at + 4 + n)) * (words[at] ? -1n : 1n),
      integer(words.slice(at + 4 + n, at + 4 + 2 * n)), words[at + 2] | 0);
  };
  const projects = (v, bits) => {
    const magnitude = bits & 0x7fffffff;
    if (magnitude >= 0x7f800000 || (v.n && (v.n < 0n) !== Boolean(bits >>> 31))) return false;
    v = { ...v, n: abs(v.n) };
    if (!magnitude) return sub(multiply(scalar(1), rational(1n, 1n, -1)), v).n >= 0n;
    const here = scalar(magnitude), previous = scalar(magnitude - 1);
    const next = magnitude === 0x7f7fffff ? add(here, sub(here, previous)) : scalar(magnitude + 1);
    const low = multiply(add(previous, here), rational(1n, 1n, -1)), high = multiply(add(here, next), rational(1n, 1n, -1));
    return sub(v, low).n >= 0n && sub(high, v).n >= 0n && (!(magnitude & 1) || (!same(v, low) && !same(v, high)));
  };
  let activeRows = 0, changedEnergyRows = 0;
  for (let row = 0; row < layout.rowCount; row++) {
    const at = row * layout.recordWords, offset = field => at + layout.scalarOffsetWords + field * layout.scalar.recordWords;
    const units = integer(after.slice(at + layout.massOffsetWords, at + layout.massOffsetWords + format.wordCount));
    check(units === integer(before.slice(at + layout.massOffsetWords, at + layout.massOffsetWords + format.wordCount)), `mass:${row}`);
    if (!units) continue;
    activeRows++;
    check(after[at] === 1 && after[at + 1] === 0, `ready:${row}`);
    const mass = rational(units, 1n, format.quantumExponent), q = Array.from({ length: 7 }, (_, field) => load(after, offset(field)));
    q.forEach((_, field) => check(after[offset(field) + 1] === 0, `scalar:${row}:${field}`));
    const kinetic = divide(q.slice(0, 3).map(p => multiply(p, p)).reduce(add), multiply(mass, rational(2n)));
    const views = [mass, ...q.slice(0, 3).map(p => divide(p, mass)), divide(sub(q[3], kinetic), mass), q[4], divide(q[5], q[4]), q[6]];
    const bits = [...state.slice(row * 8 + 3, row * 8 + 8), mechanics[row * 32 + 19], mechanics[row * 32 + 18], mechanics[row * 32 + 31]];
    views.forEach((v, field) => check(projects(v, bits[field]), `projection:${row}:${field}`));
    check(same(q[4], divide(mass, scalar(thermo[row * 12 + 3]))), `reference volume:${row}`);
    check(after[at + 3] === new Float32Array(thermo.buffer, thermo.byteOffset, thermo.length)[row * 12 + 1], `phase:${row}`);
    if (!same(q[3], load(before, offset(3)))) changedEnergyRows++;
  }
  return { matches: !failures.length, failures, activeRows, changedEnergyRows };
}

export function inspectExactThermalQuantities({ before, after, updates, validation, state, thermo, layout, format }) {
  const failures = [], check = (ok, label) => { if (!ok) failures.push(label); };
  const same = (a, b) => a.n === b.n && a.d === b.d && a.e === b.e;
  const sub = (a, b) => add(a, { ...b, n: -b.n });
  const load = (words, at) => {
    const n = layout.scalar.wordCount;
    return rational(integer(words.slice(at + 4, at + 4 + n)) * (words[at] ? -1n : 1n),
      integer(words.slice(at + 4 + n, at + 4 + 2 * n)), words[at + 2] | 0);
  };
  check(validation.every(word => word === 0), 'accepted thermal arithmetic');
  check(before.length === after.length, 'complete carrier storage');
  let activeRows = 0, changedEnergyRows = 0, subUlpEnergyRows = 0;
  for (let row = 0; row < layout.rowCount; row++) {
    const at = row * layout.recordWords, offset = field => at + layout.scalarOffsetWords + field * layout.scalar.recordWords;
    const units = integer(before.slice(at + layout.massOffsetWords, at + layout.massOffsetWords + format.wordCount));
    if (!units) { check(before.slice(at, at + layout.recordWords).every((word, i) => word === after[at + i]), `empty:${row}`); continue; }
    activeRows++;
    for (let i = 0; i < layout.recordWords; i++) {
      if (i !== 3 && (at + i < offset(3) || at + i >= offset(4))) check(before[at + i] === after[at + i], `preserved:${row}:${i}`);
    }
    check(after[at + 3] === new Float32Array(thermo.buffer, thermo.byteOffset, thermo.length)[row * 12 + 1], `phase:${row}`);
    const mass = rational(units, 1n, format.quantumExponent), oldEnergy = load(before, offset(3));
    const kinetic = divide([0, 1, 2].map(axis => { const p = load(before, offset(axis)); return multiply(p, p); }).reduce(add), multiply(mass, rational(2n)));
    const mode = updates[row * 8], du = scalar(updates[row * 8 + 1]);
    check(mode <= 2, `mode:${row}`);
    const energy = mode === 2 ? add(kinetic, multiply(mass, scalar(updates[row * 8 + 2]))) : add(oldEnergy, multiply(mass, du));
    check(same(energy, load(after, offset(3))), `exact energy:${row}`);
    check(after[offset(3) + 1] === 0, `energy status:${row}`);
    if (!same(energy, oldEnergy)) changedEnergyRows++;
    const internal = divide(sub(energy, kinetic), mass), bits = state[row * 8 + 7], magnitude = bits & 0x7fffffff;
    const here = scalar(magnitude), previous = scalar(magnitude ? magnitude - 1 : 0);
    const next = magnitude === 0x7f7fffff ? add(here, sub(here, previous)) : scalar(magnitude + 1);
    const low = multiply(add(here, previous), rational(1n, 1n, -1)), high = multiply(add(here, next), rational(1n, 1n, -1));
    const v = { ...internal, n: abs(internal.n) };
    check(magnitude < 0x7f800000 && (!internal.n || (internal.n < 0n) === Boolean(bits >>> 31))
      && sub(v, low).n >= 0n && sub(high, v).n >= 0n
      && (!(magnitude & 1) || (!same(v, low) && !same(v, high))), `projection:${row}`);
    if (mode === 1 && du.n && sub(high, low).n > 0n
      && sub(sub(high, low), { ...du, n: abs(du.n) }).n > 0n) subUlpEnergyRows++;
  }
  return { matches: !failures.length, failures, activeRows, changedEnergyRows, subUlpEnergyRows };
}

export function inspectExactMechanicsRefresh({ before, after, thermo, mechanics, layout, format }) {
  const failures = [], check = (ok, label) => { if (!ok) failures.push(label); };
  const same = (a, b) => a.n === b.n && a.d === b.d && a.e === b.e;
  const lessEqual = (a, b) => add(b, { ...a, n: -a.n }).n >= 0n;
  const projected = (value, bits) => {
    if (bits === 0 || bits >= 0x7f800000) return false;
    const lower = multiply(add(scalar(bits - 1), scalar(bits)), rational(1n, 1n, -1));
    const upper = multiply(add(scalar(bits), scalar(bits + 1)), rational(1n, 1n, -1));
    return lessEqual(lower, value) && lessEqual(value, upper)
      && (!(bits & 1) || (!same(lower, value) && !same(upper, value)));
  };
  const width = layout.scalar.wordCount, stride = layout.recordWords;
  const load = (words, at) => rational(integer(words.slice(at + 4, at + 4 + width)) * (words[at] ? -1n : 1n),
    integer(words.slice(at + 4 + width, at + 4 + 2 * width)), words[at + 2] | 0);
  check(after.length === layout.rowCount * stride, 'carrier-only storage');
  let activeRows = 0, changedReferenceRows = 0;
  for (let row = 0; row < layout.rowCount; row++) {
    const at = row * stride, restAt = at + layout.scalarOffsetWords + 4 * layout.scalar.recordWords;
    const mass = integer(before.slice(at + layout.massOffsetWords, at + layout.massOffsetWords + format.wordCount));
    for (let i = 0; i < stride; i++) {
      if (!mass || i < restAt - at || i >= restAt - at + layout.scalar.recordWords) {
        check(before[at + i] === after[at + i], `preserved:${row}:${i}`);
      }
    }
    if (!mass) continue;
    activeRows++;
    const rest = divide(rational(mass, 1n, format.quantumExponent), scalar(thermo[row * 12 + 3]));
    const current = load(before, at + layout.scalarOffsetWords + 5 * layout.scalar.recordWords);
    check(after[restAt + 1] === 0 && after[restAt + 3] === 0, `reference status:${row}`);
    check(same(rest, load(after, restAt)), `exact reference volume:${row}`);
    if (!same(rest, load(before, restAt))) changedReferenceRows++;
    check(projected(rest, mechanics[row * 32 + 19]), `reference projection:${row}`);
    check(projected(divide(current, rest), mechanics[row * 32 + 18]), `ratio projection:${row}`);
  }
  return { matches: failures.length === 0, failures, activeRows, changedReferenceRows };
}

// Conservation across the actual placement transaction, independent of its
// routing decisions. Count each current carrier and unplaced residual once.
// SAFE_PLACED (1) starts at the post-reaction candidate; SAFE_FROZEN_FALLBACK
// (2) restores the pre-reaction originals. Comparing rollback with the candidate
// incorrectly reports reaction energy/volume changes as placement losses.
export function inspectExactPlacementConservation({ beforeWords, beforeLayout, afterWords, afterLayout,
  residualCount, residualCompanions, companionStrideWords, terminalStatus }) {
  const failures = [];
  const check = (ok, label) => { if (!ok) failures.push(label); };
  check(terminalStatus === 1 || terminalStatus === 2, 'terminal status');
  const restored = terminalStatus === 2;
  const n = afterLayout.massWordCount;
  check(residualCount.length === 2 && residualCount[1] === 0
    && residualCount[0] <= afterLayout.eventCapacity, 'residual count/error');
  const sum = (words, layout, start, end, label) => {
    let mass = 0n;
    const values = Array.from({ length: 7 }, zero);
    check(words.length === layout.wordLength, `${label}:storage size`);
    for (let row = start; row < end; row++) {
      const at = row * layout.recordWords;
      const m = integer(words.slice(at + 16, at + 16 + n)); mass += m;
      if (m) check(words[at] === 1 && words[at + 1] === 0, `${label}:${row}:ready/error`);
      for (let field = 0; field < 7; field++) {
        const s = at + layout.scalarOffsetWords + field * layout.scalar.recordWords;
        const width = layout.scalar.wordCount;
        const numerator = integer(words.slice(s + 4, s + 4 + width));
        if (!m) { check(numerator === 0n, `${label}:${row}:${field}:empty`); continue; }
        const denominator = integer(words.slice(s + 4 + width, s + 4 + 2 * width));
        check(words[s] <= 1 && words[s + 1] === 0 && words[s + 3] === 0 && denominator > 0n,
          `${label}:${row}:${field}:scalar`);
        if (denominator) values[field] = add(values[field], rational(numerator * (words[s] ? -1n : 1n), denominator, words[s + 2] | 0));
      }
      if (label === 'after' && row >= layout.eventRowOffset) {
        const event = row - layout.eventRowOffset;
        if (event >= residualCount[0]) check(m === 0n, `after:${event}:retired residual`);
        else {
          const c = event * companionStrideWords + 8 + 2 * n;
          check(m === integer(residualCompanions.slice(c, c + n)), `after:${event}:companion mass`);
        }
      }
    }
    return { mass, values };
  };
  const start = restored ? beforeLayout.originalRowOffset : beforeLayout.currentRowOffset;
  const end = restored ? start + beforeLayout.particleCount : beforeLayout.rowCount;
  check(Number.isSafeInteger(start) && start >= 0 && end <= beforeLayout.rowCount, 'before:comparison range');
  const before = sum(beforeWords, beforeLayout, start, end, 'before');
  const after = sum(afterWords, afterLayout, 0, afterLayout.rowCount, 'after');
  check(before.mass === after.mass, 'mass');
  const fields = before.values.map((value, field) => {
    const observed = after.values[field];
    const matches = value.n === observed.n && value.d === observed.d && value.e === observed.e;
    check(matches, beforeLayout.fields[field]);
    return { name: beforeLayout.fields[field], before: serial(value), after: serial(observed), matches };
  });
  return { matches: failures.length === 0, failures,
    comparisonBasis: restored ? 'pre-reaction originals' : 'post-reaction candidate',
    massBefore: String(before.mass), massAfter: String(after.mass), fields };
}

export function inspectExactPlacementQuantities({ selected, layout, quantityWords, sourceWords,
  sourcePackedWords, originalInventoryWords, inventoryRowOffset, auxiliaryWords, outputLayout,
  compactCompanionWords, compactCountWords, compiled, carriedSourceWords = null, carriedSourceLayout = null }) {
  const failures = [], rows = [], n = selected.format.wordCount, q = selected.format.quantumExponent;
  const check = (ok, label) => { if (!ok) failures.push(label); };
  const retained = (words, at, width) => {
    check(words[at] <= 1 && words[at + 1] === 0 && words[at + 3] === 0, `retained-field:${at}`);
    return rational(integer(words.slice(at + 4, at + 4 + width)) * (words[at] ? -1n : 1n),
      integer(words.slice(at + 4 + width, at + 4 + 2 * width)), words[at + 2] | 0);
  };
  check((selected.extensiveEncoding === 'rational') === Boolean(carriedSourceWords && carriedSourceLayout),
    'packet and retained source agree');
  const molars = new Map();
  for (const token of compiled) for (const term of [...token.reactants, ...token.products]) {
    molars.set(term.materialId, new Uint32Array(new Float32Array([term.molarMass]).buffer)[0]);
  }
  const inputMass = row => integer(originalInventoryWords.slice((inventoryRowOffset + row) * n,
    (inventoryRowOffset + row + 1) * n));
  const relaxed = row => {
    const values = sourcePackedWords.slice(row * 52 + 20, row * 52 + 40);
    const one = new Set([0, 4, 8, 18]);
    return values.slice(0, 19).every((word, i) => one.has(i) ? word === 0x3f800000 : (word & 0x7fffffff) === 0)
      && values[19] > 0 && values[19] < 0x7f800000;
  };
  const seed = row => {
    if (carriedSourceWords) {
      const at = row * carriedSourceLayout.recordWords;
      check(integer(carriedSourceWords.slice(at + carriedSourceLayout.massOffsetWords,
        at + carriedSourceLayout.massOffsetWords + n)) === inputMass(row), `retained-mass:${row}`);
      return Array.from({ length: 7 }, (_, field) => retained(carriedSourceWords,
        at + carriedSourceLayout.scalarOffsetWords + field * carriedSourceLayout.scalar.recordWords,
        carriedSourceLayout.scalar.wordCount));
    }
    const at = row * 52, m = rational(inputMass(row), 1n, q);
    const v = Array.from(sourcePackedWords.slice(at + 4, at + 7), scalar);
    const u = scalar(sourcePackedWords[at + 7]);
    const energy = multiply(m, v.reduce((s, a) => add(s, multiply(multiply(a, a), rational(1n, 1n, -1))), u));
    const rest = scalar(sourcePackedWords[at + 39]);
    return [...v.map(a => multiply(m, a)), energy, rest,
      multiply(rest, scalar(sourcePackedWords[at + 38])), scalar(sourcePackedWords[at + 51])];
  };
  const signedPacket = (at, width, exponent, denominator = 1n) => {
    check(sourceWords[at] <= 1 && sourceWords[at + 1] === 0, `packet-field:${at}`);
    return rational(integer(sourceWords.slice(at + 2, at + 2 + width)) * (sourceWords[at] ? -1n : 1n), denominator, exponent);
  };
  const packetExtensive = (packet, field) => selected.extensiveEncoding === 'rational'
    ? retained(sourceWords, packet + selected.extensiveOffsetWords + 4 + field * selected.extensiveScalarWords,
      selected.extensiveWordCount)
    : signedPacket(packet + selected.extensiveOffsetWords + 4 + field * (n + 20), n + 18, q - 299);
  const packetEnergy = (packet, field) => {
    const energy = packet + selected.productEnergyOffsetWords;
    if (selected.extensiveEncoding === 'rational') return retained(sourceWords,
      energy + 8 + field * selected.productEnergyScalarWords, selected.productEnergyWordCount);
    const ec = selected.caloricWordCount, denominatorAt = packet + selected.caloricOffsetWords + 16 + ec + 2;
    const denominator = integer(sourceWords.slice(denominatorAt + 2, denominatorAt + 2 + ec));
    return signedPacket(energy + 8 + field * (ec + 2), ec, sourceWords[energy + 3] | 0, denominator);
  };
  const product = (pair, ordinal, mass) => {
    const packet = pair * selected.recordWords;
    const total = integer(sourceWords.slice(packet + 12, packet + 12 + n));
    const fraction = rational(mass, total), m = rational(mass, 1n, q);
    const extensive = field => packetExtensive(packet, field), residual = packetEnergy(packet, 1);
    const state = packet + selected.caloricOffsetWords + selected.caloricProductOffsetWords
      + (2 * selected.caloricProductCapacity + ordinal - 2) * 8;
    const u = scalar(sourceWords[state + 4]), rho = scalar(sourceWords[state + 5]);
    const rest = divide(m, rho);
    return [0, 1, 2].map(axis => multiply(fraction, extensive(axis))).concat([
      add(multiply(m, u), multiply(fraction, add(extensive(10), residual))), rest, rest, m
    ]);
  };
  for (let index = 0; index < layout.rowCount; index++) {
    const at = index * layout.recordWords;
    const header = quantityWords.slice(at, at + 16);
    let kind = 0, row = index, pair = 0xffffffff, ordinal = 0xffffffff, mass, error = 0;
    if (index < selected.particleCount) mass = inputMass(row);
    else if (index < 2 * selected.particleCount) {
      row = index - selected.particleCount;
      const carrier = outputLayout.carrierOffsetWords + row * outputLayout.carrierStrideWords;
      kind = auxiliaryWords[carrier]; pair = auxiliaryWords[carrier + 2]; ordinal = auxiliaryWords[carrier + 3];
      mass = integer(auxiliaryWords.slice(carrier + 8, carrier + 8 + n));
    } else {
      row = index - 2 * selected.particleCount; kind = 2;
      if (row >= compactCountWords[0]) { kind = 3; mass = 0n; }
      else {
        const event = row * outputLayout.eventCompanionStrideWords;
        pair = compactCompanionWords[event]; ordinal = compactCompanionWords[event + 2];
        mass = integer(compactCompanionWords.slice(event + 8 + 2 * n, event + 8 + 3 * n));
      }
    }
    let material = kind < 2 ? new Float32Array(sourcePackedWords.buffer, sourcePackedWords.byteOffset + (row * 52 + 8) * 4, 1)[0] : 0;
    let phase = kind < 2 ? new Float32Array(sourcePackedWords.buffer, sourcePackedWords.byteOffset + (row * 52 + 9) * 4, 1)[0] : 0;
    let molar = kind < 2 ? molars.get(material) ?? 0 : 0;
    if (mass && kind < 2 && (!relaxed(row) || !molars.get(material))) error = 4194304;
    if (kind === 1 || kind === 2) {
      const packet = pair * selected.recordWords;
      const term = packet + selected.speciesOffsetWords + selected.speciesLayout.termOffsetWords
        + ordinal * selected.speciesLayout.termStrideWords;
      molar = sourceWords[term + 5];
      if (kind === 2) {
        const state = packet + selected.caloricOffsetWords + selected.caloricProductOffsetWords
          + (2 * selected.caloricProductCapacity + ordinal - 2) * 8;
        material = sourceWords[state + 1]; phase = sourceWords[state + 2];
      }
    }
    let expected = Array.from({ length: 7 }, zero);
    if (mass && !error) expected = kind === 2 ? product(pair, ordinal, mass)
      : seed(row).map(value => kind === 1 ? multiply(value, rational(mass, inputMass(row))) : value);
    check(header[0] === Number(!error) && header[1] === error, `row${index}:ready/error:${header[0]}/${header[1]}`);
    check(header[2] === material && header[3] === phase && header[4] === molar, `row${index}:material/phase/molar`);
    check(header[5] === kind && header[6] === row && header[7] === pair && header[8] === ordinal, `row${index}:identity`);
    check(header[9] === n && header[10] === layout.scalar.wordCount && header[11] === Number(mass !== 0n)
      && header.slice(12).every(word => word === 0), `row${index}:layout`);
    check(integer(quantityWords.slice(at + 16, at + 16 + n)) === mass, `row${index}:mass`);
    const fields = expected.map((wanted, field) => {
      const offset = at + layout.scalarOffsetWords + field * layout.scalar.recordWords;
      const width = layout.scalar.wordCount;
      const magnitude = integer(quantityWords.slice(offset + 4, offset + 4 + width));
      const observed = { n: magnitude * (quantityWords[offset] ? -1n : 1n),
        d: integer(quantityWords.slice(offset + 4 + width, offset + 4 + 2 * width)), e: quantityWords[offset + 2] | 0 };
      const matches = quantityWords[offset] === Number(wanted.n < 0n)
        && quantityWords[offset + 1] === 0 && quantityWords[offset + 3] === 0
        && observed.n === wanted.n && observed.d === wanted.d && observed.e === wanted.e;
      check(matches, `row${index}:${layout.fields[field]}`);
      return { name: layout.fields[field], observed: serial(observed), expected: serial(wanted), matches };
    });
    rows.push({ index, kind, mass: String(mass), header: Array.from(header), fields });
  }
  const aggregates = [];
  const fromSerial = value => ({ n: BigInt(value.numerator), d: BigInt(value.denominator), e: value.exponent });
  const equal = (a, b) => a.n === b.n && a.d === b.d && a.e === b.e;
  const originalMass = rows.slice(0, selected.particleCount).reduce((sum, row) => sum + BigInt(row.mass), 0n);
  const routedMass = rows.slice(selected.particleCount).reduce((sum, row) => sum + BigInt(row.mass), 0n);
  check(originalMass === routedMass, 'aggregate:original=carrier+residual mass');
  for (let pair = 0; pair < selected.particleCount; pair++) {
    if (auxiliaryWords[pair * 16] !== 1) continue;
    const fragments = rows.slice(selected.particleCount).filter(row => row.kind === 2 && row.header[7] === pair && BigInt(row.mass));
    const sum = field => fragments.reduce((value, row) => add(value, fromSerial(row.fields[field].observed)), zero());
    const packet = pair * selected.recordWords;
    const total = integer(sourceWords.slice(packet + 12, packet + 12 + n));
    check(fragments.reduce((mass, row) => mass + BigInt(row.mass), 0n) === total, `pair${pair}:fragment mass partitions total`);
    for (let axis = 0; axis < 3; axis++) {
      const wanted = packetExtensive(packet, axis);
      check(equal(sum(axis), wanted), `pair${pair}:aggregate momentum${axis}`);
    }
    const expectedEnergy = packetEnergy(packet, 2);
    check(equal(sum(3), expectedEnergy), `pair${pair}:aggregate product total energy`);
    let rest = zero();
    for (let local = 0; local < sourceWords[packet + 5]; local++) {
      const term = packet + 12 + 7 * n + local * (4 + 3 * n);
      const mass = integer(sourceWords.slice(term + 4, term + 4 + n));
      if (!mass) continue;
      const state = packet + selected.caloricOffsetWords + selected.caloricProductOffsetWords
        + (2 * selected.caloricProductCapacity + local) * 8;
      rest = add(rest, divide(rational(mass, 1n, q), scalar(sourceWords[state + 5])));
    }
    check(equal(sum(4), rest) && equal(sum(5), rest), `pair${pair}:aggregate product rest/current volume`);
    check(equal(sum(6), rational(total, 1n, q)), `pair${pair}:aggregate product reference mass`);
    aggregates.push({ pair, fragmentCount: fragments.length, mass: String(total),
      productEnergy: serial(sum(3)), expectedProductEnergy: serial(expectedEnergy), restVolume: serial(rest) });
  }
  return { matches: failures.length === 0, failures, rows, aggregates };
}
