#!/usr/bin/env node

import { constants as fsConstants } from 'node:fs';
import {
  lstat,
  mkdir,
  open,
  readdir,
  realpath
} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { inflateSync } from 'node:zlib';

import {
  STANDARD_SCENARIOS,
  deterministicRandomPairScenarios,
  synthesizeStandardScenarioIssues
} from './sph-visual-sanity-matrix.mjs';
import {
  SS_CONTAINED_POLICY_TRACK,
  assertNonProductionFixtureCapability,
  artifactMetadataMatches,
  assertArtifactPathOutsideRepo,
  assertArtifactPathsPairwiseDistinct,
  canonicalJson,
  canonicalJsonSha256,
  createFailSentinelWriter,
  exactWorktreeFingerprint,
  exactWorktreeFingerprintsEqual,
  runProcessToArtifacts,
  sha256Bytes,
  scrubReleaseEvidenceChildEnvironment
} from './ss-release-evidence-common.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const sourceRepoDir = path.resolve(scriptDir, '..');

export const STANDARD_VISUAL_COMMAND_POLICY_SCHEMA =
  'peercompute.ulg.ss-standard-visual-matrix-command-policy.v1';
export const STANDARD_VISUAL_CAPTURE_SCHEMA =
  'peercompute.ulg.ss-standard-visual-matrix-capture.v1';
export const STANDARD_VISUAL_ARTIFACT_MANIFEST_SCHEMA =
  'peercompute.ulg.ss-standard-visual-matrix-artifact-manifest.v1';
export const STANDARD_VISUAL_REVIEW_SCHEMA =
  'peercompute.ulg.ss-standard-visual-matrix-human-review.v1';
export const STANDARD_VISUAL_RECEIPT_SCHEMA =
  'peercompute.ulg.ss-standard-visual-matrix-receipt.v1';
export const STANDARD_VISUAL_POLICY_ID =
  'ss-contained-standard-seven-scenario-human-reviewed-v3';
export const STANDARD_VISUAL_EVENT_KIND = 'ulg_sph_probe';
export const STANDARD_VISUAL_EVENT_NAME = 'standard_visual_matrix_passed';
export const STANDARD_VISUAL_REVIEW_ATTESTATION =
  'I personally inspected every PNG identified by this exact manifest and found every frame acceptable.';
export const STANDARD_VISUAL_SCENARIO_TIMEOUT_MS = 43_200_000;

const MATRIX_SUMMARY_SCHEMA = 'peercompute.ulg.sph-visual-sanity-matrix.v0';
const PROBE_SCHEMA = 'peercompute.ulg.sph-history-probe-result.v0';
const FRAME_ARTIFACTS_SCHEMA =
  'peercompute.ulg.sph-probe-visual-frame-artifacts.v0';
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const OUTPUT_ROOT_MARKER_SCHEMA =
  'peercompute.ulg.ss-standard-visual-output-root-marker.v1';
const BROWSER_LAUNCH_SCHEMA = 'peercompute.ulg.sph-probe-browser-launch.v0';
const LOCAL_VITE_ORIGIN_PATTERN = /^http:\/\/127\.0\.0\.1:(?:[1-9]\d{0,4})$/u;
const DEFAULT_RANDOM_SEED = '0x7a11d2026';
const DEFAULT_RANDOM_PAIR_COUNT = 3;
const DEFAULT_RUN_ID = 'standard-seven';
const EXPECTED_LABELS = Object.freeze([
  'standard-water-cycle',
  'standard-iron-ice-quench',
  'standard-sodium-water',
  'standard-cesium-fluorine',
  'random-elements-ba-pb',
  'random-elements-bk-lr',
  'random-elements-fr-fe'
]);
const STANDARD_VISUAL_REQUIRED_CHROMIUM_ARGS = Object.freeze([
  '--enable-unsafe-webgpu',
  '--use-angle=vulkan',
  '--enable-features=Vulkan,UseSkiaRenderer',
  '--ignore-gpu-blocklist',
  '--ozone-platform=x11',
  '--window-position=-10000,-10000',
  '--window-size=1280,800'
]);
const STANDARD_VISUAL_OWNED_CHROMIUM_ARGS = Object.freeze(
  STANDARD_VISUAL_REQUIRED_CHROMIUM_ARGS.slice(3)
);

async function resolveFixtureFingerprintProvider({
  repoDir,
  fixtureCapability,
  fingerprintProvider = exactWorktreeFingerprint,
  stabilityHook = null,
  label
}) {
  if (typeof fingerprintProvider !== 'function') {
    throw new TypeError(`${label} fingerprint provider must be a function`);
  }
  const fixtureSeamRequested = fingerprintProvider !== exactWorktreeFingerprint
    || stabilityHook != null;
  if (!fixtureSeamRequested) return fingerprintProvider;
  await assertNonProductionFixtureCapability({
    capability: fixtureCapability,
    repoDir,
    productionRepoDir: sourceRepoDir,
    label
  });
  return fingerprintProvider;
}

function metadataOnly(value) {
  return value == null ? null : Object.freeze({
    path: value.path,
    byteLength: value.byteLength,
    sha256: value.sha256
  });
}

function plainRecord(value) {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactZeroObject(value) {
  return plainRecord(value)
    && Object.values(value).every(
      (entry) => Number.isSafeInteger(entry) && entry === 0
    );
}

function safeNonnegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function numericCountMap(value) {
  return plainRecord(value)
    && Object.values(value).every(safeNonnegativeInteger);
}

function countMapTotal(value) {
  if (!numericCountMap(value)) return null;
  let total = 0;
  for (const count of Object.values(value)) {
    if (count > Number.MAX_SAFE_INTEGER - total) return null;
    total += count;
  }
  return total;
}

function countMapsEqual(left, right) {
  return numericCountMap(left)
    && numericCountMap(right)
    && canonicalJson(left) === canonicalJson(right);
}

function countStrings(values) {
  if (!Array.isArray(values) || values.some((value) => typeof value !== 'string')) {
    return null;
  }
  const counts = Object.create(null);
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

function countVisualSurfaceIssues(values) {
  if (
    !Array.isArray(values)
    || values.some((value) => !plainRecord(value) || typeof value.issue !== 'string')
  ) {
    return null;
  }
  return countStrings(values.map((value) => value.issue));
}

function withDefaultRandomEnvironment(callback) {
  const keys = [
    'ULG_VISUAL_MATRIX_RANDOM_PAIR_COUNT',
    'ULG_VISUAL_MATRIX_RANDOM_SEED'
  ];
  const prior = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  process.env.ULG_VISUAL_MATRIX_RANDOM_PAIR_COUNT =
    String(DEFAULT_RANDOM_PAIR_COUNT);
  process.env.ULG_VISUAL_MATRIX_RANDOM_SEED = DEFAULT_RANDOM_SEED;
  try {
    return callback();
  } finally {
    for (const key of keys) {
      if (prior[key] == null) delete process.env[key];
      else process.env[key] = prior[key];
    }
  }
}

export function standardVisualScenarioManifest() {
  const random = withDefaultRandomEnvironment(
    () => deterministicRandomPairScenarios()
  );
  const scenarios = [...STANDARD_SCENARIOS, ...random].map((scenario) => (
    Object.freeze({
      label: scenario.label,
      presetId: scenario.presetId ?? null,
      acceptanceTrack: scenario.acceptanceTrack ?? null,
      totalStepCount:
        scenario.workerSchedulePlan?.totalStepCount ?? null,
      randomPair: scenario.randomPair == null
        ? null
        : Object.freeze({ ...scenario.randomPair }),
      url: scenario.url,
      visualRendererMode: scenario.visualRendererMode,
      expectedMechanics: scenario.expectedMechanics ?? null
    })
  ));
  if (
    scenarios.length !== EXPECTED_LABELS.length
    || scenarios.some((entry, index) => entry.label !== EXPECTED_LABELS[index])
  ) {
    throw new Error('standard visual scenario inventory drifted');
  }
  return Object.freeze(scenarios);
}

function commandPolicyCore({ artifactDir, runId }) {
  const resolvedArtifactDir = path.resolve(artifactDir);
  const outputDirectory = path.join(resolvedArtifactDir, 'matrix');
  const outputRoot = path.join(outputDirectory, runId);
  return {
    schema: STANDARD_VISUAL_COMMAND_POLICY_SCHEMA,
    policyId: STANDARD_VISUAL_POLICY_ID,
    policyTrack: SS_CONTAINED_POLICY_TRACK,
    artifactDirectory: resolvedArtifactDir,
    outputDirectory,
    outputRoot,
    browserOwnership: Object.freeze({
      mode: 'owned-isolated-offscreen-x11-chrome',
      headless: false,
      presentationSurface: 'x11-offscreen-window',
      windowPosition: Object.freeze([-10000, -10000]),
      windowSize: Object.freeze([1280, 800]),
      executablePath: '/usr/bin/google-chrome',
      requiredArgs: STANDARD_VISUAL_REQUIRED_CHROMIUM_ARGS,
      closeScope: 'only-the-browser-launched-by-each-probe',
      userBrowserTerminationForbidden: true,
      localViteOrigin: 'http://127.0.0.1'
    }),
    runId,
    randomSeed: DEFAULT_RANDOM_SEED,
    randomPairCount: DEFAULT_RANDOM_PAIR_COUNT,
    unsetEnvironmentKeys: Object.freeze(['NODE_OPTIONS']),
    unsetEnvironmentPrefixes: Object.freeze([
      'ULG_VISUAL_MATRIX_',
      'ULG_PROBE_',
      'ULG_VITE_',
      'VITE_ULG_',
      'PLAYWRIGHT_'
    ]),
    scenarios: standardVisualScenarioManifest(),
    command: Object.freeze({
      executable: 'node',
      args: Object.freeze(['scripts/sph-visual-sanity-matrix.mjs']),
      environment: Object.freeze({
        ULG_VISUAL_MATRIX_STANDARD: '1',
        ULG_VISUAL_MATRIX_CAPTURE_FRAMES: '1',
        ULG_VISUAL_MATRIX_RANDOM_PAIR_COUNT:
          String(DEFAULT_RANDOM_PAIR_COUNT),
        ULG_VISUAL_MATRIX_RANDOM_SEED: DEFAULT_RANDOM_SEED,
        ULG_VISUAL_MATRIX_ALLOW_FAILURES: '0',
        ULG_VISUAL_MATRIX_MOBILE: '0',
        ULG_VISUAL_MATRIX_VIEWPORT_WIDTH: '1280',
        ULG_VISUAL_MATRIX_VIEWPORT_HEIGHT: '800',
        ULG_VISUAL_MATRIX_FRAME_EVERY: '1',
        ULG_VISUAL_MATRIX_FRAME_MAX: '16',
        // This is only a wall-clock allowance. Every scenario's explicit
        // acceptance track and step horizon are sealed into the policy
        // manifest above; the separately runnable scientific-calibration arm
        // is not part of this seven-scenario release receipt.
        ULG_VISUAL_MATRIX_TIMEOUT_MS:
          String(STANDARD_VISUAL_SCENARIO_TIMEOUT_MS),
        ULG_VISUAL_MATRIX_DURABLE_RELEASE_PUBLICATION: '1',
        ULG_VISUAL_MATRIX_OUTPUT_DIR: outputDirectory,
        ULG_VISUAL_MATRIX_RUN_ID: runId,
        // The standard matrix validates presented pixels, not merely WebGPU
        // submission telemetry. Chrome's Linux headless Vulkan compositor can
        // fail surface creation while compute continues, so use an isolated
        // off-screen X11 window with the full visual viewport.
        ULG_PROBE_HEADLESS: '0',
        ULG_PROBE_CHROMIUM_EXECUTABLE: '/usr/bin/google-chrome',
        ULG_PROBE_CHROMIUM_ARGS:
          STANDARD_VISUAL_OWNED_CHROMIUM_ARGS.join(' '),
        ULG_VITE_HTTPS: '0'
      })
    })
  };
}

export function createStandardVisualCommandPolicy({
  artifactDir,
  runId = DEFAULT_RUN_ID
}) {
  if (typeof artifactDir !== 'string' || artifactDir.length === 0) {
    throw new TypeError('artifactDir must be a non-empty string');
  }
  if (!/^[a-z0-9][a-z0-9-]*$/u.test(runId)) {
    throw new Error('visual receipt runId is malformed');
  }
  const core = commandPolicyCore({ artifactDir, runId });
  return Object.freeze({
    ...core,
    commandPolicySha256: canonicalJsonSha256(core)
  });
}

function commandPolicyValid(policy) {
  if (!policy || typeof policy !== 'object') return false;
  let expected;
  try {
    expected = createStandardVisualCommandPolicy({
      artifactDir: policy.artifactDirectory,
      runId: policy.runId
    });
  } catch {
    return false;
  }
  return canonicalJson(policy) === canonicalJson(expected);
}

function pngSignatureValid(bytes) {
  return Buffer.isBuffer(bytes)
    && bytes.byteLength >= PNG_SIGNATURE.byteLength
    && bytes.subarray(0, PNG_SIGNATURE.byteLength).equals(PNG_SIGNATURE);
}

function pngCrc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function paethPredictor(left, up, upLeft) {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);
  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) return left;
  return upDistance <= upLeftDistance ? up : upLeft;
}

/**
 * Independently decodes a conservative, non-interlaced 8-bit PNG subset.
 * The probe's JSON metrics are advisory; acceptance derives from these bytes.
 */
export function decodeStandardVisualPng(bytes) {
  if (!pngSignatureValid(bytes) || bytes.byteLength < 45) {
    return Object.freeze({ status: 'invalid', reason: 'not-a-complete-png' });
  }
  let offset = PNG_SIGNATURE.byteLength;
  let ihdr = null;
  let sawIend = false;
  let sawIdat = false;
  let idatClosed = false;
  const idatChunks = [];
  try {
    while (offset < bytes.byteLength) {
      if (offset + 12 > bytes.byteLength) {
        return Object.freeze({ status: 'invalid', reason: 'truncated-png-chunk' });
      }
      const length = bytes.readUInt32BE(offset);
      const typeBytes = bytes.subarray(offset + 4, offset + 8);
      const dataStart = offset + 8;
      const dataEnd = dataStart + length;
      if (dataEnd + 4 > bytes.byteLength) {
        return Object.freeze({ status: 'invalid', reason: 'truncated-png-chunk-data' });
      }
      const data = bytes.subarray(dataStart, dataEnd);
      if (bytes.readUInt32BE(dataEnd) !== pngCrc32(Buffer.concat([typeBytes, data]))) {
        return Object.freeze({ status: 'invalid', reason: 'png-crc-mismatch' });
      }
      const type = typeBytes.toString('ascii');
      if (!/^[A-Za-z]{4}$/u.test(type)) {
        return Object.freeze({ status: 'invalid', reason: 'png-chunk-type-invalid' });
      }
      if (ihdr == null) {
        if (type !== 'IHDR' || length !== 13) {
          return Object.freeze({ status: 'invalid', reason: 'png-ihdr-missing-or-misordered' });
        }
        ihdr = {
          width: data.readUInt32BE(0),
          height: data.readUInt32BE(4),
          bitDepth: data[8],
          colorType: data[9],
          compression: data[10],
          filter: data[11],
          interlace: data[12]
        };
      } else if (type === 'IHDR') {
        return Object.freeze({ status: 'invalid', reason: 'png-ihdr-repeated' });
      } else if (type === 'IDAT') {
        if (idatClosed) {
          return Object.freeze({ status: 'invalid', reason: 'png-idat-not-contiguous' });
        }
        sawIdat = true;
        idatChunks.push(data);
      } else if (type === 'IEND') {
        if (length !== 0 || sawIend) return Object.freeze({ status: 'invalid', reason: 'png-iend-invalid' });
        sawIend = true;
        offset = dataEnd + 4;
        if (offset !== bytes.byteLength) {
          return Object.freeze({ status: 'invalid', reason: 'png-data-after-iend' });
        }
        break;
      } else {
        if ((typeBytes[0] & 0x20) === 0) {
          return Object.freeze({ status: 'invalid', reason: 'png-unknown-critical-chunk' });
        }
        if (sawIdat) idatClosed = true;
      }
      offset = dataEnd + 4;
    }
    if (!sawIend || offset !== bytes.byteLength || ihdr == null) {
      return Object.freeze({ status: 'invalid', reason: 'png-iend-missing-or-trailing-data' });
    }
    const channels = new Map([[0, 1], [2, 3], [4, 2], [6, 4]]).get(ihdr.colorType);
    if (
      !Number.isSafeInteger(ihdr.width) || !Number.isSafeInteger(ihdr.height)
      || ihdr.width <= 0 || ihdr.height <= 0
      || ihdr.width > 4096 || ihdr.height > 4096
      || ihdr.bitDepth !== 8 || channels == null
      || ihdr.compression !== 0 || ihdr.filter !== 0 || ihdr.interlace !== 0
      || idatChunks.length === 0
    ) {
      return Object.freeze({ status: 'invalid', reason: 'png-layout-unsupported' });
    }
    const rowBytes = ihdr.width * channels;
    const expectedLength = (rowBytes + 1) * ihdr.height;
    const compressed = Buffer.concat(idatChunks);
    const inflatedResult = inflateSync(compressed, {
      info: true,
      maxOutputLength: expectedLength
    });
    const inflated = inflatedResult.buffer;
    if (inflatedResult.engine?.bytesWritten !== compressed.byteLength) {
      return Object.freeze({ status: 'invalid', reason: 'png-idat-trailing-compressed-bytes' });
    }
    if (inflated.byteLength !== expectedLength) {
      return Object.freeze({ status: 'invalid', reason: 'png-inflated-length-mismatch' });
    }
    let previous = Buffer.alloc(rowBytes);
    let visiblePixels = 0;
    let nontransparentPixels = 0;
    let minimum = 255;
    let maximum = 0;
    const colors = new Set();
    for (let y = 0; y < ihdr.height; y += 1) {
      const rowOffset = y * (rowBytes + 1);
      const filter = inflated[rowOffset];
      if (filter > 4) return Object.freeze({ status: 'invalid', reason: 'png-filter-unsupported' });
      const source = inflated.subarray(rowOffset + 1, rowOffset + 1 + rowBytes);
      const row = Buffer.alloc(rowBytes);
      for (let x = 0; x < rowBytes; x += 1) {
        const left = x >= channels ? row[x - channels] : 0;
        const up = previous[x] ?? 0;
        const upLeft = x >= channels ? previous[x - channels] ?? 0 : 0;
        const predictor = filter === 1 ? left
          : filter === 2 ? up
            : filter === 3 ? Math.floor((left + up) / 2)
              : filter === 4 ? paethPredictor(left, up, upLeft) : 0;
        row[x] = (source[x] + predictor) & 0xff;
      }
      for (let x = 0; x < ihdr.width; x += 1) {
        const pixel = x * channels;
        const r = row[pixel];
        const g = ihdr.colorType === 0 || ihdr.colorType === 4 ? r : row[pixel + 1];
        const b = ihdr.colorType === 0 || ihdr.colorType === 4 ? r : row[pixel + 2];
        const alpha = ihdr.colorType === 4 ? row[pixel + 1]
          : ihdr.colorType === 6 ? row[pixel + 3] : 255;
        if (alpha > 0) nontransparentPixels += 1;
        if (alpha > 0 && (r > 0 || g > 0 || b > 0)) visiblePixels += 1;
        minimum = Math.min(minimum, r, g, b);
        maximum = Math.max(maximum, r, g, b);
        if (colors.size < 4096) colors.add(`${r},${g},${b},${alpha}`);
      }
      previous = row;
    }
    const pixelCount = ihdr.width * ihdr.height;
    const channelSpan = maximum - minimum;
    return Object.freeze({
      status: 'ready',
      width: ihdr.width,
      height: ihdr.height,
      colorType: ihdr.colorType,
      pixelCount,
      visiblePixels,
      nontransparentPixels,
      channelSpan,
      distinctColorCount: colors.size,
      hasVisiblePixels: visiblePixels > 0 && nontransparentPixels > 0,
      hasSurfaceLikeVariation: channelSpan >= 8 || colors.size >= 4
    });
  } catch (error) {
    return Object.freeze({
      status: 'invalid',
      reason: error instanceof Error ? error.message : String(error)
    });
  }
}

function outputRootMarker(policy) {
  const core = {
    schema: OUTPUT_ROOT_MARKER_SCHEMA,
    policyId: policy.policyId,
    commandPolicySha256: policy.commandPolicySha256,
    outputRoot: policy.outputRoot
  };
  return Object.freeze({ ...core, markerSha256: canonicalJsonSha256(core) });
}

function pathInside(candidate, root) {
  const relative = path.relative(root, candidate);
  return relative === ''
    || (!relative.startsWith(`..${path.sep}`) && relative !== '..'
      && !path.isAbsolute(relative));
}

function stableIdentity(stat) {
  return Object.freeze({
    dev: stat.dev,
    ino: stat.ino,
    mode: stat.mode,
    uid: stat.uid,
    gid: stat.gid,
    nlink: stat.nlink,
    isDirectory: stat.isDirectory(),
    isFile: stat.isFile(),
    isSymbolicLink: stat.isSymbolicLink()
  });
}

function stableIdentityEqual(left, right) {
  return Boolean(
    left
    && right
    && left.dev === right.dev
    && left.ino === right.ino
    && left.mode === right.mode
    && left.uid === right.uid
    && left.gid === right.gid
    && left.isDirectory === right.isDirectory
    && left.isFile === right.isFile
    && left.isSymbolicLink === right.isSymbolicLink
    // Directory link counts legitimately change as the owned child process
    // creates frame directories.  File link counts do not: enforcing one
    // rejects hardlink substitution while dev/ino/realpath still bind every
    // directory snapshot.
    && (left.isDirectory || left.nlink === right.nlink)
  );
}

async function snapshotRealDirectory(directoryPath, label, { privateOwner = false } = {}) {
  const resolvedPath = path.resolve(directoryPath);
  const stat = await lstat(resolvedPath);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(`${label} must be a real non-symlink directory`);
  }
  if (
    privateOwner
    && (
      stat.uid !== process.getuid?.()
      || (stat.mode & 0o077) !== 0
    )
  ) {
    throw new Error(`${label} must be private and owned by this process user`);
  }
  return Object.freeze({
    path: resolvedPath,
    canonicalPath: await realpath(resolvedPath),
    identity: stableIdentity(stat),
    // Preserve the access-control requirement with the snapshot.  A later
    // recheck must not silently downgrade a run root to an ordinary directory
    // merely because it still has the same inode.
    privateOwner: Boolean(privateOwner)
  });
}

async function assertStableDirectory(snapshot, label) {
  // Node exposes no portable directory-descriptor-relative openat/rename API.
  // We therefore cannot make a hostile same-uid pathname race impossible; the
  // strongest available guarantee is to bind every sensitive phase to lstat
  // dev/ino/mode/owner plus canonical realpath and fail closed on any detected
  // substitution.  Callers take one snapshot before the subprocess/write and
  // recheck it before and after all evidence reads.
  const observed = await snapshotRealDirectory(snapshot.path, label, {
    privateOwner: snapshot.privateOwner === true
  });
  if (
    !stableIdentityEqual(snapshot.identity, observed.identity)
    || snapshot.canonicalPath !== observed.canonicalPath
  ) {
    throw new Error(`${label} identity changed during evidence operation`);
  }
  return observed;
}

async function readStableContainedArtifact({
  artifactPath,
  root,
  repoDir,
  label,
  includeBytes = false
}) {
  const resolvedPath = path.resolve(artifactPath);
  await assertStableDirectory(root, `${label} root`);
  if (!pathInside(resolvedPath, root.path)) {
    throw new Error(`${label} escaped its stable evidence root`);
  }
  await assertArtifactPathOutsideRepo({ artifactPath: resolvedPath, repoDir, label });
  const before = await lstat(resolvedPath);
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1) {
    throw new Error(`${label} must be an unlinked regular non-symlink file`);
  }
  const canonicalPath = await realpath(resolvedPath);
  if (!pathInside(canonicalPath, root.canonicalPath)) {
    throw new Error(`${label} escaped its stable evidence root through a symlink`);
  }
  const beforeIdentity = stableIdentity(before);
  const handle = await open(resolvedPath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
  let bytes;
  try {
    const opened = await handle.stat();
    if (!stableIdentityEqual(beforeIdentity, stableIdentity(opened))) {
      throw new Error(`${label} changed before it could be read`);
    }
    bytes = await handle.readFile();
    const afterRead = await handle.stat();
    if (!stableIdentityEqual(beforeIdentity, stableIdentity(afterRead))) {
      throw new Error(`${label} changed while it was read`);
    }
  } finally {
    await handle.close();
  }
  const after = await lstat(resolvedPath);
  if (!stableIdentityEqual(beforeIdentity, stableIdentity(after))) {
    throw new Error(`${label} changed after it was read`);
  }
  await assertStableDirectory(root, `${label} root`);
  return Object.freeze({
    path: resolvedPath,
    byteLength: bytes.byteLength,
    sha256: sha256Bytes(bytes),
    identity: beforeIdentity,
    ...(includeBytes ? { bytes } : {})
  });
}

async function readStableJsonArtifact({ artifactPath, repoDir, label }) {
  const parent = await snapshotRealDirectory(path.dirname(path.resolve(artifactPath)), `${label} parent`);
  const artifact = await readStableContainedArtifact({
    artifactPath,
    root: parent,
    repoDir,
    label,
    includeBytes: true
  });
  return Object.freeze({
    artifact: metadataOnly(artifact),
    identity: artifact.identity,
    json: JSON.parse(artifact.bytes.toString('utf8'))
  });
}

async function invokeNonProductionStabilityHook({ hook, repoDir, stage, context }) {
  if (typeof hook !== 'function') return;
  const [canonicalRepoDir, canonicalSourceRepoDir] = await Promise.all([
    realpath(path.resolve(repoDir)),
    realpath(sourceRepoDir)
  ]);
  if (canonicalRepoDir === canonicalSourceRepoDir) {
    throw new Error('stability test hook cannot target the source repository');
  }
  await hook(Object.freeze({ stage, ...context }));
}

async function createStableEvidenceWriter(options) {
  const writer = await createFailSentinelWriter(options);
  const parent = await snapshotRealDirectory(
    path.dirname(writer.outputPath),
    `${options.label} parent`
  );
  return Object.freeze({
    outputPath: writer.outputPath,
    replacementCount: writer.replacementCount,
    async replace(value) {
      await assertStableDirectory(parent, `${options.label} parent`);
      const result = await writer.replace(value);
      await assertStableDirectory(parent, `${options.label} parent`);
      return result;
    }
  });
}

async function assertRealDirectory(directoryPath, label) {
  const stat = await lstat(directoryPath);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(`${label} must be a real non-symlink directory`);
  }
  return realpath(directoryPath);
}

async function guardVisualOutputRoot({ policy, repoDir, create = false }) {
  const outputMarkerPath = path.join(
    policy.outputRoot,
    '.standard-visual-output-root-marker.json'
  );
  await assertArtifactPathOutsideRepo({
    artifactPath: outputMarkerPath,
    repoDir,
    label: 'standard visual output root marker'
  });
  await mkdir(policy.artifactDirectory, { recursive: true, mode: 0o700 });
  const canonicalArtifactDirectory = await assertRealDirectory(
    policy.artifactDirectory,
    'standard visual artifact directory'
  );
  await mkdir(policy.outputDirectory, { recursive: true, mode: 0o700 });
  const canonicalOutputDirectory = await assertRealDirectory(
    policy.outputDirectory,
    'standard visual output directory'
  );
  if (
    canonicalOutputDirectory !== path.join(canonicalArtifactDirectory, 'matrix')
    || !pathInside(canonicalOutputDirectory, canonicalArtifactDirectory)
  ) {
    throw new Error('standard visual output directory escaped the artifact root');
  }
  if (create) {
    // A capture never reuses a named run root.  This makes the process-owned
    // root an ownership boundary instead of trusting a caller-prepared path.
    await mkdir(policy.outputRoot, { recursive: false, mode: 0o700 });
  }
  const outputRootSnapshot = await snapshotRealDirectory(
    policy.outputRoot,
    'standard visual output root',
    // A named run root is always a private, process-owned boundary.  This is
    // required both when capture creates it and whenever finalization or an
    // evidence reread reopens it.
    { privateOwner: true }
  );
  const canonicalOutputRoot = outputRootSnapshot.canonicalPath;
  if (
    canonicalOutputRoot !== path.join(canonicalOutputDirectory, policy.runId)
    || !pathInside(canonicalOutputRoot, canonicalArtifactDirectory)
  ) {
    throw new Error('standard visual output root escaped the artifact root');
  }
  const marker = outputRootMarker(policy);
  if (create) {
    const markerHandle = await open(
      outputMarkerPath,
      fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_NOFOLLOW,
      0o600
    );
    try {
      await markerHandle.writeFile(`${JSON.stringify(marker, null, 2)}\n`);
      await markerHandle.sync();
    } finally {
      await markerHandle.close();
    }
  }
  const observedMarker = await readStableContainedArtifact({
    artifactPath: outputMarkerPath,
    root: outputRootSnapshot,
    repoDir,
    label: 'standard visual output root marker',
    includeBytes: true
  });
  const observedMarkerJson = JSON.parse(observedMarker.bytes.toString('utf8'));
  if (canonicalJson(observedMarkerJson) !== canonicalJson(marker)) {
    throw new Error('standard visual output root marker verification failed');
  }
  const artifactDirectorySnapshot = await snapshotRealDirectory(
    policy.artifactDirectory,
    'standard visual artifact directory'
  );
  const outputDirectorySnapshot = await snapshotRealDirectory(
    policy.outputDirectory,
    'standard visual output directory'
  );
  await assertStableDirectory(outputRootSnapshot, 'standard visual output root');
  return Object.freeze({
    markerPath: outputMarkerPath,
    marker: metadataOnly(observedMarker),
    canonicalArtifactDirectory,
    canonicalOutputRoot,
    artifactDirectorySnapshot,
    outputDirectorySnapshot,
    outputRootSnapshot
  });
}

function scenarioUrlWithProbeDefaults(value) {
  const raw = String(value ?? '');
  if (!raw.startsWith('/') || raw.startsWith('//')) return null;
  let parsed;
  try {
    parsed = new URL(raw, 'http://ulg.invalid');
  } catch {
    return null;
  }
  if (parsed.origin !== 'http://ulg.invalid' || parsed.pathname !== '/' || parsed.hash) {
    return null;
  }
  if (!parsed.searchParams.has('visualCapture')) {
    parsed.searchParams.set('visualCapture', '1');
  }
  if (!parsed.searchParams.has('residentAuto')) {
    parsed.searchParams.set('residentAuto', '0');
  }
  return `${parsed.pathname}${parsed.search}`;
}

function ownedLocalProbeEvidenceValid({ probe, expectedScenario, policy, repoDir }) {
  const expectedScenarioUrl = scenarioUrlWithProbeDefaults(expectedScenario?.url);
  const observedScenarioUrl = scenarioUrlWithProbeDefaults(probe?.scenarioUrl);
  const launch = probe?.browserLaunch;
  const browser = policy?.browserOwnership;
  return Boolean(
    expectedScenarioUrl
    && observedScenarioUrl === expectedScenarioUrl
    && probe?.repoDir === path.resolve(repoDir)
    && probe?.probeMode === 'scene'
    && typeof probe?.baseUrl === 'string'
    && LOCAL_VITE_ORIGIN_PATTERN.test(probe.baseUrl)
    && launch?.schema === BROWSER_LAUNCH_SCHEMA
    && launch?.headless === browser?.headless
    && launch?.channel == null
    && launch?.executablePath === browser?.executablePath
    && Array.isArray(launch?.args)
    && browser?.requiredArgs?.every((arg) => launch.args.includes(arg))
  );
}

export async function collectStandardVisualArtifactEvidence({
  policy,
  stdoutArtifact,
  stderrArtifact,
  repoDir = sourceRepoDir
}) {
  if (!commandPolicyValid(policy)) {
    throw new Error('cannot collect artifacts for a malformed visual policy');
  }
  const guardedRoot = await guardVisualOutputRoot({ policy, repoDir, create: false });
  const [stdout, stderr] = await Promise.all([
    readStableContainedArtifact({
      artifactPath: stdoutArtifact?.path,
      root: guardedRoot.artifactDirectorySnapshot,
      repoDir,
      label: 'standard visual matrix stdout'
    }),
    readStableContainedArtifact({
      artifactPath: stderrArtifact?.path,
      root: guardedRoot.artifactDirectorySnapshot,
      repoDir,
      label: 'standard visual matrix stderr'
    })
  ]);
  const summaryPath = path.join(policy.outputRoot, 'summary.json');
  const summaryArtifact = await readStableContainedArtifact({
    artifactPath: summaryPath,
    root: guardedRoot.outputRootSnapshot,
    repoDir,
    label: 'standard visual matrix summary',
    includeBytes: true
  });
  const summary = Object.freeze({
    metadata: metadataOnly(summaryArtifact),
    json: JSON.parse(summaryArtifact.bytes.toString('utf8'))
  });
  const outputRootMarkerPath = path.join(
    policy.outputRoot,
    '.standard-visual-output-root-marker.json'
  );
  const outputRootMarkerArtifact = await readStableContainedArtifact({
    artifactPath: outputRootMarkerPath,
    root: guardedRoot.outputRootSnapshot,
    repoDir,
    label: 'standard visual output root marker',
    includeBytes: true
  });
  const outputRootMarker = Object.freeze({
    metadata: metadataOnly(outputRootMarkerArtifact),
    json: JSON.parse(outputRootMarkerArtifact.bytes.toString('utf8'))
  });
  const scenarios = [];
  for (const expected of policy.scenarios) {
    const probePath = path.join(policy.outputRoot, `${expected.label}.json`);
    const logPath = path.join(policy.outputRoot, `${expected.label}.log`);
    const frameDir = path.join(policy.outputRoot, `${expected.label}-frames`);
    const frameDirectorySnapshot = await snapshotRealDirectory(
      frameDir,
      `${expected.label} frame directory`
    );
    const probeArtifact = await readStableContainedArtifact({
      artifactPath: probePath,
      root: guardedRoot.outputRootSnapshot,
      repoDir,
      label: `${expected.label} probe`,
      includeBytes: true
    });
    const probe = Object.freeze({
      metadata: metadataOnly(probeArtifact),
      json: JSON.parse(probeArtifact.bytes.toString('utf8'))
    });
    const log = await readStableContainedArtifact({
      artifactPath: logPath,
      root: guardedRoot.outputRootSnapshot,
      repoDir,
      label: `${expected.label} log`
    });
    const frameRows = Array.isArray(probe.json?.visualFrameArtifacts?.frames)
      ? probe.json.visualFrameArtifacts.frames
      : [];
    const frames = [];
    for (let index = 0; index < frameRows.length; index += 1) {
      const row = frameRows[index];
      const expectedPath = path.join(
        frameDir,
        path.basename(String(row?.path ?? ''))
      );
      const frameArtifact = await readStableContainedArtifact({
        artifactPath: expectedPath,
        root: frameDirectorySnapshot,
        repoDir,
        label: `${expected.label} frame ${index}`,
        includeBytes: true
      });
      const frame = Object.freeze({
        ...metadataOnly(frameArtifact),
        png: decodeStandardVisualPng(frameArtifact.bytes)
      });
      frames.push(Object.freeze({
        scenarioLabel: expected.label,
        frameIndex: index,
        sourceRow: row,
        artifact: frame
      }));
    }
    const directoryEntries = (await readdir(frameDir)).sort();
    await assertStableDirectory(frameDirectorySnapshot, `${expected.label} frame directory`);
    scenarios.push(Object.freeze({
      expected,
      probe,
      log: metadataOnly(log),
      frameDir,
      directoryEntries: Object.freeze(directoryEntries),
      frames: Object.freeze(frames)
    }));
  }
  await Promise.all([
    assertStableDirectory(guardedRoot.artifactDirectorySnapshot, 'standard visual artifact directory'),
    assertStableDirectory(guardedRoot.outputDirectorySnapshot, 'standard visual output directory'),
    assertStableDirectory(guardedRoot.outputRootSnapshot, 'standard visual output root')
  ]);
  return Object.freeze({
    repoDir: path.resolve(repoDir),
    stdout: metadataOnly(stdout),
    stderr: metadataOnly(stderr),
    summary,
    outputRootMarker,
    scenarios: Object.freeze(scenarios)
  });
}

export function standardVisualArtifactManifestFromEvidence(evidence) {
  const core = {
    schema: STANDARD_VISUAL_ARTIFACT_MANIFEST_SCHEMA,
    stdout: evidence?.stdout ?? null,
    stderr: evidence?.stderr ?? null,
    summary: evidence?.summary?.metadata ?? null,
    outputRootMarker: evidence?.outputRootMarker?.metadata ?? null,
    scenarios: (evidence?.scenarios ?? []).map((scenario) => ({
      label: scenario.expected?.label ?? null,
      probe: scenario.probe?.metadata ?? null,
      log: scenario.log ?? null,
      frames: (scenario.frames ?? []).map((frame) => ({
        scenarioLabel: frame.scenarioLabel,
        frameIndex: frame.frameIndex,
        path: frame.artifact?.path ?? null,
        byteLength: frame.artifact?.byteLength ?? null,
        sha256: frame.artifact?.sha256 ?? null
      }))
    }))
  };
  return Object.freeze({
    ...core,
    manifestSha256: canonicalJsonSha256(core)
  });
}

function arraysEqual(left, right) {
  return Array.isArray(left)
    && Array.isArray(right)
    && left.length === right.length
    && left.every((entry, index) => entry === right[index]);
}

function expectedFrameFileNames(scenario) {
  return scenario.frames
    .map((frame) => path.basename(frame.artifact.path))
    .sort();
}

export function evaluateStandardVisualCapture(
  capture,
  {
    expectedPolicy,
    currentFingerprint,
    artifactEvidence
  }
) {
  const failures = [];
  const fail = (message) => failures.push(message);
  if (capture?.schema !== STANDARD_VISUAL_CAPTURE_SCHEMA) {
    fail('capture schema mismatch');
  }
  if (capture?.policyTrack !== SS_CONTAINED_POLICY_TRACK) {
    fail('policy track mismatch');
  }
  if (capture?.status !== 'complete') fail('capture did not complete');
  if (
    !commandPolicyValid(expectedPolicy)
    || canonicalJson(capture?.commandPolicy) !== canonicalJson(expectedPolicy)
  ) {
    fail('visual command policy mismatch');
  }
  if (
    !exactWorktreeFingerprintsEqual(
      capture?.sourceFingerprintBefore,
      capture?.sourceFingerprintAfter,
      currentFingerprint
    )
  ) {
    fail('exact worktree fingerprint changed');
  }
  if (
    capture?.command?.invocationSha256
      !== canonicalJsonSha256(expectedPolicy?.command)
  ) {
    fail('visual command invocation mismatch');
  }
  if (
    capture?.command?.exitCode !== 0
    || capture?.command?.signal != null
    || capture?.command?.spawnError != null
  ) {
    fail('visual matrix command failed');
  }
  if (
    !artifactMetadataMatches(
      capture?.command?.stdoutArtifact,
      artifactEvidence?.stdout
    )
    || !artifactMetadataMatches(
      capture?.command?.stderrArtifact,
      artifactEvidence?.stderr
    )
  ) {
    fail('visual command stream artifact mismatch');
  }
  const observedManifest = standardVisualArtifactManifestFromEvidence(
    artifactEvidence
  );
  if (
    canonicalJson(capture?.artifactManifest)
      !== canonicalJson(observedManifest)
    || capture?.captureManifestSha256 !== observedManifest.manifestSha256
  ) {
    fail('visual artifact manifest mismatch');
  }

  const summary = artifactEvidence?.summary?.json;
  const marker = artifactEvidence?.outputRootMarker;
  if (
    canonicalJson(marker?.json) !== canonicalJson(outputRootMarker(expectedPolicy))
    || marker?.metadata?.path !== path.join(
      expectedPolicy?.outputRoot ?? '',
      '.standard-visual-output-root-marker.json'
    )
  ) {
    fail('standard visual output root marker mismatch');
  }
  if (
    summary?.schema !== MATRIX_SUMMARY_SCHEMA
    || summary?.standardMode !== true
    || summary?.captureFrames !== true
    || summary?.scenarioCount !== expectedPolicy?.scenarios?.length
    || summary?.failedCount !== 0
    || String(summary?.randomSeed) !== DEFAULT_RANDOM_SEED
    || !safeNonnegativeInteger(summary?.scenarioCount)
    || !safeNonnegativeInteger(summary?.failedCount)
  ) {
    fail('standard visual matrix summary incomplete');
  }
  if (
    path.resolve(summary?.outputRoot ?? '')
      !== path.resolve(expectedPolicy?.outputRoot ?? '')
  ) {
    fail('standard visual output root mismatch');
  }
  if (
    !numericCountMap(summary?.browserConsoleIssueCounts)
    || !numericCountMap(summary?.browserConsoleWarningCounts)
    || !numericCountMap(summary?.visualSurfaceIssueCounts)
    || !numericCountMap(summary?.issueCounts)
    || !exactZeroObject(summary.browserConsoleIssueCounts)
    || !exactZeroObject(summary.browserConsoleWarningCounts)
    || !exactZeroObject(summary.visualSurfaceIssueCounts)
    || !exactZeroObject(summary.issueCounts)
  ) {
    fail('standard visual matrix reported issues or warnings');
  }

  const results = Array.isArray(summary?.results) ? summary.results : [];
  if (results.length !== expectedPolicy?.scenarios?.length) {
    fail('standard visual scenario result count mismatch');
  }
  const scenarioEvidence = artifactEvidence?.scenarios ?? [];
  if (scenarioEvidence.length !== expectedPolicy?.scenarios?.length) {
    fail('standard visual nested artifact count mismatch');
  }
  const summaryIssues = [];
  const summaryVisualSurfaceIssues = [];
  const summaryBrowserConsoleIssueCounts = Object.create(null);
  const summaryBrowserConsoleWarningCounts = Object.create(null);
  const ownedScenarios = withDefaultRandomEnvironment(() => [
    ...STANDARD_SCENARIOS,
    ...deterministicRandomPairScenarios()
  ]);
  for (let index = 0; index < (expectedPolicy?.scenarios?.length ?? 0); index += 1) {
    const expected = expectedPolicy.scenarios[index];
    const ownedScenario = ownedScenarios[index];
    const result = results[index];
    const evidence = scenarioEvidence[index];
    const resultIssues = Array.isArray(result?.issues) ? result.issues : null;
    const resultVisualSurfaceIssues = Array.isArray(result?.visualSurfaceIssues)
      ? result.visualSurfaceIssues
      : null;
    const resultVisualSurfaceIssueTypes = Array.isArray(
      result?.visualSurfaceIssueTypes
    ) ? result.visualSurfaceIssueTypes : null;
    if (
      result?.label !== expected.label
      || result?.presetId !== expected.presetId
      || (result?.acceptanceTrack ?? null) !== expected.acceptanceTrack
      || (result?.workerSchedulePlan?.totalStepCount ?? null)
        !== expected.totalStepCount
      || canonicalJson(result?.randomPair ?? null)
        !== canonicalJson(expected.randomPair)
      || result?.url !== expected.url
      || result?.visualRendererMode !== expected.visualRendererMode
      || result?.expectedMechanics !== expected.expectedMechanics
    ) {
      fail(`visual scenario ${expected.label} identity mismatch`);
    }
    if (
      result?.code !== 0
      || result?.timedOut !== false
      || result?.status !== 'good'
      || result?.analysisStatus !== 'good'
      || result?.failed !== false
      || !safeNonnegativeInteger(result?.issueCount)
      || result.issueCount !== 0
      || resultIssues == null
      || resultIssues?.length !== 0
      || !safeNonnegativeInteger(result?.visualSurfaceIssueCount)
      || result.visualSurfaceIssueCount !== 0
      || resultVisualSurfaceIssues == null
      || resultVisualSurfaceIssues?.length !== 0
      || resultVisualSurfaceIssueTypes == null
      || resultVisualSurfaceIssueTypes.some((value) => typeof value !== 'string')
      || resultVisualSurfaceIssueTypes.length !== 0
      || !safeNonnegativeInteger(result?.browserConsoleIssueCount)
      || !safeNonnegativeInteger(result?.browserConsoleWarningCount)
      || result.browserConsoleIssueCount !== 0
      || result.browserConsoleWarningCount !== 0
      || !numericCountMap(result?.browserConsoleIssueCounts)
      || !numericCountMap(result?.browserConsoleWarningCounts)
      || !exactZeroObject(result.browserConsoleIssueCounts)
      || !exactZeroObject(result.browserConsoleWarningCounts)
      || result?.visualRendererModeMatched !== true
      || result?.expectedBehavior?.status !== 'pass'
      || result?.frameArtifactStatus !== 'ready'
      || !Number.isSafeInteger(result?.frameCount)
      || result.frameCount <= 0
    ) {
      fail(`visual scenario ${expected.label} failed acceptance`);
    }
    const expectedProbePath = path.join(
      expectedPolicy.outputRoot,
      `${expected.label}.json`
    );
    const expectedLogPath = path.join(
      expectedPolicy.outputRoot,
      `${expected.label}.log`
    );
    const expectedFrameDir = path.join(
      expectedPolicy.outputRoot,
      `${expected.label}-frames`
    );
    if (
      result?.outputPath !== expectedProbePath
      || result?.logPath !== expectedLogPath
      || result?.frameDir !== expectedFrameDir
      || evidence?.expected?.label !== expected.label
      || evidence?.probe?.metadata?.path !== expectedProbePath
      || evidence?.log?.path !== expectedLogPath
      || evidence?.frameDir !== expectedFrameDir
    ) {
      fail(`visual scenario ${expected.label} artifact path mismatch`);
    }
    const probe = evidence?.probe?.json;
    const frameArtifacts = probe?.visualFrameArtifacts;
    const probeAnalysis = probe?.analysis;
    const probeIssueCounts = probeAnalysis?.browserConsoleIssueCounts;
    const probeWarningCounts = probeAnalysis?.browserConsoleWarningCounts;
    const probeIssues = probeAnalysis?.issues;
    const synthesizedProbeIssues = synthesizeStandardScenarioIssues(
      ownedScenario,
      probe
    );
    const probeVisualSurfaceIssues = probeAnalysis?.visualSurfaceIssues;
    if (
      probe?.schema !== PROBE_SCHEMA
      || probe?.status !== 'good'
      || probeAnalysis?.status !== 'good'
      || !Array.isArray(probeIssues)
      || probeIssues.length !== 0
      || !Array.isArray(probeVisualSurfaceIssues)
      || probeVisualSurfaceIssues.length !== 0
      || !numericCountMap(probeIssueCounts)
      || !numericCountMap(probeWarningCounts)
      || !safeNonnegativeInteger(probeAnalysis?.browserConsoleIssueCount)
      || !safeNonnegativeInteger(probeAnalysis?.browserConsoleWarningCount)
      || !exactZeroObject(probeIssueCounts)
      || !exactZeroObject(probeWarningCounts)
      || frameArtifacts?.schema !== FRAME_ARTIFACTS_SCHEMA
      || frameArtifacts?.status !== 'ready'
      || frameArtifacts?.frameCount !== result?.frameCount
      || frameArtifacts?.analyzedFrameCount !== result?.frameCount
      || frameArtifacts?.writtenFrameCount !== result?.frameCount
      || !Array.isArray(frameArtifacts?.frames)
      || frameArtifacts.frames.length !== result?.frameCount
      || probe?.analysis?.nativeBrowserFrameValidationStatus !== 'passed'
    ) {
      fail(`visual scenario ${expected.label} probe evidence incomplete`);
    }
    if (
      resultIssues == null
      || resultVisualSurfaceIssues == null
      || resultVisualSurfaceIssueTypes == null
      || result.issueCount !== resultIssues.length
      || result.visualSurfaceIssueCount !== resultVisualSurfaceIssues.length
      || countMapTotal(result.browserConsoleIssueCounts)
        !== result.browserConsoleIssueCount
      || countMapTotal(result.browserConsoleWarningCounts)
        !== result.browserConsoleWarningCount
      || countMapTotal(probeIssueCounts) !== probeAnalysis?.browserConsoleIssueCount
      || countMapTotal(probeWarningCounts) !== probeAnalysis?.browserConsoleWarningCount
      || !countMapsEqual(result.browserConsoleIssueCounts, probeIssueCounts)
      || !countMapsEqual(result.browserConsoleWarningCounts, probeWarningCounts)
      || canonicalJson(resultIssues)
        !== canonicalJson(synthesizedProbeIssues)
      || canonicalJson(resultVisualSurfaceIssues)
        !== canonicalJson(probeVisualSurfaceIssues)
      || canonicalJson(resultVisualSurfaceIssueTypes)
        !== canonicalJson(Object.keys(
          countVisualSurfaceIssues(resultVisualSurfaceIssues) ?? {}
        ))
    ) {
      fail(`visual scenario ${expected.label} telemetry cross-binding mismatch`);
    }
    if (resultIssues != null) summaryIssues.push(...resultIssues);
    if (resultVisualSurfaceIssues != null) {
      summaryVisualSurfaceIssues.push(...resultVisualSurfaceIssues);
    }
    if (numericCountMap(result?.browserConsoleIssueCounts)) {
      for (const [name, count] of Object.entries(result.browserConsoleIssueCounts)) {
        summaryBrowserConsoleIssueCounts[name] =
          (summaryBrowserConsoleIssueCounts[name] ?? 0) + count;
      }
    }
    if (numericCountMap(result?.browserConsoleWarningCounts)) {
      for (const [name, count] of Object.entries(result.browserConsoleWarningCounts)) {
        summaryBrowserConsoleWarningCounts[name] =
          (summaryBrowserConsoleWarningCounts[name] ?? 0) + count;
      }
    }
    if (!ownedLocalProbeEvidenceValid({
      probe,
      expectedScenario: expected,
      policy: expectedPolicy,
      repoDir: artifactEvidence?.repoDir
    })) {
      fail(`visual scenario ${expected.label} owned local browser provenance mismatch`);
    }
    if (!arraysEqual(
      evidence?.directoryEntries,
      expectedFrameFileNames(evidence ?? { frames: [] })
    )) {
      fail(`visual scenario ${expected.label} frame directory drifted`);
    }
    if ((evidence?.frames?.length ?? 0) !== result?.frameCount) {
      fail(`visual scenario ${expected.label} frame evidence count mismatch`);
    }
    for (let frameIndex = 0; frameIndex < (evidence?.frames?.length ?? 0); frameIndex += 1) {
      const frame = evidence.frames[frameIndex];
      const row = frame.sourceRow;
      if (
        frame.scenarioLabel !== expected.label
        || frame.frameIndex !== frameIndex
        || row?.status !== 'captured'
        || row?.index !== frameIndex
        || row?.path !== frame.artifact?.path
        || row?.byteLength !== frame.artifact?.byteLength
        || row?.png?.status !== 'ready'
        || row?.png?.hasVisiblePixels !== true
        || row?.png?.hasSurfaceLikeVariation !== true
        || row?.blankFrame !== false
        || frame.artifact?.png?.status !== 'ready'
        || frame.artifact?.png?.hasVisiblePixels !== true
        || frame.artifact?.png?.hasSurfaceLikeVariation !== true
      ) {
        fail(`visual scenario ${expected.label} frame ${frameIndex} invalid`);
      }
    }
  }
  if (
    !countMapsEqual(summary.issueCounts, countStrings(summaryIssues))
    || !countMapsEqual(
      summary.visualSurfaceIssueCounts,
      countVisualSurfaceIssues(summaryVisualSurfaceIssues)
    )
    || !countMapsEqual(
      summary.browserConsoleIssueCounts,
      summaryBrowserConsoleIssueCounts
    )
    || !countMapsEqual(
      summary.browserConsoleWarningCounts,
      summaryBrowserConsoleWarningCounts
    )
    || summary.failedCount !== results.filter((result) => result?.failed === true).length
  ) {
    fail('standard visual telemetry summary cross-binding mismatch');
  }
  return Object.freeze({
    passed: failures.length === 0,
    failures: Object.freeze(failures),
    artifactManifest: observedManifest
  });
}

export function createStandardVisualReviewTemplate(capture) {
  const frames = (capture?.artifactManifest?.scenarios ?? []).flatMap(
    (scenario) => (scenario.frames ?? []).map((frame) => ({
      scenarioLabel: scenario.label,
      frameIndex: frame.frameIndex,
      sha256: frame.sha256,
      decision: 'pending'
    }))
  );
  return Object.freeze({
    schema: STANDARD_VISUAL_REVIEW_SCHEMA,
    status: 'pending',
    reviewer: Object.freeze({
      kind: 'human',
      identifier: null,
      automated: false
    }),
    reviewedAt: null,
    sourceFingerprint: capture?.sourceFingerprintAfter ?? null,
    captureManifestSha256: capture?.captureManifestSha256 ?? null,
    frames: Object.freeze(frames.map((entry) => Object.freeze(entry))),
    attestation: null
  });
}

function reviewTimestampValid(value) {
  return typeof value === 'string'
    && value.length > 0
    && Number.isFinite(Date.parse(value));
}

export function evaluateStandardVisualReview(review, {
  capture,
  currentFingerprint
}) {
  const failures = [];
  const fail = (message) => failures.push(message);
  if (review?.schema !== STANDARD_VISUAL_REVIEW_SCHEMA) {
    fail('human review schema mismatch');
  }
  if (review?.status !== 'approved') fail('human review not approved');
  if (
    review?.reviewer?.kind !== 'human'
    || review?.reviewer?.automated !== false
    || typeof review?.reviewer?.identifier !== 'string'
    || review.reviewer.identifier.trim().length === 0
  ) {
    fail('human reviewer identity incomplete');
  }
  if (!reviewTimestampValid(review?.reviewedAt)) {
    fail('human review timestamp invalid');
  }
  if (review?.attestation !== STANDARD_VISUAL_REVIEW_ATTESTATION) {
    fail('human review attestation mismatch');
  }
  if (
    review?.captureManifestSha256 !== capture?.captureManifestSha256
    || !exactWorktreeFingerprintsEqual(
      review?.sourceFingerprint,
      capture?.sourceFingerprintAfter,
      currentFingerprint
    )
  ) {
    fail('human review source or capture binding mismatch');
  }
  const expectedFrames = (capture?.artifactManifest?.scenarios ?? []).flatMap(
    (scenario) => (scenario.frames ?? []).map((frame) => ({
      scenarioLabel: scenario.label,
      frameIndex: frame.frameIndex,
      sha256: frame.sha256
    }))
  );
  const reviewedFrames = Array.isArray(review?.frames) ? review.frames : [];
  if (reviewedFrames.length !== expectedFrames.length || expectedFrames.length === 0) {
    fail('human review frame coverage mismatch');
  }
  for (let index = 0; index < expectedFrames.length; index += 1) {
    const expected = expectedFrames[index];
    const observed = reviewedFrames[index];
    if (
      observed?.scenarioLabel !== expected.scenarioLabel
      || observed?.frameIndex !== expected.frameIndex
      || observed?.sha256 !== expected.sha256
      || observed?.decision !== 'pass'
    ) {
      fail(`human review frame ${index} mismatch`);
    }
  }
  return Object.freeze({
    passed: failures.length === 0,
    failures: Object.freeze(failures)
  });
}

export function evaluateStandardVisualMatrixReceipt(receipt, {
  expectedPolicy,
  currentFingerprint,
  captureArtifact,
  capture,
  artifactEvidence,
  reviewArtifact,
  review
}) {
  const failures = [];
  const fail = (message) => failures.push(message);
  if (receipt?.schema !== STANDARD_VISUAL_RECEIPT_SCHEMA) {
    fail('visual receipt schema mismatch');
  }
  if (receipt?.policyTrack !== SS_CONTAINED_POLICY_TRACK) {
    fail('visual receipt policy track mismatch');
  }
  if (receipt?.status !== 'complete') fail('visual receipt did not complete');
  if (
    !artifactMetadataMatches(receipt?.captureArtifact, captureArtifact)
    || !artifactMetadataMatches(receipt?.reviewArtifact, reviewArtifact)
  ) {
    fail('visual receipt input artifact mismatch');
  }
  const captureEvaluation = evaluateStandardVisualCapture(capture, {
    expectedPolicy,
    currentFingerprint,
    artifactEvidence
  });
  const reviewEvaluation = evaluateStandardVisualReview(review, {
    capture,
    currentFingerprint
  });
  if (!captureEvaluation.passed) failures.push(...captureEvaluation.failures);
  if (!reviewEvaluation.passed) failures.push(...reviewEvaluation.failures);
  if (
    receipt?.captureManifestSha256 !== capture?.captureManifestSha256
    || !exactWorktreeFingerprintsEqual(
      receipt?.sourceFingerprint,
      capture?.sourceFingerprintBefore,
      capture?.sourceFingerprintAfter,
      currentFingerprint
    )
  ) {
    fail('visual receipt exact source binding mismatch');
  }
  return Object.freeze({
    passed: failures.length === 0,
    failures: Object.freeze(failures),
    captureEvaluation,
    reviewEvaluation
  });
}

function failedCapture(reason) {
  return {
    schema: STANDARD_VISUAL_CAPTURE_SCHEMA,
    policyTrack: SS_CONTAINED_POLICY_TRACK,
    status: 'failed',
    reason
  };
}

function failedReceipt(reason) {
  return {
    schema: STANDARD_VISUAL_RECEIPT_SCHEMA,
    policyTrack: SS_CONTAINED_POLICY_TRACK,
    status: 'failed',
    reason
  };
}

function scrubbedCommandEnvironment(policy) {
  const environment = scrubReleaseEvidenceChildEnvironment(process.env, {
    unsetKeys: policy.unsetEnvironmentKeys,
    unsetPrefixes: policy.unsetEnvironmentPrefixes
  });
  return Object.assign(environment, policy.command.environment);
}

async function verifyCapturePostWriteStability({
  capturePath,
  reviewPath,
  candidate,
  policy,
  repoDir,
  fingerprintProvider,
  outputRootGuard
}) {
  const failures = [];
  try {
    await Promise.all([
      assertStableDirectory(outputRootGuard.artifactDirectorySnapshot, 'standard visual artifact directory'),
      assertStableDirectory(outputRootGuard.outputDirectorySnapshot, 'standard visual output directory'),
      assertStableDirectory(outputRootGuard.outputRootSnapshot, 'standard visual output root')
    ]);
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  }
  const [captureRead, reviewRead, evidence, currentFingerprint] = await Promise.all([
    readJsonArtifact({
      artifactPath: capturePath,
      repoDir,
      label: 'standard visual capture post-write'
    }),
    readJsonArtifact({
      artifactPath: reviewPath,
      repoDir,
      label: 'standard visual review post-write'
    }),
    collectStandardVisualArtifactEvidence({
      policy,
      stdoutArtifact: candidate.command?.stdoutArtifact,
      stderrArtifact: candidate.command?.stderrArtifact,
      repoDir
    }),
    fingerprintProvider(repoDir)
  ]);
  if (canonicalJson(captureRead.json) !== canonicalJson(candidate)) {
    failures.push('capture changed after write');
  }
  if (
    canonicalJson(reviewRead.json)
      !== canonicalJson(createStandardVisualReviewTemplate(candidate))
  ) {
    failures.push('review template changed after write');
  }
  if (!exactWorktreeFingerprintsEqual(
    candidate.sourceFingerprintBefore,
    candidate.sourceFingerprintAfter,
    currentFingerprint
  )) {
    failures.push('source changed after capture write');
  }
  const evaluation = evaluateStandardVisualCapture(captureRead.json, {
    expectedPolicy: policy,
    currentFingerprint,
    artifactEvidence: evidence
  });
  if (!evaluation.passed) failures.push(...evaluation.failures);
  return Object.freeze({
    passed: failures.length === 0,
    failures: Object.freeze([...new Set(failures)])
  });
}

async function verifyFinalizePostWriteStability({
  receiptPath,
  capturePath,
  reviewPath,
  candidate,
  repoDir,
  fingerprintProvider,
  outputRootGuard
}) {
  const failures = [];
  try {
    await Promise.all([
      assertStableDirectory(outputRootGuard.artifactDirectorySnapshot, 'standard visual artifact directory'),
      assertStableDirectory(outputRootGuard.outputDirectorySnapshot, 'standard visual output directory'),
      assertStableDirectory(outputRootGuard.outputRootSnapshot, 'standard visual output root')
    ]);
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  }
  const [receiptRead, captureRead, reviewRead, currentFingerprint] = await Promise.all([
    readJsonArtifact({ artifactPath: receiptPath, repoDir, label: 'standard visual receipt post-write' }),
    readJsonArtifact({ artifactPath: capturePath, repoDir, label: 'standard visual capture post-write' }),
    readJsonArtifact({ artifactPath: reviewPath, repoDir, label: 'standard visual review post-write' }),
    fingerprintProvider(repoDir)
  ]);
  if (canonicalJson(receiptRead.json) !== canonicalJson(candidate)) {
    failures.push('receipt changed after write');
  }
  let policy = null;
  try {
    policy = createStandardVisualCommandPolicy({
      artifactDir: captureRead.json?.commandPolicy?.artifactDirectory,
      runId: captureRead.json?.commandPolicy?.runId
    });
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  }
  if (policy) {
    const evidence = await collectStandardVisualArtifactEvidence({
      policy,
      stdoutArtifact: captureRead.json?.command?.stdoutArtifact,
      stderrArtifact: captureRead.json?.command?.stderrArtifact,
      repoDir
    });
    const evaluation = evaluateStandardVisualMatrixReceipt(receiptRead.json, {
      expectedPolicy: policy,
      currentFingerprint,
      captureArtifact: captureRead.artifact,
      capture: captureRead.json,
      artifactEvidence: evidence,
      reviewArtifact: reviewRead.artifact,
      review: reviewRead.json
    });
    if (!evaluation.passed) failures.push(...evaluation.failures);
  }
  if (!exactWorktreeFingerprintsEqual(
    candidate.sourceFingerprint,
    captureRead.json?.sourceFingerprintBefore,
    captureRead.json?.sourceFingerprintAfter,
    currentFingerprint
  )) {
    failures.push('source changed after receipt write');
  }
  return Object.freeze({
    passed: failures.length === 0,
    failures: Object.freeze([...new Set(failures)])
  });
}

async function runStandardVisualCaptureInternal({
  capturePath,
  artifactDir,
  reviewTemplatePath,
  repoDir = sourceRepoDir,
  runId = DEFAULT_RUN_ID,
  processRunner,
  fingerprintProvider = exactWorktreeFingerprint,
  stabilityHook = null
}) {
  const resolvedRepoDir = path.resolve(repoDir);
  const policy = createStandardVisualCommandPolicy({ artifactDir, runId });
  await assertArtifactPathOutsideRepo({
    artifactPath: path.join(
      policy.artifactDirectory,
      '.standard-visual-artifact-root'
    ),
    repoDir: resolvedRepoDir,
    label: 'standard visual artifact directory'
  });
  // The stream paths below live directly under this caller-selected root.
  // Establish it only after its outside-repository containment has passed.
  await mkdir(policy.artifactDirectory, { recursive: true, mode: 0o700 });
  await assertArtifactPathsPairwiseDistinct({
    repoDir: resolvedRepoDir,
    label: 'standard visual capture outputs',
    paths: [
      { path: capturePath, label: 'standard visual capture' },
      {
        path: reviewTemplatePath,
        label: 'standard visual review template'
      },
      {
        path: path.join(policy.artifactDirectory, 'matrix.stdout.log'),
        label: 'standard visual matrix stdout'
      },
      {
        path: path.join(policy.artifactDirectory, 'matrix.stderr.log'),
        label: 'standard visual matrix stderr'
      }
    ]
  });
  await Promise.all([
    assertArtifactPathOutsideRepo({
      artifactPath: capturePath,
      repoDir: policy.artifactDirectory,
      label: 'standard visual capture'
    }),
    assertArtifactPathOutsideRepo({
      artifactPath: reviewTemplatePath,
      repoDir: policy.artifactDirectory,
      label: 'standard visual review template'
    })
  ]);
  const outputRootGuard = await guardVisualOutputRoot({
    policy,
    repoDir: resolvedRepoDir,
    create: true
  });
  const captureWriter = await createStableEvidenceWriter({
    outputPath: capturePath,
    repoDir: resolvedRepoDir,
    sentinel: failedCapture('standard visual capture did not complete'),
    label: 'standard visual capture'
  });
  const reviewWriter = await createStableEvidenceWriter({
    outputPath: reviewTemplatePath,
    repoDir: resolvedRepoDir,
    sentinel: {
      schema: STANDARD_VISUAL_REVIEW_SCHEMA,
      status: 'unavailable',
      reason: 'standard visual capture did not complete'
    },
    label: 'standard visual review template'
  });
  let before = null;
  try {
    before = await fingerprintProvider(resolvedRepoDir);
    const executed = await processRunner({
      executable: process.execPath,
      args: [...policy.command.args],
      cwd: resolvedRepoDir,
      env: scrubbedCommandEnvironment(policy),
      stdoutPath: path.join(path.resolve(artifactDir), 'matrix.stdout.log'),
      stderrPath: path.join(path.resolve(artifactDir), 'matrix.stderr.log'),
      repoDir: resolvedRepoDir
    });
    await invokeNonProductionStabilityHook({
      hook: stabilityHook,
      repoDir: resolvedRepoDir,
      stage: 'capture:after-process',
      context: { policy }
    });
    await Promise.all([
      assertStableDirectory(outputRootGuard.artifactDirectorySnapshot, 'standard visual artifact directory'),
      assertStableDirectory(outputRootGuard.outputDirectorySnapshot, 'standard visual output directory'),
      assertStableDirectory(outputRootGuard.outputRootSnapshot, 'standard visual output root')
    ]);
    const evidence = await collectStandardVisualArtifactEvidence({
      policy,
      stdoutArtifact: executed.stdoutArtifact,
      stderrArtifact: executed.stderrArtifact,
      repoDir: resolvedRepoDir
    });
    const after = await fingerprintProvider(resolvedRepoDir);
    const manifest = standardVisualArtifactManifestFromEvidence(evidence);
    const candidate = {
      schema: STANDARD_VISUAL_CAPTURE_SCHEMA,
      policyTrack: SS_CONTAINED_POLICY_TRACK,
      status: 'complete',
      commandPolicy: policy,
      sourceFingerprintBefore: before,
      sourceFingerprintAfter: after,
      command: {
        invocationSha256: canonicalJsonSha256(policy.command),
        exitCode: executed.exitCode,
        signal: executed.signal,
        spawnError: executed.spawnError,
        stdoutArtifact: executed.stdoutArtifact,
        stderrArtifact: executed.stderrArtifact
      },
      artifactManifest: manifest,
      captureManifestSha256: manifest.manifestSha256
    };
    const evaluation = evaluateStandardVisualCapture(candidate, {
      expectedPolicy: policy,
      currentFingerprint: after,
      artifactEvidence: evidence
    });
    let capture = evaluation.passed
      ? candidate
      : { ...candidate, status: 'failed', reason: evaluation.failures.join('; ') };
    await captureWriter.replace(capture);
    if (evaluation.passed) {
      await reviewWriter.replace(createStandardVisualReviewTemplate(capture));
      await invokeNonProductionStabilityHook({
        hook: stabilityHook,
        repoDir: resolvedRepoDir,
        stage: 'capture:after-write',
        context: { policy }
      });
      const stability = await verifyCapturePostWriteStability({
        capturePath: captureWriter.outputPath,
        reviewPath: reviewWriter.outputPath,
        candidate,
        policy,
        repoDir: resolvedRepoDir,
        fingerprintProvider,
        outputRootGuard
      });
      if (!stability.passed) {
        capture = {
          ...candidate,
          status: 'failed',
          reason: `post-write stability failure: ${stability.failures.join('; ')}`
        };
        await captureWriter.replace(capture);
        await reviewWriter.replace({
          schema: STANDARD_VISUAL_REVIEW_SCHEMA,
          status: 'unavailable',
          reason: 'standard visual capture post-write stability failed'
        });
        return Object.freeze({
          capturePath: captureWriter.outputPath,
          reviewTemplatePath: reviewWriter.outputPath,
          capture,
          evaluation: Object.freeze({ passed: false, failures: stability.failures })
        });
      }
    }
    return Object.freeze({
      capturePath: captureWriter.outputPath,
      reviewTemplatePath: reviewWriter.outputPath,
      capture,
      evaluation
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const capture = {
      ...failedCapture(reason),
      commandPolicy: policy,
      sourceFingerprintBefore: before
    };
    await captureWriter.replace(capture);
    return Object.freeze({
      capturePath: captureWriter.outputPath,
      reviewTemplatePath: reviewWriter.outputPath,
      capture,
      evaluation: Object.freeze({ passed: false, failures: [reason] })
    });
  }
}

/** Run the owned Chrome/Vite matrix. Production callers cannot replace it. */
export async function runStandardVisualCapture(options = {}) {
  if (
    options.fingerprintProvider != null
    && options.fingerprintProvider !== exactWorktreeFingerprint
  ) {
    throw new Error(
      'standard visual production capture requires exactWorktreeFingerprint'
    );
  }
  if (options.fixtureCapability != null || options.stabilityHook != null) {
    throw new Error('standard visual production capture does not accept fixture seams');
  }
  return runStandardVisualCaptureInternal({
    ...options,
    processRunner: runProcessToArtifacts,
    fingerprintProvider: exactWorktreeFingerprint,
    stabilityHook: null
  });
}

/**
 * Non-production fixture seam. It is intentionally unable to certify this
 * repository: the synthetic executor is rejected for sourceRepoDir.
 */
export async function runStandardVisualFixtureCapture({
  fixtureCapability,
  fixtureProcessRunner,
  fingerprintProvider = exactWorktreeFingerprint,
  stabilityHook = null,
  ...options
}) {
  if (typeof fixtureProcessRunner !== 'function') {
    throw new TypeError('fixtureProcessRunner must be a function');
  }
  const [fixtureRepoDir, canonicalSourceRepoDir] = await Promise.all([
    realpath(path.resolve(options.repoDir ?? sourceRepoDir)),
    realpath(sourceRepoDir)
  ]);
  if (fixtureRepoDir === canonicalSourceRepoDir) {
    throw new Error('fixture visual capture cannot certify the source repository');
  }
  await assertNonProductionFixtureCapability({
    capability: fixtureCapability,
    repoDir: options.repoDir ?? sourceRepoDir,
    productionRepoDir: sourceRepoDir,
    label: 'standard visual fixture capture'
  });
  const trustedFingerprintProvider = await resolveFixtureFingerprintProvider({
    repoDir: options.repoDir ?? sourceRepoDir,
    fixtureCapability,
    fingerprintProvider,
    stabilityHook,
    label: 'standard visual fixture capture'
  });
  return runStandardVisualCaptureInternal({
    ...options,
    processRunner: fixtureProcessRunner,
    fingerprintProvider: trustedFingerprintProvider,
    stabilityHook
  });
}

async function readJsonArtifact({ artifactPath, repoDir, label }) {
  return readStableJsonArtifact({ artifactPath, repoDir, label });
}

function priorCompleteVisualReceiptBound({
  receipt,
  capture,
  captureArtifact,
  review,
  reviewArtifact,
  expectedPolicy
}) {
  return Boolean(
    plainRecord(receipt)
    && receipt.schema === STANDARD_VISUAL_RECEIPT_SCHEMA
    && receipt.policyTrack === expectedPolicy?.policyTrack
    && receipt.status === 'complete'
    && exactWorktreeFingerprintsEqual(
      receipt.sourceFingerprint,
      capture?.sourceFingerprintBefore,
      capture?.sourceFingerprintAfter
    )
    && receipt.captureManifestSha256 === capture?.captureManifestSha256
    && artifactMetadataMatches(receipt.captureArtifact, captureArtifact)
    && artifactMetadataMatches(receipt.reviewArtifact, reviewArtifact)
    && capture?.schema === STANDARD_VISUAL_CAPTURE_SCHEMA
    && capture?.policyTrack === expectedPolicy?.policyTrack
    && capture?.status === 'complete'
    && canonicalJson(capture?.commandPolicy) === canonicalJson(expectedPolicy)
    && review?.schema === STANDARD_VISUAL_REVIEW_SCHEMA
    && review?.captureManifestSha256 === capture?.captureManifestSha256
    && evaluateStandardVisualReview(review, {
      capture,
      currentFingerprint: capture?.sourceFingerprintAfter
    }).passed
  );
}

async function validatedExistingVisualReceipt({
  receiptPath,
  repoDir,
  capture,
  captureArtifact,
  review,
  reviewArtifact,
  expectedPolicy
}) {
  let existing;
  try {
    existing = await readJsonArtifact({
      artifactPath: receiptPath,
      repoDir,
      label: 'standard visual existing receipt'
    });
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
  if (!priorCompleteVisualReceiptBound({
    receipt: existing.json,
    capture,
    captureArtifact,
    review,
    reviewArtifact,
    expectedPolicy
  })) {
    throw new Error(
      'standard visual existing receipt is not a bound complete visual receipt'
    );
  }
  return Object.freeze({
    dev: existing.identity.dev,
    ino: existing.identity.ino
  });
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

export async function readStandardVisualMatrixReceiptEvidence({
  receipt,
  repoDir = sourceRepoDir
}) {
  const resolvedRepoDir = path.resolve(repoDir);
  const [captureRead, reviewRead] = await Promise.all([
    readJsonArtifact({
      artifactPath: receipt?.captureArtifact?.path,
      repoDir: resolvedRepoDir,
      label: 'standard visual capture'
    }),
    readJsonArtifact({
      artifactPath: receipt?.reviewArtifact?.path,
      repoDir: resolvedRepoDir,
      label: 'standard visual human review'
    })
  ]);
  const capture = captureRead.json;
  const expectedPolicy = createStandardVisualCommandPolicy({
    artifactDir: capture?.commandPolicy?.artifactDirectory,
    runId: capture?.commandPolicy?.runId
  });
  const artifactEvidence = await collectStandardVisualArtifactEvidence({
    policy: expectedPolicy,
    stdoutArtifact: capture?.command?.stdoutArtifact,
    stderrArtifact: capture?.command?.stderrArtifact,
    repoDir: resolvedRepoDir
  });
  return Object.freeze({
    captureArtifact: captureRead.artifact,
    capture,
    artifactEvidence,
    reviewArtifact: reviewRead.artifact,
    review: reviewRead.json,
    expectedPolicy
  });
}

export async function runStandardVisualFinalize({
  capturePath,
  reviewPath,
  receiptPath,
  repoDir = sourceRepoDir,
  fixtureCapability,
  fingerprintProvider = exactWorktreeFingerprint,
  stabilityHook = null
}) {
  const resolvedRepoDir = path.resolve(repoDir);
  const trustedFingerprintProvider = await resolveFixtureFingerprintProvider({
    repoDir: resolvedRepoDir,
    fixtureCapability,
    fingerprintProvider,
    stabilityHook,
    label: 'standard visual finalization fixture seam'
  });
  await assertArtifactPathsPairwiseDistinct({
    repoDir: resolvedRepoDir,
    label: 'standard visual finalization artifacts',
    paths: [
      { path: capturePath, label: 'standard visual capture' },
      { path: reviewPath, label: 'standard visual human review' },
      { path: receiptPath, label: 'standard visual receipt' }
    ]
  });
  const preliminaryCapture = await readJsonArtifact({
    artifactPath: capturePath,
    repoDir: resolvedRepoDir,
    label: 'standard visual capture'
  });
  const preliminaryPolicy = createStandardVisualCommandPolicy({
    artifactDir:
      preliminaryCapture.json?.commandPolicy?.artifactDirectory,
    runId: preliminaryCapture.json?.commandPolicy?.runId
  });
  await assertArtifactPathOutsideRepo({
    artifactPath: receiptPath,
    repoDir: preliminaryPolicy.artifactDirectory,
    label: 'standard visual receipt'
  });
  let existingReceiptIdentity = null;
  if (await receiptPathExists(receiptPath)) {
    const preliminaryReview = await readJsonArtifact({
      artifactPath: reviewPath,
      repoDir: resolvedRepoDir,
      label: 'standard visual human review'
    });
    existingReceiptIdentity = await validatedExistingVisualReceipt({
      receiptPath,
      repoDir: resolvedRepoDir,
      capture: preliminaryCapture.json,
      captureArtifact: preliminaryCapture.artifact,
      review: preliminaryReview.json,
      reviewArtifact: preliminaryReview.artifact,
      expectedPolicy: preliminaryPolicy
    });
  }
  // Re-finalization is intentionally narrow: only a receipt that was safely
  // reread and bound to these exact capture/review artifacts may be adopted.
  // The hook makes the pre-adoption identity check observable in external
  // fixture tests without exposing a production mutation seam.
  await invokeNonProductionStabilityHook({
    hook: stabilityHook,
    repoDir: resolvedRepoDir,
    stage: 'finalize:before-existing-receipt-adoption',
    context: { receiptPath, existingReceiptIdentity }
  });
  const writer = await createStableEvidenceWriter({
    outputPath: receiptPath,
    repoDir: resolvedRepoDir,
    sentinel: failedReceipt('standard visual finalization did not complete'),
    label: 'standard visual receipt',
    ...(existingReceiptIdentity == null
      ? {}
      : { adoptExistingOutputIdentity: existingReceiptIdentity })
  });
  try {
    // Bind the safe receipt target before reopening the capture-owned root.
    // A privacy, containment, or marker rejection here must replace a
    // validated prior receipt with an explicit failed receipt (or leave the
    // new fail sentinel) rather than returning a stale complete result.
    const outputRootGuard = await guardVisualOutputRoot({
      policy: preliminaryPolicy,
      repoDir: resolvedRepoDir,
      create: false
    });
    const [captureRead, reviewRead] = await Promise.all([
      readJsonArtifact({
        artifactPath: capturePath,
        repoDir: resolvedRepoDir,
        label: 'standard visual capture'
      }),
      readJsonArtifact({
        artifactPath: reviewPath,
        repoDir: resolvedRepoDir,
        label: 'standard visual human review'
      })
    ]);
    const capture = captureRead.json;
    const policy = createStandardVisualCommandPolicy({
      artifactDir: capture?.commandPolicy?.artifactDirectory,
      runId: capture?.commandPolicy?.runId
    });
    const evidence = await collectStandardVisualArtifactEvidence({
      policy,
      stdoutArtifact: capture?.command?.stdoutArtifact,
      stderrArtifact: capture?.command?.stderrArtifact,
      repoDir: resolvedRepoDir
    });
    const current = await trustedFingerprintProvider(resolvedRepoDir);
    const candidate = {
      schema: STANDARD_VISUAL_RECEIPT_SCHEMA,
      policyTrack: SS_CONTAINED_POLICY_TRACK,
      status: 'complete',
      sourceFingerprint: current,
      captureManifestSha256: capture?.captureManifestSha256 ?? null,
      captureArtifact: captureRead.artifact,
      reviewArtifact: reviewRead.artifact
    };
    const evaluation = evaluateStandardVisualMatrixReceipt(candidate, {
      expectedPolicy: policy,
      currentFingerprint: current,
      captureArtifact: captureRead.artifact,
      capture,
      artifactEvidence: evidence,
      reviewArtifact: reviewRead.artifact,
      review: reviewRead.json
    });
    let receipt = evaluation.passed
      ? candidate
      : { ...candidate, status: 'failed', reason: evaluation.failures.join('; ') };
    await writer.replace(receipt);
    if (evaluation.passed) {
      await invokeNonProductionStabilityHook({
        hook: stabilityHook,
        repoDir: resolvedRepoDir,
        stage: 'finalize:after-write',
        context: { policy }
      });
      const stability = await verifyFinalizePostWriteStability({
        receiptPath: writer.outputPath,
        capturePath,
        reviewPath,
        candidate,
        repoDir: resolvedRepoDir,
        fingerprintProvider: trustedFingerprintProvider,
        outputRootGuard
      });
      if (!stability.passed) {
        receipt = {
          ...candidate,
          status: 'failed',
          reason: `post-write stability failure: ${stability.failures.join('; ')}`
        };
        await writer.replace(receipt);
        return Object.freeze({
          receiptPath: writer.outputPath,
          receipt,
          evaluation: Object.freeze({ passed: false, failures: stability.failures })
        });
      }
    }
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

export function standardVisualMatrixIccEvent({
  receipt,
  evaluation,
  receiptArtifact = null
}) {
  const passed = receipt?.status === 'complete' && evaluation?.passed === true;
  const status = passed ? 'PASS' : 'FAIL';
  return Object.freeze({
    kind: STANDARD_VISUAL_EVENT_KIND,
    name: STANDARD_VISUAL_EVENT_NAME,
    status,
    value: status,
    details: Object.freeze({
      authentic: passed,
      policyTrack: SS_CONTAINED_POLICY_TRACK,
      receiptPath: receiptArtifact?.path ?? null,
      receiptSha256: receiptArtifact?.sha256 ?? null,
      sourceFingerprint: receipt?.sourceFingerprint?.sourceFingerprint ?? null,
      captureManifestSha256: receipt?.captureManifestSha256 ?? null,
      evaluatorFailures: evaluation?.failures ?? []
    }),
    snippet: passed
      ? 'The exact seven-scenario standard matrix passed and every hashed PNG received source-bound human approval.'
      : 'The standard visual matrix receipt was missing, stale, tampered, incomplete, or lacked exact human PNG review.'
  });
}

async function main() {
  const mode = process.argv[2];
  if (mode === 'capture') {
    const [capturePath, artifactDir, reviewTemplatePath] = process.argv.slice(3);
    if (!capturePath || !artifactDir || !reviewTemplatePath || process.argv.length !== 6) {
      throw new Error(
        'Usage: node scripts/ss-standard-visual-matrix-receipt.mjs capture '
        + '<capture.json> <artifact-directory> <review-template.json>'
      );
    }
    const result = await runStandardVisualCapture({
      capturePath,
      artifactDir,
      reviewTemplatePath
    });
    process.stdout.write(`${JSON.stringify({
      capturePath: result.capturePath,
      reviewTemplatePath: result.reviewTemplatePath,
      status: result.capture.status,
      eligibleForReview: result.evaluation.passed,
      failures: result.evaluation.failures
    }, null, 2)}\n`);
    if (!result.evaluation.passed) process.exitCode = 1;
    return;
  }
  if (mode === 'finalize') {
    const [capturePath, reviewPath, receiptPath] = process.argv.slice(3);
    if (!capturePath || !reviewPath || !receiptPath || process.argv.length !== 6) {
      throw new Error(
        'Usage: node scripts/ss-standard-visual-matrix-receipt.mjs finalize '
        + '<capture.json> <completed-review.json> <receipt.json>'
      );
    }
    const result = await runStandardVisualFinalize({
      capturePath,
      reviewPath,
      receiptPath
    });
    process.stdout.write(`${JSON.stringify({
      receiptPath: result.receiptPath,
      status: result.receipt.status,
      eligible: result.evaluation.passed,
      failures: result.evaluation.failures
    }, null, 2)}\n`);
    if (!result.evaluation.passed) process.exitCode = 1;
    return;
  }
  throw new Error(
    'Usage: node scripts/ss-standard-visual-matrix-receipt.mjs '
    + '<capture|finalize> ...'
  );
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
