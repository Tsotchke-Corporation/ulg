import { spawn } from 'node:child_process';
import { access, lstat, mkdir, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { inflateSync } from 'node:zlib';
import { chromium } from '@playwright/test';

const DEFAULT_URL = '/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1&dropn=3&basen=5&boxx=5&boxy=5&boxz=5&visualCapture=1&residentAuto=0';
const DEFAULT_WALL_TEMPERATURE_K = 283.15;
const DEFAULT_DROP_TEMPERATURE_K = 1850;
const DEFAULT_BASE_TEMPERATURE_K = 233.15;
const DEFAULT_ICE_BASE_HEIGHT_M = 0;
const DEFAULT_IRON_BASE_HEIGHT_M = 2.5;
const DEFAULT_BOX_DIMS_M = [5, 5, 5];
const DEFAULT_DROP_PARTICLE_EDGE = 3;
const DEFAULT_BASE_PARTICLE_EDGE = 5;
const DEFAULT_CHROMIUM_ARGS = ['--enable-unsafe-webgpu'];
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

function compactBrowserConsoleLocation(message) {
  const location = typeof message?.location === 'function' ? message.location() : null;
  if (!location) return null;
  return {
    url: location.url || null,
    lineNumber: Number.isFinite(Number(location.lineNumber)) ? Number(location.lineNumber) : null,
    columnNumber: Number.isFinite(Number(location.columnNumber)) ? Number(location.columnNumber) : null
  };
}

function createBrowserConsoleCapture() {
  const entries = [];
  const issues = [];
  const pageErrors = [];
  const issueCounts = {};
  const warningCounts = {};
  let droppedEntryCount = 0;
  let droppedIssueCount = 0;

  const recordEntry = (entry) => {
    const classification = classifyBrowserConsoleText(entry.text);
    const compact = {
      ...entry,
      ...classification
    };
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
        warningTypes: Object.keys(warningCounts)
      };
    }
  };
}

function attachBrowserConsoleTelemetry(timeline, capture) {
  if (!timeline || typeof timeline !== 'object' || !capture) return timeline;
  timeline.pageConsole = [...capture.entries];
  timeline.pageErrors = [...capture.pageErrors];
  timeline.browserConsole = capture.summary();
  timeline.browserConsoleIssues = [...capture.issues];
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
  return {
    args,
    ...(channel ? { channel } : {}),
    ...(executablePath ? { executablePath } : {})
  };
}

function probeChromiumLaunchReport() {
  const options = probeChromiumLaunchOptions();
  return {
    schema: 'peercompute.ulg.sph-probe-browser-launch.v0',
    channel: options.channel || null,
    executablePath: options.executablePath || null,
    args: [...options.args],
    page: probePageReport()
  };
}

async function launchProbeBrowser() {
  return chromium.launch(probeChromiumLaunchOptions());
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

function normalizedNativeSurfaceDebugMode(value, fallback = 'none') {
  if (value == null || String(value).trim() === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (NATIVE_SURFACE_DEBUG_MODES.has(normalized)) return normalized;
  if (normalized === 'clear' || normalized === 'clearonly' || normalized === 'sentinel-clear') return 'clear-only';
  return fallback;
}

function probePageOptions() {
  const viewport = {
    width: positiveInteger(process.env.ULG_PROBE_VIEWPORT_WIDTH, 1280),
    height: positiveInteger(process.env.ULG_PROBE_VIEWPORT_HEIGHT, 800)
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
  return browser.newPage(probePageOptions());
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

function analyzePngFrame(bytes) {
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
    let previous = Buffer.alloc(rowBytes);
    let nonzeroRgbPixelCount = 0;
    let nonzeroAlphaPixelCount = 0;
    let opaquePixelCount = 0;
    let transparentPixelCount = 0;
    let maxChannel = 0;
    let minAlpha = 255;
    let maxAlpha = 0;
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
      for (let x = 0; x < width; x += 1) {
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
        if (r > 0 || g > 0 || b > 0) nonzeroRgbPixelCount += 1;
        if (a > 0) nonzeroAlphaPixelCount += 1;
        if (a >= 255) opaquePixelCount += 1;
        if (a === 0) transparentPixelCount += 1;
        maxChannel = Math.max(maxChannel, r, g, b, a);
        minAlpha = Math.min(minAlpha, a);
        maxAlpha = Math.max(maxAlpha, a);
      }
      previous = row;
    }
    const pixelCount = width * height;
    return {
      status: 'ready',
      width,
      height,
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
      minAlpha,
      maxAlpha,
      allTransparentBlack: nonzeroRgbPixelCount === 0 && nonzeroAlphaPixelCount === 0,
      allBlack: nonzeroRgbPixelCount === 0,
      hasVisiblePixels: nonzeroRgbPixelCount > 0 && nonzeroAlphaPixelCount > 0
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

async function persistCapturedFrames({ frames, frameDir }) {
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
  if (shouldWriteFrames) await mkdir(frameDir, { recursive: true });
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
      await writeFile(filePath, bytes);
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
            height: canvas.height ?? null
          };
        })
        .filter((entry) => entry.visible);
      const fallbackCanvas = canvases.at(-1) || null;
      const fallbackRect = fallbackCanvas?.getBoundingClientRect?.() || null;
      const selected = visibleCanvases.at(-1) || (fallbackCanvas
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
            height: fallbackCanvas.height ?? null
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
    const screenshot = clipRect
      ? await page.screenshot({ type: 'png', clip: clipRect })
      : await page.locator('canvas').nth(selected.index).screenshot({ type: 'png' });
    return {
      ...base,
      status: 'captured',
      width: clipRect?.width ?? selected.width ?? null,
      height: clipRect?.height ?? selected.height ?? null,
      canvasCount: canvasSummary.canvasCount ?? null,
      visibleCanvasCount: canvasSummary.visibleCanvasCount ?? null,
      canvasIndex: selected.index,
      canvasCssX: clipRect?.x ?? selected.rect?.x ?? null,
      canvasCssY: clipRect?.y ?? selected.rect?.y ?? null,
      canvasCssWidth: clipRect?.width ?? selected.rect?.width ?? null,
      canvasCssHeight: clipRect?.height ?? selected.rect?.height ?? null,
      canvasDevicePixelRatio: canvasSummary.devicePixelRatio ?? null,
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
      residentSteps: residentSteps ? {
        schema: residentSteps.schema ?? null,
        status: residentSteps.status ?? null,
        backend: residentSteps.backend ?? null,
        completedStepCount: residentSteps.completedStepCount ?? null,
        readbackMode: residentSteps.readbackMode ?? null
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
  const timeout = new Promise((resolve) => {
    setTimeout(() => resolve({
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
  }
}

function startViteServer({ repoDir, port, viteBin, timeoutMs }) {
  const proc = spawn(process.execPath, [viteBin, '--host', '127.0.0.1', '--port', String(port)], {
    cwd: repoDir,
    env: {
      ...process.env,
      FORCE_COLOR: '0',
      NO_COLOR: '1'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const logs = [];
  proc.stdout.on('data', (chunk) => logs.push(String(chunk)));
  proc.stderr.on('data', (chunk) => logs.push(String(chunk)));
  const baseUrl = `http://127.0.0.1:${port}`;
  return {
    proc,
    baseUrl,
    logs,
    ready: waitForHttp(baseUrl, timeoutMs),
    stop() {
      if (!proc.killed) proc.kill('SIGTERM');
    }
  };
}

async function runBrowserProbe({
  baseUrl,
  scenarioUrl,
  timeoutMs,
  batches,
  batchSteps,
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
  disablePressureInterface,
  contactBinMetadataReadback = false,
  reactionBinMetadataReadback = false,
  anomalyRowReadback,
  residentBufferDebug,
  compactSummaryScope,
  thermalWallRate,
  measureGpuQueueFence = false,
  nativeSurfaceDebugMode = 'none',
  nativeSurfaceValidationWaitMs = 0,
  captureFrames,
  captureFrameEvery,
  captureFrameMax,
  initialResidentWaitMs
}) {
  const browser = await launchProbeBrowser();
  const page = await newProbePage(browser);
  const preProbeSnapshots = [];
  const consoleCapture = createBrowserConsoleCapture();
  const pageConsole = consoleCapture.entries;
  page.on('console', (message) => {
    consoleCapture.recordConsole(message);
  });
  page.on('pageerror', (error) => {
    consoleCapture.recordPageError(error);
  });
  try {
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
    await page.goto(target, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    if (await page.locator('#sph-phase-overlay').count() === 0) {
      await page.locator('#run-sph-phase').click({ timeout: timeoutMs });
    }
    await page.waitForSelector('#sph-phase-overlay', { timeout: timeoutMs });
    preProbeSnapshots.push(await collectBrowserSnapshot(page, 'overlay-ready'));
    await page.waitForFunction(() => {
      const overlay = document.querySelector('#sph-phase-overlay');
      const scene = overlay?.__sphScene;
      return Boolean(scene?.getSphGpuParticleState?.()?.schema || overlay?.__sphDriver);
    }, null, { timeout: timeoutMs });
    preProbeSnapshots.push(await collectBrowserSnapshot(page, 'particle-state-ready'));
    const playText = await page.locator('#sph-play').textContent({ timeout: timeoutMs }).catch(() => '');
    if (/Pause/i.test(playText || '')) {
      await page.evaluate(() => document.querySelector('#sph-play')?.click());
    }
    const residentWaitMs = Math.max(1, Math.min(timeoutMs, initialResidentWaitMs));
    await page.waitForFunction(() => {
      const overlay = document.querySelector('#sph-phase-overlay');
      const scene = overlay?.__sphScene;
      const steps = scene?.getMlsMpmResidentSteps?.() || overlay?.__mlsMpmResidentSteps;
      return Boolean(steps?.schema || overlay?.__sphDriver);
    }, null, { timeout: residentWaitMs }).catch(() => null);
    await page.waitForFunction(() => {
      const overlay = document.querySelector('#sph-phase-overlay');
      return !overlay?.__mlsMpmResidentStepsPending;
    }, null, { timeout: residentWaitMs }).catch(() => null);
    preProbeSnapshots.push(await collectBrowserSnapshot(page, 'before-in-page-probe'));

    const inPageProbe = page.evaluate(async ({
      batches: requestedBatches,
      batchSteps: requestedBatchSteps,
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
      disablePressureInterface: requestedDisablePressureInterface,
      contactBinMetadataReadback: requestedContactBinMetadataReadback,
      reactionBinMetadataReadback: requestedReactionBinMetadataReadback,
      anomalyRowReadback: requestedAnomalyRowReadback,
      residentBufferDebug: requestedResidentBufferDebug,
      compactSummaryScope: requestedCompactSummaryScope,
	      thermalWallRate: requestedThermalWallRate,
	      measureGpuQueueFence: requestedMeasureGpuQueueFence,
	      nativeSurfaceDebugMode: requestedNativeSurfaceDebugMode,
	      nativeSurfaceValidationWaitMs: requestedNativeSurfaceValidationWaitMs,
	      captureFrames: requestedCaptureFrames,
      captureFrameEvery: requestedCaptureFrameEvery,
      captureFrameMax: requestedCaptureFrameMax,
      preProbeSnapshots: requestedPreProbeSnapshots,
      pageConsole: requestedPageConsole
    }) => {
      const overlay = document.querySelector('#sph-phase-overlay');
      const sceneApi = overlay?.__sphScene || null;
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
        residentAuthorityThermoOwner: diagnostics.residentAuthorityThermoOwner ?? null
      } : null;
      const compactStageTiming = (stageTiming) => stageTiming ? {
        totalMs: finiteOrNull(stageTiming.totalMs),
        stageMs: { ...(stageTiming.stageMs || {}) },
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
      let execution = sceneApi.getMlsMpmResidentSteps?.() || overlay.__mlsMpmResidentSteps || null;
      const shouldCaptureFrame = (batchIndex, phase) => {
        if (!requestedCaptureFrames) return false;
        if (visualFrames.length >= requestedCaptureFrameMax) return false;
        if (batchIndex === 0 || batchIndex === requestedBatches) return true;
        if (String(phase || '').includes('error') || String(phase || '').includes('anomaly')) return true;
        return batchIndex % requestedCaptureFrameEvery === 0;
      };
      const captureFrame = (batchIndex, phase, sampleIndex) => {
        if (!shouldCaptureFrame(batchIndex, phase)) return;
        const canvases = Array.from(document.querySelectorAll('canvas'));
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
        const canvas = visibleCanvases.at(-1) || canvases.at(-1) || canvases[0] || null;
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
        if (!canvas) {
          visualFrames.push({ ...base, status: 'missing-canvas', reason: 'no-canvas-element' });
          return;
        }
        try {
          visualFrames.push({
            ...base,
            status: 'captured',
            width: canvas.width ?? null,
            height: canvas.height ?? null,
            dataUrl: canvas.toDataURL('image/png')
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
      const nativeSurfaceValidationSnapshot = () => {
        const renderState = sceneApi.getSphResidentRenderState?.() || overlay.__sphResidentRenderState || null;
        const surfaceDraw = sceneApi.getSphResidentSurfaceDraw?.() || overlay.__sphResidentSurfaceDraw || null;
        const bridge = sceneApi.getSphResidentSurfaceDrawRenderBridge?.() || null;
        const bridgeMode = renderState?.surfaceDrawVisibleRendererBridge
          ?? surfaceDraw?.visibleRendererBridge
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
        const ready = Boolean(
          renderState?.surfaceDrawVisibleGpuConsumerReady
          || surfaceDraw?.surfaceDrawVisibleGpuConsumerReady
        );
        const pixelValidationStatus =
          renderState?.surfaceDrawVisibleGpuConsumerPixelValidationStatus
          ?? surfaceDraw?.surfaceDrawVisibleGpuConsumerPixelValidationStatus
          ?? bridge?.pixelValidationStatus
          ?? null;
        const pixelValidationReason =
          renderState?.surfaceDrawRenderBridgePixelValidationReason
          ?? surfaceDraw?.renderBridgePixelValidationReason
          ?? bridge?.pixelValidationReason
          ?? null;
        const readbackSmokeValidationStatus =
          renderState?.surfaceDrawVisibleGpuConsumerNativeReadbackSmokeValidationStatus
          ?? surfaceDraw?.surfaceDrawVisibleGpuConsumerNativeReadbackSmokeValidationStatus
          ?? renderState?.surfaceDrawRenderBridgeReadbackSmokeValidationStatus
          ?? surfaceDraw?.renderBridgeReadbackSmokeValidationStatus
          ?? bridge?.readbackSmokeValidationStatus
          ?? null;
        const readbackSmokeValidationReason =
          renderState?.surfaceDrawRenderBridgeReadbackSmokeValidationReason
          ?? surfaceDraw?.renderBridgeReadbackSmokeValidationReason
          ?? bridge?.readbackSmokeValidationReason
          ?? null;
        const offscreenValidationStatus =
          renderState?.surfaceDrawVisibleGpuConsumerNativeOffscreenValidationStatus
          ?? surfaceDraw?.surfaceDrawVisibleGpuConsumerNativeOffscreenValidationStatus
          ?? renderState?.surfaceDrawRenderBridgeOffscreenValidationStatus
          ?? surfaceDraw?.renderBridgeOffscreenValidationStatus
          ?? bridge?.offscreenValidationStatus
          ?? null;
        const offscreenValidationReason =
          renderState?.surfaceDrawRenderBridgeOffscreenValidationReason
          ?? surfaceDraw?.renderBridgeOffscreenValidationReason
          ?? bridge?.offscreenValidationReason
          ?? null;
        const validationBlockerFamily =
          renderState?.surfaceDrawVisibleGpuConsumerNativeValidationBlockerFamily
          ?? surfaceDraw?.visibleGpuConsumerNativeValidationBlockerFamily
          ?? null;
        const textureReadbackUnavailable =
          renderState?.surfaceDrawVisibleGpuConsumerNativeTextureReadbackUnavailable
          ?? surfaceDraw?.visibleGpuConsumerNativeTextureReadbackUnavailable
          ?? null;
        const deviceMapSmokeStatus =
          renderState?.surfaceDrawVisibleGpuConsumerNativeDeviceMapSmokeStatus
          ?? surfaceDraw?.visibleGpuConsumerNativeDeviceMapSmokeStatus
          ?? null;
        const deviceTextureReadbackSmokeStatus =
          renderState?.surfaceDrawVisibleGpuConsumerNativeDeviceTextureReadbackSmokeStatus
          ?? surfaceDraw?.visibleGpuConsumerNativeDeviceTextureReadbackSmokeStatus
          ?? null;
        const deviceTextureReadbackSmokeReason =
          renderState?.surfaceDrawVisibleGpuConsumerNativeDeviceTextureReadbackSmokeReason
          ?? surfaceDraw?.visibleGpuConsumerNativeDeviceTextureReadbackSmokeReason
          ?? null;
        const validationScope =
          renderState?.surfaceDrawRenderBridgeNativeSurfaceValidationScope
          ?? surfaceDraw?.renderBridgeNativeSurfaceValidationScope
          ?? surfaceDraw?.surfaceDrawRenderBridgeNativeSurfaceValidationScope
          ?? bridge?.nativeSurfaceValidationScope
          ?? null;
        const offscreenValidationEligible =
          renderState?.surfaceDrawRenderBridgeNativeSurfaceOffscreenValidationEligible
          ?? surfaceDraw?.renderBridgeNativeSurfaceOffscreenValidationEligible
          ?? surfaceDraw?.surfaceDrawRenderBridgeNativeSurfaceOffscreenValidationEligible
          ?? bridge?.nativeSurfaceOffscreenValidationEligible
          ?? null;
        const offscreenValidationSkippedReason =
          renderState?.surfaceDrawRenderBridgeNativeSurfaceOffscreenValidationSkippedReason
          ?? surfaceDraw?.renderBridgeNativeSurfaceOffscreenValidationSkippedReason
          ?? surfaceDraw?.surfaceDrawRenderBridgeNativeSurfaceOffscreenValidationSkippedReason
          ?? bridge?.nativeSurfaceOffscreenValidationSkippedReason
          ?? null;
        const frameCount = Number(
          renderState?.surfaceDrawRenderBridgeFrameCount
          ?? surfaceDraw?.renderBridgeFrameCount
          ?? bridge?.frameCount
          ?? 0
        ) || 0;
        const gpuBufferHandoffReady = Boolean(
          renderState?.surfaceDrawGpuBufferHandoffReady
          ?? surfaceDraw?.gpuBufferHandoffReady
        );
        const gpuBufferHandoffStatus =
          renderState?.surfaceDrawGpuBufferHandoffStatus
          ?? surfaceDraw?.gpuBufferHandoffStatus
          ?? null;
        const gpuBufferHandoffReason =
          renderState?.surfaceDrawGpuBufferHandoffReason
          ?? surfaceDraw?.gpuBufferHandoffReason
          ?? null;
        const renderBridgeStatus =
          renderState?.surfaceDrawRenderBridgeStatus
          ?? surfaceDraw?.renderBridgeStatus
          ?? bridge?.status
          ?? null;
        const renderBridgeLastRenderStatus =
          renderState?.surfaceDrawRenderBridgeLastRenderStatus
          ?? surfaceDraw?.renderBridgeLastRenderStatus
          ?? bridge?.lastRenderStatus
          ?? null;
        const pending = [pixelValidationStatus, readbackSmokeValidationStatus, offscreenValidationStatus]
          .some((status) => status === 'pending');
        return {
          native: true,
          ready,
          pending,
          status: ready
            ? 'native-surface-visible-consumer-ready'
            : (pending ? 'native-surface-validation-pending' : 'native-surface-validation-settled-not-ready'),
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
          validationScope,
          offscreenValidationEligible,
          offscreenValidationSkippedReason,
          frameCount
        };
      };
      const waitForNativeSurfaceValidation = async (batchIndex) => {
        const timeout = Math.max(0, Number(requestedNativeSurfaceValidationWaitMs) || 0);
        let snapshot = nativeSurfaceValidationSnapshot();
        if (!snapshot.native || timeout <= 0 || snapshot.ready) return snapshot;
        const started = performance.now();
        let observedPending = Boolean(snapshot.pending);
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
          observedPending = observedPending || Boolean(snapshot.pending);
          if (snapshot.ready || (observedPending && !snapshot.pending)) break;
        }
        markProbeProgress('native-surface-validation-wait-completed', {
          batchIndex,
          elapsedMs: performance.now() - started,
          ...snapshot
        });
        return snapshot;
      };
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
      const sample = (batchIndex, phase, batchMs = null) => {
        const steps = sceneApi.getMlsMpmResidentSteps?.() || overlay.__mlsMpmResidentSteps || execution || null;
        const residentStep = sceneApi.getMlsMpmResidentStep?.() || overlay.__mlsMpmResidentStep || steps?.finalStep || null;
        const sceneUserData = sceneApi?.scene?.userData || {};
        const renderState = sceneApi.getSphResidentRenderState?.() || overlay.__sphResidentRenderState || null;
        const surfaceDraw = sceneApi.getSphResidentSurfaceDraw?.() || overlay.__sphResidentSurfaceDraw || null;
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
        residentWebGpuDeviceMapSmoke: sceneUserData.sphResidentWebGpuDeviceMapSmoke || null,
        residentWebGpuDeviceTextureReadbackSmoke:
          sceneUserData.sphResidentWebGpuDeviceTextureReadbackSmoke || null,
        nativeSurfaceValidation: nativeSurfaceValidationSnapshot(),
        residentRenderProgress: sceneUserData.sphResidentRenderProgress || null,
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
          residentProductMassStatus: overlay.__sphResidentGasPressureSummary.residentProductMassStatus ?? null,
          residentProductMassGasSpeciesLedgerCount: overlay.__sphResidentGasPressureSummary.residentProductMassGasSpeciesLedgerCount ?? null,
          residentLedgerStatus: overlay.__sphResidentGasPressureSummary.residentLedgerStatus ?? null,
          bySpeciesKeys: Object.keys(overlay.__sphResidentGasPressureSummary.bySpecies || {})
        } : null,
        residentSteps: steps ? {
            schema: steps.schema ?? null,
            backend: steps.backend ?? null,
            status: steps.status ?? null,
            stepCount: steps.stepCount ?? null,
            completedStepCount: steps.completedStepCount ?? null,
            readbackMode: steps.readbackMode ?? null,
            requestedReadbackMode: steps.requestedReadbackMode ?? null,
            compactSummaryScope: steps.compactSummaryScope ?? null,
            continuedFromResidentState: steps.continuedFromResidentState ?? null,
            continuationAvailable: steps.continuationAvailable ?? null,
            nextActiveGridDispatchPlanHintStatus: steps.nextSphParticleState?.residentActiveGridDispatchPlanHint?.status ?? null,
            nextActiveGridDispatchPlanHintSource: steps.nextSphParticleState?.residentActiveGridDispatchPlanHint?.source ?? null,
            nextActiveGridDispatchPlanHintDispatchArgsBufferByteLength: steps.nextSphParticleState?.residentActiveGridDispatchPlanHint?.dispatchArgsBufferByteLength ?? 0,
            nextActiveGridDispatchPlanHintMetadataBufferByteLength: steps.nextSphParticleState?.residentActiveGridDispatchPlanHint?.metadataBufferByteLength ?? 0,
            nextUploadActiveGridDispatchPlanHintStatus: steps.nextParticleUploads?.activeGridDispatchPlanHint?.status ?? null,
            nextUploadActiveGridDispatchPlanHintSource: steps.nextParticleUploads?.activeGridDispatchPlanHint?.source ?? null,
            nextUploadActiveGridDispatchPlanHintDispatchArgsBufferByteLength: steps.nextParticleUploads?.activeGridDispatchPlanHint?.dispatchArgsBufferByteLength ?? 0,
            nextUploadActiveGridDispatchPlanHintMetadataBufferByteLength: steps.nextParticleUploads?.activeGridDispatchPlanHint?.metadataBufferByteLength ?? 0,
            normalHotLoopReadbackFree: steps.normalHotLoopReadbackFree === true,
            residentExecutionPolicy: steps.residentExecutionPolicy || overlay?.__mlsMpmResidentExecutionPolicy || null,
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
            finalStepStageTiming: compactStageTiming(steps.finalStep?.stageTiming),
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
            particlePingPong: residentStep.particlePingPong ? {
              sourceStep: residentStep.particlePingPong.sourceStep ?? null,
              nextStep: residentStep.particlePingPong.nextStep ?? null,
              sourceTime: finiteOrNull(residentStep.particlePingPong.sourceTime),
              nextTime: finiteOrNull(residentStep.particlePingPong.nextTime)
            } : null,
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
            surfaceDrawExtensionSurfaceTranslationPipelineCacheStatus:
              renderState.surfaceDrawExtensionSurfaceTranslationPipelineCacheStatus ?? null,
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
            surfaceDrawRenderBridgeFrameCount: renderState.surfaceDrawRenderBridgeFrameCount ?? null,
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
            visibleGpuConsumerRenderBridgeMode: surfaceDraw.surfaceDrawVisibleGpuConsumerRenderBridgeMode ?? null,
            visibleGpuConsumerRenderBridgeStatus: surfaceDraw.surfaceDrawVisibleGpuConsumerRenderBridgeStatus ?? null,
            visibleGpuConsumerRendererCapabilityStatus:
              surfaceDraw.surfaceDrawVisibleGpuConsumerRendererCapabilityStatus ?? null,
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
      if (requestedCaptureFrames) {
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
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
            gasPressureSummary: overlay.__sphResidentGasPressureSummary || null
          });
          overlay.__sphResidentSurfaceDraw = sceneApi.getSphResidentSurfaceDraw?.() || null;
          sceneApi.refreshViewportAndOverlay?.({ reason: 'sph-long-horizon-probe-initial-render-refresh' });
          await new Promise((resolve) => requestAnimationFrame(resolve));
          markProbeProgress('initial-render-state-completed', {
            status: overlay.__sphResidentRenderState?.status ?? null,
            renderRowsReadback: overlay.__sphResidentRenderState?.renderRowsReadback ?? null
          });
        } catch (error) {
          markProbeProgress('initial-render-state-skipped', {
            reason: error instanceof Error ? error.message : String(error)
          });
        }
      }
      markProbeProgress('sampling-initial-state');
      metrics.push(sample(0, 'initial', 0));
      captureFrame(0, 'initial', metrics.length - 1);
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
            metrics.push(metric);
            captureFrame(batchIndex, 'plain-sph-cpu-reference-batch', metrics.length - 1);
            previousState = nextState;
          } catch (error) {
            markProbeProgress('plain-sph-batch-error', {
              batchIndex,
              batchMs: performance.now() - started,
              error: error instanceof Error ? error.message : String(error)
            });
            errors.push({ batchIndex, message: error instanceof Error ? error.message : String(error) });
            metrics.push(sample(batchIndex, 'plain-sph-cpu-reference-error', performance.now() - started));
            captureFrame(batchIndex, 'plain-sph-cpu-reference-error', metrics.length - 1);
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
          visualFrames,
          errors,
          metrics,
          scientificValidation: false,
          sphValidation: false,
          phaseChangeValidation: false,
          fullPhysicsValidation: false
        };
      }
      for (let batchIndex = 1; batchIndex <= requestedBatches; batchIndex += 1) {
        const started = performance.now();
        try {
          markProbeProgress('resident-batch-started', { batchIndex, batchSteps: requestedBatchSteps });
          execution = await sceneApi.refreshMlsMpmResidentSteps({
            preferWebGpu: true,
            stepCount: requestedBatchSteps,
            readbackMode: requestedReadbackMode,
            compactSummaryMode: requestedCompactSummaryMode,
            compactSummaryScope: requestedCompactSummaryScope,
            continueFromResidentState: Boolean(execution?.continuationAvailable),
            force: true,
            pressureInterfaceForceSolver: requestedDisablePressureInterface ? null : undefined,
            pressureInterfaceForceRowsBuffer: requestedDisablePressureInterface ? null : undefined,
            contactKinematicsParticleBinMetadataReadback:
              Boolean(requestedContactBinMetadataReadback),
            reactionParticleBinMetadataReadback:
              Boolean(requestedReactionBinMetadataReadback),
            thermalStepOptions: Number.isFinite(requestedThermalWallRate)
            ? { wallRate: requestedThermalWallRate }
            : undefined,
            ...residentExecutionPolicy,
            measureFusedSequenceQueueFence: Boolean(
              requestedMeasureGpuQueueFence
              || residentExecutionPolicy?.measureFusedSequenceQueueFence
            )
          });
          markProbeProgress('resident-batch-completed', {
            batchIndex,
            batchMs: performance.now() - started,
            backend: execution?.backend || null,
            completedStepCount: execution?.completedStepCount ?? null
          });
          overlay.__mlsMpmResidentSteps = execution;
          overlay.__mlsMpmResidentStep = sceneApi.getMlsMpmResidentStep?.() || execution?.finalStep || null;
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
          overlay.__sphUpdateResidentGasPressureSummary?.(overlay.__mlsMpmResidentStep);
          if ((batchIndex % requestedRenderEvery === 0 || batchIndex === requestedBatches) && sceneApi.refreshSphResidentRenderState) {
            markProbeProgress('resident-render-refresh-started', { batchIndex });
            overlay.__sphResidentRenderState = await sceneApi.refreshSphResidentRenderState({
              preferWebGpu: true,
              residentSteps: execution,
              renderFieldReadbackMode: requestedRenderReadbackMode,
              renderRowsReadbackMode: requestedRenderRowsReadbackMode,
              renderFieldSurfaceSummaryMode: requestedRenderFieldSurfaceSummaryMode,
              surfaceDrawDiagnosticMode: requestedSurfaceDrawDiagnosticMode,
              surfaceDrawDiagnosticMaxFieldCells: requestedSurfaceDrawDiagnosticMaxFieldCells,
              surfaceDrawDiagnosticMaxResolution: requestedSurfaceDrawDiagnosticMaxResolution,
              gasPressureSummary: overlay.__sphResidentGasPressureSummary || null,
              allowNativeSurfaceExtraction: batchIndex === requestedBatches
            });
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
              sceneApi.refreshViewportAndOverlay?.({ reason: 'sph-long-horizon-probe-render-refresh' });
              await new Promise((resolve) => requestAnimationFrame(resolve));
              await waitForNativeSurfaceValidation(batchIndex);
              markProbeProgress('resident-render-refresh-viewport-completed', { batchIndex });
            }
          }
          markProbeProgress('resident-batch-sampling-started', { batchIndex });
          const metric = sample(batchIndex, 'resident-batch', performance.now() - started);
          metrics.push(metric);
          captureFrame(batchIndex, 'resident-batch', metrics.length - 1);
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
              allowNativeSurfaceExtraction: batchIndex === requestedBatches
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
            metrics.push(sample(batchIndex, 'resident-batch-anomaly-row-readback', performance.now() - started));
            captureFrame(batchIndex, 'resident-batch-anomaly-row-readback', metrics.length - 1);
          }
        } catch (error) {
          markProbeProgress('resident-batch-error', {
            batchIndex,
            batchMs: performance.now() - started,
            error: error instanceof Error ? error.message : String(error)
          });
          errors.push({ batchIndex, message: error instanceof Error ? error.message : String(error) });
          metrics.push(sample(batchIndex, 'resident-batch-error', performance.now() - started));
          captureFrame(batchIndex, 'resident-batch-error', metrics.length - 1);
          break;
        }
      }
      return {
        schema: 'peercompute.ulg.sph-history-long-horizon-probe.v0',
        status: errors.length ? 'completed-with-errors' : 'complete',
        batchCount: requestedBatches,
        batchStepCount: requestedBatchSteps,
        requestedSubsteps: requestedBatches * requestedBatchSteps,
        readbackMode: requestedReadbackMode,
        compactSummaryMode: requestedCompactSummaryMode,
        compactSummaryScope: requestedCompactSummaryScope,
        renderReadbackMode: requestedRenderReadbackMode,
        renderRowsReadbackMode: requestedRenderRowsReadbackMode,
        renderFieldSurfaceSummaryMode: requestedRenderFieldSurfaceSummaryMode,
        surfaceDrawDiagnosticMode: requestedSurfaceDrawDiagnosticMode,
        surfaceDrawDiagnosticMaxFieldCells: requestedSurfaceDrawDiagnosticMaxFieldCells,
        surfaceDrawDiagnosticMaxResolution: requestedSurfaceDrawDiagnosticMaxResolution,
        nativeSurfaceDebugMode: requestedNativeSurfaceDebugMode,
        nativeSurfaceValidationWaitMs: requestedNativeSurfaceValidationWaitMs,
        pressureInterfaceDisabled: Boolean(requestedDisablePressureInterface),
        contactBinMetadataReadback: Boolean(requestedContactBinMetadataReadback),
        reactionBinMetadataReadback: Boolean(requestedReactionBinMetadataReadback),
        anomalyRowReadback: Boolean(requestedAnomalyRowReadback),
        residentBufferDebug: Boolean(requestedResidentBufferDebug),
        thermalWallRateOverride: Number.isFinite(requestedThermalWallRate) ? requestedThermalWallRate : null,
        renderEveryBatches: requestedRenderEvery,
        preProbeSnapshots: Array.isArray(requestedPreProbeSnapshots) ? requestedPreProbeSnapshots : [],
        pageConsole: requestedPageConsole || [],
        visualFrameCapture: {
          enabled: Boolean(requestedCaptureFrames),
          frameEveryBatches: requestedCaptureFrameEvery,
          maxFrames: requestedCaptureFrameMax,
          frameCount: visualFrames.length
        },
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
      disablePressureInterface,
      contactBinMetadataReadback,
      reactionBinMetadataReadback,
      anomalyRowReadback,
      residentBufferDebug,
      compactSummaryScope,
      thermalWallRate,
      measureGpuQueueFence,
      nativeSurfaceDebugMode,
      nativeSurfaceValidationWaitMs,
      captureFrames,
      captureFrameEvery,
      captureFrameMax,
      preProbeSnapshots,
      pageConsole
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
      const timeline = await Promise.race([inPageProbe, timeoutProbe]);
      const shouldCaptureCompositedPage = Boolean(
        captureFrames
        && timeline
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
          timeline.visualFrames.push(canvasCenterFrame);
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
      return attachBrowserConsoleTelemetry(timeline, consoleCapture);
    } finally {
      if (timeoutProbeTimer) clearTimeout(timeoutProbeTimer);
    }
  } finally {
    await Promise.race([
      browser.close(),
      new Promise((resolve) => setTimeout(resolve, 2000))
    ]).catch(() => null);
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
  const browser = await launchProbeBrowser();
  const page = await newProbePage(browser);
  const consoleCapture = createBrowserConsoleCapture();
  page.on('console', (message) => {
    consoleCapture.recordConsole(message);
  });
  page.on('pageerror', (error) => {
    consoleCapture.recordPageError(error);
  });
  try {
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
      const finiteNumber = (value, fallback) => {
        if (value == null || value === '') return fallback;
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
      };
      const positiveInteger = (value, fallback) => {
        const number = Math.round(Number(value));
        return Number.isFinite(number) && number > 0 ? number : fallback;
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
        residentAuthorityThermoOwner: diagnostics.residentAuthorityThermoOwner ?? null
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
      const summarizeSteps = (steps) => steps ? {
        schema: steps.schema ?? null,
        backend: steps.backend ?? null,
        status: steps.status ?? null,
        stepCount: steps.stepCount ?? null,
        completedStepCount: steps.completedStepCount ?? null,
        compactSummaryMode: steps.compactSummaryMode ?? null,
        compactSummaryScope: steps.compactSummaryScope ?? null,
        readbackMode: steps.readbackMode ?? null,
        requestedReadbackMode: requestedReadbackMode,
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
        normalHotLoopReadbackFree: steps.normalHotLoopReadbackFree === true,
        renderStateReadbackAvailable: steps.renderStateReadbackAvailable ?? null,
        residentAuthorityLedgerStatus: steps.residentAuthorityLedgerStatus ?? null,
        residentAuthorityFamilyOwners: steps.residentAuthorityFamilyOwners || null,
        residentAuthorityWarnings: [...(steps.residentAuthorityWarnings || [])],
        residentAuthorityBlockers: [...(steps.residentAuthorityBlockers || [])],
        stepSummaries: Array.isArray(steps.stepSummaries)
          ? steps.stepSummaries.map((summary) => ({
            index: summary.index ?? null,
            status: summary.status ?? null,
            backend: summary.backend ?? null,
            compactSummaryAvailable: summary.compactSummaryAvailable ?? null,
            activeGridIndirectDispatch: summary.stageTiming?.activeGridIndirectDispatch
              ? { ...summary.stageTiming.activeGridIndirectDispatch }
              : null,
            activeGridDispatch: summary.stageTiming?.activeGridDispatch
              ? { ...summary.stageTiming.activeGridDispatch }
              : null
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
        } : null
      } : null;
      const summarizeStep = (step) => step ? {
        schema: step.schema ?? null,
        backend: step.backend ?? null,
        status: step.status ?? null,
        readbackMode: step.readbackMode ?? null,
        requestedReadbackMode,
        sequenceIndex: step.sequenceIndex ?? null,
        internalPressureScale: finiteOrNull(step.internalPressureScale),
        stageStatus: step.stageStatus ? { ...step.stageStatus } : null,
        stageBackends: step.stageBackends ? { ...step.stageBackends } : null,
        particlePingPong: step.particlePingPong ? {
          sourceStep: step.particlePingPong.sourceStep ?? null,
          nextStep: step.particlePingPong.nextStep ?? null,
          sourceTime: finiteOrNull(step.particlePingPong.sourceTime),
          nextTime: finiteOrNull(step.particlePingPong.nextTime)
        } : null,
        diagnostics: compactDiagnostics(step.diagnostics),
        cohortDiagnostics: step.diagnostics?.cohortDiagnostics
          || cohortDiagnosticsForState(
            step.readbackMode === 'no-full-readback' ? null : step.state,
            activeCohortRanges
          ),
        stageTiming: step.stageTiming ? {
          totalMs: finiteOrNull(step.stageTiming.totalMs),
          stageMs: { ...(step.stageTiming.stageMs || {}) },
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
        physicalLawGroups
      };

      const metrics = [];
      const errors = [];
      let execution = null;
      let previousExecution = null;
      let sphParticleUpload = null;
      let mlsMpmParticleUpload = null;
      let thermalResponseGraphUpload = null;
      let device = null;
      try {
        const driver = createSphPhaseDemo(driverOptions);
        const preflight = driver.preflight();
        const viewState = createSphPhaseViewState(driver);
        activeCohortRanges = cohortRangesFromCounts(viewState.counts);
        const staticTables = sphStaticTableInputsFromViewState(viewState);
        const mechanicsMaterialTable = buildMlsMpmMechanicsMaterialTable(viewState.materialProperties, {
          soundSpeedScale: viewState.gpuMechanics?.soundSpeedScale,
          minGasSoundSpeedMPerS: viewState.gpuMechanics?.minGasSoundSpeedMPerS,
          viscosityEnabled: viewState.physicalLawGroups?.viscosity,
          mlsMpmArtificialViscosityAlpha: viewState.gpuMechanics?.mlsMpmArtificialViscosityAlpha,
          viscosityLengthM: viewState.gpuMechanics?.gridSpacingM ?? viewState.sphGpuParticleState?.smoothingLengthM,
          surfaceTensionEnabled: viewState.physicalLawGroups?.surfaceTension
        });
        const deviceResult = await requestOpticalGpuDevice(navigator);
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
                  schema: 'peercompute.ulg.plain-sph-cpu-reference-stage-timing.v0',
                  totalMs: finiteOrNull(driver.demo.lastStepTiming.totalMs),
                  stageMs: { ...(driver.demo.lastStepTiming.stageMs || {}) },
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
            metrics.push(sample({
              batchIndex,
              phase: 'resident-batch',
              batchMs: performance.now() - started,
              execution
            }));
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
      }

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
        baseParticleEdge: DEFAULT_BASE_PARTICLE_EDGE
      }
    });
    return attachBrowserConsoleTelemetry(timeline, consoleCapture);
  } finally {
    await Promise.race([
      browser.close(),
      new Promise((resolve) => setTimeout(resolve, 2000))
    ]).catch(() => null);
  }
}

function analyzeTimeline(timeline, {
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
  const finiteSeries = (key) => diagnostics
    .map((diagnostic) => finiteMetric(diagnostic?.[key]))
    .filter(Number.isFinite);
  const maxSpeedSeries = finiteSeries('maxSpeedMPerS');
  const maxDisplacementSeries = finiteSeries('maxDisplacementM');
  const minVolumeSeries = finiteSeries('minVolumeRatioJ');
  const maxVolumeSeries = finiteSeries('maxVolumeRatioJ');
  const pressureImpulseSeries = finiteSeries('pressureInterfaceAppliedImpulseMagnitudeNSeconds');
  const internalPressureScaleSeries = finiteSeries('internalPressureScale');
  const nextTimeSeries = metrics
    .map((metric) => finiteMetric(
      metric.sceneTimeS
        ?? metric.plainSphStepResult?.time
        ?? metric.residentStep?.particlePingPong?.nextTime
        ?? metric.residentSteps?.nextTime
    ))
    .filter(Number.isFinite);
  const metricTimeS = (metric) => finiteMetric(
    metric?.sceneTimeS
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
  const pngAnalyzedVisualFrames = capturedVisualFrames.filter((frame) => frame?.png?.status === 'ready');
  const pngAnalyzedCanvasFrames = pngAnalyzedVisualFrames.filter((frame) => (
    String(frame?.captureSource || '').includes('canvas')
  ));
  const blankVisualFrameCount = pngAnalyzedVisualFrames
    .filter((frame) => frame.blankFrame === true || frame.png?.hasVisiblePixels === false)
    .length;
  const blankCanvasFrameCount = pngAnalyzedCanvasFrames
    .filter((frame) => frame.blankFrame === true || frame.png?.hasVisiblePixels === false)
    .length;
  const nonblankVisualFrameCount = pngAnalyzedVisualFrames
    .filter((frame) => frame.png?.hasVisiblePixels === true)
    .length;
  const nonblankCanvasFrameCount = pngAnalyzedCanvasFrames
    .filter((frame) => frame.png?.hasVisiblePixels === true)
    .length;
  const browserCanvasPixelValidated = nonblankCanvasFrameCount > 0;
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
  const activeNodeSeries = diagnostics
    .map((diagnostic) => finiteMetric(diagnostic?.activeGridNodeCount))
    .concat(metrics.map((metric) => finiteMetric(
      metric?.residentStep?.stageTiming?.activeGridDispatch?.activeNodeCount
        ?? metric?.residentSteps?.finalStepStageTiming?.activeGridDispatch?.activeNodeCount
        ?? metric?.residentSteps?.fusedResidentSequence?.activeGridDispatch?.activeNodeCount
    )))
    .filter(Number.isFinite);
  const maxSpeedObservedMPerS = maxSpeedSeries.length ? Math.max(...maxSpeedSeries) : null;
  const maxDisplacementObservedM = maxDisplacementSeries.length ? Math.max(...maxDisplacementSeries) : null;
  const compactSummaryDisabled = timeline?.compactSummaryMode === 'none' || metrics.some((metric) => (
    metric?.residentStep?.stageTiming?.compactSummaryRequested === false
    || metric?.residentSteps?.finalStepStageTiming?.compactSummaryRequested === false
  ));
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
  const motionMaxSpeedObservedMPerS = maxSpeedObservedMPerS
    ?? (compactSummaryDisabled ? renderRowEstimatedMaxSpeedMPerS : null);
  const motionMaxDisplacementObservedM = maxDisplacementObservedM
    ?? (compactSummaryDisabled ? renderRowMaxDisplacementM : null);
  const motionSpeedEvidenceSource = maxSpeedObservedMPerS != null
    ? 'resident-compact-summary'
    : (compactSummaryDisabled && renderRowEstimatedMaxSpeedMPerS != null ? 'decoded-render-rows' : null);
  const motionDisplacementEvidenceSource = maxDisplacementObservedM != null
    ? 'resident-compact-summary'
    : (compactSummaryDisabled && renderRowMaxDisplacementM != null ? 'decoded-render-rows' : null);
  const renderRowMotionEvidenceAvailable = (
    compactSummaryDisabled
    && (renderRowEstimatedMaxSpeedMPerS != null || renderRowMaxDisplacementM != null)
  );
  const residentRenderSourceSamples = metrics
    .map((metric, index) => {
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
      if (
        nextStep == null
        && nextTimeS == null
        && generation == null
        && currentGeneration == null
        && generationMatchesCurrent == null
        && !retainedPrevious
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
        retentionReason: surfaceDraw.sourceResidentRetentionReason
          ?? renderState.surfaceDrawSourceResidentRetentionReason
          ?? renderState.sourceResidentRetentionReason
          ?? null
      };
    })
    .filter(Boolean);
  const residentRenderSourceCurrentSampleCount = residentRenderSourceSamples
    .filter((sample) => sample.generationMatchesCurrent === true && !sample.retainedPrevious)
    .length;
  const residentRenderSourceStaleSampleCount = residentRenderSourceSamples
    .filter((sample) => sample.generationMatchesCurrent === false || sample.retainedPrevious)
    .length;
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
    const retainedResidentDrawBuffers = Boolean(
      metric?.surfaceDraw?.drawIndirectRowsBufferRetained
        ?? metric?.renderState?.surfaceDrawIndirectRowsBufferRetained
    ) && Boolean(
      metric?.surfaceDraw?.compactedVertexRowsBufferRetained
        ?? metric?.renderState?.surfaceDrawCompactedVertexRowsBufferRetained
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
          && compactedVertexRowsBufferByteLength > 0
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
    const nativeWebGpuSurfaceConsumerVisible = bridge === 'native-webgpu-surface-consumer'
      && renderSource === 'resident-surface-draw-native-webgpu-consumer'
      && (
        status === 'resident-extension-surface-draw-buffers-retained'
        || status === 'resident-surface-draw-buffers-retained'
        || status === 'resident-surface-draw-built'
      )
      && (
        renderBridgeStatus === 'native-webgpu-surface-consumer-ready'
        || metric?.surfaceDraw?.renderBridgeLastRenderStatus === 'native-webgpu-surface-consumer-rendered'
        || metric?.renderState?.surfaceDrawRenderBridgeLastRenderStatus === 'native-webgpu-surface-consumer-rendered'
      )
      && residentSurfaceVisibleGpuConsumerReady(metric)
      && (activeSurfaceCount > 0 || vertexCount > 0);
    return webGpuIndirectOverlayVisible
      || threeRenderRowPointsVisible
      || webGpuRenderRowOverlayVisible
      || nativeWebGpuSurfaceConsumerVisible;
  };
  const residentRenderFieldSummaryVisible = (metric) => (
    metric?.renderState?.source === 'resident-gpu-render-field'
    && metric?.renderState?.renderFieldSurfaceSummaryReadback === true
    && Number(metric?.renderState?.renderFieldSurfaceSummaryActiveSurfaceCount ?? 0) > 0
  );
  const residentSurfaceBufferHandoffReady = (metric) => Boolean(
    metric?.renderState?.surfaceDrawGpuBufferHandoffReady
    || metric?.surfaceDraw?.gpuBufferHandoffReady
    || metric?.surfaceDraw?.surfaceDrawGpuBufferHandoffReady
  );
  const residentSurfaceVisibleGpuConsumerReady = (metric) => Boolean(
    metric?.renderState?.surfaceDrawVisibleGpuConsumerReady
    || metric?.surfaceDraw?.visibleGpuConsumerReady
    || metric?.surfaceDraw?.surfaceDrawVisibleGpuConsumerReady
  );
  const residentSurfaceVisibleGpuConsumerInputReady = (metric) => Boolean(
    metric?.renderState?.surfaceDrawVisibleGpuConsumerInputReady
    || metric?.surfaceDraw?.visibleGpuConsumerInputReady
    || metric?.surfaceDraw?.surfaceDrawVisibleGpuConsumerInputReady
  );
  const residentSurfaceVisibleGpuConsumerNativeValidationBlockerFamily = (metric) => (
    metric?.renderState?.surfaceDrawVisibleGpuConsumerNativeValidationBlockerFamily
    ?? metric?.surfaceDraw?.visibleGpuConsumerNativeValidationBlockerFamily
    ?? metric?.surfaceDraw?.surfaceDrawVisibleGpuConsumerNativeValidationBlockerFamily
    ?? null
  );
  const residentOverlayH2oVisible = (metric) => residentOverlayVisible(metric)
    && Array.isArray(metric?.renderState?.materialKeys)
    && metric.renderState.materialKeys.some((key) => String(key || '').toLowerCase().includes('h2o'));
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
  const residentSurfaceBufferHandoffSampleCount = metrics.filter((metric) => (
    residentSurfaceBufferHandoffReady(metric)
  )).length;
  const residentSurfaceVisibleGpuConsumerSampleCount = metrics.filter((metric) => (
    residentSurfaceVisibleGpuConsumerReady(metric)
  )).length;
  const residentSurfaceVisibleGpuConsumerInputReadySampleCount = metrics.filter((metric) => (
    residentSurfaceVisibleGpuConsumerInputReady(metric)
  )).length;
  const requestedSurfaceDrawMode = String(timeline?.surfaceDrawDiagnosticMode || '').toLowerCase();
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
  const residentSurfaceVisibleGpuConsumerAccepted = Boolean(
    residentSurfaceBufferHandoffProbe
    && residentSurfaceVisibleGpuConsumerSampleCount > 0
  );
  const nativeWebGpuSurfaceConsumerAccepted = Boolean(
    requestedSurfaceDrawMode === 'native-webgpu-surface-consumer'
    && residentSurfaceVisibleGpuConsumerAccepted
  );
  const nativeWebGpuSurfaceConsumerRendered = Boolean(
    requestedSurfaceDrawMode === 'native-webgpu-surface-consumer'
    && metrics.some((metric) => (
      metric?.surfaceDraw?.renderBridgeLastRenderStatus === 'native-webgpu-surface-consumer-rendered'
      || metric?.surfaceDraw?.renderBridgeLastRenderStatus === 'native-webgpu-surface-consumer-debug-clear-rendered'
      || metric?.renderState?.surfaceDrawRenderBridgeLastRenderStatus === 'native-webgpu-surface-consumer-rendered'
      || metric?.renderState?.surfaceDrawRenderBridgeLastRenderStatus === 'native-webgpu-surface-consumer-debug-clear-rendered'
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
    residentSurfaceBufferHandoffProbe
    && compactSummaryDisabled
    && residentRenderSourceCurrentSampleCount > 0
    && residentRenderSourceStaleSampleCount === 0
    && residentRenderSourceTimeAdvanced
    && (
      residentSurfaceVisibleGpuConsumerInputReadySampleCount > 0
      || residentSurfaceBufferHandoffSampleCount > 0
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
  const materialCountSnapshots = metrics
    .map((metric) => (
      metric?.plainSphStepResult?.particlesByMaterial
      ?? metric?.residentStep?.particlesByMaterial
      ?? null
    ))
    .filter((counts) => counts && typeof counts === 'object');
  const finalParticlesByMaterial = materialCountSnapshots.length
    ? materialCountSnapshots[materialCountSnapshots.length - 1]
    : null;
  const materialCountFor = (counts, material) => {
    if (!counts || !material) return 0;
    const wanted = String(material).toLowerCase();
    for (const [key, value] of Object.entries(counts)) {
      if (String(key).toLowerCase() === wanted) return Number(value) || 0;
    }
    return 0;
  };
  const reactionEventsTotalSeries = metrics
    .map((metric) => finiteMetric(
      metric?.plainSphStepResult?.reactionEventsTotal
        ?? metric?.residentStep?.reactionEventsTotal
        ?? metric?.residentStep?.reactionLedger?.eventCount
    ))
    .filter(Number.isFinite);
  const maxReactionEventsTotal = reactionEventsTotalSeries.length
    ? Math.max(...reactionEventsTotalSeries)
    : null;
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
  if (!directResident && !residentSurfaceBufferHandoffAccepted) {
    const alphaTransparentRenderLayers = new Set(['vapor-surface', 'alpha-surface']);
    const knownSurfaceRenderLayers = new Set(['opaque-surface', 'transmissive-surface', ...alphaTransparentRenderLayers]);
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
        } else if (renderLayer === 'opaque-surface' || renderLayer === 'transmissive-surface') {
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
  if (residentRenderSourceStaleSampleCount > 0) {
    issues.push('resident-render-source-stale');
  }
  if (!visualOnly) {
    if (
      diagnostics.length === 0
      && !renderRowMotionEvidenceAvailable
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
    } else if (minVolumeObservedJ < 0.95) {
      issues.push('same-material-liquid-J<0.95');
    }
    if (maxVolumeObservedJ == null) {
      issues.push('missing-liquid-J');
    } else if (maxVolumeObservedJ > 1.05) {
      issues.push('same-material-liquid-J>1.05');
    }
    if (cohortDiagnostics.length === 0) {
      issues.push('missing-same-material-cohort-diagnostics');
    }
  }
  if (!visualOnly && maxPressureImpulseNSeconds != null && maxPressureImpulseNSeconds > 1e-5) issues.push('same-material-pressure-impulse-applied');
  if (Number.isFinite(minReactionEventsTotal)) {
    if (!Number.isFinite(maxReactionEventsTotal)) {
      issues.push('missing-reaction-events-total');
    } else if (maxReactionEventsTotal < minReactionEventsTotal) {
      issues.push(`reaction-events-total<${minReactionEventsTotal}`);
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
    (
      requestedSurfaceDrawMode === 'three-webgpu-surface-buffers'
      || requestedSurfaceDrawMode === 'native-webgpu-surface-consumer'
    )
    && residentSurfaceBufferHandoffSampleCount > 0
    && residentSurfaceVisibleGpuConsumerSampleCount === 0
    && !browserCanvasPixelValidated
  ) {
    issues.push('resident-surface-visible-gpu-consumer-not-ready');
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
  if (!directResident && !residentSurfaceBufferHandoffAccepted && visibleSurfaceSampleCount === 0) {
    issues.push('no-visible-surface-samples');
  }
  if (!directResident && !residentSurfaceBufferHandoffAccepted && h2oVisibleSurfaceSampleCount === 0) {
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
    renderRowMotionEvidenceAvailable,
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
    maxReactionEventsTotal,
    capturedVisualFrameCount: capturedVisualFrames.length,
    pngAnalyzedVisualFrameCount: pngAnalyzedVisualFrames.length,
    pngAnalyzedCanvasFrameCount: pngAnalyzedCanvasFrames.length,
    nonblankVisualFrameCount,
    blankVisualFrameCount,
    blankCanvasFrameCount,
    nonblankCanvasFrameCount,
    browserCanvasPixelValidated,
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
    lastH2oLiquidSurfaceFootprintFillRatio,
    visibleSurfaceSampleCount,
    residentSurfaceBufferHandoffSampleCount,
    residentSurfaceBufferHandoffAccepted,
    residentSurfaceVisibleGpuConsumerSampleCount,
    residentSurfaceVisibleGpuConsumerInputReadySampleCount,
    residentSurfaceVisibleGpuConsumerAccepted,
    h2oVisibleSurfaceSampleCount,
    residentOverlayVisibleSampleCount: metrics.filter(residentOverlayVisible).length
  };
}

async function main() {
  const repoDir = path.resolve(process.env.ULG_PROBE_REPO_DIR || process.cwd());
  const scriptDir = path.dirname(new URL(import.meta.url).pathname);
  const currentRepoDir = path.resolve(scriptDir, '..');
  const depsDir = path.join(currentRepoDir, 'node_modules');
  const viteBin = process.env.ULG_PROBE_VITE_BIN || path.join(depsDir, 'vite', 'bin', 'vite.js');
  const output = process.env.ULG_PROBE_OUTPUT ? path.resolve(process.env.ULG_PROBE_OUTPUT) : null;
  const port = positiveInteger(process.env.ULG_PROBE_PORT, 5177);
  const timeoutMs = positiveInteger(process.env.ULG_PROBE_TIMEOUT_MS, 180_000);
  const scenarioUrl = process.env.ULG_PROBE_URL || DEFAULT_URL;
  const probeMode = normalizedProbeMode(process.env.ULG_PROBE_MODE);
  const batches = positiveInteger(process.env.ULG_PROBE_BATCHES, 4);
  const batchSteps = positiveInteger(process.env.ULG_PROBE_BATCH_STEPS, 32);
  const renderEvery = positiveInteger(process.env.ULG_PROBE_RENDER_EVERY, 1);
  const readbackMode = process.env.ULG_PROBE_READBACK_MODE === 'full-parity-readback'
    ? 'full-parity-readback'
    : 'no-full-readback';
  const compactSummaryScope = normalizedCompactSummaryScope(
    process.env.ULG_PROBE_COMPACT_SUMMARY_SCOPE,
    readbackMode === 'no-full-readback' ? 'particle-visual' : 'full'
  );
  const compactSummaryMode = ['none', 'final-only', 'every-step'].includes(
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
    compactSummaryMode === 'none' ? 'final-only' : 'every-step'
  );
  const measureGpuQueueFence = booleanEnv(
    process.env.ULG_PROBE_MEASURE_GPU_QUEUE_FENCE
    ?? process.env.ULG_PROBE_MEASURE_FUSED_SEQUENCE_QUEUE_FENCE,
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
  const nativeSurfaceValidationWaitMs = positiveInteger(
    process.env.ULG_PROBE_NATIVE_SURFACE_VALIDATION_WAIT_MS
      ?? process.env.ULG_PROBE_NATIVE_WEBGPU_SURFACE_VALIDATION_WAIT_MS,
    0
  );
	const surfaceDrawDiagnosticModeEnv = String(
	  process.env.ULG_PROBE_SURFACE_DRAW_DIAGNOSTIC_MODE || ''
	).toLowerCase();
  const surfaceDrawDiagnosticModeFromUrl = surfaceDrawModeFromScenarioUrl(scenarioUrl);
  const surfaceDrawDiagnosticMode = SURFACE_DRAW_DIAGNOSTIC_MODES.has(surfaceDrawDiagnosticModeEnv)
    ? surfaceDrawDiagnosticModeEnv
    : (surfaceDrawDiagnosticModeFromUrl || 'auto');
  const surfaceDrawDiagnosticMaxFieldCells = positiveInteger(
    process.env.ULG_PROBE_SURFACE_DRAW_DIAGNOSTIC_MAX_FIELD_CELLS,
    100000
  );
  const surfaceDrawDiagnosticMaxResolution = positiveInteger(
    process.env.ULG_PROBE_SURFACE_DRAW_DIAGNOSTIC_MAX_RESOLUTION,
    8
  );
  const disablePressureInterface = process.env.ULG_PROBE_DISABLE_PRESSURE === '1'
    || process.env.ULG_PROBE_DISABLE_PRESSURE_INTERFACE === '1';
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
  const frameDir = process.env.ULG_PROBE_FRAME_DIR
    ? path.resolve(process.env.ULG_PROBE_FRAME_DIR)
    : null;
  const nativeSurfaceFrameValidationRequired =
    surfaceDrawDiagnosticMode === 'native-webgpu-surface-consumer';
  const captureFrames = probeMode !== 'direct-resident'
    && (
      process.env.ULG_PROBE_CAPTURE_FRAMES === '1'
      || Boolean(frameDir)
      || nativeSurfaceFrameValidationRequired
    );
  const captureFrameEvery = positiveInteger(process.env.ULG_PROBE_FRAME_EVERY, 1);
  const captureFrameMax = positiveInteger(process.env.ULG_PROBE_FRAME_MAX, 64);
  const initialResidentWaitMs = positiveInteger(
    process.env.ULG_PROBE_INITIAL_RESIDENT_WAIT_MS,
    Math.min(timeoutMs, 5000)
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
  const server = startViteServer({ repoDir, port, viteBin, timeoutMs });
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
        disablePressureInterface,
        contactBinMetadataReadback,
        reactionBinMetadataReadback,
        anomalyRowReadback,
        residentBufferDebug,
        compactSummaryScope,
	        thermalWallRate,
	        measureGpuQueueFence,
	        nativeSurfaceDebugMode,
	        nativeSurfaceValidationWaitMs,
	        captureFrames,
        captureFrameEvery,
        captureFrameMax,
        initialResidentWaitMs
      });
    const visualFrameArtifacts = await persistCapturedFrames({
      frames: timeline?.visualFrames,
      frameDir: captureFrames ? frameDir : null
    });
    if (timeline && Array.isArray(timeline.visualFrames)) {
      timeline.visualFrames = visualFrameArtifacts.frames;
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
      thresholds,
      visualFrameArtifacts,
      timeline,
      analysis
    };
  } finally {
    server.stop();
  }
  const text = `${JSON.stringify(result, null, 2)}\n`;
  if (output) {
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, text, 'utf8');
  }
  process.stdout.write(text);
  if (process.env.ULG_PROBE_FAIL_ON_BAD === '1' && result.status === 'bad') {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 2;
});
