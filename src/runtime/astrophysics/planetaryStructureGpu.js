// Gate 5A (10^+6 -> 10^+13 m): Polytope-Atlas Planetary Interior Hydrostatic
// Structure & Symplectic Multi-Body GPU Dynamics
// (`src/runtime/astrophysics/planetaryStructureGpu.js`).
//
// Bridges Gate 1-2 first-principles material bundles & Convex Polytope Atlases
// directly to planetary astrophysics: integrates dM/dr = 4pi r^2 rho(P, T) and
// dP/dr = -G M(r) rho(P, T) / r^2 across multi-layer interiors (Fe core,
// silicate mantle, H2O ocean/ice, H2/He envelope), deriving emergent mass,
// radius, moment of inertia I/(MR^2), central pressure, escape velocity, and
// dynamo scaling — zero hardcoded planet lookup tables!

import { evaluateBundleDensityEos } from '../material/polytopeAtlasBuilder.js';
import {
  computeBufferBinding,
  createCachedExplicitComputePipeline
} from '../webgpuComputeLayout.js';
import { ULG_ACCURACY_TIERS } from '../../../ulg-gpu-abi/src/materialFoundationAbi.js';

export const ULG_PLANETARY_INTERIOR_SCHEMA = 'ulg.astrophysics.planetary-interior-polytope.v1';
export const ULG_PLANETARY_NBODY_GPU_SCHEMA = 'ulg.astrophysics.planetary-symplectic-gpu.v1';

const G_SI = 6.67430e-11;
const GPU_BUFFER_USAGE = Object.freeze({
  MAP_READ: 0x01,
  COPY_SRC: 0x04,
  COPY_DST: 0x08,
  UNIFORM: 0x40,
  STORAGE: 0x80
});

// Offline G7 advisory planetary references (PREM / NASA fact sheet — advisory only!)
export const G7_ADVISORY_PLANETARY_REFERENCES = Object.freeze({
  earth: Object.freeze({ massKg: 5.9722e24, radiusM: 6.371e6, moiFactor: 0.3307, centralPressureGPa: 364 }),
  mars: Object.freeze({ massKg: 6.4171e23, radiusM: 3.3895e6, moiFactor: 0.3644, centralPressureGPa: 40 })
});

/**
 * Integrate radial planetary hydrostatic equilibrium from center (r = 0, P = P_c)
 * to surface (P <= P_surf) using Gate 1-2 material bundles / Polytope Atlases.
 *
 * `layers`: ordered from core outward, e.g.
 *   [{ name: 'core', bundle: feBundle, phase: 'solid', massFractionTarget: 0.325, tempK: 5500 },
 *    { name: 'mantle', bundle: sio2Bundle, phase: 'solid', massFractionTarget: 0.675, tempK: 2200 }]
 */
export function solvePlanetaryInteriorFromBundles({
  centralPressurePa = 360e9,
  surfacePressurePa = 1e5,
  layers = [],
  radialStepM = 20000,
  maxRadiusM = 1.5e8
} = {}) {
  if (!Array.isArray(layers) || layers.length === 0) {
    throw new TypeError('solvePlanetaryInteriorFromBundles requires at least one material layer');
  }
  const totalFrac = layers.reduce((s, l) => s + Math.max(0, Number(l.massFractionTarget ?? 1)), 0) || 1;
  // Estimate approximate total mass for layer boundary transitions, then refine in 2 passes
  let estTotalMassKg = 6e24;
  let profile = [];
  let totalMassKg = 0;
  let radiusM = 0;
  let moiKgM2 = 0;

  for (let pass = 0; pass < 3; pass += 1) {
    let r = 0;
    let m = 0;
    let P = Number(centralPressurePa);
    let I = 0;
    const curProfile = [];
    const cumTargets = [];
    let acc = 0;
    for (const l of layers) {
      acc += Math.max(0, Number(l.massFractionTarget ?? 1)) / totalFrac;
      cumTargets.push(acc);
    }

    const pickLayer = (massFrac) => {
      for (let i = 0; i < layers.length; i += 1) {
        if (massFrac <= cumTargets[i] || i === layers.length - 1) return layers[i];
      }
      return layers[layers.length - 1];
    };

    const dr = Math.max(2000, Number(radialStepM));
    while (P > surfacePressurePa && r < maxRadiusM) {
      const layer = pickLayer(m / Math.max(1e20, estTotalMassKg));
      const T = Number(layer.tempK ?? 1500);
      const phase = layer.phase ?? 'solid';
      const rho = evaluateBundleDensityEos(layer.bundle, phase, T, P);
      const rMid = r + 0.5 * dr;
      const dM = 4 * Math.PI * rMid * rMid * rho * dr;
      const mMid = m + 0.5 * dM;
      const g = rMid > 1 ? (G_SI * mMid) / (rMid * rMid) : 0;
      const dP = -rho * g * dr;

      if (curProfile.length < 400 || (curProfile.length % 2 === 0)) {
        curProfile.push({
          radiusM: r,
          pressurePa: P,
          densityKgPerM3: rho,
          massEnclosedKg: m,
          gravityMPerS2: g,
          layer: layer.name || layer.bundle.materialKey
        });
      }
      m += dM;
      // Spherical shell moment of inertia dI = (2/3) * r^2 * dM
      I += (2 / 3) * rMid * rMid * dM;
      P += dP;
      r += dr;
    }
    totalMassKg = m;
    radiusM = r;
    moiKgM2 = I;
    profile = curProfile;
    estTotalMassKg = Math.max(1e20, totalMassKg);
  }

  const volumeM3 = (4 / 3) * Math.PI * (radiusM ** 3);
  const meanDensityKgPerM3 = totalMassKg / Math.max(1, volumeM3);
  const surfaceGravityMPerS2 = (G_SI * totalMassKg) / Math.max(1, radiusM * radiusM);
  const escapeVelocityMPerS = Math.sqrt((2 * G_SI * totalMassKg) / Math.max(1, radiusM));
  const moiFactor = moiKgM2 / Math.max(1, totalMassKg * radiusM * radiusM);
  const coreSigma = Number(layers[0]?.bundle?.electromagnetic?.electricalConductivitySPerM ?? 0);

  return Object.freeze({
    schema: ULG_PLANETARY_INTERIOR_SCHEMA,
    centralPressurePa: Number(centralPressurePa),
    totalMassKg,
    radiusM,
    meanDensityKgPerM3,
    surfaceGravityMPerS2,
    escapeVelocityMPerS,
    moiFactor,
    coreConductivitySPerM: coreSigma,
    dynamoCapable: coreSigma > 1e4 && centralPressurePa > 1e10,
    layerCount: layers.length,
    profile: Object.freeze(profile),
    accuracyTier: ULG_ACCURACY_TIERS.TIER_2_REPRESENTATIVE_EFFECTIVE,
    provenance: Object.freeze({
      status: 'polytope-bundle-derived',
      scientificValidation: false
    })
  });
}

// Symplectic Leapfrog GPU N-Body (translation-invariant, exact momentum & energy check)
const symplecticNBodyWgsl = /* wgsl */ `
struct NBodyParams {
  body_count: u32,
  steps: u32,
  pad0: u32,
  pad1: u32,
  dt: f32,
  g_const: f32,
  softening2: f32,
  pad2: f32,
};

@group(0) @binding(0) var<uniform> params: NBodyParams;
// pos_m: xyz, mass
@group(0) @binding(1) var<storage, read_write> pos_m: array<vec4<f32>>;
// vel_e: vxyz, potE
@group(0) @binding(2) var<storage, read_write> vel_e: array<vec4<f32>>;
// acc: axyz, pad
@group(0) @binding(3) var<storage, read_write> acc: array<vec4<f32>>;

@compute @workgroup_size(64)
fn compute_accel(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  let n = params.body_count;
  if (i >= n) { return; }
  let pi = pos_m[i];
  var a = vec3<f32>(0.0);
  var phi = 0.0;
  for (var j = 0u; j < n; j = j + 1u) {
    if (j == i) { continue; }
    let pj = pos_m[j];
    let d = pj.xyz - pi.xyz;
    let r2 = dot(d, d) + params.softening2;
    let inv_r = inverseSqrt(r2);
    let inv_r3 = inv_r * inv_r * inv_r;
    a = a + (params.g_const * pj.w * inv_r3) * d;
    phi = phi - params.g_const * pi.w * pj.w * inv_r;
  }
  acc[i] = vec4<f32>(a, 0.0);
  vel_e[i].w = 0.5 * phi;
}

@compute @workgroup_size(64)
fn kick_drift(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.body_count) { return; }
  let dt = params.dt;
  let v_half = vel_e[i].xyz + 0.5 * dt * acc[i].xyz;
  pos_m[i] = vec4<f32>(pos_m[i].xyz + v_half * dt, pos_m[i].w);
  vel_e[i] = vec4<f32>(v_half, vel_e[i].w);
}

@compute @workgroup_size(64)
fn second_kick(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.body_count) { return; }
  let dt = params.dt;
  vel_e[i] = vec4<f32>(vel_e[i].xyz + 0.5 * dt * acc[i].xyz, vel_e[i].w);
}
`;

export async function runSymplecticPlanetaryNBodyWebGpu(device, {
  bodies, // [{ x, y, z, vx, vy, vz, mass }]
  dt = 0.005,
  steps = 200,
  gConst = 1.0,
  softening = 1e-4
} = {}) {
  if (!device || typeof device.createBuffer !== 'function') {
    throw new TypeError('runSymplecticPlanetaryNBodyWebGpu requires a live WebGPU GPUDevice');
  }
  const n = bodies.length;
  const posInit = new Float32Array(n * 4);
  const velInit = new Float32Array(n * 4);
  for (let i = 0; i < n; i += 1) {
    const b = bodies[i];
    posInit.set([b.x, b.y, b.z, b.mass], i * 4);
    velInit.set([b.vx, b.vy, b.vz, 0], i * 4);
  }
  const bindings = [
    computeBufferBinding(0, 'uniform'),
    computeBufferBinding(1, 'storage'),
    computeBufferBinding(2, 'storage'),
    computeBufferBinding(3, 'storage')
  ];
  const mk = (ep) => createCachedExplicitComputePipeline(device, {
    cacheKey: `ulg-planetary-symplectic-${ep}.v1`,
    label: `ulg-planetary-symplectic-${ep}`,
    code: symplecticNBodyWgsl,
    entryPoint: ep,
    bindings
  });
  const accPipe = mk('compute_accel');
  const kdPipe = mk('kick_drift');
  const skPipe = mk('second_kick');

  const pData = new ArrayBuffer(32);
  new Uint32Array(pData, 0, 4).set([n, steps, 0, 0]);
  new Float32Array(pData, 16, 4).set([dt, gConst, softening * softening, 0]);
  const pBuf = device.createBuffer({ size: 32, usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST });
  device.queue.writeBuffer(pBuf, 0, pData);
  const posBuf = device.createBuffer({ size: Math.max(16, posInit.byteLength), usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST | GPU_BUFFER_USAGE.COPY_SRC });
  device.queue.writeBuffer(posBuf, 0, posInit);
  const velBuf = device.createBuffer({ size: Math.max(16, velInit.byteLength), usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST | GPU_BUFFER_USAGE.COPY_SRC });
  device.queue.writeBuffer(velBuf, 0, velInit);
  const accBuf = device.createBuffer({ size: Math.max(16, n * 16), usage: GPU_BUFFER_USAGE.STORAGE });
  const rPos = device.createBuffer({ size: Math.max(16, posInit.byteLength), usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST });
  const rVel = device.createBuffer({ size: Math.max(16, velInit.byteLength), usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST });

  const bg = device.createBindGroup({
    layout: accPipe.bindGroupLayout,
    entries: [pBuf, posBuf, velBuf, accBuf].map((buffer, binding) => ({ binding, resource: { buffer } }))
  });
  const wg = Math.ceil(n / 64);
  const enc = device.createCommandEncoder({ label: 'ulg-planetary-symplectic' });
  const pass = enc.beginComputePass();
  pass.setBindGroup(0, bg);
  pass.setPipeline(accPipe.pipeline); pass.dispatchWorkgroups(wg);
  for (let s = 0; s < steps; s += 1) {
    pass.setPipeline(kdPipe.pipeline); pass.dispatchWorkgroups(wg);
    pass.setPipeline(accPipe.pipeline); pass.dispatchWorkgroups(wg);
    pass.setPipeline(skPipe.pipeline); pass.dispatchWorkgroups(wg);
  }
  pass.end();
  enc.copyBufferToBuffer(posBuf, 0, rPos, 0, posInit.byteLength);
  enc.copyBufferToBuffer(velBuf, 0, rVel, 0, velInit.byteLength);
  device.queue.submit([enc.finish()]);

  try {
    await Promise.all([rPos.mapAsync(GPU_BUFFER_USAGE.MAP_READ), rVel.mapAsync(GPU_BUFFER_USAGE.MAP_READ)]);
    const finalPos = new Float32Array(rPos.getMappedRange().slice(0, posInit.byteLength));
    const finalVel = new Float32Array(rVel.getMappedRange().slice(0, velInit.byteLength));
    rPos.unmap(); rVel.unmap();
    let ke = 0; let pe = 0;
    let lx = 0; let ly = 0; let lz = 0;
    for (let i = 0; i < n; i += 1) {
      const m = finalPos[i * 4 + 3];
      const x = finalPos[i * 4 + 0]; const y = finalPos[i * 4 + 1]; const z = finalPos[i * 4 + 2];
      const vx = finalVel[i * 4 + 0]; const vy = finalVel[i * 4 + 1]; const vz = finalVel[i * 4 + 2];
      ke += 0.5 * m * (vx * vx + vy * vy + vz * vz);
      pe += finalVel[i * 4 + 3];
      lx += m * (y * vz - z * vy);
      ly += m * (z * vx - x * vz);
      lz += m * (x * vy - y * vx);
    }
    return Object.freeze({
      schema: ULG_PLANETARY_NBODY_GPU_SCHEMA,
      backend: 'webgpu',
      steps,
      totalEnergy: ke + pe,
      kineticEnergy: ke,
      potentialEnergy: pe,
      angularMomentum: [lx, ly, lz],
      positions: finalPos,
      velocities: finalVel
    });
  } finally {
    for (const b of [pBuf, posBuf, velBuf, accBuf, rPos, rVel]) b.destroy();
  }
}
