// Browser-only manufactured inputs and fixed-size evidence for the real
// S9/P2G/gas-ledger/EOS/boundary/G2P test. Never imported by the runtime.
import { mlsMpmTrialDeformationWgsl } from '../../ulg-gpu-abi/src/wgsl.js';
import { SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_ACCUMULATOR as ACC } from '../../ulg-gpu-abi/src/schroederSpatialPhaseVolumeTransport.js';

async function dispatch(device, code, buffers, count = 1) {
  const module = device.createShaderModule({ code });
  const errors = (await module.getCompilationInfo()).messages
    .filter((message) => message.type === 'error');
  if (errors.length) throw new Error(JSON.stringify(errors.map((m) => m.message)));
  const pipeline = await device.createComputePipelineAsync({
    layout: 'auto', compute: { module, entryPoint: 'main' }
  });
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: buffers.map((buffer, binding) => ({ binding, resource: { buffer } }))
  }));
  pass.dispatchWorkgroups(count);
  pass.end();
  device.queue.submit([encoder.finish()]);
}

export async function populatePressureTailInventory({
  device, generation, gridSpec, productEventBuffer, fixture
}) {
  const moment = generation.mechanicsLevelViews[0].phaseVolumeMoment;
  const [, ny, nz] = gridSpec.gridDims;
  const { shift } = gridSpec;
  // The fixture lies strictly inside the box, so the exact interior W has
  // weight 1/8 to each of a node's eight adjacent primal cells. Use actual
  // GPU-produced S9 volumes, not a CPU reconstruction or downloaded arena.
  await dispatch(device, `
@group(0) @binding(0) var<storage, read> moments: array<u32>;
@group(0) @binding(1) var<storage, read> control: array<u32>;
@group(0) @binding(2) var<storage, read_write> products: array<f32>;
@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x * 32u;
  for (var i = 0u; i < 32u; i++) { products[row + i] = 0.0; }
  if (control[0] != 0x53505631u || control[2] != 3u || control[18] != 27u) { return; }
  let cell = vec3<i32>(2 + i32(id.x / 16u), 2 + i32((id.x / 4u) % 4u), 2 + i32(id.x % 4u));
  var condensed = 0.0;
  for (var i = 0u; i < control[18]; i++) {
    let m = control[28] + i * control[29];
    let dense = moments[m];
    let node = vec3<i32>(i32(dense / ${ny * nz}u), i32((dense / ${nz}u) % ${ny}u), i32(dense % ${nz}u)) - vec3<i32>(${shift});
    if (all(node >= cell) && all(node <= cell + vec3<i32>(1))) {
      condensed += 0.125 * bitcast<f32>(moments[m + 4u]);
    }
  }
  let position = (vec3<f32>(cell) + vec3<f32>(0.5)) * 0.25;
  let free_volume = 0.015625 - condensed;
  let pressure = 101325.0 + ${fixture.gauge}.0 + dot(position, vec3<f32>(${fixture.gradient.join(', ')}));
  let moles = pressure * free_volume / (8.314462618 * 300.0);
  let mass = moles * 0.04;
  products[row] = position.x; products[row + 1u] = position.y; products[row + 2u] = position.z;
  products[row + 3u] = mass; products[row + 4u] = 9.0;
  products[row + 9u] = moles; products[row + 10u] = 1.0;
  products[row + 13u] = mass; products[row + 16u] = 300.0;
  products[row + 17u] = mass / free_volume; products[row + 18u] = 1.0;
  products[row + 23u] = free_volume;
}
`, [moment.momentBuffer, moment.controlBuffer, productEventBuffer], 64);
}

export async function gatherPressureTailEvidence({ device, generation, step, fixture }) {
  const g2p = step.g2pReconstruction?.gpuResult ?? step.g2pReconstruction;
  if (!g2p?.stateBuffer || !g2p.mechanicsBuffer) {
    throw new Error(`missing retained G2P output: ${Object.keys(step)}`);
  }
  const field = generation.mechanicsFieldView.fieldViewBuffer;
  const result = device.createBuffer({ size: 256, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
  const readback = device.createBuffer({ size: 256, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
  try {
    await dispatch(device, `
${mlsMpmTrialDeformationWgsl}
@group(0) @binding(0) var<storage, read> state: array<f32>;
@group(0) @binding(1) var<storage, read> mechanics: array<f32>;
@group(0) @binding(2) var<storage, read> field: array<u32>;
@group(0) @binding(3) var<storage, read_write> out: array<f32>;
@compute @workgroup_size(1)
fn main() {
  for (var i = 0u; i < 8u; i++) { out[i] = state[i]; }
  for (var i = 0u; i < 9u; i++) { out[8u + i] = mechanics[9u + i]; }
  let c0 = vec3<f32>(mechanics[9], mechanics[10], mechanics[11]);
  let c1 = vec3<f32>(mechanics[12], mechanics[13], mechanics[14]);
  let c2 = vec3<f32>(mechanics[15], mechanics[16], mechanics[17]);
  let trial = g2p_trial_deformation(vec3<f32>(1,0,0), vec3<f32>(0,1,0), vec3<f32>(0,0,1), c0, c1, c2, ${fixture.dt});
  for (var i = 0u; i < 3u; i++) {
    for (var j = 0u; j < 3u; j++) { out[17u + 3u*i + j] = trial[i][j]; }
  }
  out[26] = dot(trial[0], cross(trial[1], trial[2]));
  out[27] = mechanics[18];
  let velocity = vec3<f32>(state[4], state[5], state[6]);
  out[28] = 0.5 * state[3] * (dot(velocity, velocity)
    + 0.015625 * (dot(c0,c0) + dot(c1,c1) + dot(c2,c2)));
  out[29] = f32(field[34]); out[30] = f32(field[2]);
  var max_speed = 0.0; var kinetic = 0.0; var mass_sum = 0.0;
  var work = 0.0; var impulse = vec3<f32>(0.0);
  for (var i = 0u; i < field[34]; i++) {
    let row = field[30] + i * field[31];
    let mass = bitcast<f32>(field[row]);
    let v = vec3<f32>(bitcast<f32>(field[row+1u]), bitcast<f32>(field[row+2u]), bitcast<f32>(field[row+3u]));
    max_speed = max(max_speed, length(v)); kinetic += 0.5 * mass * dot(v,v); mass_sum += mass;
    let acc = field[28] + i * field[29];
    work += bitcast<f32>(field[acc + ${ACC.ambientWorkJ}u]);
    impulse += vec3<f32>(bitcast<f32>(field[acc + ${ACC.ambientImpulseXNs}u]),
      bitcast<f32>(field[acc + ${ACC.ambientImpulseYNs}u]), bitcast<f32>(field[acc + ${ACC.ambientImpulseZNs}u]));
  }
  out[31] = max_speed; out[32] = kinetic; out[33] = mass_sum;
  out[34] = work; out[35] = impulse.x; out[36] = impulse.y; out[37] = impulse.z;
}
`, [g2p.stateBuffer, g2p.mechanicsBuffer, field, result]);
    const encoder = device.createCommandEncoder();
    encoder.copyBufferToBuffer(result, 0, readback, 0, 256);
    device.queue.submit([encoder.finish()]);
    await readback.mapAsync(GPUMapMode.READ);
    const values = [...new Float32Array(readback.getMappedRange())];
    readback.unmap();
    return { values, mappedBytes: 256, rawTrial: 'shared GPU (I + dt C) F from retained C and identity fixture F; not post-cap F' };
  } finally {
    result.destroy(); readback.destroy();
  }
}
