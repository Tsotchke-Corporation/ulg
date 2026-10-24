import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import {
  SPH_AEROSOL_CONDENSATE_EXTRACTION_ERROR,
  sphAerosolCondensateProposalWgsl,
  sphAerosolCondensateApplyWgsl
} from '../src/runtime/sph/sphAerosolCondensateExtractionWgsl.js';
import {
  packSphPhaseCarrierClosureRows,
  sphPhaseCarrierTransferWgsl
} from '../src/runtime/sph/sphPhaseCarrierTransferGpu.js';
import { sphPhaseCarrierThermodynamicsWgsl } from '../src/runtime/sph/sphPhaseCarrierThermodynamicsWgsl.js';
import { sphGasConstitutiveWgsl } from '../ulg-gpu-abi/src/sphGasConstitutiveWgsl.js';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

test('thermodynamics extraction preserves the existing helper and all remaining transfer arithmetic', () => {
  const helper = sphPhaseCarrierThermodynamicsWgsl.slice(
    sphPhaseCarrierThermodynamicsWgsl.indexOf('// Resolve the pressure-adjusted plateau')
  );
  // Captured before edits from the fixed original baseline
  // g2-condensate-kernel-20260914-pre (22efc9ad...eee7cd739). The helper moves
  // earlier in WGSL declaration order; its body is byte-exact and the entire
  // remaining legacy arithmetic is unchanged modulo the explicitly enumerated
  // gas c(T) extension below. Keep the original baseline hash, not a new hash
  // computed from the implementation under test.
  assert.equal(sha256(helper), 'f5d44b3944bed082134a13abba94e60b1d710a43fb7383ba57924bbd7033f99e');
  assert.equal(
    sha256(sphPhaseCarrierTransferWgsl.replace(helper, '').replace(sphGasConstitutiveWgsl, '')
      .replace(/fn closure_sound_speed\([\s\S]*?\n}\n/, '')
      .replace('phases: LineagePhases, lineage_index: u32', 'phases: LineagePhases')
      .replaceAll('lineage_mechanics_valid(phases, lineage_index)', 'lineage_mechanics_valid(phases)')
      .replace(/    if \(phase_id == 3u[\s\S]*?\n    }\n/, '')
      .replace('closure_sound_speed(mechanics_record, temperature)', 'record1.z')
      .replace(/\s/g, '')),
    'fadd3cb7673a516486acaf320d940aa0de8646d0057b8ef7604d3a1451f4ede2'
  );
  for (const shader of [sphPhaseCarrierTransferWgsl, sphAerosolCondensateProposalWgsl]) {
    assert.equal(shader.includes(sphPhaseCarrierThermodynamicsWgsl), true);
    assert.equal([...shader.matchAll(/fn carrier_plateau_for\(/g)].length, 1);
    assert.equal([...shader.matchAll(/fn plateau_endpoint\(/g)].length, 1);
  }
  assert.doesNotMatch(sphAerosolCondensateApplyWgsl, /fn plateau_endpoint\(/);
});

test('the exported closure packer preserves exact old ordering and copies all source arrays', () => {
  const thermal = {
    segments: Float32Array.of(
      7, 1, 2, 2, -100, -10, 200, 300, 900, 900, 1, 0,
      7, 2, 2, 3, -10, 90, 300, 300, 900, 2, 1, 0
    ),
    records: Float32Array.of(7, 0, 2, 1, 0.1, 1, 100000, 0.0001)
  };
  const mechanics = { phaseRecordCount: 2, records: Float32Array.of(
    7, 2, 900, 1000, 0, 0, 1, 1, 0, 1, 0.01, 0,
    7, 3, 2, 0, 0, 0, 40, 2, 0, 1, 0, 0
  ) };
  const packed = packSphPhaseCarrierClosureRows(thermal, mechanics);
  const expected = new Float32Array([
    ...thermal.segments, ...mechanics.records, ...thermal.records
  ]);
  assert.deepEqual(packed, {
    values: expected,
    thermalSegmentCount: 2,
    mechanicsRecordCount: 2,
    materialRecordCount: 1,
    thermalOffsetVec4: 0,
    mechanicsOffsetVec4: 6,
    materialRecordOffsetVec4: 12
  });
  assert.equal(packed.values[4], -100, 'signed energy reference survives packing');
  thermal.segments.fill(0);
  thermal.records.fill(0);
  mechanics.records.fill(0);
  assert.deepEqual(packed.values, expected, 'later caller changes do not alias packed closure rows');
});

test('proposal and apply expose the exact 96-byte parameter and bounded binding contracts', () => {
  const expectedFields = [
    ['particle_count', 'u32'], ['lineage_capacity', 'u32'], ['request_count', 'u32'],
    ['source_capacity', 'u32'], ['target_capacity', 'u32'], ['source_generation', 'u32'],
    ['target_generation', 'u32'], ['topology_epoch', 'u32'], ['thermal_segment_count', 'u32'],
    ['mechanics_record_count', 'u32'], ['thermal_offset_vec4', 'u32'], ['mechanics_offset_vec4', 'u32'],
    ['material_record_count', 'u32'], ['material_record_offset_vec4', 'u32'],
    ['absolute_pressure_authority', 'u32'], ['reserved0', 'u32'],
    ['fraction_validation_epsilon', 'f32'], ['relative_tolerance', 'f32'],
    ['mass_epsilon', 'f32'], ['fraction_activation_epsilon', 'f32'],
    ['reserved1', 'u32'], ['reserved2', 'u32'], ['reserved3', 'u32'], ['reserved4', 'u32']
  ];
  for (const shader of [sphAerosolCondensateProposalWgsl, sphAerosolCondensateApplyWgsl]) {
    const declaration = shader.match(/struct CondensateParams \{([\s\S]*?)\};/)[1];
    assert.deepEqual([...declaration.matchAll(/(\w+): (u32|f32),/g)].map((m) => m.slice(1)), expectedFields);
    assert.ok([...shader.matchAll(/var<storage,/g)].length <= 8);
    assert.match(shader, /@builtin\(num_workgroups\) groups: vec3<u32>/);
    assert.match(shader, /id\.x \+ groups\.x \* 64u \* \(id\.y \+ groups\.y \* id\.z\)/);
  }
  const bindings = (shader) => [...shader.matchAll(/@binding\((\d+)\)/g)].map((m) => Number(m[1]));
  assert.deepEqual(bindings(sphAerosolCondensateProposalWgsl), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(bindings(sphAerosolCondensateApplyWgsl), [0, 1, 2, 3, 4, 5]);
});

test('proposal preserves source buffers and apply copies only a fully admitted immutable batch', () => {
  assert.deepEqual(
    [...sphAerosolCondensateProposalWgsl.matchAll(/var<storage, read_write> (\w+)/g)].map((m) => m[1]),
    ['scratch']
  );
  assert.match(sphAerosolCondensateProposalWgsl, /source_generation < 0xffffffffu/);
  assert.match(sphAerosolCondensateProposalWgsl, /target_generation == params\.source_generation \+ 1u/);
  assert.match(sphAerosolCondensateProposalWgsl, /atomicAdd\(&scratch\[3u\], 1u\)/);
  assert.doesNotMatch(sphAerosolCondensateProposalWgsl, /atomicStore\(&scratch\[(?:2|3|11)u\]/);
  assert.match(sphAerosolCondensateApplyWgsl, /atomicLoad\(&scratch\[2u\]\) != 0u \|\| atomicLoad\(&scratch\[3u\]\) != params\.request_count/);
  assert.doesNotMatch(sphAerosolCondensateApplyWgsl, /atomicLoad\(&scratch\[11u\]\)/);
  assert.match(sphAerosolCondensateApplyWgsl, /atomicAdd\(&scratch\[11u\], 1u\)/);
  assert.doesNotMatch(sphAerosolCondensateApplyWgsl, /var<storage, (?:read|read_write)> source_/);
  for (const output of ['residual_state', 'residual_thermo', 'residual_mechanics', 'successor_parcels']) {
    assert.match(sphAerosolCondensateApplyWgsl, new RegExp(`${output}\\[[^\\]]+\\] = atomicLoad`));
  }
});

test('the reduced extraction conserves existing internal energy and retains exact physical population provenance', () => {
  assert.match(sphAerosolCondensateProposalWgsl, /let condensed_mass = s0\.w \* fractions\.y/);
  assert.match(sphAerosolCondensateProposalWgsl, /let residual_mass = s0\.w - condensed_mass/);
  assert.match(sphAerosolCondensateProposalWgsl, /let residual_energy = source_energy - condensed_energy/);
  assert.match(sphAerosolCondensateProposalWgsl, /let residual_u = residual_energy \/ residual_mass/);
  assert.match(sphAerosolCondensateProposalWgsl, /ce_near\(residual_u, closure\.gas_u\)/);
  assert.match(sphAerosolCondensateProposalWgsl, /row\[66u\] = requests\[request \+ 2u\]; row\[67u\] = requests\[request \+ 3u\]/);
  assert.match(sphAerosolCondensateProposalWgsl, /row\[70u\] = lineage; row\[71u\] = params\.topology_epoch/);
  assert.match(sphAerosolCondensateProposalWgsl, /row\[74u\] = 1u; row\[75u\] = 2u/);
  assert.doesNotMatch(sphAerosolCondensateProposalWgsl, /(?:source_energy|residual_energy|condensed_energy)\s*\+\s*(?:latent|condensation)/);
  assert.match(sphAerosolCondensateProposalWgsl, /word = 9u; word < 18u/);
  assert.match(sphAerosolCondensateProposalWgsl, /m5\.x == 0\.0 && m5\.y == 1\.0/);
  assert.match(sphAerosolCondensateProposalWgsl, /m7\.z == 0\.0/);
  assert.match(sphAerosolCondensateProposalWgsl, /material_count != 1u/);
  assert.match(sphAerosolCondensateProposalWgsl, /plateau_count != 1u/);
  assert.match(sphAerosolCondensateProposalWgsl, /anchor_count != 1u/);
  assert.match(sphAerosolCondensateProposalWgsl, /absolute_pressure_authority == 1u/);
});

test('extraction error bits are distinct and match both WGSL entry modules', () => {
  const errors = SPH_AEROSOL_CONDENSATE_EXTRACTION_ERROR;
  assert.equal(Object.isFrozen(errors), true);
  assert.equal(new Set(Object.values(errors)).size, 9);
  for (const [name, value] of Object.entries(errors)) {
    assert.equal(value & (value - 1), 0);
    for (const shader of [sphAerosolCondensateProposalWgsl, sphAerosolCondensateApplyWgsl]) {
      assert.match(shader, new RegExp(`const ERROR_${name}: u32 = ${value}u;`));
    }
  }
});
