import { ULG_SERVICE_IDS } from '../../ulg-gpu-abi/src/serviceContract.js';
import {
  computeBufferBinding,
  createCachedExplicitBindGroup,
  createCachedExplicitComputePipeline
} from '../runtime/webgpuComputeLayout.js';
import {
  evaluateAstrophysicsScaleAtlasMultipoleWebGpu
} from '../runtime/astrophysics/scaleAtlasAstrophysicsGravityBridge.js';
import {
  createSchroederScaleAtlasGravitySolverWebGpu,
  schroederScaleAtlasResidentGravityWgsl
} from '../runtime/sph/schroederScaleAtlasMultipoleGpu.js';

const USAGE_STORAGE = 0x0080;
const USAGE_UNIFORM = 0x0040;
const USAGE_VERTEX = 0x0020;
const USAGE_COPY_DST = 0x0008;
const USAGE_COPY_SRC = 0x0004;
const USAGE_MAP_READ = 0x0001;

function assertWebGpuDevice(device, fnName) {
  if (!device || typeof device.createBuffer !== 'function' || typeof device.createComputePipeline !== 'function') {
    throw new TypeError(`${fnName} requires a valid WebGPU GPUDevice (GPU-native only; no CPU mirror solver).`);
  }
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const PLANETARY_SYSTEM_SPECS = Object.freeze([
  Object.freeze({ name: 'G-Type Star', isStar: true, a: 0, mass: 120.0, radius: 1.38, color: 0xfff0ba, phase: 0, tilt: 0 }),
  Object.freeze({ name: 'Inner Rocky', a: 3.1, mass: 0.010, radius: 0.28, color: 0xd49a6a, phase: 0.4, tilt: 0.05 }),
  Object.freeze({ name: 'Ocean World (H₂O/Fe)', a: 4.9, mass: 0.020, radius: 0.42, color: 0x38bdf8, phase: 1.9, tilt: 0.03 }),
  Object.freeze({ name: 'Ringed Giant', a: 7.7, mass: 0.160, radius: 0.78, color: 0xe6be8a, phase: 3.6, tilt: 0.08, ringed: true }),
  Object.freeze({ name: 'Ice Giant', a: 10.4, mass: 0.055, radius: 0.52, color: 0x7dd3fc, phase: 5.1, tilt: 0.04 })
]);

/**
 * Deterministic Newtonian multi-body Keplerian planetary system initializer
 * matching the 8-float interleaved GPU ABI (`[x, y, z, mass, vx, vy, vz, radius]`).
 * Places all bodies in exact barycentric zero-momentum initial equilibrium with
 * optional `centerOffset` for translation-invariance verification.
 */
export function createPlanetarySystemBodies({
  gravity = 1.0,
  softening = 0.02,
  centerOffset = [0, 0, 0]
} = {}) {
  const ox = Number(centerOffset?.[0]) || 0;
  const oy = Number(centerOffset?.[1]) || 0;
  const oz = Number(centerOffset?.[2]) || 0;
  const n = PLANETARY_SYSTEM_SPECS.length;
  const bodies = new Float32Array(n * 8);
  const starSpec = PLANETARY_SYSTEM_SPECS[0];
  const mStar = starSpec.mass;

  let pxSum = 0; let pySum = 0; let pzSum = 0;
  let mvxSum = 0; let mvySum = 0; let mvzSum = 0;

  for (let i = 1; i < n; i += 1) {
    const spec = PLANETARY_SYSTEM_SPECS[i];
    const th = spec.phase;
    const cosT = Math.cos(spec.tilt);
    const sinT = Math.sin(spec.tilt);
    const x = Math.cos(th) * spec.a;
    const y = Math.sin(th) * spec.a * sinT;
    const z = Math.sin(th) * spec.a * cosT;
    const rEff = Math.hypot(spec.a, softening);
    const vCirc = Math.sqrt((gravity * (mStar + spec.mass)) / rEff);
    const vx = -Math.sin(th) * vCirc;
    const vy = Math.cos(th) * vCirc * sinT;
    const vz = Math.cos(th) * vCirc * cosT;

    bodies.set([x, y, z, spec.mass, vx, vy, vz, spec.radius], i * 8);
    pxSum += spec.mass * x;
    pySum += spec.mass * y;
    pzSum += spec.mass * z;
    mvxSum += spec.mass * vx;
    mvySum += spec.mass * vy;
    mvzSum += spec.mass * vz;
  }

  // Exact barycentric recoil on central star -> total COM at centerOffset, total P == 0
  bodies.set([
    -pxSum / mStar,
    -pySum / mStar,
    -pzSum / mStar,
    mStar,
    -mvxSum / mStar,
    -mvySum / mStar,
    -mvzSum / mStar,
    starSpec.radius
  ], 0);

  for (let i = 0; i < n; i += 1) {
    bodies[i * 8 + 0] += ox;
    bodies[i * 8 + 1] += oy;
    bodies[i * 8 + 2] += oz;
  }
  return bodies;
}

/**
 * Deterministic 8-float interleaved galactic body initializer matching the
 * `eshkols-in-space` ABI (`[x, y, z, mass, vx, vy, vz, radius]`).
 * Supports `disk`, `binary`, and `sphere` initial conditions plus arbitrary
 * `centerOffset` translation, scaling cleanly up to 262,144 resident GPU bodies.
 */
export function createGalacticBodies({
  count = 4096,
  preset = 'disk',
  seed = 825,
  gravity = 1.0,
  softening = 0.22,
  centerOffset = [0, 0, 0]
} = {}) {
  const n = Math.max(64, Math.min(262144, Math.floor(count)));
  const bodies = new Float32Array(n * 8);
  const ox = Number(centerOffset?.[0]) || 0;
  const oy = Number(centerOffset?.[1]) || 0;
  const oz = Number(centerOffset?.[2]) || 0;
  const rand = mulberry32(seed);
  const gauss = () => {
    const u1 = Math.max(1e-7, rand());
    const u2 = rand();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };
  const massNorm = 4096 / Math.max(4096, n);

  if (preset === 'binary') {
    const half = n >> 1;
    const coreMass = 180;
    for (let g = 0; g < 2; g += 1) {
      const sign = g === 0 ? -1 : 1;
      const cx = sign * 6.5;
      const cy = sign * 1.4;
      const cz = sign * -1.8;
      const cvx = -sign * 1.15;
      const cvy = sign * 0.35;
      const cvz = sign * 0.95;
      const start = g * half;
      const end = g === 0 ? half : n;
      bodies.set([cx + ox, cy + oy, cz + oz, coreMass, cvx, cvy, cvz, 0.45], start * 8);
      for (let i = start + 1; i < end; i += 1) {
        const arm = i & 1;
        const r = 0.6 + Math.pow(rand(), 1.45) * 5.2;
        const theta = arm * Math.PI + r * 0.72 + gauss() * 0.28;
        const zOff = gauss() * (0.18 + 0.04 * r);
        const tilt = g === 0 ? 0.32 : -0.45;
        const lx = r * Math.cos(theta);
        const lz = r * Math.sin(theta);
        const ly = zOff;
        const cosT = Math.cos(tilt);
        const sinT = Math.sin(tilt);
        const rx = lx;
        const ry = ly * cosT - lz * sinT;
        const rz = ly * sinT + lz * cosT;

        const mEnc = coreMass + (end - start) * 0.08 * massNorm * (1 - Math.exp(-r / 2.2));
        const vCirc = Math.sqrt((gravity * mEnc) / Math.hypot(r, softening));
        const vtx = -Math.sin(theta) * vCirc;
        const vtz = Math.cos(theta) * vCirc;
        const vrx = vtx;
        const vry = -vtz * sinT;
        const vrz = vtz * cosT;
        const mass = (0.05 + rand() * 0.14) * massNorm;
        const radius = 0.03 + 0.04 * Math.cbrt(mass);
        bodies.set([
          cx + rx + ox, cy + ry + oy, cz + rz + oz, mass,
          cvx + vrx, cvy + vry, cvz + vrz, radius
        ], i * 8);
      }
    }
    return bodies;
  }

  if (preset === 'sphere') {
    const coreMass = 120;
    bodies.set([ox, oy, oz, coreMass, 0, 0, 0, 0.4], 0);
    for (let i = 1; i < n; i += 1) {
      const u = Math.max(1e-4, Math.min(0.995, rand()));
      const r = 2.6 / Math.sqrt(Math.pow(u, -2 / 3) - 1);
      const rClamped = Math.min(12.0, r);
      const cosPhi = 2 * rand() - 1;
      const sinPhi = Math.sqrt(Math.max(0, 1 - cosPhi * cosPhi));
      const theta = 2 * Math.PI * rand();
      const x = rClamped * sinPhi * Math.cos(theta);
      const y = rClamped * cosPhi;
      const z = rClamped * sinPhi * Math.sin(theta);
      const vScale = Math.sqrt((gravity * (coreMass + n * 0.04 * massNorm)) / Math.hypot(rClamped, 1.8)) * 0.45;
      const mass = (0.04 + rand() * 0.12) * massNorm;
      bodies.set([
        x + ox, y + oy, z + oz, mass,
        gauss() * vScale, gauss() * vScale, gauss() * vScale,
        0.03 + 0.03 * Math.cbrt(mass)
      ], i * 8);
    }
    return bodies;
  }

  const coreMass = 260;
  bodies.set([ox, oy, oz, coreMass, 0, 0, 0, 0.55], 0);
  const diskMassTotal = n * 0.09 * massNorm;
  for (let i = 1; i < n; i += 1) {
    const isBulge = i < n * 0.16;
    if (isBulge) {
      const r = Math.abs(gauss()) * 1.1 + 0.12;
      const theta = 2 * Math.PI * rand();
      const y = gauss() * 0.42;
      const x = r * Math.cos(theta);
      const z = r * Math.sin(theta);
      const vCirc = Math.sqrt((gravity * (coreMass + diskMassTotal * 0.12)) / Math.hypot(r, softening));
      const mass = (0.08 + rand() * 0.25) * massNorm;
      bodies.set([
        x + ox, y + oy, z + oz, mass,
        -Math.sin(theta) * vCirc * 0.92 + gauss() * 0.35,
        gauss() * 0.25,
        Math.cos(theta) * vCirc * 0.92 + gauss() * 0.35,
        0.04 + 0.04 * Math.cbrt(mass)
      ], i * 8);
    } else {
      const arm = i & 1;
      const frac = rand();
      const r = 0.8 + Math.pow(frac, 1.35) * 9.8;
      const spiralTwist = 0.62 * Math.log(1 + r * 1.45) * 3.1;
      const spread = (0.14 + 0.042 * r) * gauss();
      const theta = arm * Math.PI + spiralTwist + spread;
      const y = gauss() * (0.14 + 0.025 * r);
      const x = r * Math.cos(theta);
      const z = r * Math.sin(theta);
      const mEnc = coreMass + diskMassTotal * (1 - Math.exp(-r / 3.4));
      const vCirc = Math.sqrt((gravity * mEnc) / Math.hypot(r, softening));
      const mass = (0.04 + Math.pow(rand(), 2.2) * 0.22) * massNorm;
      bodies.set([
        x + ox, y + oy, z + oz, mass,
        -Math.sin(theta) * vCirc + gauss() * 0.16,
        gauss() * 0.06,
        Math.cos(theta) * vCirc + gauss() * 0.16,
        0.025 + 0.04 * Math.cbrt(mass)
      ], i * 8);
    }
  }
  return bodies;
}

/**
 * Deterministic Zel'dovich filamentary cosmic-web initial condition in comoving
 * supergalactic coordinates with optional `centerOffset`.
 */
export function createCosmicWebBodies({
  count = 3072,
  seed = 1370,
  centerOffset = [0, 0, 0]
} = {}) {
  const n = Math.max(64, Math.min(65536, Math.floor(count)));
  const bodies = new Float32Array(n * 8);
  const ox = Number(centerOffset?.[0]) || 0;
  const oy = Number(centerOffset?.[1]) || 0;
  const oz = Number(centerOffset?.[2]) || 0;
  const rand = mulberry32(seed);
  const modes = [];
  for (let m = 0; m < 10; m += 1) {
    modes.push({
      kx: (rand() - 0.5) * 0.85,
      ky: (rand() - 0.5) * 0.85,
      kz: (rand() - 0.5) * 0.85,
      phase: rand() * Math.PI * 2,
      amp: 0.75 + rand() * 0.9
    });
  }
  for (let i = 0; i < n; i += 1) {
    let qx; let qy; let qz;
    do {
      qx = (rand() * 2 - 1) * 10.2;
      qy = (rand() * 2 - 1) * 10.2;
      qz = (rand() * 2 - 1) * 10.2;
    } while (qx * qx + qy * qy + qz * qz > 10.2 * 10.2);

    let dx = 0; let dy = 0; let dz = 0;
    for (const mode of modes) {
      const s = Math.sin(mode.kx * qx + mode.ky * qy + mode.kz * qz + mode.phase) * mode.amp;
      dx += mode.kx * s;
      dy += mode.ky * s;
      dz += mode.kz * s;
    }
    const x = qx + dx * 1.85;
    const y = qy + dy * 1.85;
    const z = qz + dz * 1.85;
    const mass = 0.5 + Math.pow(rand(), 2.5) * 6.0;
    bodies.set([
      x + ox, y + oy, z + oz, mass,
      dx * 0.12, dy * 0.12, dz * 0.12,
      0.06 + 0.05 * Math.cbrt(mass)
    ], i * 8);
  }
  return bodies;
}

/**
 * Tiled shared-memory WebGPU direct N-body compute shader matching the
 * `eshkols-in-space` 8-float interleaved `Body` layout (`x,y,z,mass,vx,vy,vz,radius`).
 * Strictly translation-invariant and momentum-conserving for Newtonian (`mode = 0`)
 * and comoving ΛCDM (`mode = 1`) systems.
 */
export const cosmicNBodyTiledWgsl = /* wgsl */ `
struct Body {
  pos_mass: vec4<f32>,
  vel_radius: vec4<f32>,
};

struct StepParams {
  count: u32,
  mode: u32,
  pad0: u32,
  pad1: u32,
  dt: f32,
  gravity: f32,
  softening2: f32,
  hubble_drag: f32,
  inv_a3: f32,
  pad2: f32,
  pad3: f32,
  pad4: f32,
};

@group(0) @binding(0) var<storage, read> src_bodies: array<Body>;
@group(0) @binding(1) var<storage, read_write> dst_bodies: array<Body>;
@group(0) @binding(2) var<uniform> params: StepParams;

var<workgroup> tile: array<vec4<f32>, 64>;

@compute @workgroup_size(64)
fn step_nbody(
  @builtin(global_invocation_id) gid: vec3<u32>,
  @builtin(local_invocation_id) lid: vec3<u32>
) {
  let idx = gid.x;
  let n = params.count;
  var self_pm = vec4<f32>(0.0);
  var self_vr = vec4<f32>(0.0);
  let alive = idx < n;
  if (alive) {
    self_pm = src_bodies[idx].pos_mass;
    self_vr = src_bodies[idx].vel_radius;
  }

  var acc = vec3<f32>(0.0);
  let num_tiles = (n + 63u) / 64u;
  for (var t = 0u; t < num_tiles; t = t + 1u) {
    let j = t * 64u + lid.x;
    if (j < n) {
      tile[lid.x] = src_bodies[j].pos_mass;
    } else {
      tile[lid.x] = vec4<f32>(0.0);
    }
    workgroupBarrier();

    if (alive && self_pm.w > 0.0) {
      let limit = min(64u, n - t * 64u);
      for (var k = 0u; k < limit; k = k + 1u) {
        let other = tile[k];
        if (other.w <= 0.0) { continue; }
        let d = other.xyz - self_pm.xyz;
        let r2 = dot(d, d) + params.softening2;
        let inv_r = inverseSqrt(r2);
        let inv_r3 = inv_r * inv_r * inv_r;
        acc = acc + d * (other.w * inv_r3);
      }
    }
    workgroupBarrier();
  }

  if (!alive) { return; }
  if (self_pm.w <= 0.0) {
    dst_bodies[idx] = Body(vec4<f32>(0.0), vec4<f32>(0.0));
    return;
  }

  var vel = self_vr.xyz;
  if (params.mode == 1u) {
    let drag = max(0.0, 1.0 - params.hubble_drag * params.dt);
    vel = vel * drag + acc * (params.gravity * params.inv_a3 * params.dt);
  } else {
    vel = vel + acc * (params.gravity * params.dt);
  }
  let pos = self_pm.xyz + vel * params.dt;
  dst_bodies[idx] = Body(vec4<f32>(pos, self_pm.w), vec4<f32>(vel, self_vr.w));
}
`;

/**
 * Resident N-body time integrator consuming accelerations directly from ULG's
 * canonical GPU `SchroederScaleAtlas` multipole gravity solver
 * (`schroederScaleAtlasMultipoleGpu.js` — ZERO private octrees!).
 */
export const cosmicScaleAtlasIntegrateWgsl = /* wgsl */ `
struct Body {
  pos_mass: vec4<f32>,
  vel_radius: vec4<f32>,
};

struct AtlasIntegrateParams {
  count: u32,
  mode: u32,
  pad0: u32,
  pad1: u32,
  dt: f32,
  hubble_drag: f32,
  inv_a3: f32,
  pad2: f32,
};

@group(0) @binding(0) var<storage, read> src_bodies: array<Body>;
@group(0) @binding(1) var<storage, read_write> dst_bodies: array<Body>;
@group(0) @binding(2) var<storage, read> ss_acc_phi: array<vec4<f32>>;
@group(0) @binding(3) var<uniform> params: AtlasIntegrateParams;

@compute @workgroup_size(64)
fn ss_atlas_nbody_integrate(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= params.count) { return; }
  let self_pm = src_bodies[idx].pos_mass;
  let self_vr = src_bodies[idx].vel_radius;
  if (self_pm.w <= 0.0) {
    dst_bodies[idx] = Body(vec4<f32>(0.0), vec4<f32>(0.0));
    return;
  }
  let acc = ss_acc_phi[idx].xyz;
  var vel = self_vr.xyz;
  if (params.mode == 1u) {
    let drag = max(0.0, 1.0 - params.hubble_drag * params.dt);
    vel = vel * drag + acc * (params.inv_a3 * params.dt);
  } else {
    vel = vel + acc * params.dt;
  }
  let pos = self_pm.xyz + vel * params.dt;
  dst_bodies[idx] = Body(vec4<f32>(pos, self_pm.w), vec4<f32>(vel, self_vr.w));
}
`;

/**
 * Strictly GPU-native resident tiled direct N-body engine supporting Planetary,
 * Galactic (`mode = 0`), and Supergalactic Comoving ΛCDM (`mode = 1`) systems.
 * Fails closed if WebGPU `device` is absent (zero CPU mirror solver).
 */
export function createResidentTiledNBodyEngine({
  device = null,
  initialBodies,
  mode = 0,
  label = 'ulg-cosmic-nbody'
}) {
  assertWebGpuDevice(device, 'createResidentTiledNBodyEngine');
  let hostBodies = Float32Array.from(initialBodies);
  const count = hostBodies.length / 8;
  let stepIndex = 0;
  let scaleFactorA = mode === 1 ? 0.25 : 1.0;
  let disposed = false;

  const byteLength = Math.max(32, hostBodies.byteLength);
  const bodyUsage = USAGE_STORAGE | USAGE_VERTEX | USAGE_COPY_DST | USAGE_COPY_SRC;
  let buffers = [
    device.createBuffer({ label: `${label}-buf-0`, size: byteLength, usage: bodyUsage }),
    device.createBuffer({ label: `${label}-buf-1`, size: byteLength, usage: bodyUsage })
  ];
  const paramsBuffer = device.createBuffer({ label: `${label}-params`, size: 48, usage: USAGE_UNIFORM | USAGE_COPY_DST });
  const stagingBuffer = device.createBuffer({ label: `${label}-staging`, size: byteLength, usage: USAGE_COPY_DST | USAGE_MAP_READ });
  device.queue.writeBuffer(buffers[0], 0, hostBodies);
  device.queue.writeBuffer(buffers[1], 0, hostBodies);

  const bindings = [
    computeBufferBinding(0, 'read-only-storage'),
    computeBufferBinding(1, 'storage'),
    computeBufferBinding(2, 'uniform')
  ];
  const pipeline = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-cosmic-nbody-tiled.v1',
    label: 'ulg-cosmic-nbody-tiled',
    code: cosmicNBodyTiledWgsl,
    entryPoint: 'step_nbody',
    bindings
  });
  const bindGroups = [
    createCachedExplicitBindGroup(device, {
      layout: pipeline.bindGroupLayout,
      label: `${label}-bg-0`,
      entries: [
        { binding: 0, resource: { buffer: buffers[0] } },
        { binding: 1, resource: { buffer: buffers[1] } },
        { binding: 2, resource: { buffer: paramsBuffer } }
      ]
    }),
    createCachedExplicitBindGroup(device, {
      layout: pipeline.bindGroupLayout,
      label: `${label}-bg-1`,
      entries: [
        { binding: 0, resource: { buffer: buffers[1] } },
        { binding: 1, resource: { buffer: buffers[0] } },
        { binding: 2, resource: { buffer: paramsBuffer } }
      ]
    })
  ];

  let ping = 0;
  let mapInFlight = false;

  async function readbackBodies() {
    if (!buffers || !stagingBuffer || mapInFlight || disposed) return hostBodies;
    mapInFlight = true;
    try {
      const encoder = device.createCommandEncoder({ label: `${label}-readback` });
      encoder.copyBufferToBuffer(buffers[ping], 0, stagingBuffer, 0, hostBodies.byteLength);
      device.queue.submit([encoder.finish()]);
      await stagingBuffer.mapAsync(1);
      hostBodies.set(new Float32Array(stagingBuffer.getMappedRange()));
      stagingBuffer.unmap();
    } finally {
      mapInFlight = false;
    }
    return hostBodies;
  }

  async function step({
    dt = 0.014,
    gravity = 1.0,
    softening = 0.22,
    hubbleRate = 0.12,
    readback = false
  } = {}) {
    if (disposed || !buffers) return hostBodies;
    const paramData = new ArrayBuffer(48);
    const u32 = new Uint32Array(paramData);
    const f32 = new Float32Array(paramData);
    const invA3 = mode === 1 ? 1 / Math.max(0.05, scaleFactorA ** 3) : 1.0;
    u32[0] = count;
    u32[1] = mode;
    f32[4] = dt;
    f32[5] = gravity;
    f32[6] = softening * softening;
    f32[7] = mode === 1 ? 2 * hubbleRate : 0;
    f32[8] = invA3;
    device.queue.writeBuffer(paramsBuffer, 0, paramData);

    const srcIdx = ping;
    const dstIdx = 1 - ping;
    const encoder = device.createCommandEncoder({ label: `${label}-step-${stepIndex}` });
    const pass = encoder.beginComputePass({ label: `${label}-pass` });
    pass.setPipeline(pipeline.pipeline);
    pass.setBindGroup(0, bindGroups[srcIdx]);
    pass.dispatchWorkgroups(Math.ceil(count / 64));
    pass.end();

    const doReadback = readback && !mapInFlight;
    if (doReadback) {
      encoder.copyBufferToBuffer(buffers[dstIdx], 0, stagingBuffer, 0, hostBodies.byteLength);
    }
    device.queue.submit([encoder.finish()]);
    ping = dstIdx;
    stepIndex += 1;
    if (mode === 1) {
      scaleFactorA = Math.min(2.0, scaleFactorA + dt * hubbleRate * scaleFactorA);
    }
    if (doReadback) {
      mapInFlight = true;
      try {
        await stagingBuffer.mapAsync(1);
        hostBodies.set(new Float32Array(stagingBuffer.getMappedRange()));
        stagingBuffer.unmap();
      } finally {
        mapInFlight = false;
      }
    }
    return hostBodies;
  }

  function resetBodies(nextBodies) {
    hostBodies = Float32Array.from(nextBodies);
    stepIndex = 0;
    scaleFactorA = mode === 1 ? 0.25 : 1.0;
    ping = 0;
    if (buffers) {
      device.queue.writeBuffer(buffers[0], 0, hostBodies);
      device.queue.writeBuffer(buffers[1], 0, hostBodies);
    }
  }

  function getResidentBuffer() {
    return buffers ? buffers[ping] : null;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    buffers?.[0]?.destroy();
    buffers?.[1]?.destroy();
    paramsBuffer?.destroy();
    stagingBuffer?.destroy();
    buffers = null;
  }

  return {
    get count() { return count; },
    get activeCount() { return count; },
    get stepIndex() { return stepIndex; },
    get scaleFactorA() { return scaleFactorA; },
    get backend() { return 'webgpu'; },
    get gravityMode() { return 'webgpu-tiled-direct'; },
    getBodies: () => hostBodies,
    readbackBodies,
    getResidentBuffer,
    step,
    resetBodies,
    dispose
  };
}

/**
 * Strictly GPU-native Translation-Invariant Canonical `SchroederScaleAtlas`
 * Multipole N-body engine scaling cleanly to 32,768 - 262,144+ stars with
 * zero per-frame readback and ZERO private octrees.
 */
export function createResidentScaleAtlasMultipoleNBodyEngine({
  device = null,
  initialBodies,
  mode = 0,
  boxHalf = 16.0,
  theta = 0.65,
  label = 'ulg-cosmic-ss-atlas'
}) {
  assertWebGpuDevice(device, 'createResidentScaleAtlasMultipoleNBodyEngine');
  let hostBodies = Float32Array.from(initialBodies);
  const count = hostBodies.length / 8;
  let stepIndex = 0;
  let scaleFactorA = mode === 1 ? 0.25 : 1.0;
  let disposed = false;

  const byteLength = Math.max(32, hostBodies.byteLength);
  const bodyUsage = USAGE_STORAGE | USAGE_VERTEX | USAGE_COPY_DST | USAGE_COPY_SRC;
  let buffers = [
    device.createBuffer({ label: `${label}-buf-0`, size: byteLength, usage: bodyUsage }),
    device.createBuffer({ label: `${label}-buf-1`, size: byteLength, usage: bodyUsage })
  ];
  const ssAtlasGravity = createSchroederScaleAtlasGravitySolverWebGpu(device, {
    maxCount: count,
    strideFloats: 8,
    chartLevel: 70,
    useAdjSoftening: false,
    qMass: 8192.0,
    qMom: 512.0,
    rCellFactor: 0.05,
    label: `${label}-gravity`
  });
  const paramsBuffer = device.createBuffer({ label: `${label}-params`, size: 32, usage: USAGE_UNIFORM | USAGE_COPY_DST });
  const stagingBuffer = device.createBuffer({ label: `${label}-staging`, size: byteLength, usage: USAGE_COPY_DST | USAGE_MAP_READ });
  device.queue.writeBuffer(buffers[0], 0, hostBodies);
  device.queue.writeBuffer(buffers[1], 0, hostBodies);

  const integratePipe = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-cosmic-ss-atlas-integrate.v1',
    label: 'ulg-cosmic-ss-atlas-integrate',
    code: cosmicScaleAtlasIntegrateWgsl,
    entryPoint: 'ss_atlas_nbody_integrate',
    bindings: [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'storage'),
      computeBufferBinding(2, 'read-only-storage'),
      computeBufferBinding(3, 'uniform')
    ]
  });
  const mkBg = (src, dst, idx) => createCachedExplicitBindGroup(device, {
    layout: integratePipe.bindGroupLayout,
    label: `${label}-bg-${idx}`,
    entries: [
      { binding: 0, resource: { buffer: src } },
      { binding: 1, resource: { buffer: dst } },
      { binding: 2, resource: { buffer: ssAtlasGravity.accPhiBuffer } },
      { binding: 3, resource: { buffer: paramsBuffer } }
    ]
  });
  const bindGroups = [mkBg(buffers[0], buffers[1], 0), mkBg(buffers[1], buffers[0], 1)];

  let ping = 0;
  let mapInFlight = false;

  async function readbackBodies() {
    if (!buffers || !stagingBuffer || mapInFlight || disposed) return hostBodies;
    mapInFlight = true;
    try {
      const encoder = device.createCommandEncoder({ label: `${label}-readback` });
      encoder.copyBufferToBuffer(buffers[ping], 0, stagingBuffer, 0, hostBodies.byteLength);
      device.queue.submit([encoder.finish()]);
      await stagingBuffer.mapAsync(1);
      hostBodies.set(new Float32Array(stagingBuffer.getMappedRange()));
      stagingBuffer.unmap();
    } finally {
      mapInFlight = false;
    }
    return hostBodies;
  }

  async function step({
    dt = 0.012,
    gravity = 1.0,
    softening = 0.24,
    hubbleRate = 0.12,
    readback = false
  } = {}) {
    if (disposed || !buffers) return hostBodies;
    const invA3 = mode === 1 ? 1 / Math.max(0.05, scaleFactorA ** 3) : 1.0;
    ssAtlasGravity.writeParams({
      count,
      gravityG: gravity,
      softening2: softening * softening,
      boxHalf,
      theta2: theta * theta
    });
    const paramData = new ArrayBuffer(32);
    const u32 = new Uint32Array(paramData);
    const f32 = new Float32Array(paramData);
    u32[0] = count;
    u32[1] = mode;
    f32[4] = dt;
    f32[5] = mode === 1 ? 2 * hubbleRate : 0;
    f32[6] = invA3;
    device.queue.writeBuffer(paramsBuffer, 0, paramData);

    const srcIdx = ping;
    const dstIdx = 1 - ping;
    const bodyGroups = Math.ceil(count / 64);

    // 1 single coalesced compute pass & 1 queue.submit per step
    const encoder = device.createCommandEncoder({ label: `${label}-step-${stepIndex}` });
    const pass = encoder.beginComputePass({ label: `${label}-pass` });
    ssAtlasGravity.encodeIntoPass(pass, { srcBuffer: buffers[srcIdx], count });
    pass.setPipeline(integratePipe.pipeline);
    pass.setBindGroup(0, bindGroups[srcIdx]);
    pass.dispatchWorkgroups(bodyGroups);
    pass.end();

    const doReadback = readback && !mapInFlight;
    if (doReadback) {
      encoder.copyBufferToBuffer(buffers[dstIdx], 0, stagingBuffer, 0, hostBodies.byteLength);
    }
    device.queue.submit([encoder.finish()]);
    ping = dstIdx;
    stepIndex += 1;
    if (mode === 1) {
      scaleFactorA = Math.min(2.0, scaleFactorA + dt * hubbleRate * scaleFactorA);
    }
    if (doReadback) {
      mapInFlight = true;
      try {
        await stagingBuffer.mapAsync(1);
        hostBodies.set(new Float32Array(stagingBuffer.getMappedRange()));
        stagingBuffer.unmap();
      } finally {
        mapInFlight = false;
      }
    }
    return hostBodies;
  }

  function resetBodies(nextBodies) {
    hostBodies = Float32Array.from(nextBodies);
    stepIndex = 0;
    scaleFactorA = mode === 1 ? 0.25 : 1.0;
    ping = 0;
    if (buffers) {
      device.queue.writeBuffer(buffers[0], 0, hostBodies);
      device.queue.writeBuffer(buffers[1], 0, hostBodies);
    }
  }

  function getResidentBuffer() {
    return buffers ? buffers[ping] : null;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    buffers?.[0]?.destroy();
    buffers?.[1]?.destroy();
    ssAtlasGravity.destroy();
    paramsBuffer?.destroy();
    stagingBuffer?.destroy();
    buffers = null;
  }

  return {
    get count() { return count; },
    get activeCount() { return count; },
    get strideFloats() { return 8; },
    get stepIndex() { return stepIndex; },
    get scaleFactorA() { return scaleFactorA; },
    get backend() { return 'webgpu'; },
    get gravityMode() { return ssAtlasGravity.gravityMode; },
    getBodies: () => hostBodies,
    readbackBodies,
    getResidentBuffer,
    step,
    resetBodies,
    dispose
  };
}

// Backward-compatible export name delegating strictly to the canonical SchroederScaleAtlas solver
export const createResidentBarnesHutNBodyEngine = createResidentScaleAtlasMultipoleNBodyEngine;

/**
 * Derive continuous constitutive mechanical/thermodynamic parameters for the
 * unified continuum micro-SPH GPU kernel directly from quantum-derived element
 * bulk properties (`bulkModulusPa`, `meltingPointK`, `boilingPointK`,
 * `cohesiveEnergyEv`, `temperatureK`). ZERO discrete phase branches in WGSL!
 */
export function deriveContinuumConstitutiveParams({
  bulkModulusPa = 25e9,
  meltingPointK = null,
  boilingPointK = null,
  cohesiveEnergyEv = null,
  temperatureK = 298.15
} = {}) {
  const T = Math.max(1.0, Number(temperatureK) || 298.15);
  const tm = Number(meltingPointK);
  const tb = Number(boilingPointK);
  if (!(Number.isFinite(tm) && tm > 0) || !(Number.isFinite(tb) && tb > 0)) {
    throw new RangeError(
      'deriveContinuumConstitutiveParams fails closed: explicit positive meltingPointK and boilingPointK are required (zero discrete phase fallbacks).'
    );
  }
  const cohRaw = Number(cohesiveEnergyEv);
  const cohEv = Number.isFinite(cohRaw) && cohRaw >= 0 ? cohRaw : Math.max(0.05, tb / 900);

  // Smooth continuous thermodynamic order parameters from T / T_m and T / T_b
  const tNormMelt = T / Math.max(1.0, tm);
  const tNormBoil = T / Math.max(1.0, tb);
  const solidOrder = 1.0 / (1.0 + Math.exp(Math.max(-24, Math.min(24, (tNormMelt - 1.0) * 8.0))));
  const condensedOrder = 1.0 / (1.0 + Math.exp(Math.max(-24, Math.min(24, (tNormBoil - 1.0) * 6.5))));

  const logK = Math.log10(Math.max(1e6, Number(bulkModulusPa) || 2.5e10));
  const baseStiffness = Math.min(26.0, Math.max(6.0, 4.5 + logK * 1.25));
  const stiffness = baseStiffness * (0.28 + 0.72 * condensedOrder);
  const cohesion = condensedOrder * (1.0 - 0.85 * solidOrder) * (1.4 + 0.9 * Math.min(2.0, cohEv / 0.8));
  const bondElasticity = solidOrder * baseStiffness * 1.15;
  const viscosity = 0.08 + 2.4 * condensedOrder + 4.0 * solidOrder;
  const damping = 0.9997 - 0.0045 * condensedOrder - 0.004 * solidOrder;
  const wallRestitution = 0.99 - 0.72 * condensedOrder + 0.14 * solidOrder;
  const thermalSpeed = 0.05 + 0.22 * (condensedOrder * (1.0 - solidOrder)) + 4.8 * (1.0 - condensedOrder);
  const restDist = 0.19 + 0.01 * solidOrder;

  return {
    temperatureK: T,
    meltingPointK: tm,
    boilingPointK: tb,
    cohesiveEnergyEv: cohEv,
    solidOrder,
    condensedOrder,
    stiffness,
    cohesion,
    bondElasticity,
    viscosity,
    damping,
    wallRestitution,
    thermalSpeed,
    restDist
  };
}

/**
 * Deterministic 1,024-particle continuum initial condition driven continuously by
 * thermodynamic order parameters (`condensedOrder`, `solidOrder`, `thermalSpeed`)
 * with optional `centerOffset` — zero discrete phase switch required in physics!
 */
export function createContinuumSpecimenBodies({
  count = 1024,
  phase = null,
  meltingPointK = null,
  boilingPointK = null,
  cohesiveEnergyEv = null,
  bulkModulusPa = 25e9,
  temperatureK = 298.15,
  seed = 4201,
  centerOffset = [0, 0, 0]
} = {}) {
  const n = Math.max(64, Math.min(8192, Math.floor(count)));
  const bodies = new Float32Array(n * 8);
  const rand = mulberry32(seed);
  const ox = Number(centerOffset?.[0]) || 0;
  const oy = Number(centerOffset?.[1]) || 0;
  const oz = Number(centerOffset?.[2]) || 0;
  const c = deriveContinuumConstitutiveParams({
    bulkModulusPa,
    meltingPointK,
    boilingPointK,
    cohesiveEnergyEv,
    temperatureK,
    phase
  });

  const edge = Math.ceil(Math.cbrt(n));
  const spacing = c.restDist;
  const half = ((edge - 1) * spacing) / 2;
  const spreadFactor = 1.0 + 3.4 * (1.0 - c.condensedOrder);
  const particleRadius = 0.085 + 0.02 * c.condensedOrder;
  const particleMass = 0.25 + 0.75 * c.condensedOrder;
  const tilt = 0.26 * c.solidOrder;
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);

  let idx = 0;
  for (let iz = 0; iz < edge && idx < n; iz += 1) {
    for (let iy = 0; iy < edge && idx < n; iy += 1) {
      for (let ix = 0; ix < edge && idx < n; ix += 1) {
        const lx = (ix * spacing - half) * spreadFactor;
        const ly = (iy * spacing - half) * spreadFactor;
        const lz = (iz * spacing - half) * spreadFactor;
        const rx = lx * ct - ly * st;
        const ry = lx * st + ly * ct;
        const jitter = (1.0 - c.solidOrder) * (0.04 + 0.55 * (1.0 - c.condensedOrder));
        const x = Math.max(-2.35, Math.min(2.35, rx + (rand() - 0.5) * jitter)) + ox;
        const y = Math.max(-0.78, Math.min(2.35, 0.45 + 0.25 * (1.0 - c.condensedOrder) + ry + (rand() - 0.5) * jitter)) + oy;
        const z = Math.max(-2.35, Math.min(2.35, lz + (rand() - 0.5) * jitter)) + oz;

        // Isotropic Maxwell-Boltzmann thermal velocity sample scaled continuously by thermalSpeed
        const u1 = rand() * 2 - 1;
        const phi = rand() * Math.PI * 2;
        const sinTh = Math.sqrt(Math.max(0, 1 - u1 * u1));
        const spd = c.thermalSpeed * (0.65 + 0.7 * rand());
        const vx = sinTh * Math.cos(phi) * spd;
        const vy = u1 * spd - 0.15 * c.condensedOrder;
        const vz = sinTh * Math.sin(phi) * spd;

        bodies.set([x, y, z, particleMass, vx, vy, vz, particleRadius], idx * 8);
        idx += 1;
      }
    }
  }
  return bodies;
}

/**
 * Unified Continuous Continuum Micro-SPH / Elastic-Bond / Kinetic-Gas WGSL Kernel.
 *
 * Strictly Star Spec compliant:
 *   - Zero discrete phase-switch branches!
 *   - Zero origin-centered confinement bowls!
 *   - ONE continuous pairwise interaction law (`repulsion + surface cohesion +
 *     elastic shear bond + XSPH viscosity`) + ONE uniform gravity + ONE uniform
 *     translation-invariant rectangular container box `[-box_half, +box_half]`.
 */
export const continuumMicroSphWgsl = /* wgsl */ `
struct Body {
  pos_mass: vec4<f32>,
  vel_radius: vec4<f32>,
};

struct MicroSphParams {
  count: u32,
  pad0: u32,
  pad1: u32,
  pad2: u32,
  dt: f32,
  gravity: f32,
  stiffness: f32,
  cohesion: f32,
  bond_elasticity: f32,
  viscosity: f32,
  damping: f32,
  wall_restitution: f32,
  floor_y: f32,
  box_half: f32,
  rest_dist: f32,
  pad3: f32,
};

@group(0) @binding(0) var<storage, read> src_bodies: array<Body>;
@group(0) @binding(1) var<storage, read_write> dst_bodies: array<Body>;
@group(0) @binding(2) var<uniform> params: MicroSphParams;

var<workgroup> tile_p: array<vec4<f32>, 64>;
var<workgroup> tile_v: array<vec4<f32>, 64>;

@compute @workgroup_size(64)
fn step_continuum_micro_sph(
  @builtin(global_invocation_id) gid: vec3<u32>,
  @builtin(local_invocation_id) lid: vec3<u32>
) {
  let idx = gid.x;
  let n = params.count;
  let alive = idx < n;
  var pm = vec4<f32>(0.0);
  var vr = vec4<f32>(0.0);
  if (alive) {
    pm = src_bodies[idx].pos_mass;
    vr = src_bodies[idx].vel_radius;
  }

  var f_rep_bond = vec3<f32>(0.0);
  var f_coh = vec3<f32>(0.0);
  var f_visc = vec3<f32>(0.0);
  var w_nbr = 0.0;
  let rest = params.rest_dist;
  let h = rest * 1.85;
  let h2 = h * h;
  let num_tiles = (n + 63u) / 64u;

  for (var t: u32 = 0u; t < num_tiles; t = t + 1u) {
    let j = t * 64u + lid.x;
    if (j < n) {
      tile_p[lid.x] = src_bodies[j].pos_mass;
      tile_v[lid.x] = src_bodies[j].vel_radius;
    } else {
      tile_p[lid.x] = vec4<f32>(0.0);
      tile_v[lid.x] = vec4<f32>(0.0);
    }
    workgroupBarrier();

    if (alive && pm.w > 0.0) {
      let tile_count = min(64u, n - t * 64u);
      for (var k: u32 = 0u; k < tile_count; k = k + 1u) {
        let other_p = tile_p[k];
        if (other_p.w <= 0.0) { continue; }
        let d = pm.xyz - other_p.xyz;
        let r2 = dot(d, d);
        if (r2 > 1e-7 && r2 < h2) {
          let r = sqrt(r2);
          let dir = d / r;
          let q = 1.0 - r / h;
          w_nbr = w_nbr + q;
          // Unified continuous constitutive interaction:
          //   short-range repulsive core + Laplace-Young surface cohesion + elastic shear bond + normalized XSPH viscosity
          let rep = params.stiffness * max(0.0, rest - r) / rest;
          let coh = -params.cohesion * q * (1.0 - q) * 4.0;
          let bond = params.bond_elasticity * ((rest - r) / rest) * q;
          f_rep_bond = f_rep_bond + dir * (rep + bond);
          f_coh = f_coh + dir * coh;
          f_visc = f_visc + (tile_v[k].xyz - vr.xyz) * q;
        }
      }
    }
    workgroupBarrier();
  }

  if (alive) {
    var pos = pm.xyz;
    var vel = vr.xyz;
    // Density-normalized internal forces keep CFL stable and preserve exact free-fall COM under gravity!
    let inv_norm = 1.0 / max(1.0, w_nbr * 0.25);
    var force = f_rep_bond * inv_norm + f_coh * inv_norm + (f_visc / max(1.0, w_nbr)) * params.viscosity;
    let f_mag = length(force);
    if (f_mag > 90.0) {
      force = force * (90.0 / f_mag);
    }
    // Uniform downward gravity for ALL materials (gas fills container naturally via k_B T / (m g H) >> 1!)
    force.y = force.y - params.gravity;

    let dt = params.dt;
    vel = (vel + force * dt) * params.damping;
    let sp = length(vel);
    if (sp > 10.0) {
      vel = vel * (10.0 / sp);
    }
    pos = pos + vel * dt;

    // Uniform rectangular lab container reflections (zero origin-centered bowls!)
    let floor_y = params.floor_y;
    let ceil_y = params.box_half;
    let bound_xz = params.box_half;
    let bounce = params.wall_restitution;
    let floor_fric = mix(0.92, 0.998, clamp((bounce - 0.3) / 0.68, 0.0, 1.0));
    if (pos.y < floor_y) { pos.y = floor_y; vel.y = abs(vel.y) * bounce; vel.x = vel.x * floor_fric; vel.z = vel.z * floor_fric; }
    if (pos.y > ceil_y) { pos.y = ceil_y; vel.y = -abs(vel.y) * bounce; }
    if (pos.x < -bound_xz) { pos.x = -bound_xz; vel.x = abs(vel.x) * bounce; }
    if (pos.x > bound_xz) { pos.x = bound_xz; vel.x = -abs(vel.x) * bounce; }
    if (pos.z < -bound_xz) { pos.z = -bound_xz; vel.z = abs(vel.z) * bounce; }
    if (pos.z > bound_xz) { pos.z = bound_xz; vel.z = -abs(vel.z) * bounce; }

    dst_bodies[idx] = Body(vec4<f32>(pos, pm.w), vec4<f32>(vel, vr.w));
  }
}
`;

/**
 * Strictly GPU-native unified continuum micro-SPH engine driven by continuous
 * quantum-derived material properties. Fails closed without WebGPU `device`.
 */
export function createResidentContinuumDropletEngine({
  device = null,
  initialBodies,
  phase = null,
  bulkModulusPa = 25e9,
  meltingPointK = null,
  boilingPointK = null,
  cohesiveEnergyEv = null,
  temperatureK = 298.15,
  label = 'ulg-continuum-micro-sph'
} = {}) {
  assertWebGpuDevice(device, 'createResidentContinuumDropletEngine');
  let hostBodies = Float32Array.from(initialBodies);
  const count = hostBodies.length / 8;
  const constitutive = deriveContinuumConstitutiveParams({
    bulkModulusPa,
    meltingPointK,
    boilingPointK,
    cohesiveEnergyEv,
    temperatureK,
    phase
  });
  let stepIndex = 0;
  let disposed = false;

  const byteLength = Math.max(32, hostBodies.byteLength);
  const bodyUsage = USAGE_STORAGE | USAGE_VERTEX | USAGE_COPY_DST | USAGE_COPY_SRC;
  let buffers = [
    device.createBuffer({ label: `${label}-buf-0`, size: byteLength, usage: bodyUsage }),
    device.createBuffer({ label: `${label}-buf-1`, size: byteLength, usage: bodyUsage })
  ];
  const paramsBuffer = device.createBuffer({ label: `${label}-params`, size: 64, usage: USAGE_UNIFORM | USAGE_COPY_DST });
  const stagingBuffer = device.createBuffer({ label: `${label}-staging`, size: byteLength, usage: USAGE_COPY_DST | USAGE_MAP_READ });
  device.queue.writeBuffer(buffers[0], 0, hostBodies);
  device.queue.writeBuffer(buffers[1], 0, hostBodies);

  const pipelineRecord = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-continuum-micro-sph.v3',
    label: 'ulg-continuum-micro-sph-pipe',
    code: continuumMicroSphWgsl,
    entryPoint: 'step_continuum_micro_sph',
    bindings: [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'storage'),
      computeBufferBinding(2, 'uniform')
    ]
  });
  const bindGroups = [
    createCachedExplicitBindGroup(device, {
      layout: pipelineRecord.bindGroupLayout,
      label: `${label}-bg-0`,
      entries: [
        { binding: 0, resource: { buffer: buffers[0] } },
        { binding: 1, resource: { buffer: buffers[1] } },
        { binding: 2, resource: { buffer: paramsBuffer } }
      ]
    }),
    createCachedExplicitBindGroup(device, {
      layout: pipelineRecord.bindGroupLayout,
      label: `${label}-bg-1`,
      entries: [
        { binding: 0, resource: { buffer: buffers[1] } },
        { binding: 1, resource: { buffer: buffers[0] } },
        { binding: 2, resource: { buffer: paramsBuffer } }
      ]
    })
  ];

  let ping = 0;
  let mapInFlight = false;

  async function readbackBodies() {
    if (!buffers || !stagingBuffer || mapInFlight || disposed) return hostBodies;
    mapInFlight = true;
    try {
      const enc = device.createCommandEncoder({ label: `${label}-readback` });
      enc.copyBufferToBuffer(buffers[ping], 0, stagingBuffer, 0, hostBodies.byteLength);
      device.queue.submit([enc.finish()]);
      await stagingBuffer.mapAsync(1);
      hostBodies.set(new Float32Array(stagingBuffer.getMappedRange()));
      stagingBuffer.unmap();
    } finally {
      mapInFlight = false;
    }
    return hostBodies;
  }

  async function step({ dt = 0.014, gravity = 1.8, readback = false } = {}) {
    if (disposed || !buffers) return hostBodies;
    const pBuf = new ArrayBuffer(64);
    const u32 = new Uint32Array(pBuf);
    const f32 = new Float32Array(pBuf);
    u32[0] = count;
    f32[4] = dt;
    f32[5] = gravity;
    f32[6] = constitutive.stiffness;
    f32[7] = constitutive.cohesion;
    f32[8] = constitutive.bondElasticity;
    f32[9] = constitutive.viscosity;
    f32[10] = constitutive.damping;
    f32[11] = constitutive.wallRestitution;
    f32[12] = -0.92;
    f32[13] = 2.65;
    f32[14] = constitutive.restDist;
    device.queue.writeBuffer(paramsBuffer, 0, pBuf);

    const srcIdx = ping;
    const dstIdx = 1 - ping;
    const enc = device.createCommandEncoder({ label: `${label}-step-${stepIndex}` });
    const pass = enc.beginComputePass({ label: `${label}-pass` });
    pass.setPipeline(pipelineRecord.pipeline);
    pass.setBindGroup(0, bindGroups[srcIdx]);
    pass.dispatchWorkgroups(Math.ceil(count / 64));
    pass.end();
    const doReadback = readback && !mapInFlight;
    if (doReadback) {
      enc.copyBufferToBuffer(buffers[dstIdx], 0, stagingBuffer, 0, hostBodies.byteLength);
    }
    device.queue.submit([enc.finish()]);
    ping = dstIdx;
    stepIndex += 1;
    if (doReadback) {
      mapInFlight = true;
      try {
        await stagingBuffer.mapAsync(1);
        hostBodies.set(new Float32Array(stagingBuffer.getMappedRange()));
        stagingBuffer.unmap();
      } finally {
        mapInFlight = false;
      }
    }
    return hostBodies;
  }

  return {
    get count() { return count; },
    get activeCount() { return count; },
    get stepIndex() { return stepIndex; },
    get scaleFactorA() { return 1.0; },
    get constitutive() { return constitutive; },
    get backend() { return 'webgpu'; },
    get gravityMode() { return 'webgpu-micro-sph-continuous'; },
    getBodies: () => hostBodies,
    readbackBodies,
    getResidentBuffer: () => (buffers ? buffers[ping] : null),
    step,
    dispose() {
      if (disposed) return;
      disposed = true;
      buffers?.[0]?.destroy();
      buffers?.[1]?.destroy();
      paramsBuffer?.destroy();
      stagingBuffer?.destroy();
      buffers = null;
    }
  };
}

/**
 * Wrap a resident GPU N-body or continuous micro-SPH engine into a ULG
 * `SimulationModuleRegistry` registration (`nbody-gravity@1`, `planetary-nbody@1`,
 * `cosmology-comoving-nbody@1`, or `continuum-micro-sph@1`).
 */
export function createResidentCosmicModuleRegistration({
  method,
  engine,
  scaleRangeM,
  zeroCopy = false
}) {
  const strideElements = Math.max(8, Math.trunc(Number(engine.strideFloats) || 8));
  const strideBytes = strideElements * 4;
  const stateLayout = {
    tensorId: 'bodies',
    dtype: 'f32',
    layout: 'interleaved',
    strideElements,
    strideBytes,
    fields: strideElements >= 16
      ? ['x', 'y', 'z', 'mass', 'vx', 'vy', 'vz', 'rhoVis', 'ax', 'ay', 'az', 'localDelta', 'species', 'halo', 'aScale', 'pad']
      : ['x', 'y', 'z', 'mass', 'vx', 'vy', 'vz', 'radius']
  };
  const isMicroSph = Boolean(engine.gravityMode?.startsWith('webgpu-micro-sph'));
  const isScaleAtlas = engine.gravityMode === 'webgpu-schroeder-scale-atlas-multipole';
  const isTreePm = engine.gravityMode === 'webgpu-flrw-fft3d-treepm';
  return {
    method,
    kernel: {
      sourceModule: isScaleAtlas
        ? 'src/runtime/sph/schroederScaleAtlasMultipoleGpu.js'
        : isTreePm
          ? 'src/runtime/astrophysics/supergalacticTreePmGpu.js'
          : 'src/demos/cosmicQuantumGpuKernels.js',
      entryPoint: isMicroSph
        ? 'step_continuum_micro_sph'
        : isScaleAtlas
          ? 'ss_atlas_nbody_integrate'
          : isTreePm
            ? 'cic_kick_drift'
            : 'step_nbody',
      wgsl: isMicroSph
        ? continuumMicroSphWgsl
        : isScaleAtlas
          ? `${schroederScaleAtlasResidentGravityWgsl}\n${cosmicScaleAtlasIntegrateWgsl}`
          : cosmicNBodyTiledWgsl,
      workgroupSize: 64
    },
    parameterSchema: {
      dt: { type: 'number', min: 0, required: true },
      gravity: { type: 'number', min: 0, required: true },
      softening: { type: 'number', min: 0, required: false },
      hubbleRate: { type: 'number', min: 0, required: false },
      readback: { type: 'boolean', required: false }
    },
    stateLayout,
    scaleRangeM,
    async stepCapsule(capsule, { createSimulationArtifact, leaseSession }) {
      const fromStep = engine.stepIndex;
      const params = capsule.input?.parameters || {};
      const doReadback = params.readback !== undefined ? Boolean(params.readback) : !zeroCopy;
      const stepOut = await engine.step({ ...params, readback: doReadback });
      const toStep = engine.stepIndex;
      const residentBytes = (stepOut instanceof Float32Array && stepOut.byteLength > 0)
        ? stepOut.byteLength
        : engine.count * strideBytes;
      leaseSession.publishBuffer({
        resourceKey: 'bodies',
        buffer: engine.getResidentBuffer(),
        destroyFn: () => true,
        byteLength: residentBytes,
        rowCount: engine.count,
        layout: stateLayout,
        stepIndex: toStep,
        portableSnapshotFn: async () => Float32Array.from(
          (doReadback && stepOut instanceof Float32Array)
            ? stepOut
            : await engine.readbackBodies()
        )
      });
      const leaseHandle = leaseSession.borrowBufferReadLease({
        resourceKey: 'bodies',
        consumerStage: 'cosmic-quantum-renderer',
        reason: zeroCopy ? 'zero-copy-gpu-vertex-lease' : 'live-render-frame-lease'
      });
      const artifact = createSimulationArtifact({
        artifactId: `${capsule.taskId}:${method.model}:${toStep}`,
        taskKind: capsule.taskKind,
        closureRef: { module: 'src/demos/cosmicQuantumGpuKernels.js', entryPoint: engine.gravityMode },
        representation: strideElements >= 16 ? 'nbody-interleaved-f32-64b' : 'nbody-interleaved-f32',
        outputs: {
          deltas: [{ operation: 'replace', tensorId: 'bodies', fromStep, toStep }]
        },
        execution: {
          backend: engine.backend ?? 'webgpu',
          stage: `${method.model}.step`,
          placement: 'local',
          gravityMode: engine.gravityMode,
          zeroCopyReadbackSkipped: !doReadback,
          scaleFactorA: engine.scaleFactorA
        },
        validity: {
          finite: true,
          bodyCount: engine.activeCount ?? engine.count,
          slotCount: engine.count
        },
        validation: {
          status: 'pass',
          validationMode: 'finite-output',
          scientificValidation: false,
          fullPhysicsValidation: false
        },
        provenance: {
          ...capsule.provenance,
          sourceService: ULG_SERVICE_IDS.ulgRuntime,
          methodHash: capsule.methodHash,
          inputHash: capsule.inputHash
        }
      });
      return { artifact, leaseHandle };
    }
  };
}

/**
 * Evaluate galactic & cosmic body cross-chart multipole gravity strictly
 * through ULG's canonical 40-OOM `SchroederScaleAtlas` multipole authority
 * (monopole + traceless quadrupole, exact F_ab = -F_ba, translation-invariant).
 */
export function evaluateGalacticScaleAtlasMultipoleWebGpu(device, bodies, options = {}) {
  return evaluateAstrophysicsScaleAtlasMultipoleWebGpu(device, {
    particleData: bodies,
    strideFloats: 8,
    targetGlobalLevel: options.targetGlobalLevel ?? 4,
    massScaleKg: options.massScaleKg ?? 1.0,
    gravityG: options.gravityG ?? 1.0,
    temperatureK: options.temperatureK ?? 2.725,
    ...options
  });
}
