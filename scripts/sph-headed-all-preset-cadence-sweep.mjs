import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { chromium } from '@playwright/test';

import {
  SPH_PHASE_SCENARIO_PRESETS,
  sphPhaseScenarioPresetUrl
} from '../src/runtime/sphPhaseScenarioPresets.js';
import {
  classifyCadenceAcceptanceIssues,
  evaluateCadenceSample,
  resolveHeadedSweepAutomatedDisposition,
  summarizeVisiblePresentationCadence
} from './sph-headed-cadence-metrics.mjs';

export { evaluateCadenceSample } from './sph-headed-cadence-metrics.mjs';

const outputDir = process.env.ULG_HEADED_SWEEP_OUTPUT
  || '/tmp/ulg-headed-all-preset-cadence-sweep';
const baseUrl = process.env.ULG_HEADED_SWEEP_BASE_URL
  || 'https://127.0.0.1:5173';
const timeoutMs = Number(process.env.ULG_HEADED_SWEEP_TIMEOUT_MS) || 900_000;
const cadenceWarmupMs = Number(process.env.ULG_HEADED_SWEEP_WARMUP_MS) || 2_500;
const cadenceSampleMs = Number(process.env.ULG_HEADED_SWEEP_SAMPLE_MS) || 5_000;
const nominalRenderHz = 60;
// Interactive acceptance allows ten percent scheduling/compositor variance
// around the nominal 60 Hz presentation target.
const requestedMinimumRenderHz = Number(
  process.env.ULG_HEADED_SWEEP_MIN_RENDER_HZ
);
const minimumRenderHz = Math.max(
  nominalRenderHz * 0.9,
  Number.isFinite(requestedMinimumRenderHz)
    ? requestedMinimumRenderHz
    : nominalRenderHz * 0.9
);
// Only the two high-particle-count water fixtures are presentation-cadence
// acceptance targets. Every canned preset still runs through the headed
// rendering/progression checks below, but the true-isosurface fixtures are not
// held to the particle-impostor throughput goal.
const particlePresentationPresetIds = new Set(['bulk-water', 'water-realtime']);
const scenarioSelection = String(
  process.env.ULG_HEADED_SWEEP_SCENARIOS || ''
).split(',').map((value) => value.trim()).filter(Boolean);
const selectedPresetIds = scenarioSelection.length > 0
  ? new Set(scenarioSelection)
  : null;
const scenarioPresets = SPH_PHASE_SCENARIO_PRESETS.filter((preset) => (
  selectedPresetIds == null || selectedPresetIds.has(preset.id)
));
const completeCannedMatrix = Boolean(
  scenarioPresets.length === SPH_PHASE_SCENARIO_PRESETS.length
  && SPH_PHASE_SCENARIO_PRESETS.every((preset) => (
    scenarioPresets.some((candidate) => candidate.id === preset.id)
  ))
);
if (
  selectedPresetIds != null
  && scenarioPresets.length !== selectedPresetIds.size
) {
  const known = new Set(SPH_PHASE_SCENARIO_PRESETS.map((preset) => preset.id));
  const missing = [...selectedPresetIds].filter((id) => !known.has(id));
  throw new Error(`unknown headed sweep preset(s): ${missing.join(', ')}`);
}
const reactionActivationPolicyOverride = String(
  process.env.ULG_HEADED_SWEEP_REACTION_ACTIVATION_POLICY || ''
).trim() || null;
const extraScenarioQuery = String(
  process.env.ULG_HEADED_SWEEP_EXTRA_QUERY || ''
).trim();
const extraScenarioParams = Object.freeze(Object.fromEntries(
  new URLSearchParams(extraScenarioQuery)
));
const diagnosticOverridesActive = Boolean(
  reactionActivationPolicyOverride != null || extraScenarioQuery.length > 0
);
const profileGpuResources =
  process.env.ULG_HEADED_SWEEP_PROFILE_GPU_RESOURCES === '1';
if (
  reactionActivationPolicyOverride != null
  && !['disabled', 'shadow', 'authoritative'].includes(
    reactionActivationPolicyOverride
  )
) {
  throw new Error(
    'ULG_HEADED_SWEEP_REACTION_ACTIVATION_POLICY must be disabled, shadow, or authoritative'
  );
}

if (!Number.isFinite(minimumRenderHz) || minimumRenderHz <= 0) {
  throw new RangeError('ULG_HEADED_SWEEP_MIN_RENDER_HZ must be positive');
}
if (!Number.isSafeInteger(cadenceWarmupMs) || cadenceWarmupMs < 1_000) {
  throw new RangeError('ULG_HEADED_SWEEP_WARMUP_MS must be an integer >= 1000');
}
if (!Number.isSafeInteger(cadenceSampleMs) || cadenceSampleMs < 5_000) {
  throw new RangeError('ULG_HEADED_SWEEP_SAMPLE_MS must be an integer >= 5000');
}

await mkdir(outputDir, { recursive: true });

function finiteOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function percentile(values, fraction) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * fraction) - 1)
  );
  return sorted[index];
}

function criticalConsoleText(text) {
  return /(?:ulg-gpu-(?:uncaptured-error|device-lost)|GPUValidationError|validation error|invalid WGSL|shader.*(?:error|invalid)|pipeline.*invalid|device lost|out of memory)/i.test(text);
}

async function screenshotDigest(filePath, label) {
  const bytes = await readFile(filePath);
  return Object.freeze({
    label,
    path: filePath,
    byteLength: bytes.byteLength,
    sha256: createHash('sha256').update(bytes).digest('hex')
  });
}

async function installGpuFaultCapture(page) {
  await page.addInitScript(({ profileGpuResources: shouldProfileGpuResources }) => {
    const seenDevices = new WeakSet();
    globalThis.__ulgGpuResourceCreationEvents ||= [];
    globalThis.__ulgSphCadenceTimelineEvents ||= [];
    const recordResourceEvent = (event) => {
      const events = globalThis.__ulgGpuResourceCreationEvents;
      if (!Array.isArray(events) || events.length >= 20_000) return;
      events.push(event);
    };
    const attachDevice = (device) => {
      if (!device || seenDevices.has(device)) return device;
      seenDevices.add(device);
      device.addEventListener?.('uncapturederror', (event) => {
        const error = event?.error;
        console.error(
          `[ulg-gpu-uncaptured-error:${error?.name || error?.constructor?.name || 'GPUError'}] ${error?.message || String(error)}`
        );
      });
      Promise.resolve(device.lost).then((info) => {
        console.error(
          `[ulg-gpu-device-lost] reason=${info?.reason || 'unknown'} message=${info?.message || 'unknown'}`
        );
      });
      const wrapCreationMethod = (name, kind, { asynchronous = false } = {}) => {
        const original = device?.[name];
        if (typeof original !== 'function') return;
        const wrappedMethod = function (...args) {
          const descriptor = args[0] || {};
          const startedAtMs = performance.now();
          let result;
          try {
            result = Reflect.apply(original, this, args);
          } catch (error) {
            recordResourceEvent({
              kind,
              method: name,
              label: descriptor?.label ?? null,
              size: Number(descriptor?.size) || null,
              startedAtMs,
              endedAtMs: performance.now(),
              status: 'threw'
            });
            throw error;
          }
          if (asynchronous && result?.then) {
            return Promise.resolve(result).then(
              (value) => {
                recordResourceEvent({
                  kind,
                  method: name,
                  label: descriptor?.label ?? null,
                  size: Number(descriptor?.size) || null,
                  startedAtMs,
                  endedAtMs: performance.now(),
                  status: 'fulfilled'
                });
                return value;
              },
              (error) => {
                recordResourceEvent({
                  kind,
                  method: name,
                  label: descriptor?.label ?? null,
                  size: Number(descriptor?.size) || null,
                  startedAtMs,
                  endedAtMs: performance.now(),
                  status: 'rejected'
                });
                throw error;
              }
            );
          }
          recordResourceEvent({
            kind,
            method: name,
            label: descriptor?.label ?? null,
            size: Number(descriptor?.size) || null,
            startedAtMs,
            endedAtMs: performance.now(),
            status: 'returned'
          });
          return result;
        };
        try {
          Object.defineProperty(device, name, {
            configurable: true,
            writable: true,
            value: wrappedMethod
          });
        } catch {
          try { device[name] = wrappedMethod; } catch {}
        }
      };
      if (shouldProfileGpuResources) {
        wrapCreationMethod(
          'createComputePipelineAsync',
          'compute-pipeline',
          { asynchronous: true }
        );
        wrapCreationMethod('createComputePipeline', 'compute-pipeline');
        wrapCreationMethod('createShaderModule', 'shader-module');
        wrapCreationMethod('createBuffer', 'buffer');
        wrapCreationMethod('createBindGroup', 'bind-group');
      }
      return device;
    };
    const adapterPrototype = globalThis.GPUAdapter?.prototype;
    const requestDevice = adapterPrototype?.requestDevice;
    if (typeof requestDevice !== 'function') return;
    const wrapped = async function (...args) {
      return attachDevice(await requestDevice.apply(this, args));
    };
    try {
      Object.defineProperty(adapterPrototype, 'requestDevice', {
        configurable: true,
        writable: true,
        value: wrapped
      });
    } catch {
      adapterPrototype.requestDevice = wrapped;
    }
  }, { profileGpuResources });
}

async function ensureOverlay(page) {
  if (await page.locator('#sph-phase-overlay').count() === 0) {
    await page.waitForSelector('#run-sph-phase', { timeout: 30_000 });
    await page.evaluate(() => document.querySelector('#run-sph-phase')?.click());
  }
  await page.waitForSelector('#sph-phase-overlay', { timeout: timeoutMs });
  await page.waitForFunction(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const scene = overlay?.__sphScene;
    return Boolean(scene?.getSphGpuParticleState?.()?.schema || overlay?.__sphDriver);
  }, null, { timeout: timeoutMs, polling: 250 });
}

async function readState(page) {
  return page.evaluate(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const scene = overlay?.__sphScene || null;
    const renderModeSelection = overlay?.__sphRenderModeSelection || null;
    const locationUrl = new URL(location.href);
    const hashLocationParams = locationUrl.hash.length > 1
      ? new URLSearchParams(locationUrl.hash.slice(1))
      : new URLSearchParams();
    const presentation = scene?.getWorkerOffscreenPresentation?.()
      || overlay?.__sphWorkerOffscreenPresentation
      || null;
    const renderState = scene?.getSphResidentRenderState?.()
      || overlay?.__sphResidentRenderState
      || null;
    const latestRows = presentation?.workerOffscreenRenderRows
      || renderState?.workerOffscreenRenderRows
      || null;
    const renderedContent = presentation?.displayOwnerLastRenderedContent || null;
    const rows = presentation?.displayOwner === 'worker'
      ? (renderedContent || latestRows)
      : latestRows;
    const steps = scene?.getMlsMpmResidentSteps?.()
      || overlay?.__mlsMpmResidentSteps
      || null;
    const workerLane = steps?.workerOwnedResidentLane || null;
    const residentStep = scene?.getMlsMpmResidentStep?.()
      || overlay?.__mlsMpmResidentStep
      || steps?.finalStep
      || null;
    const sphState = scene?.getSphGpuParticleState?.()
      || overlay?.__sphPhaseViewState?.sphGpuParticleState
      || null;
    const workerCanvas = document.querySelector(
      'canvas[data-ulg-worker-offscreen-presentation="true"]'
    );
    const workerStyle = workerCanvas ? getComputedStyle(workerCanvas) : null;
    const workerRect = workerCanvas?.getBoundingClientRect?.() || null;
    const workerCanvasVisible = Boolean(
      workerCanvas
      && workerStyle?.visibility !== 'hidden'
      && workerStyle?.display !== 'none'
      && Number(workerStyle?.opacity ?? 1) > 0
      && Number(workerRect?.width) > 0
      && Number(workerRect?.height) > 0
    );
    const renderBridge = scene?.getSphResidentSurfaceDrawRenderBridge?.() || null;
    const nativeConsumer = scene?.scene?.userData?.sphNativeWebGpuSurfaceConsumer
      || renderBridge?.nativeConsumer
      || null;
    const nativeCanvas = nativeConsumer?.canvas || renderBridge?.canvas || null;
    const nativeStyle = nativeCanvas ? getComputedStyle(nativeCanvas) : null;
    const nativeRect = nativeCanvas?.getBoundingClientRect?.() || null;
    const nativeCanvasVisible = Boolean(
      nativeCanvas
      && nativeCanvas.isConnected
      && nativeStyle?.visibility !== 'hidden'
      && nativeStyle?.display !== 'none'
      && Number(nativeStyle?.opacity ?? 1) > 0
      && Number(nativeRect?.width) > 0
      && Number(nativeRect?.height) > 0
    );
    const pendingPresentation = overlay?.__sphPendingPresentation || null;
    const pendingPresentationLayer = overlay?.querySelector('#sph-pending-presentation')
      || null;
    const pendingPresentationLayerStyle = pendingPresentationLayer
      ? getComputedStyle(pendingPresentationLayer)
      : null;
    const presentationProof = overlay?.__sphResidentPresentationProof || null;
    const counters = overlay?.__sphFrameCounters || {};
    const residentPerf = overlay?.__sphResidentPerf || {};
    const residentError = overlay?.__mlsMpmResidentStepsError || null;
    const renderError = overlay?.__sphResidentRenderStateError
      || overlay?.__sphResidentSurfaceDrawError
      || null;
    const surfaceDraw = scene?.getSphResidentSurfaceDraw?.()
      || overlay?.__sphResidentSurfaceDraw
      || null;
    const nativePresentation = overlay?.__sphWorkerLaneNativeSurfacePresentation
      || null;
    const renderSource = renderState?.residentRenderSource || null;
    const committedPresentation = workerLane?.committedPresentation || null;
    const finalEpochIdentity = workerLane?.finalEpochIdentity || null;
    const canvasRows = [...document.querySelectorAll('#sph-scene canvas')].map((canvas) => {
      const style = getComputedStyle(canvas);
      const rect = canvas.getBoundingClientRect();
      return {
        workerOwned: canvas.dataset?.ulgWorkerOffscreenPresentation === 'true',
        width: canvas.width,
        height: canvas.height,
        cssWidth: rect.width,
        cssHeight: rect.height,
        visibility: style.visibility,
        display: style.display,
        opacity: style.opacity
      };
    });
    const sceneTimeS = Number(
      residentStep?.particlePingPong?.nextTime
      ?? steps?.nextSphParticleState?.time
      ?? sphState?.time
      ?? overlay?.__sphPhaseViewState?.time
      ?? overlay?.__sphDriver?.demo?.state?.time
    );
    const sphStep = Number(
      rows?.sphStep
      ?? workerLane?.laneCompletedStepTotal
      ?? steps?.nextSphParticleState?.step
      ?? residentStep?.particlePingPong?.nextStep
      ?? sphState?.step
    );
    const physicsStep = Number(
      workerLane?.laneCompletedStepTotal
      ?? steps?.workerLaneSimTime?.laneCompletedStepTotal
      ?? steps?.nextSphParticleState?.step
      ?? residentStep?.particlePingPong?.nextStep
      ?? sphState?.step
    );
    const nativePresentationStep = Number(
      nativePresentation?.sourceStep
      ?? renderBridge?.sourceResidentNextStep
      ?? surfaceDraw?.renderBridgeSourceResidentNextStep
    );
    const workerPresentationStep = Number(renderedContent?.sphStep);
    const displayOwner = presentation?.displayOwner ?? null;
    const visiblePresentationStep = displayOwner === 'worker'
      ? workerPresentationStep
      : nativePresentationStep;
    const commonAuthorityReady = Boolean(
      workerLane?.schema
        === 'peercompute.ulg.sph-scene-worker-owned-resident-lane-execution.v0'
      && workerLane?.residentScheduleStatus === 'worker-resident-schedule-completed'
      && workerLane?.terminalStatus
        === 'worker-offscreen-resident-schedule-on-presentation-device-completed'
      && typeof workerLane?.scheduleId === 'string'
      && workerLane.scheduleId.length > 0
      && typeof workerLane?.laneId === 'string'
      && workerLane.laneId.length > 0
      && typeof workerLane?.stateKey === 'string'
      && workerLane.stateKey.length > 0
      && workerLane?.gpuFence?.terminalScheduleFence === true
      && workerLane?.gpuFence?.fenceSatisfied === true
      && workerLane?.gpuFence?.authorityAdmissionReady === true
      && workerLane?.authority?.status
        === 'state-manager-committed-worker-schedule'
      && workerLane?.authority?.computeManagerLeaseStatus === 'completed'
      && workerLane?.authority?.computeManagerFenceSatisfied === true
      && workerLane?.authority?.stateManagerCommitStatus === 'committed'
      && committedPresentation?.stateManagerCommittedPresentation === true
      && committedPresentation?.scheduleId === workerLane.scheduleId
      && committedPresentation?.laneId === workerLane.laneId
      && committedPresentation?.stateKey === workerLane.stateKey
      && committedPresentation?.terminalScheduleFence === true
      && committedPresentation?.terminalFenceSatisfied === true
      && committedPresentation?.terminalFenceAuthorityAdmissionReady === true
      && Number.isSafeInteger(Number(workerLane?.laneCompletedStepTotal))
      && Number(workerLane.laneCompletedStepTotal) > 0
      && Number.isFinite(Number(workerLane?.laneSimTimeS))
      && Number.isSafeInteger(Number(finalEpochIdentity?.physicsTick))
      && Number.isSafeInteger(Number(committedPresentation?.sphStep))
    );
    const canonicalEndpointReady = Boolean(
      commonAuthorityReady
      && displayOwner === 'main-native'
      && presentation?.displayOwnerContentReady === true
      && presentation?.displayCanvasVisible === false
      && workerCanvasVisible === false
      && nativeCanvasVisible === true
      && presentationProof?.bridge === 'native-webgpu-surface-consumer'
      && presentationProof?.admitted === true
      && presentationProof?.sourceCurrent === true
      && nativePresentation?.schema
        === 'peercompute.ulg.worker-lane-native-surface-presentation-source.v0'
      && nativePresentation?.status
        === 'worker-lane-native-surface-presentation-source-ready'
      && nativePresentation?.scheduleId === workerLane.scheduleId
      && nativePresentation?.laneId === workerLane.laneId
      && nativePresentation?.stateKey === workerLane.stateKey
      && Number(nativePresentation?.sourceStep)
        === Number(committedPresentation?.sphStep) + 1
      && Math.abs(
        Number(nativePresentation?.sourceTimeS)
          - Number(workerLane?.laneSimTimeS)
      ) <= 1e-9
      && renderState?.sourceResidentRenderSourceStatus
        === 'resident-render-source-current'
      && Number(
        renderState?.sourceResidentNextStep
          ?? renderSource?.nextStep
      ) === Number(nativePresentation.sourceStep)
      && Number(
        renderBridge?.sourceResidentNextStep
          ?? surfaceDraw?.renderBridgeSourceResidentNextStep
      ) === Number(nativePresentation.sourceStep)
      && renderBridge?.rendererBridge === 'native-webgpu-surface-consumer'
      && Number.isSafeInteger(Number(renderBridge?.frameCount))
      && Number(renderBridge.frameCount) > 0
      && rows?.presentationGeometry === 'sphere-impostor-depth-fallback'
      && rows?.depthAttachmentReady === true
      && Number(rows?.boxWireframeDrawCount) === 1
    );
    const workerParticleEndpointReady = Boolean(
      renderedContent?.schema
        === 'peercompute.ulg.worker-offscreen-resident-particle-state-producer.v0'
      && renderedContent?.status
        === 'worker-offscreen-resident-particle-state-producer-rendered'
      && renderedContent?.presentationFrameSchema
        === 'peercompute.ulg.worker-offscreen-particle-keyframe-presentation-frame.v0'
      && renderedContent?.presentationFrameStatus
        === 'worker-particle-keyframe-presentation-opportunity'
      && renderedContent?.presentationFrameAdmitted === true
      && renderedContent?.presentationFrameGpuCompleted === true
      && renderedContent?.presentationFramePresentationOpportunity === true
      && renderedContent?.presentationFramePresentationOpportunityMethod
        === 'worker-request-animation-frame-after-gpu-completion'
      && renderedContent?.presentationGeometry
        === 'sphere-impostor-depth-fallback'
      && renderedContent?.depthAttachmentReady === true
      && Number(renderedContent?.boxWireframeDrawCount) === 1
    );
    const workerIsosurfaceEndpointReady = Boolean(
      renderedContent?.schema
        === 'peercompute.ulg.worker-offscreen-resident-isosurface-presentation.v0'
      && renderedContent?.status
        === 'worker-offscreen-resident-isosurface-presentation-rendered'
      && renderedContent?.presentationFrameSchema
        === 'peercompute.ulg.worker-offscreen-resident-isosurface-presentation-frame.v0'
      && renderedContent?.presentationFrameStatus
        === 'worker-owned-isosurface-presentation-opportunity'
      && renderedContent?.presentationFrameAdmitted === true
      && renderedContent?.presentationFrameGpuCompleted === true
      && renderedContent?.presentationFrameGpuCompletionMethod
        === 'worker-device.queue.onSubmittedWorkDone'
      && renderedContent?.presentationFramePresentationOpportunity === true
      && renderedContent?.presentationFramePresentationOpportunityMethod
        === 'worker-request-animation-frame-after-gpu-completion'
      && renderedContent?.presentationGeometry
        === 'worker-owned-true-isosurface'
      && renderedContent?.depthAttachmentReady === true
      && Number(renderedContent?.boxWireframeDrawCount) === 1
      && Number(renderedContent?.surfaceCount) > 0
      && Number(renderedContent?.indirectDrawCount) > 0
    );
    const tier0EndpointReady = Boolean(
      commonAuthorityReady
      && displayOwner === 'worker'
      && presentation?.displayOwnerContentReady === true
      && presentation?.displayCanvasVisible === true
      && workerCanvasVisible === true
      && Number(presentation?.displayOwnerContentFrameSerial) > 0
      && Number(presentation?.displayOwnerPresentedSphStep)
        === Number(renderedContent?.sphStep)
      && (workerParticleEndpointReady || workerIsosurfaceEndpointReady)
      && renderedContent?.residentScheduleCandidatePresentation === true
      && renderedContent?.stateManagerCommittedPresentation === true
      && renderedContent?.scheduleId === workerLane.scheduleId
      && renderedContent?.laneId === workerLane.laneId
      && renderedContent?.stateKey === workerLane.stateKey
      && renderedContent?.terminalScheduleFence === true
      && renderedContent?.terminalFenceSatisfied === true
      && renderedContent?.terminalFenceAuthorityAdmissionReady === true
      && renderedContent?.stateManagerCommitStatus === 'committed'
      && renderedContent?.stateManagerCommitAccepted === true
      && Number(renderedContent?.sphStep)
        === Number(committedPresentation?.sphStep)
      && Number(renderedContent?.sphStep)
        === Number(finalEpochIdentity?.physicsTick)
      && Number(presentation?.frameCount) >= Number(renderedContent?.frameCount)
      && Number(renderedContent?.frameCount) > 0
    );
    return {
      capturedAtMs: performance.now(),
      documentVisibility: document.visibilityState,
      documentHasFocus: document.hasFocus(),
      spatialChurnProfileQuery:
        locationUrl.searchParams.get('spatialChurnProfile')
        ?? hashLocationParams.get('spatialChurnProfile'),
      surfaceDrawModeSelectedByUrl:
        renderModeSelection?.selectedByUrl === true,
      surfaceDrawModeRequestStatus:
        renderModeSelection?.requestProvenance?.status ?? null,
      statusText: document.querySelector('#sph-status')?.textContent?.slice(0, 500) || null,
      warningText: document.querySelector('#sph-warning-bar')?.textContent?.slice(0, 500) || null,
      playText: document.querySelector('#sph-play')?.textContent?.trim() || null,
      residentPending: Boolean(overlay?.__mlsMpmResidentStepsPending),
      residentStepsStatus: steps?.status ?? null,
      completedStepCount: Number(steps?.completedStepCount) || 0,
      requestedStepCount: Number(steps?.requestedStepCount) || null,
      sceneTimeS: Number.isFinite(sceneTimeS) ? sceneTimeS : null,
      sphStep: Number.isFinite(sphStep) ? sphStep : null,
      physicsStep: Number.isFinite(physicsStep) ? physicsStep : null,
      visiblePresentationStep:
        Number.isFinite(visiblePresentationStep) ? visiblePresentationStep : null,
      residentSubmissionCount: Number.isSafeInteger(residentPerf?.residentSubmissions)
        ? residentPerf.residentSubmissions
        : null,
      lastResidentCompletionAtMs: Number.isFinite(counters?.lastResidentCompletionAtMs)
        ? counters.lastResidentCompletionAtMs
        : null,
      renderFps: Number.isFinite(counters?.renderFps) ? counters.renderFps : null,
      renderFieldSurfaceCount:
        Number(renderState?.renderFieldSurfaceCount) || null,
      renderFieldTotalCells:
        Number(renderState?.renderFieldTotalCells) || null,
      nativeSurfaceTableBudgetStatus:
        renderState?.surfaceDrawNativeMarchingCubesSurfaceTableBudgetStatus
          ?? null,
      nativeSurfaceTableMaxResolution:
        Number(
          renderState
            ?.surfaceDrawNativeMarchingCubesSurfaceTableMaxResolution
        ) || null,
      renderRefreshTotalMs:
        Number(renderState?.renderRefreshTotalMs) || null,
      renderRefreshRenderFieldMs:
        Number(renderState?.renderRefreshRenderFieldMs) || null,
      renderRefreshSurfaceDrawMs:
        Number(renderState?.renderRefreshSurfaceDrawMs) || null,
      pendingPresentation: pendingPresentation == null ? null : {
        schema: pendingPresentation.schema ?? null,
        status: pendingPresentation.status ?? null,
        active: pendingPresentation.active === true,
        particleGeneration: pendingPresentation.particleGeneration ?? null
      },
      pendingPresentationLayerHidden: Boolean(
        pendingPresentationLayer?.hidden === true
        || pendingPresentationLayerStyle?.display === 'none'
        || pendingPresentationLayerStyle?.visibility === 'hidden'
      ),
      pendingPresentationLayerAriaBusy:
        pendingPresentationLayer?.getAttribute('aria-busy') ?? null,
      pendingPresentationLayerDataStatus:
        pendingPresentationLayer?.dataset?.status ?? null,
      presentationProof: presentationProof == null ? null : {
        status: presentationProof.status ?? null,
        bridge: presentationProof.bridge ?? null,
        admitted: presentationProof.admitted === true,
        sourceCurrent: presentationProof.sourceCurrent === true,
        foregroundProved: presentationProof.foregroundProved === true,
        visible: presentationProof.visible === true
      },
      residentError: residentError == null
        ? null
        : String(residentError?.message || residentError).slice(0, 1_000),
      renderError: renderError == null
        ? null
        : String(renderError?.message || renderError).slice(0, 1_000),
      workerPresentationStatus: presentation?.status ?? null,
      commonAuthorityReady,
      canonicalEndpointReady,
      tier0EndpointReady,
      lineage: workerLane == null ? null : {
        scheduleId: workerLane.scheduleId ?? null,
        laneId: workerLane.laneId ?? null,
        stateKey: workerLane.stateKey ?? null,
        laneCompletedStepTotal:
          Number.isFinite(Number(workerLane.laneCompletedStepTotal))
            ? Number(workerLane.laneCompletedStepTotal)
            : null,
        laneSimTimeS: Number.isFinite(Number(workerLane.laneSimTimeS))
          ? Number(workerLane.laneSimTimeS)
          : null,
        finalPhysicsTick: Number.isFinite(Number(finalEpochIdentity?.physicsTick))
          ? Number(finalEpochIdentity.physicsTick)
          : null,
        committedPresentationStep:
          Number.isFinite(Number(committedPresentation?.sphStep))
            ? Number(committedPresentation.sphStep)
            : null
      },
      displayOwner,
      displayOwnerContentReady: presentation?.displayOwnerContentReady ?? null,
      displayOwnerContentFrameSerial:
        Number.isFinite(Number(presentation?.displayOwnerContentFrameSerial))
          ? Number(presentation.displayOwnerContentFrameSerial)
          : null,
      displayOwnerPresentedSphStep:
        Number.isFinite(Number(presentation?.displayOwnerPresentedSphStep))
          ? Number(presentation.displayOwnerPresentedSphStep)
          : null,
      renderedContentFrameCount:
        Number.isFinite(Number(renderedContent?.frameCount))
          ? Number(renderedContent.frameCount)
          : null,
      displayCanvasVisible: presentation?.displayCanvasVisible ?? null,
      workerCanvasVisible,
      nativeCanvasVisible,
      renderBridge: renderBridge == null ? null : {
        rendererBridge: renderBridge.rendererBridge ?? null,
        lastRenderStatus: renderBridge.lastRenderStatus ?? null,
        frameCount: Number.isSafeInteger(renderBridge.frameCount)
          ? renderBridge.frameCount
          : null,
        updateCount: Number.isSafeInteger(renderBridge.updateCount)
          ? renderBridge.updateCount
          : null,
        sourceResidentNextStep:
          Number.isFinite(nativePresentationStep) ? nativePresentationStep : null
      },
      workerRows: rows ? {
        schema: rows.schema ?? null,
        status: rows.status ?? null,
        sphStep: Number(rows.sphStep) || null,
        frameCount: Number(rows.frameCount) || 0,
        readyFrameCount: Number(rows.readyFrameCount) || 0,
        presentationGeometry: rows.presentationGeometry ?? null,
        particleImpostorShape: rows.particleImpostorShape ?? null,
        particleImpostorPassCount: rows.particleImpostorPassCount ?? null,
        projectiveParticleSizing: rows.projectiveParticleSizing ?? null,
        particleDepthModel: rows.particleDepthModel ?? null,
        depthAttachmentFormat: rows.depthAttachmentFormat ?? null,
        depthAttachmentReady: rows.depthAttachmentReady ?? null,
        presentationFrameSchema: rows.presentationFrameSchema ?? null,
        presentationFrameStatus: rows.presentationFrameStatus ?? null,
        presentationFrameAdmitted: rows.presentationFrameAdmitted ?? null,
        presentationFrameGpuCompleted:
          rows.presentationFrameGpuCompleted ?? null,
        presentationFrameGpuCompletionMethod:
          rows.presentationFrameGpuCompletionMethod ?? null,
        presentationFramePresentationOpportunity:
          rows.presentationFramePresentationOpportunity ?? null,
        presentationFramePresentationOpportunityMethod:
          rows.presentationFramePresentationOpportunityMethod ?? null,
        presentationQueueCompletionCount:
          rows.presentationQueueCompletionCount ?? null,
        presentationQueueCompletionSerial:
          rows.presentationQueueCompletionSerial ?? null,
        presentationQueueCompletionMethod:
          rows.presentationQueueCompletionMethod ?? null,
        presentationQueueCompletionScope:
          rows.presentationQueueCompletionScope ?? null,
        physicsQueuePrefixCoverage:
          rows.physicsQueuePrefixCoverage ?? null,
        physicsHostQueueFenceParticipation:
          rows.physicsHostQueueFenceParticipation ?? null,
        motionPresentationQosBoundary:
          rows.motionPresentationQosBoundary ?? null,
        surfaceCount: rows.surfaceCount ?? null,
        indirectDrawCount: rows.indirectDrawCount ?? null,
        condensedDepthWriteEnabled: rows.condensedDepthWriteEnabled ?? null,
        vaporDepthWriteEnabled: rows.vaporDepthWriteEnabled ?? null,
        boxWireframeDrawCount: rows.boxWireframeDrawCount ?? null,
        boxDimsM: rows.boxDimsM ?? null,
        sameDevicePresentation: rows.sameDevicePresentation ?? null,
        residentScheduleCandidatePresentation:
          rows.residentScheduleCandidatePresentation ?? null,
        stateManagerCommittedPresentation:
          rows.stateManagerCommittedPresentation ?? null
      } : null,
      canvases: canvasRows
    };
  });
}

function physicsAndPresentationAdvanced(before, after) {
  const commonAdvanced = Boolean(
    typeof before?.lineage?.laneId === 'string'
    && after?.lineage?.laneId === before.lineage.laneId
    && typeof before?.lineage?.stateKey === 'string'
    && after?.lineage?.stateKey === before.lineage.stateKey
    && typeof before?.lineage?.scheduleId === 'string'
    && typeof after?.lineage?.scheduleId === 'string'
    && after.lineage.scheduleId !== before.lineage.scheduleId
    && Number(after?.lineage?.laneCompletedStepTotal)
      > Number(before?.lineage?.laneCompletedStepTotal)
    && Number(after?.lineage?.laneSimTimeS)
      > Number(before?.lineage?.laneSimTimeS)
    && Number(after?.lineage?.finalPhysicsTick)
      > Number(before?.lineage?.finalPhysicsTick)
    && Number(after?.lineage?.committedPresentationStep)
      > Number(before?.lineage?.committedPresentationStep)
  );
  if (!commonAdvanced || before?.displayOwner !== after?.displayOwner) return false;
  if (after.displayOwner === 'worker') {
    return Boolean(
      after?.tier0EndpointReady === true
      && Number(after?.displayOwnerContentFrameSerial)
        > Number(before?.displayOwnerContentFrameSerial)
      && Number(after?.displayOwnerPresentedSphStep)
        > Number(before?.displayOwnerPresentedSphStep)
      && Number(after?.renderedContentFrameCount)
        > Number(before?.renderedContentFrameCount)
    );
  }
  return Boolean(
    after?.canonicalEndpointReady === true
    && Number(after?.visiblePresentationStep)
      > Number(before?.visiblePresentationStep)
    && Number(after?.renderBridge?.frameCount)
      > Number(before?.renderBridge?.frameCount)
  );
}

function committedPresentationReady(state, { expectWorkerOwner = false } = {}) {
  const expectedOwner = expectWorkerOwner ? 'worker' : 'main-native';
  const endpointReady = expectWorkerOwner
    ? state?.tier0EndpointReady === true
    : state?.canonicalEndpointReady === true;
  return Boolean(
    state?.documentVisibility === 'visible'
    && state?.documentHasFocus === true
    && state?.playText === 'Pause'
    && state?.spatialChurnProfileQuery === '0'
    && state?.surfaceDrawModeSelectedByUrl === false
    && state?.surfaceDrawModeRequestStatus
      === 'surface-draw-mode-preset-runtime-serialized'
    && state?.pendingPresentation?.schema
      === 'peercompute.ulg.sph-pending-body-envelope-preview.v0'
    && state?.pendingPresentation?.status
      === 'control-envelope-preview-retired-after-current-presentation'
    && state?.pendingPresentation?.active === false
    && state?.pendingPresentationLayerHidden === true
    && state?.pendingPresentationLayerAriaBusy === 'false'
    && state?.pendingPresentationLayerDataStatus
      === 'physics-presentation-current'
    && state?.displayOwner === expectedOwner
    && state?.commonAuthorityReady === true
    && endpointReady
    && Number(state?.physicsStep) > 0
    && Number(state?.visiblePresentationStep) >= 0
    && state?.residentError == null
    && state?.renderError == null
    && !/physics pending|control-body envelope preview/i.test(
      `${state?.statusText || ''} ${state?.warningText || ''}`
    )
  );
}

async function sampleRenderCadence(page) {
  await page.waitForTimeout(cadenceWarmupMs);
  const sample = await page.evaluate(async (durationMs) => new Promise((resolve) => {
    const callbackTimestamps = [];
    const rafTimestamps = [];
    const overlayFpsSamples = [];
    const visiblePresentationObservations = [];
    let lastOverlaySampleMs = null;
    const startedAtMs = performance.now();
    const resourceEventStartIndex = Array.isArray(
      globalThis.__ulgGpuResourceCreationEvents
    ) ? globalThis.__ulgGpuResourceCreationEvents.length : 0;
    const timelineEventStartIndex = Array.isArray(
      globalThis.__ulgSphCadenceTimelineEvents
    ) ? globalThis.__ulgSphCadenceTimelineEvents.length : 0;
    const documentVisibility = document.visibilityState;
    const documentHasFocus = document.hasFocus();
    const visibleCanvas = (candidate) => {
      if (!candidate?.isConnected) return false;
      const style = getComputedStyle(candidate);
      const bounds = candidate.getBoundingClientRect();
      return Boolean(
        style.visibility !== 'hidden'
        && style.display !== 'none'
        && Number(style.opacity ?? 1) > 0
        && Number(bounds.width) > 0
        && Number(bounds.height) > 0
      );
    };
    const safeNonNegativeInteger = (value) => {
      if (value == null || value === '') return null;
      const number = Number(value);
      return Number.isSafeInteger(number) && number >= 0 ? number : null;
    };
    const nonEmptyString = (value) => {
      const text = typeof value === 'string' ? value.trim() : '';
      return text || null;
    };
    const readVisiblePresentationObservation = (timestampMs) => {
      const overlay = document.querySelector('#sph-phase-overlay');
      const scene = overlay?.__sphScene || null;
      const presentation = scene?.getWorkerOffscreenPresentation?.()
        || overlay?.__sphWorkerOffscreenPresentation
        || null;
      const renderState = scene?.getSphResidentRenderState?.()
        || overlay?.__sphResidentRenderState
        || null;
      const surfaceDraw = scene?.getSphResidentSurfaceDraw?.()
        || overlay?.__sphResidentSurfaceDraw
        || null;
      const steps = scene?.getMlsMpmResidentSteps?.()
        || overlay?.__mlsMpmResidentSteps
        || null;
      const workerLane = steps?.workerOwnedResidentLane || null;
      const owner = presentation?.displayOwner ?? null;
      const latestRows = presentation?.workerOffscreenRenderRows
        || renderState?.workerOffscreenRenderRows
        || null;
      // Measure the exact admitted framebuffer that still owns the visible
      // canvas. A newer queue-submitted keyframe is diagnostic state only
      // until its GPU-completion + presentation-opportunity proof lands.
      const rows = owner === 'worker'
        ? (presentation?.displayOwnerLastRenderedContent || latestRows)
        : latestRows;
      const durableWorkerFrame = Boolean(
        owner === 'worker'
        && presentation?.displayOwnerLastRenderedContent === rows
      );
      const workerCanvas = document.querySelector(
        'canvas[data-ulg-worker-offscreen-presentation="true"]'
      );
      const mainCanvas = document.querySelector(
        '#sph-scene canvas:not([data-ulg-worker-offscreen-presentation="true"])'
      );
      const mainCanvasStyle = mainCanvas ? getComputedStyle(mainCanvas) : null;
      const pendingPresentation = overlay?.__sphPendingPresentation || null;
      const pendingPresentationLayer = overlay?.querySelector(
        '#sph-pending-presentation'
      ) || null;
      const pendingPresentationVisible = visibleCanvas(pendingPresentationLayer);
      const laneId = nonEmptyString(workerLane?.laneId);
      const stateKey = nonEmptyString(workerLane?.stateKey);
      const lifecycleGeneration = safeNonNegativeInteger(
        presentation?.lifecycleGeneration
      );
      const displayOwnerEpoch = safeNonNegativeInteger(
        presentation?.displayOwnerEpoch
      );
      const cohortIdentity = (
        laneId
        && stateKey
        && lifecycleGeneration > 0
        && displayOwnerEpoch != null
      )
        ? JSON.stringify([
            laneId,
            stateKey,
            lifecycleGeneration,
            displayOwnerEpoch
          ])
        : null;
      if (owner === 'worker') {
        const sourceStep = safeNonNegativeInteger(rows?.sphStep);
        const particleCount = safeNonNegativeInteger(rows?.particleCount);
        const frameCount = safeNonNegativeInteger(rows?.frameCount);
        const readyFrameCount = safeNonNegativeInteger(rows?.readyFrameCount);
        const presentationFrameCount = safeNonNegativeInteger(
          presentation?.frameCount
        );
        const presentationReadyFrameCount = safeNonNegativeInteger(
          presentation?.readyFrameCount
        );
        const rowsDisplayOwnerEpoch = safeNonNegativeInteger(
          rows?.displayOwnerEpoch
        );
        const motionFrameSerial = safeNonNegativeInteger(
          rows?.motionFrameSerial
        );
        const motionFrameSubmittedSerial = safeNonNegativeInteger(
          rows?.motionFrameSubmittedSerial
        );
        const motionSourceFrameCount = safeNonNegativeInteger(
          rows?.motionSourceFrameCount
        );
        const motionSourceSphStep = safeNonNegativeInteger(
          rows?.motionSourceSphStep
        );
        const motionFrameClaimed = Boolean(
          rows?.motionFrameSchema != null
          || rows?.motionFrameAdmitted === true
          || rows?.motionFrameSerial != null
        );
        const presentationQueueCompletionCount = safeNonNegativeInteger(
          rows?.presentationQueueCompletionCount
        );
        const presentationQueueCompletionSerial = safeNonNegativeInteger(
          rows?.presentationQueueCompletionSerial
        );
        const physicsQueuePrefixCoverage = rows?.physicsQueuePrefixCoverage;
        const motionPresentationQosBoundary =
          rows?.motionPresentationQosBoundary;
        const exactIncludedPhysicsPrefix = Boolean(
          physicsQueuePrefixCoverage !== 'physics-queue-prefix-included'
          || (
            rows?.physicsHostQueueFenceParticipation === true
            && Number.isSafeInteger(Number(
              motionPresentationQosBoundary?.submissionOrdinal
            ))
            && Number(motionPresentationQosBoundary.submissionOrdinal) > 0
            && Number.isSafeInteger(Number(
              motionPresentationQosBoundary?.completedSubstepCount
            ))
            && Number(motionPresentationQosBoundary.completedSubstepCount) > 0
            && Number.isSafeInteger(Number(
              motionPresentationQosBoundary?.totalSubstepCount
            ))
            && Number(motionPresentationQosBoundary.totalSubstepCount)
              > Number(motionPresentationQosBoundary.completedSubstepCount)
            && Number.isSafeInteger(Number(
              motionPresentationQosBoundary?.chunkStepCount
            ))
            && Number(motionPresentationQosBoundary.chunkStepCount) > 0
          )
        );
        const exactUnattributedPhysicsPrefix = Boolean(
          physicsQueuePrefixCoverage
            !== 'physics-queue-prefix-not-attributed'
          || rows?.physicsHostQueueFenceParticipation !== true
        );
        const exactPresentationQueueCompletionProof = Boolean(
          presentationQueueCompletionCount > 0
          && presentationQueueCompletionSerial > 0
          && presentationQueueCompletionCount
            === presentationQueueCompletionSerial
          && rows?.presentationQueueCompletionMethod
            === 'worker-device.queue.onSubmittedWorkDone'
          && rows?.presentationQueueCompletionScope
            === 'worker-offscreen-shared-device-queue-frame-proof'
          && (
            physicsQueuePrefixCoverage
              === 'physics-queue-prefix-not-attributed'
            || physicsQueuePrefixCoverage
              === 'physics-queue-prefix-included'
          )
          && exactIncludedPhysicsPrefix
          && exactUnattributedPhysicsPrefix
        );
        const exactMotionFrameProof = Boolean(
          rows?.motionFrameSchema
            === 'peercompute.ulg.worker-offscreen-particle-temporal-motion-frame.v0'
          && rows?.motionFrameStatus
            === 'worker-particle-temporal-motion-frame-presentation-opportunity'
          && rows?.motionFrameAdmitted === true
          && rows?.motionFrameGpuCompleted === true
          && rows?.motionFramePresentationOpportunity === true
          && rows?.motionFramePresentationOpportunityMethod
            === 'worker-request-animation-frame-after-gpu-completion'
          && motionFrameSerial > 0
          && motionFrameSubmittedSerial >= motionFrameSerial
          && motionSourceSphStep === sourceStep
          && motionSourceFrameCount > 0
          && motionSourceFrameCount < frameCount
          && rows?.motionMethod === 'bounded-keyframe-velocity-extrapolation'
          && rows?.motionVelocityBufferRetained === true
          && exactPresentationQueueCompletionProof
        );
        const particlePresentation = Boolean(
          rows?.schema
            === 'peercompute.ulg.worker-offscreen-resident-particle-state-producer.v0'
          && rows?.presentationGeometry === 'sphere-impostor-depth-fallback'
        );
        const isosurfacePresentation = Boolean(
          rows?.schema
            === 'peercompute.ulg.worker-offscreen-resident-isosurface-presentation.v0'
          && rows?.presentationGeometry === 'worker-owned-true-isosurface'
        );
        const exactIsosurfaceFrameProof = Boolean(
          isosurfacePresentation
          && rows?.status
            === 'worker-offscreen-resident-isosurface-presentation-rendered'
          && rows?.presentationFrameSchema
            === 'peercompute.ulg.worker-offscreen-resident-isosurface-presentation-frame.v0'
          && rows?.presentationFrameStatus
            === 'worker-owned-isosurface-presentation-opportunity'
          && rows?.presentationFrameAdmitted === true
          && rows?.presentationFrameGpuCompleted === true
          && rows?.presentationFrameGpuCompletionMethod
            === 'worker-device.queue.onSubmittedWorkDone'
          && rows?.presentationFramePresentationOpportunity === true
          && rows?.presentationFramePresentationOpportunityMethod
            === 'worker-request-animation-frame-after-gpu-completion'
          && exactPresentationQueueCompletionProof
        );
        const admissionChecks = {
          'cohort-ready': Boolean(cohortIdentity),
          'display-owner-epoch-ready': displayOwnerEpoch != null,
          'render-row-owner-epoch-current':
            rowsDisplayOwnerEpoch === displayOwnerEpoch,
          'display-owner-content-ready':
            presentation?.displayOwnerContentReady === true,
          'display-owner-content-frame-ready':
            safeNonNegativeInteger(
              presentation?.displayOwnerContentFrameSerial
            ) > 0,
          'display-owner-content-step-current':
            safeNonNegativeInteger(
              presentation?.displayOwnerPresentedSphStep
            ) === sourceStep,
          'worker-canvas-status-visible':
            presentation?.displayCanvasVisible === true,
          'worker-canvas-visible': visibleCanvas(workerCanvas),
          'main-canvas-hidden': mainCanvasStyle?.opacity === '0',
          'compositor-owner-worker':
            mainCanvas?.getAttribute('data-ulg-presentation-compositor-owner')
              === 'worker',
          'control-envelope-retired': pendingPresentation?.active !== true,
          'control-envelope-layer-hidden': !pendingPresentationVisible,
          'render-row-abi-ready': rows?.renderRowsSchema
            === 'peercompute.ulg.worker-offscreen-render-rows.v0',
          'worker-presentation-geometry-supported':
            particlePresentation || isosurfacePresentation,
          'worker-local-render-row-ready':
            rows?.workerLocalRenderRowsProduced === true,
          'render-row-lane-current': rows?.laneId == null || rows.laneId === laneId,
          'render-row-state-current':
            rows?.stateKey == null || rows.stateKey === stateKey,
          'particle-count-ready': particleCount > 0,
          'frame-count-ready': frameCount > 0,
          'frame-count-current': durableWorkerFrame
            || frameCount === presentationFrameCount,
          'ready-frame-count-ready': readyFrameCount > 0,
          'ready-frame-count-current':
            durableWorkerFrame
            || readyFrameCount === presentationReadyFrameCount,
          'worker-same-device-ready': rows?.sameDevicePresentation === true,
          'source-step-ready': sourceStep != null,
          ...(particlePresentation
            ? {
                'particle-render-row-status-ready': rows?.status
                  === 'worker-offscreen-resident-particle-state-producer-rendered',
                'particle-keyframe-proof-schema-ready':
                  rows?.presentationFrameSchema
                    === 'peercompute.ulg.worker-offscreen-particle-keyframe-presentation-frame.v0',
                'particle-keyframe-proof-status-ready':
                  rows?.presentationFrameStatus
                    === 'worker-particle-keyframe-presentation-opportunity',
                'particle-keyframe-gpu-completed':
                  rows?.presentationFrameGpuCompleted === true,
                'particle-keyframe-presentation-opportunity':
                  rows?.presentationFramePresentationOpportunity === true,
                'particle-keyframe-admitted':
                  rows?.presentationFrameAdmitted === true,
                'particle-keyframe-presentation-opportunity-method-ready':
                  rows?.presentationFramePresentationOpportunityMethod
                    === 'worker-request-animation-frame-after-gpu-completion',
                'particle-keyframe-presentation-queue-proof-ready': Boolean(
                  exactPresentationQueueCompletionProof
                ),
                'particle-motion-frame-proof-ready':
                  !motionFrameClaimed || exactMotionFrameProof,
                'particle-depth-ready': rows?.depthAttachmentReady === true
              }
            : {}),
          ...(isosurfacePresentation
            ? {
                'isosurface-frame-proof-ready': exactIsosurfaceFrameProof,
                'isosurface-surface-count-ready':
                  safeNonNegativeInteger(rows?.surfaceCount) > 0,
                'isosurface-indirect-draw-ready':
                  safeNonNegativeInteger(rows?.indirectDrawCount) > 0
              }
            : {})
        };
        const admissionBlockers = Object.entries(admissionChecks)
          .filter(([, ready]) => !ready)
          .map(([name]) => name);
        const admitted = admissionBlockers.length === 0;
        return {
          timestampMs,
          owner,
          admitted,
          sourceStep,
          cohortIdentity,
          presentationSerial: frameCount,
          displayOwnerEpoch,
          admissionBlockers,
          // A submit receipt is not display cadence: same-queue motion
          // commands can sit behind a long fused mechanics dispatch and then
          // reach the compositor in a burst. Count a temporal frame only once
          // the producer has proved both GPU completion and a subsequent
          // presentation opportunity.
          motionFrameAdmitted: Boolean(
            exactMotionFrameProof
          ),
          motionFrameSerial: exactMotionFrameProof
            ? motionFrameSerial
            : null,
          motionFrameSchema: exactMotionFrameProof
            ? rows.motionFrameSchema
            : null,
          motionSourceFrameCount: exactMotionFrameProof
            ? motionSourceFrameCount
            : null,
          motionSourceSphStep: exactMotionFrameProof
            ? motionSourceSphStep
            : null
        };
      }
      if (owner === 'main-native') {
        const nativePresentation = overlay?.__sphWorkerLaneNativeSurfacePresentation
          || null;
        const renderBridge = scene?.getSphResidentSurfaceDrawRenderBridge?.()
          || null;
        const nativeCanvas = scene?.scene?.userData?.sphNativeWebGpuSurfaceConsumer
          ?.canvas
          || renderBridge?.canvas
          || null;
        const presentationProof = overlay?.__sphResidentPresentationProof || null;
        const renderSource = renderState?.residentRenderSource || null;
        const handoff = renderSource?.workerLaneNativeSurfaceSnapshotHandoff
          || null;
        const committedPresentation = workerLane?.committedPresentation || null;
        const sourceStep = safeNonNegativeInteger(
          nativePresentation?.sourceStep
        );
        const renderStateSourceStep = safeNonNegativeInteger(
          renderState?.sourceResidentNextStep
          ?? renderState?.residentRenderSource?.nextStep
        );
        const renderBridgeSourceStep = safeNonNegativeInteger(
          renderBridge?.sourceResidentNextStep
        );
        const surfaceDrawSourceStep = safeNonNegativeInteger(
          surfaceDraw?.sourceResidentNextStep
        );
        const surfaceDrawBridgeSourceStep = safeNonNegativeInteger(
          surfaceDraw?.renderBridgeSourceResidentNextStep
        );
        const drawSourceSteps = [
          renderBridgeSourceStep,
          surfaceDrawSourceStep,
          surfaceDrawBridgeSourceStep
        ].filter((step) => step != null);
        const renderBridgeFrameCount = safeNonNegativeInteger(
          renderBridge?.frameCount
        );
        const committedSourceStep = safeNonNegativeInteger(
          committedPresentation?.sphStep
        );
        const sourceTimesReady = Boolean(
          Number.isFinite(Number(nativePresentation?.sourceTimeS))
          && Number.isFinite(Number(workerLane?.laneSimTimeS))
          && Math.abs(
            Number(nativePresentation.sourceTimeS) - Number(workerLane.laneSimTimeS)
          ) <= 1e-9
        );
        const handoffTimesReady = Boolean(
          Number.isFinite(Number(handoff?.sourceTimeS))
          && Number.isFinite(Number(nativePresentation?.sourceTimeS))
          && Math.abs(
            Number(handoff.sourceTimeS) - Number(nativePresentation.sourceTimeS)
          ) <= 1e-9
        );
        const admissionChecks = {
          'cohort-ready': Boolean(cohortIdentity),
          'display-owner-epoch-ready': displayOwnerEpoch != null,
          'display-owner-content-ready':
            presentation?.displayOwnerContentReady === true,
          'worker-canvas-status-hidden':
            presentation?.displayCanvasVisible === false,
          'native-canvas-visible': visibleCanvas(nativeCanvas),
          'worker-canvas-hidden': !visibleCanvas(workerCanvas),
          'main-canvas-visible': mainCanvasStyle?.opacity === '1',
          'compositor-owner-native':
            mainCanvas?.getAttribute('data-ulg-presentation-compositor-owner')
              === 'main-native',
          'control-envelope-retired': pendingPresentation?.active !== true,
          'control-envelope-layer-hidden': !pendingPresentationVisible,
          'presentation-proof-bridge-ready':
            presentationProof?.bridge === 'native-webgpu-surface-consumer',
          'presentation-proof-admitted': presentationProof?.admitted === true,
          'presentation-proof-source-current':
            presentationProof?.sourceCurrent === true,
          'native-source-schema-ready': nativePresentation?.schema
            === 'peercompute.ulg.worker-lane-native-surface-presentation-source.v0',
          'native-source-status-ready': nativePresentation?.status
            === 'worker-lane-native-surface-presentation-source-ready',
          'native-source-request-ready':
            Boolean(nonEmptyString(nativePresentation?.requestId)),
          'native-source-cache-current':
            nativePresentation?.cacheKey === nativePresentation?.requestId,
          'native-render-bridge-ready':
            renderBridge?.rendererBridge === 'native-webgpu-surface-consumer',
          'native-source-step-ready': sourceStep != null,
          'committed-source-step-ready': committedSourceStep != null,
          'native-source-step-current':
            committedSourceStep != null && sourceStep === committedSourceStep + 1,
          'native-source-time-current': sourceTimesReady,
          'render-state-source-current': renderState?.sourceResidentRenderSourceStatus
            === 'resident-render-source-current',
          'render-state-generation-current':
            renderState?.sourceResidentExecutionGenerationMatchesCurrent === true,
          'render-source-generation-current':
            renderSource?.residentExecutionGenerationMatchesCurrent === true,
          'surface-draw-generation-current':
            surfaceDraw?.sourceResidentExecutionGenerationMatchesCurrent === true,
          'render-bridge-generation-current':
            renderBridge?.sourceResidentExecutionGenerationMatchesCurrent === true,
          'render-state-source-step-current': sourceStep === renderStateSourceStep,
          'draw-source-step-receipts-ready': drawSourceSteps.length > 0,
          'draw-source-steps-current':
            drawSourceSteps.every((step) => step === sourceStep),
          'native-source-schedule-current':
            nativePresentation?.scheduleId === workerLane?.scheduleId,
          'native-source-lane-current': nativePresentation?.laneId === laneId,
          'native-source-state-current': nativePresentation?.stateKey === stateKey,
          'native-source-particles-ready':
            safeNonNegativeInteger(nativePresentation?.particleCount) > 0,
          'native-handoff-schema-ready': handoff?.schema
            === 'peercompute.ulg.worker-lane-native-surface-presentation-source.v0',
          'native-handoff-status-ready': handoff?.status
            === 'worker-lane-native-surface-presentation-source-admitted',
          'native-handoff-schedule-current':
            handoff?.scheduleId === nativePresentation?.scheduleId,
          'native-handoff-lane-current': handoff?.laneId === laneId,
          'native-handoff-state-current': handoff?.stateKey === stateKey,
          'native-handoff-request-current':
            handoff?.requestId === nativePresentation?.requestId,
          'native-handoff-cache-current':
            handoff?.cacheKey === nativePresentation?.cacheKey,
          'native-handoff-step-current':
            safeNonNegativeInteger(handoff?.sourceStep) === sourceStep,
          'native-handoff-time-current': handoffTimesReady,
          'native-handoff-shared-slot-ready':
            handoff?.sharedSlotIdentityVerified === true,
          'native-handoff-lineage-ready': handoff?.workerLineageMetadataStatus
            === 'worker-retained-compact-snapshot-lineage-metadata-ready',
          'native-handoff-terminal-readback-ready':
            handoff?.terminalCompactSnapshotReadback === true,
          'native-frame-count-ready': renderBridgeFrameCount > 0
        };
        const admissionBlockers = Object.entries(admissionChecks)
          .filter(([, ready]) => !ready)
          .map(([name]) => name);
        const admitted = admissionBlockers.length === 0;
        return {
          timestampMs,
          owner,
          admitted,
          sourceStep,
          cohortIdentity,
          presentationSerial: renderBridgeFrameCount,
          displayOwnerEpoch,
          admissionBlockers,
          motionFrameAdmitted: false,
          motionFrameSerial: null
        };
      }
      return {
        timestampMs,
        owner,
        admitted: false,
        sourceStep: null,
        cohortIdentity,
        presentationSerial: null,
        displayOwnerEpoch,
        admissionBlockers: ['unsupported-display-owner'],
        motionFrameAdmitted: false,
        motionFrameSerial: null
      };
    };
    const tick = (timestamp) => {
      const callbackAtMs = performance.now();
      rafTimestamps.push(timestamp);
      callbackTimestamps.push(callbackAtMs);
      visiblePresentationObservations.push(
        readVisiblePresentationObservation(callbackAtMs)
      );
      const overlay = document.querySelector('#sph-phase-overlay');
      const currentOverlayFps = Number(overlay?.__sphFrameCounters?.renderFps);
      const currentOverlaySampleMs = Number(
        overlay?.__sphFrameCounters?.lastSampleMs
      );
      if (
        Number.isFinite(currentOverlayFps)
        && currentOverlayFps > 0
        && Number.isFinite(currentOverlaySampleMs)
        && currentOverlaySampleMs >= startedAtMs
        && currentOverlaySampleMs !== lastOverlaySampleMs
      ) {
        overlayFpsSamples.push({
          lastSampleMs: currentOverlaySampleMs,
          renderFps: currentOverlayFps
        });
        lastOverlaySampleMs = currentOverlaySampleMs;
      }
      if (callbackAtMs - startedAtMs < durationMs) {
        requestAnimationFrame(tick);
        return;
      }
      resolve({
        startedAtMs,
        endedAtMs: callbackAtMs,
        documentVisibility,
        documentHasFocus,
        finalDocumentVisibility: document.visibilityState,
        finalDocumentHasFocus: document.hasFocus(),
        callbackTimestamps,
        rafTimestamps,
        overlayFpsSamples,
        visiblePresentationObservations,
        gpuResourceCreationEvents: Array.isArray(
          globalThis.__ulgGpuResourceCreationEvents
        )
          ? globalThis.__ulgGpuResourceCreationEvents
              .slice(resourceEventStartIndex)
              .filter((event) => (
                Number(event?.startedAtMs) >= startedAtMs
                && Number(event?.startedAtMs) <= callbackAtMs
              ))
          : [],
        sphCadenceTimelineEvents: Array.isArray(
          globalThis.__ulgSphCadenceTimelineEvents
        )
          ? globalThis.__ulgSphCadenceTimelineEvents
              .slice(timelineEventStartIndex)
              .filter((event) => (
                Number(event?.timestampMs) >= startedAtMs
                && Number(event?.timestampMs) <= callbackAtMs
              ))
          : []
      });
    };
    requestAnimationFrame(tick);
  }), cadenceSampleMs);
  const timestamps = Array.isArray(sample?.callbackTimestamps)
    ? sample.callbackTimestamps
    : [];
  const rafIntervals = timestamps.slice(1).map((value, index) => ({
    startMs: Number(timestamps[index]),
    endMs: Number(value),
    durationMs: Number(value) - Number(timestamps[index])
  })).filter((interval) => (
    Number.isFinite(interval.durationMs) && interval.durationMs > 0
  ));
  const intervalsMs = rafIntervals.map((interval) => interval.durationMs);
  const rafObservedDurationMs = timestamps.length > 1
    ? timestamps.at(-1) - timestamps[0]
    : null;
  const sampleDurationMs = Number(sample?.endedAtMs) - Number(sample?.startedAtMs);
  const meanRafHz = Number(rafObservedDurationMs) > 0
    ? intervalsMs.length * 1000 / rafObservedDurationMs
    : null;
  const medianIntervalMs = median(intervalsMs);
  const p95IntervalMs = percentile(intervalsMs, 0.95);
  const longestRafIntervalsMs = [...intervalsMs]
    .sort((left, right) => right - left)
    .slice(0, 12);
  const longestRafIntervals = [...rafIntervals]
    .sort((left, right) => right.durationMs - left.durationMs)
    .slice(0, 12);
  const overlayFpsWindows = (sample?.overlayFpsSamples || [])
    .filter((entry) => Number.isFinite(Number(entry?.lastSampleMs)))
    .map((entry) => ({
      lastSampleMs: Number(entry.lastSampleMs),
      renderFps: Number(entry.renderFps)
    }))
    .filter((entry) => Number.isFinite(entry.renderFps) && entry.renderFps > 0);
  const overlayFpsSamples = overlayFpsWindows
    .map((entry) => entry.renderFps)
    .filter((value) => Number.isFinite(value) && value > 0);
  const visiblePresentationCadence = summarizeVisiblePresentationCadence(
    sample?.visiblePresentationObservations,
    {
      sampleDurationMs,
      sampleStartedAtMs: Number(sample?.startedAtMs),
      sampleEndedAtMs: Number(sample?.endedAtMs)
    }
  );
  return {
    requestedDurationMs: cadenceSampleMs,
    sampleDurationMs,
    rafObservedDurationMs,
    rafFrameCount: intervalsMs.length,
    meanRafHz,
    medianRafHz: Number(medianIntervalMs) > 0
      ? 1000 / medianIntervalMs
      : null,
    p95IntervalMs,
    p95IntervalEquivalentHz: Number(p95IntervalMs) > 0
      ? 1000 / p95IntervalMs
      : null,
    overlayFpsWindows,
    overlayWindowCount: overlayFpsWindows.length,
    overlayMedianFps: median(overlayFpsSamples),
    ...visiblePresentationCadence,
    longestRafIntervalsMs,
    longestRafIntervals,
    rafIntervalCountOver33Ms:
      intervalsMs.filter((intervalMs) => intervalMs > 33).length,
    rafIntervalCountOver50Ms:
      intervalsMs.filter((intervalMs) => intervalMs > 50).length,
    gpuResourceCreationEvents:
      Array.isArray(sample?.gpuResourceCreationEvents)
        ? sample.gpuResourceCreationEvents
        : [],
    sphCadenceTimelineEvents:
      Array.isArray(sample?.sphCadenceTimelineEvents)
        ? sample.sphCadenceTimelineEvents
        : [],
    documentVisibility: sample?.documentVisibility ?? null,
    documentHasFocus: sample?.documentHasFocus === true,
    finalDocumentVisibility: sample?.finalDocumentVisibility ?? null,
    finalDocumentHasFocus: sample?.finalDocumentHasFocus === true
  };
}

const CADENCE_ENVIRONMENT_ISSUES = new Set([
  'document-not-visible',
  'document-not-focused',
  'document-not-visible-at-window-end',
  'document-not-focused-at-window-end'
]);

async function collectRenderCadence(page) {
  const attempts = [];
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    await page.bringToFront();
    const sample = await sampleRenderCadence(page);
    const evaluation = evaluateCadenceSample(sample, {
      minimumHz: minimumRenderHz,
      targetHz: nominalRenderHz
    });
    attempts.push({ attempt, sample, evaluation });
    const environmentalInvalid = evaluation.issues.some((issue) => (
      CADENCE_ENVIRONMENT_ISSUES.has(issue)
    ));
    if (!environmentalInvalid || attempt === 2) {
      return { sample, evaluation, attempts };
    }
    await page.waitForTimeout(500);
  }
  throw new Error('cadence sampling exhausted without a result');
}

async function waitForCommittedPresentation(page, options) {
  const startedAt = Date.now();
  let lastProgressAt = startedAt;
  let lastState = null;
  while (Date.now() - startedAt < timeoutMs) {
    lastState = await readState(page);
    if (committedPresentationReady(lastState, options)) return lastState;
    if (Date.now() - lastProgressAt >= 10_000) {
      lastProgressAt = Date.now();
      console.log(JSON.stringify({
        event: 'committed-presentation-wait',
        elapsedMs: lastProgressAt - startedAt,
        expectedOwner: options?.expectWorkerOwner ? 'worker' : 'main-native',
        playText: lastState?.playText ?? null,
        surfaceDrawModeSelectedByUrl:
          lastState?.surfaceDrawModeSelectedByUrl ?? null,
        surfaceDrawModeRequestStatus:
          lastState?.surfaceDrawModeRequestStatus ?? null,
        displayOwner: lastState?.displayOwner ?? null,
        displayOwnerContentReady:
          lastState?.displayOwnerContentReady ?? null,
        workerCanvasVisible: lastState?.workerCanvasVisible ?? null,
        commonAuthorityReady: lastState?.commonAuthorityReady ?? null,
        canonicalEndpointReady: lastState?.canonicalEndpointReady ?? null,
        tier0EndpointReady: lastState?.tier0EndpointReady ?? null,
        physicsStep: lastState?.physicsStep ?? null,
        visiblePresentationStep:
          lastState?.visiblePresentationStep ?? null,
        workerGeometry:
          lastState?.workerRows?.presentationGeometry ?? null,
        pendingPresentationStatus:
          lastState?.pendingPresentation?.status ?? null,
        pendingPresentationActive:
          lastState?.pendingPresentation?.active ?? null,
        spatialChurnProfileQuery:
          lastState?.spatialChurnProfileQuery ?? null,
        residentError: lastState?.residentError ?? null,
        renderError: lastState?.renderError ?? null
      }));
    }
    await page.waitForTimeout(250);
  }
  throw new Error(
    `committed presentation did not become ready: ${JSON.stringify(lastState)}`
  );
}

async function waitForPhysicsAndPresentationAdvance(page, before, options) {
  const startedAt = Date.now();
  let lastState = null;
  while (Date.now() - startedAt < timeoutMs) {
    lastState = await readState(page);
    if (
      physicsAndPresentationAdvanced(before, lastState)
      && committedPresentationReady(lastState, options)
    ) return lastState;
    await page.waitForTimeout(250);
  }
  throw new Error(
    `committed physics and presentation did not advance: ${JSON.stringify({ before, lastState })}`
  );
}

const browser = await chromium.launch({
  headless: false,
  executablePath: '/usr/bin/google-chrome',
  args: [
    '--no-sandbox',
    '--enable-unsafe-webgpu',
    '--use-angle=vulkan',
    '--enable-features=Vulkan,UseSkiaRenderer',
    '--ignore-gpu-blocklist',
    '--ozone-platform=wayland',
    '--window-size=1600,900'
  ]
});

const results = [];
try {
  for (const preset of scenarioPresets) {
    const context = await browser.newContext({
      viewport: { width: 1600, height: 900 },
      ignoreHTTPSErrors: true
    });
    const page = await context.newPage();
    const consoleEntries = [];
    const pageErrors = [];
    page.on('console', (message) => {
      const text = message.text();
      if (consoleEntries.length < 1000) {
        consoleEntries.push({ type: message.type(), text });
      }
    });
    page.on('pageerror', (error) => {
      pageErrors.push(error?.message || String(error));
    });
    await installGpuFaultCapture(page);
    const targetUrl = new URL(sphPhaseScenarioPresetUrl(preset.id, {
      // Keep the escape hatch for additive diagnostics, but seal every preset
      // control/runtime identity after it so a diagnostic query cannot turn an
      // acceptance row into another scenario or presentation pipeline.
      ...extraScenarioParams,
      ...preset.controls,
      ...preset.runtime,
      scenario: preset.id,
      visualCapture: '1',
      residentAuto: '0',
      spatialChurnProfile: '0',
      renderer: preset.runtime?.renderer ?? 'native-webgpu',
      renderOwnership: preset.runtime?.renderOwnership
        ?? 'worker-owned-resident-render-producer',
      workerOffscreenPresentation:
        preset.runtime?.workerOffscreenPresentation ?? '1',
      workerLivePreview: preset.runtime?.workerLivePreview ?? '0',
      ...(reactionActivationPolicyOverride == null
        ? {}
        : { reactionActivationPolicy: reactionActivationPolicyOverride })
    }), baseUrl);
    // This is a DEFAULT-preset acceptance sweep. Preset selection in the UI
    // uses the canonical hash route. On that route, a serialized `surfaceDraw`
    // equal to the selected preset is correctly classified as preset runtime;
    // the same value in the query is intentionally treated as a direct user
    // diagnostic override. Reproduce the UI route exactly so default worker
    // ownership and explicit main-thread ownership cannot be conflated.
    const canonicalPresetHash = targetUrl.searchParams.toString();
    targetUrl.search = '';
    // Keep this harness-only resource diagnostic in the query. The mounted
    // UI may canonicalize/drop non-control hash keys, while the query survives
    // and—unlike surfaceDraw—does not alter presentation provenance.
    targetUrl.searchParams.set('spatialChurnProfile', '0');
    targetUrl.hash = canonicalPresetHash;
    const target = targetUrl.toString();
    const result = {
      presetId: preset.id,
      target,
      status: 'running',
      screenshots: [],
      screenshotEvidence: [],
      first: null,
      second: null,
      cadence: null,
      cadenceEvaluation: null,
      cadenceIssueClassification: null,
      cadenceAttempts: [],
      issues: []
    };
    try {
      console.log(JSON.stringify({ event: 'scenario-start', presetId: preset.id }));
      await page.goto(target, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
      await ensureOverlay(page);
      await page.bringToFront();
      const playText = await page.locator('#sph-play').textContent({ timeout: 30_000 });
      if (/Play/i.test(playText || '')) {
        await page.evaluate(() => document.querySelector('#sph-play')?.click());
      }
      const expectWorkerOwner = Boolean(
        preset.runtime?.renderOwnership
          === 'worker-owned-resident-render-producer'
        && preset.runtime?.workerOffscreenPresentation === '1'
      );
      const cadenceGatingRequired = particlePresentationPresetIds.has(
        preset.id
      );
      const expectedWorkerGeometry = cadenceGatingRequired
        ? 'sphere-impostor-depth-fallback'
        : 'worker-owned-true-isosurface';
      result.cadenceGatingRequired = cadenceGatingRequired;
      result.expectedWorkerGeometry = expectedWorkerGeometry;
      result.first = await waitForCommittedPresentation(page, {
        expectWorkerOwner
      });
      const firstPath = path.join(outputDir, `${preset.id}-a.png`);
      await page.screenshot({ path: firstPath, type: 'png' });
      result.screenshots.push(firstPath);
      result.screenshotEvidence.push(
        await screenshotDigest(firstPath, 'initial-committed-presentation')
      );
      const cadenceResult = await collectRenderCadence(page);
      result.cadence = cadenceResult.sample;
      result.cadenceEvaluation = cadenceResult.evaluation;
      result.cadenceAttempts = cadenceResult.attempts;
      result.cadenceIssueClassification = classifyCadenceAcceptanceIssues(
        result.cadenceEvaluation.issues,
        { throughputRequired: cadenceGatingRequired }
      );
      result.issues.push(
        ...result.cadenceIssueClassification.acceptanceIssues
      );
      result.second = await waitForPhysicsAndPresentationAdvance(
        page,
        result.first,
        { expectWorkerOwner }
      );
      const secondPath = path.join(outputDir, `${preset.id}-b.png`);
      await page.screenshot({ path: secondPath, type: 'png' });
      result.screenshots.push(secondPath);
      result.screenshotEvidence.push(
        await screenshotDigest(secondPath, 'advanced-committed-presentation')
      );
      if (!physicsAndPresentationAdvanced(result.first, result.second)) {
        result.issues.push('physics-and-visible-presentation-did-not-advance');
      }
      if (!committedPresentationReady(result.second, { expectWorkerOwner })) {
        result.issues.push('final-committed-presentation-not-ready');
      }
      if (expectWorkerOwner) {
        for (const [label, snapshot] of [
          ['initial', result.first],
          ['final', result.second]
        ]) {
          if (
            snapshot?.workerRows?.presentationGeometry
              !== expectedWorkerGeometry
          ) {
            result.issues.push(
              `${label}-worker-presentation-geometry-receipt-missing`
            );
          }
          if (snapshot?.workerRows?.depthAttachmentReady !== true) {
            result.issues.push(`${label}-worker-depth-attachment-not-ready`);
          }
          if (Number(snapshot?.workerRows?.boxWireframeDrawCount) !== 1) {
            result.issues.push(`${label}-worker-box-wireframe-not-drawn`);
          }
        }
      }
      if (expectWorkerOwner && result.first?.workerCanvasVisible !== true) {
        result.issues.push('worker-owned-presentation-not-visible');
      }
      const criticalMessages = consoleEntries.filter((entry) => criticalConsoleText(entry.text));
      if (pageErrors.length > 0) result.issues.push('page-error');
      if (criticalMessages.length > 0) result.issues.push('critical-webgpu-console-message');
      result.console = {
        entryCount: consoleEntries.length,
        pageErrors,
        criticalMessages,
        tail: consoleEntries.slice(-30)
      };
      result.status = result.issues.length === 0 ? 'pass' : 'fail';
      console.log(JSON.stringify({
        event: 'scenario-complete',
        presetId: preset.id,
        status: result.status,
        cadenceGatingRequired,
        expectedWorkerGeometry,
        firstFrame: result.first?.workerRows?.frameCount,
        secondFrame: result.second?.workerRows?.frameCount,
        firstStep: result.first?.sphStep,
        secondStep: result.second?.sphStep,
        firstPhysicsStep: result.first?.physicsStep,
        secondPhysicsStep: result.second?.physicsStep,
        firstPresentationStep: result.first?.visiblePresentationStep,
        secondPresentationStep: result.second?.visiblePresentationStep,
        meanRafHz: result.cadence?.meanRafHz,
        medianRafHz: result.cadence?.medianRafHz,
        overlayMedianFps: result.cadence?.overlayMedianFps,
        meanVisiblePresentationHz:
          result.cadence?.meanVisiblePresentationHz,
        medianVisiblePresentationHz:
          result.cadence?.medianVisiblePresentationHz,
        p95VisualIntervalEquivalentHz:
          result.cadence?.p95VisualIntervalEquivalentHz,
        maximumVisiblePresentationGapMs:
          result.cadence?.maximumVisiblePresentationGapMs,
        minimumSustainedWindowTransitionCount:
          result.cadence?.minimumSustainedWindowTransitionCount,
        minimumSustainedWindowBoundaryAdjustedHz:
          result.cadenceEvaluation
            ?.minimumSustainedWindowBoundaryAdjustedHz,
        meanSourcePresentationHz:
          result.cadence?.meanSourcePresentationHz,
        workerVisible: result.first?.workerCanvasVisible,
        issues: result.issues
      }));
    } catch (error) {
      result.status = 'fail';
      result.issues.push(error?.message || String(error));
      result.console = {
        entryCount: consoleEntries.length,
        pageErrors,
        criticalMessages: consoleEntries.filter((entry) => criticalConsoleText(entry.text)),
        tail: consoleEntries.slice(-50)
      };
      console.error(JSON.stringify({
        event: 'scenario-failed',
        presetId: preset.id,
        error: error?.message || String(error)
      }));
    } finally {
      const currentPlayText = await page.locator('#sph-play').textContent({ timeout: 1000 }).catch(() => '');
      if (/Pause/i.test(currentPlayText || '')) {
        await page.evaluate(() => document.querySelector('#sph-play')?.click()).catch(() => {});
      }
      await context.close();
      results.push(result);
      await writeFile(
        path.join(outputDir, 'summary.partial.json'),
        `${JSON.stringify({ status: 'running', results }, null, 2)}\n`
      );
    }
  }
} finally {
  await browser.close();
}

const failed = results.filter((result) => result.status !== 'pass');
const automatedDisposition = resolveHeadedSweepAutomatedDisposition({
  automatedFailureCount: failed.length,
  completeCannedMatrix,
  diagnosticOverridesActive
});
const summary = {
  schema: 'peercompute.ulg.headed-all-preset-cadence-sweep.v2',
  status: automatedDisposition.status,
  automatedStatus: automatedDisposition.automatedStatus,
  acceptanceEligible: automatedDisposition.acceptanceEligible,
  manualVisualReviewStatus:
    automatedDisposition.manualVisualReviewStatus,
  acceptance: {
    scope: 'visual-presentation-throughput-and-committed-animation',
    nominalRenderHz,
    minimumMeasuredHz: minimumRenderHz,
    nominalRefreshTolerance: minimumRenderHz / nominalRenderHz,
    cadenceWarmupMs,
    cadenceSampleMs,
    spatialKeyChurnProfilingEnabled: false,
    simulationRealtimeFactorGating: false,
    rafMetricsDiagnosticOnly: true,
    medianAndP95IntervalRatesDiagnosticOnly: true,
    maximumAllowedVisiblePresentationGapMs:
      3 * 1000 / minimumRenderHz,
    sustainedCadenceWindowMs: 500,
    requiredSustainedWindowTransitionCount:
      Math.ceil(minimumRenderHz * 0.5) - 1,
    visibleStateIdentityRequired: true,
    sourceStepJumpsCountAsOnePresentation: true,
    reactionActivationPolicyOverride,
    extraScenarioQuery: extraScenarioQuery || null,
    extraScenarioParams,
    diagnosticOverridesActive,
    gpuResourceProfilingEnabled: profileGpuResources,
    manualScreenshotReviewRequired: true,
    manualScreenshotReviewReceiptSchema:
      'peercompute.ulg.headed-all-preset-manual-visual-review.v0',
    manualScreenshotReviewRequirements: [
      'physics-geometry-visible-beyond-box-wireframe',
      'control-body-preview-absent',
      'nonblank-physics-layer',
      'scenario-geometry-changes-across-screenshot-pair'
    ],
    cadenceGatedPresetIds: [...particlePresentationPresetIds],
    completeCannedMatrix,
    selectedPresetIds: scenarioPresets.map((preset) => preset.id)
  },
  desktop: {
    browser: '/usr/bin/google-chrome',
    display: process.env.WAYLAND_DISPLAY || null,
    headless: false,
    viewport: [1600, 900]
  },
  scenarioCount: results.length,
  passedScenarioCount: results.length - failed.length,
  failedScenarioCount: failed.length,
  screenshotCount: results.reduce(
    (count, result) => count + result.screenshots.length,
    0
  ),
  results
};
await writeFile(path.join(outputDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify({
  event: 'sweep-complete',
  status: summary.status,
  automatedStatus: summary.automatedStatus,
  acceptanceEligible: summary.acceptanceEligible,
  scenarioCount: summary.scenarioCount,
  passedScenarioCount: summary.passedScenarioCount,
  outputDir
}));
if (failed.length > 0) process.exitCode = 1;
