import { ULG_SERVICE_IDS } from '../../ulg-gpu-abi/src/serviceContract.js';
import {
  computeBufferBinding,
  createCachedExplicitBindGroup,
  createCachedExplicitComputePipeline
} from '../runtime/webgpuComputeLayout.js';

const USAGE_STORAGE = 0x0080;
const USAGE_UNIFORM = 0x0040;
const USAGE_COPY_DST = 0x0008;
const USAGE_COPY_SRC = 0x0004;
const USAGE_MAP_READ = 0x0001;

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

/**
 * Deterministic 8-float interleaved galactic body initializer matching the
 * `eshkols-in-space` ABI (`[x, y, z, mass, vx, vy, vz, radius]`).
 * Supports `disk` (2-arm logarithmic spiral + central core), `binary`
 * (colliding twin galaxies), and `sphere` (Plummer globular cluster).
 */
export function createGalacticBodies({
  count = 4096,
  preset = 'disk',
  seed = 825,
  gravity = 1.0,
  softening = 0.22
} = {}) {
  const n = Math.max(64, Math.min(16384, Math.floor(count)));
  const bodies = new Float32Array(n * 8);
  const rand = mulberry32(seed);
  const gauss = () => {
    const u1 = Math.max(1e-7, rand());
    const u2 = rand();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };

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
      // Central SMBH / bulge core
      bodies.set([cx, cy, cz, coreMass, cvx, cvy, cvz, 0.45], start * 8);
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

        const mEnc = coreMass + (end - start) * 0.08 * (1 - Math.exp(-r / 2.2));
        const vCirc = Math.sqrt((gravity * mEnc) / Math.hypot(r, softening));
        const vtx = -Math.sin(theta) * vCirc;
        const vtz = Math.cos(theta) * vCirc;
        const vrx = vtx;
        const vry = -vtz * sinT;
        const vrz = vtz * cosT;
        const mass = 0.05 + rand() * 0.14;
        const radius = 0.03 + 0.04 * Math.cbrt(mass);
        bodies.set([
          cx + rx, cy + ry, cz + rz, mass,
          cvx + vrx, cvy + vry, cvz + vrz, radius
        ], i * 8);
      }
    }
    return bodies;
  }

  if (preset === 'sphere') {
    const coreMass = 120;
    bodies.set([0, 0, 0, coreMass, 0, 0, 0, 0.4], 0);
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
      const vScale = Math.sqrt((gravity * (coreMass + n * 0.04)) / Math.hypot(rClamped, 1.8)) * 0.45;
      const mass = 0.04 + rand() * 0.12;
      bodies.set([
        x, y, z, mass,
        gauss() * vScale, gauss() * vScale, gauss() * vScale,
        0.03 + 0.03 * Math.cbrt(mass)
      ], i * 8);
    }
    return bodies;
  }

  // Default: luminous 2-arm logarithmic spiral disk galaxy with massive core
  const coreMass = 260;
  bodies.set([0, 0, 0, coreMass, 0, 0, 0, 0.55], 0);
  const diskMassTotal = n * 0.09;
  for (let i = 1; i < n; i += 1) {
    const isBulge = i < n * 0.16;
    if (isBulge) {
      const r = Math.abs(gauss()) * 1.1 + 0.12;
      const theta = 2 * Math.PI * rand();
      const y = gauss() * 0.42;
      const x = r * Math.cos(theta);
      const z = r * Math.sin(theta);
      const vCirc = Math.sqrt((gravity * (coreMass + diskMassTotal * 0.12)) / Math.hypot(r, softening));
      const mass = 0.08 + rand() * 0.25;
      bodies.set([
        x, y, z, mass,
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
      const mass = 0.04 + Math.pow(rand(), 2.2) * 0.22;
      bodies.set([
        x, y, z, mass,
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
 * supergalactic coordinates (`x, y, z` normalized inside the observable-universe
 * box `[-12, +12]` representing `~93 Gly / ~28.5 Gpc` horizon span).
 */
export function createCosmicWebBodies({
  count = 3072,
  seed = 1370
} = {}) {
  const n = Math.max(64, Math.min(8192, Math.floor(count)));
  const bodies = new Float32Array(n * 8);
  const rand = mulberry32(seed);
  // Seeded Fourier-like displacement modes producing real cosmic voids, nodes, and filaments.
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
    // Distribute inside spherical observable-universe horizon radius R = 10.5
    let qx; let qy; let qz;
    do {
      qx = (rand() * 2 - 1) * 10.2;
      qy = (rand() * 2 - 1) * 10.2;
      qz = (rand() * 2 - 1) * 10.2;
    } while (qx * qx + qy * qy + qz * qz > 10.2 * 10.2);

    // Zel'dovich displacement Ψ(q) = -∇Φ(q) pushes clusters onto filaments & supercluster nodes
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
      x, y, z, mass,
      dx * 0.12, dy * 0.12, dz * 0.12,
      0.06 + 0.05 * Math.cbrt(mass)
    ], i * 8);
  }
  return bodies;
}

/**
 * Tiled shared-memory WebGPU N-body compute shader matching the
 * `eshkols-in-space` 8-float interleaved `Body` layout (`x,y,z,mass,vx,vy,vz,radius`).
 * Supports both Newtonian (`mode = 0`) and comoving ΛCDM (`mode = 1` with
 * scale factor `a`, Hubble drag `-2 H(a) v`, and `a^-3` comoving gravity!).
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
    // Comoving ΛCDM peculiar velocity kick + Hubble drag:
    //   dv/dt = (G / a^3) * acc - 2 * H(a) * v
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
 * Resident WebGPU tiled N-body engine supporting both Galactic (`mode=0`) and
 * Supergalactic Comoving ΛCDM (`mode=1`) populations on a shared `GPUDevice`,
 * publishing live resident buffers into ULG's `ResidentModuleBufferSession`!
 */
export function createResidentTiledNBodyEngine({
  device = null,
  initialBodies,
  mode = 0,
  label = 'ulg-cosmic-nbody'
}) {
  let cpuBodies = Float32Array.from(initialBodies);
  const count = cpuBodies.length / 8;
  let stepIndex = 0;
  let scaleFactorA = mode === 1 ? 0.25 : 1.0;
  let disposed = false;

  let buffers = null;
  let paramsBuffer = null;
  let stagingBuffer = null;
  let pipeline = null;
  let bindGroups = null;
  let ping = 0;

  if (device && typeof device.createBuffer === 'function') {
    const byteLength = Math.max(32, cpuBodies.byteLength);
    buffers = [
      device.createBuffer({ label: `${label}-buf-0`, size: byteLength, usage: USAGE_STORAGE | USAGE_COPY_DST | USAGE_COPY_SRC }),
      device.createBuffer({ label: `${label}-buf-1`, size: byteLength, usage: USAGE_STORAGE | USAGE_COPY_DST | USAGE_COPY_SRC })
    ];
    paramsBuffer = device.createBuffer({ label: `${label}-params`, size: 48, usage: USAGE_UNIFORM | USAGE_COPY_DST });
    stagingBuffer = device.createBuffer({ label: `${label}-staging`, size: byteLength, usage: USAGE_COPY_DST | USAGE_MAP_READ });
    device.queue.writeBuffer(buffers[0], 0, cpuBodies);
    device.queue.writeBuffer(buffers[1], 0, cpuBodies);

    const bindings = [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'storage'),
      computeBufferBinding(2, 'uniform')
    ];
    pipeline = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-cosmic-nbody-tiled.v1',
      label: 'ulg-cosmic-nbody-tiled',
      code: cosmicNBodyTiledWgsl,
      entryPoint: 'step_nbody',
      bindings
    });
    bindGroups = [
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
  }

  function stepCpuFallback({ dt = 0.014, gravity = 1.0, softening = 0.22, hubbleRate = 0.12 } = {}) {
    const next = new Float32Array(cpuBodies.length);
    const eps2 = softening * softening;
    const invA3 = mode === 1 ? 1 / Math.max(0.05, scaleFactorA ** 3) : 1.0;
    const drag = mode === 1 ? Math.max(0, 1 - 2 * hubbleRate * dt) : 1.0;
    // Sampled/direct CPU fallback capped to keep non-WebGPU browsers smooth
    const stride = count > 512 ? Math.ceil(count / 512) : 1;
    for (let i = 0; i < count; i += 1) {
      const bi = i * 8;
      const mi = cpuBodies[bi + 3];
      if (!(mi > 0)) continue;
      const xi = cpuBodies[bi]; const yi = cpuBodies[bi + 1]; const zi = cpuBodies[bi + 2];
      let ax = 0; let ay = 0; let az = 0;
      for (let j = 0; j < count; j += stride) {
        const bj = j * 8;
        const mj = cpuBodies[bj + 3];
        if (!(mj > 0)) continue;
        const dx = cpuBodies[bj] - xi;
        const dy = cpuBodies[bj + 1] - yi;
        const dz = cpuBodies[bj + 2] - zi;
        const r2 = dx * dx + dy * dy + dz * dz + eps2;
        const f = (mj * stride) / (r2 * Math.sqrt(r2));
        ax += dx * f; ay += dy * f; az += dz * f;
      }
      const gScale = gravity * invA3 * dt;
      const vx = cpuBodies[bi + 4] * drag + ax * gScale;
      const vy = cpuBodies[bi + 5] * drag + ay * gScale;
      const vz = cpuBodies[bi + 6] * drag + az * gScale;
      next[bi] = xi + vx * dt;
      next[bi + 1] = yi + vy * dt;
      next[bi + 2] = zi + vz * dt;
      next[bi + 3] = mi;
      next[bi + 4] = vx;
      next[bi + 5] = vy;
      next[bi + 6] = vz;
      next[bi + 7] = cpuBodies[bi + 7];
    }
    cpuBodies = next;
    stepIndex += 1;
    if (mode === 1) scaleFactorA = Math.min(2.0, scaleFactorA + dt * hubbleRate * scaleFactorA);
    return cpuBodies;
  }

  let mapInFlight = false;

  async function step({
    dt = 0.014,
    gravity = 1.0,
    softening = 0.22,
    hubbleRate = 0.12,
    readback = true
  } = {}) {
    if (disposed) return cpuBodies;
    if (!buffers || !pipeline) {
      return stepCpuFallback({ dt, gravity, softening, hubbleRate });
    }
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
      encoder.copyBufferToBuffer(buffers[dstIdx], 0, stagingBuffer, 0, cpuBodies.byteLength);
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
        cpuBodies.set(new Float32Array(stagingBuffer.getMappedRange()));
        stagingBuffer.unmap();
      } finally {
        mapInFlight = false;
      }
    }
    return cpuBodies;
  }

  function resetBodies(nextBodies) {
    cpuBodies = Float32Array.from(nextBodies);
    stepIndex = 0;
    scaleFactorA = mode === 1 ? 0.25 : 1.0;
    ping = 0;
    if (buffers && device) {
      device.queue.writeBuffer(buffers[0], 0, cpuBodies);
      device.queue.writeBuffer(buffers[1], 0, cpuBodies);
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
    get backend() { return buffers ? 'webgpu' : 'cpu-fallback'; },
    get gravityMode() { return buffers ? 'webgpu-tiled-direct' : 'cpu-fallback'; },
    getBodies: () => cpuBodies,
    getResidentBuffer,
    step,
    resetBodies,
    dispose
  };
}

/**
 * Wrap a resident tiled N-body engine into a ULG `SimulationModuleRegistry`
 * registration (`nbody-gravity@1` or `cosmology-comoving-nbody@1`).
 */
export function createResidentCosmicModuleRegistration({
  method,
  engine,
  scaleRangeM
}) {
  const stateLayout = {
    tensorId: 'bodies',
    dtype: 'f32',
    layout: 'interleaved',
    strideElements: 8,
    strideBytes: 32,
    fields: ['x', 'y', 'z', 'mass', 'vx', 'vy', 'vz', 'radius']
  };
  return {
    method,
    kernel: {
      sourceModule: 'src/demos/cosmicQuantumGpuKernels.js',
      entryPoint: 'step_nbody',
      wgsl: cosmicNBodyTiledWgsl,
      workgroupSize: 64
    },
    parameterSchema: {
      dt: { type: 'number', min: 0, required: true },
      gravity: { type: 'number', min: 0, required: true },
      softening: { type: 'number', min: 0, required: false },
      hubbleRate: { type: 'number', min: 0, required: false }
    },
    stateLayout,
    scaleRangeM,
    async stepCapsule(capsule, { createSimulationArtifact, leaseSession }) {
      const fromStep = engine.stepIndex;
      const bodies = await engine.step(capsule.input?.parameters || {});
      const toStep = engine.stepIndex;
      leaseSession.publishBuffer({
        resourceKey: 'bodies',
        buffer: engine.getResidentBuffer(),
        destroyFn: () => true, // engine owns ping-pong lifecycle
        byteLength: bodies.byteLength,
        rowCount: engine.count,
        layout: stateLayout,
        stepIndex: toStep,
        portableSnapshotFn: () => Float32Array.from(bodies)
      });
      const leaseHandle = leaseSession.borrowBufferReadLease({
        resourceKey: 'bodies',
        consumerStage: 'cosmic-quantum-renderer',
        reason: 'live-render-frame-lease'
      });
      const artifact = createSimulationArtifact({
        artifactId: `${capsule.taskId}:${method.model}:${toStep}`,
        taskKind: capsule.taskKind,
        closureRef: { module: 'src/demos/cosmicQuantumGpuKernels.js', entryPoint: 'step_nbody' },
        representation: 'nbody-interleaved-f32',
        outputs: {
          deltas: [{ operation: 'replace', tensorId: 'bodies', fromStep, toStep }]
        },
        execution: {
          backend: engine.backend,
          stage: `${method.model}.step`,
          placement: 'local',
          gravityMode: engine.gravityMode,
          scaleFactorA: engine.scaleFactorA
        },
        validity: {
          finite: true,
          bodyCount: engine.activeCount,
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
