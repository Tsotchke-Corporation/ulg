import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  createSphMlsMpmKernelBundleLoader,
  loadSphMlsMpmKernelBundle
} from '../src/runtime/sph/sphMlsMpmKernelBundleLoader.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function namespace(label) {
  return Object.freeze(Object.assign(Object.create(null), {
    label,
    mlsMpmMechanicsFieldGridUpdateWgsl() { return label; }
  }));
}

test('mechanics bundle loader validates its importer without eagerly invoking it', async () => {
  for (const importer of [undefined, null, false, 1, 'import', {}, []]) {
    assert.throws(() => createSphMlsMpmKernelBundleLoader(importer), TypeError);
  }
  let calls = 0;
  const expected = namespace('lazy');
  const load = createSphMlsMpmKernelBundleLoader(() => { calls += 1; return expected; });
  assert.equal(typeof load, 'function');
  assert.equal(load.length, 0);
  await Promise.resolve();
  assert.equal(calls, 0, 'factory creation and unrelated microtasks cannot import the bundle');
  const first = load();
  assert.ok(first instanceof Promise);
  assert.equal(calls, 0, 'the first importer runs in its scheduled microtask');
  assert.equal(await first, expected);
  assert.equal(calls, 1);
});

test('mechanics bundle loader shares the exact pending and fulfilled promise and namespace across consumers', async () => {
  const imported = deferred();
  let calls = 0;
  const load = createSphMlsMpmKernelBundleLoader(() => { calls += 1; return imported.promise; });
  const first = load();
  const concurrent = Array.from({ length: 32 }, () => load());
  assert.ok(concurrent.every(promise => promise === first));
  await Promise.resolve();
  assert.equal(calls, 1);
  assert.equal(load(), first, 'a still-pending import cannot allocate another consumer promise');
  const expected = namespace('shared');
  imported.resolve(expected);
  const results = await Promise.all(concurrent);
  assert.ok(results.every(value => value === expected), 'namespace exports are not copied or wrapped');
  assert.equal(load(), first, 'fulfilled reuse retains the original promise object');
  assert.equal(await load(), expected);
  assert.equal(calls, 1);
});

for (const reason of [new Error('bundle import failed'), Object.freeze({ code: 'IMPORT_FAILED' }), null]) {
  test(`mechanics bundle loader shares original rejection and retries only on a later call (${reason?.code || reason?.message || 'null'})`, async () => {
    const attempts = [];
    const load = createSphMlsMpmKernelBundleLoader(() => {
      const attempt = deferred();
      attempts.push(attempt);
      return attempt.promise;
    });
    const failed = load();
    const consumers = [failed, load(), load()];
    assert.ok(consumers.every(promise => promise === failed));
    const settled = Promise.allSettled(consumers);
    await Promise.resolve();
    assert.equal(attempts.length, 1);
    attempts[0].reject(reason);
    const outcomes = await settled;
    assert.ok(outcomes.every(outcome => outcome.status === 'rejected' && outcome.reason === reason));
    await Promise.resolve();
    assert.equal(attempts.length, 1, 'failure does not schedule an automatic background retry');
    const retried = load();
    assert.notEqual(retried, failed);
    assert.equal(load(), retried);
    await Promise.resolve();
    assert.equal(attempts.length, 2);
    const expected = namespace('retried');
    attempts[1].resolve(expected);
    assert.equal(await retried, expected);
    assert.equal(load(), retried);
    assert.equal(attempts.length, 2);
  });
}

test('mechanics bundle loader turns a synchronous importer throw into one shared rejected attempt', async () => {
  const reason = new Error('synchronous import failure');
  const expected = namespace('sync-retry');
  let calls = 0;
  const load = createSphMlsMpmKernelBundleLoader(() => {
    calls += 1;
    if (calls === 1) throw reason;
    return expected;
  });
  let first;
  assert.doesNotThrow(() => { first = load(); });
  assert.equal(load(), first);
  await assert.rejects(first, error => error === reason);
  assert.equal(calls, 1);
  const retry = load();
  assert.notEqual(retry, first);
  assert.equal(await retry, expected);
  assert.equal(load(), retry);
  assert.equal(calls, 2);
});

test('mechanics bundle loader isolates attempts and cached namespaces between loader instances', async () => {
  const attempts = [];
  const importer = () => {
    const attempt = deferred();
    attempts.push(attempt);
    return attempt.promise;
  };
  const left = createSphMlsMpmKernelBundleLoader(importer);
  const right = createSphMlsMpmKernelBundleLoader(importer);
  const leftPending = left();
  const rightPending = right();
  assert.notEqual(leftPending, rightPending);
  await Promise.resolve();
  assert.equal(attempts.length, 2);
  const leftNamespace = namespace('left');
  attempts[0].resolve(leftNamespace);
  assert.equal(await leftPending, leftNamespace);
  const reason = new Error('right only');
  const rejected = assert.rejects(rightPending, error => error === reason);
  attempts[1].reject(reason);
  await rejected;
  assert.equal(left(), leftPending, 'one loader failure cannot evict another loader');
  const rightRetry = right();
  await Promise.resolve();
  assert.equal(attempts.length, 3);
  const rightNamespace = namespace('right');
  attempts[2].resolve(rightNamespace);
  assert.equal(await rightRetry, rightNamespace);
  assert.equal(await left(), leftNamespace);
});

test('mechanics bundle loader supports a re-entrant consumer without duplicate import attempts', async () => {
  const expected = namespace('re-entrant');
  let nested;
  let calls = 0;
  const load = createSphMlsMpmKernelBundleLoader(() => {
    calls += 1;
    nested = load();
    return expected;
  });
  const first = load();
  assert.equal(await first, expected);
  assert.equal(nested, first);
  assert.equal(calls, 1);
});

test('production mechanics loader retains one lazy dynamic import of the original bundle', () => {
  assert.equal(typeof loadSphMlsMpmKernelBundle, 'function');
  const source = readFileSync(new URL('../src/runtime/sph/sphMlsMpmKernelBundleLoader.js', import.meta.url), 'utf8');
  assert.match(source, /export\s+const\s+loadSphMlsMpmKernelBundle\s*=\s*createSphMlsMpmKernelBundleLoader\(\s*\(\)\s*=>\s*import\(['"]\.\/sphMlsMpmGpuStep\.js['"]\)/);
  assert.equal([...source.matchAll(/import\(['"]\.\/sphMlsMpmGpuStep\.js['"]\)/g)].length, 1);
  assert.doesNotMatch(source, /\bfrom\s*['"]\.\/sphMlsMpmGpuStep\.js['"]/,
    'the cycle-sensitive bundle must not become a static dependency');
});

// These are structural tripwires for the deliberately tiny call-site change,
// not substitutes for the existing mechanical admission/execution tests.
for (const [file, firstAfterAwait, admissionFailure] of [
  ['sphGridGpuKernel.js', /mechanicsFieldBinding\s*=\s*mechanicsFieldKernelBundle\.createFusedSchroederActiveNodeBinding\(/,
    'Required mechanics-field P2G could not authenticate the exact generation-owned field view'],
  ['sphGridUpdateGpuKernel.js', /if\s*\(fusedTransaction\s*!=\s*null\s*&&\s*!fusedMechanicsFieldGridUpdateAdmission\(/,
    'Fused grid update lost its exact pending transaction before submission'],
  ['sphG2pGpuKernel.js', /if\s*\(!fusedInputsRemainAdmitted\(\)\)/,
    'fused-g2p-provenance-lost-after-import']
]) {
  test(`mechanics bundle ${file} retains awaited loading and its post-await admission boundary`, () => {
    const source = readFileSync(new URL(`../src/runtime/sph/${file}`, import.meta.url), 'utf8');
    assert.match(source, /import\s*\{\s*loadSphMlsMpmKernelBundle\s*\}\s*from\s*['"]\.\/sphMlsMpmKernelBundleLoader\.js['"]/);
    const calls = [...source.matchAll(/await\s+loadSphMlsMpmKernelBundle\(\)/g)];
    assert.equal(calls.length, 1, 'one retained async boundary per staged consumer');
    assert.doesNotMatch(source, /import\(\s*['"]\.\/sphMlsMpmGpuStep\.js['"]/);
    const continuation = source.slice(calls[0].index + calls[0][0].length).replace(/^;\s*/, '');
    assert.equal(continuation.search(firstAfterAwait), 0,
      'the existing binding/admission check still immediately follows the await');
    assert.ok(continuation.indexOf(admissionFailure) >= 0,
      'lost exact mechanical authority must retain its fail-closed error');
  });
}
