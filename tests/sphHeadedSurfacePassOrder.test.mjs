import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  isWorkerIsosurfacePassOrderValid,
  visibleMotionCadenceAcceptanceIssues
} from '../scripts/sph-headed-cadence-metrics.mjs';

const opaque = 'opaque-isosurface';
const refractive = 'refractive-isosurface';
const medium = 'depth-clipped-participating-medium';
const transparent = 'transparent-isosurface-and-overlay';
const validCases = [
  { name: 'ordinary', order: [opaque, transparent], mediumRequired: false },
  { name: 'ordinary with refraction', order: [opaque, refractive, transparent], mediumRequired: false },
  { name: 'ready medium', order: [opaque, medium, transparent], mediumRequired: true },
  { name: 'ready medium with refraction', order: [opaque, refractive, medium, transparent], mediumRequired: true }
];

for (const { name, order, mediumRequired } of validCases) {
  test(`headed pass-order contract accepts ${name} without mutating the proof`, () => {
    const proof = Object.freeze([...order]);
    assert.equal(isWorkerIsosurfacePassOrderValid(proof, { mediumRequired }), true);
    assert.deepEqual(proof, order);
    assert.equal(isWorkerIsosurfacePassOrderValid(proof, { mediumRequired: !mediumRequired }), false);
    assert.deepEqual(visibleMotionCadenceAcceptanceIssues({ presentationPassOrder: proof }),
      ['visible-motion-change-evidence-missing'], 'correct pass order is not visible-motion evidence');
  });
}

test('headed pass-order contract rejects absent, malformed and obsolete proofs', () => {
  for (const order of [null, undefined, {}, '', [], [opaque], [transparent],
    ['ordered-isosurface-and-overlay'], [opaque, null, transparent],
    [opaque, 1, transparent], [opaque, new String(refractive), transparent]]) {
    for (const mediumRequired of [false, true]) {
      assert.equal(isWorkerIsosurfacePassOrderValid(order, { mediumRequired }), false);
    }
  }
  for (const mediumRequired of [undefined, null, 0, 1, 'true', 'false']) {
    assert.equal(isWorkerIsosurfacePassOrderValid([opaque, transparent], { mediumRequired }), false);
  }
  assert.equal(isWorkerIsosurfacePassOrderValid([opaque, transparent]), false);
});

test('headed pass-order contract rejects every missing, duplicate or unknown pass', () => {
  for (const { order, mediumRequired } of validCases) {
    for (let index = 0; index < order.length; index++) {
      // Refraction is genuinely optional; all other passes are required here.
      if (order[index] !== refractive) {
        assert.equal(isWorkerIsosurfacePassOrderValid(order.filter((_, i) => i !== index),
          { mediumRequired }), false);
      }
      const duplicate = [...order];
      duplicate.splice(index, 0, order[index]);
      assert.equal(isWorkerIsosurfacePassOrderValid(duplicate, { mediumRequired }), false);
    }
    for (let index = 0; index <= order.length; index++) {
      const unknown = [...order];
      unknown.splice(index, 0, 'unknown-pass');
      assert.equal(isWorkerIsosurfacePassOrderValid(unknown, { mediumRequired }), false);
    }
  }
});

test('headed pass-order contract rejects all permutations except the submitted sequence', () => {
  const permutations = values => values.length === 0 ? [[]]
    : values.flatMap((value, i) => permutations(values.filter((_, j) => j !== i))
      .map(rest => [value, ...rest]));
  for (const { order, mediumRequired } of validCases) {
    for (const candidate of permutations(order)) {
      assert.equal(isWorkerIsosurfacePassOrderValid(candidate, { mediumRequired }),
        candidate.every((value, index) => value === order[index]), candidate.join(' -> '));
    }
  }
});

test('pass-order contract follows actual native submitted-pass recording, not obsolete fallback labels', () => {
  const producer = readFileSync(new URL('../src/services/workerOwnedIsosurfacePresenter.js', import.meta.url), 'utf8');
  const begin = producer.indexOf("const passOrder = ['opaque-isosurface'];");
  const end = producer.indexOf('submittedPassOrder = Object.freeze(passOrder);', begin);
  assert.ok(begin >= 0 && end > begin);
  const submitted = producer.slice(begin, end);
  assert.match(submitted, /if \(refractiveSurfaces\.length\) passOrder\.push\('refractive-isosurface'\)/);
  assert.match(submitted, /if \(packedMedium\) \{\s*passOrder\.push\('depth-clipped-participating-medium'\)/);
  assert.deepEqual([...submitted.matchAll(/passOrder\.push\('([^']+)'\)/g)].map(match => match[1]),
    [refractive, medium, transparent]);
  const published = producer.indexOf('frame.presentationPassOrder = submittedPassOrder;', end);
  assert.ok(published > end, 'published proof must use the exact submitted order');
});

test('headed sweep applies order checks to ready, empty and unrequested medium without removing other gates', () => {
  const source = readFileSync(new URL('../scripts/sph-headed-all-preset-cadence-sweep.mjs', import.meta.url), 'utf8');
  const call = /!isWorkerIsosurfacePassOrderValid\(passOrder,\s*\{\s*mediumRequired: (true|false)\s*\}\)/g;
  assert.deepEqual([...source.matchAll(call)].map(match => match[1]), ['true', 'false', 'false']);
  assert.doesNotMatch(source, /const (?:ordinaryPassOrder|hybridPassOrder)\s*=/);
  for (const gate of ['participating-medium-depth-clipping-missing',
    'participating-medium-premultiplied-alpha-missing', 'participating-medium-proof-flattening-mismatch',
    'participating-medium-surface-accounting-mismatch', 'collective-optical-shell-fallback-used',
    'participating-medium-not-ready-or-empty', 'participating-medium-aggregate-draw-missing',
    'empty-participating-medium-drew', 'unrequested-participating-medium-drew']) {
    assert.ok(source.includes(gate), `preserve ${gate}`);
  }
  assert.match(source, /visibleMotionCadenceAcceptanceIssues\(result\.cadence\)/);
  assert.match(source, /nominalRenderHz \* 0\.9/);
});
