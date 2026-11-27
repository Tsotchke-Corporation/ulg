// Eshkol Higher-Order Law Compiler & Executable Material Envelope Runtime
// (plan/todo/eshkol-higher-order-law-closure-plan.md).
//
// Higher-order operations transform physical law objects into reusable,
// differentiable response contracts with executable validity envelopes and
// GPU-native per-node envelope watches + atomic debt receipts:
//
//   - defineLawObject   : physical body + unit/state/conservation/envelope contract
//   - specializeLaw     : bind fixed composition, phase, or parameters
//   - composeLaws       : couple law subgraphs with unit & dependency verification
//   - differentiateLaw  : emit tangent / Jacobian / Hessian laws + Eshkol AD form
//   - coarseGrainLaw    : derive sub-grid effective law + Jensen-gap homogeneity test
//   - approximateLaw    : fit A4 Chebyshev tensor OR SS-owned memory-state (z_next = g(z, x, dt))
//   - compileLawToWgsl  : emit validated WGSL evaluator + per-node envelope watch + atomic debt receipt
//   - runCompiledLawEnvelopeWatchWebGpu : execute compiled law + GPU debt receipt natively on WebGPU

import { fitResponseFunction, evaluateResponseFunction } from './localClosureFitCache.js';
import { packResponseFunctionsForGpu, responseFunctionGpuWgsl } from './responseFunctionGpu.js';
import {
  CLOSURE_VALIDATION_STATUS,
  canonicalClosureDomainHash,
  canonicalizeClosureRegimeKey,
  closureEnvelopeAdmits,
  closureInvalidationKey
} from '../closureRegimeStore.js';
import { schroederAuthorityTextFingerprint } from '../sph/schroederAuthorityFingerprint.js';
import { computeBufferBinding, createCachedExplicitComputePipeline } from '../webgpuComputeLayout.js';
import { validateLawAdapterDescriptor } from '../sph/lawAdapterContract.js';
import {
  MLS_MPM_GPU_GRID_VELOCITY_ROW_LAYOUT,
  MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT,
  SPH_GPU_PARTICLE_STATE_ROW_LAYOUT,
  SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT,
  ULG_COMPILED_LAW_IR_WGSL_SCHEMA,
  ULG_LAW_IR_SCHEMA,
  compileLawIrToWgsl,
  createPerParticleTaitEosCavitationLawIr,
  createRepresentedVolumePhaseRetargetLawIr,
  createTaitEosCavitationLawIr,
  differentiateLawIrExpr,
  simplifyLawIrExpr
} from '../../../ulg-gpu-abi/src/index.js';

export {
  ULG_COMPILED_LAW_IR_WGSL_SCHEMA,
  ULG_LAW_IR_SCHEMA,
  compileLawIrToWgsl,
  createPerParticleTaitEosCavitationLawIr,
  createRepresentedVolumePhaseRetargetLawIr,
  createTaitEosCavitationLawIr,
  differentiateLawIrExpr,
  simplifyLawIrExpr
};

export const CANONICAL_ULG_LAW_IR_RESOURCE_LAYOUTS = Object.freeze({
  'sph-particle-state': SPH_GPU_PARTICLE_STATE_ROW_LAYOUT,
  'sph-thermo-phase': SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT,
  'mls-mpm-mechanics': MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT,
  'mls-mpm-grid-velocity': MLS_MPM_GPU_GRID_VELOCITY_ROW_LAYOUT
});

/**
 * Compile a declarative `peercompute.ulg.law-ir.v1` object (authored directly
 * or emitted by Eshkol's portable C WGSL emitter `vm_wgsl_emitter.c`) into a
 * validated WebGPU WGSL compute shader with canonical ABI lane accessors,
 * paired RepresentedVolume guards, symbolic AD, and fail-closed envelope watch.
 */
export function compileDeclarativeLawIrToWgsl(lawIr, {
  resourceLayouts = CANONICAL_ULG_LAW_IR_RESOURCE_LAYOUTS,
  workgroupSize = 64,
  includeEnvelopeWatch = true,
  requireExtendedDescriptor = true
} = {}) {
  if (!lawIr || lawIr.schema !== ULG_LAW_IR_SCHEMA) {
    throw new TypeError(`compileDeclarativeLawIrToWgsl requires schema "${ULG_LAW_IR_SCHEMA}"`);
  }
  const descCheck = validateLawAdapterDescriptor(lawIr.descriptor, {
    requireExtendedMetadata: requireExtendedDescriptor
  });
  if (!descCheck.valid) {
    const err = new Error(
      `Law-IR "${lawIr.id || 'unknown'}" failed Law Adapter Contract validation: ${descCheck.errors.join(', ')}`
    );
    err.code = 'ERR_LAW_IR_DESCRIPTOR_INVALID';
    err.errors = descCheck.errors;
    throw err;
  }
  return compileLawIrToWgsl(lawIr, {
    resourceLayouts: {
      ...CANONICAL_ULG_LAW_IR_RESOURCE_LAYOUTS,
      ...(resourceLayouts || {})
    },
    workgroupSize,
    includeEnvelopeWatch
  });
}

export const ULG_ESHKOL_LAW_OBJECT_SCHEMA = 'peercompute.ulg.eshkol-law-object.v1';
export const ULG_ESHKOL_APPROXIMATED_LAW_SCHEMA = 'peercompute.ulg.eshkol-approximated-law.v1';
export const ULG_ESHKOL_COMPILED_WGSL_LAW_SCHEMA = 'peercompute.ulg.eshkol-compiled-wgsl-law.v1';
export const ULG_ESHKOL_ENVELOPE_WATCH_RECEIPT_SCHEMA = 'peercompute.ulg.eshkol-envelope-watch-receipt.v1';

export const LAW_FALLBACK_POLICY = Object.freeze({
  STRICT: 'strict',
  ASYNC: 'async',
  FROZEN: 'frozen'
});

// 8-word GPU atomic per-node envelope watch & debt receipt layout:
//   [0] hits (in-envelope + homogeneous)
//   [1] domainExitLow
//   [2] domainExitHigh
//   [3] homogeneityBreach
//   [4] nonFiniteInput
//   [5] debtCount (extrapolated/fallback evaluations recorded under async/frozen policy)
//   [6] maxDomainDistanceMicro (u32 fixed-point max normalized overshoot * 1e6)
//   [7] generation
export const LAW_ENVELOPE_RECEIPT_WORDS = 8;

const GPU_BUFFER_USAGE = Object.freeze({
  MAP_READ: 0x0001,
  COPY_SRC: 0x0004,
  COPY_DST: 0x0008,
  UNIFORM: 0x0040,
  STORAGE: 0x0080
});

// 5-point Gauss-Hermite nodes and weights for N(0, 1) coarse-graining integrals
const GAUSS_HERMITE_5 = Object.freeze([
  Object.freeze({ z: -2.8569700138728056, w: 0.011257411327720689 }),
  Object.freeze({ z: -1.3556261799742659, w: 0.22207592200561264 }),
  Object.freeze({ z: 0.0, w: 0.5333333333333333 }),
  Object.freeze({ z: 1.3556261799742659, w: 0.22207592200561264 }),
  Object.freeze({ z: 2.8569700138728056, w: 0.011257411327720689 })
]);

function normalizeAxisList(axes, label) {
  if (!Array.isArray(axes) || axes.length === 0) {
    throw new RangeError(`${label} must name at least one physical coordinate`);
  }
  return Object.freeze(axes.map((axis, idx) => {
    const name = String(axis?.name ?? '').trim();
    if (!name) throw new RangeError(`${label}[${idx}].name is required`);
    return Object.freeze({
      name,
      unit: String(axis?.unit ?? '1').trim() || '1',
      referenceValue: Number.isFinite(Number(axis?.referenceValue)) ? Number(axis.referenceValue) : null
    });
  }));
}

function normalizeStateContract(stateContract = {}) {
  const reads = Array.isArray(stateContract?.reads) ? [...stateContract.reads].map(String) : [];
  const writes = Array.isArray(stateContract?.writes) ? [...stateContract.writes].map(String) : [];
  const accumulates = Array.isArray(stateContract?.accumulates) ? [...stateContract.accumulates].map(String) : [];
  const memoryState = stateContract?.memoryState
    ? Object.freeze({
        name: String(stateContract.memoryState.name || 'z'),
        dimension: Math.max(1, Math.round(Number(stateContract.memoryState.dimension) || 1)),
        unit: String(stateContract.memoryState.unit || '1'),
        ownedBy: 'ss-physical-state',
        replaySafe: true
      })
    : null;
  return Object.freeze({
    reads: Object.freeze(reads),
    writes: Object.freeze(writes),
    accumulates: Object.freeze(accumulates),
    memoryState
  });
}

function normalizeLawEnvelope(envelope = {}) {
  const ranges = {};
  if (envelope?.ranges && typeof envelope.ranges === 'object') {
    for (const [axis, pair] of Object.entries(envelope.ranges)) {
      const lo = Number(pair?.[0]);
      const hi = Number(pair?.[1]);
      if (!Number.isFinite(lo) || !Number.isFinite(hi) || !(hi > lo)) {
        throw new RangeError(`envelope.ranges.${axis} must be [lo, hi] with lo < hi`);
      }
      ranges[axis] = Object.freeze([lo, hi]);
    }
  }
  const temperatureRangeK = envelope?.temperatureRangeK
    ? Object.freeze([Number(envelope.temperatureRangeK[0]), Number(envelope.temperatureRangeK[1])])
    : (ranges.temperature ?? ranges.temperatureK ?? Object.freeze([1, 1e6]));
  const pressureRangePa = envelope?.pressureRangePa
    ? Object.freeze([Number(envelope.pressureRangePa[0]), Number(envelope.pressureRangePa[1])])
    : (ranges.pressure ?? ranges.pressurePa ?? null);
  const densityRangeKgM3 = envelope?.densityRangeKgM3
    ? Object.freeze([Number(envelope.densityRangeKgM3[0]), Number(envelope.densityRangeKgM3[1])])
    : (ranges.density ?? ranges.densityKgM3 ?? null);
  return Object.freeze({
    temperatureRangeK,
    pressureRangePa,
    densityRangeKgM3,
    ranges: Object.freeze(ranges),
    phase: envelope?.phase ?? null,
    structure: envelope?.structure ?? null,
    homogeneityTest: envelope?.homogeneityTest ?? null
  });
}

/**
 * Define a first-class physical law object carrying numerical body, symbolic
 * Eshkol body, unit schema, state ownership contract, conservation invariants,
 * validity envelope, and content-addressed source hash.
 */
export function defineLawObject({
  id,
  version = '1.0.0',
  inputs,
  output = { name: 'response', unit: '1' },
  parameters = {},
  stateContract = {},
  conservationInvariants = [],
  envelope = {},
  fallbackPolicy = LAW_FALLBACK_POLICY.ASYNC,
  sourceMethod = 'analytic-law',
  eshkolBody = null,
  evaluate
} = {}) {
  const lawId = String(id ?? '').trim();
  if (!lawId) throw new RangeError('defineLawObject requires a non-empty id');
  if (typeof evaluate !== 'function') {
    throw new TypeError(`law ${lawId} requires an evaluate(inputObj, params) function`);
  }
  if (!Object.values(LAW_FALLBACK_POLICY).includes(fallbackPolicy)) {
    throw new RangeError(`Unsupported fallbackPolicy: ${fallbackPolicy}`);
  }
  const normalizedInputs = normalizeAxisList(inputs, `${lawId}.inputs`);
  const normalizedOutput = Object.freeze({
    name: String(output?.name ?? 'response').trim() || 'response',
    unit: String(output?.unit ?? '1').trim() || '1'
  });
  const frozenParams = Object.freeze({ ...parameters });
  const normalizedState = normalizeStateContract(stateContract);
  const normalizedEnvelope = normalizeLawEnvelope(envelope);
  const domainHash = canonicalClosureDomainHash(normalizedEnvelope);
  const exprText = eshkolBody
    ? String(eshkolBody)
    : `(define (${lawId.replace(/[^a-zA-Z0-9_-]/g, '-')} ${normalizedInputs.map((a) => a.name).join(' ')}) 'compiled-body)`;
  const sourceHash = schroederAuthorityTextFingerprint(
    JSON.stringify({
      schema: ULG_ESHKOL_LAW_OBJECT_SCHEMA,
      lawId,
      version,
      inputs: normalizedInputs,
      output: normalizedOutput,
      parameters: frozenParams,
      stateContract: normalizedState,
      conservationInvariants,
      domainHash,
      sourceMethod,
      eshkolBody: exprText
    }),
    'eshkol-law'
  );
  return Object.freeze({
    schema: ULG_ESHKOL_LAW_OBJECT_SCHEMA,
    id: lawId,
    version,
    inputs: normalizedInputs,
    output: normalizedOutput,
    parameters: frozenParams,
    stateContract: normalizedState,
    conservationInvariants: Object.freeze([...conservationInvariants].map(String)),
    envelope: normalizedEnvelope,
    domainHash,
    fallbackPolicy,
    sourceMethod: String(sourceMethod),
    eshkolBody: exprText,
    sourceHash,
    dependencies: Object.freeze([sourceHash]),
    evaluate: (inputObj, overrideParams = null) =>
      evaluate(inputObj, overrideParams ? { ...frozenParams, ...overrideParams } : frozenParams)
  });
}

/**
 * Higher-order transformation: Specialize a law by fixing parameters or input
 * coordinates (e.g. composition, phase, reference temperature), preserving
 * assumptions and chaining invalidation hashes.
 */
export function specializeLaw(law, {
  id = `${law?.id || 'law'}:specialized`,
  fixedInputs = {},
  fixedParameters = {},
  envelopeOverride = null
} = {}) {
  if (law?.schema !== ULG_ESHKOL_LAW_OBJECT_SCHEMA) {
    throw new TypeError('specializeLaw requires a law object from defineLawObject');
  }
  const fixedKeys = new Set(Object.keys(fixedInputs));
  const remainingInputs = law.inputs.filter((axis) => !fixedKeys.has(axis.name));
  if (remainingInputs.length === 0) {
    throw new RangeError('specializeLaw must leave at least one free coordinate');
  }
  const mergedParams = { ...law.parameters, ...fixedParameters };
  const mergedRanges = { ...law.envelope.ranges };
  for (const k of fixedKeys) delete mergedRanges[k];
  const mergedEnvelope = {
    ...law.envelope,
    ...(envelopeOverride || {}),
    ranges: { ...mergedRanges, ...(envelopeOverride?.ranges || {}) }
  };
  const specialized = defineLawObject({
    id,
    version: law.version,
    inputs: remainingInputs,
    output: law.output,
    parameters: mergedParams,
    stateContract: law.stateContract,
    conservationInvariants: law.conservationInvariants,
    envelope: mergedEnvelope,
    fallbackPolicy: law.fallbackPolicy,
    sourceMethod: `specialize(${law.sourceMethod})`,
    eshkolBody: `(let (${Object.entries(fixedInputs).map(([k, v]) => `(${k} ${Number(v)})`).join(' ')}) ${law.eshkolBody})`,
    evaluate: (inputObj, params) => law.evaluate({ ...fixedInputs, ...inputObj }, params)
  });
  return Object.freeze({
    ...specialized,
    dependencies: Object.freeze([...law.dependencies, specialized.sourceHash])
  });
}

/**
 * Higher-order transformation: Compose an outer law with one or more inner laws
 * feeding named input coordinates, verifying physical unit compatibility,
 * dependency order, and merged state/invalidation contracts.
 */
export function composeLaws(outerLaw, innerLawMap = {}, {
  id = `${outerLaw?.id || 'law'}:composed`
} = {}) {
  if (outerLaw?.schema !== ULG_ESHKOL_LAW_OBJECT_SCHEMA) {
    throw new TypeError('composeLaws requires an outer law object from defineLawObject');
  }
  const boundEntries = Object.entries(innerLawMap);
  if (boundEntries.length === 0) {
    throw new RangeError('composeLaws requires at least one inner law binding');
  }
  const outerAxisByName = new Map(outerLaw.inputs.map((axis) => [axis.name, axis]));
  const combinedInputMap = new Map();
  const reads = new Set(outerLaw.stateContract.reads);
  const writes = new Set(outerLaw.stateContract.writes);
  const accumulates = new Set(outerLaw.stateContract.accumulates);
  const dependencies = [...outerLaw.dependencies];
  const mergedRanges = { ...outerLaw.envelope.ranges };

  for (const [targetInputName, innerLaw] of boundEntries) {
    if (innerLaw?.schema !== ULG_ESHKOL_LAW_OBJECT_SCHEMA) {
      throw new TypeError(`inner law for ${targetInputName} must come from defineLawObject`);
    }
    const expectedAxis = outerAxisByName.get(targetInputName);
    if (!expectedAxis) {
      throw new RangeError(`outer law ${outerLaw.id} has no input named ${targetInputName}`);
    }
    if (expectedAxis.unit !== innerLaw.output.unit) {
      throw new RangeError(
        `Unit mismatch composing ${innerLaw.id} (${innerLaw.output.unit}) into ${outerLaw.id}.${targetInputName} (${expectedAxis.unit})`
      );
    }
    delete mergedRanges[targetInputName];
    for (const axis of innerLaw.inputs) {
      const existing = combinedInputMap.get(axis.name);
      if (existing && existing.unit !== axis.unit) {
        throw new RangeError(`Conflicting units on shared input ${axis.name}: ${existing.unit} vs ${axis.unit}`);
      }
      combinedInputMap.set(axis.name, axis);
    }
    for (const r of innerLaw.stateContract.reads) reads.add(r);
    for (const w of innerLaw.stateContract.writes) writes.add(w);
    for (const a of innerLaw.stateContract.accumulates) accumulates.add(a);
    for (const dep of innerLaw.dependencies) dependencies.push(dep);
    Object.assign(mergedRanges, innerLaw.envelope.ranges);
  }
  for (const axis of outerLaw.inputs) {
    if (!innerLawMap[axis.name]) {
      combinedInputMap.set(axis.name, axis);
    }
  }
  const composed = defineLawObject({
    id,
    version: outerLaw.version,
    inputs: [...combinedInputMap.values()],
    output: outerLaw.output,
    parameters: outerLaw.parameters,
    stateContract: {
      reads: [...reads],
      writes: [...writes],
      accumulates: [...accumulates],
      memoryState: outerLaw.stateContract.memoryState
    },
    conservationInvariants: outerLaw.conservationInvariants,
    envelope: {
      ...outerLaw.envelope,
      ranges: mergedRanges
    },
    fallbackPolicy: outerLaw.fallbackPolicy,
    sourceMethod: `compose(${outerLaw.sourceMethod})`,
    eshkolBody: `(compose ${outerLaw.id} (${boundEntries.map(([k, v]) => `(${k} ${v.id})`).join(' ')}))`,
    evaluate: (inputObj, params) => {
      const resolved = { ...inputObj };
      for (const [targetInputName, innerLaw] of boundEntries) {
        resolved[targetInputName] = innerLaw.evaluate(inputObj);
      }
      return outerLaw.evaluate(resolved, params);
    }
  });
  return Object.freeze({
    ...composed,
    dependencies: Object.freeze([...new Set([...dependencies, composed.sourceHash])])
  });
}

/**
 * Higher-order transformation: Differentiate a law with respect to a declared
 * input axis (order 1 or 2), producing a first-class tangent/response law with
 * consistent derivative units and an Eshkol AD expression form.
 */
export function differentiateLaw(law, {
  axis,
  order = 1,
  step = 1e-5,
  exactDerivative = null,
  id = null
} = {}) {
  if (law?.schema !== ULG_ESHKOL_LAW_OBJECT_SCHEMA) {
    throw new TypeError('differentiateLaw requires a law object from defineLawObject');
  }
  const axisSpec = law.inputs.find((a) => a.name === axis);
  if (!axisSpec) throw new RangeError(`law ${law.id} has no input axis named ${axis}`);
  const ord = Math.round(Number(order) || 1);
  if (ord !== 1 && ord !== 2) throw new RangeError('differentiateLaw supports order 1 or 2');
  const relH = Math.max(1e-8, Math.min(1e-2, Number(step) || 1e-5));
  const outUnit = ord === 1
    ? `${law.output.unit}/${axisSpec.unit}`
    : `${law.output.unit}/(${axisSpec.unit})^2`;
  const derivedId = id || `${law.id}:d${ord}_${axis}`;
  const evalFn = typeof exactDerivative === 'function'
    ? exactDerivative
    : (inputObj, params) => {
        const x0 = Number(inputObj[axis]);
        const h = Math.max(1e-7, Math.abs(x0) * relH);
        const fPlus = law.evaluate({ ...inputObj, [axis]: x0 + h }, params);
        const fMinus = law.evaluate({ ...inputObj, [axis]: x0 - h }, params);
        if (ord === 1) {
          // 4th-order Richardson extrapolation for high-accuracy derivatives
          const fPlus2 = law.evaluate({ ...inputObj, [axis]: x0 + 2 * h }, params);
          const fMinus2 = law.evaluate({ ...inputObj, [axis]: x0 - 2 * h }, params);
          return (-fPlus2 + 8 * fPlus - 8 * fMinus + fMinus2) / (12 * h);
        }
        const f0 = law.evaluate(inputObj, params);
        return (fPlus - 2 * f0 + fMinus) / (h * h);
      };
  const eshkolExpr = ord === 1
    ? `(derivative (lambda (${axis}) (${law.id} ${law.inputs.map((a) => a.name).join(' ')})) ${axis})`
    : `(derivative (lambda (${axis}) (derivative (lambda (${axis}) (${law.id} ${law.inputs.map((a) => a.name).join(' ')})) ${axis})) ${axis})`;
  const derived = defineLawObject({
    id: derivedId,
    version: law.version,
    inputs: law.inputs,
    output: { name: `d${ord}_${law.output.name}_d${axis}`, unit: outUnit },
    parameters: law.parameters,
    stateContract: law.stateContract,
    conservationInvariants: law.conservationInvariants,
    envelope: law.envelope,
    fallbackPolicy: law.fallbackPolicy,
    sourceMethod: `differentiate(${law.sourceMethod}, ${axis}, order=${ord})`,
    eshkolBody: eshkolExpr,
    evaluate: evalFn
  });
  return Object.freeze({
    ...derived,
    derivativeAxis: axis,
    derivativeOrder: ord,
    dependencies: Object.freeze([...law.dependencies, derived.sourceHash])
  });
}

/**
 * Higher-order transformation: Coarse-grain a microscale law over an unresolved
 * sub-grid distribution (5-point Gauss-Hermite quadrature on the target axis).
 * Computes the Jensen gap |E[f(X)] - f(E[X])| and attaches an executable
 * distribution-aware homogeneity predicate to the returned coarse law so SS
 * nodes with excessive sub-grid variance automatically refine rather than
 * silently using f(mean(x)).
 */
export function coarseGrainLaw(law, {
  axis,
  stdDev,
  varianceTolerance = 1e-2,
  id = `${law?.id || 'law'}:coarse-grained`
} = {}) {
  if (law?.schema !== ULG_ESHKOL_LAW_OBJECT_SCHEMA) {
    throw new TypeError('coarseGrainLaw requires a law object from defineLawObject');
  }
  const axisSpec = law.inputs.find((a) => a.name === axis);
  if (!axisSpec) throw new RangeError(`law ${law.id} has no input axis named ${axis}`);
  const sigma = Number(stdDev);
  if (!Number.isFinite(sigma) || sigma < 0) throw new RangeError('coarseGrainLaw requires finite stdDev >= 0');
  const maxJensen = Math.max(1e-12, Number(varianceTolerance) || 1e-2);

  const evalCoarseWithGap = (inputObj, params) => {
    const meanX = Number(inputObj[axis]);
    const localSigma = Number.isFinite(Number(inputObj?.[`${axis}StdDev`]))
      ? Math.max(0, Number(inputObj[`${axis}StdDev`]))
      : sigma;
    const fMean = law.evaluate(inputObj, params);
    if (localSigma === 0) return { meanValue: fMean, pointValue: fMean, jensenGap: 0, relativeJensenGap: 0 };
    let weighted = 0;
    for (const node of GAUSS_HERMITE_5) {
      const sampleX = meanX + node.z * localSigma;
      weighted += node.w * law.evaluate({ ...inputObj, [axis]: sampleX }, params);
    }
    const jensenGap = Math.abs(weighted - fMean);
    const relativeJensenGap = jensenGap / Math.max(1e-12, Math.abs(weighted));
    return { meanValue: weighted, pointValue: fMean, jensenGap, relativeJensenGap };
  };

  const homogeneityTest = Object.freeze({
    maxJensenResidual: maxJensen,
    ...(axis === 'temperature' || axis === 'temperatureK'
      ? { maxTemperatureVarianceK2: Math.max(1e-9, sigma * sigma * 4) }
      : {}),
    ...(axis === 'density' || axis === 'densityKgM3'
      ? { maxDensityVarianceKg2M6: Math.max(1e-9, sigma * sigma * 4) }
      : {})
  });

  const coarse = defineLawObject({
    id,
    version: law.version,
    inputs: law.inputs,
    output: law.output,
    parameters: law.parameters,
    stateContract: law.stateContract,
    conservationInvariants: law.conservationInvariants,
    envelope: {
      ...law.envelope,
      homogeneityTest
    },
    fallbackPolicy: law.fallbackPolicy,
    sourceMethod: `coarse-grain(${law.sourceMethod}, ${axis}, sigma=${sigma})`,
    eshkolBody: `(coarse-grain-gauss-hermite ${law.id} ${axis} ${sigma})`,
    evaluate: (inputObj, params) => evalCoarseWithGap(inputObj, params).meanValue
  });
  return Object.freeze({
    ...coarse,
    coarseGrainAxis: axis,
    nominalStdDev: sigma,
    varianceTolerance: maxJensen,
    evaluateWithJensenGap: evalCoarseWithGap,
    dependencies: Object.freeze([...law.dependencies, coarse.sourceHash])
  });
}

/**
 * Higher-order transformation: Approximate a law into either:
 *   - 'chebyshev'    : A4 Chebyshev tensor + consistent derivatives + GPU packed table
 *   - 'memory-state' : explicit history-bearing z_next = g(z, inputs, dt); response = h(z, inputs)
 *                      where SS owns mutable physical state z (never hidden inside inference)
 *
 * Separates source-method error, surrogate error, and GPU f32 rounding error.
 */
export function approximateLaw(law, {
  representation = 'chebyshev',
  box = null,
  degrees = null,
  relativeTolerance = 1e-4,
  heldOutPerAxis = 5,
  composition = { generic: 1 },
  regimeStore = null,
  memoryStateUpdate = null,
  memoryStateResponse = null,
  memoryStateDim = 1
} = {}) {
  if (law?.schema !== ULG_ESHKOL_LAW_OBJECT_SCHEMA) {
    throw new TypeError('approximateLaw requires a law object from defineLawObject');
  }
  if (representation === 'memory-state') {
    if (typeof memoryStateUpdate !== 'function' || typeof memoryStateResponse !== 'function') {
      throw new TypeError('memory-state approximation requires memoryStateUpdate(z, inputs, dt) and memoryStateResponse(z, inputs)');
    }
    const dim = Math.max(1, Math.round(Number(memoryStateDim) || 1));
    const memoryContract = Object.freeze({
      schema: 'peercompute.ulg.memory-state-law-contract.v1',
      ownedBy: 'ss-physical-state',
      stateDimension: dim,
      replaySafe: true,
      hiddenRecurrentStateForbidden: true
    });
    const artifact = Object.freeze({
      schema: ULG_ESHKOL_APPROXIMATED_LAW_SCHEMA,
      representation: 'memory-state',
      lawId: law.id,
      sourceHash: law.sourceHash,
      domainHash: law.domainHash,
      dependencies: law.dependencies,
      envelope: law.envelope,
      fallbackPolicy: law.fallbackPolicy,
      memoryContract,
      stepState: (zPrev, inputs, dt) => {
        if (!Number.isFinite(dt) || dt < 0) throw new RangeError('memory-state step requires finite dt >= 0');
        const admission = closureEnvelopeAdmits(law.envelope, inputs);
        const zNext = memoryStateUpdate(zPrev, inputs, dt);
        const response = memoryStateResponse(zNext, inputs);
        return Object.freeze({
          zNext,
          response,
          admitted: admission.admitted,
          admissionReason: admission.reason,
          debtRecorded: !admission.admitted
        });
      },
      errorBudget: Object.freeze({
        sourceMethodUncertainty: 'declared-unvalidated',
        surrogateRelativeBound: 0,
        gpuF32RoundingBound: 1.2e-7
      }),
      scientificValidation: false,
      fullPhysicsValidation: false
    });
    return artifact;
  }

  if (representation !== 'chebyshev') {
    throw new RangeError(`Unsupported approximation representation: ${representation}`);
  }
  if (law.inputs.length < 1 || law.inputs.length > 3) {
    throw new RangeError(`Chebyshev approximation supports 1-3 axes (got ${law.inputs.length})`);
  }
  const resolvedBox = box || law.inputs.map((axis) => {
    const r = law.envelope.ranges?.[axis.name];
    if (!r) throw new RangeError(`Missing approximation box for axis ${axis.name}`);
    return [r[0], r[1]];
  });
  const resolvedDegrees = Array.isArray(degrees)
    ? degrees
    : law.inputs.map(() => (law.inputs.length === 1 ? 12 : 10));
  const responseFunction = fitResponseFunction({
    box: resolvedBox,
    degrees: resolvedDegrees,
    relativeTolerance,
    heldOutPerAxis,
    generator: {
      id: `eshkol-approx:${law.id}`,
      axes: law.inputs.map((a) => ({ name: a.name, unit: a.unit })),
      outputUnit: law.output.unit,
      sourceFingerprint: law.sourceHash,
      regimeOf: () => law.envelope.phase || 'single-phase',
      evaluate(pt) {
        const inputObj = {};
        for (let i = 0; i < law.inputs.length; i += 1) {
          inputObj[law.inputs[i].name] = pt[i];
        }
        return law.evaluate(inputObj);
      }
    }
  });
  const packed = packResponseFunctionsForGpu([responseFunction]);
  const regimeKey = canonicalizeClosureRegimeKey({
    lawId: law.id,
    composition,
    temperatureRangeK: law.envelope.temperatureRangeK,
    pressureRangePa: law.envelope.pressureRangePa,
    densityRangeKgM3: law.envelope.densityRangeKgM3
  });
  const invalidation = Object.freeze({
    inputHash: law.sourceHash,
    methodHash: `eshkol-chebyshev-v1:${resolvedDegrees.join('x')}`,
    domainHash: law.domainHash,
    schemaVersion: ULG_ESHKOL_APPROXIMATED_LAW_SCHEMA,
    abiVersion: 'gpu-abi-a4-v1',
    validationStatus: CLOSURE_VALIDATION_STATUS.WARN
  });
  const invalidationKey = closureInvalidationKey(invalidation);
  let regimeRecord = null;
  if (regimeStore && typeof regimeStore.registerClosure === 'function') {
    regimeRecord = regimeStore.registerClosure({
      regimeKey,
      envelope: law.envelope,
      artifact: { packed, responseFunction },
      provenance: {
        kind: 'derived-eshkol-higher-order-law',
        lawId: law.id,
        sourceMethod: law.sourceMethod,
        sourceHash: law.sourceHash
      },
      invalidation
    });
  }
  return Object.freeze({
    schema: ULG_ESHKOL_APPROXIMATED_LAW_SCHEMA,
    representation: 'chebyshev',
    lawId: law.id,
    inputs: law.inputs,
    output: law.output,
    sourceHash: law.sourceHash,
    domainHash: law.domainHash,
    dependencies: law.dependencies,
    envelope: law.envelope,
    fallbackPolicy: law.fallbackPolicy,
    responseFunction,
    packed,
    regimeKey,
    invalidation,
    invalidationKey,
    regimeRecord,
    evaluateHost: (pt) => evaluateResponseFunction(responseFunction, pt),
    errorBudget: Object.freeze({
      sourceMethodUncertainty: 'declared-unvalidated',
      surrogateRelativeBound: responseFunction.residuals.relativeBound,
      gpuF32RoundingBound: 1.2e-7
    }),
    scientificValidation: false,
    fullPhysicsValidation: false
  });
}

/**
 * Higher-order transformation: Compile an approximated law into a validated
 * WebGPU WGSL module containing:
 *   1. Resident Chebyshev evaluator + consistent gradient (`rf_eval_differential`)
 *   2. Per-node GPU envelope & homogeneity predicate (fail-closed on non-finite,
 *      domain exit, or sub-grid homogeneity exceedance)
 *   3. 8-word atomic GPU envelope watch & debt receipt (zero silent extrapolation)
 */
export function compileLawToWgsl(approximatedLaw, {
  fnPrefix = 'eshkol_law',
  generation = 1,
  resourceLayouts = CANONICAL_ULG_LAW_IR_RESOURCE_LAYOUTS,
  workgroupSize = 64,
  includeEnvelopeWatch = true
} = {}) {
  if (approximatedLaw?.schema === ULG_LAW_IR_SCHEMA) {
    return compileDeclarativeLawIrToWgsl(approximatedLaw, {
      resourceLayouts,
      workgroupSize,
      includeEnvelopeWatch
    });
  }
  if (approximatedLaw?.schema !== ULG_ESHKOL_APPROXIMATED_LAW_SCHEMA || approximatedLaw.representation !== 'chebyshev') {
    throw new TypeError('compileLawToWgsl requires a chebyshev approximatedLaw or a peercompute.ulg.law-ir.v1 object');
  }
  const safePrefix = String(fnPrefix).replace(/[^a-zA-Z0-9_]/g, '_') || 'eshkol_law';
  const axes = approximatedLaw.responseFunction.axes;
  const homog = approximatedLaw.envelope?.homogeneityTest;
  const maxVarT = Number.isFinite(Number(homog?.maxTemperatureVarianceK2))
    ? Number(homog.maxTemperatureVarianceK2)
    : 1e30;
  const maxGradT = Number.isFinite(Number(homog?.maxTemperatureGradientKPerM))
    ? Number(homog.maxTemperatureGradientKPerM)
    : 1e30;
  const maxJensen = Number.isFinite(Number(homog?.maxJensenResidual))
    ? Number(homog.maxJensenResidual)
    : 1e30;
  const hasHomogeneityGate = Boolean(
    homog && (
      homog.maxTemperatureVarianceK2 != null
      || homog.maxTemperatureGradientKPerM != null
      || homog.maxJensenResidual != null
    )
  );
  const lo = [0, 1, 2].map((i) => Math.fround(axes[i]?.lo ?? -1e30));
  const hi = [0, 1, 2].map((i) => Math.fround(axes[i]?.hi ?? 1e30));
  const activeAxes = axes.length;
  const fallbackCode = approximatedLaw.fallbackPolicy === LAW_FALLBACK_POLICY.STRICT
    ? 0
    : (approximatedLaw.fallbackPolicy === LAW_FALLBACK_POLICY.FROZEN ? 2 : 1);

  const wgsl = /* wgsl */ `
// Generated by ULG Eshkol Higher-Order Law Compiler (${ULG_ESHKOL_COMPILED_WGSL_LAW_SCHEMA})
// Law: ${approximatedLaw.lawId} | sourceHash: ${approximatedLaw.sourceHash} | domainHash: ${approximatedLaw.domainHash}
struct ${safePrefix}_Params {
  query_count: u32,
  generation: u32,
  fallback_policy: u32, // 0=strict, 1=async, 2=frozen
  homogeneity_enabled: u32,
  homog_limits: vec4<f32>, // (maxVarT, maxGradT, maxJensen, 0)
};

@group(0) @binding(0) var<uniform> ${safePrefix}_params: ${safePrefix}_Params;
@group(0) @binding(1) var<storage, read> ${safePrefix}_table: array<f32>;
@group(0) @binding(2) var<storage, read> ${safePrefix}_queries: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> ${safePrefix}_homog: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> ${safePrefix}_outputs: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> ${safePrefix}_receipt: array<atomic<u32>>;

${responseFunctionGpuWgsl(`${safePrefix}_table`)}

fn ${safePrefix}_envelope_status(x: vec3<f32>, h: vec4<f32>) -> vec2<f32> {
  let lo = vec3<f32>(${lo[0]}, ${lo[1]}, ${lo[2]});
  let hi = vec3<f32>(${hi[0]}, ${hi[1]}, ${hi[2]});
  var overshoot = 0.0;
  for (var a = 0u; a < ${activeAxes}u; a = a + 1u) {
    let v = x[a];
    if (!(v == v) || abs(v) > 3.4028234e38) {
      return vec2<f32>(4.0, 1.0); // non-finite input
    }
    let span = max(1e-12, hi[a] - lo[a]);
    if (v < lo[a]) {
      overshoot = max(overshoot, (lo[a] - v) / span);
      return vec2<f32>(1.0, overshoot); // domain exit low
    }
    if (v > hi[a]) {
      overshoot = max(overshoot, (v - hi[a]) / span);
      return vec2<f32>(2.0, overshoot); // domain exit high
    }
  }
  if (${safePrefix}_params.homogeneity_enabled == 1u) {
    // Missing/negative homogeneity summary fails CLOSED (h.w < 0.5 means missing)
    if (h.w < 0.5 || !(h.x == h.x) || !(h.y == h.y) || !(h.z == h.z) || h.x < 0.0 || h.y < 0.0 || h.z < 0.0) {
      return vec2<f32>(3.0, 1.0);
    }
    if (h.x > ${safePrefix}_params.homog_limits.x || h.y > ${safePrefix}_params.homog_limits.y || h.z > ${safePrefix}_params.homog_limits.z) {
      return vec2<f32>(3.0, 1.0);
    }
  }
  return vec2<f32>(0.0, 0.0); // admitted
}

@compute @workgroup_size(64)
fn ${safePrefix}_eval_watched(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= ${safePrefix}_params.query_count) { return; }
  if (idx == 0u) {
    atomicStore(&${safePrefix}_receipt[7], ${safePrefix}_params.generation);
  }
  let q = ${safePrefix}_queries[idx];
  let h = ${safePrefix}_homog[idx];
  let env = ${safePrefix}_envelope_status(q.xyz, h);
  let code = u32(env.x);
  if (code == 0u) {
    let d = rf_eval_differential(0u, q.xyz);
    if (d.ok == 1u) {
      atomicAdd(&${safePrefix}_receipt[0], 1u);
      ${safePrefix}_outputs[idx] = vec4<f32>(d.value, d.gradient.x, d.gradient.y, 1.0);
      return;
    }
  }
  // Envelope breach: record exact exit reason & debt — never silently extrapolate!
  if (code == 1u) { atomicAdd(&${safePrefix}_receipt[1], 1u); }
  else if (code == 2u) { atomicAdd(&${safePrefix}_receipt[2], 1u); }
  else if (code == 3u) { atomicAdd(&${safePrefix}_receipt[3], 1u); }
  else { atomicAdd(&${safePrefix}_receipt[4], 1u); }
  let dist_micro = u32(clamp(env.y * 1000000.0, 0.0, 4294967000.0));
  atomicMax(&${safePrefix}_receipt[6], dist_micro);
  if (${safePrefix}_params.fallback_policy == 0u) {
    // Strict policy: hold/reject output (ok = 0.0)
    ${safePrefix}_outputs[idx] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
    return;
  }
  // Async / frozen policy: evaluate clamped boundary + increment explicit debt counter
  atomicAdd(&${safePrefix}_receipt[5], 1u);
  let lo = vec3<f32>(${lo[0]}, ${lo[1]}, ${lo[2]});
  let hi = vec3<f32>(${hi[0]}, ${hi[1]}, ${hi[2]});
  let clamped = clamp(q.xyz, lo, hi);
  let d = rf_eval_differential(0u, clamped);
  ${safePrefix}_outputs[idx] = vec4<f32>(d.value, d.gradient.x, d.gradient.y, 0.0);
}
`;

  const wgslHash = schroederAuthorityTextFingerprint(wgsl, 'eshkol-wgsl');
  return Object.freeze({
    schema: ULG_ESHKOL_COMPILED_WGSL_LAW_SCHEMA,
    lawId: approximatedLaw.lawId,
    fnPrefix: safePrefix,
    entryPoint: `${safePrefix}_eval_watched`,
    generation: Math.max(1, Math.round(Number(generation) || 1)),
    fallbackPolicy: approximatedLaw.fallbackPolicy,
    fallbackCode,
    hasHomogeneityGate,
    homogeneityLimits: Object.freeze([maxVarT, maxGradT, maxJensen, 0]),
    sourceHash: approximatedLaw.sourceHash,
    domainHash: approximatedLaw.domainHash,
    wgslHash,
    packed: approximatedLaw.packed,
    wgsl
  });
}

/**
 * Execute a compiled higher-order law + GPU per-node envelope watch natively
 * on WebGPU, returning evaluated values, consistent derivatives, admission flags,
 * and the 8-word atomic GPU envelope/debt receipt.
 */
export async function runCompiledLawEnvelopeWatchWebGpu(device, compiledLaw, {
  queryPoints,
  homogeneityStats = null
} = {}) {
  if (compiledLaw?.schema !== ULG_ESHKOL_COMPILED_WGSL_LAW_SCHEMA) {
    throw new TypeError('runCompiledLawEnvelopeWatchWebGpu requires a compiledLaw from compileLawToWgsl');
  }
  if (!Array.isArray(queryPoints) || queryPoints.length === 0) {
    throw new RangeError('runCompiledLawEnvelopeWatchWebGpu requires non-empty queryPoints');
  }
  const n = queryPoints.length;
  const queryRows = new Float32Array(n * 4);
  const homogRows = new Float32Array(n * 4);
  for (let i = 0; i < n; i += 1) {
    const pt = queryPoints[i];
    queryRows[i * 4] = Number(pt?.[0] ?? 0);
    queryRows[i * 4 + 1] = Number(pt?.[1] ?? 0);
    queryRows[i * 4 + 2] = Number(pt?.[2] ?? 0);
    queryRows[i * 4 + 3] = 0;
    const h = Array.isArray(homogeneityStats) ? homogeneityStats[i] : null;
    if (h && typeof h === 'object') {
      homogRows[i * 4] = Number(h.temperatureVarianceK2 ?? 0);
      homogRows[i * 4 + 1] = Number(h.temperatureGradientKPerM ?? 0);
      homogRows[i * 4 + 2] = Number(h.jensenResidual ?? 0);
      homogRows[i * 4 + 3] = h.present === false ? 0 : 1;
    } else {
      homogRows[i * 4 + 3] = compiledLaw.hasHomogeneityGate ? 0 : 1;
    }
  }
  const paramsBufData = new ArrayBuffer(32);
  const pu = new Uint32Array(paramsBufData);
  const pf = new Float32Array(paramsBufData);
  pu[0] = n;
  pu[1] = compiledLaw.generation;
  pu[2] = compiledLaw.fallbackCode;
  pu[3] = compiledLaw.hasHomogeneityGate ? 1 : 0;
  pf[4] = Math.fround(compiledLaw.homogeneityLimits[0]);
  pf[5] = Math.fround(compiledLaw.homogeneityLimits[1]);
  pf[6] = Math.fround(compiledLaw.homogeneityLimits[2]);
  pf[7] = 0;

  const makeBuf = (label, dataOrSize, usage) => {
    const size = typeof dataOrSize === 'number' ? Math.max(16, dataOrSize) : Math.max(16, dataOrSize.byteLength);
    const buf = device.createBuffer({ label, size, usage: usage | GPU_BUFFER_USAGE.COPY_DST });
    if (typeof dataOrSize !== 'number') device.queue.writeBuffer(buf, 0, dataOrSize);
    return buf;
  };
  const paramsBuf = makeBuf('ulg-elaw-params', paramsBufData, GPU_BUFFER_USAGE.UNIFORM);
  const tableBuf = makeBuf('ulg-elaw-table', compiledLaw.packed.data, GPU_BUFFER_USAGE.STORAGE);
  const queryBuf = makeBuf('ulg-elaw-queries', queryRows, GPU_BUFFER_USAGE.STORAGE);
  const homogBuf = makeBuf('ulg-elaw-homog', homogRows, GPU_BUFFER_USAGE.STORAGE);
  const outBuf = makeBuf('ulg-elaw-out', n * 16, GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC);
  const receiptBuf = makeBuf('ulg-elaw-receipt', new Uint32Array(LAW_ENVELOPE_RECEIPT_WORDS), GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC);
  const readOut = device.createBuffer({ label: 'ulg-elaw-read-out', size: n * 16, usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST });
  const readReceipt = device.createBuffer({ label: 'ulg-elaw-read-receipt', size: LAW_ENVELOPE_RECEIPT_WORDS * 4, usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST });

  try {
    const { pipeline, bindGroupLayout } = createCachedExplicitComputePipeline(device, {
      cacheKey: `eshkol-law-watched:${compiledLaw.wgslHash}`,
      label: `ulg-eshkol-law-${compiledLaw.fnPrefix}`,
      code: compiledLaw.wgsl,
      entryPoint: compiledLaw.entryPoint,
      bindings: [
        computeBufferBinding(0, 'uniform'),
        computeBufferBinding(1, 'read-only-storage'),
        computeBufferBinding(2, 'read-only-storage'),
        computeBufferBinding(3, 'read-only-storage'),
        computeBufferBinding(4, 'storage'),
        computeBufferBinding(5, 'storage')
      ]
    });
    const bg = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: paramsBuf } },
        { binding: 1, resource: { buffer: tableBuf } },
        { binding: 2, resource: { buffer: queryBuf } },
        { binding: 3, resource: { buffer: homogBuf } },
        { binding: 4, resource: { buffer: outBuf } },
        { binding: 5, resource: { buffer: receiptBuf } }
      ]
    });
    const encoder = device.createCommandEncoder({ label: 'ulg-eshkol-law-watched' });
    const pass = encoder.beginComputePass({ label: 'ulg-eshkol-law-watched-pass' });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(Math.ceil(n / 64));
    pass.end();
    encoder.copyBufferToBuffer(outBuf, 0, readOut, 0, n * 16);
    encoder.copyBufferToBuffer(receiptBuf, 0, readReceipt, 0, LAW_ENVELOPE_RECEIPT_WORDS * 4);
    device.queue.submit([encoder.finish()]);
    await Promise.all([readOut.mapAsync(GPU_BUFFER_USAGE.MAP_READ), readReceipt.mapAsync(GPU_BUFFER_USAGE.MAP_READ)]);
    const outFloats = new Float32Array(readOut.getMappedRange().slice(0));
    const receiptWords = new Uint32Array(readReceipt.getMappedRange().slice(0));
    readOut.unmap();
    readReceipt.unmap();
    const results = [];
    for (let i = 0; i < n; i += 1) {
      results.push(Object.freeze({
        value: outFloats[i * 4],
        grad0: outFloats[i * 4 + 1],
        grad1: outFloats[i * 4 + 2],
        admitted: outFloats[i * 4 + 3] === 1
      }));
    }
    return Object.freeze({
      schema: ULG_ESHKOL_ENVELOPE_WATCH_RECEIPT_SCHEMA,
      lawId: compiledLaw.lawId,
      sourceHash: compiledLaw.sourceHash,
      domainHash: compiledLaw.domainHash,
      fallbackPolicy: compiledLaw.fallbackPolicy,
      results: Object.freeze(results),
      receipt: Object.freeze({
        hits: receiptWords[0],
        domainExitLow: receiptWords[1],
        domainExitHigh: receiptWords[2],
        homogeneityBreach: receiptWords[3],
        nonFiniteInput: receiptWords[4],
        debtCount: receiptWords[5],
        maxNormalizedOvershoot: receiptWords[6] / 1e6,
        generation: receiptWords[7]
      })
    });
  } finally {
    for (const b of [paramsBuf, tableBuf, queryBuf, homogBuf, outBuf, receiptBuf, readOut, readReceipt]) {
      b.destroy();
    }
  }
}
