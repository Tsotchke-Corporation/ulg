// A1 larger-dt slice, step 2 (plan/todo/a1-eshkol-coarse-dt.md): the bulk
// stiffness K(rho) = rho * dp/drho of a material phase's EOS, derived by
// Eshkol automatic differentiation of the same EOS program the GPU evaluates
// (ulg-gpu-abi/src/wgsl.js packed_pressure), then fitted as an A4 response
// function (Chebyshev, held-out residuals, strict validity box). The
// semi-implicit pressure operator linearizes p(rho + d) ~ p + (K / rho) d.
//
// Eshkol runs in the client (A6): `sample(definition, call, points)` is the
// warm VM worker's 'sample' request (public/workers/eshkol-warm-vm.worker.js),
// or any async function with the same contract (tests pass a JS sampler).
import { fitResponseFunction } from './localClosureFitCache.js';

export const ULG_ESHKOL_EOS_STIFFNESS_SCHEMA = 'peercompute.ulg.eshkol-eos-stiffness.v1';
// GPU packed EOS model ids (packed_pressure): 1 Tait (gamma 7), 2 linear gas.
export const ESHKOL_EOS_MODEL = Object.freeze({ TAIT: 1, LINEAR_GAS: 2 });

const literal = (x) => {
  const value = Number(x);
  if (!Number.isFinite(value)) throw new RangeError('EOS parameters must be finite');
  return value.toPrecision(17);
};

/**
 * The Eshkol program for one phase's EOS and its derived stiffness, with the
 * closed form used only as an independent cross-check.
 */
export function eshkolEosProgram({ eosModel, restDensityKgPerM3, soundSpeedMPerS }) {
  if (!(restDensityKgPerM3 > 0) || !(soundSpeedMPerS > 0)) {
    throw new RangeError('EOS program needs positive rest density and sound speed');
  }
  const rho0 = literal(restDensityKgPerM3);
  const c = literal(soundSpeedMPerS);
  let pressure, closedForm;
  if (eosModel === ESHKOL_EOS_MODEL.TAIT) {
    // p = (rho0 c^2 / 7) ((rho / rho0)^7 - 1)
    pressure = `(* (/ (* ${rho0} ${c} ${c}) 7.0) (- (expt (/ rho ${rho0}) 7.0) 1.0))`;
    closedForm = (rho) => rho * soundSpeedMPerS ** 2 * (rho / restDensityKgPerM3) ** 6;
  } else if (eosModel === ESHKOL_EOS_MODEL.LINEAR_GAS) {
    // p = c^2 (rho - rho0)
    pressure = `(* ${c} ${c} (- rho ${rho0}))`;
    closedForm = (rho) => rho * soundSpeedMPerS ** 2;
  } else {
    throw new RangeError(`unsupported EOS model ${eosModel}`);
  }
  const definition = `(define (eos-pressure rho) ${pressure})
(define (eos-stiffness rho) (* rho (derivative eos-pressure rho)))`;
  return Object.freeze({ definition, call: 'eos-stiffness', closedForm,
    sourceFingerprint: `eshkol-eos:${eosModel}:${rho0}:${c}` });
}

/**
 * Derive K(rho) over [densityRange[0] * rho0, densityRange[1] * rho0]: sample
 * Eshkol's AD derivative at every point the A4 fit needs, fit, and cross-check
 * the samples against the closed form. Refuses (throws) when the fit misses
 * its tolerance; returns the response function and the evidence otherwise.
 */
export async function deriveEosStiffnessResponse({
  sample,
  eosModel,
  restDensityKgPerM3,
  soundSpeedMPerS,
  densityRange = [0.9, 1.1],
  degree = 10,
  relativeTolerance = 1e-6
}) {
  if (typeof sample !== 'function') throw new TypeError('deriveEosStiffnessResponse needs a sampler');
  const program = eshkolEosProgram({ eosModel, restDensityKgPerM3, soundSpeedMPerS });
  const box = [[densityRange[0] * restDensityKgPerM3, densityRange[1] * restDensityKgPerM3]];
  const fitOptions = { box, degrees: [degree], relativeTolerance };
  // Pass 1: record every density the deterministic fit evaluates.
  const requested = [];
  const keyOf = (rho) => Number(rho).toPrecision(17);
  const seen = new Set();
  fitResponseFunction({
    ...fitOptions,
    generator: { id: `${program.sourceFingerprint}:recording`, axes: [{ name: 'densityKgPerM3', unit: 'kg/m3' }], outputUnit: 'Pa',
      sourceFingerprint: program.sourceFingerprint, regimeOf: () => 'single-phase',
      evaluate: ([rho]) => { if (!seen.has(keyOf(rho))) { seen.add(keyOf(rho)); requested.push(rho); } return 1; } }
  });
  // One batch of Eshkol AD samples.
  const values = await sample(program.definition, program.call, requested.map((rho) => [rho]));
  if (!Array.isArray(values) || values.length !== requested.length || !values.every(Number.isFinite)) {
    throw new Error('Eshkol stiffness sampling returned an incomplete or non-finite batch');
  }
  const byKey = new Map(requested.map((rho, i) => [keyOf(rho), values[i]]));
  let maxCrossCheck = 0;
  requested.forEach((rho, i) => {
    const exact = program.closedForm(rho);
    maxCrossCheck = Math.max(maxCrossCheck, Math.abs(values[i] - exact) / Math.abs(exact));
  });
  // Pass 2: the real fit, on Eshkol's values only (stiffness rises with rho).
  const responseFunction = fitResponseFunction({
    ...fitOptions,
    signs: [1],
    generator: { id: program.sourceFingerprint, axes: [{ name: 'densityKgPerM3', unit: 'kg/m3' }], outputUnit: 'Pa',
      sourceFingerprint: program.sourceFingerprint, regimeOf: () => 'single-phase',
      evaluate: ([rho]) => {
        const value = byKey.get(keyOf(rho));
        if (value === undefined) throw new Error('fit requested an unsampled density');
        return value;
      } }
  });
  return Object.freeze({
    schema: ULG_ESHKOL_EOS_STIFFNESS_SCHEMA,
    eosModel,
    restDensityKgPerM3,
    soundSpeedMPerS,
    sampleCount: requested.length,
    responseFunction,
    // Independent check of Eshkol's AD against the analytic derivative.
    crossCheckMaxRelativeError: maxCrossCheck,
    program: Object.freeze({ definition: program.definition, call: program.call,
      sourceFingerprint: program.sourceFingerprint })
  });
}
