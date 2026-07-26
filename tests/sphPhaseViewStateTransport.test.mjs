import test from 'node:test';
import assert from 'node:assert/strict';

import {
  packSlotObjectArray,
  unpackSlotObjectArray,
  packSphPhaseViewStateForTransport,
  unpackSphPhaseViewStateFromTransport,
  SPH_VIEW_STATE_COLUMNAR_SCHEMA
} from '../src/runtime/sphPhaseViewStateTransport.js';

const roundTrip = (rows) => unpackSlotObjectArray(packSlotObjectArray(rows));

test('round trip preserves values, key order, and absent keys exactly', () => {
  const rows = [
    { id: 'p0', material: 'h2o', phase: 'solid', mass: 1.5, flag: false },
    { id: 'p1', material: 'h2o', phase: 'solid', mass: 1.5, flag: false },
    // Different key order and an extra key: both must survive.
    { material: 'fe', id: 'p2', extra: { nested: [1, 2] }, phase: 'liquid', mass: 2.25, flag: true }
  ];
  const back = roundTrip(rows);
  // JSON equality is stricter than deep equality: it also pins key order.
  assert.equal(JSON.stringify(back), JSON.stringify(rows));
});

test('a constant column collapses to a single stored value', () => {
  const rows = Array.from({ length: 500 }, (_, i) => ({ id: `p${i}`, phase: 'solid' }));
  const packed = packSlotObjectArray(rows);
  assert.equal(packed.schema, SPH_VIEW_STATE_COLUMNAR_SCHEMA);
  assert.equal(packed.columns.phase.kind, 'const');
  assert.equal(packed.columns.phase.value, 'solid');
  assert.equal(JSON.stringify(unpackSlotObjectArray(packed)), JSON.stringify(rows));
});

test('the id column is derived rather than stored when it is p<index>', () => {
  const rows = Array.from({ length: 64 }, (_, i) => ({ id: `p${i}`, phase: 'gas' }));
  const packed = packSlotObjectArray(rows);
  assert.equal(packed.columns.id.kind, 'derived-id');
  assert.equal(unpackSlotObjectArray(packed)[63].id, 'p63');
});

test('an id column that is not p<index> is stored, not fabricated', () => {
  // Guards the derived-id shortcut: a producer with different ids must not
  // have them silently replaced by the slot index.
  const rows = [{ id: 'alpha' }, { id: 'beta' }, { id: 'gamma' }];
  const back = roundTrip(rows);
  assert.deepEqual(back.map((r) => r.id), ['alpha', 'beta', 'gamma']);
});

test('a low-cardinality column becomes a dictionary with a narrow index', () => {
  const rows = Array.from({ length: 1000 }, (_, i) => ({ lane: i % 4 }));
  const packed = packSlotObjectArray(rows);
  assert.equal(packed.columns.lane.kind, 'dict');
  assert.equal(packed.columns.lane.values.length, 4);
  // 4 distinct values fit in a byte index.
  assert.ok(packed.columns.lane.index instanceof Uint8Array);
  assert.equal(JSON.stringify(unpackSlotObjectArray(packed)), JSON.stringify(rows));
});

test('a high-cardinality integer column becomes a typed array', () => {
  const rows = Array.from({ length: 2000 }, (_, i) => ({ lineage: i }));
  const packed = packSlotObjectArray(rows);
  assert.equal(packed.columns.lineage.kind, 'i32');
  assert.ok(packed.columns.lineage.data instanceof Int32Array);
  assert.equal(JSON.stringify(unpackSlotObjectArray(packed)), JSON.stringify(rows));
});

test('float values survive a round trip without precision loss', () => {
  // The radii in the real view state differ in the 15th decimal; a lossy
  // encoding here would silently change physics inputs.
  const rows = Array.from({ length: 300 }, (_, i) => ({
    radius: 0.09999944269657135 + i * 1e-17
  }));
  const back = roundTrip(rows);
  for (let i = 0; i < rows.length; i += 1) {
    assert.equal(back[i].radius, rows[i].radius);
  }
});

test('packing is a no-op for an empty or non-object array', () => {
  assert.equal(packSlotObjectArray([]), null);
  assert.equal(packSlotObjectArray(null), null);
  assert.equal(packSlotObjectArray([1, 2, 3]), null);
});

test('view state pack/unpack round trips the three per-slot arrays', () => {
  const slots = Array.from({ length: 200 }, (_, i) => ({
    id: `p${i}`, material: i % 2 ? 'fe' : 'h2o', phase: 'solid', lineage: i
  }));
  const viewState = {
    positionsM: new Float32Array(6),
    materials: slots.map((s) => ({ ...s })),
    sphGpuParticleState: { metadata: slots.map((s) => ({ ...s })), particleCount: 200 },
    mlsMpmGpuParticleState: { metadata: slots.map((s) => ({ ...s })) },
    untouched: { keepMe: true }
  };
  const packed = packSphPhaseViewStateForTransport(viewState);
  // The original must not be mutated: the worker keeps using it after posting.
  assert.ok(Array.isArray(viewState.materials));
  assert.ok(!Array.isArray(packed.materials));
  const back = unpackSphPhaseViewStateFromTransport(packed);
  assert.equal(JSON.stringify(back.materials), JSON.stringify(viewState.materials));
  assert.equal(
    JSON.stringify(back.sphGpuParticleState.metadata),
    JSON.stringify(viewState.sphGpuParticleState.metadata)
  );
  assert.equal(
    JSON.stringify(back.mlsMpmGpuParticleState.metadata),
    JSON.stringify(viewState.mlsMpmGpuParticleState.metadata)
  );
  assert.equal(back.sphGpuParticleState.particleCount, 200);
  assert.deepEqual(back.untouched, { keepMe: true });
  assert.equal(back.__sphViewStateColumnarPaths, undefined);
});

test('unpacking an already-unpacked view state is a no-op', () => {
  // A main thread running against an older worker build must not be broken by
  // the unpack call.
  const viewState = { materials: [{ id: 'p0' }], positionsM: new Float32Array(3) };
  assert.equal(unpackSphPhaseViewStateFromTransport(viewState), viewState);
});

test('the packed form survives structuredClone, which is the actual transport', () => {
  const slots = Array.from({ length: 500 }, (_, i) => ({ id: `p${i}`, lane: i % 4, lineage: i }));
  const viewState = { materials: slots, positionsM: new Float32Array(3) };
  const packed = packSphPhaseViewStateForTransport(viewState);
  const back = unpackSphPhaseViewStateFromTransport(structuredClone(packed));
  assert.equal(JSON.stringify(back.materials), JSON.stringify(slots));
});
