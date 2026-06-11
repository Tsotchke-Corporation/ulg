import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GPU_PHASE_IDS, stableOpticalMaterialId } from '../src/runtime/material/opticalGpuBuffers.js';
import { equilibriumFromSpecificEnergy } from '../src/runtime/material/phaseEquilibrium.js';
import { buildSphPhaseDemoState } from '../src/runtime/sphPhaseDemo.js';
import { createSphState } from '../src/runtime/sph/sphState.js';
import {
  SPH_GPU_PARTICLE_STATE_FLOATS,
  SPH_GPU_PARTICLE_STATUS,
  SPH_GPU_PARTICLE_THERMO_FLOATS,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  buildSphGpuParticleBuffers,
  decodeSphGpuParticleRows,
  destroySphGpuParticleBuffers,
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
