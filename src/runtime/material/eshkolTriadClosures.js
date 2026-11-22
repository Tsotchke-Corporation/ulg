import { fitResponseFunction, evaluateResponseFunction } from './localClosureFitCache.js';
import {
  RESPONSE_FUNCTION_GPU_SCHEMA,
  packResponseFunctionsForGpu,
  responseFunctionGpuWgsl
} from './responseFunctionGpu.js';
import { schroederAuthorityTextFingerprint } from '../sph/schroederAuthorityFingerprint.js';

export const ULG_ESHKOL_TRIAD_CLOSURES_SCHEMA = 'peercompute.ulg.eshkol-triad-closures.v1';

const AVOGADRO_R = 8.314462618;

const lit = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new RangeError('Eshkol triad closure parameter must be finite');
  return n.toPrecision(17);
};

function requirePositive(value, label) {
  const n = Number(value);
  if (!Number.isFinite(n) || !(n > 0)) {
    throw new RangeError(`${label} must be a positive finite number`);
  }
  return n;
}

/**
 * Eshkol AD program for the unified Helmholtz free-energy potential a(T, v) [J/kg]:
 *
 *   a(T, v) = u0 - cv * T * (ln(T / T0) - 1) - R_s * T * ln(v / v0)
 *             + 0.5 * K0 * v0 * (v / v0 - 1)^2
 *
 * From this ONE potential (and its exact Eshkol AD / GPU rf_eval_differential
 * derivatives), Maxwell relations hold identically:
 *   s   = -da/dT
 *   P   = -da/dv
 *   c_v = -T * d^2a/dT^2 > 0
 *   K_T =  v * d^2a/dv^2 > 0
 */
export function eshkolHelmholtzProgram({
  material = 'generic',
  cvJPerKgK = 1000,
  rSpecificJPerKgK = 287.05,
  bulkModulusPa = 2.0e9,
  refTemperatureK = 300,
  refSpecificVolumeM3PerKg = 1e-3,
  refInternalEnergyJPerKg = 0
} = {}) {
  const cv = requirePositive(cvJPerKgK, 'cvJPerKgK');
  const rs = requirePositive(rSpecificJPerKgK, 'rSpecificJPerKgK');
  const k0 = requirePositive(bulkModulusPa, 'bulkModulusPa');
  const t0 = requirePositive(refTemperatureK, 'refTemperatureK');
  const v0 = requirePositive(refSpecificVolumeM3PerKg, 'refSpecificVolumeM3PerKg');
  const u0 = Number(refInternalEnergyJPerKg) || 0;

  const definition = `(define (helmholtz-a T v)
  (+ ${lit(u0)}
     (* (- ${lit(cv)}) T (- (log (/ T ${lit(t0)})) 1.0))
     (* (- ${lit(rs)}) T (log (/ v ${lit(v0)})))
     (* 0.5 ${lit(k0)} ${lit(v0)} (expt (- (/ v ${lit(v0)}) 1.0) 2.0))))
(define (helmholtz-s T v) (- (derivative (lambda (tau) (helmholtz-a tau v)) T)))
(define (helmholtz-p T v) (- (derivative (lambda (vol) (helmholtz-a T vol)) v)))
(define (helmholtz-cv T v) (* (- T) (derivative (lambda (tau) (derivative (lambda (t2) (helmholtz-a t2 v)) tau)) T)))
(define (helmholtz-kt T v) (* v (derivative (lambda (vol) (derivative (lambda (v2) (helmholtz-a T v2)) vol)) v)))`;

  const closedForm = {
    a: (T, v) => (
      u0
      - cv * T * (Math.log(T / t0) - 1)
      - rs * T * Math.log(v / v0)
      + 0.5 * k0 * v0 * ((v / v0) - 1) ** 2
    ),
    s: (T, v) => cv * Math.log(T / t0) + rs * Math.log(v / v0),
    p: (T, v) => (rs * T) / v - k0 * ((v / v0) - 1),
    cv: () => cv,
    kt: (T, v) => (rs * T) / v + k0 * (v / v0)
  };

  const sourceFingerprint = schroederAuthorityTextFingerprint(
    `eshkol-helmholtz:v1:${material}:${definition}`,
    'eshkol-helmholtz'
  );
  return Object.freeze({
    material,
    definition,
    call: 'helmholtz-a',
    closedForm,
    parameters: Object.freeze({ cv, rs, k0, t0, v0, u0 }),
    sourceFingerprint
  });
}

/**
 * Eshkol AD program for solid hyperelastic-thermal free energy Psi(J, T) [J/m^3]:
 *
 *   mu(T)     = mu0 * max(0.05, 1 - beta_mu * (T - T0) / T_melt)
 *   lambda(T) = lambda0 * max(0.05, 1 - beta_lam * (T - T0) / T_melt)
 *   J_th(T)   = 1 + 3 * alpha0 * (T - T0)
 *   J_el      = J / J_th(T)
 *   Psi(J, T) = 0.5 * K_s(T) * (J_el - 1)^2 + mu(T) * (J_el^(2/3) - 1 - (2/3) ln(J_el))
 *
 * Returns volumetric strain energy density Psi(J, T) and temperature-softened
 * Lamé moduli / thermal expansion for solid constitutive GPU kernels.
 */
export function eshkolSolidHyperelasticProgram({
  material = 'fe-solid',
  lameLambda0Pa = 115e9,
  lameMu0Pa = 82e9,
  thermalExpansionPerK = 1.2e-5,
  refTemperatureK = 300,
  meltTemperatureK = 1811,
  softeningCoeff = 0.35
} = {}) {
  const lam0 = requirePositive(lameLambda0Pa, 'lameLambda0Pa');
  const mu0 = requirePositive(lameMu0Pa, 'lameMu0Pa');
  const alpha0 = requirePositive(thermalExpansionPerK, 'thermalExpansionPerK');
  const t0 = requirePositive(refTemperatureK, 'refTemperatureK');
  const tm = requirePositive(meltTemperatureK, 'meltTemperatureK');
  const beta = Math.max(0, Math.min(0.8, Number(softeningCoeff) || 0.35));
  const k0 = lam0 + (2 / 3) * mu0;

  const psiOffset = 0.1 * k0;
  const definition = `(define (solid-soften T) (- 1.0 (* ${lit(beta)} (/ (- T ${lit(t0)}) ${lit(tm)}))))
(define (solid-j-th T) (+ 1.0 (* 3.0 ${lit(alpha0)} (- T ${lit(t0)}))))
(define (solid-psi J T)
  (let ((s (solid-soften T)) (jel (/ J (solid-j-th T))))
    (+ ${lit(psiOffset)}
       (* 0.5 ${lit(k0)} s (expt (- jel 1.0) 2.0))
       (* ${lit(mu0)} s (- (expt jel (/ 2.0 3.0)) 1.0 (* (/ 2.0 3.0) (log jel)))))))
(define (solid-pressure J T) (- (derivative (lambda (j) (solid-psi j T)) J)))
(define (solid-mu T) (* ${lit(mu0)} (solid-soften T)))
(define (solid-lambda T) (* ${lit(lam0)} (solid-soften T)))`;

  const soften = (T) => Math.max(0.05, 1 - beta * ((T - t0) / tm));
  const jTh = (T) => 1 + 3 * alpha0 * (T - t0);
  const closedForm = {
    psi: (J, T) => {
      const s = soften(T);
      const jel = J / jTh(T);
      return psiOffset + 0.5 * k0 * s * (jel - 1) ** 2 + mu0 * s * (Math.cbrt(jel * jel) - 1 - (2 / 3) * Math.log(jel));
    },
    mu: (T) => mu0 * soften(T),
    lambda: (T) => lam0 * soften(T),
    alpha: () => alpha0
  };
  const sourceFingerprint = schroederAuthorityTextFingerprint(
    `eshkol-solid-hyperelastic:v1:${material}:${definition}`,
    'eshkol-solid-hyperelastic'
  );
  return Object.freeze({
    material,
    definition,
    call: 'solid-psi',
    closedForm,
    parameters: Object.freeze({ lam0, mu0, k0, alpha0, t0, tm, beta }),
    sourceFingerprint
  });
}

/**
 * Eshkol AD programs for 2D (T, rho) transport closures:
 *   - k(T, rho)  : Sutherland thermal conductivity + Enskog dense-fluid enhancement
 *   - mu(T, rho) : Sutherland dynamic viscosity + Enskog dense-fluid enhancement
 *   - D(T, rho)  : Chapman-Enskog binary diffusivity D0 * (T/T0)^1.5 * (rho0/rho)
 */
export function eshkolTransportPrograms({
  material = 'h2o',
  refTemperatureK = 300,
  refDensityKgPerM3 = 1.2,
  sutherlandK = 120,
  kRefWPerMK = 0.026,
  muRefPaS = 1.85e-5,
  diffusivityRefM2PerS = 2.2e-5,
  enskogDensityCoeff = 0.12
} = {}) {
  const t0 = requirePositive(refTemperatureK, 'refTemperatureK');
  const rho0 = requirePositive(refDensityKgPerM3, 'refDensityKgPerM3');
  const suth = requirePositive(sutherlandK, 'sutherlandK');
  const kRef = requirePositive(kRefWPerMK, 'kRefWPerMK');
  const muRef = requirePositive(muRefPaS, 'muRefPaS');
  const dRef = requirePositive(diffusivityRefM2PerS, 'diffusivityRefM2PerS');
  const bDens = Math.max(0, Number(enskogDensityCoeff) || 0.12);

  const suthExpr = `(* (expt (/ T ${lit(t0)}) 1.5) (/ (+ ${lit(t0)} ${lit(suth)}) (+ T ${lit(suth)})))`;
  const enskogExpr = `(+ 1.0 (* ${lit(bDens)} (/ rho ${lit(rho0)})))`;

  const definition = `(define (transport-k T rho) (* ${lit(kRef)} ${suthExpr} ${enskogExpr}))
(define (transport-mu T rho) (* ${lit(muRef)} ${suthExpr} ${enskogExpr}))
(define (transport-D T rho) (* ${lit(dRef)} (expt (/ T ${lit(t0)}) 1.5) (/ ${lit(rho0)} rho)))`;

  const suthVal = (T) => Math.pow(T / t0, 1.5) * ((t0 + suth) / (T + suth));
  const enskogVal = (rho) => 1 + bDens * (rho / rho0);
  const closedForm = {
    k: (T, rho) => kRef * suthVal(T) * enskogVal(rho),
    mu: (T, rho) => muRef * suthVal(T) * enskogVal(rho),
    D: (T, rho) => dRef * Math.pow(T / t0, 1.5) * (rho0 / rho)
  };
  const sourceFingerprint = schroederAuthorityTextFingerprint(
    `eshkol-transport:v1:${material}:${definition}`,
    'eshkol-transport'
  );
  return Object.freeze({
    material,
    definition,
    calls: Object.freeze({ k: 'transport-k', mu: 'transport-mu', D: 'transport-D' }),
    closedForm,
    parameters: Object.freeze({ t0, rho0, suth, kRef, muRef, dRef, bDens }),
    sourceFingerprint
  });
}

async function sampleAndFit2D({
  sample,
  definition,
  call,
  closedFormFn,
  id,
  sourceFingerprint,
  axes,
  outputUnit,
  box,
  degrees,
  signs = null,
  relativeTolerance = 1e-5,
  heldOutPerAxis = 5
}) {
  const requested = [];
  const seen = new Set();
  const keyOf = ([x, y]) => `${Number(x).toPrecision(17)}|${Number(y).toPrecision(17)}`;

  // Pass 1: deterministically collect all Chebyshev + held-out probe points.
  fitResponseFunction({
    box,
    degrees,
    relativeTolerance: 1,
    heldOutPerAxis,
    generator: {
      id: `${id}:probe`,
      axes,
      outputUnit,
      sourceFingerprint,
      regimeOf: () => 'single-phase',
      evaluate(pt) {
        const key = keyOf(pt);
        if (!seen.has(key)) {
          seen.add(key);
          requested.push([pt[0], pt[1]]);
        }
        return 1;
      }
    }
  });

  const values = typeof sample === 'function'
    ? await sample(definition, call, requested)
    : requested.map(([x, y]) => closedFormFn(x, y));

  if (!Array.isArray(values) || values.length !== requested.length || !values.every(Number.isFinite)) {
    throw new Error(`Eshkol sampling failed for ${call}: incomplete or non-finite batch`);
  }

  let maxCrossCheckErr = 0;
  const byKey = new Map();
  for (let i = 0; i < requested.length; i += 1) {
    const pt = requested[i];
    const val = values[i];
    const ref = closedFormFn(pt[0], pt[1]);
    const denom = Math.max(1e-12, Math.abs(ref));
    maxCrossCheckErr = Math.max(maxCrossCheckErr, Math.abs(val - ref) / denom);
    byKey.set(keyOf(pt), val);
  }
  if (maxCrossCheckErr > 1e-4) {
    throw new RangeError(`Eshkol AD sample cross-check failed for ${call}: err=${maxCrossCheckErr}`);
  }

  const responseFunction = fitResponseFunction({
    box,
    degrees,
    ...(signs ? { signs } : {}),
    relativeTolerance,
    heldOutPerAxis,
    generator: {
      id,
      axes,
      outputUnit,
      sourceFingerprint,
      regimeOf: () => 'single-phase',
      evaluate(pt) {
        const v = byKey.get(keyOf(pt));
        if (v === undefined) throw new Error(`Unsampled point requested for ${call}`);
        return v;
      }
    }
  });

  return Object.freeze({
    responseFunction,
    sampleCount: requested.length,
    crossCheckMaxRelativeError: maxCrossCheckErr
  });
}

function adaptiveTemperatureDegree(temperatureRangeK, baseDegree = 10, maxDegree = 22) {
  const lo = Math.max(1e-6, Number(temperatureRangeK?.[0]) || 200);
  const hi = Math.max(lo * 1.01, Number(temperatureRangeK?.[1]) || 1200);
  const ratio = hi / lo;
  if (ratio > 10) return Math.min(maxDegree, Math.max(baseDegree, 20));
  if (ratio > 5) return Math.min(maxDegree, Math.max(baseDegree, 16));
  if (ratio > 2.5) return Math.min(maxDegree, Math.max(baseDegree, 14));
  return baseDegree;
}

export async function deriveEshkolHelmholtzPotentialClosure({
  sample = null,
  material = 'generic',
  cvJPerKgK = 1000,
  rSpecificJPerKgK = 287.05,
  bulkModulusPa = 2.0e9,
  refTemperatureK = 300,
  refSpecificVolumeM3PerKg = 1e-3,
  refInternalEnergyJPerKg = 0,
  temperatureRangeK = [240, 600],
  specificVolumeRangeM3PerKg = [0.92e-3, 1.08e-3],
  degrees = null,
  relativeTolerance = 1e-5
} = {}) {
  const resolvedDegrees = Array.isArray(degrees)
    ? degrees
    : [adaptiveTemperatureDegree(temperatureRangeK, 14, 22), 8];
  const program = eshkolHelmholtzProgram({
    material,
    cvJPerKgK,
    rSpecificJPerKgK,
    bulkModulusPa,
    refTemperatureK,
    refSpecificVolumeM3PerKg,
    refInternalEnergyJPerKg
  });
  const fitted = await sampleAndFit2D({
    sample,
    definition: program.definition,
    call: program.call,
    closedFormFn: program.closedForm.a,
    id: `a4:eshkol-helmholtz:${material}`,
    sourceFingerprint: program.sourceFingerprint,
    axes: [
      { name: 'temperature', unit: 'K' },
      { name: 'specificVolume', unit: 'm^3/kg' }
    ],
    outputUnit: 'J/kg',
    box: [
      [Number(temperatureRangeK[0]), Number(temperatureRangeK[1])],
      [Number(specificVolumeRangeM3PerKg[0]), Number(specificVolumeRangeM3PerKg[1])]
    ],
    degrees: resolvedDegrees,
    relativeTolerance
  });
  return Object.freeze({
    schema: ULG_ESHKOL_TRIAD_CLOSURES_SCHEMA,
    kind: 'helmholtz-potential',
    material,
    program,
    ...fitted
  });
}

export async function deriveEshkolSolidHyperelasticClosure({
  sample = null,
  material = 'fe-solid',
  lameLambda0Pa = 115e9,
  lameMu0Pa = 82e9,
  thermalExpansionPerK = 1.2e-5,
  refTemperatureK = 300,
  meltTemperatureK = 1811,
  softeningCoeff = 0.35,
  jacobianRange = [0.92, 1.08],
  temperatureRangeK = [200, 1400],
  degrees = [8, 6],
  relativeTolerance = 1e-5
} = {}) {
  const program = eshkolSolidHyperelasticProgram({
    material,
    lameLambda0Pa,
    lameMu0Pa,
    thermalExpansionPerK,
    refTemperatureK,
    meltTemperatureK,
    softeningCoeff
  });
  const psiFit = await sampleAndFit2D({
    sample,
    definition: program.definition,
    call: 'solid-psi',
    closedFormFn: program.closedForm.psi,
    id: `a4:eshkol-solid-psi:${material}`,
    sourceFingerprint: program.sourceFingerprint,
    axes: [
      { name: 'jacobian', unit: '1' },
      { name: 'temperature', unit: 'K' }
    ],
    outputUnit: 'J/m^3',
    box: [
      [Number(jacobianRange[0]), Number(jacobianRange[1])],
      [Number(temperatureRangeK[0]), Number(temperatureRangeK[1])]
    ],
    degrees,
    relativeTolerance
  });
  return Object.freeze({
    schema: ULG_ESHKOL_TRIAD_CLOSURES_SCHEMA,
    kind: 'solid-hyperelastic',
    material,
    program,
    ...psiFit
  });
}

export async function deriveEshkolTransportClosures({
  sample = null,
  material = 'h2o',
  refTemperatureK = 300,
  refDensityKgPerM3 = 1.2,
  sutherlandK = 120,
  kRefWPerMK = 0.026,
  muRefPaS = 1.85e-5,
  diffusivityRefM2PerS = 2.2e-5,
  enskogDensityCoeff = 0.12,
  temperatureRangeK = [220, 1200],
  densityRangeKgPerM3 = [0.4, 4.0],
  degrees = null,
  relativeTolerance = 1e-5
} = {}) {
  const tDeg = adaptiveTemperatureDegree(temperatureRangeK, 14, 24);
  const resolvedDegrees = Array.isArray(degrees) ? degrees : [tDeg, 6];
  const resolvedDiffusivityDegrees = Array.isArray(degrees) ? [degrees[0], Math.max(24, degrees[1])] : [tDeg, 24];
  const program = eshkolTransportPrograms({
    material,
    refTemperatureK,
    refDensityKgPerM3,
    sutherlandK,
    kRefWPerMK,
    muRefPaS,
    diffusivityRefM2PerS,
    enskogDensityCoeff
  });
  const axes = [
    { name: 'temperature', unit: 'K' },
    { name: 'density', unit: 'kg/m^3' }
  ];
  const box = [
    [Number(temperatureRangeK[0]), Number(temperatureRangeK[1])],
    [Number(densityRangeKgPerM3[0]), Number(densityRangeKgPerM3[1])]
  ];
  const kFit = await sampleAndFit2D({
    sample,
    definition: program.definition,
    call: program.calls.k,
    closedFormFn: program.closedForm.k,
    id: `a4:eshkol-transport-k:${material}`,
    sourceFingerprint: program.sourceFingerprint,
    axes,
    outputUnit: 'W/(m*K)',
    box,
    degrees: resolvedDegrees,
    signs: [1, 1],
    relativeTolerance
  });
  const muFit = await sampleAndFit2D({
    sample,
    definition: program.definition,
    call: program.calls.mu,
    closedFormFn: program.closedForm.mu,
    id: `a4:eshkol-transport-mu:${material}`,
    sourceFingerprint: program.sourceFingerprint,
    axes,
    outputUnit: 'Pa*s',
    box,
    degrees: resolvedDegrees,
    signs: [1, 1],
    relativeTolerance
  });
  const dFit = await sampleAndFit2D({
    sample,
    definition: program.definition,
    call: program.calls.D,
    closedFormFn: program.closedForm.D,
    id: `a4:eshkol-transport-D:${material}`,
    sourceFingerprint: program.sourceFingerprint,
    axes,
    outputUnit: 'm^2/s',
    box,
    degrees: resolvedDiffusivityDegrees,
    signs: [1, -1],
    relativeTolerance
  });
  return Object.freeze({
    schema: ULG_ESHKOL_TRIAD_CLOSURES_SCHEMA,
    kind: 'transport-closures',
    material,
    program,
    conductivity: kFit,
    viscosity: muFit,
    diffusivity: dFit,
    responseFunctions: Object.freeze([
      kFit.responseFunction,
      muFit.responseFunction,
      dFit.responseFunction
    ])
  });
}

/**
 * Pack a complete Triad Eshkol closure bundle (Helmholtz + Solid Hyperelastic +
 * Transport k, mu, D) into one resident GPU A4 response table (5 functions):
 *   slot 0: Helmholtz a(T, v)       -> s = -da/dT, P = -da/dv, cv = -T d2a/dT2, KT = v d2a/dv2
 *   slot 1: Solid Psi(J, T)         -> P_solid = -dPsi/dJ, K_solid = J d2Psi/dJ2
 *   slot 2: Conductivity k(T, rho)
 *   slot 3: Viscosity mu(T, rho)
 *   slot 4: Diffusivity D(T, rho)
 */
export function packEshkolTriadClosureBundleForGpu({
  helmholtz,
  solidHyperelastic,
  transport
}) {
  const responseFunctions = [
    helmholtz.responseFunction,
    solidHyperelastic.responseFunction,
    transport.conductivity.responseFunction,
    transport.viscosity.responseFunction,
    transport.diffusivity.responseFunction
  ];
  const packed = packResponseFunctionsForGpu(responseFunctions);
  const fingerprint = schroederAuthorityTextFingerprint(
    [
      helmholtz.program.sourceFingerprint,
      solidHyperelastic.program.sourceFingerprint,
      transport.program.sourceFingerprint
    ].join('|'),
    'eshkol-triad-bundle'
  );
  return Object.freeze({
    schema: ULG_ESHKOL_TRIAD_CLOSURES_SCHEMA,
    gpuTableSchema: RESPONSE_FUNCTION_GPU_SCHEMA,
    functionSlots: Object.freeze({
      helmholtz: 0,
      solidHyperelastic: 1,
      conductivity: 2,
      viscosity: 3,
      diffusivity: 4
    }),
    sourceFingerprint: fingerprint,
    packed,
    evaluateHost: Object.freeze({
      helmholtz: (T, v) => evaluateResponseFunction(helmholtz.responseFunction, [T, v]),
      solidPsi: (J, T) => evaluateResponseFunction(solidHyperelastic.responseFunction, [J, T]),
      k: (T, rho) => evaluateResponseFunction(transport.conductivity.responseFunction, [T, rho]),
      mu: (T, rho) => evaluateResponseFunction(transport.viscosity.responseFunction, [T, rho]),
      D: (T, rho) => evaluateResponseFunction(transport.diffusivity.responseFunction, [T, rho])
    })
  });
}

/**
 * WGSL evaluator for the packed 5-slot Triad Eshkol A4 closure table.
 * Computes Maxwell-consistent Helmholtz thermodynamics (s, P, cv, KT) from
 * a single rf_eval_differential call, solid hyperelastic pressure & bulk modulus,
 * and transport coefficients (k, mu, D) with strict in-box non-extrapolation.
 */
export function eshkolTriadClosuresWgsl(tableName = 'triad_a4_table') {
  return /* wgsl */ `
${responseFunctionGpuWgsl(tableName)}

struct TriadHelmholtzState {
  free_energy_j_per_kg: f32,
  entropy_j_per_kg_k: f32,
  pressure_pa: f32,
  cv_j_per_kg_k: f32,
  bulk_modulus_kt_pa: f32,
  ok: u32,
};

fn triad_eval_helmholtz(slot: u32, temperature_k: f32, specific_volume: f32) -> TriadHelmholtzState {
  var out: TriadHelmholtzState;
  if (!(temperature_k > 0.0) || !(specific_volume > 0.0)) { return out; }
  let d = rf_eval_differential(slot, vec3<f32>(temperature_k, specific_volume, 0.0));
  if (d.ok == 0u) { return out; }
  let s = -d.gradient.x;
  let p = -d.gradient.y;
  let cv = -temperature_k * d.hessian[0][0];
  let kt = specific_volume * d.hessian[1][1];
  if (!rf_finite(s) || !rf_finite(p) || !rf_finite(cv) || !rf_finite(kt) || !(cv > 0.0) || !(kt > 0.0)) {
    return out;
  }
  out.free_energy_j_per_kg = d.value;
  out.entropy_j_per_kg_k = s;
  out.pressure_pa = p;
  out.cv_j_per_kg_k = cv;
  out.bulk_modulus_kt_pa = kt;
  out.ok = 1u;
  return out;
}

// Returns vec4(psi_j_per_m3, pressure_pa, tangent_modulus_pa, ok)
fn triad_eval_solid_hyperelastic(slot: u32, jacobian: f32, temperature_k: f32) -> vec4<f32> {
  if (!(jacobian > 0.0) || !(temperature_k > 0.0)) { return vec4<f32>(0.0); }
  let d = rf_eval_differential(slot, vec3<f32>(jacobian, temperature_k, 0.0));
  if (d.ok == 0u) { return vec4<f32>(0.0); }
  let pressure = -d.gradient.x;
  let tangent_k = jacobian * d.hessian[0][0];
  if (!rf_finite(pressure) || !rf_finite(tangent_k) || !(tangent_k > 0.0)) {
    return vec4<f32>(0.0);
  }
  return vec4<f32>(d.value, pressure, tangent_k, 1.0);
}

// Returns vec4(k_w_per_mk, mu_pa_s, D_m2_per_s, ok)
fn triad_eval_transport(k_slot: u32, mu_slot: u32, d_slot: u32, temperature_k: f32, density_kg_per_m3: f32) -> vec4<f32> {
  let pt = vec3<f32>(temperature_k, density_kg_per_m3, 0.0);
  let rk = rf_eval(k_slot, pt);
  let rmu = rf_eval(mu_slot, pt);
  let rd = rf_eval(d_slot, pt);
  if (rk.y != 1.0 || rmu.y != 1.0 || rd.y != 1.0 || !(rk.x > 0.0) || !(rmu.x > 0.0) || !(rd.x > 0.0)) {
    return vec4<f32>(0.0);
  }
  return vec4<f32>(rk.x, rmu.x, rd.x, 1.0);
}
`;
}

export { AVOGADRO_R };
