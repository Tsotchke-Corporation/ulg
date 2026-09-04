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
  beginSphDispersedMediumGpuBufferBorrow,
  buildSphDispersedMediumGpuBuffers,
  destroySphDispersedMediumGpuBuffers,
  snapshotSphDispersedMediumGpuBufferDeclaration,
  sphDispersedMediumGpuBufferParticleSourceFamilyMatches,
  validateSphDispersedMediumGpuBufferAuthority
} from '../src/runtime/sph/sphDispersedMediumGpuBuffers.js';
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
  ensureSphGpuParticleBufferSetBorrowLifecycle,
  mlsMpmGpuParticleUploadMatchesDevice,
  registerTopologyStableSphDispersedMediumOpticsSourceFamilyContinuation,
  runSphGpuParticleBufferSetCleanupAfterBorrows,
  sphGpuParticleStateHasGasCandidateIndication,
  sphGpuParticleUploadAdvertisesDispersedMediumOptics,
  sphGpuParticleUploadDispersedMediumOpticsMatchesSourceBuffers,
  sphGpuParticleUploadMatchesDevice,
  transferSphGpuParticleBufferSetDispersedMediumOpticsOwnership,
  uploadMlsMpmGpuParticleBuffers,
  uploadSphGpuParticleBuffers,
  uploadSphGpuParticleDispersedMediumOpticsSidecar
} from '../src/runtime/sph/sphGpuBuffers.js';

function nearlyEqual(actual, expected, tolerance = 1e-3) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );
}

function createTopologyStableOpticsContinuationFixture() {
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
  state.particles[0].dispersedMediumOptics = {
    dispersedMaterialId: 7,
    dispersedPhaseId: 3,
    opticalStateId: 11,
    dispersedMassKg: 0.02,
    scatteringCrossSectionM2: 0.5,
    absorptionCrossSectionM2: 0.125,
    scatteringAsymmetryCrossSectionM2: 0.375
  };
  const packed = buildSphGpuParticleBuffers(state, { materialProperties: {} });
  const device = {
    createBuffer(descriptor) {
      const mappedBytes = descriptor.mappedAtCreation
        ? new ArrayBuffer(descriptor.size)
        : null;
      return {
        ...descriptor,
        getMappedRange() { return mappedBytes; },
        unmap() {},
        destroyCount: 0,
        destroy() { this.destroyCount += 1; }
      };
    },
    queue: { writeBuffer() {} }
  };
  const sourceSphUpload = uploadSphGpuParticleBuffers(device, packed);
  const transientBuffer = (label, targetDevice = device) => (
    tagWebGpuBufferDevice({ label }, targetDevice)
  );
  const sourceFamily = (stateBuffer, thermoBuffer) => ({
    particleCount: sourceSphUpload.particleCount,
    topologyEpoch: sourceSphUpload.topologyEpoch,
    identityRevision: sourceSphUpload.identityRevision,
    identityBuffer: sourceSphUpload.identityBuffer,
    stateBuffer,
    thermoBuffer
  });
  const register = ({
    sourceStateBuffer,
    sourceThermoBuffer,
    targetStateBuffer,
    targetThermoBuffer,
    source = sourceSphUpload,
    targetDevice = device
  }) => registerTopologyStableSphDispersedMediumOpticsSourceFamilyContinuation({
    sourceSphUpload: source,
    device: targetDevice,
    sourceStateBuffer,
    sourceThermoBuffer,
    targetStateBuffer,
    targetThermoBuffer
  });
  return {
    device,
    sourceSphUpload,
    child: sourceSphUpload.dispersedMediumOptics,
    transientBuffer,
    sourceFamily,
    register
  };
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

test('SPH sidecar presence treats only exact numeric zero scalars as absent', () => {
  const scalarFields = [
    'dispersedMediumOpticsRowCount',
    'dispersedMediumOpticsRowStrideFloats',
    'dispersedMediumOpticsBufferByteLength'
  ];
  for (const field of scalarFields) {
    for (const absentValue of [0, -0]) {
      assert.equal(
        sphGpuParticleUploadAdvertisesDispersedMediumOptics({
          [field]: absentValue
        }),
        false,
        `${field}=${String(absentValue)} must remain canonical absence`
      );
    }
    for (const advertisedValue of ['0', false, '', Number.NaN, 1]) {
      assert.equal(
        sphGpuParticleUploadAdvertisesDispersedMediumOptics({
          [field]: advertisedValue
        }),
        true,
        `${field}=${String(advertisedValue)} must advertise a malformed singleton`
      );
    }
  }
  assert.equal(
    sphGpuParticleUploadAdvertisesDispersedMediumOptics({
      ownsDispersedMediumOpticsBuffer: false
    }),
    false
  );
  assert.equal(
    sphGpuParticleUploadAdvertisesDispersedMediumOptics({
      ownsDispersedMediumOpticsBuffer: true
    }),
    true
  );
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
  assert.equal(packed.dispersedMediumOptics, null);
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

test('GPU particle buffers distinguish dormant reaction-product and phase-companion slots', () => {
  const demo = buildSphPhaseDemoState();
  const sphPacked = buildSphGpuParticleBuffers(demo.state, {
    materialProperties: demo.materialProperties
  });
  const mlsPacked = buildMlsMpmGpuParticleBuffers(demo.state, {
    materialProperties: demo.materialProperties
  });
  const sphRows = decodeSphGpuParticleRows(sphPacked);
  const mlsRows = decodeMlsMpmGpuParticleRows(mlsPacked);
  const productSlotIndex = demo.state.particles.findIndex(
    (particle) => particle.spareProductSlot === true
      && particle.phaseCompanionSlot !== true
  );
  const phaseSlotIndex = demo.state.particles.findIndex(
    (particle) => particle.phaseCompanionSlot === true
  );

  assert.ok(productSlotIndex >= 0);
  assert.ok(phaseSlotIndex >= 0);
  assert.equal(sphRows[productSlotIndex].massKg, 0);
  assert.equal(
    sphRows[productSlotIndex].status,
    SPH_GPU_PARTICLE_STATUS.reactionProductReserved
  );
  assert.equal(
    mlsRows[productSlotIndex].status,
    SPH_GPU_PARTICLE_STATUS.reactionProductReserved
  );
  assert.equal(sphRows[phaseSlotIndex].massKg, 0);
  assert.equal(
    sphRows[phaseSlotIndex].status,
    SPH_GPU_PARTICLE_STATUS.phaseCompanionReserved
  );
  assert.equal(
    mlsRows[phaseSlotIndex].status,
    SPH_GPU_PARTICLE_STATUS.phaseCompanionReserved
  );
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

test('SPH gas candidate indication keeps liquid prefixes inert and admits gas or malformed gas rows', () => {
  const packed = {
    schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
    particleCount: 2,
    state: new Float32Array(2 * SPH_GPU_PARTICLE_STATE_FLOATS),
    thermo: new Float32Array(2 * SPH_GPU_PARTICLE_THERMO_FLOATS)
  };
  for (let index = 0; index < packed.particleCount; index += 1) {
    const stateOffset = index * SPH_GPU_PARTICLE_STATE_FLOATS;
    const thermoOffset = index * SPH_GPU_PARTICLE_THERMO_FLOATS;
    packed.state[stateOffset + 3] = 1;
    packed.thermo[thermoOffset + 1] = GPU_PHASE_IDS.liquid;
    packed.thermo[thermoOffset + 5] = 1;
    packed.thermo[thermoOffset + 10] = SPH_GPU_PARTICLE_STATUS.ready;
  }
  assert.equal(sphGpuParticleStateHasGasCandidateIndication(packed), false);

  packed.thermo[1] = GPU_PHASE_IDS.gas;
  packed.thermo[5] = 0;
  packed.thermo[6] = 1;
  assert.equal(sphGpuParticleStateHasGasCandidateIndication(packed), true);

  packed.thermo[1] = GPU_PHASE_IDS.liquid;
  assert.equal(
    sphGpuParticleStateHasGasCandidateIndication(packed),
    true,
    'a contradictory gas fraction must reach the fail-closed classifier'
  );
});

test('SPH gas candidate indication ignores zero-inventory gas rows regardless of status', () => {
  const packed = {
    schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
    particleCount: 1,
    state: new Float32Array(SPH_GPU_PARTICLE_STATE_FLOATS),
    thermo: new Float32Array(SPH_GPU_PARTICLE_THERMO_FLOATS)
  };
  packed.thermo[1] = GPU_PHASE_IDS.gas;
  packed.thermo[6] = 1;
  packed.thermo[10] = SPH_GPU_PARTICLE_STATUS.reactionProductReserved;
  assert.equal(sphGpuParticleStateHasGasCandidateIndication(packed), false);

  packed.thermo[10] = SPH_GPU_PARTICLE_STATUS.phaseCompanionReserved;
  assert.equal(sphGpuParticleStateHasGasCandidateIndication(packed), false);

  packed.thermo[10] = SPH_GPU_PARTICLE_STATUS.ready;
  assert.equal(sphGpuParticleStateHasGasCandidateIndication(packed), false);

  packed.state[3] = 1;
  assert.equal(
    sphGpuParticleStateHasGasCandidateIndication(packed),
    true,
    'a positive-mass gas row must still reach exact validation'
  );
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
      const mappedBytes = descriptor.mappedAtCreation
        ? new ArrayBuffer(descriptor.size)
        : null;
      const buffer = {
        ...descriptor,
        getMappedRange() { return mappedBytes; },
        unmap() {
          if (mappedBytes) {
            writes.push({
              label: descriptor.label,
              offset: 0,
              byteLength: mappedBytes.byteLength
            });
          }
        },
        destroy() {
          destroyed.push(descriptor.label);
        }
      };
      return buffer;
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
  assert.equal(buffers.dispersedMediumOptics, null);
  assert.equal(buffers.dispersedMediumOpticsAuthority, null);
  assert.equal(buffers.dispersedMediumOpticsBuffer, null);
  assert.equal(buffers.dispersedMediumOpticsRowCount, 0);
  assert.equal(buffers.dispersedMediumOpticsRowStrideFloats, 0);
  assert.equal(buffers.dispersedMediumOpticsBufferByteLength, 0);
  assert.equal(buffers.ownsDispersedMediumOpticsBuffer, false);
  assert.equal(sphGpuParticleUploadMatchesDevice(buffers, device), true);
  assert.equal(sphGpuParticleUploadMatchesDevice(buffers, { ...device }), false);
  const malformedScalarSingletons = [
    'dispersedMediumOpticsRowCount',
    'dispersedMediumOpticsRowStrideFloats',
    'dispersedMediumOpticsBufferByteLength'
  ].flatMap((key) => ['0', false, '', Number.NaN, 1].map(
    (value) => [key, value]
  ));
  for (const [key, value] of [
    ['dispersedMediumOptics', {}],
    ['dispersedMediumOpticsAuthority', {}],
    ['dispersedMediumOpticsBuffer', {}],
    ...malformedScalarSingletons,
    ['ownsDispersedMediumOpticsBuffer', true]
  ]) {
    const prior = buffers[key];
    buffers[key] = value;
    assert.equal(
      sphGpuParticleUploadMatchesDevice(buffers, device),
      false,
      `singleton ${key}=${String(value)} must fail closed`
    );
    buffers[key] = prior;
  }

  for (const field of ['stateBuffer', 'thermoBuffer', 'identityBuffer']) {
    const replacement = tagWebGpuBufferDevice({
      destroy() { destroyed.push(`replacement-${field}`); }
    }, device);
    buffers[field] = replacement;
  }
  assert.equal(
    sphGpuParticleUploadMatchesDevice(buffers, device),
    false,
    'public core aliases may not replace the privately admitted family'
  );

  const borrowDescriptor = Object.getOwnPropertyDescriptor(
    buffers,
    '__ulgActiveBorrowCount'
  );
  assert.equal(borrowDescriptor.enumerable, false);
  assert.equal(buffers.__ulgActiveBorrowCount, 0);
  let deferredCleanupCount = 0;
  buffers.__ulgActiveBorrowCount = 1;
  assert.equal(
    runSphGpuParticleBufferSetCleanupAfterBorrows(
      buffers,
      () => { deferredCleanupCount += 1; }
    ),
    true
  );
  assert.equal(deferredCleanupCount, 0);
  buffers.__ulgActiveBorrowCount = 0;
  assert.equal(deferredCleanupCount, 1);
  buffers.__ulgActiveBorrowCount = 1;
  assert.equal(destroySphGpuParticleBuffers(buffers), false);
  assert.equal(buffers.destroyed, undefined);
  assert.deepEqual(destroyed, []);
  buffers.__ulgActiveBorrowCount = 0;
  assert.equal(destroySphGpuParticleBuffers(buffers), false);
  assert.equal(sphGpuParticleUploadMatchesDevice(buffers, device), false);
  assert.deepEqual(destroyed, [
    'ulg-sph-particle-state',
    'ulg-sph-particle-thermo',
    'ulg-sph-particle-identity'
  ]);
});

test('SPH GPU particle buffers own and authenticate an optional dispersed-medium sidecar', () => {
  const state = createSphState({
    smoothingLengthM: 0.2,
    particles: [0, 1].map((index) => ({
      material: 'unknownium',
      x: [index, 0, 0],
      v: [0, 0, 0],
      massKg: 1,
      specificInternalEnergyJPerKg: 0
    }))
  });
  state.particles[0].dispersedMediumOptics = {
    dispersedMaterialId: 7,
    dispersedPhaseId: 3,
    opticalStateId: 11,
    dispersedMassKg: 0.02,
    scatteringCrossSectionM2: 0.5,
    absorptionCrossSectionM2: 0.125,
    scatteringAsymmetryCrossSectionM2: 0.375
  };
  const packed = buildSphGpuParticleBuffers(state, { materialProperties: {} });
  assert.equal(packed.dispersedMediumOptics.rowCount, 2);
  assert.equal(packed.dispersedMediumOptics.readyRowCount, 1);
  assert.equal(packed.dispersedMediumOptics.blockedRowCount, 1);

  const writes = [];
  const destroyed = [];
  const device = {
    createBuffer(descriptor) {
      const mappedBytes = descriptor.mappedAtCreation
        ? new ArrayBuffer(descriptor.size)
        : null;
      const buffer = {
        ...descriptor,
        getMappedRange() { return mappedBytes; },
        unmap() {
          if (mappedBytes) {
            writes.push({
              label: descriptor.label,
              offset: 0,
              byteLength: mappedBytes.byteLength
            });
          }
        },
        destroy() {
          destroyed.push(descriptor.label);
        }
      };
      return buffer;
    },
    queue: {
      writeBuffer(buffer, offset, data) {
        writes.push({ label: buffer.label, offset, byteLength: data.byteLength });
      }
    }
  };
  const buffers = uploadSphGpuParticleBuffers(device, packed);
  assert.deepEqual(writes.map((entry) => entry.label), [
    'ulg-sph-particle-state',
    'ulg-sph-particle-thermo',
    'ulg-sph-particle-identity',
    'ulg-sph-dispersed-medium-optics'
  ]);
  assert.equal(buffers.dispersedMediumOpticsRowCount, 2);
  assert.equal(buffers.dispersedMediumOpticsRowStrideFloats, 8);
  assert.equal(buffers.dispersedMediumOpticsBufferByteLength, 64);
  assert.equal(buffers.ownsDispersedMediumOpticsBuffer, true);
  assert.equal(
    buffers.dispersedMediumOpticsBuffer,
    buffers.dispersedMediumOptics.buffer
  );
  assert.equal(
    buffers.dispersedMediumOpticsAuthority,
    buffers.dispersedMediumOptics.authority
  );
  assert.equal(validateSphDispersedMediumGpuBufferAuthority(
    device,
    buffers.dispersedMediumOpticsAuthority,
    {
      buffer: buffers.dispersedMediumOpticsBuffer,
      particleCount: buffers.particleCount,
      rowCount: buffers.dispersedMediumOpticsRowCount,
      rowStrideFloats: buffers.dispersedMediumOpticsRowStrideFloats
    }
  ), true);
  assert.equal(sphGpuParticleUploadMatchesDevice(buffers, device), true);
  const borrowedBuffers = {
    ...buffers,
    ownsStateBuffer: false,
    ownsThermoBuffer: false,
    ownsIdentityBuffer: false,
    ownsDispersedMediumOpticsBuffer: false,
    ownsMaterialPropertyBankWarmInputBuffer: false,
    ownsMaterialPropertyBankParticleSizeBuffer: false
  };
  assert.equal(
    ensureSphGpuParticleBufferSetBorrowLifecycle(borrowedBuffers),
    false,
    'generic ensure must not mint a fresh sidecar parent from public aliases'
  );
  assert.equal(
    sphGpuParticleUploadMatchesDevice(borrowedBuffers, device),
    false
  );
  const forgedBuffers = {
    ...borrowedBuffers,
    stateBuffer: tagWebGpuBufferDevice({}, device),
    thermoBuffer: tagWebGpuBufferDevice({}, device)
  };
  assert.equal(
    ensureSphGpuParticleBufferSetBorrowLifecycle(forgedBuffers),
    false,
    'first-seen registration must not bless arbitrary same-device state/thermo buffers'
  );
  assert.equal(sphGpuParticleUploadMatchesDevice(forgedBuffers, device), false);
  assert.equal(
    sphGpuParticleUploadDispersedMediumOpticsMatchesSourceBuffers(
      forgedBuffers,
      {
        device,
        stateBuffer: forgedBuffers.stateBuffer,
        thermoBuffer: forgedBuffers.thermoBuffer,
        identityBuffer: forgedBuffers.identityBuffer
      }
    ),
    false,
    'source matching must not become circular through a forged first registration'
  );
  assert.deepEqual(destroyed, []);
  assert.equal(sphGpuParticleUploadMatchesDevice(buffers, device), true);
  buffers.ownsDispersedMediumOpticsBuffer = false;
  assert.equal(
    sphGpuParticleUploadMatchesDevice(buffers, device),
    false,
    'public ownership mutation without a private transfer must fail closed'
  );
  buffers.ownsDispersedMediumOpticsBuffer = true;
  for (const [key, value] of [
    ['dispersedMediumOptics', null],
    ['dispersedMediumOpticsAuthority', null],
    ['dispersedMediumOpticsBuffer', null],
    ['dispersedMediumOpticsRowCount', Number.NaN],
    ['dispersedMediumOpticsRowStrideFloats', Number.NaN],
    ['dispersedMediumOpticsBufferByteLength', Number.NaN],
    ['ownsDispersedMediumOpticsBuffer', 'owned']
  ]) {
    const prior = buffers[key];
    buffers[key] = value;
    assert.equal(
      sphGpuParticleUploadMatchesDevice(buffers, device),
      false,
      `torn ${key} must fail closed`
    );
    buffers[key] = prior;
  }
  for (const [key, value] of [
    ['buffer', null],
    ['authority', null],
    ['particleCount', null],
    ['particleCount', 3],
    ['rowCount', null],
    ['rowCount', 3],
    ['rowStrideFloats', null],
    ['rowStrideFloats', 4],
    ['bufferByteLength', null],
    ['bufferByteLength', 32],
    ['ownsBuffer', false]
  ]) {
    const prior = buffers.dispersedMediumOptics[key];
    buffers.dispersedMediumOptics[key] = value;
    assert.equal(
      sphGpuParticleUploadMatchesDevice(buffers, device),
      false,
      `mutated private child descriptor ${key} must fail closed`
    );
    buffers.dispersedMediumOptics[key] = prior;
  }
  for (const [key, value] of [
    ['particleCount', null],
    ['particleCount', '2'],
    ['topologyEpoch', null],
    ['topologyEpoch', '0'],
    ['identityRevision', null],
    ['identityBuffer', null]
  ]) {
    const prior = buffers[key];
    buffers[key] = value;
    assert.equal(
      sphGpuParticleUploadMatchesDevice(buffers, device),
      false,
      `nullable or coerced parent lineage ${key} must fail closed`
    );
    buffers[key] = prior;
  }

  buffers.__ulgActiveBorrowCount = 1;
  assert.equal(destroySphGpuParticleBuffers(buffers), false);
  assert.deepEqual(destroyed, []);
  buffers.__ulgActiveBorrowCount = 0;
  assert.deepEqual(destroyed, [
    'ulg-sph-particle-state',
    'ulg-sph-particle-thermo',
    'ulg-sph-particle-identity',
    'ulg-sph-dispersed-medium-optics'
  ]);
  assert.equal(validateSphDispersedMediumGpuBufferAuthority(
    device,
    buffers.dispersedMediumOpticsAuthority
  ), false);
});

test('new dispersed-medium sidecar upgrades one canonical sidecar-free parent lifecycle', () => {
  const demo = buildSphPhaseDemoState({
    dropParticleEdge: 1,
    baseParticleEdge: 1
  });
  const packedParticles = buildSphGpuParticleBuffers(demo.state, {
    materialProperties: demo.materialProperties
  });
  const packedOptics = buildSphDispersedMediumGpuBuffers(Array.from(
    { length: packedParticles.particleCount },
    (_, index) => index === 0 ? {
      dispersedMediumOptics: {
        dispersedMaterialId: 7,
        dispersedPhaseId: 2,
        opticalStateId: 19,
        dispersedMassKg: 0,
        scatteringCrossSectionM2: 0,
        absorptionCrossSectionM2: 0,
        scatteringAsymmetryCrossSectionM2: 0
      }
    } : {}
  ));
  const destroyed = [];
  const makeBuffer = (label, size = 64, usage = 128) => ({
    label,
    size,
    usage,
    destroyCount: 0,
    destroy() {
      this.destroyCount += 1;
      destroyed.push(label);
    }
  });
  const device = {
    createBuffer(descriptor) {
      const buffer = makeBuffer(descriptor.label, descriptor.size, descriptor.usage);
      if (descriptor.mappedAtCreation) {
        const mapped = new ArrayBuffer(descriptor.size);
        buffer.getMappedRange = () => mapped;
        buffer.unmap = () => {};
      }
      return buffer;
    },
    queue: { writeBuffer() {} }
  };
  assert.equal(packedParticles.dispersedMediumOptics, null);

  const reentrantTarget = uploadSphGpuParticleBuffers(device, packedParticles);
  let reentered = false;
  const reentrantPackedOptics = new Proxy(packedOptics, {
    get(object, property, receiver) {
      if (property === 'schema' && !reentered) {
        reentered = true;
        destroySphGpuParticleBuffers(reentrantTarget);
      }
      return Reflect.get(object, property, receiver);
    }
  });
  assert.throws(
    () => uploadSphGpuParticleDispersedMediumOpticsSidecar(
      device,
      reentrantPackedOptics,
      { sourceSphUpload: reentrantTarget }
    ),
    /attachment source changed while its child was being created/
  );
  assert.equal(reentrantTarget.destroyed, true);
  assert.equal(
    destroyed.filter((label) => label === 'ulg-sph-dispersed-medium-optics').length,
    1,
    'the child created during reentrant parent teardown must retire exactly once'
  );

  const target = uploadSphGpuParticleBuffers(device, packedParticles);
  assert.equal(sphGpuParticleUploadMatchesDevice(target, device), true);

  for (const field of ['stateBuffer', 'thermoBuffer', 'identityBuffer']) {
    const prior = target[field];
    target[field] = tagWebGpuBufferDevice(
      makeBuffer(`hostile-replacement-${field}`, prior.size, prior.usage),
      device
    );
    assert.throws(
      () => uploadSphGpuParticleDispersedMediumOpticsSidecar(
        device,
        packedOptics,
        { sourceSphUpload: target }
      ),
      /live exact sidecar-free particle source/,
      `canonical lifecycle must reject replaced ${field}`
    );
    target[field] = prior;
  }

  target.__ulgActiveBorrowCount = 1;
  const child = uploadSphGpuParticleDispersedMediumOpticsSidecar(
    device,
    packedOptics,
    { sourceSphUpload: target }
  );
  const produced = child.buffer;

  assert.equal(target.__ulgActiveBorrowCount, 1);
  target.__ulgActiveBorrowCount = 0;
  assert.equal(target.dispersedMediumOptics, child);
  assert.equal(target.dispersedMediumOpticsBuffer, produced);
  assert.equal(target.ownsDispersedMediumOpticsBuffer, true);
  assert.equal(sphGpuParticleUploadMatchesDevice(target, device), true);
  assert.equal(
    sphGpuParticleUploadDispersedMediumOpticsMatchesSourceBuffers(target, {
      device,
      stateBuffer: target.stateBuffer,
      thermoBuffer: target.thermoBuffer,
      identityBuffer: target.identityBuffer
    }),
    true
  );

  const continuation = {
    ...target,
    stateBuffer: tagWebGpuBufferDevice(
      makeBuffer('adopted-continuation-state', target.stateBuffer.size, target.stateBuffer.usage),
      device
    ),
    thermoBuffer: tagWebGpuBufferDevice(
      makeBuffer('adopted-continuation-thermo', target.thermoBuffer.size, target.thermoBuffer.usage),
      device
    ),
    ownsStateBuffer: true,
    ownsThermoBuffer: true,
    ownsIdentityBuffer: false,
    ownsDispersedMediumOpticsBuffer: false,
    ownsMaterialPropertyBankWarmInputBuffer: false,
    ownsMaterialPropertyBankParticleSizeBuffer: false
  };
  const ownerTransfer =
    transferSphGpuParticleBufferSetDispersedMediumOpticsOwnership({
      sourceSphUpload: target,
      targetSphUpload: continuation
    });
  assert.equal(ownerTransfer.transferredOwnedBufferCount, 1);
  assert.equal(target.ownsDispersedMediumOpticsBuffer, false);
  assert.equal(continuation.ownsDispersedMediumOpticsBuffer, true);
  assert.equal(sphGpuParticleUploadMatchesDevice(continuation, device), true);

  const release = beginSphDispersedMediumGpuBufferBorrow(device, child);
  target.ownsStateBuffer = false;
  target.ownsThermoBuffer = false;
  target.ownsIdentityBuffer = false;
  assert.equal(destroySphGpuParticleBuffers(target), true);
  assert.equal(produced.destroyCount, 0);
  assert.equal(destroySphGpuParticleBuffers(continuation), true);
  assert.equal(produced.destroyCount, 0);
  assert.equal(release(), true);
  assert.equal(produced.destroyCount, 1);
  assert.equal(
    produced.destroyCount,
    1,
    'the final adopted owner retires the upgraded child exactly once'
  );
});

test('topology-stable optics source-family continuation accepts exact sequential transient families without moving ownership', () => {
  const {
    device,
    sourceSphUpload,
    child,
    transientBuffer,
    sourceFamily,
    register
  } = createTopologyStableOpticsContinuationFixture();
  const stateB = transientBuffer('continuation-state-b');
  const thermoB = transientBuffer('continuation-thermo-b');
  const stateC = transientBuffer('continuation-state-c');
  const thermoC = transientBuffer('continuation-thermo-c');

  const transitionAB = register({
    sourceStateBuffer: sourceSphUpload.stateBuffer,
    sourceThermoBuffer: sourceSphUpload.thermoBuffer,
    targetStateBuffer: stateB,
    targetThermoBuffer: thermoB
  });
  assert.equal(transitionAB.inserted, true);
  assert.equal(Object.isFrozen(transitionAB), true);
  assert.equal(
    snapshotSphDispersedMediumGpuBufferDeclaration(child, {
      device,
      particleSourceFamily: sourceFamily(stateB, thermoB)
    }).buffer,
    child.buffer
  );

  const transitionBC = register({
    sourceStateBuffer: stateB,
    sourceThermoBuffer: thermoB,
    targetStateBuffer: stateC,
    targetThermoBuffer: thermoC
  });
  assert.equal(transitionBC.inserted, true);
  assert.equal(
    snapshotSphDispersedMediumGpuBufferDeclaration(child, {
      device,
      particleSourceFamily: sourceFamily(stateC, thermoC)
    }).buffer,
    child.buffer,
    'the original parent must authorize a second transient-family continuation'
  );
  assert.equal(sourceSphUpload.ownsDispersedMediumOpticsBuffer, true);
  assert.equal(child.buffer.destroyCount, 0);
  assert.equal(destroySphGpuParticleBuffers(sourceSphUpload), true);
  assert.equal(child.buffer.destroyCount, 1);
});

test('topology-stable optics source-family continuation returns a scoped rollback authority', () => {
  const {
    device,
    sourceSphUpload,
    child,
    transientBuffer,
    sourceFamily,
    register
  } = createTopologyStableOpticsContinuationFixture();
  const targetStateBuffer = transientBuffer('rollback-target-state');
  const targetThermoBuffer = transientBuffer('rollback-target-thermo');
  const transition = register({
    sourceStateBuffer: sourceSphUpload.stateBuffer,
    sourceThermoBuffer: sourceSphUpload.thermoBuffer,
    targetStateBuffer,
    targetThermoBuffer
  });
  assert.equal(
    snapshotSphDispersedMediumGpuBufferDeclaration(child, {
      device,
      particleSourceFamily: sourceFamily(
        targetStateBuffer,
        targetThermoBuffer
      )
    }).buffer,
    child.buffer
  );
  assert.equal(transition.rollback(), true);
  assert.equal(transition.rollback(), false);
  assert.throws(
    () => snapshotSphDispersedMediumGpuBufferDeclaration(child, {
      device,
      particleSourceFamily: sourceFamily(
        targetStateBuffer,
        targetThermoBuffer
      )
    }),
    /declaration snapshot requires one exact live sidecar and source family/
  );
  assert.equal(
    sphDispersedMediumGpuBufferParticleSourceFamilyMatches(
      child,
      sourceFamily(sourceSphUpload.stateBuffer, sourceSphUpload.thermoBuffer)
    ),
    true,
    'rolling back the target must not disturb its authenticated predecessor'
  );
  assert.equal(sourceSphUpload.ownsDispersedMediumOpticsBuffer, true);
  assert.equal(destroySphGpuParticleBuffers(sourceSphUpload), true);
});

test('topology-stable optics source-family continuation rejects wrong predecessors, parents, and devices', () => {
  const {
    device,
    sourceSphUpload,
    transientBuffer,
    register
  } = createTopologyStableOpticsContinuationFixture();
  const targetStateBuffer = transientBuffer('exact-target-state');
  const targetThermoBuffer = transientBuffer('exact-target-thermo');
  const unregisteredStateBuffer = transientBuffer('unregistered-source-state');
  const unregisteredThermoBuffer = transientBuffer('unregistered-source-thermo');

  assert.throws(
    () => register({
      sourceStateBuffer: unregisteredStateBuffer,
      sourceThermoBuffer: unregisteredThermoBuffer,
      targetStateBuffer,
      targetThermoBuffer
    }),
    /authenticated predecessor family/
  );
  assert.throws(
    () => register({
      source: { ...sourceSphUpload },
      sourceStateBuffer: sourceSphUpload.stateBuffer,
      sourceThermoBuffer: sourceSphUpload.thermoBuffer,
      targetStateBuffer,
      targetThermoBuffer
    }),
    /exact live private parent, child, and registrar/
  );

  const foreignDevice = {};
  assert.throws(
    () => register({
      sourceStateBuffer: sourceSphUpload.stateBuffer,
      sourceThermoBuffer: sourceSphUpload.thermoBuffer,
      targetStateBuffer,
      targetThermoBuffer,
      targetDevice: foreignDevice
    }),
    /exact live parent device/
  );
  assert.throws(
    () => register({
      sourceStateBuffer: sourceSphUpload.stateBuffer,
      sourceThermoBuffer: sourceSphUpload.thermoBuffer,
      targetStateBuffer: transientBuffer('foreign-target-state', foreignDevice),
      targetThermoBuffer: transientBuffer('foreign-target-thermo', foreignDevice)
    }),
    /exact same-device state, thermo, identity, and lineage/
  );
  assert.equal(sourceSphUpload.ownsDispersedMediumOpticsBuffer, true);
  assert.equal(destroySphGpuParticleBuffers(sourceSphUpload), true);
});

test('topology-stable optics continuation excludes late-getter reentry and fails closed on teardown', () => {
  const reentrant = createTopologyStableOpticsContinuationFixture();
  const outerState = reentrant.transientBuffer('outer-target-state');
  const outerThermo = reentrant.transientBuffer('outer-target-thermo');
  const nestedState = reentrant.transientBuffer('nested-target-state');
  const nestedThermo = reentrant.transientBuffer('nested-target-thermo');
  let nestedError = null;
  const reentrantOptions = {
    sourceSphUpload: reentrant.sourceSphUpload,
    device: reentrant.device,
    sourceStateBuffer: reentrant.sourceSphUpload.stateBuffer,
    sourceThermoBuffer: reentrant.sourceSphUpload.thermoBuffer,
    get targetStateBuffer() {
      try {
        reentrant.register({
          sourceStateBuffer: reentrant.sourceSphUpload.stateBuffer,
          sourceThermoBuffer: reentrant.sourceSphUpload.thermoBuffer,
          targetStateBuffer: nestedState,
          targetThermoBuffer: nestedThermo
        });
      } catch (error) {
        nestedError = error;
      }
      return outerState;
    },
    targetThermoBuffer: outerThermo
  };
  const outerTransition =
    registerTopologyStableSphDispersedMediumOpticsSourceFamilyContinuation(
      reentrantOptions
    );
  assert.equal(outerTransition.inserted, true);
  assert.match(
    nestedError?.message ?? '',
    /exact live private parent, child, and registrar/
  );
  assert.equal(
    sphDispersedMediumGpuBufferParticleSourceFamilyMatches(
      reentrant.child,
      reentrant.sourceFamily(outerState, outerThermo)
    ),
    true
  );
  assert.equal(
    sphDispersedMediumGpuBufferParticleSourceFamilyMatches(
      reentrant.child,
      reentrant.sourceFamily(nestedState, nestedThermo)
    ),
    false,
    'the nested getter call must not win a registry publication'
  );
  assert.equal(destroySphGpuParticleBuffers(reentrant.sourceSphUpload), true);

  const tornDown = createTopologyStableOpticsContinuationFixture();
  const teardownTargetState = tornDown.transientBuffer('teardown-target-state');
  const teardownTargetThermo = tornDown.transientBuffer('teardown-target-thermo');
  const release = beginSphDispersedMediumGpuBufferBorrow(
    tornDown.device,
    tornDown.child
  );
  let retirementRequested = false;
  assert.throws(
    () => registerTopologyStableSphDispersedMediumOpticsSourceFamilyContinuation({
      sourceSphUpload: tornDown.sourceSphUpload,
      device: tornDown.device,
      sourceStateBuffer: tornDown.sourceSphUpload.stateBuffer,
      sourceThermoBuffer: tornDown.sourceSphUpload.thermoBuffer,
      targetStateBuffer: teardownTargetState,
      get targetThermoBuffer() {
        retirementRequested = destroySphDispersedMediumGpuBuffers(
          tornDown.child
        );
        return teardownTargetThermo;
      }
    }),
    /exact live parent device/
  );
  assert.equal(retirementRequested, true);
  assert.equal(tornDown.child.destroyPending, true);
  assert.equal(
    sphDispersedMediumGpuBufferParticleSourceFamilyMatches(
      tornDown.child,
      tornDown.sourceFamily(teardownTargetState, teardownTargetThermo)
    ),
    false
  );
  assert.equal(release(), true);
  assert.equal(tornDown.child.buffer.destroyCount, 1);
  assert.equal(destroySphGpuParticleBuffers(tornDown.sourceSphUpload), true);
  assert.equal(tornDown.child.buffer.destroyCount, 1);
});

test('topology-stable optics continuation rejects pre-existing child and parent pending-destroy states', () => {
  const childPending = createTopologyStableOpticsContinuationFixture();
  const childRelease = beginSphDispersedMediumGpuBufferBorrow(
    childPending.device,
    childPending.child
  );
  assert.equal(
    destroySphDispersedMediumGpuBuffers(childPending.child),
    true
  );
  assert.throws(
    () => childPending.register({
      sourceStateBuffer: childPending.sourceSphUpload.stateBuffer,
      sourceThermoBuffer: childPending.sourceSphUpload.thermoBuffer,
      targetStateBuffer: childPending.transientBuffer('child-pending-state'),
      targetThermoBuffer: childPending.transientBuffer('child-pending-thermo')
    }),
    /continuation authority is no longer live/
  );
  assert.equal(childRelease(), true);
  assert.equal(destroySphGpuParticleBuffers(childPending.sourceSphUpload), true);

  const parentPending = createTopologyStableOpticsContinuationFixture();
  parentPending.sourceSphUpload.__ulgActiveBorrowCount = 1;
  assert.equal(destroySphGpuParticleBuffers(parentPending.sourceSphUpload), false);
  assert.throws(
    () => parentPending.register({
      sourceStateBuffer: parentPending.sourceSphUpload.stateBuffer,
      sourceThermoBuffer: parentPending.sourceSphUpload.thermoBuffer,
      targetStateBuffer: parentPending.transientBuffer('parent-pending-state'),
      targetThermoBuffer: parentPending.transientBuffer('parent-pending-thermo')
    }),
    /exact live private parent, child, and registrar/
  );
  parentPending.sourceSphUpload.__ulgActiveBorrowCount = 0;
  assert.equal(parentPending.sourceSphUpload.destroyed, true);
  assert.equal(parentPending.child.buffer.destroyCount, 1);
});

test('authenticated transfer can seed a private borrowed continuation without reopening generic registration', () => {
  const state = createSphState({
    smoothingLengthM: 0.2,
    particles: [{
      material: 'unknownium',
      x: [0, 0, 0],
      v: [0, 0, 0],
      massKg: 1,
      specificInternalEnergyJPerKg: 0,
      dispersedMediumOptics: {
        dispersedMaterialId: 7,
        dispersedPhaseId: 3,
        opticalStateId: 11,
        dispersedMassKg: 0.02,
        scatteringCrossSectionM2: 0.5,
        absorptionCrossSectionM2: 0.125,
        scatteringAsymmetryCrossSectionM2: 0.375
      }
    }]
  });
  state.particles[0].dispersedMediumOptics = {
    dispersedMaterialId: 7,
    dispersedPhaseId: 3,
    opticalStateId: 11,
    dispersedMassKg: 0.02,
    scatteringCrossSectionM2: 0.5,
    absorptionCrossSectionM2: 0.125,
    scatteringAsymmetryCrossSectionM2: 0.375
  };
  const packed = buildSphGpuParticleBuffers(state, { materialProperties: {} });
  const device = {
    createBuffer(descriptor) {
      const mappedBytes = descriptor.mappedAtCreation
        ? new ArrayBuffer(descriptor.size)
        : null;
      return {
        ...descriptor,
        getMappedRange() { return mappedBytes; },
        unmap() {},
        destroyCount: 0,
        destroy() { this.destroyCount += 1; }
      };
    },
    queue: { writeBuffer() {} }
  };
  const source = uploadSphGpuParticleBuffers(device, packed);
  const rejectedStateBuffer = tagWebGpuBufferDevice({}, device);
  const rejectedThermoBuffer = tagWebGpuBufferDevice({}, device);
  let rejectedOwnsSidecar = false;
  const rejectedContinuation = {
    ...source,
    stateBuffer: rejectedStateBuffer,
    thermoBuffer: rejectedThermoBuffer,
    ownsStateBuffer: false,
    ownsThermoBuffer: false,
    ownsIdentityBuffer: false,
    ownsMaterialPropertyBankWarmInputBuffer: false,
    ownsMaterialPropertyBankParticleSizeBuffer: false
  };
  Object.defineProperty(
    rejectedContinuation,
    'ownsDispersedMediumOpticsBuffer',
    {
      configurable: true,
      enumerable: true,
      get() { return rejectedOwnsSidecar; },
      set(value) {
        if (value === true) throw new Error('injected ownership publication failure');
        rejectedOwnsSidecar = value;
      }
    }
  );
  assert.throws(
    () => transferSphGpuParticleBufferSetDispersedMediumOpticsOwnership({
      sourceSphUpload: source,
      targetSphUpload: rejectedContinuation
    }),
    /injected ownership publication failure/
  );
  assert.equal(source.ownsDispersedMediumOpticsBuffer, true);
  assert.equal(rejectedContinuation.ownsDispersedMediumOpticsBuffer, false);
  assert.equal(
    sphGpuParticleUploadMatchesDevice(rejectedContinuation, device),
    false,
    'failed ownership publication must roll back the target private parent record'
  );
  assert.equal(
    sphDispersedMediumGpuBufferParticleSourceFamilyMatches(
      source.dispersedMediumOptics,
      {
        particleCount: source.particleCount,
        topologyEpoch: source.topologyEpoch,
        identityRevision: source.identityRevision,
        stateBuffer: rejectedStateBuffer,
        thermoBuffer: rejectedThermoBuffer,
        identityBuffer: source.identityBuffer
      }
    ),
    false,
    'failed ownership publication must roll back the child source-family registry entry'
  );
  const continuation = {
    ...source,
    stateBuffer: tagWebGpuBufferDevice({}, device),
    thermoBuffer: tagWebGpuBufferDevice({}, device),
    ownsStateBuffer: false,
    ownsThermoBuffer: false,
    ownsIdentityBuffer: false,
    ownsDispersedMediumOpticsBuffer: false,
    ownsMaterialPropertyBankWarmInputBuffer: false,
    ownsMaterialPropertyBankParticleSizeBuffer: false
  };
  const ownerTransfer =
    transferSphGpuParticleBufferSetDispersedMediumOpticsOwnership({
      sourceSphUpload: source,
      targetSphUpload: continuation
    });
  assert.equal(ownerTransfer.transferredOwnedBufferCount, 1);
  assert.equal(source.ownsDispersedMediumOpticsBuffer, false);
  assert.equal(continuation.ownsDispersedMediumOpticsBuffer, true);
  assert.equal(sphGpuParticleUploadMatchesDevice(continuation, device), true);

  const borrowedContinuation = {
    ...source,
    stateBuffer: tagWebGpuBufferDevice({}, device),
    thermoBuffer: tagWebGpuBufferDevice({}, device),
    ownsStateBuffer: false,
    ownsThermoBuffer: false,
    ownsIdentityBuffer: false,
    ownsDispersedMediumOpticsBuffer: false,
    ownsMaterialPropertyBankWarmInputBuffer: false,
    ownsMaterialPropertyBankParticleSizeBuffer: false
  };
  const borrowedTransfer =
    transferSphGpuParticleBufferSetDispersedMediumOpticsOwnership({
      sourceSphUpload: source,
      targetSphUpload: borrowedContinuation
    });
  assert.equal(borrowedTransfer.transferredOwnedBufferCount, 0);
  assert.equal(borrowedContinuation.ownsDispersedMediumOpticsBuffer, false);
  assert.equal(
    sphGpuParticleUploadMatchesDevice(borrowedContinuation, device),
    true,
    'a complete privately seeded borrowed descriptor remains valid'
  );
  assert.equal(destroySphGpuParticleBuffers(borrowedContinuation), true);
  assert.equal(source.dispersedMediumOpticsBuffer.destroyCount, 0);
  assert.equal(destroySphGpuParticleBuffers(source), true);
  assert.equal(source.dispersedMediumOpticsBuffer.destroyCount, 0);
  assert.equal(destroySphGpuParticleBuffers(continuation), true);
  assert.equal(source.dispersedMediumOpticsBuffer.destroyCount, 1);
});

test('a stale sidecar transfer rollback cannot revive an earlier owner after A to B to C', () => {
  const state = createSphState({
    smoothingLengthM: 0.2,
    particles: [{
      material: 'unknownium',
      x: [0, 0, 0],
      v: [0, 0, 0],
      massKg: 1,
      specificInternalEnergyJPerKg: 0,
      dispersedMediumOptics: {
        dispersedMaterialId: 7,
        dispersedPhaseId: 3,
        opticalStateId: 11,
        dispersedMassKg: 0.02,
        scatteringCrossSectionM2: 0.5,
        absorptionCrossSectionM2: 0.125,
        scatteringAsymmetryCrossSectionM2: 0.375
      }
    }]
  });
  state.particles[0].dispersedMediumOptics = {
    dispersedMaterialId: 7,
    dispersedPhaseId: 3,
    opticalStateId: 11,
    dispersedMassKg: 0.02,
    scatteringCrossSectionM2: 0.5,
    absorptionCrossSectionM2: 0.125,
    scatteringAsymmetryCrossSectionM2: 0.375
  };
  const packed = buildSphGpuParticleBuffers(state, { materialProperties: {} });
  const device = {
    createBuffer(descriptor) {
      const mappedBytes = descriptor.mappedAtCreation
        ? new ArrayBuffer(descriptor.size)
        : null;
      return {
        ...descriptor,
        getMappedRange() { return mappedBytes; },
        unmap() {},
        destroyCount: 0,
        destroy() { this.destroyCount += 1; }
      };
    },
    queue: { writeBuffer() {} }
  };
  const sourceA = uploadSphGpuParticleBuffers(device, packed);
  const continuationB = {
    ...sourceA,
    stateBuffer: tagWebGpuBufferDevice({}, device),
    thermoBuffer: tagWebGpuBufferDevice({}, device),
    ownsStateBuffer: false,
    ownsThermoBuffer: false,
    ownsIdentityBuffer: false,
    ownsDispersedMediumOpticsBuffer: false,
    ownsMaterialPropertyBankWarmInputBuffer: false,
    ownsMaterialPropertyBankParticleSizeBuffer: false
  };
  const transferAB =
    transferSphGpuParticleBufferSetDispersedMediumOpticsOwnership({
      sourceSphUpload: sourceA,
      targetSphUpload: continuationB
    });
  const continuationC = {
    ...sourceA,
    stateBuffer: tagWebGpuBufferDevice({}, device),
    thermoBuffer: tagWebGpuBufferDevice({}, device),
    ownsStateBuffer: false,
    ownsThermoBuffer: false,
    ownsIdentityBuffer: false,
    ownsDispersedMediumOpticsBuffer: false,
    ownsMaterialPropertyBankWarmInputBuffer: false,
    ownsMaterialPropertyBankParticleSizeBuffer: false
  };
  const transferBC =
    transferSphGpuParticleBufferSetDispersedMediumOpticsOwnership({
      sourceSphUpload: continuationB,
      targetSphUpload: continuationC
    });

  assert.equal(transferAB.transferredOwnedBufferCount, 1);
  assert.equal(transferBC.transferredOwnedBufferCount, 1);
  assert.deepEqual([
    sourceA.ownsDispersedMediumOpticsBuffer,
    continuationB.ownsDispersedMediumOpticsBuffer,
    continuationC.ownsDispersedMediumOpticsBuffer
  ], [false, false, true]);
  assert.deepEqual([
    sphGpuParticleUploadMatchesDevice(sourceA, device),
    sphGpuParticleUploadMatchesDevice(continuationB, device),
    sphGpuParticleUploadMatchesDevice(continuationC, device)
  ], [true, true, true]);

  assert.equal(
    transferAB.rollback(),
    false,
    'a superseded rollback capability must refuse without mutation'
  );
  assert.deepEqual([
    sourceA.ownsDispersedMediumOpticsBuffer,
    continuationB.ownsDispersedMediumOpticsBuffer,
    continuationC.ownsDispersedMediumOpticsBuffer
  ], [false, false, true]);
  assert.deepEqual([
    sphGpuParticleUploadMatchesDevice(sourceA, device),
    sphGpuParticleUploadMatchesDevice(continuationB, device),
    sphGpuParticleUploadMatchesDevice(continuationC, device)
  ], [true, true, true]);

  const sidecarBuffer = sourceA.dispersedMediumOpticsBuffer;
  assert.equal(destroySphGpuParticleBuffers(sourceA), true);
  assert.equal(sidecarBuffer.destroyCount, 0);
  assert.equal(destroySphGpuParticleBuffers(continuationB), true);
  assert.equal(sidecarBuffer.destroyCount, 0);
  assert.equal(destroySphGpuParticleBuffers(continuationC), true);
  assert.equal(sidecarBuffer.destroyCount, 1);
});

test('pending-destroy SPH sidecar cannot acquire a continuation parent or owner', () => {
  const state = createSphState({
    smoothingLengthM: 0.2,
    particles: [{
      material: 'unknownium',
      x: [0, 0, 0],
      v: [0, 0, 0],
      massKg: 1,
      specificInternalEnergyJPerKg: 0,
      dispersedMediumOptics: {
        dispersedMaterialId: 7,
        dispersedPhaseId: 3,
        opticalStateId: 11,
        dispersedMassKg: 0.02,
        scatteringCrossSectionM2: 0.5,
        absorptionCrossSectionM2: 0.125,
        scatteringAsymmetryCrossSectionM2: 0.375
      }
    }]
  });
  state.particles[0].dispersedMediumOptics = {
    dispersedMaterialId: 7,
    dispersedPhaseId: 3,
    opticalStateId: 11,
    dispersedMassKg: 0.02,
    scatteringCrossSectionM2: 0.5,
    absorptionCrossSectionM2: 0.125,
    scatteringAsymmetryCrossSectionM2: 0.375
  };
  const packed = buildSphGpuParticleBuffers(state, { materialProperties: {} });
  const destroyed = [];
  const device = {
    createBuffer(descriptor) {
      const mappedBytes = descriptor.mappedAtCreation
        ? new ArrayBuffer(descriptor.size)
        : null;
      return {
        ...descriptor,
        getMappedRange() { return mappedBytes; },
        unmap() {},
        destroy() { destroyed.push(descriptor.label); }
      };
    },
    queue: { writeBuffer() {} }
  };
  const source = uploadSphGpuParticleBuffers(device, packed);
  const target = {
    ...source,
    stateBuffer: tagWebGpuBufferDevice({}, device),
    thermoBuffer: tagWebGpuBufferDevice({}, device),
    ownsStateBuffer: false,
    ownsThermoBuffer: false,
    ownsIdentityBuffer: false,
    ownsDispersedMediumOpticsBuffer: false,
    ownsMaterialPropertyBankWarmInputBuffer: false,
    ownsMaterialPropertyBankParticleSizeBuffer: false
  };
  const release = beginSphDispersedMediumGpuBufferBorrow(
    device,
    source.dispersedMediumOptics
  );
  assert.equal(
    destroySphDispersedMediumGpuBuffers(source.dispersedMediumOptics),
    true
  );
  assert.equal(source.dispersedMediumOptics.destroyPending, true);
  assert.equal(
    validateSphDispersedMediumGpuBufferAuthority(
      device,
      source.dispersedMediumOpticsAuthority
    ),
    false,
    'only the already-issued private borrow may drain a pending child'
  );
  assert.equal(
    ensureSphGpuParticleBufferSetBorrowLifecycle(target),
    false,
    'pending destroy must reject a new parent registration'
  );
  assert.throws(
    () => transferSphGpuParticleBufferSetDispersedMediumOpticsOwnership({
      sourceSphUpload: source,
      targetSphUpload: target
    }),
    /exact live private source parent\/child record/
  );
  assert.equal(source.ownsDispersedMediumOpticsBuffer, true);
  assert.equal(target.ownsDispersedMediumOpticsBuffer, false);
  assert.equal(release(), true);
  assert.equal(
    destroyed.filter((label) => label === 'ulg-sph-dispersed-medium-optics').length,
    1
  );
  assert.equal(sphGpuParticleUploadMatchesDevice(target, device), false);
  assert.equal(destroySphGpuParticleBuffers(source), true);
});

test('SPH sidecar private lineage rejects an FNV-colliding child swap and tears down its original child', () => {
  const makeState = (domainId) => {
    const state = createSphState({
      smoothingLengthM: 0.2,
      particles: [0].map((index) => ({
        material: 'unknownium',
        x: [index, 0, 0],
        v: [0, 0, 0],
        massKg: 1,
        specificInternalEnergyJPerKg: 0
      }))
    });
    for (const particle of state.particles) {
      particle.initialBodyDomainId = domainId;
      particle.initialBodyId = `body-${domainId}`;
    }
    state.particles[0].dispersedMediumOptics = {
      dispersedMaterialId: 7,
      dispersedPhaseId: 3,
      opticalStateId: 11,
      dispersedMassKg: 0.02,
      scatteringCrossSectionM2: 0.5,
      absorptionCrossSectionM2: 0.125,
      scatteringAsymmetryCrossSectionM2: 0.375
    };
    return state;
  };
  const packedA = buildSphGpuParticleBuffers(makeState(48_124), {
    materialProperties: {}
  });
  const packedB = buildSphGpuParticleBuffers(makeState(82_709), {
    materialProperties: {}
  });
  assert.equal(packedA.particleCount, packedB.particleCount);
  assert.equal(packedA.topologyEpoch, packedB.topologyEpoch);
  assert.equal(packedA.identityRevision, packedB.identityRevision);
  assert.equal(packedA.identityRevision, 'fnv1a32:1:6e137934');

  const device = {
    createBuffer(descriptor) {
      const mappedBytes = descriptor.mappedAtCreation
        ? new ArrayBuffer(descriptor.size)
        : null;
      return {
        ...descriptor,
        getMappedRange() { return mappedBytes; },
        unmap() {},
        destroyCount: 0,
        destroy() { this.destroyCount += 1; }
      };
    },
    queue: { writeBuffer() {} }
  };
  const uploadA = uploadSphGpuParticleBuffers(device, packedA);
  const uploadB = uploadSphGpuParticleBuffers(device, packedB);
  const privateChildA = uploadA.dispersedMediumOptics;
  const privateChildB = uploadB.dispersedMediumOptics;
  assert.equal(sphGpuParticleUploadMatchesDevice(uploadA, device), true);
  assert.equal(sphGpuParticleUploadMatchesDevice(uploadB, device), true);
  assert.equal(
    sphGpuParticleUploadDispersedMediumOpticsMatchesSourceBuffers(uploadA, {
      device,
      stateBuffer: uploadA.stateBuffer,
      thermoBuffer: uploadA.thermoBuffer,
      identityBuffer: uploadA.identityBuffer
    }),
    true
  );
  for (const [field, foreignBuffer] of [
    ['stateBuffer', uploadB.stateBuffer],
    ['thermoBuffer', uploadB.thermoBuffer],
    ['identityBuffer', uploadB.identityBuffer]
  ]) {
    assert.equal(
      sphGpuParticleUploadDispersedMediumOpticsMatchesSourceBuffers(uploadA, {
        device,
        stateBuffer: uploadA.stateBuffer,
        thermoBuffer: uploadA.thermoBuffer,
        identityBuffer: uploadA.identityBuffer,
        [field]: foreignBuffer
      }),
      false,
      `private parent family must reject a foreign ${field} override`
    );
    const priorBuffer = uploadA[field];
    uploadA[field] = foreignBuffer;
    assert.equal(
      sphGpuParticleUploadMatchesDevice(uploadA, device),
      false,
      `public ${field} mutation must not rewrite the private parent family`
    );
    uploadA[field] = priorBuffer;
    assert.equal(sphGpuParticleUploadMatchesDevice(uploadA, device), true);
  }

  const sidecarAliasKeys = [
    'dispersedMediumOptics',
    'dispersedMediumOpticsAuthority',
    'dispersedMediumOpticsBuffer',
    'dispersedMediumOpticsRowCount',
    'dispersedMediumOpticsRowStrideFloats',
    'dispersedMediumOpticsBufferByteLength',
    'ownsDispersedMediumOpticsBuffer'
  ];
  for (const key of sidecarAliasKeys) uploadA[key] = uploadB[key];
  assert.equal(
    sphGpuParticleUploadMatchesDevice(uploadA, device),
    false,
    'private particle lineage must reject a fully self-consistent public child swap'
  );
  assert.equal(sphGpuParticleUploadMatchesDevice(uploadB, device), true);

  uploadA.destroyed = true;
  assert.equal(destroySphGpuParticleBuffers(uploadA), true);
  assert.equal(
    privateChildA.buffer.destroyCount,
    1,
    'parent teardown must retain and destroy its private original child'
  );
  assert.equal(
    privateChildB.buffer.destroyCount,
    0,
    'swapped public aliases must not redirect teardown to the foreign child'
  );
  assert.equal(sphGpuParticleUploadMatchesDevice(uploadB, device), true);
  assert.equal(destroySphGpuParticleBuffers(uploadB), true);
  assert.equal(privateChildB.buffer.destroyCount, 1);
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
