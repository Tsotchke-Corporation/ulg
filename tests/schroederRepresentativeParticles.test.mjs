import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ULG_REPRESENTATIVE_PARTICLES_SCHEMA,
  buildRepresentativeParticlesStatus,
  executeRepresentativeParticleSplitAndBulkCoarsen,
  summarizeRepresentedEntityDistribution
} from '../src/runtime/sph/schroederRepresentativeParticleController.js';
import { createSphExactPhaseCarrierMassSkinWgsl } from '../src/runtime/sph/sphExactPhaseCarrierMassWgsl.js';
import { createSphExactPhaseCarrierPhysicalWgsl } from '../src/runtime/sph/sphExactPhaseCarrierPhysicalWgsl.js';
import { createSphExactMassFormat } from '../ulg-gpu-abi/src/sphExactMassInventory.js';

function invariantsOf(carriers) {
  let mass = 0;
  let px = 0, py = 0, pz = 0;
  let mx = 0, my = 0, mz = 0;
  let totalE = 0;
  let entities = 0;
  for (const c of carriers) {
    mass += c.massKg;
    px += c.massKg * c.velocity[0];
    py += c.massKg * c.velocity[1];
    pz += c.massKg * c.velocity[2];
    mx += c.massKg * c.position[0];
    my += c.massKg * c.position[1];
    mz += c.massKg * c.position[2];
    const v2 = c.velocity[0] ** 2 + c.velocity[1] ** 2 + c.velocity[2] ** 2;
    totalE += c.massKg * (c.specificInternalEnergyJPerKg + 0.5 * v2);
    entities += c.representedEntityCount;
  }
  return { mass, px, py, pz, mx, my, mz, totalE, entities };
}

test('exact 2^-149 Stefan skin-first mass and physical WGSL modules generate valid structure', () => {
  const format = createSphExactMassFormat({ wordCount: 8, quantumExponent: -149 });
  const massWgsl = createSphExactPhaseCarrierMassSkinWgsl(format);
  assert.match(massWgsl, /struct PcSkinShape/);
  assert.match(massWgsl, /pc_skin_scratch/);
  assert.match(massWgsl, /em_multiply_ratio/);
  assert.match(massWgsl, /em_subtract/);

  const physWgsl = createSphExactPhaseCarrierPhysicalWgsl(format);
  assert.match(physWgsl, /skin_front_enabled/);
  assert.match(physWgsl, /out_state\[row \* 2u\]\.xyz/);
});

test('representative-particle split + bulkCoarsen merge-back conserve mass, momentum, first moment, Galilean total energy, and entities', () => {
  const initialCarriers = [
    // Hot interface carrier -> MUST split into spare lineages!
    {
      lineage: 0, material: 'h2o', phase: 'gas', atInterface: true,
      temperatureK: 420, temperatureGradientKPerM: 1200,
      massKg: 2e-4, representedEntityCount: 6.68e21, restVolumeM3: 3e-4,
      position: [0.5, 0.5, 0.5], velocity: [0.3, 1.2, -0.1],
      specificInternalEnergyJPerKg: 2.6e6, cpJPerKgK: 2010
    },
    // Three quiescent homogeneous bulk steam carriers in one cell -> MUST bulkCoarsen and reclaim 2 spares!
    {
      lineage: 1, material: 'h2o', phase: 'gas', atInterface: false,
      temperatureK: 380, temperatureGradientKPerM: 20,
      massKg: 1e-4, representedEntityCount: 3.34e21, restVolumeM3: 1.5e-4,
      position: [0.21, 0.21, 0.21], velocity: [0.1, 0.4, 0.0],
      specificInternalEnergyJPerKg: 2.52e6, cpJPerKgK: 2010
    },
    {
      lineage: 2, material: 'h2o', phase: 'gas', atInterface: false,
      temperatureK: 384, temperatureGradientKPerM: 25,
      massKg: 1.2e-4, representedEntityCount: 4.008e21, restVolumeM3: 1.8e-4,
      position: [0.22, 0.215, 0.22], velocity: [0.2, 0.5, 0.05],
      specificInternalEnergyJPerKg: 2.528e6, cpJPerKgK: 2010
    },
    {
      lineage: 3, material: 'h2o', phase: 'gas', atInterface: false,
      temperatureK: 382, temperatureGradientKPerM: 15,
      massKg: 0.8e-4, representedEntityCount: 2.672e21, restVolumeM3: 1.2e-4,
      position: [0.215, 0.22, 0.215], velocity: [0.15, 0.45, -0.05],
      specificInternalEnergyJPerKg: 2.524e6, cpJPerKgK: 2010
    },
    // Heterogeneous pair in another cell (40 K temp spread > 15 K) -> MUST NOT merge!
    {
      lineage: 4, material: 'air', phase: 'gas', atInterface: false,
      temperatureK: 300, temperatureGradientKPerM: 10,
      massKg: 1e-4, representedEntityCount: 2.08e21, restVolumeM3: 8e-5,
      position: [0.81, 0.81, 0.81], velocity: [0.0, 0.0, 0.0],
      specificInternalEnergyJPerKg: 2.15e5, cpJPerKgK: 1005
    },
    {
      lineage: 5, material: 'air', phase: 'gas', atInterface: false,
      temperatureK: 350, temperatureGradientKPerM: 10,
      massKg: 1e-4, representedEntityCount: 2.08e21, restVolumeM3: 8e-5,
      position: [0.82, 0.81, 0.81], velocity: [0.0, 0.0, 0.0],
      specificInternalEnergyJPerKg: 2.65e5, cpJPerKgK: 1005
    }
  ];

  const before = invariantsOf(initialCarriers);
  const res = executeRepresentativeParticleSplitAndBulkCoarsen({
    carriers: initialCarriers,
    spareLineages: [100, 101, 102, 103],
    splitFactor: 2,
    bulkCoarsenCellSizeM: 0.05,
    bulkCoarsenTempSpanK: 15,
    bulkCoarsenSpeedSpanMPerS: 0.5
  });
  const after = invariantsOf(res.carriers);

  assert.equal(res.splitCount, 1);
  assert.equal(res.mergeCount, 1);
  assert.equal(res.reclaimedSpares, 2);
  // Started with 4 spares, used 1 for split, reclaimed 2 from bulkCoarsen -> 5 free spares!
  assert.equal(res.freeSpares.length, 5);
  // Heterogeneous air pair must remain unmerged (2 carriers).
  assert.equal(res.carriers.filter((c) => c.material === 'air').length, 2);

  // Conservation laws to floating-point machine precision:
  assert.ok(Math.abs(after.mass - before.mass) / before.mass < 1e-14);
  assert.ok(Math.abs(after.px - before.px) < 1e-16);
  assert.ok(Math.abs(after.py - before.py) < 1e-16);
  assert.ok(Math.abs(after.pz - before.pz) < 1e-16);
  assert.ok(Math.abs(after.mx - before.mx) < 1e-16);
  assert.ok(Math.abs(after.my - before.my) < 1e-16);
  assert.ok(Math.abs(after.mz - before.mz) < 1e-16);
  assert.ok(Math.abs(after.totalE - before.totalE) / before.totalE < 1e-14);
  assert.ok(Math.abs(after.entities - before.entities) / before.entities < 1e-14);
});

test('representative-particle telemetry summarizes representedEntityCount and spare reserve without readback', () => {
  const particleCount = 8;
  const state = new Float32Array(particleCount * 8);
  const thermo = new Float32Array(particleCount * 12);
  state[0 * 8 + 3] = 1e-4; thermo[0 * 12 + 9] = 1e21;
  state[1 * 8 + 3] = 2e-4; thermo[1 * 12 + 9] = 3e21;
  const stats = summarizeRepresentedEntityDistribution({ particleCount, state, thermo });
  assert.equal(stats.activeCarrierCount, 2);
  assert.equal(stats.minEntitiesPerCarrier, Math.fround(1e21));
  assert.equal(stats.maxEntitiesPerCarrier, Math.fround(3e21));
  assert.ok(Math.abs(stats.meanEntitiesPerCarrier - 2e21) / 2e21 < 1e-6);
  assert.ok(Math.abs(stats.totalRepresentedEntities - 4e21) / 4e21 < 1e-6);

  const status = buildRepresentativeParticlesStatus({
    phaseCarrierPlan: {
      lineageCapacity: 128,
      splitSpareReserve: { count: 64 }
    },
    entityStats: stats,
    phaseSlotRefinementEnabled: true,
    stefanExactSkinLedgerActive: true,
    splitCount: 3,
    bulkCoarsenMergeCount: 2,
    reclaimedSpareLineages: 4
  });
  assert.equal(status.schema, ULG_REPRESENTATIVE_PARTICLES_SCHEMA);
  assert.equal(status.spareLineageCapacity, 64);
  assert.equal(status.primaryLineageCount, 64);
  assert.equal(status.bulkCoarsenEnabled, true);
  assert.equal(status.stefanExactSkinLedgerActive, true);
  assert.equal(status.reclaimedSpareLineages, 4);
});
