// Independent native readback oracle. No production routing shader, codec,
// layout constructor, or owner registrar participates in these expectations.
const INVALID_RATIO = 8192;
const NONE = 0xffffffff;
const integer = words => {
  let value = 0n;
  for (let i = words.length - 1; i >= 0; i--) value = (value << 32n) | BigInt(words[i]);
  return value;
};
const allZero = values => Array.from(values).every(value => value === 0);
const same = (a, b) => a.length === b.length && a.every((value, i) => value === b[i]);

/** Inspect candidate routing over original source readback and independently
 * selected allocation. Product order comes from the original packed reaction
 * table (stable condensed-before-gas), never from output route descriptors.
 * Every packet basis remains referenced, rather than projected or recopied.
 */
export function inspectExactReactionRouting({ sourceWords, routingWords, selected, layout,
  base = 0, routeBase = (base / selected.recordWords) * layout.recordWords,
  token = null, allocation = null, orderWords = null, reactionTable = null, expectedError = null }) {
  const failures = [];
  const check = (name, value) => { if (!value) failures.push(name); return Boolean(value); };
  const n = selected.format.wordCount, rowStride = 8 + n, capacity = layout.productCapacity;
  const expectedRecord = 16 + (2 + capacity) * rowStride;
  if (!Number.isSafeInteger(base) || base < 0 || base % selected.recordWords !== 0
      || !Number.isSafeInteger(routeBase) || routeBase < 0
      || base + selected.recordWords > sourceWords.length || routeBase + expectedRecord > routingWords.length) {
    throw new RangeError('Exact routing inspection bounds');
  }
  check('layout', layout.headerWords === 16 && layout.recordWords === expectedRecord
    && layout.massWordCount === n && layout.endpointOffsetWords === 16
    && layout.endpointCount === 2 && layout.endpointStrideWords === rowStride
    && layout.residualOffsetWords === 16 + 2 * rowStride && layout.residualStrideWords === rowStride);
  const pair = base / selected.recordWords;
  const header = Array.from(routingWords.slice(routeBase, routeBase + 16));
  const sourceHeader = Array.from(sourceWords.slice(base, base + 12));
  const evidence = { header, sourceHeader, failures, physicalPublicationAdmitted: false };
  check('physical-publication-closed', header[8] === 0 && selected.physicalPublicationAdmitted === false);
  const wholeRoute = routingWords.slice(routeBase, routeBase + expectedRecord);
  if (sourceHeader[0] === 0 && sourceHeader[1] === 0) {
    check('inactive-row-clear', allZero(wholeRoute));
    check('inactive-expectation', expectedError === null || expectedError === 0);
    return { ...evidence, inactive: true, matches: failures.length === 0 };
  }
  const caloric = base + selected.caloricOffsetWords;
  const energy = base + selected.productEnergyOffsetWords;
  const species = base + selected.speciesOffsetWords;
  const sourceError = (sourceHeader[1] | sourceWords[caloric + 1]
    | sourceWords[energy + 1] | sourceWords[species + 1]) >>> 0;
  const sourceReady = sourceHeader[0] === 1 && sourceHeader[11] === 0
    && sourceWords[caloric] === 1 && sourceWords[energy] === 1 && sourceWords[species] === 1 && sourceError === 0;
  const rejection = expectedError ?? (sourceReady ? 0 : sourceError || INVALID_RATIO);
  if (rejection !== 0) {
    check('rejection-error', header[0] === 0 && header[1] === rejection);
    check('rejection-clears-complete-payload', allZero(wholeRoute.slice(2)));
    return { ...evidence, rejected: true, matches: failures.length === 0 };
  }
  check('source-ready', sourceReady);
  if (!token || !allocation || !reactionTable || !orderWords) {
    throw new TypeError('Ready routing inspection requires original token/table/order and independent allocation');
  }
  const products = token.products, count = products.length;
  const donorRows = sourceHeader.slice(2, 4), peer = Math.max(...donorRows);
  const donorMasses = [allocation.debitA, allocation.debitB];
  const survivors = [allocation.remainderA, allocation.remainderB];
  const available = donorMasses.map((value, i) => value + survivors[i]);
  check('original-pair-identity', Math.min(...donorRows) === pair && donorRows[0] !== donorRows[1]
    && donorRows.every(value => value < selected.particleCount) && sourceHeader[4] === token.reactionIndex);
  check('independent-allocation-active', allocation.active === true && allocation.error === 0
    && allocation.total > 0n && donorMasses.every(value => value > 0n)
    && donorMasses[0] + donorMasses[1] === allocation.total);
  check('source-product-count', sourceHeader[5] === count && count > 0 && count <= capacity
    && allocation.products.length === count && sourceWords[species + 2] === count + 2);
  const sourceMass = offset => integer(sourceWords.slice(offset, offset + n));
  [allocation.total, ...donorMasses, ...survivors].forEach((mass, i) => {
    check(`source-amount-${i}`, sourceMass(base + 12 + i * n) === mass);
  });
  const tableStride = reactionTable.productTermStrideFloats;
  check('original-product-table-stride', tableStride === 16);
  const priority = products.map((product, local) => {
    const at = product.termIndex * tableStride, records = reactionTable.productTermRecords;
    check(`original-term-${local}`, records[at] === token.reactionIndex
      && records[at + 1] === product.materialId && records[at + 7] === 1);
    return { local, gas: records[at + 5] >= 0.5 };
  }).sort((a, b) => Number(a.gas) - Number(b.gas) || a.local - b.local).map(item => item.local);
  const metadataBase = token.reactionIndex * (capacity + 1);
  check('original-routing-order', orderWords[metadataBase] === count
    && priority.every((local, i) => orderWords[metadataBase + 1 + i] === local)
    && Array.from(orderWords.slice(metadataBase + 1 + count, metadataBase + 1 + capacity))
      .every(value => value === NONE));
  check('unique-global-product-terms', new Set(products.map(product => product.termIndex)).size === count);
  products.forEach((product, local) => {
    const at = base + 12 + 7 * n + local * (4 + 3 * n), expected = allocation.products[local];
    check(`source-product-${local}`, same(Array.from(sourceWords.slice(at, at + 4)),
      [product.termIndex, product.materialId, product.targetPhase, 0])
      && expected.termIndex === product.termIndex && expected.materialId === product.materialId
      && sourceMass(at + 4) === expected.mass && sourceMass(at + 4 + n) === expected.fromA
      && sourceMass(at + 4 + 2 * n) === expected.fromB && expected.fromA + expected.fromB === expected.mass);
  });
  const terms = [...token.reactants, ...products];
  const speciesLayout = selected.speciesLayout;
  const speciesAt = ordinal => species + speciesLayout.termOffsetWords + ordinal * speciesLayout.termStrideWords;
  const activeProducts = priority.filter(local => allocation.products[local].mass > 0n);
  const destinations = [pair, peer];
  const donorOrdinals = destinations.map(row => donorRows.indexOf(row));
  const freeMask = donorOrdinals.reduce((mask, donor, slot) => mask | (survivors[donor] === 0n ? 1 << slot : 0), 0);
  const freeSlots = destinations.map((_, slot) => slot).filter(slot => (freeMask & (1 << slot)) !== 0);
  const assignments = new Map(freeSlots.map((slot, rank) => [slot,
    count === 1 && freeMask === 3 ? 0 : activeProducts[rank]]));
  let directMask = 0;
  const expectedEndpoints = destinations.map((destination, slot) => {
    const donor = donorOrdinals[slot];
    let kind = 0, ordinal = NONE, mass = 0n;
    if (survivors[donor] > 0n) { kind = 1; ordinal = donor; mass = survivors[donor]; }
    else if (assignments.get(slot) !== undefined) {
      kind = 2; ordinal = assignments.get(slot) + 2;
      mass = count === 1 && freeMask === 3 ? donorMasses[donor] : allocation.products[ordinal - 2].mass;
      directMask |= 1 << slot;
    }
    const term = kind ? terms[ordinal] : null;
    return { kind, ordinal, mass, donor, descriptor: [kind, destination, pair, ordinal,
      term?.termIndex ?? NONE, term?.materialId ?? 0, mass > 0n ? 1 : 0, 0] };
  });
  check('pair-header', same(header, [1, 0, pair, peer, token.reactionIndex, count, freeMask, directMask, 0, 0, 0, 0, 0, 0, 0, 0]));
  const endpoints = expectedEndpoints.map((expected, slot) => {
    const at = routeBase + 16 + slot * rowStride;
    const descriptor = Array.from(routingWords.slice(at, at + 8));
    const mass = integer(routingWords.slice(at + 8, at + 8 + n));
    check(`endpoint-${slot}-descriptor`, same(descriptor, expected.descriptor));
    check(`endpoint-${slot}-mass`, mass === expected.mass);
    let basis = null;
    if (expected.kind) {
      const termAt = speciesAt(expected.ordinal);
      const term = terms[expected.ordinal];
      check(`endpoint-${slot}-original-basis`, sourceWords[termAt] === expected.kind
        && sourceWords[termAt + 1] === term.termIndex && sourceWords[termAt + 2] === term.materialId);
      if (expected.kind === 1) {
        check(`endpoint-${slot}-survivor-basis`, sourceWords[termAt + 7] === destinations[slot]
          && sourceMass(termAt + 16 + n) === available[expected.donor]
          && sourceMass(termAt + 16 + 2 * n) === expected.mass);
        basis = { kind: 'original-donor-survivor', sourcePairRow: pair, speciesOrdinal: expected.ordinal,
          sourceRow: destinations[slot], fractionNumerator: String(mass), fractionDenominator: String(available[expected.donor]) };
      } else {
        basis = { kind: 'selected-product-fragment', sourcePairRow: pair, speciesOrdinal: expected.ordinal,
          fractionNumerator: String(mass), pairMomentumDenominator: String(allocation.total),
          productQuantityDenominator: String(allocation.products[expected.ordinal - 2].mass) };
      }
    }
    return { descriptor, mass: String(mass), expectedMass: String(expected.mass), basis };
  });
  let residualSum = 0n;
  const residuals = products.map((product, local) => {
    const expectedDirect = expectedEndpoints.filter(endpoint => endpoint.kind === 2 && endpoint.ordinal === local + 2)
      .reduce((sum, endpoint) => sum + endpoint.mass, 0n);
    const expectedMass = allocation.products[local].mass - expectedDirect;
    const at = routeBase + 16 + (2 + local) * rowStride;
    const descriptor = Array.from(routingWords.slice(at, at + 8));
    const mass = integer(routingWords.slice(at + 8, at + 8 + n));
    residualSum += mass;
    check(`residual-${local}-descriptor`, same(descriptor,
      [pair, local + 2, product.termIndex, product.materialId, expectedMass > 0n ? 1 : 0, 0, 0, 0]));
    check(`residual-${local}-mass`, expectedMass >= 0n && mass === expectedMass);
    const actualDirect = endpoints.filter(endpoint => endpoint.descriptor[0] === 2 && endpoint.descriptor[3] === local + 2)
      .reduce((sum, endpoint) => sum + BigInt(endpoint.mass), 0n);
    check(`product-${local}-exact-partition`, actualDirect + mass === allocation.products[local].mass);
    return { descriptor, mass: String(mass), expectedMass: String(expectedMass),
      basis: { kind: 'selected-product-fragment', sourcePairRow: pair, speciesOrdinal: local + 2,
        fractionNumerator: String(mass), pairMomentumDenominator: String(allocation.total),
        productQuantityDenominator: String(allocation.products[local].mass) } };
  });
  check('unused-capacity-clear', allZero(routingWords.slice(routeBase + 16 + (2 + count) * rowStride,
    routeBase + expectedRecord)));
  const routedTotal = residualSum + endpoints.reduce((sum, endpoint) => sum + BigInt(endpoint.mass), 0n);
  check('complete-inventory-partition', routedTotal === available[0] + available[1]);
  return { ...evidence, endpoints, residuals, routedTotal: String(routedTotal),
    sourceTotal: String(available[0] + available[1]), matches: failures.length === 0 };
}
