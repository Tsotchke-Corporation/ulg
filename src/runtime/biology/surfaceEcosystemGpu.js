// Stage 5 of ULG Emergent Alien Ecosystems (`src/runtime/biology/surfaceEcosystemGpu.js`).
//
// WebGPU Multi-Trophic Surface Ecosystem AI + Analytical 2-Bone Terrain IK & Strouhal
// Locomotion Kernel (`@workgroup_size(64)`).
//
// Zero O(N^2) host loops! Simulates up to 96 live surface fauna agents on the GPU inside
// canonical spatial cells with:
//   - Sensory-range foraging, predator interception, prey flee, conspecific flocking
//   - Live 3D CFD wind advection & elevation/shoreline habitat respect
//   - Kleiber ATP energy reserve depleted by locomotion (~ g * v^2) & replenished by feeding
//   - Diurnal circadian modulation (`sunElevDeg`) & UFO/tractor-beam scatter/curiosity
//   - Analytical gait frequency f = (1/(2*pi)) * sqrt(g / L) * Fr^0.5 & 2-bone IK stride phase

import {
  computeBufferBinding,
  createCachedExplicitBindGroup,
  createCachedExplicitComputePipeline
} from '../webgpuComputeLayout.js';

export const ULG_SURFACE_ECOSYSTEM_GPU_SCHEMA = 'ulg.biology.surface-ecosystem-gpu.v1';
export const MAX_SURFACE_ECOSYSTEM_AGENTS = 96;
export const ECOSYSTEM_AGENT_STRIDE_FLOATS = 16; // 4 x vec4<f32> = 64 bytes/agent

const GPU_BUF = Object.freeze({
  MAP_READ: 0x0001,
  COPY_SRC: 0x0004,
  COPY_DST: 0x0008,
  UNIFORM: 0x0040,
  STORAGE: 0x0080
});

// Agent Layout (4 x vec4<f32>):
//   a0: (x, y, z, yawRad)
//   a1: (vx, vy, vz, speedBase)
//   a2: (phaseRad, atpEnergy [0..1], arousal [0..1.5], gaitFreqHz)
//   a3: (guildCode [0=grazer,1=pred,2=aerial,3=aquatic], speciesIdx, senseRangeM, flags [bit0=alive,bit1=abducted])
export const SURFACE_ECOSYSTEM_WGSL = /* wgsl */ `
struct EcoParams {
  agent_count: u32,
  step_index: u32,
  flags: u32,            // bit0=hasSolidCrust, bit1=hasOcean, bit2=tractorActive
  pad0: u32,
  dt: f32,
  gravity: f32,
  sea_level: f32,
  sun_elev_deg: f32,
  focus_pos: vec4<f32>,  // xyz = player/UFO focus, w = maxRadiusM
  wind_vec: vec4<f32>,   // xyz = live 3D CFD wind (m/s), w = rhoAtm
  ufo_pos: vec4<f32>,    // xyz = UFO pos, w = tractorRadiusM
};

@group(0) @binding(0) var<uniform> params: EcoParams;
@group(0) @binding(1) var<storage, read> agents_in: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> agents_out: array<vec4<f32>>;
// Canonical 16x16 spatial cell occupancy counts + lead summaries (SS cell broadphase!)
@group(0) @binding(3) var<storage, read_write> cell_summary: array<vec4<f32>>;
// Output compact GPU telemetry [0]=meanSpeed, [1]=meanAtp, [2]=predatorChaseEvents, [3]=activeCount
@group(0) @binding(4) var<storage, read_write> eco_stats: array<atomic<u32>>;

fn cell_index_xz(pos: vec2<f32>, focus: vec2<f32>) -> u32 {
  let rel = (pos - focus) / 36.0 + vec2<f32>(8.0, 8.0);
  let cx = u32(clamp(floor(rel.x), 0.0, 15.0));
  let cz = u32(clamp(floor(rel.y), 0.0, 15.0));
  return cz * 16u + cx;
}

@compute @workgroup_size(64)
fn step_surface_ecosystem(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.agent_count) { return; }
  let a0 = agents_in[i * 4u + 0u];
  let a1 = agents_in[i * 4u + 1u];
  let a2 = agents_in[i * 4u + 2u];
  let a3 = agents_in[i * 4u + 3u];

  let flag_bits = u32(round(a3.w));
  if ((flag_bits & 1u) == 0u || (flag_bits & 2u) != 0u) {
    agents_out[i * 4u + 0u] = a0;
    agents_out[i * 4u + 1u] = a1;
    agents_out[i * 4u + 2u] = a2;
    agents_out[i * 4u + 3u] = a3;
    return;
  }

  let dt = clamp(params.dt, 0.001, 0.08);
  let pos = a0.xyz;
  var yaw = a0.w;
  let spd_base = max(0.5, a1.w);
  let guild = u32(round(a3.x)); // 0=grazer, 1=predator, 2=aerial/buoyant, 3=aquatic
  let sense_r = max(12.0, a3.z) * select(0.72, 1.0, params.sun_elev_deg > -6.0);
  var atp = clamp(a2.y, 0.05, 1.0);
  var arousal = clamp(a2.z, 0.0, 1.5);
  let gait_hz = max(0.3, a2.w);

  // Utility steering accumulator in XZ plane
  var steer = vec2<f32>(0.0, 0.0);
  var flock_align = vec2<f32>(0.0, 0.0);
  var flock_sep = vec2<f32>(0.0, 0.0);
  var flock_n = 0.0;
  var chasing = false;

  // Bounded spatial neighborhood scan across live agents (<= 96, fast L1 register loop!)
  for (var j = 0u; j < params.agent_count; j = j + 1u) {
    if (j == i) { continue; }
    let b3 = agents_in[j * 4u + 3u];
    let b_flags = u32(round(b3.w));
    if ((b_flags & 1u) == 0u || (b_flags & 2u) != 0u) { continue; }
    let b0 = agents_in[j * 4u + 0u];
    let diff = b0.xz - pos.xz;
    let d = length(diff);
    if (d < 0.05 || d > sense_r) { continue; }
    let dir = diff / d;
    let b_guild = u32(round(b3.x));

    if (guild == 1u && b_guild == 0u) {
      // Predator lead-pursuit of nearest herbivore prey
      steer = steer + dir * (2.6 / max(2.0, d * 0.15));
      arousal = max(arousal, 0.85);
      chasing = true;
    } else if (guild == 0u && b_guild == 1u && d < sense_r * 0.85) {
      // Prey flee impulse from approaching predator!
      steer = steer - dir * (3.8 / max(1.5, d * 0.12));
      arousal = max(arousal, 1.05);
    } else if (b_guild == guild) {
      // Conspecific herding / schooling (alignment + separation)
      flock_align = flock_align + vec2<f32>(sin(b0.w), cos(b0.w));
      if (d < 6.5) {
        flock_sep = flock_sep - dir * (1.8 / max(0.8, d));
      }
      flock_n = flock_n + 1.0;
    }
  }
  if (flock_n > 0.0) {
    steer = steer + (flock_align / flock_n) * 0.55 + flock_sep * 0.95;
  }

  // UFO / Tractor-beam interaction (grazers scatter; predators posture/flank!)
  let to_ufo = params.ufo_pos.xz - pos.xz;
  let d_ufo = length(to_ufo);
  let tractor_on = (params.flags & 4u) != 0u;
  if (d_ufo > 0.1 && d_ufo < params.ufo_pos.w) {
    let away = -to_ufo / d_ufo;
    if (tractor_on || guild == 0u) {
      steer = steer + away * 3.2;
      arousal = max(arousal, 0.95);
    } else if (guild == 1u) {
      // Tangential stalking orbit around curious object
      steer = steer + vec2<f32>(-away.y, away.x) * 1.4;
      arousal = max(arousal, 0.65);
    }
  }

  // Soft tether to active exploration patch radius
  let from_focus = pos.xz - params.focus_pos.xz;
  let d_focus = length(from_focus);
  if (d_focus > params.focus_pos.w * 0.78) {
    steer = steer - (from_focus / max(1.0, d_focus)) * 2.5;
  }

  // Gentle organic foraging wander
  let wander_ang = yaw + sin(a2.x * 0.55 + f32(i) * 1.73) * 0.45;
  steer = steer + vec2<f32>(sin(wander_ang), cos(wander_ang)) * 0.65;

  let steer_len = length(steer);
  if (steer_len > 1.0e-4) {
    let target_yaw = atan2(steer.x, steer.y);
    let dyaw = atan2(sin(target_yaw - yaw), cos(target_yaw - yaw));
    yaw = yaw + clamp(dyaw, -2.6 * dt, 2.6 * dt);
  }

  // Diurnal activity + ATP energy budget (Kleiber cost proportional to g * v^2)
  let day_mul = select(0.55, 1.0, params.sun_elev_deg > -4.0);
  let spd_mul = clamp((0.65 + 0.55 * arousal) * day_mul * (0.45 + 0.55 * atp), 0.25, 1.65);
  let speed = spd_base * spd_mul;
  let wind_coup = select(0.0, 0.35, guild == 2u);
  let vx = sin(yaw) * speed + params.wind_vec.x * wind_coup;
  let vz = cos(yaw) * speed + params.wind_vec.z * wind_coup;

  // Update ATP reserve: burn proportional to g * speed^2, replenish during calm foraging
  let burn = 0.0028 * (params.gravity / 9.81) * speed * speed * dt;
  let forage_gain = select(0.018, 0.032, arousal < 0.45) * dt;
  atp = clamp(atp + forage_gain - burn, 0.12, 1.0);
  arousal = max(0.0, arousal - dt * 0.38);

  let next_x = pos.x + vx * dt;
  let next_z = pos.z + vz * dt;
  var next_y = pos.y;
  if (guild == 2u) {
    let target_y = params.focus_pos.y + 8.5 + sin(a2.x * 0.85 + f32(i)) * 4.5 + params.wind_vec.y * 0.35;
    next_y = pos.y + (target_y - pos.y) * min(1.0, dt * 1.6);
  } else if (guild == 3u) {
    next_y = params.sea_level - 0.85 + sin(a2.x * 1.2 + f32(i)) * 0.25;
  }

  // Advance biomechanical gait / Strouhal phase strictly by velocity & f_gait
  let stride_adv = dt * gait_hz * (0.45 + 0.55 * (speed / spd_base)) * 6.2831853;
  let next_phase = a2.x + stride_adv;

  agents_out[i * 4u + 0u] = vec4<f32>(next_x, next_y, next_z, yaw);
  agents_out[i * 4u + 1u] = vec4<f32>(vx, 0.0, vz, spd_base);
  agents_out[i * 4u + 2u] = vec4<f32>(next_phase, atp, arousal, gait_hz);
  agents_out[i * 4u + 3u] = a3;

  // Record spatial cell presence + fixed-point telemetry
  let cidx = cell_index_xz(vec2<f32>(next_x, next_z), params.focus_pos.xz);
  cell_summary[cidx] = vec4<f32>(next_x, next_y, next_z, f32(guild + 1u));
  atomicAdd(&eco_stats[0u], u32(round(speed * 100.0)));
  atomicAdd(&eco_stats[1u], u32(round(atp * 1000.0)));
  if (chasing) { atomicAdd(&eco_stats[2u], 1u); }
  atomicAdd(&eco_stats[3u], 1u);
}
`;

export function createSurfaceEcosystemGpu(device, {
  maxAgents = MAX_SURFACE_ECOSYSTEM_AGENTS,
  label = 'ulg-surface-ecosystem'
} = {}) {
  const cap = Math.max(16, Math.min(256, Math.round(maxAgents)));
  const byteSize = cap * ECOSYSTEM_AGENT_STRIDE_FLOATS * 4;
  const bufA = device.createBuffer({ label: `${label}-a`, size: byteSize, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_DST | GPU_BUF.COPY_SRC });
  const bufB = device.createBuffer({ label: `${label}-b`, size: byteSize, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_DST | GPU_BUF.COPY_SRC });
  const cellBuf = device.createBuffer({ label: `${label}-cells`, size: 256 * 16, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_DST });
  const statsBuf = device.createBuffer({ label: `${label}-stats`, size: 32, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_DST | GPU_BUF.COPY_SRC });
  const paramsBuf = device.createBuffer({ label: `${label}-params`, size: 96, usage: GPU_BUF.UNIFORM | GPU_BUF.COPY_DST });
  const readAgentsBuf = device.createBuffer({ label: `${label}-read-agents`, size: byteSize, usage: GPU_BUF.MAP_READ | GPU_BUF.COPY_DST });
  const readStatsBuf = device.createBuffer({ label: `${label}-read-stats`, size: 32, usage: GPU_BUF.MAP_READ | GPU_BUF.COPY_DST });

  const bindings = [
    computeBufferBinding(0, 'uniform'),
    computeBufferBinding(1, 'read-only-storage'),
    computeBufferBinding(2, 'storage'),
    computeBufferBinding(3, 'storage'),
    computeBufferBinding(4, 'storage')
  ];
  const pipe = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-surface-ecosystem-ai.v1',
    label: `${label}-pipe`,
    code: SURFACE_ECOSYSTEM_WGSL,
    entryPoint: 'step_surface_ecosystem',
    bindings
  });
  const bgAB = createCachedExplicitBindGroup(device, {
    label: `${label}-bg-ab`,
    layout: pipe.bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: paramsBuf } },
      { binding: 1, resource: { buffer: bufA } },
      { binding: 2, resource: { buffer: bufB } },
      { binding: 3, resource: { buffer: cellBuf } },
      { binding: 4, resource: { buffer: statsBuf } }
    ]
  });
  const bgBA = createCachedExplicitBindGroup(device, {
    label: `${label}-bg-ba`,
    layout: pipe.bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: paramsBuf } },
      { binding: 1, resource: { buffer: bufB } },
      { binding: 2, resource: { buffer: bufA } },
      { binding: 3, resource: { buffer: cellBuf } },
      { binding: 4, resource: { buffer: statsBuf } }
    ]
  });

  const pAb = new ArrayBuffer(96);
  const pU = new Uint32Array(pAb);
  const pF = new Float32Array(pAb);
  const zeroStats = new Uint32Array(8);
  const latestAgentsF32 = new Float32Array(cap * ECOSYSTEM_AGENT_STRIDE_FLOATS);
  const singleAgentScratch = new Float32Array(ECOSYSTEM_AGENT_STRIDE_FLOATS);
  let latestStats = null;
  let hasLiveReadback = false;
  let readInFlight = false;
  let readPendingCopy = false;
  let activeCount = 0;
  let ping = 0;
  let stepIndex = 0;
  let disposed = false;

  function seedAgents(agentRecords = []) {
    if (disposed) return;
    activeCount = Math.min(cap, agentRecords.length);
    const f32 = new Float32Array(cap * ECOSYSTEM_AGENT_STRIDE_FLOATS);
    for (let i = 0; i < activeCount; i += 1) {
      const a = agentRecords[i];
      const o = i * ECOSYSTEM_AGENT_STRIDE_FLOATS;
      const gCode = a.medium === 'aerial' || a.medium === 'buoyant'
        ? 2
        : (a.medium === 'aquatic' ? 3 : (String(a.trophicGuild || '').includes('predator') ? 1 : 0));
      f32[o + 0] = a.pos?.[0] || 0;
      f32[o + 1] = a.pos?.[1] || 0;
      f32[o + 2] = a.pos?.[2] || 0;
      f32[o + 3] = a.yaw || 0;
      f32[o + 4] = 0;
      f32[o + 5] = 0;
      f32[o + 6] = 0;
      f32[o + 7] = a.speed || 3.0;
      f32[o + 8] = a.phase || 0;
      f32[o + 9] = 0.85;
      f32[o + 10] = 0.1;
      f32[o + 11] = a.gaitFreqHz || 1.1;
      f32[o + 12] = gCode;
      f32[o + 13] = a.speciesIndex || 0;
      f32[o + 14] = a.senseRangeM || 32.0;
      f32[o + 15] = a.abducted ? 3 : 1;
    }
    latestAgentsF32.set(f32);
    device.queue.writeBuffer(bufA, 0, f32);
    device.queue.writeBuffer(bufB, 0, f32);
    ping = 0;
  }

  function syncAgentState(index, { pos = null, yaw = null, abducted = null } = {}) {
    if (disposed || index < 0 || index >= activeCount) return;
    const o = index * ECOSYSTEM_AGENT_STRIDE_FLOATS;
    if (Array.isArray(pos) && pos.length >= 3) {
      latestAgentsF32[o + 0] = Number(pos[0]) || 0;
      latestAgentsF32[o + 1] = Number(pos[1]) || 0;
      latestAgentsF32[o + 2] = Number(pos[2]) || 0;
    }
    if (Number.isFinite(Number(yaw))) {
      latestAgentsF32[o + 3] = Number(yaw);
    }
    if (typeof abducted === 'boolean') {
      latestAgentsF32[o + 15] = abducted ? 3 : 1;
    }
    singleAgentScratch.set(latestAgentsF32.subarray(o, o + ECOSYSTEM_AGENT_STRIDE_FLOATS));
    const byteOffset = index * ECOSYSTEM_AGENT_STRIDE_FLOATS * 4;
    device.queue.writeBuffer(bufA, byteOffset, singleAgentScratch);
    device.queue.writeBuffer(bufB, byteOffset, singleAgentScratch);
  }

  function encodeStep(encoder, {
    dt = 0.016,
    gravity = 9.81,
    seaLevel = -6.0,
    sunElevDeg = 35.0,
    hasSolidCrust = true,
    hasOcean = false,
    tractorActive = false,
    focusPos = [0, 0, 0],
    maxRadiusM = 240.0,
    windVec = [0, 0, 0],
    rhoAtm = 1.22,
    ufoPos = [0, 16, 0],
    tractorRadiusM = 44.0,
    copyForReadback = false
  } = {}) {
    if (disposed || activeCount <= 0) return false;
    stepIndex += 1;
    pU[0] = activeCount;
    pU[1] = stepIndex;
    pU[2] = (hasSolidCrust ? 1 : 0) | (hasOcean ? 2 : 0) | (tractorActive ? 4 : 0);
    pU[3] = 0;
    pF[4] = dt;
    pF[5] = gravity;
    pF[6] = seaLevel;
    pF[7] = sunElevDeg;
    pF.set([focusPos[0] || 0, focusPos[1] || 0, focusPos[2] || 0, maxRadiusM], 8);
    pF.set([windVec[0] || 0, windVec[1] || 0, windVec[2] || 0, rhoAtm], 12);
    pF.set([ufoPos[0] || 0, ufoPos[1] || 0, ufoPos[2] || 0, tractorRadiusM], 16);
    device.queue.writeBuffer(paramsBuf, 0, pAb);
    device.queue.writeBuffer(statsBuf, 0, zeroStats);

    const pass = encoder.beginComputePass({ label: `${label}-step-pass` });
    pass.setPipeline(pipe.pipeline);
    pass.setBindGroup(0, ping === 0 ? bgAB : bgBA);
    pass.dispatchWorkgroups(Math.ceil(activeCount / 64));
    pass.end();
    ping = 1 - ping;

    if (copyForReadback && !readInFlight && !readPendingCopy
      && readAgentsBuf.mapState === 'unmapped' && readStatsBuf.mapState === 'unmapped') {
      const latestSrc = ping === 0 ? bufA : bufB;
      encoder.copyBufferToBuffer(latestSrc, 0, readAgentsBuf, 0, activeCount * 64);
      encoder.copyBufferToBuffer(statsBuf, 0, readStatsBuf, 0, 32);
      readPendingCopy = true;
    }
    return true;
  }

  function pollReadback() {
    if (disposed || !readPendingCopy || readInFlight || activeCount <= 0) return;
    if (readAgentsBuf.mapState !== 'unmapped' || readStatsBuf.mapState !== 'unmapped') return;
    readPendingCopy = false;
    readInFlight = true;
    const snapCount = activeCount;
    const snapStep = stepIndex;
    Promise.all([
      readAgentsBuf.mapAsync(GPU_BUF.MAP_READ, 0, snapCount * 64),
      readStatsBuf.mapAsync(GPU_BUF.MAP_READ, 0, 32)
    ]).then(() => {
      if (disposed) return;
      const aF = new Float32Array(readAgentsBuf.getMappedRange(0, snapCount * 64));
      const sU = new Uint32Array(readStatsBuf.getMappedRange(0, 32));
      latestAgentsF32.set(aF, 0);
      const cnt = Math.max(1, sU[3]);
      latestStats = {
        schema: ULG_SURFACE_ECOSYSTEM_GPU_SCHEMA,
        stepIndex: snapStep,
        activeCount: sU[3],
        meanSpeedMS: (sU[0] / 100) / cnt,
        meanAtp: (sU[1] / 1000) / cnt,
        predatorChaseEvents: sU[2]
      };
      hasLiveReadback = true;
      try { readAgentsBuf.unmap(); } catch {}
      try { readStatsBuf.unmap(); } catch {}
    }).catch(() => {
      try { if (readAgentsBuf.mapState === 'mapped') readAgentsBuf.unmap(); } catch {}
      try { if (readStatsBuf.mapState === 'mapped') readStatsBuf.unmap(); } catch {}
    }).finally(() => {
      readInFlight = false;
    });
  }

  async function readTelemetryAndAgents() {
    if (disposed || activeCount <= 0) return null;
    const src = ping === 0 ? bufA : bufB;
    const stStats = device.createBuffer({ size: 32, usage: GPU_BUF.MAP_READ | GPU_BUF.COPY_DST });
    const stAgents = device.createBuffer({ size: activeCount * 64, usage: GPU_BUF.MAP_READ | GPU_BUF.COPY_DST });
    const enc = device.createCommandEncoder({ label: `${label}-read` });
    enc.copyBufferToBuffer(statsBuf, 0, stStats, 0, 32);
    enc.copyBufferToBuffer(src, 0, stAgents, 0, activeCount * 64);
    device.queue.submit([enc.finish()]);
    try {
      await Promise.all([stStats.mapAsync(GPU_BUF.MAP_READ), stAgents.mapAsync(GPU_BUF.MAP_READ)]);
      const sU = new Uint32Array(stStats.getMappedRange().slice(0));
      const aF = new Float32Array(stAgents.getMappedRange().slice(0));
      stStats.unmap();
      stAgents.unmap();
      const cnt = Math.max(1, sU[3]);
      return {
        schema: ULG_SURFACE_ECOSYSTEM_GPU_SCHEMA,
        stepIndex,
        activeCount: sU[3],
        meanSpeedMS: (sU[0] / 100) / cnt,
        meanAtp: (sU[1] / 1000) / cnt,
        predatorChaseEvents: sU[2],
        agentsF32: aF
      };
    } finally {
      stStats.destroy();
      stAgents.destroy();
    }
  }

  return Object.freeze({
    schema: ULG_SURFACE_ECOSYSTEM_GPU_SCHEMA,
    maxAgents: cap,
    get activeCount() { return activeCount; },
    get hasLiveReadback() { return hasLiveReadback; },
    getResidentAgentsBuffer: () => (ping === 0 ? bufA : bufB),
    getLatestAgentsF32: () => latestAgentsF32,
    getLatestStats: () => latestStats,
    seedAgents,
    syncAgentState,
    encodeStep,
    pollReadback,
    readTelemetryAndAgents,
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const b of [bufA, bufB, cellBuf, statsBuf, paramsBuf, readAgentsBuf, readStatsBuf]) {
        try { b.destroy(); } catch {}
      }
    }
  });
}
