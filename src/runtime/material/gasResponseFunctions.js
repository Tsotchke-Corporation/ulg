// A4 multidimensional first-principles gas response functions
// (plan/todo/a3-a4-regional-and-multidimensional-closures.md).
//
// Derives deterministic 2-D tensor Chebyshev response functions over
// (T [K], P [Pa]) for every gas-phase material in a scene's materialProperties:
//   - density(T, P)    = P * M / (R * T)                [kg/m^3], d/dT < 0, d/dP > 0
//   - soundSpeed(T, P) = sqrt(gamma * (R / M) * T)      [m/s],    d/dT > 0
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

const AVOGADRO_R = 8.314462618;
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

/**
 * Derive and pack 2-D first-principles (T, P) gas response functions for every
 * gas-capable material in `materialProperties`.
 */
export function buildMaterialGasResponseFunctions(materialProperties = {}, {
  temperatureDomainK = DEFAULT_TEMPERATURE_DOMAIN_K,
  pressureDomainPa = DEFAULT_PRESSURE_DOMAIN_PA,
  densityDegrees = [14, 1],
  soundSpeedDegrees = [12, 1],
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
    const sourceFingerprint = schroederAuthorityTextFingerprint(
      JSON.stringify({
        schema: GAS_RESPONSE_FUNCTIONS_SCHEMA,
        material,
        molarMassKgPerMol,
        gamma
      }),
      `a4-gas-${material}`
    );

    const densityGenerator = createGasDensityGenerator(material, molarMassKgPerMol, sourceFingerprint);
    const soundSpeedGenerator = createGasSoundSpeedGenerator(material, molarMassKgPerMol, gamma, sourceFingerprint);

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

    const densityIndex = functions.length;
    functions.push(densityFit);
    const soundSpeedIndex = functions.length;
    functions.push(soundSpeedFit);

    maxRelativeResidualBound = Math.max(
      maxRelativeResidualBound,
      densityFit.residuals.relativeBound,
      soundSpeedFit.residuals.relativeBound
    );

    byMaterial[material] = Object.freeze({
      material,
      materialId: stableOpticalMaterialId(material),
      molarMassKgPerMol,
      gamma,
      sourceFingerprint,
      densityIndex,
      soundSpeedIndex,
      densityFit,
      soundSpeedFit
    });
  }

  const packedGpuTable = functions.length > 0
    ? packResponseFunctionsForGpu(functions)
    : null;

  const status = Object.freeze({
    schema: GAS_RESPONSE_FUNCTIONS_SCHEMA,
    gpuTableSchema: packedGpuTable?.schema ?? RESPONSE_FUNCTION_GPU_SCHEMA,
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
      )
    });
    generatorCacheByEntry.set(entry, cached);
  }
  return cached;
}

/**
 * Strict in-box 2-D evaluation for a material's gas density and sound speed
 * (refuses out-of-box or stale-source inputs without ever extrapolating).
 */
export function evaluateMaterialGasResponseCpu(bundle, material, temperatureK, pressurePa) {
  const entry = bundle?.byMaterial?.[material];
  if (!entry) {
    return Object.freeze({
      ok: false,
      reason: 'unknown-gas-material',
      densityKgPerM3: null,
      soundSpeedMPerS: null
    });
  }
  const { densityGenerator, soundSpeedGenerator } = generatorsForMaterialEntry(entry);
  const density = evaluateResponseFunction(entry.densityFit, [temperatureK, pressurePa], {
    generator: densityGenerator
  });
  const soundSpeed = evaluateResponseFunction(entry.soundSpeedFit, [temperatureK, pressurePa], {
    generator: soundSpeedGenerator
  });
  if (!density.ok || !soundSpeed.ok) {
    return Object.freeze({
      ok: false,
      reason: !density.ok ? density.reason : soundSpeed.reason,
      densityKgPerM3: null,
      soundSpeedMPerS: null
    });
  }
  return Object.freeze({
    ok: true,
    reason: null,
    densityKgPerM3: density.value,
    soundSpeedMPerS: soundSpeed.value,
    densityGradient: density.gradient,
    soundSpeedGradient: soundSpeed.gradient,
    relativeBound: Math.max(density.relativeBound, soundSpeed.relativeBound)
  });
}

/**
 * Reusable WGSL snippet providing `a4_gas_density_eval(fn_index, T, P)` and
 * `a4_gas_sound_speed_eval(fn_index, T, P)` backed by `rf_eval` (strict, zero
 * extrapolation).
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
