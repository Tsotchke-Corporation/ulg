#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import {
  access,
  cp,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  readlink,
  realpath,
  rm,
  symlink,
  writeFile
} from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const HISTORICAL_COMMIT =
  '2d31a506ff961108b68bb622965d8edb5c12a331';
export const VPN_SERVER_PORT = 5174;
export const HISTORICAL_SERVER_PORT = 5175;
export const CURRENT_SERVER_PORT = 5176;
export const MEMORY_LIMIT_BYTES = 4 * 1024 * 1024 * 1024;
export const DEFAULT_SCHEDULE = Object.freeze([
  'historical',
  'current',
  'current',
  'historical',
  'historical',
  'current'
]);

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const DEFAULT_REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const SNAPSHOT_PREFIX = 'ulg-paired-field-ab-';
const SNAPSHOT_EXCLUDES = new Set([
  '.git',
  '.cache',
  'coverage',
  'dist',
  'node_modules'
]);
const FIELD_HEADER_WORDS = 64;
const FIELD_DESCRIPTOR_WORDS = 32;
const FIELD_DESCRIPTOR_STATUS_WORD = 3;
const FIELD_DESCRIPTOR_PAYLOAD_WORD = 4;
const FIELD_CANDIDATE_COUNT_WORD = 33;
const FIELD_UNIQUE_ELEMENT_COUNT_WORD = 51;
const FIELD_STENCIL_SIZE = 27;
const PARENT_GENERATION_LOCAL_HEADER_WORDS = Object.freeze([
  3,
  6,
  44,
  45,
  46,
  47,
  57,
  63
]);

function integer(value, label, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  if (
    !Number.isSafeInteger(number)
    || number < minimum
    || number > maximum
  ) {
    throw new RangeError(
      `${label} must be an integer in [${minimum}, ${maximum}]`
    );
  }
  return number;
}

function uint32Words(value, label) {
  if (
    !(value instanceof Uint32Array)
    && !Array.isArray(value)
  ) {
    throw new TypeError(`${label} must be a Uint32Array or array`);
  }
  return Uint32Array.from(value);
}

export function canonicalizeFieldDescriptorWords(value) {
  const words = uint32Words(value, 'descriptor words');
  if (words.length % FIELD_DESCRIPTOR_WORDS !== 0) {
    throw new RangeError('descriptor words must contain complete 32-word rows');
  }
  for (
    let base = 0;
    base < words.length;
    base += FIELD_DESCRIPTOR_WORDS
  ) {
    const status = words[base + FIELD_DESCRIPTOR_STATUS_WORD];
    if (status !== 0 && status !== 1) {
      throw new Error(`descriptor row ${base / FIELD_DESCRIPTOR_WORDS} has invalid status ${status}`);
    }
    if (status === 0) {
      words.fill(
        0,
        base + FIELD_DESCRIPTOR_PAYLOAD_WORD,
        base + FIELD_DESCRIPTOR_WORDS
      );
    }
  }
  return words;
}

export function canonicalizeContainmentParentHeader(value) {
  if (!(value instanceof Uint32Array) && !Array.isArray(value)) {
    throw new TypeError('parent header must be a Uint32Array or array');
  }
  const words = Array.from(value);
  for (const word of PARENT_GENERATION_LOCAL_HEADER_WORDS) {
    if (word < words.length) words[word] = 0;
  }
  return words;
}

function validateActivePhysicalSources({
  activePhysicalSources,
  physicalSourceCount
}) {
  const active = uint32Words(
    activePhysicalSources,
    'active physical sources'
  );
  let previous = -1;
  for (const physical of active) {
    if (physical >= physicalSourceCount || physical <= previous) {
      throw new Error(
        'active physical sources must be unique, ascending, and in range'
      );
    }
    previous = physical;
  }
  return active;
}

export function projectStableOrderToPhysical({
  orderWords,
  sourceDomain,
  physicalSourceCount,
  activePhysicalSources,
  stencilSize = FIELD_STENCIL_SIZE
}) {
  const physicalCount = integer(
    physicalSourceCount,
    'physicalSourceCount',
    1
  );
  const stencil = integer(stencilSize, 'stencilSize', 1);
  const active = validateActivePhysicalSources({
    activePhysicalSources,
    physicalSourceCount: physicalCount
  });
  const order = uint32Words(orderWords, 'stable order words');
  const activeSet = new Set(active);
  const projected = [];
  if (sourceDomain === 'physical') {
    if (order.length !== physicalCount * stencil) {
      throw new Error('physical stable order length does not equal P*stencil');
    }
    for (const candidate of order) {
      if (candidate >= physicalCount * stencil) {
        throw new Error('physical stable order candidate is out of range');
      }
      if (activeSet.has(Math.floor(candidate / stencil))) {
        projected.push(candidate);
      }
    }
  } else if (sourceDomain === 'active-ordinal') {
    if (order.length !== active.length * stencil) {
      throw new Error('active stable order length does not equal A*stencil');
    }
    for (const candidate of order) {
      if (candidate >= active.length * stencil) {
        throw new Error('active stable order candidate is out of range');
      }
      const activeOrdinal = Math.floor(candidate / stencil);
      const stencilOrdinal = candidate % stencil;
      projected.push(active[activeOrdinal] * stencil + stencilOrdinal);
    }
  } else {
    throw new TypeError(
      'sourceDomain must be physical or active-ordinal'
    );
  }
  if (projected.length !== active.length * stencil) {
    throw new Error('projected stable order does not cover A*stencil');
  }
  const seen = new Set(projected);
  if (seen.size !== projected.length) {
    throw new Error('projected stable order contains duplicate candidates');
  }
  for (const physical of active) {
    for (let ordinal = 0; ordinal < stencil; ordinal += 1) {
      if (!seen.has(physical * stencil + ordinal)) {
        throw new Error('projected stable order omitted an active candidate');
      }
    }
  }
  return Uint32Array.from(projected);
}

export function validateCrossAuthorityFieldHeaders({
  historicalHeader,
  currentHeader,
  physicalSourceCount,
  activeSourceCount
}) {
  const historical = uint32Words(historicalHeader, 'historical header');
  const current = uint32Words(currentHeader, 'current header');
  const physicalCount = integer(
    physicalSourceCount,
    'physicalSourceCount',
    1
  );
  const activeCount = integer(
    activeSourceCount,
    'activeSourceCount',
    1,
    physicalCount
  );
  if (
    historical.length !== FIELD_HEADER_WORDS
    || current.length !== FIELD_HEADER_WORDS
  ) {
    throw new Error('field headers must contain exactly 64 words');
  }
  const historicalDomainCount = physicalCount * FIELD_STENCIL_SIZE;
  const currentDomainCount = activeCount * FIELD_STENCIL_SIZE;
  for (const word of [
    FIELD_CANDIDATE_COUNT_WORD,
    FIELD_UNIQUE_ELEMENT_COUNT_WORD
  ]) {
    if (
      historical[word] !== historicalDomainCount
      || current[word] !== currentDomainCount
    ) {
      throw new Error(
        `field header word ${word} does not authenticate its candidate domain`
      );
    }
  }
  for (let word = 0; word < FIELD_HEADER_WORDS; word += 1) {
    if (
      word !== FIELD_CANDIDATE_COUNT_WORD
      && word !== FIELD_UNIQUE_ELEMENT_COUNT_WORD
      && historical[word] !== current[word]
    ) {
      throw new Error(`field header semantic mismatch at word ${word}`);
    }
  }
  return true;
}

function parseBooleanFlag(argv, flag) {
  const index = argv.indexOf(flag);
  return index >= 0;
}

function optionValue(argv, flag, fallback = null) {
  const index = argv.indexOf(flag);
  if (index < 0) return fallback;
  if (index === argv.length - 1 || argv[index + 1].startsWith('--')) {
    throw new TypeError(`${flag} requires a value`);
  }
  return argv[index + 1];
}

export function parseArgs(argv = process.argv.slice(2)) {
  const executeNative = parseBooleanFlag(argv, '--execute-native');
  const dryRun = parseBooleanFlag(argv, '--dry-run') || !executeNative;
  if (executeNative && parseBooleanFlag(argv, '--dry-run')) {
    throw new TypeError('--execute-native and --dry-run are mutually exclusive');
  }
  const repoRoot = path.resolve(
    optionValue(argv, '--repo-root', DEFAULT_REPO_ROOT)
  );
  const output = path.resolve(optionValue(
    argv,
    '--output',
    path.join(
      os.homedir(),
      '.cache',
      'icc',
      'repos',
      'ulg',
      'benchmarks',
      `paired-field-sparse-ab-${Date.now()}.json`
    )
  ));
  return Object.freeze({
    dryRun,
    executeNative,
    checkServers: parseBooleanFlag(argv, '--check-servers'),
    keepTemp: parseBooleanFlag(argv, '--keep-temp'),
    requireCgroupCap:
      !parseBooleanFlag(argv, '--allow-uncapped-dry-run'),
    includeCurrentReducedActive:
      !parseBooleanFlag(argv, '--omit-current-reduced-active'),
    includeCurrentIndependent:
      !parseBooleanFlag(argv, '--omit-current-independent'),
    repoRoot,
    output,
    historicalCommit: optionValue(
      argv,
      '--historical-commit',
      HISTORICAL_COMMIT
    ),
    historicalPort: integer(
      optionValue(argv, '--historical-port', HISTORICAL_SERVER_PORT),
      'historicalPort',
      1,
      65535
    ),
    currentPort: integer(
      optionValue(argv, '--current-port', CURRENT_SERVER_PORT),
      'currentPort',
      1,
      65535
    ),
    sparseWarmups: integer(
      optionValue(argv, '--sparse-warmups', 4),
      'sparseWarmups',
      1,
      100
    ),
    sparseSamples: integer(
      optionValue(argv, '--sparse-samples', 9),
      'sparseSamples',
      3,
      100
    ),
    allActiveWarmups: integer(
      optionValue(argv, '--all-active-warmups', 2),
      'allActiveWarmups',
      1,
      100
    ),
    allActiveSamples: integer(
      optionValue(argv, '--all-active-samples', 5),
      'allActiveSamples',
      3,
      100
    ),
    reducedWarmups: integer(
      optionValue(argv, '--reduced-warmups', 2),
      'reducedWarmups',
      1,
      100
    ),
    reducedSamples: integer(
      optionValue(argv, '--reduced-samples', 5),
      'reducedSamples',
      3,
      100
    ),
    armTimeoutMs: integer(
      optionValue(argv, '--arm-timeout-ms', 180_000),
      'armTimeoutMs',
      30_000,
      600_000
    )
  });
}

export function scenarioDefinitions(options) {
  return Object.freeze({
    sparse: Object.freeze({
      id: 'sparse-p8192-active4500-default-tier',
      comparisonClass: 'historical-fairness',
      physicalSourceCount: 8_192,
      activeSourceCount: 4_500,
      activeSourceCapacity: null,
      retainedPhysicalTier: 8_192,
      retainedActiveTier: 8_192,
      candidateCount: 4_500 * 27,
      candidateCapacity: 8_192 * 27,
      exactNearCellTreeEnabled: true,
      warmups: options.sparseWarmups,
      samples: options.sparseSamples
    }),
    allActive: Object.freeze({
      id: 'all-active-p8192-a8192-default-tier',
      comparisonClass: 'historical-fairness',
      physicalSourceCount: 8_192,
      activeSourceCount: 8_192,
      activeSourceCapacity: null,
      retainedPhysicalTier: 8_192,
      retainedActiveTier: 8_192,
      candidateCount: 8_192 * 27,
      candidateCapacity: 8_192 * 27,
      exactNearCellTreeEnabled: true,
      warmups: options.allActiveWarmups,
      samples: options.allActiveSamples
    }),
    currentReducedActive: Object.freeze({
      id: 'current-only-p8192-a4500-reduced-tier',
      comparisonClass: 'current-only-attribution',
      physicalSourceCount: 8_192,
      activeSourceCount: 4_500,
      activeSourceCapacity: 4_500,
      retainedPhysicalTier: 8_192,
      retainedActiveTier: 4_500,
      candidateCount: 4_500 * 27,
      candidateCapacity: 4_500 * 27,
      // The current exact-near runtime still authenticates the default cell
      // tier. Keep this attribution arm explicit and outside the fairness
      // ratio rather than silently changing the historical route.
      exactNearCellTreeEnabled: false,
      warmups: options.reducedWarmups,
      samples: options.reducedSamples
    })
  });
}

export function buildRunSchedule(options) {
  const scenarios = scenarioDefinitions(options);
  const fairness = DEFAULT_SCHEDULE.map((arm, blockIndex) => ({
    arm,
    blockIndex,
    scenarioIds: blockIndex === 2 || blockIndex === 3
      ? [scenarios.allActive.id, scenarios.sparse.id]
      : [scenarios.sparse.id, scenarios.allActive.id]
  }));
  return Object.freeze([
    ...fairness,
    ...(options.includeCurrentIndependent
      ? [{
          arm: 'current-independent',
          blockIndex: 'containment',
          scenarioIds: [scenarios.sparse.id, scenarios.allActive.id]
        }]
      : []),
    ...(options.includeCurrentReducedActive
      ? [{
          arm: 'current',
          blockIndex: 'attribution',
          scenarioIds: [scenarios.currentReducedActive.id]
        }]
      : [])
  ]);
}

export function validateOptions(options) {
  if (options.historicalCommit !== HISTORICAL_COMMIT) {
    throw new RangeError(
      `historicalCommit must remain pinned to ${HISTORICAL_COMMIT}`
    );
  }
  for (const [label, port] of [
    ['historicalPort', options.historicalPort],
    ['currentPort', options.currentPort]
  ]) {
    if (port === VPN_SERVER_PORT) {
      throw new RangeError(`${label} must not use VPN server port 5174`);
    }
  }
  if (options.historicalPort === options.currentPort) {
    throw new RangeError('historicalPort and currentPort must be distinct');
  }
  const scenarios = scenarioDefinitions(options);
  for (const scenario of [scenarios.sparse, scenarios.allActive]) {
    if (
      scenario.activeSourceCapacity !== null
      || scenario.physicalSourceCount !== scenario.retainedPhysicalTier
      || scenario.retainedActiveTier !== scenario.retainedPhysicalTier
    ) {
      throw new Error(
        `${scenario.id} must preserve the exact shared default A=P capacity`
      );
    }
  }
  if (
    scenarios.sparse.physicalSourceCount !== 8_192
    || scenarios.sparse.activeSourceCount !== 4_500
  ) {
    throw new Error('sparse fairness scenario must remain P=8,192/A=4,500');
  }
  if (
    scenarios.allActive.physicalSourceCount !== 8_192
    || scenarios.allActive.activeSourceCount !== 8_192
    || scenarios.allActive.retainedPhysicalTier !== 8_192
  ) {
    throw new Error('all-active fairness scenario must remain P=A=8,192');
  }
  return true;
}

export function mechanicsFieldPairV2EnabledForSparseAbArm(arm) {
  if (!['historical', 'current', 'current-independent'].includes(arm)) {
    throw new RangeError(`unknown paired sparse A/B arm: ${arm}`);
  }
  return arm === 'current';
}

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function sha256File(target) {
  const handle = await open(target, 'r');
  const hash = createHash('sha256');
  try {
    for await (const chunk of handle.createReadStream()) hash.update(chunk);
  } finally {
    await handle.close();
  }
  return hash.digest('hex');
}

async function manifestEntries(root, relative = '') {
  const target = path.join(root, relative);
  const entries = await readdir(target, { withFileTypes: true });
  const rows = [];
  for (const entry of entries.sort((left, right) => (
    left.name.localeCompare(right.name)
  ))) {
    if (!relative && SNAPSHOT_EXCLUDES.has(entry.name)) continue;
    const childRelative = path.join(relative, entry.name);
    const childTarget = path.join(root, childRelative);
    if (entry.isDirectory()) {
      rows.push(...await manifestEntries(root, childRelative));
    } else if (entry.isFile()) {
      const stat = await lstat(childTarget);
      rows.push({
        path: childRelative.split(path.sep).join('/'),
        type: 'file',
        size: stat.size,
        sha256: await sha256File(childTarget)
      });
    } else if (entry.isSymbolicLink()) {
      rows.push({
        path: childRelative.split(path.sep).join('/'),
        type: 'symlink',
        target: await readlink(childTarget)
      });
    }
  }
  return rows;
}

function digestManifest(entries) {
  return createHash('sha256')
    .update(JSON.stringify(entries))
    .digest('hex');
}

export async function buildSourceManifest(root) {
  const entries = await manifestEntries(root);
  return Object.freeze({
    root,
    entryCount: entries.length,
    digest: digestManifest(entries),
    entries
  });
}

async function runProcess(command, args, {
  cwd = undefined,
  env = process.env,
  stdout = 'inherit',
  stderr = 'inherit'
} = {}) {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ['ignore', stdout, stderr]
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve({ code, signal });
      else reject(new Error(
        `${command} exited ${code ?? `by ${signal || 'unknown signal'}`}`
      ));
    });
  });
}

async function materializeHistoricalSnapshot(repoRoot, destination, commit) {
  await mkdir(destination, { recursive: true });
  await new Promise((resolve, reject) => {
    const archive = spawn('git', [
      '-C',
      repoRoot,
      'archive',
      '--format=tar',
      commit
    ], { stdio: ['ignore', 'pipe', 'inherit'] });
    const extract = spawn('tar', ['-xf', '-', '-C', destination], {
      stdio: [archive.stdout, 'inherit', 'inherit']
    });
    let archiveCode = null;
    let extractCode = null;
    const finish = () => {
      if (archiveCode == null || extractCode == null) return;
      if (archiveCode === 0 && extractCode === 0) resolve();
      else reject(new Error(
        `historical snapshot failed: git=${archiveCode}, tar=${extractCode}`
      ));
    };
    archive.once('error', reject);
    extract.once('error', reject);
    archive.once('exit', (code) => {
      archiveCode = code;
      finish();
    });
    extract.once('exit', (code) => {
      extractCode = code;
      finish();
    });
  });
}

function currentCopyFilter(repoRoot, source) {
  const relative = path.relative(repoRoot, source);
  if (!relative) return true;
  const [top] = relative.split(path.sep);
  return !SNAPSHOT_EXCLUDES.has(top);
}

async function linkNodeModules(snapshot, preferredTargets) {
  const target = preferredTargets.find((candidate) => candidate && existsSync(
    candidate
  ));
  if (!target) {
    throw new Error('no compatible node_modules directory is available');
  }
  await symlink(await realpath(target), path.join(snapshot, 'node_modules'));
  return await realpath(target);
}

export async function createSnapshots(options) {
  const projectRoot = path.dirname(options.repoRoot);
  const tempRoot = await mkdtemp(path.join(projectRoot, SNAPSHOT_PREFIX));
  const historicalRoot = path.join(tempRoot, 'historical');
  const currentRoot = path.join(tempRoot, 'current');
  try {
    const siblingLinks = {};
    for (const sibling of ['peercompute', 'webgpu-marching-cubes']) {
      const source = path.join(projectRoot, sibling);
      if (!(await exists(source))) {
        throw new Error(`required Vite sibling is unavailable: ${source}`);
      }
      await symlink(await realpath(source), path.join(tempRoot, sibling));
      siblingLinks[sibling] = await realpath(source);
    }
    const currentBefore = await buildSourceManifest(options.repoRoot);
    await materializeHistoricalSnapshot(
      options.repoRoot,
      historicalRoot,
      options.historicalCommit
    );
    await cp(options.repoRoot, currentRoot, {
      recursive: true,
      dereference: false,
      filter: (source) => currentCopyFilter(options.repoRoot, source)
    });
    const historicalNodeModules = path.join(
      projectRoot,
      'ulg-perf-2d31a50',
      'node_modules'
    );
    const currentNodeModules = path.join(options.repoRoot, 'node_modules');
    const historicalNodeModulesTarget = await linkNodeModules(
      historicalRoot,
      [historicalNodeModules, currentNodeModules]
    );
    const currentNodeModulesTarget = await linkNodeModules(
      currentRoot,
      [currentNodeModules]
    );
    const currentAfter = await buildSourceManifest(options.repoRoot);
    const currentSnapshot = await buildSourceManifest(currentRoot);
    const historicalSnapshot = await buildSourceManifest(historicalRoot);
    if (
      currentBefore.digest !== currentAfter.digest
      || currentBefore.digest !== currentSnapshot.digest
    ) {
      throw new Error(
        'current source changed while snapshotting or snapshot manifest diverged'
      );
    }
    return Object.freeze({
      tempRoot,
      historicalRoot,
      currentRoot,
      historicalNodeModulesTarget,
      currentNodeModulesTarget,
      siblingLinks: Object.freeze(siblingLinks),
      currentSourceManifest: currentSnapshot,
      historicalSourceManifest: historicalSnapshot
    });
  } catch (error) {
    await safeCleanupSnapshot(tempRoot);
    throw error;
  }
}

export async function safeCleanupSnapshot(tempRoot) {
  const resolved = path.resolve(tempRoot);
  if (
    path.basename(resolved).startsWith(SNAPSHOT_PREFIX) !== true
    || path.dirname(resolved) !== path.dirname(DEFAULT_REPO_ROOT)
  ) {
    throw new Error(`refusing to clean non-benchmark snapshot: ${resolved}`);
  }
  await rm(resolved, { recursive: true, force: true });
  return !(await exists(resolved));
}

async function probePort(port) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen({ host: '127.0.0.1', port, exclusive: true }, () => {
      server.close((error) => error ? reject(error) : resolve());
    });
  });
}

export async function ensurePortsAvailable(ports) {
  for (const port of ports) {
    if (port === VPN_SERVER_PORT) {
      throw new RangeError('benchmark port probe must never touch VPN port 5174');
    }
    await probePort(port);
  }
  return true;
}

export async function inspectCgroupLimits() {
  const cgroupText = await readFile('/proc/self/cgroup', 'utf8');
  const unified = cgroupText
    .trim()
    .split('\n')
    .map((line) => line.split(':'))
    .find(([hierarchy, controllers]) => hierarchy === '0' && controllers === '');
  if (!unified) {
    return {
      ready: false,
      reason: 'unified cgroup v2 membership unavailable'
    };
  }
  const relative = unified[2] || '/';
  const base = path.join('/sys/fs/cgroup', relative);
  const [memoryMaxText, swapMaxText] = await Promise.all([
    readFile(path.join(base, 'memory.max'), 'utf8'),
    readFile(path.join(base, 'memory.swap.max'), 'utf8')
  ]);
  const parseLimit = (text) => {
    const trimmed = text.trim();
    return trimmed === 'max' ? null : Number(trimmed);
  };
  const memoryMax = parseLimit(memoryMaxText);
  const swapMax = parseLimit(swapMaxText);
  return {
    ready:
      Number.isFinite(memoryMax)
      && memoryMax > 0
      && memoryMax <= MEMORY_LIMIT_BYTES
      && swapMax === 0,
    cgroupPath: relative,
    memoryMax,
    swapMax
  };
}

function percentile(values, fraction) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(
    0,
    Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)
  );
  return sorted[index];
}

export function summarizeSamples(samples) {
  const wall = samples.map((sample) => sample.queueCompleteWallMs);
  const generationGpu = samples.map((sample) => sample.generationGpuMs);
  const fieldGpu = samples.map((sample) => sample.fieldGpuMs);
  return Object.freeze({
    sampleCount: samples.length,
    queueCompleteWallMedianMs: percentile(wall, 0.5),
    queueCompleteWallP95Ms: percentile(wall, 0.95),
    generationGpuMedianMs: percentile(generationGpu, 0.5),
    generationGpuP95Ms: percentile(generationGpu, 0.95),
    fieldGpuMedianMs: percentile(fieldGpu, 0.5),
    fieldGpuP95Ms: percentile(fieldGpu, 0.95)
  });
}

export function startServer(snapshotRoot, port, label) {
  const logs = [];
  const vite = path.join(snapshotRoot, 'node_modules', '.bin', 'vite');
  const child = spawn(vite, [
    '--host',
    '127.0.0.1',
    '--port',
    String(port),
    '--strictPort'
  ], {
    cwd: snapshotRoot,
    env: {
      ...process.env,
      ULG_VITE_HTTPS: '0',
      ULG_VITE_PORT: String(port)
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const capture = (chunk) => {
    logs.push(String(chunk));
    if (logs.length > 200) logs.splice(0, logs.length - 200);
  };
  child.stdout.on('data', capture);
  child.stderr.on('data', capture);
  return { child, label, port, logs };
}

export async function waitForServer(server, timeoutMs = 60_000) {
  const url = `http://127.0.0.1:${server.port}/`;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (server.child.exitCode != null) {
      throw new Error(
        `${server.label} server exited early:\n${server.logs.join('')}`
      );
    }
    try {
      const response = await fetch(url);
      if (response.status === 200) return url;
    } catch {
      // Server transform warmup is still in progress.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`${server.label} server did not become ready at ${url}`);
}

export async function stopServer(server) {
  if (!server || server.child.exitCode != null) return true;
  server.child.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => server.child.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 5_000))
  ]);
  if (server.child.exitCode == null) {
    server.child.kill('SIGKILL');
    await new Promise((resolve) => server.child.once('exit', resolve));
  }
  return true;
}

export async function runBrowserArm({
  baseUrl,
  arm,
  scenarioConfigs,
  timeoutMs
}) {
  const mechanicsFieldPairV2Enabled =
    mechanicsFieldPairV2EnabledForSparseAbArm(arm);
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath:
      process.env.ULG_MECHANICS_FIELD_PAIR_CHROME
      || '/usr/bin/google-chrome',
    headless: true,
    args: [
      '--use-angle=vulkan',
      '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu',
      '--ignore-gpu-blocklist'
    ]
  });
  try {
    const page = await browser.newPage();
    await page.goto(baseUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000
    });
    const evaluation = page.evaluate(async ({
      arm,
      scenarioConfigs,
      mechanicsFieldPairV2Enabled
    }) => {
      const adapter = await navigator.gpu?.requestAdapter({
        powerPreference: 'high-performance'
      });
      if (!adapter) {
        throw new Error('WebGPU adapter unavailable');
      }
      if (!adapter.features.has('timestamp-query')) {
        throw new Error('timestamp-query is required for the paired A/B');
      }
      const device = await adapter.requestDevice({
        requiredFeatures: ['timestamp-query']
      });
      const errors = [];
      device.addEventListener('uncapturederror', (event) => {
        errors.push(event.error?.message || String(event.error));
      });
      const nonce = `${Date.now()}-${Math.random()}`;
      const spatial = await import(
        `/src/runtime/sph/schroederSpatialEpochGpu.js?pairedAb=${nonce}`
      );

      const createBuffer = (label, values, usage) => {
        const buffer = device.createBuffer({
          label,
          size: Math.max(4, values.byteLength),
          usage
        });
        device.queue.writeBuffer(buffer, 0, values);
        return buffer;
      };
      const bytesToHex = (bytes) => [...new Uint8Array(bytes)]
        .map((value) => value.toString(16).padStart(2, '0'))
        .join('');
      const hashBytes = async (bytes) => bytesToHex(
        await crypto.subtle.digest('SHA-256', bytes)
      );
      const canonicalDescriptorWords = (bytes) => {
        const words = new Uint32Array(bytes);
        if (words.length % 32 !== 0) {
          throw new Error('descriptor evidence has an incomplete row');
        }
        const canonical = words.slice();
        for (let base = 0; base < canonical.length; base += 32) {
          const status = canonical[base + 3];
          if (status !== 0 && status !== 1) {
            throw new Error(
              `descriptor row ${base / 32} has invalid status ${status}`
            );
          }
          if (status === 0) canonical.fill(0, base + 4, base + 32);
        }
        return canonical;
      };
      const projectStableOrder = ({
        bytes,
        sourceDomain,
        physicalCount,
        activePhysical
      }) => {
        const stencil = 27;
        const order = new Uint32Array(bytes);
        const activeSet = new Set(activePhysical);
        const projected = [];
        const domainCount = sourceDomain === 'physical'
          ? physicalCount
          : activePhysical.length;
        if (order.length !== domainCount * stencil) {
          throw new Error(
            `${sourceDomain} stable order does not cover its exact domain`
          );
        }
        for (const candidate of order) {
          if (candidate >= domainCount * stencil) {
            throw new Error(
              `${sourceDomain} stable order candidate is out of range`
            );
          }
          if (sourceDomain === 'physical') {
            if (activeSet.has(Math.floor(candidate / stencil))) {
              projected.push(candidate);
            }
          } else {
            const activeOrdinal = Math.floor(candidate / stencil);
            projected.push(
              activePhysical[activeOrdinal] * stencil
              + candidate % stencil
            );
          }
        }
        if (projected.length !== activePhysical.length * stencil) {
          throw new Error(
            'canonical stable order does not cover every active candidate'
          );
        }
        const seen = new Set(projected);
        if (seen.size !== projected.length) {
          throw new Error('canonical stable order contains duplicates');
        }
        for (const physical of activePhysical) {
          for (let ordinal = 0; ordinal < stencil; ordinal += 1) {
            if (!seen.has(physical * stencil + ordinal)) {
              throw new Error(
                'canonical stable order omitted an active candidate'
              );
            }
          }
        }
        return Uint32Array.from(projected);
      };
      const readRange = async (buffer, offset, size, label) => {
        const alignedSize = Math.max(4, Math.ceil(size / 4) * 4);
        const readback = device.createBuffer({
          label,
          size: alignedSize,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        const encoder = device.createCommandEncoder({ label: `${label}-copy` });
        encoder.copyBufferToBuffer(buffer, offset, readback, 0, alignedSize);
        device.queue.submit([encoder.finish()]);
        await readback.mapAsync(GPUMapMode.READ);
        const bytes = readback.getMappedRange().slice(0, size);
        readback.unmap();
        readback.destroy();
        return bytes;
      };
      const createRecorder = (capacity = 2048) => {
        const querySet = device.createQuerySet({
          type: 'timestamp',
          count: capacity * 2
        });
        const resolveBuffer = device.createBuffer({
          size: capacity * 16,
          usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC
        });
        const readback = device.createBuffer({
          size: capacity * 16,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        const spans = [];
        let next = 0;
        const recorder = {
          active: true,
          beginEncoderSpan(encoder, descriptor = {}) {
            if (next + 2 > capacity * 2) {
              throw new RangeError('timestamp query capacity exhausted');
            }
            const token = {
              descriptor: { ...descriptor },
              begin: next,
              end: next + 1,
              encoder
            };
            next += 2;
            encoder.writeTimestamp(querySet, token.begin);
            spans.push(token);
            return token;
          },
          endEncoderSpan(encoder, token) {
            if (token.encoder !== encoder) {
              throw new Error('timestamp encoder mismatch');
            }
            encoder.writeTimestamp(querySet, token.end);
          },
          discardEncoderSpans() {
            throw new Error('measured generation discarded its timestamp spans');
          },
          markQueueBoundary() {}
        };
        return {
          recorder,
          async read() {
            const encoder = device.createCommandEncoder({
              label: 'paired-ab-timestamp-resolve'
            });
            encoder.resolveQuerySet(querySet, 0, next, resolveBuffer, 0);
            encoder.copyBufferToBuffer(
              resolveBuffer,
              0,
              readback,
              0,
              next * BigUint64Array.BYTES_PER_ELEMENT
            );
            device.queue.submit([encoder.finish()]);
            await readback.mapAsync(GPUMapMode.READ);
            const words = new BigUint64Array(
              readback.getMappedRange().slice(0, next * 8)
            );
            readback.unmap();
            return spans.map((span) => ({
              descriptor: span.descriptor,
              durationMs: Number(words[span.end] - words[span.begin]) / 1e6
            }));
          },
          destroy() {
            querySet.destroy?.();
            resolveBuffer.destroy();
            readback.destroy();
          }
        };
      };

      const buildFixture = (scenario) => {
        const physicalCount = scenario.physicalSourceCount;
        const activePhysical = scenario.activeSourceCount === physicalCount
          ? Array.from({ length: physicalCount }, (_, index) => index)
          : Array.from(
              { length: scenario.activeSourceCount },
              (_, ordinal) => (ordinal * 37) % physicalCount
            ).sort((left, right) => left - right);
        const activeSet = new Set(activePhysical);
        const assignment = new Float32Array(physicalCount * 16);
        const state = new Float32Array(physicalCount * 8);
        const identity = new Uint32Array(physicalCount);
        for (let physical = 0; physical < physicalCount; physical += 1) {
          const level = physical & 1;
          const active = activeSet.has(physical);
          const row = physical * 16;
          assignment[row] = level;
          assignment[row + 1] = level === 0 ? 0.25 : 0.5;
          assignment[row + 2] = active ? 0.1 : 0;
          assignment[row + 3] = active ? 0.001 : 0;
          assignment[row + 4] = active ? 0.001 : 0;
          assignment[row + 5] = active ? 0.001 : 0;
          assignment[row + 6] = active ? 1 : 0;
          assignment[row + 7] = active ? 1000 : 0;
          assignment[row + 8] = 1;
          assignment[row + 9] = level === 0 ? 11 : 22;
          assignment[row + 10] = 1;
          assignment[row + 12] = 0.5;
          assignment[row + 13] = 0.5;
          assignment[row + 14] = 0.5;
          const stateRow = physical * 8;
          state[stateRow] = 0.5;
          state[stateRow + 1] = 0.5;
          state[stateRow + 2] = 0.5;
          state[stateRow + 3] = active ? 1 : 0;
          identity[physical] = (0x0010_0000 + physical) >>> 0;
        }
        const assignmentBuffer = createBuffer(
          `${scenario.id}-assignment`,
          assignment,
          GPUBufferUsage.STORAGE
            | GPUBufferUsage.COPY_DST
            | GPUBufferUsage.COPY_SRC
        );
        const stateBuffer = createBuffer(
          `${scenario.id}-state`,
          state,
          GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        );
        const identityBuffer = createBuffer(
          `${scenario.id}-identity`,
          identity,
          GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        );
        const epoch = {
          storageGeneration: 101,
          physicsTick: 103,
          physicsSubstep: 0,
          positionEpoch: 107,
          topologyEpoch: 109,
          chartEpoch: 113,
          levelEpoch: 127,
          supportEpoch: 131
        };
        const levelAssignment = {
          schema: 'peercompute.ulg.schroeder-level-assignment-execution.v0',
          status: 'schroeder-level-assignment-submitted',
          bufferFamilyGenerationStatus:
            'schroeder-particle-buffer-family-generation-ready',
          particleCount: physicalCount,
          assignmentStrideFloats: 16,
          assignmentBuffer,
          assignmentBufferByteLength: assignment.byteLength,
          sourceStateBuffer: stateBuffer,
          sourceStateBufferBorrowed: true,
          ...epoch,
          minLevel: 0,
          maxLevel: 1,
          chartId: 0,
          baseGridSpacingM: 0.25
        };
        return {
          activePhysical,
          assignmentBuffer,
          stateBuffer,
          identityBuffer,
          levelAssignment,
          destroy() {
            assignmentBuffer.destroy();
            stateBuffer.destroy();
            identityBuffer.destroy();
          }
        };
      };
      const grids = [
        {
          gridNodeCount: 512,
          gridDims: [8, 8, 8],
          gridShift: 2,
          gridSpacingM: 0.25
        },
        {
          gridNodeCount: 125,
          gridDims: [5, 5, 5],
          gridShift: 2,
          gridSpacingM: 0.5
        }
      ];
      const buildGeneration = (fixture, scenario, recorder = null) => {
        const common = {
          device,
          levelAssignment: fixture.levelAssignment,
          particleCount: scenario.physicalSourceCount,
          particleIdentityBuffer: fixture.identityBuffer,
          particleIdentityStrideWords: 1,
          mechanicsLevels: grids.map((mechanicsGrid, selectedLevel) => ({
            selectedLevel,
            mechanicsGrid
          })),
          mechanicsFieldPairV2Enabled,
          directArenaCount: 1,
          gpuTimestampRecorder: recorder
        };
        if (scenario.comparisonClass === 'current-only-attribution') {
          common.activeSourceCapacity = scenario.activeSourceCapacity;
          common.phaseVolumeSidecarsEnabled = false;
          common.exactNearCellTreeEnabled =
            scenario.exactNearCellTreeEnabled;
        }
        return spatial.runSchroederSpatialEpochGenerationWebGpu(common);
      };
      const assertRoute = (generation, scenario) => {
        if (generation.ready !== true || generation.selected !== true) {
          throw new Error(
            `${scenario.id} rejected: ${generation.status}: ${generation.reason}`
          );
        }
        if (
          generation.mechanicsLevelCount !== 2
          || generation.mechanicsLevelViews.length !== 2
          || !generation.parentFieldView
          || !generation.hierarchyView
          || !generation.activeSourceView
          || generation.execution.readbackPerformed !== false
          || generation.activeSourceView.readbackPerformed !== false
          || generation.mechanicsLevelViews.some(
            ({ mechanicsFieldView }) => mechanicsFieldView.readbackPerformed
              !== false
          )
        ) {
          throw new Error(`${scenario.id} did not retain the exact route`);
        }
        if (
          scenario.comparisonClass === 'historical-fairness'
          && !generation.exactNearCellTree
        ) {
          throw new Error(`${scenario.id} omitted the matched exact-near tree`);
        }
        if (
          mechanicsFieldPairV2Enabled
          && scenario.comparisonClass === 'historical-fairness'
        ) {
          if (
            !generation.mechanicsFieldPair
            || generation.mechanicsFieldPair.sharedRadixExecutionCount !== 1
            || generation.mechanicsFieldPairV2Enabled !== true
            || generation.mechanicsFieldConstructionMode
              !== 'paired-v2-shared-radix'
          ) {
            throw new Error(`${scenario.id} current arm did not use one pair`);
          }
        }
        if (
          !mechanicsFieldPairV2Enabled
          && generation.mechanicsFieldPair != null
        ) {
          throw new Error(`${scenario.id} independent arm unexpectedly used a pair`);
        }
        if (
          arm === 'current-independent'
          && (
            generation.mechanicsFieldPairV2Enabled !== false
            || generation.mechanicsFieldConstructionMode !== 'independent-v2'
          )
        ) {
          throw new Error(
            `${scenario.id} current-independent arm did not retain independent-v2`
          );
        }
      };
      const release = async (generation) => {
        if (!spatial.releaseSchroederSpatialEpochGenerationAfterQueue(
          generation,
          device
        )) {
          throw new Error('generation release was not scheduled');
        }
        if (await generation.releasePromise !== true) {
          throw new Error('generation release did not complete');
        }
      };
      const diagnose = async (fixture, scenario) => {
        const generation = buildGeneration(fixture, scenario);
        assertRoute(generation, scenario);
        await device.queue.onSubmittedWorkDone();
        const active = generation.activeSourceView;
        const activeBytes = await readRange(
          active.activeSourceViewBuffer,
          0,
          active.layout.byteLength,
          `${scenario.id}-active-diagnostic`
        );
        const activeWords = new Uint32Array(activeBytes);
        const activeCount = activeWords[18];
        const activeToPhysicalOffset = activeWords[25];
        if (
          activeToPhysicalOffset > activeWords.length
          || activeCount > activeWords.length - activeToPhysicalOffset
        ) {
          throw new Error('ActiveSource forward map is out of bounds');
        }
        const activePhysical = Array.from(
          activeWords.subarray(
            activeToPhysicalOffset,
            activeToPhysicalOffset + activeCount
          )
        );
        const physicalToActiveOffset = activeWords[26];
        if (
          physicalToActiveOffset > activeWords.length
          || scenario.physicalSourceCount
            > activeWords.length - physicalToActiveOffset
        ) {
          throw new Error('ActiveSource reverse map is out of bounds');
        }
        for (let ordinal = 0; ordinal < activePhysical.length; ordinal += 1) {
          if (
            activePhysical[ordinal] >= scenario.physicalSourceCount
            || (
              ordinal > 0
              && activePhysical[ordinal] <= activePhysical[ordinal - 1]
            )
          ) {
            throw new Error(
              'ActiveSource forward map is not unique ascending physical identity'
            );
          }
        }
        const semanticMapWords = new Uint32Array(
          activeCount + scenario.physicalSourceCount
        );
        semanticMapWords.set(activePhysical);
        semanticMapWords.set(
          activeWords.subarray(
            physicalToActiveOffset,
            physicalToActiveOffset + scenario.physicalSourceCount
          ),
          activeCount
        );
        const children = generation.mechanicsLevelViews.map(
          ({ mechanicsFieldView }) => mechanicsFieldView
        );
        const childEvidence = [];
        for (const [index, child] of children.entries()) {
          const descriptorBytes = await readRange(
            child.fieldViewBuffer,
            child.layout.descriptorOffsetWords * 4,
            child.layout.descriptorCapacityWords * 4,
            `${scenario.id}-child-${index}-descriptors`
          );
          const headerBytes = await readRange(
            child.fieldViewBuffer,
            0,
            64 * 4,
            `${scenario.id}-child-${index}-header`
          );
          const header = new Uint32Array(headerBytes);
          const keyBytes = await readRange(
            child.fieldViewBuffer,
            child.layout.keyOffsetWords * 4,
            header[34] * child.layout.keyWords * 4,
            `${scenario.id}-child-${index}-keys`
          );
          const orderBytes = await readRange(
            child.stableCandidateOrderBuffer,
            0,
            header[33] * 4,
            `${scenario.id}-child-${index}-order`
          );
          const canonicalDescriptors =
            canonicalDescriptorWords(descriptorBytes);
          const canonicalOrder = projectStableOrder({
            bytes: orderBytes,
            sourceDomain:
              arm === 'historical' ? 'physical' : 'active-ordinal',
            physicalCount: scenario.physicalSourceCount,
            activePhysical
          });
          childEvidence.push({
            header: Array.from(header),
            descriptorHash: await hashBytes(descriptorBytes),
            canonicalDescriptorHash:
              await hashBytes(canonicalDescriptors.buffer),
            keyHash: await hashBytes(keyBytes),
            stableOrderHash: await hashBytes(orderBytes),
            canonicalStableOrderHash:
              await hashBytes(canonicalOrder.buffer),
            canonicalStableOrderCount: canonicalOrder.length,
            candidateSourceDomain:
              arm === 'historical' ? 'physical' : 'active-ordinal'
          });
        }
        const parentBytes = await readRange(
          generation.parentFieldView.parentFieldViewBuffer,
          0,
          80 * 4,
          `${scenario.id}-parent-header`
        );
        const parentHeader = Array.from(new Uint32Array(parentBytes));
        const evidence = {
          directorySchema: generation.directorySchema,
          directoryRuntimeCacheKey: generation.directoryRuntimeCacheKey,
          physicalSourceCount: generation.execution.physicalSourceCount,
          physicalSourceCapacity: generation.execution.physicalSourceCapacity,
          activeSourceCapacity: active.activeSourceCapacity,
          activeCount,
          dormantCount: activeWords[20],
          overflowCount: activeWords[22],
          candidateCount: activeWords[43],
          activeMapHash: await hashBytes(semanticMapWords.buffer),
          activeViewOrdinalEvidence: {
            buildOrdinal: activeWords[29],
            completionOrdinal: activeWords[30],
            projectionSeal: activeWords[47]
          },
          pairPresent: Boolean(generation.mechanicsFieldPair),
          mechanicsFieldPairV2Enabled:
            generation.mechanicsFieldPairV2Enabled ?? null,
          mechanicsFieldConstructionMode:
            generation.mechanicsFieldConstructionMode ?? null,
          pairCandidateCapacity:
            generation.mechanicsFieldPair?.pairCandidateCapacity ?? null,
          pairRetainedGpuBufferBytes:
            generation.mechanicsFieldPair
              ?.mechanicsFieldViews?.[0]?.retainedGpuBufferBytes ?? null,
          pairStableOrderProjectionScratchBytes:
            generation.mechanicsFieldPair
              ?.stableOrderProjectionScratchBytes ?? null,
          pairEncodedComputePassCount:
            generation.mechanicsFieldPair?.encodedComputePassCount ?? null,
          pairEncodedDispatchCount:
            generation.mechanicsFieldPair?.encodedDispatchCount ?? null,
          pairSharedRadixExecutionCount:
            generation.mechanicsFieldPair?.sharedRadixExecutionCount ?? null,
          pairProjectionAlgorithm:
            generation.mechanicsFieldPair
              ?.stableOrderProjectionPolicy ?? null,
          childEvidence,
          parentHeader,
          exactNearPresent: Boolean(generation.exactNearCellTree),
          noReadback:
            generation.execution.readbackPerformed === false
            && active.readbackPerformed === false
            && children.every((child) => child.readbackPerformed === false)
            && generation.parentFieldView.readbackPerformed === false,
          benchmarkReadbackClassification:
            'untimed-diagnostic-only-not-production-authority'
        };
        await release(generation);
        return evidence;
      };
      const measure = async (fixture, scenario) => {
        const timestamps = createRecorder();
        await device.queue.onSubmittedWorkDone();
        const started = performance.now();
        const generation = buildGeneration(
          fixture,
          scenario,
          timestamps.recorder
        );
        assertRoute(generation, scenario);
        if (generation.runtimeCacheHit !== true) {
          throw new Error(`${scenario.id} measured a cold direct runtime`);
        }
        await release(generation);
        const queueCompleteWallMs = performance.now() - started;
        const spans = await timestamps.read();
        timestamps.destroy();
        const durationFor = (producerId) => spans
          .filter(({ descriptor }) => descriptor.producerId === producerId)
          .reduce((sum, span) => sum + span.durationMs, 0);
        const generationGpuMs = durationFor(
          'schroeder-spatial-generation-command-encoder'
        );
        const fieldGpuMs = mechanicsFieldPairV2Enabled
          ? durationFor('schroeder-spatial-mechanics-field-pair-build')
          : durationFor('schroeder-spatial-mechanics-field-view-build');
        const partitionGpuMs = mechanicsFieldPairV2Enabled
          ? durationFor('schroeder-spatial-mechanics-field-pair-partition')
          : null;
        if (
          !(generationGpuMs > 0)
          || !(fieldGpuMs > 0)
          || (mechanicsFieldPairV2Enabled && !(partitionGpuMs > 0))
        ) {
          throw new Error(`${scenario.id} timestamp evidence is incomplete`);
        }
        return {
          queueCompleteWallMs,
          generationGpuMs,
          fieldGpuMs,
          partitionGpuMs,
          timestampSpanCount: spans.length,
          timestampReadbackClassification:
            'benchmark-only-after-queue-complete'
        };
      };

      const outputs = [];
      try {
        for (const scenario of scenarioConfigs) {
          const fixture = buildFixture(scenario);
          try {
            const diagnosticBefore = await diagnose(fixture, scenario);
            for (let index = 0; index < scenario.warmups; index += 1) {
              const warmup = buildGeneration(fixture, scenario);
              assertRoute(warmup, scenario);
              await release(warmup);
            }
            const samples = [];
            for (let index = 0; index < scenario.samples; index += 1) {
              samples.push(await measure(fixture, scenario));
            }
            const diagnosticAfter = await diagnose(fixture, scenario);
            outputs.push({
              scenario,
              diagnosticBefore,
              diagnosticAfter,
              samples
            });
          } finally {
            fixture.destroy();
          }
        }
        await device.queue.onSubmittedWorkDone();
      } finally {
        device.destroy?.();
      }
      if (errors.length > 0) {
        throw new Error(`uncaptured WebGPU errors: ${errors.join(' | ')}`);
      }
      return { arm, outputs };
    }, { arm, scenarioConfigs, mechanicsFieldPairV2Enabled });
    let timeoutId = null;
    try {
      return await Promise.race([
        evaluation,
        new Promise((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error(
            `${arm} benchmark arm exceeded ${timeoutMs} ms`
          )), timeoutMs);
        })
      ]);
    } finally {
      if (timeoutId != null) clearTimeout(timeoutId);
    }
  } finally {
    await browser.close();
  }
}

function scenarioById(options, id) {
  const scenarios = scenarioDefinitions(options);
  const match = Object.values(scenarios).find((scenario) => scenario.id === id);
  if (!match) throw new Error(`unknown scenario id: ${id}`);
  return match;
}

function verifyFairDiagnostics(results, options) {
  for (const scenarioKey of ['sparse', 'allActive']) {
    const scenario = scenarioDefinitions(options)[scenarioKey];
    const historical = results.find((result) => (
      result.arm === 'historical'
      && result.outputs.some(({ scenario: output }) => output.id === scenario.id)
    ));
    const current = results.find((result) => (
      result.arm === 'current'
      && result.outputs.some(({ scenario: output }) => output.id === scenario.id)
    ));
    if (!historical || !current) {
      throw new Error(`${scenario.id} is missing one comparison arm`);
    }
    const left = historical.outputs.find(({ scenario: output }) => (
      output.id === scenario.id
    )).diagnosticBefore;
    const right = current.outputs.find(({ scenario: output }) => (
      output.id === scenario.id
    )).diagnosticBefore;
    for (const field of [
      'physicalSourceCount',
      'physicalSourceCapacity',
      'activeSourceCapacity',
      'activeCount',
      'dormantCount',
      'overflowCount',
      'candidateCount',
      'activeMapHash',
      'exactNearPresent',
      'noReadback'
    ]) {
      if (!Object.is(left[field], right[field])) {
        throw new Error(
          `${scenario.id} fairness mismatch ${field}: `
          + `${left[field]} !== ${right[field]}`
        );
      }
    }
    if (left.pairPresent || !right.pairPresent) {
      throw new Error(`${scenario.id} did not isolate legacy-two versus pair`);
    }
    if (left.childEvidence.length !== right.childEvidence.length) {
      throw new Error(`${scenario.id} child count mismatch`);
    }
    for (let index = 0; index < left.childEvidence.length; index += 1) {
      const historicalChild = left.childEvidence[index];
      const currentChild = right.childEvidence[index];
      validateCrossAuthorityFieldHeaders({
        historicalHeader: historicalChild.header,
        currentHeader: currentChild.header,
        physicalSourceCount: scenario.physicalSourceCount,
        activeSourceCount: scenario.activeSourceCount
      });
      const allActive =
        scenario.activeSourceCount === scenario.physicalSourceCount;
      if (
        historicalChild.candidateSourceDomain !== 'physical'
        || currentChild.candidateSourceDomain !== 'active-ordinal'
      ) {
        throw new Error(
          `${scenario.id} child ${index} candidate source domain mismatch`
        );
      }
      if (
        historicalChild.canonicalStableOrderCount
          !== scenario.activeSourceCount * FIELD_STENCIL_SIZE
        || currentChild.canonicalStableOrderCount
          !== scenario.activeSourceCount * FIELD_STENCIL_SIZE
      ) {
        throw new Error(
          `${scenario.id} child ${index} canonical order count mismatch`
        );
      }
      const semanticFields = allActive
        ? ['descriptorHash', 'keyHash', 'stableOrderHash']
        : [
            'canonicalDescriptorHash',
            'keyHash',
            'canonicalStableOrderHash'
          ];
      for (const field of semanticFields) {
        if (left.childEvidence[index][field] !== right.childEvidence[index][field]) {
          throw new Error(
            `${scenario.id} child ${index} ${field} mismatch`
          );
        }
      }
    }
  }
  return true;
}

export function verifySameSourceContainmentDiagnostics(results, options) {
  let pairedRunCount = 0;
  const scenarioIds = [];
  for (const scenarioKey of ['sparse', 'allActive']) {
    const scenario = scenarioDefinitions(options)[scenarioKey];
    const independent = results.find((result) => (
      result.arm === 'current-independent'
      && result.outputs.some(({ scenario: output }) => output.id === scenario.id)
    ));
    const paired = results.filter((result) => (
      result.arm === 'current'
      && result.outputs.some(({ scenario: output }) => output.id === scenario.id)
    ));
    if (!independent || paired.length === 0) {
      throw new Error(
        `${scenario.id} is missing paired-v2 or current independent-v2 evidence`
      );
    }
    const independentOutput = independent.outputs.find(
      ({ scenario: output }) => output.id === scenario.id
    );
    for (const pairedResult of paired) {
      const pairedOutput = pairedResult.outputs.find(
        ({ scenario: output }) => output.id === scenario.id
      );
      for (const diagnosticKey of ['diagnosticBefore', 'diagnosticAfter']) {
        const pair = pairedOutput[diagnosticKey];
        const rollback = independentOutput[diagnosticKey];
        if (
          pair.mechanicsFieldPairV2Enabled !== true
          || pair.mechanicsFieldConstructionMode
            !== 'paired-v2-shared-radix'
          || pair.pairPresent !== true
        ) {
          throw new Error(
            `${scenario.id} ${diagnosticKey} did not authenticate paired-v2`
          );
        }
        if (
          rollback.mechanicsFieldPairV2Enabled !== false
          || rollback.mechanicsFieldConstructionMode !== 'independent-v2'
          || rollback.pairPresent !== false
        ) {
          throw new Error(
            `${scenario.id} ${diagnosticKey} did not authenticate independent-v2`
          );
        }
        for (const field of [
          'physicalSourceCount',
          'physicalSourceCapacity',
          'activeSourceCapacity',
          'activeCount',
          'dormantCount',
          'overflowCount',
          'candidateCount',
          'activeMapHash',
          'exactNearPresent',
          'noReadback'
        ]) {
          if (!Object.is(pair[field], rollback[field])) {
            throw new Error(
              `${scenario.id} same-source containment mismatch ${field}: `
                + `${pair[field]} !== ${rollback[field]}`
            );
          }
        }
        if (pair.childEvidence.length !== rollback.childEvidence.length) {
          throw new Error(`${scenario.id} same-source child count mismatch`);
        }
        for (let index = 0; index < pair.childEvidence.length; index += 1) {
          const pairedChild = pair.childEvidence[index];
          const rollbackChild = rollback.childEvidence[index];
          if (
            pairedChild.candidateSourceDomain !== 'active-ordinal'
            || rollbackChild.candidateSourceDomain !== 'active-ordinal'
          ) {
            throw new Error(
              `${scenario.id} same-source child ${index} changed candidate domain`
            );
          }
          for (const field of [
            'canonicalDescriptorHash',
            'keyHash',
            'canonicalStableOrderHash',
            'canonicalStableOrderCount'
          ]) {
            if (!Object.is(pairedChild[field], rollbackChild[field])) {
              throw new Error(
                `${scenario.id} same-source child ${index} ${field} mismatch`
              );
            }
          }
        }
        if (
          JSON.stringify(canonicalizeContainmentParentHeader(
            pair.parentHeader
          )) !== JSON.stringify(canonicalizeContainmentParentHeader(
            rollback.parentHeader
          ))
        ) {
          throw new Error(`${scenario.id} same-source parent header mismatch`);
        }
      }
      pairedRunCount += 1;
    }
    scenarioIds.push(scenario.id);
  }
  return Object.freeze({
    schema: 'peercompute.ulg.paired-field-containment-evidence.v0',
    status: 'paired-v2-contained-same-source-parity-verified',
    defaultRoute: 'independent-v2',
    optInRoute: 'paired-v2-shared-radix',
    scenarioIds: Object.freeze(scenarioIds),
    pairedRunCount,
    defaultRouteContainmentVerified: true,
    explicitOptInRouteVerified: true,
    independentV2RollbackVerified: true,
    sameSourceSemanticParityVerified: true
  });
}

function aggregateResults(results) {
  const byArmScenario = new Map();
  for (const result of results) {
    for (const output of result.outputs) {
      const key = `${result.arm}:${output.scenario.id}`;
      const entry = byArmScenario.get(key) || {
        arm: result.arm,
        scenario: output.scenario,
        samples: []
      };
      entry.samples.push(...output.samples);
      byArmScenario.set(key, entry);
    }
  }
  return [...byArmScenario.values()].map((entry) => ({
    ...entry,
    summary: summarizeSamples(entry.samples)
  }));
}

export async function runCampaign(options) {
  validateOptions(options);
  const cgroup = await inspectCgroupLimits();
  if (options.requireCgroupCap && cgroup.ready !== true) {
    throw new Error(
      `4 GiB/no-swap cgroup required: ${JSON.stringify(cgroup)}`
    );
  }
  await ensurePortsAvailable([
    options.historicalPort,
    options.currentPort
  ]);
  const snapshots = await createSnapshots(options);
  let cleanupConfirmed = false;
  const startedAt = new Date().toISOString();
  const result = {
    schema: 'peercompute.ulg.paired-field-sparse-ab.v1',
    status: options.dryRun ? 'dry-run-prepared' : 'running',
    startedAt,
    options,
    cgroup,
    vpnServerPortUntouched: VPN_SERVER_PORT,
    snapshots: {
      tempRoot: snapshots.tempRoot,
      historicalRoot: snapshots.historicalRoot,
      currentRoot: snapshots.currentRoot,
      historicalCommit: options.historicalCommit,
      historicalManifestDigest:
        snapshots.historicalSourceManifest.digest,
      historicalManifestEntryCount:
        snapshots.historicalSourceManifest.entryCount,
      currentManifestDigest: snapshots.currentSourceManifest.digest,
      currentManifestEntryCount: snapshots.currentSourceManifest.entryCount,
      historicalNodeModulesTarget:
        snapshots.historicalNodeModulesTarget,
      currentNodeModulesTarget: snapshots.currentNodeModulesTarget,
      siblingLinks: snapshots.siblingLinks
    },
    scenarios: scenarioDefinitions(options),
    schedule: buildRunSchedule(options),
    results: null,
    aggregate: null,
    containment: null,
    serverHealth: null,
    cleanupConfirmed: false
  };
  let historicalServer = null;
  let currentServer = null;
  try {
    if (!options.dryRun || options.checkServers) {
      historicalServer = startServer(
        snapshots.historicalRoot,
        options.historicalPort,
        'historical'
      );
      currentServer = startServer(
        snapshots.currentRoot,
        options.currentPort,
        'current'
      );
      const [historicalUrl, currentUrl] = await Promise.all([
        waitForServer(historicalServer),
        waitForServer(currentServer)
      ]);
      result.serverHealth = {
        historical: { url: historicalUrl, status: 200 },
        current: { url: currentUrl, status: 200 }
      };
      if (options.dryRun) {
        result.status = 'dry-run-servers-ready';
      }
      if (!options.dryRun) {
      const campaignResults = [];
      for (const entry of buildRunSchedule(options)) {
        const scenarioConfigs = entry.scenarioIds.map((id) => (
          scenarioById(options, id)
        ));
        campaignResults.push(await runBrowserArm({
          baseUrl: entry.arm === 'historical' ? historicalUrl : currentUrl,
          arm: entry.arm,
          scenarioConfigs,
          timeoutMs: options.armTimeoutMs
        }));
      }
      result.results = campaignResults;
      result.aggregate = aggregateResults(campaignResults);
      verifyFairDiagnostics(campaignResults, options);
      result.containment =
        verifySameSourceContainmentDiagnostics(campaignResults, options);
      result.status = 'complete';
      }
    }
  } catch (error) {
    result.status = 'failed';
    result.error = error instanceof Error ? error.stack : String(error);
    throw error;
  } finally {
    await Promise.all([
      stopServer(historicalServer),
      stopServer(currentServer)
    ]);
    if (!options.keepTemp) {
      cleanupConfirmed = await safeCleanupSnapshot(snapshots.tempRoot);
    }
    result.cleanupConfirmed = cleanupConfirmed;
    result.completedAt = new Date().toISOString();
    await mkdir(path.dirname(options.output), { recursive: true });
    await writeFile(options.output, `${JSON.stringify(result, null, 2)}\n`);
  }
  return result;
}

async function main() {
  const options = parseArgs();
  validateOptions(options);
  const result = await runCampaign(options);
  process.stdout.write(`${JSON.stringify({
    status: result.status,
    output: options.output,
    cgroup: result.cgroup,
    snapshots: result.snapshots,
    scenarios: result.scenarios,
    schedule: result.schedule,
    cleanupConfirmed: result.cleanupConfirmed
  }, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  main().catch((error) => {
    process.stderr.write(`${error?.stack || error}\n`);
    process.exitCode = 1;
  });
}
