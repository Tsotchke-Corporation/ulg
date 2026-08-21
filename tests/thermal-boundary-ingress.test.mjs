import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createReferenceMaterialClosures } from '../src/runtime/material/materialClosures.js';
import { GPU_PHASE_IDS, stableOpticalMaterialId } from '../src/runtime/material/opticalGpuBuffers.js';
import { specificInternalEnergyJPerKg } from '../src/runtime/material/thermoState.js';
import {
  SPH_GPU_PARTICLE_STATE_FLOATS,
  buildSphGpuParticleBuffers
} from '../src/runtime/sph/sphGpuBuffers.js';
import { createSphState } from '../src/runtime/sph/sphState.js';
import {
  buildSphThermalMaterialTable,
  clampOpenReservoirSpecificEnergyDeltaToEnergyDomain,
  resolveThermalCarrierEnergyDomainForTemperatureRangeFromTable,
  resolveThermalCarrierEnergyDomainFromTable,
  resolveThermalCarrierReachableEnergyDomainFromTable,
  runSphThermalStepCpu,
  sphThermalStepWgsl
} from '../src/runtime/sph/sphThermalGpuKernel.js';

const closures = createReferenceMaterialClosures();
const materialProperties = {
  h2o: {
    ...closures.h2o.properties,
    phases: closures.h2o.properties.phases.map((phase) => ({
      ...phase,
      thermalConductivityWPerMK: 1,
      thermalConductivityProvenance: {
        source: 'focused-boundary-ingress-fixture',
        phase: phase.name
      }
    }))
  }
};
const waterId = stableOpticalMaterialId('h2o');

function previousPositiveFloat32(value) {
  const scalar = new Float32Array([value]);
  const bits = new Uint32Array(scalar.buffer);
  bits[0] -= 1;
  return scalar[0];
}

function nextPositiveFloat32(value) {
  const scalar = new Float32Array([value]);
  const bits = new Uint32Array(scalar.buffer);
  bits[0] += 1;
  return scalar[0];
}

function waterPlateau(table, phaseFromId, phaseToId) {
  for (let record = 0; record < table.materialCount; record += 1) {
    const recordOffset = record * table.recordStrideFloats;
    if (table.records[recordOffset] !== waterId) continue;
    const segmentOffset = table.records[recordOffset + 1];
    const segmentCount = table.records[recordOffset + 2];
    for (let local = 0; local < segmentCount; local += 1) {
      const segmentIndex = segmentOffset + local;
      const offset = segmentIndex * table.segmentStrideFloats;
      if (
        Math.round(table.segments[offset + 1]) === 2
        && Math.round(table.segments[offset + 2]) === phaseFromId
        && Math.round(table.segments[offset + 3]) === phaseToId
      ) {
        return {
          segmentIndex,
          energyLoJPerKg: table.segments[offset + 4],
          energyHiJPerKg: table.segments[offset + 5]
        };
      }
    }
  }
  throw new Error(`H2O ${phaseFromId}->${phaseToId} plateau is unavailable`);
}

function waterFusionPlateau(table) {
  return waterPlateau(table, GPU_PHASE_IDS.solid, GPU_PHASE_IDS.liquid);
}

function waterVaporizationPlateau(table) {
  return waterPlateau(table, GPU_PHASE_IDS.liquid, GPU_PHASE_IDS.gas);
}

function totalInternalEnergyJ(particleState) {
  let total = 0;
  for (let index = 0; index < particleState.particleCount; index += 1) {
    const offset = index * SPH_GPU_PARTICLE_STATE_FLOATS;
    total += particleState.state[offset + 3] * particleState.state[offset + 7];
  }
  return total;
}

test('thermal reachable domain is distinct from current segment and fails closed on a broken response chain', () => {
  const table = buildSphThermalMaterialTable(materialProperties);
  const fusion = waterFusionPlateau(table);
  const initialEnergy = previousPositiveFloat32(fusion.energyLoJPerKg);

  const currentSegment = resolveThermalCarrierEnergyDomainFromTable(
    table,
    waterId,
    initialEnergy
  );
  const reachable = resolveThermalCarrierReachableEnergyDomainFromTable(
    table,
    waterId,
    initialEnergy
  );
  const neighborIntersection =
    resolveThermalCarrierEnergyDomainForTemperatureRangeFromTable(
      table,
      waterId,
      initialEnergy,
      250,
      300
    );

  assert.equal(currentSegment.ready, true);
  assert.equal(currentSegment.energyMaxJPerKg, fusion.energyLoJPerKg);
  assert.equal(reachable.ready, true);
  assert.equal(reachable.status, 'ready-contiguous-monotone-response-domain');
  assert.ok(reachable.energyMaxJPerKg > fusion.energyHiJPerKg);
  assert.ok(neighborIntersection.energyMaxJPerKg > fusion.energyLoJPerKg);
  assert.ok(neighborIntersection.energyMinJPerKg <= initialEnergy);

  const malformed = {
    ...table,
    segments: new Float32Array(table.segments)
  };
  const fusionOffset = fusion.segmentIndex * malformed.segmentStrideFloats;
  malformed.segments[fusionOffset + 4] = Math.fround(fusion.energyLoJPerKg + 1);
  const rejected = resolveThermalCarrierReachableEnergyDomainFromTable(
    malformed,
    waterId,
    initialEnergy
  );
  assert.equal(rejected.ready, false);
  assert.equal(rejected.status, 'disconnected-or-discontinuous-material-response');
  assert.equal(rejected.energyMinJPerKg, initialEnergy);
  assert.equal(rejected.energyMaxJPerKg, initialEnergy);
});

test('thermal reciprocal budgets cross the sensible-to-latent knot with simultaneous hot and cold neighbors', () => {
  const sourceTable = buildSphThermalMaterialTable(materialProperties);
  const thermalMaterialTable = {
    ...sourceTable,
    // Remove pair radiation so the manufactured result isolates reciprocal
    // conduction and its directional room scaling.
    records: new Float32Array(sourceTable.records)
  };
  for (let record = 0; record < thermalMaterialTable.materialCount; record += 1) {
    thermalMaterialTable.records[
      record * thermalMaterialTable.recordStrideFloats + 4
    ] = 0;
  }
  const fusion = waterFusionPlateau(thermalMaterialTable);
  const initialCenterEnergy = previousPositiveFloat32(fusion.energyLoJPerKg);
  const sphParticleState = buildSphGpuParticleBuffers(createSphState({
    smoothingLengthM: 0.1,
    dimension: 3,
    particles: [
      {
        id: 'one-ulp-below-fusion',
        material: 'h2o',
        x: [2, 2, 2],
        v: [0, 0, 0],
        massKg: 1,
        specificInternalEnergyJPerKg: initialCenterEnergy
      },
      {
        id: 'hot-neighbor',
        material: 'h2o',
        x: [2.08, 2, 2],
        v: [0, 0, 0],
        massKg: 1,
        specificInternalEnergyJPerKg:
          specificInternalEnergyJPerKg(materialProperties.h2o, 300)
      },
      {
        id: 'cold-neighbor',
        material: 'h2o',
        x: [1.92, 2, 2],
        v: [0, 0, 0],
        massKg: 1,
        specificInternalEnergyJPerKg:
          specificInternalEnergyJPerKg(materialProperties.h2o, 250)
      }
    ]
  }), { materialProperties });
  const beforeEnergyJ = totalInternalEnergyJ(sphParticleState);
  const result = runSphThermalStepCpu({
    sphParticleState,
    thermalMaterialTable,
    wallTemperaturesK: {},
    boxDimsM: [5, 5, 5],
    dtS: 1e12,
    conductionRate: 1e12,
    ambientTemperatureK: 0,
    wallRate: 0
  });
  const afterEnergyJ = totalInternalEnergyJ({
    ...sphParticleState,
    state: result.state
  });
  const nextCenterEnergy = result.state[7];

  // The old current-segment budget remained one f32 ULP below this knot: its
  // incoming room was scaled almost to zero while the cold-neighbor loss was
  // left live. The reachable-domain budget accepts the net positive reciprocal
  // exchange and enters, but does not traverse, the latent plateau.
  assert.ok(nextCenterEnergy > fusion.energyLoJPerKg);
  assert.ok(nextCenterEnergy < fusion.energyHiJPerKg);
  assert.ok(
    nextCenterEnergy < fusion.energyLoJPerKg
      + 0.05 * (fusion.energyHiJPerKg - fusion.energyLoJPerKg)
  );
  assert.ok(result.thermo[4] > 0);
  assert.ok(result.thermo[5] > 0);
  assert.ok(result.state[SPH_GPU_PARTICLE_STATE_FLOATS + 7]
    < sphParticleState.state[SPH_GPU_PARTICLE_STATE_FLOATS + 7]);
  assert.ok(result.state[2 * SPH_GPU_PARTICLE_STATE_FLOATS + 7]
    > sphParticleState.state[2 * SPH_GPU_PARTICLE_STATE_FLOATS + 7]);
  assert.ok(Math.abs(afterEnergyJ - beforeEnergyJ) <= 0.125);
  for (const value of result.state) assert.equal(Number.isFinite(value), true);
  for (const value of result.thermo) assert.equal(Number.isFinite(value), true);
});

test('hot open reservoir crosses one f32 ULP into an adjacent vaporization plateau', () => {
  const thermalMaterialTable = buildSphThermalMaterialTable(materialProperties);
  const vaporization = waterVaporizationPlateau(thermalMaterialTable);
  const initialEnergy = previousPositiveFloat32(vaporization.energyLoJPerKg);
  const currentDomain = resolveThermalCarrierEnergyDomainFromTable(
    thermalMaterialTable,
    waterId,
    initialEnergy
  );
  const reachableDomain = resolveThermalCarrierReachableEnergyDomainFromTable(
    thermalMaterialTable,
    waterId,
    initialEnergy
  );
  const acceptedDelta = clampOpenReservoirSpecificEnergyDeltaToEnergyDomain({
    dUSpecific: 1e6,
    sourceAnchorSpecificEnergyJPerKg: initialEnergy,
    pairAdjustedSpecificEnergyJPerKg: initialEnergy,
    energyDomain: currentDomain,
    reachableEnergyDomain: reachableDomain
  });
  assert.equal(
    initialEnergy + acceptedDelta,
    nextPositiveFloat32(vaporization.energyLoJPerKg)
  );

  const source = buildSphGpuParticleBuffers(createSphState({
    smoothingLengthM: 0.1,
    dimension: 3,
    particles: [{
      id: 'one-ulp-below-vaporization',
      material: 'h2o',
      x: [0.01, 2, 2],
      v: [0, 0, 0],
      massKg: 1,
      specificInternalEnergyJPerKg: initialEnergy
    }]
  }), { materialProperties });
  const first = runSphThermalStepCpu({
    sphParticleState: source,
    thermalMaterialTable,
    wallTemperaturesK: { xMin: 400 },
    boxDimsM: [5, 5, 5],
    dtS: 1,
    conductionRate: 0,
    ambientTemperatureK: 0,
    wallRate: 1e12,
    wallLayerM: 0.1
  });
  assert.equal(first.state[7], nextPositiveFloat32(vaporization.energyLoJPerKg));
  assert.ok(first.thermo[5] > 0);
  assert.ok(first.thermo[6] > 0);
  assert.equal(first.wallHeatJ.xMin, first.state[7] - source.state[7]);

  const second = runSphThermalStepCpu({
    sphParticleState: { ...source, state: first.state, thermo: first.thermo },
    thermalMaterialTable,
    wallTemperaturesK: { xMin: 400 },
    boxDimsM: [5, 5, 5],
    dtS: 1,
    conductionRate: 0,
    ambientTemperatureK: 0,
    wallRate: 1e12,
    wallLayerM: 0.1
  });
  assert.equal(second.state[7], nextPositiveFloat32(vaporization.energyHiJPerKg));
  assert.match(sphThermalStepWgsl, /canonical_thermal_open_reservoir_delta/);
  assert.match(sphThermalStepWgsl, /canonical_thermal_adjacent_f32/);
});

test('hot open reservoir preserves phase progress while reciprocal conduction cools the boundary carrier', () => {
  const thermalMaterialTable = buildSphThermalMaterialTable(materialProperties);
  const vaporization = waterVaporizationPlateau(thermalMaterialTable);
  const source = buildSphGpuParticleBuffers(createSphState({
    smoothingLengthM: 0.125,
    dimension: 3,
    particles: [
      {
        id: 'wall-carrier',
        material: 'h2o',
        x: [2, 0.1, 2],
        v: [0, 0, 0],
        massKg: 8,
        specificInternalEnergyJPerKg: previousPositiveFloat32(
          vaporization.energyLoJPerKg
        )
      },
      {
        id: 'cool-neighbor',
        material: 'h2o',
        x: [2, 0.25, 2],
        v: [0, 0, 0],
        massKg: 8,
        specificInternalEnergyJPerKg:
          specificInternalEnergyJPerKg(materialProperties.h2o, 350)
      }
    ]
  }), { materialProperties });
  const stepOptions = {
    thermalMaterialTable,
    wallTemperaturesK: { yMin: 400 },
    boxDimsM: [5, 5, 5],
    dtS: 5e-4,
    conductionRate: 1500,
    ambientTemperatureK: 0,
    wallRate: 60_000,
    wallLayerM: 0.25
  };
  const initialEnergyJ = totalInternalEnergyJ(source);
  const first = runSphThermalStepCpu({
    ...stepOptions,
    sphParticleState: source
  });
  const firstState = { ...source, state: first.state, thermo: first.thermo };
  const firstEnergyJ = totalInternalEnergyJ(firstState);
  assert.equal(first.state[7], nextPositiveFloat32(vaporization.energyLoJPerKg));
  assert.ok(first.thermo[6] > 0);
  assert.ok(Math.abs((firstEnergyJ - initialEnergyJ) - first.wallHeatJ.yMin) <= 0.5);

  const second = runSphThermalStepCpu({
    ...stepOptions,
    sphParticleState: firstState
  });
  const secondEnergyJ = totalInternalEnergyJ({
    ...source,
    state: second.state,
    thermo: second.thermo
  });
  assert.ok(
    second.state[7] > first.state[7] + 1,
    `expected latent progress beyond ${first.state[7]}, received ${second.state[7]}`
  );
  assert.ok(second.thermo[6] > first.thermo[6]);
  assert.ok(Math.abs((secondEnergyJ - firstEnergyJ) - second.wallHeatJ.yMin) <= 0.5);
});
