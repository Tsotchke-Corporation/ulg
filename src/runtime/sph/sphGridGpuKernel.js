import {
  MLS_MPM_GPU_GRID_NODE_ROW_LAYOUT,
  ULG_MLS_MPM_GPU_GRID_PROJECTION_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_PROJECTION_PARITY_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import { mlsMpmP2gGridProjectionWgsl } from '../../../ulg-gpu-abi/src/wgsl.js';
import { requestOpticalGpuDevice } from '../material/opticalGpuBuffers.js';
import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
  SPH_GPU_PARTICLE_STATE_FLOATS,
  SPH_GPU_PARTICLE_THERMO_FLOATS
} from './sphGpuBuffers.js';

export {
  ULG_MLS_MPM_GPU_GRID_PROJECTION_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_PROJECTION_PARITY_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA,
  mlsMpmP2gGridProjectionWgsl
};

export const MLS_MPM_GPU_GRID_NODE_FLOATS = MLS_MPM_GPU_GRID_NODE_ROW_LAYOUT.length;

const GPU_BUFFER_USAGE = {
  MAP_READ: globalThis.GPUBufferUsage?.MAP_READ ?? 1,
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64
};

const GPU_MAP_MODE = {
  READ: globalThis.GPUMapMode?.READ ?? 1
};

const DEFAULT_BOX_DIMS_M = Object.freeze([5, 5, 5]);
const DEFAULT_GRID_SHIFT = 1;
const GRID_SCOPE = 'gather-form-p2g-stress-momentum-projection';
const TAIT_EXPONENT = 7;
const EOS_MODEL_IDS = Object.freeze({
  disabled: 0,
  taitCondensed: 1,
  gasLinearized: 2
});

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function finiteVector3(value, fallback) {
  const source = Array.isArray(value) ? value : fallback;
  return [
    finiteNumber(source?.[0], fallback[0]),
    finiteNumber(source?.[1], fallback[1]),
    finiteNumber(source?.[2], fallback[2])
  ];
}

function assertPackedInputs({ sphParticleState, mlsMpmParticleState }) {
  if (sphParticleState?.schema !== ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA) {
    throw new TypeError('MLS-MPM grid projection requires a packed SPH GPU particle buffer');
  }
  if (mlsMpmParticleState?.schema !== ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA) {
    throw new TypeError('MLS-MPM grid projection requires a packed MLS-MPM GPU particle buffer');
  }
  if (sphParticleState.particleCount !== mlsMpmParticleState.particleCount) {
    throw new RangeError('SPH and MLS-MPM particle buffer counts must match');
  }
}

export function createMlsMpmGridSpec({
  boxDimsM = DEFAULT_BOX_DIMS_M,
  gridSpacingM,
  shift = DEFAULT_GRID_SHIFT
} = {}) {
  const dims = finiteVector3(boxDimsM, DEFAULT_BOX_DIMS_M);
  const dx = finiteNumber(gridSpacingM, 0);
  if (!(dx > 0)) throw new RangeError('createMlsMpmGridSpec requires a positive gridSpacingM');
  const gridDims = [
    Math.round(dims[0] / dx) + 5,
    Math.round(dims[1] / dx) + 5,
    Math.round(dims[2] / dx) + 5
  ];
  return {
    gridSpacingM: dx,
    invGridSpacingM: 1 / dx,
    boxDimsM: dims,
    shift,
    gridDims,
    gridNodeCount: gridDims[0] * gridDims[1] * gridDims[2]
  };
}

function quadraticWeights(fx) {
  const a = 1.5 - fx;
  const b = fx - 1;
  const c = fx - 0.5;
  return [0.5 * a * a, 0.75 - b * b, 0.5 * c * c];
}

function gridNodeCoords(nodeIndex, gridSpec) {
  const [, gny, gnz] = gridSpec.gridDims;
  const plane = gny * gnz;
  const i = Math.floor(nodeIndex / plane);
  const rem = nodeIndex - i * plane;
  const j = Math.floor(rem / gnz);
  const k = rem - j * gnz;
  return {
    i,
    j,
    k,
    nodeI: i - gridSpec.shift,
    nodeJ: j - gridSpec.shift,
    nodeK: k - gridSpec.shift
  };
}

function det3(F) {
  return F[0] * (F[4] * F[8] - F[5] * F[7])
    - F[1] * (F[3] * F[8] - F[5] * F[6])
    + F[2] * (F[3] * F[7] - F[4] * F[6]);
}

function corotatedCauchyStress(F, mu, lambda) {
  const [f0, f1, f2, f3, f4, f5, f6, f7, f8] = F;
  let r0 = f0; let r1 = f1; let r2 = f2;
  let r3 = f3; let r4 = f4; let r5 = f5;
  let r6 = f6; let r7 = f7; let r8 = f8;
  for (let it = 0; it < 12; it += 1) {
    const det = r0 * (r4 * r8 - r5 * r7) - r1 * (r3 * r8 - r5 * r6) + r2 * (r3 * r7 - r4 * r6);
    if (Math.abs(det) < 1e-12) break;
    const id = 1 / det;
    const t0 = (r4 * r8 - r5 * r7) * id; const t3 = (r2 * r7 - r1 * r8) * id; const t6 = (r1 * r5 - r2 * r4) * id;
    const t1 = (r5 * r6 - r3 * r8) * id; const t4 = (r0 * r8 - r2 * r6) * id; const t7 = (r2 * r3 - r0 * r5) * id;
    const t2 = (r3 * r7 - r4 * r6) * id; const t5 = (r1 * r6 - r0 * r7) * id; const t8 = (r0 * r4 - r1 * r3) * id;
    const n0 = 0.5 * (r0 + t0); const n1 = 0.5 * (r1 + t1); const n2 = 0.5 * (r2 + t2);
    const n3 = 0.5 * (r3 + t3); const n4 = 0.5 * (r4 + t4); const n5 = 0.5 * (r5 + t5);
    const n6 = 0.5 * (r6 + t6); const n7 = 0.5 * (r7 + t7); const n8 = 0.5 * (r8 + t8);
    const diff = Math.abs(n0 - r0) + Math.abs(n4 - r4) + Math.abs(n8 - r8);
    r0 = n0; r1 = n1; r2 = n2; r3 = n3; r4 = n4; r5 = n5; r6 = n6; r7 = n7; r8 = n8;
    if (diff < 1e-10) break;
  }
  const J = det3(F);
  if (Math.abs(J) < 1e-12) return new Array(9).fill(0);
  const jid = 1 / J;
  const ft0 = (f4 * f8 - f5 * f7) * jid; const ft3 = (f2 * f7 - f1 * f8) * jid; const ft6 = (f1 * f5 - f2 * f4) * jid;
  const ft1 = (f5 * f6 - f3 * f8) * jid; const ft4 = (f0 * f8 - f2 * f6) * jid; const ft7 = (f2 * f3 - f0 * f5) * jid;
  const ft2 = (f3 * f7 - f4 * f6) * jid; const ft5 = (f1 * f6 - f0 * f7) * jid; const ft8 = (f0 * f4 - f1 * f3) * jid;
  const c = lambda * (J - 1) * J;
  const p0 = 2 * mu * (f0 - r0) + c * ft0; const p1 = 2 * mu * (f1 - r1) + c * ft1; const p2 = 2 * mu * (f2 - r2) + c * ft2;
  const p3 = 2 * mu * (f3 - r3) + c * ft3; const p4 = 2 * mu * (f4 - r4) + c * ft4; const p5 = 2 * mu * (f5 - r5) + c * ft5;
  const p6 = 2 * mu * (f6 - r6) + c * ft6; const p7 = 2 * mu * (f7 - r7) + c * ft7; const p8 = 2 * mu * (f8 - r8) + c * ft8;
  return [
    (p0 * f0 + p1 * f1 + p2 * f2) * jid, (p0 * f3 + p1 * f4 + p2 * f5) * jid, (p0 * f6 + p1 * f7 + p2 * f8) * jid,
    (p3 * f0 + p4 * f1 + p5 * f2) * jid, (p3 * f3 + p4 * f4 + p5 * f5) * jid, (p3 * f6 + p4 * f7 + p5 * f8) * jid,
    (p6 * f0 + p7 * f1 + p8 * f2) * jid, (p6 * f3 + p7 * f4 + p8 * f5) * jid, (p6 * f6 + p7 * f7 + p8 * f8) * jid
  ];
}

function pressureFromPackedParticle({
  densityKgPerM3,
  restDensityKgPerM3,
  soundSpeedMPerS,
  eosModelId
}) {
  if (!(densityKgPerM3 > 0) || !(restDensityKgPerM3 > 0) || !(soundSpeedMPerS > 0)) return 0;
  if (Math.round(eosModelId) === EOS_MODEL_IDS.gasLinearized) {
    return Math.max(0, soundSpeedMPerS * soundSpeedMPerS * (densityKgPerM3 - restDensityKgPerM3));
  }
  if (Math.round(eosModelId) === EOS_MODEL_IDS.taitCondensed) {
    const ratio = densityKgPerM3 / Math.max(restDensityKgPerM3, 1e-9);
    return (restDensityKgPerM3 * soundSpeedMPerS * soundSpeedMPerS / TAIT_EXPONENT)
      * (ratio ** TAIT_EXPONENT - 1);
  }
  return 0;
}

function stressTensorForPackedParticle({
  sphParticleState,
  mlsMpmParticleState,
  stateOffset,
  thermoOffset,
  mechanicsOffset
}) {
  const F = [
    mlsMpmParticleState.mechanics[mechanicsOffset],
    mlsMpmParticleState.mechanics[mechanicsOffset + 1],
    mlsMpmParticleState.mechanics[mechanicsOffset + 2],
    mlsMpmParticleState.mechanics[mechanicsOffset + 3],
    mlsMpmParticleState.mechanics[mechanicsOffset + 4],
    mlsMpmParticleState.mechanics[mechanicsOffset + 5],
    mlsMpmParticleState.mechanics[mechanicsOffset + 6],
    mlsMpmParticleState.mechanics[mechanicsOffset + 7],
    mlsMpmParticleState.mechanics[mechanicsOffset + 8]
  ];
  const restVolumeM3 = mlsMpmParticleState.mechanics[mechanicsOffset + 19];
  const J = finiteNumber(mlsMpmParticleState.mechanics[mechanicsOffset + 18], det3(F));
  const volumeM3 = Math.max(restVolumeM3 * Math.max(J, 1e-9), 1e-30);
  const densityKgPerM3 = sphParticleState.state[stateOffset + 3] / volumeM3;
  const restDensityKgPerM3 = sphParticleState.thermo[thermoOffset + 3];
  const solidFlag = mlsMpmParticleState.mechanics[mechanicsOffset + 20];
  const shearModulusPa = mlsMpmParticleState.mechanics[mechanicsOffset + 23];
  const lambdaPa = mlsMpmParticleState.mechanics[mechanicsOffset + 24];
  if (solidFlag > 0.5 && shearModulusPa > 0) {
    return corotatedCauchyStress(F, shearModulusPa, lambdaPa);
  }
  const pressurePa = pressureFromPackedParticle({
    densityKgPerM3,
    restDensityKgPerM3,
    soundSpeedMPerS: mlsMpmParticleState.mechanics[mechanicsOffset + 25],
    eosModelId: mlsMpmParticleState.mechanics[mechanicsOffset + 26]
  });
  return [-pressurePa, 0, 0, 0, -pressurePa, 0, 0, 0, -pressurePa];
}

function outputEnvelope({ backend, sphParticleState, mlsMpmParticleState, gridSpec, gridNodes, dt = 0 }) {
  return {
    schema: ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA,
    backend,
    status: 'projected',
    kernelScope: GRID_SCOPE,
    particleCount: sphParticleState.particleCount,
    sourceSchemas: {
      sphParticleState: sphParticleState.schema,
      mlsMpmParticleState: mlsMpmParticleState.schema
    },
    sourceStep: sphParticleState.step ?? mlsMpmParticleState.step ?? 0,
    sourceTime: sphParticleState.time ?? mlsMpmParticleState.time ?? 0,
    dt,
    gridSpacingM: gridSpec.gridSpacingM,
    gridDims: [...gridSpec.gridDims],
    gridNodeCount: gridSpec.gridNodeCount,
    gridShift: gridSpec.shift,
    gridNodeLayout: [...MLS_MPM_GPU_GRID_NODE_ROW_LAYOUT],
    gridNodeStrideFloats: MLS_MPM_GPU_GRID_NODE_FLOATS,
    gridNodeStrideBytes: MLS_MPM_GPU_GRID_NODE_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    gridNodes,
    p2gProjectionValidation: false,
    stressProjectionValidation: false,
    gridValidation: false,
    g2pValidation: false,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

export function projectMlsMpmP2gGridCpu({
  sphParticleState,
  mlsMpmParticleState,
  gridSpacingM = sphParticleState?.smoothingLengthM,
  boxDimsM = DEFAULT_BOX_DIMS_M,
  dt = mlsMpmParticleState?.mechanicsDtS ?? 0
} = {}) {
  assertPackedInputs({ sphParticleState, mlsMpmParticleState });
  const gridSpec = createMlsMpmGridSpec({ boxDimsM, gridSpacingM });
  const dtSeconds = finiteNumber(dt, 0);
  const gridNodes = new Float32Array(gridSpec.gridNodeCount * MLS_MPM_GPU_GRID_NODE_FLOATS);

  for (let nodeIndex = 0; nodeIndex < gridSpec.gridNodeCount; nodeIndex += 1) {
    const { nodeI, nodeJ, nodeK } = gridNodeCoords(nodeIndex, gridSpec);
    const nodePosition = [
      nodeI * gridSpec.gridSpacingM,
      nodeJ * gridSpec.gridSpacingM,
      nodeK * gridSpec.gridSpacingM
    ];
    let mass = 0;
    const momentum = [0, 0, 0];

    for (let particleIndex = 0; particleIndex < sphParticleState.particleCount; particleIndex += 1) {
      const stateOffset = particleIndex * SPH_GPU_PARTICLE_STATE_FLOATS;
      const thermoOffset = particleIndex * SPH_GPU_PARTICLE_THERMO_FLOATS;
      const mechanicsOffset = particleIndex * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS;
      const position = [
        sphParticleState.state[stateOffset],
        sphParticleState.state[stateOffset + 1],
        sphParticleState.state[stateOffset + 2]
      ];
      const pGrid = position.map((value) => value * gridSpec.invGridSpacingM);
      const base = pGrid.map((value) => Math.floor(value - 0.5));
      const offsets = [nodeI - base[0], nodeJ - base[1], nodeK - base[2]];
      if (offsets.some((offset) => offset < 0 || offset > 2)) continue;
      const wx = quadraticWeights(pGrid[0] - base[0]);
      const wy = quadraticWeights(pGrid[1] - base[1]);
      const wz = quadraticWeights(pGrid[2] - base[2]);
      const weight = wx[offsets[0]] * wy[offsets[1]] * wz[offsets[2]];
      if (weight === 0) continue;
      const particleMass = sphParticleState.state[stateOffset + 3];
      const velocity = [
        sphParticleState.state[stateOffset + 4],
        sphParticleState.state[stateOffset + 5],
        sphParticleState.state[stateOffset + 6]
      ];
      const dpos = [
        nodePosition[0] - position[0],
        nodePosition[1] - position[1],
        nodePosition[2] - position[2]
      ];
      const C = [
        mlsMpmParticleState.mechanics[mechanicsOffset + 9],
        mlsMpmParticleState.mechanics[mechanicsOffset + 10],
        mlsMpmParticleState.mechanics[mechanicsOffset + 11],
        mlsMpmParticleState.mechanics[mechanicsOffset + 12],
        mlsMpmParticleState.mechanics[mechanicsOffset + 13],
        mlsMpmParticleState.mechanics[mechanicsOffset + 14],
        mlsMpmParticleState.mechanics[mechanicsOffset + 15],
        mlsMpmParticleState.mechanics[mechanicsOffset + 16],
        mlsMpmParticleState.mechanics[mechanicsOffset + 17]
      ];
      const restVolumeM3 = Math.max(mlsMpmParticleState.mechanics[mechanicsOffset + 19], 0);
      const J = Math.max(mlsMpmParticleState.mechanics[mechanicsOffset + 18], 1e-9);
      const volumeM3 = restVolumeM3 * J;
      const sigma = dtSeconds !== 0 && volumeM3 > 0
        ? stressTensorForPackedParticle({
          sphParticleState,
          mlsMpmParticleState,
          stateOffset,
          thermoOffset,
          mechanicsOffset
        })
        : new Array(9).fill(0);
      const stressScale = -dtSeconds * volumeM3 * 4 * gridSpec.invGridSpacingM * gridSpec.invGridSpacingM;
      const aff = [
        particleMass * C[0] + stressScale * sigma[0],
        particleMass * C[1] + stressScale * sigma[1],
        particleMass * C[2] + stressScale * sigma[2],
        particleMass * C[3] + stressScale * sigma[3],
        particleMass * C[4] + stressScale * sigma[4],
        particleMass * C[5] + stressScale * sigma[5],
        particleMass * C[6] + stressScale * sigma[6],
        particleMass * C[7] + stressScale * sigma[7],
        particleMass * C[8] + stressScale * sigma[8]
      ];
      const affineMomentum = [
        aff[0] * dpos[0] + aff[1] * dpos[1] + aff[2] * dpos[2],
        aff[3] * dpos[0] + aff[4] * dpos[1] + aff[5] * dpos[2],
        aff[6] * dpos[0] + aff[7] * dpos[1] + aff[8] * dpos[2]
      ];
      mass += weight * particleMass;
      momentum[0] += weight * (particleMass * velocity[0] + affineMomentum[0]);
      momentum[1] += weight * (particleMass * velocity[1] + affineMomentum[1]);
      momentum[2] += weight * (particleMass * velocity[2] + affineMomentum[2]);
    }

    const offset = nodeIndex * MLS_MPM_GPU_GRID_NODE_FLOATS;
    gridNodes.set([
      mass,
      momentum[0],
      momentum[1],
      momentum[2],
      nodePosition[0],
      nodePosition[1],
      nodePosition[2],
      mass > 0 ? 1 : 0
    ], offset);
  }

  return outputEnvelope({
    backend: 'cpu-reference',
    sphParticleState,
    mlsMpmParticleState,
    gridSpec,
    gridNodes,
    dt: dtSeconds
  });
}

function writeStorageBuffer(device, label, data) {
  const byteLength = Math.max(4, data.byteLength);
  const buffer = device.createBuffer({
    label,
    size: byteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
  });
  if (data.byteLength > 0) device.queue.writeBuffer(buffer, 0, data);
  return buffer;
}

function createProjectionParamsArray(gridSpec, particleCount, dt) {
  const buffer = new ArrayBuffer(48);
  const view = new DataView(buffer);
  view.setUint32(0, particleCount, true);
  view.setUint32(4, gridSpec.gridNodeCount, true);
  view.setUint32(8, gridSpec.gridDims[0], true);
  view.setUint32(12, gridSpec.gridDims[1], true);
  view.setUint32(16, gridSpec.gridDims[2], true);
  view.setUint32(20, gridSpec.shift, true);
  view.setFloat32(24, gridSpec.gridSpacingM, true);
  view.setFloat32(28, gridSpec.invGridSpacingM, true);
  view.setFloat32(32, finiteNumber(dt, 0), true);
  return buffer;
}

export async function runMlsMpmP2gGridProjectionWebGpu({
  device,
  sphParticleState,
  mlsMpmParticleState,
  sphParticleUpload = null,
  mlsMpmParticleUpload = null,
  gridSpacingM = sphParticleState?.smoothingLengthM,
  boxDimsM = DEFAULT_BOX_DIMS_M,
  dt = mlsMpmParticleState?.mechanicsDtS ?? 0
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runMlsMpmP2gGridProjectionWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  assertPackedInputs({ sphParticleState, mlsMpmParticleState });
  const gridSpec = createMlsMpmGridSpec({ boxDimsM, gridSpacingM });
  const outputByteLength = gridSpec.gridNodeCount * MLS_MPM_GPU_GRID_NODE_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const borrowedStateBuffer = sphParticleUpload?.status === 'webgpu-uploaded' ? sphParticleUpload.stateBuffer : null;
  const borrowedThermoBuffer = sphParticleUpload?.status === 'webgpu-uploaded' ? sphParticleUpload.thermoBuffer : null;
  const borrowedMechanicsBuffer = mlsMpmParticleUpload?.status === 'webgpu-uploaded'
    ? mlsMpmParticleUpload.mechanicsBuffer
    : null;
  const stateBuffer = borrowedStateBuffer || writeStorageBuffer(device, 'ulg-mls-mpm-p2g-sph-state-in', sphParticleState.state);
  const thermoBuffer = borrowedThermoBuffer || writeStorageBuffer(device, 'ulg-mls-mpm-p2g-sph-thermo-in', sphParticleState.thermo);
  const mechanicsBuffer = borrowedMechanicsBuffer || writeStorageBuffer(device, 'ulg-mls-mpm-p2g-mechanics-in', mlsMpmParticleState.mechanics);
  const gridBuffer = device.createBuffer({
    label: 'ulg-mls-mpm-p2g-grid-out',
    size: Math.max(4, outputByteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const paramsBuffer = device.createBuffer({
    label: 'ulg-mls-mpm-p2g-params',
    size: 48,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const readBuffer = device.createBuffer({
    label: 'ulg-mls-mpm-p2g-grid-readback',
    size: Math.max(4, outputByteLength),
    usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
  });

  try {
    device.queue.writeBuffer(paramsBuffer, 0, createProjectionParamsArray(gridSpec, sphParticleState.particleCount, dt));
    const module = device.createShaderModule({ code: mlsMpmP2gGridProjectionWgsl });
    const pipeline = device.createComputePipeline({
      layout: 'auto',
      compute: { module, entryPoint: 'main' }
    });
    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: stateBuffer } },
        { binding: 1, resource: { buffer: thermoBuffer } },
        { binding: 2, resource: { buffer: mechanicsBuffer } },
        { binding: 3, resource: { buffer: gridBuffer } },
        { binding: 4, resource: { buffer: paramsBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.max(1, Math.ceil(gridSpec.gridNodeCount / 64)));
    pass.end();
    encoder.copyBufferToBuffer(gridBuffer, 0, readBuffer, 0, Math.max(4, outputByteLength));
    device.queue.submit([encoder.finish()]);
    await readBuffer.mapAsync(GPU_MAP_MODE.READ);
    const gridNodes = new Float32Array(readBuffer.getMappedRange()).slice(0, gridSpec.gridNodeCount * MLS_MPM_GPU_GRID_NODE_FLOATS);
    readBuffer.unmap();
    return outputEnvelope({
      backend: 'webgpu',
      sphParticleState,
      mlsMpmParticleState,
      gridSpec,
      gridNodes,
      dt
    });
  } finally {
    if (!borrowedStateBuffer) stateBuffer.destroy?.();
    if (!borrowedThermoBuffer) thermoBuffer.destroy?.();
    if (!borrowedMechanicsBuffer) mechanicsBuffer.destroy?.();
    gridBuffer.destroy?.();
    paramsBuffer.destroy?.();
    readBuffer.destroy?.();
  }
}

export function createMlsMpmP2gGridProjectionParityReport({ cpuReference, gpuResult, tolerance = 5e-2 } = {}) {
  const cpuGrid = cpuReference?.gridNodes;
  const gpuGrid = gpuResult?.gridNodes;
  if (!(cpuGrid instanceof Float32Array) || !(gpuGrid instanceof Float32Array)) {
    return {
      schema: ULG_MLS_MPM_GPU_GRID_PROJECTION_PARITY_SCHEMA,
      status: 'fail',
      tolerance,
      maxGridAbs: Number.POSITIVE_INFINITY,
      lengthMismatch: true,
      reason: 'missing grid projection buffers',
      cpuBackend: cpuReference?.backend || null,
      gpuBackend: gpuResult?.backend || null,
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  }
  const comparisonCount = Math.min(cpuGrid.length, gpuGrid.length);
  let maxGridAbs = 0;
  for (let index = 0; index < comparisonCount; index += 1) {
    maxGridAbs = Math.max(maxGridAbs, Math.abs(cpuGrid[index] - gpuGrid[index]));
  }
  const lengthMismatch = cpuGrid.length !== gpuGrid.length;
  const passed = !lengthMismatch && maxGridAbs <= tolerance;
  return {
    schema: ULG_MLS_MPM_GPU_GRID_PROJECTION_PARITY_SCHEMA,
    status: passed ? 'pass' : 'fail',
    tolerance,
    maxGridAbs,
    lengthMismatch,
    gridNodeCount: cpuReference?.gridNodeCount ?? gpuResult?.gridNodeCount ?? 0,
    cpuBackend: cpuReference.backend,
    gpuBackend: gpuResult.backend,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

function executionFromProjection(projection, {
  cpuReference = null,
  gpuResult = null,
  webgpuStatus,
  webgpuParity = null
} = {}) {
  return {
    schema: ULG_MLS_MPM_GPU_GRID_PROJECTION_EXECUTION_SCHEMA,
    projectionSchema: projection?.schema || ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA,
    backend: projection?.backend || 'cpu-reference',
    status: projection?.status || 'projected',
    kernelScope: GRID_SCOPE,
    particleCount: projection?.particleCount ?? 0,
    dt: projection?.dt ?? 0,
    gridSpacingM: projection?.gridSpacingM ?? 0,
    gridDims: projection?.gridDims ?? [],
    gridNodeCount: projection?.gridNodeCount ?? 0,
    gridNodeStrideFloats: MLS_MPM_GPU_GRID_NODE_FLOATS,
    gridNodes: projection?.gridNodes ?? new Float32Array(),
    cpuReference,
    gpuResult,
    webgpuStatus,
    webgpuParity,
    p2gProjectionValidation: false,
    stressProjectionValidation: false,
    gridValidation: false,
    g2pValidation: false,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

function describeDeviceLost(info) {
  return info?.reason || info?.message || 'device lost';
}

function watchDeviceLost(device, onDeviceLost) {
  if (!device?.lost?.then) return;
  device.lost.then((info) => onDeviceLost(info)).catch((error) => onDeviceLost(error));
}

export async function runMlsMpmP2gGridProjectionWithOptionalWebGpu({
  sphParticleState,
  mlsMpmParticleState,
  sphParticleUpload = null,
  mlsMpmParticleUpload = null,
  gridSpacingM = sphParticleState?.smoothingLengthM,
  boxDimsM = DEFAULT_BOX_DIMS_M,
  dt = mlsMpmParticleState?.mechanicsDtS ?? 0,
  preferWebGpu = false,
  navigatorRef = globalThis.navigator,
  device = null,
  deviceResult = null,
  parityTolerance = 5e-2,
  onDeviceLost = null,
  webGpuRunner = runMlsMpmP2gGridProjectionWebGpu
} = {}) {
  const cpuReference = projectMlsMpmP2gGridCpu({
    sphParticleState,
    mlsMpmParticleState,
    gridSpacingM,
    boxDimsM,
    dt
  });
  if (!preferWebGpu) {
    return executionFromProjection(cpuReference, {
      cpuReference,
      webgpuStatus: {
        status: 'not-requested',
        reason: 'WebGPU MLS-MPM P2G grid projection path not requested'
      }
    });
  }
  try {
    let lostInfo = null;
    const resolvedDeviceResult = device
      ? { status: 'webgpu-device-ready', reason: 'provided device', device }
      : (deviceResult || await requestOpticalGpuDevice(navigatorRef, {
        onDeviceLost(info) {
          lostInfo = info;
          if (typeof onDeviceLost === 'function') onDeviceLost(info);
        }
      }));
    if (resolvedDeviceResult.device && device) {
      watchDeviceLost(resolvedDeviceResult.device, (info) => {
        lostInfo = info;
        if (typeof onDeviceLost === 'function') onDeviceLost(info);
      });
    }
    if (!resolvedDeviceResult.device) {
      return executionFromProjection(cpuReference, {
        cpuReference,
        webgpuStatus: {
          status: resolvedDeviceResult.status,
          reason: resolvedDeviceResult.reason,
          fallback: 'cpu-reference'
        }
      });
    }
    await Promise.resolve();
    if (lostInfo) {
      return executionFromProjection(cpuReference, {
        cpuReference,
        webgpuStatus: {
          status: 'webgpu-device-lost-fallback',
          reason: describeDeviceLost(lostInfo),
          fallback: 'cpu-reference'
        }
      });
    }
    const gpuResult = await webGpuRunner({
      device: resolvedDeviceResult.device,
      sphParticleState,
      mlsMpmParticleState,
      sphParticleUpload,
      mlsMpmParticleUpload,
      gridSpacingM,
      boxDimsM,
      dt
    });
    await Promise.resolve();
    if (lostInfo) {
      return executionFromProjection(cpuReference, {
        cpuReference,
        gpuResult,
        webgpuStatus: {
          status: 'webgpu-device-lost-fallback',
          reason: describeDeviceLost(lostInfo),
          fallback: 'cpu-reference'
        }
      });
    }
    const webgpuParity = createMlsMpmP2gGridProjectionParityReport({
      cpuReference,
      gpuResult,
      tolerance: parityTolerance
    });
    if (webgpuParity.status !== 'pass') {
      return executionFromProjection(cpuReference, {
        cpuReference,
        gpuResult,
        webgpuStatus: {
          status: 'webgpu-parity-failed',
          reason: 'CPU/WebGPU MLS-MPM P2G grid projection parity exceeded tolerance',
          fallback: 'cpu-reference'
        },
        webgpuParity
      });
    }
    return executionFromProjection(gpuResult, {
      cpuReference,
      gpuResult,
      webgpuStatus: {
        status: 'webgpu-executed',
        reason: 'CPU/WebGPU MLS-MPM P2G grid projection parity passed'
      },
      webgpuParity
    });
  } catch (error) {
    return executionFromProjection(cpuReference, {
      cpuReference,
      webgpuStatus: {
        status: 'webgpu-error-fallback',
        reason: error instanceof Error ? error.message : String(error),
        fallback: 'cpu-reference'
      }
    });
  }
}
