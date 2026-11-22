import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ULG_SCHROEDER_CHAIN_SUBCYCLING_SCHEMA,
  executeNestedChainRefluxStepCpuReference,
  normalizeSchroederChainSubcyclePlan,
  verifyExplicitHydrostaticAirColumnAndPlume
} from '../src/runtime/sph/schroederSpatialChainSubcycling.js';
import {
  SPH_IMPLICIT_PRESSURE_ENVELOPE_WATCH_SCHEMA,
  evaluateImplicitPressurePerNodeEnvelope,
  sphImplicitPressureEnvelopeWatchWgsl
} from '../src/runtime/sph/sphImplicitPressureGpu.js';

test('dyadic temporal subcycling plan builds exact power-of-2 dt ratios and reflux sync ordinals', () => {
  const levels = [
    { selectedLevel: 0 },
    { selectedLevel: 1 },
    { selectedLevel: 2 }
  ];
  const syncPlan = normalizeSchroederChainSubcyclePlan({
    mechanicsLevels: levels,
    fineSubstepsPerCoarseStep: 1,
    macroDtS: 1e-4
  });
  assert.equal(syncPlan.schema, ULG_SCHROEDER_CHAIN_SUBCYCLING_SCHEMA);
  assert.equal(syncPlan.enabled, false);
  assert.equal(syncPlan.fineDtS, Math.fround(1e-4));

  const sub4 = normalizeSchroederChainSubcyclePlan({
    mechanicsLevels: levels,
    fineSubstepsPerCoarseStep: 4,
    macroDtS: 4e-4
  });
  assert.equal(sub4.enabled, true);
  assert.equal(sub4.perLevel[0].substepsPerMacroStep, 4);
  assert.equal(sub4.perLevel[1].substepsPerMacroStep, 2);
  assert.equal(sub4.perLevel[2].substepsPerMacroStep, 1);
  assert.deepEqual(sub4.perLevel[1].refluxSyncOrdinals, [1, 3]);
  assert.deepEqual(sub4.perLevel[2].refluxSyncOrdinals, [3]);

  assert.throws(
    () => normalizeSchroederChainSubcyclePlan({ mechanicsLevels: levels, fineSubstepsPerCoarseStep: 3, macroDtS: 1e-4 }),
    /power of 2/
  );
});

test('nested temporal subcycling reflux conserves exact total momentum across 2x and 4x fine substeps', () => {
  const fineNodes = [
    { mass: 0.002, p: [0.004, 0.012, -0.002] },
    { mass: 0.003, p: [-0.003, 0.009, 0.006] }
  ];
  const coarseNodes = [
    { mass: 0.02, p: [0.01, -0.02, 0.005] }
  ];
  const edges = [
    { fineIdx: 0, coarseIdx: 0, dragRatePerS: 120 },
    { fineIdx: 1, coarseIdx: 0, dragRatePerS: 85 }
  ];
  const initialP = [
    fineNodes[0].p[0] + fineNodes[1].p[0] + coarseNodes[0].p[0],
    fineNodes[0].p[1] + fineNodes[1].p[1] + coarseNodes[0].p[1],
    fineNodes[0].p[2] + fineNodes[1].p[2] + coarseNodes[0].p[2]
  ];
  for (const m of [1, 2, 4, 8]) {
    const out = executeNestedChainRefluxStepCpuReference({
      fineNodes,
      coarseNodes,
      couplingEdges: edges,
      macroDtS: 0.01,
      fineSubstepsPerCoarseStep: m
    });
    assert.equal(out.fineSubstepsRun, m);
    for (let d = 0; d < 3; d += 1) {
      assert.ok(Math.abs(out.totalMomentum[d] - initialP[d]) < 1e-15, `momentum drift axis ${d} at M=${m}`);
    }
  }
});

test('per-node semi-implicit pressure envelope watch gates acoustic CFL, advective CFL, and Tait linearization', () => {
  const admitted = evaluateImplicitPressurePerNodeEnvelope({
    soundSpeedMPerS: 180,
    maxFluidSpeedMPerS: 2.0,
    gridSpacingM: 0.01,
    dtS: 2e-4 // acoustic CFL = 3.6 <= 6.4, advective CFL = 0.04 <= 0.5, linErr = 0.0048 <= 0.05
  });
  assert.equal(admitted.schema, SPH_IMPLICIT_PRESSURE_ENVELOPE_WATCH_SCHEMA);
  assert.equal(admitted.admitted, true);
  assert.equal(admitted.fallbackMode, 'implicit-cg');
  assert.equal(admitted.recommendedSubsteps, 1);

  const acousticBreach = evaluateImplicitPressurePerNodeEnvelope({
    soundSpeedMPerS: 340,
    maxFluidSpeedMPerS: 1.0,
    gridSpacingM: 0.01,
    dtS: 5e-4 // acoustic CFL = 17 > 6.4 -> explicit-substep fallback!
  });
  assert.equal(acousticBreach.admitted, false);
  assert.equal(acousticBreach.reason, 'acoustic-cfl-exceeded');
  assert.equal(acousticBreach.fallbackMode, 'explicit-substep');
  assert.ok(acousticBreach.recommendedSubsteps >= 4);

  const advectiveBreach = evaluateImplicitPressurePerNodeEnvelope({
    soundSpeedMPerS: 180,
    maxFluidSpeedMPerS: 30,
    gridSpacingM: 0.01,
    dtS: 2e-4 // advective CFL = 0.6 > 0.5
  });
  assert.equal(advectiveBreach.admitted, false);
  assert.equal(advectiveBreach.reason, 'advective-cfl-exceeded');
  assert.match(sphImplicitPressureEnvelopeWatchWgsl, /fn ip_envelope_watch/);
});

test('explicit hydrostatic room air (ambientReferenceDensityKgPerM3 = 0) sustains barometric balance and natural rising steam plume', () => {
  const check = verifyExplicitHydrostaticAirColumnAndPlume({
    ambientReferenceDensityKgPerM3: 0,
    surfacePressurePa: 101325,
    airTemperatureK: 293.15,
    plumeTemperatureK: 420
  });
  assert.equal(check.explicitHydrostaticAirActive, true);
  assert.equal(check.ambientReferenceDensityKgPerM3, 0);
  assert.ok(check.maxHydrostaticResidualRel < 1e-6, `hydrostatic residual ${check.maxHydrostaticResidualRel}`);
  assert.equal(check.plumeRisesNaturally, true);
  assert.ok(check.emergentPlumeAccelMPerS2 > 10, `expected strong steam buoyancy, got ${check.emergentPlumeAccelMPerS2}`);
  assert.ok(check.buoyancyRelativeError < 1e-5, `buoyancy error ${check.buoyancyRelativeError}`);
});
