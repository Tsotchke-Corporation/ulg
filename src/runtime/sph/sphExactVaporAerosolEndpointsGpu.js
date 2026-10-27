import { computeBufferBinding, prewarmCachedExplicitComputePipeline } from '../webgpuComputeLayout.js';
import { createSphExactResidentProductHistoryValidationWgsl } from './sphExactResidentProductHistoryWgsl.js';

// Materialize the original candidate's complete numerical endpoint arrays.
// This neither registers history/count authority nor adopts an aerosol family.
// The exchange owner supplies allocation, source pins, submission and retirement.
export async function prepareSphExactVaporAerosolEndpoints({ device, particleRead, historyRead,
  aerosolRead, particleCount, edgeCount, edges, pairs, projection, candidateArena,
  productOffsetWords, control, allocate, validate }) {
  validate();
  const q = aerosolRead.exactQuantities.quantityLayout.recordWords;
  const l = historyRead?.layout ?? null, capacity = historyRead?.descriptor.rowCapacity ?? 0;
  const particleBuffer = allocate('exact-particle-endpoints', particleCount * q * 4, 128 | 4 | 8);
  const aerosolBuffer = allocate('exact-aerosol-endpoints', aerosolRead.capacity * q * 4, 128 | 4 | 8);
  const historyBuffer = allocate('exact-history-endpoints', l ? capacity * l.rowBytes : 4, 128 | 4 | 8);
  const historyBody = l ? /* wgsl */ `
    let h = row * ${l.rowWords}u;
    let event = ${productOffsetWords}u + row * 32u;
    let state = h + ${l.stateOffsetWords}u;
    let thermo = h + ${l.thermoOffsetWords}u;
    let mechanics = h + ${l.mechanicsOffsetWords}u;
    let old_mass = bitcast<f32>(history[state + 3u]);
    let new_mass = bitcast<f32>(projected[edge * 32u]);
    for (var i = 0u; i < ${q}u; i++) { history[h + ${l.quantityOffsetWords}u + i] = pair_words[gas + i]; }
    // Produced/placed amounts and reaction lineage remain birth evidence.
    // The residual companion follows the current extensive quantity row.
    for (var i = 0u; i < ${l.massWordCount}u; i++) {
      history[h + ${l.residualMassOffsetWords}u + i] = pair_words[gas + 16u + i];
    }
    for (var i = 0u; i < 8u; i++) {
      let lane = array<u32, 8>(13u, 16u, 19u, 20u, 21u, 22u, 23u, 27u)[i];
      history[h + lane] = candidate[event + lane];
    }
    history[state + 3u] = projected[edge * 32u];
    for (var axis = 0u; axis < 3u; axis++) { history[state + 4u + axis] = projected[edge * 32u + 2u + axis]; }
    history[state + 7u] = projected[edge * 32u + 8u];
    history[thermo + 2u] = candidate[event + 16u];
    history[thermo + 9u] = bitcast<u32>(bitcast<f32>(candidate[event + 9u]) * 6.02214076e23);
    let old_radius = bitcast<f32>(history[thermo + 11u]);
    if (old_radius > 0.0) {
      let radius = old_radius * exp(log(new_mass / old_mass) / 3.0);
      if (!(radius > 0.0) || (bitcast<u32>(radius) & 0x7f800000u) == 0x7f800000u) {
        atomicOr(&control[3u], 4096u); return;
      }
      history[thermo + 11u] = bitcast<u32>(radius);
    }
    // M, V0 and V have the same exact scale factor: F and J are unchanged.
    // The outer integration still owes mechanics/pressure refresh before use.
    history[mechanics + 19u] = projected[edge * 32u + 10u];
    history[mechanics + 25u] = candidate[event + 27u];
    history[mechanics + 31u] = projected[edge * 32u + 12u];
    if (!exact_history_valid(0u, row)) { atomicOr(&control[3u], 4096u); }
  ` : 'atomicOr(&control[3u], 4096u);';
  const code = /* wgsl */ `
@group(0) @binding(0) var<storage, read> edges: array<u32>;
@group(0) @binding(1) var<storage, read> pair_words: array<u32>;
@group(0) @binding(2) var<storage, read> projected: array<u32>;
@group(0) @binding(3) var<storage, read> candidate: array<u32>;
@group(0) @binding(4) var<storage, read_write> particles: array<u32>;
@group(0) @binding(5) var<storage, read_write> aerosols: array<u32>;
@group(0) @binding(6) var<storage, read_write> history: array<u32>;
@group(0) @binding(7) var<storage, read_write> control: array<atomic<u32>>;
${l ? createSphExactResidentProductHistoryValidationWgsl(l, 'history') : ''}
@compute @workgroup_size(64)
fn materialize_exact_vapor_endpoints(@builtin(global_invocation_id) id: vec3<u32>) {
  let edge = id.x; if (edge >= ${edgeCount}u || atomicLoad(&control[3u]) != 0u) { return; }
  if (atomicLoad(&control[16u + edge]) != 1u || projected[edge * 32u + 31u] != 1u) {
    atomicOr(&control[3u], 4096u); return;
  }
  let kind = edges[edge * 8u]; let row = edges[edge * 8u + 1u]; let parcel = edges[edge * 8u + 2u];
  let gas = edge * 2u * ${q}u; let liquid = gas + ${q}u;
  if (projected[edge * 32u + 20u] == edge) {
    for (var i = 0u; i < ${q}u; i++) { aerosols[parcel * ${q}u + i] = pair_words[liquid + i]; }
  }
  if (projected[edge * 32u + 19u] != edge) { return; }
  if (kind == 0u) {
    for (var i = 0u; i < ${q}u; i++) { particles[row * ${q}u + i] = pair_words[gas + i]; }
  } else { ${historyBody} }
}
`;
  const pipeline = await prewarmCachedExplicitComputePipeline(device, { code,
    entryPoint: 'materialize_exact_vapor_endpoints', label: 'ulg-materialize-exact-vapor-endpoints',
    cacheKey: `ulg-exact-vapor-endpoints-v3:${q}:${l?.massWordCount ?? 0}:${l?.rationalWordCount ?? 0}:${l?.rowWords ?? 0}:${edgeCount}:${productOffsetWords}`,
    bindings: ['read-only-storage', 'read-only-storage', 'read-only-storage', 'read-only-storage',
      'storage', 'storage', 'storage', 'storage'].map((type, binding) => computeBufferBinding(binding, type)) });
  if (!pipeline.pipeline) throw pipeline.error ?? new Error('Exact endpoint materialization pipeline unavailable');
  validate();
  const group = device.createBindGroup({ layout: pipeline.bindGroupLayout,
    entries: [edges, pairs, projection, candidateArena, particleBuffer, aerosolBuffer, historyBuffer, control]
      .map((buffer, binding) => ({ binding, resource: { buffer } })) });
  return Object.freeze({ particleBuffer, aerosolBuffer, historyBuffer: l ? historyBuffer : null,
    particleLayout: Object.freeze({ ...particleRead.quantities.quantityLayout, rowCount: particleCount,
      byteLength: particleCount * q * 4, wordLength: particleCount * q }),
    aerosolLayout: aerosolRead.exactQuantities.quantityLayout, historyLayout: l,
    retainedBuffers: Object.freeze([particleBuffer, aerosolBuffer, historyBuffer]), dispatchCount: 1,
    encode(encoder) {
      validate();
      encoder.copyBufferToBuffer(particleRead.quantities.quantityBuffer, 0, particleBuffer, 0, particleBuffer.size);
      encoder.copyBufferToBuffer(aerosolRead.exactQuantities.quantityBuffer, 0, aerosolBuffer, 0, aerosolBuffer.size);
      if (l) encoder.copyBufferToBuffer(historyRead.buffer, 0, historyBuffer, 0, historyBuffer.size);
      else encoder.clearBuffer(historyBuffer);
      const pass = encoder.beginComputePass(); pass.setPipeline(pipeline.pipeline); pass.setBindGroup(0, group);
      pass.dispatchWorkgroups(Math.ceil(edgeCount / 64)); pass.end();
    }
  });
}
