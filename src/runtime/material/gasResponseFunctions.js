// A4 multidimensional first-principles gas response functions
// (plan/todo/a3-a4-regional-and-multidimensional-closures.md).
//
// Derives deterministic 2-D tensor Chebyshev response functions over
// (T [K], P [Pa]) for every gas-phase material in a scene's materialProperties:
//   - density(T, P)                = P * M / (R * T)                              [kg/m^3],    d/dT < 0, d/dP > 0
//   - soundSpeed(T, P)             = sqrt(gamma * (R / M) * T)                    [m/s],       d/dT > 0
//   - dynamicViscosity(T, P)       = mu_ref * (T/T_ref)^1.5 * (T_ref+S)/(T+S)     [Pa*s],      d/dT > 0
//   - thermalConductivity(T, P)    = k_ref  * (T/T_ref)^1.5 * (T_ref+S)/(T+S)     [W/(m*K)],   d/dT > 0
//   - acousticImpedance(T, P)      = rho(T, P) * c_s(T, P) = P*sqrt(gamma*M/RT)   [Pa*s/m],    d/dT < 0, d/dP > 0
//   - volumetricHeatCapacity(T, P) = rho(T, P) * cp                               [J/(m^3*K)], d/dT < 0, d/dP > 0
//
// Every fit carries held-out interior + boundary face residual bounds,
// enforced physical partial-derivative signs, explicit units, and a generator
// source fingerprint. GPU packing reuses responseFunctionGpu.js (rf_eval) so
// evaluation stays strictly in-box (ok = 0 outside the validity box; never
// extrapolates).

import {
  evaluateResponseFunction,
  fitResponseFunction
} from './localClosureFitCache.js';
import {
  RESPONSE_FUNCTION_GPU_SCHEMA,
  packResponseFunctionsForGpu,
  responseFunctionGpuWgsl
} from './responseFunctionGpu.js';
import { stableOpticalMaterialId } from './opticalGpuBuffers.js';
import { schroederAuthorityTextFingerprint } from '../sph/schroederAuthorityFingerprint.js';

export const GAS_RESPONSE_FUNCTIONS_SCHEMA = 'peercompute.ulg.a4-gas-response-functions.v1';
export const GAS_RESPONSE_CLOSURE_NAMES = Object.freeze([
  'density',
  'soundSpeed',
  'dynamicViscosity',
  'thermalConductivity',
  'acousticImpedance',
  'volumetricHeatCapacity'
]);

const AVOGADRO_R = 8.314462618;
const BOLTZMANN_KB = 1.380649e-23;
const AVOGADRO_NA = 6.02214076e23;
const DEFAULT_TEMPERATURE_DOMAIN_K = Object.freeze([200, 1200]);
const DEFAULT_PRESSURE_DOMAIN_PA = Object.freeze([20_000, 500_000]);

function finitePositive(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function gasGammaFor(properties, gasPhase) {
  const molarMass = finitePositive(properties?.molarMassKgPerMol, 0);
  if (!(molarMass > 0)) return 1.4;
  const rSpecific = AVOGADRO_R / molarMass;
  const cp = finitePositive(gasPhase?.cpJPerKgK, 0);
  if (cp > rSpecific * 1.01) {
    return cp / (cp - rSpecific);
  }
  const atoms = Number(properties?.atomsPerFormula ?? 0);
  if (atoms === 1) return 5 / 3;
  if (atoms === 2) return 1.4;
  return 4 / 3;
}

function gasCpFor(properties, gasPhase, molarMassKgPerMol, gamma) {
  const rSpecific = AVOGADRO_R / molarMassKgPerMol;
  const explicitCp = finitePositive(gasPhase?.cpJPerKgK, 0);
  if (explicitCp > rSpecific * 1.01) return explicitCp;
  return (gamma / (gamma - 1)) * rSpecific;
}

function gasTransportReferenceFor(properties, gasPhase, molarMassKgPerMol, gamma) {
  const refTemperatureK = Math.max(
    100,
    Math.min(1200, finitePositive(gasPhase?.temperatureK, 293.15))
  );
  const sutherlandK = Math.max(50, Math.min(400, 0.38 * refTemperatureK));
  const molecularMassKg = molarMassKgPerMol / AVOGADRO_NA;
  const diameterM = 3.6e-10 * Math.pow(Math.max(0.002, molarMassKgPerMol) / 0.0280134, 1 / 6);
  const kineticMuRef = (5 / 16)
    * Math.sqrt(Math.PI * molecularMassKg * BOLTZMANN_KB * refTemperatureK)
    / (Math.PI * diameterM * diameterM);
  const muRefPaS = finitePositive(
    gasPhase?.dynamicViscosityPaS ?? gasPhase?.viscosityPaS,
    kineticMuRef
  );
  const rSpecific = AVOGADRO_R / molarMassKgPerMol;
  const cpJPerKgK = gasCpFor(properties, gasPhase, molarMassKgPerMol, gamma);
  const cvJPerKgK = Math.max(0.5 * rSpecific, cpJPerKgK - rSpecific);
  // Modified Eucken kinetic-theory relation: k = mu * (c_v + (9/4) * R_specific)
  const euckenKRef = muRefPaS * (cvJPerKgK + 2.25 * rSpecific);
  const kRefWPerMK = finitePositive(gasPhase?.thermalConductivityWPerMK, euckenKRef);
  return Object.freeze({
    refTemperatureK,
    sutherlandK,
    muRefPaS,
    kRefWPerMK,
    cpJPerKgK
  });
}

function sutherlandRatio(temperatureK, refTemperatureK, sutherlandK) {
  return Math.pow(temperatureK / refTemperatureK, 1.5)
    * ((refTemperatureK + sutherlandK) / (temperatureK + sutherlandK));
}

function createGasDensityGenerator(material, molarMassKgPerMol, sourceFingerprint) {
  return Object.freeze({
    id: `a4:gas-density:${material}`,
    axes: Object.freeze([
      Object.freeze({ name: 'temperature', unit: 'K' }),
      Object.freeze({ name: 'pressure', unit: 'Pa' })
    ]),
    outputUnit: 'kg/m^3',
    sourceFingerprint,
    regimeOf([T, P]) {
      return Number.isFinite(T) && T > 0 && Number.isFinite(P) && P > 0 ? 'gas' : 'invalid';
    },
    evaluate([T, P]) {
      return (P * molarMassKgPerMol) / (AVOGADRO_R * T);
    }
  });
}

function createGasSoundSpeedGenerator(material, molarMassKgPerMol, gamma, sourceFingerprint) {
  const rSpecific = AVOGADRO_R / molarMassKgPerMol;
  return Object.freeze({
    id: `a4:gas-sound-speed:${material}`,
    axes: Object.freeze([
      Object.freeze({ name: 'temperature', unit: 'K' }),
      Object.freeze({ name: 'pressure', unit: 'Pa' })
    ]),
    outputUnit: 'm/s',
    sourceFingerprint,
    regimeOf([T, P]) {
      return Number.isFinite(T) && T > 0 && Number.isFinite(P) && P > 0 ? 'gas' : 'invalid';
    },
    evaluate([T]) {
      return Math.sqrt(gamma * rSpecific * T);
    }
  });
}

function createGasDynamicViscosityGenerator(material, transport, sourceFingerprint) {
  const { refTemperatureK, sutherlandK, muRefPaS } = transport;
  return Object.freeze({
    id: `a4:gas-dynamic-viscosity:${material}`,
    axes: Object.freeze([
      Object.freeze({ name: 'temperature', unit: 'K' }),
      Object.freeze({ name: 'pressure', unit: 'Pa' })
    ]),
    outputUnit: 'Pa*s',
    sourceFingerprint,
    regimeOf([T, P]) {
      return Number.isFinite(T) && T > 0 && Number.isFinite(P) && P > 0 ? 'gas' : 'invalid';
    },
    evaluate([T]) {
      return muRefPaS * sutherlandRatio(T, refTemperatureK, sutherlandK);
    }
  });
}

function createGasThermalConductivityGenerator(material, transport, sourceFingerprint) {
  const { refTemperatureK, sutherlandK, kRefWPerMK } = transport;
  return Object.freeze({
    id: `a4:gas-thermal-conductivity:${material}`,
    axes: Object.freeze([
      Object.freeze({ name: 'temperature', unit: 'K' }),
      Object.freeze({ name: 'pressure', unit: 'Pa' })
    ]),
    outputUnit: 'W/(m*K)',
    sourceFingerprint,
    regimeOf([T, P]) {
      return Number.isFinite(T) && T > 0 && Number.isFinite(P) && P > 0 ? 'gas' : 'invalid';
    },
    evaluate([T]) {
      return kRefWPerMK * sutherlandRatio(T, refTemperatureK, sutherlandK);
    }
  });
}

function createGasAcousticImpedanceGenerator(material, molarMassKgPerMol, gamma, sourceFingerprint) {
  const coeff = Math.sqrt((gamma * molarMassKgPerMol) / AVOGADRO_R);
  return Object.freeze({
    id: `a4:gas-acoustic-impedance:${material}`,
    axes: Object.freeze([
      Object.freeze({ name: 'temperature', unit: 'K' }),
      Object.freeze({ name: 'pressure', unit: 'Pa' })
    ]),
    outputUnit: 'Pa*s/m',
    sourceFingerprint,
    regimeOf([T, P]) {
      return Number.isFinite(T) && T > 0 && Number.isFinite(P) && P > 0 ? 'gas' : 'invalid';
    },
    evaluate([T, P]) {
      return (P * coeff) / Math.sqrt(T);
    }
  });
}

function createGasVolumetricHeatCapacityGenerator(material, molarMassKgPerMol, transport, sourceFingerprint) {
  const coeff = (molarMassKgPerMol * transport.cpJPerKgK) / AVOGADRO_R;
  return Object.freeze({
    id: `a4:gas-volumetric-heat-capacity:${material}`,
    axes: Object.freeze([
      Object.freeze({ name: 'temperature', unit: 'K' }),
      Object.freeze({ name: 'pressure', unit: 'Pa' })
    ]),
    outputUnit: 'J/(m^3*K)',
    sourceFingerprint,
    regimeOf([T, P]) {
      return Number.isFinite(T) && T > 0 && Number.isFinite(P) && P > 0 ? 'gas' : 'invalid';
    },
    evaluate([T, P]) {
      return (P * coeff) / T;
    }
  });
}

/**
 * Derive and pack 2-D first-principles (T, P) gas response functions for every
 * gas-capable material in `materialProperties`.
 */
export function buildMaterialGasResponseFunctions(materialProperties = {}, {
  temperatureDomainK = DEFAULT_TEMPERATURE_DOMAIN_K,
  pressureDomainPa = DEFAULT_PRESSURE_DOMAIN_PA,
  densityDegrees = [14, 1],
  soundSpeedDegrees = [12, 1],
  viscosityDegrees = [12, 1],
  conductivityDegrees = [12, 1],
  acousticImpedanceDegrees = [14, 1],
  volumetricHeatCapacityDegrees = [14, 1],
  relativeTolerance = 1e-5,
  heldOutPerAxis = 7,
  safetyFactor = 2
} = {}) {
  const box = [
    [Number(temperatureDomainK[0]), Number(temperatureDomainK[1])],
    [Number(pressureDomainPa[0]), Number(pressureDomainPa[1])]
  ];
  const entries = Object.entries(materialProperties || {})
    .sort(([a], [b]) => String(a).localeCompare(String(b)));

  const functions = [];
  const byMaterial = {};
  let maxRelativeResidualBound = 0;

  for (const [material, properties] of entries) {
    const gasPhase = (properties?.phases || []).find(
      (phase) => String(phase?.name || '').toLowerCase() === 'gas'
    );
    const molarMassKgPerMol = finitePositive(properties?.molarMassKgPerMol, 0);
    if (!gasPhase || !(molarMassKgPerMol > 0)) continue;

    const gamma = gasGammaFor(properties, gasPhase);
    const transport = gasTransportReferenceFor(properties, gasPhase, molarMassKgPerMol, gamma);
    const sourceFingerprint = schroederAuthorityTextFingerprint(
      JSON.stringify({
        schema: GAS_RESPONSE_FUNCTIONS_SCHEMA,
        material,
        molarMassKgPerMol,
        gamma,
        transport
      }),
      `a4-gas-${material}`
    );

    const densityGenerator = createGasDensityGenerator(material, molarMassKgPerMol, sourceFingerprint);
    const soundSpeedGenerator = createGasSoundSpeedGenerator(material, molarMassKgPerMol, gamma, sourceFingerprint);
    const viscosityGenerator = createGasDynamicViscosityGenerator(material, transport, sourceFingerprint);
    const conductivityGenerator = createGasThermalConductivityGenerator(material, transport, sourceFingerprint);
    const impedanceGenerator = createGasAcousticImpedanceGenerator(
      material,
      molarMassKgPerMol,
      gamma,
      sourceFingerprint
    );
    const volHeatCapGenerator = createGasVolumetricHeatCapacityGenerator(
      material,
      molarMassKgPerMol,
      transport,
      sourceFingerprint
    );

    const densityFit = fitResponseFunction({
      generator: densityGenerator,
      box,
      degrees: densityDegrees,
      signs: [-1, 1],
      relativeTolerance,
      heldOutPerAxis,
      safetyFactor
    });
    const soundSpeedFit = fitResponseFunction({
      generator: soundSpeedGenerator,
      box,
      degrees: soundSpeedDegrees,
      signs: [1, 0],
      relativeTolerance,
      heldOutPerAxis,
      safetyFactor
    });
    const dynamicViscosityFit = fitResponseFunction({
      generator: viscosityGenerator,
      box,
      degrees: viscosityDegrees,
      signs: [1, 0],
      relativeTolerance,
      heldOutPerAxis,
      safetyFactor
    });
    const thermalConductivityFit = fitResponseFunction({
      generator: conductivityGenerator,
      box,
      degrees: conductivityDegrees,
      signs: [1, 0],
      relativeTolerance,
      heldOutPerAxis,
      safetyFactor
    });
    const acousticImpedanceFit = fitResponseFunction({
      generator: impedanceGenerator,
      box,
      degrees: acousticImpedanceDegrees,
      signs: [-1, 1],
      relativeTolerance,
      heldOutPerAxis,
      safetyFactor
    });
    const volumetricHeatCapacityFit = fitResponseFunction({
      generator: volHeatCapGenerator,
      box,
      degrees: volumetricHeatCapacityDegrees,
      signs: [-1, 1],
      relativeTolerance,
      heldOutPerAxis,
      safetyFactor
    });

    const densityIndex = functions.length;
    functions.push(densityFit);
    const soundSpeedIndex = functions.length;
    functions.push(soundSpeedFit);
    const dynamicViscosityIndex = functions.length;
    functions.push(dynamicViscosityFit);
    const thermalConductivityIndex = functions.length;
    functions.push(thermalConductivityFit);
    const acousticImpedanceIndex = functions.length;
    functions.push(acousticImpedanceFit);
    const volumetricHeatCapacityIndex = functions.length;
    functions.push(volumetricHeatCapacityFit);

    maxRelativeResidualBound = Math.max(
      maxRelativeResidualBound,
      densityFit.residuals.relativeBound,
      soundSpeedFit.residuals.relativeBound,
      dynamicViscosityFit.residuals.relativeBound,
      thermalConductivityFit.residuals.relativeBound,
      acousticImpedanceFit.residuals.relativeBound,
      volumetricHeatCapacityFit.residuals.relativeBound
    );

    byMaterial[material] = Object.freeze({
      material,
      materialId: stableOpticalMaterialId(material),
      molarMassKgPerMol,
      gamma,
      transport,
      sourceFingerprint,
      densityIndex,
      soundSpeedIndex,
      dynamicViscosityIndex,
      thermalConductivityIndex,
      acousticImpedanceIndex,
      volumetricHeatCapacityIndex,
      densityFit,
      soundSpeedFit,
      dynamicViscosityFit,
      thermalConductivityFit,
      acousticImpedanceFit,
      volumetricHeatCapacityFit
    });
  }

  const packedGpuTable = functions.length > 0
    ? packResponseFunctionsForGpu(functions)
    : null;

  const status = Object.freeze({
    schema: GAS_RESPONSE_FUNCTIONS_SCHEMA,
    gpuTableSchema: packedGpuTable?.schema ?? RESPONSE_FUNCTION_GPU_SCHEMA,
    closures: GAS_RESPONSE_CLOSURE_NAMES,
    materialCount: Object.keys(byMaterial).length,
    functionCount: functions.length,
    temperatureDomainK: Object.freeze([...box[0]]),
    pressureDomainPa: Object.freeze([...box[1]]),
    maxRelativeResidualBound,
    scientificValidation: false
  });

  return Object.freeze({
    schema: GAS_RESPONSE_FUNCTIONS_SCHEMA,
    status,
    byMaterial: Object.freeze(byMaterial),
    functions: Object.freeze(functions),
    packedGpuTable
  });
}

const generatorCacheByEntry = new WeakMap();

function generatorsForMaterialEntry(entry) {
  let cached = generatorCacheByEntry.get(entry);
  if (!cached) {
    cached = Object.freeze({
      densityGenerator: createGasDensityGenerator(
        entry.material,
        entry.molarMassKgPerMol,
        entry.sourceFingerprint
      ),
      soundSpeedGenerator: createGasSoundSpeedGenerator(
        entry.material,
        entry.molarMassKgPerMol,
        entry.gamma,
        entry.sourceFingerprint
      ),
      viscosityGenerator: createGasDynamicViscosityGenerator(
        entry.material,
        entry.transport,
        entry.sourceFingerprint
      ),
      conductivityGenerator: createGasThermalConductivityGenerator(
        entry.material,
        entry.transport,
        entry.sourceFingerprint
      ),
      impedanceGenerator: createGasAcousticImpedanceGenerator(
        entry.material,
        entry.molarMassKgPerMol,
        entry.gamma,
        entry.sourceFingerprint
      ),
      volHeatCapGenerator: createGasVolumetricHeatCapacityGenerator(
        entry.material,
        entry.molarMassKgPerMol,
        entry.transport,
        entry.sourceFingerprint
      )
    });
    generatorCacheByEntry.set(entry, cached);
  }
  return cached;
}

/**
 * Strict in-box 2-D evaluation for a material's gas density, sound speed,
 * dynamic viscosity, thermal conductivity, acoustic impedance, and volumetric
 * heat capacity (refuses out-of-box or stale-source inputs without ever
 * extrapolating).
 */
export function evaluateMaterialGasResponseCpu(bundle, material, temperatureK, pressurePa) {
  const entry = bundle?.byMaterial?.[material];
  if (!entry) {
    return Object.freeze({
      ok: false,
      reason: 'unknown-gas-material',
      densityKgPerM3: null,
      soundSpeedMPerS: null,
      dynamicViscosityPaS: null,
      thermalConductivityWPerMK: null,
      acousticImpedancePaSPerM: null,
      volumetricHeatCapacityJPerM3K: null
    });
  }
  const {
    densityGenerator,
    soundSpeedGenerator,
    viscosityGenerator,
    conductivityGenerator,
    impedanceGenerator,
    volHeatCapGenerator
  } = generatorsForMaterialEntry(entry);
  const density = evaluateResponseFunction(entry.densityFit, [temperatureK, pressurePa], {
    generator: densityGenerator
  });
  const soundSpeed = evaluateResponseFunction(entry.soundSpeedFit, [temperatureK, pressurePa], {
    generator: soundSpeedGenerator
  });
  const dynamicViscosity = evaluateResponseFunction(entry.dynamicViscosityFit, [temperatureK, pressurePa], {
    generator: viscosityGenerator
  });
  const thermalConductivity = evaluateResponseFunction(entry.thermalConductivityFit, [temperatureK, pressurePa], {
    generator: conductivityGenerator
  });
  const acousticImpedance = evaluateResponseFunction(entry.acousticImpedanceFit, [temperatureK, pressurePa], {
    generator: impedanceGenerator
  });
  const volumetricHeatCapacity = evaluateResponseFunction(
    entry.volumetricHeatCapacityFit,
    [temperatureK, pressurePa],
    { generator: volHeatCapGenerator }
  );
  if (
    !density.ok
    || !soundSpeed.ok
    || !dynamicViscosity.ok
    || !thermalConductivity.ok
    || !acousticImpedance.ok
    || !volumetricHeatCapacity.ok
  ) {
    const failed = [
      density,
      soundSpeed,
      dynamicViscosity,
      thermalConductivity,
      acousticImpedance,
      volumetricHeatCapacity
    ].find((item) => !item.ok);
    return Object.freeze({
      ok: false,
      reason: failed?.reason ?? 'out-of-domain',
      densityKgPerM3: null,
      soundSpeedMPerS: null,
      dynamicViscosityPaS: null,
      thermalConductivityWPerMK: null,
      acousticImpedancePaSPerM: null,
      volumetricHeatCapacityJPerM3K: null
    });
  }
  return Object.freeze({
    ok: true,
    reason: null,
    densityKgPerM3: density.value,
    soundSpeedMPerS: soundSpeed.value,
    dynamicViscosityPaS: dynamicViscosity.value,
    thermalConductivityWPerMK: thermalConductivity.value,
    acousticImpedancePaSPerM: acousticImpedance.value,
    volumetricHeatCapacityJPerM3K: volumetricHeatCapacity.value,
    densityGradient: density.gradient,
    soundSpeedGradient: soundSpeed.gradient,
    dynamicViscosityGradient: dynamicViscosity.gradient,
    thermalConductivityGradient: thermalConductivity.gradient,
    acousticImpedanceGradient: acousticImpedance.gradient,
    volumetricHeatCapacityGradient: volumetricHeatCapacity.gradient,
    relativeBound: Math.max(
      density.relativeBound,
      soundSpeed.relativeBound,
      dynamicViscosity.relativeBound,
      thermalConductivity.relativeBound,
      acousticImpedance.relativeBound,
      volumetricHeatCapacity.relativeBound
    )
  });
}

/**
 * Reusable WGSL snippet providing 2-D `(T, P)` evaluators backed by `rf_eval`
 * (strict in-box evaluation, zero extrapolation).
 */
export function gasResponseFunctionGpuWgsl(tableName = 'gas_rf_table') {
  return /* wgsl */ `
${responseFunctionGpuWgsl(tableName)}
fn a4_gas_density_eval(fn_index: u32, temperature_k: f32, pressure_pa: f32) -> vec2<f32> {
  return rf_eval(fn_index, vec3<f32>(temperature_k, pressure_pa, 0.0));
}
fn a4_gas_sound_speed_eval(fn_index: u32, temperature_k: f32, pressure_pa: f32) -> vec2<f32> {
  return rf_eval(fn_index, vec3<f32>(temperature_k, pressure_pa, 0.0));
}
fn a4_gas_viscosity_eval(fn_index: u32, temperature_k: f32, pressure_pa: f32) -> vec2<f32> {
  return rf_eval(fn_index, vec3<f32>(temperature_k, pressure_pa, 0.0));
}
fn a4_gas_conductivity_eval(fn_index: u32, temperature_k: f32, pressure_pa: f32) -> vec2<f32> {
  return rf_eval(fn_index, vec3<f32>(temperature_k, pressure_pa, 0.0));
}
fn a4_gas_acoustic_impedance_eval(fn_index: u32, temperature_k: f32, pressure_pa: f32) -> vec2<f32> {
  return rf_eval(fn_index, vec3<f32>(temperature_k, pressure_pa, 0.0));
}
fn a4_gas_volumetric_heat_capacity_eval(fn_index: u32, temperature_k: f32, pressure_pa: f32) -> vec2<f32> {
  return rf_eval(fn_index, vec3<f32>(temperature_k, pressure_pa, 0.0));
}
`;
}

/**
 * Resident GPU evaluator for a packed A4 2-D gas response table: accepts a
 * query buffer of `vec4<f32>(fnIndex, temperatureK, pressurePa, 0)` and emits
 * `vec2<f32>(value, ok)` on GPU with strict domain checks.
 */
export function createGasResponseEvaluatorGpu(device, bundle) {
  if (!device?.createBuffer || !device?.createComputePipeline) {
    throw new TypeError('createGasResponseEvaluatorGpu requires a WebGPU device');
  }
  if (!bundle?.packedGpuTable?.data?.length) {
    throw new TypeError('createGasResponseEvaluatorGpu requires a non-empty packed gas response bundle');
  }
  const wgsl = /* wgsl */ `
@group(0) @binding(0) var<storage, read> gas_rf_table: array<f32>;
@group(0) @binding(1) var<storage, read> queries: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> outputs: array<vec2<f32>>;
${gasResponseFunctionGpuWgsl('gas_rf_table')}
@compute @workgroup_size(64)
fn eval_gas_responses(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= arrayLength(&queries)) { return; }
  let q = queries[i];
  let idx = u32(q.x);
  outputs[i] = rf_eval(idx, vec3<f32>(q.y, q.z, 0.0));
}
`;
  const module = device.createShaderModule({ label: 'ulg-a4-gas-response-eval', code: wgsl });
  const layout = device.createBindGroupLayout({
    label: 'ulg-a4-gas-response-eval-layout',
    entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
      { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }
    ]
  });
  const pipeline = device.createComputePipeline({
    label: 'ulg-a4-gas-response-eval-pipeline',
    layout: device.createPipelineLayout({ bindGroupLayouts: [layout] }),
    compute: { module, entryPoint: 'eval_gas_responses' }
  });
  const tableBuffer = device.createBuffer({
    label: 'ulg-a4-gas-response-table',
    size: Math.max(16, bundle.packedGpuTable.data.byteLength),
    usage: 0x80 | 0x08
  });
  device.queue.writeBuffer(tableBuffer, 0, bundle.packedGpuTable.data);

  function encodeEvaluate(encoder, { queriesBuffer, outputsBuffer, queryCount }) {
    const bindGroup = device.createBindGroup({
      label: 'ulg-a4-gas-response-eval-group',
      layout,
      entries: [
        { binding: 0, resource: { buffer: tableBuffer } },
        { binding: 1, resource: { buffer: queriesBuffer } },
        { binding: 2, resource: { buffer: outputsBuffer } }
      ]
    });
    const pass = encoder.beginComputePass({ label: 'ulg-a4-gas-response-eval' });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.max(1, Math.ceil(queryCount / 64)));
    pass.end();
  }

  function destroy() {
    tableBuffer.destroy?.();
  }

  return Object.freeze({
    schema: GAS_RESPONSE_FUNCTIONS_SCHEMA,
    tableBuffer,
    status: bundle.status,
    encodeEvaluate,
    destroy
  });
}
