const FIELD_NAMES = ['targetNumerator', 'denominator', 'lowerResidual', 'upperResidual', 'chosenResidual'];
const SLOT_NAMES = ['lower', 'upper', 'chosen'];
const abs = value => value < 0n ? -value : value;
const bitsOf = value => new Uint32Array(new Float32Array([value]).buffer)[0];
const valueOf = bits => new Float32Array(new Uint32Array([bits]).buffer)[0];
const finiteBits = bits => ((bits >>> 23) & 255) !== 255;
const positiveBits = bits => bits > 0 && bits < 0x7f800000;
const integer = words => {
  let value = 0n;
  for (let index = words.length - 1; index >= 0; index--) value = (value << 32n) | BigInt(words[index]);
  return value;
};
const sameWords = (a, b) => a.length === b.length && a.every((word, index) => word === b[index]);

function dyadic(bits) {
  const encoded = (bits >>> 23) & 255;
  if (encoded === 255) throw new RangeError('Nonfinite captured caloric input');
  const coefficient = BigInt((bits & 0x7fffff) | (encoded ? 0x800000 : 0));
  return { coefficient: bits >>> 31 ? -coefficient : coefficient,
    exponent: encoded ? encoded - 150 : -149 };
}

// Every finite f32 is an exact integer times 2^-149. Extensive inputs use
// the separate 2^-299 quantum so no rounded (U-Uref) or velocity subtraction
// participates in this inspection.
function scaled(bits, exponent) {
  const value = dyadic(bits);
  return value.coefficient << BigInt(value.exponent + exponent);
}

function rational(numerator, denominator, binaryExponent = 0) {
  if (denominator <= 0n) throw new RangeError('Positive caloric denominator required');
  if (binaryExponent < 0) denominator <<= BigInt(-binaryExponent);
  else numerator <<= BigInt(binaryExponent);
  let a = abs(numerator), b = denominator;
  while (b) [a, b] = [b, a % b];
  return { numerator: String(numerator / a), denominator: String(denominator / a) };
}

/** Inspect the original producer's readback; this helper confers no source or
 * publication authority. The target uses a pairwise relative-velocity identity,
 * independently of the GPU's total KE and momentum-square construction. Product
 * trial energies use the actual stored shared-graph states, not a second graph
 * evaluator or a CPU reproduction of the temperature search. */
export function inspectExactCaloricSource({ words, selected, base, stateWords,
  entry, token, allocation, expectedError = 0 }) {
  const n = selected.format.wordCount, width = selected.caloricWordCount;
  const capacity = selected.caloricProductCapacity, at = base + selected.caloricOffsetWords;
  if (!Number.isSafeInteger(base) || base < 0 || !Number.isSafeInteger(at)
      || !Number.isSafeInteger(width) || width < 1 || !Number.isSafeInteger(capacity) || capacity < 1
      || at + 16 + 5 * (width + 2) + 24 * capacity > words.length) {
    throw new RangeError('Caloric inspection record is outside readback');
  }
  const failures = [];
  const check = (name, condition) => { if (!condition) failures.push(name); return Boolean(condition); };
  const header = Array.from(words.slice(at, at + 16));
  const sourceHeader = Array.from(words.slice(base, base + 12));
  check('layout', width === 3 * n + 26 && selected.caloricProductOffsetWords === 16 + 5 * (width + 2)
    && selected.caloricRecordWords === selected.caloricProductOffsetWords + 24 * capacity
    && selected.caloricStateSlots === 3 && selected.caloricProductStrideWords === 8
    && sameWords(selected.caloricFields, FIELD_NAMES));
  check('physical-publication-remains-false', selected.physicalPublicationAdmitted === false && sourceHeader[11] === 0);
  const values = [];
  const fields = FIELD_NAMES.map((name, index) => {
    const start = at + 16 + index * (width + 2);
    const magnitudeWords = Array.from(words.slice(start + 2, start + 2 + width));
    const magnitude = integer(magnitudeWords), negative = words[start], error = words[start + 1];
    const value = negative ? -magnitude : magnitude;
    values.push(value);
    return { name, negative, error, magnitudeWords, magnitude: String(magnitude), value: String(value),
      canonicalSign: negative <= 1 && (magnitude !== 0n || negative === 0) };
  });
  const evidence = { expectedError, header, sourceHeader, fields,
    physicalPublicationAdmitted: selected.physicalPublicationAdmitted,
    sourceReferenceBits: entry.reactants.map(term => bitsOf(term.uRef)),
    deltaBits: bitsOf(entry.deltaPhysical), nonzeroEnergyResidual: null, nonzeroResidual: null, failures };
  if (expectedError !== 0) {
    check('expected-rejection', header[0] === 0 && header[1] === expectedError);
    return { ...evidence, matches: failures.length === 0 };
  }

  check('prepared-status-and-receipt', header[0] === 1 && header[1] === 0 && header[8] === 1);
  check('reserved-header-words', header.slice(9).every(word => word === 0));
  check('bounded-search-iterations', header[5] <= 31);
  check('source-selection', sourceHeader[0] === 1 && sourceHeader[1] === 0
    && sourceHeader[4] === token.reactionIndex && sourceHeader[5] === allocation.products.length
    && allocation.active === true && allocation.error === 0 && allocation.physicalPublicationAdmitted === false);
  check('product-capacity', allocation.products.length <= capacity && entry.products.length === allocation.products.length);
  const amountAt = base + 12;
  const actualAmounts = [0, 1, 2].map(index => integer(words.slice(amountAt + index * n, amountAt + (index + 1) * n)));
  const masses = [allocation.debitA, allocation.debitB], total = allocation.total;
  check('selected-integer-debits', total > 0n && masses.every(mass => mass > 0n)
    && total === masses[0] + masses[1]
    && actualAmounts.every((value, index) => value === [total, ...masses][index]));
  const sourceRows = sourceHeader.slice(2, 4);
  check('source-row-addresses', sourceRows[0] !== sourceRows[1]
    && sourceRows.every(row => row < selected.particleCount && row * 8 + 8 <= stateWords.length));
  check('reactant-term-order', entry.reactants.length === 2 && token.reactants.length === 2
    && entry.reactants.every((term, index) => term.termIndex === token.reactants[index].termIndex
      && term.materialId === token.reactants[index].materialId));

  try {
    const states = sourceRows.map(row => Array.from(stateWords.slice(row * 8 + 4, row * 8 + 8)));
    if (states.some(state => state.length !== 4)) throw new RangeError('Missing captured source state');
    const velocityIntegers = states.map(state => state.slice(0, 3).map(bits => scaled(bits, 149)));
    const relative = masses[0] * masses[1] * velocityIntegers[0].reduce((sum, value, axis) => {
      const difference = value - velocityIntegers[1][axis]; return sum + difference * difference;
    }, 0n);
    const sensible = masses.reduce((sum, mass, index) => sum + mass
      * (scaled(states[index][3], 299) - scaled(evidence.sourceReferenceBits[index], 299)), 0n);
    const scale = token.reactantWeightSum * token.reactantWeightScale.coefficient;
    const scaleExponent = token.reactantWeightScale.exponent;
    const delta = dyadic(evidence.deltaBits);
    const shift = delta.coefficient === 0n ? 0 : 299 + delta.exponent - scaleExponent;
    const fractionalShift = Math.max(-shift, 0);
    const numerator = (((sensible * total + relative) * scale) << BigInt(fractionalShift))
      - ((total * total * delta.coefficient) << BigInt(Math.max(shift, 0)));
    const denominator = total * scale, normalizedDenominator = denominator << BigInt(fractionalShift);
    check('target-metadata', header[6] === fractionalShift && header[7] === evidence.deltaBits
      && scale > 0n && denominator > 0n && fractionalShift <= 104);
    evidence.sourceStateBits = states;
    evidence.exactInputs = { debitA: String(masses[0]), debitB: String(masses[1]), total: String(total),
      velocityIntegers: velocityIntegers.map(vector => vector.map(String)),
      sourceSensible: String(sensible), pairwiseRelativeNumerator: String(relative),
      massScale: String(scale), massScaleExponent: scaleExponent, deltaCoefficient: String(delta.coefficient),
      deltaExponent: delta.exponent, fractionalShift, targetNumerator: String(numerator), denominator: String(denominator) };

    const stateSlots = SLOT_NAMES.map((name, slot) => {
      const rawWords = Array.from(words.slice(at + selected.caloricProductOffsetWords + slot * capacity * 8,
        at + selected.caloricProductOffsetWords + (slot + 1) * capacity * 8));
      let productSensible = 0n;
      const products = allocation.products.map((product, index) => {
        const raw = rawWords.slice(index * 8, index * 8 + 8);
        const term = entry.products.find(term => term.termIndex === product.termIndex);
        const compiled = token.products[index], active = product.mass !== 0n;
        const expectedReference = term ? bitsOf(term.uRef) : null;
        const source = amountAt + 7 * n + index * (4 + 3 * n);
        const selectedMass = integer(words.slice(source + 4, source + 4 + n));
        check(`${name}-product-${index}-identity`, Boolean(term) && Boolean(compiled)
          && product.termIndex === compiled.termIndex && product.materialId === compiled.materialId
          && product.targetPhase === compiled.targetPhase && product.materialId === term?.materialId
          && product.targetPhase === term?.targetPhase
          && sameWords(raw.slice(0, 3), [product.termIndex, product.materialId, product.targetPhase])
          && sameWords(Array.from(words.slice(source, source + 3)), raw.slice(0, 3))
          && words[source + 3] === 0 && selectedMass === product.mass);
        check(`${name}-product-${index}-active`, raw[3] === Number(active) && raw[7] === 0);
        if (active) {
          check(`${name}-product-${index}-values`, finiteBits(raw[4]) && positiveBits(raw[5])
            && raw[6] === expectedReference);
          productSensible += product.mass * (scaled(raw[4], 299) - scaled(raw[6], 299));
        } else check(`${name}-product-${index}-inactive-clear`, raw.slice(3).every(word => word === 0));
        return { rawWords: raw, termIndex: product.termIndex, mass: String(product.mass), active,
          expectedReferenceBits: expectedReference, uBits: raw[4], densityBits: raw[5], referenceBits: raw[6] };
      });
      check(`${name}-unused-capacity-clear`, rawWords.slice(allocation.products.length * 8).every(word => word === 0));
      return { name, temperatureBits: header[2 + slot], temperature: positiveBits(header[2 + slot]) ? valueOf(header[2 + slot]) : null,
        rawWords, products, sensible: String(productSensible),
        residual: String(numerator - (productSensible * normalizedDenominator)) };
    });
    evidence.stateSlots = stateSlots;
    const residuals = stateSlots.map(slot => BigInt(slot.residual));
    const expectedValues = [numerator, denominator, ...residuals];
    fields.forEach((field, index) => {
      field.expected = String(expectedValues[index]);
      field.matches = check(`wide-${field.name}`, field.canonicalSign && field.error === 0 && values[index] === expectedValues[index]);
    });
    const lower = header[2], upper = header[3], chosen = header[4];
    check('positive-finite-temperature-domain', positiveBits(lower) && positiveBits(upper) && positiveBits(chosen)
      && lower >= bitsOf(entry.tMin) && upper <= bitsOf(entry.tMax));
    check('adjacent-or-equal-bracket', upper >= lower && upper - lower <= 1);
    check('bracket-residual-signs', residuals[0] >= 0n && residuals[1] <= 0n);
    const chooseLower = abs(residuals[0]) < abs(residuals[1])
      || (abs(residuals[0]) === abs(residuals[1]) && (lower & 1) === 0);
    const chosenSlot = chooseLower ? 0 : 1;
    check('chosen-nearest-residual-ties-even', chosen === (chooseLower ? lower : upper));
    check('chosen-state-is-selected-endpoint', sameWords(stateSlots[2].rawWords, stateSlots[chosenSlot].rawWords)
      && residuals[2] === residuals[chosenSlot]);
    evidence.chosenEndpoint = SLOT_NAMES[chosenSlot];
    evidence.nonzeroEnergyResidual = residuals[2] !== 0n;
    evidence.nonzeroResidual = evidence.nonzeroEnergyResidual;
    evidence.normalized = {
      extensiveQuantumExponent: selected.format.quantumExponent - 299,
      targetExtensiveQuanta: rational(numerator, normalizedDenominator),
      targetEnergyJ: rational(numerator, normalizedDenominator, selected.format.quantumExponent - 299),
      residuals: stateSlots.map((slot, index) => ({ name: slot.name,
        rawNumerator: slot.residual, extensiveQuanta: rational(residuals[index], normalizedDenominator),
        energyJ: rational(residuals[index], normalizedDenominator, selected.format.quantumExponent - 299) }))
    };
  } catch (error) {
    failures.push('independent-reconstruction');
    evidence.inspectionError = String(error.message ?? error);
  }
  return { ...evidence, matches: failures.length === 0 };
}
