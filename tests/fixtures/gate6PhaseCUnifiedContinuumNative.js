import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT,
  SPH_GPU_PARTICLE_STATE_ROW_LAYOUT
} from '../../ulg-gpu-abi/src/index.js';
import { createSphSolidLiquidVelocitySeparationStage } from '../../src/runtime/sph/sphSolidLiquidVelocitySeparationGpu.js';
import { schroederSolidFluidContactSsWgsl } from '../../src/runtime/sph/schroederSolidFluidContactGpu.js';
import { schroederSolidFluidThermalSsWgsl } from '../../src/runtime/sph/schroederSolidFluidThermalGpu.js';
import { createReferenceMaterialClosures } from '../../src/runtime/material/materialClosures.js';
import { specificInternalEnergyJPerKg } from '../../src/runtime/material/thermoState.js';
import {
  buildMlsMpmGpuParticleBuffers,
  buildSphGpuParticleBuffers,
  uploadMlsMpmGpuParticleBuffers,
  uploadSphGpuParticleBuffers
} from '../../src/runtime/sph/sphGpuBuffers.js';
import {
  destroyMlsMpmResidentStepBuffers,
  runMlsMpmResidentStepWithOptionalWebGpu
} from '../../src/runtime/sph/sphMlsMpmGpuStep.js';

async function runSlipCase(device, { offsetM = [0, 0, 0], liquidVel = [2.0, -1.0, 0.0], solidVel = [0.0, 0.0, 0.0] } = {}) {
  // 2x2x2 solid slab below y = offsetM[1] + 1.0, 2x2x2 liquid slab right above at y = offsetM[1] + 1.08
  // Sharing MPM grid nodes at y = 1.0 (gridSpacingM = 0.2)!
  const dx = 0.2;
  const gridDims = [16, 16, 16];
  const shift = 2;
  const stateStride = SPH_GPU_PARTICLE_STATE_ROW_LAYOUT.length; // 8
  const mechStride = MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length; // 32

  const particles = [];
  const solidMass = 0.5;
  const liquidMass = 1.0;
  // Uniform dx/2 = 0.10 m solid slab (exact 2 ppc per axis -> flat interior solid mass density,
  // zero grid-aliasing corrugation, exact vertical outward normal n = (0, +1, 0) under centered liquid!)
  const sp = 0.1;
  for (let ix = -4; ix <= 5; ix += 1) {
    for (let iz = -4; iz <= 5; iz += 1) {
      for (let iy = 0; iy < 3; iy += 1) {
        particles.push({
          solid: true,
          mass: solidMass,
          pos: [offsetM[0] + 1.05 + ix * sp, offsetM[1] + 0.55 + iy * sp, offsetM[2] + 1.05 + iz * sp],
          vel: [...solidVel]
        });
      }
    }
  }
  for (let ix = 0; ix < 2; ix += 1) {
    for (let iz = 0; iz < 2; iz += 1) {
      // Liquid patch centered over the flat interior top of the solid slab
      particles.push({
        solid: false,
        mass: liquidMass,
        pos: [offsetM[0] + 1.05 + ix * sp, offsetM[1] + 0.90, offsetM[2] + 1.05 + iz * sp],
        vel: [...liquidVel]
      });
    }
  }

  const n = particles.length;
  const state = new Float32Array(n * stateStride);
  const mech = new Float32Array(n * mechStride);
  const solidFlagOff = MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.findIndex((s) => s.startsWith('solidFlag:'));
  const eosOff = MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.findIndex((s) => s.startsWith('eosModelId:'));
  const jOff = MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.findIndex((s) => s.startsWith('volumeRatioJ:'));
  const v0Off = MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.findIndex((s) => s.startsWith('restVolumeM3:'));

  let initPx = 0, initPy = 0, initPz = 0;
  for (let i = 0; i < n; i += 1) {
    const p = particles[i];
    state.set([p.pos[0], p.pos[1], p.pos[2], p.mass, p.vel[0], p.vel[1], p.vel[2], 1e5], i * stateStride);
    mech[i * mechStride + solidFlagOff] = p.solid ? 1 : 0;
    mech[i * mechStride + eosOff] = p.solid ? 0 : 1;
    mech[i * mechStride + jOff] = 1;
    mech[i * mechStride + v0Off] = 0.001;
    initPx += p.mass * p.vel[0];
    initPy += p.mass * p.vel[1];
    initPz += p.mass * p.vel[2];
  }

  const stateBuf = device.createBuffer({
    size: state.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
  });
  const mechBuf = device.createBuffer({
    size: mech.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
  });
  const readState = device.createBuffer({ size: state.byteLength, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
  const readReceipt = device.createBuffer({ size: 16, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(stateBuf, 0, state);
  device.queue.writeBuffer(mechBuf, 0, mech);

  const stage = createSphSolidLiquidVelocitySeparationStage(device, {
    gridDims,
    gridSpacingM: dx,
    shift,
    blendAlpha: 1.0
  });

  try {
    const enc = device.createCommandEncoder();
    stage.encode(enc, { stateBuffer: stateBuf, mechanicsBuffer: mechBuf, particleCount: n });
    enc.copyBufferToBuffer(stateBuf, 0, readState, 0, state.byteLength);
    enc.copyBufferToBuffer(stage.receiptBuffer, 0, readReceipt, 0, 16);
    device.queue.submit([enc.finish()]);

    await Promise.all([readState.mapAsync(GPUMapMode.READ), readReceipt.mapAsync(GPUMapMode.READ)]);
    const outState = new Float32Array(readState.getMappedRange().slice(0));
    const receipt = Array.from(new Uint32Array(readReceipt.getMappedRange().slice(0)));
    readState.unmap();
    readReceipt.unmap();

    let finalPx = 0, finalPy = 0, finalPz = 0;
    let meanLiqVx = 0, meanLiqVy = 0, liqCount = 0;
    let meanSolVx = 0, meanSolVy = 0, solCount = 0;
    for (let i = 0; i < n; i += 1) {
      const m = outState[i * stateStride + 3];
      const vx = outState[i * stateStride + 4];
      const vy = outState[i * stateStride + 5];
      const vz = outState[i * stateStride + 6];
      finalPx += m * vx;
      finalPy += m * vy;
      finalPz += m * vz;
      if (particles[i].solid) {
        meanSolVx += vx; meanSolVy += vy; solCount += 1;
      } else {
        meanLiqVx += vx; meanLiqVy += vy; liqCount += 1;
      }
    }
    return {
      receipt,
      momentumBefore: [initPx, initPy, initPz],
      momentumAfter: [finalPx, finalPy, finalPz],
      meanLiquidVel: [meanLiqVx / liqCount, meanLiqVy / liqCount],
      meanSolidVel: [meanSolVx / solCount, meanSolVy / solCount]
    };
  } finally {
    stage.destroy();
    for (const b of [stateBuf, mechBuf, readState, readReceipt]) b.destroy();
  }
}

async function runProductionResidentMixedSolidLiquidStep(device) {
  const closures = createReferenceMaterialClosures();
  const h2oProps = closures.h2o.properties;
  const feProps = closures.fe.properties;
  const materialProperties = { h2o: h2oProps, fe: feProps };
  const uLiquid = specificInternalEnergyJPerKg(h2oProps, 300);
  const uSolid = specificInternalEnergyJPerKg(feProps, 300);
  const particles = [];
  for (let ix = 0; ix < 2; ix += 1) {
    for (let iz = 0; iz < 2; iz += 1) {
      for (let iy = 0; iy < 2; iy += 1) {
        particles.push({
          id: `fe_${ix}_${iy}_${iz}`,
          material: 'fe',
          massKg: 0.25,
          x: [0.8 + ix * 0.15, 0.72 + iy * 0.16, 0.8 + iz * 0.15],
          v: [0, 0, 0],
          specificInternalEnergyJPerKg: uSolid
        });
      }
      particles.push({
        id: `h2o_${ix}_${iz}`,
        material: 'h2o',
        massKg: 0.08,
        x: [0.8 + ix * 0.15, 0.96, 0.8 + iz * 0.15],
        v: [1.5, -0.5, 0],
        specificInternalEnergyJPerKg: uLiquid
      });
    }
  }
  const initial = {
    smoothingLengthM: 0.2,
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
  const sphUpload = uploadSphGpuParticleBuffers(device, packedSph);
  const mlsUpload = uploadMlsMpmGpuParticleBuffers(device, packedMls);
  const prevSteps = globalThis.__ulgSolidLiquidSlipStatus?.steps ?? 0;
  let stepResult = null;
  try {
    stepResult = await runMlsMpmResidentStepWithOptionalWebGpu({
      device,
      sphParticleState: packedSph,
      mlsMpmParticleState: packedMls,
      sphParticleUpload: sphUpload,
      mlsMpmParticleUpload: mlsUpload,
      boxDimsM: [2.4, 2.4, 2.4],
      gridSpacingM: 0.2,
      dt: 0.0005,
      gravityMPerS2: [0, -9.81, 0],
      preferWebGpu: true,
      readbackMode: 'no-full-readback',
      fuseNoFullResidentMechanics: true,
      retainOutputParticleBuffers: true,
      contactSolverEnabled: false,
      gasPressureMechanicsBoundaryEnabled: false,
      thermalStepOptions: null,
      reactionStepOptions: null
    });
    await device.queue.onSubmittedWorkDone();
    const status = globalThis.__ulgSolidLiquidSlipStatus ?? null;
    return {
      executedStepsDelta: (status?.steps ?? 0) - prevSteps,
      sharedEncoder: Boolean(status?.sharedEncoder),
      lastParticleCount: Number(status?.lastParticleCount ?? 0),
      dispatches: Number(status?.dispatches ?? 0),
      stepBackend: String(stepResult?.backend ?? '')
    };
  } finally {
    if (stepResult) destroyMlsMpmResidentStepBuffers(stepResult);
    sphUpload?.destroy?.();
    mlsUpload?.destroy?.();
  }
}

export async function runGate6PhaseCUnifiedContinuumNative() {
  if (!navigator.gpu) return { status: 'unsupported', reason: 'navigator.gpu unavailable' };
  let adapter = null;
  for (let attempt = 0; attempt < 8 && !adapter; attempt += 1) {
    adapter = await navigator.gpu.requestAdapter();
    if (!adapter) await new Promise((r) => setTimeout(r, 250));
  }
  if (!adapter) return { status: 'unsupported', reason: 'requestAdapter returned null after 8 attempts' };
  const device = await adapter.requestDevice({
    requiredLimits: {
      maxStorageBuffersPerShaderStage: Math.min(16, adapter.limits.maxStorageBuffersPerShaderStage)
    }
  });
  const uncapturedErrors = [];
  device.addEventListener('uncapturederror', (e) => uncapturedErrors.push(e.error?.message || String(e)));
  device.pushErrorScope('validation');

  // Verify zero-private-grid canonical SS solid-fluid shaders compile cleanly
  const compileErrors = [];
  for (const [label, code] of [
    ['solidFluidContactSs', schroederSolidFluidContactSsWgsl],
    ['solidFluidThermalSs', schroederSolidFluidThermalSsWgsl]
  ]) {
    const info = await device.createShaderModule({ label, code }).getCompilationInfo();
    for (const m of info.messages) {
      if (m.type === 'error') compileErrors.push(`${label}:${m.lineNum}:${m.linePos} ${m.message}`);
    }
  }

  // Case 1: Approaching + tangential liquid over stationary solid (unilateral normal impact + frictionless tangential slip!)
  const approaching = await runSlipCase(device, { offsetM: [0, 0, 0], liquidVel: [2.0, -1.0, 0.0], solidVel: [0.0, 0.0, 0.0] });
  // Case 2: Off-origin shifted copy (+0.4 m, +0.4 m, +0.4 m) proving translation invariance!
  const shifted = await runSlipCase(device, { offsetM: [0.4, 0.4, 0.4], liquidVel: [2.0, -1.0, 0.0], solidVel: [0.0, 0.0, 0.0] });
  // Case 3: Separating liquid moving AWAY from solid (+Y) + tangential (+X) -> ZERO artificial solid-liquid suction/sticking!
  const separating = await runSlipCase(device, { offsetM: [0, 0, 0], liquidVel: [2.0, +1.0, 0.0], solidVel: [0.0, 0.0, 0.0] });
  // Case 4: Live production runMlsMpmGpuResidentStep invoking unilateral slip automatically in the shared fused encoder!
  const productionStep = await runProductionResidentMixedSolidLiquidStep(device);

  const valErr = await device.popErrorScope();
  device.destroy();

  return {
    status: 'ok',
    compileErrors,
    validationError: valErr ? valErr.message : null,
    uncapturedErrors,
    approaching,
    shifted,
    separating,
    productionStep
  };
}
