import { computeBufferBinding, prewarmCachedExplicitComputePipeline } from '../webgpuComputeLayout.js';
import { createSphExactRationalQuantityWgsl, sphExactRationalQuantityLayout } from './sphExactRationalQuantityWgsl.js';
import { createSphConservativeTransferPacketWgsl, validateSphTransportPacketMode } from './sphConservativeTransferPacketWgsl.js';

// Numerical work owned by the original exchange candidate. These edge-local
// records are NOT particle, history, aerosol, count or publication authorities.
export function sphExactVaporAerosolProgram({ shared = false, cellPressureWork = false, integrateRates = false, midpointDonors = false,
  transportPacketMode = 'exact-rational' } = {}) {
  const roundedPackets = validateSphTransportPacketMode(transportPacketMode) === 'rounded-dyadic-53';
  shared ||= cellPressureWork;
  // 42..46: molar mass, own T, R, actual free volume, liquid density.
  // 47: unique parcel volume changes summed at a gas endpoint; 48: zero;
  // 49: this parcel's original B-A-W occupancy weight in the gas cell.
  if (midpointDonors && (!cellPressureWork || !integrateRates)) throw new TypeError('Midpoint donors require exact rate and pressure work');
  const stageSlot = cellPressureWork ? 50 : shared ? 42 : 30;
  const originalVolumeSlot = stageSlot + 16;
  const intervalSlot = stageSlot + (midpointDonors ? 17 : 0);
  const operations = []; let registers = intervalSlot + Number(integrateRates);
  const op = (kind, a, b) => { const out = registers++; operations.push([kind, a, b, out]); return out; };
  const add = (a, b) => op(0, a, b), sub = (a, b) => op(1, a, b);
  const mul = (a, b) => op(2, a, b), div = (a, b) => op(3, a, b);
  const packet = a => roundedPackets ? op(4, a, a) : a;
  // Rates and the original binary64 interval enter separately. Neither their
  // product nor the interval is rounded to f32 before exact inventory writes.
  const [dm, h, q, w] = [16, 17, 18, 19].map(slot => integrateRates ? mul(slot, intervalSlot) : slot);
  // Mg,Pg,E,V0g,Vg,Rg; Ml,Pl,E,V0l,Vl,Rl; dm,H,Q,W,Sold,Snew;
  // and eight immutable donor quantities selected by the integer sign of dm.
  // Shared endpoints reserve registers 30..39 for the exact sums of signed
  // M/P/E packets. Every packet uses the original donor, before any transfer.
  let transfers = null, transferBoundary = 0;
  if (shared) {
    const fraction = div(dm, 22);
    transfers = [dm, ...[23, 24, 25].map(slot => packet(mul(fraction, slot))),
      packet(add(mul(fraction, 26), add(add(h, q), w)))];
    transferBoundary = operations.length;
  }
  const available = shared ? [sub(0, 40), sub(8, 41)] : null;
  const gas = [sub(0, shared ? 30 : dm)], liquid = [add(8, shared ? 35 : dm)];
  const fraction = div(dm, 22);
  for (let axis = 1; axis <= 3; axis++) {
    const transfer = shared ? 30 + axis : packet(mul(fraction, 22 + axis));
    gas.push(sub(axis, transfer)); liquid.push(add(8 + axis, shared ? 35 + axis : transfer));
  }
  gas.push(0); liquid.push(0);
  const gasRatio = div(gas[0], 0), liquidRatio = div(liquid[0], 8);
  for (let field = 5; field < 8; field++) {
    gas.push(mul(field, gasRatio)); liquid.push(mul(8 + field, liquidRatio));
  }
  const volumeChange = cellPressureWork ? mul(div(35, 46), 49) : null;
  const pressure = cellPressureWork ? div(mul(mul(div(midpointDonors ? stageSlot : 0, 42), 44), 43), 45) : null;
  const pressureWork = cellPressureWork ? packet(sub(48, mul(pressure, volumeChange))) : null;
  const pressureBoundary = operations.length;
  const remainingFreeVolume = cellPressureWork ? sub(midpointDonors ? originalVolumeSlot : 45, 47) : null;
  const surfaceBoundary = operations.length;
  const transferEnergy = shared ? 34 : packet(add(mul(fraction, 26), add(add(h, q), w)));
  gas[4] = sub(4, transferEnergy);
  liquid[4] = sub(add(12, shared ? 39 : transferEnergy), sub(21, 20));
  const views = [gas[0], liquid[0]];
  for (const endpoint of [gas, liquid]) for (let axis = 1; axis <= 3; axis++) views.push(div(endpoint[axis], endpoint[0]));
  for (const endpoint of [gas, liquid]) {
    const kinetic = div([1, 2, 3].map(axis => mul(endpoint[axis], endpoint[axis])).reduce(add), add(endpoint[0], endpoint[0]));
    views.push(div(sub(endpoint[4], kinetic), endpoint[0]));
  }
  views.push(...gas.slice(5), ...liquid.slice(5));
  return { operations, registers, transferBoundary, transfers, available, surfaceBoundary, gas, liquid, views,
    pressureBoundary, pressureWork, volumeChange, remainingFreeVolume, massPacket: dm, intervalSlot, stageSlot, originalVolumeSlot };
}

// CSR adjacency over structural edge identities only. No numerical source
// values enter on the host. Each group has a single writer (its first edge).
export function sphExactVaporAerosolTopology(edgeRows) {
  const count = edgeRows.length / 8, groups = new Map(), memberships = [], pairs = new Map();
  for (let edge = 0; edge < count; edge++) {
    const pair = `${edgeRows[edge * 8]}:${edgeRows[edge * 8 + 1]}:${edgeRows[edge * 8 + 2]}`;
    if (!pairs.has(pair)) pairs.set(pair, edge);
    for (const key of [`g:${edgeRows[edge * 8]}:${edgeRows[edge * 8 + 1]}`, `a:${edgeRows[edge * 8 + 2]}`]) {
      if (!groups.has(key)) groups.set(key, []);
      const group = groups.get(key); group.push(edge); memberships.push({ group, pair: pairs.get(pair) });
    }
  }
  const words = new Uint32Array(count * 10), offsets = new Map();
  let at = count * 8, maxDegree = 1;
  for (const group of groups.values()) {
    offsets.set(group, at); words.set(group, at); at += group.length;
    maxDegree = Math.max(maxDegree, group.length);
  }
  memberships.forEach(({ group, pair }, index) => words.set([offsets.get(group), group.length, group[0], pair], index * 4));
  return { words, maxDegree, shared: maxDegree > 1 };
}

export async function prepareSphExactVaporAerosolQuantities({ device, format, layout,
  edgeRows, cellPressureWork = false, dtSeconds = null, intervalScaleExponent = 0,
  transportPacketMode = 'exact-rational',
  donorPairs = null, predictorProjection = null,
  particleRead, historyRead, aerosolRead, edges, control, surfaces, allocate, validate }) {
  validate();
  const count = edgeRows.length / 8, stride = layout.recordWords;
  const retainedScalar = layout.scalar;
  // Retained endpoint quantities can fit while a derived internal-energy
  // numerator E - P²/(2M) needs more bits. Keep private arithmetic wider than
  // the retained format; checked egress below must still fit every endpoint.
  const scratchScalar = sphExactRationalQuantityLayout({ wordCount: 2 * retainedScalar.wordCount + 1 });
  const scalar = scratchScalar.recordWords;
  const topology = sphExactVaporAerosolTopology(edgeRows);
  if (cellPressureWork) topology.shared = true;
  const integrateRates = dtSeconds !== null;
  if (integrateRates && (typeof dtSeconds !== 'number' || !Number.isFinite(dtSeconds) || dtSeconds <= 0)) {
    throw new RangeError('Rate integration requires the positive original binary64 interval');
  }
  if (!Number.isInteger(intervalScaleExponent) || intervalScaleExponent < -1024 || intervalScaleExponent > 0
      || Boolean(donorPairs) !== Boolean(predictorProjection)) throw new TypeError('Invalid exact stage interval or predictor');
  const midpointDonors = Boolean(donorPairs);
  const program = sphExactVaporAerosolProgram({ ...topology, cellPressureWork, integrateRates, midpointDonors, transportPacketMode }), alignment = device.limits.minUniformBufferOffsetAlignment;
  const reductions = topology.shared ? topology.maxDegree : 0;
  const instructionCount = program.operations.length + reductions;
  const sourceBytes = count * 2 * stride * 4, scratchBytes = count * program.registers * scalar * 4;
  const inputBytes = sourceBytes * (midpointDonors ? 2 : 1);
  if (Math.max(inputBytes, scratchBytes) > device.limits.maxStorageBufferBindingSize
      || Math.max(inputBytes, scratchBytes, instructionCount * alignment) > device.limits.maxBufferSize
      || Math.ceil(count * 16 / 32) > device.limits.maxComputeWorkgroupsPerDimension) {
    throw new RangeError('Exact exchange quantities exceed device capacity');
  }
  const source = allocate('exact-source', inputBytes, 128 | 4 | 8);
  const output = allocate('exact-pairs', sourceBytes, 128 | 4 | 8);
  const scratch = allocate('exact-scratch', scratchBytes, 128 | 8);
  const projection = allocate('exact-projection', count * 32 * 4, 128 | 4 | 8);
  const params = allocate('exact-params', 16, 64 | 8);
  const instructions = allocate('exact-operations', instructionCount * alignment, 64 | 8);
  const adjacency = allocate('exact-adjacency', topology.words.byteLength, 128 | 8);
  const instructionWords = new Uint32Array(instructions.size / 4);
  program.operations.forEach((op, i) => instructionWords.set(op, i * alignment / 4));
  for (let i = 0; i < reductions; i++) instructionWords[(program.operations.length + i) * alignment / 4] = i;
  device.queue.writeBuffer(instructions, 0, instructionWords);
  device.queue.writeBuffer(adjacency, 0, topology.words);
  const intervalBits = new DataView(new ArrayBuffer(8));
  intervalBits.setFloat64(0, dtSeconds ?? 0, true);
  device.queue.writeBuffer(params, 0, new Uint32Array([count,
    intervalBits.getUint32(0, true), intervalBits.getUint32(4, true), intervalScaleExponent]));
  const code = createSphExactRationalQuantityWgsl({ wordCount: scratchScalar.wordCount })
    + (transportPacketMode === 'rounded-dyadic-53' ? createSphConservativeTransferPacketWgsl() : '') + /* wgsl */ `
@group(0) @binding(0) var<storage, read> xq_source: array<u32>;
@group(0) @binding(1) var<storage, read_write> xq_output: array<u32>;
@group(0) @binding(2) var<storage, read_write> xq_scratch: array<u32>;
@group(0) @binding(3) var<storage, read_write> xq_projection: array<u32>;
@group(0) @binding(4) var<storage, read> xq_edges: array<u32>;
@group(0) @binding(5) var<storage, read_write> xq_control: array<atomic<u32>>;
@group(0) @binding(6) var<storage, read> xq_surfaces: array<u32>;
@group(0) @binding(7) var<uniform> xq_params: vec4<u32>;
@group(0) @binding(8) var<uniform> xq_op: vec4<u32>;
@group(0) @binding(9) var<storage, read> xq_adjacency: array<u32>;
fn xq_at(edge: u32, slot: u32) -> u32 { return (edge * ${program.registers}u + slot) * ${scalar}u; }
fn xq_fail() { atomicOr(&xq_control[3u], 4096u); }
fn xq_load(edge: u32, slot: u32) -> ExactRational {
  let at = xq_at(edge, slot); var v: ExactRational;
  v.negative = xq_scratch[at]; v.error = xq_scratch[at + 1u]; v.exponent = bitcast<i32>(xq_scratch[at + 2u]); v.reserved = xq_scratch[at + 3u];
  for (var i = 0u; i < XR_WORDS; i++) { v.numerator[i] = xq_scratch[at + 4u + i]; v.denominator[i] = xq_scratch[at + 4u + XR_WORDS + i]; }
  return v;
}
fn xq_store(edge: u32, slot: u32, v: ptr<function, ExactRational>) {
  let at = xq_at(edge, slot); xq_scratch[at] = (*v).negative; xq_scratch[at + 1u] = (*v).error;
  xq_scratch[at + 2u] = bitcast<u32>((*v).exponent); xq_scratch[at + 3u] = (*v).reserved;
  for (var i = 0u; i < XR_WORDS; i++) { xq_scratch[at + 4u + i] = (*v).numerator[i]; xq_scratch[at + 4u + XR_WORDS + i] = (*v).denominator[i]; }
  if ((*v).error != 0u) { xq_fail(); }
}
fn xq_ingress(edge: u32, slot: u32, bits: u32) {
  let at = xq_at(edge, slot); let encoded = (bits >> 23u) & 255u;
  if (encoded == 255u) { xq_fail(); return; }
  let coefficient = (bits & 0x7fffffu) | select(0u, 0x800000u, encoded != 0u);
  if (coefficient == 0u) { return; }
  let shift = countTrailingZeros(coefficient); xq_scratch[at] = bits >> 31u;
  xq_scratch[at + 2u] = bitcast<u32>(select(-149, i32(encoded) - 150, encoded != 0u) + i32(shift));
  xq_scratch[at + 4u] = coefficient >> shift;
}
@compute @workgroup_size(32)
fn prepare_exact_exchange(@builtin(global_invocation_id) id: vec3<u32>) {
  let edge = id.x; if (edge >= xq_params.x || atomicLoad(&xq_control[3u]) != 0u) { return; }
  for (var slot = 0u; slot < ${program.registers}u; slot++) { xq_scratch[xq_at(edge, slot) + 4u + XR_WORDS] = 1u; }
  xq_projection[edge * 32u + 19u] = xq_adjacency[edge * 8u + 2u];
  xq_projection[edge * 32u + 20u] = xq_adjacency[edge * 8u + 6u];
  for (var endpoint = 0u; endpoint < ${midpointDonors ? 4 : 2}u; endpoint++) {
    let base = (edge * 2u + endpoint % 2u + (endpoint / 2u) * xq_params.x * 2u) * ${stride}u;
    let first_slot = select(endpoint * 8u, ${program.stageSlot}u + (endpoint % 2u) * 8u, endpoint >= 2u);
    if (xq_source[base] != 1u || xq_source[base + 1u] != 0u) { xq_fail(); return; }
    let at = xq_at(edge, first_slot); var mass = 0u;
    xq_scratch[at + 2u] = bitcast<u32>(${format.quantumExponent}i);
    for (var i = 0u; i < ${format.wordCount}u; i++) {
      let word = xq_source[base + ${layout.massOffsetWords}u + i]; mass |= word; xq_scratch[at + 4u + i] = word;
    }
    if (mass == 0u) { xq_fail(); return; }
    for (var field = 0u; field < 7u; field++) {
      let source_offset = base + ${layout.scalarOffsetWords}u + field * ${retainedScalar.recordWords}u;
      let to = xq_at(edge, first_slot + field + 1u);
      for (var i = 0u; i < 4u; i++) { xq_scratch[to + i] = xq_source[source_offset + i]; }
      for (var i = 0u; i < ${retainedScalar.wordCount}u; i++) {
        xq_scratch[to + 4u + i] = xq_source[source_offset + 4u + i];
        xq_scratch[to + 4u + XR_WORDS + i] = xq_source[source_offset + ${4 + retainedScalar.wordCount}u + i];
      }
    }
  }
  for (var lane = 0u; lane < 4u; lane++) { xq_ingress(edge, 16u + lane, xq_edges[edge * 8u + 4u + lane]); }
  ${integrateRates ? `
  let encoded = (xq_params.z >> 20u) & 2047u;
  var lo = xq_params.y; var hi = (xq_params.z & 0xfffffu) | select(0u, 0x100000u, encoded != 0u);
  if ((xq_params.z >> 31u) != 0u || encoded == 2047u || (lo | hi) == 0u
      || bitcast<i32>(xq_params.w) > 0 || bitcast<i32>(xq_params.w) < -1024) { xq_fail(); return; }
  var shift = 0u;
  if (lo == 0u) { shift = 32u + countTrailingZeros(hi); lo = hi >> (shift - 32u); hi = 0u; }
  else {
    shift = countTrailingZeros(lo);
    if (shift != 0u) { lo = (lo >> shift) | (hi << (32u - shift)); hi >>= shift; }
  }
  let dt_at = xq_at(edge, ${program.intervalSlot}u);
  xq_scratch[dt_at + 2u] = bitcast<u32>(select(-1074, i32(encoded) - 1075, encoded != 0u)
    + i32(shift) + bitcast<i32>(xq_params.w));
  xq_scratch[dt_at + 4u] = lo;
  ${layout.scalar.wordCount > 1 ? 'xq_scratch[dt_at + 5u] = hi;' : 'if (hi != 0u) { xq_fail(); return; }'}
  ` : ''}
  let donor = ${midpointDonors ? program.stageSlot : 0}u + select(0u, 8u, (xq_edges[edge * 8u + 4u] & 0x80000000u) != 0u);
  for (var field = 0u; field < 8u; field++) {
    for (var i = 0u; i < ${scalar}u; i++) { xq_scratch[xq_at(edge, 22u + field) + i] = xq_scratch[xq_at(edge, donor + field) + i]; }
  }
}
@compute @workgroup_size(32)
fn execute_exact_exchange(@builtin(global_invocation_id) id: vec3<u32>) {
  let edge = id.x; if (edge >= xq_params.x || atomicLoad(&xq_control[3u]) != 0u) { return; }
  var a = xq_load(edge, xq_op.y); var b = xq_load(edge, xq_op.z); var v: ExactRational;
  switch xq_op.x {
    case 0u: { xrp_rational_add(&v, &a, &b); }
    case 1u: { xrp_rational_subtract(&v, &a, &b); }
    case 2u: { xrp_rational_multiply(&v, &a, &b); }
    case 3u: { xrp_rational_divide(&v, &a, &b); }
    ${transportPacketMode === 'rounded-dyadic-53' ? 'case 4u: { xrp_round_transfer53(&v, &a); }' : ''}
    default: { v.error = 1u; }
  }
  xq_store(edge, xq_op.w, &v);
}
${topology.shared ? /* wgsl */ `
@compute @workgroup_size(32)
fn reduce_exact_exchange(@builtin(global_invocation_id) id: vec3<u32>) {
  let edge = id.x / 12u; let lane = id.x % 12u; let endpoint = lane / 6u; let field = lane % 6u;
  if (edge >= xq_params.x || atomicLoad(&xq_control[3u]) != 0u) { return; }
  let group = edge * 8u + endpoint * 4u;
  if (xq_op.x >= xq_adjacency[group + 1u]) { return; }
  let other = xq_adjacency[xq_adjacency[group] + xq_op.x];
  let slots = array<u32,5>(${program.transfers.map(v => `${v}u`).join(',')});
  var slot = 30u + endpoint * 5u + field;
  var packet = xq_load(other, slots[min(field, 4u)]);
  if (field == 5u) {
    slot = 40u + endpoint; packet = xq_load(other, ${program.massPacket}u);
    // A simultaneous incoming packet cannot finance an overdraft from the
    // original donor. Track gross outgoing demand separately from net mass.
    if (packet.negative != endpoint) { return; }
    packet.negative = 0u;
  }
  var sum = xq_load(edge, slot);
  var next: ExactRational; xrp_rational_add(&next, &sum, &packet);
  xq_store(edge, slot, &next);
}
` : ''}
${cellPressureWork ? /* wgsl */ `
@compute @workgroup_size(32)
fn ingress_exact_pressure_work(@builtin(global_invocation_id) id: vec3<u32>) {
  let edge = id.x; if (edge >= xq_params.x || atomicLoad(&xq_control[3u]) != 0u) { return; }
  for (var lane = 0u; lane < 5u; lane++) {
    let bits = xq_projection[edge * 32u + 21u + lane];
    if (bits < 0x00800000u || bits >= 0x7f800000u) { xq_fail(); return; }
    xq_ingress(edge, 42u + lane, bits);
  }
  let weight = xq_projection[edge * 32u + 26u];
  if (weight < 0x00800000u || weight > 0x3f800000u) { xq_fail(); return; }
  xq_ingress(edge, 49u, weight);
  ${midpointDonors ? `
  let original_volume = xq_projection[edge * 32u + 28u];
  if (original_volume < 0x00800000u || original_volume >= 0x7f800000u) { xq_fail(); return; }
  xq_ingress(edge, ${program.originalVolumeSlot}u, original_volume);` : ''}
}
@compute @workgroup_size(32)
fn reduce_exact_pressure_work(@builtin(global_invocation_id) id: vec3<u32>) {
  let edge = id.x / 3u; let lane = id.x % 3u;
  if (edge >= xq_params.x || atomicLoad(&xq_control[3u]) != 0u) { return; }
  let group = edge * 8u + select(0u, 4u, lane == 1u);
  if (xq_op.x >= xq_adjacency[group + 1u]) { return; }
  let other = xq_adjacency[xq_adjacency[group] + xq_op.x];
  // Multiple mass/heat edges for one gas/parcel pair cause only one pressure
  // work packet. Their net liquid volume change was already reduced exactly.
  if (xq_adjacency[other * 8u + 3u] != other) { return; }
  let slot = select(select(34u, 39u, lane == 1u), 47u, lane == 2u);
  var packet = xq_load(other, select(${program.pressureWork}u, ${program.volumeChange}u, lane == 2u));
  var sum = xq_load(edge, slot); var next: ExactRational;
  xrp_rational_add(&next, &sum, &packet); xq_store(edge, slot, &next);
}
` : ''}
@compute @workgroup_size(32)
fn project_exact_exchange_mass(@builtin(global_invocation_id) id: vec3<u32>) {
  let edge = id.x; if (edge >= xq_params.x || atomicLoad(&xq_control[3u]) != 0u) { return; }
  ${topology.shared ? `
  for (var endpoint = 0u; endpoint < 2u; endpoint++) {
    var available = xq_load(edge, select(${program.available[0]}u, ${program.available[1]}u, endpoint == 1u));
    if (available.error != 0u || available.negative != 0u) { xq_fail(); return; }
  }` : ''}
  ${cellPressureWork ? `
  var free_volume = xq_load(edge, ${program.remainingFreeVolume}u);
  let projected_volume = xrp_project_f32_bits(&free_volume);
  if (projected_volume.error != 0u || projected_volume.bits < 0x00800000u
      || projected_volume.bits >= 0x7f800000u) { xq_fail(); return; }
  xq_projection[edge * 32u + 27u] = projected_volume.bits;` : ''}
  for (var endpoint = 0u; endpoint < 2u; endpoint++) {
    var raw = xq_load(edge, select(${program.gas[0]}u, ${program.liquid[0]}u, endpoint == 1u));
    var v: ExactRational; xrp_normalize(&v, &raw);
    // M is an integer number of run quanta. Never round a rational mass back
    // onto the inventory lattice, erase a positive remainder or wrap a debit.
    if (v.error != 0u || v.negative != 0u || v.denominator[0u] != 1u || v.exponent < ${format.quantumExponent}i) { xq_fail(); return; }
    for (var i = 1u; i < XR_WORDS; i++) { if (v.denominator[i] != 0u) { xq_fail(); return; } }
    var integer: ExactRationalWide; xrp_numerator(&integer, &v); xrp_shift_left(&integer, u32(v.exponent - ${format.quantumExponent}i));
    if (integer.error != 0u) { xq_fail(); return; }
    for (var i = ${format.wordCount}u; i < XR_SCRATCH_WORDS; i++) { if (integer.words[i] != 0u) { xq_fail(); return; } }
    let p = xrp_project_f32_bits(&v);
    if (p.error != 0u || p.bits < 0x00800000u || p.bits >= 0x7f800000u) { xq_fail(); return; }
    xq_projection[edge * 32u + endpoint] = p.bits;
    for (var i = 0u; i < ${format.wordCount}u; i++) { xq_output[(edge * 2u + endpoint) * ${stride}u + ${layout.massOffsetWords}u + i] = integer.words[i]; }
  }
}
@compute @workgroup_size(32)
fn ingress_exact_exchange_surface(@builtin(global_invocation_id) id: vec3<u32>) {
  let edge = id.x; if (edge >= xq_params.x || atomicLoad(&xq_control[3u]) != 0u) { return; }
  let parcel = xq_edges[edge * 8u + 2u];
  xq_ingress(edge, 20u, xq_surfaces[parcel * 4u + 1u]); xq_ingress(edge, 21u, xq_surfaces[parcel * 4u + 3u]);
}
@compute @workgroup_size(32)
fn project_exact_exchange(@builtin(global_invocation_id) id: vec3<u32>) {
  let edge = id.x / 16u; let lane = id.x % 16u;
  if (edge >= xq_params.x || atomicLoad(&xq_control[3u]) != 0u) { return; }
  let slots = array<u32,16>(${program.views.map(v => `${v}u`).join(',')});
  var v = xq_load(edge, slots[lane]); let p = xrp_project_f32_bits(&v);
  if (p.error != 0u || (p.bits & 0x7fffffffu) >= 0x7f800000u
      || ((lane < 2u || lane >= 10u) && (p.bits < 0x00800000u || p.bits >= 0x7f800000u))) { xq_fail(); return; }
  xq_projection[edge * 32u + lane] = p.bits;
}
@compute @workgroup_size(32)
fn store_exact_exchange(@builtin(global_invocation_id) id: vec3<u32>) {
  let edge = id.x; if (edge >= xq_params.x || atomicLoad(&xq_control[3u]) != 0u) { return; }
  let slots = array<u32,14>(${[...program.gas.slice(1), ...program.liquid.slice(1)].map(v => `${v}u`).join(',')});
  for (var field = 0u; field < 14u; field++) {
    let value_at = xq_at(edge, slots[field]);
    // Never truncate a widened computation into the original inventory.
    for (var i = ${retainedScalar.wordCount}u; i < XR_WORDS; i++) {
      if ((xq_scratch[value_at + 4u + i] | xq_scratch[value_at + 4u + XR_WORDS + i]) != 0u) {
        xq_fail(); return;
      }
    }
    let to = (edge * 2u + field / 7u) * ${stride}u + ${layout.scalarOffsetWords}u + (field % 7u) * ${retainedScalar.recordWords}u;
    for (var i = 0u; i < 4u; i++) { xq_output[to + i] = xq_scratch[value_at + i]; }
    for (var i = 0u; i < ${retainedScalar.wordCount}u; i++) {
      xq_output[to + 4u + i] = xq_scratch[value_at + 4u + i];
      xq_output[to + ${4 + retainedScalar.wordCount}u + i] = xq_scratch[value_at + 4u + XR_WORDS + i];
    }
  }
  xq_projection[edge * 32u + 31u] = 1u;
}
`;
  const entryPoints = ['prepare_exact_exchange', 'execute_exact_exchange', 'project_exact_exchange_mass',
    'ingress_exact_exchange_surface', 'project_exact_exchange', 'store_exact_exchange'];
  if (topology.shared) entryPoints.push('reduce_exact_exchange');
  if (cellPressureWork) entryPoints.push('ingress_exact_pressure_work', 'reduce_exact_pressure_work');
  const pipelines = [];
  for (const entryPoint of entryPoints) {
    const pipeline = await prewarmCachedExplicitComputePipeline(device, { code, entryPoint,
      cacheKey: `ulg-${entryPoint}-v8-${transportPacketMode}-${format.wordCount}-${format.quantumExponent}-${retainedScalar.wordCount}-${scratchScalar.wordCount}-${topology.shared}-${cellPressureWork}-${integrateRates}-${midpointDonors}`,
      label: `ulg-${entryPoint}`, bindings: ['read-only-storage','storage','storage','storage','read-only-storage',
        'storage','read-only-storage','uniform','uniform','read-only-storage'].map((type, binding) => computeBufferBinding(binding, type)) });
    if (!pipeline.pipeline) throw pipeline.error ?? new Error(`Exact exchange pipeline unavailable: ${entryPoint}`);
    validate(); pipelines.push(pipeline);
  }
  const resources = [source, output, scratch, projection, edges, control, surfaces, params, instructions, adjacency];
  const dispatch = (encoder, index, operation = 0) => {
    const group = device.createBindGroup({ layout: pipelines[index].bindGroupLayout,
      entries: resources.map((buffer, binding) => ({ binding, resource: binding === 8
        ? { buffer, offset: operation * alignment, size: 16 } : { buffer } })) });
    const pass = encoder.beginComputePass(); pass.setPipeline(pipelines[index].pipeline); pass.setBindGroup(0, group);
    pass.dispatchWorkgroups(Math.ceil(count * (index === 4 ? 16 : index === 6 ? 12 : index === 8 ? 3 : 1) / 32)); pass.end();
  };
  return { output, projection, layout: Object.freeze({ ...layout, rowCount: count * 2, byteLength: sourceBytes }),
    format, dispatchCount: program.operations.length + 5 + reductions + (cellPressureWork ? 1 + reductions : 0), transient: [source, scratch, params, instructions, adjacency],
    prepare(encoder, previousPairs = null) {
      validate(); encoder.clearBuffer(scratch); encoder.clearBuffer(projection);
      // Private numerical continuation, never a registered endpoint owner.
      // Copy before overwriting output: previousPairs may be this work's output.
      if (previousPairs) encoder.copyBufferToBuffer(previousPairs, 0, source, 0, sourceBytes);
      else for (let edge = 0; edge < count; edge++) {
        const kind = edgeRows[edge * 8], row = edgeRows[edge * 8 + 1], parcel = edgeRows[edge * 8 + 2];
        const from = kind === 0 ? particleRead.quantities.quantityBuffer : historyRead.buffer;
        const offset = kind === 0 ? row * stride : row * historyRead.layout.rowWords + historyRead.layout.quantityOffsetWords;
        encoder.copyBufferToBuffer(from, offset * 4, source, edge * 2 * stride * 4, stride * 4);
        encoder.copyBufferToBuffer(aerosolRead.exactQuantities.quantityBuffer, parcel * stride * 4,
          source, (edge * 2 + 1) * stride * 4, stride * 4);
      }
      encoder.copyBufferToBuffer(source, 0, output, 0, sourceBytes);
      if (midpointDonors) {
        encoder.copyBufferToBuffer(donorPairs, 0, source, sourceBytes, sourceBytes);
        for (let edge = 0; edge < count; edge++) encoder.copyBufferToBuffer(predictorProjection,
          (edge * 32 + 24) * 4, projection, (edge * 32 + 28) * 4, 4);
      }
      dispatch(encoder, 0);
    },
    accumulate(encoder) {
      if (cellPressureWork) dispatch(encoder, 7);
      for (let i = 0; i < program.transferBoundary; i++) dispatch(encoder, 1, i);
      for (let i = 0; i < reductions; i++) dispatch(encoder, 6, program.operations.length + i);
      for (let i = program.transferBoundary; i < program.pressureBoundary; i++) dispatch(encoder, 1, i);
      if (cellPressureWork) for (let i = 0; i < reductions; i++) dispatch(encoder, 8, program.operations.length + i);
      for (let i = program.pressureBoundary; i < program.surfaceBoundary; i++) dispatch(encoder, 1, i);
      dispatch(encoder, 2);
    },
    finish(encoder) {
      dispatch(encoder, 3);
      for (let i = program.surfaceBoundary; i < program.operations.length; i++) dispatch(encoder, 1, i);
      dispatch(encoder, 4); dispatch(encoder, 5);
    }
  };
}
