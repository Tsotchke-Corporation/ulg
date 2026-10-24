import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  publishUlgPressureInterfaceGasCellFieldAdmission,
  publishUlgPressureInterfaceGasCellFieldImportSource
} from '../src/runtime/peercomputeBrowserResidentHost.js';
import {
  ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA
} from '../src/runtime/sph/sphMlsMpmGpuStep.js';
import {
  ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA,
  ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V2,
  ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V3,
  ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V4
} from '../src/runtime/sph/sphSpatialGasLedgerEosGpu.js';

const publishers = [
  ['admission', publishUlgPressureInterfaceGasCellFieldAdmission],
  ['import', publishUlgPressureInterfaceGasCellFieldImportSource]
];

function publicationFixture(source = {}) {
  const hot = new Map();
  const writes = [];
  const commits = [];
  return {
    writes,
    commits,
    options: {
      stateManager: {
        setHotBuffer(key, value) { writes.push(key); hot.set(key, value); },
        getHotBuffer(key) { return hot.get(key); },
        commitDelta(delta) { commits.push(delta); }
      },
      source,
      hotBufferKey: 'test:gas-pressure-publication-retirement',
      gasCellFieldSnapshot: { localPressureGradientReady: true, cells: [{}] },
      retainedGasPressureBufferRefs: ['test:legacy-pressure-ref'],
      pressureInterfaceGasCellFieldAdmission: {
        schema: ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA,
        status: 'pressure-interface-gas-cell-field-consumption-approved',
        gasCellFieldConsumptionApproved: true
      }
    }
  };
}

function rejectsBeforePublication(publish, source, pattern) {
  const fixture = publicationFixture(source);
  assert.throws(() => publish(fixture.options), pattern);
  assert.deepEqual(fixture.writes, []);
  assert.deepEqual(fixture.commits, []);
}

for (const [name, publish] of publishers) {
  test(`${name} publication positive control accepts valid legacy snapshot and refs`, () => {
    for (const source of [{}, Object.create(null), Object.create({ schema: 'test:ordinary' })]) {
      const fixture = publicationFixture(source);
      const result = publish(fixture.options);
      assert.equal(result.committed, true);
      assert.equal(result.hotBufferStored, true);
      assert.equal(fixture.writes.length, 1);
      assert.equal(fixture.commits.length, 1);
    }
  });

  test(`${name} publication rejects own and inherited retired schemas despite ready legacy data`, () => {
    for (const schema of [
      ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V2,
      ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V3,
      ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V4
    ]) {
      rejectsBeforePublication(publish, { schema }, /rejects retired/);
      rejectsBeforePublication(publish, Object.create({ schema }), /inherited protected authority/);
      rejectsBeforePublication(publish, {
        schema: 'test:ordinary-wrapper',
        retainedGasCellFieldSource: Object.create({ schema })
      }, /inherited protected authority/);
      rejectsBeforePublication(publish, Object.assign(Object.create({ schema }), {
        schema: 'test:own-schema-cannot-mask-retired-prototype'
      }), /inherited protected authority/);
    }
  });

  test(`${name} publication rejects forged current own and inherited schemas`, () => {
    const schema = ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA;
    rejectsBeforePublication(publish, { schema }, /forged exact/);
    rejectsBeforePublication(publish, Object.create({ schema }), /inherited protected authority/);
  });

  test(`${name} publication never invokes own or inherited schema getters`, () => {
    let getterCalls = 0;
    const accessor = Object.defineProperty({}, 'schema', {
      get() { getterCalls += 1; throw new Error('schema getter must not run'); }
    });
    rejectsBeforePublication(publish, accessor, /schema must be an own data property/);
    rejectsBeforePublication(publish, Object.create(accessor), /schema must be an own data property/);
    assert.equal(getterCalls, 0);
  });

  test(`${name} publication rejects trapping prototype and schema descriptor inspection`, () => {
    const trappedPrototype = new Proxy({}, {
      getPrototypeOf() { throw new Error('prototype trap'); }
    });
    rejectsBeforePublication(publish, trappedPrototype, /prototype could not be inspected/);
    const trappedDescriptor = new Proxy({}, {
      getOwnPropertyDescriptor() { throw new Error('schema descriptor trap'); }
    });
    rejectsBeforePublication(publish, Object.create(trappedDescriptor), /schema could not be inspected/);
  });

  test(`${name} publication bounds and rejects cyclic/deep prototype chains`, () => {
    let cyclic;
    cyclic = new Proxy({}, { getPrototypeOf() { return cyclic; } });
    rejectsBeforePublication(publish, cyclic, /prototype chain contains a cycle/);
    let deep = Object.create(null);
    for (let index = 0; index < 65; index += 1) deep = Object.create(deep);
    rejectsBeforePublication(publish, deep, /bounded inspection depth/);
  });

  test(`${name} publication captures shared prototype descriptors once`, () => {
    let schemaDescriptors = 0;
    let prototypeReads = 0;
    const prototype = new Proxy(Object.create(null), {
      getOwnPropertyDescriptor(_object, key) {
        if (key === 'schema') schemaDescriptors += 1;
        return undefined;
      },
      getPrototypeOf() { prototypeReads += 1; return null; }
    });
    const fixture = publicationFixture({
      retainedGasCellFieldSource: Object.create(prototype),
      gasCellFieldAdmission: Object.create(prototype)
    });
    assert.equal(publish(fixture.options).committed, true);
    assert.equal(schemaDescriptors, 1);
    assert.equal(prototypeReads, 1);
  });
}
