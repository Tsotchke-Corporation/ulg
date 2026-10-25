// Independent readback inspection: no production codecs, generated shader,
// metadata weights, or physical owner registration participates in this oracle.
const NA = 602214076000000000000000n;
const abs = value => value < 0n ? -value : value;
const bitsOf = value => new Uint32Array(new Float32Array([value]).buffer)[0];
const signedWord = value => value | 0;
const integer = words => {
  let result = 0n;
  for (let i = words.length - 1; i >= 0; i--) result = (result << 32n) | BigInt(words[i]);
  return result;
};
const gcd = (a, b) => { a = abs(a); while (b) [a, b] = [b, a % b]; return a; };
const dyadic = bits => {
  const encoded = (bits >>> 23) & 255;
  if (encoded === 255) throw new RangeError('Nonfinite original packet input');
  return { coefficient: BigInt((bits & 0x7fffff) | (encoded ? 0x800000 : 0)) * (bits >>> 31 ? -1n : 1n),
    exponent: encoded ? encoded - 150 : -149 };
};
const scaled = (bits, exponent) => {
  const value = dyadic(bits);
  return value.coefficient << BigInt(value.exponent + exponent);
};
const rational = (numerator, denominator = 1n, exponent = 0) => {
  if (denominator <= 0n) throw new RangeError('Positive packet denominator required');
  if (exponent < 0) denominator <<= BigInt(-exponent);
  else numerator <<= BigInt(exponent);
  const common = gcd(numerator, denominator);
  return { numerator: String(numerator / common), denominator: String(denominator / common) };
};
const ratioOfDyadics = (numerator, denominator) => rational(
  numerator.coefficient, denominator.coefficient, numerator.exponent - denominator.exponent);
const same = (a, b) => a.length === b.length && a.every((value, i) => value === b[i]);

/** Product energy is reconstructed directly from actual source U/KE, selected
 * product Uref, and original physical formation energy. Species expectations
 * use original molar/atom rows and exact integer masses, not encoded weights.
 * Volume expectations preserve the captured original M.V0/J fraction basis.
 * This checks numeric preparation only, including nonzero chemical residuals.
 */
export function inspectExactReactionPacket({ words, selected, base, stateWords, mechanicsWords,
  thermoWords = null, entry, token, allocation, reactionTable, expectedCaloricError = 0,
  expectedSpeciesError = 0 }) {
  const failures = [];
  const check = (name, value) => { if (!value) failures.push(name); return Boolean(value); };
  const n = selected.format.wordCount, width = 3 * n + 26, stride = width + 2;
  const layout = selected.speciesLayout;
  const at = base + selected.speciesOffsetWords, energyAt = base + selected.productEnergyOffsetWords;
  if (!layout || at < base || energyAt < base || at + layout.recordWords > words.length
      || energyAt + 8 + 3 * stride > words.length) throw new RangeError('Packet readback bounds');
  const sourceHeader = Array.from(words.slice(base, base + 12));
  const header = Array.from(words.slice(at, at + 16));
  const energyHeader = Array.from(words.slice(energyAt, energyAt + 8));
  const evidence = { header, energyHeader, sourceHeader, failures,
    physicalPublicationAdmitted: selected.physicalPublicationAdmitted };
  check('physical-publication-closed', sourceHeader[11] === 0 && selected.physicalPublicationAdmitted === false);
  if (expectedCaloricError) {
    check('caloric-rejection-does-not-prepare-packet',
      Array.from(words.slice(at, at + layout.recordWords)).every(value => value === 0)
      && Array.from(words.slice(energyAt, energyAt + 8 + 3 * stride)).every(value => value === 0));
    return { ...evidence, matches: failures.length === 0 };
  }
  const wide = (offset, label) => {
    const magnitude = integer(words.slice(offset + 2, offset + 2 + width));
    const negative = words[offset], error = words[offset + 1];
    check(`${label}-canonical`, negative <= 1 && (magnitude !== 0n || negative === 0) && error === 0);
    return negative ? -magnitude : magnitude;
  };
  try {
    const products = allocation.products;
    const terms = [...entry.reactants, ...entry.products];
    const masses = [allocation.debitA, allocation.debitB, ...products.map(product => product.mass)];
    const survivors = [allocation.remainderA, allocation.remainderB, ...products.map(() => 0n)];
    const available = masses.map((mass, i) => i < 2 ? mass + survivors[i] : 0n);
    const sourceRows = sourceHeader.slice(2, 4), total = allocation.total;
    check('source-ready', sourceHeader[0] === 1 && sourceHeader[1] === 0 && allocation.active
      && allocation.error === 0 && total === masses[0] + masses[1] && total > 0n);
    check('source-rows', sourceRows[0] !== sourceRows[1] && sourceRows.every(row => row < selected.particleCount
      && row * 8 + 8 <= stateWords.length && row * 32 + 32 <= mechanicsWords.length));
    check('term-order', terms.length === products.length + 2 && entry.reactants.length === 2
      && [...token.reactants, ...token.products].every((term, index) => term.termIndex === terms[index].termIndex
        && term.materialId === terms[index].materialId));
    const caloric = base + selected.caloricOffsetWords;
    const shift = words[caloric + 6], quantum = selected.format.quantumExponent - 299 - shift;
    const denominator = total * token.reactantWeightSum * token.reactantWeightScale.coefficient;
    const u = sourceRows.map(row => stateWords[row * 8 + 7]);
    const velocity = sourceRows.map(row => Array.from(stateWords.slice(row * 8 + 4, row * 8 + 7)));
    const internal = masses[0] * scaled(u[0], 299) + masses[1] * scaled(u[1], 299);
    const sourceReference = masses[0] * scaled(bitsOf(terms[0].uRef), 299)
      + masses[1] * scaled(bitsOf(terms[1].uRef), 299);
    const sourceKinetic = velocity.reduce((sum, vector, i) => sum + masses[i]
      * vector.reduce((s, bits) => s + scaled(bits, 149) ** 2n, 0n), 0n);
    const momentum = [0, 1, 2].map(axis => masses[0] * scaled(velocity[0][axis], 149)
      + masses[1] * scaled(velocity[1][axis], 149));
    const com = Array.from(words.slice(base + selected.extensiveOffsetWords, base + selected.extensiveOffsetWords + 3));
    const projectedKinetic = total * com.reduce((sum, bits) => sum + scaled(bits, 149) ** 2n, 0n);
    const chosenStates = products.map((product, i) => Array.from(words.slice(caloric + selected.caloricProductOffsetWords
      + (2 * selected.caloricProductCapacity + i) * 8, caloric + selected.caloricProductOffsetWords
      + (2 * selected.caloricProductCapacity + i + 1) * 8)));
    const productInternal = products.reduce((sum, product, i) => sum + product.mass * scaled(chosenStates[i][4], 299), 0n);
    const productReference = products.reduce((sum, product, i) => sum + product.mass * scaled(bitsOf(terms[i + 2].uRef), 299), 0n);
    const delta = dyadic(bitsOf(entry.deltaPhysical));
    const formationShift = delta.coefficient === 0n ? 0 : 299 + delta.exponent - token.reactantWeightScale.exponent;
    check('formation-shift', shift === Math.max(-formationShift, 0));
    const totalEnergy = ((internal + sourceKinetic + productReference - sourceReference) * denominator << BigInt(shift))
      - (total * total * delta.coefficient << BigInt(Math.max(formationShift, 0)));
    const physicalResidual = totalEnergy - ((productInternal + projectedKinetic) * denominator << BigInt(shift));
    const correction = ((momentum.reduce((sum, value) => sum + value * value, 0n) - total * projectedKinetic)
      * token.reactantWeightSum * token.reactantWeightScale.coefficient) << BigInt(shift);
    const energyNames = ['comKineticCorrection', 'physicalEnergyResidual', 'productTotalEnergy'];
    const energyExpected = [correction, physicalResidual, totalEnergy];
    check('energy-layout', selected.productEnergyHeaderWords === 8 && selected.productEnergyWordCount === width
      && same(selected.productEnergyFields, energyNames));
    check('energy-ready', energyHeader[0] === 1 && energyHeader[1] === 0 && energyHeader[2] === shift
      && signedWord(energyHeader[3]) === quantum
      && energyHeader[4] === words[base + selected.extensiveOffsetWords + 3]
      && (energyHeader[4] & ~32) === 0 && energyHeader.slice(5).every(value => value === 0));
    evidence.productEnergy = energyNames.map((name, i) => {
      const actual = wide(energyAt + 8 + i * stride, name);
      check(`energy-${name}`, actual === energyExpected[i]);
      return { name, actual: String(actual), expected: String(energyExpected[i]),
        energyJ: rational(actual, denominator, quantum) };
    });
    evidence.nonzeroPhysicalEnergyResidual = physicalResidual !== 0n;
    evidence.nonzeroComKineticCorrection = correction !== 0n;
    if (expectedSpeciesError) {
      check('species-expected-rejection', header[0] === 0 && header[1] === expectedSpeciesError);
      return { ...evidence, matches: failures.length === 0 };
    }

    const termCapacity = layout.termCapacity, elementCapacity = layout.elementCapacity;
    check('species-layout', layout.headerWords === 16 && layout.wideWords === width
      && layout.wideRecordWords === stride && layout.denominatorOffsetWords === 16
      && layout.avogadroOffsetWords === 16 + stride && layout.termOffsetWords === 16 + 2 * stride
      && layout.termStrideWords === 16 + 3 * n + 4 * stride
      && layout.elementOffsetWords === layout.termOffsetWords + termCapacity * layout.termStrideWords
      && layout.elementStrideWords === 4 + stride
      && layout.recordWords === layout.elementOffsetWords + elementCapacity * layout.elementStrideWords);
    const molar = terms.map(term => {
      const value = dyadic(bitsOf(term.molarMass));
      if (value.coefficient <= 0n) throw new RangeError('Positive original molar mass required');
      while ((value.coefficient & 1n) === 0n) { value.coefficient >>= 1n; value.exponent++; }
      return value;
    });
    const exponent = Math.max(...molar.map(value => value.exponent));
    const lcm = molar.reduce((value, term) => value / gcd(value, term.coefficient) * term.coefficient, 1n);
    const moleExponent = selected.format.quantumExponent - exponent;
    const residualExponent = moleExponent - 149;
    const moleNumerators = molar.map((value, i) => masses[i] * (lcm / value.coefficient)
      << BigInt(exponent - value.exponent));
    const survivorNumerators = molar.map((value, i) => survivors[i] * (lcm / value.coefficient)
      << BigInt(exponent - value.exponent));
    check('species-ready', header[0] === 1 && header[1] === 0 && header[2] === terms.length
      && signedWord(header[4]) === moleExponent && signedWord(header[5]) === residualExponent
      && header[7] === termCapacity && header[8] === elementCapacity && header.slice(9).every(value => value === 0));
    check('molar-denominator', wide(at + layout.denominatorOffsetWords, 'molar-denominator') === lcm);
    check('exact-SI-Avogadro', wide(at + layout.avogadroOffsetWords, 'Avogadro') === NA);
    const elements = new Set([0]);
    const atomCoefficients = terms.map((term, i) => {
      const coefficients = new Map([[0, 0n]]);
      for (let index = 0; index < reactionTable.atomTermCount; index++) {
        const row = reactionTable.atomTermRecords.subarray(index * 8, (index + 1) * 8);
        if (row[0] !== token.reactionIndex || row[1] !== (i < 2 ? 1 : 2) || row[2] !== term.termIndex) continue;
        if (row[7] !== 1 || !Number.isInteger(row[3]) || row[3] < 1 || row[3] > 118) {
          throw new RangeError('Invalid original atom term');
        }
        elements.add(row[3]);
        coefficients.set(row[3], (coefficients.get(row[3]) ?? 0n) + scaled(bitsOf(row[4]), 149));
        coefficients.set(0, coefficients.get(0) + scaled(bitsOf(row[6]), 149));
      }
      return coefficients;
    });
    const zs = [...elements].sort((a, b) => a - b);
    check('element-count', header[3] === zs.length && zs.length <= elementCapacity);
    const fieldNames = ['selectedMolesNumerator', 'selectedEntitiesNumerator', 'survivingMolesNumerator', 'survivingEntitiesNumerator'];
    evidence.terms = terms.map((term, i) => {
      const start = at + layout.termOffsetWords + i * layout.termStrideWords;
      const raw = Array.from(words.slice(start, start + 16));
      const donor = i < 2, active = masses[i] !== 0n;
      check(`term-${i}-identity`, same(raw.slice(0, 3), [donor ? 1 : 2, term.termIndex, term.materialId])
        && raw[4] === Number(active) && raw[5] === bitsOf(term.molarMass)
        && raw[12] === 0 && raw[13] === Number(survivors[i] !== 0n) && raw.slice(14).every(value => value === 0));
      for (let field = 0; field < 3; field++) {
        check(`term-${i}-mass-${field}`, integer(words.slice(start + 16 + field * n, start + 16 + (field + 1) * n))
          === [masses[i], available[i], survivors[i]][field]);
      }
      const expected = [moleNumerators[i], moleNumerators[i] * NA, survivorNumerators[i], survivorNumerators[i] * NA];
      const quantities = fieldNames.map((name, field) => {
        const actual = wide(start + 16 + 3 * n + field * stride, `term-${i}-${name}`);
        check(`term-${i}-${name}`, actual === expected[field]);
        return { name, actual: String(actual), expected: String(expected[field]), rational: rational(actual, lcm, moleExponent) };
      });
      let volumes;
      if (donor) {
        const row = sourceRows[i], v0 = mechanicsWords[row * 32 + 19], j = mechanicsWords[row * 32 + 18];
        check(`term-${i}-original-donor-basis`, raw[6] === 0 && raw[7] === row && raw[8] === v0 && raw[9] === j
          && raw[10] === stateWords[row * 8 + 7] && raw[11] === bitsOf(term.uRef)
          && [1, 2, 3].includes(raw[3]));
        if (thermoWords) check(`term-${i}-source-phase`, bitsOf(raw[3]) === thermoWords[row * 12 + 1]);
        const rest = dyadic(v0), deformation = dyadic(j);
        volumes = [masses[i], survivors[i]].map(mass => ({
          referenceM3: rational(mass * rest.coefficient, available[i], rest.exponent),
          currentM3: rational(mass * rest.coefficient * deformation.coefficient, available[i], rest.exponent + deformation.exponent)
        }));
      } else {
        const state = chosenStates[i - 2], phase = products[i - 2].targetPhase;
        check(`term-${i}-product-volume-basis`, raw[3] === phase && raw[7] === 0xffffffff
          && raw[8] === 0 && raw[9] === 0
          && raw[6] === (active ? state[5] : 0) && raw[10] === (active ? state[4] : 0)
          && raw[11] === (active ? state[6] : 0));
        const volume = active ? ratioOfDyadics({ coefficient: masses[i], exponent: selected.format.quantumExponent }, dyadic(raw[6]))
          : rational(0n);
        volumes = { referenceM3: volume, currentM3: volume, deformationJ: 1 };
      }
      return { index: i, rawHeader: raw, mass: String(masses[i]), available: String(available[i]),
        survivor: String(survivors[i]), quantities, volumes };
    });
    check('unused-term-capacity-zero', Array.from(words.slice(at + layout.termOffsetWords + terms.length * layout.termStrideWords,
      at + layout.elementOffsetWords)).every(value => value === 0));
    let allZero = true;
    evidence.elements = zs.map((z, index) => {
      const expected = terms.reduce((sum, term, i) => sum + (i < 2 ? -1n : 1n)
        * moleNumerators[i] * (atomCoefficients[i].get(z) ?? 0n), 0n);
      allZero &&= expected === 0n;
      const offset = at + layout.elementOffsetWords + index * layout.elementStrideWords;
      const actual = wide(offset + 4, `element-${z}`);
      check(`element-${z}`, words[offset] === z && words[offset + 1] === 0
        && words[offset + 2] === Number(expected === 0n) && words[offset + 3] === 0 && actual === expected);
      return { z, actual: String(actual), expected: String(expected), exactZero: expected === 0n,
        residualMol: rational(actual, lcm, residualExponent) };
    });
    check('all-residuals-exact-zero', header[6] === Number(allZero));
    check('unused-element-capacity-zero', Array.from(words.slice(at + layout.elementOffsetWords + zs.length * layout.elementStrideWords,
      at + layout.recordWords)).every(value => value === 0));
    evidence.allSpeciesResidualsExactlyZero = allZero;
    evidence.hasNonzeroSpeciesResidual = !allZero;
    evidence.moleDenominator = String(lcm); evidence.moleExponent = moleExponent;
  } catch (error) {
    failures.push('independent-packet-reconstruction'); evidence.inspectionError = String(error.message ?? error);
  }
  return { ...evidence, matches: failures.length === 0 };
}
