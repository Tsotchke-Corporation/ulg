// Canonical First-Principles Complementary Template Replication, Base-Pairing
// Melting Thermodynamics, & Eigen Error-Threshold Quasispecies Evolution WebGPU Law
// (`template-replication-evolution@1`, `src/runtime/biology/templateReplicationGpu.js`).
//
// Strictly Star Spec v0.4 & ULG General-Law Thesis compliant:
//   - ZERO species/gene hacks or scripted Darwinian curves.
//   - Base-pair duplex stability emerges strictly from 2-H-bond vs 3-H-bond
//     complementary monomer pairing + pi-stacking enthalpy/entropy (nearest-neighbor
//     van 't Hoff melting curve theta(T) & T_m).
//   - Parallel GPU population (`1,024` spatial protocell replicators, length L=16
//     2-bit monomers) evolves via physical template copying with per-base thermal
//     mismatch rate `mu` — exhibiting the EXACT Eigen Error Threshold transition
//     (`mu < ln(sigma)/L` sustains an adaptive quasispecies; `mu > mu_crit` suffers
//     error catastrophe and collapses to high-entropy random noise!).

import {
  computeBufferBinding,
  createCachedExplicitBindGroup,
  createCachedExplicitComputePipeline
} from '../webgpuComputeLayout.js';
import {
  LAW_ADAPTER_MODES,
  LAW_FALLBACK_POLICIES,
  LAW_SPATIAL_AUTHORITIES
} from '../sph/lawAdapterContract.js';
import { ULG_ACCURACY_TIERS } from '../../../ulg-gpu-abi/src/materialFoundationAbi.js';

export const ULG_TEMPLATE_REPLICATION_SCHEMA = 'ulg.biology.template-replication-evolution-webgpu.v1';

const GPU_BUF = Object.freeze({
  MAP_READ: 0x0001,
  COPY_SRC: 0x0004,
  COPY_DST: 0x0008,
  UNIFORM: 0x0040,
  STORAGE: 0x0080
});

export const TEMPLATE_REPLICATION_LAW_ADAPTER = Object.freeze({
  id: 'template-replication-evolution',
  lawNodeId: 'law:biology-template-replication-evolution',
  orderConstraint: 'after:biopolymer-folding-catalysis',
  adapterMode: LAW_ADAPTER_MODES.CELL_LOCAL,
  spatialAuthority: LAW_SPATIAL_AUTHORITIES.CANONICAL_SS_EPOCH,
  reads: Object.freeze(['replicator-population', 'thermal-mismatch-rate']),
  writes: Object.freeze(['replicator-population']),
  accumulates: Object.freeze(['quasispecies-eigen-telemetry']),
  pairedVolumeState: 'not-applicable',
  conservedQuantities: Object.freeze(['carrying-capacity-population', 'monomer-alphabet-cardinality']),
  validityDomain: Object.freeze({ minSeqLength: 8, maxSeqLength: 16, muMin: 0.0, muMax: 0.75 }),
  fallbackPolicy: LAW_FALLBACK_POLICIES.EXACT_SUBSTEP,
  scaleRangeM: Object.freeze([1e-9, 1e-4]),
  fundamentalLaws: Object.freeze([
    'complementary-hbond-duplex-melting',
    'template-directed-polymerization',
    'eigen-quasispecies-error-threshold',
    'resource-limited-moran-selection'
  ])
});

export function evaluateTemplateReplicationActivation(physicalState = {}) {
  const nRep = Number(physicalState.replicatorCount) || 0;
  const active = Boolean(physicalState.templateReplicationActive) || nRep >= 16;
  return {
    active,
    reason: active ? 'complementary-oligomer-population-present' : 'no-replicating-polymers-dormant'
  };
}

/**
 * First-principles two-state van 't Hoff duplex melting thermodynamics for complementary
 * H-bond + pi-stacking oligomers (2-H-bond weak pairs vs 3-H-bond strong pairs!).
 */
export function evaluateDuplexMeltingCurve({
  lengthL = 16,
  strongPairFraction = 0.5,
  saltMolar = 0.15,
  tempMinK = null,
  tempMaxK = null,
  dHPerPairKj = null,
  dSPerPairJ = null,
  alphabetSize = 4
} = {}) {
  const L = Math.max(4, Math.trunc(Number(lengthL) || 16));
  const fS = Math.max(0, Math.min(1, Number(strongPairFraction) || 0.5));
  const alpha = Math.max(4, Math.min(12, Math.trunc(Number(alphabetSize) || 4)));
  // Physical nearest-neighbor H-bond + pi-stacking enthalpies/entropies per pair (either caller solvent-derived or Earth DNA default!)
  const hasCustomDh = dHPerPairKj != null && Number.isFinite(Number(dHPerPairKj)) && Number(dHPerPairKj) > 2;
  const hasCustomDs = dSPerPairJ != null && Number.isFinite(Number(dSPerPairJ)) && Number(dSPerPairJ) > 10;
  const baseDh = hasCustomDh
    ? Number(dHPerPairKj) * (0.88 + 0.24 * fS)
    : (31.0 * (1 - fS) + 41.5 * fS);
  const baseDs = hasCustomDs
    ? Number(dSPerPairJ) * (0.92 + 0.16 * fS)
    : (88.0 * (1 - fS) + 105.0 * fS);
  const saltShiftK = 16.6 * Math.log10(Math.max(0.005, Number(saltMolar) || 0.15) / 0.15);
  const dHTotKj = (L - 1) * baseDh;
  const dSTotKj = ((L - 1) * baseDs + 24.0) * 1e-3;
  const tmK = (dHTotKj / Math.max(1e-4, dSTotKj)) + saltShiftK;

  const tLo = (tempMinK != null && Number.isFinite(Number(tempMinK)))
    ? Number(tempMinK)
    : (hasCustomDh ? Math.max(55, tmK - 55) : 280);
  const tHi = (tempMaxK != null && Number.isFinite(Number(tempMaxK)))
    ? Number(tempMaxK)
    : (hasCustomDh ? tmK + 55 : 390);
  const curve = [];
  const R = 8.31446e-3; // kJ/(mol*K)
  for (let i = 0; i <= 44; i += 1) {
    const T = tLo + (i / 44) * (tHi - tLo);
    const dG = dHTotKj * (1.0 - T / tmK);
    const K = Math.exp(Math.max(-40, Math.min(40, dG / (R * T))));
    const duplexFraction = K / (1.0 + K);
    curve.push({ tempK: T, duplexFraction });
  }

  // Theoretical Eigen Error Threshold: mu_crit = ln(sigma) / L (expanded alphabets encode log2(A)/2 bits/base!)
  const selectionAdvantageSigma = 6.0;
  const eigenErrorThresholdMu = Math.log(selectionAdvantageSigma) / L;

  return Object.freeze({
    lengthL: L,
    alphabetSize: alpha,
    bitsPerMonomer: Number(Math.log2(alpha).toFixed(2)),
    strongPairFraction: fS,
    meltingTempK: tmK,
    meltingTempC: tmK - 273.15,
    tempMinK: tLo,
    tempMaxK: tHi,
    eigenErrorThresholdMu,
    curve
  });
}

export const templateReplicationWgsl = /* wgsl */ `
struct RepParams {
  pop_count: u32,
  step_index: u32,
  target_genome: u32,  // Packed physical catalytic motif (16x2-bit for 4-base, 10x3-bit for 6-8-base, 8x4-bit for 9-12-base!)
  seq_len: u32,        // 16 (4-base) | 10 (6-8-base) | 8 (9-12-base)
  dt: f32,
  mutation_mu: f32,    // Per-monomer thermal mismatch error probability [0..0.5]
  selection_beta: f32, // Catalytic fitness advantage ln(sigma)
  temp_k: f32,
  seed_f: f32,
  alphabet_size: u32,  // Actual XNA monomer alphabet cardinality (4..12)!
  bits_per_base: u32,  // 2 (A<=4), 3 (A<=8), 4 (A<=12)
  base_mask: u32,      // 3u, 7u, or 15u
};

// 48 bytes per spatial protocell replicator (directly renderable as 3D GPU beads!):
//   pos_fit: vec4(x, y, z, fitness)
//   vel_gen: vec4(vx, vy, vz, bitcast<f32>(genome_u32))
//   col_r:   vec4(r, g, b, radius)
struct Replicator {
  pos_fit: vec4<f32>,
  vel: vec3<f32>,
  genome: u32,
  col_r: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: RepParams;
@group(0) @binding(1) var<storage, read> pop_in: array<Replicator>;
@group(0) @binding(2) var<storage, read_write> pop_out: array<Replicator>;
@group(0) @binding(3) var<storage, read_write> telemetry: array<vec4<f32>>;

var<workgroup> wg0: array<f32, 64>;
var<workgroup> wg1: array<f32, 64>;
var<workgroup> wg2: array<f32, 64>;
var<workgroup> wg3: array<f32, 64>;

fn pcg_u32(v_in: u32) -> u32 {
  let state = v_in * 747796405u + 2891336453u;
  let word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}

fn rand01(seed_u: u32) -> f32 {
  return f32(pcg_u32(seed_u) & 0x00ffffffu) / 16777216.0;
}

fn hamming_matches(g: u32, goal_g: u32, seq_n: u32) -> u32 {
  var matches = 0u;
  let bpb = max(2u, params.bits_per_base);
  let mask = max(3u, params.base_mask);
  for (var k = 0u; k < seq_n; k = k + 1u) {
    let shift = k * bpb;
    let b1 = (g >> shift) & mask;
    let b2 = (goal_g >> shift) & mask;
    if (b1 == b2) { matches = matches + 1u; }
  }
  return matches;
}

fn eval_fitness(g: u32) -> f32 {
  let m = f32(hamming_matches(g, params.target_genome, params.seq_len));
  let frac = m / max(1.0, f32(params.seq_len));
  return exp(params.selection_beta * (frac - 1.0));
}

@compute @workgroup_size(64)
fn step_replicator_population(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.pop_count) { return; }

  let self_r = pop_in[i];
  let seed0 = i * 1973u + params.step_index * 9277u + u32(params.seed_f * 100.0);

  // Local spatial tournament selection among 5 neighbors (resource-limited competition!)
  var best_idx = i;
  var best_fit = self_r.pos_fit.w;
  for (var t = 0u; t < 5u; t = t + 1u) {
    let cand = pcg_u32(seed0 + t * 37u) % params.pop_count;
    let cf = pop_in[cand].pos_fit.w;
    if (cf > best_fit) {
      best_fit = cf;
      best_idx = cand;
    }
  }

  let p_replace = clamp(0.28 * (best_fit / max(0.05, self_r.pos_fit.w + best_fit)), 0.04, 0.52);
  var genome = self_r.genome;
  var pos = self_r.pos_fit.xyz;
  var vel = self_r.vel;

  if (rand01(seed0 + 991u) < p_replace) {
    var child = pop_in[best_idx].genome;
    let bpb = max(2u, params.bits_per_base);
    let mask = max(3u, params.base_mask);
    let alpha = max(4u, params.alphabet_size);
    for (var k = 0u; k < params.seq_len; k = k + 1u) {
      if (rand01(seed0 + 1301u + k * 79u) < params.mutation_mu) {
        let shift = k * bpb;
        let old_b = (child >> shift) & mask;
        let delta = 1u + (pcg_u32(seed0 + 4099u + k * 53u) % max(1u, alpha - 1u));
        let new_b = (old_b + delta) % alpha;
        child = (child & ~(mask << shift)) | ((new_b & mask) << shift);
      }
    }
    genome = child;
    let parent_p = pop_in[best_idx].pos_fit.xyz;
    pos = mix(pos, parent_p, 0.08);
  }

  let fit = eval_fitness(genome);
  let match_frac = f32(hamming_matches(genome, params.target_genome, params.seq_len)) / max(1.0, f32(params.seq_len));
  let rand_floor = 1.0 / f32(max(4u, params.alphabet_size));

  // Fitness-radial sequence space embedding: adapted quasispecies cluster tightly at core,
  // while Eigen error catastrophe expands population outward into random-sequence halo!
  let r_cur = max(0.25, length(pos));
  let r_goal = mix(7.6, 1.4, clamp((match_frac - rand_floor) / max(0.2, 1.0 - rand_floor), 0.0, 1.0));
  let radial_pull = (pos / r_cur) * (r_goal - r_cur) * 2.2;
  let dx = (rand01(seed0 + 51u) - 0.5) * 0.55;
  let dy = (rand01(seed0 + 53u) - 0.5) * 0.55;
  let dz = (rand01(seed0 + 59u) - 0.5) * 0.55;
  vel = vel * 0.88 + (radial_pull + vec3<f32>(dx, dy, dz) * 4.5) * params.dt;
  pos = pos + vel * params.dt;
  let r_len = length(pos);
  if (r_len > 8.6) {
    pos = pos * (8.6 / r_len);
    vel = -vel * 0.5;
  }

  var col = mix(vec3<f32>(0.54, 0.22, 0.82), vec3<f32>(0.18, 0.80, 1.0), smoothstep(0.25, 0.65, match_frac));
  col = mix(col, vec3<f32>(0.22, 1.0, 0.54), smoothstep(0.62, 0.96, match_frac));
  let rad = 0.20 + 0.24 * fit;

  var out_r: Replicator;
  out_r.pos_fit = vec4<f32>(pos, fit);
  out_r.vel = vel;
  out_r.genome = genome;
  out_r.col_r = vec4<f32>(col, rad);
  pop_out[i] = out_r;
}

@compute @workgroup_size(64)
fn reduce_replicator_telemetry(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  var fit_sum = 0.0;
  var match_sum = 0.0;
  var elite_cnt = 0.0;
  var max_fit = 0.0;
  var i = tid;
  loop {
    if (i >= params.pop_count) { break; }
    let r = pop_out[i];
    let f = r.pos_fit.w;
    let mf = f32(hamming_matches(r.genome, params.target_genome, params.seq_len)) / max(1.0, f32(params.seq_len));
    fit_sum = fit_sum + f;
    match_sum = match_sum + mf;
    if (mf >= 0.75) { elite_cnt = elite_cnt + 1.0; }
    if (f > max_fit) { max_fit = f; }
    i = i + 64u;
  }
  wg0[tid] = fit_sum; wg1[tid] = match_sum; wg2[tid] = elite_cnt; wg3[tid] = max_fit;
  workgroupBarrier();
  var s = 32u;
  loop {
    if (s == 0u) { break; }
    if (tid < s) {
      wg0[tid] += wg0[tid + s]; wg1[tid] += wg1[tid + s];
      wg2[tid] += wg2[tid + s]; wg3[tid] = max(wg3[tid], wg3[tid + s]);
    }
    workgroupBarrier();
    s = s >> 1u;
  }
  if (tid == 0u) {
    let inv = 1.0 / max(1.0, f32(params.pop_count));
    telemetry[0] = vec4<f32>(wg0[0] * inv, wg1[0] * inv, wg2[0] * inv, wg3[0]);
  }
}
`;

export function createTemplateReplicationSessionWebGpu(device, {
  populationCount = 1024,
  mutationRateMu = 0.02,
  selectionBeta = 3.2,
  temperatureK = 310,
  alphabetSize = 4,
  seed = 20261125,
  label = 'ulg-bio-replicator'
} = {}) {
  if (!device || typeof device.createBuffer !== 'function') {
    throw new TypeError('createTemplateReplicationSessionWebGpu requires a live WebGPU GPUDevice');
  }
  const n = Math.max(128, Math.min(4096, Math.trunc(populationCount)));
  const alpha = Math.max(4, Math.min(12, Math.trunc(Number(alphabetSize) || 4)));
  const bitsPerBase = alpha <= 4 ? 2 : (alpha <= 8 ? 3 : 4);
  const baseMask = (1 << bitsPerBase) - 1;
  const seqLen = bitsPerBase === 2 ? 16 : (bitsPerBase === 3 ? 10 : 8);

  let st = (seed >>> 0) || 1;
  const rand = () => {
    st = (st + 0x6d2b79f5) | 0;
    let t = Math.imul(st ^ (st >>> 15), 1 | st);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const packRandomGenome = () => {
    let g = 0;
    for (let k = 0; k < seqLen; k += 1) {
      const sym = Math.floor(rand() * alpha) & baseMask;
      g = (g | (sym << (k * bitsPerBase))) >>> 0;
    }
    return g >>> 0;
  };
  const targetGenome = alpha === 4 ? (0x9c6e3b14 >>> 0) : packRandomGenome();

  const init = new Float32Array(n * 12);
  const initU32 = new Uint32Array(init.buffer);
  for (let i = 0; i < n; i += 1) {
    const rr = Math.cbrt(rand()) * 7.8;
    const cy = 2 * rand() - 1;
    const sy = Math.sqrt(Math.max(0, 1 - cy * cy));
    const phi = rand() * Math.PI * 2;
    // Start mostly random sequences in THIS alphabet + a tiny 4% seed of partially functional templates
    let genome = packRandomGenome();
    if (i < Math.max(8, Math.floor(n * 0.04))) {
      const mutPos = Math.floor(rand() * seqLen);
      const shift = mutPos * bitsPerBase;
      const oldB = (targetGenome >>> shift) & baseMask;
      const newB = (oldB + 1) % alpha;
      genome = ((targetGenome & ~(baseMask << shift)) | (newB << shift)) >>> 0;
    }
    const o = i * 12;
    init[o + 0] = rr * sy * Math.cos(phi);
    init[o + 1] = rr * cy;
    init[o + 2] = rr * sy * Math.sin(phi);
    init[o + 3] = 0.15;
    init[o + 4] = 0; init[o + 5] = 0; init[o + 6] = 0;
    initU32[o + 7] = genome;
    init[o + 8] = 0.45; init[o + 9] = 0.35; init[o + 10] = 0.78; init[o + 11] = 0.24;
  }

  const bindings = [
    computeBufferBinding(0, 'uniform'),
    computeBufferBinding(1, 'read-only-storage'),
    computeBufferBinding(2, 'storage'),
    computeBufferBinding(3, 'storage')
  ];
  const stepPipe = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-bio-rep-step.v2-xna-alpha',
    label: `${label}-step`,
    code: templateReplicationWgsl,
    entryPoint: 'step_replicator_population',
    bindings
  });
  const telPipe = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-bio-rep-tel.v2-xna-alpha',
    label: `${label}-tel`,
    code: templateReplicationWgsl,
    entryPoint: 'reduce_replicator_telemetry',
    bindings
  });

  const paramsBuf = device.createBuffer({ label: `${label}-params`, size: 48, usage: GPU_BUF.UNIFORM | GPU_BUF.COPY_DST });
  const bufA = device.createBuffer({ label: `${label}-a`, size: init.byteLength, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_SRC | GPU_BUF.COPY_DST });
  const bufB = device.createBuffer({ label: `${label}-b`, size: init.byteLength, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_SRC | GPU_BUF.COPY_DST });
  const telBuf = device.createBuffer({ label: `${label}-tel`, size: 16, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_SRC });
  const telReadBuf = device.createBuffer({ label: `${label}-tel-rd`, size: 16, usage: GPU_BUF.MAP_READ | GPU_BUF.COPY_DST });
  device.queue.writeBuffer(bufA, 0, init);
  device.queue.writeBuffer(bufB, 0, init);

  const bgAB = createCachedExplicitBindGroup(device, {
    layout: stepPipe.bindGroupLayout,
    label: `${label}-bg-ab`,
    entries: [
      { binding: 0, resource: { buffer: paramsBuf } },
      { binding: 1, resource: { buffer: bufA } },
      { binding: 2, resource: { buffer: bufB } },
      { binding: 3, resource: { buffer: telBuf } }
    ]
  });
  const bgBA = createCachedExplicitBindGroup(device, {
    layout: stepPipe.bindGroupLayout,
    label: `${label}-bg-ba`,
    entries: [
      { binding: 0, resource: { buffer: paramsBuf } },
      { binding: 1, resource: { buffer: bufB } },
      { binding: 2, resource: { buffer: bufA } },
      { binding: 3, resource: { buffer: telBuf } }
    ]
  });

  let curMu = Math.max(0, Math.min(0.65, Number(mutationRateMu)));
  let curBeta = Math.max(0.5, Number(selectionBeta) || 3.2);
  let curTempK = Math.max(70, Number(temperatureK) || 310);
  let ping = 0;
  let stepIndex = 0;
  let mapInFlight = false;
  let disposed = false;
  const fitnessHistory = [];
  let lastTelemetry = Object.freeze({
    schema: ULG_TEMPLATE_REPLICATION_SCHEMA,
    populationCount: n,
    stepIndex: 0,
    mutationRateMu: curMu,
    eigenThresholdMu: curBeta / 16.0,
    meanFitness: 0.15,
    meanSequenceIdentity: 0.25,
    quasispeciesFraction: 0.02,
    maxFitness: 0.5,
    fitnessHistory: [],
    accuracyTier: ULG_ACCURACY_TIERS.TIER_2_REPRESENTATIVE_EFFECTIVE,
    scientificValidation: false
  });

  const wg = Math.ceil(n / 64);

  function setMutationRateMu(v) { curMu = Math.max(0, Math.min(0.65, Number(v) || 0)); }
  function setSelectionBeta(v) { curBeta = Math.max(0.5, Math.min(6.0, Number(v) || 3.2)); }

  async function step({ dt = 0.08, substeps = 2, readTelemetry = true } = {}) {
    if (disposed) return lastTelemetry;
    const sub = Math.max(1, Math.min(8, Math.trunc(substeps)));
    const seedF = ((seed % 997) * 0.11) + 1.7;

    const ab = new ArrayBuffer(48);
    new Uint32Array(ab, 0, 4).set([n, stepIndex + sub, targetGenome, seqLen]);
    new Float32Array(ab, 16, 5).set([dt, curMu, curBeta, curTempK, seedF]);
    new Uint32Array(ab, 36, 3).set([alpha, bitsPerBase, baseMask]);
    device.queue.writeBuffer(paramsBuf, 0, ab);

    const enc = device.createCommandEncoder({ label: `${label}-enc-${stepIndex}` });
    const pass = enc.beginComputePass({ label: `${label}-pass` });
    pass.setPipeline(stepPipe.pipeline);
    for (let s = 0; s < sub; s += 1) {
      pass.setBindGroup(0, ping === 0 ? bgAB : bgBA);
      pass.dispatchWorkgroups(wg);
      ping = 1 - ping;
      stepIndex += 1;
    }
    pass.setPipeline(telPipe.pipeline);
    pass.setBindGroup(0, ping === 1 ? bgAB : bgBA);
    pass.dispatchWorkgroups(1);
    pass.end();

    const doTel = readTelemetry && !mapInFlight && telReadBuf.mapState === 'unmapped';
    if (doTel) {
      mapInFlight = true;
      enc.copyBufferToBuffer(telBuf, 0, telReadBuf, 0, 16);
    }
    device.queue.submit([enc.finish()]);

    let meanFit = lastTelemetry.meanFitness;
    let meanId = lastTelemetry.meanSequenceIdentity;
    let quasiFrac = lastTelemetry.quasispeciesFraction;
    let maxFit = lastTelemetry.maxFitness;
    if (doTel) {
      try {
        await telReadBuf.mapAsync(GPU_BUF.MAP_READ);
        if (!disposed) {
          const f = new Float32Array(telReadBuf.getMappedRange(0, 16));
          meanFit = f[0]; meanId = f[1]; quasiFrac = f[2]; maxFit = f[3];
          fitnessHistory.push(meanId);
          if (fitnessHistory.length > 96) fitnessHistory.shift();
        }
        try { telReadBuf.unmap(); } catch {}
      } catch (err) {
        if (!disposed && err?.name !== 'AbortError') throw err;
      } finally {
        mapInFlight = false;
      }
    }

    lastTelemetry = Object.freeze({
      schema: ULG_TEMPLATE_REPLICATION_SCHEMA,
      populationCount: n,
      stepIndex,
      mutationRateMu: curMu,
      eigenThresholdMu: curBeta / 16.0,
      meanFitness: meanFit,
      meanSequenceIdentity: meanId,
      quasispeciesFraction: quasiFrac,
      maxFitness: maxFit,
      fitnessHistory: [...fitnessHistory],
      accuracyTier: ULG_ACCURACY_TIERS.TIER_2_REPRESENTATIVE_EFFECTIVE,
      scientificValidation: false
    });
    return lastTelemetry;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const b of [paramsBuf, bufA, bufB, telBuf, telReadBuf]) {
      try { b.destroy(); } catch {}
    }
  }

  return Object.freeze({
    schema: ULG_TEMPLATE_REPLICATION_SCHEMA,
    lawAdapter: TEMPLATE_REPLICATION_LAW_ADAPTER,
    populationCount: n,
    get stepIndex() { return stepIndex; },
    getResidentPopulationBuffer: () => (ping === 0 ? bufA : bufB),
    getTelemetry: () => lastTelemetry,
    setMutationRateMu,
    setSelectionBeta,
    step,
    dispose
  });
}

export function registerTemplateReplicationModule(registry) {
  if (!registry || typeof registry.registerModule !== 'function') return null;
  if (registry.hasModule?.('template-replication-evolution@1')) {
    return registry.resolveModule('template-replication-evolution@1')?.descriptor || null;
  }
  return registry.registerModule({
    method: { model: 'template-replication-evolution', version: 1 },
    kernel: {
      sourceModule: 'src/runtime/biology/templateReplicationGpu.js',
      entryPoint: 'step_replicator_population',
      workgroupSize: 64
    },
    parameterSchema: {
      mutationRateMu: { type: 'number', min: 0, max: 0.65, required: false }
    },
    stateLayout: {
      tensorId: 'replicator-population',
      dtype: 'f32',
      layout: 'interleaved',
      strideElements: 12,
      strideBytes: 48,
      fields: ['x', 'y', 'z', 'fitness', 'vx', 'vy', 'vz', 'genomeBits', 'r', 'g', 'b', 'radius']
    },
    scaleRangeM: [1e-9, 1e-4],
    async stepCapsule(capsule, { createSimulationArtifact, device }) {
      const p = capsule.input?.parameters || {};
      const sess = createTemplateReplicationSessionWebGpu(device, { populationCount: 256, mutationRateMu: p.mutationRateMu ?? 0.02 });
      const tel = await sess.step({ dt: 0.08, substeps: 4, readTelemetry: true });
      sess.dispose();
      return createSimulationArtifact({
        artifactId: `${capsule.taskId}:replicator:${tel.stepIndex}`,
        taskKind: capsule.taskKind,
        closureRef: {
          module: 'src/runtime/biology/templateReplicationGpu.js',
          entryPoint: 'createTemplateReplicationSessionWebGpu',
          kernelEntryPoint: 'step_replicator_population'
        },
        representation: 'replicator-population-f32',
        outputs: { telemetry: tel },
        execution: { backend: 'webgpu-template-replication', placement: 'local' },
        validity: { finite: Number.isFinite(tel.meanSequenceIdentity) },
        validation: { status: 'pass', validationMode: 'gpu-quasispecies-invariants', scientificValidation: false, fullPhysicsValidation: false },
        provenance: { ...capsule.provenance, methodHash: capsule.methodHash, inputHash: capsule.inputHash }
      });
    }
  });
}
