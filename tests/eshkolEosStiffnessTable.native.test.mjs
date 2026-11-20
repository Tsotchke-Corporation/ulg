// The cached Eshkol-derived stiffness table the GPU solve evaluates
// (src/runtime/material/eshkolEosStiffnessTable.js) must be what Eshkol
// derives today: re-derive it in the client-side warm VM and compare.
//
// Run: ULG_RUN_NATIVE_ESHKOL_EOS=1 node --test tests/eshkolEosStiffnessTable.native.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import { ESHKOL_TAIT_STIFFNESS_TABLE } from '../src/runtime/material/eshkolEosStiffnessTable.js';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_ESHKOL_EOS === '1';

test('the cached Eshkol stiffness table matches a fresh Eshkol derivation', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_ESHKOL_EOS=1 to run against the Eshkol WASM worker',
  timeout: 300_000
}, async () => {
  const { deriveDimensionlessTaitStiffness } = await import('../scripts/derive-eshkol-eos-stiffness-table.mjs');
  const fresh = await deriveDimensionlessTaitStiffness(process.env.ULG_ESHKOL_EOS_BASE_URL);
  assert.deepEqual(fresh.domain, [...ESHKOL_TAIT_STIFFNESS_TABLE.domain]);
  assert.equal(fresh.coefficients.length, ESHKOL_TAIT_STIFFNESS_TABLE.coefficients.length);
  fresh.coefficients.forEach((c, j) => assert.ok(Math.abs(c - ESHKOL_TAIT_STIFFNESS_TABLE.coefficients[j]) <= 1e-12,
    `coefficient ${j}: ${c} vs cached ${ESHKOL_TAIT_STIFFNESS_TABLE.coefficients[j]}`));
  assert.ok(fresh.relativeBound <= 1e-9);
  assert.ok(fresh.crossCheck <= 1e-12);
});
