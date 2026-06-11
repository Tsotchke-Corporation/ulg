import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GPU_PHASE_IDS, stableOpticalMaterialId } from '../src/runtime/material/opticalGpuBuffers.js';
import { equilibriumFromSpecificEnergy } from '../src/runtime/material/phaseEquilibrium.js';
import { buildSphPhaseDemoState, createSphPhaseDemo } from '../src/runtime/sphPhaseDemo.js';
import { createSphState } from '../src/runtime/sph/sphState.js';
import {
  SPH_GPU_PARTICLE_STATE_FLOATS,
  SPH_GPU_PARTICLE_STATUS,
  SPH_GPU_PARTICLE_THERMO_FLOATS,
  MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  buildMlsMpmGpuParticleBuffers,
  buildSphGpuParticleBuffers,
  decodeMlsMpmGpuParticleRows,
  decodeSphGpuParticleRows,
  destroyMlsMpmGpuParticleBuffers,
  destroySphGpuParticleBuffers,
  uploadMlsMpmGpuParticleBuffers,
  uploadSphGpuParticleBuffers
} from '../src/runtime/sph/sphGpuBuffers.js';

function nearlyEqual(actual, expected, tolerance = 1e-3) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );
}

test('SPH GPU particle buffers pack CPU-authoritative particle state', () => {
  const demo = buildSphPhaseDemoState();
  const packed = buildSphGpuParticleBuffers(demo.state, {
    materialProperties: demo.materialProperties
  });
  const rows = decodeSphGpuParticleRows(packed);
  const first = demo.state.particles[0];

  assert.equal(packed.schema, ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA);
  assert.equal(packed.status, 'cpu-derived-gpu-buffer-ready');
  assert.equal(packed.particleCount, demo.state.particles.length);
  assert.equal(packed.state.length, packed.particleCount * SPH_GPU_PARTICLE_STATE_FLOATS);
  assert.equal(packed.thermo.length, packed.particleCount * SPH_GPU_PARTICLE_THERMO_FLOATS);
  nearlyEqual(rows[0].positionM[0], first.x[0]);
  nearlyEqual(rows[0].positionM[1], first.x[1]);
  nearlyEqual(rows[0].positionM[2], first.x[2]);
  nearlyEqual(rows[0].massKg, first.massKg);
  nearlyEqual(rows[0].velocityMPerS[0], first.v[0]);
  nearlyEqual(rows[0].specificInternalEnergyJPerKg, first.specificInternalEnergyJPerKg, 1);
  assert.equal(packed.scientificValidation, false);
  assert.equal(packed.sphValidation, false);
  assert.equal(packed.phaseChangeValidation, false);
});

test('SPH GPU particle buffers derive material ids, phase ids, and temperature from closures', () => {
  const demo = buildSphPhaseDemoState();
  demo.state.particles[0].temperatureK = 9999;
  const packed = buildSphGpuParticleBuffers(demo.state, {
    materialProperties: demo.materialProperties
  });
  const rows = decodeSphGpuParticleRows(packed);
  const h2o = rows.find((row) => row.metadata.material === 'h2o');
  const fe = rows.find((row) => row.metadata.material === 'fe');
  const h2oParticle = demo.state.particles.find((particle) => particle.material === 'h2o');
  const feParticle = demo.state.particles.find((particle) => particle.material === 'fe');
  const h2oEq = equilibriumFromSpecificEnergy(
    demo.materialProperties.h2o,
    h2oParticle.specificInternalEnergyJPerKg
  );
  const feEq = equilibriumFromSpecificEnergy(
    demo.materialProperties.fe,
    feParticle.specificInternalEnergyJPerKg
  );

  assert.equal(fe.materialId, 26);
  assert.equal(h2o.materialId, stableOpticalMaterialId('h2o'));
  assert.equal(h2o.phaseId, GPU_PHASE_IDS.solid);
  assert.equal(fe.phaseId, GPU_PHASE_IDS.liquid);
  nearlyEqual(h2o.temperatureK, h2oEq.temperatureK);
  nearlyEqual(fe.temperatureK, feEq.temperatureK);
  nearlyEqual(Object.values(h2o.phaseFractions).reduce((sum, value) => sum + value, 0), 1);
  nearlyEqual(Object.values(fe.phaseFractions).reduce((sum, value) => sum + value, 0), 1);
  assert.equal(h2o.status, SPH_GPU_PARTICLE_STATUS.ready);
  assert.equal(fe.status, SPH_GPU_PARTICLE_STATUS.ready);
  assert.ok(h2o.representedEntityCount > 1e20);
});

test('SPH GPU particle buffers mark missing material properties without faking phase data', () => {
  const state = createSphState({
    smoothingLengthM: 0.2,
    particles: [{
      material: 'unknownium',
      x: [0, 0, 0],
      v: [0, 0, 0],
      massKg: 1,
      specificInternalEnergyJPerKg: 42
    }]
  });
  const packed = buildSphGpuParticleBuffers(state, { materialProperties: {} });
  const [row] = decodeSphGpuParticleRows(packed);

  assert.equal(row.materialId, 0);
  assert.equal(row.phaseId, GPU_PHASE_IDS.unknown);
  assert.equal(row.temperatureK, 0);
  assert.equal(row.status, SPH_GPU_PARTICLE_STATUS.missingMaterialProperties);
  assert.equal(row.representedEntityCount, 0);
});

test('SPH GPU particle buffer upload writes state and thermo storage buffers', () => {
  const demo = buildSphPhaseDemoState({ dropParticleEdge: 1, baseParticleEdge: 1 });
  const packed = buildSphGpuParticleBuffers(demo.state, {
    materialProperties: demo.materialProperties
  });
  const writes = [];
  const destroyed = [];
  const device = {
    createBuffer(descriptor) {
      return {
        ...descriptor,
        destroy() {
          destroyed.push(descriptor.label);
        }
      };
    },
    queue: {
      writeBuffer(buffer, offset, data) {
        writes.push({ label: buffer.label, offset, byteLength: data.byteLength, usage: buffer.usage });
      }
    }
  };

  const buffers = uploadSphGpuParticleBuffers(device, packed);
  assert.equal(buffers.schema, ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA);
  assert.equal(buffers.status, 'webgpu-uploaded');
  assert.equal(buffers.particleCount, packed.particleCount);
  assert.deepEqual(
    writes.map((write) => write.label),
    ['ulg-sph-particle-state', 'ulg-sph-particle-thermo']
  );
  assert.equal(writes[0].byteLength, packed.state.byteLength);
  assert.equal(writes[1].byteLength, packed.thermo.byteLength);
  assert.equal((writes[0].usage & 128) !== 0, true);
  assert.equal((writes[0].usage & 8) !== 0, true);

  destroySphGpuParticleBuffers(buffers);
  assert.deepEqual(destroyed, ['ulg-sph-particle-state', 'ulg-sph-particle-thermo']);
});

test('MLS-MPM GPU mechanics buffer packs identity mechanics before the first step', () => {
  const demo = buildSphPhaseDemoState({ dropParticleEdge: 1, baseParticleEdge: 1 });
  const packed = buildMlsMpmGpuParticleBuffers(demo.state, {
    materialProperties: demo.materialProperties
  });
  const rows = decodeMlsMpmGpuParticleRows(packed);
  const h2o = rows.find((row) => row.metadata.material === 'h2o');
  const fe = rows.find((row) => row.metadata.material === 'fe');

  assert.equal(packed.schema, ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA);
  assert.equal(packed.particleCount, demo.state.particles.length);
  assert.equal(packed.mechanics.length, packed.particleCount * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS);
  assert.deepEqual(h2o.deformationF, [1, 0, 0, 0, 1, 0, 0, 0, 1]);
  assert.deepEqual(h2o.affineC, [0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(h2o.volumeRatioJ, 1);
  assert.ok(h2o.restVolumeM3 > 0);
  assert.equal(h2o.solidFlag, 1);
  assert.ok(h2o.effectiveBulkModulusPa > 0);
  assert.ok(h2o.shearModulusPa > 0);
  assert.ok(h2o.lameLambdaPa > 0);
  assert.ok(h2o.soundSpeedMPerS > 0);
  assert.equal(h2o.eosModelId, 1);
  assert.equal(fe.solidFlag, 0);
  assert.ok(fe.effectiveBulkModulusPa > 0);
  assert.equal(fe.shearModulusPa, 0);
  assert.equal(fe.lameLambdaPa, 0);
  assert.ok(fe.soundSpeedMPerS > 0);
  assert.equal(fe.eosModelId, 1);
});

test('MLS-MPM GPU mechanics buffer preserves carrier-updated F, C, J, and V0', () => {
  // Use the public demo driver for one real MLS-MPM mechanics step so the fields come from the
  // carrier, not a hand-written fixture.
  const demoDriver = createSphPhaseDemo({ dropParticleEdge: 1, baseParticleEdge: 1 });
  demoDriver.step();
  const particle = demoDriver.demo.state.particles.find((candidate) => candidate.mpmF !== undefined);
  const packed = buildMlsMpmGpuParticleBuffers(demoDriver.demo.state, {
    materialProperties: demoDriver.demo.materialProperties
  });
  const row = decodeMlsMpmGpuParticleRows(packed).find((candidate) => candidate.metadata.id === particle.id);

  assert.ok(demoDriver.demo.state.particles.length > 0);
  assert.deepEqual(row.deformationF.map((value) => Number.isFinite(value)), new Array(9).fill(true));
  assert.deepEqual(row.affineC.map((value) => Number.isFinite(value)), new Array(9).fill(true));
  nearlyEqual(row.volumeRatioJ, particle.mpmJ, 1e-5);
  nearlyEqual(row.restVolumeM3, particle.mpmVolume0, 1e-7);
  assert.equal(row.status, SPH_GPU_PARTICLE_STATUS.ready);
  assert.equal(row.constitutiveStatus, SPH_GPU_PARTICLE_STATUS.ready);
  assert.ok(row.soundSpeedMPerS > 0);
});

test('MLS-MPM GPU mechanics buffer upload writes and destroys storage buffers', () => {
  const demo = buildSphPhaseDemoState({ dropParticleEdge: 1, baseParticleEdge: 1 });
  const packed = buildMlsMpmGpuParticleBuffers(demo.state, {
    materialProperties: demo.materialProperties
  });
  const writes = [];
  const destroyed = [];
  const device = {
    createBuffer(descriptor) {
      return {
        ...descriptor,
        destroy() {
          destroyed.push(descriptor.label);
        }
      };
    },
    queue: {
      writeBuffer(buffer, offset, data) {
        writes.push({ label: buffer.label, offset, byteLength: data.byteLength, usage: buffer.usage });
      }
    }
  };

  const buffers = uploadMlsMpmGpuParticleBuffers(device, packed);
  assert.equal(buffers.schema, ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA);
  assert.equal(buffers.status, 'webgpu-uploaded');
  assert.deepEqual(writes.map((write) => write.label), ['ulg-mls-mpm-particle-mechanics']);
  assert.equal(writes[0].byteLength, packed.mechanics.byteLength);
  assert.equal((writes[0].usage & 128) !== 0, true);
  assert.equal((writes[0].usage & 8) !== 0, true);

  destroyMlsMpmGpuParticleBuffers(buffers);
  assert.deepEqual(destroyed, ['ulg-mls-mpm-particle-mechanics']);
});
