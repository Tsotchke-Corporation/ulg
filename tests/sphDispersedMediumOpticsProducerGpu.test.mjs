import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_STATUS,
  SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL,
  SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS,
  SPH_DISPERSED_MEDIUM_OPTICS_STATUS
} from '../ulg-gpu-abi/src/index.js';
import {
  buildSphDispersedMediumOpticalClosureTable,
  deriveSphDispersedMediumOpticalMoments
} from '../src/runtime/sph/sphDispersedMediumOpticalClosure.js';
import {
  SPH_DISPERSED_MEDIUM_OPTICS_PRODUCER_KERNEL_REVISION,
  ULG_SPH_DISPERSED_MEDIUM_OPTICS_PRODUCER_ADOPTION_CLAIM_SCHEMA,
  ULG_SPH_DISPERSED_MEDIUM_OPTICS_PRODUCER_ADOPTION_RECEIPT_SCHEMA,
  ULG_SPH_DISPERSED_MEDIUM_OPTICS_PRODUCER_ADOPTION_TRANSACTION_SCHEMA,
  ULG_SPH_DISPERSED_MEDIUM_OPTICS_PRODUCER_ENCODER_STAGE_SCHEMA,
  ULG_SPH_DISPERSED_MEDIUM_OPTICS_PRODUCER_SCHEMA,
  buildSphDispersedMediumOpticsProducerSeedRows,
  buildSphDispersedMediumOpticsProducerSeedRowsForProspectiveFourLaneMaterialization,
  buildSphDispersedMediumOpticsProducerSeedRowsFromParticleState,
  consumeSphDispersedMediumOpticsProducerAdoptionClaim,
  createSphDispersedMediumOpticsProducerWebGpuEncoderStage,
  deriveSphDispersedMediumOpticsProducerReference,
  enumerateSphDispersedMediumOpticsProducerPrewarmPipelineDescriptors,
  issueSphDispersedMediumOpticsProducerAdoptionClaim,
  rebaseSphDispersedMediumOpticsProducerAdoptionTopologyEpoch,
  runSphDispersedMediumOpticsProducerWebGpu,
  sphDispersedMediumOpticsProducerAdoptionMatches,
  sphDispersedMediumOpticsReactionCaptureWgsl,
  sphDispersedMediumOpticsProducerWgsl,
  validateSphDispersedMediumOpticsProducerSeedRows
} from '../src/runtime/sph/sphDispersedMediumOpticsProducerGpu.js';
import { tagWebGpuBufferDevice } from '../src/runtime/sph/sphGpuDeviceIdentity.js';
import {
  consumeSphDispersedMediumOpticsProducerClaimAsGpuBuffer,
  destroySphDispersedMediumGpuBuffers,
  snapshotSphDispersedMediumGpuBufferDeclaration,
  sphDispersedMediumGpuBufferParticleSourceFamilyMatches,
  validateSphDispersedMediumGpuBufferAuthority
} from '../src/runtime/sph/sphDispersedMediumGpuBuffers.js';
import {
  destroySphDispersedMediumOpticalClosureGpuTable,
  uploadSphDispersedMediumOpticalClosureGpuTable
} from '../src/runtime/sph/sphDispersedMediumOpticalClosureGpuBuffers.js';
import {
  SPH_GPU_PARTICLE_IDENTITY_UINTS,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
  advanceExactParentSphDispersedMediumOpticsTopologyEpoch,
  adoptSphGpuParticleDispersedMediumOpticsSidecar,
  destroySphGpuParticleBuffers,
  uploadSphGpuParticleBuffers
} from '../src/runtime/sph/sphGpuBuffers.js';

const STATE_FLOATS = 8;
const THERMO_FLOATS = 12;
const LIQUID_PHASE_ID = 2;
const GAS_PHASE_ID = 3;

function phasePlan(lineageCapacity) {
  return {
    schema: 'peercompute.ulg.sph-phase-carrier-plan.v2',
    status: 'phase-lane-capacity-ready',
    lineageCapacity,
    primaryCapacity: lineageCapacity,
    phaseLaneCount: 4,
    phaseLaneStride: lineageCapacity,
    companionStart: lineageCapacity,
    companionCapacity: lineageCapacity * 3,
    particleCapacity: lineageCapacity * 4,
    stableLaneAddress: 'phaseLane*phaseLaneStride+lineageIndex',
    phaseCompanionLanesRequired: true
  };
}

function closureTable() {
  return buildSphDispersedMediumOpticalClosureTable([
    {
      dispersedMaterialId: 11,
      vaporPhaseId: GAS_PHASE_ID,
      condensedPhaseId: LIQUID_PHASE_ID,
      opticalStateId: 101,
      morphologyModelId:
        SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL.monodisperseRadius,
      condensedDensityKgPerM3: 1000,
      scatteringEfficiencyQsca: 2,
      absorptionEfficiencyQabs: 0.1,
      asymmetryFactorG: 0.85,
      effectiveRadiusM: 1e-6
    },
    {
      dispersedMaterialId: 22,
      vaporPhaseId: GAS_PHASE_ID,
      condensedPhaseId: LIQUID_PHASE_ID,
      opticalStateId: 202,
      morphologyModelId:
        SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL
          .singleCompactCondensateCarrierLowerBound,
      condensedDensityKgPerM3: 7800,
      scatteringEfficiencyQsca: 1.5,
      absorptionEfficiencyQabs: 0.3,
      asymmetryFactorG: 0.2,
      effectiveRadiusM: 0
    }
  ]);
}

function setCarrier({
  state,
  thermo,
  index,
  materialId,
  phaseId,
  massKg,
  fractions
}) {
  const stateOffset = index * STATE_FLOATS;
  state.set([index, index * 0.25, -index, massKg, 0, 0, 0, 1], stateOffset);
  const thermoOffset = index * THERMO_FLOATS;
  thermo.set([
    materialId,
    phaseId,
    300,
    phaseId === GAS_PHASE_ID ? 1 : 1000,
    ...fractions,
    0.1,
    massKg > 0 ? 1 : 0,
    1,
    0.01
  ], thermoOffset);
}

function emptyPhaseRows(lineageMaterials) {
  const lineageCapacity = lineageMaterials.length;
  const particleCount = lineageCapacity * 4;
  const state = new Float32Array(particleCount * STATE_FLOATS);
  const thermo = new Float32Array(particleCount * THERMO_FLOATS);
  for (let phaseId = 1; phaseId <= 4; phaseId += 1) {
    for (let lineage = 0; lineage < lineageCapacity; lineage += 1) {
      setCarrier({
        state,
        thermo,
        index: (phaseId - 1) * lineageCapacity + lineage,
        materialId: lineageMaterials[lineage],
        phaseId,
        massKg: 0,
        fractions: [0, 0, 0, 0]
      });
    }
  }
  return { state, thermo };
}

function writeReadyOpticsRow(rows, particleIndex, route, dispersedMassKg = 0) {
  const offset = particleIndex * SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS;
  const moments = deriveSphDispersedMediumOpticalMoments({
    closureRow: route,
    dispersedMassKg
  });
  rows.set([
    moments.dispersedMaterialId,
    moments.dispersedPhaseId,
    moments.opticalStateId,
    moments.status,
    moments.dispersedMassKg,
    moments.scatteringCrossSectionM2,
    moments.absorptionCrossSectionM2,
    moments.scatteringAsymmetryCrossSectionM2
  ], offset);
}

function producerReferenceFixture() {
  const materials = [11, 11, 11, 11, 22];
  const plan = phasePlan(materials.length);
  const table = closureTable();
  const pre = emptyPhaseRows(materials);
  const post = emptyPhaseRows(materials);
  const laneIndex = (phaseId, lineage) => (
    (phaseId - 1) * plan.phaseLaneStride + lineage
  );

  // Newly condensed material: 8 kg * .25 = 2 kg, even though the raw
  // transfer proposal is clamped by the 2 kg post-transfer carrier.
  setCarrier({
    ...pre,
    index: laneIndex(GAS_PHASE_ID, 0),
    materialId: 11,
    phaseId: GAS_PHASE_ID,
    massKg: 8,
    fractions: [0, 0.25, 0.75, 0]
  });
  setCarrier({
    ...post,
    index: laneIndex(LIQUID_PHASE_ID, 0),
    materialId: 11,
    phaseId: LIQUID_PHASE_ID,
    massKg: 2,
    fractions: [0, 1, 0, 0]
  });
  setCarrier({
    ...post,
    index: laneIndex(GAS_PHASE_ID, 0),
    materialId: 11,
    phaseId: GAS_PHASE_ID,
    massKg: 6,
    fractions: [0, 0, 1, 0]
  });

  // Reverse transfer consumes one kilogram of an existing two-kilogram
  // dispersed ledger before touching pre-existing bulk condensed mass.
  setCarrier({
    ...pre,
    index: laneIndex(LIQUID_PHASE_ID, 1),
    materialId: 11,
    phaseId: GAS_PHASE_ID,
    massKg: 4,
    fractions: [0, 0.75, 0.25, 0]
  });
  setCarrier({
    ...post,
    index: laneIndex(LIQUID_PHASE_ID, 1),
    materialId: 11,
    phaseId: LIQUID_PHASE_ID,
    massKg: 3,
    fractions: [0, 1, 0, 0]
  });
  setCarrier({
    ...post,
    index: laneIndex(GAS_PHASE_ID, 1),
    materialId: 11,
    phaseId: GAS_PHASE_ID,
    massKg: 1,
    fractions: [0, 0, 1, 0]
  });

  // Ordinary bulk condensed matter has no dispersed ledger and remains clear
  // of the extensive mist moments despite having positive condensed mass.
  setCarrier({
    ...pre,
    index: laneIndex(LIQUID_PHASE_ID, 2),
    materialId: 11,
    phaseId: LIQUID_PHASE_ID,
    massKg: 10,
    fractions: [0, 1, 0, 0]
  });
  setCarrier({
    ...post,
    index: laneIndex(LIQUID_PHASE_ID, 2),
    materialId: 11,
    phaseId: LIQUID_PHASE_ID,
    massKg: 10,
    fractions: [0, 1, 0, 0]
  });

  // Pure vapor neither creates a ledger nor emits mist scattering.
  setCarrier({
    ...pre,
    index: laneIndex(GAS_PHASE_ID, 3),
    materialId: 11,
    phaseId: GAS_PHASE_ID,
    massKg: 5,
    fractions: [0, 0, 1, 0]
  });
  setCarrier({
    ...post,
    index: laneIndex(GAS_PHASE_ID, 3),
    materialId: 11,
    phaseId: GAS_PHASE_ID,
    massKg: 5,
    fractions: [0, 0, 1, 0]
  });

  // A second material uses the same route-driven algorithm but a different
  // morphology closure.
  setCarrier({
    ...pre,
    index: laneIndex(GAS_PHASE_ID, 4),
    materialId: 22,
    phaseId: LIQUID_PHASE_ID,
    massKg: 2,
    fractions: [0, 0.5, 0.5, 0]
  });
  setCarrier({
    ...post,
    index: laneIndex(LIQUID_PHASE_ID, 4),
    materialId: 22,
    phaseId: LIQUID_PHASE_ID,
    massKg: 1,
    fractions: [0, 1, 0, 0]
  });
  setCarrier({
    ...post,
    index: laneIndex(GAS_PHASE_ID, 4),
    materialId: 22,
    phaseId: GAS_PHASE_ID,
    massKg: 1,
    fractions: [0, 0, 1, 0]
  });

  const priorOpticsRows = new Float32Array(
    plan.particleCapacity * SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS
  );
  for (let particleIndex = 0;
    particleIndex < plan.particleCapacity;
    particleIndex += 1) {
    priorOpticsRows[
      particleIndex * SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS + 3
    ] = SPH_DISPERSED_MEDIUM_OPTICS_STATUS.blocked;
  }
  const routes = new Map(table.metadata.map((entry) => [
    entry.dispersedMaterialId,
    {
      ...entry,
      ...Object.fromEntries(
        Object.entries({
          condensedDensityKgPerM3: table.rows[entry.rowIndex * 12 + 6],
          scatteringEfficiencyQsca: table.rows[entry.rowIndex * 12 + 7],
          absorptionEfficiencyQabs: table.rows[entry.rowIndex * 12 + 8],
          asymmetryFactorG: table.rows[entry.rowIndex * 12 + 9],
          effectiveRadiusM: table.rows[entry.rowIndex * 12 + 10]
        })
      )
    }
  ]));
  for (let lineage = 0; lineage < materials.length; lineage += 1) {
    writeReadyOpticsRow(
      priorOpticsRows,
      laneIndex(LIQUID_PHASE_ID, lineage),
      routes.get(materials[lineage]),
      lineage === 1 ? 2 : 0
    );
  }
  return {
    plan,
    table,
    pre,
    post,
    priorOpticsRows,
    laneIndex
  };
}

test('CPU producer conserves condensation and evaporation without fogging bulk liquid or pure vapor', () => {
  const fixture = producerReferenceFixture();
  const result = deriveSphDispersedMediumOpticsProducerReference({
    phaseCarrierPlan: fixture.plan,
    preTransferState: fixture.pre.state,
    preTransferThermo: fixture.pre.thermo,
    postTransferState: fixture.post.state,
    postTransferThermo: fixture.post.thermo,
    priorOpticsRows: fixture.priorOpticsRows,
    opticalClosureTable: fixture.table
  });
  const outputRow = (lineage) => {
    const offset = fixture.laneIndex(LIQUID_PHASE_ID, lineage)
      * SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS;
    return Array.from(result.rows.slice(offset, offset + 8));
  };

  assert.equal(result.schema, ULG_SPH_DISPERSED_MEDIUM_OPTICS_PRODUCER_SCHEMA);
  assert.equal(result.status, 'dispersed-medium-optics-producer-reference-ready');
  assert.equal(result.gasToCondensedMassKg, 3);
  assert.equal(result.condensedToGasMassKg, 1);
  assert.equal(result.totalDispersedMassKg, 4);
  assert.equal(result.condensationRowCount, 2);
  assert.equal(result.evaporationRowCount, 1);
  assert.equal(result.invalidInputRowCount, 0);
  assert.equal(outputRow(0)[4], 2, 'actual condensation is ledgered');
  assert.equal(outputRow(1)[4], 1, 'reverse transfer consumes the ledger first');
  assert.deepEqual(outputRow(2).slice(4), [0, 0, 0, 0], 'bulk liquid stays non-dispersed');
  assert.deepEqual(outputRow(3).slice(4), [0, 0, 0, 0], 'pure vapor has zero mist moments');
  assert.equal(outputRow(4)[4], 1, 'the second material follows the same pipeline');
  assert.ok(outputRow(0)[5] > 0);
  assert.ok(outputRow(4)[5] > 0);
  assert.notEqual(outputRow(0)[5], outputRow(4)[5]);
  assert.equal(result.saturationMassInference, false);
  assert.match(result.evaporationOrdering, /consumed-before-pre-existing-bulk/);

  for (let particleIndex = 0;
    particleIndex < fixture.plan.particleCapacity;
    particleIndex += 1) {
    const offset = particleIndex * SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS;
    assert.deepEqual(
      Array.from(result.rows.slice(offset, offset + 4)),
      Array.from(fixture.priorOpticsRows.slice(offset, offset + 4)),
      `row ${particleIndex} declaration prefix changed`
    );
  }
});

test('CPU producer remaps a reaction-born condensate onto its own optical route before phase transfer', () => {
  const plan = phasePlan(1);
  const table = closureTable();
  const preReaction = emptyPhaseRows([11]);
  const postReaction = emptyPhaseRows([11]);
  const postTransfer = emptyPhaseRows([11]);
  const laneIndex = (phaseId) => (phaseId - 1) * plan.phaseLaneStride;
  const productPlacementLane = laneIndex(4);
  setCarrier({
    ...postReaction,
    index: productPlacementLane,
    materialId: 22,
    phaseId: LIQUID_PHASE_ID,
    massKg: 1.25,
    fractions: [0, 1, 0, 0]
  });
  setCarrier({
    ...postTransfer,
    index: laneIndex(LIQUID_PHASE_ID),
    materialId: 22,
    phaseId: LIQUID_PHASE_ID,
    massKg: 1.25,
    fractions: [0, 1, 0, 0]
  });
  const seed = buildSphDispersedMediumOpticsProducerSeedRows({
    phaseCarrierPlan: plan,
    lineageMaterialIds: new Float32Array([11]),
    opticalClosureTable: table
  });

  const result = deriveSphDispersedMediumOpticsProducerReference({
    phaseCarrierPlan: plan,
    preReactionState: preReaction.state,
    preReactionThermo: preReaction.thermo,
    preTransferState: postReaction.state,
    preTransferThermo: postReaction.thermo,
    postTransferState: postTransfer.state,
    postTransferThermo: postTransfer.thermo,
    seedOpticsRows: seed.rows,
    opticalClosureTable: table
  });
  const offset = laneIndex(LIQUID_PHASE_ID)
    * SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS;

  assert.deepEqual(Array.from(result.rows.slice(offset, offset + 5)), [
    22,
    LIQUID_PHASE_ID,
    202,
    SPH_DISPERSED_MEDIUM_OPTICS_STATUS.ready,
    1.25
  ]);
  assert.ok(result.rows[offset + 5] > 0);
  assert.equal(result.reactionCaptureEnabled, true);
  assert.equal(result.reactionBornMassKg, 1.25);
  assert.equal(result.reactionBornRowCount, 1);
  assert.equal(result.routeRemapRowCount, 1);
  assert.equal(result.ambiguousRouteRowCount, 0);
  assert.equal(result.totalDispersedMassKg, 1.25);
  assert.deepEqual(result.readyOpticalStateIds, [202]);
});

test('CPU reaction capture leaves a route-less gas product optically thin', () => {
  const plan = phasePlan(1);
  const table = closureTable();
  const preReaction = emptyPhaseRows([11]);
  const postReaction = emptyPhaseRows([11]);
  const postTransfer = emptyPhaseRows([11]);
  const gasIndex = (GAS_PHASE_ID - 1) * plan.phaseLaneStride;
  setCarrier({
    ...postReaction,
    index: gasIndex,
    materialId: 33,
    phaseId: GAS_PHASE_ID,
    massKg: 0.5,
    fractions: [0, 0, 1, 0]
  });
  setCarrier({
    ...postTransfer,
    index: gasIndex,
    materialId: 33,
    phaseId: GAS_PHASE_ID,
    massKg: 0.5,
    fractions: [0, 0, 1, 0]
  });
  const blockedSeed = buildSphDispersedMediumOpticsProducerSeedRows({
    phaseCarrierPlan: plan,
    lineageMaterialIds: new Float32Array([33]),
    opticalClosureTable: table
  });
  const result = deriveSphDispersedMediumOpticsProducerReference({
    phaseCarrierPlan: plan,
    preReactionState: preReaction.state,
    preReactionThermo: preReaction.thermo,
    preTransferState: postReaction.state,
    preTransferThermo: postReaction.thermo,
    postTransferState: postTransfer.state,
    postTransferThermo: postTransfer.thermo,
    seedOpticsRows: blockedSeed.rows,
    opticalClosureTable: table
  });

  assert.equal(result.readyRowCount, 0);
  assert.equal(result.blockedRowCount, plan.particleCapacity);
  assert.equal(result.reactionBornMassKg, 0);
  assert.equal(result.totalDispersedMassKg, 0);
  assert.deepEqual(result.readyOpticalStateIds, []);
  for (let index = 0; index < plan.particleCapacity; index += 1) {
    const offset = index * SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS;
    assert.equal(
      result.rows[offset + 3],
      SPH_DISPERSED_MEDIUM_OPTICS_STATUS.blocked
    );
    assert.deepEqual(Array.from(result.rows.slice(offset + 4, offset + 8)), [
      0, 0, 0, 0
    ]);
  }
});

test('seed validation rejects non-condensed routes and malformed immutable declarations', () => {
  const fixture = producerReferenceFixture();
  const summary = validateSphDispersedMediumOpticsProducerSeedRows({
    rows: fixture.priorOpticsRows,
    particleCount: fixture.plan.particleCapacity,
    phaseCarrierPlan: fixture.plan,
    opticalClosureTable: fixture.table
  });
  assert.equal(summary.readyRowCount, 5);
  assert.equal(summary.blockedRowCount, 15);
  assert.deepEqual(summary.readyOpticalStateIds, [101, 202]);

  const wrongLane = fixture.priorOpticsRows.slice();
  const sourceOffset = fixture.laneIndex(LIQUID_PHASE_ID, 0)
    * SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS;
  const gasOffset = fixture.laneIndex(GAS_PHASE_ID, 0)
    * SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS;
  wrongLane.fill(0, sourceOffset, sourceOffset + 8);
  wrongLane[sourceOffset + 3] = SPH_DISPERSED_MEDIUM_OPTICS_STATUS.blocked;
  wrongLane.set(fixture.priorOpticsRows.slice(sourceOffset, sourceOffset + 8), gasOffset);
  assert.throws(
    () => validateSphDispersedMediumOpticsProducerSeedRows({
      rows: wrongLane,
      particleCount: fixture.plan.particleCapacity,
      phaseCarrierPlan: fixture.plan,
      opticalClosureTable: fixture.table
    }),
    /not on its condensed carrier lane/
  );

  const changedIdentity = fixture.priorOpticsRows.slice();
  changedIdentity[sourceOffset + 2] = 999;
  assert.throws(
    () => validateSphDispersedMediumOpticsProducerSeedRows({
      rows: changedIdentity,
      particleCount: fixture.plan.particleCapacity,
      phaseCarrierPlan: fixture.plan,
      opticalClosureTable: fixture.table
    }),
    /no exact ready closure route/
  );
});

test('material-general seed builder places each static route on its condensed lane and rejects collisions', () => {
  const plan = phasePlan(2);
  const table = closureTable();
  const packed = buildSphDispersedMediumOpticsProducerSeedRows({
    phaseCarrierPlan: plan,
    lineageMaterialIds: new Float32Array([11, 22]),
    opticalClosureTable: table
  });
  assert.equal(packed.schema, 'peercompute.ulg.sph-dispersed-medium-optics.v0');
  assert.equal(packed.readyRowCount, 2);
  assert.equal(packed.blockedRowCount, 6);
  assert.deepEqual(packed.readyOpticalStateIds, [101, 202]);
  assert.deepEqual(
    Array.from(packed.rows.slice(
      (plan.phaseLaneStride + 0) * SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS,
      (plan.phaseLaneStride + 0) * SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS + 8
    )),
    [11, 2, 101, 1, 0, 0, 0, 0]
  );
  assert.deepEqual(
    Array.from(packed.rows.slice(
      (plan.phaseLaneStride + 1) * SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS,
      (plan.phaseLaneStride + 1) * SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS + 8
    )),
    [22, 2, 202, 1, 0, 0, 0, 0]
  );
  assert.equal(
    packed.routeDeclarations.every((entry) => (
      entry.particleIndex >= plan.phaseLaneStride
      && entry.particleIndex < plan.phaseLaneStride * 2
    )),
    true
  );

  const collidingTable = buildSphDispersedMediumOpticalClosureTable([
    {
      dispersedMaterialId: 11,
      vaporPhaseId: 1,
      condensedPhaseId: 2,
      opticalStateId: 301,
      morphologyModelId:
        SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL.monodisperseRadius,
      condensedDensityKgPerM3: 1000,
      scatteringEfficiencyQsca: 1,
      absorptionEfficiencyQabs: 0,
      asymmetryFactorG: 0,
      effectiveRadiusM: 1e-6
    },
    {
      dispersedMaterialId: 11,
      vaporPhaseId: 3,
      condensedPhaseId: 2,
      opticalStateId: 302,
      morphologyModelId:
        SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL.monodisperseRadius,
      condensedDensityKgPerM3: 1000,
      scatteringEfficiencyQsca: 1,
      absorptionEfficiencyQabs: 0,
      asymmetryFactorG: 0,
      effectiveRadiusM: 1e-6
    }
  ]);
  assert.throws(
    () => buildSphDispersedMediumOpticsProducerSeedRows({
      phaseCarrierPlan: phasePlan(1),
      lineageMaterialIds: new Float32Array([11]),
      opticalClosureTable: collidingTable
    }),
    /colliding ready optical routes/
  );
});

test('packed particle seed builder copies only canonical primary material identities', () => {
  const plan = phasePlan(2);
  const packedThermo = emptyPhaseRows([11, 22]).thermo;
  const seed = buildSphDispersedMediumOpticsProducerSeedRowsFromParticleState({
    sphParticleState: {
      particleCount: plan.particleCapacity,
      thermoStrideFloats: THERMO_FLOATS,
      thermo: packedThermo,
      phaseCarrierPlan: plan
    },
    opticalClosureTable: closureTable()
  });
  assert.equal(seed.readyRowCount, 2);
  assert.deepEqual(
    seed.routeDeclarations.map((route) => [
      route.lineageIndex,
      route.dispersedMaterialId,
      route.opticalStateId
    ]),
    [[0, 11, 101], [1, 22, 202]]
  );
  assert.throws(
    () => buildSphDispersedMediumOpticsProducerSeedRowsFromParticleState({
      sphParticleState: {
        particleCount: plan.particleCapacity,
        thermoStrideFloats: THERMO_FLOATS,
        thermo: packedThermo.subarray(0, packedThermo.length - 1),
        phaseCarrierPlan: plan
      },
      opticalClosureTable: closureTable()
    }),
    /exact canonical packed particle thermo rows/
  );
});

test('prospective seed builder declares the exact four-lane Tier0 transition from primary material identities', () => {
  const singleLanePlan = {
    schema: 'peercompute.ulg.sph-phase-carrier-plan.v2',
    status: 'phase-lane-capacity-ready',
    lineageCapacity: 2,
    primaryCapacity: 2,
    phaseLaneCount: 1,
    phaseLaneStride: 2,
    companionStart: 2,
    companionCapacity: 0,
    particleCapacity: 2,
    stableLaneAddress: 'phaseLane*phaseLaneStride+lineageIndex',
    phaseCompanionLanesRequired: false,
    reason: 'laws-quiescent'
  };
  const thermo = new Float32Array(2 * THERMO_FLOATS);
  thermo[0] = 11;
  thermo[THERMO_FLOATS] = 22;
  const seed =
    buildSphDispersedMediumOpticsProducerSeedRowsForProspectiveFourLaneMaterialization({
      sphParticleState: {
        particleCount: 2,
        thermoStrideFloats: THERMO_FLOATS,
        thermo,
        phaseCarrierPlan: singleLanePlan
      },
      opticalClosureTable: closureTable()
    });
  assert.equal(seed.particleCount, 8);
  assert.equal(seed.readyRowCount, 2);
  assert.equal(seed.blockedRowCount, 6);
  assert.deepEqual(
    seed.routeDeclarations.map((route) => [
      route.lineageIndex,
      route.particleIndex,
      route.dispersedMaterialId,
      route.opticalStateId
    ]),
    [[0, 2, 11, 101], [1, 3, 22, 202]]
  );
  assert.throws(
    () => buildSphDispersedMediumOpticsProducerSeedRowsForProspectiveFourLaneMaterialization({
      sphParticleState: {
        particleCount: 2,
        thermoStrideFloats: THERMO_FLOATS,
        thermo,
        phaseCarrierPlan: {
          ...singleLanePlan,
          companionCapacity: 1
        }
      },
      opticalClosureTable: closureTable()
    }),
    /exact laws-quiescent single-lane phase-carrier plan/
  );
  const oversizedLineageCapacity = Math.floor(0xffff_ffff / 4) + 1;
  assert.throws(
    () => buildSphDispersedMediumOpticsProducerSeedRowsForProspectiveFourLaneMaterialization({
      sphParticleState: {
        particleCount: oversizedLineageCapacity,
        thermoStrideFloats: THERMO_FLOATS,
        thermo: new Float32Array(0),
        phaseCarrierPlan: {
          ...singleLanePlan,
          lineageCapacity: oversizedLineageCapacity,
          primaryCapacity: oversizedLineageCapacity,
          phaseLaneStride: oversizedLineageCapacity,
          companionStart: oversizedLineageCapacity,
          particleCapacity: oversizedLineageCapacity
        }
      },
      opticalClosureTable: closureTable()
    }),
    /exact laws-quiescent single-lane phase-carrier plan/
  );
});

test('WGSL producer is numeric/table-driven and writes only moment lanes after copying identity', () => {
  assert.equal(
    SPH_DISPERSED_MEDIUM_OPTICS_PRODUCER_KERNEL_REVISION,
    'four-lane-reaction-birth-conserved-condensate-ledger-optical-moments-v1'
  );
  assert.doesNotMatch(
    sphDispersedMediumOpticsProducerWgsl,
    /\b(h2o|water|steam|preset|scenario)\b/i
  );
  assert.match(sphDispersedMediumOpticsProducerWgsl, /fn find_route\(prefix: vec4<f32>\)/);
  assert.match(sphDispersedMediumOpticsProducerWgsl, /pre_transfer_thermo/);
  assert.match(sphDispersedMediumOpticsProducerWgsl, /post_transfer_state/);
  assert.match(
    sphDispersedMediumOpticsProducerWgsl,
    /out_optics\[optics_base\] = prior_optics\[optics_base\]/
  );
  assert.match(
    sphDispersedMediumOpticsProducerWgsl,
    /prior_mass_kg \+ gas_to_condensed\.mass_kg - condensed_to_gas\.mass_kg/
  );
  assert.match(
    sphDispersedMediumOpticsProducerWgsl,
    /0\.0,\s*\n\s*post_condensed\.mass_kg/
  );
  assert.match(
    sphDispersedMediumOpticsProducerWgsl,
    /COMPACT_COMPLEX_INDEX_MORPHOLOGY/
  );
  assert.match(
    sphDispersedMediumOpticsProducerWgsl,
    /fn sphere_lorenz_mie_efficiencies/
  );
  assert.match(
    sphDispersedMediumOpticsProducerWgsl,
    /fn sphere_rayleigh_domain_matches[\s\S]*SPHERE_RAYLEIGH_MAX_INTERNAL_X[\s\S]*SPHERE_RAYLEIGH_MAX_CONTRAST_SQUARED/
  );
  assert.match(
    sphDispersedMediumOpticsProducerWgsl,
    /var logarithmic_derivative: array<vec2<f32>, 128>/
  );
  assert.match(
    sphDispersedMediumOpticsProducerWgsl,
    /raw_q_extinction \+ energy_tolerance < q_scattering/
  );
  assert.match(
    sphDispersedMediumOpticsProducerWgsl,
    /dot\(mx, mx\) <= SPHERE_EXACT_MIE_MIN_INTERNAL_X_SQUARED/
  );
  assert.match(
    sphDispersedMediumOpticsProducerWgsl,
    /if \(size_parameter <= SPHERE_EXACT_MIE_MAX_X\)[\s\S]*return exact;/
  );
  assert.match(
    sphDispersedMediumOpticsProducerWgsl,
    /fn sphere_geometric_optics_diffraction_efficiencies/
  );
  assert.match(
    sphDispersedMediumOpticsProducerWgsl,
    /relative_index\.y > 0\.0[\s\S]*SphereEfficiencies\(0\.0, 0\.0, 0\.0, 0u\)/
  );
  assert.match(
    sphDispersedMediumOpticsProducerWgsl,
    /size_parameter < SPHERE_GEOMETRIC_OPTICS_MIN_X[\s\S]*central_phase_delay[\s\S]*SPHERE_GEOMETRIC_OPTICS_MIN_CENTRAL_PHASE_DELAY/
  );
  assert.doesNotMatch(
    sphDispersedMediumOpticsProducerWgsl,
    /anomalous.diffraction|geometric.optics.lower.bound/i
  );
  assert.doesNotMatch(sphDispersedMediumOpticsProducerWgsl, /saturation/i);
  assert.doesNotMatch(
    sphDispersedMediumOpticsReactionCaptureWgsl,
    /\b(h2o|water|steam|preset|scenario)\b/i
  );
  assert.match(
    sphDispersedMediumOpticsReactionCaptureWgsl,
    /fn capture_reaction_births/
  );
  assert.match(
    sphDispersedMediumOpticsReactionCaptureWgsl,
    /post_component\.mass_kg - pre_component\.mass_kg/
  );
  assert.match(
    sphDispersedMediumOpticsReactionCaptureWgsl,
    /captured_optics\[optics_base\] = selected_route\.identity/
  );
  assert.deepEqual(
    enumerateSphDispersedMediumOpticsProducerPrewarmPipelineDescriptors()
      .map((descriptor) => descriptor.entryPoint),
    ['capture_reaction_births', 'preflight', 'apply_production']
  );
});

function createFakeEncoder() {
  const passes = [];
  return {
    passes,
    beginComputePass(descriptor) {
      const record = {
        descriptor,
        pipeline: null,
        bindGroup: null,
        dispatches: [],
        ended: false
      };
      passes.push(record);
      return {
        setPipeline(pipeline) { record.pipeline = pipeline; },
        setBindGroup(index, bindGroup) { record.bindGroup = { index, bindGroup }; },
        dispatchWorkgroups(x, y = 1, z = 1) { record.dispatches.push([x, y, z]); },
        end() { record.ended = true; }
      };
    }
  };
}

function createFakeDevice() {
  const buffers = [];
  const pipelines = [];
  const bindGroups = [];
  const writes = [];
  const submissions = [];
  const device = {
    buffers,
    pipelines,
    bindGroups,
    writes,
    submissions,
    limits: {
      maxStorageBuffersPerShaderStage: 8,
      maxBufferSize: 256 * 1024 * 1024,
      maxStorageBufferBindingSize: 128 * 1024 * 1024,
      maxUniformBufferBindingSize: 64 * 1024,
      maxComputeInvocationsPerWorkgroup: 256,
      maxComputeWorkgroupSizeX: 256,
      maxComputeWorkgroupsPerDimension: 65535
    },
    queue: {
      writeBuffer(buffer, offset, data) {
        writes.push({ buffer, offset, byteLength: data.byteLength });
      },
      submit(commands) { submissions.push(commands); }
    },
    createBuffer(descriptor) {
      const mappedBytes = descriptor.mappedAtCreation
        ? new ArrayBuffer(descriptor.size)
        : null;
      const buffer = {
        ...descriptor,
        destroyed: false,
        destroyCount: 0,
        getMappedRange() {
          if (!mappedBytes) throw new Error('buffer is not mapped');
          return mappedBytes;
        },
        unmap() {},
        destroy() {
          this.destroyed = true;
          this.destroyCount += 1;
        }
      };
      buffers.push(buffer);
      return buffer;
    },
    createShaderModule(descriptor) { return descriptor; },
    createBindGroupLayout(descriptor) { return descriptor; },
    createPipelineLayout(descriptor) { return descriptor; },
    createComputePipeline(descriptor) {
      const pipeline = { ...descriptor };
      pipelines.push(pipeline);
      return pipeline;
    },
    createBindGroup(descriptor) {
      bindGroups.push(descriptor);
      return descriptor;
    },
    createCommandEncoder() {
      const encoder = createFakeEncoder();
      return {
        ...encoder,
        finish() { return { encoder }; }
      };
    }
  };
  return device;
}

function createSourceBuffer(device, label, size) {
  return tagWebGpuBufferDevice(device.createBuffer({
    label,
    size,
    usage: 128
  }), device);
}

function producerGpuFixture(device, lineageCapacity = 33) {
  const plan = phasePlan(lineageCapacity);
  const particleCount = plan.particleCapacity;
  const table = closureTable();
  const lineageMaterialIds = new Float32Array(lineageCapacity);
  lineageMaterialIds.fill(11);
  const seedOpticsDeclaration = buildSphDispersedMediumOpticsProducerSeedRows({
    phaseCarrierPlan: plan,
    lineageMaterialIds,
    opticalClosureTable: table
  });
  const seedOpticsRows = seedOpticsDeclaration.rows;
  const identityBuffer = createSourceBuffer(
    device,
    'particle-identity',
    particleCount * 4
  );
  const particleLineage = Object.freeze({
    particleCount,
    topologyEpoch: 7,
    identityRevision: 'producer-gpu-fixture-v0',
    identityBuffer
  });
  const preTransferStateBuffer = createSourceBuffer(
    device,
    'pre-state',
    particleCount * STATE_FLOATS * 4
  );
  const preTransferThermoBuffer = createSourceBuffer(
    device,
    'pre-thermo',
    particleCount * THERMO_FLOATS * 4
  );
  const postTransferStateBuffer = createSourceBuffer(
    device,
    'post-state',
    particleCount * STATE_FLOATS * 4
  );
  const postTransferThermoBuffer = createSourceBuffer(
    device,
    'post-thermo',
    particleCount * THERMO_FLOATS * 4
  );
  return {
    device,
    phaseCarrierPlan: plan,
    particleLineage,
    preTransferStateBuffer,
    preTransferThermoBuffer,
    postTransferStateBuffer,
    postTransferThermoBuffer,
    preTransferParticleSourceFamily: Object.freeze({
      ...particleLineage,
      stateBuffer: preTransferStateBuffer,
      thermoBuffer: preTransferThermoBuffer
    }),
    postTransferParticleSourceFamily: Object.freeze({
      ...particleLineage,
      stateBuffer: postTransferStateBuffer,
      thermoBuffer: postTransferThermoBuffer
    }),
    seedOpticsRows,
    seedOpticsDeclaration,
    opticalClosureTable: table
  };
}

function canonicalSidecarFreeParent(device, fixture) {
  const particleCount = fixture.phaseCarrierPlan.particleCapacity;
  return uploadSphGpuParticleBuffers(device, {
    schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
    particleCount,
    topologyEpoch: fixture.particleLineage.topologyEpoch,
    identityRevision: fixture.particleLineage.identityRevision,
    stateStrideBytes: STATE_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    thermoStrideBytes: THERMO_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    state: new Float32Array(particleCount * STATE_FLOATS),
    thermo: new Float32Array(particleCount * THERMO_FLOATS),
    identity: new Uint32Array(
      particleCount * SPH_GPU_PARTICLE_IDENTITY_UINTS
    ),
    dispersedMediumOptics: null,
    cpuIdentityStale: false
  });
}

function producerFixtureTargetingParent(fixture, parent) {
  return {
    ...fixture,
    particleLineage: Object.freeze({
      particleCount: parent.particleCount,
      topologyEpoch: parent.topologyEpoch,
      identityRevision: parent.identityRevision,
      identityBuffer: parent.identityBuffer
    }),
    postTransferStateBuffer: parent.stateBuffer,
    postTransferThermoBuffer: parent.thermoBuffer
  };
}

function adoptedOutputDescriptor({ outputBuffer, adoptionDeclaration }) {
  const readyOpticalStateIds = Object.freeze([
    ...adoptionDeclaration.readyOpticalStateIds
  ]);
  const authority = Object.freeze({
    schema: 'peercompute.ulg.sph-dispersed-medium-optics-authority.v0',
    status: 'sph-dispersed-medium-optics-authority-ready',
    particleCount: adoptionDeclaration.particleCount,
    rowCount: adoptionDeclaration.rowCount,
    rowCapacity: adoptionDeclaration.rowCapacity,
    readyRowCount: adoptionDeclaration.readyRowCount,
    blockedRowCount: adoptionDeclaration.blockedRowCount,
    readyOpticalStateIds,
    readyOpticalStateRouteCount:
      adoptionDeclaration.readyOpticalStateRouteCount,
    rowStrideFloats: adoptionDeclaration.rowStrideFloats,
    rowStrideBytes: adoptionDeclaration.rowStrideBytes,
    bufferByteLength: adoptionDeclaration.bufferByteLength
  });
  return {
    schema: 'peercompute.ulg.sph-dispersed-medium-optics-buffer-set.v0',
    status: 'webgpu-uploaded',
    sourceSchema: adoptionDeclaration.schema,
    particleCount: adoptionDeclaration.particleCount,
    rowCount: adoptionDeclaration.rowCount,
    rowCapacity: adoptionDeclaration.rowCapacity,
    readyRowCount: adoptionDeclaration.readyRowCount,
    blockedRowCount: adoptionDeclaration.blockedRowCount,
    readyOpticalStateIds,
    readyOpticalStateRouteCount:
      adoptionDeclaration.readyOpticalStateRouteCount,
    rowStrideFloats: adoptionDeclaration.rowStrideFloats,
    rowStrideBytes: adoptionDeclaration.rowStrideBytes,
    bufferByteLength: adoptionDeclaration.bufferByteLength,
    buffer: outputBuffer,
    authority,
    ownsBuffer: true,
    destroyed: false
  };
}

function priorOpticsDescriptor(buffer, packed, overrides = {}) {
  return {
    particleCount: packed.particleCount,
    rowCount: packed.rowCount,
    rowCapacity: packed.rowCapacity,
    readyRowCount: packed.readyRowCount,
    blockedRowCount: packed.blockedRowCount,
    readyOpticalStateIds: [...packed.readyOpticalStateIds],
    readyOpticalStateRouteCount: packed.readyOpticalStateRouteCount,
    rowStrideFloats: packed.rowStrideFloats,
    rowStrideBytes: packed.rowStrideBytes,
    bufferByteLength: packed.bufferByteLength,
    buffer,
    ...overrides
  };
}

test('encode-only WebGPU stage preflights then produces a distinct retained output without readback', () => {
  const device = createFakeDevice();
  const fixture = producerGpuFixture(device, 33);
  const sourceBuffers = [
    fixture.preTransferStateBuffer,
    fixture.preTransferThermoBuffer,
    fixture.postTransferStateBuffer,
    fixture.postTransferThermoBuffer
  ];
  const stage = createSphDispersedMediumOpticsProducerWebGpuEncoderStage(fixture);
  const encoder = createFakeEncoder();
  stage.encode(encoder);

  assert.equal(stage.schema, ULG_SPH_DISPERSED_MEDIUM_OPTICS_PRODUCER_ENCODER_STAGE_SCHEMA);
  assert.equal(stage.result.schema, ULG_SPH_DISPERSED_MEDIUM_OPTICS_PRODUCER_SCHEMA);
  assert.equal(stage.result.freshOutputBuffer, true);
  assert.equal(stage.result.sourceBufferMutation, false);
  assert.equal(stage.result.fullParticleReadbackPerformed, false);
  assert.equal(stage.result.mapAsyncCount, 0);
  assert.equal(stage.result.readbackBytes, 0);
  assert.equal(stage.result.hostQueueFenceCount, 0);
  assert.equal(stage.result.normalHotLoopReadbackFree, true);
  assert.equal(stage.result.ownsOutputBuffer, true);
  assert.equal(stage.result.outputOwnershipTransferred, false);
  assert.equal(stage.result.rowCount, fixture.phaseCarrierPlan.particleCapacity);
  assert.equal(stage.outputBufferByteLength, fixture.seedOpticsRows.byteLength);
  assert.ok(!sourceBuffers.includes(stage.outputBuffer));
  assert.notStrictEqual(
    stage.outputBuffer,
    device.buffers.find((buffer) => buffer.label.endsWith('-seed-optics'))
  );
  assert.equal(device.pipelines.length, 2);
  assert.equal(device.bindGroups.length, 2);
  assert.equal(device.bindGroups.every((group) => group.entries.length === 9), true);
  assert.equal(encoder.passes.length, 2);
  assert.match(encoder.passes[0].descriptor.label, /preflight$/);
  assert.match(encoder.passes[1].descriptor.label, /apply$/);
  assert.deepEqual(encoder.passes[0].dispatches, [[1, 1, 1]]);
  assert.deepEqual(encoder.passes[1].dispatches, [[3, 1, 1]]);
  assert.equal(encoder.passes.every((pass) => pass.ended), true);
  assert.equal(device.submissions.length, 0);

  stage.cleanupSubmittedWork();
  assert.equal(stage.outputBuffer.destroyed, false);
  assert.equal(sourceBuffers.every((buffer) => buffer.destroyed === false), true);
  assert.equal(
    device.buffers
      .filter((buffer) => /seed-optics|closure-rows|evidence|params/.test(buffer.label))
      .every((buffer) => buffer.destroyed === true),
    true
  );
  assert.equal(stage.cleanupRetainedOutput(), true);
  assert.equal(stage.cleanupRetainedOutput(), true);
  assert.equal(stage.outputBuffer.destroyCount, 1);
  assert.equal(stage.result.ownsOutputBuffer, false);
});

test('standalone WebGPU producer submits and retires scratch queue-ordered without a host fence', () => {
  const device = createFakeDevice();
  const fixture = producerGpuFixture(device, 3);
  const result = runSphDispersedMediumOpticsProducerWebGpu(fixture);

  assert.equal(result.status, 'dispersed-medium-optics-producer-submitted');
  assert.equal(result.submitted, true);
  assert.equal(result.commandSubmissionCount, 1);
  assert.equal(result.encodedDispatchCount, 2);
  assert.equal(device.submissions.length, 1);
  assert.equal(result.submittedWorkCleanupHostQueueFenceCount, 0);
  assert.equal(
    result.submittedWorkCleanupMethod,
    'same-gpu-queue-submission-order'
  );
  assert.equal(result.hostQueueFenceCount, 0);
  assert.equal(result.outputBuffer.destroyed, false);
  assert.equal(
    device.buffers
      .filter((buffer) => (
        /seed-optics|closure-rows|evidence|params/.test(buffer.label)
      ))
      .every((buffer) => buffer.destroyed === true),
    true
  );
  const claim = issueSphDispersedMediumOpticsProducerAdoptionClaim(result);
  assert.equal(
    claim.schema,
    ULG_SPH_DISPERSED_MEDIUM_OPTICS_PRODUCER_ADOPTION_CLAIM_SCHEMA
  );
  assert.equal(result.destroyOutputBuffer(), true);
  assert.equal(result.outputBuffer.destroyCount, 1);
});

test('GPU producer cannot encode after submitted resources retire', () => {
  const device = createFakeDevice();
  const fixture = producerGpuFixture(device, 2);
  const stage = createSphDispersedMediumOpticsProducerWebGpuEncoderStage(
    fixture
  );

  assert.equal(stage.cleanupSubmittedWork(), true);
  assert.throws(
    () => stage.encode(createFakeEncoder()),
    /no longer eligible for encoding/
  );
  assert.throws(
    () => issueSphDispersedMediumOpticsProducerAdoptionClaim(stage.result),
    /successfully encoded stage/
  );
  assert.equal(stage.cleanupRetainedOutput(), true);
  assert.equal(stage.outputBuffer.destroyCount, 1);
});

test('reaction-aware WebGPU producer captures births before phase-transfer production in three queue-ordered passes', () => {
  const device = createFakeDevice();
  const fixture = producerGpuFixture(device, 33);
  const preReactionStateBuffer = createSourceBuffer(
    device,
    'pre-reaction-state',
    fixture.preTransferStateBuffer.size
  );
  const preReactionThermoBuffer = createSourceBuffer(
    device,
    'pre-reaction-thermo',
    fixture.preTransferThermoBuffer.size
  );
  const stage = createSphDispersedMediumOpticsProducerWebGpuEncoderStage({
    ...fixture,
    preReactionStateBuffer,
    preReactionThermoBuffer
  });
  const encoder = createFakeEncoder();
  stage.encode(encoder);

  assert.equal(stage.result.reactionCaptureEnabled, true);
  assert.equal(stage.result.encodedDispatchCount, 3);
  assert.equal(
    stage.result.adoptionDeclaration.declarationMode,
    'gpu-dynamic-route-catalog-v0'
  );
  assert.equal(stage.result.adoptionDeclaration.readyRowCount, null);
  assert.equal(stage.result.adoptionDeclaration.blockedRowCount, null);
  assert.equal(stage.result.adoptionDeclaration.initialReadyRowCount, 33);
  assert.equal(stage.result.adoptionDeclaration.initialBlockedRowCount, 99);
  assert.deepEqual(
    stage.result.adoptionDeclaration.eligibleOpticalStateIds,
    [101, 202]
  );
  assert.match(
    stage.result.adoptionDeclaration.routeCatalogSignature,
    /^f32-bits-v0:/
  );
  assert.equal(device.pipelines.length, 3);
  assert.equal(device.bindGroups.length, 3);
  assert.deepEqual(
    encoder.passes.map((pass) => pass.descriptor.label.split('-').at(-1)),
    ['capture', 'preflight', 'apply']
  );
  assert.match(encoder.passes[0].descriptor.label, /reaction-capture$/);
  assert.deepEqual(encoder.passes[0].dispatches, [[3, 1, 1]]);
  assert.strictEqual(
    encoder.passes[0].bindGroup.bindGroup.entries[0].resource.buffer,
    preReactionStateBuffer
  );
  assert.strictEqual(
    encoder.passes[0].bindGroup.bindGroup.entries[2].resource.buffer,
    fixture.preTransferStateBuffer
  );
  const reactionCaptureBuffer = device.buffers.find(
    (buffer) => buffer.label.endsWith('-reaction-capture')
  );
  assert.ok(reactionCaptureBuffer);
  assert.strictEqual(
    encoder.passes[0].bindGroup.bindGroup.entries[6].resource.buffer,
    reactionCaptureBuffer
  );
  assert.strictEqual(
    encoder.passes[2].bindGroup.bindGroup.entries[4].resource.buffer,
    reactionCaptureBuffer
  );
  assert.equal(stage.result.immutableDeclarationLanes.length, 0);
  assert.deepEqual(stage.result.dynamicallyResolvedDeclarationLanes, [0, 1, 2, 3]);
  assert.match(stage.result.massAuthority, /reaction-born-condensed-component/);

  stage.cleanupSubmittedWork();
  assert.equal(reactionCaptureBuffer.destroyed, true);
  assert.equal(preReactionStateBuffer.destroyed, false);
  assert.equal(preReactionThermoBuffer.destroyed, false);
  assert.equal(stage.outputBuffer.destroyed, false);
  stage.cleanupRetainedOutput();
});

test('reaction-aware producer adoption authenticates the dynamic route catalog without active-row readback', () => {
  const device = createFakeDevice();
  const fixture = producerGpuFixture(device, 2);
  const stage = createSphDispersedMediumOpticsProducerWebGpuEncoderStage({
    ...fixture,
    preReactionStateBuffer: createSourceBuffer(
      device,
      'dynamic-adoption-pre-reaction-state',
      fixture.preTransferStateBuffer.size
    ),
    preReactionThermoBuffer: createSourceBuffer(
      device,
      'dynamic-adoption-pre-reaction-thermo',
      fixture.preTransferThermoBuffer.size
    )
  });
  stage.encode(createFakeEncoder());
  const claim = issueSphDispersedMediumOpticsProducerAdoptionClaim(
    stage.result
  );
  const transaction =
    consumeSphDispersedMediumOpticsProducerClaimAsGpuBuffer(claim, {
      device,
      outputBuffer: stage.outputBuffer,
      particleLineage: fixture.particleLineage,
      particleSourceFamily: fixture.postTransferParticleSourceFamily,
      particleSourceFamilyRegistrar: {}
    });
  const child = transaction.adoptedOutput;

  assert.equal(child.declarationMode, 'gpu-dynamic-route-catalog-v0');
  assert.equal(child.readyRowCount, null);
  assert.equal(child.blockedRowCount, null);
  assert.equal(child.initialReadyRowCount, 2);
  assert.equal(child.initialBlockedRowCount, 6);
  assert.deepEqual(child.eligibleOpticalStateIds, [101, 202]);
  assert.equal(Object.isFrozen(child.eligibleOpticalStateIds), true);
  assert.equal(
    child.activeRouteCountAuthority,
    'gpu-resident-unobserved-no-host-readback'
  );
  const snapshot = snapshotSphDispersedMediumGpuBufferDeclaration(child, {
    device,
    particleSourceFamily: fixture.postTransferParticleSourceFamily
  });
  assert.equal(snapshot.declarationMode, child.declarationMode);
  assert.equal(snapshot.readyRowCount, null);
  assert.deepEqual(
    snapshot.initialReadyOpticalStateIds,
    stage.result.adoptionDeclaration.initialReadyOpticalStateIds
  );
  assert.deepEqual(
    snapshot.eligibleOpticalStateIds,
    stage.result.adoptionDeclaration.eligibleOpticalStateIds
  );
  assert.strictEqual(snapshot.buffer, child.buffer);

  const routeCatalogSignature = child.routeCatalogSignature;
  child.routeCatalogSignature = 'f32-bits-v0:forged-after-adoption';
  assert.equal(validateSphDispersedMediumGpuBufferAuthority(
    device,
    child.authority,
    { upload: child }
  ), false);
  assert.equal(sphDispersedMediumOpticsProducerAdoptionMatches(
    stage.result,
    child,
    {
      device,
      particleSourceFamily: fixture.postTransferParticleSourceFamily
    }
  ), false);
  child.routeCatalogSignature = routeCatalogSignature;
  assert.equal(sphDispersedMediumOpticsProducerAdoptionMatches(
    stage.result,
    child,
    {
      device,
      particleSourceFamily: fixture.postTransferParticleSourceFamily
    }
  ), true);

  stage.cleanupSubmittedWork();
  assert.equal(destroySphDispersedMediumGpuBuffers(child), true);
  assert.equal(stage.outputBuffer.destroyCount, 1);
});

test('reaction-aware producer keeps an all-blocked H2-like route catalog optically thin through adoption', () => {
  const device = createFakeDevice();
  const fixture = producerGpuFixture(device, 1);
  const opticalClosureTable = buildSphDispersedMediumOpticalClosureTable([{
    dispersedMaterialId: 33,
    vaporPhaseId: GAS_PHASE_ID,
    condensedPhaseId: LIQUID_PHASE_ID,
    opticalStateId: 303,
    morphologyModelId:
      SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL.blocked,
    status: SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_STATUS.blocked
  }]);
  const seedOpticsDeclaration = buildSphDispersedMediumOpticsProducerSeedRows({
    phaseCarrierPlan: fixture.phaseCarrierPlan,
    lineageMaterialIds: new Float32Array([33]),
    opticalClosureTable
  });
  const stage = createSphDispersedMediumOpticsProducerWebGpuEncoderStage({
    ...fixture,
    opticalClosureTable,
    seedOpticsDeclaration,
    seedOpticsRows: seedOpticsDeclaration.rows,
    preReactionStateBuffer: createSourceBuffer(
      device,
      'h2-like-pre-reaction-state',
      fixture.preTransferStateBuffer.size
    ),
    preReactionThermoBuffer: createSourceBuffer(
      device,
      'h2-like-pre-reaction-thermo',
      fixture.preTransferThermoBuffer.size
    )
  });
  stage.encode(createFakeEncoder());
  const claim = issueSphDispersedMediumOpticsProducerAdoptionClaim(
    stage.result
  );
  const transaction =
    consumeSphDispersedMediumOpticsProducerClaimAsGpuBuffer(claim, {
      device,
      outputBuffer: stage.outputBuffer,
      particleLineage: fixture.particleLineage,
      particleSourceFamily: fixture.postTransferParticleSourceFamily,
      particleSourceFamilyRegistrar: {}
    });

  assert.equal(transaction.adoptedOutput.readyRowCount, null);
  assert.equal(transaction.adoptedOutput.blockedRowCount, null);
  assert.deepEqual(
    transaction.adoptedOutput.initialReadyOpticalStateIds,
    []
  );
  assert.deepEqual(transaction.adoptedOutput.eligibleOpticalStateIds, []);
  assert.equal(
    transaction.adoptedOutput.eligibleOpticalStateRouteCount,
    0
  );
  assert.equal(sphDispersedMediumOpticsProducerAdoptionMatches(
    stage.result,
    transaction.adoptedOutput,
    {
      device,
      particleSourceFamily: fixture.postTransferParticleSourceFamily
    }
  ), true);

  stage.cleanupSubmittedWork();
  assert.equal(destroySphDispersedMediumGpuBuffers(
    transaction.adoptedOutput
  ), true);
  assert.equal(stage.outputBuffer.destroyCount, 1);
});

test('GPU producer quarantines cleanup reentrancy while encoding', () => {
  const device = createFakeDevice();
  const fixture = producerGpuFixture(device, 2);
  const stage = createSphDispersedMediumOpticsProducerWebGpuEncoderStage(
    fixture
  );
  const encoder = createFakeEncoder();
  const beginComputePass = encoder.beginComputePass.bind(encoder);
  let reentrancyChecked = false;
  encoder.beginComputePass = (descriptor) => {
    if (!reentrancyChecked) {
      reentrancyChecked = true;
      assert.throws(
        () => stage.cleanupSubmittedWork(),
        /cleanup is quarantined while encoding/
      );
      assert.throws(
        () => stage.cleanupRetainedOutput(),
        /cleanup is quarantined while encoding/
      );
      assert.throws(
        () => stage.encode(createFakeEncoder()),
        /no longer eligible for encoding/
      );
    }
    return beginComputePass(descriptor);
  };

  assert.equal(stage.encode(encoder), true);
  assert.equal(reentrancyChecked, true);
  assert.equal(stage.cleanupSubmittedWork(), true);
  assert.equal(stage.cleanupRetainedOutput(), true);
  assert.equal(stage.outputBuffer.destroyCount, 1);
});

test('GPU producer reuses only an authenticated exact closure allocation and pins it through submission', () => {
  const device = createFakeDevice();
  const fixture = producerGpuFixture(device, 2);
  const closureGpuTable = uploadSphDispersedMediumOpticalClosureGpuTable(
    device,
    fixture.opticalClosureTable
  );
  const closureBuffer = closureGpuTable.buffer;
  const beforeStageBufferCount = device.buffers.length;
  const stage = createSphDispersedMediumOpticsProducerWebGpuEncoderStage({
    ...fixture,
    opticalClosureGpuTable: closureGpuTable
  });

  assert.equal(
    stage.result.closureSource,
    'authenticated-resident-static-closure-buffer'
  );
  assert.equal(
    device.buffers.slice(beforeStageBufferCount).some(
      (buffer) => buffer.label.endsWith('-closure-rows')
    ),
    false
  );
  assert.equal(stage.encode(createFakeEncoder()), true);
  assert.equal(
    destroySphDispersedMediumOpticalClosureGpuTable(closureGpuTable),
    true
  );
  assert.equal(closureGpuTable.destroyPending, true);
  assert.equal(closureBuffer.destroyCount, 0);
  assert.equal(stage.cleanupSubmittedWork(), true);
  assert.equal(closureBuffer.destroyCount, 1);
  assert.equal(stage.cleanupRetainedOutput(), true);

  const secondDevice = createFakeDevice();
  const secondFixture = producerGpuFixture(secondDevice, 2);
  const exactClosureGpuTable =
    uploadSphDispersedMediumOpticalClosureGpuTable(
      secondDevice,
      secondFixture.opticalClosureTable
    );
  const exactClosureBuffer = exactClosureGpuTable.buffer;
  const substitutedClosureBuffer = createSourceBuffer(
    secondDevice,
    'hostile-same-size-closure-substitute',
    exactClosureGpuTable.bufferByteLength
  );
  let closureBufferReadCount = 0;
  Object.defineProperty(exactClosureGpuTable, 'buffer', {
    configurable: true,
    enumerable: true,
    get() {
      closureBufferReadCount += 1;
      return closureBufferReadCount === 3
        ? substitutedClosureBuffer
        : exactClosureBuffer;
    }
  });
  const beforeRejectedStage = secondDevice.buffers.length;
  assert.throws(
    () => createSphDispersedMediumOpticsProducerWebGpuEncoderStage({
      ...secondFixture,
      opticalClosureGpuTable: exactClosureGpuTable
    }),
    /live exact GPU table/
  );
  assert.equal(closureBufferReadCount >= 3, true);
  assert.equal(secondDevice.buffers.length, beforeRejectedStage);
  assert.equal(
    destroySphDispersedMediumOpticalClosureGpuTable(exactClosureGpuTable),
    true
  );
  assert.equal(exactClosureBuffer.destroyCount, 1);
  assert.equal(substitutedClosureBuffer.destroyCount, 0);
  substitutedClosureBuffer.destroy();
});

test('WebGPU producer transfers its fresh output only through an exact one-shot adoption claim', () => {
  const device = createFakeDevice();
  const fixture = producerGpuFixture(device, 2);
  const stage = createSphDispersedMediumOpticsProducerWebGpuEncoderStage(
    fixture
  );
  const unrelatedBuffer = createSourceBuffer(
    device,
    'unrelated-output-candidate',
    stage.outputBufferByteLength
  );

  assert.throws(
    () => stage.transferOutputBufferOwnership(unrelatedBuffer),
    /exact produced buffer/
  );
  assert.throws(
    () => stage.transferOutputBufferOwnership(stage.outputBuffer),
    /successful adoption receipt/
  );
  assert.throws(
    () => issueSphDispersedMediumOpticsProducerAdoptionClaim(stage.result),
    /successfully encoded stage/
  );
  assert.equal(stage.encode(createFakeEncoder()), true);
  assert.throws(
    () => stage.encode(createFakeEncoder()),
    /no longer eligible for encoding/
  );
  const claim = issueSphDispersedMediumOpticsProducerAdoptionClaim(
    stage.result
  );
  assert.equal(
    claim.schema,
    ULG_SPH_DISPERSED_MEDIUM_OPTICS_PRODUCER_ADOPTION_CLAIM_SCHEMA
  );
  assert.throws(
    () => consumeSphDispersedMediumOpticsProducerAdoptionClaim(
      { ...claim },
      {
        device,
        outputBuffer: stage.outputBuffer,
        particleSourceFamily: fixture.postTransferParticleSourceFamily,
        adopt() { throw new Error('copied claim must not invoke adoption'); }
      }
    ),
    /exact issued claim/
  );
  assert.throws(
    () => consumeSphDispersedMediumOpticsProducerAdoptionClaim(claim, {
      device,
      outputBuffer: unrelatedBuffer,
      particleSourceFamily: fixture.postTransferParticleSourceFamily,
      adopt() { throw new Error('foreign buffer must not invoke adoption'); }
    }),
    /exact produced buffer/
  );
  const wrongFamily = Object.freeze({
    ...fixture.postTransferParticleSourceFamily,
    stateBuffer: createSourceBuffer(
      device,
      'wrong-post-state',
      fixture.postTransferStateBuffer.size
    )
  });
  assert.throws(
    () => consumeSphDispersedMediumOpticsProducerClaimAsGpuBuffer(claim, {
      device,
      outputBuffer: stage.outputBuffer,
      particleLineage: fixture.particleLineage,
      particleSourceFamily: wrongFamily,
      particleSourceFamilyRegistrar: {}
    }),
    /exact post-transfer particle source family/
  );
  const transaction =
    consumeSphDispersedMediumOpticsProducerClaimAsGpuBuffer(claim, {
      device,
      outputBuffer: stage.outputBuffer,
      particleLineage: fixture.particleLineage,
      particleSourceFamily: fixture.postTransferParticleSourceFamily,
      particleSourceFamilyRegistrar: {}
    });
  assert.equal(
    transaction.schema,
    ULG_SPH_DISPERSED_MEDIUM_OPTICS_PRODUCER_ADOPTION_TRANSACTION_SCHEMA
  );
  assert.equal(
    transaction.adoptionReceipt.schema,
    ULG_SPH_DISPERSED_MEDIUM_OPTICS_PRODUCER_ADOPTION_RECEIPT_SCHEMA
  );
  assert.strictEqual(transaction.outputBuffer, stage.outputBuffer);
  assert.strictEqual(transaction.adoptedOutput.buffer, stage.outputBuffer);
  assert.equal(validateSphDispersedMediumGpuBufferAuthority(
    device,
    transaction.adoptedOutput.authority,
    {
      upload: transaction.adoptedOutput,
      buffer: stage.outputBuffer,
      particleLineage: fixture.particleLineage,
      requireParticleLineage: true
    }
  ), true);
  assert.equal(sphDispersedMediumGpuBufferParticleSourceFamilyMatches(
    transaction.adoptedOutput,
    fixture.postTransferParticleSourceFamily
  ), true);
  assert.equal(sphDispersedMediumGpuBufferParticleSourceFamilyMatches(
    transaction.adoptedOutput,
    wrongFamily
  ), false);
  assert.equal(sphDispersedMediumOpticsProducerAdoptionMatches(
    stage.result,
    transaction.adoptedOutput,
    {
      device,
      particleSourceFamily: fixture.postTransferParticleSourceFamily
    }
  ), true);
  assert.equal(sphDispersedMediumOpticsProducerAdoptionMatches(
    { ...stage.result },
    transaction.adoptedOutput,
    {
      device,
      particleSourceFamily: fixture.postTransferParticleSourceFamily
    }
  ), false);
  assert.equal(sphDispersedMediumOpticsProducerAdoptionMatches(
    stage.result,
    transaction.adoptedOutput,
    { device, particleSourceFamily: wrongFamily }
  ), false);
  assert.equal(stage.result.ownsBuffer, false);
  assert.equal(stage.result.ownsOutputBuffer, false);
  assert.equal(stage.result.outputOwnershipTransferred, true);
  assert.equal(stage.result.adoptionStatus, 'ownership-transferred');
  assert.equal(stage.cleanupRetainedOutput(), true);
  assert.equal(stage.outputBuffer.destroyCount, 0);
  assert.throws(
    () => consumeSphDispersedMediumOpticsProducerAdoptionClaim(claim, {
      device,
      outputBuffer: stage.outputBuffer,
      particleSourceFamily: fixture.postTransferParticleSourceFamily,
      adopt() { throw new Error('replay must not invoke adoption'); }
    }),
    /no longer consumable/
  );
  assert.throws(
    () => issueSphDispersedMediumOpticsProducerAdoptionClaim(stage.result),
    /no longer issuable/
  );

  stage.cleanupSubmittedWork();
  assert.equal(destroySphDispersedMediumGpuBuffers(
    transaction.adoptedOutput
  ), true);
  assert.equal(sphDispersedMediumOpticsProducerAdoptionMatches(
    stage.result,
    transaction.adoptedOutput,
    {
      device,
      particleSourceFamily: fixture.postTransferParticleSourceFamily
    }
  ), false);
  assert.equal(destroySphDispersedMediumGpuBuffers(
    transaction.adoptedOutput
  ), false);
  assert.equal(stage.outputBuffer.destroyCount, 1);
  unrelatedBuffer.destroy();
  wrongFamily.stateBuffer.destroy();
});

test('producer adoption is non-reentrant while one exact claim is in progress', () => {
  const device = createFakeDevice();
  const fixture = producerGpuFixture(device, 2);
  const stage = createSphDispersedMediumOpticsProducerWebGpuEncoderStage(
    fixture
  );
  stage.encode(createFakeEncoder());
  const claim = issueSphDispersedMediumOpticsProducerAdoptionClaim(
    stage.result
  );
  let hostileGetterRan = false;
  let reentrantAdoptRan = false;
  const hostilePreflightOptions = new Proxy({
    device: { ...device },
    outputBuffer: stage.outputBuffer,
    particleSourceFamily: fixture.postTransferParticleSourceFamily,
    adopt() {
      throw new Error('invalid outer preflight must not adopt');
    }
  }, {
    get(target, property, receiver) {
      if (!hostileGetterRan) {
        hostileGetterRan = true;
        assert.throws(
          () => consumeSphDispersedMediumOpticsProducerAdoptionClaim(
            claim,
            {
              device,
              outputBuffer: stage.outputBuffer,
              particleSourceFamily:
                fixture.postTransferParticleSourceFamily,
              adopt() {
                reentrantAdoptRan = true;
              }
            }
          ),
          /no longer consumable/
        );
        assert.throws(
          () => stage.cleanupRetainedOutput(),
          /cleanup is quarantined/
        );
      }
      return Reflect.get(target, property, receiver);
    }
  });
  assert.throws(
    () => consumeSphDispersedMediumOpticsProducerAdoptionClaim(
      claim,
      hostilePreflightOptions
    ),
    /exact producing device/
  );
  assert.equal(hostileGetterRan, true);
  assert.equal(reentrantAdoptRan, false);
  assert.equal(stage.result.adoptionStatus, 'claim-issued');

  let lowerOptionsGetterRan = false;
  let lowerReentrantAdoptRan = false;
  let sourceFamilyReadCount = 0;
  const substitutedPostFamily = Object.freeze({
    ...fixture.postTransferParticleSourceFamily,
    stateBuffer: fixture.preTransferStateBuffer
  });
  const exactLowerOptions = {
    device,
    outputBuffer: stage.outputBuffer,
    particleLineage: fixture.particleLineage,
    particleSourceFamily: fixture.postTransferParticleSourceFamily,
    particleSourceFamilyRegistrar: {},
    publish({ upload }) {
      assert.throws(
        () => consumeSphDispersedMediumOpticsProducerAdoptionClaim(
          claim,
          {
            device,
            outputBuffer: stage.outputBuffer,
            particleSourceFamily:
              fixture.postTransferParticleSourceFamily,
            adopt() {
              throw new Error('reentrant adoption must not run');
            }
          }
        ),
        /no longer consumable/
      );
      assert.throws(
        () => issueSphDispersedMediumOpticsProducerAdoptionClaim(
          stage.result
        ),
        /no longer issuable/
      );
      assert.throws(
        () => stage.cleanupRetainedOutput(),
        /cleanup is quarantined/
      );
      return upload;
    }
  };
  const hostileLowerOptions = new Proxy(exactLowerOptions, {
    get(target, property, receiver) {
      if (property === 'device' && !lowerOptionsGetterRan) {
        lowerOptionsGetterRan = true;
        assert.throws(
          () => consumeSphDispersedMediumOpticsProducerClaimAsGpuBuffer(
            claim,
            {
              device,
              outputBuffer: stage.outputBuffer,
              particleLineage: fixture.particleLineage,
              particleSourceFamily:
                fixture.postTransferParticleSourceFamily,
              particleSourceFamilyRegistrar: {},
              publish() {
                lowerReentrantAdoptRan = true;
              }
            }
          ),
          /no longer consumable/
        );
      }
      if (property === 'particleSourceFamily') {
        sourceFamilyReadCount += 1;
        return sourceFamilyReadCount === 1
          ? fixture.postTransferParticleSourceFamily
          : substitutedPostFamily;
      }
      return Reflect.get(target, property, receiver);
    }
  });
  const transaction =
    consumeSphDispersedMediumOpticsProducerClaimAsGpuBuffer(
      claim,
      hostileLowerOptions
    );

  assert.equal(lowerOptionsGetterRan, true);
  assert.equal(lowerReentrantAdoptRan, false);
  assert.equal(sourceFamilyReadCount, 1);
  assert.strictEqual(transaction.adoptedOutput.buffer, stage.outputBuffer);
  assert.equal(stage.result.outputOwnershipTransferred, true);
  stage.cleanupSubmittedWork();
  assert.equal(
    destroySphDispersedMediumGpuBuffers(transaction.adoptedOutput),
    true
  );
  assert.equal(stage.outputBuffer.destroyCount, 1);
});

test('terminal producer adoption attaches only to an exact sidecar-free SPH parent and rolls publication back', () => {
  {
    const device = createFakeDevice();
    const fixture = producerGpuFixture(device, 2);
    const parent = canonicalSidecarFreeParent(device, fixture);
    const stage = createSphDispersedMediumOpticsProducerWebGpuEncoderStage(
      producerFixtureTargetingParent(fixture, parent)
    );
    stage.encode(createFakeEncoder());
    const claim = issueSphDispersedMediumOpticsProducerAdoptionClaim(
      stage.result
    );
    let sourceParentReadCount = 0;
    let reentrantHighLevelAdoptionSucceeded = false;
    const hostileParentOptions = new Proxy({ sourceSphUpload: parent }, {
      get(target, property, receiver) {
        if (property === 'sourceSphUpload') {
          sourceParentReadCount += 1;
          if (sourceParentReadCount === 1) {
            assert.throws(
              () => {
                adoptSphGpuParticleDispersedMediumOpticsSidecar(
                  device,
                  claim,
                  stage.outputBuffer,
                  { sourceSphUpload: parent }
                );
                reentrantHighLevelAdoptionSucceeded = true;
              },
              /no longer consumable/
            );
          }
        }
        return Reflect.get(target, property, receiver);
      }
    });
    const sidecar = adoptSphGpuParticleDispersedMediumOpticsSidecar(
      device,
      claim,
      stage.outputBuffer,
      hostileParentOptions
    );

    assert.equal(sourceParentReadCount, 1);
    assert.equal(reentrantHighLevelAdoptionSucceeded, false);
    assert.strictEqual(parent.dispersedMediumOptics, sidecar);
    assert.strictEqual(parent.dispersedMediumOpticsBuffer, stage.outputBuffer);
    assert.equal(parent.ownsDispersedMediumOpticsBuffer, true);
    assert.equal(sphDispersedMediumGpuBufferParticleSourceFamilyMatches(
      sidecar,
      {
        particleCount: parent.particleCount,
        topologyEpoch: parent.topologyEpoch,
        identityRevision: parent.identityRevision,
        identityBuffer: parent.identityBuffer,
        stateBuffer: parent.stateBuffer,
        thermoBuffer: parent.thermoBuffer
      }
    ), true);
    stage.cleanupSubmittedWork();
    assert.equal(stage.cleanupRetainedOutput(), true);
    assert.equal(stage.outputBuffer.destroyCount, 0);
    assert.equal(destroySphGpuParticleBuffers(parent), true);
    assert.equal(destroySphGpuParticleBuffers(parent), false);
    assert.equal(stage.outputBuffer.destroyCount, 1);
  }

  {
    const device = createFakeDevice();
    const fixture = producerGpuFixture(device, 2);
    const parent = canonicalSidecarFreeParent(device, fixture);
    const stage = createSphDispersedMediumOpticsProducerWebGpuEncoderStage(
      producerFixtureTargetingParent(fixture, parent)
    );
    stage.encode(createFakeEncoder());
    const claim = issueSphDispersedMediumOpticsProducerAdoptionClaim(
      stage.result
    );
    Object.defineProperty(parent, 'dispersedMediumOptics', {
      configurable: true,
      enumerable: true,
      value: null,
      writable: false
    });

    assert.throws(
      () => adoptSphGpuParticleDispersedMediumOpticsSidecar(
        device,
        claim,
        stage.outputBuffer,
        { sourceSphUpload: parent }
      ),
      /read only|Cannot assign/
    );
    assert.equal(parent.dispersedMediumOptics, null);
    assert.equal(parent.ownsDispersedMediumOpticsBuffer, false);
    assert.equal(stage.result.adoptionStatus, 'adoption-failed-rolled-back');
    assert.equal(stage.result.ownsOutputBuffer, true);
    assert.equal(stage.cleanupRetainedOutput(), true);
    assert.equal(stage.outputBuffer.destroyCount, 1);
    stage.cleanupSubmittedWork();
    assert.equal(destroySphGpuParticleBuffers(parent), true);
    assert.equal(stage.outputBuffer.destroyCount, 1);
  }
});

test('adopted producer authority rebases only after the exact parent and child topology epoch transition', () => {
  const device = createFakeDevice();
  const fixture = producerGpuFixture(device, 2);
  const parent = canonicalSidecarFreeParent(device, fixture);
  const stage = createSphDispersedMediumOpticsProducerWebGpuEncoderStage(
    producerFixtureTargetingParent(fixture, parent)
  );
  stage.encode(createFakeEncoder());
  const claim = issueSphDispersedMediumOpticsProducerAdoptionClaim(
    stage.result
  );
  const sidecar = adoptSphGpuParticleDispersedMediumOpticsSidecar(
    device,
    claim,
    stage.outputBuffer,
    { sourceSphUpload: parent }
  );
  const sourceFamily = Object.freeze({
    particleCount: parent.particleCount,
    topologyEpoch: parent.topologyEpoch,
    identityRevision: parent.identityRevision,
    identityBuffer: parent.identityBuffer,
    stateBuffer: parent.stateBuffer,
    thermoBuffer: parent.thermoBuffer
  });
  assert.equal(
    sphDispersedMediumOpticsProducerAdoptionMatches(
      stage.result,
      sidecar,
      { device, particleSourceFamily: sourceFamily }
    ),
    true
  );

  const parentTransition =
    advanceExactParentSphDispersedMediumOpticsTopologyEpoch({
      sourceSphUpload: parent,
      device,
      targetTopologyEpoch: sourceFamily.topologyEpoch + 1
    });
  const targetFamily = Object.freeze({
    ...sourceFamily,
    topologyEpoch: parent.topologyEpoch
  });
  assert.equal(
    sphDispersedMediumOpticsProducerAdoptionMatches(
      stage.result,
      sidecar,
      { device, particleSourceFamily: targetFamily }
    ),
    false,
    'the producer record must remain stale until its exact rebase'
  );
  const producerRebase =
    rebaseSphDispersedMediumOpticsProducerAdoptionTopologyEpoch(
      stage.result,
      sidecar,
      {
        topologyEpochTransitionReceipt: parentTransition,
        targetParticleSourceFamily: targetFamily
      }
    );
  assert.equal(
    producerRebase.status,
    'sph-dispersed-medium-optics-producer-topology-rebased'
  );
  assert.equal(producerRebase.sourceTopologyEpoch, sourceFamily.topologyEpoch);
  assert.equal(producerRebase.targetTopologyEpoch, targetFamily.topologyEpoch);
  assert.equal(
    sphDispersedMediumOpticsProducerAdoptionMatches(
      stage.result,
      sidecar,
      { device, particleSourceFamily: targetFamily }
    ),
    true
  );

  assert.equal(producerRebase.rollback(), true);
  assert.equal(
    sphDispersedMediumOpticsProducerAdoptionMatches(
      stage.result,
      sidecar,
      { device, particleSourceFamily: targetFamily }
    ),
    false
  );
  assert.equal(parentTransition.rollback(), true);
  assert.equal(
    sphDispersedMediumOpticsProducerAdoptionMatches(
      stage.result,
      sidecar,
      { device, particleSourceFamily: sourceFamily }
    ),
    true
  );
  stage.cleanupSubmittedWork();
  assert.equal(destroySphGpuParticleBuffers(parent), true);
  assert.equal(stage.outputBuffer.destroyCount, 1);
});

test('fabricated adoption authority and declaration getter mutation cannot steal producer ownership', () => {
  const device = createFakeDevice();
  const fixture = producerGpuFixture(device, 2);
  const stage = createSphDispersedMediumOpticsProducerWebGpuEncoderStage(
    fixture
  );
  stage.encode(createFakeEncoder());
  const claim = issueSphDispersedMediumOpticsProducerAdoptionClaim(
    stage.result
  );
  let callbackRows = null;
  let rollbackCount = 0;
  const rollback = () => {
    rollbackCount += 1;
    return true;
  };
  assert.throws(
    () => consumeSphDispersedMediumOpticsProducerAdoptionClaim(claim, {
      device,
      outputBuffer: stage.outputBuffer,
      particleSourceFamily: fixture.postTransferParticleSourceFamily,
      adopt(context) {
        callbackRows = context.adoptionDeclaration.rows;
        context.registerRollback(rollback);
        const forged = adoptedOutputDescriptor(context);
        Object.defineProperty(forged, 'schema', {
          configurable: true,
          enumerable: true,
          get() {
            callbackRows[0] = 999;
            return 'peercompute.ulg.sph-dispersed-medium-optics-buffer-set.v0';
          }
        });
        return { adoptedOutput: forged, rollback };
      }
    }),
    /exact live child/
  );
  assert.equal(rollbackCount, 1);
  assert.equal(stage.result.adoptionStatus, 'adoption-failed-rolled-back');
  assert.equal(callbackRows[0], 999);
  assert.equal(stage.adoptionDeclaration.rows[0], 0);
  assert.equal(stage.result.ownsOutputBuffer, true);
  assert.equal(stage.result.outputOwnershipTransferred, false);
  assert.equal(stage.cleanupRetainedOutput(), true);
  assert.equal(stage.outputBuffer.destroyCount, 1);
  stage.cleanupSubmittedWork();
});

test('failed lower adoption consumes the claim but leaves producer cleanup authority intact', () => {
  const device = createFakeDevice();
  const fixture = producerGpuFixture(device, 2);
  const stage = createSphDispersedMediumOpticsProducerWebGpuEncoderStage(
    fixture
  );
  stage.encode(createFakeEncoder());
  const claim = issueSphDispersedMediumOpticsProducerAdoptionClaim(
    stage.result
  );
  assert.throws(
    () => consumeSphDispersedMediumOpticsProducerClaimAsGpuBuffer(claim, {
      device,
      outputBuffer: stage.outputBuffer,
      particleLineage: null,
      particleSourceFamily: fixture.postTransferParticleSourceFamily,
      particleSourceFamilyRegistrar: {}
    }),
    /exact post-transfer particle lineage/
  );
  assert.equal(stage.result.adoptionStatus, 'adoption-failed-no-registration');
  assert.equal(stage.result.ownsOutputBuffer, true);
  assert.equal(stage.result.outputOwnershipTransferred, false);
  assert.equal(stage.cleanupRetainedOutput(), true);
  assert.equal(stage.outputBuffer.destroyCount, 1);
  stage.cleanupSubmittedWork();
});

test('post-registration publication failure rolls private authority back before producer cleanup', () => {
  const device = createFakeDevice();
  const fixture = producerGpuFixture(device, 2);
  const stage = createSphDispersedMediumOpticsProducerWebGpuEncoderStage(
    fixture
  );
  stage.encode(createFakeEncoder());
  const claim = issueSphDispersedMediumOpticsProducerAdoptionClaim(
    stage.result
  );
  let rolledBackUpload = null;
  assert.throws(
    () => consumeSphDispersedMediumOpticsProducerClaimAsGpuBuffer(claim, {
      device,
      outputBuffer: stage.outputBuffer,
      particleLineage: fixture.particleLineage,
      particleSourceFamily: fixture.postTransferParticleSourceFamily,
      particleSourceFamilyRegistrar: {},
      publish({ upload }) {
        rolledBackUpload = upload;
        return { ...upload };
      }
    }),
    /publish the exact registered child/
  );
  assert.equal(validateSphDispersedMediumGpuBufferAuthority(
    device,
    rolledBackUpload.authority
  ), false);
  assert.equal(stage.result.adoptionStatus, 'adoption-failed-rolled-back');
  assert.equal(stage.outputBuffer.destroyCount, 0);
  assert.equal(stage.cleanupRetainedOutput(), true);
  assert.equal(stage.outputBuffer.destroyCount, 1);
  stage.cleanupSubmittedWork();
});

test('failed adoption rollback quarantines producer output from double destruction', () => {
  const device = createFakeDevice();
  const fixture = producerGpuFixture(device, 2);
  const stage = createSphDispersedMediumOpticsProducerWebGpuEncoderStage(
    fixture
  );
  stage.encode(createFakeEncoder());
  const claim = issueSphDispersedMediumOpticsProducerAdoptionClaim(
    stage.result
  );
  let failure = null;
  try {
    consumeSphDispersedMediumOpticsProducerClaimAsGpuBuffer(claim, {
      device,
      outputBuffer: stage.outputBuffer,
      particleLineage: fixture.particleLineage,
      particleSourceFamily: fixture.postTransferParticleSourceFamily,
      particleSourceFamilyRegistrar: {},
      publish({ upload, registerPublicationRollback }) {
        registerPublicationRollback(() => false);
        return { ...upload };
      }
    });
  } catch (error) {
    failure = error;
  }
  assert.match(failure?.message ?? '', /publish the exact registered child/);
  assert.match(
    failure?.adoptionRollbackError?.message ?? '',
    /did not confirm revocation/
  );
  assert.equal(
    stage.result.adoptionStatus,
    'adoption-rollback-failed-quarantined'
  );
  assert.throws(
    () => stage.cleanupRetainedOutput(),
    /cleanup is quarantined/
  );
  assert.equal(stage.outputBuffer.destroyCount, 0);
  stage.cleanupSubmittedWork();
});

test('prior-buffer production requires private sidecar declaration and source-family authority', () => {
  const device = createFakeDevice();
  const fixture = producerGpuFixture(device, 2);
  const packed = fixture.seedOpticsDeclaration;
  const priorBuffer = createSourceBuffer(
    device,
    'resident-prior-optics',
    packed.bufferByteLength
  );
  const priorOptics = priorOpticsDescriptor(priorBuffer, packed);
  const {
    seedOpticsRows: _seedOpticsRows,
    seedOpticsDeclaration: _seedOpticsDeclaration,
    preTransferParticleSourceFamily: _preFamily,
    postTransferParticleSourceFamily: _postFamily,
    ...common
  } = fixture;

  assert.throws(
    () => createSphDispersedMediumOpticsProducerWebGpuEncoderStage({
      ...common,
      priorOptics
    }),
    /exact live sidecar and source family/
  );

  const seedStage = createSphDispersedMediumOpticsProducerWebGpuEncoderStage(
    fixture
  );
  seedStage.encode(createFakeEncoder());
  const seedClaim = issueSphDispersedMediumOpticsProducerAdoptionClaim(
    seedStage.result
  );
  const seedTransaction =
    consumeSphDispersedMediumOpticsProducerClaimAsGpuBuffer(seedClaim, {
      device,
      outputBuffer: seedStage.outputBuffer,
      particleLineage: fixture.particleLineage,
      particleSourceFamily: fixture.postTransferParticleSourceFamily,
      particleSourceFamilyRegistrar: {}
    });
  seedStage.cleanupSubmittedWork();

  const targetState = createSourceBuffer(
    device,
    'continuation-post-state',
    fixture.postTransferStateBuffer.size
  );
  const targetThermo = createSourceBuffer(
    device,
    'continuation-post-thermo',
    fixture.postTransferThermoBuffer.size
  );
  const targetFamily = Object.freeze({
    ...fixture.particleLineage,
    stateBuffer: targetState,
    thermoBuffer: targetThermo
  });
  const exactPriorBuffer = seedTransaction.adoptedOutput.buffer;
  const substitutedPriorBuffer = createSourceBuffer(
    device,
    'hostile-same-size-prior-substitute',
    seedTransaction.adoptedOutput.bufferByteLength
  );
  let priorBufferReadCount = 0;
  Object.defineProperty(seedTransaction.adoptedOutput, 'buffer', {
    configurable: true,
    enumerable: true,
    get() {
      priorBufferReadCount += 1;
      return priorBufferReadCount === 1
        ? substitutedPriorBuffer
        : exactPriorBuffer;
    }
  });
  const continuationInput = {
    device,
    phaseCarrierPlan: fixture.phaseCarrierPlan,
    particleLineage: fixture.particleLineage,
    preTransferStateBuffer: fixture.postTransferStateBuffer,
    preTransferThermoBuffer: fixture.postTransferThermoBuffer,
    postTransferStateBuffer: targetState,
    postTransferThermoBuffer: targetThermo,
    priorOptics: seedTransaction.adoptedOutput,
    opticalClosureTable: fixture.opticalClosureTable
  };
  const beforeRejectedContinuation = device.buffers.length;
  assert.throws(
    () => createSphDispersedMediumOpticsProducerWebGpuEncoderStage(
      continuationInput
    ),
    /exact live sidecar and source family/
  );
  assert.equal(priorBufferReadCount, 1);
  assert.equal(device.buffers.length, beforeRejectedContinuation);
  const continuationStage =
    createSphDispersedMediumOpticsProducerWebGpuEncoderStage(
      continuationInput
    );
  continuationStage.encode(createFakeEncoder());
  assert.equal(destroySphDispersedMediumGpuBuffers(
    seedTransaction.adoptedOutput
  ), true);
  assert.equal(seedStage.outputBuffer.destroyCount, 0);

  const continuationClaim =
    issueSphDispersedMediumOpticsProducerAdoptionClaim(
      continuationStage.result
    );
  const continuationTransaction =
    consumeSphDispersedMediumOpticsProducerClaimAsGpuBuffer(
      continuationClaim,
      {
        device,
        outputBuffer: continuationStage.outputBuffer,
        particleLineage: fixture.particleLineage,
        particleSourceFamily: targetFamily,
        particleSourceFamilyRegistrar: {}
      }
    );
  continuationStage.cleanupSubmittedWork();
  assert.equal(seedStage.outputBuffer.destroyCount, 1);
  assert.equal(destroySphDispersedMediumGpuBuffers(
    continuationTransaction.adoptedOutput
  ), true);
  assert.equal(continuationStage.outputBuffer.destroyCount, 1);
  assert.equal(substitutedPriorBuffer.destroyCount, 0);
  substitutedPriorBuffer.destroy();
});

test('GPU producer rejects missing declarations, wrong source sizes, and device limits before allocation', () => {
  {
    const device = createFakeDevice();
    const fixture = producerGpuFixture(device, 2);
    const { seedOpticsRows: _seed, ...withoutSeed } = fixture;
    const before = device.buffers.length;
    assert.throws(
      () => createSphDispersedMediumOpticsProducerWebGpuEncoderStage(withoutSeed),
      /requires a prior buffer or preregistered seed rows/
    );
    assert.equal(device.buffers.length, before);
  }
  {
    const device = createFakeDevice();
    const fixture = producerGpuFixture(device, 2);
    fixture.preTransferStateBuffer.size -= 4;
    const before = device.buffers.length;
    assert.throws(
      () => createSphDispersedMediumOpticsProducerWebGpuEncoderStage(fixture),
      /exact dense byte length/
    );
    assert.equal(device.buffers.length, before);
  }
  {
    const device = createFakeDevice();
    const fixture = producerGpuFixture(device, 2);
    device.limits.maxStorageBuffersPerShaderStage = 7;
    const before = device.buffers.length;
    assert.throws(
      () => createSphDispersedMediumOpticsProducerWebGpuEncoderStage(fixture),
      /requires eight storage bindings/
    );
    assert.equal(device.buffers.length, before);
  }
  {
    const device = createFakeDevice();
    const fixture = producerGpuFixture(device, 2);
    device.limits.maxStorageBufferBindingSize = 64;
    const before = device.buffers.length;
    assert.throws(
      () => createSphDispersedMediumOpticsProducerWebGpuEncoderStage(fixture),
      /exceed the exact WebGPU buffer limit/
    );
    assert.equal(device.buffers.length, before);
  }
});

test('GPU producer rolls back all owned setup allocations on write or pipeline failure', () => {
  for (const fault of ['write', 'pipeline']) {
    const device = createFakeDevice();
    const fixture = producerGpuFixture(device, 2);
    const sources = device.buffers.slice();
    const allocationStart = device.buffers.length;
    if (fault === 'write') {
      let writeCount = 0;
      device.queue.writeBuffer = () => {
        writeCount += 1;
        if (writeCount === 2) throw new Error('injected-producer-write-failure');
      };
    } else {
      device.createComputePipeline = () => {
        throw new Error('injected-producer-pipeline-failure');
      };
    }
    assert.throws(
      () => createSphDispersedMediumOpticsProducerWebGpuEncoderStage(fixture),
      new RegExp(`injected-producer-${fault}-failure`)
    );
    assert.equal(
      device.buffers.slice(allocationStart).every((buffer) => buffer.destroyed),
      true
    );
    assert.equal(sources.every((buffer) => buffer.destroyed === false), true);
  }
});
