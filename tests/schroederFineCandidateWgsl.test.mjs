import test from 'node:test';
import assert from 'node:assert/strict';
import { schroederSpatialParentFieldMechanicsWorkspaceWgsl as production }
  from '../ulg-gpu-abi/src/schroederSpatialParentFieldMechanicsWorkspaceWgsl.js';
import { extractFineCandidateFragments, schroederFineCandidateWgsl,
  FINE_CANDIDATE_HEADER_WORDS, FINE_CANDIDATE_ROW_WORDS }
  from './fixtures/schroederFineCandidateWgsl.js';

test('candidate embeds unchanged production code and exact GPU arithmetic fragments', () => {
  assert.ok(schroederFineCandidateWgsl.includes(production));
  for (const fragment of Object.values(extractFineCandidateFragments())) {
    assert.ok(production.includes(fragment));
    assert.ok(schroederFineCandidateWgsl.includes(fragment));
  }
  assert.equal(FINE_CANDIDATE_HEADER_WORDS, 16);
  assert.equal(FINE_CANDIDATE_ROW_WORDS, 32);
});

test('candidate source extraction rejects missing or ambiguous production anchors', () => {
  assert.throws(() => extractFineCandidateFragments(''), /unique production anchor/);
  assert.throws(() => extractFineCandidateFragments(production + production), /unique production anchor/);
  assert.throws(() => extractFineCandidateFragments(production.replace(
    '  let pressure_velocity_delta = pressure_impulse / mass;',
    '  let pressure_velocity_delta = vec3<f32>(0.0);'
  )), /unique production anchor/);
});

test('candidate proposals retain structural checks without claiming a CFL decision', () => {
  const { proposals } = extractFineCandidateFragments();
  assert.match(proposals, /fine_parent_key_matches/);
  assert.match(proposals, /pou_residual > pou_tolerance/);
  assert.match(proposals, /causal_impulse_sum\(fine_field, true\)/);
  assert.match(proposals, /workspace_admitted\(PHASE_PREDICTORS\)/);
  assert.doesNotMatch(proposals, /velocity_alpha_interval|seal_fine_correction_alpha/);
});

test('candidate records signed work and exposes failures without committing source fields', () => {
  const { energy } = extractFineCandidateFragments();
  assert.match(energy, /let pressure_delta = pressure_linear \+ pressure_quadratic/);
  assert.match(energy, /let causal_delta = causal_linear \+ causal_quadratic/);
  const appended = schroederFineCandidateWgsl.slice(production.length + 1);
  assert.doesNotMatch(appended, /fine_store\(|coarse_store\(|reflux_store\(|ws_store\(8[45]u/);
  assert.match(appended, /let route_cfl_alpha = 1\.0/);
  assert.match(appended, /let causal_alpha = 1\.0/);
  assert.match(appended, /candidate_output\[6u\] == candidate_output\[5u\]/);
  assert.match(appended, /velocity_endpoint_within_physical_audit/);
});
