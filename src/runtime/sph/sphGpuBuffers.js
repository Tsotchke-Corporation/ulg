import {
  SPH_GPU_PARTICLE_STATE_ROW_LAYOUT,
  SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import { GPU_PHASE_IDS, gpuPhaseId, stableOpticalMaterialId } from '../material/opticalGpuBuffers.js';
import { equilibriumFromSpecificEnergy } from '../material/phaseEquilibrium.js';

export {
  SPH_GPU_PARTICLE_STATE_ROW_LAYOUT,
  SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA
};

export const SPH_GPU_PARTICLE_STATE_FLOATS = SPH_GPU_PARTICLE_STATE_ROW_LAYOUT.length;
export const SPH_GPU_PARTICLE_THERMO_FLOATS = SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT.length;
export const SPH_GPU_PARTICLE_STATUS = Object.freeze({
  ready: 1,
  energyClampedLow: 2,
  energyClampedHigh: 3,
  missingMaterialProperties: 255
});

const AVOGADRO = 6.02214076e23;
const PHASE_FRACTION_ORDER = ['solid', 'liquid', 'gas', 'plasma'];

const GPU_BUFFER_USAGE = {
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128
};

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function materialPropertiesFor(material, materialProperties) {
  if (!materialProperties || !material) return null;
  return materialProperties[material]
    ?? materialProperties[String(material).toLowerCase()]
    ?? materialProperties[String(material).toUpperCase()]
    ?? null;
}

function restDensityFor(properties, phase, particle) {
  const particleRestDensity = finiteNumber(particle.restDensityKgPerM3, 0);
  if (particleRestDensity > 0) return particleRestDensity;
  const exact = properties?.phases?.find((candidate) => candidate.name === phase);
  const fallback = properties?.phases?.find((candidate) => candidate.densityKgPerM3 > 0);
  return finiteNumber(exact?.densityKgPerM3 ?? fallback?.densityKgPerM3, 0);
}

function representedEntityCount(particle, properties) {
  const massKg = finiteNumber(particle.massKg, 0);
  const molarMassKgPerMol = finiteNumber(properties?.molarMassKgPerMol, 0);
  return massKg > 0 && molarMassKgPerMol > 0
    ? (massKg / molarMassKgPerMol) * AVOGADRO
    : 0;
}

function statusForEquilibrium(eq, properties) {
  if (!properties) return SPH_GPU_PARTICLE_STATUS.missingMaterialProperties;
  if (eq?.clamped === 'low') return SPH_GPU_PARTICLE_STATUS.energyClampedLow;
  if (eq?.clamped === 'high') return SPH_GPU_PARTICLE_STATUS.energyClampedHigh;
  return SPH_GPU_PARTICLE_STATUS.ready;
}

function phaseFractionsFor(eq) {
  return PHASE_FRACTION_ORDER.map((phase) => finiteNumber(eq?.phaseFractions?.[phase], 0));
}

function equilibriumForParticle(particle, properties) {
  if (!properties) {
    return {
      temperatureK: 0,
      stablePhase: 'unknown',
      phaseFractions: {},
      clamped: null
    };
  }
  return equilibriumFromSpecificEnergy(properties, finiteNumber(particle.specificInternalEnergyJPerKg, 0));
}

export function buildSphGpuParticleBuffers(state, { materialProperties = {} } = {}) {
  if (!state?.particles || !Array.isArray(state.particles)) {
    throw new TypeError('buildSphGpuParticleBuffers requires a SPH state with particles');
  }
  const particleCount = state.particles.length;
  const stateValues = new Float32Array(particleCount * SPH_GPU_PARTICLE_STATE_FLOATS);
  const thermoValues = new Float32Array(particleCount * SPH_GPU_PARTICLE_THERMO_FLOATS);
  const metadata = [];
  const smoothingLengthM = finiteNumber(state.smoothingLengthM, 0);

  for (let index = 0; index < particleCount; index += 1) {
    const particle = state.particles[index];
    const material = particle.material || 'unknown';
    const properties = materialPropertiesFor(material, materialProperties);
    const eq = equilibriumForParticle(particle, properties);
    const phase = eq.stablePhase || 'unknown';
    const phaseFractions = phaseFractionsFor(eq);
    const stateOffset = index * SPH_GPU_PARTICLE_STATE_FLOATS;
    const thermoOffset = index * SPH_GPU_PARTICLE_THERMO_FLOATS;
    stateValues.set([
      finiteNumber(particle.x?.[0]),
      finiteNumber(particle.x?.[1]),
      finiteNumber(particle.x?.[2]),
      finiteNumber(particle.massKg),
      finiteNumber(particle.v?.[0]),
      finiteNumber(particle.v?.[1]),
      finiteNumber(particle.v?.[2]),
      finiteNumber(particle.specificInternalEnergyJPerKg)
    ], stateOffset);
    const status = statusForEquilibrium(eq, properties);
    thermoValues.set([
      properties ? stableOpticalMaterialId(material) : 0,
      gpuPhaseId(phase),
      finiteNumber(eq.temperatureK),
      restDensityFor(properties, phase, particle),
      phaseFractions[0],
      phaseFractions[1],
      phaseFractions[2],
      phaseFractions[3],
      smoothingLengthM,
      representedEntityCount(particle, properties),
      status,
      0
    ], thermoOffset);
    metadata.push({
      id: particle.id ?? `p${index}`,
      material,
      materialId: properties ? stableOpticalMaterialId(material) : 0,
      phase,
      phaseId: gpuPhaseId(phase),
      status
    });
  }

  return {
    schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
    status: 'cpu-derived-gpu-buffer-ready',
    particleCount,
    dimension: state.dimension ?? 3,
    step: state.step ?? 0,
    time: state.time ?? 0,
    smoothingLengthM,
    phaseIds: { ...GPU_PHASE_IDS },
    stateLayout: [...SPH_GPU_PARTICLE_STATE_ROW_LAYOUT],
    thermoLayout: [...SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT],
    stateStrideFloats: SPH_GPU_PARTICLE_STATE_FLOATS,
    thermoStrideFloats: SPH_GPU_PARTICLE_THERMO_FLOATS,
    stateStrideBytes: SPH_GPU_PARTICLE_STATE_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    thermoStrideBytes: SPH_GPU_PARTICLE_THERMO_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    state: stateValues,
    thermo: thermoValues,
    metadata,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
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

export function uploadSphGpuParticleBuffers(device, packed) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('uploadSphGpuParticleBuffers requires a WebGPU-like device with queue.writeBuffer');
  }
  if (packed?.schema !== ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA) {
    throw new TypeError('uploadSphGpuParticleBuffers requires a packed SPH GPU particle buffer');
  }
  return {
    schema: ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
    status: 'webgpu-uploaded',
    sourceSchema: packed.schema,
    particleCount: packed.particleCount,
    stateStrideBytes: packed.stateStrideBytes,
    thermoStrideBytes: packed.thermoStrideBytes,
    stateBuffer: writeStorageBuffer(device, 'ulg-sph-particle-state', packed.state),
    thermoBuffer: writeStorageBuffer(device, 'ulg-sph-particle-thermo', packed.thermo),
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

export function destroySphGpuParticleBuffers(buffers) {
  buffers?.stateBuffer?.destroy?.();
  buffers?.thermoBuffer?.destroy?.();
}

export function decodeSphGpuParticleRows(packed) {
  if (packed?.schema !== ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA) {
    throw new TypeError('decodeSphGpuParticleRows requires a packed SPH GPU particle buffer');
  }
  const rows = [];
  for (let index = 0; index < packed.particleCount; index += 1) {
    const stateOffset = index * SPH_GPU_PARTICLE_STATE_FLOATS;
    const thermoOffset = index * SPH_GPU_PARTICLE_THERMO_FLOATS;
    rows.push({
      index,
      metadata: packed.metadata[index],
      positionM: [
        packed.state[stateOffset],
        packed.state[stateOffset + 1],
        packed.state[stateOffset + 2]
      ],
      massKg: packed.state[stateOffset + 3],
      velocityMPerS: [
        packed.state[stateOffset + 4],
        packed.state[stateOffset + 5],
        packed.state[stateOffset + 6]
      ],
      specificInternalEnergyJPerKg: packed.state[stateOffset + 7],
      materialId: packed.thermo[thermoOffset],
      phaseId: packed.thermo[thermoOffset + 1],
      temperatureK: packed.thermo[thermoOffset + 2],
      restDensityKgPerM3: packed.thermo[thermoOffset + 3],
      phaseFractions: {
        solid: packed.thermo[thermoOffset + 4],
        liquid: packed.thermo[thermoOffset + 5],
        gas: packed.thermo[thermoOffset + 6],
        plasma: packed.thermo[thermoOffset + 7]
      },
      smoothingLengthM: packed.thermo[thermoOffset + 8],
      representedEntityCount: packed.thermo[thermoOffset + 9],
      status: packed.thermo[thermoOffset + 10]
    });
  }
  return rows;
}
