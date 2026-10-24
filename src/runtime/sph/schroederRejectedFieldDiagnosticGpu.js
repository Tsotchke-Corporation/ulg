import {
  computeBufferBinding,
  createCachedExplicitComputePipeline
} from '../webgpuComputeLayout.js';

// Diagnostic evidence only: one GPU-selected row, never an arena readback or
// an input to mechanics admission. All inputs stay read-only on the device.
export const SCHROEDER_REJECTED_FIELD_DIAGNOSTIC_WORDS = 64;
export const schroederRejectedFieldDiagnosticWgsl = /* wgsl */ `
@group(0) @binding(0) var<storage, read> field_view: array<u32>;
@group(0) @binding(1) var<storage, read> reflux: array<u32>;
@group(0) @binding(2) var<storage, read> moment: array<u32>;
@group(0) @binding(3) var<storage, read> moment_control: array<u32>;
@group(0) @binding(4) var<storage, read> scratch: array<u32>;
@group(0) @binding(5) var<storage, read_write> evidence: array<u32>;
struct Params { identity: vec4<u32>, step: vec4<u32>, owner_identity: vec4<u32> };
@group(0) @binding(6) var<uniform> params: Params;
fn row_fits(base: u32, row: u32, stride: u32, size: u32) -> bool {
  return stride > 0u && base <= size && row < (size - base) / stride;
}
@compute @workgroup_size(1)
fn main() {
  for (var i = 0u; i < 64u; i++) { evidence[i] = 0u; }
  evidence[0] = 0x53444631u; evidence[1] = 1u;
  evidence[5] = params.identity.y;
  if (arrayLength(&reflux) < 136u) { evidence[2] = 3u; return; }
  let tag = reflux[124u]; evidence[3] = tag;
  if (tag == 0xffffffffu) { return; }
  // The tag is macro-wide first-claim evidence. A later substep's field arena
  // must not be indexed using an earlier substep's ordinal.
  if ((tag & 0xff000000u) != 0xc7000000u
      || ((tag >> 22u) & 3u) != 0u || (tag & 0x10000u) != 0u
      || params.step.x != 1u || reflux[8u] != params.identity.w
      || reflux[0u] != 0x53524c33u || reflux[1u] != 3u
      || (reflux[2u] & 36u) != 36u
      || reflux[7u] != params.owner_identity.x || reflux[82u] != params.owner_identity.y
      || reflux[83u] != params.owner_identity.z || reflux[77u] != params.identity.y) {
    evidence[2] = 2u; return;
  }
  let field = tag & 0xffffu; evidence[4] = field;
  if (arrayLength(&field_view) < 64u) { evidence[2] = 3u; return; }
  evidence[6] = field_view[3u]; evidence[7] = field_view[38u];
  evidence[8] = field_view[63u]; evidence[60] = field_view[23u];
  evidence[61] = params.step.y; evidence[62] = params.step.z;
  evidence[63] = params.identity.z;
  if (field_view[0u] != 0x53464635u || field_view[1u] != 5u
      || field_view[3u] != params.identity.x
      || field_view[17u] != params.identity.y
      || field_view[59u] != 2u
      || field >= field_view[34u] || field >= field_view[32u]) {
    evidence[2] = 4u; return;
  }
  if (field_view[27u] != 4u || field_view[31u] != 8u
      || !row_fits(field_view[26u], field, 4u, arrayLength(&field_view))
      || !row_fits(field_view[30u], field, 8u, arrayLength(&field_view))) {
    evidence[2] = 3u; return;
  }
  let key = field_view[26u] + field * 4u;
  let state = field_view[30u] + field * 8u;
  for (var i = 0u; i < 4u; i++) { evidence[12u + i] = field_view[key + i]; }
  for (var i = 0u; i < 8u; i++) { evidence[16u + i] = field_view[state + i]; }
  evidence[11] = 1u;
  if (arrayLength(&moment_control) < 64u
      || moment_control[0u] != 0x53505631u || moment_control[1u] != 1u
      || moment_control[2u] != 3u
      || moment_control[3u] != field_view[3u]
      || moment_control[20u] != field_view[17u]
      || moment_control[23u] != field_view[38u]
      || moment_control[18u] != field_view[34u]
      || moment_control[29u] != 12u
      || !row_fits(moment_control[28u], field, 12u, arrayLength(&moment))) {
    evidence[2] = 7u; return;
  }
  for (var i = 8u; i < 16u; i++) {
    if (moment_control[i] != field_view[i]) { evidence[2] = 7u; return; }
  }
  let m = moment_control[28u] + field * 12u;
  if (moment[m + 8u] == 0u || moment[m + 9u] != 3u) { evidence[2] = 7u; return; }
  for (var i = 0u; i < 4u; i++) {
    if (moment[m + i] != field_view[key + i]) { evidence[2] = 7u; return; }
  }
  evidence[9] = moment_control[3u]; evidence[11] = 3u;
  for (var i = 0u; i < 12u; i++) { evidence[24u + i] = moment[m + i]; }
  if (arrayLength(&scratch) < 12u) { evidence[2] = 5u; return; }
  for (var i = 0u; i < 12u; i++) { evidence[48u + i] = scratch[i]; }
  evidence[10] = scratch[6u];
  let header_seal = scratch[0u] ^ scratch[1u] ^ scratch[3u]
    ^ scratch[4u] ^ scratch[5u] ^ scratch[6u] ^ scratch[7u];
  if (scratch[0u] != 0x53425031u || scratch[1u] != 1u
      || scratch[2u] != 0u || scratch[3u] != field_view[32u]
      || scratch[4u] != field_view[3u] || scratch[5u] != field_view[38u]
      || scratch[6u] != params.identity.z || scratch[7u] != 12u
      || scratch[8u] != field_view[34u]
      || scratch[9u] != 0x53424631u || scratch[10u] != 0x53425331u
      || scratch[11u] != header_seal
      || !row_fits(12u, field, 12u, arrayLength(&scratch))) {
    evidence[2] = 6u; return;
  }
  let s = 12u + field * 12u;
  var row_seal = field ^ scratch[s + 10u];
  for (var i = 0u; i < 10u; i++) { row_seal = row_seal ^ scratch[s + i]; }
  if (scratch[s + 10u] != 0x53425259u || scratch[s + 11u] != row_seal
      || scratch[s + 7u] != field_view[state] || scratch[s + 8u] != moment[m + 4u]) {
    evidence[2] = 6u; return;
  }
  for (var i = 0u; i < 12u; i++) { evidence[36u + i] = scratch[s + i]; }
  evidence[11] = 7u; evidence[2] = 1u;
}
`;

export function decodeSchroederRejectedFieldDiagnostic(words) {
  if (!(words instanceof Uint32Array) || words.length !== 64
      || words[0] !== 0x53444631 || words[1] !== 1) {
    return Object.freeze({ status: 'rejected-field-diagnostic-invalid-packet' });
  }
  const floats = new Float32Array(words.buffer, words.byteOffset, words.length);
  const vector = (offset, count = 3) => Array.from(floats.subarray(offset, offset + count));
  const flags = words[11];
  return Object.freeze({
    status: ['no-cfl-rejection', 'rejected-field-pressure-ready',
      'unsupported-or-stale-rejection', 'row-out-of-bounds', 'field-identity-mismatch',
      'pressure-scratch-unavailable', 'pressure-scratch-mismatch',
      'moment-identity-mismatch'][words[2]] ?? 'unknown-diagnostic-status',
    tag: words[3], fieldIndex: words[4], selectedLevel: words[5] | 0,
    fieldGeneration: words[6], fieldCompletionOrdinal: words[7],
    fieldMutationOrdinal: words[8], momentGeneration: words[9],
    gasExecutionGeneration: words[10], availableSections: flags,
    key: (flags & 1) ? Array.from(words.subarray(12, 16)) : null,
    massKg: (flags & 1) ? floats[16] : null,
    velocityAtGatherMPerS: (flags & 1) ? vector(17) : null,
    volumeM3: (flags & 2) ? floats[28] : null,
    volumeGradientM2: (flags & 2) ? vector(29) : null,
    pressure: (flags & 4) ? Object.freeze({
      postGasVelocityMPerS: vector(36), cumulativeExternalImpulseNs: vector(39),
      cumulativeExternalWorkJ: floats[42], massKg: floats[43],
      volumeM3: floats[44], effectiveGaugePa: floats[45]
    }) : null,
    scratchHeader: Array.from(words.subarray(48, 60)),
    gridSpacingM: floats[60], dtS: floats[61], pressureScale: floats[62],
    expectedGasExecutionGeneration: words[63], readbackBytes: 256
  });
}

export function encodeSchroederRejectedFieldDiagnostic({
  device, encoder, fieldBuffer, refluxBuffer, phaseVolumeMoment,
  selectedLevel, generationId, refluxIdentity, scratchCapture = null
}) {
  const owned = [];
  const create = (label, size, usage) => {
    const buffer = device.createBuffer({ label, size, usage });
    owned.push(buffer); return buffer;
  };
  const destroy = () => { for (const b of owned.splice(0)) b.destroy(); };
  try {
    const buffer = create('ulg-rejected-field-diagnostic-packet', 256, 128 | 4);
    const params = create('ulg-rejected-field-diagnostic-params', 48, 64 | 8);
    const missing = create('ulg-rejected-field-diagnostic-missing', 4, 128);
    const words = new Uint32Array(12);
    words.set([generationId, selectedLevel, scratchCapture?.gasExecutionGeneration ?? 0,
      scratchCapture?.fineSubstepOrdinal ?? 0, scratchCapture ? 1 : 0]);
    new Float32Array(words.buffer).set([scratchCapture?.dtS ?? 0,
      scratchCapture?.pressureScale ?? 0], 5);
    words.set([refluxIdentity.completionOrdinal, refluxIdentity.macroOwnerId,
      refluxIdentity.ownerGeneration, 0], 8);
    device.queue.writeBuffer(params, 0, words);
    const pipeline = createCachedExplicitComputePipeline(device, {
      cacheKey: 'schroeder-rejected-field-diagnostic-v1',
      label: 'ulg-rejected-field-diagnostic', code: schroederRejectedFieldDiagnosticWgsl,
      bindings: [0, 1, 2, 3, 4].map((i) => computeBufferBinding(i))
        .concat(computeBufferBinding(5, 'storage'), computeBufferBinding(6, 'uniform'))
    });
    const resources = [fieldBuffer, refluxBuffer,
      phaseVolumeMoment?.momentBuffer ?? missing, phaseVolumeMoment?.controlBuffer ?? missing,
      scratchCapture?.buffer ?? missing, buffer, params];
    const group = device.createBindGroup({ layout: pipeline.bindGroupLayout,
      entries: resources.map((resource, binding) => ({ binding, resource: { buffer: resource } })) });
    const pass = encoder.beginComputePass({ label: 'ulg-rejected-field-diagnostic-gather' });
    pass.setPipeline(pipeline.pipeline); pass.setBindGroup(0, group);
    pass.dispatchWorkgroups(1); pass.end();
    return { buffer, destroy };
  } catch (error) { destroy(); throw error; }
}
