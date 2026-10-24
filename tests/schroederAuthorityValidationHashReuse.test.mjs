import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import * as abi from '../ulg-gpu-abi/src/index.js';
import * as route from '../src/runtime/sph/schroederWorkerScheduleRouteEvidence.js';
import {
  SPH_REACTION_MOTION_ENVELOPE_PREDICATE,
  SPH_REACTION_MOTION_ENVELOPE_PREDICATE_REVISION
} from '../src/runtime/sph/sphReactionMotionEnvelope.js';
import {
  createSchroederTargetScheduleAuthority,
  createSchroederTargetScheduleConfiguration,
  createSchroederTargetScheduleProviderAuthority,
  exactSchroederProspectiveDynamicLawTransition,
  exactSchroederTargetScheduleAuthority,
  exactSchroederTargetScheduleConfiguration
} from '../src/runtime/sph/schroederTargetScheduleAuthority.js';

const CONFIGURATION_LABEL = 'schroeder-target-schedule-configuration-v1';
const provider = createSchroederTargetScheduleProviderAuthority({ kind: 'none' });
const configurationOptions = {
  maxFutureSubsteps: 2, dtS: 0.001, gridSpacingM: 0.25,
  cflFactor: 0.4, boxDimsM: [5, 5, 5], scheduleStepOptionsProvider: provider
};

// Same minimal packed watch-table shape as the dynamic-law routing contract
// fixtures. This is protocol data, not a second physics implementation.
function reactionTable() {
  const table = {
    schema: abi.ULG_SPH_GPU_REACTION_TABLE_SCHEMA,
    reactionClosureSchema: abi.ULG_REACTION_CLOSURE_SCHEMA,
    status: 'derived-reaction-table-ready',
    reactionCount: 1, reactionHeaderCount: 1,
    reactantTermCount: 0, productTermCount: 0, gasProductCount: 0,
    atomTermCount: 0, productPhaseCount: 0,
    records: new Float32Array([1, 2, 3, 300, 0, 0.1, 0, 0, 1, 0, 0, 0])
  };
  const sections = [
    ['record', 'records', 'SPH_GPU_REACTION_RECORD_ROW_LAYOUT', 1],
    ['productPhase', 'productPhaseRecords', 'SPH_GPU_REACTION_PRODUCT_PHASE_ROW_LAYOUT', 0],
    ['reactionHeader', 'reactionHeaders', 'SPH_GPU_REACTION_HEADER_ROW_LAYOUT', 1],
    ['reactantTerm', 'reactantTermRecords', 'SPH_GPU_REACTION_REACTANT_TERM_ROW_LAYOUT', 0],
    ['productTerm', 'productTermRecords', 'SPH_GPU_REACTION_PRODUCT_TERM_ROW_LAYOUT', 0],
    ['gasProduct', 'gasProductRecords', 'SPH_GPU_REACTION_GAS_PRODUCT_ROW_LAYOUT', 0],
    ['atomTerm', 'atomTermRecords', 'SPH_GPU_REACTION_ATOM_TERM_ROW_LAYOUT', 0]
  ];
  for (const [prefix, rows, layoutName, count] of sections) {
    const layout = abi[layoutName];
    table[`${prefix}Layout`] = [...layout];
    table[`${prefix}StrideFloats`] = layout.length;
    table[rows] ??= new Float32Array(count * layout.length);
  }
  table.combinedRecords = new Float32Array(sections.flatMap(([, rows]) => [...table[rows]]));
  table.combinedRecordCount = table.combinedRecords.length / 4;
  return table;
}

function fixture(kind = 'reaction') {
  const table = reactionTable();
  const options = active => ({
    ambientPressurePa: 0, contactSolverEnabled: false,
    ...(active ? { reactionTable: table } : { reactionActivationWatchTable: table })
  });
  const source = createSchroederTargetScheduleConfiguration({
    ...configurationOptions, residentStepOptions: options(kind === 'retained-gas')
  });
  const target = createSchroederTargetScheduleConfiguration({
    ...configurationOptions, residentStepOptions: options(true),
    retainedProductGasBoundaryActionable: kind === 'retained-gas'
  });
  const authority = createSchroederTargetScheduleAuthority({
    sourceScheduleId: 'hash-reuse:source', targetScheduleRequestId: 'hash-reuse:target',
    laneId: 'hash-reuse:lane', stateKey: 'hash-reuse:state',
    sourceLineage: {
      storageGeneration: 11, physicsTick: 13, physicsSubstep: 0, positionEpoch: 17,
      topologyEpoch: 19, chartEpoch: 23, levelEpoch: 29, supportEpoch: 31
    },
    sourceParticleCount: 64, sourcePhaseLaneCount: 1,
    currentTargetConfiguration: source, prospectiveTargetConfiguration: target
  });
  return { source, target, authority, transition: authority.prospectiveDynamicLawTransition };
}

function isConfigurationText(text) {
  return typeof text === 'string' && text.startsWith('o:{"motionEnvelope"=')
    && text.includes('"schema"=s:"peercompute.ulg.schroeder-target-schedule-configuration.v1"');
}

function successorFixture(kind) {
  const sealed = fixture(kind);
  const predecessor = sealed.authority;
  const gas = kind === 'retained-gas';
  const arena = gas ? {
    schema: 'peercompute.ulg.sph-resident-product-history-arena-identity.v0',
    status: 'retained-product-history-arena-authenticated',
    slotId: 3, leaseSerial: 11, viewOrdinal: 7, rowCapacity: 8,
    bufferByteLength: 640, rowStrideFloats: 20,
    countAuthorityGeneration: 19, countAuthoritySeal: 0x5a17_c0de
  } : null;
  const observation = {
    schema: route.ULG_WORKER_SCHEDULE_DYNAMIC_LAW_OBSERVATION_SCHEMA,
    status: 'dynamic-law-routing-observation-ready',
    sourceScheduleId: predecessor.sourceScheduleId,
    targetScheduleRequestId: predecessor.targetScheduleRequestId,
    targetScheduleAuthorityFingerprint: predecessor.requestFingerprint,
    laneId: predecessor.laneId, stateKey: predecessor.stateKey, lawFamily: 'reaction',
    predicateRevision: SPH_REACTION_MOTION_ENVELOPE_PREDICATE_REVISION,
    predicate: SPH_REACTION_MOTION_ENVELOPE_PREDICATE,
    producerRoute: 'tier0-fused-resident-sequence',
    sampleStage: 'tier0-terminal-post-separation-motion-envelope',
    nodeDomain: 'fixed-phase-carrier-slot', motionEnvelope: predecessor.motionEnvelope,
    shadowOnly: predecessor.shadowOnly, routingAuthority: predecessor.routingAuthority,
    executionGating: predecessor.executionGating,
    observationSucceeded: true, triggered: !gas, triggeredSourceCount: gas ? 0 : 1,
    uncertainty: false, rawEvidenceWord: gas ? 0 : 1, particleCount: 64,
    reactionCount: predecessor.tableFingerprints.watchReactionCount,
    reactionTableFingerprint: predecessor.tableFingerprints.watchReactionTableFingerprint,
    prospectiveWriterEvidence: {
      schema: route.ULG_WORKER_SCHEDULE_PROSPECTIVE_WRITER_EVIDENCE_SCHEMA,
      status: gas ? 'worker-retained-product-gas-boundary-actionable'
        : 'worker-retained-product-gas-boundary-inactive',
      gasBoundaryActionable: gas, retainedProductGasBoundaryActionable: gas,
      source: gas ? 'worker-retained-product-event-buffer' : null,
      productEventBufferRetained: gas, productEventRowCount: gas ? 8 : 0,
      productHistoryArenaIdentity: arena, productHistoryLiveBoundObservation: null,
      terminalGpuFenceSatisfied: true, scheduleCancelled: false
    },
    mapAsyncCount: 1, readbackByteLength: 4, fullParticleReadbackPerformed: false,
    terminalLineage: { ...predecessor.sourceLineage, storageGeneration: 12, physicsTick: 14, positionEpoch: 18 },
    failureReason: null, failurePolicy: route.WORKER_DYNAMIC_LAW_OBSERVATION_FAILURE_POLICY
  };
  assert.equal(route.exactWorkerDynamicLawObservationSelf(observation), observation);
  const authority = createSchroederTargetScheduleAuthority({
    sourceScheduleId: predecessor.targetScheduleRequestId,
    targetScheduleRequestId: 'hash-reuse:successor',
    laneId: predecessor.laneId, stateKey: predecessor.stateKey,
    sourceLineage: observation.terminalLineage, sourceParticleCount: 64, sourcePhaseLaneCount: 1,
    predecessorTargetScheduleAuthority: predecessor,
    predecessorDynamicLawObservation: observation,
    currentTargetConfiguration: sealed.target
  });
  return { ...sealed, authority };
}

// Validators intentionally catch fingerprint errors. Record observations here,
// and assert them AFTER the call so a failed assertion cannot become null.
function observeEncoding(run, beforeEncode = null) {
  const OriginalEncoder = globalThis.TextEncoder;
  const texts = [];
  let value;
  let error;
  class CountedEncoder extends OriginalEncoder {
    encode(text) {
      texts.push(text);
      beforeEncode?.(text);
      return super.encode(text);
    }
  }
  globalThis.TextEncoder = CountedEncoder;
  try { value = run(); } catch (caught) { error = caught; }
  finally { globalThis.TextEncoder = OriginalEncoder; }
  return { value, error, texts, configurations: texts.filter(isConfigurationText) };
}

function frequencies(texts) {
  const counts = new Map();
  for (const text of texts) counts.set(text, (counts.get(text) || 0) + 1);
  return counts;
}

function fingerprintOfText(text) {
  return `sha256:${CONFIGURATION_LABEL}:${createHash('sha256').update(text).digest('hex')}`;
}

for (const kind of ['reaction', 'retained-gas']) {
  for (const scope of ['transition', 'authority']) {
    test(`${kind} ${scope} hashes each fresh configuration text once per public invocation`, () => {
      const sealed = fixture(kind);
      const value = structuredClone(sealed[scope]);
      const before = structuredClone(value);
      const validate = scope === 'transition'
        ? exactSchroederProspectiveDynamicLawTransition : exactSchroederTargetScheduleAuthority;
      const first = observeEncoding(() => validate(value));
      const second = observeEncoding(() => validate(value));
      for (const observed of [first, second]) {
        assert.equal(observed.error, undefined);
        assert.equal(observed.value, value, 'public validation returns the original object');
        assert.equal(new Set(observed.configurations).size, 2, 'source and target are different contents');
        assert.deepEqual([...frequencies(observed.configurations).values()], [1, 1]);
        assert.deepEqual(new Set(observed.configurations.map(fingerprintOfText)), new Set([
          sealed.source.configurationFingerprint, sealed.target.configurationFingerprint
        ]), 'configuration fingerprint bytes still equal independent SHA256 of the exact text');
      }
      assert.deepEqual(second.configurations, first.configurations, 'a new public call starts fresh');
      assert.deepEqual(value, before, 'validation preserves caller content');
      assert.equal(Object.isFrozen(value), false);
    });
  }
  test(`${kind} predecessor-bearing authority shares only configuration text hashes across observation checks`, () => {
    const sealed = successorFixture(kind);
    const value = structuredClone(sealed.authority);
    assert.ok(value.predecessorDynamicLawTransition);
    assert.ok(value.predecessorDynamicLawObservation);
    const before = structuredClone(value);
    const first = observeEncoding(() => exactSchroederTargetScheduleAuthority(value));
    const second = observeEncoding(() => exactSchroederTargetScheduleAuthority(value));
    for (const observed of [first, second]) {
      assert.equal(observed.error, undefined);
      assert.equal(observed.value, value);
      assert.equal(new Set(observed.configurations).size, 2);
      assert.deepEqual([...frequencies(observed.configurations).values()], [1, 1]);
      assert.deepEqual(new Set(observed.configurations.map(fingerprintOfText)), new Set([
        sealed.source.configurationFingerprint, sealed.target.configurationFingerprint
      ]));
    }
    assert.deepEqual(first.configurations, second.configurations);
    assert.deepEqual(value, before);
  });
}

test('standalone configuration calls recompute exact bytes after a nested mutation', () => {
  const value = structuredClone(fixture().source);
  const first = observeEncoding(() => exactSchroederTargetScheduleConfiguration(value));
  value.tableFingerprints.thermalStepOptions = 'changed-after-first-public-call';
  const second = observeEncoding(() => exactSchroederTargetScheduleConfiguration(value));
  assert.equal(first.error, undefined);
  assert.equal(first.value, value);
  assert.equal(first.configurations.length, 1);
  assert.equal(second.error, undefined);
  assert.equal(second.value, null);
  assert.equal(second.configurations.length, 1);
  assert.notEqual(first.configurations[0], second.configurations[0]);
});

test('repeated configuration checks preserve getter reads even when the text hash is reused', () => {
  const value = structuredClone(fixture().transition);
  const source = value.sourceConfiguration;
  const fingerprint = source.configurationFingerprint;
  let reads = 0;
  Object.defineProperty(source, 'configurationFingerprint', {
    enumerable: true, configurable: true, get() { reads++; return fingerprint; }
  });
  const observed = observeEncoding(() => exactSchroederProspectiveDynamicLawTransition(value));
  assert.equal(observed.error, undefined);
  assert.equal(observed.value, value);
  // Original sequence: guard/rest-spread/comparison twice, then transition text.
  assert.equal(reads, 7, 'a cached result must not skip the second object validation');
  assert.deepEqual([...frequencies(observed.configurations).values()], [1, 1]);
});

test('a later wrong claimed fingerprint is rejected even when its reconstructed token is unchanged', () => {
  const value = structuredClone(fixture().transition);
  const source = value.sourceConfiguration;
  const fingerprint = source.configurationFingerprint;
  let reads = 0;
  Object.defineProperty(source, 'configurationFingerprint', {
    enumerable: true, configurable: true,
    get() { return ++reads === 6 ? 'wrong-second-comparison' : fingerprint; }
  });
  const observed = observeEncoding(() => exactSchroederProspectiveDynamicLawTransition(value));
  assert.equal(observed.error, undefined);
  assert.equal(observed.value, null);
  assert.equal(reads, 6);
  assert.deepEqual([...frequencies(observed.configurations).values()], [1, 1]);
});

test('delegating Proxy keeps the original property and descriptor access order', () => {
  const value = structuredClone(fixture().transition);
  const events = [];
  value.sourceConfiguration = new Proxy(value.sourceConfiguration, {
    get(target, key, receiver) {
      events.push(`get:${String(key)}`);
      return Reflect.get(target, key, receiver);
    },
    ownKeys(target) { events.push('ownKeys'); return Reflect.ownKeys(target); },
    getOwnPropertyDescriptor(target, key) {
      events.push(`descriptor:${String(key)}`);
      return Reflect.getOwnPropertyDescriptor(target, key);
    }
  });
  const observed = observeEncoding(() => exactSchroederProspectiveDynamicLawTransition(value));
  assert.equal(observed.error, undefined);
  assert.equal(observed.value, value);
  // Captured from the original validator, including both full configuration
  // visits and the enclosing transition serialization. Hash-only reuse must
  // not remove, add, or reorder any of these observable operations.
  assert.equal(events.length, 113);
  assert.equal(createHash('sha256').update(JSON.stringify(events)).digest('hex'),
    'a8623e4ba672c02268c4c20f91f5daa9fd77fbf70dbb3d51eadf957428503706');
});

for (const [name, payload, expectedReads] of [
  ['changed text', () => 'changed-inside-second-fingerprint', 6],
  ['nonfinite NaN', () => NaN, 5],
  ['nonfinite Infinity', () => Infinity, 5],
  ['undefined', () => undefined, 5],
  ['cycle', source => source, 6],
  ['typed array', () => new Uint8Array([1, 2, 255]), 6]
]) {
  test(`second fingerprint visit reserializes ${name} instead of trusting cached object identity`, () => {
    const value = structuredClone(fixture().transition);
    const source = value.sourceConfiguration;
    const fingerprint = source.configurationFingerprint;
    let reads = 0;
    Object.defineProperty(source, 'configurationFingerprint', {
      enumerable: true, configurable: true,
      get() {
        reads++;
        // Both guards have already inspected the table. The second spread
        // must still read changed content and retain its original failure path.
        if (reads === 5) source.tableFingerprints.thermalMaterialTable = payload(source);
        return fingerprint;
      }
    });
    const observed = observeEncoding(() => exactSchroederProspectiveDynamicLawTransition(value));
    assert.equal(observed.error, undefined);
    assert.equal(observed.value, null);
    assert.equal(reads, expectedReads);
    if (name === 'changed text' || name === 'typed array') {
      assert.equal(new Set(observed.configurations).size, 3,
        'the changed token is hashed independently from the source and target originals');
    } else {
      assert.equal(new Set(observed.configurations).size, 2,
        'malformed content still fails during serialization before another text hash');
    }
  });
}

test('a structural getter exception still escapes while a fingerprint-spread exception remains null', () => {
  const sealed = fixture().source;
  const structural = structuredClone(sealed);
  const structuralError = new Error('structural getter failure');
  Object.defineProperty(structural, 'schema', { enumerable: true, get() { throw structuralError; } });
  const outside = observeEncoding(() => exactSchroederTargetScheduleConfiguration(structural));
  assert.equal(outside.error, structuralError);
  assert.equal(outside.value, undefined);
  assert.equal(outside.configurations.length, 0);

  const spread = structuredClone(sealed);
  const fingerprint = spread.configurationFingerprint;
  const spreadError = new Error('fingerprint spread failure');
  let reads = 0;
  Object.defineProperty(spread, 'configurationFingerprint', {
    enumerable: true, configurable: true,
    get() { if (++reads === 2) throw spreadError; return fingerprint; }
  });
  const inside = observeEncoding(() => exactSchroederTargetScheduleConfiguration(spread));
  assert.equal(inside.error, undefined);
  assert.equal(inside.value, null);
  assert.equal(reads, 2);
  assert.equal(inside.configurations.length, 0);
  const retry = observeEncoding(() => exactSchroederTargetScheduleConfiguration(spread));
  assert.equal(retry.error, undefined);
  assert.equal(retry.value, spread);
  assert.equal(retry.configurations.length, 1, 'a prior caught error is not memoized');
});

test('a thrown encoder result is never cached and a later public call retries it', () => {
  const value = structuredClone(fixture().transition);
  const failure = new Error('injected encoding failure');
  let injected = false;
  const failed = observeEncoding(() => exactSchroederProspectiveDynamicLawTransition(value), text => {
    if (!injected && isConfigurationText(text)) { injected = true; throw failure; }
  });
  const retry = observeEncoding(() => exactSchroederProspectiveDynamicLawTransition(value));
  assert.equal(injected, true);
  assert.equal(failed.error, undefined);
  assert.equal(failed.value, null);
  assert.equal(retry.error, undefined);
  assert.equal(retry.value, value);
  assert.deepEqual([...frequencies(retry.configurations).values()], [1, 1]);
});

test('public validation reentered by a getter uses a fresh memo without discarding the outer memo', () => {
  const value = structuredClone(fixture().transition);
  const source = value.sourceConfiguration;
  const inner = structuredClone(source);
  const fingerprint = source.configurationFingerprint;
  let reads = 0;
  let innerResult;
  Object.defineProperty(source, 'configurationFingerprint', {
    enumerable: true, configurable: true,
    get() {
      if (++reads === 4) innerResult = exactSchroederTargetScheduleConfiguration(inner);
      return fingerprint;
    }
  });
  const observed = observeEncoding(() => exactSchroederProspectiveDynamicLawTransition(value));
  assert.equal(observed.error, undefined);
  assert.equal(observed.value, value);
  assert.equal(innerResult, inner);
  assert.equal(reads, 7);
  const countsByFingerprint = new Map([...frequencies(observed.configurations)]
    .map(([text, count]) => [fingerprintOfText(text), count]));
  assert.equal(countsByFingerprint.get(fingerprint), 2, 'inner public call cannot inherit the outer memo');
  assert.equal(countsByFingerprint.get(value.targetConfiguration.configurationFingerprint), 1);
});

test('typed-array table inputs are rehashed after byte mutation in a later configuration construction', () => {
  const bytes = new Uint8Array([1, 2, 3, 4]);
  const options = {
    ...configurationOptions,
    residentStepOptions: { ambientPressurePa: 0, thermalStepOptions: { fixtureBytes: bytes } }
  };
  const first = createSchroederTargetScheduleConfiguration(options);
  bytes[2] = 19;
  const second = createSchroederTargetScheduleConfiguration(options);
  assert.notEqual(first.tableFingerprints.thermalStepOptions, second.tableFingerprints.thermalStepOptions);
  assert.notEqual(first.configurationFingerprint, second.configurationFingerprint);
  assert.equal(exactSchroederTargetScheduleConfiguration(first), first);
  assert.equal(exactSchroederTargetScheduleConfiguration(second), second);
});

test('extra caller arguments cannot inject a configuration hash or a validation context', () => {
  const sealed = fixture();
  for (const [validate, original] of [
    [exactSchroederTargetScheduleConfiguration, sealed.source],
    [exactSchroederProspectiveDynamicLawTransition, sealed.transition],
    [exactSchroederTargetScheduleAuthority, sealed.authority]
  ]) {
    const value = structuredClone(original);
    const configuration = value.sourceConfiguration ?? value.prospectiveDynamicLawTransition?.sourceConfiguration ?? value;
    configuration.configurationFingerprint = 'caller-forged-fingerprint';
    let suppliedLookups = 0;
    const supplied = new Map();
    supplied.get = () => { suppliedLookups++; return configuration.configurationFingerprint; };
    const observed = observeEncoding(() => validate(value, supplied));
    assert.equal(observed.error, undefined);
    assert.equal(observed.value, null);
    assert.equal(suppliedLookups, 0, 'public validation never trusts a caller-supplied memo');
  }
});
