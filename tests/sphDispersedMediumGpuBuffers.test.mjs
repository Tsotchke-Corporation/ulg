import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS,
  SPH_DISPERSED_MEDIUM_OPTICS_STATUS,
  ULG_SPH_DISPERSED_MEDIUM_OPTICS_AUTHORITY_SCHEMA,
  ULG_SPH_DISPERSED_MEDIUM_OPTICS_BUFFER_SET_SCHEMA,
  ULG_SPH_DISPERSED_MEDIUM_OPTICS_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import { tagWebGpuBufferDevice } from '../src/runtime/sph/sphGpuDeviceIdentity.js';
import {
  beginSphDispersedMediumGpuBufferBorrow,
  buildSphDispersedMediumGpuBuffers,
  destroySphDispersedMediumGpuBuffers,
  registerSphDispersedMediumGpuBufferParticleLineage,
  snapshotSphDispersedMediumGpuBufferDeclaration,
  sphDispersedMediumGpuBufferParticleLineageMatches,
  sphDispersedMediumGpuBufferParticleSourceFamilyMatches,
  uploadSphDispersedMediumGpuBuffers,
  validateSphDispersedMediumGpuBufferAuthority
} from '../src/runtime/sph/sphDispersedMediumGpuBuffers.js';

function readyOptics(overrides = {}) {
  return {
    dispersedMaterialId: 17,
    dispersedPhaseId: 3,
    opticalStateId: 41,
    dispersedMassKg: 0.125,
    scatteringCrossSectionM2: 0.75,
    absorptionCrossSectionM2: 0.25,
    scatteringAsymmetryCrossSectionM2: -0.5,
    ...overrides
  };
}

function fakeDevice({ throwOnWrite = false, onUnmap = null } = {}) {
  const writes = [];
  const destroyed = [];
  const device = {
    createBuffer(descriptor) {
      const mappedBytes = descriptor.mappedAtCreation
        ? new ArrayBuffer(descriptor.size)
        : null;
      const buffer = {
        ...descriptor,
        getMappedRange() {
          if (throwOnWrite) throw new Error('write failed');
          return mappedBytes;
        },
        unmap() {
          if (mappedBytes) {
            writes.push({
              buffer,
              offset: 0,
              values: Array.from(new Float32Array(mappedBytes))
            });
          }
          onUnmap?.();
        },
        destroy() {
          destroyed.push(descriptor.label);
        }
      };
      return buffer;
    },
    queue: {
      writeBuffer(buffer, offset, data) {
        if (throwOnWrite) throw new Error('write failed');
        writes.push({
          buffer,
          offset,
          values: Array.from(data)
        });
      }
    }
  };
  return { device, writes, destroyed };
}

test('dispersed-medium registry exposes no raw GPU-buffer adoption bypass', async () => {
  const module = await import(
    '../src/runtime/sph/sphDispersedMediumGpuBuffers.js'
  );
  assert.equal('adoptSphDispersedMediumGpuBuffer' in module, false);
  assert.equal(
    typeof module.consumeSphDispersedMediumOpticsProducerClaimAsGpuBuffer,
    'function'
  );
});

test('dispersed-medium builder preserves the allocation-free absent path', () => {
  assert.equal(buildSphDispersedMediumGpuBuffers([]), null);
  assert.equal(buildSphDispersedMediumGpuBuffers([{}, { dispersedMediumOptics: null }]), null);
  assert.equal(uploadSphDispersedMediumGpuBuffers({}, null), null);
});

test('dispersed-medium builder emits dense ready and canonical blocked rows', () => {
  const packed = buildSphDispersedMediumGpuBuffers([
    { dispersedMediumOptics: readyOptics() },
    {},
    { dispersedMediumOptics: { status: SPH_DISPERSED_MEDIUM_OPTICS_STATUS.blocked } }
  ]);

  assert.equal(packed.schema, ULG_SPH_DISPERSED_MEDIUM_OPTICS_SCHEMA);
  assert.equal(packed.particleCount, 3);
  assert.equal(packed.rowCount, 3);
  assert.equal(packed.rowCapacity, 3);
  assert.equal(packed.readyRowCount, 1);
  assert.equal(packed.blockedRowCount, 2);
  assert.deepEqual(packed.readyOpticalStateIds, [41]);
  assert.equal(Object.isFrozen(packed.readyOpticalStateIds), true);
  assert.equal(packed.rowStrideFloats, SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS);
  assert.equal(packed.bufferByteLength, 3 * 8 * 4);
  assert.deepEqual([...packed.rows.subarray(0, 8)], [
    17, 3, 41, 1, 0.125, 0.75, 0.25, -0.5
  ]);
  assert.deepEqual([...packed.rows.subarray(8, 16)], [
    0, 0, 0, 255, 0, 0, 0, 0
  ]);
  assert.deepEqual([...packed.rows.subarray(16, 24)], [
    0, 0, 0, 255, 0, 0, 0, 0
  ]);
  assert.equal(packed.hostHotLoopReadback, false);
});

test('dispersed-medium builder rejects nonphysical identifiers and optical moments', () => {
  for (const [overrides, pattern] of [
    [{ dispersedMaterialId: -1 }, /dispersedMaterialId/],
    [{ dispersedPhaseId: 16_777_216 }, /dispersedPhaseId/],
    [{ opticalStateId: 0 }, /opticalStateId/],
    [{ dispersedMassKg: -1 }, /dispersedMassKg/],
    [{ scatteringCrossSectionM2: Number.POSITIVE_INFINITY }, /scatteringCrossSectionM2/],
    [{ absorptionCrossSectionM2: Number.NaN }, /absorptionCrossSectionM2/],
    [{ scatteringAsymmetryCrossSectionM2: 0.751 }, /magnitude must not exceed/],
    [{ scatteringAsymmetryCrossSectionM2: -0.751 }, /magnitude must not exceed/],
    [{ status: 7 }, /must be ready/]
  ]) {
    assert.throws(
      () => buildSphDispersedMediumGpuBuffers([
        { dispersedMediumOptics: readyOptics(overrides) }
      ]),
      pattern
    );
  }
});

test('dispersed-medium upload authenticates exact device/buffer/count authority and retires once', () => {
  const packed = buildSphDispersedMediumGpuBuffers([
    { dispersedMediumOptics: readyOptics() },
    {}
  ]);
  const { device, writes, destroyed } = fakeDevice();
  const upload = uploadSphDispersedMediumGpuBuffers(device, packed);

  assert.equal(upload.schema, ULG_SPH_DISPERSED_MEDIUM_OPTICS_BUFFER_SET_SCHEMA);
  assert.equal(upload.authority.schema, ULG_SPH_DISPERSED_MEDIUM_OPTICS_AUTHORITY_SCHEMA);
  assert.equal(Object.isFrozen(upload.authority), true);
  assert.equal(upload.rowCount, 2);
  assert.equal(upload.rowCapacity, 2);
  assert.equal(upload.bufferByteLength, 64);
  assert.deepEqual(upload.authority.readyOpticalStateIds, [41]);
  assert.equal(Object.isFrozen(upload.authority.readyOpticalStateIds), true);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].buffer.label, 'ulg-sph-dispersed-medium-optics');
  assert.equal(writes[0].offset, 0);
  assert.deepEqual(writes[0].values, [...packed.rows]);
  assert.equal((upload.buffer.usage & 128) !== 0, true);
  assert.equal((upload.buffer.usage & 8) !== 0, false);
  assert.equal(upload.buffer.mappedAtCreation, true);
  assert.equal(validateSphDispersedMediumGpuBufferAuthority(
    device,
    upload.authority,
    {
      buffer: upload.buffer,
      particleCount: 2,
      rowCount: 2,
      rowStrideFloats: 8
    }
  ), true);
  assert.equal(validateSphDispersedMediumGpuBufferAuthority(
    { ...device },
    upload.authority
  ), false);
  assert.equal(validateSphDispersedMediumGpuBufferAuthority(
    device,
    { ...upload.authority }
  ), false);
  assert.equal(validateSphDispersedMediumGpuBufferAuthority(
    device,
    upload.authority,
    { buffer: {} }
  ), false);

  let decoyDestroyCount = 0;
  upload.buffer = {
    destroy() { decoyDestroyCount += 1; }
  };
  upload.ownsBuffer = false;
  upload.destroyed = true;
  assert.equal(destroySphDispersedMediumGpuBuffers(upload), true);
  assert.equal(destroySphDispersedMediumGpuBuffers(upload), false);
  assert.deepEqual(destroyed, ['ulg-sph-dispersed-medium-optics']);
  assert.equal(
    decoyDestroyCount,
    0,
    'public descriptor tampering must neither redirect nor suppress private teardown'
  );
  assert.equal(validateSphDispersedMediumGpuBufferAuthority(
    device,
    upload.authority
  ), false);
});

test('dispersed-medium particle lineage is private, exact, and one-time bindable', () => {
  const packed = buildSphDispersedMediumGpuBuffers([
    { dispersedMediumOptics: readyOptics() },
    {}
  ]);
  const { device, destroyed } = fakeDevice();
  const upload = uploadSphDispersedMediumGpuBuffers(device, packed);
  const lineage = {
    particleCount: 2,
    topologyEpoch: 7,
    identityRevision: 'identity-a',
    identityBuffer: {}
  };

  assert.equal(
    sphDispersedMediumGpuBufferParticleLineageMatches(upload, lineage),
    false
  );
  upload.particleLineage = { ...lineage };
  assert.equal(
    sphDispersedMediumGpuBufferParticleLineageMatches(upload, lineage),
    false,
    'a public lookalike must not establish particle-lineage authority'
  );
  for (const [key, value] of [
    ['particleCount', 1],
    ['bufferByteLength', null]
  ]) {
    const prior = upload[key];
    upload[key] = value;
    assert.throws(
      () => registerSphDispersedMediumGpuBufferParticleLineage(upload, lineage),
      /one live exact sidecar/,
      `first lineage registration must reject mutated ${key}`
    );
    upload[key] = prior;
  }
  assert.equal(
    registerSphDispersedMediumGpuBufferParticleLineage(upload, lineage),
    true
  );
  assert.equal(
    sphDispersedMediumGpuBufferParticleLineageMatches(upload, lineage),
    true
  );
  upload.particleLineage.identityRevision = 'identity-b';
  assert.equal(
    sphDispersedMediumGpuBufferParticleLineageMatches(upload, lineage),
    true,
    'mutating the public lookalike must not alter the private association'
  );
  assert.equal(
    sphDispersedMediumGpuBufferParticleLineageMatches(upload, {
      ...lineage,
      identityRevision: 'identity-b'
    }),
    false
  );
  for (const invalidLineage of [
    { ...lineage, particleCount: null },
    { ...lineage, particleCount: '2' },
    { ...lineage, topologyEpoch: null },
    { ...lineage, topologyEpoch: '7' },
    { ...lineage, identityRevision: null },
    { ...lineage, identityBuffer: null }
  ]) {
    assert.equal(
      sphDispersedMediumGpuBufferParticleLineageMatches(
        upload,
        invalidLineage
      ),
      false,
      'nullable or coerced lineage fields must never act as wildcards'
    );
    assert.equal(
      validateSphDispersedMediumGpuBufferAuthority(
        device,
        upload.authority,
        {
          particleLineage: invalidLineage,
          requireParticleLineage: true
        }
      ),
      false
    );
  }
  for (const [key, value] of [
    ['buffer', null],
    ['authority', null],
    ['particleCount', null],
    ['particleCount', 3],
    ['rowCount', null],
    ['rowCount', 3],
    ['rowCapacity', 3],
    ['rowStrideFloats', null],
    ['rowStrideFloats', 4],
    ['rowStrideBytes', 16],
    ['bufferByteLength', null],
    ['bufferByteLength', 32],
    ['ownsBuffer', false]
  ]) {
    const prior = upload[key];
    upload[key] = value;
    assert.equal(
      sphDispersedMediumGpuBufferParticleLineageMatches(upload, lineage),
      false,
      `private lineage matching must reject mutated child ${key}`
    );
    assert.equal(
      validateSphDispersedMediumGpuBufferAuthority(device, upload.authority),
      false,
      `authority validation must reject mutated child ${key}`
    );
    assert.throws(
      () => beginSphDispersedMediumGpuBufferBorrow(device, upload),
      /live exact same-device sidecar/,
      `borrowing must reject mutated child ${key}`
    );
    upload[key] = prior;
  }
  assert.equal(
    registerSphDispersedMediumGpuBufferParticleLineage(upload, lineage),
    true,
    're-registering the exact lineage is idempotent'
  );
  assert.throws(
    () => registerSphDispersedMediumGpuBufferParticleLineage(upload, {
      ...lineage,
      identityRevision: 'identity-b'
    }),
    /already bound to another particle lineage/
  );

  assert.equal(destroySphDispersedMediumGpuBuffers(upload), true);
  assert.deepEqual(destroyed, ['ulg-sph-dispersed-medium-optics']);
  assert.equal(
    sphDispersedMediumGpuBufferParticleLineageMatches(upload, lineage),
    false
  );
});

test('resident declaration snapshots require the exact private source family and remain defensive', () => {
  const packed = buildSphDispersedMediumGpuBuffers([
    { dispersedMediumOptics: readyOptics() },
    {}
  ]);
  const { device } = fakeDevice();
  const identityBuffer = tagWebGpuBufferDevice({}, device);
  const stateBuffer = tagWebGpuBufferDevice({}, device);
  const thermoBuffer = tagWebGpuBufferDevice({}, device);
  const lineage = {
    particleCount: 2,
    topologyEpoch: 9,
    identityRevision: 'resident-declaration-a',
    identityBuffer
  };
  const sourceFamily = {
    ...lineage,
    stateBuffer,
    thermoBuffer
  };
  const upload = uploadSphDispersedMediumGpuBuffers(device, packed, {
    particleLineage: lineage,
    particleSourceFamily: sourceFamily,
    particleSourceFamilyRegistrar: Object.freeze(Object.create(null))
  });

  assert.equal(
    sphDispersedMediumGpuBufferParticleSourceFamilyMatches(
      upload,
      sourceFamily
    ),
    true
  );
  const first = snapshotSphDispersedMediumGpuBufferDeclaration(upload, {
    device,
    particleSourceFamily: sourceFamily
  });
  assert.strictEqual(
    first.buffer,
    upload.buffer,
    'the snapshot must expose the registry-owned allocation for producer binding'
  );
  assert.notStrictEqual(first.rows, packed.rows);
  assert.deepEqual(first.rows, packed.rows);
  first.rows[0] = 999;
  const second = snapshotSphDispersedMediumGpuBufferDeclaration(upload, {
    device,
    particleSourceFamily: sourceFamily
  });
  assert.equal(second.rows[0], packed.rows[0]);
  assert.throws(
    () => snapshotSphDispersedMediumGpuBufferDeclaration(upload, {
      device,
      particleSourceFamily: {
        ...sourceFamily,
        stateBuffer: tagWebGpuBufferDevice({}, device)
      }
    }),
    /exact live sidecar and source family/
  );
  assert.equal(destroySphDispersedMediumGpuBuffers(upload), true);
});

test('dispersed-medium upload defers owner teardown until its exact async borrow releases', () => {
  const packed = buildSphDispersedMediumGpuBuffers([
    { dispersedMediumOptics: readyOptics() }
  ]);
  const { device, destroyed } = fakeDevice();
  const upload = uploadSphDispersedMediumGpuBuffers(device, packed, {
    particleLineage: {
      particleCount: 1,
      topologyEpoch: 0,
      identityRevision: 'borrow-identity',
      identityBuffer: {}
    }
  });
  const release = beginSphDispersedMediumGpuBufferBorrow(device, upload);

  assert.equal(destroySphDispersedMediumGpuBuffers(upload), true);
  assert.equal(upload.destroyPending, true);
  assert.equal(upload.destroyed, undefined);
  assert.deepEqual(destroyed, []);
  assert.equal(validateSphDispersedMediumGpuBufferAuthority(
    device,
    upload.authority,
    { buffer: upload.buffer, particleCount: 1, rowCount: 1 }
  ), false);
  assert.throws(
    () => beginSphDispersedMediumGpuBufferBorrow(device, upload),
    /live exact same-device sidecar/
  );

  assert.equal(release(), true);
  assert.equal(release(), false);
  assert.equal(upload.destroyPending, false);
  assert.equal(upload.destroyed, true);
  assert.deepEqual(destroyed, ['ulg-sph-dispersed-medium-optics']);
  assert.equal(validateSphDispersedMediumGpuBufferAuthority(
    device,
    upload.authority
  ), false);
});

test('dispersed-medium deferred raw teardown preserves exact retry authority after a destroy throw', () => {
  const packed = buildSphDispersedMediumGpuBuffers([
    { dispersedMediumOptics: readyOptics() }
  ]);
  const { device, destroyed } = fakeDevice();
  const upload = uploadSphDispersedMediumGpuBuffers(device, packed, {
    particleLineage: {
      particleCount: 1,
      topologyEpoch: 0,
      identityRevision: 'retry-identity',
      identityBuffer: {}
    }
  });
  const rawDestroy = upload.buffer.destroy.bind(upload.buffer);
  let rawDestroyAttemptCount = 0;
  upload.buffer.destroy = () => {
    rawDestroyAttemptCount += 1;
    if (rawDestroyAttemptCount === 1) {
      throw new Error('synthetic dispersed-medium raw destroy failure');
    }
    rawDestroy();
  };
  const release = beginSphDispersedMediumGpuBufferBorrow(device, upload);

  assert.equal(destroySphDispersedMediumGpuBuffers(upload), true);
  assert.equal(upload.destroyPending, true);
  assert.throws(
    () => release(),
    /synthetic dispersed-medium raw destroy failure/
  );
  assert.equal(rawDestroyAttemptCount, 1);
  assert.equal(upload.destroyPending, true);
  assert.notEqual(upload.destroyed, true);
  assert.deepEqual(destroyed, []);

  assert.equal(destroySphDispersedMediumGpuBuffers(upload), true);
  assert.equal(rawDestroyAttemptCount, 2);
  assert.equal(upload.destroyPending, false);
  assert.equal(upload.destroyed, true);
  assert.deepEqual(destroyed, ['ulg-sph-dispersed-medium-optics']);
  assert.equal(destroySphDispersedMediumGpuBuffers(upload), false);
});

test('dispersed-medium upload validates mutable packed rows and rolls back failed writes', () => {
  const packed = buildSphDispersedMediumGpuBuffers([
    { dispersedMediumOptics: readyOptics() }
  ]);
  packed.rows[7] = 2;
  const normal = fakeDevice();
  assert.throws(
    () => uploadSphDispersedMediumGpuBuffers(normal.device, packed),
    /asymmetry exceeds scattering/
  );
  assert.deepEqual(normal.destroyed, []);

  packed.rows[7] = 0;
  const failing = fakeDevice({ throwOnWrite: true });
  assert.throws(
    () => uploadSphDispersedMediumGpuBuffers(failing.device, packed),
    /write failed/
  );
  assert.deepEqual(failing.destroyed, ['ulg-sph-dispersed-medium-optics']);
});

test('raw dispersed-medium upload rejects a forged GPU-dynamic route catalog before allocation', () => {
  const built = buildSphDispersedMediumGpuBuffers([
    { dispersedMediumOptics: readyOptics() },
    {}
  ]);
  const dynamicCatalog = {
    ...built,
    status: 'dispersed-medium-optics-producer-dynamic-route-catalog-ready',
    declarationMode: 'gpu-dynamic-route-catalog-v0',
    readyRowCount: null,
    blockedRowCount: null,
    initialReadyRowCount: built.readyRowCount,
    initialBlockedRowCount: built.blockedRowCount,
    initialReadyOpticalStateIds: [...built.readyOpticalStateIds],
    eligibleOpticalStateIds: [...built.readyOpticalStateIds],
    eligibleOpticalStateRouteCount: built.readyOpticalStateRouteCount,
    routeCatalogRowCount: 1,
    routeCatalogSignature: 'f32-bits-v0:synthetic-forged-catalog',
    activeRouteCountAuthority: 'gpu-resident-unobserved-no-host-readback'
  };
  const { device, writes, destroyed } = fakeDevice();

  assert.throws(
    () => uploadSphDispersedMediumGpuBuffers(device, dynamicCatalog),
    /require an authenticated producer adoption/
  );
  assert.deepEqual(writes, []);
  assert.deepEqual(destroyed, []);
});

test('an empty dynamic route catalog remains a valid optically-thin declaration but still requires producer authority', () => {
  const built = buildSphDispersedMediumGpuBuffers([
    {
      dispersedMediumOptics: {
        status: SPH_DISPERSED_MEDIUM_OPTICS_STATUS.blocked
      }
    }
  ]);
  const dynamicCatalog = {
    ...built,
    status: 'dispersed-medium-optics-producer-dynamic-route-catalog-ready',
    declarationMode: 'gpu-dynamic-route-catalog-v0',
    readyRowCount: null,
    blockedRowCount: null,
    initialReadyRowCount: 0,
    initialBlockedRowCount: 1,
    initialReadyOpticalStateIds: [],
    eligibleOpticalStateIds: [],
    eligibleOpticalStateRouteCount: 0,
    routeCatalogRowCount: 1,
    routeCatalogSignature: 'f32-bits-v0:h2-only-blocked-route',
    activeRouteCountAuthority: 'gpu-resident-unobserved-no-host-readback'
  };
  const { device, writes, destroyed } = fakeDevice();

  assert.throws(
    () => uploadSphDispersedMediumGpuBuffers(device, dynamicCatalog),
    /require an authenticated producer adoption/
  );
  assert.deepEqual(writes, []);
  assert.deepEqual(destroyed, []);
});

test('dispersed-medium upload binds resident bytes and authority to one pre-copy snapshot', () => {
  const built = buildSphDispersedMediumGpuBuffers([
    { dispersedMediumOptics: readyOptics({ opticalStateId: 19 }) }
  ]);
  const packed = {
    ...built,
    readyOpticalStateIds: [...built.readyOpticalStateIds],
    rows: built.rows.slice()
  };
  const { device, writes } = fakeDevice({
    onUnmap() {
      packed.rows[2] = 23;
      packed.readyOpticalStateIds[0] = 23;
    }
  });
  const upload = uploadSphDispersedMediumGpuBuffers(device, packed);

  assert.equal(writes[0].values[2], 19);
  assert.deepEqual(upload.authority.readyOpticalStateIds, [19]);
  assert.deepEqual(upload.readyOpticalStateIds, [19]);
  assert.equal(validateSphDispersedMediumGpuBufferAuthority(
    device,
    upload.authority,
    { upload, buffer: upload.buffer, particleCount: 1, rowCount: 1 }
  ), true);
  assert.equal(destroySphDispersedMediumGpuBuffers(upload), true);
});

test('authority, borrow, and declaration snapshot reject teardown from late caller getters', () => {
  const makeResident = (suffix) => {
    const packed = buildSphDispersedMediumGpuBuffers([
      { dispersedMediumOptics: readyOptics() }
    ]);
    const { device, destroyed } = fakeDevice();
    const identityBuffer = tagWebGpuBufferDevice({}, device);
    const stateBuffer = tagWebGpuBufferDevice({}, device);
    const thermoBuffer = tagWebGpuBufferDevice({}, device);
    const lineage = {
      particleCount: 1,
      topologyEpoch: 3,
      identityRevision: `late-getter-${suffix}`,
      identityBuffer
    };
    const sourceFamily = { ...lineage, stateBuffer, thermoBuffer };
    const upload = uploadSphDispersedMediumGpuBuffers(device, packed, {
      particleLineage: lineage,
      particleSourceFamily: sourceFamily,
      particleSourceFamilyRegistrar: Object.freeze(Object.create(null))
    });
    return { device, destroyed, upload, sourceFamily };
  };

  const validationCase = makeResident('validation');
  const lateExpectations = new Proxy({}, {
    getOwnPropertyDescriptor(target, property) {
      if (property === 'producerAdoptionDeclaration') {
        destroySphDispersedMediumGpuBuffers(validationCase.upload);
      }
      return Reflect.getOwnPropertyDescriptor(target, property);
    }
  });
  assert.equal(validateSphDispersedMediumGpuBufferAuthority(
    validationCase.device,
    validationCase.upload.authority,
    lateExpectations
  ), false);
  assert.equal(validationCase.upload.destroyed, true);
  assert.equal(validationCase.destroyed.length, 1);

  const borrowCase = makeResident('borrow');
  const borrowBuffer = borrowCase.upload.buffer;
  Object.defineProperty(borrowCase.upload, 'buffer', {
    configurable: true,
    get() {
      destroySphDispersedMediumGpuBuffers(borrowCase.upload);
      return borrowBuffer;
    }
  });
  assert.throws(
    () => beginSphDispersedMediumGpuBufferBorrow(
      borrowCase.device,
      borrowCase.upload
    ),
    /live exact same-device sidecar/
  );
  assert.equal(borrowCase.destroyed.length, 1);

  const snapshotCase = makeResident('snapshot');
  let identityReads = 0;
  const lateSourceFamily = new Proxy(snapshotCase.sourceFamily, {
    get(target, property, receiver) {
      if (property === 'identityBuffer' && ++identityReads === 2) {
        destroySphDispersedMediumGpuBuffers(snapshotCase.upload);
      }
      return Reflect.get(target, property, receiver);
    }
  });
  assert.throws(
    () => snapshotSphDispersedMediumGpuBufferDeclaration(
      snapshotCase.upload,
      {
        device: snapshotCase.device,
        particleSourceFamily: lateSourceFamily
      }
    ),
    /exact live sidecar and source family/
  );
  assert.equal(snapshotCase.upload.destroyed, true);
  assert.equal(snapshotCase.destroyed.length, 1);
});
