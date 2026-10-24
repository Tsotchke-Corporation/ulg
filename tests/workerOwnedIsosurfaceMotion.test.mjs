import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createIsosurfaceMotionPacing,
  createPresentationPauseClock,
  isosurfaceMotionAge,
  resumeIsosurfaceMotionPacing,
  slowIsosurfaceMotionPacing,
  snapshotIsosurfaceSourceTimingBootstrap
} from '../src/services/workerOwnedIsosurfaceMotion.js';

const prior = { sourceTimeS: 0.064, sourcePresentedAtMs: 1000, sphStep: 63,
  receiptFields: { laneId: 'lane', stateKey: 'state' } };
const next = { ...prior, sourceTimeS: 0.128, sphStep: 127 };

test('explicit paused overlap is excluded from pacing without rewriting raw admission times', () => {
  const pacing = createIsosurfaceMotionPacing(next, prior, 11000, null, { pausedWallDeltaMs: 8000 });
  assert.equal(prior.sourcePresentedAtMs, 1000);
  assert.equal(pacing.startedAtMs, 11000);
  assert.equal(pacing.maxWallAgeS, 2);
  assert.equal(pacing.maxSimulationAgeS, 0.064);
  assert.equal(isosurfaceMotionAge(pacing, 12000), 0.032);
  for (const pausedWallDeltaMs of [null, undefined, '8000', NaN, Infinity, -1, 10000, 12000]) {
    if (pausedWallDeltaMs === undefined) continue; // Omission preserves the standalone no-pause API.
    assert.equal(createIsosurfaceMotionPacing(next, prior, 11000, null, { pausedWallDeltaMs }), null);
  }
});

test('constant-size pause clock preserves captured cumulative anchors and rejects ambiguous old bootstrap segments', () => {
  const clock = createPresentationPauseClock();
  assert.equal(clock.pausedAt(500), 0);
  assert.equal(clock.setPlaying(false, 1000), true);
  assert.equal(clock.pausedAt(1500), 500);
  assert.equal(clock.setPlaying(false, 1500), false);
  assert.equal(clock.setPlaying(true, 2000), true);
  const sourceAnchor = clock.pausedAt(2500);
  assert.equal(sourceAnchor, 1000);
  clock.setPlaying(false, 3000);
  clock.setPlaying(true, 4000);
  clock.setPlaying(false, 5000);
  clock.setPlaying(true, 6000);
  assert.equal(clock.pausedAt(6500) - sourceAnchor, 2000);
  assert.equal(clock.pausedAt(5500), 2500);
  assert.equal(clock.pausedAt(500), 0);
  assert.equal(clock.pausedAt(2500), null, 'an uncaptured old midpoint cannot invent a pause baseline');
  for (const value of [null, undefined, 1, 'false']) {
    assert.throws(() => clock.setPlaying(value, 6500), TypeError);
  }
  assert.throws(() => clock.setPlaying(false, 5500), TypeError);
});

test('motion resume anchors only unspent admitted age and preserves slowed rate and exhausted cap', () => {
  const pacing = createIsosurfaceMotionPacing(next, prior, 4000);
  const slowed = slowIsosurfaceMotionPacing(pacing, 5000, 4, 0.032);
  const resumed = resumeIsosurfaceMotionPacing(slowed, 20000, 0.032);
  assert.equal(resumed.startedAtMs, 4000);
  assert.equal(resumed.maxWallAgeS, pacing.maxWallAgeS);
  assert.equal(resumed.maxSimulationAgeS, pacing.maxSimulationAgeS);
  assert.equal(resumed.segmentSimulationTimeScale, slowed.segmentSimulationTimeScale);
  assert.equal(isosurfaceMotionAge(resumed, 20000), 0.032);
  assert.equal(isosurfaceMotionAge(resumed, 22000), 0.048);
  assert.equal(isosurfaceMotionAge(resumed, 24000), 0.064);
  const exhausted = resumeIsosurfaceMotionPacing(resumed, 50000, 0.064);
  assert.equal(isosurfaceMotionAge(exhausted, 50000), 0.064);
  assert.equal(isosurfaceMotionAge(exhausted, 60000), 0.064);
  for (const age of [-1, NaN, Infinity, 0.065]) {
    assert.equal(resumeIsosurfaceMotionPacing(pacing, 10000, age), pacing);
  }
  assert.equal(resumeIsosurfaceMotionPacing(pacing, 3999, 0.01), pacing);
});

test('isosurface presentation spans observed wall-clock source cadence, not simulated FPS', () => {
  const pacing = createIsosurfaceMotionPacing(next, prior, 4000);
  assert.equal(pacing.maxSimulationAgeS, 0.064);
  assert.equal(pacing.maxWallAgeS, 3);
  assert.equal(isosurfaceMotionAge(pacing, 5500), 0.032);
  assert.equal(isosurfaceMotionAge(pacing, 7000), 0.064);
  assert.equal(isosurfaceMotionAge(pacing, 20000), 0.064);
  assert.equal(pacing.authoritativeStateMutation, false);
});

test('isosurface motion does not invent pacing before two progressing admitted sources', () => {
  assert.equal(createIsosurfaceMotionPacing(next, null, 4000), null);
  assert.equal(createIsosurfaceMotionPacing(prior, prior, 4000), null);
  assert.equal(createIsosurfaceMotionPacing(next, prior, 1000), null);
  assert.equal(createIsosurfaceMotionPacing({ ...next, sourceTimeS: null }, prior, 4000), null);
  assert.equal(createIsosurfaceMotionPacing({ ...next, sourceTimeS: 0.01 }, prior, 4000), null);
  assert.equal(createIsosurfaceMotionPacing({ ...next, sphStep: 62 }, prior, 4000), null);
});

test('isosurface pacing resets across authority scopes and wall-clock regression', () => {
  assert.equal(createIsosurfaceMotionPacing({ ...next, receiptFields: { laneId: 'other', stateKey: 'state' } }, prior, 4000), null);
  assert.equal(createIsosurfaceMotionPacing({ ...next, receiptFields: { laneId: 'lane', stateKey: 'other' } }, prior, 4000), null);
  const pacing = createIsosurfaceMotionPacing(next, prior, 4000);
  assert.equal(isosurfaceMotionAge(pacing, 3999), null);
  assert.equal(isosurfaceMotionAge(pacing, NaN), null);
});

function advance(previous, simulationDeltaS, wallDeltaMs) {
  const frame = { ...previous,
    sphStep: previous.sphStep + 64,
    sourceTimeS: previous.sourceTimeS + simulationDeltaS,
    sourcePresentedAtMs: previous.sourcePresentedAtMs + wallDeltaMs };
  frame.motionPacing = createIsosurfaceMotionPacing(frame, previous, frame.sourcePresentedAtMs);
  return frame;
}

test('arrival jitter stretches wall pacing without extending the simulation horizon', () => {
  const first = advance(prior, 0.064, 3000);
  const second = advance(first, 0.064, 3500);
  assert.ok(Math.abs(second.motionPacing.maxWallAgeS - 4) < 1e-12);
  const duringLaterArrival = second.sourcePresentedAtMs + 3750;
  const age = isosurfaceMotionAge(second.motionPacing, duringLaterArrival);
  assert.ok(age > 0 && age < second.motionPacing.maxSimulationAgeS);
  assert.ok(Math.abs(age - 0.060) < 1e-12);
  assert.ok(Math.abs(second.motionPacing.maxSimulationAgeS - 0.064) < 1e-12);
  assert.equal(isosurfaceMotionAge(second.motionPacing, duringLaterArrival + 1e6),
    second.motionPacing.maxSimulationAgeS);
  assert.equal(second.motionPacing.authoritativeStateMutation, false);
  assert.ok(Object.isFrozen(second.motionPacing));
});

test('jitter history uses measured rates, not recursively padded wall budgets', () => {
  const first = advance(prior, 0.064, 3000);
  const second = advance(first, 0.064, 3500);
  const third = advance(second, 0.064, 3500);
  assert.ok(Math.abs(third.motionPacing.maxWallAgeS - 3.5) < 1e-12);
  const fourth = advance(third, 0.064, 3500);
  assert.ok(Math.abs(fourth.motionPacing.maxWallAgeS - 3.5) < 1e-12);
});

test('different source simulation intervals compare normalized arrival rates', () => {
  const first = advance(prior, 0.064, 4000);
  const second = advance(first, 0.016, 1000);
  assert.ok(Math.abs(second.motionPacing.maxWallAgeS - 1) < 1e-12);
  assert.ok(Math.abs(second.motionPacing.maxSimulationAgeS - 0.016) < 1e-12);
});

test('arrival slowdown and recovery are local, finite, and do not speed up extrapolation', () => {
  let frame = prior;
  for (const [simulationDelta, wallMs] of [[0.064, 3000], [0.064, 4250],
    [0.064, 4100], [0.016, 500], [0.016, 500], [0.016, 500]]) {
    frame = advance(frame, simulationDelta, wallMs);
    const pacing = frame.motionPacing;
    assert.ok(pacing.maxWallAgeS >= wallMs / 1000 - 1e-12);
    let last = 0;
    for (let ms = 0; ms <= 20000; ms += 17) {
      const age = isosurfaceMotionAge(pacing, pacing.startedAtMs + ms);
      assert.ok(Number.isFinite(age) && age >= last && age <= pacing.maxSimulationAgeS);
      last = age;
    }
  }
  assert.ok(Math.abs(frame.motionPacing.maxWallAgeS - 0.5) < 1e-12);
});

test('unmatched or malformed timing history cannot inject an arrival budget', () => {
  for (const history of [null, { sourceTimeS: 12, observedWallSecondsPerSimulationSecond: 999 },
    ...[0, -1, NaN, Infinity, '12'].map(rate => ({ sourceTimeS: prior.sourceTimeS,
      observedWallSecondsPerSimulationSecond: rate }))]) {
    const pacing = createIsosurfaceMotionPacing(next, { ...prior, motionPacing: history }, 4000);
    assert.equal(pacing.maxWallAgeS, 3);
  }
});

test('finite source clocks that overflow derived pacing fail closed', () => {
  assert.equal(createIsosurfaceMotionPacing({ ...next, sourceTimeS: Number.MAX_VALUE },
    { ...prior, sourceTimeS: -Number.MAX_VALUE }, 4000), null);
  assert.equal(createIsosurfaceMotionPacing({ ...next, sourceTimeS: Number.MIN_VALUE },
    { ...prior, sourceTimeS: 0 }, 4000), null);
});

test('pending source progress stretches only the unspent wall segment and keeps the original motion bounds', () => {
  const pacing = createIsosurfaceMotionPacing(next, prior, 4000);
  const original = structuredClone(pacing);
  const ageAtProgress = isosurfaceMotionAge(pacing, 5000);
  const slowed = slowIsosurfaceMotionPacing(pacing, 5000, 4);
  assert.notEqual(slowed, pacing);
  assert.ok(Object.isFrozen(slowed));
  assert.deepEqual(pacing, original, 'the previous frozen pacing is not mutated');
  for (const key of Object.keys(original)) assert.equal(slowed[key], original[key], key);
  assert.equal(slowed.segmentAnchorAtMs, 5000);
  assert.equal(slowed.segmentAnchorAgeS, ageAtProgress);
  assert.ok(Math.abs(slowed.segmentSimulationTimeScale - (0.064 - ageAtProgress) / 4) < 1e-14);
  assert.equal(isosurfaceMotionAge(slowed, 5000), ageAtProgress);
  assert.ok(isosurfaceMotionAge(slowed, 7000) < 0.064,
    'the old wall horizon no longer prematurely consumes all valid motion');
  assert.ok(isosurfaceMotionAge(slowed, 7312) > isosurfaceMotionAge(slowed, 7000),
    'real permitted age remains available across a 312 ms delayed-source interval');
  assert.equal(isosurfaceMotionAge(slowed, 9000), 0.064);
  assert.equal(isosurfaceMotionAge(slowed, 1e9), 0.064,
    'one progress observation leaves a finite stopping deadline');
});

test('successive pending progress corrections never accelerate or compound the original source history', () => {
  const pacing = createIsosurfaceMotionPacing(next, prior, 4000);
  const first = slowIsosurfaceMotionPacing(pacing, 5000, 4);
  const second = slowIsosurfaceMotionPacing(first, 6000, 4);
  assert.notEqual(second, first);
  assert.equal(second.segmentAnchorAgeS, isosurfaceMotionAge(first, 6000));
  assert.ok(second.segmentSimulationTimeScale < first.segmentSimulationTimeScale);
  assert.equal(slowIsosurfaceMotionPacing(second, 6500, 1), second,
    'a faster observed successor must not accelerate the current presentation');
  assert.equal(slowIsosurfaceMotionPacing(second, 6000, 4), second,
    'an equal remaining deadline is a true identity-preserving no-op');
  assert.equal(second.maxWallAgeS, pacing.maxWallAgeS);
  assert.equal(second.observedWallSecondsPerSimulationSecond,
    pacing.observedWallSecondsPerSimulationSecond);
  const oldFrame = { ...next, sourcePresentedAtMs: 4000, motionPacing: pacing };
  const slowedFrame = { ...oldFrame, motionPacing: second };
  assert.deepEqual(advance(slowedFrame, 0.064, 3500).motionPacing,
    advance(oldFrame, 0.064, 3500).motionPacing,
    'future arrival forecasting uses actual source history, never progress padding');
});

test('pending slowdown anchors at an already displayed age and cannot rewind it', () => {
  const pacing = createIsosurfaceMotionPacing(next, prior, 4000);
  const slowed = slowIsosurfaceMotionPacing(pacing, 5000, 4, 0.04);
  assert.notEqual(slowed, pacing);
  assert.equal(slowed.segmentAnchorAgeS, 0.04);
  assert.equal(isosurfaceMotionAge(slowed, 5000), 0.04);
  let last = 0.04;
  for (let at = 5000; at < 12000; at += 17) {
    const age = isosurfaceMotionAge(slowed, at);
    assert.ok(Number.isFinite(age) && age >= last && age <= 0.064);
    last = age;
  }
  assert.equal(last, 0.064);
});

test('an exhausted simulation horizon cannot be restarted by delayed progress', () => {
  const pacing = createIsosurfaceMotionPacing(next, prior, 4000);
  for (const at of [7000, 1e9]) {
    assert.equal(slowIsosurfaceMotionPacing(pacing, at, 4), pacing);
  }
  assert.equal(slowIsosurfaceMotionPacing(pacing, 5000, 4, 0.064), pacing);
  assert.equal(isosurfaceMotionAge(pacing, 7312), 0.064);
});

test('pending slowdown rejects invalid observations without changing pacing identity', () => {
  const pacing = createIsosurfaceMotionPacing(next, prior, 4000);
  for (const remaining of [undefined, null, '4', 0, -1, NaN, Infinity, -Infinity]) {
    assert.equal(slowIsosurfaceMotionPacing(pacing, 5000, remaining), pacing,
      `remaining ${String(remaining)}`);
  }
  for (const at of [undefined, null, '5000', 3999, NaN, Infinity, -Infinity]) {
    assert.equal(slowIsosurfaceMotionPacing(pacing, at, 4), pacing,
      `clock ${String(at)}`);
  }
  for (const age of [null, '0', -1, 0.065, NaN, Infinity, -Infinity]) {
    assert.equal(slowIsosurfaceMotionPacing(pacing, 5000, 4, age), pacing,
      `displayed age ${String(age)}`);
  }
  assert.equal(slowIsosurfaceMotionPacing(null, 5000, 4), null);
});

test('retiming a segment rejects a regressed anchor and underflowing future speed', () => {
  const pacing = createIsosurfaceMotionPacing(next, prior, 4000);
  const slowed = slowIsosurfaceMotionPacing(pacing, 5000, 4);
  assert.equal(slowIsosurfaceMotionPacing(slowed, 4999, 8), slowed);
  const tiny = Object.freeze({ ...pacing, maxSimulationAgeS: Number.MIN_VALUE,
    simulationTimeScale: Number.MIN_VALUE });
  assert.equal(slowIsosurfaceMotionPacing(tiny, 4000, Number.MAX_VALUE), tiny,
    'a zero slope from finite-input underflow cannot create an endless motion horizon');
});

function bootstrapFixture() {
  const receiptFields = {
    laneId: 'lane', stateKey: 'state', scheduleId: 'first-schedule',
    presentationLaneEpoch: 2, residentExecutionGeneration: 7,
    sphStep: 63, stepOrdinal: 64,
    residentScheduleCandidatePresentation: true,
    stateManagerCommittedPresentation: true,
    committedPresentationSchema:
      'peercompute.ulg.presentation-worker-committed-resident-schedule-presentation.v0',
    committedPresentationStatus:
      'state-manager-committed-resident-schedule-presentation-admission',
    authorityStatus: 'state-manager-committed-worker-schedule',
    computeManagerCompletionSchema:
      'peercompute.ulg.schroeder-worker-lane-compute-manager-completion.v0',
    computeManagerLeaseId: 'lease:first-schedule',
    computeManagerLeaseStatus: 'completed', computeManagerFenceSatisfied: true,
    stateManagerCommitStatus: 'committed', stateManagerCommitAccepted: true,
    terminalScheduleFence: true, terminalFenceSatisfied: true,
    terminalFenceAuthorityAdmissionReady: true,
    terminalFenceScope: 'resident-schedule-terminal'
  };
  const sourceLineage = {
    storageGeneration: 7, physicsTick: 0, physicsSubstep: 0,
    positionEpoch: 0, topologyEpoch: 0, chartEpoch: 0, levelEpoch: 0,
    supportEpoch: 0
  };
  const frame = { sourceTimeS: 0.064, sphStep: 63, receiptFields };
  const bootstrap = {
    schema: 'peercompute.ulg.isosurface-source-timing-bootstrap.v0',
    scheduleId: receiptFields.scheduleId, laneId: receiptFields.laneId,
    stateKey: receiptFields.stateKey,
    presentationLaneEpoch: receiptFields.presentationLaneEpoch,
    candidateVersion: { residentExecutionGeneration: 7, nextStep: 63,
      scheduleId: receiptFields.scheduleId, stepOrdinal: 64 },
    sourceTimeS: 0, sourceObservedAtMs: 1000, terminalSourceTimeS: 0.064,
    sourceLineage,
    targetLineage: { ...sourceLineage, physicsTick: 64, positionEpoch: 64 }
  };
  return { frame, bootstrap };
}

test('bootstrap paces the first admitted source from an explicit seed interval, not a fake displayed frame', () => {
  const { frame, bootstrap } = bootstrapFixture();
  assert.notEqual(bootstrap.candidateVersion.nextStep, bootstrap.targetLineage.physicsTick,
    'the render candidate step and canonical target tick have distinct conventions');
  const pacing = createIsosurfaceMotionPacing(frame, null, 3000, bootstrap);
  assert.ok(pacing);
  assert.equal(pacing.pacingMethod, 'seeded-source-interval-bootstrap');
  assert.equal(pacing.startedAtMs, 3000);
  assert.equal(pacing.sourceTimeS, 0.064);
  assert.equal(pacing.maxSimulationAgeS, 0.064);
  assert.equal(pacing.maxWallAgeS, 2);
  assert.equal(pacing.targetHz, 60);
  assert.equal(pacing.authoritativeStateMutation, false);
  assert.equal(isosurfaceMotionAge(pacing, 2999), null);
  assert.equal(isosurfaceMotionAge(pacing, 3000), 0);
  assert.equal(isosurfaceMotionAge(pacing, 3500), 0.016);
  assert.equal(isosurfaceMotionAge(pacing, 5000), 0.064);
  assert.equal(isosurfaceMotionAge(pacing, 1e9), 0.064);
  assert.ok(Object.isFrozen(pacing));
});

test('bootstrap uses the actual nonzero seed clock and remains detached from later evidence mutation', () => {
  const { frame, bootstrap } = bootstrapFixture();
  frame.sourceTimeS = bootstrap.terminalSourceTimeS = 2.125;
  bootstrap.sourceTimeS = 2;
  const pacing = createIsosurfaceMotionPacing(frame, null, 3000, bootstrap);
  assert.ok(pacing);
  assert.equal(pacing.maxSimulationAgeS, 0.125);
  bootstrap.sourceTimeS = 0;
  bootstrap.sourceObservedAtMs = -10000;
  bootstrap.targetLineage.physicsTick = 1e6;
  assert.equal(pacing.maxSimulationAgeS, 0.125);
  assert.equal(pacing.maxWallAgeS, 2);
  assert.equal(isosurfaceMotionAge(pacing, 4000), 0.0625);
});

test('bootstrap rejects absent, malformed, regressed, and overflowing source timing without inventing an interval', () => {
  for (const evidence of [undefined, null, {}, false, 'seed']) {
    const { frame } = bootstrapFixture();
    assert.equal(createIsosurfaceMotionPacing(frame, null, 3000, evidence), null);
  }
  const cases = [
    ['schema', evidence => { evidence.schema = 'invented'; }],
    ...['sourceTimeS', 'sourceObservedAtMs', 'terminalSourceTimeS'].flatMap(field =>
      [undefined, null, '0', NaN, Infinity, -Infinity, -1].map(value =>
        [`${field}=${String(value)}`, evidence => { evidence[field] = value; }])),
    ['no simulation interval', evidence => { evidence.sourceTimeS = 0.064; }],
    ['regressed simulation interval', evidence => { evidence.sourceTimeS = 0.128; }],
    ['terminal source mismatch', evidence => { evidence.terminalSourceTimeS = 0.128; }],
    ['no wall interval', evidence => { evidence.sourceObservedAtMs = 3000; }],
    ['regressed wall interval', evidence => { evidence.sourceObservedAtMs = 4000; }]
  ];
  for (const [label, change] of cases) {
    const { frame, bootstrap } = bootstrapFixture();
    change(bootstrap);
    assert.equal(createIsosurfaceMotionPacing(frame, null, 3000, bootstrap), null, label);
  }
  for (const presentedAtMs of [undefined, null, '3000', NaN, Infinity, -Infinity, -1]) {
    const { frame, bootstrap } = bootstrapFixture();
    assert.equal(createIsosurfaceMotionPacing(frame, null, presentedAtMs, bootstrap), null,
      `presented clock ${String(presentedAtMs)}`);
  }
  const { frame, bootstrap } = bootstrapFixture();
  frame.sourceTimeS = bootstrap.terminalSourceTimeS = Number.MIN_VALUE;
  assert.equal(createIsosurfaceMotionPacing(frame, null, 3000, bootstrap), null,
    'finite clocks must not create an infinite derived rate');
});

test('bootstrap binds exact committed candidate scope and never mixes authority receipts', () => {
  const cases = [
    ...['laneId', 'stateKey', 'scheduleId'].flatMap(field =>
      [null, '', 'other'].map(value =>
        [`bootstrap ${field}=${String(value)}`, (_frame, evidence) => { evidence[field] = value; }])),
    ['candidate schedule', (_frame, evidence) => { evidence.candidateVersion.scheduleId = 'other'; }],
    ...['presentationLaneEpoch'].flatMap(field =>
      [null, -1, 2.5, '2', 3].map(value =>
        [field, (_frame, evidence) => { evidence[field] = value; }])),
    ...['residentExecutionGeneration', 'nextStep', 'stepOrdinal'].flatMap(field =>
      [null, -1, 1.5, '7', 99, NaN, Infinity].map(value =>
        [`candidate ${field}=${String(value)}`, (_frame, evidence) => { evidence.candidateVersion[field] = value; }])),
    ['frame step mismatch', frame => { frame.sphStep = 62; }],
    ['missing frame receipt', frame => { frame.receiptFields = null; }],
    ...['residentScheduleCandidatePresentation', 'stateManagerCommittedPresentation',
      'computeManagerFenceSatisfied', 'stateManagerCommitAccepted', 'terminalScheduleFence',
      'terminalFenceSatisfied', 'terminalFenceAuthorityAdmissionReady'].flatMap(field =>
      [false, null, 'true'].map(value =>
        [`authority ${field}=${String(value)}`, frame => { frame.receiptFields[field] = value; }])),
    ...['committedPresentationSchema', 'committedPresentationStatus',
      'computeManagerCompletionSchema', 'authorityStatus', 'computeManagerLeaseStatus',
      'stateManagerCommitStatus', 'terminalFenceScope'].map(field =>
      [field, frame => { frame.receiptFields[field] = 'uncommitted-live-preview'; }]),
    ...[null, '', ' ', 123].map(value =>
      ['compute lease ID', frame => { frame.receiptFields.computeManagerLeaseId = value; }])
  ];
  for (const [label, change] of cases) {
    const { frame, bootstrap } = bootstrapFixture();
    change(frame, bootstrap);
    assert.equal(createIsosurfaceMotionPacing(frame, null, 3000, bootstrap), null, label);
  }
});

test('bootstrap needs exact valid advancing source lineages, not a terminal tick guessed from render step', () => {
  const fields = Object.keys(bootstrapFixture().bootstrap.sourceLineage);
  for (const side of ['sourceLineage', 'targetLineage']) {
    for (const field of fields) {
      for (const value of [undefined, null, '0', -1, 0.5, NaN, Infinity]) {
        const { frame, bootstrap } = bootstrapFixture();
        bootstrap[side][field] = value;
        assert.equal(createIsosurfaceMotionPacing(frame, null, 3000, bootstrap), null,
          `${side}.${field}=${String(value)}`);
      }
    }
  }
  for (const sourceTick of [64, 65]) {
    const { frame, bootstrap } = bootstrapFixture();
    bootstrap.sourceLineage.physicsTick = sourceTick;
    assert.equal(createIsosurfaceMotionPacing(frame, null, 3000, bootstrap), null,
      'bootstrap cannot extrapolate from stationary or regressed source lineage');
  }
});

test('bootstrap never substitutes for an existing previous frame, including invalid previous history', () => {
  const { frame, bootstrap } = bootstrapFixture();
  for (const previous of [{}, frame, { ...frame, sourcePresentedAtMs: 1000 },
    { ...prior, receiptFields: { laneId: 'other', stateKey: 'state' } }]) {
    assert.equal(createIsosurfaceMotionPacing(frame, previous, 3000, bootstrap), null);
  }
  const normalFrame = { ...frame, sphStep: 127, sourceTimeS: 0.128 };
  const actualPrior = { ...frame, sourcePresentedAtMs: 3000 };
  assert.deepEqual(createIsosurfaceMotionPacing(normalFrame, actualPrior, 4000, bootstrap),
    createIsosurfaceMotionPacing(normalFrame, actualPrior, 4000));
});

test('two real presentations discard bootstrap cold-start timing before normal jitter forecasting', () => {
  const { frame, bootstrap } = bootstrapFixture();
  frame.sourcePresentedAtMs = 3000;
  frame.motionPacing = createIsosurfaceMotionPacing(frame, null, 3000, bootstrap);
  assert.ok(frame.motionPacing);
  const second = advance(frame, 0.064, 1000);
  assert.equal(second.motionPacing.pacingMethod, 'two-source-interval-jitter-budget');
  assert.ok(Math.abs(second.motionPacing.maxWallAgeS - 1) < 1e-12,
    'the seed-to-first display two-second cold start is not a real inter-presentation observation');
  const third = advance(second, 0.064, 1500);
  assert.ok(Math.abs(third.motionPacing.maxWallAgeS - 2) < 1e-12);
  assert.ok(Math.abs(third.motionPacing.maxSimulationAgeS - 0.064) < 1e-12);
});

test('bootstrap snapshots detach and freeze every timing lineage and copy only the supported scalar envelope', () => {
  const { bootstrap } = bootstrapFixture();
  bootstrap.unrelatedMutableState = { particles: new Float32Array([123]) };
  const snapshot = snapshotIsosurfaceSourceTimingBootstrap(bootstrap);
  assert.ok(snapshot);
  assert.equal(Object.hasOwn(snapshot, 'unrelatedMutableState'), false);
  for (const [left, right] of [[snapshot, bootstrap],
    [snapshot.candidateVersion, bootstrap.candidateVersion],
    [snapshot.sourceLineage, bootstrap.sourceLineage],
    [snapshot.targetLineage, bootstrap.targetLineage]]) {
    assert.notEqual(left, right);
    assert.ok(Object.isFrozen(left));
  }
  const before = structuredClone(snapshot);
  bootstrap.candidateVersion.nextStep = 1000;
  bootstrap.sourceLineage.storageGeneration = 1000;
  bootstrap.targetLineage.physicsTick = 1000;
  bootstrap.sourceObservedAtMs = 1000 * 1000;
  assert.deepEqual(snapshot, before);
});
