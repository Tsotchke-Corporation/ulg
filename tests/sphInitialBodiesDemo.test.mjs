import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildSphPhaseDemoState,
  createSphPhaseDemo,
  gasPressureSummary,
  surfaceEmissive,
  surfaceEmissiveTemperature
} from '../src/runtime/sphPhaseDemo.js';
import {
  SPH_INITIAL_BODIES_SCHEMA,
  SphInitialBodiesValidationError
} from '../src/runtime/sphInitialBodies.js';

function near(actual, expected, tolerance = 1e-9) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );
}

function nearRelative(actual, expected, relativeTolerance = 1e-10) {
  const scale = Math.max(1, Math.abs(actual), Math.abs(expected));
  near(actual, expected, scale * relativeTolerance);
}

function body({
  id,
  domainId,
  material,
  sizeM,
  centerM,
  temperatureK,
  particlesPerEdge,
  velocityMPerS = [0, 0, 0]
}) {
  return {
    id,
    domainId,
    material,
    sizeM,
    centerM,
    temperatureK,
    particlesPerEdge,
    velocityMPerS
  };
}

function container(bodies) {
  return { schema: SPH_INITIAL_BODIES_SCHEMA, bodies };
}

const THREE_RECTANGULAR_BODIES = container([
  body({
    id: 'water-tank',
    domainId: 11,
    material: 'h2o',
    sizeM: [2, 1, 1.5],
    centerM: [2, 1, 2],
    temperatureK: 293.15,
    particlesPerEdge: [4, 2, 3],
    velocityMPerS: [0.25, 0, -0.5]
  }),
  body({
    id: 'iron-slab',
    domainId: 22,
    material: 'fe',
    sizeM: [1, 1.5, 0.5],
    centerM: [5, 2, 2],
    temperatureK: 1000,
    particlesPerEdge: [2, 3, 1],
    velocityMPerS: [-0.5, 0.25, 0]
  }),
  body({
    id: 'ice-column',
    domainId: 37,
    material: 'h2o',
    sizeM: [0.5, 1, 2],
    centerM: [3, 6, 6],
    temperatureK: 260,
    particlesPerEdge: [1, 2, 4],
    velocityMPerS: [0, 0.1, 0.2]
  })
]);

test('initialBodies builds three independent rectangular lattices with stable identity and conserved mass', () => {
  const demo = buildSphPhaseDemoState({
    initialBodies: THREE_RECTANGULAR_BODIES,
    allowFixtureMaterialProperties: true,
    mechanics: 'sph'
  });

  assert.equal(demo.initialBodies.schema, SPH_INITIAL_BODIES_SCHEMA);
  assert.deepEqual(
    demo.initialBodies.bodies.map(({ id, domainId }) => ({ id, domainId })),
    [
      { id: 'water-tank', domainId: 11 },
      { id: 'iron-slab', domainId: 22 },
      { id: 'ice-column', domainId: 37 }
    ]
  );
  assert.deepEqual(demo.counts.byBodyId, {
    'water-tank': 24,
    'iron-slab': 6,
    'ice-column': 8
  });
  assert.equal(demo.counts.live, 38);
  assert.equal(demo.counts.spareProductSlots, 0);
  assert.equal(demo.counts.total, 38);
  assert.equal(demo.initialParticleSpacing.requestedParticleBudget, 38);
  assert.equal(demo.initialParticleEdgeDiagnostics.totalGeneratedParticleCount, 38);
  assert.deepEqual(demo.initialTemperaturesK.byBodyId, {
    'water-tank': 293.15,
    'iron-slab': 1000,
    'ice-column': 260
  });

  const expected = {
    'water-tank': {
      domainId: 11,
      count: 24,
      centerBoundsM: { min: [1.25, 0.75, 1.5], max: [2.75, 1.25, 2.5] },
      velocityMPerS: [0.25, 0, -0.5],
      temperatureK: 293.15,
      volumeM3: 3
    },
    'iron-slab': {
      domainId: 22,
      count: 6,
      centerBoundsM: { min: [4.75, 1.5, 2], max: [5.25, 2.5, 2] },
      velocityMPerS: [-0.5, 0.25, 0],
      temperatureK: 1000,
      volumeM3: 0.75
    },
    'ice-column': {
      domainId: 37,
      count: 8,
      centerBoundsM: { min: [3, 5.75, 5.25], max: [3, 6.25, 6.75] },
      velocityMPerS: [0, 0.1, 0.2],
      temperatureK: 260,
      volumeM3: 1
    }
  };

  let summedMassKg = 0;
  for (const [id, expectation] of Object.entries(expected)) {
    const particles = demo.state.particles.filter((particle) => (
      particle.initialBodyId === id
    ));
    assert.equal(particles.length, expectation.count);
    assert.ok(particles.every((particle) => particle.initialBodyDomainId === expectation.domainId));
    assert.ok(particles.every((particle) => particle.renderDomainId === expectation.domainId));
    assert.ok(particles.every((particle) => particle.temperatureK === expectation.temperatureK));
    assert.ok(particles.every((particle) => (
      particle.v.every((component, axis) => component === expectation.velocityMPerS[axis])
    )));

    for (let axis = 0; axis < 3; axis += 1) {
      near(
        Math.min(...particles.map((particle) => particle.x[axis])),
        expectation.centerBoundsM.min[axis]
      );
      near(
        Math.max(...particles.map((particle) => particle.x[axis])),
        expectation.centerBoundsM.max[axis]
      );
    }

    const plan = demo.initialParticleSpacing.byBodyId[id];
    const bodyMassKg = particles.reduce((sum, particle) => sum + particle.massKg, 0);
    const densityKgPerM3 = particles[0].restDensityKgPerM3;
    nearRelative(plan.blockVolumeM3, expectation.volumeM3);
    nearRelative(bodyMassKg, plan.totalMassKg);
    nearRelative(bodyMassKg, densityKgPerM3 * expectation.volumeM3);
    nearRelative(
      particles[0].massKg * particles.length,
      densityKgPerM3 * expectation.volumeM3
    );
    summedMassKg += bodyMassKg;
  }

  nearRelative(demo.initialParticleSpacing.totalBlockVolumeM3, 4.75);
  nearRelative(demo.initialParticleSpacing.totalMassKg, summedMassKg);
  assert.equal(demo.initialParticleSpacing.simulationPreflight.feasible, true);
  assert.deepEqual(demo.initialParticleSpacing.simulationPreflight.blockers, []);
});

test('initialBodies rejects empty, anisotropic, and incompatible cross-body sampling before allocation', () => {
  const build = (bodies) => buildSphPhaseDemoState({
    initialBodies: container(bodies),
    allowFixtureMaterialProperties: true,
    mechanics: 'sph'
  });
  const base = {
    material: 'h2o',
    centerM: [2, 2, 2],
    temperatureK: 293.15,
    velocityMPerS: [0, 0, 0]
  };

  assert.throws(
    () => build([]),
    /initial-bodies-empty|simulation preflight|preflight blocked/i
  );
  assert.throws(
    () => build([{
      ...base,
      id: 'anisotropic',
      domainId: 1,
      sizeM: [2, 1, 1],
      particlesPerEdge: [2, 2, 2]
    }]),
    /body-cell-pitch-anisotropy|simulation preflight|preflight blocked/i
  );
  assert.throws(
    () => build([
      {
        ...base,
        id: 'coarse',
        domainId: 1,
        sizeM: [1, 1, 1],
        particlesPerEdge: [2, 2, 2]
      },
      {
        ...base,
        id: 'fine',
        domainId: 2,
        centerM: [5, 5, 5],
        sizeM: [1, 1, 1],
        particlesPerEdge: [5, 5, 5]
      }
    ]),
    /cross-body-cell-pitch-ratio-exceeded|simulation preflight|preflight blocked/i
  );
  assert.throws(
    () => build([{
      ...base,
      id: 'over-budget',
      domainId: 1,
      sizeM: [1, 1, 1],
      particlesPerEdge: [65, 64, 64]
    }]),
    (error) => error instanceof SphInitialBodiesValidationError
      && error.code === 'initial-live-particle-cap-exceeded'
  );
});

test('initialBodies appends a 50^3 lattice without spread-argument overflow', () => {
  const demo = buildSphPhaseDemoState({
    initialBodies: container([
      body({
        id: 'dense-body',
        domainId: 91,
        material: 'h2o',
        sizeM: [1, 1, 1],
        centerM: [2, 2, 2],
        temperatureK: 293.15,
        particlesPerEdge: [50, 50, 50]
      })
    ]),
    allowFixtureMaterialProperties: true,
    mechanics: 'sph'
  });

  assert.equal(demo.counts.live, 125_000);
  assert.equal(demo.counts.total, 125_000);
  assert.equal(demo.state.particles.length, 125_000);
  assert.equal(demo.state.particles[0].initialBodyId, 'dense-body');
  assert.equal(demo.state.particles.at(-1).initialBodyDomainId, 91);
});

test('initialBodies pressure and derived preflight account for every body and every body pair', () => {
  const driver = createSphPhaseDemo({
    initialBodies: THREE_RECTANGULAR_BODIES,
    allowFixtureMaterialProperties: true,
    mechanics: 'sph',
    physicalLawGroups: { reactions: false }
  });
  const pressure = gasPressureSummary(driver.demo);
  const preflight = driver.preflight();

  nearRelative(pressure.boxVolumeM3, 1000);
  nearRelative(pressure.condensedVolumeM3, 4.75);
  nearRelative(pressure.gasVolumeM3, 995.25);
  nearRelative(pressure.bySpecies.air.partialPressurePa, 101325);

  assert.deepEqual(
    Object.keys(preflight.masses.byBodyId).sort(),
    ['ice-column', 'iron-slab', 'water-tank']
  );
  assert.deepEqual(
    Object.keys(preflight.feasibility.finalPhaseByBodyId).sort(),
    ['ice-column', 'iron-slab', 'water-tank']
  );
  assert.equal(preflight.initialGeometry.pairs.length, 3);
  assert.equal(
    new Set(preflight.initialGeometry.pairs.flatMap((pair) => pair.roles)).size,
    3
  );
  assert.ok(preflight.initialGeometry.pairs.every((pair) => (
    !pair.roles.includes('spare-product-slot')
  )));
});

test('initialBodies driver discovers reactions across every unique material pair', () => {
  const driver = createSphPhaseDemo({
    initialBodies: container([
      body({
        id: 'hydrogen',
        domainId: 7,
        material: 'h2',
        sizeM: [0.5, 0.5, 0.5],
        centerM: [1, 1, 1],
        temperatureK: 300,
        particlesPerEdge: [1, 1, 1]
      }),
      body({
        id: 'oxygen',
        domainId: 8,
        material: 'o2',
        sizeM: [0.5, 0.5, 0.5],
        centerM: [3, 1, 1],
        temperatureK: 300,
        particlesPerEdge: [1, 1, 1]
      }),
      body({
        id: 'water',
        domainId: 9,
        material: 'h2o',
        sizeM: [0.5, 0.5, 0.5],
        centerM: [5, 1, 1],
        temperatureK: 300,
        particlesPerEdge: [1, 1, 1]
      })
    ]),
    allowFixtureMaterialProperties: true,
    mechanics: 'sph'
  });

  assert.deepEqual(driver.demo.reactionDiscovery.materials, ['h2', 'h2o', 'o2']);
  assert.equal(driver.demo.reactionDiscovery.pairCount, 3);
  assert.deepEqual(
    driver.demo.reactionDiscovery.pairDiagnostics.map(({ pair }) => pair),
    [
      ['h2', 'h2o'],
      ['h2', 'o2'],
      ['h2o', 'o2']
    ]
  );
  assert.ok(driver.demo.reactions.some((reaction) => reaction.product === 'h2o'));
});

test('a headless three-body step stays finite and preserves stable body identity', () => {
  const driver = createSphPhaseDemo({
    initialBodies: THREE_RECTANGULAR_BODIES,
    allowFixtureMaterialProperties: true,
    mechanics: 'sph',
    mechanicalSubsteps: 1,
    dt: 1e-5,
    physicalLawGroups: { reactions: false }
  });
  const beforeIdentity = driver.demo.state.particles.map((particle) => [
    particle.initialBodyId,
    particle.initialBodyDomainId
  ]);

  driver.step();

  assert.deepEqual(
    driver.demo.state.particles.map((particle) => [
      particle.initialBodyId,
      particle.initialBodyDomainId
    ]),
    beforeIdentity
  );
  assert.ok(driver.demo.state.particles.every((particle) => (
    [...particle.x, ...particle.v, particle.massKg, particle.specificInternalEnergyJPerKg]
      .every(Number.isFinite)
  )));
});

test('same-material bodies keep incandescent authority scoped to the exact render domain', () => {
  const demo = buildSphPhaseDemoState({
    initialBodies: container([
      body({
        id: 'cold-iron',
        domainId: 11,
        material: 'fe',
        sizeM: [1, 1, 1],
        centerM: [2, 2, 2],
        temperatureK: 300,
        particlesPerEdge: [1, 1, 1]
      }),
      body({
        id: 'hot-iron',
        domainId: 12,
        material: 'fe',
        sizeM: [1, 1, 1],
        centerM: [4, 2, 2],
        temperatureK: 1700,
        particlesPerEdge: [1, 1, 1]
      })
    ]),
    allowFixtureMaterialProperties: true,
    mechanics: 'sph'
  });
  const emissive = surfaceEmissive(demo);
  const emissiveTemperature = surfaceEmissiveTemperature(demo);
  const coldKey = 'render-domain:11|material:fe|phase:solid';
  const hotKey = 'render-domain:12|material:fe|phase:solid';

  assert.ok(emissive.fe, 'legacy material aggregate remains available');
  assert.ok(emissive[hotKey], 'hot body has exact-domain emissive authority');
  assert.equal(emissive[coldKey], undefined, 'cold body does not inherit hot-body emissive colour');
  near(emissiveTemperature[hotKey], 1700, 1e-9);
  assert.equal(emissiveTemperature[coldKey], undefined);
});

test('generic hydrostatic initialization only marks floor-supported bodies', () => {
  const driver = createSphPhaseDemo({
    initialBodies: container([
      body({
        id: 'floor-body',
        domainId: 4,
        material: 'h2o',
        sizeM: [0.5, 0.5, 0.5],
        centerM: [1, 0.25, 1],
        temperatureK: 260,
        particlesPerEdge: [2, 2, 2]
      }),
      body({
        id: 'floating-body',
        domainId: 5,
        material: 'fe',
        sizeM: [0.5, 0.5, 0.5],
        centerM: [2, 1.25, 1],
        temperatureK: 1000,
        particlesPerEdge: [2, 2, 2]
      })
    ]),
    allowFixtureMaterialProperties: true,
    mechanics: 'mlsmpm',
    physicalLawGroups: { reactions: false }
  });

  assert.deepEqual(driver.demo.initialHydrostaticState.initializedRoles, ['body:floor-body']);
  assert.ok(driver.demo.state.particles.some((particle) => (
    particle.initialBodyId === 'floor-body' && particle.hydrostaticInitialization
  )));
  assert.ok(driver.demo.state.particles.every((particle) => (
    particle.initialBodyId !== 'floating-body' || !particle.hydrostaticInitialization
  )));
});

test('a call without initialBodies preserves the legacy two-role output shape', () => {
  const legacy = buildSphPhaseDemoState({
    allowFixtureMaterialProperties: true,
    mechanics: 'sph',
    dropParticleEdge: 1,
    baseParticleEdge: 1
  });

  assert.equal(Object.hasOwn(legacy, 'initialBodies'), false);
  assert.deepEqual(legacy.counts, {
    drop: 1,
    base: 1,
    spareProductSlots: 0,
    total: 2
  });
  assert.equal(legacy.dropMaterial, 'fe');
  assert.equal(legacy.baseMaterial, 'h2o');
  assert.deepEqual(legacy.initialTemperaturesK, {
    drop: legacy.initialTemperaturesK.drop,
    base: 233.15,
    gas: legacy.scenario.gas.initialTemperatureK
  });
  assert.deepEqual(
    legacy.state.particles.map((particle) => particle.role),
    ['base', 'drop']
  );
  assert.ok(legacy.state.particles.every((particle) => (
    !Object.hasOwn(particle, 'initialBodyId')
    && !Object.hasOwn(particle, 'initialBodyDomainId')
  )));
});

test('legacy hot drop emission mirrors its synthesized render-domain authority', () => {
  const legacy = buildSphPhaseDemoState({
    allowFixtureMaterialProperties: true,
    mechanics: 'sph',
    dropMaterial: 'fe',
    baseMaterial: 'h2o',
    dropTemperatureK: 1700,
    dropParticleEdge: 1,
    baseParticleEdge: 1
  });
  const hotDropKey = 'render-domain:2|material:fe|phase:solid';

  assert.ok(surfaceEmissive(legacy)[hotDropKey]);
  near(surfaceEmissiveTemperature(legacy)[hotDropKey], 1700, 1e-9);
});
