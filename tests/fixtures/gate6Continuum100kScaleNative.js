import {
  createSphReactionProductEventCompactWgsl,
  mlsMpmResidentSummaryFinalizeWgsl,
  sphReactionProductEventCompactWgsl,
  sphReactionProductEventPlacementEnvelopeWgsl,
  sphReactionSummaryFinalizeWgsl
} from '../../ulg-gpu-abi/src/wgsl.js';
import { sphReactionProductSpareGroupScanWgsl } from '../../ulg-gpu-abi/src/sphReactionProductEventSpatialClassificationWgsl.js';
import { schroederSplitSpareLineageScanWgsl } from '../../src/runtime/sph/schroederSplitSpareLineageScanGpu.js';
import { sphExactParcelTransportLedgerWgsl } from '../../src/runtime/sph/sphExactParcelTransportLedgerGpu.js';
import { webGpuSerialRadixHistogramScanWgsl } from '../../src/runtime/webgpuRadixScanUnique.js';
import { createReferenceMaterialClosures } from '../../src/runtime/material/materialClosures.js';
import { specificInternalEnergyJPerKg } from '../../src/runtime/material/thermoState.js';
import {
  buildMlsMpmGpuParticleBuffers,
  buildSphGpuParticleBuffers,
  uploadMlsMpmGpuParticleBuffers,
  uploadSphGpuParticleBuffers
} from '../../src/runtime/sph/sphGpuBuffers.js';
import {
  MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_FINAL_ONLY,
  destroyMlsMpmResidentStepBuffers,
  runMlsMpmResidentStepsWithOptionalWebGpu
} from '../../src/runtime/sph/sphMlsMpmGpuStep.js';

async function checkWgslCompile(device, label, code) {
  const mod = device.createShaderModule({ label, code });
  const info = await mod.getCompilationInfo();
  const errors = info.messages
    .filter((m) => m.type === 'error')
    .map((m) => `${label}:${m.lineNum}:${m.linePos} ${m.message}`);
  return errors;
}

export async function runGate6Continuum100kScaleNative({ particleCount = 100000, warmupSteps = 8, measuredSteps = 16 } = {}) {
  if (!navigator.gpu) return { status: 'unsupported' };
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) return { status: 'unsupported' };
  const device = await adapter.requestDevice({
    requiredLimits: {
      maxStorageBuffersPerShaderStage: Math.min(16, adapter.limits.maxStorageBuffersPerShaderStage),
      maxStorageBufferBindingSize: Math.min(256 * 1024 * 1024, adapter.limits.maxStorageBufferBindingSize),
      maxBufferSize: Math.min(256 * 1024 * 1024, adapter.limits.maxBufferSize)
    }
  });
  const uncapturedErrors = [];
  device.addEventListener('uncapturederror', (e) => uncapturedErrors.push(e.error?.message || String(e)));
  device.pushErrorScope('validation');

  // 1. Verify EVERY newly parallelized Phase B WGSL shader compiles cleanly (incl. WGSL uniformity rules!)
  const shaderChecks = [
    ['schroederSplitSpareLineageScanWgsl', schroederSplitSpareLineageScanWgsl],
    ['sphReactionProductEventCompactWgsl', sphReactionProductEventCompactWgsl],
    ['exactCompanionCompactWgsl', createSphReactionProductEventCompactWgsl({ exactCompanion: { massWordCount: 9 } })],
    ['sphReactionProductEventPlacementEnvelopeWgsl', sphReactionProductEventPlacementEnvelopeWgsl],
    ['sphReactionSummaryFinalizeWgsl', sphReactionSummaryFinalizeWgsl],
    ['mlsMpmResidentSummaryFinalizeWgsl', mlsMpmResidentSummaryFinalizeWgsl],
    ['sphReactionProductSpareGroupScanWgsl', sphReactionProductSpareGroupScanWgsl],
    ['sphExactParcelTransportLedgerWgsl', sphExactParcelTransportLedgerWgsl],
    ['webGpuSerialRadixHistogramScanWgsl', webGpuSerialRadixHistogramScanWgsl]
  ];
  const compileErrors = [];
  for (const [label, code] of shaderChecks) {
    const errs = await checkWgslCompile(device, `gate6-b-${label}`, code);
    compileErrors.push(...errs);
  }

  // 2. Construct 100,000 live continuum H2O carriers (50 x 40 x 50 quiescent tank)
  const closures = createReferenceMaterialClosures();
  const h2oProps = closures.h2o.properties;
  const materialProperties = { h2o: h2oProps };
  const nx = 50;
  const ny = 40;
  const nz = Math.max(1, Math.round(particleCount / (nx * ny)));
  const totalN = nx * ny * nz;
  const boxDimsM = [5.0, 4.0, 5.0];
  const gridSpacingM = 0.2;
  const dx = 3.2 / nx;
  const dy = 2.4 / ny;
  const dz = 3.2 / nz;
  const cellVol = dx * dy * dz;
  const rho0 = 997.0;
  const massPerParticle = rho0 * cellVol;
  const u300 = specificInternalEnergyJPerKg(h2oProps, 300);

  const particles = new Array(totalN);
  let idx = 0;
  for (let iz = 0; iz < nz; iz += 1) {
    for (let iy = 0; iy < ny; iy += 1) {
      for (let ix = 0; ix < nx; ix += 1) {
        particles[idx] = {
          id: `w${idx}`,
          material: 'h2o',
          massKg: massPerParticle,
          x: [0.9 + (ix + 0.5) * dx, 0.4 + (iy + 0.5) * dy, 0.9 + (iz + 0.5) * dz],
          v: [0, 0, 0],
          specificInternalEnergyJPerKg: u300
        };
        idx += 1;
      }
    }
  }

  const initial = {
    smoothingLengthM: gridSpacingM,
    dimension: 3,
    step: 0,
    time: 0,
    storageGeneration: 1,
    particles
  };

  const packedSph = buildSphGpuParticleBuffers(initial, { materialProperties });
  const packedMls = buildMlsMpmGpuParticleBuffers(initial, {
    materialProperties,
    particleSeparationRelaxation: 0
  });

  // Verify storage buffer binding limit compliance BEFORE upload
  const maxBindingBytes = device.limits.maxStorageBufferBindingSize;
  const maxParticleBufBytes = Math.max(
    packedSph.state.byteLength,
    packedSph.thermo.byteLength,
    packedMls.mechanics.byteLength
  );
  if (maxParticleBufBytes > maxBindingBytes) {
    throw new RangeError(`100K particle buffer (${maxParticleBufBytes}) exceeds maxStorageBufferBindingSize (${maxBindingBytes})`);
  }

  let sphUpload = uploadSphGpuParticleBuffers(device, packedSph);
  let mlsUpload = uploadMlsMpmGpuParticleBuffers(device, packedMls);

  // Warmup burst (populates cached pipelines, bind groups, and GPU pools)
  const commonOpts = {
    device,
    sphParticleState: packedSph,
    mlsMpmParticleState: packedMls,
    boxDimsM,
    gridSpacingM,
    dt: 0.001,
    gravityMPerS2: [0, -9.81, 0],
    preferWebGpu: true,
    readbackMode: 'no-full-readback',
    compactSummaryMode: MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_FINAL_ONLY,
    fuseNoFullResidentMechanics: true,
    fuseNoFullResidentMechanicsSequence: true,
    retainOutputParticleBuffers: true,
    contactSolverEnabled: false,
    gasPressureMechanicsBoundaryEnabled: false,
    thermalStepOptions: null,
    reactionStepOptions: null
  };

  const warmRes = await runMlsMpmResidentStepsWithOptionalWebGpu({
    ...commonOpts,
    sphParticleUpload: sphUpload,
    mlsMpmParticleUpload: mlsUpload,
    stepCount: warmupSteps
  });
  await device.queue.onSubmittedWorkDone();

  // Instrument submits, compute passes, createBuffer, and mapAsync during measured K-step burst
  let submits = 0;
  let computePasses = 0;
  let buffersCreated = 0;
  let mapAsyncCalls = 0;
  const origSubmit = device.queue.submit.bind(device.queue);
  const origCreateBuffer = device.createBuffer.bind(device);
  const origCreateEncoder = device.createCommandEncoder.bind(device);
  const origMapAsync = GPUBuffer.prototype.mapAsync;

  device.queue.submit = (cbs) => {
    submits += 1;
    return origSubmit(cbs);
  };
  device.createBuffer = (desc) => {
    buffersCreated += 1;
    return origCreateBuffer(desc);
  };
  device.createCommandEncoder = (desc) => {
    const enc = origCreateEncoder(desc);
    const origBegin = enc.beginComputePass.bind(enc);
    enc.beginComputePass = (pdesc) => {
      computePasses += 1;
      return origBegin(pdesc);
    };
    return enc;
  };
  GPUBuffer.prototype.mapAsync = function patchedMapAsync(...args) {
    mapAsyncCalls += 1;
    return origMapAsync.apply(this, args);
  };

  let measuredRes;
  let elapsedMs = 0;
  try {
    const t0 = performance.now();
    measuredRes = await runMlsMpmResidentStepsWithOptionalWebGpu({
      ...commonOpts,
      sphParticleUpload: warmRes.nextParticleUploads?.sphParticleUpload ?? sphUpload,
      mlsMpmParticleUpload: warmRes.nextParticleUploads?.mlsMpmParticleUpload ?? mlsUpload,
      stepCount: measuredSteps
    });
    await device.queue.onSubmittedWorkDone();
    elapsedMs = performance.now() - t0;
  } finally {
    device.queue.submit = origSubmit;
    device.createBuffer = origCreateBuffer;
    device.createCommandEncoder = origCreateEncoder;
    GPUBuffer.prototype.mapAsync = origMapAsync;
  }

  const summary = measuredRes?.finalStep?.compactGpuSummary
    ?? measuredRes?.finalStep?.diagnostics
    ?? measuredRes?.stepSummaries?.[measuredRes.stepSummaries.length - 1]
    ?? null;
  const sourceMassKg = Number(summary?.sourceMassKg ?? totalN * massPerParticle);
  const nextMassKg = Number(summary?.nextMassKg ?? sourceMassKg);
  const massRelErr = Math.abs(nextMassKg - sourceMassKg) / Math.max(1e-12, sourceMassKg);

  destroyMlsMpmResidentStepBuffers(warmRes?.finalStep ?? warmRes);
  destroyMlsMpmResidentStepBuffers(measuredRes?.finalStep ?? measuredRes);
  sphUpload?.destroy?.();
  mlsUpload?.destroy?.();

  const valErr = await device.popErrorScope();
  device.destroy();

  return {
    status: 'ok',
    particleCount: totalN,
    fusedSequenceExecuted: Boolean(measuredRes?.fusedNoFullMechanicsSequenceExecuted),
    maxParticleBufBytes,
    maxBindingBytes,
    shaderCountChecked: shaderChecks.length,
    compileErrors,
    validationError: valErr ? valErr.message : null,
    uncapturedErrors,
    measuredSteps,
    elapsedMs,
    msPerStep: elapsedMs / measuredSteps,
    submits,
    submitsPerStep: submits / measuredSteps,
    computePasses,
    passesPerStep: computePasses / measuredSteps,
    buffersCreated,
    mapAsyncCalls,
    sourceMassKg,
    nextMassKg,
    massRelErr,
    maxSpeedMPerS: Number(summary?.maxSpeedMPerS ?? 0),
    minVolumeRatioJ: Number(summary?.minVolumeRatioJ ?? 0),
    maxVolumeRatioJ: Number(summary?.maxVolumeRatioJ ?? 0),
    activeGridNodeCount: Number(summary?.activeGridNodeCount ?? 0),
    summaryStatus: Number(summary?.status ?? 0)
  };
}
