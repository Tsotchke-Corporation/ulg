import assert from 'node:assert/strict';
import {
  chmod,
  link,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  symlink,
  writeFile
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { deflateSync } from 'node:zlib';

import {
  comparePhysicalPixelPngFrames,
  decodePhysicalPixelPng,
  publicPhysicalPixelPngMetrics
} from '../scripts/physicalPixelPngEvidence.mjs';

import {
  PHYSICAL_PIXEL_EVENT_KIND,
  PHYSICAL_PIXEL_EVENT_NAME,
  PHYSICAL_PIXEL_EVIDENCE_SCHEMA,
  PHYSICAL_PIXEL_LIVENESS_LIMITS_MS,
  PHYSICAL_PIXEL_RECEIPT_SCHEMA,
  PHYSICAL_PIXEL_SOURCE_MANIFEST_SCHEMA,
  buildPhysicalPixelLocalSourceManifest,
  buildPhysicalPixelViteResourceClosure,
  capturePhysicalPixelMobileEvidence,
  collectPhysicalPixelRawArtifactEvidence,
  createPhysicalPixelMobilePolicy,
  evaluatePhysicalPixelEvidence,
  evaluatePhysicalPixelMobileLivenessReceipt,
  physicalPixelMobileLivenessIccEvent,
  physicalPixelDeadlineRemainingMs,
  readPhysicalPixelMobileLivenessArtifactEvidence,
  resolvePhysicalPixelLivenessDeadlines,
  runPhysicalPixelMobileLivenessReceipt
} from '../scripts/ss-physical-pixel-mobile-liveness-receipt.mjs';
import {
  canonicalJsonSha256,
  createNonProductionFixtureCapability,
  sha256Bytes
} from '../scripts/ss-release-evidence-common.mjs';

const BASE_URL = 'https://100.64.1.9:4173/';
const RAW_COMMAND_SCHEMA = 'peercompute.ulg.ss-physical-pixel-raw-command.v1';
const RAW_JSON_SCHEMA = 'peercompute.ulg.ss-physical-pixel-raw-json.v1';
const CAPTURE_PROVIDER_ID = 'builtin-adb-cdp-physical-pixel-v2';
const RUN_ID = '00000000-0000-4000-8000-000000000052';
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const BENIGN_COMPACT_MOTION_WARNING =
  'Resident physics is stepping, but compact motion proof is unavailable.';
const LOCAL_RELATIVE_SOURCE_SCOPE =
  'vite-raw-text-local-relative-static-module-css-worker-resource-set.v1';
const VITE_TRANSFORMED_RESOURCE_SCOPE =
  'vite-transformed-static-import-export-dynamic-css-worker-url-resource-closure.v1';
const VITE_RAW_SOURCE_PARITY_SCOPE =
  'vite-raw-direct-source-module-parity.v1';
const fixtureResourceBytes = new Map();

function fingerprint(overrides = {}) {
  return {
    gitHead: '1'.repeat(40),
    sourceFingerprint: '2'.repeat(64),
    worktreeDirty: true,
    worktreeStatusHash: '3'.repeat(64),
    trackedAndUntrackedFileCount: 44,
    ...overrides
  };
}

function sourceManifest(policy, { unresolvedBareSpecifiers = [] } = {}) {
  const modules = policy.sourceModulePaths.map((modulePath, index) => ({
    path: modulePath,
    byteLength: 100 + index,
    sha256: sha256Bytes(`source module ${index}`)
  }));
  const core = {
    schema: PHYSICAL_PIXEL_SOURCE_MANIFEST_SCHEMA,
    scope: LOCAL_RELATIVE_SOURCE_SCOPE,
    modules,
    unresolvedBareSpecifiers
  };
  return {
    ...core,
    manifestSha256: canonicalJsonSha256(core)
  };
}

function servedSource(policy, manifest) {
  const roots = policy.sourceModulePaths.map(
    (modulePath) => new URL(`/${modulePath}`, policy.baseUrl).href
  ).sort();
  const childUrl = new URL('/src/physical-receipt-fixture-child', policy.baseUrl).href;
  const sourceBytes = roots.map((url, index) => Buffer.from(
    index === 0
      ? "import './physical-receipt-fixture-child'; export const root = 0;\n"
      : `export const root = ${index};\n`,
    'utf8'
  ));
  sourceBytes.push(Buffer.from('export const child = true;\n', 'utf8'));
  const resourceUrls = [...roots, childUrl];
  const resources = resourceUrls.map((url, index) => {
    const bytes = sourceBytes[index];
    const artifact = {
      path: `/fixture/physical-receipt-${sha256Bytes(url)}.bin`,
      byteLength: bytes.byteLength,
      sha256: sha256Bytes(bytes)
    };
    fixtureResourceBytes.set(artifact.path, bytes);
    return {
      url,
      byteLength: bytes.byteLength,
      browserSha256: sha256Bytes(bytes),
      artifact,
      contentType: 'text/javascript; charset=utf-8',
      edgeKinds: index < roots.length ? ['root'] : ['static-import'],
      comparison: 'transformed-source',
      ...(index < roots.length ? {
        local: {
          path: `/fixture/${policy.sourceModulePaths[index]}`,
          byteLength: 100 + index,
          sha256: manifest.modules[index].sha256,
          browserBytesEqual: false,
          canonicalSha256: manifest.modules[index].sha256,
          browserCanonicalSha256: sha256Bytes(bytes),
          canonicalBytesEqual: false
        }
      } : {}),
      edges: index === 0
        ? [{ kind: 'static-import', to: childUrl }]
        : []
    };
  });
  const rawModules = manifest.modules.map((moduleRow) => ({
    path: moduleRow.path,
    byteLength: moduleRow.byteLength,
    localSha256: moduleRow.sha256,
    browserSha256: moduleRow.sha256
  }));
  return {
    attestation: 'vite-transformed-static-resource-closure-with-raw-source-parity.v2',
    scope: VITE_TRANSFORMED_RESOURCE_SCOPE,
    baseUrl: policy.baseUrl,
    observedOrigin: new URL(policy.baseUrl).origin,
    rawSourceParity: {
      scope: VITE_RAW_SOURCE_PARITY_SCOPE,
      localManifestSha256: manifest.manifestSha256,
      browserManifestSha256: canonicalJsonSha256({
        schema: PHYSICAL_PIXEL_SOURCE_MANIFEST_SCHEMA,
        scope: LOCAL_RELATIVE_SOURCE_SCOPE,
        modules: rawModules.map(({ path: modulePath, byteLength, browserSha256 }) => ({
          path: modulePath,
          byteLength,
          sha256: browserSha256
        })),
        unresolvedBareSpecifiers: manifest.unresolvedBareSpecifiers
      }),
      modules: rawModules
    },
    transformed: {
      scope: VITE_TRANSFORMED_RESOURCE_SCOPE,
      roots,
      resources,
      edges: [{
        from: roots[0],
        kind: 'static-import',
        to: childUrl
      }]
    }
  };
}

function fakeArtifacts(policy) {
  return policy.requiredRawArtifactIds.map((id, index) => ({
    id,
    path: `/tmp/ulg-physical-pixel-${id}.txt`,
    byteLength: 20 + index,
    sha256: sha256Bytes(`raw artifact ${id}`),
    publicationIdentity: {
      dev: 1,
      ino: index + 1
    }
  }));
}

function rawCommand(id, args, stdout) {
  return {
    schema: RAW_COMMAND_SCHEMA,
    id,
    captureProviderId: CAPTURE_PROVIDER_ID,
    runId: RUN_ID,
    executable: 'adb',
    args,
    exitCode: 0,
    signal: null,
    spawnError: null,
    stdout,
    stderr: ''
  };
}

function rawJson(id, value) {
  return {
    schema: RAW_JSON_SCHEMA,
    id,
    captureProviderId: CAPTURE_PROVIDER_ID,
    runId: RUN_ID,
    value
  };
}

function cdpAuditRow(method, params = {}, {
  result = {},
  ...responseBindings
} = {}) {
  return {
    client: method.startsWith('Target.') ? 'browser' : 'page',
    method,
    paramsSha256: canonicalJsonSha256(params),
    targetId: params.targetId ?? null,
    url: method === 'Page.navigate' || method === 'Target.createTarget'
      ? params.url ?? null
      : null,
    responseStatus: 'success',
    responseSha256: canonicalJsonSha256(result),
    ...responseBindings
  };
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

function pngChunk(type, data = Buffer.alloc(0)) {
  const typeBytes = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.byteLength);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(pngCrc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([length, typeBytes, data, crc]);
}

function fixturePng({
  width,
  height,
  colorType = 2,
  pixel,
  beforeImageDataChunks = [],
  splitImageDataWithChunk = null
}) {
  const channels = colorType === 2 ? 3 : colorType === 6 ? 4 : null;
  assert.ok(channels != null, 'fixture PNG supports RGB or RGBA only');
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = colorType;
  const scanlines = Buffer.alloc(height * (1 + width * channels));
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (1 + width * channels);
    scanlines[rowOffset] = 0;
    for (let x = 0; x < width; x += 1) {
      const values = pixel({ x, y });
      assert.equal(values.length, channels);
      const pixelOffset = rowOffset + 1 + x * channels;
      for (let channel = 0; channel < channels; channel += 1) {
        scanlines[pixelOffset + channel] = values[channel];
      }
    }
  }
  const compressed = deflateSync(scanlines);
  const imageDataChunks = splitImageDataWithChunk == null
    ? [pngChunk('IDAT', compressed)]
    : [
        pngChunk('IDAT', compressed.subarray(0, Math.floor(compressed.length / 2))),
        splitImageDataWithChunk,
        pngChunk('IDAT', compressed.subarray(Math.floor(compressed.length / 2)))
      ];
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', header),
    ...beforeImageDataChunks,
    ...imageDataChunks,
    pngChunk('IEND')
  ]);
}

function deterministicTinyRgbPng({
  seed = 0,
  uniform = false,
  width = 12,
  height = 12
} = {}) {
  return fixturePng({
    width,
    height,
    pixel: ({ x, y }) => [
      uniform ? 32 + seed : 16 + ((x * 17 + y * 3 + seed * 11) % 180),
      uniform ? 48 + seed : 24 + ((x * 5 + y * 19 + seed * 7) % 170),
      uniform ? 64 + seed : 32 + ((x * 13 + y * 11 + seed * 5) % 160)
    ]
  });
}

function compositorCanvasFixture(documentUrl) {
  return {
    schema: 'peercompute.ulg.physical-pixel-native-canvas-clip.v1',
    rendererBridge: 'native-webgpu-surface-consumer',
    sameAsBridgeCanvas: true,
    sameAsNativeConsumerCanvas: true,
    canvasIndex: 0,
    canvasCount: 1,
    canvasBackingWidth: 20,
    canvasBackingHeight: 20,
    devicePixelRatio: 1,
    visualViewportScale: 1,
    documentUrl,
    centerHitIncludesCanvas: true,
    style: {
      display: 'block',
      visibility: 'visible',
      opacity: '1'
    },
    rect: { x: 16, y: 24, width: 20, height: 20 },
    viewport: { x: 0, y: 0, width: 412, height: 915 },
    clip: { x: 20, y: 28, width: 12, height: 12, scale: 1 }
  };
}

function layoutMetricsFixture() {
  return {
    cssVisualViewport: {
      pageX: 0,
      pageY: 0,
      clientWidth: 412,
      clientHeight: 915,
      scale: 1,
      zoom: 1
    }
  };
}

function compositorFrameFromPng({ label, pngBytes, documentUrl, capturedAt }) {
  const canvas = compositorCanvasFixture(documentUrl);
  const captureParams = {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false,
    clip: {
      ...canvas.clip,
      scale: 1
    }
  };
  const decoded = decodePhysicalPixelPng(pngBytes);
  assert.equal(decoded.status, 'ready');
  return {
    schema: 'peercompute.ulg.physical-pixel-compositor-frame.v1',
    status: 'captured',
    label,
    captureSource: 'physical-chrome-compositor-surface',
    capturedAt,
    captureParams,
    layoutMetrics: {
      schema: 'peercompute.ulg.physical-pixel-cdp-layout-metrics.v1',
      cdpResponse: layoutMetricsFixture()
    },
    canvas,
    pngBase64: pngBytes.toString('base64'),
    png: {
      byteLength: pngBytes.byteLength,
      sha256: sha256Bytes(pngBytes),
      ...publicPhysicalPixelPngMetrics(decoded)
    }
  };
}

function compositorFrame({
  label,
  seed,
  documentUrl,
  capturedAt,
  uniform = false
}) {
  return compositorFrameFromPng({
    label,
    pngBytes: deterministicTinyRgbPng({ seed, uniform }),
    documentUrl,
    capturedAt
  });
}

function compositorWindow(seed, policy, documentUrl) {
  const capturedAtMs = Date.parse('2026-08-01T00:00:00.000Z') + seed * 1_000;
  const beforeFrame = compositorFrame({
    label: 'advancing-window-before',
    seed,
    documentUrl,
    capturedAt: new Date(capturedAtMs).toISOString()
  });
  const afterFrame = compositorFrame({
    label: 'advancing-window-after',
    seed: seed + 1,
    documentUrl,
    capturedAt: new Date(capturedAtMs + 500).toISOString()
  });
  const compositorDelta = comparePhysicalPixelPngFrames(
    Buffer.from(beforeFrame.pngBase64, 'base64'),
    Buffer.from(afterFrame.pngBase64, 'base64'),
    {
      minChannelDelta: policy.compositorEvidence.minChannelDelta,
      minChangedPixelCount: policy.compositorEvidence.minChangedPixelCount,
      minChangedPixelRatio: policy.compositorEvidence.minChangedPixelRatio,
      minChangedBoundsWidth: policy.compositorEvidence.minChangedBoundsWidth,
      minChangedBoundsHeight: policy.compositorEvidence.minChangedBoundsHeight
    }
  );
  assert.equal(compositorDelta.visibleContentAdvanced, true);
  assert.ok(
    compositorDelta.changedPixelCount >= 8,
    'fixture compositor frames must change at least eight RGB pixels'
  );
  return { beforeFrame, afterFrame, compositorDelta };
}

function replaceCompositorFramePng(frame, pngBytes) {
  const replacement = compositorFrameFromPng({
    label: frame.label,
    pngBytes,
    documentUrl: frame.canvas.documentUrl,
    capturedAt: frame.capturedAt
  });
  frame.pngBase64 = replacement.pngBase64;
  frame.png = replacement.png;
}

function refreshCompositorDelta(window, policy) {
  window.compositorDelta = comparePhysicalPixelPngFrames(
    Buffer.from(window.beforeFrame.pngBase64, 'base64'),
    Buffer.from(window.afterFrame.pngBase64, 'base64'),
    {
      minChannelDelta: policy.compositorEvidence.minChannelDelta,
      minChangedPixelCount: policy.compositorEvidence.minChangedPixelCount,
      minChangedPixelRatio: policy.compositorEvidence.minChangedPixelRatio,
      minChangedBoundsWidth: policy.compositorEvidence.minChangedBoundsWidth,
      minChangedBoundsHeight: policy.compositorEvidence.minChangedBoundsHeight
    }
  );
}

function screenshotAuditRows(sample) {
  return sample.windows.flatMap((window) => (
    [window.beforeFrame, window.afterFrame].flatMap((frame) => [
      cdpAuditRow('Page.getLayoutMetrics', {}, {
        result: frame.layoutMetrics.cdpResponse
      }),
      cdpAuditRow('Page.captureScreenshot', frame.captureParams, {
        result: { data: frame.pngBase64 },
        responsePngByteLength: frame.png.byteLength,
        responsePngSha256: frame.png.sha256
      })
    ])
  ));
}

function telemetry() {
  return {
    schema: 'peercompute.ulg.gpu-readback-telemetry.v1',
    status: 'complete',
    unknownFields: [],
    publicCounters: { maps: 0, bytes: 0, fenceWaits: 0 },
    observedCounters: { maps: 0, bytes: 0, fenceWaits: 0 },
    normalHotLoopReadbackFree: true,
    fullParticleReadbackPerformed: false,
    fullParticleReadbackFree: true,
    residentContinuationReady: true
  };
}

function samplePoint({
  step,
  completion,
  submissions,
  frameCounter,
  documentUrl,
  renderFps = 46.5
}) {
  return {
    nextStep: step,
    completion,
    submissions,
    frameCounter,
    renderFps,
    documentUrl,
    documentVisibility: 'visible',
    documentHasFocus: true,
    error: null,
    warningText: '',
    warningMessages: [],
    motionDiagnostic: null,
    autoSchedule: { residentAuto: true, status: 'resident-auto-schedule-enabled' },
    presentation: {
      rendererBackend: 'native-webgpu',
      surfaceDrawMode: 'native-webgpu-surface-consumer',
      nativeSurfaceDrawRequested: true
    },
    telemetry: telemetry()
  };
}

function livenessSample({
  policy,
  scenarioUrl,
  offset = 0,
  compositorSeed = 0
}) {
  const windows = [0, 20].map((delta, windowIndex) => {
    const before = samplePoint({
      step: 10 + offset + delta,
      completion: 100 + offset + delta,
      submissions: 12 + offset + delta,
      frameCounter: 40 + offset + delta,
      documentUrl: scenarioUrl
    });
    const after = samplePoint({
      step: 14 + offset + delta,
      completion: 104 + offset + delta,
      submissions: 16 + offset + delta,
      frameCounter: 48 + offset + delta,
      documentUrl: scenarioUrl
    });
    return {
      before,
      after,
      ...compositorWindow(
        compositorSeed + windowIndex * 2,
        policy,
        scenarioUrl
      ),
      animationFrameCount: 8,
      animationStepCount: 4,
      renderFps: 46.5
    };
  });
  return {
    windows,
    before: windows[0].before,
    after: windows.at(-1).after,
    animationFrameCount: 16,
    animationStepCount: 8,
    renderFps: 46.5,
    pageError: null,
    consoleErrors: [],
    consoleWarnings: [],
    unhandledRejections: [],
    hotLoopWarningPresent: false
  };
}

function baseEvidence({ policy, manifest, artifacts = fakeArtifacts(policy) }) {
  const body0 = {
    id: 'body-0',
    domainId: 1,
    material: 'h2o',
    centerM: [2, 0.5, 2],
    sizeM: [1, 1, 1],
    particlesPerEdge: [5, 5, 5]
  };
  const body1 = {
    id: 'body-1',
    domainId: 2,
    material: 'h2o',
    centerM: [2, 1.7, 2],
    sizeM: [0.6, 0.6, 0.6],
    particlesPerEdge: [5, 5, 5]
  };
  const body2 = {
    ...body1,
    id: 'body-2',
    domainId: 3,
    centerM: [2, 2.42, 2]
  };
  const lifecycle = {
    targetsBefore: ['preexisting-target'],
    createdTargetId: 'receipt-target',
    closeResponse: { success: true },
    ownTargetClosed: true,
    targetsAfter: ['preexisting-target'],
    existingTargetsClosed: 0,
    unexpectedTargetIdsAdded: [],
    unexpectedTargetsAdded: 0,
    pidsBefore: [4127],
    pidsAfter: [4127]
  };
  const sodiumWaterSample = livenessSample({
    policy,
    scenarioUrl: policy.scenarios[0].url,
    compositorSeed: 0
  });
  const tripleWaterSample = livenessSample({
    policy,
    scenarioUrl: policy.scenarios[1].url,
    offset: 20,
    compositorSeed: 4
  });
  const cdpCommandAudit = [
    cdpAuditRow('Target.getTargets'),
    cdpAuditRow('Target.createTarget', { url: 'about:blank' }),
    cdpAuditRow('Target.getTargetInfo', { targetId: 'receipt-target' }),
    cdpAuditRow('Target.activateTarget', { targetId: 'receipt-target' }),
    cdpAuditRow('Page.enable'),
    cdpAuditRow('Runtime.enable'),
    cdpAuditRow('Log.enable'),
    cdpAuditRow('Page.navigate', { url: policy.scenarios[0].url }),
    ...screenshotAuditRows(sodiumWaterSample),
    cdpAuditRow('Page.navigate', { url: policy.scenarios[1].url }),
    ...screenshotAuditRows(tripleWaterSample),
    cdpAuditRow('Target.closeTarget', { targetId: 'receipt-target' }),
    cdpAuditRow('Target.getTargets')
  ].map((row, sequence) => ({ sequence, ...row }));
  return {
    schema: PHYSICAL_PIXEL_EVIDENCE_SCHEMA,
    policyTrack: policy.policyTrack,
    status: 'complete',
    captureMode: 'physical-adb-cdp',
    emulated: false,
    syntheticDeviceProfile: false,
    captureProviderId: CAPTURE_PROVIDER_ID,
    captureRunId: RUN_ID,
    commandPolicy: policy,
    sourceFingerprintBefore: fingerprint(),
    sourceFingerprintAfter: fingerprint(),
    rawArtifacts: artifacts,
    provenance: {
      adb: {
        getState: 'device',
        devicesRow: {
          serial: '49151FDJH000AB',
          state: 'device',
          transport: 'usb',
          product: 'caiman',
          model: 'Pixel_9_Pro',
          device: 'caiman',
          usb: '1-3',
          transportId: '1'
        },
        properties: {
          roProductManufacturer: 'Google',
          roProductBrand: 'google',
          roProductModel: 'Pixel 9 Pro',
          roProductDevice: 'caiman',
          roProductName: 'caiman',
          roKernelQemu: '0',
          roBootQemu: '0',
          roHardware: 'tensor',
          roBuildFingerprint:
            'google/caiman/caiman:16/BP2A.260705.001/123456:user/release-keys',
          roProductCpuAbi: 'arm64-v8a'
        }
      },
      browser: {
        packageName: 'com.android.chrome',
        packagePath: '/data/app/~~abc/com.android.chrome-abc/base.apk',
        packageVersion: '126.0.6478.50',
        pid: 4127,
        pidsBefore: [4127],
        pidsAfter: [4127],
        attachedViaAdbForward: true,
        usedExistingChromeProcess: true,
        createdTarget: true,
        activatedOwnTarget: true,
        ownTargetId: 'receipt-target',
        ownTargetClosed: true,
        chromeForceStopped: false,
        chromeProcessTerminated: false,
        browserClosed: false,
        existingTargetsClosed: 0,
        unexpectedTargetsAdded: 0,
        lifecycle,
        forward: {
          serial: '49151FDJH000AB',
          localPort: 43333,
          remote: 'localabstract:chrome_devtools_remote'
        },
        cdpEmulationCommands: [],
        cdpCommandAudit,
        userAgentOverride: false,
        deviceMetricsOverride: false,
        touchEmulationOverride: false,
        cdpBrowserProduct: 'Chrome/126.0.6478.50',
        cdpChromeVersion: '126.0.6478.50',
        protocolVersion: '1.3'
      },
      pageDevice: {
        userAgent:
          'Mozilla/5.0 (Linux; Android 16; Pixel 9 Pro) AppleWebKit/537.36 Chrome/126.0.0.0 Mobile Safari/537.36',
        userAgentData: {
          platform: 'Android',
          mobile: true,
          model: 'Pixel 9 Pro'
        },
        navigatorPlatform: 'Linux armv81',
        navigatorWebdriver: false,
        maxTouchPoints: 5,
        pointerCoarse: true,
        hoverNone: true,
        secureContext: true,
        webgpuAdapterAvailable: true,
        webgpuAdapterInfo: { isFallbackAdapter: false }
      }
    },
    pageConsole: { events: [] },
    servedSource: servedSource(policy, manifest),
    captureErrors: [],
    scenarios: [
      {
        id: 'sodium-water',
        url: policy.scenarios[0].url,
        interaction: 'observe-auto-animation',
        sample: sodiumWaterSample,
        telemetry: telemetry(),
        autoSchedule: {
          residentAuto: true,
          status: 'resident-auto-schedule-enabled'
        },
        presentation: {
          rendererBackend: 'native-webgpu',
          surfaceDrawMode: 'native-webgpu-surface-consumer',
          nativeSurfaceDrawRequested: true
        },
        mechanics: {
          p2gMode: 'field',
          gridMode: 'field',
          g2pMode: 'field',
          productEventCount: null,
          productEventRowCapacity: 32768,
          productEventCountAuthority: 'gpu-authored-filtered-live-prefix',
          productEventCountHostKnown: false,
          productDispatchMode:
            'gpu-authenticated-gas-only-no-mechanics-scatter',
          productGridCouplingStatus:
            'resident-product-mass-gas-only-certified-no-mechanics-p2g-scatter',
          productCoupledEventCount: 0,
          productCoupledUnplacedMassKg: 0,
          ambient: {
            requested: true,
            required: false,
            skipReason:
              'resident-product-mass-requires-dense-p2g-compatibility'
          }
        }
      },
      {
        id: 'triple-water',
        url: policy.scenarios[1].url,
        interaction: 'click-add-stacked-water-body-once-then-observe-auto-animation',
        sample: tripleWaterSample,
        telemetry: telemetry(),
        autoSchedule: {
          residentAuto: true,
          status: 'resident-auto-schedule-enabled'
        },
        presentation: {
          rendererBackend: 'native-webgpu',
          surfaceDrawMode: 'native-webgpu-surface-consumer',
          nativeSurfaceDrawRequested: true
        },
        mechanics: {
          p2gMode: 'field',
          gridMode: 'field',
          g2pMode: 'field',
          ambient: {
            requested: true,
            required: true,
            skipReason: null
          }
        },
        bodyProof: {
          h2oBodyCountBefore: 2,
          h2oBodyCountAfter: 3,
          rebuildGenerationBefore: 7,
          rebuildGenerationAfter: 8,
          bodiesBefore: [body0, body1],
          bodiesAfter: [body0, body1, body2],
          addedBodyId: 'body-2',
          verticalStack: true,
          expectedAddedCenterY: 2.42,
          verticalPitchM: 0.12
        }
      }
    ]
  };
}

function rawArtifactEvidence(evidence, policy) {
  const serial = evidence.provenance.adb.devicesRow.serial;
  const deviceRow = evidence.provenance.adb.devicesRow;
  const serialArgs = ['-s', serial];
  const devicesLine = [
    serial,
    'device',
    `product:${deviceRow.product}`,
    `model:${deviceRow.model}`,
    `device:${deviceRow.device}`,
    ...(deviceRow.usb ? [`usb:${deviceRow.usb}`] : []),
    `transport_id:${deviceRow.transportId}`
  ].join(' ');
  const getprop = [
    '[ro.product.manufacturer]: [Google]',
    '[ro.product.brand]: [google]',
    '[ro.product.model]: [Pixel 9 Pro]',
    '[ro.product.device]: [caiman]',
    '[ro.product.name]: [caiman]',
    '[ro.kernel.qemu]: [0]',
    '[ro.boot.qemu]: [0]',
    '[ro.hardware]: [tensor]',
    '[ro.build.fingerprint]: [google/caiman/caiman:16/BP2A.260705.001/123456:user/release-keys]',
    '[ro.product.cpu.abi]: [arm64-v8a]',
    ''
  ].join('\n');
  const records = {
    'adb-devices': rawCommand(
      'adb-devices',
      ['devices', '-l'],
      `List of devices attached\n${devicesLine}\n`
    ),
    'adb-get-state': rawCommand(
      'adb-get-state', [...serialArgs, 'get-state'], 'device\n'
    ),
    'adb-getprop': rawCommand(
      'adb-getprop', [...serialArgs, 'shell', 'getprop'], getprop
    ),
    'chrome-package': rawJson('chrome-package', {
      pmPath: rawCommand(
        'chrome-package-pm-path',
        [...serialArgs, 'shell', 'pm', 'path', policy.chromePackage],
        'package:/data/app/~~abc/com.android.chrome-abc/base.apk\n'
      ),
      dumpsys: rawCommand(
        'chrome-package-dumpsys',
        [...serialArgs, 'shell', 'dumpsys', 'package', policy.chromePackage],
        'Packages:\n  versionName=126.0.6478.50\n'
      )
    }),
    'chrome-process': rawJson('chrome-process', {
      before: rawCommand(
        'chrome-process-before',
        [...serialArgs, 'shell', 'pidof', policy.chromePackage],
        '4127\n'
      ),
      after: rawCommand(
        'chrome-process-after',
        [...serialArgs, 'shell', 'pidof', policy.chromePackage],
        '4127\n'
      )
    }),
    'adb-forward': rawJson('adb-forward', {
      create: rawCommand(
        'adb-forward-create',
        [...serialArgs, 'forward', 'tcp:0', 'localabstract:chrome_devtools_remote'],
        '43333\n'
      ),
      ownershipCheck: rawCommand(
        'adb-forward-ownership-check',
        [...serialArgs, 'forward', '--list'],
        `${serial} tcp:43333 localabstract:chrome_devtools_remote\n`
      ),
      remove: rawCommand(
        'adb-forward-remove',
        [...serialArgs, 'forward', '--remove', 'tcp:43333'],
        ''
      )
    }),
    'cdp-version': rawJson('cdp-version', {
      Browser: evidence.provenance.browser.cdpBrowserProduct,
      'Protocol-Version': evidence.provenance.browser.protocolVersion
    }),
    'target-lifecycle': rawJson('target-lifecycle', {
      targetsBefore: evidence.provenance.browser.lifecycle.targetsBefore.map(
        (id) => ({ id, type: 'page' })
      ),
      createdTarget: {
        id: evidence.provenance.browser.lifecycle.createdTargetId,
        type: 'page',
        url: 'about:blank',
        webSocketDebuggerUrl: 'ws://127.0.0.1/devtools/page/receipt-target'
      },
      closeResponse: evidence.provenance.browser.lifecycle.closeResponse,
      targetsAfter: evidence.provenance.browser.lifecycle.targetsAfter.map(
        (id) => ({ id, type: 'page' })
      ),
      cdpCommandAudit: evidence.provenance.browser.cdpCommandAudit
    }),
    'page-device': rawJson('page-device', evidence.provenance.pageDevice),
    'served-source': rawJson('served-source', evidence.servedSource),
    'page-console': rawJson('page-console', evidence.pageConsole),
    'sodium-water-sample': rawJson('sodium-water-sample', evidence.scenarios[0]),
    'triple-water-sample': rawJson('triple-water-sample', evidence.scenarios[1])
  };
  return evidence.rawArtifacts.map((artifact) => ({
    ...artifact,
    record: records[artifact.id],
    ...(artifact.id === 'served-source' ? {
      resourceArtifacts: evidence.servedSource.transformed.resources.map((resource) => ({
        url: resource.url,
        ...resource.artifact,
        bytes: fixtureResourceBytes.get(resource.artifact.path)
      }))
    } : {})
  }));
}

function evaluate(
  evidence,
  policy,
  manifest,
  artifactEvidence = rawArtifactEvidence(evidence, policy)
) {
  return evaluatePhysicalPixelEvidence(evidence, {
    expectedPolicy: policy,
    currentFingerprint: fingerprint(),
    currentSourceManifest: manifest,
    artifactEvidence
  });
}

async function writeJson(outputPath, value) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeRawArtifacts(root, evidence, policy) {
  const rows = rawArtifactEvidence(evidence, policy);
  const output = [];
  for (const row of rows) {
    const artifactPath = path.join(root, 'raw', `${row.id}.json`);
    const bytes = Buffer.from(`${JSON.stringify(row.record, null, 2)}\n`);
    await mkdir(path.dirname(artifactPath), { recursive: true, mode: 0o700 });
    await writeFile(artifactPath, bytes, { mode: 0o600 });
    const identity = await lstat(artifactPath);
    output.push({
      id: row.id,
      path: artifactPath,
      byteLength: bytes.byteLength,
      sha256: sha256Bytes(bytes),
      publicationIdentity: {
        dev: identity.dev,
        ino: identity.ino
      }
    });
  }
  return output;
}

async function writeServedSourceResourceArtifacts(root, evidence) {
  for (const resource of evidence.servedSource.transformed.resources) {
    const bytes = fixtureResourceBytes.get(resource.artifact.path);
    assert.ok(Buffer.isBuffer(bytes), `fixture bytes missing for ${resource.url}`);
    const artifactPath = path.join(
      root,
      'served-source-resources',
      path.basename(resource.artifact.path)
    );
    await mkdir(path.dirname(artifactPath), { recursive: true, mode: 0o700 });
    await writeFile(artifactPath, bytes, { mode: 0o600 });
    resource.artifact = {
      path: artifactPath,
      byteLength: bytes.byteLength,
      sha256: sha256Bytes(bytes)
    };
    fixtureResourceBytes.set(artifactPath, bytes);
  }
}

async function buildClosureWithArtifacts({
  root,
  repoDir,
  resourceArtifactDir,
  artifactPublicationFixture = null
}) {
  const policy = createPhysicalPixelMobilePolicy({ baseUrl: BASE_URL });
  const manifest = sourceManifest(policy);
  const bytesByPath = new Map();
  for (const modulePath of policy.sourceModulePaths) {
    const bytes = Buffer.from(`export const fixture_${sha256Bytes(modulePath).slice(0, 8)} = true;\n`);
    bytesByPath.set(`/${modulePath}`, bytes);
    const sourcePath = path.join(repoDir, modulePath);
    await mkdir(path.dirname(sourcePath), { recursive: true });
    await writeFile(sourcePath, bytes);
  }
  return buildPhysicalPixelViteResourceClosure({
    baseUrl: BASE_URL,
    sourceManifest: manifest,
    repoDir,
    resourceArtifactDir,
    artifactPublicationFixture,
    fetchResource: async (url) => {
      const parsed = new URL(url);
      const bytes = bytesByPath.get(parsed.pathname);
      if (bytes == null) throw new Error(`missing closure fixture ${parsed.pathname}`);
      return { url: parsed.href, bytes, contentType: 'text/javascript' };
    }
  });
}

test('physical Pixel policy pins HTTPS routes without authorizing Chrome termination', () => {
  const policy = createPhysicalPixelMobilePolicy({ baseUrl: BASE_URL });
  assert.equal(
    policy.schema,
    'peercompute.ulg.ss-physical-pixel-mobile-command-policy.v2'
  );
  assert.equal(
    policy.policyId,
    'physical-google-pixel-9-pro-adb-cdp-compositor-motion-v2'
  );
  assert.equal(policy.compositorEvidence.captureMethod, 'Page.captureScreenshot');
  assert.equal(policy.compositorEvidence.layoutMetricsMethod, 'Page.getLayoutMetrics');
  assert.equal(policy.compositorEvidence.requiredVisualViewportScale, 1);
  assert.equal(policy.compositorEvidence.requiredPageZoom, 1);
  assert.equal(
    policy.compositorEvidence.outputPixelSizing,
    'clip-dip-times-page-scale'
  );
  assert.equal(policy.compositorEvidence.framePairsPerScenario, 2);
  assert.equal(policy.compositorEvidence.minChangedPixelCount, 8);
  assert.equal(policy.compositorEvidence.minChangedPixelRatio, 0.001);
  assert.equal(policy.compositorEvidence.minChangedBoundsWidth, 2);
  assert.equal(policy.compositorEvidence.minChangedBoundsHeight, 2);
  assert.equal(policy.requiredDevice.model, 'Pixel 9 Pro');
  assert.equal(policy.requiredDevice.device, 'caiman');
  assert.deepEqual(policy.wallClockLimitsMs, PHYSICAL_PIXEL_LIVENESS_LIMITS_MS);
  assert.deepEqual(
    policy.scenarios.map((scenario) => scenario.id),
    ['sodium-water', 'triple-water']
  );
  assert.match(policy.scenarios[0].url, /scenario=sodium-water/);
  assert.match(policy.scenarios[1].url, /scenario=water-cycle/);
  assert.match(policy.scenarios[0].url, /residentAuto=1/);
  assert.match(policy.scenarios[1].url, /residentAuto=1/);
  assert.doesNotMatch(policy.scenarios[0].url, /residentAuto=0/);
  assert.throws(
    () => createPhysicalPixelMobilePolicy({ baseUrl: 'http://localhost:4173/' }),
    /HTTPS origin/
  );
});

test('physical Pixel capture has one cumulative sub-ten-minute deadline', () => {
  assert.deepEqual(
    resolvePhysicalPixelLivenessDeadlines({}),
    PHYSICAL_PIXEL_LIVENESS_LIMITS_MS
  );
  assert.equal(PHYSICAL_PIXEL_LIVENESS_LIMITS_MS.activeCapture, 480_000);
  assert.equal(PHYSICAL_PIXEL_LIVENESS_LIMITS_MS.absolute, 540_000);
  assert.ok(PHYSICAL_PIXEL_LIVENESS_LIMITS_MS.absolute < 600_000);
  assert.equal(physicalPixelDeadlineRemainingMs(10_000, {
    ceilingMs: 3_000,
    nowMs: 8_000
  }), 2_000);
  assert.throws(
    () => physicalPixelDeadlineRemainingMs(8_000, { nowMs: 8_000 }),
    /cumulative physical Pixel deadline/
  );
  assert.throws(
    () => resolvePhysicalPixelLivenessDeadlines({
      ULG_PHYSICAL_PIXEL_ABSOLUTE_TIMEOUT_MS: '540001'
    }),
    /cannot exceed 540000 ms/
  );
  assert.throws(
    () => resolvePhysicalPixelLivenessDeadlines({
      ULG_PHYSICAL_PIXEL_ACTIVE_CAPTURE_TIMEOUT_MS: '480000',
      ULG_PHYSICAL_PIXEL_CLEANUP_TIMEOUT_MS: '30000',
      ULG_PHYSICAL_PIXEL_ABSOLUTE_TIMEOUT_MS: '500000'
    }),
    /reserve cleanup below ten minutes/
  );
});

test('physical Pixel source threads policy and cumulative deadlines through real capture', async () => {
  const source = await readFile(
    path.resolve('scripts/ss-physical-pixel-mobile-liveness-receipt.mjs'),
    'utf8'
  );
  assert.match(source, /captureNativeCompositorFrame\(client, \{ label, policy \}\)/u);
  assert.match(source, /captureAdvancingWindow\(client, \{\s*policy,/u);
  assert.match(source, /deadlineAtMs: activeDeadlineAtMs/u);
  assert.match(source, /deadlineAtMs: cleanupDeadlineAtMs/u);
  assert.match(source, /child\.kill\('SIGKILL'\)/u);
  assert.match(source, /gpu-authenticated-gas-only-no-mechanics-scatter/u);
  assert.doesNotMatch(
    source,
    /residentProductMassInputProductEventCount \?\? 0\s*\) > 0/u
  );
});

test('served-source resource artifacts are private, repo-external, and reject unsafe existing paths', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ulg-physical-resource-private-'));
  try {
    const repoDir = path.join(root, 'repo');
    const resourceDir = path.join(root, 'artifacts', 'served-source-resources');
    await mkdir(repoDir);
    const closure = await buildClosureWithArtifacts({
      root,
      repoDir,
      resourceArtifactDir: resourceDir
    });
    const directoryStat = await lstat(resourceDir);
    assert.equal(directoryStat.mode & 0o777, 0o700);
    assert.equal(directoryStat.uid, process.getuid());
    for (const resource of closure.resources) {
      const artifactStat = await lstat(resource.artifact.path);
      assert.equal(artifactStat.mode & 0o777, 0o600);
      assert.equal(artifactStat.uid, process.getuid());
      assert.equal(artifactStat.isSymbolicLink(), false);
    }
    await assert.rejects(
      buildClosureWithArtifacts({
        root,
        repoDir,
        resourceArtifactDir: path.join(repoDir, 'served-source-resources')
      }),
      /outside the repository/
    );
    await assert.rejects(
      capturePhysicalPixelMobileEvidence({
        outputPath: path.join(root, 'capture-receipts', 'evidence.json'),
        baseUrl: BASE_URL,
        artifactDir: path.join(repoDir, 'capture-artifacts'),
        repoDir
      }),
      /outside the repository/
    );
    const unsafeDir = path.join(root, 'unsafe-resource-dir');
    await mkdir(unsafeDir, { mode: 0o755 });
    await chmod(unsafeDir, 0o755);
    await assert.rejects(
      buildClosureWithArtifacts({ root, repoDir, resourceArtifactDir: unsafeDir }),
      /mode 0700/
    );
    await assert.rejects(
      capturePhysicalPixelMobileEvidence({
        outputPath: path.join(root, 'capture-receipts', 'unsafe-evidence.json'),
        baseUrl: BASE_URL,
        artifactDir: unsafeDir,
        repoDir
      }),
      /mode 0700/
    );
    const symlinkTarget = path.join(root, 'symlink-target');
    const symlinkDir = path.join(root, 'symlink-resource-dir');
    await mkdir(symlinkTarget, { mode: 0o700 });
    await symlink(symlinkTarget, symlinkDir, 'dir');
    await assert.rejects(
      buildClosureWithArtifacts({ root, repoDir, resourceArtifactDir: symlinkDir }),
      /symbolic link/
    );
    const firstUrl = new URL('/src/main.js', BASE_URL).href;
    const symlinkTargetDir = path.join(root, 'symlink-target-artifact-dir');
    await mkdir(symlinkTargetDir, { mode: 0o700 });
    const symlinkedTarget = path.join(
      symlinkTargetDir,
      `${sha256Bytes(firstUrl)}.bin`
    );
    const redirectedBytes = path.join(root, 'redirected-resource.bin');
    await writeFile(redirectedBytes, 'redirected', { mode: 0o600 });
    await symlink(redirectedBytes, symlinkedTarget, 'file');
    await assert.rejects(
      buildClosureWithArtifacts({
        root,
        repoDir,
        resourceArtifactDir: symlinkTargetDir
      }),
      /symbolic link/
    );
    const driftDir = path.join(root, 'preexisting-drift');
    await mkdir(driftDir, { mode: 0o700 });
    const driftTarget = path.join(driftDir, `${sha256Bytes(firstUrl)}.bin`);
    await writeFile(driftTarget, 'stale', { mode: 0o644 });
    await chmod(driftTarget, 0o644);
    await assert.rejects(
      buildClosureWithArtifacts({ root, repoDir, resourceArtifactDir: driftDir }),
      /mode 0600/
    );
    const preservedDir = path.join(root, 'preexisting-private-resource');
    await mkdir(preservedDir, { mode: 0o700 });
    const preservedTarget = path.join(
      preservedDir,
      `${sha256Bytes(firstUrl)}.bin`
    );
    const preservedBytes = Buffer.from('do not replace this served resource', 'utf8');
    await writeFile(preservedTarget, preservedBytes, { mode: 0o600 });
    await assert.rejects(
      buildClosureWithArtifacts({ root, repoDir, resourceArtifactDir: preservedDir }),
      /must not replace a preexisting artifact/
    );
    assert.deepEqual(await readFile(preservedTarget), preservedBytes);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('served-resource publication syncs file bytes before its private directory entry and fails closed on parent sync failure', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ulg-physical-resource-durable-'));
  try {
    const repoDir = path.join(root, 'repo');
    await mkdir(repoDir);
    const productionRepoDir = path.resolve(process.cwd());
    const capability = await createNonProductionFixtureCapability({
      repoDir,
      productionRepoDir
    });
    const steps = [];
    const closure = await buildClosureWithArtifacts({
      root,
      repoDir,
      resourceArtifactDir: path.join(root, 'artifacts', 'served-source-resources'),
      artifactPublicationFixture: {
        capability,
        productionRepoDir,
        afterStep: ({ step, artifactPath }) => steps.push({ step, artifactPath })
      }
    });
    assert.ok(closure.resources.length > 0);
    for (let index = 0; index < steps.length; index += 4) {
      assert.deepEqual(
        steps.slice(index, index + 4).map((entry) => entry.step),
        ['after-file-sync', 'after-publication', 'before-parent-sync', 'after-parent-sync']
      );
      assert.equal(steps[index].artifactPath, steps[index + 3].artifactPath);
    }

    const failureDir = path.join(root, 'artifacts', 'served-source-fsync-failure');
    await assert.rejects(
      buildClosureWithArtifacts({
        root,
        repoDir,
        resourceArtifactDir: failureDir,
        artifactPublicationFixture: {
          capability,
          productionRepoDir,
          afterStep: ({ step }) => {
            if (step === 'before-parent-sync') throw new Error('forced parent sync failure');
          }
        }
      }),
      /forced parent sync failure/
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('raw publication preserves existing regular targets, rejects symlinks, and leaves only failed evidence', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ulg-physical-raw-noclobber-'));
  try {
    const repoDir = path.join(root, 'repo');
    await mkdir(repoDir);
    const rawDir = path.join(root, 'raw-existing');
    await mkdir(rawDir, { mode: 0o700 });
    const existingPath = path.join(rawDir, 'adb-devices.json');
    const existingBytes = Buffer.from('existing raw evidence must survive', 'utf8');
    await writeFile(existingPath, existingBytes, { mode: 0o600 });
    const regularResult = await capturePhysicalPixelMobileEvidence({
      outputPath: path.join(root, 'receipts', 'regular-failure.json'),
      baseUrl: BASE_URL,
      artifactDir: rawDir,
      repoDir
    });
    assert.equal(regularResult.evidence.status, 'failed');
    assert.match(regularResult.evidence.reason, /must not replace a preexisting artifact/);
    assert.deepEqual(await readFile(existingPath), existingBytes);
    assert.equal(
      JSON.parse(await readFile(regularResult.evidencePath, 'utf8')).status,
      'failed'
    );

    const symlinkRawDir = path.join(root, 'raw-symlink');
    await mkdir(symlinkRawDir, { mode: 0o700 });
    const redirected = path.join(root, 'redirected-raw.json');
    await writeFile(redirected, 'redirected raw target', { mode: 0o600 });
    await symlink(redirected, path.join(symlinkRawDir, 'adb-devices.json'), 'file');
    await assert.rejects(
      capturePhysicalPixelMobileEvidence({
        outputPath: path.join(root, 'receipts', 'symlink-failure.json'),
        baseUrl: BASE_URL,
        artifactDir: symlinkRawDir,
        repoDir
      }),
      /symbolic link/
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('raw JSON rereads require private stable parents and leaves', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ulg-physical-raw-reread-'));
  try {
    const repoDir = path.join(root, 'repo');
    await mkdir(repoDir);
    const policy = createPhysicalPixelMobilePolicy({ baseUrl: BASE_URL });
    const manifest = sourceManifest(policy);
    const evidence = baseEvidence({ policy, manifest });
    await writeServedSourceResourceArtifacts(root, evidence);
    evidence.rawArtifacts = await writeRawArtifacts(root, evidence, policy);
    const rawDir = path.join(root, 'raw');
    const rawPath = path.join(rawDir, 'adb-devices.json');
    const rawBytes = await readFile(rawPath);
    await chmod(rawDir, 0o700);

    const missingPublicationIdentity = structuredClone(evidence);
    delete missingPublicationIdentity.rawArtifacts[0].publicationIdentity;
    await assert.rejects(
      collectPhysicalPixelRawArtifactEvidence({
        evidence: missingPublicationIdentity,
        repoDir
      }),
      /adb-devices raw artifact publication identity mismatch/
    );
    const malformedPublicationIdentity = structuredClone(evidence);
    malformedPublicationIdentity.rawArtifacts[0].publicationIdentity = {
      dev: 'not-a-device-number',
      ino: 1
    };
    await assert.rejects(
      collectPhysicalPixelRawArtifactEvidence({
        evidence: malformedPublicationIdentity,
        repoDir
      }),
      /adb-devices raw artifact publication identity mismatch/
    );

    await chmod(rawDir, 0o755);
    await assert.rejects(
      collectPhysicalPixelRawArtifactEvidence({ evidence, repoDir }),
      /raw artifact directory must be owned by the current user with mode 0700/
    );
    await chmod(rawDir, 0o700);

    await chmod(rawPath, 0o640);
    await assert.rejects(
      collectPhysicalPixelRawArtifactEvidence({ evidence, repoDir }),
      /adb-devices raw artifact must be owned by the current user with mode 0600/
    );
    await chmod(rawPath, 0o600);

    const redirected = path.join(root, 'redirected-raw.json');
    await writeFile(redirected, rawBytes, { mode: 0o600 });
    await rm(rawPath);
    await symlink(redirected, rawPath, 'file');
    await assert.rejects(
      collectPhysicalPixelRawArtifactEvidence({ evidence, repoDir }),
      /raw artifact adb-devices must not traverse a symbolic link/
    );
    await rm(rawPath);
    await writeFile(rawPath, rawBytes, { mode: 0o600 });
    const restoredIdentity = await lstat(rawPath);
    evidence.rawArtifacts.find((row) => row.id === 'adb-devices').publicationIdentity = {
      dev: restoredIdentity.dev,
      ino: restoredIdentity.ino
    };

    const productionRepoDir = path.resolve(process.cwd());
    const capability = await createNonProductionFixtureCapability({
      repoDir,
      productionRepoDir
    });
    let leafSwapped = false;
    await assert.rejects(
      collectPhysicalPixelRawArtifactEvidence({
        evidence,
        repoDir,
        artifactReadFixture: {
          capability,
          productionRepoDir,
          afterStep: async ({ artifactPath }) => {
            if (leafSwapped || artifactPath !== rawPath) return;
            leafSwapped = true;
            const replacement = path.join(root, 'raw-leaf-replacement.json');
            await writeFile(replacement, rawBytes, { mode: 0o600 });
            await rename(replacement, rawPath);
          }
        }
      }),
      /adb-devices raw artifact changed while reread/
    );

    await writeFile(rawPath, rawBytes, { mode: 0o600 });
    const postLeafSwapIdentity = await lstat(rawPath);
    evidence.rawArtifacts.find((row) => row.id === 'adb-devices').publicationIdentity = {
      dev: postLeafSwapIdentity.dev,
      ino: postLeafSwapIdentity.ino
    };
    let parentSwapped = false;
    await assert.rejects(
      collectPhysicalPixelRawArtifactEvidence({
        evidence,
        repoDir,
        artifactReadFixture: {
          capability,
          productionRepoDir,
          afterStep: async ({ artifactPath }) => {
            if (parentSwapped || artifactPath !== rawPath) return;
            parentSwapped = true;
            const movedDirectory = path.join(root, 'raw-original');
            await rename(rawDir, movedDirectory);
            await mkdir(rawDir, { mode: 0o700 });
            await link(
              path.join(movedDirectory, 'adb-devices.json'),
              rawPath
            );
          }
        }
      }),
      /raw artifact directory changed during artifact operation/
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('local source manifest records the resolved local-relative module, worker, and CSS resource set', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ulg-physical-source-closure-'));
  try {
    const policy = createPhysicalPixelMobilePolicy({ baseUrl: BASE_URL });
    for (const modulePath of policy.sourceModulePaths) {
      const absolutePath = path.join(root, modulePath);
      await mkdir(path.dirname(absolutePath), { recursive: true });
      await writeFile(
        absolutePath,
        modulePath === 'src/main.js'
          ? [
            "import './closure-entry.js';",
            "import './closure.css';",
            "export { pinned } from './closure-export.js';",
            "import('./closure-dynamic.js');",
            "new Worker(new URL('./closure-worker.js', import.meta.url));",
            "navigator.serviceWorker.register('./closure-service-worker.js');"
          ].join('\n')
          : 'export const pinned = true;\n'
      );
    }
    await writeFile(path.join(root, 'src', 'closure-entry.js'), 'export default 1;\n');
    await writeFile(path.join(root, 'src', 'closure-export.js'), 'export const pinned = true;\n');
    await writeFile(path.join(root, 'src', 'closure-dynamic.js'), 'export default 2;\n');
    await writeFile(path.join(root, 'src', 'closure-worker.js'), 'self.postMessage(1);\n');
    await writeFile(path.join(root, 'src', 'closure-service-worker.js'), 'self.skipWaiting();\n');
    await writeFile(
      path.join(root, 'src', 'closure.css'),
      "/* @import './comment-only.css'; */\n:root { content: \"@import './string-only.css'\"; }\n@import './closure-nested.css';\n"
    );
    await writeFile(path.join(root, 'src', 'closure-nested.css'), ':root { color: green; }\n');
    const manifest = await buildPhysicalPixelLocalSourceManifest({ repoDir: root });
    assert.deepEqual(
      manifest.modules.map((row) => row.path).filter((row) => row.startsWith('src/closure')),
      [
        'src/closure-dynamic.js',
        'src/closure-entry.js',
        'src/closure-export.js',
        'src/closure-nested.css',
        'src/closure-service-worker.js',
        'src/closure-worker.js',
        'src/closure.css'
      ]
    );
    assert.equal(
      manifest.manifestSha256,
      canonicalJsonSha256({
        schema: PHYSICAL_PIXEL_SOURCE_MANIFEST_SCHEMA,
        scope: LOCAL_RELATIVE_SOURCE_SCOPE,
        modules: manifest.modules,
        unresolvedBareSpecifiers: []
      })
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('Vite transformed closure resolves optimized import rewrites, aliases, and @fs resources while rejecting cache mismatches', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ulg-physical-source-bare-'));
  try {
    const policy = createPhysicalPixelMobilePolicy({ baseUrl: BASE_URL });
    for (const modulePath of policy.sourceModulePaths) {
      const absolutePath = path.join(root, modulePath);
      await mkdir(path.dirname(absolutePath), { recursive: true });
      await writeFile(
        absolutePath,
        modulePath === 'src/main.js'
          ? "import * as THREE from 'three'; export { THREE };\n"
          : 'export const pinned = true;\n'
      );
    }
    await mkdir(path.join(root, 'node_modules', '.vite', 'deps'), { recursive: true });
    await writeFile(
      path.join(root, 'node_modules', '.vite', 'deps', 'three.js'),
      [
        "import { THREE } from './three.core-fixture.js';",
        "export { EXTRA } from './three.extra-fixture.js';",
        "export const loadDynamic = () => import('./three.dynamic-fixture.js');",
        'export { THREE };',
        ''
      ].join('\n')
    );
    await writeFile(
      path.join(root, 'node_modules', '.vite', 'deps', 'three.core-fixture.js'),
      'export const THREE = 1;\n'
    );
    await writeFile(
      path.join(root, 'node_modules', '.vite', 'deps', 'three.extra-fixture.js'),
      'export const EXTRA = 2;\n'
    );
    await writeFile(
      path.join(root, 'node_modules', '.vite', 'deps', 'three.dynamic-fixture.js'),
      'export default 3;\n'
    );
    await mkdir(path.join(root, 'ulg-gpu-abi', 'src'), { recursive: true });
    await writeFile(path.join(root, 'ulg-gpu-abi', 'src', 'alias.js'), 'export const alias = 1;\n');
    const manifest = await buildPhysicalPixelLocalSourceManifest({ repoDir: root });
    assert.deepEqual(manifest.unresolvedBareSpecifiers, [{
      importerPath: 'src/main.js',
      specifier: 'three'
    }]);
    const siblingPackage = path.resolve('..', 'webgpu-marching-cubes', 'package.json');
    const sourceByPath = new Map();
    for (const modulePath of policy.sourceModulePaths) {
      sourceByPath.set(`/${modulePath}`, await readFile(path.join(root, modulePath)));
    }
    sourceByPath.set('/src/main.js', Buffer.from(
      "import '/node_modules/.vite/deps/three.js?v=fixture';"
        + " import '/ulg-gpu-abi/src/alias.js?t=fixture';"
        + ` new URL('/@fs${siblingPackage}', import.meta.url);\n`
    ));
    sourceByPath.set('/node_modules/.vite/deps/three.js', await readFile(
      path.join(root, 'node_modules', '.vite', 'deps', 'three.js')
    ));
    sourceByPath.set('/node_modules/.vite/deps/three.core-fixture.js', await readFile(
      path.join(root, 'node_modules', '.vite', 'deps', 'three.core-fixture.js')
    ));
    sourceByPath.set('/node_modules/.vite/deps/three.extra-fixture.js', await readFile(
      path.join(root, 'node_modules', '.vite', 'deps', 'three.extra-fixture.js')
    ));
    sourceByPath.set('/node_modules/.vite/deps/three.dynamic-fixture.js', await readFile(
      path.join(root, 'node_modules', '.vite', 'deps', 'three.dynamic-fixture.js')
    ));
    sourceByPath.set('/ulg-gpu-abi/src/alias.js', await readFile(
      path.join(root, 'ulg-gpu-abi', 'src', 'alias.js')
    ));
    sourceByPath.set(`/@fs${siblingPackage}`, await readFile(siblingPackage));
    const servedOptimizedThree = [
      "import { THREE } from '/node_modules/.vite/deps/three.core-fixture.js?v=core-fixture';",
      "export { EXTRA } from '/node_modules/.vite/deps/three.extra-fixture.js?v=extra-fixture';",
      "export const loadDynamic = () => import('/node_modules/.vite/deps/three.dynamic-fixture.js?v=dynamic-fixture');",
      'export { THREE };',
      ''
    ].join('\n');
    const fetchFixture = async (url) => {
      const parsed = new URL(url);
      const bytes = sourceByPath.get(parsed.pathname);
      if (bytes == null) throw new Error(`missing fixture ${parsed.pathname}`);
      return {
        url: parsed.href,
        bytes: parsed.pathname.endsWith('/node_modules/.vite/deps/three.js')
          ? Buffer.from(`${servedOptimizedThree}\n//# sourceMappingURL=three.js.map`)
          : bytes,
        contentType: parsed.pathname.endsWith('.json') ? 'application/json' : 'text/javascript'
      };
    };
    const closure = await buildPhysicalPixelViteResourceClosure({
      baseUrl: BASE_URL,
      sourceManifest: manifest,
      fetchResource: fetchFixture,
      repoDir: root
    });
    assert.ok(closure.resources.some((row) => row.url.includes('/node_modules/.vite/deps/three.js?v=fixture')));
    assert.ok(closure.resources.some((row) => row.url.includes('/ulg-gpu-abi/src/alias.js?t=fixture')));
    assert.ok(closure.resources.some((row) => row.url.includes('/@fs/home/cos/projects/webgpu-marching-cubes/package.json')));
    const optimizedThree = closure.resources.find((row) => row.url.includes('/node_modules/.vite/deps/three.js?v=fixture'));
    assert.equal(optimizedThree.local.browserBytesEqual, false);
    assert.equal(optimizedThree.local.canonicalBytesEqual, true);
    await assert.rejects(
      buildPhysicalPixelViteResourceClosure({
        baseUrl: BASE_URL,
        sourceManifest: manifest,
        repoDir: root,
        fetchResource: async (url) => {
          const result = await fetchFixture(url);
          return result.url.includes('/node_modules/.vite/deps/three.js')
            ? {
              ...result,
              bytes: Buffer.from(
                'const tampered = true;\n'
                  + `${servedOptimizedThree}\n//# sourceMappingURL=three.js.map`
              )
            }
            : result;
        }
      }),
      /served resource bytes differ/
    );
    await assert.rejects(
      buildPhysicalPixelViteResourceClosure({
        baseUrl: BASE_URL,
        sourceManifest: manifest,
        repoDir: root,
        fetchResource: async (url) => {
          const result = await fetchFixture(url);
          return result.url.includes('/node_modules/.vite/deps/three.js')
            ? {
              ...result,
              bytes: Buffer.from(
                `${servedOptimizedThree.replace('three.core-fixture.js', 'three.changed-fixture.js')}`
                  + '\n//# sourceMappingURL=three.js.map'
              )
            }
            : result;
        }
      }),
      /served resource bytes differ/
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('Vite closure follows the actual multiline marching-cubes import without matching comments, strings, or regexes', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ulg-physical-multiline-import-'));
  try {
    const policy = createPhysicalPixelMobilePolicy({ baseUrl: BASE_URL });
    const marchingCubesPackage = path.resolve('..', 'webgpu-marching-cubes', 'package.json');
    const marchingCubesEndpoint = `/@fs${marchingCubesPackage}`;
    for (const modulePath of policy.sourceModulePaths) {
      const absolutePath = path.join(root, modulePath);
      await mkdir(path.dirname(absolutePath), { recursive: true });
      await writeFile(
        absolutePath,
        modulePath === 'src/visualization/sphPhaseScene.js'
          ? [
            'import {',
            '  createBufferVolumeDescriptor as createWebGpuMarchingCubesBufferVolumeDescriptor,',
            '  createMarchingCubesSurfaceAdapter',
            "} from 'three-webgpu-marching-cubes';"
          ].join('\n')
          : 'export const pinned = true;\n'
      );
    }
    const manifest = await buildPhysicalPixelLocalSourceManifest({ repoDir: root });
    assert.deepEqual(manifest.unresolvedBareSpecifiers, [{
      importerPath: 'src/visualization/sphPhaseScene.js',
      specifier: 'three-webgpu-marching-cubes'
    }]);
    const sourceByPath = new Map();
    for (const modulePath of policy.sourceModulePaths) {
      sourceByPath.set(`/${modulePath}`, await readFile(path.join(root, modulePath)));
    }
    sourceByPath.set('/src/visualization/sphPhaseScene.js', Buffer.from([
      "// import '/ignored-comment.js';",
      "const ignoredString = \"export { ignored } from '/ignored-string.js'\";",
      "const ignoredRegex = /import\\s+['\"]\\/ignored-regex/;",
      'import {',
      '  createBufferVolumeDescriptor as createWebGpuMarchingCubesBufferVolumeDescriptor,',
      '  createMarchingCubesSurfaceAdapter',
      `} from '${marchingCubesEndpoint}?v=multiline-fixture';`
    ].join('\n')));
    sourceByPath.set(marchingCubesEndpoint, await readFile(marchingCubesPackage));
    const closure = await buildPhysicalPixelViteResourceClosure({
      baseUrl: BASE_URL,
      sourceManifest: manifest,
      repoDir: root,
      fetchResource: async (url) => {
        const parsed = new URL(url);
        const bytes = sourceByPath.get(parsed.pathname);
        if (bytes == null) throw new Error(`unexpected closure request ${parsed.pathname}`);
        return {
          url: parsed.href,
          bytes,
          contentType: parsed.pathname.endsWith('.json') ? 'application/json' : 'text/javascript'
        };
      }
    });
    const transformedEndpoint = new URL(
      `${marchingCubesEndpoint}?v=multiline-fixture`,
      BASE_URL
    ).href;
    assert.ok(closure.resources.some((row) => row.url === transformedEndpoint));
    assert.ok(closure.edges.some((edge) => (
      edge.from === new URL('/src/visualization/sphPhaseScene.js', BASE_URL).href
      && edge.kind === 'static-import'
      && edge.to === transformedEndpoint
    )));
    assert.equal(closure.resources.some((row) => row.url.includes('/ignored-')), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('Vite closure parses extensionless /@id JavaScript endpoints by MIME and follows their child import', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ulg-physical-vite-mime-'));
  try {
    const policy = createPhysicalPixelMobilePolicy({ baseUrl: BASE_URL });
    for (const modulePath of policy.sourceModulePaths) {
      const absolutePath = path.join(root, modulePath);
      await mkdir(path.dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, 'export const pinned = true;\n');
    }
    const manifest = await buildPhysicalPixelLocalSourceManifest({ repoDir: root });
    const sourceByPath = new Map();
    for (const modulePath of policy.sourceModulePaths) {
      sourceByPath.set(`/${modulePath}`, await readFile(path.join(root, modulePath)));
    }
    sourceByPath.set('/src/main.js', Buffer.from("import '/@id/virtual-parent';\n"));
    sourceByPath.set('/@id/virtual-parent', Buffer.from("import './virtual-child'; export const parent = true;\n"));
    sourceByPath.set('/@id/virtual-child', Buffer.from('export const child = true;\n'));
    const closure = await buildPhysicalPixelViteResourceClosure({
      baseUrl: BASE_URL,
      sourceManifest: manifest,
      repoDir: root,
      fetchResource: async (url) => {
        const parsed = new URL(url);
        const bytes = sourceByPath.get(parsed.pathname);
        if (bytes == null) throw new Error(`unexpected closure request ${parsed.pathname}`);
        return {
          url: parsed.href,
          bytes,
          contentType: parsed.pathname.startsWith('/@id/')
            ? 'application/javascript; charset=utf-8'
            : 'text/javascript'
        };
      }
    });
    const parentUrl = new URL('/@id/virtual-parent', BASE_URL).href;
    const childUrl = new URL('/@id/virtual-child', BASE_URL).href;
    assert.ok(closure.resources.some((row) => row.url === childUrl));
    assert.ok(closure.edges.some((edge) => (
      edge.from === parentUrl && edge.kind === 'static-import' && edge.to === childUrl
    )));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('strict physical Pixel evidence and source-bound receipt pass', () => {
  const policy = createPhysicalPixelMobilePolicy({ baseUrl: BASE_URL });
  const manifest = sourceManifest(policy);
  const evidence = baseEvidence({ policy, manifest });
  const evidenceEvaluation = evaluate(evidence, policy, manifest);
  assert.equal(evidenceEvaluation.passed, true, evidenceEvaluation.failures.join('; '));
  assert.deepEqual(evidenceEvaluation.failures, []);
  const evidenceArtifact = {
    path: '/tmp/physical-pixel-evidence.json',
    byteLength: 901,
    sha256: sha256Bytes('physical evidence')
  };
  const receipt = {
    schema: PHYSICAL_PIXEL_RECEIPT_SCHEMA,
    policyTrack: policy.policyTrack,
    status: 'complete',
    evidenceArtifact,
    evidenceDigest: evidenceEvaluation.evidenceDigest,
    sourceFingerprint: fingerprint(),
    sourceManifestSha256: manifest.manifestSha256,
    commandPolicySha256: policy.commandPolicySha256
  };
  const receiptEvaluation = evaluatePhysicalPixelMobileLivenessReceipt(
    receipt,
    {
      evidenceArtifact,
      evidence,
      expectedPolicy: policy,
      currentFingerprint: fingerprint(),
      currentSourceManifest: manifest,
      artifactEvidence: rawArtifactEvidence(evidence, policy)
    }
  );
  assert.equal(receiptEvaluation.passed, true);
  const event = physicalPixelMobileLivenessIccEvent({
    receipt,
    evaluation: receiptEvaluation
  });
  assert.equal(event.kind, PHYSICAL_PIXEL_EVENT_KIND);
  assert.equal(event.name, PHYSICAL_PIXEL_EVENT_NAME);
  assert.equal(event.status, 'PASS');
});

test('artifact reader rereads owned transformed-resource bytes before accepting closure claims', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ulg-physical-resource-artifacts-'));
  try {
    const repoDir = path.join(root, 'repo');
    await mkdir(repoDir);
    const policy = createPhysicalPixelMobilePolicy({ baseUrl: BASE_URL });
    const manifest = sourceManifest(policy);
    const evidence = baseEvidence({ policy, manifest });
    await writeServedSourceResourceArtifacts(root, evidence);
    evidence.rawArtifacts = await writeRawArtifacts(root, evidence, policy);
    const evidencePath = path.join(root, 'receipts', 'physical-evidence.json');
    await writeJson(evidencePath, evidence);
    const observed = await readPhysicalPixelMobileLivenessArtifactEvidence({
      receipt: { evidenceArtifact: { path: evidencePath } },
      repoDir
    });
    assert.equal(
      evaluatePhysicalPixelEvidence(observed.evidence, {
        expectedPolicy: observed.expectedPolicy,
        currentFingerprint: fingerprint(),
        currentSourceManifest: manifest,
        artifactEvidence: observed.artifactEvidence
      }).passed,
      true
    );
    const resource = evidence.servedSource.transformed.resources[0];
    await chmod(resource.artifact.path, 0o644);
    await assert.rejects(
      readPhysicalPixelMobileLivenessArtifactEvidence({
        receipt: { evidenceArtifact: { path: evidencePath } },
        repoDir
      }),
      /mode 0600/
    );
    await chmod(resource.artifact.path, 0o600);
    await writeFile(resource.artifact.path, 'tampered transformed source\n');
    const tampered = await readPhysicalPixelMobileLivenessArtifactEvidence({
      receipt: { evidenceArtifact: { path: evidencePath } },
      repoDir
    });
    assert.equal(
      evaluatePhysicalPixelEvidence(tampered.evidence, {
        expectedPolicy: tampered.expectedPolicy,
        currentFingerprint: fingerprint(),
        currentSourceManifest: manifest,
        artifactEvidence: tampered.artifactEvidence
      }).passed,
      false
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('receipt validation reconstructs the captured Vite byte closure and rejects incomplete or invented graph claims', () => {
  const policy = createPhysicalPixelMobilePolicy({ baseUrl: BASE_URL });
  const manifest = sourceManifest(policy);
  const baseline = baseEvidence({ policy, manifest });
  const rootUrl = baseline.servedSource.transformed.roots[0];
  const childUrl = baseline.servedSource.transformed.resources.find((resource) => (
    resource.url !== rootUrl && resource.url.endsWith('/physical-receipt-fixture-child')
  )).url;
  const cases = [
    ['removed per-resource edge', (evidence) => {
      evidence.servedSource.transformed.resources.find((resource) => resource.url === rootUrl)
        .edges = [];
    }],
    ['wrong global edge union', (evidence) => {
      evidence.servedSource.transformed.edges = [];
    }],
    ['missing dependency resource', (evidence) => {
      evidence.servedSource.transformed.resources = evidence.servedSource.transformed.resources
        .filter((resource) => resource.url !== childUrl);
    }],
    ['orphan resource', (evidence) => {
      const url = new URL('/src/physical-receipt-orphan', policy.baseUrl).href;
      const bytes = Buffer.from('export const orphan = true;\n');
      const artifact = {
        path: `/fixture/physical-receipt-${sha256Bytes(url)}.bin`,
        byteLength: bytes.byteLength,
        sha256: sha256Bytes(bytes)
      };
      fixtureResourceBytes.set(artifact.path, bytes);
      evidence.servedSource.transformed.resources.push({
        url,
        byteLength: bytes.byteLength,
        browserSha256: sha256Bytes(bytes),
        artifact,
        contentType: 'application/javascript',
        edgeKinds: ['static-import'],
        comparison: 'transformed-source',
        edges: []
      });
    }],
    ['dangling parsed dependency', (evidence) => {
      const root = evidence.servedSource.transformed.resources.find(
        (resource) => resource.url === rootUrl
      );
      const missingUrl = new URL('/src/physical-receipt-missing', policy.baseUrl).href;
      const bytes = Buffer.from(
        "import './physical-receipt-fixture-child'; import './physical-receipt-missing';\n"
      );
      root.byteLength = bytes.byteLength;
      root.browserSha256 = sha256Bytes(bytes);
      root.artifact.byteLength = bytes.byteLength;
      root.artifact.sha256 = sha256Bytes(bytes);
      root.edges = [
        { kind: 'static-import', to: childUrl },
        { kind: 'static-import', to: missingUrl }
      ];
      evidence.servedSource.transformed.edges.push({
        from: rootUrl,
        kind: 'static-import',
        to: missingUrl
      });
      fixtureResourceBytes.set(root.artifact.path, bytes);
    }]
  ];
  for (const [label, mutate] of cases) {
    const evidence = structuredClone(baseline);
    mutate(evidence);
    const artifactEvidence = rawArtifactEvidence(evidence, policy);
    assert.equal(evaluate(evidence, policy, manifest, artifactEvidence).passed, false, label);
  }

  const missingArtifactEvidence = rawArtifactEvidence(baseline, policy);
  missingArtifactEvidence.find((row) => row.id === 'served-source').resourceArtifacts.pop();
  assert.equal(
    evaluate(baseline, policy, manifest, missingArtifactEvidence).passed,
    false,
    'every closure resource must retain a rereadable byte artifact'
  );
});

test('raw forward ownership check rejects a changed mapping before cleanup', () => {
  const policy = createPhysicalPixelMobilePolicy({ baseUrl: BASE_URL });
  const manifest = sourceManifest(policy);
  const evidence = baseEvidence({ policy, manifest });
  const artifacts = rawArtifactEvidence(evidence, policy);
  artifacts.find((row) => row.id === 'adb-forward').record.value.ownershipCheck.stdout =
    'other-serial tcp:43333 localabstract:somebody-else\n';
  assert.equal(
    evaluate(evidence, policy, manifest, artifacts).passed,
    false,
    'a race that changes the allocated forward must not authorize its removal'
  );
});

test('authenticated wireless ADB remains physical without weakening device proof', () => {
  const policy = createPhysicalPixelMobilePolicy({ baseUrl: BASE_URL });
  const manifest = sourceManifest(policy);
  const evidence = baseEvidence({ policy, manifest });
  Object.assign(evidence.provenance.adb.devicesRow, {
    serial: '192.0.2.44:37123',
    transport: 'wireless-adb',
    usb: null,
    transportId: '7'
  });
  evidence.provenance.browser.forward.serial = '192.0.2.44:37123';
  assert.equal(evaluate(evidence, policy, manifest).passed, true);
});

test('physical evaluator rejects emulation, source drift, readbacks, and zero animation', () => {
  const policy = createPhysicalPixelMobilePolicy({ baseUrl: BASE_URL });
  const manifest = sourceManifest(policy);
  const baseline = baseEvidence({ policy, manifest });
  const mutations = [
    ['emulator serial', (value) => {
      value.provenance.adb.devicesRow.serial = 'emulator-5554';
    }],
    ['CDP emulation', (value) => {
      value.provenance.browser.cdpEmulationCommands.push(
        'Emulation.setDeviceMetricsOverride'
      );
    }],
    ['CPU map', (value) => {
      value.scenarios[0].telemetry.observedCounters.maps = 1;
    }],
    ['unknown full-particle measurement', (value) => {
      value.scenarios[0].sample.windows[0].before.telemetry.fullParticleReadbackPerformed = null;
    }],
    ['unknown liveness baseline counter', (value) => {
      value.scenarios[0].sample.windows[0].before.submissions = null;
    }],
    ['window warning despite a clean final snapshot', (value) => {
      value.scenarios[0].sample.windows[0].before.warningMessages.push('GPU warning');
    }],
    ['window loses native presentation despite a clean final snapshot', (value) => {
      value.scenarios[0].sample.windows[0].after.presentation.rendererBackend = null;
    }],
    ['window telemetry is incomplete despite a clean final snapshot', (value) => {
      value.scenarios[0].sample.windows[0].after.telemetry.observedCounters.bytes = null;
    }],
    ['zero steps', (value) => {
      value.scenarios[0].sample.animationStepCount = 0;
    }],
    ['stalled nextStep', (value) => {
      value.scenarios[1].sample.windows[1].after.nextStep =
        value.scenarios[1].sample.windows[1].before.nextStep;
    }],
    ['source mismatch', (value) => {
      value.servedSource.rawSourceParity.modules[2].browserSha256 = 'f'.repeat(64);
    }],
    ['missing third body', (value) => {
      value.scenarios[1].bodyProof.h2oBodyCountAfter = 2;
    }],
    ['unknown rebuild generation', (value) => {
      value.scenarios[1].bodyProof.rebuildGenerationBefore = null;
    }],
    ['auto schedule disabled', (value) => {
      value.scenarios[0].autoSchedule.residentAuto = false;
    }],
    ['insufficient windows', (value) => {
      value.scenarios[0].sample.windows.pop();
    }],
    ['non-stacked third body', (value) => {
      value.scenarios[1].bodyProof.bodiesAfter[2].centerM[0] += 0.5;
    }],
    ['preexisting target closed', (value) => {
      value.provenance.browser.lifecycle.existingTargetsClosed = 1;
    }],
    ['close command targets a preexisting page', (value) => {
      value.provenance.browser.cdpCommandAudit.find(
        (row) => row.method === 'Target.closeTarget'
      ).targetId = 'preexisting-target';
    }],
    ['browser crash command in CDP audit', (value) => {
      value.provenance.browser.cdpCommandAudit.push(cdpAuditRow('Browser.crash'));
    }],
    ['nonzero QEMU property', (value) => {
      value.provenance.adb.properties.roKernelQemu = '1';
    }],
    ['non-Tensor hardware', (value) => {
      value.provenance.adb.properties.roHardware = 'ranchu';
    }],
    ['synthetic provider', (value) => {
      value.captureProviderId = 'synthetic-test-provider';
    }]
  ];
  for (const [label, mutate] of mutations) {
    const evidence = structuredClone(baseline);
    mutate(evidence);
    assert.equal(evaluate(evidence, policy, manifest).passed, false, label);
  }

  const mismatchedRaw = structuredClone(rawArtifactEvidence(baseline, policy));
  mismatchedRaw.find((row) => row.id === 'sodium-water-sample')
    .record.value.sample.animationStepCount = 999;
  assert.equal(
    evaluate(baseline, policy, manifest, mismatchedRaw).passed,
    false,
    'raw sample must exactly match structured scenario'
  );

  const rawMirroredUnknown = structuredClone(rawArtifactEvidence(baseline, policy));
  rawMirroredUnknown.find((row) => row.id === 'sodium-water-sample')
    .record.value.sample.windows[0].before.telemetry.fullParticleReadbackPerformed = null;
  const evidenceWithRawMirror = structuredClone(baseline);
  evidenceWithRawMirror.scenarios[0].sample.windows[0].before.telemetry.fullParticleReadbackPerformed = null;
  assert.equal(
    evaluate(evidenceWithRawMirror, policy, manifest, rawMirroredUnknown).passed,
    false,
    'unknown raw-artifact telemetry measurement must fail even when mirrored structurally'
  );

  const rawNonCanonicalAdb = structuredClone(rawArtifactEvidence(baseline, policy));
  rawNonCanonicalAdb.find((row) => row.id === 'adb-get-state').record.executable =
    '/usr/bin/adb';
  assert.equal(
    evaluate(baseline, policy, manifest, rawNonCanonicalAdb).passed,
    false,
    'raw command executable must use the exact canonical adb form'
  );
});

test('physical evaluator admits only the exact benign compact-motion warning diagnostic', () => {
  const policy = createPhysicalPixelMobilePolicy({ baseUrl: BASE_URL });
  const manifest = sourceManifest(policy);
  const benign = baseEvidence({ policy, manifest });
  const warnedSnapshot = benign.scenarios[0].sample.windows[0].before;
  warnedSnapshot.warningText =
    `Physics: 42 FPS ${BENIGN_COMPACT_MOTION_WARNING}`;
  warnedSnapshot.warningMessages = [BENIGN_COMPACT_MOTION_WARNING];
  warnedSnapshot.motionDiagnostic = {
    schema: 'peercompute.ulg.sph-demo-resident-motion-diagnostic.v0',
    status: 'motion-unknown-no-compact-summary',
    maxDisplacementM: null,
    compactGpuSummaryAvailable: false
  };
  const benignEvaluation = evaluate(benign, policy, manifest);
  assert.equal(
    benignEvaluation.passed,
    true,
    benignEvaluation.failures.join('; ')
  );

  const mismatchedDiagnostic = structuredClone(benign);
  mismatchedDiagnostic.scenarios[0].sample.windows[0].before
    .motionDiagnostic.compactGpuSummaryAvailable = true;
  assert.equal(
    evaluate(mismatchedDiagnostic, policy, manifest).passed,
    false,
    'warning diagnostic status and compact-summary availability must agree'
  );

  const additionalWarning = structuredClone(benign);
  additionalWarning.scenarios[0].sample.windows[0].before.warningMessages.push(
    'A second warning must fail closed.'
  );
  assert.equal(
    evaluate(additionalWarning, policy, manifest).passed,
    false,
    'the benign compact-motion warning must be the only warning'
  );
});

test('physical compositor evidence rejects blank, static, tampered, and unaudited frames', () => {
  const policy = createPhysicalPixelMobilePolicy({ baseUrl: BASE_URL });
  const manifest = sourceManifest(policy);
  const baseline = baseEvidence({ policy, manifest });
  const cases = [
    ['uniform compositor background', (evidence) => {
      const window = evidence.scenarios[0].sample.windows[0];
      replaceCompositorFramePng(
        window.beforeFrame,
        deterministicTinyRgbPng({ seed: 20, uniform: true })
      );
      replaceCompositorFramePng(
        window.afterFrame,
        deterministicTinyRgbPng({ seed: 24, uniform: true })
      );
      refreshCompositorDelta(window, policy);
      assert.ok(window.compositorDelta.changedPixelCount >= 8);
      assert.equal(window.beforeFrame.png.hasVisibleSurfaceContent, false);
      assert.equal(window.afterFrame.png.hasVisibleSurfaceContent, false);
    }],
    ['identical compositor frames', (evidence) => {
      const window = evidence.scenarios[0].sample.windows[1];
      replaceCompositorFramePng(
        window.afterFrame,
        Buffer.from(window.beforeFrame.pngBase64, 'base64')
      );
      refreshCompositorDelta(window, policy);
      assert.equal(window.compositorDelta.changedPixelCount, 0);
      assert.equal(window.compositorDelta.visibleContentAdvanced, false);
    }],
    ['tampered PNG bytes', (evidence) => {
      const frame = evidence.scenarios[1].sample.windows[0].beforeFrame;
      const bytes = Buffer.from(frame.pngBase64, 'base64');
      bytes[24] ^= 0x01;
      frame.pngBase64 = bytes.toString('base64');
    }],
    ['tampered decoded PNG metrics', (evidence) => {
      const frame = evidence.scenarios[1].sample.windows[0].afterFrame;
      frame.png.sha256 = 'f'.repeat(64);
      frame.png.distinctColorCount += 1;
    }],
    ['missing screenshot audit row', (evidence) => {
      const audit = evidence.provenance.browser.cdpCommandAudit;
      audit.splice(audit.findIndex((row) => row.method === 'Page.captureScreenshot'), 1);
    }],
    ['screenshot audit hash mismatch', (evidence) => {
      evidence.provenance.browser.cdpCommandAudit.find(
        (row) => row.method === 'Page.captureScreenshot'
      ).paramsSha256 = 'f'.repeat(64);
    }]
  ];
  for (const [label, mutate] of cases) {
    const evidence = structuredClone(baseline);
    mutate(evidence);
    const evaluation = evaluate(evidence, policy, manifest);
    assert.equal(evaluation.passed, false, label);
  }
});

test('physical evaluator rejects broken CDP, crop, viewport, timestamp, URL, and target integrity', () => {
  const policy = createPhysicalPixelMobilePolicy({ baseUrl: BASE_URL });
  const manifest = sourceManifest(policy);
  const baseline = baseEvidence({ policy, manifest });
  const baselineFrame = baseline.scenarios[0].sample.windows[0].beforeFrame;
  assert.equal(
    baselineFrame.canvas.clip.width,
    baselineFrame.canvas.rect.width * 0.6
  );
  assert.equal(
    baselineFrame.canvas.clip.height,
    baselineFrame.canvas.rect.height * 0.6
  );
  assert.equal(
    baselineFrame.canvas.clip.x,
    baselineFrame.canvas.rect.x
      + (baselineFrame.canvas.rect.width - baselineFrame.canvas.clip.width) / 2
  );
  assert.equal(
    baselineFrame.canvas.clip.y,
    baselineFrame.canvas.rect.y
      + (baselineFrame.canvas.rect.height - baselineFrame.canvas.clip.height) / 2
  );
  assert.equal(baselineFrame.png.width, 12);
  assert.equal(baselineFrame.png.height, 12);
  assert.equal(
    baseline.provenance.browser.cdpCommandAudit.filter(
      (row) => row.method === 'Page.getLayoutMetrics'
    ).length,
    8
  );
  assert.equal(
    baseline.provenance.browser.cdpCommandAudit.filter(
      (row) => row.method === 'Page.captureScreenshot'
    ).length,
    8
  );

  const cases = [
    ['screenshot PNG response hash mismatch', (evidence) => {
      evidence.provenance.browser.cdpCommandAudit.find(
        (row) => row.method === 'Page.captureScreenshot'
      ).responsePngSha256 = 'f'.repeat(64);
    }],
    ['screenshot response envelope hash mismatch', (evidence) => {
      evidence.provenance.browser.cdpCommandAudit.find(
        (row) => row.method === 'Page.captureScreenshot'
      ).responseSha256 = 'e'.repeat(64);
    }],
    ['shifted before and after clip', (evidence) => {
      const frame = evidence.scenarios[0].sample.windows[0].afterFrame;
      frame.canvas.rect.x += 1;
      frame.canvas.clip.x += 1;
      frame.captureParams.clip.x += 1;
      const screenshotRows = evidence.provenance.browser.cdpCommandAudit.filter(
        (row) => row.method === 'Page.captureScreenshot'
      );
      screenshotRows[1].paramsSha256 = canonicalJsonSha256(frame.captureParams);
    }],
    ['stale snapshot document URL', (evidence) => {
      evidence.scenarios[0].sample.windows[0].before.documentUrl =
        new URL('/stale-receipt-document', BASE_URL).href;
    }],
    ['hidden snapshot document', (evidence) => {
      evidence.scenarios[0].sample.windows[0].before.documentVisibility = 'hidden';
      evidence.scenarios[0].sample.windows[0].before.documentHasFocus = false;
    }],
    ['wrong activation target', (evidence) => {
      const activation = evidence.provenance.browser.cdpCommandAudit.find(
        (row) => row.method === 'Target.activateTarget'
      );
      activation.targetId = 'preexisting-target';
      activation.paramsSha256 = canonicalJsonSha256({
        targetId: 'preexisting-target'
      });
    }],
    ['non-unit visual viewport scale', (evidence) => {
      evidence.scenarios[0].sample.windows[0].beforeFrame
        .canvas.visualViewportScale = 1.25;
    }],
    ['equal compositor timestamps', (evidence) => {
      const window = evidence.scenarios[0].sample.windows[0];
      window.afterFrame.capturedAt = window.beforeFrame.capturedAt;
    }],
    ['missing Page.enable', (evidence) => {
      const audit = evidence.provenance.browser.cdpCommandAudit;
      audit.splice(audit.findIndex((row) => row.method === 'Page.enable'), 1);
      audit.forEach((row, sequence) => {
        row.sequence = sequence;
      });
    }],
    ['leftover target added', (evidence) => {
      const lifecycle = evidence.provenance.browser.lifecycle;
      lifecycle.targetsAfter.push('unexpected-leftover-target');
      lifecycle.unexpectedTargetIdsAdded = ['unexpected-leftover-target'];
      lifecycle.unexpectedTargetsAdded = 1;
      evidence.provenance.browser.unexpectedTargetsAdded = 1;
    }],
    ['layout zoom mismatch', (evidence) => {
      const frame = evidence.scenarios[0].sample.windows[0].beforeFrame;
      frame.layoutMetrics.cdpResponse.cssVisualViewport.zoom = 1.25;
      const layoutRow = evidence.provenance.browser.cdpCommandAudit.find(
        (row) => row.method === 'Page.getLayoutMetrics'
      );
      layoutRow.responseSha256 = canonicalJsonSha256(
        frame.layoutMetrics.cdpResponse
      );
    }],
    ['layout response audit mismatch', (evidence) => {
      evidence.provenance.browser.cdpCommandAudit.find(
        (row) => row.method === 'Page.getLayoutMetrics'
      ).responseSha256 = 'd'.repeat(64);
    }]
  ];
  for (const [label, mutate] of cases) {
    const evidence = structuredClone(baseline);
    mutate(evidence);
    assert.equal(evaluate(evidence, policy, manifest).passed, false, label);
  }
});

test('physical compositor PNG proof rejects eight anomalous pixels on a full mobile frame', () => {
  const policy = createPhysicalPixelMobilePolicy({ baseUrl: BASE_URL });
  const width = 240;
  const height = 320;
  const background = [18, 28, 38];
  const reference = fixturePng({
    width,
    height,
    pixel: () => background
  });
  const candidate = fixturePng({
    width,
    height,
    pixel: ({ x, y }) => {
      if (x < 100 || x >= 104 || y < 100 || y >= 102) return background;
      const anomaly = (y - 100) * 4 + (x - 100);
      return [80 + anomaly * 7, 120 + anomaly * 5, 160 + anomaly * 3];
    }
  });
  const decoded = decodePhysicalPixelPng(candidate);
  assert.equal(decoded.status, 'ready');
  assert.equal(decoded.hasSurfaceLikeVariation, true);
  assert.equal(decoded.nonDominantPixelCountLowerBound, 8);
  assert.equal(decoded.nonDominantPixelRatioLowerBound, 8 / (width * height));
  assert.equal(decoded.hasVisibleSurfaceContent, false);

  const delta = comparePhysicalPixelPngFrames(reference, candidate, {
    minChannelDelta: policy.compositorEvidence.minChannelDelta,
    minChangedPixelCount: policy.compositorEvidence.minChangedPixelCount,
    minChangedPixelRatio: policy.compositorEvidence.minChangedPixelRatio,
    minChangedBoundsWidth: policy.compositorEvidence.minChangedBoundsWidth,
    minChangedBoundsHeight: policy.compositorEvidence.minChangedBoundsHeight
  });
  assert.equal(delta.status, 'ready');
  assert.equal(delta.changedPixelCount, 8);
  assert.equal(delta.changedPixelRatio, 8 / (width * height));
  assert.ok(delta.changedPixelRatio < policy.compositorEvidence.minChangedPixelRatio);
  assert.deepEqual(delta.changedBounds, { x: 100, y: 100, width: 4, height: 2 });
  assert.equal(delta.visibleContentAdvanced, false);
});

test('physical compositor PNG proof rejects alpha, tRNS, and APNG content', () => {
  const rgbaFrames = [0, 1].map((seed) => fixturePng({
    width: 8,
    height: 8,
    colorType: 6,
    pixel: ({ x, y }) => [
      32 + x * 12 + seed * 3,
      48 + y * 14 + seed * 4,
      64 + (x + y) * 8 + seed * 5,
      x === 0 && y === 0 ? 128 : 255
    ]
  }));
  for (const frame of rgbaFrames) {
    const decoded = decodePhysicalPixelPng(frame);
    assert.equal(decoded.status, 'ready');
    assert.equal(decoded.hasSurfaceLikeVariation, true);
    assert.equal(decoded.fullyOpaque, false);
    assert.equal(decoded.hasVisibleSurfaceContent, false);
  }
  assert.equal(
    comparePhysicalPixelPngFrames(rgbaFrames[0], rgbaFrames[1])
      .visibleContentAdvanced,
    false
  );

  const transparentRgb = fixturePng({
    width: 8,
    height: 8,
    pixel: ({ x, y }) => [32 + x * 8, 48 + y * 8, 64 + x + y],
    beforeImageDataChunks: [pngChunk('tRNS', Buffer.alloc(6))]
  });
  assert.deepEqual(decodePhysicalPixelPng(transparentRgb), {
    status: 'invalid',
    reason: 'png-transparency-chunk-unsupported'
  });

  const animationControl = Buffer.alloc(8);
  animationControl.writeUInt32BE(1, 0);
  const animatedPng = fixturePng({
    width: 8,
    height: 8,
    pixel: ({ x, y }) => [32 + x * 8, 48 + y * 8, 64 + x + y],
    beforeImageDataChunks: [pngChunk('acTL', animationControl)]
  });
  assert.deepEqual(decodePhysicalPixelPng(animatedPng), {
    status: 'invalid',
    reason: 'png-animation-chunk-unsupported'
  });
});

test('physical compositor PNG proof rejects CRC corruption and noncontiguous IDAT', () => {
  const corrupted = Buffer.from(deterministicTinyRgbPng({ seed: 0 }));
  corrupted[corrupted.length - 1] ^= 0x01;
  assert.deepEqual(decodePhysicalPixelPng(corrupted), {
    status: 'invalid',
    reason: 'png-crc-mismatch'
  });

  const noncontiguousImageData = fixturePng({
    width: 8,
    height: 8,
    pixel: ({ x, y }) => [32 + x * 8, 48 + y * 8, 64 + x + y],
    splitImageDataWithChunk: pngChunk(
      'tEXt',
      Buffer.from('receipt\0noncontiguous-idat', 'latin1')
    )
  });
  const decoded = decodePhysicalPixelPng(noncontiguousImageData);
  assert.equal(decoded.status, 'invalid');
  assert.match(decoded.reason, /ancillary|contiguous/u);
});

test('finalizer never authenticates an injected fingerprint or source manifest', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ulg-physical-pixel-'));
  try {
    const repoDir = path.join(root, 'repo');
    await mkdir(repoDir);
    const policy = createPhysicalPixelMobilePolicy({ baseUrl: BASE_URL });
    const manifest = sourceManifest(policy);
    const providerEvidence = baseEvidence({ policy, manifest });
    const artifacts = await writeRawArtifacts(root, providerEvidence, policy);
    providerEvidence.rawArtifacts = artifacts;
    await mkdir(path.join(root, 'receipts'), { mode: 0o700 });
    const evidencePath = path.join(root, 'receipts', 'physical-evidence.json');
    await writeJson(evidencePath, providerEvidence);

    const finalized = await runPhysicalPixelMobileLivenessReceipt({
      evidencePath,
      receiptPath: path.join(root, 'receipts', 'receipt.json'),
      repoDir,
      fingerprintProvider: async () => fingerprint(),
      sourceManifestProvider: async () => manifest
    });
    assert.equal(finalized.receipt.status, 'failed');
    assert.equal(finalized.evaluation.passed, false);
    assert.match(finalized.evaluation.failures.join('\n'), /cannot emit an authentic receipt/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('physical re-finalization adopts only an exact bound complete receipt and preserves altered existing bytes', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ulg-physical-refinalize-'));
  try {
    const repoDir = path.join(root, 'repo');
    await mkdir(repoDir);
    const policy = createPhysicalPixelMobilePolicy({ baseUrl: BASE_URL });
    const manifest = sourceManifest(policy);
    const evidence = baseEvidence({ policy, manifest });
    await writeServedSourceResourceArtifacts(root, evidence);
    evidence.rawArtifacts = await writeRawArtifacts(root, evidence, policy);
    const receiptDir = path.join(root, 'receipts');
    await mkdir(receiptDir, { mode: 0o700 });
    await chmod(receiptDir, 0o700);
    const evidencePath = path.join(receiptDir, 'physical-evidence.json');
    await writeJson(evidencePath, evidence);
    const evidenceBytes = await readFile(evidencePath);
    const evidenceArtifact = {
      path: evidencePath,
      byteLength: evidenceBytes.byteLength,
      sha256: sha256Bytes(evidenceBytes)
    };
    const boundReceipt = {
      schema: PHYSICAL_PIXEL_RECEIPT_SCHEMA,
      policyTrack: policy.policyTrack,
      status: 'complete',
      evidenceArtifact,
      evidenceDigest: canonicalJsonSha256(evidence),
      sourceFingerprint: fingerprint(),
      sourceManifestSha256: manifest.manifestSha256,
      commandPolicySha256: policy.commandPolicySha256
    };
    const receiptPath = path.join(receiptDir, 'receipt.json');
    await writeJson(receiptPath, boundReceipt);
    await chmod(receiptPath, 0o600);
    const reFinalized = await runPhysicalPixelMobileLivenessReceipt({
      evidencePath,
      receiptPath,
      repoDir,
      fingerprintProvider: async () => fingerprint(),
      sourceManifestProvider: async () => manifest
    });
    assert.equal(reFinalized.receipt.status, 'failed');
    assert.match(reFinalized.receipt.reason, /cannot emit an authentic receipt/);
    assert.equal(JSON.parse(await readFile(receiptPath, 'utf8')).status, 'failed');

    const alteredReceipts = [
      ['source fingerprint', (receipt) => {
        receipt.sourceFingerprint = fingerprint({ sourceFingerprint: 'd'.repeat(64) });
      }],
      ['policy track', (receipt) => {
        receipt.policyTrack = 'attacker-policy-track';
      }]
    ];
    for (const [label, alter] of alteredReceipts) {
      const altered = structuredClone(boundReceipt);
      alter(altered);
      const exactBytes = `${JSON.stringify(altered, null, 2)}\n`;
      await writeFile(receiptPath, exactBytes, { mode: 0o600 });
      await chmod(receiptPath, 0o600);
      await assert.rejects(
        runPhysicalPixelMobileLivenessReceipt({
          evidencePath,
          receiptPath,
          repoDir,
          fingerprintProvider: async () => fingerprint(),
          sourceManifestProvider: async () => manifest
        }),
        /not a bound complete physical receipt/,
        label
      );
      assert.equal(await readFile(receiptPath, 'utf8'), exactBytes, label);
    }

    const driftedManifest = structuredClone(manifest);
    driftedManifest.modules[0].sha256 = 'e'.repeat(64);
    driftedManifest.manifestSha256 = canonicalJsonSha256({
      schema: driftedManifest.schema,
      scope: driftedManifest.scope,
      modules: driftedManifest.modules,
      unresolvedBareSpecifiers: driftedManifest.unresolvedBareSpecifiers
    });
    const staleCurrentBindings = [
      [
        'current source fingerprint drift',
        fingerprint({ sourceFingerprint: 'c'.repeat(64) }),
        manifest
      ],
      ['current source manifest drift', fingerprint(), driftedManifest]
    ];
    for (const [label, currentFingerprint, currentManifest] of staleCurrentBindings) {
      const exactBytes = `${JSON.stringify(boundReceipt, null, 2)}\n`;
      await writeFile(receiptPath, exactBytes, { mode: 0o600 });
      await chmod(receiptPath, 0o600);
      await assert.rejects(
        runPhysicalPixelMobileLivenessReceipt({
          evidencePath,
          receiptPath,
          repoDir,
          fingerprintProvider: async () => currentFingerprint,
          sourceManifestProvider: async () => currentManifest
        }),
        /existing receipt is stale or no longer bound to current source/,
        label
      );
      assert.equal(await readFile(receiptPath, 'utf8'), exactBytes, label);
    }

    const evidenceDrift = structuredClone(evidence);
    evidenceDrift.captureErrors = ['evidence bytes changed after the prior receipt'];
    const exactBytes = `${JSON.stringify(boundReceipt, null, 2)}\n`;
    await writeFile(receiptPath, exactBytes, { mode: 0o600 });
    await chmod(receiptPath, 0o600);
    await writeFile(evidencePath, `${JSON.stringify(evidenceDrift, null, 2)}\n`);
    await assert.rejects(
      runPhysicalPixelMobileLivenessReceipt({
        evidencePath,
        receiptPath,
        repoDir,
        fingerprintProvider: async () => fingerprint(),
        sourceManifestProvider: async () => manifest
      }),
      /not a bound complete physical receipt/
    );
    assert.equal(await readFile(receiptPath, 'utf8'), exactBytes);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('artifact reader rejects a swapped raw-artifact path before evaluation', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ulg-physical-pixel-no-swap-'));
  try {
    const repoDir = path.join(root, 'repo');
    await mkdir(repoDir);
    const policy = createPhysicalPixelMobilePolicy({ baseUrl: BASE_URL });
    const manifest = sourceManifest(policy);
    const evidence = baseEvidence({ policy, manifest });
    evidence.rawArtifacts = await writeRawArtifacts(root, evidence, policy);
    evidence.rawArtifacts[1].path = evidence.rawArtifacts[0].path;
    const evidencePath = path.join(root, 'receipts', 'physical-evidence.json');
    await writeJson(evidencePath, evidence);
    await assert.rejects(
      readPhysicalPixelMobileLivenessArtifactEvidence({
        receipt: { evidenceArtifact: { path: evidencePath } },
        repoDir
      }),
      /pairwise distinct/
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('physical capture refuses implicit provider injection and leaves a fail sentinel', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ulg-physical-fail-'));
  try {
    const repoDir = path.join(root, 'repo');
    await mkdir(repoDir);
    const outputPath = path.join(root, 'receipts', 'physical-evidence.json');
    const result = await capturePhysicalPixelMobileEvidence({
      outputPath,
      baseUrl: BASE_URL,
      artifactDir: path.join(root, 'raw'),
      repoDir,
      captureProvider: async () => ({}),
      fingerprintProvider: async () => fingerprint(),
      sourceManifestProvider: async () => ({})
    });
    assert.equal(result.evidence.status, 'failed');
    assert.match(result.evidence.reason, /cannot emit authentic evidence/);
    const stored = JSON.parse(await readFile(outputPath, 'utf8'));
    assert.equal(stored.status, 'failed');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('physical finalizer refuses injected fingerprint and source-manifest providers by default', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ulg-physical-finalizer-injection-'));
  try {
    const repoDir = path.join(root, 'repo');
    await mkdir(repoDir);
    const policy = createPhysicalPixelMobilePolicy({ baseUrl: BASE_URL });
    const manifest = sourceManifest(policy);
    const evidence = baseEvidence({ policy, manifest });
    evidence.rawArtifacts = await writeRawArtifacts(root, evidence, policy);
    await mkdir(path.join(root, 'receipts'), { mode: 0o700 });
    const evidencePath = path.join(root, 'receipts', 'physical-evidence.json');
    const receiptPath = path.join(root, 'receipts', 'receipt.json');
    await writeJson(evidencePath, evidence);
    const result = await runPhysicalPixelMobileLivenessReceipt({
      evidencePath,
      receiptPath,
      repoDir,
      fingerprintProvider: async () => fingerprint(),
      sourceManifestProvider: async () => manifest
    });
    assert.equal(result.receipt.status, 'failed');
    assert.match(result.evaluation.failures.join('\n'), /cannot emit an authentic receipt/);
    assert.equal(JSON.parse(await readFile(receiptPath, 'utf8')).status, 'failed');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
