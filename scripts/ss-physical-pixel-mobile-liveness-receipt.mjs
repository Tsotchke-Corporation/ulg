#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import { link, lstat, mkdir, open, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseAst } from 'vite';

import {
  MAX_PHYSICAL_PIXEL_PNG_BYTE_LENGTH,
  comparePhysicalPixelPngFrames,
  decodePhysicalPixelPng,
  publicPhysicalPixelPngMetrics
} from './physicalPixelPngEvidence.mjs';

import {
  SS_CONTAINED_POLICY_TRACK,
  assertArtifactPathOutsideRepo,
  assertArtifactPathsPairwiseDistinct,
  artifactMetadataMatches,
  canonicalJson,
  canonicalJsonSha256,
  assertNonProductionFixtureCapability,
  createFailSentinelWriter,
  exactWorktreeFingerprint,
  exactWorktreeFingerprintsEqual,
  readHashedArtifact,
  sha256Bytes
} from './ss-release-evidence-common.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const sourceRepoDir = path.resolve(scriptDir, '..');

export const PHYSICAL_PIXEL_COMMAND_POLICY_SCHEMA =
  'peercompute.ulg.ss-physical-pixel-mobile-command-policy.v2';
export const PHYSICAL_PIXEL_SOURCE_MANIFEST_SCHEMA =
  'peercompute.ulg.ss-physical-pixel-source-manifest.v3';
export const PHYSICAL_PIXEL_EVIDENCE_SCHEMA =
  'peercompute.ulg.ss-physical-pixel-mobile-liveness-evidence.v2';
export const PHYSICAL_PIXEL_RECEIPT_SCHEMA =
  'peercompute.ulg.ss-physical-pixel-mobile-liveness-receipt.v2';
export const PHYSICAL_PIXEL_POLICY_ID =
  'physical-google-pixel-9-pro-adb-cdp-compositor-motion-v2';
export const PHYSICAL_PIXEL_EVENT_KIND = 'ulg_sph_probe';
export const PHYSICAL_PIXEL_EVENT_NAME = 'mobile_animation_liveness_passed';

const TELEMETRY_SCHEMA = 'peercompute.ulg.gpu-readback-telemetry.v1';
const RAW_COMMAND_SCHEMA = 'peercompute.ulg.ss-physical-pixel-raw-command.v1';
const RAW_JSON_SCHEMA = 'peercompute.ulg.ss-physical-pixel-raw-json.v1';
const BUILTIN_CAPTURE_PROVIDER_ID = 'builtin-adb-cdp-physical-pixel-v2';
const ADB_EXECUTABLE = 'adb';
// Raw source parity is deliberately narrower than the transformed Vite closure.
// It proves the bytes for local source files only; it does not claim that Vite
// serves those bytes untransformed.
const LOCAL_RELATIVE_SOURCE_SCOPE =
  'vite-raw-text-local-relative-static-module-css-worker-resource-set.v1';
const SERVED_SOURCE_BINDING_ATTESTATION =
  'vite-transformed-static-resource-closure-with-raw-source-parity.v2';
const VITE_TRANSFORMED_RESOURCE_SCOPE =
  'vite-transformed-static-import-export-dynamic-css-worker-url-resource-closure.v1';
const VITE_RAW_SOURCE_PARITY_SCOPE =
  'vite-raw-direct-source-module-parity.v1';
const ALLOWLISTED_VITE_FS_ROOTS = Object.freeze([
  path.resolve(sourceRepoDir, '..', 'webgpu-marching-cubes')
]);
const SAMPLE_WINDOW_COUNT = 2;
const SAMPLE_TIMEOUT_MS = 180_000;
export const PHYSICAL_PIXEL_LIVENESS_LIMITS_MS = Object.freeze({
  activeCapture: 480_000,
  cleanup: 30_000,
  absolute: 540_000
});
const COMPOSITOR_CAPTURE_MAX_CSS_WIDTH = 240;
const COMPOSITOR_CAPTURE_MAX_CSS_HEIGHT = 320;
const COMPOSITOR_CAPTURE_MIN_CHANNEL_DELTA = 2;
const COMPOSITOR_CAPTURE_MIN_CHANGED_PIXEL_COUNT = 8;
const COMPOSITOR_CAPTURE_MIN_CHANGED_PIXEL_RATIO = 0.001;
const COMPOSITOR_CAPTURE_MIN_CHANGED_BOUNDS_WIDTH = 2;
const COMPOSITOR_CAPTURE_MIN_CHANGED_BOUNDS_HEIGHT = 2;
const BENIGN_COMPACT_MOTION_WARNING =
  'Resident physics is stepping, but compact motion proof is unavailable.';
const ZERO_READBACK_COUNTERS = Object.freeze({
  maps: 0,
  bytes: 0,
  fenceWaits: 0
});

function boundedPhysicalDeadline(env, name, fallback, ceiling) {
  const raw = env?.[name];
  if (raw == null || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive integer`);
  }
  if (value > ceiling) {
    throw new RangeError(`${name} cannot exceed ${ceiling} ms`);
  }
  return value;
}

export function resolvePhysicalPixelLivenessDeadlines(env = process.env) {
  const limits = Object.freeze({
    activeCapture: boundedPhysicalDeadline(
      env,
      'ULG_PHYSICAL_PIXEL_ACTIVE_CAPTURE_TIMEOUT_MS',
      PHYSICAL_PIXEL_LIVENESS_LIMITS_MS.activeCapture,
      PHYSICAL_PIXEL_LIVENESS_LIMITS_MS.activeCapture
    ),
    cleanup: boundedPhysicalDeadline(
      env,
      'ULG_PHYSICAL_PIXEL_CLEANUP_TIMEOUT_MS',
      PHYSICAL_PIXEL_LIVENESS_LIMITS_MS.cleanup,
      PHYSICAL_PIXEL_LIVENESS_LIMITS_MS.cleanup
    ),
    absolute: boundedPhysicalDeadline(
      env,
      'ULG_PHYSICAL_PIXEL_ABSOLUTE_TIMEOUT_MS',
      PHYSICAL_PIXEL_LIVENESS_LIMITS_MS.absolute,
      PHYSICAL_PIXEL_LIVENESS_LIMITS_MS.absolute
    )
  });
  if (
    limits.activeCapture + limits.cleanup > limits.absolute
    || limits.absolute >= 600_000
  ) {
    throw new RangeError(
      'physical Pixel deadlines must reserve cleanup below ten minutes'
    );
  }
  return limits;
}

export function physicalPixelDeadlineRemainingMs(deadlineAtMs, {
  ceilingMs,
  label = 'physical Pixel operation',
  nowMs = Date.now()
} = {}) {
  const remainingMs = Math.floor(Number(deadlineAtMs) - Number(nowMs));
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    throw new Error(`${label} exceeded the cumulative physical Pixel deadline`);
  }
  const ceiling = Number.isFinite(Number(ceilingMs))
    ? Math.floor(Number(ceilingMs))
    : remainingMs;
  return Math.max(1, Math.min(remainingMs, ceiling));
}
const SOURCE_MODULE_PATHS = Object.freeze([
  'src/main.js',
  'src/visualization/sphPhaseDemoMount.js',
  'src/visualization/sphPhaseScene.js',
  'src/runtime/sph/sphMlsMpmGpuStep.js',
  'src/runtime/sph/sphGridGpuKernel.js',
  'src/runtime/sph/sphGridUpdateGpuKernel.js',
  'src/runtime/sph/sphG2pGpuKernel.js',
  'src/runtime/sph/schroederSpatialMechanicsFieldPairGpu.js',
  'src/runtime/sph/schroederSpatialEpochTransaction.js',
  'src/runtime/sphPhaseScenarioPresets.js'
]);
const SOURCE_LOCAL_RESOURCE_EXTENSIONS = Object.freeze([
  '', '.js', '.mjs', '.cjs', '.json', '.css', '.wgsl'
]);
const CDP_ALLOWED_METHODS = Object.freeze({
  browser: Object.freeze(new Set([
    'Target.getTargets',
    'Target.createTarget',
    'Target.getTargetInfo',
    'Target.activateTarget',
    'Target.closeTarget'
  ])),
  page: Object.freeze(new Set([
    'Page.enable',
    'Page.getLayoutMetrics',
    'Page.navigate',
    'Page.captureScreenshot',
    'Runtime.enable',
    'Runtime.evaluate',
    'Log.enable'
  ]))
});
const REQUIRED_RAW_ARTIFACT_IDS = Object.freeze([
  'adb-devices',
  'adb-get-state',
  'adb-getprop',
  'chrome-package',
  'chrome-process',
  'adb-forward',
  'cdp-version',
  'target-lifecycle',
  'page-device',
  'served-source',
  'page-console',
  'sodium-water-sample',
  'triple-water-sample'
]);

function metadataOnly(value) {
  return value == null ? null : Object.freeze({
    path: value.path,
    byteLength: value.byteLength,
    sha256: value.sha256
  });
}

function sameFileIdentity(left, right) {
  return Boolean(
    left
    && right
    && left.dev === right.dev
    && left.ino === right.ino
    && left.isFile() === right.isFile()
    && left.isDirectory() === right.isDirectory()
  );
}

function publicationIdentity(stat) {
  return Object.freeze({ dev: stat.dev, ino: stat.ino });
}

function publicationIdentityMatches(metadata, stat) {
  const expected = metadata?.publicationIdentity;
  return Boolean(
    expected
    && Number.isSafeInteger(expected.dev)
    && expected.dev >= 0
    && Number.isSafeInteger(expected.ino)
    && expected.ino >= 0
    && expected.dev === stat.dev
    && expected.ino === stat.ino
  );
}

function privateOwnedMode(stat, expectedMode) {
  const uid = typeof process.getuid === 'function' ? process.getuid() : null;
  return Boolean(
    stat
    && Number.isSafeInteger(uid)
    && stat.uid === uid
    && (stat.mode & 0o777) === expectedMode
  );
}

function assertPrivateOwnedDirectory(stat, label) {
  if (!stat?.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(`${label} must be a real directory`);
  }
  if (!privateOwnedMode(stat, 0o700)) {
    throw new Error(`${label} must be owned by the current user with mode 0700`);
  }
}

function assertPrivateOwnedRegularFile(stat, label) {
  if (!stat?.isFile() || stat.isSymbolicLink()) {
    throw new Error(`${label} must be a regular non-symlink file`);
  }
  if (!privateOwnedMode(stat, 0o600)) {
    throw new Error(`${label} must be owned by the current user with mode 0600`);
  }
}

async function preparePrivateArtifactDirectory({ artifactDir, repoDir, label }) {
  const guarded = await assertArtifactPathOutsideRepo({
    artifactPath: artifactDir,
    repoDir,
    label
  });
  await mkdir(guarded.artifactPath, { recursive: true, mode: 0o700 });
  return inspectPrivateArtifactDirectory({
    artifactDir: guarded.artifactPath,
    repoDir,
    label
  });
}

async function inspectPrivateArtifactDirectory({ artifactDir, repoDir, label }) {
  const guarded = await assertArtifactPathOutsideRepo({
    artifactPath: artifactDir,
    repoDir,
    label
  });
  const stat = await lstat(guarded.artifactPath);
  assertPrivateOwnedDirectory(stat, label);
  return Object.freeze({ path: guarded.artifactPath, stat });
}

async function assertPrivateArtifactDirectoryIdentity(directory, { repoDir, label }) {
  await assertArtifactPathOutsideRepo({
    artifactPath: directory.path,
    repoDir,
    label
  });
  const observed = await lstat(directory.path);
  assertPrivateOwnedDirectory(observed, label);
  if (!sameFileIdentity(directory.stat, observed)) {
    throw new Error(`${label} changed during artifact operation`);
  }
  return observed;
}

async function assertPrivateArtifactTargetAbsent({ artifactPath, label }) {
  try {
    const existing = await lstat(artifactPath);
    assertPrivateOwnedRegularFile(existing, label);
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }
  throw new Error(`${label} must not replace a preexisting artifact`);
}

async function syncPrivateArtifactDirectory(directory, { repoDir, label }) {
  await assertPrivateArtifactDirectoryIdentity(directory, { repoDir, label });
  const handle = await open(
    directory.path,
    fsConstants.O_RDONLY | fsConstants.O_DIRECTORY | fsConstants.O_NOFOLLOW
  );
  try {
    const opened = await handle.stat();
    assertPrivateOwnedDirectory(opened, label);
    if (!sameFileIdentity(directory.stat, opened)) {
      throw new Error(`${label} changed before its directory could be synced`);
    }
    await handle.sync();
    const afterSync = await handle.stat();
    if (!sameFileIdentity(opened, afterSync)) {
      throw new Error(`${label} changed while its directory was synced`);
    }
  } finally {
    await handle.close();
  }
  await assertPrivateArtifactDirectoryIdentity(directory, { repoDir, label });
}

async function privateArtifactPublicationStep({ fixture, repoDir, step, artifactPath, label }) {
  if (fixture == null) return;
  if (!fixture || typeof fixture !== 'object' || typeof fixture.afterStep !== 'function') {
    throw new TypeError(`${label} publication fixture requires an afterStep function`);
  }
  await assertNonProductionFixtureCapability({
    capability: fixture.capability,
    repoDir,
    productionRepoDir: fixture.productionRepoDir,
    label: `${label} publication fixture`
  });
  await fixture.afterStep(Object.freeze({ step, artifactPath }));
}

async function privateArtifactReadStep({ fixture, repoDir, step, artifactPath, label }) {
  if (fixture == null) return;
  if (!fixture || typeof fixture !== 'object' || typeof fixture.afterStep !== 'function') {
    throw new TypeError(`${label} reread fixture requires an afterStep function`);
  }
  await assertNonProductionFixtureCapability({
    capability: fixture.capability,
    repoDir,
    productionRepoDir: fixture.productionRepoDir,
    label: `${label} reread fixture`
  });
  await fixture.afterStep(Object.freeze({ step, artifactPath }));
}

async function publishPrivateArtifact({
  directory,
  filename,
  bytes,
  repoDir,
  label,
  fixture = null
}) {
  await assertPrivateArtifactDirectoryIdentity(directory, { repoDir, label });
  const artifactPath = path.join(directory.path, filename);
  const guarded = await assertArtifactPathOutsideRepo({
    artifactPath,
    repoDir,
    label
  });
  await assertPrivateArtifactTargetAbsent({ artifactPath: guarded.artifactPath, label });
  const temporaryPath = path.join(
    directory.path,
    `.${filename}.${process.pid}.${randomUUID()}.tmp`
  );
  const temporary = await open(
    temporaryPath,
    fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_NOFOLLOW,
    0o600
  );
  let temporaryIdentity;
  try {
    await temporary.writeFile(bytes);
    const written = await temporary.stat();
    assertPrivateOwnedRegularFile(written, `${label} temporary artifact`);
    await temporary.sync();
    const afterSync = await temporary.stat();
    if (!sameFileIdentity(written, afterSync)) {
      throw new Error(`${label} temporary artifact changed while its bytes were synced`);
    }
    temporaryIdentity = afterSync;
  } finally {
    await temporary.close();
  }
  const afterClose = await lstat(temporaryPath);
  assertPrivateOwnedRegularFile(afterClose, `${label} temporary artifact`);
  if (!sameFileIdentity(temporaryIdentity, afterClose)) {
    throw new Error(`${label} temporary artifact changed before publication`);
  }
  await privateArtifactPublicationStep({
    fixture,
    repoDir,
    step: 'after-file-sync',
    artifactPath: guarded.artifactPath,
    label
  });
  await assertPrivateArtifactDirectoryIdentity(directory, { repoDir, label });
  await assertPrivateArtifactTargetAbsent({ artifactPath: guarded.artifactPath, label });
  // link() is atomic no-clobber publication within this private directory.
  await link(temporaryPath, guarded.artifactPath);
  const published = await lstat(guarded.artifactPath);
  assertPrivateOwnedRegularFile(published, label);
  if (!sameFileIdentity(temporaryIdentity, published)) {
    throw new Error(`${label} changed during no-clobber publication`);
  }
  await privateArtifactPublicationStep({
    fixture,
    repoDir,
    step: 'after-publication',
    artifactPath: guarded.artifactPath,
    label
  });
  await privateArtifactPublicationStep({
    fixture,
    repoDir,
    step: 'before-parent-sync',
    artifactPath: guarded.artifactPath,
    label
  });
  await syncPrivateArtifactDirectory(directory, { repoDir, label });
  await privateArtifactPublicationStep({
    fixture,
    repoDir,
    step: 'after-parent-sync',
    artifactPath: guarded.artifactPath,
    label
  });
  const final = await lstat(guarded.artifactPath);
  assertPrivateOwnedRegularFile(final, label);
  if (!sameFileIdentity(temporaryIdentity, final)) {
    throw new Error(`${label} changed after parent sync`);
  }
  return Object.freeze({ path: guarded.artifactPath, identity: final });
}

async function writePrivateServedResourceArtifact({
  directory,
  filename,
  bytes,
  repoDir,
  label,
  fixture = null
}) {
  const published = await publishPrivateArtifact({
    directory,
    filename,
    bytes,
    repoDir,
    label,
    fixture
  });
  await assertPrivateArtifactDirectoryIdentity(directory, { repoDir, label });
  const reread = await readHashedArtifact({
    artifactPath: published.path,
    repoDir,
    label,
    includeBytes: true
  });
  const afterRead = await lstat(published.path);
  assertPrivateOwnedRegularFile(afterRead, label);
  if (!sameFileIdentity(published.identity, afterRead)) {
    throw new Error(`${label} changed during write and reread`);
  }
  await assertPrivateArtifactDirectoryIdentity(directory, { repoDir, label });
  if (reread.byteLength !== bytes.byteLength || reread.sha256 !== sha256Bytes(bytes)) {
    throw new Error(`${label} changed during write and reread`);
  }
  return Object.freeze(metadataOnly(reread));
}

function exactObject(value, expected) {
  return canonicalJson(value) === canonicalJson(expected);
}

function positiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function safeNonnegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function finitePositive(value) {
  return Number.isFinite(value) && value > 0;
}

function emptyArray(value) {
  return Array.isArray(value) && value.length === 0;
}

function sourceManifestCore(modules, unresolvedBareSpecifiers = []) {
  return {
    schema: PHYSICAL_PIXEL_SOURCE_MANIFEST_SCHEMA,
    scope: LOCAL_RELATIVE_SOURCE_SCOPE,
    modules,
    unresolvedBareSpecifiers
  };
}

function sourcePathIsSafe(modulePath) {
  return typeof modulePath === 'string'
    && modulePath.length > 0
    && !modulePath.startsWith('/')
    && !modulePath.split('/').includes('..')
    && modulePath === modulePath.replaceAll('\\', '/');
}

function literalSpecifier(node) {
  if ((node?.type === 'Literal' || node?.type === 'StringLiteral')
    && typeof node.value === 'string') {
    return node.value;
  }
  if (node?.type === 'TemplateLiteral' && node.expressions?.length === 0
    && node.quasis?.length === 1 && typeof node.quasis[0]?.value?.cooked === 'string') {
    return node.quasis[0].value.cooked;
  }
  return null;
}

function isIdentifier(node, name) {
  return node?.type === 'Identifier' && node.name === name;
}

function memberPropertyIs(node, name) {
  return node?.type === 'MemberExpression'
    && (isIdentifier(node.property, name)
      || (node.computed && literalSpecifier(node.property) === name));
}

function isImportMetaUrl(node) {
  return memberPropertyIs(node, 'url')
    && node.object?.type === 'MetaProperty'
    && isIdentifier(node.object.meta, 'import')
    && isIdentifier(node.object.property, 'meta');
}

function isServiceWorkerRegisterCall(node) {
  return node?.type === 'CallExpression'
    && memberPropertyIs(node.callee, 'register')
    && memberPropertyIs(node.callee.object, 'serviceWorker');
}

function uniqueResourceEdges(edges) {
  return Object.freeze([...new Map(edges.map((edge) => [
    `${edge.kind}\u0000${edge.specifier}`, Object.freeze(edge)
  ])).values()].sort((left, right) => (
    left.kind.localeCompare(right.kind) || left.specifier.localeCompare(right.specifier)
  )));
}

function javascriptStaticResourceEdges(source) {
  let ast;
  try {
    ast = parseAst(source, { sourceType: 'module' });
  } catch (error) {
    throw new Error(`physical Pixel source module is not valid JavaScript: ${error.message}`);
  }
  const edges = [];
  const visit = (node) => {
    if (node == null || typeof node !== 'object') return;
    const sourceSpecifier = literalSpecifier(node.source);
    if (
      (node.type === 'ImportDeclaration'
        || node.type === 'ExportAllDeclaration'
        || node.type === 'ExportNamedDeclaration')
      && sourceSpecifier != null
    ) {
      edges.push({ kind: 'static-import', specifier: sourceSpecifier });
    } else if (node.type === 'ImportExpression') {
      const specifier = literalSpecifier(node.source);
      if (specifier != null) edges.push({ kind: 'dynamic-import', specifier });
    } else if (node.type === 'NewExpression') {
      const specifier = literalSpecifier(node.arguments?.[0]);
      if (specifier != null && isIdentifier(node.callee, 'URL')
        && isImportMetaUrl(node.arguments?.[1])) {
        edges.push({ kind: 'url-resource', specifier });
      } else if (specifier != null
        && (isIdentifier(node.callee, 'Worker') || isIdentifier(node.callee, 'SharedWorker'))) {
        edges.push({ kind: 'url-resource', specifier });
      }
    } else if (isServiceWorkerRegisterCall(node)) {
      const specifier = literalSpecifier(node.arguments?.[0]);
      if (specifier != null) edges.push({ kind: 'service-worker', specifier });
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        for (const child of value) visit(child);
      } else {
        visit(value);
      }
    }
  };
  visit(ast);
  return uniqueResourceEdges(edges);
}

function skipCssTrivia(source, index) {
  let cursor = index;
  while (cursor < source.length) {
    if (/\s/u.test(source[cursor])) {
      cursor += 1;
    } else if (source.startsWith('/*', cursor)) {
      const end = source.indexOf('*/', cursor + 2);
      cursor = end < 0 ? source.length : end + 2;
    } else {
      break;
    }
  }
  return cursor;
}

function readCssString(source, index) {
  const quote = source[index];
  let cursor = index + 1;
  let value = '';
  while (cursor < source.length) {
    const character = source[cursor];
    if (character === quote) return { end: cursor + 1, value };
    if (character === '\\' && cursor + 1 < source.length) {
      value += source[cursor + 1];
      cursor += 2;
    } else {
      value += character;
      cursor += 1;
    }
  }
  return { end: cursor, value: null };
}

function readCssUrlFunction(source, index) {
  let cursor = skipCssTrivia(source, index);
  if (source[cursor] === '"' || source[cursor] === "'") {
    const string = readCssString(source, cursor);
    cursor = skipCssTrivia(source, string.end);
    return source[cursor] === ')'
      ? { end: cursor + 1, value: string.value }
      : { end: cursor, value: null };
  }
  const end = source.indexOf(')', cursor);
  if (end < 0) return { end: source.length, value: null };
  const value = source.slice(cursor, end).trim();
  return { end: end + 1, value: value === '' ? null : value };
}

function cssStaticResourceEdges(source) {
  const edges = [];
  let cursor = 0;
  while (cursor < source.length) {
    if (source.startsWith('/*', cursor)) {
      cursor = skipCssTrivia(source, cursor);
      continue;
    }
    if (source[cursor] === '"' || source[cursor] === "'") {
      cursor = readCssString(source, cursor).end;
      continue;
    }
    if (source[cursor] === '@' && source.slice(cursor + 1, cursor + 7).toLowerCase() === 'import'
      && !/[\w-]/u.test(source[cursor + 7] ?? '')) {
      let next = skipCssTrivia(source, cursor + 7);
      let parsed = null;
      if (source.slice(next, next + 3).toLowerCase() === 'url'
        && !/[\w-]/u.test(source[next + 3] ?? '')) {
        next = skipCssTrivia(source, next + 3);
        if (source[next] === '(') parsed = readCssUrlFunction(source, next + 1);
      } else if (source[next] === '"' || source[next] === "'") {
        parsed = readCssString(source, next);
      }
      if (parsed?.value != null) edges.push({ kind: 'css-import', specifier: parsed.value });
      cursor = parsed?.end ?? next;
      continue;
    }
    if (source.slice(cursor, cursor + 3).toLowerCase() === 'url'
      && !/[\w-]/u.test(source[cursor - 1] ?? '')
      && !/[\w-]/u.test(source[cursor + 3] ?? '')) {
      const next = skipCssTrivia(source, cursor + 3);
      if (source[next] === '(') {
        const parsed = readCssUrlFunction(source, next + 1);
        if (parsed.value != null) edges.push({ kind: 'css-url', specifier: parsed.value });
        cursor = parsed.end;
        continue;
      }
    }
    cursor += 1;
  }
  return uniqueResourceEdges(edges);
}

function staticSourceSpecifiers(source, modulePath) {
  const edges = modulePath.endsWith('.css')
    ? cssStaticResourceEdges(source).filter((edge) => edge.kind === 'css-import')
    : /\.(?:[cm]?js|jsx|tsx?)$/iu.test(modulePath)
      ? javascriptStaticResourceEdges(source)
      : [];
  return Object.freeze([...new Set(edges.map((edge) => edge.specifier))].sort());
}

function relativeStaticSpecifier(specifier) {
  return specifier.startsWith('./') || specifier.startsWith('../');
}

async function resolveLocalSourceDependency(repoDir, parentPath, specifier) {
  const withoutQuery = specifier.split(/[?#]/u, 1)[0];
  const candidateBase = path.posix.normalize(path.posix.join(
    path.posix.dirname(parentPath),
    withoutQuery
  ));
  if (!sourcePathIsSafe(candidateBase)) {
    throw new Error(`physical Pixel source dependency escapes the repository: ${specifier}`);
  }
  for (const extension of SOURCE_LOCAL_RESOURCE_EXTENSIONS) {
    const candidate = `${candidateBase}${extension}`;
    const absolutePath = path.join(repoDir, candidate);
    try {
      const stat = await lstat(absolutePath);
      if (stat.isFile() && !stat.isSymbolicLink()) return candidate;
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  throw new Error(
    `physical Pixel source dependency is not a regular repository file: ${parentPath} -> ${specifier}`
  );
}

async function buildPhysicalPixelLocalRelativeSourceSet(repoDir) {
  const pending = [...SOURCE_MODULE_PATHS];
  const visited = new Set();
  const modules = [];
  const unresolvedBareSpecifiers = [];
  while (pending.length > 0) {
    const modulePath = pending.shift();
    if (visited.has(modulePath)) continue;
    if (!sourcePathIsSafe(modulePath)) {
      throw new Error(`physical Pixel source module path is unsafe: ${modulePath}`);
    }
    const absolutePath = path.join(repoDir, modulePath);
    const stat = await lstat(absolutePath);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error(`physical Pixel source module is not a regular file: ${modulePath}`);
    }
    const bytes = await readFile(absolutePath);
    visited.add(modulePath);
    modules.push(Object.freeze({
      path: modulePath,
      byteLength: bytes.byteLength,
      sha256: sha256Bytes(bytes)
    }));
    const source = bytes.toString('utf8');
    for (const specifier of staticSourceSpecifiers(source, modulePath)) {
      if (relativeStaticSpecifier(specifier)) {
        pending.push(await resolveLocalSourceDependency(repoDir, modulePath, specifier));
      } else {
        unresolvedBareSpecifiers.push(Object.freeze({
          importerPath: modulePath,
          specifier
        }));
      }
    }
  }
  return Object.freeze({
    modules: Object.freeze(modules.sort((left, right) => left.path.localeCompare(right.path))),
    unresolvedBareSpecifiers: Object.freeze(
      [...new Map(unresolvedBareSpecifiers.map((row) => [
        `${row.importerPath}\u0000${row.specifier}`, row
      ])).values()].sort((left, right) => (
        left.importerPath.localeCompare(right.importerPath)
        || left.specifier.localeCompare(right.specifier)
      ))
    )
  });
}

function normalizeBaseUrl(value) {
  const url = new URL(value);
  if (
    url.protocol !== 'https:'
    || url.username !== ''
    || url.password !== ''
    || url.search !== ''
    || url.hash !== ''
    || url.pathname !== '/'
  ) {
    throw new Error('physical Pixel baseUrl must be a credential-free HTTPS origin');
  }
  return url.href;
}

function physicalScenarioPolicy(baseUrl) {
  return Object.freeze([
    Object.freeze({
      id: 'sodium-water',
      url: new URL(
        '/?scenario=sodium-water&residentAuto=1&ss=1'
          + '&renderer=native-webgpu&surfaceDraw=native-webgpu-surface-consumer'
          + '&renderOwnership=main-thread-renderer',
        baseUrl
      ).href,
      interaction: 'observe-auto-animation'
    }),
    Object.freeze({
      id: 'triple-water',
      url: new URL(
        '/?scenario=water-cycle&residentAuto=1&ss=1'
          + '&renderer=native-webgpu&surfaceDraw=native-webgpu-surface-consumer'
          + '&renderOwnership=main-thread-renderer',
        baseUrl
      ).href,
      interaction: 'click-add-stacked-water-body-once-then-observe-auto-animation'
    })
  ]);
}

export function createPhysicalPixelMobilePolicy({ baseUrl }) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const core = {
    schema: PHYSICAL_PIXEL_COMMAND_POLICY_SCHEMA,
    policyId: PHYSICAL_PIXEL_POLICY_ID,
    policyTrack: SS_CONTAINED_POLICY_TRACK,
    baseUrl: normalizedBaseUrl,
    requiredTransport: 'physical-adb-cdp-usb-or-authenticated-wireless',
    requiredDevice: Object.freeze({
      manufacturer: 'Google',
      brand: 'google',
      model: 'Pixel 9 Pro',
      adbModel: 'Pixel_9_Pro',
      product: 'caiman',
      device: 'caiman',
      // Pixel 9 Pro production Android identifies its Tensor platform as "tensor".
      hardware: 'tensor'
    }),
    chromePackage: 'com.android.chrome',
    ownedTargetActivation: 'activate-only-owned-target-restore-by-close',
    wallClockLimitsMs: PHYSICAL_PIXEL_LIVENESS_LIMITS_MS,
    sourceModulePaths: SOURCE_MODULE_PATHS,
    requiredRawArtifactIds: REQUIRED_RAW_ARTIFACT_IDS,
    compositorEvidence: Object.freeze({
      captureMethod: 'Page.captureScreenshot',
      layoutMetricsMethod: 'Page.getLayoutMetrics',
      captureSource: 'physical-chrome-compositor-surface',
      targetScope: 'owned-receipt-target-native-canvas-center',
      fromSurface: true,
      captureBeyondViewport: false,
      scale: 1,
      requiredVisualViewportScale: 1,
      requiredPageZoom: 1,
      outputPixelSizing: 'clip-dip-times-page-scale',
      maxCssWidth: COMPOSITOR_CAPTURE_MAX_CSS_WIDTH,
      maxCssHeight: COMPOSITOR_CAPTURE_MAX_CSS_HEIGHT,
      framePairsPerScenario: SAMPLE_WINDOW_COUNT,
      minChannelDelta: COMPOSITOR_CAPTURE_MIN_CHANNEL_DELTA,
      minChangedPixelCount: COMPOSITOR_CAPTURE_MIN_CHANGED_PIXEL_COUNT,
      minChangedPixelRatio: COMPOSITOR_CAPTURE_MIN_CHANGED_PIXEL_RATIO,
      minChangedBoundsWidth: COMPOSITOR_CAPTURE_MIN_CHANGED_BOUNDS_WIDTH,
      minChangedBoundsHeight: COMPOSITOR_CAPTURE_MIN_CHANGED_BOUNDS_HEIGHT,
      requireVisibleSurfaceContent: true,
      requireVisibleContentAdvance: true
    }),
    scenarios: physicalScenarioPolicy(normalizedBaseUrl)
  };
  return Object.freeze({
    ...core,
    commandPolicySha256: canonicalJsonSha256(core)
  });
}

function policyValid(policy) {
  if (!policy || typeof policy !== 'object') return false;
  try {
    return canonicalJson(policy) === canonicalJson(
      createPhysicalPixelMobilePolicy({ baseUrl: policy.baseUrl })
    );
  } catch {
    return false;
  }
}

export async function buildPhysicalPixelLocalSourceManifest({
  repoDir = sourceRepoDir
} = {}) {
  const resolvedRepoDir = path.resolve(repoDir);
  const { modules, unresolvedBareSpecifiers } =
    await buildPhysicalPixelLocalRelativeSourceSet(resolvedRepoDir);
  const core = sourceManifestCore(modules, unresolvedBareSpecifiers);
  return Object.freeze({
    ...core,
    manifestSha256: canonicalJsonSha256(core)
  });
}

function viteStaticResourceEdges(bytes, resourceUrl, contentType = '') {
  const source = Buffer.from(bytes).toString('utf8');
  const isCss = /(?:^|\/)css(?:;|$)/iu.test(contentType)
    || new URL(resourceUrl).pathname.endsWith('.css');
  const mediaType = String(contentType).split(';', 1)[0].trim().toLowerCase();
  const isJavaScriptMime = new Set([
    'application/ecmascript',
    'application/javascript',
    'application/x-ecmascript',
    'application/x-javascript',
    'text/ecmascript',
    'text/javascript',
    'text/javascript1.0',
    'text/javascript1.1',
    'text/javascript1.2',
    'text/javascript1.3',
    'text/javascript1.4',
    'text/javascript1.5',
    'text/jscript',
    'text/livescript',
    'text/x-ecmascript',
    'text/x-javascript'
  ]).has(mediaType);
  const isJavaScript = isJavaScriptMime
    || /\.(?:[cm]?js|jsx|tsx?)$/iu.test(new URL(resourceUrl).pathname);
  const edges = isCss
    ? cssStaticResourceEdges(source)
    : isJavaScript
      ? javascriptStaticResourceEdges(source)
      : [];
  return Object.freeze(edges.filter((edge) => !edge.specifier.startsWith('#')));
}

function normalizedSameOriginViteUrl(value, baseUrl) {
  const base = new URL(baseUrl);
  const url = new URL(value, base);
  if (
    url.origin !== base.origin
    || url.username !== ''
    || url.password !== ''
    || (url.protocol !== 'https:' && url.protocol !== 'http:')
  ) {
    throw new Error(`physical Pixel Vite resource is not same-origin: ${value}`);
  }
  url.hash = '';
  return url;
}

function safeDecodedPathname(url) {
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    throw new Error(`physical Pixel Vite resource has invalid escaping: ${url.pathname}`);
  }
  if (!pathname.startsWith('/') || pathname.includes('\\') || pathname.includes('\u0000')) {
    throw new Error(`physical Pixel Vite resource has unsafe pathname: ${url.pathname}`);
  }
  return pathname;
}

function pathInside(candidate, root) {
  const relative = path.relative(root, candidate);
  return relative === '' || (
    !relative.startsWith(`..${path.sep}`)
    && relative !== '..'
    && !path.isAbsolute(relative)
  );
}

async function localViteResourcePath(resourceUrl, repoDir) {
  const url = new URL(resourceUrl);
  const pathname = safeDecodedPathname(url);
  const candidate = pathname.startsWith('/@fs/')
    ? path.resolve('/', pathname.slice('/@fs/'.length))
    : path.resolve(repoDir, `.${pathname}`);
  const allowedRoots = pathname.startsWith('/@fs/')
    ? ALLOWLISTED_VITE_FS_ROOTS
    : [repoDir];
  if (!allowedRoots.some((root) => pathInside(candidate, root))) {
    throw new Error(`physical Pixel Vite resource escapes its allowlisted filesystem root: ${url.pathname}`);
  }
  try {
    const stat = await lstat(candidate);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error(`physical Pixel Vite resource is not a regular local file: ${candidate}`);
    }
    const canonical = await realpath(candidate);
    if (!allowedRoots.some((root) => pathInside(canonical, root))) {
      throw new Error(`physical Pixel Vite resource resolves outside its allowlisted filesystem root: ${url.pathname}`);
    }
    return canonical;
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

function transformedResourceComparison(resourceUrl, contentType, edgeKinds) {
  const pathname = new URL(resourceUrl).pathname;
  if (pathname.startsWith('/node_modules/.vite/deps/')) {
    return 'vite-optimized-resource';
  }
  const sourceModule = /\.(?:[cm]?js|jsx|tsx?|css)$/iu.test(pathname)
    && (pathname.startsWith('/src/') || pathname.startsWith('/ulg-gpu-abi/')
      || pathname.startsWith('/@fs/'));
  return sourceModule || edgeKinds.some((kind) => (
    kind === 'static-import' || kind === 'dynamic-import' || kind === 'css-import'
  ))
    ? 'transformed-source'
    : 'served-resource';
}

function viteOptimizedImportSpecifierNodes(source) {
  let ast;
  try {
    ast = parseAst(source, { sourceType: 'module' });
  } catch (error) {
    throw new Error(`physical Pixel optimized Vite module is not valid JavaScript: ${error.message}`);
  }
  const specifierNodes = [];
  const visit = (node) => {
    if (node == null || typeof node !== 'object') return;
    const declarationSource = (
      node.type === 'ImportDeclaration'
      || node.type === 'ExportAllDeclaration'
      || node.type === 'ExportNamedDeclaration'
    ) ? node.source : null;
    if (literalSpecifier(declarationSource) != null) {
      specifierNodes.push(declarationSource);
    } else if (node.type === 'ImportExpression' && literalSpecifier(node.source) != null) {
      specifierNodes.push(node.source);
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        for (const child of value) visit(child);
      } else {
        visit(value);
      }
    }
  };
  visit(ast);
  return specifierNodes.sort((left, right) => left.start - right.start);
}

function canonicalViteImportSpecifier(specifier, resourceUrl) {
  if (!specifier.startsWith('.') && !specifier.startsWith('/')
    && !/^https?:\/\//iu.test(specifier)) {
    return specifier;
  }
  const importer = new URL(resourceUrl);
  const resolved = new URL(specifier, importer);
  return resolved.origin === importer.origin ? resolved.pathname : specifier;
}

function canonicalViteOptimizedBytes(bytes, resourceUrl) {
  const pathname = new URL(resourceUrl).pathname;
  const basename = path.posix.basename(pathname);
  const suffix = `\n//# sourceMappingURL=${basename}.map`;
  const input = Buffer.from(bytes);
  const text = input.toString('utf8');
  if (!Buffer.from(text, 'utf8').equals(input)) {
    throw new Error(`physical Pixel optimized Vite module is not valid UTF-8: ${pathname}`);
  }
  // Vite may append only this terminal devtools mapping directive while serving
  // an optimized cache module. It changes browser bytes but not module content.
  const source = text.endsWith(suffix) ? text.slice(0, -suffix.length) : text;
  const replacements = viteOptimizedImportSpecifierNodes(source).map((node) => ({
    start: node.start,
    end: node.end,
    value: JSON.stringify(canonicalViteImportSpecifier(literalSpecifier(node), resourceUrl))
  }));
  let canonical = source;
  for (const replacement of replacements.reverse()) {
    canonical = `${canonical.slice(0, replacement.start)}${replacement.value}${canonical.slice(replacement.end)}`;
  }
  return Buffer.from(canonical, 'utf8');
}

/**
 * Enumerate only static literal edges exposed by Vite's same-origin transformed
 * endpoints. Runtime-computed URLs, HTML-discovered resources, network traffic,
 * and the rest of the worktree are intentionally outside this receipt scope.
 */
export async function buildPhysicalPixelViteResourceClosure({
  baseUrl,
  sourceManifest,
  fetchResource,
  repoDir = sourceRepoDir,
  resourceArtifactDir = null,
  artifactPublicationFixture = null
}) {
  if (typeof fetchResource !== 'function') {
    throw new TypeError('physical Pixel Vite closure requires a fetchResource function');
  }
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const resolvedRepoDir = path.resolve(repoDir);
  const resourceArtifactDirectory = resourceArtifactDir == null
    ? null
    : await preparePrivateArtifactDirectory({
      artifactDir: resourceArtifactDir,
      repoDir: resolvedRepoDir,
      label: 'physical Pixel served-resource artifact directory'
    });
  const roots = sourceManifest?.modules
    ?.filter((row) => SOURCE_MODULE_PATHS.includes(row.path))
    .map((row) => normalizedSameOriginViteUrl(`/${row.path}`, normalizedBaseUrl).href);
  if (!Array.isArray(roots) || roots.length !== SOURCE_MODULE_PATHS.length) {
    throw new Error('physical Pixel Vite closure has an incomplete direct source root set');
  }
  const pending = roots.map((url) => ({ url, edgeKinds: ['root'] }));
  const seen = new Map();
  const resourceEdges = [];
  const resourceArtifactPaths = new Set();
  while (pending.length > 0) {
    const pendingResource = pending.shift();
    const requestedUrl = normalizedSameOriginViteUrl(pendingResource.url, normalizedBaseUrl);
    const requestedKey = requestedUrl.href;
    const previous = seen.get(requestedKey);
    if (previous) {
      previous.edgeKinds = [...new Set([...previous.edgeKinds, ...pendingResource.edgeKinds])].sort();
      continue;
    }
    const fetched = await fetchResource(requestedKey);
    const finalUrl = normalizedSameOriginViteUrl(fetched?.url ?? requestedKey, normalizedBaseUrl);
    if (finalUrl.href !== requestedKey) {
      throw new Error(`physical Pixel Vite resource redirected or aliased unexpectedly: ${requestedKey}`);
    }
    if (!Buffer.isBuffer(fetched?.bytes) && !(fetched?.bytes instanceof Uint8Array)) {
      throw new Error(`physical Pixel Vite resource did not return bytes: ${requestedKey}`);
    }
    const bytes = Buffer.from(fetched.bytes);
    const edgeKinds = [...new Set(pendingResource.edgeKinds)].sort();
    const localPath = await localViteResourcePath(finalUrl.href, resolvedRepoDir);
    const comparison = transformedResourceComparison(finalUrl.href, fetched.contentType, edgeKinds);
    const localBytes = localPath == null ? null : await readFile(localPath);
    const browserComparable = comparison === 'vite-optimized-resource'
      ? canonicalViteOptimizedBytes(bytes, finalUrl.href)
      : bytes;
    const localComparable = comparison === 'vite-optimized-resource'
      ? canonicalViteOptimizedBytes(localBytes ?? Buffer.alloc(0), finalUrl.href)
      : localBytes;
    const local = localPath == null ? null : Object.freeze({
      path: localPath,
      byteLength: localBytes.byteLength,
      sha256: sha256Bytes(localBytes),
      browserBytesEqual: sha256Bytes(localBytes) === sha256Bytes(bytes),
      canonicalSha256: sha256Bytes(localComparable),
      browserCanonicalSha256: sha256Bytes(browserComparable),
      canonicalBytesEqual: sha256Bytes(localComparable) === sha256Bytes(browserComparable)
    });
    if (comparison !== 'transformed-source' && local != null && !local.canonicalBytesEqual) {
      throw new Error(`physical Pixel Vite served resource bytes differ from local file: ${finalUrl.pathname}`);
    }
    const edges = viteStaticResourceEdges(bytes, finalUrl.href, fetched.contentType ?? '');
    const row = {
      url: finalUrl.href,
      byteLength: bytes.byteLength,
      browserSha256: sha256Bytes(bytes),
      contentType: typeof fetched.contentType === 'string' ? fetched.contentType : '',
      edgeKinds,
      comparison,
      local,
      edges: []
    };
    if (resourceArtifactDirectory != null) {
      const artifactPath = path.join(
        resourceArtifactDirectory.path,
        `${sha256Bytes(finalUrl.href)}.bin`
      );
      if (resourceArtifactPaths.has(artifactPath)) {
        throw new Error(`physical Pixel Vite resource artifact path collision: ${finalUrl.href}`);
      }
      if (resourceArtifactPaths.size > 0) {
        await assertArtifactPathsPairwiseDistinct({
          paths: [
            ...[...resourceArtifactPaths].map((candidate, index) => ({
              path: candidate,
              label: `physical Pixel served resource artifact ${index}`
            })),
            {
              path: artifactPath,
              label: `physical Pixel served resource ${finalUrl.href}`
            }
          ],
          repoDir: resolvedRepoDir,
          label: 'physical Pixel served-resource artifacts'
        });
      }
      resourceArtifactPaths.add(artifactPath);
      row.artifact = await writePrivateServedResourceArtifact({
        directory: resourceArtifactDirectory,
        filename: path.basename(artifactPath),
        bytes,
        repoDir: resolvedRepoDir,
        label: `physical Pixel served resource ${finalUrl.href}`,
        fixture: artifactPublicationFixture
      });
    }
    seen.set(requestedKey, row);
    for (const edge of edges) {
      const child = normalizedSameOriginViteUrl(edge.specifier, finalUrl.href);
      row.edges.push(Object.freeze({ kind: edge.kind, to: child.href }));
      resourceEdges.push(Object.freeze({ from: finalUrl.href, kind: edge.kind, to: child.href }));
      pending.push({ url: child.href, edgeKinds: [edge.kind] });
    }
    row.edges.sort((left, right) => (
      left.kind.localeCompare(right.kind) || left.to.localeCompare(right.to)
    ));
  }
  const resources = [...seen.values()].sort((left, right) => left.url.localeCompare(right.url));
  return Object.freeze({
    scope: VITE_TRANSFORMED_RESOURCE_SCOPE,
    roots: Object.freeze([...roots].sort()),
    resources: Object.freeze(resources),
    edges: Object.freeze(resourceEdges.sort((left, right) => (
      left.from.localeCompare(right.from) || left.kind.localeCompare(right.kind)
        || left.to.localeCompare(right.to)
    )))
  });
}

function commandRecord({ id, runId, executable, args, result }) {
  return Object.freeze({
    schema: RAW_COMMAND_SCHEMA,
    id,
    captureProviderId: BUILTIN_CAPTURE_PROVIDER_ID,
    runId,
    executable,
    args: Object.freeze([...args]),
    exitCode: result.exitCode,
    signal: result.signal,
    spawnError: result.spawnError,
    stdout: result.stdout,
    stderr: result.stderr
  });
}

function jsonRecord({ id, runId, value }) {
  return Object.freeze({
    schema: RAW_JSON_SCHEMA,
    id,
    captureProviderId: BUILTIN_CAPTURE_PROVIDER_ID,
    runId,
    value
  });
}

async function runBoundedProcess(executable, args, {
  cwd = sourceRepoDir,
  timeoutMs = 30_000,
  deadlineAtMs = null,
  termGraceMs = 2_000,
  killGraceMs = 3_000,
  maxBytes = 8 * 1024 * 1024
} = {}) {
  let effectiveTimeoutMs = timeoutMs;
  if (deadlineAtMs != null) {
    effectiveTimeoutMs = physicalPixelDeadlineRemainingMs(deadlineAtMs, {
      ceilingMs: timeoutMs,
      label: `${executable} ${args[0] ?? ''}`.trim()
    });
  }
  return new Promise((resolve) => {
    const child = spawn(executable, args, {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = Buffer.alloc(0);
    let stderr = Buffer.alloc(0);
    let spawnError = null;
    let timedOut = false;
    let settled = false;
    let killTimer = null;
    let forceSettleTimer = null;
    const append = (current, chunk) => {
      const combined = Buffer.concat([current, Buffer.from(chunk)]);
      return combined.byteLength <= maxBytes
        ? combined
        : combined.subarray(combined.byteLength - maxBytes);
    };
    child.stdout?.on('data', (chunk) => { stdout = append(stdout, chunk); });
    child.stderr?.on('data', (chunk) => { stderr = append(stderr, chunk); });
    child.once('error', (error) => {
      spawnError = error instanceof Error ? error.message : String(error);
    });
    const settle = (exitCode, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (killTimer != null) clearTimeout(killTimer);
      if (forceSettleTimer != null) clearTimeout(forceSettleTimer);
      resolve(Object.freeze({
        exitCode,
        signal,
        spawnError: timedOut
          ? `process timed out after ${effectiveTimeoutMs} ms`
          : spawnError,
        stdout: stdout.toString('utf8'),
        stderr: stderr.toString('utf8')
      }));
    };
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      killTimer = setTimeout(() => {
        if (settled) return;
        child.kill('SIGKILL');
        forceSettleTimer = setTimeout(() => settle(null, 'SIGKILL'), killGraceMs);
      }, termGraceMs);
    }, effectiveTimeoutMs);
    child.once('close', settle);
  });
}

function requireSuccessfulCommand(result, label) {
  if (
    result?.exitCode !== 0
    || result?.signal != null
    || result?.spawnError != null
  ) {
    throw new Error(
      `${label} failed: ${result?.spawnError || result?.stderr || `exit ${result?.exitCode}`}`
    );
  }
  return result;
}

function parseAdbDevices(text) {
  const rows = String(text).split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/^List of devices attached/u.test(line))
    .map((line) => {
      const fields = line.split(/\s+/u);
      const serial = fields.shift() ?? '';
      const state = fields.shift() ?? '';
      const attributes = Object.fromEntries(fields.map((field) => {
        const separator = field.indexOf(':');
        return separator < 0
          ? [field, '']
          : [field.slice(0, separator), field.slice(separator + 1)];
      }));
      const transport = attributes.usb
        ? 'usb'
        : (serial.includes(':') ? 'wireless-adb' : 'unknown');
      return Object.freeze({
        serial,
        state,
        transport,
        product: attributes.product ?? null,
        model: attributes.model ?? null,
        device: attributes.device ?? null,
        usb: attributes.usb ?? null,
        transportId: attributes.transport_id ?? null
      });
    });
  return Object.freeze(rows);
}

function parseAdbForwardList(text) {
  return String(text).split(/\r?\n/u).flatMap((line) => {
    const fields = line.trim().split(/\s+/u);
    return fields.length === 3
      ? [Object.freeze({ serial: fields[0], local: fields[1], remote: fields[2] })]
      : [];
  });
}

function forwardOwnershipMatches(text, { serial, localPort, remote }) {
  if (!positiveInteger(localPort) || typeof serial !== 'string' || typeof remote !== 'string') {
    return false;
  }
  const local = `tcp:${localPort}`;
  const rows = parseAdbForwardList(text).filter((row) => row.local === local);
  return rows.length === 1
    && rows[0].serial === serial
    && rows[0].remote === remote;
}

function parseGetprop(text) {
  const raw = {};
  for (const line of String(text).split(/\r?\n/u)) {
    const match = line.match(/^\[([^\]]+)\]:\s*\[(.*)\]$/u);
    if (match) raw[match[1]] = match[2];
  }
  return Object.freeze({
    roProductManufacturer: raw['ro.product.manufacturer'] ?? null,
    roProductBrand: raw['ro.product.brand'] ?? null,
    roProductModel: raw['ro.product.model'] ?? null,
    roProductDevice: raw['ro.product.device'] ?? null,
    roProductName: raw['ro.product.name'] ?? null,
    roKernelQemu: raw['ro.kernel.qemu'] ?? null,
    roBootQemu: raw['ro.boot.qemu'] ?? null,
    roHardware: raw['ro.hardware'] ?? null,
    roBuildFingerprint: raw['ro.build.fingerprint'] ?? null,
    roProductCpuAbi: raw['ro.product.cpu.abi'] ?? null
  });
}

function parseChromePackage(pmPathText, dumpsysText) {
  const packagePath = String(pmPathText).split(/\r?\n/u)
    .map((line) => line.trim())
    .find((line) => line.startsWith('package:'))
    ?.slice('package:'.length) ?? null;
  const packageVersion = String(dumpsysText).match(/\bversionName=([^\s]+)/u)?.[1] ?? null;
  return Object.freeze({ packagePath, packageVersion });
}

function parseChromePids(text) {
  return Object.freeze(
    String(text).trim().split(/\s+/u)
      .map(Number)
      .filter(positiveInteger)
      .sort((left, right) => left - right)
  );
}

async function writeRawRecords({ artifactDir, repoDir, records }) {
  const rows = records.map((record) => ({
    id: record.id,
    path: path.join(path.resolve(artifactDir), `${record.id}.json`)
  }));
  await assertArtifactPathsPairwiseDistinct({
    paths: rows,
    repoDir,
    label: 'physical Pixel raw artifacts'
  });
  const directory = await preparePrivateArtifactDirectory({
    artifactDir,
    repoDir,
    label: 'physical Pixel raw artifact directory'
  });
  const publishedRows = [];
  for (let index = 0; index < records.length; index += 1) {
    const published = await publishPrivateArtifact({
      directory,
      filename: path.basename(rows[index].path),
      bytes: Buffer.from(`${JSON.stringify(records[index], null, 2)}\n`),
      repoDir,
      label: `physical Pixel ${records[index].id} raw artifact`
    });
    publishedRows.push(published);
  }
  return Object.freeze(rows.map((row, index) => Object.freeze({
    ...row,
    publicationIdentity: publicationIdentity(publishedRows[index].identity)
  })));
}

async function fetchJson(url, options = {}) {
  const timeoutMs = options.deadlineAtMs == null
    ? (options.timeoutMs ?? 30_000)
    : physicalPixelDeadlineRemainingMs(options.deadlineAtMs, {
        ceilingMs: options.timeoutMs ?? 30_000,
        label: `CDP HTTP ${url}`
      });
  const { deadlineAtMs: _deadlineAtMs, timeoutMs: _timeoutMs, ...fetchOptions } = options;
  const response = await fetch(url, {
    ...fetchOptions,
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response.ok) {
    throw new Error(`CDP HTTP ${response.status} for ${url}`);
  }
  return response.json();
}

async function openCdpClient(webSocketUrl, {
  clientKind,
  targetCloseAuthority = () => null,
  commandAudit = null,
  deadlineAtMs = null
} = {}) {
  const allowedMethods = CDP_ALLOWED_METHODS[clientKind];
  if (!(allowedMethods instanceof Set)) {
    throw new TypeError('physical Pixel CDP client kind must have a fixed allowlist');
  }
  const socket = new WebSocket(webSocketUrl);
  const pending = new Map();
  const listeners = new Map();
  let nextId = 1;
  let defaultDeadlineAtMs = deadlineAtMs;
  await new Promise((resolve, reject) => {
    const openTimeoutMs = defaultDeadlineAtMs == null
      ? 30_000
      : physicalPixelDeadlineRemainingMs(defaultDeadlineAtMs, {
          ceilingMs: 30_000,
          label: 'CDP WebSocket open'
        });
    const timeout = setTimeout(
      () => {
        socket.close();
        reject(new Error('CDP WebSocket open timed out'));
      },
      openTimeoutMs
    );
    socket.addEventListener('open', () => {
      clearTimeout(timeout);
      resolve();
    }, { once: true });
    socket.addEventListener('error', () => {
      clearTimeout(timeout);
      reject(new Error('CDP WebSocket open failed'));
    }, { once: true });
  });
  socket.addEventListener('message', (event) => {
    let message;
    try {
      message = JSON.parse(String(event.data));
    } catch {
      return;
    }
    if (message.id != null) {
      const waiter = pending.get(message.id);
      if (!waiter) return;
      pending.delete(message.id);
      clearTimeout(waiter.timeout);
      if (message.error) waiter.reject(new Error(message.error.message || 'CDP error'));
      else {
        const result = message.result ?? {};
        if (
          Array.isArray(commandAudit)
          && Number.isSafeInteger(waiter.auditIndex)
        ) {
          const current = commandAudit[waiter.auditIndex];
          const screenshotData = waiter.method === 'Page.captureScreenshot'
            ? result?.data
            : null;
          const screenshotBytes = typeof screenshotData === 'string'
            ? Buffer.from(screenshotData, 'base64')
            : null;
          commandAudit[waiter.auditIndex] = Object.freeze({
            ...current,
            responseStatus: 'success',
            responseSha256: canonicalJsonSha256(result),
            ...(screenshotBytes == null ? {} : {
              responsePngByteLength: screenshotBytes.byteLength,
              responsePngSha256: sha256Bytes(screenshotBytes)
            })
          });
        }
        waiter.resolve(result);
      }
      return;
    }
    for (const listener of listeners.get(message.method) ?? []) {
      listener(message.params ?? {});
    }
  });
  const on = (method, listener) => {
    const rows = listeners.get(method) ?? [];
    rows.push(listener);
    listeners.set(method, rows);
    return () => listeners.set(method, rows.filter((entry) => entry !== listener));
  };
  const send = (method, params = {}, {
    timeoutMs = 30_000,
    deadlineAtMs: operationDeadlineAtMs = defaultDeadlineAtMs
  } = {}) => {
    if (!allowedMethods.has(method)) {
      throw new Error(`physical Pixel CDP command is not allowlisted for ${clientKind}: ${method}`);
    }
    if (
      (method === 'Target.closeTarget' || method === 'Target.activateTarget')
      && (
        clientKind !== 'browser'
        ||
        typeof params?.targetId !== 'string'
        || params.targetId !== targetCloseAuthority()
      )
    ) {
      throw new Error(
        `${method} is authorized only for this capture target`
      );
    }
    const auditIndex = Array.isArray(commandAudit)
      ? commandAudit.length
      : null;
    if (auditIndex != null) {
      commandAudit.push(Object.freeze({
        sequence: auditIndex,
        client: clientKind,
        method,
        paramsSha256: canonicalJsonSha256(params),
        targetId: params?.targetId ?? null,
        url: method === 'Page.navigate' || method === 'Target.createTarget'
          ? params?.url ?? null
          : null,
        responseStatus: 'pending'
      }));
    }
    const id = nextId;
    nextId += 1;
    const effectiveTimeoutMs = operationDeadlineAtMs == null
      ? timeoutMs
      : physicalPixelDeadlineRemainingMs(operationDeadlineAtMs, {
          ceilingMs: timeoutMs,
          label: `CDP ${method}`
        });
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`CDP ${method} timed out`));
      }, effectiveTimeoutMs);
      pending.set(id, { resolve, reject, timeout, auditIndex, method });
      socket.send(JSON.stringify({ id, method, params }));
    });
  };
  const waitFor = (method, predicate = () => true, timeoutMs = 30_000) => {
    const effectiveTimeoutMs = defaultDeadlineAtMs == null
      ? timeoutMs
      : physicalPixelDeadlineRemainingMs(defaultDeadlineAtMs, {
          ceilingMs: timeoutMs,
          label: `CDP event ${method}`
        });
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        stop();
        reject(new Error(`CDP event ${method} timed out`));
      }, effectiveTimeoutMs);
      const stop = on(method, (params) => {
        if (!predicate(params)) return;
        clearTimeout(timeout);
        stop();
        resolve(params);
      });
    });
  };
  return Object.freeze({
    send,
    on,
    waitFor,
    setDeadline(nextDeadlineAtMs) {
      defaultDeadlineAtMs = nextDeadlineAtMs;
    },
    close() {
      for (const waiter of pending.values()) {
        clearTimeout(waiter.timeout);
        waiter.reject(new Error('CDP client closed'));
      }
      pending.clear();
      socket.close();
    }
  });
}

async function cdpEvaluate(client, expression, { awaitPromise = false } = {}) {
  const result = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise,
    returnByValue: true,
    userGesture: false
  }, { timeoutMs: SAMPLE_TIMEOUT_MS });
  if (result.exceptionDetails) {
    throw new Error(
      result.exceptionDetails.exception?.description
      || result.exceptionDetails.text
      || 'CDP evaluation failed'
    );
  }
  return result.result?.value;
}

async function waitForPageValue(client, expression, {
  timeoutMs = SAMPLE_TIMEOUT_MS,
  intervalMs = 500,
  label = 'page condition'
} = {}) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const value = await cdpEvaluate(client, expression, { awaitPromise: true });
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`${label} timed out after ${timeoutMs} ms`);
}

const PAGE_READY_EXPRESSION = String.raw`(() => {
  const overlay = document.querySelector('#sph-phase-overlay');
  const schedule = overlay?.__mlsMpmResidentAutoSchedule;
  return Boolean(
    overlay
    && overlay.__sphScene
    && overlay.querySelector('#sph-play')
    && schedule?.residentAuto === true
    && !String(schedule?.status || '').startsWith('disabled')
  );
})()`;

const INSTALL_RAF_COUNTER_EXPRESSION = String.raw`(() => {
  if (globalThis.__ulgPhysicalPixelReceiptRafCounter) return true;
  const counter = { count: 0 };
  globalThis.__ulgPhysicalPixelReceiptRafCounter = counter;
  const tick = () => {
    counter.count += 1;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return true;
})()`;

const PAGE_NATIVE_PRESENTATION_READY_EXPRESSION = String.raw`(() => {
  const overlay = document.querySelector('#sph-phase-overlay');
  return Boolean(
    overlay?.__sphScene?.scene?.userData?.sphRendererBackend === 'native-webgpu'
    && overlay?.__sphResidentSurfaceDraw?.visibleRendererBridge
      === 'native-webgpu-surface-consumer'
  );
})()`;

const PAGE_NATIVE_CANVAS_CAPTURE_EXPRESSION = String.raw`(() => {
  const overlay = document.querySelector('#sph-phase-overlay');
  const sceneApi = overlay?.__sphScene || null;
  const bridge = sceneApi?.getSphResidentSurfaceDrawRenderBridge?.() || null;
  const nativeConsumer = sceneApi?.scene?.userData?.sphNativeWebGpuSurfaceConsumer
    || bridge?.nativeConsumer
    || null;
  const canvas = nativeConsumer?.canvas || bridge?.canvas || null;
  if (
    !canvas
    || bridge?.rendererBridge !== 'native-webgpu-surface-consumer'
    || !canvas.isConnected
  ) return null;
  const canvases = Array.from(document.querySelectorAll('canvas'));
  const canvasIndex = canvases.indexOf(canvas);
  const rect = canvas.getBoundingClientRect?.();
  const style = getComputedStyle(canvas);
  if (
    canvasIndex < 0
    || !rect
    || !(rect.width > 0)
    || !(rect.height > 0)
    || style.display === 'none'
    || style.visibility === 'hidden'
    || Number(style.opacity) === 0
  ) return null;
  const visual = window.visualViewport;
  const viewportLeft = window.scrollX + Number(visual?.offsetLeft || 0);
  const viewportTop = window.scrollY + Number(visual?.offsetTop || 0);
  const viewportWidth = Number(visual?.width || window.innerWidth || 0);
  const viewportHeight = Number(visual?.height || window.innerHeight || 0);
  const canvasLeft = window.scrollX + rect.left;
  const canvasTop = window.scrollY + rect.top;
  const visibleLeft = Math.max(canvasLeft, viewportLeft);
  const visibleTop = Math.max(canvasTop, viewportTop);
  const visibleRight = Math.min(canvasLeft + rect.width, viewportLeft + viewportWidth);
  const visibleBottom = Math.min(canvasTop + rect.height, viewportTop + viewportHeight);
  const visibleWidth = Math.max(0, visibleRight - visibleLeft);
  const visibleHeight = Math.max(0, visibleBottom - visibleTop);
  if (!(visibleWidth > 0) || !(visibleHeight > 0)) return null;
  const clipWidth = Math.max(1, Math.min(
    visibleWidth * 0.6,
    ${COMPOSITOR_CAPTURE_MAX_CSS_WIDTH}
  ));
  const clipHeight = Math.max(1, Math.min(
    visibleHeight * 0.6,
    ${COMPOSITOR_CAPTURE_MAX_CSS_HEIGHT}
  ));
  const clip = {
    x: visibleLeft + (visibleWidth - clipWidth) / 2,
    y: visibleTop + (visibleHeight - clipHeight) / 2,
    width: clipWidth,
    height: clipHeight,
    scale: 1
  };
  const centerClientX = clip.x + clip.width / 2 - window.scrollX;
  const centerClientY = clip.y + clip.height / 2 - window.scrollY;
  const centerHitIncludesCanvas = document.elementsFromPoint(
    centerClientX,
    centerClientY
  ).includes(canvas);
  return {
    schema: 'peercompute.ulg.physical-pixel-native-canvas-clip.v1',
    canvasIndex,
    canvasCount: canvases.length,
    sameAsBridgeCanvas: bridge?.canvas === canvas,
    sameAsNativeConsumerCanvas: nativeConsumer?.canvas === canvas,
    rendererBridge: bridge?.rendererBridge ?? null,
    canvasBackingWidth: canvas.width,
    canvasBackingHeight: canvas.height,
    devicePixelRatio: window.devicePixelRatio,
    visualViewportScale: Number(visual?.scale || 1),
    documentUrl: location.href,
    centerHitIncludesCanvas,
    rect: {
      x: canvasLeft,
      y: canvasTop,
      width: rect.width,
      height: rect.height
    },
    viewport: {
      x: viewportLeft,
      y: viewportTop,
      width: viewportWidth,
      height: viewportHeight
    },
    clip,
    style: {
      display: style.display,
      visibility: style.visibility,
      opacity: style.opacity
    }
  };
})()`;

const PAGE_SNAPSHOT_EXPRESSION = String.raw`(() => {
  const overlay = document.querySelector('#sph-phase-overlay');
  if (!overlay) return null;
  const execution = overlay.__sphScene?.getMlsMpmResidentSteps?.()
    || overlay.__mlsMpmResidentSteps
    || null;
  const finalStep = execution?.finalStep || execution;
  const counters = overlay.__sphFrameCounters || {};
  const perf = overlay.__sphResidentPerf || {};
  const schedule = overlay.__mlsMpmResidentAutoSchedule || null;
  const startup = overlay.__sphRendererSurfaceStartupSelection || null;
  const residentSurface = overlay.__sphResidentSurfaceDraw || null;
  const actualRendererBackend = overlay.__sphScene?.scene?.userData?.sphRendererBackend
    ?? startup?.rendererBackend
    ?? null;
  const actualSurfaceMode = residentSurface?.visibleRendererBridge
    ?? startup?.surfaceDrawMode
    ?? null;
  const finiteOrNull = (value) => (
    typeof value === 'number' && Number.isFinite(value) ? value : null
  );
  const safeIntegerOrNull = (value) => (
    Number.isSafeInteger(value) ? value : null
  );
  const booleanOrNull = (value) => (
    typeof value === 'boolean' ? value : null
  );
  const route = {
    p2gDense: finalStep?.p2gGridProjection?.activeSourceDenseCompatibilityEnabled === true,
    gridDense: finalStep?.gridUpdate?.activeSourceDenseCompatibilityEnabled === true,
    g2pDense: finalStep?.g2pReconstruction?.activeSourceDenseCompatibilityEnabled === true,
    p2gField: finalStep?.p2gGridProjection?.mechanicsFieldViewEnabled === true,
    gridField: finalStep?.gridUpdate?.mechanicsFieldViewEnabled === true,
    g2pField: finalStep?.g2pReconstruction?.mechanicsFieldViewEnabled === true
  };
  const routeMode = (dense, field) => dense ? 'dense' : (field ? 'field' : null);
  const publicCounters = {
    maps: safeIntegerOrNull(execution?.mapAsyncCount),
    bytes: safeIntegerOrNull(execution?.readbackBytes),
    fenceWaits: safeIntegerOrNull(execution?.hostQueueFenceCount)
  };
  const observedCounters = {
    maps: safeIntegerOrNull(execution?.observedMapAsyncCount),
    bytes: safeIntegerOrNull(execution?.observedReadbackBytes),
    fenceWaits: safeIntegerOrNull(execution?.observedHostQueueFenceCount)
  };
  const bodies = (overlay.__sphInitialBodies?.bodies || []).map((body) => ({
    id: body.id ?? null,
    domainId: body.domainId ?? null,
    material: body.material ?? null,
    centerM: Array.from(body.centerM || []).map(Number),
    sizeM: Array.from(body.sizeM || []).map(Number),
    particlesPerEdge: Array.from(body.particlesPerEdge || []).map(Number)
  }));
  return {
    capturedAtMs: finiteOrNull(performance.now()),
    nextStep: safeIntegerOrNull(
      execution?.nextSphParticleState?.step
      ?? execution?.nextStep
      ?? finalStep?.particlePingPong?.nextStep
    ),
    completion: finiteOrNull(counters.lastResidentCompletionAtMs),
    submissions: safeIntegerOrNull(perf.residentSubmissions),
    frameCounter: safeIntegerOrNull(globalThis.__ulgPhysicalPixelReceiptRafCounter?.count),
    renderFps: finiteOrNull(counters.renderFps),
    physicsFps: finiteOrNull(counters.physicsFps),
    residentFps: finiteOrNull(counters.residentFps),
    error: overlay.__mlsMpmResidentStepsError == null
      ? null
      : String(overlay.__mlsMpmResidentStepsError?.message || overlay.__mlsMpmResidentStepsError),
    warningText: overlay.querySelector('#sph-warning-bar')?.textContent ?? null,
    documentUrl: location.href,
    documentVisibility: document.visibilityState,
    documentHasFocus: document.hasFocus(),
    warningMessages: Array.from(
      overlay.querySelectorAll('#sph-warning-bar .sph-warning-chip')
    ).map((node) => String(node.textContent || '').trim()).filter(Boolean),
    motionDiagnostic: overlay.__sphResidentMotionDiagnostic == null ? null : {
      schema: overlay.__sphResidentMotionDiagnostic.schema ?? null,
      status: overlay.__sphResidentMotionDiagnostic.status ?? null,
      maxDisplacementM: finiteOrNull(
        overlay.__sphResidentMotionDiagnostic.maxDisplacementM
      ),
      compactGpuSummaryAvailable: booleanOrNull(
        overlay.__sphResidentMotionDiagnostic.compactGpuSummaryAvailable
      )
    },
    autoSchedule: schedule == null ? null : {
      residentAuto: booleanOrNull(schedule.residentAuto),
      status: schedule.status ?? null
    },
    presentation: {
      rendererBackend: actualRendererBackend,
      surfaceDrawMode: actualSurfaceMode,
      nativeSurfaceDrawRequested: booleanOrNull(startup?.nativeSurfaceDrawRequested),
      lastRenderStatus: residentSurface?.lastRenderStatus ?? null
    },
    telemetry: {
      schema: execution?.readbackTelemetrySchema ?? null,
      status: execution?.readbackTelemetryComplete === true
        ? 'complete'
        : (execution?.readbackTelemetryComplete === false ? 'incomplete' : null),
      unknownFields: Array.isArray(execution?.readbackTelemetryUnknownSources)
        ? execution.readbackTelemetryUnknownSources
        : null,
      publicCounters,
      observedCounters,
      normalHotLoopReadbackFree: booleanOrNull(execution?.normalHotLoopReadbackFree),
      fullParticleReadbackPerformed: booleanOrNull(execution?.fullParticleReadbackPerformed),
      fullParticleReadbackFree: booleanOrNull(execution?.fullParticleReadbackFree),
      residentContinuationReady: booleanOrNull(execution?.residentContinuationReady)
    },
    mechanics: {
      p2gMode: routeMode(route.p2gDense, route.p2gField),
      gridMode: routeMode(route.gridDense, route.gridField),
      g2pMode: routeMode(route.g2pDense, route.g2pField),
      productEventCount: safeIntegerOrNull(
        finalStep?.p2gGridProjection?.residentProductMassInputProductEventCount
      ),
      productEventRowCapacity: safeIntegerOrNull(
        finalStep?.p2gGridProjection
          ?.residentProductMassInputProductEventRowCapacity
      ),
      productEventCountAuthority:
        finalStep?.p2gGridProjection
          ?.residentProductMassInputProductEventCountAuthority ?? null,
      productEventCountHostKnown: booleanOrNull(
        finalStep?.p2gGridProjection
          ?.residentProductMassInputProductEventCountHostKnown
      ),
      productDispatchMode:
        finalStep?.p2gGridProjection
          ?.residentProductMassProductEventDispatchMode ?? null,
      productGridCouplingStatus:
        finalStep?.p2gGridProjection
          ?.residentProductMassGridCouplingStatus ?? null,
      productCoupledEventCount: safeIntegerOrNull(
        finalStep?.p2gGridProjection?.residentProductMassCoupledEventCount
      ),
      productCoupledUnplacedMassKg: finiteOrNull(
        finalStep?.p2gGridProjection
          ?.residentProductMassCoupledUnplacedMassKg
      ),
      ambient: {
        requested: booleanOrNull(finalStep?.phaseVolumeAmbientBuoyancyRequested
          ?? execution?.phaseVolumeAmbientBuoyancyRequested),
        required: booleanOrNull(finalStep?.phaseVolumeAmbientBuoyancyRequired
          ?? execution?.phaseVolumeAmbientBuoyancyRequired),
        skipReason: finalStep?.phaseVolumeAmbientBuoyancySkipReason
          ?? execution?.phaseVolumeAmbientBuoyancySkipReason
          ?? null
      }
    },
    bodies,
    rebuildGeneration: safeIntegerOrNull(overlay.__sphPhaseRebuildWorker?.generation),
    rebuildStatus: overlay.__sphPhaseRebuildWorker?.status ?? null
  };
})()`;

async function pageSnapshot(client) {
  const snapshot = await cdpEvaluate(client, PAGE_SNAPSHOT_EXPRESSION);
  if (!snapshot || typeof snapshot !== 'object') {
    throw new Error('physical Pixel page snapshot is unavailable');
  }
  return snapshot;
}

function decodeCdpPngScreenshot(data) {
  const maxBase64Length = Math.ceil(
    MAX_PHYSICAL_PIXEL_PNG_BYTE_LENGTH / 3
  ) * 4;
  if (
    typeof data !== 'string'
    || data.length === 0
    || data.length > maxBase64Length
    || !/^[A-Za-z0-9+/]+={0,2}$/u.test(data)
  ) {
    throw new Error('physical Pixel compositor screenshot did not return base64 PNG bytes');
  }
  const bytes = Buffer.from(data, 'base64');
  if (
    bytes.byteLength === 0
    || bytes.byteLength > MAX_PHYSICAL_PIXEL_PNG_BYTE_LENGTH
    || bytes.toString('base64') !== data
  ) {
    throw new Error('physical Pixel compositor screenshot returned an empty PNG');
  }
  return bytes;
}

async function captureNativeCompositorFrame(client, { label, policy }) {
  const layoutMetricsResponse = await client.send(
    'Page.getLayoutMetrics',
    {},
    { timeoutMs: SAMPLE_TIMEOUT_MS }
  );
  const cssVisualViewport = layoutMetricsResponse?.cssVisualViewport;
  if (
    !Number.isFinite(cssVisualViewport?.pageX)
    || !Number.isFinite(cssVisualViewport?.pageY)
    || !finitePositive(cssVisualViewport?.clientWidth)
    || !finitePositive(cssVisualViewport?.clientHeight)
    || cssVisualViewport?.scale
      !== policy?.compositorEvidence?.requiredVisualViewportScale
    || cssVisualViewport?.zoom
      !== policy?.compositorEvidence?.requiredPageZoom
  ) {
    throw new Error(
      'physical Pixel CDP layout metrics do not provide an unzoomed CSS-to-DIP viewport'
    );
  }
  const canvas = await cdpEvaluate(client, PAGE_NATIVE_CANVAS_CAPTURE_EXPRESSION);
  if (
    canvas?.schema !== 'peercompute.ulg.physical-pixel-native-canvas-clip.v1'
    || canvas?.rendererBridge !== 'native-webgpu-surface-consumer'
    || canvas?.sameAsBridgeCanvas !== true
    || canvas?.sameAsNativeConsumerCanvas !== true
  ) {
    throw new Error('physical Pixel native canvas clip is unavailable or ambiguous');
  }
  const captureParams = Object.freeze({
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false,
    clip: Object.freeze({
      x: Number(canvas.clip.x),
      y: Number(canvas.clip.y),
      width: Number(canvas.clip.width),
      height: Number(canvas.clip.height),
      scale: 1
    })
  });
  const response = await client.send(
    'Page.captureScreenshot',
    captureParams,
    { timeoutMs: SAMPLE_TIMEOUT_MS }
  );
  const bytes = decodeCdpPngScreenshot(response?.data);
  const decoded = decodePhysicalPixelPng(bytes);
  if (decoded?.status !== 'ready') {
    throw new Error(
      `physical Pixel compositor screenshot PNG is invalid: ${decoded?.reason || 'unknown'}`
    );
  }
  return Object.freeze({
    schema: 'peercompute.ulg.physical-pixel-compositor-frame.v1',
    status: 'captured',
    label,
    captureSource: 'physical-chrome-compositor-surface',
    capturedAt: new Date().toISOString(),
    captureParams,
    layoutMetrics: Object.freeze({
      schema: 'peercompute.ulg.physical-pixel-cdp-layout-metrics.v1',
      cdpResponse: layoutMetricsResponse
    }),
    canvas: Object.freeze(canvas),
    pngBase64: response.data,
    png: Object.freeze({
      byteLength: bytes.byteLength,
      sha256: sha256Bytes(bytes),
      ...publicPhysicalPixelPngMetrics(decoded)
    })
  });
}

function compositorFrameBytes(frame) {
  try {
    return decodeCdpPngScreenshot(frame?.pngBase64);
  } catch {
    return null;
  }
}

function compareCompositorFrames(beforeFrame, afterFrame) {
  const beforeBytes = compositorFrameBytes(beforeFrame);
  const afterBytes = compositorFrameBytes(afterFrame);
  if (!beforeBytes || !afterBytes) {
    return Object.freeze({
      schema: 'peercompute.ulg.physical-pixel-compositor-frame-delta.v1',
      status: 'invalid',
      reason: 'before or after compositor PNG bytes are unavailable',
      visibleContentAdvanced: false
    });
  }
  return comparePhysicalPixelPngFrames(beforeBytes, afterBytes, {
    minChannelDelta: COMPOSITOR_CAPTURE_MIN_CHANNEL_DELTA,
    minChangedPixelCount: COMPOSITOR_CAPTURE_MIN_CHANGED_PIXEL_COUNT,
    minChangedPixelRatio: COMPOSITOR_CAPTURE_MIN_CHANGED_PIXEL_RATIO,
    minChangedBoundsWidth: COMPOSITOR_CAPTURE_MIN_CHANGED_BOUNDS_WIDTH,
    minChangedBoundsHeight: COMPOSITOR_CAPTURE_MIN_CHANGED_BOUNDS_HEIGHT
  });
}

function windowAdvanced(before, after) {
  return Boolean(
    Number.isSafeInteger(before?.nextStep)
    && Number.isSafeInteger(after?.nextStep)
    && after.nextStep > before.nextStep
    && Number.isFinite(before?.completion)
    && Number.isFinite(after?.completion)
    && after.completion > before.completion
    && Number.isSafeInteger(before?.submissions)
    && Number.isSafeInteger(after?.submissions)
    && after.submissions > before.submissions
    && Number.isSafeInteger(before?.frameCounter)
    && Number.isSafeInteger(after?.frameCounter)
    && after.frameCounter > before.frameCounter
    && finitePositive(after?.renderFps)
    && after?.error == null
    && after?.autoSchedule?.residentAuto === true
  );
}

async function captureAdvancingWindow(client, {
  policy,
  timeoutMs = SAMPLE_TIMEOUT_MS
} = {}) {
  const beforeFrame = await captureNativeCompositorFrame(client, {
    label: 'advancing-window-before',
    policy
  });
  const before = await pageSnapshot(client);
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 750));
    const candidateAfter = await pageSnapshot(client);
    if (
      !windowAdvanced(before, candidateAfter)
      || candidateAfter.nextStep - before.nextStep < 4
    ) continue;
    const renderFrameThreshold = Number(candidateAfter.frameCounter) + 2;
    await waitForPageValue(client, `(() => (
      Number(globalThis.__ulgPhysicalPixelReceiptRafCounter?.count) >= ${renderFrameThreshold}
    ))()`, {
      timeoutMs: Math.max(1, timeoutMs - (Date.now() - startedAt)),
      intervalMs: 100,
      label: 'physical Pixel compositor settle frames'
    });
    const afterFrame = await captureNativeCompositorFrame(client, {
      label: 'advancing-window-after',
      policy
    });
    const after = await pageSnapshot(client);
    if (!windowAdvanced(before, after)) continue;
    const compositorDelta = compareCompositorFrames(beforeFrame, afterFrame);
    if (compositorDelta.visibleContentAdvanced !== true) {
      throw new Error(
        `physical Pixel compositor pixels did not visibly advance: ${compositorDelta.reason || `${compositorDelta.changedPixelCount ?? 0} pixels changed`}`
      );
    }
    return Object.freeze({
      before,
      after,
      beforeFrame,
      afterFrame,
      compositorDelta,
      animationFrameCount: after.frameCounter - before.frameCounter,
      animationStepCount: after.nextStep - before.nextStep,
      renderFps: after.renderFps
    });
  }
  throw new Error(`physical Pixel animation window did not advance in ${timeoutMs} ms`);
}

async function pageDeviceEvidence(client) {
  return cdpEvaluate(client, String.raw`(async () => {
    const highEntropy = navigator.userAgentData?.getHighEntropyValues
      ? await navigator.userAgentData.getHighEntropyValues([
          'model', 'platform', 'platformVersion', 'architecture', 'bitness'
        ])
      : {};
    const adapter = await navigator.gpu?.requestAdapter?.();
    const info = adapter?.info || {};
    return {
      userAgent: navigator.userAgent,
      userAgentData: {
        platform: highEntropy.platform ?? navigator.userAgentData?.platform ?? null,
        mobile: navigator.userAgentData?.mobile === true,
        model: highEntropy.model ?? null,
        platformVersion: highEntropy.platformVersion ?? null,
        architecture: highEntropy.architecture ?? null,
        bitness: highEntropy.bitness ?? null
      },
      navigatorPlatform: navigator.platform,
      navigatorWebdriver: navigator.webdriver === true,
      maxTouchPoints: navigator.maxTouchPoints,
      pointerCoarse: matchMedia('(pointer: coarse)').matches,
      hoverNone: matchMedia('(hover: none)').matches,
      secureContext: globalThis.isSecureContext === true,
      webgpuAdapterAvailable: Boolean(adapter),
      webgpuAdapterInfo: {
        vendor: info.vendor ?? null,
        architecture: info.architecture ?? null,
        device: info.device ?? null,
        description: info.description ?? null,
        isFallbackAdapter: typeof adapter?.isFallbackAdapter === 'boolean'
          ? adapter.isFallbackAdapter
          : (typeof info.isFallbackAdapter === 'boolean'
              ? info.isFallbackAdapter
              : null)
      }
    };
  })()`, { awaitPromise: true });
}

async function fetchViteBrowserResource(client, url) {
  const urlJson = JSON.stringify(url);
  const result = await cdpEvaluate(client, String.raw`(async () => {
    const response = await fetch(${urlJson}, { cache: 'no-store', credentials: 'same-origin' });
    if (!response.ok) throw new Error('Vite resource fetch failed: ' + response.status);
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return {
      url: response.url,
      contentType: response.headers.get('content-type') || '',
      base64: btoa(binary),
      origin: location.origin
    };
  })()`, { awaitPromise: true });
  if (typeof result?.base64 !== 'string') {
    throw new Error(`physical Pixel Vite resource returned no base64 bytes: ${url}`);
  }
  return Object.freeze({
    url: result.url,
    contentType: result.contentType,
    bytes: Buffer.from(result.base64, 'base64'),
    origin: result.origin
  });
}

async function servedSourceEvidence(client, policy, localManifest, runId, repoDir, artifactDir) {
  const rawModules = [];
  for (const local of localManifest.modules) {
    const rawUrl = new URL(`/${local.path}`, policy.baseUrl);
    rawUrl.searchParams.set('raw', '');
    rawUrl.searchParams.set('physicalPixelReceipt', runId);
    const fetched = await fetchViteBrowserResource(client, rawUrl.href);
    rawModules.push(Object.freeze({
      path: local.path,
      byteLength: fetched.bytes.byteLength,
      localSha256: local.sha256,
      browserSha256: sha256Bytes(fetched.bytes)
    }));
  }
  const transformed = await buildPhysicalPixelViteResourceClosure({
    baseUrl: policy.baseUrl,
    sourceManifest: localManifest,
    repoDir,
    resourceArtifactDir: path.join(artifactDir, 'served-source-resources'),
    fetchResource: (url) => fetchViteBrowserResource(client, url)
  });
  const observedOrigin = new URL(policy.baseUrl).origin;
  const rawCore = sourceManifestCore(
    rawModules.map((row) => ({
      path: row.path,
      byteLength: row.byteLength,
      sha256: row.browserSha256
    })),
    localManifest.unresolvedBareSpecifiers
  );
  return Object.freeze({
    attestation: SERVED_SOURCE_BINDING_ATTESTATION,
    scope: VITE_TRANSFORMED_RESOURCE_SCOPE,
    baseUrl: policy.baseUrl,
    observedOrigin,
    rawSourceParity: Object.freeze({
      scope: VITE_RAW_SOURCE_PARITY_SCOPE,
      localManifestSha256: localManifest.manifestSha256,
      browserManifestSha256: canonicalJsonSha256(rawCore),
      modules: Object.freeze(rawModules)
    }),
    transformed
  });
}

function consoleRowsForScenario(rows, scenarioId) {
  return rows.filter((row) => row.scenarioId === scenarioId);
}

function scenarioConsoleSummary(rows) {
  const errors = rows.filter((row) => (
    row.kind === 'exception'
    || row.level === 'error'
  )).map((row) => row.text);
  const unhandled = rows.filter((row) => (
    row.kind === 'exception' && /promise|unhandled/iu.test(row.text)
  )).map((row) => row.text);
  const warnings = rows.filter((row) => row.level === 'warning')
    .map((row) => row.text);
  return Object.freeze({
    pageError: errors[0] ?? null,
    consoleErrors: Object.freeze(errors),
    consoleWarnings: Object.freeze(warnings),
    unhandledRejections: Object.freeze(unhandled)
  });
}

function stackedBodyProof(beforeSnapshot, afterSnapshot) {
  const beforeBodies = beforeSnapshot?.bodies ?? [];
  const afterBodies = afterSnapshot?.bodies ?? [];
  const beforeIds = new Set(beforeBodies.map((body) => body.id));
  const added = afterBodies.find((body) => !beforeIds.has(body.id)) ?? null;
  const template = beforeBodies.at(-1) ?? null;
  const verticalPitchM = template == null
    ? null
    : Number(template.sizeM?.[1]) / Number(template.particlesPerEdge?.[1]);
  const expectedCenterY = template == null
    ? null
    : Number(template.centerM?.[1]) + Number(template.sizeM?.[1]) + verticalPitchM;
  const toleranceM = 1e-9;
  return Object.freeze({
    h2oBodyCountBefore: beforeBodies.filter(
      (body) => String(body.material).toLowerCase() === 'h2o'
    ).length,
    h2oBodyCountAfter: afterBodies.filter(
      (body) => String(body.material).toLowerCase() === 'h2o'
    ).length,
    rebuildGenerationBefore: beforeSnapshot?.rebuildGeneration ?? null,
    rebuildGenerationAfter: afterSnapshot?.rebuildGeneration ?? null,
    bodiesBefore: beforeBodies,
    bodiesAfter: afterBodies,
    addedBodyId: added?.id ?? null,
    verticalStack: Boolean(
      template
      && added
      && String(added.material).toLowerCase() === 'h2o'
      && Math.abs(Number(added.centerM?.[0]) - Number(template.centerM?.[0])) <= toleranceM
      && Math.abs(Number(added.centerM?.[2]) - Number(template.centerM?.[2])) <= toleranceM
      && Math.abs(Number(added.centerM?.[1]) - expectedCenterY) <= toleranceM
      && Number(added.centerM?.[1]) > Number(template.centerM?.[1])
    ),
    expectedAddedCenterY: expectedCenterY,
    verticalPitchM
  });
}

async function navigatePage(client, url) {
  const navigation = await client.send('Page.navigate', { url }, {
    timeoutMs: SAMPLE_TIMEOUT_MS
  });
  if (navigation.errorText) {
    throw new Error(`physical Pixel navigation failed: ${navigation.errorText}`);
  }
  const urlJson = JSON.stringify(url);
  await waitForPageValue(client, String.raw`(() => (
    location.href === ${urlJson}
    && (document.readyState === 'interactive' || document.readyState === 'complete')
    && document.visibilityState === 'visible'
    && document.hasFocus()
  ))()`, { label: 'physical Pixel exact page load' });
  await cdpEvaluate(client, INSTALL_RAF_COUNTER_EXPRESSION);
  await waitForPageValue(client, String.raw`(() => (
    location.href === ${urlJson}
    && document.visibilityState === 'visible'
    && document.hasFocus()
    && Number(globalThis.__ulgPhysicalPixelReceiptRafCounter?.count) >= 2
  ))()`, { label: 'physical Pixel exact-document animation frame counter' });
  await waitForPageValue(client, PAGE_READY_EXPRESSION, {
    label: 'physical Pixel resident auto schedule'
  });
  await waitForPageValue(client, PAGE_NATIVE_PRESENTATION_READY_EXPRESSION, {
    label: 'physical Pixel native WebGPU presentation'
  });
}

async function captureScenario({ client, expected, consoleRows, policy }) {
  await navigatePage(client, expected.url);
  let bodyProof = null;
  if (expected.id === 'triple-water') {
    const beforeBody = await pageSnapshot(client);
    await waitForPageValue(client, String.raw`(() => {
      const button = document.querySelector('#sph-phase-overlay #sph-add-body');
      return Boolean(button && !button.disabled);
    })()`, { label: 'physical Pixel add-body control' });
    const clicked = await cdpEvaluate(client, String.raw`(() => {
      const button = document.querySelector('#sph-phase-overlay #sph-add-body');
      if (!button || button.disabled) return false;
      button.click();
      return true;
    })()`);
    if (clicked !== true) throw new Error('physical Pixel add-body click failed');
    await waitForPageValue(client, `(() => {
      const overlay = document.querySelector('#sph-phase-overlay');
      const bodies = overlay?.__sphInitialBodies?.bodies || [];
      const rebuild = overlay?.__sphPhaseRebuildWorker;
      return bodies.length === 3
        && bodies.every((body) => String(body.material).toLowerCase() === 'h2o')
        && rebuild?.status === 'complete'
        && Number(rebuild.generation) > ${JSON.stringify(beforeBody.rebuildGeneration)};
    })()`, { label: 'physical Pixel triple-water rebuild' });
    const afterBody = await pageSnapshot(client);
    bodyProof = stackedBodyProof(beforeBody, afterBody);
    if (!bodyProof.verticalStack) {
      throw new Error('the third water body was not added in the canonical vertical stack');
    }
  }
  const windows = [];
  for (let index = 0; index < SAMPLE_WINDOW_COUNT; index += 1) {
    windows.push(await captureAdvancingWindow(client, { policy }));
  }
  let finalSnapshot = windows.at(-1).after;
  if (expected.id === 'sodium-water') {
    finalSnapshot = await waitForPageValue(client, String.raw`(() => {
      const overlay = document.querySelector('#sph-phase-overlay');
      const execution = overlay?.__sphScene?.getMlsMpmResidentSteps?.()
        || overlay?.__mlsMpmResidentSteps;
      const finalStep = execution?.finalStep || execution;
      return finalStep?.p2gGridProjection
          ?.residentProductMassInputProductEventCountAuthority
          === 'gpu-authored-filtered-live-prefix'
        && finalStep?.p2gGridProjection
          ?.residentProductMassInputProductEventCountHostKnown === false
        && finalStep?.p2gGridProjection
          ?.residentProductMassProductEventDispatchMode
          === 'gpu-authenticated-gas-only-no-mechanics-scatter'
        && finalStep?.p2gGridProjection
          ?.residentProductMassGridCouplingStatus
          === 'resident-product-mass-gas-only-certified-no-mechanics-p2g-scatter';
    })()`, { label: 'physical Pixel sodium-water GPU product-history commit' })
      ? await pageSnapshot(client)
      : finalSnapshot;
  }
  const scenarioRows = consoleRowsForScenario(consoleRows, expected.id);
  const consoleSummary = scenarioConsoleSummary(scenarioRows);
  const animationFrameCount = windows.reduce(
    (sum, window) => sum + window.animationFrameCount,
    0
  );
  const animationStepCount = windows.reduce(
    (sum, window) => sum + window.animationStepCount,
    0
  );
  return Object.freeze({
    id: expected.id,
    url: expected.url,
    interaction: expected.interaction,
    sample: Object.freeze({
      windows: Object.freeze(windows),
      before: windows[0].before,
      after: windows.at(-1).after,
      animationFrameCount,
      animationStepCount,
      renderFps: Math.min(...windows.map((window) => window.renderFps)),
      ...consoleSummary,
      hotLoopWarningPresent: Boolean(
        /hot loop is not fully GPU resident/iu.test(finalSnapshot.warningText ?? '')
        || scenarioRows.some((row) => (
          /hot loop is not fully GPU resident/iu.test(row.text ?? '')
        ))
      )
    }),
    telemetry: finalSnapshot.telemetry,
    mechanics: finalSnapshot.mechanics,
    presentation: finalSnapshot.presentation,
    autoSchedule: finalSnapshot.autoSchedule,
    ...(bodyProof ? { bodyProof } : {})
  });
}

async function capturePhysicalPixelWithAdbCdp({
  policy,
  sourceManifest,
  repoDir = sourceRepoDir,
  artifactDir,
  activeDeadlineAtMs,
  absoluteDeadlineAtMs
}) {
  const adbExecutable = ADB_EXECUTABLE;
  if (!policyValid(policy)) throw new Error('physical Pixel capture policy is invalid');
  if (typeof artifactDir !== 'string' || artifactDir.length === 0) {
    throw new TypeError('physical Pixel artifactDir must be a non-empty string');
  }
  const deadlineStartedAtMs = Date.now();
  activeDeadlineAtMs = Number.isFinite(Number(activeDeadlineAtMs))
    ? Number(activeDeadlineAtMs)
    : deadlineStartedAtMs + PHYSICAL_PIXEL_LIVENESS_LIMITS_MS.activeCapture;
  absoluteDeadlineAtMs = Number.isFinite(Number(absoluteDeadlineAtMs))
    ? Number(absoluteDeadlineAtMs)
    : deadlineStartedAtMs + PHYSICAL_PIXEL_LIVENESS_LIMITS_MS.absolute;
  physicalPixelDeadlineRemainingMs(activeDeadlineAtMs, {
    label: 'physical Pixel active capture'
  });
  const runId = randomUUID();
  const records = [];
  const runAdb = async (id, args, options = {}) => {
    const result = requireSuccessfulCommand(
      await runBoundedProcess(adbExecutable, args, {
        cwd: repoDir,
        deadlineAtMs: activeDeadlineAtMs,
        ...options
      }),
      id
    );
    const record = commandRecord({
      id,
      runId,
      executable: adbExecutable,
      args,
      result
    });
    records.push(record);
    return { result, record };
  };

  const devices = await runAdb('adb-devices', ['devices', '-l']);
  const deviceRows = parseAdbDevices(devices.result.stdout)
    .filter((row) => row.state === 'device');
  const requestedSerial = String(
    process.env.ULG_PHYSICAL_PIXEL_ADB_SERIAL ?? ''
  ).trim();
  const matchingRows = requestedSerial
    ? deviceRows.filter((row) => row.serial === requestedSerial)
    : deviceRows;
  if (matchingRows.length !== 1) {
    throw new Error(
      requestedSerial
        ? `exactly one authorized ADB device must match ${requestedSerial}`
        : 'exactly one authorized physical ADB device is required; set ULG_PHYSICAL_PIXEL_ADB_SERIAL when more are attached'
    );
  }
  const devicesRow = matchingRows[0];
  const serialArgs = ['-s', devicesRow.serial];
  const getState = await runAdb('adb-get-state', [...serialArgs, 'get-state']);
  const getprop = await runAdb('adb-getprop', [...serialArgs, 'shell', 'getprop']);
  const pmPath = requireSuccessfulCommand(
    await runBoundedProcess(adbExecutable, [
      ...serialArgs, 'shell', 'pm', 'path', policy.chromePackage
    ], { cwd: repoDir, deadlineAtMs: activeDeadlineAtMs }),
    'Chrome package path'
  );
  const packageDump = requireSuccessfulCommand(
    await runBoundedProcess(adbExecutable, [
      ...serialArgs, 'shell', 'dumpsys', 'package', policy.chromePackage
    ], { cwd: repoDir, deadlineAtMs: activeDeadlineAtMs }),
    'Chrome package metadata'
  );
  records.push(jsonRecord({
    id: 'chrome-package',
    runId,
    value: {
      pmPath: commandRecord({
        id: 'chrome-package-pm-path',
        runId,
        executable: adbExecutable,
        args: [...serialArgs, 'shell', 'pm', 'path', policy.chromePackage],
        result: pmPath
      }),
      dumpsys: commandRecord({
        id: 'chrome-package-dumpsys',
        runId,
        executable: adbExecutable,
        args: [...serialArgs, 'shell', 'dumpsys', 'package', policy.chromePackage],
        result: packageDump
      })
    }
  }));
  const chromeProcessBefore = requireSuccessfulCommand(
    await runBoundedProcess(adbExecutable, [
      ...serialArgs, 'shell', 'pidof', policy.chromePackage
    ], { cwd: repoDir, deadlineAtMs: activeDeadlineAtMs }),
    'existing Chrome process'
  );
  const pidsBefore = parseChromePids(chromeProcessBefore.stdout);
  if (pidsBefore.length === 0) {
    throw new Error('Chrome must already be running on the physical Pixel');
  }

  let forwardPort = null;
  let targetId = null;
  let createdTarget = null;
  let createdTargetOwned = false;
  let browserClient = null;
  let client = null;
  let ownTargetClosed = false;
  let closeResponse = null;
  let targetsBefore = [];
  let targetsAfter = [];
  let forwardCreate = null;
  let forwardOwnershipCheck = null;
  let forwardRemove = null;
  let providerResult = null;
  const cdpCommandAudit = [];
  try {
    forwardCreate = requireSuccessfulCommand(
      await runBoundedProcess(adbExecutable, [
        ...serialArgs,
        'forward',
        'tcp:0',
        'localabstract:chrome_devtools_remote'
      ], { cwd: repoDir, deadlineAtMs: activeDeadlineAtMs }),
      'ADB Chrome DevTools forward'
    );
    forwardPort = Number(String(forwardCreate.stdout).trim());
    if (!positiveInteger(forwardPort)) {
      throw new Error('ADB did not return a valid local DevTools forward port');
    }
    const cdpOrigin = `http://127.0.0.1:${forwardPort}`;
    const cdpVersion = await fetchJson(`${cdpOrigin}/json/version`, {
      deadlineAtMs: activeDeadlineAtMs
    });
    records.push(jsonRecord({ id: 'cdp-version', runId, value: cdpVersion }));
    if (typeof cdpVersion.webSocketDebuggerUrl !== 'string') {
      throw new Error('existing Chrome did not expose its browser CDP endpoint');
    }
    browserClient = await openCdpClient(cdpVersion.webSocketDebuggerUrl, {
      clientKind: 'browser',
      targetCloseAuthority: () => createdTargetOwned ? targetId : null,
      commandAudit: cdpCommandAudit,
      deadlineAtMs: activeDeadlineAtMs
    });
    const targetSnapshotBefore = await browserClient.send('Target.getTargets');
    targetsBefore = (targetSnapshotBefore.targetInfos ?? []).map(
      ({ targetId: id, ...target }) => ({ id, ...target })
    );
    const created = await browserClient.send('Target.createTarget', {
      url: 'about:blank'
    });
    targetId = created.targetId;
    if (typeof targetId !== 'string' || targetId.length === 0) {
      throw new Error('CDP did not create a dedicated receipt target');
    }
    if (targetsBefore.some((target) => target.id === targetId)) {
      throw new Error('CDP returned a preexisting target as the receipt target');
    }
    createdTargetOwned = true;
    const createdInfo = await browserClient.send('Target.getTargetInfo', { targetId });
    createdTarget = {
      id: targetId,
      ...(createdInfo.targetInfo ?? {})
    };
    await browserClient.send('Target.activateTarget', { targetId });
    let pageTarget = null;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const pageTargets = await fetchJson(`${cdpOrigin}/json/list`, {
        deadlineAtMs: activeDeadlineAtMs
      });
      pageTarget = pageTargets.find((target) => target.id === targetId) ?? null;
      if (typeof pageTarget?.webSocketDebuggerUrl === 'string') break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (typeof pageTarget?.webSocketDebuggerUrl !== 'string') {
      throw new Error('created receipt target has no CDP WebSocket URL');
    }
    client = await openCdpClient(pageTarget.webSocketDebuggerUrl, {
      clientKind: 'page',
      commandAudit: cdpCommandAudit,
      deadlineAtMs: activeDeadlineAtMs
    });
    await Promise.all([
      client.send('Page.enable'),
      client.send('Runtime.enable'),
      client.send('Log.enable')
    ]);
    const consoleRows = [];
    let currentScenarioId = null;
    const pushConsole = (row) => consoleRows.push(Object.freeze({
      scenarioId: currentScenarioId,
      observedAt: new Date().toISOString(),
      ...row
    }));
    client.on('Runtime.consoleAPICalled', (params) => pushConsole({
      kind: 'console',
      level: params.type ?? null,
      text: (params.args ?? []).map(
        (arg) => arg.value == null ? String(arg.description ?? '') : String(arg.value)
      ).join(' ')
    }));
    client.on('Runtime.exceptionThrown', (params) => pushConsole({
      kind: 'exception',
      level: 'error',
      text: params.exceptionDetails?.exception?.description
        || params.exceptionDetails?.text
        || 'page exception'
    }));
    client.on('Log.entryAdded', ({ entry }) => pushConsole({
      kind: 'log',
      level: entry?.level ?? null,
      text: entry?.text ?? ''
    }));

    const scenarios = [];
    currentScenarioId = policy.scenarios[0].id;
    scenarios.push(await captureScenario({
      client,
      expected: policy.scenarios[0],
      consoleRows,
      policy
    }));
    const pageDevice = await pageDeviceEvidence(client);
    const servedSource = await servedSourceEvidence(
      client,
      policy,
      sourceManifest,
      runId,
      repoDir,
      artifactDir
    );
    currentScenarioId = policy.scenarios[1].id;
    scenarios.push(await captureScenario({
      client,
      expected: policy.scenarios[1],
      consoleRows,
      policy
    }));
    currentScenarioId = null;

    records.push(
      jsonRecord({ id: 'page-device', runId, value: pageDevice }),
      jsonRecord({ id: 'served-source', runId, value: servedSource }),
      jsonRecord({
        id: 'page-console',
        runId,
        value: Object.freeze({ events: Object.freeze([...consoleRows]) })
      }),
      jsonRecord({ id: 'sodium-water-sample', runId, value: scenarios[0] }),
      jsonRecord({ id: 'triple-water-sample', runId, value: scenarios[1] })
    );

    const properties = parseGetprop(getprop.result.stdout);
    const chromePackage = parseChromePackage(pmPath.stdout, packageDump.stdout);
    const cdpBrowserProduct = cdpVersion.Browser ?? null;
    const cdpChromeVersion = String(cdpBrowserProduct ?? '').match(
      /^Chrome\/(.+)$/u
    )?.[1] ?? null;
    providerResult = {
      captureProviderId: BUILTIN_CAPTURE_PROVIDER_ID,
      captureRunId: runId,
      provenance: {
        adb: {
          getState: getState.result.stdout.trim(),
          devicesRow,
          properties
        },
        browser: {
          packageName: policy.chromePackage,
          packagePath: chromePackage.packagePath,
          packageVersion: chromePackage.packageVersion,
          pid: pidsBefore[0],
          pidsBefore,
          attachedViaAdbForward: true,
          usedExistingChromeProcess: true,
          createdTarget: true,
          activatedOwnTarget: true,
          ownTargetId: targetId,
          ownTargetClosed: false,
          chromeForceStopped: false,
          chromeProcessTerminated: false,
          browserClosed: false,
          existingTargetsClosed: 0,
          unexpectedTargetsAdded: 0,
          cdpEmulationCommands: [],
          userAgentOverride: false,
          deviceMetricsOverride: false,
          touchEmulationOverride: false,
          cdpCommandAudit: null,
          cdpBrowserProduct,
          cdpChromeVersion,
          protocolVersion: cdpVersion['Protocol-Version'] ?? null,
          forward: {
            serial: devicesRow.serial,
            localPort: forwardPort,
            remote: 'localabstract:chrome_devtools_remote'
          },
          lifecycle: null
        },
        pageDevice
      },
      servedSource,
      pageConsole: Object.freeze({ events: Object.freeze([...consoleRows]) }),
      captureErrors: [],
      scenarios
    };
  } finally {
    const cleanupDeadlineAtMs = Math.min(
      Number(absoluteDeadlineAtMs),
      Date.now() + PHYSICAL_PIXEL_LIVENESS_LIMITS_MS.cleanup
    );
    client?.setDeadline(cleanupDeadlineAtMs);
    browserClient?.setDeadline(cleanupDeadlineAtMs);
    client?.close();
    if (browserClient && targetId != null && createdTargetOwned) {
      try {
        closeResponse = await browserClient.send('Target.closeTarget', { targetId });
        if (closeResponse?.success !== true) {
          throw new Error('CDP refused to close the owned receipt target');
        }
        for (let attempt = 0; attempt < 40; attempt += 1) {
          const targetSnapshotAfter = await browserClient.send('Target.getTargets');
          targetsAfter = (targetSnapshotAfter.targetInfos ?? []).map(
            ({ targetId: id, ...target }) => ({ id, ...target })
          );
          if (!targetsAfter.some((target) => target.id === targetId)) {
            ownTargetClosed = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
      } catch {
        ownTargetClosed = false;
      }
    }
    browserClient?.close();
    if (forwardPort != null) {
      forwardOwnershipCheck = requireSuccessfulCommand(
        await runBoundedProcess(adbExecutable, [
          ...serialArgs, 'forward', '--list'
        ], { cwd: repoDir, deadlineAtMs: cleanupDeadlineAtMs }),
        'ADB forward ownership check'
      );
      if (!forwardOwnershipMatches(forwardOwnershipCheck.stdout, {
        serial: devicesRow.serial,
        localPort: forwardPort,
        remote: 'localabstract:chrome_devtools_remote'
      })) {
        throw new Error(
          'ADB forward ownership changed before cleanup; refusing to remove a non-owned forward'
        );
      }
      forwardRemove = await runBoundedProcess(adbExecutable, [
        ...serialArgs, 'forward', '--remove', `tcp:${forwardPort}`
      ], { cwd: repoDir, deadlineAtMs: cleanupDeadlineAtMs });
    }
  }

  if (!providerResult) throw new Error('physical Pixel provider produced no result');
  const chromeProcessAfter = requireSuccessfulCommand(
    await runBoundedProcess(adbExecutable, [
      ...serialArgs, 'shell', 'pidof', policy.chromePackage
    ], { cwd: repoDir, deadlineAtMs: absoluteDeadlineAtMs }),
    'Chrome process after capture'
  );
  const pidsAfter = parseChromePids(chromeProcessAfter.stdout);
  const beforeIds = new Set(targetsBefore.map((target) => target.id));
  const afterIds = new Set(targetsAfter.map((target) => target.id));
  const existingTargetsClosed = [...beforeIds].filter((id) => !afterIds.has(id)).length;
  const unexpectedTargetIdsAdded = [...afterIds].filter((id) => !beforeIds.has(id));
  const lifecycle = Object.freeze({
    targetsBefore: Object.freeze(targetsBefore.map((target) => target.id)),
    createdTargetId: targetId,
    closeResponse,
    ownTargetClosed: Boolean(ownTargetClosed && !afterIds.has(targetId)),
    targetsAfter: Object.freeze(targetsAfter.map((target) => target.id)),
    existingTargetsClosed,
    unexpectedTargetIdsAdded: Object.freeze(unexpectedTargetIdsAdded),
    unexpectedTargetsAdded: unexpectedTargetIdsAdded.length,
    pidsBefore,
    pidsAfter
  });
  if (
    !lifecycle.ownTargetClosed
    || lifecycle.existingTargetsClosed !== 0
    || lifecycle.unexpectedTargetsAdded !== 0
    || !exactObject(pidsBefore, pidsAfter)
  ) {
    throw new Error('physical Pixel capture changed Chrome or preexisting targets');
  }
  requireSuccessfulCommand(forwardRemove, 'ADB forward cleanup');
  const finalizedCdpCommandAudit = Object.freeze([...cdpCommandAudit]);
  providerResult.provenance.browser.cdpCommandAudit = finalizedCdpCommandAudit;
  records.push(
    jsonRecord({
      id: 'chrome-process',
      runId,
      value: {
        before: commandRecord({
          id: 'chrome-process-before',
          runId,
          executable: adbExecutable,
          args: [...serialArgs, 'shell', 'pidof', policy.chromePackage],
          result: chromeProcessBefore
        }),
        after: commandRecord({
          id: 'chrome-process-after',
          runId,
          executable: adbExecutable,
          args: [...serialArgs, 'shell', 'pidof', policy.chromePackage],
          result: chromeProcessAfter
        })
      }
    }),
    jsonRecord({
      id: 'adb-forward',
      runId,
      value: {
        create: commandRecord({
          id: 'adb-forward-create',
          runId,
          executable: adbExecutable,
          args: [...serialArgs, 'forward', 'tcp:0', 'localabstract:chrome_devtools_remote'],
          result: forwardCreate
        }),
        ownershipCheck: commandRecord({
          id: 'adb-forward-ownership-check',
          runId,
          executable: adbExecutable,
          args: [...serialArgs, 'forward', '--list'],
          result: forwardOwnershipCheck
        }),
        remove: commandRecord({
          id: 'adb-forward-remove',
          runId,
          executable: adbExecutable,
          args: [...serialArgs, 'forward', '--remove', `tcp:${forwardPort}`],
          result: forwardRemove
        })
      }
    }),
    jsonRecord({
      id: 'target-lifecycle',
      runId,
      value: {
        targetsBefore,
        createdTarget,
        closeResponse,
        targetsAfter,
        cdpCommandAudit: finalizedCdpCommandAudit
      }
    })
  );
  providerResult.provenance.browser.ownTargetClosed = lifecycle.ownTargetClosed;
  providerResult.provenance.browser.existingTargetsClosed = existingTargetsClosed;
  providerResult.provenance.browser.unexpectedTargetsAdded =
    lifecycle.unexpectedTargetsAdded;
  providerResult.provenance.browser.lifecycle = lifecycle;
  providerResult.provenance.browser.pidsAfter = pidsAfter;
  const byId = new Map(records.map((record) => [record.id, record]));
  const orderedRecords = REQUIRED_RAW_ARTIFACT_IDS.map((id) => {
    const record = byId.get(id);
    if (!record) throw new Error(`physical Pixel raw record missing: ${id}`);
    return record;
  });
  providerResult.rawArtifacts = await writeRawRecords({
    artifactDir,
    repoDir,
    records: orderedRecords
  });
  return Object.freeze(providerResult);
}

export async function collectPhysicalPixelRawArtifactEvidence({
  evidence,
  repoDir = sourceRepoDir,
  artifactReadFixture = null
}) {
  const rows = Array.isArray(evidence?.rawArtifacts)
    ? evidence.rawArtifacts
    : [];
  if (rows.length !== REQUIRED_RAW_ARTIFACT_IDS.length) {
    throw new Error('physical Pixel raw artifact inventory is incomplete');
  }
  await assertArtifactPathsPairwiseDistinct({
    paths: rows.map((row, index) => ({
      path: row?.path,
      label: `physical Pixel raw artifact ${row?.id ?? index}`
    })),
    repoDir,
    label: 'physical Pixel raw artifacts'
  });
  const directories = [...new Set(rows.map((row) => (
    typeof row?.path === 'string'
      ? path.dirname(path.resolve(row.path))
      : null
  )))];
  if (directories.length !== 1 || directories[0] == null) {
    throw new Error('physical Pixel raw artifacts must share one directory');
  }
  const directory = await inspectPrivateArtifactDirectory({
    artifactDir: directories[0],
    repoDir,
    label: 'physical Pixel raw artifact directory'
  });
  const observed = [];
  for (const row of rows) {
    await assertPrivateArtifactDirectoryIdentity(directory, {
      repoDir,
      label: 'physical Pixel raw artifact directory'
    });
    const label = `physical Pixel ${row?.id ?? 'unknown'} raw artifact`;
    const before = await lstat(row?.path);
    assertPrivateOwnedRegularFile(before, label);
    if (!publicationIdentityMatches(row, before)) {
      throw new Error(`${label} publication identity mismatch`);
    }
    const artifact = await readHashedArtifact({
      artifactPath: row?.path,
      repoDir,
      label,
      includeBytes: true
    });
    await privateArtifactReadStep({
      fixture: artifactReadFixture,
      repoDir,
      step: 'after-read-before-stability-check',
      artifactPath: artifact.path,
      label
    });
    const after = await lstat(artifact.path);
    assertPrivateOwnedRegularFile(after, label);
    if (!sameFileIdentity(before, after)) {
      throw new Error(`${label} changed while reread`);
    }
    if (!publicationIdentityMatches(row, after)) {
      throw new Error(`${label} publication identity mismatch`);
    }
    await assertPrivateArtifactDirectoryIdentity(directory, {
      repoDir,
      label: 'physical Pixel raw artifact directory'
    });
    let record;
    try {
      record = JSON.parse(artifact.bytes.toString('utf8'));
    } catch {
      throw new Error(`physical Pixel ${row?.id ?? 'unknown'} raw artifact is not JSON`);
    }
    const resourceArtifacts = row?.id === 'served-source'
      ? await collectPhysicalPixelServedResourceArtifactEvidence({
        servedSource: record?.value,
        repoDir
      })
      : null;
    observed.push(Object.freeze({
      id: row?.id ?? null,
      ...metadataOnly(artifact),
      ...(Object.hasOwn(row ?? {}, 'publicationIdentity')
        ? { publicationIdentity: publicationIdentity(after) }
        : {}),
      record,
      ...(resourceArtifacts == null ? {} : { resourceArtifacts })
    }));
  }
  const resourceArtifactPaths = observed.flatMap((row) => (
    row.resourceArtifacts?.map((artifact, index) => ({
      path: artifact.path,
      label: `physical Pixel served resource ${artifact.url ?? index}`
    })) ?? []
  ));
  if (resourceArtifactPaths.length > 0) {
    await assertArtifactPathsPairwiseDistinct({
      paths: [
        ...rows.map((row, index) => ({
          path: row?.path,
          label: `physical Pixel raw artifact ${row?.id ?? index}`
        })),
        ...resourceArtifactPaths
      ],
      repoDir,
      label: 'physical Pixel raw and served-resource artifacts'
    });
  }
  return Object.freeze(observed);
}

async function collectPhysicalPixelServedResourceArtifactEvidence({
  servedSource,
  repoDir
}) {
  const resources = servedSource?.transformed?.resources;
  if (!Array.isArray(resources) || resources.length === 0) {
    throw new Error('physical Pixel served-resource artifact inventory is incomplete');
  }
  await assertArtifactPathsPairwiseDistinct({
    paths: resources.map((resource, index) => ({
      path: resource?.artifact?.path,
      label: `physical Pixel served resource ${resource?.url ?? index}`
    })),
    repoDir,
    label: 'physical Pixel served-resource artifacts'
  });
  const directories = [...new Set(resources.map((resource) => (
    typeof resource?.artifact?.path === 'string'
      ? path.dirname(path.resolve(resource.artifact.path))
      : null
  )))];
  if (directories.length !== 1 || directories[0] == null) {
    throw new Error('physical Pixel served-resource artifacts must share one directory');
  }
  const directory = await inspectPrivateArtifactDirectory({
    artifactDir: directories[0],
    repoDir,
    label: 'physical Pixel served-resource artifact directory'
  });
  const observed = [];
  for (const resource of resources) {
    await assertPrivateArtifactDirectoryIdentity(directory, {
      repoDir,
      label: 'physical Pixel served-resource artifact directory'
    });
    const before = await lstat(resource.artifact.path);
    assertPrivateOwnedRegularFile(
      before,
      `physical Pixel served resource ${resource?.url ?? 'unknown'}`
    );
    const artifact = await readHashedArtifact({
      artifactPath: resource?.artifact?.path,
      repoDir,
      label: `physical Pixel served resource ${resource?.url ?? 'unknown'}`,
      includeBytes: true
    });
    const after = await lstat(artifact.path);
    assertPrivateOwnedRegularFile(
      after,
      `physical Pixel served resource ${resource?.url ?? 'unknown'}`
    );
    if (!sameFileIdentity(before, after)) {
      throw new Error(`physical Pixel served resource ${resource?.url ?? 'unknown'} changed while reread`);
    }
    await assertPrivateArtifactDirectoryIdentity(directory, {
      repoDir,
      label: 'physical Pixel served-resource artifact directory'
    });
    observed.push(Object.freeze({
      url: resource?.url ?? null,
      ...metadataOnly(artifact),
      bytes: artifact.bytes
    }));
  }
  return Object.freeze(observed);
}

function rawArtifactsValid(stored, observed) {
  if (
    !Array.isArray(stored)
    || !Array.isArray(observed)
    || stored.length !== REQUIRED_RAW_ARTIFACT_IDS.length
    || observed.length !== REQUIRED_RAW_ARTIFACT_IDS.length
  ) {
    return false;
  }
  return REQUIRED_RAW_ARTIFACT_IDS.every((id, index) => (
    stored[index]?.id === id
    && observed[index]?.id === id
    && artifactMetadataMatches(stored[index], observed[index])
    && publicationIdentityMatches(stored[index], observed[index]?.publicationIdentity)
    && observed[index]?.record?.id === id
  ));
}

function rawCommandValid(record, {
  id,
  runId,
  expectedArgs = null
}) {
  const forbidden = /force-stop|am\s+kill|pkill|killall|Browser\.close|Emulation\./iu;
  return Boolean(
    record?.schema === RAW_COMMAND_SCHEMA
    && record?.id === id
    && record?.captureProviderId === BUILTIN_CAPTURE_PROVIDER_ID
    && record?.runId === runId
    && record?.executable === ADB_EXECUTABLE
    && Array.isArray(record?.args)
    && (expectedArgs == null || exactObject(record.args, expectedArgs))
    && record?.exitCode === 0
    && record?.signal == null
    && record?.spawnError == null
    && typeof record?.stdout === 'string'
    && typeof record?.stderr === 'string'
    && !forbidden.test(`${record.executable} ${record.args.join(' ')}`)
  );
}

function rawJsonValid(record, { id, runId }) {
  return Boolean(
    record?.schema === RAW_JSON_SCHEMA
    && record?.id === id
    && record?.captureProviderId === BUILTIN_CAPTURE_PROVIDER_ID
    && record?.runId === runId
    && Object.hasOwn(record, 'value')
  );
}

function rawEvidenceMatchesStructured(evidence, artifactEvidence, policy) {
  if (
    evidence?.captureProviderId !== BUILTIN_CAPTURE_PROVIDER_ID
    || typeof evidence?.captureRunId !== 'string'
    || evidence.captureRunId.length === 0
    || !Array.isArray(artifactEvidence)
  ) {
    return false;
  }
  const runId = evidence.captureRunId;
  const records = new Map(artifactEvidence.map((row) => [row.id, row.record]));
  if (records.size !== REQUIRED_RAW_ARTIFACT_IDS.length) return false;
  const serial = evidence?.provenance?.adb?.devicesRow?.serial;
  const serialArgs = ['-s', serial];
  const devices = records.get('adb-devices');
  const getState = records.get('adb-get-state');
  const getprop = records.get('adb-getprop');
  if (
    !rawCommandValid(devices, {
      id: 'adb-devices', runId, expectedArgs: ['devices', '-l']
    })
    || !rawCommandValid(getState, {
      id: 'adb-get-state', runId, expectedArgs: [...serialArgs, 'get-state']
    })
    || !rawCommandValid(getprop, {
      id: 'adb-getprop', runId, expectedArgs: [...serialArgs, 'shell', 'getprop']
    })
  ) {
    return false;
  }
  const parsedRow = parseAdbDevices(devices.stdout)
    .find((row) => row.serial === serial);
  if (
    !exactObject(parsedRow, evidence.provenance.adb.devicesRow)
    || getState.stdout.trim() !== evidence.provenance.adb.getState
    || !exactObject(parseGetprop(getprop.stdout), evidence.provenance.adb.properties)
  ) {
    return false;
  }

  const packageRecord = records.get('chrome-package');
  const packageValue = packageRecord?.value;
  if (
    !rawJsonValid(packageRecord, { id: 'chrome-package', runId })
    || !rawCommandValid(packageValue?.pmPath, {
      id: 'chrome-package-pm-path',
      runId,
      expectedArgs: [...serialArgs, 'shell', 'pm', 'path', policy.chromePackage]
    })
    || !rawCommandValid(packageValue?.dumpsys, {
      id: 'chrome-package-dumpsys',
      runId,
      expectedArgs: [...serialArgs, 'shell', 'dumpsys', 'package', policy.chromePackage]
    })
  ) {
    return false;
  }
  const parsedPackage = parseChromePackage(
    packageValue.pmPath.stdout,
    packageValue.dumpsys.stdout
  );
  if (
    parsedPackage.packagePath !== evidence.provenance.browser.packagePath
    || parsedPackage.packageVersion !== evidence.provenance.browser.packageVersion
  ) {
    return false;
  }

  const processRecord = records.get('chrome-process');
  const processValue = processRecord?.value;
  const processArgs = [...serialArgs, 'shell', 'pidof', policy.chromePackage];
  if (
    !rawJsonValid(processRecord, { id: 'chrome-process', runId })
    || !rawCommandValid(processValue?.before, {
      id: 'chrome-process-before', runId, expectedArgs: processArgs
    })
    || !rawCommandValid(processValue?.after, {
      id: 'chrome-process-after', runId, expectedArgs: processArgs
    })
  ) {
    return false;
  }
  const pidsBefore = parseChromePids(processValue.before.stdout);
  const pidsAfter = parseChromePids(processValue.after.stdout);
  if (
    !exactObject(pidsBefore, evidence.provenance.browser.pidsBefore)
    || !exactObject(pidsAfter, evidence.provenance.browser.pidsAfter)
    || !exactObject(pidsBefore, pidsAfter)
    || evidence.provenance.browser.pid !== pidsBefore[0]
  ) {
    return false;
  }

  const forwardRecord = records.get('adb-forward');
  const forwardValue = forwardRecord?.value;
  const localPort = evidence?.provenance?.browser?.forward?.localPort;
  if (
    !rawJsonValid(forwardRecord, { id: 'adb-forward', runId })
    || !rawCommandValid(forwardValue?.create, {
      id: 'adb-forward-create',
      runId,
      expectedArgs: [
        ...serialArgs, 'forward', 'tcp:0', 'localabstract:chrome_devtools_remote'
      ]
    })
    || !rawCommandValid(forwardValue?.ownershipCheck, {
      id: 'adb-forward-ownership-check',
      runId,
      expectedArgs: [...serialArgs, 'forward', '--list']
    })
    || !rawCommandValid(forwardValue?.remove, {
      id: 'adb-forward-remove',
      runId,
      expectedArgs: [...serialArgs, 'forward', '--remove', `tcp:${localPort}`]
    })
    || Number(forwardValue.create.stdout.trim()) !== localPort
    || !forwardOwnershipMatches(forwardValue.ownershipCheck.stdout, {
      serial,
      localPort,
      remote: 'localabstract:chrome_devtools_remote'
    })
    || evidence?.provenance?.browser?.forward?.serial !== serial
    || evidence?.provenance?.browser?.forward?.remote
      !== 'localabstract:chrome_devtools_remote'
  ) {
    return false;
  }

  const cdpVersion = records.get('cdp-version');
  const lifecycle = records.get('target-lifecycle');
  const pageDevice = records.get('page-device');
  const servedSource = records.get('served-source');
  const pageConsole = records.get('page-console');
  const sodiumSample = records.get('sodium-water-sample');
  const tripleSample = records.get('triple-water-sample');
  if (
    !rawJsonValid(cdpVersion, { id: 'cdp-version', runId })
    || !rawJsonValid(lifecycle, { id: 'target-lifecycle', runId })
    || !rawJsonValid(pageDevice, { id: 'page-device', runId })
    || !rawJsonValid(servedSource, { id: 'served-source', runId })
    || !rawJsonValid(pageConsole, { id: 'page-console', runId })
    || !rawJsonValid(sodiumSample, { id: 'sodium-water-sample', runId })
    || !rawJsonValid(tripleSample, { id: 'triple-water-sample', runId })
  ) {
    return false;
  }
  const rawTargetsBefore = Array.isArray(lifecycle.value?.targetsBefore)
    ? lifecycle.value.targetsBefore
    : [];
  const rawTargetsAfter = Array.isArray(lifecycle.value?.targetsAfter)
    ? lifecycle.value.targetsAfter
    : [];
  const rawBeforeIds = rawTargetsBefore.map((target) => target?.id);
  const rawAfterIds = rawTargetsAfter.map((target) => target?.id);
  const rawCreatedTargetId = lifecycle.value?.createdTarget?.id;
  const rawCdpCommandAudit = lifecycle.value?.cdpCommandAudit;
  const rawExistingTargetsClosed = rawBeforeIds.filter(
    (id) => !rawAfterIds.includes(id)
  ).length;
  const rawUnexpectedTargetIdsAdded = rawAfterIds.filter(
    (id) => !rawBeforeIds.includes(id)
  );
  const normalizedLifecycle = {
    targetsBefore: rawBeforeIds,
    createdTargetId: rawCreatedTargetId,
    closeResponse: lifecycle.value?.closeResponse ?? null,
    ownTargetClosed: Boolean(
      typeof rawCreatedTargetId === 'string'
      && rawCreatedTargetId.length > 0
      && !rawBeforeIds.includes(rawCreatedTargetId)
      && !rawAfterIds.includes(rawCreatedTargetId)
    ),
    targetsAfter: rawAfterIds,
    existingTargetsClosed: rawExistingTargetsClosed,
    unexpectedTargetIdsAdded: rawUnexpectedTargetIdsAdded,
    unexpectedTargetsAdded: rawUnexpectedTargetIdsAdded.length,
    pidsBefore,
    pidsAfter
  };
  const navigationUrls = Array.isArray(rawCdpCommandAudit)
    ? rawCdpCommandAudit
      .filter((row) => row.method === 'Page.navigate')
      .map((row) => row.url)
    : [];
  return Boolean(
    cdpVersion.value?.Browser === evidence.provenance.browser.cdpBrowserProduct
    && cdpVersion.value?.['Protocol-Version']
      === evidence.provenance.browser.protocolVersion
    && exactObject(normalizedLifecycle, evidence.provenance.browser.lifecycle)
    && exactObject(rawCdpCommandAudit, evidence.provenance.browser.cdpCommandAudit)
    && cdpCommandAuditValid(
      evidence.provenance.browser,
      policy,
      evidence.scenarios
    )
    && exactObject(navigationUrls, policy.scenarios.map((scenario) => scenario.url))
    && exactObject(pageDevice.value, evidence.provenance.pageDevice)
    && exactObject(servedSource.value, evidence.servedSource)
    && exactObject(pageConsole.value, evidence.pageConsole)
    && exactObject(sodiumSample.value, evidence.scenarios?.[0])
    && exactObject(tripleSample.value, evidence.scenarios?.[1])
  );
}

function physicalDeviceValid(provenance, policy) {
  const row = provenance?.adb?.devicesRow;
  const properties = provenance?.adb?.properties;
  const serial = String(row?.serial ?? '');
  const hardware = String(properties?.roHardware ?? '').toLowerCase();
  const usbTransport = row?.transport === 'usb'
    && typeof row?.usb === 'string'
    && row.usb.length > 0;
  const wirelessTransport = row?.transport === 'wireless-adb'
    && /^[^:\s]+:\d+$/u.test(serial)
    && typeof row?.transportId === 'string'
    && row.transportId.length > 0;
  return Boolean(
    provenance?.adb?.getState === 'device'
    && row?.state === 'device'
    && (usbTransport || wirelessTransport)
    && row?.product === 'caiman'
    && row?.model === 'Pixel_9_Pro'
    && row?.device === 'caiman'
    && serial.length > 0
    && !/^emulator-/u.test(serial)
    && properties?.roProductManufacturer === 'Google'
    && properties?.roProductBrand === 'google'
    && properties?.roProductModel === 'Pixel 9 Pro'
    && properties?.roProductDevice === 'caiman'
    && properties?.roProductName === 'caiman'
    && properties?.roKernelQemu === '0'
    && properties?.roBootQemu === '0'
    && properties?.roBuildFingerprint?.startsWith('google/caiman/caiman:')
    && properties?.roProductCpuAbi === 'arm64-v8a'
    && hardware === String(policy?.requiredDevice?.hardware ?? '').toLowerCase()
    && hardware === 'tensor'
  );
}

function cdpCommandAuditValid(browser, policy, scenarios) {
  const audit = browser?.cdpCommandAudit;
  if (!Array.isArray(audit) || audit.length === 0) return false;
  if (audit.some((row, index) => (
    !safeNonnegativeInteger(row?.sequence)
    || row.sequence !== index
    || (row?.client !== 'browser' && row?.client !== 'page')
    || typeof row?.method !== 'string'
    || !/^[0-9a-f]{64}$/u.test(row?.paramsSha256 ?? '')
    || !/^[0-9a-f]{64}$/u.test(row?.responseSha256 ?? '')
    || !CDP_ALLOWED_METHODS[row.client].has(row.method)
    || row?.responseStatus !== 'success'
  ))) {
    return false;
  }
  const createRows = audit.filter((row) => (
    row.client === 'browser' && row.method === 'Target.createTarget'
  ));
  const closeRows = audit.filter((row) => (
    row.client === 'browser' && row.method === 'Target.closeTarget'
  ));
  const activateRows = audit.filter((row) => (
    row.client === 'browser' && row.method === 'Target.activateTarget'
  ));
  const expectedScreenshotFrames = Array.isArray(scenarios)
    ? scenarios.flatMap((scenario) => (
        Array.isArray(scenario?.sample?.windows)
          ? scenario.sample.windows.flatMap((window) => [
              window?.beforeFrame,
              window?.afterFrame
            ])
          : []
      ))
    : [];
  const expectedScreenshotBindings = expectedScreenshotFrames.map((frame) => {
    const bytes = compositorFrameBytes(frame);
    return bytes == null ? null : {
      byteLength: bytes.byteLength,
      sha256: sha256Bytes(bytes)
    };
  });
  const screenshotRows = audit.map((row, auditIndex) => ({ row, auditIndex }))
    .filter(({ row }) => (
      row.client === 'page' && row.method === 'Page.captureScreenshot'
    ));
  const layoutMetricsRows = audit.map((row, auditIndex) => ({ row, auditIndex }))
    .filter(({ row }) => (
      row.client === 'page' && row.method === 'Page.getLayoutMetrics'
    ));
  const navigationRows = audit.map((row, auditIndex) => ({ row, auditIndex }))
    .filter(({ row }) => row.client === 'page' && row.method === 'Page.navigate');
  const closeIndex = audit.indexOf(closeRows[0]);
  const criticalCommandOrderValid = Boolean(
    audit[0]?.client === 'browser'
    && audit[0]?.method === 'Target.getTargets'
    && audit[0]?.paramsSha256 === canonicalJsonSha256({})
    && audit[1] === createRows[0]
    && audit[1]?.paramsSha256
      === canonicalJsonSha256({ url: 'about:blank' })
    && audit[2]?.client === 'browser'
    && audit[2]?.method === 'Target.getTargetInfo'
    && audit[2]?.targetId === browser?.ownTargetId
    && audit[2]?.paramsSha256 === canonicalJsonSha256({
      targetId: browser?.ownTargetId
    })
    && audit[3] === activateRows[0]
    && audit[3]?.targetId === browser?.ownTargetId
    && audit[3]?.paramsSha256 === canonicalJsonSha256({
      targetId: browser?.ownTargetId
    })
    && audit[4]?.client === 'page'
    && audit[4]?.method === 'Page.enable'
    && audit[4]?.paramsSha256 === canonicalJsonSha256({})
    && audit[5]?.client === 'page'
    && audit[5]?.method === 'Runtime.enable'
    && audit[5]?.paramsSha256 === canonicalJsonSha256({})
    && audit[6]?.client === 'page'
    && audit[6]?.method === 'Log.enable'
    && audit[6]?.paramsSha256 === canonicalJsonSha256({})
    && closeIndex > 6
    && audit.slice(4, closeIndex).every((row) => row.client === 'page')
    && audit.slice(closeIndex + 1).length > 0
    && audit.slice(closeIndex + 1).every((row) => (
      row.client === 'browser'
      && row.method === 'Target.getTargets'
      && row.paramsSha256 === canonicalJsonSha256({})
    ))
  );
  const expectedScreenshotCount = Number(policy?.scenarios?.length)
    * Number(policy?.compositorEvidence?.framePairsPerScenario)
    * 2;
  const screenshotAuditValid = Boolean(
    Number.isSafeInteger(expectedScreenshotCount)
    && expectedScreenshotCount > 0
    && expectedScreenshotFrames.length === expectedScreenshotCount
    && screenshotRows.length === expectedScreenshotCount
    && layoutMetricsRows.length === expectedScreenshotCount
    && screenshotRows.every(({ row }, index) => (
      row.targetId == null
      && row.url == null
      && row.paramsSha256
        === canonicalJsonSha256(expectedScreenshotFrames[index]?.captureParams)
      && row.responsePngByteLength
        === expectedScreenshotBindings[index]?.byteLength
      && row.responsePngSha256
        === expectedScreenshotBindings[index]?.sha256
      && row.responseSha256 === canonicalJsonSha256({
        data: expectedScreenshotFrames[index]?.pngBase64
      })
      && layoutMetricsRows[index]?.row?.targetId == null
      && layoutMetricsRows[index]?.row?.url == null
      && layoutMetricsRows[index]?.row?.paramsSha256 === canonicalJsonSha256({})
      && layoutMetricsRows[index]?.row?.responseSha256 === canonicalJsonSha256(
        expectedScreenshotFrames[index]?.layoutMetrics?.cdpResponse
      )
      && layoutMetricsRows[index].auditIndex < screenshotRows[index].auditIndex
      && (
        index === 0
        || layoutMetricsRows[index].auditIndex
          > screenshotRows[index - 1].auditIndex
      )
    ))
    && navigationRows.length === policy?.scenarios?.length
    && policy.scenarios.every((scenario, scenarioIndex) => {
      const navigation = navigationRows[scenarioIndex];
      const nextNavigation = navigationRows[scenarioIndex + 1];
      const scenarioScreenshotStart = scenarioIndex
        * Number(policy.compositorEvidence.framePairsPerScenario)
        * 2;
      const scenarioScreenshotEnd = scenarioScreenshotStart
        + Number(policy.compositorEvidence.framePairsPerScenario) * 2;
      return Boolean(
        navigation?.row?.url === scenario.url
        && navigation.row.paramsSha256
          === canonicalJsonSha256({ url: scenario.url })
        && screenshotRows.slice(
          scenarioScreenshotStart,
          scenarioScreenshotEnd
        ).every(({ auditIndex }) => (
          auditIndex > navigation.auditIndex
          && (nextNavigation == null || auditIndex < nextNavigation.auditIndex)
        ))
      );
    })
  );
  return Boolean(
    createRows.length === 1
    && createRows[0].url === 'about:blank'
    && closeRows.length === 1
    && activateRows.length === 1
    && closeRows[0].targetId === browser?.ownTargetId
    && closeRows[0].paramsSha256 === canonicalJsonSha256({
      targetId: browser?.ownTargetId
    })
    && criticalCommandOrderValid
    && screenshotAuditValid
    && audit.every((row) => (
      row.method !== 'Target.getTargetInfo' || row.targetId === browser?.ownTargetId
    ))
  );
}

function physicalBrowserValid(provenance, policy, scenarios) {
  const browser = provenance?.browser;
  const page = provenance?.pageDevice;
  const chromeMajor = String(browser?.packageVersion ?? '').split('.')[0];
  const cdpMajor = String(browser?.cdpChromeVersion ?? '').split('.')[0];
  return Boolean(
    browser?.packageName === 'com.android.chrome'
    && /^\/data\/app\//u.test(browser?.packagePath ?? '')
    && positiveInteger(browser?.pid)
    && browser?.attachedViaAdbForward === true
    && browser?.usedExistingChromeProcess === true
    && browser?.createdTarget === true
    && browser?.activatedOwnTarget === true
    && typeof browser?.ownTargetId === 'string'
    && browser.ownTargetId.length > 0
    && browser?.ownTargetClosed === true
    && browser?.chromeForceStopped === false
    && browser?.chromeProcessTerminated === false
    && browser?.browserClosed === false
    && browser?.existingTargetsClosed === 0
    && browser?.unexpectedTargetsAdded === 0
    && browser?.lifecycle?.createdTargetId === browser.ownTargetId
    && browser?.lifecycle?.closeResponse?.success === true
    && browser?.lifecycle?.ownTargetClosed === true
    && browser?.lifecycle?.existingTargetsClosed === 0
    && emptyArray(browser?.lifecycle?.unexpectedTargetIdsAdded)
    && browser?.lifecycle?.unexpectedTargetsAdded === 0
    && exactObject(browser?.lifecycle?.pidsBefore, browser?.lifecycle?.pidsAfter)
    && emptyArray(browser?.cdpEmulationCommands)
    && cdpCommandAuditValid(browser, policy, scenarios)
    && browser?.userAgentOverride === false
    && browser?.deviceMetricsOverride === false
    && browser?.touchEmulationOverride === false
    && /^Chrome\/\d+\./u.test(browser?.cdpBrowserProduct ?? '')
    && chromeMajor.length > 0
    && chromeMajor === cdpMajor
    && browser?.cdpBrowserProduct === `Chrome/${browser.cdpChromeVersion}`
    && browser?.protocolVersion != null
    && page?.userAgentData?.platform === 'Android'
    && page?.userAgentData?.mobile === true
    && page?.userAgentData?.model === 'Pixel 9 Pro'
    && /Android/u.test(page?.userAgent ?? '')
    && /Chrome\//u.test(page?.userAgent ?? '')
    && /^Linux armv8/u.test(page?.navigatorPlatform ?? '')
    && page?.navigatorWebdriver === false
    && positiveInteger(page?.maxTouchPoints)
    && page?.pointerCoarse === true
    && page?.hoverNone === true
    && page?.secureContext === true
    && page?.webgpuAdapterAvailable === true
    && page?.webgpuAdapterInfo?.isFallbackAdapter === false
  );
}

function sortedTransformedEdges(edges) {
  return [...edges].sort((left, right) => (
    left.from.localeCompare(right.from) || left.kind.localeCompare(right.kind)
      || left.to.localeCompare(right.to)
  ));
}

function transformedClosureValid(transformed, policy, resourceArtifactEvidence) {
  const resources = transformed?.resources;
  const roots = policy?.sourceModulePaths?.map(
    (sourcePath) => new URL(`/${sourcePath}`, policy.baseUrl).href
  ).sort();
  if (
    !Array.isArray(roots)
    || !exactObject(transformed?.roots, roots)
    || !Array.isArray(resources)
    || !Array.isArray(transformed?.edges)
    || !Array.isArray(resourceArtifactEvidence)
    || resourceArtifactEvidence.length !== resources.length
    || resources.length < roots.length
    || new Set(resources.map((row) => row?.url)).size !== resources.length
    || new Set(resourceArtifactEvidence.map((row) => row?.url)).size
      !== resourceArtifactEvidence.length
    || new Set(resourceArtifactEvidence.map((row) => path.resolve(row?.path ?? ''))).size
      !== resourceArtifactEvidence.length
  ) {
    return false;
  }
  const resourceUrls = new Set(resources.map((row) => row.url));
  if (!roots.every((root) => resourceUrls.has(root))) return false;
  const expectedGlobalEdges = [];
  for (const resource of resources) {
    let resourceUrl;
    try {
      resourceUrl = normalizedSameOriginViteUrl(resource?.url, policy.baseUrl);
    } catch {
      return false;
    }
    const artifactEvidence = resourceArtifactEvidence.find((row) => row.url === resource?.url);
    const bytes = artifactEvidence?.bytes;
    const local = resource?.local;
    if (
      resourceUrl.href !== resource?.url
      || !Buffer.isBuffer(bytes)
      || !Number.isSafeInteger(resource?.byteLength)
      || resource.byteLength !== bytes.byteLength
      || !/^[0-9a-f]{64}$/u.test(resource?.browserSha256 ?? '')
      || resource.browserSha256 !== sha256Bytes(bytes)
      || !artifactMetadataMatches(resource?.artifact, artifactEvidence)
      || typeof resource?.contentType !== 'string'
      || !Array.isArray(resource?.edgeKinds)
      || !Array.isArray(resource?.edges)
      || !['transformed-source', 'served-resource', 'vite-optimized-resource'].includes(resource?.comparison)
    ) return false;
    let expectedEdges;
    try {
      expectedEdges = viteStaticResourceEdges(bytes, resourceUrl.href, resource.contentType)
        .map((edge) => Object.freeze({
          kind: edge.kind,
          to: normalizedSameOriginViteUrl(edge.specifier, resourceUrl.href).href
        }))
        .sort((left, right) => (
          left.kind.localeCompare(right.kind) || left.to.localeCompare(right.to)
        ));
    } catch {
      return false;
    }
    if (!exactObject(resource.edges, expectedEdges)) return false;
    for (const edge of expectedEdges) {
      if (!resourceUrls.has(edge.to)) return false;
      expectedGlobalEdges.push(Object.freeze({
        from: resourceUrl.href,
        kind: edge.kind,
        to: edge.to
      }));
    }
    if (local == null) continue;
    if (
      typeof local.path !== 'string'
      || !Number.isSafeInteger(local.byteLength)
      || local.byteLength < 0
      || !/^[0-9a-f]{64}$/u.test(local.sha256 ?? '')
      || typeof local.browserBytesEqual !== 'boolean'
      || !/^[0-9a-f]{64}$/u.test(local.canonicalSha256 ?? '')
      || !/^[0-9a-f]{64}$/u.test(local.browserCanonicalSha256 ?? '')
      || typeof local.canonicalBytesEqual !== 'boolean'
      || (resource.comparison !== 'transformed-source' && local.canonicalBytesEqual !== true)
    ) return false;
  }
  const sortedExpectedGlobalEdges = sortedTransformedEdges(expectedGlobalEdges);
  if (!exactObject(transformed.edges, sortedExpectedGlobalEdges)) return false;
  const reachable = new Set(roots);
  const pending = [...roots];
  while (pending.length > 0) {
    const from = pending.shift();
    for (const edge of sortedExpectedGlobalEdges) {
      if (edge.from !== from || reachable.has(edge.to)) continue;
      reachable.add(edge.to);
      pending.push(edge.to);
    }
  }
  return reachable.size === resourceUrls.size;
}

function sourceBindingValid(
  servedSource,
  currentSourceManifest,
  policy,
  resourceArtifactEvidence
) {
  const currentModules = currentSourceManifest?.modules;
  const unresolvedBareSpecifiers = currentSourceManifest?.unresolvedBareSpecifiers;
  const currentManifestCore = sourceManifestCore(currentModules, unresolvedBareSpecifiers);
  const rawSourceParity = servedSource?.rawSourceParity;
  const observedModules = rawSourceParity?.modules;
  const transformed = servedSource?.transformed;
  const transformedResources = transformed?.resources;
  if (
    currentSourceManifest?.schema !== PHYSICAL_PIXEL_SOURCE_MANIFEST_SCHEMA
    || currentSourceManifest?.manifestSha256
      !== canonicalJsonSha256(currentManifestCore)
    || currentSourceManifest?.scope !== LOCAL_RELATIVE_SOURCE_SCOPE
    || !Array.isArray(unresolvedBareSpecifiers)
    || servedSource?.attestation !== SERVED_SOURCE_BINDING_ATTESTATION
    || servedSource?.scope !== VITE_TRANSFORMED_RESOURCE_SCOPE
    || servedSource?.baseUrl !== policy?.baseUrl
    || servedSource?.observedOrigin !== new URL(policy?.baseUrl).origin
    || rawSourceParity?.scope !== VITE_RAW_SOURCE_PARITY_SCOPE
    || rawSourceParity?.browserManifestSha256
      !== canonicalJsonSha256(sourceManifestCore(
        observedModules?.map((row) => ({
          path: row?.path,
          byteLength: row?.byteLength,
          sha256: row?.browserSha256
        })),
        unresolvedBareSpecifiers
      ))
    || rawSourceParity?.localManifestSha256
      !== currentSourceManifest?.manifestSha256
    || !Array.isArray(observedModules)
    || !Array.isArray(currentModules)
    || observedModules.length !== currentModules.length
    || transformed?.scope !== VITE_TRANSFORMED_RESOURCE_SCOPE
    || !Array.isArray(transformed?.roots)
    || !Array.isArray(transformedResources)
    || currentModules.length < policy?.sourceModulePaths?.length
    || new Set(currentModules.map((row) => row?.path)).size !== currentModules.length
    || !policy.sourceModulePaths.every((sourcePath) => (
      currentModules.some((row) => row?.path === sourcePath)
    ))
  ) {
    return false;
  }
  return currentModules.every((current, index) => {
    const observed = observedModules[index];
    return sourcePathIsSafe(current?.path)
      && Number.isSafeInteger(current?.byteLength)
      && current.byteLength > 0
      && /^[0-9a-f]{64}$/u.test(current?.sha256 ?? '')
      && observed?.path === current.path
      && observed?.byteLength === current.byteLength
      && observed?.localSha256 === current.sha256
      && observed?.browserSha256 === current.sha256;
  }) && transformedClosureValid(transformed, policy, resourceArtifactEvidence);
}

function telemetryValid(telemetry) {
  return Boolean(
    telemetry?.schema === TELEMETRY_SCHEMA
    && telemetry?.status === 'complete'
    && emptyArray(telemetry?.unknownFields)
    && exactObject(telemetry?.publicCounters, ZERO_READBACK_COUNTERS)
    && exactObject(telemetry?.observedCounters, ZERO_READBACK_COUNTERS)
    && telemetry?.normalHotLoopReadbackFree === true
    && telemetry?.fullParticleReadbackPerformed === false
    && telemetry?.fullParticleReadbackFree === true
    && telemetry?.residentContinuationReady === true
  );
}

function nativePresentationValid(presentation) {
  return Boolean(
    presentation?.rendererBackend === 'native-webgpu'
    && presentation?.surfaceDrawMode === 'native-webgpu-surface-consumer'
    && presentation?.nativeSurfaceDrawRequested === true
  );
}

function finiteRectangle(rectangle) {
  return Boolean(
    rectangle
    && Number.isFinite(rectangle.x)
    && Number.isFinite(rectangle.y)
    && finitePositive(rectangle.width)
    && finitePositive(rectangle.height)
  );
}

function rectangleContains(outer, inner, tolerance = 1e-6) {
  return Boolean(
    finiteRectangle(outer)
    && finiteRectangle(inner)
    && inner.x >= outer.x - tolerance
    && inner.y >= outer.y - tolerance
    && inner.x + inner.width <= outer.x + outer.width + tolerance
    && inner.y + inner.height <= outer.y + outer.height + tolerance
  );
}

function numbersNearlyEqual(left, right, tolerance = 1e-6) {
  return Number.isFinite(left)
    && Number.isFinite(right)
    && Math.abs(left - right) <= tolerance;
}

function expectedCenteredCanvasClip(canvas, policy) {
  const rect = canvas?.rect;
  const viewport = canvas?.viewport;
  if (!finiteRectangle(rect) || !finiteRectangle(viewport)) return null;
  const visibleLeft = Math.max(rect.x, viewport.x);
  const visibleTop = Math.max(rect.y, viewport.y);
  const visibleRight = Math.min(
    rect.x + rect.width,
    viewport.x + viewport.width
  );
  const visibleBottom = Math.min(
    rect.y + rect.height,
    viewport.y + viewport.height
  );
  const visibleWidth = visibleRight - visibleLeft;
  const visibleHeight = visibleBottom - visibleTop;
  if (!(visibleWidth > 0) || !(visibleHeight > 0)) return null;
  const width = Math.max(1, Math.min(
    visibleWidth * 0.6,
    Number(policy?.compositorEvidence?.maxCssWidth)
  ));
  const height = Math.max(1, Math.min(
    visibleHeight * 0.6,
    Number(policy?.compositorEvidence?.maxCssHeight)
  ));
  return {
    x: visibleLeft + (visibleWidth - width) / 2,
    y: visibleTop + (visibleHeight - height) / 2,
    width,
    height,
    scale: Number(policy?.compositorEvidence?.scale)
  };
}

function compositorFrameValid(frame, policy, expectedLabel, expectedUrl) {
  const cssVisualViewport = frame?.layoutMetrics?.cdpResponse?.cssVisualViewport;
  if (
    frame?.schema !== 'peercompute.ulg.physical-pixel-compositor-frame.v1'
    || frame?.status !== 'captured'
    || frame?.label !== expectedLabel
    || frame?.captureSource !== 'physical-chrome-compositor-surface'
    || typeof frame?.capturedAt !== 'string'
    || !Number.isFinite(Date.parse(frame.capturedAt))
    || frame?.layoutMetrics?.schema
      !== 'peercompute.ulg.physical-pixel-cdp-layout-metrics.v1'
    || !Number.isFinite(cssVisualViewport?.pageX)
    || !Number.isFinite(cssVisualViewport?.pageY)
    || !finitePositive(cssVisualViewport?.clientWidth)
    || !finitePositive(cssVisualViewport?.clientHeight)
    || cssVisualViewport?.scale !== 1
    || cssVisualViewport?.zoom !== 1
    || frame?.canvas?.schema
      !== 'peercompute.ulg.physical-pixel-native-canvas-clip.v1'
    || frame.canvas.rendererBridge !== 'native-webgpu-surface-consumer'
    || frame.canvas.sameAsBridgeCanvas !== true
    || frame.canvas.sameAsNativeConsumerCanvas !== true
    || !safeNonnegativeInteger(frame.canvas.canvasIndex)
    || !positiveInteger(frame.canvas.canvasCount)
    || frame.canvas.canvasIndex >= frame.canvas.canvasCount
    || !positiveInteger(frame.canvas.canvasBackingWidth)
    || !positiveInteger(frame.canvas.canvasBackingHeight)
    || !finitePositive(frame.canvas.devicePixelRatio)
    || frame.canvas.visualViewportScale
      !== policy?.compositorEvidence?.requiredVisualViewportScale
    || frame.canvas.documentUrl !== expectedUrl
    || frame.canvas.centerHitIncludesCanvas !== true
    || frame.canvas.style?.display === 'none'
    || frame.canvas.style?.visibility === 'hidden'
    || Number(frame.canvas.style?.opacity) !== 1
    || !finiteRectangle(frame.canvas.rect)
    || !finiteRectangle(frame.canvas.viewport)
    || !finiteRectangle(frame.canvas.clip)
    || !rectangleContains(frame.canvas.rect, frame.canvas.clip)
    || !rectangleContains(frame.canvas.viewport, frame.canvas.clip)
  ) {
    return false;
  }
  if (
    !numbersNearlyEqual(frame.canvas.viewport.x, cssVisualViewport.pageX, 1e-3)
    || !numbersNearlyEqual(frame.canvas.viewport.y, cssVisualViewport.pageY, 1e-3)
    || !numbersNearlyEqual(
      frame.canvas.viewport.width,
      cssVisualViewport.clientWidth,
      1e-3
    )
    || !numbersNearlyEqual(
      frame.canvas.viewport.height,
      cssVisualViewport.clientHeight,
      1e-3
    )
  ) {
    return false;
  }
  const expectedClip = expectedCenteredCanvasClip(frame.canvas, policy);
  if (
    expectedClip == null
    || !numbersNearlyEqual(frame.canvas.clip.x, expectedClip.x)
    || !numbersNearlyEqual(frame.canvas.clip.y, expectedClip.y)
    || !numbersNearlyEqual(frame.canvas.clip.width, expectedClip.width)
    || !numbersNearlyEqual(frame.canvas.clip.height, expectedClip.height)
    || !numbersNearlyEqual(frame.canvas.clip.scale, expectedClip.scale)
  ) {
    return false;
  }
  const expectedCaptureParams = {
    format: 'png',
    fromSurface: policy?.compositorEvidence?.fromSurface,
    captureBeyondViewport: policy?.compositorEvidence?.captureBeyondViewport,
    clip: {
      x: frame.canvas.clip.x,
      y: frame.canvas.clip.y,
      width: frame.canvas.clip.width,
      height: frame.canvas.clip.height,
      scale: policy?.compositorEvidence?.scale
    }
  };
  if (
    !exactObject(frame.captureParams, expectedCaptureParams)
    || frame.canvas.clip.width > policy?.compositorEvidence?.maxCssWidth + 1e-6
    || frame.canvas.clip.height > policy?.compositorEvidence?.maxCssHeight + 1e-6
  ) {
    return false;
  }
  const bytes = compositorFrameBytes(frame);
  if (!bytes) return false;
  const decoded = decodePhysicalPixelPng(bytes);
  if (decoded?.status !== 'ready') return false;
  const expectedPng = {
    byteLength: bytes.byteLength,
    sha256: sha256Bytes(bytes),
    ...publicPhysicalPixelPngMetrics(decoded)
  };
  const expectedPixelWidth = frame.canvas.clip.width
    * frame.captureParams.clip.scale;
  const expectedPixelHeight = frame.canvas.clip.height
    * frame.captureParams.clip.scale;
  const widthWithinCaptureBounds = Boolean(
    decoded.width >= Math.max(1, Math.floor(expectedPixelWidth))
    && decoded.width <= Math.ceil(expectedPixelWidth)
  );
  const heightWithinCaptureBounds = Boolean(
    decoded.height >= Math.max(1, Math.floor(expectedPixelHeight))
    && decoded.height <= Math.ceil(expectedPixelHeight)
  );
  return Boolean(
    exactObject(frame.png, expectedPng)
    && widthWithinCaptureBounds
    && heightWithinCaptureBounds
    && decoded.hasVisibleSurfaceContent === true
  );
}

function compositorWindowValid(window, policy, expectedUrl) {
  if (
    !compositorFrameValid(
      window?.beforeFrame,
      policy,
      'advancing-window-before',
      expectedUrl
    )
    || !compositorFrameValid(
      window?.afterFrame,
      policy,
      'advancing-window-after',
      expectedUrl
    )
    || !exactObject(window.beforeFrame.canvas, window.afterFrame.canvas)
    || !exactObject(
      window.beforeFrame.captureParams,
      window.afterFrame.captureParams
    )
    || Date.parse(window.beforeFrame.capturedAt)
      >= Date.parse(window.afterFrame.capturedAt)
  ) {
    return false;
  }
  const referenceBytes = compositorFrameBytes(window.beforeFrame);
  const candidateBytes = compositorFrameBytes(window.afterFrame);
  const expectedDelta = comparePhysicalPixelPngFrames(
    referenceBytes,
    candidateBytes,
    {
      minChannelDelta: policy?.compositorEvidence?.minChannelDelta,
      minChangedPixelCount:
        policy?.compositorEvidence?.minChangedPixelCount,
      minChangedPixelRatio:
        policy?.compositorEvidence?.minChangedPixelRatio,
      minChangedBoundsWidth:
        policy?.compositorEvidence?.minChangedBoundsWidth,
      minChangedBoundsHeight:
        policy?.compositorEvidence?.minChangedBoundsHeight
    }
  );
  return Boolean(
    expectedDelta.visibleContentAdvanced === true
    && exactObject(window.compositorDelta, expectedDelta)
  );
}

function snapshotWarningsValid(snapshot) {
  const messages = snapshot?.warningMessages;
  if (!Array.isArray(messages)) return false;
  if (messages.length === 0) return true;
  if (
    messages.length !== 1
    || messages[0] !== BENIGN_COMPACT_MOTION_WARNING
  ) {
    return false;
  }
  const motion = snapshot?.motionDiagnostic;
  return Boolean(
    motion?.schema === 'peercompute.ulg.sph-demo-resident-motion-diagnostic.v0'
    && motion.maxDisplacementM === null
    && (
      (
        motion.status === 'motion-unknown-no-compact-summary'
        && motion.compactGpuSummaryAvailable === false
      )
      || (
        motion.status === 'motion-unknown'
        && motion.compactGpuSummaryAvailable === true
      )
    )
  );
}

function liveWindowSnapshotValid(snapshot) {
  return Boolean(
    snapshot?.error == null
    && snapshot?.documentVisibility === 'visible'
    && snapshot?.documentHasFocus === true
    && typeof snapshot?.warningText === 'string'
    && snapshotWarningsValid(snapshot)
    && snapshot?.autoSchedule?.residentAuto === true
    && !String(snapshot?.autoSchedule?.status ?? '').startsWith('disabled')
    && nativePresentationValid(snapshot?.presentation)
    && telemetryValid(snapshot?.telemetry)
  );
}

function livenessValid(scenario, policy) {
  const windows = scenario?.sample?.windows;
  const validWindows = Array.isArray(windows)
    && windows.length === SAMPLE_WINDOW_COUNT
    && windows.every((window) => (
      windowAdvanced(window?.before, window?.after)
      && window.before?.documentUrl === scenario?.url
      && window.after?.documentUrl === scenario?.url
      && liveWindowSnapshotValid(window?.before)
      && liveWindowSnapshotValid(window?.after)
      && window?.animationFrameCount
        === window.after.frameCounter - window.before.frameCounter
      && window?.animationStepCount
        === window.after.nextStep - window.before.nextStep
      && positiveInteger(window?.animationFrameCount)
      && positiveInteger(window?.animationStepCount)
      && window?.renderFps === window.after.renderFps
      && finitePositive(window?.renderFps)
      && compositorWindowValid(window, policy, scenario?.url)
    ));
  const totalFrames = Array.isArray(windows)
    ? windows.reduce((sum, window) => sum + Number(window?.animationFrameCount ?? 0), 0)
    : null;
  const totalSteps = Array.isArray(windows)
    ? windows.reduce((sum, window) => sum + Number(window?.animationStepCount ?? 0), 0)
    : null;
  return Boolean(
    validWindows
    && exactObject(scenario?.sample?.before, windows[0].before)
    && exactObject(scenario?.sample?.after, windows.at(-1).after)
    && positiveInteger(scenario?.sample?.animationFrameCount)
    && scenario.sample.animationFrameCount === totalFrames
    && positiveInteger(scenario?.sample?.animationStepCount)
    && scenario.sample.animationStepCount === totalSteps
    && finitePositive(scenario?.sample?.renderFps)
    && scenario.sample.renderFps
      === Math.min(...windows.map((window) => window.renderFps))
    && scenario?.sample?.pageError == null
    && emptyArray(scenario?.sample?.consoleErrors)
    && emptyArray(scenario?.sample?.consoleWarnings)
    && emptyArray(scenario?.sample?.unhandledRejections)
    && scenario?.sample?.hotLoopWarningPresent === false
    && scenario?.autoSchedule?.residentAuto === true
    && !String(scenario?.autoSchedule?.status ?? '').startsWith('disabled')
    && nativePresentationValid(scenario?.presentation)
    && telemetryValid(scenario?.telemetry)
  );
}

function stackedBodyProofValid(proof) {
  const before = proof?.bodiesBefore;
  const after = proof?.bodiesAfter;
  if (
    !Array.isArray(before)
    || !Array.isArray(after)
    || before.length !== 2
    || after.length !== 3
    || before.some((body) => String(body?.material).toLowerCase() !== 'h2o')
    || after.some((body) => String(body?.material).toLowerCase() !== 'h2o')
  ) {
    return false;
  }
  const beforeIds = new Set(before.map((body) => body?.id));
  const added = after.filter((body) => !beforeIds.has(body?.id));
  if (beforeIds.size !== 2 || added.length !== 1) return false;
  if (before.some((body) => (
    !after.some((candidate) => canonicalJson(candidate) === canonicalJson(body))
  ))) {
    return false;
  }
  const template = before.at(-1);
  const addedBody = added[0];
  const pitch = Number(template?.sizeM?.[1])
    / Number(template?.particlesPerEdge?.[1]);
  const expectedY = Number(template?.centerM?.[1])
    + Number(template?.sizeM?.[1])
    + pitch;
  const tolerance = 1e-9;
  return Boolean(
    proof?.verticalStack === true
    && proof?.addedBodyId === addedBody?.id
    && finitePositive(pitch)
    && Math.abs(Number(proof?.verticalPitchM) - pitch) <= tolerance
    && Math.abs(Number(proof?.expectedAddedCenterY) - expectedY) <= tolerance
    && Math.abs(Number(addedBody?.centerM?.[0]) - Number(template?.centerM?.[0]))
      <= tolerance
    && Math.abs(Number(addedBody?.centerM?.[2]) - Number(template?.centerM?.[2]))
      <= tolerance
    && Math.abs(Number(addedBody?.centerM?.[1]) - expectedY) <= tolerance
    && Number(addedBody?.centerM?.[1]) > Number(template?.centerM?.[1])
  );
}

function scenarioMechanicsValid(scenario, expected) {
  if (scenario?.id !== expected?.id || scenario?.url !== expected?.url) {
    return false;
  }
  const mechanics = scenario?.mechanics;
  if (expected.id === 'sodium-water') {
    return Boolean(
      scenario?.interaction === 'observe-auto-animation'
      && mechanics?.p2gMode === 'field'
      && mechanics?.gridMode === 'field'
      && mechanics?.g2pMode === 'field'
      && finitePositive(mechanics?.productEventRowCapacity)
      && mechanics?.productEventCountAuthority
        === 'gpu-authored-filtered-live-prefix'
      && mechanics?.productEventCountHostKnown === false
      && mechanics?.productDispatchMode
        === 'gpu-authenticated-gas-only-no-mechanics-scatter'
      && mechanics?.productGridCouplingStatus
        === 'resident-product-mass-gas-only-certified-no-mechanics-p2g-scatter'
      && mechanics?.productCoupledEventCount === 0
      && mechanics?.productCoupledUnplacedMassKg === 0
      && mechanics?.ambient?.requested === true
      && mechanics?.ambient?.required === false
      && mechanics?.ambient?.skipReason
        === 'resident-product-mass-requires-dense-p2g-compatibility'
    );
  }
  return Boolean(
    scenario?.interaction
      === 'click-add-stacked-water-body-once-then-observe-auto-animation'
    && mechanics?.p2gMode === 'field'
    && mechanics?.gridMode === 'field'
    && mechanics?.g2pMode === 'field'
    && mechanics?.ambient?.requested === true
    && mechanics?.ambient?.required === true
    && mechanics?.ambient?.skipReason == null
    && scenario?.bodyProof?.h2oBodyCountBefore === 2
    && scenario?.bodyProof?.h2oBodyCountAfter === 3
    && stackedBodyProofValid(scenario?.bodyProof)
    && Number.isSafeInteger(scenario?.bodyProof?.rebuildGenerationBefore)
    && scenario?.bodyProof?.rebuildGenerationAfter
      > scenario.bodyProof.rebuildGenerationBefore
  );
}

export function evaluatePhysicalPixelEvidence(evidence, {
  expectedPolicy,
  currentFingerprint,
  currentSourceManifest,
  artifactEvidence
}) {
  const failures = [];
  const fail = (message) => failures.push(message);
  if (evidence?.schema !== PHYSICAL_PIXEL_EVIDENCE_SCHEMA) {
    fail('physical Pixel evidence schema mismatch');
  }
  if (evidence?.policyTrack !== SS_CONTAINED_POLICY_TRACK) {
    fail('physical Pixel policy track mismatch');
  }
  if (evidence?.status !== 'complete') fail('physical Pixel capture incomplete');
  if (
    evidence?.captureMode !== 'physical-adb-cdp'
    || evidence?.emulated !== false
    || evidence?.syntheticDeviceProfile !== false
    || evidence?.captureProviderId !== BUILTIN_CAPTURE_PROVIDER_ID
  ) {
    fail('physical Pixel provenance is emulated or synthetic');
  }
  if (
    !policyValid(expectedPolicy)
    || canonicalJson(evidence?.commandPolicy) !== canonicalJson(expectedPolicy)
  ) {
    fail('physical Pixel command policy mismatch');
  }
  if (!exactWorktreeFingerprintsEqual(
    evidence?.sourceFingerprintBefore,
    evidence?.sourceFingerprintAfter,
    currentFingerprint
  )) {
    fail('physical Pixel source fingerprint changed');
  }
  if (!rawArtifactsValid(evidence?.rawArtifacts, artifactEvidence)) {
    fail('physical Pixel raw artifacts are missing, reordered, or tampered');
  }
  if (!rawEvidenceMatchesStructured(evidence, artifactEvidence, expectedPolicy)) {
    fail('physical Pixel raw artifacts do not canonically prove the structured claims');
  }
  if (!physicalDeviceValid(evidence?.provenance, expectedPolicy)) {
    fail('physical Google Pixel 9 Pro ADB provenance invalid');
  }
  if (!physicalBrowserValid(
    evidence?.provenance,
    expectedPolicy,
    evidence?.scenarios
  )) {
    fail('physical Chrome/CDP provenance or no-interference policy invalid');
  }
  if (!sourceBindingValid(
    evidence?.servedSource,
    currentSourceManifest,
    expectedPolicy,
    artifactEvidence?.find((row) => row?.id === 'served-source')?.resourceArtifacts
  )) {
    fail('served Vite raw-text binding does not match the verified local-relative resource scope or has unresolved bare specifiers');
  }
  if (!emptyArray(evidence?.captureErrors)) {
    fail('physical Pixel capture reported errors');
  }
  const pageConsoleEvents = evidence?.pageConsole?.events;
  if (
    !Array.isArray(pageConsoleEvents)
    || pageConsoleEvents.some((entry) => (
      entry?.kind === 'exception'
      || entry?.level === 'error'
      || entry?.level === 'warning'
      || /hot loop is not fully GPU resident/iu.test(entry?.text ?? '')
    ))
  ) {
    fail('physical Pixel page console reported errors or warnings');
  }
  const scenarios = Array.isArray(evidence?.scenarios) ? evidence.scenarios : [];
  if (scenarios.length !== expectedPolicy?.scenarios?.length) {
    fail('physical Pixel scenario count mismatch');
  }
  for (let index = 0; index < (expectedPolicy?.scenarios?.length ?? 0); index += 1) {
    const scenario = scenarios[index];
    const expected = expectedPolicy.scenarios[index];
    if (!livenessValid(scenario, expectedPolicy)) {
      fail(`${expected.id} animation or GPU liveness invalid`);
    }
    if (!scenarioMechanicsValid(scenario, expected)) {
      fail(`${expected.id} mechanics or route proof invalid`);
    }
  }
  return Object.freeze({
    passed: failures.length === 0,
    failures: Object.freeze(failures),
    evidenceDigest: canonicalJsonSha256(evidence)
  });
}

function failedEvidence(reason) {
  return {
    schema: PHYSICAL_PIXEL_EVIDENCE_SCHEMA,
    policyTrack: SS_CONTAINED_POLICY_TRACK,
    status: 'failed',
    reason
  };
}

function failedReceipt(reason) {
  return {
    schema: PHYSICAL_PIXEL_RECEIPT_SCHEMA,
    policyTrack: SS_CONTAINED_POLICY_TRACK,
    status: 'failed',
    reason
  };
}

export async function capturePhysicalPixelMobileEvidence({
  outputPath,
  baseUrl,
  artifactDir,
  repoDir = sourceRepoDir,
  captureProvider = null,
  fingerprintProvider = exactWorktreeFingerprint,
  sourceManifestProvider = buildPhysicalPixelLocalSourceManifest
}) {
  const resolvedRepoDir = path.resolve(repoDir);
  if (typeof artifactDir !== 'string' || artifactDir.length === 0) {
    throw new TypeError('physical Pixel artifactDir must be a non-empty string');
  }
  const artifactDirectory = await preparePrivateArtifactDirectory({
    artifactDir,
    repoDir: resolvedRepoDir,
    label: 'physical Pixel capture artifact directory'
  });
  await assertArtifactPathsPairwiseDistinct({
    paths: [
      { path: outputPath, label: 'physical Pixel evidence output' },
      ...REQUIRED_RAW_ARTIFACT_IDS.map((id) => ({
        path: path.join(artifactDirectory.path, `${id}.json`),
        label: `physical Pixel ${id} artifact`
      }))
    ],
    repoDir: resolvedRepoDir,
    label: 'physical Pixel capture outputs'
  });
  const writer = await createFailSentinelWriter({
    outputPath,
    repoDir: resolvedRepoDir,
    sentinel: failedEvidence('physical Pixel capture did not complete'),
    label: 'physical Pixel evidence'
  });
  let policy = null;
  let before = null;
  try {
    // Fail before any device action when a raw publication target is occupied.
    // The fail sentinel remains the only evidence output in that case.
    for (const id of REQUIRED_RAW_ARTIFACT_IDS) {
      await assertPrivateArtifactTargetAbsent({
        artifactPath: path.join(artifactDirectory.path, `${id}.json`),
        label: `physical Pixel ${id} raw artifact`
      });
    }
    const injectedDependency = Boolean(
      captureProvider != null
      || fingerprintProvider !== exactWorktreeFingerprint
      || sourceManifestProvider !== buildPhysicalPixelLocalSourceManifest
    );
    if (injectedDependency) {
      throw new Error(
        'injected physical capture dependencies cannot emit authentic evidence'
      );
    }
    if (captureProvider != null && typeof captureProvider !== 'function') {
      throw new TypeError('captureProvider must be a function when supplied');
    }
    policy = createPhysicalPixelMobilePolicy({ baseUrl });
    const deadlines = resolvePhysicalPixelLivenessDeadlines(process.env);
    const captureStartedAtMs = Date.now();
    const activeDeadlineAtMs = captureStartedAtMs + deadlines.activeCapture;
    const absoluteDeadlineAtMs = captureStartedAtMs + deadlines.absolute;
    before = await fingerprintProvider(resolvedRepoDir);
    const sourceManifest = await sourceManifestProvider({ repoDir: resolvedRepoDir });
    const provider = captureProvider ?? capturePhysicalPixelWithAdbCdp;
    const providerResult = await provider(Object.freeze({
      policy,
      sourceManifest,
      repoDir: resolvedRepoDir,
      artifactDir: artifactDirectory.path,
      activeDeadlineAtMs,
      absoluteDeadlineAtMs
    }));
    if (!providerResult || typeof providerResult !== 'object') {
      throw new Error('physical capture provider returned no evidence');
    }
    const after = await fingerprintProvider(resolvedRepoDir);
    const provisional = {
      ...providerResult,
      schema: PHYSICAL_PIXEL_EVIDENCE_SCHEMA,
      policyTrack: SS_CONTAINED_POLICY_TRACK,
      status: 'complete',
      captureMode: !injectedDependency
        ? 'physical-adb-cdp'
        : 'synthetic-test-provider',
      emulated: !injectedDependency ? false : true,
      syntheticDeviceProfile: !injectedDependency ? false : true,
      commandPolicy: policy,
      sourceFingerprintBefore: before,
      sourceFingerprintAfter: after
    };
    const observedArtifacts = await collectPhysicalPixelRawArtifactEvidence({
      evidence: provisional,
      repoDir: resolvedRepoDir
    });
    provisional.rawArtifacts = observedArtifacts.map((row) => Object.freeze({
      id: row.id,
      ...metadataOnly(row),
      ...(Object.hasOwn(row, 'publicationIdentity')
        ? { publicationIdentity: row.publicationIdentity }
        : {})
    }));
    const evaluation = evaluatePhysicalPixelEvidence(provisional, {
      expectedPolicy: policy,
      currentFingerprint: after,
      currentSourceManifest: sourceManifest,
      artifactEvidence: observedArtifacts
    });
    const evidence = evaluation.passed
      ? provisional
      : {
          ...provisional,
          status: 'failed',
          reason: evaluation.failures.join('; ')
        };
    await writer.replace(evidence);
    return Object.freeze({
      evidencePath: writer.outputPath,
      evidence,
      evaluation
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const evidence = {
      ...failedEvidence(reason),
      commandPolicy: policy,
      sourceFingerprintBefore: before
    };
    await writer.replace(evidence);
    return Object.freeze({
      evidencePath: writer.outputPath,
      evidence,
      evaluation: Object.freeze({ passed: false, failures: [reason] })
    });
  }
}

async function readJsonArtifact({ artifactPath, repoDir, label }) {
  const artifact = await readHashedArtifact({
    artifactPath,
    repoDir,
    label,
    includeBytes: true
  });
  return Object.freeze({
    artifact: metadataOnly(artifact),
    json: JSON.parse(artifact.bytes.toString('utf8'))
  });
}

export async function readPhysicalPixelMobileLivenessArtifactEvidence({
  receipt,
  repoDir = sourceRepoDir
}) {
  const resolvedRepoDir = path.resolve(repoDir);
  const evidenceRead = await readJsonArtifact({
    artifactPath: receipt?.evidenceArtifact?.path,
    repoDir: resolvedRepoDir,
    label: 'physical Pixel evidence'
  });
  const evidence = evidenceRead.json;
  const expectedPolicy = createPhysicalPixelMobilePolicy({
    baseUrl: evidence?.commandPolicy?.baseUrl
  });
  const artifactEvidence = await collectPhysicalPixelRawArtifactEvidence({
    evidence,
    repoDir: resolvedRepoDir
  });
  return Object.freeze({
    evidenceArtifact: evidenceRead.artifact,
    evidence,
    expectedPolicy,
    artifactEvidence
  });
}

export function evaluatePhysicalPixelMobileLivenessReceipt(receipt, {
  evidenceArtifact,
  evidence,
  expectedPolicy,
  currentFingerprint,
  currentSourceManifest,
  artifactEvidence
}) {
  const failures = [];
  const fail = (message) => failures.push(message);
  if (receipt?.schema !== PHYSICAL_PIXEL_RECEIPT_SCHEMA) {
    fail('physical Pixel receipt schema mismatch');
  }
  if (receipt?.policyTrack !== SS_CONTAINED_POLICY_TRACK) {
    fail('physical Pixel receipt policy track mismatch');
  }
  if (receipt?.status !== 'complete') fail('physical Pixel receipt incomplete');
  if (!artifactMetadataMatches(receipt?.evidenceArtifact, evidenceArtifact)) {
    fail('physical Pixel receipt input artifact mismatch');
  }
  const evidenceEvaluation = evaluatePhysicalPixelEvidence(evidence, {
    expectedPolicy,
    currentFingerprint,
    currentSourceManifest,
    artifactEvidence
  });
  if (!evidenceEvaluation.passed) failures.push(...evidenceEvaluation.failures);
  if (
    receipt?.evidenceDigest !== evidenceEvaluation.evidenceDigest
    || receipt?.sourceManifestSha256 !== currentSourceManifest?.manifestSha256
    || receipt?.commandPolicySha256 !== expectedPolicy?.commandPolicySha256
    || !exactWorktreeFingerprintsEqual(
      receipt?.sourceFingerprint,
      evidence?.sourceFingerprintBefore,
      evidence?.sourceFingerprintAfter,
      currentFingerprint
    )
  ) {
    fail('physical Pixel receipt exact source binding mismatch');
  }
  return Object.freeze({
    passed: failures.length === 0,
    failures: Object.freeze(failures),
    evidenceEvaluation
  });
}

function priorCompletePhysicalReceiptBound({
  receipt,
  evidence,
  evidenceArtifact,
  expectedPolicy
}) {
  return Boolean(
    receipt
    && typeof receipt === 'object'
    && receipt.schema === PHYSICAL_PIXEL_RECEIPT_SCHEMA
    && receipt.policyTrack === expectedPolicy?.policyTrack
    && receipt.status === 'complete'
    && evidence?.schema === PHYSICAL_PIXEL_EVIDENCE_SCHEMA
    && evidence?.policyTrack === expectedPolicy?.policyTrack
    && evidence?.status === 'complete'
    && canonicalJson(evidence?.commandPolicy) === canonicalJson(expectedPolicy)
    && artifactMetadataMatches(receipt.evidenceArtifact, evidenceArtifact)
    && receipt.evidenceDigest === canonicalJsonSha256(evidence)
    && receipt.sourceManifestSha256 === evidence?.servedSource?.rawSourceParity?.localManifestSha256
    && receipt.commandPolicySha256 === expectedPolicy?.commandPolicySha256
    && exactWorktreeFingerprintsEqual(
      receipt.sourceFingerprint,
      evidence?.sourceFingerprintBefore,
      evidence?.sourceFingerprintAfter
    )
  );
}

async function validatedExistingPhysicalReceipt({
  receiptPath,
  repoDir,
  evidence,
  evidenceArtifact,
  expectedPolicy,
  currentFingerprint,
  currentSourceManifest,
  artifactEvidence
}) {
  let existing;
  try {
    existing = await readJsonArtifact({
      artifactPath: receiptPath,
      repoDir,
      label: 'physical Pixel existing receipt'
    });
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
  if (!priorCompletePhysicalReceiptBound({
    receipt: existing.json,
    evidence,
    evidenceArtifact,
    expectedPolicy
  })) {
    throw new Error('physical Pixel existing receipt is not a bound complete physical receipt');
  }
  const evaluation = evaluatePhysicalPixelMobileLivenessReceipt(existing.json, {
    evidenceArtifact,
    evidence,
    expectedPolicy,
    currentFingerprint,
    currentSourceManifest,
    artifactEvidence
  });
  if (!evaluation.passed) {
    throw new Error(
      'physical Pixel existing receipt is stale or no longer bound to current source: '
        + evaluation.failures.join('; ')
    );
  }
  const identity = await lstat(existing.artifact.path);
  assertPrivateOwnedRegularFile(identity, 'physical Pixel existing receipt');
  return Object.freeze({ dev: identity.dev, ino: identity.ino });
}

async function receiptPathExists(receiptPath) {
  try {
    await lstat(path.resolve(receiptPath));
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

export async function runPhysicalPixelMobileLivenessReceipt({
  evidencePath,
  receiptPath,
  repoDir = sourceRepoDir,
  fingerprintProvider = exactWorktreeFingerprint,
  sourceManifestProvider = buildPhysicalPixelLocalSourceManifest
}) {
  const resolvedRepoDir = path.resolve(repoDir);
  await assertArtifactPathsPairwiseDistinct({
    paths: [
      { path: evidencePath, label: 'physical Pixel evidence input' },
      { path: receiptPath, label: 'physical Pixel receipt output' }
    ],
    repoDir: resolvedRepoDir,
    label: 'physical Pixel finalization artifacts'
  });
  let existingReceiptIdentity = null;
  if (await receiptPathExists(receiptPath)) {
    const preliminaryEvidence = await readJsonArtifact({
      artifactPath: evidencePath,
      repoDir: resolvedRepoDir,
      label: 'physical Pixel evidence'
    });
    const preliminaryPolicy = createPhysicalPixelMobilePolicy({
      baseUrl: preliminaryEvidence.json?.commandPolicy?.baseUrl
    });
    const [currentFingerprint, currentSourceManifest, artifactEvidence] =
      await Promise.all([
        fingerprintProvider(resolvedRepoDir),
        sourceManifestProvider({ repoDir: resolvedRepoDir }),
        collectPhysicalPixelRawArtifactEvidence({
          evidence: preliminaryEvidence.json,
          repoDir: resolvedRepoDir
        })
      ]);
    existingReceiptIdentity = await validatedExistingPhysicalReceipt({
      receiptPath,
      repoDir: resolvedRepoDir,
      evidence: preliminaryEvidence.json,
      evidenceArtifact: preliminaryEvidence.artifact,
      expectedPolicy: preliminaryPolicy,
      currentFingerprint,
      currentSourceManifest,
      artifactEvidence
    });
  }
  // Re-finalization is intentionally narrow.  Only a complete receipt bound
  // to this exact evidence artifact and its capture policy may be replaced;
  // an arbitrary existing path remains a no-clobber rejection.
  const writer = await createFailSentinelWriter({
    outputPath: receiptPath,
    repoDir: resolvedRepoDir,
    sentinel: failedReceipt('physical Pixel receipt did not complete'),
    label: 'physical Pixel liveness receipt',
    ...(existingReceiptIdentity == null
      ? {}
      : { adoptExistingOutputIdentity: existingReceiptIdentity })
  });
  try {
    if (
      fingerprintProvider !== exactWorktreeFingerprint
      || sourceManifestProvider !== buildPhysicalPixelLocalSourceManifest
    ) {
      throw new Error(
        'injected physical finalization dependencies cannot emit an authentic receipt'
      );
    }
    const evidenceRead = await readJsonArtifact({
      artifactPath: evidencePath,
      repoDir: resolvedRepoDir,
      label: 'physical Pixel evidence'
    });
    const evidence = evidenceRead.json;
    const policy = createPhysicalPixelMobilePolicy({
      baseUrl: evidence?.commandPolicy?.baseUrl
    });
    const [currentFingerprint, sourceManifest, artifactEvidence] =
      await Promise.all([
        fingerprintProvider(resolvedRepoDir),
        sourceManifestProvider({ repoDir: resolvedRepoDir }),
        collectPhysicalPixelRawArtifactEvidence({
          evidence,
          repoDir: resolvedRepoDir
        })
      ]);
    const evidenceEvaluation = evaluatePhysicalPixelEvidence(evidence, {
      expectedPolicy: policy,
      currentFingerprint,
      currentSourceManifest: sourceManifest,
      artifactEvidence
    });
    const candidate = {
      schema: PHYSICAL_PIXEL_RECEIPT_SCHEMA,
      policyTrack: SS_CONTAINED_POLICY_TRACK,
      status: 'complete',
      evidenceArtifact: evidenceRead.artifact,
      evidenceDigest: evidenceEvaluation.evidenceDigest,
      sourceFingerprint: currentFingerprint,
      sourceManifestSha256: sourceManifest.manifestSha256,
      commandPolicySha256: policy.commandPolicySha256
    };
    const evaluation = evaluatePhysicalPixelMobileLivenessReceipt(candidate, {
      evidenceArtifact: evidenceRead.artifact,
      evidence,
      expectedPolicy: policy,
      currentFingerprint,
      currentSourceManifest: sourceManifest,
      artifactEvidence
    });
    const receipt = evaluation.passed
      ? candidate
      : { ...candidate, status: 'failed', reason: evaluation.failures.join('; ') };
    await writer.replace(receipt);
    return Object.freeze({ receiptPath: writer.outputPath, receipt, evaluation });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const receipt = failedReceipt(reason);
    await writer.replace(receipt);
    return Object.freeze({
      receiptPath: writer.outputPath,
      receipt,
      evaluation: Object.freeze({ passed: false, failures: [reason] })
    });
  }
}

export function physicalPixelMobileLivenessIccEvent({
  receipt,
  evaluation,
  receiptArtifact = null
}) {
  const passed = receipt?.status === 'complete' && evaluation?.passed === true;
  const status = passed ? 'PASS' : 'FAIL';
  return Object.freeze({
    kind: PHYSICAL_PIXEL_EVENT_KIND,
    name: PHYSICAL_PIXEL_EVENT_NAME,
    status,
    value: status,
    details: Object.freeze({
      authentic: passed,
      policyTrack: SS_CONTAINED_POLICY_TRACK,
      physicalDevice: passed ? 'Google Pixel 9 Pro (caiman)' : null,
      receiptPath: receiptArtifact?.path ?? null,
      receiptSha256: receiptArtifact?.sha256 ?? null,
      sourceFingerprint: receipt?.sourceFingerprint?.sourceFingerprint ?? null,
      sourceManifestSha256: receipt?.sourceManifestSha256 ?? null,
      sourceCoverage: VITE_TRANSFORMED_RESOURCE_SCOPE,
      sourceCoverageLimit: 'static literal Vite module/CSS/worker/new-URL edges only; excludes runtime-computed URLs, HTML/network discovery, and unreferenced worktree files',
      evaluatorFailures: evaluation?.failures ?? []
    }),
    snippet: passed
      ? 'A physical ADB-authenticated Pixel 9 Pro showed visible changing compositor pixels while sodium-water and triple-water advanced with a GPU-resident hot loop.'
      : 'Physical Pixel mobile liveness evidence was missing, stale, tampered, emulated, or failed GPU-residency checks.'
  });
}

async function main() {
  const mode = process.argv[2];
  if (mode === 'capture') {
    if (process.argv.length !== 6) {
      throw new Error(
        'Usage: node scripts/ss-physical-pixel-mobile-liveness-receipt.mjs '
        + 'capture <base-url> <physical-evidence.json> <artifact-directory>'
      );
    }
    const result = await capturePhysicalPixelMobileEvidence({
      baseUrl: process.argv[3],
      outputPath: process.argv[4],
      artifactDir: process.argv[5]
    });
    process.stdout.write(`${JSON.stringify({
      evidencePath: result.evidencePath,
      status: result.evidence.status,
      eligible: result.evaluation.passed,
      failures: result.evaluation.failures
    }, null, 2)}\n`);
    if (!result.evaluation.passed) process.exitCode = 1;
    return;
  }
  if (mode !== 'finalize' || process.argv.length !== 5) {
    throw new Error(
      'Usage: node scripts/ss-physical-pixel-mobile-liveness-receipt.mjs '
      + '<capture|finalize> ...\n'
      + '  capture <base-url> <physical-evidence.json> <artifact-directory>\n'
      + '  finalize <physical-evidence.json> <receipt.json>'
    );
  }
  const result = await runPhysicalPixelMobileLivenessReceipt({
    evidencePath: process.argv[3],
    receiptPath: process.argv[4]
  });
  process.stdout.write(`${JSON.stringify({
    receiptPath: result.receiptPath,
    status: result.receipt.status,
    eligible: result.evaluation.passed,
    failures: result.evaluation.failures
  }, null, 2)}\n`);
  if (!result.evaluation.passed) process.exitCode = 1;
}

const executedAsScript = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
  : false;
if (executedAsScript) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    process.exitCode = 2;
  });
}
