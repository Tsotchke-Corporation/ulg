import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { mlsMpmG2pReconstructWgsl } from '../ulg-gpu-abi/src/wgsl.js';
import {
  createSchroederSpatialMechanicsFieldViewLayout,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_RECEIPT_WORDS
} from '../ulg-gpu-abi/src/schroederSpatialMechanicsFieldView.js';
import {
  SCHROEDER_REJECTED_PARTICLE_DIAGNOSTIC_WORDS,
  decodeSchroederRejectedParticleDiagnostic,
  encodeSchroederRejectedParticleDiagnostic,
  extractRejectedParticleG2pFragments,
  schroederRejectedParticleDiagnosticWgsl as shader
} from '../src/runtime/sph/schroederRejectedParticleDiagnosticGpu.js';

test('rejected-particle diagnostic embeds exact production gather arithmetic with fail-closed anchors', () => {
  const fragments = extractRejectedParticleG2pFragments();
  for (const fragment of Object.values(fragments)) {
    assert.ok(mlsMpmG2pReconstructWgsl.includes(fragment));
    assert.ok(shader.includes(fragment));
    const anchor = fragment.split('\n')[0];
    assert.throws(() => extractRejectedParticleG2pFragments(mlsMpmG2pReconstructWgsl.replace(anchor, 'missing')), /unique production/);
    assert.throws(() => extractRejectedParticleG2pFragments(mlsMpmG2pReconstructWgsl + '\n' + anchor), /unique production/);
  }
  const production = readFileSync(new URL('../src/runtime/sph/sphMlsMpmGpuStep.js', import.meta.url), 'utf8');
  const numeric = text => text.match(/fn g2p_scale_close\([\s\S]*?\n\}/)?.[0];
  assert.equal(numeric(shader), numeric(production), 'exact operation-conditioned pressure eligibility');
  assert.match(shader, /!pressure_admitted\(field_index\)/);
  assert.match(shader, /active_source\[active_source\[26\] \+ particle\] != ordinal/);
  assert.match(shader, /field\[24\] \+ particle \* FIELD_DESCRIPTOR_WORDS/);
  assert.match(shader, /field\[descriptor \+ 4u \+ u32\(a \* 9i \+ b \* 3i \+ c\)\]/);
});

test('diagnostic parallel reduction is fixed-size and every lane reaches its barrier', () => {
  assert.equal(SCHROEDER_REJECTED_PARTICLE_DIAGNOSTIC_WORDS, 128);
  assert.match(shader, /var<workgroup> lane_packets: array<u32, 4096>/);
  assert.match(shader, /@compute @workgroup_size\(32\)/);
  assert.match(shader, /ordinal = ordinal \+ 32u/);
  const main = shader.slice(shader.indexOf('@compute @workgroup_size(32)'));
  assert.ok(main.indexOf('workgroupBarrier();') < main.indexOf('return;'));
  assert.match(main, /gather\(lane\);[\s\S]*lane_packets[\s\S]*workgroupBarrier\(\)/);
  for (const input of ['field', 'rejection', 'active_source', 'state', 'mechanics']) {
    assert.match(shader, new RegExp(`var<storage, read> ${input}:`));
    assert.doesNotMatch(shader, new RegExp(`(?:^|[;{}])\\s*${input}\\[[^;\\n]+?\\]\\s*(?:\\+=|\\|=|=(?!=))`));
  }
  assert.doesNotMatch(shader, /atomicCompareExchange|mapAsync|queue\.submit|g2p_receipt_reject/);
});

test('diagnostic authenticates the real field ABI receipt gap and retains capacity padding', () => {
  const layout = createSchroederSpatialMechanicsFieldViewLayout({ sourceCapacity: 8, fieldCapacity: 35 });
  assert.equal(layout.stateOffsetWords - layout.receiptControlOffsetWords, SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_RECEIPT_WORDS);
  assert.ok(shader.includes(`const FIELD_RECEIPT_WORDS: u32 = ${layout.receiptControlWords}u;`));
  assert.match(shader, /field\[30\] == field\[28\] \+ field\[32\] \* FIELD_ACCUMULATOR_WORDS \+ FIELD_RECEIPT_WORDS/);
  const fixture = readFileSync(new URL('./schroederRejectedParticleDiagnostic.native.test.mjs', import.meta.url), 'utf8');
  assert.match(fixture, /const layout = createSchroederSpatialMechanicsFieldViewLayout\(/);
  assert.match(fixture, /const activeLayout = createSchroederSpatialActiveSourceViewLayout\(/);
});

test('decoder preserves fixed packet offsets, raw versus effective affine and diagnostic-only scope', () => {
  for (const packet of [null, [], new Uint32Array(127), new Uint32Array(128)]) {
    assert.equal(decodeSchroederRejectedParticleDiagnostic(packet).status, 'rejected-particle-diagnostic-invalid-packet');
  }
  const storage = new ArrayBuffer(1024);
  const words = new Uint32Array(storage, 128, 128), floats = new Float32Array(storage, 128, 128);
  words.set([0x53504431, 1, 1, 27, 70, 65, 65]); words[19] = 3;
  words[48] = 64; words[49] = 1; words[50] = 27;
  floats[51] = 1; floats[59] = -2; floats[87] = 24;
  floats.set([1,2,3,4,5,6,7,8,9], 60);
  words[88] = 32; words[89] = 6;
  const decoded = decodeSchroederRejectedParticleDiagnostic(words);
  assert.equal(decoded.contributorCount, 65);
  assert.equal(decoded.minimumRawJ.particleIndex, 64);
  assert.equal(decoded.minimumRawJ.rawGatherDeterminant, -2);
  assert.equal(decoded.minimumRawJ.effectiveRawDeterminant, 24);
  assert.deepEqual(decoded.minimumRawJ.gatheredAffineCPerS, [1,2,3,4,5,6,7,8,9]);
  assert.deepEqual(decoded.minimumRawJ.effectiveAffineCPerS, Array(9).fill(0));
  assert.equal(decoded.maximumDisplacement.missingSupport, true);
  assert.equal(decoded.maximumDisplacement.clippedSupport, true);
  assert.equal(decoded.readbackBytes, 512);
  assert.equal(decoded.diagnosticOnly, true);
  assert.equal(decoded.authoritativeStateMutation, false);
  assert.match(decoded.scope, /not cross-level endpoint or energy admission/);
});

function rig() {
  const owned = [], writes = [], calls = [];
  const device = {
    createBuffer(descriptor) { const b = { ...descriptor, destroyed: false, destroy() { this.destroyed = true; } }; owned.push(b); return b; },
    createShaderModule: descriptor => descriptor,
    createBindGroupLayout: descriptor => descriptor,
    createPipelineLayout: descriptor => descriptor,
    createComputePipeline: descriptor => descriptor,
    createBindGroup: descriptor => descriptor,
    queue: { writeBuffer(...args) { writes.push(args); }, submit() { assert.fail('encode must not submit'); } }
  };
  const pass = { setPipeline() {}, setBindGroup() {}, dispatchWorkgroups(n) { calls.push(n); }, end() { calls.push('end'); } };
  const options = { device, encoder: { beginComputePass: () => pass }, particleCount: 3,
    dtS: 0.01, pressureScale: 0.5, internalPressureScale: 1, gridSpacingM: 0.25,
    fieldBuffer: { size: 2048 }, fieldDiagnosticBuffer: { size: 256 }, activeSourceBuffer: { size: 512 },
    stateBuffer: { size: 96 }, mechanicsBuffer: { size: 384 } };
  return { options, owned, writes, calls };
}

test('encoder owns only fixed evidence/parameters and never submits or retires borrowed inputs', () => {
  const { options, owned, writes, calls } = rig();
  const packet = encodeSchroederRejectedParticleDiagnostic(options);
  assert.deepEqual(owned.map(b => b.size), [512, 32]);
  assert.deepEqual(calls, [1, 'end']);
  const params = new Float32Array(writes[0][2].buffer);
  assert.equal(params[5], 0.5); assert.equal(params[6], 1);
  packet.destroy(); packet.destroy();
  assert.ok(owned.every(b => b.destroyed));
  assert.equal(options.stateBuffer.destroyed, undefined);
});

test('encoder packs the reciprocal of the original spacing, matching live G2P', () => {
  const { options, writes } = rig();
  const gridSpacingM = 0.03;
  const packet = encodeSchroederRejectedParticleDiagnostic({ ...options, gridSpacingM });
  const params = new Float32Array(writes[0][2].buffer);
  assert.equal(params[1], Math.fround(gridSpacingM));
  assert.equal(params[2], Math.fround(1 / gridSpacingM));
  assert.notEqual(params[2], Math.fround(1 / Math.fround(gridSpacingM)));
  packet.destroy();
});

for (const [key, values] of Object.entries({
  particleCount: [0, -1, 1.5, 0x01000001], stateStrideBytes: [16, 128], mechanicsStrideBytes: [32],
  dtS: [0, NaN, Infinity, 1e-100], gridSpacingM: [0, undefined, Infinity, 1e-100],
  pressureScale: [NaN, Infinity], internalPressureScale: [undefined, NaN, Infinity]
})) {
  test(`encoder rejects invalid ${key} before allocation`, () => {
    for (const value of values) {
      const { options, owned } = rig();
      assert.throws(() => encodeSchroederRejectedParticleDiagnostic({ ...options, [key]: value }), TypeError);
      assert.equal(owned.length, 0);
    }
  });
}

test('encoder rejects undersized or nonexact pressure packets before allocation', () => {
  for (const [key, size] of [['fieldBuffer',255], ['fieldDiagnosticBuffer',512], ['activeSourceBuffer',4],
    ['stateBuffer',95], ['mechanicsBuffer',383]]) {
    const { options, owned } = rig();
    assert.throws(() => encodeSchroederRejectedParticleDiagnostic({ ...options, [key]: { size } }), /buffer range/);
    assert.equal(owned.length, 0);
  }
});
