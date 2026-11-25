import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT,
  SPH_GPU_PARTICLE_STATE_ROW_LAYOUT,
  createRepresentedVolumePhaseRetargetLawIr,
  createTaitEosCavitationLawIr,
  representedVolumeFromCurrent,
  writeRepresentedVolumeToMechanicsRow
} from '../../ulg-gpu-abi/src/index.js';
import { compileDeclarativeLawIrToWgsl } from '../../src/runtime/material/eshkolHigherOrderLawCompiler.js';
import { createCanonicalMlsMpmLawDagEpochScheduler } from '../../src/runtime/sph/sphMlsMpmGpuStep.js';
import { sphImplicitPressureCompilationErrors } from '../../src/runtime/sph/sphImplicitPressureGpu.js';
import { schroederPhaseSlotMaterializationWgsl } from '../../src/runtime/sph/schroederPhaseSlotMaterializationGpu.js';

function createBufferWithData(device, label, typedArray, usage) {
  const buf = device.createBuffer({
    label,
    size: Math.max(16, typedArray.byteLength),
    usage: usage | GPUBufferUsage.COPY_DST
  });
  device.queue.writeBuffer(buf, 0, typedArray);
  return buf;
}

async function runTaitLawOnGpu(device, lawIr) {
  const compiled = compileDeclarativeLawIrToWgsl(lawIr);
  const mod = device.createShaderModule({ label: `gate6-${compiled.lawId}`, code: compiled.wgsl });
  const info = await mod.getCompilationInfo();
  const compileErrors = info.messages.filter((m) => m.type === 'error').map((m) => `${m.lineNum}:${m.linePos} ${m.message}`);

  const bgl = device.createBindGroupLayout({
    label: `gate6-bgl-${compiled.lawId}`,
    entries: compiled.bindGroupLayoutEntries
  });
  const pipeline = device.createComputePipeline({
    label: `gate6-pipe-${compiled.lawId}`,
    layout: device.createPipelineLayout({ bindGroupLayouts: [bgl] }),
    compute: { module: mod, entryPoint: compiled.entryPoint }
  });

  // 4 particles: compressed (J=0.90), rest (J=1.0), cavitated (J=1.15), out-of-envelope high (J=5.0)
  const jValues = [0.90, 1.0, 1.15, 5.0];
  const B = 3.04e8;
  const gamma = 7.0;
  const mechStride = MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length; // 32 floats
  const mech = new Float32Array(jValues.length * mechStride);
  for (let i = 0; i < jValues.length; i += 1) {
    const rv = representedVolumeFromCurrent(0.008, 0.008 * jValues[i]);
    writeRepresentedVolumeToMechanicsRow(mech, i * mechStride, rv, MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT);
  }

  // Uniform: [count, generation, pad0, pad1, stiffnessPa, gamma, pad, pad]
  const paramsBufData = new ArrayBuffer(32);
  new Uint32Array(paramsBufData, 0, 4).set([jValues.length, 3, 0, 0]);
  new Float32Array(paramsBufData, 16, 4).set([B, gamma, 0, 0]);

  const paramsBuf = createBufferWithData(device, 'gate6-tait-params', new Uint8Array(paramsBufData), GPUBufferUsage.UNIFORM);
  const mechBuf = createBufferWithData(device, 'gate6-tait-mech', mech, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
  const receiptBuf = createBufferWithData(device, 'gate6-tait-receipt', new Uint32Array(8), GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
  const readMech = device.createBuffer({ size: mech.byteLength, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
  const readReceipt = device.createBuffer({ size: 32, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });

  try {
    const bg = device.createBindGroup({
      layout: bgl,
      entries: [
        { binding: 0, resource: { buffer: paramsBuf } },
        { binding: 1, resource: { buffer: mechBuf } },
        { binding: 2, resource: { buffer: receiptBuf } }
      ]
    });
    const enc = device.createCommandEncoder({ label: `gate6-enc-${compiled.lawId}` });
    const pass = enc.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(1);
    pass.end();
    enc.copyBufferToBuffer(mechBuf, 0, readMech, 0, mech.byteLength);
    enc.copyBufferToBuffer(receiptBuf, 0, readReceipt, 0, 32);
    device.queue.submit([enc.finish()]);

    await Promise.all([readMech.mapAsync(GPUMapMode.READ), readReceipt.mapAsync(GPUMapMode.READ)]);
    const outMech = new Float32Array(readMech.getMappedRange().slice(0));
    const receipt = Array.from(new Uint32Array(readReceipt.getMappedRange().slice(0)));
    readMech.unmap();
    readReceipt.unmap();

    const pIdx = MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.findIndex((s) => s.startsWith('resolvedAbsolutePressurePa:'));
    const kIdx = MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.findIndex((s) => s.startsWith('effectiveBulkModulusPa:'));
    const samples = jValues.map((j, i) => ({
      j,
      pressurePa: outMech[i * mechStride + pIdx],
      bulkModulusPa: outMech[i * mechStride + kIdx]
    }));
    return { compileErrors, samples, receipt };
  } finally {
    for (const b of [paramsBuf, mechBuf, receiptBuf, readMech, readReceipt]) b.destroy();
  }
}

export async function runGate6PhaseALawCompilerNative({ eshkolCEmittedLawIr = null } = {}) {
  if (!navigator.gpu) return { status: 'unsupported' };
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) return { status: 'unsupported' };
  const device = await adapter.requestDevice({
    requiredLimits: {
      maxStorageBuffersPerShaderStage: Math.min(16, adapter.limits.maxStorageBuffersPerShaderStage)
    }
  });
  const uncapturedErrors = [];
  device.addEventListener('uncapturederror', (e) => uncapturedErrors.push(e.error?.message || String(e)));

  device.pushErrorScope('validation');

  // 1. Run built-in JS Law-IR Tait EOS + symbolic AD on Vulkan
  const builtinTait = await runTaitLawOnGpu(device, createTaitEosCavitationLawIr());

  // 2. Run C-emitted Law-IR JSON directly from ../eshkol/lib/backend/vm_wgsl_emitter.c on Vulkan!
  const eshkolCTait = eshkolCEmittedLawIr ? await runTaitLawOnGpu(device, eshkolCEmittedLawIr) : null;

  // 3. Run paired RepresentedVolume phase retargeting Law-IR on Vulkan
  const retargetCompiled = compileDeclarativeLawIrToWgsl(createRepresentedVolumePhaseRetargetLawIr());
  const retargetMod = device.createShaderModule({ label: 'gate6-retarget', code: retargetCompiled.wgsl });
  const retargetInfo = await retargetMod.getCompilationInfo();
  const retargetCompileErrors = retargetInfo.messages.filter((m) => m.type === 'error').map((m) => `${m.lineNum}:${m.linePos} ${m.message}`);
  const retargetBgl = device.createBindGroupLayout({ entries: retargetCompiled.bindGroupLayoutEntries });
  const retargetPipe = device.createComputePipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [retargetBgl] }),
    compute: { module: retargetMod, entryPoint: retargetCompiled.entryPoint }
  });
  const stateStride = SPH_GPU_PARTICLE_STATE_ROW_LAYOUT.length;
  const mechStride = MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length;
  const stateArr = new Float32Array(stateStride);
  stateArr[3] = 8.0; // massKg = 8 kg (0.008 m^3 of water @ 1000 kg/m^3)
  const mechArr = new Float32Array(mechStride);
  writeRepresentedVolumeToMechanicsRow(mechArr, 0, representedVolumeFromCurrent(0.008, 0.008), MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT);
  const rParamsData = new ArrayBuffer(32);
  new Uint32Array(rParamsData, 0, 4).set([1, 5, 0, 0]);
  new Float32Array(rParamsData, 16, 4).set([0.6, 0, 0, 0]); // steam rest density 0.6 kg/m^3

  const rParamsBuf = createBufferWithData(device, 'gate6-r-params', new Uint8Array(rParamsData), GPUBufferUsage.UNIFORM);
  const rStateBuf = createBufferWithData(device, 'gate6-r-state', stateArr, GPUBufferUsage.STORAGE);
  const rMechBuf = createBufferWithData(device, 'gate6-r-mech', mechArr, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
  const rReceiptBuf = createBufferWithData(device, 'gate6-r-receipt', new Uint32Array(8), GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
  const rReadMech = device.createBuffer({ size: mechArr.byteLength, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });

  const scheduler = createCanonicalMlsMpmLawDagEpochScheduler({ epochId: 'vulkan-epoch', epochGeneration: 1 });
  let retargetOut = null;
  let dagReceipt = null;
  try {
    dagReceipt = await scheduler.executeEpoch(
      {
        'phase-carrier-transfer': async ({ leaseScope }) => {
          const lease = leaseScope.issue(rParamsBuf, {
            label: 'retarget-params',
            producer: 'phase-carrier-transfer',
            onRelease: (b) => b.destroy()
          });
          const bg = device.createBindGroup({
            layout: retargetBgl,
            entries: [
              { binding: 0, resource: { buffer: rParamsBuf } },
              { binding: 1, resource: { buffer: rStateBuf } },
              { binding: 2, resource: { buffer: rMechBuf } },
              { binding: 3, resource: { buffer: rReceiptBuf } }
            ]
          });
          const enc = device.createCommandEncoder({ label: 'gate6-retarget-enc' });
          const pass = enc.beginComputePass();
          pass.setPipeline(retargetPipe);
          pass.setBindGroup(0, bg);
          pass.dispatchWorkgroups(1);
          pass.end();
          enc.copyBufferToBuffer(rMechBuf, 0, rReadMech, 0, mechArr.byteLength);
          device.queue.submit([enc.finish()]);
          await rReadMech.mapAsync(GPUMapMode.READ);
          const out = new Float32Array(rReadMech.getMappedRange().slice(0));
          rReadMech.unmap();
          const jIdx = MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.findIndex((s) => s.startsWith('volumeRatioJ:'));
          const v0Idx = MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.findIndex((s) => s.startsWith('restVolumeM3:'));
          retargetOut = { v0: out[v0Idx], j: out[jIdx], vCurrent: out[v0Idx] * out[jIdx] };
          leaseScope.release(lease, { by: 'phase-carrier-transfer' });
          return { status: 'executed' };
        }
      },
      { requireAllReleased: true }
    );
  } finally {
    for (const b of [rStateBuf, rMechBuf, rReceiptBuf, rReadMech]) b.destroy();
  }

  // 4. Verify live upgraded continuum shaders compile cleanly on real Vulkan!
  const implicitPressureErrors = await sphImplicitPressureCompilationErrors(device);
  const psmMod = device.createShaderModule({ label: 'gate6-psm-check', code: schroederPhaseSlotMaterializationWgsl });
  const psmInfo = await psmMod.getCompilationInfo();
  const phaseSlotMaterializationErrors = psmInfo.messages
    .filter((m) => m.type === 'error')
    .map((m) => `${m.lineNum}:${m.linePos} ${m.message}`);

  const valErr = await device.popErrorScope();
  device.destroy();

  return {
    status: 'ok',
    validationError: valErr ? valErr.message : null,
    uncapturedErrors,
    builtinTait,
    eshkolCTait,
    retargetCompileErrors,
    retargetOut,
    dagReceipt,
    implicitPressureErrors,
    phaseSlotMaterializationErrors
  };
}
