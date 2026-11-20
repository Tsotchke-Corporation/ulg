import assert from 'node:assert/strict';
import test from 'node:test';
import { sphThermalStepWgsl } from '../src/runtime/sph/sphThermalGpuKernel.js';
import {
  appendSphExactThermalEnergyWgsl, sphExactThermalEnergyRecordWords,
  SPH_EXACT_THERMAL_ENERGY_WORDS, SPH_EXACT_THERMAL_ENERGY_CONTROL_WORDS
} from '../src/runtime/sph/sphExactThermalEnergyWgsl.js';

test('the default thermal step carries no energy ledger binding', () => {
  assert.doesNotMatch(sphThermalStepWgsl, /exact_energy_rows/);
  assert.match(sphThermalStepWgsl, /&& thermal_bins\[6u\] == 0u\n/);
});

test('the energy ledger variant requires the integer proposal section and owns one record binding', () => {
  const code = appendSphExactThermalEnergyWgsl(sphThermalStepWgsl);
  assert.match(code, /@binding\(11\) var<storage, read_write> exact_energy_rows: array<atomic<u32>>;/);
  assert.match(code, new RegExp(`&& thermal_bins\\[6u\\] == ${SPH_EXACT_THERMAL_ENERGY_WORDS}u\\n`));
  assert.doesNotMatch(code, /&& thermal_bins\[6u\] == 0u\n/);
  // A row that failed validation is recorded as a ledger error, not dropped.
  assert.match(code, /conduction_du = proposed_pair_du;\n\t        exact_row_admitted = true;/);
  // Sources are what the f32 kernel added after the pair exchange.
  assert.match(code, /\t  \}\n\t  let exact_du_before_sources = du;\n/);
  const finish = code.indexOf('next_u = thermal_exact_energy_finish(');
  const write = code.indexOf('out_sph_state[particle_index * 2u + 1u] = vec4<f32>(vel_u.x, vel_u.y, vel_u.z, next_u);');
  assert.ok(finish > 0 && finish < write, 'the ledger projection replaces u before it is written');
  assert.match(code, /errors \|= 1u;/);
  // Outside the domain beyond rounding is flagged; the f32 view is held 4
  // ulps inside the domain, and the f32 path's u is preferred within 8 ulps.
  assert.match(code, /if \(\(next_u >= 0\.0\) != \(bound >= 0\.0\) \|\| ulps > 4\) \{\n\s*thermal_energy_fail\(4u\);/);
  assert.match(code, /return clamp\(next_u, inner_lo, inner_hi\);/);
  assert.match(code, /fallback_ulps <= 8\);/);
});

test('energy ledger variant refuses a drifted thermal kernel', () => {
  assert.throws(() => appendSphExactThermalEnergyWgsl('fn main() {}'), /anchor drifted: binding 11/);
  const doubled = sphThermalStepWgsl.replace('\t  var conduction_du = 0.0;\n',
    '\t  var conduction_du = 0.0;\n\t  var conduction_du = 0.0;\n');
  assert.throws(() => appendSphExactThermalEnergyWgsl(doubled), /row admission declaration/);
});

test('an energy record holds U rows, S rows and control words', () => {
  assert.equal(sphExactThermalEnergyRecordWords(3), 2 * 3 * SPH_EXACT_THERMAL_ENERGY_WORDS
    + SPH_EXACT_THERMAL_ENERGY_CONTROL_WORDS);
  assert.throws(() => sphExactThermalEnergyRecordWords(0), /positive row count/);
});
