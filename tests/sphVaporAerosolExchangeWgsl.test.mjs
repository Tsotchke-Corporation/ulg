import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as ABI from '../ulg-gpu-abi/src/sphVaporAerosolExchange.js';
import { sphVaporAerosolExchangeWgsl as shader }
  from '../src/runtime/sph/sphVaporAerosolExchangeWgsl.js';

// These are ABI/shader contract checks and independent manufactured arithmetic,
// NOT a CPU implementation of the production writer or a native GPU substitute.
// Native tests exercise actual source copies, WGSL output and lifecycle.
const block = (name) => shader.slice(shader.indexOf(`fn ${name}(`),
  shader.indexOf('\n}\n', shader.indexOf(`fn ${name}(`)) + 3);
const near = (actual, expected, budget = 1e-11) => assert.ok(
  Math.abs(actual - expected) <= budget * Math.max(1, Math.abs(expected)),
  `${actual} differs from ${expected}`
);

test('candidate ABI has seven bindings and exact strides without new authority claims', () => {
  assert.equal(ABI.SPH_VAPOR_AEROSOL_EXCHANGE_PARAM_WORDS, 32);
  assert.equal(ABI.SPH_VAPOR_AEROSOL_EXCHANGE_EDGE_WORDS, 8);
  assert.equal(ABI.SPH_VAPOR_AEROSOL_EXCHANGE_MATERIAL_FLOATS, 16);
  assert.equal(ABI.SPH_VAPOR_AEROSOL_EXCHANGE_SURFACE_FLOATS, 4);
  assert.equal(ABI.SPH_VAPOR_AEROSOL_EXCHANGE_CONTROL_HEADER_WORDS, 16);
  assert.match(shader, /struct ExchangeParams \{ words: array<vec4<u32>, 8>, \}/);
  assert.deepEqual([...shader.matchAll(/@binding\((\d+)\)/g)].map((m) => +m[1]), [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual([...shader.matchAll(/var<storage, read_write> (\w+)/g)].map((m) => m[1]),
    ['candidate', 'surfaces', 'control']);
  assert.doesNotMatch(shader, /source\[[^\]]+\]\s*=(?!=)/);
  assert.doesNotMatch(shader, /(?:dt_seconds|kinetic_rate|saturation_pressure|nucleation_rate)/);
  assert.match(ABI.ULG_SPH_VAPOR_AEROSOL_EXCHANGE_SCHEMA, /conservative-candidate/);
});

test('uniform scalar mapping includes independent output count generation and seal', () => {
  assert.deepEqual(ABI.SPH_VAPOR_AEROSOL_EXCHANGE_PARAM_OFFSETS, {
    PARTICLE_COUNT: 0, PRODUCT_CAPACITY: 1, AEROSOL_CAPACITY: 2, EDGE_COUNT: 3,
    MATERIAL_COUNT: 4, STATE_OFFSET: 5, THERMO_OFFSET: 6, MECHANICS_OFFSET: 7,
    PRODUCT_OFFSET: 8, PARCEL_OFFSET: 9, EOS_CONTROL_OFFSET: 10, COMPACT_OFFSET: 11,
    CALORIC_CELLS_OFFSET: 12, PRODUCT_COUNT_OFFSET: 13, EXPECTED_EOS_GENERATION: 14,
    COMPACT_CAPACITY: 15, CALORIC_CELL_CAPACITY: 16, SOURCE_WORD_COUNT: 17,
    PRODUCT_COUNT_PRESENT: 18, OUTPUT_COUNT_GENERATION: 19, OUTPUT_COUNT_SEAL: 20,
    SOURCE_COUNT_GENERATION: 21, SOURCE_COUNT_SEAL: 22
  });
  assert.match(block('xlayout'), /lane = 23u; lane < 32u/);
  assert.match(block('xlayout'), /xp\(13u\) % 64u != 0u/);
});

test('typed edge and material lanes preserve separate heat/work and surface inputs', () => {
  assert.deepEqual(ABI.SPH_VAPOR_AEROSOL_EXCHANGE_EDGE_OFFSETS, {
    GAS_KIND: 0, GAS_INDEX: 1, PARCEL_INDEX: 2, MATERIAL_ROW: 3,
    DELTA_MASS: 4, ENTHALPY_CORRECTION: 5, CONDUCTIVE_HEAT: 6, PRESSURE_WORK_INTO_LIQUID: 7
  });
  assert.deepEqual(Object.values(ABI.SPH_VAPOR_AEROSOL_EXCHANGE_MATERIAL_OFFSETS),
    Array.from({ length: 16 }, (_, index) => index));
  assert.deepEqual(ABI.SPH_VAPOR_AEROSOL_EXCHANGE_SURFACE_OFFSETS,
    { OLD_AREA: 0, OLD_INTERNAL_ENERGY: 1, NEW_AREA: 2, NEW_INTERNAL_ENERGY: 3 });
  assert.equal(ABI.SPH_VAPOR_AEROSOL_EXCHANGE_GAS_KIND.PARTICLE, 0);
  assert.equal(ABI.SPH_VAPOR_AEROSOL_EXCHANGE_GAS_KIND.UNPLACED_PRODUCT, 1);
});

test('error masks are frozen independent bits and exported into the actual shader', () => {
  assert.ok(Object.isFrozen(ABI.SPH_VAPOR_AEROSOL_EXCHANGE_ERROR));
  const values = Object.values(ABI.SPH_VAPOR_AEROSOL_EXCHANGE_ERROR);
  assert.equal(new Set(values).size, 15);
  for (const [name, value] of Object.entries(ABI.SPH_VAPOR_AEROSOL_EXCHANGE_ERROR)) {
    assert.equal(value & (value - 1), 0);
    assert.match(shader, new RegExp(`const ERROR_${name}: u32 = ${value}u;`));
  }
  assert.equal(ABI.SPH_VAPOR_AEROSOL_EXCHANGE_EDGE_FAILURE, 0x80000000);
});

test('GPU stages separate complete initialization, disjoint apply and final admission', () => {
  assert.match(shader, /@compute @workgroup_size\(1\)\nfn initialize_vapor_aerosol_exchange/);
  assert.match(shader, /@compute @workgroup_size\(64\)\nfn apply_vapor_aerosol_exchange/);
  assert.match(shader, /@compute @workgroup_size\(1\)\nfn finalize_vapor_aerosol_exchange/);
  assert.match(block('apply_vapor_aerosol_exchange'), /id\.x \+ groups\.x \* 64u \* \(id\.y \+ groups\.y \* id\.z\)/);
  assert.match(block('initialize_vapor_aerosol_exchange'), /edges\[b\] == edges\[c\] && edges\[b \+ 1u\] == edges\[c \+ 1u\]/);
  assert.match(block('initialize_vapor_aerosol_exchange'), /edges\[b \+ 2u\] == edges\[c \+ 2u\]/);
  assert.match(block('finalize_vapor_aerosol_exchange'), /atomicLoad\(&control\[5u\]\) != xp\(3u\)/);
  assert.match(block('finalize_vapor_aerosol_exchange'), /if \(errors != 0u\) \{ atomicStore\(&control\[2u\], 2u\); return; \}/);
});

test('arena ranges check multiplication overflow and disallow intersecting segments', () => {
  assert.match(block('xrange'), /count <= \(xp\(17u\) - min\(offset, xp\(17u\)\)\) \/ stride/);
  assert.match(block('xlayout'), /arrayLength\(&source\)/);
  assert.match(block('xlayout'), /arrayLength\(&candidate\)/);
  assert.match(block('xlayout'), /a\.y != 0u && b\.y != 0u && a\.x < b\.x \+ b\.y && b\.x < a\.x \+ a\.y/);
  assert.match(block('xlayout'), /xp\(18u\) == 0u && xp\(1u\) != 0u/);
});

test('heat-only graphs gather each endpoint once and resolve gas and liquid calorics separately', () => {
  const apply = block('xapply_heat');
  assert.match(block('apply_vapor_aerosol_exchange'), /dm_magnitude == 0u.*xapply_heat\(edge\)/);
  assert.match(apply, /gas = xgas\(edge, row\); let liquid_row = xmaterial_for\(source\[a \+ 12u\]\)/);
  assert.match(apply, /gas_heat\.first == edge/);
  assert.match(apply, /liquid_heat\.first == edge/);
  assert.match(apply, /gas\.u - gas_heat\.value \/ gas\.mass/);
  assert.match(apply, /xf\(a \+ 7u\) \+ liquid_heat\.value \/ xf\(a \+ 3u\)/);
  assert.doesNotMatch(apply, /bitcast<f32>\(candidate|xc\(a \+ (?:3|10)u/);
});

test('heat packets sum with integer limbs and reject unrepresentable or subnormal net energy', () => {
  const sum = block('xheat_total');
  assert.match(sum, /positive: array<u32, 10>; var negative: array<u32, 10>/);
  assert.match(sum, /countLeadingZeros/);
  assert.match(sum, /high > 276u/);
  assert.match(sum, /high < 23u\) \{ return result; \}/);
  assert.match(sum, /magnitude\[i\] != 0u\) \{ return result; \}/);
  assert.match(sum, /magnitude\[word\] & \(\(1u << offset\) - 1u\)/);
});

test('heat finalization uses independently stored energy changes and packet-relative admission', () => {
  assert.match(block('xstored_transfer_error'), /return xstored_heat_error\(edge\)/);
  const stored = block('xheat_stored_endpoint_error');
  assert.match(stored, /source\[mass_word\] != candidate\[mass_word\]/);
  assert.match(stored, /source\[u_word\] == candidate\[u_word\]\) \{ return ERROR_NUMERIC/);
  assert.match(stored, /actual_heat = mass \* \(u - xf\(u_word\)\)/);
  assert.match(stored, /!xrelative\(actual_heat, heat\)/);
  assert.doesNotMatch(stored, /(?:let|var)\s+(?:energy_scale|gauge)\b/);
});

test('a nonzero mass encoding cannot be relabeled as heat-only by floating zero comparisons', () => {
  const apply = block('apply_vapor_aerosol_exchange');
  assert.match(apply, /dm_magnitude = edges\[b \+ 4u\] & 0x7fffffffu/);
  assert.match(apply, /dm_magnitude < 0x00800000u\) \{ xedge_fail\(edge, ERROR_NUMERIC\)/);
  assert.match(block('xstored_transfer_error'), /edges\[edge \* 8u \+ 4u\] & 0x7fffffffu\) == 0u/);
  assert.match(block('xheat_total'), /edges\[c \+ 4u\] \| edges\[c \+ 5u\] \| edges\[c \+ 7u\]/);
});

test('actual completed EOS generation and every caloric cell gate the writer', () => {
  const eos = block('xeos_valid');
  assert.match(eos, /source\[e \+ 4u\] != xp\(14u\) \|\| source\[e \+ 5u\] != xp\(14u\)/);
  assert.match(eos, /\(status & 31u\) != 31u/);
  assert.match(eos, /source\[e \+ 31u\] != cells/);
  const caloric = block('xcaloric_valid');
  assert.match(caloric, /cell = 0u; cell < count/);
  assert.match(caloric, /xf\(row \+ 7u\) != 1\.0/);
  assert.match(caloric, /!xtemperature\(anchor \+ xf\(row \+ 1u\) \/ capacity, equilibrium, max_t\)/);
  assert.doesNotMatch(block('apply_vapor_aerosol_exchange'), /equilibrium/);
});

test('cold material validation admits only finite affine phases and positive surface energy', () => {
  const material = block('xmaterial_valid');
  assert.match(material, /lane = 0u; lane < 16u/);
  assert.match(material, /!xpos\(materials\[m \+ 9u\]\)/);
  assert.match(material, /materials\[m \+ 9u\] \+ materials\[m \+ 10u\] \* min_t/);
  assert.match(material, /materials\[m \+ 9u\] \+ materials\[m \+ 10u\] \* max_t/);
  assert.match(material, /xrelative\(cv, materials\[m \+ 12u\]\)/);
  assert.match(block('xphase_t'), /u < lo \|\| u > hi/);
});

test('product normalization debits already placed mass exactly once and preserves nongas inventory', () => {
  const init = block('initialize_vapor_aerosol_exchange');
  assert.match(init, /let residual = xf\(h \+ 13u\)/);
  assert.match(init, /let n = xf\(h \+ 9u\) \* fraction; let volume = xf\(h \+ 23u\) \* fraction/);
  assert.match(init, /xc\(h \+ 3u, residual\); xc\(h \+ 9u, n\); xc\(h \+ 12u, 0\.0\)/);
  assert.match(init, /xc\(h \+ 13u, residual\); xc\(h \+ 23u, volume\)/);
  assert.match(init, /if \(residual == 0\.0\)/);
  assert.match(init, /xc\(h \+ 3u, 0\.0\); xc\(h \+ 9u, 0\.0\); xc\(h \+ 12u, 0\.0\)/);
  assert.doesNotMatch(init, /candidate\[h \+ lane\] = 0u/);
  assert.match(init, /xf\(h \+ 11u\) >= 1\.0 && xf\(h \+ 11u\) <= 4\.0/);
  assert.doesNotMatch(init, /xf\(h \+ 11u\) != 3\.0/);
  assert.match(init, /if \(!xall_zero\(h, 32u\)\) \{ exchange_record_error\(ERROR_PRODUCT_COUNT\)/);
});

test('inert caloric rows need no invented surface model; actual parcels and selected edges do', () => {
  assert.match(block('xmaterial_valid'), /if \(materials\[m \+ 11u\] == 1\.0\)/);
  assert.match(block('xmaterial_valid'), /materials\[m \+ 11u\] != 0\.0 \|\| materials\[m \+ 9u\] != 0\.0 \|\| materials\[m \+ 10u\] != 0\.0/);
  assert.match(block('initialize_vapor_aerosol_exchange'), /materials\[m \+ 11u\] != 1\.0\) \{ exchange_record_error\(ERROR_PARCEL\)/);
  assert.match(block('apply_vapor_aerosol_exchange'), /materials\[m \+ 11u\] != 1\.0/);
});

test('product prefix admission uses real capacity, stride, generation, seal and indirect counts', () => {
  const count = block('xproduct_count');
  assert.match(count, /source\[c \+ 4u\] != xp\(1u\) \|\| source\[c \+ 5u\] != 8u/);
  assert.match(count, /source\[c \+ 6u\] != xp\(21u\) \|\| source\[c \+ 7u\] != xp\(22u\)/);
  assert.match(block('xlayout'), /xp\(18u\) == 0u && \(xp\(21u\) != 0u \|\| xp\(22u\) != 0u\)/);
  assert.match(block('xlayout'), /xp\(18u\) == 1u && \(xp\(21u\) == 0u \|\| xp\(22u\) == 0u\)/);
  assert.match(count, /source\[c \+ 11u\] != 0u/);
  const final = block('finalize_vapor_aerosol_exchange');
  assert.match(final, /candidate\[c \+ 6u\] = xp\(19u\); candidate\[c \+ 7u\] = xp\(20u\)/);
  assert.match(final, /candidate\[c \+ 3u\] = live/);
  assert.doesNotMatch(final, /candidate\[c \+ [267]u\] = source/);
});

test('existing liquid parcel geometry retains exact population and identity lanes', () => {
  const init = block('initialize_vapor_aerosol_exchange');
  assert.match(init, /source\[a \+ 13u\] != 2u/);
  assert.match(init, /source\[a \+ 11u\] != 0u/);
  assert.match(init, /\(source\[a \+ 20u\] \| source\[a \+ 21u\]\) == 0u/);
  const apply = block('apply_vapor_aerosol_exchange');
  assert.doesNotMatch(apply, /(?:candidate|xc)\(?\[?a \+ (?:11|12|13|14|15|16|17|18|19|20|21|22|23)u/);
  assert.match(apply, /any\(vec3<f32>\(xf\(a\), xf\(a \+ 1u\), xf\(a \+ 2u\)\) != gas\.position\)/);
});

test('actual source gas pure phase, moles and caloric U/T must match exact compact origin', () => {
  const gas = block('xgas');
  assert.match(gas, /xf\(t \+ 1u\) != 3\.0/);
  assert.match(gas, /xf\(t \+ 6u\) != 1\.0/);
  assert.match(gas, /!xpos\(xf\(t \+ 9u\)\)/);
  assert.match(gas, /result\.mass \/ result\.moles/);
  assert.match(gas, /var discriminant = -1\.0/);
  assert.match(gas, /if \(kind == 1u\) \{ discriminant = xf\(xp\(8u\) \+ index \* 32u \+ 5u\); \}/);
  assert.match(gas, /xf\(c \+ 12u\) != result\.u/);
  assert.match(gas, /if \(matches == 1u\) \{ result\.valid = 1u; \}/);
});

test('mechanics rejects APIC, strain and clamped sound; preserves historical pressure', () => {
  const mechanics = block('xmechanics_valid');
  assert.match(mechanics, /lane == 0u \|\| lane == 4u \|\| lane == 8u/);
  assert.match(mechanics, /lane = 9u; lane < 18u/);
  assert.match(mechanics, /xf\(b \+ 18u\) == 1\.0/);
  assert.match(mechanics, /xf\(b \+ 26u\) == 2\.0/);
  assert.match(mechanics, /xrelative\(xf\(b \+ 25u\), expected_c\)/);
  const apply = block('apply_vapor_aerosol_exchange');
  assert.match(apply, /xc\(mech \+ 19u, volume_next\); xc\(mech \+ 25u, c_next\); xc\(mech \+ 31u, mg_next\)/);
  assert.doesNotMatch(apply, /xc\(mech \+ 28u/);
  assert.doesNotMatch(apply, /xc\(mech \+ 22u/);
  assert.match(mechanics, /xnonneg\(xf\(b \+ 28u\)\)/);
});

test('authored visual radius scales with transferred volume while smoothing resolution stays fixed', () => {
  const apply = block('apply_vapor_aerosol_exchange');
  assert.match(apply, /old_visual_radius \* exp\(log\(mg_next \/ gas\.mass\) \/ 3\.0\)/);
  assert.match(apply, /xc\(t \+ 11u, visual_radius_next\)/);
  assert.doesNotMatch(apply, /xc\(t \+ 8u/);
});

test('GPU transfer uses bounded exact common debit-credit projection, not mass epsilon erasure', () => {
  const apply = block('apply_vapor_aerosol_exchange');
  assert.match(apply, /attempt = 0u; attempt < 3u/);
  assert.match(apply, /if \(dm == liquid_credit\)/);
  assert.match(apply, /!common_debit_credit \|\| dm == 0\.0 \|\| !xrelative\(dm, dm_requested\)/);
  assert.match(apply, /!xpos\(mg_next\) \|\| !xpos\(ml_next\)/);
  assert.match(ABI.SPH_VAPOR_AEROSOL_EXCHANGE_NUMERICAL_POLICY, /exact-mass-equality/);
  assert.doesNotMatch(apply, /(?:mass_epsilon|mass_threshold|latent_heat|latent_energy)/);
});

test('independent phases transfer donor energy and momentum with recipient mixing heat only', () => {
  const apply = block('apply_vapor_aerosol_exchange');
  assert.match(apply, /let donor_u = select\(ul, gas\.u, condenses\)/);
  assert.match(apply, /let mixing_heat = 0\.5 \* moved \* receiver_fraction \* dot\(delta_v, delta_v\)/);
  assert.match(apply, /vl_next = vl \+ \(moved \/ ml_next\) \* \(gas\.velocity - vl\)/);
  assert.match(apply, /vg_next = gas\.velocity \+ \(moved \/ mg_next\) \* \(vl - gas\.velocity\)/);
  assert.match(apply, /let tg_next = xphase_t\(row, ug_next, false\); let tl_next = xphase_t\(row, ul_next, true\)/);
  assert.doesNotMatch(apply, /(?:common_temperature|mole_temperature|equilibrium_t)/);
});

test('surface internal energy is intercept times area and never sigma(T) times area', () => {
  const apply = block('apply_vapor_aerosol_exchange');
  assert.match(apply, /let surface_next = materials\[m \+ 9u\] \* area_next/);
  assert.match(apply, /select\(0\.0, mixing_heat, condenses\) - surface_change/);
  assert.match(apply, /surfaces\[parcel_index \* 4u \+ 3u\] = surface_next/);
  assert.doesNotMatch(apply, /surface_next = [^;]*tl_next/);
  assert.equal(ABI.SPH_VAPOR_AEROSOL_EXCHANGE_ENERGY_SCOPE,
    'bulk-internal-plus-translational-kinetic-plus-linear-equilibrium-surface-internal');
});

test('apply checks proposal conservation before writes; finalization owns stored-state admission', () => {
  const apply = block('apply_vapor_aerosol_exchange');
  assert.match(apply, /let actual_gas_energy = mg_next \* \(ug_next - gauge\)/);
  assert.match(apply, /let actual_liquid_energy = ml_next \* \(ul_next - gauge\)/);
  assert.match(apply, /any\(momentum_error > 2\.0e-5 \* momentum_scale\)/);
  assert.match(apply, /abs\(e_next - e_before\) > 2\.0e-5 \* energy_scale/);
  assert.ok(apply.indexOf('xedge_fail(edge, ERROR_CONSERVATION)') < apply.indexOf('xc(s + 3u'));
  assert.ok(apply.indexOf('xedge_fail(edge, ERROR_CONSERVATION)') < apply.indexOf('xc(a + 3u'));
});

test('finalization re-reads actual stored endpoint words before count sealing or READY', () => {
  const stored = block('xstored_transfer_error'), final = block('finalize_vapor_aerosol_exchange');
  assert.match(stored, /old_gas_bits = source\[gas_mass_word\]; let new_gas_bits = candidate\[gas_mass_word\]/);
  assert.match(stored, /old_liquid_bits = source\[a \+ 3u\]; let new_liquid_bits = candidate\[a \+ 3u\]/);
  assert.match(stored, /old_gas_bits == new_gas_bits \|\| old_liquid_bits == new_liquid_bits\) \{ return ERROR_NUMERIC/);
  assert.match(stored, /new_gas_bits >= 0x7f800000u/);
  assert.match(stored, /gas_mass_word = xp\(8u\) \+ index \* 32u \+ 13u/);
  assert.match(stored, /let gas_debit = mg - mg_next; let liquid_credit = ml_next - ml/);
  assert.match(stored, /gas_debit != liquid_credit \|\| !xrelative\(gas_debit, requested\)/);
  assert.match(stored, /\(gas_debit > 0\.0\) != \(requested > 0\.0\)/);
  assert.doesNotMatch(stored, /mg_next = mg - requested/);
  assert.ok(final.indexOf('xstored_transfer_error(edge)') < final.indexOf('candidate[c + 6u] = xp(19u)'));
  assert.ok(final.indexOf('xstored_transfer_error(edge)') < final.indexOf('atomicStore(&control[2u], 1u)'));
  assert.match(ABI.SPH_VAPOR_AEROSOL_EXCHANGE_NUMERICAL_POLICY, /post-dispatch-stored-endpoint-gate/);
});

test('stored endpoint admission rechecks independent U/T, momentum and surface-inclusive energy', () => {
  const stored = block('xstored_transfer_error');
  assert.match(stored, /ug_next = bitcast<f32>\(candidate\[gas_u_word\]\)/);
  assert.match(stored, /ul_next = bitcast<f32>\(candidate\[a \+ 7u\]\)/);
  assert.match(stored, /xphase_t\(row, ug_next, false\)/);
  assert.match(stored, /xphase_t\(row, ul_next, true\)/);
  assert.match(stored, /candidate\[gas_v_word\]/);
  assert.match(stored, /candidate\[a \+ 4u\]/);
  assert.match(stored, /any\(momentum_error > 2\.0e-5 \* momentum_scale\)/);
  assert.match(stored, /abs\(e_after - e_before\) > 2\.0e-5 \* energy_scale/);
  assert.match(stored, /new_surface = surfaces\[parcel_index \* 4u \+ 3u\]/);
});

test('integer endpoint-ratio domain makes stored subtraction equality an exact mass assertion', () => {
  const pair = block('xmass_pair_exact_subtraction'), stored = block('xstored_transfer_error');
  assert.match(pair, /old_bits: u32, new_bits: u32/);
  assert.match(pair, /var doubled = smaller \+ 0x00800000u/);
  assert.match(pair, /smaller < 0x00800000u\) \{ doubled = smaller << 1u/);
  assert.match(pair, /return larger <= doubled/);
  assert.doesNotMatch(pair, /bitcast<f32>|\/ 2\.0|\* 2\.0/);
  assert.match(stored, /!xmass_pair_exact_subtraction\(old_gas_bits, new_gas_bits\)/);
  assert.match(stored, /!xmass_pair_exact_subtraction\(old_liquid_bits, new_liquid_bits\)/);
  assert.ok(stored.indexOf('!xmass_pair_exact_subtraction') < stored.indexOf('let gas_debit ='));
  assert.match(ABI.SPH_VAPOR_AEROSOL_EXCHANGE_NUMERICAL_POLICY, /each-endpoint-mass-ratio-at-most-2/);
});

test('final header accepted count is recomputed only from stored validated endpoints', () => {
  const final = block('finalize_vapor_aerosol_exchange');
  assert.match(final, /atomicStore\(&control\[5u\], 0u\)/);
  assert.ok(final.indexOf('atomicStore(&control[5u], 0u)') < final.indexOf('xstored_transfer_error(edge)'));
  assert.match(final, /if \(stored_error != 0u\) \{ xedge_fail\(edge, stored_error\); \}\n    else \{ atomicAdd\(&control\[5u\], 1u\); \}/);
});

// Independent rounded arithmetic demonstrates why a positive request can
// still be inadmissible, and why ordinary decimal owners need a projection.
const f = Math.fround;
function projectedDebit(gas, liquid, requested) {
  gas = f(gas); liquid = f(liquid); requested = f(requested);
  let gasNext = f(gas - requested), liquidNext, debit;
  for (let attempt = 0; attempt < 3; attempt++) {
    const gasDebit = f(gas - gasNext);
    liquidNext = f(liquid + gasDebit);
    const credit = f(liquidNext - liquid);
    gasNext = f(gas - credit);
    debit = f(gas - gasNext);
    if (debit === credit) break;
  }
  if (!(gasNext > 0 && liquidNext > 0) || !debit
    || f(liquidNext - liquid) !== debit || Math.sign(debit) !== Math.sign(requested)
    || Math.abs(debit - requested) > 1e-5 * Math.max(Math.abs(debit), Math.abs(requested))) return null;
  return { gasNext, liquidNext, debit, gas, liquid, requested };
}
// Independent physical decoding of stored f32 endpoints. In particular this
// does NOT recompute their values from the requested transfer expression.
function storedEndpointAdmitted(gas, liquid, gasNext, liquidNext, requested) {
  const values = Float32Array.of(gas, liquid, gasNext, liquidNext, requested);
  const words = new Uint32Array(values.buffer);
  if (words[0] === words[2] || words[1] === words[3]) return false;
  if (![...values].every(Number.isFinite) || ![...values.slice(0, 4)].every((v) => v > 0)) return false;
  if (Math.max(values[0], values[2]) > 2 * Math.min(values[0], values[2])
    || Math.max(values[1], values[3]) > 2 * Math.min(values[1], values[3])) return false;
  const debit = values[0] - values[2], credit = values[3] - values[1];
  return debit !== 0 && debit === credit && Math.sign(debit) === Math.sign(values[4])
    && Math.abs(debit - values[4]) <= 1e-5 * Math.max(Math.abs(debit), Math.abs(values[4]));
}
for (const [label, gas, liquid, dm] of [
  ['native-v3 unchanged condensation', .009999999776482582, .019999999552965164, 1e-25],
  ['unchanged evaporation', .009999999776482582, .019999999552965164, -1e-25],
  ['unchanged product residual', .019999999552965164, .019999999552965164, 1e-25]
]) {
  test(`stored endpoint regression rejects ${label}`, () => {
    assert.equal(storedEndpointAdmitted(gas, liquid, gas, liquid, dm), false);
  });
}
test('stored endpoint admission refuses unequal, one-sided, wrong-sign or over-budget transfers', () => {
  assert.equal(storedEndpointAdmitted(.125, .25, .109375, .28125, .015625), false);
  assert.equal(storedEndpointAdmitted(.125, .25, .109375, .25, .015625), false);
  assert.equal(storedEndpointAdmitted(.125, .25, .140625, .234375, .015625), false);
  assert.equal(storedEndpointAdmitted(.125, .25, .109375, .265625, 1e-25), false);
});
test('independent IEEE counterexample: equal rounded debit/credit is not equal physical mass', () => {
  const mg = f(.01), ml = f(.001), request = f(.001955);
  const mgNext = f(mg - request), mlNext = f(ml + request);
  const actualDebit = mg - mgNext, actualCredit = mlNext - ml;
  assert.notEqual(actualDebit, actualCredit);
  assert.equal(f(actualDebit), f(actualCredit), 'rounded subtraction alone hides the residual');
  assert.ok(mlNext > 2 * ml, 'source/receiver pair lies outside exact-subtraction domain');
  assert.equal(storedEndpointAdmitted(mg, ml, mgNext, mlNext, request), false);
});
test('stored endpoint domain admits factor-two boundary but rejects larger even exact transfers', () => {
  assert.equal(storedEndpointAdmitted(.125, .0625, .0625, .125, .0625), true);
  assert.equal(storedEndpointAdmitted(.125, .0625, .03125, .15625, .09375), false);
});
for (const [gas, liquid, requested] of [[0.01, 0.02, 0.001], [0.02, 0.02, 0.002],
  [0.01, 0.02, -0.001], [0.125, 0.25, 0.015625]]) {
  test(`independent f32 common transfer exists for ${gas}/${liquid}/${requested}`, () => {
    const result = projectedDebit(gas, liquid, requested);
    assert.ok(result);
    assert.equal(result.gas - result.gasNext, result.liquidNext - result.liquid);
    assert.equal(storedEndpointAdmitted(result.gas, result.liquid,
      result.gasNext, result.liquidNext, result.requested), true);
    near(result.debit, f(requested), 1e-7);
  });
}
for (const [gas, liquid, requested] of [[0.01, 0.02, 1e-12], [0.125, 0.25, 0.125],
  [0.125, 0.25, -0.25]]) {
  test(`independent rounding/domain rejects vanishing or complete transfer ${requested}`, () => {
    assert.equal(projectedDebit(gas, liquid, requested), null);
  });
}

const dot = (a, b = a) => a.reduce((sum, value, lane) => sum + value * b[lane], 0);
const plus = (a, b) => a.map((value, lane) => value + b[lane]);
const times = (a, n) => a.map((value) => value * n);
for (const dm of [1 / 64, -1 / 64]) {
  test(`independent moving-pair bulk+surface balance for signed transfer ${dm}`, () => {
    const mg = 1 / 8, ml = 1 / 4, ug = 9000, ul = 2000;
    const vg = [3, -1, 2], vl = [-2, 4, 0.5];
    const mgNext = mg - dm, mlNext = ml + dm;
    const donorU = dm > 0 ? ug : ul, donorV = dm > 0 ? vg : vl;
    // Independent momentum-conservation solve, not the shader's update form.
    const pgNext = plus(times(vg, mg), times(donorV, -dm));
    const plNext = plus(times(vl, ml), times(donorV, dm));
    const vgNext = times(pgNext, 1 / mgNext), vlNext = times(plNext, 1 / mlNext);
    const kineticBefore = (mg * dot(vg) + ml * dot(vl)) / 2;
    const kineticAfter = (mgNext * dot(vgNext) + mlNext * dot(vlNext)) / 2;
    const lostKe = kineticBefore - kineticAfter;
    assert.ok(lostKe > 0);
    const reducedMass = Math.abs(dm) * (dm > 0 ? ml / mlNext : mg / mgNext);
    near(lostKe, reducedMass * dot(plus(vg, times(vl, -1))) / 2);
    const radius = (mass) => Math.cbrt(3 * mass / (4 * Math.PI * 1000 * 1000));
    const area = (mass) => 4 * Math.PI * 1000 * radius(mass) ** 2;
    const a = 0.2, b = -0.0001;
    const surfaceBefore = a * area(ml), surfaceAfter = a * area(mlNext);
    const enthalpyCorrection = 11, conductiveHeat = 5, pressureWork = -3;
    const transfer = enthalpyCorrection + conductiveHeat + pressureWork;
    const gasEnergyAfter = mg * ug - dm * donorU - transfer + (dm < 0 ? lostKe : 0);
    const liquidEnergyAfter = ml * ul + dm * donorU + transfer + (dm > 0 ? lostKe : 0)
      - (surfaceAfter - surfaceBefore);
    const gasT = 200 + (gasEnergyAfter / mgNext - 5000) / 10;
    const liquidT = 200 + (liquidEnergyAfter / mlNext - 1000) / 20;
    assert.ok(gasT >= 200 && gasT <= 800 && liquidT >= 200 && liquidT <= 800);
    assert.ok(Math.abs(gasT - liquidT) > 100, 'no forced gas/liquid common temperature');
    near(gasEnergyAfter + liquidEnergyAfter + kineticAfter + surfaceAfter,
      mg * ug + ml * ul + kineticBefore + surfaceBefore);
    plus(pgNext, plNext).forEach((value, lane) => near(value, mg * vg[lane] + ml * vl[lane]));
    const sigma = a + b * liquidT;
    assert.ok(sigma > 0);
    near((sigma - liquidT * b) * area(mlNext), surfaceAfter);
    assert.ok(Math.abs(sigma * area(mlNext) - surfaceAfter) > 1e-8,
      'surface free energy is not surface internal energy');
    for (const gauge of [-50000, 17000]) {
      const shiftedBefore = mg * (ug + gauge) + ml * (ul + gauge);
      const shiftedAfter = gasEnergyAfter + mgNext * gauge + liquidEnergyAfter + mlNext * gauge;
      near(shiftedAfter + kineticAfter + surfaceAfter,
        shiftedBefore + kineticBefore + surfaceBefore);
    }
  });
}
