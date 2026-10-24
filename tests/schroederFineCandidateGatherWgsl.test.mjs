import assert from 'node:assert/strict';
import test from 'node:test';
import { mlsMpmTrialDeformationWgsl } from '../ulg-gpu-abi/src/wgsl.js';
import {
  extractRejectedParticleG2pFragments,
  schroederRejectedParticleDiagnosticWgsl
} from '../src/runtime/sph/schroederRejectedParticleDiagnosticGpu.js';
import {
  FINE_CANDIDATE_GATHER_HEADER_WORDS,
  FINE_CANDIDATE_GATHER_ROW_WORDS,
  FINE_CANDIDATE_GATHER_PARAMS_BYTES,
  extractFineCandidateGatherValidationFragments,
  schroederFineCandidateGatherWgsl as shader
} from './fixtures/schroederFineCandidateGatherWgsl.js';

test('candidate gather exposes full population rows and exact 32-byte inputs', () => {
  assert.equal(FINE_CANDIDATE_GATHER_HEADER_WORDS, 16);
  assert.equal(FINE_CANDIDATE_GATHER_ROW_WORDS, 64);
  assert.equal(FINE_CANDIDATE_GATHER_PARAMS_BYTES, 32);
  assert.match(shader, /return 16u \+ ordinal \* 64u/);
  for (const entry of ['candidate_gather_begin', 'candidate_gather_particles', 'candidate_gather_seal']) {
    assert.match(shader, new RegExp(`fn ${entry}\\(`));
  }
});

test('candidate gather embeds exact production reconstruction and trial deformation math', () => {
  for (const fragment of Object.values(extractRejectedParticleG2pFragments())) {
    assert.ok(shader.includes(fragment), 'unaltered production G2P fragment');
  }
  assert.ok(shader.includes(mlsMpmTrialDeformationWgsl));
  assert.match(shader, /g2p_trial_deformation\(f\[0\],f\[1\],f\[2\],gathered_c\[0\],gathered_c\[1\],gathered_c\[2\],params\.dt\)/);
  assert.doesNotMatch(shader, /g2p_clamp|g2p_limit|clamp\(raw_j|abs\(raw_j\)/);
});

test('candidate gather reuses identity and pressure checks with fail-closed source anchors', () => {
  const fragments = extractFineCandidateGatherValidationFragments();
  for (const [name, fragment] of Object.entries(fragments)) {
    assert.ok(schroederRejectedParticleDiagnosticWgsl.includes(fragment));
    assert.ok(shader.includes(fragment));
    const anchor = `fn ${name}(`;
    assert.throws(() => extractFineCandidateGatherValidationFragments(
      schroederRejectedParticleDiagnosticWgsl.replace(anchor, 'missing(')), /unique production/);
    assert.throws(() => extractFineCandidateGatherValidationFragments(
      `${schroederRejectedParticleDiagnosticWgsl}\n${anchor}`), /unique production/);
  }
  assert.match(shader, /for \(var i = 3u; i < 16u; i\+\+\)/);
  assert.match(shader, /active_source\[47\] != seal/);
  assert.match(shader, /field\[2\] != 3u/);
});

test('candidate gather requires complete finite source-bound candidate evidence', () => {
  assert.match(shader, /candidate\[0u\] != 0x46434331u/);
  assert.match(shader, /candidate\[2u\] != 15u/);
  assert.match(shader, /candidate\[3u\] != field\[34\]/);
  assert.match(shader, /candidate\[11u\] != field\[3\]/);
  assert.match(shader, /candidate\[12u\] != inputs\.candidate_completion_ordinal/);
  assert.match(shader, /candidate\[13u\] != inputs\.fine_substep_ordinal/);
  assert.match(shader, /candidate\[14u\] != bitcast<u32>\(1\.0\)/);
  assert.match(shader, /candidate\[15u\] != bitcast<u32>\(1\.0\)/);
  assert.match(shader, /\(candidate\[candidate_row\] & 159u\) != 159u/);
});

test('candidate gather uses exact descriptor keys and candidate velocities rather than old field velocities', () => {
  assert.match(shader, /field\[descriptor \+ 4u \+ u32\(a \* 9i \+ b \* 3i \+ c\)\]/);
  assert.match(shader, /let candidate_row = 16u \+ field_index \* 32u/);
  assert.match(shader, /bitcast<f32>\(candidate\[candidate_row \+ 8u\]\)/);
  assert.match(shader, /!pressure_admitted\(field_index\)/);
  assert.doesNotMatch(shader, /grid_velocity = .*field\[/);
  assert.match(shader, /active_source\[active_source\[26\] \+ particle\] != ordinal/);
});

test('candidate gather visits all 27 slots and preserves clipped normalization without declaring incomplete support complete', () => {
  for (const axis of ['a', 'b', 'c']) {
    assert.match(shader, new RegExp(`for \\(var ${axis} = 0i; ${axis} < 3i; ${axis}\\+\\+\\)`));
  }
  assert.match(shader, /visited_stencil\+\+/);
  assert.match(shader, /missing == 0u && clipped == 0u && sample_count > 0u && visited_stencil == 27u/);
  assert.match(shader, /output\[row \+ 58u\] = clipped/);
  assert.match(shader, /output\[row \+ 59u\] = missing/);
  assert.match(shader, /output\[row \+ 60u\] = visited_stencil/);
});

test('candidate gather writes raw and effective C/F/J independently without particle motion or volume caps', () => {
  assert.match(shader, /row6\.z < 0\.5 \|\| inputs\.internal_pressure_scale == 0\.0/);
  assert.match(shader, /put\(row \+ 11u, raw_j\)/);
  assert.match(shader, /put\(row \+ 39u, effective_j\)/);
  assert.match(shader, /put\(row \+ 12u \+ index, gathered_c\[i\]\[j\]\)/);
  assert.match(shader, /put\(row \+ 21u \+ index, trial\[i\]\[j\]\)/);
  assert.match(shader, /put\(row \+ 40u \+ index, select\(gathered_c\[i\]\[j\], 0\.0, disabled\)\)/);
  assert.match(shader, /put\(row \+ 49u \+ index, select\(trial\[i\]\[j\], f\[i\]\[j\], disabled\)\)/);
});

test('candidate gather mutates only diagnostic output and never forges production authority', () => {
  for (const name of ['field', 'candidate', 'active_source', 'state', 'mechanics']) {
    assert.match(shader, new RegExp(`var<storage, read> ${name}:`));
    assert.doesNotMatch(shader, new RegExp(`(?:^|[;{}])\\s*${name}\\[[^;\\n]+?\\]\\s*(?:\\+=|\\|=|=(?!=))`));
  }
  assert.doesNotMatch(shader, /rejection:|reflux_ledger|workspace:|g2p_receipt_reject|atomic|var<workgroup>|queue\.submit/);
  assert.match(shader, /raw pre-wall\/pre-volume-cap first-fine candidate/);
});

test('candidate gather seals complete coverage only after inspecting every active ordinal', () => {
  assert.match(shader, /ordinal < active_source\[18\]; ordinal\+\+/);
  assert.match(shader, /output\[5u\] == output\[4u\]/);
  assert.match(shader, /output\[7u\] == output\[6u\]/);
  assert.match(shader, /output\[8u\] == 0u/);
  assert.match(shader, /output\[9u\] == 0u/);
  assert.match(shader, /output\[row \+ 63u\] = ordinal/);
  assert.match(shader, /if \(\(flags & 1u\) == 0u\) \{ output\[9u\]\+\+; continue; \}/);
  assert.match(shader, /output\[row\] != active_source\[active_source\[25\] \+ ordinal\]/);
});

test('candidate gather invalid inputs and missing dispatches cannot inherit prior row completion', () => {
  const begin = shader.slice(shader.indexOf('fn candidate_gather_begin()'),
    shader.indexOf('fn candidate_gather_particles('));
  assert.ok(begin.indexOf('output[index] = 0u') < begin.indexOf('candidate_source_valid()'));
  assert.match(shader, /!fits\(16u, inputs\.particle_count, 64u, arrayLength\(&output\)\)/);
  assert.match(shader, /!fits\(16u, candidate\[3u\], 32u, arrayLength\(&candidate\)\)/);
  assert.match(shader, /!product_fits_u32\(params\.grid_nx \* params\.grid_ny, params\.grid_nz\)/);
  assert.match(shader, /if \(!candidate_source_valid\(\) \|\| output\[2u\] != 12u\) \{ return; \}/);
});
