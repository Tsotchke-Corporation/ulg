import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GPU_PHASE_IDS, stableOpticalMaterialId } from '../src/runtime/material/opticalGpuBuffers.js';
import { equilibriumFromSpecificEnergy } from '../src/runtime/material/phaseEquilibrium.js';
import { buildSphPhaseDemoState, createSphPhaseDemo } from '../src/runtime/sphPhaseDemo.js';
import { createSphState } from '../src/runtime/sph/sphState.js';
import {
  tagWebGpuBufferDevice,
  webGpuBufferDevice
} from '../src/runtime/sph/sphGpuDeviceIdentity.js';
import {
  SPH_GPU_PARTICLE_STATE_FLOATS,
  SPH_GPU_PARTICLE_STATUS,
  SPH_GPU_PARTICLE_THERMO_FLOATS,
  SPH_GPU_PARTICLE_IDENTITY_UINTS,
  SPH_GPU_RENDER_DOMAIN_ID_MAX,
  MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
  buildMlsMpmGpuParticleBuffers,
  buildSphGpuParticleBuffers,
  decodeMlsMpmGpuParticleRows,
  decodeSphGpuParticleRows,
  destroyMlsMpmGpuParticleBuffers,
  destroySphGpuParticleBuffers,
  mlsMpmGpuParticleUploadMatchesDevice,
  sphGpuParticleUploadMatchesDevice,
  uploadMlsMpmGpuParticleBuffers,
  uploadSphGpuParticleBuffers
} from '../src/runtime/sph/sphGpuBuffers.js';

function nearlyEqual(actual, expected, tolerance = 1e-3) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );
}

test('GPU buffer device provenance cannot be relabeled', () => {
  const buffer = {};
  const deviceA = {};
  const deviceB = {};
  tagWebGpuBufferDevice(buffer, deviceA);
  tagWebGpuBufferDevice(buffer, deviceB);
  assert.equal(webGpuBufferDevice(buffer), deviceA);
});

test('particle upload device matchers require their primary buffers', () => {
  const device = {};
  const optionalA = tagWebGpuBufferDevice({}, device);
  const optionalB = tagWebGpuBufferDevice({}, device);
  assert.equal(sphGpuParticleUploadMatchesDevice({
    status: 'webgpu-uploaded',
    materialPropertyBankWarmInputBuffer: optionalA,
    materialPropertyBankParticleSizeBuffer: optionalB
  }, device), false);
  assert.equal(mlsMpmGpuParticleUploadMatchesDevice({
    status: 'webgpu-uploaded',
    materialPropertyBankWarmInputBuffer: optionalA
  }, device), false);
});

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
  assert.equal(packed.identitySchema, ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA);
  assert.equal(packed.identity.length, packed.particleCount * SPH_GPU_PARTICLE_IDENTITY_UINTS);
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

test('SPH GPU particle identity rows preserve arbitrary body domains without using thermo lanes', () => {
  const state = createSphState({
    smoothingLengthM: 0.2,
    particles: [0, 1, 2, 3].map((index) => ({
      material: 'unknownium',
      x: [index, 0, 0],
      v: [0, 0, 0],
      massKg: 1,
      specificInternalEnergyJPerKg: 0
    }))
  });
  Object.assign(state.particles[0], {
    initialBodyId: 'left-water',
    initialBodyDomainId: 7,
    role: 'body:left-water'
  });
  Object.assign(state.particles[1], {
    initialBodyId: 'left-water',
    initialBodyDomainId: 7,
    role: 'body:left-water'
  });
  Object.assign(state.particles[2], {
    initialBodyId: 'right-water',
    initialBodyDomainId: 19,
    role: 'body:right-water'
  });
  state.particles[3].role = 'spare-product-slot';

  const packed = buildSphGpuParticleBuffers(state, { materialProperties: {} });
  const decoded = decodeSphGpuParticleRows(packed);

  assert.deepEqual([...packed.identity], [7, 7, 19, 0]);
  assert.deepEqual(packed.identityLayout, ['renderDomainId:u32']);
  assert.deepEqual(packed.renderDomainKeys, {
    7: 'left-water',
    19: 'right-water'
  });
  assert.deepEqual(decoded.map((row) => row.renderDomainId), [7, 7, 19, 0]);
  assert.deepEqual(decoded.map((row) => row.renderDomainKey), [
    'left-water',
    'left-water',
    'right-water',
    null
  ]);
  assert.equal(packed.thermo.length, 4 * SPH_GPU_PARTICLE_THERMO_FLOATS);
  assert.equal(packed.thermo[10], SPH_GPU_PARTICLE_STATUS.missingMaterialProperties);
});

test('SPH GPU particle identity rejects ids that would alias in f32 render rows', () => {
  const state = createSphState({
    smoothingLengthM: 0.2,
    particles: [{
      material: 'unknownium',
      x: [0, 0, 0],
      v: [0, 0, 0],
      massKg: 1,
      specificInternalEnergyJPerKg: 0
    }]
  });
  state.particles[0].initialBodyDomainId = SPH_GPU_RENDER_DOMAIN_ID_MAX + 1;
  assert.throws(
    () => buildSphGpuParticleBuffers(state, { materialProperties: {} }),
    /exceeds the exact GPU render range/
  );
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
    ['ulg-sph-particle-state', 'ulg-sph-particle-thermo', 'ulg-sph-particle-identity']
  );
  assert.equal(writes[0].byteLength, packed.state.byteLength);
  assert.equal(writes[1].byteLength, packed.thermo.byteLength);
  assert.equal(writes[2].byteLength, packed.identity.byteLength);
  assert.equal((writes[0].usage & 128) !== 0, true);
  assert.equal((writes[0].usage & 8) !== 0, true);
  assert.equal(sphGpuParticleUploadMatchesDevice(buffers, device), true);
  assert.equal(sphGpuParticleUploadMatchesDevice(buffers, { ...device }), false);

  destroySphGpuParticleBuffers(buffers);
  destroySphGpuParticleBuffers(buffers);
  assert.equal(sphGpuParticleUploadMatchesDevice(buffers, device), false);
  assert.deepEqual(destroyed, [
    'ulg-sph-particle-state',
    'ulg-sph-particle-thermo',
    'ulg-sph-particle-identity'
  ]);
});

test('SPH and MLS-MPM GPU uploads include material-bank warm and particle-size rows when supplied', () => {
  const demo = buildSphPhaseDemoState({ dropParticleEdge: 1, baseParticleEdge: 1 });
  const sphPacked = buildSphGpuParticleBuffers(demo.state, {
    materialProperties: demo.materialProperties,
    initialParticleSpacing: demo.initialParticleSpacing
  });
  const mlsPacked = buildMlsMpmGpuParticleBuffers(demo.state, {
    materialProperties: demo.materialProperties,
    initialParticleSpacing: demo.initialParticleSpacing
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

  assert.equal(sphPacked.materialPropertyBankWarmInputTable.rowCount, 1);
  assert.equal(sphPacked.materialPropertyBankParticleSizeTable.rowCount, 1);
  assert.equal(mlsPacked.materialPropertyBankWarmInputTable.rowCount, 1);
  assert.equal(mlsPacked.materialPropertyBankParticleSizeTable.rowCount, 1);
  assert.equal(
    mlsPacked.algorithmMaterialMlsMpmMechanicsRows.schema,
    'peercompute.ulg.algorithm-material-mls-mpm-mechanics-rows.v0'
  );
  assert.equal(mlsPacked.algorithmMaterialMlsMpmMechanicsRows.status, 'algorithm-derived-mls-mpm-mechanics-rows-ready');
  assert.equal(mlsPacked.algorithmMaterialMlsMpmMechanicsRows.rowCount, 2);
  const dropMechanicsRow = mlsPacked.algorithmMaterialMlsMpmMechanicsRows.rows.find((row) => row.role === 'drop');
  assert.equal(dropMechanicsRow.schema, 'peercompute.ulg.algorithm-material-mls-mpm-mechanics-row.v0');
  assert.equal(dropMechanicsRow.material, 'fe');
  assert.equal(dropMechanicsRow.particleInitializationRowStatus, 'algorithm-derived-particle-initialization-row-ready');
  assert.equal(dropMechanicsRow.particleRadiusPolicy, 'global-particle-volume-authoritative');
  assert.ok(dropMechanicsRow.particleCount > 0);
  assert.ok(dropMechanicsRow.restVolumeM3Mean > 0);
  assert.ok(dropMechanicsRow.soundSpeedMPerSMean > 0);
  assert.equal(
    mlsPacked.algorithmMaterialContactRows.schema,
    'peercompute.ulg.algorithm-material-contact-rows.v0'
  );
  assert.equal(mlsPacked.algorithmMaterialContactRows.status, 'algorithm-derived-contact-rows-ready');
  assert.equal(mlsPacked.algorithmMaterialContactRows.rowCount, 1);
  const contactRow = mlsPacked.algorithmMaterialContactRows.rows[0];
  assert.equal(contactRow.schema, 'peercompute.ulg.algorithm-material-contact-row.v0');
  assert.deepEqual(contactRow.roles, ['drop', 'base']);
  assert.ok(contactRow.normalStiffnessPa > 0);
  assert.ok(contactRow.supportRadiusM > 0);
  assert.equal(contactRow.forceMutationAuthority, 'not-authoritative-contact-policy-row');
  assert.equal(contactRow.impulsePolicy, 'bounded-by-softer-constituent-and-initial-support-radius');
  assert.equal(
    mlsPacked.algorithmMaterialSurfaceExtractionRows.schema,
    'peercompute.ulg.algorithm-material-surface-extraction-rows.v0'
  );
  assert.equal(
    mlsPacked.algorithmMaterialSurfaceExtractionRows.status,
    'algorithm-derived-surface-extraction-rows-ready'
  );
  assert.equal(mlsPacked.algorithmMaterialSurfaceExtractionRows.rowCount, 2);
  const dropSurfaceRow = mlsPacked.algorithmMaterialSurfaceExtractionRows.rows.find((row) => row.role === 'drop');
  assert.equal(dropSurfaceRow.schema, 'peercompute.ulg.algorithm-material-surface-extraction-row.v0');
  assert.equal(dropSurfaceRow.isovalue, 0.5);
  assert.equal(dropSurfaceRow.isovaluePolicy, 'density-kernel-half-occupancy');
  assert.ok(dropSurfaceRow.smoothingRadiusM > 0);
  assert.ok(dropSurfaceRow.voxelSizeM > 0);
  assert.equal(dropSurfaceRow.rendererAuthority, 'not-renderer-authoritative-surface-policy-row');

  const sodiumDemo = buildSphPhaseDemoState({
    dropMaterial: 'Na',
    baseMaterial: 'h2o',
    dropTemperatureK: 290,
    baseTemperatureK: 290,
    dropParticleEdge: 1,
    baseParticleEdge: 1
  });
  const sodiumMlsPacked = buildMlsMpmGpuParticleBuffers(sodiumDemo.state, {
    materialProperties: sodiumDemo.materialProperties,
    initialParticleSpacing: sodiumDemo.initialParticleSpacing
  });
  const sodiumDropRow = sodiumMlsPacked.algorithmMaterialMlsMpmMechanicsRows.rows.find((row) => row.role === 'drop');
  assert.equal(sodiumDropRow.material, 'Na');
  assert.equal(sodiumDropRow.crystalStructureKey, 'na-bcc-alpha');
  assert.equal(sodiumDropRow.crystalPackingFraction, 0.68);
  assert.equal(sodiumMlsPacked.algorithmMaterialContactRows.rows[0].crystalStructureKeys[0], 'na-bcc-alpha');
  const sodiumSurfaceRow = sodiumMlsPacked.algorithmMaterialSurfaceExtractionRows.rows.find((row) => row.role === 'drop');
  assert.equal(sodiumSurfaceRow.crystalStructureKey, 'na-bcc-alpha');
  assert.equal(sodiumSurfaceRow.crystalPackingFraction, 0.68);

  const sphBuffers = uploadSphGpuParticleBuffers(device, sphPacked);
  const mlsBuffers = uploadMlsMpmGpuParticleBuffers(device, mlsPacked);
  assert.deepEqual(
    writes.map((write) => write.label),
    [
      'ulg-sph-material-bank-warm-input-rows',
      'ulg-sph-material-bank-particle-size-rows',
      'ulg-sph-particle-state',
      'ulg-sph-particle-thermo',
      'ulg-sph-particle-identity',
      'ulg-mls-mpm-material-bank-warm-input-rows',
      'ulg-mls-mpm-material-bank-particle-size-rows',
      'ulg-mls-mpm-particle-mechanics'
    ]
  );
  assert.equal(sphBuffers.materialPropertyBankWarmInputRowCount, 1);
  assert.equal(sphBuffers.materialPropertyBankParticleSizeRowCount, 1);
  assert.equal(mlsBuffers.materialPropertyBankWarmInputRowCount, 1);
  assert.equal(mlsBuffers.materialPropertyBankParticleSizeRowCount, 1);

  destroySphGpuParticleBuffers(sphBuffers);
  destroyMlsMpmGpuParticleBuffers(mlsBuffers);
  assert.deepEqual(
    destroyed,
    [
      'ulg-sph-particle-state',
      'ulg-sph-particle-thermo',
      'ulg-sph-particle-identity',
      'ulg-sph-material-bank-warm-input-rows',
      'ulg-sph-material-bank-particle-size-rows',
      'ulg-mls-mpm-particle-mechanics',
      'ulg-mls-mpm-material-bank-warm-input-rows',
      'ulg-mls-mpm-material-bank-particle-size-rows'
    ]
  );
});

test('SPH GPU particle buffer destroy honors ownership flags for borrowed buffers', () => {
  const destroyed = [];
  const stateBuffer = { destroy: () => destroyed.push('state') };
  const thermoBuffer = { destroy: () => destroyed.push('thermo') };

  destroySphGpuParticleBuffers({
    stateBuffer,
    thermoBuffer,
    ownsStateBuffer: true,
    ownsThermoBuffer: false
  });
  assert.deepEqual(destroyed, ['state']);

  destroySphGpuParticleBuffers({
    stateBuffer,
    thermoBuffer,
    ownsStateBuffer: false,
    ownsThermoBuffer: true
  });
  assert.deepEqual(destroyed, ['state', 'thermo']);
});

test('MLS-MPM GPU mechanics buffer packs identity mechanics before the first step', () => {
  const demo = buildSphPhaseDemoState({ dropParticleEdge: 1, baseParticleEdge: 1 });
  const packed = buildMlsMpmGpuParticleBuffers(demo.state, {
    materialProperties: demo.materialProperties,
    viscosityEnabled: true,
    mlsMpmArtificialViscosityAlpha: 0.04,
    viscosityLengthM: demo.state.smoothingLengthM
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
  assert.equal(h2o.dynamicViscosityPaS, 0);
  assert.equal(h2o.surfaceTensionNPerM, 0);
  assert.ok(h2o.phaseVolumeReferenceMassKg > 0);
  // This lane is the PHYSICAL shear viscosity. It preserves a closure/reference
  // bank value when one exists (the Fe liquid reference is 0.006 Pa.s); the
  // artificial alpha*rho*c*h term is no longer folded in here, because this
  // lane drives a traceless deviatoric stress and so acted only against shear.
  // Artificial viscosity is applied in P2G as a compression-gated bulk
  // pressure instead, from packed.mlsMpmArtificialViscosityAlpha below.
  nearlyEqual(fe.dynamicViscosityPaS, Math.fround(0.006), 1e-9);
  assert.equal(fe.surfaceTensionNPerM, 0);
  assert.ok(fe.phaseVolumeReferenceMassKg > 0);
  assert.ok(packed.viscosityEnabled);
  assert.ok(packed.mlsMpmArtificialViscosityAlpha > 0);
  assert.ok(packed.viscosityLengthM > 0);
});

test('MLS-MPM GPU mechanics buffer packs SS phase-volume reference mass for vapor', () => {
  const demo = buildSphPhaseDemoState({
    dropMaterial: 'h2o',
    baseMaterial: 'h2o',
    dropTemperatureK: 650,
    baseTemperatureK: 300,
    iceBaseHeightM: 0,
    ironBaseHeightM: 1,
    dropParticleEdge: 2,
    baseParticleEdge: 2
  });
  const packed = buildMlsMpmGpuParticleBuffers(demo.state, {
    materialProperties: demo.materialProperties
  });
  const rows = decodeMlsMpmGpuParticleRows(packed);
  const dropIndex = demo.state.particles.findIndex((particle) => particle.role === 'drop');
  const dropParticle = demo.state.particles[dropIndex];
  const dropRow = rows[dropIndex];

  assert.equal(dropRow.metadata.phase, 'gas');
  assert.ok(dropParticle.phaseVolumeReferenceMassKg > dropParticle.massKg);
  nearlyEqual(
    dropRow.phaseVolumeReferenceMassKg,
    dropParticle.phaseVolumeReferenceMassKg,
    dropParticle.phaseVolumeReferenceMassKg * 1e-6
  );
  assert.ok(dropRow.phaseVolumeReferenceMassKg / dropParticle.massKg > 100);
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
  assert.equal(mlsMpmGpuParticleUploadMatchesDevice(buffers, device), true);
  assert.equal(mlsMpmGpuParticleUploadMatchesDevice(buffers, { ...device }), false);

  destroyMlsMpmGpuParticleBuffers(buffers);
  destroyMlsMpmGpuParticleBuffers(buffers);
  assert.equal(mlsMpmGpuParticleUploadMatchesDevice(buffers, device), false);
  assert.deepEqual(destroyed, ['ulg-mls-mpm-particle-mechanics']);
});

test('MLS-MPM GPU mechanics destroy honors borrowed-buffer ownership', () => {
  const destroyed = [];
  const mechanicsBuffer = { destroy: () => destroyed.push('mechanics') };

  destroyMlsMpmGpuParticleBuffers({
    mechanicsBuffer,
    ownsMechanicsBuffer: false
  });
  assert.deepEqual(destroyed, []);

  destroyMlsMpmGpuParticleBuffers({
    mechanicsBuffer,
    ownsMechanicsBuffer: true
  });
  assert.deepEqual(destroyed, ['mechanics']);
});
