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

export const SPH_THERMAL_REGIONAL_CLOSURE_SCHEMA =
  'peercompute.ulg.a3-thermal-regional-closure.v1';

export const SPH_THERMAL_REGIONAL_G4_REGION_COUNT = 8;

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
  let temp_k = thermo0.x;
  let phase_id = round(thermo0.y);
  let mat_id = round(thermo0.z);
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

const cacheByDevice = new WeakMap();

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
    cache = {
      packLayout,
      packPipeline,
      packParamsBuffer,
      membersBuffer: null,
      memberCapacity: 0,
      lane: null,
      evaluatedSchedules: 0,
      adoptedSchedules: 0
    };
    cacheByDevice.set(keyDevice, cache);
  }
  const needed = Math.max(256, 1 << Math.ceil(Math.log2(Math.max(1, particleCount))));
  if (!cache.lane || cache.memberCapacity < needed) {
    if (cache.lane) destroyRegionalClosureWorkerLane(cache.lane);
    cache.membersBuffer?.destroy?.();
    cache.memberCapacity = needed;
    cache.membersBuffer = keyDevice.createBuffer({
      label: `ulg-sph-thermal-a3-members-${needed}`,
      size: needed * 16,
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
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

export function destroySphThermalRegionalClosureResources(device) {
  if (!device) return false;
  const keyDevice = unwrapWebGpuCacheDevice(device);
  const cached = cacheByDevice.get(keyDevice);
  if (!cached) return false;
  if (cached.lane) destroyRegionalClosureWorkerLane(cached.lane);
  cached.membersBuffer?.destroy?.();
  cached.packParamsBuffer?.destroy?.();
  cacheByDevice.delete(keyDevice);
  return true;
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
    bindings,
    status: thermalStatus
  });
}
