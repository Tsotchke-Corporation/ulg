import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSphState } from '../src/runtime/sph/sphState.js';
import { buoyancyAccelerationMPerS2, phaseMassWithSteam, thermalState, thermalStep } from '../src/runtime/sph/thermalPhase.js';
import { createReferenceMaterialClosures } from '../src/runtime/material/materialClosures.js';
import { specificInternalEnergyJPerKg } from '../src/runtime/material/thermoState.js';

const closures = createReferenceMaterialClosures();
const MP = { h2o: closures.h2o.properties, fe: closures.fe.properties, air: closures.air.properties };

function twoWaterParticles(tHotK, tColdK) {
  const uHot = specificInternalEnergyJPerKg(MP.h2o, tHotK);
  const uCold = specificInternalEnergyJPerKg(MP.h2o, tColdK);
  const state = createSphState({
    smoothingLengthM: 0.1, dimension: 3,
    particles: [
      { id: 'hot', material: 'h2o', x: [5, 5, 5], massKg: 1, specificInternalEnergyJPerKg: uHot },
      { id: 'cold', material: 'h2o', x: [5.08, 5, 5], massKg: 1, specificInternalEnergyJPerKg: uCold }
    ]
  });
  state.particles.forEach((p) => { p.material = 'h2o'; });
  return state;
}

test('conduction equilibrates neighbouring temperatures and conserves total energy', () => {
  const state = twoWaterParticles(330, 250);
  const energyBefore = state.particles.reduce((s, p) => s + p.massKg * p.specificInternalEnergyJPerKg, 0);
  const gapBefore = Math.abs(thermalState(state, MP)[0].temperatureK - thermalState(state, MP)[1].temperatureK);
  for (let i = 0; i < 200; i += 1) thermalStep(state, { materialProperties: MP, wallTemperaturesK: {}, boxEdgeM: 10, dtS: 1e-4, wallRate: 0 });
  const energyAfter = state.particles.reduce((s, p) => s + p.massKg * p.specificInternalEnergyJPerKg, 0);
  const gapAfter = Math.abs(thermalState(state, MP)[0].temperatureK - thermalState(state, MP)[1].temperatureK);
  assert.ok(gapAfter < gapBefore, `gap ${gapAfter} should be < ${gapBefore}`);
  assert.ok(Math.abs(energyAfter - energyBefore) / Math.abs(energyBefore) < 1e-9, 'conduction conserves total energy');
});

test('a wall drives a boundary particle toward the wall temperature', () => {
  const wallTemps = { xMin: 233.15, xMax: 233.15, yMin: 233.15, yMax: 233.15, zMin: 233.15, zMax: 233.15 };
  const u0 = specificInternalEnergyJPerKg(MP.h2o, 350);
  const state = createSphState({
    smoothingLengthM: 0.1, dimension: 3,
    particles: [{ id: 'w', material: 'h2o', x: [0.02, 5, 5], massKg: 1, specificInternalEnergyJPerKg: u0 }]
  });
  state.particles[0].material = 'h2o';
  let totalWallOut = 0;
  for (let i = 0; i < 100; i += 1) {
    const { wallHeatJ } = thermalStep(state, { materialProperties: MP, wallTemperaturesK: wallTemps, boxEdgeM: 10, dtS: 1e-4 });
    totalWallOut += wallHeatJ.xMin;
  }
  assert.ok(state.particles[0].specificInternalEnergyJPerKg < u0, 'particle cooled toward the cold wall');
  assert.ok(totalWallOut < 0, 'heat left the system into the cold wall (negative = out)');
  assert.ok(thermalState(state, MP)[0].temperatureK < 350);
});

test('water crosses latent-heat plateaus: ice -> liquid -> steam by energy', () => {
  assert.equal(thermalState({ particles: [{ material: 'h2o', specificInternalEnergyJPerKg: specificInternalEnergyJPerKg(MP.h2o, 250) }] }, MP)[0].phase, 'solid');
  assert.equal(thermalState({ particles: [{ material: 'h2o', specificInternalEnergyJPerKg: specificInternalEnergyJPerKg(MP.h2o, 300) }] }, MP)[0].phase, 'liquid');
  assert.equal(thermalState({ particles: [{ material: 'h2o', specificInternalEnergyJPerKg: specificInternalEnergyJPerKg(MP.h2o, 450) }] }, MP)[0].phase, 'gas');
});

test('steam (low-density gas water) is strongly buoyant; equal-density matter is not', () => {
  const steam = buoyancyAccelerationMPerS2(0.8, 1000); // gas vs liquid water
  const neutral = buoyancyAccelerationMPerS2(917, 917);
  assert.ok(steam > 100, `steam buoyancy ${steam} should be large and upward`);
  assert.ok(Math.abs(neutral) < 1e-9);
});

test('phase mass summary buckets vaporized water as steam', () => {
  const state = createSphState({
    smoothingLengthM: 0.1, dimension: 3,
    particles: [
      { id: 'ice', material: 'h2o', x: [1, 1, 1], massKg: 2, specificInternalEnergyJPerKg: specificInternalEnergyJPerKg(MP.h2o, 250) },
      { id: 'steam', material: 'h2o', x: [2, 2, 2], massKg: 3, specificInternalEnergyJPerKg: specificInternalEnergyJPerKg(MP.h2o, 450) }
    ]
  });
  state.particles.forEach((p) => { p.material = 'h2o'; });
  const summary = phaseMassWithSteam(state, MP);
  assert.equal(summary.waterIceMassKg, 2);
  assert.equal(summary.waterSteamMassKg, 3);
});
