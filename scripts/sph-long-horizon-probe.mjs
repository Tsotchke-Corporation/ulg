import { spawn } from 'node:child_process';
import { access, lstat, mkdir, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { inflateSync } from 'node:zlib';
import { chromium } from '@playwright/test';
import {
  nativeSurfaceVisualIntervalExtractionEnabled
} from '../src/visualization/nativeSurfaceResourceLifecycle.js';
import {
  SPH_NATIVE_WEBGPU_SURFACE_VALIDATION_MAP_TIMEOUT_MS
} from '../src/visualization/sphPhaseScene.js';
import { reactionProgressEventCount } from './sph-probe-reaction-evidence.mjs';
import {
  summarizeNativeSurfaceIndirectArgsReadback
} from './sph-native-indirect-evidence.mjs';
import {
  normalizeProbeArtifactDetailMode
} from './sph-probe-artifact-compaction.mjs';
import {
  createFailSentinelWriter
} from './ss-release-evidence-common.mjs';

const DEFAULT_URL = '/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1&dropn=3&basen=5&boxx=5&boxy=5&boxz=5&visualCapture=1&residentAuto=0';
const DEFAULT_WALL_TEMPERATURE_K = 283.15;
const DEFAULT_DROP_TEMPERATURE_K = 1850;
const DEFAULT_BASE_TEMPERATURE_K = 233.15;
const DEFAULT_ICE_BASE_HEIGHT_M = 0;
const DEFAULT_IRON_BASE_HEIGHT_M = 2.5;
const DEFAULT_BOX_DIMS_M = [5, 5, 5];
const DEFAULT_DROP_PARTICLE_EDGE = 3;
const DEFAULT_BASE_PARTICLE_EDGE = 5;
const CONDENSED_VOLUME_STRAIN_TOLERANCE = 5e-3;
const CONDENSED_MIN_VOLUME_RATIO_J = 1 - CONDENSED_VOLUME_STRAIN_TOLERANCE;
const CONDENSED_MAX_VOLUME_RATIO_J = 1 + CONDENSED_VOLUME_STRAIN_TOLERANCE;
// These probes validate the native GPU path and its performance envelope.
// Chromium's headless default may silently select SwiftShader, which is not a
// valid substitute and can watchdog on otherwise bounded SS kernels. Match the
// dedicated native WebGPU probes by selecting the Vulkan hardware backend.
const DEFAULT_CHROMIUM_ARGS = [
  '--enable-unsafe-webgpu',
  '--use-angle=vulkan',
  '--enable-features=Vulkan,UseSkiaRenderer'
];
const BROWSER_CONSOLE_ENTRY_LIMIT = 500;
const BROWSER_CONSOLE_ISSUE_LIMIT = 200;
const SURFACE_DRAW_DIAGNOSTIC_MODES = new Set([
  'auto',
  'metadata',
  'off',
  'three-compact-vertices',
  'three-webgpu-surface-buffers',
  'three-render-row-points',
  'three-render-row-spheres',
  'webgpu-render-row-points',
  'webgpu-render-row-spheres',
  'native-webgpu-surface-consumer',
  'three-points',
  'three-spheres',
  'webgpu-points',
  'webgpu-spheres',
  'three'
]);
const NATIVE_SURFACE_DEBUG_MODES = new Set(['none', 'clear-only']);
const APPROVED_ZERO_GEOMETRY_RETENTION_REASON =
  'a zero-geometry render-field handoff has no native consumer; '
  + 'retain the runtime-admitted prior presentation until a real replacement is ready';

export const SPH_PROBE_DURABLE_RELEASE_PUBLICATION_ENV =
  'ULG_PROBE_DURABLE_RELEASE_PUBLICATION';

export function durableProbeReleasePublicationEnabled(
  value = process.env[SPH_PROBE_DURABLE_RELEASE_PUBLICATION_ENV]
) {
  return value === '1';
}

export async function publishProbeReleaseArtifact({
  artifactPath,
  repoDir,
  bytes,
  label = 'SPH long-horizon release artifact'
}) {
  if (!(Buffer.isBuffer(bytes) || bytes instanceof Uint8Array)) {
    throw new TypeError(`${label} bytes must be a Buffer or Uint8Array`);
  }
  const writer = await createFailSentinelWriter({
    outputPath: artifactPath,
    repoDir,
    sentinel: Buffer.from(`failed ${label} publication\n`, 'utf8'),
    format: 'text',
    label
  });
  await writer.replace(bytes);
  return Object.freeze({
    path: writer.outputPath,
    byteLength: bytes.byteLength,
    replacementCount: writer.replacementCount()
  });
}

const BROWSER_CONSOLE_ISSUE_PATTERNS = [
  {
    issue: 'webgpu-buffer-size-limit',
    pattern: /Buffer size .* exceeds the max buffer size limit/i
  },
  {
    issue: 'webgpu-storage-binding-size-limit',
    pattern: /Binding size .* maximum storage buffer binding size|exceeds WebGPU device maxStorageBufferBindingSize/i
  },
  {
    issue: 'webgpu-cross-device-buffer',
    pattern: /associated with \[Device\], and cannot be used with \[Device\]/i
  },
  {
    issue: 'webgpu-destroyed-buffer-submit',
    pattern: /used in submit while destroyed/i
  },
  {
    issue: 'wgsl-parse-error',
    pattern: /Error while parsing WGSL|CreateShaderModule|Invalid ShaderModule|reserved keyword/i
  },
  {
    issue: 'webgpu-out-of-memory',
    pattern: /\[ulg-gpu-uncaptured-error:GPUOutOfMemoryError\]|GPUOutOfMemoryError|WebGPU[^\n]{0,80}out[- ]of[- ]memory/i
  },
  {
    issue: 'webgpu-device-lost',
    pattern: /\[ulg-gpu-device-lost\]|(?:WebGPU|GPU)\s*Device[^\n]{0,80}\blost\b|\bdevice loss\b|A valid external Instance reference no longer exists/i
  },
  {
    issue: 'webgpu-uncaptured-error',
    pattern: /\[ulg-gpu-uncaptured-error|uncapturederror|uncaptured (?:WebGPU|GPU) error/i
  },
  {
    issue: 'webgpu-invalid-object',
    pattern: /\[Invalid (Buffer|BindGroup|CommandBuffer|ComputePipeline|ShaderModule)/i
  },
  {
    issue: 'webgpu-warning-limit',
    pattern: /WebGPU: too many warnings/i
  }
];

const BROWSER_CONSOLE_WARNING_PATTERNS = [
  {
    warning: 'peercompute-worker-inline-fallback',
    pattern: /Web Workers not available; falling back to inline execution/i
  }
];

const BROWSER_CRITICAL_GPU_MESSAGE_PATTERNS = [
  {
    category: 'out-of-memory',
    pattern: /\[ulg-gpu-uncaptured-error:GPUOutOfMemoryError\]|GPUOutOfMemoryError|WebGPU[^\n]{0,80}out[- ]of[- ]memory/i
  },
  {
    category: 'device-lost',
    pattern: /\[ulg-gpu-device-lost\]|(?:WebGPU|GPU)\s*Device[^\n]{0,80}\blost\b|\bdevice loss\b|A valid external Instance reference no longer exists/i
  },
  {
    category: 'uncaptured-error',
    pattern: /\[ulg-gpu-uncaptured-error|uncapturederror|uncaptured (?:WebGPU|GPU) error/i
  }
];

export function summarizeResidentRenderSourceStaleRecovery(samples = []) {
  const source = Array.isArray(samples) ? samples : [];
  const staleSamples = source.filter((sample) => (
    sample?.generationMatchesCurrent === false
    || sample?.retainedPrevious === true
    || sample?.sourceMarkedStale === true
  ));
  const transientRecoveredSamples = staleSamples.filter((sample) => {
    if (
      sample.retainedPrevious !== true
      || sample.sourceMarkedStale !== true
      || sample.retentionReason !== APPROVED_ZERO_GEOMETRY_RETENTION_REASON
    ) {
      return false;
    }
    return source.some((later) => (
      Number(later?.index) > Number(sample?.index)
      && later?.generationMatchesCurrent === true
      && later?.retainedPrevious !== true
      && later?.sourceMarkedStale !== true
      && Number.isFinite(Number(later?.nextStep))
      && Number.isFinite(Number(sample?.nextStep))
      && Number(later.nextStep) > Number(sample.nextStep)
    ));
  });
  const transientRecoveredSet = new Set(transientRecoveredSamples);
  const unrecoveredSamples = staleSamples.filter(
    (sample) => !transientRecoveredSet.has(sample)
  );
  return {
    schema:
      'peercompute.ulg.sph-resident-render-source-stale-recovery.v0',
    status: unrecoveredSamples.length === 0
      ? 'no-unrecovered-stale-source'
      : 'unrecovered-stale-source',
    staleSampleCount: staleSamples.length,
    transientRecoveredSampleCount: transientRecoveredSamples.length,
    unrecoveredSampleCount: unrecoveredSamples.length,
    transientRecoveredSampleIndices:
      transientRecoveredSamples.map((sample) => sample.index),
    unrecoveredSampleIndices:
      unrecoveredSamples.map((sample) => sample.index)
  };
}

function incrementCount(target, key) {
  if (!key) return;
  target[key] = (target[key] || 0) + 1;
}

function classifyBrowserConsoleText(text) {
  const value = String(text || '');
  const issue = BROWSER_CONSOLE_ISSUE_PATTERNS.find((entry) => entry.pattern.test(value));
  if (issue) {
    return {
      issue: issue.issue,
      severity: 'error'
    };
  }
  const warning = BROWSER_CONSOLE_WARNING_PATTERNS.find((entry) => entry.pattern.test(value));
  if (warning) {
    return {
      warning: warning.warning,
      severity: 'warning'
    };
  }
  return {
    issue: null,
    warning: null,
    severity: null
  };
}

function classifyBrowserCriticalGpuText(text) {
  const value = String(text || '');
  return BROWSER_CRITICAL_GPU_MESSAGE_PATTERNS.find(
    (entry) => entry.pattern.test(value)
  )?.category ?? null;
}

function compactBrowserConsoleLocation(message) {
  const location = typeof message?.location === 'function' ? message.location() : null;
  if (!location) return null;
  return {
    url: location.url || null,
    lineNumber: Number.isFinite(Number(location.lineNumber)) ? Number(location.lineNumber) : null,
    columnNumber: Number.isFinite(Number(location.columnNumber)) ? Number(location.columnNumber) : null
  };
}

export function createBrowserProbeFatalSignal() {
  let fatalTermination = null;
  let resolveFatalTermination = null;
  const promise = new Promise((resolve) => {
    resolveFatalTermination = resolve;
  });
  return {
    promise,
    trip({
      source = 'unknown',
      category = 'device-lost',
      message = 'browser probe observed a fatal GPU lifecycle event',
      receivedAtMs = Date.now(),
      detail = null
    } = {}) {
      if (fatalTermination !== null) return false;
      fatalTermination = Object.freeze({
        schema: 'peercompute.ulg.sph-probe-fatal-termination.v0',
        status: 'probe-fatal-termination-observed',
        source,
        category,
        message: String(message || 'browser probe fatal termination'),
        receivedAtMs: Number.isFinite(Number(receivedAtMs))
          ? Number(receivedAtMs)
          : Date.now(),
        detail
      });
      resolveFatalTermination(fatalTermination);
      return true;
    },
    current() {
      return fatalTermination;
    }
  };
}

export async function raceBrowserProbeOperationWithFatalSignal(
  operation,
  fatalSignal
) {
  const operationOutcome = Promise.resolve(operation).then(
    (value) => ({ status: 'operation-completed', value }),
    (error) => ({ status: 'operation-rejected', error })
  );
  const currentFatalTermination = fatalSignal.current();
  if (currentFatalTermination !== null) {
    return {
      status: 'probe-fatal-termination',
      fatalTermination: currentFatalTermination
    };
  }
  const fatalOutcome = fatalSignal.promise.then((fatalTermination) => ({
    status: 'probe-fatal-termination',
    fatalTermination
  }));
  const outcome = await Promise.race([operationOutcome, fatalOutcome]);
  if (outcome.status === 'operation-rejected') throw outcome.error;
  return outcome;
}

async function awaitBrowserProbeOperation(operation, fatalSignal) {
  const outcome = await raceBrowserProbeOperationWithFatalSignal(
    operation,
    fatalSignal
  );
  if (outcome.status === 'probe-fatal-termination') {
    const error = new Error(outcome.fatalTermination.message);
    error.browserProbeFatalTermination = outcome.fatalTermination;
    throw error;
  }
  return outcome.value;
}

export async function awaitBrowserProbeFinalization(
  finalize,
  fatalSignal
) {
  if (typeof finalize !== 'function') {
    throw new TypeError('browser probe finalizer must be a function');
  }
  const currentFatalTermination = fatalSignal.current();
  if (currentFatalTermination !== null) {
    const error = new Error(currentFatalTermination.message);
    error.browserProbeFatalTermination = currentFatalTermination;
    throw error;
  }
  const finalization = Promise.resolve().then(() => {
    const fatalTerminationBeforeStart = fatalSignal.current();
    if (fatalTerminationBeforeStart !== null) {
      const error = new Error(fatalTerminationBeforeStart.message);
      error.browserProbeFatalTermination = fatalTerminationBeforeStart;
      throw error;
    }
    return finalize();
  });
  return awaitBrowserProbeOperation(finalization, fatalSignal);
}

export function createBrowserConsoleCapture({
  onCriticalGpuMessage = null
} = {}) {
  const entries = [];
  const issues = [];
  const pageErrors = [];
  const issueCounts = {};
  const warningCounts = {};
  const firstCriticalGpuMessagesByCategory = {};
  let firstCriticalGpuMessage = null;
  let droppedEntryCount = 0;
  let droppedIssueCount = 0;

  const recordCriticalGpuMessage = (entry) => {
    const criticalGpuCategory = classifyBrowserCriticalGpuText(entry?.text);
    if (!criticalGpuCategory) return;
    const criticalGpuMessage = {
      category: criticalGpuCategory,
      kind: entry.kind ?? null,
      type: entry.type ?? null,
      text: entry.text,
      location: entry.location ?? null,
      receivedAtMs: entry.receivedAtMs ?? Date.now()
    };
    if (!firstCriticalGpuMessage) {
      firstCriticalGpuMessage = criticalGpuMessage;
    }
    if (!firstCriticalGpuMessagesByCategory[criticalGpuCategory]) {
      firstCriticalGpuMessagesByCategory[criticalGpuCategory] =
        criticalGpuMessage;
    }
    if (typeof onCriticalGpuMessage === 'function') {
      try {
        onCriticalGpuMessage({ ...criticalGpuMessage });
      } catch {
        // Diagnostic callbacks must never hide the console evidence they
        // observe. The one-shot fatal signal is deliberately best-effort here.
      }
    }
  };

  const recordEntry = (entry) => {
    const classification = classifyBrowserConsoleText(entry.text);
    const compact = {
      ...entry,
      ...classification
    };
    recordCriticalGpuMessage(compact);
    if (classification.issue) {
      incrementCount(issueCounts, classification.issue);
      if (issues.length < BROWSER_CONSOLE_ISSUE_LIMIT) {
        issues.push(compact);
      } else {
        droppedIssueCount += 1;
      }
    }
    if (classification.warning) {
      incrementCount(warningCounts, classification.warning);
    }
    if (entries.length < BROWSER_CONSOLE_ENTRY_LIMIT) {
      entries.push(compact);
    } else {
      droppedEntryCount += 1;
    }
  };

  return {
    entries,
    issues,
    pageErrors,
    recordConsole(message) {
      recordEntry({
        kind: 'console',
        type: typeof message?.type === 'function' ? message.type() : null,
        text: typeof message?.text === 'function' ? message.text() : String(message || ''),
        location: compactBrowserConsoleLocation(message),
        receivedAtMs: Date.now()
      });
    },
    recordPageError(error) {
      const item = {
        kind: 'pageerror',
        type: 'pageerror',
        text: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack || null : null,
        issue: 'browser-page-error',
        severity: 'error',
        receivedAtMs: Date.now()
      };
      recordCriticalGpuMessage(item);
      incrementCount(issueCounts, item.issue);
      if (issues.length < BROWSER_CONSOLE_ISSUE_LIMIT) {
        issues.push(item);
      } else {
        droppedIssueCount += 1;
      }
      if (pageErrors.length < BROWSER_CONSOLE_ISSUE_LIMIT) {
        pageErrors.push(item);
      }
    },
    summary() {
      return {
        schema: 'peercompute.ulg.sph-browser-console-summary.v0',
        entryCount: entries.length + droppedEntryCount,
        retainedEntryCount: entries.length,
        droppedEntryCount,
        issueCount: Object.values(issueCounts).reduce((sum, count) => sum + count, 0),
        retainedIssueCount: issues.length,
        droppedIssueCount,
        pageErrorCount: pageErrors.length,
        issueCounts: { ...issueCounts },
        warningCounts: { ...warningCounts },
        issueTypes: Object.keys(issueCounts),
        warningTypes: Object.keys(warningCounts),
        firstCriticalGpuMessage: firstCriticalGpuMessage
          ? { ...firstCriticalGpuMessage }
          : null,
        firstCriticalGpuMessagesByCategory: Object.fromEntries(
          Object.entries(firstCriticalGpuMessagesByCategory).map(
            ([category, message]) => [category, { ...message }]
          )
        )
      };
    }
  };
}

function attachBrowserConsoleTelemetry(timeline, capture) {
  if (!timeline || typeof timeline !== 'object' || !capture) return timeline;
  const summary = capture.summary();
  timeline.pageConsole = [...capture.entries];
  timeline.pageErrors = [...capture.pageErrors];
  timeline.browserConsole = summary;
  timeline.browserConsoleIssues = [...capture.issues];
  timeline.browserConsoleFirstCriticalGpuMessage =
    summary.firstCriticalGpuMessage;
  timeline.browserConsoleFirstCriticalGpuMessagesByCategory =
    summary.firstCriticalGpuMessagesByCategory;
  return timeline;
}

function parseChromiumArgs(value) {
  return String(value || '')
    .split(/\s+/)
    .map((arg) => arg.trim())
    .filter(Boolean);
}

function probeChromiumLaunchOptions() {
  const extraArgs = parseChromiumArgs(process.env.ULG_PROBE_CHROMIUM_ARGS);
  const args = [...new Set([...DEFAULT_CHROMIUM_ARGS, ...extraArgs])];
  const channel = String(process.env.ULG_PROBE_CHROMIUM_CHANNEL || '').trim();
  const executablePath = String(process.env.ULG_PROBE_CHROMIUM_EXECUTABLE || '').trim();
  const headless = booleanEnv(process.env.ULG_PROBE_HEADLESS, true);
  return {
    headless,
    args,
    ...(channel ? { channel } : {}),
    ...(executablePath ? { executablePath } : {})
  };
}

function probeChromiumLaunchReport() {
  const options = probeChromiumLaunchOptions();
  return {
    schema: 'peercompute.ulg.sph-probe-browser-launch.v0',
    headless: options.headless,
    channel: options.channel || null,
    executablePath: options.executablePath || null,
    args: [...options.args],
    page: probePageReport()
  };
}

async function launchProbeBrowser() {
  return chromium.launch(probeChromiumLaunchOptions());
}

async function closeOwnedProbeBrowser(browser) {
  const closeTimeoutMs = 2_000;
  let timeoutId = null;
  const close = Promise.resolve().then(() => browser.close());
  // Preserve the close rejection for the raced operation while preventing a
  // late rejection after a timeout from becoming an unhandled promise.
  close.catch(() => {});
  try {
    await Promise.race([
      close,
      new Promise((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error(`owned Chromium close timed out after ${closeTimeoutMs}ms`)),
          closeTimeoutMs
        );
      })
    ]);
  } finally {
    if (timeoutId !== null) clearTimeout(timeoutId);
  }
}

function booleanEnv(value, fallback = false) {
  if (value == null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function finiteNumber(value, fallback) {
  if (value == null || value === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function commaList(value) {
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function surfaceDrawModeFromScenarioUrl(scenarioUrl) {
  try {
    const url = new URL(String(scenarioUrl || ''), 'http://ulg-probe.local/');
    const candidates = [
      url.searchParams.get('surfaceDraw'),
      url.searchParams.get('surfaceDrawDiagnosticMode'),
      url.searchParams.get('surfaceDrawMode')
    ];
    if (url.hash && url.hash.length > 1) {
      const hashParams = new URLSearchParams(url.hash.slice(1));
      candidates.push(
        hashParams.get('surfaceDraw'),
        hashParams.get('surfaceDrawDiagnosticMode'),
        hashParams.get('surfaceDrawMode')
      );
    }
    for (const candidate of candidates) {
      const normalized = String(candidate || '').toLowerCase();
      if (SURFACE_DRAW_DIAGNOSTIC_MODES.has(normalized)) return normalized;
    }
  } catch {
    return null;
  }
  return null;
}

// Mount reconciles an explicit native renderer to the native surface consumer
// when no surfaceDraw query is supplied. Mirror that selection here so a
// probe does not accidentally skip the foreground-validation wait merely
// because the user selected the route through `renderer=native-webgpu`.
function scenarioRequestsNativeSurfaceFromRenderer(scenarioUrl) {
  try {
    const url = new URL(String(scenarioUrl || ''), 'http://ulg-probe.local/');
    const read = (key) => url.searchParams.get(key)
      ?? (url.hash && url.hash.length > 1
        ? new URLSearchParams(url.hash.slice(1)).get(key)
        : null);
    const mechanicsMode = String(read('mech') ?? read('mechanics') ?? 'mlsmpm')
      .trim()
      .toLowerCase();
    if (mechanicsMode === 'sph') return false;
    return ['renderer', 'sphRenderer', 'threeRenderer'].some((key) => {
      const renderer = String(read(key) || '').trim().toLowerCase();
      return renderer === 'native-webgpu' || renderer === 'webgpu-native';
    });
  } catch {
    return false;
  }
}

function normalizedNativeSurfaceDebugMode(value, fallback = 'none') {
  if (value == null || String(value).trim() === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (NATIVE_SURFACE_DEBUG_MODES.has(normalized)) return normalized;
  if (normalized === 'clear' || normalized === 'clearonly' || normalized === 'sentinel-clear') return 'clear-only';
  return fallback;
}

function probePageOptions() {
  const surfaceDrawDiagnosticModeEnv = String(
    process.env.ULG_PROBE_SURFACE_DRAW_DIAGNOSTIC_MODE || ''
  ).toLowerCase();
  const surfaceDrawDiagnosticMode = SURFACE_DRAW_DIAGNOSTIC_MODES.has(surfaceDrawDiagnosticModeEnv)
    ? surfaceDrawDiagnosticModeEnv
    : surfaceDrawModeFromScenarioUrl(process.env.ULG_PROBE_URL || DEFAULT_URL);
  const nativeSurfaceFrameValidationViewport =
    surfaceDrawDiagnosticMode === 'native-webgpu-surface-consumer'
    || scenarioRequestsNativeSurfaceFromRenderer(process.env.ULG_PROBE_URL || DEFAULT_URL);
  const viewport = {
    width: positiveInteger(process.env.ULG_PROBE_VIEWPORT_WIDTH, nativeSurfaceFrameValidationViewport ? 320 : 1280),
    height: positiveInteger(process.env.ULG_PROBE_VIEWPORT_HEIGHT, nativeSurfaceFrameValidationViewport ? 240 : 800)
  };
  const deviceScaleFactor = finiteNumber(process.env.ULG_PROBE_DEVICE_SCALE_FACTOR, null);
  const isMobile = booleanEnv(process.env.ULG_PROBE_IS_MOBILE, false);
  const hasTouch = booleanEnv(process.env.ULG_PROBE_HAS_TOUCH, isMobile);
  return {
    viewport,
    ignoreHTTPSErrors: true,
    ...(deviceScaleFactor && deviceScaleFactor > 0 ? { deviceScaleFactor } : {}),
    ...(isMobile ? { isMobile } : {}),
    ...(hasTouch ? { hasTouch } : {})
  };
}

function probePageReport() {
  const options = probePageOptions();
  return {
    schema: 'peercompute.ulg.sph-probe-page-options.v0',
    viewport: { ...options.viewport },
    deviceScaleFactor: options.deviceScaleFactor ?? null,
    isMobile: options.isMobile === true,
    hasTouch: options.hasTouch === true
  };
}

async function newProbePage(browser) {
  const page = await browser.newPage(probePageOptions());
  await page.addInitScript(() => {
    const installKey = '__ulgProbeGpuFaultCaptureInstalledV0';
    if (globalThis[installKey]) return;
    globalThis[installKey] = true;
    const seenDevices = new WeakSet();
    const attachDevice = (device) => {
      if (!device || seenDevices.has(device)) return device;
      seenDevices.add(device);
      device.addEventListener?.('uncapturederror', (event) => {
        const error = event?.error || null;
        const name = error?.name || error?.constructor?.name || 'GPUError';
        const message = error?.message || String(error || 'unknown WebGPU error');
        console.error(`[ulg-gpu-uncaptured-error:${name}] ${message}`);
      });
      Promise.resolve(device.lost).then((info) => {
        const reason = info?.reason || 'unknown';
        const message = info?.message || 'WebGPU device lost without a message';
        console.error(`[ulg-gpu-device-lost] reason=${reason} message=${message}`);
      }).catch((error) => {
        console.error(
          `[ulg-gpu-device-lost] watch-error=${error?.message || String(error)}`
        );
      });
      return device;
    };
    const adapterPrototype = globalThis.GPUAdapter?.prototype;
    const requestDevice = adapterPrototype?.requestDevice;
    if (typeof requestDevice !== 'function') return;
    const wrappedRequestDevice = async function (...args) {
      return attachDevice(await requestDevice.apply(this, args));
    };
    try {
      Object.defineProperty(adapterPrototype, 'requestDevice', {
        configurable: true,
        writable: true,
        value: wrappedRequestDevice
      });
    } catch {
      try {
        adapterPrototype.requestDevice = wrappedRequestDevice;
      } catch {
        // The probe still retains Chromium's own WebGPU console diagnostics.
      }
    }
  });
  return page;
}

async function ensureProbeSphPhaseOverlay(page, { timeoutMs }) {
  const overlay = page.locator('#sph-phase-overlay');
  if (await overlay.count() === 0) {
    await page.locator('#run-sph-phase').click({
      timeout: Math.min(30_000, timeoutMs)
    }).catch(async (error) => {
      if (await overlay.count() > 0) return;
      throw error;
    });
  }
  await page.waitForSelector('#sph-phase-overlay', { timeout: timeoutMs });
}

function appendQueryParam(url, key, value) {
  const hashIndex = url.indexOf('#');
  const base = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const hash = hashIndex >= 0 ? url.slice(hashIndex) : '';
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}${hash}`;
}

function withBrowserProbeParams(url, {
  contactBinMetadataReadback = false,
  reactionBinMetadataReadback = false
} = {}) {
  const value = String(url || DEFAULT_URL);
  let next = value;
  if (!/[?&#]visualCapture=/.test(next)) next = appendQueryParam(next, 'visualCapture', '1');
  if (!/[?&#]residentAuto=/.test(next)) next = appendQueryParam(next, 'residentAuto', '0');
  if (contactBinMetadataReadback && !/[?&#]contactBinMetadataReadback=/.test(next)) {
    next = appendQueryParam(next, 'contactBinMetadataReadback', '1');
  }
  if (reactionBinMetadataReadback && !/[?&#]reactionBinMetadataReadback=/.test(next)) {
    next = appendQueryParam(next, 'reactionBinMetadataReadback', '1');
  }
  return next;
}

function scenarioParams(url) {
  const value = String(url || DEFAULT_URL);
  const hashIndex = value.indexOf('#');
  const queryIndex = value.indexOf('?');
  const params = new URLSearchParams();
  const addParams = (source) => {
    if (!source) return;
    const clean = source.replace(/^[?#]/, '');
    for (const [key, val] of new URLSearchParams(clean)) params.set(key, val);
  };
  if (queryIndex >= 0) {
    const queryEnd = hashIndex >= 0 ? hashIndex : value.length;
    addParams(value.slice(queryIndex + 1, queryEnd));
  }
  if (hashIndex >= 0) addParams(value.slice(hashIndex + 1));
  return params;
}

function boxDimsFromScenarioUrl(url) {
  const params = scenarioParams(url);
  return [
    finiteNumber(params.get('boxx'), DEFAULT_BOX_DIMS_M[0]),
    finiteNumber(params.get('boxy'), DEFAULT_BOX_DIMS_M[1]),
    finiteNumber(params.get('boxz'), DEFAULT_BOX_DIMS_M[2])
  ].map((value, index) => value > 0 ? value : DEFAULT_BOX_DIMS_M[index]);
}

function isExpectedLiquidH2oSameMaterialScenario(url) {
  const params = scenarioParams(url);
  const paramNumber = (key, fallback) => params.has(key) ? finiteNumber(params.get(key), fallback) : fallback;
  const drop = String(params.get('drop') || 'fe').trim().toLowerCase();
  const base = String(params.get('base') || 'h2o').trim().toLowerCase();
  if (drop !== 'h2o' || base !== 'h2o') return false;
  const dropTempK = paramNumber('dropt', DEFAULT_DROP_TEMPERATURE_K);
  const baseTempK = paramNumber('baset', DEFAULT_BASE_TEMPERATURE_K);
  const wallKeys = ['wxmin', 'wxmax', 'wymin', 'wymax', 'wzmin', 'wzmax'];
  const wallTempsK = wallKeys.map((key) => paramNumber(key, DEFAULT_WALL_TEMPERATURE_K));
  return [dropTempK, baseTempK, ...wallTempsK].every((tempK) => tempK >= 273.15 && tempK < 373.15);
}

function scenarioIncludesH2oMaterial(url) {
  const params = scenarioParams(url);
  if (params.has('bodies')) {
    try {
      const parsed = JSON.parse(params.get('bodies'));
      if (Array.isArray(parsed?.bodies) && parsed.bodies.length > 0) {
        return parsed.bodies.some((body) => (
          String(body?.material || '').trim().toLowerCase() === 'h2o'
        ));
      }
    } catch {
      // Fall through to the legacy drop/base selectors when bodies is invalid;
      // scenario preflight owns the malformed-body failure itself.
    }
  }
  const drop = String(params.get('drop') || 'fe').trim().toLowerCase();
  const base = String(params.get('base') || 'h2o').trim().toLowerCase();
  return drop === 'h2o' || base === 'h2o';
}

function normalizedProbeMode(value) {
  const mode = String(value || '').trim().toLowerCase();
  if (mode === 'direct' || mode === 'direct-resident' || process.env.ULG_PROBE_DIRECT_RESIDENT === '1') {
    return 'direct-resident';
  }
  return 'scene';
}

function normalizedCompactSummaryScope(value, fallback = 'full') {
  const scope = String(value || fallback).trim().toLowerCase();
  if (scope === 'particle-visual') return 'particle-visual';
  return 'full';
}

function normalizedActiveGridPlanRefreshMode(value, fallback = 'final-only') {
  const mode = String(value || fallback).trim().toLowerCase();
  if (mode === 'none' || mode === 'skip' || mode === 'disabled') return 'none';
  if (mode === 'final-only') return 'final-only';
  return 'every-step';
}

function safeArtifactToken(value, fallback = 'frame') {
  const token = String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return token || fallback;
}

function paethPredictor(left, up, upLeft) {
  const p = left + up - upLeft;
  const pa = Math.abs(p - left);
  const pb = Math.abs(p - up);
  const pc = Math.abs(p - upLeft);
  if (pa <= pb && pa <= pc) return left;
  if (pb <= pc) return up;
  return upLeft;
}

function analyzePngFrame(bytes, { region = null, includeRgbaPixels = false } = {}) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!Buffer.isBuffer(bytes) || bytes.length < 33 || !bytes.subarray(0, 8).equals(signature)) {
    return { status: 'unsupported', reason: 'not-png' };
  }
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatChunks = [];
  try {
    while (offset + 12 <= bytes.length) {
      const length = bytes.readUInt32BE(offset);
      const type = bytes.subarray(offset + 4, offset + 8).toString('ascii');
      const dataStart = offset + 8;
      const dataEnd = dataStart + length;
      if (dataEnd + 4 > bytes.length) break;
      const data = bytes.subarray(dataStart, dataEnd);
      if (type === 'IHDR') {
        width = data.readUInt32BE(0);
        height = data.readUInt32BE(4);
        bitDepth = data[8];
        colorType = data[9];
      } else if (type === 'IDAT') {
        idatChunks.push(data);
      } else if (type === 'IEND') {
        break;
      }
      offset = dataEnd + 4;
    }
    const channelsByColorType = new Map([[0, 1], [2, 3], [4, 2], [6, 4]]);
    const channels = channelsByColorType.get(colorType);
    if (!width || !height || bitDepth !== 8 || !channels || idatChunks.length === 0) {
      return {
        status: 'unsupported',
        reason: 'unsupported-png-layout',
        width,
        height,
        bitDepth,
        colorType
      };
    }
    const bytesPerPixel = channels;
    const rowBytes = width * bytesPerPixel;
    const inflated = inflateSync(Buffer.concat(idatChunks));
    if (inflated.length < (rowBytes + 1) * height) {
      return {
        status: 'error',
        reason: 'truncated-png-data',
        width,
        height,
        bitDepth,
        colorType
      };
    }
    const sampleX0 = Math.max(0, Math.min(width, Math.floor(Number(region?.x) || 0)));
    const sampleY0 = Math.max(0, Math.min(height, Math.floor(Number(region?.y) || 0)));
    const requestedSampleWidth = Number(region?.width);
    const requestedSampleHeight = Number(region?.height);
    const sampleX1 = Math.max(
      sampleX0,
      Math.min(width, Math.ceil(sampleX0 + (Number.isFinite(requestedSampleWidth) && requestedSampleWidth > 0
        ? requestedSampleWidth
        : width)))
    );
    const sampleY1 = Math.max(
      sampleY0,
      Math.min(height, Math.ceil(sampleY0 + (Number.isFinite(requestedSampleHeight) && requestedSampleHeight > 0
        ? requestedSampleHeight
        : height)))
    );
    const sampleWidth = sampleX1 - sampleX0;
    const sampleHeight = sampleY1 - sampleY0;
    const rgbaPixels = includeRgbaPixels
      ? Buffer.alloc(sampleWidth * sampleHeight * 4)
      : null;
    let previous = Buffer.alloc(rowBytes);
    let nonzeroRgbPixelCount = 0;
    let nonzeroAlphaPixelCount = 0;
    let opaquePixelCount = 0;
    let transparentPixelCount = 0;
    let maxChannel = 0;
    let minRgbChannel = 255;
    let maxRgbChannel = 0;
    let minR = 255;
    let maxR = 0;
    let minG = 255;
    let maxG = 0;
    let minB = 255;
    let maxB = 0;
    let minAlpha = 255;
    let maxAlpha = 0;
    const distinctRgbColors = new Set();
    const distinctRgbColorLimit = 4096;
    for (let y = 0; y < height; y += 1) {
      const rowStart = y * (rowBytes + 1);
      const filter = inflated[rowStart];
      const source = inflated.subarray(rowStart + 1, rowStart + 1 + rowBytes);
      const row = Buffer.alloc(rowBytes);
      for (let x = 0; x < rowBytes; x += 1) {
        const left = x >= bytesPerPixel ? row[x - bytesPerPixel] : 0;
        const up = previous[x] || 0;
        const upLeft = x >= bytesPerPixel ? previous[x - bytesPerPixel] || 0 : 0;
        let value = source[x];
        if (filter === 1) value = (value + left) & 0xff;
        else if (filter === 2) value = (value + up) & 0xff;
        else if (filter === 3) value = (value + Math.floor((left + up) / 2)) & 0xff;
        else if (filter === 4) value = (value + paethPredictor(left, up, upLeft)) & 0xff;
        else if (filter !== 0) {
          return {
            status: 'error',
            reason: `unsupported-png-filter-${filter}`,
            width,
            height,
            bitDepth,
            colorType
          };
        }
        row[x] = value;
      }
      if (y < sampleY0 || y >= sampleY1) {
        previous = row;
        continue;
      }
      for (let x = 0; x < width; x += 1) {
        if (x < sampleX0 || x >= sampleX1) continue;
        const pixelOffset = x * bytesPerPixel;
        let r = 0;
        let g = 0;
        let b = 0;
        let a = 255;
        if (colorType === 0) {
          r = row[pixelOffset];
          g = r;
          b = r;
        } else if (colorType === 2) {
          r = row[pixelOffset];
          g = row[pixelOffset + 1];
          b = row[pixelOffset + 2];
        } else if (colorType === 4) {
          r = row[pixelOffset];
          g = r;
          b = r;
          a = row[pixelOffset + 1];
        } else if (colorType === 6) {
          r = row[pixelOffset];
          g = row[pixelOffset + 1];
          b = row[pixelOffset + 2];
          a = row[pixelOffset + 3];
        }
        if (rgbaPixels) {
          const rgbaOffset = ((y - sampleY0) * sampleWidth + (x - sampleX0)) * 4;
          rgbaPixels[rgbaOffset] = r;
          rgbaPixels[rgbaOffset + 1] = g;
          rgbaPixels[rgbaOffset + 2] = b;
          rgbaPixels[rgbaOffset + 3] = a;
        }
        if (r > 0 || g > 0 || b > 0) nonzeroRgbPixelCount += 1;
        if (a > 0) nonzeroAlphaPixelCount += 1;
        if (a >= 255) opaquePixelCount += 1;
        if (a === 0) transparentPixelCount += 1;
        maxChannel = Math.max(maxChannel, r, g, b, a);
        minRgbChannel = Math.min(minRgbChannel, r, g, b);
        maxRgbChannel = Math.max(maxRgbChannel, r, g, b);
        minR = Math.min(minR, r);
        maxR = Math.max(maxR, r);
        minG = Math.min(minG, g);
        maxG = Math.max(maxG, g);
        minB = Math.min(minB, b);
        maxB = Math.max(maxB, b);
        minAlpha = Math.min(minAlpha, a);
        maxAlpha = Math.max(maxAlpha, a);
        if (distinctRgbColors.size < distinctRgbColorLimit) {
          distinctRgbColors.add(`${r},${g},${b}`);
        }
      }
      previous = row;
    }
    const pixelCount = sampleWidth * sampleHeight;
    const rgbChannelSpan = Math.max(maxR - minR, maxG - minG, maxB - minB);
    const distinctRgbColorCount = distinctRgbColors.size;
    return {
      status: 'ready',
      width: sampleWidth,
      height: sampleHeight,
      sourceWidth: region ? width : undefined,
      sourceHeight: region ? height : undefined,
      region: region
        ? { x: sampleX0, y: sampleY0, width: sampleWidth, height: sampleHeight }
        : undefined,
      bitDepth,
      colorType,
      pixelCount,
      nonzeroRgbPixelCount,
      nonzeroAlphaPixelCount,
      opaquePixelCount,
      transparentPixelCount,
      nonzeroRgbRatio: pixelCount > 0 ? nonzeroRgbPixelCount / pixelCount : 0,
      nonzeroAlphaRatio: pixelCount > 0 ? nonzeroAlphaPixelCount / pixelCount : 0,
      maxChannel,
      minRgbChannel,
      maxRgbChannel,
      rgbChannelSpan,
      distinctRgbColorCount,
      distinctRgbColorCountCapped: distinctRgbColorCount >= distinctRgbColorLimit,
      hasSurfaceLikeVariation: rgbChannelSpan >= 8 || distinctRgbColorCount >= 4,
      minAlpha,
      maxAlpha,
      allTransparentBlack: nonzeroRgbPixelCount === 0 && nonzeroAlphaPixelCount === 0,
      allBlack: nonzeroRgbPixelCount === 0,
      hasVisiblePixels: nonzeroRgbPixelCount > 0 && nonzeroAlphaPixelCount > 0,
      rgbaPixels: rgbaPixels || undefined
    };
  } catch (error) {
    return {
      status: 'error',
      reason: error instanceof Error ? error.message : String(error),
      width,
      height,
      bitDepth,
      colorType
    };
  }
}

function visualFramePngBytes(frame) {
  const match = typeof frame?.dataUrl === 'string'
    ? /^data:image\/png;base64,(.+)$/i.exec(frame.dataUrl)
    : null;
  return match ? Buffer.from(match[1], 'base64') : null;
}

function compareCapturedPngFrames(referenceFrame, candidateFrame, {
  minChannelDelta = 1
} = {}) {
  const referenceBytes = visualFramePngBytes(referenceFrame);
  const candidateBytes = visualFramePngBytes(candidateFrame);
  if (!referenceBytes || !candidateBytes) {
    return {
      schema: 'peercompute.ulg.sph-probe-png-frame-delta.v0',
      status: 'not-ready',
      reason: 'reference or candidate frame did not include PNG bytes'
    };
  }
  const reference = analyzePngFrame(referenceBytes, {
    region: referenceFrame?.validationRegion || null,
    includeRgbaPixels: true
  });
  const candidate = analyzePngFrame(candidateBytes, {
    region: candidateFrame?.validationRegion || null,
    includeRgbaPixels: true
  });
  if (
    reference?.status !== 'ready'
    || candidate?.status !== 'ready'
    || !reference.rgbaPixels
    || !candidate.rgbaPixels
  ) {
    return {
      schema: 'peercompute.ulg.sph-probe-png-frame-delta.v0',
      status: 'not-ready',
      reason: `reference=${reference?.status || 'missing'}; candidate=${candidate?.status || 'missing'}`
    };
  }
  if (
    reference.width !== candidate.width
    || reference.height !== candidate.height
    || reference.rgbaPixels.length !== candidate.rgbaPixels.length
  ) {
    return {
      schema: 'peercompute.ulg.sph-probe-png-frame-delta.v0',
      status: 'dimension-mismatch',
      reason: `reference=${reference.width}x${reference.height}; candidate=${candidate.width}x${candidate.height}`,
      referenceWidth: reference.width,
      referenceHeight: reference.height,
      candidateWidth: candidate.width,
      candidateHeight: candidate.height
    };
  }
  const threshold = Math.max(1, Math.min(255, Math.round(Number(minChannelDelta) || 1)));
  let changedPixelCount = 0;
  let maxChannelDelta = 0;
  let totalChangedChannelDelta = 0;
  let changedChannelCount = 0;
  let minX = reference.width;
  let minY = reference.height;
  let maxX = -1;
  let maxY = -1;
  for (let pixelIndex = 0; pixelIndex < reference.pixelCount; pixelIndex += 1) {
    const rgbaOffset = pixelIndex * 4;
    let pixelMaxDelta = 0;
    let pixelChannelDelta = 0;
    for (let channel = 0; channel < 4; channel += 1) {
      const delta = Math.abs(
        reference.rgbaPixels[rgbaOffset + channel]
        - candidate.rgbaPixels[rgbaOffset + channel]
      );
      pixelMaxDelta = Math.max(pixelMaxDelta, delta);
      pixelChannelDelta += delta;
      if (delta > 0) changedChannelCount += 1;
    }
    maxChannelDelta = Math.max(maxChannelDelta, pixelMaxDelta);
    if (pixelMaxDelta < threshold) continue;
    changedPixelCount += 1;
    totalChangedChannelDelta += pixelChannelDelta;
    const x = pixelIndex % reference.width;
    const y = Math.floor(pixelIndex / reference.width);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return {
    schema: 'peercompute.ulg.sph-probe-png-frame-delta.v0',
    status: 'ready',
    reason: null,
    width: reference.width,
    height: reference.height,
    pixelCount: reference.pixelCount,
    minChannelDelta: threshold,
    changedPixelCount,
    changedPixelRatio: reference.pixelCount > 0
      ? changedPixelCount / reference.pixelCount
      : 0,
    changedChannelCount,
    maxChannelDelta,
    meanChangedPixelChannelDelta: changedPixelCount > 0
      ? totalChangedChannelDelta / (changedPixelCount * 4)
      : 0,
    changedBounds: changedPixelCount > 0
      ? {
          x: minX,
          y: minY,
          width: maxX - minX + 1,
          height: maxY - minY + 1
        }
      : null
  };
}

export function browserFrameValidationFromVisualFrame(
  frame,
  { source = null, transparentBlackUnsupported = false } = {}
) {
  const frameSource = source ?? frame?.captureSource ?? 'browser-frame';
  if (!frame || frame.status !== 'captured') {
    return {
      schema: 'peercompute.ulg.sph-browser-frame-pixel-validation.v0',
      status: 'not-run',
      reason: frame?.reason || frame?.error || 'browser-frame capture did not produce a captured PNG frame',
      source: frameSource,
      png: null
    };
  }
  const precomputedPng = frame.validationPng?.status === 'ready'
    ? frame.validationPng
    : null;
  const match = !precomputedPng && typeof frame.dataUrl === 'string'
    ? /^data:image\/png;base64,(.+)$/i.exec(frame.dataUrl)
    : null;
  if (!precomputedPng && !match) {
    return {
      schema: 'peercompute.ulg.sph-browser-frame-pixel-validation.v0',
      status: 'not-run',
      reason: 'browser-frame capture did not include a PNG data URL',
      source: frameSource,
      png: null
    };
  }
  const png = precomputedPng || analyzePngFrame(Buffer.from(match[1], 'base64'));
  if (png?.status !== 'ready') {
    return {
      schema: 'peercompute.ulg.sph-browser-frame-pixel-validation.v0',
      status: 'not-run',
      reason: `browser-frame PNG analysis unavailable: ${png?.reason || png?.status || 'unknown'}`,
      source: frameSource,
      png
    };
  }
  const hasSurfaceLikePixels = Boolean(png.hasVisiblePixels && png.hasSurfaceLikeVariation);
  const transparentBlackNativeCaptureUnsupported = Boolean(
    transparentBlackUnsupported
    && !hasSurfaceLikePixels
    && png.allTransparentBlack
  );
  const status = hasSurfaceLikePixels
    ? 'passed'
    : (transparentBlackNativeCaptureUnsupported ? 'unsupported' : 'failed');
  const visiblePixelCount = Math.min(png.nonzeroRgbPixelCount, png.nonzeroAlphaPixelCount);
  return {
    schema: 'peercompute.ulg.sph-browser-frame-pixel-validation.v0',
    status,
    reason: status === 'passed'
      ? `browser-frame ${frameSource} observed ${visiblePixelCount}/${png.pixelCount} visible pixels with surface-like variation inside the native WebGPU canvas region`
      : (status === 'unsupported'
        ? `browser-frame ${frameSource} returned transparent black for a rendered native WebGPU canvas; treating Playwright/headless canvas capture as unsupported rather than a failed render`
        : (png.hasVisiblePixels
          ? `browser-frame ${frameSource} observed only uniform/non-surface canvas pixels inside the native WebGPU canvas region`
          : `browser-frame ${frameSource} observed no visible pixels inside the native WebGPU canvas region`)),
    source: frameSource,
    width: png.width,
    height: png.height,
    nonzeroPixelCount: visiblePixelCount,
    pixelCount: png.pixelCount,
    png
  };
}

const NATIVE_WEBGPU_SURFACE_RENDERED_STATUSES = new Set([
  'native-webgpu-surface-consumer-rendered',
  'native-webgpu-surface-consumer-debug-clear-rendered',
  'native-webgpu-surface-consumer-candidate-staged-composite-presented'
]);

function nativeWebGpuSurfaceRenderStatusIsRendered(status) {
  return NATIVE_WEBGPU_SURFACE_RENDERED_STATUSES.has(String(status || ''));
}

export async function persistCapturedFrames({
  frames,
  frameDir,
  repoDir = null,
  durableReleasePublication = false
}) {
  const capturedFrames = Array.isArray(frames) ? frames : [];
  if (!frameDir && capturedFrames.length === 0) {
    return {
      schema: 'peercompute.ulg.sph-probe-visual-frame-artifacts.v0',
      status: 'disabled',
      frameCount: 0,
      analyzedFrameCount: 0,
      writtenFrameCount: 0,
      frames: []
    };
  }
  const shouldWriteFrames = Boolean(frameDir);
  if (durableReleasePublication && shouldWriteFrames && typeof repoDir !== 'string') {
    throw new TypeError('durable SPH probe frame publication requires a repository directory');
  }
  if (shouldWriteFrames && !durableReleasePublication) {
    await mkdir(frameDir, { recursive: true });
  }
  const artifacts = [];
  let writtenFrameCount = 0;
  let analyzedFrameCount = 0;
  for (let index = 0; index < capturedFrames.length; index += 1) {
    const frame = capturedFrames[index] || {};
    const base = {
      schema: frame.schema ?? 'peercompute.ulg.sph-probe-visual-frame.v0',
      status: frame.status ?? 'unknown',
      index,
      batchIndex: frame.batchIndex ?? null,
      phase: frame.phase ?? null,
      sampleIndex: frame.sampleIndex ?? null,
      width: frame.width ?? null,
      height: frame.height ?? null,
      capturedAtMs: frame.capturedAtMs ?? null,
      captureSource: frame.captureSource ?? null,
      canvasCount: frame.canvasCount ?? null,
      visibleCanvasCount: frame.visibleCanvasCount ?? null,
      canvasIndex: frame.canvasIndex ?? null,
      canvasCssX: frame.canvasCssX ?? null,
      canvasCssY: frame.canvasCssY ?? null,
      canvasCssWidth: frame.canvasCssWidth ?? null,
      canvasCssHeight: frame.canvasCssHeight ?? null,
      canvasDevicePixelRatio: frame.canvasDevicePixelRatio ?? null,
      canvasSelection: frame.canvasSelection ?? null,
      canvasElementFallback: frame.canvasElementFallback ?? null,
      compositorCaptureRegion: frame.compositorCaptureRegion ?? null,
      validationPng: frame.validationPng ?? null,
      validationRegion: frame.validationRegion ?? null,
      reason: frame.reason ?? null,
      error: frame.error ?? null
    };
    const match = typeof frame.dataUrl === 'string'
      ? /^data:image\/png;base64,(.+)$/i.exec(frame.dataUrl)
      : null;
    if (!match) {
      artifacts.push({
        ...base,
        status: base.status === 'captured' ? 'capture-missing-data-url' : base.status,
        path: null,
        byteLength: 0,
        png: null,
        blankFrame: null
      });
      continue;
    }
    const bytes = Buffer.from(match[1], 'base64');
    let filePath = null;
    if (shouldWriteFrames) {
      const fileName = [
        String(index).padStart(4, '0'),
        `b${String(frame.batchIndex ?? 0).padStart(3, '0')}`,
        safeArtifactToken(frame.phase || 'frame')
      ].join('-') + '.png';
      filePath = path.join(frameDir, fileName);
      if (durableReleasePublication) {
        await publishProbeReleaseArtifact({
          artifactPath: filePath,
          repoDir,
          bytes,
          label: `SPH long-horizon PNG frame ${index}`
        });
      } else {
        await writeFile(filePath, bytes);
      }
      writtenFrameCount += 1;
    }
    const png = analyzePngFrame(bytes);
    if (png?.status === 'ready') analyzedFrameCount += 1;
    artifacts.push({
      ...base,
      status: 'captured',
      path: filePath,
      byteLength: bytes.byteLength,
      png,
      blankFrame: png?.status === 'ready' ? !png.hasVisiblePixels : null
    });
  }
  return {
    schema: 'peercompute.ulg.sph-probe-visual-frame-artifacts.v0',
    status: shouldWriteFrames ? 'ready' : 'analyzed-in-memory',
    frameDir: frameDir ?? null,
    frameCount: artifacts.filter((frame) => frame.status === 'captured').length,
    analyzedFrameCount,
    writtenFrameCount,
    frames: artifacts
  };
}

async function capturePlaywrightCanvasCenterFrame({
  page,
  batchIndex = null,
  phase = 'post-probe-canvas-center-crop',
  sampleIndex = null
} = {}) {
  const base = {
    schema: 'peercompute.ulg.sph-probe-visual-frame.v0',
    batchIndex,
    phase,
    sampleIndex,
    capturedAtMs: Date.now(),
    captureSource: 'playwright-canvas-center-crop'
  };
  try {
    const canvasSummary = await page.evaluate(() => {
      const canvases = Array.from(document.querySelectorAll('canvas'));
      const overlay = document.querySelector('#sph-phase-overlay');
      const sceneApi = overlay?.__sphScene || null;
      const renderBridge = sceneApi?.getSphResidentSurfaceDrawRenderBridge?.() || null;
      const nativeConsumer = sceneApi?.scene?.userData?.sphNativeWebGpuSurfaceConsumer
        || renderBridge?.nativeConsumer
        || null;
      const visibleCanvases = canvases
        .map((canvas, index) => {
          const rect = canvas.getBoundingClientRect?.();
          const style = window.getComputedStyle?.(canvas);
          const visible = Boolean(
            rect
            && rect.width > 0
            && rect.height > 0
            && style?.display !== 'none'
            && style?.visibility !== 'hidden'
            && Number(style?.opacity ?? 1) !== 0
          );
          return {
            index,
            visible,
            rect: rect
              ? {
                  x: rect.x,
                  y: rect.y,
                  width: rect.width,
                  height: rect.height
                }
              : null,
            width: canvas.width ?? null,
            height: canvas.height ?? null,
            style: style
              ? {
                  position: style.position,
                  display: style.display,
                  visibility: style.visibility,
                  opacity: style.opacity,
                  zIndex: style.zIndex,
                  pointerEvents: style.pointerEvents,
                  backgroundColor: style.backgroundColor,
                  mixBlendMode: style.mixBlendMode,
                  transform: style.transform
                }
              : null,
            sameAsRenderBridgeCanvas: renderBridge?.canvas === canvas,
            sameAsNativeConsumerCanvas: nativeConsumer?.canvas === canvas,
            rendererBridge: renderBridge?.rendererBridge ?? null,
            renderBridgeStatus: renderBridge?.status ?? null,
            renderBridgeLastRenderStatus: renderBridge?.lastRenderStatus ?? null,
            renderBridgeFrameCount: renderBridge?.frameCount ?? null,
            renderBridgeNativeSurfaceDebugMode:
              renderBridge?.lastNativeSurfaceDebugMode ?? renderBridge?.nativeSurfaceDebugMode ?? null,
            renderBridgeNativeSurfaceDebugStatus: renderBridge?.lastNativeSurfaceDebugStatus ?? null
          };
        })
        .filter((entry) => entry.visible);
      const requestedSurfaceDraw = String(
        new URL(window.location.href).searchParams.get('surfaceDraw') || ''
      ).toLowerCase();
      const nativeSurfaceRequested = requestedSurfaceDraw === 'native-webgpu-surface-consumer';
      const fallbackCanvas = canvases.at(-1) || null;
      const fallbackRect = fallbackCanvas?.getBoundingClientRect?.() || null;
      const selected = visibleCanvases.find((entry) => entry.sameAsNativeConsumerCanvas)
        || visibleCanvases.find((entry) => entry.sameAsRenderBridgeCanvas)
        || (nativeSurfaceRequested ? visibleCanvases[0] : visibleCanvases.at(-1))
        || (fallbackCanvas
        ? {
            index: canvases.length - 1,
            visible: false,
            rect: fallbackRect
              ? {
                  x: fallbackRect.x,
                  y: fallbackRect.y,
                  width: fallbackRect.width,
                  height: fallbackRect.height
                }
              : null,
            width: fallbackCanvas.width ?? null,
            height: fallbackCanvas.height ?? null,
            style: null,
            sameAsRenderBridgeCanvas: renderBridge?.canvas === fallbackCanvas,
            sameAsNativeConsumerCanvas: nativeConsumer?.canvas === fallbackCanvas,
            rendererBridge: renderBridge?.rendererBridge ?? null,
            renderBridgeStatus: renderBridge?.status ?? null,
            renderBridgeLastRenderStatus: renderBridge?.lastRenderStatus ?? null,
            renderBridgeFrameCount: renderBridge?.frameCount ?? null,
            renderBridgeNativeSurfaceDebugMode:
              renderBridge?.lastNativeSurfaceDebugMode ?? renderBridge?.nativeSurfaceDebugMode ?? null,
            renderBridgeNativeSurfaceDebugStatus: renderBridge?.lastNativeSurfaceDebugStatus ?? null
          }
        : null);
      return {
        canvasCount: canvases.length,
        visibleCanvasCount: visibleCanvases.length,
        selected,
        devicePixelRatio: window.devicePixelRatio ?? null
      };
    });
    const selected = canvasSummary?.selected || null;
    if (!selected || selected.index == null || selected.index < 0) {
      return {
        ...base,
        status: 'missing-canvas',
        reason: 'no-canvas-element',
        canvasCount: canvasSummary?.canvasCount ?? 0,
        visibleCanvasCount: canvasSummary?.visibleCanvasCount ?? 0
      };
    }
    const clipRect = selected.rect
      ? {
          x: Math.max(0, selected.rect.x + selected.rect.width * 0.2),
          y: Math.max(0, selected.rect.y + selected.rect.height * 0.2),
          width: Math.max(1, selected.rect.width * 0.6),
          height: Math.max(1, selected.rect.height * 0.6)
        }
      : null;
    let screenshot = clipRect
      ? await page.screenshot({ type: 'png', clip: clipRect })
      : await page.locator('canvas').nth(selected.index).screenshot({ type: 'png' });
    let screenshotSource = base.captureSource;
    let screenshotPng = analyzePngFrame(screenshot);
    let validationPng = screenshotPng;
    let validationRegion = null;
    let canvasElementFallback = null;
    if (
      clipRect
      && screenshotPng?.status === 'ready'
      && !screenshotPng.hasVisiblePixels
      && selected.index != null
      && selected.index >= 0
    ) {
      try {
        const elementScreenshot = await page.locator('canvas').nth(selected.index).screenshot({ type: 'png' });
        const elementFullPng = analyzePngFrame(elementScreenshot);
        const elementRegion = elementFullPng?.status === 'ready'
          ? {
              x: elementFullPng.width * 0.2,
              y: elementFullPng.height * 0.2,
              width: elementFullPng.width * 0.6,
              height: elementFullPng.height * 0.6
            }
          : null;
        const elementPng = elementRegion
          ? analyzePngFrame(elementScreenshot, { region: elementRegion })
          : elementFullPng;
        canvasElementFallback = {
          status: elementPng?.status === 'ready'
            ? (elementPng.hasVisiblePixels ? 'used-visible-canvas-element-center' : 'blank-canvas-element-center')
            : 'canvas-element-analysis-unavailable',
          source: 'playwright-canvas-element-center',
          png: elementPng?.status === 'ready'
            ? {
                status: elementPng.status,
                width: elementPng.width,
                height: elementPng.height,
                sourceWidth: elementPng.sourceWidth ?? null,
                sourceHeight: elementPng.sourceHeight ?? null,
                region: elementPng.region ?? null,
                pixelCount: elementPng.pixelCount,
                nonzeroRgbPixelCount: elementPng.nonzeroRgbPixelCount,
                nonzeroAlphaPixelCount: elementPng.nonzeroAlphaPixelCount,
                hasVisiblePixels: elementPng.hasVisiblePixels,
                rgbChannelSpan: elementPng.rgbChannelSpan,
                distinctRgbColorCount: elementPng.distinctRgbColorCount,
                hasSurfaceLikeVariation: elementPng.hasSurfaceLikeVariation
              }
            : elementPng
        };
        if (elementPng?.status === 'ready' && elementPng.hasVisiblePixels) {
          screenshot = elementScreenshot;
          screenshotPng = elementFullPng;
          validationPng = elementPng;
          validationRegion = elementPng.region ?? elementRegion;
          screenshotSource = 'playwright-canvas-element-center-fallback';
        }
      } catch (error) {
        canvasElementFallback = {
          status: 'canvas-element-capture-error',
          source: 'playwright-canvas-element',
          reason: error instanceof Error ? error.message : String(error),
          png: null
        };
      }
    }
    return {
      ...base,
      captureSource: screenshotSource,
      status: 'captured',
      width: screenshotPng?.status === 'ready' ? screenshotPng.width : (clipRect?.width ?? selected.width ?? null),
      height: screenshotPng?.status === 'ready' ? screenshotPng.height : (clipRect?.height ?? selected.height ?? null),
      canvasCount: canvasSummary.canvasCount ?? null,
      visibleCanvasCount: canvasSummary.visibleCanvasCount ?? null,
      canvasIndex: selected.index,
      canvasCssX: clipRect?.x ?? selected.rect?.x ?? null,
      canvasCssY: clipRect?.y ?? selected.rect?.y ?? null,
      canvasCssWidth: clipRect?.width ?? selected.rect?.width ?? null,
      canvasCssHeight: clipRect?.height ?? selected.rect?.height ?? null,
      canvasDevicePixelRatio: canvasSummary.devicePixelRatio ?? null,
      canvasSelection: selected,
      canvasElementFallback,
      validationPng,
      validationRegion,
      dataUrl: `data:image/png;base64,${screenshot.toString('base64')}`
    };
  } catch (error) {
    return {
      ...base,
      status: 'capture-error',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function captureNativeH2DiagnosticFrame({
  page,
  batchIndex = null,
  sampleIndex = null,
  isolatedH2Only = false
} = {}) {
  const captureKind = isolatedH2Only ? 'h2-only' : 'h2-ablated';
  const token = [
    `sph-probe-native-${captureKind}`,
    Date.now(),
    Math.random().toString(16).slice(2)
  ].join(':');
  const setup = await page.evaluate(({ expectedToken, isolatedH2Only }) => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const sceneApi = overlay?.__sphScene || null;
    const bridge = sceneApi?.getSphResidentSurfaceDrawRenderBridge?.() || null;
    const drawState = bridge?.drawState || null;
    const additionalDraws = Array.isArray(drawState?.additionalSurfaceDraws)
      ? drawState.additionalSurfaceDraws
      : [];
    const materialOf = (draw) => {
      const parts = String(draw?.surfaceKey || '').split('|');
      return String(parts[1] || parts[0] || '').trim().toLowerCase();
    };
    const h2Draws = additionalDraws.filter((draw) => materialOf(draw) === 'h2');
    const retainedAdditionalDraws = additionalDraws.filter((draw) => materialOf(draw) !== 'h2');
    if (!sceneApi?.refreshViewportAndOverlay || !drawState || h2Draws.length === 0) {
      return {
        schema: 'peercompute.ulg.sph-native-h2-ablation-capture.v0',
        status: 'not-ready',
        reason: !drawState
          ? 'native bridge draw state was unavailable'
          : 'no retained H2 secondary draw was available',
        token: expectedToken
      };
    }
    if (
      overlay.__ulgProbeNativeH2AblationSession
      || overlay.__ulgProbeNativeProductDrawFilterSession
      || bridge.__ulgProbeNativeSurfaceDrawFilter
    ) {
      return {
        schema: 'peercompute.ulg.sph-native-h2-ablation-capture.v0',
        status: 'native-h2-ablation-filter-busy',
        reason: 'another native diagnostic draw filter owns the active bridge',
        token: expectedToken
      };
    }
    const retainedSurfaceKeys = retainedAdditionalDraws
      .map((draw) => String(draw?.surfaceKey || ''))
      .filter(Boolean);
    const h2SurfaceKeys = h2Draws
      .map((draw) => String(draw?.surfaceKey || ''))
      .filter(Boolean);
    const h2DrawSummaries = h2Draws.map((draw) => ({
      surfaceKey: draw?.surfaceKey ?? null,
      renderOrder: draw?.renderOrder ?? null,
      transparencyClassId: draw?.transparencyClassId ?? null,
      depthWriteFlag: draw?.depthWriteFlag ?? null,
      renderLayer: draw?.renderLayer ?? null,
      bindGroupPresent: Boolean(draw?.bindGroup),
      indirectBufferPresent: Boolean(draw?.drawIndirectRowsBuffer)
    }));
    const selectedSurfaceKeys = isolatedH2Only ? h2SurfaceKeys : retainedSurfaceKeys;
    const expectedPrimaryDrawCount = isolatedH2Only
      ? 0
      : (Array.isArray(drawState.drawOrder) ? drawState.drawOrder.length : 0);
    const filter = {
      enabled: true,
      token: expectedToken,
      filterAdditionalSurfaceDraws: true,
      additionalSurfaceKeys: selectedSurfaceKeys,
      suppressPrimarySurfaceDraws: isolatedH2Only,
      suppressBackgroundImage: isolatedH2Only,
      suppressBoxWireframe: isolatedH2Only,
      suppressSchroederProxyDraws: isolatedH2Only
    };
    bridge.__ulgProbeNativeSurfaceDrawFilter = filter;
    const session = {
      bridge,
      filter,
      token: expectedToken,
      expectedPrimaryDrawCount,
      isolatedH2Only,
      selectedSurfaceKeys,
      retainedSurfaceKeys,
      h2SurfaceKeys
    };
    overlay.__ulgProbeNativeH2AblationSession = session;
    const refresh = sceneApi.refreshViewportAndOverlay({
      reason: 'sph-probe-native-h2-ablation-filter'
    });
    const selectedKeys = [
      ...(bridge.lastNativeSurfaceDiagnosticSelectedAdditionalSurfaceKeys || [])
    ].sort();
    const expectedKeys = [...selectedSurfaceKeys].sort();
    const filterApplied = Boolean(
      sceneApi.getSphResidentSurfaceDrawRenderBridge?.() === bridge
      && bridge.__ulgProbeNativeSurfaceDrawFilter === filter
      && bridge.lastNativeSurfaceDiagnosticDrawFilterActive === true
      && bridge.lastNativeSurfaceDiagnosticDrawFilterToken === expectedToken
      && bridge.lastNativeSurfaceDiagnosticSelectedPrimaryDrawCount
        === expectedPrimaryDrawCount
      && JSON.stringify(selectedKeys) === JSON.stringify(expectedKeys)
      && bridge.lastNativeSurfaceDiagnosticBackgroundSuppressed === isolatedH2Only
      && bridge.lastNativeSurfaceDiagnosticBoxWireframeSuppressed === isolatedH2Only
      && bridge.lastNativeSurfaceDiagnosticSchroederProxySuppressed === isolatedH2Only
    );
    const overlayRendered = Boolean(
      refresh?.surfaceOverlayRendered === true
      && refresh?.surfaceOverlayLastRenderStatus === 'native-webgpu-surface-consumer-rendered'
    );
    return {
      schema: 'peercompute.ulg.sph-native-h2-ablation-capture.v0',
      status: overlayRendered && filterApplied
        ? (isolatedH2Only
            ? 'native-h2-only-filter-rendered'
            : 'native-h2-ablation-filter-rendered')
        : (isolatedH2Only
            ? 'native-h2-only-filter-render-failed'
            : 'native-h2-ablation-filter-render-failed'),
      reason: overlayRendered && filterApplied
        ? null
        : `overlayRendered=${overlayRendered}; filterApplied=${filterApplied}`,
      token: expectedToken,
      captureKind: isolatedH2Only ? 'h2-only' : 'h2-ablated',
      h2SurfaceKeys,
      h2DrawSummaries,
      retainedSurfaceKeys,
      selectedSurfaceKeys,
      expectedPrimaryDrawCount,
      filterApplied,
      refreshStatus: refresh?.status ?? null,
      refreshSurfaceOverlayRendered: refresh?.surfaceOverlayRendered ?? null,
      refreshSurfaceOverlayLastRenderStatus: refresh?.surfaceOverlayLastRenderStatus ?? null
    };
  }, { expectedToken: token, isolatedH2Only }).catch((error) => ({
    schema: 'peercompute.ulg.sph-native-h2-ablation-capture.v0',
    status: 'setup-error',
    reason: error instanceof Error ? error.message : String(error),
    token
  }));

  let frame = null;
  let continuity = null;
  let captureError = null;
  let restore = {
    status: 'not-needed',
    reason: 'native H2 ablation filter was not installed'
  };
  try {
    if (
      setup.status === 'native-h2-ablation-filter-rendered'
      || setup.status === 'native-h2-only-filter-rendered'
    ) {
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
      continuity = await page.evaluate((expectedToken) => {
        const overlay = document.querySelector('#sph-phase-overlay');
        const sceneApi = overlay?.__sphScene || null;
        const bridge = sceneApi?.getSphResidentSurfaceDrawRenderBridge?.() || null;
        const session = overlay?.__ulgProbeNativeH2AblationSession || null;
        const selectedKeys = [
          ...(bridge?.lastNativeSurfaceDiagnosticSelectedAdditionalSurfaceKeys || [])
        ].sort();
        const expectedKeys = [...(session?.selectedSurfaceKeys || [])].sort();
        const suppressContext = session?.isolatedH2Only === true;
        const ready = Boolean(
          session?.token === expectedToken
          && session.bridge === bridge
          && bridge?.__ulgProbeNativeSurfaceDrawFilter === session.filter
          && bridge?.lastNativeSurfaceDiagnosticDrawFilterActive === true
          && bridge?.lastNativeSurfaceDiagnosticDrawFilterToken === expectedToken
          && bridge?.lastNativeSurfaceDiagnosticSelectedPrimaryDrawCount
            === session.expectedPrimaryDrawCount
          && JSON.stringify(selectedKeys) === JSON.stringify(expectedKeys)
          && bridge?.lastNativeSurfaceDiagnosticBackgroundSuppressed === suppressContext
          && bridge?.lastNativeSurfaceDiagnosticBoxWireframeSuppressed === suppressContext
          && bridge?.lastNativeSurfaceDiagnosticSchroederProxySuppressed === suppressContext
          && bridge?.lastRenderStatus === 'native-webgpu-surface-consumer-rendered'
        );
        return {
          status: ready
            ? (suppressContext
                ? 'h2-only-filter-continuity-proved'
                : 'h2-ablation-filter-continuity-proved')
            : (suppressContext
                ? 'h2-only-filter-continuity-lost'
                : 'h2-ablation-filter-continuity-lost'),
          reason: ready
            ? null
            : 'active bridge or exact H2 ablation filter changed before capture',
          activeBridgeMatchesInstalledBridge: session?.bridge === bridge,
          installedFilterStillOwned: bridge?.__ulgProbeNativeSurfaceDrawFilter === session?.filter,
          selectedSurfaceKeys: selectedKeys,
          expectedSurfaceKeys: expectedKeys,
          lastRenderStatus: bridge?.lastRenderStatus ?? null
        };
      }, token);
      if (
        continuity.status !== 'h2-ablation-filter-continuity-proved'
        && continuity.status !== 'h2-only-filter-continuity-proved'
      ) {
        throw new Error(continuity.reason);
      }
      frame = await capturePlaywrightCanvasCenterFrame({
        page,
        batchIndex,
        phase: isolatedH2Only
          ? 'post-probe-native-h2-only'
          : 'post-probe-native-h2-ablated-composited',
        sampleIndex
      });
      frame.diagnosticOnly = true;
      frame.captureMode = isolatedH2Only
        ? 'isolated-native-h2-draw-filter'
        : 'canonical-native-pbr-h2-ablated';
      frame.omittedSurfaceKeys = isolatedH2Only ? [] : [...(setup.h2SurfaceKeys || [])];
      frame.selectedSurfaceKeys = [...(setup.selectedSurfaceKeys || [])];
      if (frame.validationPng?.status === 'ready') {
        frame.png = frame.validationPng;
        frame.blankFrame = !frame.validationPng.hasVisiblePixels;
      }
    }
  } catch (error) {
    captureError = error instanceof Error ? error.message : String(error);
  } finally {
    restore = await page.evaluate((expectedToken) => {
      const overlay = document.querySelector('#sph-phase-overlay');
      const sceneApi = overlay?.__sphScene || null;
      const currentBridge = sceneApi?.getSphResidentSurfaceDrawRenderBridge?.() || null;
      const session = overlay?.__ulgProbeNativeH2AblationSession || null;
      if (!session?.bridge || !session?.filter) {
        return {
          status: 'not-needed',
          reason: 'native H2 ablation filter was not installed'
        };
      }
      if (session.token !== expectedToken) {
        return {
          status: 'restore-not-owned',
          reason: 'active native H2 ablation filter belongs to another capture'
        };
      }
      const installedBridge = session.bridge;
      const filterStillOwned = installedBridge.__ulgProbeNativeSurfaceDrawFilter === session.filter
        && session.filter.token === expectedToken;
      if (filterStillOwned) {
        delete installedBridge.__ulgProbeNativeSurfaceDrawFilter;
      }
      if (overlay.__ulgProbeNativeH2AblationSession === session) {
        delete overlay.__ulgProbeNativeH2AblationSession;
      }
      if (!filterStillOwned) {
        return {
          status: 'restore-filter-ownership-lost',
          reason: 'native H2 ablation filter was replaced before cleanup'
        };
      }
      const refresh = sceneApi?.refreshViewportAndOverlay?.({
        reason: 'sph-probe-native-h2-ablation-filter-restore'
      });
      const restored = Boolean(
        refresh?.surfaceOverlayRendered === true
        && refresh?.surfaceOverlayLastRenderStatus === 'native-webgpu-surface-consumer-rendered'
        && currentBridge?.lastNativeSurfaceDiagnosticDrawFilterActive === false
        && currentBridge?.lastNativeSurfaceDiagnosticDrawFilterToken == null
      );
      return {
        status: restored
          ? (currentBridge === installedBridge ? 'restored' : 'restored-after-active-bridge-changed')
          : 'restore-render-failed',
        reason: restored
          ? null
          : `overlayRendered=${refresh?.surfaceOverlayRendered === true}; filterCleared=${currentBridge?.lastNativeSurfaceDiagnosticDrawFilterActive === false}`,
        activeBridgeMatchesInstalledBridge: currentBridge === installedBridge,
        refreshStatus: refresh?.status ?? null,
        refreshSurfaceOverlayRendered: refresh?.surfaceOverlayRendered ?? null,
        refreshSurfaceOverlayLastRenderStatus: refresh?.surfaceOverlayLastRenderStatus ?? null
      };
    }, token).catch((error) => ({
      status: 'restore-error',
      reason: error instanceof Error ? error.message : String(error)
    }));
  }
  return {
    setup,
    frame,
    continuity,
    captureError,
    restore
  };
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensureNodeModules(repoDir, depsDir) {
  const target = path.join(repoDir, 'node_modules');
  if (await exists(target)) return { status: 'present', target };
  if (!(await exists(depsDir))) return { status: 'missing-source', target, depsDir };
  try {
    await symlink(depsDir, target, 'dir');
    return { status: 'symlinked', target, depsDir };
  } catch (error) {
    return {
      status: 'symlink-failed',
      target,
      depsDir,
      reason: error instanceof Error ? error.message : String(error)
    };
  }
}

async function waitForHttp(url, timeoutMs) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(2000, Math.max(250, timeoutMs)));
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (response.ok || response.status < 500) return true;
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timer);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError?.message || 'no response'}`);
}

async function collectBrowserSnapshot(page, label, timeoutMs = 2000) {
  const started = Date.now();
  const snapshot = page.evaluate((snapshotLabel) => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const sceneApi = overlay?.__sphScene || null;
    const sceneUserData = sceneApi?.scene?.userData || {};
    const worker = overlay?.__sphPhaseRebuildWorker || null;
    const peerCache = overlay?.__sphPeerClosureCache || null;
    const trace = overlay?.__sphPerformanceTrace || null;
    const pending = overlay?.__mlsMpmResidentStepsPending || null;
    const residentSteps = sceneApi?.getMlsMpmResidentSteps?.() || overlay?.__mlsMpmResidentSteps || null;
    const residentAuthorityHost = overlay?.__sphPeerComputeResidentAuthorityHost || null;
    const residentComputeManager = overlay?.__sphResidentComputeManager || null;
    const compactWorkerCapability = (source) => source ? {
      schema: source.workerCapabilitySchema ?? null,
      status: source.workerCapabilityStatus ?? null,
      blocker: source.workerCapabilityBlocker ?? null,
      constructorAvailable: source.workerConstructorAvailable ?? null,
      requestedEnableWorkers: source.workerRequestedEnableWorkers ?? null,
      effectiveEnableWorkers: source.workerEffectiveEnableWorkers ?? null,
      workerCount: source.workerCount ?? null,
      targetWorkers: source.workerTargetWorkers ?? null
    } : null;
    return {
      schema: 'peercompute.ulg.sph-probe-browser-snapshot.v0',
      status: 'captured',
      label: snapshotLabel,
      capturedAtMs: performance.now(),
      href: window.location.href,
      overlayReady: Boolean(overlay),
      viewStateReady: Boolean(overlay?.__sphPhaseViewState),
      viewStateSource: overlay?.__sphPhaseViewStateSource || null,
      driverReady: Boolean(overlay?.__sphDriver),
      sceneReady: Boolean(sceneApi),
      particleStateReady: Boolean(sceneApi?.getSphGpuParticleState?.()?.schema),
      mlsParticleStateReady: Boolean(sceneApi?.getMlsMpmGpuParticleState?.()?.schema),
      residentPending: pending ? { ...pending } : null,
      residentAutoSchedule: overlay?.__mlsMpmResidentAutoSchedule || null,
      probeProgress: overlay?.__sphProbeProgress || null,
      residentRefreshProgress: sceneUserData.mlsMpmResidentStepsProgress || null,
      workerLaneLastFallback: sceneUserData.sphWorkerLaneLastFallback || null,
      workerOffscreenResidentStage: (() => {
        const status = sceneUserData.sphWorkerOffscreenResidentStage || null;
        if (!status) return null;
        const result = status.residentScheduleResult || null;
        return {
          schema: status.schema ?? null,
          status: status.status ?? null,
          reason: status.reason ?? null,
          errorName: status.errorName ?? null,
          errorMessage: status.errorMessage ?? null,
          taskId: status.taskId ?? null,
          scheduleId: status.scheduleId ?? result?.scheduleId ?? null,
          laneId: status.laneId ?? result?.laneId ?? null,
          stateKey: status.stateKey ?? result?.stateKey ?? null,
          residentScheduleError: status.residentScheduleError || null,
          residentScheduleResult: result ? {
            schema: result.schema ?? null,
            status: result.status ?? null,
            scheduleId: result.scheduleId ?? null,
            laneId: result.laneId ?? null,
            stateKey: result.stateKey ?? null,
            requestedStepCount: result.requestedStepCount ?? null,
            completedStepCount: result.completedStepCount ?? null,
            cancelled: result.cancelled ?? null,
            terminalStatus: result.terminalStatus ?? null,
            gpuFence: result.gpuFence || null
          } : null
        };
      })(),
      residentSchroederHierarchyHostTiming:
        sceneUserData.schroederHierarchyHostTimingAccumulator
          ?.snapshot?.()
        ?? sceneUserData.schroederHierarchyHostTiming
        ?? null,
      residentSteps: residentSteps ? {
        schema: residentSteps.schema ?? null,
        status: residentSteps.status ?? null,
        backend: residentSteps.backend ?? null,
        completedStepCount: residentSteps.completedStepCount ?? null,
        readbackMode: residentSteps.readbackMode ?? null,
        reactionProductPlacementAccumulatorStatus:
          residentSteps.reactionProductPlacementAccumulatorStatus ?? null,
        reactionProductPlacementSuccessfulDispatchCount:
          residentSteps.reactionProductPlacementSuccessfulDispatchCount ?? null,
        reactionProductPlacementDispatchEvidenceComplete:
          residentSteps.reactionProductPlacementDispatchEvidenceComplete ?? null,
        reactionProductPlacementSourceCountVerified:
          residentSteps.reactionProductPlacementSourceCountVerified ?? null
      } : null,
      residentAuthorityHost: residentAuthorityHost ? {
        schema: residentAuthorityHost.schema ?? null,
        status: residentAuthorityHost.status ?? null,
        source: residentAuthorityHost.source ?? null,
        hostId: residentAuthorityHost.hostId ?? null,
        computeManagerReady: residentAuthorityHost.computeManagerReady ?? null,
        stateManagerReady: residentAuthorityHost.stateManagerReady ?? null,
        nodeKernelMode: residentAuthorityHost.nodeKernelMode ?? null,
        nodeKernelReady: residentAuthorityHost.nodeKernelReady ?? null,
        nodeKernelStarted: residentAuthorityHost.nodeKernelStarted ?? null,
        workerCapability: compactWorkerCapability(residentAuthorityHost),
        peercomputeResidentStageWorkerBridgeAvailable: residentAuthorityHost.peercomputeResidentStageWorkerBridgeAvailable ?? null,
        residentMechanicsStageWorkerRunnerFactoryReady: residentAuthorityHost.residentMechanicsStageWorkerRunnerFactoryReady ?? null
      } : null,
      residentWorkerCapability: compactWorkerCapability(residentAuthorityHost),
      residentComputeManager: residentComputeManager ? {
        schema: residentComputeManager.schema ?? null,
        status: residentComputeManager.status ?? null,
        source: residentComputeManager.source ?? null,
        mode: residentComputeManager.mode ?? null,
        submitTask: residentComputeManager.submitTask ?? null
      } : null,
      residentWebGpuDeviceMapSmoke: sceneUserData.sphResidentWebGpuDeviceMapSmoke || null,
      residentWebGpuDeviceTextureReadbackSmoke:
        sceneUserData.sphResidentWebGpuDeviceTextureReadbackSmoke || null,
      cpuClosureTask: overlay?.__sphCpuClosureTask || null,
      workerRebuild: worker ? {
        schema: worker.schema ?? null,
        status: worker.status ?? null,
        backend: worker.backend ?? null,
        generation: worker.generation ?? null,
        timing: worker.timing || null
      } : null,
      peerClosureCache: peerCache ? {
        schema: peerCache.schema ?? null,
        status: peerCache.status ?? null,
        materialLookup: peerCache.materialLookup ? {
          status: peerCache.materialLookup.status ?? null,
          hitCount: peerCache.materialLookup.hitCount ?? null,
          missCount: peerCache.materialLookup.missCount ?? null
        } : null,
        coldStartLookup: peerCache.coldStartLookup ? {
          status: peerCache.coldStartLookup.status ?? null,
          reactionCount: peerCache.coldStartLookup.reactionCount ?? null,
          productReuseCount: peerCache.coldStartLookup.productReuseCount ?? null
        } : null,
        staticTableRead: peerCache.staticTableRead ? {
          status: peerCache.staticTableRead.status ?? null,
          hitCount: peerCache.staticTableRead.hitCount ?? null,
          tableCount: peerCache.staticTableRead.tableCount ?? null,
          gpuWarmupCount: peerCache.staticTableRead.gpuWarmupCount ?? null
        } : null,
        staticTableWrite: peerCache.staticTableWrite ? {
          status: peerCache.staticTableWrite.status ?? null,
          backend: peerCache.staticTableWrite.backend ?? null,
          tableWriteCount: peerCache.staticTableWrite.tableWriteCount ?? null,
          gpuWarmupWriteCount: peerCache.staticTableWrite.gpuWarmupWriteCount ?? null,
          counts: peerCache.staticTableWrite.counts || null
        } : null
      } : null,
      performanceTrace: trace ? {
        schema: trace.schema ?? null,
        spanCount: Array.isArray(trace.spans) ? trace.spans.length : 0,
        lastSpan: Array.isArray(trace.spans) && trace.spans.length ? trace.spans[trace.spans.length - 1] : null
      } : null,
      residentStageOrderTrace: overlay?.__sphResidentStageOrderTrace ? {
        schema: overlay.__sphResidentStageOrderTrace.schema ?? null,
        status: overlay.__sphResidentStageOrderTrace.status ?? null,
        eventCount: overlay.__sphResidentStageOrderTrace.eventCount ?? null,
        retainedEventCount: overlay.__sphResidentStageOrderTrace.retainedEventCount ?? null,
        resetGeneration: overlay.__sphResidentStageOrderTrace.resetGeneration ?? null,
        lastEvent: overlay.__sphResidentStageOrderTrace.lastEvent || null
      } : null,
      setParticlesTiming: overlay?.__sphSetParticlesTiming || sceneUserData.sphSetParticlesTiming || null,
      surfaceApplyTiming: overlay?.__sphSurfaceApplyTiming || sceneUserData.sphSurfaceApplyTiming || null,
      rendererInit: sceneUserData.sphRendererInit || null,
      renderModeSelection: overlay?.__sphRenderModeSelection || null,
      residentRenderProgress: sceneUserData.sphResidentRenderProgress || null,
      residentGpuRefreshInFlight: sceneUserData.sphResidentGpuRefreshInFlight || null,
      surfaceMaterialRenderPolicy: sceneUserData.sphSurfaceMaterialRenderPolicy || null,
      surfaceMaterialRendererProxySummary: sceneUserData.sphSurfaceMaterialRendererProxySummary || null,
      surfaceMaterialRendererProxyCount: sceneUserData.sphResidentSurfaceDrawRenderBridge?.materialRendererProxyCount ?? null,
      surfaceMaterialRendererProxyBridge: sceneUserData.sphResidentSurfaceDrawRenderBridge?.rendererBridge ?? null,
      rendererFrame: sceneUserData.sphRendererFrame || null,
      viewportRefresh: sceneUserData.sphViewportRefresh || null,
      viewportResize: sceneUserData.sphViewportResize || null,
      frameCounters: overlay?.__sphFrameCounters || null,
      statusText: overlay?.querySelector?.('#sph-status')?.textContent || null,
      warningText: overlay?.querySelector?.('#sph-warning-bar')?.textContent || null
    };
  }, label);
  let timeoutId = null;
  const timeout = new Promise((resolve) => {
    timeoutId = setTimeout(() => resolve({
      schema: 'peercompute.ulg.sph-probe-browser-snapshot.v0',
      status: 'snapshot-timeout',
      label,
      timeoutMs,
      elapsedMs: Date.now() - started
    }), timeoutMs);
  });
  try {
    return await Promise.race([snapshot, timeout]);
  } catch (error) {
    return {
      schema: 'peercompute.ulg.sph-probe-browser-snapshot.v0',
      status: 'snapshot-error',
      label,
      reason: error instanceof Error ? error.message : String(error),
      elapsedMs: Date.now() - started
    };
  } finally {
    if (timeoutId !== null) clearTimeout(timeoutId);
  }
}

async function collectInPagePartialTimeline(page, timeoutMs = 1000) {
  if (!page) return null;
  let timeoutId = null;
  const partial = page.evaluate(() => (
    globalThis.__ulgSphProbePartialTimeline || null
  ));
  const timeout = new Promise((resolve) => {
    timeoutId = setTimeout(() => resolve(null), timeoutMs);
  });
  try {
    return await Promise.race([partial, timeout]);
  } catch {
    return null;
  } finally {
    if (timeoutId !== null) clearTimeout(timeoutId);
  }
}

function startViteServer({ repoDir, port, viteBin, timeoutMs }) {
  const proc = spawn(
    process.execPath,
    [
      viteBin,
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--strictPort'
    ],
    {
      cwd: repoDir,
      env: {
        ...process.env,
        FORCE_COLOR: '0',
        NO_COLOR: '1'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    }
  );
  const logs = [];
  proc.stdout.on('data', (chunk) => logs.push(String(chunk)));
  proc.stderr.on('data', (chunk) => logs.push(String(chunk)));
  const closed = new Promise((resolve) => {
    proc.once('close', (code, signal) => resolve({ code, signal }));
    proc.once('error', (error) => resolve({
      code: null,
      signal: null,
      error: error instanceof Error ? error.message : String(error)
    }));
  });
  const baseUrl = `http://127.0.0.1:${port}`;
  return {
    proc,
    baseUrl,
    logs,
    ready: waitForHttp(baseUrl, timeoutMs),
    async stop() {
      if (proc.exitCode !== null || proc.signalCode !== null) {
        return closed;
      }
      proc.kill('SIGTERM');
      let gracefulTimeoutId = null;
      const graceful = await Promise.race([
        closed,
        new Promise((resolve) => {
          gracefulTimeoutId = setTimeout(() => resolve(null), 5_000);
        })
      ]).finally(() => {
        if (gracefulTimeoutId !== null) clearTimeout(gracefulTimeoutId);
      });
      if (graceful) return graceful;
      if (proc.exitCode === null && proc.signalCode === null) {
        proc.kill('SIGKILL');
      }
      return closed;
    }
  };
}

async function runBrowserProbe({
  baseUrl,
  scenarioUrl,
  timeoutMs,
  batches,
  batchSteps,
  interactiveCacheLifecycle = false,
  renderEvery,
  readbackMode,
  compactSummaryMode,
  activeGridDispatchPlanRefreshMode = 'final-only',
  renderReadbackMode,
  renderRowsReadbackMode,
  renderFieldSurfaceSummaryMode,
  surfaceDrawDiagnosticMode,
  surfaceDrawDiagnosticMaxFieldCells,
  surfaceDrawDiagnosticMaxResolution,
  nativeMarchingCubesMaxVertexRowsBufferByteLength,
  nativeMarchingCubesMaxResolution,
  disablePressureInterface,
  contactBinMetadataReadback = false,
  reactionBinMetadataReadback = false,
  anomalyRowReadback,
  residentBufferDebug,
  compactSummaryScope,
  thermalWallRate,
  captureThermalCandidateCsrRouteEvidence = false,
  measureGpuQueueFence = false,
  measureGpuTimestampInterval = false,
  measureGpuStageTimestamps = false,
  measureGpuStageEncoderSpans = true,
  traceResidentStageWall = false,
  collectSchroederHierarchyHostTiming = false,
  materialInterfaceDiagnostic = false,
  materialInterfaceCandidateReadbackMode = 'compact-active-readback',
  nativeSurfaceDebugMode = 'none',
  nativeSurfaceValidationWaitMs = 0,
  captureFrames,
  visualIntervalCaptureRequested = captureFrames,
  captureProductSurfacesOnly = false,
  captureH2VisibilityAblation = false,
  captureFrameEvery,
  captureFrameMax,
  initialResidentWaitMs,
  workerLaneProgressEverySteps = 1,
  useMountedResidentSchedule = false,
  artifactDetailMode,
  phaseVolumeMaxImpulseFraction,
  generatedGasTargetMaterial,
  generatedGasMinimumMassKg,
  generatedGasMinimumMassFractionOfSystem
}) {
  const nativeSurfaceExtractionAtVisualIntervals =
    nativeSurfaceVisualIntervalExtractionEnabled({
      surfaceDrawMode: surfaceDrawDiagnosticMode,
      captureFrames: visualIntervalCaptureRequested
  });
  let browser = null;
  let page = null;
  let consoleCapture = null;
  let completedTimeline = null;
  let browserLifecycleSettled = false;
  let buildFatalTimeline = null;
  const preProbeSnapshots = [];
  const fatalSignal = createBrowserProbeFatalSignal();
  try {
    browser = await launchProbeBrowser();
    page = await newProbePage(browser);
    consoleCapture = createBrowserConsoleCapture({
      onCriticalGpuMessage(message) {
        if (
          message?.category === 'device-lost'
          || message?.category === 'out-of-memory'
        ) {
          fatalSignal.trip({
            source: 'browser-console',
            category: message.category,
            message: message.text,
            receivedAtMs: message.receivedAtMs,
            detail: message
          });
        }
      }
    });
    const pageConsole = consoleCapture.entries;
    page.on('console', (message) => {
      consoleCapture.recordConsole(message);
    });
    page.on('pageerror', (error) => {
      consoleCapture.recordPageError(error);
    });
    page.on('crash', () => {
      if (browserLifecycleSettled) return;
      fatalSignal.trip({
        source: 'playwright-page-crash',
        category: 'page-crash',
        message: 'probe-owned Chromium page crashed'
      });
    });
    browser.on('disconnected', () => {
      if (browserLifecycleSettled) return;
      fatalSignal.trip({
        source: 'playwright-browser-disconnected',
        category: 'browser-disconnected',
        message: 'probe-owned Chromium browser disconnected unexpectedly'
      });
    });
    buildFatalTimeline = async (fatalTermination) => {
      const [partialTimeline, fatalSnapshot] = page
        ? await Promise.all([
            collectInPagePartialTimeline(page, 1000),
            collectBrowserSnapshot(page, 'probe-fatal-termination', 2000)
          ])
        : [null, {
          schema: 'peercompute.ulg.sph-probe-browser-snapshot.v0',
          status: 'snapshot-unavailable',
          label: 'probe-fatal-termination',
          reason: 'probe page was unavailable'
        }];
      const retainedMetrics = Array.isArray(partialTimeline?.metrics)
        ? partialTimeline.metrics
        : [];
      const retainedVisualFrames = Array.isArray(partialTimeline?.visualFrames)
        ? partialTimeline.visualFrames
        : [];
      const retainedErrors = Array.isArray(partialTimeline?.errors)
        ? partialTimeline.errors
        : [];
      const retainedCheckpointCapture =
        partialTimeline?.authoritativeGpuCheckpointCapture || null;
      return {
        schema: 'peercompute.ulg.sph-history-long-horizon-probe.v0',
        status: 'blocked',
        reason: fatalTermination.message,
        fatalTermination,
        batchCount: batches,
        batchStepCount: batchSteps,
        requestedSubsteps: batches * batchSteps,
        readbackMode,
        compactSummaryMode,
        renderReadbackMode,
        renderRowsReadbackMode,
        renderFieldSurfaceSummaryMode,
        surfaceDrawDiagnosticMode,
        surfaceDrawDiagnosticMaxFieldCells,
        surfaceDrawDiagnosticMaxResolution,
        nativeMarchingCubesMaxVertexRowsBufferByteLength,
        nativeMarchingCubesMaxResolution,
        nativeSurfaceDebugMode,
        nativeSurfaceValidationWaitMs,
        pressureInterfaceDisabled: Boolean(disablePressureInterface),
        anomalyRowReadback: Boolean(anomalyRowReadback),
        residentBufferDebug: Boolean(residentBufferDebug),
        renderEveryBatches: renderEvery,
        preProbeSnapshots: [...preProbeSnapshots, fatalSnapshot],
        pageConsole,
        visualFrameCapture: {
          enabled: Boolean(captureFrames),
          frameEveryBatches: captureFrameEvery,
          maxFrames: captureFrameMax,
          frameCount: retainedVisualFrames.length
        },
        authoritativeGpuCheckpointCapture: retainedCheckpointCapture || {
          schema: 'peercompute.ulg.sph-authoritative-gpu-checkpoint-capture.v1',
          status: captureFrames
            ? 'probe-fatal-device-loss-before-checkpoint-return'
            : 'disabled',
          enabled: Boolean(captureFrames),
          trigger: 'visual-validation-checkpoint',
          diagnosticOnly: true,
          physicsReference: false,
          sourceBufferMutation: false,
          normalHotLoopReadbackFree: true,
          checkpointCount: 0,
          capturedCount: 0,
          unavailableCount: 0,
          errorCount: 0
        },
        visualFrames: retainedVisualFrames,
        errors: [...retainedErrors, {
          batchIndex: null,
          phase: 'probe-fatal-termination',
          message: fatalTermination.message,
          fatalTermination
        }],
        metrics: retainedMetrics,
        scientificValidation: false,
        sphValidation: false,
        phaseChangeValidation: false,
        fullPhysicsValidation: false
      };
    };
    await page.exposeFunction('__ulgCaptureSphProbeCompositedFrame', async ({ clip = null } = {}) => {
    const viewport = page.viewportSize();
    const requested = clip && typeof clip === 'object'
      ? {
          x: Math.max(0, Number(clip.x) || 0),
          y: Math.max(0, Number(clip.y) || 0),
          width: Math.max(1, Number(clip.width) || 1),
          height: Math.max(1, Number(clip.height) || 1)
        }
      : null;
    const boundedClip = requested && viewport
      ? {
          x: Math.min(requested.x, Math.max(0, viewport.width - 1)),
          y: Math.min(requested.y, Math.max(0, viewport.height - 1)),
          width: Math.max(1, Math.min(requested.width, viewport.width - requested.x)),
          height: Math.max(1, Math.min(requested.height, viewport.height - requested.y))
        }
      : requested;
    try {
      const png = await page.screenshot({
        type: 'png',
        animations: 'disabled',
        ...(boundedClip ? { clip: boundedClip } : {})
      });
      return {
        status: 'captured',
        captureSource: 'playwright-compositor-screenshot',
        width: boundedClip?.width ?? viewport?.width ?? null,
        height: boundedClip?.height ?? viewport?.height ?? null,
        dataUrl: `data:image/png;base64,${png.toString('base64')}`
      };
    } catch (error) {
      return {
        status: 'capture-error',
        captureSource: 'playwright-compositor-screenshot',
        reason: error instanceof Error ? error.message : String(error),
        dataUrl: null
      };
    }
    });
    await page.addInitScript(({ stageSelector, bufferLabelSelector }) => {
      globalThis.__ulgGpuQueueBoundaryStageSelector = stageSelector;
      globalThis.__ulgGpuQueueBoundaryBufferLabelSelector =
        bufferLabelSelector;
    }, {
      stageSelector: String(
        process.env.ULG_PROBE_GPU_QUEUE_BOUNDARY_STAGE
        || 'generation-pre-submit-boundary'
      ),
      bufferLabelSelector: String(
        process.env.ULG_PROBE_GPU_QUEUE_BOUNDARY_BUFFER_LABEL
        || ''
      )
    });
    if (process.env.ULG_PROBE_TRACE_NATIVE_QUEUE_FENCES === '1') {
      await page.addInitScript(() => {
        let queueFenceTraceInstallAttempts = 0;
        const installQueueFenceTrace = () => {
          const prototype = globalThis.GPUQueue?.prototype;
          const original = prototype?.onSubmittedWorkDone;
          if (!prototype || typeof original !== 'function') {
            queueFenceTraceInstallAttempts += 1;
            if (queueFenceTraceInstallAttempts < 200) {
              setTimeout(installQueueFenceTrace, 10);
            }
            return;
          }
          if (prototype.__ulgQueueFenceTraceInstalled) return;
          Object.defineProperty(prototype, '__ulgQueueFenceTraceInstalled', {
            value: true,
            configurable: true
          });
          // Tallied by call site as well as logged. A stack dump per fence
          // shows where fences come from; only a count that rises per frame
          // shows which ones are a per-frame bubble rather than setup.
          const fenceTally = new Map();
          globalThis.__ulgQueueFenceTally = () => Object.fromEntries(
            [...fenceTally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24)
          );
          globalThis.__ulgQueueFenceTotal = () => [...fenceTally.values()]
            .reduce((sum, count) => sum + count, 0);
          Object.defineProperty(prototype, 'onSubmittedWorkDone', {
            configurable: true,
            writable: true,
            value(...args) {
              const stack = new Error().stack || 'stack unavailable';
              // Preserve enough parents to identify the allocation owner.
              // Generic cleanup and retirement helpers otherwise collapse
              // every fence into one unhelpful webgpuComputeLayout.js bucket.
              const frames = stack.split('\n').slice(2, 8)
                .map((frame) => frame.trim())
                .filter(Boolean);
              const site = frames.length > 0 ? frames.join(' <- ') : '?';
              fenceTally.set(site, (fenceTally.get(site) ?? 0) + 1);
              if (globalThis.__ulgQueueFenceStackLog === true) {
                console.error('[ulg-native-queue-fence-trace]', stack);
              }
              return original.apply(this, args);
            }
          });
          // The emitted probe metric uses this global as its installation
          // witness. Publish it only after the real prototype wrapper is in
          // place: a deferred or failed install must leave each sampled metric
          // fail-closed rather than claiming tracing that did not exist.
          globalThis.__ulgQueueFenceTraceInstalled = true;
        };
        installQueueFenceTrace();
      });
    }
    // "We never want CPU readbacks" is a claim about the running frame, and the
    // runtime has ~140 static mapAsync sites most of which are gated. Counting
    // them by hand proves nothing. This tallies the calls that actually happen,
    // by buffer label, so a per-frame readback shows up as a count that climbs
    // with the frame number instead of staying at its startup value.
    if (process.env.ULG_PROBE_TRACE_NATIVE_BUFFER_MAP === '1') {
      await page.addInitScript(() => {
        let mapTraceInstallAttempts = 0;
        const installMapTrace = () => {
          const prototype = globalThis.GPUBuffer?.prototype;
          const original = prototype?.mapAsync;
          if (!prototype || typeof original !== 'function') {
            mapTraceInstallAttempts += 1;
            if (mapTraceInstallAttempts < 200) setTimeout(installMapTrace, 10);
            return;
          }
          if (prototype.__ulgBufferMapTraceInstalled) return;
          Object.defineProperty(prototype, '__ulgBufferMapTraceInstalled', {
            value: true,
            configurable: true
          });
          const tally = new Map();
          globalThis.__ulgBufferMapTally = () => Object.fromEntries(
            [...tally.entries()].sort((a, b) => b[1] - a[1])
          );
          globalThis.__ulgBufferMapTotal = () => [...tally.values()]
            .reduce((sum, count) => sum + count, 0);
          Object.defineProperty(prototype, 'mapAsync', {
            configurable: true,
            writable: true,
            value(...args) {
              const key = this.label || '(unlabelled)';
              tally.set(key, (tally.get(key) ?? 0) + 1);
              return original.apply(this, args);
            }
          });
        };
        installMapTrace();
      });
    }
    // Per-substep DAG rebuilds. A bind group or pipeline rebuilt every substep
    // is work proportional to the schedule rather than to the simulation, and
    // the only way to tell a rebuild from a cache hit is to count the device
    // calls that actually happen.
    if (process.env.ULG_PROBE_TRACE_NATIVE_DAG_BUILDS === '1') {
      await page.addInitScript(() => {
        let dagTraceInstallAttempts = 0;
        const installDagTrace = () => {
          const prototype = globalThis.GPUDevice?.prototype;
          if (!prototype || typeof prototype.createBindGroup !== 'function') {
            dagTraceInstallAttempts += 1;
            if (dagTraceInstallAttempts < 200) setTimeout(installDagTrace, 10);
            return;
          }
          if (prototype.__ulgDagTraceInstalled) return;
          Object.defineProperty(prototype, '__ulgDagTraceInstalled', {
            value: true,
            configurable: true
          });
          const tally = new Map();
          globalThis.__ulgDagBuildTally = () => Object.fromEntries(
            [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24)
          );
          for (const method of [
            'createBindGroup',
            'createBindGroupLayout',
            'createComputePipeline',
            'createPipelineLayout',
            'createShaderModule',
            'createRenderPipeline',
            'createBuffer'
          ]) {
            const original = prototype[method];
            if (typeof original !== 'function') continue;
            Object.defineProperty(prototype, method, {
              configurable: true,
              writable: true,
              value(descriptor, ...rest) {
                // Counts alone cannot say whether a per-substep allocation is
                // worth removing. Wall time is what decides that, so the wrapper
                // times the call as well as counting it.
                const startedAt = performance.now();
                try {
                  return original.call(this, descriptor, ...rest);
                } finally {
                  const elapsed = performance.now() - startedAt;
                  globalThis.__ulgDagBuildMs = (globalThis.__ulgDagBuildMs ?? 0) + elapsed;
                  if (method === 'createBuffer') {
                    globalThis.__ulgCreateBufferMs =
                      (globalThis.__ulgCreateBufferMs ?? 0) + elapsed;
                  }
                  recordTally(descriptor, method);
                }
              }
            });
          }
          function recordTally(descriptor, method) {
                let key = `${method}:${descriptor?.label ?? ''}`;
                if (!descriptor?.label) {
                  const stack = new Error().stack || '';
                  const site = (stack.split('\n')[2] || '?').trim()
                    .replace(/https?:\/\/[^ )]*\//, '');
                  key = `${method}@${site}`;
                }
                tally.set(key, (tally.get(key) ?? 0) + 1);
          }
        };
        installDagTrace();
      });
    }
    // Queue writes happen outside command encoders, so same-encoder timestamp
    // spans cannot attribute them. This opt-in trace counts their exact bytes
    // and host call time while also exposing submit cadence. It is diagnostic
    // only and never changes the production simulation route.
    if (process.env.ULG_PROBE_TRACE_NATIVE_QUEUE_WRITES === '1') {
      await page.addInitScript((captureOrderedEvents) => {
        let queueWriteTraceInstallAttempts = 0;
        const installQueueWriteTrace = () => {
          const prototype = globalThis.GPUQueue?.prototype;
          const encoderPrototype = globalThis.GPUCommandEncoder?.prototype;
          if (
            !prototype
            || typeof prototype.writeBuffer !== 'function'
            || typeof prototype.submit !== 'function'
            || (
              captureOrderedEvents
              && (
                !encoderPrototype
                || typeof encoderPrototype.finish !== 'function'
              )
            )
          ) {
            queueWriteTraceInstallAttempts += 1;
            if (queueWriteTraceInstallAttempts < 200) {
              setTimeout(installQueueWriteTrace, 10);
            }
            return;
          }
          if (prototype.__ulgQueueWriteTraceInstalled) return;
          Object.defineProperty(prototype, '__ulgQueueWriteTraceInstalled', {
            value: true,
            configurable: true
          });
          const originalWriteBuffer = prototype.writeBuffer;
          const originalSubmit = prototype.submit;
          const writesByBuffer = new Map();
          const orderedEvents = [];
          const commandBufferLabels = new WeakMap();
          const maxOrderedEventCount = 8192;
          let writeBufferCount = 0;
          let writeBufferBytes = 0;
          let writeBufferMs = 0;
          let submitCount = 0;
          let submittedCommandBufferCount = 0;
          let submitMs = 0;
          let orderedEventOverflowCount = 0;
          const recordOrderedEvent = (event) => {
            if (!captureOrderedEvents) return;
            if (orderedEvents.length >= maxOrderedEventCount) {
              orderedEventOverflowCount += 1;
              return;
            }
            orderedEvents.push({
              ordinal: orderedEvents.length,
              atMs: performance.now(),
              ...event
            });
          };
          const resolvedWriteByteLength = (data, dataOffset, size) => {
            const byteLength = Math.max(0, Number(data?.byteLength) || 0);
            const offset = Math.max(0, Number(dataOffset) || 0);
            if (size !== undefined) {
              return Math.max(0, Number(size) || 0);
            }
            return Math.max(0, byteLength - offset);
          };
          if (captureOrderedEvents) {
            const originalFinish = encoderPrototype.finish;
            Object.defineProperty(encoderPrototype, 'finish', {
              configurable: true,
              writable: true,
              value(descriptor) {
                const commandBuffer = originalFinish.call(this, descriptor);
                commandBufferLabels.set(
                  commandBuffer,
                  descriptor?.label || this.label || '(unlabelled-command-encoder)'
                );
                return commandBuffer;
              }
            });
          }
          Object.defineProperty(prototype, 'writeBuffer', {
            configurable: true,
            writable: true,
            value(buffer, bufferOffset, data, dataOffset, size) {
              const byteLength = resolvedWriteByteLength(data, dataOffset, size);
              const label = buffer?.label || '(unlabelled)';
              const startedAt = performance.now();
              try {
                return originalWriteBuffer.call(
                  this,
                  buffer,
                  bufferOffset,
                  data,
                  dataOffset,
                  size
                );
              } finally {
                const elapsedMs = performance.now() - startedAt;
                writeBufferCount += 1;
                writeBufferBytes += byteLength;
                writeBufferMs += elapsedMs;
                const entry = writesByBuffer.get(label) || {
                  count: 0,
                  bytes: 0,
                  ms: 0
                };
                entry.count += 1;
                entry.bytes += byteLength;
                entry.ms += elapsedMs;
                writesByBuffer.set(label, entry);
                recordOrderedEvent({
                  kind: 'writeBuffer',
                  bufferLabel: label,
                  bufferOffset: Math.max(0, Number(bufferOffset) || 0),
                  byteLength
                });
                const boundaryLabelSelector = String(
                  globalThis.__ulgGpuQueueBoundaryBufferLabelSelector || ''
                );
                if (
                  boundaryLabelSelector
                  && label.includes(boundaryLabelSelector)
                  && typeof globalThis.__ulgGpuQueueWriteBoundaryHook
                    === 'function'
                ) {
                  globalThis.__ulgGpuQueueWriteBoundaryHook({
                    queue: this,
                    bufferLabel: label,
                    bufferOffset: Math.max(0, Number(bufferOffset) || 0),
                    byteLength
                  });
                }
              }
            }
          });
          Object.defineProperty(prototype, 'submit', {
            configurable: true,
            writable: true,
            value(commandBuffers) {
              const commandBufferCount = Number(commandBuffers?.length) || 0;
              const startedAt = performance.now();
              try {
                return originalSubmit.call(this, commandBuffers);
              } finally {
                submitCount += 1;
                submittedCommandBufferCount += commandBufferCount;
                submitMs += performance.now() - startedAt;
                recordOrderedEvent({
                  kind: 'submit',
                  commandBufferCount,
                  commandBufferLabels: Array.from(
                    commandBuffers || [],
                    (commandBuffer) => (
                      commandBufferLabels.get(commandBuffer)
                      || commandBuffer?.label
                      || '(unlabelled-command-buffer)'
                    )
                  )
                });
              }
            }
          });
          globalThis.__ulgQueueWriteTrace = () => ({
            writeBufferCount,
            writeBufferBytes,
            writeBufferMs,
            submitCount,
            submittedCommandBufferCount,
            submitMs,
            orderedEventCaptureRequested: Boolean(captureOrderedEvents),
            orderedEventOverflowCount,
            orderedEvents: captureOrderedEvents
              ? orderedEvents.map((event) => ({ ...event }))
              : [],
            writesByBuffer: Object.fromEntries(
              [...writesByBuffer.entries()]
                .sort((left, right) => (
                  right[1].bytes - left[1].bytes
                  || right[1].count - left[1].count
                ))
                .slice(0, 96)
            )
          });
        };
        installQueueWriteTrace();
      }, process.env.ULG_PROBE_TRACE_NATIVE_QUEUE_WRITE_EVENTS === '1');
    }
    if (process.env.ULG_PROBE_TRACE_NATIVE_DEVICE_DESTROY === '1') {
      await page.addInitScript(() => {
        let deviceDestroyTraceInstallAttempts = 0;
        const installDeviceDestroyTrace = () => {
          const prototype = globalThis.GPUDevice?.prototype;
          const original = prototype?.destroy;
          if (!prototype || typeof original !== 'function') {
            deviceDestroyTraceInstallAttempts += 1;
            if (deviceDestroyTraceInstallAttempts < 200) {
              setTimeout(installDeviceDestroyTrace, 10);
            }
            return;
          }
          if (prototype.__ulgDeviceDestroyTraceInstalled) return;
          Object.defineProperty(prototype, '__ulgDeviceDestroyTraceInstalled', {
            value: true,
            configurable: true
          });
          Object.defineProperty(prototype, 'destroy', {
            configurable: true,
            writable: true,
            value(...args) {
              console.error('[ulg-native-device-destroy-trace]', new Error().stack || 'stack unavailable');
              return original.apply(this, args);
            }
          });
        };
        installDeviceDestroyTrace();
      });
    }
    if (nativeSurfaceDebugMode !== 'none') {
      await page.addInitScript((mode) => {
        window.__ULG_SPH_NATIVE_SURFACE_DEBUG_MODE = mode;
        window.__ULG_SPH_NATIVE_SURFACE_CONSUMER_DEBUG_MODE = mode;
      }, nativeSurfaceDebugMode);
    }
    const target = new URL(withBrowserProbeParams(scenarioUrl, {
      contactBinMetadataReadback,
      reactionBinMetadataReadback
    }), baseUrl).toString();
    await awaitBrowserProbeOperation(
      page.goto(target, { waitUntil: 'domcontentloaded', timeout: timeoutMs }),
      fatalSignal
    );
    const workerDeviceLossWatcher = page.waitForFunction(() => {
      const overlay = document.querySelector('#sph-phase-overlay');
      const scene = overlay?.__sphScene;
      const presentation =
        scene?.getWorkerOffscreenPresentation?.()
        || overlay?.__sphWorkerOffscreenPresentation
        || null;
      return presentation?.status === 'worker-offscreen-presentation-device-lost';
    }, null, { timeout: 0 }).then(() => {
      fatalSignal.trip({
        source: 'worker-offscreen-presentation-status',
        category: 'device-lost',
        message: 'worker offscreen presentation reported device loss'
      });
    }, () => {});
    // The watcher is intentionally not awaited. Its rejection is handled so
    // closing the owned page cannot create a late unhandled rejection.
    workerDeviceLossWatcher.catch(() => {});
    await awaitBrowserProbeOperation(
      ensureProbeSphPhaseOverlay(page, { timeoutMs }),
      fatalSignal
    );
    preProbeSnapshots.push(await awaitBrowserProbeOperation(
      collectBrowserSnapshot(page, 'overlay-ready'),
      fatalSignal
    ));
    try {
      await awaitBrowserProbeOperation(page.waitForFunction(() => {
        const overlay = document.querySelector('#sph-phase-overlay');
        const scene = overlay?.__sphScene;
        return Boolean(scene?.getSphGpuParticleState?.()?.schema || overlay?.__sphDriver);
      }, null, { timeout: timeoutMs }), fatalSignal);
    } catch (readinessError) {
      if (readinessError?.browserProbeFatalTermination) {
        throw readinessError;
      }
      // This wait is where a scenario that is simply too large for the current
      // build fails, and a bare Playwright timeout says nothing about why. The
      // console has already been captured; without flushing it here it is
      // discarded at exactly the moment it is the only evidence there is.
      const readinessState = await page.evaluate(() => {
        const overlay = document.querySelector('#sph-phase-overlay');
        const scene = overlay?.__sphScene;
        return {
          overlayPresent: Boolean(overlay),
          scenePresent: Boolean(scene),
          driverPresent: Boolean(overlay?.__sphDriver),
          particleStateSchema: scene?.getSphGpuParticleState?.()?.schema ?? null,
          statusText: document.querySelector('#sph-status')?.textContent?.slice(0, 200) ?? null,
          devicePreflightStatus: overlay?.__sphRendererWebGpuDevicePreflight?.status ?? null,
          devicePreflightReason: overlay?.__sphRendererWebGpuDevicePreflight?.reason ?? null,
          simulationAdmission: overlay?.__sphSimulationRuntimeAdmission ?? null,
          pendingPresentation: overlay?.__sphPendingPresentation?.reason ?? null,
          // How far the ulg-runtime worker rebuild actually got. progress is
          // 0.2 after cache lookup, 0.65 after createSphPhaseDemo, 1 after the
          // static-table stage, so a stuck value names the stage.
          rebuildWorker: overlay?.__sphPhaseRebuildWorker ?? null,
          cpuClosureTask: overlay?.__sphCpuClosureTask ?? null,
          workerRebuildError: overlay?.__sphPhaseRebuildWorkerError ?? null
        };
      }).catch((evaluateError) => ({ evaluateError: String(evaluateError?.message || evaluateError) }));
      const consoleTail = consoleCapture.entries.slice(-25)
        .map((entry) => `[${entry.type ?? entry.kind}] ${String(entry.text).slice(0, 300)}`);
      const pageErrorTail = consoleCapture.pageErrors.slice(-10)
        .map((entry) => `[pageerror] ${String(entry.text).slice(0, 300)}`);
      const detail = [
        'particle-state readiness wait failed',
        `state: ${JSON.stringify(readinessState)}`,
        `pageErrors(${consoleCapture.pageErrors.length}):`,
        ...pageErrorTail,
        `consoleTail(${consoleCapture.entries.length} total):`,
        ...consoleTail
      ].join('\n');
      throw new Error(`${readinessError?.message || readinessError}\n${detail}`);
    }
    preProbeSnapshots.push(await awaitBrowserProbeOperation(
      collectBrowserSnapshot(page, 'particle-state-ready'),
      fatalSignal
    ));
    const playText = await awaitBrowserProbeOperation(
      page.locator('#sph-play').textContent({ timeout: timeoutMs }).catch(() => ''),
      fatalSignal
    );
    if (/Pause/i.test(playText || '')) {
      await page.evaluate(() => document.querySelector('#sph-play')?.click());
    }
    const residentWaitMs = Math.max(1, Math.min(timeoutMs, initialResidentWaitMs));
    try {
      await awaitBrowserProbeOperation(page.waitForFunction(() => {
        const overlay = document.querySelector('#sph-phase-overlay');
        const scene = overlay?.__sphScene;
        const steps = scene?.getMlsMpmResidentSteps?.() || overlay?.__mlsMpmResidentSteps;
        return Boolean(steps?.schema || overlay?.__sphDriver);
      }, null, { timeout: residentWaitMs }), fatalSignal);
    } catch (error) {
      if (error?.browserProbeFatalTermination) throw error;
    }
    try {
      await awaitBrowserProbeOperation(page.waitForFunction(() => {
        const overlay = document.querySelector('#sph-phase-overlay');
        return !overlay?.__mlsMpmResidentStepsPending;
      }, null, { timeout: residentWaitMs }), fatalSignal);
    } catch (error) {
      if (error?.browserProbeFatalTermination) throw error;
    }
    preProbeSnapshots.push(await awaitBrowserProbeOperation(
      collectBrowserSnapshot(page, 'before-in-page-probe'),
      fatalSignal
    ));
    const nativeSurfaceCaptureUiSuppressed = Boolean(
      captureFrames
      && surfaceDrawDiagnosticMode === 'native-webgpu-surface-consumer'
    );
    if (nativeSurfaceCaptureUiSuppressed) {
      await page.addStyleTag({
        content: [
          '#sph-phase-overlay > :not(#sph-scene):not(style)',
          '#sph-phase-overlay #sph-panel',
          '#sph-phase-overlay #sph-toggle',
          '#sph-phase-overlay #sph-lighting-toggle',
          '#sph-phase-overlay #sph-pending-presentation',
          '#sph-phase-overlay #sph-warning-bar',
          '#sph-phase-overlay .sph-element-picker-overlay'
        ].join(',') + '{visibility:hidden!important;}'
      });
    }

    const inPageProbe = page.evaluate(async ({
      batches: requestedBatches,
      batchSteps: requestedBatchSteps,
      interactiveCacheLifecycle: requestedInteractiveCacheLifecycle,
      renderEvery: requestedRenderEvery,
      readbackMode: requestedReadbackMode,
      compactSummaryMode: requestedCompactSummaryMode,
      activeGridDispatchPlanRefreshMode: requestedActiveGridDispatchPlanRefreshMode,
      renderReadbackMode: requestedRenderReadbackMode,
      renderRowsReadbackMode: requestedRenderRowsReadbackMode,
      renderFieldSurfaceSummaryMode: requestedRenderFieldSurfaceSummaryMode,
      surfaceDrawDiagnosticMode: requestedSurfaceDrawDiagnosticMode,
      surfaceDrawDiagnosticMaxFieldCells: requestedSurfaceDrawDiagnosticMaxFieldCells,
      surfaceDrawDiagnosticMaxResolution: requestedSurfaceDrawDiagnosticMaxResolution,
      nativeMarchingCubesMaxVertexRowsBufferByteLength:
        requestedNativeMarchingCubesMaxVertexRowsBufferByteLength,
      nativeMarchingCubesMaxResolution: requestedNativeMarchingCubesMaxResolution,
      disablePressureInterface: requestedDisablePressureInterface,
      contactBinMetadataReadback: requestedContactBinMetadataReadback,
      reactionBinMetadataReadback: requestedReactionBinMetadataReadback,
      anomalyRowReadback: requestedAnomalyRowReadback,
      residentBufferDebug: requestedResidentBufferDebug,
      compactSummaryScope: requestedCompactSummaryScope,
	      thermalWallRate: requestedThermalWallRate,
      captureThermalCandidateCsrRouteEvidence:
        requestedCaptureThermalCandidateCsrRouteEvidence,
	      measureGpuQueueFence: requestedMeasureGpuQueueFence,
	      measureGpuTimestampInterval: requestedMeasureGpuTimestampInterval,
	      measureGpuStageTimestamps: requestedMeasureGpuStageTimestamps,
	      measureGpuStageEncoderSpans: requestedMeasureGpuStageEncoderSpans,
	      traceResidentStageWall: requestedTraceResidentStageWall,
	      collectSchroederHierarchyHostTiming:
	        requestedCollectSchroederHierarchyHostTiming,
	      materialInterfaceDiagnostic: requestedMaterialInterfaceDiagnostic,
	      materialInterfaceCandidateReadbackMode: requestedMaterialInterfaceCandidateReadbackMode,
	      nativeSurfaceDebugMode: requestedNativeSurfaceDebugMode,
	      nativeSurfaceValidationWaitMs: requestedNativeSurfaceValidationWaitMs,
	      captureFrames: requestedCaptureFrames,
      visualIntervalCaptureRequested: requestedVisualIntervalCaptureRequested,
      nativeSurfaceExtractionAtVisualIntervals:
        requestedNativeSurfaceExtractionAtVisualIntervals,
      captureFrameEvery: requestedCaptureFrameEvery,
      captureFrameMax: requestedCaptureFrameMax,
      workerLaneProgressEverySteps: requestedWorkerLaneProgressEverySteps,
      useMountedResidentSchedule: requestedUseMountedResidentSchedule,
      preProbeSnapshots: requestedPreProbeSnapshots,
      pageConsole: requestedPageConsole,
      nativeSurfaceCaptureUiSuppressed: requestedNativeSurfaceCaptureUiSuppressed,
      artifactDetailMode: requestedArtifactDetailMode,
      phaseVolumeMaxImpulseFraction:
        requestedPhaseVolumeMaxImpulseFraction,
      generatedGasTargetMaterial: requestedGeneratedGasTargetMaterial,
      generatedGasMinimumMassKg: requestedGeneratedGasMinimumMassKg,
      generatedGasMinimumMassFractionOfSystem:
        requestedGeneratedGasMinimumMassFractionOfSystem
    }) => {
      const overlay = document.querySelector('#sph-phase-overlay');
      const sceneApi = overlay?.__sphScene || null;
      const extractionPresentationCounterSourceKeys = [
        'renderFieldCpuFallbackGeometryAvailable',
        'surfaceDrawVisibleRenderSource',
        'surfaceDrawDiagnosticFallbackReason',
        'renderFieldReadback',
        'renderRowsReadback',
        'surfaceDrawReadback',
        'fullSurfaceDrawReadback',
        'renderFieldSurfaceSummaryReadback',
        'surfaceDrawSummaryReadback',
        'surfaceDrawVisibleGpuConsumerNativeReadbackFallbackValidated',
        'surfaceDrawNativeMarchingCubesExtractionStatus',
        'surfaceDrawNativeMarchingCubesExtractionErrorName',
        'surfaceDrawNativeMarchingCubesExtractionErrorStatus',
        'surfaceDrawNativeMarchingCubesExtractionErrorStage',
        'surfaceDrawNativeMarchingCubesExtractionErrorStack',
        'surfaceDrawExtensionSurfaceAdapterExecutionStatus',
        'surfaceDrawExtensionSurfaceRawExecutionStatus',
        'surfaceDrawRenderBridgeStatus',
        'surfaceDrawRenderBridgeReason',
        'surfaceDrawRenderBridgeLastRenderStatus',
        'surfaceDrawRenderBridgeLastRenderSkipReason',
        'surfaceDrawRenderBridgeDeviceLost',
        'surfaceDrawVisibleGpuConsumerStatus',
        'surfaceDrawVisibleGpuConsumerReason',
        'surfaceDrawRenderBridgeNativeSurfaceCandidateStagedPresentationStatus',
        'surfaceDrawRenderBridgeNativeSurfaceCandidateStagedPresentationReason'
      ];
      const extractionPresentationCounters = (renderState) => {
        const source = renderState && typeof renderState === 'object'
          ? renderState
          : null;
        const observedSourceKeys = source
          ? extractionPresentationCounterSourceKeys.filter(
              (key) => Object.hasOwn(source, key)
            )
          : [];
        const missingSourceKeys = extractionPresentationCounterSourceKeys
          .filter((key) => !observedSourceKeys.includes(key));
        const complete = missingSourceKeys.length === 0;
        const value = (key) => source?.[key];
        const nonEmpty = (candidate) => (
          candidate !== null
          && candidate !== undefined
          && String(candidate).length > 0
        );
        const failedStatus = (candidate) => (
          nonEmpty(candidate)
          && /(?:blocked|skipped|error|failed|unavailable|device-lost)/iu
            .test(String(candidate))
        );
        const count = (...signals) => signals.filter(Boolean).length;
        return {
          schema: 'peercompute.ulg.sph-extraction-presentation-counters.v1',
          coverage: {
            schema:
              'peercompute.ulg.sph-extraction-presentation-counter-coverage.v1',
            status: complete ? 'complete' : 'incomplete',
            complete,
            requiredSourceCount:
              extractionPresentationCounterSourceKeys.length,
            observedSourceCount: observedSourceKeys.length,
            requiredSourceKeys: [...extractionPresentationCounterSourceKeys],
            observedSourceKeys,
            missingSourceKeys
          },
          cpuSurfaceFallbackCount: complete ? count(
            value('renderFieldCpuFallbackGeometryAvailable') === true,
            /(?:cpu|fallback)/iu.test(
              String(value('surfaceDrawVisibleRenderSource') ?? '')
            )
          ) : null,
          diagnosticFallbackCount: complete ? count(
            nonEmpty(value('surfaceDrawDiagnosticFallbackReason'))
          ) : null,
          fullReadbackCount: complete ? count(
            value('renderFieldReadback') === true,
            value('renderRowsReadback') === true,
            value('surfaceDrawReadback') === true,
            value('fullSurfaceDrawReadback') === true
          ) : null,
          summaryReadbackCount: complete ? count(
            value('renderFieldSurfaceSummaryReadback') === true,
            value('surfaceDrawSummaryReadback') === true
          ) : null,
          nativeReadbackFallbackCount: complete ? count(
            value(
              'surfaceDrawVisibleGpuConsumerNativeReadbackFallbackValidated'
            ) === true
          ) : null,
          surfaceExtractionErrorCount: complete ? count(
            failedStatus(
              value('surfaceDrawNativeMarchingCubesExtractionStatus')
            ),
            nonEmpty(value('surfaceDrawNativeMarchingCubesExtractionErrorName')),
            nonEmpty(
              value('surfaceDrawNativeMarchingCubesExtractionErrorStatus')
            ),
            nonEmpty(value('surfaceDrawNativeMarchingCubesExtractionErrorStage')),
            nonEmpty(value('surfaceDrawNativeMarchingCubesExtractionErrorStack')),
            failedStatus(
              value('surfaceDrawExtensionSurfaceAdapterExecutionStatus')
            ),
            failedStatus(
              value('surfaceDrawExtensionSurfaceRawExecutionStatus')
            )
          ) : null,
          presentationErrorCount: complete ? count(
            failedStatus(value('surfaceDrawRenderBridgeStatus')),
            nonEmpty(value('surfaceDrawRenderBridgeReason')),
            failedStatus(value('surfaceDrawRenderBridgeLastRenderStatus')),
            nonEmpty(value('surfaceDrawRenderBridgeLastRenderSkipReason')),
            value('surfaceDrawRenderBridgeDeviceLost') === true,
            failedStatus(value('surfaceDrawVisibleGpuConsumerStatus')),
            nonEmpty(value('surfaceDrawVisibleGpuConsumerReason')),
            failedStatus(value(
              'surfaceDrawRenderBridgeNativeSurfaceCandidateStagedPresentationStatus'
            )),
            nonEmpty(value(
              'surfaceDrawRenderBridgeNativeSurfaceCandidateStagedPresentationReason'
            ))
          ) : null
        };
      };
      const interactivePageInstanceId = requestedInteractiveCacheLifecycle
        ? (
            globalThis.__ulgInteractiveCachePageInstanceId
            || (
              globalThis.__ulgInteractiveCachePageInstanceId =
                globalThis.crypto?.randomUUID?.()
                || `ulg-page-${performance.timeOrigin}-${Math.random()}`
            )
          )
        : null;
      let interactiveCacheResetOrdinal = null;
      let interactiveCacheMeasurementClass = null;
      let interactiveCacheLifecycleEvidence = null;
      let retainProbeMetric = (metric) => metric;
      let refreshVisualSettlementEvidence = null;
      let releaseVisualSettlementReplayState = null;
      if (requestedArtifactDetailMode === 'visual-compact') {
        const artifactCompactionModule = await import(
          '/scripts/sph-probe-artifact-compaction.mjs'
        );
        retainProbeMetric = (metric) => (
          artifactCompactionModule.compactVisualProbeMetric(metric, {
            detailMode: requestedArtifactDetailMode
          })
        );
        refreshVisualSettlementEvidence =
          artifactCompactionModule.refreshCompactedVisualSettlementEvidence;
        releaseVisualSettlementReplayState =
          artifactCompactionModule
            .releaseCompactedVisualSettlementReplayState;
        if (typeof refreshVisualSettlementEvidence !== 'function') {
          throw new Error(
            'Visual probe compaction settlement refresh export is unavailable'
          );
        }
        if (typeof releaseVisualSettlementReplayState !== 'function') {
          throw new Error(
            'Visual probe compaction settlement replay release export is unavailable'
          );
        }
      }
      let gpuTimestampMarkerModulePromise = null;
      const loadGpuTimestampMarkerEncoder = async () => {
        if (!gpuTimestampMarkerModulePromise) {
          gpuTimestampMarkerModulePromise = import(
            '/src/runtime/sph/sphGpuTimestampProfiler.js'
          ).then((module) => {
            if (typeof module?.encodeSphGpuTimestampMarkerPass !== 'function') {
              throw new Error(
                'portable GPU timestamp marker encoder export is unavailable'
              );
            }
            return module.encodeSphGpuTimestampMarkerPass;
          });
        }
        return gpuTimestampMarkerModulePromise;
      };
      const GPU_STAGE_TIMESTAMP_MIN_QUERY_CAPACITY = 2048;
      // WebGPU fixes GPUQuerySetDescriptor.count at no more than 8192.
      const GPU_STAGE_TIMESTAMP_MAX_QUERY_CAPACITY = 8192;
      // A native all-laws authoritative two-level step currently records 284
      // raw spans (568 queries); the smaller 56-57 count is only the selected
      // producer subset reported by the acceptance summary. Reserve 2048
      // queries per public step so the preflight has over 3.5x the observed
      // raw footprint. Higher fine-substep counts scale this bound explicitly.
      const GPU_STAGE_TIMESTAMP_QUERY_BUDGET_PER_STEP = 2048;
      const GPU_STAGE_TIMESTAMP_MARKER_ENCODING_MODE =
        'empty-compute-pass-timestampWrites';
      const GPU_STAGE_TIMESTAMP_ENCODER_SPAN_SEMANTICS =
        'same-command-encoder-empty-pass-boundaries-bracket-production-commands';
      const GPU_STAGE_TIMESTAMP_QUEUE_INTERVAL_SEMANTICS =
        'ordered-queue-boundary-marker-submissions-measure-elapsed-queue-interval-including-production-work-and-queue-idle-not-pure-gpu-busy';
      const gpuStageTimestampQueryCapacityPreflight = () => {
        const configuredBatchStepCount = Math.max(
          1,
          Math.round(Number(requestedBatchSteps) || 1)
        );
        const twoLevelConfigured = Boolean(
          schroederExecutionOptions?.schroederEnableTwoLevelMechanics
        );
        const fineSubstepCount = twoLevelConfigured
          ? Math.max(
              1,
              Math.round(Number(
                schroederExecutionOptions?.schroederTwoLevelFineSubstepCount
              ) || 2)
            )
          : 0;
        const generationScale = twoLevelConfigured
          ? Math.max(1, Math.ceil((fineSubstepCount + 2) / 4))
          : 1;
        const queryBudgetPerStep =
          GPU_STAGE_TIMESTAMP_QUERY_BUDGET_PER_STEP * generationScale;
        const requiredQueryCapacity =
          configuredBatchStepCount * queryBudgetPerStep;
        if (
          !Number.isSafeInteger(requiredQueryCapacity)
          || requiredQueryCapacity < 1
          || requiredQueryCapacity
            > GPU_STAGE_TIMESTAMP_MAX_QUERY_CAPACITY
        ) {
          return {
            status: 'gpu-stage-timestamp-capacity-preflight-impossible',
            ready: false,
            configuredBatchStepCount,
            twoLevelConfigured,
            fineSubstepCount,
            generationScale,
            queryBudgetPerStep,
            requiredQueryCapacity: Number.isSafeInteger(requiredQueryCapacity)
              ? requiredQueryCapacity
              : null,
            queryCapacity: 0,
            maxQueryCapacity: GPU_STAGE_TIMESTAMP_MAX_QUERY_CAPACITY
          };
        }
        let queryCapacity = GPU_STAGE_TIMESTAMP_MIN_QUERY_CAPACITY;
        while (
          queryCapacity < requiredQueryCapacity
          && queryCapacity < GPU_STAGE_TIMESTAMP_MAX_QUERY_CAPACITY
        ) {
          queryCapacity *= 2;
        }
        const ready = queryCapacity >= requiredQueryCapacity
          && queryCapacity <= GPU_STAGE_TIMESTAMP_MAX_QUERY_CAPACITY;
        return {
          status: ready
            ? 'gpu-stage-timestamp-query-capacity-ready'
            : 'gpu-stage-timestamp-capacity-preflight-impossible',
          ready,
          configuredBatchStepCount,
          twoLevelConfigured,
          fineSubstepCount,
          generationScale,
          queryBudgetPerStep,
          requiredQueryCapacity,
          queryCapacity: ready ? queryCapacity : 0,
          maxQueryCapacity: GPU_STAGE_TIMESTAMP_MAX_QUERY_CAPACITY
        };
      };
      const markProbeProgress = (status, extra = {}) => {
        if (!overlay) return;
        overlay.__sphProbeProgress = {
          schema: 'peercompute.ulg.sph-probe-progress.v0',
          status,
          updatedAtMs: performance.now(),
          ...extra
        };
        console.debug(`[sph-probe-progress] ${status}`);
      };
      markProbeProgress('in-page-probe-entered-before-helpers');
      const finiteOrNull = (value) => {
        if (value == null || value === '') return null;
        const number = Number(value);
        return Number.isFinite(number) ? number : null;
      };
      const compactPageVisibleReadbackTelemetry = (telemetry) => {
        const source = telemetry && typeof telemetry === 'object'
          ? telemetry
          : {};
        const schema = 'peercompute.ulg.gpu-readback-telemetry.v1';
        const observedCountFields = [
          'observedMapAsyncCount',
          'observedReadbackBytes',
          'observedHostQueueFenceCount'
        ];
        const classifiedCountFields = [
          'finalDiagnosticMapAsyncCount',
          'finalDiagnosticReadbackBytes',
          'deferredCleanupHostQueueFenceCount',
          'awaitedBackpressureHostQueueFenceCount'
        ];
        const unclassifiedCountFields = [
          'unclassifiedMapAsyncCount',
          'unclassifiedReadbackBytes',
          'unclassifiedHostQueueFenceCount'
        ];
        const publicAliasFields = [
          'mapAsyncCount',
          'readbackBytes',
          'hostQueueFenceCount'
        ];
        const breakdownCountFields = [
          ...observedCountFields,
          ...classifiedCountFields,
          ...unclassifiedCountFields
        ];
        const countFields = [
          ...breakdownCountFields,
          ...publicAliasFields
        ];
        const hasOwn = (value, field) => (
          Object.prototype.hasOwnProperty.call(value, field)
        );
        const exactCount = (value) => (
          typeof value === 'number'
          && Number.isSafeInteger(value)
          && value >= 0
            ? value
            : null
        );
        const requiredCounts = (value, fields) => {
          const counts = {};
          for (const field of fields) {
            if (!hasOwn(value, field)) return null;
            const count = exactCount(value[field]);
            if (count == null) return null;
            counts[field] = count;
          }
          return counts;
        };
        const classificationsConserve = (counts) => {
          const mapCount = counts.finalDiagnosticMapAsyncCount
            + counts.unclassifiedMapAsyncCount;
          const byteCount = counts.finalDiagnosticReadbackBytes
            + counts.unclassifiedReadbackBytes;
          const fenceCount = counts.deferredCleanupHostQueueFenceCount
            + counts.awaitedBackpressureHostQueueFenceCount
            + counts.unclassifiedHostQueueFenceCount;
          return Boolean(
            Number.isSafeInteger(mapCount)
            && Number.isSafeInteger(byteCount)
            && Number.isSafeInteger(fenceCount)
            && mapCount === counts.observedMapAsyncCount
            && byteCount === counts.observedReadbackBytes
            && fenceCount === counts.observedHostQueueFenceCount
          );
        };
        const aliasesMatch = (counts) => Boolean(
          counts.mapAsyncCount === counts.observedMapAsyncCount
          && counts.readbackBytes === counts.observedReadbackBytes
          && counts.hostQueueFenceCount === counts.observedHostQueueFenceCount
        );
        const expectedClaims = (counts) => ({
          normalHotLoopReadbackFree: Boolean(
            counts.observedMapAsyncCount === 0
            && counts.observedReadbackBytes === 0
            && counts.observedHostQueueFenceCount === 0
          ),
          productionHotLoopHostDependencyFree: Boolean(
            counts.unclassifiedMapAsyncCount === 0
            && counts.unclassifiedReadbackBytes === 0
            && counts.unclassifiedHostQueueFenceCount === 0
            && counts.awaitedBackpressureHostQueueFenceCount === 0
          )
        });
        const normalizedBreakdown = (counts) => {
          if (
            !hasOwn(source, 'readbackTelemetrySourceBreakdown')
            || !Array.isArray(source.readbackTelemetrySourceBreakdown)
          ) {
            return null;
          }
          const totals = Object.fromEntries(
            breakdownCountFields.map((field) => [field, 0])
          );
          const canonicalSources = new Set();
          const rows = [];
          for (const row of source.readbackTelemetrySourceBreakdown) {
            if (
              !row
              || typeof row !== 'object'
              || Array.isArray(row)
              || !hasOwn(row, 'source')
            ) {
              return null;
            }
            const rawSource = row.source;
            const canonicalSource = typeof rawSource === 'string'
              ? rawSource.trim()
              : '';
            if (!canonicalSource || canonicalSources.has(canonicalSource)) {
              return null;
            }
            canonicalSources.add(canonicalSource);
            const rowCounts = requiredCounts(row, breakdownCountFields);
            if (!rowCounts || !classificationsConserve(rowCounts)) {
              return null;
            }
            for (const field of breakdownCountFields) {
              const next = totals[field] + rowCounts[field];
              if (!Number.isSafeInteger(next)) return null;
              totals[field] = next;
            }
            rows.push({
              source: canonicalSource,
              ...rowCounts
            });
          }
          return breakdownCountFields.every(
            (field) => totals[field] === counts[field]
          )
            ? rows
            : null;
        };
        const declaredComplete =
          typeof source.readbackTelemetryComplete === 'boolean'
            ? source.readbackTelemetryComplete
            : null;
        const validation = (() => {
          if (
            declaredComplete !== true
            || Array.isArray(source)
            || !hasOwn(source, 'readbackTelemetrySchema')
            || source.readbackTelemetrySchema !== schema
            || !hasOwn(source, 'readbackTelemetryComplete')
            || !hasOwn(source, 'readbackTelemetryUnknownSources')
            || !Array.isArray(source.readbackTelemetryUnknownSources)
            || source.readbackTelemetryUnknownSources.length !== 0
          ) {
            return null;
          }
          const counts = requiredCounts(source, countFields);
          const sourceBreakdown = counts
            ? normalizedBreakdown(counts)
            : null;
          if (
            !counts
            || !classificationsConserve(counts)
            || !aliasesMatch(counts)
            || !sourceBreakdown
          ) {
            return null;
          }
          const claims = expectedClaims(counts);
          for (const [field, expected] of Object.entries(claims)) {
            if (!hasOwn(source, field)) continue;
            if (typeof source[field] !== 'boolean' || source[field] !== expected) {
              return null;
            }
          }
          return { counts, claims, sourceBreakdown };
        })();
        const complete = validation !== null;
        const counts = Object.fromEntries(
          countFields.map((field) => [
            field,
            complete ? validation.counts[field] : null
          ])
        );
        const unknownSources =
          Array.isArray(source.readbackTelemetryUnknownSources)
          && source.readbackTelemetryUnknownSources.every(
            (value) => typeof value === 'string' && value.trim()
          )
            ? [...source.readbackTelemetryUnknownSources]
            : null;
        const failClosedClaim = (field) => (
          source[field] === false ? false : null
        );
        const legacyExactZeroProductionEvidence = (() => {
          if (
            complete
            || Array.isArray(source)
            || !hasOwn(source, 'readbackTelemetrySchema')
            || source.readbackTelemetrySchema !== schema
            || !hasOwn(source, 'readbackTelemetryComplete')
            || source.readbackTelemetryComplete !== true
            || !hasOwn(source, 'readbackTelemetryUnknownSources')
            || !Array.isArray(source.readbackTelemetryUnknownSources)
            || source.readbackTelemetryUnknownSources.length !== 0
            || !hasOwn(source, 'normalHotLoopReadbackFree')
            || source.normalHotLoopReadbackFree !== true
            || hasOwn(source, 'productionHotLoopHostDependencyFree')
          ) return null;
          const observedCounts = requiredCounts(source, observedCountFields);
          if (
            !observedCounts
            || !observedCountFields.every(
              (field) => observedCounts[field] === 0
            )
            || !countFields.every(
              (field) => !hasOwn(source, field) || exactCount(source[field]) === 0
            )
          ) return null;
          if (hasOwn(source, 'readbackTelemetrySourceBreakdown')) {
            const zeroBreakdownCounts = Object.fromEntries(
              breakdownCountFields.map((field) => [field, 0])
            );
            if (normalizedBreakdown(zeroBreakdownCounts) == null) return null;
          }
          return true;
        })();
        return {
          readbackTelemetryComplete: complete
            ? true
            : (declaredComplete == null ? null : false),
          readbackTelemetryUnknownSources: unknownSources,
          ...counts,
          readbackTelemetrySourceBreakdown: complete
            ? validation.sourceBreakdown.map(
              (row) => ({ ...row })
            )
            : null,
          normalHotLoopReadbackFree: complete
            ? validation.claims.normalHotLoopReadbackFree
            : failClosedClaim('normalHotLoopReadbackFree'),
          productionHotLoopHostDependencyFree: complete
            ? validation.claims.productionHotLoopHostDependencyFree
            : failClosedClaim('productionHotLoopHostDependencyFree'),
          legacyExactZeroProductionEvidence
        };
      };
      const composePageVisibleReadbackTelemetry = (
        primaryTelemetry,
        certificationTelemetry = null
      ) => {
        const primary = compactPageVisibleReadbackTelemetry(primaryTelemetry);
        const participants = [primary];
        if (certificationTelemetry != null) {
          participants.push(
            compactPageVisibleReadbackTelemetry(certificationTelemetry)
          );
        }
        const readbackTelemetryComplete = participants.every(
          (participant) => participant.readbackTelemetryComplete === true
        )
          ? true
          : (
              participants.some(
                (participant) => (
                  participant.readbackTelemetryComplete === false
                )
              )
                ? false
                : null
            );
        const coupledClaim = (field) => {
          if (participants.some((participant) => participant[field] === false)) {
            return false;
          }
          return readbackTelemetryComplete === true
            && participants.every((participant) => participant[field] === true)
            ? true
            : null;
        };
        const countFields = [
          'observedMapAsyncCount',
          'observedReadbackBytes',
          'observedHostQueueFenceCount',
          'finalDiagnosticMapAsyncCount',
          'finalDiagnosticReadbackBytes',
          'deferredCleanupHostQueueFenceCount',
          'awaitedBackpressureHostQueueFenceCount',
          'unclassifiedMapAsyncCount',
          'unclassifiedReadbackBytes',
          'unclassifiedHostQueueFenceCount',
          'mapAsyncCount',
          'readbackBytes',
          'hostQueueFenceCount'
        ];
        return {
          ...primary,
          readbackTelemetryComplete,
          readbackTelemetryUnknownSources: readbackTelemetryComplete === true
            ? [...primary.readbackTelemetryUnknownSources]
            : null,
          ...Object.fromEntries(countFields.map((field) => [
            field,
            readbackTelemetryComplete === true ? primary[field] : null
          ])),
          readbackTelemetrySourceBreakdown: readbackTelemetryComplete === true
            ? primary.readbackTelemetrySourceBreakdown.map(
              (row) => ({ ...row })
            )
            : null,
          normalHotLoopReadbackFree: coupledClaim(
            'normalHotLoopReadbackFree'
          ),
          productionHotLoopHostDependencyFree: coupledClaim(
            'productionHotLoopHostDependencyFree'
          )
        };
      };
      const createResidentStageWallTrace = (batchIndex) => {
        const schema =
          'peercompute.ulg.sph-probe-resident-stage-wall-trace.v0';
        if (!requestedTraceResidentStageWall) {
          return {
            recorder: null,
            evidence() {
              return {
                schema,
                status: 'not-requested',
                requested: false,
                batchIndex,
                spanCount: 0,
                queryCount: 0,
                markerSubmissionCount: 0,
                mapAsyncCount: 0,
                queueFenceCount: 0,
                pointCount: 0,
                points: [],
                spans: []
              };
            }
          };
        }
        const spans = [];
        const points = [];
        const activeEncoderSpans = new Set();
        let startedOrdinal = 0;
        const recorder = {
          active: true,
          recorderKind: 'host-await-wall-span',
          encoderSpansSupported: true,
          markHostPoint(descriptor = {}) {
            points.push({
              producerId: descriptor.producerId ?? null,
              stage: descriptor.stage ?? null,
              point: descriptor.point ?? null,
              sequenceIndex: descriptor.sequenceIndex ?? null,
              generationId: descriptor.generationId ?? null,
              ordinal: points.length,
              atMs: performance.now()
            });
          },
          markQueueBoundary(descriptor = {}) {
            points.push({
              producerId: descriptor.producerId ?? null,
              stage: descriptor.stage ?? null,
              point: descriptor.point ?? 'queue-boundary',
              sequenceIndex: descriptor.sequenceIndex ?? null,
              generationId: descriptor.generationId ?? null,
              ordinal: points.length,
              atMs: performance.now()
            });
          },
          beginEncoderSpan(encoder, descriptor = {}) {
            const token = {
              encoder,
              producerId: descriptor.producerId ?? null,
              stage: descriptor.stage ?? null,
              spanClass: descriptor.spanClass ?? 'same-command-encoder',
              sequenceIndex: descriptor.sequenceIndex ?? null,
              generationId: descriptor.generationId ?? null,
              startedOrdinal,
              startedAtMs: performance.now()
            };
            startedOrdinal += 1;
            activeEncoderSpans.add(token);
            return token;
          },
          endEncoderSpan(encoder, token) {
            if (!token || token.encoder !== encoder
              || !activeEncoderSpans.delete(token)) return false;
            const completedAtMs = performance.now();
            spans.push({
              producerId: token.producerId,
              stage: token.stage,
              spanClass: `${token.spanClass}-host-encode`,
              sequenceIndex: token.sequenceIndex,
              generationId: token.generationId,
              startedOrdinal: token.startedOrdinal,
              startedAtMs: token.startedAtMs,
              completedAtMs,
              durationMs: Math.max(0, completedAtMs - token.startedAtMs),
              status: 'complete'
            });
            return true;
          },
          discardEncoderSpans(encoder) {
            for (const token of activeEncoderSpans) {
              if (token.encoder === encoder) activeEncoderSpans.delete(token);
            }
          },
          async measureQueueStage(descriptor = {}, runner) {
            const startedAtMs = performance.now();
            const span = {
              producerId: descriptor.producerId ?? null,
              stage: descriptor.stage ?? null,
              spanClass: descriptor.spanClass ?? null,
              sequenceIndex: descriptor.sequenceIndex ?? null,
              generationId: descriptor.generationId ?? null,
              startedOrdinal,
              startedAtMs,
              completedAtMs: null,
              durationMs: null,
              status: 'started'
            };
            startedOrdinal += 1;
            spans.push(span);
            try {
              const value = await runner();
              span.status = 'complete';
              return value;
            } catch (error) {
              span.status = 'failed';
              span.errorName = error?.name ?? null;
              span.errorMessage =
                error instanceof Error ? error.message : String(error);
              throw error;
            } finally {
              span.completedAtMs = performance.now();
              span.durationMs = Math.max(
                0,
                span.completedAtMs - startedAtMs
              );
            }
          }
        };
        return {
          recorder,
          evidence() {
            return {
              schema,
              status: spans.some((span) => span.status === 'failed')
                ? 'captured-with-failure'
                : 'captured',
              requested: true,
              diagnosticOnly: true,
              measurementKind: 'host-await-wall-span',
              intervalSemantics:
                'inclusive-host-wall-around-natural-stage-await-no-added-submit-query-map-or-fence',
              batchIndex,
              spanCount: spans.length,
              queryCount: 0,
              markerSubmissionCount: 0,
              mapAsyncCount: 0,
              queueFenceCount: 0,
              pointCount: points.length,
              points: points.map((point) => ({ ...point })),
              spans: spans.map((span) => ({ ...span }))
            };
          }
        };
      };
      const captureThermalCandidateCsrRouteEvidence = async (steps) => {
        const schema =
          'peercompute.ulg.sph-probe-thermal-candidate-csr-route-evidence.v1';
        const base = {
          schema,
          requested: Boolean(requestedCaptureThermalCandidateCsrRouteEvidence),
          diagnosticOnly: true,
          source: 'final-resident-thermal-proposal-control-header',
          normalHotLoopReadbackFree: true,
          readbackByteLength: 0,
          mapAsyncCount: 0
        };
        if (!requestedCaptureThermalCandidateCsrRouteEvidence) {
          return { ...base, status: 'not-requested' };
        }
        const residentStep = steps?.finalStep
          || sceneApi.getMlsMpmResidentStep?.()
          || overlay.__mlsMpmResidentStep
          || null;
        const thermalResult = residentStep?.thermalStep?.result
          || residentStep?.thermalStep
          || null;
        const candidateCsr = thermalResult?.canonicalThermalProposal?.proposal
          ?.thermalCandidateCsr
          || null;
        const routeEvidence = candidateCsr?.routeEvidence || null;
        if (!(candidateCsr?.replayBuffer && routeEvidence)) {
          return {
            ...base,
            status: 'candidate-csr-not-enabled',
            reason: 'the final resident thermal step did not publish a candidate CSR receipt'
          };
        }
        const byteLength = Math.max(0, Math.round(
          Number(routeEvidence.readbackByteLength) || 0
        ));
        if (
          !Number.isInteger(routeEvidence.controlWordCount)
          || routeEvidence.controlWordCount < 1
          || byteLength !== routeEvidence.controlWordCount * Uint32Array.BYTES_PER_ELEMENT
        ) {
          return {
            ...base,
            status: 'candidate-csr-route-evidence-invalid-metadata',
            reason: 'the runtime route-evidence descriptor did not describe a fixed u32 header'
          };
        }
        const deviceResult = await sceneApi.requestOpticalGpuDevice?.();
        const device = deviceResult?.device || null;
        if (
          !device?.createBuffer
          || !device?.createCommandEncoder
          || typeof device.queue?.submit !== 'function'
        ) {
          return {
            ...base,
            status: 'candidate-csr-route-evidence-device-unavailable',
            reason: deviceResult?.reason || 'resident GPU device was unavailable'
          };
        }
        let readbackBuffer = null;
        try {
          readbackBuffer = device.createBuffer({
            label: 'ulg-sph-probe-thermal-candidate-csr-route-readback',
            size: byteLength,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
          });
          const encoder = device.createCommandEncoder({
            label: 'ulg-sph-probe-thermal-candidate-csr-route-copy'
          });
          encoder.copyBufferToBuffer(
            candidateCsr.replayBuffer,
            0,
            readbackBuffer,
            0,
            byteLength
          );
          device.queue.submit([encoder.finish()]);
          await readbackBuffer.mapAsync(GPUMapMode.READ, 0, byteLength);
          const controlWords = Array.from(new Uint32Array(
            readbackBuffer.getMappedRange(0, byteLength).slice(0)
          ));
          const statusWord = controlWords[routeEvidence.statusWord] ?? 0;
          const routeWord = controlWords[routeEvidence.routeWord] ?? 0;
          const statusBits = routeEvidence.statusBits || {};
          const routeBits = routeEvidence.routeBits || {};
          const headerMatchesDescriptor = controlWords.length
            === routeEvidence.controlWordCount
            && controlWords[0] === routeEvidence.magic
            && controlWords[1] === routeEvidence.version
            && controlWords[2] === candidateCsr.sourceCapacity
            && controlWords[3] === candidateCsr.candidateCapacity
            && controlWords[4] === candidateCsr.rowStride;
          const sealed = headerMatchesDescriptor
            && (statusWord & statusBits.ready) !== 0
            && (statusWord & statusBits.rowsFinalized) !== 0
            && (statusWord & statusBits.validated) !== 0
            && (statusWord & (statusBits.invalid | statusBits.overflow)) === 0;
          const uniformCompletion = (routeWord & routeBits.uniformCompletion) !== 0;
          const replay = (routeWord & routeBits.replay) !== 0;
          const exactNearRewalk = (routeWord & routeBits.exactNearRewalk) !== 0;
          const routeCount = [uniformCompletion, replay, exactNearRewalk]
            .filter(Boolean).length;
          const route = routeCount !== 1
            ? (routeCount === 0 ? 'not-observed' : 'multiple-routes-observed')
            : (uniformCompletion
              ? 'uniform-completion'
              : (replay
                ? 'candidate-csr-replay'
                : 'authenticated-exact-near-rewalk'));
          return {
            ...base,
            status: headerMatchesDescriptor
              ? 'candidate-csr-route-evidence-captured'
              : 'candidate-csr-route-evidence-invalid-header',
            readbackByteLength: byteLength,
            mapAsyncCount: 1,
            controlWords,
            statusWord,
            routeWord,
            headerMatchesDescriptor,
            sealed,
            uniformCompletion,
            replay,
            exactNearRewalk,
            route,
            routeCount,
            candidateCsrEnabled: true,
            candidateCsrSourceCapacity: candidateCsr.sourceCapacity,
            candidateCsrRowStride: candidateCsr.rowStride,
            candidateCsrCapacity: candidateCsr.candidateCapacity,
            candidateCsrSchema: candidateCsr.schema ?? null
          };
        } catch (error) {
          return {
            ...base,
            status: 'candidate-csr-route-evidence-readback-failed',
            reason: error instanceof Error ? error.message : String(error),
            readbackByteLength: byteLength,
            mapAsyncCount: 1
          };
        } finally {
          try { readbackBuffer?.unmap?.(); } catch {}
          readbackBuffer?.destroy?.();
        }
      };
      const beginResidentGpuTimestampInterval = async (batchIndex) => {
        const schema = 'peercompute.ulg.sph-probe-gpu-queue-interval.v0';
        if (!requestedMeasureGpuTimestampInterval) {
          return {
            active: false,
            evidence: {
              schema,
              status: 'not-requested',
              requested: false,
              batchIndex,
              queryCount: 0,
              validQueryCount: 0,
              invalidQueryCount: 0,
              markerSubmissionCount: 0,
              queryResolveByteLength: 0,
              mappedReadbackByteLength: 0,
              mapAsyncCount: 0,
              durationNs: null,
              durationMs: null
            },
            async complete() { return this.evidence; },
            abort() {}
          };
        }
        const deviceResult = await sceneApi?.requestOpticalGpuDevice?.();
        const device = deviceResult?.device || null;
        const enabledFeatures = device?.features
          ? [...device.features].map((feature) => String(feature))
          : [];
        const requiredFeatures = [
          ...new Set([
            ...(deviceResult?.requiredFeatures || []),
            'timestamp-query'
          ].map(String))
        ];
        const base = {
          schema,
          requested: true,
          batchIndex,
          timestampUnit: 'nanoseconds',
          deviceStatus: deviceResult?.status ?? null,
          timestampProfilingRequested: true,
          timestampQuerySupported: Boolean(
            deviceResult?.timestampQuerySupported === true
            || enabledFeatures.includes('timestamp-query')
          ),
          timestampQueryStatus: deviceResult?.timestampQueryStatus ?? null,
          requiredFeatures,
          enabledFeatures,
          queryCount: 0,
          validQueryCount: 0,
          invalidQueryCount: 0,
          markerSubmissionCount: 0,
          queryResolveByteLength: 0,
          mappedReadbackByteLength: 0,
          mapAsyncCount: 0,
          durationNs: null,
          durationMs: null,
          markerEncodingMode: 'empty-compute-pass-timestampWrites',
          intervalSemantics:
            'same-queue-start-to-end-markers-includes-production-work-and-queue-idle'
        };
        const unavailable = (status, reason) => ({
          active: false,
          evidence: { ...base, status, reason },
          async complete() { return this.evidence; },
          abort() {}
        });
        if (!device) {
          return unavailable(
            'gpu-timestamp-device-unavailable',
            deviceResult?.reason || 'resident GPUDevice unavailable'
          );
        }
        if (!enabledFeatures.includes('timestamp-query')) {
          return unavailable(
            'gpu-timestamp-feature-not-enabled',
            'resident GPUDevice does not expose timestamp-query'
          );
        }
        if (
          typeof device.createQuerySet !== 'function'
          || typeof device.createBuffer !== 'function'
          || typeof device.createCommandEncoder !== 'function'
          || typeof device.queue?.submit !== 'function'
        ) {
          return unavailable(
            'gpu-timestamp-api-unavailable',
            'resident GPUDevice lacks timestamp query or queue methods'
          );
        }
        let querySet = null;
        let resolveBuffer = null;
        let readbackBuffer = null;
        let completed = false;
        let encodeTimestampMarkerPass = null;
        const destroy = () => {
          querySet?.destroy?.();
          resolveBuffer?.destroy?.();
          readbackBuffer?.destroy?.();
          querySet = null;
          resolveBuffer = null;
          readbackBuffer = null;
        };
        try {
          encodeTimestampMarkerPass = await loadGpuTimestampMarkerEncoder();
          querySet = device.createQuerySet({
            label: `ulg-sph-probe-gpu-interval-${batchIndex}`,
            type: 'timestamp',
            count: 2
          });
          resolveBuffer = device.createBuffer({
            label: `ulg-sph-probe-gpu-interval-resolve-${batchIndex}`,
            size: 16,
            usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC
          });
          readbackBuffer = device.createBuffer({
            label: `ulg-sph-probe-gpu-interval-readback-${batchIndex}`,
            size: 16,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
          });
          const startEncoder = device.createCommandEncoder({
            label: `ulg-sph-probe-gpu-interval-start-${batchIndex}`
          });
          encodeTimestampMarkerPass(startEncoder, {
            querySet,
            queryIndex: 0,
            boundary: 'start',
            label: `ulg-sph-probe-gpu-interval-start-marker-${batchIndex}`
          });
          device.queue.submit([startEncoder.finish()]);
        } catch (error) {
          destroy();
          return unavailable(
            'gpu-timestamp-start-failed',
            error instanceof Error ? error.message : String(error)
          );
        }
        return {
          active: true,
          evidence: {
            ...base,
            status: 'gpu-timestamp-start-submitted',
            queryCount: 2,
            markerSubmissionCount: 1
          },
          async complete() {
            if (completed) return this.evidence;
            completed = true;
            try {
              const endEncoder = device.createCommandEncoder({
                label: `ulg-sph-probe-gpu-interval-end-${batchIndex}`
              });
              encodeTimestampMarkerPass(endEncoder, {
                querySet,
                queryIndex: 1,
                boundary: 'end',
                label: `ulg-sph-probe-gpu-interval-end-marker-${batchIndex}`
              });
              endEncoder.resolveQuerySet(querySet, 0, 2, resolveBuffer, 0);
              endEncoder.copyBufferToBuffer(
                resolveBuffer,
                0,
                readbackBuffer,
                0,
                16
              );
              device.queue.submit([endEncoder.finish()]);
              await readbackBuffer.mapAsync(GPUMapMode.READ, 0, 16);
              const copy = readbackBuffer.getMappedRange(0, 16).slice(0);
              const timestamps = new BigUint64Array(copy);
              const monotonic = timestamps[1] > timestamps[0];
              const durationNs = monotonic
                ? Number(timestamps[1] - timestamps[0])
                : null;
              const valid = monotonic
                && Number.isFinite(durationNs)
                && durationNs > 0;
              this.evidence = {
                ...base,
                status: valid
                  ? 'gpu-timestamp-interval-complete'
                  : 'gpu-timestamp-interval-invalid',
                reason: valid
                  ? 'same-device queue markers resolved monotonically'
                  : 'timestamp values were zero, equal, or non-monotonic',
                queryCount: 2,
                validQueryCount: valid ? 2 : 0,
                invalidQueryCount: valid ? 0 : 2,
                markerSubmissionCount: 2,
                queryResolveByteLength: 16,
                mappedReadbackByteLength: 16,
                mapAsyncCount: 1,
                startTimestampNs: timestamps[0].toString(),
                endTimestampNs: timestamps[1].toString(),
                durationNs,
                durationMs: durationNs == null ? null : durationNs / 1e6
              };
              readbackBuffer.unmap?.();
            } catch (error) {
              this.evidence = {
                ...base,
                status: 'gpu-timestamp-interval-readback-failed',
                reason: error instanceof Error ? error.message : String(error),
                queryCount: 2,
                invalidQueryCount: 2,
                markerSubmissionCount: 2,
                queryResolveByteLength: 16,
                mappedReadbackByteLength: 0,
                mapAsyncCount: 1
              };
            } finally {
              destroy();
            }
            return this.evidence;
          },
          abort(reason = 'resident batch aborted before timestamp completion') {
            if (completed) return;
            completed = true;
            this.evidence = {
              ...base,
              status: 'gpu-timestamp-interval-aborted',
              reason,
              queryCount: 2,
              invalidQueryCount: 2,
              markerSubmissionCount: 1
            };
            destroy();
          }
        };
      };
      const beginResidentGpuStageTimestampRecorder = async (batchIndex) => {
        const schema = 'peercompute.ulg.sph-probe-gpu-stage-timestamps.v0';
        const inactive = (status, reason = null, extra = {}) => ({
          active: false,
          recorder: null,
          evidence: {
            schema,
            status,
            reason,
            requested: Boolean(requestedMeasureGpuStageTimestamps),
            batchIndex,
            queryCount: 0,
            spanCount: 0,
            validSpanCount: 0,
            invalidSpanCount: 0,
            markerSubmissionCount: 0,
            queryResolveByteLength: 0,
            mappedReadbackByteLength: 0,
            mapAsyncCount: 0,
            spans: [],
            ...extra
          },
          async complete() { return this.evidence; },
          abort() {}
        });
        if (!requestedMeasureGpuStageTimestamps) {
          return inactive('not-requested');
        }
        const queryCapacityPreflight =
          gpuStageTimestampQueryCapacityPreflight();
        if (!queryCapacityPreflight.ready) {
          return inactive(
            queryCapacityPreflight.status,
            `configured ${queryCapacityPreflight.configuredBatchStepCount} step batch requires ${
              queryCapacityPreflight.requiredQueryCapacity ?? 'an invalid number of'
            } timestamp queries, above the portable ${
              queryCapacityPreflight.maxQueryCapacity
            }-query-set limit`,
            {
              queryCapacityPreflightStatus:
                queryCapacityPreflight.status,
              queryCapacityExhausted: false,
              ...queryCapacityPreflight
            }
          );
        }
        const deviceResult = await sceneApi?.requestOpticalGpuDevice?.();
        const device = deviceResult?.device || null;
        const enabledFeatures = device?.features
          ? [...device.features].map((feature) => String(feature))
          : [];
        const requiredFeatures = [
          ...new Set([
            ...(deviceResult?.requiredFeatures || []),
            'timestamp-query'
          ].map(String))
        ];
        if (!device) {
          return inactive(
            'gpu-stage-timestamp-device-unavailable',
            deviceResult?.reason || 'resident GPUDevice unavailable'
          );
        }
        if (!enabledFeatures.includes('timestamp-query')) {
          return inactive(
            'gpu-stage-timestamp-feature-not-enabled',
            'resident GPUDevice does not expose timestamp-query'
          );
        }
        const queryCapacity = queryCapacityPreflight.queryCapacity;
        const byteCapacity = queryCapacity * BigUint64Array.BYTES_PER_ELEMENT;
        let querySet = null;
        let resolveBuffer = null;
        let readbackBuffer = null;
        let nextQueryIndex = 0;
        let markerSubmissionCount = 0;
        let completed = false;
        let tokenSerial = 0;
        let encodeTimestampMarkerPass = null;
        let queryCapacityExhausted = false;
        let queryCapacityExhaustedAtToken = null;
        const spans = [];
        const pendingTokens = new Set();
        const encoderSpanTokens = new WeakMap();
        const destroy = () => {
          querySet?.destroy?.();
          resolveBuffer?.destroy?.();
          readbackBuffer?.destroy?.();
          querySet = null;
          resolveBuffer = null;
          readbackBuffer = null;
        };
        try {
          encodeTimestampMarkerPass = await loadGpuTimestampMarkerEncoder();
          querySet = device.createQuerySet({
            label: `ulg-sph-probe-gpu-stage-query-set-${batchIndex}`,
            type: 'timestamp',
            count: queryCapacity
          });
          resolveBuffer = device.createBuffer({
            label: `ulg-sph-probe-gpu-stage-resolve-${batchIndex}`,
            size: byteCapacity,
            usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC
          });
          readbackBuffer = device.createBuffer({
            label: `ulg-sph-probe-gpu-stage-readback-${batchIndex}`,
            size: byteCapacity,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
          });
        } catch (error) {
          destroy();
          return inactive(
            'gpu-stage-timestamp-allocation-failed',
            error instanceof Error ? error.message : String(error)
          );
        }
        const allocateQueryPair = () => {
          if (nextQueryIndex + 2 > queryCapacity) {
            queryCapacityExhausted = true;
            queryCapacityExhaustedAtToken = tokenSerial;
            return null;
          }
          const pair = {
            startQueryIndex: nextQueryIndex,
            endQueryIndex: nextQueryIndex + 1
          };
          nextQueryIndex += 2;
          return pair;
        };
        const recorder = {
          schema,
          recorderKind: 'timestamp-query-span',
          active: true,
          encoderSpansSupported:
            requestedMeasureGpuStageEncoderSpans === true,
          capabilities: Object.freeze({
            queueStageMeasurement: true,
            queueStageSummary: false,
            encoderSpans: requestedMeasureGpuStageEncoderSpans === true,
            coarseEncoderSpans: true
          }),
          encoderSpanSelection:
            requestedMeasureGpuStageEncoderSpans === true
              ? 'all'
              : 'coarse-stage-only',
          device,
          beginEncoderSpan(encoder, descriptor = {}) {
            const tokenId = ++tokenSerial;
            const queueBoundaryMeasurement =
              descriptor?.measurementKind === 'elapsed-queue-interval'
              || descriptor?.measurementKind
                === 'ordered-queue-boundary-marker'
              || descriptor?.coarseStage === true;
            if (
              requestedMeasureGpuStageEncoderSpans !== true
              && !queueBoundaryMeasurement
            ) {
              return {
                tokenId,
                inactive: true,
                descriptor: { ...descriptor },
                startQueryIndex: null,
                endQueryIndex: null,
                beginEncoder: encoder,
                endEncoder: null,
                markerSubmissionMode: null
              };
            }
            const queryPair = allocateQueryPair();
            if (!queryPair) {
              return {
                tokenId,
                inactive: true,
                descriptor: { ...descriptor },
                startQueryIndex: null,
                endQueryIndex: null,
                beginEncoder: encoder,
                endEncoder: null,
                markerSubmissionMode: null
              };
            }
            const token = {
              tokenId,
              descriptor: {
                ...descriptor,
                measurementKind:
                  descriptor?.measurementKind
                  || 'same-command-encoder-gpu-elapsed-interval',
                intervalSemantics:
                  descriptor?.intervalSemantics
                  || GPU_STAGE_TIMESTAMP_ENCODER_SPAN_SEMANTICS
              },
              ...queryPair,
              beginEncoder: encoder,
              endEncoder: null,
              markerSubmissionMode: 'same-production-command-encoder'
            };
            encodeTimestampMarkerPass(encoder, {
              querySet,
              queryIndex: token.startQueryIndex,
              boundary: 'start',
              label:
                `ulg-sph-probe-stage-span-start-${batchIndex}-${token.tokenId}`
            });
            spans.push(token);
            pendingTokens.add(token);
            const encoderTokens = encoderSpanTokens.get(encoder) || [];
            encoderTokens.push(token);
            encoderSpanTokens.set(encoder, encoderTokens);
            return token;
          },
          endEncoderSpan(encoder, token) {
            if (token?.inactive === true) return false;
            if (!pendingTokens.has(token) || token.endEncoder !== null) {
              throw new Error('GPU stage timestamp token was missing or replayed');
            }
            encodeTimestampMarkerPass(encoder, {
              querySet,
              queryIndex: token.endQueryIndex,
              boundary: 'end',
              label:
                `ulg-sph-probe-stage-span-end-${batchIndex}-${token.tokenId}`
            });
            token.endEncoder = encoder;
            pendingTokens.delete(token);
            return true;
          },
          discardEncoderSpans(encoder) {
            const encoderTokens = encoderSpanTokens.get(encoder);
            if (!encoderTokens?.length) return 0;
            const spanSuffixOffset = spans.length - encoderTokens.length;
            if (
              spanSuffixOffset < 0
              || encoderTokens.some((token, index) => (
                spans[spanSuffixOffset + index] !== token
              ))
            ) {
              throw new Error(
                'Discarded GPU timestamp encoder spans were not the recorded suffix'
              );
            }
            if (encoderTokens.some((token) => (
              token.beginEncoder !== encoder
              || (token.endEncoder !== null && token.endEncoder !== encoder)
            ))) {
              throw new Error(
                'Discarded GPU timestamp encoder contained a cross-encoder span'
              );
            }
            const queryIndices = encoderTokens.flatMap((token) => [
              token.startQueryIndex,
              ...(token.endQueryIndex === null ? [] : [token.endQueryIndex])
            ]).sort((a, b) => a - b);
            const rollbackStart = queryIndices[0];
            if (
              !Number.isInteger(rollbackStart)
              || queryIndices.length !== nextQueryIndex - rollbackStart
              || queryIndices.some((queryIndex, index) => (
                queryIndex !== rollbackStart + index
              ))
            ) {
              throw new Error(
                'Discarded GPU timestamp encoder queries were not the allocation suffix'
              );
            }
            for (const token of encoderTokens) {
              pendingTokens.delete(token);
            }
            spans.splice(spanSuffixOffset, encoderTokens.length);
            nextQueryIndex = rollbackStart;
            encoderSpanTokens.delete(encoder);
            return encoderTokens.length;
          },
          markQueueBoundary(descriptor = {}) {
            const stageSelector = String(
              globalThis.__ulgGpuQueueBoundaryStageSelector
              || 'generation-pre-submit-boundary'
            );
            const descriptorStage = String(descriptor?.stage || '');
            const descriptorSelector = descriptor?.selectedLevel == null
              ? descriptorStage
              : `${descriptorStage}:${descriptor.selectedLevel}`;
            if (
              stageSelector !== descriptorStage
              && stageSelector !== descriptorSelector
            ) {
              return null;
            }
            const boundaryEncoder = device.createCommandEncoder({
              label:
                `ulg-sph-probe-queue-boundary-${batchIndex}-${tokenSerial + 1}`
            });
            const token = this.beginEncoderSpan(boundaryEncoder, {
              ...descriptor,
              spanClass: descriptor?.spanClass || 'queue-boundary-marker',
              measurementKind: 'ordered-queue-boundary-marker',
              intervalSemantics:
                'standalone diagnostic marker submitted after preceding queue operations and before the following production submission'
            });
            if (token.inactive === true) return token;
            token.markerSubmissionMode =
              'standalone-diagnostic-queue-boundary-submission';
            this.endEncoderSpan(boundaryEncoder, token);
            device.queue.submit([boundaryEncoder.finish()]);
            markerSubmissionCount += 1;
            return token;
          },
          async measureQueueStage(descriptor, runner) {
            if (typeof runner !== 'function') {
              throw new TypeError('GPU queue stage profiler requires a runner');
            }
            const startEncoder = device.createCommandEncoder({
              label: `ulg-sph-probe-stage-start-${batchIndex}-${tokenSerial + 1}`
            });
            const token = this.beginEncoderSpan(startEncoder, {
              ...descriptor,
              spanClass: descriptor?.spanClass || 'queue-stage',
              measurementKind: 'elapsed-queue-interval',
              intervalSemantics:
                GPU_STAGE_TIMESTAMP_QUEUE_INTERVAL_SEMANTICS
            });
            if (token.inactive === true) {
              return runner();
            }
            token.markerSubmissionMode = 'same-queue-boundary-submissions';
            device.queue.submit([startEncoder.finish()]);
            markerSubmissionCount += 1;
            try {
              return await runner();
            } finally {
              const endEncoder = device.createCommandEncoder({
                label: `ulg-sph-probe-stage-end-${batchIndex}-${token.tokenId}`
              });
              this.endEncoderSpan(endEncoder, token);
              device.queue.submit([endEncoder.finish()]);
              markerSubmissionCount += 1;
            }
          }
        };
        const gpuQueueWriteBoundaryHook = ({
          queue,
          bufferLabel,
          bufferOffset,
          byteLength
        } = {}) => {
          if (queue !== device.queue) return null;
          return recorder.markQueueBoundary({
            producerId:
              'sph-probe-selected-queue-write-boundary',
            stage: 'after-selected-queue-write',
            bufferLabel,
            bufferOffset,
            byteLength
          });
        };
        globalThis.__ulgGpuQueueWriteBoundaryHook =
          gpuQueueWriteBoundaryHook;
        const clearGpuQueueWriteBoundaryHook = () => {
          if (
            globalThis.__ulgGpuQueueWriteBoundaryHook
              === gpuQueueWriteBoundaryHook
          ) {
            globalThis.__ulgGpuQueueWriteBoundaryHook = null;
          }
        };
        const evidenceBase = {
          schema,
          requested: true,
          batchIndex,
          timestampUnit: 'nanoseconds',
          deviceStatus: deviceResult?.status ?? null,
          timestampProfilingRequested: true,
          timestampQuerySupported: Boolean(
            deviceResult?.timestampQuerySupported === true
            || enabledFeatures.includes('timestamp-query')
          ),
          requiredFeatures,
          enabledFeatures,
          queryCapacity,
          requiredQueryCapacity:
            queryCapacityPreflight.requiredQueryCapacity,
          queryBudgetPerStep: queryCapacityPreflight.queryBudgetPerStep,
          configuredBatchStepCount:
            queryCapacityPreflight.configuredBatchStepCount,
          twoLevelConfigured: queryCapacityPreflight.twoLevelConfigured,
          configuredFineSubstepCount:
            queryCapacityPreflight.fineSubstepCount,
          queryCapacityPreflightStatus:
            queryCapacityPreflight.status,
          queryCapacityExhausted: false,
          maxQueryCapacity: queryCapacityPreflight.maxQueryCapacity,
          recorderKind: 'timestamp-query-span',
          capabilities: {
            queueStageMeasurement: true,
            queueStageSummary: false,
            encoderSpans: requestedMeasureGpuStageEncoderSpans === true,
            coarseEncoderSpans: true
          },
          encoderSpanSelection:
            requestedMeasureGpuStageEncoderSpans === true
              ? 'all'
              : 'coarse-stage-only',
          markerEncodingMode:
            GPU_STAGE_TIMESTAMP_MARKER_ENCODING_MODE,
          encoderSpanSemantics:
            GPU_STAGE_TIMESTAMP_ENCODER_SPAN_SEMANTICS,
          queueIntervalSemantics:
            GPU_STAGE_TIMESTAMP_QUEUE_INTERVAL_SEMANTICS,
          productionPassGroupingPreserved: true,
          resolveSubmissionCount: 1,
          mapAsyncCount: 1
        };
        return {
          active: true,
          recorder,
          evidence: {
            ...evidenceBase,
            status: 'gpu-stage-timestamp-recorder-active',
            queryCount: 0,
            spanCount: 0,
            validSpanCount: 0,
            invalidSpanCount: 0,
            markerSubmissionCount: 0,
            queryResolveByteLength: 0,
            mappedReadbackByteLength: 0,
            spans: []
          },
          async complete() {
            if (completed) return this.evidence;
            completed = true;
            clearGpuQueueWriteBoundaryHook();
            if (queryCapacityExhausted) {
              this.evidence = {
                ...evidenceBase,
                status:
                  'gpu-stage-timestamp-capacity-exhausted-unexpectedly',
                reason:
                  `stage instrumentation exceeded the preflight ${queryCapacity}-query budget`,
                queryCapacityExhausted: true,
                queryCapacityExhaustedAtToken,
                queryCount: nextQueryIndex,
                spanCount: spans.length,
                validSpanCount: 0,
                invalidSpanCount: spans.length,
                markerSubmissionCount,
                resolveSubmissionCount: 0,
                mapAsyncCount: 0,
                queryResolveByteLength: 0,
                mappedReadbackByteLength: 0,
                spans: []
              };
              destroy();
              return this.evidence;
            }
            try {
              if (nextQueryIndex === 0 || pendingTokens.size !== 0) {
                throw new Error(
                  pendingTokens.size !== 0
                    ? `${pendingTokens.size} GPU stage timestamp spans were left open`
                    : 'no GPU stage timestamp spans were recorded'
                );
              }
              const byteLength = nextQueryIndex
                * BigUint64Array.BYTES_PER_ELEMENT;
              const encoder = device.createCommandEncoder({
                label: `ulg-sph-probe-gpu-stage-resolve-${batchIndex}`
              });
              encoder.resolveQuerySet(
                querySet,
                0,
                nextQueryIndex,
                resolveBuffer,
                0
              );
              encoder.copyBufferToBuffer(
                resolveBuffer,
                0,
                readbackBuffer,
                0,
                byteLength
              );
              device.queue.submit([encoder.finish()]);
              await readbackBuffer.mapAsync(
                GPUMapMode.READ,
                0,
                byteLength
              );
              const copy = readbackBuffer
                .getMappedRange(0, byteLength)
                .slice(0);
              const timestamps = new BigUint64Array(copy);
              const resolvedSpans = spans.map((span) => {
                const start = timestamps[span.startQueryIndex];
                const end = timestamps[span.endQueryIndex];
                const monotonic = end > start;
                const difference = monotonic ? end - start : 0n;
                const durationNs = monotonic
                  && difference <= BigInt(Number.MAX_SAFE_INTEGER)
                  ? Number(difference)
                  : null;
                const valid = Number.isSafeInteger(durationNs)
                  && durationNs > 0;
                return {
                  schema: 'peercompute.ulg.sph-probe-gpu-stage-span.v0',
                  tokenId: span.tokenId,
                  ...span.descriptor,
                  markerSubmissionMode: span.markerSubmissionMode,
                  startQueryIndex: span.startQueryIndex,
                  endQueryIndex: span.endQueryIndex,
                  startTimestampNs: start.toString(),
                  endTimestampNs: end.toString(),
                  durationNs,
                  durationMs: durationNs == null ? null : durationNs / 1e6,
                  valid
                };
              });
              const validSpanCount = resolvedSpans.filter(
                (span) => span.valid
              ).length;
              this.evidence = {
                ...evidenceBase,
                status: validSpanCount === resolvedSpans.length
                  ? 'gpu-stage-timestamps-complete'
                  : 'gpu-stage-timestamps-invalid',
                queryCount: nextQueryIndex,
                spanCount: resolvedSpans.length,
                validSpanCount,
                invalidSpanCount: resolvedSpans.length - validSpanCount,
                markerSubmissionCount,
                queryResolveByteLength: byteLength,
                mappedReadbackByteLength: byteLength,
                spans: resolvedSpans
              };
              readbackBuffer.unmap?.();
            } catch (error) {
              this.evidence = {
                ...evidenceBase,
                status: 'gpu-stage-timestamp-readback-failed',
                reason: error instanceof Error ? error.message : String(error),
                queryCapacityExhausted,
                queryCapacityExhaustedAtToken,
                queryCount: nextQueryIndex,
                spanCount: spans.length,
                validSpanCount: 0,
                invalidSpanCount: spans.length,
                markerSubmissionCount,
                queryResolveByteLength: 0,
                mappedReadbackByteLength: 0,
                spans: []
              };
            } finally {
              destroy();
            }
            return this.evidence;
          },
          abort(reason = 'resident batch aborted before stage timestamp completion') {
            if (completed) return;
            completed = true;
            clearGpuQueueWriteBoundaryHook();
            this.evidence = {
              ...evidenceBase,
              status: 'gpu-stage-timestamps-aborted',
              reason,
              queryCapacityExhausted,
              queryCapacityExhaustedAtToken,
              queryCount: nextQueryIndex,
              spanCount: spans.length,
              validSpanCount: 0,
              invalidSpanCount: spans.length,
              markerSubmissionCount,
              queryResolveByteLength: 0,
              mappedReadbackByteLength: 0,
              spans: []
            };
            destroy();
          }
        };
      };
      const cloneFiniteVector = (value) => {
        if (!Array.isArray(value) || value.length < 3) return null;
        const vector = value.slice(0, 3).map((entry) => Number(entry));
        return vector.every(Number.isFinite) ? vector : null;
      };
      const compactPositionBounds = (bounds) => bounds ? {
        status: bounds.status ?? null,
        count: bounds.count ?? null,
        min: cloneFiniteVector(bounds.min),
        max: cloneFiniteVector(bounds.max),
        size: cloneFiniteVector(bounds.size)
      } : null;
      const compactDispatchStageTopology = (stage) => stage ? {
        stageId: stage.stageId ?? null,
        topology: stage.topology ?? null,
        entryPoint: stage.entryPoint ?? null,
        dispatchAxis: stage.dispatchAxis ?? null,
        dispatchWorkgroupsPerSubstep: stage.dispatchWorkgroupsPerSubstep ?? null,
        invocationLimitPerSubstep: stage.invocationLimitPerSubstep ?? null,
        workgroupSize: stage.workgroupSize ?? null,
        particleLoopInShader: stage.particleLoopInShader ?? null,
        perParticleLocalStencilNodeCount: stage.perParticleLocalStencilNodeCount ?? null,
        gridWriteMode: stage.gridWriteMode ?? null,
        gridReadMode: stage.gridReadMode ?? null,
        activeGridEnabled: stage.activeGridEnabled ?? null,
        bufferClearMode: stage.bufferClearMode ?? null,
        dispatchSubmissionMode: stage.dispatchSubmissionMode ?? null,
        indirectDispatchReady: stage.indirectDispatchReady ?? null,
        indirectDispatchUsed: stage.indirectDispatchUsed ?? null,
        indirectDispatchArgsBufferByteLength: stage.indirectDispatchArgsBufferByteLength ?? null,
        indirectDispatchWorkgroupCountX: stage.indirectDispatchWorkgroupCountX ?? null
      } : null;
      const compactDispatchTopology = (topology) => topology ? {
        schema: topology.schema ?? null,
        status: topology.status ?? null,
        backend: topology.backend ?? null,
        substepCount: topology.substepCount ?? null,
        particleCount: topology.particleCount ?? null,
        fullGridNodeCount: topology.fullGridNodeCount ?? null,
        activeGridNodeCount: topology.activeGridNodeCount ?? null,
        activeGridEnabled: topology.activeGridEnabled ?? null,
        cpuParticleLoopInHotPath: topology.cpuParticleLoopInHotPath ?? null,
        particleParallelStages: Array.isArray(topology.particleParallelStages) ? [...topology.particleParallelStages] : [],
        gridParallelStages: Array.isArray(topology.gridParallelStages) ? [...topology.gridParallelStages] : [],
        dispatchesPerSubstep: topology.dispatchesPerSubstep ?? null,
        totalDispatches: topology.totalDispatches ?? null,
        workgroupsPerSubstep: topology.workgroupsPerSubstep ?? null,
        totalWorkgroups: topology.totalWorkgroups ?? null,
        activeGridIndirectDispatch: topology.activeGridIndirectDispatch
          ? { ...topology.activeGridIndirectDispatch }
          : null,
        p2g: compactDispatchStageTopology(topology.p2g),
        p2gAccumulatorClear: compactDispatchStageTopology(topology.p2gAccumulatorClear),
        p2gFinalize: compactDispatchStageTopology(topology.p2gFinalize),
        gridUpdate: compactDispatchStageTopology(topology.gridUpdate),
        g2p: compactDispatchStageTopology(topology.g2p)
      } : null;
      const compactDiagnostics = (diagnostics) => diagnostics ? {
        particleCount: diagnostics.particleCount ?? null,
        gridNodeCount: diagnostics.gridNodeCount ?? null,
        dispatchTopologyStatus: diagnostics.dispatchTopologyStatus ?? null,
        dispatchTopologySchema: diagnostics.dispatchTopologySchema ?? null,
        dispatchTopology: compactDispatchTopology(diagnostics.dispatchTopology),
        cpuParticleLoopInHotPath: diagnostics.cpuParticleLoopInHotPath ?? null,
        particleParallelStages: Array.isArray(diagnostics.particleParallelStages) ? [...diagnostics.particleParallelStages] : [],
        gridParallelStages: Array.isArray(diagnostics.gridParallelStages) ? [...diagnostics.gridParallelStages] : [],
        dispatchesPerSubstep: diagnostics.dispatchesPerSubstep ?? null,
        totalDispatches: diagnostics.totalDispatches ?? null,
        p2gDispatchTopology: compactDispatchStageTopology(diagnostics.p2gDispatchTopology),
        p2gFinalizeDispatchTopology: compactDispatchStageTopology(diagnostics.p2gFinalizeDispatchTopology),
        gridUpdateDispatchTopology: compactDispatchStageTopology(diagnostics.gridUpdateDispatchTopology),
        g2pDispatchTopology: compactDispatchStageTopology(diagnostics.g2pDispatchTopology),
        activeGridNodeCount: diagnostics.activeGridNodeCount ?? null,
        activeGridNodeCountAvailable: diagnostics.activeGridNodeCountAvailable ?? null,
        activeGridNodeSummaryStatus: diagnostics.activeGridNodeSummaryStatus ?? null,
        gridNodeScanCount: diagnostics.gridNodeScanCount ?? null,
        gridNodeScanSkipped: diagnostics.gridNodeScanSkipped ?? null,
        activeGridDispatchPlanStatus: diagnostics.activeGridDispatchPlanStatus ?? null,
        activeGridDispatchPlanSource: diagnostics.activeGridDispatchPlanSource ?? null,
        activeGridDispatchPlanDispatchArgsBufferRetained: diagnostics.activeGridDispatchPlanDispatchArgsBufferRetained ?? null,
        activeGridDispatchPlanDispatchArgsBufferByteLength: diagnostics.activeGridDispatchPlanDispatchArgsBufferByteLength ?? null,
        activeGridDispatchPlanMetadataBufferRetained: diagnostics.activeGridDispatchPlanMetadataBufferRetained ?? null,
        activeGridDispatchPlanMetadataBufferByteLength: diagnostics.activeGridDispatchPlanMetadataBufferByteLength ?? null,
        massDeltaKg: finiteOrNull(diagnostics.massDeltaKg),
        maxSpeedMPerS: finiteOrNull(diagnostics.maxSpeedMPerS),
        maxDisplacementM: finiteOrNull(diagnostics.maxDisplacementM),
        particleScaleStabilitySchema: diagnostics.particleScaleStabilitySchema ?? null,
        particleScaleStabilityStatus: diagnostics.particleScaleStabilityStatus ?? null,
        particleScalePolicySource: diagnostics.particleScalePolicySource ?? null,
        particleScalePolicyAppliedInG2p: diagnostics.particleScalePolicyAppliedInG2p ?? null,
        particleScalePolicyAppliedInShader: diagnostics.particleScalePolicyAppliedInShader ?? null,
        particleScaleMaxRadiusGrowthRatioAllowed: finiteOrNull(diagnostics.particleScaleMaxRadiusGrowthRatioAllowed),
        particleScaleMaxVolumeRatioJAllowed: finiteOrNull(diagnostics.particleScaleMaxVolumeRatioJAllowed),
        particleScaleCapCountKnown: diagnostics.particleScaleCapCountKnown ?? null,
        particleScaleCapCount: diagnostics.particleScaleCapCount ?? null,
        particleScaleInvalidCountKnown: diagnostics.particleScaleInvalidCountKnown ?? null,
        particleScaleInvalidCount: diagnostics.particleScaleInvalidCount ?? null,
        particleScaleMaxRawVolumeRatioJ: finiteOrNull(diagnostics.particleScaleMaxRawVolumeRatioJ),
        particleScaleMaxEffectiveVolumeRatioJ: finiteOrNull(diagnostics.particleScaleMaxEffectiveVolumeRatioJ),
        particleScaleMinEffectiveVolumeRatioJ: finiteOrNull(diagnostics.particleScaleMinEffectiveVolumeRatioJ),
        sourceCenterOfMassM: Array.isArray(diagnostics.sourceCenterOfMassM) ? [...diagnostics.sourceCenterOfMassM] : null,
        nextCenterOfMassM: Array.isArray(diagnostics.nextCenterOfMassM) ? [...diagnostics.nextCenterOfMassM] : null,
        centerOfMassDeltaM: Array.isArray(diagnostics.centerOfMassDeltaM) ? [...diagnostics.centerOfMassDeltaM] : null,
        sourcePositionBoundsM: diagnostics.sourcePositionBoundsM ? { ...diagnostics.sourcePositionBoundsM } : null,
        nextPositionBoundsM: diagnostics.nextPositionBoundsM ? { ...diagnostics.nextPositionBoundsM } : null,
        cohortDiagnostics: diagnostics.cohortDiagnostics || null,
        cohortSummaryAvailable: diagnostics.cohortSummaryAvailable ?? null,
            minVolumeRatioJ: finiteOrNull(diagnostics.minVolumeRatioJ),
            maxVolumeRatioJ: finiteOrNull(diagnostics.maxVolumeRatioJ),
            phaseMassKg: diagnostics.phaseMassKg ? { ...diagnostics.phaseMassKg } : null,
            phaseMassTotalKg: finiteOrNull(diagnostics.phaseMassTotalKg),
            temperatureMassWeightedMeanK: finiteOrNull(diagnostics.temperatureMassWeightedMeanK),
            minTemperatureK: finiteOrNull(diagnostics.minTemperatureK),
            maxTemperatureK: finiteOrNull(diagnostics.maxTemperatureK),
            thermalReadyCount: diagnostics.thermalReadyCount ?? null,
            thermalProblemCount: diagnostics.thermalProblemCount ?? null,
            thermalPhaseSummaryAvailable: diagnostics.thermalPhaseSummaryAvailable ?? null,
            compactGpuSummaryAvailable: diagnostics.compactGpuSummaryAvailable ?? null,
            compactGpuSummaryStatus: diagnostics.compactGpuSummaryStatus ?? null,
            compactGpuSummaryReadbackMode: diagnostics.compactGpuSummaryReadbackMode ?? null,
            compactSummaryScope: diagnostics.compactSummaryScope ?? null,
            compactReadbackByteLength: diagnostics.compactReadbackByteLength ?? null,
            compactSummaryMapAsyncWaitMs: finiteOrNull(diagnostics.compactSummaryMapAsyncWaitMs),
            compactSummaryQueueFenceAttribution: diagnostics.compactSummaryQueueFenceAttribution ?? null,
            activeGridDispatchPlanStatus: diagnostics.activeGridDispatchPlanStatus ?? null,
            activeGridDispatchPlanSource: diagnostics.activeGridDispatchPlanSource ?? null,
            activeGridDispatchPlanDispatchArgsBufferRetained: diagnostics.activeGridDispatchPlanDispatchArgsBufferRetained ?? null,
            activeGridDispatchPlanDispatchArgsBufferByteLength: diagnostics.activeGridDispatchPlanDispatchArgsBufferByteLength ?? null,
            activeGridDispatchPlanMetadataBufferRetained: diagnostics.activeGridDispatchPlanMetadataBufferRetained ?? null,
            activeGridDispatchPlanMetadataBufferByteLength: diagnostics.activeGridDispatchPlanMetadataBufferByteLength ?? null,
        readbackMode: diagnostics.readbackMode ?? null,
        internalPressureScale: finiteOrNull(diagnostics.internalPressureScale),
        pressureInterfaceForceRowCount: diagnostics.pressureInterfaceForceRowCount ?? null,
        pressureInterfaceForceConsumerStatus: diagnostics.pressureInterfaceForceConsumerStatus ?? null,
        pressureInterfaceAppliedImpulseMagnitudeNSeconds: finiteOrNull(diagnostics.pressureInterfaceAppliedImpulseMagnitudeNSeconds),
        pressureInterfaceContactBinGridStatus: diagnostics.pressureInterfaceContactBinGridStatus ?? null,
        pressureInterfaceContactBinGridEnabled: diagnostics.pressureInterfaceContactBinGridEnabled ?? null,
        pressureInterfaceContactBinGridCellCount: diagnostics.pressureInterfaceContactBinGridCellCount ?? null,
        pressureInterfaceContactBinGridBinCapacity: diagnostics.pressureInterfaceContactBinGridBinCapacity ?? null,
        pressureInterfaceContactBinGridAverageOccupancy: finiteOrNull(diagnostics.pressureInterfaceContactBinGridAverageOccupancy),
        pressureInterfaceContactBinGridEstimatedOverflowRisk: diagnostics.pressureInterfaceContactBinGridEstimatedOverflowRisk ?? null,
        pressureInterfaceContactBinGridIndexBufferByteLength: diagnostics.pressureInterfaceContactBinGridIndexBufferByteLength ?? null,
        pressureInterfaceContactBinOverflowStatus: diagnostics.pressureInterfaceContactBinOverflowStatus ?? null,
        pressureInterfaceContactBinOverflowCount: diagnostics.pressureInterfaceContactBinOverflowCount ?? null,
        residentAuthorityLedgerStatus: diagnostics.residentAuthorityLedgerStatus ?? null,
        residentAuthorityParticleOwner: diagnostics.residentAuthorityParticleOwner ?? null,
        residentAuthorityMechanicsOwner: diagnostics.residentAuthorityMechanicsOwner ?? null,
        residentAuthorityThermoOwner: diagnostics.residentAuthorityThermoOwner ?? null,
        reactionEvidence: {
          summaryAvailable: diagnostics.reactionSummaryAvailable ?? null,
          summaryStatus: diagnostics.reactionSummaryStatus ?? null,
          canonicalEventCount: diagnostics.reactionCanonicalEventCount ?? null,
          placedReactionEventCount:
            diagnostics.reactionPlacedEventCount ?? null,
          changedMaterialCount: diagnostics.reactionChangedMaterialCount ?? null,
          changedMassCount: diagnostics.reactionChangedMassCount ?? null,
          visibleProductMassKg: finiteOrNull(diagnostics.reactionVisibleProductMassKg),
          visibleGasProductMassKg: finiteOrNull(diagnostics.reactionVisibleGasProductMassKg),
          consumedReactantMassKg: finiteOrNull(diagnostics.reactionConsumedReactantMassKg),
          expectedProductMassKg: finiteOrNull(diagnostics.reactionExpectedProductMassKg),
          heatJ: finiteOrNull(diagnostics.reactionHeatJ),
          productEventRowCount: diagnostics.reactionProductEventRowCount ?? null,
          productEventActiveEventCount: diagnostics.reactionProductEventActiveEventCount ?? null,
          productEventBufferRetained: diagnostics.reactionProductEventBufferRetained ?? null,
          productPlacementProvenanceStatus:
            diagnostics.reactionProductPlacementProvenanceStatus ?? null,
          productPlacementProvenanceReadbackByteLength:
            diagnostics.reactionProductPlacementProvenanceReadbackByteLength ?? null,
          productPlacementAccumulatorByteLength:
            diagnostics.reactionProductPlacementAccumulatorByteLength ?? null,
          productPlacementReadbackCadence:
            diagnostics.reactionProductPlacementReadbackCadence ?? null,
          productPlacementMechanicsRefreshStatus:
            diagnostics.reactionProductPlacementMechanicsRefreshStatus ?? null,
          productPlacementMechanicsRefreshCarried:
            diagnostics.reactionProductPlacementMechanicsRefreshCarried ?? null,
          productPlacementProvenance:
            diagnostics.reactionProductPlacementProvenance ?? null,
          residentProductMassStatus: diagnostics.reactionResidentProductMassStatus ?? null,
          residentProductMassBufferRetained:
            diagnostics.reactionResidentProductMassBufferRetained ?? null,
          residentProductMassUnplacedProductMassKg:
            finiteOrNull(diagnostics.reactionResidentProductMassUnplacedProductMassKg),
          residentProductMassUnplacedGasProductMassKg:
            finiteOrNull(diagnostics.reactionResidentProductMassUnplacedGasProductMassKg),
          productInventory: diagnostics.reactionProductInventory || null,
          gasSpeciesLedger: diagnostics.reactionGasSpeciesLedger || null
        }
      } : null;
      const compactSidecarFusionPlan = (plan) => plan ? {
        schema: plan.schema ?? null,
        status: plan.status ?? null,
        requested: plan.requested ?? null,
        required: plan.required ?? null,
        sidecarFusionRunnable: plan.sidecarFusionRunnable ?? null,
        sidecarBlockers: [...(plan.sidecarBlockers || [])],
        blockers: [...(plan.blockers || [])],
        sidecarCount: plan.sidecarCount ?? null,
        stageCount: plan.stageCount ?? null,
        requiredStageOrder: [...(plan.requiredStageOrder || [])],
        stages: Array.isArray(plan.stages)
          ? plan.stages.map((stage) => ({
              id: stage.id ?? null,
              blocker: stage.blocker ?? null,
              lawNodeId: stage.lawNodeId ?? null,
              orderConstraint: stage.orderConstraint ?? null,
              reads: [...(stage.reads || [])],
              writes: [...(stage.writes || [])],
              implementedInCurrentFusedSequence: stage.implementedInCurrentFusedSequence ?? null,
              fusionRequirement: stage.fusionRequirement ?? null
            }))
          : []
      } : null;
      const compactSidecarFusionStepEvidence = (evidence) => evidence ? {
        schema: evidence.schema ?? null,
        status: evidence.status ?? null,
        sidecarFusionPlanStatus: evidence.sidecarFusionPlanStatus ?? null,
        sidecarFusionRequired: evidence.sidecarFusionRequired ?? null,
        sidecarFusionRunnable: evidence.sidecarFusionRunnable ?? null,
        sidecarBlockers: [...(evidence.sidecarBlockers || [])],
        requiredStageOrder: [...(evidence.requiredStageOrder || [])],
        stageCount: evidence.stageCount ?? null,
        executedStageCount: evidence.executedStageCount ?? null,
        passedStageCount: evidence.passedStageCount ?? null,
        allRequiredStagesPassed: evidence.allRequiredStagesPassed ?? null,
        promotesFusedSequence: evidence.promotesFusedSequence ?? null,
        fallbackEvidence: evidence.fallbackEvidence ?? null,
        stages: Array.isArray(evidence.stages)
          ? evidence.stages.map((stage) => ({
              id: stage.id ?? null,
              status: stage.status ?? null,
              sourceStatus: stage.sourceStatus ?? null,
              backend: stage.backend ?? null,
              executed: stage.executed ?? null,
              retainedOutputSatisfied: stage.retainedOutputSatisfied ?? null,
              orderSatisfied: stage.orderSatisfied ?? null,
              passed: stage.passed ?? null
            }))
          : []
      } : null;
      const compactThermalSidecarDirectRunnerContract = (contract) => contract ? {
        schema: contract.schema ?? null,
        status: contract.status ?? null,
        mode: contract.mode ?? null,
        requiredRoute: contract.requiredRoute ?? null,
        sidecarAwareSequenceCandidate: contract.sidecarAwareSequenceCandidate ?? null,
        directRunnerEligible: contract.directRunnerEligible ?? null,
        directRunnerRunnable: contract.directRunnerRunnable ?? null,
        directRunnerSelected: contract.directRunnerSelected ?? null,
        directRunnerSelectionStatus: contract.directRunnerSelectionStatus ?? null,
        directRunnerSelectionBlockers: [...(contract.directRunnerSelectionBlockers || [])],
        blockers: [...(contract.blockers || [])],
        sidecarBlockers: [...(contract.sidecarBlockers || [])],
        requiredRunnerStages: [...(contract.requiredRunnerStages || [])],
        requiredRetainedBuffers: [...(contract.requiredRetainedBuffers || [])],
        unsupportedSidecars: [...(contract.unsupportedSidecars || [])],
        currentRoute: contract.currentRoute ?? null,
        currentRunner: contract.currentRunner ?? null,
        fallbackMode: contract.fallbackMode ?? null,
        genericRouteActiveUntilDirectRunnerSelected:
          contract.genericRouteActiveUntilDirectRunnerSelected ?? null
      } : null;
      const compactSidecarAwareResidentSequence = (sequence) => sequence ? {
        schema: sequence.schema ?? null,
        status: sequence.status ?? null,
        mode: sequence.mode ?? null,
        runner: sequence.runner ?? null,
        sequencePath: sequence.sequencePath ?? null,
        directRunnerContract: compactThermalSidecarDirectRunnerContract(sequence.directRunnerContract),
        directRunnerContractStatus: sequence.directRunnerContractStatus ?? null,
        directRunnerEligible: sequence.directRunnerEligible ?? null,
        directRunnerRunnable: sequence.directRunnerRunnable ?? null,
        directRunnerSelected: sequence.directRunnerSelected ?? null,
        directRunnerSelectionStatus: sequence.directRunnerSelectionStatus ?? null,
        sequenceRequested: sequence.sequenceRequested ?? null,
        sequenceRunnable: sequence.sequenceRunnable ?? null,
        sidecarAwareSequenceCandidate: sequence.sidecarAwareSequenceCandidate ?? null,
        sidecarAwareSequenceExecuted: sequence.sidecarAwareSequenceExecuted ?? null,
        sidecarAwareSequencePromotesFusedSequence: sequence.sidecarAwareSequencePromotesFusedSequence ?? null,
        promotesFusedResidentSequence: sequence.promotesFusedResidentSequence ?? null,
        fallbackMode: sequence.fallbackMode ?? null,
        activeGridFallbackUsed: sequence.activeGridFallbackUsed ?? null,
        perStepFusedMechanicsFallbackEligible: sequence.perStepFusedMechanicsFallbackEligible ?? null,
        sidecarFusionPlanStatus: sequence.sidecarFusionPlanStatus ?? null,
        sidecarFusionRequired: sequence.sidecarFusionRequired ?? null,
        sidecarFusionRunnable: sequence.sidecarFusionRunnable ?? null,
        sidecarBlockers: [...(sequence.sidecarBlockers || [])],
        requiredStageOrder: [...(sequence.requiredStageOrder || [])],
        stageCount: sequence.stageCount ?? null,
        stepCount: sequence.stepCount ?? null,
        completedStepCount: sequence.completedStepCount ?? null,
        evidenceStepCount: sequence.evidenceStepCount ?? null,
        passedStepCount: sequence.passedStepCount ?? null,
        partialStepCount: sequence.partialStepCount ?? null,
        missingStepCount: sequence.missingStepCount ?? null,
        failedStepCount: sequence.failedStepCount ?? null,
        allStepsPassed: sequence.allStepsPassed ?? null
      } : null;
      const compactFusedResidentSequencePreflight = (preflight) => preflight ? {
        schema: preflight.schema ?? null,
        status: preflight.status ?? null,
        sequenceRequested: preflight.sequenceRequested ?? null,
        sequenceRunnable: preflight.sequenceRunnable ?? null,
        stepCount: preflight.stepCount ?? null,
        readbackMode: preflight.readbackMode ?? null,
        compactSummaryMode: preflight.compactSummaryMode ?? null,
        fallbackMode: preflight.fallbackMode ?? null,
        blockers: [...(preflight.blockers || [])],
        sidecarBlockers: [...(preflight.sidecarBlockers || [])],
        customRunnerBlockers: [...(preflight.customRunnerBlockers || [])],
        sidecarFusionRequired: preflight.sidecarFusionRequired ?? null,
        sidecarFusionRunnable: preflight.sidecarFusionRunnable ?? null,
        sidecarFusionPlanStatus: preflight.sidecarFusionPlanStatus ?? null,
        sidecarFusionStageCount: preflight.sidecarFusionStageCount ?? null,
        sidecarFusionPlan: compactSidecarFusionPlan(preflight.sidecarFusionPlan),
        perStepFusedMechanicsFallbackEligible: preflight.perStepFusedMechanicsFallbackEligible ?? null,
        sidecarOnlySequenceBlocked: preflight.sidecarOnlySequenceBlocked ?? null,
        sidecarAwareSequenceCandidate: preflight.sidecarAwareSequenceCandidate ?? null,
        sidecarAwareSequenceStatus: preflight.sidecarAwareSequenceStatus ?? null,
        sidecarAwareSequenceMode: preflight.sidecarAwareSequenceMode ?? null,
        sidecarAwareSequenceRunner: preflight.sidecarAwareSequenceRunner ?? null,
        sidecarAwareSequencePath: preflight.sidecarAwareSequencePath ?? null,
        sidecarAwareDirectRunnerContract:
          compactThermalSidecarDirectRunnerContract(preflight.sidecarAwareDirectRunnerContract),
        sidecarAwareDirectRunnerContractStatus: preflight.sidecarAwareDirectRunnerContractStatus ?? null,
        sidecarAwareDirectRunnerEligible: preflight.sidecarAwareDirectRunnerEligible ?? null,
        sidecarAwareDirectRunnerRunnable: preflight.sidecarAwareDirectRunnerRunnable ?? null,
        sidecarAwareDirectRunnerSelected: preflight.sidecarAwareDirectRunnerSelected ?? null,
        sidecarAwareDirectRunnerSelectionStatus: preflight.sidecarAwareDirectRunnerSelectionStatus ?? null,
        sidecarAwareSequencePromotesFusedSequence: preflight.sidecarAwareSequencePromotesFusedSequence ?? null,
        sidecarAwareSequenceSupportedBlockers: [...(preflight.sidecarAwareSequenceSupportedBlockers || [])],
        activeGridFallbackRequested: preflight.activeGridFallbackRequested ?? null,
        thermalAwareFusionRequired: preflight.thermalAwareFusionRequired ?? null,
        reactionAwareFusionRequired: preflight.reactionAwareFusionRequired ?? null,
        pressureInterfaceAwareFusionRequired: preflight.pressureInterfaceAwareFusionRequired ?? null,
        residentProductMassAwareFusionRequired: preflight.residentProductMassAwareFusionRequired ?? null
      } : null;
      const compactStageTiming = (stageTiming) => stageTiming ? {
        schema: stageTiming.schema ?? null,
        status: stageTiming.status ?? null,
        kind: stageTiming.kind ?? null,
        capabilities: stageTiming.capabilities
          ? { ...stageTiming.capabilities }
          : null,
        totalMs: finiteOrNull(stageTiming.totalMs),
        stageMs: { ...(stageTiming.stageMs || {}) },
        // PROF-0. Device execution time per stage, next to the host-timeline
        // stageMs. Null when profiling is inert; gpuTimestampProfileStatus says
        // which of "not requested", "unsupported by device" or "read failed"
        // applies, so an absent measurement is never read as a measured zero.
        stageGpuMs: stageTiming.stageGpuMs ? { ...stageTiming.stageGpuMs } : null,
        stageGpuStats: stageTiming.stageGpuStats
          ? { ...stageTiming.stageGpuStats }
          : null,
        gpuTimestampProfileStatus: stageTiming.gpuTimestampProfile?.status ?? null,
        gpuTimestampProfiledPassCount:
          stageTiming.gpuTimestampProfile?.profiledPassCount ?? null,
        queueStageGpuMs: stageTiming.queueStageGpuMs
          ? { ...stageTiming.queueStageGpuMs }
          : null,
        queueStageGpuStats: stageTiming.queueStageGpuStats
          ? { ...stageTiming.queueStageGpuStats }
          : null,
        queueStageGpuSummaryStatus:
          stageTiming.queueStageGpuSummaryStatus ?? null,
        queueStageGpuRecorderSchema:
          stageTiming.queueStageGpuRecorderSchema ?? null,
        queueStageGpuRecorderKind:
          stageTiming.queueStageGpuRecorderKind ?? null,
        queueStageGpuRecorderCapabilities:
          stageTiming.queueStageGpuRecorderCapabilities
            ? { ...stageTiming.queueStageGpuRecorderCapabilities }
            : null,
        queueFenceMs: { ...(stageTiming.queueFenceMs || {}) },
        queueFenceStatus: { ...(stageTiming.queueFenceStatus || {}) },
        queueFenceMethod: { ...(stageTiming.queueFenceMethod || {}) },
        compactSummaryTiming: stageTiming.compactSummaryTiming ? {
          ...stageTiming.compactSummaryTiming,
          totalMs: finiteOrNull(stageTiming.compactSummaryTiming.totalMs),
          setupMs: finiteOrNull(stageTiming.compactSummaryTiming.setupMs),
          encodeMs: finiteOrNull(stageTiming.compactSummaryTiming.encodeMs),
          submitMs: finiteOrNull(stageTiming.compactSummaryTiming.submitMs),
          mapAsyncWaitMs: finiteOrNull(stageTiming.compactSummaryTiming.mapAsyncWaitMs),
          decodeMs: finiteOrNull(stageTiming.compactSummaryTiming.decodeMs)
        } : null,
        requestedReadbackMode: stageTiming.requestedReadbackMode ?? null,
        compactSummaryRequested: stageTiming.compactSummaryRequested ?? null,
        activeGridDispatchPlanOnlyRequested: stageTiming.activeGridDispatchPlanOnlyRequested ?? null,
        compactSummaryScope: stageTiming.compactSummaryScope ?? null,
        fusedResidentMechanics: stageTiming.fusedResidentMechanics ?? null,
        fusedResidentSequence: stageTiming.fusedResidentSequence ?? null,
        fusedResidentSequenceStepCount: stageTiming.fusedResidentSequenceStepCount ?? null,
        fusedResidentSequencePreflight: compactFusedResidentSequencePreflight(stageTiming.fusedResidentSequencePreflight),
        sidecarFusionStepEvidence: compactSidecarFusionStepEvidence(stageTiming.sidecarFusionStepEvidence),
        sidecarAwareResidentSequence: compactSidecarAwareResidentSequence(stageTiming.sidecarAwareResidentSequence),
        sidecarAwareResidentSequenceActive: stageTiming.sidecarAwareResidentSequenceActive ?? null,
        sidecarAwareResidentSequenceMode: stageTiming.sidecarAwareResidentSequenceMode ?? null,
        sidecarAwareResidentSequenceRunner: stageTiming.sidecarAwareResidentSequenceRunner ?? null,
        sidecarAwareResidentSequencePath: stageTiming.sidecarAwareResidentSequencePath ?? null,
        sidecarAwareDirectRunnerContract:
          compactThermalSidecarDirectRunnerContract(stageTiming.sidecarAwareDirectRunnerContract),
        sidecarAwareDirectRunnerContractStatus: stageTiming.sidecarAwareDirectRunnerContractStatus ?? null,
        sidecarAwareDirectRunnerSelected: stageTiming.sidecarAwareDirectRunnerSelected ?? null,
        thermalSidecarDirectRunnerStatus: stageTiming.thermalSidecarDirectRunnerStatus ?? null,
        thermalSidecarDirectRunnerGenericEntrypointBypassed:
          stageTiming.thermalSidecarDirectRunner?.genericResidentStepEntrypointBypassed ?? null,
        dispatchTopology: compactDispatchTopology(stageTiming.dispatchTopology),
        activeGridDispatch: stageTiming.activeGridDispatch
          ? { ...stageTiming.activeGridDispatch }
          : null,
        activeGridIndirectDispatch: stageTiming.activeGridIndirectDispatch
          ? { ...stageTiming.activeGridIndirectDispatch }
          : null,
        activeGridDispatchPlanOnlyEligible: stageTiming.activeGridDispatchPlanOnlyEligible ?? null,
        activeGridDispatchPlanRefreshMode: stageTiming.activeGridDispatchPlanRefreshMode ?? null,
        activeGridDispatchPlanRefreshRequested: stageTiming.activeGridDispatchPlanRefreshRequested ?? null,
        activeGridDispatchPlanRefreshFinalStep: stageTiming.activeGridDispatchPlanRefreshFinalStep ?? null,
        activeGridDispatchPlanRefreshSkippedReason: stageTiming.activeGridDispatchPlanRefreshSkippedReason ?? null,
        thermalRequested: stageTiming.thermalRequested ?? null,
        mechanicsRefreshRequested: stageTiming.mechanicsRefreshRequested ?? null,
        reactionRequested: stageTiming.reactionRequested ?? null
      } : null;
      const compactSchroederHierarchyHostTiming = (timing) => timing ? {
        schema: timing.schema ?? null,
        status: timing.status ?? null,
        requested: timing.requested === true,
        diagnosticOnly: timing.diagnosticOnly === true,
        measurementKind: timing.measurementKind ?? null,
        intervalSemantics: timing.intervalSemantics ?? null,
        hierarchyCallCount: timing.hierarchyCallCount ?? null,
        hierarchyCallCompletedCount:
          timing.hierarchyCallCompletedCount ?? null,
        hierarchyCallFailedCount: timing.hierarchyCallFailedCount ?? null,
        hierarchyCallTotalMs: finiteOrNull(timing.hierarchyCallTotalMs),
        hierarchyCallMinMs: finiteOrNull(timing.hierarchyCallMinMs),
        hierarchyCallMaxMs: finiteOrNull(timing.hierarchyCallMaxMs),
        hierarchyCallLastMs: finiteOrNull(timing.hierarchyCallLastMs),
        hierarchyCallMaxSequenceIndex:
          timing.hierarchyCallMaxSequenceIndex ?? null,
        namedStageTotalMs: finiteOrNull(timing.namedStageTotalMs),
        unattributedOuterMs: finiteOrNull(timing.unattributedOuterMs),
        namedStageOverlapMs: finiteOrNull(timing.namedStageOverlapMs),
        active: timing.active ? { ...timing.active } : null,
        stages: Object.fromEntries(
          Object.entries(timing.stages || {}).slice(0, 64).map(
            ([stage, summary]) => [stage, { ...summary }]
          )
        ),
        queueStages: Object.fromEntries(
          Object.entries(timing.queueStages || {}).slice(0, 64).map(
            ([stage, summary]) => [stage, { ...summary }]
          )
        ),
        stageOverflowCount: timing.stageOverflowCount ?? null,
        maxStageCount: timing.maxStageCount ?? null,
        queryCount: timing.queryCount ?? null,
        markerSubmissionCount: timing.markerSubmissionCount ?? null,
        mapAsyncCount: timing.mapAsyncCount ?? null,
        queueFenceCount: timing.queueFenceCount ?? null,
        readbackBytes: timing.readbackBytes ?? null,
        sourceMutation: timing.sourceMutation === true,
        scientificValidation: false
      } : null;
      const compactGpuSummaryResult = (summary) => summary ? {
        schema: summary.schema ?? null,
        backend: summary.backend ?? null,
        status: summary.status ?? null,
        reason: summary.reason ?? null,
        readbackMode: summary.readbackMode ?? null,
        compactGpuSummaryAvailable: summary.compactGpuSummaryAvailable ?? null,
        compactGpuSummaryStatus: summary.compactGpuSummaryStatus ?? null,
        compactReadbackByteLength: summary.compactReadbackByteLength ?? null,
        activeGridDispatchPlan: summary.activeGridDispatchPlan
          ? { ...summary.activeGridDispatchPlan }
          : null,
        timing: summary.timing ? {
          ...summary.timing,
          totalMs: finiteOrNull(summary.timing.totalMs),
          mapAsyncWaitMs: finiteOrNull(summary.timing.mapAsyncWaitMs),
          compactReadbackByteLength: finiteOrNull(summary.timing.compactReadbackByteLength)
        } : null
      } : null;
      const finiteNumber = (value, fallback = 0) => {
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
      };
      const booleanUrlParam = (value, fallback = false) => {
        if (value == null || value === '') return fallback;
        return !['0', 'false', 'off', 'no', 'manual'].includes(String(value).toLowerCase());
      };
      const positiveIntegerUrlParam = (value) => {
        if (value == null || value === '') return null;
        const number = Math.round(Number(value));
        return Number.isFinite(number) && number > 0 ? number : null;
      };
      const activeGridPlanRefreshModeUrlParam = (value, fallback = 'final-only') => {
        const mode = String(value || fallback).trim().toLowerCase();
        if (mode === 'none' || mode === 'skip' || mode === 'disabled') return 'none';
        if (mode === 'final-only') return 'final-only';
        return 'every-step';
      };
      const residentExecutionPolicyFromLocation = () => {
        const url = new URL(window.location.href);
        const query = new URLSearchParams(url.search);
        const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
        const activeGrid = booleanUrlParam(hash.get('residentActiveGrid') ?? query.get('residentActiveGrid'), false);
        const fuseSequence = activeGrid || booleanUrlParam(hash.get('residentFuseSequence') ?? query.get('residentFuseSequence'), false);
        const queueFence = booleanUrlParam(
          hash.get('residentQueueFence')
            ?? query.get('residentQueueFence')
            ?? hash.get('residentMeasureQueueFence')
            ?? query.get('residentMeasureQueueFence')
            ?? hash.get('residentGpuQueueFence')
            ?? query.get('residentGpuQueueFence'),
          false
        );
        return {
          schema: 'peercompute.ulg.sph-probe-resident-execution-policy.v0',
          fuseNoFullResidentMechanicsSequence: fuseSequence,
          fuseNoFullResidentMechanicsActiveGrid: activeGrid,
          activeGridSafetyCells: positiveIntegerUrlParam(
            hash.get('residentActiveGridSafety') ?? query.get('residentActiveGridSafety')
          ),
          activeGridDispatchPlanRefreshMode: activeGridPlanRefreshModeUrlParam(
            hash.get('residentActiveGridPlanRefresh')
              ?? query.get('residentActiveGridPlanRefresh')
              ?? hash.get('activeGridPlanRefresh')
              ?? query.get('activeGridPlanRefresh'),
            'final-only'
          ),
          measureFusedSequenceQueueFence: queueFence
        };
      };
      const residentExecutionPolicyBase = overlay?.__mlsMpmResidentExecutionPolicy
        || overlay?.__mlsMpmResidentAutoSchedule?.residentExecutionPolicy
        || residentExecutionPolicyFromLocation();
      const residentExecutionPolicy = {
        ...residentExecutionPolicyBase,
        activeGridDispatchPlanRefreshMode: requestedActiveGridDispatchPlanRefreshMode
          || residentExecutionPolicyBase?.activeGridDispatchPlanRefreshMode
          || 'final-only'
      };
      if (overlay) overlay.__mlsMpmResidentExecutionPolicy = residentExecutionPolicy;
      const schroederSimulationConfig =
        overlay?.__sphSchroederSimulationConfig || null;
      const schroederExecutionOptions =
        overlay?.__mlsMpmSchroederExecutionOptions
        || (schroederSimulationConfig?.enabled === true
          ? {
            schroederSimulation: true,
            schroederSelectedLevel: schroederSimulationConfig.selectedLevel,
            schroederSpatialArenaCount:
              schroederSimulationConfig.spatialArenaCount,
            schroederBaseGridSpacingM:
              schroederSimulationConfig.baseGridSpacingM,
            schroederMinLevel: schroederSimulationConfig.minLevel,
            schroederMaxLevel: schroederSimulationConfig.maxLevel,
            schroederTileCellCount: schroederSimulationConfig.tileCellCount,
            schroederEnablePortableSummary:
              schroederSimulationConfig.enablePortableSummary,
            schroederPortableSummaryPeerComputeUseCase:
              schroederSimulationConfig.portableSummaryPeerComputeUseCase,
            schroederEnableActiveNodeIndex:
              schroederSimulationConfig.enableActiveNodeIndex,
            schroederEnableActiveNodeSortedIndex:
              schroederSimulationConfig.enableActiveNodeSortedIndex,
            schroederActiveNodeSortedIndexPolicyMode:
              schroederSimulationConfig.activeNodeSortedIndexPolicyMode,
            schroederLawNeighborTraversalPolicyMode:
              schroederSimulationConfig.lawNeighborTraversalPolicyMode,
            schroederLawNeighborCandidateReadbackMode:
              schroederSimulationConfig.lawNeighborCandidateReadbackMode,
            schroederEnableCrossLevelCoupling:
              schroederSimulationConfig.enableCrossLevelCoupling,
            schroederEnablePhaseVolumeMigration:
              schroederSimulationConfig.enablePhaseVolumeMigration,
            schroederEnableLawQueue:
              schroederSimulationConfig.enableLawQueue,
            schroederEnableLawNeighborCandidates:
              schroederSimulationConfig.enableLawNeighborCandidates,
            schroederEnableTwoLevelMechanics:
              schroederSimulationConfig.enableTwoLevelMechanics,
            schroederEnableMechanicsFieldPairV2:
              schroederSimulationConfig.enableMechanicsFieldPairV2,
            schroederTwoLevelMechanicsAuthority:
              schroederSimulationConfig.twoLevelMechanicsAuthority,
            schroederTwoLevelFineSubstepCount:
              schroederSimulationConfig.twoLevelFineSubstepCount,
            schroederEnableParticleStorageMaterialization:
              schroederSimulationConfig.enableParticleStorageMaterialization,
            schroederParticleStorageAdmissionRowBudget:
              schroederSimulationConfig.particleStorageAdmissionRowBudget,
            schroederParticleStorageRequiredCapacity:
              schroederSimulationConfig.particleStorageRequiredCapacity,
            schroederParticleStorageCapacityMargin:
              schroederSimulationConfig.particleStorageCapacityMargin,
            schroederParticleStorageFreeListSlotCapacity:
              schroederSimulationConfig.particleStorageFreeListSlotCapacity,
            schroederParticleStorageFreeListAvailableSlotCount:
              schroederSimulationConfig.particleStorageFreeListAvailableSlotCount,
            schroederParticleStorageFreeListMaxSlotsPerRow:
              schroederSimulationConfig.particleStorageFreeListMaxSlotsPerRow
          }
          : { schroederSimulation: false });
      if (overlay) {
        overlay.__mlsMpmSchroederExecutionOptions = schroederExecutionOptions;
      }
      const cohortRangesFromCounts = (counts = {}) => {
        const baseCount = Math.max(0, Math.round(Number(counts?.base) || 0));
        const dropCount = Math.max(0, Math.round(Number(counts?.drop) || 0));
        return {
          schema: 'peercompute.ulg.sph-role-cohort-ranges.v0',
          source: 'mounted-scene-view-state-order',
          base: { role: 'base', startIndex: 0, endIndex: baseCount, count: baseCount },
          drop: { role: 'drop', startIndex: baseCount, endIndex: baseCount + dropCount, count: dropCount },
          total: baseCount + dropCount
        };
      };
      const cohortSummaryForRange = (state, range, stride = 8) => {
        if (!range?.count) return { role: range?.role ?? null, status: 'empty-cohort', count: 0 };
        if (!state?.length) {
          return {
            role: range.role,
            status: 'unavailable-no-state',
            startIndex: range.startIndex,
            endIndex: range.endIndex,
            count: range.count
          };
        }
        const start = Math.max(0, Math.round(range.startIndex || 0));
        const end = Math.min(Math.round(range.endIndex || start), Math.floor(state.length / stride));
        const min = [Infinity, Infinity, Infinity];
        const max = [-Infinity, -Infinity, -Infinity];
        const weightedPosition = [0, 0, 0];
        const momentum = [0, 0, 0];
        let massKg = 0;
        let maxSpeedMPerS = 0;
        for (let index = start; index < end; index += 1) {
          const offset = index * stride;
          const x = finiteNumber(state[offset], 0);
          const y = finiteNumber(state[offset + 1], 0);
          const z = finiteNumber(state[offset + 2], 0);
          const m = Math.max(0, finiteNumber(state[offset + 3], 0));
          const vx = finiteNumber(state[offset + 4], 0);
          const vy = finiteNumber(state[offset + 5], 0);
          const vz = finiteNumber(state[offset + 6], 0);
          min[0] = Math.min(min[0], x);
          min[1] = Math.min(min[1], y);
          min[2] = Math.min(min[2], z);
          max[0] = Math.max(max[0], x);
          max[1] = Math.max(max[1], y);
          max[2] = Math.max(max[2], z);
          massKg += m;
          weightedPosition[0] += x * m;
          weightedPosition[1] += y * m;
          weightedPosition[2] += z * m;
          momentum[0] += vx * m;
          momentum[1] += vy * m;
          momentum[2] += vz * m;
          maxSpeedMPerS = Math.max(maxSpeedMPerS, Math.hypot(vx, vy, vz));
        }
        const centerOfMassM = massKg > 0 ? weightedPosition.map((value) => value / massKg) : null;
        return {
          role: range.role,
          status: 'cohort-summary-ready',
          startIndex: start,
          endIndex: end,
          count: end - start,
          massKg,
          centerOfMassM,
          boundsM: {
            status: 'position-bounds-ready',
            min,
            max,
            size: max.map((value, axis) => value - min[axis])
          },
          meanVelocityMPerS: massKg > 0 ? momentum.map((value) => value / massKg) : null,
          maxSpeedMPerS
        };
      };
      const cohortDiagnosticsForState = (state, ranges) => ranges ? {
        schema: 'peercompute.ulg.sph-role-cohort-diagnostics.v0',
        source: ranges.source,
        readbackRequired: true,
        base: cohortSummaryForRange(state, ranges.base),
        drop: cohortSummaryForRange(state, ranges.drop)
      } : null;
      const particleDiagnosticsForState = (state, previousState = null, ranges = null, stride = 8) => {
        if (!state?.length) return null;
        const particleCount = Math.floor(state.length / stride);
        const weightedPosition = [0, 0, 0];
        const previousWeightedPosition = [0, 0, 0];
        const boundsMin = [Infinity, Infinity, Infinity];
        const boundsMax = [-Infinity, -Infinity, -Infinity];
        let massKg = 0;
        let previousMassKg = 0;
        let maxSpeedMPerS = 0;
        let maxDisplacementM = 0;
        for (let index = 0; index < particleCount; index += 1) {
          const offset = index * stride;
          const x = finiteNumber(state[offset], 0);
          const y = finiteNumber(state[offset + 1], 0);
          const z = finiteNumber(state[offset + 2], 0);
          const m = Math.max(0, finiteNumber(state[offset + 3], 0));
          const vx = finiteNumber(state[offset + 4], 0);
          const vy = finiteNumber(state[offset + 5], 0);
          const vz = finiteNumber(state[offset + 6], 0);
          maxSpeedMPerS = Math.max(maxSpeedMPerS, Math.hypot(vx, vy, vz));
          if (previousState?.length >= offset + stride) {
            const px = finiteNumber(previousState[offset], x);
            const py = finiteNumber(previousState[offset + 1], y);
            const pz = finiteNumber(previousState[offset + 2], z);
            const pm = Math.max(0, finiteNumber(previousState[offset + 3], m));
            maxDisplacementM = Math.max(maxDisplacementM, Math.hypot(x - px, y - py, z - pz));
            previousMassKg += pm;
            previousWeightedPosition[0] += px * pm;
            previousWeightedPosition[1] += py * pm;
            previousWeightedPosition[2] += pz * pm;
          }
          massKg += m;
          weightedPosition[0] += x * m;
          weightedPosition[1] += y * m;
          weightedPosition[2] += z * m;
          boundsMin[0] = Math.min(boundsMin[0], x);
          boundsMin[1] = Math.min(boundsMin[1], y);
          boundsMin[2] = Math.min(boundsMin[2], z);
          boundsMax[0] = Math.max(boundsMax[0], x);
          boundsMax[1] = Math.max(boundsMax[1], y);
          boundsMax[2] = Math.max(boundsMax[2], z);
        }
        const nextCenterOfMassM = massKg > 0 ? weightedPosition.map((value) => value / massKg) : null;
        const sourceCenterOfMassM = previousMassKg > 0 ? previousWeightedPosition.map((value) => value / previousMassKg) : null;
        return {
          particleCount,
          gridNodeCount: null,
          activeGridNodeCount: null,
          massDeltaKg: previousMassKg > 0 ? massKg - previousMassKg : 0,
          maxSpeedMPerS,
          maxDisplacementM,
          sourceCenterOfMassM,
          nextCenterOfMassM,
          centerOfMassDeltaM: sourceCenterOfMassM && nextCenterOfMassM
            ? nextCenterOfMassM.map((value, axis) => value - sourceCenterOfMassM[axis])
            : null,
          sourcePositionBoundsM: null,
          nextPositionBoundsM: {
            status: 'position-bounds-ready',
            min: boundsMin,
            max: boundsMax,
            size: boundsMax.map((value, axis) => value - boundsMin[axis])
          },
          cohortDiagnostics: cohortDiagnosticsForState(state, ranges),
          cohortSummaryAvailable: Boolean(ranges),
          minVolumeRatioJ: null,
          maxVolumeRatioJ: null,
          compactGpuSummaryAvailable: false,
          compactGpuSummaryStatus: 'not-run-plain-sph-cpu-reference',
          readbackMode: 'cpu-reference-full-state',
          internalPressureScale: null,
          pressureInterfaceForceRowCount: 0,
          pressureInterfaceForceConsumerStatus: 'not-run-plain-sph-cpu-reference',
          pressureInterfaceAppliedImpulseMagnitudeNSeconds: 0,
          residentAuthorityLedgerStatus: 'not-run-plain-sph-cpu-reference',
          residentAuthorityParticleOwner: 'plain-sph-cpu-reference',
          residentAuthorityMechanicsOwner: 'plain-sph-cpu-reference',
          residentAuthorityThermoOwner: 'plain-sph-cpu-reference'
        };
      };
      const boundsFromGeometry = (node) => {
        const geometry = node.geometry;
        const position = geometry?.attributes?.position;
        if (!geometry || !position || !node.matrixWorld?.elements) return null;
        node.updateMatrixWorld?.(true);
        const drawStart = Math.max(0, Math.round(Number(geometry.drawRange?.start) || 0));
        const rawDrawCount = Number(geometry.drawRange?.count);
        const drawCount = Number.isFinite(rawDrawCount) && rawDrawCount >= 0
          ? Math.min(position.count - drawStart, Math.round(rawDrawCount))
          : position.count - drawStart;
        const drawEnd = Math.min(position.count, drawStart + Math.max(0, drawCount));
        if (drawEnd <= drawStart) return null;
        const min = [Infinity, Infinity, Infinity];
        const max = [-Infinity, -Infinity, -Infinity];
        const elements = node.matrixWorld.elements;
        const transform = (x, y, z) => ([
            elements[0] * x + elements[4] * y + elements[8] * z + elements[12],
            elements[1] * x + elements[5] * y + elements[9] * z + elements[13],
            elements[2] * x + elements[6] * y + elements[10] * z + elements[14]
          ]);
        const add = (point) => {
          for (let axis = 0; axis < 3; axis += 1) {
            min[axis] = Math.min(min[axis], point[axis]);
            max[axis] = Math.max(max[axis], point[axis]);
          }
        };
        const itemSize = position.itemSize || 3;
        const array = position.array;
        const transformed = [];
        for (let vertexIndex = drawStart; vertexIndex < drawEnd; vertexIndex += 1) {
          const offset = vertexIndex * itemSize;
          const point = transform(array[offset], array[offset + 1], array[offset + 2]);
          transformed.push(point);
          add(point);
        }
        if (!min.every(Number.isFinite) || !max.every(Number.isFinite)) return null;
        const parent = Array.from({ length: transformed.length }, (_, index) => index);
        const find = (index) => {
          let cursor = index;
          while (parent[cursor] !== cursor) {
            parent[cursor] = parent[parent[cursor]];
            cursor = parent[cursor];
          }
          return cursor;
        };
        const union = (left, right) => {
          const a = find(left);
          const b = find(right);
          if (a !== b) parent[b] = a;
        };
        const quantized = new Map();
        const quantize = (point) => point.map((value) => Math.round(value * 1e5)).join(',');
        for (let localIndex = 0; localIndex < transformed.length; localIndex += 1) {
          const key = quantize(transformed[localIndex]);
          const previous = quantized.get(key);
          if (previous != null) union(localIndex, previous);
          else quantized.set(key, localIndex);
        }
        for (let localIndex = 0; localIndex + 2 < transformed.length; localIndex += 3) {
          union(localIndex, localIndex + 1);
          union(localIndex, localIndex + 2);
        }
        const componentCounts = new Map();
        for (let localIndex = 0; localIndex < transformed.length; localIndex += 1) {
          const root = find(localIndex);
          componentCounts.set(root, (componentCounts.get(root) || 0) + 1);
        }
        const componentVertexCounts = [...componentCounts.values()].sort((a, b) => b - a);
        const largestComponentVertexCount = componentVertexCounts[0] || 0;
        const size = max.map((value, axis) => value - min[axis]);
        return {
          min,
          max,
          center: max.map((value, axis) => (value + min[axis]) * 0.5),
          size,
          volume: size[0] * size[1] * size[2],
          vertexCount: drawEnd - drawStart,
          vertexCapacity: position.count ?? 0,
          drawRange: {
            start: drawStart,
            count: drawEnd - drawStart
          },
          componentCount: componentVertexCounts.length,
          componentVertexCounts: componentVertexCounts.slice(0, 12),
          largestComponentVertexCount,
          largestComponentVertexRatio: transformed.length > 0
            ? largestComponentVertexCount / transformed.length
            : null,
          smallComponentCount: componentVertexCounts.filter((count) => count < Math.max(9, largestComponentVertexCount * 0.05)).length
        };
      };
      const surfaceSnapshot = (sceneApi) => {
        const surfaces = [];
        const materialsOf = (material) => Array.isArray(material) ? material : [material].filter(Boolean);
        const materialFlag = (material, key, fallback = null) => {
          const materials = materialsOf(material);
          if (!materials.length) return fallback;
          return materials.every((entry) => entry?.[key] === true)
            ? true
            : (materials.every((entry) => entry?.[key] === false) ? false : 'mixed');
        };
        const nodeRenderPolicy = (node) => ({
          renderLayer: node?.userData?.renderLayer ?? null,
          renderOrder: finiteOrNull(node?.renderOrder),
          renderOrderBase: finiteOrNull(node?.userData?.renderOrderBase),
          renderOrderPolicy: node?.userData?.renderOrderPolicy ?? null,
          materialTransparent: materialFlag(node?.material, 'transparent'),
          materialDepthWrite: materialFlag(node?.material, 'depthWrite'),
          materialDepthTest: materialFlag(node?.material, 'depthTest')
        });
        let containerWire = null;
        let containerGrid = null;
        sceneApi?.scene?.updateMatrixWorld?.(true);
        sceneApi?.scene?.traverse?.((node) => {
          if (node.userData?.renderLayer === 'container-wire') containerWire = nodeRenderPolicy(node);
          if (node.userData?.renderLayer === 'container-grid') containerGrid = nodeRenderPolicy(node);
          if (node.userData?.renderMode !== 'continuous-marching-cubes') return;
          const bounds = boundsFromGeometry(node);
          surfaces.push({
            visible: node.visible === true,
            materialKey: node.userData.materialKey ?? null,
            phase: node.userData.phase ?? null,
            renderKey: node.userData.renderKey ?? null,
            renderSource: node.userData.renderSource ?? null,
            renderFieldMaxDensity: finiteOrNull(node.userData.renderFieldMaxDensity),
            renderFieldIsolation: finiteOrNull(node.userData.renderFieldIsolation),
            renderFieldShowIsolation: finiteOrNull(node.userData.renderFieldShowIsolation),
            renderFieldHideIsolation: finiteOrNull(node.userData.renderFieldHideIsolation),
            renderFieldAppliedIsolation: finiteOrNull(node.userData.renderFieldAppliedIsolation),
            renderFieldRetainedByGrace: node.userData.renderFieldRetainedByGrace ?? null,
            renderFieldResolution: finiteOrNull(node.userData.renderFieldResolution),
            renderFieldCells: finiteOrNull(node.userData.renderFieldCells),
            renderFieldCellSizeM: finiteOrNull(node.userData.renderFieldCellSizeM),
            surfaceRadiusM: finiteOrNull(node.userData.surfaceRadiusM),
            requestedSurfaceRadiusM: finiteOrNull(node.userData.requestedSurfaceRadiusM),
            cpuMarchingCubesRadiusFloorM: finiteOrNull(node.userData.cpuMarchingCubesRadiusFloorM),
            cpuMarchingCubesCellSizeM: finiteOrNull(node.userData.cpuMarchingCubesCellSizeM),
            cpuMarchingCubesRadiusFloorApplied: node.userData.cpuMarchingCubesRadiusFloorApplied ?? null,
            surfaceInactiveFrameCount: node.userData.surfaceInactiveFrameCount ?? null,
            opticalSurfaceVisibility: node.userData.opticalSurfaceVisibility ?? null,
            opticalSurfaceHiddenReason: node.userData.opticalSurfaceHiddenReason ?? null,
            opticalSurfaceRetainedByGrace: node.userData.opticalSurfaceRetainedByGrace ?? null,
            surfaceBoundsClipStatus: node.userData.surfaceBoundsClipStatus ?? null,
            surfaceBoundsClipVertexCount: node.userData.surfaceBoundsClipVertexCount ?? null,
            surfaceBoundsClipPaddingM: finiteOrNull(node.userData.surfaceBoundsClipPaddingM),
            surfaceBoxClipStatus: node.userData.surfaceBoxClipStatus ?? null,
            surfaceBoxClipVertexCount: node.userData.surfaceBoxClipVertexCount ?? null,
            ...nodeRenderPolicy(node),
            vertexCount: bounds?.vertexCount ?? 0,
            vertexCapacity: bounds?.vertexCapacity ?? node.geometry?.attributes?.position?.count ?? 0,
            drawRange: bounds?.drawRange ?? null,
            componentCount: bounds?.componentCount ?? null,
            componentVertexCounts: bounds?.componentVertexCounts ?? [],
            largestComponentVertexCount: bounds?.largestComponentVertexCount ?? null,
            largestComponentVertexRatio: bounds?.largestComponentVertexRatio ?? null,
            smallComponentCount: bounds?.smallComponentCount ?? null,
            worldBounds: bounds
          });
        });
        const visible = surfaces.filter((surface) => surface.visible);
        return {
          totalCount: surfaces.length,
          visibleCount: visible.length,
          h2oVisibleCount: visible.filter((surface) => String(surface.materialKey || '').toLowerCase().includes('h2o')).length,
          all: surfaces,
          visible,
          containerWire,
          containerGrid
        };
      };
      markProbeProgress('in-page-probe-helpers-ready');
      if (!sceneApi?.refreshMlsMpmResidentSteps) {
        return {
          schema: 'peercompute.ulg.sph-history-long-horizon-probe.v0',
          status: 'blocked',
          reason: 'scene.refreshMlsMpmResidentSteps unavailable',
          metrics: []
        };
      }
      const metrics = [];
      const errors = [];
      const visualFrames = [];
      const partialTimeline = {
        schema: 'peercompute.ulg.sph-probe-partial-timeline.v0',
        status: 'in-progress',
        updatedAtMs: performance.now(),
        metrics,
        errors,
        visualFrames,
        authoritativeGpuCheckpointCapture: null
      };
      globalThis.__ulgSphProbePartialTimeline = partialTimeline;
      let execution = sceneApi.getMlsMpmResidentSteps?.() || overlay.__mlsMpmResidentSteps || null;
      let mountedResidentSchedule = null;
      if (
        requestedUseMountedResidentSchedule
        && requestedSurfaceDrawDiagnosticMode
          === 'native-webgpu-surface-consumer'
      ) {
        const mountedSchedulerDeadlineMs = performance.now() + 60_000;
        while (
          typeof overlay.__sphScheduleMlsMpmResidentSteps !== 'function'
          && performance.now() < mountedSchedulerDeadlineMs
        ) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        if (typeof overlay.__sphScheduleMlsMpmResidentSteps !== 'function') {
          throw new Error(
            'native-surface probe requires the mounted resident scheduler'
          );
        }
        mountedResidentSchedule =
          overlay.__sphScheduleMlsMpmResidentSteps;
      }
      const runMountedResidentSchedule = async ({
        stepCount,
        readbackMode,
        continueFromResidentState
      }) => {
        const previousScheduleId = execution?.workerOwnedResidentLane?.scheduleId ?? null;
        const deadlineMs = performance.now() + Math.max(
          60_000,
          Math.max(1, Number(stepCount) || 1) * 4_000 + 30_000
        );
        let schedulePromise = null;
        while (!schedulePromise && performance.now() < deadlineMs) {
          const candidate = mountedResidentSchedule({
            stepCount,
            workerLaneProgressEverySteps:
              requestedWorkerLaneProgressEverySteps,
            readbackMode,
            continueFromResidentState,
            force: true
          });
          if (candidate && typeof candidate.then === 'function') {
            schedulePromise = candidate;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        if (!schedulePromise) {
          throw new Error(
            'mounted resident scheduler did not admit the requested native-surface batch'
          );
        }
        const settledExecution = await schedulePromise;
        const mountedExecution = sceneApi.getMlsMpmResidentSteps?.()
          || overlay.__mlsMpmResidentSteps
          || null;
        const mountedScheduleId =
          mountedExecution?.workerOwnedResidentLane?.scheduleId ?? null;
        if (
          !settledExecution?.schema
          || !mountedExecution
          || mountedExecution !== settledExecution
          || mountedScheduleId == null
          || mountedScheduleId === previousScheduleId
        ) {
          throw new Error(
            'mounted resident scheduler settled without publishing a new worker schedule'
          );
        }
        if (overlay.__sphResidentRenderStateError) {
          throw new Error(String(overlay.__sphResidentRenderStateError));
        }
        return mountedExecution;
      };
      let latestThermalCandidateCsrRouteEvidence = {
        schema: 'peercompute.ulg.sph-probe-thermal-candidate-csr-route-evidence.v1',
        status: requestedCaptureThermalCandidateCsrRouteEvidence
          ? 'pending-first-resident-batch'
          : 'not-requested',
        requested: Boolean(requestedCaptureThermalCandidateCsrRouteEvidence),
        diagnosticOnly: true,
        normalHotLoopReadbackFree: true
      };
      const shouldCaptureFrame = (batchIndex, phase) => {
        if (!requestedCaptureFrames) return false;
        if (batchIndex === requestedBatches) {
          return visualFrames.length < requestedCaptureFrameMax;
        }
        if (batchIndex === 0) return true;
        // Reserve one bounded capture slot for the terminal frame. Without
        // this, a long worker schedule consumes the cap on its first batches
        // and the visual time-span gate never observes the completed horizon.
        if (visualFrames.length >= requestedCaptureFrameMax - 1) return false;
        if (String(phase || '').includes('error') || String(phase || '').includes('anomaly')) return true;
        return batchIndex % requestedCaptureFrameEvery === 0;
      };
      const shouldExtractNativeSurface = (batchIndex, phase) => Boolean(
        batchIndex === requestedBatches
        || (
          requestedInteractiveCacheLifecycle
          && batchIndex > 0
          && phase === 'resident-batch'
        )
        || (
          requestedNativeSurfaceExtractionAtVisualIntervals
          && shouldCaptureFrame(batchIndex, phase)
        )
      );
      const captureFrame = async (batchIndex, phase, sampleIndex) => {
        if (!shouldCaptureFrame(batchIndex, phase)) return;
        const canvases = Array.from(document.querySelectorAll('canvas'));
        const renderBridge = sceneApi.getSphResidentSurfaceDrawRenderBridge?.()
          || sceneApi?.scene?.userData?.sphResidentSurfaceDrawRenderBridge
          || null;
        const nativeConsumer = sceneApi?.scene?.userData?.sphNativeWebGpuSurfaceConsumer
          || renderBridge?.nativeConsumer
          || null;
        const visibleCanvases = canvases.filter((candidate) => {
          const rect = candidate.getBoundingClientRect?.();
          const style = window.getComputedStyle?.(candidate);
          return rect
            && rect.width > 0
            && rect.height > 0
            && style?.display !== 'none'
            && style?.visibility !== 'hidden'
            && Number(style?.opacity ?? 1) !== 0;
        });
        const canvas = visibleCanvases.find((candidate) => candidate === nativeConsumer?.canvas)
          || visibleCanvases.find((candidate) => candidate === renderBridge?.canvas)
          || (requestedSurfaceDrawDiagnosticMode === 'native-webgpu-surface-consumer'
            ? visibleCanvases[0]
            : visibleCanvases.at(-1))
          || null;
        const canvasRect = canvas?.getBoundingClientRect?.() || null;
        const base = {
          schema: 'peercompute.ulg.sph-probe-visual-frame.v0',
          batchIndex,
          phase,
          sampleIndex,
          capturedAtMs: performance.now(),
          captureSource: 'canvas-data-url',
          canvasCount: canvases.length,
          visibleCanvasCount: visibleCanvases.length,
          canvasIndex: canvas ? canvases.indexOf(canvas) : null,
          canvasCssWidth: canvasRect?.width ?? null,
          canvasCssHeight: canvasRect?.height ?? null
        };
        const renderState = sceneApi.getSphResidentRenderState?.()
          || overlay.__sphResidentRenderState
          || null;
        const surfaceDraw = sceneApi.getSphResidentSurfaceDraw?.()
          || overlay.__sphResidentSurfaceDraw
          || null;
        const presentationBridge = surfaceDraw?.visibleRendererBridge
          || renderState?.surfaceDrawVisibleRendererBridge
          || null;
        const presentationSource = surfaceDraw?.visibleRenderSource
          || surfaceDraw?.source
          || renderState?.source
          || null;
        const presentationIdentity = `${presentationBridge || ''} ${presentationSource || ''}`.toLowerCase();
        const nativeWebGpuPresented = requestedSurfaceDrawDiagnosticMode === 'native-webgpu-surface-consumer'
          || presentationIdentity.includes('native-webgpu');
        const workerPresented = presentationIdentity.includes('worker-owned-presented-canvas')
          || presentationIdentity.includes('presentation-worker-retained-output')
          || presentationIdentity.includes('worker-offscreen');
        // The active presentation canvas can change ownership without leaving
        // bridge metadata on the sampled render state. The browser compositor
        // is therefore the validation authority for every visual checkpoint;
        // canvas readback remains only a fallback if screenshot capture fails.
        const compositorCaptureRequired = true;
        let compositorFallbackReason = null;
        if (!canvas) {
          visualFrames.push({
            ...base,
            status: 'missing-canvas',
            reason: 'no-visible-canvas-element',
            presentationBridge,
            presentationSource,
            nativeWebGpuPresented,
            workerPresented,
            compositorCaptureRequired
          });
          return;
        }
        const nativeInnerRegionRequested = (
          requestedSurfaceDrawDiagnosticMode === 'native-webgpu-surface-consumer'
        );
        const compositorClip = canvasRect ? {
          x: canvasRect.x + canvasRect.width * (nativeInnerRegionRequested ? 0.2 : 0),
          y: canvasRect.y + canvasRect.height * (nativeInnerRegionRequested ? 0.2 : 0),
          width: canvasRect.width * (nativeInnerRegionRequested ? 0.6 : 1),
          height: canvasRect.height * (nativeInnerRegionRequested ? 0.6 : 1)
        } : null;
        const compositorCaptureRegion = {
          mode: nativeInnerRegionRequested ? 'inner-60-percent' : 'full-canvas',
          normalizedCanvasRegion: nativeInnerRegionRequested
            ? { x: 0.2, y: 0.2, width: 0.6, height: 0.6 }
            : { x: 0, y: 0, width: 1, height: 1 },
          clip: compositorClip
        };
        if (
          compositorCaptureRequired
          && typeof globalThis.__ulgCaptureSphProbeCompositedFrame === 'function'
        ) {
          const composited = await globalThis.__ulgCaptureSphProbeCompositedFrame({
            clip: compositorClip
          });
          if (composited?.status === 'captured' && composited.dataUrl) {
            visualFrames.push({
              ...base,
              ...composited,
              presentationBridge,
              presentationSource,
              nativeWebGpuPresented,
              workerPresented,
              compositorCaptureRequired: true,
              compositorCaptureRegion,
              canvasToDataUrlSkipped: true,
              canvasToDataUrlSkipReason: 'gpu-or-worker-presentation-requires-compositor-capture'
            });
            return;
          }
          compositorFallbackReason = composited?.reason || composited?.status || 'compositor-capture-failed';
        }
        try {
          visualFrames.push({
            ...base,
            status: 'captured',
            width: canvas.width ?? null,
            height: canvas.height ?? null,
            dataUrl: canvas.toDataURL('image/png'),
            presentationBridge,
            presentationSource,
            nativeWebGpuPresented,
            workerPresented,
            compositorCaptureRequired,
            compositorCaptureRegion: {
              mode: 'full-canvas-data-url-fallback',
              normalizedCanvasRegion: { x: 0, y: 0, width: 1, height: 1 },
              clip: null
            },
            compositorFallbackReason
          });
        } catch (error) {
          visualFrames.push({
            ...base,
            status: 'capture-error',
            width: canvas.width ?? null,
            height: canvas.height ?? null,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      };
      let authoritativeGpuCheckpointModulePromise = null;
      let authoritativeGeneratedGasCohortModulePromise = null;
      let peerComputeBrowserResidentHostModulePromise = null;
      let sphGpuBuffersModulePromise = null;
      let authoritativeGeneratedGasCohortTracker = null;
      let authoritativeCheckpointDeviceResult = null;
      const loadAuthoritativeGpuCheckpointModule = () => {
        if (!authoritativeGpuCheckpointModulePromise) {
          authoritativeGpuCheckpointModulePromise = import('/scripts/sph-authoritative-gpu-checkpoint.mjs');
        }
        return authoritativeGpuCheckpointModulePromise;
      };
      const loadAuthoritativeGeneratedGasCohortModule = () => {
        if (!authoritativeGeneratedGasCohortModulePromise) {
          authoritativeGeneratedGasCohortModulePromise = import(
            '/src/runtime/sph/sphFrozenGeneratedGasCohortGpu.js'
          );
        }
        return authoritativeGeneratedGasCohortModulePromise;
      };
      const loadPeerComputeBrowserResidentHostModule = () => {
        if (!peerComputeBrowserResidentHostModulePromise) {
          peerComputeBrowserResidentHostModulePromise = import(
            '/src/runtime/peercomputeBrowserResidentHost.js'
          );
        }
        return peerComputeBrowserResidentHostModulePromise;
      };
      const loadSphGpuBuffersModule = () => {
        if (!sphGpuBuffersModulePromise) {
          sphGpuBuffersModulePromise = import(
            '/src/runtime/sph/sphGpuBuffers.js'
          );
        }
        return sphGpuBuffersModulePromise;
      };
      const captureAuthoritativeGpuCheckpoint = async ({ batchIndex, phase, sampleIndex }) => {
        const checkpointBase = {
          schema: 'peercompute.ulg.sph-authoritative-gpu-material-phase-checkpoint.v1',
          status: 'not-run',
          batchIndex,
          phase,
          sampleIndex,
          capturedAtMs: performance.now(),
          source: 'retained-resident-particle-buffers',
          authority: 'gpu-resident-retained-state',
          diagnosticOnly: true,
          physicsReference: false,
          sourceBufferMutation: false,
          hotLoopParticipation: false,
          readbackCadence: 'visual-validation-checkpoint-only'
        };
        if (!requestedVisualIntervalCaptureRequested) {
          return {
            ...checkpointBase,
            status: 'disabled',
            reason: 'authoritative GPU checkpoint capture was not requested'
          };
        }

        const currentSteps = sceneApi.getMlsMpmResidentSteps?.()
          || overlay.__mlsMpmResidentSteps
          || execution
          || null;
        const currentStep = sceneApi.getMlsMpmResidentStep?.()
          || overlay.__mlsMpmResidentStep
          || currentSteps?.finalStep
          || null;
        const mechanicsIntegrator = String(
          overlay.__sphPhaseViewState?.gpuMechanics?.integrator
          || overlay.__sphDriver?.demo?.gpuMechanics?.integrator
          || ''
        ).trim().toLowerCase();
        const executionBackend = String(currentSteps?.backend || currentStep?.backend || '').toLowerCase();
        if (
          (mechanicsIntegrator && mechanicsIntegrator !== 'mlsmpm')
          || executionBackend.includes('cpu-reference')
        ) {
          return {
            ...checkpointBase,
            status: 'not-run-non-resident-authority',
            reason: 'the selected mechanics lane is not authoritative resident MLS-MPM'
          };
        }

        // A time-zero checkpoint may never borrow a later resident result and
        // relabel it as initial state. At phase=initial accept only the upload
        // created by the initial scene/overlay refresh; later checkpoints use
        // only completed resident-step outputs.
        const checkpointModule = await loadAuthoritativeGpuCheckpointModule();
        const uploadCandidates = phase === 'initial'
          ? [
              {
                source: 'scene-initial-particle-upload-pair',
                sphParticleUpload: sceneApi.getSphGpuParticleUpload?.(),
                mlsMpmParticleUpload: sceneApi.getMlsMpmGpuParticleUpload?.(),
                expectedStep: 0,
                expectedTimeS: 0
              },
              {
                source: 'overlay-initial-particle-upload-pair',
                sphParticleUpload: overlay.__sphGpuParticleUpload,
                mlsMpmParticleUpload: overlay.__mlsMpmGpuParticleUpload,
                expectedStep: 0,
                expectedTimeS: 0
              }
            ]
          : [
              {
                source: 'resident-steps-next-particle-upload-pair',
                sphParticleUpload: currentSteps?.nextParticleUploads?.sphParticleUpload,
                mlsMpmParticleUpload: currentSteps?.nextParticleUploads?.mlsMpmParticleUpload,
                expectedStep: currentSteps?.nextSphParticleState?.step,
                expectedTimeS: currentSteps?.nextSphParticleState?.time,
                expectedParticleCount: currentSteps?.nextParticleCount
              },
              {
                source: 'resident-steps-final-step-next-particle-upload-pair',
                sphParticleUpload: currentSteps?.finalStep?.nextParticleUploads?.sphParticleUpload,
                mlsMpmParticleUpload:
                  currentSteps?.finalStep?.nextParticleUploads?.mlsMpmParticleUpload,
                expectedStep: currentSteps?.finalStep?.particlePingPong?.nextStep,
                expectedTimeS: currentSteps?.finalStep?.particlePingPong?.nextTime,
                expectedParticleCount: currentSteps?.finalStep?.nextParticleCount
              },
              {
                source: 'resident-step-next-particle-upload-pair',
                sphParticleUpload: currentStep?.nextParticleUploads?.sphParticleUpload,
                mlsMpmParticleUpload: currentStep?.nextParticleUploads?.mlsMpmParticleUpload,
                expectedStep: currentStep?.particlePingPong?.nextStep,
                expectedTimeS: currentStep?.particlePingPong?.nextTime,
                expectedParticleCount: currentStep?.nextParticleCount
              }
            ];
        const evaluatedUploadCandidates = uploadCandidates.map((candidate) => ({
          ...candidate,
          validation: checkpointModule.validateAuthoritativeGpuUploadPair({
            sphParticleUpload: candidate.sphParticleUpload,
            mlsMpmParticleUpload: candidate.mlsMpmParticleUpload,
            requireTimeZero: phase === 'initial',
            expectedStep: candidate.expectedStep,
            expectedTimeS: candidate.expectedTimeS,
            expectedParticleCount: candidate.expectedParticleCount
          })
        }));
        let selectedUploadPair = evaluatedUploadCandidates.find((candidate) => (
          candidate.validation.ready
          && candidate.validation.sharedSlotIdentityVerified
        )) ?? evaluatedUploadCandidates.find((candidate) => (
          candidate.validation.ready
        ));
        if (!authoritativeCheckpointDeviceResult?.device) {
          const renderBridge = sceneApi.getSphResidentSurfaceDrawRenderBridge?.()
            || sceneApi?.scene?.userData?.sphResidentSurfaceDrawRenderBridge
            || null;
          authoritativeCheckpointDeviceResult = renderBridge?.device
            ? { device: renderBridge.device, status: 'resident-render-bridge-device' }
            : await sceneApi.requestOpticalGpuDevice?.();
        }
        const deviceResult = authoritativeCheckpointDeviceResult;
        const device = deviceResult?.device || null;
        if (!device?.createBuffer || !device?.createCommandEncoder || !device.queue?.submit) {
          return {
            ...checkpointBase,
            status: 'unavailable',
            reason: deviceResult?.reason || 'resident GPUDevice is unavailable'
          };
        }

        let temporarySnapshotUploads = null;
        let workerSnapshotStatus = null;
        if (!selectedUploadPair && phase !== 'initial') {
          const lane = currentSteps?.workerOwnedResidentLane || null;
          const requestedStepCount = Number(lane?.requestedStepCount);
          const completedStepCount = Number(lane?.completedStepCount);
          const workerSnapshotAuthorityReady = Boolean(
            lane?.residentScheduleStatus === 'worker-resident-schedule-completed'
            && lane?.terminalStatus
              === 'worker-offscreen-resident-schedule-on-presentation-device-completed'
            && lane?.cancelled === false
            && Number.isSafeInteger(requestedStepCount)
            && requestedStepCount > 0
            && Number.isSafeInteger(completedStepCount)
            && completedStepCount === requestedStepCount
            && lane?.gpuFence?.fenceSatisfied === true
            && lane?.authority?.status
              === 'state-manager-committed-worker-schedule'
            && lane?.authority?.stateManagerCommitStatus === 'committed'
            && currentSteps?.stateManagerCommit?.accepted === true
          );
          if (
            workerSnapshotAuthorityReady
            && typeof sceneApi.exportWorkerOffscreenRetainedCompactSnapshot
              === 'function'
          ) {
            const currentSphState = sceneApi.getSphGpuParticleState?.()
              || overlay.__sphPhaseViewState?.sphGpuParticleState
              || null;
            const currentMlsMpmState = sceneApi.getMlsMpmGpuParticleState?.()
              || overlay.__sphPhaseViewState?.mlsMpmGpuParticleState
              || null;
            const expectedParticleCount = Math.max(
              0,
              Math.floor(Number(
                lane?.perStepSummaries?.lastStep?.particleCount
                ?? currentSphState?.particleCount
                ?? currentMlsMpmState?.particleCount
              ) || 0)
            );
            const expectedStep = Number(lane?.laneCompletedStepTotal);
            const expectedTimeS = Number(lane?.laneSimTimeS);
            const cacheKey = [
              lane.scheduleId,
              'authoritative-checkpoint',
              batchIndex,
              sampleIndex
            ].join(':');
            sceneApi.exportWorkerOffscreenRetainedCompactSnapshot({
              laneId: lane.laneId,
              stateKey: lane.stateKey,
              cacheKey,
              sourceStageId: 'schroederSameLevelMechanics',
              particleCount: expectedParticleCount,
              stateStrideFloats: 8,
              thermoStrideFloats: 12,
              mechanicsStrideFloats: 32,
              step: expectedStep,
              time: expectedTimeS,
              dimension: currentSphState?.dimension ?? 3,
              smoothingLengthM: currentSphState?.smoothingLengthM ?? 0,
              timeoutMs: 15000,
              reason: 'authoritative-gpu-checkpoint-worker-boundary'
            });
            const snapshotWaitStartedAtMs = performance.now();
            while (performance.now() - snapshotWaitStartedAtMs < 16000) {
              const current =
                sceneApi.getWorkerOffscreenRetainedCompactSnapshotStatus?.()
                || null;
              const requestMatches = Boolean(
                current?.cacheKey === cacheKey
                && current?.laneId === lane.laneId
                && current?.stateKey === lane.stateKey
                && current?.sourceStageId === 'schroederSameLevelMechanics'
              );
              if (
                requestMatches
                && /exported|blocked|failed|timeout/.test(
                  String(current?.status || '')
                )
              ) {
                workerSnapshotStatus = current;
                break;
              }
              await new Promise((resolve) => setTimeout(resolve, 20));
            }
            const snapshot = workerSnapshotStatus?.compactBufferSnapshot || null;
            const snapshotMatchesRequest = Boolean(
              workerSnapshotStatus?.status
                === 'presentation-worker-retained-compact-snapshot-exported'
              && workerSnapshotStatus?.portableSnapshotAvailable === true
              && snapshot?.schema
                === 'peercompute.ulg.remote-task-graph-compact-buffer-snapshot.v0'
              && snapshot?.cacheKey === cacheKey
              && snapshot?.laneId === lane.laneId
              && snapshot?.stateKey === lane.stateKey
              && snapshot?.sourceStageId === 'schroederSameLevelMechanics'
              && Number(snapshot?.particleCount) === expectedParticleCount
              && Number(snapshot?.step) === expectedStep
              && Math.abs(Number(snapshot?.time) - expectedTimeS) <= 1e-9
              && snapshot?.sharedSlotIdentityVerified === true
              && snapshot?.workerLineageMetadata?.status
                === 'worker-retained-compact-snapshot-lineage-metadata-ready'
            );
            if (snapshotMatchesRequest) {
              const [{ refreshUlgSphMlsMpmHotBuffersFromCompactSnapshot }, gpuBuffersModule] =
                await Promise.all([
                  loadPeerComputeBrowserResidentHostModule(),
                  loadSphGpuBuffersModule()
                ]);
              let hotBufferRecord = null;
              refreshUlgSphMlsMpmHotBuffersFromCompactSnapshot({
                device,
                compactBufferSnapshot: snapshot,
                materialProperties:
                  overlay.__sphPhaseViewState?.materialProperties || null,
                stateManager: {
                  setHotBuffer(_key, record) {
                    hotBufferRecord = record;
                  }
                },
                cacheKey,
                stateKey: `${lane.stateKey}:authoritative-checkpoint`,
                hotBufferKey: `${cacheKey}:page-diagnostic-hot-buffer`
              });
              if (hotBufferRecord?.sphUpload && hotBufferRecord?.mlsMpmUpload) {
                const slotMetadata = {
                  slot: snapshot.slot ?? null,
                  sourceSlot: snapshot.sourceSlot ?? null,
                  nextSlot: snapshot.nextSlot ?? null
                };
                const sphParticleUpload = {
                  ...hotBufferRecord.sphUpload,
                  ...slotMetadata,
                  step: snapshot.step,
                  time: snapshot.time,
                  topologyEpoch: snapshot.topologyEpoch ?? null,
                  identityRevision: snapshot.identityRevision ?? null,
                  phaseCarrierPlan:
                    snapshot.sphPhaseCarrierPlan
                    ?? snapshot.phaseCarrierPlan
                    ?? null
                };
                const mlsMpmParticleUpload = {
                  ...hotBufferRecord.mlsMpmUpload,
                  ...slotMetadata,
                  step: snapshot.step,
                  time: snapshot.time,
                  phaseCarrierPlan:
                    snapshot.mechanicsPhaseCarrierPlan
                    ?? snapshot.phaseCarrierPlan
                    ?? null
                };
                const validation = checkpointModule.validateAuthoritativeGpuUploadPair({
                  sphParticleUpload,
                  mlsMpmParticleUpload,
                  requireTimeZero: false,
                  expectedStep: Number(snapshot.step),
                  expectedTimeS: Number(snapshot.time),
                  expectedParticleCount
                });
                temporarySnapshotUploads = {
                  sphUpload: hotBufferRecord.sphUpload,
                  mlsMpmUpload: hotBufferRecord.mlsMpmUpload,
                  destroySphGpuParticleBuffers:
                    gpuBuffersModule.destroySphGpuParticleBuffers,
                  destroyMlsMpmGpuParticleBuffers:
                    gpuBuffersModule.destroyMlsMpmGpuParticleBuffers
                };
                const workerUploadCandidate = {
                  source: 'worker-retained-terminal-compact-snapshot-upload-pair',
                  sphParticleUpload,
                  mlsMpmParticleUpload,
                  expectedStep: Number(snapshot.step),
                  // The lane receipt intentionally compacts its public clock,
                  // while the worker snapshot retains the exact accumulated
                  // IEEE-754 value. The request gate above already binds them
                  // within 1 ns; use the authenticated snapshot value for the
                  // validator's strict parent-generation equality check.
                  expectedTimeS: Number(snapshot.time),
                  expectedParticleCount,
                  validation,
                  snapshotStatus: workerSnapshotStatus
                };
                evaluatedUploadCandidates.push(workerUploadCandidate);
                if (validation.ready) selectedUploadPair = workerUploadCandidate;
              }
            }
          }
        }
        if (!selectedUploadPair) {
          if (temporarySnapshotUploads) {
            temporarySnapshotUploads.destroySphGpuParticleBuffers(
              temporarySnapshotUploads.sphUpload
            );
            temporarySnapshotUploads.destroyMlsMpmGpuParticleBuffers(
              temporarySnapshotUploads.mlsMpmUpload
            );
          }
          return {
            ...checkpointBase,
            status: 'unavailable',
            reason: 'a metadata-coherent retained state/thermo/mechanics upload pair is unavailable',
            workerSnapshotStatus: workerSnapshotStatus ? {
              status: workerSnapshotStatus.status ?? null,
              reason: workerSnapshotStatus.reason ?? null,
              cacheKey: workerSnapshotStatus.cacheKey ?? null,
              sourceStageId: workerSnapshotStatus.sourceStageId ?? null,
              portableSnapshotAvailable:
                workerSnapshotStatus.portableSnapshotAvailable ?? null,
              workerLineageMetadata:
                workerSnapshotStatus.workerLineageMetadata
                  ? { ...workerSnapshotStatus.workerLineageMetadata }
                  : null
            } : null,
            uploadPairCandidates: evaluatedUploadCandidates.map((candidate) => ({
              source: candidate.source,
              status: candidate.validation.status,
              blockers: [...candidate.validation.blockers],
              sourceStep: candidate.validation.sourceStep,
              sourceTimeS: candidate.validation.sourceTimeS
            }))
          };
        }

        const {
          source: uploadSource,
          sphParticleUpload,
          mlsMpmParticleUpload,
          validation: uploadPairValidation
        } = selectedUploadPair;
        const stateBuffer = sphParticleUpload.stateBuffer;
        const thermoBuffer = sphParticleUpload.thermoBuffer;
        const mechanicsBuffer = mlsMpmParticleUpload.mechanicsBuffer;
        const stateStrideBytes = uploadPairValidation.stateStrideBytes;
        const thermoStrideBytes = uploadPairValidation.thermoStrideBytes;
        const mechanicsStrideBytes = uploadPairValidation.mechanicsStrideBytes;
        const stateCapacity = Math.floor(Number(stateBuffer.size) / stateStrideBytes);
        const thermoCapacity = Math.floor(Number(thermoBuffer.size) / thermoStrideBytes);
        const mechanicsCapacity = Math.floor(Number(mechanicsBuffer.size) / mechanicsStrideBytes);
        const bufferParticleCapacity = Math.min(stateCapacity, thermoCapacity, mechanicsCapacity);
        const particleCount = uploadPairValidation.particleCount;
        if (!(particleCount > 0)) {
          if (temporarySnapshotUploads) {
            temporarySnapshotUploads.destroySphGpuParticleBuffers(
              temporarySnapshotUploads.sphUpload
            );
            temporarySnapshotUploads.destroyMlsMpmGpuParticleBuffers(
              temporarySnapshotUploads.mlsMpmUpload
            );
          }
          return {
            ...checkpointBase,
            status: 'unavailable',
            reason: 'retained resident particle count is empty or invalid',
            uploadSource,
            bufferParticleCapacity
          };
        }

        const stateInputByteLength = particleCount * stateStrideBytes;
        const thermoInputByteLength = particleCount * thermoStrideBytes;
        const mechanicsInputByteLength = particleCount * mechanicsStrideBytes;
        try {
          const viewState = overlay.__sphPhaseViewState || null;
          const materialKeyById =
            checkpointModule.materialKeyByIdFromSphViewState(viewState);
          const reduction = await checkpointModule.reduceAuthoritativeGpuMaterialPhaseEvidence({
            device,
            stateBuffer,
            thermoBuffer,
            mechanicsBuffer,
            particleCount,
            stateStrideBytes,
            thermoStrideBytes,
            mechanicsStrideBytes,
            materialKeyById,
            label: `ulg-sph-authoritative-checkpoint-${batchIndex}`
          });
          const cohortModule =
            await loadAuthoritativeGeneratedGasCohortModule();
          if (!authoritativeGeneratedGasCohortTracker) {
            authoritativeGeneratedGasCohortTracker =
              requestedGeneratedGasTargetMaterial
                ? cohortModule.createAuthoritativeGeneratedGasCohortTracker({
                    targetMaterial: requestedGeneratedGasTargetMaterial,
                    minimumMassKg: requestedGeneratedGasMinimumMassKg,
                    minimumMassFractionOfSystem:
                      requestedGeneratedGasMinimumMassFractionOfSystem
                  })
                : null;
          }
          const generatedGasCohortCapture = authoritativeGeneratedGasCohortTracker
            ? await authoritativeGeneratedGasCohortTracker.capture({
              device,
              stateBuffer,
              thermoBuffer,
              particleCount,
              stateStrideBytes,
              thermoStrideBytes,
              sphPhaseCarrierPlan:
                sphParticleUpload.phaseCarrierPlan
                ?? currentSteps?.nextSphParticleState?.phaseCarrierPlan
                ?? currentStep?.nextSphParticleState?.phaseCarrierPlan
                ?? viewState?.sphGpuParticleState?.phaseCarrierPlan
                ?? null,
              mechanicsPhaseCarrierPlan:
                mlsMpmParticleUpload.phaseCarrierPlan
                ?? currentSteps?.nextMlsMpmParticleState?.phaseCarrierPlan
                ?? currentStep?.nextMlsMpmParticleState?.phaseCarrierPlan
                ?? viewState?.mlsMpmGpuParticleState?.phaseCarrierPlan
                ?? null,
              sharedSlotIdentityVerified:
                uploadPairValidation.sharedSlotIdentityVerified,
              sourceStep: uploadPairValidation.sourceStep,
              sourceTimeS: uploadPairValidation.sourceTimeS,
              topologyEpoch:
                sphParticleUpload.topologyEpoch
                ?? currentSteps?.nextSphParticleState?.topologyEpoch
                ?? currentStep?.nextSphParticleState?.topologyEpoch
                ?? null,
              identityRevision:
                sphParticleUpload.identityRevision
                ?? currentSteps?.nextSphParticleState?.identityRevision
                ?? currentStep?.nextSphParticleState?.identityRevision
                ?? null,
              checkpointIndex: sampleIndex,
              materialPhaseReduction: reduction,
              materialKeyById
            })
            : {
                schema:
                  'peercompute.ulg.sph-authoritative-generated-gas-cohort-capture.v0',
                status: 'disabled',
                reason: 'no generated-gas target material was requested',
                cohorts: []
              };
          return {
            ...checkpointBase,
            source: selectedUploadPair.snapshotStatus
              ? 'worker-retained-terminal-compact-snapshot'
              : checkpointBase.source,
            authority: selectedUploadPair.snapshotStatus
              ? 'worker-terminal-fence-and-state-manager-commit'
              : checkpointBase.authority,
            uploadSource,
            sourceStep: uploadPairValidation.sourceStep,
            sourceTimeS: uploadPairValidation.sourceTimeS,
            uploadPairCoherenceStatus: uploadPairValidation.status,
            uploadPairMetadataCoherent: uploadPairValidation.metadataCoherenceVerified,
            uploadPairSharedSlotIdentityVerified:
              uploadPairValidation.sharedSlotIdentityVerified,
            uploadPairCoherenceLevel: uploadPairValidation.coherenceLevel,
            timeZeroProvenanceVerified: phase === 'initial'
              ? uploadPairValidation.timeZeroProvenanceVerified
              : null,
            sourceBufferLabels: {
              state: stateBuffer.label || null,
              thermo: thermoBuffer.label || null,
              mechanics: mechanicsBuffer.label || null
            },
            workerSnapshotProvenance: selectedUploadPair.snapshotStatus ? {
              status: selectedUploadPair.snapshotStatus.status ?? null,
              cacheKey: selectedUploadPair.snapshotStatus.cacheKey ?? null,
              laneId: selectedUploadPair.snapshotStatus.laneId ?? null,
              stateKey: selectedUploadPair.snapshotStatus.stateKey ?? null,
              sourceStageId:
                selectedUploadPair.snapshotStatus.sourceStageId ?? null,
              readbackByteLength:
                selectedUploadPair.snapshotStatus.readbackByteLength ?? null,
              workerLineageMetadata:
                selectedUploadPair.snapshotStatus.workerLineageMetadata
                  ? {
                      ...selectedUploadPair.snapshotStatus
                        .workerLineageMetadata
                    }
                  : null
            } : null,
            retainedInput: {
              stateByteLength: stateInputByteLength,
              thermoByteLength: thermoInputByteLength,
              mechanicsByteLength: mechanicsInputByteLength,
              totalByteLength:
                stateInputByteLength + thermoInputByteLength + mechanicsInputByteLength,
              mappedByteLength:
                selectedUploadPair.snapshotStatus?.readbackByteLength ?? 0
            },
            ...reduction,
            generatedGasCohortCapture,
            generatedGasCohorts: generatedGasCohortCapture.cohorts
          };
        } catch (error) {
          return {
            ...checkpointBase,
            status: 'error',
            reason: error instanceof Error ? error.message : String(error),
            uploadSource,
            particleCount,
            retainedInput: {
              stateByteLength: stateInputByteLength,
              thermoByteLength: thermoInputByteLength,
              mechanicsByteLength: mechanicsInputByteLength,
              totalByteLength:
                stateInputByteLength + thermoInputByteLength + mechanicsInputByteLength,
              mappedByteLength: 0
            }
          };
        } finally {
          if (temporarySnapshotUploads) {
            temporarySnapshotUploads.destroySphGpuParticleBuffers(
              temporarySnapshotUploads.sphUpload
            );
            temporarySnapshotUploads.destroyMlsMpmGpuParticleBuffers(
              temporarySnapshotUploads.mlsMpmUpload
            );
          }
        }
      };
      const nativeSurfaceValidationSnapshot = () => {
        const renderState = sceneApi.getSphResidentRenderState?.() || overlay.__sphResidentRenderState || null;
        const surfaceDraw = sceneApi.getSphResidentSurfaceDraw?.() || overlay.__sphResidentSurfaceDraw || null;
        const bridge = sceneApi.getSphResidentSurfaceDrawRenderBridge?.() || null;
        const candidateValidationScheduler =
          sceneApi.scene?.userData?.sphNativeSurfaceCandidateValidationScheduler
          ?? null;
        const candidateValidationSchedulerActiveCount = Math.max(
          0,
          Number(candidateValidationScheduler?.activeCount) || 0
        );
        const candidateValidationSchedulerQueuedCount = Math.max(
          0,
          Number(candidateValidationScheduler?.queuedCount) || 0
        );
        const candidateValidationPending = Boolean(
          candidateValidationSchedulerActiveCount > 0
          || candidateValidationSchedulerQueuedCount > 0
        );
        // `surfaceDraw` is published after the refresh snapshot. Prefer it so
        // native-validation telemetry describes the current GPU handoff rather
        // than the pre-publication renderState snapshot.
        const bridgeMode = surfaceDraw?.visibleRendererBridge
          ?? renderState?.surfaceDrawVisibleRendererBridge
          ?? bridge?.rendererBridge
          ?? null;
        const native = bridgeMode === 'native-webgpu-surface-consumer'
          || requestedSurfaceDrawDiagnosticMode === 'native-webgpu-surface-consumer';
        if (!native) {
          return {
            native: false,
            ready: false,
            pending: false,
            status: 'native-surface-validation-not-requested'
          };
        }
        // A runtime-admitted prior bridge is deliberately retained while a
        // successor validates. It remains display-owned, but it must never
        // make the direct probe treat the current resident source as admitted.
        const sourceGenerationMatchesCurrent =
          surfaceDraw?.sourceResidentExecutionGenerationMatchesCurrent
          ?? renderState?.surfaceDrawSourceResidentExecutionGenerationMatchesCurrent
          ?? renderState?.sourceResidentExecutionGenerationMatchesCurrent
          ?? null;
        const sourceRetainedPrevious = Boolean(
          surfaceDraw?.sourceResidentRetainedPrevious
          ?? renderState?.surfaceDrawSourceResidentRetainedPrevious
          ?? renderState?.sourceResidentRetainedPrevious
          ?? false
        );
        const sourceMarkedStale = Boolean(
          surfaceDraw?.residentRenderSourceStaleAfterPublish
          ?? renderState?.residentRenderSourceStaleAfterPublish
          ?? false
        );
        const sourceCurrent = Boolean(
          sourceGenerationMatchesCurrent === true
          && !sourceRetainedPrevious
          && !sourceMarkedStale
        );
        const consumerReadyClaim = (
          surfaceDraw?.visibleGpuConsumerReady
          ?? surfaceDraw?.surfaceDrawVisibleGpuConsumerReady
          ?? renderState?.surfaceDrawVisibleGpuConsumerReady
        ) === true;
        const runtimePresentationAdmitted = (
          surfaceDraw?.visibleGpuConsumerRuntimePresentationAdmitted
          ?? surfaceDraw?.surfaceDrawVisibleGpuConsumerRuntimePresentationAdmitted
          ?? renderState?.surfaceDrawVisibleGpuConsumerRuntimePresentationAdmitted
        ) === true;
        const foregroundProofValidated = (
          surfaceDraw?.visibleGpuConsumerForegroundProofValidated
          ?? surfaceDraw?.surfaceDrawVisibleGpuConsumerForegroundProofValidated
          ?? renderState?.surfaceDrawVisibleGpuConsumerForegroundProofValidated
        ) === true;
        const pixelValidationStatus =
          surfaceDraw?.visibleGpuConsumerPixelValidationStatus
          ?? surfaceDraw?.surfaceDrawVisibleGpuConsumerPixelValidationStatus
          ?? renderState?.surfaceDrawVisibleGpuConsumerPixelValidationStatus
          ?? bridge?.pixelValidationStatus
          ?? null;
        const pixelValidationReason =
          surfaceDraw?.renderBridgePixelValidationReason
          ?? renderState?.surfaceDrawRenderBridgePixelValidationReason
          ?? bridge?.pixelValidationReason
          ?? null;
        const readbackSmokeValidationStatus =
          surfaceDraw?.visibleGpuConsumerNativeReadbackSmokeValidationStatus
          ?? surfaceDraw?.surfaceDrawVisibleGpuConsumerNativeReadbackSmokeValidationStatus
          ?? surfaceDraw?.renderBridgeReadbackSmokeValidationStatus
          ?? renderState?.surfaceDrawVisibleGpuConsumerNativeReadbackSmokeValidationStatus
          ?? renderState?.surfaceDrawRenderBridgeReadbackSmokeValidationStatus
          ?? bridge?.readbackSmokeValidationStatus
          ?? null;
        const readbackSmokeValidationReason =
          surfaceDraw?.renderBridgeReadbackSmokeValidationReason
          ?? renderState?.surfaceDrawRenderBridgeReadbackSmokeValidationReason
          ?? bridge?.readbackSmokeValidationReason
          ?? null;
        const offscreenValidationStatus =
          surfaceDraw?.visibleGpuConsumerNativeOffscreenValidationStatus
          ?? surfaceDraw?.surfaceDrawVisibleGpuConsumerNativeOffscreenValidationStatus
          ?? surfaceDraw?.renderBridgeOffscreenValidationStatus
          ?? renderState?.surfaceDrawVisibleGpuConsumerNativeOffscreenValidationStatus
          ?? renderState?.surfaceDrawRenderBridgeOffscreenValidationStatus
          ?? bridge?.offscreenValidationStatus
          ?? null;
        const offscreenValidationReason =
          surfaceDraw?.renderBridgeOffscreenValidationReason
          ?? renderState?.surfaceDrawRenderBridgeOffscreenValidationReason
          ?? bridge?.offscreenValidationReason
          ?? null;
        const validationBlockerFamily =
          surfaceDraw?.visibleGpuConsumerNativeValidationBlockerFamily
          ?? renderState?.surfaceDrawVisibleGpuConsumerNativeValidationBlockerFamily
          ?? null;
        const textureReadbackUnavailable =
          surfaceDraw?.visibleGpuConsumerNativeTextureReadbackUnavailable
          ?? renderState?.surfaceDrawVisibleGpuConsumerNativeTextureReadbackUnavailable
          ?? null;
        const deviceMapSmokeStatus =
          surfaceDraw?.visibleGpuConsumerNativeDeviceMapSmokeStatus
          ?? renderState?.surfaceDrawVisibleGpuConsumerNativeDeviceMapSmokeStatus
          ?? null;
        const deviceTextureReadbackSmokeStatus =
          surfaceDraw?.visibleGpuConsumerNativeDeviceTextureReadbackSmokeStatus
          ?? renderState?.surfaceDrawVisibleGpuConsumerNativeDeviceTextureReadbackSmokeStatus
          ?? null;
        const deviceTextureReadbackSmokeReason =
          surfaceDraw?.visibleGpuConsumerNativeDeviceTextureReadbackSmokeReason
          ?? renderState?.surfaceDrawVisibleGpuConsumerNativeDeviceTextureReadbackSmokeReason
          ?? null;
        const sameDeviceMainThreadImportSelected =
          surfaceDraw?.visibleGpuConsumerSameDeviceMainThreadImportSelected
          ?? surfaceDraw?.surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportSelected
          ?? renderState?.surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportSelected
          ?? null;
        const sameDeviceMainThreadImportRoute =
          surfaceDraw?.visibleGpuConsumerSameDeviceMainThreadImportRoute
          ?? surfaceDraw?.surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportRoute
          ?? renderState?.surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportRoute
          ?? null;
        const sameDeviceMainThreadImportThread =
          surfaceDraw?.visibleGpuConsumerSameDeviceMainThreadImportThread
          ?? surfaceDraw?.surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportThread
          ?? renderState?.surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportThread
          ?? null;
        const sameDeviceMainThreadImportDeviceScope =
          surfaceDraw?.visibleGpuConsumerSameDeviceMainThreadImportDeviceScope
          ?? surfaceDraw?.surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportDeviceScope
          ?? renderState?.surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportDeviceScope
          ?? null;
        const sameDeviceMainThreadImportStatus =
          surfaceDraw?.visibleGpuConsumerSameDeviceMainThreadImportStatus
          ?? surfaceDraw?.surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportStatus
          ?? renderState?.surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportStatus
          ?? null;
        const validationScope =
          surfaceDraw?.renderBridgeNativeSurfaceValidationScope
          ?? surfaceDraw?.surfaceDrawRenderBridgeNativeSurfaceValidationScope
          ?? renderState?.surfaceDrawRenderBridgeNativeSurfaceValidationScope
          ?? bridge?.nativeSurfaceValidationScope
          ?? null;
        const offscreenValidationEligible =
          surfaceDraw?.renderBridgeNativeSurfaceOffscreenValidationEligible
          ?? surfaceDraw?.surfaceDrawRenderBridgeNativeSurfaceOffscreenValidationEligible
          ?? renderState?.surfaceDrawRenderBridgeNativeSurfaceOffscreenValidationEligible
          ?? bridge?.nativeSurfaceOffscreenValidationEligible
          ?? null;
        const offscreenValidationSkippedReason =
          surfaceDraw?.renderBridgeNativeSurfaceOffscreenValidationSkippedReason
          ?? surfaceDraw?.surfaceDrawRenderBridgeNativeSurfaceOffscreenValidationSkippedReason
          ?? renderState?.surfaceDrawRenderBridgeNativeSurfaceOffscreenValidationSkippedReason
          ?? bridge?.nativeSurfaceOffscreenValidationSkippedReason
          ?? null;
        const frameCount = Number(
          surfaceDraw?.renderBridgeFrameCount
          ?? renderState?.surfaceDrawRenderBridgeFrameCount
          ?? bridge?.frameCount
          ?? 0
        ) || 0;
        const gpuBufferHandoffReady = Boolean(
          surfaceDraw?.gpuBufferHandoffReady
          ?? renderState?.surfaceDrawGpuBufferHandoffReady
        );
        const gpuBufferHandoffStatus =
          surfaceDraw?.gpuBufferHandoffStatus
          ?? renderState?.surfaceDrawGpuBufferHandoffStatus
          ?? null;
        const gpuBufferHandoffReason =
          surfaceDraw?.gpuBufferHandoffReason
          ?? renderState?.surfaceDrawGpuBufferHandoffReason
          ?? null;
        const renderBridgeStatus =
          surfaceDraw?.renderBridgeStatus
          ?? renderState?.surfaceDrawRenderBridgeStatus
          ?? bridge?.status
          ?? null;
        const renderBridgeLastRenderStatus =
          surfaceDraw?.renderBridgeLastRenderStatus
          ?? renderState?.surfaceDrawRenderBridgeLastRenderStatus
          ?? bridge?.lastRenderStatus
          ?? null;
        const pending = Boolean(
          candidateValidationPending
          || [pixelValidationStatus, readbackSmokeValidationStatus, offscreenValidationStatus]
            .some((status) => status === 'pending')
        );
        const admitted = Boolean(
          sourceCurrent
          && consumerReadyClaim
          && gpuBufferHandoffReady
          && runtimePresentationAdmitted
        );
        const foregroundProved = Boolean(
          admitted
          && foregroundProofValidated
        );
        // `ready` is retained as a compatibility alias for presentation
        // admission. Pixel validation may remain pending without stalling the
        // GPU-resident hot loop.
        const ready = admitted;
        return {
          native: true,
          ready,
          admitted,
          foregroundProved,
          runtimePresentationAdmitted,
          foregroundProofValidated,
          pending,
          sourceGenerationMatchesCurrent,
          sourceRetainedPrevious,
          sourceMarkedStale,
          sourceCurrent,
          status: ready
            ? 'native-surface-presentation-admitted'
            : (
              candidateValidationPending
                ? 'native-surface-presentation-admission-pending'
                : 'native-surface-presentation-not-admitted'
            ),
          foregroundStatus: foregroundProved
            ? 'native-surface-foreground-proved'
            : (pending
              ? 'native-surface-foreground-proof-pending'
              : 'native-surface-foreground-not-proved'),
          bridgeMode,
          renderBridgeStatus,
          renderBridgeLastRenderStatus,
          gpuBufferHandoffReady,
          gpuBufferHandoffStatus,
          gpuBufferHandoffReason,
          pixelValidationStatus,
          pixelValidationReason,
          readbackSmokeValidationStatus,
          readbackSmokeValidationReason,
          offscreenValidationStatus,
          offscreenValidationReason,
          validationBlockerFamily,
          textureReadbackUnavailable,
          deviceMapSmokeStatus,
          deviceTextureReadbackSmokeStatus,
          deviceTextureReadbackSmokeReason,
          sameDeviceMainThreadImportSelected,
          sameDeviceMainThreadImportRoute,
          sameDeviceMainThreadImportThread,
          sameDeviceMainThreadImportDeviceScope,
          sameDeviceMainThreadImportStatus,
          validationScope,
          offscreenValidationEligible,
          offscreenValidationSkippedReason,
          frameCount,
          candidateValidationSchedulerStatus:
            candidateValidationScheduler?.status ?? null,
          candidateValidationSchedulerReason:
            candidateValidationScheduler?.reason ?? null,
          candidateValidationSchedulerLatestToken:
            candidateValidationScheduler?.latestToken ?? null,
          candidateValidationSchedulerActiveToken:
            candidateValidationScheduler?.activeToken ?? null,
          candidateValidationSchedulerQueuedLatestToken:
            candidateValidationScheduler?.queuedLatestToken ?? null,
          candidateValidationSchedulerActiveCount,
          candidateValidationSchedulerQueuedCount
        };
      };
      const waitForNativeSurfaceValidation = async (batchIndex) => {
        const timeout = Math.max(0, Number(requestedNativeSurfaceValidationWaitMs) || 0);
        let snapshot = nativeSurfaceValidationSnapshot();
        if (!snapshot.native || timeout <= 0 || snapshot.ready) return snapshot;
        const started = performance.now();
        markProbeProgress('native-surface-validation-wait-started', {
          batchIndex,
          timeoutMs: timeout,
          ...snapshot
        });
        while ((performance.now() - started) < timeout) {
          await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
          overlay.__sphResidentRenderState =
            sceneApi.getSphResidentRenderState?.() || overlay.__sphResidentRenderState;
          overlay.__sphResidentSurfaceDraw =
            sceneApi.getSphResidentSurfaceDraw?.() || overlay.__sphResidentSurfaceDraw;
          snapshot = nativeSurfaceValidationSnapshot();
          if (snapshot.ready) break;
        }
        markProbeProgress('native-surface-validation-wait-completed', {
          batchIndex,
          elapsedMs: performance.now() - started,
          ...snapshot
        });
        return snapshot;
      };
      const workerOffscreenViewportSnapshot = () => {
        overlay.__sphResidentRenderState =
          sceneApi.getSphResidentRenderState?.() || overlay.__sphResidentRenderState;
        const presentation = sceneApi.getWorkerOffscreenPresentation?.() || null;
        const workerRows = presentation?.workerOffscreenRenderRows
          || overlay.__sphResidentRenderState?.workerOffscreenRenderRows
          || null;
        return {
          status: workerRows?.status
            ?? overlay.__sphResidentRenderState?.workerOffscreenRenderRowsStatus
            ?? null,
          displayHandoff: workerRows?.displayHandoff
            ?? overlay.__sphResidentRenderState?.workerOffscreenRenderRowsDisplayHandoff
            ?? presentation?.displayHandoff
            ?? null,
          frameCopyBackRejected: workerRows?.frameCopyBackRejected
            ?? overlay.__sphResidentRenderState?.workerOffscreenRenderRowsFrameCopyBackRejected
            ?? presentation?.frameCopyBackRejected
            ?? null,
          workerReady: workerRows?.workerReady
            ?? overlay.__sphResidentRenderState?.workerOffscreenRenderRowsWorkerReady
            ?? presentation?.workerReady
            ?? null,
          contextStatus: workerRows?.contextStatus
            ?? overlay.__sphResidentRenderState?.workerOffscreenRenderRowsContextStatus
            ?? presentation?.contextStatus
            ?? null,
          frameCount: Number(
            workerRows?.frameCount
            ?? overlay.__sphResidentRenderState?.workerOffscreenRenderRowsFrameCount
            ?? presentation?.frameCount
            ?? 0
          ) || 0,
          readyFrameCount: Number(
            workerRows?.readyFrameCount
            ?? overlay.__sphResidentRenderState?.workerOffscreenRenderRowsReadyFrameCount
            ?? presentation?.readyFrameCount
            ?? 0
          ) || 0
        };
      };
      const workerOffscreenViewportPresented = (snapshot = workerOffscreenViewportSnapshot()) => (
        snapshot.status === 'worker-offscreen-resident-particle-state-producer-rendered'
        && snapshot.displayHandoff === 'transferControlToOffscreen'
        && snapshot.frameCopyBackRejected === true
        && snapshot.workerReady === true
        && snapshot.contextStatus === 'webgpu-context-ready'
        && snapshot.readyFrameCount > 0
      );
      const shouldRunAnomalyRowReadback = (metric) => {
        if (!requestedAnomalyRowReadback) return false;
        if (!sceneApi?.refreshSphResidentRenderState) return false;
        if (metric?.renderState?.renderRowsReadback !== false) return false;
        if (metric?.renderState?.source !== 'resident-gpu-render-field') return false;
        const particleCount = metric?.residentStep?.diagnostics?.particleCount ?? 0;
        if (!(particleCount > 0)) return false;
        return (metric?.surfaces?.visibleCount ?? 0) === 0;
      };
      const compactWorkerCapability = (source) => source ? {
        schema: source.workerCapabilitySchema ?? null,
        status: source.workerCapabilityStatus ?? null,
        blocker: source.workerCapabilityBlocker ?? null,
        constructorAvailable: source.workerConstructorAvailable ?? null,
        requestedEnableWorkers: source.workerRequestedEnableWorkers ?? null,
        effectiveEnableWorkers: source.workerEffectiveEnableWorkers ?? null,
        workerCount: source.workerCount ?? null,
        targetWorkers: source.workerTargetWorkers ?? null
      } : null;
      const compactResidentAuthorityHost = (host) => host ? {
        schema: host.schema ?? null,
        status: host.status ?? null,
        source: host.source ?? null,
        hostId: host.hostId ?? null,
        computeManagerReady: host.computeManagerReady ?? null,
        stateManagerReady: host.stateManagerReady ?? null,
        nodeKernelMode: host.nodeKernelMode ?? null,
        nodeKernelReady: host.nodeKernelReady ?? null,
        nodeKernelStarted: host.nodeKernelStarted ?? null,
        nodeKernelNetworkConnected: host.nodeKernelNetworkConnected ?? null,
        nodeKernelNetworkGateStatus: host.nodeKernelNetworkGateStatus ?? null,
        residentSolverRegistrationStatus: host.residentSolverRegistrationStatus ?? null,
        peercomputeResidentStageWorkerBridgeAvailable: host.peercomputeResidentStageWorkerBridgeAvailable ?? null,
        residentMechanicsStageWorkerRunnerFactoryReady: host.residentMechanicsStageWorkerRunnerFactoryReady ?? null,
        workerCapability: compactWorkerCapability(host)
      } : null;
      const compactSchroederSuccessorEpochIdentity = (identity) => (
        identity && typeof identity === 'object'
          ? {
              storageGeneration: identity.storageGeneration ?? null,
              physicsTick: identity.physicsTick ?? null,
              physicsSubstep: identity.physicsSubstep ?? null,
              positionEpoch: identity.positionEpoch ?? null,
              topologyEpoch: identity.topologyEpoch ?? null,
              chartEpoch: identity.chartEpoch ?? null,
              levelEpoch: identity.levelEpoch ?? null,
              supportEpoch: identity.supportEpoch ?? null
            }
          : null
      );
      const compactSchroederSuccessorEpochEvidence = (evidence) => (
        evidence && typeof evidence === 'object'
          ? {
              schema: evidence.schema ?? null,
              status: evidence.status ?? null,
              ready: evidence.ready === true,
              admitted: evidence.admitted === true,
              authenticated: evidence.authenticated === true,
              deviceId: evidence.deviceId ?? null,
              sourceFamily: evidence.sourceFamily ?? null,
              sourceFamilyRole: evidence.sourceFamilyRole ?? null,
              publicationAuthority: evidence.publicationAuthority ?? null,
              exactBufferFamilyAuthenticated:
                evidence.exactBufferFamilyAuthenticated === true,
              storageAllocationAuthenticated:
                evidence.storageAllocationAuthenticated === true,
              topologyTransitionAuthenticated:
                evidence.topologyTransitionAuthenticated === true,
              sourceGenerationId: evidence.sourceGenerationId ?? null,
              ancestorSpatialGenerationId:
                evidence.ancestorSpatialGenerationId ?? null,
              positionAuthority: evidence.positionAuthority ?? null,
              positionEpochFloorAuthenticated:
                evidence.positionEpochFloorAuthenticated === true,
              positionEpochFloor: evidence.positionEpochFloor ?? null,
              positionTransitionAuthenticated:
                evidence.positionTransitionAuthenticated === true,
              positionChanged: evidence.positionChanged === true,
              sourceEpochIdentity: compactSchroederSuccessorEpochIdentity(
                evidence.sourceEpochIdentity
              ),
              successorEpochIdentity: compactSchroederSuccessorEpochIdentity(
                evidence.successorEpochIdentity
              )
            }
          : null
      );
      const compactSchroederSpatialEpochTransaction = (transaction) => transaction ? {
        schema: transaction.schema ?? null,
        status: transaction.status ?? null,
        state: transaction.state ?? null,
        generationId: transaction.generationId ?? null,
        deviceId: transaction.deviceId ?? null,
        epochIdentity: transaction.epochIdentity
          ? { ...transaction.epochIdentity }
          : null,
        requiredReaderIds: [...(transaction.requiredReaderIds || [])],
        admittedReaders: Array.isArray(transaction.admittedReaders)
          ? transaction.admittedReaders.map((reader) => ({ ...reader }))
          : [],
        proposalSeal: transaction.proposalSeal
          ? { ...transaction.proposalSeal }
          : null,
        commitStatus: transaction.commitStatus ?? null,
        nextStateBufferRetained: transaction.nextStateBufferRetained === true,
        abortReason: transaction.abortReason ?? null,
        releaseFailureReason: transaction.releaseFailureReason ?? null,
        legacyLookupRecords: Array.isArray(transaction.legacyLookupRecords)
          ? transaction.legacyLookupRecords.map((record) => ({ ...record }))
          : [],
        counters: transaction.counters
          ? { ...transaction.counters }
          : null,
        successorEpochEvidence: compactSchroederSuccessorEpochEvidence(
          transaction.successorEpochEvidence
        )
      } : null;
      const compactPhaseVolumeSurfaceStressSubmission = (submission) => (
        submission && typeof submission === 'object'
          ? {
              schema: submission.schema ?? null,
              status: submission.status ?? null,
              requested: submission.requested === true,
              submitted: submission.submitted === true,
              dispatchCount: finiteOrNull(submission.dispatchCount),
              entryPoints: Array.isArray(submission.entryPoints)
                ? [...submission.entryPoints]
                : [],
              lifecycleDispatchCount:
                finiteOrNull(submission.lifecycleDispatchCount),
              lifecycleMode: submission.lifecycleMode ?? null,
              ambientBuoyancyMode: submission.ambientBuoyancyMode ?? null,
              generationId: submission.generationId ?? null,
              selectedLevel: finiteOrNull(submission.selectedLevel),
              levelRole: submission.levelRole ?? null,
              twoLevel: submission.twoLevel === true,
              fieldCompletionOrdinal:
                finiteOrNull(submission.fieldCompletionOrdinal),
              materialTableSchema: submission.materialTableSchema ?? null,
              phaseRecordCount: finiteOrNull(submission.phaseRecordCount),
              positiveSurfaceTensionPhaseRecordCount: finiteOrNull(
                submission.positiveSurfaceTensionPhaseRecordCount
              ),
              surfaceTensionCoefficientStatus:
                submission.surfaceTensionCoefficientStatus ?? null,
              authority: submission.authority ?? null,
              verification: submission.verification ?? null
            }
          : null
      );
      const compactSchroederTelemetry = ({
        steps = null,
        residentStep = null,
        renderState = null,
        surfaceDraw = null,
        sceneUserData = {},
        overlayRef = null
      } = {}) => {
        const config = overlayRef?.__sphSchroederSimulationConfig || null;
        const options = overlayRef?.__mlsMpmSchroederExecutionOptions || null;
        const mechanics = steps?.schroederSameLevelMechanics
          || residentStep?.schroederSameLevelMechanics
          || null;
        const portableSummary = steps?.portableSummary
          || residentStep?.portableSummary
          || mechanics?.portableSummary
          || null;
        const renderLod = portableSummary?.renderLod
          || steps?.renderLod
          || mechanics?.renderLod
          || null;
        const renderSource = sceneUserData.schroederRenderSource || null;
        const drawSource = sceneUserData.schroederRenderProxyDrawSource || null;
        const backendSelection = sceneUserData.schroederRenderProxyBackendSelection || null;
        const localRetained = steps?.schroederLocalRetainedRenderBuffers
          || steps?.localRetainedRenderBuffers
          || null;
        const adoptedStoragePublication =
          steps?.schroederAdoptedParticleStoragePublication
          || residentStep?.schroederAdoptedParticleStoragePublication
          || sceneUserData.mlsMpmResidentSchroederAdoptedParticleStoragePublication
          || sceneUserData.schroederAdoptedParticleStoragePublication
          || null;
        const workerTwoLevelEvidence =
          steps?.workerOwnedResidentLane?.twoLevelMechanics
          ?? steps?.twoLevelMechanicsWorkerEvidence
          ?? steps?.workerOwnedResidentLane?.perStepSummaries
            ?.twoLevelMechanics
          ?? null;
        const workerSurfaceStressEvidence =
          steps?.workerOwnedResidentLane?.phaseVolumeSurfaceStress
          ?? steps?.phaseVolumeSurfaceStressWorkerEvidence
          ?? steps?.workerOwnedResidentLane?.perStepSummaries
            ?.phaseVolumeSurfaceStress
          ?? null;
        const finalResidentStep = residentStep || steps?.finalStep || null;
        const finalTwoLevelResidentStep = finalResidentStep
          || workerTwoLevelEvidence?.lastStep
          || null;
        const twoLevelStepSummaries = Array.isArray(steps?.stepSummaries)
          ? steps.stepSummaries
          : [];
        const twoLevelAuthoritativeStepCount = workerTwoLevelEvidence
          ? Number(workerTwoLevelEvidence.exactAuthoritativeStepCount) || 0
          : twoLevelStepSummaries.filter(
              (summary) => (
                summary?.status
                  === 'schroeder-two-level-authoritative-step-executed'
              )
            ).length;
        const twoLevelMechanicsRequested = Boolean(
          config?.enableTwoLevelMechanics
          || options?.schroederEnableTwoLevelMechanics
        );
        const twoLevelMechanicsAuthorityRequested = String(
          options?.schroederTwoLevelMechanicsAuthority
            ?? config?.twoLevelMechanicsAuthority
            ?? 'observation'
        ).trim().toLowerCase() === 'authoritative'
          ? 'authoritative'
          : 'observation';
        const reportedTwoLevelAuthority =
          finalTwoLevelResidentStep?.twoLevelMechanicsAuthority
          ?? null;
        const twoLevelMechanicsAuthorityObserved =
          reportedTwoLevelAuthority === 'authoritative'
          || reportedTwoLevelAuthority
            === 'two-level-authoritative-resident-mechanics-replaced'
            ? 'authoritative'
            : (reportedTwoLevelAuthority ?? null);
        const twoLevelFineSubstepCountRequested = finiteOrNull(
          options?.schroederTwoLevelFineSubstepCount
            ?? config?.twoLevelFineSubstepCount
        );
        const twoLevelFineSubstepCountObserved = finiteOrNull(
          finalTwoLevelResidentStep?.twoLevelFineSubstepCount
        );
        const twoLevelMechanicsStepStatus =
          finalTwoLevelResidentStep?.status ?? null;
        const twoLevelMechanicsActive = Boolean(
          twoLevelMechanicsStepStatus
            === 'schroeder-two-level-authoritative-step-executed'
          && twoLevelAuthoritativeStepCount > 0
        );
        const twoLevelMechanicsCoverageComplete = workerTwoLevelEvidence
          ? Boolean(
              workerTwoLevelEvidence.coverageComplete === true
              && workerTwoLevelEvidence.requested === true
              && workerTwoLevelEvidence.authorityRequested === 'authoritative'
              && Number(workerTwoLevelEvidence.observedStepCount)
                === Number(steps?.completedStepCount)
              && Number(workerTwoLevelEvidence.exactAuthoritativeStepCount)
                === Number(steps?.completedStepCount)
              && twoLevelMechanicsAuthorityObserved === 'authoritative'
              && twoLevelMechanicsActive
              && twoLevelFineSubstepCountObserved
                === twoLevelFineSubstepCountRequested
              && finalTwoLevelResidentStep
                ?.twoLevelAuthoritativeCommitVerified === true
            )
          : Boolean(
              twoLevelMechanicsRequested
              && twoLevelMechanicsAuthorityRequested === 'authoritative'
              && twoLevelMechanicsAuthorityObserved === 'authoritative'
              && twoLevelMechanicsActive
              && Number.isInteger(Number(steps?.completedStepCount))
              && Number(steps.completedStepCount) > 0
              && twoLevelAuthoritativeStepCount
                === Number(steps.completedStepCount)
              && twoLevelFineSubstepCountObserved
                === twoLevelFineSubstepCountRequested
              && finalResidentStep
                ?.twoLevelAuthoritativeCommitVerified === true
            );
        const stageWorkerLane = overlayRef?.__sphMountedMechanicsStageWorkerLane || null;
        const requested = Boolean(config?.enabled || options?.schroederSimulation);
        const active = Boolean(steps?.schroederSimulation || residentStep?.schroederSimulation);
        if (
          !requested
          && !active
          && !renderSource
          && !drawSource
          && !backendSelection
          && !adoptedStoragePublication
        ) return null;
        return {
          schema: 'peercompute.ulg.sph-probe-schroeder-telemetry.v0',
          requested,
          active,
          configSource: config?.source ?? null,
          selectedLevel: finiteOrNull(
            renderLod?.selectedLevel
            ?? renderSource?.selectedLevel
            ?? mechanics?.selectedLevel
            ?? options?.schroederSelectedLevel
            ?? config?.selectedLevel
          ),
          sequenceStatus:
            steps?.schroederSameLevelSequenceStatus
            || residentStep?.schroederSameLevelSequenceStatus
            || null,
          mechanicsStatus: mechanics?.status ?? null,
          twoLevelMechanicsRequested,
          twoLevelMechanicsAuthorityRequested,
          twoLevelFineSubstepCountRequested,
          twoLevelMechanicsActive,
          twoLevelMechanicsAuthorityObserved,
          twoLevelFineSubstepCountObserved,
          twoLevelMechanicsStepStatus,
          twoLevelMechanicsStatus:
            finalTwoLevelResidentStep?.twoLevelMechanicsStatus
            ?? finalTwoLevelResidentStep?.stageStatus?.twoLevelMechanics
            ?? null,
          twoLevelAuthoritativeCommitVerified:
            finalTwoLevelResidentStep
              ?.twoLevelAuthoritativeCommitVerified === true,
          twoLevelAuthoritativeStepCount,
          twoLevelObservedStepCount:
            workerTwoLevelEvidence?.observedStepCount ?? null,
          twoLevelFirstIncompleteStepOrdinal:
            workerTwoLevelEvidence?.firstIncompleteStepOrdinal ?? null,
          twoLevelMechanicsCoverageComplete,
          phaseVolumeSurfaceStressSubmission:
            compactPhaseVolumeSurfaceStressSubmission(
              finalResidentStep?.gridUpdate
                ?.phaseVolumeSurfaceStressSubmission
              ?? finalResidentStep?.phaseVolumeSurfaceStressSubmission
              ?? workerSurfaceStressEvidence?.finalSubmission
            ),
          residentComputeManagerMode: steps?.residentComputeManagerMode ?? null,
          portableSummaryStatus: portableSummary?.status ?? null,
          renderLodStatus: portableSummary?.renderLodStatus ?? renderLod?.status ?? null,
          nativeGridSpacingM: finiteOrNull(
            renderLod?.nativeGridSpacingM
            ?? renderSource?.nativeGridSpacingM
            ?? mechanics?.mechanicsGridSpacingM
          ),
          activeLeafProxyCount: finiteOrNull(
            renderLod?.activeLeafProxyCount
            ?? renderSource?.activeLeafProxyCount
            ?? drawSource?.activeLeafProxyCount
          ),
          aggregateProxyCount: finiteOrNull(
            renderLod?.aggregateProxyCount
            ?? renderSource?.aggregateProxyCount
            ?? drawSource?.aggregateProxyCount
          ),
          lawQueueProxyCount: finiteOrNull(
            renderLod?.lawQueueProxyCount
            ?? renderSource?.lawQueueProxyCount
            ?? drawSource?.lawQueueProxyCount
          ),
          renderSourceStatus: renderSource?.status ?? null,
          renderSourcePresentationReady: renderSource?.renderLodPresentationReady ?? null,
          drawSourceStatus: drawSource?.status ?? null,
          drawBatchCount: finiteOrNull(drawSource?.drawBatchCount),
          localRetainedResolverStatus:
            localRetained?.status
            ?? renderState?.surfaceDrawRenderBridgeSchroederRenderProxyLocalResolverStatus
            ?? surfaceDraw?.renderBridgeSchroederRenderProxyLocalResolverStatus
            ?? null,
          localRetainedRefCount: finiteOrNull(
            localRetained?.retainedBufferRefs?.length
            ?? renderState?.surfaceDrawRenderBridgeSchroederRenderProxyLocalResolverRetainedBufferRefCount
            ?? surfaceDraw?.renderBridgeSchroederRenderProxyLocalResolverRetainedBufferRefCount
          ),
          adoptedStoragePublicationStatus: adoptedStoragePublication?.status ?? null,
          adoptedStoragePublicationHotBufferKey: adoptedStoragePublication?.hotBufferKey ?? null,
          adoptedStorageDescriptorStatus:
            adoptedStoragePublication?.descriptorStatus
            ?? adoptedStoragePublication?.schroederAdoptedParticleStorageDescriptor?.status
            ?? null,
          adoptedStorageDescriptorReady:
            adoptedStoragePublication?.descriptorReady === true
            || adoptedStoragePublication?.schroederAdoptedParticleStorageDescriptor?.ready === true,
          adoptedStorageLocalResolverStatus:
            adoptedStoragePublication?.schroederAdoptedParticleStorageLocalRetainedBufferResolverStatus ?? null,
          adoptedStorageLocalResolverReady:
            adoptedStoragePublication?.schroederAdoptedParticleStorageLocalRetainedBufferResolverReady === true,
          adoptedStorageLocalResolverResolvedRefCount: finiteOrNull(
            adoptedStoragePublication?.schroederAdoptedParticleStorageLocalRetainedBufferResolvedRefCount
          ),
          adoptedStorageStageScheduleStatus:
            stageWorkerLane?.schroederAdoptedParticleStorageContinuationScheduleStatus ?? null,
          adoptedStorageStageSourceHotBufferKey:
            stageWorkerLane?.schroederAdoptedParticleStorageContinuationSourceHotBufferKey ?? null,
          adoptedStorageStageLocalResolverStatus:
            stageWorkerLane?.schroederAdoptedParticleStorageStageLocalResolverStatus ?? null,
          adoptedStorageStageLocalResolverReady:
            stageWorkerLane?.schroederAdoptedParticleStorageStageLocalResolverReady === true,
          adoptedStorageRawGpuBufferPeerComputeTransfer:
            adoptedStoragePublication?.rawGpuBufferTransferDetected === true
            || stageWorkerLane?.schroederAdoptedParticleStorageRawGpuBufferPeerComputeTransfer === true,
          backendSelectionStatus: backendSelection?.status ?? null,
          backendSelected: backendSelection?.selectedBackend ?? null,
          backendNativeSubmitReady: backendSelection?.nativeSubmitReady ?? null,
          nativeExecutorStatus:
            renderState?.surfaceDrawRenderBridgeSchroederRenderProxyNativeExecutorStatus
            ?? surfaceDraw?.renderBridgeSchroederRenderProxyNativeExecutorStatus
            ?? null,
          nativeExecutorReady:
            renderState?.surfaceDrawRenderBridgeSchroederRenderProxyNativeExecutorReady
            ?? surfaceDraw?.renderBridgeSchroederRenderProxyNativeExecutorReady
            ?? null,
          nativeExecutorDrawCommandCount: finiteOrNull(
            renderState?.surfaceDrawRenderBridgeSchroederRenderProxyNativeExecutorDrawCommandCount
            ?? surfaceDraw?.renderBridgeSchroederRenderProxyNativeExecutorDrawCommandCount
          ),
          nativeLastSubmitStatus:
            renderState?.surfaceDrawRenderBridgeSchroederRenderProxyNativeLastSubmitStatus
            ?? surfaceDraw?.renderBridgeSchroederRenderProxyNativeLastSubmitStatus
            ?? null,
          nativeLastSubmitDrawCommandCount: finiteOrNull(
            renderState?.surfaceDrawRenderBridgeSchroederRenderProxyNativeLastSubmitDrawCommandCount
            ?? surfaceDraw?.renderBridgeSchroederRenderProxyNativeLastSubmitDrawCommandCount
          ),
          renderFieldReadback: renderState?.renderFieldReadback ?? null,
          renderRowsReadback: renderState?.renderRowsReadback ?? null,
          surfaceDrawStatus: surfaceDraw?.status ?? renderState?.surfaceDrawStatus ?? null,
          surfaceDrawBridge:
            surfaceDraw?.visibleRendererBridge
            ?? renderState?.surfaceDrawVisibleRendererBridge
            ?? null
        };
      };
      const sample = (batchIndex, phase, batchMs = null) => {
        const steps = sceneApi.getMlsMpmResidentSteps?.() || overlay.__mlsMpmResidentSteps || execution || null;
        const readbackTelemetry =
          composePageVisibleReadbackTelemetry(steps, steps?.finalStep);
        const residentStep = sceneApi.getMlsMpmResidentStep?.() || overlay.__mlsMpmResidentStep || steps?.finalStep || null;
        const sceneUserData = sceneApi?.scene?.userData || {};
        const renderState = sceneApi.getSphResidentRenderState?.() || overlay.__sphResidentRenderState || null;
        const surfaceDraw = sceneApi.getSphResidentSurfaceDraw?.() || overlay.__sphResidentSurfaceDraw || null;
        const currentSurfaceDrawConsumerValue = (key) => {
          const suffix = key.startsWith('surfaceDraw')
            ? key.slice('surfaceDraw'.length)
            : '';
          const directAlias = suffix
            ? `${suffix[0].toLowerCase()}${suffix.slice(1)}`
            : key;
          for (const [source, sourceKey] of [
            [surfaceDraw, key],
            [surfaceDraw, directAlias],
            [renderState, key]
          ]) {
            if (
              source
              && Object.prototype.hasOwnProperty.call(source, sourceKey)
              && source[sourceKey] !== undefined
            ) {
              return source[sourceKey];
            }
          }
          return null;
        };
        const residentMaterialInterfaceState =
          overlay.__sphResidentMaterialInterfaceState
          || sceneUserData.sphResidentMaterialInterfaceState
          || renderState?.materialInterfaceField
          || null;
        const mechanicsMaterialPhaseUpload = sceneApi.getMlsMpmMechanicsMaterialPhaseUpload?.()
          || sceneUserData.mlsMpmMechanicsMaterialPhaseUpload
          || null;
        const plainSphStepResult = overlay.__sphLastStepResult || null;
        const residentAuthorityHost = overlay.__sphPeerComputeResidentAuthorityHost || null;
        const residentComputeManager = overlay.__sphResidentComputeManager || null;
        const residentStageOrderTrace =
          overlay.__sphResidentStageOrderTrace || sceneUserData.sphResidentStageOrderTrace || null;
        const sceneTimeS = finiteOrNull(
          plainSphStepResult?.time
            ?? residentStep?.particlePingPong?.nextTime
            ?? steps?.nextSphParticleState?.time
            ?? overlay.__sphPhaseViewState?.time
            ?? overlay.__sphDriver?.demo?.state?.time
        );
        return {
          batchIndex,
          phase,
          capturedAtMs: performance.now(),
          pageInstanceId: requestedInteractiveCacheLifecycle
            ? interactivePageInstanceId
            : null,
          cacheResetOrdinal: requestedInteractiveCacheLifecycle
            ? interactiveCacheResetOrdinal
            : null,
          interactiveCacheMeasurementClass:
            requestedInteractiveCacheLifecycle
              ? interactiveCacheMeasurementClass
              : null,
          batchMs,
          sceneTimeS,
          initial: batchIndex === 0 ? {
            preflight: overlay.__sphPhasePreflight || null,
            dropMaterial: overlay.__sphPhaseViewState?.dropMaterial ?? overlay.__sphDriver?.demo?.dropMaterial ?? null,
            baseMaterial: overlay.__sphPhaseViewState?.baseMaterial ?? overlay.__sphDriver?.demo?.baseMaterial ?? null,
            counts: overlay.__sphPhaseViewState?.counts || overlay.__sphDriver?.demo?.counts || null,
            initialParticleEdgeDiagnostics:
              overlay.__sphPhaseViewState?.initialParticleEdgeDiagnostics
              || overlay.__sphDriver?.demo?.initialParticleEdgeDiagnostics
              || null
          } : null,
          residentAuthorityHost: compactResidentAuthorityHost(residentAuthorityHost),
          residentWorkerCapability: compactWorkerCapability(residentAuthorityHost),
          residentComputeManager: residentComputeManager ? {
            schema: residentComputeManager.schema ?? null,
            status: residentComputeManager.status ?? null,
            source: residentComputeManager.source ?? null,
            mode: residentComputeManager.mode ?? null,
            submitTask: residentComputeManager.submitTask ?? null
          } : null,
          residentStageOrderTrace: residentStageOrderTrace ? {
            schema: residentStageOrderTrace.schema ?? null,
            status: residentStageOrderTrace.status ?? null,
            eventCount: residentStageOrderTrace.eventCount ?? null,
            retainedEventCount: residentStageOrderTrace.retainedEventCount ?? null,
            resetGeneration: residentStageOrderTrace.resetGeneration ?? null,
            lastEvent: residentStageOrderTrace.lastEvent || null
          } : null,
        mlsMpmMechanicsMaterialPhaseUpload: mechanicsMaterialPhaseUpload ? {
          schema: mechanicsMaterialPhaseUpload.schema ?? null,
          status: mechanicsMaterialPhaseUpload.status ?? null,
          phaseRecordCount: mechanicsMaterialPhaseUpload.phaseRecordCount ?? null,
          recordsByteLength: mechanicsMaterialPhaseUpload.recordsByteLength ?? null
	        } : null,
	        rendererInit: sceneUserData.sphRendererInit || null,
	        peerComputeRenderOwnershipPolicy:
	          sceneUserData.sphPeerComputeRenderOwnershipPolicy
	          || overlay.__sphPeerComputeRenderOwnershipPolicy
	          || null,
	        workerOffscreenPresentation: sceneUserData.sphWorkerOffscreenPresentation || null,
	        workerLaneNativeSurfacePresentation: (() => {
	          const presentation =
	            overlay.__sphWorkerLaneNativeSurfacePresentation || null;
	          if (!presentation) return null;
	          return {
	            schema: presentation.schema ?? null,
	            status: presentation.status ?? null,
	            scheduleId: presentation.scheduleId ?? null,
	            laneId: presentation.laneId ?? null,
	            stateKey: presentation.stateKey ?? null,
	            requestId: presentation.requestId ?? null,
	            cacheKey: presentation.cacheKey ?? null,
	            sourceStageId: presentation.sourceStageId ?? null,
	            sourceStep: presentation.sourceStep ?? null,
	            sourceTimeS: presentation.sourceTimeS ?? null,
	            particleCount: presentation.particleCount ?? null,
	            readbackScope: presentation.readbackScope ?? null,
	            terminalPresentationFullParticleReadbackPerformed:
	              presentation.terminalPresentationFullParticleReadbackPerformed
	                ?? null,
	            physicsHotLoopParticipation:
	              presentation.physicsHotLoopParticipation ?? null
	          };
	        })(),
	        workerLaneNativeSurfaceSnapshotHandoff: (() => {
	          const handoff = renderState?.residentRenderSource
	            ?.workerLaneNativeSurfaceSnapshotHandoff || null;
	          if (!handoff) return null;
	          return {
	            schema: handoff.schema ?? null,
	            status: handoff.status ?? null,
	            scheduleId: handoff.scheduleId ?? null,
	            laneId: handoff.laneId ?? null,
	            stateKey: handoff.stateKey ?? null,
	            requestId: handoff.requestId ?? null,
	            cacheKey: handoff.cacheKey ?? null,
	            sourceStep: handoff.sourceStep ?? null,
	            sourceTimeS: handoff.sourceTimeS ?? null,
	            sharedSlotIdentityVerified:
	              handoff.sharedSlotIdentityVerified ?? null,
	            workerLineageMetadataStatus:
	              handoff.workerLineageMetadataStatus ?? null,
	            terminalCompactSnapshotReadback:
	              handoff.terminalCompactSnapshotReadback ?? null
	          };
	        })(),
	        workerOffscreenCanvas: (() => {
	          const canvases = [...overlay.querySelectorAll(
	            '#sph-scene canvas[data-ulg-worker-offscreen-presentation]'
	          )];
	          const canvas = canvases[0] || null;
	          if (!canvas) return null;
	          const style = getComputedStyle(canvas);
	          const bounds = canvas.getBoundingClientRect();
	          const isVisible = (candidate) => {
	            const candidateStyle = getComputedStyle(candidate);
	            const candidateBounds = candidate.getBoundingClientRect();
	            return candidateStyle.visibility !== 'hidden'
	              && candidateStyle.display !== 'none'
	              && Number(candidateStyle.opacity) > 0
	              && candidateBounds.width > 0
	              && candidateBounds.height > 0;
	          };
	          return {
	            count: canvases.length,
	            visibleCount: canvases.filter(isVisible).length,
	            visibility: style.visibility,
	            display: style.display,
	            opacity: style.opacity,
	            width: bounds.width,
	            height: bounds.height,
	            visible: style.visibility !== 'hidden'
	              && style.display !== 'none'
	              && Number(style.opacity) > 0
	              && bounds.width > 0
	              && bounds.height > 0
	          };
	        })(),
	        sceneCanvasVisibility: (() => {
	          const canvases = [...overlay.querySelectorAll('#sph-scene canvas')];
	          const workerCanvases = canvases.filter((canvas) => (
	            canvas.hasAttribute('data-ulg-worker-offscreen-presentation')
	          ));
	          const isVisible = (canvas) => {
	            const style = getComputedStyle(canvas);
	            const bounds = canvas.getBoundingClientRect();
	            return style.visibility !== 'hidden'
	              && style.display !== 'none'
	              && Number(style.opacity) > 0
	              && bounds.width > 0
	              && bounds.height > 0;
	          };
	          return {
	            count: canvases.length,
	            visibleCount: canvases.filter(isVisible).length,
	            workerCount: workerCanvases.length,
	            visibleWorkerCount: workerCanvases.filter(isVisible).length
	          };
	        })(),
	        workerOffscreenRenderRows: sceneUserData.sphWorkerOffscreenRenderRows || null,
	        workerOffscreenRetainedGpuBufferHandoff:
	          sceneUserData.sphWorkerOffscreenRetainedGpuBufferHandoff || null,
		        workerOffscreenResidentStage:
		          sceneUserData.sphWorkerOffscreenResidentStage || null,
		        workerOffscreenResidentStageChain:
		          sceneUserData.sphWorkerOffscreenResidentStageChain || null,
		        workerOffscreenResidentStageChainAuto:
		          sceneUserData.sphWorkerOffscreenResidentStageChainAuto || null,
		        workerOffscreenRetainedStatePromotionCandidate:
		          sceneUserData.sphWorkerOffscreenRetainedStatePromotionCandidate || null,
		        workerOffscreenRetainedStatePromotionAdmission:
		          sceneUserData.sphWorkerOffscreenRetainedStatePromotionAdmission || null,
		        workerOffscreenRetainedStateContinuation:
		          sceneUserData.sphWorkerOffscreenRetainedStateContinuation || null,
            workerOffscreenRetainedCompactSnapshot: (() => {
              const status =
                sceneUserData.sphWorkerOffscreenRetainedCompactSnapshot || null;
              if (!status) return null;
              return {
                schema: status.schema ?? null,
                status: status.status ?? null,
                reason: status.reason ?? null,
                laneId: status.laneId ?? null,
                stateKey: status.stateKey ?? null,
                cacheKey: status.cacheKey ?? null,
                sourceStageId: status.sourceStageId ?? null,
                particleCount: status.particleCount ?? null,
                portableSnapshotAvailable:
                  status.portableSnapshotAvailable ?? null,
                crossPeerReplayReady: status.crossPeerReplayReady ?? null,
                readbackByteLength: status.readbackByteLength ?? null,
                sphStateByteLength: status.sphStateByteLength ?? null,
                sphThermoByteLength: status.sphThermoByteLength ?? null,
                mlsMpmMechanicsByteLength:
                  status.mlsMpmMechanicsByteLength ?? null,
                workerLineageMetadata:
                  status.workerLineageMetadata
                    ? { ...status.workerLineageMetadata }
                    : null
              };
            })(),
		        residentWebGpuDeviceMapSmoke: sceneUserData.sphResidentWebGpuDeviceMapSmoke || null,
        residentWebGpuDeviceTextureReadbackSmoke:
          sceneUserData.sphResidentWebGpuDeviceTextureReadbackSmoke || null,
        nativeSurfaceValidation: nativeSurfaceValidationSnapshot(),
        schroederTelemetry: compactSchroederTelemetry({
          steps,
          residentStep,
          renderState,
          surfaceDraw,
          sceneUserData,
          overlayRef: overlay
        }),
        residentRenderProgress: sceneUserData.sphResidentRenderProgress || null,
        residentMaterialInterfaceState: residentMaterialInterfaceState ? {
          schema: residentMaterialInterfaceState.schema ?? null,
          status: residentMaterialInterfaceState.status ?? null,
          reason: residentMaterialInterfaceState.reason ?? null,
          sourceRenderFieldSchema:
            residentMaterialInterfaceState.sourceRenderFieldSchema ?? null,
          sourceRenderFieldStatus:
            residentMaterialInterfaceState.sourceRenderFieldStatus ?? null,
          sourceRenderFieldReadback:
            residentMaterialInterfaceState.sourceRenderFieldReadback ?? null,
          sourceRenderFieldReadbackMode:
            residentMaterialInterfaceState.sourceRenderFieldReadbackMode ?? null,
          interfaceSourceFieldSchema:
            residentMaterialInterfaceState.interfaceSourceFieldSchema
            ?? residentMaterialInterfaceState.sourceFieldSchema
            ?? null,
          interfaceSourceFieldStatus:
            residentMaterialInterfaceState.interfaceSourceFieldStatus
            ?? residentMaterialInterfaceState.sourceFieldStatus
            ?? null,
          interfaceSourceFieldBackend:
            residentMaterialInterfaceState.interfaceSourceFieldBackend
            ?? residentMaterialInterfaceState.sourceFieldBackend
            ?? null,
          interfaceSourceFieldKernelScope:
            residentMaterialInterfaceState.interfaceSourceFieldKernelScope ?? null,
          interfaceSourceFieldSourceLocal:
            residentMaterialInterfaceState.interfaceSourceFieldSourceLocal ?? null,
          interfaceSourceFieldSourceLocalSourceCount: finiteOrNull(
            residentMaterialInterfaceState.interfaceSourceFieldSourceLocalSourceCount
          ),
          interfaceSourceFieldSourceLocalEstimatedCellVisits: finiteOrNull(
            residentMaterialInterfaceState.interfaceSourceFieldSourceLocalEstimatedCellVisits
          ),
          interfaceSourceFieldDenseCellParticlePairs: finiteOrNull(
            residentMaterialInterfaceState.interfaceSourceFieldDenseCellParticlePairs
          ),
          interfaceSourceFieldSourceLocalEstimatedVisitRatio: finiteOrNull(
            residentMaterialInterfaceState.interfaceSourceFieldSourceLocalEstimatedVisitRatio
          ),
          interfaceSourceFieldSourceLocalDensityScale: finiteOrNull(
            residentMaterialInterfaceState.interfaceSourceFieldSourceLocalDensityScale
          ),
          interfaceSourceFieldQueueCompletionStatus:
            residentMaterialInterfaceState.interfaceSourceFieldQueueCompletionStatus ?? null,
          interfaceSourceFieldQueueCompletionMethod:
            residentMaterialInterfaceState.interfaceSourceFieldQueueCompletionMethod ?? null,
          interfaceSourceFieldRowsBufferBorrowed:
            residentMaterialInterfaceState.interfaceSourceFieldRowsBufferBorrowed ?? null,
          interfaceSourceFieldRowsBufferReused:
            residentMaterialInterfaceState.interfaceSourceFieldRowsBufferReused ?? null,
          sourceFieldPipelineCacheStatus:
            residentMaterialInterfaceState.sourceFieldPipelineCacheStatus ?? null,
          sourceRenderFieldPipelineCacheStatus:
            residentMaterialInterfaceState.sourceRenderFieldPipelineCacheStatus ?? null,
          candidatePipelineCacheStatus:
            residentMaterialInterfaceState.candidatePipelineCacheStatus ?? null,
          materialInterfaceRefreshTotalMs: finiteOrNull(
            residentMaterialInterfaceState.materialInterfaceRefreshTotalMs
            ?? residentMaterialInterfaceState.materialInterfaceRefreshStageMs?.totalMs
          ),
          materialInterfaceRefreshRenderRowsMs: finiteOrNull(
            residentMaterialInterfaceState.materialInterfaceRefreshStageMs?.renderRowsMs
          ),
          materialInterfaceRefreshSourceFieldMs: finiteOrNull(
            residentMaterialInterfaceState.materialInterfaceRefreshStageMs?.sourceFieldMs
          ),
          materialInterfaceRefreshCandidateFieldMs: finiteOrNull(
            residentMaterialInterfaceState.materialInterfaceRefreshStageMs?.candidateFieldMs
          ),
          renderFieldReadback: residentMaterialInterfaceState.renderFieldReadback ?? null,
          renderRowsReadback: residentMaterialInterfaceState.renderRowsReadback ?? null,
          candidateReadbackMode: residentMaterialInterfaceState.candidateReadbackMode ?? null,
          readySurfaceCount: finiteOrNull(residentMaterialInterfaceState.readySurfaceCount),
          elementCount: finiteOrNull(residentMaterialInterfaceState.elementCount)
        } : null,
        probeResidentBatchTiming: overlay.__sphProbeResidentBatchTiming || null,
        thermalCandidateCsrRouteEvidence: {
          ...latestThermalCandidateCsrRouteEvidence,
          controlWords: Array.isArray(
            latestThermalCandidateCsrRouteEvidence?.controlWords
          ) ? [...latestThermalCandidateCsrRouteEvidence.controlWords] : null
        },
        residentGpuRefreshInFlight: sceneUserData.sphResidentGpuRefreshInFlight || null,
        renderModeSelection: overlay.__sphRenderModeSelection || null,
        rendererFrame: sceneUserData.sphRendererFrame || null,
        rendererWebGpuDevicePreflight: overlay.__sphRendererWebGpuDevicePreflight || null,
        statusText: overlay.querySelector('#sph-status')?.textContent ?? '',
        warningText: overlay.querySelector('#sph-warning-bar')?.textContent ?? '',
        plainSphStepResult: plainSphStepResult ? {
          step: plainSphStepResult.step ?? null,
          time: finiteOrNull(plainSphStepResult.time),
          reactionEventsStep: finiteOrNull(plainSphStepResult.reactionEventsStep),
          reactionEventsTotal: finiteOrNull(plainSphStepResult.reactionEventsTotal),
          particlesByMaterial: { ...(plainSphStepResult.particlesByMaterial || {}) },
          phaseMassByMaterialPhase: plainSphStepResult.phaseMassSummary?.byMaterialPhase || null,
          reactionLedger: plainSphStepResult.reactionLedger ? {
            schema: plainSphStepResult.reactionLedger.schema ?? null,
            eventCount: finiteOrNull(plainSphStepResult.reactionLedger.eventCount),
            productMassKgByMaterial: { ...(plainSphStepResult.reactionLedger.productMassKgByMaterial || {}) },
            gasMassKgByMaterial: { ...(plainSphStepResult.reactionLedger.gasMassKgByMaterial || {}) },
            heatJ: finiteOrNull(plainSphStepResult.reactionLedger.heatJ),
            massResidualKg: finiteOrNull(plainSphStepResult.reactionLedger.massResidualKg),
            maxAbsAtomResidualMol: finiteOrNull(plainSphStepResult.reactionLedger.maxAbsAtomResidualMol),
            chargeResidualMol: finiteOrNull(plainSphStepResult.reactionLedger.chargeResidualMol)
          } : null
        } : null,
        residentGasPressureSummary: overlay?.__sphResidentGasPressureSummary ? {
          schema: overlay.__sphResidentGasPressureSummary.schema ?? null,
          status: overlay.__sphResidentGasPressureSummary.status ?? null,
          source: overlay.__sphResidentGasPressureSummary.source ?? null,
          totalPressurePa: finiteOrNull(overlay.__sphResidentGasPressureSummary.totalPressurePa),
          externalPressurePa: finiteOrNull(
            overlay.__sphResidentGasPressureSummary.pressureFeedback?.externalPressurePa
              ?? overlay.__sphResidentGasPressureSummary.externalPressurePa
          ),
          residentProductMassStatus: overlay.__sphResidentGasPressureSummary.residentProductMassStatus ?? null,
          residentProductMassGasSpeciesLedgerCount: overlay.__sphResidentGasPressureSummary.residentProductMassGasSpeciesLedgerCount ?? null,
          residentLedgerStatus: overlay.__sphResidentGasPressureSummary.residentLedgerStatus ?? null,
          bySpeciesKeys: Object.keys(overlay.__sphResidentGasPressureSummary.bySpecies || {})
        } : null,
        residentSteps: steps ? {
            schema: steps.schema ?? null,
            backend: steps.backend ?? null,
            status: steps.status ?? null,
            residentComputeManagerMode:
              steps.residentComputeManagerMode ?? null,
            workerLaneFallback: steps.workerLaneFallback ? {
              schema: steps.workerLaneFallback.schema ?? null,
              status: steps.workerLaneFallback.status ?? null,
              reason: steps.workerLaneFallback.reason ?? null,
              detail: steps.workerLaneFallback.detail ?? null
            } : null,
            workerOwnedResidentLane: steps.workerOwnedResidentLane ? {
              schema: steps.workerOwnedResidentLane.schema ?? null,
              laneId: steps.workerOwnedResidentLane.laneId ?? null,
              stateKey: steps.workerOwnedResidentLane.stateKey ?? null,
              scheduleId: steps.workerOwnedResidentLane.scheduleId ?? null,
              residentScheduleStatus:
                steps.workerOwnedResidentLane.residentScheduleStatus ?? null,
              terminalStatus:
                steps.workerOwnedResidentLane.terminalStatus ?? null,
              requestedStepCount:
                steps.workerOwnedResidentLane.requestedStepCount ?? null,
              completedStepCount:
                steps.workerOwnedResidentLane.completedStepCount ?? null,
              progressEverySteps:
                steps.workerOwnedResidentLane.progressEverySteps ?? null,
              cancelled: steps.workerOwnedResidentLane.cancelled ?? null,
              retainedBufferRefCount: Array.isArray(
                steps.workerOwnedResidentLane.retainedBufferRefs
              )
                ? steps.workerOwnedResidentLane.retainedBufferRefs.length
                : null,
              laneCompletedStepTotal:
                steps.workerOwnedResidentLane.laneCompletedStepTotal ?? null,
              laneSimTimeS:
                finiteOrNull(steps.workerOwnedResidentLane.laneSimTimeS),
              finalEpochIdentity:
                steps.workerOwnedResidentLane.finalEpochIdentity ? {
                  storageGeneration:
                    finiteOrNull(
                      steps.workerOwnedResidentLane.finalEpochIdentity
                        .storageGeneration
                    ),
                  physicsTick:
                    finiteOrNull(
                      steps.workerOwnedResidentLane.finalEpochIdentity
                        .physicsTick
                    ),
                  positionEpoch:
                    finiteOrNull(
                      steps.workerOwnedResidentLane.finalEpochIdentity
                        .positionEpoch
                    )
                } : null,
              gpuFence: steps.workerOwnedResidentLane.gpuFence ? {
                scope: steps.workerOwnedResidentLane.gpuFence.scope ?? null,
                terminalScheduleFence:
                  steps.workerOwnedResidentLane.gpuFence
                    .terminalScheduleFence ?? null,
                fenceSatisfied:
                  steps.workerOwnedResidentLane.gpuFence.fenceSatisfied
                    ?? null,
                queueCompletionStatus:
                  steps.workerOwnedResidentLane.gpuFence
                    .queueCompletionStatus ?? null,
                queueCompletionMethod:
                  steps.workerOwnedResidentLane.gpuFence
                    .queueCompletionMethod ?? null,
                authorityAdmissionReady:
                  steps.workerOwnedResidentLane.gpuFence
                    .authorityAdmissionReady ?? null
              } : null,
              authority: steps.workerOwnedResidentLane.authority ? {
                status: steps.workerOwnedResidentLane.authority.status ?? null,
                authority:
                  steps.workerOwnedResidentLane.authority.authority ?? null,
                computeManagerLeaseStatus:
                  steps.workerOwnedResidentLane.authority
                    .computeManagerLeaseStatus ?? null,
                computeManagerFenceSatisfied:
                  steps.workerOwnedResidentLane.authority
                    .computeManagerFenceSatisfied ?? null,
                stateManagerCommitStatus:
                  steps.workerOwnedResidentLane.authority
                    .stateManagerCommitStatus ?? null
              } : null,
              dynamicReactionActivation:
                steps.workerOwnedResidentLane.dynamicReactionActivation
                  ? {
                      state:
                        steps.workerOwnedResidentLane
                          .dynamicReactionActivation.state ?? null,
                      transitionFingerprint:
                        steps.workerOwnedResidentLane
                          .dynamicReactionActivation
                          .transitionFingerprint ?? null,
                      committedScheduleId:
                        steps.workerOwnedResidentLane
                          .dynamicReactionActivation
                          .committedScheduleId ?? null
                    }
                  : null,
              dynamicReactionActivationReceipt:
                steps.workerOwnedResidentLane
                  .dynamicReactionActivationReceipt
                  ? {
                      ...steps.workerOwnedResidentLane
                        .dynamicReactionActivationReceipt
                    }
                  : null,
              committedPresentation:
                steps.workerOwnedResidentLane.committedPresentation ? {
                  status:
                    steps.workerOwnedResidentLane.committedPresentation
                      .status ?? null,
                  scheduleId:
                    steps.workerOwnedResidentLane.committedPresentation
                      .scheduleId ?? null,
                  laneId:
                    steps.workerOwnedResidentLane.committedPresentation
                      .laneId ?? null,
                  stateKey:
                    steps.workerOwnedResidentLane.committedPresentation
                      .stateKey ?? null,
                  presentationLaneEpoch:
                    finiteOrNull(
                      steps.workerOwnedResidentLane.committedPresentation
                        .presentationLaneEpoch
                    ),
                  sphStep:
                    finiteOrNull(
                      steps.workerOwnedResidentLane.committedPresentation
                        .sphStep
                    ),
                  residentExecutionGeneration:
                    finiteOrNull(
                      steps.workerOwnedResidentLane.committedPresentation
                        .residentExecutionGeneration
                    ),
                  stepOrdinal:
                    finiteOrNull(
                      steps.workerOwnedResidentLane.committedPresentation
                        .stepOrdinal
                    ),
                  residentScheduleCandidatePresentation:
                    steps.workerOwnedResidentLane.committedPresentation
                      .residentScheduleCandidatePresentation === true,
                  stateManagerCommittedPresentation:
                    steps.workerOwnedResidentLane.committedPresentation
                      .stateManagerCommittedPresentation === true,
                  authorityStatus:
                    steps.workerOwnedResidentLane.committedPresentation
                      .authorityStatus ?? null,
                  computeManagerCompletionSchema:
                    steps.workerOwnedResidentLane.committedPresentation
                      .computeManagerCompletionSchema ?? null,
                  computeManagerLeaseId:
                    steps.workerOwnedResidentLane.committedPresentation
                      .computeManagerLeaseId ?? null,
                  computeManagerLeaseStatus:
                    steps.workerOwnedResidentLane.committedPresentation
                      .computeManagerLeaseStatus ?? null,
                  computeManagerFenceSatisfied:
                    steps.workerOwnedResidentLane.committedPresentation
                      .computeManagerFenceSatisfied === true,
                  stateManagerCommitStatus:
                    steps.workerOwnedResidentLane.committedPresentation
                      .stateManagerCommitStatus ?? null,
                  stateManagerCommitAccepted:
                    steps.workerOwnedResidentLane.committedPresentation
                      .stateManagerCommitAccepted === true,
                  terminalScheduleFence:
                    steps.workerOwnedResidentLane.committedPresentation
                      .terminalScheduleFence === true,
                  terminalFenceScope:
                    steps.workerOwnedResidentLane.committedPresentation
                      .terminalFenceScope ?? null,
                  terminalFenceSatisfied:
                    steps.workerOwnedResidentLane.committedPresentation
                      .terminalFenceSatisfied === true,
                  terminalFenceAuthorityAdmissionReady:
                    steps.workerOwnedResidentLane.committedPresentation
                      .terminalFenceAuthorityAdmissionReady === true,
                  producerSourceKind:
                    steps.workerOwnedResidentLane.committedPresentation
                      .producerSourceKind ?? null,
                  producerSourceTransport:
                    steps.workerOwnedResidentLane.committedPresentation
                      .producerSourceTransport ?? null,
                  sourceStageId:
                    steps.workerOwnedResidentLane.committedPresentation
                      .sourceStageId ?? null,
                  retainedParticleStateStatus:
                    steps.workerOwnedResidentLane.committedPresentation
                      .retainedParticleStateStatus ?? null
                } : null,
              hierarchyStageSummary:
                steps.workerOwnedResidentLane.hierarchyStageSummary ? {
                  schema:
                    steps.workerOwnedResidentLane.hierarchyStageSummary
                      .schema ?? null,
                  status:
                    steps.workerOwnedResidentLane.hierarchyStageSummary
                      .status ?? null,
                  mechanicsLevelCount:
                    steps.workerOwnedResidentLane.hierarchyStageSummary
                      .mechanicsLevelCount ?? null,
                  twoLevelMechanicsEnabled:
                    steps.workerOwnedResidentLane.hierarchyStageSummary
                      .twoLevelMechanicsEnabled === true,
                  twoLevelMechanicsAuthority:
                    steps.workerOwnedResidentLane.hierarchyStageSummary
                      .twoLevelMechanicsAuthority ?? null,
                  residentStepStatus:
                    steps.workerOwnedResidentLane.hierarchyStageSummary
                      .residentStepStatus ?? null,
                  twoLevelFineSubstepCount:
                    steps.workerOwnedResidentLane.hierarchyStageSummary
                      .twoLevelFineSubstepCount ?? null,
                  twoLevelCflFactor:
                    steps.workerOwnedResidentLane.hierarchyStageSummary
                      .twoLevelCflFactor ?? null,
                  twoLevelAuthoritativeCommitVerified:
                    steps.workerOwnedResidentLane.hierarchyStageSummary
                      .twoLevelAuthoritativeCommitVerified === true,
                  mechanicsFieldPairV2Enabled:
                    steps.workerOwnedResidentLane.hierarchyStageSummary
                      .mechanicsFieldPairV2Enabled === true,
                  mechanicsFieldConstructionMode:
                    steps.workerOwnedResidentLane.hierarchyStageSummary
                      .mechanicsFieldConstructionMode ?? null,
                  lawQueueStatus:
                    steps.workerOwnedResidentLane.hierarchyStageSummary
                      .lawQueueStatus ?? null,
                  lawQueueConsumerStatus:
                    steps.workerOwnedResidentLane.hierarchyStageSummary
                      .lawQueueConsumerStatus ?? null,
                  lawNeighborCandidateStatus:
                    steps.workerOwnedResidentLane.hierarchyStageSummary
                      .lawNeighborCandidateStatus ?? null,
                  lawNeighborCandidateConsumerStatus:
                    steps.workerOwnedResidentLane.hierarchyStageSummary
                      .lawNeighborCandidateConsumerStatus ?? null,
                  crossLevelCouplingStatus:
                    steps.workerOwnedResidentLane.hierarchyStageSummary
                      .crossLevelCouplingStatus ?? null,
                  conservativeTransferStatus:
                    steps.workerOwnedResidentLane.hierarchyStageSummary
                      .conservativeTransferStatus ?? null,
                  stateMutationStatus:
                    steps.workerOwnedResidentLane.hierarchyStageSummary
                      .stateMutationStatus ?? null,
                  stateAuthorityStatus:
                    steps.workerOwnedResidentLane.hierarchyStageSummary
                      .stateAuthorityStatus ?? null,
                  phaseVolumeMigrationStatus:
                    steps.workerOwnedResidentLane.hierarchyStageSummary
                      .phaseVolumeMigrationStatus ?? null,
                  phaseVolumeLevelUpdateStatus:
                    steps.workerOwnedResidentLane.hierarchyStageSummary
                      .phaseVolumeLevelUpdateStatus ?? null,
                  pressureInterfaceOwnerScopeStatus:
                    steps.workerOwnedResidentLane.hierarchyStageSummary
                      .pressureInterfaceOwnerScopeStatus ?? null,
                  residentStageStatus: {
                    ...(steps.workerOwnedResidentLane.hierarchyStageSummary
                      .residentStageStatus || {})
                  },
                  residentStageBackends: {
                    ...(steps.workerOwnedResidentLane.hierarchyStageSummary
                      .residentStageBackends || {})
                  },
                  staticGpuTableUploadStatus: {
                    ...(steps.workerOwnedResidentLane.hierarchyStageSummary
                      .staticGpuTableUploadStatus || {})
                  },
                  postMechanicsClosure:
                    steps.workerOwnedResidentLane.hierarchyStageSummary
                      .postMechanicsClosure ? {
                        ...steps.workerOwnedResidentLane.hierarchyStageSummary
                          .postMechanicsClosure,
                        executedStageOrder: [
                          ...(steps.workerOwnedResidentLane
                            .hierarchyStageSummary.postMechanicsClosure
                            .executedStageOrder || [])
                        ]
                      } : null,
                  thermalRequested:
                    steps.workerOwnedResidentLane.hierarchyStageSummary
                      .thermalRequested === true,
                  reactionRequested:
                    steps.workerOwnedResidentLane.hierarchyStageSummary
                      .reactionRequested === true,
                  phaseVolumeSurfaceStressRequired:
                    steps.workerOwnedResidentLane.hierarchyStageSummary
                      .phaseVolumeSurfaceStressRequired === true,
                  phaseVolumeSurfaceStressSubmissionExact:
                    steps.workerOwnedResidentLane.hierarchyStageSummary
                      .phaseVolumeSurfaceStressSubmissionExact === true,
                  stageMechanicsTraceRequested:
                    steps.workerOwnedResidentLane.hierarchyStageSummary
                      .stageMechanicsTraceRequested === true,
                  stageMechanicsTrace:
                    steps.workerOwnedResidentLane.hierarchyStageSummary
                      .stageMechanicsTrace ?? null,
                  canonicalSpatialAuthorityTrace:
                    steps.workerOwnedResidentLane.hierarchyStageSummary
                      .canonicalSpatialAuthorityTrace ?? null,
                  fullParticleReadbackFree:
                    steps.workerOwnedResidentLane.hierarchyStageSummary
                      .fullParticleReadbackFree ?? null,
                  fullParticleReadbackPerformed:
                    steps.workerOwnedResidentLane.hierarchyStageSummary
                      .fullParticleReadbackPerformed === true,
                  residentStageTiming:
                    steps.workerOwnedResidentLane.hierarchyStageSummary
                      .residentStageTiming ? {
                        compactSummaryRequested:
                          steps.workerOwnedResidentLane.hierarchyStageSummary
                            .residentStageTiming.compactSummaryRequested
                            ?? null
                      } : null
                } : null,
              phaseVolumeSurfaceStress:
                steps.workerOwnedResidentLane.phaseVolumeSurfaceStress ? {
                  schema:
                    steps.workerOwnedResidentLane.phaseVolumeSurfaceStress
                      .schema ?? null,
                  required:
                    steps.workerOwnedResidentLane.phaseVolumeSurfaceStress
                      .required === true,
                  observedStepCount:
                    steps.workerOwnedResidentLane.phaseVolumeSurfaceStress
                      .observedStepCount ?? null,
                  expectedSubmissionCount:
                    steps.workerOwnedResidentLane.phaseVolumeSurfaceStress
                      .expectedSubmissionCount ?? null,
                  exactSubmissionCount:
                    steps.workerOwnedResidentLane.phaseVolumeSurfaceStress
                      .exactSubmissionCount ?? null,
                  submissionEvidenceComplete:
                    steps.workerOwnedResidentLane.phaseVolumeSurfaceStress
                      .submissionEvidenceComplete === true,
                  firstIncompleteStepOrdinal:
                    steps.workerOwnedResidentLane.phaseVolumeSurfaceStress
                      .firstIncompleteStepOrdinal ?? null,
                  finalSubmissionStepOrdinal:
                    steps.workerOwnedResidentLane.phaseVolumeSurfaceStress
                      .finalSubmissionStepOrdinal ?? null,
                  finalSubmission:
                    compactPhaseVolumeSurfaceStressSubmission(
                      steps.workerOwnedResidentLane.phaseVolumeSurfaceStress
                        .finalSubmission
                    )
                } : null,
              twoLevelMechanics:
                steps.workerOwnedResidentLane.twoLevelMechanics ? {
                  ...steps.workerOwnedResidentLane.twoLevelMechanics,
                  lastStep:
                    steps.workerOwnedResidentLane.twoLevelMechanics.lastStep
                      ? {
                          ...steps.workerOwnedResidentLane.twoLevelMechanics
                            .lastStep
                        }
                      : null
                } : null
            } : null,
            stepCount: steps.stepCount ?? null,
            completedStepCount: steps.completedStepCount ?? null,
            readbackMode: steps.readbackMode ?? null,
            requestedReadbackMode: steps.requestedReadbackMode ?? null,
            compactSummaryScope: steps.compactSummaryScope ?? null,
            continuedFromResidentState: steps.continuedFromResidentState ?? null,
            continuationAvailable: steps.continuationAvailable ?? null,
            ambientPressurePa: finiteOrNull(steps.ambientPressurePa),
            ambientPressureSource: steps.ambientPressureSource ?? null,
            ambientPressureEvidence: steps.ambientPressureEvidence
              ? { ...steps.ambientPressureEvidence }
              : null,
            reactionProductPlacementAccumulatorStatus:
              steps.reactionProductPlacementAccumulatorStatus ?? null,
            reactionProductPlacementSuccessfulDispatchCount:
              steps.reactionProductPlacementSuccessfulDispatchCount ?? null,
            reactionProductPlacementDispatchEvidenceComplete:
              steps.reactionProductPlacementDispatchEvidenceComplete ?? null,
            reactionProductPlacementSourceCountVerified:
              steps.reactionProductPlacementSourceCountVerified ?? null,
            residentStepsTiming: steps.residentStepsTiming ?? null,
            residentStepsStageMs: steps.residentStepsStageMs ?? null,
            residentStepsWallMs: finiteOrNull(steps.residentStepsWallMs),
            residentStepsSurfaceDrawSubmitFenceMs:
              finiteOrNull(steps.residentStepsSurfaceDrawSubmitFenceMs),
            residentStepsDeviceAcquireMs: finiteOrNull(steps.residentStepsDeviceAcquireMs),
            residentStepsSphUploadMs: finiteOrNull(steps.residentStepsSphUploadMs),
            residentStepsMlsUploadMs: finiteOrNull(steps.residentStepsMlsUploadMs),
            residentStepsThermalUploadMs: finiteOrNull(steps.residentStepsThermalUploadMs),
            residentStepsMechanicsMaterialUploadMs:
              finiteOrNull(steps.residentStepsMechanicsMaterialUploadMs),
            residentStepsPressureRowsMs: finiteOrNull(steps.residentStepsPressureRowsMs),
            residentStepsKernelsWallMs: finiteOrNull(steps.residentStepsKernelsWallMs),
            residentStepsPostKernelPublicationMs:
              finiteOrNull(steps.residentStepsPostKernelPublicationMs),
            residentStepsArtifactClearMs: finiteOrNull(steps.residentStepsArtifactClearMs),
            residentStepsArtifactPublishMs: finiteOrNull(steps.residentStepsArtifactPublishMs),
            nextActiveGridDispatchPlanHintStatus: steps.nextSphParticleState?.residentActiveGridDispatchPlanHint?.status ?? null,
            nextActiveGridDispatchPlanHintSource: steps.nextSphParticleState?.residentActiveGridDispatchPlanHint?.source ?? null,
            nextActiveGridDispatchPlanHintDispatchArgsBufferByteLength: steps.nextSphParticleState?.residentActiveGridDispatchPlanHint?.dispatchArgsBufferByteLength ?? 0,
            nextActiveGridDispatchPlanHintMetadataBufferByteLength: steps.nextSphParticleState?.residentActiveGridDispatchPlanHint?.metadataBufferByteLength ?? 0,
            nextUploadActiveGridDispatchPlanHintStatus: steps.nextParticleUploads?.activeGridDispatchPlanHint?.status ?? null,
            nextUploadActiveGridDispatchPlanHintSource: steps.nextParticleUploads?.activeGridDispatchPlanHint?.source ?? null,
            nextUploadActiveGridDispatchPlanHintDispatchArgsBufferByteLength: steps.nextParticleUploads?.activeGridDispatchPlanHint?.dispatchArgsBufferByteLength ?? 0,
            nextUploadActiveGridDispatchPlanHintMetadataBufferByteLength: steps.nextParticleUploads?.activeGridDispatchPlanHint?.metadataBufferByteLength ?? 0,
            residentProductMassGridCouplingStatus:
              steps.finalStep?.residentProductMassGridCouplingStatus ?? null,
            residentProductMassInputProductEventCountAuthority:
              steps.finalStep?.residentProductMassInputProductEventCountAuthority ?? null,
            residentProductMassInputProductEventRowCapacity:
              steps.finalStep?.residentProductMassInputProductEventRowCapacity ?? null,
            residentProductMassInputProductEventCountHostKnown:
              steps.finalStep?.residentProductMassInputProductEventCountHostKnown ?? null,
            residentProductMassProductEventDispatchMode:
              steps.finalStep?.residentProductMassProductEventDispatchMode ?? null,
            readbackTelemetrySchema: steps.readbackTelemetrySchema ?? null,
            readbackTelemetryScope: steps.readbackTelemetryScope ?? null,
            ...readbackTelemetry,
            fullParticleReadbackPerformed:
              typeof steps.fullParticleReadbackPerformed === 'boolean'
                ? steps.fullParticleReadbackPerformed
                : null,
            fullParticleReadbackFree: steps.fullParticleReadbackFree === true,
            residentContinuationReady:
              steps.residentContinuationReady === true,
            schroederTwoLevelAuthoritativeStepCount: Array.isArray(steps.stepSummaries)
              ? steps.stepSummaries.filter((summary) => (
                summary?.status === 'schroeder-two-level-authoritative-step-executed'
              )).length
              : null,
            schroederTwoLevelMechanicsCoverageComplete:
              compactSchroederTelemetry({
                steps,
                residentStep,
                renderState,
                surfaceDraw,
                sceneUserData,
                overlayRef: overlay
              })?.twoLevelMechanicsCoverageComplete === true,
            residentExecutionPolicy: steps.residentExecutionPolicy || overlay?.__mlsMpmResidentExecutionPolicy || null,
            schroederSpatialEpochTransactionSummaries: Array.isArray(
              steps.schroederSpatialEpochTransactionSummaries
            )
              ? steps.schroederSpatialEpochTransactionSummaries.map(
                compactSchroederSpatialEpochTransaction
              )
              : [],
            schroederSpatialEpochReleaseSettlementCount:
              steps.schroederSpatialEpochReleaseSettlementCount ?? null,
            schroederSpatialEpochReleaseSettlementComplete:
              steps.schroederSpatialEpochReleaseSettlementComplete === true,
            schroederHierarchyArtifactLedgerSummaries: Array.isArray(
              steps.schroederHierarchyArtifactLedgerSummaries
            ) ? steps.schroederHierarchyArtifactLedgerSummaries.map(
              (summary) => ({ ...summary })
            ) : [],
            schroederHierarchyArtifactLedgerSettlementCount:
              steps.schroederHierarchyArtifactLedgerSettlementCount ?? null,
            schroederHierarchyArtifactLedgerSettlementComplete:
              steps.schroederHierarchyArtifactLedgerSettlementComplete === true,
            phaseVolumeSurfaceStressRequired:
              steps.phaseVolumeSurfaceStressRequired === true,
            phaseVolumeSurfaceStressExpectedSubmissionCount:
              steps.phaseVolumeSurfaceStressExpectedSubmissionCount ?? null,
            phaseVolumeSurfaceStressSubmissionCount:
              steps.phaseVolumeSurfaceStressSubmissionCount ?? null,
            phaseVolumeSurfaceStressSubmissionEvidenceComplete:
              steps.phaseVolumeSurfaceStressSubmissionEvidenceComplete === true,
            phaseVolumeSurfaceStressSubmissions:
              Array.isArray(steps.stepSummaries)
                ? steps.stepSummaries.map((summary) => (
                    compactPhaseVolumeSurfaceStressSubmission(
                      summary?.phaseVolumeSurfaceStressSubmission
                    )
                  ))
                : [],
            phaseVolumeSurfaceStressWorkerEvidence:
              steps.phaseVolumeSurfaceStressWorkerEvidence ? {
                schema:
                  steps.phaseVolumeSurfaceStressWorkerEvidence.schema ?? null,
                required:
                  steps.phaseVolumeSurfaceStressWorkerEvidence.required === true,
                observedStepCount:
                  steps.phaseVolumeSurfaceStressWorkerEvidence
                    .observedStepCount ?? null,
                expectedSubmissionCount:
                  steps.phaseVolumeSurfaceStressWorkerEvidence
                    .expectedSubmissionCount ?? null,
                exactSubmissionCount:
                  steps.phaseVolumeSurfaceStressWorkerEvidence
                    .exactSubmissionCount ?? null,
                submissionEvidenceComplete:
                  steps.phaseVolumeSurfaceStressWorkerEvidence
                    .submissionEvidenceComplete === true,
                firstIncompleteStepOrdinal:
                  steps.phaseVolumeSurfaceStressWorkerEvidence
                    .firstIncompleteStepOrdinal ?? null,
                finalSubmissionStepOrdinal:
                  steps.phaseVolumeSurfaceStressWorkerEvidence
                    .finalSubmissionStepOrdinal ?? null,
                finalSubmission:
                  compactPhaseVolumeSurfaceStressSubmission(
                    steps.phaseVolumeSurfaceStressWorkerEvidence
                      .finalSubmission
                  )
              } : null,
            schroederSpatialEpochGenerationSummaries: Array.isArray(
              steps.schroederSameLevelMechanicsSummaries
            )
              ? steps.schroederSameLevelMechanicsSummaries
                .map((summary) => summary?.spatialEpochGeneration ? {
                  ...summary.spatialEpochGeneration
                } : null)
                .filter(Boolean)
              : [],
            schroederCanonicalEpochControllerSummaries: Array.isArray(
              steps.schroederSameLevelMechanicsSummaries
            )
              ? steps.schroederSameLevelMechanicsSummaries
                .map((summary) => (
                  summary?.canonicalEpochControllerSummary
                    ? { ...summary.canonicalEpochControllerSummary }
                    : null
                ))
                .filter(Boolean)
              : [],
            schroederHierarchyHostTiming:
              compactSchroederHierarchyHostTiming(
                steps.schroederHierarchyHostTiming
              ),
            fusedResidentSequence: steps.fusedResidentSequence ? {
              schema: steps.fusedResidentSequence.schema ?? null,
              status: steps.fusedResidentSequence.status ?? null,
              stepCount: steps.fusedResidentSequence.stepCount ?? null,
              dispatchCount: steps.fusedResidentSequence.dispatchCount ?? null,
              dispatchTopology: compactDispatchTopology(steps.fusedResidentSequence.dispatchTopology),
              activeGridDispatch: steps.fusedResidentSequence.activeGridDispatch
                ? { ...steps.fusedResidentSequence.activeGridDispatch }
                : null,
              activeGridIndirectDispatch: steps.fusedResidentSequence.activeGridIndirectDispatch
                ? { ...steps.fusedResidentSequence.activeGridIndirectDispatch }
                : null
            } : null,
            fusedResidentSequencePreflight: compactFusedResidentSequencePreflight(steps.fusedResidentSequencePreflight),
            finalStepStageTiming: compactStageTiming(steps.finalStep?.stageTiming),
            finalStepPhaseVolumeSurfaceStressSubmission:
              compactPhaseVolumeSurfaceStressSubmission(
                steps.finalStep?.gridUpdate
                  ?.phaseVolumeSurfaceStressSubmission
                ?? steps.finalStep?.phaseVolumeSurfaceStressSubmission
                ?? steps.phaseVolumeSurfaceStressWorkerEvidence
                  ?.finalSubmission
              ),
            residentSourceMode: steps.residentSourceMode ?? null,
            nextStep: steps.nextSphParticleState?.step ?? null,
            nextTime: finiteOrNull(steps.nextSphParticleState?.time)
          } : null,
          residentStep: residentStep ? {
            schema: residentStep.schema ?? null,
            backend: residentStep.backend ?? null,
            status: residentStep.status ?? null,
            readbackMode: residentStep.readbackMode ?? null,
            sequenceIndex: residentStep.sequenceIndex ?? null,
            twoLevelMechanicsAuthority:
              residentStep.twoLevelMechanicsAuthority ?? null,
            twoLevelMechanicsStatus:
              residentStep.twoLevelMechanicsStatus
              ?? residentStep.stageStatus?.twoLevelMechanics
              ?? null,
            twoLevelFineSubstepCount:
              residentStep.twoLevelFineSubstepCount ?? null,
            twoLevelAuthoritativeCommitVerified:
              residentStep.twoLevelAuthoritativeCommitVerified === true,
            ambientPressurePa: finiteOrNull(residentStep.ambientPressurePa),
            ambientPressureAppliedInStressProjection:
              residentStep.ambientPressureAppliedInStressProjection === true,
            ambientPressureSource: residentStep.ambientPressureSource ?? null,
            ambientPressureEvidence: residentStep.ambientPressureEvidence
              ? { ...residentStep.ambientPressureEvidence }
              : null,
            // Per-stage mechanics snapshots. Null unless stageMechanicsTrace=1;
            // fixed-size per stage, not per particle.
            stageMechanicsTrace: residentStep.stageMechanicsTrace ?? null,
            canonicalSpatialAuthorityTrace:
              residentStep.canonicalSpatialAuthorityTrace ?? null,
            particlePingPong: residentStep.particlePingPong ? {
              sourceStep: residentStep.particlePingPong.sourceStep ?? null,
              nextStep: residentStep.particlePingPong.nextStep ?? null,
              sourceTime: finiteOrNull(residentStep.particlePingPong.sourceTime),
              nextTime: finiteOrNull(residentStep.particlePingPong.nextTime)
            } : null,
            schroederSpatialEpochTransaction:
              compactSchroederSpatialEpochTransaction(
                residentStep.schroederSpatialEpochTransaction
              ),
            phaseVolumeSurfaceStressSubmission:
              compactPhaseVolumeSurfaceStressSubmission(
                residentStep.gridUpdate
                  ?.phaseVolumeSurfaceStressSubmission
                ?? residentStep.phaseVolumeSurfaceStressSubmission
              ),
            residentProductMassStatus:
              residentStep.residentProductMassStatus ?? null,
            residentProductMassProductEventRowCount:
              residentStep.residentProductMassProductEventRowCount ?? null,
            residentProductMassGridCouplingStatus:
              residentStep.residentProductMassGridCouplingStatus ?? null,
            residentProductMassInputProductEventCountAuthority:
              residentStep.residentProductMassInputProductEventCountAuthority ?? null,
            residentProductMassInputProductEventRowCapacity:
              residentStep.residentProductMassInputProductEventRowCapacity ?? null,
            residentProductMassInputProductEventCountHostKnown:
              residentStep.residentProductMassInputProductEventCountHostKnown ?? null,
            residentProductMassProductEventDispatchMode:
              residentStep.residentProductMassProductEventDispatchMode ?? null,
            stageTiming: compactStageTiming(residentStep.stageTiming || steps?.finalStep?.stageTiming),
            compactGpuSummary: compactGpuSummaryResult(residentStep.compactGpuSummary || steps?.finalStep?.compactGpuSummary),
            diagnostics: compactDiagnostics(residentStep.diagnostics)
          } : null,
          renderState: renderState ? {
            schema: renderState.schema ?? null,
            status: renderState.status ?? null,
            source: renderState.source ?? null,
            backend: renderState.backend ?? null,
            reason: renderState.reason ?? null,
            error: renderState.error ?? null,
            sourceResidentRenderSourceStatus:
              renderState.sourceResidentRenderSourceStatus ?? null,
            sourceResidentExecutionGeneration:
              renderState.sourceResidentExecutionGeneration ?? null,
            sourceResidentCurrentExecutionGeneration:
              renderState.sourceResidentCurrentExecutionGeneration ?? null,
            sourceResidentExecutionGenerationMatchesCurrent:
              renderState.sourceResidentExecutionGenerationMatchesCurrent ?? null,
            sourceResidentNextStep: renderState.sourceResidentNextStep ?? null,
            sourceResidentNextTimeS: renderState.sourceResidentNextTimeS ?? null,
            surfaceDrawOverlayPolicyStatus:
              renderState.surfaceDrawOverlayPolicyStatus ?? null,
            workerOffscreenPresentationStatus:
              renderState.workerOffscreenPresentationStatus ?? null,
            workerOffscreenRetainedCompactSnapshotStatus:
              renderState.workerOffscreenRetainedCompactSnapshotStatus
                ?? null,
            workerOffscreenRetainedCompactSnapshotAvailable:
              renderState.workerOffscreenRetainedCompactSnapshotAvailable
                ?? null,
            workerOffscreenRetainedCompactSnapshotStep:
              renderState.workerOffscreenRetainedCompactSnapshotStep
                ?? renderState.workerOffscreenRetainedCompactSnapshot
                  ?.compactBufferSnapshotStep
                ?? null,
            sourceResidentRetainedPrevious:
              renderState.sourceResidentRetainedPrevious ?? null,
            sourceResidentRetentionReason:
              renderState.sourceResidentRetentionReason ?? null,
            surfaceDrawSourceResidentExecutionGeneration:
              renderState.surfaceDrawSourceResidentExecutionGeneration ?? null,
            surfaceDrawSourceResidentExecutionGenerationMatchesCurrent:
              renderState.surfaceDrawSourceResidentExecutionGenerationMatchesCurrent ?? null,
            surfaceDrawSourceResidentNextStep:
              renderState.surfaceDrawSourceResidentNextStep ?? null,
            surfaceDrawSourceResidentNextTimeS:
              renderState.surfaceDrawSourceResidentNextTimeS ?? null,
            surfaceDrawSourceResidentRetainedPrevious:
              renderState.surfaceDrawSourceResidentRetainedPrevious ?? null,
            surfaceDrawSourceResidentRetentionReason:
              renderState.surfaceDrawSourceResidentRetentionReason ?? null,
            surfaceDrawRenderBridgeSourceResidentExecutionGeneration:
              renderState.surfaceDrawRenderBridgeSourceResidentExecutionGeneration ?? null,
            surfaceDrawRenderBridgeSourceResidentExecutionGenerationMatchesCurrent:
              renderState.surfaceDrawRenderBridgeSourceResidentExecutionGenerationMatchesCurrent ?? null,
            surfaceDrawRenderBridgeSourceResidentNextStep:
              renderState.surfaceDrawRenderBridgeSourceResidentNextStep ?? null,
            surfaceDrawRenderBridgeSourceResidentNextTimeS:
              renderState.surfaceDrawRenderBridgeSourceResidentNextTimeS ?? null,
            surfaceDrawRenderBridgeSourceResidentRetainedPrevious:
              renderState.surfaceDrawRenderBridgeSourceResidentRetainedPrevious ?? null,
            surfaceDrawRenderBridgeSourceResidentRetentionReason:
              renderState.surfaceDrawRenderBridgeSourceResidentRetentionReason ?? null,
            rendererOwnedDevice: renderState.rendererOwnedDevice ?? null,
            renderRefreshTiming: renderState.renderRefreshTiming ?? null,
            renderRefreshStageMs: renderState.renderRefreshStageMs ?? null,
            // PROF-0. Device-side stage cost, present only under
            // ?residentGpuTimestampProfile=1. Every renderRefresh*Ms above is
            // host enqueue time, which is why they cannot settle FIELD-0.
            // Priority 3's gating measurement: how often the law-neighbour
            // search drops into its O(N) fallback because the bucket index
            // missed. Present only with the compact-diagnostic readback mode.
            schroederLawNeighborTraversal:
              renderState.schroederLawNeighborTraversal ?? null,
            schroederActiveNodeCompaction:
              renderState.schroederActiveNodeCompaction ?? null,
            schroederPhaseVolumeMigration:
              renderState.schroederPhaseVolumeMigration ?? null,
            residentGpuQueueStageStats: renderState.residentGpuQueueStageStats ?? null,
            residentGpuQueueStageSpanCount:
              finiteOrNull(renderState.residentGpuQueueStageSpanCount),
            // Cumulative mapAsync tally, present only under
            // ULG_PROBE_TRACE_NATIVE_BUFFER_MAP=1. A per-frame readback is one
            // whose count rises between consecutive samples.
            nativeBufferMapTally: typeof globalThis.__ulgBufferMapTally === 'function'
              ? globalThis.__ulgBufferMapTally()
              : null,
            // Same shape for queue fences, under
            // ULG_PROBE_TRACE_NATIVE_QUEUE_FENCES=1. Every fence is a point
            // where the host stops and waits for the device to go idle.
            nativeQueueFenceTally: typeof globalThis.__ulgQueueFenceTally === 'function'
              ? globalThis.__ulgQueueFenceTally()
              : null,
            nativeQueueFenceTotal: typeof globalThis.__ulgQueueFenceTotal === 'function'
              ? globalThis.__ulgQueueFenceTotal()
              : null,
            nativeQueueFenceTraceInstalled:
              globalThis.__ulgQueueFenceTraceInstalled === true,
            nativeDagBuildTally: typeof globalThis.__ulgDagBuildTally === 'function'
              ? globalThis.__ulgDagBuildTally()
              : null,
            nativeDagBuildMs: globalThis.__ulgDagBuildMs ?? null,
            nativeCreateBufferMs: globalThis.__ulgCreateBufferMs ?? null,
            nativeQueueWriteTrace:
              typeof globalThis.__ulgQueueWriteTrace === 'function'
                ? globalThis.__ulgQueueWriteTrace()
                : null,
            renderRefreshTotalMs: finiteOrNull(renderState.renderRefreshTotalMs),
            renderRefreshDeviceAcquireMs: finiteOrNull(renderState.renderRefreshDeviceAcquireMs),
            renderRefreshRenderRowsMs: finiteOrNull(renderState.renderRefreshRenderRowsMs),
            renderRefreshRenderFieldMs: finiteOrNull(renderState.renderRefreshRenderFieldMs),
            renderRefreshRenderFieldSurfaceSummaryMs:
              finiteOrNull(renderState.renderRefreshRenderFieldSurfaceSummaryMs),
            renderRefreshMaterialInterfaceMs: finiteOrNull(renderState.renderRefreshMaterialInterfaceMs),
            renderRefreshSurfaceDrawMs: finiteOrNull(renderState.renderRefreshSurfaceDrawMs),
            renderRefreshOpticalLookupMs: finiteOrNull(renderState.renderRefreshOpticalLookupMs),
            renderRefreshPressureInterfaceMs: finiteOrNull(renderState.renderRefreshPressureInterfaceMs),
            renderRefreshWorkerOffscreenRenderRowsMs:
              finiteOrNull(renderState.renderRefreshWorkerOffscreenRenderRowsMs),
            renderRefreshRenderStateAssemblyMs:
              finiteOrNull(renderState.renderRefreshRenderStateAssemblyMs),
            surfaceDrawExtractionPresentationCounters:
              extractionPresentationCounters(renderState),
            renderFieldBufferMode: renderState.renderFieldBufferMode ?? null,
            renderFieldReadback: renderState.renderFieldReadback ?? null,
            renderFieldStatus: renderState.renderFieldStatus ?? null,
            renderFieldReason: renderState.renderFieldReason ?? null,
            renderFieldBackend: renderState.renderFieldBackend ?? null,
            renderFieldInputSource: renderState.renderFieldInputSource ?? null,
            renderFieldCpuFallbackGeometryAvailable: renderState.renderFieldCpuFallbackGeometryAvailable ?? null,
            renderFieldSurfaceCount: renderState.renderFieldSurfaceCount ?? null,
            renderFieldTotalCells: renderState.renderFieldTotalCells ?? null,
            renderFieldCpuParitySummary: renderState.renderFieldCpuParitySummary ?? null,
            renderFieldEmptyRetryReadback: renderState.renderFieldEmptyRetryReadback ?? null,
            renderFieldEmptyRetryReason: renderState.renderFieldEmptyRetryReason ?? null,
            renderFieldSurfaceSummaryStatus: renderState.renderFieldSurfaceSummaryStatus ?? null,
            renderFieldSurfaceSummaryReadback: renderState.renderFieldSurfaceSummaryReadback ?? null,
            renderFieldSurfaceSummaryMode: renderState.renderFieldSurfaceSummaryMode ?? null,
            renderFieldSurfaceSummarySkipped: renderState.renderFieldSurfaceSummarySkipped ?? null,
            renderFieldSurfaceSummarySkipReason: renderState.renderFieldSurfaceSummarySkipReason ?? null,
            renderFieldSurfaceSummaryByteLength: renderState.renderFieldSurfaceSummaryByteLength ?? null,
            renderFieldSurfaceSummaryActiveSurfaceCount: renderState.renderFieldSurfaceSummaryActiveSurfaceCount ?? null,
            renderFieldSurfaceSummaryActiveCellCount: renderState.renderFieldSurfaceSummaryActiveCellCount ?? null,
            renderFieldSurfaceSummaryMaxDensity: renderState.renderFieldSurfaceSummaryMaxDensity ?? null,
            renderFieldSurfaceSummarySurfaces: Array.isArray(renderState.renderFieldSurfaceSummarySurfaces)
              ? renderState.renderFieldSurfaceSummarySurfaces.map((surface) => ({ ...surface }))
              : [],
            surfaceDrawDiagnosticMode: renderState.surfaceDrawDiagnosticMode ?? null,
            surfaceDrawRequestedDiagnosticMode: renderState.surfaceDrawRequestedDiagnosticMode ?? null,
            surfaceDrawDiagnosticFallbackReason: renderState.surfaceDrawDiagnosticFallbackReason ?? null,
            surfaceDrawDiagnosticMaxFieldCells: renderState.surfaceDrawDiagnosticMaxFieldCells ?? null,
            surfaceDrawDiagnosticMaxResolution: renderState.surfaceDrawDiagnosticMaxResolution ?? null,
            surfaceDrawDiagnosticSurfaceTableMaxResolution: renderState.surfaceDrawDiagnosticSurfaceTableMaxResolution ?? null,
            surfaceDrawDiagnosticsBuilt: renderState.surfaceDrawDiagnosticsBuilt ?? null,
            surfaceDrawDiagnosticsSkipped: renderState.surfaceDrawDiagnosticsSkipped ?? null,
            surfaceDrawDiagnosticsSkipReason: renderState.surfaceDrawDiagnosticsSkipReason ?? null,
            surfaceDrawDiagnosticFieldCellCount: renderState.surfaceDrawDiagnosticFieldCellCount ?? null,
            surfaceDrawRenderFieldRowsBufferRetained:
              renderState.surfaceDrawRenderFieldRowsBufferRetained ?? null,
            surfaceDrawRenderFieldRowsBufferByteLength:
              renderState.surfaceDrawRenderFieldRowsBufferByteLength ?? null,
            surfaceDrawRenderFieldSurfaceBufferRetained:
              renderState.surfaceDrawRenderFieldSurfaceBufferRetained ?? null,
            surfaceDrawRenderFieldSurfaceBufferByteLength:
              renderState.surfaceDrawRenderFieldSurfaceBufferByteLength ?? null,
            renderRowsReadback: renderState.renderRowsReadback ?? null,
            renderRowsReadbackMode: renderState.renderRowsReadbackMode ?? null,
            renderRowsReadbackRequestedMode: renderState.renderRowsReadbackRequestedMode ?? null,
            renderRowsReadbackEffectiveMode: renderState.renderRowsReadbackEffectiveMode ?? null,
            renderRowsReadbackCoercionReason: renderState.renderRowsReadbackCoercionReason ?? null,
            renderRowsReadbackForcedForThreeBridge: renderState.renderRowsReadbackForcedForThreeBridge ?? null,
            renderRowsReadbackForcedForWorkerOffscreenPresentation:
              renderState.renderRowsReadbackForcedForWorkerOffscreenPresentation ?? null,
            renderRowsReadbackForcedForWorkerOwnedResidentProducer:
              renderState.renderRowsReadbackForcedForWorkerOwnedResidentProducer ?? null,
            renderRowsReadbackWorkerOffscreenPresentationRequired:
              renderState.renderRowsReadbackWorkerOffscreenPresentationRequired ?? null,
            renderRowsReadbackWorkerOwnedResidentProducerRequired:
              renderState.renderRowsReadbackWorkerOwnedResidentProducerRequired ?? null,
            presentationWorkerRetainedOutputPresentationOnlyReadbackFree:
              renderState.presentationWorkerRetainedOutputPresentationOnlyReadbackFree ?? null,
            peerComputeRenderOwnershipResidentPlaybackUseCase:
              renderState.peerComputeRenderOwnershipResidentPlaybackUseCase ?? null,
            peerComputeRenderOwnershipResidentStepsPerScheduleOverride:
              renderState.peerComputeRenderOwnershipResidentStepsPerScheduleOverride ?? null,
            peerComputeRenderOwnershipResidentStepsPerScheduleMax:
              renderState.peerComputeRenderOwnershipResidentStepsPerScheduleMax ?? null,
            peerComputeRenderOwnershipResidentParticleBridgeTargetBatchTimeS:
              renderState.peerComputeRenderOwnershipResidentParticleBridgeTargetBatchTimeS ?? null,
            peerComputeRenderOwnershipResidentComputeManagerMode:
              renderState.peerComputeRenderOwnershipResidentComputeManagerMode ?? null,
            peerComputeRenderOwnershipResidentComputeManagerModeExplicit:
              renderState.peerComputeRenderOwnershipResidentComputeManagerModeExplicit ?? null,
            workerOffscreenRenderRowsRetainedStageOutputPreserved:
              renderState.workerOffscreenRenderRowsRetainedStageOutputPreserved ?? null,
            workerOffscreenRenderRowsSkippedLegacyDrawForRetainedStageOutput:
              renderState.workerOffscreenRenderRowsSkippedLegacyDrawForRetainedStageOutput ?? null,
            renderRowsReadbackRetainedPreviousBridge: renderState.renderRowsReadbackRetainedPreviousBridge ?? null,
            renderRowsGpuHandoffCopy: renderState.renderRowsGpuHandoffCopy ?? null,
            renderRowsHandoffMode: renderState.renderRowsHandoffMode ?? null,
            renderRowsReadbackByteLength: renderState.renderRowsReadbackByteLength ?? null,
            renderRowsDecodedMaterialPhaseCounts: renderState.renderRowsDecodedMaterialPhaseCounts ?? null,
            renderRowsDecodedMaterialPhaseDomainCounts: renderState.renderRowsDecodedMaterialPhaseDomainCounts ?? null,
            renderRowsDecodedMaterialPhaseDomainBounds: renderState.renderRowsDecodedMaterialPhaseDomainBounds ?? null,
            renderRowsDecodedPositionCount: renderState.renderRowsDecodedPositionCount ?? null,
            renderRowsDecodedTotalMassKg: finiteOrNull(renderState.renderRowsDecodedTotalMassKg),
            renderRowsDecodedCenterOfMassM: cloneFiniteVector(renderState.renderRowsDecodedCenterOfMassM),
            renderRowsDecodedPositionBoundsM: compactPositionBounds(renderState.renderRowsDecodedPositionBoundsM),
            renderRowsDecodedMaxVolumeRatioJ:
              finiteOrNull(renderState.renderRowsDecodedMaxVolumeRatioJ),
            renderRowsDecodedVolumeRatioCapBoundary:
              renderState.renderRowsDecodedVolumeRatioCapBoundary ?? null,
            renderRowsDecodedVolumeRatioCapBoundaryCount:
              renderState.renderRowsDecodedVolumeRatioCapBoundaryCount ?? null,
            renderRowsDecodedVolumeRatioCapBoundaryMaterialPhaseCounts:
              renderState.renderRowsDecodedVolumeRatioCapBoundaryMaterialPhaseCounts ?? null,
            renderRowsParticleScaleMaxSupportRadiusSmoothingRatioAllowed:
              renderState.renderRowsParticleScaleMaxSupportRadiusSmoothingRatioAllowed ?? null,
            renderRowsParticleScaleMaxSupportRadiusM:
              finiteOrNull(renderState.renderRowsParticleScaleMaxSupportRadiusM),
            renderRowsParticleScaleMaxGasRadiusSmoothingRatioAllowed:
              renderState.renderRowsParticleScaleMaxGasRadiusSmoothingRatioAllowed ?? null,
            renderRowsParticleScaleMaxGasParticleRadiusM:
              finiteOrNull(renderState.renderRowsParticleScaleMaxGasParticleRadiusM),
            renderRowsParticleScaleSupportRadiusPolicyAppliedInShader:
              renderState.renderRowsParticleScaleSupportRadiusPolicyAppliedInShader ?? null,
            renderRowsDecodedSampleRows: renderState.renderRowsDecodedSampleRows ?? null,
            gasPressureSummaryStatus: renderState.gasPressureSummaryStatus ?? null,
            gasPressureSummarySource: renderState.gasPressureSummarySource ?? null,
            residentProductMassStatus: renderState.residentProductMassStatus ?? null,
            residentProductMassEosCouplingStatus: renderState.residentProductMassEosCouplingStatus ?? null,
            productEventCount: renderState.productEventCount ?? null,
            productEventCountAuthority: renderState.productEventCountAuthority ?? null,
            productEventControlAuthentication:
              renderState.productEventControlAuthentication ?? null,
            productEventControlHostObserved:
              renderState.productEventControlHostObserved ?? null,
            productEventRowCapacity: renderState.productEventRowCapacity ?? null,
            productEventCountHostKnown: renderState.productEventCountHostKnown ?? null,
            productEventCountAuthorityGeneration:
              renderState.productEventCountAuthorityGeneration ?? null,
            productEventCountAuthoritySeal:
              renderState.productEventCountAuthoritySeal ?? null,
            productEventBufferBound: renderState.productEventBufferBound ?? null,
            productEventBufferByteLength: renderState.productEventBufferByteLength ?? null,
            surfaceDrawStatus: renderState.surfaceDrawStatus ?? null,
            surfaceDrawActiveSurfaceCount: renderState.surfaceDrawActiveSurfaceCount ?? null,
            surfaceDrawVertexCount: renderState.surfaceDrawVertexCount ?? null,
            surfaceDrawTriangleCount: renderState.surfaceDrawTriangleCount ?? null,
            surfaceDrawSourceVertexRowCount: renderState.surfaceDrawSourceVertexRowCount ?? null,
            surfaceDrawSourceVertexCounterMode: renderState.surfaceDrawSourceVertexCounterMode ?? null,
            surfaceDrawSourceVertexCounterBufferBound:
              renderState.surfaceDrawSourceVertexCounterBufferBound ?? null,
            surfaceDrawSourceVertexCounterBufferByteLength:
              renderState.surfaceDrawSourceVertexCounterBufferByteLength ?? null,
            surfaceDrawRowsBufferRetained: renderState.surfaceDrawRowsBufferRetained ?? null,
            surfaceDrawRowsBufferByteLength: renderState.surfaceDrawRowsBufferByteLength ?? null,
            surfaceDrawIndirectRowsBufferRetained: renderState.surfaceDrawIndirectRowsBufferRetained ?? null,
            surfaceDrawIndirectRowsBufferByteLength: renderState.surfaceDrawIndirectRowsBufferByteLength ?? null,
            surfaceDrawAggregateIndirectRowsBufferRetained:
              renderState.surfaceDrawAggregateIndirectRowsBufferRetained ?? null,
            surfaceDrawAggregateIndirectRowsBufferByteLength:
              renderState.surfaceDrawAggregateIndirectRowsBufferByteLength ?? null,
            surfaceDrawCompactedVertexRowsBufferRetained: renderState.surfaceDrawCompactedVertexRowsBufferRetained ?? null,
            surfaceDrawCompactedVertexRowsBufferByteLength: renderState.surfaceDrawCompactedVertexRowsBufferByteLength ?? null,
            surfaceDrawCompactPositionRowsBufferRetained:
              renderState.surfaceDrawCompactPositionRowsBufferRetained ?? null,
            surfaceDrawCompactPositionRowsBufferByteLength:
              renderState.surfaceDrawCompactPositionRowsBufferByteLength ?? null,
            surfaceDrawCompactPositionRowsVertexCount:
              renderState.surfaceDrawCompactPositionRowsVertexCount ?? null,
            surfaceDrawCompactPositionRowsStrideFloats:
              renderState.surfaceDrawCompactPositionRowsStrideFloats ?? null,
            surfaceDrawDirectCompactPositionDraw:
              renderState.surfaceDrawDirectCompactPositionDraw ?? null,
            surfaceDrawRenderBridgeExternalGpuBufferInputLayout:
              renderState.surfaceDrawRenderBridgeExternalGpuBufferInputLayout ?? null,
            surfaceDrawRenderBridgeCompactPositionDirectInput:
              renderState.surfaceDrawRenderBridgeCompactPositionDirectInput ?? null,
            surfaceDrawNativeMarchingCubesSurfaceTableBudgetStatus:
              renderState.surfaceDrawNativeMarchingCubesSurfaceTableBudgetStatus ?? null,
            surfaceDrawNativeMarchingCubesSurfaceTableMaxResolution:
              renderState.surfaceDrawNativeMarchingCubesSurfaceTableMaxResolution ?? null,
            surfaceDrawNativeMarchingCubesMaxVertexRowsBufferByteLength:
              renderState.surfaceDrawNativeMarchingCubesMaxVertexRowsBufferByteLength ?? null,
            surfaceDrawNativeMarchingCubesEstimatedMaxVertexRowsBufferByteLength:
              renderState.surfaceDrawNativeMarchingCubesEstimatedMaxVertexRowsBufferByteLength ?? null,
            surfaceDrawVisibleRendererBridge: renderState.surfaceDrawVisibleRendererBridge ?? null,
            surfaceDrawVisibleRenderSource: renderState.surfaceDrawVisibleRenderSource ?? null,
            surfaceDrawOverlayPolicyStatus: renderState.surfaceDrawOverlayPolicyStatus ?? null,
            surfaceDrawOverlayPolicyMode: renderState.surfaceDrawOverlayPolicyMode ?? null,
            surfaceDrawOverlayPolicyEnabled: renderState.surfaceDrawOverlayPolicyEnabled ?? null,
            surfaceDrawReadback: renderState.surfaceDrawReadback ?? null,
            surfaceDrawSummaryReadback: renderState.surfaceDrawSummaryReadback ?? null,
            surfaceDrawSummaryReadbackByteLength: renderState.surfaceDrawSummaryReadbackByteLength ?? null,
            surfaceDrawGpuOnlyHandoff: renderState.surfaceDrawGpuOnlyHandoff ?? null,
            surfaceDrawGpuOnlyHandoffStatus: renderState.surfaceDrawGpuOnlyHandoffStatus ?? null,
            surfaceDrawGpuOnlyHandoffReason: renderState.surfaceDrawGpuOnlyHandoffReason ?? null,
            surfaceDrawGpuOnlyUpperBoundVertexCount: renderState.surfaceDrawGpuOnlyUpperBoundVertexCount ?? null,
            surfaceDrawGpuOnlyUpperBoundTriangleCount: renderState.surfaceDrawGpuOnlyUpperBoundTriangleCount ?? null,
            surfaceDrawGpuOnlyAggregateIndirectReady:
              renderState.surfaceDrawGpuOnlyAggregateIndirectReady ?? null,
            surfaceDrawGpuOnlyAggregateDrawRangeExact:
              renderState.surfaceDrawGpuOnlyAggregateDrawRangeExact ?? null,
            surfaceDrawGpuOnlyDrawRangeConservative: renderState.surfaceDrawGpuOnlyDrawRangeConservative ?? null,
            surfaceDrawGpuBufferHandoffReady: renderState.surfaceDrawGpuBufferHandoffReady ?? null,
            surfaceDrawGpuBufferHandoffStatus: renderState.surfaceDrawGpuBufferHandoffStatus ?? null,
            surfaceDrawGpuBufferHandoffReason: renderState.surfaceDrawGpuBufferHandoffReason ?? null,
            surfaceDrawGpuBufferHandoffKind: renderState.surfaceDrawGpuBufferHandoffKind ?? null,
            surfaceDrawGpuBufferHandoffInputSchema: renderState.surfaceDrawGpuBufferHandoffInputSchema ?? null,
            surfaceDrawGpuBufferHandoffRequiresSurfaceExtraction:
              renderState.surfaceDrawGpuBufferHandoffRequiresSurfaceExtraction ?? null,
            surfaceDrawNativeMarchingCubesExtractionAllowed:
              renderState.surfaceDrawNativeMarchingCubesExtractionAllowed ?? null,
            surfaceDrawNativeMarchingCubesExtractionStatus:
              renderState.surfaceDrawNativeMarchingCubesExtractionStatus ?? null,
            surfaceDrawNativeMarchingCubesExtractionReason:
              renderState.surfaceDrawNativeMarchingCubesExtractionReason ?? null,
            surfaceDrawNativeMarchingCubesExtractionElapsedMs:
              renderState.surfaceDrawNativeMarchingCubesExtractionElapsedMs ?? null,
            surfaceDrawNativeMarchingCubesExtensionExecutionElapsedMs:
              renderState.surfaceDrawNativeMarchingCubesExtensionExecutionElapsedMs ?? null,
            surfaceDrawNativeMarchingCubesTotalElapsedMs:
              renderState.surfaceDrawNativeMarchingCubesTotalElapsedMs ?? null,
            surfaceDrawNativeMarchingCubesExtractionErrorName:
              renderState.surfaceDrawNativeMarchingCubesExtractionErrorName ?? null,
            surfaceDrawNativeMarchingCubesExtractionErrorStatus:
              renderState.surfaceDrawNativeMarchingCubesExtractionErrorStatus ?? null,
            surfaceDrawNativeMarchingCubesExtractionErrorStage:
              renderState.surfaceDrawNativeMarchingCubesExtractionErrorStage ?? null,
            surfaceDrawNativeMarchingCubesExtractionErrorStack:
              renderState.surfaceDrawNativeMarchingCubesExtractionErrorStack ?? null,
            surfaceDrawNativeMarchingCubesAdapterCacheStatus:
              renderState.surfaceDrawNativeMarchingCubesAdapterCacheStatus ?? null,
            surfaceDrawNativeMarchingCubesAdapterCacheReason:
              renderState.surfaceDrawNativeMarchingCubesAdapterCacheReason ?? null,
            surfaceDrawNativeMarchingCubesAdapterCacheHit:
              renderState.surfaceDrawNativeMarchingCubesAdapterCacheHit ?? null,
            surfaceDrawNativeMarchingCubesAdapterCacheEntryCount:
              renderState.surfaceDrawNativeMarchingCubesAdapterCacheEntryCount ?? null,
            surfaceDrawNativeMarchingCubesAdapterCacheHitCount:
              renderState.surfaceDrawNativeMarchingCubesAdapterCacheHitCount ?? null,
            surfaceDrawNativeMarchingCubesAdapterCacheMissCount:
              renderState.surfaceDrawNativeMarchingCubesAdapterCacheMissCount ?? null,
            surfaceDrawNativeMarchingCubesAdapterCacheReleaseCount:
              renderState.surfaceDrawNativeMarchingCubesAdapterCacheReleaseCount ?? null,
            surfaceDrawExtensionSurfaceTranslationElapsedMs:
              renderState.surfaceDrawExtensionSurfaceTranslationElapsedMs ?? null,
            surfaceDrawExtensionSurfaceAdapterExecutionStatus:
              renderState.surfaceDrawExtensionSurfaceAdapterExecutionStatus
              ?? null,
            surfaceDrawExtensionSurfaceRawExecutionStatus:
              renderState.surfaceDrawExtensionSurfaceRawExecutionStatus
              ?? null,
            surfaceDrawExtensionSurfaceRawVertexCount:
              renderState.surfaceDrawExtensionSurfaceRawVertexCount ?? null,
            surfaceDrawExtensionSurfaceTranslationPipelineCacheStatus:
              renderState.surfaceDrawExtensionSurfaceTranslationPipelineCacheStatus ?? null,
            surfaceDrawExtensionSurfaceTranslationPipelineCreated:
              renderState.surfaceDrawExtensionSurfaceTranslationPipelineCreated ?? null,
            surfaceDrawExtensionSurfaceTranslationBindGroupCreated:
              renderState.surfaceDrawExtensionSurfaceTranslationBindGroupCreated ?? null,
            surfaceDrawExtensionSurfaceTranslationCommandEncoderCreated:
              renderState.surfaceDrawExtensionSurfaceTranslationCommandEncoderCreated ?? null,
            surfaceDrawExtensionSurfaceTranslationWorkgroupCountX:
              renderState.surfaceDrawExtensionSurfaceTranslationWorkgroupCountX ?? null,
            surfaceDrawExtensionSurfaceTranslationSubmissionObserved:
              renderState.surfaceDrawExtensionSurfaceTranslationSubmissionObserved ?? null,
            surfaceDrawExtensionSurfaceDirectCompactPositionDrawIndirectSource:
              renderState.surfaceDrawExtensionSurfaceDirectCompactPositionDrawIndirectSource ?? null,
            surfaceDrawExtensionSurfaceDrawIndirectRowsOwnership:
              renderState.surfaceDrawExtensionSurfaceDrawIndirectRowsOwnership ?? null,
            surfaceDrawExtensionSurfaceDrawIndirectBufferRetained:
              renderState.surfaceDrawExtensionSurfaceDrawIndirectBufferRetained ?? null,
            surfaceDrawExtensionSurfaceDrawIndirectBufferByteLength:
              renderState.surfaceDrawExtensionSurfaceDrawIndirectBufferByteLength ?? null,
            surfaceDrawExtensionSurfaceQueueCompletionStatus:
              renderState.surfaceDrawExtensionSurfaceQueueCompletionStatus ?? null,
            surfaceDrawExtensionSurfaceQueueCompletionMethod:
              renderState.surfaceDrawExtensionSurfaceQueueCompletionMethod ?? null,
            surfaceDrawExtensionSurfaceHotLoopGpuTranslationRequired:
              renderState.surfaceDrawExtensionSurfaceHotLoopGpuTranslationRequired ?? null,
            surfaceDrawExtensionSurfaceVertexRowsBufferClearStatus:
              renderState.surfaceDrawExtensionSurfaceVertexRowsBufferClearStatus ?? null,
            surfaceDrawExtensionSurfaceRenderBridgeBuildElapsedMs:
              renderState.surfaceDrawExtensionSurfaceRenderBridgeBuildElapsedMs ?? null,
            surfaceDrawExtensionSurfaceRefreshElapsedMs:
              renderState.surfaceDrawExtensionSurfaceRefreshElapsedMs ?? null,
            surfaceDrawGpuBufferHandoffReadbackMode: renderState.surfaceDrawGpuBufferHandoffReadbackMode ?? null,
            surfaceDrawGpuBufferHandoffNoFullReadback: renderState.surfaceDrawGpuBufferHandoffNoFullReadback ?? null,
            surfaceDrawGpuBufferHandoffNoSummaryReadback:
              renderState.surfaceDrawGpuBufferHandoffNoSummaryReadback ?? null,
            surfaceDrawGpuBufferHandoffUpperBoundVertexCount:
              renderState.surfaceDrawGpuBufferHandoffUpperBoundVertexCount ?? null,
            surfaceDrawGpuBufferHandoffUpperBoundTriangleCount:
              renderState.surfaceDrawGpuBufferHandoffUpperBoundTriangleCount ?? null,
            surfaceDrawGpuBufferHandoffConservativeDrawRange:
              renderState.surfaceDrawGpuBufferHandoffConservativeDrawRange ?? null,
            surfaceDrawVisibleGpuConsumerReady: renderState.surfaceDrawVisibleGpuConsumerReady ?? null,
            surfaceDrawVisibleGpuConsumerStatus: renderState.surfaceDrawVisibleGpuConsumerStatus ?? null,
            surfaceDrawVisibleGpuConsumerReason: renderState.surfaceDrawVisibleGpuConsumerReason ?? null,
            surfaceDrawVisibleGpuConsumerInputReady: renderState.surfaceDrawVisibleGpuConsumerInputReady ?? null,
            surfaceDrawVisibleGpuConsumerInputKind: renderState.surfaceDrawVisibleGpuConsumerInputKind ?? null,
            surfaceDrawVisibleGpuConsumerInputStatus: renderState.surfaceDrawVisibleGpuConsumerInputStatus ?? null,
            surfaceDrawVisibleGpuConsumerRuntimeReady: renderState.surfaceDrawVisibleGpuConsumerRuntimeReady ?? null,
            surfaceDrawVisibleGpuConsumerRuntimePresentationAdmitted:
              currentSurfaceDrawConsumerValue(
                'surfaceDrawVisibleGpuConsumerRuntimePresentationAdmitted'
              ),
            surfaceDrawVisibleGpuConsumerForegroundProofValidated:
              currentSurfaceDrawConsumerValue(
                'surfaceDrawVisibleGpuConsumerForegroundProofValidated'
              ),
            surfaceDrawVisibleGpuConsumerSameQueueStructuralSubmissionAdmitted:
              currentSurfaceDrawConsumerValue(
                'surfaceDrawVisibleGpuConsumerSameQueueStructuralSubmissionAdmitted'
              ),
            surfaceDrawVisibleGpuConsumerSameQueueForegroundSubmissionValidated:
              currentSurfaceDrawConsumerValue(
                'surfaceDrawVisibleGpuConsumerSameQueueForegroundSubmissionValidated'
              ),
            surfaceDrawVisibleGpuConsumerOffscreenForegroundValidated:
              currentSurfaceDrawConsumerValue(
                'surfaceDrawVisibleGpuConsumerOffscreenForegroundValidated'
              ),
            surfaceDrawVisibleGpuConsumerBrowserFrameForegroundValidated:
              currentSurfaceDrawConsumerValue(
                'surfaceDrawVisibleGpuConsumerBrowserFrameForegroundValidated'
              ),
            surfaceDrawVisibleGpuConsumerNativeCandidateForegroundValidationStatus:
              currentSurfaceDrawConsumerValue(
                'surfaceDrawVisibleGpuConsumerNativeCandidateForegroundValidationStatus'
              ),
            surfaceDrawVisibleGpuConsumerNativeCandidateForegroundProofKind:
              currentSurfaceDrawConsumerValue(
                'surfaceDrawVisibleGpuConsumerNativeCandidateForegroundProofKind'
              ),
            surfaceDrawVisibleGpuConsumerNativeCandidateForegroundSameQueueSubmissionBoundary:
              currentSurfaceDrawConsumerValue(
                'surfaceDrawVisibleGpuConsumerNativeCandidateForegroundSameQueueSubmissionBoundary'
              ),
            surfaceDrawVisibleGpuConsumerNativeCandidateForegroundSubmittedDrawCount:
              currentSurfaceDrawConsumerValue(
                'surfaceDrawVisibleGpuConsumerNativeCandidateForegroundSubmittedDrawCount'
              ),
            surfaceDrawVisibleGpuConsumerNativeCandidateForegroundResourceGeneration:
              currentSurfaceDrawConsumerValue(
                'surfaceDrawVisibleGpuConsumerNativeCandidateForegroundResourceGeneration'
              ),
            surfaceDrawVisibleGpuConsumerNativeActiveResourceGeneration:
              currentSurfaceDrawConsumerValue(
                'surfaceDrawVisibleGpuConsumerNativeActiveResourceGeneration'
              ),
            surfaceDrawVisibleGpuConsumerNativeOffscreenValidationNonzeroPixelCount:
              currentSurfaceDrawConsumerValue(
                'surfaceDrawVisibleGpuConsumerNativeOffscreenValidationNonzeroPixelCount'
              ),
            surfaceDrawVisibleGpuConsumerNativeOffscreenValidationResourceGeneration:
              currentSurfaceDrawConsumerValue(
                'surfaceDrawVisibleGpuConsumerNativeOffscreenValidationResourceGeneration'
              ),
            surfaceDrawVisibleGpuConsumerNativePixelValidationSource:
              currentSurfaceDrawConsumerValue(
                'surfaceDrawVisibleGpuConsumerNativePixelValidationSource'
              ),
            surfaceDrawVisibleGpuConsumerNativePixelValidationNonzeroPixelCount:
              currentSurfaceDrawConsumerValue(
                'surfaceDrawVisibleGpuConsumerNativePixelValidationNonzeroPixelCount'
              ),
            surfaceDrawVisibleGpuConsumerNativePixelValidationResourceGeneration:
              currentSurfaceDrawConsumerValue(
                'surfaceDrawVisibleGpuConsumerNativePixelValidationResourceGeneration'
              ),
            surfaceDrawVisibleGpuConsumerRenderBridgeMode:
              renderState.surfaceDrawVisibleGpuConsumerRenderBridgeMode ?? null,
            surfaceDrawVisibleGpuConsumerRenderBridgeStatus:
              renderState.surfaceDrawVisibleGpuConsumerRenderBridgeStatus ?? null,
            surfaceDrawVisibleGpuConsumerRendererCapabilityStatus:
              renderState.surfaceDrawVisibleGpuConsumerRendererCapabilityStatus ?? null,
            surfaceDrawVisibleGpuConsumerPixelValidationStatus:
              renderState.surfaceDrawVisibleGpuConsumerPixelValidationStatus ?? null,
            surfaceDrawVisibleGpuConsumerValidated:
              renderState.surfaceDrawVisibleGpuConsumerValidated ?? null,
            surfaceDrawVisibleGpuConsumerNativeReadbackFallbackValidated:
              renderState.surfaceDrawVisibleGpuConsumerNativeReadbackFallbackValidated ?? null,
            surfaceDrawVisibleGpuConsumerNativeReadbackSmokeValidationStatus:
              renderState.surfaceDrawVisibleGpuConsumerNativeReadbackSmokeValidationStatus ?? null,
            surfaceDrawVisibleGpuConsumerNativeOffscreenValidationStatus:
              renderState.surfaceDrawVisibleGpuConsumerNativeOffscreenValidationStatus ?? null,
            surfaceDrawVisibleGpuConsumerNativeDeviceMapSmokeStatus:
              renderState.surfaceDrawVisibleGpuConsumerNativeDeviceMapSmokeStatus ?? null,
            surfaceDrawVisibleGpuConsumerNativeDeviceTextureReadbackSmokeStatus:
              renderState.surfaceDrawVisibleGpuConsumerNativeDeviceTextureReadbackSmokeStatus ?? null,
            surfaceDrawVisibleGpuConsumerNativeDeviceTextureReadbackSmokeReason:
              renderState.surfaceDrawVisibleGpuConsumerNativeDeviceTextureReadbackSmokeReason ?? null,
            surfaceDrawVisibleGpuConsumerNativeValidationBlockerFamily:
              renderState.surfaceDrawVisibleGpuConsumerNativeValidationBlockerFamily ?? null,
            surfaceDrawVisibleGpuConsumerNativeTextureReadbackUnavailable:
              renderState.surfaceDrawVisibleGpuConsumerNativeTextureReadbackUnavailable ?? null,
            fullSurfaceDrawReadback: renderState.fullSurfaceDrawReadback ?? null,
            surfaceDrawDiagnosticOnly: renderState.surfaceDrawDiagnosticOnly ?? null,
            surfaceDrawDiagnosticOnlyMode: renderState.surfaceDrawDiagnosticOnlyMode ?? null,
            surfaceDrawRenderBridgeStatus: renderState.surfaceDrawRenderBridgeStatus ?? null,
            surfaceDrawRenderBridgeReason: renderState.surfaceDrawRenderBridgeReason ?? null,
            surfaceDrawRenderBridgeCapabilityStatus: renderState.surfaceDrawRenderBridgeCapabilityStatus ?? null,
            surfaceDrawRenderBridgeCapabilityReason: renderState.surfaceDrawRenderBridgeCapabilityReason ?? null,
            surfaceDrawRenderBridgeRendererBackend: renderState.surfaceDrawRenderBridgeRendererBackend ?? null,
            surfaceDrawRenderBridgeParticleRenderMode:
              renderState.surfaceDrawRenderBridgeParticleRenderMode ?? null,
            surfaceDrawRenderBridgeSphereMaterialSummaries:
              Array.isArray(renderState.surfaceDrawRenderBridgeSphereMaterialSummaries)
                ? renderState.surfaceDrawRenderBridgeSphereMaterialSummaries.map((summary) => ({ ...summary }))
                : [],
            surfaceDrawRenderBridgeSphereSizingMode:
              renderState.surfaceDrawRenderBridgeSphereSizingMode ?? null,
            surfaceDrawRenderBridgeSphereVariableSize:
              renderState.surfaceDrawRenderBridgeSphereVariableSize ?? null,
            surfaceDrawRenderBridgeSpherePbrMaterialSource:
              renderState.surfaceDrawRenderBridgeSpherePbrMaterialSource ?? null,
            surfaceDrawRenderBridgeSphereClosurePbr:
              renderState.surfaceDrawRenderBridgeSphereClosurePbr ?? null,
            surfaceDrawRenderBridgeSphereMetallicVisibilityProxyCount:
              renderState.surfaceDrawRenderBridgeSphereMetallicVisibilityProxyCount ?? null,
            surfaceDrawRenderBridgeVisibleNoReadbackSupported: renderState.surfaceDrawRenderBridgeVisibleNoReadbackSupported ?? null,
            surfaceDrawRenderBridgeLastRenderStatus: renderState.surfaceDrawRenderBridgeLastRenderStatus ?? null,
            surfaceDrawRenderBridgeNativeSurfaceReuseStatus:
              renderState.surfaceDrawRenderBridgeNativeSurfaceReuseStatus
              ?? null,
            surfaceDrawRenderBridgeFrameCount: renderState.surfaceDrawRenderBridgeFrameCount ?? null,
            surfaceDrawRenderBridgeNativeSurfaceCandidateStageSubmissionCount:
              renderState.surfaceDrawRenderBridgeNativeSurfaceCandidateStageSubmissionCount ?? null,
            surfaceDrawRenderBridgeNativeSurfaceCandidateStageSubmittedAtMs:
              renderState.surfaceDrawRenderBridgeNativeSurfaceCandidateStageSubmittedAtMs ?? null,
            surfaceDrawRenderBridgeNativeSurfaceCandidatePresentationCopyCount:
              renderState.surfaceDrawRenderBridgeNativeSurfaceCandidatePresentationCopyCount ?? null,
            surfaceDrawRenderBridgeNativeSurfaceCandidatePresentationPostAdmissionGeometrySubmitCount:
              renderState.surfaceDrawRenderBridgeNativeSurfaceCandidatePresentationPostAdmissionGeometrySubmitCount ?? null,
            surfaceDrawRenderBridgeNativeSurfaceCandidateStagedPresentationStatus:
              renderState.surfaceDrawRenderBridgeNativeSurfaceCandidateStagedPresentationStatus ?? null,
            surfaceDrawRenderBridgeNativeSurfaceCandidateStagedPresentationReason:
              renderState.surfaceDrawRenderBridgeNativeSurfaceCandidateStagedPresentationReason ?? null,
            surfaceDrawRenderBridgeNativeSurfaceCandidateStagedPresentationChangedPixelCount:
              renderState.surfaceDrawRenderBridgeNativeSurfaceCandidateStagedPresentationChangedPixelCount ?? null,
            surfaceDrawRenderBridgeNativeSurfaceCandidateStagedPresentationGeneration:
              renderState.surfaceDrawRenderBridgeNativeSurfaceCandidateStagedPresentationGeneration ?? null,
            surfaceDrawRenderBridgeThreeMeshCount: renderState.surfaceDrawRenderBridgeThreeMeshCount ?? null,
            surfaceDrawRenderBridgeThreeGeometryByteLength: renderState.surfaceDrawRenderBridgeThreeGeometryByteLength ?? null,
            surfaceDrawRenderBridgeEngineIntegration: renderState.surfaceDrawRenderBridgeEngineIntegration ?? null,
            surfaceDrawRenderBridgeExternalGpuBufferGeometry:
              renderState.surfaceDrawRenderBridgeExternalGpuBufferGeometry ?? null,
            surfaceDrawRenderBridgeExternalGpuBufferNormalAttribute:
              renderState.surfaceDrawRenderBridgeExternalGpuBufferNormalAttribute ?? null,
            surfaceDrawRenderBridgeExternalGpuBufferNormalAttributeDisabledReason:
              renderState.surfaceDrawRenderBridgeExternalGpuBufferNormalAttributeDisabledReason ?? null,
            surfaceDrawRenderBridgeExternalGpuBufferIndirect:
              renderState.surfaceDrawRenderBridgeExternalGpuBufferIndirect ?? null,
            surfaceDrawRenderBridgeExternalGpuBufferIndirectRuntimeValidated:
              renderState.surfaceDrawRenderBridgeExternalGpuBufferIndirectRuntimeValidated ?? null,
            surfaceDrawRenderBridgeExternalGpuBufferIndirectDisabledReason:
              renderState.surfaceDrawRenderBridgeExternalGpuBufferIndirectDisabledReason ?? null,
            surfaceDrawRenderBridgeNativeWebGpuSurfaceConsumer:
              renderState.surfaceDrawRenderBridgeNativeWebGpuSurfaceConsumer ?? null,
            surfaceDrawRenderBridgeNativeWebGpuSurfaceConsumerEngineIntegration:
              renderState.surfaceDrawRenderBridgeNativeWebGpuSurfaceConsumerEngineIntegration ?? null,
            surfaceDrawRenderBridgeNativeWebGpuSurfaceConsumerRuntimeValidated:
              renderState.surfaceDrawRenderBridgeNativeWebGpuSurfaceConsumerRuntimeValidated ?? null,
            surfaceDrawRenderBridgeNativeWebGpuSurfaceConsumerPixelValidationStatus:
              renderState.surfaceDrawRenderBridgeNativeWebGpuSurfaceConsumerPixelValidationStatus ?? null,
            surfaceDrawRenderBridgeNativeWebGpuSurfaceConsumerOffscreenValidationStatus:
              renderState.surfaceDrawRenderBridgeNativeWebGpuSurfaceConsumerOffscreenValidationStatus ?? null,
            surfaceDrawRenderBridgeNativeSurfaceConsumerSubmitFencePending:
              renderState.surfaceDrawRenderBridgeNativeSurfaceConsumerSubmitFencePending ?? null,
            surfaceDrawRenderBridgeNativeSurfaceConsumerSubmitFenceSerial:
              renderState.surfaceDrawRenderBridgeNativeSurfaceConsumerSubmitFenceSerial ?? null,
            surfaceDrawRenderBridgeNativeSurfaceConsumerSubmitFenceReason:
              renderState.surfaceDrawRenderBridgeNativeSurfaceConsumerSubmitFenceReason ?? null,
            surfaceDrawRenderBridgeNativeSurfaceConsumerSubmitFenceElapsedMs:
              renderState.surfaceDrawRenderBridgeNativeSurfaceConsumerSubmitFenceElapsedMs ?? null,
            surfaceDrawRenderBridgeNativeSurfaceConsumerSubmitFenceTimedOut:
              renderState.surfaceDrawRenderBridgeNativeSurfaceConsumerSubmitFenceTimedOut ?? null,
            surfaceDrawRenderBridgeOffscreenValidationStatus:
              renderState.surfaceDrawRenderBridgeOffscreenValidationStatus ?? null,
            surfaceDrawRenderBridgeOffscreenValidationReason:
              renderState.surfaceDrawRenderBridgeOffscreenValidationReason ?? null,
            surfaceDrawRenderBridgeOffscreenValidationSample:
              Array.isArray(renderState.surfaceDrawRenderBridgeOffscreenValidationSample)
                ? [...renderState.surfaceDrawRenderBridgeOffscreenValidationSample]
                : null,
            surfaceDrawRenderBridgeReadbackSmokeValidationStatus:
              renderState.surfaceDrawRenderBridgeReadbackSmokeValidationStatus ?? null,
            surfaceDrawRenderBridgeReadbackSmokeValidationReason:
              renderState.surfaceDrawRenderBridgeReadbackSmokeValidationReason ?? null,
            surfaceDrawRenderBridgeReadbackSmokeValidationSample:
              Array.isArray(renderState.surfaceDrawRenderBridgeReadbackSmokeValidationSample)
                ? [...renderState.surfaceDrawRenderBridgeReadbackSmokeValidationSample]
                : null,
            surfaceDrawRenderBridgeReadbackSmokeValidationAttemptCount:
              renderState.surfaceDrawRenderBridgeReadbackSmokeValidationAttemptCount ?? null,
            surfaceDrawRenderBridgeOffscreenValidationNonzeroPixelCount:
              renderState.surfaceDrawRenderBridgeOffscreenValidationNonzeroPixelCount ?? null,
            surfaceDrawRenderBridgeOffscreenValidationPixelCount:
              renderState.surfaceDrawRenderBridgeOffscreenValidationPixelCount ?? null,
            surfaceDrawRenderBridgeOffscreenValidationWidth:
              renderState.surfaceDrawRenderBridgeOffscreenValidationWidth ?? null,
            surfaceDrawRenderBridgeOffscreenValidationHeight:
              renderState.surfaceDrawRenderBridgeOffscreenValidationHeight ?? null,
            surfaceDrawRenderBridgeOffscreenValidationAttemptCount:
              renderState.surfaceDrawRenderBridgeOffscreenValidationAttemptCount ?? null,
            surfaceDrawRenderBridgeNativeSurfaceValidationCadenceStatus:
              renderState.surfaceDrawRenderBridgeNativeSurfaceValidationCadenceStatus ?? null,
            surfaceDrawRenderBridgeNativeSurfaceValidationCadenceReason:
              renderState.surfaceDrawRenderBridgeNativeSurfaceValidationCadenceReason ?? null,
            surfaceDrawRenderBridgeNativeSurfaceValidationEncoderRequired:
              renderState.surfaceDrawRenderBridgeNativeSurfaceValidationEncoderRequired ?? null,
            surfaceDrawRenderBridgeNativeSurfaceValidationScope:
              renderState.surfaceDrawRenderBridgeNativeSurfaceValidationScope ?? null,
            surfaceDrawRenderBridgeNativeSurfaceReadbackSmokeValidationNeeded:
              renderState.surfaceDrawRenderBridgeNativeSurfaceReadbackSmokeValidationNeeded ?? null,
            surfaceDrawRenderBridgeNativeSurfaceOffscreenValidationEligible:
              renderState.surfaceDrawRenderBridgeNativeSurfaceOffscreenValidationEligible ?? null,
            surfaceDrawRenderBridgeNativeSurfaceOffscreenValidationNeeded:
              renderState.surfaceDrawRenderBridgeNativeSurfaceOffscreenValidationNeeded ?? null,
            surfaceDrawRenderBridgeNativeSurfaceOffscreenValidationSkippedReason:
              renderState.surfaceDrawRenderBridgeNativeSurfaceOffscreenValidationSkippedReason ?? null,
            surfaceDrawRenderBridgeRenderAttemptCount:
              renderState.surfaceDrawRenderBridgeRenderAttemptCount ?? null,
            surfaceDrawRenderBridgeRenderSkipCount:
              renderState.surfaceDrawRenderBridgeRenderSkipCount ?? null,
            surfaceDrawRenderBridgeLastRenderAttemptReason:
              renderState.surfaceDrawRenderBridgeLastRenderAttemptReason ?? null,
            surfaceDrawRenderBridgeLastRenderAttemptAtMs:
              renderState.surfaceDrawRenderBridgeLastRenderAttemptAtMs ?? null,
            surfaceDrawRenderBridgeLastRenderSkipStatus:
              renderState.surfaceDrawRenderBridgeLastRenderSkipStatus ?? null,
            surfaceDrawRenderBridgeLastRenderSkipReason:
              renderState.surfaceDrawRenderBridgeLastRenderSkipReason ?? null,
            surfaceDrawRenderBridgeNativeSurfaceConsumerRafSustain:
              renderState.surfaceDrawRenderBridgeNativeSurfaceConsumerRafSustain ?? null,
            surfaceDrawRenderBridgeLastNativeSurfaceConsumerRafReason:
              renderState.surfaceDrawRenderBridgeLastNativeSurfaceConsumerRafReason ?? null,
            surfaceDrawRenderBridgeLastNativeSurfaceConsumerRafScheduleReason:
              renderState.surfaceDrawRenderBridgeLastNativeSurfaceConsumerRafScheduleReason ?? null,
            surfaceDrawRenderBridgeNativeSurfaceConsumerRafBlockedReason:
              renderState.surfaceDrawRenderBridgeNativeSurfaceConsumerRafBlockedReason ?? null,
            surfaceDrawRenderBridgeCanvasWidth: renderState.surfaceDrawRenderBridgeCanvasWidth ?? null,
            surfaceDrawRenderBridgeCanvasHeight: renderState.surfaceDrawRenderBridgeCanvasHeight ?? null,
            surfaceDrawRenderBridgeCanvasCssWidth:
              renderState.surfaceDrawRenderBridgeCanvasCssWidth ?? null,
            surfaceDrawRenderBridgeCanvasCssHeight:
              renderState.surfaceDrawRenderBridgeCanvasCssHeight ?? null,
            surfaceDrawRenderBridgeCanvasClientWidth:
              renderState.surfaceDrawRenderBridgeCanvasClientWidth ?? null,
            surfaceDrawRenderBridgeCanvasClientHeight:
              renderState.surfaceDrawRenderBridgeCanvasClientHeight ?? null,
            surfaceDrawRenderBridgeDevicePixelRatio:
              renderState.surfaceDrawRenderBridgeDevicePixelRatio ?? null,
            surfaceDrawRenderBridgeCanvasResizePixelRatio:
              renderState.surfaceDrawRenderBridgeCanvasResizePixelRatio ?? null,
            surfaceDrawRenderBridgeConfiguredCanvasWidth:
              renderState.surfaceDrawRenderBridgeConfiguredCanvasWidth ?? null,
            surfaceDrawRenderBridgeConfiguredCanvasHeight:
              renderState.surfaceDrawRenderBridgeConfiguredCanvasHeight ?? null,
            surfaceDrawRenderBridgeContextConfigureCount:
              renderState.surfaceDrawRenderBridgeContextConfigureCount ?? null,
            surfaceDrawRenderBridgeLastContextConfigureReason:
              renderState.surfaceDrawRenderBridgeLastContextConfigureReason ?? null,
            surfaceDrawRenderBridgeLastNativeContextReconfigured:
              renderState.surfaceDrawRenderBridgeLastNativeContextReconfigured ?? null,
            surfaceDrawRenderBridgeDeviceLost:
              renderState.surfaceDrawRenderBridgeDeviceLost ?? null,
            surfaceDrawRenderBridgeDeviceLostReason:
              renderState.surfaceDrawRenderBridgeDeviceLostReason ?? null,
            surfaceDrawRenderBridgeDeviceLostInfo:
              renderState.surfaceDrawRenderBridgeDeviceLostInfo ?? null,
		            surfaceDrawRenderBridgeLastDrawOrderCount:
		              renderState.surfaceDrawRenderBridgeLastDrawOrderCount ?? null,
	            surfaceDrawRenderBridgeTransparencyCompositeMode:
	              renderState.surfaceDrawRenderBridgeTransparencyCompositeMode ?? null,
	            surfaceDrawRenderBridgeLastOpaqueDrawCount:
	              renderState.surfaceDrawRenderBridgeLastOpaqueDrawCount ?? null,
	            surfaceDrawRenderBridgeLastTransparentDrawCount:
	              renderState.surfaceDrawRenderBridgeLastTransparentDrawCount ?? null,
	            surfaceDrawRenderBridgeNativeSurfaceDebugMode:
	              renderState.surfaceDrawRenderBridgeNativeSurfaceDebugMode ?? null,
	            surfaceDrawRenderBridgeNativeSurfaceDebugStatus:
	              renderState.surfaceDrawRenderBridgeNativeSurfaceDebugStatus ?? null,
	            surfaceDrawRenderBridgeNativeSurfaceDebugSkippedDrawCount:
	              renderState.surfaceDrawRenderBridgeNativeSurfaceDebugSkippedDrawCount ?? null,
		            surfaceDrawRenderBridgeNativeSurfaceDebugClearValue:
		              renderState.surfaceDrawRenderBridgeNativeSurfaceDebugClearValue ?? null,
		            surfaceDrawRenderBridgeNativeSurfaceDeferredResourceReleaseStatus:
		              renderState.surfaceDrawRenderBridgeNativeSurfaceDeferredResourceReleaseStatus ?? null,
		            surfaceDrawRenderBridgeNativeSurfaceDeferredResourceReleaseReason:
		              renderState.surfaceDrawRenderBridgeNativeSurfaceDeferredResourceReleaseReason ?? null,
		            surfaceDrawRenderBridgeNativeSurfaceDeferredResourceReleasePending:
		              renderState.surfaceDrawRenderBridgeNativeSurfaceDeferredResourceReleasePending ?? null,
		            surfaceDrawRenderBridgePrimarySurfaceIndex:
		              renderState.surfaceDrawRenderBridgePrimarySurfaceIndex ?? null,
            surfaceDrawRenderBridgePrimaryBoundsCenterM:
              renderState.surfaceDrawRenderBridgePrimaryBoundsCenterM ?? null,
            surfaceDrawRenderBridgePrimaryBoundsRadiusM:
              renderState.surfaceDrawRenderBridgePrimaryBoundsRadiusM ?? null,
            surfaceDrawRenderBridgePrimaryBoundsClipCenter:
              renderState.surfaceDrawRenderBridgePrimaryBoundsClipCenter ?? null,
            surfaceDrawRenderBridgePrimaryBoundsClipW:
              renderState.surfaceDrawRenderBridgePrimaryBoundsClipW ?? null,
            surfaceDrawRenderBridgePrimaryBoundsNdcCenter:
              renderState.surfaceDrawRenderBridgePrimaryBoundsNdcCenter ?? null,
            surfaceDrawRenderBridgePrimaryBoundsInFront:
              renderState.surfaceDrawRenderBridgePrimaryBoundsInFront ?? null,
            surfaceDrawRenderBridgePrimaryBoundsCenterInsideClip:
              renderState.surfaceDrawRenderBridgePrimaryBoundsCenterInsideClip ?? null,
            surfaceDrawRenderBridgePrimaryBoundsMaybeVisible:
              renderState.surfaceDrawRenderBridgePrimaryBoundsMaybeVisible ?? null,
            surfaceDrawRenderBridgePixelValidationReason:
              renderState.surfaceDrawRenderBridgePixelValidationReason ?? null,
            surfaceDrawRenderBridgePixelValidationSample:
              Array.isArray(renderState.surfaceDrawRenderBridgePixelValidationSample)
                ? [...renderState.surfaceDrawRenderBridgePixelValidationSample]
                : null,
            surfaceDrawRenderBridgeReused: renderState.surfaceDrawRenderBridgeReused ?? null,
            surfaceDrawRenderBridgeUpdateCount: renderState.surfaceDrawRenderBridgeUpdateCount ?? null,
            surfaceDrawSource:
              surfaceDraw?.source ?? renderState.surfaceDrawSource ?? null,
            surfaceDrawRenderBridgeSphereMaterialRendererProxyCount:
              renderState.surfaceDrawRenderBridgeSphereMaterialRendererProxyCount ?? null,
            surfaceDrawRenderBridgeSphereGeometryProxyCount:
              renderState.surfaceDrawRenderBridgeSphereGeometryProxyCount ?? null,
            surfaceDrawRenderBridgeSphereReusedMeshCount: renderState.surfaceDrawRenderBridgeSphereReusedMeshCount ?? null,
            surfaceDrawRenderBridgeSphereCreatedMeshCount: renderState.surfaceDrawRenderBridgeSphereCreatedMeshCount ?? null,
            surfaceDrawRenderBridgeSphereDisposedMeshCount: renderState.surfaceDrawRenderBridgeSphereDisposedMeshCount ?? null,
              materialKeys: Array.isArray(renderState.materialKeys) ? [...renderState.materialKeys] : []
            } : null,
            residentParticleUploadDebug: overlay.__sphResidentParticleUploadDebug || null,
            residentAutoSchedule: overlay.__mlsMpmResidentAutoSchedule || null,
            viewportRefresh: sceneApi.scene?.userData?.sphViewportRefresh || null,
            viewportResize: sceneApi.scene?.userData?.sphViewportResize || null,
            surfaceDraw: surfaceDraw ? {
            schema: surfaceDraw.schema ?? null,
            status: surfaceDraw.status ?? null,
            backend: surfaceDraw.backend ?? null,
            sourceResidentRenderSourceStatus:
              surfaceDraw.sourceResidentRenderSourceStatus ?? null,
            sourceResidentExecutionGeneration:
              surfaceDraw.sourceResidentExecutionGeneration ?? null,
            sourceResidentCurrentExecutionGeneration:
              surfaceDraw.sourceResidentCurrentExecutionGeneration ?? null,
            sourceResidentExecutionGenerationMatchesCurrent:
              surfaceDraw.sourceResidentExecutionGenerationMatchesCurrent ?? null,
            sourceResidentNextStep: surfaceDraw.sourceResidentNextStep ?? null,
            sourceResidentNextTimeS: surfaceDraw.sourceResidentNextTimeS ?? null,
            sourceResidentRetainedPrevious:
              surfaceDraw.sourceResidentRetainedPrevious ?? null,
            sourceResidentRetentionReason:
              surfaceDraw.sourceResidentRetentionReason ?? null,
            residentRenderSourceStaleAfterPublish:
              surfaceDraw.residentRenderSourceStaleAfterPublish ?? null,
            residentRenderSourceStaleReason:
              surfaceDraw.residentRenderSourceStaleReason ?? null,
            overlayPolicyStatus: surfaceDraw.overlayPolicyStatus ?? null,
            overlayPolicyMode: surfaceDraw.overlayPolicyMode ?? null,
            diagnosticMode: surfaceDraw.diagnosticMode ?? null,
            requestedDiagnosticMode: surfaceDraw.requestedDiagnosticMode ?? null,
            diagnosticFallbackReason: surfaceDraw.diagnosticFallbackReason ?? null,
            vertexCount: surfaceDraw.vertexCount ?? null,
            triangleCount: surfaceDraw.triangleCount ?? null,
            activeSurfaceCount: surfaceDraw.activeSurfaceCount ?? null,
            surfaceDrawSurfaces: Array.isArray(surfaceDraw.surfaceDrawSurfaces)
              ? surfaceDraw.surfaceDrawSurfaces
              : [],
            sourceVertexRowCount: surfaceDraw.sourceVertexRowCount ?? null,
            sourceVertexCounterMode: surfaceDraw.sourceVertexCounterMode ?? null,
            sourceVertexCounterBufferBound: surfaceDraw.sourceVertexCounterBufferBound ?? null,
            sourceVertexCounterBufferByteLength: surfaceDraw.sourceVertexCounterBufferByteLength ?? null,
            drawRowsBufferRetained: surfaceDraw.drawRowsBufferRetained ?? null,
            drawRowsBufferByteLength: surfaceDraw.drawRowsBufferByteLength ?? null,
            drawIndirectRowsBufferRetained: surfaceDraw.drawIndirectRowsBufferRetained ?? null,
            drawIndirectRowsBufferByteLength: surfaceDraw.drawIndirectRowsBufferByteLength ?? null,
            drawAggregateIndirectRowsBufferRetained: surfaceDraw.drawAggregateIndirectRowsBufferRetained ?? null,
            drawAggregateIndirectRowsBufferByteLength: surfaceDraw.drawAggregateIndirectRowsBufferByteLength ?? null,
            compactedVertexRowsBufferRetained: surfaceDraw.compactedVertexRowsBufferRetained ?? null,
            compactedVertexRowsBufferByteLength: surfaceDraw.compactedVertexRowsBufferByteLength ?? null,
            compactPositionRowsBufferRetained: surfaceDraw.compactPositionRowsBufferRetained ?? null,
            compactPositionRowsBufferByteLength: surfaceDraw.compactPositionRowsBufferByteLength ?? null,
            directCompactPositionDraw: surfaceDraw.directCompactPositionDraw ?? null,
            renderFieldRowsBufferRetained: surfaceDraw.renderFieldRowsBufferRetained ?? null,
            renderFieldRowsBufferByteLength: surfaceDraw.renderFieldRowsBufferByteLength ?? null,
            renderFieldRowsBufferBorrowed: surfaceDraw.renderFieldRowsBufferBorrowed ?? null,
            renderFieldRowsBufferReused: surfaceDraw.renderFieldRowsBufferReused ?? null,
            renderFieldRowsBufferPoolStatus: surfaceDraw.renderFieldRowsBufferPoolStatus ?? null,
            renderFieldRowsBufferPoolReason: surfaceDraw.renderFieldRowsBufferPoolReason ?? null,
            renderFieldRowsBufferPoolReused: surfaceDraw.renderFieldRowsBufferPoolReused ?? null,
            renderFieldRowsBufferPoolByteLength: surfaceDraw.renderFieldRowsBufferPoolByteLength ?? null,
            renderFieldSurfaceBufferRetained: surfaceDraw.renderFieldSurfaceBufferRetained ?? null,
            renderFieldSurfaceBufferByteLength: surfaceDraw.renderFieldSurfaceBufferByteLength ?? null,
            gpuBufferHandoffReady: surfaceDraw.surfaceDrawGpuBufferHandoffReady ?? null,
            gpuBufferHandoffStatus: surfaceDraw.surfaceDrawGpuBufferHandoffStatus ?? null,
            gpuBufferHandoffReason: surfaceDraw.surfaceDrawGpuBufferHandoffReason ?? null,
            gpuBufferHandoffKind: surfaceDraw.surfaceDrawGpuBufferHandoffKind ?? null,
            gpuBufferHandoffInputSchema: surfaceDraw.surfaceDrawGpuBufferHandoffInputSchema ?? null,
            gpuBufferHandoffRequiresSurfaceExtraction:
              surfaceDraw.surfaceDrawGpuBufferHandoffRequiresSurfaceExtraction ?? null,
            gpuBufferHandoffReadbackMode: surfaceDraw.surfaceDrawGpuBufferHandoffReadbackMode ?? null,
            gpuBufferHandoffUpperBoundVertexCount:
              surfaceDraw.surfaceDrawGpuBufferHandoffUpperBoundVertexCount ?? null,
            gpuBufferHandoffUpperBoundTriangleCount:
              surfaceDraw.surfaceDrawGpuBufferHandoffUpperBoundTriangleCount ?? null,
            gpuBufferHandoffConservativeDrawRange:
              surfaceDraw.surfaceDrawGpuBufferHandoffConservativeDrawRange ?? null,
            visibleGpuConsumerReady: surfaceDraw.surfaceDrawVisibleGpuConsumerReady ?? null,
            visibleGpuConsumerStatus: surfaceDraw.surfaceDrawVisibleGpuConsumerStatus ?? null,
            visibleGpuConsumerReason: surfaceDraw.surfaceDrawVisibleGpuConsumerReason ?? null,
            visibleGpuConsumerInputReady: surfaceDraw.surfaceDrawVisibleGpuConsumerInputReady ?? null,
            visibleGpuConsumerInputKind: surfaceDraw.surfaceDrawVisibleGpuConsumerInputKind ?? null,
            visibleGpuConsumerInputStatus: surfaceDraw.surfaceDrawVisibleGpuConsumerInputStatus ?? null,
            visibleGpuConsumerRuntimeReady: surfaceDraw.surfaceDrawVisibleGpuConsumerRuntimeReady ?? null,
            visibleGpuConsumerRuntimePresentationAdmitted:
              currentSurfaceDrawConsumerValue(
                'surfaceDrawVisibleGpuConsumerRuntimePresentationAdmitted'
              ),
            visibleGpuConsumerForegroundProofValidated:
              currentSurfaceDrawConsumerValue(
                'surfaceDrawVisibleGpuConsumerForegroundProofValidated'
              ),
            visibleGpuConsumerSameQueueStructuralSubmissionAdmitted:
              currentSurfaceDrawConsumerValue(
                'surfaceDrawVisibleGpuConsumerSameQueueStructuralSubmissionAdmitted'
              ),
            visibleGpuConsumerSameQueueForegroundSubmissionValidated:
              currentSurfaceDrawConsumerValue(
                'surfaceDrawVisibleGpuConsumerSameQueueForegroundSubmissionValidated'
              ),
            visibleGpuConsumerOffscreenForegroundValidated:
              currentSurfaceDrawConsumerValue(
                'surfaceDrawVisibleGpuConsumerOffscreenForegroundValidated'
              ),
            visibleGpuConsumerBrowserFrameForegroundValidated:
              currentSurfaceDrawConsumerValue(
                'surfaceDrawVisibleGpuConsumerBrowserFrameForegroundValidated'
              ),
            visibleGpuConsumerNativeCandidateForegroundValidationStatus:
              currentSurfaceDrawConsumerValue(
                'surfaceDrawVisibleGpuConsumerNativeCandidateForegroundValidationStatus'
              ),
            visibleGpuConsumerNativeCandidateForegroundProofKind:
              currentSurfaceDrawConsumerValue(
                'surfaceDrawVisibleGpuConsumerNativeCandidateForegroundProofKind'
              ),
            visibleGpuConsumerNativeCandidateForegroundSameQueueSubmissionBoundary:
              currentSurfaceDrawConsumerValue(
                'surfaceDrawVisibleGpuConsumerNativeCandidateForegroundSameQueueSubmissionBoundary'
              ),
            visibleGpuConsumerNativeCandidateForegroundSubmittedDrawCount:
              currentSurfaceDrawConsumerValue(
                'surfaceDrawVisibleGpuConsumerNativeCandidateForegroundSubmittedDrawCount'
              ),
            visibleGpuConsumerNativeCandidateForegroundResourceGeneration:
              currentSurfaceDrawConsumerValue(
                'surfaceDrawVisibleGpuConsumerNativeCandidateForegroundResourceGeneration'
              ),
            visibleGpuConsumerNativeActiveResourceGeneration:
              currentSurfaceDrawConsumerValue(
                'surfaceDrawVisibleGpuConsumerNativeActiveResourceGeneration'
              ),
            visibleGpuConsumerNativeOffscreenValidationNonzeroPixelCount:
              currentSurfaceDrawConsumerValue(
                'surfaceDrawVisibleGpuConsumerNativeOffscreenValidationNonzeroPixelCount'
              ),
            visibleGpuConsumerNativeOffscreenValidationResourceGeneration:
              currentSurfaceDrawConsumerValue(
                'surfaceDrawVisibleGpuConsumerNativeOffscreenValidationResourceGeneration'
              ),
            visibleGpuConsumerNativePixelValidationSource:
              currentSurfaceDrawConsumerValue(
                'surfaceDrawVisibleGpuConsumerNativePixelValidationSource'
              ),
            visibleGpuConsumerNativePixelValidationNonzeroPixelCount:
              currentSurfaceDrawConsumerValue(
                'surfaceDrawVisibleGpuConsumerNativePixelValidationNonzeroPixelCount'
              ),
            visibleGpuConsumerNativePixelValidationResourceGeneration:
              currentSurfaceDrawConsumerValue(
                'surfaceDrawVisibleGpuConsumerNativePixelValidationResourceGeneration'
              ),
            visibleGpuConsumerRenderBridgeMode: surfaceDraw.surfaceDrawVisibleGpuConsumerRenderBridgeMode ?? null,
            visibleGpuConsumerRenderBridgeStatus: surfaceDraw.surfaceDrawVisibleGpuConsumerRenderBridgeStatus ?? null,
            visibleGpuConsumerRendererCapabilityStatus:
              surfaceDraw.surfaceDrawVisibleGpuConsumerRendererCapabilityStatus ?? null,
            visibleGpuConsumerSameDeviceMainThreadImportSelected:
              surfaceDraw.surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportSelected ?? null,
            visibleGpuConsumerSameDeviceMainThreadImportRoute:
              surfaceDraw.surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportRoute ?? null,
            visibleGpuConsumerSameDeviceMainThreadImportThread:
              surfaceDraw.surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportThread ?? null,
            visibleGpuConsumerSameDeviceMainThreadImportDeviceScope:
              surfaceDraw.surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportDeviceScope ?? null,
            visibleGpuConsumerSameDeviceMainThreadImportStatus:
              surfaceDraw.surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportStatus ?? null,
            visibleGpuConsumerPixelValidationStatus:
              surfaceDraw.surfaceDrawVisibleGpuConsumerPixelValidationStatus ?? null,
            visibleGpuConsumerValidated:
              surfaceDraw.surfaceDrawVisibleGpuConsumerValidated ?? null,
            visibleGpuConsumerNativeReadbackFallbackValidated:
              surfaceDraw.surfaceDrawVisibleGpuConsumerNativeReadbackFallbackValidated ?? null,
            visibleGpuConsumerNativeReadbackSmokeValidationStatus:
              surfaceDraw.surfaceDrawVisibleGpuConsumerNativeReadbackSmokeValidationStatus ?? null,
            visibleGpuConsumerNativeOffscreenValidationStatus:
              surfaceDraw.surfaceDrawVisibleGpuConsumerNativeOffscreenValidationStatus ?? null,
            visibleGpuConsumerNativeDeviceMapSmokeStatus:
              surfaceDraw.surfaceDrawVisibleGpuConsumerNativeDeviceMapSmokeStatus ?? null,
            visibleGpuConsumerNativeDeviceTextureReadbackSmokeStatus:
              surfaceDraw.surfaceDrawVisibleGpuConsumerNativeDeviceTextureReadbackSmokeStatus ?? null,
            visibleGpuConsumerNativeDeviceTextureReadbackSmokeReason:
              surfaceDraw.surfaceDrawVisibleGpuConsumerNativeDeviceTextureReadbackSmokeReason ?? null,
            visibleGpuConsumerNativeValidationBlockerFamily:
              surfaceDraw.surfaceDrawVisibleGpuConsumerNativeValidationBlockerFamily ?? null,
            visibleGpuConsumerNativeTextureReadbackUnavailable:
              surfaceDraw.surfaceDrawVisibleGpuConsumerNativeTextureReadbackUnavailable ?? null,
            gpuOnlyAggregateIndirectReady: surfaceDraw.surfaceDrawGpuOnlyAggregateIndirectReady ?? null,
            gpuOnlyAggregateDrawRangeExact: surfaceDraw.surfaceDrawGpuOnlyAggregateDrawRangeExact ?? null,
            visibleRendererBridge: surfaceDraw.visibleRendererBridge ?? null,
            visibleRenderSource: surfaceDraw.visibleRenderSource ?? null,
            renderBridgeStatus: surfaceDraw.renderBridgeStatus ?? null,
            renderBridgeReason: surfaceDraw.renderBridgeReason ?? null,
            renderBridgeCapabilityStatus: surfaceDraw.renderBridgeCapabilityStatus ?? null,
            renderBridgeCapabilityReason: surfaceDraw.renderBridgeCapabilityReason ?? null,
            renderBridgeRendererBackend: surfaceDraw.renderBridgeRendererBackend ?? null,
            renderBridgeVisibleNoReadbackSupported: surfaceDraw.renderBridgeVisibleNoReadbackSupported ?? null,
            renderBridgeLastRenderStatus: surfaceDraw.renderBridgeLastRenderStatus ?? null,
            renderBridgeFrameCount: surfaceDraw.renderBridgeFrameCount ?? null,
            renderBridgeNativeSurfaceCandidateStageSubmissionCount:
              surfaceDraw.renderBridgeNativeSurfaceCandidateStageSubmissionCount ?? null,
            renderBridgeNativeSurfaceCandidateStageSubmittedAtMs:
              surfaceDraw.renderBridgeNativeSurfaceCandidateStageSubmittedAtMs ?? null,
            renderBridgeNativeSurfaceCandidatePresentationCopyCount:
              surfaceDraw.renderBridgeNativeSurfaceCandidatePresentationCopyCount ?? null,
            renderBridgeNativeSurfaceCandidatePresentationPostAdmissionGeometrySubmitCount:
              surfaceDraw.renderBridgeNativeSurfaceCandidatePresentationPostAdmissionGeometrySubmitCount ?? null,
            renderBridgeNativeSurfaceCandidateStagedPresentationStatus:
              surfaceDraw.renderBridgeNativeSurfaceCandidateStagedPresentationStatus ?? null,
            renderBridgeNativeSurfaceCandidateStagedPresentationReason:
              surfaceDraw.renderBridgeNativeSurfaceCandidateStagedPresentationReason ?? null,
            renderBridgeNativeSurfaceCandidateStagedPresentationChangedPixelCount:
              surfaceDraw.renderBridgeNativeSurfaceCandidateStagedPresentationChangedPixelCount ?? null,
            renderBridgeNativeSurfaceCandidateStagedPresentationGeneration:
              surfaceDraw.renderBridgeNativeSurfaceCandidateStagedPresentationGeneration ?? null,
            renderBridgeThreeMeshCount: surfaceDraw.renderBridgeThreeMeshCount ?? null,
            renderBridgeThreeGeometryByteLength: surfaceDraw.renderBridgeThreeGeometryByteLength ?? null,
            renderBridgeEngineIntegration: surfaceDraw.renderBridgeEngineIntegration ?? null,
            renderBridgeExternalGpuBufferGeometry: surfaceDraw.renderBridgeExternalGpuBufferGeometry ?? null,
            renderBridgeExternalGpuBufferNormalAttribute:
              surfaceDraw.renderBridgeExternalGpuBufferNormalAttribute ?? null,
            renderBridgeExternalGpuBufferNormalAttributeDisabledReason:
              surfaceDraw.renderBridgeExternalGpuBufferNormalAttributeDisabledReason ?? null,
            renderBridgeExternalGpuBufferIndirect: surfaceDraw.renderBridgeExternalGpuBufferIndirect ?? null,
            renderBridgeExternalGpuBufferIndirectRuntimeValidated:
              surfaceDraw.renderBridgeExternalGpuBufferIndirectRuntimeValidated ?? null,
            renderBridgeExternalGpuBufferIndirectDisabledReason:
              surfaceDraw.renderBridgeExternalGpuBufferIndirectDisabledReason ?? null,
            renderBridgeNativeWebGpuSurfaceConsumer:
              surfaceDraw.renderBridgeNativeWebGpuSurfaceConsumer ?? null,
            renderBridgeNativeWebGpuSurfaceConsumerEngineIntegration:
              surfaceDraw.renderBridgeNativeWebGpuSurfaceConsumerEngineIntegration ?? null,
            renderBridgeNativeWebGpuSurfaceConsumerRuntimeValidated:
              surfaceDraw.renderBridgeNativeWebGpuSurfaceConsumerRuntimeValidated ?? null,
            renderBridgeNativeWebGpuSurfaceConsumerPixelValidationStatus:
              surfaceDraw.renderBridgeNativeWebGpuSurfaceConsumerPixelValidationStatus ?? null,
            renderBridgeNativeWebGpuSurfaceConsumerOffscreenValidationStatus:
              surfaceDraw.renderBridgeNativeWebGpuSurfaceConsumerOffscreenValidationStatus ?? null,
            renderBridgeOffscreenValidationStatus: surfaceDraw.renderBridgeOffscreenValidationStatus ?? null,
            renderBridgeOffscreenValidationReason: surfaceDraw.renderBridgeOffscreenValidationReason ?? null,
            renderBridgeOffscreenValidationSample: Array.isArray(surfaceDraw.renderBridgeOffscreenValidationSample)
              ? [...surfaceDraw.renderBridgeOffscreenValidationSample]
              : null,
            renderBridgeReadbackSmokeValidationStatus:
              surfaceDraw.renderBridgeReadbackSmokeValidationStatus ?? null,
            renderBridgeReadbackSmokeValidationReason:
              surfaceDraw.renderBridgeReadbackSmokeValidationReason ?? null,
            renderBridgeReadbackSmokeValidationSample:
              Array.isArray(surfaceDraw.renderBridgeReadbackSmokeValidationSample)
                ? [...surfaceDraw.renderBridgeReadbackSmokeValidationSample]
                : null,
            renderBridgeReadbackSmokeValidationAttemptCount:
              surfaceDraw.renderBridgeReadbackSmokeValidationAttemptCount ?? null,
            renderBridgeOffscreenValidationNonzeroPixelCount:
              surfaceDraw.renderBridgeOffscreenValidationNonzeroPixelCount ?? null,
            renderBridgeOffscreenValidationPixelCount:
              surfaceDraw.renderBridgeOffscreenValidationPixelCount ?? null,
            renderBridgeOffscreenValidationWidth: surfaceDraw.renderBridgeOffscreenValidationWidth ?? null,
            renderBridgeOffscreenValidationHeight: surfaceDraw.renderBridgeOffscreenValidationHeight ?? null,
            renderBridgeOffscreenValidationAttemptCount:
              surfaceDraw.renderBridgeOffscreenValidationAttemptCount ?? null,
            renderBridgeRenderAttemptCount: surfaceDraw.renderBridgeRenderAttemptCount ?? null,
            renderBridgeRenderSkipCount: surfaceDraw.renderBridgeRenderSkipCount ?? null,
            renderBridgeLastRenderAttemptReason: surfaceDraw.renderBridgeLastRenderAttemptReason ?? null,
            renderBridgeLastRenderAttemptAtMs: surfaceDraw.renderBridgeLastRenderAttemptAtMs ?? null,
            renderBridgeLastRenderSkipStatus: surfaceDraw.renderBridgeLastRenderSkipStatus ?? null,
            renderBridgeLastRenderSkipReason: surfaceDraw.renderBridgeLastRenderSkipReason ?? null,
            renderBridgeNativeSurfaceConsumerRafSustain:
              surfaceDraw.renderBridgeNativeSurfaceConsumerRafSustain ?? null,
            renderBridgeLastNativeSurfaceConsumerRafReason:
              surfaceDraw.renderBridgeLastNativeSurfaceConsumerRafReason ?? null,
            renderBridgeLastNativeSurfaceConsumerRafScheduleReason:
              surfaceDraw.renderBridgeLastNativeSurfaceConsumerRafScheduleReason ?? null,
	            renderBridgeNativeSurfaceConsumerRafBlockedReason:
	              surfaceDraw.renderBridgeNativeSurfaceConsumerRafBlockedReason ?? null,
	            renderBridgeNativeSurfaceConsumerSubmitFencePending:
	              surfaceDraw.renderBridgeNativeSurfaceConsumerSubmitFencePending ?? null,
	            renderBridgeNativeSurfaceConsumerSubmitFenceSerial:
	              surfaceDraw.renderBridgeNativeSurfaceConsumerSubmitFenceSerial ?? null,
	            renderBridgeNativeSurfaceConsumerSubmitFenceReason:
	              surfaceDraw.renderBridgeNativeSurfaceConsumerSubmitFenceReason ?? null,
	            renderBridgeNativeSurfaceConsumerSubmitFenceElapsedMs:
	              surfaceDraw.renderBridgeNativeSurfaceConsumerSubmitFenceElapsedMs ?? null,
	            renderBridgeNativeSurfaceConsumerSubmitFenceTimedOut:
	              surfaceDraw.renderBridgeNativeSurfaceConsumerSubmitFenceTimedOut ?? null,
	            renderBridgeNativeSurfaceConsumerSubmitFenceFailed:
	              surfaceDraw.renderBridgeNativeSurfaceConsumerSubmitFenceFailed ?? null,
		            renderBridgeNativeSurfaceConsumerSubmitFenceExceededBudget:
		              surfaceDraw.renderBridgeNativeSurfaceConsumerSubmitFenceExceededBudget ?? null,
		            renderBridgeNativeSurfaceConsumerInFlightSubmitCount:
		              surfaceDraw.renderBridgeNativeSurfaceConsumerInFlightSubmitCount ?? null,
	            renderBridgeNativeSurfaceResourceGeneration:
	              surfaceDraw.renderBridgeNativeSurfaceResourceGeneration ?? null,
	            renderBridgeNativeSurfaceRetiredGenerationCount:
	              surfaceDraw.renderBridgeNativeSurfaceRetiredGenerationCount ?? null,
	            renderBridgeAdditionalSurfaceAttachStatus:
	              surfaceDraw.renderBridgeAdditionalSurfaceAttachStatus ?? null,
	            renderBridgeAdditionalSurfaceAttachReason:
	              surfaceDraw.renderBridgeAdditionalSurfaceAttachReason ?? null,
	            renderBridgeAdditionalSurfaceDrawCount:
	              surfaceDraw.renderBridgeAdditionalSurfaceDrawCount ?? null,
            renderBridgeCanvasWidth: surfaceDraw.renderBridgeCanvasWidth ?? null,
            renderBridgeCanvasHeight: surfaceDraw.renderBridgeCanvasHeight ?? null,
            renderBridgeCanvasCssWidth: surfaceDraw.renderBridgeCanvasCssWidth ?? null,
            renderBridgeCanvasCssHeight: surfaceDraw.renderBridgeCanvasCssHeight ?? null,
            renderBridgeCanvasClientWidth: surfaceDraw.renderBridgeCanvasClientWidth ?? null,
            renderBridgeCanvasClientHeight: surfaceDraw.renderBridgeCanvasClientHeight ?? null,
            renderBridgeDevicePixelRatio: surfaceDraw.renderBridgeDevicePixelRatio ?? null,
            renderBridgeCanvasResizePixelRatio: surfaceDraw.renderBridgeCanvasResizePixelRatio ?? null,
            renderBridgeConfiguredCanvasWidth: surfaceDraw.renderBridgeConfiguredCanvasWidth ?? null,
            renderBridgeConfiguredCanvasHeight: surfaceDraw.renderBridgeConfiguredCanvasHeight ?? null,
            renderBridgeContextConfigureCount: surfaceDraw.renderBridgeContextConfigureCount ?? null,
            renderBridgeLastContextConfigureReason: surfaceDraw.renderBridgeLastContextConfigureReason ?? null,
            renderBridgeLastNativeContextReconfigured:
              surfaceDraw.renderBridgeLastNativeContextReconfigured ?? null,
            renderBridgeDeviceLost:
              surfaceDraw.renderBridgeDeviceLost ?? null,
            renderBridgeDeviceLostReason:
              surfaceDraw.renderBridgeDeviceLostReason ?? null,
            renderBridgeDeviceLostInfo:
              surfaceDraw.renderBridgeDeviceLostInfo ?? null,
		            renderBridgeLastDrawOrderCount: surfaceDraw.renderBridgeLastDrawOrderCount ?? null,
	            renderBridgeTransparencyCompositeMode:
	              surfaceDraw.renderBridgeTransparencyCompositeMode ?? null,
	            renderBridgeLastOpaqueDrawCount: surfaceDraw.renderBridgeLastOpaqueDrawCount ?? null,
	            renderBridgeLastTransparentDrawCount: surfaceDraw.renderBridgeLastTransparentDrawCount ?? null,
	            renderBridgeLastRefractiveDrawCount:
	              surfaceDraw.renderBridgeLastRefractiveDrawCount ?? null,
	            renderBridgeConfiguredAlphaMode: surfaceDraw.renderBridgeConfiguredAlphaMode ?? null,
	            renderBridgeSurfaceAlphaMode: surfaceDraw.renderBridgeSurfaceAlphaMode ?? null,
	            renderBridgeSurfaceBlendEnabled: surfaceDraw.renderBridgeSurfaceBlendEnabled ?? null,
	            renderBridgeSurfaceDepthWriteEnabled:
	              surfaceDraw.renderBridgeSurfaceDepthWriteEnabled ?? null,
	            renderBridgePackedNormalReady: surfaceDraw.renderBridgePackedNormalReady ?? null,
	            renderBridgePackedNormalByteLength:
	              surfaceDraw.renderBridgePackedNormalByteLength ?? null,
	            renderBridgePackedNormalRowCount: surfaceDraw.renderBridgePackedNormalRowCount ?? null,
	            renderBridgePackedNormalEncoding: surfaceDraw.renderBridgePackedNormalEncoding ?? null,
	            renderBridgePackedNormalSurfaceGenerationId:
	              surfaceDraw.renderBridgePackedNormalSurfaceGenerationId ?? null,
	            renderBridgePackedNormalAdditionalSubmitCount:
	              surfaceDraw.renderBridgePackedNormalAdditionalSubmitCount ?? null,
	            renderBridgeVertexTemperatureReady:
	              surfaceDraw.renderBridgeVertexTemperatureReady ?? null,
	            renderBridgeVertexTemperatureByteLength:
	              surfaceDraw.renderBridgeVertexTemperatureByteLength ?? null,
	            renderBridgeVertexTemperatureRowCount:
	              surfaceDraw.renderBridgeVertexTemperatureRowCount ?? null,
	            renderBridgeVertexTemperatureEncoding:
	              surfaceDraw.renderBridgeVertexTemperatureEncoding ?? null,
	            renderBridgeVertexTemperatureSurfaceGenerationId:
	              surfaceDraw.renderBridgeVertexTemperatureSurfaceGenerationId ?? null,
	            renderBridgeVertexTemperatureVolumeGenerationId:
	              surfaceDraw.renderBridgeVertexTemperatureVolumeGenerationId ?? null,
	            renderBridgeVertexTemperatureAdditionalSubmitCount:
	              surfaceDraw.renderBridgeVertexTemperatureAdditionalSubmitCount ?? null,
	            renderBridgeVertexTemperatureAdditionalReadyCount:
	              surfaceDraw.renderBridgeVertexTemperatureAdditionalReadyCount ?? null,
	            renderBridgeRefractionTargetLifecycleStatus:
	              surfaceDraw.renderBridgeRefractionTargetLifecycleStatus ?? null,
	            renderBridgeRefractionTargetLifecycleReason:
	              surfaceDraw.renderBridgeRefractionTargetLifecycleReason ?? null,
	            renderBridgeRefractionTargetGeneration:
	              surfaceDraw.renderBridgeRefractionTargetGeneration ?? null,
	            renderBridgeRefractionTargetWidth: surfaceDraw.renderBridgeRefractionTargetWidth ?? null,
	            renderBridgeRefractionTargetHeight: surfaceDraw.renderBridgeRefractionTargetHeight ?? null,
	            renderBridgeRefractionTargetColorFormat:
	              surfaceDraw.renderBridgeRefractionTargetColorFormat ?? null,
	            renderBridgeRefractionTargetDepthFormat:
	              surfaceDraw.renderBridgeRefractionTargetDepthFormat ?? null,
	            renderBridgeRefractionTargetRetirementPendingCount:
	              surfaceDraw.renderBridgeRefractionTargetRetirementPendingCount ?? null,
	            renderBridgeRefractionTargetRetirementCount:
	              surfaceDraw.renderBridgeRefractionTargetRetirementCount ?? null,
	            renderBridgeRefractionBackfaceStatus:
	              surfaceDraw.renderBridgeRefractionBackfaceStatus ?? null,
	            renderBridgeRefractionBackfaceCacheHit:
	              surfaceDraw.renderBridgeRefractionBackfaceCacheHit ?? null,
	            renderBridgeRefractionBackfacePassDrawCount:
	              surfaceDraw.renderBridgeRefractionBackfacePassDrawCount ?? null,
	            renderBridgeRefractionBackfaceAdditionalSubmitCount:
	              surfaceDraw.renderBridgeRefractionBackfaceAdditionalSubmitCount ?? null,
	            renderBridgeBackgroundImageGpuStatus:
	              surfaceDraw.renderBridgeBackgroundImageGpuStatus ?? null,
	            renderBridgeBackgroundImageDrawCount:
	              surfaceDraw.renderBridgeBackgroundImageDrawCount ?? null,
	            renderBridgeNativeSurfaceDebugMode:
	              surfaceDraw.renderBridgeNativeSurfaceDebugMode ?? null,
	            renderBridgeNativeSurfaceDebugStatus:
	              surfaceDraw.renderBridgeNativeSurfaceDebugStatus ?? null,
	            renderBridgeNativeSurfaceDebugSkippedDrawCount:
	              surfaceDraw.renderBridgeNativeSurfaceDebugSkippedDrawCount ?? null,
		            renderBridgeNativeSurfaceDebugClearValue:
		              surfaceDraw.renderBridgeNativeSurfaceDebugClearValue ?? null,
		            renderBridgeNativeSurfaceDeferredResourceReleaseStatus:
		              surfaceDraw.renderBridgeNativeSurfaceDeferredResourceReleaseStatus ?? null,
		            renderBridgeNativeSurfaceDeferredResourceReleaseReason:
		              surfaceDraw.renderBridgeNativeSurfaceDeferredResourceReleaseReason ?? null,
		            renderBridgeNativeSurfaceDeferredResourceReleasePending:
		              surfaceDraw.renderBridgeNativeSurfaceDeferredResourceReleasePending ?? null,
		            renderBridgePrimarySurfaceIndex: surfaceDraw.renderBridgePrimarySurfaceIndex ?? null,
            renderBridgePrimaryBoundsCenterM: surfaceDraw.renderBridgePrimaryBoundsCenterM ?? null,
            renderBridgePrimaryBoundsRadiusM: surfaceDraw.renderBridgePrimaryBoundsRadiusM ?? null,
            renderBridgePrimaryBoundsClipCenter: surfaceDraw.renderBridgePrimaryBoundsClipCenter ?? null,
            renderBridgePrimaryBoundsClipW: surfaceDraw.renderBridgePrimaryBoundsClipW ?? null,
            renderBridgePrimaryBoundsNdcCenter: surfaceDraw.renderBridgePrimaryBoundsNdcCenter ?? null,
            renderBridgePrimaryBoundsInFront: surfaceDraw.renderBridgePrimaryBoundsInFront ?? null,
            renderBridgePrimaryBoundsCenterInsideClip:
              surfaceDraw.renderBridgePrimaryBoundsCenterInsideClip ?? null,
            renderBridgePrimaryBoundsMaybeVisible: surfaceDraw.renderBridgePrimaryBoundsMaybeVisible ?? null,
            renderBridgePixelValidationReason: surfaceDraw.renderBridgePixelValidationReason ?? null,
            renderBridgePixelValidationSample: Array.isArray(surfaceDraw.renderBridgePixelValidationSample)
              ? [...surfaceDraw.renderBridgePixelValidationSample]
              : null,
            renderBridgeReused: surfaceDraw.renderBridgeReused ?? null,
            renderBridgeUpdateCount: surfaceDraw.renderBridgeUpdateCount ?? null,
            renderBridgeSourceResidentExecutionGeneration:
              surfaceDraw.renderBridgeSourceResidentExecutionGeneration ?? null,
            renderBridgeSourceResidentExecutionGenerationMatchesCurrent:
              surfaceDraw.renderBridgeSourceResidentExecutionGenerationMatchesCurrent ?? null,
            renderBridgeSourceResidentNextStep:
              surfaceDraw.renderBridgeSourceResidentNextStep ?? null,
            renderBridgeSourceResidentNextTimeS:
              surfaceDraw.renderBridgeSourceResidentNextTimeS ?? null,
            renderBridgeSourceResidentRetainedPrevious:
              surfaceDraw.renderBridgeSourceResidentRetainedPrevious ?? null,
            renderBridgeSourceResidentRetentionReason:
              surfaceDraw.renderBridgeSourceResidentRetentionReason ?? null,
            renderBridgeParticleRenderMode: surfaceDraw.renderBridgeParticleRenderMode ?? null,
            renderBridgeSphereMaterialKeys: Array.isArray(surfaceDraw.renderBridgeSphereMaterialKeys)
              ? [...surfaceDraw.renderBridgeSphereMaterialKeys]
              : [],
            renderBridgeSphereMaterialSummaries: Array.isArray(surfaceDraw.renderBridgeSphereMaterialSummaries)
              ? surfaceDraw.renderBridgeSphereMaterialSummaries.map((summary) => ({ ...summary }))
              : [],
            renderBridgeSphereSizingMode: surfaceDraw.renderBridgeSphereSizingMode ?? null,
            renderBridgeSphereVariableSize: surfaceDraw.renderBridgeSphereVariableSize ?? null,
            renderBridgeSpherePbrMaterialSource: surfaceDraw.renderBridgeSpherePbrMaterialSource ?? null,
            renderBridgeSphereClosurePbr: surfaceDraw.renderBridgeSphereClosurePbr ?? null,
            renderBridgeSphereTransmissionProxyCount: surfaceDraw.renderBridgeSphereTransmissionProxyCount ?? null,
            renderBridgeSphereFallbackColorCount: surfaceDraw.renderBridgeSphereFallbackColorCount ?? null,
            renderBridgeSphereMetallicVisibilityProxyCount:
              surfaceDraw.renderBridgeSphereMetallicVisibilityProxyCount ?? null,
            renderBridgeSphereMaterialRendererProxyCount:
              surfaceDraw.renderBridgeSphereMaterialRendererProxyCount ?? null,
            renderBridgeSphereGeometryProxyCount: surfaceDraw.renderBridgeSphereGeometryProxyCount ?? null,
            renderBridgeSphereReusedMeshCount: surfaceDraw.renderBridgeSphereReusedMeshCount ?? null,
            renderBridgeSphereCreatedMeshCount: surfaceDraw.renderBridgeSphereCreatedMeshCount ?? null,
            renderBridgeSphereDisposedMeshCount: surfaceDraw.renderBridgeSphereDisposedMeshCount ?? null,
            renderBridgeMinParticleRadiusM: surfaceDraw.renderBridgeMinParticleRadiusM ?? null,
	            renderBridgeMaxParticleRadiusM: surfaceDraw.renderBridgeMaxParticleRadiusM ?? null,
	            renderRowsReadbackRequestedMode: surfaceDraw.renderRowsReadbackRequestedMode ?? null,
	            renderRowsReadbackEffectiveMode: surfaceDraw.renderRowsReadbackEffectiveMode ?? null,
	            renderRowsReadbackCoercionReason: surfaceDraw.renderRowsReadbackCoercionReason ?? null,
	            renderRowsReadbackForcedForThreeBridge: surfaceDraw.renderRowsReadbackForcedForThreeBridge ?? null,
	            renderRowsReadbackRetainedPreviousBridge: surfaceDraw.renderRowsReadbackRetainedPreviousBridge ?? null,
	            renderRowsParticleScaleStabilityStatus:
	              surfaceDraw.renderRowsParticleScaleStabilityStatus ?? null,
	            renderRowsParticleScaleCapAppliedCount:
	              surfaceDraw.renderRowsParticleScaleCapAppliedCount ?? null,
	            renderRowsParticleScaleCapAppliedCountKnown:
	              surfaceDraw.renderRowsParticleScaleCapAppliedCountKnown ?? null,
	            renderRowsParticleScaleMaxRadiusGrowthRatioAllowed:
	              surfaceDraw.renderRowsParticleScaleMaxRadiusGrowthRatioAllowed ?? null,
	            renderRowsParticleScaleMaxVolumeRatioJAllowed:
	              surfaceDraw.renderRowsParticleScaleMaxVolumeRatioJAllowed ?? null,
	            renderRowsParticleScaleMaxSupportRadiusSmoothingRatioAllowed:
	              surfaceDraw.renderRowsParticleScaleMaxSupportRadiusSmoothingRatioAllowed ?? null,
	            renderRowsParticleScaleMaxSupportRadiusM:
	              finiteOrNull(surfaceDraw.renderRowsParticleScaleMaxSupportRadiusM),
	            renderRowsParticleScaleMaxGasRadiusSmoothingRatioAllowed:
	              surfaceDraw.renderRowsParticleScaleMaxGasRadiusSmoothingRatioAllowed ?? null,
	            renderRowsParticleScaleMaxGasParticleRadiusM:
	              finiteOrNull(surfaceDraw.renderRowsParticleScaleMaxGasParticleRadiusM),
	            renderRowsParticleScaleSupportRadiusPolicyAppliedInShader:
	              surfaceDraw.renderRowsParticleScaleSupportRadiusPolicyAppliedInShader ?? null,
	            renderRowsParticleScaleMaxRawRadiusGrowthRatio:
	              surfaceDraw.renderRowsParticleScaleMaxRawRadiusGrowthRatio ?? null,
	            renderRowsParticleScaleMaxEffectiveRadiusGrowthRatio:
	              surfaceDraw.renderRowsParticleScaleMaxEffectiveRadiusGrowthRatio ?? null,
            renderRowsDecodedMaxVolumeRatioJ:
              finiteOrNull(surfaceDraw.renderRowsDecodedMaxVolumeRatioJ),
            renderRowsDecodedVolumeRatioCapBoundary:
              surfaceDraw.renderRowsDecodedVolumeRatioCapBoundary ?? null,
            renderRowsDecodedVolumeRatioCapBoundaryCount:
              surfaceDraw.renderRowsDecodedVolumeRatioCapBoundaryCount ?? null,
            renderRowsDecodedVolumeRatioCapBoundaryMaterialPhaseCounts:
              surfaceDraw.renderRowsDecodedVolumeRatioCapBoundaryMaterialPhaseCounts ?? null,
	            renderRowsParticleScaleStability:
	              surfaceDraw.renderRowsParticleScaleStability ?? null
	          } : null,
          surfaces: surfaceSnapshot(sceneApi)
        };
      };
      const appendMetricWithValidationCapture = async (metric) => {
        const sampleIndex = metrics.length;
        if (!requestedCaptureFrames) {
          const retainedMetric = retainProbeMetric(metric);
          metrics.push(retainedMetric);
          publishPartialTimeline();
          return retainedMetric;
        }
        if (requestedVisualIntervalCaptureRequested) {
          // Compact authoritative checkpoints are physics acceptance evidence,
          // not screenshots. Continue collecting them after the bounded visual
          // frame budget is exhausted so long-horizon scenarios cannot silently
          // lose their terminal phase-transition checkpoints.
          markProbeProgress('authoritative-gpu-checkpoint-started', {
            batchIndex: metric.batchIndex,
            phase: metric.phase,
            sampleIndex
          });
          metric.authoritativeGpuCheckpoint =
            await captureAuthoritativeGpuCheckpoint({
              batchIndex: metric.batchIndex,
              phase: metric.phase,
              sampleIndex
            });
        }
        const retainedMetric = retainProbeMetric(metric);
        metrics.push(retainedMetric);
        await captureFrame(metric.batchIndex, metric.phase, sampleIndex);
        if (requestedVisualIntervalCaptureRequested) {
          markProbeProgress('authoritative-gpu-checkpoint-completed', {
            batchIndex: metric.batchIndex,
            phase: metric.phase,
            sampleIndex,
            status: metric.authoritativeGpuCheckpoint?.status ?? null,
            materialPhaseCount:
              metric.authoritativeGpuCheckpoint?.materialPhaseCount ?? null
          });
        }
        publishPartialTimeline();
        return retainedMetric;
      };
      const authoritativeGpuCheckpointCaptureSummary = () => {
        const checkpoints = metrics
          .map((metric) => metric?.authoritativeGpuCheckpoint)
          .filter(Boolean);
        const capturedCount = checkpoints.filter((checkpoint) => checkpoint.status === 'captured').length;
        const errorCount = checkpoints.filter((checkpoint) => checkpoint.status === 'error').length;
        const unavailableCount = checkpoints.filter((checkpoint) => (
          checkpoint.status !== 'captured' && checkpoint.status !== 'error'
        )).length;
        return {
          schema: 'peercompute.ulg.sph-authoritative-gpu-checkpoint-capture.v1',
          status: !requestedVisualIntervalCaptureRequested
            ? 'disabled'
            : checkpoints.length === 0
            ? 'no-checkpoints'
            : capturedCount === checkpoints.length
            ? 'captured'
            : capturedCount > 0
            ? 'captured-with-gaps'
            : 'unavailable',
          enabled: Boolean(requestedVisualIntervalCaptureRequested),
          trigger: 'visual-validation-checkpoint',
          diagnosticOnly: true,
          physicsReference: false,
          sourceBufferMutation: false,
          normalHotLoopReadbackFree: true,
          checkpointCount: checkpoints.length,
          capturedCount,
          unavailableCount,
          errorCount
        };
      };
      const publishPartialTimeline = (status = partialTimeline.status) => {
        partialTimeline.status = status;
        partialTimeline.updatedAtMs = performance.now();
        partialTimeline.authoritativeGpuCheckpointCapture =
          authoritativeGpuCheckpointCaptureSummary();
      };
      publishPartialTimeline();
      if (requestedVisualIntervalCaptureRequested) {
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        // The final-only compact-summary path does not otherwise need an
        // initial render refresh. Materialize its retained upload explicitly
        // before the first checkpoint so time zero is authoritative rather
        // than merely a visual-frame label.
        const initialSphUpload = sceneApi.getSphGpuParticleUpload?.()
          || overlay.__sphGpuParticleUpload
          || null;
        const initialMlsMpmUpload = sceneApi.getMlsMpmGpuParticleUpload?.()
          || overlay.__mlsMpmGpuParticleUpload
          || null;
        const checkpointModule = await loadAuthoritativeGpuCheckpointModule();
        const initialUploadPairValidation = checkpointModule.validateAuthoritativeGpuUploadPair({
          sphParticleUpload: initialSphUpload,
          mlsMpmParticleUpload: initialMlsMpmUpload,
          requireTimeZero: true,
          expectedStep: 0,
          expectedTimeS: 0
        });
        if (
          !initialUploadPairValidation.ready
          || !initialUploadPairValidation.sharedSlotIdentityVerified
        ) {
          markProbeProgress('initial-authoritative-upload-started');
          try {
            overlay.__sphGpuParticleUpload = await sceneApi.refreshSphGpuParticleBuffers?.({
              preferWebGpu: true
            }) || overlay.__sphGpuParticleUpload || null;
            overlay.__mlsMpmGpuParticleUpload = await sceneApi.refreshMlsMpmGpuParticleBuffers?.({
              preferWebGpu: true
            }) || overlay.__mlsMpmGpuParticleUpload || null;
            const refreshedPairValidation = checkpointModule.validateAuthoritativeGpuUploadPair({
              sphParticleUpload: overlay.__sphGpuParticleUpload,
              mlsMpmParticleUpload: overlay.__mlsMpmGpuParticleUpload,
              requireTimeZero: true,
              expectedStep: 0,
              expectedTimeS: 0
            });
            markProbeProgress('initial-authoritative-upload-completed', {
              ready: refreshedPairValidation.ready,
              sharedSlotIdentityVerified:
                refreshedPairValidation.sharedSlotIdentityVerified,
              blockers: [...refreshedPairValidation.blockers]
            });
          } catch (error) {
            markProbeProgress('initial-authoritative-upload-skipped', {
              reason: error instanceof Error ? error.message : String(error)
            });
          }
        }
      }
      if (
        requestedCompactSummaryMode === 'none'
        && requestedRenderEvery > 0
        && sceneApi.refreshSphResidentRenderState
      ) {
        markProbeProgress('initial-render-state-started');
        try {
          overlay.__sphGpuParticleUpload = await sceneApi.refreshSphGpuParticleBuffers?.({
            preferWebGpu: true
          }) || overlay.__sphGpuParticleUpload || null;
          overlay.__mlsMpmGpuParticleUpload = await sceneApi.refreshMlsMpmGpuParticleBuffers?.({
            preferWebGpu: true
          }) || overlay.__mlsMpmGpuParticleUpload || null;
          overlay.__sphResidentRenderState = await sceneApi.refreshSphResidentRenderState({
            preferWebGpu: true,
            residentSteps: execution,
            renderFieldReadbackMode: requestedRenderReadbackMode,
            renderRowsReadbackMode: requestedRenderRowsReadbackMode,
            renderFieldSurfaceSummaryMode: requestedRenderFieldSurfaceSummaryMode,
            surfaceDrawDiagnosticMode: requestedSurfaceDrawDiagnosticMode,
            surfaceDrawDiagnosticMaxFieldCells: requestedSurfaceDrawDiagnosticMaxFieldCells,
            surfaceDrawDiagnosticMaxResolution: requestedSurfaceDrawDiagnosticMaxResolution,
            nativeMarchingCubesMaxVertexRowsBufferByteLength:
              requestedNativeMarchingCubesMaxVertexRowsBufferByteLength,
            nativeMarchingCubesMaxResolution: requestedNativeMarchingCubesMaxResolution,
            gasPressureSummary: overlay.__sphResidentGasPressureSummary || null
          });
          overlay.__sphResidentSurfaceDraw = sceneApi.getSphResidentSurfaceDraw?.() || null;
          sceneApi.refreshViewportAndOverlay?.({ reason: 'sph-long-horizon-probe-initial-render-refresh' });
          await new Promise((resolve) => requestAnimationFrame(resolve));
          const initialNativeSurfaceValidation =
            await waitForNativeSurfaceValidation(0);
          overlay.__sphResidentRenderState =
            sceneApi.getSphResidentRenderState?.()
            || overlay.__sphResidentRenderState;
          overlay.__sphResidentSurfaceDraw =
            sceneApi.getSphResidentSurfaceDraw?.()
            || overlay.__sphResidentSurfaceDraw;
          markProbeProgress('initial-render-state-completed', {
            status: overlay.__sphResidentRenderState?.status ?? null,
            renderRowsReadback: overlay.__sphResidentRenderState?.renderRowsReadback ?? null,
            nativeSurfaceValidationStatus:
              initialNativeSurfaceValidation?.status ?? null
          });
        } catch (error) {
          markProbeProgress('initial-render-state-skipped', {
            reason: error instanceof Error ? error.message : String(error)
          });
        }
      }
      if (requestedInteractiveCacheLifecycle) {
        if (requestedBatches !== 3) {
          throw new Error(
            'interactive cache lifecycle requires exactly three post-reset batches'
          );
        }
        const waitForInteractiveState = async (
          read,
          ready,
          label,
          waitMs = 60_000,
          summarize = null
        ) => {
          const startedAtMs = performance.now();
          let current = read();
          while (!ready(current)) {
            if (performance.now() - startedAtMs >= waitMs) {
              const summary = typeof summarize === 'function'
                ? summarize(current)
                : null;
              throw new Error(
                `interactive cache lifecycle timed out waiting for ${label}`
                + (summary == null
                  ? ''
                  : `: ${JSON.stringify(summary)}`)
              );
            }
            await new Promise((resolve) => setTimeout(resolve, 25));
            current = read();
          }
          return current;
        };
        const quiesceInteractivePlayback = async ({
          label,
          waitMs = 60_000
        }) => {
          const playButton = overlay.querySelector('#sph-play');
          if (!playButton) {
            throw new Error(
              `interactive cache lifecycle could not find #sph-play while ${label}`
            );
          }
          const startedAtMs = performance.now();
          const initialButtonText = String(
            playButton.textContent ?? ''
          ).trim();
          const pauseRequested = /Pause/i.test(initialButtonText);
          if (pauseRequested) playButton.click();
          let priorExecution = null;
          let stableFrameCount = 0;
          let currentExecution = null;
          while (performance.now() - startedAtMs < waitMs) {
            await new Promise((resolve) => requestAnimationFrame(resolve));
            currentExecution =
              sceneApi.getMlsMpmResidentSteps?.()
              || overlay.__mlsMpmResidentSteps
              || null;
            const residentPending =
              overlay.__mlsMpmResidentStepsPending != null;
            const playbackActive = /Pause/i.test(
              String(playButton.textContent ?? '')
            );
            if (
              !residentPending
              && !playbackActive
              && currentExecution?.schema
            ) {
              stableFrameCount = currentExecution === priorExecution
                ? stableFrameCount + 1
                : 1;
              priorExecution = currentExecution;
              if (stableFrameCount >= 2) {
                return {
                  execution: currentExecution,
                  evidence: {
                    schema:
                      'peercompute.ulg.sph-interactive-playback-quiescence.v0',
                    status: 'resident-playback-quiescent',
                    reason: label,
                    initialButtonText,
                    finalButtonText: String(
                      playButton.textContent ?? ''
                    ).trim(),
                    pauseRequested,
                    residentPending: false,
                    stableFrameCount,
                    completedStepCount:
                      Number(currentExecution.completedStepCount ?? 0),
                    elapsedMs: performance.now() - startedAtMs
                  }
                };
              }
            } else {
              priorExecution = null;
              stableFrameCount = 0;
            }
          }
          throw new Error(
            `interactive cache lifecycle timed out while ${label}: `
            + JSON.stringify({
              initialButtonText,
              finalButtonText: String(
                playButton.textContent ?? ''
              ).trim(),
              pauseRequested,
              residentPending:
                overlay.__mlsMpmResidentStepsPending != null,
              completedStepCount:
                currentExecution?.completedStepCount ?? null
            })
          );
        };
        const pageIdentity = {
          pageInstanceId: interactivePageInstanceId,
          performanceTimeOrigin: performance.timeOrigin,
          documentUrl: location.href,
          navigationEntryCount:
            performance.getEntriesByType('navigation').length
        };
        const warmExecution = await waitForInteractiveState(
          () => (
            sceneApi.getMlsMpmResidentSteps?.()
            || overlay.__mlsMpmResidentSteps
            || execution
            || null
          ),
          (candidate) => (
            candidate?.schema
            && Number(candidate?.completedStepCount) > 0
          ),
          'a completed warm resident execution'
        );
        const staticTableWrite = await waitForInteractiveState(
          () => overlay.__sphPeerClosureCache?.staticTableWrite ?? null,
          (candidate) => (
            candidate?.schema
              === 'peercompute.ulg.sph-static-table-cache-update.v0'
            && candidate?.status === 'stored'
            && Number(candidate?.counts?.tables) >= 4
            && Number(candidate?.counts?.gpuWarmup) >= 1
          ),
          'the persisted static-table/GPU warmup bundle'
        );
        const warmupCompletedAtMs = performance.now();
        const preResetGeneration = Number(
          overlay.__sphResetStatus?.generation
          ?? overlay.__sphResidentStageOrderTrace?.resetGeneration
          ?? 0
        );
        const resetButton = overlay.querySelector('#sph-reset');
        if (!resetButton) {
          throw new Error(
            'interactive cache lifecycle could not find #sph-reset'
          );
        }
        resetButton.click();
        const resetEvidence = await waitForInteractiveState(
          () => {
            const resetStatus = overlay.__sphResetStatus ?? null;
            const staticTableRead =
              overlay.__sphPeerClosureCache?.staticTableRead ?? null;
            const setParticlesTiming = overlay.__sphSetParticlesTiming ?? null;
            const nextExecution =
              sceneApi.getMlsMpmResidentSteps?.()
              || overlay.__mlsMpmResidentSteps
              || null;
            return {
              resetStatus,
              staticTableRead,
              setParticlesTiming,
              nextExecution
            };
          },
          (candidate) => (
            candidate?.resetStatus?.status
              === 'particle-state-resynced-after-reset'
            && Number(candidate?.resetStatus?.generation)
              > preResetGeneration
            && candidate?.setParticlesTiming?.staticTableCacheStatus
              === 'static-table-cache-bundle-hit'
            && candidate?.staticTableRead?.status
              === 'static-table-cache-bundle-hit'
            && Number(candidate?.staticTableRead?.hitCount) >= 4
            && Number(candidate?.staticTableRead?.tableCount) >= 4
            && Number(candidate?.staticTableRead?.gpuWarmupCount) >= 1
            && candidate?.nextExecution?.schema
            && Number(candidate?.nextExecution?.completedStepCount) > 0
            && candidate.nextExecution !== warmExecution
          ),
          'the same-page reset/cache-hit resident rebuild',
          60_000,
          (candidate) => ({
            resetStatus: candidate?.resetStatus == null
              ? null
              : {
                  status: candidate.resetStatus.status ?? null,
                  generation: candidate.resetStatus.generation ?? null,
                  reason: candidate.resetStatus.reason ?? null
                },
            staticTableRead: candidate?.staticTableRead == null
              ? null
              : {
                  status: candidate.staticTableRead.status ?? null,
                  hitCount: candidate.staticTableRead.hitCount ?? null,
                  tableCount: candidate.staticTableRead.tableCount ?? null,
                  gpuWarmupCount:
                    candidate.staticTableRead.gpuWarmupCount ?? null
                },
            staticTableCacheStatus:
              candidate?.setParticlesTiming?.staticTableCacheStatus ?? null,
            nextExecution: candidate?.nextExecution == null
              ? null
              : {
                  schema: candidate.nextExecution.schema ?? null,
                  status: candidate.nextExecution.status ?? null,
                  completedStepCount:
                    candidate.nextExecution.completedStepCount ?? null,
                  identityChanged:
                    candidate.nextExecution !== warmExecution
                },
            residentPending:
              overlay.__mlsMpmResidentStepsPending != null,
            residentError:
              overlay.__mlsMpmResidentStepsError ?? null,
            residentGenerationHandoff:
              sceneApi.scene?.userData
                ?.mlsMpmResidentExecutionGenerationHandoff == null
                ? null
                : {
                    status:
                      sceneApi.scene.userData
                        .mlsMpmResidentExecutionGenerationHandoff.status
                      ?? null,
                    reason:
                      sceneApi.scene.userData
                        .mlsMpmResidentExecutionGenerationHandoff.reason
                      ?? null,
                    generation:
                      sceneApi.scene.userData
                        .mlsMpmResidentExecutionGenerationHandoff.generation
                      ?? null,
                    handoffSerial:
                      sceneApi.scene.userData
                        .mlsMpmResidentExecutionGenerationHandoff.handoffSerial
                      ?? null,
                    pendingExecutionCount:
                      sceneApi.scene.userData
                        .mlsMpmResidentExecutionGenerationHandoff
                        .pendingExecutionCount
                      ?? null,
                    publishedExecutionCount:
                      sceneApi.scene.userData
                        .mlsMpmResidentExecutionGenerationHandoff
                        .publishedExecutionCount
                      ?? null,
                    error:
                      sceneApi.scene.userData
                        .mlsMpmResidentExecutionGenerationHandoff.error
                      ?? null
                  },
            residentProgress:
              sceneApi.scene?.userData?.mlsMpmResidentStepsProgress == null
                ? null
                : {
                    status:
                      sceneApi.scene.userData.mlsMpmResidentStepsProgress.status
                      ?? null,
                    residentExecutionGeneration:
                      sceneApi.scene.userData.mlsMpmResidentStepsProgress
                        .residentExecutionGeneration
                      ?? null,
                    currentResidentExecutionGeneration:
                      sceneApi.scene.userData.mlsMpmResidentStepsProgress
                        .currentResidentExecutionGeneration
                      ?? null,
                    innerStatus:
                      sceneApi.scene.userData.mlsMpmResidentStepsProgress
                        .innerProgress?.status
                      ?? null,
                    error:
                      sceneApi.scene.userData.mlsMpmResidentStepsProgress.error
                      ?? null
                  },
            residentGpuWork:
              sceneApi.scene?.userData?.sphResidentGpuWorkInFlight == null
                ? null
                : {
                    status:
                      sceneApi.scene.userData.sphResidentGpuWorkInFlight.status
                      ?? null,
                    residentGpuRefreshInFlightCount:
                      sceneApi.scene.userData.sphResidentGpuWorkInFlight
                        .residentGpuRefreshInFlightCount
                      ?? null,
                    residentGpuWorkInFlightCount:
                      sceneApi.scene.userData.sphResidentGpuWorkInFlight
                        .residentGpuWorkInFlightCount
                      ?? null
                  },
            residentScheduleTrace:
              Array.isArray(overlay.__sphResidentScheduleTrace)
                ? overlay.__sphResidentScheduleTrace.slice(-8)
                : [],
            warmExecutionSettlement: {
              spatialEpochStatus:
                warmExecution
                  ?.schroederSpatialEpochReleaseSettlementStatus
                ?? null,
              spatialEpochComplete:
                warmExecution
                  ?.schroederSpatialEpochReleaseSettlementComplete
                ?? null,
              spatialEpochScheduledCount:
                warmExecution
                  ?.schroederSpatialEpochReleaseSettlementScheduledCount
                ?? null,
              spatialEpochSettledCount:
                warmExecution
                  ?.schroederSpatialEpochReleaseSettlementCount
                ?? null,
              spatialEpochError:
                warmExecution
                  ?.schroederSpatialEpochReleaseSettlementError
                ?? null,
              successorStatus:
                warmExecution
                  ?.schroederSuccessorSourceFamilyRetirementStatus
                ?? null,
              successorComplete:
                warmExecution
                  ?.schroederSuccessorSourceFamilyRetirementComplete
                ?? null,
              successorScheduledCount:
                warmExecution
                  ?.schroederSuccessorSourceFamilyRetirementScheduledCount
                ?? null,
              successorSettledCount:
                warmExecution
                  ?.schroederSuccessorSourceFamilyRetirementCount
                ?? null,
              successorError:
                warmExecution
                  ?.schroederSuccessorSourceFamilyRetirementError
                ?? null,
              transactionState:
                warmExecution?.finalStep
                  ?.currentSchroederSpatialEpochTransactionSummary?.().state
                ?? null,
              transactionReleaseCount:
                warmExecution?.finalStep
                  ?.currentSchroederSpatialEpochTransactionSummary?.()
                  .counters?.releaseCount
                ?? null,
              generationReleaseScheduled:
                warmExecution?.finalStep
                  ?.currentSchroederSpatialEpochGenerationSummary?.()
                  .releaseScheduled
                ?? null,
              generationReleaseStatus:
                warmExecution?.finalStep
                  ?.currentSchroederSpatialEpochGenerationSummary?.()
                  .releaseStatus
                ?? null,
              generationReleaseAttemptCount:
                warmExecution?.finalStep
                  ?.currentSchroederSpatialEpochGenerationSummary?.()
                  .releaseAttemptCount
                ?? null,
              generationReleaseFailureCount:
                warmExecution?.finalStep
                  ?.currentSchroederSpatialEpochGenerationSummary?.()
                  .releaseFailureCount
                ?? null,
              artifactLedgerStatus:
                warmExecution?.finalStep
                  ?.currentSchroederHierarchyArtifactLedgerSummary?.().status
                ?? null,
              artifactRetirementScheduled:
                warmExecution?.finalStep
                  ?.currentSchroederHierarchyArtifactLedgerSummary?.()
                  .retirementScheduled
                ?? null,
              artifactRetirementCompleted:
                warmExecution?.finalStep
                  ?.currentSchroederHierarchyArtifactLedgerSummary?.()
                  .retirementCompleted
                ?? null,
              artifactPendingTransferCount:
                warmExecution?.finalStep
                  ?.currentSchroederHierarchyArtifactLedgerSummary?.()
                  .pendingTransferCount
                ?? null,
              artifactUnretiredOwnedResourceCount:
                warmExecution?.finalStep
                  ?.currentSchroederHierarchyArtifactLedgerSummary?.()
                  .unretiredOwnedResourceCount
                ?? null
            },
            residentAutoSchedule:
              overlay.__mlsMpmResidentAutoSchedule == null
                ? null
                : {
                    status:
                      overlay.__mlsMpmResidentAutoSchedule.status ?? null,
                    generation:
                      overlay.__mlsMpmResidentAutoSchedule.generation ?? null,
                    residentAuto:
                      overlay.__mlsMpmResidentAutoSchedule.residentAuto ?? null
                  },
            startupPresentationGate:
              overlay.__sphResidentStartupPresentationGate == null
                ? null
                : {
                    status:
                      overlay.__sphResidentStartupPresentationGate.status
                        ?? null,
                    active:
                      overlay.__sphResidentStartupPresentationGate.active
                        ?? null,
                    generation:
                      overlay.__sphResidentStartupPresentationGate.generation
                        ?? null,
                    reason:
                      overlay.__sphResidentStartupPresentationGate.reason
                        ?? null
                  },
            rebuildWorker: overlay.__sphPhaseRebuildWorker == null
              ? null
              : {
                  status: overlay.__sphPhaseRebuildWorker.status ?? null,
                  generation:
                    overlay.__sphPhaseRebuildWorker.generation ?? null,
                  reason: overlay.__sphPhaseRebuildWorker.reason ?? null
                },
            cpuClosureTask: overlay.__sphCpuClosureTask == null
              ? null
              : {
                  active: overlay.__sphCpuClosureTask.active ?? null,
                  label: overlay.__sphCpuClosureTask.label ?? null,
                  reason: overlay.__sphCpuClosureTask.reason ?? null
                }
          })
        );
        const resetPlaybackQuiescence =
          await quiesceInteractivePlayback({
            label: 'reset-playback-before-direct-measurement'
          });
        const resetCompletedAtMs = performance.now();
        interactiveCacheResetOrdinal = Number(
          resetEvidence.resetStatus.generation
        );
        execution = resetPlaybackQuiescence.execution;
        // The same-page reset publishes a new resident execution after the
        // presentation prepared during page warmup. Refresh that exact reset
        // execution before taking the initial post-reset sample. Otherwise the
        // sample truthfully reports the pre-reset draw as retained/stale, and a
        // later current draw cannot distinguish a healthy reset handoff from a
        // probe that simply sampled the two generations out of order.
        //
        // This is presentation work only: the resident source remains on the
        // GPU, the configured no-full-readback route is preserved, and the
        // refresh occurs before both the post-reset warmup and measured cache
        // intervals.
        markProbeProgress('post-reset-initial-render-state-started');
        overlay.__sphResidentRenderState = await sceneApi.refreshSphResidentRenderState({
          preferWebGpu: true,
          residentSteps: execution,
          renderFieldReadbackMode: requestedRenderReadbackMode,
          renderRowsReadbackMode: requestedRenderRowsReadbackMode,
          renderFieldSurfaceSummaryMode: requestedRenderFieldSurfaceSummaryMode,
          surfaceDrawDiagnosticMode: requestedSurfaceDrawDiagnosticMode,
          surfaceDrawDiagnosticMaxFieldCells: requestedSurfaceDrawDiagnosticMaxFieldCells,
          surfaceDrawDiagnosticMaxResolution: requestedSurfaceDrawDiagnosticMaxResolution,
          nativeMarchingCubesMaxVertexRowsBufferByteLength:
            requestedNativeMarchingCubesMaxVertexRowsBufferByteLength,
          nativeMarchingCubesMaxResolution: requestedNativeMarchingCubesMaxResolution,
          gasPressureSummary: overlay.__sphResidentGasPressureSummary || null
        });
        overlay.__sphResidentSurfaceDraw =
          sceneApi.getSphResidentSurfaceDraw?.()
          || overlay.__sphResidentSurfaceDraw
          || null;
        sceneApi.refreshViewportAndOverlay?.({
          reason: 'sph-long-horizon-probe-post-reset-initial-render-refresh'
        });
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const postResetInitialNativeSurfaceValidation =
          await waitForNativeSurfaceValidation(0);
        overlay.__sphResidentRenderState =
          sceneApi.getSphResidentRenderState?.()
          || overlay.__sphResidentRenderState;
        overlay.__sphResidentSurfaceDraw =
          sceneApi.getSphResidentSurfaceDraw?.()
          || overlay.__sphResidentSurfaceDraw;
        markProbeProgress('post-reset-initial-render-state-completed', {
          status: overlay.__sphResidentRenderState?.status ?? null,
          nativeSurfaceValidationStatus:
            postResetInitialNativeSurfaceValidation?.status ?? null,
          sourceResidentExecutionGenerationMatchesCurrent:
            overlay.__sphResidentSurfaceDraw
              ?.sourceResidentExecutionGenerationMatchesCurrent
            ?? null,
          sourceResidentRetainedPrevious:
            overlay.__sphResidentSurfaceDraw?.sourceResidentRetainedPrevious
            ?? null
        });
        const resetPageIdentity = {
          performanceTimeOrigin: performance.timeOrigin,
          documentUrl: location.href,
          navigationEntryCount:
            performance.getEntriesByType('navigation').length
        };
        interactiveCacheLifecycleEvidence = {
          schema: 'peercompute.ulg.sph-interactive-cache-lifecycle.v1',
          status: 'same-page-warm-reset-cached-measurement-running',
          sameBrowserProcess: true,
          sameBrowserContext: true,
          samePage: true,
          pageInstanceId: interactivePageInstanceId,
          pageIdentity,
          warmup: {
            completedAtMs: warmupCompletedAtMs,
            completedResidentBatchCount: 1,
            completedResidentStepCount:
              Number(warmExecution.completedStepCount),
            staticTableWrite: {
              schema: staticTableWrite.schema,
              status: staticTableWrite.status,
              storageKey: staticTableWrite.storageKey ?? null,
              backend: staticTableWrite.backend ?? null,
              counts: {
                tables: Number(staticTableWrite.counts.tables),
                gpuWarmup: Number(staticTableWrite.counts.gpuWarmup)
              }
            }
          },
          reset: {
            completedAtMs: resetCompletedAtMs,
            resetOrdinal: interactiveCacheResetOrdinal,
            control: 'sph-reset',
            navigationPerformed: Boolean(
              resetPageIdentity.performanceTimeOrigin
                !== pageIdentity.performanceTimeOrigin
              || resetPageIdentity.documentUrl !== pageIdentity.documentUrl
              || resetPageIdentity.navigationEntryCount
                !== pageIdentity.navigationEntryCount
            ),
            residentStateReset: true,
            resetGenerationAdvanced: true,
            residentExecutionIdentityChanged:
              execution !== warmExecution,
            playbackQuiescence: resetPlaybackQuiescence.evidence,
            performanceTimeOrigin:
              resetPageIdentity.performanceTimeOrigin,
            documentUrl: resetPageIdentity.documentUrl,
            navigationEntryCount:
              resetPageIdentity.navigationEntryCount,
            staticTableCacheStatus:
              resetEvidence.setParticlesTiming.staticTableCacheStatus,
            staticTableRead: {
              schema: resetEvidence.staticTableRead.schema ?? null,
              status: resetEvidence.staticTableRead.status,
              hitCount: Number(resetEvidence.staticTableRead.hitCount),
              tableCount: Number(resetEvidence.staticTableRead.tableCount),
              gpuWarmupCount:
                Number(resetEvidence.staticTableRead.gpuWarmupCount),
              restoredFamilies: Array.isArray(
                resetEvidence.staticTableRead.restoredFamilies
              )
                ? [...resetEvidence.staticTableRead.restoredFamilies]
                : []
            }
          },
          postResetMeasurement: {
            warmupBatchIndices: [1],
            measuredBatchIndices: [2, 3],
            drain: null,
            terminalHandoff: null
          }
        };
      }
      markProbeProgress('sampling-initial-state');
      await appendMetricWithValidationCapture(sample(0, 'initial', 0));
      const waitForWorkerOffscreenRetainedStateContinuation = async () => {
        const status = sceneApi.getWorkerOffscreenRetainedStateContinuationStatus?.()
          || overlay.__sphPhaseScene?.userData?.sphWorkerOffscreenRetainedStateContinuation
          || null;
        if (!status || status.inFlight !== true) return status;
        const waitStarted = performance.now();
        const timeoutMs = 8000;
        let current = status;
        markProbeProgress('worker-retained-state-continuation-wait-started', {
          status: current.status ?? null,
          hotBufferKey: current.hotBufferKey ?? null
        });
        while (performance.now() - waitStarted < timeoutMs) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          current = sceneApi.getWorkerOffscreenRetainedStateContinuationStatus?.()
            || overlay.__sphPhaseScene?.userData?.sphWorkerOffscreenRetainedStateContinuation
            || current;
          if (current?.inFlight !== true) break;
        }
        markProbeProgress('worker-retained-state-continuation-wait-completed', {
          status: current?.status ?? null,
          inFlight: current?.inFlight ?? null,
          chainStatus: current?.chainStatus ?? null,
          inputStatus: current?.workerRetainedContinuationInputStatus ?? null,
          applied: current?.workerRetainedContinuationApplied ?? null,
          elapsedMs: performance.now() - waitStarted
        });
        return current;
      };
      const waitForWorkerOffscreenRetainedCompactSnapshot = async () => {
        const readCurrent = () => sceneApi.getWorkerOffscreenRetainedCompactSnapshotStatus?.()
          || overlay.__sphPhaseScene?.userData?.sphWorkerOffscreenRetainedCompactSnapshot
          || null;
        const waitStarted = performance.now();
        const timeoutMs = 9000;
        let current = readCurrent();
        if (!current) {
          markProbeProgress('worker-retained-compact-snapshot-wait-skipped', {
            reason: 'retained-compact-snapshot-export-not-requested'
          });
          return null;
        }
        markProbeProgress('worker-retained-compact-snapshot-wait-started', {
          status: current?.status ?? null,
          reason: current?.reason ?? null
        });
        while (performance.now() - waitStarted < timeoutMs) {
          current = readCurrent() || current;
          if (/exported|blocked|failed|timeout/.test(String(current?.status || ''))) break;
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        markProbeProgress('worker-retained-compact-snapshot-wait-completed', {
          status: current?.status ?? null,
          reason: current?.reason ?? null,
          portableSnapshotAvailable: current?.portableSnapshotAvailable ?? null,
          crossPeerReplayReady: current?.crossPeerReplayReady ?? null,
          readbackByteLength: current?.readbackByteLength ?? null,
          elapsedMs: performance.now() - waitStarted
        });
        return current;
      };
      const mountedViewState = overlay.__sphPhaseViewState || null;
      const mechanicsIntegrator = mountedViewState?.gpuMechanics?.integrator
        || overlay.__sphDriver?.demo?.gpuMechanics?.integrator
        || null;
      if (mechanicsIntegrator && mechanicsIntegrator !== 'mlsmpm') {
        const ranges = cohortRangesFromCounts(mountedViewState?.counts || overlay.__sphDriver?.demo?.counts || {});
        let previousState = new Float32Array(sceneApi.getSphGpuParticleState?.()?.state || []);
        const mechanicalSubsteps = Math.max(
          1,
          Math.round(Number(mountedViewState?.gpuMechanics?.mechanicalSubsteps || overlay.__sphDriver?.demo?.gpuMechanics?.mechanicalSubsteps) || 1)
        );
        const driverStepsPerBatch = Math.max(1, Math.ceil(requestedBatchSteps / mechanicalSubsteps));
        for (let batchIndex = 1; batchIndex <= requestedBatches; batchIndex += 1) {
          const started = performance.now();
          try {
            markProbeProgress('plain-sph-batch-started', { batchIndex, driverStepsPerBatch });
            const stepResult = await overlay.__sphStep?.(driverStepsPerBatch);
            if (stepResult?.blocked) {
              throw new Error(stepResult.reason || 'plain SPH scene step blocked');
            }
            sceneApi.refreshViewportAndOverlay?.({ reason: 'sph-long-horizon-probe-plain-sph-render-refresh' });
            await new Promise((resolve) => requestAnimationFrame(resolve));
            const nextState = new Float32Array(sceneApi.getSphGpuParticleState?.()?.state || []);
            const finalStep = {
              schema: 'peercompute.ulg.plain-sph-cpu-reference-step.v0',
              backend: 'cpu-reference-mounted-scene',
              status: 'plain-sph-cpu-reference-executed',
              readbackMode: 'cpu-reference-full-state',
              sequenceIndex: stepResult?.step ?? null,
              particlePingPong: {
                sourceStep: null,
                nextStep: stepResult?.step ?? null,
                sourceTime: null,
                nextTime: finiteOrNull(stepResult?.time)
              },
              reactionEventsStep: finiteOrNull(stepResult?.reactionEventsStep),
              reactionEventsTotal: finiteOrNull(stepResult?.reactionEventsTotal),
              particlesByMaterial: { ...(stepResult?.particlesByMaterial || {}) },
              phaseMassByMaterialPhase: stepResult?.phaseMassSummary?.byMaterialPhase || null,
              reactionLedger: stepResult?.reactionLedger || null,
              diagnostics: particleDiagnosticsForState(nextState, previousState, ranges),
              stageStatus: {
                plainSph: 'cpu-reference-executed',
                p2g: 'not-run-plain-sph-cpu-reference',
                gridUpdate: 'not-run-plain-sph-cpu-reference',
                g2p: 'not-run-plain-sph-cpu-reference'
              },
              stageBackends: {
                plainSph: 'cpu-reference',
                p2g: null,
                gridUpdate: null,
                g2p: null
              }
            };
            execution = {
              schema: 'peercompute.ulg.plain-sph-cpu-reference-steps.v0',
              backend: 'cpu-reference-mounted-scene',
              status: 'plain-sph-cpu-reference-steps-executed',
              stepCount: driverStepsPerBatch,
              completedStepCount: driverStepsPerBatch,
              readbackMode: 'cpu-reference-full-state',
              requestedReadbackMode: requestedReadbackMode,
              nextSphParticleState: sceneApi.getSphGpuParticleState?.() || null,
              nextMlsMpmParticleState: sceneApi.getMlsMpmGpuParticleState?.() || null,
              nextParticleBufferMode: 'cpu-reference-mounted-scene-state',
              normalHotLoopReadbackFree: false,
              residentAuthorityLedgerStatus: 'not-run-plain-sph-cpu-reference',
              residentAuthorityFamilyOwners: null,
              residentAuthorityWarnings: [
                'plain-sph-reference-mode-not-gpu-resident',
                'plain-sph-reference-mode-not-authoritative-mls-mpm'
              ],
              residentAuthorityBlockers: [],
              finalStep
            };
            overlay.__mlsMpmResidentSteps = execution;
            overlay.__mlsMpmResidentStep = finalStep;
            overlay.__sphAppendResidentStageOrderTrace?.({
              status: 'plain-sph-cpu-reference-batch-complete',
              reason: 'sph-long-horizon-probe-direct-cpu-reference',
              scheduleToken: batchIndex,
              stepCount: driverStepsPerBatch,
              readbackMode: 'cpu-reference-full-state',
              continueFromResidentState: false,
              residentExecutionPolicy,
              execution
            });
            markProbeProgress('plain-sph-batch-completed', {
              batchIndex,
              batchMs: performance.now() - started,
              maxDisplacementM: finalStep.diagnostics?.maxDisplacementM ?? null
            });
            const metric = sample(batchIndex, 'plain-sph-cpu-reference-batch', performance.now() - started);
            await appendMetricWithValidationCapture(metric);
            previousState = nextState;
          } catch (error) {
            markProbeProgress('plain-sph-batch-error', {
              batchIndex,
              batchMs: performance.now() - started,
              error: error instanceof Error ? error.message : String(error)
            });
            errors.push({ batchIndex, message: error instanceof Error ? error.message : String(error) });
            await appendMetricWithValidationCapture(
              sample(batchIndex, 'plain-sph-cpu-reference-error', performance.now() - started)
            );
            break;
          }
        }
        return {
          schema: 'peercompute.ulg.sph-history-long-horizon-probe.v0',
          status: errors.length ? 'completed-with-errors' : 'complete',
          mechanicsIntegrator,
          batchCount: requestedBatches,
          batchStepCount: requestedBatchSteps,
          driverStepsPerBatch,
          requestedSubsteps: requestedBatches * requestedBatchSteps,
          readbackMode: 'cpu-reference-full-state',
          renderReadbackMode: 'cpu-reference-mounted-scene',
          renderRowsReadbackMode: 'cpu-reference-mounted-scene',
          pressureInterfaceDisabled: Boolean(requestedDisablePressureInterface),
          anomalyRowReadback: false,
          thermalWallRateOverride: Number.isFinite(requestedThermalWallRate) ? requestedThermalWallRate : null,
          renderEveryBatches: 0,
          preProbeSnapshots: Array.isArray(requestedPreProbeSnapshots) ? requestedPreProbeSnapshots : [],
          pageConsole: requestedPageConsole || [],
          visualFrameCapture: {
            enabled: Boolean(requestedCaptureFrames),
            frameEveryBatches: requestedCaptureFrameEvery,
            maxFrames: requestedCaptureFrameMax,
            frameCount: visualFrames.length
          },
          authoritativeGpuCheckpointCapture: authoritativeGpuCheckpointCaptureSummary(),
          visualFrames,
          errors,
          metrics,
          scientificValidation: false,
          sphValidation: false,
          phaseChangeValidation: false,
          fullPhysicsValidation: false
        };
      }
      let pendingBackgroundSettlement = null;
      const residentRefreshOptions = ({
        sourceExecution,
        stepCount,
        schroederGpuTimestampRecorder = null
      }) => {
        // Direct scene API probes historically omitted the mounted authority
        // host, which made an explicitly requested worker-owned renderer fail
        // admission and silently execute the direct fallback. The mount
        // publishes the exact live host after runtime admission; thread its
        // managers through every probe schedule so the matrix measures the
        // same ComputeManager/StateManager authority path as playback.
        const residentAuthorityHost = globalThis.__ulgResidentAuthorityHost
          || null;
        return {
          preferWebGpu: true,
          computeManager: residentAuthorityHost?.computeManager ?? null,
          residentStateManager: residentAuthorityHost?.stateManager ?? null,
          residentAuthorityHost,
          computeTaskDomainKey: 'sph-visual-sanity-matrix',
          gasPressureSummary: overlay.__sphResidentGasPressureSummary
            || overlay.__sphPhaseViewState?.gasPressureSummary
            || null,
          stepCount,
          workerLaneProgressEverySteps:
            requestedWorkerLaneProgressEverySteps,
          readbackMode: requestedReadbackMode,
          compactSummaryMode: requestedCompactSummaryMode,
          compactSummaryScope: requestedCompactSummaryScope,
          continueFromResidentState: Boolean(
            sourceExecution?.continuationAvailable
          ),
          force: true,
          // Stage progress remains available through the in-page progress
          // object. Mirroring ~50 debug messages per physics step through
          // Playwright/CDP materially distorts long-horizon timing while adding
          // no acceptance evidence.
          emitResidentProgressConsole: false,
          pressureInterfaceForceSolver:
            requestedDisablePressureInterface ? null : undefined,
          pressureInterfaceForceRowsBuffer:
            requestedDisablePressureInterface ? null : undefined,
          contactKinematicsParticleBinMetadataReadback:
            Boolean(requestedContactBinMetadataReadback),
          reactionParticleBinMetadataReadback:
            Boolean(requestedReactionBinMetadataReadback),
          thermalStepOptions: Number.isFinite(requestedThermalWallRate)
            ? { wallRate: requestedThermalWallRate }
            : undefined,
          ...residentExecutionPolicy,
          ...schroederExecutionOptions,
          collectSchroederHierarchyHostTiming: Boolean(
            requestedCollectSchroederHierarchyHostTiming
          ),
          ...(Number.isFinite(requestedPhaseVolumeMaxImpulseFraction)
            ? {
                phaseVolumeMaxImpulseFraction:
                  Math.max(0, requestedPhaseVolumeMaxImpulseFraction)
              }
            : {}),
          ...(schroederGpuTimestampRecorder
            ? { schroederGpuTimestampRecorder }
            : {}),
          measureFusedSequenceQueueFence: Boolean(
            requestedMeasureGpuQueueFence
            || residentExecutionPolicy?.measureFusedSequenceQueueFence
          )
        };
      };
      const settlementIsPending = (candidate) => Boolean(
        String(
          candidate?.schroederSpatialEpochReleaseSettlementStatus ?? ''
        ).startsWith('pending-')
        || String(
          candidate?.schroederHierarchyArtifactLedgerSettlementStatus ?? ''
        ).startsWith('pending-')
        || String(
          candidate?.schroederSuccessorSourceFamilyRetirementStatus ?? ''
        ).startsWith('pending-')
      );
      const refreshRetainedSettlementEvidence = (record) => {
        const retainedMetric = record?.retainedMetric;
        const settledExecution = record?.execution;
        if (!retainedMetric?.residentSteps || !settledExecution) return;
        if (requestedArtifactDetailMode === 'visual-compact') {
          refreshVisualSettlementEvidence(
            retainedMetric.residentSteps,
            settledExecution
          );
          retainedMetric.residentSteps.artifactCompaction = {
            ...retainedMetric.residentSteps.artifactCompaction,
            settlementReplayRelease:
              releaseVisualSettlementReplayState(settledExecution)
          };
          return;
        }
        retainedMetric.residentSteps.schroederSpatialEpochTransactionSummaries =
          Array.isArray(
            settledExecution.schroederSpatialEpochTransactionSummaries
          )
            ? settledExecution.schroederSpatialEpochTransactionSummaries.map(
                compactSchroederSpatialEpochTransaction
              )
            : [];
        retainedMetric.residentSteps.schroederSpatialEpochReleaseSettlementCount =
          settledExecution.schroederSpatialEpochReleaseSettlementCount
          ?? null;
        retainedMetric.residentSteps.schroederSpatialEpochReleaseSettlementComplete =
          settledExecution.schroederSpatialEpochReleaseSettlementComplete
          === true;
        retainedMetric.residentSteps.schroederHierarchyArtifactLedgerSummaries =
          Array.isArray(
            settledExecution.schroederHierarchyArtifactLedgerSummaries
          )
            ? settledExecution.schroederHierarchyArtifactLedgerSummaries.map(
                (summary) => ({ ...summary })
              )
            : [];
        retainedMetric.residentSteps
          .schroederHierarchyArtifactLedgerSettlementCount =
          settledExecution.schroederHierarchyArtifactLedgerSettlementCount
          ?? null;
        retainedMetric.residentSteps
          .schroederHierarchyArtifactLedgerSettlementComplete =
          settledExecution.schroederHierarchyArtifactLedgerSettlementComplete
          === true;
      };
      const authenticatePendingBackgroundSettlement = async (
        record,
        { successorBatchIndex, terminalDrain = false }
      ) => {
        if (!record) return null;
        const startedAtMs = performance.now();
        const settled = await record.promise;
        if (settled !== true) {
          throw new Error(
            `Schroeder resident batch ${record.batchIndex} background settlement was not confirmed`
          );
        }
        const elapsedMs = performance.now() - startedAtMs;
        record.timing.backgroundSettlementAwaitMs = elapsedMs;
        record.timing.totalBeforeSampleMs = Math.max(
          0,
          Number(record.timing.totalBeforeSampleMs) || 0
        ) + elapsedMs;
        record.timing.backgroundSettlementStatus = terminalDrain
          ? 'background-settlement-complete-after-unmeasured-terminal-consumer'
          : 'background-settlement-complete-after-successor-consumer';
        record.timing.backgroundSettlementSuccessorBatchIndex =
          successorBatchIndex;
        record.timing.backgroundSettlementTerminalDrain = terminalDrain;
        refreshRetainedSettlementEvidence(record);
        return {
          sourceBatchIndex: record.batchIndex,
          successorBatchIndex,
          terminalDrain,
          elapsedMs,
          status: record.timing.backgroundSettlementStatus
        };
      };
      for (let batchIndex = 1; batchIndex <= requestedBatches; batchIndex += 1) {
        interactiveCacheMeasurementClass = requestedInteractiveCacheLifecycle
          ? (batchIndex === 1
              ? 'post-reset-warmup'
              : 'post-reset-measured')
          : null;
        const started = performance.now();
        const probeResidentBatchTiming = {
          schema: 'peercompute.ulg.sph-probe-resident-batch-timing.v0',
          status: 'resident-batch-timing-started',
          batchIndex,
          startedAtMs: started,
          residentStepsAwaitMs: null,
          backgroundSettlementAwaitMs: null,
          backgroundSettlementStatus: null,
          thermalCandidateCsrRouteReadbackMs: null,
          renderRefreshAwaitMs: 0,
          materialInterfaceDiagnosticMs: 0,
          viewportRefreshMs: 0,
          viewportRafMs: 0,
          nativeSurfaceValidationWaitMs: 0,
          gpuTimestampInterval: null,
          gpuStageTimestamps: null,
          residentStageWallTrace: null,
          totalBeforeSampleMs: null
        };
        let residentGpuTimestampInterval = null;
        let residentGpuStageTimestampRecorder = null;
        let residentStageWallTrace = null;
        try {
          markProbeProgress('resident-batch-started', { batchIndex, batchSteps: requestedBatchSteps });
          residentGpuTimestampInterval = await beginResidentGpuTimestampInterval(
            batchIndex
          );
          probeResidentBatchTiming.gpuTimestampInterval =
            residentGpuTimestampInterval.evidence;
          residentGpuStageTimestampRecorder =
            await beginResidentGpuStageTimestampRecorder(batchIndex);
          probeResidentBatchTiming.gpuStageTimestamps =
            residentGpuStageTimestampRecorder.evidence;
          residentStageWallTrace =
            createResidentStageWallTrace(batchIndex);
          probeResidentBatchTiming.residentStageWallTrace =
            residentStageWallTrace.evidence();
          const residentStepsAwaitStartedAtMs = performance.now();
          const sourceExecution = execution;
          const currentExecution = mountedResidentSchedule
            ? await runMountedResidentSchedule({
                stepCount: requestedBatchSteps,
                readbackMode: requestedReadbackMode,
                continueFromResidentState: batchIndex > 1
              })
            : await sceneApi.refreshMlsMpmResidentSteps(
                residentRefreshOptions({
                  sourceExecution,
                  stepCount: requestedBatchSteps,
                  schroederGpuTimestampRecorder:
                    residentStageWallTrace.recorder
                    ?? residentGpuStageTimestampRecorder.recorder
                })
              );
          const publishedExecutionAfterCompute =
            sceneApi.getMlsMpmResidentSteps?.() || null;
          probeResidentBatchTiming.executionPublicationAfterCompute = {
            schema:
              'peercompute.ulg.sph-probe-resident-execution-publication.v0',
            status: currentExecution === publishedExecutionAfterCompute
              ? 'computed-execution-published'
              : 'computed-execution-not-published',
            computedExecutionMatchesPublishedExecution:
              currentExecution === publishedExecutionAfterCompute,
            computedExecutionStale: currentExecution?.stale === true,
            computedExecutionStaleReason:
              currentExecution?.staleReason ?? null,
            computedExecutionStatus: currentExecution?.status ?? null,
            computedExecutionPublicationRevalidation:
              currentExecution?.residentPublicationRevalidation ?? null,
            computedExecutionSignature:
              currentExecution?.signature ?? null,
            publishedExecutionStatus:
              publishedExecutionAfterCompute?.status ?? null,
            publishedExecutionSignature:
              publishedExecutionAfterCompute?.signature ?? null,
            sourceExecutionMatchesPublishedExecution:
              sourceExecution === publishedExecutionAfterCompute,
            sourceExecutionContinuationAvailable:
              sourceExecution?.continuationAvailable === true,
            sourceExecutionNextSphParticleStateAvailable:
              Boolean(sourceExecution?.nextSphParticleState),
            sourceExecutionNextMlsMpmParticleStateAvailable:
              Boolean(sourceExecution?.nextMlsMpmParticleState),
            sourceExecutionSphUploadStatus:
              sourceExecution?.nextParticleUploads?.sphParticleUpload?.status
              ?? null,
            sourceExecutionMlsMpmUploadStatus:
              sourceExecution?.nextParticleUploads?.mlsMpmParticleUpload?.status
              ?? null
          };
          probeResidentBatchTiming.residentStepsAwaitMs =
            performance.now() - residentStepsAwaitStartedAtMs;
          // A one-step Schroeder batch cannot settle its next-tick cleanup
          // until the following useful hierarchy consumer seals the claim.
          // Execute that successor first, then authenticate the prior promise;
          // awaiting the current promise here deadlocks the exact ownership
          // protocol and turns a healthy ~15 ms batch into a probe timeout.
          if (pendingBackgroundSettlement) {
            await authenticatePendingBackgroundSettlement(
              pendingBackgroundSettlement,
              { successorBatchIndex: batchIndex }
            );
            pendingBackgroundSettlement = null;
          }
          execution = currentExecution;
          const backgroundSettlementPromise =
            execution?.schroederBackgroundSettlementPromise ?? null;
          if (
            backgroundSettlementPromise
            && typeof backgroundSettlementPromise.then === 'function'
          ) {
            probeResidentBatchTiming.backgroundSettlementStatus =
              'pending-successor-consumer';
            probeResidentBatchTiming.backgroundSettlementAwaitMs = 0;
          } else {
            if (settlementIsPending(execution)) {
              throw new Error(
                'Schroeder resident batch omitted its pending background settlement promise'
              );
            }
            probeResidentBatchTiming.backgroundSettlementStatus =
              execution?.schroederSimulation === true
                ? 'already-settled-no-background-promise'
                : 'not-required';
            probeResidentBatchTiming.backgroundSettlementAwaitMs = 0;
          }
          probeResidentBatchTiming.residentStageWallTrace =
            residentStageWallTrace.evidence();
          probeResidentBatchTiming.gpuTimestampInterval =
            await residentGpuTimestampInterval.complete();
          probeResidentBatchTiming.gpuStageTimestamps =
            await residentGpuStageTimestampRecorder.complete();
          markProbeProgress('resident-batch-completed', {
            batchIndex,
            batchMs: performance.now() - started,
            backend: execution?.backend || null,
            completedStepCount: execution?.completedStepCount ?? null,
            backgroundSettlementStatus:
              probeResidentBatchTiming.backgroundSettlementStatus,
            backgroundSettlementAwaitMs:
              probeResidentBatchTiming.backgroundSettlementAwaitMs
          });
          overlay.__mlsMpmResidentSteps = execution;
          overlay.__mlsMpmResidentStep = sceneApi.getMlsMpmResidentStep?.() || execution?.finalStep || null;
          if (!mountedResidentSchedule) {
            overlay.__sphAppendResidentStageOrderTrace?.({
              status: 'resident-execution-complete-direct-probe',
              reason: 'sph-long-horizon-probe-direct-scene-refresh',
              scheduleToken: batchIndex,
              stepCount: requestedBatchSteps,
              readbackMode: requestedReadbackMode,
              continueFromResidentState: Boolean(execution?.continuedFromResidentState),
              residentExecutionPolicy,
              execution
            });
          }
          overlay.__sphUpdateResidentGasPressureSummary?.(overlay.__mlsMpmResidentStep);
          if (
            !mountedResidentSchedule
            && (batchIndex % requestedRenderEvery === 0 || batchIndex === requestedBatches)
            && sceneApi.refreshSphResidentRenderState
          ) {
            markProbeProgress('resident-render-refresh-started', { batchIndex });
            const renderRefreshAwaitStartedAtMs = performance.now();
            overlay.__sphResidentRenderState = await sceneApi.refreshSphResidentRenderState({
              preferWebGpu: true,
              residentSteps: execution,
              renderFieldReadbackMode: requestedRenderReadbackMode,
              renderRowsReadbackMode: requestedRenderRowsReadbackMode,
              renderFieldSurfaceSummaryMode: requestedRenderFieldSurfaceSummaryMode,
              surfaceDrawDiagnosticMode: requestedSurfaceDrawDiagnosticMode,
              surfaceDrawDiagnosticMaxFieldCells: requestedSurfaceDrawDiagnosticMaxFieldCells,
              surfaceDrawDiagnosticMaxResolution: requestedSurfaceDrawDiagnosticMaxResolution,
              nativeMarchingCubesMaxVertexRowsBufferByteLength:
                requestedNativeMarchingCubesMaxVertexRowsBufferByteLength,
              nativeMarchingCubesMaxResolution: requestedNativeMarchingCubesMaxResolution,
              gasPressureSummary: overlay.__sphResidentGasPressureSummary || null,
              allowNativeSurfaceExtraction: shouldExtractNativeSurface(
                batchIndex,
                'resident-batch'
              )
            });
            probeResidentBatchTiming.renderRefreshAwaitMs =
              performance.now() - renderRefreshAwaitStartedAtMs;
            markProbeProgress('resident-render-refresh-completed', {
              batchIndex,
              status: overlay.__sphResidentRenderState?.status ?? null,
              bridge: overlay.__sphResidentRenderState?.surfaceDrawVisibleRendererBridge ?? null,
              gpuBufferHandoffReady: overlay.__sphResidentRenderState?.surfaceDrawGpuBufferHandoffReady ?? null
            });
            if (requestedResidentBufferDebug && sceneApi.debugSphResidentParticleUpload) {
              overlay.__sphResidentParticleUploadDebug = await sceneApi.debugSphResidentParticleUpload({
                preferWebGpu: true,
                residentSteps: execution,
                includeRenderRows: true
              });
            }
            overlay.__sphResidentSurfaceDraw = sceneApi.getSphResidentSurfaceDraw?.() || null;
            const skipNoOverlayHandoffViewportRefresh = Boolean(
              overlay.__sphResidentRenderState?.surfaceDrawVisibleRendererBridge === 'resident-surface-buffers-no-overlay'
              && overlay.__sphResidentRenderState?.surfaceDrawGpuBufferHandoffReady === true
            );
            if (skipNoOverlayHandoffViewportRefresh) {
              markProbeProgress('resident-render-refresh-viewport-skipped', {
                batchIndex,
                reason: 'resident-surface-buffer-handoff-no-visible-overlay'
              });
            } else {
              markProbeProgress('resident-render-refresh-viewport-started', { batchIndex });
              const viewportRefreshStartedAtMs = performance.now();
              sceneApi.refreshViewportAndOverlay?.({ reason: 'sph-long-horizon-probe-render-refresh' });
              const workerViewportSnapshot = workerOffscreenViewportSnapshot();
              if (workerOffscreenViewportPresented(workerViewportSnapshot)) {
                probeResidentBatchTiming.viewportSignal = 'worker-offscreen-presented-canvas';
                probeResidentBatchTiming.viewportRafSkipped = true;
                probeResidentBatchTiming.viewportRafMs = 0;
                probeResidentBatchTiming.viewportWorkerOffscreenStatus = workerViewportSnapshot.status;
                probeResidentBatchTiming.viewportWorkerOffscreenFrameCount = workerViewportSnapshot.frameCount;
                probeResidentBatchTiming.viewportWorkerOffscreenReadyFrameCount =
                  workerViewportSnapshot.readyFrameCount;
              } else {
                probeResidentBatchTiming.viewportSignal = 'main-thread-raf';
                probeResidentBatchTiming.viewportRafSkipped = false;
                const viewportRafStartedAtMs = performance.now();
                await new Promise((resolve) => requestAnimationFrame(resolve));
                probeResidentBatchTiming.viewportRafMs =
                  performance.now() - viewportRafStartedAtMs;
              }
              const nativeSurfaceValidationStartedAtMs = performance.now();
              await waitForNativeSurfaceValidation(batchIndex);
              probeResidentBatchTiming.nativeSurfaceValidationWaitMs =
                performance.now() - nativeSurfaceValidationStartedAtMs;
              probeResidentBatchTiming.viewportRefreshMs =
                performance.now() - viewportRefreshStartedAtMs;
              markProbeProgress('resident-render-refresh-viewport-completed', {
                batchIndex,
                viewportSignal: probeResidentBatchTiming.viewportSignal ?? null,
                viewportRafSkipped: probeResidentBatchTiming.viewportRafSkipped ?? false
              });
            }
          }
          if (
            requestedMaterialInterfaceDiagnostic
            && typeof sceneApi.refreshSphResidentMaterialInterfaceState === 'function'
          ) {
            markProbeProgress('resident-material-interface-diagnostic-started', { batchIndex });
            const materialInterfaceDiagnosticStartedAtMs = performance.now();
            const materialInterfaceState = await sceneApi.refreshSphResidentMaterialInterfaceState({
              preferWebGpu: true,
              residentSteps: execution,
              materialProperties: overlay.__sphPhaseViewState?.materialProperties || {},
              gasPressureSummary: overlay.__sphResidentGasPressureSummary || null,
              source: 'sph-long-horizon-probe-material-interface-diagnostic',
              sourceCadence: 'benchmark-diagnostic',
              candidateReadbackMode: requestedMaterialInterfaceCandidateReadbackMode
            });
            probeResidentBatchTiming.materialInterfaceDiagnosticMs =
              performance.now() - materialInterfaceDiagnosticStartedAtMs;
            overlay.__sphResidentMaterialInterfaceState = materialInterfaceState;
            markProbeProgress('resident-material-interface-diagnostic-completed', {
              batchIndex,
              status: materialInterfaceState?.status ?? null,
              interfaceSourceFieldStatus:
                materialInterfaceState?.interfaceSourceFieldStatus
                ?? materialInterfaceState?.sourceFieldStatus
                ?? null,
              interfaceSourceFieldBackend:
                materialInterfaceState?.interfaceSourceFieldBackend
                ?? materialInterfaceState?.sourceFieldBackend
                ?? null
            });
          }
          const measuredBatchMs = performance.now() - started;
          probeResidentBatchTiming.totalBeforeSampleMs = measuredBatchMs;
          probeResidentBatchTiming.status = 'resident-batch-timing-collected';
          if (requestedCaptureThermalCandidateCsrRouteEvidence) {
            const routeReadbackStartedAtMs = performance.now();
            latestThermalCandidateCsrRouteEvidence =
              await captureThermalCandidateCsrRouteEvidence(execution);
            probeResidentBatchTiming.thermalCandidateCsrRouteReadbackMs =
              performance.now() - routeReadbackStartedAtMs;
          }
          probeResidentBatchTiming.thermalCandidateCsrRouteEvidenceStatus =
            latestThermalCandidateCsrRouteEvidence.status ?? null;
          probeResidentBatchTiming.thermalCandidateCsrRoute =
            latestThermalCandidateCsrRouteEvidence.route ?? null;
          overlay.__sphProbeResidentBatchTiming = probeResidentBatchTiming;
          markProbeProgress('resident-batch-sampling-started', { batchIndex });
          const metric = sample(batchIndex, 'resident-batch', measuredBatchMs);
          const retainedMetric =
            await appendMetricWithValidationCapture(metric);
          if (
            backgroundSettlementPromise
            && typeof backgroundSettlementPromise.then === 'function'
          ) {
            pendingBackgroundSettlement = {
              batchIndex,
              execution,
              promise: backgroundSettlementPromise,
              timing: probeResidentBatchTiming,
              retainedMetric
            };
          }
          if (shouldRunAnomalyRowReadback(metric)) {
            overlay.__sphResidentRenderState = await sceneApi.refreshSphResidentRenderState({
              preferWebGpu: true,
              residentSteps: execution,
              renderFieldReadbackMode: requestedRenderReadbackMode,
              renderRowsReadbackMode: 'full-parity-readback',
              renderFieldSurfaceSummaryMode: 'readback',
              surfaceDrawDiagnosticMode: requestedSurfaceDrawDiagnosticMode,
              surfaceDrawDiagnosticMaxFieldCells: requestedSurfaceDrawDiagnosticMaxFieldCells,
              surfaceDrawDiagnosticMaxResolution: requestedSurfaceDrawDiagnosticMaxResolution,
              gasPressureSummary: overlay.__sphResidentGasPressureSummary || null,
              allowNativeSurfaceExtraction: shouldExtractNativeSurface(
                batchIndex,
                'resident-batch-anomaly'
              )
            });
            if (requestedResidentBufferDebug && sceneApi.debugSphResidentParticleUpload) {
              overlay.__sphResidentParticleUploadDebug = await sceneApi.debugSphResidentParticleUpload({
                preferWebGpu: true,
                residentSteps: execution,
                includeRenderRows: true
              });
            }
            overlay.__sphResidentSurfaceDraw = sceneApi.getSphResidentSurfaceDraw?.() || null;
            sceneApi.refreshViewportAndOverlay?.({ reason: 'sph-long-horizon-probe-anomaly-render-refresh' });
            await new Promise((resolve) => requestAnimationFrame(resolve));
            await appendMetricWithValidationCapture(
              sample(batchIndex, 'resident-batch-anomaly-row-readback', performance.now() - started)
            );
          }
        } catch (error) {
          residentGpuTimestampInterval?.abort?.(
            error instanceof Error ? error.message : String(error)
          );
          residentGpuStageTimestampRecorder?.abort?.(
            error instanceof Error ? error.message : String(error)
          );
          if (residentGpuTimestampInterval?.evidence) {
            probeResidentBatchTiming.gpuTimestampInterval =
              residentGpuTimestampInterval.evidence;
          }
          if (residentGpuStageTimestampRecorder?.evidence) {
            probeResidentBatchTiming.gpuStageTimestamps =
              residentGpuStageTimestampRecorder.evidence;
          }
          overlay.__sphProbeResidentBatchTiming = probeResidentBatchTiming;
          markProbeProgress('resident-batch-error', {
            batchIndex,
            batchMs: performance.now() - started,
            error: error instanceof Error ? error.message : String(error)
          });
          errors.push({
            batchIndex,
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack || null : null
          });
          // The failing operation may already have terminalized or exhausted
          // the GPU device. Preserve its CPU-side metric and exact scene/worker
          // receipts, but never start another checkpoint, render extraction,
          // or readback from an error handler; that can mask the primary error
          // with a secondary OOM/device-loss and can hang until scenario timeout.
          metrics.push(retainProbeMetric(
            sample(batchIndex, 'resident-batch-error', performance.now() - started)
          ));
          publishPartialTimeline('completed-with-errors');
          break;
        }
      }
      let terminalDrainEvidence = null;
      if (pendingBackgroundSettlement && errors.length === 0) {
        const drainStartedAtMs = performance.now();
        const drainSourceExecution = execution;
        const sourceFamilyLiveness = async (candidate) => {
          if (!candidate) return null;
          try {
            const module = await import(
              '/src/runtime/sph/schroederSpatialSuccessorSourceFamily.js'
            );
            return module.schroederSpatialSuccessorSourceFamilyLiveness(
              candidate
            );
          } catch (error) {
            return {
              status: 'successor-source-family-liveness-unavailable',
              error: error instanceof Error ? error.message : String(error)
            };
          }
        };
        const sceneDrainSourceExecution =
          sceneApi.getMlsMpmResidentSteps?.()
          || overlay.__mlsMpmResidentSteps
          || null;
        const requestedSourceFamily =
          drainSourceExecution?.nextParticleUploads
            ?.schroederSpatialSuccessorSourceFamily
          ?? drainSourceExecution?.finalStep?.nextParticleUploads
            ?.schroederSpatialSuccessorSourceFamily
          ?? null;
        const sceneSourceFamily =
          sceneDrainSourceExecution?.nextParticleUploads
            ?.schroederSpatialSuccessorSourceFamily
          ?? sceneDrainSourceExecution?.finalStep?.nextParticleUploads
            ?.schroederSpatialSuccessorSourceFamily
          ?? null;
        terminalDrainEvidence = {
          schema: 'peercompute.ulg.sph-probe-terminal-drain.v0',
          status: 'unmeasured-terminal-consumer-started',
          measured: false,
          metricPublished: false,
          sourceBatchIndex: pendingBackgroundSettlement.batchIndex,
          successorBatchIndex: requestedBatches + 1,
          sourceExecutionMatchesSceneExecution:
            drainSourceExecution === sceneDrainSourceExecution,
          sourceFamilyMatchesSceneSourceFamily:
            requestedSourceFamily === sceneSourceFamily,
          requestedSourceFamilyLiveness:
            await sourceFamilyLiveness(requestedSourceFamily),
          sceneSourceFamilyLiveness:
            sceneSourceFamily === requestedSourceFamily
              ? null
              : await sourceFamilyLiveness(sceneSourceFamily),
          elapsedMs: null,
          error: null
        };
        try {
          const drainExecution = mountedResidentSchedule
            ? await runMountedResidentSchedule({
                stepCount: 1,
                readbackMode: requestedReadbackMode,
                continueFromResidentState: true
              })
            : await sceneApi.refreshMlsMpmResidentSteps(
                residentRefreshOptions({
                  sourceExecution: drainSourceExecution,
                  stepCount: 1
                })
              );
          const settlement = await authenticatePendingBackgroundSettlement(
            pendingBackgroundSettlement,
            {
              successorBatchIndex: requestedBatches + 1,
              terminalDrain: true
            }
          );
          pendingBackgroundSettlement = null;
          execution = drainExecution;
          terminalDrainEvidence = {
            ...terminalDrainEvidence,
            status: 'unmeasured-terminal-consumer-complete',
            completedStepCount:
              Number(drainExecution?.completedStepCount ?? 0),
            elapsedMs: performance.now() - drainStartedAtMs,
            settledStatus: settlement.status
          };
          if (interactiveCacheLifecycleEvidence) {
            globalThis.__ulgInteractiveCacheTerminalDrainExecution =
              drainExecution;
            interactiveCacheLifecycleEvidence.postResetMeasurement.drain = {
              ...terminalDrainEvidence,
              schema:
                'peercompute.ulg.sph-interactive-cache-terminal-drain.v1'
            };
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          terminalDrainEvidence = {
            ...terminalDrainEvidence,
            status: 'unmeasured-terminal-consumer-failed',
            elapsedMs: performance.now() - drainStartedAtMs,
            requestedSourceFamilyLivenessAfterFailure:
              await sourceFamilyLiveness(requestedSourceFamily),
            sceneSourceFamilyLivenessAfterFailure:
              sceneSourceFamily === requestedSourceFamily
                ? null
                : await sourceFamilyLiveness(sceneSourceFamily),
            error: message
          };
          errors.push({
            batchIndex: requestedBatches + 1,
            phase: 'terminal-drain',
            message,
            stack: error instanceof Error ? error.stack || null : null,
            terminalDrainEvidence
          });
        }
      }
      if (interactiveCacheLifecycleEvidence) {
        const residentMetrics = metrics.filter(
          (metric) => metric?.phase === 'resident-batch'
        );
        interactiveCacheLifecycleEvidence.status = errors.length === 0
          && residentMetrics.length === requestedBatches
          && residentMetrics[0]?.interactiveCacheMeasurementClass
            === 'post-reset-warmup'
          && residentMetrics.slice(1).every(
            (metric) => metric?.interactiveCacheMeasurementClass
              === 'post-reset-measured'
          )
          && residentMetrics.every((metric) => (
            metric?.pageInstanceId === interactivePageInstanceId
            && metric?.cacheResetOrdinal === interactiveCacheResetOrdinal
          ))
          && interactiveCacheLifecycleEvidence.postResetMeasurement
            .drain?.status === 'unmeasured-terminal-consumer-complete'
          ? 'same-page-warm-reset-cached-measurement-awaiting-terminal-handoff'
          : 'same-page-warm-reset-cached-measurement-incomplete';
        interactiveCacheLifecycleEvidence.completedAtMs = performance.now();
        interactiveCacheLifecycleEvidence.postResetMeasurement = {
          ...interactiveCacheLifecycleEvidence.postResetMeasurement,
          observedResidentBatchIndices: residentMetrics.map(
            (metric) => metric.batchIndex
          ),
          observedMeasurementClasses: residentMetrics.map(
            (metric) => metric.interactiveCacheMeasurementClass
          )
        };
      }
      const continuationWaitStarted = performance.now();
      const retainedStateContinuation = await waitForWorkerOffscreenRetainedStateContinuation();
      if (retainedStateContinuation) {
        metrics.push(retainProbeMetric(
          sample(
            requestedBatches,
            'resident-batch-retained-continuation',
            performance.now() - continuationWaitStarted
          )
        ));
      }
      if (
        retainedStateContinuation?.status === 'presentation-worker-retained-state-continuation-completed'
        && retainedStateContinuation?.workerRetainedContinuationApplied === true
      ) {
        const compactSnapshotWaitStarted = performance.now();
        const retainedCompactSnapshot = await waitForWorkerOffscreenRetainedCompactSnapshot();
        if (retainedCompactSnapshot) {
          metrics.push(retainProbeMetric(
            sample(
              requestedBatches,
              'resident-batch-retained-compact-snapshot',
              performance.now() - compactSnapshotWaitStarted
            )
          ));
        }
      }
      publishPartialTimeline(
        errors.length ? 'completed-with-errors' : 'complete'
      );
      return {
        schema: 'peercompute.ulg.sph-history-long-horizon-probe.v0',
        status: errors.length ? 'completed-with-errors' : 'complete',
        batchCount: requestedBatches,
        batchStepCount: requestedBatchSteps,
        workerLaneProgressEverySteps:
          requestedWorkerLaneProgressEverySteps,
        requestedSubsteps: requestedBatches * requestedBatchSteps,
        terminalDrainEvidence,
        readbackMode: requestedReadbackMode,
        compactSummaryMode: requestedCompactSummaryMode,
        compactSummaryScope: requestedCompactSummaryScope,
        artifactDetailMode: requestedArtifactDetailMode,
        phaseVolumeMaxImpulseFractionOverride:
          Number.isFinite(requestedPhaseVolumeMaxImpulseFraction)
            ? requestedPhaseVolumeMaxImpulseFraction
            : null,
        renderReadbackMode: requestedRenderReadbackMode,
        renderRowsReadbackMode: requestedRenderRowsReadbackMode,
        renderFieldSurfaceSummaryMode: requestedRenderFieldSurfaceSummaryMode,
        surfaceDrawDiagnosticMode: requestedSurfaceDrawDiagnosticMode,
        surfaceDrawDiagnosticMaxFieldCells: requestedSurfaceDrawDiagnosticMaxFieldCells,
        surfaceDrawDiagnosticMaxResolution: requestedSurfaceDrawDiagnosticMaxResolution,
        nativeMarchingCubesMaxVertexRowsBufferByteLength:
          requestedNativeMarchingCubesMaxVertexRowsBufferByteLength,
        nativeMarchingCubesMaxResolution: requestedNativeMarchingCubesMaxResolution,
        nativeSurfaceDebugMode: requestedNativeSurfaceDebugMode,
        nativeSurfaceValidationWaitMs: requestedNativeSurfaceValidationWaitMs,
        materialInterfaceDiagnostic: Boolean(requestedMaterialInterfaceDiagnostic),
        materialInterfaceCandidateReadbackMode: requestedMaterialInterfaceCandidateReadbackMode,
        pressureInterfaceDisabled: Boolean(requestedDisablePressureInterface),
        contactBinMetadataReadback: Boolean(requestedContactBinMetadataReadback),
        reactionBinMetadataReadback: Boolean(requestedReactionBinMetadataReadback),
        anomalyRowReadback: Boolean(requestedAnomalyRowReadback),
        residentBufferDebug: Boolean(requestedResidentBufferDebug),
        traceResidentStageWall: Boolean(requestedTraceResidentStageWall),
        collectSchroederHierarchyHostTiming: Boolean(
          requestedCollectSchroederHierarchyHostTiming
        ),
        thermalWallRateOverride: Number.isFinite(requestedThermalWallRate) ? requestedThermalWallRate : null,
        thermalCandidateCsrRouteEvidenceRequested:
          Boolean(requestedCaptureThermalCandidateCsrRouteEvidence),
        renderEveryBatches: requestedRenderEvery,
        preProbeSnapshots: Array.isArray(requestedPreProbeSnapshots) ? requestedPreProbeSnapshots : [],
        pageConsole: requestedPageConsole || [],
        visualFrameCapture: {
          enabled: Boolean(requestedCaptureFrames),
          visualIntervalCaptureRequested: Boolean(requestedVisualIntervalCaptureRequested),
          nativeSurfaceExtractionAtVisualIntervals:
            Boolean(requestedNativeSurfaceExtractionAtVisualIntervals),
          frameEveryBatches: requestedCaptureFrameEvery,
          maxFrames: requestedCaptureFrameMax,
          frameCount: visualFrames.length,
          uiSuppressedForSurfaceEvidence: requestedNativeSurfaceCaptureUiSuppressed
        },
        authoritativeGpuCheckpointCapture: authoritativeGpuCheckpointCaptureSummary(),
        interactiveCacheLifecycle: interactiveCacheLifecycleEvidence,
        visualFrames,
        errors,
        metrics,
        scientificValidation: false,
        sphValidation: false,
        phaseChangeValidation: false,
        fullPhysicsValidation: false
      };
    }, {
      batches,
      batchSteps,
      interactiveCacheLifecycle,
      renderEvery,
      readbackMode,
      compactSummaryMode,
      activeGridDispatchPlanRefreshMode,
      renderReadbackMode,
      renderRowsReadbackMode,
      renderFieldSurfaceSummaryMode,
      surfaceDrawDiagnosticMode,
      surfaceDrawDiagnosticMaxFieldCells,
      surfaceDrawDiagnosticMaxResolution,
      nativeMarchingCubesMaxVertexRowsBufferByteLength,
      nativeMarchingCubesMaxResolution,
      disablePressureInterface,
      contactBinMetadataReadback,
      reactionBinMetadataReadback,
      anomalyRowReadback,
      residentBufferDebug,
      compactSummaryScope,
      thermalWallRate,
      captureThermalCandidateCsrRouteEvidence,
      measureGpuQueueFence,
      measureGpuTimestampInterval,
      measureGpuStageTimestamps,
      measureGpuStageEncoderSpans,
      traceResidentStageWall,
      collectSchroederHierarchyHostTiming,
      materialInterfaceDiagnostic,
      materialInterfaceCandidateReadbackMode,
      nativeSurfaceDebugMode,
      nativeSurfaceValidationWaitMs,
      captureFrames,
      visualIntervalCaptureRequested,
      nativeSurfaceExtractionAtVisualIntervals,
      captureFrameEvery,
      captureFrameMax,
      workerLaneProgressEverySteps,
      useMountedResidentSchedule,
      preProbeSnapshots,
      pageConsole,
      nativeSurfaceCaptureUiSuppressed,
      artifactDetailMode,
      phaseVolumeMaxImpulseFraction,
      generatedGasTargetMaterial,
      generatedGasMinimumMassKg,
      generatedGasMinimumMassFractionOfSystem
    });
    let timeoutProbeTimer = null;
    const timeoutProbe = new Promise((resolve) => {
      timeoutProbeTimer = setTimeout(async () => {
        const timeoutSnapshot = await collectBrowserSnapshot(page, 'probe-timeout', 2000);
        resolve({
          schema: 'peercompute.ulg.sph-history-long-horizon-probe.v0',
          status: 'blocked',
          reason: `browser probe timed out after ${timeoutMs}ms`,
          batchCount: batches,
          batchStepCount: batchSteps,
          requestedSubsteps: batches * batchSteps,
          readbackMode,
          compactSummaryMode,
          renderReadbackMode,
          renderRowsReadbackMode,
	          renderFieldSurfaceSummaryMode,
	          surfaceDrawDiagnosticMode,
	          surfaceDrawDiagnosticMaxFieldCells,
	          surfaceDrawDiagnosticMaxResolution,
	          nativeMarchingCubesMaxVertexRowsBufferByteLength,
	          nativeMarchingCubesMaxResolution,
	          nativeSurfaceDebugMode,
	          nativeSurfaceValidationWaitMs,
	          pressureInterfaceDisabled: Boolean(disablePressureInterface),
          anomalyRowReadback: Boolean(anomalyRowReadback),
          residentBufferDebug: Boolean(residentBufferDebug),
          renderEveryBatches: renderEvery,
          preProbeSnapshots: [...preProbeSnapshots, timeoutSnapshot],
          pageConsole,
          visualFrameCapture: {
            enabled: Boolean(captureFrames),
            frameEveryBatches: captureFrameEvery,
            maxFrames: captureFrameMax,
            frameCount: 0
          },
          authoritativeGpuCheckpointCapture: {
            schema: 'peercompute.ulg.sph-authoritative-gpu-checkpoint-capture.v1',
            status: captureFrames ? 'probe-timeout-before-checkpoint-return' : 'disabled',
            enabled: Boolean(captureFrames),
            trigger: 'visual-validation-checkpoint',
            diagnosticOnly: true,
            physicsReference: false,
            sourceBufferMutation: false,
            normalHotLoopReadbackFree: true,
            checkpointCount: 0,
            capturedCount: 0,
            unavailableCount: 0,
            errorCount: 0
          },
          visualFrames: [],
          errors: [{ batchIndex: null, message: `browser probe timed out after ${timeoutMs}ms` }],
          metrics: [],
          scientificValidation: false,
          sphValidation: false,
          phaseChangeValidation: false,
          fullPhysicsValidation: false
        });
      }, timeoutMs);
    });
    try {
      const timeline = await awaitBrowserProbeOperation(
        Promise.race([
          inPageProbe,
          timeoutProbe
        ]),
        fatalSignal
      );
      const finalizedTimeline = await awaitBrowserProbeFinalization(async () => {
      const shouldCaptureCompositedPage = Boolean(
        captureFrames
        && timeline
        && timeline.fatalTermination == null
        && Array.isArray(timeline.visualFrames)
        && (
          timeline.visualFrames.length < captureFrameMax
          || surfaceDrawDiagnosticMode === 'native-webgpu-surface-consumer'
        )
      );
      if (shouldCaptureCompositedPage) {
        try {
          await page.evaluate(() => new Promise((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(resolve));
          }));
          const canvasCenterFrame = await capturePlaywrightCanvasCenterFrame({
            page,
            batchIndex: timeline.batchCount ?? batches,
            phase: 'post-probe-canvas-center-crop',
            sampleIndex: Array.isArray(timeline.metrics) ? Math.max(0, timeline.metrics.length - 1) : null
          });
          const lastMetricBeforeBrowserFrameValidation = Array.isArray(timeline.metrics)
            ? timeline.metrics[timeline.metrics.length - 1]
            : null;
          const nativeBridgeRenderedBeforeBrowserFrameValidation = Boolean(
            surfaceDrawDiagnosticMode === 'native-webgpu-surface-consumer'
            && (
              nativeWebGpuSurfaceRenderStatusIsRendered(
                lastMetricBeforeBrowserFrameValidation?.surfaceDraw?.renderBridgeLastRenderStatus
              )
              || nativeWebGpuSurfaceRenderStatusIsRendered(
                lastMetricBeforeBrowserFrameValidation?.renderState
                  ?.surfaceDrawRenderBridgeLastRenderStatus
              )
            )
          );
          const browserFrameValidation = browserFrameValidationFromVisualFrame(canvasCenterFrame, {
            source: canvasCenterFrame.captureSource || 'playwright-canvas-center-crop',
            transparentBlackUnsupported: nativeBridgeRenderedBeforeBrowserFrameValidation
          });
          if (browserFrameValidation.png?.status === 'ready') {
            canvasCenterFrame.png = browserFrameValidation.png;
            canvasCenterFrame.blankFrame = !browserFrameValidation.png.hasVisiblePixels;
          }
          timeline.visualFrames.push(canvasCenterFrame);
          if (surfaceDrawDiagnosticMode === 'native-webgpu-surface-consumer') {
            const publishResult = await page.evaluate(async (validation) => {
              const overlay = document.querySelector('#sph-phase-overlay');
              const sceneApi = overlay?.__sphScene || null;
              // Capture this batch's direct surface publication before the
              // browser-frame validation publisher mutates its diagnostic
              // snapshot. The direct record carries the actual retained GPU
              // buffer handoff; the older renderState is only a fallback.
              const renderState = sceneApi?.getSphResidentRenderState?.() || overlay?.__sphResidentRenderState || null;
              const surfaceDraw = sceneApi?.getSphResidentSurfaceDraw?.() || overlay?.__sphResidentSurfaceDraw || null;
              const renderBridge = sceneApi?.getSphResidentSurfaceDrawRenderBridge?.() || null;
              const publishStatus = sceneApi?.publishSphNativeWebGpuSurfaceConsumerBrowserFrameValidation?.({
                status: validation.status,
                reason: validation.reason,
                source: validation.source,
                width: validation.width ?? null,
                height: validation.height ?? null,
                nonzeroPixelCount: validation.nonzeroPixelCount ?? null,
                pixelCount: validation.pixelCount ?? null
              }) || {
                schema: 'peercompute.ulg.sph-native-webgpu-browser-frame-validation.v0',
                status: 'browser-frame-validation-blocked-scene-api-unavailable',
                reason: 'scene API did not expose browser-frame native WebGPU validation'
              };
              const readNativeIndirectArgs = async () => {
                const device = renderBridge?.device || null;
                const drawState = renderBridge?.drawState || null;
                const primaryIndirectBuffer =
                  drawState?.drawIndirectRowsBuffer || surfaceDraw?.drawIndirectRowsBuffer || null;
                const indirectStrideBytes = Math.max(
                  4 * Uint32Array.BYTES_PER_ELEMENT,
                  Math.round(Number(drawState?.indirectStrideBytes) || 0)
                );
                const primarySurfaces = Array.isArray(drawState?.surfaces)
                  ? drawState.surfaces
                  : (Array.isArray(surfaceDraw?.surfaceDrawSurfaces)
                      ? surfaceDraw.surfaceDrawSurfaces
                      : []);
                const primaryDrawOrder = Array.isArray(drawState?.drawOrder) && drawState.drawOrder.length
                  ? drawState.drawOrder
                  : (primaryIndirectBuffer
                      ? (primarySurfaces.length > 0
                          ? primarySurfaces.map((surface, surfaceIndex) => ({
                              surfaceIndex: surface?.surfaceIndex ?? surfaceIndex,
                              indirectOffsetBytes: surface?.indirectOffsetBytes,
                              indirectRowIndex: surface?.indirectRowIndex,
                              renderOrder: surface?.renderOrder ?? 0,
                              transparencyClassId: surface?.transparencyClassId ?? 0,
                              depthWriteFlag: surface?.depthWriteFlag ?? 1,
                              renderLayer: surface?.renderLayer ?? null
                            }))
                          : [{ surfaceIndex: 0, indirectOffsetBytes: 0 }])
                      : []);
                const primaryEntries = primaryIndirectBuffer
                  ? primaryDrawOrder.map((draw, drawIndex) => {
                      const surfaceIndex = Math.max(
                        0,
                        Math.round(Number(draw?.surfaceIndex ?? drawIndex) || 0)
                      );
                      const surface = primarySurfaces.find((candidate, surfaceArrayIndex) => (
                        Math.max(
                          0,
                          Math.round(Number(candidate?.surfaceIndex ?? surfaceArrayIndex) || 0)
                        ) === surfaceIndex
                      )) || primarySurfaces[drawIndex] || {};
                      const explicitIndirectOffsetBytes = Number(
                        draw?.indirectOffsetBytes ?? surface.indirectOffsetBytes
                      );
                      const explicitIndirectRowIndex = Number(
                        draw?.indirectRowIndex ?? surface.indirectRowIndex
                      );
                      const indirectOffsetBytes = Number.isFinite(explicitIndirectOffsetBytes)
                        && explicitIndirectOffsetBytes >= 0
                        ? Math.round(explicitIndirectOffsetBytes)
                        : (Number.isFinite(explicitIndirectRowIndex) && explicitIndirectRowIndex >= 0
                            ? Math.round(explicitIndirectRowIndex) * indirectStrideBytes
                            : surfaceIndex * indirectStrideBytes);
                      return {
                        source: 'primary',
                        surfaceKey: surface.surfaceKey ?? `surface:${surfaceIndex}`,
                        surfaceIndex,
                        renderOrder: Number(draw?.renderOrder ?? surface.renderOrder ?? 0),
                        transparencyClassId: Number(
                          draw?.transparencyClassId ?? surface.transparencyClassId ?? 0
                        ),
                        depthWriteFlag: Number(draw?.depthWriteFlag ?? surface.depthWriteFlag ?? 1),
                        renderLayer: draw?.renderLayer ?? surface.renderLayer ?? null,
                        indirectBuffer: primaryIndirectBuffer,
                        indirectOffsetBytes
                      };
                    })
                  : [];
                const additionalEntries = (Array.isArray(drawState?.additionalSurfaceDraws)
                  ? drawState.additionalSurfaceDraws
                  : [])
                  .filter((draw) => draw?.drawIndirectRowsBuffer)
                  .map((draw, drawIndex) => ({
                    source: 'additional',
                    surfaceKey: draw.surfaceKey ?? `additional-surface:${drawIndex}`,
                    surfaceIndex: Number.isFinite(Number(draw.surfaceIndex))
                      ? Math.max(0, Math.round(Number(draw.surfaceIndex)))
                      : null,
                    renderOrder: Number(draw.renderOrder ?? 0),
                    transparencyClassId: Number(draw.transparencyClassId ?? 0),
                    depthWriteFlag: Number(draw.depthWriteFlag ?? 1),
                    renderLayer: draw.renderLayer ?? null,
                    indirectBuffer: draw.drawIndirectRowsBuffer,
                    indirectOffsetBytes: 0
                  }));
                const entries = [...primaryEntries, ...additionalEntries];
                const rowByteLength = 4 * Uint32Array.BYTES_PER_ELEMENT;
                const byteLength = entries.length * rowByteLength;
                if (
                  !device?.createBuffer
                  || !device?.createCommandEncoder
                  || !device.queue?.submit
                  || entries.length === 0
                ) {
                  return {
                    schema: 'peercompute.ulg.sph-native-webgpu-indirect-args-readback.v0',
                    status: 'not-run',
                    reason: 'native bridge indirect GPUBuffer set or device queue was unavailable',
                    draws: []
                  };
                }
                const invalidEntry = entries.find((entry) => {
                  const offset = Number(entry.indirectOffsetBytes);
                  const bufferSize = Number(entry.indirectBuffer?.size);
                  return !Number.isInteger(offset)
                    || offset < 0
                    || offset % 4 !== 0
                    || (Number.isFinite(bufferSize) && offset + rowByteLength > bufferSize);
                });
                if (invalidEntry) {
                  return {
                    schema: 'peercompute.ulg.sph-native-webgpu-indirect-args-readback.v0',
                    status: 'error',
                    reason: `invalid indirect row bounds for ${invalidEntry.surfaceKey}`,
                    draws: []
                  };
                }
                const usage = globalThis.GPUBufferUsage || {};
                const mapMode = globalThis.GPUMapMode || {};
                let readback = null;
                let mapped = false;
                try {
                  readback = device.createBuffer({
                    label: 'ulg-sph-probe-native-surface-indirect-args-batch-readback',
                    size: byteLength,
                    usage: (usage.MAP_READ ?? 1) | (usage.COPY_DST ?? 8)
                  });
                  const encoder = device.createCommandEncoder({
                    label: 'ulg-sph-probe-native-surface-indirect-args-batch-readback'
                  });
                  entries.forEach((entry, entryIndex) => {
                    encoder.copyBufferToBuffer(
                      entry.indirectBuffer,
                      entry.indirectOffsetBytes,
                      readback,
                      entryIndex * rowByteLength,
                      rowByteLength
                    );
                  });
                  device.queue.submit([encoder.finish()]);
                  await Promise.resolve(device.queue.onSubmittedWorkDone?.() ?? undefined);
                  await readback.mapAsync(mapMode.READ ?? 1, 0, byteLength);
                  mapped = true;
                  const packedArgs = new Uint32Array(readback.getMappedRange(0, byteLength));
                  const draws = entries.map((entry, entryIndex) => {
                    const args = Array.from(
                      packedArgs.slice(entryIndex * 4, entryIndex * 4 + 4)
                    );
                    const vertexCount = args[0] || 0;
                    const instanceCount = args[1] || 0;
                    const pipelineKey = entry.renderLayer === 'refractive-surface'
                      || entry.transparencyClassId === 2
                      ? 'refractive-depth-write'
                      : 'opaque-depth-write';
                    return {
                      source: entry.source,
                      surfaceKey: entry.surfaceKey,
                      surfaceIndex: entry.surfaceIndex,
                      pipelineKey,
                      renderOrder: entry.renderOrder,
                      transparencyClassId: entry.transparencyClassId,
                      depthWriteFlag: entry.depthWriteFlag,
                      indirectOffsetBytes: entry.indirectOffsetBytes,
                      args,
                      vertexCount,
                      triangleCount: Math.floor(vertexCount / 3),
                      instanceCount,
                      firstVertex: args[2] || 0,
                      firstInstance: args[3] || 0,
                      drawable: vertexCount > 0 && instanceCount > 0
                    };
                  });
                  readback.unmap();
                  mapped = false;
                  readback.destroy?.();
                  readback = null;
                  return {
                    schema: 'peercompute.ulg.sph-native-webgpu-indirect-args-readback.v0',
                    status: 'ready',
                    reason: null,
                    readbackByteLength: byteLength,
                    queueSubmitCount: 1,
                    mapAsyncCount: 1,
                    draws
                  };
                } catch (error) {
                  if (mapped) readback?.unmap?.();
                  readback?.destroy?.();
                  return {
                    schema: 'peercompute.ulg.sph-native-webgpu-indirect-args-readback.v0',
                    status: 'error',
                    reason: error instanceof Error ? error.message : String(error),
                    draws: []
                  };
                }
              };
              const nativeIndirectArgsValidation =
                validation.nativeIndirectArgsReadbackRequested === true
                  ? await readNativeIndirectArgs()
                  : {
                      schema:
                        'peercompute.ulg.sph-native-webgpu-indirect-args-readback.v0',
                      status: 'not-requested',
                      reason:
                        'native indirect-argument readback is disabled outside explicit visual diagnostics',
                      readbackByteLength: 0,
                      queueSubmitCount: 0,
                      mapAsyncCount: 0,
                      draws: []
                    };
              const postValidationRenderState =
                sceneApi?.getSphResidentRenderState?.() || renderState;
              const postValidationSurfaceDraw =
                sceneApi?.getSphResidentSurfaceDraw?.() || surfaceDraw;
              if (overlay && sceneApi) {
                overlay.__sphResidentRenderState = postValidationRenderState;
                overlay.__sphResidentSurfaceDraw = postValidationSurfaceDraw;
              }
              const nativePresentationProofPatch = (state) => ({
                surfaceDrawVisibleGpuConsumerRuntimePresentationAdmitted:
                  state?.surfaceDrawVisibleGpuConsumerRuntimePresentationAdmitted
                    ?? null,
                surfaceDrawVisibleGpuConsumerForegroundProofValidated:
                  state?.surfaceDrawVisibleGpuConsumerForegroundProofValidated
                    ?? null,
                surfaceDrawVisibleGpuConsumerSameQueueStructuralSubmissionAdmitted:
                  state
                    ?.surfaceDrawVisibleGpuConsumerSameQueueStructuralSubmissionAdmitted
                    ?? null,
                surfaceDrawVisibleGpuConsumerSameQueueForegroundSubmissionValidated:
                  state
                    ?.surfaceDrawVisibleGpuConsumerSameQueueForegroundSubmissionValidated
                    ?? null,
                surfaceDrawVisibleGpuConsumerBrowserFrameForegroundValidated:
                  state?.surfaceDrawVisibleGpuConsumerBrowserFrameForegroundValidated
                    ?? null,
                surfaceDrawVisibleGpuConsumerOffscreenForegroundValidated:
                  state?.surfaceDrawVisibleGpuConsumerOffscreenForegroundValidated
                    ?? null,
                surfaceDrawVisibleGpuConsumerNativeOffscreenValidationStatus:
                  state?.surfaceDrawVisibleGpuConsumerNativeOffscreenValidationStatus
                    ?? null,
                surfaceDrawVisibleGpuConsumerNativeOffscreenValidationNonzeroPixelCount:
                  state
                    ?.surfaceDrawVisibleGpuConsumerNativeOffscreenValidationNonzeroPixelCount
                    ?? null,
                surfaceDrawVisibleGpuConsumerNativeCandidateForegroundValidationStatus:
                  state
                    ?.surfaceDrawVisibleGpuConsumerNativeCandidateForegroundValidationStatus
                    ?? null,
                surfaceDrawVisibleGpuConsumerNativeCandidateForegroundProofKind:
                  state
                    ?.surfaceDrawVisibleGpuConsumerNativeCandidateForegroundProofKind
                    ?? null,
                surfaceDrawVisibleGpuConsumerNativeCandidateForegroundSameQueueSubmissionBoundary:
                  state
                    ?.surfaceDrawVisibleGpuConsumerNativeCandidateForegroundSameQueueSubmissionBoundary
                    ?? null,
                surfaceDrawVisibleGpuConsumerNativeCandidateForegroundSubmittedDrawCount:
                  state
                    ?.surfaceDrawVisibleGpuConsumerNativeCandidateForegroundSubmittedDrawCount
                    ?? null,
                surfaceDrawVisibleGpuConsumerNativeCandidateForegroundResourceGeneration:
                  state
                    ?.surfaceDrawVisibleGpuConsumerNativeCandidateForegroundResourceGeneration
                    ?? null,
                surfaceDrawVisibleGpuConsumerNativeActiveResourceGeneration:
                  state?.surfaceDrawVisibleGpuConsumerNativeActiveResourceGeneration
                    ?? null,
                surfaceDrawVisibleGpuConsumerNativeOffscreenValidationResourceGeneration:
                  state
                    ?.surfaceDrawVisibleGpuConsumerNativeOffscreenValidationResourceGeneration
                    ?? null,
                surfaceDrawVisibleGpuConsumerNativePixelValidationSource:
                  state?.surfaceDrawVisibleGpuConsumerNativePixelValidationSource
                    ?? null,
                surfaceDrawVisibleGpuConsumerNativePixelValidationNonzeroPixelCount:
                  state
                    ?.surfaceDrawVisibleGpuConsumerNativePixelValidationNonzeroPixelCount
                    ?? null,
                surfaceDrawVisibleGpuConsumerNativePixelValidationResourceGeneration:
                  state
                    ?.surfaceDrawVisibleGpuConsumerNativePixelValidationResourceGeneration
                    ?? null
              });
              const renderStatePatch = postValidationRenderState ? {
                ...nativePresentationProofPatch(postValidationRenderState),
                surfaceDrawVisibleGpuConsumerReady: Boolean(postValidationRenderState.surfaceDrawVisibleGpuConsumerReady),
                surfaceDrawVisibleGpuConsumerStatus: postValidationRenderState.surfaceDrawVisibleGpuConsumerStatus ?? null,
                surfaceDrawVisibleGpuConsumerReason: postValidationRenderState.surfaceDrawVisibleGpuConsumerReason ?? null,
                surfaceDrawVisibleGpuConsumerPixelValidationStatus:
                  postValidationRenderState.surfaceDrawVisibleGpuConsumerPixelValidationStatus ?? null,
                surfaceDrawVisibleGpuConsumerValidated:
                  Boolean(postValidationRenderState.surfaceDrawVisibleGpuConsumerValidated),
                surfaceDrawVisibleGpuConsumerNativeReadbackFallbackValidated:
                  Boolean(postValidationRenderState.surfaceDrawVisibleGpuConsumerNativeReadbackFallbackValidated),
                surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportSelected:
                  postValidationRenderState.surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportSelected ?? null,
                surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportRoute:
                  postValidationRenderState.surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportRoute ?? null,
                surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportThread:
                  postValidationRenderState.surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportThread ?? null,
                surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportDeviceScope:
                  postValidationRenderState.surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportDeviceScope ?? null,
                surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportStatus:
                  postValidationRenderState.surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportStatus ?? null,
                surfaceDrawVisibleGpuConsumerNativeValidationBlockerFamily:
                  postValidationRenderState.surfaceDrawVisibleGpuConsumerNativeValidationBlockerFamily ?? null,
                surfaceDrawRenderBridgePixelValidationStatus:
                  postValidationRenderState.surfaceDrawRenderBridgePixelValidationStatus ?? null,
                surfaceDrawRenderBridgePixelValidationReason:
                  postValidationRenderState.surfaceDrawRenderBridgePixelValidationReason ?? null,
                surfaceDrawRenderBridgePixelValidationSource:
                  postValidationRenderState.surfaceDrawRenderBridgePixelValidationSource ?? null,
                surfaceDrawRenderBridgePixelValidationWidth:
                  postValidationRenderState.surfaceDrawRenderBridgePixelValidationWidth ?? null,
                surfaceDrawRenderBridgePixelValidationHeight:
                  postValidationRenderState.surfaceDrawRenderBridgePixelValidationHeight ?? null,
                surfaceDrawRenderBridgePixelValidationNonzeroPixelCount:
                  postValidationRenderState.surfaceDrawRenderBridgePixelValidationNonzeroPixelCount ?? null,
                surfaceDrawRenderBridgePixelValidationPixelCount:
                  postValidationRenderState.surfaceDrawRenderBridgePixelValidationPixelCount ?? null
              } : null;
              const surfaceDrawPatch = postValidationSurfaceDraw ? {
                ...nativePresentationProofPatch(postValidationSurfaceDraw),
                surfaceDrawVisibleGpuConsumerReady: Boolean(postValidationSurfaceDraw.surfaceDrawVisibleGpuConsumerReady),
                surfaceDrawVisibleGpuConsumerStatus: postValidationSurfaceDraw.surfaceDrawVisibleGpuConsumerStatus ?? null,
                surfaceDrawVisibleGpuConsumerReason: postValidationSurfaceDraw.surfaceDrawVisibleGpuConsumerReason ?? null,
                surfaceDrawVisibleGpuConsumerPixelValidationStatus:
                  postValidationSurfaceDraw.surfaceDrawVisibleGpuConsumerPixelValidationStatus ?? null,
                surfaceDrawVisibleGpuConsumerValidated:
                  Boolean(postValidationSurfaceDraw.surfaceDrawVisibleGpuConsumerValidated),
                surfaceDrawVisibleGpuConsumerNativeReadbackFallbackValidated:
                  Boolean(postValidationSurfaceDraw.surfaceDrawVisibleGpuConsumerNativeReadbackFallbackValidated),
                surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportSelected:
                  postValidationSurfaceDraw.surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportSelected ?? null,
                surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportRoute:
                  postValidationSurfaceDraw.surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportRoute ?? null,
                surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportThread:
                  postValidationSurfaceDraw.surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportThread ?? null,
                surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportDeviceScope:
                  postValidationSurfaceDraw.surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportDeviceScope ?? null,
                surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportStatus:
                  postValidationSurfaceDraw.surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportStatus ?? null,
                surfaceDrawVisibleGpuConsumerNativeValidationBlockerFamily:
                  postValidationSurfaceDraw.surfaceDrawVisibleGpuConsumerNativeValidationBlockerFamily ?? null,
                renderBridgePixelValidationStatus:
                  postValidationSurfaceDraw.renderBridgePixelValidationStatus ?? null,
                renderBridgePixelValidationReason:
                  postValidationSurfaceDraw.renderBridgePixelValidationReason ?? null,
                renderBridgePixelValidationSource:
                  postValidationSurfaceDraw.renderBridgePixelValidationSource ?? null,
                renderBridgePixelValidationWidth:
                  postValidationSurfaceDraw.renderBridgePixelValidationWidth ?? null,
                renderBridgePixelValidationHeight:
                  postValidationSurfaceDraw.renderBridgePixelValidationHeight ?? null,
                renderBridgePixelValidationNonzeroPixelCount:
                  postValidationSurfaceDraw.renderBridgePixelValidationNonzeroPixelCount ?? null,
                renderBridgePixelValidationPixelCount:
                  postValidationSurfaceDraw.renderBridgePixelValidationPixelCount ?? null
              } : null;
              const nativeSurfaceVisibleConsumerReady = Boolean(
                postValidationSurfaceDraw?.visibleGpuConsumerReady
                ?? postValidationSurfaceDraw?.surfaceDrawVisibleGpuConsumerReady
                ?? postValidationRenderState?.surfaceDrawVisibleGpuConsumerReady
              );
              const nativeSurfaceGpuBufferHandoffReady = Boolean(
                postValidationSurfaceDraw?.gpuBufferHandoffReady
                ?? postValidationRenderState?.surfaceDrawGpuBufferHandoffReady
              );
              const nativeSurfaceRuntimePresentationAdmitted = (
                postValidationSurfaceDraw
                  ?.surfaceDrawVisibleGpuConsumerRuntimePresentationAdmitted
                ?? postValidationRenderState
                  ?.surfaceDrawVisibleGpuConsumerRuntimePresentationAdmitted
              ) === true;
              const nativeSurfaceForegroundProofValidated = (
                postValidationSurfaceDraw
                  ?.surfaceDrawVisibleGpuConsumerForegroundProofValidated
                ?? postValidationRenderState
                  ?.surfaceDrawVisibleGpuConsumerForegroundProofValidated
              ) === true;
              const nativeSurfaceReady = Boolean(
                nativeSurfaceVisibleConsumerReady
                && nativeSurfaceGpuBufferHandoffReady
                && nativeSurfaceRuntimePresentationAdmitted
              );
              const nativeSurfaceForegroundProved = Boolean(
                nativeSurfaceReady
                && nativeSurfaceForegroundProofValidated
              );
              return {
                publishStatus,
                renderStatePatch,
                surfaceDrawPatch,
                nativeIndirectArgsValidation,
                nativeSurfaceValidation: {
                  native: true,
                  ready: nativeSurfaceReady,
                  admitted: nativeSurfaceReady,
                  foregroundProved: nativeSurfaceForegroundProved,
                  runtimePresentationAdmitted:
                    nativeSurfaceRuntimePresentationAdmitted,
                  foregroundProofValidated:
                    nativeSurfaceForegroundProofValidated,
                  pending: false,
                  status: nativeSurfaceReady
                    ? 'native-surface-presentation-admitted'
                    : 'native-surface-presentation-not-admitted',
                  foregroundStatus: nativeSurfaceForegroundProved
                    ? 'native-surface-foreground-proved'
                    : 'native-surface-foreground-not-proved',
                  bridgeMode:
                    postValidationSurfaceDraw?.visibleRendererBridge
                    ?? postValidationRenderState?.surfaceDrawVisibleRendererBridge
                    ?? null,
                  gpuBufferHandoffReady: nativeSurfaceGpuBufferHandoffReady,
                  gpuBufferHandoffStatus:
                    postValidationSurfaceDraw?.gpuBufferHandoffStatus
                    ?? postValidationRenderState?.surfaceDrawGpuBufferHandoffStatus
                    ?? null,
                  gpuBufferHandoffReason:
                    postValidationSurfaceDraw?.gpuBufferHandoffReason
                    ?? postValidationRenderState?.surfaceDrawGpuBufferHandoffReason
                    ?? null,
                  pixelValidationStatus:
                    postValidationSurfaceDraw?.visibleGpuConsumerPixelValidationStatus
                    ?? postValidationSurfaceDraw?.surfaceDrawVisibleGpuConsumerPixelValidationStatus
                    ?? postValidationRenderState?.surfaceDrawVisibleGpuConsumerPixelValidationStatus
                    ?? null,
                  pixelValidationReason:
                    postValidationSurfaceDraw?.renderBridgePixelValidationReason
                    ?? postValidationRenderState?.surfaceDrawRenderBridgePixelValidationReason
                    ?? null,
                  validationBlockerFamily:
                    postValidationSurfaceDraw?.visibleGpuConsumerNativeValidationBlockerFamily
                    ?? postValidationSurfaceDraw?.surfaceDrawVisibleGpuConsumerNativeValidationBlockerFamily
                    ?? postValidationRenderState?.surfaceDrawVisibleGpuConsumerNativeValidationBlockerFamily
                    ?? null
                }
              };
            }, {
              status: browserFrameValidation.status,
              reason: browserFrameValidation.reason,
              source: browserFrameValidation.source,
              width: browserFrameValidation.width ?? null,
              height: browserFrameValidation.height ?? null,
              nonzeroPixelCount: browserFrameValidation.nonzeroPixelCount ?? null,
              pixelCount: browserFrameValidation.pixelCount ?? null,
              nativeIndirectArgsReadbackRequested: Boolean(
                visualIntervalCaptureRequested || captureProductSurfacesOnly
              )
            }).catch((error) => ({
              publishStatus: {
                schema: 'peercompute.ulg.sph-native-webgpu-browser-frame-validation.v0',
                status: 'browser-frame-validation-publish-error',
                reason: error instanceof Error ? error.message : String(error)
              },
              renderStatePatch: null,
              surfaceDrawPatch: null,
              nativeIndirectArgsValidation: null,
              nativeSurfaceValidation: null
            }));
            publishResult.nativeIndirectArgsValidation =
              summarizeNativeSurfaceIndirectArgsReadback(
                publishResult.nativeIndirectArgsValidation,
                {
                  expectedProductMaterials: captureProductSurfacesOnly
                    ? ['naoh', 'h2']
                    : []
                }
              );
            timeline.nativeSurfaceDrawIndirectArgsValidation =
              publishResult.nativeIndirectArgsValidation || null;
            timeline.nativeSurfaceBrowserFrameValidation = {
              ...browserFrameValidation,
              png: browserFrameValidation.png ? {
                status: browserFrameValidation.png.status,
                width: browserFrameValidation.png.width,
                height: browserFrameValidation.png.height,
                pixelCount: browserFrameValidation.png.pixelCount,
                nonzeroRgbPixelCount: browserFrameValidation.png.nonzeroRgbPixelCount,
                nonzeroAlphaPixelCount: browserFrameValidation.png.nonzeroAlphaPixelCount,
                hasVisiblePixels: browserFrameValidation.png.hasVisiblePixels,
                rgbChannelSpan: browserFrameValidation.png.rgbChannelSpan,
                distinctRgbColorCount: browserFrameValidation.png.distinctRgbColorCount,
                hasSurfaceLikeVariation: browserFrameValidation.png.hasSurfaceLikeVariation
              } : null,
              publishStatus: publishResult.publishStatus || null
            };
            const lastMetric = Array.isArray(timeline.metrics) && timeline.metrics.length > 0
              ? timeline.metrics[timeline.metrics.length - 1]
              : null;
            if (lastMetric && publishResult.renderStatePatch) {
              lastMetric.renderState = {
                ...(lastMetric.renderState || {}),
                ...publishResult.renderStatePatch
              };
            }
            if (lastMetric && publishResult.surfaceDrawPatch) {
              lastMetric.surfaceDraw = {
                ...(lastMetric.surfaceDraw || {}),
                ...publishResult.surfaceDrawPatch
              };
            }
            if (lastMetric && publishResult.nativeSurfaceValidation) {
              // Browser-frame validation happens after the final batch has
              // been sampled. Bind the post-validation proof fields to that
              // last sampled direct surface record so pixel proof and runtime
              // admission describe the same current resident publication.
              const sampledSurfaceDraw = lastMetric.surfaceDraw || null;
              const sampledRenderState = lastMetric.renderState || null;
              const sampledNativeVisibleConsumerReady = Boolean(
                sampledSurfaceDraw?.visibleGpuConsumerReady
                ?? sampledSurfaceDraw?.surfaceDrawVisibleGpuConsumerReady
                ?? sampledRenderState?.surfaceDrawVisibleGpuConsumerReady
              );
              const sampledNativeGpuBufferHandoffReady = Boolean(
                sampledSurfaceDraw?.gpuBufferHandoffReady
                ?? sampledRenderState?.surfaceDrawGpuBufferHandoffReady
              );
              const sampledNativeRuntimePresentationAdmitted = (
                sampledSurfaceDraw
                  ?.surfaceDrawVisibleGpuConsumerRuntimePresentationAdmitted
                ?? sampledRenderState
                  ?.surfaceDrawVisibleGpuConsumerRuntimePresentationAdmitted
              ) === true;
              const sampledNativeForegroundProofValidated = (
                sampledSurfaceDraw
                  ?.surfaceDrawVisibleGpuConsumerForegroundProofValidated
                ?? sampledRenderState
                  ?.surfaceDrawVisibleGpuConsumerForegroundProofValidated
              ) === true;
              const sampledNativeReady = Boolean(
                sampledNativeVisibleConsumerReady
                && sampledNativeGpuBufferHandoffReady
                && sampledNativeRuntimePresentationAdmitted
              );
              const sampledNativeForegroundProved = Boolean(
                sampledNativeReady
                && sampledNativeForegroundProofValidated
              );
              lastMetric.nativeSurfaceValidation = {
                ...(lastMetric.nativeSurfaceValidation || {}),
                ...publishResult.nativeSurfaceValidation,
                ready: sampledNativeReady,
                admitted: sampledNativeReady,
                foregroundProved: sampledNativeForegroundProved,
                runtimePresentationAdmitted:
                  sampledNativeRuntimePresentationAdmitted,
                foregroundProofValidated:
                  sampledNativeForegroundProofValidated,
                status: sampledNativeReady
                  ? 'native-surface-presentation-admitted'
                  : 'native-surface-presentation-not-admitted',
                foregroundStatus: sampledNativeForegroundProved
                  ? 'native-surface-foreground-proved'
                  : 'native-surface-foreground-not-proved',
                bridgeMode:
                  sampledSurfaceDraw?.visibleRendererBridge
                  ?? sampledRenderState?.surfaceDrawVisibleRendererBridge
                  ?? publishResult.nativeSurfaceValidation.bridgeMode
                  ?? null,
                gpuBufferHandoffReady: sampledNativeGpuBufferHandoffReady,
                gpuBufferHandoffStatus:
                  sampledSurfaceDraw?.gpuBufferHandoffStatus
                  ?? sampledRenderState?.surfaceDrawGpuBufferHandoffStatus
                  ?? publishResult.nativeSurfaceValidation.gpuBufferHandoffStatus
                  ?? null,
                gpuBufferHandoffReason:
                  sampledSurfaceDraw?.gpuBufferHandoffReason
                  ?? sampledRenderState?.surfaceDrawGpuBufferHandoffReason
                  ?? publishResult.nativeSurfaceValidation.gpuBufferHandoffReason
                  ?? null,
                nativeIndirectArgsValidationStatus:
                  publishResult.nativeIndirectArgsValidation?.status ?? null,
                nativeIndirectArgsValidationReason:
                  publishResult.nativeIndirectArgsValidation?.reason ?? null,
                nativeIndirectArgs:
                  publishResult.nativeIndirectArgsValidation?.args ?? null
              };
            }
            if (timeline.visualFrameCapture) {
              timeline.visualFrameCapture.browserFramePixelValidationStatus =
                browserFrameValidation.status;
              timeline.visualFrameCapture.browserFramePixelValidationSource =
                browserFrameValidation.source;
              timeline.visualFrameCapture.browserFramePixelValidationPublishedStatus =
                publishResult.publishStatus?.status ?? null;
            }
            if (captureH2VisibilityAblation) {
              const diagnosticFrameArgs = {
                page,
                batchIndex: timeline.batchCount ?? batches,
                sampleIndex: Array.isArray(timeline.metrics)
                  ? Math.max(0, timeline.metrics.length - 1)
                  : null
              };
              const h2AblatedCapture = await captureNativeH2DiagnosticFrame({
                ...diagnosticFrameArgs,
                isolatedH2Only: false
              });
              if (h2AblatedCapture.frame) {
                timeline.visualFrames.push(h2AblatedCapture.frame);
              }
              const h2OnlyCapture = await captureNativeH2DiagnosticFrame({
                ...diagnosticFrameArgs,
                isolatedH2Only: true
              });
              if (h2OnlyCapture.frame) {
                timeline.visualFrames.push(h2OnlyCapture.frame);
              }
              await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
              const restoredCanonicalFrame = await capturePlaywrightCanvasCenterFrame({
                ...diagnosticFrameArgs,
                phase: 'post-probe-native-h2-visibility-restored-canonical'
              });
              if (restoredCanonicalFrame.validationPng?.status === 'ready') {
                restoredCanonicalFrame.png = restoredCanonicalFrame.validationPng;
                restoredCanonicalFrame.blankFrame =
                  !restoredCanonicalFrame.validationPng.hasVisiblePixels;
              }
              restoredCanonicalFrame.diagnosticOnly = true;
              restoredCanonicalFrame.captureMode = 'restored-canonical-native-pbr';
              timeline.visualFrames.push(restoredCanonicalFrame);

              const canonicalAblatedDelta = compareCapturedPngFrames(
                canvasCenterFrame,
                h2AblatedCapture.frame,
                { minChannelDelta: 8 }
              );
              const canonicalRestoredNoise = compareCapturedPngFrames(
                canvasCenterFrame,
                restoredCanonicalFrame,
                { minChannelDelta: 3 }
              );
              const ablationProtocolProved = Boolean(
                h2AblatedCapture.setup?.status === 'native-h2-ablation-filter-rendered'
                && h2AblatedCapture.continuity?.status
                  === 'h2-ablation-filter-continuity-proved'
                && h2AblatedCapture.restore?.status === 'restored'
                && h2AblatedCapture.captureError == null
                && h2AblatedCapture.frame?.status === 'captured'
              );
              const h2OnlyProtocolProved = Boolean(
                h2OnlyCapture.setup?.status === 'native-h2-only-filter-rendered'
                && h2OnlyCapture.continuity?.status === 'h2-only-filter-continuity-proved'
                && h2OnlyCapture.restore?.status === 'restored'
                && h2OnlyCapture.captureError == null
                && h2OnlyCapture.frame?.status === 'captured'
              );
              const nativeCanvasIdentityProved = Boolean(
                canvasCenterFrame?.canvasSelection?.sameAsRenderBridgeCanvas === true
                && canvasCenterFrame?.canvasSelection?.sameAsNativeConsumerCanvas === true
                && h2AblatedCapture.frame?.canvasIndex === canvasCenterFrame?.canvasIndex
                && h2OnlyCapture.frame?.canvasIndex === canvasCenterFrame?.canvasIndex
                && restoredCanonicalFrame?.canvasIndex === canvasCenterFrame?.canvasIndex
                && h2AblatedCapture.frame?.canvasSelection?.sameAsRenderBridgeCanvas === true
                && h2OnlyCapture.frame?.canvasSelection?.sameAsRenderBridgeCanvas === true
                && restoredCanonicalFrame?.canvasSelection?.sameAsRenderBridgeCanvas === true
              );
              const originalH2DrawStateProved = Boolean(
                Array.isArray(h2OnlyCapture.setup?.h2DrawSummaries)
                && h2OnlyCapture.setup.h2DrawSummaries.length > 0
                && h2OnlyCapture.setup.h2DrawSummaries.every((draw) => (
                  Number(draw?.depthWriteFlag) === 1
                  && draw?.bindGroupPresent === true
                  && draw?.indirectBufferPresent === true
                ))
              );
              const h2OnlyPixelsProved = Boolean(
                h2OnlyCapture.frame?.png?.status === 'ready'
                && h2OnlyCapture.frame.png.hasVisiblePixels === true
                && h2OnlyCapture.frame.png.hasSurfaceLikeVariation === true
              );
              const restoredCanonicalProved = Boolean(
                canonicalRestoredNoise.status === 'ready'
                && canonicalRestoredNoise.changedPixelCount === 0
              );
              const minimumChangedPixelCount = Math.max(
                4,
                5 * Number(canonicalRestoredNoise.changedPixelCount || 0)
              );
              const compositedH2PixelsProved = Boolean(
                canonicalAblatedDelta.status === 'ready'
                && canonicalAblatedDelta.changedPixelCount >= minimumChangedPixelCount
                && canonicalAblatedDelta.changedBounds != null
              );
              const evidenceProved = Boolean(
                ablationProtocolProved
                && h2OnlyProtocolProved
                && nativeCanvasIdentityProved
                && originalH2DrawStateProved
                && h2OnlyPixelsProved
                && restoredCanonicalProved
                && compositedH2PixelsProved
              );
              timeline.nativeH2CompositedVisibilityCapture = {
                schema: 'peercompute.ulg.sph-native-h2-composited-visibility-capture.v0',
                status: evidenceProved
                  ? 'native-h2-composited-visibility-proved'
                  : 'native-h2-composited-visibility-unproved',
                reason: evidenceProved
                  ? null
                  : [
                      `ablationProtocol=${ablationProtocolProved}`,
                      `h2OnlyProtocol=${h2OnlyProtocolProved}`,
                      `nativeCanvasIdentity=${nativeCanvasIdentityProved}`,
                      `originalH2DrawState=${originalH2DrawStateProved}`,
                      `h2OnlyPixels=${h2OnlyPixelsProved}`,
                      `restoredCanonical=${restoredCanonicalProved}`,
                      `compositedH2Pixels=${compositedH2PixelsProved}`
                    ].join('; '),
                diagnosticOnly: true,
                physicsStateMutation: false,
                materialOverrideApplied: false,
                emissiveOverrideApplied: false,
                depthWriteOverrideApplied: false,
                minimumChangedPixelCount,
                canonicalAblatedDelta,
                canonicalRestoredNoise,
                ablationProtocolProved,
                h2OnlyProtocolProved,
                nativeCanvasIdentityProved,
                originalH2DrawStateProved,
                h2OnlyPixelsProved,
                restoredCanonicalProved,
                compositedH2PixelsProved,
                h2DrawSummaries: h2OnlyCapture.setup?.h2DrawSummaries || [],
                h2SurfaceKeys: h2OnlyCapture.setup?.h2SurfaceKeys || [],
                ablatedRetainedSurfaceKeys:
                  h2AblatedCapture.setup?.retainedSurfaceKeys || [],
                ablationSetupStatus: h2AblatedCapture.setup?.status ?? null,
                ablationContinuityStatus: h2AblatedCapture.continuity?.status ?? null,
                ablationRestoreStatus: h2AblatedCapture.restore?.status ?? null,
                ablationCaptureError: h2AblatedCapture.captureError,
                h2OnlySetupStatus: h2OnlyCapture.setup?.status ?? null,
                h2OnlyContinuityStatus: h2OnlyCapture.continuity?.status ?? null,
                h2OnlyRestoreStatus: h2OnlyCapture.restore?.status ?? null,
                h2OnlyCaptureError: h2OnlyCapture.captureError
              };
            }
            if (captureProductSurfacesOnly) {
              const productCaptureToken = [
                'sph-probe-native-product-draw-filter',
                Date.now(),
                Math.random().toString(16).slice(2)
              ].join(':');
              const productOnlySetup = await page.evaluate((expectedToken) => {
                const overlay = document.querySelector('#sph-phase-overlay');
                const sceneApi = overlay?.__sphScene || null;
                const bridge = sceneApi?.getSphResidentSurfaceDrawRenderBridge?.() || null;
                const drawState = bridge?.drawState || null;
                const additionalDraws = Array.isArray(drawState?.additionalSurfaceDraws)
                  ? drawState.additionalSurfaceDraws
                  : [];
                const productDraws = additionalDraws.filter((draw) => {
                  const parts = String(draw?.surfaceKey || '').split('|');
                  const material = String(parts[1] || parts[0] || '').trim().toLowerCase();
                  return material === 'naoh' || material === 'h2';
                });
                if (!sceneApi?.refreshViewportAndOverlay || !drawState || productDraws.length === 0) {
                  return {
                    schema: 'peercompute.ulg.sph-native-product-surface-capture.v1',
                    status: 'not-ready',
                    reason: !drawState
                      ? 'native bridge draw state was unavailable'
                      : 'no retained NaOH or H2 secondary draws were available',
                    surfaceKeys: []
                  };
                }
                if (
                  overlay.__ulgProbeNativeProductDrawFilterSession
                  || bridge.__ulgProbeNativeSurfaceDrawFilter
                ) {
                  return {
                    schema: 'peercompute.ulg.sph-native-product-surface-capture.v1',
                    status: 'native-product-draw-filter-busy',
                    reason: 'another native diagnostic draw filter owns the active bridge',
                    token: expectedToken,
                    surfaceKeys: []
                  };
                }
                const filter = {
                  enabled: true,
                  token: expectedToken,
                  filterAdditionalSurfaceDraws: true,
                  additionalSurfaceKeys: productDraws.map((draw) => String(draw.surfaceKey || '')),
                  suppressPrimarySurfaceDraws: true,
                  suppressBackgroundImage: true,
                  suppressBoxWireframe: true,
                  suppressSchroederProxyDraws: true
                };
                bridge.__ulgProbeNativeSurfaceDrawFilter = filter;
                const session = { bridge, filter, token: expectedToken };
                overlay.__ulgProbeNativeProductDrawFilterSession = session;
                const refresh = sceneApi.refreshViewportAndOverlay({
                  reason: 'sph-probe-native-product-draw-filter'
                });
                const filterApplied = Boolean(
                  sceneApi.getSphResidentSurfaceDrawRenderBridge?.() === bridge
                  && bridge.__ulgProbeNativeSurfaceDrawFilter === filter
                  && bridge.lastNativeSurfaceDiagnosticDrawFilterActive === true
                  && bridge.lastNativeSurfaceDiagnosticDrawFilterToken === expectedToken
                  && bridge.lastNativeSurfaceDiagnosticSelectedPrimaryDrawCount === 0
                  && bridge.lastNativeSurfaceDiagnosticSelectedAdditionalDrawCount
                    === productDraws.length
                  && JSON.stringify(
                    [...(bridge.lastNativeSurfaceDiagnosticSelectedAdditionalSurfaceKeys || [])]
                      .sort()
                  ) === JSON.stringify(
                    productDraws.map((draw) => draw.surfaceKey ?? null).sort()
                  )
                  && bridge.lastNativeSurfaceDiagnosticBackgroundSuppressed === true
                  && bridge.lastNativeSurfaceDiagnosticBoxWireframeSuppressed === true
                  && bridge.lastNativeSurfaceDiagnosticSchroederProxySuppressed === true
                );
                const overlayRendered = Boolean(
                  refresh?.surfaceOverlayRendered === true
                  && refresh?.surfaceOverlayLastRenderStatus
                    === 'native-webgpu-surface-consumer-rendered'
                );
                return {
                  schema: 'peercompute.ulg.sph-native-product-surface-capture.v1',
                  status: overlayRendered && filterApplied
                    ? 'native-product-draw-filter-rendered'
                    : 'native-product-draw-filter-render-failed',
                  reason: overlayRendered && filterApplied
                    ? null
                    : `overlayRendered=${overlayRendered}; filterApplied=${filterApplied}`,
                  token: expectedToken,
                  surfaceKeys: productDraws.map((draw) => draw.surfaceKey ?? null),
                  refreshStatus: refresh?.status ?? null,
                  refreshSurfaceOverlayRendered: refresh?.surfaceOverlayRendered ?? null,
                  refreshSurfaceOverlayLastRenderStatus:
                    refresh?.surfaceOverlayLastRenderStatus ?? null,
                  filterApplied,
                  selectedPrimaryDrawCount:
                    bridge.lastNativeSurfaceDiagnosticSelectedPrimaryDrawCount ?? null,
                  selectedAdditionalDrawCount:
                    bridge.lastNativeSurfaceDiagnosticSelectedAdditionalDrawCount ?? null,
                  backgroundImageSuppressed:
                    bridge.lastNativeSurfaceDiagnosticBackgroundSuppressed ?? null,
                  boxWireframeSuppressed:
                    bridge.lastNativeSurfaceDiagnosticBoxWireframeSuppressed ?? null,
                  schroederProxySuppressed:
                    bridge.lastNativeSurfaceDiagnosticSchroederProxySuppressed ?? null
                };
              }, productCaptureToken).catch((error) => ({
                schema: 'peercompute.ulg.sph-native-product-surface-capture.v1',
                status: 'setup-error',
                reason: error instanceof Error ? error.message : String(error),
                token: productCaptureToken,
                surfaceKeys: []
              }));
              let productOnlyFrame = null;
              let productOnlyCaptureError = null;
              let productOnlyRestore = {
                status: 'not-needed',
                reason: 'native product draw filter was not installed'
              };
              let productOnlyCaptureContinuity = null;
              let productOnlyPostCaptureContinuity = null;
              try {
                if (productOnlySetup.status === 'native-product-draw-filter-rendered') {
                  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
                  productOnlyCaptureContinuity = await page.evaluate((expectedToken) => {
                    const overlay = document.querySelector('#sph-phase-overlay');
                    const sceneApi = overlay?.__sphScene || null;
                    const currentBridge = sceneApi?.getSphResidentSurfaceDrawRenderBridge?.() || null;
                    const session = overlay?.__ulgProbeNativeProductDrawFilterSession || null;
                    const selectedKeys = [
                      ...(currentBridge?.lastNativeSurfaceDiagnosticSelectedAdditionalSurfaceKeys || [])
                    ].sort();
                    const expectedKeys = [
                      ...(session?.filter?.additionalSurfaceKeys || [])
                    ].sort();
                    const ready = Boolean(
                      session?.token === expectedToken
                      && session.bridge === currentBridge
                      && currentBridge?.__ulgProbeNativeSurfaceDrawFilter === session.filter
                      && currentBridge?.lastNativeSurfaceDiagnosticDrawFilterActive === true
                      && currentBridge?.lastNativeSurfaceDiagnosticDrawFilterToken === expectedToken
                      && currentBridge?.lastNativeSurfaceDiagnosticSelectedPrimaryDrawCount === 0
                      && JSON.stringify(selectedKeys) === JSON.stringify(expectedKeys)
                      && currentBridge?.lastNativeSurfaceDiagnosticBackgroundSuppressed === true
                      && currentBridge?.lastNativeSurfaceDiagnosticBoxWireframeSuppressed === true
                      && currentBridge?.lastNativeSurfaceDiagnosticSchroederProxySuppressed === true
                      && currentBridge?.lastRenderStatus
                        === 'native-webgpu-surface-consumer-rendered'
                    );
                    return {
                      status: ready ? 'capture-filter-continuity-proved' : 'capture-filter-continuity-lost',
                      reason: ready
                        ? null
                        : 'active bridge or installed native product draw filter changed before capture',
                      activeBridgeMatchesInstalledBridge: session?.bridge === currentBridge,
                      installedFilterStillOwned:
                        currentBridge?.__ulgProbeNativeSurfaceDrawFilter === session?.filter,
                      selectedSurfaceKeys: selectedKeys,
                      expectedSurfaceKeys: expectedKeys,
                      lastRenderStatus: currentBridge?.lastRenderStatus ?? null,
                      lastFilterToken:
                        currentBridge?.lastNativeSurfaceDiagnosticDrawFilterToken ?? null
                    };
                  }, productOnlySetup.token);
                  if (productOnlyCaptureContinuity.status !== 'capture-filter-continuity-proved') {
                    throw new Error(productOnlyCaptureContinuity.reason);
                  }
                  productOnlyFrame = await capturePlaywrightCanvasCenterFrame({
                    page,
                    batchIndex: timeline.batchCount ?? batches,
                    phase: 'post-probe-native-product-draw-filter',
                    sampleIndex: Array.isArray(timeline.metrics)
                      ? Math.max(0, timeline.metrics.length - 1)
                      : null
                  });
                  productOnlyFrame.diagnosticOnly = true;
                  productOnlyFrame.captureMode = 'isolated-native-product-draw-filter';
                  productOnlyFrame.productSurfaceKeys = [...productOnlySetup.surfaceKeys];
                  if (productOnlyFrame.validationPng?.status === 'ready') {
                    productOnlyFrame.png = productOnlyFrame.validationPng;
                    productOnlyFrame.blankFrame = !productOnlyFrame.validationPng.hasVisiblePixels;
                  }
                  timeline.visualFrames.push(productOnlyFrame);
                  productOnlyPostCaptureContinuity = await page.evaluate((expectedToken) => {
                    const overlay = document.querySelector('#sph-phase-overlay');
                    const sceneApi = overlay?.__sphScene || null;
                    const currentBridge = sceneApi?.getSphResidentSurfaceDrawRenderBridge?.() || null;
                    const session = overlay?.__ulgProbeNativeProductDrawFilterSession || null;
                    const selectedKeys = [
                      ...(currentBridge?.lastNativeSurfaceDiagnosticSelectedAdditionalSurfaceKeys || [])
                    ].sort();
                    const expectedKeys = [
                      ...(session?.filter?.additionalSurfaceKeys || [])
                    ].sort();
                    const ready = Boolean(
                      session?.token === expectedToken
                      && session.bridge === currentBridge
                      && currentBridge?.__ulgProbeNativeSurfaceDrawFilter === session.filter
                      && currentBridge?.lastNativeSurfaceDiagnosticDrawFilterActive === true
                      && currentBridge?.lastNativeSurfaceDiagnosticDrawFilterToken === expectedToken
                      && currentBridge?.lastNativeSurfaceDiagnosticSelectedPrimaryDrawCount === 0
                      && JSON.stringify(selectedKeys) === JSON.stringify(expectedKeys)
                      && currentBridge?.lastNativeSurfaceDiagnosticBackgroundSuppressed === true
                      && currentBridge?.lastNativeSurfaceDiagnosticBoxWireframeSuppressed === true
                      && currentBridge?.lastNativeSurfaceDiagnosticSchroederProxySuppressed === true
                      && currentBridge?.lastRenderStatus
                        === 'native-webgpu-surface-consumer-rendered'
                    );
                    return {
                      status: ready
                        ? 'post-capture-filter-continuity-proved'
                        : 'post-capture-filter-continuity-lost',
                      reason: ready
                        ? null
                        : 'active bridge or exact native product draw filter changed during capture',
                      activeBridgeMatchesInstalledBridge: session?.bridge === currentBridge,
                      installedFilterStillOwned:
                        currentBridge?.__ulgProbeNativeSurfaceDrawFilter === session?.filter,
                      selectedSurfaceKeys: selectedKeys,
                      expectedSurfaceKeys: expectedKeys,
                      lastRenderStatus: currentBridge?.lastRenderStatus ?? null,
                      lastFilterToken:
                        currentBridge?.lastNativeSurfaceDiagnosticDrawFilterToken ?? null
                    };
                  }, productCaptureToken);
                }
              } catch (error) {
                productOnlyCaptureError = error instanceof Error ? error.message : String(error);
              } finally {
                productOnlyRestore = await page.evaluate((expectedToken) => {
                  const overlay = document.querySelector('#sph-phase-overlay');
                  const sceneApi = overlay?.__sphScene || null;
                  const currentBridge = sceneApi?.getSphResidentSurfaceDrawRenderBridge?.() || null;
                  const session = overlay?.__ulgProbeNativeProductDrawFilterSession || null;
                  if (!session?.bridge || !session?.filter) {
                    return {
                      status: 'not-needed',
                      reason: 'native product draw filter was not installed'
                    };
                  }
                  if (session.token !== expectedToken) {
                    return {
                      status: 'restore-not-owned',
                      reason: 'active native product draw filter belongs to another capture',
                      activeBridgeMatchesInstalledBridge:
                        currentBridge === session.bridge
                    };
                  }
                  const installedBridge = session.bridge;
                  const filterStillOwned =
                    installedBridge.__ulgProbeNativeSurfaceDrawFilter === session.filter
                    && session.filter.token === expectedToken;
                  if (filterStillOwned) {
                    delete installedBridge.__ulgProbeNativeSurfaceDrawFilter;
                  }
                  if (overlay.__ulgProbeNativeProductDrawFilterSession === session) {
                    delete overlay.__ulgProbeNativeProductDrawFilterSession;
                  }
                  if (!filterStillOwned) {
                    return {
                      status: 'restore-filter-ownership-lost',
                      reason: 'native product draw filter was replaced before cleanup',
                      activeBridgeMatchesInstalledBridge: currentBridge === installedBridge
                    };
                  }
                  const refresh = sceneApi?.refreshViewportAndOverlay?.({
                    reason: 'sph-probe-native-product-draw-filter-restore'
                  });
                  const overlayRestored = Boolean(
                    refresh?.surfaceOverlayRendered === true
                    && refresh?.surfaceOverlayLastRenderStatus
                      === 'native-webgpu-surface-consumer-rendered'
                    && currentBridge?.lastNativeSurfaceDiagnosticDrawFilterActive === false
                    && currentBridge?.lastNativeSurfaceDiagnosticDrawFilterToken == null
                  );
                  return {
                    status: overlayRestored
                      ? (currentBridge === installedBridge
                          ? 'restored'
                          : 'restored-after-active-bridge-changed')
                      : 'restore-render-failed',
                    reason: overlayRestored
                      ? null
                      : `overlayRendered=${refresh?.surfaceOverlayRendered === true}; filterCleared=${currentBridge?.lastNativeSurfaceDiagnosticDrawFilterActive === false}`,
                    refreshStatus: refresh?.status ?? null,
                    refreshSurfaceOverlayRendered: refresh?.surfaceOverlayRendered ?? null,
                    refreshSurfaceOverlayLastRenderStatus:
                      refresh?.surfaceOverlayLastRenderStatus ?? null,
                    activeBridgeMatchesInstalledBridge: currentBridge === installedBridge
                  };
                }, productCaptureToken).catch((error) => ({
                  status: 'restore-error',
                  reason: error instanceof Error ? error.message : String(error)
                }));
              }
              const indirectProductEvidence =
                timeline.nativeSurfaceDrawIndirectArgsValidation || null;
              const productGeometryProved = Boolean(
                indirectProductEvidence?.productStatus === 'all-expected-products-drawable'
                && Number(indirectProductEvidence?.productDrawableDrawCount) >= 2
                && indirectProductEvidence?.productDrawableDrawCount
                  === indirectProductEvidence?.productDrawCount
                && Array.isArray(indirectProductEvidence?.missingExpectedProductMaterials)
                && indirectProductEvidence.missingExpectedProductMaterials.length === 0
              );
              const productPixelsProved = Boolean(
                productOnlyFrame?.status === 'captured'
                && productOnlyFrame?.png?.status === 'ready'
                && productOnlyFrame.png.hasSurfaceLikeVariation === true
                && Number(productOnlyFrame.png.rgbChannelSpan) > 0
                && Number(productOnlyFrame.png.distinctRgbColorCount) > 1
              );
              const productFrameCanvasProved = Boolean(
                productOnlyFrame?.canvasSelection?.sameAsRenderBridgeCanvas === true
                && productOnlyFrame?.canvasSelection?.sameAsNativeConsumerCanvas === true
                && productOnlyFrame?.canvasSelection?.rendererBridge
                  === 'native-webgpu-surface-consumer'
              );
              const captureProtocolProved = Boolean(
                productOnlySetup.status === 'native-product-draw-filter-rendered'
                && productOnlyCaptureContinuity?.status === 'capture-filter-continuity-proved'
                && productOnlyPostCaptureContinuity?.status
                  === 'post-capture-filter-continuity-proved'
                && productFrameCanvasProved
                && productOnlyRestore.status === 'restored'
                && productOnlyCaptureError == null
              );
              const productVisibilityProved = Boolean(
                captureProtocolProved
                && productGeometryProved
                && productPixelsProved
              );
              timeline.nativeProductSurfaceOnlyCapture = {
                ...productOnlySetup,
                diagnosticOnly: true,
                captureMode: 'isolated-native-product-draw-filter',
                clearBackgroundRetained: true,
                suppressedPrimarySurfaceDraws: true,
                suppressedNonProductAdditionalSurfaceDraws: true,
                suppressedBackgroundImage: true,
                suppressedBoxWireframe: true,
                suppressedSchroederProxyDraws: true,
                indirectProductStatus:
                  indirectProductEvidence?.productStatus ?? null,
                indirectProductDrawableDrawCount:
                  indirectProductEvidence?.productDrawableDrawCount ?? null,
                indirectProductGeometryStatus: productGeometryProved
                  ? 'expected-product-geometry-proved'
                  : 'expected-product-geometry-unproved',
                captureContinuityStatus: productOnlyCaptureContinuity?.status ?? null,
                captureContinuityReason: productOnlyCaptureContinuity?.reason ?? null,
                postCaptureContinuityStatus:
                  productOnlyPostCaptureContinuity?.status ?? null,
                postCaptureContinuityReason:
                  productOnlyPostCaptureContinuity?.reason ?? null,
                frameCanvasSelectionProved: productFrameCanvasProved,
                frameStatus: productOnlyFrame?.status ?? null,
                frameCaptureSource: productOnlyFrame?.captureSource ?? null,
                frameCaptureError: productOnlyCaptureError,
                framePng: productOnlyFrame?.png ? {
                  status: productOnlyFrame.png.status,
                  width: productOnlyFrame.png.width,
                  height: productOnlyFrame.png.height,
                  rgbChannelSpan: productOnlyFrame.png.rgbChannelSpan,
                  distinctRgbColorCount: productOnlyFrame.png.distinctRgbColorCount,
                  hasSurfaceLikeVariation: productOnlyFrame.png.hasSurfaceLikeVariation
                } : null,
                restoreStatus: productOnlyRestore.status,
                restoreReason: productOnlyRestore.reason ?? null,
                captureProtocolStatus: captureProtocolProved
                  ? 'isolated-product-capture-protocol-proved'
                  : 'isolated-product-capture-protocol-unproved',
                productPixelStatus: productPixelsProved
                  ? 'isolated-product-pixels-proved'
                  : 'isolated-product-pixels-unproved',
                evidenceStatus: productVisibilityProved
                  ? 'isolated-product-visibility-evidence-proved'
                  : 'isolated-product-visibility-evidence-unproved'
              };
            }
          }
          const screenshot = await page.screenshot({ type: 'png', fullPage: false });
          const viewport = page.viewportSize?.() || {};
          timeline.visualFrames.push({
            schema: 'peercompute.ulg.sph-probe-visual-frame.v0',
            status: 'captured',
            batchIndex: timeline.batchCount ?? batches,
            phase: 'post-probe-composited-page',
            sampleIndex: Array.isArray(timeline.metrics) ? Math.max(0, timeline.metrics.length - 1) : null,
            capturedAtMs: Date.now(),
            captureSource: 'playwright-composited-page',
            width: viewport.width ?? null,
            height: viewport.height ?? null,
            dataUrl: `data:image/png;base64,${screenshot.toString('base64')}`
          });
          if (timeline.visualFrameCapture) {
            timeline.visualFrameCapture.frameCount = timeline.visualFrames.length;
            timeline.visualFrameCapture.compositedPageCapture = true;
            timeline.visualFrameCapture.canvasCenterCropCapture =
              canvasCenterFrame?.status === 'captured';
            timeline.visualFrameCapture.canvasElementCapture =
              timeline.visualFrameCapture.canvasCenterCropCapture;
          }
        } catch (error) {
          timeline.visualFrames.push({
            schema: 'peercompute.ulg.sph-probe-visual-frame.v0',
            status: 'capture-error',
            batchIndex: timeline.batchCount ?? batches,
            phase: 'post-probe-composited-page',
            sampleIndex: Array.isArray(timeline.metrics) ? Math.max(0, timeline.metrics.length - 1) : null,
            capturedAtMs: Date.now(),
            captureSource: 'playwright-composited-page',
            error: error instanceof Error ? error.message : String(error)
          });
          if (timeline.visualFrameCapture) {
            timeline.visualFrameCapture.frameCount = timeline.visualFrames.length;
            timeline.visualFrameCapture.compositedPageCapture = false;
          }
        }
      }
      if (
        interactiveCacheLifecycle
        && timeline?.interactiveCacheLifecycle?.postResetMeasurement
      ) {
        const terminalHandoff = await page.evaluate(async () => {
          const schema =
            'peercompute.ulg.sph-interactive-cache-terminal-handoff.v1';
          const overlay = document.querySelector('#sph-phase-overlay');
          const sceneApi = overlay?.__sphScene || null;
          const recordedDrainExecution =
            globalThis.__ulgInteractiveCacheTerminalDrainExecution || null;
          const playButton = overlay?.querySelector('#sph-play') || null;
          const quiescenceStartedAtMs = performance.now();
          const initialPlayButtonText = String(
            playButton?.textContent ?? ''
          ).trim();
          const pauseRequested = /Pause/i.test(initialPlayButtonText);
          if (pauseRequested) playButton?.click();
          let terminalExecution = null;
          let priorTerminalExecution = null;
          let stableFrameCount = 0;
          while (performance.now() - quiescenceStartedAtMs < 10_000) {
            await new Promise((resolve) => requestAnimationFrame(resolve));
            terminalExecution =
              sceneApi?.getMlsMpmResidentSteps?.()
              || overlay?.__mlsMpmResidentSteps
              || null;
            const residentPending =
              overlay?.__mlsMpmResidentStepsPending != null;
            const playbackActive = /Pause/i.test(
              String(playButton?.textContent ?? '')
            );
            if (
              !residentPending
              && !playbackActive
              && terminalExecution?.schema
            ) {
              stableFrameCount = terminalExecution === priorTerminalExecution
                ? stableFrameCount + 1
                : 1;
              priorTerminalExecution = terminalExecution;
              if (stableFrameCount >= 2) break;
            } else {
              priorTerminalExecution = null;
              stableFrameCount = 0;
            }
          }
          const playbackQuiescence = {
            schema:
              'peercompute.ulg.sph-interactive-playback-quiescence.v0',
            status: stableFrameCount >= 2
              ? 'resident-playback-quiescent'
              : 'resident-playback-quiescence-timeout',
            reason: 'terminal-handoff-before-dispose',
            initialButtonText: initialPlayButtonText,
            finalButtonText: String(
              playButton?.textContent ?? ''
            ).trim(),
            pauseRequested,
            residentPending:
              overlay?.__mlsMpmResidentStepsPending != null,
            stableFrameCount,
            completedStepCount:
              terminalExecution?.completedStepCount ?? null,
            elapsedMs: performance.now() - quiescenceStartedAtMs
          };
          const settlementPromise =
            terminalExecution?.schroederBackgroundSettlementPromise ?? null;
          const pendingBeforeDispose = [
            terminalExecution?.schroederSpatialEpochReleaseSettlementStatus,
            terminalExecution?.schroederHierarchyArtifactLedgerSettlementStatus,
            terminalExecution?.schroederSuccessorSourceFamilyRetirementStatus
          ].some((status) => String(status ?? '').startsWith('pending-'));
          const base = {
            schema,
            terminalConsumerMethod: 'scene-api-dispose',
            terminalConsumerContract:
              'queue-ordered-overlay-clear-final-consumer-before-resident-artifact-retirement',
            recordedDrainExecutionMatched:
              Boolean(
                terminalExecution
                && terminalExecution === recordedDrainExecution
              ),
            backgroundSettlementPromisePresent:
              Boolean(settlementPromise?.then),
            playbackQuiescence,
            pendingBeforeDispose,
            disposeInvoked: false,
            settlementAwaitMs: null,
            completedAtMs: null
          };
          let disposeError = null;
          try {
            if (typeof sceneApi?.dispose !== 'function') {
              throw new Error('scene API did not expose terminal dispose');
            }
            sceneApi.dispose();
            base.disposeInvoked = true;
          } catch (error) {
            disposeError = error instanceof Error ? error.message : String(error);
          }
          let settlementOutcome = {
            status: 'missing-background-settlement-promise',
            value: null,
            reason: 'terminal drain did not expose a background settlement promise'
          };
          if (settlementPromise?.then) {
            const startedAtMs = performance.now();
            settlementOutcome = await new Promise((resolve) => {
              let settled = false;
              const finish = (value) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                resolve(value);
              };
              const timer = setTimeout(() => finish({
                status: 'terminal-settlement-timeout',
                value: null,
                reason: 'terminal drain settlement exceeded 10000ms'
              }), 10_000);
              Promise.resolve(settlementPromise).then(
                (value) => finish({
                  status: 'terminal-settlement-resolved',
                  value,
                  reason: null
                }),
                (error) => finish({
                  status: 'terminal-settlement-rejected',
                  value: null,
                  reason: error instanceof Error ? error.message : String(error)
                })
              );
            });
            base.settlementAwaitMs = performance.now() - startedAtMs;
          }
          const spatialEpochSettlementComplete =
            terminalExecution?.schroederSpatialEpochReleaseSettlementComplete
            === true;
          const hierarchyArtifactSettlementComplete =
            terminalExecution
              ?.schroederHierarchyArtifactLedgerSettlementComplete === true;
          const successorSourceFamilyRetirementComplete =
            terminalExecution
              ?.schroederSuccessorSourceFamilyRetirementComplete === true;
          const complete = Boolean(
            playbackQuiescence.status === 'resident-playback-quiescent'
            && base.recordedDrainExecutionMatched
            && base.disposeInvoked
            && base.backgroundSettlementPromisePresent
            && settlementOutcome.status === 'terminal-settlement-resolved'
            && settlementOutcome.value === true
            && spatialEpochSettlementComplete
            && hierarchyArtifactSettlementComplete
            && successorSourceFamilyRetirementComplete
          );
          delete globalThis.__ulgInteractiveCacheTerminalDrainExecution;
          return {
            ...base,
            status: complete
              ? 'scene-terminal-consumer-settled'
              : 'scene-terminal-consumer-incomplete',
            reason: complete
              ? null
              : (
                  playbackQuiescence.status
                    !== 'resident-playback-quiescent'
                    ? `terminal resident playback quiescence failed: ${playbackQuiescence.status}`
                    : disposeError
                  || settlementOutcome.reason
                  || 'terminal drain ownership did not settle completely'
                ),
            settlementStatus: settlementOutcome.status,
            settlementValue: settlementOutcome.value,
            spatialEpochSettlementComplete,
            hierarchyArtifactSettlementComplete,
            successorSourceFamilyRetirementComplete,
            completedAtMs: performance.now()
          };
        }).catch((error) => ({
          schema: 'peercompute.ulg.sph-interactive-cache-terminal-handoff.v1',
          status: 'scene-terminal-consumer-incomplete',
          reason: error instanceof Error ? error.message : String(error),
          terminalConsumerMethod: 'scene-api-dispose',
          disposeInvoked: false
        }));
        timeline.interactiveCacheLifecycle.postResetMeasurement
          .terminalHandoff = terminalHandoff;
        timeline.interactiveCacheLifecycle.completedAtMs =
          terminalHandoff.completedAtMs
          ?? timeline.interactiveCacheLifecycle.completedAtMs;
        timeline.interactiveCacheLifecycle.status = terminalHandoff.status
          === 'scene-terminal-consumer-settled'
          ? 'same-page-warm-reset-cached-measurement-complete'
          : 'same-page-warm-reset-cached-measurement-incomplete';
      }
        return timeline;
      }, fatalSignal);
      completedTimeline = attachBrowserConsoleTelemetry(
        finalizedTimeline,
        consoleCapture
      );
      return completedTimeline;
    } finally {
      if (timeoutProbeTimer) clearTimeout(timeoutProbeTimer);
    }
  } catch (error) {
    const fatalTermination =
      error?.browserProbeFatalTermination
      || fatalSignal.current();
    if (!fatalTermination || typeof buildFatalTimeline !== 'function') {
      throw error;
    }
    completedTimeline = attachBrowserConsoleTelemetry(
      await buildFatalTimeline(fatalTermination),
      consoleCapture
    );
    return completedTimeline;
  } finally {
    browserLifecycleSettled = true;
    if (browser !== null) {
      try {
        await closeOwnedProbeBrowser(browser);
        if (completedTimeline !== null) {
          completedTimeline.browserLifecycle = {
            ownership: 'probe-launched-isolated-browser',
            closeStatus: 'closed'
          };
        }
      } catch (closeError) {
        if (completedTimeline === null) throw closeError;
        completedTimeline.browserLifecycle = {
          ownership: 'probe-launched-isolated-browser',
          closeStatus: 'close-error',
          reason: closeError instanceof Error
            ? closeError.message
            : String(closeError)
        };
      }
    }
  }
}

async function runDirectResidentProbe({
  baseUrl,
  scenarioUrl,
  timeoutMs,
  batches,
  batchSteps,
  readbackMode,
  compactSummaryMode,
  compactSummaryScope,
  thermalWallRate,
  fuseResidentMechanicsSequence = false,
  fuseResidentMechanicsActiveGrid = false,
  fusedActiveGridSafetyCells = null,
  activeGridDispatchPlanRefreshMode = 'final-only',
  measureGpuQueueFence = false,
  contactBinMetadataReadback = false,
  reactionBinMetadataReadback = false
}) {
  let browser = null;
  let completedTimeline = null;
  try {
    browser = await launchProbeBrowser();
    const page = await newProbePage(browser);
    const consoleCapture = createBrowserConsoleCapture();
    page.on('console', (message) => {
      consoleCapture.recordConsole(message);
      if (process.env.ULG_PROBE_STREAM_BROWSER_CONSOLE === '1') {
        const type = typeof message?.type === 'function' ? message.type() : 'console';
        const text = typeof message?.text === 'function' ? message.text() : String(message || '');
        process.stderr.write(`[browser:${type}] ${text}\n`);
      }
    });
    page.on('pageerror', (error) => {
      consoleCapture.recordPageError(error);
    });
    const target = new URL(scenarioUrl || DEFAULT_URL, baseUrl).toString();
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    const timeline = await page.evaluate(async ({
      scenarioUrl: requestedScenarioUrl,
      batches: requestedBatches,
      batchSteps: requestedBatchSteps,
      readbackMode: requestedReadbackMode,
      compactSummaryScope: requestedCompactSummaryScope,
      compactSummaryMode: requestedCompactSummaryMode,
      thermalWallRate: requestedThermalWallRate,
      fuseResidentMechanicsSequence: requestedFuseResidentMechanicsSequence,
      fuseResidentMechanicsActiveGrid: requestedFuseResidentMechanicsActiveGrid,
      fusedActiveGridSafetyCells: requestedFusedActiveGridSafetyCells,
      activeGridDispatchPlanRefreshMode: requestedActiveGridDispatchPlanRefreshMode,
      measureGpuQueueFence: requestedMeasureGpuQueueFence,
      contactBinMetadataReadback: requestedContactBinMetadataReadback,
      reactionBinMetadataReadback: requestedReactionBinMetadataReadback,
      defaults
    }) => {
      const finiteOrNull = (value) => {
        if (value == null || value === '') return null;
        const number = Number(value);
        return Number.isFinite(number) ? number : null;
      };
      const compactPageVisibleReadbackTelemetry = (telemetry) => {
        const source = telemetry && typeof telemetry === 'object'
          ? telemetry
          : {};
        const schema = 'peercompute.ulg.gpu-readback-telemetry.v1';
        const observedCountFields = [
          'observedMapAsyncCount',
          'observedReadbackBytes',
          'observedHostQueueFenceCount'
        ];
        const classifiedCountFields = [
          'finalDiagnosticMapAsyncCount',
          'finalDiagnosticReadbackBytes',
          'deferredCleanupHostQueueFenceCount',
          'awaitedBackpressureHostQueueFenceCount'
        ];
        const unclassifiedCountFields = [
          'unclassifiedMapAsyncCount',
          'unclassifiedReadbackBytes',
          'unclassifiedHostQueueFenceCount'
        ];
        const publicAliasFields = [
          'mapAsyncCount',
          'readbackBytes',
          'hostQueueFenceCount'
        ];
        const breakdownCountFields = [
          ...observedCountFields,
          ...classifiedCountFields,
          ...unclassifiedCountFields
        ];
        const countFields = [
          ...breakdownCountFields,
          ...publicAliasFields
        ];
        const hasOwn = (value, field) => (
          Object.prototype.hasOwnProperty.call(value, field)
        );
        const exactCount = (value) => (
          typeof value === 'number'
          && Number.isSafeInteger(value)
          && value >= 0
            ? value
            : null
        );
        const requiredCounts = (value, fields) => {
          const counts = {};
          for (const field of fields) {
            if (!hasOwn(value, field)) return null;
            const count = exactCount(value[field]);
            if (count == null) return null;
            counts[field] = count;
          }
          return counts;
        };
        const classificationsConserve = (counts) => {
          const mapCount = counts.finalDiagnosticMapAsyncCount
            + counts.unclassifiedMapAsyncCount;
          const byteCount = counts.finalDiagnosticReadbackBytes
            + counts.unclassifiedReadbackBytes;
          const fenceCount = counts.deferredCleanupHostQueueFenceCount
            + counts.awaitedBackpressureHostQueueFenceCount
            + counts.unclassifiedHostQueueFenceCount;
          return Boolean(
            Number.isSafeInteger(mapCount)
            && Number.isSafeInteger(byteCount)
            && Number.isSafeInteger(fenceCount)
            && mapCount === counts.observedMapAsyncCount
            && byteCount === counts.observedReadbackBytes
            && fenceCount === counts.observedHostQueueFenceCount
          );
        };
        const aliasesMatch = (counts) => Boolean(
          counts.mapAsyncCount === counts.observedMapAsyncCount
          && counts.readbackBytes === counts.observedReadbackBytes
          && counts.hostQueueFenceCount === counts.observedHostQueueFenceCount
        );
        const expectedClaims = (counts) => ({
          normalHotLoopReadbackFree: Boolean(
            counts.observedMapAsyncCount === 0
            && counts.observedReadbackBytes === 0
            && counts.observedHostQueueFenceCount === 0
          ),
          productionHotLoopHostDependencyFree: Boolean(
            counts.unclassifiedMapAsyncCount === 0
            && counts.unclassifiedReadbackBytes === 0
            && counts.unclassifiedHostQueueFenceCount === 0
            && counts.awaitedBackpressureHostQueueFenceCount === 0
          )
        });
        const normalizedBreakdown = (counts) => {
          if (
            !hasOwn(source, 'readbackTelemetrySourceBreakdown')
            || !Array.isArray(source.readbackTelemetrySourceBreakdown)
          ) {
            return null;
          }
          const totals = Object.fromEntries(
            breakdownCountFields.map((field) => [field, 0])
          );
          const canonicalSources = new Set();
          const rows = [];
          for (const row of source.readbackTelemetrySourceBreakdown) {
            if (
              !row
              || typeof row !== 'object'
              || Array.isArray(row)
              || !hasOwn(row, 'source')
            ) {
              return null;
            }
            const rawSource = row.source;
            const canonicalSource = typeof rawSource === 'string'
              ? rawSource.trim()
              : '';
            if (!canonicalSource || canonicalSources.has(canonicalSource)) {
              return null;
            }
            canonicalSources.add(canonicalSource);
            const rowCounts = requiredCounts(row, breakdownCountFields);
            if (!rowCounts || !classificationsConserve(rowCounts)) {
              return null;
            }
            for (const field of breakdownCountFields) {
              const next = totals[field] + rowCounts[field];
              if (!Number.isSafeInteger(next)) return null;
              totals[field] = next;
            }
            rows.push({
              source: canonicalSource,
              ...rowCounts
            });
          }
          return breakdownCountFields.every(
            (field) => totals[field] === counts[field]
          )
            ? rows
            : null;
        };
        const declaredComplete =
          typeof source.readbackTelemetryComplete === 'boolean'
            ? source.readbackTelemetryComplete
            : null;
        const validation = (() => {
          if (
            declaredComplete !== true
            || Array.isArray(source)
            || !hasOwn(source, 'readbackTelemetrySchema')
            || source.readbackTelemetrySchema !== schema
            || !hasOwn(source, 'readbackTelemetryComplete')
            || !hasOwn(source, 'readbackTelemetryUnknownSources')
            || !Array.isArray(source.readbackTelemetryUnknownSources)
            || source.readbackTelemetryUnknownSources.length !== 0
          ) {
            return null;
          }
          const counts = requiredCounts(source, countFields);
          const sourceBreakdown = counts
            ? normalizedBreakdown(counts)
            : null;
          if (
            !counts
            || !classificationsConserve(counts)
            || !aliasesMatch(counts)
            || !sourceBreakdown
          ) {
            return null;
          }
          const claims = expectedClaims(counts);
          for (const [field, expected] of Object.entries(claims)) {
            if (!hasOwn(source, field)) continue;
            if (typeof source[field] !== 'boolean' || source[field] !== expected) {
              return null;
            }
          }
          return { counts, claims, sourceBreakdown };
        })();
        const complete = validation !== null;
        const counts = Object.fromEntries(
          countFields.map((field) => [
            field,
            complete ? validation.counts[field] : null
          ])
        );
        const unknownSources =
          Array.isArray(source.readbackTelemetryUnknownSources)
          && source.readbackTelemetryUnknownSources.every(
            (value) => typeof value === 'string' && value.trim()
          )
            ? [...source.readbackTelemetryUnknownSources]
            : null;
        const failClosedClaim = (field) => (
          source[field] === false ? false : null
        );
        const legacyExactZeroProductionEvidence = (() => {
          if (
            complete
            || Array.isArray(source)
            || !hasOwn(source, 'readbackTelemetrySchema')
            || source.readbackTelemetrySchema !== schema
            || !hasOwn(source, 'readbackTelemetryComplete')
            || source.readbackTelemetryComplete !== true
            || !hasOwn(source, 'readbackTelemetryUnknownSources')
            || !Array.isArray(source.readbackTelemetryUnknownSources)
            || source.readbackTelemetryUnknownSources.length !== 0
            || !hasOwn(source, 'normalHotLoopReadbackFree')
            || source.normalHotLoopReadbackFree !== true
            || hasOwn(source, 'productionHotLoopHostDependencyFree')
          ) return null;
          const observedCounts = requiredCounts(source, observedCountFields);
          if (
            !observedCounts
            || !observedCountFields.every(
              (field) => observedCounts[field] === 0
            )
            || !countFields.every(
              (field) => !hasOwn(source, field) || exactCount(source[field]) === 0
            )
          ) return null;
          if (hasOwn(source, 'readbackTelemetrySourceBreakdown')) {
            const zeroBreakdownCounts = Object.fromEntries(
              breakdownCountFields.map((field) => [field, 0])
            );
            if (normalizedBreakdown(zeroBreakdownCounts) == null) return null;
          }
          return true;
        })();
        return {
          readbackTelemetryComplete: complete
            ? true
            : (declaredComplete == null ? null : false),
          readbackTelemetryUnknownSources: unknownSources,
          ...counts,
          readbackTelemetrySourceBreakdown: complete
            ? validation.sourceBreakdown.map(
              (row) => ({ ...row })
            )
            : null,
          normalHotLoopReadbackFree: complete
            ? validation.claims.normalHotLoopReadbackFree
            : failClosedClaim('normalHotLoopReadbackFree'),
          productionHotLoopHostDependencyFree: complete
            ? validation.claims.productionHotLoopHostDependencyFree
            : failClosedClaim('productionHotLoopHostDependencyFree'),
          legacyExactZeroProductionEvidence
        };
      };
      const composePageVisibleReadbackTelemetry = (
        primaryTelemetry,
        certificationTelemetry = null
      ) => {
        const primary = compactPageVisibleReadbackTelemetry(primaryTelemetry);
        const participants = [primary];
        if (certificationTelemetry != null) {
          participants.push(
            compactPageVisibleReadbackTelemetry(certificationTelemetry)
          );
        }
        const readbackTelemetryComplete = participants.every(
          (participant) => participant.readbackTelemetryComplete === true
        )
          ? true
          : (
              participants.some(
                (participant) => (
                  participant.readbackTelemetryComplete === false
                )
              )
                ? false
                : null
            );
        const coupledClaim = (field) => {
          if (participants.some((participant) => participant[field] === false)) {
            return false;
          }
          return readbackTelemetryComplete === true
            && participants.every((participant) => participant[field] === true)
            ? true
            : null;
        };
        const countFields = [
          'observedMapAsyncCount',
          'observedReadbackBytes',
          'observedHostQueueFenceCount',
          'finalDiagnosticMapAsyncCount',
          'finalDiagnosticReadbackBytes',
          'deferredCleanupHostQueueFenceCount',
          'awaitedBackpressureHostQueueFenceCount',
          'unclassifiedMapAsyncCount',
          'unclassifiedReadbackBytes',
          'unclassifiedHostQueueFenceCount',
          'mapAsyncCount',
          'readbackBytes',
          'hostQueueFenceCount'
        ];
        return {
          ...primary,
          readbackTelemetryComplete,
          readbackTelemetryUnknownSources: readbackTelemetryComplete === true
            ? [...primary.readbackTelemetryUnknownSources]
            : null,
          ...Object.fromEntries(countFields.map((field) => [
            field,
            readbackTelemetryComplete === true ? primary[field] : null
          ])),
          readbackTelemetrySourceBreakdown: readbackTelemetryComplete === true
            ? primary.readbackTelemetrySourceBreakdown.map(
              (row) => ({ ...row })
            )
            : null,
          normalHotLoopReadbackFree: coupledClaim(
            'normalHotLoopReadbackFree'
          ),
          productionHotLoopHostDependencyFree: coupledClaim(
            'productionHotLoopHostDependencyFree'
          )
        };
      };
      const finiteNumber = (value, fallback) => {
        if (value == null || value === '') return fallback;
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
      };
      const positiveInteger = (value, fallback) => {
        const number = Math.round(Number(value));
        return Number.isFinite(number) && number > 0 ? number : fallback;
      };
      const progress = (phase, fields = {}) => {
        if (defaults?.directResidentProgressLog !== true) return;
        try {
          console.info(`[ulg-direct-resident-progress] ${JSON.stringify({
            phase,
            t: performance.now(),
            ...fields
          })}`);
        } catch {
          console.info(`[ulg-direct-resident-progress] ${phase}`);
        }
      };
      const normalizedMechanicsMode = (value) => {
        const mode = String(value || '').trim().toLowerCase();
        if (mode === 'sph' || mode === 'plain-sph' || mode === 'plain_sph') return 'sph';
        return 'mlsmpm';
      };
      const paramsFromUrl = (value) => {
        const url = new URL(value, window.location.href);
        const query = new URLSearchParams(url.search);
        const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
        return {
          get(key) {
            return hash.get(key) ?? query.get(key);
          }
        };
      };
      const compactDispatchStageTopology = (stage) => stage ? {
        stageId: stage.stageId ?? null,
        topology: stage.topology ?? null,
        entryPoint: stage.entryPoint ?? null,
        dispatchAxis: stage.dispatchAxis ?? null,
        dispatchWorkgroupsPerSubstep: stage.dispatchWorkgroupsPerSubstep ?? null,
        invocationLimitPerSubstep: stage.invocationLimitPerSubstep ?? null,
        workgroupSize: stage.workgroupSize ?? null,
        particleLoopInShader: stage.particleLoopInShader ?? null,
        perParticleLocalStencilNodeCount: stage.perParticleLocalStencilNodeCount ?? null,
        gridWriteMode: stage.gridWriteMode ?? null,
        gridReadMode: stage.gridReadMode ?? null,
        activeGridEnabled: stage.activeGridEnabled ?? null,
        bufferClearMode: stage.bufferClearMode ?? null
      } : null;
      const compactDispatchTopology = (topology) => topology ? {
        schema: topology.schema ?? null,
        status: topology.status ?? null,
        backend: topology.backend ?? null,
        substepCount: topology.substepCount ?? null,
        particleCount: topology.particleCount ?? null,
        fullGridNodeCount: topology.fullGridNodeCount ?? null,
        activeGridNodeCount: topology.activeGridNodeCount ?? null,
        activeGridEnabled: topology.activeGridEnabled ?? null,
        cpuParticleLoopInHotPath: topology.cpuParticleLoopInHotPath ?? null,
        particleParallelStages: Array.isArray(topology.particleParallelStages) ? [...topology.particleParallelStages] : [],
        gridParallelStages: Array.isArray(topology.gridParallelStages) ? [...topology.gridParallelStages] : [],
        dispatchesPerSubstep: topology.dispatchesPerSubstep ?? null,
        totalDispatches: topology.totalDispatches ?? null,
        workgroupsPerSubstep: topology.workgroupsPerSubstep ?? null,
        totalWorkgroups: topology.totalWorkgroups ?? null,
        p2g: compactDispatchStageTopology(topology.p2g),
        p2gAccumulatorClear: compactDispatchStageTopology(topology.p2gAccumulatorClear),
        p2gFinalize: compactDispatchStageTopology(topology.p2gFinalize),
        gridUpdate: compactDispatchStageTopology(topology.gridUpdate),
        g2p: compactDispatchStageTopology(topology.g2p)
      } : null;
      const compactDiagnostics = (diagnostics) => diagnostics ? {
        particleCount: diagnostics.particleCount ?? null,
        gridNodeCount: diagnostics.gridNodeCount ?? null,
        dispatchTopologyStatus: diagnostics.dispatchTopologyStatus ?? null,
        dispatchTopologySchema: diagnostics.dispatchTopologySchema ?? null,
        dispatchTopology: compactDispatchTopology(diagnostics.dispatchTopology),
        cpuParticleLoopInHotPath: diagnostics.cpuParticleLoopInHotPath ?? null,
        particleParallelStages: Array.isArray(diagnostics.particleParallelStages) ? [...diagnostics.particleParallelStages] : [],
        gridParallelStages: Array.isArray(diagnostics.gridParallelStages) ? [...diagnostics.gridParallelStages] : [],
        dispatchesPerSubstep: diagnostics.dispatchesPerSubstep ?? null,
        totalDispatches: diagnostics.totalDispatches ?? null,
        p2gDispatchTopology: compactDispatchStageTopology(diagnostics.p2gDispatchTopology),
        p2gFinalizeDispatchTopology: compactDispatchStageTopology(diagnostics.p2gFinalizeDispatchTopology),
        gridUpdateDispatchTopology: compactDispatchStageTopology(diagnostics.gridUpdateDispatchTopology),
        g2pDispatchTopology: compactDispatchStageTopology(diagnostics.g2pDispatchTopology),
        activeGridNodeCount: diagnostics.activeGridNodeCount ?? null,
        activeGridNodeCountAvailable: diagnostics.activeGridNodeCountAvailable ?? null,
        activeGridNodeSummaryStatus: diagnostics.activeGridNodeSummaryStatus ?? null,
        gridNodeScanCount: diagnostics.gridNodeScanCount ?? null,
        gridNodeScanSkipped: diagnostics.gridNodeScanSkipped ?? null,
        activeGridDispatchPlanStatus: diagnostics.activeGridDispatchPlanStatus ?? null,
        activeGridDispatchPlanSource: diagnostics.activeGridDispatchPlanSource ?? null,
        activeGridDispatchPlanDispatchArgsBufferRetained: diagnostics.activeGridDispatchPlanDispatchArgsBufferRetained ?? null,
        activeGridDispatchPlanDispatchArgsBufferByteLength: diagnostics.activeGridDispatchPlanDispatchArgsBufferByteLength ?? null,
        activeGridDispatchPlanMetadataBufferRetained: diagnostics.activeGridDispatchPlanMetadataBufferRetained ?? null,
        activeGridDispatchPlanMetadataBufferByteLength: diagnostics.activeGridDispatchPlanMetadataBufferByteLength ?? null,
        massDeltaKg: finiteOrNull(diagnostics.massDeltaKg),
        maxSpeedMPerS: finiteOrNull(diagnostics.maxSpeedMPerS),
        maxDisplacementM: finiteOrNull(diagnostics.maxDisplacementM),
        sourceCenterOfMassM: Array.isArray(diagnostics.sourceCenterOfMassM) ? [...diagnostics.sourceCenterOfMassM] : null,
        nextCenterOfMassM: Array.isArray(diagnostics.nextCenterOfMassM) ? [...diagnostics.nextCenterOfMassM] : null,
        centerOfMassDeltaM: Array.isArray(diagnostics.centerOfMassDeltaM) ? [...diagnostics.centerOfMassDeltaM] : null,
        sourcePositionBoundsM: diagnostics.sourcePositionBoundsM ? { ...diagnostics.sourcePositionBoundsM } : null,
        nextPositionBoundsM: diagnostics.nextPositionBoundsM ? { ...diagnostics.nextPositionBoundsM } : null,
        cohortDiagnostics: diagnostics.cohortDiagnostics || null,
        cohortSummaryAvailable: diagnostics.cohortSummaryAvailable ?? null,
        minVolumeRatioJ: finiteOrNull(diagnostics.minVolumeRatioJ),
        maxVolumeRatioJ: finiteOrNull(diagnostics.maxVolumeRatioJ),
        phaseMassKg: diagnostics.phaseMassKg ? { ...diagnostics.phaseMassKg } : null,
        phaseMassTotalKg: finiteOrNull(diagnostics.phaseMassTotalKg),
        temperatureMassWeightedMeanK: finiteOrNull(diagnostics.temperatureMassWeightedMeanK),
        minTemperatureK: finiteOrNull(diagnostics.minTemperatureK),
        maxTemperatureK: finiteOrNull(diagnostics.maxTemperatureK),
        thermalReadyCount: diagnostics.thermalReadyCount ?? null,
        thermalProblemCount: diagnostics.thermalProblemCount ?? null,
        thermalPhaseSummaryAvailable: diagnostics.thermalPhaseSummaryAvailable ?? null,
        compactGpuSummaryAvailable: diagnostics.compactGpuSummaryAvailable ?? null,
        compactGpuSummaryStatus: diagnostics.compactGpuSummaryStatus ?? null,
        compactGpuSummaryReadbackMode: diagnostics.compactGpuSummaryReadbackMode ?? null,
        compactSummaryScope: diagnostics.compactSummaryScope ?? null,
        compactReadbackByteLength: diagnostics.compactReadbackByteLength ?? null,
        compactSummaryMapAsyncWaitMs: finiteOrNull(diagnostics.compactSummaryMapAsyncWaitMs),
        compactSummaryQueueFenceAttribution: diagnostics.compactSummaryQueueFenceAttribution ?? null,
        activeGridDispatchPlanStatus: diagnostics.activeGridDispatchPlanStatus ?? null,
        activeGridDispatchPlanSource: diagnostics.activeGridDispatchPlanSource ?? null,
        activeGridDispatchPlanDispatchArgsBufferRetained: diagnostics.activeGridDispatchPlanDispatchArgsBufferRetained ?? null,
        activeGridDispatchPlanDispatchArgsBufferByteLength: diagnostics.activeGridDispatchPlanDispatchArgsBufferByteLength ?? null,
        activeGridDispatchPlanMetadataBufferRetained: diagnostics.activeGridDispatchPlanMetadataBufferRetained ?? null,
        activeGridDispatchPlanMetadataBufferByteLength: diagnostics.activeGridDispatchPlanMetadataBufferByteLength ?? null,
        readbackMode: diagnostics.readbackMode ?? null,
        internalPressureScale: finiteOrNull(diagnostics.internalPressureScale),
        pressureInterfaceForceRowCount: diagnostics.pressureInterfaceForceRowCount ?? null,
        pressureInterfaceForceConsumerStatus: diagnostics.pressureInterfaceForceConsumerStatus ?? null,
        pressureInterfaceAppliedImpulseMagnitudeNSeconds: finiteOrNull(diagnostics.pressureInterfaceAppliedImpulseMagnitudeNSeconds),
        pressureInterfaceContactBinGridStatus: diagnostics.pressureInterfaceContactBinGridStatus ?? null,
        pressureInterfaceContactBinGridEnabled: diagnostics.pressureInterfaceContactBinGridEnabled ?? null,
        pressureInterfaceContactBinGridCellCount: diagnostics.pressureInterfaceContactBinGridCellCount ?? null,
        pressureInterfaceContactBinGridBinCapacity: diagnostics.pressureInterfaceContactBinGridBinCapacity ?? null,
        pressureInterfaceContactBinGridAverageOccupancy: finiteOrNull(diagnostics.pressureInterfaceContactBinGridAverageOccupancy),
        pressureInterfaceContactBinGridEstimatedOverflowRisk: diagnostics.pressureInterfaceContactBinGridEstimatedOverflowRisk ?? null,
        pressureInterfaceContactBinGridIndexBufferByteLength: diagnostics.pressureInterfaceContactBinGridIndexBufferByteLength ?? null,
        pressureInterfaceContactBinOverflowStatus: diagnostics.pressureInterfaceContactBinOverflowStatus ?? null,
        pressureInterfaceContactBinOverflowCount: diagnostics.pressureInterfaceContactBinOverflowCount ?? null,
        residentAuthorityLedgerStatus: diagnostics.residentAuthorityLedgerStatus ?? null,
        residentAuthorityParticleOwner: diagnostics.residentAuthorityParticleOwner ?? null,
        residentAuthorityMechanicsOwner: diagnostics.residentAuthorityMechanicsOwner ?? null,
        residentAuthorityThermoOwner: diagnostics.residentAuthorityThermoOwner ?? null,
        reactionEvidence: {
          summaryAvailable: diagnostics.reactionSummaryAvailable ?? null,
          summaryStatus: diagnostics.reactionSummaryStatus ?? null,
          canonicalEventCount: diagnostics.reactionCanonicalEventCount ?? null,
          placedReactionEventCount:
            diagnostics.reactionPlacedEventCount ?? null,
          changedMaterialCount: diagnostics.reactionChangedMaterialCount ?? null,
          changedMassCount: diagnostics.reactionChangedMassCount ?? null,
          visibleProductMassKg: finiteOrNull(diagnostics.reactionVisibleProductMassKg),
          visibleGasProductMassKg: finiteOrNull(diagnostics.reactionVisibleGasProductMassKg),
          consumedReactantMassKg: finiteOrNull(diagnostics.reactionConsumedReactantMassKg),
          expectedProductMassKg: finiteOrNull(diagnostics.reactionExpectedProductMassKg),
          heatJ: finiteOrNull(diagnostics.reactionHeatJ),
          productEventRowCount: diagnostics.reactionProductEventRowCount ?? null,
          productEventActiveEventCount: diagnostics.reactionProductEventActiveEventCount ?? null,
          productEventBufferRetained: diagnostics.reactionProductEventBufferRetained ?? null,
          productPlacementProvenanceStatus:
            diagnostics.reactionProductPlacementProvenanceStatus ?? null,
          productPlacementProvenanceReadbackByteLength:
            diagnostics.reactionProductPlacementProvenanceReadbackByteLength ?? null,
          productPlacementAccumulatorByteLength:
            diagnostics.reactionProductPlacementAccumulatorByteLength ?? null,
          productPlacementReadbackCadence:
            diagnostics.reactionProductPlacementReadbackCadence ?? null,
          productPlacementMechanicsRefreshStatus:
            diagnostics.reactionProductPlacementMechanicsRefreshStatus ?? null,
          productPlacementMechanicsRefreshCarried:
            diagnostics.reactionProductPlacementMechanicsRefreshCarried ?? null,
          productPlacementProvenance:
            diagnostics.reactionProductPlacementProvenance ?? null,
          residentProductMassStatus: diagnostics.reactionResidentProductMassStatus ?? null,
          residentProductMassBufferRetained:
            diagnostics.reactionResidentProductMassBufferRetained ?? null,
          residentProductMassUnplacedProductMassKg:
            finiteOrNull(diagnostics.reactionResidentProductMassUnplacedProductMassKg),
          residentProductMassUnplacedGasProductMassKg:
            finiteOrNull(diagnostics.reactionResidentProductMassUnplacedGasProductMassKg),
          productInventory: diagnostics.reactionProductInventory || null,
          gasSpeciesLedger: diagnostics.reactionGasSpeciesLedger || null
        }
      } : null;
      const cohortRangesFromCounts = (counts = {}) => {
        const baseCount = Math.max(0, Math.round(Number(counts.base) || 0));
        const dropCount = Math.max(0, Math.round(Number(counts.drop) || 0));
        return {
          schema: 'peercompute.ulg.sph-role-cohort-ranges.v0',
          source: 'initial-particle-order',
          base: { role: 'base', startIndex: 0, endIndex: baseCount, count: baseCount },
          drop: { role: 'drop', startIndex: baseCount, endIndex: baseCount + dropCount, count: dropCount },
          total: baseCount + dropCount
        };
      };
      const cohortSummaryForRange = (state, range, stride = 8) => {
        if (!range?.count) {
          return {
            role: range?.role ?? null,
            status: 'empty-cohort',
            startIndex: range?.startIndex ?? null,
            endIndex: range?.endIndex ?? null,
            count: 0
          };
        }
        if (!state?.length) {
          return {
            role: range.role,
            status: 'unavailable-no-full-state-readback',
            startIndex: range.startIndex,
            endIndex: range.endIndex,
            count: range.count
          };
        }
        const start = Math.max(0, Math.round(range.startIndex || 0));
        const end = Math.min(Math.round(range.endIndex || start), Math.floor(state.length / stride));
        if (end <= start) {
          return {
            role: range.role,
            status: 'invalid-cohort-range',
            startIndex: start,
            endIndex: end,
            count: 0
          };
        }
        const min = [Infinity, Infinity, Infinity];
        const max = [-Infinity, -Infinity, -Infinity];
        const momentum = [0, 0, 0];
        const weightedPosition = [0, 0, 0];
        let massKg = 0;
        let maxSpeedMPerS = 0;
        for (let index = start; index < end; index += 1) {
          const offset = index * stride;
          const x = finiteNumber(state[offset], 0);
          const y = finiteNumber(state[offset + 1], 0);
          const z = finiteNumber(state[offset + 2], 0);
          const m = Math.max(0, finiteNumber(state[offset + 3], 0));
          const vx = finiteNumber(state[offset + 4], 0);
          const vy = finiteNumber(state[offset + 5], 0);
          const vz = finiteNumber(state[offset + 6], 0);
          const speed = Math.hypot(vx, vy, vz);
          maxSpeedMPerS = Math.max(maxSpeedMPerS, speed);
          min[0] = Math.min(min[0], x);
          min[1] = Math.min(min[1], y);
          min[2] = Math.min(min[2], z);
          max[0] = Math.max(max[0], x);
          max[1] = Math.max(max[1], y);
          max[2] = Math.max(max[2], z);
          massKg += m;
          weightedPosition[0] += x * m;
          weightedPosition[1] += y * m;
          weightedPosition[2] += z * m;
          momentum[0] += vx * m;
          momentum[1] += vy * m;
          momentum[2] += vz * m;
        }
        const centerOfMassM = massKg > 0
          ? weightedPosition.map((value) => value / massKg)
          : [null, null, null];
        const meanVelocityMPerS = massKg > 0
          ? momentum.map((value) => value / massKg)
          : [null, null, null];
        return {
          role: range.role,
          status: 'cohort-summary-ready',
          startIndex: start,
          endIndex: end,
          count: end - start,
          massKg,
          centerOfMassM,
          boundsM: {
            status: 'position-bounds-ready',
            min,
            max,
            size: max.map((value, axis) => value - min[axis])
          },
          meanVelocityMPerS,
          maxSpeedMPerS
        };
      };
      const cohortDiagnosticsForState = (state, ranges) => {
        if (!ranges) return null;
        return {
          schema: 'peercompute.ulg.sph-role-cohort-diagnostics.v0',
          source: ranges.source,
          readbackRequired: true,
          base: cohortSummaryForRange(state, ranges.base),
          drop: cohortSummaryForRange(state, ranges.drop)
        };
      };
      const particleDiagnosticsForState = (state, previousState = null, stride = 8) => {
        if (!state?.length) return null;
        const particleCount = Math.floor(state.length / stride);
        let maxSpeedMPerS = 0;
        let maxDisplacementM = 0;
        let massKg = 0;
        const weightedPosition = [0, 0, 0];
        const boundsMin = [Infinity, Infinity, Infinity];
        const boundsMax = [-Infinity, -Infinity, -Infinity];
        for (let index = 0; index < particleCount; index += 1) {
          const offset = index * stride;
          const x = finiteNumber(state[offset], 0);
          const y = finiteNumber(state[offset + 1], 0);
          const z = finiteNumber(state[offset + 2], 0);
          const m = Math.max(0, finiteNumber(state[offset + 3], 0));
          const vx = finiteNumber(state[offset + 4], 0);
          const vy = finiteNumber(state[offset + 5], 0);
          const vz = finiteNumber(state[offset + 6], 0);
          maxSpeedMPerS = Math.max(maxSpeedMPerS, Math.hypot(vx, vy, vz));
          if (previousState?.length >= offset + stride) {
            const dx = x - finiteNumber(previousState[offset], x);
            const dy = y - finiteNumber(previousState[offset + 1], y);
            const dz = z - finiteNumber(previousState[offset + 2], z);
            maxDisplacementM = Math.max(maxDisplacementM, Math.hypot(dx, dy, dz));
          }
          massKg += m;
          weightedPosition[0] += x * m;
          weightedPosition[1] += y * m;
          weightedPosition[2] += z * m;
          boundsMin[0] = Math.min(boundsMin[0], x);
          boundsMin[1] = Math.min(boundsMin[1], y);
          boundsMin[2] = Math.min(boundsMin[2], z);
          boundsMax[0] = Math.max(boundsMax[0], x);
          boundsMax[1] = Math.max(boundsMax[1], y);
          boundsMax[2] = Math.max(boundsMax[2], z);
        }
        return {
          particleCount,
          gridNodeCount: null,
          activeGridNodeCount: null,
          massDeltaKg: 0,
          maxSpeedMPerS,
          maxDisplacementM,
          sourceCenterOfMassM: null,
          nextCenterOfMassM: massKg > 0 ? weightedPosition.map((value) => value / massKg) : null,
          centerOfMassDeltaM: null,
          sourcePositionBoundsM: null,
          nextPositionBoundsM: {
            status: 'position-bounds-ready',
            min: boundsMin,
            max: boundsMax,
            size: boundsMax.map((value, axis) => value - boundsMin[axis])
          },
          minVolumeRatioJ: null,
          maxVolumeRatioJ: null,
          compactGpuSummaryAvailable: false,
          compactGpuSummaryStatus: 'not-run-cpu-reference',
          readbackMode: 'cpu-reference-full-state',
          internalPressureScale: null,
          pressureInterfaceForceRowCount: 0,
          pressureInterfaceForceConsumerStatus: 'not-run-plain-sph-cpu-reference',
          pressureInterfaceAppliedImpulseMagnitudeNSeconds: 0,
          residentAuthorityLedgerStatus: 'not-run-plain-sph-cpu-reference',
          residentAuthorityParticleOwner: 'plain-sph-cpu-reference',
          residentAuthorityMechanicsOwner: 'plain-sph-cpu-reference',
          residentAuthorityThermoOwner: 'plain-sph-cpu-reference'
        };
      };
      const compactParticleStateSummary = (state, stride = 8) => {
        if (!state?.length) {
          return {
            status: 'state-unavailable',
            length: state?.length ?? 0,
            particleCount: 0
          };
        }
        const particleCount = Math.floor(state.length / stride);
        const boundsMin = [Infinity, Infinity, Infinity];
        const boundsMax = [-Infinity, -Infinity, -Infinity];
        let massKg = 0;
        let nonzeroMassCount = 0;
        let finiteRowCount = 0;
        let maxSpeedMPerS = 0;
        const sampleRows = [];
        for (let index = 0; index < particleCount; index += 1) {
          const offset = index * stride;
          const x = Number(state[offset]);
          const y = Number(state[offset + 1]);
          const z = Number(state[offset + 2]);
          const m = Number(state[offset + 3]);
          const vx = Number(state[offset + 4]);
          const vy = Number(state[offset + 5]);
          const vz = Number(state[offset + 6]);
          if ([x, y, z, m, vx, vy, vz].every(Number.isFinite)) {
            finiteRowCount += 1;
            boundsMin[0] = Math.min(boundsMin[0], x);
            boundsMin[1] = Math.min(boundsMin[1], y);
            boundsMin[2] = Math.min(boundsMin[2], z);
            boundsMax[0] = Math.max(boundsMax[0], x);
            boundsMax[1] = Math.max(boundsMax[1], y);
            boundsMax[2] = Math.max(boundsMax[2], z);
            massKg += Math.max(0, m);
            if (Math.abs(m) > 0) nonzeroMassCount += 1;
            maxSpeedMPerS = Math.max(maxSpeedMPerS, Math.hypot(vx, vy, vz));
          }
          if (sampleRows.length < 4) {
            sampleRows.push({
              index,
              positionM: [finiteOrNull(x), finiteOrNull(y), finiteOrNull(z)],
              massKg: finiteOrNull(m),
              velocityMPerS: [finiteOrNull(vx), finiteOrNull(vy), finiteOrNull(vz)]
            });
          }
        }
        return {
          status: particleCount > 0 ? 'state-summary-ready' : 'state-empty',
          length: state.length,
          particleCount,
          finiteRowCount,
          nonzeroMassCount,
          massKg,
          maxSpeedMPerS,
          boundsM: finiteRowCount > 0
            ? {
                min: boundsMin,
                max: boundsMax,
                size: boundsMax.map((value, axis) => value - boundsMin[axis])
              }
            : null,
          sampleRows
        };
      };
      const compactMechanicsSummary = (mechanics, stride = 32) => {
        if (!mechanics?.length) {
          return {
            status: 'mechanics-unavailable',
            length: mechanics?.length ?? 0,
            particleCount: 0
          };
        }
        const particleCount = Math.floor(mechanics.length / stride);
        let finiteValueCount = 0;
        let minVolumeRatioJ = Infinity;
        let maxVolumeRatioJ = -Infinity;
        const sampleRows = [];
        for (let index = 0; index < particleCount; index += 1) {
          const offset = index * stride;
          const j = Number(mechanics[offset + 18]);
          for (let cell = 0; cell < stride; cell += 1) {
            if (Number.isFinite(Number(mechanics[offset + cell]))) finiteValueCount += 1;
          }
          if (Number.isFinite(j)) {
            minVolumeRatioJ = Math.min(minVolumeRatioJ, j);
            maxVolumeRatioJ = Math.max(maxVolumeRatioJ, j);
          }
          if (sampleRows.length < 4) {
            sampleRows.push({
              index,
              volumeRatioJ: finiteOrNull(j),
              restVolumeM3: finiteOrNull(mechanics[offset + 19]),
              solidFlag: finiteOrNull(mechanics[offset + 20]),
              eosModelId: finiteOrNull(mechanics[offset + 26])
            });
          }
        }
        return {
          status: particleCount > 0 ? 'mechanics-summary-ready' : 'mechanics-empty',
          length: mechanics.length,
          particleCount,
          finiteValueCount,
          minVolumeRatioJ: Number.isFinite(minVolumeRatioJ) ? minVolumeRatioJ : null,
          maxVolumeRatioJ: Number.isFinite(maxVolumeRatioJ) ? maxVolumeRatioJ : null,
          sampleRows
        };
      };
      const summarizeG2p = (g2p) => g2p ? {
        schema: g2p.schema ?? null,
        backend: g2p.backend ?? null,
        status: g2p.status ?? null,
        readbackMode: g2p.readbackMode ?? null,
        fullReadbackPerformed: Boolean(g2p.fullReadbackPerformed),
        retainedOutputParticleBuffers: Boolean(g2p.retainedOutputParticleBuffers),
        webgpuStatus: g2p.webgpuStatus ? { ...g2p.webgpuStatus } : null,
        webgpuParity: g2p.webgpuParity ? {
          schema: g2p.webgpuParity.schema ?? null,
          status: g2p.webgpuParity.status ?? null,
          tolerance: finiteOrNull(g2p.webgpuParity.tolerance),
          maxStateAbs: finiteOrNull(g2p.webgpuParity.maxStateAbs),
          maxMechanicsAbs: finiteOrNull(g2p.webgpuParity.maxMechanicsAbs),
          lengthMismatch: Boolean(g2p.webgpuParity.lengthMismatch),
          particleCount: g2p.webgpuParity.particleCount ?? null
        } : null,
        cpuStateSummary: compactParticleStateSummary(g2p.cpuReference?.state),
        gpuStateSummary: compactParticleStateSummary(g2p.gpuResult?.state || g2p.state),
        cpuMechanicsSummary: compactMechanicsSummary(g2p.cpuReference?.mechanics),
        gpuMechanicsSummary: compactMechanicsSummary(g2p.gpuResult?.mechanics || g2p.mechanics)
      } : null;
      let activeCohortRanges = null;
      const compactSidecarFusionPlan = (plan) => plan ? {
        schema: plan.schema ?? null,
        status: plan.status ?? null,
        requested: plan.requested ?? null,
        required: plan.required ?? null,
        sidecarFusionRunnable: plan.sidecarFusionRunnable ?? null,
        sidecarBlockers: [...(plan.sidecarBlockers || [])],
        blockers: [...(plan.blockers || [])],
        sidecarCount: plan.sidecarCount ?? null,
        stageCount: plan.stageCount ?? null,
        requiredStageOrder: [...(plan.requiredStageOrder || [])],
        stages: Array.isArray(plan.stages)
          ? plan.stages.map((stage) => ({
              id: stage.id ?? null,
              blocker: stage.blocker ?? null,
              lawNodeId: stage.lawNodeId ?? null,
              orderConstraint: stage.orderConstraint ?? null,
              reads: [...(stage.reads || [])],
              writes: [...(stage.writes || [])],
              implementedInCurrentFusedSequence: stage.implementedInCurrentFusedSequence ?? null,
              fusionRequirement: stage.fusionRequirement ?? null
            }))
          : []
      } : null;
      const compactSidecarFusionStepEvidence = (evidence) => evidence ? {
        schema: evidence.schema ?? null,
        status: evidence.status ?? null,
        sidecarFusionPlanStatus: evidence.sidecarFusionPlanStatus ?? null,
        sidecarFusionRequired: evidence.sidecarFusionRequired ?? null,
        sidecarFusionRunnable: evidence.sidecarFusionRunnable ?? null,
        sidecarBlockers: [...(evidence.sidecarBlockers || [])],
        requiredStageOrder: [...(evidence.requiredStageOrder || [])],
        stageCount: evidence.stageCount ?? null,
        executedStageCount: evidence.executedStageCount ?? null,
        passedStageCount: evidence.passedStageCount ?? null,
        allRequiredStagesPassed: evidence.allRequiredStagesPassed ?? null,
        promotesFusedSequence: evidence.promotesFusedSequence ?? null,
        fallbackEvidence: evidence.fallbackEvidence ?? null,
        stages: Array.isArray(evidence.stages)
          ? evidence.stages.map((stage) => ({
              id: stage.id ?? null,
              status: stage.status ?? null,
              sourceStatus: stage.sourceStatus ?? null,
              backend: stage.backend ?? null,
              executed: stage.executed ?? null,
              retainedOutputSatisfied: stage.retainedOutputSatisfied ?? null,
              orderSatisfied: stage.orderSatisfied ?? null,
              passed: stage.passed ?? null
            }))
          : []
      } : null;
      const compactThermalSidecarDirectRunnerContract = (contract) => contract ? {
        schema: contract.schema ?? null,
        status: contract.status ?? null,
        mode: contract.mode ?? null,
        requiredRoute: contract.requiredRoute ?? null,
        sidecarAwareSequenceCandidate: contract.sidecarAwareSequenceCandidate ?? null,
        directRunnerEligible: contract.directRunnerEligible ?? null,
        directRunnerRunnable: contract.directRunnerRunnable ?? null,
        directRunnerSelected: contract.directRunnerSelected ?? null,
        directRunnerSelectionStatus: contract.directRunnerSelectionStatus ?? null,
        directRunnerSelectionBlockers: [...(contract.directRunnerSelectionBlockers || [])],
        blockers: [...(contract.blockers || [])],
        sidecarBlockers: [...(contract.sidecarBlockers || [])],
        requiredRunnerStages: [...(contract.requiredRunnerStages || [])],
        requiredRetainedBuffers: [...(contract.requiredRetainedBuffers || [])],
        unsupportedSidecars: [...(contract.unsupportedSidecars || [])],
        currentRoute: contract.currentRoute ?? null,
        currentRunner: contract.currentRunner ?? null,
        fallbackMode: contract.fallbackMode ?? null,
        genericRouteActiveUntilDirectRunnerSelected:
          contract.genericRouteActiveUntilDirectRunnerSelected ?? null
      } : null;
      const compactSidecarAwareResidentSequence = (sequence) => sequence ? {
        schema: sequence.schema ?? null,
        status: sequence.status ?? null,
        mode: sequence.mode ?? null,
        runner: sequence.runner ?? null,
        sequencePath: sequence.sequencePath ?? null,
        directRunnerContract: compactThermalSidecarDirectRunnerContract(sequence.directRunnerContract),
        directRunnerContractStatus: sequence.directRunnerContractStatus ?? null,
        directRunnerEligible: sequence.directRunnerEligible ?? null,
        directRunnerRunnable: sequence.directRunnerRunnable ?? null,
        directRunnerSelected: sequence.directRunnerSelected ?? null,
        directRunnerSelectionStatus: sequence.directRunnerSelectionStatus ?? null,
        sequenceRequested: sequence.sequenceRequested ?? null,
        sequenceRunnable: sequence.sequenceRunnable ?? null,
        sidecarAwareSequenceCandidate: sequence.sidecarAwareSequenceCandidate ?? null,
        sidecarAwareSequenceExecuted: sequence.sidecarAwareSequenceExecuted ?? null,
        sidecarAwareSequencePromotesFusedSequence: sequence.sidecarAwareSequencePromotesFusedSequence ?? null,
        promotesFusedResidentSequence: sequence.promotesFusedResidentSequence ?? null,
        fallbackMode: sequence.fallbackMode ?? null,
        activeGridFallbackUsed: sequence.activeGridFallbackUsed ?? null,
        perStepFusedMechanicsFallbackEligible: sequence.perStepFusedMechanicsFallbackEligible ?? null,
        sidecarFusionPlanStatus: sequence.sidecarFusionPlanStatus ?? null,
        sidecarFusionRequired: sequence.sidecarFusionRequired ?? null,
        sidecarFusionRunnable: sequence.sidecarFusionRunnable ?? null,
        sidecarBlockers: [...(sequence.sidecarBlockers || [])],
        requiredStageOrder: [...(sequence.requiredStageOrder || [])],
        stageCount: sequence.stageCount ?? null,
        stepCount: sequence.stepCount ?? null,
        completedStepCount: sequence.completedStepCount ?? null,
        evidenceStepCount: sequence.evidenceStepCount ?? null,
        passedStepCount: sequence.passedStepCount ?? null,
        partialStepCount: sequence.partialStepCount ?? null,
        missingStepCount: sequence.missingStepCount ?? null,
        failedStepCount: sequence.failedStepCount ?? null,
        allStepsPassed: sequence.allStepsPassed ?? null
      } : null;
      const compactFusedResidentSequencePreflight = (preflight) => preflight ? {
        schema: preflight.schema ?? null,
        status: preflight.status ?? null,
        sequenceRequested: preflight.sequenceRequested ?? null,
        sequenceRunnable: preflight.sequenceRunnable ?? null,
        stepCount: preflight.stepCount ?? null,
        readbackMode: preflight.readbackMode ?? null,
        compactSummaryMode: preflight.compactSummaryMode ?? null,
        fallbackMode: preflight.fallbackMode ?? null,
        blockers: [...(preflight.blockers || [])],
        sidecarBlockers: [...(preflight.sidecarBlockers || [])],
        customRunnerBlockers: [...(preflight.customRunnerBlockers || [])],
        sidecarFusionRequired: preflight.sidecarFusionRequired ?? null,
        sidecarFusionRunnable: preflight.sidecarFusionRunnable ?? null,
        sidecarFusionPlanStatus: preflight.sidecarFusionPlanStatus ?? null,
        sidecarFusionStageCount: preflight.sidecarFusionStageCount ?? null,
        sidecarFusionPlan: compactSidecarFusionPlan(preflight.sidecarFusionPlan),
        perStepFusedMechanicsFallbackEligible: preflight.perStepFusedMechanicsFallbackEligible ?? null,
        sidecarOnlySequenceBlocked: preflight.sidecarOnlySequenceBlocked ?? null,
        sidecarAwareSequenceCandidate: preflight.sidecarAwareSequenceCandidate ?? null,
        sidecarAwareSequenceStatus: preflight.sidecarAwareSequenceStatus ?? null,
        sidecarAwareSequenceMode: preflight.sidecarAwareSequenceMode ?? null,
        sidecarAwareSequenceRunner: preflight.sidecarAwareSequenceRunner ?? null,
        sidecarAwareSequencePath: preflight.sidecarAwareSequencePath ?? null,
        sidecarAwareDirectRunnerContract:
          compactThermalSidecarDirectRunnerContract(preflight.sidecarAwareDirectRunnerContract),
        sidecarAwareDirectRunnerContractStatus: preflight.sidecarAwareDirectRunnerContractStatus ?? null,
        sidecarAwareDirectRunnerEligible: preflight.sidecarAwareDirectRunnerEligible ?? null,
        sidecarAwareDirectRunnerRunnable: preflight.sidecarAwareDirectRunnerRunnable ?? null,
        sidecarAwareDirectRunnerSelected: preflight.sidecarAwareDirectRunnerSelected ?? null,
        sidecarAwareDirectRunnerSelectionStatus: preflight.sidecarAwareDirectRunnerSelectionStatus ?? null,
        sidecarAwareSequencePromotesFusedSequence: preflight.sidecarAwareSequencePromotesFusedSequence ?? null,
        sidecarAwareSequenceSupportedBlockers: [...(preflight.sidecarAwareSequenceSupportedBlockers || [])],
        activeGridFallbackRequested: preflight.activeGridFallbackRequested ?? null,
        thermalAwareFusionRequired: preflight.thermalAwareFusionRequired ?? null,
        reactionAwareFusionRequired: preflight.reactionAwareFusionRequired ?? null,
        pressureInterfaceAwareFusionRequired: preflight.pressureInterfaceAwareFusionRequired ?? null,
        residentProductMassAwareFusionRequired: preflight.residentProductMassAwareFusionRequired ?? null
      } : null;
      const summarizeSteps = (steps) => {
        if (!steps) return null;
        const readbackTelemetry =
          composePageVisibleReadbackTelemetry(steps, steps?.finalStep);
        return {
        schema: steps.schema ?? null,
        backend: steps.backend ?? null,
        status: steps.status ?? null,
        stepCount: steps.stepCount ?? null,
        completedStepCount: steps.completedStepCount ?? null,
        compactSummaryMode: steps.compactSummaryMode ?? null,
        compactSummaryScope: steps.compactSummaryScope ?? null,
        readbackMode: steps.readbackMode ?? null,
        readbackTelemetrySchema: steps.readbackTelemetrySchema ?? null,
        readbackTelemetryScope: steps.readbackTelemetryScope ?? null,
        ...readbackTelemetry,
        requestedReadbackMode: requestedReadbackMode,
        ambientPressurePa: finiteOrNull(steps.ambientPressurePa),
        ambientPressureAppliedInStressProjection:
          steps.ambientPressureAppliedInStressProjection === true,
        ambientPressureSource: steps.ambientPressureSource ?? null,
        ambientPressureEvidence: steps.ambientPressureEvidence
          ? { ...steps.ambientPressureEvidence }
          : null,
        retainedIntermediateStepCount: steps.retainedIntermediateStepCount ?? null,
        continuationAvailable: Boolean(steps.nextParticleUploads),
        nextStep: steps.nextSphParticleState?.step ?? null,
        nextTime: finiteOrNull(steps.nextSphParticleState?.time),
        nextActiveGridDispatchPlanHintStatus: steps.nextSphParticleState?.residentActiveGridDispatchPlanHint?.status ?? null,
        nextActiveGridDispatchPlanHintSource: steps.nextSphParticleState?.residentActiveGridDispatchPlanHint?.source ?? null,
        nextActiveGridDispatchPlanHintDispatchArgsBufferByteLength: steps.nextSphParticleState?.residentActiveGridDispatchPlanHint?.dispatchArgsBufferByteLength ?? 0,
        nextActiveGridDispatchPlanHintMetadataBufferByteLength: steps.nextSphParticleState?.residentActiveGridDispatchPlanHint?.metadataBufferByteLength ?? 0,
        nextUploadActiveGridDispatchPlanHintStatus: steps.nextParticleUploads?.activeGridDispatchPlanHint?.status ?? null,
        nextUploadActiveGridDispatchPlanHintSource: steps.nextParticleUploads?.activeGridDispatchPlanHint?.source ?? null,
        nextUploadActiveGridDispatchPlanHintDispatchArgsBufferByteLength: steps.nextParticleUploads?.activeGridDispatchPlanHint?.dispatchArgsBufferByteLength ?? 0,
        nextUploadActiveGridDispatchPlanHintMetadataBufferByteLength: steps.nextParticleUploads?.activeGridDispatchPlanHint?.metadataBufferByteLength ?? 0,
        nextParticleBufferMode: steps.nextParticleBufferMode ?? null,
        residentProductMassGridCouplingStatus:
          steps.finalStep?.residentProductMassGridCouplingStatus ?? null,
        residentProductMassInputProductEventCountAuthority:
          steps.finalStep?.residentProductMassInputProductEventCountAuthority ?? null,
        residentProductMassInputProductEventRowCapacity:
          steps.finalStep?.residentProductMassInputProductEventRowCapacity ?? null,
        residentProductMassInputProductEventCountHostKnown:
          steps.finalStep?.residentProductMassInputProductEventCountHostKnown ?? null,
        residentProductMassProductEventDispatchMode:
          steps.finalStep?.residentProductMassProductEventDispatchMode ?? null,
        renderStateReadbackAvailable: steps.renderStateReadbackAvailable ?? null,
        reactionProductPlacementAccumulatorStatus:
          steps.reactionProductPlacementAccumulatorStatus ?? null,
        reactionProductPlacementSuccessfulDispatchCount:
          steps.reactionProductPlacementSuccessfulDispatchCount ?? null,
        reactionProductPlacementDispatchEvidenceComplete:
          steps.reactionProductPlacementDispatchEvidenceComplete ?? null,
        reactionProductPlacementSourceCountVerified:
          steps.reactionProductPlacementSourceCountVerified ?? null,
        residentAuthorityLedgerStatus: steps.residentAuthorityLedgerStatus ?? null,
        residentAuthorityFamilyOwners: steps.residentAuthorityFamilyOwners || null,
        residentAuthorityWarnings: [...(steps.residentAuthorityWarnings || [])],
        residentAuthorityBlockers: [...(steps.residentAuthorityBlockers || [])],
        schroederSpatialEpochTransactionSummaries: Array.isArray(
          steps.schroederSpatialEpochTransactionSummaries
        )
          ? steps.schroederSpatialEpochTransactionSummaries.map(
            compactSchroederSpatialEpochTransaction
          )
          : [],
        schroederSpatialEpochReleaseSettlementCount:
          steps.schroederSpatialEpochReleaseSettlementCount ?? null,
        schroederSpatialEpochReleaseSettlementComplete:
          steps.schroederSpatialEpochReleaseSettlementComplete === true,
        schroederHierarchyArtifactLedgerSummaries: Array.isArray(
          steps.schroederHierarchyArtifactLedgerSummaries
        ) ? steps.schroederHierarchyArtifactLedgerSummaries.map(
          (summary) => ({ ...summary })
        ) : [],
        schroederHierarchyArtifactLedgerSettlementCount:
          steps.schroederHierarchyArtifactLedgerSettlementCount ?? null,
        schroederHierarchyArtifactLedgerSettlementComplete:
          steps.schroederHierarchyArtifactLedgerSettlementComplete === true,
        schroederSpatialEpochGenerationSummaries: Array.isArray(
          steps.schroederSameLevelMechanicsSummaries
        )
          ? steps.schroederSameLevelMechanicsSummaries
            .map((summary) => summary?.spatialEpochGeneration ? {
              ...summary.spatialEpochGeneration
            } : null)
            .filter(Boolean)
          : [],
        phaseVolumeSurfaceStressRequired:
          steps.phaseVolumeSurfaceStressRequired === true,
        phaseVolumeSurfaceStressExpectedSubmissionCount:
          steps.phaseVolumeSurfaceStressExpectedSubmissionCount ?? null,
        phaseVolumeSurfaceStressSubmissionCount:
          steps.phaseVolumeSurfaceStressSubmissionCount ?? null,
        phaseVolumeSurfaceStressSubmissionEvidenceComplete:
          steps.phaseVolumeSurfaceStressSubmissionEvidenceComplete === true,
        phaseVolumeSurfaceStressSubmissions:
          Array.isArray(steps.stepSummaries)
            ? steps.stepSummaries.map((summary) => (
                compactPhaseVolumeSurfaceStressSubmission(
                  summary?.phaseVolumeSurfaceStressSubmission
                )
              ))
            : [],
        finalStepPhaseVolumeSurfaceStressSubmission:
          compactPhaseVolumeSurfaceStressSubmission(
            steps.finalStep?.gridUpdate?.phaseVolumeSurfaceStressSubmission
              ?? steps.finalStep?.phaseVolumeSurfaceStressSubmission
          ),
        sidecarAwareResidentSequenceActive: steps.sidecarAwareResidentSequenceActive ?? null,
        sidecarAwareResidentSequenceMode: steps.sidecarAwareResidentSequenceMode ?? null,
        sidecarAwareResidentSequenceRunner: steps.sidecarAwareResidentSequenceRunner ?? null,
        sidecarAwareResidentSequencePath: steps.sidecarAwareResidentSequencePath ?? null,
        sidecarAwareDirectRunnerContract:
          compactThermalSidecarDirectRunnerContract(steps.sidecarAwareDirectRunnerContract),
        sidecarAwareDirectRunnerContractStatus: steps.sidecarAwareDirectRunnerContractStatus ?? null,
        sidecarAwareDirectRunnerEligible: steps.sidecarAwareDirectRunnerEligible ?? null,
        sidecarAwareDirectRunnerRunnable: steps.sidecarAwareDirectRunnerRunnable ?? null,
        sidecarAwareDirectRunnerSelected: steps.sidecarAwareDirectRunnerSelected ?? null,
        sidecarAwareResidentSequence: compactSidecarAwareResidentSequence(steps.sidecarAwareResidentSequence),
        stepSummaries: Array.isArray(steps.stepSummaries)
          ? steps.stepSummaries.map((summary) => ({
            index: summary.index ?? null,
            status: summary.status ?? null,
            backend: summary.backend ?? null,
            compactSummaryAvailable: summary.compactSummaryAvailable ?? null,
            sidecarFusionStepEvidenceStatus: summary.sidecarFusionStepEvidenceStatus ?? null,
            sidecarFusionStepEvidenceExecutedStageCount: summary.sidecarFusionStepEvidenceExecutedStageCount ?? null,
            sidecarFusionStepEvidencePassedStageCount: summary.sidecarFusionStepEvidencePassedStageCount ?? null,
            sidecarFusionStepEvidenceAllRequiredStagesPassed:
              summary.sidecarFusionStepEvidenceAllRequiredStagesPassed ?? null,
            sidecarAwareResidentSequenceActive: summary.sidecarAwareResidentSequenceActive ?? null,
            sidecarAwareResidentSequenceMode: summary.sidecarAwareResidentSequenceMode ?? null,
            sidecarAwareResidentSequenceRunner: summary.sidecarAwareResidentSequenceRunner ?? null,
            sidecarAwareResidentSequencePath: summary.sidecarAwareResidentSequencePath ?? null,
            sidecarAwareDirectRunnerContractStatus: summary.sidecarAwareDirectRunnerContractStatus ?? null,
            sidecarAwareDirectRunnerEligible: summary.sidecarAwareDirectRunnerEligible ?? null,
            sidecarAwareDirectRunnerRunnable: summary.sidecarAwareDirectRunnerRunnable ?? null,
            sidecarAwareDirectRunnerSelected: summary.sidecarAwareDirectRunnerSelected ?? null,
            thermalSidecarDirectRunnerStatus: summary.thermalSidecarDirectRunnerStatus ?? null,
            thermalSidecarDirectRunnerGenericEntrypointBypassed:
              summary.thermalSidecarDirectRunnerGenericEntrypointBypassed ?? null,
            residentProductMassGridCouplingStatus:
              summary.residentProductMassGridCouplingStatus ?? null,
            residentProductMassInputProductEventCountAuthority:
              summary.residentProductMassInputProductEventCountAuthority ?? null,
            residentProductMassInputProductEventRowCapacity:
              summary.residentProductMassInputProductEventRowCapacity ?? null,
            residentProductMassInputProductEventCountHostKnown:
              summary.residentProductMassInputProductEventCountHostKnown ?? null,
            residentProductMassProductEventDispatchMode:
              summary.residentProductMassProductEventDispatchMode ?? null,
            activeGridIndirectDispatch: summary.stageTiming?.activeGridIndirectDispatch
              ? { ...summary.stageTiming.activeGridIndirectDispatch }
              : null,
            activeGridDispatch: summary.stageTiming?.activeGridDispatch
              ? { ...summary.stageTiming.activeGridDispatch }
              : null,
            phaseVolumeSurfaceStressSubmission:
              compactPhaseVolumeSurfaceStressSubmission(
                summary.phaseVolumeSurfaceStressSubmission
              )
          }))
          : [],
        fusedResidentSequence: steps.fusedResidentSequence ? {
          schema: steps.fusedResidentSequence.schema ?? null,
          status: steps.fusedResidentSequence.status ?? null,
          stepCount: steps.fusedResidentSequence.stepCount ?? null,
          dispatchCount: steps.fusedResidentSequence.dispatchCount ?? null,
          dispatchTopology: compactDispatchTopology(steps.fusedResidentSequence.dispatchTopology),
          activeGridDispatch: steps.fusedResidentSequence.activeGridDispatch
            ? { ...steps.fusedResidentSequence.activeGridDispatch }
            : null,
          activeGridIndirectDispatch: steps.fusedResidentSequence.activeGridIndirectDispatch
            ? { ...steps.fusedResidentSequence.activeGridIndirectDispatch }
            : null
        } : null,
        fusedResidentSequencePreflight: compactFusedResidentSequencePreflight(steps.fusedResidentSequencePreflight)
        };
      };
      const compactSchroederSuccessorEpochIdentity = (identity) => (
        identity && typeof identity === 'object'
          ? {
              storageGeneration: identity.storageGeneration ?? null,
              physicsTick: identity.physicsTick ?? null,
              physicsSubstep: identity.physicsSubstep ?? null,
              positionEpoch: identity.positionEpoch ?? null,
              topologyEpoch: identity.topologyEpoch ?? null,
              chartEpoch: identity.chartEpoch ?? null,
              levelEpoch: identity.levelEpoch ?? null,
              supportEpoch: identity.supportEpoch ?? null
            }
          : null
      );
      const compactSchroederSuccessorEpochEvidence = (evidence) => (
        evidence && typeof evidence === 'object'
          ? {
              schema: evidence.schema ?? null,
              status: evidence.status ?? null,
              ready: evidence.ready === true,
              admitted: evidence.admitted === true,
              authenticated: evidence.authenticated === true,
              deviceId: evidence.deviceId ?? null,
              sourceFamily: evidence.sourceFamily ?? null,
              sourceFamilyRole: evidence.sourceFamilyRole ?? null,
              publicationAuthority: evidence.publicationAuthority ?? null,
              exactBufferFamilyAuthenticated:
                evidence.exactBufferFamilyAuthenticated === true,
              storageAllocationAuthenticated:
                evidence.storageAllocationAuthenticated === true,
              topologyTransitionAuthenticated:
                evidence.topologyTransitionAuthenticated === true,
              sourceGenerationId: evidence.sourceGenerationId ?? null,
              ancestorSpatialGenerationId:
                evidence.ancestorSpatialGenerationId ?? null,
              positionAuthority: evidence.positionAuthority ?? null,
              positionEpochFloorAuthenticated:
                evidence.positionEpochFloorAuthenticated === true,
              positionEpochFloor: evidence.positionEpochFloor ?? null,
              positionTransitionAuthenticated:
                evidence.positionTransitionAuthenticated === true,
              positionChanged: evidence.positionChanged === true,
              sourceEpochIdentity: compactSchroederSuccessorEpochIdentity(
                evidence.sourceEpochIdentity
              ),
              successorEpochIdentity: compactSchroederSuccessorEpochIdentity(
                evidence.successorEpochIdentity
              )
            }
          : null
      );
      const compactSchroederSpatialEpochTransaction = (transaction) => transaction ? {
        schema: transaction.schema ?? null,
        status: transaction.status ?? null,
        state: transaction.state ?? null,
        generationId: transaction.generationId ?? null,
        deviceId: transaction.deviceId ?? null,
        epochIdentity: transaction.epochIdentity
          ? { ...transaction.epochIdentity }
          : null,
        requiredReaderIds: [...(transaction.requiredReaderIds || [])],
        admittedReaders: Array.isArray(transaction.admittedReaders)
          ? transaction.admittedReaders.map((reader) => ({ ...reader }))
          : [],
        proposalSeal: transaction.proposalSeal
          ? { ...transaction.proposalSeal }
          : null,
        commitStatus: transaction.commitStatus ?? null,
        nextStateBufferRetained: transaction.nextStateBufferRetained === true,
        abortReason: transaction.abortReason ?? null,
        releaseFailureReason: transaction.releaseFailureReason ?? null,
        legacyLookupRecords: Array.isArray(transaction.legacyLookupRecords)
          ? transaction.legacyLookupRecords.map((record) => ({ ...record }))
          : [],
        counters: transaction.counters
          ? { ...transaction.counters }
          : null,
        successorEpochEvidence: compactSchroederSuccessorEpochEvidence(
          transaction.successorEpochEvidence
        )
      } : null;
      const compactPhaseVolumeSurfaceStressSubmission = (submission) => (
        submission && typeof submission === 'object'
          ? {
              schema: submission.schema ?? null,
              status: submission.status ?? null,
              requested: submission.requested === true,
              submitted: submission.submitted === true,
              dispatchCount: finiteOrNull(submission.dispatchCount),
              entryPoints: Array.isArray(submission.entryPoints)
                ? [...submission.entryPoints]
                : [],
              lifecycleDispatchCount:
                finiteOrNull(submission.lifecycleDispatchCount),
              lifecycleMode: submission.lifecycleMode ?? null,
              ambientBuoyancyMode: submission.ambientBuoyancyMode ?? null,
              generationId: submission.generationId ?? null,
              selectedLevel: finiteOrNull(submission.selectedLevel),
              levelRole: submission.levelRole ?? null,
              twoLevel: submission.twoLevel === true,
              fieldCompletionOrdinal:
                finiteOrNull(submission.fieldCompletionOrdinal),
              materialTableSchema: submission.materialTableSchema ?? null,
              phaseRecordCount: finiteOrNull(submission.phaseRecordCount),
              positiveSurfaceTensionPhaseRecordCount: finiteOrNull(
                submission.positiveSurfaceTensionPhaseRecordCount
              ),
              surfaceTensionCoefficientStatus:
                submission.surfaceTensionCoefficientStatus ?? null,
              authority: submission.authority ?? null,
              verification: submission.verification ?? null
            }
          : null
      );
      const summarizeStep = (step) => step ? {
        schema: step.schema ?? null,
        backend: step.backend ?? null,
        status: step.status ?? null,
        readbackMode: step.readbackMode ?? null,
        requestedReadbackMode,
        sequenceIndex: step.sequenceIndex ?? null,
        internalPressureScale: finiteOrNull(step.internalPressureScale),
        ambientPressurePa: finiteOrNull(step.ambientPressurePa),
        ambientPressureSource: step.ambientPressureSource ?? null,
        ambientPressureEvidence: step.ambientPressureEvidence
          ? { ...step.ambientPressureEvidence }
          : null,
        ambientPressureAppliedInStressProjection:
          step.ambientPressureAppliedInStressProjection === true,
        // Per-stage mechanics snapshots. Null unless stageMechanicsTrace=1;
        // the record is fixed-size per stage, not per particle.
        stageMechanicsTrace: step.stageMechanicsTrace ?? null,
        canonicalSpatialAuthorityTrace:
          step.canonicalSpatialAuthorityTrace ?? null,
        stageStatus: step.stageStatus ? { ...step.stageStatus } : null,
        stageBackends: step.stageBackends ? { ...step.stageBackends } : null,
        particlePingPong: step.particlePingPong ? {
          sourceStep: step.particlePingPong.sourceStep ?? null,
          nextStep: step.particlePingPong.nextStep ?? null,
          sourceTime: finiteOrNull(step.particlePingPong.sourceTime),
          nextTime: finiteOrNull(step.particlePingPong.nextTime)
        } : null,
        schroederSpatialEpochTransaction:
          compactSchroederSpatialEpochTransaction(
            step.schroederSpatialEpochTransaction
          ),
        phaseVolumeSurfaceStressSubmission:
          compactPhaseVolumeSurfaceStressSubmission(
            step.gridUpdate?.phaseVolumeSurfaceStressSubmission
              ?? step.phaseVolumeSurfaceStressSubmission
          ),
        diagnostics: compactDiagnostics(step.diagnostics),
        cohortDiagnostics: step.diagnostics?.cohortDiagnostics
          || cohortDiagnosticsForState(
            step.readbackMode === 'no-full-readback' ? null : step.state,
            activeCohortRanges
        ),
        stageTiming: step.stageTiming ? {
          schema: step.stageTiming.schema ?? null,
          status: step.stageTiming.status ?? null,
          kind: step.stageTiming.kind ?? null,
          capabilities: step.stageTiming.capabilities
            ? { ...step.stageTiming.capabilities }
            : null,
          totalMs: finiteOrNull(step.stageTiming.totalMs),
          stageMs: { ...(step.stageTiming.stageMs || {}) },
          stageGpuMs: step.stageTiming.stageGpuMs
            ? { ...step.stageTiming.stageGpuMs }
            : null,
          stageGpuStats: step.stageTiming.stageGpuStats
            ? { ...step.stageTiming.stageGpuStats }
            : null,
          gpuTimestampProfileStatus:
            step.stageTiming.gpuTimestampProfile?.status ?? null,
          gpuTimestampProfiledPassCount:
            step.stageTiming.gpuTimestampProfile?.profiledPassCount ?? null,
          queueStageGpuMs: step.stageTiming.queueStageGpuMs
            ? { ...step.stageTiming.queueStageGpuMs }
            : null,
          queueStageGpuStats: step.stageTiming.queueStageGpuStats
            ? { ...step.stageTiming.queueStageGpuStats }
            : null,
          queueStageGpuSummaryStatus:
            step.stageTiming.queueStageGpuSummaryStatus ?? null,
          queueStageGpuRecorderSchema:
            step.stageTiming.queueStageGpuRecorderSchema ?? null,
          queueStageGpuRecorderKind:
            step.stageTiming.queueStageGpuRecorderKind ?? null,
          queueStageGpuRecorderCapabilities:
            step.stageTiming.queueStageGpuRecorderCapabilities
              ? { ...step.stageTiming.queueStageGpuRecorderCapabilities }
              : null,
          queueFenceMs: { ...(step.stageTiming.queueFenceMs || {}) },
          queueFenceStatus: { ...(step.stageTiming.queueFenceStatus || {}) },
          queueFenceMethod: { ...(step.stageTiming.queueFenceMethod || {}) },
          compactSummaryTiming: step.stageTiming.compactSummaryTiming ? {
            ...step.stageTiming.compactSummaryTiming,
            totalMs: finiteOrNull(step.stageTiming.compactSummaryTiming.totalMs),
            setupMs: finiteOrNull(step.stageTiming.compactSummaryTiming.setupMs),
            encodeMs: finiteOrNull(step.stageTiming.compactSummaryTiming.encodeMs),
            submitMs: finiteOrNull(step.stageTiming.compactSummaryTiming.submitMs),
            mapAsyncWaitMs: finiteOrNull(step.stageTiming.compactSummaryTiming.mapAsyncWaitMs),
            decodeMs: finiteOrNull(step.stageTiming.compactSummaryTiming.decodeMs)
          } : null,
          requestedReadbackMode: step.stageTiming.requestedReadbackMode ?? null,
          compactSummaryRequested: step.stageTiming.compactSummaryRequested ?? null,
          activeGridDispatchPlanOnlyRequested: step.stageTiming.activeGridDispatchPlanOnlyRequested ?? null,
          compactSummaryScope: step.stageTiming.compactSummaryScope ?? null,
          fusedResidentMechanics: step.stageTiming.fusedResidentMechanics ?? null,
          fusedResidentSequence: step.stageTiming.fusedResidentSequence ?? null,
          fusedResidentSequenceStepCount: step.stageTiming.fusedResidentSequenceStepCount ?? null,
          sidecarFusionStepEvidence: compactSidecarFusionStepEvidence(step.stageTiming.sidecarFusionStepEvidence),
          sidecarAwareResidentSequence: compactSidecarAwareResidentSequence(step.stageTiming.sidecarAwareResidentSequence),
          sidecarAwareResidentSequenceActive: step.stageTiming.sidecarAwareResidentSequenceActive ?? null,
          sidecarAwareResidentSequenceMode: step.stageTiming.sidecarAwareResidentSequenceMode ?? null,
          sidecarAwareResidentSequenceRunner: step.stageTiming.sidecarAwareResidentSequenceRunner ?? null,
          sidecarAwareResidentSequencePath: step.stageTiming.sidecarAwareResidentSequencePath ?? null,
          sidecarAwareDirectRunnerContract:
            compactThermalSidecarDirectRunnerContract(step.stageTiming.sidecarAwareDirectRunnerContract),
          sidecarAwareDirectRunnerContractStatus: step.stageTiming.sidecarAwareDirectRunnerContractStatus ?? null,
          sidecarAwareDirectRunnerSelected: step.stageTiming.sidecarAwareDirectRunnerSelected ?? null,
          thermalSidecarDirectRunnerStatus: step.stageTiming.thermalSidecarDirectRunnerStatus ?? null,
          thermalSidecarDirectRunnerGenericEntrypointBypassed:
            step.stageTiming.thermalSidecarDirectRunner?.genericResidentStepEntrypointBypassed ?? null,
          dispatchTopology: compactDispatchTopology(step.stageTiming.dispatchTopology),
          activeGridDispatch: step.stageTiming.activeGridDispatch
            ? { ...step.stageTiming.activeGridDispatch }
            : null,
          activeGridIndirectDispatch: step.stageTiming.activeGridIndirectDispatch
            ? { ...step.stageTiming.activeGridIndirectDispatch }
            : null,
          thermalRequested: step.stageTiming.thermalRequested ?? null,
          mechanicsRefreshRequested: step.stageTiming.mechanicsRefreshRequested ?? null,
          reactionRequested: step.stageTiming.reactionRequested ?? null
        } : null,
        compactGpuSummary: step.compactGpuSummary ? {
          schema: step.compactGpuSummary.schema ?? null,
          backend: step.compactGpuSummary.backend ?? null,
          status: step.compactGpuSummary.status ?? null,
          reason: step.compactGpuSummary.reason ?? null,
          readbackMode: step.compactGpuSummary.readbackMode ?? null,
          compactGpuSummaryAvailable: step.compactGpuSummary.compactGpuSummaryAvailable ?? null,
          compactGpuSummaryStatus: step.compactGpuSummary.compactGpuSummaryStatus ?? null,
          compactReadbackByteLength: step.compactGpuSummary.compactReadbackByteLength ?? null,
          activeGridDispatchPlan: step.compactGpuSummary.activeGridDispatchPlan
            ? { ...step.compactGpuSummary.activeGridDispatchPlan }
            : null,
          timing: step.compactGpuSummary.timing ? {
            ...step.compactGpuSummary.timing,
            totalMs: finiteOrNull(step.compactGpuSummary.timing.totalMs),
            mapAsyncWaitMs: finiteOrNull(step.compactGpuSummary.timing.mapAsyncWaitMs),
            compactReadbackByteLength: finiteOrNull(step.compactGpuSummary.timing.compactReadbackByteLength)
          } : null
        } : null,
        g2pDebug: summarizeG2p(step.g2pReconstruction),
        thermalMechanicsRefreshStatus: step.thermalMechanicsRefreshStatus ?? null,
        residentActiveGridDispatchPlanHintStatus: step.residentActiveGridDispatchPlanHintStatus ?? null,
        residentActiveGridDispatchPlanHintSource: step.residentActiveGridDispatchPlanHintSource ?? null,
        residentActiveGridDispatchPlanHintDispatchArgsBufferByteLength: step.residentActiveGridDispatchPlanHintDispatchArgsBufferByteLength ?? 0,
        residentActiveGridDispatchPlanHintMetadataBufferByteLength: step.residentActiveGridDispatchPlanHintMetadataBufferByteLength ?? 0,
        nextUploadActiveGridDispatchPlanHintStatus: step.nextParticleUploads?.activeGridDispatchPlanHint?.status ?? null,
        nextUploadActiveGridDispatchPlanHintSource: step.nextParticleUploads?.activeGridDispatchPlanHint?.source ?? null,
        nextUploadActiveGridDispatchPlanHintDispatchArgsBufferByteLength: step.nextParticleUploads?.activeGridDispatchPlanHint?.dispatchArgsBufferByteLength ?? 0,
        nextUploadActiveGridDispatchPlanHintMetadataBufferByteLength: step.nextParticleUploads?.activeGridDispatchPlanHint?.metadataBufferByteLength ?? 0,
        residentProductMassStatus: step.residentProductMassStatus ?? null,
        residentProductMassProductEventRowCount:
          step.residentProductMassProductEventRowCount ?? null,
        residentProductMassGridCouplingStatus:
          step.residentProductMassGridCouplingStatus ?? null,
        residentProductMassInputProductEventCountAuthority:
          step.residentProductMassInputProductEventCountAuthority ?? null,
        residentProductMassInputProductEventRowCapacity:
          step.residentProductMassInputProductEventRowCapacity ?? null,
        residentProductMassInputProductEventCountHostKnown:
          step.residentProductMassInputProductEventCountHostKnown ?? null,
        residentProductMassProductEventDispatchMode:
          step.residentProductMassProductEventDispatchMode ?? null,
        pressureInterfaceForceSolverSchema: step.pressureInterfaceForceSolverSchema ?? null,
        pressureInterfaceForceRowsBufferStatus: step.pressureInterfaceForceRowsBufferStatus ?? null
      } : null;
      const sample = ({
        batchIndex,
        phase,
        batchMs = null,
        execution = null,
        initial = null,
        error = null
      }) => ({
        batchIndex,
        phase,
        capturedAtMs: performance.now(),
        batchMs,
        probeMode: 'direct-resident',
        initial,
        error,
        residentSteps: summarizeSteps(execution),
        residentStep: summarizeStep(execution?.finalStep || null),
        renderState: null,
        surfaceDraw: null,
        surfaces: {
          status: 'not-sampled-direct-resident',
          totalCount: 0,
          visibleCount: 0,
          h2oVisibleCount: 0,
          visible: []
        }
      });

      const [
        { createSphPhaseDemo },
        { createSphPhaseViewState },
        { createSphPhaseScenario },
        { requestOpticalGpuDevice },
        {
          uploadSphGpuParticleBuffers,
          uploadMlsMpmGpuParticleBuffers,
          destroySphGpuParticleBuffers,
          destroyMlsMpmGpuParticleBuffers
        },
        { sphStaticTableInputsFromViewState },
        { buildMlsMpmMechanicsMaterialTable },
        {
          uploadSphThermalResponseGraphBuffers,
          destroySphThermalResponseGraphBuffers
        },
        { runMlsMpmResidentStepsWithOptionalWebGpu, destroyMlsMpmResidentStepsBuffers }
      ] = await Promise.all([
        import('/src/runtime/sphPhaseDemo.js'),
        import('/src/runtime/sphPhaseViewState.js'),
        import('/src/runtime/thermoPreflight.js'),
        import('/src/runtime/material/opticalGpuBuffers.js'),
        import('/src/runtime/sph/sphGpuBuffers.js'),
        import('/src/runtime/sph/sphStaticTableInputs.js'),
        import('/src/runtime/sph/sphMechanicsMaterialTable.js'),
        import('/src/runtime/sph/sphThermalGpuKernel.js'),
        import('/src/runtime/sph/sphMlsMpmGpuStep.js')
      ]);

      const params = paramsFromUrl(requestedScenarioUrl);
      const lawEnabled = (key, fallback = true) => {
        const value = params.get(key);
        if (value == null || value === '') return fallback;
        return !/^(0|false|off|no)$/i.test(String(value).trim());
      };
      const physicalLawGroups = {
        mechanics: lawEnabled('lawmech'),
        gravity: lawEnabled('lawg'),
        eos: lawEnabled('laweos'),
        pressure: lawEnabled('lawp'),
        thermal: lawEnabled('lawt'),
        reactions: lawEnabled('lawr'),
        viscosity: lawEnabled('lawv', true),
        surfaceTension: lawEnabled('lawst', false)
      };
      const wallFaces = {
        xMin: finiteNumber(params.get('wxmin'), defaults.wallTemperatureK),
        xMax: finiteNumber(params.get('wxmax'), defaults.wallTemperatureK),
        yMin: finiteNumber(params.get('wymin'), defaults.wallTemperatureK),
        yMax: finiteNumber(params.get('wymax'), defaults.wallTemperatureK),
        zMin: finiteNumber(params.get('wzmin'), defaults.wallTemperatureK),
        zMax: finiteNumber(params.get('wzmax'), defaults.wallTemperatureK)
      };
      const boxDimensionsM = [
        finiteNumber(params.get('boxx'), defaults.boxDimsM[0]),
        finiteNumber(params.get('boxy'), defaults.boxDimsM[1]),
        finiteNumber(params.get('boxz'), defaults.boxDimsM[2])
      ].map((value, index) => value > 0 ? value : defaults.boxDimsM[index]);
      const driverOptions = {
        scenario: createSphPhaseScenario({ wallFaces, boxDimensionsM }),
        dropMaterial: params.get('drop') || 'h2o',
        baseMaterial: params.get('base') || 'h2o',
        dropTemperatureK: finiteNumber(params.get('dropt'), defaults.dropTemperatureK),
        baseTemperatureK: finiteNumber(params.get('baset'), defaults.baseTemperatureK),
        iceBaseHeightM: finiteNumber(params.get('iceh'), defaults.iceBaseHeightM),
        ironBaseHeightM: finiteNumber(params.get('ironh'), defaults.ironBaseHeightM),
        dropParticleEdge: positiveInteger(params.get('dropn'), defaults.dropParticleEdge),
        baseParticleEdge: positiveInteger(params.get('basen'), defaults.baseParticleEdge),
        mechanics: normalizedMechanicsMode(params.get('mech') ?? params.get('mechanics')),
        physicalLawGroups,
        // Match the interactive mount's explicitly admitted reaction-product
        // tier. Without this, direct probes derived molecular NaOH while the
        // live scene used the reduced liquid-only product closure.
        allowReducedProductProperties: true,
        ...(() => {
          const value = finiteOrNull(params.get('sdt'));
          return value != null && value > 0 && value <= 0.01 ? { dt: value } : {};
        })(),
        ...(() => {
          const value = finiteOrNull(params.get('cfl'));
          return value != null && value > 0 && value <= 2 ? { gridCflFactor: value } : {};
        })(),
        ...(() => {
          const value = finiteOrNull(params.get('cflSafety'));
          return value != null && value > 0 && value <= 2 ? { cflSafety: value } : {};
        })(),
        ...(() => {
          const value = finiteOrNull(params.get('avAlpha'));
          return value != null && value >= 0 && value <= 10
            ? { mlsMpmArtificialViscosityAlpha: value }
            : {};
        })(),
        ...(() => {
          const value = finiteOrNull(params.get('sep'));
          return value != null && value >= 0 && value <= 10
            ? { mlsMpmParticleSeparationRelaxation: value }
            : {};
        })(),
        ...(() => {
          const value = finiteOrNull(params.get('sepVel'));
          return value != null && value >= 0 && value <= 1
            ? { mlsMpmParticleSeparationVelocityDamping: value }
            : {};
        })()
      };

      const metrics = [];
      const errors = [];
      let execution = null;
      let previousExecution = null;
      let sphParticleUpload = null;
      let mlsMpmParticleUpload = null;
      let thermalResponseGraphUpload = null;
      let device = null;
      let directResidentCleanupQueueFence = null;
      let directResidentCleanupGpuResourceDestroySkipped = false;
      const awaitDirectResidentCleanupQueueFence = async () => {
        if (requestedMeasureGpuQueueFence) return null;
        if (!device?.queue || typeof device.queue.onSubmittedWorkDone !== 'function') {
          return {
            schema: 'peercompute.ulg.direct-resident-cleanup-queue-fence.v0',
            status: 'unavailable',
            method: null,
            reason: 'queue-on-submitted-work-done-unavailable',
            requestedMeasureGpuQueueFence
          };
        }
        const timeoutMs = 15000;
        const started = performance.now();
        let timeoutHandle = null;
        let timedOut = false;
        try {
          progress('cleanup-queue-fence-start', { timeoutMs });
          await Promise.race([
            device.queue.onSubmittedWorkDone(),
            new Promise((_, reject) => {
              timeoutHandle = setTimeout(() => {
                timedOut = true;
                reject(new Error('direct-resident-cleanup-queue-fence-timeout'));
              }, timeoutMs);
            })
          ]);
          progress('cleanup-queue-fence-complete', { durationMs: performance.now() - started });
          return {
            schema: 'peercompute.ulg.direct-resident-cleanup-queue-fence.v0',
            status: 'complete',
            method: 'queue.onSubmittedWorkDone-before-direct-resident-cleanup',
            durationMs: performance.now() - started,
            timeoutMs,
            requestedMeasureGpuQueueFence
          };
        } catch (error) {
          progress(timedOut ? 'cleanup-queue-fence-timeout' : 'cleanup-queue-fence-error', {
            durationMs: performance.now() - started,
            error: error instanceof Error ? error.message : String(error)
          });
          return {
            schema: 'peercompute.ulg.direct-resident-cleanup-queue-fence.v0',
            status: timedOut ? 'timeout' : 'error',
            method: 'queue.onSubmittedWorkDone-before-direct-resident-cleanup',
            durationMs: performance.now() - started,
            timeoutMs,
            requestedMeasureGpuQueueFence,
            error: error instanceof Error ? error.message : String(error)
          };
        } finally {
          if (timeoutHandle != null) clearTimeout(timeoutHandle);
        }
      };
      try {
        progress('setup-start', {
          batches: requestedBatches,
          batchSteps: requestedBatchSteps,
          measureGpuQueueFence: requestedMeasureGpuQueueFence
        });
        const driver = createSphPhaseDemo(driverOptions);
        const preflight = driver.preflight();
        const viewState = createSphPhaseViewState(driver);
        const directResidentPressureFeedback = Number.isFinite(
          Number(viewState.gasPressureFeedback?.externalPressurePa)
        )
          ? viewState.gasPressureFeedback
          : viewState.gasPressureSummary?.pressureFeedback;
        const directResidentAmbientPressurePa = Math.max(
          0,
          Number.isFinite(Number(directResidentPressureFeedback?.externalPressurePa))
            ? Number(directResidentPressureFeedback.externalPressurePa)
            : 0
        );
        const directResidentAmbientPressureEvidence = {
          schema: 'peercompute.ulg.mls-mpm-ambient-pressure-evidence.v0',
          status: directResidentPressureFeedback
            ? 'ambient-pressure-ready'
            : 'vacuum-default-ready',
          source: directResidentPressureFeedback
            ? 'pressure-feedback-external-pressure-pa'
            : 'vacuum-default-no-atmospheric-evidence',
          ambientPressurePa: directResidentAmbientPressurePa,
          pressureFeedbackSchema: directResidentPressureFeedback?.schema ?? null,
          pressureFeedbackStatus: directResidentPressureFeedback?.status ?? null
        };
        activeCohortRanges = cohortRangesFromCounts(viewState.counts);
        const staticTables = sphStaticTableInputsFromViewState(viewState);
        const mechanicsMaterialTable = buildMlsMpmMechanicsMaterialTable(viewState.materialProperties, {
          soundSpeedScale: viewState.gpuMechanics?.soundSpeedScale,
          minGasSoundSpeedMPerS: viewState.gpuMechanics?.minGasSoundSpeedMPerS,
          viscosityEnabled: viewState.physicalLawGroups?.viscosity,
          mlsMpmArtificialViscosityAlpha: viewState.gpuMechanics?.mlsMpmArtificialViscosityAlpha,
          viscosityLengthM: viewState.gpuMechanics?.gridSpacingM ?? viewState.sphGpuParticleState?.smoothingLengthM,
          surfaceTensionEnabled: Boolean(
            viewState.physicalLawGroups?.surfaceTension
            && viewState.physicalLawGroups?.mechanics
            && viewState.surfaceTensionLawAdmission?.admitted === true
          )
        });
        const deviceResult = await requestOpticalGpuDevice(navigator);
        progress('device-request-complete', {
          status: deviceResult?.status ?? null,
          hasDevice: Boolean(deviceResult?.device)
        });
        if (!deviceResult?.device) {
          return {
            schema: 'peercompute.ulg.sph-history-long-horizon-probe.v0',
            status: 'blocked',
            probeMode: 'direct-resident',
            reason: deviceResult?.reason || deviceResult?.status || 'WebGPU unavailable',
            deviceResult: {
              status: deviceResult?.status ?? null,
              reason: deviceResult?.reason ?? null
            },
            metrics
          };
        }
        device = deviceResult.device;
        let sphParticleState = viewState.sphGpuParticleState;
        let mlsMpmParticleState = viewState.mlsMpmGpuParticleState;
        sphParticleUpload = uploadSphGpuParticleBuffers(device, sphParticleState);
        sphParticleUpload.step = sphParticleState.step;
        sphParticleUpload.time = sphParticleState.time;
        mlsMpmParticleUpload = uploadMlsMpmGpuParticleBuffers(device, mlsMpmParticleState);
        mlsMpmParticleUpload.step = mlsMpmParticleState.step;
        mlsMpmParticleUpload.time = mlsMpmParticleState.time;
        thermalResponseGraphUpload = uploadSphThermalResponseGraphBuffers(device, {
          thermalMaterialTable: staticTables.thermalMaterialTable,
          thermalClosureGraphSet: staticTables.thermalClosureGraphSet,
          thermalClosureGraphBank: staticTables.thermalClosureGraphSet?.graphBank ?? null,
          thermalPhaseResponseTable: staticTables.thermalPhaseResponseTable
        });
        metrics.push(sample({
          batchIndex: 0,
          phase: 'initial',
          batchMs: 0,
          initial: {
            particleCount: sphParticleState.particleCount,
            dropMaterial: viewState.dropMaterial,
            baseMaterial: viewState.baseMaterial,
            counts: viewState.counts,
            initialParticleEdgeDiagnostics: viewState.initialParticleEdgeDiagnostics || null,
            cohortRanges: activeCohortRanges,
            cohortDiagnostics: cohortDiagnosticsForState(sphParticleState.state, activeCohortRanges),
            boxDimsM: viewState.box?.dimensionsM || null,
            gpuMechanics: viewState.gpuMechanics || null,
            preflight,
            initialHydrostaticState: viewState.initialHydrostaticState || null,
            physicalLawGroups,
            productClosurePolicy: 'interactive-reduced-product-properties',
            reactionProductPhases: Object.fromEntries(
              [...new Set((staticTables.reactionTable?.productTermMetadata || [])
                .map((term) => term.material)
                .filter(Boolean))]
                .map((material) => [material, {
                  phases: (viewState.materialProperties?.[material]?.phases || []).map((phase) => ({
                    name: phase.name ?? null,
                    temperatureRange: Array.isArray(phase.temperatureRange)
                      ? [...phase.temperatureRange]
                      : null
                  })),
                  transitionCount: viewState.materialProperties?.[material]?.transitions?.length ?? 0
                }])
            ),
            staticTables: {
              thermalMaterialStatus: staticTables.thermalMaterialTable?.status ?? null,
              thermalMaterialCount: staticTables.thermalMaterialTable?.materialCount ?? null,
              reactionCount: staticTables.reactionTable?.reactionCount ?? 0,
              mechanicsStatus: mechanicsMaterialTable.status,
              mechanicsPhaseRecordCount: mechanicsMaterialTable.phaseRecordCount
            },
            deviceResult: {
              status: deviceResult.status,
              requiredLimits: deviceResult.requiredLimits || null,
              adapterLimits: deviceResult.adapterLimits || null
            }
          }
        }));

        if (viewState.gpuMechanics?.integrator !== 'mlsmpm') {
          let previousStateValues = new Float32Array(sphParticleState.state);
          let finalStep = null;
          let execution = null;
          const driverStepsPerBatch = Math.max(
            1,
            Math.ceil(requestedBatchSteps / Math.max(1, Math.round(Number(viewState.gpuMechanics?.mechanicalSubsteps) || 1)))
          );
          for (let batchIndex = 1; batchIndex <= requestedBatches; batchIndex += 1) {
            const started = performance.now();
            try {
              for (let stepIndex = 0; stepIndex < driverStepsPerBatch; stepIndex += 1) driver.step();
              const nextViewState = createSphPhaseViewState(driver);
              const nextStateValues = nextViewState.sphGpuParticleState.state;
              finalStep = {
                schema: 'peercompute.ulg.plain-sph-cpu-reference-step.v0',
                backend: 'cpu-reference',
                status: 'plain-sph-cpu-reference-executed',
                readbackMode: 'cpu-reference-full-state',
                requestedReadbackMode,
                sequenceIndex: driver.demo.state.step ?? null,
                internalPressureScale: null,
                stageStatus: {
                  p2g: 'not-run-plain-sph-cpu-reference',
                  gridUpdate: 'not-run-plain-sph-cpu-reference',
                  g2p: 'not-run-plain-sph-cpu-reference',
                  plainSph: physicalLawGroups.mechanics ? 'cpu-reference-executed' : 'disabled-by-law-group',
                  thermal: physicalLawGroups.thermal ? 'cpu-driver-thermal-step' : 'disabled-by-law-group',
                  reaction: physicalLawGroups.reactions ? 'cpu-driver-reaction-step' : 'disabled-by-law-group',
                  mechanicsRefresh: 'not-run-plain-sph-cpu-reference'
                },
                stageBackends: {
                  p2g: null,
                  gridUpdate: null,
                  g2p: null,
                  plainSph: physicalLawGroups.mechanics ? 'cpu-reference' : null,
                  thermal: physicalLawGroups.thermal ? 'cpu-reference' : null,
                  reaction: physicalLawGroups.reactions ? 'cpu-reference' : null,
                  mechanicsRefresh: null
                },
                particlePingPong: {
                  sourceStep: null,
                  nextStep: nextViewState.step ?? null,
                  sourceTime: null,
                  nextTime: finiteOrNull(nextViewState.time)
                },
                diagnostics: particleDiagnosticsForState(nextStateValues, previousStateValues),
                state: nextStateValues,
                stageTiming: driver.demo.lastStepTiming ? {
                  schema: driver.demo.lastStepTiming.schema
                    ?? 'peercompute.ulg.plain-sph-cpu-reference-stage-timing.v0',
                  status: driver.demo.lastStepTiming.status ?? null,
                  kind: driver.demo.lastStepTiming.kind ?? null,
                  capabilities: driver.demo.lastStepTiming.capabilities
                    ? { ...driver.demo.lastStepTiming.capabilities }
                    : null,
                  totalMs: finiteOrNull(driver.demo.lastStepTiming.totalMs),
                  stageMs: { ...(driver.demo.lastStepTiming.stageMs || {}) },
                  stageGpuMs: driver.demo.lastStepTiming.stageGpuMs
                    ? { ...driver.demo.lastStepTiming.stageGpuMs }
                    : null,
                  stageGpuStats: driver.demo.lastStepTiming.stageGpuStats
                    ? { ...driver.demo.lastStepTiming.stageGpuStats }
                    : null,
                  queueStageGpuMs: driver.demo.lastStepTiming.queueStageGpuMs
                    ? { ...driver.demo.lastStepTiming.queueStageGpuMs }
                    : null,
                  queueStageGpuStats:
                    driver.demo.lastStepTiming.queueStageGpuStats
                      ? { ...driver.demo.lastStepTiming.queueStageGpuStats }
                      : null,
                  queueStageGpuSummaryStatus:
                    driver.demo.lastStepTiming.queueStageGpuSummaryStatus
                      ?? null,
                  queueStageGpuRecorderSchema:
                    driver.demo.lastStepTiming.queueStageGpuRecorderSchema
                      ?? null,
                  queueStageGpuRecorderKind:
                    driver.demo.lastStepTiming.queueStageGpuRecorderKind
                      ?? null,
                  queueStageGpuRecorderCapabilities:
                    driver.demo.lastStepTiming.queueStageGpuRecorderCapabilities
                      ? {
                          ...driver.demo.lastStepTiming
                            .queueStageGpuRecorderCapabilities
                        }
                      : null,
                  requestedReadbackMode,
                  compactSummaryRequested: false,
                  thermalRequested: physicalLawGroups.thermal,
                  mechanicsRefreshRequested: false,
                  reactionRequested: physicalLawGroups.reactions
                } : null,
                thermalMechanicsRefreshStatus: null,
                pressureInterfaceForceSolverSchema: null,
                pressureInterfaceForceRowsBufferStatus: null
              };
              execution = {
                schema: 'peercompute.ulg.plain-sph-cpu-reference-steps.v0',
                backend: 'cpu-reference',
                status: 'plain-sph-cpu-reference-steps-executed',
                stepCount: driverStepsPerBatch,
                completedStepCount: driverStepsPerBatch,
                compactSummaryMode: 'not-run-cpu-reference',
                readbackMode: 'cpu-reference-full-state',
                requestedReadbackMode,
                retainedIntermediateStepCount: 0,
                nextParticleUploads: null,
                nextSphParticleState: nextViewState.sphGpuParticleState,
                nextMlsMpmParticleState: nextViewState.mlsMpmGpuParticleState,
                nextParticleBufferMode: 'cpu-reference-driver-state',
                normalHotLoopReadbackFree: false,
                renderStateReadbackAvailable: false,
                residentAuthorityLedgerStatus: 'not-run-plain-sph-cpu-reference',
                residentAuthorityFamilyOwners: null,
                residentAuthorityWarnings: [
                  'plain-sph-reference-mode-not-gpu-resident',
                  'plain-sph-reference-mode-not-authoritative-mls-mpm'
                ],
                residentAuthorityBlockers: [],
                finalStep
              };
              metrics.push(sample({
                batchIndex,
                phase: 'plain-sph-cpu-reference-batch',
                batchMs: performance.now() - started,
                execution
              }));
              sphParticleState = nextViewState.sphGpuParticleState;
              mlsMpmParticleState = nextViewState.mlsMpmGpuParticleState;
              previousStateValues = new Float32Array(nextStateValues);
            } catch (error) {
              const item = {
                batchIndex,
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack || null : null
              };
              errors.push(item);
              metrics.push(sample({
                batchIndex,
                phase: 'plain-sph-cpu-reference-error',
                batchMs: performance.now() - started,
                execution,
                error: item
              }));
              break;
            }
          }
          return {
            schema: 'peercompute.ulg.sph-history-long-horizon-probe.v0',
            status: errors.length ? 'completed-with-errors' : 'complete',
            probeMode: 'direct-resident',
            mechanicsIntegrator: viewState.gpuMechanics?.integrator,
            batchCount: requestedBatches,
            batchStepCount: requestedBatchSteps,
            driverStepsPerBatch,
            requestedSubsteps: requestedBatches * requestedBatchSteps,
            readbackMode: 'cpu-reference-full-state',
            thermalWallRateOverride: Number.isFinite(requestedThermalWallRate) ? requestedThermalWallRate : null,
            renderEveryBatches: 0,
            errors,
            metrics,
            limitations: [
              'plain SPH reference mode bypasses resident WebGPU MLS-MPM',
              'plain SPH reference mode bypasses the Three.js scene and marching-cubes visual sampler',
              'plain SPH reference mode is diagnostic, not authoritative distributed mutation'
            ],
            scientificValidation: false,
            sphValidation: false,
            phaseChangeValidation: false,
            fullPhysicsValidation: false
          };
        }

        for (let batchIndex = 1; batchIndex <= requestedBatches; batchIndex += 1) {
          const started = performance.now();
          try {
            previousExecution = execution;
            progress('resident-batch-start', { batchIndex });
            execution = await runMlsMpmResidentStepsWithOptionalWebGpu({
              sphParticleState,
              mlsMpmParticleState,
              sphParticleUpload,
              mlsMpmParticleUpload,
              gridSpacingM: viewState.gpuMechanics?.gridSpacingM,
              boxDimsM: viewState.box?.dimensionsM || defaults.boxDimsM,
              dt: physicalLawGroups.mechanics ? viewState.gpuMechanics?.dt : 0,
              gravityMPerS2: physicalLawGroups.gravity ? viewState.gpuMechanics?.gravityMPerS2 : [0, 0, 0],
              internalPressureScale: physicalLawGroups.eos ? 1 : 0,
              ambientPressurePa: directResidentAmbientPressurePa,
              cflFactor: viewState.gpuMechanics?.gridCflFactor,
              preferWebGpu: true,
              navigatorRef: navigator,
              device,
              deviceResult,
              readbackMode: requestedReadbackMode,
              compactSummaryScope: requestedCompactSummaryScope,
              thermalMaterialTable: physicalLawGroups.thermal ? staticTables.thermalMaterialTable : null,
              mechanicsMaterialTable,
              thermalStepOptions: {
                thermalClosureGraphSet: staticTables.thermalClosureGraphSet,
                thermalClosureGraphBank: staticTables.thermalClosureGraphSet?.graphBank ?? null,
                thermalPhaseResponseTable: staticTables.thermalPhaseResponseTable,
                thermalResponseGraphUpload,
                wallTemperaturesK: wallFaces,
                ...(Number.isFinite(requestedThermalWallRate) ? { wallRate: requestedThermalWallRate } : {})
              },
              reactionTable: physicalLawGroups.reactions ? staticTables.reactionTable : null,
              reactionStepOptions: {
                thermalClosureGraphSet: staticTables.thermalClosureGraphSet,
                thermalClosureGraphBank: staticTables.thermalClosureGraphSet?.graphBank ?? null,
                thermalPhaseResponseTable: staticTables.thermalPhaseResponseTable,
                thermalResponseGraphUpload,
                wallTemperaturesK: wallFaces,
                ...(Number.isFinite(requestedThermalWallRate) ? { wallRate: requestedThermalWallRate } : {})
              },
              cohortRanges: activeCohortRanges,
              stepCount: requestedBatchSteps,
              compactSummaryMode: requestedCompactSummaryMode,
              retainIntermediateSteps: false,
              fuseNoFullResidentMechanicsSequence: requestedFuseResidentMechanicsSequence,
              fuseNoFullResidentMechanicsActiveGrid: requestedFuseResidentMechanicsActiveGrid,
              activeGridSafetyCells: requestedFusedActiveGridSafetyCells,
              activeGridDispatchPlanRefreshMode: requestedActiveGridDispatchPlanRefreshMode,
              measureFusedSequenceQueueFence: requestedMeasureGpuQueueFence,
              contactKinematicsParticleBinMetadataReadback:
                Boolean(requestedContactBinMetadataReadback),
              reactionParticleBinMetadataReadback:
                Boolean(requestedReactionBinMetadataReadback)
            });
            execution.ambientPressurePa = directResidentAmbientPressurePa;
            execution.ambientPressureSource = directResidentAmbientPressureEvidence.source;
            execution.ambientPressureEvidence = directResidentAmbientPressureEvidence;
            if (execution.finalStep) {
              execution.finalStep.ambientPressureSource =
                directResidentAmbientPressureEvidence.source;
              execution.finalStep.ambientPressureEvidence =
                directResidentAmbientPressureEvidence;
            }
            progress('resident-batch-execution-complete', {
              batchIndex,
              elapsedMs: performance.now() - started,
              status: execution?.status ?? null,
              queueFenceStatus:
                execution?.finalStep?.stageTiming?.queueFenceStatus?.fusedMechanicsSequence ?? null
            });
            metrics.push(sample({
              batchIndex,
              phase: 'resident-batch',
              batchMs: performance.now() - started,
              execution
            }));
            progress('resident-batch-sample-complete', {
              batchIndex,
              elapsedMs: performance.now() - started
            });
            sphParticleState = execution.nextSphParticleState;
            mlsMpmParticleState = execution.nextMlsMpmParticleState;
            sphParticleUpload = execution.nextParticleUploads?.sphParticleUpload ?? null;
            mlsMpmParticleUpload = execution.nextParticleUploads?.mlsMpmParticleUpload ?? null;
            if (previousExecution) {
              const activeGridPlanBuffers = (hint = null) => [
                hint?.dispatchArgsBuffer,
                hint?.metadataBuffer
              ].filter(Boolean);
              destroyMlsMpmResidentStepsBuffers(previousExecution, {
                preserveBuffers: [
                  sphParticleUpload?.stateBuffer,
                  sphParticleUpload?.thermoBuffer,
                  mlsMpmParticleUpload?.mechanicsBuffer,
                  ...activeGridPlanBuffers(execution.nextParticleUploads?.activeGridDispatchPlanHint),
                  ...activeGridPlanBuffers(execution.nextSphParticleState?.residentActiveGridDispatchPlanHint)
                ].filter(Boolean)
              });
            }
          } catch (error) {
            const item = {
              batchIndex,
              message: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack || null : null
            };
            errors.push(item);
            metrics.push(sample({
              batchIndex,
              phase: 'resident-batch-error',
              batchMs: performance.now() - started,
              execution,
              error: item
            }));
            break;
          }
        }
      } finally {
        directResidentCleanupQueueFence = await awaitDirectResidentCleanupQueueFence();
        directResidentCleanupGpuResourceDestroySkipped =
          directResidentCleanupQueueFence?.status === 'timeout'
          || directResidentCleanupQueueFence?.status === 'error';
        if (!directResidentCleanupGpuResourceDestroySkipped) {
          progress('cleanup-destroy-start');
          if (previousExecution && previousExecution !== execution) {
            destroyMlsMpmResidentStepsBuffers(previousExecution);
          }
          if (execution) {
            destroyMlsMpmResidentStepsBuffers(execution);
          } else {
            destroySphGpuParticleBuffers(sphParticleUpload);
            destroyMlsMpmGpuParticleBuffers(mlsMpmParticleUpload);
          }
          destroySphThermalResponseGraphBuffers(thermalResponseGraphUpload);
          device?.destroy?.();
          progress('cleanup-destroy-complete');
        }
      }

      progress('returning-timeline', {
        status: errors.length ? 'completed-with-errors' : 'complete',
        metricCount: metrics.length,
        cleanupQueueFenceStatus: directResidentCleanupQueueFence?.status ?? null
      });
      return {
        schema: 'peercompute.ulg.sph-history-long-horizon-probe.v0',
        status: errors.length ? 'completed-with-errors' : 'complete',
        probeMode: 'direct-resident',
        batchCount: requestedBatches,
        batchStepCount: requestedBatchSteps,
        requestedSubsteps: requestedBatches * requestedBatchSteps,
        readbackMode: requestedReadbackMode,
        compactSummaryMode: requestedCompactSummaryMode,
        compactSummaryScope: requestedCompactSummaryScope,
        fuseResidentMechanicsSequence: requestedFuseResidentMechanicsSequence,
        fuseResidentMechanicsActiveGrid: requestedFuseResidentMechanicsActiveGrid,
        fusedActiveGridSafetyCells: requestedFusedActiveGridSafetyCells ?? null,
        activeGridDispatchPlanRefreshMode: requestedActiveGridDispatchPlanRefreshMode,
        measureGpuQueueFence: requestedMeasureGpuQueueFence,
        directResidentCleanupQueueFence,
        directResidentCleanupGpuResourceDestroySkipped,
        contactBinMetadataReadback: Boolean(requestedContactBinMetadataReadback),
        reactionBinMetadataReadback: Boolean(requestedReactionBinMetadataReadback),
        thermalWallRateOverride: Number.isFinite(requestedThermalWallRate) ? requestedThermalWallRate : null,
        renderEveryBatches: 0,
        errors,
        metrics,
        limitations: [
          'direct-resident bypasses the Three.js scene and marching-cubes visual sampler',
          'direct-resident does not build scene-derived pressure-interface force rows'
        ],
        scientificValidation: false,
        sphValidation: false,
        phaseChangeValidation: false,
        fullPhysicsValidation: false
      };
    }, {
      scenarioUrl: target,
      batches,
      batchSteps,
      readbackMode,
      compactSummaryScope,
      compactSummaryMode,
      thermalWallRate,
      fuseResidentMechanicsSequence,
      fuseResidentMechanicsActiveGrid,
      fusedActiveGridSafetyCells,
      activeGridDispatchPlanRefreshMode,
      measureGpuQueueFence,
      contactBinMetadataReadback,
      reactionBinMetadataReadback,
      defaults: {
        wallTemperatureK: DEFAULT_WALL_TEMPERATURE_K,
        dropTemperatureK: DEFAULT_DROP_TEMPERATURE_K,
        baseTemperatureK: DEFAULT_BASE_TEMPERATURE_K,
        iceBaseHeightM: DEFAULT_ICE_BASE_HEIGHT_M,
        ironBaseHeightM: DEFAULT_IRON_BASE_HEIGHT_M,
        boxDimsM: DEFAULT_BOX_DIMS_M,
        dropParticleEdge: DEFAULT_DROP_PARTICLE_EDGE,
        baseParticleEdge: DEFAULT_BASE_PARTICLE_EDGE,
        directResidentProgressLog: process.env.ULG_PROBE_DIRECT_RESIDENT_PROGRESS === '1'
      }
    });
    completedTimeline = attachBrowserConsoleTelemetry(timeline, consoleCapture);
    return completedTimeline;
  } finally {
    if (browser !== null) {
      await closeOwnedProbeBrowser(browser);
      if (completedTimeline !== null) {
        completedTimeline.browserLifecycle = {
          ownership: 'probe-launched-isolated-browser',
          closeStatus: 'closed'
        };
      }
    }
  }
}

export function analyzeTimeline(timeline, {
  maxSpeedMPerS,
  minVolumeRatioJ,
  maxVolumeRatioJ,
  expectStatic = false,
  staticMaxDisplacementM = 1e-6,
  staticMaxCenterOfMassDeltaM = 1e-6,
  expectLiquidMerge = false,
  expectLiquidSettled = false,
  expectLiquidFreeSurface = false,
  liquidMergeMaxFinalSupportGapM = 0.005,
  liquidSettledMinTimeS = 1,
  liquidSettledMaxFinalDropSpeedMPerS = 0.25,
  liquidFreeSurfaceMinTimeS = 0.25,
  liquidFreeSurfaceMaxTallnessRatio = 0.75,
  liquidFreeSurfaceMinFootprintFillRatio = 0.15,
  liquidFreeSurfaceMaxHeightM = null,
  expectedH2oVisibleSurfaceCount = null,
  expectedMaterialPresent = [],
  expectedMaterialAbsent = [],
  minReactionEventsTotal = null,
  minVisualFrameTimeSpanS = null,
  visualOnly = false,
  boxDimsM = DEFAULT_BOX_DIMS_M,
  scenarioUrl = DEFAULT_URL,
  visibleBoundsToleranceM = 0.05,
  particleBoundsToleranceM = 0.2
} = {}) {
  const metrics = Array.isArray(timeline?.metrics) ? timeline.metrics : [];
  const directResident = timeline?.probeMode === 'direct-resident';
  const expectedLiquidH2oSameMaterial = isExpectedLiquidH2oSameMaterialScenario(scenarioUrl);
  const h2oMaterialExpected = scenarioIncludesH2oMaterial(scenarioUrl);
  const initialPreflight = metrics.find((metric) => metric.initial?.preflight)?.initial?.preflight ?? null;
  const initialPreflightBlockers = Array.isArray(initialPreflight?.blockers)
    ? initialPreflight.blockers
    : [];
  const baseDropGeometryPair = Array.isArray(initialPreflight?.initialGeometry?.pairs)
    ? initialPreflight.initialGeometry.pairs.find((pair) => (
        Array.isArray(pair?.roles)
        && pair.roles.includes('base')
        && pair.roles.includes('drop')
      )) ?? null
    : null;
  const initialCenterGapYM = finiteNumber(baseDropGeometryPair?.centerGapYM, null);
  const initialSupportGapYM = finiteNumber(baseDropGeometryPair?.supportGapYM, null);
  const centerToSupportGapOffsetYM = Number.isFinite(initialCenterGapYM) && Number.isFinite(initialSupportGapYM)
    ? initialCenterGapYM - initialSupportGapYM
    : null;
  const diagnostics = metrics.map((metric) => metric.residentStep?.diagnostics).filter(Boolean);
  const finiteMetric = (value) => {
    if (value == null || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  };
  const exactNonNegativeInteger = (value) => (
    typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= 0
      ? value
      : null
  );
  const finalMetric = metrics.at(-1) || null;
  const finalResidentStepReceipt = finalMetric?.residentStep || null;
  const finalResidentStepsReceipt = finalMetric?.residentSteps || null;
  const residentStepReceiptValue = (key) => (
    finalResidentStepReceipt?.[key]
    ?? finalResidentStepsReceipt?.[key]
    ?? null
  );
  const productHistoryP2gGpuCountReceipt = {
    gridCouplingStatus: residentStepReceiptValue(
      'residentProductMassGridCouplingStatus'
    ),
    countAuthority: residentStepReceiptValue(
      'residentProductMassInputProductEventCountAuthority'
    ),
    rowCapacity: exactNonNegativeInteger(residentStepReceiptValue(
      'residentProductMassInputProductEventRowCapacity'
    )),
    countHostKnown: residentStepReceiptValue(
      'residentProductMassInputProductEventCountHostKnown'
    ),
    dispatchMode: residentStepReceiptValue(
      'residentProductMassProductEventDispatchMode'
    )
  };
  const productHistoryP2gGpuCountReceiptRequired =
    productHistoryP2gGpuCountReceipt.gridCouplingStatus
      === 'resident-product-mass-bound-to-p2g-grid';
  const productHistoryP2gGpuCountReceiptAccepted =
    productHistoryP2gGpuCountReceiptRequired
      ? Boolean(
          productHistoryP2gGpuCountReceipt.countAuthority
            === 'gpu-authored-filtered-live-prefix'
          && productHistoryP2gGpuCountReceipt.rowCapacity > 0
          && productHistoryP2gGpuCountReceipt.countHostKnown === false
          && productHistoryP2gGpuCountReceipt.dispatchMode
            === 'gpu-authored-indirect-live-count'
        )
      : null;
  const finalRenderStateReceipt = finalMetric?.renderState || null;
  const productHistoryRenderCommitGateReceipt = {
    residentProductMassStatus:
      finalRenderStateReceipt?.residentProductMassStatus ?? null,
    productEventBufferBound:
      finalRenderStateReceipt?.productEventBufferBound ?? null,
    productEventBufferByteLength: exactNonNegativeInteger(
      finalRenderStateReceipt?.productEventBufferByteLength
    ),
    countAuthority:
      finalRenderStateReceipt?.productEventCountAuthority ?? null,
    controlAuthentication:
      finalRenderStateReceipt?.productEventControlAuthentication ?? null,
    controlHostObserved:
      finalRenderStateReceipt?.productEventControlHostObserved ?? null,
    rowCapacity: exactNonNegativeInteger(
      finalRenderStateReceipt?.productEventRowCapacity
    ),
    countHostKnown:
      finalRenderStateReceipt?.productEventCountHostKnown ?? null,
    generation: exactNonNegativeInteger(
      finalRenderStateReceipt?.productEventCountAuthorityGeneration
    ),
    seal: exactNonNegativeInteger(
      finalRenderStateReceipt?.productEventCountAuthoritySeal
    )
  };
  const productHistoryRenderCommitGateReceiptRequired = Boolean(
    productHistoryRenderCommitGateReceipt.residentProductMassStatus
      === 'resident-product-mass-merged-gpu-resident'
    && productHistoryRenderCommitGateReceipt.productEventBufferBound === true
  );
  const productHistoryRenderCommitGateReceiptAccepted =
    productHistoryRenderCommitGateReceiptRequired
      ? Boolean(
          productHistoryRenderCommitGateReceipt.productEventBufferByteLength > 0
          && productHistoryRenderCommitGateReceipt.countAuthority
            === 'gpu-authored-filtered-live-prefix'
          && productHistoryRenderCommitGateReceipt.controlAuthentication
            === 'full-eight-word-gpu-commit-gate'
          && productHistoryRenderCommitGateReceipt.controlHostObserved === false
          && productHistoryRenderCommitGateReceipt.rowCapacity > 0
          && productHistoryRenderCommitGateReceipt.countHostKnown === false
          && productHistoryRenderCommitGateReceipt.generation !== null
          && productHistoryRenderCommitGateReceipt.seal !== null
        )
      : null;
  const finiteSeries = (key) => diagnostics
    .map((diagnostic) => finiteMetric(diagnostic?.[key]))
    .filter(Number.isFinite);
  const capturedCheckpointRows = metrics
    .map((metric) => metric?.authoritativeGpuCheckpoint)
    .filter((checkpoint) => (
      checkpoint?.status === 'captured'
      && Array.isArray(checkpoint.materialPhases)
    ));
  const checkpointSpeedRows = capturedCheckpointRows
    .filter((checkpoint) => checkpoint.speedEvidenceStatus === 'complete')
    .flatMap((checkpoint) => checkpoint.materialPhases);
  const checkpointMechanicsRows = capturedCheckpointRows
    .flatMap((checkpoint) => checkpoint.materialPhases)
    .filter((row) => (
      Number(row?.mechanicsSampleCount) > 0
      && Number(row?.mechanicsProblemParticleCount) === 0
    ));
  const checkpointMaxSpeedSeries = checkpointSpeedRows
    .map((row) => finiteMetric(row?.maxSpeedMPerS))
    .filter(Number.isFinite);
  const checkpointMinVolumeSeries = checkpointMechanicsRows
    .map((row) => finiteMetric(row?.minVolumeRatioJ))
    .filter(Number.isFinite);
  const checkpointMaxVolumeSeries = checkpointMechanicsRows
    .map((row) => finiteMetric(row?.maxVolumeRatioJ))
    .filter(Number.isFinite);
  const residentMaxSpeedSeries = finiteSeries('maxSpeedMPerS');
  const maxSpeedSeries = residentMaxSpeedSeries.concat(checkpointMaxSpeedSeries);
  const maxDisplacementSeries = finiteSeries('maxDisplacementM');
  const minVolumeSeries = finiteSeries('minVolumeRatioJ').concat(checkpointMinVolumeSeries);
  const maxVolumeSeries = finiteSeries('maxVolumeRatioJ').concat(checkpointMaxVolumeSeries);
  const pressureImpulseSeries = finiteSeries('pressureInterfaceAppliedImpulseMagnitudeNSeconds');
  const internalPressureScaleSeries = finiteSeries('internalPressureScale');
  const nextTimeSeries = metrics
    .map((metric) => finiteMetric(
      metric.residentSteps?.workerOwnedResidentLane?.laneSimTimeS
        ?? metric.sceneTimeS
        ?? metric.plainSphStepResult?.time
        ?? metric.residentStep?.particlePingPong?.nextTime
        ?? metric.residentSteps?.nextTime
    ))
    .filter(Number.isFinite);
  const metricTimeS = (metric) => finiteMetric(
    metric?.residentSteps?.workerOwnedResidentLane?.laneSimTimeS
      ?? metric?.sceneTimeS
      ?? metric?.plainSphStepResult?.time
      ?? metric?.residentStep?.particlePingPong?.nextTime
      ?? metric?.residentSteps?.nextTime
  );
  const finiteVector3 = (value) => {
    if (!Array.isArray(value) || value.length < 3) return null;
    const vector = value.slice(0, 3).map((entry) => finiteMetric(entry));
    return vector.every(Number.isFinite) ? vector : null;
  };
  const vectorDistanceM = (a, b) => {
    const av = finiteVector3(a);
    const bv = finiteVector3(b);
    if (!av || !bv) return null;
    return Math.hypot(av[0] - bv[0], av[1] - bv[1], av[2] - bv[2]);
  };
  const boundsCenterM = (bounds) => {
    const min = finiteVector3(bounds?.min);
    const max = finiteVector3(bounds?.max);
    if (!min || !max) return null;
    return min.map((value, axis) => 0.5 * (value + max[axis]));
  };
  const vectorMaxAxisDeltaM = (a, b) => {
    const av = finiteVector3(a);
    const bv = finiteVector3(b);
    if (!av || !bv) return null;
    return Math.max(...av.map((value, axis) => Math.abs(value - bv[axis])));
  };
  const visualFrameTimesS = (Array.isArray(timeline?.visualFrames) ? timeline.visualFrames : [])
    .map((frame) => metricTimeS(metrics[Number(frame?.sampleIndex)]))
    .filter(Number.isFinite);
  const visualFrameTimeSpanS = visualFrameTimesS.length >= 2
    ? Math.max(...visualFrameTimesS) - Math.min(...visualFrameTimesS)
    : null;
  const capturedVisualFrames = (Array.isArray(timeline?.visualFrames) ? timeline.visualFrames : [])
    .filter((frame) => frame?.status === 'captured');
  const requestedSurfaceDrawMode = String(timeline?.surfaceDrawDiagnosticMode || '').toLowerCase();
  const pngAnalyzedVisualFrames = capturedVisualFrames.filter((frame) => frame?.png?.status === 'ready');
  const pngAnalyzedCanvasFrames = pngAnalyzedVisualFrames.filter((frame) => (
    String(frame?.captureSource || '').includes('canvas')
  ));
  const blankVisualFrameCount = pngAnalyzedVisualFrames
    .filter((frame) => frame.blankFrame === true || frame.png?.hasVisiblePixels === false)
    .length;
  const blankCanvasFrameCount = pngAnalyzedCanvasFrames
    .filter((frame) => !(
      frame.png?.hasVisiblePixels === true
      && frame.png?.hasSurfaceLikeVariation === true
    ))
    .length;
  const nonblankVisualFrameCount = pngAnalyzedVisualFrames
    .filter((frame) => frame.png?.hasVisiblePixels === true)
    .length;
  const nonblankCanvasFrameCount = pngAnalyzedCanvasFrames
    .filter((frame) => (
      frame.png?.hasVisiblePixels === true
      && frame.png?.hasSurfaceLikeVariation === true
    ))
    .length;
  const browserCanvasPixelValidated = nonblankCanvasFrameCount > 0;
  const nativeBrowserFrameValidation = timeline?.nativeSurfaceBrowserFrameValidation || null;
  const nativeBrowserFramePublishStatus =
    nativeBrowserFrameValidation?.publishStatus || null;
  const nativeBrowserFrameMetric = finalMetric;
  const nativeBrowserFrameActiveGeneration = exactNonNegativeInteger(
    nativeBrowserFrameMetric?.surfaceDraw
      ?.surfaceDrawVisibleGpuConsumerNativeActiveResourceGeneration
    ?? nativeBrowserFrameMetric?.renderState
      ?.surfaceDrawVisibleGpuConsumerNativeActiveResourceGeneration
  );
  const nativeBrowserFramePublishedGeneration = exactNonNegativeInteger(
    nativeBrowserFramePublishStatus?.resourceGeneration
  );
  const nativeBrowserFrameNonzeroPixelCount = exactNonNegativeInteger(
    nativeBrowserFramePublishStatus?.nonzeroPixelCount
  );
  const nativeBrowserFramePixelValidated = Boolean(
    nativeBrowserFrameValidation?.status === 'passed'
    && nativeBrowserFramePublishStatus?.status
      === 'browser-frame-validation-passed'
    && /browser-frame|playwright.*canvas|composited-frame/iu.test(
      String(nativeBrowserFramePublishStatus?.source ?? '')
    )
    && nativeBrowserFrameNonzeroPixelCount !== null
    && nativeBrowserFrameNonzeroPixelCount > 0
    && nativeBrowserFrameActiveGeneration !== null
    && nativeBrowserFramePublishedGeneration
      === nativeBrowserFrameActiveGeneration
  );
  const nativeBrowserSurfaceProofAccepted = Boolean(
    requestedSurfaceDrawMode === 'native-webgpu-surface-consumer'
    && nativeBrowserFramePixelValidated
  );
  const visibleGpuConsumerBrowserPixelValidated =
    requestedSurfaceDrawMode === 'native-webgpu-surface-consumer'
      ? nativeBrowserFramePixelValidated
      : browserCanvasPixelValidated;
  const nextCenterOfMassYSeries = diagnostics
    .map((diagnostic) => finiteMetric(diagnostic?.nextCenterOfMassM?.[1]))
    .filter(Number.isFinite);
  const nextMinYSeries = diagnostics
    .map((diagnostic) => finiteMetric(diagnostic?.nextPositionBoundsM?.min?.[1]))
    .filter(Number.isFinite);
  const nextMaxYSeries = diagnostics
    .map((diagnostic) => finiteMetric(diagnostic?.nextPositionBoundsM?.max?.[1]))
    .filter(Number.isFinite);
  const cohortReady = (diagnostic) => (
    diagnostic?.drop?.status === 'cohort-summary-ready'
    || diagnostic?.base?.status === 'cohort-summary-ready'
  );
  const metricCohortDiagnostics = (metric) => (
    metric?.residentStep?.cohortDiagnostics
    ?? metric?.residentStep?.diagnostics?.cohortDiagnostics
    ?? null
  );
  const residentCohortDiagnostics = metrics
    .map((metric) => metricCohortDiagnostics(metric))
    .filter(cohortReady);
  const cohortDiagnostics = residentCohortDiagnostics.length > 0
    ? metrics
        .map((metric) => metricCohortDiagnostics(metric) ?? metric.initial?.cohortDiagnostics)
        .filter(cohortReady)
    : [];
  const dropCenterYSeries = cohortDiagnostics
    .map((diagnostic) => finiteMetric(diagnostic?.drop?.centerOfMassM?.[1]))
    .filter(Number.isFinite);
  const dropMinYSeries = cohortDiagnostics
    .map((diagnostic) => finiteMetric(diagnostic?.drop?.boundsM?.min?.[1]))
    .filter(Number.isFinite);
  const dropMaxYSeries = cohortDiagnostics
    .map((diagnostic) => finiteMetric(diagnostic?.drop?.boundsM?.max?.[1]))
    .filter(Number.isFinite);
  const dropMaxSpeedSeries = cohortDiagnostics
    .map((diagnostic) => finiteMetric(diagnostic?.drop?.maxSpeedMPerS))
    .filter(Number.isFinite);
  const dropBaseGapSeries = cohortDiagnostics
    .map((diagnostic) => {
      const dropMinY = finiteMetric(diagnostic?.drop?.boundsM?.min?.[1]);
      const baseMaxY = finiteMetric(diagnostic?.base?.boundsM?.max?.[1]);
      return Number.isFinite(dropMinY) && Number.isFinite(baseMaxY) ? dropMinY - baseMaxY : null;
    })
    .filter(Number.isFinite);
  const dropBaseSupportGapSeries = Number.isFinite(centerToSupportGapOffsetYM)
    ? dropBaseGapSeries
        .map((gap) => gap - centerToSupportGapOffsetYM)
        .filter(Number.isFinite)
    : [];
  const residentStageTimingForMetric = (metric) => (
    metric?.residentStep?.stageTiming
    ?? metric?.residentSteps?.finalStepStageTiming
    ?? metric?.residentSteps?.finalStep?.stageTiming
    ?? null
  );
  const residentStageTimings = metrics
    .map((metric) => residentStageTimingForMetric(metric))
    .filter(Boolean);
  const activeGridDispatches = residentStageTimings
    .map((stageTiming) => stageTiming?.activeGridDispatch)
    .filter((dispatch) => dispatch?.useActiveGrid === true);
  const activeNodeSeries = diagnostics
    .map((diagnostic) => finiteMetric(diagnostic?.activeGridNodeCount))
    .concat(metrics.map((metric) => finiteMetric(
      residentStageTimingForMetric(metric)?.activeGridDispatch?.activeNodeCount
        ?? metric?.residentSteps?.fusedResidentSequence?.activeGridDispatch?.activeNodeCount
    )))
    .filter(Number.isFinite);
  const maxSpeedObservedMPerS = maxSpeedSeries.length ? Math.max(...maxSpeedSeries) : null;
  const maxDisplacementObservedM = maxDisplacementSeries.length ? Math.max(...maxDisplacementSeries) : null;
  const compactSummaryDisabled = ['none', 'plan-only'].includes(timeline?.compactSummaryMode) || metrics.some((metric) => (
    metric?.residentStep?.stageTiming?.compactSummaryRequested === false
    || metric?.residentSteps?.finalStepStageTiming?.compactSummaryRequested === false
    || metric?.residentSteps?.workerOwnedResidentLane?.hierarchyStageSummary
      ?.residentStageTiming?.compactSummaryRequested === false
  ));
  const activeGridPredictedMotionSeries = activeGridDispatches
    .map((dispatch) => finiteVector3(dispatch?.predictedMotionM))
    .filter(Boolean)
    .map((vector) => Math.hypot(...vector))
    .filter(Number.isFinite);
  const activeGridPredictedSpeedSeries = activeGridDispatches
    .flatMap((dispatch) => {
      const explicitSpeed = finiteMetric(dispatch?.maxSpeedMPerS);
      const predictedMotion = finiteVector3(dispatch?.predictedMotionM);
      const predictedMotionM = predictedMotion ? Math.hypot(...predictedMotion) : null;
      const horizonS = finiteMetric(dispatch?.horizonS);
      const derivedSpeed = Number.isFinite(predictedMotionM) && Number.isFinite(horizonS) && horizonS > 0
        ? predictedMotionM / horizonS
        : null;
      return [explicitSpeed, derivedSpeed].filter(Number.isFinite);
    });
  const activeGridPredictedMaxDisplacementM = activeGridPredictedMotionSeries.length
    ? Math.max(...activeGridPredictedMotionSeries)
    : null;
  const activeGridPredictedMaxSpeedMPerS = activeGridPredictedSpeedSeries.length
    ? Math.max(...activeGridPredictedSpeedSeries)
    : null;
  const directResidentNoReadbackActiveGridMotionEvidenceAvailable = Boolean(
    directResident
    && compactSummaryDisabled
    && activeGridDispatches.length > 0
    && Number.isFinite(activeGridPredictedMaxDisplacementM)
    && activeGridPredictedMaxDisplacementM > 0
  );
  const renderRowMotionSamples = metrics
    .map((metric, index) => {
      const renderState = metric?.renderState || null;
      const positionCount = finiteMetric(renderState?.renderRowsDecodedPositionCount);
      const centerOfMassM = finiteVector3(renderState?.renderRowsDecodedCenterOfMassM);
      const positionBoundsM = renderState?.renderRowsDecodedPositionBoundsM || null;
      const centerFromBoundsM = boundsCenterM(positionBoundsM);
      const boundsSizeM = finiteVector3(positionBoundsM?.size);
      if (!centerOfMassM && !centerFromBoundsM && !boundsSizeM) return null;
      return {
        index,
        phase: metric?.phase ?? null,
        timeS: metricTimeS(metric),
        wallTimeS: finiteMetric(metric?.capturedAtMs) != null ? finiteMetric(metric.capturedAtMs) / 1000 : null,
        positionCount,
        centerOfMassM,
        centerFromBoundsM,
        boundsSizeM
      };
    })
    .filter(Boolean);
  const maxDisplacementFromFirst = (samples, key, distanceFn = vectorDistanceM) => {
    const first = samples.find((sample) => sample?.[key]);
    if (!first) return null;
    const deltas = samples
      .map((sample) => distanceFn(sample?.[key], first[key]))
      .filter(Number.isFinite);
    return deltas.length ? Math.max(...deltas) : null;
  };
  const maxConsecutiveRate = (samples, key, distanceFn = vectorDistanceM) => {
    let maxRate = null;
    let previous = null;
    for (const sample of samples) {
      if (!sample?.[key]) continue;
      if (previous?.[key]) {
        const distance = distanceFn(sample[key], previous[key]);
        const simDt = Number.isFinite(sample.timeS) && Number.isFinite(previous.timeS)
          ? sample.timeS - previous.timeS
          : null;
        const wallDt = Number.isFinite(sample.wallTimeS) && Number.isFinite(previous.wallTimeS)
          ? sample.wallTimeS - previous.wallTimeS
          : null;
        const dt = Number.isFinite(simDt) && simDt > 0
          ? simDt
          : (Number.isFinite(wallDt) && wallDt > 0 ? wallDt : null);
        if (Number.isFinite(distance) && Number.isFinite(dt) && dt > 0) {
          maxRate = Math.max(maxRate ?? 0, distance / dt);
        }
      }
      previous = sample;
    }
    return maxRate;
  };
  const authoritativeCheckpointMotionSamples = metrics
    .map((metric, index) => {
      const checkpoint = metric?.authoritativeGpuCheckpoint;
      const rows = Array.isArray(checkpoint?.materialPhases)
        ? checkpoint.materialPhases
        : [];
      const checkpointComplete = Boolean(
        checkpoint?.status === 'captured'
        && checkpoint.materialPhaseCapacityStatus === 'within-capacity'
        && checkpoint.materialMappingStatus === 'complete'
        && Number(checkpoint.phaseFractionProblemParticleCount || 0) === 0
        && Number(checkpoint.unclassifiedMassKg || 0) === 0
        && checkpoint.mechanicsEvidenceStatus === 'complete'
        && rows.length > 0
        && rows.every((row) => (
          Number(row?.mechanicsSampleCount) > 0
          && Number(row?.mechanicsProblemParticleCount) === 0
          && Number.isFinite(finiteMetric(row?.massKg))
          && finiteMetric(row?.massKg) > 0
          && Number.isFinite(finiteMetric(row?.yCenterMassWeightedM))
        ))
      );
      if (!checkpointComplete) return null;
      const totalMassKg = rows.reduce((sum, row) => sum + finiteMetric(row.massKg), 0);
      if (!(totalMassKg > 0)) return null;
      const globalMassWeightedYM = rows.reduce((sum, row) => (
        sum + finiteMetric(row.massKg) * finiteMetric(row.yCenterMassWeightedM)
      ), 0) / totalMassKg;
      const timeS = finiteMetric(checkpoint.sourceTimeS) ?? metricTimeS(metric);
      if (!Number.isFinite(globalMassWeightedYM) || !Number.isFinite(timeS)) return null;
      return {
        index,
        batchIndex: finiteMetric(checkpoint.batchIndex ?? metric?.batchIndex),
        phase: metric?.phase ?? checkpoint.phase ?? null,
        timeS,
        totalMassKg,
        globalMassWeightedYM
      };
    })
    .filter(Boolean);
  const authoritativeCheckpointGlobalMassWeightedYSeriesM =
    authoritativeCheckpointMotionSamples.map((sample) => sample.globalMassWeightedYM);
  const authoritativeCheckpointMaxGlobalYDisplacementM = (() => {
    const first = authoritativeCheckpointMotionSamples[0];
    if (!first) return null;
    return Math.max(...authoritativeCheckpointMotionSamples.map((sample) => (
      Math.abs(sample.globalMassWeightedYM - first.globalMassWeightedYM)
    )));
  })();
  const authoritativeCheckpointEstimatedMaxGlobalYSpeedMPerS = (() => {
    let maxRate = null;
    for (let index = 1; index < authoritativeCheckpointMotionSamples.length; index += 1) {
      const previous = authoritativeCheckpointMotionSamples[index - 1];
      const current = authoritativeCheckpointMotionSamples[index];
      const dtS = current.timeS - previous.timeS;
      if (!(dtS > 0)) continue;
      const rate = Math.abs(
        current.globalMassWeightedYM - previous.globalMassWeightedYM
      ) / dtS;
      if (Number.isFinite(rate)) maxRate = Math.max(maxRate ?? 0, rate);
    }
    return maxRate;
  })();
  const authoritativeCheckpointMotionEvidenceAvailable = Boolean(
    authoritativeCheckpointMotionSamples.length >= 2
    && Number.isFinite(authoritativeCheckpointMaxGlobalYDisplacementM)
    && Number.isFinite(authoritativeCheckpointEstimatedMaxGlobalYSpeedMPerS)
  );
  const renderRowMaxCenterDisplacementM = maxDisplacementFromFirst(renderRowMotionSamples, 'centerOfMassM');
  const renderRowMaxBoundsCenterDisplacementM = maxDisplacementFromFirst(renderRowMotionSamples, 'centerFromBoundsM');
  const renderRowMaxBoundsExtentDeltaM = maxDisplacementFromFirst(
    renderRowMotionSamples,
    'boundsSizeM',
    vectorMaxAxisDeltaM
  );
  const renderRowEstimatedMaxCenterSpeedMPerS = maxConsecutiveRate(renderRowMotionSamples, 'centerOfMassM');
  const renderRowEstimatedMaxBoundsCenterSpeedMPerS = maxConsecutiveRate(renderRowMotionSamples, 'centerFromBoundsM');
  const renderRowEstimatedMaxBoundsExtentRateMPerS = maxConsecutiveRate(
    renderRowMotionSamples,
    'boundsSizeM',
    vectorMaxAxisDeltaM
  );
  const renderRowMotionDisplacementsM = [
    renderRowMaxCenterDisplacementM,
    renderRowMaxBoundsCenterDisplacementM,
    renderRowMaxBoundsExtentDeltaM
  ].filter(Number.isFinite);
  const renderRowMotionSpeedsMPerS = [
    renderRowEstimatedMaxCenterSpeedMPerS,
    renderRowEstimatedMaxBoundsCenterSpeedMPerS,
    renderRowEstimatedMaxBoundsExtentRateMPerS
  ].filter(Number.isFinite);
  const renderRowMaxDisplacementM = renderRowMotionDisplacementsM.length
    ? Math.max(...renderRowMotionDisplacementsM)
    : null;
  const renderRowEstimatedMaxSpeedMPerS = renderRowMotionSpeedsMPerS.length
    ? Math.max(...renderRowMotionSpeedsMPerS)
    : null;
  const finiteMaximum = (values) => {
    const finiteValues = values.filter(Number.isFinite);
    return finiteValues.length ? Math.max(...finiteValues) : null;
  };
  const motionMaxSpeedObservedMPerS = finiteMaximum([
    maxSpeedObservedMPerS,
    authoritativeCheckpointMotionEvidenceAvailable
      ? authoritativeCheckpointEstimatedMaxGlobalYSpeedMPerS
      : null,
    compactSummaryDisabled ? renderRowEstimatedMaxSpeedMPerS : null,
    directResidentNoReadbackActiveGridMotionEvidenceAvailable
      ? activeGridPredictedMaxSpeedMPerS
      : null
  ]);
  const motionMaxDisplacementObservedM = finiteMaximum([
    maxDisplacementObservedM,
    authoritativeCheckpointMotionEvidenceAvailable
      ? authoritativeCheckpointMaxGlobalYDisplacementM
      : null,
    compactSummaryDisabled ? renderRowMaxDisplacementM : null,
    directResidentNoReadbackActiveGridMotionEvidenceAvailable
      ? activeGridPredictedMaxDisplacementM
      : null
  ]);
  const motionSpeedEvidenceSources = [];
  if (residentMaxSpeedSeries.length > 0) {
    motionSpeedEvidenceSources.push('resident-compact-summary');
  }
  if (checkpointMaxSpeedSeries.length > 0) {
    motionSpeedEvidenceSources.push('authoritative-gpu-material-phase-checkpoint');
  }
  if (authoritativeCheckpointMotionEvidenceAvailable) {
    motionSpeedEvidenceSources.push('authoritative-gpu-global-mass-weighted-y-checkpoint');
  }
  if (compactSummaryDisabled && renderRowEstimatedMaxSpeedMPerS != null) {
    motionSpeedEvidenceSources.push('decoded-render-rows');
  }
  if (
    directResidentNoReadbackActiveGridMotionEvidenceAvailable
    && activeGridPredictedMaxSpeedMPerS != null
  ) {
    motionSpeedEvidenceSources.push('active-grid-predicted-motion');
  }
  const motionSpeedEvidenceSource = motionSpeedEvidenceSources.length
    ? motionSpeedEvidenceSources.join('+')
    : null;
  const motionDisplacementEvidenceSources = [];
  if (maxDisplacementObservedM != null) {
    motionDisplacementEvidenceSources.push('resident-compact-summary');
  }
  if (authoritativeCheckpointMotionEvidenceAvailable) {
    motionDisplacementEvidenceSources.push('authoritative-gpu-global-mass-weighted-y-checkpoint');
  }
  if (compactSummaryDisabled && renderRowMaxDisplacementM != null) {
    motionDisplacementEvidenceSources.push('decoded-render-rows');
  }
  if (directResidentNoReadbackActiveGridMotionEvidenceAvailable) {
    motionDisplacementEvidenceSources.push('active-grid-predicted-motion');
  }
  const motionDisplacementEvidenceSource = motionDisplacementEvidenceSources.length
    ? motionDisplacementEvidenceSources.join('+')
    : null;
  const renderRowMotionEvidenceAvailable = (
    compactSummaryDisabled
    && (renderRowEstimatedMaxSpeedMPerS != null || renderRowMaxDisplacementM != null)
  );
  const workerOwnedResidentRenderSourceSample = (metric, index) => {
    const steps = metric?.residentSteps ?? null;
    const lane = steps?.workerOwnedResidentLane ?? null;
    const presentation = metric?.workerOffscreenPresentation ?? null;
    const rendered = presentation?.displayOwnerLastRenderedContent ?? null;
    const checkpoint = metric?.authoritativeGpuCheckpoint ?? null;
    const snapshot = checkpoint?.workerSnapshotProvenance ?? null;
    const lineage = snapshot?.workerLineageMetadata ?? null;
    const laneCompletedStepTotal = finiteMetric(lane?.laneCompletedStepTotal);
    const laneSimTimeS = finiteMetric(lane?.laneSimTimeS);
    const renderedSphStep = finiteMetric(rendered?.sphStep);
    const checkpointStep = finiteMetric(checkpoint?.sourceStep);
    const checkpointTimeS = finiteMetric(checkpoint?.sourceTimeS);
    const requestedStepCount = finiteMetric(lane?.requestedStepCount);
    const completedStepCount = finiteMetric(lane?.completedStepCount);
    const laneId = typeof lane?.laneId === 'string' ? lane.laneId.trim() : '';
    const stateKey = typeof lane?.stateKey === 'string' ? lane.stateKey.trim() : '';
    const scheduleId = typeof lane?.scheduleId === 'string'
      ? lane.scheduleId.trim()
      : '';
    const snapshotCacheKey = typeof snapshot?.cacheKey === 'string'
      ? snapshot.cacheKey.trim()
      : '';
    const checkpointTimeMatches = (
      laneSimTimeS != null
      && checkpointTimeS != null
      && Math.abs(laneSimTimeS - checkpointTimeS) <= 1e-9
    );
    const ready = Boolean(
      metric?.phase === 'resident-batch'
      && steps?.residentComputeManagerMode === 'worker-owned-resident-lane'
      && steps?.workerLaneFallback == null
      && lane?.schema
        === 'peercompute.ulg.sph-scene-worker-owned-resident-lane-execution.v0'
      && lane?.residentScheduleStatus === 'worker-resident-schedule-completed'
      && lane?.terminalStatus
        === 'worker-offscreen-resident-schedule-on-presentation-device-completed'
      && laneId.length > 0
      && stateKey.length > 0
      && scheduleId.length > 0
      && Number.isSafeInteger(requestedStepCount)
      && requestedStepCount > 0
      && completedStepCount === requestedStepCount
      && lane?.cancelled === false
      && Number.isSafeInteger(laneCompletedStepTotal)
      && laneCompletedStepTotal > 0
      && laneSimTimeS != null
      && lane?.gpuFence?.scope === 'resident-schedule-terminal'
      && lane?.gpuFence?.terminalScheduleFence === true
      && lane?.gpuFence?.fenceSatisfied === true
      && lane?.gpuFence?.queueCompletionStatus === 'queue-work-completed'
      && lane?.gpuFence?.queueCompletionMethod
        === 'worker-device.queue.onSubmittedWorkDone'
      && lane?.gpuFence?.authorityAdmissionReady === true
      && lane?.authority?.status === 'state-manager-committed-worker-schedule'
      && lane?.authority?.computeManagerLeaseStatus === 'completed'
      && lane?.authority?.computeManagerFenceSatisfied === true
      && lane?.authority?.stateManagerCommitStatus === 'committed'
      && metric?.peerComputeRenderOwnershipPolicy?.effectiveMode
        === 'worker-owned-resident-render-producer'
      && presentation?.transport === 'worker-owned-presented-canvas'
      && presentation?.displayHandoff === 'transferControlToOffscreen'
      && presentation?.frameCopyBackRejected === true
      && presentation?.canvasTransferred === true
      && presentation?.workerReady === true
      && presentation?.contextStatus === 'webgpu-context-ready'
      && presentation?.displayOwner === 'worker'
      && presentation?.displayOwnerContentReady === true
      && Number(presentation?.displayOwnerContentFrameSerial) > 0
      && presentation?.displayCanvasVisible === true
      && rendered?.schema
        === 'peercompute.ulg.worker-offscreen-resident-particle-state-producer.v0'
      && rendered?.renderRowsSchema
        === 'peercompute.ulg.worker-offscreen-render-rows.v0'
      && rendered?.status
        === 'worker-offscreen-resident-particle-state-producer-rendered'
      && rendered?.residentScheduleCandidatePresentation === true
      && rendered?.stateManagerCommittedPresentation === true
      && rendered?.scheduleId === scheduleId
      && rendered?.laneId === laneId
      && rendered?.stateKey === stateKey
      && Number.isSafeInteger(Number(rendered?.presentationLaneEpoch))
      && Number(rendered.presentationLaneEpoch) > 0
      && Number(rendered?.residentExecutionGeneration)
        === Number(lane?.finalEpochIdentity?.storageGeneration)
      && Number(rendered?.stepOrdinal) === completedStepCount
      && rendered?.authorityStatus
        === 'state-manager-committed-worker-schedule'
      && rendered?.computeManagerCompletionSchema
        === 'peercompute.ulg.schroeder-worker-lane-compute-manager-completion.v0'
      && typeof rendered?.computeManagerLeaseId === 'string'
      && rendered.computeManagerLeaseId.length > 0
      && rendered?.computeManagerLeaseStatus === 'completed'
      && rendered?.computeManagerFenceSatisfied === true
      && rendered?.stateManagerCommitStatus === 'committed'
      && rendered?.stateManagerCommitAccepted === true
      && rendered?.terminalScheduleFence === true
      && rendered?.terminalFenceScope === 'resident-schedule-terminal'
      && rendered?.terminalFenceSatisfied === true
      && rendered?.terminalFenceAuthorityAdmissionReady === true
      && lane?.committedPresentation?.stateManagerCommittedPresentation === true
      && lane?.committedPresentation?.scheduleId === scheduleId
      && lane?.committedPresentation?.laneId === laneId
      && lane?.committedPresentation?.stateKey === stateKey
      && Number(lane?.committedPresentation?.presentationLaneEpoch)
        === Number(rendered.presentationLaneEpoch)
      && Number(lane?.committedPresentation?.sphStep) === renderedSphStep
      && rendered?.producerSourceKind
        === 'worker-retained-resident-stage-output'
      && rendered?.producerSourceTransport
        === 'worker-retained-resident-stage-output'
      && rendered?.sourceStageId === 'schroederSameLevelMechanics'
      && rendered?.retainedParticleStateStatus
        === 'worker-retained-particle-state-ready'
      && Number(rendered?.particleCount) > 0
      && Number(rendered?.frameCount) > 0
      && Number(rendered?.readyFrameCount) > 0
      && Number(presentation?.frameCount) === Number(rendered?.frameCount)
      && Number(presentation?.readyFrameCount)
        === Number(rendered?.readyFrameCount)
      && Number.isSafeInteger(renderedSphStep)
      && renderedSphStep + 1 === laneCompletedStepTotal
      && Number(presentation?.displayOwnerPresentedSphStep) === renderedSphStep
      && checkpoint?.status === 'captured'
      && checkpoint?.source === 'worker-retained-terminal-compact-snapshot'
      && checkpoint?.authority
        === 'worker-terminal-fence-and-state-manager-commit'
      && checkpointStep === laneCompletedStepTotal
      && checkpointTimeMatches
      && snapshot?.status
        === 'presentation-worker-retained-compact-snapshot-exported'
      && snapshotCacheKey.startsWith(
        `${scheduleId}:authoritative-checkpoint:`
      )
      && snapshot?.laneId === laneId
      && snapshot?.stateKey === stateKey
      && snapshot?.sourceStageId === 'schroederSameLevelMechanics'
      && checkpoint?.uploadPairCoherenceStatus === 'ready'
      && checkpoint?.uploadPairMetadataCoherent === true
      && checkpoint?.uploadPairSharedSlotIdentityVerified === true
      && checkpoint?.uploadPairCoherenceLevel === 'shared-slot-and-metadata'
      && lineage?.status
        === 'worker-retained-compact-snapshot-lineage-metadata-ready'
      && lineage?.sharedSlotIdentityVerified === true
    );
    if (!ready) return null;
    return {
      index,
      phase: metric.phase,
      nextStep: laneCompletedStepTotal,
      nextTimeS: laneSimTimeS,
      generation: null,
      currentGeneration: null,
      generationMatchesCurrent: true,
      retainedPrevious: false,
      sourceMarkedStale: false,
      retentionReason: null,
      sourceAuthority:
        'worker-terminal-fence-state-manager-display-and-snapshot-aligned'
    };
  };
  const residentRenderSourceSamples = metrics
    .map((metric, index) => {
      const workerSource = workerOwnedResidentRenderSourceSample(metric, index);
      if (workerSource) return workerSource;
      const renderState = metric?.renderState || {};
      const surfaceDraw = metric?.surfaceDraw || {};
      const nextStep = finiteMetric(
        surfaceDraw.sourceResidentNextStep
          ?? renderState.surfaceDrawSourceResidentNextStep
          ?? renderState.sourceResidentNextStep
          ?? metric?.residentStep?.particlePingPong?.nextStep
          ?? metric?.residentSteps?.nextStep
      );
      const nextTimeS = finiteMetric(
        surfaceDraw.sourceResidentNextTimeS
          ?? renderState.surfaceDrawSourceResidentNextTimeS
          ?? renderState.sourceResidentNextTimeS
          ?? metric?.residentStep?.particlePingPong?.nextTime
          ?? metric?.residentSteps?.nextTime
      );
      const generation = finiteMetric(
        surfaceDraw.sourceResidentExecutionGeneration
          ?? renderState.surfaceDrawSourceResidentExecutionGeneration
          ?? renderState.sourceResidentExecutionGeneration
      );
      const currentGeneration = finiteMetric(
        surfaceDraw.sourceResidentCurrentExecutionGeneration
          ?? renderState.surfaceDrawSourceResidentCurrentExecutionGeneration
          ?? renderState.sourceResidentCurrentExecutionGeneration
      );
      const generationMatchesCurrent = (
        surfaceDraw.sourceResidentExecutionGenerationMatchesCurrent
          ?? renderState.surfaceDrawSourceResidentExecutionGenerationMatchesCurrent
          ?? renderState.sourceResidentExecutionGenerationMatchesCurrent
          ?? null
      );
      const retainedPrevious = Boolean(
        surfaceDraw.sourceResidentRetainedPrevious
          ?? renderState.surfaceDrawSourceResidentRetainedPrevious
          ?? renderState.sourceResidentRetainedPrevious
      );
      const sourceMarkedStale = Boolean(
        surfaceDraw.residentRenderSourceStaleAfterPublish
          ?? renderState.residentRenderSourceStaleAfterPublish
          ?? false
      );
      if (
        nextStep == null
        && nextTimeS == null
        && generation == null
        && currentGeneration == null
        && generationMatchesCurrent == null
        && !retainedPrevious
        && !sourceMarkedStale
      ) {
        return null;
      }
      return {
        index,
        phase: metric?.phase ?? null,
        nextStep,
        nextTimeS,
        generation,
        currentGeneration,
        generationMatchesCurrent,
        retainedPrevious,
        sourceMarkedStale,
        retentionReason: surfaceDraw.sourceResidentRetentionReason
          ?? renderState.surfaceDrawSourceResidentRetentionReason
          ?? renderState.sourceResidentRetentionReason
          ?? null
      };
    })
    .filter(Boolean);
  const residentRenderSourceCurrentSampleCount = residentRenderSourceSamples
    .filter((sample) => (
      sample.generationMatchesCurrent === true
      && !sample.retainedPrevious
      && !sample.sourceMarkedStale
    ))
    .length;
  const residentRenderSourceStaleSampleCount = residentRenderSourceSamples
    .filter((sample) => (
      sample.generationMatchesCurrent === false
      || sample.retainedPrevious
      || sample.sourceMarkedStale
    ))
    .length;
  // SURF-0. Attribute staleness to the condition that fired. The three are
  // independent and imply different repairs: a generation mismatch means the
  // render bridge is reading a superseded storage generation, retainedPrevious
  // means the previous frame's draw was deliberately kept because a new one was
  // not admissible, and sourceMarkedStale means the producer itself disclaimed
  // the row. Collapsing them hides which one to fix.
  const residentRenderSourceStaleBreakdown = {
    generationMismatch: residentRenderSourceSamples
      .filter((sample) => sample.generationMatchesCurrent === false).length,
    retainedPrevious: residentRenderSourceSamples
      .filter((sample) => sample.retainedPrevious === true).length,
    sourceMarkedStale: residentRenderSourceSamples
      .filter((sample) => sample.sourceMarkedStale === true).length,
    generationUnknown: residentRenderSourceSamples
      .filter((sample) => sample.generationMatchesCurrent == null).length
  };
  const residentRenderSourceStaleRecovery =
    summarizeResidentRenderSourceStaleRecovery(
      residentRenderSourceSamples
    );
  const residentRenderSourceRetentionReasonCounts = {};
  for (const sample of residentRenderSourceSamples) {
    const reason = String(sample.retentionReason || '').trim();
    if (!reason) continue;
    residentRenderSourceRetentionReasonCounts[reason] =
      (residentRenderSourceRetentionReasonCounts[reason] || 0) + 1;
  }
  // One compact row per sample, in order, so the first bad frame is visible
  // rather than inferred from an aggregate.
  const residentRenderSourceSampleTrace = residentRenderSourceSamples
    .map((sample, index) => ({
      index,
      nextStep: Number.isFinite(sample.nextStep) ? sample.nextStep : null,
      generationMatchesCurrent: sample.generationMatchesCurrent ?? null,
      retainedPrevious: sample.retainedPrevious === true,
      sourceMarkedStale: sample.sourceMarkedStale === true,
      retentionReason: sample.retentionReason ?? null
    }));
  const residentRenderSourceNextStepSeries = residentRenderSourceSamples
    .map((sample) => sample.nextStep)
    .filter(Number.isFinite);
  const residentRenderSourceNextTimeSeries = residentRenderSourceSamples
    .map((sample) => sample.nextTimeS)
    .filter(Number.isFinite);
  const residentRenderSourceStepDelta = residentRenderSourceNextStepSeries.length >= 2
    ? Math.max(...residentRenderSourceNextStepSeries) - Math.min(...residentRenderSourceNextStepSeries)
    : null;
  const residentRenderSourceTimeDeltaS = residentRenderSourceNextTimeSeries.length >= 2
    ? Math.max(...residentRenderSourceNextTimeSeries) - Math.min(...residentRenderSourceNextTimeSeries)
    : null;
  const residentRenderSourceAdvanced = Boolean(
    (Number.isFinite(residentRenderSourceStepDelta) && residentRenderSourceStepDelta > 0)
    || (Number.isFinite(residentRenderSourceTimeDeltaS) && residentRenderSourceTimeDeltaS > 0)
  );
  const residentRenderSourceMetricTimeSeries = residentRenderSourceSamples
    .map((sample) => metricTimeS(metrics[sample.index]))
    .filter(Number.isFinite);
  const residentRenderSourceMetricTimeDeltaS = residentRenderSourceMetricTimeSeries.length >= 2
    ? Math.max(...residentRenderSourceMetricTimeSeries) - Math.min(...residentRenderSourceMetricTimeSeries)
    : null;
  const residentRenderSourceTimeAdvanced = Boolean(
    residentRenderSourceAdvanced
    || (Number.isFinite(residentRenderSourceMetricTimeDeltaS) && residentRenderSourceMetricTimeDeltaS > 0)
    || (Number.isFinite(visualFrameTimeSpanS) && visualFrameTimeSpanS > 0)
  );
  const minVolumeObservedJ = minVolumeSeries.length ? Math.min(...minVolumeSeries) : null;
  const maxVolumeObservedJ = maxVolumeSeries.length ? Math.max(...maxVolumeSeries) : null;
  const maxPressureImpulseNSeconds = pressureImpulseSeries.length ? Math.max(...pressureImpulseSeries) : null;
  const maxNextTimeS = nextTimeSeries.length ? Math.max(...nextTimeSeries) : null;
  const firstNextCenterOfMassYM = nextCenterOfMassYSeries.length ? nextCenterOfMassYSeries[0] : null;
  const lastNextCenterOfMassYM = nextCenterOfMassYSeries.length ? nextCenterOfMassYSeries[nextCenterOfMassYSeries.length - 1] : null;
  const nextCenterOfMassYDeltaM = Number.isFinite(firstNextCenterOfMassYM) && Number.isFinite(lastNextCenterOfMassYM)
    ? lastNextCenterOfMassYM - firstNextCenterOfMassYM
    : null;
  const firstDropCenterOfMassYM = dropCenterYSeries.length ? dropCenterYSeries[0] : null;
  const lastDropCenterOfMassYM = dropCenterYSeries.length ? dropCenterYSeries[dropCenterYSeries.length - 1] : null;
  const dropCenterOfMassYDeltaM = Number.isFinite(firstDropCenterOfMassYM) && Number.isFinite(lastDropCenterOfMassYM)
    ? lastDropCenterOfMassYM - firstDropCenterOfMassYM
    : null;
  const firstDropBaseGapM = dropBaseGapSeries.length ? dropBaseGapSeries[0] : null;
  const lastDropBaseGapM = dropBaseGapSeries.length ? dropBaseGapSeries[dropBaseGapSeries.length - 1] : null;
  const dropBaseGapDeltaM = Number.isFinite(firstDropBaseGapM) && Number.isFinite(lastDropBaseGapM)
    ? lastDropBaseGapM - firstDropBaseGapM
    : null;
  const firstDropBaseSupportGapM = dropBaseSupportGapSeries.length ? dropBaseSupportGapSeries[0] : null;
  const lastDropBaseSupportGapM = dropBaseSupportGapSeries.length
    ? dropBaseSupportGapSeries[dropBaseSupportGapSeries.length - 1]
    : null;
  const dropBaseSupportGapDeltaM = Number.isFinite(firstDropBaseSupportGapM) && Number.isFinite(lastDropBaseSupportGapM)
    ? lastDropBaseSupportGapM - firstDropBaseSupportGapM
    : null;
  const firstDropMaxSpeedMPerS = dropMaxSpeedSeries.length ? dropMaxSpeedSeries[0] : null;
  const lastDropMaxSpeedMPerS = dropMaxSpeedSeries.length
    ? dropMaxSpeedSeries[dropMaxSpeedSeries.length - 1]
    : null;
  const minActiveGridNodeCount = activeNodeSeries.length ? Math.min(...activeNodeSeries) : null;
  const workerOffscreenRenderRowsEvidence = (metric) => {
    const workerRows = metric?.workerOffscreenRenderRows
      ?? metric?.renderState?.workerOffscreenRenderRows
      ?? metric?.rendererInit?.workerOffscreenRenderRows
      ?? null;
    return {
      status: workerRows?.status
        ?? metric?.renderState?.workerOffscreenRenderRowsStatus
        ?? metric?.surfaceDraw?.renderBridgeLastRenderStatus
        ?? metric?.renderState?.surfaceDrawRenderBridgeLastRenderStatus
        ?? null,
      displayHandoff: workerRows?.displayHandoff
        ?? metric?.renderState?.workerOffscreenRenderRowsDisplayHandoff
        ?? metric?.workerOffscreenPresentation?.displayHandoff
        ?? metric?.renderState?.workerOffscreenPresentationDisplayHandoff
        ?? null,
      frameCopyBackRejected: workerRows?.frameCopyBackRejected
        ?? metric?.renderState?.workerOffscreenRenderRowsFrameCopyBackRejected
        ?? metric?.workerOffscreenPresentation?.frameCopyBackRejected
        ?? metric?.renderState?.workerOffscreenPresentationFrameCopyBackRejected
        ?? null,
      workerReady: workerRows?.workerReady
        ?? metric?.renderState?.workerOffscreenRenderRowsWorkerReady
        ?? metric?.workerOffscreenPresentation?.workerReady
        ?? metric?.renderState?.workerOffscreenPresentationWorkerReady
        ?? null,
      contextStatus: workerRows?.contextStatus
        ?? metric?.renderState?.workerOffscreenRenderRowsContextStatus
        ?? metric?.workerOffscreenPresentation?.contextStatus
        ?? metric?.renderState?.workerOffscreenPresentationContextStatus
        ?? null,
      particleCount: finiteMetric(
        workerRows?.particleCount
        ?? metric?.renderState?.workerOffscreenRenderRowsParticleCount
        ?? metric?.surfaceDraw?.vertexCount
        ?? metric?.renderState?.surfaceDrawVertexCount
      ),
      frameCount: finiteMetric(
        workerRows?.frameCount
        ?? metric?.renderState?.workerOffscreenRenderRowsFrameCount
      ),
      readyEver: workerRows?.readyEver
        ?? metric?.renderState?.workerOffscreenRenderRowsReadyEver
        ?? null,
      readyFrameCount: finiteMetric(
        workerRows?.readyFrameCount
        ?? metric?.renderState?.workerOffscreenRenderRowsReadyFrameCount
        ?? metric?.workerOffscreenPresentation?.readyFrameCount
        ?? metric?.renderState?.workerOffscreenPresentationReadyFrameCount
      ),
      lastPresentedSphStep: finiteMetric(
        workerRows?.lastPresentedSphStep
        ?? metric?.renderState?.workerOffscreenRenderRowsLastPresentedSphStep
      ),
      sphStep: finiteMetric(workerRows?.sphStep),
      presentation: metric?.workerOffscreenPresentation ?? null,
      renderedContent:
        metric?.workerOffscreenPresentation?.displayOwnerLastRenderedContent
        ?? null
    };
  };
  const workerOffscreenResidentParticleStateVisible = (metric) => {
    const evidence = workerOffscreenRenderRowsEvidence(metric);
    const presentation = evidence.presentation;
    const renderedContent = evidence.renderedContent;
    const renderedStep = finiteMetric(renderedContent?.sphStep);
    const renderedNow = evidence.status
      === 'worker-offscreen-resident-particle-state-producer-rendered'
      && evidence.sphStep === renderedStep;
    // A later page-side draw can be correctly rejected as older than the
    // already-presented worker candidate. Only the bridge's durable exact
    // positive content receipt can prove the old frame is still displayed.
    const renderedBeforeStaleRejection = evidence.status
      === 'worker-offscreen-presentation-superseded-stale-step'
      && Number.isSafeInteger(evidence.sphStep)
      && Number.isSafeInteger(Number(evidence.lastPresentedSphStep))
      && evidence.sphStep < Number(evidence.lastPresentedSphStep)
      && Number(evidence.lastPresentedSphStep) === renderedStep;
    return (renderedNow || renderedBeforeStaleRejection)
      && evidence.displayHandoff === 'transferControlToOffscreen'
      && evidence.frameCopyBackRejected === true
      && evidence.workerReady === true
      && evidence.contextStatus === 'webgpu-context-ready'
      && presentation?.canvasTransferred === true
      && presentation?.workerReady === true
      && presentation?.contextStatus === 'webgpu-context-ready'
      && presentation?.displayOwner === 'worker'
      && presentation?.displayOwnerContentReady === true
      && Number(presentation?.displayOwnerContentFrameSerial) > 0
      && presentation?.displayCanvasVisible === true
      && Number.isSafeInteger(renderedStep)
      && renderedStep >= 0
      && Number(presentation?.displayOwnerPresentedSphStep) === renderedStep
      && renderedContent?.schema
        === 'peercompute.ulg.worker-offscreen-resident-particle-state-producer.v0'
      && renderedContent?.renderRowsSchema
        === 'peercompute.ulg.worker-offscreen-render-rows.v0'
      && renderedContent?.status
        === 'worker-offscreen-resident-particle-state-producer-rendered'
      && renderedContent?.residentScheduleCandidatePresentation === true
      && renderedContent?.stateManagerCommittedPresentation === true
      && renderedContent?.authorityStatus
        === 'state-manager-committed-worker-schedule'
      && Number.isSafeInteger(Number(
        renderedContent?.presentationLaneEpoch
      ))
      && Number(renderedContent.presentationLaneEpoch) > 0
      && renderedContent?.computeManagerCompletionSchema
        === 'peercompute.ulg.schroeder-worker-lane-compute-manager-completion.v0'
      && typeof renderedContent?.computeManagerLeaseId === 'string'
      && renderedContent.computeManagerLeaseId.length > 0
      && renderedContent?.computeManagerLeaseStatus === 'completed'
      && renderedContent?.computeManagerFenceSatisfied === true
      && renderedContent?.stateManagerCommitStatus === 'committed'
      && renderedContent?.stateManagerCommitAccepted === true
      && renderedContent?.terminalScheduleFence === true
      && renderedContent?.terminalFenceScope === 'resident-schedule-terminal'
      && renderedContent?.terminalFenceSatisfied === true
      && renderedContent?.terminalFenceAuthorityAdmissionReady === true
      && renderedContent?.producerSourceKind
        === 'worker-retained-resident-stage-output'
      && renderedContent?.producerSourceTransport
        === 'worker-retained-resident-stage-output'
      && renderedContent?.sourceStageId === 'schroederSameLevelMechanics'
      && renderedContent?.retainedParticleStateStatus
        === 'worker-retained-particle-state-ready'
      && Number(renderedContent?.particleCount) > 0
      && Number(renderedContent?.frameCount) > 0
      && Number(renderedContent?.readyFrameCount) > 0
      && Number(presentation?.frameCount) === Number(renderedContent?.frameCount)
      && Number(presentation?.readyFrameCount)
        === Number(renderedContent?.readyFrameCount);
  };
  const renderStateHasH2oEvidence = (renderState = null) => {
    if (!renderState) return false;
    const keys = [
      ...(Array.isArray(renderState.materialKeys) ? renderState.materialKeys : []),
      ...Object.keys(renderState.renderRowsDecodedMaterialPhaseCounts || {}),
      ...Object.keys(renderState.renderRowsDecodedMaterialPhaseDomainCounts || {})
    ];
    return keys.some((key) => String(key || '').toLowerCase().includes('h2o'));
  };
  const workerOffscreenResidentParticleStateH2oVisible = (metric) => (
    workerOffscreenResidentParticleStateVisible(metric)
    && (
      expectedLiquidH2oSameMaterial
      || renderStateHasH2oEvidence(metric?.renderState)
    )
  );
  const residentOverlayVisible = (metric) => {
    const bridge = metric?.surfaceDraw?.visibleRendererBridge
      ?? metric?.renderState?.surfaceDrawVisibleRendererBridge
      ?? null;
    const renderSource = metric?.surfaceDraw?.visibleRenderSource
      ?? metric?.renderState?.surfaceDrawVisibleRenderSource
      ?? null;
    const status = metric?.surfaceDraw?.status ?? metric?.renderState?.surfaceDrawStatus ?? null;
    const activeSurfaceCount = Number(
      metric?.surfaceDraw?.activeSurfaceCount
        ?? metric?.renderState?.surfaceDrawActiveSurfaceCount
        ?? 0
    );
    const vertexCount = Number(
      metric?.surfaceDraw?.vertexCount
        ?? metric?.renderState?.surfaceDrawVertexCount
        ?? 0
    );
    const renderBridgeStatus = metric?.surfaceDraw?.renderBridgeStatus
      ?? metric?.renderState?.surfaceDrawRenderBridgeStatus
      ?? null;
    const sourceVertexRowCount = Number(
      metric?.surfaceDraw?.sourceVertexRowCount
        ?? metric?.renderState?.surfaceDrawSourceVertexRowCount
        ?? 0
    );
    const compactedVertexRowsBufferByteLength = Number(
      metric?.surfaceDraw?.compactedVertexRowsBufferByteLength
        ?? metric?.renderState?.surfaceDrawCompactedVertexRowsBufferByteLength
        ?? 0
    );
    const compactPositionRowsBufferByteLength = Number(
      metric?.surfaceDraw?.compactPositionRowsBufferByteLength
        ?? metric?.renderState?.surfaceDrawCompactPositionRowsBufferByteLength
        ?? 0
    );
    const retainedResidentDrawBuffers = Boolean(
      metric?.surfaceDraw?.drawIndirectRowsBufferRetained
        ?? metric?.renderState?.surfaceDrawIndirectRowsBufferRetained
    ) && Boolean(
      (
        metric?.surfaceDraw?.compactedVertexRowsBufferRetained
        ?? metric?.renderState?.surfaceDrawCompactedVertexRowsBufferRetained
      )
      || (
        metric?.surfaceDraw?.compactPositionRowsBufferRetained
        ?? metric?.renderState?.surfaceDrawCompactPositionRowsBufferRetained
      )
    );
    const residentDrawCountsUnknown = (
      (metric?.surfaceDraw?.activeSurfaceCount ?? metric?.renderState?.surfaceDrawActiveSurfaceCount ?? null) == null
      && (metric?.surfaceDraw?.vertexCount ?? metric?.renderState?.surfaceDrawVertexCount ?? null) == null
    );
    const webGpuIndirectOverlayVisible = bridge === 'webgpu-storage-indirect-overlay'
      && renderSource === 'resident-surface-draw-buffers'
      && (
        status === 'resident-surface-draw-buffers-retained'
        || status === 'resident-surface-draw-built'
      )
      && (
        renderBridgeStatus === 'webgpu-storage-indirect-overlay-ready'
        || metric?.surfaceDraw?.renderBridgeLastRenderStatus === 'webgpu-overlay-rendered'
        || metric?.renderState?.surfaceDrawRenderBridgeLastRenderStatus === 'webgpu-overlay-rendered'
      )
      && (
        activeSurfaceCount > 0
        || vertexCount > 0
        || (
          residentDrawCountsUnknown
          && retainedResidentDrawBuffers
          && sourceVertexRowCount > 0
          && (compactedVertexRowsBufferByteLength > 0 || compactPositionRowsBufferByteLength > 0)
        )
      );
    const threeRenderRowPointsVisible = (
        bridge === 'three-render-row-points'
        || bridge === 'three-render-row-spheres'
      )
      && (
        renderSource === 'resident-render-rows-three-points'
        || renderSource === 'resident-render-rows-three-instanced-spheres'
      )
      && (
        status === 'resident-render-row-points-built'
        || status === 'resident-render-row-spheres-built'
        || status === 'resident-render-row-three-bridge-retained-no-full-readback'
      )
      && (
        renderBridgeStatus === 'three-render-row-points-ready'
        || renderBridgeStatus === 'three-render-row-spheres-ready'
        || metric?.surfaceDraw?.renderBridgeLastRenderStatus === 'three-render-row-points-submitted'
        || metric?.surfaceDraw?.renderBridgeLastRenderStatus === 'three-render-row-spheres-submitted'
        || metric?.surfaceDraw?.renderBridgeLastRenderStatus === 'three-render-row-points-retained-no-full-readback'
        || metric?.surfaceDraw?.renderBridgeLastRenderStatus === 'three-render-row-spheres-retained-no-full-readback'
        || metric?.renderState?.surfaceDrawRenderBridgeLastRenderStatus === 'three-render-row-points-submitted'
        || metric?.renderState?.surfaceDrawRenderBridgeLastRenderStatus === 'three-render-row-spheres-submitted'
        || metric?.renderState?.surfaceDrawRenderBridgeLastRenderStatus === 'three-render-row-points-retained-no-full-readback'
        || metric?.renderState?.surfaceDrawRenderBridgeLastRenderStatus === 'three-render-row-spheres-retained-no-full-readback'
      )
      && vertexCount > 0;
    const webGpuRenderRowOverlayVisible = (
        bridge === 'webgpu-render-row-points'
        || bridge === 'webgpu-render-row-spheres'
      )
      && (
        renderSource === 'resident-render-rows-webgpu-points'
        || renderSource === 'resident-render-rows-webgpu-instanced-spheres'
      )
      && (
        status === 'resident-render-row-webgpu-points-built'
        || status === 'resident-render-row-webgpu-spheres-built'
      )
      && (
        renderBridgeStatus === 'webgpu-render-row-points-ready'
        || renderBridgeStatus === 'webgpu-render-row-spheres-ready'
        || metric?.surfaceDraw?.renderBridgeLastRenderStatus === 'webgpu-render-row-points-rendered'
        || metric?.surfaceDraw?.renderBridgeLastRenderStatus === 'webgpu-render-row-spheres-rendered'
        || metric?.renderState?.surfaceDrawRenderBridgeLastRenderStatus === 'webgpu-render-row-points-rendered'
        || metric?.renderState?.surfaceDrawRenderBridgeLastRenderStatus === 'webgpu-render-row-spheres-rendered'
      )
      && vertexCount > 0;
    const nativeWebGpuSurfaceConsumerForegroundProved = bridge === 'native-webgpu-surface-consumer'
      && renderSource === 'resident-surface-draw-native-webgpu-consumer'
      && (
        status === 'resident-extension-surface-draw-buffers-retained'
        || status === 'resident-surface-draw-buffers-retained'
        || status === 'resident-surface-draw-built'
      )
      && (
        renderBridgeStatus === 'native-webgpu-surface-consumer-ready'
        || nativeWebGpuSurfaceRenderStatusIsRendered(
          metric?.surfaceDraw?.renderBridgeLastRenderStatus
        )
        || nativeWebGpuSurfaceRenderStatusIsRendered(
          metric?.renderState?.surfaceDrawRenderBridgeLastRenderStatus
        )
      )
      && residentSurfaceForegroundProved(metric)
      && (activeSurfaceCount > 0 || vertexCount > 0);
    return workerOffscreenResidentParticleStateVisible(metric)
      || webGpuIndirectOverlayVisible
      || threeRenderRowPointsVisible
      || webGpuRenderRowOverlayVisible
      || nativeWebGpuSurfaceConsumerForegroundProved;
  };
  const residentRenderFieldSummaryVisible = (metric) => (
    metric?.renderState?.source === 'resident-gpu-render-field'
    && metric?.renderState?.renderFieldSurfaceSummaryReadback === true
    && Number(metric?.renderState?.renderFieldSurfaceSummaryActiveSurfaceCount ?? 0) > 0
  );
  const residentSurfaceBufferHandoffReady = (metric) => (
    metric?.renderState?.surfaceDrawGpuBufferHandoffReady === true
    || metric?.surfaceDraw?.gpuBufferHandoffReady === true
    || metric?.surfaceDraw?.surfaceDrawGpuBufferHandoffReady === true
  );
  const residentSurfaceVisibleGpuConsumerReady = (metric) => (
    metric?.renderState?.surfaceDrawVisibleGpuConsumerReady === true
    || metric?.surfaceDraw?.visibleGpuConsumerReady === true
    || metric?.surfaceDraw?.surfaceDrawVisibleGpuConsumerReady === true
  );
  const residentSurfacePresentationAdmitted = (metric) => Boolean(
    residentSurfaceBufferHandoffReady(metric)
    && residentSurfaceVisibleGpuConsumerReady(metric)
    && metric?.nativeSurfaceValidation?.sourceCurrent === true
    && metric?.nativeSurfaceValidation?.admitted === true
    && metric?.nativeSurfaceValidation?.runtimePresentationAdmitted === true
  );
  const residentSurfaceForegroundProved = (metric) => Boolean(
    residentSurfacePresentationAdmitted(metric)
    && metric?.nativeSurfaceValidation?.foregroundProved === true
    && metric?.nativeSurfaceValidation?.foregroundProofValidated === true
  );
  const residentSurfaceVisibleGpuConsumerInputReady = (metric) => (
    metric?.renderState?.surfaceDrawVisibleGpuConsumerInputReady === true
    || metric?.surfaceDraw?.visibleGpuConsumerInputReady === true
    || metric?.surfaceDraw?.surfaceDrawVisibleGpuConsumerInputReady === true
  );
  const residentSurfaceVisibleGpuConsumerNativeValidationBlockerFamily = (metric) => (
    metric?.renderState?.surfaceDrawVisibleGpuConsumerNativeValidationBlockerFamily
    ?? metric?.surfaceDraw?.visibleGpuConsumerNativeValidationBlockerFamily
    ?? metric?.surfaceDraw?.surfaceDrawVisibleGpuConsumerNativeValidationBlockerFamily
    ?? null
  );
  const residentOverlayH2oVisible = (metric) => residentOverlayVisible(metric)
    && (
      workerOffscreenResidentParticleStateH2oVisible(metric)
      || (
        Array.isArray(metric?.renderState?.materialKeys)
        && metric.renderState.materialKeys.some((key) => String(key || '').toLowerCase().includes('h2o'))
      )
    );
  const residentRenderFieldSummaryH2oVisible = (metric) => residentRenderFieldSummaryVisible(metric)
    && Array.isArray(metric?.renderState?.renderFieldSurfaceSummarySurfaces)
    && metric.renderState.renderFieldSurfaceSummarySurfaces.some((surface) => (
      Number(surface?.activeCellCount ?? 0) > 0
      && (
        String(surface?.material || '').toLowerCase().includes('h2o')
        || String(surface?.renderKey || '').toLowerCase().includes('h2o')
      )
    ));
  const visibleSurfaceSampleCount = metrics.filter((metric) => (
    (metric.surfaces?.visibleCount ?? 0) > 0
    || residentOverlayVisible(metric)
    || residentRenderFieldSummaryVisible(metric)
  )).length;
  const workerOffscreenResidentParticleStateVisibleSampleCount =
    metrics.filter(workerOffscreenResidentParticleStateVisible).length;
  const workerOffscreenResidentParticleStateReadyFrameCount = metrics
    .map((metric) => workerOffscreenRenderRowsEvidence(metric).readyFrameCount)
    .filter(Number.isFinite)
    .reduce((max, value) => Math.max(max, value), 0);
  const residentSurfaceBufferHandoffSampleCount = metrics.filter((metric) => (
    residentSurfaceBufferHandoffReady(metric)
  )).length;
  const residentSurfaceVisibleGpuConsumerSampleCount = metrics.filter((metric) => (
    residentSurfaceVisibleGpuConsumerReady(metric)
  )).length;
  const residentSurfacePresentationAdmissionSampleCount = metrics.filter((metric) => (
    residentSurfacePresentationAdmitted(metric)
  )).length;
  const residentSurfaceForegroundProofSampleCount = metrics.filter((metric) => (
    residentSurfaceForegroundProved(metric)
  )).length;
  const residentSurfaceVisibleGpuConsumerInputReadySampleCount = metrics.filter((metric) => (
    residentSurfaceVisibleGpuConsumerInputReady(metric)
  )).length;
  const requestedRenderReadbackMode = String(timeline?.renderReadbackMode || '').toLowerCase();
  const requestedRenderFieldSurfaceSummaryMode = String(
    timeline?.renderFieldSurfaceSummaryMode || ''
  ).toLowerCase();
  const residentSurfaceBufferHandoffProbe = Boolean(
    (
      requestedSurfaceDrawMode === 'three-webgpu-surface-buffers'
      || requestedSurfaceDrawMode === 'native-webgpu-surface-consumer'
      || requestedSurfaceDrawMode === 'resident-surface-buffers-no-overlay'
      || (
        requestedSurfaceDrawMode === 'auto'
        && requestedRenderFieldSurfaceSummaryMode === 'skip'
      )
    )
    && requestedRenderReadbackMode === 'no-full-readback'
  );
  const residentSurfaceBufferHandoffAccepted = Boolean(
    residentSurfaceBufferHandoffProbe
    && residentSurfaceBufferHandoffSampleCount > 0
  );
  const residentSurfacePresentationAdmissionAccepted = Boolean(
    residentSurfaceBufferHandoffProbe
    && residentSurfacePresentationAdmissionSampleCount > 0
  );
  const residentSurfaceForegroundProofAccepted = Boolean(
    residentSurfaceBufferHandoffProbe
    && (
      residentSurfaceForegroundProofSampleCount > 0
      || visibleGpuConsumerBrowserPixelValidated
    )
  );
  // Compatibility field retained for existing artifact readers; its visible
  // claim now follows foreground proof, not structural admission.
  const residentSurfaceVisibleGpuConsumerAccepted =
    residentSurfaceForegroundProofAccepted;
  const nativeWebGpuSurfaceConsumerAccepted = Boolean(
    requestedSurfaceDrawMode === 'native-webgpu-surface-consumer'
    && residentSurfacePresentationAdmissionAccepted
  );
  const nativeWebGpuSurfaceConsumerRendered = Boolean(
    requestedSurfaceDrawMode === 'native-webgpu-surface-consumer'
    && metrics.some((metric) => (
      nativeWebGpuSurfaceRenderStatusIsRendered(
        metric?.surfaceDraw?.renderBridgeLastRenderStatus
      )
      || nativeWebGpuSurfaceRenderStatusIsRendered(
        metric?.renderState?.surfaceDrawRenderBridgeLastRenderStatus
      )
    ))
  );
  const nativeWebGpuSurfaceConsumerTextureReadbackUnavailable = Boolean(
    requestedSurfaceDrawMode === 'native-webgpu-surface-consumer'
    && metrics.some((metric) => (
      metric?.renderState?.surfaceDrawVisibleGpuConsumerNativeTextureReadbackUnavailable === true
      || metric?.surfaceDraw?.visibleGpuConsumerNativeTextureReadbackUnavailable === true
      || /external Instance reference no longer exists|texture readback unavailable/i.test(String(
        metric?.renderState?.surfaceDrawRenderBridgePixelValidationReason
        ?? metric?.renderState?.surfaceDrawRenderBridgeOffscreenValidationReason
        ?? metric?.renderState?.surfaceDrawVisibleGpuConsumerNativeDeviceTextureReadbackSmokeReason
        ?? metric?.surfaceDraw?.renderBridgePixelValidationReason
        ?? metric?.surfaceDraw?.renderBridgeOffscreenValidationReason
        ?? metric?.surfaceDraw?.visibleGpuConsumerNativeDeviceTextureReadbackSmokeReason
        ?? ''
      ))
    ))
  );
  const nativeWebGpuSurfaceConsumerBrowserFrameValidationRequired = Boolean(
    requestedSurfaceDrawMode === 'native-webgpu-surface-consumer'
    && metrics.some((metric) => (
      residentSurfaceVisibleGpuConsumerNativeValidationBlockerFamily(metric)
        === 'browser-frame-validation-required'
    ))
  );
  const residentNoReadbackRenderSourceEvidenceAvailable = Boolean(
    (
      residentSurfaceBufferHandoffProbe
      && compactSummaryDisabled
      && residentRenderSourceCurrentSampleCount > 0
      && residentRenderSourceStaleRecovery.unrecoveredSampleCount === 0
      && residentRenderSourceTimeAdvanced
      && (
        residentSurfaceVisibleGpuConsumerInputReadySampleCount > 0
        || residentSurfaceBufferHandoffSampleCount > 0
      )
    )
    || (
      compactSummaryDisabled
      && workerOffscreenResidentParticleStateVisibleSampleCount > 0
      && workerOffscreenResidentParticleStateReadyFrameCount > 0
    )
  );
  const h2oVisibleSurfaceSampleCount = metrics.filter((metric) => (
    (metric.surfaces?.h2oVisibleCount ?? 0) > 0
    || residentOverlayH2oVisible(metric)
    || residentRenderFieldSummaryH2oVisible(metric)
  )).length;
  const h2oVisibleSurfaceCountSeries = metrics
    .map((metric) => {
      const count = Number(metric.surfaces?.h2oVisibleCount ?? 0);
      if (count > 0) return count;
      if (residentRenderFieldSummaryH2oVisible(metric)) {
        return metric.renderState.renderFieldSurfaceSummarySurfaces.filter((surface) => (
          Number(surface?.activeCellCount ?? 0) > 0
          && (
            String(surface?.material || '').toLowerCase().includes('h2o')
            || String(surface?.renderKey || '').toLowerCase().includes('h2o')
          )
        )).length;
      }
      return residentOverlayH2oVisible(metric) ? 1 : 0;
    })
    .filter(Number.isFinite);
  const firstH2oVisibleSurfaceCount = h2oVisibleSurfaceCountSeries.length
    ? h2oVisibleSurfaceCountSeries[0]
    : null;
  const lastH2oVisibleSurfaceCount = h2oVisibleSurfaceCountSeries.length
    ? h2oVisibleSurfaceCountSeries[h2oVisibleSurfaceCountSeries.length - 1]
    : null;
  const capturedMaterialPhaseCheckpoints = metrics
    .map((metric) => metric?.authoritativeGpuCheckpoint)
    .filter((checkpoint) => (
      checkpoint?.status === 'captured'
      && Array.isArray(checkpoint.materialPhases)
    ));
  const authoritativeGpuCheckpointCapacityOverflowCount = capturedMaterialPhaseCheckpoints
    .filter((checkpoint) => checkpoint.materialPhaseCapacityStatus === 'overflow')
    .length;
  const authoritativeGpuCheckpointMappingIncompleteCount = capturedMaterialPhaseCheckpoints
    .filter((checkpoint) => checkpoint.materialMappingStatus !== 'complete')
    .length;
  const authoritativeGpuCheckpointPhaseFractionProblemCount = capturedMaterialPhaseCheckpoints
    .filter((checkpoint) => Number(checkpoint.phaseFractionProblemParticleCount) > 0)
    .length;
  const authoritativeGpuCheckpointUnclassifiedCount = capturedMaterialPhaseCheckpoints
    .filter((checkpoint) => Number(checkpoint.unclassifiedMassKg) > 0)
    .length;
  const authoritativeGpuCheckpointMechanicsIncompleteCount = capturedMaterialPhaseCheckpoints
    .filter((checkpoint) => checkpoint.mechanicsEvidenceStatus !== 'complete')
    .length;
  const authoritativeGpuCheckpointVolumeRatioCapBoundaryCount = capturedMaterialPhaseCheckpoints
    .filter((checkpoint) => Number(checkpoint.volumeRatioCapBoundaryParticleCount) > 0)
    .length;
  const maxAuthoritativeGpuCheckpointVolumeRatioCapBoundaryParticleCount = Math.max(
    0,
    ...capturedMaterialPhaseCheckpoints.map((checkpoint) => (
      Number(checkpoint.volumeRatioCapBoundaryParticleCount) || 0
    ))
  );
  const checkpointMaterialEvidenceComplete = (checkpoint) => (
    checkpoint?.status === 'captured'
    && checkpoint.materialPhaseCapacityStatus === 'within-capacity'
    && checkpoint.materialMappingStatus === 'complete'
    && Number(checkpoint.phaseFractionProblemParticleCount || 0) === 0
    && Number(checkpoint.unclassifiedMassKg || 0) === 0
  );
  const checkpointMaterialCounts = (checkpoint) => {
    if (!checkpointMaterialEvidenceComplete(checkpoint) || !Array.isArray(checkpoint.materialPhases)) {
      return null;
    }
    const counts = {};
    for (const row of checkpoint.materialPhases) {
      const material = String(row?.material || '').trim();
      if (!material) continue;
      const weightedCount = Number(row?.phaseWeightedParticleCount);
      counts[material] = (counts[material] || 0) + Math.max(0, (
        Number.isFinite(weightedCount)
          ? weightedCount
          : Number(row?.liveParticleCount) || 0
      ));
    }
    return Object.fromEntries(Object.entries(counts).map(([material, count]) => [
      material,
      Math.round(count)
    ]));
  };
  const materialCountSnapshotRecords = metrics
    .map((metric) => {
      const plain = metric?.plainSphStepResult?.particlesByMaterial;
      if (plain && typeof plain === 'object') return { source: 'plain-sph-step', counts: plain };
      const resident = metric?.residentStep?.particlesByMaterial;
      if (resident && typeof resident === 'object') return { source: 'resident-step', counts: resident };
      const checkpoint = checkpointMaterialCounts(metric?.authoritativeGpuCheckpoint);
      return checkpoint ? { source: 'authoritative-gpu-checkpoint', counts: checkpoint } : null;
    })
    .filter(Boolean);
  const materialCountSnapshots = materialCountSnapshotRecords.map((record) => record.counts);
  const finalParticlesByMaterial = materialCountSnapshots.length
    ? materialCountSnapshots[materialCountSnapshots.length - 1]
    : null;
  const finalParticlesByMaterialSource = materialCountSnapshotRecords.length
    ? materialCountSnapshotRecords[materialCountSnapshotRecords.length - 1].source
    : null;
  const finalMaterialPhases = capturedMaterialPhaseCheckpoints.length
    ? capturedMaterialPhaseCheckpoints[capturedMaterialPhaseCheckpoints.length - 1].materialPhases
    : [];
  const materialCountFor = (counts, material) => {
    if (!counts || !material) return 0;
    const wanted = String(material).toLowerCase();
    for (const [key, value] of Object.entries(counts)) {
      if (String(key).toLowerCase() === wanted) return Number(value) || 0;
    }
    return 0;
  };
  const normalizedExpectedReactionProducts = Array.from(new Set(
    expectedMaterialPresent
      .map((material) => String(material || '').trim().toLowerCase())
      .filter(Boolean)
  ));
  const completeReactionProductMassCheckpoints = capturedMaterialPhaseCheckpoints
    .filter(checkpointMaterialEvidenceComplete)
    .map((checkpoint) => {
      const massKgByMaterial = {};
      for (const row of checkpoint.materialPhases) {
        const material = String(row?.material || '').trim().toLowerCase();
        const massKg = finiteMetric(row?.massKg);
        if (!material || !Number.isFinite(massKg) || massKg < 0) continue;
        massKgByMaterial[material] = (massKgByMaterial[material] || 0) + massKg;
      }
      return {
        batchIndex: finiteMetric(checkpoint.batchIndex),
        sourceTimeS: finiteMetric(checkpoint.sourceTimeS),
        massKgByMaterial
      };
    });
  const authoritativeReactionProductMassEvidence = normalizedExpectedReactionProducts
    .map((material) => {
      const massKgSeries = completeReactionProductMassCheckpoints
        .map((checkpoint) => finiteMetric(checkpoint.massKgByMaterial[material]) ?? 0);
      const firstMassKg = massKgSeries.length > 0 ? massKgSeries[0] : null;
      const finalMassKg = massKgSeries.length > 0 ? massKgSeries[massKgSeries.length - 1] : null;
      const maxObservedMassKg = massKgSeries.length > 0 ? Math.max(...massKgSeries) : null;
      const maxSubsequentMassKg = massKgSeries.length > 1 ? Math.max(...massKgSeries.slice(1)) : null;
      const growthToleranceKg = Number.isFinite(maxObservedMassKg)
        ? Math.max(1e-12, Math.abs(maxObservedMassKg) * 1e-6)
        : null;
      const maxMassIncreaseKg = (
        Number.isFinite(firstMassKg)
        && Number.isFinite(maxSubsequentMassKg)
      ) ? maxSubsequentMassKg - firstMassKg : null;
      return {
        material,
        sampleCount: massKgSeries.length,
        firstMassKg,
        finalMassKg,
        maxObservedMassKg,
        maxMassIncreaseKg,
        growthToleranceKg,
        positiveMassObserved: (
          Number.isFinite(maxObservedMassKg)
          && Number.isFinite(growthToleranceKg)
          && maxObservedMassKg > growthToleranceKg
        ),
        measurableMassGrowthObserved: (
          Number.isFinite(maxMassIncreaseKg)
          && Number.isFinite(growthToleranceKg)
          && maxMassIncreaseKg > growthToleranceKg
        )
      };
    });
  const authoritativeReactionProductMassGrowthConfirmed = Boolean(
    normalizedExpectedReactionProducts.length > 0
    && completeReactionProductMassCheckpoints.length >= 2
    && authoritativeReactionProductMassEvidence.every((evidence) => (
      evidence.positiveMassObserved
      && evidence.measurableMassGrowthObserved
    ))
  );
  const authoritativeReactionProgressEvidence = {
    schema: 'peercompute.ulg.sph-authoritative-reaction-progress-evidence.v1',
    status: normalizedExpectedReactionProducts.length === 0
      ? 'missing-expected-product-materials'
      : completeReactionProductMassCheckpoints.length < 2
      ? 'insufficient-complete-checkpoints'
      : authoritativeReactionProductMassGrowthConfirmed
      ? 'confirmed-product-mass-growth'
      : 'product-mass-growth-not-confirmed',
    source: 'authoritative-gpu-material-phase-checkpoints',
    authority: 'gpu-resident-retained-state',
    eventCountInferred: false,
    completeCheckpointCount: completeReactionProductMassCheckpoints.length,
    expectedProductMaterials: normalizedExpectedReactionProducts,
    products: authoritativeReactionProductMassEvidence
  };
  const reactionEventsTotalSeries = metrics
    .map((metric) => {
      const evidence = metric?.residentStep?.diagnostics?.reactionEvidence;
      // These routes can describe different points in the placement pipeline.
      // In particular, a present zero active/canonical count must not mask a
      // positive pre-placement species-ledger count. Take the strongest finite
      // evidence for this checkpoint instead of nullish-selecting one route.
      const counts = [
        metric?.plainSphStepResult?.reactionEventsTotal,
        metric?.residentStep?.reactionEventsTotal,
        metric?.residentStep?.reactionLedger?.eventCount,
        reactionProgressEventCount(evidence)
      ].map(finiteMetric).filter(Number.isFinite);
      return counts.length ? Math.max(...counts) : null;
    })
    .filter(Number.isFinite);
  const maxReactionEventsTotal = reactionEventsTotalSeries.length
    ? Math.max(...reactionEventsTotalSeries)
    : null;
  let reactionProgressGateEvidenceSource = null;
  let reactionProgressGateSatisfied = null;
  const batchMsSeries = metrics
    .filter((metric) => metric.phase === 'resident-batch')
    .map((metric) => finiteMetric(metric.batchMs))
    .filter(Number.isFinite);
  const compactSummaryMsSeries = metrics
    .map((metric) => finiteMetric(metric.residentStep?.stageTiming?.stageMs?.compactSummary))
    .filter(Number.isFinite);
  const compactSummaryMapAsyncMsSeries = metrics
    .map((metric) => finiteMetric(
      metric.residentStep?.stageTiming?.queueFenceMs?.compactSummaryMapAsync
      ?? metric.residentStep?.stageTiming?.compactSummaryTiming?.mapAsyncWaitMs
    ))
    .filter(Number.isFinite);
  const sumSeries = (series) => series.reduce((sum, value) => sum + value, 0);
  const meanBatchMs = batchMsSeries.length ? sumSeries(batchMsSeries) / batchMsSeries.length : null;
  const maxBatchMs = batchMsSeries.length ? Math.max(...batchMsSeries) : null;
  const meanCompactSummaryMs = compactSummaryMsSeries.length
    ? sumSeries(compactSummaryMsSeries) / compactSummaryMsSeries.length
    : null;
  const maxCompactSummaryMs = compactSummaryMsSeries.length ? Math.max(...compactSummaryMsSeries) : null;
  const meanCompactSummaryMapAsyncMs = compactSummaryMapAsyncMsSeries.length
    ? sumSeries(compactSummaryMapAsyncMsSeries) / compactSummaryMapAsyncMsSeries.length
    : null;
  const maxCompactSummaryMapAsyncMs = compactSummaryMapAsyncMsSeries.length
    ? Math.max(...compactSummaryMapAsyncMsSeries)
    : null;
  const compactSummaryMeanBatchShare = Number.isFinite(meanBatchMs)
    && meanBatchMs > 0
    && Number.isFinite(meanCompactSummaryMs)
    ? meanCompactSummaryMs / meanBatchMs
    : null;
  const compactSummaryMapAsyncMeanBatchShare = Number.isFinite(meanBatchMs)
    && meanBatchMs > 0
    && Number.isFinite(meanCompactSummaryMapAsyncMs)
    ? meanCompactSummaryMapAsyncMs / meanBatchMs
    : null;
  const visualSurfaceIssues = [];
  let maxVisibleSurfaceOutsideM = 0;
  let maxVisibleSurfaceOutsideParticleBoundsM = 0;
  let maxVisibleSurfaceComponentCount = 0;
  let maxVisibleSurfaceSmallComponentCount = 0;
  let minVisibleSurfaceLargestComponentRatio = null;
  let maxH2oLiquidSurfaceHeightM = null;
  let maxH2oLiquidSurfaceTallnessRatio = null;
  let minH2oLiquidSurfaceFootprintFillRatio = null;
  let lastH2oLiquidSurfaceHeightM = null;
  let lastH2oLiquidSurfaceTallnessRatio = null;
  let lastH2oLiquidSurfaceFootprintFillRatio = null;
  // Which evidence the free-surface ratios came from. 'scene-node-mesh' is the
  // three.js path; 'resident-cohort-particle-bounds' is the native path, where
  // no CPU-side mesh exists to measure. Never left implicit.
  let liquidFreeSurfaceBoundsSource = null;
  if (!directResident && !residentSurfaceBufferHandoffAccepted) {
    const alphaTransparentRenderLayers = new Set(['vapor-surface', 'alpha-surface']);
    const knownSurfaceRenderLayers = new Set([
      'opaque-surface',
      'transmissive-surface',
      'refractive-surface',
      ...alphaTransparentRenderLayers
    ]);
    const pushRenderVisualIssue = (issue, metricIndex, surface, extra = {}) => {
      visualSurfaceIssues.push({
        issue,
        metricIndex,
        materialKey: surface?.materialKey ?? null,
        phase: surface?.phase ?? null,
        renderSource: surface?.renderSource ?? null,
        renderLayer: surface?.renderLayer ?? null,
        renderOrder: finiteMetric(surface?.renderOrder),
        renderOrderBase: finiteMetric(surface?.renderOrderBase),
        renderOrderPolicy: surface?.renderOrderPolicy ?? null,
        materialTransparent: surface?.materialTransparent ?? null,
        materialDepthWrite: surface?.materialDepthWrite ?? null,
        materialDepthTest: surface?.materialDepthTest ?? null,
        surfaceBoundsClipStatus: surface?.surfaceBoundsClipStatus ?? null,
        surfaceBoundsClipVertexCount: finiteMetric(surface?.surfaceBoundsClipVertexCount),
        surfaceBoundsClipPaddingM: finiteMetric(surface?.surfaceBoundsClipPaddingM),
        ...extra
      });
    };
    metrics.forEach((metric, metricIndex) => {
      const particleBounds = metric.residentStep?.diagnostics?.nextPositionBoundsM;
      const visibleSurfaces = metric.surfaces?.visible || [];
      const visibleRenderOrders = visibleSurfaces
        .map((surface) => finiteMetric(surface.renderOrder))
        .filter(Number.isFinite);
      const maxVisibleRenderOrder = visibleRenderOrders.length ? Math.max(...visibleRenderOrders) : null;
      const containerWire = metric.surfaces?.containerWire || null;
      const containerGrid = metric.surfaces?.containerGrid || null;
      if (visibleSurfaces.length) {
        if (!containerWire) {
          visualSurfaceIssues.push({ issue: 'render-container-wire-missing', metricIndex });
        } else {
          const wireOrder = finiteMetric(containerWire.renderOrder);
          if (!Number.isFinite(wireOrder)) {
            visualSurfaceIssues.push({ issue: 'render-container-wire-missing-render-order', metricIndex, ...containerWire });
          } else if (Number.isFinite(maxVisibleRenderOrder) && wireOrder <= maxVisibleRenderOrder) {
            visualSurfaceIssues.push({
              issue: 'render-container-wire-not-above-surfaces',
              metricIndex,
              renderOrder: wireOrder,
              maxVisibleRenderOrder,
              ...containerWire
            });
          }
          if (containerWire.materialDepthWrite !== false) {
            visualSurfaceIssues.push({ issue: 'render-container-wire-depth-write-enabled', metricIndex, ...containerWire });
          }
          if (containerWire.materialDepthTest === false) {
            visualSurfaceIssues.push({ issue: 'render-container-wire-depth-test-disabled', metricIndex, ...containerWire });
          }
        }
        if (!containerGrid) {
          visualSurfaceIssues.push({ issue: 'render-container-grid-missing', metricIndex });
        } else {
          const gridOrder = finiteMetric(containerGrid.renderOrder);
          const wireOrder = finiteMetric(containerWire?.renderOrder);
          if (!Number.isFinite(gridOrder)) {
            visualSurfaceIssues.push({ issue: 'render-container-grid-missing-render-order', metricIndex, ...containerGrid });
          } else if (Number.isFinite(wireOrder) && gridOrder >= wireOrder) {
            visualSurfaceIssues.push({
              issue: 'render-container-grid-not-below-wire',
              metricIndex,
              renderOrder: gridOrder,
              wireRenderOrder: wireOrder,
              ...containerGrid
            });
          }
          if (containerGrid.materialDepthWrite !== false) {
            visualSurfaceIssues.push({ issue: 'render-container-grid-depth-write-enabled', metricIndex, ...containerGrid });
          }
          if (containerGrid.materialDepthTest !== true) {
            visualSurfaceIssues.push({ issue: 'render-container-grid-depth-test-disabled', metricIndex, ...containerGrid });
          }
        }
      }
      if (expectedLiquidH2oSameMaterial) {
        const particleCount = Number(metric.residentStep?.diagnostics?.particleCount ?? 0);
        const residentRenderField = metric.renderState?.source === 'resident-gpu-render-field';
        const h2oSurfaces = visibleSurfaces.filter((surface) => (
          String(surface?.materialKey || '').toLowerCase().includes('h2o')
        ));
        if (
          residentRenderField
          && particleCount > 0
          && h2oSurfaces.length === 0
          && !residentOverlayH2oVisible(metric)
          && !residentRenderFieldSummaryH2oVisible(metric)
        ) {
          visualSurfaceIssues.push({
            issue: 'same-material-h2o-visible-surface-disappeared',
            metricIndex,
            particleCount,
            renderRowsReadback: metric.renderState?.renderRowsReadback ?? null,
            renderRowsReadbackMode: metric.renderState?.renderRowsReadbackMode ?? null,
            renderRowsHandoffMode: metric.renderState?.renderRowsHandoffMode ?? null,
            renderFieldEmptyRetryReadback: metric.renderState?.renderFieldEmptyRetryReadback ?? null,
            renderFieldEmptyRetryReason: metric.renderState?.renderFieldEmptyRetryReason ?? null,
            surfaces: metric.surfaces?.all ?? []
          });
        }
        const descriptors = new Set(h2oSurfaces.map((surface) => [
          String(surface?.phase || 'unknown').toLowerCase(),
          String(surface?.renderKey || surface?.materialKey || 'unknown').toLowerCase()
        ].join(':')));
        if (descriptors.size > 1) {
          visualSurfaceIssues.push({
            issue: 'same-material-h2o-visible-phase-split',
            metricIndex,
            descriptors: [...descriptors],
            surfaces: h2oSurfaces.map((surface) => ({
              materialKey: surface.materialKey ?? null,
              phase: surface.phase ?? null,
              renderKey: surface.renderKey ?? null,
              renderSource: surface.renderSource ?? null,
              vertexCount: surface.vertexCount ?? null,
              bounds: surface.worldBounds ?? null
            }))
          });
        }
        const nonLiquid = h2oSurfaces.filter((surface) => (
          String(surface?.phase || '').toLowerCase() !== 'liquid'
          || String(surface?.renderKey || '').toLowerCase() !== 'h2o'
        ));
        if (nonLiquid.length) {
          visualSurfaceIssues.push({
            issue: 'same-material-h2o-nonliquid-visible-surface',
            metricIndex,
            surfaces: nonLiquid.map((surface) => ({
              materialKey: surface.materialKey ?? null,
              phase: surface.phase ?? null,
              renderKey: surface.renderKey ?? null,
              renderSource: surface.renderSource ?? null,
              vertexCount: surface.vertexCount ?? null,
              bounds: surface.worldBounds ?? null
            }))
          });
        }
      }
      for (const surface of visibleSurfaces) {
        const bounds = surface.worldBounds;
        const isH2oLiquidSurface = String(surface?.materialKey || '').toLowerCase().includes('h2o')
          && String(surface?.phase || '').toLowerCase() === 'liquid'
          && bounds?.size;
        if (isH2oLiquidSurface) {
          const heightM = finiteMetric(bounds.size?.[1]);
          const footprintXM = finiteMetric(bounds.size?.[0]);
          const footprintZM = finiteMetric(bounds.size?.[2]);
          const footprintAreaM2 = Number.isFinite(footprintXM) && Number.isFinite(footprintZM)
            ? Math.max(0, footprintXM * footprintZM)
            : null;
          const footprintFillRatio = footprintAreaM2 != null
            ? footprintAreaM2 / Math.max(1e-9, Number(boxDimsM[0]) * Number(boxDimsM[2]))
            : null;
          const horizontalExtentM = Math.max(
            1e-9,
            Number.isFinite(footprintXM) ? footprintXM : 0,
            Number.isFinite(footprintZM) ? footprintZM : 0
          );
          const tallnessRatio = Number.isFinite(heightM) ? heightM / horizontalExtentM : null;
          if (Number.isFinite(heightM)) {
            maxH2oLiquidSurfaceHeightM = maxH2oLiquidSurfaceHeightM == null
              ? heightM
              : Math.max(maxH2oLiquidSurfaceHeightM, heightM);
            lastH2oLiquidSurfaceHeightM = heightM;
          }
          if (Number.isFinite(tallnessRatio)) {
            maxH2oLiquidSurfaceTallnessRatio = maxH2oLiquidSurfaceTallnessRatio == null
              ? tallnessRatio
              : Math.max(maxH2oLiquidSurfaceTallnessRatio, tallnessRatio);
            lastH2oLiquidSurfaceTallnessRatio = tallnessRatio;
            liquidFreeSurfaceBoundsSource = 'scene-node-mesh';
          }
          if (Number.isFinite(footprintFillRatio)) {
            minH2oLiquidSurfaceFootprintFillRatio = minH2oLiquidSurfaceFootprintFillRatio == null
              ? footprintFillRatio
              : Math.min(minH2oLiquidSurfaceFootprintFillRatio, footprintFillRatio);
            lastH2oLiquidSurfaceFootprintFillRatio = footprintFillRatio;
          }
        }
        const componentCount = finiteMetric(surface.componentCount);
        const smallComponentCount = finiteMetric(surface.smallComponentCount);
        const largestComponentRatio = finiteMetric(surface.largestComponentVertexRatio);
        if (Number.isFinite(componentCount)) {
          maxVisibleSurfaceComponentCount = Math.max(maxVisibleSurfaceComponentCount, componentCount);
        }
        if (Number.isFinite(smallComponentCount)) {
          maxVisibleSurfaceSmallComponentCount = Math.max(maxVisibleSurfaceSmallComponentCount, smallComponentCount);
        }
        if (Number.isFinite(largestComponentRatio)) {
          minVisibleSurfaceLargestComponentRatio = minVisibleSurfaceLargestComponentRatio == null
            ? largestComponentRatio
            : Math.min(minVisibleSurfaceLargestComponentRatio, largestComponentRatio);
        }
        if (
          surface.renderSource === 'resident-gpu-render-field'
          && surface.surfaceBoundsClipStatus === 'clipped-to-surface-bounds'
          && finiteMetric(surface.surfaceBoundsClipVertexCount) > 0
        ) {
          pushRenderVisualIssue('resident-visible-surface-clipped-to-particle-bounds', metricIndex, surface, {
            vertexCount: surface.vertexCount ?? null,
            bounds: surface.worldBounds ?? null
          });
        }
        const renderLayer = String(surface.renderLayer || '');
        const renderOrder = finiteMetric(surface.renderOrder);
        const renderOrderBase = finiteMetric(surface.renderOrderBase);
        if (!knownSurfaceRenderLayers.has(renderLayer)) {
          pushRenderVisualIssue('render-surface-unknown-layer', metricIndex, surface);
        }
        if (!Number.isFinite(renderOrder)) {
          pushRenderVisualIssue('render-surface-missing-render-order', metricIndex, surface);
        }
        if (surface.materialDepthTest === false) {
          pushRenderVisualIssue('render-surface-depth-test-disabled', metricIndex, surface);
        }
        const alphaTransparentSurface = alphaTransparentRenderLayers.has(renderLayer)
          || surface.materialDepthWrite === false
          || surface.materialTransparent === true;
        if (alphaTransparentSurface) {
          if (surface.materialDepthWrite !== false) {
            pushRenderVisualIssue('render-transparent-surface-depth-write-enabled', metricIndex, surface);
          }
          if (surface.renderOrderPolicy !== 'three-transparent-depth-sort-within-layer') {
            pushRenderVisualIssue('render-transparent-surface-not-depth-sortable', metricIndex, surface);
          }
          if (
            Number.isFinite(renderOrder)
            && Number.isFinite(renderOrderBase)
            && Math.abs(renderOrder - renderOrderBase) > 1e-9
          ) {
            pushRenderVisualIssue('render-transparent-surface-hashed-render-order', metricIndex, surface);
          }
        } else if (
          renderLayer === 'opaque-surface'
          || renderLayer === 'transmissive-surface'
          || renderLayer === 'refractive-surface'
        ) {
          if (surface.materialDepthWrite !== true) {
            pushRenderVisualIssue('render-opaque-surface-depth-write-disabled', metricIndex, surface);
          }
          if (surface.renderOrderPolicy !== 'stable-opaque-layer-order') {
            pushRenderVisualIssue('render-opaque-surface-unstable-order-policy', metricIndex, surface);
          }
        }
        if (!bounds?.min || !bounds?.max || !bounds?.size) continue;
        const outsideAxes = [];
        const oversizedAxes = [];
        for (let axis = 0; axis < 3; axis += 1) {
          const minOverflow = Math.max(0, -Number(bounds.min[axis]) - visibleBoundsToleranceM);
          const maxOverflow = Math.max(0, Number(bounds.max[axis]) - Number(boxDimsM[axis]) - visibleBoundsToleranceM);
          const overflow = Math.max(minOverflow, maxOverflow);
          if (overflow > 0) {
            outsideAxes.push(axis);
            maxVisibleSurfaceOutsideM = Math.max(maxVisibleSurfaceOutsideM, overflow);
          }
          if (Number(bounds.size[axis]) > Number(boxDimsM[axis]) + 2 * visibleBoundsToleranceM) {
            oversizedAxes.push(axis);
          }
        }
        if (outsideAxes.length) {
          visualSurfaceIssues.push({
            issue: 'visible-surface-outside-box',
            metricIndex,
            materialKey: surface.materialKey ?? null,
            phase: surface.phase ?? null,
            renderSource: surface.renderSource ?? null,
            axes: outsideAxes,
            bounds
          });
        }
        if (oversizedAxes.length) {
          visualSurfaceIssues.push({
            issue: 'visible-surface-larger-than-box',
            metricIndex,
            materialKey: surface.materialKey ?? null,
            phase: surface.phase ?? null,
            renderSource: surface.renderSource ?? null,
            axes: oversizedAxes,
            bounds
          });
        }
        if (particleBounds?.min && particleBounds?.max) {
          const expandedAxes = [];
          const overflows = [];
          const particleSupportRadiusM = Math.max(
            0,
            finiteMetric(surface.surfaceRadiusM),
            finiteMetric(surface.requestedSurfaceRadiusM),
            finiteMetric(surface.cpuMarchingCubesRadiusFloorM)
          );
          const marchingCubesCellSizeM = Math.max(
            0,
            finiteMetric(surface.cpuMarchingCubesCellSizeM),
            finiteMetric(surface.renderFieldCellSizeM)
          );
          const allowedParticleBoundsOverflowM = particleBoundsToleranceM
            + particleSupportRadiusM
            + marchingCubesCellSizeM;
          for (let axis = 0; axis < 3; axis += 1) {
            const minOverflow = Math.max(
              0,
              Number(particleBounds.min[axis]) - Number(bounds.min[axis]) - allowedParticleBoundsOverflowM
            );
            const maxOverflow = Math.max(
              0,
              Number(bounds.max[axis]) - Number(particleBounds.max[axis]) - allowedParticleBoundsOverflowM
            );
            const overflow = Math.max(minOverflow, maxOverflow);
            if (overflow > 0) {
              expandedAxes.push(axis);
              overflows.push(overflow);
              maxVisibleSurfaceOutsideParticleBoundsM = Math.max(maxVisibleSurfaceOutsideParticleBoundsM, overflow);
            }
          }
          if (expandedAxes.length) {
            visualSurfaceIssues.push({
              issue: 'visible-surface-expanded-beyond-particle-bounds',
              metricIndex,
              materialKey: surface.materialKey ?? null,
              phase: surface.phase ?? null,
              renderSource: surface.renderSource ?? null,
              axes: expandedAxes,
              maxOverflowM: Math.max(...overflows),
              particleBoundsToleranceM,
              particleSupportRadiusM,
              marchingCubesCellSizeM,
              allowedParticleBoundsOverflowM,
              particleBounds,
              bounds
            });
          }
        }
      }
    });
  }
  const issues = [];
  if (timeline?.status !== 'complete') issues.push(`probe-status:${timeline?.status || 'missing'}`);
  if (
    productHistoryP2gGpuCountReceiptRequired
    && productHistoryP2gGpuCountReceiptAccepted !== true
  ) {
    issues.push('resident-product-history-p2g-gpu-count-receipt-invalid');
  }
  if (
    productHistoryRenderCommitGateReceiptRequired
    && productHistoryRenderCommitGateReceiptAccepted !== true
  ) {
    issues.push('resident-product-history-render-commit-gate-receipt-invalid');
  }
  if (authoritativeGpuCheckpointCapacityOverflowCount > 0) {
    issues.push('authoritative-gpu-checkpoint-capacity-overflow');
  }
  if (authoritativeGpuCheckpointMappingIncompleteCount > 0) {
    issues.push('authoritative-gpu-checkpoint-material-mapping-incomplete');
  }
  if (authoritativeGpuCheckpointPhaseFractionProblemCount > 0) {
    issues.push('authoritative-gpu-checkpoint-phase-fraction-incomplete');
  }
  if (authoritativeGpuCheckpointUnclassifiedCount > 0) {
    issues.push('authoritative-gpu-checkpoint-unclassified-mass');
  }
  if (authoritativeGpuCheckpointMechanicsIncompleteCount > 0) {
    issues.push('authoritative-gpu-checkpoint-mechanics-incomplete');
  }
  const initialPreflightStatus = String(initialPreflight?.status || '');
  const preflightFeasible = initialPreflight?.feasibility?.feasible;
  if (
    initialPreflightStatus.includes('blocked')
    || initialPreflightStatus.includes('infeasible')
    || preflightFeasible === false
    || initialPreflightBlockers.includes('initial-block-geometry-overlap')
  ) {
    issues.push('initial-preflight-blocked');
  }
  if (residentRenderSourceStaleRecovery.unrecoveredSampleCount > 0) {
    issues.push('resident-render-source-stale');
  }
  if (!visualOnly) {
    if (
      diagnostics.length === 0
      && !renderRowMotionEvidenceAvailable
      && !authoritativeCheckpointMotionEvidenceAvailable
      && !residentNoReadbackRenderSourceEvidenceAvailable
    ) {
      issues.push('missing-resident-diagnostics');
    }
    if (
      motionMaxSpeedObservedMPerS == null
      && !residentNoReadbackRenderSourceEvidenceAvailable
    ) {
      issues.push('missing-max-speed');
    }
    if (motionMaxSpeedObservedMPerS != null && motionMaxSpeedObservedMPerS > maxSpeedMPerS) issues.push(`max-speed>${maxSpeedMPerS}`);
    if (expectStatic) {
      if (motionMaxDisplacementObservedM == null) {
        issues.push('missing-static-displacement');
      } else if (motionMaxDisplacementObservedM > staticMaxDisplacementM) {
        issues.push(`static-displacement>${staticMaxDisplacementM}`);
      }
      if (
        Number.isFinite(nextCenterOfMassYDeltaM)
        && Math.abs(nextCenterOfMassYDeltaM) > staticMaxCenterOfMassDeltaM
      ) {
        issues.push(`static-center-of-mass-delta>${staticMaxCenterOfMassDeltaM}`);
      }
    } else if (
      (motionMaxDisplacementObservedM == null || motionMaxDisplacementObservedM <= 0)
      && !residentNoReadbackRenderSourceEvidenceAvailable
    ) {
      issues.push('no-positive-displacement');
    }
    if (minActiveGridNodeCount != null && minActiveGridNodeCount <= 0) issues.push('inactive-grid-nodes');
    if (minVolumeObservedJ != null && minVolumeObservedJ < minVolumeRatioJ) issues.push(`min-J<${minVolumeRatioJ}`);
    if (maxVolumeObservedJ != null && maxVolumeObservedJ > maxVolumeRatioJ) issues.push(`max-J>${maxVolumeRatioJ}`);
  }
  const liquidEosActive = internalPressureScaleSeries.some((value) => value > 0.5);
  if (
    !visualOnly
    && expectedLiquidH2oSameMaterial
    && liquidEosActive
    && Number.isFinite(maxNextTimeS)
    && maxNextTimeS >= 0.05
  ) {
    if (minVolumeObservedJ == null) {
      issues.push('missing-liquid-J');
    } else if (minVolumeObservedJ < CONDENSED_MIN_VOLUME_RATIO_J) {
      issues.push(`same-material-liquid-J<${CONDENSED_MIN_VOLUME_RATIO_J}`);
    }
    if (maxVolumeObservedJ == null) {
      issues.push('missing-liquid-J');
    } else if (maxVolumeObservedJ > CONDENSED_MAX_VOLUME_RATIO_J) {
      issues.push(`same-material-liquid-J>${CONDENSED_MAX_VOLUME_RATIO_J}`);
    }
    if (cohortDiagnostics.length === 0) {
      issues.push('missing-same-material-cohort-diagnostics');
    }
  }
  if (!visualOnly && maxPressureImpulseNSeconds != null && maxPressureImpulseNSeconds > 1e-5) issues.push('same-material-pressure-impulse-applied');
  if (Number.isFinite(minReactionEventsTotal)) {
    if (Number.isFinite(maxReactionEventsTotal)) {
      reactionProgressGateEvidenceSource = 'reaction-events-total';
      reactionProgressGateSatisfied = maxReactionEventsTotal >= minReactionEventsTotal;
      if (!reactionProgressGateSatisfied) {
        issues.push(`reaction-events-total<${minReactionEventsTotal}`);
      }
    } else if (
      minReactionEventsTotal === 1
      && timeline?.readbackMode === 'no-full-readback'
      && authoritativeReactionProductMassGrowthConfirmed
    ) {
      reactionProgressGateEvidenceSource = 'authoritative-gpu-product-mass-growth';
      reactionProgressGateSatisfied = true;
    } else {
      reactionProgressGateSatisfied = false;
      issues.push('missing-reaction-events-total');
    }
  }
  for (const material of expectedMaterialPresent) {
    if (materialCountFor(finalParticlesByMaterial, material) <= 0) {
      issues.push(`expected-material-missing:${material}`);
    }
  }
  for (const material of expectedMaterialAbsent) {
    if (materialCountFor(finalParticlesByMaterial, material) > 0) {
      issues.push(`unexpected-material-present:${material}`);
    }
  }
  if (Number.isFinite(minVisualFrameTimeSpanS)) {
    if (!Number.isFinite(visualFrameTimeSpanS)) {
      issues.push('missing-visual-frame-time-span');
    } else if (visualFrameTimeSpanS < minVisualFrameTimeSpanS) {
      issues.push(`visual-frame-time-span<${minVisualFrameTimeSpanS}`);
    }
  }
  if (
    !visualOnly
    && expectedLiquidH2oSameMaterial
    && Number.isFinite(maxNextTimeS)
    && maxNextTimeS >= 0.1
    && Number.isFinite(firstDropBaseSupportGapM)
    && Number.isFinite(lastDropBaseSupportGapM)
    && firstDropBaseSupportGapM >= 0
    && firstDropBaseSupportGapM <= 0.1
    && lastDropBaseSupportGapM > Math.max(0.005, firstDropBaseSupportGapM * 0.5)
  ) {
    issues.push('same-material-contact-gap-not-closing');
  }
  if (!visualOnly && expectedLiquidH2oSameMaterial && expectLiquidMerge) {
    if (!Number.isFinite(lastDropBaseSupportGapM)) {
      issues.push('liquid-merge-missing-support-gap');
    } else if (lastDropBaseSupportGapM > liquidMergeMaxFinalSupportGapM) {
      issues.push(`liquid-merge-final-support-gap>${liquidMergeMaxFinalSupportGapM}`);
    }
    if (!directResident && Number.isFinite(expectedH2oVisibleSurfaceCount)) {
      if (!Number.isFinite(lastH2oVisibleSurfaceCount)) {
        issues.push('liquid-merge-missing-h2o-visible-surface-count');
      } else if (lastH2oVisibleSurfaceCount !== expectedH2oVisibleSurfaceCount) {
        issues.push(`liquid-merge-h2o-visible-surface-count!=${expectedH2oVisibleSurfaceCount}`);
      }
    }
  }
  if (!visualOnly && expectedLiquidH2oSameMaterial && expectLiquidSettled) {
    if (!Number.isFinite(maxNextTimeS)) {
      issues.push('liquid-settle-missing-sim-time');
    } else if (maxNextTimeS < liquidSettledMinTimeS) {
      issues.push(`liquid-settle-duration<${liquidSettledMinTimeS}`);
    }
    if (!Number.isFinite(lastDropBaseSupportGapM)) {
      issues.push('liquid-settle-missing-support-gap');
    } else if (lastDropBaseSupportGapM > liquidMergeMaxFinalSupportGapM) {
      issues.push(`liquid-settle-final-support-gap>${liquidMergeMaxFinalSupportGapM}`);
    }
    if (!Number.isFinite(lastDropMaxSpeedMPerS)) {
      issues.push('liquid-settle-missing-final-drop-speed');
    } else if (lastDropMaxSpeedMPerS > liquidSettledMaxFinalDropSpeedMPerS) {
      issues.push(`liquid-settle-final-drop-speed>${liquidSettledMaxFinalDropSpeedMPerS}`);
    }
  }
  // SURF-0. The tallness and footprint ratios above are derived from three.js
  // scene-node geometry via boundsFromGeometry, which reads
  // geometry.attributes.position.array. On the native WebGPU surface path the
  // vertices are GPU-resident and that attribute does not exist, so
  // metric.surfaces.visible is empty and both ratios stay null -- the gate
  // reported "missing" on every native run rather than measuring anything.
  //
  // Fall back to the resident cohort position bounds, which are already
  // measured and carry status 'position-bounds-ready'. Those are particle
  // positions rather than isosurface vertices, which for a free-surface check
  // is the more direct evidence: tallness of the liquid body is a property of
  // the physics, and the isosurface is a rendering of it. The substitution is
  // recorded in liquidFreeSurfaceBoundsSource so it is never silent.
  if (
    !Number.isFinite(lastH2oLiquidSurfaceTallnessRatio)
    && expectedLiquidH2oSameMaterial
  ) {
    const cohortUnionBounds = (metric) => {
      const cohorts = metricCohortDiagnostics(metric) ?? metric?.initial?.cohortDiagnostics;
      const parts = [cohorts?.base?.boundsM, cohorts?.drop?.boundsM]
        .filter((entry) => entry?.status === 'position-bounds-ready'
          && Array.isArray(entry.min) && Array.isArray(entry.max));
      if (!parts.length) return null;
      const min = [0, 1, 2].map((axis) => Math.min(...parts.map((p) => finiteMetric(p.min[axis]) ?? Infinity)));
      const max = [0, 1, 2].map((axis) => Math.max(...parts.map((p) => finiteMetric(p.max[axis]) ?? -Infinity)));
      if (!min.every(Number.isFinite) || !max.every(Number.isFinite)) return null;
      return { min, max, size: [0, 1, 2].map((axis) => max[axis] - min[axis]) };
    };
    for (const metric of metrics) {
      const bounds = cohortUnionBounds(metric);
      if (!bounds) continue;
      const heightM = finiteMetric(bounds.size[1]);
      const footprintXM = finiteMetric(bounds.size[0]);
      const footprintZM = finiteMetric(bounds.size[2]);
      const horizontalExtentM = Math.max(1e-9, footprintXM ?? 0, footprintZM ?? 0);
      const tallnessRatio = Number.isFinite(heightM) ? heightM / horizontalExtentM : null;
      const footprintFillRatio = Number.isFinite(footprintXM) && Number.isFinite(footprintZM)
        ? (footprintXM * footprintZM)
          / Math.max(1e-9, Number(boxDimsM[0]) * Number(boxDimsM[2]))
        : null;
      if (Number.isFinite(heightM)) {
        maxH2oLiquidSurfaceHeightM = maxH2oLiquidSurfaceHeightM == null
          ? heightM
          : Math.max(maxH2oLiquidSurfaceHeightM, heightM);
        lastH2oLiquidSurfaceHeightM = heightM;
      }
      if (Number.isFinite(tallnessRatio)) {
        maxH2oLiquidSurfaceTallnessRatio = maxH2oLiquidSurfaceTallnessRatio == null
          ? tallnessRatio
          : Math.max(maxH2oLiquidSurfaceTallnessRatio, tallnessRatio);
        lastH2oLiquidSurfaceTallnessRatio = tallnessRatio;
      }
      if (Number.isFinite(footprintFillRatio)) {
        minH2oLiquidSurfaceFootprintFillRatio = minH2oLiquidSurfaceFootprintFillRatio == null
          ? footprintFillRatio
          : Math.min(minH2oLiquidSurfaceFootprintFillRatio, footprintFillRatio);
        lastH2oLiquidSurfaceFootprintFillRatio = footprintFillRatio;
      }
      liquidFreeSurfaceBoundsSource = 'resident-cohort-particle-bounds';
    }
  }
  if (!visualOnly && expectedLiquidH2oSameMaterial && expectLiquidFreeSurface) {
    if (!Number.isFinite(maxNextTimeS)) {
      issues.push('liquid-free-surface-missing-sim-time');
    } else if (maxNextTimeS < liquidFreeSurfaceMinTimeS) {
      issues.push(`liquid-free-surface-duration<${liquidFreeSurfaceMinTimeS}`);
    }
    if (!Number.isFinite(lastH2oLiquidSurfaceTallnessRatio)) {
      issues.push('liquid-free-surface-missing-tallness');
    } else if (lastH2oLiquidSurfaceTallnessRatio > liquidFreeSurfaceMaxTallnessRatio) {
      issues.push(`liquid-free-surface-tallness>${liquidFreeSurfaceMaxTallnessRatio}`);
    }
    if (!Number.isFinite(lastH2oLiquidSurfaceFootprintFillRatio)) {
      issues.push('liquid-free-surface-missing-footprint-fill');
    } else if (lastH2oLiquidSurfaceFootprintFillRatio < liquidFreeSurfaceMinFootprintFillRatio) {
      issues.push(`liquid-free-surface-footprint-fill<${liquidFreeSurfaceMinFootprintFillRatio}`);
    }
    if (
      Number.isFinite(liquidFreeSurfaceMaxHeightM)
      && Number.isFinite(lastH2oLiquidSurfaceHeightM)
      && lastH2oLiquidSurfaceHeightM > liquidFreeSurfaceMaxHeightM
    ) {
      issues.push(`liquid-free-surface-height>${liquidFreeSurfaceMaxHeightM}`);
    }
  }
  if (residentSurfaceBufferHandoffProbe && residentSurfaceBufferHandoffSampleCount === 0) {
    issues.push('resident-surface-buffer-handoff-missing');
  }
  if (
    requestedSurfaceDrawMode === 'native-webgpu-surface-consumer'
    && residentSurfaceBufferHandoffSampleCount > 0
    && residentSurfacePresentationAdmissionSampleCount === 0
  ) {
    issues.push('native-surface-presentation-not-admitted');
  }
  if (
    requestedSurfaceDrawMode === 'three-webgpu-surface-buffers'
    && residentSurfaceBufferHandoffSampleCount > 0
    && residentSurfaceVisibleGpuConsumerSampleCount === 0
    && !visibleGpuConsumerBrowserPixelValidated
  ) {
    issues.push('resident-surface-visible-gpu-consumer-not-ready');
  }
  if (
    requestedSurfaceDrawMode === 'native-webgpu-surface-consumer'
    && nativeBrowserFrameValidation?.status === 'failed'
  ) {
    issues.push('native-surface-browser-frame-validation-failed');
  }
  const nativeBrowserFrameCaptureUnsupportedCoveredByCurrentGpuProof = Boolean(
    requestedSurfaceDrawMode === 'native-webgpu-surface-consumer'
    && nativeBrowserFrameValidation?.status === 'unsupported'
    && residentSurfaceForegroundProved(metrics.at(-1) || null)
  );
  if (
    requestedSurfaceDrawMode === 'native-webgpu-surface-consumer'
    && nativeBrowserFrameValidation?.status === 'unsupported'
    && !nativeBrowserFrameCaptureUnsupportedCoveredByCurrentGpuProof
  ) {
    issues.push('native-surface-browser-frame-validation-unsupported');
  }
  if (
    requestedSurfaceDrawMode === 'native-webgpu-surface-consumer'
    && nativeBrowserFrameValidation?.status === 'passed'
    && !nativeBrowserFramePixelValidated
  ) {
    issues.push('native-surface-browser-frame-proof-incomplete');
  }
  if (capturedVisualFrames.length > 0 && pngAnalyzedVisualFrames.length === 0) {
    issues.push('visual-frames-not-png-analyzable');
  }
  if (pngAnalyzedVisualFrames.length > 0 && nonblankVisualFrameCount === 0) {
    issues.push('visual-frames-all-blank');
  }
  const browserCanvasCaptureUnsupportedByNativeWebGpu = Boolean(
    requestedSurfaceDrawMode === 'native-webgpu-surface-consumer'
    && nativeWebGpuSurfaceConsumerRendered
    && pngAnalyzedCanvasFrames.length > 0
    && blankCanvasFrameCount === pngAnalyzedCanvasFrames.length
    && (
      nativeWebGpuSurfaceConsumerAccepted
      || nativeWebGpuSurfaceConsumerTextureReadbackUnavailable
      || nativeWebGpuSurfaceConsumerBrowserFrameValidationRequired
    )
  );
  if (
    pngAnalyzedCanvasFrames.length > 0
    && blankCanvasFrameCount === pngAnalyzedCanvasFrames.length
    && !browserCanvasCaptureUnsupportedByNativeWebGpu
  ) {
    issues.push('visual-canvas-frames-all-blank');
  }
  if (
    !directResident
    && !residentSurfaceBufferHandoffAccepted
    && !nativeBrowserSurfaceProofAccepted
    && visibleSurfaceSampleCount === 0
  ) {
    issues.push('no-visible-surface-samples');
  }
  if (
    !directResident
    && h2oMaterialExpected
    && !residentSurfaceBufferHandoffAccepted
    && !nativeBrowserSurfaceProofAccepted
    && h2oVisibleSurfaceSampleCount === 0
  ) {
    issues.push('no-visible-h2o-surface-samples');
  }
  if (visualSurfaceIssues.some((item) => item.issue === 'visible-surface-outside-box')) issues.push('visible-surface-outside-box');
  if (visualSurfaceIssues.some((item) => item.issue === 'visible-surface-larger-than-box')) issues.push('visible-surface-larger-than-box');
  if (visualSurfaceIssues.some((item) => item.issue === 'visible-surface-expanded-beyond-particle-bounds')) {
    issues.push('visible-surface-expanded-beyond-particle-bounds');
  }
  if (visualSurfaceIssues.some((item) => item.issue === 'same-material-h2o-visible-phase-split')) {
    issues.push('same-material-h2o-visible-phase-split');
  }
  if (visualSurfaceIssues.some((item) => item.issue === 'same-material-h2o-nonliquid-visible-surface')) {
    issues.push('same-material-h2o-nonliquid-visible-surface');
  }
  if (visualSurfaceIssues.some((item) => item.issue === 'same-material-h2o-visible-surface-disappeared')) {
    issues.push('same-material-h2o-visible-surface-disappeared');
  }
  if (visualSurfaceIssues.some((item) => String(item.issue || '').startsWith('render-'))) {
    issues.push('render-depth-order-visual-trust');
  }
  if (visualSurfaceIssues.some((item) => item.issue === 'resident-visible-surface-clipped-to-particle-bounds')) {
    issues.push('resident-visible-surface-clipped-to-particle-bounds');
  }
  const browserConsoleIssueCounts = timeline?.browserConsole?.issueCounts || {};
  const browserConsoleWarningCounts = timeline?.browserConsole?.warningCounts || {};
  for (const [issue, count] of Object.entries(browserConsoleIssueCounts)) {
    if (Number(count) > 0) issues.push(`browser-console:${issue}`);
  }
  return {
    schema: 'peercompute.ulg.sph-history-long-horizon-analysis.v0',
    status: issues.length ? 'bad' : 'good',
    probeMode: timeline?.probeMode || 'scene',
    expectStatic,
    staticMaxDisplacementM,
    staticMaxCenterOfMassDeltaM,
    expectLiquidMerge,
    expectLiquidSettled,
    expectLiquidFreeSurface,
    liquidMergeMaxFinalSupportGapM,
    liquidSettledMinTimeS,
    liquidSettledMaxFinalDropSpeedMPerS,
    liquidFreeSurfaceMinTimeS,
    liquidFreeSurfaceMaxTallnessRatio,
    liquidFreeSurfaceMinFootprintFillRatio,
    liquidFreeSurfaceMaxHeightM: Number.isFinite(liquidFreeSurfaceMaxHeightM)
      ? liquidFreeSurfaceMaxHeightM
      : null,
    expectedH2oVisibleSurfaceCount: Number.isFinite(expectedH2oVisibleSurfaceCount)
      ? expectedH2oVisibleSurfaceCount
      : null,
    expectedMaterialPresent,
    expectedMaterialAbsent,
    minReactionEventsTotal: Number.isFinite(minReactionEventsTotal) ? minReactionEventsTotal : null,
    minVisualFrameTimeSpanS: Number.isFinite(minVisualFrameTimeSpanS) ? minVisualFrameTimeSpanS : null,
    visualOnly,
    visibleBoundsToleranceM,
    particleBoundsToleranceM,
    issues,
    productHistoryP2gGpuCountReceiptRequired,
    productHistoryP2gGpuCountReceiptAccepted,
    productHistoryP2gGpuCountReceipt,
    productHistoryRenderCommitGateReceiptRequired,
    productHistoryRenderCommitGateReceiptAccepted,
    productHistoryRenderCommitGateReceipt,
    browserConsoleIssueCounts,
    browserConsoleWarningCounts,
    browserConsoleIssueCount: Object.values(browserConsoleIssueCounts).reduce((sum, count) => sum + Number(count || 0), 0),
    browserConsoleWarningCount: Object.values(browserConsoleWarningCounts).reduce((sum, count) => sum + Number(count || 0), 0),
    initialPreflightStatus: initialPreflight?.status ?? null,
    initialPreflightBlockers,
    maxSpeedObservedMPerS,
    maxDisplacementObservedM,
    motionMaxSpeedObservedMPerS,
    motionMaxDisplacementObservedM,
    motionSpeedEvidenceSource,
    motionDisplacementEvidenceSource,
    compactSummaryDisabled,
    authoritativeCheckpointMotionEvidenceAvailable,
    authoritativeCheckpointMotionSampleCount: authoritativeCheckpointMotionSamples.length,
    authoritativeCheckpointMotionSamples,
    authoritativeCheckpointGlobalMassWeightedYSeriesM,
    authoritativeCheckpointMaxGlobalYDisplacementM,
    authoritativeCheckpointEstimatedMaxGlobalYSpeedMPerS,
    renderRowMotionEvidenceAvailable,
    directResidentNoReadbackActiveGridMotionEvidenceAvailable,
    activeGridPredictedMaxDisplacementM,
    activeGridPredictedMaxSpeedMPerS,
    renderRowMotionSampleCount: renderRowMotionSamples.length,
    renderRowMaxCenterDisplacementM,
    renderRowMaxBoundsCenterDisplacementM,
    renderRowMaxBoundsExtentDeltaM,
    renderRowMaxDisplacementM,
    renderRowEstimatedMaxCenterSpeedMPerS,
    renderRowEstimatedMaxBoundsCenterSpeedMPerS,
    renderRowEstimatedMaxBoundsExtentRateMPerS,
    renderRowEstimatedMaxSpeedMPerS,
    residentRenderSourceSampleCount: residentRenderSourceSamples.length,
    residentRenderSourceCurrentSampleCount,
    residentRenderSourceStaleSampleCount,
    // SURF-0. residentRenderSourceStaleSampleCount collapses three independent
    // causes into one number, which is enough to fail a gate and not enough to
    // fix one. These attribute each stale sample to the condition that actually
    // fired, so a repair can be aimed rather than guessed.
    residentRenderSourceStaleBreakdown,
    residentRenderSourceStaleRecovery,
    residentRenderSourceTransientRecoveredSampleCount:
      residentRenderSourceStaleRecovery.transientRecoveredSampleCount,
    residentRenderSourceUnrecoveredStaleSampleCount:
      residentRenderSourceStaleRecovery.unrecoveredSampleCount,
    residentRenderSourceRetentionReasonCounts,
    residentRenderSourceSampleTrace,
    residentRenderSourceNextStepSeries,
    residentRenderSourceNextTimeSeries,
    residentRenderSourceStepDelta,
    residentRenderSourceTimeDeltaS,
    residentRenderSourceAdvanced,
    residentRenderSourceMetricTimeDeltaS,
    residentRenderSourceTimeAdvanced,
    residentNoReadbackRenderSourceEvidenceAvailable,
    minActiveGridNodeCount,
    minVolumeObservedJ,
    maxVolumeObservedJ,
    maxPressureImpulseNSeconds,
    maxNextTimeS,
    firstNextCenterOfMassYM,
    lastNextCenterOfMassYM,
    nextCenterOfMassYDeltaM,
    minNextPositionBoundsYM: nextMinYSeries.length ? Math.min(...nextMinYSeries) : null,
    maxNextPositionBoundsYM: nextMaxYSeries.length ? Math.max(...nextMaxYSeries) : null,
    cohortDiagnosticsAvailableCount: cohortDiagnostics.length,
    firstDropCenterOfMassYM,
    lastDropCenterOfMassYM,
    dropCenterOfMassYDeltaM,
    firstDropBaseGapM,
    lastDropBaseGapM,
    dropBaseGapDeltaM,
    firstDropBaseSupportGapM,
    lastDropBaseSupportGapM,
    dropBaseSupportGapDeltaM,
    initialCenterGapYM: Number.isFinite(initialCenterGapYM) ? initialCenterGapYM : null,
    initialSupportGapYM: Number.isFinite(initialSupportGapYM) ? initialSupportGapYM : null,
    centerToSupportGapOffsetYM: Number.isFinite(centerToSupportGapOffsetYM) ? centerToSupportGapOffsetYM : null,
    minDropPositionBoundsYM: dropMinYSeries.length ? Math.min(...dropMinYSeries) : null,
    maxDropPositionBoundsYM: dropMaxYSeries.length ? Math.max(...dropMaxYSeries) : null,
    firstDropMaxSpeedMPerS,
    lastDropMaxSpeedMPerS,
    maxDropSpeedMPerS: dropMaxSpeedSeries.length ? Math.max(...dropMaxSpeedSeries) : null,
    firstH2oVisibleSurfaceCount,
    lastH2oVisibleSurfaceCount,
    finalParticlesByMaterial,
    finalParticlesByMaterialSource,
    authoritativeGpuCheckpointCapturedCount: capturedMaterialPhaseCheckpoints.length,
    authoritativeGpuCheckpointCapacityOverflowCount,
    authoritativeGpuCheckpointMappingIncompleteCount,
    authoritativeGpuCheckpointPhaseFractionProblemCount,
    authoritativeGpuCheckpointUnclassifiedCount,
    authoritativeGpuCheckpointMechanicsIncompleteCount,
    authoritativeGpuCheckpointVolumeRatioCapBoundaryCount,
    maxAuthoritativeGpuCheckpointVolumeRatioCapBoundaryParticleCount,
    finalMaterialPhases,
    maxReactionEventsTotal,
    reactionProgressGateEvidenceSource,
    reactionProgressGateSatisfied,
    authoritativeReactionProgressEvidence,
    capturedVisualFrameCount: capturedVisualFrames.length,
    pngAnalyzedVisualFrameCount: pngAnalyzedVisualFrames.length,
    pngAnalyzedCanvasFrameCount: pngAnalyzedCanvasFrames.length,
    nonblankVisualFrameCount,
    blankVisualFrameCount,
    blankCanvasFrameCount,
    nonblankCanvasFrameCount,
    browserCanvasPixelValidated,
    nativeBrowserFramePixelValidated,
    nativeBrowserFrameValidationStatus: nativeBrowserFrameValidation?.status ?? null,
    nativeBrowserFrameValidationReason: nativeBrowserFrameValidation?.reason ?? null,
    nativeBrowserFrameValidationRgbChannelSpan: nativeBrowserFrameValidation?.png?.rgbChannelSpan ?? null,
    nativeBrowserFrameValidationDistinctRgbColorCount:
      nativeBrowserFrameValidation?.png?.distinctRgbColorCount ?? null,
    nativeBrowserFrameCaptureUnsupportedCoveredByCurrentGpuProof,
    browserCanvasCaptureUnsupportedByNativeWebGpu,
    nativeWebGpuSurfaceConsumerBrowserFrameValidationRequired,
    visualFrameTimesS,
    visualFrameTimeSpanS,
    meanBatchMs,
    maxBatchMs,
    meanCompactSummaryMs,
    maxCompactSummaryMs,
    meanCompactSummaryMapAsyncMs,
    maxCompactSummaryMapAsyncMs,
    compactSummaryMeanBatchShare,
    compactSummaryMapAsyncMeanBatchShare,
    visualSurfaceIssues,
    maxVisibleSurfaceOutsideM,
    maxVisibleSurfaceOutsideParticleBoundsM,
    maxVisibleSurfaceComponentCount,
    maxVisibleSurfaceSmallComponentCount,
    minVisibleSurfaceLargestComponentRatio,
    maxH2oLiquidSurfaceHeightM,
    maxH2oLiquidSurfaceTallnessRatio,
    minH2oLiquidSurfaceFootprintFillRatio,
    lastH2oLiquidSurfaceHeightM,
    lastH2oLiquidSurfaceTallnessRatio,
    liquidFreeSurfaceBoundsSource,
    lastH2oLiquidSurfaceFootprintFillRatio,
    visibleSurfaceSampleCount,
    residentSurfaceBufferHandoffSampleCount,
    residentSurfaceBufferHandoffAccepted,
    residentSurfaceVisibleGpuConsumerSampleCount,
    residentSurfacePresentationAdmissionSampleCount,
    residentSurfaceForegroundProofSampleCount,
    residentSurfaceVisibleGpuConsumerInputReadySampleCount,
    residentSurfaceVisibleGpuConsumerAccepted,
    residentSurfacePresentationAdmissionAccepted,
    residentSurfaceForegroundProofAccepted,
    nativeWebGpuSurfaceConsumerAccepted,
    h2oVisibleSurfaceSampleCount,
    residentOverlayVisibleSampleCount: metrics.filter(residentOverlayVisible).length,
    workerOffscreenResidentParticleStateVisibleSampleCount,
    workerOffscreenResidentParticleStateReadyFrameCount
  };
}

export function probeStdoutPayload({
  output,
  stdoutMode,
  result,
  fullText
}) {
  if (!output || stdoutMode === 'full') return fullText;
  if (stdoutMode === 'none') return null;
  return `${JSON.stringify({
    schema: 'peercompute.ulg.sph-history-probe-stdout-summary.v0',
    status: result?.status ?? null,
    output,
    probeMode: result?.probeMode ?? null,
    scenarioUrl: result?.scenarioUrl ?? null,
    issueCount: Array.isArray(result?.analysis?.issues)
      ? result.analysis.issues.length
      : null
  })}\n`;
}

async function main() {
  const repoDir = path.resolve(process.env.ULG_PROBE_REPO_DIR || process.cwd());
  const scriptDir = path.dirname(new URL(import.meta.url).pathname);
  const currentRepoDir = path.resolve(scriptDir, '..');
  const depsDir = path.join(currentRepoDir, 'node_modules');
  const viteBin = process.env.ULG_PROBE_VITE_BIN || path.join(depsDir, 'vite', 'bin', 'vite.js');
  const output = process.env.ULG_PROBE_OUTPUT ? path.resolve(process.env.ULG_PROBE_OUTPUT) : null;
  const durableReleasePublication = durableProbeReleasePublicationEnabled();
  const requestedStdoutMode = String(
    process.env.ULG_PROBE_STDOUT_MODE || 'full'
  ).trim().toLowerCase();
  const stdoutMode = ['full', 'summary', 'none'].includes(requestedStdoutMode)
    ? requestedStdoutMode
    : 'full';
  const port = positiveInteger(process.env.ULG_PROBE_PORT, 5177);
  const externalBaseUrl = String(process.env.ULG_PROBE_BASE_URL || '').trim();
  const timeoutMs = positiveInteger(process.env.ULG_PROBE_TIMEOUT_MS, 180_000);
  const scenarioUrl = process.env.ULG_PROBE_URL || DEFAULT_URL;
  const probeMode = normalizedProbeMode(process.env.ULG_PROBE_MODE);
  const batches = positiveInteger(process.env.ULG_PROBE_BATCHES, 4);
  const batchSteps = positiveInteger(process.env.ULG_PROBE_BATCH_STEPS, 32);
  const interactiveCacheLifecycle = booleanEnv(
    process.env.ULG_PROBE_INTERACTIVE_CACHE_LIFECYCLE,
    false
  );
  const renderEvery = positiveInteger(process.env.ULG_PROBE_RENDER_EVERY, 1);
  const readbackMode = process.env.ULG_PROBE_READBACK_MODE === 'full-parity-readback'
    ? 'full-parity-readback'
    : 'no-full-readback';
  const compactSummaryScope = normalizedCompactSummaryScope(
    process.env.ULG_PROBE_COMPACT_SUMMARY_SCOPE,
    readbackMode === 'no-full-readback' ? 'particle-visual' : 'full'
  );
  const compactSummaryMode = ['none', 'plan-only', 'final-only', 'every-step'].includes(
    String(process.env.ULG_PROBE_COMPACT_SUMMARY_MODE || '').toLowerCase()
  )
    ? String(process.env.ULG_PROBE_COMPACT_SUMMARY_MODE).toLowerCase()
    : (readbackMode === 'no-full-readback' ? 'none' : 'final-only');
  const fuseResidentMechanicsSequence = process.env.ULG_PROBE_FUSE_RESIDENT_MECHANICS_SEQUENCE === '1'
    || process.env.ULG_PROBE_FUSE_NO_FULL_RESIDENT_MECHANICS_SEQUENCE === '1';
  const fuseResidentMechanicsActiveGrid = process.env.ULG_PROBE_FUSE_RESIDENT_ACTIVE_GRID === '1'
    || process.env.ULG_PROBE_FUSE_NO_FULL_RESIDENT_ACTIVE_GRID === '1'
    || process.env.ULG_PROBE_FUSE_RESIDENT_MECHANICS_ACTIVE_GRID === '1';
  const fusedActiveGridSafetyCells = process.env.ULG_PROBE_FUSE_RESIDENT_ACTIVE_GRID_SAFETY_CELLS == null
    ? null
    : positiveInteger(process.env.ULG_PROBE_FUSE_RESIDENT_ACTIVE_GRID_SAFETY_CELLS, null);
  const activeGridDispatchPlanRefreshMode = normalizedActiveGridPlanRefreshMode(
    process.env.ULG_PROBE_ACTIVE_GRID_PLAN_REFRESH_MODE
      ?? process.env.ULG_PROBE_RESIDENT_ACTIVE_GRID_PLAN_REFRESH
      ?? process.env.ULG_PROBE_ACTIVE_GRID_PLAN_REFRESH,
    ['none', 'plan-only'].includes(compactSummaryMode) ? 'final-only' : 'every-step'
  );
  const measureGpuQueueFence = booleanEnv(
    process.env.ULG_PROBE_MEASURE_GPU_QUEUE_FENCE
    ?? process.env.ULG_PROBE_MEASURE_FUSED_SEQUENCE_QUEUE_FENCE,
    false
  );
  const measureGpuTimestampInterval = booleanEnv(
    process.env.ULG_PROBE_MEASURE_GPU_TIMESTAMP_INTERVAL
      ?? process.env.ULG_PROBE_MEASURE_GPU_TIMESTAMPS,
    false
  );
  const measureGpuStageTimestamps = booleanEnv(
    process.env.ULG_PROBE_MEASURE_GPU_STAGE_TIMESTAMPS,
    false
  );
  const measureGpuStageEncoderSpans = booleanEnv(
    process.env.ULG_PROBE_MEASURE_GPU_STAGE_ENCODER_SPANS,
    true
  );
  const traceResidentStageWall = booleanEnv(
    process.env.ULG_PROBE_TRACE_RESIDENT_STAGE_WALL,
    false
  );
  const collectSchroederHierarchyHostTiming = booleanEnv(
    process.env.ULG_PROBE_COLLECT_SCHROEDER_HIERARCHY_HOST_TIMING,
    false
  );
  const renderReadbackModeEnv = String(process.env.ULG_PROBE_RENDER_READBACK_MODE || '').toLowerCase();
  const renderReadbackMode = renderReadbackModeEnv === 'no-full-readback'
    ? 'no-full-readback'
    : (renderReadbackModeEnv === 'full-parity-readback' ? 'full-parity-readback' : 'auto');
  const renderRowsReadbackModeEnv = String(process.env.ULG_PROBE_RENDER_ROWS_READBACK_MODE || '').toLowerCase();
  const renderRowsReadbackMode = renderRowsReadbackModeEnv === 'no-full-readback'
    ? 'no-full-readback'
    : (renderRowsReadbackModeEnv === 'full-parity-readback' ? 'full-parity-readback' : renderReadbackMode);
	const renderFieldSurfaceSummaryMode = ['skip', 'readback', 'auto'].includes(
	  String(process.env.ULG_PROBE_RENDER_FIELD_SURFACE_SUMMARY_MODE || '').toLowerCase()
	)
	  ? String(process.env.ULG_PROBE_RENDER_FIELD_SURFACE_SUMMARY_MODE).toLowerCase()
	  : 'auto';
	const nativeSurfaceDebugMode = normalizedNativeSurfaceDebugMode(
	  process.env.ULG_PROBE_NATIVE_SURFACE_DEBUG_MODE
	    ?? process.env.ULG_PROBE_NATIVE_WEBGPU_SURFACE_DEBUG_MODE,
	  'none'
	);
	const surfaceDrawDiagnosticModeEnv = String(
	  process.env.ULG_PROBE_SURFACE_DRAW_DIAGNOSTIC_MODE || ''
	).toLowerCase();
  const surfaceDrawDiagnosticModeFromUrl = surfaceDrawModeFromScenarioUrl(scenarioUrl);
  const nativeSurfaceRequestedFromRenderer =
    scenarioRequestsNativeSurfaceFromRenderer(scenarioUrl);
  const surfaceDrawDiagnosticMode = SURFACE_DRAW_DIAGNOSTIC_MODES.has(surfaceDrawDiagnosticModeEnv)
    ? surfaceDrawDiagnosticModeEnv
    : (
      surfaceDrawDiagnosticModeFromUrl
      || (nativeSurfaceRequestedFromRenderer
        ? 'native-webgpu-surface-consumer'
        : 'auto')
    );
  const nativeSurfaceValidationWaitMs = positiveInteger(
    process.env.ULG_PROBE_NATIVE_SURFACE_VALIDATION_WAIT_MS
      ?? process.env.ULG_PROBE_NATIVE_WEBGPU_SURFACE_VALIDATION_WAIT_MS,
    surfaceDrawDiagnosticMode === 'native-webgpu-surface-consumer'
      ? SPH_NATIVE_WEBGPU_SURFACE_VALIDATION_MAP_TIMEOUT_MS + 250
      : 0
  );
  const surfaceDrawDiagnosticMaxFieldCells = positiveInteger(
    process.env.ULG_PROBE_SURFACE_DRAW_DIAGNOSTIC_MAX_FIELD_CELLS,
    100000
  );
  const surfaceDrawDiagnosticMaxResolution = positiveInteger(
    process.env.ULG_PROBE_SURFACE_DRAW_DIAGNOSTIC_MAX_RESOLUTION,
    8
  );
  const nativeMarchingCubesMaxVertexRowsBufferByteLength = positiveInteger(
    process.env.ULG_PROBE_NATIVE_MARCHING_CUBES_MAX_VERTEX_ROWS_BUFFER_BYTES
      ?? process.env.ULG_PROBE_NATIVE_SURFACE_VERTEX_ROWS_BUFFER_BYTES,
    null
  );
  const nativeMarchingCubesMaxResolution = positiveInteger(
    process.env.ULG_PROBE_NATIVE_MARCHING_CUBES_MAX_RESOLUTION
      ?? process.env.ULG_PROBE_NATIVE_SURFACE_MAX_RESOLUTION,
    null
  );
  const disablePressureInterface = process.env.ULG_PROBE_DISABLE_PRESSURE === '1'
    || process.env.ULG_PROBE_DISABLE_PRESSURE_INTERFACE === '1';
  const materialInterfaceDiagnostic = booleanEnv(
    process.env.ULG_PROBE_MATERIAL_INTERFACE_DIAGNOSTIC
      ?? process.env.ULG_PROBE_FORCE_MATERIAL_INTERFACE_REFRESH,
    false
  );
  const materialInterfaceCandidateReadbackModeEnv = String(
    process.env.ULG_PROBE_MATERIAL_INTERFACE_CANDIDATE_READBACK_MODE
      ?? process.env.ULG_PROBE_MATERIAL_INTERFACE_READBACK_MODE
      ?? ''
  ).toLowerCase();
  const materialInterfaceCandidateReadbackMode = [
    'compact-active-readback',
    'dense-readback',
    'gpu-resident-summary'
  ].includes(materialInterfaceCandidateReadbackModeEnv)
    ? materialInterfaceCandidateReadbackModeEnv
    : 'compact-active-readback';
  const contactBinMetadataReadback = booleanEnv(
    process.env.ULG_PROBE_CONTACT_BIN_METADATA_READBACK
      ?? process.env.ULG_PROBE_PRESSURE_INTERFACE_CONTACT_BIN_METADATA_READBACK
      ?? process.env.ULG_PROBE_CONTACT_KINEMATICS_PARTICLE_BIN_METADATA_READBACK,
    false
  );
  const reactionBinMetadataReadback = booleanEnv(
    process.env.ULG_PROBE_REACTION_BIN_METADATA_READBACK
      ?? process.env.ULG_PROBE_REACTION_PARTICLE_BIN_METADATA_READBACK,
    false
  );
  const anomalyRowReadback = process.env.ULG_PROBE_ANOMALY_ROW_READBACK === '1'
    || process.env.ULG_PROBE_RENDER_ANOMALY_ROW_READBACK === '1';
  const residentBufferDebug = process.env.ULG_PROBE_RESIDENT_BUFFER_DEBUG === '1'
    || process.env.ULG_PROBE_RENDER_RESIDENT_BUFFER_DEBUG === '1';
  const thermalWallRate = process.env.ULG_PROBE_THERMAL_WALL_RATE == null
    ? null
    : finiteNumber(process.env.ULG_PROBE_THERMAL_WALL_RATE, null);
  const captureThermalCandidateCsrRouteEvidence = booleanEnv(
    process.env.ULG_PROBE_CAPTURE_THERMAL_CSR_ROUTE_EVIDENCE,
    false
  );
  const frameDir = process.env.ULG_PROBE_FRAME_DIR
    ? path.resolve(process.env.ULG_PROBE_FRAME_DIR)
    : null;
  const nativeSurfaceFrameValidationRequired =
    surfaceDrawDiagnosticMode === 'native-webgpu-surface-consumer';
  const captureH2VisibilityAblation = probeMode !== 'direct-resident'
    && booleanEnv(process.env.ULG_PROBE_CAPTURE_H2_VISIBILITY_ABLATION, false);
  const visualIntervalCaptureRequested = probeMode !== 'direct-resident'
    && (
      process.env.ULG_PROBE_CAPTURE_FRAMES === '1'
      || Boolean(frameDir)
    );
  const captureFrames = probeMode !== 'direct-resident'
    && (
      visualIntervalCaptureRequested
      || nativeSurfaceFrameValidationRequired
      || captureH2VisibilityAblation
    );
  const captureProductSurfacesOnly = probeMode !== 'direct-resident'
    && booleanEnv(process.env.ULG_PROBE_CAPTURE_PRODUCT_SURFACES_ONLY, false);
  const captureFrameEvery = positiveInteger(process.env.ULG_PROBE_FRAME_EVERY, 1);
  const captureFrameMax = positiveInteger(process.env.ULG_PROBE_FRAME_MAX, 64);
  const initialResidentWaitMs = positiveInteger(
    process.env.ULG_PROBE_INITIAL_RESIDENT_WAIT_MS,
    Math.min(timeoutMs, 5000)
  );
  const workerLaneProgressEverySteps = positiveInteger(
    process.env.ULG_PROBE_WORKER_PROGRESS_EVERY_STEPS,
    1
  );
  const useMountedResidentSchedule = booleanEnv(
    process.env.ULG_PROBE_USE_MOUNTED_RESIDENT_SCHEDULER,
    false
  );
  const artifactDetailMode = normalizeProbeArtifactDetailMode(
    process.env.ULG_PROBE_ARTIFACT_DETAIL_MODE || 'full'
  );
  const phaseVolumeMaxImpulseFraction =
    process.env.ULG_PROBE_PHASE_VOLUME_MAX_IMPULSE_FRACTION == null
      ? null
      : finiteNumber(
          process.env.ULG_PROBE_PHASE_VOLUME_MAX_IMPULSE_FRACTION,
          null
        );
  const generatedGasTargetMaterials = commaList(
    process.env.ULG_PROBE_GENERATED_GAS_TARGET_MATERIAL
  );
  if (generatedGasTargetMaterials.length > 1) {
    throw new RangeError(
      'ULG_PROBE_GENERATED_GAS_TARGET_MATERIAL requires exactly one material'
    );
  }
  const generatedGasTargetMaterial = generatedGasTargetMaterials[0] || null;
  const generatedGasMinimumMassKg = Math.max(
    0,
    finiteNumber(
      process.env.ULG_PROBE_GENERATED_GAS_MINIMUM_MASS_KG,
      0
    )
  );
  const generatedGasMinimumMassFractionOfSystem = Math.max(
    0,
    finiteNumber(
      process.env.ULG_PROBE_GENERATED_GAS_MINIMUM_MASS_FRACTION_OF_SYSTEM,
      1e-6
    )
  );
  const expectStatic = process.env.ULG_PROBE_EXPECT_STATIC === '1';
  const staticMaxDisplacementM = finiteNumber(process.env.ULG_PROBE_STATIC_MAX_DISPLACEMENT_M, 1e-6);
  const staticMaxCenterOfMassDeltaM = finiteNumber(process.env.ULG_PROBE_STATIC_MAX_COM_DELTA_M, 1e-6);
  const expectLiquidMerge = process.env.ULG_PROBE_EXPECT_LIQUID_MERGE === '1';
  const expectLiquidSettled = process.env.ULG_PROBE_EXPECT_LIQUID_SETTLE === '1'
    || process.env.ULG_PROBE_EXPECT_LIQUID_SETTLED === '1';
  const expectLiquidFreeSurface = process.env.ULG_PROBE_EXPECT_LIQUID_FREE_SURFACE === '1'
    || process.env.ULG_PROBE_EXPECT_LIQUID_LEVEL === '1';
  const liquidMergeMaxFinalSupportGapM = finiteNumber(
    process.env.ULG_PROBE_LIQUID_MERGE_MAX_FINAL_SUPPORT_GAP_M,
    0.005
  );
  const liquidSettledMinTimeS = finiteNumber(process.env.ULG_PROBE_LIQUID_SETTLE_MIN_TIME_S, 1);
  const liquidSettledMaxFinalDropSpeedMPerS = finiteNumber(
    process.env.ULG_PROBE_LIQUID_SETTLE_MAX_FINAL_DROP_SPEED,
    0.25
  );
  const liquidFreeSurfaceMinTimeS = finiteNumber(
    process.env.ULG_PROBE_LIQUID_FREE_SURFACE_MIN_TIME_S,
    0.25
  );
  const liquidFreeSurfaceMaxTallnessRatio = finiteNumber(
    process.env.ULG_PROBE_LIQUID_FREE_SURFACE_MAX_TALLNESS,
    0.75
  );
  const liquidFreeSurfaceMinFootprintFillRatio = finiteNumber(
    process.env.ULG_PROBE_LIQUID_FREE_SURFACE_MIN_FOOTPRINT_FILL,
    0.15
  );
  const liquidFreeSurfaceMaxHeightM = process.env.ULG_PROBE_LIQUID_FREE_SURFACE_MAX_HEIGHT_M == null
    ? null
    : finiteNumber(process.env.ULG_PROBE_LIQUID_FREE_SURFACE_MAX_HEIGHT_M, null);
  const expectedH2oVisibleSurfaceCount = process.env.ULG_PROBE_EXPECT_H2O_VISIBLE_SURFACE_COUNT == null
    ? null
    : positiveInteger(process.env.ULG_PROBE_EXPECT_H2O_VISIBLE_SURFACE_COUNT, null);
  const expectedMaterialPresent = commaList(process.env.ULG_PROBE_EXPECT_MATERIAL_PRESENT);
  const expectedMaterialAbsent = commaList(process.env.ULG_PROBE_EXPECT_MATERIAL_ABSENT);
  const minReactionEventsTotal = process.env.ULG_PROBE_MIN_REACTION_EVENTS_TOTAL == null
    ? null
    : positiveInteger(process.env.ULG_PROBE_MIN_REACTION_EVENTS_TOTAL, null);
  const minVisualFrameTimeSpanS = process.env.ULG_PROBE_MIN_VISUAL_FRAME_TIME_SPAN_S == null
    ? null
    : finiteNumber(process.env.ULG_PROBE_MIN_VISUAL_FRAME_TIME_SPAN_S, null);
  const visualOnly = process.env.ULG_PROBE_VISUAL_ONLY === '1'
    || process.env.ULG_PROBE_EXPECT_VISUAL_ONLY === '1';
  const visibleBoundsToleranceM = finiteNumber(process.env.ULG_PROBE_VISIBLE_BOUNDS_TOLERANCE_M, 0.05);
  const particleBoundsToleranceM = finiteNumber(process.env.ULG_PROBE_PARTICLE_BOUNDS_TOLERANCE_M, 0.2);
  const thresholds = {
    maxSpeedMPerS: finiteNumber(process.env.ULG_PROBE_MAX_SPEED, 50),
    minVolumeRatioJ: finiteNumber(process.env.ULG_PROBE_MIN_J, 0.2),
    maxVolumeRatioJ: finiteNumber(process.env.ULG_PROBE_MAX_J, 5),
    expectStatic,
    staticMaxDisplacementM,
    staticMaxCenterOfMassDeltaM,
    expectLiquidMerge,
    expectLiquidSettled,
    expectLiquidFreeSurface,
    liquidMergeMaxFinalSupportGapM,
    liquidSettledMinTimeS,
    liquidSettledMaxFinalDropSpeedMPerS,
    liquidFreeSurfaceMinTimeS,
    liquidFreeSurfaceMaxTallnessRatio,
    liquidFreeSurfaceMinFootprintFillRatio,
    liquidFreeSurfaceMaxHeightM,
    expectedH2oVisibleSurfaceCount,
    expectedMaterialPresent,
    expectedMaterialAbsent,
    minReactionEventsTotal,
    minVisualFrameTimeSpanS,
    visualOnly,
    visibleBoundsToleranceM,
    particleBoundsToleranceM
  };
  const nodeModules = await ensureNodeModules(repoDir, depsDir);
  const server = externalBaseUrl
    ? {
      baseUrl: externalBaseUrl,
      ready: waitForHttp(externalBaseUrl, timeoutMs),
      async stop() {}
    }
    : startViteServer({ repoDir, port, viteBin, timeoutMs });
  let result;
  try {
    await server.ready;
    const timeline = probeMode === 'direct-resident'
      ? await runDirectResidentProbe({
        baseUrl: server.baseUrl,
        scenarioUrl,
        timeoutMs,
        batches,
        batchSteps,
        readbackMode,
        compactSummaryMode,
        compactSummaryScope,
        thermalWallRate,
        fuseResidentMechanicsSequence,
        fuseResidentMechanicsActiveGrid,
        fusedActiveGridSafetyCells,
        activeGridDispatchPlanRefreshMode,
        measureGpuQueueFence,
        contactBinMetadataReadback,
        reactionBinMetadataReadback
      })
      : await runBrowserProbe({
        baseUrl: server.baseUrl,
        scenarioUrl,
        timeoutMs,
        batches,
        batchSteps,
        interactiveCacheLifecycle,
        renderEvery,
        readbackMode,
        compactSummaryMode,
        activeGridDispatchPlanRefreshMode,
        renderReadbackMode,
        renderRowsReadbackMode,
        renderFieldSurfaceSummaryMode,
        surfaceDrawDiagnosticMode,
        surfaceDrawDiagnosticMaxFieldCells,
        surfaceDrawDiagnosticMaxResolution,
        nativeMarchingCubesMaxVertexRowsBufferByteLength,
        nativeMarchingCubesMaxResolution,
        disablePressureInterface,
        contactBinMetadataReadback,
        reactionBinMetadataReadback,
        anomalyRowReadback,
        residentBufferDebug,
        compactSummaryScope,
        thermalWallRate,
        captureThermalCandidateCsrRouteEvidence,
        measureGpuQueueFence,
        measureGpuTimestampInterval,
        measureGpuStageTimestamps,
        measureGpuStageEncoderSpans,
        traceResidentStageWall,
        collectSchroederHierarchyHostTiming,
        materialInterfaceDiagnostic,
        materialInterfaceCandidateReadbackMode,
        nativeSurfaceDebugMode,
        nativeSurfaceValidationWaitMs,
        captureFrames,
        visualIntervalCaptureRequested,
        captureProductSurfacesOnly,
        captureH2VisibilityAblation,
        captureFrameEvery,
        captureFrameMax,
        initialResidentWaitMs,
        workerLaneProgressEverySteps,
        useMountedResidentSchedule,
        artifactDetailMode,
        phaseVolumeMaxImpulseFraction,
        generatedGasTargetMaterial,
        generatedGasMinimumMassKg,
        generatedGasMinimumMassFractionOfSystem
      });
    const visualFrameArtifacts = await persistCapturedFrames({
      frames: timeline?.visualFrames,
      frameDir: captureFrames ? frameDir : null,
      repoDir,
      durableReleasePublication
    });
    if (timeline && Array.isArray(timeline.visualFrames)) {
      timeline.visualFrames = visualFrameArtifacts.frames;
      if (timeline.nativeProductSurfaceOnlyCapture) {
        const productOnlyFrame = timeline.visualFrames.find(
          (frame) => frame?.phase === 'post-probe-native-product-draw-filter'
        ) || null;
        timeline.nativeProductSurfaceOnlyCapture.frameArtifactPath =
          productOnlyFrame?.path ?? null;
        timeline.nativeProductSurfaceOnlyCapture.framePng = productOnlyFrame?.png ? {
          status: productOnlyFrame.png.status,
          width: productOnlyFrame.png.width,
          height: productOnlyFrame.png.height,
          rgbChannelSpan: productOnlyFrame.png.rgbChannelSpan,
          distinctRgbColorCount: productOnlyFrame.png.distinctRgbColorCount,
          hasSurfaceLikeVariation: productOnlyFrame.png.hasSurfaceLikeVariation
        } : null;
      }
      if (timeline.nativeH2CompositedVisibilityCapture) {
        const phasePath = (phase) => timeline.visualFrames.find(
          (frame) => frame?.phase === phase
        )?.path ?? null;
        timeline.nativeH2CompositedVisibilityCapture.canonicalFrameArtifactPath =
          phasePath('post-probe-canvas-center-crop');
        timeline.nativeH2CompositedVisibilityCapture.h2AblatedFrameArtifactPath =
          phasePath('post-probe-native-h2-ablated-composited');
        timeline.nativeH2CompositedVisibilityCapture.h2OnlyFrameArtifactPath =
          phasePath('post-probe-native-h2-only');
        timeline.nativeH2CompositedVisibilityCapture.restoredCanonicalFrameArtifactPath =
          phasePath('post-probe-native-h2-visibility-restored-canonical');
      }
    }
    if (timeline?.visualFrameCapture) {
      timeline.visualFrameCapture.artifactStatus = visualFrameArtifacts.status;
      timeline.visualFrameCapture.frameDir = visualFrameArtifacts.frameDir ?? null;
      timeline.visualFrameCapture.analyzedFrameCount = visualFrameArtifacts.analyzedFrameCount ?? 0;
      timeline.visualFrameCapture.writtenFrameCount = visualFrameArtifacts.writtenFrameCount ?? 0;
    }
    const analysis = analyzeTimeline(timeline, {
      ...thresholds,
      expectStatic,
      staticMaxDisplacementM,
      staticMaxCenterOfMassDeltaM,
      expectLiquidMerge,
      expectLiquidSettled,
      expectLiquidFreeSurface,
      liquidMergeMaxFinalSupportGapM,
      liquidSettledMinTimeS,
      liquidSettledMaxFinalDropSpeedMPerS,
      liquidFreeSurfaceMinTimeS,
      liquidFreeSurfaceMaxTallnessRatio,
      liquidFreeSurfaceMinFootprintFillRatio,
      liquidFreeSurfaceMaxHeightM,
      expectedH2oVisibleSurfaceCount,
      expectedMaterialPresent,
      expectedMaterialAbsent,
      minReactionEventsTotal,
      minVisualFrameTimeSpanS,
      visualOnly,
      visibleBoundsToleranceM,
      particleBoundsToleranceM,
      boxDimsM: boxDimsFromScenarioUrl(scenarioUrl),
      scenarioUrl
    });
    const packagePath = path.join(repoDir, 'package.json');
    const packageStat = await lstat(packagePath).catch(() => null);
    result = {
      schema: 'peercompute.ulg.sph-history-probe-result.v0',
      status: analysis.status,
      repoDir,
      packageExists: Boolean(packageStat),
      nodeModules,
      baseUrl: server.baseUrl,
      browserLaunch: probeChromiumLaunchReport(),
      probeMode,
      scenarioUrl: probeMode === 'direct-resident'
        ? scenarioUrl
        : withBrowserProbeParams(scenarioUrl, { contactBinMetadataReadback, reactionBinMetadataReadback }),
      presentationSelection: {
        surfaceDrawDiagnosticMode,
        nativeSurfaceRequestedFromRenderer,
        nativeSurfaceValidationWaitMs
      },
      thresholds,
      visualFrameArtifacts,
      timeline,
      analysis
    };
  } finally {
    await server.stop();
  }
  const text = `${JSON.stringify(result, null, 2)}\n`;
  if (output) {
    if (durableReleasePublication) {
      await publishProbeReleaseArtifact({
        artifactPath: output,
        repoDir,
        bytes: Buffer.from(text, 'utf8'),
        label: 'SPH long-horizon JSON output'
      });
    } else {
      await mkdir(path.dirname(output), { recursive: true });
      await writeFile(output, text, 'utf8');
    }
  }
  const stdoutPayload = probeStdoutPayload({
    output,
    stdoutMode,
    result,
    fullText: text
  });
  if (stdoutPayload != null) process.stdout.write(stdoutPayload);
  if (process.env.ULG_PROBE_FAIL_ON_BAD === '1' && result.status === 'bad') {
    process.exitCode = 1;
  }
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
