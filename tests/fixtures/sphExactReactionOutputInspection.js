// Independent physical-staging readback oracle. Exact projections search the
// ordered IEEE encoding space with BigInt comparisons; no production codec,
// projection shader, output writer or metadata encoder is imported.
const NA = 602214076000000000000000n;
const NONE = 0xffffffff;
const f32 = Math.fround;
const bits = value => new Uint32Array(new Float32Array([value]).buffer)[0];
const number = value => new Float32Array(new Uint32Array([value]).buffer)[0];
const integer = words => {
  let value = 0n;
  for (let i = words.length - 1; i >= 0; i--) value = (value << 32n) | BigInt(words[i]);
  return value;
};
const gcd = (a, b) => { a = a < 0n ? -a : a; while (b) [a, b] = [b, a % b]; return a; };
const rational = (n, d = 1n, e = 0) => {
  if (d <= 0n) throw new RangeError('Positive exact output denominator required');
  if (e < 0) d <<= BigInt(-e); else n <<= BigInt(e);
  const common = gcd(n, d); return { n: n / common, d: d / common };
};
const add = (a, b) => rational(a.n * b.d + b.n * a.d, a.d * b.d);
const multiply = (a, b) => rational(a.n * b.n, a.d * b.d);
const scale = (a, numerator, denominator = 1n) => rational(a.n * numerator, a.d * denominator);
const fromBits = raw => {
  const exponent = (raw >>> 23) & 255;
  if (exponent === 255) throw new RangeError('Nonfinite physical source');
  return rational(BigInt((raw & 0x7fffff) | (exponent ? 0x800000 : 0)) * (raw >>> 31 ? -1n : 1n),
    1n, exponent ? exponent - 150 : -149);
};
const compare = (a, b) => { const delta = a.n * b.d - b.n * a.d; return delta < 0n ? -1 : delta > 0n ? 1 : 0; };

export function projectExactReactionOutputRational(numerator, denominator = 1n, exponent = 0, requiredPositive = false) {
  if (denominator <= 0n) throw new RangeError('Positive exact output denominator required');
  if (numerator !== 0n) {
    const magnitude = numerator < 0n ? -numerator : numerator;
    const roughOrder = magnitude.toString(2).length - denominator.toString(2).length + exponent;
    if (roughOrder > 128) return { bits: 0, error: 16 };
    if (roughOrder < -151) return { bits: numerator < 0n ? 0x80000000 : 0, error: 32 };
  } else return { bits: 0, error: requiredPositive ? 32 : 0 };
  const signed = rational(numerator, denominator, exponent);
  if (signed.n === 0n) return { bits: 0, error: requiredPositive ? 32 : 0 };
  const sign = signed.n < 0n ? 0x80000000 : 0, magnitude = rational(signed.n < 0n ? -signed.n : signed.n, signed.d);
  // The max-finite/infinity midpoint ties to the even infinity significand.
  const overflow = add(fromBits(0x7f7fffff), rational(1n, 1n, 103));
  if (compare(magnitude, overflow) >= 0) return { bits: 0, error: 16 };
  let low = 0, high = 0x7f7fffff;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (compare(fromBits(middle), magnitude) <= 0) low = middle; else high = middle - 1;
  }
  let chosen = low;
  if (low < 0x7f7fffff) {
    const midpoint = scale(add(fromBits(low), fromBits(low + 1)), 1n, 2n);
    const order = compare(magnitude, midpoint);
    if (order > 0 || (order === 0 && (low & 1))) chosen++;
  }
  const result = (chosen | sign) >>> 0;
  return { bits: result, error: chosen === 0 || (requiredPositive && sign !== 0) ? 32 : 0 };
}
const project = (value, positive = false) => projectExactReactionOutputRational(value.n, value.d, 0, positive);
const finite = raw => (raw & 0x7f800000) !== 0x7f800000;
const same = (a, b) => a.length === b.length && a.every((value, i) => value === b[i]);

/** Complete speculative physical ABI/companion/compaction proof. Upstream
 * exact selection and packet oracles prove chemistry and extensive inputs;
 * this consumer checks every emitted physical word against their original
 * exact bases. A ready staging header never means physical publication.
 */
export function inspectExactReactionOutputs({ sourceWords, routingWords, selected, routingLayout, layout,
  sourcePackedWords, packedWords, originalInventoryWords, inventoryRowOffset = 0, eventWords, auxiliaryWords,
  compactEventWords, compactCompanionWords, compactCountWords, reactionTable, expectedPairErrors = null,
  stateWords = null, thermoWords = null, mechanicsWords = null }) {
  const failures = [], mismatches = [], pairs = [];
  const check = (name, value) => { if (!value) failures.push(name); return Boolean(value); };
  const n = selected.format.wordCount, q = selected.format.quantumExponent, count = selected.particleCount;
  const capacity = selected.caloricProductCapacity;
  if (sourcePackedWords.length !== count * 52 || packedWords.length !== count * 52
      || originalInventoryWords.length < (inventoryRowOffset + count) * n
      || sourceWords.length < count * selected.recordWords || routingWords.length < count * routingLayout.recordWords
      || eventWords.length < count * capacity * 32 || auxiliaryWords.length < layout.auxWords) {
    throw new RangeError('Physical output readback bounds');
  }
  check('layout', layout.particleCount === count && layout.productCapacity === capacity
    && layout.carrierOffsetWords === count * 16 && layout.carrierStrideWords === 8 + n
    && layout.eventCompanionStrideWords === 8 + 3 * n && layout.eventCompanionOffsetWords % 64 === 0
    && layout.eventCompanionOffsetWords === Math.ceil((count * 16 + count * (8 + n)) / 64) * 64
    && layout.eventParticleOffsetWords === Math.ceil((layout.eventCompanionOffsetWords + count * capacity * (8 + 3 * n)) / 64) * 64
    && layout.eventParticleStrideWords === 64
    && layout.auxWords === layout.eventParticleOffsetWords + count * capacity * 64);
  check('publication-closed', selected.physicalPublicationAdmitted === false);
  const expectedPacked = sourcePackedWords.slice(), expectedAux = new Uint32Array(layout.auxWords);
  const expectedEvents = new Uint32Array(count * capacity * 32);
  const massAt = offset => integer(sourceWords.slice(offset, offset + n));
  const routeMass = offset => integer(routingWords.slice(offset, offset + n));
  const inventoryMass = row => integer(originalInventoryWords.slice((inventoryRowOffset + row) * n, (inventoryRowOffset + row + 1) * n));
  const putMass = (target, at, value) => {
    for (let i = 0; i < n; i++) { target[at + i] = Number(value & 0xffffffffn); value >>= 32n; }
    if (value !== 0n) throw new RangeError('Inspection mass outside format');
  };
  const initializeCarrier = row => {
    const at = layout.carrierOffsetWords + row * layout.carrierStrideWords;
    expectedAux.set([0, row, NONE, NONE, NONE, number(sourcePackedWords[row * 52 + 8]), Number(inventoryMass(row) > 0n), 0], at);
    putMass(expectedAux, at + 8, inventoryMass(row));
  };
  for (let row = 0; row < count; row++) initializeCarrier(row);
  const original = (row, word) => sourcePackedWords[row * 52 + word];
  const quantity = (mass, divisorBits, entities = false) => {
    const divisor = fromBits(divisorBits);
    return rational(mass * (entities ? NA : 1n) * divisor.d, divisor.n, q);
  };
  const compareWords = (label, actual, expected) => {
    const equal = actual.length === expected.length && Array.from(actual).every((value, i) => value === expected[i]);
    check(label, equal);
    if (!equal) for (let i = 0; i < Math.max(actual.length, expected.length) && mismatches.length < 40; i++) {
      if (actual[i] !== expected[i]) mismatches.push({ label, word: i, actual: actual[i] ?? null, expected: expected[i] ?? null });
    }
  };
  for (let pair = 0; pair < count; pair++) {
    const src = pair * selected.recordWords, route = pair * routingLayout.recordWords, headerAt = pair * 16;
    const routeHeader = Array.from(routingWords.slice(route, route + 16));
    const actualHeader = Array.from(auxiliaryWords.slice(headerAt, headerAt + 16));
    check(`pair-${pair}-no-acceptance`, actualHeader[6] === 0 && sourceWords[src + 11] === 0 && routeHeader[8] === 0);
    if (routeHeader[0] !== 1) {
      expectedAux[headerAt + 1] = routeHeader[1];
      if (expectedPairErrors && Object.hasOwn(expectedPairErrors, pair)) check(`pair-${pair}-expected-error`, expectedPairErrors[pair] === routeHeader[1]);
      pairs.push({ pair, ready: false, inactive: routeHeader[1] === 0, expectedError: routeHeader[1], actualHeader });
      continue;
    }
    const peer = routeHeader[3], productCount = routeHeader[5], reaction = sourceWords[src + 4];
    const donorRows = [sourceWords[src + 2], sourceWords[src + 3]];
    const total = massAt(src + 12), debits = [massAt(src + 12 + n), massAt(src + 12 + 2 * n)];
    check(`pair-${pair}-identity`, peer > pair && peer < count && Math.min(...donorRows) === pair
      && Math.max(...donorRows) === peer && productCount === sourceWords[src + 5] && productCount <= capacity);
    let error = routeHeader[1] | sourceWords[src + 1] | sourceWords[src + selected.caloricOffsetWords + 1]
      | sourceWords[src + selected.productEnergyOffsetWords + 1] | sourceWords[src + selected.speciesOffsetWords + 1];
    let projectionFlags = sourceWords[src + selected.extensiveOffsetWords + 3]; error |= projectionFlags & ~32;
    const support = donorRows.reduce((sum, row, donor) => add(sum,
      scale(multiply(fromBits(original(row, 38)), fromBits(original(row, 39))), debits[donor], inventoryMass(row))), rational(0n));
    const midpoint = [0, 1, 2].map(axis => {
      const value = project(scale(donorRows.reduce((sum, row, donor) => add(sum,
        scale(fromBits(original(row, axis)), debits[donor])), rational(0n)), 1n, total));
      projectionFlags |= value.error; error |= value.error & ~32; return value.bits;
    });
    const speciesAt = ordinal => src + selected.speciesOffsetWords + selected.speciesLayout.termOffsetWords
      + ordinal * selected.speciesLayout.termStrideWords;
    const chosenTemperature = sourceWords[src + selected.caloricOffsetWords + 4];
    const velocity = Array.from(sourceWords.slice(src + selected.extensiveOffsetWords, src + selected.extensiveOffsetWords + 3));
    const product = local => {
      const source = src + 12 + 7 * n + local * (4 + 3 * n), globalTerm = sourceWords[source];
      const at = globalTerm * reactionTable.productTermStrideFloats, records = reactionTable.productTermRecords;
      const material = sourceWords[source + 1], phase = sourceWords[source + 2];
      const chosen = src + selected.caloricOffsetWords + selected.caloricProductOffsetWords + (2 * capacity + local) * 8;
      check(`pair-${pair}-term-${local}-original`, records[at] === reaction && records[at + 1] === material
        && records[at + 7] === 1 && sourceWords[chosen] === globalTerm && sourceWords[chosen + 1] === material
        && sourceWords[chosen + 2] === phase && sourceWords[chosen + 3] === 1 && sourceWords[chosen + 7] === 0);
      let phaseIndex = -1;
      for (let i = 0; i < reactionTable.productPhaseCount; i++) {
        if (reactionTable.productPhaseRecords[i * 12] === material && reactionTable.productPhaseRecords[i * 12 + 1] === phase) { phaseIndex = i; break; }
      }
      if (phaseIndex < 0) throw new Error('Original product phase missing');
      const phaseRow = reactionTable.productPhaseRecords.slice(phaseIndex * 12, phaseIndex * 12 + 12);
      let sound = phaseRow[6];
      if (phaseRow[7] === 2) {
        const law = reactionTable.gasConstitutiveRecords.slice(phaseIndex * 4, phaseIndex * 4 + 4);
        const real = f32(Math.sqrt(f32(law[0] * number(chosenTemperature))));
        sound = f32(real * law[1]); if (law[2] > 0) sound = Math.min(real, law[2]); sound = Math.max(sound, law[3]);
      }
      const molar = bits(records[at + 3]);
      check(`pair-${pair}-term-${local}-molar-basis`, sourceWords[speciesAt(local + 2) + 5] === molar);
      return { globalTerm, material, phase, materialBits: bits(material), phaseBits: bits(phase),
        u: sourceWords[chosen + 4], rho: sourceWords[chosen + 5], temperature: chosenTemperature,
        coefficient: bits(records[at + 2]), molar, routing: bits(records[at + 5]),
        bulk: bits(phaseRow[3]), shear: bits(phaseRow[4]), lambda: bits(phaseRow[5]), sound: bits(sound),
        eos: bits(phaseRow[7]), solid: bits(phaseRow[8]) };
    };
    const stagedRows = new Map(), carrierRows = new Map(), stagedEvents = [], companionRows = [], residualRows = [];
    const endpointEvidence = [];
    for (let slot = 0; slot < 2 && error === 0; slot++) {
      const descriptor = route + 16 + slot * (8 + n), kind = routingWords[descriptor], row = routingWords[descriptor + 1];
      const ordinal = routingWords[descriptor + 3], mass = routeMass(descriptor + 8), output = sourcePackedWords.slice(row * 52, row * 52 + 52);
      const projections = {};
      if (kind === 0) { output[3] = 0; output[17] = 0; output[39] = 0; output[51] = 0; }
      else {
        projections.mass = project(rational(mass, 1n, q), true);
        if (kind === 1) {
          const term = speciesAt(ordinal), available = inventoryMass(row), molar = sourceWords[term + 5];
          check(`pair-${pair}-survivor-${slot}-original`, donorRows[ordinal] === row
            && massAt(term + 16 + n) === available && massAt(term + 16 + 2 * n) === mass);
          projections.entities = project(quantity(mass, molar, true), true);
          projections.restVolume = project(scale(fromBits(original(row, 39)), mass, available), true);
          projections.currentVolume = project(scale(multiply(fromBits(original(row, 38)), fromBits(original(row, 39))), mass, available), true);
          projections.referenceMass = project(scale(fromBits(original(row, 51)), mass, available), original(row, 51) !== 0);
          output[3] = projections.mass.bits; output[17] = projections.entities.bits;
          output[39] = projections.restVolume.bits; output[51] = projections.referenceMass.bits;
        } else {
          const p = product(ordinal - 2);
          projections.entities = project(quantity(mass, p.molar, true), true);
          projections.restVolume = project(quantity(mass, p.rho), true);
          projections.support = project(scale(support, mass, total), true);
          output.set([original(row, 0), original(row, 1), original(row, 2), projections.mass.bits], 0);
          output.set([...velocity, p.u], 4); output.set([p.materialBits, p.phaseBits, p.temperature, p.rho], 8);
          output.set([bits(Number(p.phase === 1)), bits(Number(p.phase === 2)), bits(Number(p.phase === 3)), 0], 12);
          output.set([original(row, 16), projections.entities.bits, bits(1), original(row, 19)], 16);
          output.set([bits(1), 0, 0, 0, bits(1), 0, 0, 0, bits(1), 0, 0, 0, 0, 0, 0, 0], 20);
          output.set([0, 0, bits(1), projections.restVolume.bits, p.solid, bits(1), p.bulk, p.shear,
            p.lambda, p.sound, p.eos, bits(1), 0, 0, 0, projections.mass.bits], 36);
        }
      }
      for (const value of Object.values(projections)) error |= value.error;
      if (Array.from(output).some(value => !finite(value))) error |= 4;
      const companion = new Uint32Array(8 + n);
      companion.set([kind === 0 ? 3 : kind, kind === 2 ? NONE : row, pair, ordinal,
        routingWords[descriptor + 4], routingWords[descriptor + 5], Number(mass > 0n), 0]);
      putMass(companion, 8, mass); stagedRows.set(row, output); carrierRows.set(row, companion);
      endpointEvidence.push({ row, kind, mass: String(mass), projections });
    }
    for (let local = 0; local < productCount && error === 0; local++) {
      const source = src + 12 + 7 * n + local * (4 + 3 * n);
      const fragment = route + 16 + (2 + local) * (8 + n);
      const mass = massAt(source + 4), residual = routeMass(fragment + 8), direct = mass - residual;
      check(`pair-${pair}-product-${local}-partition`, direct >= 0n && residual >= 0n);
      const companion = new Uint32Array(8 + 3 * n);
      companion.set([pair, sourceWords[source], local + 2, sourceWords[source + 1], Number(mass > 0n), 1, 0, 0]);
      [mass, direct, residual].forEach((value, i) => putMass(companion, 8 + i * n, value));
      companionRows.push(companion);
      const event = new Uint32Array(32);
      const residualRow = new Uint32Array(64);
      if (mass !== 0n) {
        const p = product(local);
        const projectedMass = project(rational(mass, 1n, q), true);
        const projectedDirect = project(rational(direct, 1n, q), direct > 0n);
        const projectedResidual = project(rational(residual, 1n, q), residual > 0n);
        const moles = project(quantity(mass, p.molar), true);
        const fragmentSupport = project(scale(support, residual, total), residual > 0n);
        error |= projectedMass.error | projectedDirect.error | projectedResidual.error | moles.error | fragmentSupport.error;
        if (residual > 0n) {
          // The residual is a separate physical fragment. Derive its quantities
          // directly from exact residual mass and original material properties;
          // selected event mass and rounded event views cannot supply them.
          const entities = project(quantity(residual, p.molar, true), true);
          const restVolume = project(quantity(residual, p.rho), true);
          error |= entities.error | restVolume.error;
          residualRow.set([1, 0, pair, local + 2, p.globalTerm, p.material, p.phase, p.molar, n, 1, 0, 0]);
          residualRow.set([
            0, 0, 0, projectedResidual.bits,
            ...velocity, p.u,
            p.materialBits, p.phaseBits, p.temperature, p.rho,
            bits(Number(p.phase === 1)), bits(Number(p.phase === 2)), bits(Number(p.phase === 3)), 0,
            0, entities.bits, bits(1), 0,
            bits(1), 0, 0, 0, bits(1), 0, 0, 0, bits(1), 0, 0, 0, 0, 0, 0, 0,
            0, 0, bits(1), restVolume.bits, p.solid, bits(1), p.bulk, p.shear,
            p.lambda, p.sound, p.eos, bits(1), 0, 0, 0, projectedResidual.bits
          ], 12);
        }
        event.set([...midpoint, projectedMass.bits, p.materialBits, bits(p.globalTerm), bits(reaction), bits(pair),
          bits(peer), moles.bits, p.routing, p.phaseBits, projectedDirect.bits, projectedResidual.bits, p.coefficient, p.molar,
          p.temperature, p.rho, bits(1), p.u, ...velocity, fragmentSupport.bits,
          p.bulk, p.shear, p.lambda, p.sound, p.eos, p.solid, bits(1), bits(1)]);
      }
      stagedEvents.push(event);
      residualRows.push(residualRow);
    }
    if (expectedPairErrors && Object.hasOwn(expectedPairErrors, pair)) check(`pair-${pair}-expected-error`, error === expectedPairErrors[pair]);
    if (error) expectedAux[headerAt + 1] = error;
    else {
      expectedAux.set([1, 0, pair, peer, reaction, productCount, 0, projectionFlags], headerAt);
      for (const [row, data] of stagedRows) expectedPacked.set(data, row * 52);
      for (const [row, data] of carrierRows) expectedAux.set(data, layout.carrierOffsetWords + row * layout.carrierStrideWords);
      stagedEvents.forEach((data, local) => expectedEvents.set(data, (pair * capacity + local) * 32));
      companionRows.forEach((data, local) => expectedAux.set(data, layout.eventCompanionOffsetWords
        + (pair * capacity + local) * layout.eventCompanionStrideWords));
      residualRows.forEach((data, local) => expectedAux.set(data, layout.eventParticleOffsetWords
        + (pair * capacity + local) * 64));
    }
    pairs.push({ pair, peer, ready: error === 0, expectedError: error, actualHeader, endpointEvidence });
  }
  compareWords('all-physical-particle-words', packedWords, expectedPacked);
  compareWords('all-dense-event-words', eventWords, expectedEvents);
  compareWords('all-companion-and-residual-template-words', auxiliaryWords, expectedAux);
  let carrierMass = 0n, residualMass = 0n, originalMass = 0n;
  for (let row = 0; row < count; row++) {
    const at = layout.carrierOffsetWords + row * layout.carrierStrideWords + 8;
    carrierMass += integer(auxiliaryWords.slice(at, at + n)); originalMass += inventoryMass(row);
  }
  const liveRows = [];
  for (let event = 0; event < count * capacity; event++) {
    const at = layout.eventCompanionOffsetWords + event * layout.eventCompanionStrideWords;
    residualMass += integer(auxiliaryWords.slice(at + 8 + 2 * n, at + 8 + 3 * n));
    if (expectedAux[at + 4] === 1 && expectedAux[at + 5] === 1) liveRows.push(event);
  }
  check('exact-carrier-plus-residual-conservation', carrierMass + residualMass === originalMass);
  if (compactEventWords && compactCompanionWords && compactCountWords) {
    check('gpu-compact-no-error', compactCountWords.length >= 2 && compactCountWords[1] === 0);
    const expectedCompactEvents = new Uint32Array(compactEventWords.length);
    const expectedCompactCompanions = new Uint32Array(compactCompanionWords.length);
    liveRows.forEach((event, target) => {
      expectedCompactEvents.set(expectedEvents.slice(event * 32, event * 32 + 32), target * 32);
      const at = layout.eventCompanionOffsetWords + event * layout.eventCompanionStrideWords;
      expectedCompactCompanions.set(expectedAux.slice(at, at + layout.eventCompanionStrideWords), target * layout.eventCompanionStrideWords);
    });
    check('gpu-compact-live-count', compactCountWords[0] === liveRows.length);
    compareWords('stable-physical-event-compaction', compactEventWords, expectedCompactEvents);
    compareWords('stable-exact-companion-compaction', compactCompanionWords, expectedCompactCompanions);
  }
  const unpack = (offset, stride) => Uint32Array.from({ length: count * stride }, (_, index) =>
    expectedPacked[Math.floor(index / stride) * 52 + offset + index % stride]);
  if (stateWords) compareWords('raw-state-unpack', stateWords, unpack(0, 8));
  if (thermoWords) compareWords('raw-thermo-unpack', thermoWords, unpack(8, 12));
  if (mechanicsWords) compareWords('raw-mechanics-unpack', mechanicsWords, unpack(20, 32));
  return { matches: failures.length === 0, failures, mismatches, pairs, expectedLiveEventCount: liveRows.length,
    carrierMass: String(carrierMass), residualMass: String(residualMass), originalMass: String(originalMass),
    physicalPublicationAdmitted: false };
}
