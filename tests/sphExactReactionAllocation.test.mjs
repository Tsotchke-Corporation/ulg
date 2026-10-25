import assert from 'node:assert/strict';
import test from 'node:test';
import { createSphExactMassFormat } from '../ulg-gpu-abi/src/sphExactMassInventory.js';
import { compileSphExactReactionAllocation, resolveSphExactReactionAllocation,
  encodeSphExactReactionAllocationWeights, selectSphExactReactionAllocation }
  from '../src/runtime/sph/sphExactReactionAllocation.js';
import { createSphExactReactionAllocationWgsl } from '../src/runtime/sph/sphExactReactionAllocationWgsl.js';
import { createExactReactionAllocationFixture, exactReactionAllocationCases }
  from './fixtures/sphExactReactionAllocationNative.js';

function compile(options = {}, format = createSphExactMassFormat()) {
  const fixture = createExactReactionAllocationFixture(options);
  const compiled = compileSphExactReactionAllocation({ ...fixture, format, reactionIndex: (options.reactionCount ?? 1) - 1 });
  return { ...fixture, compiled, format };
}
const units = words => [...words].reverse().reduce((value, word) => (value << 32n) | BigInt(word), 0n);

test('cold compiler preserves global term IDs and repeated material products', () => {
  const { compiled } = compile({ reactionCount: 2 });
  assert.deepEqual(compiled.reactants.map(term => term.termIndex), [2, 3]);
  assert.deepEqual(compiled.products.map(term => term.termIndex), [3, 4, 5]);
  assert.equal(compiled.products[1].materialId, compiled.products[2].materialId);
  assert.ok(Object.isFrozen(compiled) && Object.isFrozen(compiled.products[1]));
  assert.equal(compiled.physicalPublicationAdmitted, false);
  const packed = encodeSphExactReactionAllocationWeights(compiled), n = compiled.format.wordCount;
  assert.deepEqual([...packed.subarray(1, 8)], [1, n, 1, 3, 2, 3, 0]);
  assert.equal(units(packed.subarray(8, 8 + n)), compiled.reactants[0].weight);
  assert.equal(units(packed.subarray(8 + 2 * n, 8 + 3 * n)), compiled.productWeightSum);
  packed.fill(0);
  assert.notEqual(encodeSphExactReactionAllocationWeights(compiled)[0], 0);
});

test('weight products retain bits lost by independently rounded f32 multiplication', () => {
  const { compiled } = compile();
  const first = compiled.reactants[0], scale = compiled.reactantWeightScale;
  const exactNumber = Number(first.weight * scale.coefficient) * 2 ** scale.exponent;
  assert.equal(exactNumber, first.coefficient * first.molarMass);
  assert.notEqual(exactNumber, Math.fround(first.coefficient * first.molarMass));
});

test('copied compiler tokens, copied tables, mismatched formats and changed array contents reject', () => {
  const { compiled, reactionTable, thermalMaterialTable, format } = compile();
  assert.throws(() => resolveSphExactReactionAllocation({ ...compiled }), /original compiler token/);
  assert.throws(() => compileSphExactReactionAllocation({ reactionTable: { ...reactionTable }, thermalMaterialTable,
    reactionIndex: 0, format }), /unissued or copied/);
  assert.throws(() => resolveSphExactReactionAllocation(compiled, { format: createSphExactMassFormat() }), /original format/);
  assert.throws(() => resolveSphExactReactionAllocation(compiled, { reactionTable: { ...reactionTable } }), /original reactionTable/);
  const old = reactionTable.productTermRecords[2]; reactionTable.productTermRecords[2] = old + 1;
  reactionTable.productTermRecords.every = () => true;
  assert.throws(() => encodeSphExactReactionAllocationWeights(compiled), /snapshot changed/);
});

test('replacement arrays, accessor substitution and thermal edits invalidate compiler seal', () => {
  let fixture = compile();
  fixture.reactionTable.records = fixture.reactionTable.records.slice();
  assert.throws(() => resolveSphExactReactionAllocation(fixture.compiled), /snapshot changed/);
  fixture = compile(); let getterCalls = 0;
  Object.defineProperty(fixture.reactionTable, 'records', { get() { getterCalls++; throw new Error('getter'); } });
  assert.throws(() => resolveSphExactReactionAllocation(fixture.compiled), /snapshot changed/);
  assert.equal(getterCalls, 0);
  fixture = compile(); fixture.thermalMaterialTable.records[0] += 1;
  fixture.thermalMaterialTable.records.every = () => true;
  assert.throws(() => resolveSphExactReactionAllocation(fixture.compiled), /snapshot changed/);
});

test('dimensionless weight width rejects exponent spread and cumulative overflow explicitly', () => {
  const oneWord = createSphExactMassFormat({ wordCount: 1 });
  assert.throws(() => compile({ identity: true, coefficients: [2 ** -100, 1] }, oneWord), /weight exceeds/);
  const wide = compile({ identity: true, coefficients: [2 ** -100, 1] });
  assert.ok(wide.compiled.reactantWeightSum > 0xffffffffn);
  assert.throws(() => compile({ identity: true, coefficients: [1 + 2 ** -15, 3 - 2 ** -21],
    molarMasses: { h2: 1 + 2 ** -15, o2: 1 } }, oneWord), /cumulative weight exceeds/);
});

test('exact availability and kinetic bound select the greatest feasible shared total', () => {
  const { compiled } = compile();
  const [wa, wb] = compiled.reactants.map(term => term.weight), denominator = wa + wb;
  for (let a = 0n; a < 14n; a++) for (let b = 0n; b < 14n; b++) for (let cap = 0n; cap < 29n; cap++) {
    let chosen = 0n;
    for (let total = 0n; total <= a + b && total <= cap; total++) {
      const da = total * wa / denominator;
      if (da <= a && total - da <= b) chosen = total;
    }
    if (chosen * wa / denominator === 0n || chosen - chosen * wa / denominator === 0n) chosen = 0n;
    const result = selectSphExactReactionAllocation(compiled, { availableA: a, availableB: b, kineticCap: cap });
    assert.equal(result.total, chosen);
    assert.equal(result.debitA + result.remainderA, a);
    assert.equal(result.debitB + result.remainderB, b);
  }
});

test('exact zero, positive remainder, inactive one-reactant debit and aggregate overflow remain distinct', () => {
  const { compiled, format } = compile();
  const [a, b] = compiled.reactants.map(term => term.weight);
  let result = selectSphExactReactionAllocation(compiled, { availableA: a, availableB: b, kineticCap: a + b });
  assert.equal(result.active, true); assert.equal(result.remainderA, 0n); assert.equal(result.remainderB, 0n);
  result = selectSphExactReactionAllocation(compiled, { availableA: a + 1n, availableB: b + 1n, kineticCap: a + b });
  assert.equal(result.remainderA, 1n); assert.equal(result.remainderB, 1n);
  result = selectSphExactReactionAllocation(compiled, { availableA: 100n, availableB: 100n, kineticCap: 1n });
  assert.equal(result.active, false); assert.equal(result.total, 0n); assert.equal(result.remainderB, 100n);
  result = selectSphExactReactionAllocation(compiled, { availableA: (1n << BigInt(format.wordCount * 32)) - 1n,
    availableB: 1n, kineticCap: 1n });
  assert.equal(result.error, 1); assert.equal(result.active, false);
});

test('all chosen products and donor contributions sum exactly for the native matrix', () => {
  for (const wordCount of [1, 9, 66]) {
    const { compiled, format } = compile({}, createSphExactMassFormat({ wordCount }));
    for (const row of exactReactionAllocationCases(format, compiled)) {
      const result = selectSphExactReactionAllocation(compiled, row);
      assert.equal(result.products.reduce((sum, product) => sum + product.mass, 0n), result.total, row.name);
      assert.equal(result.products.reduce((sum, product) => sum + product.fromA, 0n), result.debitA, row.name);
      assert.equal(result.products.reduce((sum, product) => sum + product.fromB, 0n), result.debitB, row.name);
      for (const product of result.products) assert.equal(product.fromA + product.fromB, product.mass);
    }
    assert.throws(() => selectSphExactReactionAllocation(compiled, { availableA: 1, availableB: 1n, kineticCap: 1n }), /outside inventory width/);
  }
});

test('native vectors distinguish feasible caps, zero-required inactivity and unchanged availability fallback', () => {
  for (const wordCount of [1, 9, 66]) {
    const { compiled, format } = compile({}, createSphExactMassFormat({ wordCount,
      quantumExponent: wordCount === 66 ? -1074 : -149 }));
    const cases = exactReactionAllocationCases(format, compiled);
    const evaluate = name => {
      const input = cases.find(row => row.name === name);
      assert.ok(input, name);
      return { input, result: selectSphExactReactionAllocation(compiled, input) };
    };
    for (const name of ['partial-hidden-remainders', 'full-width-feasible-cap']) {
      const { input, result } = evaluate(name);
      assert.equal(result.error, 0); assert.equal(result.active, true);
      assert.equal(result.total, input.kineticCap);
      assert.equal(result.debitA + result.remainderA, input.availableA);
      assert.equal(result.debitB + result.remainderB, input.availableB);
    }
    const wide = evaluate('full-width-feasible-cap').result;
    assert.equal(wide.total, (1n << BigInt(wordCount * 32)) - 1n);
    assert.equal(wide.remainderA, 0n); assert.equal(wide.remainderB, 0n);
    for (const name of ['zero-cap', 'one-quantum-no-event', 'availability-b']) {
      const { input, result } = evaluate(name);
      assert.equal(result.active, false); assert.equal(result.total, 0n);
      assert.equal(result.remainderA, input.availableA); assert.equal(result.remainderB, input.availableB);
    }
    for (const name of ['availability-a', 'availability-b-active']) {
      const { input, result } = evaluate(name);
      assert.equal(result.active, true); assert.ok(result.total < input.kineticCap);
      const next = result.total + 1n, nextA = next * compiled.reactants[0].weight / compiled.reactantWeightSum;
      assert.ok(nextA > input.availableA || next - nextA > input.availableB, 'next total is infeasible');
    }
    assert.equal(evaluate('aggregate-overflow').result.error, 1, 'small cap cannot bypass source aggregate overflow');
  }
});

test('WGSL cap shortcut follows aggregate/weight validation and precedes the original greedy fallback', () => {
  const code = createSphExactReactionAllocationWgsl(createSphExactMassFormat(), { includeMassLibrary: false });
  const start = code.indexOf('fn er_select_debits('), fast = code.indexOf('let capped_a = em_multiply_ratio(cap,');
  const greedy = code.indexOf('var power: ExactMass;');
  assert.ok(start < fast && fast < greedy);
  const checks = code.slice(start, fast), direct = code.slice(fast, greedy);
  assert.ok(checks.includes('available.error | denominator.error') && checks.includes('em_zero(weight_a) || em_zero(weight_b)'));
  assert.ok(direct.includes('em_compare(capped_a.value, available_a) <= 0')
    && direct.includes('em_compare(capped_b.value, available_b) <= 0'));
  assert.ok(direct.includes('em_zero(capped_a.value) || em_zero(capped_b.value)'));
  assert.ok(direct.includes('return ExactReactionDebits(cap, capped_a.value, capped_b.value,'));
  assert.ok(code.slice(greedy).includes('for (var bit = highest; bit >= 0; bit--)'));
});

test('WGSL composes with the original mass library without declaring public bindings', () => {
  const format = createSphExactMassFormat(), full = createSphExactReactionAllocationWgsl(format);
  const helpers = createSphExactReactionAllocationWgsl(format, { includeMassLibrary: false });
  assert.equal(full.match(/fn em_multiply_ratio/g).length, 1);
  assert.equal(helpers.includes('fn em_multiply_ratio'), false);
  assert.equal(full.includes('@binding'), false);
  assert.ok(helpers.includes('fn er_select_debits') && helpers.includes('fn er_product_share'));
});
