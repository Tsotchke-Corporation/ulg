import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildAlgorithmInitialBodyContactRows,
  buildAlgorithmInitialBodyParticleInitializationRows,
  buildAlgorithmMaterialContactRows,
  buildAlgorithmMaterialParticleInitializationRows,
  buildAlgorithmMlsMpmMechanicsRows,
  buildAlgorithmSurfaceExtractionRows
} from '../src/runtime/material/algorithmMaterialRows.js';
import {
  MATERIAL_PROPERTY_BANK_WARM_INPUT_SCHEMA,
  buildMaterialPropertyBankGpuWarmInputTable,
  buildMaterialPropertyBankInitialBodyGpuWarmInputTable,
  buildMaterialPropertyBankInitialBodyParticleSizePackingTable,
  buildMaterialPropertyBankParticleSizePackingTable
} from '../src/runtime/material/materialPropertyBank.js';
import { buildMlsMpmGpuParticleBuffers } from '../src/runtime/sph/sphGpuBuffers.js';
import { buildSphPhaseDemoState } from '../src/runtime/sphPhaseDemo.js';

const BODIES = {
  schema: 'peercompute.ulg.sph-initial-bodies.v0',
  bodies: [
    {
      id: 'iron-left',
      domainId: 11,
      material: 'Fe',
      temperatureK: 900,
      particlesPerEdge: [2, 3, 4]
    },
    {
      id: 'sodium-center',
      domainId: 22,
      material: 'Na',
      temperatureK: 300,
      particlesPerEdge: [2, 2, 2]
    },
    {
      id: 'iron-right',
      domainId: 37,
      material: 'Fe',
      temperatureK: 500,
      particlesPerEdge: [1, 2, 4]
    }
  ]
};

function warmInput(material, atomicNumber, temperatureK) {
  return {
    schema: MATERIAL_PROPERTY_BANK_WARM_INPUT_SCHEMA,
    status: 'material-property-bank-warm-input-ready',
    material,
    requestedMaterial: material,
    atomicNumber,
    temperatureK,
    pressurePa: 101325,
    targetNeighborCount: 64,
    phaseCount: 3,
    spacingPolicy: 'derive-from-rest-density-and-phase',
    pbr: {
      baseColorSrgb: [0.25, 0.5, 0.75],
      metalness: 1,
      roughness: 0.3,
      ior: null
    },
    strictSourceOfTruth: false,
    provenance: { generatorFingerprint: 'body-row-test' }
  };
}

function plan(body, index) {
  const spacingM = 0.1 + index * 0.01;
  const particleCount = body.particlesPerEdge.reduce((product, value) => product * value, 1);
  return {
    bodyId: body.id,
    domainId: body.domainId,
    role: `body:${body.id}`,
    material: body.material,
    temperatureK: body.temperatureK,
    pressurePa: 101325,
    phase: index === 1 ? 'liquid' : 'solid',
    densityKgPerM3: 7000 - index * 1000,
    particlesPerEdge: [...body.particlesPerEdge],
    particleCount,
    spacingByAxisM: [spacingM, spacingM, spacingM],
    representativeCellPitchM: spacingM,
    continuumCellVolumeM3: spacingM ** 3,
    restVolumeM3: (4 / 3) * Math.PI * (spacingM / 2) ** 3,
    volumeEquivalentParticleRadiusM: spacingM / 2,
    targetSmoothingLengthM: 0.25,
    targetNeighborCount: 64
  };
}

function spacingFixture() {
  const bodies = BODIES.bodies.map(plan);
  return {
    schema: 'peercompute.ulg.sph-initial-bodies-particle-plan.v0',
    smoothingLengthM: 0.25,
    targetNeighborCount: 64,
    bodies,
    byBodyId: Object.fromEntries(bodies.map((entry) => [entry.bodyId, entry])),
    materialPropertyBankWarmInputs: {
      generatorFingerprint: 'body-row-test',
      byBodyId: {
        'iron-left': warmInput('Fe', 26, 900),
        'sodium-center': warmInput('Na', 11, 300),
        'iron-right': warmInput('Fe', 26, 500)
      }
    },
    materialPropertyCrystalStructureWarmInputs: {
      generatorFingerprint: 'crystal-body-row-test',
      byBodyId: {
        'sodium-center': {
          status: 'material-crystal-structure-warm-input-ready',
          structureKey: 'na-bcc-alpha',
          unitCell: {
            packingFraction: 0.68,
            coordinationNumber: 8,
            atomsPerConventionalCell: 2
          }
        }
      }
    }
  };
}

test('initial-body algorithm rows preserve ordered stable identity and rectangular sampling', () => {
  const spacing = spacingFixture();
  const result = buildAlgorithmInitialBodyParticleInitializationRows({
    initialBodies: BODIES,
    initialParticleSpacing: spacing
  });

  assert.equal(result.identityMode, 'initial-bodies');
  assert.equal(result.rowCount, 3);
  assert.deepEqual(result.rows.map((row) => row.bodyId), [
    'iron-left',
    'sodium-center',
    'iron-right'
  ]);
  assert.deepEqual(result.rows.map((row) => row.domainId), [11, 22, 37]);
  assert.deepEqual(result.rows.map((row) => row.role), [
    'iron-left',
    'sodium-center',
    'iron-right'
  ]);
  assert.deepEqual(result.rows[0].particlesPerAxis, [2, 3, 4]);
  assert.deepEqual(result.rows[0].spacingByAxisM, [0.1, 0.1, 0.1]);
  assert.equal(result.rows[0].particleCount, 24);
  assert.equal(result.rows[1].materialId, 11);
  assert.equal(result.rows[1].crystalStructureKey, 'na-bcc-alpha');
  assert.deepEqual(
    result.cacheKeyParts.bodies.map(({ bodyId, domainId }) => ({ bodyId, domainId })),
    [
      { bodyId: 'iron-left', domainId: 11 },
      { bodyId: 'sodium-center', domainId: 22 },
      { bodyId: 'iron-right', domainId: 37 }
    ]
  );
});

test('mechanics and contact rows use all unordered body pairs including same-material bodies', () => {
  const spacing = spacingFixture();
  const initializationRows = buildAlgorithmInitialBodyParticleInitializationRows({
    initialBodies: BODIES,
    initialParticleSpacing: spacing
  });
  const particles = BODIES.bodies.map((body) => ({
    initialBodyId: body.id,
    initialBodyDomainId: body.domainId,
    renderDomainId: body.domainId,
    role: `body:${body.id}`,
    material: body.material
  }));
  const metadata = [
    { material: 'Fe', phase: 'solid', solid: true },
    { material: 'Na', phase: 'liquid', solid: false },
    { material: 'Fe', phase: 'solid', solid: true }
  ];
  const mechanics = new Float32Array(particles.length * 32);
  for (let index = 0; index < particles.length; index += 1) {
    const offset = index * 32;
    mechanics[offset + 19] = 0.001 + index * 0.0001;
    mechanics[offset + 20] = metadata[index].solid ? 1 : 0;
    mechanics[offset + 22] = 1e9 + index * 1e8;
    mechanics[offset + 23] = 2e8 + index * 1e7;
    mechanics[offset + 25] = 1000 + index * 100;
    mechanics[offset + 29] = 0.1 + index * 0.1;
    mechanics[offset + 30] = 0.05 + index * 0.01;
  }

  const mechanicsRows = buildAlgorithmMlsMpmMechanicsRows({
    particles,
    metadata,
    mechanics,
    particleInitializationRows: initializationRows
  });
  assert.equal(mechanicsRows.identityMode, 'initial-bodies');
  assert.deepEqual(mechanicsRows.rows.map((row) => row.bodyId), [
    'iron-left',
    'sodium-center',
    'iron-right'
  ]);
  assert.deepEqual(mechanicsRows.rows.map((row) => row.role), [
    'iron-left',
    'sodium-center',
    'iron-right'
  ]);

  const direct = buildAlgorithmInitialBodyContactRows({
    mlsMpmMechanicsRows: mechanicsRows
  });
  const dispatched = buildAlgorithmMaterialContactRows({
    mlsMpmMechanicsRows: mechanicsRows
  });
  assert.deepEqual(dispatched, direct);
  assert.equal(direct.bodyCount, 3);
  assert.equal(direct.bodyPairCount, 3);
  assert.equal(direct.rowCount, 3);
  assert.deepEqual(direct.rows.map((row) => row.bodyIds), [
    ['iron-left', 'sodium-center'],
    ['iron-left', 'iron-right'],
    ['sodium-center', 'iron-right']
  ]);
  assert.ok(direct.rows.some((row) => (
    row.bodyIds[0] === 'iron-left'
    && row.bodyIds[1] === 'iron-right'
    && row.materials[0] === 'Fe'
    && row.materials[1] === 'Fe'
  )));
  assert.ok(direct.rows.every((row) => row.normalStiffnessPa > 0));

  const surfaces = buildAlgorithmSurfaceExtractionRows({
    particleInitializationRows: initializationRows,
    mlsMpmMechanicsRows: mechanicsRows,
    contactRows: direct
  });
  assert.deepEqual(surfaces.rows.map((row) => row.bodyId), [
    'iron-left',
    'sodium-center',
    'iron-right'
  ]);
  assert.deepEqual(surfaces.rows.map((row) => row.domainId), [11, 22, 37]);
});

test('initial-body material-bank packing keeps body order and uses domain identity without changing the ABI', () => {
  const spacing = spacingFixture();
  const warmTable = buildMaterialPropertyBankInitialBodyGpuWarmInputTable({
    initialBodies: BODIES,
    initialParticleSpacing: spacing
  });
  assert.equal(warmTable.identityMode, 'initial-bodies');
  assert.equal(warmTable.rowCount, 3);
  assert.deepEqual(warmTable.metadata.map((row) => row.bodyId), [
    'iron-left',
    'sodium-center',
    'iron-right'
  ]);
  assert.deepEqual([warmTable.rows[0], warmTable.rows[16], warmTable.rows[32]], [26, 11, 26]);
  assert.deepEqual(warmTable.metadata.map((row) => row.temperatureK), [900, 300, 500]);

  const particleTable = buildMaterialPropertyBankInitialBodyParticleSizePackingTable({
    initialBodies: BODIES,
    initialParticleSpacing: spacing
  });
  assert.equal(particleTable.identityMode, 'initial-bodies');
  assert.equal(particleTable.rowCount, 3);
  assert.deepEqual([
    particleTable.rows[0],
    particleTable.rows[16],
    particleTable.rows[32]
  ], [11, 22, 37]);
  assert.deepEqual(particleTable.metadata[0].particlesPerEdge, [2, 3, 4]);
  assert.ok(Math.abs(particleTable.rows[4] - Math.cbrt(24)) < 1e-6);
  assert.deepEqual(particleTable.metadata.map((row) => row.bodyId), [
    'iron-left',
    'sodium-center',
    'iron-right'
  ]);
  assert.equal(particleTable.metadata[1].crystalStructureKey, 'na-bcc-alpha');
  assert.equal(particleTable.metadata[1].identityAuthority, 'initial-body-domain-id');

  const dispatchWarmInputs = {
    ...spacing.materialPropertyBankWarmInputs,
    identityMode: 'initial-bodies',
    bodies: BODIES.bodies.map((body) => ({
      ...body,
      warmInput: spacing.materialPropertyBankWarmInputs.byBodyId[body.id]
    }))
  };
  assert.deepEqual(
    buildMaterialPropertyBankGpuWarmInputTable(dispatchWarmInputs),
    buildMaterialPropertyBankInitialBodyGpuWarmInputTable({
      initialBodies: dispatchWarmInputs.bodies,
      materialPropertyBankWarmInputs: dispatchWarmInputs
    })
  );
  assert.deepEqual(
    buildMaterialPropertyBankParticleSizePackingTable(spacing),
    particleTable
  );
});

test('legacy drop/base algorithm builders do not acquire initial-body fields', () => {
  const initialParticleSpacing = {
    schema: 'legacy-spacing-test',
    targetNeighborCount: 64,
    drop: {
      particlesPerEdge: 2,
      spacingM: 0.1,
      restVolumeM3: 0.001,
      continuumCellVolumeM3: 0.001,
      volumeEquivalentParticleRadiusM: 0.05,
      targetSmoothingLengthM: 0.2
    },
    base: {
      particlesPerEdge: 3,
      spacingM: 0.2,
      restVolumeM3: 0.008,
      continuumCellVolumeM3: 0.008,
      volumeEquivalentParticleRadiusM: 0.1,
      targetSmoothingLengthM: 0.4
    }
  };
  const rows = buildAlgorithmMaterialParticleInitializationRows({
    initialParticleSpacing,
    dropMaterial: 'Fe',
    baseMaterial: 'h2o',
    dropTemperatureK: 1800,
    baseTemperatureK: 260
  });
  assert.deepEqual(rows.rows.map((row) => row.role), ['drop', 'base']);
  assert.equal(Object.hasOwn(rows, 'identityMode'), false);
  assert.ok(rows.rows.every((row) => !Object.hasOwn(row, 'bodyId')));
  assert.ok(rows.rows.every((row) => !Object.hasOwn(row, 'domainId')));
  assert.equal(Object.hasOwn(rows.cacheKeyParts, 'bodies'), false);
});

test('the initialBodies demo path feeds body mechanics, contact, and surface rows without a GPU-buffer call-site fork', () => {
  const demo = buildSphPhaseDemoState({
    initialBodies: {
      schema: 'peercompute.ulg.sph-initial-bodies.v0',
      bodies: [
        {
          id: 'iron-left',
          domainId: 11,
          material: 'fe',
          sizeM: [1, 1.5, 2],
          centerM: [2, 2, 2],
          temperatureK: 900,
          particlesPerEdge: [2, 3, 4],
          velocityMPerS: [0, 0, 0]
        },
        {
          id: 'sodium-center',
          domainId: 22,
          material: 'na',
          sizeM: [1, 1, 1],
          centerM: [5, 2, 2],
          temperatureK: 300,
          particlesPerEdge: [2, 2, 2],
          velocityMPerS: [0, 0, 0]
        },
        {
          id: 'iron-right',
          domainId: 37,
          material: 'fe',
          sizeM: [0.5, 1, 2],
          centerM: [7, 2, 2],
          temperatureK: 500,
          particlesPerEdge: [1, 2, 4],
          velocityMPerS: [0, 0, 0]
        }
      ]
    },
    allowFixtureMaterialProperties: true,
    mechanics: 'mlsmpm'
  });
  assert.equal(
    demo.initialParticleSpacing.algorithmMaterialParticleInitializationRows.identityMode,
    'initial-bodies'
  );

  const packed = buildMlsMpmGpuParticleBuffers(demo.state, {
    materialProperties: demo.materialProperties,
    initialParticleSpacing: demo.initialParticleSpacing
  });
  assert.deepEqual(
    packed.algorithmMaterialMlsMpmMechanicsRows.rows.map((row) => row.bodyId),
    ['iron-left', 'sodium-center', 'iron-right']
  );
  assert.deepEqual(
    packed.algorithmMaterialContactRows.rows.map((row) => row.bodyIds),
    [
      ['iron-left', 'sodium-center'],
      ['iron-left', 'iron-right'],
      ['sodium-center', 'iron-right']
    ]
  );
  assert.deepEqual(
    packed.algorithmMaterialSurfaceExtractionRows.rows.map((row) => row.domainId),
    [11, 22, 37]
  );
});
