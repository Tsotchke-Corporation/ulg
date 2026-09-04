import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ULG_SPH_STAGE_MECHANICS_TRACE_SCHEMA,
  createSphStageMechanicsTracer,
  summarizeSphStageMechanicsTrace
} from '../src/runtime/sph/sphStageMechanicsTracer.js';

function fakeDevice() {
  return {
    createBuffer() { return {}; },
    createCommandEncoder() { return {}; },
    queue: { submit() {}, writeBuffer() {} }
  };
}

function evidenceWith(rows) {
  return { particleCount: 9, materialPhases: rows };
}

test('a disabled tracer costs nothing and reports itself disabled', async () => {
  const tracer = createSphStageMechanicsTracer({ device: fakeDevice(), particleCount: 9 });
  assert.equal(tracer.enabled, false);
  let called = 0;
  const withReducer = createSphStageMechanicsTracer({
    device: fakeDevice(),
    particleCount: 9,
    reducer: async () => { called += 1; return evidenceWith([]); }
  });
  await withReducer.snapshot({ stage: 'reaction', stateBuffer: {}, thermoBuffer: {}, mechanicsBuffer: {} });
  assert.equal(called, 0, 'a disabled tracer must not submit work');
  assert.equal(withReducer.result().status, 'stage-mechanics-trace-disabled');
});

test('the trace records execution order, not declaration order', async () => {
  // This is the whole point: the closure runs thermal -> reaction ->
  // phaseCarrierTransfer -> mechanicsRefresh, so the refresh is the LAST writer
  // of the mechanics buffer. Reading the closure's stage LIST gives the
  // opposite impression, and that misreading already produced two wrong
  // analyses of which stage could be responsible for a lane.
  const tracer = createSphStageMechanicsTracer({
    device: fakeDevice(),
    particleCount: 9,
    enabled: true,
    reducer: async () => evidenceWith([{ material: 'h2', phase: 'gas', massKg: 1 }])
  });
  for (const stage of ['thermal-phase', 'reaction-product', 'phase-carrier-transfer-v2', 'mechanics-constitutive-refresh']) {
    await tracer.snapshot({ stage, stateBuffer: {}, thermoBuffer: {}, mechanicsBuffer: {} });
  }
  assert.deepEqual(tracer.result().stageOrder, [
    'thermal-phase',
    'reaction-product',
    'phase-carrier-transfer-v2',
    'mechanics-constitutive-refresh'
  ]);
});

test('an incomplete triple is recorded as skipped, not omitted', async () => {
  // An absent row and an unwritten row are different answers to "which stage
  // wrote this", so a stage that could not be sampled must still appear.
  const tracer = createSphStageMechanicsTracer({
    device: fakeDevice(),
    particleCount: 9,
    enabled: true,
    reducer: async () => evidenceWith([])
  });
  await tracer.snapshot({ stage: 'mechanics-constitutive-refresh', mechanicsBuffer: {} });
  const trace = tracer.result();
  assert.equal(trace.stages.length, 1);
  assert.equal(trace.stages[0].status, 'stage-mechanics-trace-skipped-incomplete-triple');
  assert.equal(trace.stages[0].hasState, false);
  assert.equal(trace.stages[0].hasMechanics, true);
  assert.equal(trace.skippedCount, 1);
});

test('a reducer failure is captured and never escapes', async () => {
  const tracer = createSphStageMechanicsTracer({
    device: fakeDevice(),
    particleCount: 9,
    enabled: true,
    reducer: async () => { throw new Error('device lost'); }
  });
  await tracer.snapshot({ stage: 'reaction-product', stateBuffer: {}, thermoBuffer: {}, mechanicsBuffer: {} });
  const trace = tracer.result();
  assert.equal(trace.stages[0].status, 'stage-mechanics-trace-failed');
  assert.match(trace.failures[0].message, /device lost/);
});

test('zero-mass phases are dropped so a stage row matches a checkpoint row', async () => {
  const tracer = createSphStageMechanicsTracer({
    device: fakeDevice(),
    particleCount: 9,
    enabled: true,
    reducer: async () => evidenceWith([
      { material: 'h2', phase: 'gas', massKg: 0.019, minPressurePa: 0 },
      { material: 'h2', phase: 'plasma', massKg: 0 }
    ])
  });
  await tracer.snapshot({ stage: 'reaction-product', stateBuffer: {}, thermoBuffer: {}, mechanicsBuffer: {} });
  const rows = tracer.result().stages[0].materialPhases;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].phase, 'gas');
});

test('the compact trace retains numeric motion evidence', async () => {
  const tracer = createSphStageMechanicsTracer({
    device: fakeDevice(),
    particleCount: 9,
    enabled: true,
    reducer: async () => evidenceWith([{
      material: 'Cs',
      phase: 'solid',
      massKg: 1,
      kineticEnergyJ: 0.25,
      speedSampleCount: 9,
      maxSpeedMPerS: 0.5,
      meanVyMPerS: -0.4,
      minVyMPerS: -0.5,
      maxVyMPerS: -0.3,
      yMinM: 1.1,
      yMaxM: 1.5,
      yCenterMassWeightedM: 1.3,
      maxAbsVelocityDivergencePerS: 4,
      volumeRatioCapBoundaryContributionCount: 2
    }])
  });
  await tracer.snapshot({
    stage: 'post-mechanics-closure-input',
    stateBuffer: {},
    thermoBuffer: {},
    mechanicsBuffer: {}
  });
  const row = tracer.result().stages[0].materialPhases[0];
  assert.equal(row.kineticEnergyJ, 0.25);
  assert.equal(row.speedSampleCount, 9);
  assert.equal(row.maxSpeedMPerS, 0.5);
  assert.equal(row.meanVyMPerS, -0.4);
  assert.equal(row.minVyMPerS, -0.5);
  assert.equal(row.maxVyMPerS, -0.3);
  assert.equal(row.yMinM, 1.1);
  assert.equal(row.yMaxM, 1.5);
  assert.equal(row.yCenterMassWeightedM, 1.3);
  assert.equal(row.maxAbsVelocityDivergencePerS, 4);
  assert.equal(row.volumeRatioCapBoundaryContributionCount, 2);
});

test('the summary reads a single lane across stages', async () => {
  // The failure this exists to localize looks like: 0 after one stage,
  // 101325 after the next, 0 again after the last.
  const byStage = {
    'reaction-product': 0,
    'phase-carrier-transfer-v2': 101325,
    'mechanics-constitutive-refresh': 0
  };
  const tracer = createSphStageMechanicsTracer({
    device: fakeDevice(),
    particleCount: 9,
    enabled: true,
    reducer: async ({ label }) => {
      const stage = Object.keys(byStage).find((name) => label.endsWith(name));
      return evidenceWith([{ material: 'naoh', phase: 'liquid', massKg: 1, minPressurePa: byStage[stage] }]);
    }
  });
  for (const stage of Object.keys(byStage)) {
    await tracer.snapshot({ stage, stateBuffer: {}, thermoBuffer: {}, mechanicsBuffer: {} });
  }
  const summary = summarizeSphStageMechanicsTrace(tracer.result(), { field: 'minPressurePa' });
  assert.equal(summary.rows.length, 1);
  assert.equal(summary.rows[0].key, 'naoh/liquid');
  assert.deepEqual(summary.rows[0].values, [0, 101325, 0]);
});

test('the schema is pinned so a decoded trace is identifiable in an artifact', async () => {
  const tracer = createSphStageMechanicsTracer({ device: fakeDevice(), particleCount: 9, enabled: true });
  assert.equal(tracer.result().schema, ULG_SPH_STAGE_MECHANICS_TRACE_SCHEMA);
  assert.equal(ULG_SPH_STAGE_MECHANICS_TRACE_SCHEMA, 'peercompute.ulg.sph-stage-mechanics-trace.v0');
});
