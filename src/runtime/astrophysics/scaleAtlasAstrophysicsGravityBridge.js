// Gate 5 Canonical Schroeder Scale Atlas Astrophysics Gravity Unification Bridge
// (`src/runtime/astrophysics/scaleAtlasAstrophysicsGravityBridge.js`).
//
// Migrates stellar (`selfGravitatingHydroGpu.js`, stride 16) and galactic
// (`cosmicQuantumGpuKernels.js`, stride 8) gravitational multipole coupling onto
// ULG's single canonical 40-OOM `SchroederScaleAtlas` multipole authority
// (`schroederScaleAtlasMultipoleGpu.js`).
//
// Zero CPU particle subsampling or CPU binning loops: COM reduction, bounding
// span measurement, and octant-chart particle packing ALL execute in parallel
// (`@workgroup_size(64)` / `@workgroup_size(256)`) on WebGPU, feeding directly
// into the canonical `SchroederScaleAtlas` multipole kernels.

import { createDynamicSchroederScaleAtlasRuntime } from '../sph/schroederSpatialScaleAtlasRuntime.js';
import {
  GRAVITATIONAL_CONSTANT_SI,
  SCHROEDER_MULTIPOLE_RECEIPT_BYTES,
  SCHROEDER_MULTIPOLE_RECEIPT_MAGIC,
  STEFAN_BOLTZMANN_SI,
  ULG_SCHROEDER_SCALE_ATLAS_MULTIPOLE_SCHEMA,
  createSchroederScaleAtlasGravitySolverWebGpu,
  runSchroederScaleAtlasMultipoleWebGpu,
  schroederScaleAtlasMultipoleWgsl
} from '../sph/schroederScaleAtlasMultipoleGpu.js';
import { packSchroederScaleAtlasChartTable } from '../../../ulg-gpu-abi/src/index.js';
import {
  computeBufferBinding,
  createCachedExplicitBindGroup,
  createCachedExplicitComputePipeline
} from '../webgpuComputeLayout.js';

export const ULG_SCALE_ATLAS_ASTROPHYSICS_GRAVITY_SCHEMA =
  'peercompute.ulg.scale-atlas-astrophysics-gravity.v1';

export { createSchroederScaleAtlasGravitySolverWebGpu };

const USAGE_STORAGE = 0x0080;
const USAGE_UNIFORM = 0x0040;
const USAGE_COPY_DST = 0x0008;
const USAGE_COPY_SRC = 0x0004;
const USAGE_MAP_READ = 0x0001;

const gpuOctantBinningWgsl = /* wgsl */ `
struct BinParams {
  count: u32,
  stride_vec4: u32,
  pad0: u32,
  pad1: u32,
  mass_scale_kg: f32,
  temperature_k: f32,
  octant_offset: f32,
  pad2: f32,
};

struct MultipoleParticleInput {
  chart_id: u32,
  flags: u32,
  mass_kg: f32,
  temperature_k: f32,
  pos_local: vec3<f32>,
  effective_area_m2: f32,
};

@group(0) @binding(0) var<storage, read> src_raw: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> com_span: array<vec4<f32>>; // [0]=vec4(com.xyz, mTot), [1]=vec4(maxAbs, octantOffset, 0, 0)
@group(0) @binding(2) var<storage, read_write> out_particles: array<MultipoleParticleInput>;
@group(0) @binding(3) var<storage, read_write> octant_counts: array<atomic<u32>>;
@group(0) @binding(4) var<uniform> params: BinParams;

var<workgroup> wg_m: array<f32, 256>;
var<workgroup> wg_p: array<vec3<f32>, 256>;
var<workgroup> wg_max: array<f32, 256>;

@compute @workgroup_size(256)
fn gpu_com_and_span(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  let sv = params.stride_vec4;
  if (tid < 8u) {
    atomicStore(&octant_counts[tid], 0u);
  }
  var m_sum = 0.0;
  var p_sum = vec3<f32>(0.0);
  var i = tid;
  loop {
    if (i >= params.count) { break; }
    let pm = src_raw[i * sv + 0u];
    if (pm.w > 0.0) {
      m_sum = m_sum + pm.w;
      p_sum = p_sum + pm.xyz * pm.w;
    }
    i = i + 256u;
  }
  wg_m[tid] = m_sum;
  wg_p[tid] = p_sum;
  workgroupBarrier();

  var stride = 128u;
  loop {
    if (stride == 0u) { break; }
    if (tid < stride) {
      wg_m[tid] = wg_m[tid] + wg_m[tid + stride];
      wg_p[tid] = wg_p[tid] + wg_p[tid + stride];
    }
    workgroupBarrier();
    stride = stride >> 1u;
  }

  if (tid == 0u) {
    let m_tot = wg_m[0u];
    let com = select(vec3<f32>(0.0), wg_p[0u] / max(m_tot, 1e-30), m_tot > 0.0);
    com_span[0u] = vec4<f32>(com, m_tot);
  }
  workgroupBarrier();

  let com = com_span[0u].xyz;
  var local_max = 1e-6;
  var j = tid;
  loop {
    if (j >= params.count) { break; }
    let pm = src_raw[j * sv + 0u];
    if (pm.w > 0.0) {
      let r = abs(pm.xyz - com);
      local_max = max(local_max, max(r.x, max(r.y, r.z)));
    }
    j = j + 256u;
  }
  wg_max[tid] = local_max;
  workgroupBarrier();

  stride = 128u;
  loop {
    if (stride == 0u) { break; }
    if (tid < stride) {
      wg_max[tid] = max(wg_max[tid], wg_max[tid + stride]);
    }
    workgroupBarrier();
    stride = stride >> 1u;
  }

  if (tid == 0u) {
    let max_abs = wg_max[0u];
    let off = max(1.0, max_abs * 0.5);
    com_span[1u] = vec4<f32>(max_abs, off, 0.0, 0.0);
  }
}

@compute @workgroup_size(64)
fn gpu_pack_octant_particles(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.count) { return; }
  let pm = src_raw[i * params.stride_vec4 + 0u];
  if (!(pm.w > 0.0)) {
    out_particles[i] = MultipoleParticleInput(0u, 0u, 0.0, 0.0, vec3<f32>(0.0), 0.0);
    return;
  }
  let com = com_span[0u].xyz;
  let off = com_span[1u].y;
  let rel = pm.xyz - com;
  let bx = select(0u, 1u, rel.x >= 0.0);
  let by = select(0u, 1u, rel.y >= 0.0);
  let bz = select(0u, 1u, rel.z >= 0.0);
  let oct_idx = (bz << 2u) | (by << 1u) | bx;
  let chart_id = 1u + oct_idx;
  let ox = select(-1.0, 1.0, bx == 1u) * off;
  let oy = select(-1.0, 1.0, by == 1u) * off;
  let oz = select(-1.0, 1.0, bz == 1u) * off;
  atomicAdd(&octant_counts[oct_idx], 1u);
  out_particles[i] = MultipoleParticleInput(
    chart_id,
    1u,
    pm.w * params.mass_scale_kg,
    params.temperature_k,
    vec3<f32>(rel.x - ox, rel.y - oy, rel.z - oz),
    1.0
  );
}
`;

/**
 * Partition an arbitrary 3D astrophysics body/particle buffer (`GPUBuffer` or
 * `Float32Array`, stride 8 for galactic or stride 16 for stellar) into canonical
 * COM-relative octant charts inside a `SchroederScaleAtlas` strictly on GPU
 * (zero CPU particle subsampling or binning loops!) and execute the parallel
 * `@workgroup_size(64)` `SchroederScaleAtlas` multipole kernels.
 */
export async function evaluateAstrophysicsScaleAtlasMultipoleWebGpu(device, {
  particleData = null,
  particleBuffer = null,
  particleCount = null,
  strideFloats = 8,
  targetGlobalLevel = 35,
  referenceSpacingM = 1.0,
  massScaleKg = 1.0,
  temperatureK = 5800,
  gravityG = GRAVITATIONAL_CONSTANT_SI,
  thetaMax = 0.65
} = {}) {
  if (!device || typeof device.createBuffer !== 'function') {
    throw new TypeError('evaluateAstrophysicsScaleAtlasMultipoleWebGpu requires a live WebGPU GPUDevice');
  }
  const hasHostData = particleData instanceof Float32Array && particleData.length >= strideFloats;
  const hasGpuBuf = Boolean(particleBuffer && Number(particleCount) >= 2);
  if (!hasHostData && !hasGpuBuf) {
    throw new TypeError('evaluateAstrophysicsScaleAtlasMultipoleWebGpu requires particleData (Float32Array) or particleBuffer + particleCount');
  }
  const totalCount = hasGpuBuf
    ? Math.trunc(Number(particleCount))
    : Math.floor(particleData.length / strideFloats);
  if (totalCount < 2) {
    throw new RangeError('At least 2 massive particles are required for Scale Atlas multipole coupling');
  }
  const strideVec4 = Math.max(2, Math.trunc(strideFloats / 4));

  const ownedSrcBuf = hasGpuBuf
    ? null
    : device.createBuffer({
      label: 'ulg-scale-atlas-bridge-src',
      size: Math.max(32, particleData.byteLength),
      usage: USAGE_STORAGE | USAGE_COPY_DST
    });
  if (ownedSrcBuf) device.queue.writeBuffer(ownedSrcBuf, 0, particleData);
  const srcBuf = ownedSrcBuf || particleBuffer;

  const comSpanBuf = device.createBuffer({ size: 32, usage: USAGE_STORAGE | USAGE_COPY_SRC });
  const comSpanReadBuf = device.createBuffer({ size: 32, usage: USAGE_MAP_READ | USAGE_COPY_DST });
  const octantCountsBuf = device.createBuffer({ size: 32, usage: USAGE_STORAGE | USAGE_COPY_SRC });
  const octantCountsReadBuf = device.createBuffer({ size: 32, usage: USAGE_MAP_READ | USAGE_COPY_DST });
  const packedPartBuf = device.createBuffer({
    label: 'ulg-scale-atlas-bridge-packed-particles',
    size: totalCount * 32,
    usage: USAGE_STORAGE | USAGE_COPY_SRC
  });
  const binParamsBuf = device.createBuffer({ size: 32, usage: USAGE_UNIFORM | USAGE_COPY_DST });

  const binBindings = [
    computeBufferBinding(0, 'read-only-storage'),
    computeBufferBinding(1, 'storage'),
    computeBufferBinding(2, 'storage'),
    computeBufferBinding(3, 'storage'),
    computeBufferBinding(4, 'uniform')
  ];
  const comSpanPipe = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-scale-atlas-bridge-com-span.v1',
    label: 'ulg-scale-atlas-bridge-com-span',
    code: gpuOctantBinningWgsl,
    entryPoint: 'gpu_com_and_span',
    bindings: binBindings
  });
  const packPipe = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-scale-atlas-bridge-pack.v1',
    label: 'ulg-scale-atlas-bridge-pack',
    code: gpuOctantBinningWgsl,
    entryPoint: 'gpu_pack_octant_particles',
    bindings: binBindings
  });

  // Multipole pipelines (canonical parallel @workgroup_size(64) from schroederScaleAtlasMultipoleGpu.js)
  const mpBindings = [
    computeBufferBinding(0, 'read-only-storage'),
    computeBufferBinding(1, 'read-only-storage'),
    computeBufferBinding(2, 'storage'),
    computeBufferBinding(3, 'storage'),
    computeBufferBinding(4, 'storage'),
    computeBufferBinding(5, 'uniform')
  ];
  const mkMp = (ep) => createCachedExplicitComputePipeline(device, {
    cacheKey: `ulg-scale-atlas-mp-${ep}.v2-wg64`,
    label: `ulg-scale-atlas-mp-${ep}`,
    code: schroederScaleAtlasMultipoleWgsl,
    entryPoint: ep,
    bindings: mpBindings
  });
  const initPipe = mkMp('init_multipole_receipt');
  const reducePipe = mkMp('reduce_chart_multipoles');
  const couplePipe = mkMp('evaluate_cross_chart_coupling');
  const sealPipe = mkMp('seal_multipole_receipt');

  const chartCount = 9; // root chart 0 + 8 octant charts (chart_id 1..8)
  const momentByteLength = chartCount * 96;
  const outputByteLength = chartCount * 32;
  const chartBuf = device.createBuffer({ size: chartCount * 64, usage: USAGE_STORAGE | USAGE_COPY_DST });
  const momentBuf = device.createBuffer({ size: momentByteLength, usage: USAGE_STORAGE | USAGE_COPY_SRC });
  const outputBuf = device.createBuffer({ size: outputByteLength, usage: USAGE_STORAGE | USAGE_COPY_SRC });
  const receiptBuf = device.createBuffer({ size: SCHROEDER_MULTIPOLE_RECEIPT_BYTES, usage: USAGE_STORAGE | USAGE_COPY_SRC });
  const mpParamsBuf = device.createBuffer({ size: 32, usage: USAGE_UNIFORM | USAGE_COPY_DST });
  const readReceipt = device.createBuffer({ size: SCHROEDER_MULTIPOLE_RECEIPT_BYTES, usage: USAGE_MAP_READ | USAGE_COPY_DST });
  const readOutputs = device.createBuffer({ size: outputByteLength, usage: USAGE_MAP_READ | USAGE_COPY_DST });

  try {
    // 1. GPU-side COM reduction + span + parallel octant-chart binning (ZERO CPU loops!)
    const bp = new ArrayBuffer(32);
    new Uint32Array(bp, 0, 4).set([totalCount, strideVec4, 0, 0]);
    new Float32Array(bp, 16, 4).set([massScaleKg, temperatureK, 1.0, 0]);
    device.queue.writeBuffer(binParamsBuf, 0, bp);

    const binBg = createCachedExplicitBindGroup(device, {
      layout: comSpanPipe.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: srcBuf } },
        { binding: 1, resource: { buffer: comSpanBuf } },
        { binding: 2, resource: { buffer: packedPartBuf } },
        { binding: 3, resource: { buffer: octantCountsBuf } },
        { binding: 4, resource: { buffer: binParamsBuf } }
      ]
    });
    const enc1 = device.createCommandEncoder({ label: 'ulg-scale-atlas-bridge-bin' });
    const pass1 = enc1.beginComputePass({ label: 'ulg-scale-atlas-bridge-bin-pass' });
    pass1.setBindGroup(0, binBg);
    pass1.setPipeline(comSpanPipe.pipeline);
    pass1.dispatchWorkgroups(1);
    pass1.setPipeline(packPipe.pipeline);
    pass1.dispatchWorkgroups(Math.ceil(totalCount / 64));
    pass1.end();
    enc1.copyBufferToBuffer(comSpanBuf, 0, comSpanReadBuf, 0, 32);
    enc1.copyBufferToBuffer(octantCountsBuf, 0, octantCountsReadBuf, 0, 32);
    device.queue.submit([enc1.finish()]);

    await Promise.all([comSpanReadBuf.mapAsync(1), octantCountsReadBuf.mapAsync(1)]);
    const csF32 = new Float32Array(comSpanReadBuf.getMappedRange().slice(0, 32));
    const octU32 = new Uint32Array(octantCountsReadBuf.getMappedRange().slice(0, 32));
    comSpanReadBuf.unmap();
    octantCountsReadBuf.unmap();

    const cx = csF32[0]; const cy = csF32[1]; const cz = csF32[2]; const mTot = csF32[3];
    const octantOffset = Math.max(1.0, csF32[5]);
    if (!(mTot > 0)) {
      throw new RangeError('At least 2 massive particles are required for Scale Atlas multipole coupling');
    }

    // 2. Construct canonical 9-chart SchroederScaleAtlas (root 0 + 8 octant charts 1..8)
    const runtime = createDynamicSchroederScaleAtlasRuntime({
      referenceSpacingM,
      rootGlobalBaseLevel: targetGlobalLevel,
      rootLocalMinLevel: 0,
      rootLocalMaxLevel: 2
    });
    let occupiedChartCount = 0;
    for (let octIdx = 0; octIdx < 8; octIdx += 1) {
      const ox = ((octIdx & 1) ? 1 : -1) * octantOffset;
      const oy = ((octIdx & 2) ? 1 : -1) * octantOffset;
      const oz = ((octIdx & 4) ? 1 : -1) * octantOffset;
      runtime.ensureChartForScaleLevel({
        targetGlobalLevel,
        originInParentUnits: [ox, oy, oz],
        parentChartId: 0,
        localSpanLevels: 2
      });
      if (octU32[octIdx] > 0) occupiedChartCount += 1;
    }
    const atlas = runtime.snapshotAtlas();
    const packedCharts = packSchroederScaleAtlasChartTable(atlas);
    device.queue.writeBuffer(chartBuf, 0, packedCharts);

    const mpParamBytes = new ArrayBuffer(32);
    const pv = new DataView(mpParamBytes);
    pv.setUint32(0, totalCount >>> 0, true);
    pv.setUint32(4, atlas.chartCount >>> 0, true);
    pv.setFloat32(8, Number(atlas.referenceSpacingM ?? 1.0), true);
    pv.setFloat32(12, Number(thetaMax), true);
    pv.setFloat32(16, Number(gravityG), true);
    pv.setFloat32(20, STEFAN_BOLTZMANN_SI, true);
    pv.setFloat32(24, 1e-3, true);
    pv.setUint32(28, 0, true);
    device.queue.writeBuffer(mpParamsBuf, 0, mpParamBytes);

    // 3. Dispatch canonical parallel @workgroup_size(64) SchroederScaleAtlas multipole directly on GPU-binned buffer!
    const mpEntries = [
      { binding: 0, resource: { buffer: chartBuf } },
      { binding: 1, resource: { buffer: packedPartBuf } },
      { binding: 2, resource: { buffer: momentBuf } },
      { binding: 3, resource: { buffer: outputBuf } },
      { binding: 4, resource: { buffer: receiptBuf } },
      { binding: 5, resource: { buffer: mpParamsBuf } }
    ];
    const mpBg = createCachedExplicitBindGroup(device, { layout: initPipe.bindGroupLayout, entries: mpEntries });
    const enc2 = device.createCommandEncoder({ label: 'ulg-scale-atlas-bridge-mp' });
    const pass2 = enc2.beginComputePass({ label: 'ulg-scale-atlas-bridge-mp-pass' });
    pass2.setBindGroup(0, mpBg);
    pass2.setPipeline(initPipe.pipeline);
    pass2.dispatchWorkgroups(1);
    pass2.setPipeline(reducePipe.pipeline);
    pass2.dispatchWorkgroups(atlas.chartCount);
    pass2.setPipeline(couplePipe.pipeline);
    pass2.dispatchWorkgroups(Math.max(1, Math.ceil(atlas.chartCount / 64)));
    pass2.setPipeline(sealPipe.pipeline);
    pass2.dispatchWorkgroups(1);
    pass2.end();
    enc2.copyBufferToBuffer(receiptBuf, 0, readReceipt, 0, SCHROEDER_MULTIPOLE_RECEIPT_BYTES);
    enc2.copyBufferToBuffer(outputBuf, 0, readOutputs, 0, outputByteLength);
    device.queue.submit([enc2.finish()]);

    await Promise.all([readReceipt.mapAsync(1), readOutputs.mapAsync(1)]);
    const rBytes = readReceipt.getMappedRange().slice(0);
    const oBytes = readOutputs.getMappedRange().slice(0);
    readReceipt.unmap();
    readOutputs.unmap();

    const rWords = new Uint32Array(rBytes);
    const rView = new DataView(rBytes);
    const oView = new DataView(oBytes);
    const chartOutputs = [];
    for (let i = 0; i < atlas.chartCount; i += 1) {
      const b = i * 32;
      chartOutputs.push(Object.freeze({
        chartId: atlas.charts[i].chartId,
        netForceN: Object.freeze([
          oView.getFloat32(b + 0, true),
          oView.getFloat32(b + 4, true),
          oView.getFloat32(b + 8, true)
        ]),
        netRadiativePowerW: oView.getFloat32(b + 12, true),
        gravityPotentialJ: oView.getFloat32(b + 16, true),
        coupledPairCount: oView.getUint32(b + 20, true),
        farFieldPairCount: oView.getUint32(b + 24, true),
        nearFieldSkippedCount: oView.getUint32(b + 28, true)
      }));
    }

    return Object.freeze({
      schema: ULG_SCALE_ATLAS_ASTROPHYSICS_GRAVITY_SCHEMA,
      multipoleSchema: ULG_SCHROEDER_SCALE_ATLAS_MULTIPOLE_SCHEMA,
      gpuBinned: true,
      gpuBinnedAllParticles: true,
      targetGlobalLevel,
      sampledParticleCount: totalCount,
      occupiedChartCount,
      comWorld: Object.freeze([cx, cy, cz]),
      totalMassKg: mTot * massScaleKg,
      atlasSummary: runtime.summary(),
      receipt: Object.freeze({
        magic: rWords[0],
        status: rWords[1],
        errorMask: rWords[2],
        reducedParticleCount: rWords[3],
        coupledPairDirectedCount: rWords[4],
        farFieldPairDirectedCount: rWords[5],
        momentumRelError: rView.getFloat32(24, true),
        radiativeRelError: rView.getFloat32(28, true),
        verified: rWords[0] === SCHROEDER_MULTIPOLE_RECEIPT_MAGIC && rWords[1] === 3 && rWords[2] === 0
      }),
      chartOutputs: Object.freeze(chartOutputs)
    });
  } finally {
    ownedSrcBuf?.destroy();
    comSpanBuf.destroy();
    comSpanReadBuf.destroy();
    octantCountsBuf.destroy();
    octantCountsReadBuf.destroy();
    packedPartBuf.destroy();
    binParamsBuf.destroy();
    chartBuf.destroy();
    momentBuf.destroy();
    outputBuf.destroy();
    receiptBuf.destroy();
    mpParamsBuf.destroy();
    readReceipt.destroy();
    readOutputs.destroy();
  }
}
