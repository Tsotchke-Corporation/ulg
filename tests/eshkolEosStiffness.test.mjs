import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ESHKOL_EOS_MODEL,
  deriveEosStiffnessResponse,
  eshkolEosProgram
} from '../src/runtime/material/eshkolEosStiffness.js';
import { evaluateResponseFunction } from '../src/runtime/material/localClosureFitCache.js';

// A JS stand-in for the Eshkol worker's 'sample' request: the closed form.
const closedFormSampler = (program) => async (definition, call, points) => {
  assert.equal(call, 'eos-stiffness');
  assert.match(definition, /\(derivative eos-pressure rho\)/);
  return points.map(([rho]) => program.closedForm(rho));
};

for (const [name, eosModel] of Object.entries(ESHKOL_EOS_MODEL)) {
  test(`EOS stiffness response fits the ${name} derivative within tolerance`, async () => {
    const params = { eosModel, restDensityKgPerM3: 998, soundSpeedMPerS: 12 };
    const program = eshkolEosProgram(params);
    const derived = await deriveEosStiffnessResponse({ ...params, sample: closedFormSampler(program) });
    assert.equal(derived.crossCheckMaxRelativeError, 0);
    assert.ok(derived.sampleCount >= 11);
    for (const rho of [0.92 * 998, 998, 1.07 * 998]) {
      const r = evaluateResponseFunction(derived.responseFunction, [rho]);
      assert.equal(r.ok, true);
      assert.ok(Math.abs(r.value - program.closedForm(rho)) / program.closedForm(rho) <= 1e-6, `${name} at ${rho}`);
    }
    assert.equal(evaluateResponseFunction(derived.responseFunction, [1.2 * 998]).ok, false, 'never extrapolates');
  });
}

test('EOS stiffness derivation rejects a sampler that disagrees with itself across passes', async () => {
  const params = { eosModel: ESHKOL_EOS_MODEL.TAIT, restDensityKgPerM3: 998, soundSpeedMPerS: 12 };
  await assert.rejects(deriveEosStiffnessResponse({ ...params, sample: async (d, c, points) => points.slice(1).map(() => 1) }),
    /incomplete or non-finite/);
  assert.throws(() => eshkolEosProgram({ eosModel: 9, restDensityKgPerM3: 1, soundSpeedMPerS: 1 }), /unsupported/);
});
