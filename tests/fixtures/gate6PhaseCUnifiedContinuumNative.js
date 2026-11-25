import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT,
  SPH_GPU_PARTICLE_STATE_ROW_LAYOUT
} from '../../ulg-gpu-abi/src/index.js';
import { createSphSolidLiquidVelocitySeparationStage } from '../../src/runtime/sph/sphSolidLiquidVelocitySeparationGpu.js';
import { schroederSolidFluidContactSsWgsl } from '../../src/runtime/sph/schroederSolidFluidContactGpu.js';
import { schroederSolidFluidThermalSsWgsl } from '../../src/runtime/sph/schroederSolidFluidThermalGpu.js';

async function runSlipCase(device, { offsetM = [0, 0, 0], liquidVel = [2.0, -1.0, 0.0], solidVel = [0.0, 0.0, 0.0] } = {}) {
  // 2x2x2 solid slab below y = offsetM[1] + 1.0, 2x2x2 liquid slab right above at y = offsetM[1] + 1.08
  // Sharing MPM grid nodes at y = 1.0 (gridSpacingM = 0.2)!
  const dx = 0.2;
  const gridDims = [14, 14, 14];
  const shift = 2;
  const stateStride = SPH_GPU_PARTICLE_STATE_ROW_LAYOUT.length; // 8
  const mechStride = MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length; // 32

  const particles = [];
  const solidMass = 4.0;
  const liquidMass = 1.0;
  for (let ix = 0; ix < 2; ix += 1) {
    for (let iz = 0; iz < 2; iz += 1) {
      // Solid slab (2 layers thick so outward solid normal points cleanly along +Y!)
      for (let iy = 0; iy < 2; iy += 1) {
        particles.push({
          solid: true,
          mass: solidMass,
          pos: [offsetM[0] + 0.8 + ix * 0.15, offsetM[1] + 0.72 + iy * 0.16, offsetM[2] + 0.8 + iz * 0.15],
          vel: [...solidVel]
        });
      }
      // Liquid layer immediately above solid slab (sharing grid stencil nodes!)
      particles.push({
        solid: false,
        mass: liquidMass,
        pos: [offsetM[0] + 0.8 + ix * 0.15, offsetM[1] + 0.96, offsetM[2] + 0.8 + iz * 0.15],
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

export async function runGate6PhaseCUnifiedContinuumNative() {
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

  const valErr = await device.popErrorScope();
  device.destroy();

  return {
    status: 'ok',
    compileErrors,
    validationError: valErr ? valErr.message : null,
    uncapturedErrors,
    approaching,
    shifted,
    separating
  };
}
