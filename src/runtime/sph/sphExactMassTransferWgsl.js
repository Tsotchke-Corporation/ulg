import { createSphExactMassWgsl } from './sphExactMassWgsl.js';

export const SPH_EXACT_MASS_TRANSFER_MAGIC = 0x454d5431;
export const SPH_EXACT_MASS_TRANSFER_ERROR = Object.freeze({
  LAYOUT: 64, ENDPOINT: 128, ALIAS: 256, COMPLETION: 512, STORED_STATE: 1024,
  NONZERO_DROP: 2048
});

// Prescribed mass-only graph. Each row has one writer and gathers from immutable
// source. Incoming packets cannot finance outgoing packets in this interval.
// This initial gather is O(rows * edges); physical cell batching is a separate
// integration concern. It has no phase, energy, kinetic or publication authority.
export function createSphExactMassTransferWgsl(format, { partition = false, allocation = false } = {}) {
  if (allocation && !partition) throw new TypeError('Exact allocation requires the remapped source domain');
  const E = SPH_EXACT_MASS_TRANSFER_ERROR;
  return createSphExactMassWgsl(format) + /* wgsl */ `
const EM_EDGE_WORDS: u32 = ${allocation ? '3u * EM_WORDS + 2u' : 'EM_WORDS + 2u'};
${partition ? `struct PartitionParams {
  x: u32, y: u32, z: u32, w: u32,
  sourceRows: u32, sourceCount: u32, reserved: vec2<u32>
}
@group(0) @binding(0) var<uniform> params: PartitionParams;`
  : '@group(0) @binding(0) var<uniform> params: vec4<u32>;'}
@group(0) @binding(1) var<storage, read> source: array<u32>;
@group(0) @binding(2) var<storage, read> edges: array<u32>;
@group(0) @binding(3) var<storage, read_write> candidate: array<u32>;
@group(0) @binding(4) var<storage, read_write> control: array<atomic<u32>>;
${partition ? '@group(0) @binding(5) var<storage, read> destinations: array<u32>;' : ''}

fn em_layout() -> bool {
  ${partition ? `return arrayLength(&control) == 16u && params.x > 0u
    && params.sourceRows > 0u && params.sourceCount > 0u
    && params.sourceRows <= arrayLength(&source) / EM_WORDS
    && arrayLength(&source) == params.sourceRows * EM_WORDS
    && arrayLength(&destinations) == params.sourceRows
    && params.x <= arrayLength(&candidate) / EM_WORDS
    && arrayLength(&candidate) == params.x * EM_WORDS
    && params.y <= arrayLength(&edges) / EM_EDGE_WORDS
    && arrayLength(&edges) == select(params.y * EM_EDGE_WORDS, 1u, params.y == 0u)
    && all(params.reserved == vec2<u32>(${allocation ? 1 : 0}u, 0u));` : `
  return arrayLength(&control) == 16u && params.x > 0u && params.y > 0u
    && params.x <= arrayLength(&source) / EM_WORDS
    && arrayLength(&source) == params.x * EM_WORDS
    && arrayLength(&candidate) == arrayLength(&source)
    && params.y <= arrayLength(&edges) / EM_EDGE_WORDS
    && arrayLength(&edges) == params.y * EM_EDGE_WORDS;`}
}
fn em_source_row(row: u32) -> ExactMass {
  var value: ExactMass;
  for (var i = 0u; i < EM_WORDS; i++) { value.words[i] = source[row * EM_WORDS + i]; }
  return value;
}
fn em_initial_row(row: u32) -> ExactMassResult {
  ${partition ? `var value: ExactMass;
  var errors = 0u;
  for (var sourceRow = 0u; sourceRow < params.sourceRows; sourceRow++) {
    let destination = destinations[sourceRow];
    let sourceValue = em_source_row(sourceRow);
    if (destination == 0xffffffffu) {
      var nonzero = 0u;
      for (var i = 0u; i < EM_WORDS; i++) { nonzero |= sourceValue.words[i]; }
      if (nonzero != 0u) { errors |= ${E.NONZERO_DROP}u; }
    } else if (destination >= params.x) {
      errors |= ${E.ENDPOINT}u;
    } else if (destination == row) {
      let sum = em_add(value, sourceValue); value = sum.value; errors |= sum.error;
    }
  }
  return ExactMassResult(value, errors);` : 'return ExactMassResult(em_source_row(row), 0u);'}
}
fn em_expected_row(row: u32) -> ExactMassResult {
  let initial = em_initial_row(row);
  let original = initial.value;
  var outgoing: ExactMass; var incoming: ExactMass;
  var errors = initial.error;
  for (var edge = 0u; edge < params.y; edge++) {
    let base = edge * EM_EDGE_WORDS;
    let donor = edges[base]; let receiver = edges[base + 1u];
    if (donor >= params.x || receiver >= params.x) { errors |= ${E.ENDPOINT}u; continue; }
    if (donor == receiver) { errors |= ${E.ALIAS}u; continue; }
    if (donor != row && receiver != row) { continue; }
    var packet: ExactMass;
    ${allocation ? `var lower: ExactMass; var upper: ExactMass; var denominator: ExactMass;
    for (var i = 0u; i < EM_WORDS; i++) {
      lower.words[i] = edges[base + 2u + i];
      upper.words[i] = edges[base + 2u + EM_WORDS + i];
      denominator.words[i] = edges[base + 2u + 2u * EM_WORDS + i];
    }
    let available = em_initial_row(donor);
    let selected = em_partition_share(available.value, lower, upper, denominator);
    errors |= available.error | selected.error;
    packet = selected.value;` : `
    for (var i = 0u; i < EM_WORDS; i++) { packet.words[i] = edges[base + 2u + i]; }
    `}
    if (donor == row) {
      let sum = em_add(outgoing, packet); outgoing = sum.value; errors |= sum.error;
    } else {
      let sum = em_add(incoming, packet); incoming = sum.value; errors |= sum.error;
    }
  }
  let debit = em_subtract(original, outgoing);
  let credit = em_add(debit.value, incoming);
  errors |= debit.error | credit.error;
  if (errors != 0u) { return ExactMassResult(original, errors); }
  return ExactMassResult(credit.value, 0u);
}
@compute @workgroup_size(64)
fn exact_mass_gather(@builtin(global_invocation_id) id: vec3<u32>) {
  if (arrayLength(&control) != 16u) { return; }
  if (!em_layout()) { atomicOr(&control[3], ${E.LAYOUT}u); return; }
  if (id.x >= params.x) { return; }
  let expected = em_expected_row(id.x);
  atomicOr(&control[3], expected.error);
  for (var i = 0u; i < EM_WORDS; i++) { candidate[id.x * EM_WORDS + i] = expected.value.words[i]; }
}
@compute @workgroup_size(64)
fn exact_mass_validate(@builtin(global_invocation_id) id: vec3<u32>) {
  if (arrayLength(&control) != 16u) { return; }
  if (!em_layout()) { atomicOr(&control[3], ${E.LAYOUT}u); return; }
  if (id.x >= params.x) { return; }
  let expected = em_expected_row(id.x);
  var errors = expected.error;
  for (var i = 0u; i < EM_WORDS; i++) {
    if (candidate[id.x * EM_WORDS + i] != expected.value.words[i]) { errors |= ${E.STORED_STATE}u; }
  }
  atomicOr(&control[3], errors);
  atomicAdd(&control[6], 1u);
}
@compute @workgroup_size(1)
fn exact_mass_finalize() {
  if (arrayLength(&control) != 16u) { return; }
  if (!em_layout()) { atomicOr(&control[3], ${E.LAYOUT}u); }
  if (atomicLoad(&control[6]) != params.x) { atomicOr(&control[3], ${E.COMPLETION}u); }
  atomicStore(&control[0], ${SPH_EXACT_MASS_TRANSFER_MAGIC}u);
  atomicStore(&control[1], ${allocation ? 3 : partition ? 2 : 1}u);
  atomicStore(&control[2], select(2u, 1u, atomicLoad(&control[3]) == 0u));
  atomicStore(&control[4], params.x); atomicStore(&control[5], params.y);
  atomicStore(&control[7], params.w); atomicStore(&control[8], params.z);
  ${partition ? 'atomicStore(&control[9], params.sourceRows); atomicStore(&control[10], params.sourceCount);' : ''}
}
`;
}
