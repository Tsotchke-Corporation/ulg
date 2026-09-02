import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { chromium } from '@playwright/test';

import {
  SPH_PHASE_SCENARIO_PRESETS,
  sphPhaseScenarioPresetUrl
} from '../src/runtime/sphPhaseScenarioPresets.js';

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
const minimumRenderHz = Number(process.env.ULG_HEADED_SWEEP_MIN_RENDER_HZ)
  || nominalRenderHz * 0.9;
const livePreviewPresetIds = new Set(['bulk-water', 'water-realtime']);
const scenarioSelection = String(
  process.env.ULG_HEADED_SWEEP_SCENARIOS || ''
).split(',').map((value) => value.trim()).filter(Boolean);
const selectedPresetIds = scenarioSelection.length > 0
  ? new Set(scenarioSelection)
  : null;
const scenarioPresets = SPH_PHASE_SCENARIO_PRESETS.filter((preset) => (
  selectedPresetIds == null || selectedPresetIds.has(preset.id)
));
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

export function evaluateCadenceSample(sample, {
  minimumHz = nominalRenderHz * 0.9,
  targetHz = nominalRenderHz
} = {}) {
  const meanRafHz = finiteOrNull(sample?.meanRafHz);
  const medianRafHz = finiteOrNull(sample?.medianRafHz);
  const overlayMedianFps = finiteOrNull(sample?.overlayMedianFps);
  const overlayWindowCount = Number(sample?.overlayWindowCount);
  const sampleDurationMs = finiteOrNull(sample?.sampleDurationMs);
  const rafFrameCount = Number(sample?.rafFrameCount);
  const issues = [];
  if (sample?.documentVisibility !== 'visible') issues.push('document-not-visible');
  if (sample?.documentHasFocus !== true) issues.push('document-not-focused');
  if (sample?.finalDocumentVisibility !== 'visible') {
    issues.push('document-not-visible-at-window-end');
  }
  if (sample?.finalDocumentHasFocus !== true) {
    issues.push('document-not-focused-at-window-end');
  }
  if (!(sampleDurationMs >= 5_000)) issues.push('cadence-window-too-short');
  if (!(Number.isSafeInteger(rafFrameCount) && rafFrameCount > 0)) {
    issues.push('raf-frames-missing');
  }
  if (!(meanRafHz >= minimumHz)) issues.push('mean-raf-below-target');
  if (!(medianRafHz >= minimumHz)) issues.push('median-raf-below-target');
  if (!(Number.isSafeInteger(overlayWindowCount) && overlayWindowCount >= 3)) {
    issues.push('overlay-fps-windows-insufficient');
  }
  if (!(overlayMedianFps >= minimumHz)) issues.push('overlay-fps-below-target');
  return Object.freeze({
    status: issues.length === 0 ? 'pass' : 'fail',
    targetHz,
    minimumMeasuredHz: minimumHz,
    issues: Object.freeze(issues)
  });
}

function criticalConsoleText(text) {
  return /(?:ulg-gpu-(?:uncaptured-error|device-lost)|GPUValidationError|validation error|invalid WGSL|shader.*(?:error|invalid)|pipeline.*invalid|device lost|out of memory)/i.test(text);
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
    const presentation = scene?.getWorkerOffscreenPresentation?.()
      || overlay?.__sphWorkerOffscreenPresentation
      || null;
    const renderState = scene?.getSphResidentRenderState?.()
      || overlay?.__sphResidentRenderState
      || null;
    const rows = presentation?.workerOffscreenRenderRows
      || renderState?.workerOffscreenRenderRows
      || null;
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
    const renderedContent = presentation?.displayOwnerLastRenderedContent || null;
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
    const tier0EndpointReady = Boolean(
      commonAuthorityReady
      && displayOwner === 'worker'
      && presentation?.displayOwnerContentReady === true
      && presentation?.displayCanvasVisible === true
      && workerCanvasVisible === true
      && Number(presentation?.displayOwnerContentFrameSerial) > 0
      && Number(presentation?.displayOwnerPresentedSphStep)
        === Number(renderedContent?.sphStep)
      && renderedContent?.schema
        === 'peercompute.ulg.worker-offscreen-resident-particle-state-producer.v0'
      && renderedContent?.status
        === 'worker-offscreen-resident-particle-state-producer-rendered'
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
      && renderedContent?.presentationGeometry
        === 'sphere-impostor-depth-fallback'
      && renderedContent?.depthAttachmentReady === true
      && Number(renderedContent?.boxWireframeDrawCount) === 1
    );
    return {
      capturedAtMs: performance.now(),
      documentVisibility: document.visibilityState,
      documentHasFocus: document.hasFocus(),
      spatialChurnProfileQuery: new URL(location.href).searchParams.get('spatialChurnProfile'),
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
    const tick = (timestamp) => {
      const callbackAtMs = performance.now();
      rafTimestamps.push(timestamp);
      callbackTimestamps.push(callbackAtMs);
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
  let lastState = null;
  while (Date.now() - startedAt < timeoutMs) {
    lastState = await readState(page);
    if (committedPresentationReady(lastState, options)) return lastState;
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
    const target = new URL(sphPhaseScenarioPresetUrl(preset.id, {
      visualCapture: '1',
      residentAuto: '0',
      spatialChurnProfile: '0',
      ...(reactionActivationPolicyOverride == null
        ? {}
        : { reactionActivationPolicy: reactionActivationPolicyOverride })
    }), baseUrl).toString();
    const result = {
      presetId: preset.id,
      target,
      status: 'running',
      screenshots: [],
      first: null,
      second: null,
      cadence: null,
      cadenceEvaluation: null,
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
      const expectWorkerOwner = livePreviewPresetIds.has(preset.id);
      result.first = await waitForCommittedPresentation(page, {
        expectWorkerOwner
      });
      const firstPath = path.join(outputDir, `${preset.id}-a.png`);
      await page.screenshot({ path: firstPath, type: 'png' });
      result.screenshots.push(firstPath);
      const cadenceResult = await collectRenderCadence(page);
      result.cadence = cadenceResult.sample;
      result.cadenceEvaluation = cadenceResult.evaluation;
      result.cadenceAttempts = cadenceResult.attempts;
      result.issues.push(...result.cadenceEvaluation.issues);
      result.second = await waitForPhysicsAndPresentationAdvance(
        page,
        result.first,
        { expectWorkerOwner }
      );
      const secondPath = path.join(outputDir, `${preset.id}-b.png`);
      await page.screenshot({ path: secondPath, type: 'png' });
      result.screenshots.push(secondPath);
      if (!physicsAndPresentationAdvanced(result.first, result.second)) {
        result.issues.push('physics-and-visible-presentation-did-not-advance');
      }
      if (!committedPresentationReady(result.second, { expectWorkerOwner })) {
        result.issues.push('final-committed-presentation-not-ready');
      }
      if (result.first?.workerRows?.presentationGeometry !== 'sphere-impostor-depth-fallback') {
        result.issues.push('worker-impostor-receipt-missing');
      }
      if (result.first?.workerRows?.depthAttachmentReady !== true) {
        result.issues.push('worker-depth-attachment-not-ready');
      }
      if (Number(result.first?.workerRows?.boxWireframeDrawCount) !== 1) {
        result.issues.push('worker-box-wireframe-not-drawn');
      }
      if (livePreviewPresetIds.has(preset.id) && result.first?.workerCanvasVisible !== true) {
        result.issues.push('tier0-worker-live-preview-not-visible');
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
const summary = {
  schema: 'peercompute.ulg.headed-all-preset-cadence-sweep.v1',
  status: failed.length === 0 ? 'pass' : 'fail',
  acceptance: {
    scope: 'visual-presentation-throughput-and-committed-animation',
    nominalRenderHz,
    minimumMeasuredHz: minimumRenderHz,
    nominalRefreshTolerance: minimumRenderHz / nominalRenderHz,
    cadenceWarmupMs,
    cadenceSampleMs,
    spatialKeyChurnProfilingEnabled: false,
    simulationRealtimeFactorGating: false,
    reactionActivationPolicyOverride,
    gpuResourceProfilingEnabled: profileGpuResources,
    manualScreenshotReviewRequired: true
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
  scenarioCount: summary.scenarioCount,
  passedScenarioCount: summary.passedScenarioCount,
  outputDir
}));
if (failed.length > 0) process.exitCode = 1;
