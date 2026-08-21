import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { constants as fsConstants, createWriteStream } from 'node:fs';
import {
  lstat,
  link,
  mkdir,
  open,
  realpath,
  rename,
  rm
} from 'node:fs/promises';
import path from 'node:path';
import { finished } from 'node:stream/promises';

import {
  exactWorktreeFingerprint
} from './sph-performance-acceptance-campaign.mjs';

const fixtureCapabilities = new WeakMap();

export { exactWorktreeFingerprint };

export const SS_CONTAINED_POLICY_TRACK = 'contained-default-off';
export const EXACT_WORKTREE_FINGERPRINT_FIELDS = Object.freeze([
  'gitHead',
  'sourceFingerprint',
  'worktreeDirty',
  'worktreeStatusHash',
  'trackedAndUntrackedFileCount'
]);

export function sha256Bytes(value) {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalValue(value[key])])
    );
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalValue(value));
}

export function canonicalJsonSha256(value) {
  return sha256Bytes(canonicalJson(value));
}

function validExactWorktreeFingerprint(value) {
  return Boolean(
    value
    && typeof value === 'object'
    && /^[0-9a-f]{40}$/u.test(value.gitHead ?? '')
    && /^[0-9a-f]{64}$/u.test(value.sourceFingerprint ?? '')
    && typeof value.worktreeDirty === 'boolean'
    && /^[0-9a-f]{64}$/u.test(value.worktreeStatusHash ?? '')
    && Number.isSafeInteger(value.trackedAndUntrackedFileCount)
    && value.trackedAndUntrackedFileCount >= 0
  );
}

export function exactWorktreeFingerprintsEqual(...fingerprints) {
  if (
    fingerprints.length < 2
    || fingerprints.some((value) => !validExactWorktreeFingerprint(value))
  ) {
    return false;
  }
  const first = fingerprints[0];
  return fingerprints.slice(1).every((candidate) => (
    EXACT_WORKTREE_FINGERPRINT_FIELDS.every(
      (field) => candidate[field] === first[field]
    )
  ));
}

function pathIsInside(candidate, root) {
  const relative = path.relative(root, candidate);
  return relative === ''
    || (!relative.startsWith(`..${path.sep}`) && relative !== '..'
      && !path.isAbsolute(relative));
}

function sameIdentity(left, right) {
  return Boolean(
    left
    && right
    && left.dev === right.dev
    && left.ino === right.ino
    && left.isFile() === right.isFile()
    && left.isDirectory() === right.isDirectory()
  );
}

async function existingPathComponents(candidate) {
  const components = [];
  let cursor = path.resolve(candidate);
  while (true) {
    try {
      const stat = await lstat(cursor);
      components.push(Object.freeze({ path: cursor, stat }));
      if (cursor === path.parse(cursor).root) break;
      cursor = path.dirname(cursor);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      const parent = path.dirname(cursor);
      if (parent === cursor) throw error;
      cursor = parent;
    }
  }
  return components.reverse();
}

async function assertNoSymlinkPathComponents(candidate, label) {
  for (const entry of await existingPathComponents(candidate)) {
    if (entry.stat.isSymbolicLink()) {
      throw new Error(`${label} must not traverse a symbolic link: ${entry.path}`);
    }
  }
}

async function ensurePrivateArtifactParent(outputPath, label) {
  const parent = path.dirname(outputPath);
  // Each newly created component is checked immediately. Existing components
  // are also rechecked below; this is a best-effort TOCTOU defense for paths
  // supplied by a caller, not an assertion that arbitrary hostile directories
  // can be made race-free without directory-handle APIs.
  await mkdir(parent, { recursive: true, mode: 0o700 });
  await assertNoSymlinkPathComponents(parent, label);
  const stat = await lstat(parent);
  const currentUid = typeof process.getuid === 'function' ? process.getuid() : null;
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(`${label} parent must be a real non-symlink directory`);
  }
  if (currentUid == null || stat.uid !== currentUid) {
    throw new Error(`${label} parent must be owned by the current UID`);
  }
  if ((stat.mode & 0o777) !== 0o700) {
    throw new Error(`${label} parent must have exact private mode 0700`);
  }
  return Object.freeze({ path: parent, stat });
}

async function assertParentIdentity(parent, label) {
  await assertNoSymlinkPathComponents(parent.path, label);
  const observed = await lstat(parent.path);
  if (!observed.isDirectory() || observed.isSymbolicLink()
    || !sameIdentity(parent.stat, observed)
    || (observed.mode & 0o777) !== 0o700
    || typeof process.getuid !== 'function'
    || observed.uid !== process.getuid()) {
    throw new Error(`${label} parent changed during artifact operation`);
  }
}

async function canonicalMissingPath(resolvedPath) {
  const suffix = [];
  let cursor = resolvedPath;
  while (true) {
    try {
      return path.join(await realpath(cursor), ...suffix.reverse());
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      const parent = path.dirname(cursor);
      if (parent === cursor) throw error;
      suffix.push(path.basename(cursor));
      cursor = parent;
    }
  }
}

export async function assertArtifactPathOutsideRepo({
  artifactPath,
  repoDir,
  label = 'release evidence artifact'
}) {
  if (typeof artifactPath !== 'string' || artifactPath.length === 0) {
    throw new TypeError(`${label} path must be a non-empty string`);
  }
  const resolvedRepoDir = path.resolve(repoDir);
  const resolvedArtifactPath = path.resolve(artifactPath);
  await Promise.all([
    assertNoSymlinkPathComponents(resolvedRepoDir, 'repository'),
    assertNoSymlinkPathComponents(resolvedArtifactPath, label)
  ]);
  const [canonicalRepoDir, canonicalArtifactPath] = await Promise.all([
    realpath(resolvedRepoDir),
    canonicalMissingPath(resolvedArtifactPath)
  ]);
  if (
    pathIsInside(resolvedArtifactPath, resolvedRepoDir)
    || pathIsInside(canonicalArtifactPath, canonicalRepoDir)
  ) {
    throw new Error(`${label} must be outside the repository`);
  }
  return Object.freeze({
    repoDir: resolvedRepoDir,
    artifactPath: resolvedArtifactPath,
    canonicalRepoDir,
    canonicalArtifactPath
  });
}

export async function assertArtifactPathsPairwiseDistinct({
  paths,
  repoDir,
  label = 'release evidence artifacts'
}) {
  if (!Array.isArray(paths) || paths.length < 2) {
    throw new TypeError(`${label} must contain at least two paths`);
  }
  const guarded = await Promise.all(paths.map((entry, index) => {
    const artifactPath = typeof entry === 'string' ? entry : entry?.path;
    const artifactLabel = typeof entry === 'string'
      ? `${label} entry ${index}`
      : entry?.label || `${label} entry ${index}`;
    return assertArtifactPathOutsideRepo({
      artifactPath,
      repoDir,
      label: artifactLabel
    });
  }));
  const identities = new Map();
  for (let index = 0; index < guarded.length; index += 1) {
    const identity = path.normalize(guarded[index].canonicalArtifactPath);
    const previous = identities.get(identity);
    if (previous != null) {
      throw new Error(
        `${label} paths must be canonically pairwise distinct: `
          + `${previous} collides with ${index}`
      );
    }
    identities.set(identity, index);
  }
  return Object.freeze(guarded);
}

// Test runners need deterministic seams, but a seam must never be usable for
// the checked-out product repository.  The record lives in this module (not in
// an environment variable or serializable option), and callers must bind it to
// the production repository identity that they are protecting.
export async function createNonProductionFixtureCapability({
  repoDir,
  productionRepoDir
}) {
  if (!repoDir || !productionRepoDir) {
    throw new TypeError('fixture capability requires fixture and production repositories');
  }
  const [fixtureRepoDir, canonicalProductionRepoDir] = await Promise.all([
    realpath(path.resolve(repoDir)),
    realpath(path.resolve(productionRepoDir))
  ]);
  if (fixtureRepoDir === canonicalProductionRepoDir) {
    throw new Error('fixture capability cannot target the production repository');
  }
  const capability = Object.freeze({});
  fixtureCapabilities.set(capability, Object.freeze({
    fixtureRepoDir,
    productionRepoDir: canonicalProductionRepoDir
  }));
  return capability;
}

export async function assertNonProductionFixtureCapability({
  capability,
  repoDir,
  productionRepoDir,
  label = 'release evidence fixture seam'
}) {
  const record = fixtureCapabilities.get(capability);
  if (!record) throw new Error(`${label} requires an opaque fixture capability`);
  const [canonicalRepoDir, canonicalProductionRepoDir] = await Promise.all([
    realpath(path.resolve(repoDir)),
    realpath(path.resolve(productionRepoDir))
  ]);
  if (
    canonicalRepoDir === canonicalProductionRepoDir
    || record.fixtureRepoDir !== canonicalRepoDir
    || record.productionRepoDir !== canonicalProductionRepoDir
  ) {
    throw new Error(`${label} is not authorized for this repository`);
  }
  return Object.freeze({ canonicalRepoDir, canonicalProductionRepoDir });
}

export function scrubReleaseEvidenceChildEnvironment(
  sourceEnvironment = process.env,
  {
    unsetKeys = ['NODE_OPTIONS'],
    unsetPrefixes = [],
    unsetSuffixes = []
  } = {}
) {
  const environment = { ...(sourceEnvironment ?? {}) };
  const keys = new Set(unsetKeys);
  keys.add('NODE_OPTIONS');
  for (const key of Object.keys(environment)) {
    if (
      keys.has(key)
      || unsetPrefixes.some((prefix) => key.startsWith(prefix))
      || unsetSuffixes.some((suffix) => key.endsWith(suffix))
    ) {
      delete environment[key];
    }
  }
  return environment;
}

export async function readHashedArtifact({
  artifactPath,
  repoDir,
  label = 'release evidence artifact',
  includeBytes = false,
  maxByteLength = Number.POSITIVE_INFINITY
}) {
  const guarded = await assertArtifactPathOutsideRepo({
    artifactPath,
    repoDir,
    label
  });
  const before = await lstat(guarded.artifactPath);
  if (!before.isFile() || before.isSymbolicLink()) {
    throw new Error(`${label} must be a regular non-symlink file`);
  }
  if (!Number.isSafeInteger(maxByteLength) && maxByteLength !== Number.POSITIVE_INFINITY) {
    throw new TypeError(`${label} maximum byte length must be a safe integer or Infinity`);
  }
  if (maxByteLength < 0 || before.size > maxByteLength) {
    throw new Error(`${label} exceeds its maximum byte length`);
  }
  const handle = await open(
    guarded.artifactPath,
    fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW
  );
  let bytes;
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || !sameIdentity(before, opened)) {
      throw new Error(`${label} changed before it could be read`);
    }
    bytes = await handle.readFile();
    const afterRead = await handle.stat();
    if (!sameIdentity(opened, afterRead)) {
      throw new Error(`${label} changed while it was read`);
    }
  } finally {
    await handle.close();
  }
  const after = await lstat(guarded.artifactPath);
  if (!after.isFile() || after.isSymbolicLink() || !sameIdentity(before, after)) {
    throw new Error(`${label} changed after it was read`);
  }
  return Object.freeze({
    path: guarded.artifactPath,
    byteLength: bytes.byteLength,
    sha256: sha256Bytes(bytes),
    ...(includeBytes ? { bytes } : {})
  });
}

export async function readStableRegularFile({
  filePath,
  label = 'release evidence source file'
}) {
  if (typeof filePath !== 'string' || filePath.length === 0) {
    throw new TypeError(`${label} path must be a non-empty string`);
  }
  const resolvedPath = path.resolve(filePath);
  await assertNoSymlinkPathComponents(resolvedPath, label);
  const before = await lstat(resolvedPath);
  if (!before.isFile() || before.isSymbolicLink()) {
    throw new Error(`${label} must be a regular non-symlink file`);
  }
  const handle = await open(
    resolvedPath,
    fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW
  );
  let bytes;
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || !sameIdentity(before, opened)) {
      throw new Error(`${label} changed before it could be read`);
    }
    bytes = await handle.readFile();
    const afterRead = await handle.stat();
    if (!sameIdentity(opened, afterRead)) {
      throw new Error(`${label} changed while it was read`);
    }
  } finally {
    await handle.close();
  }
  const after = await lstat(resolvedPath);
  if (!after.isFile() || after.isSymbolicLink() || !sameIdentity(before, after)) {
    throw new Error(`${label} changed after it was read`);
  }
  return Object.freeze({ path: resolvedPath, bytes, stat: before });
}

function serializedBytes(value, format) {
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return Buffer.from(value);
  }
  if (format === 'jsonl') {
    if (!Array.isArray(value)) {
      throw new TypeError('JSONL release evidence must be an array');
    }
    return Buffer.from(
      `${value.map((entry) => JSON.stringify(entry)).join('\n')}\n`,
      'utf8'
    );
  }
  if (format === 'text') return Buffer.from(String(value), 'utf8');
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function regularNonSymlinkWithIdentity(stat, expectedIdentity) {
  return Boolean(
    stat
    && stat.isFile()
    && !stat.isSymbolicLink()
    && (!expectedIdentity || (
      expectedIdentity.dev === stat.dev
      && expectedIdentity.ino === stat.ino
    ))
  );
}

async function syncRegularFileIdentity({ filePath, expectedIdentity, label }) {
  const before = await lstat(filePath);
  if (!regularNonSymlinkWithIdentity(before, expectedIdentity)) {
    throw new Error(`${label} changed before it could be synced`);
  }
  const handle = await open(filePath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
  try {
    const opened = await handle.stat();
    if (!regularNonSymlinkWithIdentity(opened, before)) {
      throw new Error(`${label} changed before its nofollow handle could be synced`);
    }
    await handle.sync();
    const afterSync = await handle.stat();
    if (!regularNonSymlinkWithIdentity(afterSync, opened)) {
      throw new Error(`${label} changed while its nofollow handle was synced`);
    }
  } finally {
    await handle.close();
  }
  const after = await lstat(filePath);
  if (!regularNonSymlinkWithIdentity(after, before)) {
    throw new Error(`${label} changed after it was synced`);
  }
  return after;
}

async function syncPrivateArtifactParent(parent, label) {
  await assertParentIdentity(parent, label);
  const handle = await open(
    parent.path,
    fsConstants.O_RDONLY | fsConstants.O_DIRECTORY | fsConstants.O_NOFOLLOW
  );
  try {
    const opened = await handle.stat();
    if (
      !opened.isDirectory()
      || !sameIdentity(parent.stat, opened)
      || (opened.mode & 0o777) !== 0o700
      || typeof process.getuid !== 'function'
      || opened.uid !== process.getuid()
    ) {
      throw new Error(`${label} parent changed before it could be synced`);
    }
    await handle.sync();
    const afterSync = await handle.stat();
    if (!sameIdentity(opened, afterSync)) {
      throw new Error(`${label} parent changed while it was synced`);
    }
  } finally {
    await handle.close();
  }
  await assertParentIdentity(parent, label);
}

async function assertArtifactTargetAbsent(artifactPath, label) {
  try {
    await lstat(artifactPath);
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }
  throw new Error(`${label} already exists and will not be replaced`);
}

async function assertTrackedRegularArtifact({ outputPath, identity, label }) {
  const observed = await lstat(outputPath);
  if (!regularNonSymlinkWithIdentity(observed, identity)) {
    throw new Error(`${label} changed before replacement; external final retained`);
  }
  return observed;
}

function validArtifactIdentity(identity) {
  return Boolean(
    identity
    && typeof identity === 'object'
    && Number.isSafeInteger(identity.dev)
    && identity.dev >= 0
    && Number.isSafeInteger(identity.ino)
    && identity.ino >= 0
  );
}

async function atomicishReplace({
  outputPath,
  bytes,
  label,
  afterStep = null,
  previousIdentity = null
}) {
  const parent = await ensurePrivateArtifactParent(outputPath, label);
  await assertParentIdentity(parent, label);
  const temporaryPath = path.join(
    path.dirname(outputPath),
    `.${path.basename(outputPath)}.${process.pid}.${randomUUID()}.tmp`
  );
  let published = false;
  try {
    const temporary = await open(
      temporaryPath,
      fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_NOFOLLOW,
      0o600
    );
    try {
      await temporary.writeFile(bytes);
      await afterStep?.(Object.freeze({ step: 'before-temporary-sync', outputPath, temporaryPath }));
      // A successful write is not a durable receipt until its file data has
      // reached the filesystem before the name is published.
      await temporary.sync();
      await afterStep?.(Object.freeze({ step: 'after-temporary-sync', outputPath, temporaryPath }));
    } finally {
      await temporary.close();
    }
    const temporaryIdentity = await syncRegularFileIdentity({
      filePath: temporaryPath,
      label: `${label} temporary artifact`
    });
    await afterStep?.(Object.freeze({ step: 'before-rename', outputPath, temporaryPath }));
    await assertParentIdentity(parent, label);
    if (previousIdentity == null) {
      await assertArtifactTargetAbsent(outputPath, label);
      // link() is same-directory atomic no-clobber publication.  The initial
      // failed sentinel never uses rename(), so an already existing final is
      // never overwritten.
      await link(temporaryPath, outputPath);
    } else {
      // This check deliberately happens immediately before rename.  A private
      // 0700 parent owned by this UID excludes other-UID writers, but portable
      // Node has no renameat2(RENAME_EXCHANGE)/directory-handle primitive: a
      // hostile same-UID process can still swap the name after this check and
      // before rename.  We fail closed on every observable drift and do not
      // overclaim that the check-to-rename interval is race-free.
      await assertTrackedRegularArtifact({
        outputPath,
        identity: previousIdentity,
        label
      });
      await rename(temporaryPath, outputPath);
    }
    published = true;
    await afterStep?.(Object.freeze({ step: 'after-rename', outputPath, temporaryPath }));
    await assertParentIdentity(parent, label);
    const written = await lstat(outputPath);
    if (!regularNonSymlinkWithIdentity(written, temporaryIdentity)) {
      throw new Error(`${label} replacement identity changed; external final retained`);
    }
    await afterStep?.(Object.freeze({ step: 'before-parent-sync', outputPath, temporaryPath }));
    // The directory sync makes the published name durable after the nofollow
    // temporary-file fsync above.  Recheck both identities after the sync
    // before this operation can be reported as complete.
    await syncPrivateArtifactParent(parent, label);
    await afterStep?.(Object.freeze({ step: 'after-parent-sync', outputPath, temporaryPath }));
    await assertParentIdentity(parent, label);
    const finalIdentity = await lstat(outputPath);
    if (!regularNonSymlinkWithIdentity(finalIdentity, temporaryIdentity)) {
      throw new Error(`${label} replacement identity changed after parent sync; external final retained`);
    }
    if (previousIdentity == null) {
      // Initial publication uses link() for atomic no-clobber semantics, so
      // the private temporary name remains as a second hard link until the
      // durable final has been verified.  Remove that invocation-owned name
      // after verification; otherwise directory-manifest consumers (notably
      // visual frame receipts) correctly report unexplained artifact drift.
      const linkedTemporaryIdentity = await lstat(temporaryPath);
      if (!regularNonSymlinkWithIdentity(linkedTemporaryIdentity, temporaryIdentity)) {
        throw new Error(`${label} temporary identity changed after durable publication; external temporary retained`);
      }
      await assertParentIdentity(parent, label);
      await rm(temporaryPath, { force: true });
      await syncPrivateArtifactParent(parent, label);
      await assertParentIdentity(parent, label);
      const finalAfterTemporaryCleanup = await lstat(outputPath);
      if (!regularNonSymlinkWithIdentity(finalAfterTemporaryCleanup, temporaryIdentity)) {
        throw new Error(`${label} replacement identity changed after temporary cleanup; external final retained`);
      }
      return finalAfterTemporaryCleanup;
    }
    return finalIdentity;
  } finally {
    if (!published) {
      // Do not perform an unguarded cleanup after a failed write/sync/rename.
      // Portable Node lacks an unlink-at-a-directory-handle primitive, so even
      // lstat()+unlink cannot be made atomic against an adversarial same-UID
      // swap.  The private, current-UID-owned 0700 parent excludes other-UID
      // writers but deliberately does not overclaim that stronger guarantee.
      // A failed receipt therefore retains this named temporary orphan for
      // manual cleanup rather than risking deletion of an external target.
    }
  }
}

async function failSentinelFixtureStep({ fixture, repoDir, label }) {
  if (fixture == null) return null;
  if (!fixture || typeof fixture !== 'object' || typeof fixture.afterAtomicishReplaceStep !== 'function') {
    throw new TypeError(`${label} fixture seam requires an afterAtomicishReplaceStep function`);
  }
  await assertNonProductionFixtureCapability({
    capability: fixture.capability,
    repoDir,
    productionRepoDir: fixture.productionRepoDir,
    label: `${label} fixture seam`
  });
  return fixture.afterAtomicishReplaceStep;
}

export async function createFailSentinelWriter({
  outputPath,
  repoDir,
  sentinel,
  format = 'json',
  label = 'release evidence output',
  fixture = null,
  // This is deliberately opt-in.  Callers that need to re-finalize an
  // already validated receipt must validate its content themselves, capture
  // its stable dev+ino, and pass that identity.  Default creation is always
  // no-clobber and never adopts an existing output implicitly.
  adoptExistingOutputIdentity = null
}) {
  const guarded = await assertArtifactPathOutsideRepo({
    artifactPath: outputPath,
    repoDir,
    label
  });
  const afterStep = await failSentinelFixtureStep({ fixture, repoDir, label });
  let trackedIdentity;
  if (adoptExistingOutputIdentity == null) {
    trackedIdentity = await atomicishReplace({
      outputPath: guarded.artifactPath,
      bytes: serializedBytes(sentinel, format),
      label,
      afterStep
    });
  } else {
    if (!validArtifactIdentity(adoptExistingOutputIdentity)) {
      throw new TypeError(`${label} existing-output adoption requires a stable dev+ino identity`);
    }
    const parent = await ensurePrivateArtifactParent(guarded.artifactPath, label);
    await assertParentIdentity(parent, label);
    trackedIdentity = await syncRegularFileIdentity({
      filePath: guarded.artifactPath,
      expectedIdentity: adoptExistingOutputIdentity,
      label: `${label} adopted existing output`
    });
    await syncPrivateArtifactParent(parent, label);
    await assertTrackedRegularArtifact({
      outputPath: guarded.artifactPath,
      identity: trackedIdentity,
      label: `${label} adopted existing output`
    });
  }
  let replacementCount = 0;
  return Object.freeze({
    outputPath: guarded.artifactPath,
    async replace(value) {
      const nextIdentity = await atomicishReplace({
        outputPath: guarded.artifactPath,
        bytes: serializedBytes(value, format),
        label,
        afterStep,
        previousIdentity: trackedIdentity
      });
      trackedIdentity = nextIdentity;
      replacementCount += 1;
      return replacementCount;
    },
    replacementCount() {
      return replacementCount;
    }
  });
}

export function artifactMetadataMatches(stored, observed) {
  return Boolean(
    stored
    && observed
    && path.resolve(stored.path ?? '') === path.resolve(observed.path ?? '')
    && stored.byteLength === observed.byteLength
    && stored.sha256 === observed.sha256
    && /^[0-9a-f]{64}$/u.test(stored.sha256 ?? '')
  );
}

export function parseNodeTap(text, { expectedSkips = [] } = {}) {
  const summary = {
    tests: null,
    suites: null,
    pass: null,
    fail: null,
    cancelled: null,
    skipped: null,
    todo: null
  };
  const cases = [];
  const controlDirectives = [];
  const filteringLines = [];
  const malformedLines = [];
  const lines = String(text).split(/\r?\n/u);
  const nonEmptyLines = lines.filter((line) => line.trim().length > 0);
  const headerCount = nonEmptyLines.filter((line) => line.trim() === 'TAP version 13').length;
  const planLines = [];
  const rootCases = [];
  const caseDirectiveLines = new Set();
  const summaryCounts = new Map();
  for (const line of lines) {
    const trimmed = line.trim();
    const rootLine = line === trimmed;
    const summaryMatch = trimmed.match(
      /^# (tests|suites|pass|fail|cancelled|skipped|todo) (\d+)$/u
    );
    if (rootLine && summaryMatch) {
      summaryCounts.set(
        summaryMatch[1],
        (summaryCounts.get(summaryMatch[1]) ?? 0) + 1
      );
      summary[summaryMatch[1]] = Number(summaryMatch[2]);
      continue;
    }
    const planMatch = trimmed.match(/^(\d+)\.\.(\d+)$/u);
    if (rootLine && planMatch) {
      planLines.push(Object.freeze({ first: Number(planMatch[1]), last: Number(planMatch[2]) }));
      continue;
    }
    if (/^\s*\d+\.\./u.test(line) && !planMatch) malformedLines.push(trimmed);
    if (/^Bail out!/iu.test(trimmed)) malformedLines.push(trimmed);
    const directiveMatch = trimmed.match(/(?:^|\s)#\s*(SKIP|TODO|CANCELLED)\b/iu);
    if (directiveMatch) {
      controlDirectives.push(Object.freeze({
        line: trimmed,
        directive: directiveMatch[1].toUpperCase()
      }));
    }
    if (/^#\s+test (?:name|file) does not match pattern\b/iu.test(trimmed)) {
      filteringLines.push(trimmed);
    }
    const caseMatch = trimmed.match(/^(not )?ok\s+(\d+)\s+-\s+(.+?)(?:\s+#\s+(SKIP|TODO|CANCELLED)(?:\s+(.*))?)?$/iu);
    if (caseMatch) {
      const testCase = Object.freeze({
        number: Number(caseMatch[2]),
        name: caseMatch[3],
        ok: caseMatch[1] == null,
        directive: caseMatch[4]?.toUpperCase() ?? null,
        reason: caseMatch[5] ?? ''
      });
      cases.push(testCase);
      if (rootLine) rootCases.push(testCase);
      if (testCase.directive !== null) caseDirectiveLines.add(trimmed);
    }
  }
  const expected = Array.isArray(expectedSkips) ? expectedSkips : [];
  const actualSkips = cases
    .filter((entry) => entry.directive === 'SKIP')
    .map((entry) => Object.freeze({ name: entry.name, reason: entry.reason }));
  const expectedSkipCounts = new Map();
  for (const entry of expected) {
    if (!entry || typeof entry.name !== 'string' || typeof entry.reason !== 'string') {
      malformedLines.push('malformed expected skip policy entry');
      continue;
    }
    const key = `${entry.name}\u0000${entry.reason}`;
    expectedSkipCounts.set(key, (expectedSkipCounts.get(key) ?? 0) + 1);
  }
  const unmatchedSkips = [];
  for (const entry of actualSkips) {
    const key = `${entry.name}\u0000${entry.reason}`;
    const remaining = expectedSkipCounts.get(key) ?? 0;
    if (remaining === 0) unmatchedSkips.push(entry);
    else expectedSkipCounts.set(key, remaining - 1);
  }
  const summaryComplete = Object.values(summary).every(Number.isSafeInteger);
  const summaryUnique = [...summaryCounts.values()].every((count) => count === 1);
  const plan = planLines.length === 1 ? planLines[0] : null;
  const rootCaseNumbersSequential = rootCases.every(
    (entry, index) => entry.number === index + 1
  );
  const caseCounts = {
    pass: cases.filter((entry) => entry.ok && entry.directive == null).length,
    fail: cases.filter((entry) => !entry.ok && entry.directive == null).length,
    cancelled: cases.filter((entry) => entry.directive === 'CANCELLED').length,
    skipped: actualSkips.length,
    todo: cases.filter((entry) => entry.directive === 'TODO').length
  };
  const summaryConsistent = summaryComplete
    && plan?.first === 1
    && plan.last === rootCases.length
    && cases.length === summary.tests
    && rootCaseNumbersSequential
    && summary.tests === summary.pass + summary.fail + summary.cancelled
      + summary.skipped + summary.todo
    && Object.entries(caseCounts).every(([field, count]) => summary[field] === count);
  const disallowedDirectives = controlDirectives.filter((entry) => entry.directive !== 'SKIP');
  const standaloneSkipDirectives = controlDirectives.filter((entry) => (
    !caseDirectiveLines.has(entry.line)
  ));
  return Object.freeze({
    summary: Object.freeze(summary),
    cases: Object.freeze(cases),
    controlDirectives: Object.freeze(controlDirectives),
    filteringLines: Object.freeze(filteringLines),
    malformedLines: Object.freeze(malformedLines),
    headerCount,
    plan,
    actualSkips: Object.freeze(actualSkips),
    unmatchedSkips: Object.freeze(unmatchedSkips),
    summaryComplete,
    successful: Boolean(
      headerCount === 1
      && nonEmptyLines[0] === 'TAP version 13'
      && summaryComplete
      && summaryUnique
      && summaryConsistent
      && summary.tests > 0
      && summary.fail === 0
      && summary.cancelled === 0
      && summary.todo === 0
      && cases.every((entry) => entry.ok)
      && disallowedDirectives.length === 0
      && standaloneSkipDirectives.length === 0
      && unmatchedSkips.length === 0
      && filteringLines.length === 0
      && malformedLines.length === 0
    )
  });
}

export async function runProcessToArtifacts({
  executable,
  args,
  cwd,
  env,
  stdoutPath,
  stderrPath,
  repoDir,
  maxOutputBytes = Number.POSITIVE_INFINITY,
  aggregateOutputBudget = null,
  hardTimeoutMs = null,
  ownedProcessGroup = false,
  termGraceMs = 2_000,
  killGraceMs = 3_000,
  abortSignal = null,
  fixture = null
}) {
  if (!(maxOutputBytes === Number.POSITIVE_INFINITY
    || (Number.isSafeInteger(maxOutputBytes) && maxOutputBytes >= 0))) {
    throw new TypeError('subprocess output maximum byte length must be a non-negative safe integer');
  }
  if (aggregateOutputBudget != null && (
    typeof aggregateOutputBudget !== 'object'
    || !Number.isSafeInteger(aggregateOutputBudget.maxByteLength)
    || aggregateOutputBudget.maxByteLength < 0
    || !Number.isSafeInteger(aggregateOutputBudget.byteLength)
    || aggregateOutputBudget.byteLength < 0
    || aggregateOutputBudget.byteLength > aggregateOutputBudget.maxByteLength
  )) {
    throw new TypeError('subprocess aggregate output budget must carry safe byte lengths');
  }
  if (
    hardTimeoutMs != null
    && (!Number.isSafeInteger(hardTimeoutMs) || hardTimeoutMs <= 0)
  ) {
    throw new TypeError('subprocess hard timeout must be a positive safe integer or null');
  }
  if (typeof ownedProcessGroup !== 'boolean') {
    throw new TypeError('subprocess owned-process-group flag must be boolean');
  }
  if (ownedProcessGroup && process.platform === 'win32') {
    throw new Error('subprocess owned process groups require POSIX process-group signaling');
  }
  for (const [label, value] of [
    ['TERM grace', termGraceMs],
    ['KILL grace', killGraceMs]
  ]) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new TypeError(`subprocess ${label} must be a non-negative safe integer`);
    }
  }
  if (
    abortSignal != null
    && (
      typeof abortSignal !== 'object'
      || typeof abortSignal.aborted !== 'boolean'
      || typeof abortSignal.addEventListener !== 'function'
      || typeof abortSignal.removeEventListener !== 'function'
    )
  ) {
    throw new TypeError('subprocess abort signal must implement the AbortSignal contract');
  }
  if (abortSignal?.aborted) {
    const error = new Error('subprocess launch cancelled before spawn');
    error.name = 'AbortError';
    error.code = 'ERR_RELEASE_EVIDENCE_ABORTED';
    throw error;
  }
  let afterArtifactLinked = null;
  let afterArtifactIdentityVerified = null;
  let suppressChildCloseSettlement = false;
  if (fixture != null) {
    if (!fixture || typeof fixture !== 'object') {
      throw new TypeError('subprocess fixture seam must be an object');
    }
    if (
      typeof fixture.afterArtifactLinked !== 'function'
      && typeof fixture.afterArtifactIdentityVerified !== 'function'
      && fixture.suppressChildCloseSettlement !== true
    ) {
      throw new TypeError(
        'subprocess fixture seam requires an artifact publication hook or close-settlement suppression'
      );
    }
    await assertNonProductionFixtureCapability({
      capability: fixture.capability,
      repoDir,
      productionRepoDir: fixture.productionRepoDir,
      label: 'subprocess fixture seam'
    });
    afterArtifactLinked = fixture.afterArtifactLinked;
    afterArtifactIdentityVerified = fixture.afterArtifactIdentityVerified;
    suppressChildCloseSettlement = fixture.suppressChildCloseSettlement === true;
  }
  const [stdoutGuard, stderrGuard] = await assertArtifactPathsPairwiseDistinct({
    repoDir,
    label: 'subprocess output artifacts',
    paths: [
      { path: stdoutPath, label: 'subprocess stdout artifact' },
      { path: stderrPath, label: 'subprocess stderr artifact' }
    ]
  });
  const [stdoutParent, stderrParent] = await Promise.all([
    ensurePrivateArtifactParent(stdoutGuard.artifactPath, 'subprocess stdout artifact'),
    ensurePrivateArtifactParent(stderrGuard.artifactPath, 'subprocess stderr artifact')
  ]);
  const nonce = `${process.pid}.${randomUUID()}`;
  const stdoutTemporary = `${stdoutGuard.artifactPath}.${nonce}.tmp`;
  const stderrTemporary = `${stderrGuard.artifactPath}.${nonce}.tmp`;
  const stdoutStream = createWriteStream(stdoutTemporary, {
    flags: 'wx',
    mode: 0o600
  });
  const stderrStream = createWriteStream(stderrTemporary, {
    flags: 'wx',
    mode: 0o600
  });
  // Attach completion/error listeners before the child starts.  In particular,
  // a disk error must not become an unhandled stream error while the child is
  // still producing output.
  const stdoutFinished = finished(stdoutStream);
  const stderrFinished = finished(stderrStream);
  let exitCode = null;
  let signal = null;
  let spawnError = null;
  let captureError = null;
  let timedOut = false;
  let aborted = false;
  let capturedBytes = 0;
  let child = null;
  let childTerminationTimer = null;
  let hardTimeoutTimer = null;
  let terminationPromise = null;
  let terminationReason = 'natural-exit';
  let termSent = false;
  let killSent = false;
  let terminationStopped = false;
  let terminationError = null;
  let settleChildCloseAfterTermination = null;
  let childCloseObserved = false;
  let forcedCaptureClose = false;
  let abortListener = null;
  let stdoutPaused = false;
  let stderrPaused = false;
  const committedArtifacts = new Map();
  const retainedTemporaryArtifacts = new Set();
  const currentTerminationEvidence = () => Object.freeze({
    mode: ownedProcessGroup
      ? 'owned-detached-process-group'
      : 'owned-direct-child',
    reason: terminationReason,
    hardTimeoutMs,
    termGraceMs,
    killGraceMs,
    termSent,
    killSent,
    stopped: terminationStopped,
    error: terminationError,
    forcedCaptureClose,
    pid: Number.isSafeInteger(child?.pid) && child.pid > 1
      ? child.pid
      : null,
    processGroupId:
      ownedProcessGroup
      && Number.isSafeInteger(child?.pid)
      && child.pid > 1
        ? child.pid
        : null
  });
  const clearChildTerminationTimer = () => {
    if (childTerminationTimer != null) {
      clearTimeout(childTerminationTimer);
      childTerminationTimer = null;
    }
  };
  const clearHardTimeoutTimer = () => {
    if (hardTimeoutTimer != null) {
      clearTimeout(hardTimeoutTimer);
      hardTimeoutTimer = null;
    }
  };
  const delay = (milliseconds) => new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
  const ownedTargetAlive = () => {
    const pid = child?.pid;
    // POSIX kill(-1, ...) broadcasts to every signalable process. Never let
    // an unexpected PID 1 cross the negative-PGID boundary.
    if (!Number.isSafeInteger(pid) || pid <= 1) return false;
    if (
      !ownedProcessGroup
      && (child.exitCode != null || child.signalCode != null)
    ) {
      return false;
    }
    try {
      process.kill(ownedProcessGroup ? -pid : pid, 0);
      return true;
    } catch (error) {
      if (error?.code === 'ESRCH') return false;
      if (error?.code === 'EPERM') return true;
      terminationError ??= error instanceof Error
        ? error.message
        : String(error);
      return true;
    }
  };
  const waitForOwnedTargetStop = async (graceMs) => {
    const deadline = Date.now() + graceMs;
    while (ownedTargetAlive()) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) return false;
      await delay(Math.min(25, remaining));
    }
    return true;
  };
  const signalOwnedTarget = (requestedSignal) => {
    if (!ownedTargetAlive()) return false;
    try {
      if (ownedProcessGroup) {
        process.kill(-child.pid, requestedSignal);
      } else {
        child.kill(requestedSignal);
      }
      return true;
    } catch (error) {
      if (error?.code === 'ESRCH') return false;
      terminationError ??= error instanceof Error
        ? error.message
        : String(error);
      return false;
    }
  };
  const terminateOwnedTarget = (reason) => {
    if (terminationPromise) return terminationPromise;
    terminationReason = reason;
    terminationPromise = (async () => {
      termSent = signalOwnedTarget('SIGTERM');
      terminationStopped = await waitForOwnedTargetStop(termGraceMs);
      if (!terminationStopped) {
        killSent = signalOwnedTarget('SIGKILL');
        terminationStopped = await waitForOwnedTargetStop(killGraceMs);
      }
      return terminationStopped;
    })();
    return terminationPromise;
  };
  const stopOwnedChild = () => {
    if (ownedProcessGroup) {
      void terminateOwnedTarget('capture-failure').then(() => (
        settleChildCloseAfterTermination?.()
      ));
      child?.stdout?.destroy();
      child?.stderr?.destroy();
      return;
    }
    if (child && child.exitCode == null && child.signalCode == null) {
      // This is the direct child created above.  Do not address a process
      // group or any inherited process, because release evidence must never
      // interfere with an unrelated browser, server, device tool, or user
      // process.
      try {
        child.kill('SIGTERM');
      } catch {
        // A direct child can exit between its liveness check and kill().  Its
        // close handler remains the sole settlement authority in that case.
      }
      if (childTerminationTimer == null) {
        const ownedChild = child;
        childTerminationTimer = setTimeout(() => {
          childTerminationTimer = null;
          if (
            child === ownedChild
            && ownedChild.exitCode == null
            && ownedChild.signalCode == null
          ) {
            // Escalate only the ChildProcess that this invocation spawned.
            // Never use a PID, process group, or inherited process handle.
            try {
              ownedChild.kill('SIGKILL');
            } catch {
              // close() will settle the capture if the child won the race.
            }
          }
        }, 250);
        childTerminationTimer.unref();
      }
    }
    // Stop consuming both pipes after the first over-limit chunk.  Destroying
    // only these pipe handles cannot affect anything except this owned child.
    child?.stdout?.destroy();
    child?.stderr?.destroy();
  };
  const overflow = (streamName, byteLength, limit, aggregate = false) => {
    const error = new Error(
      aggregate
        ? `subprocess aggregate output exceeds its ${limit}-byte maximum while capturing ${streamName}`
        : `subprocess output exceeds its ${limit}-byte maximum while capturing ${streamName}`
    );
    error.code = 'ERR_RELEASE_EVIDENCE_OUTPUT_LIMIT';
    error.stream = streamName;
    error.attemptedByteLength = byteLength;
    error.capturedByteLength = capturedBytes;
    error.aggregateCapturedByteLength = aggregateOutputBudget?.byteLength ?? null;
    return error;
  };
  const reserveOutputBytes = (streamName, byteLength) => {
    if (captureError) return false;
    if (byteLength > maxOutputBytes - capturedBytes) {
      captureError = overflow(streamName, byteLength, maxOutputBytes);
    } else if (aggregateOutputBudget
      && byteLength > aggregateOutputBudget.maxByteLength - aggregateOutputBudget.byteLength) {
      captureError = overflow(
        streamName,
        byteLength,
        aggregateOutputBudget.maxByteLength,
        true
      );
    } else {
      capturedBytes += byteLength;
      if (aggregateOutputBudget) aggregateOutputBudget.byteLength += byteLength;
      return true;
    }
    stopOwnedChild();
    return false;
  };
  const stopForStreamError = (error) => {
    if (!captureError) {
      captureError = error instanceof Error ? error : new Error(String(error));
    }
    stopOwnedChild();
  };
  const assertArtifactTargetAbsent = async (artifactPath, label) => {
    try {
      await lstat(artifactPath);
    } catch (error) {
      if (error?.code === 'ENOENT') return;
      throw error;
    }
    throw new Error(`${label} already exists and will not be replaced`);
  };
  const rollbackCommittedArtifacts = async () => {
    await Promise.all([...committedArtifacts.entries()].map(async ([artifactPath, identity]) => {
      try {
        const observed = await lstat(artifactPath);
        if (sameIdentity(identity, observed)) {
          // The parent is checked as real, 0700, and current-UID-owned.  That
          // excludes other-UID writers, so this is a best-effort cleanup for
          // the invocation's own identity only.  Node has no unlinkat-style
          // directory-handle API: lstat()+unlink is not atomic against an
          // adversarial same-UID process that can swap this name.  We do not
          // claim to close that threat model, and mismatch failures below
          // retain their temporary orphan instead of attempting a riskier
          // pathname cleanup.
          await rm(artifactPath, { force: true });
        }
      } catch {
        // Never replace the original commit failure, and never remove a path
        // whose identity no longer proves that this invocation created it.
      }
    }));
  };
  const publishTemporaryArtifact = async ({
    temporaryPath,
    artifactPath,
    temporaryIdentity,
    parent,
    label
  }) => {
    await assertParentIdentity(parent, label);
    await assertArtifactTargetAbsent(artifactPath, label);
    // link() is an atomic no-clobber publish in this same parent filesystem.
    // Unlike rename(), it cannot replace an inherited target that this
    // invocation does not own.  The temporary link is removed only after the
    // final path's identity is proven and recorded for rollback.
    await link(temporaryPath, artifactPath);
    // Deterministic race injection is available only to an opaque,
    // non-production fixture capability.  Production callers cannot reach
    // this seam, while its position lets the regression cover the precise
    // post-link/pre-audit interval.
    if (afterArtifactLinked) {
      await afterArtifactLinked(Object.freeze({ artifactPath, label }));
    }
    const observed = await lstat(artifactPath);
    if (!sameIdentity(temporaryIdentity, observed)) {
      // This final name no longer proves it is ours.  In particular, it may
      // be an external replacement, not rollback-owned evidence.  Preserve
      // it, retain the known temporary orphan, and fail the receipt.
      retainedTemporaryArtifacts.add(temporaryPath);
      throw new Error(
        `${label} identity changed during artifact commit; external final retained and own temporary retained for manual cleanup`
      );
    }
    if (afterArtifactIdentityVerified) {
      await afterArtifactIdentityVerified(Object.freeze({ artifactPath, label }));
    }
    const afterVerified = await lstat(artifactPath);
    if (!sameIdentity(temporaryIdentity, afterVerified)) {
      // See the mismatch above: a hook or a same-UID attacker can replace the
      // final after verification but before temporary unlink.  The final is
      // external, so neither rollback nor cleanup may remove it.  Retaining
      // the temporary link is deliberate: portable Node cannot conditionally
      // unlink it atomically against a same-UID name swap.
      retainedTemporaryArtifacts.add(temporaryPath);
      throw new Error(
        `${label} identity changed after artifact verification; external final retained and own temporary retained for manual cleanup`
      );
    }
    // Make the newly linked final and its directory entry durable before it
    // becomes rollback-owned or can contribute returned artifact metadata.
    await syncRegularFileIdentity({
      filePath: artifactPath,
      expectedIdentity: temporaryIdentity,
      label
    });
    await syncPrivateArtifactParent(parent, label);
    const durableFinal = await lstat(artifactPath);
    if (!regularNonSymlinkWithIdentity(durableFinal, temporaryIdentity)) {
      retainedTemporaryArtifacts.add(temporaryPath);
      throw new Error(
        `${label} identity changed after durable link sync; external final retained and own temporary retained for manual cleanup`
      );
    }
    committedArtifacts.set(artifactPath, temporaryIdentity);
    await assertParentIdentity(parent, label);
    await rm(temporaryPath, { force: true });
  };
  stdoutStream.once('error', stopForStreamError);
  stderrStream.once('error', stopForStreamError);
  const processStartedAtMs = Date.now();
  try {
    await Promise.all([
      assertParentIdentity(stdoutParent, 'subprocess stdout artifact'),
      assertParentIdentity(stderrParent, 'subprocess stderr artifact')
    ]);
    child = spawn(executable, args, {
      cwd,
      env: scrubReleaseEvidenceChildEnvironment(env),
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: ownedProcessGroup
    });
    const capture = (source, destination, streamName, pause) => {
      source.on('data', (chunk) => {
        if (!reserveOutputBytes(streamName, chunk.byteLength)) {
          source.pause();
          return;
        }
        if (!destination.write(chunk)) {
          pause();
          destination.once('drain', () => source.resume());
        }
      });
    };
    capture(child.stdout, stdoutStream, 'stdout', () => { stdoutPaused = true; child.stdout.pause(); });
    capture(child.stderr, stderrStream, 'stderr', () => { stderrPaused = true; child.stderr.pause(); });
    let childCloseSettled = false;
    let settleChildClose;
    const childClose = new Promise((resolve) => {
      settleChildClose = () => {
        if (childCloseSettled) return;
        childCloseSettled = true;
        resolve();
      };
      child.once('error', (error) => {
        spawnError = error instanceof Error ? error.message : String(error);
      });
      child.once('close', (code, observedSignal) => {
        if (suppressChildCloseSettlement) {
          // Test-only fault injection for platforms or escaped fd holders that
          // withhold the coordinator close event. The opaque capability above
          // makes this branch unreachable from production evidence capture.
          exitCode = code;
          signal = observedSignal;
          return;
        }
        childCloseObserved = true;
        clearChildTerminationTimer();
        clearHardTimeoutTimer();
        exitCode = code;
        signal = observedSignal;
        settleChildClose();
      });
    });
    settleChildCloseAfterTermination = async () => {
      // Once the exact owned target is gone, allow one short turn for Node to
      // drain the closed pipes and publish the ordinary close event. If a
      // platform/runtime defect or escaped fd-holder withholds close, sever
      // only these owned pipe handles so the hard boundary can still publish
      // the bytes captured so far.
      if (!childCloseSettled) await delay(100);
      if (!childCloseSettled) {
        forcedCaptureClose = true;
        exitCode = child.exitCode;
        signal = child.signalCode;
        child.stdout?.destroy();
        child.stderr?.destroy();
        child.unref();
        settleChildClose();
      }
    };
    if (abortSignal != null) {
      abortListener = () => {
        aborted = true;
        clearHardTimeoutTimer();
        void terminateOwnedTarget('abort-signal').then(
          settleChildCloseAfterTermination
        );
      };
      abortSignal.addEventListener('abort', abortListener, { once: true });
      if (abortSignal.aborted) abortListener();
    }
    if (hardTimeoutMs != null && !aborted) {
      hardTimeoutTimer = setTimeout(() => {
        hardTimeoutTimer = null;
        timedOut = true;
        void terminateOwnedTarget('hard-timeout').then(
          settleChildCloseAfterTermination
        );
      }, hardTimeoutMs);
    }
    await childClose;
    if (abortListener != null) {
      abortSignal.removeEventListener('abort', abortListener);
      abortListener = null;
    }
    clearHardTimeoutTimer();
    if (terminationPromise) {
      await terminationPromise;
    } else if (ownedProcessGroup) {
      // A successful coordinator must not leave its owned browser/server
      // descendants behind. Give process-group teardown a brief natural
      // settlement window, then clean up the exact PGID and report that the
      // command did not stop naturally.
      terminationStopped = await waitForOwnedTargetStop(100);
      if (!terminationStopped) {
        await terminateOwnedTarget('post-exit-descendant-cleanup');
      }
    } else {
      terminationStopped = true;
    }
    // A paused source can otherwise retain its final buffered data after the
    // owned child exits.  Ending the destinations makes their completion
    // independent of pipe/event ordering and leaves no partial final artifact.
    if (stdoutPaused) child.stdout.resume();
    if (stderrPaused) child.stderr.resume();
    stdoutStream.end();
    stderrStream.end();
    await Promise.all([stdoutFinished, stderrFinished]);
    if (captureError) throw captureError;
    // Stream completion alone does not make evidence durable.  Sync each
    // finished temporary through a nofollow descriptor and verify the opened
    // identity before it can be atomically linked into its final name.
    const [stdoutTemporaryIdentity, stderrTemporaryIdentity] = await Promise.all([
      syncRegularFileIdentity({
        filePath: stdoutTemporary,
        label: 'subprocess stdout temporary artifact'
      }),
      syncRegularFileIdentity({
        filePath: stderrTemporary,
        label: 'subprocess stderr temporary artifact'
      })
    ]);
    await publishTemporaryArtifact({
      temporaryPath: stdoutTemporary,
      artifactPath: stdoutGuard.artifactPath,
      temporaryIdentity: stdoutTemporaryIdentity,
      parent: stdoutParent,
      label: 'subprocess stdout artifact'
    });
    await publishTemporaryArtifact({
      temporaryPath: stderrTemporary,
      artifactPath: stderrGuard.artifactPath,
      temporaryIdentity: stderrTemporaryIdentity,
      parent: stderrParent,
      label: 'subprocess stderr artifact'
    });
    const [stdoutArtifact, stderrArtifact] = await Promise.all([
      readHashedArtifact({
        artifactPath: stdoutGuard.artifactPath,
        repoDir,
        label: 'subprocess stdout artifact'
      }),
      readHashedArtifact({
        artifactPath: stderrGuard.artifactPath,
        repoDir,
        label: 'subprocess stderr artifact'
      })
    ]);
    return Object.freeze({
      exitCode,
      signal,
      spawnError,
      timedOut,
      aborted,
      closeObserved: childCloseObserved,
      durationMs: Date.now() - processStartedAtMs,
      termination: currentTerminationEvidence(),
      stdoutArtifact,
      stderrArtifact
    });
  } catch (error) {
    if (error && typeof error === 'object') {
      Object.defineProperty(error, 'releaseEvidenceProcess', {
        configurable: true,
        enumerable: false,
        value: Object.freeze({
          timedOut,
          aborted,
          closeObserved: childCloseObserved,
          termination: currentTerminationEvidence()
        })
      });
    }
    await rollbackCommittedArtifacts();
    throw error;
  } finally {
    clearChildTerminationTimer();
    clearHardTimeoutTimer();
    if (abortListener != null) {
      abortSignal.removeEventListener('abort', abortListener);
      abortListener = null;
    }
    await Promise.all([
      retainedTemporaryArtifacts.has(stdoutTemporary)
        ? Promise.resolve()
        : rm(stdoutTemporary, { force: true }).catch(() => {}),
      retainedTemporaryArtifacts.has(stderrTemporary)
        ? Promise.resolve()
        : rm(stderrTemporary, { force: true }).catch(() => {})
    ]);
  }
}
