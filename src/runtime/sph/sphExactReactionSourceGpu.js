import { sphReactionStepWgsl } from '../../../ulg-gpu-abi/src/wgsl.js';
import { compileSphExactReactionAllocation, resolveSphExactReactionAllocation,
  encodeSphExactReactionAllocationWeights } from './sphExactReactionAllocation.js';
import { createSphExactReactionAllocationWgsl } from './sphExactReactionAllocationWgsl.js';
import { encodeSphExactReactionKineticScale, createSphExactReactionKineticCapWgsl }
  from './sphExactReactionKineticCap.js';
import { acquireSphThermalExactMassSourceCapture } from './sphThermalGpuKernel.js';
import { acquireSchroederSpatialReactionDiscoveryProposalRead }
  from './schroederSpatialReactionDiscoveryProposalGpu.js';
import { computeBufferBinding, prewarmCachedExplicitComputePipeline,
  deferConfirmedSubmittedWorkCleanup } from '../webgpuComputeLayout.js';
import { tagWebGpuBufferDevice } from './sphGpuDeviceIdentity.js';

export const SPH_EXACT_REACTION_SOURCE_SCHEMA = 'peercompute.ulg.exact-reaction-source-selection.v1';
const RECORDS = new WeakMap();
const RULE_WORDS = 24;
export const SPH_EXACT_REACTION_SOURCE_HEADER_WORDS = 12;
const HEADER_WORDS = SPH_EXACT_REACTION_SOURCE_HEADER_WORDS;

// Use the actual production kinetic law, including its existing f32 geometry.
// This preparation is not admission of the unresolved low-part caloric/volume
// coupling. Keep one law source: a changed production declaration fails here
// rather than silently leaving an independent numeric candidate behind.
const kineticLaw = sphReactionStepWgsl.match(
  /const INTERFACE_FLUX_REFERENCE_TEMPERATURE_K: f32 = [\s\S]*?\n}\n/
)?.[0];
if (!kineticLaw) throw new Error('Missing production reaction interface-flux law');
if ((kineticLaw.match(/return no_cap;/g) ?? []).length !== 2
    || !kineticLaw.includes('return mobile_rate * contact_area * dt_s;')) {
  throw new Error('Changed production reaction cap branches require review');
}
const taggedKineticLaw = 'struct ExactSourceFlux { extent: f32, enabled: u32 }\n' + kineticLaw
  .replace('fn interface_flux_extent_cap_mol(', 'fn es_interface_flux_cap(')
  .replace(') -> f32 {', ') -> ExactSourceFlux {')
  .replaceAll('return no_cap;', 'return ExactSourceFlux(0.0, 0u);')
  .replace('return mobile_rate * contact_area * dt_s;', 'return ExactSourceFlux(mobile_rate * contact_area * dt_s, 1u);');
const phaseLaw = sphReactionStepWgsl.match(/fn phase_mask_satisfied\([\s\S]*?\n}\n/)?.[0];
if (!phaseLaw) throw new Error('Missing production reaction phase predicate');

export function createSphExactReactionSourceSelectionWgsl(format) {
  return createSphExactReactionAllocationWgsl(format)
    + createSphExactReactionKineticCapWgsl(format) + taggedKineticLaw + phaseLaw + /* wgsl */ `
struct ExactSourceParams {
  count: u32, reaction_count: u32, inventory_word_offset: u32, record_words: u32,
  dt_bits: u32, generation_id: u32, support_epoch: u32, support_profile: u32
}
@group(0) @binding(0) var<storage, read> es_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> es_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> es_mechanics: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> es_inventory: array<u32>;
@group(0) @binding(4) var<storage, read> es_proposals: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read> es_metadata: array<u32>;
@group(0) @binding(6) var<storage, read_write> es_output: array<u32>;
@group(0) @binding(7) var<storage, read> es_evidence: array<u32>;
@group(0) @binding(8) var<uniform> es_params: ExactSourceParams;
fn ek_scale_word(index: u32) -> u32 { return es_metadata[index]; }
fn es_finite(v: vec4<f32>) -> bool { return all(abs(v) <= vec4<f32>(3.402823e38)); }
fn es_float(index: u32) -> f32 { return bitcast<f32>(es_metadata[index]); }
fn es_weight(offset: u32) -> ExactMass {
  var value: ExactMass;
  for (var i = 0u; i < EM_WORDS; i++) { value.words[i] = es_metadata[offset + i]; }
  return value;
}
fn es_mass(row: u32) -> ExactMass {
  var value: ExactMass;
  for (var i = 0u; i < EM_WORDS; i++) {
    value.words[i] = es_inventory[es_params.inventory_word_offset + row * EM_WORDS + i];
  }
  return value;
}
fn es_store(offset: u32, value: ExactMass) {
  for (var i = 0u; i < EM_WORDS; i++) { es_output[offset + i] = value.words[i]; }
}
fn es_load_output(offset: u32) -> ExactMass {
  var value: ExactMass;
  for (var i = 0u; i < EM_WORDS; i++) { value.words[i] = es_output[offset + i]; }
  return value;
}
fn es_volume_ready(row: u32) -> bool {
  let volume = es_mechanics[row * 8u + 4u];
  let current = volume.z * volume.w;
  return volume.z > 0.0 && volume.w > 0.0 && current > 0.0
    && volume.z <= 3.402823e38 && volume.w <= 3.402823e38 && current <= 3.402823e38
    && es_mechanics[row * 8u + 5u].y == 1.0 && es_mechanics[row * 8u + 6u].w == 1.0;
}
@compute @workgroup_size(1)
fn prepare_exact_reaction_sources(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x;
  if (row >= es_params.count) { return; }
  let out = row * es_params.record_words;
  // The discovery seal also poisons all rows on failure. Check the original
  // GPU receipt independently so partial or mismatched discovery cannot select.
  if (es_evidence[0u] != es_params.count || es_evidence[1u] != es_params.count
      || es_evidence[2u] != 0u || es_evidence[5u] != 0u || es_evidence[8u] != 0u
      || es_evidence[6u] > es_params.count || es_evidence[7u] != es_params.count
      || es_evidence[9u] != es_params.support_profile || es_evidence[14u] != 0u
      || es_evidence[15u] != 0u || es_evidence[21u] != 0x3f800000u
      || es_evidence[10u] != es_params.generation_id || es_evidence[11u] != es_params.support_epoch
      || es_evidence[12u] != es_params.count || es_evidence[13u] != es_params.reaction_count) {
    es_output[out + 1u] = 2097152u; return;
  }
  let proposal = es_proposals[row];
  if (!es_finite(proposal) || proposal.x <= f32(row) || proposal.x >= f32(es_params.count)
      || proposal.x != floor(proposal.x) || proposal.y < 0.0
      || proposal.y >= f32(es_params.reaction_count) || proposal.y != floor(proposal.y)
      || proposal.w < 0.0) { return; }
  let peer = u32(proposal.x);
  let reciprocal = es_proposals[peer];
  if (!es_finite(reciprocal) || reciprocal.x != f32(row)
      || reciprocal.y != proposal.y || reciprocal.w < 0.0) { return; }
  let rx = u32(proposal.y); let rule = rx * ${RULE_WORDS}u;
  let s0 = es_state[row * 2u]; let s1 = es_state[peer * 2u];
  let t0 = es_thermo[row * 3u]; let t1 = es_thermo[peer * 3u];
  let original_a = t0.x == es_float(rule + 20u) && t1.x == es_float(rule + 21u)
    && phase_mask_satisfied(es_float(rule + 16u), t0.y) && phase_mask_satisfied(es_float(rule + 17u), t1.y);
  let original_b = t1.x == es_float(rule + 20u) && t0.x == es_float(rule + 21u)
    && phase_mask_satisfied(es_float(rule + 16u), t1.y) && phase_mask_satisfied(es_float(rule + 17u), t0.y);
  let delta = s0.xyz - s1.xyz; let distance2 = dot(delta, delta);
  let radius = es_float(rule + 15u); let radius2 = radius * radius;
  if (!es_finite(s0) || !es_finite(s1) || !es_finite(t0) || !es_finite(t1)
      || original_a == original_b || proposal.z != select(2.0, 1.0, original_a)
      || reciprocal.z != select(1.0, 2.0, original_a)
      || es_float(rule + 18u) != 1.0 || !(radius > 0.0)
      || !(distance2 <= radius2) || !(radius2 <= 3.402823e38)
      || max(t0.z, t1.z) < es_float(rule + 14u)) { return; }
  // Compiler term order owns the stoichiometric partition. Particle order only
  // selects the one writer; reversing the endpoints must not exchange weights.
  let a = select(peer, row, t0.x == f32(es_metadata[rule + 4u]));
  let b = select(row, peer, a == row);
  let ta = es_thermo[a * 3u]; let tb = es_thermo[b * 3u];
  if (ta.x != f32(es_metadata[rule + 4u]) || tb.x != f32(es_metadata[rule + 6u])
      ) { return; }
  let ma = es_mass(a); let mb = es_mass(b);
  let total = em_add(ma, mb); let pa = em_project_f32_bits(ma); let pb = em_project_f32_bits(mb);
  var error = total.error | pa.error | pb.error;
  if (pa.bits != bitcast<u32>(es_state[a * 2u].w) || pb.bits != bitcast<u32>(es_state[b * 2u].w)
      || !es_volume_ready(a) || !es_volume_ready(b)
      || !(ta.w > 0.0) || !(tb.w > 0.0)) { error |= 1048576u; }
  es_output[out + 2u] = a; es_output[out + 3u] = b; es_output[out + 4u] = rx;
  es_output[out + 5u] = es_metadata[rule + 2u]; es_output[out + 7u] = es_params.dt_bits;
  if (error != 0u) { es_output[out + 1u] = error; return; }
  var cap = total.value;
  let flux_a = es_float(rule + 10u); let flux_b = es_float(rule + 13u);
  let dt = bitcast<f32>(es_params.dt_bits);
  // No-flux is an explicit branch. Overflow/NaN from a real enabled law can
  // never be confused with the legacy numeric no-cap sentinel.
  let flux = es_interface_flux_cap(bitcast<f32>(pa.bits), ta.w, ta.z,
      es_float(rule + 8u), es_float(rule + 9u), flux_a,
      bitcast<f32>(pb.bits), tb.w, tb.z, es_float(rule + 11u), es_float(rule + 12u), flux_b, dt);
  es_output[out + 8u] = flux.enabled;
  if (flux.enabled != 0u) {
    es_output[out + 6u] = bitcast<u32>(flux.extent);
    let selected_cap = ek_cap_from_extent(bitcast<u32>(flux.extent), es_metadata[rule + 1u], total.value);
    if (selected_cap.error != 0u) { es_output[out + 1u] = selected_cap.error; return; }
    cap = selected_cap.value;
  }
  let amounts = out + ${HEADER_WORDS}u;
  es_store(amounts + 3u * EM_WORDS, ma); es_store(amounts + 4u * EM_WORDS, mb);
  es_store(amounts + 5u * EM_WORDS, cap); es_store(amounts + 6u * EM_WORDS, total.value);
  es_output[out] = 2u;
}

@compute @workgroup_size(1)
fn select_exact_reaction_debits(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= es_params.count) { return; }
  let out = id.x * es_params.record_words;
  if (es_output[out] != 2u) { return; }
  let weights = es_metadata[es_output[out + 4u] * ${RULE_WORDS}u];
  let amounts = out + ${HEADER_WORDS}u;
  let selected = er_select_debits(es_load_output(amounts + 3u * EM_WORDS),
    es_load_output(amounts + 4u * EM_WORDS), es_load_output(amounts + 5u * EM_WORDS),
    es_weight(weights + 8u), es_weight(weights + 8u + EM_WORDS));
  es_store(amounts, selected.total); es_store(amounts + EM_WORDS, selected.debit_a);
  es_store(amounts + 2u * EM_WORDS, selected.debit_b); es_store(amounts + 3u * EM_WORDS, selected.remainder_a);
  es_store(amounts + 4u * EM_WORDS, selected.remainder_b);
  es_output[out + 1u] = selected.error;
  es_output[out] = select(0u, 3u, selected.error == 0u && selected.executed != 0u);
}

@compute @workgroup_size(1)
fn partition_exact_reaction_products(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= es_params.count) { return; }
  let out = id.x * es_params.record_words;
  if (es_output[out] != 3u) { return; }
  let rule = es_output[out + 4u] * ${RULE_WORDS}u;
  let weights = es_metadata[rule];
  let amounts = out + ${HEADER_WORDS}u;
  let selected = ExactReactionDebits(es_load_output(amounts), es_load_output(amounts + EM_WORDS),
    es_load_output(amounts + 2u * EM_WORDS), es_load_output(amounts + 3u * EM_WORDS),
    es_load_output(amounts + 4u * EM_WORDS), 0u, 1u);
  var error = 0u;
  for (var term = 0u; term < es_metadata[rule + 2u]; term++) {
    let weight = weights + 8u + 3u * EM_WORDS + term * (4u + 2u * EM_WORDS);
    let product = er_product_share(selected, es_weight(weight + 4u),
      es_weight(weight + 4u + EM_WORDS), es_weight(weights + 8u + 2u * EM_WORDS));
    let dest = amounts + 7u * EM_WORDS + term * (4u + 3u * EM_WORDS);
    for (var field = 0u; field < 3u; field++) { es_output[dest + field] = es_metadata[weight + field]; }
    es_output[dest + 3u] = product.error;
    es_store(dest + 4u, product.mass); es_store(dest + 4u + EM_WORDS, product.from_a);
    es_store(dest + 4u + 2u * EM_WORDS, product.from_b); error |= product.error;
  }
  es_output[out + 1u] = error;
  // PREPARED only. No accepted reaction marker or physical owner is issued.
  es_output[out] = select(0u, selected.executed, error == 0u);
}
`;
}

function metadataFor(compiled, table) {
  const blocks = compiled.map(token => [encodeSphExactReactionAllocationWeights(token), encodeSphExactReactionKineticScale(token)]);
  const headerSize = compiled.length * RULE_WORDS;
  const words = new Uint32Array(headerSize + blocks.reduce((sum, pair) => sum + pair[0].length + pair[1].length, 0));
  const floats = new Float32Array(words.buffer); let offset = headerSize;
  compiled.forEach((token, index) => {
    const rule = index * RULE_WORDS, [a, b] = token.reactants;
    words[rule] = offset; words.set(blocks[index][0], offset); offset += blocks[index][0].length;
    words[rule + 1] = offset; words.set(blocks[index][1], offset); offset += blocks[index][1].length;
    words[rule + 2] = token.products.length;
    words.set([a.materialId, a.targetPhase, b.materialId, b.targetPhase], rule + 4);
    const ar = a.termIndex * 12, br = b.termIndex * 12, rx = index * 12;
    floats.set([table.reactantTermRecords[ar + 2], table.reactantTermRecords[ar + 3], table.reactantTermRecords[ar + 11],
      table.reactantTermRecords[br + 2], table.reactantTermRecords[br + 3], table.reactantTermRecords[br + 11],
      table.records[rx + 3], table.records[rx + 5], table.records[rx + 6], table.records[rx + 7], table.records[rx + 8]], rule + 8);
    floats.set([table.records[rx], table.records[rx + 1]], rule + 20);
  });
  return words;
}

export function sphExactReactionSourcePipelineDescriptors(format) {
  const code = createSphExactReactionSourceSelectionWgsl(format);
  return ['prepare_exact_reaction_sources', 'select_exact_reaction_debits', 'partition_exact_reaction_products']
    .map(entryPoint => ({
      label: 'ulg-exact-reaction-source-selection', cacheKey: `exact-reaction-source-${format.wordCount}-${format.quantumExponent}`,
      code, entryPoint, bindings: Array.from({ length: 9 }, (_, index) => computeBufferBinding(index,
        index === 8 ? 'uniform' : index === 6 ? 'storage' : 'read-only-storage'))
    }));
}

/** Execute exact numeric preparation from original producer captures. This
 * does not replace the physical reaction/placement runner or publish uploads.
 * All rows remain candidates until caloric, mechanics and placement accept. */
export async function runSphExactReactionSourceSelectionWebGpu(options = {}) {
  const args = { ...options };
  const { device, thermalResult, thermalSourceCapture, reactionTable, thermalMaterialTable,
    sphParticleUpload, mlsMpmParticleUpload, sphParticleState, g2pResult,
    transaction, generation, dtSeconds, reactionDiscoveryProposal } = args;
  let source, discovery, result, completion = null, submitted = false, closed = false, confirmed = false;
  const owned = [];
  const destroyed = new Set();
  const release = () => {
    if (completion) return completion;
    closed = true;
    const cleanup = () => {
      confirmed = true;
      const errors = [];
      for (const buffer of owned) {
        if (destroyed.has(buffer)) continue;
        try { buffer.destroy(); destroyed.add(buffer); } catch (error) { errors.push(error); }
      }
      discovery?.release();
      if (errors.length) throw new AggregateError(errors, 'Exact reaction source cleanup failed');
    };
    const retired = submitted && !confirmed ? deferConfirmedSubmittedWorkCleanup(device, cleanup)
      : Promise.resolve().then(cleanup);
    completion = Promise.all([retired, source?.release()]).then(() => {
      if (result) RECORDS.delete(result);
      source = null; discovery = null; owned.length = 0; destroyed.clear();
      return true;
    }, error => { completion = null; throw error; });
    return completion;
  };
  try {
    const data = (object, key) => {
      const descriptor = Object.getOwnPropertyDescriptor(object ?? {}, key);
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) throw new TypeError(`Original producer ${key} must be data`);
      return descriptor.value;
    };
    discovery = acquireSchroederSpatialReactionDiscoveryProposalRead(reactionDiscoveryProposal,
      { device, generation, particleCount: data(sphParticleState, 'particleCount'), reactionCount: reactionTable?.reactionCount,
        reactionTable, sourceStateBuffer: data(thermalResult, 'stateBuffer'), sourceThermoBuffer: data(thermalResult, 'thermoBuffer'),
        sourceMechanicsBuffer: data(g2pResult, 'mechanicsBuffer') });
    source = await acquireSphThermalExactMassSourceCapture(thermalResult, thermalSourceCapture,
      { device, sphParticleUpload, mlsMpmParticleUpload, sphParticleState, g2pResult,
        transaction, generation, dtSeconds, thermalMaterialTable });
    if (discovery.view.sourceCurrentStateBuffer !== source.stateBuffer
        || discovery.view.sourceThermoBuffer !== source.thermoBuffer
        || discovery.view.sourceMechanicsBuffer !== source.mechanicsBuffer
        || discovery.view.particleCount !== source.particleCount) throw new TypeError('Exact reaction source tuple changed');
    const numeric = source.sourceRead.read, format = numeric.format;
    const compiled = Array.from({ length: reactionTable.reactionCount }, (_, reactionIndex) =>
      compileSphExactReactionAllocation({ reactionTable, thermalMaterialTable, reactionIndex, format }));
    if (!compiled.length) throw new TypeError('Exact reaction source selection requires reaction rules');
    const maxProducts = Math.max(...compiled.map(token => token.products.length));
    const recordWords = HEADER_WORDS + 7 * format.wordCount + maxProducts * (4 + 3 * format.wordCount);
    const outputByteLength = source.particleCount * recordWords * 4;
    if (!Number.isSafeInteger(outputByteLength) || outputByteLength < 4
        || outputByteLength > device.limits.maxStorageBufferBindingSize
        || source.particleCount > device.limits.maxComputeWorkgroupsPerDimension) {
      throw new RangeError('Exact reaction selection exceeds device capacity');
    }
    const metadata = metadataFor(compiled, reactionTable);
    const params = new Uint32Array([source.particleCount, compiled.length, numeric.rowOffset * format.wordCount,
      recordWords, source.encodedDtBits, discovery.view.generationId, discovery.view.epochIdentity.supportEpoch,
      reactionDiscoveryProposal.supportProfileId]);
    const allocate = (label, size, usage) => {
      const buffer = device.createBuffer({ label, size, usage }); owned.push(buffer);
      tagWebGpuBufferDevice(buffer, device); return buffer;
    };
    const outputBuffer = allocate('ulg-exact-reaction-source-selection', outputByteLength, 128 | 8 | 4);
    const metadataBuffer = allocate('ulg-exact-reaction-source-metadata', metadata.byteLength, 128 | 8);
    const paramsBuffer = allocate('ulg-exact-reaction-source-params', 32, 64 | 8);
    // Cold compilation must finish before submitting the numerical work. In
    // particular, large exact formats must not queue synchronous compilation
    // behind the same submission that needs those pipelines. Producer reads
    // remain independently held across every compilation await.
    const pipelines = [];
    for (const descriptor of sphExactReactionSourcePipelineDescriptors(format)) {
      const pipeline = await prewarmCachedExplicitComputePipeline(device, descriptor);
      if (!pipeline.pipeline) throw pipeline.error ?? new Error(`Exact reaction pipeline unavailable: ${descriptor.entryPoint}`);
      pipelines.push(pipeline);
    }
    const validate = () => {
      if (closed) throw new TypeError('Exact reaction source selection was released');
      source.validate(); discovery.validate();
      for (const token of compiled) resolveSphExactReactionAllocation(token, { reactionTable, thermalMaterialTable, format });
      return true;
    };
    validate();
    device.queue.writeBuffer(metadataBuffer, 0, metadata); device.queue.writeBuffer(paramsBuffer, 0, params);
    const entries = [source.stateBuffer,
      source.thermoBuffer, source.mechanicsBuffer, numeric.buffer, discovery.view.proposalBuffer,
      metadataBuffer, outputBuffer, discovery.view.evidenceBuffer, paramsBuffer]
      .map((buffer, binding) => ({ binding, resource: { buffer } }));
    const encoder = device.createCommandEncoder(); encoder.clearBuffer(outputBuffer);
    for (const { pipeline, bindGroupLayout } of pipelines) {
      const bindGroup = device.createBindGroup({ layout: bindGroupLayout, entries });
      const pass = encoder.beginComputePass(); pass.setPipeline(pipeline); pass.setBindGroup(0, bindGroup);
      pass.dispatchWorkgroups(source.particleCount); pass.end();
    }
    const command = encoder.finish(); validate();
    submitted = true; device.queue.submit([command]);
    result = Object.freeze({ schema: SPH_EXACT_REACTION_SOURCE_SCHEMA,
      outputBuffer, outputByteLength, particleCount: source.particleCount, recordWords, headerWords: HEADER_WORDS,
      format, physicalPublicationAdmitted: false, kineticGeometry: 'current-production-f32-law',
      encodedDtBits: source.encodedDtBits, release });
    RECORDS.set(result, { result, device, source, discovery, compiled, validate });
    return result;
  } catch (error) {
    error.exactReactionSourceCleanupCompletion = Promise.all([
      release(), error.exactThermalSourceCleanupCompletion
    ]).then(() => true);
    throw error;
  }
}

export function resolveSphExactReactionSourceSelection(result, { device } = {}) {
  const record = RECORDS.get(result);
  if (!record || record.device !== device) throw new TypeError('Original exact reaction selection required');
  record.validate();
  return Object.freeze({ source: record.source, compiled: Object.freeze([...record.compiled]), result });
}
