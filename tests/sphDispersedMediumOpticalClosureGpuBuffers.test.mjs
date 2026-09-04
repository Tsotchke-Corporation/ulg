import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL,
  ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_PROPERTY_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import {
  buildSphDispersedMediumOpticalClosureTable
} from '../src/runtime/sph/sphDispersedMediumOpticalClosure.js';
import {
  ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_GPU_AUTHORITY_SCHEMA,
  ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_GPU_TABLE_SCHEMA,
  beginSphDispersedMediumOpticalClosureGpuTableBorrow,
  destroySphDispersedMediumOpticalClosureGpuTable,
  snapshotSphDispersedMediumOpticalClosureGpuTable,
  snapshotSphDispersedMediumOpticalClosureTable,
  uploadSphDispersedMediumOpticalClosureGpuTable,
  validateSphDispersedMediumOpticalClosureGpuTableAuthority
} from '../src/runtime/sph/sphDispersedMediumOpticalClosureGpuBuffers.js';
import {
  collectiveOpticalRouteDescriptor
} from '../src/runtime/sph/sphOpticalRouteIdentity.js';

function closureTable(overrides = {}) {
  return buildSphDispersedMediumOpticalClosureTable([{
    dispersedMaterialId: 11,
    vaporPhaseId: 3,
    condensedPhaseId: 2,
    opticalStateId: 101,
    morphologyModelId:
      SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL.monodisperseRadius,
    condensedDensityKgPerM3: 1000,
    scatteringEfficiencyQsca: 2,
    absorptionEfficiencyQabs: 0.1,
    asymmetryFactorG: 0.85,
    effectiveRadiusM: 1e-6,
    dispersedMediumOpticalClosureProvenance: {
      source: 'focused-test',
      blockers: ['not-scientifically-validated'],
      nested: { generation: 3 }
    },
    ...overrides
  }]);
}

function fakeDevice({ omitMappedRange = false } = {}) {
  const buffers = [];
  const device = {
    buffers,
    createBuffer(descriptor) {
      const mapped = descriptor.mappedAtCreation
        ? new ArrayBuffer(descriptor.size)
        : null;
      const buffer = {
        ...descriptor,
        destroyCount: 0,
        destroy() { this.destroyCount += 1; },
        ...(omitMappedRange ? {} : {
          getMappedRange() { return mapped; },
          unmap() {}
        })
      };
      buffers.push(buffer);
      return buffer;
    }
  };
  return device;
}

test('closure GPU table authenticates exact descriptor, allocation, device, and content generation', () => {
  const device = fakeDevice();
  const table = closureTable();
  const originalQsca = table.rows[7];
  const upload = uploadSphDispersedMediumOpticalClosureGpuTable(
    device,
    table
  );

  assert.equal(
    upload.schema,
    ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_GPU_TABLE_SCHEMA
  );
  assert.equal(
    upload.authority.schema,
    ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_GPU_AUTHORITY_SCHEMA
  );
  assert.equal(Object.isFrozen(upload.authority), true);
  assert.equal(validateSphDispersedMediumOpticalClosureGpuTableAuthority(
    device,
    upload,
    { table }
  ), true);
  assert.equal(validateSphDispersedMediumOpticalClosureGpuTableAuthority(
    device,
    { ...upload },
    { table }
  ), false);
  assert.equal(validateSphDispersedMediumOpticalClosureGpuTableAuthority(
    { ...device },
    upload,
    { table }
  ), false);

  table.rows[7] = 9;
  assert.equal(validateSphDispersedMediumOpticalClosureGpuTableAuthority(
    device,
    upload,
    { table }
  ), false);
  const snapshot = snapshotSphDispersedMediumOpticalClosureGpuTable(
    upload,
    { device }
  );
  assert.equal(snapshot.rows[7], originalQsca);
  snapshot.rows[7] = 123;
  assert.equal(
    snapshotSphDispersedMediumOpticalClosureGpuTable(upload, { device }).rows[7],
    originalQsca
  );

  const exactBuffer = upload.buffer;
  upload.buffer = { destroy() { throw new Error('decoy must not be destroyed'); } };
  upload.ownsBuffer = false;
  upload.destroyed = true;
  assert.equal(destroySphDispersedMediumOpticalClosureGpuTable(upload), true);
  assert.equal(exactBuffer.destroyCount, 1);
  assert.equal(destroySphDispersedMediumOpticalClosureGpuTable(upload), false);
});

test('closure GPU table borrow defers exact once-only destruction', () => {
  const device = fakeDevice();
  const table = closureTable();
  const upload = uploadSphDispersedMediumOpticalClosureGpuTable(
    device,
    table
  );
  const release = beginSphDispersedMediumOpticalClosureGpuTableBorrow(
    device,
    upload,
    { table }
  );

  assert.equal(destroySphDispersedMediumOpticalClosureGpuTable(upload), true);
  assert.equal(upload.destroyPending, true);
  assert.equal(upload.buffer.destroyCount, 0);
  assert.equal(destroySphDispersedMediumOpticalClosureGpuTable(upload), false);
  assert.throws(
    () => beginSphDispersedMediumOpticalClosureGpuTableBorrow(
      device,
      upload,
      { table }
    ),
    /live exact GPU table/
  );
  assert.equal(release(), true);
  assert.equal(release(), false);
  assert.equal(upload.buffer.destroyCount, 1);
  assert.equal(upload.destroyPending, false);
  assert.equal(upload.destroyed, true);
  assert.equal(validateSphDispersedMediumOpticalClosureGpuTableAuthority(
    device,
    upload,
    { table }
  ), false);
});

test('closure GPU authority final-checks private liveness after hostile getters', () => {
  const device = fakeDevice();
  const table = closureTable();
  const upload = uploadSphDispersedMediumOpticalClosureGpuTable(
    device,
    table
  );
  const fingerprint = upload.contentFingerprint;
  let teardownTriggered = false;
  Object.defineProperty(upload, 'destroyed', {
    configurable: true,
    enumerable: true,
    get() { return false; },
    set() {}
  });
  Object.defineProperty(upload, 'contentFingerprint', {
    configurable: true,
    enumerable: true,
    get() {
      if (!teardownTriggered) {
        teardownTriggered = true;
        assert.equal(
          destroySphDispersedMediumOpticalClosureGpuTable(upload),
          true
        );
      }
      return fingerprint;
    }
  });

  assert.equal(validateSphDispersedMediumOpticalClosureGpuTableAuthority(
    device,
    upload,
    { table }
  ), false);
  assert.equal(teardownTriggered, true);
  assert.equal(upload.buffer.destroyCount, 1);
  assert.equal(
    destroySphDispersedMediumOpticalClosureGpuTable(upload),
    false
  );
});

test('host closure snapshots recursively detach metadata and row storage', () => {
  const table = closureTable();
  const snapshot = snapshotSphDispersedMediumOpticalClosureTable(table);
  assert.notStrictEqual(snapshot.rows, table.rows);
  assert.notStrictEqual(snapshot.metadata, table.metadata);
  assert.notStrictEqual(
    snapshot.metadata[0].provenance,
    table.metadata[0].provenance
  );
  assert.equal(Object.isFrozen(snapshot.metadata[0].provenance.nested), true);
  table.metadata[0].provenance.nested.generation = 99;
  assert.equal(snapshot.metadata[0].provenance.nested.generation, 3);
  assert.equal(
    snapshot.routeLookup,
    'exact-dispersed-material-vapor-phase-condensed-phase-linear-scan'
  );
  assert.equal(
    snapshot.massAuthority,
    'already-conserved-dispersed-condensed-mass'
  );
  table.rows[7] = 17;
  assert.equal(snapshot.rows[7], 2);
});

test('closure GPU snapshot preserves canonical collective route identity', () => {
  const route = collectiveOpticalRouteDescriptor({
    material: 'canonical-snapshot-material',
    vaporPhase: 'gas',
    condensedPhase: 'liquid',
    closureModel: 'monodisperse-radius',
    properties: {
      dispersedMediumOpticalClosure: {
        schema: ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_PROPERTY_SCHEMA,
        morphologyModel: 'monodisperse-radius',
        condensedDensityKgPerM3: 997,
        scatteringEfficiencyQsca: 1.7,
        absorptionEfficiencyQabs: 0.05,
        asymmetryFactorG: 0.6,
        effectiveRadiusM: 2e-6,
        provenance: {
          status: 'reduced-estimate',
          source: 'canonical-snapshot-test',
          blockers: ['not-scientifically-validated']
        },
        scientificValidation: false
      }
    }
  });
  const table = buildSphDispersedMediumOpticalClosureTable([route]);
  const snapshot = snapshotSphDispersedMediumOpticalClosureTable(table);

  assert.equal(
    snapshot.metadata[0].routeIdentityKind,
    'canonical-collective-optical-route'
  );
  assert.equal(snapshot.metadata[0].routeSchema, route.schema);
  assert.equal(snapshot.metadata[0].routeId, route.routeId);
  assert.equal(snapshot.metadata[0].routeKey, route.routeKey);
});

test('closure GPU upload destroys failed allocations and rejects empty tables', () => {
  const empty = buildSphDispersedMediumOpticalClosureTable([]);
  assert.throws(
    () => uploadSphDispersedMediumOpticalClosureGpuTable(
      fakeDevice(),
      empty
    ),
    /at least one closure row/
  );

  const device = fakeDevice({ omitMappedRange: true });
  assert.throws(
    () => uploadSphDispersedMediumOpticalClosureGpuTable(
      device,
      closureTable()
    ),
    /mapped-at-creation initialization/
  );
  assert.equal(device.buffers.length, 1);
  assert.equal(device.buffers[0].destroyCount, 1);

  const lostGetterDevice = fakeDevice();
  Object.defineProperty(lostGetterDevice, 'lost', {
    configurable: true,
    get() {
      throw new Error('injected-device-lost-getter-failure');
    }
  });
  assert.throws(
    () => uploadSphDispersedMediumOpticalClosureGpuTable(
      lostGetterDevice,
      closureTable()
    ),
    /injected-device-lost-getter-failure/
  );
  assert.equal(lostGetterDevice.buffers.length, 1);
  assert.equal(lostGetterDevice.buffers[0].destroyCount, 1);
});
