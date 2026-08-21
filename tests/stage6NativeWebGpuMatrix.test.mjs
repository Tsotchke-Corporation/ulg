import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
import { lstat, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  NATIVE_WEBGPU_MATRIX_ARMS,
  NATIVE_WEBGPU_SOURCE_ATTESTATION_SCHEMA,
  acquireNativeWebGpuMatrixProcessLock,
  createNativeWebGpuServerSourceAttestation,
  createNativeWebGpuMatrixCommandPolicy,
  decodeViteRawModule,
  evaluateNativeWebGpuMatrixReceipt,
  nativeGpuFailureLines,
  runNativeWebGpuMatrixReceipt
} from '../scripts/stage6-native-webgpu-matrix.mjs';
import {
  SS_CONTAINED_POLICY_TRACK,
  canonicalJsonSha256,
  createNonProductionFixtureCapability,
  parseNodeTap,
  sha256Bytes
} from '../scripts/ss-release-evidence-common.mjs';

const execFile = promisify(execFileCallback);

async function initializeGitFixture(repoDir) {
  await execFile('git', ['init', '--quiet'], { cwd: repoDir });
  await execFile('git', ['config', 'user.email', 'fixture@example.invalid'], { cwd: repoDir });
  await execFile('git', ['config', 'user.name', 'Native Matrix Fixture'], { cwd: repoDir });
  await execFile('git', ['add', '.'], { cwd: repoDir });
  await execFile('git', ['commit', '--quiet', '-m', 'fixture'], { cwd: repoDir });
}

function sourcePolicyRepoPaths(policy) {
  return new Set([
    ...policy.serverSourceAttestation.modules.map(({ repoPath }) => repoPath),
    ...policy.serverSourceAttestation.transformedEdges.flatMap((edge) => [
      edge.parentRepoPath,
      edge.childRepoPath
    ])
  ]);
}

async function writeFixtureViteSources(repoDir, policy) {
  const rawSources = new Map();
  for (const repoPath of sourcePolicyRepoPaths(policy)) {
    const source = `export const pin = ${JSON.stringify(repoPath)};\n`;
    rawSources.set(`/${repoPath}?raw`, source);
    const localPath = path.join(repoDir, repoPath);
    await mkdir(path.dirname(localPath), { recursive: true });
    await writeFile(localPath, source);
  }
  return rawSources;
}

function fixtureViteModuleFetcher(policy, rawSources, {
  transformedOverride = null
} = {}) {
  return async ({ url }) => {
    const key = `${url.pathname}${url.search}`;
    if (url.search === '?raw') {
      return {
        requestUrl: url.href,
        statusCode: 200,
        contentType: 'text/javascript',
        body: Buffer.from(`export default ${JSON.stringify(rawSources.get(key))}`)
      };
    }
    const parentRepoPath = url.pathname.slice(1);
    const edges = policy.serverSourceAttestation.transformedEdges.filter(
      (edge) => edge.parentRepoPath === parentRepoPath
    );
    const source = transformedOverride?.({ url, edges })
      ?? edges.map(({ childRepoPath }) => (
        `import ${JSON.stringify(`/${childRepoPath}?t=fixture`)};`
      )).join('\n');
    return {
      requestUrl: url.href,
      statusCode: 200,
      contentType: 'text/javascript',
      body: Buffer.from(source)
    };
  };
}

function controlledOutputBudgetPolicy(markerPath) {
  const base = createNativeWebGpuMatrixCommandPolicy();
  const command = (id, args) => Object.freeze({
    id,
    executable: 'node',
    args: Object.freeze(args),
    environment: Object.freeze({}),
    maxOutputBytes: 16,
    hardTimeoutMs: 1_000,
    ownedProcessGroup: true,
    termGraceMs: 100,
    killGraceMs: 100,
    expectedTestNames: Object.freeze([])
  });
  const core = {
    schema: base.schema,
    policyId: 'stage6-native-webgpu-controlled-output-fixture-v1',
    policyTrack: base.policyTrack,
    executionMode: base.executionMode,
    baseUrl: base.baseUrl,
    unsetEnvironmentKeys: base.unsetEnvironmentKeys,
    unsetEnvironmentPrefixes: base.unsetEnvironmentPrefixes,
    unsetEnvironmentSuffixes: base.unsetEnvironmentSuffixes,
    aggregateMaxOutputBytes: 32,
    executionAbsoluteTimeoutMs: 5_000,
    postExecutionAttestationReserveMs: 100,
    executionCleanupAllowanceMs: 200,
    serverSourceAttestation: base.serverSourceAttestation,
    commands: Object.freeze([
      command('controlled-output-first', [
        '-e', "process.stdout.write('0123456789abcdef')"
      ]),
      command('controlled-output-second', [
        '-e', "process.stdout.write('fedcba9876543210')"
      ]),
      command('must-not-launch', [
        '-e', `require('node:fs').writeFileSync(${JSON.stringify(markerPath)}, 'launched')`
      ])
    ])
  };
  return Object.freeze({
    ...core,
    commandPolicySha256: canonicalJsonSha256(core)
  });
}

function fingerprint(overrides = {}) {
  return {
    gitHead: 'a'.repeat(40),
    sourceFingerprint: 'b'.repeat(64),
    worktreeDirty: true,
    worktreeStatusHash: 'c'.repeat(64),
    trackedAndUntrackedFileCount: 700,
    ...overrides
  };
}

function tapForArm(arm, { skipFirst = false, fail = false } = {}) {
  const rows = ['TAP version 13'];
  arm.expectedTestNames.forEach((name, index) => {
    rows.push(`# Subtest: ${name}`);
    rows.push(
      `${fail && index === 0 ? 'not ' : ''}ok ${index + 1} - ${name}`
        + (skipFirst && index === 0 ? ' # SKIP forged skip' : '')
    );
  });
  rows.push(`1..${arm.expectedTestNames.length}`);
  rows.push(`# tests ${arm.expectedTestNames.length}`);
  rows.push('# suites 0');
  rows.push(`# pass ${fail ? Math.max(0, arm.expectedTestNames.length - 1) : arm.expectedTestNames.length}`);
  rows.push(`# fail ${fail ? 1 : 0}`);
  rows.push('# cancelled 0');
  rows.push(`# skipped ${skipFirst ? 1 : 0}`);
  rows.push('# todo 0');
  return `${rows.join('\n')}\n`;
}

function artifact(path, text) {
  return {
    path,
    byteLength: Buffer.byteLength(text),
    sha256: sha256Bytes(text),
    text
  };
}

function successfulFixtureExecution({
  hardTimeoutMs,
  termGraceMs,
  killGraceMs,
  durationMs = 1
}) {
  return {
    exitCode: 0,
    signal: null,
    spawnError: null,
    timedOut: false,
    aborted: false,
    closeObserved: true,
    durationMs,
    termination: {
      mode: 'owned-detached-process-group',
      reason: 'natural-exit',
      hardTimeoutMs,
      termGraceMs,
      killGraceMs,
      termSent: false,
      killSent: false,
      stopped: true,
      error: null,
      forcedCaptureClose: false
    }
  };
}

function sourceAttestation(expectedPolicy, currentFingerprint) {
  const sourcePolicy = expectedPolicy.serverSourceAttestation;
  const modules = sourcePolicy.modules.map((pin) => {
    const bytes = Buffer.from(`pinned source for ${pin.repoPath}\n`);
    const sha256 = sha256Bytes(bytes);
    const requestUrl = new URL(
      pin.rawModulePath,
      `${sourcePolicy.origin}/`
    ).href;
    return {
      repoPath: pin.repoPath,
      rawModulePath: pin.rawModulePath,
      requestUrl,
      responseRequestUrl: requestUrl,
      httpStatus: 200,
      contentType: 'text/javascript',
      localByteLength: bytes.byteLength,
      localSha256: sha256,
      servedByteLength: bytes.byteLength,
      servedSha256: sha256,
      decodeError: null,
      matched: true
    };
  });
  const transformedEdges = sourcePolicy.transformedEdges.map((edge) => {
    const parentRaw = {
      repoPath: edge.parentRepoPath,
      requestUrl: new URL(`/${edge.parentRepoPath}?raw`, `${sourcePolicy.origin}/`).href,
      responseRequestUrl: new URL(`/${edge.parentRepoPath}?raw`, `${sourcePolicy.origin}/`).href,
      httpStatus: 200,
      contentType: 'text/javascript',
      localByteLength: 1,
      localSha256: 'a'.repeat(64),
      servedByteLength: 1,
      servedSha256: 'a'.repeat(64),
      decodeError: null,
      matched: true
    };
    const childRaw = {
      ...parentRaw,
      repoPath: edge.childRepoPath,
      requestUrl: new URL(`/${edge.childRepoPath}?raw`, `${sourcePolicy.origin}/`).href,
      responseRequestUrl: new URL(`/${edge.childRepoPath}?raw`, `${sourcePolicy.origin}/`).href
    };
    const parentTransformRequestUrl = new URL(
      `/${edge.parentRepoPath}?nativeMatrixSource=${currentFingerprint.sourceFingerprint}`,
      `${sourcePolicy.origin}/`
    ).href;
    const childSpecifier = `/${edge.childRepoPath}?t=fixture`;
    return {
      parentRepoPath: edge.parentRepoPath,
      childRepoPath: edge.childRepoPath,
      parentTransformRequestUrl,
      parentTransformResponseRequestUrl: parentTransformRequestUrl,
      parentTransformHttpStatus: 200,
      parentTransformContentType: 'text/javascript',
      parentTransformByteLength: 1,
      parentTransformSha256: 'b'.repeat(64),
      childSpecifier,
      childResolvedUrl: new URL(childSpecifier, parentTransformRequestUrl).href,
      parentRaw,
      childRaw,
      matched: true
    };
  });
  const core = {
    schema: NATIVE_WEBGPU_SOURCE_ATTESTATION_SCHEMA,
    status: 'matched',
    policyId: expectedPolicy.policyId,
    commandPolicySha256: expectedPolicy.commandPolicySha256,
    sourcePolicySha256: canonicalJsonSha256(sourcePolicy),
    sourceFingerprint: currentFingerprint,
    origin: sourcePolicy.origin,
    attestationScope: sourcePolicy.attestationScope,
    scopeStatement: sourcePolicy.scopeStatement,
    executionProvenance: 'production',
    moduleCount: modules.length,
    modules,
    transformedEdgeCount: transformedEdges.length,
    transformedEdges
  };
  return {
    ...core,
    attestationSha256: canonicalJsonSha256(core)
  };
}

function fixture() {
  const expectedPolicy = createNativeWebGpuMatrixCommandPolicy();
  const currentFingerprint = fingerprint();
  const attestation = sourceAttestation(
    expectedPolicy,
    currentFingerprint
  );
  const artifactEvidence = NATIVE_WEBGPU_MATRIX_ARMS.map((arm, index) => ({
    id: arm.id,
    stdout: artifact(`/tmp/native-${index}.stdout`, tapForArm(arm)),
    stderr: artifact(`/tmp/native-${index}.stderr`, '')
  }));
  const outputByteLength = artifactEvidence.reduce((sum, entry) => (
    sum + entry.stdout.byteLength + entry.stderr.byteLength
  ), 0);
  const receipt = {
    schema: 'peercompute.ulg.stage6-native-webgpu-matrix-receipt.v1',
    policyTrack: SS_CONTAINED_POLICY_TRACK,
    status: 'complete',
    executionProvenance: 'production',
    commandPolicy: expectedPolicy,
    sourceFingerprintBefore: currentFingerprint,
    sourceFingerprintAfter: currentFingerprint,
    serverSourceAttestationBefore: structuredClone(attestation),
    serverSourceAttestationAfter: structuredClone(attestation),
    outputCapture: {
      maxByteLength: expectedPolicy.aggregateMaxOutputBytes,
      byteLength: outputByteLength
    },
    executionTiming: {
      absoluteTimeoutMs: expectedPolicy.executionAbsoluteTimeoutMs,
      postExecutionAttestationReserveMs:
        expectedPolicy.postExecutionAttestationReserveMs,
      cleanupAllowanceMs: expectedPolicy.executionCleanupAllowanceMs,
      durationMs: NATIVE_WEBGPU_MATRIX_ARMS.length * 10
    },
    processLock: {
      policy: 'exclusive-native-webgpu-host-lane-v1',
      retainedForManualInspection: false,
      dispositionCompleted: true,
      dispositionError: null
    },
    commands: NATIVE_WEBGPU_MATRIX_ARMS.map((arm, index) => ({
      id: arm.id,
      index,
      invocationSha256: canonicalJsonSha256(arm),
      exitCode: 0,
      signal: null,
      spawnError: null,
      effectiveHardTimeoutMs: arm.hardTimeoutMs,
      timedOut: false,
      aborted: false,
      closeObserved: true,
      durationMs: 10,
      termination: {
        mode: 'owned-detached-process-group',
        reason: 'natural-exit',
        hardTimeoutMs: arm.hardTimeoutMs,
        termGraceMs: arm.termGraceMs,
        killGraceMs: arm.killGraceMs,
        termSent: false,
        killSent: false,
        stopped: true,
        error: null,
        forcedCaptureClose: false
      },
      stdoutArtifact: {
        path: artifactEvidence[index].stdout.path,
        byteLength: artifactEvidence[index].stdout.byteLength,
        sha256: artifactEvidence[index].stdout.sha256
      },
      stderrArtifact: {
        path: artifactEvidence[index].stderr.path,
        byteLength: artifactEvidence[index].stderr.byteLength,
        sha256: artifactEvidence[index].stderr.sha256
      },
      tap: parseNodeTap(artifactEvidence[index].stdout.text)
    }))
  };
  return {
    receipt,
    expectedPolicy,
    currentFingerprint,
    artifactEvidence
  };
}

test('native matrix policy pins all eleven audited sequential arms and exact URLs', () => {
  const policy = createNativeWebGpuMatrixCommandPolicy();
  assert.equal(policy.commands.length, 11);
  assert.equal(policy.executionMode, 'sequential-one-process-at-a-time');
  assert.equal(policy.aggregateMaxOutputBytes, 48 * 1024 * 1024);
  assert.equal(policy.executionAbsoluteTimeoutMs, 900_000);
  assert.equal(policy.postExecutionAttestationReserveMs, 30_000);
  assert.equal(policy.executionCleanupAllowanceMs, 5_000);
  assert.deepEqual(policy.unsetEnvironmentKeys, [
    'NODE_OPTIONS',
    'ULG_CROSS_LEVEL_M3_DIAGNOSTIC_RATIOS'
  ]);
  assert.deepEqual(policy.unsetEnvironmentPrefixes, [
    'ULG_RUN_NATIVE_',
    'ULG_IRON_ICE_CONTACT_IMPACT_DIAGNOSTIC_'
  ]);
  assert.deepEqual(policy.unsetEnvironmentSuffixes, ['_CHROME']);
  assert.equal(
    policy.serverSourceAttestation.origin,
    'https://127.0.0.1:5174'
  );
  assert.equal(policy.serverSourceAttestation.modules.length, 17);
  assert.equal(policy.serverSourceAttestation.transformedEdges.length, 22);
  assert.equal(
    policy.serverSourceAttestation.modules.every(
      (entry) => entry.rawModulePath.endsWith('?raw')
    ),
    true
  );
  assert.deepEqual(
    policy.serverSourceAttestation.modules.slice(-5).map(
      (entry) => entry.repoPath
    ),
    [
      'src/runtime/sph/sphMlsMpmGpuStep.js',
      'src/runtime/sph/sphSpatialGasLedgerEosGpu.js',
      'src/runtime/sph/sphGridUpdateGpuKernel.js',
      'ulg-gpu-abi/src/schroederSpatialGasPressureBoundaryTransport.js',
      'ulg-gpu-abi/src/schroederSpatialGasPressureBoundaryTransportWgsl.js'
    ]
  );
  assert.equal(
    policy.serverSourceAttestation.transformedEdges.some((edge) => (
      edge.parentRepoPath === 'src/runtime/sph/schroederSpatialEpochGpu.js'
        && edge.childRepoPath
          === 'src/runtime/sph/schroederFrozenLevelAssignmentRefreshGpu.js'
    )),
    true
  );
  assert.deepEqual(
    policy.commands.map(({ id }) => id),
    [
      'paired-mechanics-field',
      'standalone-directory-v2-field',
      'parent-field',
      'parent-workspace-m0',
      'parent-workspace-m1',
      'parent-workspace-m2',
      'cross-level-m3-r1-r4',
      'reaction-strict-gate-v2',
      'canonical-contact',
      'exact-v4-gas-pressure-mechanics',
      'iron-ice-contact-768'
    ]
  );
  for (const command of policy.commands) {
    assert.ok(command.args.includes('--test-reporter=tap'));
    assert.equal(command.maxOutputBytes, 8 * 1024 * 1024);
    assert.equal(command.ownedProcessGroup, true);
    assert.equal(command.termGraceMs, 2_000);
    assert.equal(command.killGraceMs, 3_000);
    assert.ok(
      Object.entries(command.environment).some(
        ([key, value]) => key.endsWith('BASE_URL')
          && value === 'https://127.0.0.1:5174/'
      )
    );
  }
  assert.equal(
    policy.commands.at(-1).environment
      .ULG_IRON_ICE_CONTACT_IMPACT_DIAGNOSTIC_STEPS,
    '768'
  );
  assert.equal(
    policy.commands.slice(0, -1).every(
      (command) => command.hardTimeoutMs === 300_000
    ),
    true
  );
  assert.equal(policy.commands.at(-1).hardTimeoutMs, 590_000);
  const standaloneDirectoryV2 = policy.commands.find(
    ({ id }) => id === 'standalone-directory-v2-field'
  );
  assert.deepEqual(standaloneDirectoryV2?.environment, {
    ULG_RUN_NATIVE_MECHANICS_FIELD_V2_COMPILE: '1',
    ULG_RUN_NATIVE_MECHANICS_FIELD_VIEW: '1',
    ULG_MECHANICS_FIELD_VIEW_BASE_URL: 'https://127.0.0.1:5174/'
  });
  assert.deepEqual(standaloneDirectoryV2?.expectedTestNames, [
    'native WebGPU compiles the retained directory-v2 mechanics-field pipeline family',
    'native directory-v2 mechanics field admits all-dormant A=0 and preserves sparse physical descriptors',
    'native mechanics field applies gravity across duplicate stencils and copies an inactive carrier',
    'native staged mechanics-field P2G is bitwise deterministic across fresh executions'
  ]);
});

test('reaction strict-gate native arm retries adapter enumeration briefly and remains fail-closed', async () => {
  const source = await readFile(
    path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      'sphReactionStrictGateNativeWebGpu.test.mjs'
    ),
    'utf8'
  );
  assert.match(source, /const NATIVE_ADAPTER_ATTEMPT_LIMIT = 3;/u);
  assert.match(source, /const NATIVE_ADAPTER_BACKOFF_MS = 150;/u);
  assert.match(source, /for \(let attempt = 1; attempt <= adapterAttemptLimit;/u);
  assert.match(source, /status: 'adapter-unavailable'/u);
  assert.match(source, /after \$\{adapterAttemptLimit\} bounded attempts/u);
  assert.match(source, /browser\.newBrowserCDPSession\(\)/u);
  assert.match(source, /SystemInfo\.getInfo/u);
  assert.match(source, /assert\.equal\(native\.status, 'ok'/u);
  assert.doesNotMatch(source, /t\.skip\(/u);
});

test('native matrix process lock rejects overlap and releases its owned lock', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ulg-native-matrix-lock-'));
  const lockPath = path.join(root, 'matrix.lock');
  const moduleUrl = pathToFileURL(path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../scripts/stage6-native-webgpu-matrix.mjs'
  )).href;
  try {
    const first = await acquireNativeWebGpuMatrixProcessLock({ lockPath });
    const child = await execFile(process.execPath, [
      '--input-type=module',
      '--eval',
      `import { acquireNativeWebGpuMatrixProcessLock } from ${JSON.stringify(moduleUrl)};
try {
  await acquireNativeWebGpuMatrixProcessLock({ lockPath: ${JSON.stringify(lockPath)} });
  process.exitCode = 2;
} catch (error) {
  if (error?.code !== 'ERR_NATIVE_WEBGPU_MATRIX_LOCKED') throw error;
  process.stdout.write('locked\\n');
}`
    ]);
    assert.equal(child.stdout, 'locked\n');
    assert.equal(await first.release(), true);
    await assert.rejects(lstat(lockPath), /ENOENT/u);

    const next = await acquireNativeWebGpuMatrixProcessLock({ lockPath });
    assert.equal(await next.release(), true);
    assert.equal(await next.release(), false);

    const retained = await acquireNativeWebGpuMatrixProcessLock({ lockPath });
    assert.equal(await retained.retainForManualInspection(), true);
    assert.equal((await lstat(lockPath)).isFile(), true);
    await assert.rejects(
      acquireNativeWebGpuMatrixProcessLock({ lockPath }),
      (error) => error?.code === 'ERR_NATIVE_WEBGPU_MATRIX_LOCKED'
    );
    await rm(lockPath);

    const vanished = await acquireNativeWebGpuMatrixProcessLock({ lockPath });
    await rm(lockPath);
    assert.equal(await vanished.release(), false);

    const replaced = await acquireNativeWebGpuMatrixProcessLock({ lockPath });
    await rm(lockPath);
    await writeFile(lockPath, 'replacement lock identity\n');
    await assert.rejects(
      replaced.retainForManualInspection(),
      /lock identity changed/u
    );
    await rm(lockPath);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('native matrix stops after unsafe owned-group cleanup and retains its exact fixture lock', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ulg-native-unsafe-cleanup-'));
  const repoDir = path.join(root, 'repo');
  const artifactDir = path.join(root, 'artifacts');
  const receiptPath = path.join(root, 'receipts', 'native-receipt.json');
  const lockPath = path.join(root, 'matrix.lock');
  try {
    const productionPolicy = createNativeWebGpuMatrixCommandPolicy();
    const rawSources = await writeFixtureViteSources(repoDir, productionPolicy);
    await initializeGitFixture(repoDir);
    await mkdir(artifactDir, { recursive: true, mode: 0o700 });
    const fixtureCapability = await createNonProductionFixtureCapability({
      repoDir,
      productionRepoDir: path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        '..'
      )
    });
    const fixtureCommandPolicy = controlledOutputBudgetPolicy(
      path.join(root, 'must-not-launch.marker')
    );
    const sourceFetcher = fixtureViteModuleFetcher(
      productionPolicy,
      rawSources
    );
    let sourceFetchCalls = 0;
    let calls = 0;
    const result = await runNativeWebGpuMatrixReceipt({
      receiptPath,
      artifactDir,
      repoDir,
      fixtureCapability,
      fixtureCommandPolicy,
      fixtureProcessLockPath: lockPath,
      fixtureRawModuleFetcher: async (request) => {
        sourceFetchCalls += 1;
        return sourceFetcher(request);
      },
      fixtureProcessRunner: async ({
        stdoutPath,
        stderrPath,
        aggregateOutputBudget,
        hardTimeoutMs,
        termGraceMs,
        killGraceMs
      }) => {
        calls += 1;
        const stdout = 'TAP version 13\n1..0\n# tests 0\n# pass 0\n# fail 0\n';
        await writeFile(stdoutPath, stdout);
        await writeFile(stderrPath, '');
        aggregateOutputBudget.byteLength += Buffer.byteLength(stdout);
        return {
          exitCode: null,
          signal: 'SIGKILL',
          spawnError: null,
          timedOut: true,
          aborted: false,
          closeObserved: false,
          durationMs: hardTimeoutMs + termGraceMs + killGraceMs,
          termination: {
            mode: 'owned-detached-process-group',
            reason: 'hard-timeout',
            hardTimeoutMs,
            termGraceMs,
            killGraceMs,
            termSent: true,
            killSent: true,
            stopped: false,
            error: 'fixture process group remained alive',
            forcedCaptureClose: true,
            pid: 4242,
            processGroupId: 4242
          }
        };
      }
    });
    assert.equal(calls, 1);
    assert.equal(
      sourceFetchCalls,
      productionPolicy.serverSourceAttestation.modules.length
        + (3 * productionPolicy.serverSourceAttestation.transformedEdges.length)
    );
    assert.equal(result.receipt.status, 'failed');
    assert.equal(result.receipt.commands.length, 1);
    assert.equal(result.receipt.processLock.retainedForManualInspection, true);
    assert.equal(
      result.receipt.processLock.unsafeOwnedProcess.termination.processGroupId,
      4242
    );
    assert.equal((await lstat(lockPath)).isFile(), true);
    await assert.rejects(
      acquireNativeWebGpuMatrixProcessLock({ lockPath }),
      (error) => error?.code === 'ERR_NATIVE_WEBGPU_MATRIX_LOCKED'
    );
    await rm(lockPath);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('native matrix rejects runner artifact metadata that changes before its reread', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ulg-native-artifact-reread-'));
  const repoDir = path.join(root, 'repo');
  const artifactDir = path.join(root, 'artifacts');
  const receiptPath = path.join(root, 'receipts', 'native-receipt.json');
  const lockPath = path.join(root, 'matrix.lock');
  try {
    const productionPolicy = createNativeWebGpuMatrixCommandPolicy();
    const rawSources = await writeFixtureViteSources(repoDir, productionPolicy);
    await initializeGitFixture(repoDir);
    await mkdir(artifactDir, { recursive: true, mode: 0o700 });
    const fixtureCapability = await createNonProductionFixtureCapability({
      repoDir,
      productionRepoDir: path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        '..'
      )
    });
    const fixtureCommandPolicy = controlledOutputBudgetPolicy(
      path.join(root, 'must-not-launch.marker')
    );
    const result = await runNativeWebGpuMatrixReceipt({
      receiptPath,
      artifactDir,
      repoDir,
      fixtureCapability,
      fixtureCommandPolicy,
      fixtureProcessLockPath: lockPath,
      fixtureRawModuleFetcher: fixtureViteModuleFetcher(
        productionPolicy,
        rawSources
      ),
      fixtureProcessRunner: async ({
        stdoutPath,
        stderrPath,
        hardTimeoutMs,
        termGraceMs,
        killGraceMs
      }) => {
        await writeFile(stdoutPath, '');
        await writeFile(stderrPath, '');
        return {
          ...successfulFixtureExecution({
            hardTimeoutMs,
            termGraceMs,
            killGraceMs
          }),
          stdoutArtifact: {
            path: stdoutPath,
            byteLength: 0,
            sha256: '0'.repeat(64)
          }
        };
      }
    });
    assert.equal(result.receipt.status, 'failed');
    assert.match(result.receipt.reason, /stdout artifact changed after bounded capture/u);
    assert.equal(result.receipt.commands.length, 0);
    await assert.rejects(lstat(lockPath), /ENOENT/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('native matrix cancellation during source attestation launches no native arm', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ulg-native-attestation-abort-'));
  const repoDir = path.join(root, 'repo');
  const artifactDir = path.join(root, 'artifacts');
  const receiptPath = path.join(root, 'receipts', 'native-receipt.json');
  const lockPath = path.join(root, 'matrix.lock');
  try {
    const policy = createNativeWebGpuMatrixCommandPolicy();
    const rawSources = await writeFixtureViteSources(repoDir, policy);
    await initializeGitFixture(repoDir);
    await mkdir(artifactDir, { recursive: true, mode: 0o700 });
    const fixtureCapability = await createNonProductionFixtureCapability({
      repoDir,
      productionRepoDir: path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        '..'
      )
    });
    const controller = new AbortController();
    const sourceFetcher = fixtureViteModuleFetcher(policy, rawSources);
    let sourceFetchCalls = 0;
    let runnerCalls = 0;
    const result = await runNativeWebGpuMatrixReceipt({
      receiptPath,
      artifactDir,
      repoDir,
      fixtureCapability,
      fixtureProcessLockPath: lockPath,
      abortSignal: controller.signal,
      fixtureRawModuleFetcher: async (request) => {
        sourceFetchCalls += 1;
        controller.abort('fixture attestation cancellation');
        return sourceFetcher(request);
      },
      fixtureProcessRunner: async () => {
        runnerCalls += 1;
        throw new Error('cancelled matrix must not launch an arm');
      }
    });
    assert.equal(sourceFetchCalls, 1);
    assert.equal(runnerCalls, 0);
    assert.equal(result.receipt.status, 'failed');
    assert.match(result.receipt.reason, /cancelled by its parent signal/u);
    await assert.rejects(lstat(lockPath), /ENOENT/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('native matrix final fingerprint rejects mutation during post-execution attestation', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ulg-native-final-fingerprint-'));
  const repoDir = path.join(root, 'repo');
  const artifactDir = path.join(root, 'artifacts');
  const receiptPath = path.join(root, 'receipts', 'native-receipt.json');
  const lockPath = path.join(root, 'matrix.lock');
  try {
    const productionPolicy = createNativeWebGpuMatrixCommandPolicy();
    const rawSources = await writeFixtureViteSources(repoDir, productionPolicy);
    await initializeGitFixture(repoDir);
    await mkdir(artifactDir, { recursive: true, mode: 0o700 });
    const fixtureCapability = await createNonProductionFixtureCapability({
      repoDir,
      productionRepoDir: path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        '..'
      )
    });
    const fixtureCommandPolicy = controlledOutputBudgetPolicy(
      path.join(root, 'must-not-launch.marker')
    );
    const sourceFetcher = fixtureViteModuleFetcher(
      productionPolicy,
      rawSources
    );
    const fetchesPerAttestation =
      productionPolicy.serverSourceAttestation.modules.length
      + (3 * productionPolicy.serverSourceAttestation.transformedEdges.length);
    const mutationPath = path.join(
      repoDir,
      productionPolicy.serverSourceAttestation.modules[0].repoPath
    );
    let sourceFetchCalls = 0;
    let runnerCalls = 0;
    const result = await runNativeWebGpuMatrixReceipt({
      receiptPath,
      artifactDir,
      repoDir,
      fixtureCapability,
      fixtureCommandPolicy,
      fixtureProcessLockPath: lockPath,
      fixtureRawModuleFetcher: async (request) => {
        const call = ++sourceFetchCalls;
        const response = await sourceFetcher(request);
        if (call === 2 * fetchesPerAttestation) {
          await writeFile(mutationPath, 'mutated during final attestation\n');
        }
        return response;
      },
      fixtureProcessRunner: async ({
        stdoutPath,
        stderrPath,
        hardTimeoutMs,
        termGraceMs,
        killGraceMs
      }) => {
        runnerCalls += 1;
        await writeFile(stdoutPath, '');
        await writeFile(stderrPath, '');
        return successfulFixtureExecution({
          hardTimeoutMs,
          termGraceMs,
          killGraceMs
        });
      }
    });
    assert.equal(runnerCalls, fixtureCommandPolicy.commands.length);
    assert.equal(sourceFetchCalls, 2 * fetchesPerAttestation);
    assert.equal(result.receipt.status, 'failed');
    assert.match(result.receipt.reason, /fingerprint changed during final source attestation/u);
    await assert.rejects(lstat(lockPath), /ENOENT/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('native source attestation decodes Vite raw modules and matches every pinned local file', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ulg-native-source-attestation-'));
  try {
    const expectedPolicy = createNativeWebGpuMatrixCommandPolicy();
    const contents = await writeFixtureViteSources(root, expectedPolicy);
    const currentFingerprint = fingerprint();
    const fixtureCapability = await createNonProductionFixtureCapability({
      repoDir: root,
      productionRepoDir: path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        '..'
      )
    });
    const attestation = await createNativeWebGpuServerSourceAttestation({
      repoDir: root,
      expectedPolicy,
      sourceFingerprint: currentFingerprint,
      fixtureCapability,
      fixtureRawModuleFetcher: fixtureViteModuleFetcher(
        expectedPolicy,
        contents
      )
    });
    assert.equal(attestation.status, 'matched');
    assert.equal(attestation.executionProvenance, 'fixture');
    assert.equal(attestation.moduleCount, 17);
    assert.equal(attestation.transformedEdgeCount, 22);
    assert.equal(attestation.modules.every((entry) => entry.matched), true);
    assert.equal(attestation.transformedEdges.every((entry) => entry.matched), true);
    const frozenRefreshEdge = attestation.transformedEdges.find((edge) => (
      edge.parentRepoPath === 'src/runtime/sph/schroederSpatialEpochGpu.js'
        && edge.childRepoPath
          === 'src/runtime/sph/schroederFrozenLevelAssignmentRefreshGpu.js'
    ));
    assert.equal(frozenRefreshEdge?.matched, true);
    assert.equal(
      frozenRefreshEdge?.childResolvedUrl,
      'https://127.0.0.1:5174/src/runtime/sph/schroederFrozenLevelAssignmentRefreshGpu.js?t=fixture'
    );
    assert.equal(frozenRefreshEdge?.parentRaw?.matched, true);
    assert.equal(frozenRefreshEdge?.childRaw?.matched, true);
    assert.equal(
      decodeViteRawModule('export default "source\\n"').toString('utf8'),
      'source\n'
    );
    assert.throws(
      () => decodeViteRawModule('source without a Vite export'),
      /not a Vite raw module/
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('native source attestation fails closed on transformed-edge ambiguity and raw parity drift', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ulg-native-transform-edge-'));
  try {
    const policy = createNativeWebGpuMatrixCommandPolicy();
    const rawSources = await writeFixtureViteSources(root, policy);
    const fixtureCapability = await createNonProductionFixtureCapability({
      repoDir: root,
      productionRepoDir: path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        '..'
      )
    });
    const currentFingerprint = fingerprint();
    await assert.rejects(
      createNativeWebGpuServerSourceAttestation({
        repoDir: root,
        expectedPolicy: policy,
        sourceFingerprint: currentFingerprint,
        fixtureCapability,
        fixtureRawModuleFetcher: fixtureViteModuleFetcher(policy, rawSources, {
          transformedOverride: ({ edges }) => edges.length > 0
            ? edges.map(({ childRepoPath }) => (
              `import ${JSON.stringify(`/${childRepoPath}?t=one`)};\n`
                + `import ${JSON.stringify(`/${childRepoPath}?t=two`)};`
            )).join('\n')
            : ''
        })
      }),
      /requires exactly one static/u
    );
    const delegate = fixtureViteModuleFetcher(policy, rawSources);
    const driftedEdgeIndex = policy.serverSourceAttestation.transformedEdges.findIndex(
      (edge) => edge.parentRepoPath === 'src/runtime/sph/schroederSpatialEpochGpu.js'
        && edge.childRepoPath
          === 'src/runtime/sph/schroederFrozenLevelAssignmentRefreshGpu.js'
    );
    assert.notEqual(driftedEdgeIndex, -1);
    const driftedChild = policy.serverSourceAttestation.transformedEdges[driftedEdgeIndex]
      .childRepoPath;
    const attestation = await createNativeWebGpuServerSourceAttestation({
      repoDir: root,
      expectedPolicy: policy,
      sourceFingerprint: currentFingerprint,
      fixtureCapability,
      fixtureRawModuleFetcher: async (args) => {
        if (
          args.url.pathname === `/${driftedChild}`
          && args.url.search === '?raw'
        ) {
          return {
            requestUrl: args.url.href,
            statusCode: 200,
            contentType: 'text/javascript',
            body: Buffer.from('export default "stale child";')
          };
        }
        return delegate(args);
      }
    });
    assert.equal(attestation.status, 'mismatch');
    assert.equal(attestation.transformedEdges[driftedEdgeIndex].childRaw.matched, false);
    assert.equal(attestation.transformedEdges[driftedEdgeIndex].matched, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('native matrix scrubs inherited diagnostic overrides before applying fixed arm policies', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ulg-native-iron-contact-env-'));
  const repoDir = path.join(root, 'repo');
  const artifactDir = path.join(root, 'artifacts');
  const receiptPath = path.join(root, 'receipts', 'native-receipt.json');
  const inheritedKeys = [
    'ULG_IRON_ICE_CONTACT_IMPACT_DIAGNOSTIC_HYDRO_INIT',
    'ULG_IRON_ICE_CONTACT_IMPACT_DIAGNOSTIC_PROFILE_STATE_STEPS',
    'ULG_IRON_ICE_CONTACT_IMPACT_DIAGNOSTIC_STAR_PROFILE_STEPS',
    'ULG_IRON_ICE_CONTACT_IMPACT_DIAGNOSTIC_TRACE_STEPS',
    'ULG_IRON_ICE_CONTACT_IMPACT_DIAGNOSTIC_TRACE_TARGETS',
    'ULG_IRON_ICE_CONTACT_IMPACT_DIAGNOSTIC_TIMEOUT_MS',
    'ULG_CROSS_LEVEL_M3_DIAGNOSTIC_RATIOS'
  ];
  const inherited = Object.fromEntries(
    inheritedKeys.map((key) => [key, process.env[key]])
  );
  try {
    Object.assign(process.env, {
      ULG_IRON_ICE_CONTACT_IMPACT_DIAGNOSTIC_HYDRO_INIT: '1',
      ULG_IRON_ICE_CONTACT_IMPACT_DIAGNOSTIC_PROFILE_STATE_STEPS: '1,2',
      ULG_IRON_ICE_CONTACT_IMPACT_DIAGNOSTIC_STAR_PROFILE_STEPS: '2',
      ULG_IRON_ICE_CONTACT_IMPACT_DIAGNOSTIC_TRACE_STEPS: '3,4',
      ULG_IRON_ICE_CONTACT_IMPACT_DIAGNOSTIC_TRACE_TARGETS: '1:2;3:4',
      ULG_IRON_ICE_CONTACT_IMPACT_DIAGNOSTIC_TIMEOUT_MS: '1800000',
      ULG_CROSS_LEVEL_M3_DIAGNOSTIC_RATIOS: '1'
    });
    const policy = createNativeWebGpuMatrixCommandPolicy();
    const rawSources = await writeFixtureViteSources(repoDir, policy);
    await initializeGitFixture(repoDir);
    await mkdir(artifactDir, { recursive: true, mode: 0o700 });
    const fixtureCapability = await createNonProductionFixtureCapability({
      repoDir,
      productionRepoDir: path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        '..'
      )
    });
    const capturedEnvironments = [];
    const result = await runNativeWebGpuMatrixReceipt({
      receiptPath,
      artifactDir,
      repoDir,
      fixtureCapability,
      fixtureRawModuleFetcher: fixtureViteModuleFetcher(policy, rawSources),
      fixtureProcessRunner: async ({
        env,
        stdoutPath,
        stderrPath,
        aggregateOutputBudget,
        hardTimeoutMs,
        termGraceMs,
        killGraceMs
      }) => {
        const arm = policy.commands[capturedEnvironments.length];
        capturedEnvironments.push(env);
        const stdout = tapForArm(arm);
        await writeFile(stdoutPath, stdout);
        await writeFile(stderrPath, '');
        aggregateOutputBudget.byteLength += Buffer.byteLength(stdout);
        return successfulFixtureExecution({
          hardTimeoutMs,
          termGraceMs,
          killGraceMs
        });
      }
    });
    assert.equal(result.receipt.status, 'failed');
    assert.match(result.receipt.reason, /production execution path/u);
    const ironEnvironment = capturedEnvironments.at(-1);
    for (const key of inheritedKeys) {
      assert.equal(Object.hasOwn(ironEnvironment, key), false, key);
    }
    assert.equal(
      ironEnvironment.ULG_IRON_ICE_CONTACT_IMPACT_DIAGNOSTIC_BASE_URL,
      'https://127.0.0.1:5174/'
    );
    assert.equal(
      ironEnvironment.ULG_IRON_ICE_CONTACT_IMPACT_DIAGNOSTIC_STEPS,
      '768'
    );
    assert.equal(
      ironEnvironment.ULG_RUN_NATIVE_IRON_ICE_CONTACT_IMPACT_DIAGNOSTIC,
      '1'
    );
    const m3Environment = capturedEnvironments[
      policy.commands.findIndex(({ id }) => id === 'cross-level-m3-r1-r4')
    ];
    assert.equal(
      Object.hasOwn(m3Environment, 'ULG_CROSS_LEVEL_M3_DIAGNOSTIC_RATIOS'),
      false
    );
  } finally {
    for (const [key, value] of Object.entries(inherited)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await rm(root, { recursive: true, force: true });
  }
});

test('native matrix evaluator authenticates every opt-in execution', () => {
  const value = fixture();
  assert.equal(
    evaluateNativeWebGpuMatrixReceipt(value.receipt, value).passed,
    true
  );
});

test('native matrix evaluator fails closed on malformed artifact evidence', () => {
  for (const artifactEvidence of [{}, [null]]) {
    const value = fixture();
    value.artifactEvidence = artifactEvidence;
    const evaluation = evaluateNativeWebGpuMatrixReceipt(value.receipt, value);
    assert.equal(evaluation.passed, false);
    assert.match(evaluation.failures.join('\n'), /artifact mismatch|TAP failed/u);
  }
});

test('native matrix evaluator rejects per-command and aggregate output-budget drift', () => {
  {
    const value = fixture();
    value.receipt.outputCapture.byteLength += 1;
    const evaluation = evaluateNativeWebGpuMatrixReceipt(value.receipt, value);
    assert.equal(evaluation.passed, false);
    assert.match(evaluation.failures.join('\n'), /aggregate output capture budget mismatch/);
  }
  {
    const value = fixture();
    const command = value.receipt.commands[0];
    const evidence = value.artifactEvidence[0].stdout;
    const oversizedByteLength = value.expectedPolicy.commands[0].maxOutputBytes + 1;
    evidence.byteLength = oversizedByteLength;
    command.stdoutArtifact.byteLength = oversizedByteLength;
    value.receipt.outputCapture.byteLength += oversizedByteLength - Buffer.byteLength(evidence.text);
    const evaluation = evaluateNativeWebGpuMatrixReceipt(value.receipt, value);
    assert.equal(evaluation.passed, false);
    assert.match(evaluation.failures.join('\n'), /output exceeded its capture budget/);
  }
  {
    const value = fixture();
    value.receipt.executionTiming.postExecutionAttestationReserveMs += 1;
    const evaluation = evaluateNativeWebGpuMatrixReceipt(value.receipt, value);
    assert.equal(evaluation.passed, false);
    assert.match(evaluation.failures.join('\n'), /execution timing exceeded its absolute bound/u);
  }
  {
    const value = fixture();
    value.receipt.processLock.dispositionCompleted = false;
    const evaluation = evaluateNativeWebGpuMatrixReceipt(value.receipt, value);
    assert.equal(evaluation.passed, false);
    assert.match(evaluation.failures.join('\n'), /process-lock disposition mismatch/u);
  }
});

test('native matrix rejects output collisions before creating a writer or runner', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ulg-native-matrix-collision-'));
  const repoDir = path.join(root, 'repo');
  const artifactDir = path.join(root, 'artifacts');
  const receiptPath = path.join(
    artifactDir,
    '00-paired-mechanics-field.stdout.tap'
  );
  try {
    await Promise.all([
      mkdir(repoDir, { recursive: true }),
      mkdir(artifactDir, { recursive: true, mode: 0o700 })
    ]);
    const fixtureCapability = await createNonProductionFixtureCapability({
      repoDir,
      productionRepoDir: path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        '..'
      )
    });
    let runnerCalled = false;
    await assert.rejects(
      runNativeWebGpuMatrixReceipt({
        receiptPath,
        artifactDir,
        repoDir,
        fixtureCapability,
        fixtureProcessRunner: async () => {
          runnerCalled = true;
          throw new Error('collision runner must not execute');
        }
      }),
      /collides with/u
    );
    assert.equal(runnerCalled, false);
    await assert.rejects(readFile(receiptPath, 'utf8'), /ENOENT/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('native matrix supplies bounded output capture and stops before the next exhausted command', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ulg-native-output-budget-'));
  const repoDir = path.join(root, 'repo');
  const artifactDir = path.join(root, 'artifacts');
  const receiptPath = path.join(root, 'receipts', 'native-receipt.json');
  try {
    const policy = createNativeWebGpuMatrixCommandPolicy();
    const rawSources = await writeFixtureViteSources(repoDir, policy);
    await initializeGitFixture(repoDir);
    await mkdir(artifactDir, { recursive: true, mode: 0o700 });
    const fixtureCapability = await createNonProductionFixtureCapability({
      repoDir,
      productionRepoDir: path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        '..'
      )
    });
    const calls = [];
    const result = await runNativeWebGpuMatrixReceipt({
      receiptPath,
      artifactDir,
      repoDir,
      fixtureCapability,
      fixtureRawModuleFetcher: fixtureViteModuleFetcher(policy, rawSources),
      fixtureProcessRunner: async ({
        stdoutPath,
        stderrPath,
        maxOutputBytes,
        aggregateOutputBudget,
        hardTimeoutMs,
        termGraceMs,
        killGraceMs
      }) => {
        calls.push({ maxOutputBytes, aggregateOutputBudget });
        const text = tapForArm(policy.commands[0]);
        await writeFile(stdoutPath, text);
        await writeFile(stderrPath, '');
        // Model a common-runner capture that consumed the remaining aggregate
        // budget. The matrix must refuse to invoke a second command.
        aggregateOutputBudget.byteLength = aggregateOutputBudget.maxByteLength;
        return successfulFixtureExecution({
          hardTimeoutMs,
          termGraceMs,
          killGraceMs
        });
      }
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].maxOutputBytes, policy.commands[0].maxOutputBytes);
    assert.equal(
      calls[0].aggregateOutputBudget.maxByteLength,
      policy.aggregateMaxOutputBytes
    );
    assert.equal(result.receipt.status, 'failed');
    assert.match(result.receipt.reason, /aggregate output budget exhausted before command capture/);
    assert.equal(result.receipt.commands.length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('native matrix default process runner exhausts the shared aggregate before a next arm launches', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ulg-native-default-output-budget-'));
  const repoDir = path.join(root, 'repo');
  const artifactDir = path.join(root, 'artifacts');
  const receiptPath = path.join(root, 'receipts', 'native-receipt.json');
  const markerPath = path.join(root, 'must-not-launch.marker');
  try {
    const productionPolicy = createNativeWebGpuMatrixCommandPolicy();
    const rawSources = await writeFixtureViteSources(repoDir, productionPolicy);
    await initializeGitFixture(repoDir);
    await mkdir(artifactDir, { recursive: true, mode: 0o700 });
    const fixtureCapability = await createNonProductionFixtureCapability({
      repoDir,
      productionRepoDir: path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        '..'
      )
    });
    const fixtureCommandPolicy = controlledOutputBudgetPolicy(markerPath);
    const result = await runNativeWebGpuMatrixReceipt({
      receiptPath,
      artifactDir,
      repoDir,
      fixtureCapability,
      fixtureCommandPolicy,
      fixtureRawModuleFetcher: fixtureViteModuleFetcher(
        productionPolicy,
        rawSources
      )
    });
    assert.equal(result.receipt.status, 'failed');
    assert.match(result.receipt.reason, /aggregate output budget exhausted before command capture/);
    assert.deepEqual(
      result.receipt.commands.map((entry) => entry.id),
      ['controlled-output-first', 'controlled-output-second']
    );
    assert.equal(result.receipt.commands.every((entry) => entry.exitCode === 0), true);
    assert.deepEqual(result.receipt.outputCapture, {
      maxByteLength: 32,
      byteLength: 32
    });
    await assert.rejects(lstat(markerPath), /ENOENT/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('native matrix rejects a skipped opt-in even when stored PASS is forged', () => {
  const value = fixture();
  const arm = NATIVE_WEBGPU_MATRIX_ARMS[4];
  const text = tapForArm(arm, { skipFirst: true });
  value.receipt.storedPass = true;
  value.artifactEvidence[4].stdout = artifact(
    value.artifactEvidence[4].stdout.path,
    text
  );
  value.receipt.commands[4].stdoutArtifact = {
    path: value.artifactEvidence[4].stdout.path,
    byteLength: value.artifactEvidence[4].stdout.byteLength,
    sha256: value.artifactEvidence[4].stdout.sha256
  };
  value.receipt.commands[4].tap = parseNodeTap(text);
  const evaluation = evaluateNativeWebGpuMatrixReceipt(
    value.receipt,
    value
  );
  assert.equal(evaluation.passed, false);
  assert.match(evaluation.failures.join('\n'), /did not execute/);
});

test('native matrix rejects a forged unrelated skip even when all named arms pass', () => {
  const value = fixture();
  const arm = NATIVE_WEBGPU_MATRIX_ARMS[0];
  const text = `${tapForArm(arm)}ok 99 - unrelated # SKIP forged\n`;
  value.artifactEvidence[0].stdout = artifact(
    value.artifactEvidence[0].stdout.path,
    text
  );
  value.receipt.commands[0].stdoutArtifact = {
    path: value.artifactEvidence[0].stdout.path,
    byteLength: value.artifactEvidence[0].stdout.byteLength,
    sha256: value.artifactEvidence[0].stdout.sha256
  };
  value.receipt.commands[0].tap = parseNodeTap(text);
  const evaluation = evaluateNativeWebGpuMatrixReceipt(value.receipt, value);
  assert.equal(evaluation.passed, false);
  assert.match(evaluation.failures.join('\n'), /TAP failed/);
});

test('native evaluator cannot make fixture-path output eligible', () => {
  const value = fixture();
  value.receipt.executionProvenance = 'fixture';
  const evaluation = evaluateNativeWebGpuMatrixReceipt(value.receipt, value);
  assert.equal(evaluation.passed, false);
  assert.match(evaluation.failures.join('\n'), /production execution path/);
});

test('native matrix rejects TAP failure, artifact tampering, GPU errors, and source drift', () => {
  assert.deepEqual(
    nativeGpuFailureLines(
      '{"validationError": null, "uncapturedErrors": [], "browserDiagnostics": []}'
    ),
    []
  );
  {
    const value = fixture();
    const text = tapForArm(NATIVE_WEBGPU_MATRIX_ARMS[0], { fail: true });
    value.artifactEvidence[0].stdout = artifact(
      value.artifactEvidence[0].stdout.path,
      text
    );
    assert.equal(
      evaluateNativeWebGpuMatrixReceipt(value.receipt, value).passed,
      false
    );
  }
  {
    const value = fixture();
    value.artifactEvidence[1].stderr.sha256 = 'f'.repeat(64);
    assert.equal(
      evaluateNativeWebGpuMatrixReceipt(value.receipt, value).passed,
      false
    );
  }
  {
    const value = fixture();
    const error = 'GPUValidationError: invalid bind group';
    value.artifactEvidence[2].stderr = artifact(
      value.artifactEvidence[2].stderr.path,
      error
    );
    value.receipt.commands[2].stderrArtifact = {
      path: value.artifactEvidence[2].stderr.path,
      byteLength: value.artifactEvidence[2].stderr.byteLength,
      sha256: value.artifactEvidence[2].stderr.sha256
    };
    assert.deepEqual(nativeGpuFailureLines(error), [error]);
    assert.equal(
      evaluateNativeWebGpuMatrixReceipt(value.receipt, value).passed,
      false
    );
  }
  {
    const value = fixture();
    const proposalModule = value.receipt.serverSourceAttestationAfter.modules.find(
      (entry) => entry.repoPath
        === 'src/runtime/sph/schroederSpatialMechanicalProposalsGpu.js'
    );
    assert.ok(proposalModule);
    proposalModule.servedSha256 =
      'e'.repeat(64);
    const { attestationSha256, ...attestationCore } =
      value.receipt.serverSourceAttestationAfter;
    value.receipt.serverSourceAttestationAfter.attestationSha256 =
      canonicalJsonSha256(attestationCore);
    assert.equal(
      evaluateNativeWebGpuMatrixReceipt(value.receipt, value).passed,
      false
    );
  }
  {
    const value = fixture();
    value.receipt.serverSourceAttestationAfter.transformedEdges[0]
      .childResolvedUrl = 'https://127.0.0.1:5174/src/runtime/sph/not-the-pinned-child.js';
    const { attestationSha256, ...attestationCore } =
      value.receipt.serverSourceAttestationAfter;
    value.receipt.serverSourceAttestationAfter.attestationSha256 =
      canonicalJsonSha256(attestationCore);
    const evaluation = evaluateNativeWebGpuMatrixReceipt(value.receipt, value);
    assert.equal(evaluation.passed, false);
    assert.match(evaluation.failures.join('\n'), /transformed edge/u);
  }
  {
    const value = fixture();
    value.currentFingerprint = fingerprint({
      worktreeStatusHash: 'd'.repeat(64)
    });
    assert.equal(
      evaluateNativeWebGpuMatrixReceipt(value.receipt, value).passed,
      false
    );
  }
});
