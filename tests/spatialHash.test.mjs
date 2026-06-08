import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeParticleState } from '../src/runtime/particleState.js';
import { buildNeighborGraph, buildSpatialHash, queryNeighborPairs } from '../src/runtime/spatialHash.js';

test('particle state normalization preserves ids and SoA-friendly arrays', () => {
  const particles = normalizeParticleState({
    step: 3,
    time: 0.25,
    bodies: [
      { id: 'a', x: 0.1, v: 0.2, mass: 2, h: 0.4 },
      { id: 'b', x: 0.8, v: -0.1, mass: 1 }
    ]
  }, {
    dimensions: 1,
    defaultSmoothingLength: 0.5
  });

  assert.equal(particles.schema, 'peercompute.ulg.particle-state.v0');
  assert.equal(particles.count, 2);
  assert.deepEqual(particles.ids, ['a', 'b']);
  assert.deepEqual(particles.positions, [[0.1], [0.8]]);
  assert.deepEqual(particles.velocities, [[0.2], [-0.1]]);
  assert.deepEqual(particles.masses, [2, 1]);
  assert.deepEqual(particles.smoothingLengths, [0.4, 0.5]);
  assert.equal(particles.step, 3);
  assert.equal(particles.time, 0.25);
});

test('spatial hash bins carrier bodies deterministically', () => {
  const hash = buildSpatialHash({
    cellSize: 1,
    bodies: [
      { id: 'a', x: 0.1, mass: 1 },
      { id: 'b', x: 0.8, mass: 1 },
      { id: 'c', x: 1.4, mass: 1 },
      { id: 'd', x: -0.2, mass: 1 }
    ]
  });

  assert.equal(hash.schema, 'peercompute.ulg.spatial-hash.v0');
  assert.equal(hash.dimensions, 1);
  assert.equal(hash.cellCount, 3);
  assert.deepEqual(hash.cells.map((cell) => [cell.key, cell.bodyIds]), [
    ['-1', ['d']],
    ['0', ['a', 'b']],
    ['1', ['c']]
  ]);
  assert.deepEqual(hash.assignments.map((entry) => entry.cellKey), ['0', '0', '1', '-1']);
  assert.equal(hash.boundary, 'open');
});

test('neighbor graph scans adjacent cells and emits stable radius-limited pairs', () => {
  const graph = buildNeighborGraph({
    cellSize: 1,
    radius: 0.65,
    bodies: [
      { id: 'a', x: 0 },
      { id: 'b', x: 0.5 },
      { id: 'c', x: 1.1 },
      { id: 'd', x: 2.4 }
    ]
  });

  assert.equal(graph.schema, 'peercompute.ulg.neighbor-graph.v0');
  assert.equal(graph.pairCount, 2);
  assert.deepEqual(graph.pairs.map((pair) => `${pair.sourceId}-${pair.targetId}`), ['a-b', 'b-c']);
  assert.ok(Math.abs(graph.pairs[0].distance - 0.5) < 1e-12);
  assert.ok(Math.abs(graph.pairs[1].distance - 0.6) < 1e-12);
  assert.equal(graph.spatialHash.cellCount, 3);
});

test('neighbor pair queries avoid duplicates and can emit symmetric pairs on request', () => {
  const hash = buildSpatialHash([
    { id: 'a', x: 0 },
    { id: 'b', x: 0.4 },
    { id: 'c', x: 0.9 }
  ], {
    cellSize: 0.5,
    boundary: 'open'
  });
  const compact = queryNeighborPairs(hash, { radius: 0.5 });
  assert.deepEqual(compact.pairs.map((pair) => `${pair.leftId}-${pair.rightId}`), ['a-b', 'b-c']);
  const symmetric = queryNeighborPairs(hash, { radius: 0.5, symmetric: true });
  assert.deepEqual(symmetric.pairs.map((pair) => `${pair.leftId}-${pair.rightId}`), [
    'a-b',
    'b-a',
    'b-c',
    'c-b'
  ]);
});
