import assert from 'node:assert/strict';
import {
  chmod,
  mkdir,
  mkdtemp,
  lstat,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  assertArtifactPathOutsideRepo,
  assertArtifactPathsPairwiseDistinct,
  canonicalJsonSha256,
  createNonProductionFixtureCapability,
  createFailSentinelWriter,
  exactWorktreeFingerprintsEqual,
  parseNodeTap,
  readHashedArtifact,
  runProcessToArtifacts,
  sha256Bytes
} from '../scripts/ss-release-evidence-common.mjs';

function fingerprint(overrides = {}) {
  return {
    gitHead: 'a'.repeat(40),
    sourceFingerprint: 'b'.repeat(64),
    worktreeDirty: true,
    worktreeStatusHash: 'c'.repeat(64),
    trackedAndUntrackedFileCount: 12,
    ...overrides
  };
}

test('common release evidence hashes canonically and compares every fingerprint field', () => {
  assert.equal(
    canonicalJsonSha256({ z: 1, a: { y: 2, x: 3 } }),
    canonicalJsonSha256({ a: { x: 3, y: 2 }, z: 1 })
  );
  assert.equal(sha256Bytes('release'), sha256Bytes(Buffer.from('release')));
  assert.equal(
    exactWorktreeFingerprintsEqual(fingerprint(), fingerprint()),
    true
  );
  for (const [field, value] of [
    ['gitHead', 'd'.repeat(40)],
    ['sourceFingerprint', 'e'.repeat(64)],
    ['worktreeDirty', false],
    ['worktreeStatusHash', 'f'.repeat(64)],
    ['trackedAndUntrackedFileCount', 13]
  ]) {
    assert.equal(
      exactWorktreeFingerprintsEqual(
        fingerprint(),
        fingerprint({ [field]: value })
      ),
      false,
      field
    );
  }
});

test('artifact guard rejects lexical and symlinked paths inside the repo', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ulg-release-common-'));
  try {
    const repoDir = path.join(root, 'repo');
    const outsideDir = path.join(root, 'outside');
    await mkdir(repoDir);
    await mkdir(outsideDir);
    await assert.rejects(
      assertArtifactPathOutsideRepo({
        artifactPath: path.join(repoDir, 'receipt.json'),
        repoDir
      }),
      /outside the repository/
    );
    const linkedRepo = path.join(outsideDir, 'linked-repo');
    await symlink(repoDir, linkedRepo, 'dir');
    await assert.rejects(
      assertArtifactPathOutsideRepo({
        artifactPath: path.join(linkedRepo, 'receipt.json'),
        repoDir
      }),
      /symbolic link/
    );
    const guarded = await assertArtifactPathOutsideRepo({
      artifactPath: path.join(outsideDir, 'receipt.json'),
      repoDir
    });
    assert.equal(guarded.artifactPath, path.join(outsideDir, 'receipt.json'));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('artifact guard rejects canonical pairwise collisions through symlinked parents', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ulg-release-distinct-'));
  try {
    const repoDir = path.join(root, 'repo');
    const outsideDir = path.join(root, 'outside');
    const outsideAlias = path.join(root, 'outside-alias');
    await mkdir(repoDir);
    await mkdir(outsideDir);
    await symlink(outsideDir, outsideAlias, 'dir');
    await assert.rejects(
      assertArtifactPathsPairwiseDistinct({
        repoDir,
        paths: [
          path.join(outsideDir, 'receipt.json'),
          path.join(outsideAlias, 'receipt.json')
        ]
      }),
      /symbolic link/
    );
    await assert.rejects(
      assertArtifactPathsPairwiseDistinct({
        repoDir,
        paths: [
          path.join(outsideDir, 'same.json'),
          path.join(outsideDir, '.', 'same.json')
        ]
      }),
      /canonically pairwise distinct/
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('TAP parser rejects skipped, TODO, cancelled, and filtered output even with forged zero summaries', () => {
  const base = `TAP version 13
ok 1 - retained
1..1
# tests 1
# suites 0
# pass 1
# fail 0
# cancelled 0
# skipped 0
# todo 0
`;
  for (const forged of [
    base.replace('ok 1 - retained', 'ok 1 - retained # SKIP forged'),
    base.replace('ok 1 - retained', 'ok 1 - retained # TODO forged'),
    base.replace('ok 1 - retained', 'not ok 1 - retained # CANCELLED forged'),
    `${base}# SKIP forged standalone directive\n`,
    `${base}# test name does not match pattern\n`,
    base.replace('# skipped 0', '# skipped 1'),
    base.replace('# todo 0', '# todo 1'),
    base.replace('# cancelled 0', '# cancelled 1')
  ]) {
    assert.equal(parseNodeTap(forged).successful, false, forged);
  }
});

test('TAP parser accepts only exact policy-listed skips and rejects malformed hierarchy', () => {
  const skipped = `TAP version 13
# Subtest: native proof
ok 1 - native proof # SKIP native dependency unavailable
1..1
# tests 1
# suites 0
# pass 0
# fail 0
# cancelled 0
# skipped 1
# todo 0
`;
  assert.equal(parseNodeTap(skipped, {
    expectedSkips: [{ name: 'native proof', reason: 'native dependency unavailable' }]
  }).successful, true);
  for (const forged of [
    parseNodeTap(skipped),
    parseNodeTap(skipped, {
      expectedSkips: [{ name: 'native proof', reason: 'different reason' }]
    }),
    parseNodeTap(skipped.replace('1..1', '1..2'), {
      expectedSkips: [{ name: 'native proof', reason: 'native dependency unavailable' }]
    }),
    parseNodeTap(skipped.replace('# skipped 1', '# skipped 0'), {
      expectedSkips: [{ name: 'native proof', reason: 'native dependency unavailable' }]
    }),
    parseNodeTap(skipped.replace('TAP version 13\n', ''), {
      expectedSkips: [{ name: 'native proof', reason: 'native dependency unavailable' }]
    })
  ]) {
    assert.equal(forged.successful, false);
  }
});

test('TAP parser validates nested Node TAP without confusing natural names for filtering', () => {
  const nested = `TAP version 13
# Subtest: outer level filtering is natural
    # Subtest: child cannot be filtered
    ok 1 - child cannot be filtered
    1..1
ok 1 - outer level filtering is natural
# Subtest: retained leaf
ok 2 - retained leaf
1..2
# tests 3
# suites 0
# pass 3
# fail 0
# cancelled 0
# skipped 0
# todo 0
`;
  assert.equal(parseNodeTap(nested).successful, true);

  const nestedFailure = nested
    .replace('ok 1 - child cannot be filtered', 'not ok 1 - child cannot be filtered')
    .replace('# pass 3', '# pass 2')
    .replace('# fail 0', '# fail 1');
  assert.equal(parseNodeTap(nestedFailure).successful, false);
  assert.equal(parseNodeTap(nested.replace('1..2', '1..3')).successful, false);
  assert.equal(parseNodeTap(nested.replace('1..2', '1..2\n1..2')).successful, false);

  const nestedSkip = `TAP version 13
# Subtest: parent
    # Subtest: nested native proof
    ok 1 - nested native proof # SKIP native dependency unavailable
    1..1
ok 1 - parent
1..1
# tests 2
# suites 0
# pass 1
# fail 0
# cancelled 0
# skipped 1
# todo 0
`;
  const expectedSkips = [{
    name: 'nested native proof',
    reason: 'native dependency unavailable'
  }];
  assert.equal(parseNodeTap(nestedSkip, { expectedSkips }).successful, true);
  assert.equal(parseNodeTap(nestedSkip).successful, false);
  assert.equal(parseNodeTap(nestedSkip, {
    expectedSkips: [{ name: 'nested native proof', reason: 'different reason' }]
  }).successful, false);
  assert.equal(parseNodeTap(`${nested}# test file does not match pattern\n`).successful, false);
});

test('release evidence refuses symlinked output and permits fixture capabilities only off-product', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ulg-release-symlink-'));
  try {
    const repoDir = path.join(root, 'repo');
    const fixtureDir = path.join(root, 'fixture');
    const target = path.join(root, 'target.json');
    const outputPath = path.join(root, 'output.json');
    await Promise.all([mkdir(repoDir), mkdir(fixtureDir), writeFile(target, 'target')]);
    await symlink(target, outputPath, 'file');
    await assert.rejects(
      createFailSentinelWriter({ outputPath, repoDir, sentinel: { status: 'failed' } }),
      /symbolic link/
    );
    await assert.rejects(
      readHashedArtifact({ artifactPath: outputPath, repoDir }),
      /symbolic link/
    );
    const capability = await createNonProductionFixtureCapability({
      repoDir: fixtureDir,
      productionRepoDir: repoDir
    });
    assert.ok(capability);
    await assert.rejects(
      createNonProductionFixtureCapability({
        repoDir,
        productionRepoDir: repoDir
      }),
      /cannot target/
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('fail sentinel is durable before replacement and artifact tampering changes its hash', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ulg-release-writer-'));
  try {
    const repoDir = path.join(root, 'repo');
    const outputPath = path.join(root, 'artifacts', 'receipt.json');
    await mkdir(repoDir);
    const writer = await createFailSentinelWriter({
      outputPath,
      repoDir,
      sentinel: { status: 'failed', reason: 'did not complete' }
    });
    assert.deepEqual(
      JSON.parse(await readFile(outputPath, 'utf8')),
      { status: 'failed', reason: 'did not complete' }
    );
    assert.deepEqual(
      await readdir(path.dirname(outputPath)),
      ['receipt.json'],
      'successful initial publication removes its private temporary hard link'
    );
    assert.equal(writer.replacementCount(), 0);
    await writer.replace({ status: 'complete' });
    assert.deepEqual(
      await readdir(path.dirname(outputPath)),
      ['receipt.json'],
      'successful replacement leaves no temporary artifact'
    );
    assert.equal(writer.replacementCount(), 1);
    const before = await readHashedArtifact({ artifactPath: outputPath, repoDir });
    await writeFile(outputPath, '{"status":"forged"}\n');
    const after = await readHashedArtifact({ artifactPath: outputPath, repoDir });
    assert.notEqual(before.sha256, after.sha256);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('fail sentinel never clobbers an existing initial target and refuses an external replacement before replace', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ulg-release-writer-noclobber-'));
  try {
    const repoDir = path.join(root, 'repo');
    const preexistingPath = path.join(root, 'preexisting.json');
    const outputPath = path.join(root, 'receipt.json');
    await mkdir(repoDir);
    await writeFile(preexistingPath, '{"status":"external initial"}\n');
    await assert.rejects(
      createFailSentinelWriter({
        outputPath: preexistingPath,
        repoDir,
        sentinel: { status: 'failed' }
      }),
      /already exists and will not be replaced/u
    );
    assert.equal(await readFile(preexistingPath, 'utf8'), '{"status":"external initial"}\n');

    const writer = await createFailSentinelWriter({
      outputPath,
      repoDir,
      sentinel: { status: 'failed' }
    });
    await rm(outputPath);
    await writeFile(outputPath, '{"status":"external replacement"}\n');
    await assert.rejects(
      writer.replace({ status: 'complete' }),
      /changed before replacement; external final retained/u
    );
    assert.equal(writer.replacementCount(), 0);
    assert.equal(await readFile(outputPath, 'utf8'), '{"status":"external replacement"}\n');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('existing-output adoption is explicit and requires the caller-provided stable identity', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ulg-release-writer-adopt-'));
  try {
    const repoDir = path.join(root, 'repo');
    const outputPath = path.join(root, 'validated-receipt.json');
    await mkdir(repoDir);
    await writeFile(outputPath, '{"status":"complete","validated":true}\n');
    const identity = await lstat(outputPath);
    await assert.rejects(
      createFailSentinelWriter({
        outputPath,
        repoDir,
        sentinel: { status: 'failed' },
        adoptExistingOutputIdentity: { dev: identity.dev }
      }),
      /requires a stable dev\+ino identity/u
    );
    await assert.rejects(
      createFailSentinelWriter({
        outputPath,
        repoDir,
        sentinel: { status: 'failed' },
        adoptExistingOutputIdentity: { dev: identity.dev, ino: identity.ino + 1 }
      }),
      /changed before it could be synced/u
    );
    assert.equal(await readFile(outputPath, 'utf8'), '{"status":"complete","validated":true}\n');

    const writer = await createFailSentinelWriter({
      outputPath,
      repoDir,
      sentinel: { status: 'failed' },
      adoptExistingOutputIdentity: { dev: identity.dev, ino: identity.ino }
    });
    assert.equal(writer.replacementCount(), 0);
    await writer.replace({ status: 'failed', reason: 'later validation failed' });
    assert.equal(writer.replacementCount(), 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('release evidence rejects existing artifact parents that are not exactly private', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ulg-release-parent-mode-'));
  try {
    const repoDir = path.join(root, 'repo');
    await mkdir(repoDir);
    for (const mode of [0o755, 0o777]) {
      const artifactDir = path.join(root, `artifacts-${mode.toString(8)}`);
      await mkdir(artifactDir, { mode: 0o700 });
      await chmod(artifactDir, mode);
      await assert.rejects(
        createFailSentinelWriter({
          outputPath: path.join(artifactDir, 'receipt.json'),
          repoDir,
          sentinel: { status: 'failed' }
        }),
        /exact private mode 0700/u
      );
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('fail sentinel syncs the temporary file before rename and the parent after rename', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ulg-release-sync-order-'));
  try {
    const repoDir = path.join(root, 'repo');
    const productionRepoDir = path.join(root, 'production-repo');
    const outputPath = path.join(root, 'artifacts', 'receipt.json');
    await Promise.all([mkdir(repoDir), mkdir(productionRepoDir)]);
    const capability = await createNonProductionFixtureCapability({ repoDir, productionRepoDir });
    const steps = [];
    const writer = await createFailSentinelWriter({
      outputPath,
      repoDir,
      sentinel: { status: 'failed' },
      fixture: {
        capability,
        productionRepoDir,
        afterAtomicishReplaceStep: ({ step }) => { steps.push(step); }
      }
    });
    assert.deepEqual(steps, [
      'before-temporary-sync',
      'after-temporary-sync',
      'before-rename',
      'after-rename',
      'before-parent-sync',
      'after-parent-sync'
    ]);
    steps.length = 0;
    await writer.replace({ status: 'complete' });
    assert.deepEqual(steps, [
      'before-temporary-sync',
      'after-temporary-sync',
      'before-rename',
      'after-rename',
      'before-parent-sync',
      'after-parent-sync'
    ]);

    const failedPath = path.join(root, 'failed-artifacts', 'receipt.json');
    await assert.rejects(
      createFailSentinelWriter({
        outputPath: failedPath,
        repoDir,
        sentinel: { status: 'failed' },
        fixture: {
          capability,
          productionRepoDir,
          afterAtomicishReplaceStep: ({ step }) => {
            if (step === 'before-rename') throw new Error('injected pre-rename failure');
          }
        }
      }),
      /injected pre-rename failure/u
    );
    await assert.rejects(lstat(failedPath), { code: 'ENOENT' });
    assert.equal(
      (await readdir(path.dirname(failedPath))).some((name) => /^\.receipt\.json\..*\.tmp$/u.test(name)),
      true,
      'a pre-rename failure retains its own temporary orphan instead of unlinking a raced name'
    );

    let failDirectorySync = false;
    const durableWriter = await createFailSentinelWriter({
      outputPath: path.join(root, 'durability-artifacts', 'receipt.json'),
      repoDir,
      sentinel: { status: 'failed' },
      fixture: {
        capability,
        productionRepoDir,
        afterAtomicishReplaceStep: ({ step }) => {
          if (failDirectorySync && step === 'before-parent-sync') {
            throw new Error('injected parent-sync failure');
          }
        }
      }
    });
    failDirectorySync = true;
    await assert.rejects(
      durableWriter.replace({ status: 'complete' }),
      /injected parent-sync failure/u
    );
    assert.equal(
      durableWriter.replacementCount(),
      0,
      'a post-rename parent-sync failure never reports a durable complete replacement'
    );
    failDirectorySync = false;
    await assert.rejects(
      durableWriter.replace({ status: 'failed', reason: 'parent sync previously failed' }),
      /changed before replacement; external final retained/u
    );
    assert.equal(durableWriter.replacementCount(), 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('subprocess capture streams stdout and stderr only to outside-repo artifacts', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ulg-release-process-'));
  try {
    const repoDir = path.join(root, 'repo');
    const artifacts = path.join(root, 'artifacts');
    await mkdir(repoDir);
    const result = await runProcessToArtifacts({
      executable: process.execPath,
      args: [
        '-e',
        "process.stdout.write('out'); process.stderr.write('err');"
      ],
      cwd: repoDir,
      env: process.env,
      stdoutPath: path.join(artifacts, 'stdout.log'),
      stderrPath: path.join(artifacts, 'stderr.log'),
      repoDir
    });
    assert.equal(result.exitCode, 0);
    assert.equal(result.signal, null);
    assert.equal(result.spawnError, null);
    assert.equal(await readFile(result.stdoutArtifact.path, 'utf8'), 'out');
    assert.equal(await readFile(result.stderrArtifact.path, 'utf8'), 'err');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('subprocess hard timeout terminates its exact owned process group and publishes partial evidence', {
  skip: process.platform === 'win32'
    ? 'POSIX process-group signaling is required'
    : false
}, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ulg-release-process-timeout-'));
  try {
    const repoDir = path.join(root, 'repo');
    const artifacts = path.join(root, 'artifacts');
    await mkdir(repoDir);
    const result = await runProcessToArtifacts({
      executable: process.execPath,
      args: ['-e', [
        "process.stdout.write('started\\n');",
        "process.on('SIGTERM', () => {",
        "  process.stdout.write('term\\n');",
        '  setTimeout(() => process.exit(0), 10);',
        '});',
        'setInterval(() => {}, 1_000);'
      ].join('\n')],
      cwd: repoDir,
      env: process.env,
      stdoutPath: path.join(artifacts, 'stdout.log'),
      stderrPath: path.join(artifacts, 'stderr.log'),
      repoDir,
      hardTimeoutMs: 100,
      ownedProcessGroup: true,
      termGraceMs: 500,
      killGraceMs: 500
    });
    assert.equal(result.timedOut, true);
    assert.equal(result.aborted, false);
    assert.equal(result.closeObserved, true);
    assert.equal(result.termination.mode, 'owned-detached-process-group');
    assert.equal(result.termination.reason, 'hard-timeout');
    assert.equal(result.termination.termSent, true);
    assert.equal(result.termination.killSent, false);
    assert.equal(result.termination.stopped, true);
    assert.equal(result.termination.error, null);
    assert.equal(result.termination.forcedCaptureClose, false);
    assert.match(await readFile(result.stdoutArtifact.path, 'utf8'), /started\nterm\n/u);
    assert.equal(await readFile(result.stderrArtifact.path, 'utf8'), '');
    assert.equal(
      (await readdir(artifacts)).some((name) => name.endsWith('.tmp')),
      false
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('subprocess hard timeout kills a TERM-ignoring owned grandchild after the coordinator exits', {
  skip: process.platform === 'win32'
    ? 'POSIX process-group signaling is required'
    : false,
  timeout: 5_000
}, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ulg-release-process-group-kill-'));
  let grandchildPid = null;
  try {
    const repoDir = path.join(root, 'repo');
    const artifacts = path.join(root, 'artifacts');
    await mkdir(repoDir);
    const grandchildSource = [
      "process.on('SIGTERM', () => {});",
      'setTimeout(() => process.exit(97), 3_000);',
      'setInterval(() => {}, 1_000);'
    ].join('\n');
    const parentSource = [
      "const { spawn } = require('node:child_process');",
      `const grandchild = spawn(process.execPath, ['-e', ${JSON.stringify(grandchildSource)}], { stdio: 'inherit' });`,
      "process.stdout.write(`grandchild=${grandchild.pid}\\n`);",
      "process.on('SIGTERM', () => process.exit(0));",
      'setTimeout(() => process.exit(98), 3_000);',
      'setInterval(() => {}, 1_000);'
    ].join('\n');
    const result = await runProcessToArtifacts({
      executable: process.execPath,
      args: ['-e', parentSource],
      cwd: repoDir,
      env: process.env,
      stdoutPath: path.join(artifacts, 'stdout.log'),
      stderrPath: path.join(artifacts, 'stderr.log'),
      repoDir,
      hardTimeoutMs: 150,
      ownedProcessGroup: true,
      termGraceMs: 100,
      killGraceMs: 750
    });
    const stdout = await readFile(result.stdoutArtifact.path, 'utf8');
    grandchildPid = Number(stdout.match(/grandchild=(\d+)/u)?.[1]);
    assert.ok(Number.isSafeInteger(grandchildPid) && grandchildPid > 0, stdout);
    assert.equal(result.timedOut, true);
    assert.equal(result.aborted, false);
    assert.equal(result.closeObserved, true);
    assert.equal(result.termination.termSent, true);
    assert.equal(result.termination.killSent, true);
    assert.equal(result.termination.stopped, true);
    assert.equal(result.termination.error, null);
    assert.equal(result.termination.forcedCaptureClose, false);
    assert.throws(
      () => process.kill(grandchildPid, 0),
      (error) => error?.code === 'ESRCH'
    );
    assert.equal(
      (await readdir(artifacts)).some((name) => name.endsWith('.tmp')),
      false
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('subprocess hard timeout force-settles capture when the owned close event is withheld', {
  skip: process.platform === 'win32'
    ? 'POSIX process-group signaling is required'
    : false,
  timeout: 3_000
}, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ulg-release-process-forced-close-'));
  try {
    const repoDir = path.join(root, 'repo');
    const productionRepoDir = path.join(root, 'production-repo');
    const artifacts = path.join(root, 'artifacts');
    await Promise.all([mkdir(repoDir), mkdir(productionRepoDir)]);
    const capability = await createNonProductionFixtureCapability({
      repoDir,
      productionRepoDir
    });
    const result = await runProcessToArtifacts({
      executable: process.execPath,
      args: ['-e', [
        "process.stdout.write('partial evidence\\n');",
        "process.on('SIGTERM', () => process.exit(0));",
        'setInterval(() => {}, 1_000);'
      ].join('\n')],
      cwd: repoDir,
      env: process.env,
      stdoutPath: path.join(artifacts, 'stdout.log'),
      stderrPath: path.join(artifacts, 'stderr.log'),
      repoDir,
      hardTimeoutMs: 100,
      ownedProcessGroup: true,
      termGraceMs: 200,
      killGraceMs: 200,
      fixture: {
        capability,
        productionRepoDir,
        suppressChildCloseSettlement: true
      }
    });
    const stdout = await readFile(result.stdoutArtifact.path, 'utf8');
    assert.equal(stdout, 'partial evidence\n');
    assert.equal(result.timedOut, true);
    assert.equal(result.aborted, false);
    assert.equal(result.closeObserved, false);
    assert.equal(result.termination.stopped, true);
    assert.equal(result.termination.forcedCaptureClose, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('subprocess abort signal terminates its exact owned process group before the hard deadline', {
  skip: process.platform === 'win32'
    ? 'POSIX process-group signaling is required'
    : false,
  timeout: 3_000
}, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ulg-release-process-abort-'));
  try {
    const repoDir = path.join(root, 'repo');
    const artifacts = path.join(root, 'artifacts');
    await mkdir(repoDir);
    const controller = new AbortController();
    const abortTimer = setTimeout(() => controller.abort('test cancellation'), 100);
    const result = await runProcessToArtifacts({
      executable: process.execPath,
      args: ['-e', [
        "process.stdout.write('started\\n');",
        "process.on('SIGTERM', () => process.exit(0));",
        'setInterval(() => {}, 1_000);'
      ].join('\n')],
      cwd: repoDir,
      env: process.env,
      stdoutPath: path.join(artifacts, 'stdout.log'),
      stderrPath: path.join(artifacts, 'stderr.log'),
      repoDir,
      hardTimeoutMs: 2_000,
      ownedProcessGroup: true,
      termGraceMs: 300,
      killGraceMs: 300,
      abortSignal: controller.signal
    });
    clearTimeout(abortTimer);
    assert.equal(result.timedOut, false);
    assert.equal(result.aborted, true);
    assert.equal(result.termination.reason, 'abort-signal');
    assert.equal(result.termination.termSent, true);
    assert.equal(result.termination.killSent, false);
    assert.equal(result.termination.stopped, true);
    assert.equal(result.termination.forcedCaptureClose, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('subprocess rejects an already-aborted launch before spawning or creating artifacts', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ulg-release-process-pre-abort-'));
  try {
    const repoDir = path.join(root, 'repo');
    const artifacts = path.join(root, 'artifacts');
    const markerPath = path.join(root, 'must-not-launch.marker');
    await mkdir(repoDir);
    const controller = new AbortController();
    controller.abort('test pre-cancellation');
    await assert.rejects(
      runProcessToArtifacts({
        executable: process.execPath,
        args: [
          '-e',
          `require('node:fs').writeFileSync(${JSON.stringify(markerPath)}, 'launched')`
        ],
        cwd: repoDir,
        env: process.env,
        stdoutPath: path.join(artifacts, 'stdout.log'),
        stderrPath: path.join(artifacts, 'stderr.log'),
        repoDir,
        hardTimeoutMs: 1_000,
        ownedProcessGroup: true,
        abortSignal: controller.signal
      }),
      (error) => error?.code === 'ERR_RELEASE_EVIDENCE_ABORTED'
    );
    await assert.rejects(lstat(markerPath), /ENOENT/u);
    await assert.rejects(lstat(artifacts), /ENOENT/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('subprocess capture enforces byte-exact command and aggregate output limits while removing partial artifacts', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ulg-release-process-limit-'));
  try {
    const repoDir = path.join(root, 'repo');
    const artifacts = path.join(root, 'artifacts');
    await mkdir(repoDir);
    const exact = await runProcessToArtifacts({
      executable: process.execPath,
      args: ['-e', "process.stdout.write(Buffer.alloc(3, 0x61)); process.stderr.write(Buffer.alloc(5, 0x62));"],
      cwd: repoDir,
      env: process.env,
      stdoutPath: path.join(artifacts, 'exact.stdout'),
      stderrPath: path.join(artifacts, 'exact.stderr'),
      repoDir,
      maxOutputBytes: 8
    });
    assert.equal(exact.stdoutArtifact.byteLength + exact.stderrArtifact.byteLength, 8);

    await assert.rejects(
      runProcessToArtifacts({
        executable: process.execPath,
        args: ['-e', [
          'const block = Buffer.alloc(4096, 0x78);',
          'process.stdout.write(block);',
          'setInterval(() => process.stderr.write(block), 5);'
        ].join(' ')],
        cwd: repoDir,
        env: process.env,
        stdoutPath: path.join(artifacts, 'overflow.stdout'),
        stderrPath: path.join(artifacts, 'overflow.stderr'),
        repoDir,
        maxOutputBytes: 1024
      }),
      (error) => error?.code === 'ERR_RELEASE_EVIDENCE_OUTPUT_LIMIT'
        && /stdout/.test(error.message)
    );
    assert.deepEqual(
      await readdir(artifacts),
      ['exact.stderr', 'exact.stdout']
    );

    const aggregateOutputBudget = { maxByteLength: 6, byteLength: 0 };
    await runProcessToArtifacts({
      executable: process.execPath,
      args: ['-e', "process.stdout.write('1234');"],
      cwd: repoDir,
      env: process.env,
      stdoutPath: path.join(artifacts, 'aggregate-first.stdout'),
      stderrPath: path.join(artifacts, 'aggregate-first.stderr'),
      repoDir,
      maxOutputBytes: 8,
      aggregateOutputBudget
    });
    await assert.rejects(
      runProcessToArtifacts({
        executable: process.execPath,
        args: ['-e', "process.stderr.write('5678');"],
        cwd: repoDir,
        env: process.env,
        stdoutPath: path.join(artifacts, 'aggregate-overflow.stdout'),
        stderrPath: path.join(artifacts, 'aggregate-overflow.stderr'),
        repoDir,
        maxOutputBytes: 8,
        aggregateOutputBudget
      }),
      (error) => error?.code === 'ERR_RELEASE_EVIDENCE_OUTPUT_LIMIT'
        && /aggregate output/.test(error.message)
    );
    assert.equal(aggregateOutputBudget.byteLength, 4);
    assert.deepEqual(
      await readdir(artifacts),
      ['aggregate-first.stderr', 'aggregate-first.stdout', 'exact.stderr', 'exact.stdout']
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('subprocess capture rolls back only its committed counterpart when the second target appears', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ulg-release-process-commit-'));
  try {
    const repoDir = path.join(root, 'repo');
    const stdoutDir = path.join(root, 'stdout-artifacts');
    const stderrDir = path.join(root, 'stderr-artifacts');
    const stdoutPath = path.join(stdoutDir, 'stdout.log');
    const stderrPath = path.join(stderrDir, 'stderr.log');
    await mkdir(repoDir);
    await assert.rejects(
      runProcessToArtifacts({
        executable: process.execPath,
        args: ['-e', [
          "const fs = require('node:fs');",
          "process.stdout.write('owned stdout');",
          `fs.writeFileSync(${JSON.stringify(stderrPath)}, 'inherited stderr');`
        ].join(' ')],
        cwd: repoDir,
        env: process.env,
        stdoutPath,
        stderrPath,
        repoDir
      }),
      (error) => /already exists and will not be replaced/u.test(error?.message ?? '')
    );
    assert.deepEqual(await readdir(stdoutDir), []);
    assert.equal((await lstat(stderrPath)).isFile(), true);
    assert.equal(await readFile(stderrPath, 'utf8'), 'inherited stderr');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('subprocess capture preserves an external replacement before its post-link identity audit', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ulg-release-process-post-link-race-'));
  try {
    const repoDir = path.join(root, 'repo');
    const productionRepoDir = path.join(root, 'production-repo');
    const stdoutDir = path.join(root, 'stdout-artifacts');
    const stderrDir = path.join(root, 'stderr-artifacts');
    const stdoutPath = path.join(stdoutDir, 'stdout.log');
    const stderrPath = path.join(stderrDir, 'stderr.log');
    await Promise.all([
      mkdir(repoDir),
      mkdir(productionRepoDir),
      mkdir(stdoutDir, { mode: 0o700 })
    ]);
    const capability = await createNonProductionFixtureCapability({
      repoDir,
      productionRepoDir
    });
    let swapped = false;
    await assert.rejects(
      runProcessToArtifacts({
        executable: process.execPath,
        args: ['-e', "process.stdout.write('owned stdout');"],
        cwd: repoDir,
        env: process.env,
        stdoutPath,
        stderrPath,
        repoDir,
        fixture: {
          capability,
          productionRepoDir,
          afterArtifactLinked: async ({ artifactPath }) => {
            if (artifactPath !== stdoutPath) return;
            // Replace the just-linked final name before its identity audit.
            // This replacement is external evidence, not rollback-owned.
            await rm(artifactPath);
            await writeFile(artifactPath, 'post-link replacement');
            swapped = true;
          }
        }
      }),
      /identity changed during artifact commit; external final retained/u
    );
    assert.equal(swapped, true);
    assert.equal(await readFile(stdoutPath, 'utf8'), 'post-link replacement');
    assert.equal(
      (await readdir(stdoutDir)).some((name) => /^stdout\.log\..*\.tmp$/u.test(name)),
      true
    );
    await assert.rejects(lstat(stderrPath), { code: 'ENOENT' });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('subprocess capture preserves an external replacement between identity verification and temporary unlink', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ulg-release-process-post-verify-race-'));
  try {
    const repoDir = path.join(root, 'repo');
    const productionRepoDir = path.join(root, 'production-repo');
    const stdoutDir = path.join(root, 'stdout-artifacts');
    const stderrDir = path.join(root, 'stderr-artifacts');
    const stdoutPath = path.join(stdoutDir, 'stdout.log');
    const stderrPath = path.join(stderrDir, 'stderr.log');
    await Promise.all([
      mkdir(repoDir),
      mkdir(productionRepoDir),
      mkdir(stdoutDir, { mode: 0o700 })
    ]);
    const capability = await createNonProductionFixtureCapability({
      repoDir,
      productionRepoDir
    });
    let swapped = false;
    await assert.rejects(
      runProcessToArtifacts({
        executable: process.execPath,
        args: ['-e', "process.stdout.write('owned stdout');"],
        cwd: repoDir,
        env: process.env,
        stdoutPath,
        stderrPath,
        repoDir,
        fixture: {
          capability,
          productionRepoDir,
          afterArtifactIdentityVerified: async ({ artifactPath }) => {
            if (artifactPath !== stdoutPath) return;
            await rm(artifactPath);
            await writeFile(artifactPath, 'post-verification replacement');
            swapped = true;
          }
        }
      }),
      /identity changed after artifact verification; external final retained/u
    );
    assert.equal(swapped, true);
    assert.equal(await readFile(stdoutPath, 'utf8'), 'post-verification replacement');
    assert.equal(
      (await readdir(stdoutDir)).some((name) => /^stdout\.log\..*\.tmp$/u.test(name)),
      true
    );
    await assert.rejects(lstat(stderrPath), { code: 'ENOENT' });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('subprocess capture scrubs NODE_OPTIONS so a full test inventory cannot be filtered', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ulg-release-node-options-'));
  try {
    const repoDir = path.join(root, 'repo');
    const artifacts = path.join(root, 'artifacts');
    const testPath = path.join(repoDir, 'inventory.test.mjs');
    await mkdir(repoDir);
    await writeFile(testPath, [
      "import test from 'node:test';",
      "test('inventory first', () => {});",
      "test('inventory second', () => {});",
      ''
    ].join('\n'));
    const result = await runProcessToArtifacts({
      executable: process.execPath,
      args: ['--test', '--test-reporter=tap', testPath],
      cwd: repoDir,
      env: { NODE_OPTIONS: '--test-name-pattern=inventory first' },
      stdoutPath: path.join(artifacts, 'stdout.tap'),
      stderrPath: path.join(artifacts, 'stderr.log'),
      repoDir
    });
    assert.equal(result.exitCode, 0);
    const tap = parseNodeTap(await readFile(result.stdoutArtifact.path, 'utf8'));
    assert.equal(
      tap.successful,
      true,
      JSON.stringify({
        tap,
        stderr: await readFile(result.stderrArtifact.path, 'utf8')
      })
    );
    assert.equal(tap.summary.tests, 2);
    assert.equal(tap.summary.pass, 2);
    assert.equal(tap.summary.skipped, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
