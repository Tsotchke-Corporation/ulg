import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_SPH_INITIAL_BODIES_MAX_CROSS_BODY_CELL_PITCH_RATIO,
  DEFAULT_SPH_INITIAL_BODY_MAX_CELL_PITCH_ANISOTROPY_RATIO,
  SPH_INITIAL_BODIES_SCHEMA,
  SPH_INITIAL_BODIES_MAX_TOTAL_LIVE_PARTICLES,
  SPH_INITIAL_BODIES_SIMULATION_PREFLIGHT_SCHEMA,
  SphInitialBodiesValidationError,
  allocateNextSphInitialBodyIdentity,
  duplicateSphInitialBody,
  moveSphInitialBody,
  normalizeSphInitialBodies,
  parseSphInitialBodies,
  preflightSphInitialBodiesForSimulation,
  reorderSphInitialBodies,
  serializeSphInitialBodies,
  sphInitialBodiesFromLegacyDropBase,
  sphInitialBodiesFromLegacyPhaseControls,
  sphInitialBodiesSignature,
  sphInitialBodiesToLegacyDropBase
} from '../src/runtime/sphInitialBodies.js';

function body(overrides = {}) {
  return {
    id: 'base',
    domainId: 1,
    material: 'h2o',
    sizeM: [1, 1, 1],
    centerM: [2.5, 0.5, 2.5],
    temperatureK: 293.15,
    particlesPerEdge: [10, 10, 10],
    velocityMPerS: [0, 0, 0],
    legacyRole: 'base',
    ...overrides
  };
}

function pair() {
  return [
    body(),
    body({
      id: 'drop',
      domainId: 2,
      material: 'fe',
      sizeM: [0.5, 0.5, 0.5],
      centerM: [2.5, 2.75, 2.5],
      temperatureK: 1850,
      particlesPerEdge: [5, 5, 5],
      legacyRole: 'drop'
    })
  ];
}

test('normalization produces a strict versioned ordered authority', () => {
  const source = pair();
  source[0] = {
    ...source[0],
    domainId: '1',
    sizeM: ['1', 1, 1],
    centerM: ['2.5', 0.5, -0],
    temperatureK: '293.15',
    particlesPerEdge: ['10', 10, 10]
  };
  const normalized = normalizeSphInitialBodies(source);

  assert.equal(normalized.schema, SPH_INITIAL_BODIES_SCHEMA);
  assert.deepEqual(normalized.bodies.map((entry) => entry.id), ['base', 'drop']);
  assert.equal(normalized.bodies[0].domainId, 1);
  assert.deepEqual(normalized.bodies[0].sizeM, [1, 1, 1]);
  assert.deepEqual(normalized.bodies[0].centerM, [2.5, 0.5, 0]);
  assert.equal(normalized.bodies[0].temperatureK, 293.15);
  assert.deepEqual(normalized.bodies[0].particlesPerEdge, [10, 10, 10]);
  assert.ok(Object.isFrozen(normalized));
  assert.ok(Object.isFrozen(normalized.bodies));
  assert.ok(Object.isFrozen(normalized.bodies[0]));
  assert.ok(Object.isFrozen(normalized.bodies[0].sizeM));
  assert.equal(source[0].domainId, '1', 'normalization must not mutate input');
});

test('normalization rejects duplicate identities and malformed physical values', () => {
  assert.throws(
    () => normalizeSphInitialBodies([body(), body({ domainId: 2 })]),
    (error) => error instanceof SphInitialBodiesValidationError
      && error.code === 'duplicate-body-id'
  );
  assert.throws(
    () => normalizeSphInitialBodies([body(), body({ id: 'other' })]),
    (error) => error.code === 'duplicate-domain-id'
  );

  const invalidCases = [
    [body({ id: 'not valid' }), 'invalid-body-id'],
    [body({ domainId: 0 }), 'invalid-positive-integer'],
    [body({ domainId: 0x0100_0000 }), 'domain-id-out-of-range'],
    [body({ material: '' }), 'empty-string'],
    [body({ sizeM: [1, 0, 1] }), 'nonpositive-number'],
    [body({ centerM: [0, Number.NaN, 0] }), 'nonfinite-number'],
    [body({ temperatureK: 0 }), 'nonpositive-number'],
    [body({ particlesPerEdge: [2, 2.5, 2] }), 'invalid-positive-integer'],
    [body({ velocityMPerS: [0, Infinity, 0] }), 'nonfinite-number'],
    [body({ velocityMPerS: [0, 1e308, 0] }), 'float32-out-of-range'],
    [body({ centerM: [0, 1e308, 0] }), 'float32-out-of-range'],
    [body({ temperatureK: 1e308 }), 'float32-out-of-range'],
    [body({ sizeM: [1, 1e308, 1] }), 'float32-out-of-range'],
    [body({ temperatureK: Number.MIN_VALUE }), 'positive-float32-underflow'],
    [body({ sizeM: [1, Number.MIN_VALUE, 1] }), 'positive-float32-underflow'],
    [body({ legacyRole: 'primary' }), 'invalid-legacy-role'],
    [{ ...body(), typoM: 1 }, 'unknown-field']
  ];
  for (const [candidate, code] of invalidCases) {
    assert.throws(
      () => normalizeSphInitialBodies([candidate]),
      (error) => error instanceof SphInitialBodiesValidationError
        && error.code === code,
      code
    );
  }

  assert.throws(
    () => normalizeSphInitialBodies({ schema: 'peercompute.ulg.sph-initial-bodies.v1', bodies: [] }),
    (error) => error.code === 'unsupported-schema'
  );
});

test('normalization enforces a safe aggregate live-particle budget before allocation', () => {
  assert.equal(SPH_INITIAL_BODIES_MAX_TOTAL_LIVE_PARTICLES, 262_144);
  const atCap = normalizeSphInitialBodies([
    body({ particlesPerEdge: [64, 64, 64] })
  ]);
  assert.deepEqual(atCap.bodies[0].particlesPerEdge, [64, 64, 64]);

  assert.throws(
    () => normalizeSphInitialBodies([
      body({ particlesPerEdge: [65, 64, 64] })
    ]),
    (error) => error instanceof SphInitialBodiesValidationError
      && error.code === 'initial-live-particle-cap-exceeded'
  );
  assert.throws(
    () => normalizeSphInitialBodies([
      body({ particlesPerEdge: [64, 64, 64] }),
      body({ id: 'other', domainId: 2, particlesPerEdge: [1, 1, 1] })
    ]),
    (error) => error instanceof SphInitialBodiesValidationError
      && error.code === 'initial-live-particle-cap-exceeded'
  );
  assert.throws(
    () => normalizeSphInitialBodies([
      body({ particlesPerEdge: [Number.MAX_SAFE_INTEGER, 2, 1] })
    ]),
    (error) => error instanceof SphInitialBodiesValidationError
      && error.code === 'unsafe-particle-count-product'
  );
  assert.throws(
    () => preflightSphInitialBodiesForSimulation([
      body({ particlesPerEdge: [65, 64, 64] })
    ]),
    (error) => error instanceof SphInitialBodiesValidationError
      && error.code === 'initial-live-particle-cap-exceeded'
  );
});

test('identity allocation and duplication are deterministic without mutating legacy roles', () => {
  const initialBodies = normalizeSphInitialBodies([
    body({ id: 'body-1', domainId: 2 }),
    body({ id: 'body-3', domainId: 8, legacyRole: 'drop' })
  ]);
  assert.deepEqual(
    allocateNextSphInitialBodyIdentity(initialBodies),
    { id: 'body-4', domainId: 9 }
  );
  assert.deepEqual(
    allocateNextSphInitialBodyIdentity([], { idPrefix: 'sample' }),
    { id: 'sample-1', domainId: 1 }
  );

  const duplicated = duplicateSphInitialBody(initialBodies, 'body-3');
  assert.deepEqual(
    duplicated.bodies.map((entry) => entry.id),
    ['body-1', 'body-3', 'body-3-copy-1']
  );
  assert.equal(duplicated.bodies[2].domainId, 9);
  assert.equal(duplicated.bodies[2].material, duplicated.bodies[1].material);
  assert.deepEqual(duplicated.bodies[2].sizeM, duplicated.bodies[1].sizeM);
  assert.equal(duplicated.bodies[2].legacyRole, undefined);
  assert.equal(initialBodies.bodies.length, 2);
});

test('canonical URL serialization round trips and the signature includes order', () => {
  const initialBodies = normalizeSphInitialBodies(pair());
  const serialized = serializeSphInitialBodies(initialBodies);
  assert.equal(serialized, serializeSphInitialBodies(pair()));
  assert.equal(serialized, sphInitialBodiesSignature(initialBodies));

  const params = new URLSearchParams();
  params.set('bodies', serialized);
  const parsed = parseSphInitialBodies(
    new URLSearchParams(params.toString()).get('bodies')
  );
  assert.deepEqual(parsed, initialBodies);
  assert.equal(serializeSphInitialBodies(parsed), serialized);

  const reversed = reorderSphInitialBodies(initialBodies, ['drop', 'base']);
  assert.notEqual(sphInitialBodiesSignature(reversed), sphInitialBodiesSignature(initialBodies));
  assert.deepEqual(reversed.bodies.map((entry) => entry.id), ['drop', 'base']);
  assert.deepEqual(reversed.bodies.map((entry) => entry.domainId), [2, 1]);

  const restored = moveSphInitialBody(reversed, 'base', 0);
  assert.deepEqual(restored.bodies.map((entry) => entry.id), ['base', 'drop']);
  assert.deepEqual(restored.bodies.map((entry) => entry.domainId), [1, 2]);
  assert.equal(sphInitialBodiesSignature(restored), sphInitialBodiesSignature(initialBodies));

  assert.throws(() => parseSphInitialBodies('{'), (error) => error.code === 'invalid-json');
  assert.throws(
    () => reorderSphInitialBodies(initialBodies, ['base', 'base']),
    (error) => error.code === 'duplicate-reorder-id'
  );
});

test('simulation preflight accepts isotropic rectangular sampling', () => {
  const initialBodies = [
    body({
      sizeM: [1, 2, 3],
      particlesPerEdge: [10, 20, 30]
    }),
    body({
      id: 'drop',
      domainId: 2,
      legacyRole: 'drop',
      sizeM: [0.5, 1, 1.5],
      particlesPerEdge: [5, 10, 15]
    })
  ];
  const result = preflightSphInitialBodiesForSimulation(initialBodies);

  assert.equal(result.schema, SPH_INITIAL_BODIES_SIMULATION_PREFLIGHT_SCHEMA);
  assert.equal(result.status, 'simulation-preflight-ready');
  assert.equal(result.feasible, true);
  assert.equal(result.totalLiveParticleCount, 6_750);
  assert.equal(
    result.limits.maxTotalLiveParticles,
    SPH_INITIAL_BODIES_MAX_TOTAL_LIVE_PARTICLES
  );
  assert.deepEqual(result.blockers, []);
  assert.equal(
    result.limits.maxCellPitchAnisotropyRatio,
    DEFAULT_SPH_INITIAL_BODY_MAX_CELL_PITCH_ANISOTROPY_RATIO
  );
  assert.equal(
    result.limits.maxCrossBodyCellPitchRatio,
    DEFAULT_SPH_INITIAL_BODIES_MAX_CROSS_BODY_CELL_PITCH_RATIO
  );
  assert.deepEqual(result.bodyPitches[0].cellPitchM, [0.1, 0.1, 0.1]);
  assert.equal(result.bodyPitches[0].approximatelyIsotropic, true);
  assert.ok(Math.abs(result.crossBodyPitch.ratio - 1) < 1e-12);
});

test('simulation preflight blocks anisotropic and incompatible cross-body pitches', () => {
  const result = preflightSphInitialBodiesForSimulation([
    body({
      sizeM: [1, 2, 3],
      particlesPerEdge: [10, 10, 10]
    }),
    body({
      id: 'drop',
      domainId: 2,
      legacyRole: 'drop',
      sizeM: [3, 3, 3],
      particlesPerEdge: [10, 10, 10]
    })
  ], {
    maxCellPitchAnisotropyRatio: 1.1,
    maxCrossBodyCellPitchRatio: 1.5
  });

  assert.equal(result.status, 'simulation-preflight-blocked');
  assert.equal(result.feasible, false);
  assert.ok(result.blockers.includes('body-cell-pitch-anisotropy:base'));
  assert.ok(result.blockers.includes('cross-body-cell-pitch-ratio-exceeded'));
  assert.ok(Math.abs(result.bodyPitches[0].anisotropyRatio - 3) < 1e-12);
  assert.ok(result.crossBodyPitch.ratio > 1.5);

  const empty = preflightSphInitialBodiesForSimulation([]);
  assert.equal(empty.feasible, false);
  assert.deepEqual(empty.blockers, ['initial-bodies-empty']);
  assert.throws(
    () => preflightSphInitialBodiesForSimulation(pair(), {
      maxCrossBodyCellPitchRatio: 0.5
    }),
    (error) => error.code === 'invalid-preflight-limit'
  );
});

test('legacy adapter exactly preserves resolved base/drop semantics', () => {
  const adapted = sphInitialBodiesFromLegacyDropBase({
    baseMaterial: 'h2o',
    dropMaterial: 'fe',
    baseSizeM: 1,
    dropSizeM: [0.5, 0.75, 0.5],
    baseCenterM: [2.5, 0.5, 2.5],
    dropCenterM: [2.5, 2.875, 2.5],
    baseTemperatureK: 233.15,
    dropTemperatureK: 1850,
    baseParticlesPerEdge: 5,
    dropParticlesPerEdge: [3, 4, 3],
    dropVelocityMPerS: [0, -1, 0]
  });

  assert.deepEqual(adapted.bodies.map((entry) => entry.id), ['base', 'drop']);
  assert.deepEqual(adapted.bodies.map((entry) => entry.domainId), [1, 2]);
  assert.deepEqual(adapted.bodies.map((entry) => entry.legacyRole), ['base', 'drop']);
  assert.deepEqual(adapted.bodies[0].sizeM, [1, 1, 1]);
  assert.deepEqual(adapted.bodies[0].particlesPerEdge, [5, 5, 5]);
  assert.deepEqual(adapted.bodies[1].sizeM, [0.5, 0.75, 0.5]);
  assert.deepEqual(adapted.bodies[1].particlesPerEdge, [3, 4, 3]);
  assert.deepEqual(adapted.bodies[1].centerM, [2.5, 2.875, 2.5]);
  assert.deepEqual(adapted.bodies[1].velocityMPerS, [0, -1, 0]);

  const legacy = sphInitialBodiesToLegacyDropBase(adapted);
  assert.equal(legacy.base.id, 'base');
  assert.equal(legacy.drop.id, 'drop');
  assert.deepEqual(legacy.base.centerM, [2.5, 0.5, 2.5]);
  assert.deepEqual(legacy.drop.centerM, [2.5, 2.875, 2.5]);

  const duplicateLegacyRole = normalizeSphInitialBodies([
    ...adapted.bodies,
    body({ id: 'base-two', domainId: 3 })
  ]);
  assert.throws(
    () => sphInitialBodiesToLegacyDropBase(duplicateLegacyRole),
    (error) => error.code === 'duplicate-legacy-role'
  );
});

test('legacy phase controls resolve the exact scaled mounted body geometry', () => {
  const resolved = sphInitialBodiesFromLegacyPhaseControls({
    baseMaterial: 'h2o',
    dropMaterial: 'fe',
    baseTemperatureK: 233.15,
    dropTemperatureK: 1850,
    baseParticlesPerEdge: 5,
    dropParticlesPerEdge: 3,
    referenceBaseEdgeM: 1,
    referenceBaseParticlesPerEdge: 5,
    sceneLengthScale: 0.028,
    referenceBoxDimensionsM: [5, 5, 5],
    referenceBaseBottomM: 0,
    referenceDropBottomM: 1
  });

  assert.deepEqual(
    resolved.bodies.map((entry) => entry.legacyRole),
    ['base', 'drop']
  );
  assert.deepEqual(resolved.bodies[0].sizeM, [0.028, 0.028, 0.028]);
  assert.deepEqual(resolved.bodies[0].centerM, [0.07, 0.014, 0.07]);
  assert.deepEqual(resolved.bodies[0].particlesPerEdge, [5, 5, 5]);
  assert.deepEqual(resolved.bodies[1].sizeM, [0.0168, 0.0168, 0.0168]);
  assert.deepEqual(resolved.bodies[1].centerM, [0.07, 0.0364, 0.07]);
  assert.deepEqual(resolved.bodies[1].particlesPerEdge, [3, 3, 3]);
});
