// A3 G4-cell regional thermal/phase closure lane beyond pressure.
//
// Partitions live particles into 2x2x2 spatial G4 octant regions (regionCapacity = 8)
// and fits/looks up the normalized Stefan-Boltzmann radiative power closure
// (T / 300)^4 over strictly phase-and-material-homogeneous regions under G5
// ReservationLedger CAS control. Mixed-phase or multi-material interface G4
// cells are automatically classified DIRECT_HETEROGENEOUS by `a3_regime` and
// never fitted across phase boundaries. All work runs inside ONE single
// schedule-boundary compute pass (zero per-substep passes, zero host readbacks).
import {
  createCachedExplicitBindGroup,
  unwrapWebGpuCacheDevice
} from '../webgpuComputeLayout.js';
import {
  createRegionalClosureWorkerLane,
  destroyRegionalClosureWorkerLane,
  encodeRegionalClosureLaneAdopt,
  encodeRegionalClosureLaneEvaluate,
  encodeRegionalClosureLaneVerify,
  regionalClosureLaneBindings
} from '../material/regionalClosureWorkerLane.js';
import { responseFunctionGpuWgsl } from '../material/responseFunctionGpu.js';

export const SPH_THERMAL_REGIONAL_CLOSURE_SCHEMA =
  'peercompute.ulg.a3-thermal-regional-closure.v1';

export const SPH_THERMAL_REGIONAL_G4_REGION_COUNT = 8;

const THERMAL_REGIONAL_RADIATION_CONSUMER_WGSL = /* wgsl */ `
${responseFunctionGpuWgsl('rf_table')}

struct ConsumerParams {
  particle_count: u32,
  region_count: u32,
  pad0: u32,
  pad1: u32,
  // ambient_t4_norm = (T_amb / 300)^4, sigma_300_4 = sigma_SB * 300^4, emissivity, unused
  rad: vec4<f32>,
};
@group(0) @binding(0) var<uniform> consumer_params: ConsumerParams;
@group(0) @binding(1) var<storage, read> members: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> rf_table: array<f32>;
@group(0) @binding(3) var<storage, read> region_states: array<u32>;
// Per-particle output: vec4<f32>(net_radiative_flux_W_per_m2, t4_norm, used_a3_fit (1/0), region_id)
@group(0) @binding(4) var<storage, read_write> radiative_flux_out: array<vec4<f32>>;
// Consumer counters: [a3_fit_hits, direct_fallbacks, skipped, 0]
@group(0) @binding(5) var<storage, read_write> consumer_stats: array<atomic<u32>>;

const A3_REGION_STATE_STRIDE: u32 = 8u;
const A3_REGION_ACTION_LOOKUP: u32 = 3u;

@compute @workgroup_size(64)
fn reset_consumer_stats(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x < 4u) { atomicStore(&consumer_stats[id.x], 0u); }
}

@compute @workgroup_size(128)
fn consume_thermal_regional_radiation(@builtin(global_invocation_id) id: vec3<u32>) {
  let p = id.x;
  if (p >= consumer_params.particle_count) { return; }
  let m = members[p];
  let region_id = bitcast<u32>(m.w);
  if (region_id >= consumer_params.region_count) {
    radiative_flux_out[p] = vec4<f32>(0.0, 0.0, 0.0, f32(region_id));
    atomicAdd(&consumer_stats[2], 1u);
    return;
  }
  var t4_norm = 0.0;
  var used_fit = 0.0;
  let state_base = region_id * A3_REGION_STATE_STRIDE;
  if (
    state_base + 3u < arrayLength(&region_states)
    && region_states[state_base] == 1u
    && region_states[state_base + 2u] == A3_REGION_ACTION_LOOKUP
  ) {
    let phase_u = u32(max(0.0, round(m.y)));
    let mat_u = u32(max(0.0, round(m.z)));
    let member_regime = (phase_u << 16u) | (mat_u & 0xffffu);
    if (member_regime == region_states[state_base + 3u]) {
      let ev = rf_eval(region_id, m.xyz);
      if (ev.y > 0.5 && ev.x == ev.x && ev.x > 0.0) {
        t4_norm = ev.x;
        used_fit = 1.0;
        atomicAdd(&consumer_stats[0], 1u);
      }
    }
  }
  if (used_fit < 0.5) {
    let t = m.x / 300.0;
    let t2 = t * t;
    t4_norm = t2 * t2;
    atomicAdd(&consumer_stats[1], 1u);
  }
  let flux = consumer_params.rad.z * consumer_params.rad.y * (t4_norm - consumer_params.rad.x);
  // Store fitted temperature m.x in .w so downstream thermal kernels can fail-closed
  // to exact pow4(T) whenever a particle's temperature drifts outside the A3 envelope.
  radiative_flux_out[p] = vec4<f32>(flux, t4_norm, used_fit, m.x);
}
`;

// Normalized Stefan-Boltzmann radiative flux (T / 300)^4 with strict
// (phaseId, materialId) regime gating so mixed-phase or multi-material G4
// octant cells remain DIRECT_HETEROGENEOUS and never fit across a phase boundary.
export const DEFAULT_THERMAL_RADIATION_REGIONAL_GENERATOR_WGSL = /* wgsl */ `
fn a3_regime(x: vec3<f32>) -> u32 {
  let temp_k = x.x;
  let phase_id = u32(max(0.0, round(x.y)));
  let mat_id = u32(max(0.0, round(x.z)));
  if (!(temp_k >= 50.0 && temp_k <= 10000.0) || phase_id < 1u || phase_id > 3u) {
    return 0xffffffffu;
  }
  return (phase_id << 16u) | (mat_id & 0xffffu);
}
fn a3_generator(x: vec3<f32>) -> f32 {
  let t = x.x / 300.0;
  let t2 = t * t;
  return t2 * t2;
}
`;

const THERMAL_REGIONAL_MEMBER_PACK_WGSL = /* wgsl */ `
struct ThermalPackParams {
  particle_count: u32,
  region_count: u32,
  pad0: u32,
  pad1: u32,
  inv_box_dims: vec4<f32>,
};
@group(0) @binding(0) var<uniform> pack_params: ThermalPackParams;
@group(0) @binding(1) var<storage, read> sph_state: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> sph_thermo: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> members: array<vec4<f32>>;

@compute @workgroup_size(128)
fn thermal_pack_regional_members(@builtin(global_invocation_id) id: vec3<u32>) {
  let p = id.x;
  if (p >= pack_params.particle_count) { return; }
  let pos_mass = sph_state[p * 2u];
  let thermo0 = sph_thermo[p * 3u];
  // Canonical SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT: vec4(materialId, phaseId, temperatureK, restDensity).
  let mat_id = round(thermo0.x);
  let phase_id = round(thermo0.y);
  let temp_k = thermo0.z;
  let alive = pos_mass.w > 0.0
    && temp_k >= 50.0 && temp_k <= 10000.0
    && phase_id >= 1.0 && phase_id <= 3.0;
  if (alive) {
    let norm = clamp(pos_mass.xyz * pack_params.inv_box_dims.xyz, vec3<f32>(0.0), vec3<f32>(0.999999));
    let cell = vec3<u32>(floor(norm * 2.0));
    let region_id = min(pack_params.region_count - 1u, cell.x + cell.y * 2u + cell.z * 4u);
    members[p] = vec4<f32>(temp_k, phase_id, mat_id, bitcast<f32>(region_id));
  } else {
    // region_id == region_count is skipped cleanly without NaN bitcast.
    members[p] = vec4<f32>(300.0, 0.0, 0.0, bitcast<f32>(pack_params.region_count));
  }
}
`;

const GPU_BUFFER_USAGE = Object.freeze({
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 0x08,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 0x40,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 0x80
});
const GPU_SHADER_STAGE_COMPUTE = globalThis.GPUShaderStage?.COMPUTE ?? 0x04;

const A3_THERMAL_REGIONAL_CACHE_SYMBOL = Symbol.for('ulg.a3ThermalRegionalByDevice');
const cacheByDevice = globalThis[A3_THERMAL_REGIONAL_CACHE_SYMBOL]
  || (globalThis[A3_THERMAL_REGIONAL_CACHE_SYMBOL] = new WeakMap());

function ensureThermalRegionalCache(device, particleCount) {
  const keyDevice = unwrapWebGpuCacheDevice(device);
  let cache = cacheByDevice.get(keyDevice);
  if (!cache) {
    const packModule = keyDevice.createShaderModule({
      label: 'ulg-sph-thermal-a3-pack',
      code: THERMAL_REGIONAL_MEMBER_PACK_WGSL
    });
    const packLayout = keyDevice.createBindGroupLayout({
      label: 'ulg-sph-thermal-a3-pack-layout',
      entries: [
        { binding: 0, visibility: GPU_SHADER_STAGE_COMPUTE, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPU_SHADER_STAGE_COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: GPU_SHADER_STAGE_COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 3, visibility: GPU_SHADER_STAGE_COMPUTE, buffer: { type: 'storage' } }
      ]
    });
    const packPipeline = keyDevice.createComputePipeline({
      label: 'ulg-sph-thermal-a3-pack-pipeline',
      layout: keyDevice.createPipelineLayout({ bindGroupLayouts: [packLayout] }),
      compute: { module: packModule, entryPoint: 'thermal_pack_regional_members' }
    });
    const packParamsBuffer = keyDevice.createBuffer({
      label: 'ulg-sph-thermal-a3-pack-params',
      size: 32,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
    });
    const consumerModule = keyDevice.createShaderModule({
      label: 'ulg-sph-thermal-a3-consumer',
      code: THERMAL_REGIONAL_RADIATION_CONSUMER_WGSL
    });
    const consumerLayout = keyDevice.createBindGroupLayout({
      label: 'ulg-sph-thermal-a3-consumer-layout',
      entries: [
        { binding: 0, visibility: GPU_SHADER_STAGE_COMPUTE, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPU_SHADER_STAGE_COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: GPU_SHADER_STAGE_COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 3, visibility: GPU_SHADER_STAGE_COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 4, visibility: GPU_SHADER_STAGE_COMPUTE, buffer: { type: 'storage' } },
        { binding: 5, visibility: GPU_SHADER_STAGE_COMPUTE, buffer: { type: 'storage' } }
      ]
    });
    const consumerPipelineLayout = keyDevice.createPipelineLayout({ bindGroupLayouts: [consumerLayout] });
    const consumerResetPipeline = keyDevice.createComputePipeline({
      label: 'ulg-sph-thermal-a3-consumer-reset',
      layout: consumerPipelineLayout,
      compute: { module: consumerModule, entryPoint: 'reset_consumer_stats' }
    });
    const consumerPipeline = keyDevice.createComputePipeline({
      label: 'ulg-sph-thermal-a3-consumer-eval',
      layout: consumerPipelineLayout,
      compute: { module: consumerModule, entryPoint: 'consume_thermal_regional_radiation' }
    });
    const consumerParamsBuffer = keyDevice.createBuffer({
      label: 'ulg-sph-thermal-a3-consumer-params',
      size: 32,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
    });
    const consumerStatsBuffer = keyDevice.createBuffer({
      label: 'ulg-sph-thermal-a3-consumer-stats',
      size: 16,
      usage: GPU_BUFFER_USAGE.STORAGE | (globalThis.GPUBufferUsage?.COPY_SRC ?? 0x04)
    });
    cache = {
      packLayout,
      packPipeline,
      packParamsBuffer,
      consumerLayout,
      consumerResetPipeline,
      consumerPipeline,
      consumerParamsBuffer,
      consumerStatsBuffer,
      radiativeFluxBuffer: null,
      membersBuffer: null,
      memberCapacity: 0,
      lane: null,
      evaluatedSchedules: 0,
      adoptedSchedules: 0,
      consumedSchedules: 0,
      physicsConsumedSteps: 0
    };
    cacheByDevice.set(keyDevice, cache);
  }
  const needed = Math.max(256, 1 << Math.ceil(Math.log2(Math.max(1, particleCount))));
  if (!cache.lane || cache.memberCapacity < needed) {
    if (cache.lane) destroyRegionalClosureWorkerLane(cache.lane);
    cache.membersBuffer?.destroy?.();
    cache.radiativeFluxBuffer?.destroy?.();
    cache.memberCapacity = needed;
    cache.membersBuffer = keyDevice.createBuffer({
      label: `ulg-sph-thermal-a3-members-${needed}`,
      size: needed * 16,
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
    });
    cache.radiativeFluxBuffer = keyDevice.createBuffer({
      label: `ulg-sph-thermal-a3-flux-${needed}`,
      size: needed * 16,
      usage: GPU_BUFFER_USAGE.STORAGE | (globalThis.GPUBufferUsage?.COPY_SRC ?? 0x04)
    });
    cache.lane = createRegionalClosureWorkerLane(keyDevice, {
      name: 'ulg-sph-thermal-a3-g4-lane',
      generatorWgsl: DEFAULT_THERMAL_RADIATION_REGIONAL_GENERATOR_WGSL,
      axes: 3,
      regionCapacity: SPH_THERMAL_REGIONAL_G4_REGION_COUNT,
      memberCapacity: needed,
      degrees: [6, 0, 0],
      tolerances: [400.0, 0.5, 0.5],
      margin: 0.25,
      policy: 'async',
      relativeTolerance: 1e-5,
      heldOutPerAxis: 3,
      safetyFactor: 2
    });
  }
  return cache;
}

export function getSphThermalRegionalClosureLane(device) {
  if (!device) return null;
  const cached = cacheByDevice.get(unwrapWebGpuCacheDevice(device));
  return cached?.lane ?? null;
}

export function getSphThermalRegionalRadiativeFluxBinding(device) {
  if (!device) return null;
  const cached = cacheByDevice.get(unwrapWebGpuCacheDevice(device));
  if (
    !cached?.radiativeFluxBuffer
    || cached.radiativeFluxBuffer.destroyed === true
    || !(cached.adoptedSchedules > 0)
    || !(cached.consumedSchedules > 0)
  ) {
    return null;
  }
  return Object.freeze({
    radiativeFluxBuffer: cached.radiativeFluxBuffer,
    consumerStatsBuffer: cached.consumerStatsBuffer,
    memberCapacity: cached.memberCapacity,
    adoptedSchedules: cached.adoptedSchedules,
    consumedSchedules: cached.consumedSchedules,
    physicsConsumedSteps: cached.physicsConsumedSteps
  });
}

export function noteSphThermalRegionalPhysicsConsumption(device) {
  if (!device) return 0;
  const cached = cacheByDevice.get(unwrapWebGpuCacheDevice(device));
  if (!cached) return 0;
  cached.physicsConsumedSteps += 1;
  const prev = globalThis.__ulgA3ThermalRegionalClosureStatus;
  if (prev && typeof prev === 'object') {
    const next = Object.freeze({
      ...prev,
      thermalKernelPhysicsConsumerSteps: cached.physicsConsumedSteps,
      livePhysicsConsumerActive: cached.physicsConsumedSteps > 0
    });
    globalThis.__ulgA3ThermalRegionalClosureStatus = next;
    globalThis.__ulgA3RegionalClosureStatus = Object.freeze({
      ...(globalThis.__ulgA3RegionalClosureStatus ?? { active: true }),
      active: true,
      thermal: next
    });
  }
  return cached.physicsConsumedSteps;
}

export function destroySphThermalRegionalClosureResources(device) {
  if (!device) return false;
  const keyDevice = unwrapWebGpuCacheDevice(device);
  const cached = cacheByDevice.get(keyDevice);
  if (!cached) return false;
  if (cached.lane) destroyRegionalClosureWorkerLane(cached.lane);
  cached.membersBuffer?.destroy?.();
  cached.radiativeFluxBuffer?.destroy?.();
  cached.packParamsBuffer?.destroy?.();
  cached.consumerParamsBuffer?.destroy?.();
  cached.consumerStatsBuffer?.destroy?.();
  cacheByDevice.delete(keyDevice);
  return true;
}

/**
 * Consume the active A3 thermal regional closure GPU table (`rf_eval` over
 * `ADOPTED` homogeneous octants with exact `(T/300)^4` fallback for
 * heterogeneous/unadopted octants) into the resident per-particle radiative
 * flux buffer inside the caller's compute pass (0 extra passes).
 */
export function encodeSphThermalRegionalRadiationConsumer(device, encoder, {
  particleCount,
  ambientTemperatureK = 293.15,
  emissivity = 0.9,
  pass = null
} = {}) {
  const lane = getSphThermalRegionalClosureLane(device);
  const cache = device ? cacheByDevice.get(unwrapWebGpuCacheDevice(device)) : null;
  if (!lane || !cache?.membersBuffer || !cache?.radiativeFluxBuffer || !(particleCount > 0)) {
    return null;
  }
  const bindings = regionalClosureLaneBindings(lane);
  const regionStatesBuf = bindings?.regionStateBuffer ?? bindings?.statesBuffer ?? null;
  if (!bindings?.tableBuffer || !regionStatesBuf) return null;
  const regionCount = SPH_THERMAL_REGIONAL_G4_REGION_COUNT;
  const tAmbNorm = Math.pow(Math.max(1e-3, Number(ambientTemperatureK) || 293.15) / 300.0, 4);
  const sigma300_4 = 5.670374419e-8 * Math.pow(300.0, 4);
  const eps = Math.min(1, Math.max(0, Number(emissivity) || 0.9));
  const cBytes = new ArrayBuffer(32);
  const cu = new Uint32Array(cBytes);
  const cf = new Float32Array(cBytes);
  cu[0] = particleCount;
  cu[1] = regionCount;
  cf[4] = tAmbNorm;
  cf[5] = sigma300_4;
  cf[6] = eps;
  cf[7] = 0;
  device.queue.writeBuffer(cache.consumerParamsBuffer, 0, cBytes);

  const consumerGroup = createCachedExplicitBindGroup(device, {
    label: 'ulg-sph-thermal-a3-consumer-group',
    layout: cache.consumerLayout,
    entries: [
      { binding: 0, resource: { buffer: cache.consumerParamsBuffer } },
      { binding: 1, resource: { buffer: cache.membersBuffer } },
      { binding: 2, resource: { buffer: bindings.tableBuffer } },
      { binding: 3, resource: { buffer: regionStatesBuf } },
      { binding: 4, resource: { buffer: cache.radiativeFluxBuffer } },
      { binding: 5, resource: { buffer: cache.consumerStatsBuffer } }
    ]
  });
  const activePass = pass ?? encoder.beginComputePass({ label: 'ulg-sph-thermal-a3-consumer-pass' });
  activePass.setBindGroup(0, consumerGroup);
  activePass.setPipeline(cache.consumerResetPipeline);
  activePass.dispatchWorkgroups(1);
  activePass.setPipeline(cache.consumerPipeline);
  activePass.dispatchWorkgroups(Math.max(1, Math.ceil(particleCount / 128)));
  if (!pass) activePass.end();
  cache.consumedSchedules += 1;
  return Object.freeze({
    radiativeFluxBuffer: cache.radiativeFluxBuffer,
    consumerStatsBuffer: cache.consumerStatsBuffer,
    consumedSchedules: cache.consumedSchedules
  });
}

/**
 * Encode one GPU-resident A3 G4-cell thermal/phase regional closure tick
 * (pack + evaluate + G5 CAS schedule-boundary adopt) inside ONE single compute
 * pass with zero host readbacks.
 */
export function encodeSphThermalRegionalClosureScheduleTick(device, encoder, {
  stateBuffer,
  thermoBuffer,
  particleCount,
  boxDimsM = [1, 1, 1],
  scheduleId = null,
  verify = false
} = {}) {
  if (
    !device
    || !encoder
    || !stateBuffer
    || !thermoBuffer
    || !(particleCount > 0)
    || globalThis.__ulgDisableA3ThermalRegionalLane === true
  ) {
    return null;
  }
  const cache = ensureThermalRegionalCache(device, particleCount);
  const regionCount = SPH_THERMAL_REGIONAL_G4_REGION_COUNT;
  const dims = Array.isArray(boxDimsM) && boxDimsM.length === 3
    ? boxDimsM.map((v) => (Number.isFinite(Number(v)) && Number(v) > 1e-9 ? Number(v) : 1))
    : [1, 1, 1];
  const paramsBytes = new ArrayBuffer(32);
  const u32 = new Uint32Array(paramsBytes);
  const f32 = new Float32Array(paramsBytes);
  u32[0] = particleCount;
  u32[1] = regionCount;
  f32[4] = 1 / dims[0];
  f32[5] = 1 / dims[1];
  f32[6] = 1 / dims[2];
  f32[7] = 0;
  device.queue.writeBuffer(cache.packParamsBuffer, 0, paramsBytes);

  const packGroup = createCachedExplicitBindGroup(device, {
    label: 'ulg-sph-thermal-a3-pack-group',
    layout: cache.packLayout,
    entries: [
      { binding: 0, resource: { buffer: cache.packParamsBuffer } },
      { binding: 1, resource: { buffer: stateBuffer } },
      { binding: 2, resource: { buffer: thermoBuffer } },
      { binding: 3, resource: { buffer: cache.membersBuffer } }
    ]
  });

  // Single compute pass for pack + evaluate + schedule-boundary G5 adopt.
  const pass = encoder.beginComputePass({ label: 'ulg-sph-thermal-a3-g4-schedule-tick' });
  pass.setPipeline(cache.packPipeline);
  pass.setBindGroup(0, packGroup);
  pass.dispatchWorkgroups(Math.max(1, Math.ceil(particleCount / 128)));

  encodeRegionalClosureLaneEvaluate(cache.lane, encoder, {
    membersBuffer: cache.membersBuffer,
    regionCount,
    memberCount: particleCount,
    pass
  });
  cache.evaluatedSchedules += 1;
  const adopted = encodeRegionalClosureLaneAdopt(cache.lane, encoder, {
    membersBuffer: cache.membersBuffer,
    regionCount,
    scheduleId,
    pass
  });
  cache.adoptedSchedules += 1;
  const consumed = encodeSphThermalRegionalRadiationConsumer(device, encoder, {
    particleCount,
    pass
  });
  pass.end();

  if (verify === true) {
    encodeRegionalClosureLaneVerify(cache.lane, encoder, {
      membersBuffer: cache.membersBuffer,
      memberCount: particleCount
    });
  }

  const bindings = regionalClosureLaneBindings(cache.lane);
  const thermalStatus = Object.freeze({
    schema: SPH_THERMAL_REGIONAL_CLOSURE_SCHEMA,
    active: true,
    closure: 'thermal-radiation-t4-g4-octants',
    ordinal: bindings.ordinal,
    regionCount,
    memberCount: particleCount,
    evaluatedSchedules: cache.evaluatedSchedules,
    adoptedSchedules: cache.adoptedSchedules,
    consumedSchedules: cache.consumedSchedules,
    thermalKernelPhysicsConsumerSteps: cache.physicsConsumedSteps,
    liveGpuConsumerActive: Boolean(consumed),
    livePhysicsConsumerActive: cache.physicsConsumedSteps > 0,
    externalSourceFingerprint: bindings.externalSourceFingerprint
  });
  globalThis.__ulgA3ThermalRegionalClosureStatus = thermalStatus;
  globalThis.__ulgA3RegionalClosureStatus = Object.freeze({
    ...(globalThis.__ulgA3RegionalClosureStatus ?? { active: true }),
    active: true,
    thermal: thermalStatus
  });
  return Object.freeze({
    ...adopted,
    membersBuffer: cache.membersBuffer,
    radiativeFluxBuffer: consumed?.radiativeFluxBuffer ?? cache.radiativeFluxBuffer,
    consumerStatsBuffer: consumed?.consumerStatsBuffer ?? cache.consumerStatsBuffer,
    bindings,
    status: thermalStatus
  });
}
