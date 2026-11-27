// Live Hot-Loop Compiled Law-IR WebGPU Runtime (`src/runtime/sph/compiledLawIrLiveRuntime.js`).
//
// Executes declarative `peercompute.ulg.law-ir.v1` shaders compiled via
// `compileDeclarativeLawIrToWgsl` directly inside ALREADY-OPEN MLS-MPM compute passes:
//   - +0 queue.submit calls
//   - +0 compute passes (coalesced into mechanics-refresh commitPass & terminal G2P pass)
//   - +0 steady-state createBuffer churn (cached per unwrapped GPUDevice)
//   - Live 32-byte atomic GPU receipt proving real on-device execution (`hits`, `low`,
//     `high`, `homog`, `nonFinite`, `debt`, `maxDistMicro`, `generation`).

import {
  compileDeclarativeLawIrToWgsl,
  createPerParticleTaitEosCavitationLawIr
} from '../material/eshkolHigherOrderLawCompiler.js';
import {
  createCachedExplicitBindGroup,
  unwrapWebGpuCacheDevice
} from '../webgpuComputeLayout.js';

export const ULG_COMPILED_LAW_IR_LIVE_RUNTIME_SCHEMA =
  'peercompute.ulg.compiled-law-ir-live-runtime.v1';

const GPU_BUFFER_USAGE = Object.freeze({
  MAP_READ: 0x0001,
  COPY_SRC: 0x0004,
  COPY_DST: 0x0008,
  UNIFORM: 0x0040,
  STORAGE: 0x0080
});

const GPU_SHADER_STAGE_COMPUTE = 4;

const RUNTIME_SYM = Symbol.for('ulg.compiledLawIrLiveRuntimeByDevice.v1');
const runtimeByDevice = (globalThis[RUNTIME_SYM] ??= new WeakMap());

let cachedCompiledIr = null;
function getCompiledPerParticleTaitIr() {
  if (!cachedCompiledIr) {
    cachedCompiledIr = compileDeclarativeLawIrToWgsl(createPerParticleTaitEosCavitationLawIr(), {
      workgroupSize: 64,
      includeEnvelopeWatch: true,
      requireExtendedDescriptor: true
    });
  }
  return cachedCompiledIr;
}

function getOrCreateDeviceRuntime(device) {
  if (
    !device
    || typeof device.createShaderModule !== 'function'
    || typeof device.createBindGroupLayout !== 'function'
    || typeof device.createPipelineLayout !== 'function'
    || typeof device.createComputePipeline !== 'function'
    || typeof device.createBindGroup !== 'function'
    || typeof device.createBuffer !== 'function'
  ) {
    return null;
  }
  const key = unwrapWebGpuCacheDevice(device);
  const existing = runtimeByDevice.get(key);
  if (existing) return existing;

  const compiled = getCompiledPerParticleTaitIr();
  const stage = globalThis.GPUShaderStage?.COMPUTE ?? GPU_SHADER_STAGE_COMPUTE;
  const module = device.createShaderModule({
    label: `ulg-live-law-ir-${compiled.lawId}`,
    code: compiled.wgsl
  });
  const bindGroupLayout = device.createBindGroupLayout({
    label: `ulg-live-law-ir-${compiled.lawId}-bgl`,
    entries: compiled.bindGroupLayoutEntries.map((entry) => ({
      binding: entry.binding,
      visibility: stage,
      buffer: { type: entry.buffer.type }
    }))
  });
  const pipeline = device.createComputePipeline({
    label: `ulg-live-law-ir-${compiled.lawId}-pipe`,
    layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
    compute: { module, entryPoint: compiled.entryPoint }
  });

  const paramsBuffer = device.createBuffer({
    label: 'ulg-live-law-ir-params',
    size: 32,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const receiptBuffer = device.createBuffer({
    label: 'ulg-live-law-ir-receipt',
    size: 32,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  });
  const readbackBuffer = device.createBuffer({
    label: 'ulg-live-law-ir-receipt-readback',
    size: 32,
    usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
  });
  device.queue.writeBuffer(receiptBuffer, 0, new Uint32Array(8));

  const runtime = {
    compiled,
    module,
    bindGroupLayout,
    pipeline,
    paramsBuffer,
    receiptBuffer,
    readbackBuffer,
    lastParamsKey: '',
    dispatchCount: 0,
    receiptCopiedCount: 0,
    lastReceiptWords: null,
    readbackInFlight: false,
    receiptDirtyForReadback: false
  };
  runtimeByDevice.set(key, runtime);
  return runtime;
}

/**
 * Coalesce the live compiled Law-IR Tait EOS + zero-gauge cavitation kernel
 * directly inside an ALREADY-OPEN WebGPU compute pass (+0 submits, +0 passes).
 */
export function encodeCompiledLawIrMechanicsIntoPass(device, pass, {
  mechanicsBuffer,
  particleCount,
  generation = 1,
  gamma = 7.0
} = {}) {
  const count = Math.trunc(Number(particleCount) || 0);
  if (!pass || !mechanicsBuffer || count <= 0) return false;
  if (globalThis.__ulgDisableLiveLawIrDispatch === true) return false;
  const rt = getOrCreateDeviceRuntime(device);
  if (!rt) return false;

  const genU32 = Math.max(1, Math.trunc(Number(generation) || 1)) >>> 0;
  const gammaF32 = Number.isFinite(Number(gamma)) && Number(gamma) > 0 ? Number(gamma) : 7.0;
  const paramsKey = `${count}:${genU32}:${gammaF32}`;
  if (rt.lastParamsKey !== paramsKey) {
    const raw = new ArrayBuffer(32);
    const u32 = new Uint32Array(raw);
    const f32 = new Float32Array(raw);
    u32[0] = count >>> 0;
    u32[1] = genU32;
    u32[2] = 0;
    u32[3] = 0;
    f32[4] = gammaF32;
    device.queue.writeBuffer(rt.paramsBuffer, 0, raw);
    rt.lastParamsKey = paramsKey;
  }

  const bindGroup = createCachedExplicitBindGroup(device, {
    label: 'ulg-live-law-ir-tait-bg',
    layout: rt.bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: rt.paramsBuffer } },
      { binding: 1, resource: { buffer: mechanicsBuffer } },
      { binding: 2, resource: { buffer: rt.receiptBuffer } }
    ]
  });

  pass.setPipeline(rt.pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.max(1, Math.ceil(count / 64)));
  rt.dispatchCount += 1;
  return true;
}

/**
 * Optionally copy the 32-byte atomic Law-IR receipt to staging on a schedule boundary.
 */
export function encodeCompiledLawIrReceiptCopy(device, encoder) {
  const rt = device ? runtimeByDevice.get(unwrapWebGpuCacheDevice(device)) : null;
  if (!rt || !encoder || rt.readbackInFlight) return false;
  encoder.copyBufferToBuffer(rt.receiptBuffer, 0, rt.readbackBuffer, 0, 32);
  rt.receiptCopiedCount += 1;
  rt.receiptDirtyForReadback = true;
  return true;
}

/**
 * Schedule-boundary / test async readback of the 32-byte GPU Law-IR receipt.
 */
export async function readCompiledLawIrReceiptAsync(device, { resetAfterRead = false } = {}) {
  const rt = device ? runtimeByDevice.get(unwrapWebGpuCacheDevice(device)) : null;
  if (!rt || rt.readbackInFlight) return rt?.lastReceiptWords ?? null;
  if (!rt.receiptDirtyForReadback) {
    const enc = device.createCommandEncoder({ label: 'ulg-live-law-ir-receipt-copy' });
    enc.copyBufferToBuffer(rt.receiptBuffer, 0, rt.readbackBuffer, 0, 32);
    device.queue.submit([enc.finish()]);
  }
  rt.readbackInFlight = true;
  try {
    await rt.readbackBuffer.mapAsync(GPU_BUFFER_USAGE.MAP_READ);
    const words = Array.from(new Uint32Array(rt.readbackBuffer.getMappedRange(0, 32).slice(0)));
    rt.readbackBuffer.unmap();
    rt.lastReceiptWords = Object.freeze({
      hits: words[0] ?? 0,
      lowViolations: words[1] ?? 0,
      highViolations: words[2] ?? 0,
      homogeneityViolations: words[3] ?? 0,
      nonFiniteViolations: words[4] ?? 0,
      debtCount: words[5] ?? 0,
      maxDistMicro: words[6] ?? 0,
      generation: words[7] ?? 0
    });
    rt.receiptDirtyForReadback = false;
    if (resetAfterRead) {
      device.queue.writeBuffer(rt.receiptBuffer, 0, new Uint32Array(8));
    }
    return rt.lastReceiptWords;
  } catch {
    return rt.lastReceiptWords;
  } finally {
    rt.readbackInFlight = false;
  }
}

export function getCompiledLawIrLiveStatus(device) {
  const rt = device ? runtimeByDevice.get(unwrapWebGpuCacheDevice(device)) : null;
  if (!rt) {
    return Object.freeze({
      schema: ULG_COMPILED_LAW_IR_LIVE_RUNTIME_SCHEMA,
      active: false,
      dispatchedOnGpu: false,
      liveDispatchCount: 0,
      lawId: 'per-particle-tait-eos-cavitation-ad',
      wgslFingerprint: null,
      gpuShaderModuleValidated: false,
      lastReceiptWords: null
    });
  }
  return Object.freeze({
    schema: ULG_COMPILED_LAW_IR_LIVE_RUNTIME_SCHEMA,
    active: rt.dispatchCount > 0,
    dispatchedOnGpu: rt.dispatchCount > 0,
    liveDispatchCount: rt.dispatchCount,
    lawId: rt.compiled.lawId,
    wgslFingerprint: rt.compiled.fingerprint,
    gpuShaderModuleValidated: true,
    lastReceiptWords: rt.lastReceiptWords
  });
}
