import { spawn, spawnSync } from 'node:child_process';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { SPH_PHASE_RENDER_ORDER } from '../src/visualization/sphPhaseScene.js';
import { MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS } from '../src/runtime/sph/sphMlsMpmGpuSummary.js';

const MOONLAB_CANONICAL_REFERENCE_SUITE_FILE_SHA256 = 'sha256:7d4e6372e49689d2202914e210af84d19d776dc6fbc5b7e08b19cbedfb71b455';
const ESHKOL_MAGNETAR_SOURCE_SHA256 = 'sha256:630b20dd243be58f8e53631e934d09298696fe7e7ea84b15e7d7b89d18809b69';
const ESHKOL_MAGNETAR_WASM_SHA256 = 'sha256:e0a3c7d280678a8c1e40865daeab6601dc8a6a64cfa5b29b7b6bfcaddc86c5aa';
const SPH_VISUAL_CAPTURE_ENABLED = process.env.ULG_SPH_VISUAL_CAPTURE === '1';
const SPH_LONG_HORIZON_CAPTURE_ENABLED = process.env.ULG_SPH_LONG_HORIZON_CAPTURE === '1';
const DEFAULT_SPH_VISUAL_FRAME_COUNT = 96;
const DEFAULT_SPH_VISUAL_INTERVAL_MS = 125;
const DEFAULT_SPH_LONG_HORIZON_BATCH_COUNT = 8;
const DEFAULT_SPH_LONG_HORIZON_BATCH_STEPS = 32;
const MLS_MPM_RESIDENT_COMPACT_SUMMARY_BYTES = MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS * Float32Array.BYTES_PER_ELEMENT;
const PEERCOMPUTE_RELAY_SCRIPT = '/home/cos/projects/peercompute/peercompute/src/relay/server.js';
const PEERCOMPUTE_RELAY_CWD = '/home/cos/projects/peercompute/peercompute';
const ULG_HTTPS_CERT = process.env.ULG_HTTPS_CERT || '/tmp/ulg-vite-https/cert.pem';
const ULG_HTTPS_KEY = process.env.ULG_HTTPS_KEY || '/tmp/ulg-vite-https/key.pem';
const SPH_THREE_RENDER_ROW_BRIDGES = ['three-render-row-points', 'three-render-row-spheres'];
const SPH_THREE_RENDER_ROW_RENDER_SOURCES = [
  'resident-render-rows-three-points',
  'resident-render-rows-three-instanced-spheres'
];
const SPH_THREE_RENDER_ROW_SURFACE_STATUSES = [
  'resident-render-row-points-built',
  'resident-render-row-spheres-built'
];
const SPH_THREE_RENDER_ROW_BRIDGE_STATUSES = [
  'three-render-row-points-ready',
  'three-render-row-spheres-ready'
];
const SPH_THREE_RENDER_ROW_LAST_RENDER_STATUSES = [
  'three-render-row-points-submitted',
  'three-render-row-spheres-submitted'
];
const MOONLAB_WEBGPU_HANDOFF_SUMMARY_COVERED_OPERATIONS = [
  'hadamard',
  'pauli_x',
  'pauli_z',
  'cnot',
  'compute_probabilities'
];
const MOONLAB_WEBGPU_HANDOFF_SUMMARY_EXCLUDED_OPERATIONS = ['phase'];

function envPositiveInteger(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function sanitizeArtifactLabel(label) {
  return String(label || 'artifact').replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'artifact';
}

async function ensureSphPhaseOverlayVisible(page, { timeout = 60_000 } = {}) {
  const overlay = page.locator('#sph-phase-overlay');
  if (await overlay.count() === 0) {
    await page.locator('#run-sph-phase').click({
      timeout: Math.min(5_000, timeout)
    }).catch(async (error) => {
      if (await overlay.count() > 0) return;
      throw error;
    });
  }
  await expect(overlay).toBeVisible({ timeout });
}

function createLineTail(limit = 80) {
  const lines = [];
  return {
    push(line) {
      lines.push(line);
      if (lines.length > limit) lines.shift();
    },
    text() {
      return lines.join('\n');
    }
  };
}

async function stopChildProcess(child) {
  if (!child || child.exitCode !== null || child.signalCode) return;
  child.kill('SIGTERM');
  const stopped = await new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(false), 5000);
    child.once('exit', () => {
      clearTimeout(timeout);
      resolve(true);
    });
  });
  if (!stopped && child.exitCode === null) {
    child.kill('SIGKILL');
  }
}

async function startPeerComputeRelayForPlaywright() {
  const stdoutTail = createLineTail();
  const stderrTail = createLineTail();
  let stdoutRemainder = '';
  let stderrRemainder = '';
  let relayAddress = null;
  let resolveReady;
  let rejectReady;
  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  const timeout = setTimeout(() => {
    rejectReady(new Error(`Timed out waiting for PeerCompute relay address\nstdout:\n${stdoutTail.text()}\nstderr:\n${stderrTail.text()}`));
  }, 30_000);
  const child = spawn('node', [PEERCOMPUTE_RELAY_SCRIPT], {
    cwd: PEERCOMPUTE_RELAY_CWD,
    env: {
      ...process.env,
      RELAY_LISTEN_HOST: '127.0.0.1',
      RELAY_PUBLIC_HOST: '127.0.0.1',
      RELAY_LISTEN_PORT: '0',
      RELAY_PUBLIC_PROTOCOL: 'wss',
      RELAY_TOPIC_PREFIXES: 'ulg.,pc.,peercompute-',
      SSL_CERT: ULG_HTTPS_CERT,
      SSL_KEY: ULG_HTTPS_KEY
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const handleStdoutLine = (line) => {
    stdoutTail.push(line);
    const match = line.match(/Relay Address:\s*(\S+)/);
    if (match && !relayAddress) {
      relayAddress = match[1];
      clearTimeout(timeout);
      resolveReady(relayAddress);
    }
  };
  const handleStderrLine = (line) => {
    stderrTail.push(line);
  };
  child.stdout.on('data', (chunk) => {
    stdoutRemainder += String(chunk);
    const lines = stdoutRemainder.split(/\r?\n/);
    stdoutRemainder = lines.pop() || '';
    lines.filter(Boolean).forEach(handleStdoutLine);
  });
  child.stderr.on('data', (chunk) => {
    stderrRemainder += String(chunk);
    const lines = stderrRemainder.split(/\r?\n/);
    stderrRemainder = lines.pop() || '';
    lines.filter(Boolean).forEach(handleStderrLine);
  });
  child.once('error', (error) => {
    clearTimeout(timeout);
    rejectReady(error);
  });
  child.once('exit', (code, signal) => {
    if (stdoutRemainder) handleStdoutLine(stdoutRemainder);
    if (stderrRemainder) handleStderrLine(stderrRemainder);
    if (!relayAddress) {
      clearTimeout(timeout);
      rejectReady(new Error(`PeerCompute relay exited before advertising an address code=${code} signal=${signal || 'none'}\nstdout:\n${stdoutTail.text()}\nstderr:\n${stderrTail.text()}`));
    }
  });
  const address = await ready;
  return {
    address,
    stdoutTail,
    stderrTail,
    async stop() {
      await stopChildProcess(child);
    }
  };
}

function withVisualCaptureParam(url) {
  const value = String(url || '/');
  if (/[?&#]visualCapture=/.test(value)) return value;
  const hashIndex = value.indexOf('#');
  const base = hashIndex >= 0 ? value.slice(0, hashIndex) : value;
  const hash = hashIndex >= 0 ? value.slice(hashIndex) : '';
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}visualCapture=1${hash}`;
}

function summarizeCaptureCadence(metrics, intervalMs) {
  const intervals = [];
  for (let index = 1; index < metrics.length; index += 1) {
    const previous = Number(metrics[index - 1]?.capturedAtMs);
    const current = Number(metrics[index]?.capturedAtMs);
    if (Number.isFinite(previous) && Number.isFinite(current)) intervals.push(current - previous);
  }
  const maxIntervalMs = intervals.length > 0 ? Math.max(...intervals) : null;
  const meanIntervalMs = intervals.length > 0
    ? intervals.reduce((sum, value) => sum + value, 0) / intervals.length
    : null;
  const closeEnoughThresholdMs = Math.max(intervalMs * 3, 500);
  return {
    schema: 'peercompute.ulg.sph-visual-capture-cadence.v0',
    targetIntervalMs: intervalMs,
    closeEnoughThresholdMs,
    intervalCount: intervals.length,
    maxIntervalMs,
    meanIntervalMs,
    status: intervals.length === 0
      ? 'insufficient-samples'
      : maxIntervalMs <= closeEnoughThresholdMs
      ? 'close-spaced'
      : 'slow-capture-cadence'
  };
}

function finiteOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function metricSimulationTimeS(metric) {
  return finiteOrNull(
    metric?.residentStep?.particlePingPong?.nextTime
      ?? metric?.residentSteps?.nextTime
      ?? metric?.residentStep?.diagnostics?.nextTimeS
  );
}

function metricResidentSequence(metric) {
  return finiteOrNull(
    metric?.residentStep?.particlePingPong?.nextStep
      ?? metric?.residentSteps?.nextStep
      ?? metric?.residentStep?.sequenceIndex
  );
}

function summarizeSimulationCadence(metrics, targetIntervalMs) {
  const samples = metrics.map((metric, frameIndex) => ({
    frameIndex,
    timeS: metricSimulationTimeS(metric),
    sequence: metricResidentSequence(metric)
  }));
  const intervals = [];
  let repeatedSamples = 0;
  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1];
    const current = samples[index];
    const timeAdvanced = Number.isFinite(previous.timeS)
      && Number.isFinite(current.timeS)
      && current.timeS > previous.timeS + 1e-9;
    const sequenceAdvanced = Number.isFinite(previous.sequence)
      && Number.isFinite(current.sequence)
      && current.sequence > previous.sequence;
    if (timeAdvanced) intervals.push(current.timeS - previous.timeS);
    if (!timeAdvanced && !sequenceAdvanced) repeatedSamples += 1;
  }
  const maxIntervalS = intervals.length > 0 ? Math.max(...intervals) : null;
  const meanIntervalS = intervals.length > 0
    ? intervals.reduce((sum, value) => sum + value, 0) / intervals.length
    : null;
  return {
    schema: 'peercompute.ulg.sph-visual-simulation-cadence.v0',
    targetWallIntervalMs: targetIntervalMs,
    sampleCount: samples.length,
    advancedIntervalCount: intervals.length,
    repeatedSampleCount: repeatedSamples,
    maxIntervalS,
    meanIntervalS,
    samples,
    status: samples.length < 2
      ? 'insufficient-samples'
      : repeatedSamples === 0 && intervals.length > 0
      ? 'simulation-advanced-each-frame'
      : intervals.length > 0
      ? 'simulation-advanced-with-repeated-frames'
      : 'simulation-did-not-advance'
  };
}

async function waitForSphResidentAdvance(page, previousMetric, timeoutMs) {
  const previous = {
    timeS: metricSimulationTimeS(previousMetric),
    sequence: metricResidentSequence(previousMetric)
  };
  if (!Number.isFinite(previous.timeS) && !Number.isFinite(previous.sequence)) return false;
  try {
    await page.waitForFunction((prev) => {
      const finite = (value) => {
        const number = Number(value);
        return Number.isFinite(number) ? number : null;
      };
      const overlay = document.querySelector('#sph-phase-overlay');
      const sceneApi = overlay?.__sphScene || null;
      const residentSteps = sceneApi?.getMlsMpmResidentSteps?.() || overlay?.__mlsMpmResidentSteps || null;
      const residentStep = sceneApi?.getMlsMpmResidentStep?.() || overlay?.__mlsMpmResidentStep || residentSteps?.finalStep || null;
      const nextTime = finite(
        residentStep?.particlePingPong?.nextTime
          ?? residentSteps?.nextSphParticleState?.time
          ?? residentSteps?.nextTime
      );
      const sequence = finite(
        residentStep?.particlePingPong?.nextStep
          ?? residentSteps?.nextStep
          ?? residentStep?.sequenceIndex
      );
      return (Number.isFinite(prev.timeS) && Number.isFinite(nextTime) && nextTime > prev.timeS + 1e-9)
        || (Number.isFinite(prev.sequence) && Number.isFinite(sequence) && sequence > prev.sequence);
    }, previous, { timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}

async function assembleSphVisualSequenceArtifacts(artifactDir, label, intervalMs) {
  const safeLabel = sanitizeArtifactLabel(label);
  const fps = Math.max(1, Math.round(1000 / Math.max(intervalMs, 1)));
  const inputPattern = path.join(artifactDir, 'frame-%04d.png');
  const version = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  if (version.status !== 0) {
    return {
      ffmpegAvailable: false,
      status: 'ffmpeg-unavailable',
      webm: null,
      gif: null,
      error: version.error?.message || version.stderr || 'ffmpeg not available'
    };
  }

  const webmPath = path.join(artifactDir, `${safeLabel}.webm`);
  const gifPath = path.join(artifactDir, `${safeLabel}.gif`);
  const webm = spawnSync('ffmpeg', [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-framerate',
    String(fps),
    '-i',
    inputPattern,
    '-pix_fmt',
    'yuv420p',
    webmPath
  ], { encoding: 'utf8' });
  const gif = spawnSync('ffmpeg', [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-framerate',
    String(fps),
    '-i',
    inputPattern,
    '-vf',
    `fps=${fps},scale=iw:-1:flags=lanczos`,
    gifPath
  ], { encoding: 'utf8' });

  return {
    ffmpegAvailable: true,
    status: webm.status === 0 || gif.status === 0 ? 'assembled' : 'assembly-failed',
    fps,
    webm: webm.status === 0 ? webmPath : null,
    gif: gif.status === 0 ? gifPath : null,
    webmError: webm.status === 0 ? null : webm.stderr || webm.error?.message || null,
    gifError: gif.status === 0 ? null : gif.stderr || gif.error?.message || null
  };
}

async function extractSphVisualSequenceArtifactsFromWebm(artifactDir, label, webmPath, fps) {
  const safeLabel = sanitizeArtifactLabel(label);
  const framePattern = path.join(artifactDir, 'frame-%04d.png');
  const version = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  if (version.status !== 0) {
    return {
      ffmpegAvailable: false,
      status: 'ffmpeg-unavailable',
      fps,
      webm: webmPath,
      gif: null,
      extractedFrameCount: 0,
      frameFiles: [],
      error: version.error?.message || version.stderr || 'ffmpeg not available'
    };
  }

  const extract = spawnSync('ffmpeg', [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-i',
    webmPath,
    '-vf',
    `fps=${fps}`,
    framePattern
  ], { encoding: 'utf8' });
  const gifPath = path.join(artifactDir, `${safeLabel}.gif`);
  const gif = spawnSync('ffmpeg', [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-i',
    webmPath,
    '-vf',
    `fps=${fps},scale=iw:-1:flags=lanczos`,
    gifPath
  ], { encoding: 'utf8' });
  const frameFiles = (await readdir(artifactDir))
    .filter((file) => /^frame-\d{4}\.png$/.test(file))
    .sort();
  return {
    ffmpegAvailable: true,
    status: extract.status === 0 || gif.status === 0 ? 'assembled' : 'assembly-failed',
    fps,
    webm: webmPath,
    gif: gif.status === 0 ? gifPath : null,
    extractedFrameCount: frameFiles.length,
    frameFiles,
    extractError: extract.status === 0 ? null : extract.stderr || extract.error?.message || null,
    gifError: gif.status === 0 ? null : gif.stderr || gif.error?.message || null
  };
}

async function recordSphPhaseCanvasSequence(page, { durationMs, fps, sampleIntervalMs }) {
  return page.evaluate(async ({ durationMs: requestedDurationMs, fps: requestedFps, sampleIntervalMs: requestedSampleIntervalMs }) => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const canvas = overlay?.querySelector('canvas');
    if (!canvas?.captureStream || typeof MediaRecorder === 'undefined') {
      return { status: 'unsupported', reason: 'canvas captureStream or MediaRecorder unavailable' };
    }
    const finiteOrNull = (value) => {
      const number = Number(value);
      return Number.isFinite(number) ? number : null;
    };
    const compactDiagnostics = (diagnostics) => diagnostics ? {
      particleCount: diagnostics.particleCount ?? null,
      gridNodeCount: diagnostics.gridNodeCount ?? null,
      activeGridNodeCount: diagnostics.activeGridNodeCount ?? null,
      massDeltaKg: finiteOrNull(diagnostics.massDeltaKg),
        maxSpeedMPerS: finiteOrNull(diagnostics.maxSpeedMPerS),
        maxDisplacementM: finiteOrNull(diagnostics.maxDisplacementM),
        sourceCenterOfMassM: Array.isArray(diagnostics.sourceCenterOfMassM) ? [...diagnostics.sourceCenterOfMassM] : null,
        nextCenterOfMassM: Array.isArray(diagnostics.nextCenterOfMassM) ? [...diagnostics.nextCenterOfMassM] : null,
        centerOfMassDeltaM: Array.isArray(diagnostics.centerOfMassDeltaM) ? [...diagnostics.centerOfMassDeltaM] : null,
        sourcePositionBoundsM: diagnostics.sourcePositionBoundsM ? { ...diagnostics.sourcePositionBoundsM } : null,
        nextPositionBoundsM: diagnostics.nextPositionBoundsM ? { ...diagnostics.nextPositionBoundsM } : null,
        minVolumeRatioJ: finiteOrNull(diagnostics.minVolumeRatioJ),
      maxVolumeRatioJ: finiteOrNull(diagnostics.maxVolumeRatioJ),
      compactGpuSummaryAvailable: diagnostics.compactGpuSummaryAvailable ?? null,
      compactGpuSummaryStatus: diagnostics.compactGpuSummaryStatus ?? null,
      readbackMode: diagnostics.readbackMode ?? null,
      pressureInterfaceForceRowCount: diagnostics.pressureInterfaceForceRowCount ?? null,
      pressureInterfaceForceConsumerStatus: diagnostics.pressureInterfaceForceConsumerStatus ?? null,
      pressureInterfaceAppliedImpulseMagnitudeNSeconds: finiteOrNull(
        diagnostics.pressureInterfaceAppliedImpulseMagnitudeNSeconds
      )
    } : null;
    const sample = (frameIndex) => {
      const sceneApi = overlay?.__sphScene || null;
      const residentSteps = sceneApi?.getMlsMpmResidentSteps?.() || overlay?.__mlsMpmResidentSteps || null;
      const residentStep = sceneApi?.getMlsMpmResidentStep?.() || overlay?.__mlsMpmResidentStep || residentSteps?.finalStep || null;
      const renderState = sceneApi?.getSphResidentRenderState?.() || overlay?.__sphResidentRenderState || null;
      const surfaceDraw = sceneApi?.getSphResidentSurfaceDraw?.() || overlay?.__sphResidentSurfaceDraw || null;
      const surfaces = [];
      sceneApi?.scene?.traverse?.((node) => {
        if (node.userData?.renderMode !== 'continuous-marching-cubes') return;
        surfaces.push({
          visible: node.visible === true,
          materialKey: node.userData.materialKey ?? null,
          phase: node.userData.phase ?? null,
          renderKey: node.userData.renderKey ?? null,
          renderSource: node.userData.renderSource ?? null,
          vertexCount: node.geometry?.attributes?.position?.count ?? 0
        });
      });
      const visibleSurfaces = surfaces.filter((surface) => surface.visible);
      return {
        frameIndex,
        capturedAtMs: performance.now(),
        statusText: overlay?.querySelector('#sph-status')?.textContent ?? '',
        warningText: overlay?.querySelector('#sph-warning-bar')?.textContent ?? '',
        playText: overlay?.querySelector('#sph-play')?.textContent ?? null,
        frameCounters: overlay?.__sphFrameCounters || null,
        residentSteps: residentSteps ? {
          schema: residentSteps.schema ?? null,
          backend: residentSteps.backend ?? null,
          readbackMode: residentSteps.readbackMode ?? null,
          requestedReadbackMode: residentSteps.requestedReadbackMode ?? null,
          completedStepCount: residentSteps.completedStepCount ?? null,
          continuedFromResidentState: residentSteps.continuedFromResidentState ?? null,
          residentSourceMode: residentSteps.residentSourceMode ?? null,
          continuationAvailable: residentSteps.continuationAvailable ?? null,
          nextStep: residentSteps.nextSphParticleState?.step ?? residentSteps.nextStep ?? null,
          nextTime: finiteOrNull(residentSteps.nextSphParticleState?.time ?? residentSteps.nextTime)
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
          diagnostics: compactDiagnostics(residentStep.diagnostics)
        } : null,
        renderState: renderState ? {
          schema: renderState.schema ?? null,
          source: renderState.source ?? null,
          status: renderState.status ?? null,
          backend: renderState.backend ?? null,
          renderReadbackCadence: renderState.renderReadbackCadence || null
        } : null,
        surfaceDraw: surfaceDraw ? {
          schema: surfaceDraw.schema ?? null,
          status: surfaceDraw.status ?? null,
          vertexCount: surfaceDraw.vertexCount ?? null,
          triangleCount: surfaceDraw.triangleCount ?? null,
          activeSurfaceCount: surfaceDraw.activeSurfaceCount ?? null,
          visibleRendererBridge: surfaceDraw.visibleRendererBridge ?? null
        } : null,
        surfaces: {
          totalCount: surfaces.length,
          visibleCount: visibleSurfaces.length,
          h2oVisibleCount: visibleSurfaces.filter((surface) => String(surface.materialKey || '').toLowerCase().includes('h2o')).length,
          all: surfaces,
          visible: visibleSurfaces
        }
      };
    };
    const mimeType = MediaRecorder.isTypeSupported?.('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : MediaRecorder.isTypeSupported?.('video/webm;codecs=vp8')
      ? 'video/webm;codecs=vp8'
      : 'video/webm';
    const stream = canvas.captureStream(0);
    const [videoTrack] = stream.getVideoTracks();
    const chunks = [];
    const samples = [];
    const sampleInterval = Math.max(25, Math.round(requestedSampleIntervalMs));
    const duration = Math.max(sampleInterval, Math.round(requestedDurationMs));
    let sampleIndex = 0;
    samples.push(sample(sampleIndex));
    sampleIndex += 1;
    return new Promise((resolve) => {
      let settled = false;
      const finish = (payload) => {
        if (settled) return;
        settled = true;
        resolve(payload);
      };
      let sampleTimer = null;
      let frameTimer = null;
      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) chunks.push(event.data);
      };
      recorder.onerror = (event) => {
        if (sampleTimer != null) clearInterval(sampleTimer);
        if (frameTimer != null) clearInterval(frameTimer);
        stream.getTracks().forEach((track) => track.stop());
        finish({ status: 'error', reason: event.error?.message || String(event.error || 'MediaRecorder error'), samples });
      };
      recorder.onstop = () => {
        if (sampleTimer != null) clearInterval(sampleTimer);
        if (frameTimer != null) clearInterval(frameTimer);
        samples.push(sample(sampleIndex));
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunks, { type: mimeType });
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = String(reader.result || '');
          finish({
            status: blob.size > 0 ? 'recorded' : 'empty-recording',
            mimeType,
            durationMs: duration,
            fps: requestedFps,
            sampleIntervalMs: sampleInterval,
            byteLength: blob.size,
            webmBase64: dataUrl.includes(',') ? dataUrl.split(',').pop() : null,
            samples
          });
        };
        reader.onerror = () => finish({ status: 'error', reason: 'FileReader failed', samples });
        reader.readAsDataURL(blob);
      };
      sampleTimer = setInterval(() => {
        samples.push(sample(sampleIndex));
        sampleIndex += 1;
      }, sampleInterval);
      frameTimer = setInterval(() => {
        videoTrack?.requestFrame?.();
      }, Math.max(16, Math.round(1000 / Math.max(requestedFps, 1))));
      recorder.start(sampleInterval);
      videoTrack?.requestFrame?.();
      setTimeout(() => {
        if (recorder.state !== 'inactive') recorder.stop();
      }, duration);
    });
  }, { durationMs, fps, sampleIntervalMs });
}

async function collectSphPhaseVisualMetrics(page, frameIndex) {
  return page.evaluate((index) => {
    const finiteOrNull = (value) => {
      const number = Number(value);
      return Number.isFinite(number) ? number : null;
    };
    const compactDiagnostics = (diagnostics) => diagnostics ? {
      particleCount: diagnostics.particleCount ?? null,
      gridNodeCount: diagnostics.gridNodeCount ?? null,
      activeGridNodeCount: diagnostics.activeGridNodeCount ?? null,
      massDeltaKg: finiteOrNull(diagnostics.massDeltaKg),
        maxSpeedMPerS: finiteOrNull(diagnostics.maxSpeedMPerS),
        maxDisplacementM: finiteOrNull(diagnostics.maxDisplacementM),
        sourceCenterOfMassM: Array.isArray(diagnostics.sourceCenterOfMassM) ? [...diagnostics.sourceCenterOfMassM] : null,
        nextCenterOfMassM: Array.isArray(diagnostics.nextCenterOfMassM) ? [...diagnostics.nextCenterOfMassM] : null,
        centerOfMassDeltaM: Array.isArray(diagnostics.centerOfMassDeltaM) ? [...diagnostics.centerOfMassDeltaM] : null,
        sourcePositionBoundsM: diagnostics.sourcePositionBoundsM ? { ...diagnostics.sourcePositionBoundsM } : null,
        nextPositionBoundsM: diagnostics.nextPositionBoundsM ? { ...diagnostics.nextPositionBoundsM } : null,
        minVolumeRatioJ: finiteOrNull(diagnostics.minVolumeRatioJ),
      maxVolumeRatioJ: finiteOrNull(diagnostics.maxVolumeRatioJ),
      compactGpuSummaryAvailable: diagnostics.compactGpuSummaryAvailable ?? null,
      compactGpuSummaryStatus: diagnostics.compactGpuSummaryStatus ?? null,
      readbackMode: diagnostics.readbackMode ?? null,
      pressureInterfaceForceRowCount: diagnostics.pressureInterfaceForceRowCount ?? null,
      pressureInterfaceForceConsumerStatus: diagnostics.pressureInterfaceForceConsumerStatus ?? null,
      pressureInterfaceAppliedImpulseMagnitudeNSeconds: finiteOrNull(
        diagnostics.pressureInterfaceAppliedImpulseMagnitudeNSeconds
      ),
      residentAuthorityLedgerStatus: diagnostics.residentAuthorityLedgerStatus ?? null,
      residentAuthorityParticleOwner: diagnostics.residentAuthorityParticleOwner ?? null,
      residentAuthorityMechanicsOwner: diagnostics.residentAuthorityMechanicsOwner ?? null,
      residentAuthorityThermoOwner: diagnostics.residentAuthorityThermoOwner ?? null
    } : null;
    const transformPoint = (elements, x, y, z) => [
      elements[0] * x + elements[4] * y + elements[8] * z + elements[12],
      elements[1] * x + elements[5] * y + elements[9] * z + elements[13],
      elements[2] * x + elements[6] * y + elements[10] * z + elements[14]
    ];
    const boundsFromGeometry = (node) => {
      const geometry = node.geometry;
      const position = geometry?.attributes?.position;
      if (!geometry || !position || !node.matrixWorld?.elements) return null;
      node.updateMatrixWorld?.(true);
      const elements = node.matrixWorld.elements;
      const min = [Infinity, Infinity, Infinity];
      const max = [-Infinity, -Infinity, -Infinity];
      const add = (point) => {
        for (let axis = 0; axis < 3; axis += 1) {
          min[axis] = Math.min(min[axis], point[axis]);
          max[axis] = Math.max(max[axis], point[axis]);
        }
      };
      const drawStart = Math.max(0, Math.round(Number(geometry.drawRange?.start) || 0));
      const rawDrawCount = Number(geometry.drawRange?.count);
      const positionCount = position.count ?? 0;
      const drawCount = Number.isFinite(rawDrawCount) && rawDrawCount >= 0
        ? Math.min(positionCount - drawStart, Math.round(rawDrawCount))
        : positionCount - drawStart;
      const drawEnd = Math.min(positionCount, drawStart + Math.max(0, drawCount));
      const step = Math.max(1, Math.floor(Math.max(1, drawEnd - drawStart) / 4000));
      for (let i = drawStart; i < drawEnd; i += step) {
        add(transformPoint(elements, position.getX(i), position.getY(i), position.getZ(i)));
      }
      if (!min.every(Number.isFinite) || !max.every(Number.isFinite)) return null;
      const size = max.map((value, axis) => value - min[axis]);
      const center = max.map((value, axis) => (value + min[axis]) * 0.5);
      return {
        min,
        max,
        center,
        size,
        volume: size[0] * size[1] * size[2],
        vertexCount: Math.max(0, drawEnd - drawStart),
        vertexCapacity: positionCount,
        drawRange: { start: drawStart, count: Math.max(0, drawEnd - drawStart) }
      };
    };
    const overlay = document.querySelector('#sph-phase-overlay');
    const sceneApi = overlay?.__sphScene || null;
    const residentSteps = sceneApi?.getMlsMpmResidentSteps?.() || overlay?.__mlsMpmResidentSteps || null;
    const residentStep = sceneApi?.getMlsMpmResidentStep?.() || overlay?.__mlsMpmResidentStep || residentSteps?.finalStep || null;
    const renderState = sceneApi?.getSphResidentRenderState?.() || overlay?.__sphResidentRenderState || null;
    const surfaceDraw = sceneApi?.getSphResidentSurfaceDraw?.() || overlay?.__sphResidentSurfaceDraw || null;
    const surfaces = [];
    sceneApi?.scene?.updateMatrixWorld?.(true);
    sceneApi?.scene?.traverse?.((node) => {
      if (node.userData?.renderMode !== 'continuous-marching-cubes') return;
      const bounds = boundsFromGeometry(node);
      surfaces.push({
        name: node.name || null,
        visible: node.visible === true,
        materialKey: node.userData.materialKey ?? null,
        phase: node.userData.phase ?? null,
        renderKey: node.userData.renderKey ?? null,
        renderSource: node.userData.renderSource ?? null,
        renderLayer: node.userData.renderLayer ?? null,
        renderOrder: node.renderOrder ?? null,
        renderFieldMaxDensity: finiteOrNull(node.userData.renderFieldMaxDensity),
        renderFieldIsolation: finiteOrNull(node.userData.renderFieldIsolation),
        renderFieldShowIsolation: finiteOrNull(node.userData.renderFieldShowIsolation),
        renderFieldHideIsolation: finiteOrNull(node.userData.renderFieldHideIsolation),
        renderFieldAppliedIsolation: finiteOrNull(node.userData.renderFieldAppliedIsolation),
        renderFieldRetainedByGrace: node.userData.renderFieldRetainedByGrace ?? null,
        surfaceInactiveFrameCount: node.userData.surfaceInactiveFrameCount ?? null,
        opticalSurfaceVisibility: node.userData.opticalSurfaceVisibility ?? null,
        opticalSurfaceHiddenReason: node.userData.opticalSurfaceHiddenReason ?? null,
        opticalSurfaceRetainedByGrace: node.userData.opticalSurfaceRetainedByGrace ?? null,
        opacity: finiteOrNull(node.material?.opacity),
        transmission: finiteOrNull(node.material?.transmission),
        vertexCount: bounds?.vertexCount ?? node.geometry?.attributes?.position?.count ?? 0,
        worldBounds: bounds
      });
    });
    const visibleSurfaces = surfaces.filter((surface) => surface.visible);
    const h2oSurfaces = visibleSurfaces.filter((surface) => String(surface.materialKey || '').toLowerCase().includes('h2o'));
    return {
      frameIndex: index,
      capturedAtMs: performance.now(),
      statusText: overlay?.querySelector('#sph-status')?.textContent ?? '',
      warningText: overlay?.querySelector('#sph-warning-bar')?.textContent ?? '',
      playText: overlay?.querySelector('#sph-play')?.textContent ?? null,
      frameCounters: overlay?.__sphFrameCounters || null,
      residentSteps: residentSteps ? {
        schema: residentSteps.schema ?? null,
        backend: residentSteps.backend ?? null,
        readbackMode: residentSteps.readbackMode ?? null,
        requestedReadbackMode: residentSteps.requestedReadbackMode ?? null,
        completedStepCount: residentSteps.completedStepCount ?? null,
        continuedFromResidentState: residentSteps.continuedFromResidentState ?? null,
        residentSourceMode: residentSteps.residentSourceMode ?? null,
        continuationAvailable: residentSteps.continuationAvailable ?? null,
        nextStep: residentSteps.nextSphParticleState?.step ?? residentSteps.nextStep ?? null,
        nextTime: finiteOrNull(residentSteps.nextSphParticleState?.time ?? residentSteps.nextTime)
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
        stageTiming: residentStep.stageTiming || null,
        diagnostics: compactDiagnostics(residentStep.diagnostics)
      } : null,
      renderState: renderState ? {
        schema: renderState.schema ?? null,
        source: renderState.source ?? null,
        status: renderState.status ?? null,
        backend: renderState.backend ?? null,
        renderFieldReadback: renderState.renderFieldReadback ?? null,
        renderFieldTotalCells: renderState.renderFieldTotalCells ?? null,
        renderReadbackCadence: renderState.renderReadbackCadence || null,
        surfaceDrawStatus: renderState.surfaceDrawStatus ?? null,
        surfaceDrawVisibleRendererBridge: renderState.surfaceDrawVisibleRendererBridge ?? null
      } : null,
      surfaceDraw: surfaceDraw ? {
        schema: surfaceDraw.schema ?? null,
        status: surfaceDraw.status ?? null,
        backend: surfaceDraw.backend ?? null,
        vertexCount: surfaceDraw.vertexCount ?? null,
        triangleCount: surfaceDraw.triangleCount ?? null,
        activeSurfaceCount: surfaceDraw.activeSurfaceCount ?? null,
        visibleRendererBridge: surfaceDraw.visibleRendererBridge ?? null,
        visibleRenderSource: surfaceDraw.visibleRenderSource ?? null,
        compactionMode: surfaceDraw.compactionMode ?? null
      } : null,
      surfaces: {
        totalCount: surfaces.length,
        visibleCount: visibleSurfaces.length,
        h2oVisibleCount: h2oSurfaces.length,
        visible: visibleSurfaces
      }
    };
  }, frameIndex);
}

async function captureSphPhaseVisualSequence(page, testInfo, {
  label,
  frameCount = DEFAULT_SPH_VISUAL_FRAME_COUNT,
  intervalMs = DEFAULT_SPH_VISUAL_INTERVAL_MS,
  advanceTimeoutMs = 60_000
} = {}) {
  const safeLabel = sanitizeArtifactLabel(label);
  const artifactDir = testInfo.outputPath(safeLabel);
  await mkdir(artifactDir, { recursive: true });
  const targetFps = Math.max(1, Math.round(1000 / Math.max(intervalMs, 1)));
  const durationMs = Math.max(1000, frameCount * intervalMs);
  const recording = await recordSphPhaseCanvasSequence(page, {
    durationMs,
    fps: targetFps,
    sampleIntervalMs: intervalMs
  });
  let recorderFallbackReason = null;
  let recorderFallbackMedia = null;
  if (recording?.status === 'recorded' && recording.webmBase64) {
    const webmPath = path.join(artifactDir, `${safeLabel}.webm`);
    await writeFile(webmPath, Buffer.from(recording.webmBase64, 'base64'));
    const media = await extractSphVisualSequenceArtifactsFromWebm(artifactDir, safeLabel, webmPath, targetFps);
    if (media.extractedFrameCount > 1) {
      const timeline = {
        schema: 'peercompute.ulg.sph-visual-sequence.v0',
        label: safeLabel,
        captureMode: 'canvas-mediarecorder',
        requestedFrameCount: frameCount,
        frameCount: media.extractedFrameCount,
        intervalMs,
        durationMs: recording.durationMs,
        artifactDir,
        recording: {
          status: recording.status,
          mimeType: recording.mimeType,
          byteLength: recording.byteLength,
          fps: recording.fps,
          sampleIntervalMs: recording.sampleIntervalMs
        },
        captureCadence: summarizeCaptureCadence(recording.samples || [], intervalMs),
        simulationCadence: summarizeSimulationCadence(recording.samples || [], intervalMs),
        media,
        metrics: recording.samples || []
      };
      const timelinePath = path.join(artifactDir, `${safeLabel}-timeline.json`);
      await writeFile(timelinePath, `${JSON.stringify(timeline, null, 2)}\n`, 'utf8');
      await testInfo.attach(`${safeLabel}-timeline`, { path: timelinePath, contentType: 'application/json' });
      await testInfo.attach(`${safeLabel}-webm`, { path: webmPath, contentType: 'video/webm' });
      if (media.gif) await testInfo.attach(`${safeLabel}-gif`, { path: media.gif, contentType: 'image/gif' });
      return timeline;
    }
    recorderFallbackReason = 'mediarecorder-no-extracted-frame-sequence';
    recorderFallbackMedia = media;
  }

  const metrics = [];
  const captureCanvasFrame = async (framePath) => {
    const result = await page.evaluate(() => {
      const canvas = document.querySelector('#sph-phase-overlay canvas');
      if (!canvas || typeof canvas.toDataURL !== 'function') {
        return { ok: false, reason: 'canvas-unavailable', pngBase64: null };
      }
      try {
        const probe = document.createElement('canvas');
        probe.width = 32;
        probe.height = 20;
        const ctx = probe.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(canvas, 0, 0, probe.width, probe.height);
        const pixels = ctx.getImageData(0, 0, probe.width, probe.height).data;
        let nonBlank = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          if (pixels[i + 3] > 0 && pixels[i] + pixels[i + 1] + pixels[i + 2] > 12) nonBlank += 1;
        }
        if (nonBlank === 0) return { ok: false, reason: 'canvas-readback-blank', pngBase64: null };
        const dataUrl = canvas.toDataURL('image/png');
        return {
          ok: dataUrl.startsWith('data:image/png;base64,'),
          reason: dataUrl.startsWith('data:image/png;base64,') ? null : 'canvas-data-url-invalid',
          pngBase64: dataUrl.startsWith('data:image/png;base64,')
            ? dataUrl.slice('data:image/png;base64,'.length)
            : null
        };
      } catch (error) {
        return {
          ok: false,
          reason: error instanceof Error ? error.message : 'canvas-readback-failed',
          pngBase64: null
        };
      }
    });
    if (!result?.ok || !result.pngBase64) return { ok: false, reason: result?.reason || 'canvas-readback-failed' };
    await writeFile(framePath, Buffer.from(result.pngBase64, 'base64'));
    return { ok: true, reason: null, mode: 'canvas-to-data-url' };
  };
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const frameTimingStartMs = performance.now();
    let advanceWaitMs = 0;
    let residentAdvanceObserved = null;
    if (frameIndex > 0) {
      const advanceStartMs = performance.now();
      const advanced = await waitForSphResidentAdvance(page, metrics[metrics.length - 1], advanceTimeoutMs);
      advanceWaitMs = performance.now() - advanceStartMs;
      residentAdvanceObserved = advanced;
      if (!advanced) await page.waitForTimeout(intervalMs);
    }
    const metricsStartMs = performance.now();
    const metric = await collectSphPhaseVisualMetrics(page, frameIndex);
    const metricsCollectMs = performance.now() - metricsStartMs;
    const framePath = path.join(artifactDir, `frame-${String(frameIndex).padStart(4, '0')}.png`);
    const canvasCaptureStartMs = performance.now();
    const canvasCapture = await captureCanvasFrame(framePath);
    const canvasCaptureMs = performance.now() - canvasCaptureStartMs;
    const captureMode = canvasCapture.ok
      ? canvasCapture.mode || 'canvas-to-data-url'
      : `playwright-viewport-screenshot:${canvasCapture.reason}`;
    if (captureMode === 'playwright-viewport-screenshot') {
      await page.screenshot({ path: framePath, fullPage: false, animations: 'disabled' });
    } else if (captureMode.startsWith('playwright-viewport-screenshot:')) {
      await page.screenshot({ path: framePath, fullPage: false, animations: 'disabled' });
    }
    metrics.push({
      ...metric,
      frameFile: path.basename(framePath),
      frameCaptureMode: captureMode,
      frameTiming: {
        residentAdvanceObserved,
        advanceWaitMs,
        metricsCollectMs,
        canvasCaptureMs,
        frameTotalMs: performance.now() - frameTimingStartMs
      }
    });
  }
  const frameCaptureModes = metrics.map((metric) => metric.frameCaptureMode);
  const isCanvasCaptureMode = (mode) => mode === 'canvas-to-data-url' || mode === 'playwright-canvas-screenshot';
  const fallbackCaptureMode = frameCaptureModes.every(isCanvasCaptureMode)
    ? 'canvas-frame-capture-fallback'
    : frameCaptureModes.some(isCanvasCaptureMode)
    ? 'mixed-frame-capture-fallback'
    : 'viewport-screenshot-frame-capture-fallback';
  const media = await assembleSphVisualSequenceArtifacts(artifactDir, safeLabel, intervalMs);
  const timeline = {
    schema: 'peercompute.ulg.sph-visual-sequence.v0',
    label: safeLabel,
    captureMode: fallbackCaptureMode,
    recorderStatus: recording?.status || 'not-run',
    recorderReason: recording?.reason || recorderFallbackReason || null,
    recorderMedia: recorderFallbackMedia,
    frameCount,
    intervalMs,
    artifactDir,
    captureCadence: summarizeCaptureCadence(metrics, intervalMs),
    simulationCadence: summarizeSimulationCadence(metrics, intervalMs),
    media,
    metrics
  };
  const timelinePath = path.join(artifactDir, `${safeLabel}-timeline.json`);
  await writeFile(timelinePath, `${JSON.stringify(timeline, null, 2)}\n`, 'utf8');
  await testInfo.attach(`${safeLabel}-timeline`, { path: timelinePath, contentType: 'application/json' });
  if (media.webm) await testInfo.attach(`${safeLabel}-webm`, { path: media.webm, contentType: 'video/webm' });
  if (media.gif) await testInfo.attach(`${safeLabel}-gif`, { path: media.gif, contentType: 'image/gif' });
  return timeline;
}

async function captureSphResidentLongHorizonProbe(page, testInfo, {
  label,
  batchCount = DEFAULT_SPH_LONG_HORIZON_BATCH_COUNT,
  batchStepCount = DEFAULT_SPH_LONG_HORIZON_BATCH_STEPS,
  renderEveryBatches = 1,
  maxFrameCount = 6,
  readbackMode = 'no-full-readback',
  renderReadbackMode = 'full-parity-readback',
  renderTimeoutMs = 30_000,
  minVisibleSurfaceMotionM = 1e-5,
  maxSpeedMPerS = 50,
  minVolumeRatioJ = 0.95,
  maxVolumeRatioJ = 1.05
} = {}) {
  const safeLabel = sanitizeArtifactLabel(label);
  const artifactDir = testInfo.outputPath(safeLabel);
  await mkdir(artifactDir, { recursive: true });
  const rawTimeline = await page.evaluate(async ({
    batchCount: requestedBatchCount,
    batchStepCount: requestedBatchStepCount,
    renderEveryBatches: requestedRenderEveryBatches,
    maxFrameCount: requestedMaxFrameCount,
    readbackMode: requestedReadbackMode,
    renderReadbackMode: requestedRenderReadbackMode,
    renderTimeoutMs: requestedRenderTimeoutMs
  }) => {
    const finiteOrNull = (value) => {
      const number = Number(value);
      return Number.isFinite(number) ? number : null;
    };
    const compactDiagnostics = (diagnostics) => diagnostics ? {
      particleCount: diagnostics.particleCount ?? null,
      gridNodeCount: diagnostics.gridNodeCount ?? null,
      activeGridNodeCount: diagnostics.activeGridNodeCount ?? null,
      massDeltaKg: finiteOrNull(diagnostics.massDeltaKg),
        maxSpeedMPerS: finiteOrNull(diagnostics.maxSpeedMPerS),
        maxDisplacementM: finiteOrNull(diagnostics.maxDisplacementM),
        sourceCenterOfMassM: Array.isArray(diagnostics.sourceCenterOfMassM) ? [...diagnostics.sourceCenterOfMassM] : null,
        nextCenterOfMassM: Array.isArray(diagnostics.nextCenterOfMassM) ? [...diagnostics.nextCenterOfMassM] : null,
        centerOfMassDeltaM: Array.isArray(diagnostics.centerOfMassDeltaM) ? [...diagnostics.centerOfMassDeltaM] : null,
        sourcePositionBoundsM: diagnostics.sourcePositionBoundsM ? { ...diagnostics.sourcePositionBoundsM } : null,
        nextPositionBoundsM: diagnostics.nextPositionBoundsM ? { ...diagnostics.nextPositionBoundsM } : null,
        minVolumeRatioJ: finiteOrNull(diagnostics.minVolumeRatioJ),
      maxVolumeRatioJ: finiteOrNull(diagnostics.maxVolumeRatioJ),
      phaseMassKg: diagnostics.phaseMassKg ?? null,
      temperatureMassWeightedMeanK: finiteOrNull(diagnostics.temperatureMassWeightedMeanK),
      minTemperatureK: finiteOrNull(diagnostics.minTemperatureK),
      maxTemperatureK: finiteOrNull(diagnostics.maxTemperatureK),
      thermalReadyCount: diagnostics.thermalReadyCount ?? null,
      thermalProblemCount: diagnostics.thermalProblemCount ?? null,
      compactGpuSummaryAvailable: diagnostics.compactGpuSummaryAvailable ?? null,
      compactGpuSummaryStatus: diagnostics.compactGpuSummaryStatus ?? null,
      readbackMode: diagnostics.readbackMode ?? null,
      pressureInterfaceForceRowCount: diagnostics.pressureInterfaceForceRowCount ?? null,
      pressureInterfaceForceConsumerStatus: diagnostics.pressureInterfaceForceConsumerStatus ?? null,
      pressureInterfaceAppliedImpulseMagnitudeNSeconds: finiteOrNull(
        diagnostics.pressureInterfaceAppliedImpulseMagnitudeNSeconds
      ),
      residentAuthorityLedgerStatus: diagnostics.residentAuthorityLedgerStatus ?? null,
      residentAuthorityParticleOwner: diagnostics.residentAuthorityParticleOwner ?? null,
      residentAuthorityMechanicsOwner: diagnostics.residentAuthorityMechanicsOwner ?? null,
      residentAuthorityThermoOwner: diagnostics.residentAuthorityThermoOwner ?? null
    } : null;
    const transformPoint = (elements, x, y, z) => [
      elements[0] * x + elements[4] * y + elements[8] * z + elements[12],
      elements[1] * x + elements[5] * y + elements[9] * z + elements[13],
      elements[2] * x + elements[6] * y + elements[10] * z + elements[14]
    ];
    const boundsFromGeometry = (node) => {
      const geometry = node.geometry;
      const position = geometry?.attributes?.position;
      if (!geometry || !position || !node.matrixWorld?.elements) return null;
      node.updateMatrixWorld?.(true);
      const elements = node.matrixWorld.elements;
      const drawStart = Math.max(0, Math.round(Number(geometry.drawRange?.start) || 0));
      const rawDrawCount = Number(geometry.drawRange?.count);
      const drawCount = Number.isFinite(rawDrawCount) && rawDrawCount >= 0
        ? Math.min(position.count - drawStart, Math.round(rawDrawCount))
        : position.count - drawStart;
      const drawEnd = Math.min(position.count, drawStart + Math.max(0, drawCount));
      if (drawEnd <= drawStart) return null;
      const min = [Infinity, Infinity, Infinity];
      const max = [-Infinity, -Infinity, -Infinity];
      const add = (point) => {
        for (let axis = 0; axis < 3; axis += 1) {
          min[axis] = Math.min(min[axis], point[axis]);
          max[axis] = Math.max(max[axis], point[axis]);
        }
      };
      const step = Math.max(1, Math.floor(Math.max(1, drawEnd - drawStart) / 4000));
      for (let i = drawStart; i < drawEnd; i += step) {
        add(transformPoint(elements, position.getX(i), position.getY(i), position.getZ(i)));
      }
      if (!min.every(Number.isFinite) || !max.every(Number.isFinite)) return null;
      const size = max.map((value, axis) => value - min[axis]);
      const center = max.map((value, axis) => (value + min[axis]) * 0.5);
      return { min, max, center, size, volume: size[0] * size[1] * size[2], vertexCount: drawEnd - drawStart };
    };
    const captureCanvasPng = () => {
      const canvas = document.querySelector('#sph-phase-overlay canvas');
      if (!canvas || typeof canvas.toDataURL !== 'function') {
        return { ok: false, reason: 'canvas-unavailable', pngBase64: null };
      }
      try {
        const dataUrl = canvas.toDataURL('image/png');
        return {
          ok: dataUrl.startsWith('data:image/png;base64,'),
          reason: dataUrl.startsWith('data:image/png;base64,') ? null : 'canvas-data-url-invalid',
          pngBase64: dataUrl.startsWith('data:image/png;base64,')
            ? dataUrl.slice('data:image/png;base64,'.length)
            : null
        };
      } catch (error) {
        return {
          ok: false,
          reason: error instanceof Error ? error.message : 'canvas-capture-failed',
          pngBase64: null
        };
      }
    };
    const withTimeout = (promise, timeoutMs, label) => new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(label)), Math.max(1, Math.round(timeoutMs)));
      Promise.resolve(promise).then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error) => {
          clearTimeout(timer);
          reject(error);
        }
      );
    });
    const surfaceSnapshot = (sceneApi) => {
      const surfaces = [];
      sceneApi?.scene?.updateMatrixWorld?.(true);
      sceneApi?.scene?.traverse?.((node) => {
        if (node.userData?.renderMode !== 'continuous-marching-cubes') return;
        const bounds = boundsFromGeometry(node);
        surfaces.push({
          name: node.name || null,
          visible: node.visible === true,
          materialKey: node.userData.materialKey ?? null,
          phase: node.userData.phase ?? null,
          renderKey: node.userData.renderKey ?? null,
          renderSource: node.userData.renderSource ?? null,
          renderLayer: node.userData.renderLayer ?? null,
          vertexCount: bounds?.vertexCount ?? node.geometry?.attributes?.position?.count ?? 0,
          worldBounds: bounds
        });
      });
      const visible = surfaces.filter((surface) => surface.visible);
      return {
        totalCount: surfaces.length,
        visibleCount: visible.length,
        h2oVisibleCount: visible.filter((surface) => String(surface.materialKey || '').toLowerCase().includes('h2o')).length,
        visible
      };
    };
    const overlay = document.querySelector('#sph-phase-overlay');
    const sceneApi = overlay?.__sphScene || null;
    if (!overlay || !sceneApi?.refreshMlsMpmResidentSteps) {
      return {
        schema: 'peercompute.ulg.sph-resident-long-horizon-probe.v0',
        status: 'blocked',
        reason: 'sph scene resident API unavailable',
        metrics: []
      };
    }
    const normalizedBatchCount = Math.max(1, Math.round(Number(requestedBatchCount) || 1));
    const normalizedBatchStepCount = Math.max(1, Math.round(Number(requestedBatchStepCount) || 1));
    const normalizedRenderEvery = Math.max(1, Math.round(Number(requestedRenderEveryBatches) || 1));
    const normalizedMaxFrameCount = Math.max(0, Math.round(Number(requestedMaxFrameCount) || 0));
    const normalizedReadbackMode = requestedReadbackMode === 'full-parity-readback'
      ? 'full-parity-readback'
      : 'no-full-readback';
    const normalizedRenderReadbackMode = requestedRenderReadbackMode === 'no-full-readback'
      ? 'no-full-readback'
      : 'full-parity-readback';
    const normalizedRenderTimeoutMs = Math.max(1_000, Math.round(Number(requestedRenderTimeoutMs) || 30_000));
    const validationSurfaceOverlayPolicy = {
      schema: 'peercompute.ulg.sph-resident-surface-draw-overlay-policy.v0',
      mode: 'validation-readback',
      enabled: false,
      status: 'surface-draw-overlay-validation-disabled',
      reason: 'validation forced Three/MarchingCubes render-field readback'
    };
    const metrics = [];
    const errors = [];
    let frameCaptureCount = 0;
    let execution = sceneApi.getMlsMpmResidentSteps?.() || overlay.__mlsMpmResidentSteps || null;
    const sample = (batchIndex, phase, { renderRequested = false, batchMs = null } = {}) => {
      const steps = sceneApi.getMlsMpmResidentSteps?.() || overlay.__mlsMpmResidentSteps || execution || null;
      const residentStep = sceneApi.getMlsMpmResidentStep?.() || overlay.__mlsMpmResidentStep || steps?.finalStep || null;
      const renderState = sceneApi.getSphResidentRenderState?.() || overlay.__sphResidentRenderState || null;
      const surfaceDraw = sceneApi.getSphResidentSurfaceDraw?.() || overlay.__sphResidentSurfaceDraw || null;
      const frame = renderRequested && frameCaptureCount < normalizedMaxFrameCount
        ? captureCanvasPng()
        : null;
      if (frame?.ok) frameCaptureCount += 1;
      return {
        batchIndex,
        phase,
        capturedAtMs: performance.now(),
        batchMs,
        requestedBatchStepCount: normalizedBatchStepCount,
        cumulativeRequestedSubsteps: batchIndex * normalizedBatchStepCount,
        statusText: overlay.querySelector('#sph-status')?.textContent ?? '',
        warningText: overlay.querySelector('#sph-warning-bar')?.textContent ?? '',
        residentSteps: steps ? {
          schema: steps.schema ?? null,
          backend: steps.backend ?? null,
          status: steps.status ?? null,
          stepCount: steps.stepCount ?? null,
          completedStepCount: steps.completedStepCount ?? null,
          readbackMode: steps.readbackMode ?? null,
          requestedReadbackMode: steps.requestedReadbackMode ?? null,
          continuedFromResidentState: steps.continuedFromResidentState ?? null,
          continuationAvailable: steps.continuationAvailable ?? null,
          residentSourceMode: steps.residentSourceMode ?? null,
          nextParticleBufferMode: steps.nextParticleBufferMode ?? null,
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
          diagnostics: compactDiagnostics(residentStep.diagnostics)
        } : null,
          renderState: renderState ? {
            schema: renderState.schema ?? null,
            status: renderState.status ?? null,
            source: renderState.source ?? null,
            backend: renderState.backend ?? null,
            renderFieldReadback: renderState.renderFieldReadback ?? null,
            renderFieldSurfaceCount: renderState.renderFieldSurfaceCount ?? null,
            renderFieldEmptyRetryReadback: renderState.renderFieldEmptyRetryReadback ?? null,
            renderFieldEmptyRetryReason: renderState.renderFieldEmptyRetryReason ?? null,
            renderRowsReadback: renderState.renderRowsReadback ?? null,
            renderRowsReadbackMode: renderState.renderRowsReadbackMode ?? null,
            renderRowsGpuHandoffCopy: renderState.renderRowsGpuHandoffCopy ?? null,
            renderRowsHandoffMode: renderState.renderRowsHandoffMode ?? null,
            renderRowsReadbackByteLength: renderState.renderRowsReadbackByteLength ?? null,
            renderRowsDecodedMaterialPhaseCounts: renderState.renderRowsDecodedMaterialPhaseCounts ?? null,
            renderRowsDecodedSampleRows: renderState.renderRowsDecodedSampleRows ?? null,
            surfaceDrawStatus: renderState.surfaceDrawStatus ?? null,
            renderReadbackCadence: renderState.renderReadbackCadence || null
          } : null,
        surfaceDraw: surfaceDraw ? {
          schema: surfaceDraw.schema ?? null,
          status: surfaceDraw.status ?? null,
          backend: surfaceDraw.backend ?? null,
          vertexCount: surfaceDraw.vertexCount ?? null,
          triangleCount: surfaceDraw.triangleCount ?? null,
          activeSurfaceCount: surfaceDraw.activeSurfaceCount ?? null,
          visibleRendererBridge: surfaceDraw.visibleRendererBridge ?? null,
          visibleRenderSource: surfaceDraw.visibleRenderSource ?? null
        } : null,
        surfaces: surfaceSnapshot(sceneApi),
        frame
      };
    };

    metrics.push(sample(0, 'initial', { renderRequested: true, batchMs: 0 }));
    for (let batchIndex = 1; batchIndex <= normalizedBatchCount; batchIndex += 1) {
      const startedAtMs = performance.now();
      try {
        execution = await sceneApi.refreshMlsMpmResidentSteps({
          preferWebGpu: true,
          stepCount: normalizedBatchStepCount,
          readbackMode: normalizedReadbackMode,
          continueFromResidentState: Boolean(execution?.continuationAvailable),
          force: true
        });
        overlay.__mlsMpmResidentSteps = execution;
        overlay.__mlsMpmResidentStep = sceneApi.getMlsMpmResidentStep?.() || execution?.finalStep || null;
        const shouldRender = batchIndex % normalizedRenderEvery === 0 || batchIndex === normalizedBatchCount;
        if (shouldRender) {
          const renderState = await withTimeout(sceneApi.refreshSphResidentRenderState({
            preferWebGpu: true,
            residentSteps: execution,
            renderFieldReadbackMode: normalizedRenderReadbackMode,
            renderRowsReadbackMode: normalizedRenderReadbackMode,
            surfaceDrawOverlayPolicyOverride: validationSurfaceOverlayPolicy,
            skipPressureInterfaceRefresh: true
          }), normalizedRenderTimeoutMs, `resident render validation timed out after ${normalizedRenderTimeoutMs}ms`);
          overlay.__sphResidentRenderState = renderState;
          overlay.__sphResidentSurfaceDraw = sceneApi.getSphResidentSurfaceDraw?.() || null;
          await new Promise((resolve) => requestAnimationFrame(resolve));
        }
        metrics.push(sample(batchIndex, 'resident-batch', {
          renderRequested: shouldRender,
          batchMs: performance.now() - startedAtMs
        }));
      } catch (error) {
        errors.push({
          batchIndex,
          message: error instanceof Error ? error.message : String(error)
        });
        metrics.push(sample(batchIndex, 'resident-batch-error', {
          renderRequested: false,
          batchMs: performance.now() - startedAtMs
        }));
        break;
      }
    }
    return {
      schema: 'peercompute.ulg.sph-resident-long-horizon-probe.v0',
      status: errors.length ? 'completed-with-errors' : 'complete',
      batchCount: normalizedBatchCount,
      batchStepCount: normalizedBatchStepCount,
      requestedSubsteps: normalizedBatchCount * normalizedBatchStepCount,
      readbackMode: normalizedReadbackMode,
      renderReadbackMode: normalizedRenderReadbackMode,
      renderTimeoutMs: normalizedRenderTimeoutMs,
      renderEveryBatches: normalizedRenderEvery,
      frameCaptureCount,
      errors,
      metrics,
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  }, {
    batchCount,
    batchStepCount,
    renderEveryBatches,
    maxFrameCount,
    readbackMode,
    renderReadbackMode,
    renderTimeoutMs
  });

  const metrics = Array.isArray(rawTimeline.metrics) ? rawTimeline.metrics : [];
  let writtenFrameCount = 0;
  for (const metric of metrics) {
    const frame = metric.frame || null;
    if (!frame?.ok || !frame.pngBase64) {
      if (frame) metric.frameCaptureMode = frame.reason ? `canvas-capture-failed:${frame.reason}` : 'canvas-capture-skipped';
      delete metric.frame;
      continue;
    }
    const framePath = path.join(artifactDir, `frame-${String(writtenFrameCount).padStart(4, '0')}.png`);
    await writeFile(framePath, Buffer.from(frame.pngBase64, 'base64'));
    metric.frameFile = path.basename(framePath);
    metric.frameCaptureMode = 'canvas-to-data-url';
    delete metric.frame;
    writtenFrameCount += 1;
  }

  const diagnostics = metrics.map((metric) => metric.residentStep?.diagnostics).filter(Boolean);
  const finiteDiagnostics = (key) => diagnostics
    .map((diagnostic) => Number(diagnostic?.[key]))
    .filter(Number.isFinite);
  const maxSpeedSeries = finiteDiagnostics('maxSpeedMPerS');
  const maxDisplacementSeries = finiteDiagnostics('maxDisplacementM');
  const minVolumeSeries = finiteDiagnostics('minVolumeRatioJ');
  const maxVolumeSeries = finiteDiagnostics('maxVolumeRatioJ');
  const pressureImpulseSeries = finiteDiagnostics('pressureInterfaceAppliedImpulseMagnitudeNSeconds');
  const activeNodeSeries = diagnostics
    .map((diagnostic) => Number(diagnostic?.activeGridNodeCount))
    .filter(Number.isFinite);
  const issues = [];
  const maxSpeedObservedMPerS = maxSpeedSeries.length ? Math.max(...maxSpeedSeries) : null;
  const maxDisplacementObservedM = maxDisplacementSeries.length ? Math.max(...maxDisplacementSeries) : null;
  const minVolumeObservedJ = minVolumeSeries.length ? Math.min(...minVolumeSeries) : null;
  const maxVolumeObservedJ = maxVolumeSeries.length ? Math.max(...maxVolumeSeries) : null;
  const maxPressureImpulseNSeconds = pressureImpulseSeries.length ? Math.max(...pressureImpulseSeries) : null;
  const minActiveGridNodeCount = activeNodeSeries.length ? Math.min(...activeNodeSeries) : null;
  const renderFieldReadbackSampleCount = metrics.filter((metric) => metric.renderState?.renderFieldReadback === true).length;
  const visibleSurfaceCenterTracks = new Map();
  for (const metric of metrics) {
    for (const surface of metric.surfaces?.visible || []) {
      const centerY = Number(surface.worldBounds?.center?.[1]);
      if (!Number.isFinite(centerY)) continue;
      const key = [
        surface.renderKey || surface.name || surface.materialKey || 'surface',
        surface.phase || 'unknown',
        surface.renderLayer ?? 'layer'
      ].join(':');
      const track = visibleSurfaceCenterTracks.get(key) || [];
      track.push(centerY);
      visibleSurfaceCenterTracks.set(key, track);
    }
  }
  const visibleSurfaceCenterMotionSeries = [...visibleSurfaceCenterTracks.values()]
    .filter((track) => track.length > 1)
    .map((track) => Math.max(...track) - Math.min(...track))
    .filter(Number.isFinite);
  const maxVisibleSurfaceCenterMotionM = visibleSurfaceCenterMotionSeries.length
    ? Math.max(...visibleSurfaceCenterMotionSeries)
    : null;
  if (rawTimeline.status !== 'complete') issues.push(`probe-status:${rawTimeline.status}`);
  if (diagnostics.length === 0) issues.push('missing-resident-diagnostics');
  if (maxSpeedObservedMPerS == null) issues.push('missing-max-speed');
  if (maxSpeedObservedMPerS != null && maxSpeedObservedMPerS > maxSpeedMPerS) issues.push(`max-speed>${maxSpeedMPerS}`);
  if (maxDisplacementObservedM == null || maxDisplacementObservedM <= 0) issues.push('no-positive-displacement');
  if (rawTimeline.renderReadbackMode === 'full-parity-readback' && renderFieldReadbackSampleCount === 0) {
    issues.push('missing-render-field-readback');
  }
  if (
    writtenFrameCount > 1
    && maxSpeedObservedMPerS != null
    && maxSpeedObservedMPerS > 0.01
    && (maxVisibleSurfaceCenterMotionM == null || maxVisibleSurfaceCenterMotionM <= minVisibleSurfaceMotionM)
  ) {
    issues.push(`stale-visible-surface-motion<=${minVisibleSurfaceMotionM}`);
  }
  if (minActiveGridNodeCount != null && minActiveGridNodeCount <= 0) issues.push('inactive-grid-nodes');
  if (minVolumeObservedJ != null && minVolumeObservedJ < minVolumeRatioJ) issues.push(`min-J<${minVolumeRatioJ}`);
  if (maxVolumeObservedJ != null && maxVolumeObservedJ > maxVolumeRatioJ) issues.push(`max-J>${maxVolumeRatioJ}`);
  if (maxPressureImpulseNSeconds != null && maxPressureImpulseNSeconds > 1e-5) {
    issues.push('same-material-pressure-impulse-applied');
  }
  if (!metrics.some((metric) => (metric.surfaces?.visibleCount ?? 0) > 0)) issues.push('no-visible-surface-samples');
  if (!metrics.some((metric) => (metric.surfaces?.h2oVisibleCount ?? 0) > 0)) issues.push('no-visible-h2o-surface-samples');

  const media = writtenFrameCount > 1
    ? await assembleSphVisualSequenceArtifacts(artifactDir, safeLabel, 250)
    : {
        ffmpegAvailable: false,
        status: 'insufficient-frame-samples',
        webm: null,
        gif: null,
        frameCount: writtenFrameCount
      };
  const timeline = {
    ...rawTimeline,
    label: safeLabel,
    artifactDir,
    frameCount: writtenFrameCount,
    captureMode: writtenFrameCount > 0 ? 'long-horizon-canvas-samples' : 'long-horizon-metrics-only',
    media,
    analysis: {
      schema: 'peercompute.ulg.sph-resident-long-horizon-analysis.v0',
      status: issues.length ? 'long-horizon-probe-unstable' : 'long-horizon-probe-stable',
      issues,
      thresholds: {
        maxSpeedMPerS,
        minVisibleSurfaceMotionM,
        minVolumeRatioJ,
        maxVolumeRatioJ,
        sameMaterialPressureImpulseToleranceNSeconds: 1e-5
      },
      maxSpeedObservedMPerS,
      maxDisplacementObservedM,
      renderFieldReadbackSampleCount,
      maxVisibleSurfaceCenterMotionM,
      minActiveGridNodeCount,
      minVolumeObservedJ,
      maxVolumeObservedJ,
      maxPressureImpulseNSeconds,
      visibleSurfaceSampleCount: metrics.filter((metric) => (metric.surfaces?.visibleCount ?? 0) > 0).length,
      h2oVisibleSurfaceSampleCount: metrics.filter((metric) => (metric.surfaces?.h2oVisibleCount ?? 0) > 0).length
    }
  };
  const timelinePath = path.join(artifactDir, `${safeLabel}-timeline.json`);
  await writeFile(timelinePath, `${JSON.stringify(timeline, null, 2)}\n`, 'utf8');
  await testInfo.attach(`${safeLabel}-timeline`, { path: timelinePath, contentType: 'application/json' });
  if (media.webm) await testInfo.attach(`${safeLabel}-webm`, { path: media.webm, contentType: 'video/webm' });
  if (media.gif) await testInfo.attach(`${safeLabel}-gif`, { path: media.gif, contentType: 'image/gif' });
  return timeline;
}

test('SPH surface draw WebGPU shader compacts vertex rows in Chromium', async ({ page }) => {
  test.setTimeout(30_000);
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const renderModule = await import('/src/runtime/sph/sphRenderGpuKernel.js');
    const opticalModule = await import('/src/runtime/material/opticalGpuBuffers.js');
    const sceneModule = await import('/src/visualization/sphPhaseScene.js');
    if (!navigator.gpu) {
      return { status: 'webgpu-unavailable', reason: 'navigator.gpu unavailable' };
    }
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      return { status: 'webgpu-unavailable', reason: 'requestAdapter returned null' };
    }
    const device = await adapter.requestDevice();
    try {
      const {
        buildSphRenderSurfaceDrawMetadataWebGpu,
        deriveSphRenderSurfaceDrawMetadataCpu,
        SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_UINTS,
        SPH_GPU_RENDER_SURFACE_DRAW_FLOATS,
        SPH_GPU_RENDER_SURFACE_VERTEX_FLOATS,
        ULG_SPH_GPU_RENDER_SURFACE_VERTICES_SCHEMA
      } = renderModule;
      const {
        GPU_PHASE_IDS,
        buildOpticalGpuTable,
        stableOpticalMaterialId,
        uploadOpticalGpuTable
      } = opticalModule;
      const {
        SPH_RESIDENT_SURFACE_DRAW_DEPTH_FORMAT,
        SPH_RESIDENT_SURFACE_DRAW_OIT_ACCUM_FORMAT,
        SPH_RESIDENT_SURFACE_DRAW_OIT_COMPOSITE_WGSL,
        SPH_RESIDENT_SURFACE_DRAW_OIT_REVEAL_FORMAT,
        SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL
      } = sceneModule;
      const materialId = stableOpticalMaterialId('Au');
      const opticalStateId = 42;
      const vertexRows = new Float32Array(3 * SPH_GPU_RENDER_SURFACE_VERTEX_FLOATS);
      vertexRows.set([
        1, materialId, GPU_PHASE_IDS.solid, 0,
        0, 0, 0, 0,
        0, 0, 1, opticalStateId,
        20, 20, 0, 1
      ], 0);
      vertexRows.set([
        1, materialId, GPU_PHASE_IDS.solid, 0,
        1, 1, 0, 0,
        0, 0, 1, opticalStateId,
        20, 20, 0, 1
      ], SPH_GPU_RENDER_SURFACE_VERTEX_FLOATS);
      vertexRows.set([
        1, materialId, GPU_PHASE_IDS.solid, 0,
        2, 0, 1, 0,
        0, 0, 1, opticalStateId,
        20, 20, 0, 1
      ], SPH_GPU_RENDER_SURFACE_VERTEX_FLOATS * 2);
      const surfaceVertices = {
        schema: ULG_SPH_GPU_RENDER_SURFACE_VERTICES_SCHEMA,
        backend: 'browser-fixture',
        surfaceExtractionMethod: 'tetrahedralized-render-field-cubes',
        compactionMode: 'browser-compact-fixture',
        surfaceCount: 2,
        activeCellCount: 1,
        triangleCount: 1,
        vertexCount: 3,
        rowStrideFloats: SPH_GPU_RENDER_SURFACE_VERTEX_FLOATS,
        vertexRows,
        surfaces: [
          {
            surfaceKey: 'empty|solid',
            material: 'empty',
            phase: 'solid',
            renderKey: 'empty',
            surfaceIndex: 0,
            materialId,
            phaseId: GPU_PHASE_IDS.solid,
            opticalStateId: 0,
            resolution: 2,
            isolation: 20,
            fieldOffset: 0,
            fieldCellCount: 8
          },
          {
            surfaceKey: 'Au|solid',
            material: 'Au',
            phase: 'solid',
            renderKey: 'Au',
            surfaceIndex: 1,
            materialId,
            phaseId: GPU_PHASE_IDS.solid,
            opticalStateId,
            resolution: 2,
            isolation: 20,
            fieldOffset: 8,
            fieldCellCount: 8
          }
        ]
      };
      const cpuReference = deriveSphRenderSurfaceDrawMetadataCpu(surfaceVertices);
      const webgpu = await buildSphRenderSurfaceDrawMetadataWebGpu({
        device,
        surfaceVertices
      });
      let overlayStatus = 'overlay-not-run';
      let overlayVertexBuffer = null;
      let overlayIndirectBuffer = null;
      let overlayCameraBuffer = null;
      let overlayTexture = null;
      let overlayDepthTexture = null;
      let overlayOpticalBuffers = null;
      let overlayOpticalRecordCount = 0;
      let overlayDepthFormat = null;
      let overlayOitStatus = 'oit-not-run';
      let overlayOitAccumFormat = null;
      let overlayOitRevealFormat = null;
      try {
        const overlayOpticalTable = buildOpticalGpuTable([{ material: 'Au', phase: 'solid' }]);
        overlayOpticalBuffers = uploadOpticalGpuTable(device, overlayOpticalTable);
        overlayOpticalRecordCount = overlayOpticalTable.recordCount;
        overlayDepthFormat = SPH_RESIDENT_SURFACE_DRAW_DEPTH_FORMAT;
        const format = 'rgba8unorm';
        overlayTexture = device.createTexture({
          label: 'test-overlay-target',
          size: [32, 32],
          format,
          usage: GPUTextureUsage.RENDER_ATTACHMENT
        });
        overlayDepthTexture = device.createTexture({
          label: 'test-overlay-depth',
          size: [32, 32],
          format: SPH_RESIDENT_SURFACE_DRAW_DEPTH_FORMAT,
          usage: GPUTextureUsage.RENDER_ATTACHMENT
        });
        overlayVertexBuffer = device.createBuffer({
          label: 'test-overlay-surface-vertices',
          size: vertexRows.byteLength,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });
        device.queue.writeBuffer(overlayVertexBuffer, 0, vertexRows);
        overlayIndirectBuffer = device.createBuffer({
          label: 'test-overlay-surface-indirect',
          size: cpuReference.drawIndirectRows.byteLength,
          usage: GPUBufferUsage.INDIRECT | GPUBufferUsage.COPY_DST
        });
        device.queue.writeBuffer(overlayIndirectBuffer, 0, cpuReference.drawIndirectRows);
        overlayCameraBuffer = device.createBuffer({
          label: 'test-overlay-camera',
          size: 16 * Float32Array.BYTES_PER_ELEMENT,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        device.queue.writeBuffer(overlayCameraBuffer, 0, new Float32Array([
          1, 0, 0, 0,
          0, 1, 0, 0,
          0, 0, 1, 0,
          0, 0, 0, 1
        ]));
        const overlayModule = device.createShaderModule({
          label: 'test-overlay-shader',
          code: SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL
        });
        const overlayOitCompositeModule = device.createShaderModule({
          label: 'test-overlay-oit-composite-shader',
          code: SPH_RESIDENT_SURFACE_DRAW_OIT_COMPOSITE_WGSL
        });
        const overlayBindGroupLayout = device.createBindGroupLayout({
          label: 'test-overlay-bind-group-layout',
          entries: [
            {
              binding: 0,
              visibility: GPUShaderStage.VERTEX,
              buffer: { type: 'read-only-storage' }
            },
            {
              binding: 1,
              visibility: GPUShaderStage.VERTEX,
              buffer: { type: 'uniform' }
            },
            {
              binding: 2,
              visibility: GPUShaderStage.FRAGMENT,
              buffer: { type: 'read-only-storage' }
            },
            {
              binding: 3,
              visibility: GPUShaderStage.FRAGMENT,
              buffer: { type: 'read-only-storage' }
            }
          ]
        });
        const overlayPipelineLayout = device.createPipelineLayout({
          label: 'test-overlay-pipeline-layout',
          bindGroupLayouts: [overlayBindGroupLayout]
        });
        const createOverlayPipeline = ({
          label,
          depthWriteEnabled,
          fragmentEntryPoint = 'fs_main',
          targets = [{
            format,
            blend: {
              color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
              alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
            }
          }]
        }) => device.createRenderPipeline({
          label,
          layout: overlayPipelineLayout,
          vertex: { module: overlayModule, entryPoint: 'vs_main' },
          fragment: {
            module: overlayModule,
            entryPoint: fragmentEntryPoint,
            targets
          },
          primitive: { topology: 'triangle-list', cullMode: 'none' },
          depthStencil: {
            format: SPH_RESIDENT_SURFACE_DRAW_DEPTH_FORMAT,
            depthWriteEnabled,
            depthCompare: 'less-equal'
          }
        });
        const overlayOpaquePipeline = createOverlayPipeline({
          label: 'test-overlay-pipeline-opaque-depth',
          depthWriteEnabled: true
        });
        const overlayTransparentPipeline = createOverlayPipeline({
          label: 'test-overlay-pipeline-transparent-depth-test',
          depthWriteEnabled: false
        });
        const overlayOitPipeline = createOverlayPipeline({
          label: 'test-overlay-pipeline-transparent-oit',
          depthWriteEnabled: false,
          fragmentEntryPoint: 'fs_oit_main',
          targets: [
            {
              format: SPH_RESIDENT_SURFACE_DRAW_OIT_ACCUM_FORMAT,
              blend: {
                color: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
                alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' }
              }
            },
            {
              format: SPH_RESIDENT_SURFACE_DRAW_OIT_REVEAL_FORMAT,
              blend: {
                color: { srcFactor: 'zero', dstFactor: 'one-minus-src-alpha', operation: 'add' },
                alpha: { srcFactor: 'zero', dstFactor: 'one-minus-src-alpha', operation: 'add' }
              }
            }
          ]
        });
        const overlayOitCompositeBindGroupLayout = device.createBindGroupLayout({
          label: 'test-overlay-oit-composite-bgl',
          entries: [
            { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
            { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
            { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } }
          ]
        });
        const overlayOitCompositePipeline = device.createRenderPipeline({
          label: 'test-overlay-oit-composite-pipeline',
          layout: device.createPipelineLayout({
            label: 'test-overlay-oit-composite-layout',
            bindGroupLayouts: [overlayOitCompositeBindGroupLayout]
          }),
          vertex: { module: overlayOitCompositeModule, entryPoint: 'vs_main' },
          fragment: {
            module: overlayOitCompositeModule,
            entryPoint: 'fs_main',
            targets: [{
              format,
              blend: {
                color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
                alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
              }
            }]
          },
          primitive: { topology: 'triangle-list', cullMode: 'none' }
        });
        overlayOitAccumFormat = SPH_RESIDENT_SURFACE_DRAW_OIT_ACCUM_FORMAT;
        overlayOitRevealFormat = SPH_RESIDENT_SURFACE_DRAW_OIT_REVEAL_FORMAT;
        const overlayBindGroup = device.createBindGroup({
          layout: overlayBindGroupLayout,
          entries: [
            { binding: 0, resource: { buffer: overlayVertexBuffer } },
            { binding: 1, resource: { buffer: overlayCameraBuffer } },
            { binding: 2, resource: { buffer: overlayOpticalBuffers.recordsBuffer } },
            { binding: 3, resource: { buffer: overlayOpticalBuffers.spectralSamplesBuffer } }
          ]
        });
        const overlayEncoder = device.createCommandEncoder();
        const overlayPass = overlayEncoder.beginRenderPass({
          colorAttachments: [{
            view: overlayTexture.createView(),
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
            loadOp: 'clear',
            storeOp: 'store'
          }],
          depthStencilAttachment: {
            view: overlayDepthTexture.createView(),
            depthClearValue: 1,
            depthLoadOp: 'clear',
            depthStoreOp: 'store'
          }
        });
        overlayPass.setPipeline(overlayOpaquePipeline);
        overlayPass.setBindGroup(0, overlayBindGroup);
        overlayPass.drawIndirect(
          overlayIndirectBuffer,
          SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_UINTS * Uint32Array.BYTES_PER_ELEMENT
        );
        overlayPass.setPipeline(overlayTransparentPipeline);
        overlayPass.end();
        const oitAccumTexture = device.createTexture({
          label: 'test-overlay-oit-accum',
          size: [32, 32],
          format: SPH_RESIDENT_SURFACE_DRAW_OIT_ACCUM_FORMAT,
          usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
        });
        const oitRevealTexture = device.createTexture({
          label: 'test-overlay-oit-reveal',
          size: [32, 32],
          format: SPH_RESIDENT_SURFACE_DRAW_OIT_REVEAL_FORMAT,
          usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
        });
        const oitPass = overlayEncoder.beginRenderPass({
          colorAttachments: [
            {
              view: oitAccumTexture.createView(),
              clearValue: { r: 0, g: 0, b: 0, a: 0 },
              loadOp: 'clear',
              storeOp: 'store'
            },
            {
              view: oitRevealTexture.createView(),
              clearValue: { r: 1, g: 1, b: 1, a: 1 },
              loadOp: 'clear',
              storeOp: 'store'
            }
          ],
          depthStencilAttachment: {
            view: overlayDepthTexture.createView(),
            depthLoadOp: 'load',
            depthStoreOp: 'store'
          }
        });
        oitPass.setPipeline(overlayOitPipeline);
        oitPass.setBindGroup(0, overlayBindGroup);
        oitPass.drawIndirect(
          overlayIndirectBuffer,
          SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_UINTS * Uint32Array.BYTES_PER_ELEMENT
        );
        oitPass.end();
        const oitCompositeBindGroup = device.createBindGroup({
          layout: overlayOitCompositeBindGroupLayout,
          entries: [
            { binding: 0, resource: oitAccumTexture.createView() },
            { binding: 1, resource: oitRevealTexture.createView() },
            { binding: 2, resource: device.createSampler({ magFilter: 'linear', minFilter: 'linear' }) }
          ]
        });
        const compositePass = overlayEncoder.beginRenderPass({
          colorAttachments: [{
            view: overlayTexture.createView(),
            loadOp: 'load',
            storeOp: 'store'
          }]
        });
        compositePass.setPipeline(overlayOitCompositePipeline);
        compositePass.setBindGroup(0, oitCompositeBindGroup);
        compositePass.draw(3);
        compositePass.end();
        device.queue.submit([overlayEncoder.finish()]);
        await device.queue.onSubmittedWorkDone();
        oitAccumTexture.destroy();
        oitRevealTexture.destroy();
        overlayStatus = 'overlay-render-submitted';
        overlayOitStatus = 'overlay-oit-render-submitted';
      } catch (error) {
        overlayStatus = `overlay-render-error:${error instanceof Error ? error.message : String(error)}`;
        overlayOitStatus = `overlay-oit-render-error:${error instanceof Error ? error.message : String(error)}`;
      } finally {
        overlayCameraBuffer?.destroy?.();
        overlayIndirectBuffer?.destroy?.();
        overlayVertexBuffer?.destroy?.();
        overlayOpticalBuffers?.recordsBuffer?.destroy?.();
        overlayOpticalBuffers?.spectralSamplesBuffer?.destroy?.();
        overlayDepthTexture?.destroy?.();
        overlayTexture?.destroy?.();
      }
      return {
        status: webgpu.status,
        schema: webgpu.schema,
        backend: webgpu.backend,
        surfaceCount: webgpu.surfaceCount,
        activeSurfaceCount: webgpu.activeSurfaceCount,
        vertexCount: webgpu.vertexCount,
        triangleCount: webgpu.triangleCount,
        drawStride: SPH_GPU_RENDER_SURFACE_DRAW_FLOATS,
        drawRows: Array.from(webgpu.drawRows),
        drawIndirectStride: SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_UINTS,
        drawIndirectRows: Array.from(webgpu.drawIndirectRows),
        cpuDrawIndirectRows: Array.from(cpuReference.drawIndirectRows),
        compactedVertexRows: Array.from(webgpu.compactedVertexRows),
        cpuDrawRows: Array.from(cpuReference.drawRows),
        compactionMode: webgpu.compactionMode,
        readback: webgpu.surfaceDrawReadback,
        overlayStatus,
        overlayOpticalRecordCount,
        overlayDepthFormat,
        overlayOitStatus,
        overlayOitAccumFormat,
        overlayOitRevealFormat
      };
    } finally {
      try {
        device.destroy?.();
      } catch {
        // Chromium can report stale presentation internals after a canvas-backed WebGPU smoke.
      }
    }
  });

  test.skip(result.status === 'webgpu-unavailable', result.reason || 'WebGPU adapter unavailable');
  expect(result.status).toBe('surface-draw-metadata-ready');
  expect(result.backend).toBe('webgpu');
  expect(result.compactionMode).toBe('webgpu-surface-prefix-scan-compact');
  expect(result.readback).toBe(true);
  expect(result.overlayStatus).toBe('overlay-render-submitted');
  expect(result.overlayOitStatus).toBe('overlay-oit-render-submitted');
  expect(result.overlayOpticalRecordCount).toBeGreaterThan(0);
  expect(result.overlayDepthFormat).toBe('depth24plus');
  expect(result.overlayOitAccumFormat).toBe('rgba16float');
  expect(result.overlayOitRevealFormat).toBe('rgba8unorm');
  expect(result.surfaceCount).toBe(2);
  expect(result.activeSurfaceCount).toBe(1);
  expect(result.vertexCount).toBe(3);
  expect(result.triangleCount).toBe(1);
  expect(result.drawRows).toEqual(result.cpuDrawRows);
  expect(result.drawIndirectRows).toEqual(result.cpuDrawIndirectRows);
  expect(result.drawRows[11]).toBe(0);
  expect(result.drawRows[result.drawStride + 4]).toBe(0);
  expect(result.drawRows[result.drawStride + 5]).toBe(3);
  expect(result.drawRows[result.drawStride + 11]).toBe(1);
  expect(result.drawIndirectRows[result.drawIndirectStride]).toBe(3);
  expect(result.drawIndirectRows[result.drawIndirectStride + 1]).toBe(1);
  expect(result.drawIndirectRows[result.drawIndirectStride + 2]).toBe(0);
  expect(result.drawIndirectRows[result.drawIndirectStride + 3]).toBe(1);
  expect(result.compactedVertexRows).toHaveLength(48);
  expect(result.compactedVertexRows[0]).toBe(1);
  expect(result.compactedVertexRows[15]).toBe(1);
});

test('SPH resident overlay depth attachment occludes far transparent and opaque draws', async ({ page }) => {
  test.setTimeout(30_000);
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const sceneModule = await import('/src/visualization/sphPhaseScene.js');
    const { SPH_RESIDENT_SURFACE_DRAW_DEPTH_FORMAT } = sceneModule;
    if (!navigator.gpu) {
      return { status: 'webgpu-unavailable', reason: 'navigator.gpu unavailable' };
    }
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      return { status: 'webgpu-unavailable', reason: 'requestAdapter returned null' };
    }
    const device = await adapter.requestDevice();
    const format = 'rgba8unorm';
    const width = 4;
    const height = 4;
    const bytesPerRow = 256;
    const shader = `
struct Params {
  depth: f32,
  r: f32,
  g: f32,
  b: f32,
  alpha: f32,
  pad0: f32,
  pad1: f32,
  pad2: f32,
};

struct VertexOut {
  @builtin(position) position: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: Params;

@vertex
fn vs_main(@builtin(vertex_index) vertex_index: u32) -> VertexOut {
  var positions = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );
  var out: VertexOut;
  out.position = vec4<f32>(positions[vertex_index], params.depth, 1.0);
  return out;
}

@fragment
fn fs_main() -> @location(0) vec4<f32> {
  return vec4<f32>(params.r * params.alpha, params.g * params.alpha, params.b * params.alpha, params.alpha);
}
`;
    const module = device.createShaderModule({ label: 'test-depth-overlay-shader', code: shader });
    const bindGroupLayout = device.createBindGroupLayout({
      label: 'test-depth-overlay-bgl',
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' }
      }]
    });
    const pipelineLayout = device.createPipelineLayout({
      label: 'test-depth-overlay-layout',
      bindGroupLayouts: [bindGroupLayout]
    });
    const makePipeline = (label, depthWriteEnabled) => device.createRenderPipeline({
      label,
      layout: pipelineLayout,
      vertex: { module, entryPoint: 'vs_main' },
      fragment: {
        module,
        entryPoint: 'fs_main',
        targets: [{
          format,
          blend: {
            color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
          }
        }]
      },
      primitive: { topology: 'triangle-list' },
      depthStencil: {
        format: SPH_RESIDENT_SURFACE_DRAW_DEPTH_FORMAT,
        depthWriteEnabled,
        depthCompare: 'less-equal'
      }
    });
    const opaquePipeline = makePipeline('test-depth-overlay-opaque', true);
    const transparentPipeline = makePipeline('test-depth-overlay-transparent', false);

    const makeUniform = (label, values) => {
      const buffer = device.createBuffer({
        label,
        size: 8 * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      device.queue.writeBuffer(buffer, 0, new Float32Array(values));
      const bindGroup = device.createBindGroup({
        layout: bindGroupLayout,
        entries: [{ binding: 0, resource: { buffer } }]
      });
      return { buffer, bindGroup };
    };
    const nearRed = makeUniform('test-depth-near-red', [0.2, 1, 0, 0, 1, 0, 0, 0]);
    const farGreen = makeUniform('test-depth-far-green', [0.8, 0, 1, 0, 0.5, 0, 0, 0]);
    const farBlue = makeUniform('test-depth-far-blue', [0.8, 0, 0, 1, 1, 0, 0, 0]);

    const readScenario = async ({ label, drawNearFirst, drawFarOpaque = true }) => {
      const colorTexture = device.createTexture({
        label: `${label}-color`,
        size: [width, height],
        format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
      });
      const depthTexture = device.createTexture({
        label: `${label}-depth`,
        size: [width, height],
        format: SPH_RESIDENT_SURFACE_DRAW_DEPTH_FORMAT,
        usage: GPUTextureUsage.RENDER_ATTACHMENT
      });
      const readBuffer = device.createBuffer({
        label: `${label}-readback`,
        size: bytesPerRow * height,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
      });
      const encoder = device.createCommandEncoder({ label: `${label}-encoder` });
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: colorTexture.createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: 'clear',
          storeOp: 'store'
        }],
        depthStencilAttachment: {
          view: depthTexture.createView(),
          depthClearValue: 1,
          depthLoadOp: 'clear',
          depthStoreOp: 'store'
        }
      });
      if (drawNearFirst) {
        pass.setPipeline(opaquePipeline);
        pass.setBindGroup(0, nearRed.bindGroup);
        pass.draw(3);
      }
      pass.setPipeline(transparentPipeline);
      pass.setBindGroup(0, farGreen.bindGroup);
      pass.draw(3);
      if (drawFarOpaque) {
        pass.setPipeline(opaquePipeline);
        pass.setBindGroup(0, farBlue.bindGroup);
        pass.draw(3);
      }
      pass.end();
      encoder.copyTextureToBuffer(
        { texture: colorTexture },
        { buffer: readBuffer, bytesPerRow, rowsPerImage: height },
        [width, height]
      );
      device.queue.submit([encoder.finish()]);
      await readBuffer.mapAsync(GPUMapMode.READ);
      const bytes = new Uint8Array(readBuffer.getMappedRange());
      const centerOffset = bytesPerRow * 2 + 2 * 4;
      const pixel = Array.from(bytes.slice(centerOffset, centerOffset + 4));
      readBuffer.unmap();
      readBuffer.destroy();
      depthTexture.destroy();
      colorTexture.destroy();
      return pixel;
    };

    try {
      const clearPixel = await readScenario({
        label: 'transparent-on-clear',
        drawNearFirst: false,
        drawFarOpaque: false
      });
      const occludedPixel = await readScenario({ label: 'transparent-behind-opaque-depth', drawNearFirst: true });
      return {
        status: 'depth-pixels-read',
        depthFormat: SPH_RESIDENT_SURFACE_DRAW_DEPTH_FORMAT,
        clearPixel,
        occludedPixel
      };
    } finally {
      nearRed.buffer.destroy();
      farGreen.buffer.destroy();
      farBlue.buffer.destroy();
      device.destroy?.();
    }
  });

  test.skip(result.status === 'webgpu-unavailable', result.reason || 'WebGPU adapter unavailable');
  expect(result.status).toBe('depth-pixels-read');
  expect(result.depthFormat).toBe('depth24plus');
  expect(result.clearPixel[0]).toBeLessThan(30);
  expect(result.clearPixel[1]).toBeGreaterThan(100);
  expect(result.clearPixel[2]).toBeLessThan(30);
  expect(result.clearPixel[3]).toBeGreaterThan(100);
  expect(result.occludedPixel[0]).toBeGreaterThan(220);
  expect(result.occludedPixel[1]).toBeLessThan(30);
  expect(result.occludedPixel[2]).toBeLessThan(30);
});

test('supervised service smoke renders desktop and mobile worker trees', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 820 });
  await page.goto('/');
  await expect(page.getByText('PeerCompute')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open Multiscale' })).toHaveAttribute('href', /https:\/\/.*:5185\/\?scenario=magnetar/);
  await expect(page.getByRole('button', { name: 'Launch Magnetar' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy Handoff' })).toBeVisible();
  await page.waitForFunction(() => window.__ulgDemo?.telemetry?.services?.length === 2);
  await page.waitForFunction(() => window.__ulgDemo?.telemetry?.services?.some((service) => service.serviceId === 'moonlab' && service.assetProbe?.status));
  const moonlabAssetStatus = await page.evaluate(() => window.__ulgDemo.telemetry.services.find((service) => service.serviceId === 'moonlab').assetProbe.status);
  expect(moonlabAssetStatus).not.toBe('skipped');
  const eshkolAssetProbe = await page.evaluate(() => window.__ulgDemo.telemetry.services.find((service) => service.serviceId === 'eshkol').assetProbe);
  expect(eshkolAssetProbe.status).not.toBe('skipped');
  if (eshkolAssetProbe.status === 'ready') {
    expect(eshkolAssetProbe.assets.map((asset) => asset.kind).sort()).toEqual([
      'artifactModule',
      'bundleManifest',
      'hostImportsModule',
      'schemaModule',
      'wasmModule'
    ]);
    expect(eshkolAssetProbe.bundleHostImports).toMatchObject({
      status: 'ready',
      factoryReady: true,
      tensorBindingReady: true,
      requirementsSchema: 'eshkol.ulg.production-host-import-candidate.v0',
      requirementsStatus: 'production-candidate-runtime-imports-implemented',
      runtimeScope: 'production-candidate-host-imports',
      implementationStatus: 'production-candidate-runtime-imports-present',
      requiredNonStubImportCount: 23
    });
  }
  await page.waitForFunction(() => window.__ulgDemo?.telemetry?.tasks?.length === 2);
  await page.waitForTimeout(1200);
  await expect(page.getByText(/tensor-probe:runtime-smoke-passed:offsets-consumed:64b/)).toBeVisible();
  await expect(page.getByText(/handler:production-handler-runtime-smoke-executed:1-blockers/)).toBeVisible();
  await expect(page.getByText(/prod-host:production-candidate-runtime-imports-implemented:23-imports/)).toBeVisible();
  await expect(page.getByText(/prod-probe:production-candidate-runtime-smoke-passed:64b/)).toBeVisible();
  await expect(page.getByText(/webgpu-preflight:device-acquired/)).toBeVisible();
  await expect(page.getByText(/webgpu-handoff:reduced:5ops/)).toBeVisible();

  const desktopPixels = await sampledCanvasPixels(page);
  expect(desktopPixels.nonBlank).toBeGreaterThan(80);
  await page.screenshot({ path: 'test-results/ulg-desktop.png', fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);
  const mobilePixels = await sampledCanvasPixels(page);
  expect(mobilePixels.nonBlank).toBeGreaterThan(60);
  await page.screenshot({ path: 'test-results/ulg-mobile.png', fullPage: true });

  const fixtureProbe = await consumeMoonLabFixturesInBrowserWorker(page);
  expect(fixtureProbe.type).toBe('fixture-consumed');
  expect(fixtureProbe.serviceId).toBe('moonlab');
  expect(fixtureProbe.taskKind).toBe('moonlab.quantum.response');
  expect(fixtureProbe.resolvedCount).toBe(1);
  expect(fixtureProbe.assetProbe.locateFile.resolved).toContain('/service-assets/moonlab/moonlab.wasm');

  const moonlabArtifact = await readMoonLabArtifact(page);
  const moonlabTelemetryRecord = await readMoonLabArtifactTelemetryRecord(page);
  const eshkolArtifact = await readServiceArtifact(page, 'eshkol');
  const eshkolTelemetryRecord = await readServiceArtifactTelemetryRecord(page, 'eshkol');
  const handoff = await page.evaluate(() => window.__ulgDemo.createPeerComputeHandoff());
  const smokeHandoff = await page.evaluate(() => window.__ulgDemo.createPeerComputeEshkolSmokeHandoff());
  const hasSmokeHandoffApi = await page.evaluate(() => (
    typeof window.__ulgDemo.createPeerComputeEshkolSmokeHandoff === 'function'
  ));
  expect(hasSmokeHandoffApi).toBe(true);
  expect(handoff.schema).toBe('peercompute.ulg.demo-handoff.v0');
  expect(smokeHandoff.schema).toBe('peercompute.ulg.demo-handoff.v0');
  expect(smokeHandoff.handoffKind).toBe('eshkol-smoke-output-semantics');
  expect(smokeHandoff.artifactCount).toBe(2);
  expect(smokeHandoff.artifacts.map((artifact) => artifact.artifactKind).sort()).toEqual([
    'closure',
    'quantum-response'
  ]);
  const smokeClosureHandoff = smokeHandoff.artifacts.find((artifact) => (
    artifact.ref.sourceService === 'eshkol'
    && artifact.artifactKind === 'closure'
  ));
  expect(smokeClosureHandoff.ref.uri).toMatch(/^artifact:\/\/sha256:[0-9a-f]{64}$/);
  expect(smokeClosureHandoff.artifact.closureKind).toBe('wasm-reference');
  expect(smokeClosureHandoff.artifact.execution.module.url).toBe('hello.wasm');
  expect(smokeClosureHandoff.artifact.execution.module.sha256).toBe('sha256:1a4699680cc14ba3cefa78634c1d52425c4d4158e590aa2e3658d3c7cae9f79c');
  expect(smokeClosureHandoff.artifact.execution.serviceWorkerSafe).toBe(true);
  expect(smokeClosureHandoff.artifact.runtime.bundleManifest.schema).toBe('eshkol.ulg.closure-bundle.v0');
  expect(smokeClosureHandoff.artifact.runtime.bundleManifest.hostImports.domFree).toBe(true);
  expect(smokeClosureHandoff.artifact.validation.status).toBe('pass');
  expect(smokeClosureHandoff.artifact.validation.validationMode).toBe('eshkol-static-closure-smoke');
  expect(smokeClosureHandoff.artifact.validation.outputSemantics.schema).toBe('eshkol.ulg.closure-output-semantics.v0');
  expect(smokeClosureHandoff.artifact.validation.outputSemantics.semanticScope).toBe('smoke-fixture');
  expect(smokeClosureHandoff.artifact.validation.outputSemantics.scientificScope).toBe('none');
  expect(smokeClosureHandoff.artifact.validation.outputSemantics.scientificValidation).toBe(false);
  expect(smokeClosureHandoff.artifact.validation.outputSemantics.entryExport).toBe('main');
  expect(smokeClosureHandoff.artifact.validation.outputSemantics.entryArgs).toEqual([0, 0]);
  expect(smokeClosureHandoff.artifact.validation.outputSemantics.expectedEntryResult).toBe(0);
  expect(smokeClosureHandoff.artifact.validation.outputSemantics.stdout.expectedText).toBe('1048560\n1048544\n');
  expect(smokeClosureHandoff.artifact.validation.outputSemantics.stdout.sha256).toBe('sha256:675d2e8686b6a85ffaa5751fba535c108d23ba941f1890d0a102619ec2cdf20d');
  expect(smokeClosureHandoff.artifactSummary.validationStatus).toBe('pass');
  expect(smokeClosureHandoff.artifactSummary.closureOutputSemanticsReady).toBe(true);
  expect(smokeClosureHandoff.artifactSummary.closureOutputExpectedEntryExport).toBe('main');
  expect(smokeClosureHandoff.artifactSummary.closureOutputExpectedEntryArgs).toEqual([0, 0]);
  expect(smokeClosureHandoff.artifactSummary.closureOutputExpectedEntryResult).toBe(0);
  expect(smokeClosureHandoff.artifactSummary.closureOutputExpectedStdoutSha256).toBe('sha256:675d2e8686b6a85ffaa5751fba535c108d23ba941f1890d0a102619ec2cdf20d');
  expect(smokeClosureHandoff.artifactSummary.closureOutputExpectedStdoutByteLength).toBe(16);
  expect(smokeClosureHandoff.artifactSummary.closureHostImportsDomFree).toBe(true);
  expect(smokeClosureHandoff.artifactSummary.closureHostImportsAssetStatus).toBe('ready');
  expect(smokeClosureHandoff.artifactSummary.closureDescriptorReady).toBe(false);
  expect(smokeClosureHandoff.wasmByteLength).toBe(33907);
  expect(smokeClosureHandoff.wasmBytes.length).toBe(33907);
  expect(smokeClosureHandoff.wasmSourceUrl).toContain('/service-assets/eshkol/closures/hello/hello.wasm');
  const smokeMoonLabHandoff = smokeHandoff.artifacts.find((artifact) => artifact.ref.sourceService === 'moonlab');
  expect(smokeMoonLabHandoff.artifactKind).toBe('quantum-response');
  expect(smokeMoonLabHandoff.artifactSummary.magnetarReferenceReady).toBe(true);
  expect(smokeMoonLabHandoff.artifactSummary.magnetarDipoleIsingReady).toBe(true);
  expect(smokeMoonLabHandoff.artifactSummary.outputReferenceCount).toBe(5);
  if (eshkolAssetProbe.status === 'ready') {
    expect(eshkolArtifact.closureKind).toBe('magnetar-closure-descriptor-fixture');
    expect(eshkolArtifact.execution.module.url).toBe('magnetar-closure.wasm');
    expect(eshkolArtifact.execution.serviceWorkerSafe).toBe(true);
    expect(eshkolArtifact.validation.status).toBe('runtime-smoke');
    expect(eshkolArtifact.validation.validationMode).toBe('eshkol-deterministic-magnetar-tensor-abi-smoke');
    expect(eshkolArtifact.runtime.bundleManifest.preserveRelativeUrls).toBe(true);
    expect(eshkolArtifact.runtime.hostImportsFactory).toMatchObject({
      status: 'ready',
      factoryReady: true,
      tensorBindingReady: true,
      requirementsSchema: 'eshkol.ulg.production-host-import-candidate.v0',
      requirementsStatus: 'production-candidate-runtime-imports-implemented',
      runtimeScope: 'production-candidate-host-imports',
      implementationStatus: 'production-candidate-runtime-imports-present',
      requiredNonStubImportCount: 23
    });
    expect(eshkolArtifact.validation.outputSemantics.schema).toBe('eshkol.ulg.closure-output-semantics.v0');
    expect(eshkolArtifact.validation.outputSemantics.semanticScope).toBe('smoke-fixture');
    expect(eshkolArtifact.validation.outputSemantics.scientificScope).toBe('none');
    expect(eshkolArtifact.validation.outputSemantics.scientificValidation).toBe(false);
    expect(eshkolArtifact.validation.outputSemantics.entryExport).toBe('main');
    expect(eshkolArtifact.validation.outputSemantics.entryArgs).toEqual([131072, 131136]);
    expect(eshkolArtifact.validation.outputSemantics.expectedEntryResult).toBe(0);
    expect(eshkolArtifact.validation.outputSemantics.stdout.expectedText).toBe('');
    expect(eshkolArtifact.validation.outputSemantics.stdout.sha256).toBe('sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(eshkolArtifact.validation.outputSemantics.stdout.byteLength).toBe(0);
    expect(eshkolArtifact.validation.closureDescriptor.schema).toBe('eshkol.ulg.magnetar-closure-descriptor.v0');
    expect(eshkolArtifact.validation.closureDescriptor.descriptorRole).toBe('magnetar-closure-contract-seed');
    expect(eshkolArtifact.validation.closureDescriptor.scientificValidation).toBe(false);
    expect(eshkolArtifact.validation.closureDescriptor.fixtureChecksum).toBe(50);
    expect(eshkolArtifact.validation.closureDescriptor.tensorContract.inputIds).toEqual([
      'magnetar-state-vector',
      'closure-control-vector'
    ]);
    expect(eshkolArtifact.validation.closureDescriptor.tensorContract.outputIds).toEqual([
      'magnetar-closure-update',
      'closure-residual'
    ]);
    expect(eshkolArtifact.validation.closureDescriptor.tensorContract.interpolation).toBe('reduced-fixture-table-contract');
    const descriptorBinding = eshkolArtifact.validation.closureDescriptor.descriptorBinding;
    expect(descriptorBinding.fidelityRuntimeScope).toMatchObject({
      schema: 'ulg.magnetar.fidelity-runtime-scope.v0',
      runtimeScope: 'eshkol-host-runtime-smoke-fixture',
      hostRuntimeSmokeFixture: true,
      fullFidelityMagnetarSimulation: false,
      fullPhysicsValidation: false
    });
    expect(descriptorBinding.moonlabNormalizedReferenceSuite.contentHash).toBe(MOONLAB_CANONICAL_REFERENCE_SUITE_FILE_SHA256);
    expect(descriptorBinding.moonlabNormalizedReferenceSuite.ready).toBe(true);
    expect(eshkolArtifact.provenance.sourceSha256).toBe(ESHKOL_MAGNETAR_SOURCE_SHA256);
    expect(eshkolArtifact.provenance.wasmSha256).toBe(ESHKOL_MAGNETAR_WASM_SHA256);
    expect(eshkolArtifact.provenance.sourceContracts[0]).toMatchObject({
      schema: 'eshkol.ulg.define-ulg-closure-source.v0',
      metadataPath: 'magnetar_closure.ulg-metadata.json',
      tensorRuntimeContract: 'eshkol:magnetar-closure-tensor-runtime-contract:v0',
      scientificValidation: false,
      fullPhysicsValidation: false
    });
    const interpolationTable = descriptorBinding.ulgInterpolationTable;
    expect(interpolationTable.schema).toBe('eshkol.ulg.magnetar-closure-interpolation-table.v0');
    expect(interpolationTable.status).toBe('computed-fixture');
    expect(interpolationTable.fixtureScope).toBe('reduced-smoke-fixture-not-magnetar-physics');
    expect(interpolationTable.scientificValidation).toBe(false);
    expect(interpolationTable.sampleCount).toBe(4);
    expect(interpolationTable.sampleIds).toEqual([
      'moonlab:magnetosphere-mhd-reference',
      'moonlab:pic-kinetic-plasma-reference',
      'moonlab:radiation-transport-reference',
      'moonlab:relativistic-correction-reference'
    ]);
    expect(interpolationTable.contentHash).toBe('sha256:82ca16463d7ffe1d170adb266be61c3959b22a6c352751e99f0f510738a14165');
    expect(interpolationTable.samples.length).toBe(4);
    const tensorRuntimeContract = eshkolArtifact.validation.closureDescriptor.descriptorBinding.closureTensorRuntimeContract;
    expect(tensorRuntimeContract.schema).toBe('eshkol.ulg.magnetar-closure-tensor-runtime-contract.v0');
    expect(tensorRuntimeContract.status).toBe('declared-fixture-contract');
    expect(tensorRuntimeContract.runtimeAbi).toBe('wasm32-unknown-unknown:eshkol-host-imports-production-candidate-v0');
    expect(tensorRuntimeContract.executionClaim).toBe('deterministic-tensor-runtime-smoke-only');
    expect(tensorRuntimeContract.entryExport).toBe('main');
    expect(tensorRuntimeContract.tensorMemoryModel).toBe('host-managed-linear-f64');
    expect(tensorRuntimeContract.inputTensorIds).toEqual([
      'magnetar-state-vector',
      'closure-control-vector'
    ]);
    expect(tensorRuntimeContract.outputTensorIds).toEqual([
      'magnetar-closure-update',
      'closure-residual'
    ]);
    expect(tensorRuntimeContract.interpolationTable.contentHash).toBe(interpolationTable.contentHash);
    expect(tensorRuntimeContract.sampleShapeValidation.status).toBe('pass');
    expect(tensorRuntimeContract.sampleShapeValidation.validatedSampleCount).toBe(4);
    expect(tensorRuntimeContract.sampleShapeValidation.scientificValidation).toBe(false);
    expect(tensorRuntimeContract.linearMemoryBinding.schema).toBe('eshkol.ulg.tensor-linear-memory-binding.v0');
    expect(tensorRuntimeContract.linearMemoryBinding.status).toBe('entry-export-runtime-smoke-passed');
    expect(tensorRuntimeContract.linearMemoryBinding.runtimeStatus).toBe('deterministic-host-runtime-smoke-executed');
    expect(tensorRuntimeContract.linearMemoryBinding.executionClaim).toBe('deterministic-tensor-runtime-smoke-only');
    expect(tensorRuntimeContract.linearMemoryBinding.entryExportConsumesOffsets).toBe(true);
    expect(tensorRuntimeContract.linearMemoryBinding.memoryImport.baseOffset).toBe(131072);
    expect(tensorRuntimeContract.linearMemoryBinding.memoryImport.totalByteLength).toBe(168);
    expect(tensorRuntimeContract.linearMemoryBinding.tensors.map((tensor) => tensor.id)).toEqual([
      'magnetar-state-vector',
      'closure-control-vector',
      'magnetar-closure-update',
      'closure-residual'
    ]);
    expect(tensorRuntimeContract.linearMemoryBinding.tensors.map((tensor) => tensor.byteOffset)).toEqual([
      131072,
      131136,
      131168,
      131232
    ]);
    expect(tensorRuntimeContract.linearMemoryBinding.tensors.map((tensor) => tensor.consumedByEntryExport)).toEqual([
      true,
      true,
      true,
      true
    ]);
    expect(tensorRuntimeContract.linearMemoryBinding.smokeBinding.status).toBe('entry-export-runtime-smoke-passed');
    expect(tensorRuntimeContract.linearMemoryBinding.smokeBinding.entryExportConsumesOffsets).toBe(true);
    expect(tensorRuntimeContract.linearMemoryBinding.smokeBinding.outputInitialization).toBe('entry-export-produced');
    expect(tensorRuntimeContract.linearMemoryBinding.entryExportOffsetProbe.schema).toBe('eshkol.ulg.tensor-entry-export-offset-probe.v0');
    expect(tensorRuntimeContract.linearMemoryBinding.entryExportOffsetProbe.status).toBe('runtime-smoke-passed');
    expect(tensorRuntimeContract.linearMemoryBinding.entryExportOffsetProbe.entryExportConsumesOffsets).toBe(true);
    expect(tensorRuntimeContract.linearMemoryBinding.entryExportOffsetProbe.outputTensorsProducedByEntryExport).toBe(true);
    expect(tensorRuntimeContract.linearMemoryBinding.entryExportOffsetProbe.changedBytesInDeclaredTensorRange).toBe(64);
    expect(tensorRuntimeContract.linearMemoryBinding.entryExportOffsetProbe.observedStdoutInvariantAcrossArgs).toBe(false);
    expect(tensorRuntimeContract.linearMemoryBinding.entryExportOffsetProbe.hostImportOptions).toMatchObject({
      factory: 'createEshkolHostImportObject',
      runtimeSmokeStubs: true,
      f64TensorMemoryImports: true,
      stubScope: 'deterministic-f64-linear-memory-smoke'
    });
    expect(tensorRuntimeContract.linearMemoryBinding.entryExportOffsetProbe.blocker).toBe(
      'none-for-deterministic-runtime-smoke-production-physics-unvalidated'
    );
    expect(tensorRuntimeContract.contractHash).toBe('sha256:7bc3955f9514d894def892e547d26288b305aceb0ae48fb732e2268b0d305985');
    expect(tensorRuntimeContract.scientificValidation).toBe(false);
    expect(tensorRuntimeContract.fullPhysicsValidation).toBe(false);
    const productionHandlerBoundary = descriptorBinding.productionHandlerBoundary;
    expect(productionHandlerBoundary.schema).toBe('eshkol.ulg.production-handler-boundary.v0');
    expect(productionHandlerBoundary.handlerId).toBe('eshkol:magnetar-closure:main:v0');
    expect(productionHandlerBoundary.handlerKind).toBe('wasm-export-tensor-closure');
    expect(productionHandlerBoundary.dispatchSchema).toBe('peercompute.ulg.dispatch-service-handler-context.v0');
    expect(productionHandlerBoundary.status).toBe('production-handler-runtime-smoke-executed');
    expect(productionHandlerBoundary.handlerReady).toBe(true);
    expect(productionHandlerBoundary.runtimeExecution).toBe(true);
    expect(productionHandlerBoundary.entryExport).toBe('main');
    expect(productionHandlerBoundary.runtimeAbi).toBe(tensorRuntimeContract.runtimeAbi);
    expect(productionHandlerBoundary.tensorMemoryModel).toBe(tensorRuntimeContract.tensorMemoryModel);
    expect(productionHandlerBoundary.inputTensorIds).toEqual(tensorRuntimeContract.inputTensorIds);
    expect(productionHandlerBoundary.outputTensorIds).toEqual(tensorRuntimeContract.outputTensorIds);
    expect(productionHandlerBoundary.moduleRef).toMatchObject({
      source: 'artifact.execution.module',
      contentAddressing: 'required',
      sha256Field: 'artifact.execution.module.sha256'
    });
    expect(productionHandlerBoundary.productionHandlerContract).toMatchObject({
      schema: 'eshkol.ulg.production-handler-contract.v0',
      status: 'implemented-runtime-smoke-pending-full-physics',
      handlerId: 'eshkol:magnetar-closure:main:v0',
      dispatchSchema: 'peercompute.ulg.dispatch-service-handler-context.v0',
      entryExport: 'main',
      runtimeAbi: tensorRuntimeContract.runtimeAbi,
      tensorMemoryModel: tensorRuntimeContract.tensorMemoryModel,
      invocation: {
        moduleSource: 'artifact.execution.module',
        entryExport: 'main',
        argumentMode: 'linear-memory-offsets',
        parameterTypes: ['i32', 'i32'],
        resultTypes: ['i32'],
        inputOffsetParam: 0,
        outputOffsetParam: 1,
        expectedReturn: 0
      }
    });
    expect(productionHandlerBoundary.productionHandlerContract.inputTensorIds).toEqual(tensorRuntimeContract.inputTensorIds);
    expect(productionHandlerBoundary.productionHandlerContract.outputTensorIds).toEqual(tensorRuntimeContract.outputTensorIds);
    expect(productionHandlerBoundary.productionHandlerContract.requiredEvidence).toEqual([
      'content-addressed-wasm-module',
      'entry-export-main-signature-i32-i32-to-i32',
      'production-candidate-host-imports',
      'validated-f64-tensor-memory-binding',
      'production-candidate-runtime-probe',
      'production-magnetar-handler-implementation',
      'production-handler-runtime-execution',
      'full-physics-validation-pass'
    ]);
    expect(productionHandlerBoundary.productionHandlerContract.blockedBy).toEqual([
      'full-physics-validation-not-run'
    ]);
    expect(productionHandlerBoundary.productionHandlerImplementation).toMatchObject({
      schema: 'eshkol.ulg.production-handler-implementation.v0',
      status: 'implemented-production-candidate-runtime-smoke',
      handlerId: 'eshkol:magnetar-closure:main:v0',
      handlerKind: 'wasm-export-tensor-closure',
      implementationScope: 'deterministic-magnetar-tensor-abi-smoke',
      moduleSource: 'artifact.execution.module',
      entryExport: 'main',
      runtimeAbi: tensorRuntimeContract.runtimeAbi,
      dispatchSchema: 'peercompute.ulg.dispatch-service-handler-context.v0',
      tensorMemoryModel: tensorRuntimeContract.tensorMemoryModel,
      executionClaim: 'production-candidate-host-import-runtime-smoke-only',
      scientificValidation: false,
      fullPhysicsValidation: false,
      fullFidelityMagnetarSimulation: false,
      blockedBy: ['full-physics-validation-not-run']
    });
    expect(productionHandlerBoundary.productionHandlerImplementation.inputTensorIds).toEqual(tensorRuntimeContract.inputTensorIds);
    expect(productionHandlerBoundary.productionHandlerImplementation.outputTensorIds).toEqual(tensorRuntimeContract.outputTensorIds);
    expect(productionHandlerBoundary.productionHandlerImplementation.evidence).toEqual([
      'content-addressed-wasm-module',
      'entry-export-main-signature-i32-i32-to-i32',
      'production-candidate-host-imports',
      'validated-f64-tensor-memory-binding',
      'production-candidate-runtime-probe'
    ]);
    expect(productionHandlerBoundary.hostImports).toMatchObject({
      source: 'bundle.hostImports',
      required: true,
      factory: 'createEshkolHostImportObject',
      runtimeScope: 'production-candidate-host-imports',
      implementationStatus: 'production-candidate-runtime-imports-present'
    });
    expect(productionHandlerBoundary.hostImports.productionCandidate).toMatchObject({
      schema: 'eshkol.ulg.production-host-import-candidate.v0',
      status: 'production-candidate-runtime-imports-implemented',
      productionRuntimeAbi: 'wasm32-unknown-unknown:eshkol-host-imports-production-candidate-v0',
      runtimeScope: 'production-candidate-host-imports',
      implementationStatus: 'production-candidate-runtime-imports-present',
      runtimeSmokeStubsAllowed: false,
      tensorMemoryImports: ['ulg_read_f64', 'ulg_write_f64']
    });
    expect(productionHandlerBoundary.hostImports.productionCandidate.requiredNonStubImports.length).toBe(23);
    expect(productionHandlerBoundary.hostImports.productionCandidate.readinessRequires).toEqual([
      'non-stub-host-runtime-imports',
      'validated-f64-tensor-memory-imports',
      'full-physics-validation-pass'
    ]);
    expect(productionHandlerBoundary.hostImports.productionCandidate.blockedBy).toEqual([
      'full-physics-validation-not-run'
    ]);
    expect(productionHandlerBoundary.allowedExecutionClaims).toEqual([
      'deterministic-tensor-runtime-smoke-only',
      'production-candidate-host-import-runtime-smoke-only'
    ]);
    expect(productionHandlerBoundary.blockers).toEqual([
      'full-physics-validation-not-run'
    ]);
    expect(productionHandlerBoundary.tensorMemoryBinding).toMatchObject({
      source: 'validation.closureDescriptor.descriptorBinding.closureTensorRuntimeContract.linearMemoryBinding',
      status: 'entry-export-runtime-smoke-passed',
      executionClaim: 'deterministic-tensor-runtime-smoke-only',
      entryExportConsumesOffsets: true
    });
    expect(productionHandlerBoundary.productionCandidateRuntimeProbe).toMatchObject({
      schema: 'eshkol.ulg.production-candidate-runtime-probe.v0',
      status: 'production-candidate-runtime-smoke-passed',
      runtimeScope: 'production-candidate-host-imports',
      implementationStatus: 'production-candidate-runtime-imports-present',
      executionClaim: 'production-candidate-host-import-runtime-smoke-only',
      entryExport: 'main',
      entryArgs: [131072, 131136],
      expectedEntryResult: 0,
      changedBytesInDeclaredTensorRange: 64,
      outputTensorsProducedByEntryExport: true,
      productionHandlerReady: true,
      productionHandlerRuntimeExecution: true,
      scientificValidation: false,
      fullPhysicsValidation: false,
      fullFidelityMagnetarSimulation: false,
      blocker: 'full-physics-validation-not-run'
    });
    expect(productionHandlerBoundary.productionCandidateRuntimeProbe.hostImportOptions).toMatchObject({
      factory: 'createEshkolHostImportObject',
      productionCandidateRuntimeImports: true,
      runtimeSmokeStubs: false,
      f64TensorMemoryImports: true
    });
    expect(productionHandlerBoundary.productionCandidateRuntimeProbe.hostImportCallCounts).toEqual({
      ulg_read_f64: 12,
      ulg_write_f64: 9
    });
    expect(productionHandlerBoundary.productionHandlerRuntimeExecution).toMatchObject({
      schema: 'eshkol.ulg.production-handler-runtime-execution.v0',
      status: 'production-handler-runtime-smoke-executed',
      handlerId: 'eshkol:magnetar-closure:main:v0',
      moduleSource: 'artifact.execution.module',
      entryExport: 'main',
      runtimeAbi: tensorRuntimeContract.runtimeAbi,
      runtimeScope: 'production-candidate-host-imports',
      executionClaim: 'production-candidate-host-import-runtime-smoke-only',
      argumentMode: 'linear-memory-offsets',
      parameterTypes: ['i32', 'i32'],
      resultTypes: ['i32'],
      entryArgs: [131072, 131136],
      entryResult: 0,
      changedBytesInDeclaredTensorRange: 64,
      outputTensorsProducedByEntryExport: true,
      scientificValidation: false,
      fullPhysicsValidation: false,
      fullFidelityMagnetarSimulation: false,
      blockedBy: ['full-physics-validation-not-run']
    });
    expect(productionHandlerBoundary.productionHandlerRuntimeExecution.hostImportCallCounts).toEqual({
      ulg_read_f64: 12,
      ulg_write_f64: 9
    });
    expect(productionHandlerBoundary.fullPhysicsValidationRequirements).toMatchObject({
      schema: 'eshkol.ulg.full-physics-validation-requirements.v0',
      status: 'declared-not-run',
      ready: false,
      validationScope: 'magnetar-production-handler-full-physics',
      producerSchema: 'peercompute.multiscale.scenario-runtime-evidence-manifest.v0',
      requiredValidationSchema: 'peercompute.multiscale.scenario-scientific-runtime-validation.v0',
      requiredValidationScope: 'magnetar-scientific-runtime-reference-validation',
      requiredHashFields: ['referenceHash', 'toleranceHash', 'runtimeOutputHash', 'evidenceHash'],
      blockedBy: ['full-physics-validation-not-run']
    });
    expect(productionHandlerBoundary.fullPhysicsValidationRequirements.requiredRuntimeEvidenceFamilies).toEqual([
      'magnetosphere-mhd',
      'pic-kinetic-plasma',
      'radiation-transport',
      'relativistic-correction',
      'cross-family-conservation-coupling'
    ]);
    expect(productionHandlerBoundary.fullPhysicsValidationRequirements.requiredRuntimeEvidence).toHaveLength(5);
    expect(productionHandlerBoundary.dispatchPreflight).toMatchObject({
      schema: 'eshkol.ulg.production-handler-dispatch-preflight.v0',
      status: 'blocked',
      ready: false,
      dispatchSchema: 'peercompute.ulg.dispatch-service-handler-context.v0',
      entryExport: 'main',
      currentRuntimeAbi: 'wasm32-unknown-unknown:eshkol-host-imports-production-candidate-v0',
      requiredRuntimeAbi: 'wasm32-unknown-unknown:eshkol-host-imports-production-candidate-v0',
      moduleContentAddressing: 'required',
      moduleSha256Field: 'artifact.execution.module.sha256',
      tensorMemoryBindingSource: 'validation.closureDescriptor.descriptorBinding.closureTensorRuntimeContract.linearMemoryBinding',
      hostImportsCandidateSource: 'productionHandlerBoundary.hostImports.productionCandidate',
      rejectedRuntimeScopes: ['deterministic-runtime-smoke-stubs'],
      runtimeSmokeStubsAllowed: false,
      handlerReadyRequired: true,
      runtimeExecutionRequired: true,
      fullPhysicsValidationRequired: true,
      scientificValidationRequired: true
    });
    expect(productionHandlerBoundary.dispatchPreflight.requiredChecks).toEqual([
      'artifact-module-sha256-matches-module-ref',
      'entry-export-main-signature-i32-i32-to-i32',
      'production-handler-contract-declared',
      'non-stub-host-imports-present',
      'f64-tensor-memory-binding-validated',
      'production-candidate-runtime-probe-passed',
      'runtime-smoke-stubs-rejected-for-production',
      'handler-ready-flag-true',
      'runtime-execution-flag-true',
      'full-physics-validation-evidence-present'
    ]);
    expect(productionHandlerBoundary.dispatchPreflight.blockedBy).toEqual([
      'full-physics-validation-not-run'
    ]);
    expect(productionHandlerBoundary.dispatchPreflight.checkSummary).toMatchObject({
      schema: 'eshkol.ulg.production-handler-dispatch-preflight-check-summary.v0',
      status: 'blocked',
      ready: false,
      totalRequiredCheckCount: 10,
      passedCount: 9,
      blockedCount: 1
    });
    expect(productionHandlerBoundary.dispatchPreflight.checkSummary.passedChecks).toEqual([
      'artifact-module-sha256-matches-module-ref',
      'entry-export-main-signature-i32-i32-to-i32',
      'production-handler-contract-declared',
      'non-stub-host-imports-present',
      'f64-tensor-memory-binding-validated',
      'production-candidate-runtime-probe-passed',
      'runtime-smoke-stubs-rejected-for-production',
      'handler-ready-flag-true',
      'runtime-execution-flag-true'
    ]);
    expect(productionHandlerBoundary.dispatchPreflight.checkSummary.blockedChecks).toEqual([
      'full-physics-validation-evidence-present'
    ]);
    expect(productionHandlerBoundary.dispatchPreflight.checkResults.map((entry) => entry.check)).toEqual([
      'artifact-module-sha256-matches-module-ref',
      'entry-export-main-signature-i32-i32-to-i32',
      'production-handler-contract-declared',
      'non-stub-host-imports-present',
      'f64-tensor-memory-binding-validated',
      'production-candidate-runtime-probe-passed',
      'runtime-smoke-stubs-rejected-for-production',
      'handler-ready-flag-true',
      'runtime-execution-flag-true',
      'full-physics-validation-evidence-present'
    ]);
    expect(productionHandlerBoundary.derivativeStatus).toBe('declared-not-computed');
    expect(productionHandlerBoundary.scientificValidation).toBe(false);
    expect(productionHandlerBoundary.fullPhysicsValidation).toBe(false);
    expect(productionHandlerBoundary.fullFidelityMagnetarSimulation).toBe(false);
    expect(eshkolTelemetryRecord.artifactSummary.schema).toBe('peercompute.ulg.artifact-summary.v0');
    expect(eshkolTelemetryRecord.artifactSummary.artifactKind).toBe('closure');
    expect(eshkolTelemetryRecord.artifactSummary.validationStatus).toBe('runtime-smoke');
    expect(eshkolTelemetryRecord.artifactSummary.closureKind).toBe('magnetar-closure-descriptor-fixture');
    expect(eshkolTelemetryRecord.artifactSummary.closureModuleUrl).toBe('magnetar-closure.wasm');
    expect(eshkolTelemetryRecord.artifactSummary.closureServiceWorkerSafe).toBe(true);
    expect(eshkolTelemetryRecord.artifactSummary.closureEntryExport).toBe('main');
    expect(eshkolTelemetryRecord.artifactSummary.closureEntrySignature.parameters).toEqual(['i32', 'i32']);
    expect(eshkolTelemetryRecord.artifactSummary.closureEntrySignature.results).toEqual(['i32']);
    expect(eshkolTelemetryRecord.artifactSummary.closureHasStartSection).toBe(false);
    expect(eshkolTelemetryRecord.artifactSummary.closureStartFunctionIndex).toBe(null);
    expect(eshkolTelemetryRecord.artifactSummary.closureImportCount).toBe(32);
    expect(eshkolTelemetryRecord.artifactSummary.closureExportCount).toBe(2);
    expect(eshkolTelemetryRecord.artifactSummary.closureRuntimeFunctionImportCount).toBe(29);
    expect(eshkolTelemetryRecord.artifactSummary.closureWasmFunctionCount).toBe(42);
    expect(eshkolTelemetryRecord.artifactSummary.closureWasmTypeCount).toBe(111);
    expect(eshkolTelemetryRecord.artifactSummary.closureHostImportsFactory).toBe('createEshkolHostImportObject');
    expect(eshkolTelemetryRecord.artifactSummary.closureHostImportsDomFree).toBe(true);
    expect(eshkolTelemetryRecord.artifactSummary.closureHostImportsAssetStatus).toBe('ready');
    expect(eshkolTelemetryRecord.artifactSummary.closureHostImportsFactoryStatus).toBe('ready');
    expect(eshkolTelemetryRecord.artifactSummary.closureHostImportsFactoryReady).toBe(true);
    expect(eshkolTelemetryRecord.artifactSummary.closureHostImportsRequirementsSchema).toBe('eshkol.ulg.production-host-import-candidate.v0');
    expect(eshkolTelemetryRecord.artifactSummary.closureHostImportsRequirementsStatus).toBe('production-candidate-runtime-imports-implemented');
    expect(eshkolTelemetryRecord.artifactSummary.closureHostImportsRuntimeScope).toBe('production-candidate-host-imports');
    expect(eshkolTelemetryRecord.artifactSummary.closureHostImportsImplementationStatus).toBe('production-candidate-runtime-imports-present');
    expect(eshkolTelemetryRecord.artifactSummary.closureHostImportsRequiredNonStubImportCount).toBe(23);
    expect(eshkolTelemetryRecord.artifactSummary.closureBundlePreserveRelativeUrls).toBe(true);
    expect(eshkolTelemetryRecord.artifactSummary.closureOutputSemanticsSchema).toBe('eshkol.ulg.closure-output-semantics.v0');
    expect(eshkolTelemetryRecord.artifactSummary.closureOutputSemanticsReady).toBe(true);
    expect(eshkolTelemetryRecord.artifactSummary.closureOutputSemanticScope).toBe('smoke-fixture');
    expect(eshkolTelemetryRecord.artifactSummary.closureOutputScientificScope).toBe('none');
    expect(eshkolTelemetryRecord.artifactSummary.closureOutputScientificValidation).toBe(false);
    expect(eshkolTelemetryRecord.artifactSummary.closureOutputExpectedEntryExport).toBe('main');
    expect(eshkolTelemetryRecord.artifactSummary.closureOutputExpectedEntryArgs).toEqual([131072, 131136]);
    expect(eshkolTelemetryRecord.artifactSummary.closureOutputExpectedEntryResult).toBe(0);
    expect(eshkolTelemetryRecord.artifactSummary.closureOutputExpectedStdoutSha256).toBe('sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(eshkolTelemetryRecord.artifactSummary.closureOutputExpectedStdoutByteLength).toBe(0);
    expect(eshkolTelemetryRecord.artifactSummary.closureDescriptorSchema).toBe('eshkol.ulg.magnetar-closure-descriptor.v0');
    expect(eshkolTelemetryRecord.artifactSummary.closureDescriptorReady).toBe(true);
    expect(eshkolTelemetryRecord.artifactSummary.closureDescriptorRole).toBe('magnetar-closure-contract-seed');
    expect(eshkolTelemetryRecord.artifactSummary.closureDescriptorFixtureChecksum).toBe(50);
    expect(eshkolTelemetryRecord.artifactSummary.closureDescriptorScientificValidation).toBe(false);
    expect(eshkolTelemetryRecord.artifactSummary.closureDescriptorFidelityRuntimeScope).toMatchObject({
      schema: 'ulg.magnetar.fidelity-runtime-scope.v0',
      runtimeScope: 'eshkol-host-runtime-smoke-fixture',
      hostRuntimeSmokeFixture: true,
      fullFidelityMagnetarSimulation: false,
      fullPhysicsValidation: false
    });
    expect(eshkolTelemetryRecord.artifactSummary.closureDescriptorInputIds).toEqual([
      'magnetar-state-vector',
      'closure-control-vector'
    ]);
    expect(eshkolTelemetryRecord.artifactSummary.closureDescriptorOutputIds).toEqual([
      'magnetar-closure-update',
      'closure-residual'
    ]);
    expect(eshkolTelemetryRecord.artifactSummary.closureInterpolationTableSchema).toBe('eshkol.ulg.magnetar-closure-interpolation-table.v0');
    expect(eshkolTelemetryRecord.artifactSummary.closureInterpolationTableStatus).toBe('computed-fixture');
    expect(eshkolTelemetryRecord.artifactSummary.closureInterpolationTableFixtureScope).toBe('reduced-smoke-fixture-not-magnetar-physics');
    expect(eshkolTelemetryRecord.artifactSummary.closureInterpolationTableScientificValidation).toBe(false);
    expect(eshkolTelemetryRecord.artifactSummary.closureInterpolationTableSampleCount).toBe(4);
    expect(eshkolTelemetryRecord.artifactSummary.closureInterpolationTablePayloadSampleCount).toBe(4);
    expect(eshkolTelemetryRecord.artifactSummary.closureInterpolationTableContentHash).toBe('sha256:82ca16463d7ffe1d170adb266be61c3959b22a6c352751e99f0f510738a14165');
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorRuntimeContractSchema).toBe('eshkol.ulg.magnetar-closure-tensor-runtime-contract.v0');
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorRuntimeContractStatus).toBe('declared-fixture-contract');
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorRuntimeContractReady).toBe(true);
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorRuntimeContractHash).toBe('sha256:7bc3955f9514d894def892e547d26288b305aceb0ae48fb732e2268b0d305985');
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorRuntimeRuntimeAbi).toBe('wasm32-unknown-unknown:eshkol-host-imports-production-candidate-v0');
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorRuntimeExecutionClaim).toBe('deterministic-tensor-runtime-smoke-only');
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorRuntimeSampleShapeValidationStatus).toBe('pass');
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorRuntimeSampleShapeValidatedSampleCount).toBe(4);
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorRuntimeScientificValidation).toBe(false);
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorRuntimeFullPhysicsValidation).toBe(false);
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorLinearMemoryBindingSchema).toBe('eshkol.ulg.tensor-linear-memory-binding.v0');
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorLinearMemoryBindingStatus).toBe('entry-export-runtime-smoke-passed');
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorLinearMemoryBindingReady).toBe(true);
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorLinearMemoryExecutionClaim).toBe('deterministic-tensor-runtime-smoke-only');
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorLinearMemoryEntryExportConsumesOffsets).toBe(true);
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorLinearMemoryBaseOffset).toBe(131072);
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorLinearMemoryTotalByteLength).toBe(168);
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorLinearMemoryTensorIds).toEqual([
      'magnetar-state-vector',
      'closure-control-vector',
      'magnetar-closure-update',
      'closure-residual'
    ]);
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorLinearMemoryTensors.map((tensor) => tensor.byteOffset)).toEqual([
      131072,
      131136,
      131168,
      131232
    ]);
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorLinearMemorySmokeBindingStatus).toBe('entry-export-runtime-smoke-passed');
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorEntryExportOffsetProbeStatus).toBe('runtime-smoke-passed');
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorEntryExportConsumesOffsets).toBe(true);
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorEntryExportOutputTensorsProduced).toBe(true);
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorEntryExportChangedBytesInDeclaredTensorRange).toBe(64);
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorEntryExportObservedStdoutInvariantAcrossArgs).toBe(false);
    expect(eshkolTelemetryRecord.artifactSummary.closureTensorEntryExportOffsetProbeBlocker).toBe(
      'none-for-deterministic-runtime-smoke-production-physics-unvalidated'
    );
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerBoundarySchema).toBe('eshkol.ulg.production-handler-boundary.v0');
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerBoundaryStatus).toBe('production-handler-runtime-smoke-executed');
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerBoundaryDeclared).toBe(true);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerBoundaryHandlerId).toBe('eshkol:magnetar-closure:main:v0');
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerBoundaryHandlerKind).toBe('wasm-export-tensor-closure');
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerBoundaryDispatchSchema).toBe('peercompute.ulg.dispatch-service-handler-context.v0');
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerReady).toBe(true);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerRuntimeExecution).toBe(true);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerDerivativeStatus).toBe('declared-not-computed');
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerScientificValidation).toBe(false);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerFullPhysicsValidation).toBe(false);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerFullFidelityMagnetarSimulation).toBe(false);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerAllowedExecutionClaims).toEqual([
      'deterministic-tensor-runtime-smoke-only',
      'production-candidate-host-import-runtime-smoke-only'
    ]);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerBoundaryBlockers).toEqual([
      'full-physics-validation-not-run'
    ]);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerTensorMemoryBinding.status).toBe('entry-export-runtime-smoke-passed');
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerContractSchema).toBe(
      'eshkol.ulg.production-handler-contract.v0'
    );
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerContractStatus).toBe(
      'implemented-runtime-smoke-pending-full-physics'
    );
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerContractDeclared).toBe(true);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerContractInvocationArgumentMode).toBe(
      'linear-memory-offsets'
    );
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerContractInvocationParameterTypes).toEqual([
      'i32',
      'i32'
    ]);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerContractInvocationResultTypes).toEqual([
      'i32'
    ]);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerContractRequiredEvidenceCount).toBe(8);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerContractBlockedBy).toEqual([
      'full-physics-validation-not-run'
    ]);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerImplementationStatus).toBe(
      'implemented-production-candidate-runtime-smoke'
    );
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerImplementationReady).toBe(true);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerImplementationEvidenceCount).toBe(5);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerImplementationBlockedBy).toEqual([
      'full-physics-validation-not-run'
    ]);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerRuntimeExecutionStatus).toBe(
      'production-handler-runtime-smoke-executed'
    );
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerRuntimeExecutionReady).toBe(true);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerRuntimeExecutionEntryArgs).toEqual([
      131072,
      131136
    ]);
    expect(
      eshkolTelemetryRecord.artifactSummary.closureProductionHandlerRuntimeExecutionChangedBytesInDeclaredTensorRange
    ).toBe(64);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHandlerRuntimeExecutionHostImportCallCounts).toEqual({
      ulg_read_f64: 12,
      ulg_write_f64: 9
    });
    expect(eshkolTelemetryRecord.artifactSummary.closureFullPhysicsValidationRequirementsDeclared).toBe(true);
    expect(eshkolTelemetryRecord.artifactSummary.closureFullPhysicsValidationRequirementsStatus).toBe(
      'declared-not-run'
    );
    expect(eshkolTelemetryRecord.artifactSummary.closureFullPhysicsValidationRequirementsReady).toBe(false);
    expect(eshkolTelemetryRecord.artifactSummary.closureFullPhysicsValidationRequiredRuntimeEvidenceFamilies).toEqual([
      'magnetosphere-mhd',
      'pic-kinetic-plasma',
      'radiation-transport',
      'relativistic-correction',
      'cross-family-conservation-coupling'
    ]);
    expect(eshkolTelemetryRecord.artifactSummary.closureFullPhysicsValidationRequiredRuntimeEvidenceCount).toBe(5);
    expect(eshkolTelemetryRecord.artifactSummary.closureFullPhysicsValidationRequiredHashFields).toEqual([
      'referenceHash',
      'toleranceHash',
      'runtimeOutputHash',
      'evidenceHash'
    ]);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHostImportsRuntimeScope).toBe('production-candidate-host-imports');
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHostImportsImplementationStatus).toBe('production-candidate-runtime-imports-present');
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHostImportCandidateStatus).toBe('production-candidate-runtime-imports-implemented');
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHostImportCandidateRuntimeSmokeStubsAllowed).toBe(false);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHostImportCandidateRequiredNonStubImports.length).toBe(23);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHostImportCandidateReadinessRequires).toEqual([
      'non-stub-host-runtime-imports',
      'validated-f64-tensor-memory-imports',
      'full-physics-validation-pass'
    ]);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionHostImportCandidateBlockedBy).toEqual([
      'full-physics-validation-not-run'
    ]);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionCandidateRuntimeProbeSchema).toBe(
      'eshkol.ulg.production-candidate-runtime-probe.v0'
    );
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionCandidateRuntimeProbeStatus).toBe(
      'production-candidate-runtime-smoke-passed'
    );
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionCandidateRuntimeProbeReady).toBe(true);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionCandidateRuntimeProbeExecutionClaim).toBe(
      'production-candidate-host-import-runtime-smoke-only'
    );
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionCandidateRuntimeProbeRuntimeScope).toBe(
      'production-candidate-host-imports'
    );
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionCandidateRuntimeProbeEntryArgs).toEqual([
      131072,
      131136
    ]);
    expect(
      eshkolTelemetryRecord.artifactSummary.closureProductionCandidateRuntimeProbeChangedBytesInDeclaredTensorRange
    ).toBe(64);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionCandidateRuntimeProbeOutputTensorsProduced).toBe(true);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionCandidateRuntimeProbeHostImportCallCounts).toEqual({
      ulg_read_f64: 12,
      ulg_write_f64: 9
    });
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionCandidateRuntimeProbeProductionHandlerReady).toBe(true);
    expect(
      eshkolTelemetryRecord.artifactSummary.closureProductionCandidateRuntimeProbeProductionHandlerRuntimeExecution
    ).toBe(true);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionCandidateRuntimeProbeFullPhysicsValidation).toBe(false);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionCandidateRuntimeProbeBlocker).toBe(
      'full-physics-validation-not-run'
    );
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionDispatchPreflightSchema).toBe(
      'eshkol.ulg.production-handler-dispatch-preflight.v0'
    );
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionDispatchPreflightStatus).toBe('blocked');
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionDispatchPreflightReady).toBe(false);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionDispatchPreflightRequiredRuntimeAbi).toBe(
      'wasm32-unknown-unknown:eshkol-host-imports-production-candidate-v0'
    );
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionDispatchPreflightRuntimeSmokeStubsAllowed).toBe(false);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionDispatchPreflightRejectedRuntimeScopes).toEqual([
      'deterministic-runtime-smoke-stubs'
    ]);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionDispatchPreflightBlockedBy).toEqual([
      'full-physics-validation-not-run'
    ]);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionDispatchPreflightCheckSummarySchema).toBe(
      'eshkol.ulg.production-handler-dispatch-preflight-check-summary.v0'
    );
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionDispatchPreflightTotalRequiredCheckCount).toBe(10);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionDispatchPreflightPassedCheckCount).toBe(9);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionDispatchPreflightBlockedCheckCount).toBe(1);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionDispatchPreflightPassedChecks).toEqual([
      'artifact-module-sha256-matches-module-ref',
      'entry-export-main-signature-i32-i32-to-i32',
      'production-handler-contract-declared',
      'non-stub-host-imports-present',
      'f64-tensor-memory-binding-validated',
      'production-candidate-runtime-probe-passed',
      'runtime-smoke-stubs-rejected-for-production',
      'handler-ready-flag-true',
      'runtime-execution-flag-true'
    ]);
    expect(eshkolTelemetryRecord.artifactSummary.closureProductionDispatchPreflightBlockedChecks).toEqual([
      'full-physics-validation-evidence-present'
    ]);
    expect(eshkolTelemetryRecord.artifactSummary.closureReady).toBe(true);
    const closureHandoff = handoff.artifacts.find((artifact) => artifact.artifactKind === 'closure');
    expect(closureHandoff.artifactSummary.closureEntryExport).toBe('main');
    expect(closureHandoff.artifactSummary.closureHostImportsDomFree).toBe(true);
    expect(closureHandoff.artifactSummary.closureDescriptorReady).toBe(true);
    expect(closureHandoff.artifactSummary.closureProductionHandlerBoundaryDeclared).toBe(true);
    expect(closureHandoff.artifactSummary.closureProductionHandlerContractDeclared).toBe(true);
    expect(closureHandoff.artifactSummary.closureProductionHandlerReady).toBe(true);
    expect(closureHandoff.artifactSummary.closureProductionHandlerRuntimeExecution).toBe(true);
    expect(closureHandoff.artifactSummary.closureProductionDispatchPreflightReady).toBe(false);
    expect(closureHandoff.artifactSummary.closureProductionCandidateRuntimeProbeReady).toBe(true);
    expect(closureHandoff.artifactSummary.closureProductionDispatchPreflightPassedCheckCount).toBe(9);
    expect(closureHandoff.artifactSummary.closureOutputSemanticsReady).toBe(true);
    expect(closureHandoff.artifactSummary.closureOutputExpectedEntryArgs).toEqual([131072, 131136]);
    expect(closureHandoff.artifactSummary.closureOutputExpectedStdoutSha256).toBe('sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(closureHandoff.artifactSummary.closureOutputExpectedStdoutByteLength).toBe(0);
    expect(closureHandoff.wasmByteLength).toBe(169528);
    expect(closureHandoff.wasmBytes.length).toBe(169528);
    expect(closureHandoff.wasmSourceUrl).toContain('/service-assets/eshkol/closures/magnetar-closure/magnetar-closure.wasm');
  }
  if (moonlabAssetStatus === 'ready') {
    expect(moonlabArtifact.method).toBe('moonlab-wasm-bell-phi-plus-probe');
    expect(moonlabArtifact.runtime.coreProbe.status).toBe('ready');
    expect(moonlabArtifact.outputs.bellState).toBe('bell_phi_plus');
    expect(moonlabArtifact.outputs.basisProbabilities[0]).toBeCloseTo(0.5, 9);
    expect(moonlabArtifact.outputs.basisProbabilities[3]).toBeCloseTo(0.5, 9);
    expect(moonlabArtifact.responseDescriptor.schema).toBe('peercompute.ulg.quantum-response-descriptor.v0');
    expect(moonlabArtifact.responseDescriptor.invariants.normalizationDelta).toBeLessThan(1e-9);
    expect(moonlabArtifact.parity.schema).toBe('peercompute.ulg.quantum-response-parity.v0');
    expect(moonlabArtifact.parity.status).toBe('pass');
    expect(moonlabArtifact.parity.comparisons.find((entry) => entry.mode === 'moonlab-wasm-core').status).toBe('pass');
    expect(moonlabArtifact.parity.comparisons.find((entry) => entry.mode === 'moonlab-webgpu').status).toBe('unsupported');
    expect(moonlabArtifact.validationMetrics.unsupportedParityModeCount).toBe(1);
    const webGpuParityScopeReady = moonlabArtifact.runtime.coreProbe.webGpuParityScope?.status === 'ready';
    const webGpuParityHandoffSummaryReady = (
      moonlabArtifact.runtime.coreProbe.webGpuParityHandoffSummary?.status === 'ready'
    );
    expect(moonlabArtifact.validationMetrics.webGpuParityScopeReady).toBe(webGpuParityScopeReady);
    expect(moonlabArtifact.validationMetrics.webGpuParityHandoffSummaryReady).toBe(webGpuParityHandoffSummaryReady);
    if (webGpuParityScopeReady) {
      expect(moonlabArtifact.webGpuParityScope.schema).toBe('moonlab.webgpu.complex64-parity-scope.v0');
      expect(moonlabArtifact.webGpuParityScope.status).toBe('scope-ready-backend-detected');
      expect(moonlabArtifact.webGpuParityScope.contractReady).toBe(true);
      expect(moonlabArtifact.webGpuParityScope.reducedFixtureOnly).toBe(true);
      expect(moonlabArtifact.webGpuParityScope.backendAvailable).toBe(true);
      expect(moonlabArtifact.webGpuParityScope.requireBackend).toBe(true);
      expect(moonlabArtifact.webGpuParityScope.browserBackendPreflight).toMatchObject({
        schema: 'moonlab.webgpu.complex64-browser-backend-preflight.v0',
        probeKind: 'browser-webgpu-adapter-device-preflight',
        stage: 'device-acquired',
        navigatorGpuAvailable: true,
        adapterAvailable: true,
        deviceAcquired: true
      });
      expect(moonlabArtifact.webGpuParityScope.webgpuParity.executed).toBe(true);
      expect(moonlabArtifact.webGpuParityScope.webgpuParity.passed).toBe(true);
      expect(moonlabArtifact.webGpuParityScope.webgpuParity.maxProbabilityAbsDiff).toBeLessThanOrEqual(
        moonlabArtifact.webGpuParityScope.webgpuParity.tolerance
      );
      expect(moonlabArtifact.webGpuParityScope.browserKernelProbe.schema).toBe('moonlab.webgpu.complex64-probability-kernel-probe.v0');
      expect(moonlabArtifact.webGpuParityScope.browserKernelProbe.kernel).toBe('compute_probabilities');
      expect(moonlabArtifact.webGpuParityScope.browserKernelProbe.executed).toBe(true);
      expect(moonlabArtifact.webGpuParityScope.browserKernelProbe.passed).toBe(true);
      expect(moonlabArtifact.webGpuParityScope.browserKernelProbe.coveredNativeOperations).toEqual(['compute_probabilities']);
      expect(moonlabArtifact.webGpuParityScope.browserNativeOperationProbe.schema).toBe('moonlab.webgpu.complex64-native-operation-probe.v0');
      expect(moonlabArtifact.webGpuParityScope.browserNativeOperationProbe.executed).toBe(true);
      expect(moonlabArtifact.webGpuParityScope.browserNativeOperationProbe.passed).toBe(true);
      expect(moonlabArtifact.webGpuParityScope.browserNativeOperationProbe.coveredNativeOperations).toEqual([
        'hadamard',
        'pauli_x',
        'pauli_z',
        'cnot'
      ]);
      for (const operation of ['hadamard', 'pauli_x', 'pauli_z', 'cnot']) {
        const operationResult = moonlabArtifact.webGpuParityScope.browserNativeOperationProbe.operationResults
          .find((entry) => entry.operation === operation);
        expect(operationResult).toMatchObject({
          operation,
          executed: true,
          passed: true,
          covered: true
        });
        expect(operationResult.blocker).toBeUndefined();
        expect(operationResult.maxAmplitudeAbsDiff).toBeLessThanOrEqual(operationResult.tolerance);
      }
      expect(moonlabArtifact.webGpuParityScope.complex64Preflight.passed).toBe(true);
      expect(moonlabArtifact.webGpuParityScope.fullFidelityMagnetarSimulation).toBe(false);
      expect(moonlabArtifact.webGpuParityScope.fullPhysicsValidation).toBe(false);
      expect(moonlabArtifact.webGpuParityScope.blockers).toEqual([]);
      expect(webGpuParityHandoffSummaryReady).toBe(true);
      expect(moonlabArtifact.webGpuParityHandoffSummary.schema).toBe(
        'moonlab.webgpu.complex64-parity-handoff-summary.v0'
      );
      expect(moonlabArtifact.webGpuParityHandoffSummary.sourceSchema).toBe(
        'moonlab.webgpu.complex64-parity-scope.v0'
      );
      expect(moonlabArtifact.webGpuParityHandoffSummary.status).toBe('scope-ready-backend-detected');
      expect(moonlabArtifact.webGpuParityHandoffSummary.reducedFixtureOnly).toBe(true);
      expect(moonlabArtifact.webGpuParityHandoffSummary.reducedFixtureWebGpuParityReady).toBe(true);
      expect(moonlabArtifact.webGpuParityHandoffSummary.runtimeBackendReady).toBe(false);
      expect(moonlabArtifact.webGpuParityHandoffSummary.backendAvailable).toBe(true);
      expect(moonlabArtifact.webGpuParityHandoffSummary.requireBackend).toBe(true);
      expect(moonlabArtifact.webGpuParityHandoffSummary.contractValidationValid).toBe(true);
      expect(moonlabArtifact.webGpuParityHandoffSummary.readinessClaim).toBe(
        'integration-tolerance-gate-only'
      );
      expect(moonlabArtifact.webGpuParityHandoffSummary.fullFidelityMagnetarSimulation).toBe(false);
      expect(moonlabArtifact.webGpuParityHandoffSummary.fullPhysicsValidation).toBe(false);
      expect(moonlabArtifact.webGpuParityHandoffSummary.backendPreflight.stage).toBe('device-acquired');
      expect(moonlabArtifact.webGpuParityHandoffSummary.backendPreflight.navigatorGpuAvailable).toBe(true);
      expect(moonlabArtifact.webGpuParityHandoffSummary.backendPreflight.adapterAvailable).toBe(true);
      expect(moonlabArtifact.webGpuParityHandoffSummary.backendPreflight.deviceAcquired).toBe(true);
      expect(moonlabArtifact.webGpuParityHandoffSummary.nativeCoverage.required).toEqual(
        MOONLAB_WEBGPU_HANDOFF_SUMMARY_COVERED_OPERATIONS
      );
      expect(moonlabArtifact.webGpuParityHandoffSummary.nativeCoverage.covered).toEqual(
        MOONLAB_WEBGPU_HANDOFF_SUMMARY_COVERED_OPERATIONS
      );
      expect(moonlabArtifact.webGpuParityHandoffSummary.nativeCoverage.missing).toEqual([]);
      expect(moonlabArtifact.webGpuParityHandoffSummary.nativeCoverage.excluded).toEqual(
        MOONLAB_WEBGPU_HANDOFF_SUMMARY_EXCLUDED_OPERATIONS
      );
      expect(moonlabArtifact.webGpuParityHandoffSummary.webgpuParity.executed).toBe(true);
      expect(moonlabArtifact.webGpuParityHandoffSummary.webgpuParity.passed).toBe(true);
      expect(moonlabArtifact.webGpuParityHandoffSummary.blockers).toEqual([]);
      expect(moonlabArtifact.webGpuParityHandoffSummary.validationErrors).toEqual([]);
    } else {
      expect(moonlabArtifact.webGpuParityScope).toBe(null);
      expect(moonlabArtifact.webGpuParityHandoffSummary).toBe(null);
    }
    expect(moonlabArtifact.calibrationArtifacts.magnetarDipoleIsing.schema).toBe('peercompute.ulg.magnetar-dipole-ising-calibration.v0');
    expect(moonlabArtifact.calibrationArtifacts.magnetarDipoleIsing.validation.status).toBe('pass');
    expect(moonlabArtifact.calibrationArtifacts.magnetarDipoleIsing.parity.status).toBe('pass');
    expect(moonlabArtifact.calibrationArtifacts.magnetarDipoleIsing.summary.scope).toBe('calibration-probe-not-full-magnetar-simulation');
    expect(moonlabArtifact.calibrationArtifacts.magnetarDipoleIsing.summary.groundState.bitString).toBe('000');
    expect(moonlabArtifact.calibrationArtifacts.magnetarDipoleIsing.summary.groundState.referenceEnergy).toBeCloseTo(-1.6712962962963, 12);
    expect(moonlabArtifact.calibrationArtifacts.magnetarDipoleIsing.summary.groundState.energyUnits).toBe('normalized-ising');
    expect(moonlabArtifact.outputs.reference.schema).toBe('moonlab.magnetar-dipole-ising-reference.v0');
    expect(moonlabArtifact.outputs.reference.role).toBe('peercompute-reference-tolerance-input');
    expect(moonlabArtifact.outputs.reference.contractHash).toBe('sha256:f85763af06f271c414d55e29884ee7b0d5738a4a7ec9351493964b98f8d4e1ec');
    expect(moonlabArtifact.outputs.reference.energyUnits).toBe('normalized-ising');
    expect(moonlabArtifact.outputs.reference.observables.groundState.bitString).toBe('000');
    expect(moonlabArtifact.outputs.reference.observables.groundState.referenceEnergy).toBeCloseTo(-1.6712962962963, 12);
    expect(moonlabArtifact.outputs.reference.observables.energySpectrum).toHaveLength(8);
    expect(moonlabArtifact.outputs.reference.tolerances.energyAbs).toBe(1e-9);
    expect(moonlabArtifact.outputs.reference.tolerances.maxObservedEnergyDelta).toBe(0);
    expect(moonlabArtifact.outputs.reference.validation.parityPassed).toBe(true);
    expect(moonlabArtifact.outputs.reference.validation.evaluatedBitstrings).toBe(8);
    const calibratedFamilies = [
      'magnetosphere-mhd',
      'pic-kinetic-plasma',
      'radiation-transport',
      'relativistic-correction'
    ];
    expect(moonlabArtifact.outputs.references).toHaveLength(4);
    expect(moonlabArtifact.outputs.references.map((reference) => reference.family)).toEqual(calibratedFamilies);
    const suppliedReferenceContractsReady = moonlabArtifact.runtime.coreProbe.referenceContracts?.status === 'ready';
    const expectedOutputReferenceReadyCount = suppliedReferenceContractsReady ? 5 : 2;
    const expectedCalibratedReferenceReadyCount = suppliedReferenceContractsReady ? 4 : 1;
    const magnetosphereReference = moonlabArtifact.outputs.references[0];
    expect(magnetosphereReference.schema).toBe('moonlab.magnetar.calibrated-reference.v0');
    expect(magnetosphereReference.role).toBe('peercompute-scientific-tolerance-input');
    expect(magnetosphereReference.solverId).toBe('moonlab-analytic-dipole-field-v0');
    expect(magnetosphereReference.contractHash).toBe(moonlabArtifact.outputs.reference.contractHash);
    expect(magnetosphereReference.unitsHash).toBe('sha256:b9ef2d46ec5f2d0c1fb8a2866012e9340a67f188ebc8a579b93ce61e72f4b4a5');
    expect(magnetosphereReference.status).toBe('calibrated-reference-ready');
    expect(magnetosphereReference.ready).toBe(true);
    expect(magnetosphereReference.scientificCoverage).toBe(true);
    expect(magnetosphereReference.validation.status).toBe('pass');
    expect(magnetosphereReference.blocker).toBe(null);
    const suppliedReferences = moonlabArtifact.outputs.references.slice(1);
    for (const reference of suppliedReferences) {
      expect(reference.schema).toBe('moonlab.magnetar.calibrated-reference.v0');
      expect(reference.role).toBe('peercompute-scientific-tolerance-input');
      if (suppliedReferenceContractsReady) {
        expect(reference.status).toBe('calibrated-reference-ready');
        expect(reference.ready).toBe(true);
        expect(reference.scientificCoverage).toBe(true);
        expect(reference.validation.status).toBe('pass');
        expect(reference.contractHash).toContain('sha256:');
        expect(reference.unitsHash).toContain('sha256:');
        expect(reference.blocker).toBe(null);
      } else {
        expect(reference.status).toBe('calibrated-reference-missing');
        expect(reference.ready).toBe(false);
        expect(reference.scientificCoverage).toBe(false);
        expect(reference.validation.status).toBe('missing');
        expect(reference.contractHash).toBe(null);
        expect(reference.unitsHash).toBe(null);
      }
    }
    expect(moonlabArtifact.validationMetrics.magnetarMaxEnergyDelta).toBe(0);
    expect(moonlabArtifact.validationMetrics.magnetarEvaluatedBitstrings).toBe(8);
    expect(moonlabArtifact.validationMetrics.outputReferenceCount).toBe(5);
    expect(moonlabArtifact.validationMetrics.magnetarCalibratedReferenceCount).toBe(4);
    expect(moonlabArtifact.validationMetrics.magnetarCalibratedReferenceReadyCount).toBe(expectedCalibratedReferenceReadyCount);
    expect(moonlabArtifact.outputs.magnetarDipoleIsing.evaluatedBitstrings).toBe(8);
    expect(moonlabArtifact.validation.status).toBe('pass');
    expect(moonlabTelemetryRecord.artifactSummary.schema).toBe('peercompute.ulg.artifact-summary.v0');
    expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuParityScopeReady).toBe(webGpuParityScopeReady);
    if (webGpuParityScopeReady) {
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuParityScopeSchema).toBe('moonlab.webgpu.complex64-parity-scope.v0');
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuParityScopeStatus).toBe('scope-ready-backend-detected');
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuParityScopeBackendAvailable).toBe(true);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuBrowserBackendPreflightDeclared).toBe(true);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuBrowserBackendPreflightStage).toBe('device-acquired');
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuBrowserBackendPreflightNavigatorGpuAvailable).toBe(true);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuBrowserBackendPreflightAdapterAvailable).toBe(true);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuBrowserBackendPreflightDeviceAcquired).toBe(true);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuParityExecuted).toBe(true);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuParityPassed).toBe(true);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuProbabilityKernelProbeDeclared).toBe(true);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuProbabilityKernel).toBe('compute_probabilities');
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuProbabilityKernelExecuted).toBe(true);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuProbabilityKernelPassed).toBe(true);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuProbabilityKernelCoveredNativeOperations).toEqual(['compute_probabilities']);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuNativeOperationProbeDeclared).toBe(true);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuNativeOperationProbeExecuted).toBe(true);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuNativeOperationProbePassed).toBe(true);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuNativeOperationCoveredOperations).toEqual([
        'hadamard',
        'pauli_x',
        'pauli_z',
        'cnot'
      ]);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuNativeOperationProbeOperationCount).toBe(4);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuNativeOperationProbeCoveredOperationCount).toBe(4);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuNativeOperationProbeDeclaredOperations).toEqual([
        'hadamard',
        'pauli_x',
        'pauli_z',
        'cnot'
      ]);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuNativeOperationProbeBlockedOperations).toEqual([]);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuNativeOperationProbeTargetOperations).toEqual([
        'hadamard',
        'pauli_x',
        'pauli_z',
        'cnot'
      ]);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuNativeOperationProbeMissingTargetOperations).toEqual([]);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuHadamardNativeOperationDeclared).toBe(true);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuHadamardNativeOperationExecuted).toBe(true);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuHadamardNativeOperationCovered).toBe(true);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuHadamardNativeOperationBlocker).toBe(null);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuPauliXNativeOperationDeclared).toBe(true);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuPauliXNativeOperationExecuted).toBe(true);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuPauliXNativeOperationCovered).toBe(true);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuPauliXNativeOperationBlocker).toBe(null);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabComplex64PreflightPassed).toBe(true);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuParityScopeFullFidelityMagnetarSimulation).toBe(false);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuParityScopeFullPhysicsValidation).toBe(false);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuParityScopeBlockers).toEqual([]);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuParityHandoffSummaryReady).toBe(true);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuParityHandoffSummarySchema).toBe(
        'moonlab.webgpu.complex64-parity-handoff-summary.v0'
      );
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuParityHandoffSummaryStatus).toBe(
        'scope-ready-backend-detected'
      );
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuParityHandoffSummaryRuntimeBackendReady).toBe(false);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuParityHandoffSummaryReducedFixtureOnly).toBe(true);
      expect(
        moonlabTelemetryRecord.artifactSummary.moonlabWebGpuParityHandoffSummaryReducedFixtureWebGpuParityReady
      ).toBe(true);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuParityHandoffSummaryReadinessClaim).toBe(
        'integration-tolerance-gate-only'
      );
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuParityHandoffSummaryCoveredOperations).toEqual(
        MOONLAB_WEBGPU_HANDOFF_SUMMARY_COVERED_OPERATIONS
      );
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuParityHandoffSummaryMissingOperations).toEqual([]);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuParityHandoffSummaryExcludedOperations).toEqual(
        MOONLAB_WEBGPU_HANDOFF_SUMMARY_EXCLUDED_OPERATIONS
      );
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuParityHandoffSummaryBlockers).toEqual([]);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuParityHandoffSummaryValidationErrors).toEqual([]);
      expect(
        moonlabTelemetryRecord.artifactSummary.moonlabWebGpuParityHandoffSummaryFullFidelityMagnetarSimulation
      ).toBe(false);
      expect(moonlabTelemetryRecord.artifactSummary.moonlabWebGpuParityHandoffSummaryFullPhysicsValidation).toBe(false);
    }
    expect(moonlabTelemetryRecord.artifactSummary.magnetarDipoleIsingReady).toBe(true);
    expect(moonlabTelemetryRecord.artifactSummary.magnetarDipoleIsingGroundState).toBe('000');
    expect(moonlabTelemetryRecord.artifactSummary.magnetarDipoleIsingMaxEnergyDelta).toBe(0);
    expect(moonlabTelemetryRecord.artifactSummary.magnetarDipoleIsingEvaluatedBitstrings).toBe(8);
    expect(moonlabTelemetryRecord.artifactSummary.magnetarReferenceReady).toBe(true);
    expect(moonlabTelemetryRecord.artifactSummary.magnetarReferenceSchema).toBe('moonlab.magnetar-dipole-ising-reference.v0');
    expect(moonlabTelemetryRecord.artifactSummary.magnetarReferenceRole).toBe('peercompute-reference-tolerance-input');
    expect(moonlabTelemetryRecord.artifactSummary.magnetarReferenceContractHash).toBe('sha256:f85763af06f271c414d55e29884ee7b0d5738a4a7ec9351493964b98f8d4e1ec');
    expect(moonlabTelemetryRecord.artifactSummary.magnetarReferenceEnergyUnits).toBe('normalized-ising');
    expect(moonlabTelemetryRecord.artifactSummary.magnetarReferenceGroundStateBitString).toBe('000');
    expect(moonlabTelemetryRecord.artifactSummary.magnetarReferenceGroundStateEnergy).toBeCloseTo(-1.6712962962963, 12);
    expect(moonlabTelemetryRecord.artifactSummary.magnetarReferenceToleranceEnergyAbs).toBe(1e-9);
    expect(moonlabTelemetryRecord.artifactSummary.magnetarReferenceMaxObservedEnergyDelta).toBe(0);
    expect(moonlabTelemetryRecord.artifactSummary.magnetarReferenceValidationStatus).toBe('pass');
    expect(moonlabTelemetryRecord.artifactSummary.outputReferenceCount).toBe(5);
    expect(moonlabTelemetryRecord.artifactSummary.outputReferenceReadyCount).toBe(expectedOutputReferenceReadyCount);
    expect(moonlabTelemetryRecord.artifactSummary.outputReferences[0].schema).toBe('moonlab.magnetar-dipole-ising-reference.v0');
    expect(moonlabTelemetryRecord.artifactSummary.outputReferences[0].contractHash).toBe(moonlabArtifact.outputs.reference.contractHash);
    expect(moonlabTelemetryRecord.artifactSummary.magnetarCalibratedReferenceCount).toBe(4);
    expect(moonlabTelemetryRecord.artifactSummary.magnetarCalibratedReferenceReadyCount).toBe(expectedCalibratedReferenceReadyCount);
    expect(moonlabTelemetryRecord.artifactSummary.magnetarCalibratedReferenceScientificCoverageCount).toBe(expectedCalibratedReferenceReadyCount);
    expect(moonlabTelemetryRecord.artifactSummary.magnetarCalibratedReferences.map((reference) => reference.family)).toEqual(calibratedFamilies);
    expect(moonlabTelemetryRecord.artifactSummary.magnetarCalibratedReferences[0].blocker).toBe(null);
    expect(moonlabTelemetryRecord.artifactSummary.magnetarCalibratedReferences[0].ready).toBe(true);
    expect(moonlabTelemetryRecord.artifactSummary.magnetarCalibratedReferences[0].fidelityRuntimeScope).toMatchObject({
      schema: 'ulg.magnetar.fidelity-runtime-scope.v0',
      reducedCalibratedRuntimeFixture: true,
      fullFidelityMagnetarSimulation: false,
      fullPhysicsValidation: false
    });
    const moonlabHandoff = handoff.artifacts.find((artifact) => artifact.ref.sourceService === 'moonlab');
    expect(moonlabHandoff.artifact.outputs.references).toHaveLength(4);
    expect(moonlabHandoff.artifact.outputs.references.map((reference) => reference.family)).toEqual(calibratedFamilies);
    expect(moonlabHandoff.artifact.outputs.references[0].ready).toBe(true);
    expect(moonlabHandoff.artifactSummary.moonlabWebGpuParityScopeReady).toBe(webGpuParityScopeReady);
    if (webGpuParityScopeReady) {
      expect(moonlabHandoff.artifact.webGpuParityScope.schema).toBe('moonlab.webgpu.complex64-parity-scope.v0');
      expect(moonlabHandoff.artifact.webGpuParityScope.backendAvailable).toBe(true);
      expect(moonlabHandoff.artifact.webGpuParityScope.webgpuParity.executed).toBe(true);
      expect(moonlabHandoff.artifact.webGpuParityScope.webgpuParity.passed).toBe(true);
      expect(moonlabHandoff.artifactSummary.moonlabWebGpuProbabilityKernelProbeDeclared).toBe(true);
      expect(moonlabHandoff.artifactSummary.moonlabWebGpuProbabilityKernelExecuted).toBe(true);
      expect(moonlabHandoff.artifactSummary.moonlabWebGpuNativeOperationProbeDeclared).toBe(true);
      expect(moonlabHandoff.artifactSummary.moonlabWebGpuHadamardNativeOperationCovered).toBe(true);
      expect(moonlabHandoff.artifactSummary.moonlabWebGpuPauliXNativeOperationCovered).toBe(true);
      expect(moonlabHandoff.artifactSummary.moonlabWebGpuNativeOperationProbeBlockedOperations).toEqual([]);
      expect(moonlabHandoff.artifactSummary.moonlabWebGpuNativeOperationProbeMissingTargetOperations).toEqual([]);
      expect(moonlabHandoff.artifact.webGpuParityScope.fullPhysicsValidation).toBe(false);
      expect(moonlabHandoff.artifact.webGpuParityHandoffSummary.schema).toBe(
        'moonlab.webgpu.complex64-parity-handoff-summary.v0'
      );
      expect(moonlabHandoff.artifact.webGpuParityHandoffSummary.runtimeBackendReady).toBe(false);
      expect(moonlabHandoff.artifact.webGpuParityHandoffSummary.nativeCoverage.covered).toEqual(
        MOONLAB_WEBGPU_HANDOFF_SUMMARY_COVERED_OPERATIONS
      );
      expect(moonlabHandoff.artifactSummary.moonlabWebGpuParityHandoffSummaryReady).toBe(true);
      expect(moonlabHandoff.artifactSummary.moonlabWebGpuParityHandoffSummaryRuntimeBackendReady).toBe(false);
      expect(moonlabHandoff.artifactSummary.moonlabWebGpuParityHandoffSummaryCoveredOperations).toEqual(
        MOONLAB_WEBGPU_HANDOFF_SUMMARY_COVERED_OPERATIONS
      );
      expect(moonlabHandoff.artifactSummary.moonlabWebGpuParityHandoffSummaryFullPhysicsValidation).toBe(false);
    }
    expect(moonlabHandoff.artifactSummary.outputReferenceCount).toBe(5);
    expect(moonlabHandoff.artifactSummary.outputReferenceReadyCount).toBe(expectedOutputReferenceReadyCount);
    expect(moonlabHandoff.artifactSummary.magnetarCalibratedReferenceCount).toBe(4);
    expect(moonlabHandoff.artifactSummary.magnetarCalibratedReferenceReadyCount).toBe(expectedCalibratedReferenceReadyCount);
  }
});

test('SPH phase demo opens collapsed and starts from URL params', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 900, height: 680 });
  await page.goto('/?drop=Na&base=h2o&dropt=293.15&baset=293.15&boxx=5&boxy=5&boxz=5');

  await expect(page.locator('#sph-phase-overlay')).toBeVisible();
  await expect(page.locator('#sph-panel')).toHaveClass(/collapsed/);
  await expect(page.locator('#sph-play')).toHaveText(/Play|Pause/);
  await expect(page.locator('#sph-status')).toContainText(/resident profile : submissions=[1-9]|worker-view-state|pending worker view-state/);
});

test('SPH phase visual sequence captures dense H2O/H2O resident motion', async ({ page }, testInfo) => {
  test.skip(!SPH_VISUAL_CAPTURE_ENABLED, 'Set ULG_SPH_VISUAL_CAPTURE=1 to record SPH visual sequence artifacts.');
  test.setTimeout(envPositiveInteger('ULG_SPH_VISUAL_TIMEOUT_MS', 300_000));
  const visualUrl = process.env.ULG_SPH_VISUAL_URL
    || '/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=2.5&dropn=3&basen=5&boxx=5&boxy=5&boxz=5';
  const visualLabel = process.env.ULG_SPH_VISUAL_LABEL || 'sph-h2o-h2o-resident-motion';
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(withVisualCaptureParam(visualUrl));
  if (await page.locator('#sph-phase-overlay').count() === 0) {
    await page.locator('#run-sph-phase').click();
  }
  await expect(page.locator('#sph-phase-overlay')).toBeVisible();
  await page.waitForFunction(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const scene = overlay?.__sphScene;
    return Boolean(scene?.getSphGpuParticleState?.()?.schema || overlay?.__sphDriver);
  }, null, { timeout: 60_000 });
  const playText = await page.locator('#sph-play').textContent();
  if (!/Pause/i.test(playText || '')) {
    await page.locator('#sph-play').click();
  }
  await page.waitForFunction(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const scene = overlay?.__sphScene;
    const steps = scene?.getMlsMpmResidentSteps?.() || overlay?.__mlsMpmResidentSteps;
    const residentStep = scene?.getMlsMpmResidentStep?.() || overlay?.__mlsMpmResidentStep || steps?.finalStep;
    return Boolean(residentStep?.schema || steps?.schema || overlay?.__sphDriver);
  }, null, { timeout: 60_000 });

  const timeline = await captureSphPhaseVisualSequence(page, testInfo, {
    label: visualLabel,
    frameCount: envPositiveInteger('ULG_SPH_VISUAL_FRAMES', DEFAULT_SPH_VISUAL_FRAME_COUNT),
    intervalMs: envPositiveInteger('ULG_SPH_VISUAL_INTERVAL_MS', DEFAULT_SPH_VISUAL_INTERVAL_MS),
    advanceTimeoutMs: envPositiveInteger('ULG_SPH_VISUAL_ADVANCE_TIMEOUT_MS', 60_000)
  });
  expect(timeline.frameCount).toBeGreaterThan(0);
  expect(timeline.metrics.length).toBeGreaterThan(0);
  if (timeline.simulationCadence?.sampleCount > 1) {
    expect(timeline.simulationCadence.advancedIntervalCount).toBeGreaterThan(0);
    expect(timeline.simulationCadence.status).not.toBe('simulation-did-not-advance');
  }
  expect(timeline.metrics.some((metric) => metric.surfaces.visibleCount > 0)).toBe(true);
  expect(timeline.metrics.some((metric) => (
    (metric.residentStep?.diagnostics?.activeGridNodeCount ?? 0) > 0
      || metric.residentSteps?.backend
      || /resident backend/i.test(metric.statusText)
  ))).toBe(true);
  const h2oVisibleSurfaces = timeline.metrics.flatMap((metric) => (
    metric.surfaces?.visible || []
  ).filter((surface) => surface.materialKey === 'h2o' && surface.phase === 'liquid'));
  const unboundedH2oSurfaces = h2oVisibleSurfaces.filter((surface) => (
    (surface.vertexCount ?? 0) > 0 && !surface.worldBounds
  ));
  expect(unboundedH2oSurfaces).toEqual([]);
  const boundedH2oSurfaces = h2oVisibleSurfaces.filter((surface) => surface.worldBounds?.size);
  expect(boundedH2oSurfaces.length).toBeGreaterThan(0);
  const finalBoundedH2o = boundedH2oSurfaces.at(-1);
  const finalSize = finalBoundedH2o.worldBounds.size;
  const lateralSpanM = Math.max(finalSize[0], finalSize[2]);
  const verticalAspect = finalSize[1] / Math.max(lateralSpanM, 1e-9);
  expect(lateralSpanM).toBeGreaterThan(Number(process.env.ULG_SPH_VISUAL_MIN_H2O_LATERAL_M || 0.5));
  expect(verticalAspect).toBeLessThan(Number(process.env.ULG_SPH_VISUAL_MAX_H2O_VERTICAL_ASPECT || 6));
});

test('SPH phase resident long-horizon probe records H2O/H2O stability', async ({ page }, testInfo) => {
  test.skip(!SPH_LONG_HORIZON_CAPTURE_ENABLED, 'Set ULG_SPH_LONG_HORIZON_CAPTURE=1 to record SPH long-horizon artifacts.');
  test.setTimeout(envPositiveInteger('ULG_SPH_LONG_HORIZON_TIMEOUT_MS', 300_000));
  const probeUrl = process.env.ULG_SPH_LONG_HORIZON_URL
    || '/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=0.85&dropn=3&basen=5&boxx=5&boxy=5&boxz=5';
  const probeLabel = process.env.ULG_SPH_LONG_HORIZON_LABEL || 'sph-h2o-h2o-contact-long-horizon';
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(withVisualCaptureParam(probeUrl));
  if (await page.locator('#sph-phase-overlay').count() === 0) {
    await page.locator('#run-sph-phase').click();
  }
  await expect(page.locator('#sph-phase-overlay')).toBeVisible();
  await page.waitForFunction(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const scene = overlay?.__sphScene;
    return Boolean(scene?.getSphGpuParticleState?.()?.schema || overlay?.__sphDriver);
  }, null, { timeout: 60_000 });
  const playText = await page.locator('#sph-play').textContent();
  if (/Pause/i.test(playText || '')) {
    await page.locator('#sph-play').evaluate((button) => button.click());
  }
  await page.waitForFunction(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const scene = overlay?.__sphScene;
    const steps = scene?.getMlsMpmResidentSteps?.() || overlay?.__mlsMpmResidentSteps;
    return Boolean(steps?.schema || overlay?.__sphDriver);
  }, null, { timeout: 60_000 });
  await page.waitForFunction(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    return !overlay?.__mlsMpmResidentStepsPending;
  }, null, { timeout: 60_000 });

  const timeline = await captureSphResidentLongHorizonProbe(page, testInfo, {
    label: probeLabel,
    batchCount: envPositiveInteger('ULG_SPH_LONG_HORIZON_BATCHES', DEFAULT_SPH_LONG_HORIZON_BATCH_COUNT),
    batchStepCount: envPositiveInteger('ULG_SPH_LONG_HORIZON_BATCH_STEPS', DEFAULT_SPH_LONG_HORIZON_BATCH_STEPS),
    renderEveryBatches: envPositiveInteger('ULG_SPH_LONG_HORIZON_RENDER_EVERY', 1),
    maxFrameCount: envPositiveInteger('ULG_SPH_LONG_HORIZON_FRAMES', envPositiveInteger('ULG_SPH_LONG_HORIZON_MAX_FRAMES', 6)),
    readbackMode: process.env.ULG_SPH_LONG_HORIZON_READBACK_MODE || 'no-full-readback',
    renderReadbackMode: process.env.ULG_SPH_LONG_HORIZON_RENDER_READBACK_MODE || 'full-parity-readback',
    renderTimeoutMs: envPositiveInteger('ULG_SPH_LONG_HORIZON_RENDER_TIMEOUT_MS', 30_000),
    minVisibleSurfaceMotionM: Number(process.env.ULG_SPH_LONG_HORIZON_MIN_VISIBLE_MOTION_M || 1e-5),
    maxSpeedMPerS: Number(process.env.ULG_SPH_LONG_HORIZON_MAX_SPEED || 50),
    minVolumeRatioJ: Number(process.env.ULG_SPH_LONG_HORIZON_MIN_J || 0.95),
    maxVolumeRatioJ: Number(process.env.ULG_SPH_LONG_HORIZON_MAX_J || 1.05)
  });
  expect(timeline.status).toBe('complete');
  expect(timeline.metrics.length).toBeGreaterThan(1);
  expect(timeline.analysis.status).toBe('long-horizon-probe-stable');
  expect(timeline.analysis.issues).toEqual([]);
  expect(timeline.analysis.maxDisplacementObservedM).toBeGreaterThan(0);
  expect(timeline.analysis.h2oVisibleSurfaceSampleCount).toBeGreaterThan(0);
});

test('SPH phase demo clear cache removes static table storage and reports cleared probe counts', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 900, height: 680 });
  await page.goto('/?drop=fe&base=h2o&dropt=1850&baset=233.15&dropn=2&basen=2&boxx=3&boxy=3&boxz=3');
  if (await page.locator('#sph-phase-overlay').count() === 0) {
    await page.locator('#run-sph-phase').click();
  }
  await expect(page.locator('#sph-phase-overlay')).toBeVisible();
  await expect(page.locator('#sph-clear-cache')).toBeVisible();
  await page.waitForFunction(() => {
    const update = document.querySelector('#sph-phase-overlay')?.__sphPeerClosureCache?.staticTableWrite;
    return update?.schema === 'peercompute.ulg.sph-static-table-cache-update.v0'
      && update.status === 'stored'
      && update.counts?.tables >= 4
      && update.counts?.gpuWarmup >= 1;
  }, null, { timeout: 60_000 });

  const staticTableCacheBeforeClear = await page.evaluate(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const cache = overlay?.__sphPeerClosureCache || {};
    const storageKeys = {
      material: 'peercompute.ulg.sph-derived-closure-cache.v1',
      coldStart: 'peercompute.ulg.sph-cold-start-cache.v1',
      staticTables: cache.staticTableWrite?.storageKey || 'peercompute.ulg.sph-static-table-cache.v1'
    };
    const staticTableSnapshot = window.localStorage.getItem(storageKeys.staticTables);
    return {
      storageKeys,
      snapshotBytes: staticTableSnapshot?.length ?? 0,
      tableCount: cache.staticTableWrite?.counts?.tables ?? 0,
      gpuWarmupCount: cache.staticTableWrite?.counts?.gpuWarmup ?? 0
    };
  });
  expect(staticTableCacheBeforeClear.snapshotBytes).toBeGreaterThan(1000);
  expect(staticTableCacheBeforeClear.tableCount).toBeGreaterThanOrEqual(4);
  expect(staticTableCacheBeforeClear.gpuWarmupCount).toBeGreaterThanOrEqual(1);

  const clearCacheProbe = await page.evaluate((storageKeys) => {
    const overlay = document.querySelector('#sph-phase-overlay');
    overlay?.querySelector('#sph-clear-cache')?.click();
    const cache = overlay?.__sphPeerClosureCache || {};
    return {
      clear: cache.clear ?? null,
      writesAfterClear: {
        material: cache.write ?? null,
        coldStart: cache.coldStartWrite ?? null,
        staticTables: cache.staticTableWrite ?? null
      },
      storageAfterClear: {
        material: window.localStorage.getItem(storageKeys.material),
        coldStart: window.localStorage.getItem(storageKeys.coldStart),
        staticTables: window.localStorage.getItem(storageKeys.staticTables)
      }
    };
  }, staticTableCacheBeforeClear.storageKeys);
  expect(clearCacheProbe.clear?.schema).toBe('peercompute.ulg.sph-local-derived-cache-clear.v0');
  expect(clearCacheProbe.clear?.status).toBe('cleared');
  expect(clearCacheProbe.clear?.tableRecords).toBe(staticTableCacheBeforeClear.tableCount);
  expect(clearCacheProbe.clear?.gpuWarmupRecords).toBe(staticTableCacheBeforeClear.gpuWarmupCount);
  expect(clearCacheProbe.writesAfterClear).toEqual({
    material: null,
    coldStart: null,
    staticTables: null
  });
  expect(clearCacheProbe.storageAfterClear).toEqual({
    material: null,
    coldStart: null,
    staticTables: null
  });
});

test('SPH phase reset preserves drop edge above six through mounted render diagnostics', async ({ page }) => {
  test.setTimeout(120_000);
  const requestedEdge = 8;
  const consoleIssues = [];
  page.on('console', (message) => {
    const text = message.text();
    if (/Invalid Buffer|Invalid BindGroup|Invalid CommandBuffer|Error while parsing WGSL|too many warnings|used in submit while destroyed/i.test(text)) {
      consoleIssues.push(text);
    }
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/?drop=h2o&base=h2o&dropt=290&baset=290&iceh=0&ironh=1.5&dropn=${requestedEdge}&basen=${requestedEdge}&boxx=5&boxy=5&boxz=5&mech=mlsmpm&lawp=0&lawt=0&lawr=0&residentAuto=0&residentFuseSequence=1&residentActiveGrid=1&surfaceDraw=three-render-row-spheres&visualCapture=1`);
  if (await page.locator('#sph-phase-overlay').count() === 0) {
    await page.locator('#run-sph-phase').click();
  }
  await expect(page.locator('#sph-phase-overlay')).toBeVisible();
  await page.waitForFunction(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const diagnostics = overlay?.__sphPhaseViewState?.initialParticleEdgeDiagnostics
      || overlay?.__sphDriver?.demo?.initialParticleEdgeDiagnostics;
    return diagnostics?.effectiveDropParticlesPerEdge === 8
      && diagnostics?.effectiveBaseParticlesPerEdge === 8
      && overlay?.__sphSetParticlesTiming?.particleCount === diagnostics.totalGeneratedParticleCount;
  }, null, { timeout: 60_000 });

  await page.evaluate(() => document.querySelector('#sph-reset')?.click());
  await page.waitForFunction(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const diagnostics = overlay?.__sphPhaseViewState?.initialParticleEdgeDiagnostics
      || overlay?.__sphDriver?.demo?.initialParticleEdgeDiagnostics;
    const setParticlesTiming = overlay?.__sphSetParticlesTiming || null;
    return overlay?.__sphResetStatus?.status === 'particle-state-resynced-after-reset'
      && diagnostics?.effectiveDropParticlesPerEdge === 8
      && diagnostics?.effectiveBaseParticlesPerEdge === 8
      && setParticlesTiming?.particleCount === diagnostics.totalGeneratedParticleCount;
  }, null, { timeout: 60_000 });
  await page.evaluate(() => document.querySelector('#sph-step')?.click());
  await page.waitForFunction(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const total = overlay?.__sphPhaseViewState?.initialParticleEdgeDiagnostics?.totalGeneratedParticleCount;
    const scene = overlay?.__sphScene;
    return Number.isFinite(total)
      && scene?.getSphGpuParticleUpload?.()?.particleCount === total
      && scene?.getMlsMpmGpuParticleUpload?.()?.particleCount === total;
  }, null, { timeout: 30_000 });

  const postResetResident = await page.evaluate(async () => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const scene = overlay.__sphScene;
    const execution = await scene.refreshMlsMpmResidentSteps({
      preferWebGpu: true,
      stepCount: 1,
      readbackMode: 'no-full-readback',
      compactSummaryMode: 'every-step',
      compactSummaryScope: 'particle-visual',
      fuseNoFullResidentMechanicsSequence: true,
      fuseNoFullResidentMechanicsActiveGrid: true,
      activeGridDispatchPlanRefreshMode: 'every-step',
      force: true
    });
    overlay.__mlsMpmResidentSteps = execution;
    overlay.__mlsMpmResidentStep = scene.getMlsMpmResidentStep?.() || execution?.finalStep || null;
    const trace = overlay.__sphAppendResidentStageOrderTrace?.({
      status: 'resident-execution-complete-post-reset-regression',
      reason: 'mounted-reset-regression-post-reset-resident-step',
      stepCount: 1,
      readbackMode: 'no-full-readback',
      continueFromResidentState: Boolean(execution?.continuedFromResidentState),
      execution
    }) || overlay.__sphResidentStageOrderTrace || null;
    const finalStep = execution?.finalStep || overlay.__mlsMpmResidentStep || null;
    const diagnostics = finalStep?.diagnostics || null;
    const activeGridDispatch = finalStep?.stageTiming?.activeGridDispatch
      || finalStep?.fusedResidentSequence?.activeGridDispatch
      || finalStep?.gridUpdate?.activeGridDispatch
      || finalStep?.p2gGridProjection?.activeGridDispatch
      || null;
    const traceSummary = trace?.lastEvent?.executionSummary || null;
    return {
      schema: execution?.schema ?? null,
      status: execution?.status ?? null,
      backend: execution?.backend ?? null,
      readbackMode: execution?.readbackMode ?? null,
      completedStepCount: execution?.completedStepCount ?? null,
      continuationAvailable: execution?.continuationAvailable ?? null,
      finalStepStatus: finalStep?.status ?? null,
      finalReadbackMode: finalStep?.readbackMode ?? null,
      maxDisplacementM: diagnostics?.maxDisplacementM ?? null,
      maxSpeedMPerS: diagnostics?.maxSpeedMPerS ?? null,
      activeGridNodeCount: diagnostics?.activeGridNodeCount ?? null,
      activeGridNodeCountAvailable: diagnostics?.activeGridNodeCountAvailable ?? null,
      activeGridNodeSummaryStatus: diagnostics?.activeGridNodeSummaryStatus ?? null,
      activeGridDispatchUseActiveGrid: activeGridDispatch?.useActiveGrid ?? null,
      activeGridDispatchNodeCount: activeGridDispatch?.activeGridNodeCount
        ?? activeGridDispatch?.activeNodeCount
        ?? activeGridDispatch?.dispatchNodeCount
        ?? null,
      compactGpuSummaryStatus: diagnostics?.compactGpuSummaryStatus ?? null,
      traceStatus: trace?.status ?? null,
      traceEventCount: trace?.eventCount ?? null,
      traceLastEventStatus: trace?.lastEvent?.status ?? null,
      traceLastEventReason: trace?.lastEvent?.reason ?? null,
      traceExecutionBackend: traceSummary?.backend ?? null,
      traceExecutionReadbackMode: traceSummary?.readbackMode ?? null,
      traceStageOrder: traceSummary?.stageOrder ?? [],
      traceAuthorityStatus: traceSummary?.residentAuthorityLedgerStatus ?? null,
      traceLeaseStatus: traceSummary?.residentBufferLeaseLedgerStatus ?? null,
      traceActiveGridNodeCount: traceSummary?.diagnostics?.activeGridNodeCount ?? null,
      traceActiveGridDispatchNodeCount: traceSummary?.activeGridDispatch?.activeGridNodeCount
        ?? traceSummary?.activeGridDispatch?.activeNodeCount
        ?? traceSummary?.activeGridDispatch?.dispatchNodeCount
        ?? null,
      traceMaxDisplacementM: traceSummary?.diagnostics?.maxDisplacementM ?? null
    };
  });

  const summary = await page.evaluate(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const scene = overlay?.__sphScene;
    const diagnostics = overlay?.__sphPhaseViewState?.initialParticleEdgeDiagnostics
      || overlay?.__sphDriver?.demo?.initialParticleEdgeDiagnostics
      || null;
    const counts = overlay?.__sphPhaseViewState?.counts || overlay?.__sphDriver?.demo?.counts || null;
    const setParticlesTiming = overlay?.__sphSetParticlesTiming || null;
    const sphUpload = scene?.getSphGpuParticleUpload?.() || null;
    const mlsUpload = scene?.getMlsMpmGpuParticleUpload?.() || null;
    const renderState = scene?.getSphResidentRenderState?.() || overlay?.__sphResidentRenderState || null;
    const residentStageOrderTrace = overlay?.__sphResidentStageOrderTrace || null;
    const viewParticleCount = overlay?.__sphPhaseViewState?.positionsM?.length
      ? overlay.__sphPhaseViewState.positionsM.length / 3
      : null;
    return {
      resetStatus: overlay?.__sphResetStatus || null,
      diagnostics,
      counts,
      viewParticleCount,
      setParticlesTiming: {
        schema: setParticlesTiming?.schema,
        particleCount: setParticlesTiming?.particleCount ?? null,
        renderDomainCounts: setParticlesTiming?.renderDomainCounts ?? null
      },
      sphUpload: {
        schema: sphUpload?.schema,
        status: sphUpload?.status,
        particleCount: sphUpload?.particleCount ?? null
      },
      mlsUpload: {
        schema: mlsUpload?.schema,
        status: mlsUpload?.status,
        particleCount: mlsUpload?.particleCount ?? null
      },
      renderState: {
        schema: renderState?.schema,
        status: renderState?.status,
        source: renderState?.source,
        particleCount: renderState?.particleCount ?? null
      },
      residentStageOrderTrace: residentStageOrderTrace ? {
        schema: residentStageOrderTrace.schema ?? null,
        status: residentStageOrderTrace.status ?? null,
        eventCount: residentStageOrderTrace.eventCount ?? null,
        retainedEventCount: residentStageOrderTrace.retainedEventCount ?? null,
        resetGeneration: residentStageOrderTrace.resetGeneration ?? null,
        lastEventStatus: residentStageOrderTrace.lastEvent?.status ?? null,
        lastEventParticleCount: residentStageOrderTrace.lastEvent?.particleCount ?? null,
        lastEventResetStatus: residentStageOrderTrace.lastEvent?.resetStatus ?? null,
        events: Array.isArray(residentStageOrderTrace.events)
          ? residentStageOrderTrace.events.map((event) => ({
            status: event.status ?? null,
            particleCount: event.particleCount ?? null,
            resetStatus: event.resetStatus ?? null
          }))
          : []
      } : null
    };
  });

  const expectedDropCount = requestedEdge ** 3;
  const expectedBaseCount = requestedEdge ** 3;
  const expectedTotalCount = expectedDropCount + expectedBaseCount;
  expect(summary.resetStatus?.schema).toBe('peercompute.ulg.sph-demo-reset-status.v0');
  expect(summary.resetStatus?.status).toBe('particle-state-resynced-after-reset');
  expect(summary.diagnostics?.schema).toBe('peercompute.ulg.sph-initial-particle-edge-diagnostics.v0');
  expect(summary.diagnostics?.requestedDropParticlesPerEdge).toBe(requestedEdge);
  expect(summary.diagnostics?.effectiveDropParticlesPerEdge).toBe(requestedEdge);
  expect(summary.diagnostics?.effectiveBaseParticlesPerEdge).toBe(requestedEdge);
  expect(summary.diagnostics?.requestedEdgePreservationStatus).toBe('preserved');
  expect(summary.diagnostics?.totalGeneratedParticleCount).toBe(expectedTotalCount);
  expect(summary.counts).toEqual({ drop: expectedDropCount, base: expectedBaseCount, total: expectedTotalCount });
  expect(summary.viewParticleCount).toBe(expectedTotalCount);
  expect(summary.setParticlesTiming.schema).toBe('peercompute.ulg.sph-scene-set-particles-timing.v0');
  expect(summary.setParticlesTiming.particleCount).toBe(expectedTotalCount);
  expect(summary.setParticlesTiming.renderDomainCounts).toEqual(summary.counts);
  expect(summary.sphUpload.status).toBe('webgpu-uploaded');
  expect(summary.sphUpload.particleCount).toBe(expectedTotalCount);
  expect(summary.mlsUpload.status).toBe('webgpu-uploaded');
  expect(summary.mlsUpload.particleCount).toBe(expectedTotalCount);
  expect(postResetResident.backend).toBe('webgpu');
  expect(postResetResident.readbackMode).toBe('no-full-readback');
  expect(postResetResident.completedStepCount).toBe(1);
  expect(postResetResident.finalStepStatus).toBe('resident-step-webgpu-executed');
  expect(postResetResident.finalReadbackMode).toBe('no-full-readback');
  expect(postResetResident.maxDisplacementM).toBeGreaterThan(0);
  expect(postResetResident.maxSpeedMPerS).toBeGreaterThan(0);
  const postResetActiveGridNodeCount = postResetResident.activeGridNodeCount
    ?? postResetResident.activeGridDispatchNodeCount;
  expect(
    postResetResident.activeGridDispatchUseActiveGrid,
    JSON.stringify(postResetResident, null, 2)
  ).toBe(true);
  expect(postResetActiveGridNodeCount).toBeGreaterThan(0);
  if (postResetResident.activeGridNodeCountAvailable === true) {
    expect(postResetResident.activeGridNodeCount).toBeGreaterThan(0);
    expect(postResetResident.activeGridNodeSummaryStatus).toBe('active-grid-node-summary-ready');
  }
  expect(postResetResident.traceLastEventStatus).toBe('resident-execution-complete-post-reset-regression');
  expect(postResetResident.traceExecutionBackend).toBe('webgpu');
  expect(postResetResident.traceExecutionReadbackMode).toBe('no-full-readback');
  expect(postResetResident.traceStageOrder).toEqual(expect.arrayContaining(['p2g', 'gridUpdate', 'g2p']));
  expect(postResetResident.traceAuthorityStatus).toBe('resident-authority-ledger-ready');
  expect(postResetResident.traceLeaseStatus).toBe('resident-buffer-lease-ledger-ready');
  expect(postResetResident.traceMaxDisplacementM).toBeGreaterThan(0);
  expect(postResetResident.traceActiveGridNodeCount ?? postResetResident.traceActiveGridDispatchNodeCount)
    .toBeGreaterThan(0);
  if (summary.renderState.schema) {
    expect(summary.renderState.particleCount).toBe(expectedTotalCount);
  }
  expect(summary.residentStageOrderTrace?.schema).toBe('peercompute.ulg.sph-demo-resident-stage-order-trace.v0');
  expect(summary.residentStageOrderTrace?.eventCount).toBeGreaterThanOrEqual(3);
  expect(summary.residentStageOrderTrace?.events).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        status: 'resident-reset-particle-state-resynced',
        particleCount: expectedTotalCount,
        resetStatus: 'particle-state-resynced-after-reset'
      })
    ])
  );
  expect(summary.residentStageOrderTrace?.lastEventStatus).toMatch(/^resident-/);
  expect(consoleIssues).toEqual([]);
});

test('SPH phase reset preserves non-H2O drop edge above six through mounted sphere diagnostics', async ({ page }) => {
  test.setTimeout(120_000);
  const requestedDropEdge = 8;
  const requestedBaseEdge = 5;
  const expectedBaseEdge = requestedBaseEdge;
  const consoleIssues = [];
  page.on('console', (message) => {
    const text = message.text();
    if (/Invalid Buffer|Invalid BindGroup|Invalid CommandBuffer|Error while parsing WGSL|too many warnings|used in submit while destroyed/i.test(text)) {
      consoleIssues.push(text);
    }
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/?drop=fe&base=h2o&dropt=290&baset=290&iceh=0&ironh=1.5&dropn=${requestedDropEdge}&basen=${requestedBaseEdge}&boxx=5&boxy=5&boxz=5&mech=mlsmpm&residentAuto=0&residentFuseSequence=1&residentActiveGrid=1&surfaceDraw=three-render-row-spheres&visualCapture=1`);
  if (await page.locator('#sph-phase-overlay').count() === 0) {
    await page.locator('#run-sph-phase').click();
  }
  await expect(page.locator('#sph-phase-overlay')).toBeVisible();
  await page.waitForFunction(({ requestedDropEdge, expectedBaseEdge }) => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const diagnostics = overlay?.__sphPhaseViewState?.initialParticleEdgeDiagnostics
      || overlay?.__sphDriver?.demo?.initialParticleEdgeDiagnostics;
    const bounds = overlay?.__sphSetParticlesTiming?.renderDomainPositionBounds;
    return diagnostics?.effectiveDropParticlesPerEdge === requestedDropEdge
      && diagnostics?.effectiveBaseParticlesPerEdge === expectedBaseEdge
      && diagnostics?.requestedEdgePreservationStatus === 'preserved'
      && bounds?.drop?.count === requestedDropEdge ** 3
      && bounds?.base?.count === expectedBaseEdge ** 3
      && overlay?.__sphSetParticlesTiming?.particleCount === diagnostics.totalGeneratedParticleCount;
  }, { requestedDropEdge, expectedBaseEdge }, { timeout: 60_000 });

  await page.evaluate(() => document.querySelector('#sph-reset')?.click());
  await page.waitForFunction(({ requestedDropEdge, expectedBaseEdge }) => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const diagnostics = overlay?.__sphPhaseViewState?.initialParticleEdgeDiagnostics
      || overlay?.__sphDriver?.demo?.initialParticleEdgeDiagnostics;
    const bounds = overlay?.__sphSetParticlesTiming?.renderDomainPositionBounds;
    return overlay?.__sphResetStatus?.status === 'particle-state-resynced-after-reset'
      && diagnostics?.effectiveDropParticlesPerEdge === requestedDropEdge
      && diagnostics?.effectiveBaseParticlesPerEdge === expectedBaseEdge
      && bounds?.status === 'render-domain-position-bounds-ready'
      && bounds?.drop?.count === requestedDropEdge ** 3
      && bounds?.base?.count === expectedBaseEdge ** 3;
  }, { requestedDropEdge, expectedBaseEdge }, { timeout: 60_000 });
  await page.evaluate(() => document.querySelector('#sph-step')?.click());
  await page.waitForFunction(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const total = overlay?.__sphPhaseViewState?.initialParticleEdgeDiagnostics?.totalGeneratedParticleCount;
    const scene = overlay?.__sphScene;
    return Number.isFinite(total)
      && scene?.getSphGpuParticleUpload?.()?.particleCount === total
      && scene?.getMlsMpmGpuParticleUpload?.()?.particleCount === total;
  }, null, { timeout: 30_000 });

  const expectedDropCount = requestedDropEdge ** 3;
  const expectedBaseCount = expectedBaseEdge ** 3;
  const expectedTotalCount = expectedDropCount + expectedBaseCount;
  await page.waitForFunction(({ expectedTotalCount }) => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const scene = overlay?.__sphScene;
    const renderState = scene?.getSphResidentRenderState?.() || overlay?.__sphResidentRenderState || null;
    return Boolean(
      renderState?.schema
      && renderState.particleCount === expectedTotalCount
      && renderState.surfaceDrawVisibleRendererBridge === 'three-render-row-spheres'
      && renderState.surfaceDrawRenderBridgeSphereVariableSize === true
    );
  }, { expectedTotalCount }, { timeout: 90_000 });

  const summary = await page.evaluate(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const scene = overlay?.__sphScene;
    const diagnostics = overlay?.__sphPhaseViewState?.initialParticleEdgeDiagnostics
      || overlay?.__sphDriver?.demo?.initialParticleEdgeDiagnostics
      || null;
    const counts = overlay?.__sphPhaseViewState?.counts || overlay?.__sphDriver?.demo?.counts || null;
    const setParticlesTiming = overlay?.__sphSetParticlesTiming || null;
    const sphUpload = scene?.getSphGpuParticleUpload?.() || null;
    const mlsUpload = scene?.getMlsMpmGpuParticleUpload?.() || null;
    const renderState = scene?.getSphResidentRenderState?.() || overlay?.__sphResidentRenderState || null;
    const surfaceDraw = scene?.getSphResidentSurfaceDraw?.() || overlay?.__sphResidentSurfaceDraw || null;
    return {
      resetStatus: overlay?.__sphResetStatus || null,
      diagnostics,
      counts,
      setParticlesTiming: {
        schema: setParticlesTiming?.schema,
        particleCount: setParticlesTiming?.particleCount ?? null,
        renderDomainCounts: setParticlesTiming?.renderDomainCounts ?? null,
        renderDomainPositionBounds: setParticlesTiming?.renderDomainPositionBounds ?? null,
        sameMaterialDomainMergeDiagnostics:
          setParticlesTiming?.sameMaterialDomainMergeDiagnostics
          || overlay?.__sphSameMaterialDomainMergeDiagnostics
          || null
      },
      sphUpload: {
        schema: sphUpload?.schema,
        status: sphUpload?.status,
        particleCount: sphUpload?.particleCount ?? null
      },
      mlsUpload: {
        schema: mlsUpload?.schema,
        status: mlsUpload?.status,
        particleCount: mlsUpload?.particleCount ?? null
      },
      renderState: {
        schema: renderState?.schema,
        status: renderState?.status,
        particleCount: renderState?.particleCount ?? null,
        visibleRendererBridge: renderState?.surfaceDrawVisibleRendererBridge
          ?? renderState?.visibleRendererBridge
          ?? null,
        renderBridgeStatus: renderState?.renderBridgeStatus ?? null,
        renderBridgeSphereMaterialKeys: renderState?.surfaceDrawRenderBridgeSphereMaterialKeys
          ?? surfaceDraw?.renderBridgeSphereMaterialKeys
          ?? [],
        renderBridgeSphereMaterialSummaries: renderState?.surfaceDrawRenderBridgeSphereMaterialSummaries
          ?? surfaceDraw?.renderBridgeSphereMaterialSummaries
          ?? [],
        renderBridgeSphereVariableSize: renderState?.surfaceDrawRenderBridgeSphereVariableSize
          ?? surfaceDraw?.renderBridgeSphereVariableSize
          ?? null,
        renderBridgeSpherePbrMaterialSource: renderState?.surfaceDrawRenderBridgeSpherePbrMaterialSource
          ?? surfaceDraw?.renderBridgeSpherePbrMaterialSource
          ?? null
      },
      residentAutoSchedule: overlay?.__mlsMpmResidentAutoSchedule || null,
      renderModeValue: overlay?.querySelector('#sph-render-mode select')?.value ?? null
    };
  });

  expect(summary.resetStatus?.schema).toBe('peercompute.ulg.sph-demo-reset-status.v0');
  expect(summary.resetStatus?.status).toBe('particle-state-resynced-after-reset');
  expect(summary.diagnostics?.schema).toBe('peercompute.ulg.sph-initial-particle-edge-diagnostics.v0');
  expect(summary.diagnostics?.requestedDropParticlesPerEdge).toBe(requestedDropEdge);
  expect(summary.diagnostics?.requestedBaseParticlesPerEdge).toBe(requestedBaseEdge);
  expect(summary.diagnostics?.effectiveDropParticlesPerEdge).toBe(requestedDropEdge);
  expect(summary.diagnostics?.effectiveBaseParticlesPerEdge).toBe(expectedBaseEdge);
  expect(summary.diagnostics?.drop?.effectiveParticleEdgeStatus).toBe('requested-particle-edge-preserved');
  expect(summary.diagnostics?.drop?.requestedParticleEdgeLowerBoundApplied).toBe(false);
  expect(summary.diagnostics?.matchingMaterialState).toBe(false);
  expect(summary.diagnostics?.requestedEdgePreservationStatus).toBe('preserved');
  expect(summary.counts).toEqual({ drop: expectedDropCount, base: expectedBaseCount, total: expectedTotalCount });
  expect(summary.setParticlesTiming.schema).toBe('peercompute.ulg.sph-scene-set-particles-timing.v0');
  expect(summary.setParticlesTiming.particleCount).toBe(expectedTotalCount);
  expect(summary.setParticlesTiming.renderDomainCounts).toEqual(summary.counts);
  const bounds = summary.setParticlesTiming.renderDomainPositionBounds;
  expect(bounds?.schema).toBe('peercompute.ulg.sph-render-domain-position-bounds.v0');
  expect(bounds?.status).toBe('render-domain-position-bounds-ready');
  expect(bounds?.drop?.count).toBe(expectedDropCount);
  expect(bounds?.drop?.finitePositionCount).toBe(expectedDropCount);
  expect(bounds?.base?.count).toBe(expectedBaseCount);
  expect(bounds?.base?.finitePositionCount).toBe(expectedBaseCount);
  expect(bounds?.drop?.center?.[1]).toBeCloseTo(2, 6);
  expect(bounds?.base?.center?.[1]).toBeCloseTo(0.5, 6);
  expect(summary.sphUpload.status).toBe('webgpu-uploaded');
  expect(summary.sphUpload.particleCount).toBe(expectedTotalCount);
  expect(summary.mlsUpload.status).toBe('webgpu-uploaded');
  expect(summary.mlsUpload.particleCount).toBe(expectedTotalCount);
  expect(summary.renderModeValue).toBe('three-render-row-spheres');
  expect(summary.residentAutoSchedule?.status).toBe('resident-initial-visual-refresh-complete');
  expect(summary.residentAutoSchedule?.residentAuto).toBe(false);
  expect(summary.renderState.schema).toBe('peercompute.ulg.sph-resident-render-state.v0');
  expect(summary.renderState.particleCount).toBe(expectedTotalCount);
  expect(summary.renderState.visibleRendererBridge).toBe('three-render-row-spheres');
  expect(summary.renderState.renderBridgeSphereVariableSize).toBe(true);
  expect(summary.renderState.renderBridgeSpherePbrMaterialSource).toMatch(/closure-derived-pbr/);
  expect(summary.renderState.renderBridgeSphereMaterialKeys.map((key) => String(key).toLowerCase()))
    .toEqual(expect.arrayContaining(['fe', 'h2o']));
  const materialSummaries = summary.renderState.renderBridgeSphereMaterialSummaries || [];
  expect(materialSummaries.length).toBeGreaterThanOrEqual(2);
  const materialByKey = new Map(
    materialSummaries.map((material) => [String(material.materialKey || '').toLowerCase(), material])
  );
  const feMaterial = materialByKey.get('fe');
  const h2oMaterial = materialByKey.get('h2o');
  expect(feMaterial).toBeTruthy();
  expect(h2oMaterial).toBeTruthy();
  expect(feMaterial.renderRowSphereClosurePbr).toBe(true);
  expect(feMaterial.renderRowSphereMetallicVisibilityProxy).toBe(true);
  expect(feMaterial.renderRowSphereFallbackReason).toMatch(/^metallic-sphere-/);
  expect(feMaterial.colorLuminance).toBeGreaterThan(0.04);
  expect(feMaterial.emissiveLuminance).toBeLessThan(0.01);
  expect(feMaterial.ior).toBeGreaterThanOrEqual(1);
  expect(feMaterial.opticalMetalness).toBeGreaterThanOrEqual(0.9);
  expect(feMaterial.metalness).toBeGreaterThanOrEqual(0.9);
  expect(h2oMaterial.renderRowSphereClosurePbr).toBe(true);
  expect(h2oMaterial.renderRowSphereTransmissionProxy).toBe(false);
  expect(h2oMaterial.renderRowSpherePreservedTransmission).toBe(true);
  expect(h2oMaterial.transmission).toBeGreaterThan(0.01);
  expect(h2oMaterial.ior).toBeGreaterThan(1);
  expect(h2oMaterial.colorLuminance).toBeGreaterThan(0.04);
  expect(h2oMaterial.opticalTransmission).toBeGreaterThan(0.01);
  if (summary.setParticlesTiming.sameMaterialDomainMergeDiagnostics?.schema) {
    expect(summary.setParticlesTiming.sameMaterialDomainMergeDiagnostics.status)
      .toBe('no-same-material-domain-surface-merge');
  }
  expect(consoleIssues).toEqual([]);
});

test('SPH phase reset preserves non-H2O drop edge above six through mounted points diagnostics', async ({ page }) => {
  test.setTimeout(120_000);
  const requestedDropEdge = 8;
  const requestedBaseEdge = 5;
  const expectedBaseEdge = requestedBaseEdge;
  const consoleIssues = [];
  page.on('console', (message) => {
    const text = message.text();
    if (/Invalid Buffer|Invalid BindGroup|Invalid CommandBuffer|Error while parsing WGSL|too many warnings|used in submit while destroyed/i.test(text)) {
      consoleIssues.push(text);
    }
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/?drop=fe&base=h2o&dropt=290&baset=290&iceh=0&ironh=1.5&dropn=${requestedDropEdge}&basen=${requestedBaseEdge}&boxx=5&boxy=5&boxz=5&mech=mlsmpm&residentAuto=0&residentFuseSequence=1&residentActiveGrid=1&surfaceDraw=three-render-row-points&visualCapture=1`);
  if (await page.locator('#sph-phase-overlay').count() === 0) {
    await page.locator('#run-sph-phase').click();
  }
  await expect(page.locator('#sph-phase-overlay')).toBeVisible();
  await page.waitForFunction(({ requestedDropEdge, expectedBaseEdge }) => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const diagnostics = overlay?.__sphPhaseViewState?.initialParticleEdgeDiagnostics
      || overlay?.__sphDriver?.demo?.initialParticleEdgeDiagnostics;
    const bounds = overlay?.__sphSetParticlesTiming?.renderDomainPositionBounds;
    return diagnostics?.effectiveDropParticlesPerEdge === requestedDropEdge
      && diagnostics?.effectiveBaseParticlesPerEdge === expectedBaseEdge
      && diagnostics?.requestedEdgePreservationStatus === 'preserved'
      && bounds?.drop?.count === requestedDropEdge ** 3
      && bounds?.base?.count === expectedBaseEdge ** 3
      && overlay?.__sphSetParticlesTiming?.particleCount === diagnostics.totalGeneratedParticleCount;
  }, { requestedDropEdge, expectedBaseEdge }, { timeout: 60_000 });

  await page.evaluate(() => document.querySelector('#sph-reset')?.click());
  await page.waitForFunction(({ requestedDropEdge, expectedBaseEdge }) => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const diagnostics = overlay?.__sphPhaseViewState?.initialParticleEdgeDiagnostics
      || overlay?.__sphDriver?.demo?.initialParticleEdgeDiagnostics;
    const bounds = overlay?.__sphSetParticlesTiming?.renderDomainPositionBounds;
    return overlay?.__sphResetStatus?.status === 'particle-state-resynced-after-reset'
      && diagnostics?.effectiveDropParticlesPerEdge === requestedDropEdge
      && diagnostics?.effectiveBaseParticlesPerEdge === expectedBaseEdge
      && bounds?.status === 'render-domain-position-bounds-ready'
      && bounds?.drop?.count === requestedDropEdge ** 3
      && bounds?.base?.count === expectedBaseEdge ** 3;
  }, { requestedDropEdge, expectedBaseEdge }, { timeout: 60_000 });
  await page.evaluate(() => document.querySelector('#sph-step')?.click());
  await page.waitForFunction(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const total = overlay?.__sphPhaseViewState?.initialParticleEdgeDiagnostics?.totalGeneratedParticleCount;
    const scene = overlay?.__sphScene;
    return Number.isFinite(total)
      && scene?.getSphGpuParticleUpload?.()?.particleCount === total
      && scene?.getMlsMpmGpuParticleUpload?.()?.particleCount === total;
  }, null, { timeout: 30_000 });

  const summary = await page.evaluate(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const scene = overlay?.__sphScene;
    const diagnostics = overlay?.__sphPhaseViewState?.initialParticleEdgeDiagnostics
      || overlay?.__sphDriver?.demo?.initialParticleEdgeDiagnostics
      || null;
    const counts = overlay?.__sphPhaseViewState?.counts || overlay?.__sphDriver?.demo?.counts || null;
    const setParticlesTiming = overlay?.__sphSetParticlesTiming || null;
    const sphUpload = scene?.getSphGpuParticleUpload?.() || null;
    const mlsUpload = scene?.getMlsMpmGpuParticleUpload?.() || null;
    const renderState = scene?.getSphResidentRenderState?.() || overlay?.__sphResidentRenderState || null;
    return {
      resetStatus: overlay?.__sphResetStatus || null,
      diagnostics,
      counts,
      setParticlesTiming: {
        schema: setParticlesTiming?.schema,
        particleCount: setParticlesTiming?.particleCount ?? null,
        renderDomainCounts: setParticlesTiming?.renderDomainCounts ?? null,
        renderDomainPositionBounds: setParticlesTiming?.renderDomainPositionBounds ?? null,
        sameMaterialDomainMergeDiagnostics:
          setParticlesTiming?.sameMaterialDomainMergeDiagnostics
          || overlay?.__sphSameMaterialDomainMergeDiagnostics
          || null
      },
      sphUpload: {
        schema: sphUpload?.schema,
        status: sphUpload?.status,
        particleCount: sphUpload?.particleCount ?? null
      },
      mlsUpload: {
        schema: mlsUpload?.schema,
        status: mlsUpload?.status,
        particleCount: mlsUpload?.particleCount ?? null
      },
      renderState: {
        schema: renderState?.schema,
        status: renderState?.status,
        particleCount: renderState?.particleCount ?? null,
        visibleRendererBridge: renderState?.visibleRendererBridge ?? null,
        renderBridgeStatus: renderState?.renderBridgeStatus ?? null
      },
      renderModeValue: overlay?.querySelector('#sph-render-mode select')?.value ?? null
    };
  });

  const expectedDropCount = requestedDropEdge ** 3;
  const expectedBaseCount = expectedBaseEdge ** 3;
  const expectedTotalCount = expectedDropCount + expectedBaseCount;
  expect(summary.resetStatus?.schema).toBe('peercompute.ulg.sph-demo-reset-status.v0');
  expect(summary.resetStatus?.status).toBe('particle-state-resynced-after-reset');
  expect(summary.diagnostics?.schema).toBe('peercompute.ulg.sph-initial-particle-edge-diagnostics.v0');
  expect(summary.diagnostics?.requestedDropParticlesPerEdge).toBe(requestedDropEdge);
  expect(summary.diagnostics?.requestedBaseParticlesPerEdge).toBe(requestedBaseEdge);
  expect(summary.diagnostics?.effectiveDropParticlesPerEdge).toBe(requestedDropEdge);
  expect(summary.diagnostics?.effectiveBaseParticlesPerEdge).toBe(expectedBaseEdge);
  expect(summary.diagnostics?.drop?.effectiveParticleEdgeStatus).toBe('requested-particle-edge-preserved');
  expect(summary.diagnostics?.requestedEdgePreservationStatus).toBe('preserved');
  expect(summary.counts).toEqual({ drop: expectedDropCount, base: expectedBaseCount, total: expectedTotalCount });
  expect(summary.setParticlesTiming.schema).toBe('peercompute.ulg.sph-scene-set-particles-timing.v0');
  expect(summary.setParticlesTiming.particleCount).toBe(expectedTotalCount);
  expect(summary.setParticlesTiming.renderDomainCounts).toEqual(summary.counts);
  const bounds = summary.setParticlesTiming.renderDomainPositionBounds;
  expect(bounds?.schema).toBe('peercompute.ulg.sph-render-domain-position-bounds.v0');
  expect(bounds?.status).toBe('render-domain-position-bounds-ready');
  expect(bounds?.drop?.count).toBe(expectedDropCount);
  expect(bounds?.base?.count).toBe(expectedBaseCount);
  expect(summary.sphUpload.status).toBe('webgpu-uploaded');
  expect(summary.sphUpload.particleCount).toBe(expectedTotalCount);
  expect(summary.mlsUpload.status).toBe('webgpu-uploaded');
  expect(summary.mlsUpload.particleCount).toBe(expectedTotalCount);
  expect(summary.renderModeValue).toBe('three-render-row-points');
  if (summary.renderState.schema && summary.renderState.visibleRendererBridge) {
    expect(summary.renderState.particleCount).toBe(expectedTotalCount);
    expect(summary.renderState.visibleRendererBridge).toBe('three-render-row-points');
  }
  if (summary.setParticlesTiming.sameMaterialDomainMergeDiagnostics?.schema) {
    expect(summary.setParticlesTiming.sameMaterialDomainMergeDiagnostics.status)
      .toBe('no-same-material-domain-surface-merge');
  }
  expect(consoleIssues).toEqual([]);
});

test('SPH phase reset preserves same-material explicit edges while merging surfaces', async ({ page }) => {
  test.setTimeout(120_000);
  const consoleIssues = [];
  page.on('console', (message) => {
    const text = message.text();
    if (/Invalid Buffer|Invalid BindGroup|Invalid CommandBuffer|Error while parsing WGSL|too many warnings|used in submit while destroyed/i.test(text)) {
      consoleIssues.push(text);
    }
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?drop=h2o&base=h2o&dropt=290&baset=290&iceh=0&ironh=1.5&dropn=7&basen=5&boxx=5&boxy=5&boxz=5&mech=mlsmpm&residentAuto=0&residentFuseSequence=1&residentActiveGrid=1&surfaceDraw=three-render-row-spheres&visualCapture=1');
  if (await page.locator('#sph-phase-overlay').count() === 0) {
    await page.locator('#run-sph-phase').click();
  }
  await expect(page.locator('#sph-phase-overlay')).toBeVisible();
  await page.waitForFunction(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const diagnostics = overlay?.__sphPhaseViewState?.initialParticleEdgeDiagnostics
      || overlay?.__sphDriver?.demo?.initialParticleEdgeDiagnostics;
    const bounds = overlay?.__sphSetParticlesTiming?.renderDomainPositionBounds;
    const merge = overlay?.__sphSetParticlesTiming?.sameMaterialDomainMergeDiagnostics
      || overlay?.__sphSameMaterialDomainMergeDiagnostics;
    return diagnostics?.effectiveDropParticlesPerEdge === 7
      && diagnostics?.effectiveBaseParticlesPerEdge === 5
      && diagnostics?.requestedEdgePreservationStatus === 'preserved'
      && bounds?.drop?.count === 7 ** 3
      && bounds?.base?.count === 5 ** 3
      && merge?.status === 'same-material-domain-surfaces-merged';
  }, null, { timeout: 60_000 });

  await page.evaluate(() => document.querySelector('#sph-reset')?.click());
  await page.waitForFunction(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const diagnostics = overlay?.__sphPhaseViewState?.initialParticleEdgeDiagnostics
      || overlay?.__sphDriver?.demo?.initialParticleEdgeDiagnostics;
    const bounds = overlay?.__sphSetParticlesTiming?.renderDomainPositionBounds;
    const merge = overlay?.__sphSetParticlesTiming?.sameMaterialDomainMergeDiagnostics
      || overlay?.__sphSameMaterialDomainMergeDiagnostics;
    return overlay?.__sphResetStatus?.status === 'particle-state-resynced-after-reset'
      && diagnostics?.effectiveDropParticlesPerEdge === 7
      && diagnostics?.effectiveBaseParticlesPerEdge === 5
      && bounds?.status === 'render-domain-position-bounds-ready'
      && bounds?.drop?.count === 7 ** 3
      && bounds?.base?.count === 5 ** 3
      && merge?.status === 'same-material-domain-surfaces-merged';
  }, null, { timeout: 60_000 });

  const summary = await page.evaluate(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const diagnostics = overlay?.__sphPhaseViewState?.initialParticleEdgeDiagnostics
      || overlay?.__sphDriver?.demo?.initialParticleEdgeDiagnostics
      || null;
    const counts = overlay?.__sphPhaseViewState?.counts || overlay?.__sphDriver?.demo?.counts || null;
    const setParticlesTiming = overlay?.__sphSetParticlesTiming || null;
    return {
      resetStatus: overlay?.__sphResetStatus || null,
      diagnostics,
      counts,
      setParticlesTiming: {
        schema: setParticlesTiming?.schema,
        particleCount: setParticlesTiming?.particleCount ?? null,
        renderDomainCounts: setParticlesTiming?.renderDomainCounts ?? null,
        renderDomainPositionBounds: setParticlesTiming?.renderDomainPositionBounds ?? null,
        sameMaterialDomainMergeDiagnostics:
          setParticlesTiming?.sameMaterialDomainMergeDiagnostics
          || overlay?.__sphSameMaterialDomainMergeDiagnostics
          || null
      }
    };
  });

  const expectedDropCount = 7 ** 3;
  const expectedBaseCount = 5 ** 3;
  const expectedTotalCount = expectedDropCount + expectedBaseCount;
  expect(summary.resetStatus?.schema).toBe('peercompute.ulg.sph-demo-reset-status.v0');
  expect(summary.resetStatus?.status).toBe('particle-state-resynced-after-reset');
  expect(summary.diagnostics?.schema).toBe('peercompute.ulg.sph-initial-particle-edge-diagnostics.v0');
  expect(summary.diagnostics?.requestedDropParticlesPerEdge).toBe(7);
  expect(summary.diagnostics?.requestedBaseParticlesPerEdge).toBe(5);
  expect(summary.diagnostics?.effectiveDropParticlesPerEdge).toBe(7);
  expect(summary.diagnostics?.effectiveBaseParticlesPerEdge).toBe(5);
  expect(summary.diagnostics?.matchingMaterialStateStrategy).toBeNull();
  expect(summary.diagnostics?.preservedRequestedRole).toBeNull();
  expect(summary.diagnostics?.requestedEdgePreservationStatus).toBe('preserved');
  expect(summary.counts).toEqual({ drop: expectedDropCount, base: expectedBaseCount, total: expectedTotalCount });
  expect(summary.setParticlesTiming.schema).toBe('peercompute.ulg.sph-scene-set-particles-timing.v0');
  expect(summary.setParticlesTiming.particleCount).toBe(expectedTotalCount);
  expect(summary.setParticlesTiming.renderDomainCounts).toEqual(summary.counts);
  const bounds = summary.setParticlesTiming.renderDomainPositionBounds;
  expect(bounds?.schema).toBe('peercompute.ulg.sph-render-domain-position-bounds.v0');
  expect(bounds?.status).toBe('render-domain-position-bounds-ready');
  expect(bounds?.drop?.count).toBe(expectedDropCount);
  expect(bounds?.drop?.finitePositionCount).toBe(expectedDropCount);
  expect(bounds?.base?.count).toBe(expectedBaseCount);
  expect(bounds?.base?.finitePositionCount).toBe(expectedBaseCount);
  expect(bounds?.drop?.center?.[0]).toBeCloseTo(2.5, 6);
  expect(bounds?.drop?.center?.[1]).toBeCloseTo(2, 6);
  expect(bounds?.drop?.center?.[2]).toBeCloseTo(2.5, 6);
  expect(bounds?.drop?.size?.[0]).toBeCloseTo(6 / 7, 6);
  expect(bounds?.drop?.size?.[1]).toBeCloseTo(6 / 7, 6);
  expect(bounds?.drop?.size?.[2]).toBeCloseTo(6 / 7, 6);
  expect(bounds?.base?.center?.[0]).toBeCloseTo(2.5, 6);
  expect(bounds?.base?.center?.[1]).toBeCloseTo(0.5, 6);
  expect(bounds?.base?.center?.[2]).toBeCloseTo(2.5, 6);
  expect(bounds?.base?.size?.[0]).toBeCloseTo(4 / 5, 6);
  expect(bounds?.base?.size?.[1]).toBeCloseTo(4 / 5, 6);
  expect(bounds?.base?.size?.[2]).toBeCloseTo(4 / 5, 6);
  const merge = summary.setParticlesTiming.sameMaterialDomainMergeDiagnostics;
  expect(merge?.schema).toBe('peercompute.ulg.sph-same-material-domain-merge-diagnostics.v0');
  expect(merge?.status).toBe('same-material-domain-surfaces-merged');
  expect(merge?.mergedSurfaceCount).toBeGreaterThanOrEqual(1);
  const waterSurface = merge.surfaces.find((surface) => (
    surface.material === 'h2o'
    && surface.phase === 'liquid'
    && surface.mergedRenderDomains?.some((domain) => domain.renderDomainKey === 'base')
    && surface.mergedRenderDomains?.some((domain) => domain.renderDomainKey === 'drop')
  ));
  expect(waterSurface?.reason).toBe('same material and phase role domains merged for a continuous visible surface');
  expect(waterSurface?.count).toBe(expectedTotalCount);
  expect(consoleIssues).toEqual([]);
});

test('SPH phase demo runs derived material properties by default', async ({ page }) => {
  test.setTimeout(envPositiveInteger('ULG_SPH_DERIVED_E2E_TIMEOUT_MS', 240_000));
  await page.setViewportSize({ width: 900, height: 680 });
  await page.goto('/');
  await page.evaluate(() => {
    window.history.replaceState(
      null,
      '',
      '/?drop=fe&base=h2o&dropt=1850&baset=233.15&mech=mlsmpm&surfaceDraw=three-render-row-spheres'
    );
  });
  if (await page.locator('#sph-phase-overlay').count() === 0) {
    await page.locator('#run-sph-phase').click();
  }
  await expect(page.locator('#sph-phase-overlay')).toBeVisible();
  await expect(page.getByText('SPH PHASE — two materials interacting')).toBeVisible();
  const materialLabels = await page.locator('#sph-elements select').first().locator('option').evaluateAll(
    (options) => options.map((option) => option.textContent)
  );
  expect(materialLabels).toContain('Iron (Fe, Z=26) - derived element');
  expect(materialLabels).toContain('Gold (Au, Z=79) - derived element');
  await page.locator('#sph-elements .sph-picker-button').first().click({ force: true });
  await expect(page.locator('.sph-element-picker-overlay')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Gold (Au, Z=79) - derived element' })).toBeVisible();
  await page.locator('.sph-element-picker').getByRole('button', { name: 'close' }).click();
  await expect(page.locator('.sph-element-picker-overlay')).toHaveCount(0);
  await page.waitForFunction(() => {
    const text = document.querySelector('#sph-status')?.textContent ?? '';
    return text.includes('preflight        : preflight-feasible-derived-closures')
      || text.includes('first-principles material properties are required');
  }, null, { timeout: 60_000 });
  await expect(page.locator('#sph-status')).toContainText('preflight        : preflight-feasible-derived-closures');
  await expect(page.locator('#sph-status')).not.toContainText('first-principles material properties are required');
  await page.waitForFunction(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const canvas = overlay?.querySelector('canvas');
    return Boolean(canvas && canvas.width > 0 && canvas.height > 0);
  });
  await page.waitForFunction(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const scene = overlay?.__sphScene;
    return Boolean(
      scene?.getOpticalGpuLookup?.()?.execution?.schema
      && scene?.getSphGpuParticleState?.()?.schema
      && scene?.getSphGpuParticleUpload?.()?.schema
      && scene?.getMlsMpmGpuParticleState?.()?.schema
      && scene?.getMlsMpmGpuParticleUpload?.()?.schema
      && (scene?.getMlsMpmMechanicsPrediction?.()?.schema
        || overlay?.__mlsMpmMechanicsPrediction?.status === 'standalone-mechanics-prediction-disabled')
      && scene?.getMlsMpmP2gGridProjection?.()?.schema
      && scene?.getMlsMpmGridUpdate?.()?.schema
      && scene?.getMlsMpmG2pReconstruction?.()?.schema
      && scene?.getMlsMpmResidentStep?.()?.schema
      && scene?.getMlsMpmResidentSteps?.()?.schema
    );
  });
  await page.waitForFunction(() => {
    const text = document.querySelector('#sph-status')?.textContent ?? '';
    return text.includes('resident readback: requested=no-full-readback actual=')
      && !text.includes('actual=pending');
  });
  await page.waitForFunction(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const steps = overlay?.__sphScene?.getMlsMpmResidentSteps?.();
    if (!steps?.schema) return false;
    if (steps.backend !== 'webgpu' || steps.readbackMode !== 'no-full-readback') return true;
    return steps.continuedFromResidentState === true
      && steps.residentSourceMode === 'previous-gpu-resident-output';
  });
  await page.waitForFunction(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const steps = overlay?.__sphScene?.getMlsMpmResidentSteps?.();
    if (!steps?.schema || steps.backend !== 'webgpu') return true;
    return overlay?.__sphScene?.getSphResidentRenderState?.()?.source === 'resident-gpu-render-field';
  });
  await page.waitForFunction(() => {
    const update = document.querySelector('#sph-phase-overlay')?.__sphPeerClosureCache?.staticTableWrite;
    return update?.schema === 'peercompute.ulg.sph-static-table-cache-update.v0'
      && update.status === 'stored'
      && update.counts?.tables >= 4
      && update.counts?.gpuWarmup >= 1;
  });
  await page.evaluate(() => document.querySelector('#sph-reset')?.click());
  await page.waitForFunction(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    return overlay?.__sphSetParticlesTiming?.staticTableCacheStatus === 'static-table-cache-bundle-hit'
      && overlay?.__sphPeerClosureCache?.staticTableRead?.hitCount >= 4;
  });
  await page.waitForFunction(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const scene = overlay?.__sphScene;
    return Boolean(
      scene?.getOpticalGpuLookup?.()?.execution?.schema
      && scene?.getSphGpuParticleState?.()?.schema
      && scene?.getSphGpuParticleUpload?.()?.schema
      && scene?.getMlsMpmGpuParticleState?.()?.schema
      && scene?.getMlsMpmGpuParticleUpload?.()?.schema
      && scene?.getMlsMpmP2gGridProjection?.()?.schema
      && scene?.getMlsMpmGridUpdate?.()?.schema
      && scene?.getMlsMpmG2pReconstruction?.()?.schema
      && scene?.getMlsMpmResidentStep?.()?.schema
      && scene?.getMlsMpmResidentSteps?.()?.schema
    );
  }, null, { timeout: 60_000 });
  await page.waitForFunction(() => {
    const scene = document.querySelector('#sph-phase-overlay')?.__sphScene;
    const steps = scene?.getMlsMpmResidentSteps?.();
    const renderState = scene?.getSphResidentRenderState?.();
    if (!steps?.schema || steps.backend !== 'webgpu') return true;
    if (renderState?.source !== 'resident-gpu-render-field') return false;
    const surfaceDraw = scene?.getSphResidentSurfaceDraw?.();
    if (!surfaceDraw?.schema) return false;
    if (renderState.renderFieldReadback === true
      && surfaceDraw.visibleRendererBridge === 'three-marching-cubes'
      && surfaceDraw.visibleRenderSource === 'three-managed-render-field-readback') {
      return true;
    }
    const threeRenderRowBridges = ['three-render-row-points', 'three-render-row-spheres'];
    const threeRenderRowSources = [
      'resident-render-rows-three-points',
      'resident-render-rows-three-instanced-spheres'
    ];
    return threeRenderRowBridges.includes(surfaceDraw.visibleRendererBridge)
      && threeRenderRowSources.includes(surfaceDraw.visibleRenderSource)
      && surfaceDraw.renderBridgeEngineIntegration === 'three-renderer-owned-scene-object';
  }, null, { timeout: 60_000 });
  await page.waitForFunction(() => {
    const scene = document.querySelector('#sph-phase-overlay')?.__sphScene;
    const visibleRenderModes = [
      'continuous-marching-cubes',
      'three-render-row-points',
      'three-render-row-spheres'
    ];
    let visibleCount = 0;
    scene?.scene?.traverse((node) => {
      if (visibleRenderModes.includes(node.userData?.renderMode) && node.visible) {
        visibleCount += 1;
      }
    });
    return visibleCount > 0;
  }, null, { timeout: 60_000 });
  const derivedSummary = await page.evaluate(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const canvas = overlay.querySelector('canvas');
    const scene = overlay.__sphScene;
    const finiteOrNull = (value) => {
      const number = Number(value);
      return Number.isFinite(number) ? number : null;
    };
    const opticalGpuTable = scene?.getOpticalGpuTable?.();
    const opticalGpuLookup = scene?.getOpticalGpuLookup?.();
    const opticalGpuExecution = opticalGpuLookup?.execution;
    const opticalGpuDrawState = scene?.getOpticalGpuDrawState?.();
    const sphThermalMaterialTable = scene?.getSphThermalMaterialTable?.();
    const sphThermalClosureGraphBuffers = scene?.getSphThermalClosureGraphBuffers?.();
    const sphThermalPhaseResponseTable = scene?.getSphThermalPhaseResponseTable?.();
    const sphThermalResponseGraphUpload = scene?.getSphThermalResponseGraphUpload?.();
    const mlsMpmMechanicsMaterialPhaseUpload = scene?.getMlsMpmMechanicsMaterialPhaseUpload?.();
    const sphGpuParticleState = scene?.getSphGpuParticleState?.();
    const sphGpuParticleUpload = scene?.getSphGpuParticleUpload?.();
    const mlsMpmGpuParticleState = scene?.getMlsMpmGpuParticleState?.();
    const mlsMpmGpuParticleUpload = scene?.getMlsMpmGpuParticleUpload?.();
    const mlsMpmMechanicsPrediction = scene?.getMlsMpmMechanicsPrediction?.()
      || overlay.__mlsMpmMechanicsPrediction
      || null;
    const mlsMpmP2gGridProjection = scene?.getMlsMpmP2gGridProjection?.();
    const mlsMpmGridUpdate = scene?.getMlsMpmGridUpdate?.();
    const mlsMpmG2pReconstruction = scene?.getMlsMpmG2pReconstruction?.();
    const mlsMpmResidentStep = scene?.getMlsMpmResidentStep?.();
    const mlsMpmResidentSteps = scene?.getMlsMpmResidentSteps?.();
    const schroederPhaseVolumeDiagnostics = scene?.getSchroederPhaseVolumeDiagnostics?.();
    const sphResidentRenderState = scene?.getSphResidentRenderState?.();
    const sphResidentSurfaceDraw = scene?.getSphResidentSurfaceDraw?.();
    const sphResidentSurfaceDrawRenderBridge = scene?.getSphResidentSurfaceDrawRenderBridge?.();
    const visibleSurfaces = [];
    const visibleRenderModes = [
      'continuous-marching-cubes',
      'three-render-row-points',
      'three-render-row-spheres'
    ];
    scene?.scene?.traverse((node) => {
      if (visibleRenderModes.includes(node.userData?.renderMode)) {
        visibleSurfaces.push({
          renderMode: node.userData.renderMode,
          name: node.name ?? null,
          type: node.type ?? null,
          materialKey: node.userData.materialKey,
          visible: node.visible,
          renderSource: node.userData.renderSource ?? null,
          renderRowsBackend: node.userData.renderRowsBackend ?? null,
          renderFieldBackend: node.userData.renderFieldBackend ?? null,
          renderFieldInputSource: node.userData.renderFieldInputSource ?? null,
          renderFieldMaxDensity: finiteOrNull(node.userData.renderFieldMaxDensity),
          renderFieldIsolation: finiteOrNull(node.userData.renderFieldIsolation),
          renderFieldShowIsolation: finiteOrNull(node.userData.renderFieldShowIsolation),
          renderFieldHideIsolation: finiteOrNull(node.userData.renderFieldHideIsolation),
          renderFieldAppliedIsolation: finiteOrNull(node.userData.renderFieldAppliedIsolation),
          renderFieldRetainedByGrace: node.userData.renderFieldRetainedByGrace ?? null,
          surfaceInactiveFrameCount: node.userData.surfaceInactiveFrameCount ?? null,
          opticalSurfaceVisibility: node.userData.opticalSurfaceVisibility ?? null,
          opticalSurfaceHiddenReason: node.userData.opticalSurfaceHiddenReason ?? null,
          opticalSurfaceRetainedByGrace: node.userData.opticalSurfaceRetainedByGrace ?? null,
          lookupOutputRecordIndex: node.userData.opticalGpuLookupOutput?.recordIndex ?? null,
          lookupBackend: node.userData.opticalGpuExecutionBackend ?? null,
          renderAlpha: finiteOrNull(node.userData.opticalGpuLookupOutput?.renderAlpha ?? node.material?.opacity),
          materialOpacity: node.material?.opacity ?? null,
          materialTransmission: node.material?.transmission ?? null,
          renderLayer: node.userData.renderLayer ?? null,
          renderOrderPolicy: node.userData.renderOrderPolicy ?? null,
          renderOrder: node.renderOrder ?? null,
          renderRowSphereTransmissionProxy: node.userData.renderRowSphereTransmissionProxy ?? null,
          renderRowSphereFallbackColor: node.userData.renderRowSphereFallbackColor ?? null,
          materialDepthWrite: node.material?.depthWrite ?? null,
          materialDepthTest: node.material?.depthTest ?? null
        });
      }
    });
    const containerWire = scene?.scene?.children?.find((node) => node.userData?.renderLayer === 'container-wire');
    const containerGrid = scene?.scene?.children?.find((node) => node.userData?.renderLayer === 'container-grid');
    const materialList = (material) => Array.isArray(material) ? material : [material];
    return {
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      driverReady: Boolean(overlay.__sphDriver),
      viewStateReady: Boolean(overlay.__sphPhaseViewState),
      viewStateSource: overlay.__sphPhaseViewStateSource ?? null,
      workerRebuild: overlay.__sphPhaseRebuildWorker ?? null,
      workerRebuildTiming: overlay.__sphPhaseWorkerTiming || overlay.__sphPhaseRebuildWorker?.timing || null,
      overlayResidentRequestedReadbackMode: overlay.__mlsMpmResidentRequestedReadbackMode,
      statusText: overlay.querySelector('#sph-status')?.textContent ?? '',
      warningText: overlay.querySelector('#sph-warning-bar')?.textContent ?? '',
      warnings: overlay.__sphWarnings || [],
      frameCounters: overlay.__sphFrameCounters || null,
      peerClosureCache: overlay.__sphPeerClosureCache || null,
      performanceTrace: overlay.__sphPerformanceTrace || null,
      setParticlesTiming: overlay.__sphSetParticlesTiming || null,
      resetStatus: overlay.__sphResetStatus || null,
      residentExecutionGeneration: scene?.scene?.userData?.mlsMpmResidentExecutionGeneration ?? null,
      residentExecutionInvalidation: scene?.scene?.userData?.mlsMpmResidentExecutionInvalidation ?? null,
      residentStepsProgress: scene?.scene?.userData?.mlsMpmResidentStepsProgress ?? null,
      clearCacheButtonReady: Boolean(overlay.querySelector('#sph-clear-cache')),
      cpuClosureTask: overlay.__sphCpuClosureTask || null,
      opticalGpuTable: {
        schema: opticalGpuTable?.schema,
        recordCount: opticalGpuTable?.recordCount,
        spectralSampleCount: opticalGpuTable?.spectralSampleCount
      },
      sphThermalMaterialTable: {
        schema: sphThermalMaterialTable?.schema,
        materialCount: sphThermalMaterialTable?.materialCount,
        segmentCount: sphThermalMaterialTable?.segmentCount,
        status: sphThermalMaterialTable?.status
      },
      sphThermalClosureGraphBuffers: {
        schema: sphThermalClosureGraphBuffers?.schema,
        graphSchema: sphThermalClosureGraphBuffers?.graphSchema,
        graphBankSchema: sphThermalClosureGraphBuffers?.graphBank?.schema,
        graphCount: sphThermalClosureGraphBuffers?.graphCount,
        segmentCount: sphThermalClosureGraphBuffers?.segmentCount,
        skippedSegmentCount: sphThermalClosureGraphBuffers?.skippedSegmentCount,
        status: sphThermalClosureGraphBuffers?.status
      },
      sphThermalPhaseResponseTable: {
        schema: sphThermalPhaseResponseTable?.schema,
        graphBankSchema: sphThermalPhaseResponseTable?.graphBankSchema,
        responseCount: sphThermalPhaseResponseTable?.responseCount,
        materialCount: sphThermalPhaseResponseTable?.materialCount,
        status: sphThermalPhaseResponseTable?.status
      },
      sphThermalResponseGraphUpload: {
        schema: sphThermalResponseGraphUpload?.schema,
        status: sphThermalResponseGraphUpload?.status,
        responseCount: sphThermalResponseGraphUpload?.responseCount,
        graphCount: sphThermalResponseGraphUpload?.graphCount,
        responseBufferByteLength: sphThermalResponseGraphUpload?.responseBufferByteLength,
        graphSampleBufferByteLength: sphThermalResponseGraphUpload?.graphSampleBufferByteLength
      },
      mlsMpmMechanicsMaterialPhaseUpload: {
        schema: mlsMpmMechanicsMaterialPhaseUpload?.schema,
        status: mlsMpmMechanicsMaterialPhaseUpload?.status,
        phaseRecordCount: mlsMpmMechanicsMaterialPhaseUpload?.phaseRecordCount,
        recordsByteLength: mlsMpmMechanicsMaterialPhaseUpload?.recordsByteLength
      },
      opticalGpuLookup: {
        schema: opticalGpuLookup?.lookup?.schema,
        queryCount: opticalGpuLookup?.lookup?.queryCount,
        outputStrideFloats: opticalGpuLookup?.lookup?.outputStrideFloats,
        outputCount: opticalGpuLookup?.cpuReference?.outputs?.length,
        executionSchema: opticalGpuExecution?.schema,
        executionBackend: opticalGpuExecution?.backend,
        executionStatus: opticalGpuExecution?.webgpuStatus?.status,
        paritySchema: opticalGpuExecution?.webgpuParity?.schema,
        parityStatus: opticalGpuExecution?.webgpuParity?.status,
        parityMaxOutputAbs: opticalGpuExecution?.webgpuParity?.maxOutputAbs ?? null,
        parityTolerance: opticalGpuExecution?.webgpuParity?.tolerance ?? null
      },
      opticalGpuDrawState: {
        schema: opticalGpuDrawState?.schema,
        sourceExecutionSchema: opticalGpuDrawState?.sourceExecutionSchema,
        backend: opticalGpuDrawState?.backend,
        appliedCount: opticalGpuDrawState?.appliedCount
      },
      sphGpuParticleState: {
        schema: sphGpuParticleState?.schema,
        particleCount: sphGpuParticleState?.particleCount,
        stateStrideFloats: sphGpuParticleState?.stateStrideFloats,
        thermoStrideFloats: sphGpuParticleState?.thermoStrideFloats,
        phaseSolidId: sphGpuParticleState?.phaseIds?.solid,
        firstMaterial: sphGpuParticleState?.metadata?.[0]?.material
      },
      sphGpuParticleUpload: {
        schema: sphGpuParticleUpload?.schema,
        status: sphGpuParticleUpload?.status,
        sourceSchema: sphGpuParticleUpload?.sourceSchema,
        particleCount: sphGpuParticleUpload?.particleCount
      },
      mlsMpmGpuParticleState: {
        schema: mlsMpmGpuParticleState?.schema,
        particleCount: mlsMpmGpuParticleState?.particleCount,
        mechanicsStrideFloats: mlsMpmGpuParticleState?.mechanicsStrideFloats,
        mechanicsDtS: mlsMpmGpuParticleState?.mechanicsDtS,
        mechanicalSubsteps: mlsMpmGpuParticleState?.mechanicalSubsteps,
        firstSolidFlag: mlsMpmGpuParticleState?.mechanics?.[20] ?? null,
        firstStatus: mlsMpmGpuParticleState?.mechanics?.[21] ?? null
      },
      mlsMpmGpuParticleUpload: {
        schema: mlsMpmGpuParticleUpload?.schema,
        status: mlsMpmGpuParticleUpload?.status,
        sourceSchema: mlsMpmGpuParticleUpload?.sourceSchema,
        particleCount: mlsMpmGpuParticleUpload?.particleCount
      },
      mlsMpmMechanicsPrediction: {
        schema: mlsMpmMechanicsPrediction?.schema,
        predictionSchema: mlsMpmMechanicsPrediction?.predictionSchema,
        backend: mlsMpmMechanicsPrediction?.backend,
        status: mlsMpmMechanicsPrediction?.status,
        reason: mlsMpmMechanicsPrediction?.reason,
        defaultEnabled: mlsMpmMechanicsPrediction?.defaultEnabled,
        normalHotLoopReadbackFree: mlsMpmMechanicsPrediction?.normalHotLoopReadbackFree,
        webgpuStatus: mlsMpmMechanicsPrediction?.webgpuStatus?.status,
        paritySchema: mlsMpmMechanicsPrediction?.webgpuParity?.schema,
        parityStatus: mlsMpmMechanicsPrediction?.webgpuParity?.status,
        parityMaxStateAbs: mlsMpmMechanicsPrediction?.webgpuParity?.maxStateAbs ?? null,
        parityMaxMechanicsAbs: mlsMpmMechanicsPrediction?.webgpuParity?.maxMechanicsAbs ?? null,
        parityTolerance: mlsMpmMechanicsPrediction?.webgpuParity?.tolerance ?? null,
        particleCount: mlsMpmMechanicsPrediction?.particleCount,
        stateStrideFloats: mlsMpmMechanicsPrediction?.stateStrideFloats,
        mechanicsStrideFloats: mlsMpmMechanicsPrediction?.mechanicsStrideFloats,
        p2gValidation: mlsMpmMechanicsPrediction?.p2gValidation,
        gridValidation: mlsMpmMechanicsPrediction?.gridValidation,
        g2pValidation: mlsMpmMechanicsPrediction?.g2pValidation,
        sphValidation: mlsMpmMechanicsPrediction?.sphValidation,
        phaseChangeValidation: mlsMpmMechanicsPrediction?.phaseChangeValidation,
        fullPhysicsValidation: mlsMpmMechanicsPrediction?.fullPhysicsValidation
      },
      mlsMpmP2gGridProjection: {
        schema: mlsMpmP2gGridProjection?.schema,
        projectionSchema: mlsMpmP2gGridProjection?.projectionSchema,
        backend: mlsMpmP2gGridProjection?.backend,
        webgpuStatus: mlsMpmP2gGridProjection?.webgpuStatus?.status,
        paritySchema: mlsMpmP2gGridProjection?.webgpuParity?.schema,
        parityStatus: mlsMpmP2gGridProjection?.webgpuParity?.status,
        parityMaxGridAbs: mlsMpmP2gGridProjection?.webgpuParity?.maxGridAbs ?? null,
        parityTolerance: mlsMpmP2gGridProjection?.webgpuParity?.tolerance ?? null,
        readbackMode: mlsMpmP2gGridProjection?.readbackMode,
        normalHotLoopReadbackFree: mlsMpmP2gGridProjection?.normalHotLoopReadbackFree
          ?? (mlsMpmP2gGridProjection?.readbackMode === 'no-full-readback' ? true : undefined),
        particleCount: mlsMpmP2gGridProjection?.particleCount,
        gridNodeCount: mlsMpmP2gGridProjection?.gridNodeCount,
        gridNodeStrideFloats: mlsMpmP2gGridProjection?.gridNodeStrideFloats
          ?? (mlsMpmP2gGridProjection?.schema ? 8 : undefined),
        p2gProjectionValidation: mlsMpmP2gGridProjection?.p2gProjectionValidation
          ?? (mlsMpmP2gGridProjection?.schema ? false : undefined),
        stressProjectionValidation: mlsMpmP2gGridProjection?.stressProjectionValidation
          ?? (mlsMpmP2gGridProjection?.schema ? false : undefined),
        gridValidation: mlsMpmP2gGridProjection?.gridValidation
          ?? (mlsMpmP2gGridProjection?.schema ? false : undefined),
        g2pValidation: mlsMpmP2gGridProjection?.g2pValidation
          ?? (mlsMpmP2gGridProjection?.schema ? false : undefined),
        sphValidation: mlsMpmP2gGridProjection?.sphValidation
          ?? (mlsMpmP2gGridProjection?.schema ? false : undefined),
        phaseChangeValidation: mlsMpmP2gGridProjection?.phaseChangeValidation
          ?? (mlsMpmP2gGridProjection?.schema ? false : undefined),
        fullPhysicsValidation: mlsMpmP2gGridProjection?.fullPhysicsValidation
          ?? (mlsMpmP2gGridProjection?.schema ? false : undefined)
      },
      mlsMpmGridUpdate: {
        schema: mlsMpmGridUpdate?.schema,
        updateSchema: mlsMpmGridUpdate?.updateSchema,
        backend: mlsMpmGridUpdate?.backend,
        webgpuStatus: mlsMpmGridUpdate?.webgpuStatus?.status,
        paritySchema: mlsMpmGridUpdate?.webgpuParity?.schema,
        parityStatus: mlsMpmGridUpdate?.webgpuParity?.status,
        parityMaxGridAbs: mlsMpmGridUpdate?.webgpuParity?.maxGridAbs ?? null,
        parityTolerance: mlsMpmGridUpdate?.webgpuParity?.tolerance ?? null,
        readbackMode: mlsMpmGridUpdate?.readbackMode,
        normalHotLoopReadbackFree: mlsMpmGridUpdate?.normalHotLoopReadbackFree
          ?? (mlsMpmGridUpdate?.readbackMode === 'no-full-readback' ? true : undefined),
        particleCount: mlsMpmGridUpdate?.particleCount,
        gridNodeCount: mlsMpmGridUpdate?.gridNodeCount,
        gridNodeStrideFloats: mlsMpmGridUpdate?.gridNodeStrideFloats
          ?? (mlsMpmGridUpdate?.schema ? 8 : undefined),
        dt: mlsMpmGridUpdate?.dt,
        cflFactor: mlsMpmGridUpdate?.cflFactor,
        p2gProjectionValidation: mlsMpmGridUpdate?.p2gProjectionValidation
          ?? (mlsMpmGridUpdate?.schema ? false : undefined),
        stressProjectionValidation: mlsMpmGridUpdate?.stressProjectionValidation
          ?? (mlsMpmGridUpdate?.schema ? false : undefined),
        gridUpdateValidation: mlsMpmGridUpdate?.gridUpdateValidation
          ?? (mlsMpmGridUpdate?.schema ? false : undefined),
        gridValidation: mlsMpmGridUpdate?.gridValidation
          ?? (mlsMpmGridUpdate?.schema ? false : undefined),
        g2pValidation: mlsMpmGridUpdate?.g2pValidation
          ?? (mlsMpmGridUpdate?.schema ? false : undefined),
        sphValidation: mlsMpmGridUpdate?.sphValidation
          ?? (mlsMpmGridUpdate?.schema ? false : undefined),
        phaseChangeValidation: mlsMpmGridUpdate?.phaseChangeValidation
          ?? (mlsMpmGridUpdate?.schema ? false : undefined),
        fullPhysicsValidation: mlsMpmGridUpdate?.fullPhysicsValidation
          ?? (mlsMpmGridUpdate?.schema ? false : undefined)
      },
      mlsMpmG2pReconstruction: {
        schema: mlsMpmG2pReconstruction?.schema,
        reconstructionSchema: mlsMpmG2pReconstruction?.reconstructionSchema,
        backend: mlsMpmG2pReconstruction?.backend,
        webgpuStatus: mlsMpmG2pReconstruction?.webgpuStatus?.status,
        paritySchema: mlsMpmG2pReconstruction?.webgpuParity?.schema,
        parityStatus: mlsMpmG2pReconstruction?.webgpuParity?.status,
        parityMaxStateAbs: mlsMpmG2pReconstruction?.webgpuParity?.maxStateAbs ?? null,
        parityMaxMechanicsAbs: mlsMpmG2pReconstruction?.webgpuParity?.maxMechanicsAbs ?? null,
        parityTolerance: mlsMpmG2pReconstruction?.webgpuParity?.tolerance ?? null,
        readbackMode: mlsMpmG2pReconstruction?.readbackMode,
        normalHotLoopReadbackFree: mlsMpmG2pReconstruction?.normalHotLoopReadbackFree
          ?? (mlsMpmG2pReconstruction?.readbackMode === 'no-full-readback' ? true : undefined),
        particleCount: mlsMpmG2pReconstruction?.particleCount,
        gridNodeCount: mlsMpmG2pReconstruction?.gridNodeCount,
        stateStrideFloats: mlsMpmG2pReconstruction?.stateStrideFloats,
        mechanicsStrideFloats: mlsMpmG2pReconstruction?.mechanicsStrideFloats,
        dt: mlsMpmG2pReconstruction?.dt,
        p2gProjectionValidation: mlsMpmG2pReconstruction?.p2gProjectionValidation
          ?? (mlsMpmG2pReconstruction?.schema ? false : undefined),
        stressProjectionValidation: mlsMpmG2pReconstruction?.stressProjectionValidation
          ?? (mlsMpmG2pReconstruction?.schema ? false : undefined),
        gridUpdateValidation: mlsMpmG2pReconstruction?.gridUpdateValidation
          ?? (mlsMpmG2pReconstruction?.schema ? false : undefined),
        g2pValidation: mlsMpmG2pReconstruction?.g2pValidation
          ?? (mlsMpmG2pReconstruction?.schema ? false : undefined),
        gridValidation: mlsMpmG2pReconstruction?.gridValidation
          ?? (mlsMpmG2pReconstruction?.schema ? false : undefined),
        sphValidation: mlsMpmG2pReconstruction?.sphValidation
          ?? (mlsMpmG2pReconstruction?.schema ? false : undefined),
        phaseChangeValidation: mlsMpmG2pReconstruction?.phaseChangeValidation
          ?? (mlsMpmG2pReconstruction?.schema ? false : undefined),
        fullPhysicsValidation: mlsMpmG2pReconstruction?.fullPhysicsValidation
          ?? (mlsMpmG2pReconstruction?.schema ? false : undefined)
      },
      mlsMpmResidentStep: {
        schema: mlsMpmResidentStep?.schema,
        stepSchema: mlsMpmResidentStep?.stepSchema,
        backend: mlsMpmResidentStep?.backend,
        status: mlsMpmResidentStep?.status,
        stageStatus: mlsMpmResidentStep?.stageStatus,
        stageBackends: mlsMpmResidentStep?.stageBackends,
        stageTiming: mlsMpmResidentStep?.stageTiming,
        residentBuffersRetained: mlsMpmResidentStep?.residentBuffersRetained,
        stageBuffersRetained: mlsMpmResidentStep?.stageBuffersRetained,
        g2pOutputBuffersRetained: mlsMpmResidentStep?.g2pOutputBuffersRetained,
        residentBufferMode: mlsMpmResidentStep?.residentBufferMode,
        nextParticleBufferMode: mlsMpmResidentStep?.nextParticleBufferMode,
        nextParticleStateBufferByteLength: mlsMpmResidentStep?.nextParticleStateBufferByteLength,
        nextParticleThermoBufferByteLength: mlsMpmResidentStep?.nextParticleThermoBufferByteLength,
        nextParticleMechanicsBufferByteLength: mlsMpmResidentStep?.nextParticleMechanicsBufferByteLength,
        particlePingPong: mlsMpmResidentStep?.particlePingPong,
        requestedReadbackMode: mlsMpmResidentStep?.requestedReadbackMode,
        readbackMode: mlsMpmResidentStep?.readbackMode,
        normalHotLoopReadbackFree: mlsMpmResidentStep?.normalHotLoopReadbackFree,
        renderStateReadbackAvailable: mlsMpmResidentStep?.renderStateReadbackAvailable,
        gpuAuthoritativeState: mlsMpmResidentStep?.gpuAuthoritativeState,
        particleCount: mlsMpmResidentStep?.particleCount,
        gridNodeCount: mlsMpmResidentStep?.gridNodeCount,
        stateStrideFloats: mlsMpmResidentStep?.stateStrideFloats,
        mechanicsStrideFloats: mlsMpmResidentStep?.mechanicsStrideFloats,
        diagnostics: {
          particleCount: mlsMpmResidentStep?.diagnostics?.particleCount,
          gridNodeCount: mlsMpmResidentStep?.diagnostics?.gridNodeCount,
          activeGridNodeCount: mlsMpmResidentStep?.diagnostics?.activeGridNodeCount,
          activeGridNodeCountAvailable: mlsMpmResidentStep?.diagnostics?.activeGridNodeCountAvailable,
          activeGridNodeSummaryStatus: mlsMpmResidentStep?.diagnostics?.activeGridNodeSummaryStatus,
          gridNodeScanCount: mlsMpmResidentStep?.diagnostics?.gridNodeScanCount,
          gridNodeScanSkipped: mlsMpmResidentStep?.diagnostics?.gridNodeScanSkipped,
          massDeltaKg: mlsMpmResidentStep?.diagnostics?.massDeltaKg,
          sourceCenterOfMassM: mlsMpmResidentStep?.diagnostics?.sourceCenterOfMassM,
          nextCenterOfMassM: mlsMpmResidentStep?.diagnostics?.nextCenterOfMassM,
          centerOfMassDeltaM: mlsMpmResidentStep?.diagnostics?.centerOfMassDeltaM,
          sourcePositionBoundsM: mlsMpmResidentStep?.diagnostics?.sourcePositionBoundsM,
          nextPositionBoundsM: mlsMpmResidentStep?.diagnostics?.nextPositionBoundsM,
          maxSpeedMPerS: mlsMpmResidentStep?.diagnostics?.maxSpeedMPerS,
          maxDisplacementM: mlsMpmResidentStep?.diagnostics?.maxDisplacementM,
          phaseMassKg: mlsMpmResidentStep?.diagnostics?.phaseMassKg,
          temperatureMassWeightedMeanK: mlsMpmResidentStep?.diagnostics?.temperatureMassWeightedMeanK,
          minTemperatureK: mlsMpmResidentStep?.diagnostics?.minTemperatureK,
          maxTemperatureK: mlsMpmResidentStep?.diagnostics?.maxTemperatureK,
          thermalReadyCount: mlsMpmResidentStep?.diagnostics?.thermalReadyCount,
          thermalProblemCount: mlsMpmResidentStep?.diagnostics?.thermalProblemCount,
          finiteTemperatureCount: mlsMpmResidentStep?.diagnostics?.finiteTemperatureCount,
          phaseMassTotalKg: mlsMpmResidentStep?.diagnostics?.phaseMassTotalKg,
          thermalPhaseSummaryAvailable: mlsMpmResidentStep?.diagnostics?.thermalPhaseSummaryAvailable,
          thermalSummaryStatus: mlsMpmResidentStep?.diagnostics?.thermalSummaryStatus,
          readbackMode: mlsMpmResidentStep?.diagnostics?.readbackMode,
          compactGpuSummaryAvailable: mlsMpmResidentStep?.diagnostics?.compactGpuSummaryAvailable,
          compactGpuSummaryStatus: mlsMpmResidentStep?.diagnostics?.compactGpuSummaryStatus,
          compactGpuSummaryReadbackMode: mlsMpmResidentStep?.diagnostics?.compactGpuSummaryReadbackMode,
          compactSummaryScope: mlsMpmResidentStep?.diagnostics?.compactSummaryScope,
          compactReadbackByteLength: mlsMpmResidentStep?.diagnostics?.compactReadbackByteLength,
          compactSummaryReductionStrategy: mlsMpmResidentStep?.diagnostics?.compactSummaryReductionStrategy,
          fullPhysicsValidation: mlsMpmResidentStep?.diagnostics?.fullPhysicsValidation
        },
        p2gProjectionValidation: mlsMpmResidentStep?.p2gProjectionValidation,
        stressProjectionValidation: mlsMpmResidentStep?.stressProjectionValidation,
        gridUpdateValidation: mlsMpmResidentStep?.gridUpdateValidation,
        g2pValidation: mlsMpmResidentStep?.g2pValidation,
        gridValidation: mlsMpmResidentStep?.gridValidation,
        sphValidation: mlsMpmResidentStep?.sphValidation,
        phaseChangeValidation: mlsMpmResidentStep?.phaseChangeValidation,
        fullPhysicsValidation: mlsMpmResidentStep?.fullPhysicsValidation
      },
      mlsMpmResidentSteps: {
        schema: mlsMpmResidentSteps?.schema,
        backend: mlsMpmResidentSteps?.backend,
        status: mlsMpmResidentSteps?.status,
        stepCount: mlsMpmResidentSteps?.stepCount,
        completedStepCount: mlsMpmResidentSteps?.completedStepCount,
        retainIntermediateSteps: mlsMpmResidentSteps?.retainIntermediateSteps,
        retainedIntermediateStepCount: mlsMpmResidentSteps?.retainedIntermediateStepCount,
        finalStepSchema: mlsMpmResidentSteps?.finalStep?.schema,
        finalStepStatus: mlsMpmResidentSteps?.finalStep?.status,
        finalStepStageTiming: mlsMpmResidentSteps?.finalStep?.stageTiming,
        stepSummaries: mlsMpmResidentSteps?.stepSummaries,
        requestedReadbackMode: mlsMpmResidentSteps?.requestedReadbackMode,
        readbackMode: mlsMpmResidentSteps?.readbackMode,
        residentSourceMode: mlsMpmResidentSteps?.residentSourceMode,
        continuedFromResidentState: mlsMpmResidentSteps?.continuedFromResidentState,
        continuationAvailable: mlsMpmResidentSteps?.continuationAvailable,
        nextParticleBufferMode: mlsMpmResidentSteps?.nextParticleBufferMode,
        normalHotLoopReadbackFree: mlsMpmResidentSteps?.normalHotLoopReadbackFree,
        renderStateReadbackAvailable: mlsMpmResidentSteps?.renderStateReadbackAvailable,
        gpuAuthoritativeState: mlsMpmResidentSteps?.gpuAuthoritativeState,
        scientificValidation: mlsMpmResidentSteps?.scientificValidation,
        sphValidation: mlsMpmResidentSteps?.sphValidation,
        phaseChangeValidation: mlsMpmResidentSteps?.phaseChangeValidation,
        fullPhysicsValidation: mlsMpmResidentSteps?.fullPhysicsValidation
      },
      schroederPhaseVolumeDiagnostics: {
        schema: schroederPhaseVolumeDiagnostics?.schema,
        status: schroederPhaseVolumeDiagnostics?.status,
        phaseVolumeDiagnosticSummaryStatus:
          schroederPhaseVolumeDiagnostics?.phaseVolumeDiagnosticSummaryStatus,
        phaseVolumeMigrationStatus: schroederPhaseVolumeDiagnostics?.phaseVolumeMigrationStatus,
        phaseVolumeLevelUpdateStatus: schroederPhaseVolumeDiagnostics?.phaseVolumeLevelUpdateStatus,
        selectedLevel: schroederPhaseVolumeDiagnostics?.selectedLevel,
        nativeLevelSource: schroederPhaseVolumeDiagnostics?.nativeLevelSource,
        phaseVolumeLevelUpdateConsumed:
          schroederPhaseVolumeDiagnostics?.phaseVolumeLevelUpdateConsumed,
        representedToRestVolumeRatio:
          schroederPhaseVolumeDiagnostics?.representedToRestVolumeRatio,
        representedRadiusScale: schroederPhaseVolumeDiagnostics?.representedRadiusScale,
        expectedLevelDeltaFromVolume:
          schroederPhaseVolumeDiagnostics?.expectedLevelDeltaFromVolume,
        observedPositiveLevelDelta:
          schroederPhaseVolumeDiagnostics?.observedPositiveLevelDelta,
        particleCountGrowthFactor:
          schroederPhaseVolumeDiagnostics?.particleCountGrowthFactor,
        particleCountGrowthStatus:
          schroederPhaseVolumeDiagnostics?.particleCountGrowthStatus,
        waterToSteamScaleMigrationObserved:
          schroederPhaseVolumeDiagnostics?.waterToSteamScaleMigrationObserved,
        particleExplosionAvoidanceStatus:
          schroederPhaseVolumeDiagnostics?.particleExplosionAvoidanceStatus,
        noFullParticleReadback: schroederPhaseVolumeDiagnostics?.noFullParticleReadback
      },
      sphResidentRenderState: {
        schema: sphResidentRenderState?.schema,
        status: sphResidentRenderState?.status,
        residentPressureInterfaceStateStatus: sphResidentRenderState?.residentPressureInterfaceStateStatus,
        source: sphResidentRenderState?.source,
        sourceExecutionSchema: sphResidentRenderState?.sourceExecutionSchema,
        backend: sphResidentRenderState?.backend,
        particleCount: sphResidentRenderState?.particleCount,
        surfaceCount: sphResidentRenderState?.surfaceCount,
        rowStrideFloats: sphResidentRenderState?.rowStrideFloats,
        renderRowByteLength: sphResidentRenderState?.renderRowByteLength,
        renderRowsBufferRetained: sphResidentRenderState?.renderRowsBufferRetained,
        renderRowsBufferByteLength: sphResidentRenderState?.renderRowsBufferByteLength,
        renderRowsReadback: sphResidentRenderState?.renderRowsReadback,
        renderRowsReadbackMode: sphResidentRenderState?.renderRowsReadbackMode,
        renderRowsGpuHandoffCopy: sphResidentRenderState?.renderRowsGpuHandoffCopy,
        renderRowsHandoffMode: sphResidentRenderState?.renderRowsHandoffMode,
        renderRowsReadbackByteLength: sphResidentRenderState?.renderRowsReadbackByteLength,
        renderRowsDecodedPositionCount: sphResidentRenderState?.renderRowsDecodedPositionCount,
        renderRowsDecodedTotalMassKg: sphResidentRenderState?.renderRowsDecodedTotalMassKg,
        renderRowsDecodedCenterOfMassM: sphResidentRenderState?.renderRowsDecodedCenterOfMassM,
        renderRowsDecodedPositionBoundsM: sphResidentRenderState?.renderRowsDecodedPositionBoundsM,
        renderFieldCellStrideFloats: sphResidentRenderState?.renderFieldCellStrideFloats,
        renderFieldByteLength: sphResidentRenderState?.renderFieldByteLength,
        renderFieldReadback: sphResidentRenderState?.renderFieldReadback,
        renderFieldStatus: sphResidentRenderState?.renderFieldStatus,
        renderFieldBackend: sphResidentRenderState?.renderFieldBackend,
        renderFieldInputSource: sphResidentRenderState?.renderFieldInputSource,
        renderFieldEmptyRetryReadback: sphResidentRenderState?.renderFieldEmptyRetryReadback,
        renderFieldEmptyRetryReason: sphResidentRenderState?.renderFieldEmptyRetryReason,
        renderFieldSurfaceCount: sphResidentRenderState?.renderFieldSurfaceCount,
        renderFieldTotalCells: sphResidentRenderState?.renderFieldTotalCells,
        renderFieldBufferMode: sphResidentRenderState?.renderFieldBufferMode,
        surfaceDrawSchema: sphResidentRenderState?.surfaceDrawSchema,
        surfaceDrawStatus: sphResidentRenderState?.surfaceDrawStatus,
        surfaceDrawReason: sphResidentRenderState?.surfaceDrawReason,
        surfaceDrawSourceRenderFieldSchema: sphResidentRenderState?.surfaceDrawSourceRenderFieldSchema,
        surfaceDrawSourceSurfaceVertexSchema: sphResidentRenderState?.surfaceDrawSourceSurfaceVertexSchema,
        surfaceDrawSurfaceDrawSchema: sphResidentRenderState?.surfaceDrawSurfaceDrawSchema,
        surfaceDrawSurfaceCount: sphResidentRenderState?.surfaceDrawSurfaceCount,
        surfaceDrawSourceVertexRowCount: sphResidentRenderState?.surfaceDrawSourceVertexRowCount,
        surfaceDrawRowsBufferRetained: sphResidentRenderState?.surfaceDrawRowsBufferRetained,
        surfaceDrawRowsBufferByteLength: sphResidentRenderState?.surfaceDrawRowsBufferByteLength,
        surfaceDrawIndirectSchema: sphResidentRenderState?.surfaceDrawIndirectSchema,
        surfaceDrawIndirectRowStrideUints: sphResidentRenderState?.surfaceDrawIndirectRowStrideUints,
        surfaceDrawIndirectRowsBufferRetained: sphResidentRenderState?.surfaceDrawIndirectRowsBufferRetained,
        surfaceDrawIndirectRowsBufferByteLength: sphResidentRenderState?.surfaceDrawIndirectRowsBufferByteLength,
        surfaceDrawCompactedVertexRowsBufferRetained: sphResidentRenderState?.surfaceDrawCompactedVertexRowsBufferRetained,
        surfaceDrawCompactedVertexRowsBufferByteLength: sphResidentRenderState?.surfaceDrawCompactedVertexRowsBufferByteLength,
        surfaceDrawReadback: sphResidentRenderState?.surfaceDrawReadback,
        surfaceDrawReadbackMode: sphResidentRenderState?.surfaceDrawReadbackMode,
        surfaceDrawCompactionMode: sphResidentRenderState?.surfaceDrawCompactionMode,
        surfaceDrawInputBuffersReleased: sphResidentRenderState?.surfaceDrawInputBuffersReleased,
        surfaceDrawVisibleRenderSource: sphResidentRenderState?.surfaceDrawVisibleRenderSource,
        surfaceDrawVisibleRendererBridge: sphResidentRenderState?.surfaceDrawVisibleRendererBridge,
        surfaceDrawRenderBridgeSchema: sphResidentRenderState?.surfaceDrawRenderBridgeSchema,
        surfaceDrawRenderBridgeStatus: sphResidentRenderState?.surfaceDrawRenderBridgeStatus,
        surfaceDrawRenderBridgeReason: sphResidentRenderState?.surfaceDrawRenderBridgeReason,
        surfaceDrawRenderBridgeFrameCount: sphResidentRenderState?.surfaceDrawRenderBridgeFrameCount,
        surfaceDrawRenderBridgeLastRenderStatus: sphResidentRenderState?.surfaceDrawRenderBridgeLastRenderStatus,
        surfaceDrawRenderBridgeDrawOrderingPolicy: sphResidentRenderState?.surfaceDrawRenderBridgeDrawOrderingPolicy,
        surfaceDrawRenderBridgeDrawOrderCount: sphResidentRenderState?.surfaceDrawRenderBridgeDrawOrderCount,
        surfaceDrawRenderBridgeDrawOrderSurfaceIndices: sphResidentRenderState?.surfaceDrawRenderBridgeDrawOrderSurfaceIndices,
        surfaceDrawRenderBridgeDrawOrderIndirectOffsets: sphResidentRenderState?.surfaceDrawRenderBridgeDrawOrderIndirectOffsets,
        surfaceDrawRenderBridgeDepthPolicy: sphResidentRenderState?.surfaceDrawRenderBridgeDepthPolicy,
        surfaceDrawRenderBridgeDepthAttachmentFormat: sphResidentRenderState?.surfaceDrawRenderBridgeDepthAttachmentFormat,
        surfaceDrawRenderBridgeDepthAttachmentReady: sphResidentRenderState?.surfaceDrawRenderBridgeDepthAttachmentReady,
        surfaceDrawRenderBridgeTransparencyCompositeMode: sphResidentRenderState?.surfaceDrawRenderBridgeTransparencyCompositeMode,
        surfaceDrawRenderBridgeOitAccumFormat: sphResidentRenderState?.surfaceDrawRenderBridgeOitAccumFormat,
        surfaceDrawRenderBridgeOitRevealFormat: sphResidentRenderState?.surfaceDrawRenderBridgeOitRevealFormat,
        surfaceDrawRenderBridgeOitTargetsReady: sphResidentRenderState?.surfaceDrawRenderBridgeOitTargetsReady,
        surfaceDrawRenderBridgeLastOpaqueDrawCount: sphResidentRenderState?.surfaceDrawRenderBridgeLastOpaqueDrawCount,
        surfaceDrawRenderBridgeLastTransparentDrawCount: sphResidentRenderState?.surfaceDrawRenderBridgeLastTransparentDrawCount,
        surfaceDrawRenderBridgeOpticalRenderSource: sphResidentRenderState?.surfaceDrawRenderBridgeOpticalRenderSource,
        surfaceDrawRenderBridgeOpticalRecordCount: sphResidentRenderState?.surfaceDrawRenderBridgeOpticalRecordCount,
        surfaceDrawRenderBridgeOpticalRecordStrideFloats: sphResidentRenderState?.surfaceDrawRenderBridgeOpticalRecordStrideFloats,
        surfaceDrawRenderBridgeOpticalSpectralSampleCount: sphResidentRenderState?.surfaceDrawRenderBridgeOpticalSpectralSampleCount,
        surfaceDrawRenderBridgeOpticalSpectralSampleStrideFloats: sphResidentRenderState?.surfaceDrawRenderBridgeOpticalSpectralSampleStrideFloats,
        materialInterfaceFieldSchema: sphResidentRenderState?.materialInterfaceFieldSchema,
        materialInterfaceFieldStatus: sphResidentRenderState?.materialInterfaceFieldStatus,
        materialInterfaceReadySurfaceCount: sphResidentRenderState?.materialInterfaceReadySurfaceCount,
        materialInterfaceTotalSurfaceAreaM2: sphResidentRenderState?.materialInterfaceTotalSurfaceAreaM2,
        schroederSourceKeyReplayDiagnosticsSchema:
          sphResidentRenderState?.schroederSourceKeyReplayDiagnosticsSchema,
        schroederSourceKeyReplayDiagnosticsStatus:
          sphResidentRenderState?.schroederSourceKeyReplayDiagnosticsStatus,
        schroederSourceKeyReplayReady: sphResidentRenderState?.schroederSourceKeyReplayReady,
        schroederSourceKeyReplayProductionRowCount:
          sphResidentRenderState?.schroederSourceKeyReplayProductionRowCount,
        schroederSourceKeyReplayProductionReadyCount:
          sphResidentRenderState?.schroederSourceKeyReplayProductionReadyCount,
        schroederSourceKeyReplayRetainedRefPublicationStatus:
          sphResidentRenderState?.schroederSourceKeyReplayRetainedRefPublicationStatus,
        schroederSourceKeyReplayRetainedRefPublicationReady:
          sphResidentRenderState?.schroederSourceKeyReplayRetainedRefPublicationReady,
        schroederSourceKeyReplayRetainedBufferRefCount:
          sphResidentRenderState?.schroederSourceKeyReplayRetainedBufferRefCount,
        schroederSourceKeyReplayPressureConsumerStatus:
          sphResidentRenderState?.schroederSourceKeyReplayPressureConsumerStatus,
        schroederSourceKeyReplayPressureConsumerObserved:
          sphResidentRenderState?.schroederSourceKeyReplayPressureConsumerObserved,
        schroederSourceKeyReplayPressureConsumerConsumed:
          sphResidentRenderState?.schroederSourceKeyReplayPressureConsumerConsumed,
        schroederSourceKeyReplayRawGpuBufferSerialized:
          sphResidentRenderState?.schroederSourceKeyReplayRawGpuBufferSerialized,
        schroederSourceKeyReplayPortablePayloadMode:
          sphResidentRenderState?.schroederSourceKeyReplayPortablePayloadMode,
        materialInterfaceForceCouplingStatus: sphResidentRenderState?.materialInterfaceForceCouplingStatus,
        pressureInterfaceCouplingSchema: sphResidentRenderState?.pressureInterfaceCouplingSchema,
        pressureInterfaceCouplingStatus: sphResidentRenderState?.pressureInterfaceCouplingStatus,
        pressureInterfaceForceCouplingStatus: sphResidentRenderState?.pressureInterfaceForceCouplingStatus,
        pressureInterfaceForcePreviewSchema: sphResidentRenderState?.pressureInterfaceForcePreviewSchema,
        pressureInterfaceForcePreviewStatus: sphResidentRenderState?.pressureInterfaceForcePreviewStatus,
        pressureInterfaceForceApplicationStatus: sphResidentRenderState?.pressureInterfaceForceApplicationStatus,
        pressureInterfacePreviewedElementCount: sphResidentRenderState?.pressureInterfacePreviewedElementCount,
        pressureInterfaceTotalAbsForceN: sphResidentRenderState?.pressureInterfaceTotalAbsForceN,
        pressureInterfaceForceSolverSchema: sphResidentRenderState?.pressureInterfaceForceSolverSchema,
        pressureInterfaceForceSolverStatus: sphResidentRenderState?.pressureInterfaceForceSolverStatus,
        pressureInterfaceSolverApplicationStatus: sphResidentRenderState?.pressureInterfaceSolverApplicationStatus,
        pressureInterfaceSolverForceRowCount: sphResidentRenderState?.pressureInterfaceSolverForceRowCount,
        pressureInterfaceContactBinGridStatus: sphResidentRenderState?.pressureInterfaceContactBinGridStatus,
        pressureInterfaceContactBinGridEnabled: sphResidentRenderState?.pressureInterfaceContactBinGridEnabled,
        pressureInterfaceContactBinGridCellCount: sphResidentRenderState?.pressureInterfaceContactBinGridCellCount,
        pressureInterfaceContactBinGridBinCapacity: sphResidentRenderState?.pressureInterfaceContactBinGridBinCapacity,
        pressureInterfaceContactBinGridAverageOccupancy: sphResidentRenderState?.pressureInterfaceContactBinGridAverageOccupancy,
        pressureInterfaceContactBinGridEstimatedOverflowRisk: sphResidentRenderState?.pressureInterfaceContactBinGridEstimatedOverflowRisk,
        pressureInterfaceContactBinGridIndexBufferByteLength: sphResidentRenderState?.pressureInterfaceContactBinGridIndexBufferByteLength,
        pressureInterfaceContactBinOverflowStatus: sphResidentRenderState?.pressureInterfaceContactBinOverflowStatus,
        pressureInterfaceContactBinOverflowCount: sphResidentRenderState?.pressureInterfaceContactBinOverflowCount,
        pressureInterfaceSolverConservationStatus: sphResidentRenderState?.pressureInterfaceSolverConservationStatus,
        pressureInterfaceSolverConservationResidualMagnitudeN: sphResidentRenderState?.pressureInterfaceSolverConservationResidualMagnitudeN,
        pressureInterfaceForceRowsUploadStatus: sphResidentRenderState?.pressureInterfaceForceRowsUploadStatus,
        pressureInterfaceForceRowsUploadBlocker: sphResidentRenderState?.pressureInterfaceForceRowsUploadBlocker,
        pressureInterfaceForceRowsBufferRetained: sphResidentRenderState?.pressureInterfaceForceRowsBufferRetained,
        pressureInterfaceForceRowsBufferByteLength: sphResidentRenderState?.pressureInterfaceForceRowsBufferByteLength,
        pressureInterfaceForceRowsCandidateByteLength: sphResidentRenderState?.pressureInterfaceForceRowsCandidateByteLength,
        pressureInterfaceForceRowsUploadQueueCompletionStatus: sphResidentRenderState?.pressureInterfaceForceRowsUploadQueueCompletionStatus,
        pressureInterfaceForceRowsUploadQueueCompletionMethod: sphResidentRenderState?.pressureInterfaceForceRowsUploadQueueCompletionMethod,
        pressureInterfaceForceRowsConsumerQueueCompletionStatus: sphResidentRenderState?.pressureInterfaceForceRowsConsumerQueueCompletionStatus,
        pressureInterfaceForceRowsConsumerQueueCompletionMethod: sphResidentRenderState?.pressureInterfaceForceRowsConsumerQueueCompletionMethod,
        pressureInterfaceGridForceAdmissionSchema: sphResidentRenderState?.pressureInterfaceGridForceAdmissionSchema,
        pressureInterfaceGridForceAdmissionStatus: sphResidentRenderState?.pressureInterfaceGridForceAdmissionStatus,
        pressureInterfaceGridForceAdmissionApproved: sphResidentRenderState?.pressureInterfaceGridForceAdmissionApproved,
        pressureInterfaceGridForceAdmissionDescriptorStatus: sphResidentRenderState?.pressureInterfaceGridForceAdmissionDescriptorStatus,
        pressureInterfaceGridForceAdmissionSourceHotBufferKey: sphResidentRenderState?.pressureInterfaceGridForceAdmissionSourceHotBufferKey,
        renderRowsReadback: sphResidentRenderState?.renderRowsReadback,
        renderRowsReadbackMode: sphResidentRenderState?.renderRowsReadbackMode,
        renderRowsGpuHandoffCopy: sphResidentRenderState?.renderRowsGpuHandoffCopy,
        renderRowsHandoffMode: sphResidentRenderState?.renderRowsHandoffMode,
        renderRowsReadbackByteLength: sphResidentRenderState?.renderRowsReadbackByteLength,
        compactRenderReadback: sphResidentRenderState?.compactRenderReadback,
        normalHotLoopReadbackFree: sphResidentRenderState?.normalHotLoopReadbackFree,
        residentSurfaceTableStatus: sphResidentRenderState?.residentSurfaceTableStatus,
        residentSurfaceTableSurfaceCount: sphResidentRenderState?.residentSurfaceTableSurfaceCount,
        residentSurfaceTableTotalFieldCells: sphResidentRenderState?.residentSurfaceTableTotalFieldCells,
        renderReadbackCadence: sphResidentRenderState?.renderReadbackCadence,
        gpuAuthoritativeState: sphResidentRenderState?.gpuAuthoritativeState,
        materialKeys: sphResidentRenderState?.materialKeys,
        phaseKeys: sphResidentRenderState?.phaseKeys,
        scientificValidation: sphResidentRenderState?.scientificValidation,
        sphValidation: sphResidentRenderState?.sphValidation,
        phaseChangeValidation: sphResidentRenderState?.phaseChangeValidation,
        fullPhysicsValidation: sphResidentRenderState?.fullPhysicsValidation
      },
      sphResidentSurfaceDraw: {
        schema: sphResidentSurfaceDraw?.schema,
        status: sphResidentSurfaceDraw?.status,
        reason: sphResidentSurfaceDraw?.reason,
        sourceRenderFieldSchema: sphResidentSurfaceDraw?.sourceRenderFieldSchema,
        sourceSurfaceVertexSchema: sphResidentSurfaceDraw?.sourceSurfaceVertexSchema,
        surfaceDrawSchema: sphResidentSurfaceDraw?.surfaceDrawSchema,
        surfaceCount: sphResidentSurfaceDraw?.surfaceCount,
        sourceVertexRowCount: sphResidentSurfaceDraw?.sourceVertexRowCount,
        drawRowsBufferRetained: sphResidentSurfaceDraw?.drawRowsBufferRetained,
        drawRowsBufferByteLength: sphResidentSurfaceDraw?.drawRowsBufferByteLength,
        drawIndirectSchema: sphResidentSurfaceDraw?.drawIndirectSchema,
        drawIndirectRowStrideUints: sphResidentSurfaceDraw?.drawIndirectRowStrideUints,
        drawIndirectRowsBufferRetained: sphResidentSurfaceDraw?.drawIndirectRowsBufferRetained,
        drawIndirectRowsBufferByteLength: sphResidentSurfaceDraw?.drawIndirectRowsBufferByteLength,
        compactedVertexRowsBufferRetained: sphResidentSurfaceDraw?.compactedVertexRowsBufferRetained,
        compactedVertexRowsBufferByteLength: sphResidentSurfaceDraw?.compactedVertexRowsBufferByteLength,
        readbackMode: sphResidentSurfaceDraw?.readbackMode,
        surfaceDrawReadback: sphResidentSurfaceDraw?.surfaceDrawReadback,
        compactionMode: sphResidentSurfaceDraw?.compactionMode,
        renderFieldBufferMode: sphResidentSurfaceDraw?.renderFieldBufferMode,
        surfaceVertexBufferMode: sphResidentSurfaceDraw?.surfaceVertexBufferMode,
        surfaceDrawBufferMode: sphResidentSurfaceDraw?.surfaceDrawBufferMode,
        surfaceDrawInputBuffersReleased: sphResidentSurfaceDraw?.surfaceDrawInputBuffersReleased,
        visibleRenderSource: sphResidentSurfaceDraw?.visibleRenderSource,
        visibleRendererBridge: sphResidentSurfaceDraw?.visibleRendererBridge,
        renderBridgeSchema: sphResidentSurfaceDraw?.renderBridgeSchema,
        renderBridgeStatus: sphResidentSurfaceDraw?.renderBridgeStatus,
        renderBridgeReason: sphResidentSurfaceDraw?.renderBridgeReason,
        renderBridgeFrameCount: sphResidentSurfaceDraw?.renderBridgeFrameCount,
        renderBridgeLastRenderStatus: sphResidentSurfaceDraw?.renderBridgeLastRenderStatus,
        renderBridgeDrawOrderingPolicy: sphResidentSurfaceDraw?.renderBridgeDrawOrderingPolicy,
        renderBridgeDrawOrderCount: sphResidentSurfaceDraw?.renderBridgeDrawOrderCount,
        renderBridgeDrawOrderSurfaceIndices: sphResidentSurfaceDraw?.renderBridgeDrawOrderSurfaceIndices,
        renderBridgeDrawOrderIndirectOffsets: sphResidentSurfaceDraw?.renderBridgeDrawOrderIndirectOffsets,
        renderBridgeDepthPolicy: sphResidentSurfaceDraw?.renderBridgeDepthPolicy,
        renderBridgeDepthAttachmentFormat: sphResidentSurfaceDraw?.renderBridgeDepthAttachmentFormat,
        renderBridgeDepthAttachmentReady: sphResidentSurfaceDraw?.renderBridgeDepthAttachmentReady,
        renderBridgeTransparencyCompositeMode: sphResidentSurfaceDraw?.renderBridgeTransparencyCompositeMode,
        renderBridgeOitAccumFormat: sphResidentSurfaceDraw?.renderBridgeOitAccumFormat,
        renderBridgeOitRevealFormat: sphResidentSurfaceDraw?.renderBridgeOitRevealFormat,
        renderBridgeOitTargetsReady: sphResidentSurfaceDraw?.renderBridgeOitTargetsReady,
        renderBridgeLastOpaqueDrawCount: sphResidentSurfaceDraw?.renderBridgeLastOpaqueDrawCount,
        renderBridgeLastTransparentDrawCount: sphResidentSurfaceDraw?.renderBridgeLastTransparentDrawCount,
        renderBridgeOpticalRenderSource: sphResidentSurfaceDraw?.renderBridgeOpticalRenderSource,
        renderBridgeOpticalRecordCount: sphResidentSurfaceDraw?.renderBridgeOpticalRecordCount,
        renderBridgeOpticalRecordStrideFloats: sphResidentSurfaceDraw?.renderBridgeOpticalRecordStrideFloats,
        renderBridgeOpticalSpectralSampleCount: sphResidentSurfaceDraw?.renderBridgeOpticalSpectralSampleCount,
        renderBridgeOpticalSpectralSampleStrideFloats: sphResidentSurfaceDraw?.renderBridgeOpticalSpectralSampleStrideFloats,
        renderBridgeTemporalSwapPolicy: sphResidentSurfaceDraw?.renderBridgeTemporalSwapPolicy,
        renderBridgeRetainedPreviousOverlay: sphResidentSurfaceDraw?.renderBridgeRetainedPreviousOverlay,
        hasDrawRowsBuffer: Boolean(sphResidentSurfaceDraw?.surfaceDraw?.drawRowsBuffer),
        hasDrawIndirectRowsBuffer: Boolean(sphResidentSurfaceDraw?.surfaceDraw?.drawIndirectRowsBuffer),
        hasCompactedVertexRowsBuffer: Boolean(sphResidentSurfaceDraw?.surfaceDraw?.compactedVertexRowsBuffer)
      },
      sphResidentSurfaceDrawRenderBridge: {
        schema: sphResidentSurfaceDrawRenderBridge?.schema,
        status: sphResidentSurfaceDrawRenderBridge?.status,
        rendererBridge: sphResidentSurfaceDrawRenderBridge?.rendererBridge,
        visibleRenderSource: sphResidentSurfaceDrawRenderBridge?.visibleRenderSource,
        frameCount: sphResidentSurfaceDrawRenderBridge?.frameCount,
        lastRenderStatus: sphResidentSurfaceDrawRenderBridge?.lastRenderStatus,
        reason: sphResidentSurfaceDrawRenderBridge?.reason,
        canvasWidth: sphResidentSurfaceDrawRenderBridge?.canvas?.width,
        canvasHeight: sphResidentSurfaceDrawRenderBridge?.canvas?.height,
        drawSurfaceCount: sphResidentSurfaceDrawRenderBridge?.drawState?.surfaceCount,
        drawOrderingPolicy: sphResidentSurfaceDrawRenderBridge?.drawOrderingPolicy,
        drawOrderCount: sphResidentSurfaceDrawRenderBridge?.drawOrderCount,
        drawOrderSurfaceIndices: sphResidentSurfaceDrawRenderBridge?.drawOrderSurfaceIndices,
        drawOrderIndirectOffsets: sphResidentSurfaceDrawRenderBridge?.drawOrderIndirectOffsets,
        depthPolicy: sphResidentSurfaceDrawRenderBridge?.depthPolicy,
        depthAttachmentFormat: sphResidentSurfaceDrawRenderBridge?.depthAttachmentFormat,
        depthAttachmentReady: sphResidentSurfaceDrawRenderBridge?.depthAttachmentReady,
        transparencyCompositeMode: sphResidentSurfaceDrawRenderBridge?.transparencyCompositeMode,
        oitAccumFormat: sphResidentSurfaceDrawRenderBridge?.oitAccumFormat,
        oitRevealFormat: sphResidentSurfaceDrawRenderBridge?.oitRevealFormat,
        oitTargetsReady: sphResidentSurfaceDrawRenderBridge?.oitTargetsReady,
        lastOpaqueDrawCount: sphResidentSurfaceDrawRenderBridge?.lastOpaqueDrawCount,
        lastTransparentDrawCount: sphResidentSurfaceDrawRenderBridge?.lastTransparentDrawCount,
        opticalRenderSource: sphResidentSurfaceDrawRenderBridge?.opticalRenderSource,
        opticalRecordCount: sphResidentSurfaceDrawRenderBridge?.opticalRecordCount,
        opticalRecordStrideFloats: sphResidentSurfaceDrawRenderBridge?.opticalRecordStrideFloats,
        opticalSpectralSampleCount: sphResidentSurfaceDrawRenderBridge?.opticalSpectralSampleCount,
        opticalSpectralSampleStrideFloats: sphResidentSurfaceDrawRenderBridge?.opticalSpectralSampleStrideFloats,
        temporalSwapPolicy: sphResidentSurfaceDrawRenderBridge?.temporalSwapPolicy,
        retainedPreviousOverlay: sphResidentSurfaceDrawRenderBridge?.retainedPreviousOverlay,
        hasDrawIndirectRowsBuffer: Boolean(sphResidentSurfaceDrawRenderBridge?.drawState?.drawIndirectRowsBuffer)
      },
      sphResidentPerf: overlay.__sphResidentPerf,
      visibleSurfaces: visibleSurfaces.filter((surface) => surface.visible)
        .map((surface) => ({ ...surface })),
      containerWire: containerWire ? {
        renderLayer: containerWire.userData.renderLayer,
        renderOrder: containerWire.renderOrder,
        materialDepthWrite: containerWire.material?.depthWrite ?? null
      } : null,
      containerGrid: containerGrid ? {
        renderLayer: containerGrid.userData.renderLayer,
        renderOrder: containerGrid.renderOrder,
        materialDepthWrite: materialList(containerGrid.material).every((material) => material?.depthWrite === false),
        materialDepthTest: materialList(containerGrid.material).every((material) => material?.depthTest !== false)
      } : null
    };
  });
  expect(derivedSummary.canvasWidth).toBeGreaterThan(100);
  expect(derivedSummary.canvasHeight).toBeGreaterThan(100);
  expect(derivedSummary.driverReady || derivedSummary.viewStateReady).toBe(true);
  expect(derivedSummary.resetStatus?.schema).toBe('peercompute.ulg.sph-demo-reset-status.v0');
  expect(derivedSummary.resetStatus?.status).toBe('particle-state-resynced-after-reset');
  expect(derivedSummary.resetStatus?.generation).toBeGreaterThan(0);
  expect(derivedSummary.residentExecutionInvalidation?.schema).toBe('peercompute.ulg.sph-scene-resident-execution-invalidation.v0');
  expect(derivedSummary.residentExecutionInvalidation?.status).toBe('resident-execution-generation-advanced');
  expect(derivedSummary.residentExecutionGeneration).toBeGreaterThan(0);
  expect(derivedSummary.setParticlesTiming?.residentExecutionGeneration).toBe(derivedSummary.residentExecutionGeneration);
  expect(derivedSummary.residentStepsProgress?.currentResidentExecutionGeneration).toBe(derivedSummary.residentExecutionGeneration);
  const usesThreeRenderRowBridge = SPH_THREE_RENDER_ROW_BRIDGES.includes(
    derivedSummary.sphResidentRenderState.surfaceDrawVisibleRendererBridge
  );
  if (!derivedSummary.driverReady) {
    expect(derivedSummary.workerRebuild?.status).toBe('complete');
    expect(derivedSummary.workerRebuildTiming?.schema).toBe('peercompute.ulg.sph-phase-worker-rebuild-timing.v0');
    expect(Number.isFinite(derivedSummary.workerRebuildTiming?.totalMs)).toBe(true);
    expect(Number.isFinite(derivedSummary.workerRebuildTiming?.stageMs?.createSphPhaseDemo)).toBe(true);
    expect(derivedSummary.viewStateSource).toBe('peercompute-worker-packed-state');
  }
  expect(derivedSummary.overlayResidentRequestedReadbackMode).toBe('no-full-readback');
  expect(derivedSummary.statusText).toContain('resident readback: requested=no-full-readback');
  expect(derivedSummary.statusText).toContain('material iface  :');
  expect(derivedSummary.statusText).toContain('render source    :');
  expect(derivedSummary.statusText).toContain('surface draw     :');
  expect(derivedSummary.statusText).toContain('resident profile :');
  expect(derivedSummary.statusText).toContain('resident stages  :');
  expect(derivedSummary.statusText).toContain('scene sync       :');
  expect(derivedSummary.statusText).toContain('worker rebuild   :');
  expect(derivedSummary.statusText).toContain('mls grid         :');
  expect(derivedSummary.statusText).toContain('fps              :');
  expect(derivedSummary.statusText).toContain('closure cache    :');
  expect(derivedSummary.statusText).toContain('cold cache       :');
  expect(derivedSummary.statusText).toContain('table-writes=');
  expect(derivedSummary.statusText).toContain('gpu-writes=');
  expect(derivedSummary.statusText).toContain('gas pressure     :');
  expect(derivedSummary.statusText).toContain('cache clear      :');
  expect(derivedSummary.statusText).toContain('perf trace       :');
  expect(derivedSummary.statusText).toContain('cpu closure task :');
  if (derivedSummary.driverReady) {
    expect(derivedSummary.statusText).toContain('resident source  :');
    expect(derivedSummary.statusText).toContain('resident motion  :');
    expect(derivedSummary.statusText).toContain('compact summary  :');
    expect(derivedSummary.statusText).toContain('thermal graph gpu: status=');
    expect(derivedSummary.statusText).toContain('render cadence   :');
    expect(derivedSummary.statusText).toContain('standalone mech  : standalone-mechanics-prediction-disabled backend=disabled');
    expect(derivedSummary.statusText).toContain('render authoritative:');
    expect(derivedSummary.statusText).toContain('gpu authoritative: false');
  } else {
    expect(derivedSummary.statusText).toContain('view state       : peercompute-worker-packed-state');
    expect(derivedSummary.statusText).toContain('worker view-state evidence-only');
  }
  expect(derivedSummary.warningText).toContain('render fps');
  expect(derivedSummary.warningText).toContain('physics fps');
  expect(derivedSummary.frameCounters).toBeTruthy();
  expect(Number.isFinite(derivedSummary.frameCounters.renderFps)).toBe(true);
  expect(derivedSummary.peerClosureCache?.write?.schema).toBe('peercompute.ulg.local-derived-closure-cache.v2');
  expect(derivedSummary.peerClosureCache?.write?.generatorFingerprint).toMatch(/^ulg:/);
  expect(derivedSummary.peerClosureCache?.coldStartWrite?.schema).toBe('peercompute.ulg.sph-cold-start-cache.v0');
  expect(derivedSummary.peerClosureCache?.staticTableWrite?.schema).toBe('peercompute.ulg.sph-static-table-cache-update.v0');
  expect(derivedSummary.peerClosureCache.staticTableWrite.backend).toMatch(/worker|deferred/);
  expect(derivedSummary.peerClosureCache.staticTableWrite.cacheSnapshotBytes).toBeGreaterThan(1000);
  expect(derivedSummary.peerClosureCache.staticTableWrite.counts.tables).toBeGreaterThanOrEqual(4);
  expect(derivedSummary.peerClosureCache.staticTableWrite.counts.gpuWarmup).toBeGreaterThanOrEqual(1);
  expect(derivedSummary.peerClosureCache.staticTableRead?.status).toBe('static-table-cache-bundle-hit');
  expect(derivedSummary.setParticlesTiming.staticTableCacheStatus).toBe('static-table-cache-bundle-hit');
  expect(derivedSummary.setParticlesTiming.staticTableCacheFamilies.length).toBeGreaterThanOrEqual(4);
  expect(derivedSummary.performanceTrace?.schema).toBe('peercompute.ulg.sph-cold-start-performance-trace.v0');
  expect(derivedSummary.performanceTrace?.spans?.length).toBeGreaterThan(0);
  expect(derivedSummary.setParticlesTiming?.schema).toBe('peercompute.ulg.sph-scene-set-particles-timing.v0');
  expect(Number.isFinite(derivedSummary.setParticlesTiming.totalMs)).toBe(true);
  expect(Number.isFinite(derivedSummary.setParticlesTiming.stageMs.surfaceBatching)).toBe(true);
  expect(Number.isFinite(derivedSummary.setParticlesTiming.stageMs.opticalState)).toBe(true);
  expect(derivedSummary.clearCacheButtonReady).toBe(true);
  expect(derivedSummary.cpuClosureTask).toBe(null);
  expect(derivedSummary.visibleSurfaces.length).toBeGreaterThan(0);
  expect(derivedSummary.containerWire.renderLayer).toBe('container-wire');
  expect(derivedSummary.containerWire.materialDepthWrite).toBe(false);
  expect(derivedSummary.containerWire.renderOrder).toBeGreaterThan(
    Math.max(...derivedSummary.visibleSurfaces.map((surface) => surface.renderOrder))
  );
  expect(derivedSummary.containerGrid.renderLayer).toBe('container-grid');
  expect(derivedSummary.containerGrid.materialDepthWrite).toBe(true);
  expect(derivedSummary.containerGrid.materialDepthTest).toBe(true);
  expect(derivedSummary.containerGrid.renderOrder).toBeLessThan(derivedSummary.containerWire.renderOrder);
  expect(derivedSummary.visibleSurfaces
    .filter((surface) => surface.materialDepthWrite === false)
    .every((surface) => surface.renderOrder === SPH_PHASE_RENDER_ORDER.transmissiveSurface
      || surface.renderOrder === SPH_PHASE_RENDER_ORDER.vaporSurface
      || surface.renderOrder === SPH_PHASE_RENDER_ORDER.alphaSurface)).toBe(true);
  expect(derivedSummary.visibleSurfaces
    .filter((surface) => surface.materialDepthWrite === false)
    .every((surface) => surface.renderOrderPolicy === 'three-transparent-depth-sort-within-layer')).toBe(true);
  expect(derivedSummary.visibleSurfaces.every((surface) => Number.isFinite(surface.renderOrder))).toBe(true);
  expect(derivedSummary.visibleSurfaces.every((surface) => typeof surface.renderLayer === 'string')).toBe(true);
  expect(derivedSummary.opticalGpuTable.schema).toBe('peercompute.ulg.optical-gpu-table.v0');
  expect(derivedSummary.opticalGpuTable.recordCount).toBeGreaterThan(0);
  expect(derivedSummary.opticalGpuTable.spectralSampleCount).toBeGreaterThan(0);
  expect(derivedSummary.sphThermalMaterialTable.schema).toBe('peercompute.ulg.sph-gpu-thermal-material-table.v0');
  expect(derivedSummary.sphThermalMaterialTable.materialCount).toBeGreaterThan(0);
  expect(derivedSummary.sphThermalMaterialTable.segmentCount).toBeGreaterThan(0);
  expect(derivedSummary.sphThermalClosureGraphBuffers.schema).toBe('peercompute.ulg.sph-gpu-thermal-closure-graph-set.v0');
  expect(derivedSummary.sphThermalClosureGraphBuffers.graphSchema).toBe('peercompute.ulg.closure-law-graph.v0');
  expect(derivedSummary.sphThermalClosureGraphBuffers.graphBankSchema).toBe('peercompute.ulg.sph-gpu-thermal-closure-graph-bank.v0');
  expect(derivedSummary.sphThermalClosureGraphBuffers.graphCount).toBe(derivedSummary.sphThermalMaterialTable.segmentCount);
  expect(derivedSummary.sphThermalClosureGraphBuffers.skippedSegmentCount).toBe(0);
  expect(derivedSummary.sphThermalPhaseResponseTable.schema).toBe('peercompute.ulg.sph-gpu-thermal-phase-response-table.v0');
  expect(derivedSummary.sphThermalPhaseResponseTable.graphBankSchema).toBe('peercompute.ulg.sph-gpu-thermal-closure-graph-bank.v0');
  expect(derivedSummary.sphThermalPhaseResponseTable.responseCount).toBe(derivedSummary.sphThermalMaterialTable.segmentCount);
  expect(derivedSummary.sphThermalResponseGraphUpload.schema).toBe('peercompute.ulg.sph-gpu-thermal-response-graph-buffer-set.v0');
  expect([
    'blocked-webgpu-unavailable',
    'not-requested',
    'webgpu-device-lost-fallback',
    'webgpu-error-fallback',
    'webgpu-uploaded'
  ]).toContain(derivedSummary.sphThermalResponseGraphUpload.status);
  expect(derivedSummary.sphThermalResponseGraphUpload.responseCount).toBe(derivedSummary.sphThermalPhaseResponseTable.responseCount);
  expect(derivedSummary.sphThermalResponseGraphUpload.graphCount).toBe(derivedSummary.sphThermalClosureGraphBuffers.graphCount);
  expect(derivedSummary.mlsMpmMechanicsMaterialPhaseUpload.schema).toBe('peercompute.ulg.mls-mpm-mechanics-material-phase-upload.v0');
  expect([
    'blocked-webgpu-unavailable',
    'not-requested',
    'webgpu-device-lost-fallback',
    'webgpu-error-fallback',
    'webgpu-uploaded'
  ]).toContain(derivedSummary.mlsMpmMechanicsMaterialPhaseUpload.status);
  expect(derivedSummary.mlsMpmMechanicsMaterialPhaseUpload.phaseRecordCount).toBeGreaterThan(0);
  expect(derivedSummary.opticalGpuLookup.schema).toBe('peercompute.ulg.optical-gpu-lookup.v0');
  if (usesThreeRenderRowBridge) {
    expect(derivedSummary.opticalGpuLookup.queryCount).toBeGreaterThanOrEqual(0);
    expect(derivedSummary.opticalGpuLookup.queryCount).toBeLessThanOrEqual(
      derivedSummary.opticalGpuTable.recordCount
    );
  } else {
    expect(derivedSummary.opticalGpuLookup.queryCount).toBe(derivedSummary.opticalGpuTable.recordCount);
  }
  expect(derivedSummary.opticalGpuLookup.outputStrideFloats).toBe(16);
  expect(derivedSummary.opticalGpuLookup.outputCount).toBe(
    derivedSummary.opticalGpuLookup.queryCount * derivedSummary.opticalGpuLookup.outputStrideFloats
  );
  expect(derivedSummary.opticalGpuLookup.executionSchema).toBe('peercompute.ulg.optical-gpu-lookup-execution.v0');
  expect(['cpu-reference', 'webgpu']).toContain(derivedSummary.opticalGpuLookup.executionBackend);
  expect([
    'blocked-webgpu-unavailable',
    'not-requested',
    'webgpu-device-lost-fallback',
    'webgpu-error-fallback',
    'webgpu-executed',
    'webgpu-parity-failed'
  ]).toContain(derivedSummary.opticalGpuLookup.executionStatus);
  if (derivedSummary.opticalGpuLookup.executionBackend === 'webgpu') {
    expect(derivedSummary.opticalGpuLookup.executionStatus).toBe('webgpu-executed');
    expect(derivedSummary.opticalGpuLookup.paritySchema).toBe('peercompute.ulg.optical-gpu-lookup-parity.v0');
    expect(derivedSummary.opticalGpuLookup.parityStatus).toBe('pass');
    expect(derivedSummary.opticalGpuLookup.parityMaxOutputAbs).toBeLessThanOrEqual(derivedSummary.opticalGpuLookup.parityTolerance);
  }
  expect(derivedSummary.opticalGpuDrawState.schema).toBe('peercompute.ulg.optical-gpu-draw-state.v0');
  expect(derivedSummary.opticalGpuDrawState.sourceExecutionSchema).toBe('peercompute.ulg.optical-gpu-lookup-execution.v0');
  expect(derivedSummary.opticalGpuDrawState.backend).toBe(derivedSummary.opticalGpuLookup.executionBackend);
  if (usesThreeRenderRowBridge && derivedSummary.opticalGpuLookup.queryCount === 0) {
    expect(derivedSummary.opticalGpuDrawState.appliedCount).toBe(0);
  } else {
    expect(derivedSummary.opticalGpuDrawState.appliedCount).toBeGreaterThan(0);
  }
  expect(derivedSummary.sphGpuParticleState.schema).toBe('peercompute.ulg.sph-gpu-particle-buffer.v0');
  expect(derivedSummary.sphGpuParticleState.particleCount).toBeGreaterThan(0);
  expect(derivedSummary.sphGpuParticleState.stateStrideFloats).toBe(8);
  expect(derivedSummary.sphGpuParticleState.thermoStrideFloats).toBe(12);
  expect(derivedSummary.sphGpuParticleState.phaseSolidId).toBe(1);
  expect(derivedSummary.sphGpuParticleUpload.schema).toBe('peercompute.ulg.sph-gpu-particle-buffer-set.v0');
  expect(derivedSummary.sphGpuParticleUpload.sourceSchema).toBe('peercompute.ulg.sph-gpu-particle-buffer.v0');
  expect(derivedSummary.sphGpuParticleUpload.particleCount).toBe(derivedSummary.sphGpuParticleState.particleCount);
  expect(['webgpu-uploaded', 'blocked-webgpu-unavailable', 'webgpu-error-fallback']).toContain(
    derivedSummary.sphGpuParticleUpload.status
  );
  expect(derivedSummary.mlsMpmGpuParticleState.schema).toBe('peercompute.ulg.mls-mpm-gpu-particle-buffer.v0');
  expect(derivedSummary.mlsMpmGpuParticleState.particleCount).toBe(derivedSummary.sphGpuParticleState.particleCount);
  expect(derivedSummary.mlsMpmGpuParticleState.mechanicsStrideFloats).toBe(32);
  expect(derivedSummary.mlsMpmGpuParticleState.firstSolidFlag).toBe(1);
  expect(derivedSummary.mlsMpmGpuParticleState.firstStatus).toBe(1);
  expect(derivedSummary.mlsMpmGpuParticleUpload.schema).toBe('peercompute.ulg.mls-mpm-gpu-particle-buffer-set.v0');
  expect(derivedSummary.mlsMpmGpuParticleUpload.sourceSchema).toBe('peercompute.ulg.mls-mpm-gpu-particle-buffer.v0');
  expect(derivedSummary.mlsMpmGpuParticleUpload.particleCount).toBe(derivedSummary.mlsMpmGpuParticleState.particleCount);
  expect(['webgpu-uploaded', 'blocked-webgpu-unavailable', 'webgpu-error-fallback']).toContain(
    derivedSummary.mlsMpmGpuParticleUpload.status
  );
  expect(derivedSummary.mlsMpmMechanicsPrediction.schema).toBe('peercompute.ulg.mls-mpm-gpu-mechanics-execution.v0');
  expect(derivedSummary.mlsMpmMechanicsPrediction.predictionSchema).toBe('peercompute.ulg.mls-mpm-gpu-mechanics-prediction.v0');
  expect(derivedSummary.mlsMpmMechanicsPrediction.particleCount).toBe(derivedSummary.sphGpuParticleState.particleCount);
  expect(derivedSummary.mlsMpmMechanicsPrediction.stateStrideFloats).toBe(8);
  expect(derivedSummary.mlsMpmMechanicsPrediction.mechanicsStrideFloats).toBe(32);
  expect(derivedSummary.mlsMpmMechanicsPrediction.backend).toBe('disabled');
  expect(derivedSummary.mlsMpmMechanicsPrediction.status).toBe('standalone-mechanics-prediction-disabled');
  expect(derivedSummary.mlsMpmMechanicsPrediction.defaultEnabled).toBe(false);
  expect(derivedSummary.mlsMpmMechanicsPrediction.normalHotLoopReadbackFree).toBe(true);
  expect(derivedSummary.mlsMpmMechanicsPrediction.p2gValidation).toBe(false);
  expect(derivedSummary.mlsMpmMechanicsPrediction.gridValidation).toBe(false);
  expect(derivedSummary.mlsMpmMechanicsPrediction.g2pValidation).toBe(false);
  expect(derivedSummary.mlsMpmMechanicsPrediction.sphValidation).toBe(false);
  expect(derivedSummary.mlsMpmMechanicsPrediction.phaseChangeValidation).toBe(false);
  expect(derivedSummary.mlsMpmMechanicsPrediction.fullPhysicsValidation).toBe(false);
  expect(derivedSummary.mlsMpmP2gGridProjection.schema).toBe('peercompute.ulg.mls-mpm-gpu-grid-projection-execution.v0');
  expect(derivedSummary.mlsMpmP2gGridProjection.projectionSchema).toBe('peercompute.ulg.mls-mpm-gpu-grid-projection.v0');
  expect(derivedSummary.mlsMpmP2gGridProjection.particleCount).toBe(derivedSummary.sphGpuParticleState.particleCount);
  expect(derivedSummary.mlsMpmP2gGridProjection.gridNodeCount).toBeGreaterThan(0);
  expect(derivedSummary.mlsMpmP2gGridProjection.gridNodeStrideFloats).toBe(8);
  expect(['cpu-reference', 'webgpu']).toContain(derivedSummary.mlsMpmP2gGridProjection.backend);
  expect([
    'blocked-webgpu-unavailable',
    'not-requested',
    'webgpu-device-lost-fallback',
    'webgpu-error-fallback',
    'webgpu-executed',
    'webgpu-executed-no-full-readback',
    'webgpu-parity-failed'
  ]).toContain(derivedSummary.mlsMpmP2gGridProjection.webgpuStatus);
  if (derivedSummary.mlsMpmP2gGridProjection.backend === 'webgpu') {
    expect([
      'webgpu-executed',
      'webgpu-executed-no-full-readback'
    ]).toContain(derivedSummary.mlsMpmP2gGridProjection.webgpuStatus);
    if (derivedSummary.mlsMpmP2gGridProjection.readbackMode === 'no-full-readback') {
      expect(derivedSummary.mlsMpmP2gGridProjection.webgpuStatus).toBe('webgpu-executed-no-full-readback');
      expect([undefined, 'not-run-no-full-readback']).toContain(
        derivedSummary.mlsMpmP2gGridProjection.parityStatus
      );
      expect(derivedSummary.mlsMpmP2gGridProjection.parityMaxGridAbs).toBe(null);
      expect(derivedSummary.mlsMpmP2gGridProjection.normalHotLoopReadbackFree).toBe(true);
    } else {
      expect(derivedSummary.mlsMpmP2gGridProjection.paritySchema).toBe('peercompute.ulg.mls-mpm-gpu-grid-projection-parity.v0');
      expect(derivedSummary.mlsMpmP2gGridProjection.webgpuStatus).toBe('webgpu-executed');
      expect(derivedSummary.mlsMpmP2gGridProjection.parityStatus).toBe('pass');
      expect(derivedSummary.mlsMpmP2gGridProjection.parityMaxGridAbs).toBeLessThanOrEqual(
        derivedSummary.mlsMpmP2gGridProjection.parityTolerance
      );
      expect(derivedSummary.mlsMpmP2gGridProjection.normalHotLoopReadbackFree).toBe(false);
    }
  }
  expect(derivedSummary.mlsMpmP2gGridProjection.p2gProjectionValidation).toBe(false);
  expect(derivedSummary.mlsMpmP2gGridProjection.stressProjectionValidation).toBe(false);
  expect(derivedSummary.mlsMpmP2gGridProjection.gridValidation).toBe(false);
  expect(derivedSummary.mlsMpmP2gGridProjection.g2pValidation).toBe(false);
  expect(derivedSummary.mlsMpmP2gGridProjection.sphValidation).toBe(false);
  expect(derivedSummary.mlsMpmP2gGridProjection.phaseChangeValidation).toBe(false);
  expect(derivedSummary.mlsMpmP2gGridProjection.fullPhysicsValidation).toBe(false);
  expect(derivedSummary.mlsMpmGridUpdate.schema).toBe('peercompute.ulg.mls-mpm-gpu-grid-update-execution.v0');
  expect(derivedSummary.mlsMpmGridUpdate.updateSchema).toBe('peercompute.ulg.mls-mpm-gpu-grid-update.v0');
  expect(derivedSummary.mlsMpmGridUpdate.particleCount).toBe(derivedSummary.sphGpuParticleState.particleCount);
  expect(derivedSummary.mlsMpmGridUpdate.gridNodeCount).toBe(derivedSummary.mlsMpmP2gGridProjection.gridNodeCount);
  expect(derivedSummary.mlsMpmGridUpdate.gridNodeStrideFloats).toBe(8);
  expect(derivedSummary.mlsMpmGridUpdate.dt).toBeGreaterThan(0);
  expect(derivedSummary.mlsMpmGridUpdate.cflFactor).toBeGreaterThan(0);
  expect(['cpu-reference', 'webgpu']).toContain(derivedSummary.mlsMpmGridUpdate.backend);
  expect([
    'blocked-webgpu-unavailable',
    'not-requested',
    'webgpu-device-lost-fallback',
    'webgpu-error-fallback',
    'webgpu-executed',
    'webgpu-executed-no-full-readback',
    'webgpu-parity-failed'
  ]).toContain(derivedSummary.mlsMpmGridUpdate.webgpuStatus);
  if (derivedSummary.mlsMpmGridUpdate.backend === 'webgpu') {
    expect([
      'webgpu-executed',
      'webgpu-executed-no-full-readback'
    ]).toContain(derivedSummary.mlsMpmGridUpdate.webgpuStatus);
    if (derivedSummary.mlsMpmGridUpdate.readbackMode === 'no-full-readback') {
      expect(derivedSummary.mlsMpmGridUpdate.webgpuStatus).toBe('webgpu-executed-no-full-readback');
      expect([undefined, 'not-run-no-full-readback']).toContain(
        derivedSummary.mlsMpmGridUpdate.parityStatus
      );
      expect(derivedSummary.mlsMpmGridUpdate.parityMaxGridAbs).toBe(null);
      expect(derivedSummary.mlsMpmGridUpdate.normalHotLoopReadbackFree).toBe(true);
    } else {
      expect(derivedSummary.mlsMpmGridUpdate.paritySchema).toBe('peercompute.ulg.mls-mpm-gpu-grid-update-parity.v0');
      expect(derivedSummary.mlsMpmGridUpdate.webgpuStatus).toBe('webgpu-executed');
      expect(derivedSummary.mlsMpmGridUpdate.parityStatus).toBe('pass');
      expect(derivedSummary.mlsMpmGridUpdate.parityMaxGridAbs).toBeLessThanOrEqual(
        derivedSummary.mlsMpmGridUpdate.parityTolerance
      );
      expect(derivedSummary.mlsMpmGridUpdate.normalHotLoopReadbackFree).toBe(false);
    }
  }
  expect(derivedSummary.mlsMpmGridUpdate.p2gProjectionValidation).toBe(false);
  expect(derivedSummary.mlsMpmGridUpdate.stressProjectionValidation).toBe(false);
  expect(derivedSummary.mlsMpmGridUpdate.gridUpdateValidation).toBe(false);
  expect(derivedSummary.mlsMpmGridUpdate.gridValidation).toBe(false);
  expect(derivedSummary.mlsMpmGridUpdate.g2pValidation).toBe(false);
  expect(derivedSummary.mlsMpmGridUpdate.sphValidation).toBe(false);
  expect(derivedSummary.mlsMpmGridUpdate.phaseChangeValidation).toBe(false);
  expect(derivedSummary.mlsMpmGridUpdate.fullPhysicsValidation).toBe(false);
  expect(derivedSummary.mlsMpmG2pReconstruction.schema).toBe('peercompute.ulg.mls-mpm-gpu-g2p-reconstruction-execution.v0');
  expect(derivedSummary.mlsMpmG2pReconstruction.reconstructionSchema).toBe('peercompute.ulg.mls-mpm-gpu-g2p-reconstruction.v0');
  expect(derivedSummary.mlsMpmG2pReconstruction.particleCount).toBe(derivedSummary.sphGpuParticleState.particleCount);
  expect(derivedSummary.mlsMpmG2pReconstruction.gridNodeCount).toBe(derivedSummary.mlsMpmGridUpdate.gridNodeCount);
  expect(derivedSummary.mlsMpmG2pReconstruction.stateStrideFloats).toBe(8);
  expect(derivedSummary.mlsMpmG2pReconstruction.mechanicsStrideFloats).toBe(32);
  expect(derivedSummary.mlsMpmG2pReconstruction.dt).toBeGreaterThan(0);
  expect(['cpu-reference', 'webgpu']).toContain(derivedSummary.mlsMpmG2pReconstruction.backend);
  expect([
    'blocked-webgpu-unavailable',
    'not-requested',
    'webgpu-device-lost-fallback',
    'webgpu-error-fallback',
    'webgpu-executed',
    'webgpu-executed-no-full-readback',
    'webgpu-parity-failed'
  ]).toContain(derivedSummary.mlsMpmG2pReconstruction.webgpuStatus);
  if (derivedSummary.mlsMpmG2pReconstruction.backend === 'webgpu') {
    expect([
      'webgpu-executed',
      'webgpu-executed-no-full-readback'
    ]).toContain(derivedSummary.mlsMpmG2pReconstruction.webgpuStatus);
    if (derivedSummary.mlsMpmG2pReconstruction.readbackMode === 'no-full-readback') {
      expect(derivedSummary.mlsMpmG2pReconstruction.webgpuStatus).toBe('webgpu-executed-no-full-readback');
      expect([undefined, 'not-run-no-full-readback']).toContain(
        derivedSummary.mlsMpmG2pReconstruction.parityStatus
      );
      expect(derivedSummary.mlsMpmG2pReconstruction.parityMaxStateAbs).toBe(null);
      expect(derivedSummary.mlsMpmG2pReconstruction.parityMaxMechanicsAbs).toBe(null);
      expect(derivedSummary.mlsMpmG2pReconstruction.normalHotLoopReadbackFree).toBe(true);
    } else {
      expect(derivedSummary.mlsMpmG2pReconstruction.paritySchema).toBe('peercompute.ulg.mls-mpm-gpu-g2p-reconstruction-parity.v0');
      expect(derivedSummary.mlsMpmG2pReconstruction.webgpuStatus).toBe('webgpu-executed');
      expect(derivedSummary.mlsMpmG2pReconstruction.parityStatus).toBe('pass');
      expect(derivedSummary.mlsMpmG2pReconstruction.parityMaxStateAbs).toBeLessThanOrEqual(
        derivedSummary.mlsMpmG2pReconstruction.parityTolerance
      );
      expect(derivedSummary.mlsMpmG2pReconstruction.parityMaxMechanicsAbs).toBeLessThanOrEqual(
        derivedSummary.mlsMpmG2pReconstruction.parityTolerance
      );
      expect(derivedSummary.mlsMpmG2pReconstruction.normalHotLoopReadbackFree).toBe(false);
    }
  }
  expect(derivedSummary.mlsMpmG2pReconstruction.p2gProjectionValidation).toBe(false);
  expect(derivedSummary.mlsMpmG2pReconstruction.stressProjectionValidation).toBe(false);
  expect(derivedSummary.mlsMpmG2pReconstruction.gridUpdateValidation).toBe(false);
  expect(derivedSummary.mlsMpmG2pReconstruction.g2pValidation).toBe(false);
  expect(derivedSummary.mlsMpmG2pReconstruction.gridValidation).toBe(false);
  expect(derivedSummary.mlsMpmG2pReconstruction.sphValidation).toBe(false);
  expect(derivedSummary.mlsMpmG2pReconstruction.phaseChangeValidation).toBe(false);
  expect(derivedSummary.mlsMpmG2pReconstruction.fullPhysicsValidation).toBe(false);
  const residentTargetStepCount = Math.max(
    1,
    Math.round(Number(derivedSummary.mlsMpmGpuParticleState.mechanicalSubsteps) || 2)
  );
  const expectedResidentStepCount = Math.max(
    1,
    Math.round(Number(derivedSummary.mlsMpmResidentSteps.stepCount) || residentTargetStepCount)
  );
  expect(Number.isFinite(derivedSummary.mlsMpmGpuParticleState.mechanicsDtS)).toBe(true);
  expect(residentTargetStepCount).toBeGreaterThanOrEqual(1);
  expect(expectedResidentStepCount).toBeGreaterThanOrEqual(1);
  if (usesThreeRenderRowBridge) {
    expect(expectedResidentStepCount).toBeGreaterThanOrEqual(residentTargetStepCount);
  } else {
    expect(expectedResidentStepCount).toBe(residentTargetStepCount);
  }
  expect(derivedSummary.mlsMpmResidentSteps.schema).toBe('peercompute.ulg.mls-mpm-gpu-resident-steps-execution.v0');
  expect(['cpu-reference', 'webgpu', 'mixed-fallback']).toContain(derivedSummary.mlsMpmResidentSteps.backend);
  expect(derivedSummary.mlsMpmResidentSteps.status).toBe('resident-steps-executed');
  expect(derivedSummary.mlsMpmResidentSteps.stepCount).toBe(expectedResidentStepCount);
  expect(derivedSummary.mlsMpmResidentSteps.completedStepCount).toBe(expectedResidentStepCount);
  expect(derivedSummary.mlsMpmResidentSteps.retainIntermediateSteps).toBe(false);
  expect(derivedSummary.mlsMpmResidentSteps.retainedIntermediateStepCount).toBe(0);
  expect(derivedSummary.mlsMpmResidentSteps.finalStepSchema).toBe('peercompute.ulg.mls-mpm-gpu-resident-step-execution.v0');
  expect([
    'resident-step-cpu-or-fallback',
    'resident-step-webgpu-executed'
  ]).toContain(derivedSummary.mlsMpmResidentSteps.finalStepStatus);
  expect(derivedSummary.mlsMpmResidentSteps.stepSummaries).toHaveLength(expectedResidentStepCount);
  expect(derivedSummary.mlsMpmResidentSteps.stepSummaries.every((summary) => (
    summary.stageTiming?.schema === 'peercompute.ulg.mls-mpm-resident-stage-timing.v0'
  ))).toBe(true);
  const firstResidentPingPong = derivedSummary.mlsMpmResidentSteps.stepSummaries[0].particlePingPong;
  expect([0, 1]).toContain(firstResidentPingPong.sourceSlot);
  expect([0, 1]).toContain(firstResidentPingPong.nextSlot);
  expect(firstResidentPingPong.nextSlot).toBe(1 - firstResidentPingPong.sourceSlot);
  if (expectedResidentStepCount > 1) {
    const secondResidentPingPong = derivedSummary.mlsMpmResidentSteps.stepSummaries[1].particlePingPong;
    expect(secondResidentPingPong.sourceSlot).toBe(firstResidentPingPong.nextSlot);
    expect(secondResidentPingPong.nextSlot).toBe(firstResidentPingPong.sourceSlot);
  }
  expect(derivedSummary.mlsMpmResidentSteps.requestedReadbackMode).toBe('no-full-readback');
  expect(derivedSummary.mlsMpmResidentSteps.gpuAuthoritativeState).toBe(false);
  expect(derivedSummary.mlsMpmResidentSteps.scientificValidation).toBe(false);
  expect(derivedSummary.mlsMpmResidentSteps.sphValidation).toBe(false);
  expect(derivedSummary.mlsMpmResidentSteps.phaseChangeValidation).toBe(false);
  expect(derivedSummary.mlsMpmResidentSteps.fullPhysicsValidation).toBe(false);
  expect(derivedSummary.mlsMpmResidentStep.schema).toBe('peercompute.ulg.mls-mpm-gpu-resident-step-execution.v0');
  expect(derivedSummary.mlsMpmResidentStep.stepSchema).toBe('peercompute.ulg.mls-mpm-gpu-resident-step.v0');
  expect(['cpu-reference', 'webgpu', 'mixed-fallback']).toContain(derivedSummary.mlsMpmResidentStep.backend);
  expect([
    'resident-step-cpu-or-fallback',
    'resident-step-webgpu-executed'
  ]).toContain(derivedSummary.mlsMpmResidentStep.status);
  expect(derivedSummary.mlsMpmResidentStep.particleCount).toBe(derivedSummary.sphGpuParticleState.particleCount);
  expect(derivedSummary.mlsMpmResidentStep.gridNodeCount).toBe(derivedSummary.mlsMpmGridUpdate.gridNodeCount);
  expect(derivedSummary.mlsMpmResidentStep.stateStrideFloats).toBe(8);
  expect(derivedSummary.mlsMpmResidentStep.mechanicsStrideFloats).toBe(32);
  expect(derivedSummary.mlsMpmResidentStep.stageTiming.schema).toBe('peercompute.ulg.mls-mpm-resident-stage-timing.v0');
  expect(Number.isFinite(derivedSummary.mlsMpmResidentStep.stageTiming.totalMs)).toBe(true);
  expect(Number.isFinite(derivedSummary.mlsMpmResidentStep.stageTiming.stageMs.deviceAcquire)).toBe(true);
  expect(Number.isFinite(derivedSummary.mlsMpmResidentStep.stageTiming.stageMs.p2gGridProjection)).toBe(true);
  expect(Number.isFinite(derivedSummary.mlsMpmResidentStep.stageTiming.stageMs.gridUpdate)).toBe(true);
  expect(Number.isFinite(derivedSummary.mlsMpmResidentStep.stageTiming.stageMs.g2pReconstruction)).toBe(true);
  expect(derivedSummary.mlsMpmResidentStep.diagnostics.particleCount).toBe(derivedSummary.sphGpuParticleState.particleCount);
  expect(derivedSummary.mlsMpmResidentStep.diagnostics.gridNodeCount).toBe(derivedSummary.mlsMpmGridUpdate.gridNodeCount);
  expect(derivedSummary.mlsMpmResidentStep.requestedReadbackMode).toBe('no-full-readback');
  expect(derivedSummary.mlsMpmResidentStep.gpuAuthoritativeState).toBe(false);
  if (derivedSummary.mlsMpmResidentStep.backend === 'webgpu') {
    expect(derivedSummary.statusText).toContain('resident readback: requested=no-full-readback actual=no-full-readback');
    expect(derivedSummary.statusText).toContain('render source    : resident-gpu-render-field');
    expect(derivedSummary.statusText).toContain(`field-readback=${usesThreeRenderRowBridge ? 'false' : 'true'}`);
    if (usesThreeRenderRowBridge) {
      expect(SPH_THREE_RENDER_ROW_SURFACE_STATUSES).toContain(
        derivedSummary.sphResidentRenderState.surfaceDrawStatus
      );
      expect(derivedSummary.statusText).toContain(
        `surface draw     : status=${derivedSummary.sphResidentRenderState.surfaceDrawStatus}`
      );
      expect(derivedSummary.statusText).toContain(
        `bridge=${derivedSummary.sphResidentRenderState.surfaceDrawVisibleRendererBridge}`
      );
    } else {
      expect(derivedSummary.statusText).toContain('surface draw     : status=resident-surface-draw-unavailable');
      expect(derivedSummary.statusText).toContain('bridge=three-marching-cubes');
    }
    expect(derivedSummary.statusText).toContain('render cadence   :');
    expect(derivedSummary.statusText).toContain('resident profile :');
    expect(derivedSummary.statusText).toContain(`substeps=${expectedResidentStepCount}`);
    expect(derivedSummary.statusText).toContain(`target=${residentTargetStepCount}`);
    expect(derivedSummary.mlsMpmResidentSteps.readbackMode).toBe('no-full-readback');
    expect([
      'retained-thermal-output-and-refreshed-mechanics-buffers',
      'retained-thermal-output-and-g2p-mechanics-buffers',
      'retained-reaction-output-buffers'
    ]).toContain(derivedSummary.mlsMpmResidentSteps.nextParticleBufferMode);
    expect(derivedSummary.mlsMpmResidentSteps.normalHotLoopReadbackFree).toBe(true);
    expect(derivedSummary.mlsMpmResidentSteps.renderStateReadbackAvailable).toBe(false);
    expect(derivedSummary.mlsMpmResidentSteps.stepSummaries.every((summary) => (
      summary.requestedReadbackMode === 'no-full-readback'
      && summary.readbackMode === 'no-full-readback'
      && summary.normalHotLoopReadbackFree === true
      && summary.renderStateReadbackAvailable === false
    ))).toBe(true);
    expect(derivedSummary.mlsMpmResidentStep.readbackMode).toBe('no-full-readback');
    expect(derivedSummary.mlsMpmResidentStep.normalHotLoopReadbackFree).toBe(true);
    expect(derivedSummary.mlsMpmResidentStep.renderStateReadbackAvailable).toBe(false);
    expect(derivedSummary.mlsMpmResidentStep.diagnostics.readbackMode).toBe('no-full-readback');
    if (derivedSummary.mlsMpmResidentStep.diagnostics.compactGpuSummaryAvailable) {
      expect(derivedSummary.mlsMpmResidentStep.diagnostics.compactGpuSummaryStatus).toBe('compact-summary-ready');
      expect(derivedSummary.mlsMpmResidentStep.diagnostics.compactGpuSummaryReadbackMode).toBe('compact-summary-readback');
      expect(derivedSummary.mlsMpmResidentStep.diagnostics.compactReadbackByteLength).toBe(MLS_MPM_RESIDENT_COMPACT_SUMMARY_BYTES);
      expect(derivedSummary.mlsMpmResidentStep.diagnostics.compactSummaryReductionStrategy).toBe(
        'two-pass-workgroup-reduction'
      );
    } else {
      expect(['not-run', 'compact-summary-unavailable']).toContain(
        derivedSummary.mlsMpmResidentStep.diagnostics.compactGpuSummaryStatus
      );
      expect(derivedSummary.mlsMpmResidentStep.diagnostics.compactGpuSummaryReadbackMode ?? null).toBe(null);
      expect(derivedSummary.mlsMpmResidentStep.diagnostics.compactReadbackByteLength ?? 0).toBe(0);
      expect(derivedSummary.mlsMpmResidentStep.diagnostics.compactSummaryReductionStrategy ?? null).toBe(null);
    }
    if (Array.isArray(derivedSummary.mlsMpmResidentStep.diagnostics.sourceCenterOfMassM)) {
      expect(derivedSummary.mlsMpmResidentStep.diagnostics.sourceCenterOfMassM.length).toBe(3);
      expect(derivedSummary.mlsMpmResidentStep.diagnostics.nextCenterOfMassM.length).toBe(3);
      expect(derivedSummary.mlsMpmResidentStep.diagnostics.centerOfMassDeltaM.length).toBe(3);
      expect(derivedSummary.mlsMpmResidentStep.diagnostics.nextPositionBoundsM.status).toBe('position-bounds-ready');
    } else {
      expect(derivedSummary.mlsMpmResidentStep.diagnostics.sourceCenterOfMassM).toBeNull();
      expect(derivedSummary.mlsMpmResidentStep.diagnostics.nextCenterOfMassM).toBeNull();
      expect(derivedSummary.mlsMpmResidentStep.diagnostics.centerOfMassDeltaM).toBeNull();
      expect(derivedSummary.mlsMpmResidentStep.diagnostics.nextPositionBoundsM).toBeNull();
    }
    if (derivedSummary.mlsMpmResidentStep.diagnostics.activeGridNodeCountAvailable !== true) {
      expect(derivedSummary.mlsMpmResidentStep.diagnostics.activeGridNodeCount).toBeNull();
      expect([null, 'active-grid-node-summary-not-requested']).toContain(
        derivedSummary.mlsMpmResidentStep.diagnostics.activeGridNodeSummaryStatus
      );
      expect([null, false, true]).toContain(derivedSummary.mlsMpmResidentStep.diagnostics.gridNodeScanSkipped);
    } else {
      expect(derivedSummary.mlsMpmResidentStep.diagnostics.activeGridNodeCount).toBeGreaterThan(0);
      expect(derivedSummary.mlsMpmResidentStep.diagnostics.activeGridNodeSummaryStatus).toBe(
        'active-grid-node-summary-ready'
      );
    }
    expect(Math.abs(derivedSummary.mlsMpmResidentStep.diagnostics.massDeltaKg)).toBeLessThan(1e-3);
    if (Number.isFinite(derivedSummary.mlsMpmResidentStep.diagnostics.maxSpeedMPerS)) {
      expect(derivedSummary.mlsMpmResidentStep.diagnostics.maxSpeedMPerS).toBeGreaterThanOrEqual(0);
    } else {
      expect(usesThreeRenderRowBridge).toBe(true);
      expect(derivedSummary.sphResidentRenderState.renderRowsDecodedPositionCount).toBeGreaterThan(0);
      expect(derivedSummary.sphResidentRenderState.renderRowsDecodedTotalMassKg).toBeGreaterThan(0);
      expect(derivedSummary.sphResidentRenderState.renderRowsDecodedCenterOfMassM).toHaveLength(3);
      expect(derivedSummary.sphResidentRenderState.renderRowsDecodedPositionBoundsM?.status).toBe('position-bounds-ready');
    }
    if (derivedSummary.mlsMpmResidentStep.diagnostics.thermalPhaseSummaryAvailable) {
      expect(derivedSummary.mlsMpmResidentStep.diagnostics.thermalSummaryStatus).toBe('thermal-phase-summary-ready');
      expect(Number.isFinite(derivedSummary.mlsMpmResidentStep.diagnostics.temperatureMassWeightedMeanK)).toBe(true);
      expect(derivedSummary.mlsMpmResidentStep.diagnostics.minTemperatureK).toBeGreaterThan(0);
      expect(derivedSummary.mlsMpmResidentStep.diagnostics.maxTemperatureK).toBeGreaterThanOrEqual(
        derivedSummary.mlsMpmResidentStep.diagnostics.minTemperatureK
      );
      expect(derivedSummary.mlsMpmResidentStep.diagnostics.phaseMassTotalKg).toBeGreaterThan(0);
    } else {
      expect(derivedSummary.mlsMpmResidentStep.diagnostics.thermalSummaryStatus ?? null).toBe(null);
      expect(derivedSummary.mlsMpmResidentStep.diagnostics.temperatureMassWeightedMeanK ?? null).toBe(null);
      expect(derivedSummary.mlsMpmResidentStep.diagnostics.phaseMassTotalKg ?? null).toBe(null);
    }
    expect(derivedSummary.mlsMpmResidentStep.stageStatus.p2g).toBe('webgpu-executed-no-full-readback');
    expect(derivedSummary.mlsMpmResidentStep.stageStatus.gridUpdate).toBe('webgpu-executed-no-full-readback');
    expect(derivedSummary.mlsMpmResidentStep.stageStatus.g2p).toBe('webgpu-executed-no-full-readback');
    expect(derivedSummary.mlsMpmResidentStep.stageStatus.thermal).toBe('thermal-step-executed');
    expect(derivedSummary.mlsMpmResidentStep.stageBackends.thermal).toBe('webgpu');
    expect(derivedSummary.sphThermalResponseGraphUpload.status).toBe('webgpu-uploaded');
    expect(derivedSummary.sphThermalResponseGraphUpload.responseBufferByteLength).toBeGreaterThan(0);
    expect(derivedSummary.sphThermalResponseGraphUpload.graphSampleBufferByteLength).toBeGreaterThan(0);
    expect(derivedSummary.mlsMpmMechanicsMaterialPhaseUpload.status).toBe('webgpu-uploaded');
    expect(derivedSummary.mlsMpmMechanicsMaterialPhaseUpload.recordsByteLength).toBeGreaterThan(0);
    expect(derivedSummary.mlsMpmResidentStep.residentBuffersRetained).toBe(true);
    expect(derivedSummary.mlsMpmResidentStep.stageBuffersRetained).toBe(true);
    expect(derivedSummary.mlsMpmResidentStep.g2pOutputBuffersRetained).toBe(true);
    expect(derivedSummary.mlsMpmResidentStep.residentBufferMode).toBe('retained-stage-and-output-buffers');
    expect([
      'retained-thermal-output-and-refreshed-mechanics-buffers',
      'retained-thermal-output-and-g2p-mechanics-buffers',
      'retained-reaction-output-buffers'
    ]).toContain(derivedSummary.mlsMpmResidentStep.nextParticleBufferMode);
    expect(derivedSummary.mlsMpmResidentStep.nextParticleStateBufferByteLength).toBeGreaterThan(0);
    expect(derivedSummary.mlsMpmResidentStep.nextParticleThermoBufferByteLength).toBeGreaterThan(0);
    expect(derivedSummary.mlsMpmResidentStep.nextParticleMechanicsBufferByteLength).toBeGreaterThan(0);
    expect(derivedSummary.mlsMpmResidentStep.particlePingPong.sourceSlot).toBe(1);
    expect(derivedSummary.mlsMpmResidentStep.particlePingPong.nextSlot).toBe(0);
    expect(derivedSummary.mlsMpmResidentStep.particlePingPong.nextStep).toBe(
      derivedSummary.mlsMpmResidentStep.particlePingPong.step + 1
    );
    expect(derivedSummary.mlsMpmResidentStep.particlePingPong.nextTime).toBeGreaterThan(
      derivedSummary.mlsMpmResidentStep.particlePingPong.time
    );
    expect(derivedSummary.sphResidentRenderState.schema).toBe('peercompute.ulg.sph-resident-render-state.v0');
    expect(derivedSummary.sphResidentRenderState.status).toBe('resident-render-field-applied');
    expect(derivedSummary.sphResidentRenderState.source).toBe('resident-gpu-render-field');
    expect(derivedSummary.sphResidentRenderState.sourceExecutionSchema).toBe('peercompute.ulg.sph-gpu-render-field.v0');
    expect([
      'webgpu',
      'render-rows-three-point-bridge',
      'render-rows-three-sphere-bridge'
    ]).toContain(derivedSummary.sphResidentRenderState.backend);
    expect(derivedSummary.sphResidentRenderState.particleCount).toBe(derivedSummary.sphGpuParticleState.particleCount);
    if (usesThreeRenderRowBridge) {
      expect(derivedSummary.sphResidentRenderState.renderRowsDecodedPositionCount).toBeGreaterThan(0);
    } else {
      expect(derivedSummary.sphResidentRenderState.surfaceCount).toBeGreaterThan(0);
    }
    expect(derivedSummary.sphResidentRenderState.rowStrideFloats).toBe(16);
    expect(derivedSummary.sphResidentRenderState.renderRowByteLength).toBeGreaterThan(0);
    if (usesThreeRenderRowBridge) {
      expect(derivedSummary.sphResidentRenderState.renderFieldReadback).toBe(false);
      expect(derivedSummary.sphResidentRenderState.renderFieldSurfaceCount ?? 0).toBe(0);
      expect(derivedSummary.sphResidentRenderState.renderFieldTotalCells ?? 0).toBe(0);
    } else {
      expect(derivedSummary.sphResidentRenderState.renderFieldCellStrideFloats).toBe(4);
      expect(derivedSummary.sphResidentRenderState.renderFieldByteLength).toBeGreaterThan(0);
      expect(derivedSummary.sphResidentRenderState.renderFieldReadback).toBe(true);
      expect(derivedSummary.sphResidentRenderState.renderFieldStatus).toBe('render-field-built');
      expect(derivedSummary.sphResidentRenderState.renderFieldBackend).toBe('webgpu');
      expect([
        'resident-render-rows-buffer',
        'resident-render-rows-and-product-events-buffer'
      ]).toContain(derivedSummary.sphResidentRenderState.renderFieldInputSource);
    }
    expect(derivedSummary.sphResidentRenderState.materialInterfaceFieldSchema).toBe(
      'peercompute.ulg.sph-material-interface-field.v0'
    );
    expect([
      'material-interface-field-ready',
      'material-interface-field-gpu-resident-summary-pending',
      'material-interface-field-candidate-readback-skipped',
      ...(usesThreeRenderRowBridge ? [
        'material-interface-field-skipped-three-render-row-points',
        'material-interface-field-skipped-three-render-row-spheres'
      ] : [])
    ]).toContain(derivedSummary.sphResidentRenderState.materialInterfaceFieldStatus);
    if (!usesThreeRenderRowBridge) {
      expect(derivedSummary.sphResidentRenderState.renderFieldSurfaceCount).toBe(
        derivedSummary.sphResidentRenderState.surfaceCount
      );
      expect(derivedSummary.sphResidentRenderState.renderFieldTotalCells).toBeGreaterThan(0);
      expect(derivedSummary.sphResidentRenderState.renderFieldBufferMode).toBe('released-after-three-marching-cubes-readback');
    } else {
      expect(derivedSummary.sphResidentRenderState.renderFieldBufferMode).toBe('released-after-three-render-row-points');
    }
    expect(derivedSummary.sphResidentRenderState.surfaceDrawSchema).toBe(
      'peercompute.ulg.sph-resident-surface-draw.v0'
    );
    if (usesThreeRenderRowBridge) {
      expect(SPH_THREE_RENDER_ROW_SURFACE_STATUSES).toContain(
        derivedSummary.sphResidentRenderState.surfaceDrawStatus
      );
    } else {
      expect(derivedSummary.sphResidentRenderState.surfaceDrawStatus).toBe(
        'resident-surface-draw-unavailable'
      );
      expect(derivedSummary.sphResidentRenderState.surfaceDrawSourceRenderFieldSchema).toBe(
        'peercompute.ulg.sph-gpu-render-field.v0'
      );
    }
    expect(derivedSummary.sphResidentRenderState.surfaceDrawSourceSurfaceVertexSchema).toBe(null);
    expect(derivedSummary.sphResidentRenderState.surfaceDrawSurfaceDrawSchema).toBe(null);
    if (!usesThreeRenderRowBridge) {
      expect(derivedSummary.sphResidentRenderState.surfaceDrawSurfaceCount).toBe(
        derivedSummary.sphResidentRenderState.surfaceCount
      );
    }
    expect(derivedSummary.sphResidentRenderState.surfaceDrawSourceVertexRowCount).toBe(0);
    expect(derivedSummary.sphResidentRenderState.surfaceDrawRowsBufferRetained).toBe(false);
    expect(derivedSummary.sphResidentRenderState.surfaceDrawRowsBufferByteLength).toBe(0);
    expect(derivedSummary.sphResidentRenderState.surfaceDrawIndirectSchema).toBe(null);
    expect(derivedSummary.sphResidentRenderState.surfaceDrawIndirectRowStrideUints).toBe(0);
    expect(derivedSummary.sphResidentRenderState.surfaceDrawIndirectRowsBufferRetained).toBe(false);
    expect(derivedSummary.sphResidentRenderState.surfaceDrawIndirectRowsBufferByteLength).toBe(0);
    expect(derivedSummary.sphResidentRenderState.surfaceDrawCompactedVertexRowsBufferRetained).toBe(false);
    expect(derivedSummary.sphResidentRenderState.surfaceDrawCompactedVertexRowsBufferByteLength).toBe(0);
    expect(derivedSummary.sphResidentRenderState.surfaceDrawReadback).toBe(usesThreeRenderRowBridge);
    expect(derivedSummary.sphResidentRenderState.surfaceDrawReadbackMode).toBe(
      'no-full-readback'
    );
    expect(derivedSummary.sphResidentRenderState.surfaceDrawCompactionMode).toBe(null);
    expect(derivedSummary.sphResidentRenderState.surfaceDrawInputBuffersReleased).toBe(false);
    expect(usesThreeRenderRowBridge
      ? SPH_THREE_RENDER_ROW_RENDER_SOURCES
      : ['three-managed-render-field-readback']).toContain(
      derivedSummary.sphResidentRenderState.surfaceDrawVisibleRenderSource
    );
    expect(usesThreeRenderRowBridge
      ? SPH_THREE_RENDER_ROW_BRIDGES
      : ['three-marching-cubes']).toContain(
      derivedSummary.sphResidentRenderState.surfaceDrawVisibleRendererBridge
    );
    expect(derivedSummary.sphResidentRenderState.surfaceDrawRenderBridgeSchema).toBe(
      'peercompute.ulg.sph-resident-surface-draw-render-bridge.v0'
    );
    expect(usesThreeRenderRowBridge
      ? SPH_THREE_RENDER_ROW_BRIDGE_STATUSES
      : ['surface-draw-overlay-disabled-by-policy']).toContain(
      derivedSummary.sphResidentRenderState.surfaceDrawRenderBridgeStatus
    );
    expect(derivedSummary.sphResidentRenderState.surfaceDrawRenderBridgeDepthPolicy).toBe(
      usesThreeRenderRowBridge ? 'three-managed-depth-buffer' : null
    );
    expect(derivedSummary.sphResidentRenderState.surfaceDrawRenderBridgeDepthAttachmentFormat).toBe(null);
    expect(derivedSummary.sphResidentRenderState.surfaceDrawRenderBridgeDepthAttachmentReady).toBe(
      usesThreeRenderRowBridge
    );
    if (usesThreeRenderRowBridge) {
      expect([
        'three-points-alpha-depth-sort',
        'three-instanced-spheres-material-pbr-depth-buffer'
      ]).toContain(derivedSummary.sphResidentRenderState.surfaceDrawRenderBridgeTransparencyCompositeMode);
    } else {
      expect(derivedSummary.sphResidentRenderState.surfaceDrawRenderBridgeTransparencyCompositeMode).toBe(null);
    }
    expect(derivedSummary.sphResidentRenderState.surfaceDrawRenderBridgeOitAccumFormat).toBe(null);
    expect(derivedSummary.sphResidentRenderState.surfaceDrawRenderBridgeOitRevealFormat).toBe(null);
    expect(derivedSummary.sphResidentRenderState.surfaceDrawRenderBridgeOitTargetsReady).toBe(false);
    if (usesThreeRenderRowBridge) {
      expect(derivedSummary.sphResidentRenderState.surfaceDrawRenderBridgeLastTransparentDrawCount).toBeGreaterThanOrEqual(0);
      expect([
        'render-row-vertex-colors',
        'render-row-material-pbr'
      ]).toContain(derivedSummary.sphResidentRenderState.surfaceDrawRenderBridgeOpticalRenderSource);
      expect(derivedSummary.sphResidentRenderState.surfaceDrawRenderBridgeOpticalRecordCount).toBeGreaterThan(0);
      expect(derivedSummary.sphResidentRenderState.surfaceDrawRenderBridgeOpticalSpectralSampleCount).toBeGreaterThan(0);
    } else {
      expect(derivedSummary.sphResidentRenderState.surfaceDrawRenderBridgeLastTransparentDrawCount).toBe(0);
      expect(derivedSummary.sphResidentRenderState.surfaceDrawRenderBridgeOpticalRenderSource).toBe(null);
      expect(derivedSummary.sphResidentRenderState.surfaceDrawRenderBridgeOpticalRecordCount).toBe(0);
      expect(derivedSummary.sphResidentRenderState.surfaceDrawRenderBridgeOpticalRecordStrideFloats).toBe(0);
      expect(derivedSummary.sphResidentRenderState.surfaceDrawRenderBridgeOpticalSpectralSampleCount).toBe(0);
      expect(derivedSummary.sphResidentRenderState.surfaceDrawRenderBridgeOpticalSpectralSampleStrideFloats).toBe(0);
    }
    expect(derivedSummary.sphResidentSurfaceDraw.schema).toBe(
      derivedSummary.sphResidentRenderState.surfaceDrawSchema
    );
    expect(derivedSummary.sphResidentSurfaceDraw.status).toBe(
      derivedSummary.sphResidentRenderState.surfaceDrawStatus
    );
    expect(derivedSummary.sphResidentSurfaceDraw.hasDrawRowsBuffer).toBe(false);
    expect(derivedSummary.sphResidentSurfaceDraw.hasDrawIndirectRowsBuffer).toBe(false);
    expect(derivedSummary.sphResidentSurfaceDraw.hasCompactedVertexRowsBuffer).toBe(false);
    expect(derivedSummary.sphResidentSurfaceDraw.renderFieldBufferMode).toBe(
      usesThreeRenderRowBridge
        ? 'released-after-three-render-row-points'
        : 'released-after-three-marching-cubes-readback'
    );
    expect(usesThreeRenderRowBridge
      ? SPH_THREE_RENDER_ROW_BRIDGE_STATUSES
      : ['surface-draw-overlay-disabled-by-policy']).toContain(
      derivedSummary.sphResidentSurfaceDraw.renderBridgeStatus
    );
    expect(derivedSummary.sphResidentSurfaceDraw.renderBridgeDepthPolicy).toBe(
      usesThreeRenderRowBridge ? 'three-managed-depth-buffer' : null
    );
    expect(derivedSummary.sphResidentSurfaceDraw.renderBridgeDepthAttachmentFormat).toBe(null);
    expect(derivedSummary.sphResidentSurfaceDraw.renderBridgeDepthAttachmentReady).toBe(usesThreeRenderRowBridge);
    if (usesThreeRenderRowBridge) {
      expect([
        'three-points-alpha-depth-sort',
        'three-instanced-spheres-material-pbr-depth-buffer'
      ]).toContain(derivedSummary.sphResidentSurfaceDraw.renderBridgeTransparencyCompositeMode);
    } else {
      expect(derivedSummary.sphResidentSurfaceDraw.renderBridgeTransparencyCompositeMode).toBe(null);
    }
    expect(derivedSummary.sphResidentSurfaceDraw.renderBridgeOitAccumFormat).toBe(null);
    expect(derivedSummary.sphResidentSurfaceDraw.renderBridgeOitRevealFormat).toBe(null);
    expect(derivedSummary.sphResidentSurfaceDraw.renderBridgeOitTargetsReady).toBe(false);
    if (usesThreeRenderRowBridge) {
      expect(derivedSummary.sphResidentSurfaceDraw.renderBridgeLastTransparentDrawCount).toBeGreaterThanOrEqual(0);
      expect([
        'render-row-vertex-colors',
        'render-row-material-pbr'
      ]).toContain(derivedSummary.sphResidentSurfaceDraw.renderBridgeOpticalRenderSource);
      expect(derivedSummary.sphResidentSurfaceDraw.renderBridgeOpticalRecordCount).toBeGreaterThan(0);
      expect(derivedSummary.sphResidentSurfaceDraw.renderBridgeOpticalSpectralSampleCount).toBeGreaterThan(0);
    } else {
      expect(derivedSummary.sphResidentSurfaceDraw.renderBridgeLastTransparentDrawCount).toBe(0);
      expect(derivedSummary.sphResidentSurfaceDraw.renderBridgeOpticalRenderSource).toBe(null);
      expect(derivedSummary.sphResidentSurfaceDraw.renderBridgeOpticalRecordCount).toBe(0);
      expect(derivedSummary.sphResidentSurfaceDraw.renderBridgeOpticalRecordStrideFloats).toBe(0);
      expect(derivedSummary.sphResidentSurfaceDraw.renderBridgeOpticalSpectralSampleCount).toBe(0);
      expect(derivedSummary.sphResidentSurfaceDraw.renderBridgeOpticalSpectralSampleStrideFloats).toBe(0);
    }
    expect(derivedSummary.sphResidentSurfaceDraw.renderBridgeTemporalSwapPolicy).toBe(null);
    expect(derivedSummary.sphResidentSurfaceDraw.renderBridgeRetainedPreviousOverlay).toBe(false);
    if (usesThreeRenderRowBridge) {
      expect(derivedSummary.sphResidentSurfaceDrawRenderBridge.schema).toBe(
        'peercompute.ulg.sph-resident-surface-draw-render-bridge.v0'
      );
      expect(SPH_THREE_RENDER_ROW_BRIDGE_STATUSES).toContain(
        derivedSummary.sphResidentSurfaceDrawRenderBridge.status
      );
      expect(SPH_THREE_RENDER_ROW_BRIDGES).toContain(
        derivedSummary.sphResidentSurfaceDrawRenderBridge.rendererBridge
      );
      expect(SPH_THREE_RENDER_ROW_RENDER_SOURCES).toContain(
        derivedSummary.sphResidentSurfaceDrawRenderBridge.visibleRenderSource
      );
      expect(SPH_THREE_RENDER_ROW_LAST_RENDER_STATUSES).toContain(
        derivedSummary.sphResidentSurfaceDrawRenderBridge.lastRenderStatus
      );
    } else {
      expect(derivedSummary.sphResidentSurfaceDrawRenderBridge.schema).toBeUndefined();
      expect(derivedSummary.sphResidentSurfaceDrawRenderBridge.status).toBeUndefined();
      expect(derivedSummary.sphResidentSurfaceDrawRenderBridge.rendererBridge).toBeUndefined();
      expect(derivedSummary.sphResidentSurfaceDrawRenderBridge.visibleRenderSource).toBeUndefined();
      expect(derivedSummary.sphResidentSurfaceDrawRenderBridge.canvasWidth).toBeUndefined();
      expect(derivedSummary.sphResidentSurfaceDrawRenderBridge.canvasHeight).toBeUndefined();
    }
    expect(derivedSummary.sphResidentRenderState.materialInterfaceFieldSchema).toBe(
      'peercompute.ulg.sph-material-interface-field.v0'
    );
    expect([
      'material-interface-field-ready',
      'material-interface-field-gpu-resident-summary-pending',
      'material-interface-field-candidate-readback-skipped',
      ...(usesThreeRenderRowBridge ? [
        'material-interface-field-skipped-three-render-row-points',
        'material-interface-field-skipped-three-render-row-spheres'
      ] : [])
    ]).toContain(derivedSummary.sphResidentRenderState.materialInterfaceFieldStatus);
    const materialInterfaceReady = derivedSummary.sphResidentRenderState.materialInterfaceFieldStatus === 'material-interface-field-ready';
    const pressureInterfaceReady = derivedSummary.sphResidentRenderState.pressureInterfaceForceSolverStatus
      === 'pressure-interface-force-solver-ready';
    if (materialInterfaceReady) {
      expect(derivedSummary.sphResidentRenderState.materialInterfaceReadySurfaceCount).toBeGreaterThan(0);
      expect(derivedSummary.sphResidentRenderState.materialInterfaceTotalSurfaceAreaM2).toBeGreaterThan(0);
    } else {
      expect(derivedSummary.sphResidentRenderState.materialInterfaceReadySurfaceCount).toBe(0);
      expect(derivedSummary.sphResidentRenderState.materialInterfaceTotalSurfaceAreaM2).toBe(0);
    }
    if (pressureInterfaceReady) {
      expect(derivedSummary.sphResidentRenderState.materialInterfaceForceCouplingStatus).toBe(
        'pressure-force-solver-ready-not-applied'
      );
    } else {
      expect(derivedSummary.sphResidentRenderState.materialInterfaceForceCouplingStatus).toBe(
        'blocked-material-surface-normals-not-resolved'
      );
    }
    expect(derivedSummary.sphResidentRenderState.pressureInterfaceCouplingSchema).toBe(
      'peercompute.ulg.sph-pressure-interface-coupling.v0'
    );
    expect(derivedSummary.sphResidentRenderState.pressureInterfaceCouplingStatus).toBe(
      pressureInterfaceReady ? 'pressure-interface-coupling-ready-for-solver' : 'pressure-interface-coupling-blocked'
    );
    expect(derivedSummary.sphResidentRenderState.pressureInterfaceForceCouplingStatus).toBe(
      pressureInterfaceReady ? 'pressure-force-solver-ready-not-applied' : 'blocked-material-surface-normals-not-resolved'
    );
    expect(derivedSummary.sphResidentRenderState.pressureInterfaceForcePreviewSchema).toBe(
      'peercompute.ulg.sph-pressure-interface-force-preview.v0'
    );
    expect(derivedSummary.sphResidentRenderState.pressureInterfaceForcePreviewStatus).toBe(
      pressureInterfaceReady ? 'pressure-interface-force-preview-ready' : 'pressure-interface-force-preview-blocked'
    );
    expect(derivedSummary.sphResidentRenderState.pressureInterfaceForceApplicationStatus).toBe(
      'not-applied-diagnostic-preview'
    );
    if (pressureInterfaceReady) {
      expect(derivedSummary.sphResidentRenderState.pressureInterfacePreviewedElementCount).toBeGreaterThan(0);
      expect(derivedSummary.sphResidentRenderState.pressureInterfaceTotalAbsForceN).toBeGreaterThan(0);
    } else {
      expect(derivedSummary.sphResidentRenderState.pressureInterfacePreviewedElementCount).toBe(0);
      expect(derivedSummary.sphResidentRenderState.pressureInterfaceTotalAbsForceN).toBe(0);
    }
    expect(derivedSummary.sphResidentRenderState.pressureInterfaceForceSolverSchema).toBe(
      'peercompute.ulg.sph-pressure-interface-force-solver.v0'
    );
    expect(derivedSummary.sphResidentRenderState.pressureInterfaceForceSolverStatus).toBe(
      pressureInterfaceReady ? 'pressure-interface-force-solver-ready' : 'pressure-interface-force-solver-blocked'
    );
    expect(derivedSummary.sphResidentRenderState.pressureInterfaceSolverApplicationStatus).toBe(
      pressureInterfaceReady ? 'solver-ready-not-applied' : 'not-applied-solver-blocked'
    );
    if (pressureInterfaceReady) {
      expect(derivedSummary.sphResidentRenderState.residentPressureInterfaceStateStatus).toBe(
        'resident-pressure-interface-force-rows-admission-required'
      );
      expect(derivedSummary.sphResidentRenderState.pressureInterfaceSolverForceRowCount).toBeGreaterThan(0);
      expect([
        'interface-contact-particle-bin-grid-submitted',
        'interface-contact-particle-bin-grid-ready'
      ]).toContain(derivedSummary.sphResidentRenderState.pressureInterfaceContactBinGridStatus);
      expect(derivedSummary.sphResidentRenderState.pressureInterfaceContactBinGridEnabled).toBe(true);
      expect(derivedSummary.sphResidentRenderState.pressureInterfaceContactBinGridCellCount).toBeGreaterThan(0);
      expect(derivedSummary.sphResidentRenderState.pressureInterfaceContactBinGridBinCapacity).toBeGreaterThan(0);
      expect(derivedSummary.sphResidentRenderState.pressureInterfaceContactBinGridAverageOccupancy).toBeGreaterThan(0);
      expect(derivedSummary.sphResidentRenderState.pressureInterfaceContactBinGridEstimatedOverflowRisk).toBe(false);
      expect(derivedSummary.sphResidentRenderState.pressureInterfaceContactBinGridIndexBufferByteLength).toBeGreaterThan(0);
      expect(derivedSummary.sphResidentRenderState.pressureInterfaceSolverConservationStatus).toBe(
        'pairwise-equal-opposite-force-conservative'
      );
      expect(Math.abs(derivedSummary.sphResidentRenderState.pressureInterfaceSolverConservationResidualMagnitudeN)).toBeLessThan(1e-6);
      expect(derivedSummary.sphResidentRenderState.pressureInterfaceForceRowsUploadStatus).toBe(
        'blocked-pressure-interface-grid-force-admission-required'
      );
      expect([
        'pressure-interface-force-solver-grid-application-not-approved',
        'pressure-interface-grid-force-consumption-admission-required'
      ]).toContain(derivedSummary.sphResidentRenderState.pressureInterfaceForceRowsUploadBlocker);
      expect(derivedSummary.sphResidentRenderState.pressureInterfaceForceRowsBufferRetained).toBe(false);
      expect(derivedSummary.sphResidentRenderState.pressureInterfaceForceRowsBufferByteLength).toBe(0);
      expect(derivedSummary.sphResidentRenderState.pressureInterfaceForceRowsCandidateByteLength).toBeGreaterThan(0);
      expect(derivedSummary.sphResidentRenderState.pressureInterfaceForceRowsUploadQueueCompletionStatus).toBeNull();
      expect(derivedSummary.sphResidentRenderState.pressureInterfaceForceRowsUploadQueueCompletionMethod).toBeNull();
      expect(derivedSummary.sphResidentRenderState.pressureInterfaceGridForceAdmissionSchema).toBe(
        'peercompute.ulg.pressure-interface-grid-force-consumption-admission.v0'
      );
      expect(derivedSummary.sphResidentRenderState.pressureInterfaceGridForceAdmissionStatus).toBe(
        'pressure-interface-grid-force-consumption-blocked'
      );
      expect(derivedSummary.sphResidentRenderState.pressureInterfaceGridForceAdmissionApproved).toBe(false);
    } else {
      expect(derivedSummary.sphResidentRenderState.pressureInterfaceSolverForceRowCount).toBe(0);
      expect(derivedSummary.sphResidentRenderState.pressureInterfaceSolverConservationStatus).toBe(
        'not-evaluated'
      );
      expect(derivedSummary.sphResidentRenderState.pressureInterfaceSolverConservationResidualMagnitudeN).toBe(0);
      expect([null, 'resident-pressure-interface-blocked']).toContain(
        derivedSummary.sphResidentRenderState.pressureInterfaceForceRowsUploadStatus
      );
      expect([null, 'blocked-material-surface-normals-not-resolved']).toContain(
        derivedSummary.sphResidentRenderState.pressureInterfaceForceRowsUploadBlocker
      );
      expect(derivedSummary.sphResidentRenderState.pressureInterfaceForceRowsBufferRetained).toBe(false);
      expect(derivedSummary.sphResidentRenderState.pressureInterfaceForceRowsBufferByteLength).toBe(0);
      expect(derivedSummary.sphResidentRenderState.pressureInterfaceForceRowsCandidateByteLength).toBe(0);
      expect(derivedSummary.sphResidentRenderState.pressureInterfaceForceRowsUploadQueueCompletionStatus).toBeNull();
    }
    expect(derivedSummary.sphResidentRenderState.renderRowsBufferRetained).toBe(true);
    expect(derivedSummary.sphResidentRenderState.renderRowsBufferByteLength).toBe(
      derivedSummary.sphResidentRenderState.renderRowByteLength
    );
    expect(derivedSummary.sphResidentRenderState.renderRowsReadback).toBe(usesThreeRenderRowBridge);
    expect(derivedSummary.sphResidentRenderState.renderRowsReadbackMode).toBe(
      usesThreeRenderRowBridge ? 'full-parity-readback' : 'no-full-readback'
    );
    if (usesThreeRenderRowBridge) {
      expect(derivedSummary.sphResidentRenderState.renderRowsReadbackByteLength).toBeGreaterThan(0);
    } else {
      expect(derivedSummary.sphResidentRenderState.renderRowsGpuHandoffCopy).toBe(true);
      expect(derivedSummary.sphResidentRenderState.renderRowsHandoffMode).toBe('gpu-copy-barrier');
      expect(derivedSummary.sphResidentRenderState.renderRowsReadbackByteLength).toBe(0);
    }
    expect(derivedSummary.sphResidentRenderState.compactRenderReadback).toBe(usesThreeRenderRowBridge);
    expect(derivedSummary.sphResidentRenderState.normalHotLoopReadbackFree).toBe(false);
    if (usesThreeRenderRowBridge) {
      expect([
        undefined,
        null,
        'surface-table-skipped-three-render-row-points',
        'surface-table-skipped-three-render-row-spheres',
        'resident-render-surface-table-skipped-three-resident-bridge',
        'resident-render-surface-table-ready'
      ]).toContain(derivedSummary.sphResidentRenderState.residentSurfaceTableStatus);
    } else {
      expect(derivedSummary.sphResidentRenderState.residentSurfaceTableStatus).toBe(
        'resident-render-surface-table-ready'
      );
      expect(derivedSummary.sphResidentRenderState.residentSurfaceTableSurfaceCount).toBeGreaterThanOrEqual(
        derivedSummary.sphResidentRenderState.renderFieldSurfaceCount
      );
      expect(derivedSummary.sphResidentRenderState.residentSurfaceTableTotalFieldCells).toBeGreaterThan(0);
    }
    expect(derivedSummary.sphResidentRenderState.renderReadbackCadence.schema).toBe(
      'peercompute.ulg.sph-demo-render-readback-cadence.v0'
    );
    expect(derivedSummary.sphResidentRenderState.renderReadbackCadence.cadence).toBeGreaterThan(1);
    expect(derivedSummary.sphResidentRenderState.renderReadbackCadence.effectiveCadence).toBeGreaterThanOrEqual(1);
    expect(typeof derivedSummary.sphResidentRenderState.renderReadbackCadence.forced).toBe('boolean');
    expect(derivedSummary.sphResidentPerf.schema).toBe('peercompute.ulg.sph-demo-resident-perf.v0');
    expect(derivedSummary.sphResidentPerf.residentSubmissions).toBeGreaterThan(0);
    expect(derivedSummary.sphResidentPerf.renderReadbackCadence).toBeGreaterThan(1);
    expect(derivedSummary.sphResidentPerf.effectiveRenderReadbackCadence).toBeGreaterThanOrEqual(1);
    expect(typeof derivedSummary.sphResidentPerf.playbackVisualRefreshForced).toBe('boolean');
    expect(Number.isFinite(derivedSummary.sphResidentPerf.lastResidentMs)).toBe(true);
    expect(derivedSummary.sphResidentRenderState.gpuAuthoritativeState).toBe(true);
    expect(derivedSummary.visibleSurfaces
      .filter((surface) => (surface.materialOpacity ?? 1) < 0.999)
      .every((surface) => surface.materialDepthWrite === false)).toBe(true);
    expect(derivedSummary.visibleSurfaces
      .filter((surface) => (surface.materialTransmission ?? 0) > 0.01 && (surface.materialOpacity ?? 1) >= 0.999)
      .every((surface) => (
        surface.materialDepthWrite === true
        && surface.renderOrderPolicy === 'stable-opaque-layer-order'
      ))).toBe(true);
    expect(derivedSummary.sphResidentRenderState.scientificValidation).toBe(false);
    expect(derivedSummary.sphResidentRenderState.sphValidation).toBe(false);
    expect(derivedSummary.sphResidentRenderState.phaseChangeValidation).toBe(false);
    expect(derivedSummary.sphResidentRenderState.fullPhysicsValidation).toBe(false);
    if (usesThreeRenderRowBridge) {
      const renderRowSurfaces = derivedSummary.visibleSurfaces.filter((surface) => (
        SPH_THREE_RENDER_ROW_BRIDGES.includes(surface.renderMode)
      ));
      expect(renderRowSurfaces.length).toBeGreaterThan(0);
      expect(renderRowSurfaces.every((surface) => (
        SPH_THREE_RENDER_ROW_RENDER_SOURCES.includes(surface.renderSource)
      ))).toBe(true);
    } else {
      expect(derivedSummary.visibleSurfaces.every((surface) => (
        surface.renderSource === 'resident-gpu-render-field'
        && surface.renderRowsBackend === 'webgpu'
        && surface.renderFieldBackend === 'webgpu'
        && [
          'resident-render-rows-buffer',
          'resident-render-rows-and-product-events-buffer'
        ].includes(surface.renderFieldInputSource)
      ))).toBe(true);
    }
  } else {
    expect(derivedSummary.statusText).toContain('resident readback: requested=no-full-readback actual=full-parity-readback');
    if (derivedSummary.driverReady) {
      expect(derivedSummary.statusText).toContain('resident source  : cpu-packed-state continued=false');
      expect(derivedSummary.statusText).toContain('render readback  : available=true hot-loop-no-full=false');
      expect(derivedSummary.statusText).toContain('render authoritative: false');
    } else {
      expect(derivedSummary.statusText).toContain('view state       : peercompute-worker-packed-state');
    }
    expect(derivedSummary.mlsMpmResidentSteps.readbackMode).toBe('full-parity-readback');
    expect(['cpu-packed-state', 'peercompute-worker-packed-state']).toContain(
      derivedSummary.mlsMpmResidentSteps.residentSourceMode
    );
    expect(derivedSummary.mlsMpmResidentSteps.continuedFromResidentState).toBe(false);
    expect(derivedSummary.mlsMpmResidentSteps.normalHotLoopReadbackFree).toBe(false);
    expect(derivedSummary.mlsMpmResidentSteps.renderStateReadbackAvailable).toBe(true);
    expect(derivedSummary.mlsMpmResidentStep.readbackMode).toBe('full-parity-readback');
    expect(derivedSummary.mlsMpmResidentStep.normalHotLoopReadbackFree).toBe(false);
    expect(derivedSummary.mlsMpmResidentStep.renderStateReadbackAvailable).toBe(true);
    expect(derivedSummary.mlsMpmResidentStep.diagnostics.readbackMode).toBe('full-parity-readback');
    expect(derivedSummary.mlsMpmResidentStep.diagnostics.activeGridNodeCount).toBeGreaterThan(0);
    expect(Math.abs(derivedSummary.mlsMpmResidentStep.diagnostics.massDeltaKg)).toBeLessThan(1e-3);
    expect(Number.isFinite(derivedSummary.mlsMpmResidentStep.diagnostics.maxSpeedMPerS)).toBe(true);
  }
  expect(derivedSummary.mlsMpmResidentStep.p2gProjectionValidation).toBe(false);
  expect(derivedSummary.mlsMpmResidentStep.stressProjectionValidation).toBe(false);
  expect(derivedSummary.mlsMpmResidentStep.gridUpdateValidation).toBe(false);
  expect(derivedSummary.mlsMpmResidentStep.g2pValidation).toBe(false);
  expect(derivedSummary.mlsMpmResidentStep.gridValidation).toBe(false);
  expect(derivedSummary.mlsMpmResidentStep.sphValidation).toBe(false);
  expect(derivedSummary.mlsMpmResidentStep.phaseChangeValidation).toBe(false);
  expect(derivedSummary.mlsMpmResidentStep.fullPhysicsValidation).toBe(false);
  expect(derivedSummary.mlsMpmResidentStep.diagnostics.fullPhysicsValidation).toBe(false);
  expect(derivedSummary.visibleSurfaces.length).toBeGreaterThan(0);
  const primaryOpticalSurfaces = derivedSummary.visibleSurfaces.filter((surface) => (
    surface.materialKey === 'h2o' || surface.materialKey === 'fe'
  ));
  expect(primaryOpticalSurfaces.length).toBeGreaterThan(0);
  const lookupCoveredSurfaces = primaryOpticalSurfaces.filter((surface) => surface.lookupOutputRecordIndex != null);
  if (lookupCoveredSurfaces.length > 0) {
    expect(lookupCoveredSurfaces.every((surface) => surface.lookupBackend === derivedSummary.opticalGpuLookup.executionBackend)).toBe(true);
  }
  const visibleH2oSurfaces = derivedSummary.visibleSurfaces.filter((surface) => surface.materialKey === 'h2o');
  expect(visibleH2oSurfaces.length).toBeGreaterThan(0);
  const transmissiveH2oSurfaces = visibleH2oSurfaces.filter((surface) => (
    (surface.materialTransmission ?? 0) > 0.01
    || surface.renderLayer === 'transmissive-surface'
  ));
  expect(transmissiveH2oSurfaces.length).toBeGreaterThan(0);
  expect(transmissiveH2oSurfaces.every((surface) => (
    surface.materialDepthWrite === true
    && surface.renderOrderPolicy === 'stable-opaque-layer-order'
  ))).toBe(true);
  expect(visibleH2oSurfaces.some((surface) => (
    Number.isFinite(surface.renderAlpha)
    && surface.renderAlpha > 0
    && surface.renderAlpha <= 1
  ))).toBe(true);
  expect(visibleH2oSurfaces.some((surface) => (
    Number.isFinite(surface.materialOpacity)
    && surface.materialOpacity > 0
    && surface.materialOpacity <= 1
  ))).toBe(true);
});

test('SPH phase demo reacts room-temperature Na + H2O through derived product closure', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 980, height: 720 });
  await page.goto('/#drop=Na&base=h2o&dropt=293.15&baset=293.15&ironh=1');
  if (await page.locator('#sph-phase-overlay').count() === 0) {
    await page.locator('#run-sph-phase').click();
  }
  await expect(page.locator('#sph-phase-overlay')).toBeVisible();
  await expect(page.locator('#sph-status')).toContainText('preflight        :');
  await page.waitForFunction(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const cache = overlay?.__sphPeerClosureCache;
    return !overlay?.__sphCpuClosureTask
      && (
        cache?.coldStartWrite?.status === 'stored'
        || cache?.coldStartLookup?.status === 'reaction-cache-hit'
        || overlay?.__sphDriver
      );
  }, null, { timeout: 60_000 });
  await expect(page.locator('#sph-status')).toContainText('Na+h2o', { timeout: 60_000 });
  const stepped = await page.evaluate(() => document.querySelector('#sph-phase-overlay').__sphStep(2));
  expect(stepped.blocked).not.toBe(true);
  expect(stepped.particlesByMaterial.naoh).toBeGreaterThan(0);
  expect(stepped.particlesByMaterial.h2).toBeGreaterThan(0);
  expect(stepped.gasPressureSummary.bySpecies.h2.partialPressurePa).toBeGreaterThan(0);
  expect(stepped.gasPressureSummary.totalPressurePa).toBeGreaterThan(101325);
});

test('SPH phase mounted resident active-metal/H2O promotes product gas pressure', async ({ page }) => {
  test.setTimeout(480_000);
  const consoleIssues = [];
  page.on('console', (message) => {
    const text = message.text();
    if (/Invalid Buffer|Invalid BindGroup|Invalid CommandBuffer|Error while parsing WGSL|too many warnings|used in submit while destroyed/i.test(text)) {
      consoleIssues.push(text);
    }
  });

  const openResidentReactionScenario = async (dropMaterial) => {
    await page.goto(`/?drop=${encodeURIComponent(dropMaterial)}&base=h2o&dropt=293.15&baset=293.15&iceh=0&ironh=1.01&dropn=2&basen=4&boxx=4&boxy=4&boxz=4&mech=sph&residentAuto=0&visualCapture=1&blob=1`);
    if (await page.locator('#sph-phase-overlay').count() === 0) {
      await page.locator('#run-sph-phase').click();
    }
    await expect(page.locator('#sph-phase-overlay')).toBeVisible();
    await page.waitForFunction(() => {
      const overlay = document.querySelector('#sph-phase-overlay');
      const scene = overlay?.__sphScene;
      return Boolean(
        !overlay?.__sphCpuClosureTask?.active
        && scene?.getSphGpuParticleState?.()?.schema
        && scene?.getMlsMpmGpuParticleState?.()?.schema
        && scene?.getSphReactionTable?.()?.reactionCount > 0
        && typeof scene?.refreshMlsMpmResidentSteps === 'function'
        && typeof scene?.refreshSphResidentRenderState === 'function'
        && typeof overlay?.__sphUpdateResidentGasPressureSummary === 'function'
      );
    }, null, { timeout: 120_000 });
  };

  await openResidentReactionScenario('Na');

  const runResidentReactionRefresh = async (reason, options = {}) => page.evaluate(async ({
    refreshReason,
    continueFromResidentState
  }) => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const scene = overlay.__sphScene;
    const execution = await scene.refreshMlsMpmResidentSteps({
      preferWebGpu: true,
      stepCount: 1,
      readbackMode: 'no-full-readback',
      compactSummaryScope: 'particle-visual',
      continueFromResidentState,
      force: true
    });
    overlay.__mlsMpmResidentSteps = execution;
    overlay.__mlsMpmResidentStep = execution?.finalStep || scene.getMlsMpmResidentStep?.() || null;
    const residentGasPressureBeforeInterface = overlay.__sphUpdateResidentGasPressureSummary(overlay.__mlsMpmResidentStep);
    const residentReactionResult = overlay.__mlsMpmResidentStep?.reactionStep?.result
      || overlay.__mlsMpmResidentStep?.reactionStep
      || null;
    const pressureInterfacePreRender = await scene.refreshSphResidentPressureInterfaceState?.({
      preferWebGpu: true,
      gasPressureSummary: residentGasPressureBeforeInterface,
      residentProductMass: overlay.__mlsMpmResidentStep?.residentProductMass
        || residentReactionResult?.residentProductMass
        || null,
      reactionSummary: residentReactionResult?.reactionSummary || null,
      reactionTable: scene.getSphReactionTable?.() || null,
      source: 'test-resident-reaction-pressure-interface-refresh',
      sourceCadence: refreshReason
    });
    overlay.__sphResidentPressureInterfaceState = pressureInterfacePreRender
      || scene.getSphResidentPressureInterfaceState?.()
      || null;
    const residentGasPressure = overlay.__sphUpdateResidentGasPressureSummary(overlay.__mlsMpmResidentStep)
      || residentGasPressureBeforeInterface;
    const renderRefresh = scene.refreshSphResidentRenderState({
      preferWebGpu: true,
      residentSteps: execution,
      materialProperties: overlay.__sphPhaseViewState?.materialProperties || {},
      gasPressureSummary: residentGasPressure,
      renderFieldReadbackMode: 'full-parity-readback',
      renderRowsReadbackMode: 'full-parity-readback'
    });
    const renderState = await renderRefresh;
    overlay.__sphResidentRenderState = renderState;
    overlay.__sphResidentSurfaceDraw = scene.getSphResidentSurfaceDraw?.() || null;
    const pressureInterfaceState = scene.getSphResidentPressureInterfaceState?.()
      || overlay.__sphResidentPressureInterfaceState
      || null;
    scene.refreshViewportAndOverlay?.({ reason: refreshReason });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const statusText = overlay.querySelector('#sph-status')?.textContent ?? '';
    const particleScaleDiagnostics = execution?.finalStep?.diagnostics || {};
    return {
      status: 'resident-render-refresh-complete',
      resetStatus: overlay.__sphResetStatus || null,
      stepBackend: execution?.backend ?? null,
      residentSourceMode: execution?.residentSourceMode ?? null,
      continuedFromResidentState: execution?.continuedFromResidentState ?? null,
      reactionStatus: execution?.finalStep?.stageStatus?.reaction ?? null,
      residentReactionBinGrid: {
        neighborMode: particleScaleDiagnostics.reactionProposalNeighborMode ?? null,
        status: particleScaleDiagnostics.reactionParticleBinGridStatus ?? null,
        enabled: particleScaleDiagnostics.reactionParticleBinGridEnabled ?? null,
        cellCount: particleScaleDiagnostics.reactionParticleBinGridCellCount ?? 0,
        binCapacity: particleScaleDiagnostics.reactionParticleBinGridBinCapacity ?? 0,
        indexBufferByteLength: particleScaleDiagnostics.reactionParticleBinGridIndexBufferByteLength ?? 0,
        maxContactRadiusM: particleScaleDiagnostics.reactionParticleBinGridMaxContactRadiusM ?? 0,
        overflowMetadataReadbackRequested:
          particleScaleDiagnostics.reactionParticleBinOverflowMetadataReadbackRequested ?? null
      },
      residentStepParticleScale: {
        schema: particleScaleDiagnostics.particleScaleStabilitySchema ?? null,
        status: particleScaleDiagnostics.particleScaleStabilityStatus ?? null,
        policyAppliedInG2p: particleScaleDiagnostics.particleScalePolicyAppliedInG2p ?? null,
        policyAppliedInShader: particleScaleDiagnostics.particleScalePolicyAppliedInShader ?? null,
        maxRadiusGrowthRatioAllowed:
          particleScaleDiagnostics.particleScaleMaxRadiusGrowthRatioAllowed ?? null,
        maxVolumeRatioJAllowed:
          particleScaleDiagnostics.particleScaleMaxVolumeRatioJAllowed ?? null,
        capCountKnown: particleScaleDiagnostics.particleScaleCapCountKnown ?? null,
        capCount: particleScaleDiagnostics.particleScaleCapCount ?? null,
        maxRawVolumeRatioJ: particleScaleDiagnostics.particleScaleMaxRawVolumeRatioJ ?? null,
        maxEffectiveVolumeRatioJ:
          particleScaleDiagnostics.particleScaleMaxEffectiveVolumeRatioJ ?? null,
        minEffectiveVolumeRatioJ:
          particleScaleDiagnostics.particleScaleMinEffectiveVolumeRatioJ ?? null
      },
      residentProductMassStatus: execution?.finalStep?.residentProductMass?.status
        || execution?.finalStep?.residentProductMassStatus
        || null,
      residentProductRows: execution?.finalStep?.residentProductMass?.productEventRowCount
        ?? execution?.finalStep?.residentProductMassProductEventRowCount
        ?? 0,
      inputResidentProductRows: execution?.finalStep?.inputResidentProductMassProductEventRowCount
        ?? execution?.finalStep?.diagnostics?.inputResidentProductMassProductEventRowCount
        ?? 0,
      emittedResidentProductRows: execution?.finalStep?.emittedResidentProductMassProductEventRowCount
        ?? execution?.finalStep?.diagnostics?.emittedResidentProductMassProductEventRowCount
        ?? 0,
      mergedResidentProductRows: execution?.finalStep?.mergedResidentProductMassProductEventRowCount
        ?? execution?.finalStep?.diagnostics?.mergedResidentProductMassProductEventRowCount
        ?? 0,
      residentProductMassMergeStatus: execution?.finalStep?.residentProductMassMergeStatus
        ?? execution?.finalStep?.diagnostics?.residentProductMassMergeStatus
        ?? null,
      residentProductMassGenerationCount: execution?.finalStep?.residentProductMass?.productEventGenerationCount
        ?? execution?.finalStep?.residentProductMassGenerationCount
        ?? execution?.finalStep?.diagnostics?.residentProductMassGenerationCount
        ?? 0,
      residentProductMassGasSpeciesLedgerCount: execution?.finalStep?.residentProductMass?.gasSpeciesLedgerCount
        ?? execution?.finalStep?.residentProductMassGasSpeciesLedgerCount
        ?? execution?.finalStep?.diagnostics?.residentProductMassGasSpeciesLedgerCount
        ?? 0,
      residentProductEventRecordCount: execution?.finalStep?.residentProductMass?.productEvents?.records?.length ?? null,
      residentGasPressure: residentGasPressure ? {
        status: residentGasPressure.status ?? null,
        source: residentGasPressure.source ?? null,
        pressureInterfaceSpatialGasLedgerPromoted:
          residentGasPressure.pressureInterfaceSpatialGasLedgerPromoted ?? null,
        pressureInterfaceSpatialGasLedgerCellCount:
          residentGasPressure.pressureInterfaceSpatialGasLedgerCellCount ?? null,
        pressureInterfaceSpatialGasSpeciesRowCount:
          residentGasPressure.pressureInterfaceSpatialGasSpeciesRowCount ?? null,
        totalPressurePa: residentGasPressure.totalPressurePa ?? null,
        h2PartialPressurePa: residentGasPressure.bySpecies?.h2?.partialPressurePa ?? null,
        h2MassKg: residentGasPressure.bySpecies?.h2?.massKg ?? null,
        residentProductMassStatus: residentGasPressure.residentProductMassStatus ?? null,
        residentProductMassGasSpeciesLedgerCount: residentGasPressure.residentProductMassGasSpeciesLedgerCount ?? null,
        spatialGasSpeciesLedgerStatus: residentGasPressure.spatialGasSpeciesLedger?.status ?? null,
        spatialGasSpeciesLedgerCellCount: residentGasPressure.spatialGasSpeciesLedger?.cellCount
          ?? residentGasPressure.spatialGasSpeciesLedger?.cells?.length
          ?? null,
        residentSpatialGasSpeciesLedgerStatus: residentGasPressure.residentSpatialGasSpeciesLedgerStatus ?? null,
        pressureFeedbackGasCellLocalReady: residentGasPressure.pressureFeedback?.gasCellField?.localPressureGradientReady ?? null,
        pressureFeedbackGasCellSpatialStatus: residentGasPressure.pressureFeedback?.gasCellField?.residentSpatialGasSpeciesLedgerStatus ?? null
      } : null,
      pressureInterfaceState: pressureInterfaceState ? {
        status: pressureInterfaceState.status ?? null,
        spatialGasLedgerProducerStageRequestStatus: pressureInterfaceState.spatialGasLedgerProducerStageRequestStatus ?? null,
        spatialGasLedgerProducerStageSpatialLedgerCellCount: pressureInterfaceState.spatialGasLedgerProducerStageSpatialLedgerCellCount ?? null,
        spatialGasLedgerProducerAggregateFallbackUsed: pressureInterfaceState.spatialGasLedgerProducerAggregateFallbackUsed ?? null,
        spatialGasLedgerProducerSpatialGasLedgerDerivation: pressureInterfaceState.spatialGasLedgerProducerSpatialGasLedgerDerivation ?? null,
        spatialGasLedgerProducerSpatialGasPositionSource: pressureInterfaceState.spatialGasLedgerProducerSpatialGasPositionSource ?? null,
        spatialGasLedgerProducerCompactSpatialGasReadbackByteLength: pressureInterfaceState.spatialGasLedgerProducerCompactSpatialGasReadbackByteLength ?? null,
        spatialGasLedgerProducerFullProductEventReadbackPerformed: pressureInterfaceState.spatialGasLedgerProducerFullProductEventReadbackPerformed ?? null,
        gasCellEosProducerStageRequestStatus: pressureInterfaceState.gasCellEosProducerStageRequestStatus ?? null,
        gasCellEosProducerStageSpatialLedgerCellCount: pressureInterfaceState.gasCellEosProducerStageSpatialLedgerCellCount ?? null,
        pressureInterfaceGasCellFieldImportStatus: pressureInterfaceState.pressureInterfaceGasCellFieldImportStatus ?? null,
        pressureInterfaceGasCellFieldImportReady: pressureInterfaceState.pressureInterfaceGasCellFieldImportReady ?? null
      } : null,
      renderState: renderState ? {
        source: renderState.source ?? null,
        backend: renderState.backend ?? null,
        gasPressureSummaryStatus: renderState.gasPressureSummaryStatus ?? null,
        gasPressureSummarySource: renderState.gasPressureSummarySource ?? null,
        residentProductMassStatus: renderState.residentProductMassStatus ?? null,
        residentProductMassEosCouplingStatus: renderState.residentProductMassEosCouplingStatus ?? null,
        productEventBufferBound: renderState.productEventBufferBound ?? null,
        productEventBufferByteLength: renderState.productEventBufferByteLength ?? null,
        renderRowsParticleScaleStabilityStatus:
          renderState.renderRowsParticleScaleStabilityStatus ?? null,
        renderRowsParticleScaleCapAppliedCount:
          renderState.renderRowsParticleScaleCapAppliedCount ?? null,
        renderRowsParticleScaleCapAppliedCountKnown:
          renderState.renderRowsParticleScaleCapAppliedCountKnown ?? null,
        renderRowsParticleScaleMaxRadiusGrowthRatioAllowed:
          renderState.renderRowsParticleScaleMaxRadiusGrowthRatioAllowed ?? null,
        renderRowsParticleScaleMaxVolumeRatioJAllowed:
          renderState.renderRowsParticleScaleMaxVolumeRatioJAllowed ?? null,
        renderRowsParticleScaleMaxSupportRadiusM:
          renderState.renderRowsParticleScaleMaxSupportRadiusM ?? null,
        renderRowsParticleScaleMaxGasParticleRadiusM:
          renderState.renderRowsParticleScaleMaxGasParticleRadiusM ?? null,
        renderRowsParticleScaleSupportRadiusPolicyAppliedInShader:
          renderState.renderRowsParticleScaleSupportRadiusPolicyAppliedInShader ?? null,
        renderRowsDecodedMaterialPhaseCounts:
          renderState.renderRowsDecodedMaterialPhaseCounts ?? null,
        renderRowsDecodedMaxParticleRadiusM:
          renderState.renderRowsDecodedMaxParticleRadiusM ?? null,
        renderRowsDecodedMaxVolumeRatioJ:
          renderState.renderRowsDecodedMaxVolumeRatioJ ?? null,
        renderRowsDecodedVolumeRatioCapBoundary:
          renderState.renderRowsDecodedVolumeRatioCapBoundary ?? null,
        renderRowsDecodedVolumeRatioCapBoundaryCount:
          renderState.renderRowsDecodedVolumeRatioCapBoundaryCount ?? null,
        materialKeys: renderState.materialKeys || []
      } : null,
      statusText
    };
  }, {
    refreshReason: reason,
    continueFromResidentState: options.continueFromResidentState === true
  });

  const expectResidentReactionRefresh = (
    result,
    {
      expectPressureInterface = true,
      expectedMaterialKeys = ['Na', 'h2o', 'naoh', 'h2'],
      expectDecodedMaxUnderGasCap = true,
      expectGasRenderRows = true,
      expectContinuation = false
    } = {}
  ) => {
    expect(result.status, JSON.stringify(result, null, 2))
      .toBe('resident-render-refresh-complete');
    expect(result.stepBackend).toBe('webgpu');
    expect(result.continuedFromResidentState).toBe(expectContinuation);
    expect(result.residentSourceMode)
      .toBe(expectContinuation ? 'previous-gpu-resident-output' : 'cpu-packed-state');
    expect(result.reactionStatus).toBe('reaction-step-executed');
    expect(result.residentReactionBinGrid?.neighborMode)
      .toBe('fixed-capacity-particle-bin-grid');
    expect(result.residentReactionBinGrid?.status)
      .toBe('reaction-particle-bin-grid-prepared');
    expect(result.residentReactionBinGrid?.enabled).toBe(true);
    expect(result.residentReactionBinGrid?.cellCount).toBeGreaterThan(0);
    expect(result.residentReactionBinGrid?.binCapacity).toBeGreaterThan(0);
    expect(result.residentReactionBinGrid?.indexBufferByteLength).toBeGreaterThan(0);
    expect(result.residentReactionBinGrid?.maxContactRadiusM).toBeGreaterThan(0);
    expect(result.residentReactionBinGrid?.overflowMetadataReadbackRequested).toBe(false);
    const expectedProductMassStatus = expectContinuation
      ? 'resident-product-mass-merged-gpu-resident'
      : 'resident-product-mass-buffer-retained';
    expect(result.residentStepParticleScale?.schema)
      .toBe('peercompute.ulg.mls-mpm-g2p-particle-scale-stability.v0');
    expect(result.residentStepParticleScale?.status).toBe('gpu-g2p-cap-policy-applied-in-shader');
    expect(result.residentStepParticleScale?.maxRadiusGrowthRatioAllowed).toBe(4);
    expect(result.residentStepParticleScale?.maxVolumeRatioJAllowed).toBe(64);
    expect(result.residentProductMassStatus).toBe(expectedProductMassStatus);
    expect(result.residentProductRows).toBeGreaterThan(0);
    expect([0, null]).toContain(result.residentProductEventRecordCount);
    expect(result.residentGasPressure?.status).toBe('gpu-resident-pressure-interface-spatial-gas-summary');
    expect(result.residentGasPressure?.source).toBe('gpu-resident-pressure-interface-spatial-gas-ledger');
    expect(result.residentGasPressure?.pressureInterfaceSpatialGasLedgerPromoted).toBe(true);
    expect(result.residentGasPressure?.pressureInterfaceSpatialGasLedgerCellCount).toBeGreaterThan(0);
    expect(result.residentGasPressure?.pressureInterfaceSpatialGasSpeciesRowCount).toBeGreaterThan(0);
    expect(result.residentGasPressure?.totalPressurePa).toBeGreaterThan(101325);
    expect(result.residentGasPressure?.residentProductMassStatus).toBe(expectedProductMassStatus);
    expect(result.residentGasPressure?.spatialGasSpeciesLedgerStatus).toBe('spatial-gas-species-ledger-ready');
    expect(result.residentGasPressure?.spatialGasSpeciesLedgerCellCount).toBeGreaterThan(0);
    expect(result.residentGasPressure?.residentSpatialGasSpeciesLedgerStatus)
      .toBe('spatial-gas-species-ledger-ready');
    expect(result.residentGasPressure?.pressureFeedbackGasCellLocalReady).toBe(true);
    expect(result.residentGasPressure?.pressureFeedbackGasCellSpatialStatus)
      .toBe('resident-spatial-gas-species-ledger-eos-ready');
    if (expectPressureInterface) {
      if (result.pressureInterfaceState?.spatialGasLedgerProducerStageRequestStatus != null) {
        expect(result.pressureInterfaceState?.spatialGasLedgerProducerStageRequestStatus)
          .toBe('spatial-gas-ledger-producer-stage-result-ready');
        expect(result.pressureInterfaceState?.spatialGasLedgerProducerStageSpatialLedgerCellCount).toBeGreaterThan(0);
        expect(result.pressureInterfaceState?.spatialGasLedgerProducerAggregateFallbackUsed).toBe(false);
        expect(result.pressureInterfaceState?.spatialGasLedgerProducerSpatialGasLedgerDerivation)
          .toBe('positioned-product-event-rows');
        expect(result.pressureInterfaceState?.spatialGasLedgerProducerSpatialGasPositionSource)
          .toBe('resident-product-event-row-positions');
        expect(result.pressureInterfaceState?.spatialGasLedgerProducerCompactSpatialGasReadbackByteLength).toBeGreaterThan(0);
        expect(result.pressureInterfaceState?.spatialGasLedgerProducerFullProductEventReadbackPerformed).toBe(false);
      }
      if (result.pressureInterfaceState?.gasCellEosProducerStageRequestStatus != null) {
        expect(result.pressureInterfaceState?.gasCellEosProducerStageRequestStatus)
          .toBe('gas-cell-eos-producer-stage-result-ready');
        expect(result.pressureInterfaceState?.gasCellEosProducerStageSpatialLedgerCellCount).toBeGreaterThan(0);
      }
      if (result.pressureInterfaceState?.pressureInterfaceGasCellFieldImportStatus != null) {
        expect(result.pressureInterfaceState?.pressureInterfaceGasCellFieldImportStatus)
          .toBe('pressure-interface-gas-cell-field-import-ready');
        expect(result.pressureInterfaceState?.pressureInterfaceGasCellFieldImportReady).toBe(true);
      }
    }
    expect(['resident-gpu-render-field', 'resident-gpu-render-rows']).toContain(result.renderState?.source);
    expect(result.renderState?.backend).toBe('webgpu');
    expect(result.renderState?.gasPressureSummaryStatus)
      .toBe('gpu-resident-pressure-interface-spatial-gas-summary');
    expect(result.renderState?.gasPressureSummarySource)
      .toBe('gpu-resident-pressure-interface-spatial-gas-ledger');
    expect(result.renderState?.residentProductMassStatus).toBe(expectedProductMassStatus);
    expect(result.renderState?.residentProductMassEosCouplingStatus).toBe('resident-product-mass-p2g-eos-sidecar-ready');
    if (result.renderState?.source === 'resident-gpu-render-field') {
      expect(result.renderState?.productEventBufferBound).toBe(true);
      expect(result.renderState?.productEventBufferByteLength).toBeGreaterThan(0);
    } else {
      expect(result.renderState?.productEventBufferBound).toBe(false);
      expect(result.renderState?.productEventBufferByteLength).toBe(0);
    }
    expect(result.renderState?.renderRowsParticleScaleStabilityStatus).toEqual(
      expect.stringMatching(/^(particle-scale-bounded|particle-scale-cap-applied|gpu-row-cap-policy-applied-in-shader)$/)
    );
    expect(result.renderState?.renderRowsParticleScaleMaxRadiusGrowthRatioAllowed).toBe(4);
    expect(result.renderState?.renderRowsParticleScaleMaxVolumeRatioJAllowed).toBe(64);
    expect(result.renderState?.renderRowsParticleScaleMaxSupportRadiusM).toBeGreaterThan(0);
    expect(result.renderState?.renderRowsParticleScaleMaxGasParticleRadiusM).toBeGreaterThan(0);
    if (result.renderState?.renderRowsDecodedMaxParticleRadiusM == null) {
      expect(expectContinuation).toBe(true);
    } else {
      expect(result.renderState.renderRowsDecodedMaxParticleRadiusM).toBeGreaterThan(0);
      expect(result.renderState.renderRowsDecodedMaxParticleRadiusM)
        .toBeLessThanOrEqual(result.renderState.renderRowsParticleScaleMaxSupportRadiusM + 1e-6);
      if (expectDecodedMaxUnderGasCap) {
        expect(result.renderState.renderRowsDecodedMaxParticleRadiusM)
          .toBeLessThanOrEqual(result.renderState.renderRowsParticleScaleMaxGasParticleRadiusM + 1e-5);
      }
    }
    if (expectGasRenderRows) {
      expect(Object.keys(result.renderState?.renderRowsDecodedMaterialPhaseCounts || {})
        .some((key) => key.endsWith('|gas'))).toBe(true);
    }
    expect(result.renderState?.materialKeys).toEqual(expect.arrayContaining(expectedMaterialKeys));
    expect(result.statusText).toContain('resident product');
    expect(result.statusText).toContain('render pressure  : source=gpu-resident-pressure-interface-spatial-gas-ledger');
  };

  const expectResidentProductCarryForward = (first, continued) => {
    expect(continued.continuedFromResidentState).toBe(true);
    expect(continued.inputResidentProductRows).toBe(first.residentProductRows);
    expect(continued.emittedResidentProductRows).toBeGreaterThan(0);
    expect(continued.mergedResidentProductRows).toBe(continued.residentProductRows);
    expect(continued.residentProductRows)
      .toBe(continued.inputResidentProductRows + continued.emittedResidentProductRows);
    expect(continued.residentProductMassMergeStatus)
      .toBe('resident-product-mass-merged-gpu-resident');
    expect(continued.residentProductMassGenerationCount)
      .toBeGreaterThan(first.residentProductMassGenerationCount);
  };

  const result = await runResidentReactionRefresh('test-na-h2o-resident-product-pressure');
  expectResidentReactionRefresh(result);

  const continued = await runResidentReactionRefresh('test-na-h2o-resident-product-pressure-continued', {
    continueFromResidentState: true
  });
  expectResidentReactionRefresh(continued, {
    expectPressureInterface: false,
    expectContinuation: true,
    expectGasRenderRows: false
  });
  expectResidentProductCarryForward(result, continued);
  expect(continued.residentGasPressure?.totalPressurePa).toBeGreaterThan(101325);
  expect(continued.renderState?.gasPressureSummarySource)
    .toBe('gpu-resident-pressure-interface-spatial-gas-ledger');

  await page.evaluate(() => document.querySelector('#sph-reset')?.click());
  await page.waitForFunction(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const scene = overlay?.__sphScene;
    return Boolean(
      overlay?.__sphResetStatus?.status === 'particle-state-resynced-after-reset'
      && !overlay?.__sphCpuClosureTask?.active
      && scene?.getSphGpuParticleState?.()?.schema
      && scene?.getMlsMpmGpuParticleState?.()?.schema
      && scene?.getSphReactionTable?.()?.reactionCount > 0
      && typeof scene?.refreshMlsMpmResidentSteps === 'function'
      && typeof scene?.refreshSphResidentRenderState === 'function'
    );
  }, null, { timeout: 90_000 });

  const afterReset = await runResidentReactionRefresh('test-na-h2o-resident-product-pressure-after-reset');
  expect(afterReset.resetStatus?.schema).toBe('peercompute.ulg.sph-demo-reset-status.v0');
  expect(afterReset.resetStatus?.status).toBe('particle-state-resynced-after-reset');
  expectResidentReactionRefresh(afterReset, { expectPressureInterface: false });

  await openResidentReactionScenario('K');
  const potassium = await runResidentReactionRefresh('test-k-h2o-resident-product-pressure');
  expectResidentReactionRefresh(potassium, {
    expectedMaterialKeys: ['K', 'h2o', 'koh', 'h2'],
    expectDecodedMaxUnderGasCap: false,
    expectGasRenderRows: false
  });
  const potassiumContinued = await runResidentReactionRefresh('test-k-h2o-resident-product-pressure-continued', {
    continueFromResidentState: true
  });
  expectResidentReactionRefresh(potassiumContinued, {
    expectPressureInterface: false,
    expectedMaterialKeys: ['K', 'h2o', 'koh', 'h2'],
    expectDecodedMaxUnderGasCap: false,
    expectGasRenderRows: false,
    expectContinuation: true
  });
  expectResidentProductCarryForward(potassium, potassiumContinued);
  expect(potassiumContinued.residentGasPressure?.totalPressurePa).toBeGreaterThan(101325);
  expect(potassiumContinued.renderState?.gasPressureSummarySource)
    .toBe('gpu-resident-pressure-interface-spatial-gas-ledger');
  const potassiumLongHorizon = await runResidentReactionRefresh('test-k-h2o-resident-product-pressure-long-horizon', {
    continueFromResidentState: true
  });
  expectResidentReactionRefresh(potassiumLongHorizon, {
    expectPressureInterface: false,
    expectedMaterialKeys: ['K', 'h2o', 'koh', 'h2'],
    expectDecodedMaxUnderGasCap: false,
    expectGasRenderRows: false,
    expectContinuation: true
  });
  expectResidentProductCarryForward(potassiumContinued, potassiumLongHorizon);
  expect(potassiumLongHorizon.residentGasPressure?.totalPressurePa).toBeGreaterThan(101325);
  expect(potassiumLongHorizon.renderState?.gasPressureSummarySource)
    .toBe('gpu-resident-pressure-interface-spatial-gas-ledger');

  await openResidentReactionScenario('Cs');
  const cesium = await runResidentReactionRefresh('test-cs-h2o-resident-product-pressure');
  expectResidentReactionRefresh(cesium, {
    expectedMaterialKeys: ['Cs', 'h2o', 'csoh', 'h2'],
    expectDecodedMaxUnderGasCap: false,
    expectGasRenderRows: false
  });
  const cesiumContinued = await runResidentReactionRefresh('test-cs-h2o-resident-product-pressure-continued', {
    continueFromResidentState: true
  });
  expectResidentReactionRefresh(cesiumContinued, {
    expectPressureInterface: false,
    expectedMaterialKeys: ['Cs', 'h2o', 'csoh', 'h2'],
    expectDecodedMaxUnderGasCap: false,
    expectGasRenderRows: false,
    expectContinuation: true
  });
  expectResidentProductCarryForward(cesium, cesiumContinued);
  expect(cesiumContinued.residentGasPressure?.totalPressurePa).toBeGreaterThan(101325);
  expect(cesiumContinued.renderState?.gasPressureSummarySource)
    .toBe('gpu-resident-pressure-interface-spatial-gas-ledger');
  const cesiumLongHorizon = await runResidentReactionRefresh('test-cs-h2o-resident-product-pressure-long-horizon', {
    continueFromResidentState: true
  });
  expectResidentReactionRefresh(cesiumLongHorizon, {
    expectPressureInterface: false,
    expectedMaterialKeys: ['Cs', 'h2o', 'csoh', 'h2'],
    expectDecodedMaxUnderGasCap: false,
    expectGasRenderRows: false,
    expectContinuation: true
  });
  expectResidentProductCarryForward(cesiumContinued, cesiumLongHorizon);
  expect(cesiumLongHorizon.residentGasPressure?.totalPressurePa).toBeGreaterThan(101325);
  expect(cesiumLongHorizon.renderState?.gasPressureSummarySource)
    .toBe('gpu-resident-pressure-interface-spatial-gas-ledger');

  await openResidentReactionScenario('Ca');
  const calcium = await runResidentReactionRefresh('test-ca-h2o-resident-product-pressure');
  expectResidentReactionRefresh(calcium, {
    expectedMaterialKeys: ['Ca', 'h2o', 'caoh2', 'h2'],
    expectDecodedMaxUnderGasCap: false,
    expectGasRenderRows: false
  });
  const calciumContinued = await runResidentReactionRefresh('test-ca-h2o-resident-product-pressure-continued', {
    continueFromResidentState: true
  });
  expectResidentReactionRefresh(calciumContinued, {
    expectPressureInterface: false,
    expectedMaterialKeys: ['Ca', 'h2o', 'caoh2', 'h2'],
    expectDecodedMaxUnderGasCap: false,
    expectGasRenderRows: false,
    expectContinuation: true
  });
  expectResidentProductCarryForward(calcium, calciumContinued);
  expect(calciumContinued.residentGasPressure?.totalPressurePa).toBeGreaterThan(101325);
  expect(calciumContinued.renderState?.gasPressureSummarySource)
    .toBe('gpu-resident-pressure-interface-spatial-gas-ledger');
  const calciumLongHorizon = await runResidentReactionRefresh('test-ca-h2o-resident-product-pressure-long-horizon', {
    continueFromResidentState: true
  });
  expectResidentReactionRefresh(calciumLongHorizon, {
    expectPressureInterface: false,
    expectedMaterialKeys: ['Ca', 'h2o', 'caoh2', 'h2'],
    expectDecodedMaxUnderGasCap: false,
    expectGasRenderRows: false,
    expectContinuation: true
  });
  expectResidentProductCarryForward(calciumContinued, calciumLongHorizon);
  expect(calciumLongHorizon.residentGasPressure?.totalPressurePa).toBeGreaterThan(101325);
  expect(calciumLongHorizon.renderState?.gasPressureSummarySource)
    .toBe('gpu-resident-pressure-interface-spatial-gas-ledger');
  expect(consoleIssues).toEqual([]);
});

test('SPH phase mounted non-water binary reactions retain condensed product events', async ({ page }) => {
  test.setTimeout(360_000);
  const consoleIssues = [];
  page.on('console', (message) => {
    const text = message.text();
    if (/Invalid Buffer|Invalid BindGroup|Invalid CommandBuffer|Error while parsing WGSL|too many warnings|used in submit while destroyed/i.test(text)) {
      consoleIssues.push(text);
    }
  });

  const runCondensedBinaryScenario = async ({
    dropMaterial,
    baseMaterial = 'o2',
    dropTemperatureK = 1800,
    baseTemperatureK = 293.15,
    expectedProductKey,
    expectedProductFormula,
    expectedEquation,
    expectedMaterialKeys
  }) => {
  await page.goto(`/?drop=${encodeURIComponent(dropMaterial)}&base=${encodeURIComponent(baseMaterial)}&dropt=${dropTemperatureK}&baset=${baseTemperatureK}&iceh=0&ironh=1.01&dropn=2&basen=4&boxx=4&boxy=4&boxz=4&mech=sph&residentAuto=0&visualCapture=1&blob=1`);
  if (await page.locator('#sph-phase-overlay').count() === 0) {
    await page.locator('#run-sph-phase').click();
  }
  await expect(page.locator('#sph-phase-overlay')).toBeVisible();
  await page.waitForFunction(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const scene = overlay?.__sphScene;
    return Boolean(
      !overlay?.__sphCpuClosureTask?.active
      && scene?.getSphGpuParticleState?.()?.schema
      && scene?.getMlsMpmGpuParticleState?.()?.schema
      && scene?.getSphReactionTable?.()?.reactionCount > 0
      && typeof scene?.refreshMlsMpmResidentSteps === 'function'
      && typeof scene?.refreshSphResidentRenderState === 'function'
      && typeof overlay?.__sphUpdateResidentGasPressureSummary === 'function'
    );
  }, null, { timeout: 180_000 });

  const result = await page.evaluate(async ({ productKey }) => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const scene = overlay.__sphScene;
    const reactionTable = scene.getSphReactionTable?.() || null;
    const execution = await scene.refreshMlsMpmResidentSteps({
      preferWebGpu: true,
      stepCount: 1,
      readbackMode: 'no-full-readback',
      compactSummaryScope: 'particle-visual',
      force: true
    });
    overlay.__mlsMpmResidentSteps = execution;
    overlay.__mlsMpmResidentStep = execution?.finalStep || scene.getMlsMpmResidentStep?.() || null;
    const residentGasPressure = overlay.__sphUpdateResidentGasPressureSummary(overlay.__mlsMpmResidentStep);
    const renderState = await scene.refreshSphResidentRenderState({
      preferWebGpu: true,
      residentSteps: execution,
      materialProperties: overlay.__sphPhaseViewState?.materialProperties || {},
      gasPressureSummary: residentGasPressure,
      renderFieldReadbackMode: 'full-parity-readback',
      renderRowsReadbackMode: 'full-parity-readback'
    });
    scene.refreshViewportAndOverlay?.({ reason: `test-${productKey}-condensed-product-events` });
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const diagnostics = execution?.finalStep?.diagnostics || {};
    const residentProductMass = overlay.__mlsMpmResidentStep?.residentProductMass || null;
    const decodedMaterialPhaseCounts = renderState?.renderRowsDecodedMaterialPhaseCounts || {};
    return {
      status: 'resident-condensed-product-refresh-complete',
      stepBackend: execution?.backend ?? null,
      residentSourceMode: execution?.residentSourceMode ?? null,
      reactionStatus: execution?.finalStep?.stageStatus?.reaction ?? null,
      reactionTable: reactionTable ? {
        status: reactionTable.status ?? null,
        reactionCount: reactionTable.reactionCount ?? 0,
        productTermCount: reactionTable.productTermCount ?? 0,
        gasProductCount: reactionTable.gasProductCount ?? 0,
        productPhaseCount: reactionTable.productPhaseCount ?? 0,
        metadata: (reactionTable.metadata || []).map((entry) => ({
          a: entry.a,
          b: entry.b,
          product: entry.product,
          status: entry.status,
          productTermCount: entry.productTermCount,
          gasProductTermCount: entry.gasProductTermCount,
          equation: entry.stoichiometry?.equation ?? null,
          familyId: entry.stoichiometry?.familyId ?? null,
          atomBalanced: entry.stoichiometry?.atomBalance?.balanced ?? null
        })),
        productTermMetadata: (reactionTable.productTermMetadata || []).map((entry) => ({
          material: entry.material,
          formula: entry.formula,
          routing: entry.routing,
          status: entry.status,
          phaseRecordCount: entry.phaseRecordCount
        })),
        gasProductMetadataCount: reactionTable.gasProductMetadata?.length ?? 0
      } : null,
      residentReactionBinGrid: {
        neighborMode: diagnostics.reactionProposalNeighborMode ?? null,
        status: diagnostics.reactionParticleBinGridStatus ?? null,
        enabled: diagnostics.reactionParticleBinGridEnabled ?? null,
        cellCount: diagnostics.reactionParticleBinGridCellCount ?? 0,
        binCapacity: diagnostics.reactionParticleBinGridBinCapacity ?? 0,
        indexBufferByteLength: diagnostics.reactionParticleBinGridIndexBufferByteLength ?? 0,
        maxContactRadiusM: diagnostics.reactionParticleBinGridMaxContactRadiusM ?? 0,
        overflowMetadataReadbackRequested:
          diagnostics.reactionParticleBinOverflowMetadataReadbackRequested ?? null
      },
      residentStepParticleScale: {
        schema: diagnostics.particleScaleStabilitySchema ?? null,
        status: diagnostics.particleScaleStabilityStatus ?? null,
        maxRadiusGrowthRatioAllowed:
          diagnostics.particleScaleMaxRadiusGrowthRatioAllowed ?? null,
        maxVolumeRatioJAllowed:
          diagnostics.particleScaleMaxVolumeRatioJAllowed ?? null
      },
      residentProductMass: residentProductMass ? {
        status: residentProductMass.status ?? null,
        productEventRowCount: residentProductMass.productEventRowCount ?? 0,
        productEventActiveEventCount: residentProductMass.productEventActiveEventCount ?? null,
        gasSpeciesLedgerCount: residentProductMass.gasSpeciesLedgerCount ?? 0,
        unplacedGasProductMassKg: residentProductMass.unplacedGasProductMassKg ?? null,
        eosCouplingStatus: residentProductMass.eosCouplingStatus ?? null
      } : null,
      diagnostics: {
        reactionSummaryStatus: diagnostics.reactionSummaryStatus ?? null,
        reactionSummaryReadbackMode: diagnostics.reactionSummaryReadbackMode ?? null,
        reactionProductEventRowCount: diagnostics.reactionProductEventRowCount ?? 0,
        reactionResidentProductMassStatus: diagnostics.reactionResidentProductMassStatus ?? null,
        reactionResidentProductMassProductEventRowCount:
          diagnostics.reactionResidentProductMassProductEventRowCount ?? 0,
        reactionResidentProductMassUnplacedGasProductMassKg:
          diagnostics.reactionResidentProductMassUnplacedGasProductMassKg ?? null,
        reactionGasSpeciesLedgerCount: diagnostics.reactionGasSpeciesLedgerCount ?? 0
      },
      residentGasPressure: residentGasPressure ? {
        status: residentGasPressure.status ?? null,
        source: residentGasPressure.source ?? null,
        residentProductMassGasSpeciesLedgerCount:
          residentGasPressure.residentProductMassGasSpeciesLedgerCount ?? null
      } : null,
      renderState: renderState ? {
        source: renderState.source ?? null,
        backend: renderState.backend ?? null,
        residentProductMassStatus: renderState.residentProductMassStatus ?? null,
        residentProductMassEosCouplingStatus:
          renderState.residentProductMassEosCouplingStatus ?? null,
        productEventBufferBound: renderState.productEventBufferBound ?? null,
        productEventBufferByteLength: renderState.productEventBufferByteLength ?? null,
        materialKeys: renderState.materialKeys || [],
        renderRowsDecodedMaterialPhaseCounts: decodedMaterialPhaseCounts,
        renderedProductRows: Object.entries(decodedMaterialPhaseCounts)
          .filter(([key]) => key.startsWith(`${productKey}|`))
          .reduce((sum, [, count]) => sum + count, 0)
      } : null,
      statusText: overlay.querySelector('#sph-status')?.textContent ?? ''
    };
  }, { productKey: expectedProductKey });

  expect(result.status, JSON.stringify(result, null, 2))
    .toBe('resident-condensed-product-refresh-complete');
  expect(result.stepBackend).toBe('webgpu');
  expect(result.residentSourceMode).toBe('cpu-packed-state');
  expect(result.reactionStatus).toBe('reaction-step-executed');
  expect(['derived-reaction-table-ready', 'static-table-cache-hit'])
    .toContain(result.reactionTable?.status);
  expect(result.reactionTable?.reactionCount).toBe(1);
  expect(result.reactionTable?.productTermCount).toBe(1);
  expect(result.reactionTable?.gasProductCount).toBe(0);
  expect(result.reactionTable?.productPhaseCount).toBeGreaterThan(0);
  expect(result.reactionTable?.gasProductMetadataCount).toBe(0);
  expect(result.reactionTable?.metadata?.[0]).toEqual(expect.objectContaining({
    a: dropMaterial,
    b: baseMaterial,
    product: expectedProductKey,
    status: 1,
    productTermCount: 1,
    gasProductTermCount: 0,
    equation: expectedEquation,
    familyId: 'binary-ionic-synthesis',
    atomBalanced: true
  }));
  expect(result.reactionTable?.productTermMetadata?.[0]).toEqual(expect.objectContaining({
    material: expectedProductKey,
    formula: expectedProductFormula,
    routing: 'condensed',
    status: 1
  }));
  expect(result.reactionTable?.productTermMetadata?.[0]?.phaseRecordCount).toBeGreaterThan(0);
  expect(result.residentReactionBinGrid?.neighborMode)
    .toBe('fixed-capacity-particle-bin-grid');
  expect(result.residentReactionBinGrid?.status)
    .toBe('reaction-particle-bin-grid-prepared');
  expect(result.residentReactionBinGrid?.enabled).toBe(true);
  expect(result.residentReactionBinGrid?.cellCount).toBeGreaterThan(0);
  expect(result.residentReactionBinGrid?.binCapacity).toBeGreaterThan(0);
  expect(result.residentReactionBinGrid?.indexBufferByteLength).toBeGreaterThan(0);
  expect(result.residentReactionBinGrid?.maxContactRadiusM).toBeGreaterThan(0);
  expect(result.residentReactionBinGrid?.overflowMetadataReadbackRequested).toBe(false);
  expect(result.residentStepParticleScale?.schema)
    .toBe('peercompute.ulg.mls-mpm-g2p-particle-scale-stability.v0');
  expect(result.residentStepParticleScale?.status)
    .toBe('gpu-g2p-cap-policy-applied-in-shader');
  expect(result.residentStepParticleScale?.maxRadiusGrowthRatioAllowed).toBe(4);
  expect(result.residentStepParticleScale?.maxVolumeRatioJAllowed).toBe(64);
  expect(result.diagnostics?.reactionSummaryStatus)
    .toBe('reaction-resident-product-event-buffer-ready');
  expect(result.diagnostics?.reactionSummaryReadbackMode)
    .toBe('resident-product-event-buffer-no-readback');
  expect(result.diagnostics?.reactionProductEventRowCount).toBeGreaterThan(0);
  expect(result.diagnostics?.reactionResidentProductMassStatus)
    .toBe('resident-product-mass-buffer-retained');
  expect(result.diagnostics?.reactionResidentProductMassProductEventRowCount)
    .toBe(result.diagnostics?.reactionProductEventRowCount);
  expect(result.diagnostics?.reactionResidentProductMassUnplacedGasProductMassKg).toBe(0);
  expect(result.diagnostics?.reactionGasSpeciesLedgerCount).toBe(0);
  expect(result.residentProductMass?.status).toBe('resident-product-mass-buffer-retained');
  expect(result.residentProductMass?.productEventRowCount).toBeGreaterThan(0);
  expect(result.residentProductMass?.gasSpeciesLedgerCount).toBe(0);
  expect(result.residentProductMass?.unplacedGasProductMassKg).toBe(0);
  expect(result.residentProductMass?.eosCouplingStatus)
    .toBe('resident-product-mass-p2g-eos-sidecar-ready');
  expect(result.residentGasPressure?.source).toBe('baseline-no-resident-reaction-ledger');
  expect(result.residentGasPressure?.residentProductMassGasSpeciesLedgerCount)
    .toBe(null);
  expect(result.renderState?.source).toBe('resident-gpu-render-field');
  expect(result.renderState?.backend).toBe('webgpu');
  expect(result.renderState?.residentProductMassStatus)
    .toBe('resident-product-mass-buffer-retained');
  expect(result.renderState?.residentProductMassEosCouplingStatus)
    .toBe('resident-product-mass-p2g-eos-sidecar-ready');
  expect(result.renderState?.productEventBufferBound).toBe(true);
  expect(result.renderState?.productEventBufferByteLength).toBeGreaterThan(0);
  expect(result.renderState?.materialKeys)
    .toEqual(expect.arrayContaining(expectedMaterialKeys));
  expect(result.renderState?.renderedProductRows).toBeGreaterThan(0);
  expect(result.statusText).toContain('resident product');
  expect(result.statusText).toContain(`reaction         : ${dropMaterial}+${baseMaterial}`);
  };

  await runCondensedBinaryScenario({
    dropMaterial: 'Mg',
    expectedProductKey: 'mgo',
    expectedProductFormula: 'MgO',
    expectedEquation: '2 Mg + O2 -> 2 MgO',
    expectedMaterialKeys: ['Mg', 'o2', 'mgo']
  });
  await runCondensedBinaryScenario({
    dropMaterial: 'Al',
    dropTemperatureK: 3200,
    expectedProductKey: 'al2o3',
    expectedProductFormula: 'Al2O3',
    expectedEquation: '4 Al + 3 O2 -> 2 Al2O3',
    expectedMaterialKeys: ['Al', 'o2', 'al2o3']
  });
  await runCondensedBinaryScenario({
    dropMaterial: 'Na',
    baseMaterial: 'cl2',
    dropTemperatureK: 500,
    expectedProductKey: 'nacl',
    expectedProductFormula: 'NaCl',
    expectedEquation: '2 Na + Cl2 -> 2 NaCl',
    expectedMaterialKeys: ['Na', 'cl2', 'nacl']
  });
  expect(consoleIssues).toEqual([]);
});

test('SPH phase no-full render refresh can skip compact surface summary readback', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1.01&dropn=3&basen=5&boxx=5&boxy=5&boxz=5&residentAuto=0&visualCapture=1');
  if (await page.locator('#sph-phase-overlay').count() === 0) {
    await page.locator('#run-sph-phase').click();
  }
  await expect(page.locator('#sph-phase-overlay')).toBeVisible();
  await page.waitForFunction(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const scene = overlay?.__sphScene;
    return Boolean(
      !overlay?.__sphCpuClosureTask?.active
      && scene?.getSphGpuParticleState?.()?.schema
      && scene?.getMlsMpmGpuParticleState?.()?.schema
      && typeof scene?.refreshMlsMpmResidentSteps === 'function'
      && typeof scene?.refreshSphResidentRenderState === 'function'
      && typeof scene?.refreshSphResidentMaterialInterfaceState === 'function'
      && typeof scene?.refreshSphResidentPressureInterfaceState === 'function'
      && typeof overlay?.__sphUpdateResidentGasPressureSummary === 'function'
    );
  }, null, { timeout: 90_000 });

  const result = await page.evaluate(async () => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const scene = overlay.__sphScene;
    const execution = await scene.refreshMlsMpmResidentSteps({
      preferWebGpu: true,
      stepCount: 1,
      readbackMode: 'no-full-readback',
      compactSummaryScope: 'particle-visual',
      force: true
    });
    overlay.__mlsMpmResidentSteps = execution;
    overlay.__mlsMpmResidentStep = scene.getMlsMpmResidentStep?.() || execution?.finalStep || null;
    const residentGasPressure = overlay.__sphUpdateResidentGasPressureSummary(overlay.__mlsMpmResidentStep)
      || overlay.__sphResidentGasPressureSummary
      || overlay.__sphPhaseViewState?.gasPressureSummary
      || null;
    const materialInterfaceState = await scene.refreshSphResidentMaterialInterfaceState({
      preferWebGpu: true,
      residentSteps: execution,
      materialProperties: overlay.__sphPhaseViewState?.materialProperties || {},
      gasPressureSummary: residentGasPressure,
      source: 'test-resident-physics-material-interface-before-skipped-render',
      sourceCadence: 'resident-physics-before-skipped-render'
    });
    const pressureAdmission = {
      schema: 'peercompute.ulg.pressure-interface-grid-force-consumption-admission.v0',
      status: 'pressure-interface-grid-force-consumption-approved',
      gridForceApplicationApproved: true,
      committed: true,
      hotBufferKey: 'ulg:test:pressure-before-skipped-render',
      sourceHotBufferKey: 'ulg:test:pressure-before-skipped-render',
      pressureInterfaceForceRowCount: 1_000_000,
      outputFamilies: ['pressure-interface-force-rows']
    };
    const pressureInterfaceBeforeSkippedRender = await scene.refreshSphResidentPressureInterfaceState({
      preferWebGpu: true,
      materialInterfaceField: materialInterfaceState,
      gasPressureSummary: residentGasPressure,
      pressureInterfaceGridForceAdmission: pressureAdmission,
      source: 'test-resident-pressure-interface-before-skipped-render',
      sourceCadence: 'resident-physics-before-skipped-render'
    });
    const summarizePressureInterfaceState = (state) => state ? {
      schema: state.schema ?? null,
      status: state.status ?? null,
      source: state.source ?? null,
      sourceCadence: state.sourceCadence ?? null,
      solverStatus: state.pressureInterfaceForceSolverStatus ?? null,
      solverForceRowCount: state.pressureInterfaceSolverForceRowCount ?? null,
      forceRowsUploadStatus: state.pressureInterfaceForceRowsUploadStatus ?? null,
      forceRowsBufferRetained: state.pressureInterfaceForceRowsBufferRetained ?? null,
      forceRowsBufferByteLength: state.pressureInterfaceForceRowsBufferByteLength ?? null,
      gridForceAdmissionApproved: state.pressureInterfaceGridForceAdmissionApproved ?? null,
      gridForceAdmissionStatus: state.pressureInterfaceGridForceAdmissionStatus ?? null,
      uploadQueueCompletionStatus: state.pressureInterfaceForceRowsUploadQueueCompletionStatus ?? null,
      uploadQueueCompletionMethod: state.pressureInterfaceForceRowsUploadQueueCompletionMethod ?? null
    } : null;
    const pressureInterfaceBeforeSkippedRenderSummary =
      summarizePressureInterfaceState(pressureInterfaceBeforeSkippedRender);
    const renderState = await scene.refreshSphResidentRenderState({
      preferWebGpu: true,
      residentSteps: execution,
      renderFieldReadbackMode: 'no-full-readback',
      renderRowsReadbackMode: 'no-full-readback',
      renderFieldSurfaceSummaryMode: 'skip',
      skipPressureInterfaceRefresh: true
    });
    overlay.__sphResidentRenderState = renderState;
    overlay.__sphResidentSurfaceDraw = scene.getSphResidentSurfaceDraw?.() || null;
    const pressureInterfaceAfterSkippedRender = scene.getSphResidentPressureInterfaceState?.()
      || overlay.__sphResidentPressureInterfaceState
      || null;
    const pressureInterfaceAfterSkippedRenderSummary =
      summarizePressureInterfaceState(pressureInterfaceAfterSkippedRender);
    const followupExecution = await scene.refreshMlsMpmResidentSteps({
      preferWebGpu: true,
      stepCount: 1,
      readbackMode: 'no-full-readback',
      compactSummaryScope: 'particle-visual',
      continueFromResidentState: true,
      force: true,
      gasPressureSummary: residentGasPressure
    });
    const followupStep = followupExecution?.finalStep || null;
    scene.refreshViewportAndOverlay?.({ reason: 'test-no-full-render-summary-skip' });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const residentSurfaceDraw = overlay.__sphResidentSurfaceDraw;
    const residentSurfaceDrawExecution = residentSurfaceDraw?.surfaceDraw || null;
    const residentSurface = residentSurfaceDrawExecution?.surfaces?.[0] || null;
    return {
      stepBackend: execution?.backend ?? null,
      stepReadbackMode: execution?.readbackMode ?? null,
      compactSummaryScope: execution?.compactSummaryScope ?? null,
      materialInterfaceStateStatus: materialInterfaceState?.status ?? null,
      materialInterfaceReadySurfaceCount: materialInterfaceState?.readySurfaceCount ?? null,
      materialInterfaceRenderRowsReadback: materialInterfaceState?.renderRowsReadback ?? null,
      materialInterfaceRenderFieldReadback: materialInterfaceState?.renderFieldReadback ?? null,
      pressureBeforeSkippedRender: pressureInterfaceBeforeSkippedRenderSummary,
      pressureAfterSkippedRender: pressureInterfaceAfterSkippedRenderSummary,
      followupPressure: {
        backend: followupExecution?.backend ?? null,
        readbackMode: followupExecution?.readbackMode ?? null,
        finalStepStatus: followupStep?.status ?? null,
        forceRowCount: followupStep?.pressureInterfaceForceRowCount
          ?? followupStep?.diagnostics?.pressureInterfaceForceRowCount
          ?? null,
        forceConsumerStatus: followupStep?.pressureInterfaceForceConsumerStatus
          ?? followupStep?.diagnostics?.pressureInterfaceForceConsumerStatus
          ?? null,
        forceApplicationStatus: followupStep?.pressureInterfaceForceApplicationStatus
          ?? followupStep?.diagnostics?.pressureInterfaceForceApplicationStatus
          ?? null,
        gridForceAdmissionApproved: followupStep?.pressureInterfaceGridForceAdmissionApproved
          ?? followupStep?.diagnostics?.pressureInterfaceGridForceAdmissionApproved
          ?? null,
        appliedImpulseMagnitudeNSeconds: followupStep?.pressureInterfaceAppliedImpulseMagnitudeNSeconds
          ?? followupStep?.diagnostics?.pressureInterfaceAppliedImpulseMagnitudeNSeconds
          ?? null
      },
      renderFieldReadback: renderState?.renderFieldReadback ?? null,
      renderRowsReadback: renderState?.renderRowsReadback ?? null,
      renderRowsReadbackMode: renderState?.renderRowsReadbackMode ?? null,
      renderRowsReadbackByteLength: renderState?.renderRowsReadbackByteLength ?? null,
      renderFieldSurfaceSummaryMode: renderState?.renderFieldSurfaceSummaryMode ?? null,
      renderFieldSurfaceSummarySkipped: renderState?.renderFieldSurfaceSummarySkipped ?? null,
      renderFieldSurfaceSummaryReadback: renderState?.renderFieldSurfaceSummaryReadback ?? null,
      renderFieldSurfaceSummaryByteLength: renderState?.renderFieldSurfaceSummaryByteLength ?? null,
      renderFieldSurfaceSummarySkipReason: renderState?.renderFieldSurfaceSummarySkipReason ?? null,
      residentPressureInterfaceStateStatus: renderState?.residentPressureInterfaceStateStatus ?? null,
      residentPressureInterfaceStateSource: renderState?.residentPressureInterfaceStateSource ?? null,
      residentPressureInterfaceStateSourceCadence:
        renderState?.residentPressureInterfaceStateSourceCadence ?? null,
      surfaceDrawStatus: renderState?.surfaceDrawStatus ?? null,
      surfaceDrawVisibleRendererBridge: renderState?.surfaceDrawVisibleRendererBridge ?? null,
      surfaceDrawVisibleRenderSource: renderState?.surfaceDrawVisibleRenderSource ?? null,
      renderFieldBufferMode: renderState?.renderFieldBufferMode ?? null,
      surfaceDrawRenderFieldRowsBufferRetained: renderState?.surfaceDrawRenderFieldRowsBufferRetained ?? null,
      surfaceDrawRenderFieldRowsBufferByteLength: renderState?.surfaceDrawRenderFieldRowsBufferByteLength ?? null,
      surfaceDrawRenderFieldSurfaceBufferRetained:
        renderState?.surfaceDrawRenderFieldSurfaceBufferRetained ?? null,
      surfaceDrawRenderFieldSurfaceBufferByteLength:
        renderState?.surfaceDrawRenderFieldSurfaceBufferByteLength ?? null,
      surfaceDrawRenderFieldBufferVolumeDescriptorSchema:
        renderState?.surfaceDrawRenderFieldBufferVolumeDescriptorSchema ?? null,
      surfaceDrawRenderFieldBufferVolumeDescriptorStatus:
        renderState?.surfaceDrawRenderFieldBufferVolumeDescriptorStatus ?? null,
      surfaceDrawRenderFieldBufferVolumeDescriptorCount:
        renderState?.surfaceDrawRenderFieldBufferVolumeDescriptorCount ?? null,
      surfaceDrawRenderFieldBufferVolumeDescriptorReadyCount:
        renderState?.surfaceDrawRenderFieldBufferVolumeDescriptorReadyCount ?? null,
      surfaceDrawRenderFieldBufferVolumeDescriptorNativeConsumerKind:
        renderState?.surfaceDrawRenderFieldBufferVolumeDescriptorNativeConsumerKind ?? null,
      surfaceDrawRenderFieldBufferVolumeDescriptorNativeRequiredAdapter:
        renderState?.surfaceDrawRenderFieldBufferVolumeDescriptorNativeRequiredAdapter ?? null,
      surfaceDrawRenderFieldBufferVolumeDescriptors:
        renderState?.surfaceDrawRenderFieldBufferVolumeDescriptors ?? null,
      surfaceDrawRowsBufferRetained: renderState?.surfaceDrawRowsBufferRetained ?? null,
      surfaceDrawRowsBufferByteLength: renderState?.surfaceDrawRowsBufferByteLength ?? null,
      surfaceDrawIndirectRowsBufferRetained: renderState?.surfaceDrawIndirectRowsBufferRetained ?? null,
      surfaceDrawIndirectRowsBufferByteLength: renderState?.surfaceDrawIndirectRowsBufferByteLength ?? null,
      surfaceDrawCompactedVertexRowsBufferRetained:
        renderState?.surfaceDrawCompactedVertexRowsBufferRetained ?? null,
      surfaceDrawCompactedVertexRowsBufferByteLength:
        renderState?.surfaceDrawCompactedVertexRowsBufferByteLength ?? null,
      surfaceDrawGpuBufferHandoffReady: renderState?.surfaceDrawGpuBufferHandoffReady ?? null,
      surfaceDrawGpuBufferHandoffStatus: renderState?.surfaceDrawGpuBufferHandoffStatus ?? null,
      surfaceDrawGpuBufferHandoffKind: renderState?.surfaceDrawGpuBufferHandoffKind ?? null,
      surfaceDrawGpuBufferHandoffInputSchema: renderState?.surfaceDrawGpuBufferHandoffInputSchema ?? null,
      surfaceDrawGpuBufferHandoffRequiresSurfaceExtraction:
        renderState?.surfaceDrawGpuBufferHandoffRequiresSurfaceExtraction ?? null,
      surfaceDrawGpuBufferHandoffSurfaceExtractionInputKind:
        renderState?.surfaceDrawGpuBufferHandoffSurfaceExtractionInputKind ?? null,
      surfaceDrawGpuBufferHandoffSurfaceExtractionInputLayout:
        renderState?.surfaceDrawGpuBufferHandoffSurfaceExtractionInputLayout ?? null,
      surfaceDrawGpuBufferHandoffSurfaceExtractionConsumerKind:
        renderState?.surfaceDrawGpuBufferHandoffSurfaceExtractionConsumerKind ?? null,
      surfaceDrawGpuBufferHandoffSurfaceExtractionRequiredAdapter:
        renderState?.surfaceDrawGpuBufferHandoffSurfaceExtractionRequiredAdapter ?? null,
      surfaceDrawGpuBufferHandoffSurfaceExtractionBridgeStatus:
        renderState?.surfaceDrawGpuBufferHandoffSurfaceExtractionBridgeStatus ?? null,
      surfaceDrawGpuBufferHandoffSurfaceExtractionBridgeReason:
        renderState?.surfaceDrawGpuBufferHandoffSurfaceExtractionBridgeReason ?? null,
      surfaceDrawGpuBufferHandoffNoFullReadback: renderState?.surfaceDrawGpuBufferHandoffNoFullReadback ?? null,
      surfaceDrawGpuBufferHandoffNoSummaryReadback:
        renderState?.surfaceDrawGpuBufferHandoffNoSummaryReadback ?? null,
      surfaceDrawVisibleGpuConsumerReady: renderState?.surfaceDrawVisibleGpuConsumerReady ?? null,
      surfaceDrawVisibleGpuConsumerStatus: renderState?.surfaceDrawVisibleGpuConsumerStatus ?? null,
      surfaceDrawVisibleGpuConsumerReason: renderState?.surfaceDrawVisibleGpuConsumerReason ?? null,
      surfaceDrawVisibleGpuConsumerInputReady: renderState?.surfaceDrawVisibleGpuConsumerInputReady ?? null,
      surfaceDrawVisibleGpuConsumerInputKind: renderState?.surfaceDrawVisibleGpuConsumerInputKind ?? null,
      surfaceDrawVisibleGpuConsumerInputStatus: renderState?.surfaceDrawVisibleGpuConsumerInputStatus ?? null,
      surfaceDrawVisibleGpuConsumerRuntimeReady:
        renderState?.surfaceDrawVisibleGpuConsumerRuntimeReady ?? null,
      surfaceDrawVisibleGpuConsumerRenderBridgeMode:
        renderState?.surfaceDrawVisibleGpuConsumerRenderBridgeMode ?? null,
      surfaceDrawVisibleGpuConsumerRenderBridgeStatus:
        renderState?.surfaceDrawVisibleGpuConsumerRenderBridgeStatus ?? null,
      surfaceDrawVisibleGpuConsumerRendererCapabilityStatus:
        renderState?.surfaceDrawVisibleGpuConsumerRendererCapabilityStatus ?? null,
      surfaceDrawVisibleGpuConsumerPixelValidationStatus:
        renderState?.surfaceDrawVisibleGpuConsumerPixelValidationStatus ?? null,
      surfaceDrawVisibleGpuConsumerNativeValidationBlockerFamily:
        renderState?.surfaceDrawVisibleGpuConsumerNativeValidationBlockerFamily ?? null,
      surfaceDrawNativeMarchingCubesExtractionStatus:
        renderState?.surfaceDrawNativeMarchingCubesExtractionStatus ?? null,
      surfaceDrawNativeMarchingCubesExtractionReason:
        renderState?.surfaceDrawNativeMarchingCubesExtractionReason ?? null,
      surfaceDrawNativeMarchingCubesVolumeSourceType:
        renderState?.surfaceDrawNativeMarchingCubesVolumeSourceType ?? null,
      surfaceDrawNativeMarchingCubesVolumeScalarLayoutName:
        renderState?.surfaceDrawNativeMarchingCubesVolumeScalarLayoutName ?? null,
      surfaceDrawNativeMarchingCubesDescriptorPolicyStatus:
        renderState?.surfaceDrawRenderFieldBufferVolumeDescriptors?.[0]?.surfaceExtractionPolicyStatus ?? null,
      surfaceDrawNativeMarchingCubesDescriptorPolicyRowsSchema:
        renderState?.surfaceDrawRenderFieldBufferVolumeDescriptors?.[0]?.surfaceExtractionPolicyRowsSchema ?? null,
      surfaceDrawNativeMarchingCubesDescriptorPolicyRowSchema:
        renderState?.surfaceDrawRenderFieldBufferVolumeDescriptors?.[0]?.surfaceExtractionPolicyRowSchema ?? null,
      surfaceDrawNativeMarchingCubesDescriptorPolicyRole:
        renderState?.surfaceDrawRenderFieldBufferVolumeDescriptors?.[0]?.surfaceExtractionPolicyRole ?? null,
      surfaceDrawNativeMarchingCubesDescriptorPolicyMaterial:
        renderState?.surfaceDrawRenderFieldBufferVolumeDescriptors?.[0]?.surfaceExtractionPolicyMaterial ?? null,
      surfaceDrawNativeMarchingCubesDescriptorPolicyPhase:
        renderState?.surfaceDrawRenderFieldBufferVolumeDescriptors?.[0]?.surfaceExtractionPolicyPhase ?? null,
      surfaceDrawNativeMarchingCubesDescriptorPolicyIsovaluePolicy:
        renderState?.surfaceDrawRenderFieldBufferVolumeDescriptors?.[0]?.surfaceExtractionPolicyIsovaluePolicy ?? null,
      surfaceDrawNativeMarchingCubesDescriptorPolicySmoothingRadiusM:
        renderState?.surfaceDrawRenderFieldBufferVolumeDescriptors?.[0]?.surfaceExtractionPolicySmoothingRadiusM ?? null,
      surfaceDrawNativeMarchingCubesDescriptorPolicyVoxelSizeM:
        renderState?.surfaceDrawRenderFieldBufferVolumeDescriptors?.[0]?.surfaceExtractionPolicyVoxelSizeM ?? null,
      surfaceDrawNativeMarchingCubesDescriptorPolicyNormalScaleM:
        renderState?.surfaceDrawRenderFieldBufferVolumeDescriptors?.[0]?.surfaceExtractionPolicyNormalScaleM ?? null,
      surfaceDrawExtensionSurfaceAdapterExecutionStatus:
        renderState?.surfaceDrawExtensionSurfaceAdapterExecutionStatus ?? null,
      surfaceDrawExtensionSurfaceRawExecutionStatus:
        renderState?.surfaceDrawExtensionSurfaceRawExecutionStatus ?? null,
      surfaceDrawExtensionSurfaceRawVertexCount:
        renderState?.surfaceDrawExtensionSurfaceRawVertexCount ?? null,
      surfaceDrawExtensionSurfacePositionTransformStatus:
        renderState?.surfaceDrawExtensionSurfacePositionTransformStatus ?? null,
      surfaceDrawExtensionSurfacePositionTransform:
        renderState?.surfaceDrawExtensionSurfacePositionTransform ?? null,
      residentSurfaceDrawActiveSurfaceCount: residentSurfaceDrawExecution?.activeSurfaceCount ?? null,
      residentSurfaceDrawVertexCount: residentSurfaceDrawExecution?.vertexCount ?? null,
      residentSurfaceDrawTriangleCount: residentSurfaceDrawExecution?.triangleCount ?? null,
      residentSurfaceDrawPositionClampStatus: residentSurfaceDrawExecution?.positionClampStatus ?? null,
      residentSurfaceVertexOffset: residentSurface?.vertexOffset ?? null,
      residentSurfaceVertexCount: residentSurface?.vertexCount ?? null,
      residentSurfaceTriangleCount: residentSurface?.triangleCount ?? null,
      residentSurfaceBoundsCenterM: residentSurface?.boundsCenterM ?? null,
      residentSurfaceBoundsRadiusM: residentSurface?.boundsRadiusM ?? null,
      surfaceDrawRenderBridgeStatus: renderState?.surfaceDrawRenderBridgeStatus ?? null,
      surfaceDrawRenderBridgeEngineIntegration: renderState?.surfaceDrawRenderBridgeEngineIntegration ?? null,
      surfaceDrawSummaryReadback: renderState?.surfaceDrawSummaryReadback ?? null,
      fullSurfaceDrawReadback: renderState?.fullSurfaceDrawReadback ?? null
    };
  });

  expect(result.stepBackend).toBe('webgpu');
  expect(result.stepReadbackMode).toBe('no-full-readback');
  expect(result.compactSummaryScope).toBe('particle-visual');
  expect(result.materialInterfaceStateStatus).toBe('material-interface-field-ready');
  expect(result.materialInterfaceReadySurfaceCount).toBeGreaterThan(0);
  expect(result.pressureBeforeSkippedRender?.schema)
    .toBe('peercompute.ulg.sph-resident-pressure-interface-state.v0');
  expect(result.pressureBeforeSkippedRender?.status)
    .toBe('resident-pressure-interface-force-rows-ready');
  expect(result.pressureBeforeSkippedRender?.source)
    .toBe('test-resident-pressure-interface-before-skipped-render');
  expect(result.pressureBeforeSkippedRender?.sourceCadence)
    .toBe('resident-physics-before-skipped-render');
  expect(result.pressureBeforeSkippedRender?.solverStatus).toBe('pressure-interface-force-solver-ready');
  expect(result.pressureBeforeSkippedRender?.solverForceRowCount).toBeGreaterThan(0);
  expect(result.pressureBeforeSkippedRender?.forceRowsUploadStatus)
    .toBe('webgpu-pressure-interface-force-rows-uploaded');
  expect(result.pressureBeforeSkippedRender?.forceRowsBufferRetained).toBe(true);
  expect(result.pressureBeforeSkippedRender?.forceRowsBufferByteLength).toBeGreaterThan(0);
  expect(result.pressureBeforeSkippedRender?.gridForceAdmissionApproved).toBe(true);
  expect(result.pressureBeforeSkippedRender?.gridForceAdmissionStatus)
    .toBe('pressure-interface-grid-force-consumption-approved');
  expect(result.pressureBeforeSkippedRender?.uploadQueueCompletionStatus).toBe('queue-write-enqueued');
  expect(result.pressureBeforeSkippedRender?.uploadQueueCompletionMethod).toBe('queue.writeBuffer');
  expect(result.renderFieldReadback).toBe(false);
  expect(result.renderRowsReadback).toBe(false);
  expect(result.renderRowsReadbackMode).toBe('no-full-readback');
  expect(result.renderRowsReadbackByteLength).toBe(0);
  expect(result.renderFieldSurfaceSummaryMode).toBe('skip');
  expect(result.renderFieldSurfaceSummarySkipped).toBe(true);
  expect(result.renderFieldSurfaceSummaryReadback).toBe(false);
  expect(result.renderFieldSurfaceSummaryByteLength).toBe(0);
  expect(result.renderFieldSurfaceSummarySkipReason).toContain('no compact surface-summary readback');
  expect(result.residentPressureInterfaceStateStatus).toBe('pressure-interface-refresh-skipped');
  expect(result.residentPressureInterfaceStateSource).toBe('resident-render-validation');
  expect(result.residentPressureInterfaceStateSourceCadence).toBe('visual-render-refresh');
  expect(result.pressureAfterSkippedRender?.status)
    .toBe('resident-pressure-interface-force-rows-ready');
  expect(result.pressureAfterSkippedRender?.source)
    .toBe('test-resident-pressure-interface-before-skipped-render');
  expect(result.pressureAfterSkippedRender?.sourceCadence)
    .toBe('resident-physics-before-skipped-render');
  expect(result.pressureAfterSkippedRender?.solverForceRowCount).toBeGreaterThan(0);
  expect(result.pressureAfterSkippedRender?.forceRowsBufferRetained).toBe(true);
  expect(result.pressureAfterSkippedRender?.forceRowsBufferByteLength).toBeGreaterThan(0);
  expect(result.followupPressure.backend).toBe('webgpu');
  expect(result.followupPressure.readbackMode).toBe('no-full-readback');
  expect(result.followupPressure.finalStepStatus).toBe('resident-step-webgpu-executed');
  expect(result.followupPressure.forceRowCount).toBeGreaterThan(0);
  expect(result.followupPressure.gridForceAdmissionApproved).toBe(true);
  expect(result.followupPressure.forceApplicationStatus)
    .toBe('pressure-interface-grid-force-consumer-submitted-unverified');
  expect(result.followupPressure.forceConsumerStatus)
    .toBe('grid-momentum-impulse-submitted-unverified-no-full-readback');
  expect(result.followupPressure.appliedImpulseMagnitudeNSeconds).toBeGreaterThan(0);
  expect(result.surfaceDrawStatus).toBe('resident-extension-surface-draw-buffers-retained');
  expect(result.surfaceDrawVisibleRendererBridge).toBe('extension-resident-surface-buffers-no-overlay');
  expect(result.surfaceDrawVisibleRenderSource).toBe('webgpu-marching-cubes-extension-same-device-surface');
  expect(result.renderFieldBufferMode).toBe('native-marching-cubes-buffer-volume-extracted');
  expect(result.surfaceDrawRenderFieldRowsBufferRetained).toBe(false);
  expect(result.surfaceDrawRenderFieldRowsBufferByteLength).toBe(0);
  expect(result.surfaceDrawRenderFieldSurfaceBufferRetained).toBe(false);
  expect(result.surfaceDrawRenderFieldSurfaceBufferByteLength).toBe(0);
  expect(result.surfaceDrawRenderFieldBufferVolumeDescriptorSchema)
    .toBe('peercompute.ulg.sph-render-field-buffer-volume-descriptors.v0');
  expect(result.surfaceDrawRenderFieldBufferVolumeDescriptorStatus)
    .toBe('render-field-buffer-volume-descriptors-ready');
  expect(result.surfaceDrawRenderFieldBufferVolumeDescriptorCount).toBeGreaterThan(0);
  expect(result.surfaceDrawRenderFieldBufferVolumeDescriptorReadyCount)
    .toBe(result.surfaceDrawRenderFieldBufferVolumeDescriptorCount);
  expect(result.surfaceDrawRenderFieldBufferVolumeDescriptorNativeConsumerKind)
    .toBe('native-webgpu-marching-cubes-buffer-volume');
  expect(result.surfaceDrawRenderFieldBufferVolumeDescriptorNativeRequiredAdapter)
    .toBe('webgpu-marching-cubes.buffer-volume.v0');
  expect(result.surfaceDrawRenderFieldBufferVolumeDescriptors?.[0]?.sourceType).toBe('scalar-buffer');
  expect(result.surfaceDrawRenderFieldBufferVolumeDescriptors?.[0]?.scalarLayoutName)
    .toBe('peercompute.webgpu-marching-cubes.layout.scalar-field-f32.v0');
  expect(result.surfaceDrawRenderFieldBufferVolumeDescriptors?.[0]?.scalarStrides?.length).toBe(3);
  expect(result.surfaceDrawRenderFieldBufferVolumeDescriptors?.[0]?.positionTransformStatus)
    .toBe('ulg-render-field-grid-to-world-transform-ready');
  expect(result.surfaceDrawRowsBufferRetained).toBe(true);
  expect(result.surfaceDrawRowsBufferByteLength).toBeGreaterThan(0);
  expect(result.surfaceDrawIndirectRowsBufferRetained).toBe(true);
  expect(result.surfaceDrawIndirectRowsBufferByteLength).toBeGreaterThan(0);
  expect(result.surfaceDrawCompactedVertexRowsBufferRetained).toBe(true);
  expect(result.surfaceDrawCompactedVertexRowsBufferByteLength).toBeGreaterThan(0);
  expect(result.surfaceDrawGpuBufferHandoffReady).toBe(true);
  expect(result.surfaceDrawGpuBufferHandoffStatus).toBe('resident-surface-buffer-direct-consumer-ready');
  expect(result.surfaceDrawGpuBufferHandoffKind).toBe('surface-draw-buffers');
  expect(result.surfaceDrawGpuBufferHandoffInputSchema).toBe('peercompute.ulg.sph-gpu-render-surface-draw.v0');
  expect(result.surfaceDrawGpuBufferHandoffRequiresSurfaceExtraction).toBe(false);
  expect(result.surfaceDrawGpuBufferHandoffSurfaceExtractionInputKind).toBe('surface-draw-compact-position-buffer');
  expect(result.surfaceDrawGpuBufferHandoffSurfaceExtractionInputLayout)
    .toBe('peercompute.webgpu-marching-cubes.compact-position-rows.v0');
  expect(result.surfaceDrawGpuBufferHandoffSurfaceExtractionConsumerKind)
    .toBe('direct-gpu-draw-consumer');
  expect(result.surfaceDrawGpuBufferHandoffSurfaceExtractionRequiredAdapter).toBe(null);
  expect(result.surfaceDrawGpuBufferHandoffSurfaceExtractionBridgeStatus)
    .toBe('surface-extraction-not-required');
  expect(result.surfaceDrawGpuBufferHandoffSurfaceExtractionBridgeReason).toBe(null);
  expect(result.surfaceDrawGpuBufferHandoffNoFullReadback).toBe(true);
  expect(result.surfaceDrawGpuBufferHandoffNoSummaryReadback).toBe(true);
  expect(result.surfaceDrawVisibleGpuConsumerReady).toBe(false);
  expect(result.surfaceDrawVisibleGpuConsumerStatus)
    .toBe('resident-surface-visible-gpu-consumer-blocked-renderer-capability');
  expect(result.surfaceDrawVisibleGpuConsumerReason).toContain('same-device GPUBuffer geometry');
  expect(result.surfaceDrawVisibleGpuConsumerInputReady).toBe(true);
  expect(result.surfaceDrawVisibleGpuConsumerInputKind).toBe('surface-draw-buffers');
  expect(result.surfaceDrawVisibleGpuConsumerInputStatus)
    .toBe('resident-surface-buffer-direct-consumer-ready');
  expect(result.surfaceDrawVisibleGpuConsumerRuntimeReady).toBe(false);
  expect(result.surfaceDrawVisibleGpuConsumerRenderBridgeMode)
    .toBe('extension-resident-surface-buffers-no-overlay');
  expect(result.surfaceDrawVisibleGpuConsumerRenderBridgeStatus)
    .toBe('extension-surface-buffers-retained-no-overlay');
  expect(result.surfaceDrawVisibleGpuConsumerRendererCapabilityStatus)
    .toBe('same-device-gpu-buffer-geometry-blocked-webgl-renderer');
  expect(result.surfaceDrawVisibleGpuConsumerPixelValidationStatus).toBe('not-run');
  expect(result.surfaceDrawNativeMarchingCubesExtractionStatus)
    .toBe('extension-surface-ready-needs-ulg-row-translation');
  expect(result.surfaceDrawNativeMarchingCubesExtractionReason).toBe(null);
  expect(result.surfaceDrawNativeMarchingCubesVolumeSourceType).toBe('scalar-buffer');
  expect(result.surfaceDrawNativeMarchingCubesVolumeScalarLayoutName)
    .toBe('peercompute.webgpu-marching-cubes.layout.scalar-field-f32.v0');
  expect(result.surfaceDrawNativeMarchingCubesDescriptorPolicyStatus)
    .toBe('algorithm-surface-policy-row-selected');
  expect(result.surfaceDrawNativeMarchingCubesDescriptorPolicyRowsSchema)
    .toBe('peercompute.ulg.algorithm-material-surface-extraction-rows.v0');
  expect(result.surfaceDrawNativeMarchingCubesDescriptorPolicyRowSchema)
    .toBe('peercompute.ulg.algorithm-material-surface-extraction-row.v0');
  expect(['drop', 'base']).toContain(result.surfaceDrawNativeMarchingCubesDescriptorPolicyRole);
  expect(['h2o', 'fe']).toContain(result.surfaceDrawNativeMarchingCubesDescriptorPolicyMaterial);
  expect(result.surfaceDrawNativeMarchingCubesDescriptorPolicyPhase).toBeTruthy();
  expect(result.surfaceDrawNativeMarchingCubesDescriptorPolicyIsovaluePolicy)
    .toBe('density-kernel-half-occupancy');
  expect(result.surfaceDrawNativeMarchingCubesDescriptorPolicySmoothingRadiusM).toBeGreaterThan(0);
  expect(result.surfaceDrawNativeMarchingCubesDescriptorPolicyVoxelSizeM).toBeGreaterThan(0);
  expect(result.surfaceDrawNativeMarchingCubesDescriptorPolicyNormalScaleM).toBeGreaterThan(0);
  expect(result.surfaceDrawExtensionSurfaceAdapterExecutionStatus)
    .toBe('extension-surface-ready-needs-ulg-row-translation');
  expect(result.surfaceDrawExtensionSurfaceRawExecutionStatus).toBe('surface-ready');
  expect(result.surfaceDrawExtensionSurfaceRawVertexCount).toBeGreaterThan(0);
  expect(result.surfaceDrawExtensionSurfacePositionTransformStatus)
    .toBe('ulg-render-field-grid-to-world-transform-ready');
  expect(result.surfaceDrawExtensionSurfacePositionTransform?.enabled).toBe(true);
  expect(result.residentSurfaceDrawActiveSurfaceCount).toBe(1);
  expect(result.residentSurfaceDrawVertexCount).toBeGreaterThan(0);
  expect(result.residentSurfaceDrawTriangleCount).toBeGreaterThan(0);
  expect(result.residentSurfaceDrawPositionClampStatus).toBe('position-clamp-ready');
  expect(result.residentSurfaceVertexOffset).toBe(0);
  expect(result.residentSurfaceVertexCount).toBe(result.residentSurfaceDrawVertexCount);
  expect(result.residentSurfaceTriangleCount).toBe(result.residentSurfaceDrawTriangleCount);
  expect(result.residentSurfaceBoundsCenterM).toEqual([2.5, 2.5, 2.5]);
  expect(result.residentSurfaceBoundsRadiusM).toBeCloseTo(Math.hypot(2.5, 2.5, 2.5), 5);
  expect(result.surfaceDrawRenderBridgeStatus).toBe('extension-surface-buffers-retained-no-overlay');
  expect(result.surfaceDrawRenderBridgeEngineIntegration).toBe('three-renderer-owned-scene-state-no-overlay');
  expect(result.surfaceDrawSummaryReadback).toBe(false);
  expect(result.fullSurfaceDrawReadback).toBe(false);
});

test('SPH phase records surface-buffer presentation opt-in without enabling WebGL external buffers', async ({ page }) => {
  await page.goto('/?renderer=webgl&surfaceBufferPresentation=1&residentAuto=0');
  if (await page.locator('#sph-phase-overlay').count() === 0) {
    await page.locator('#run-sph-phase').click();
  }
  await expect(page.locator('#sph-phase-overlay')).toBeVisible();
  const result = await page.evaluate(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const scene = overlay?.__sphScene;
    const rendererInit = scene?.scene?.userData?.sphRendererInit || null;
    const capability = scene?.scene?.userData?.sphResidentExtensionSurfaceRendererCapability || null;
    return {
      hash: window.location.hash,
      rendererBackend: rendererInit?.rendererBackend ?? null,
      rendererSurfaceBufferPresentationRequested:
        rendererInit?.rendererSurfaceBufferPresentationRequested ?? null,
      rendererSurfaceBufferPresentationEnabled:
        rendererInit?.rendererSurfaceBufferPresentationEnabled ?? null,
      capabilityRendererBackend: capability?.rendererBackend ?? null,
      capabilityStatus: capability?.status ?? null,
      capabilityExternalBufferPresentationEnabled:
        capability?.externalBufferPresentationEnabled ?? null,
      capabilityVisibleNoReadbackSupported: capability?.visibleNoReadbackSupported ?? null
    };
  });

  expect(result.hash).toContain('surfaceBufferPresentation=1');
  expect(result.rendererBackend).toBe('three-webgl');
  expect(result.rendererSurfaceBufferPresentationRequested).toBe(true);
  expect(result.rendererSurfaceBufferPresentationEnabled).toBe(false);
  expect(result.capabilityRendererBackend).toBe('three-webgl');
  expect(result.capabilityStatus).toBe('same-device-gpu-buffer-geometry-blocked-webgl-renderer');
  expect(result.capabilityExternalBufferPresentationEnabled).toBe(false);
  expect(result.capabilityVisibleNoReadbackSupported).toBe(false);
});

test('SPH phase native same-device surface consumer publishes browser-frame validation readiness', async ({ page }) => {
  test.setTimeout(240_000);
  const consoleIssues = [];
  page.on('console', (message) => {
    const text = message.text();
    if (/Invalid Buffer|Invalid BindGroup|Invalid CommandBuffer|Error while parsing WGSL|too many warnings|used in submit while destroyed/i.test(text)) {
      consoleIssues.push(text);
    }
  });

  await page.goto('/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1.01&dropn=2&basen=3&boxx=4&boxy=4&boxz=4&mech=mlsmpm&residentAuto=0&visualCapture=1&renderer=native-webgpu&surfaceDraw=native-webgpu-surface-consumer');
  await ensureSphPhaseOverlayVisible(page, { timeout: 180_000 });
  await page.waitForFunction(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const scene = overlay?.__sphScene;
    return Boolean(
      scene?.getSphGpuParticleState?.()?.schema
      && scene?.getMlsMpmGpuParticleState?.()?.schema
      && typeof scene?.refreshMlsMpmResidentSteps === 'function'
      && typeof scene?.refreshSphResidentRenderState === 'function'
      && typeof scene?.publishSphNativeWebGpuSurfaceConsumerBrowserFrameValidation === 'function'
    );
  }, null, { timeout: 180_000 });

  const result = await page.evaluate(async () => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const scene = overlay.__sphScene;
    const refreshNativeBatch = async ({ continueFromResidentState, reason }) => {
      const execution = await scene.refreshMlsMpmResidentSteps({
        preferWebGpu: true,
        stepCount: 1,
        readbackMode: 'no-full-readback',
        compactSummaryScope: 'particle-visual',
        continueFromResidentState,
        force: true
      });
      overlay.__mlsMpmResidentSteps = execution;
      overlay.__mlsMpmResidentStep = execution?.finalStep || scene.getMlsMpmResidentStep?.() || null;
      const renderState = await scene.refreshSphResidentRenderState({
        preferWebGpu: true,
        residentSteps: execution,
        materialProperties: overlay.__sphPhaseViewState?.materialProperties || {},
        gasPressureSummary:
          overlay.__sphResidentGasPressureSummary
          || overlay.__sphPhaseViewState?.gasPressureSummary
          || null,
        renderFieldReadbackMode: 'no-full-readback',
        renderRowsReadbackMode: 'no-full-readback',
        renderFieldSurfaceSummaryMode: 'skip',
        surfaceDrawDiagnosticMode: 'native-webgpu-surface-consumer',
        allowNativeSurfaceExtraction: true
      });
      overlay.__sphResidentRenderState = renderState;
      overlay.__sphResidentSurfaceDraw = scene.getSphResidentSurfaceDraw?.() || null;
      scene.refreshViewportAndOverlay?.({ reason });
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return {
        execution,
        renderState,
        bridge: scene.getSphResidentSurfaceDrawRenderBridge?.() || null
      };
    };
    const firstBatch = await refreshNativeBatch({
      continueFromResidentState: false,
      reason: 'test-native-same-device-surface-consumer-first-batch'
    });
    const secondBatch = await refreshNativeBatch({
      continueFromResidentState: true,
      reason: 'test-native-same-device-surface-consumer-continuation'
    });
    const publishResult = scene.publishSphNativeWebGpuSurfaceConsumerBrowserFrameValidation({
      status: 'passed',
      reason: 'playwright browser-frame validation evidence for same-device native surface route',
      source: 'playwright-same-device-native-route',
      width: 16,
      height: 16,
      nonzeroPixelCount: 64,
      pixelCount: 256,
      sample: [64, 96, 128, 255]
    });
    const afterRenderState = scene.getSphResidentRenderState?.() || secondBatch.renderState;
    const surfaceDraw = scene.getSphResidentSurfaceDraw?.() || overlay.__sphResidentSurfaceDraw || null;
    const bridge = scene.getSphResidentSurfaceDrawRenderBridge?.() || null;
    return {
      rendererBackend: scene.scene?.userData?.sphRendererBackend ?? null,
      stepBackend: secondBatch.execution?.backend ?? null,
      stepReadbackMode: secondBatch.execution?.readbackMode ?? null,
      finalStepStatus: secondBatch.execution?.finalStep?.status ?? null,
      firstBatchStatus: firstBatch.execution?.status ?? null,
      firstBatchCompletedStepCount: firstBatch.execution?.completedStepCount ?? null,
      firstBatchContinuedFromResidentState:
        firstBatch.execution?.continuedFromResidentState ?? null,
      firstBatchContinuationAvailable:
        firstBatch.execution?.continuationAvailable ?? null,
      firstBatchNextStep:
        firstBatch.execution?.finalStep?.diagnostics?.nextStep
        ?? firstBatch.execution?.finalStep?.particlePingPong?.nextStep
        ?? null,
      secondBatchStatus: secondBatch.execution?.status ?? null,
      secondBatchCompletedStepCount: secondBatch.execution?.completedStepCount ?? null,
      secondBatchContinuedFromResidentState:
        secondBatch.execution?.continuedFromResidentState ?? null,
      secondBatchContinuationAvailable:
        secondBatch.execution?.continuationAvailable ?? null,
      secondBatchNextStep:
        secondBatch.execution?.finalStep?.diagnostics?.nextStep
        ?? secondBatch.execution?.finalStep?.particlePingPong?.nextStep
        ?? null,
      firstBatchImportStatus:
        firstBatch.renderState?.surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportStatus ?? null,
      secondBatchImportStatus:
        secondBatch.renderState?.surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportStatus ?? null,
      renderStateStatus: afterRenderState?.status ?? null,
      renderStateSource: afterRenderState?.source ?? null,
      surfaceDrawDiagnosticMode: afterRenderState?.surfaceDrawDiagnosticMode ?? null,
      renderFieldReadback: afterRenderState?.renderFieldReadback ?? null,
      renderRowsReadback: afterRenderState?.renderRowsReadback ?? null,
      renderRowsReadbackMode: afterRenderState?.renderRowsReadbackMode ?? null,
      renderFieldSurfaceSummaryMode: afterRenderState?.renderFieldSurfaceSummaryMode ?? null,
      renderFieldSurfaceSummarySkipped: afterRenderState?.renderFieldSurfaceSummarySkipped ?? null,
      surfaceDrawStatus: afterRenderState?.surfaceDrawStatus ?? null,
      surfaceDrawVisibleRendererBridge: afterRenderState?.surfaceDrawVisibleRendererBridge ?? null,
      surfaceDrawVisibleRenderSource: afterRenderState?.surfaceDrawVisibleRenderSource ?? null,
      surfaceDrawRenderBridgeStatus: afterRenderState?.surfaceDrawRenderBridgeStatus ?? null,
      surfaceDrawRenderBridgeEngineIntegration:
        afterRenderState?.surfaceDrawRenderBridgeEngineIntegration ?? null,
      surfaceDrawGpuBufferHandoffReady: afterRenderState?.surfaceDrawGpuBufferHandoffReady ?? null,
      surfaceDrawGpuBufferHandoffKind: afterRenderState?.surfaceDrawGpuBufferHandoffKind ?? null,
      surfaceDrawGpuBufferHandoffNoFullReadback:
        afterRenderState?.surfaceDrawGpuBufferHandoffNoFullReadback ?? null,
      surfaceDrawGpuBufferHandoffNoSummaryReadback:
        afterRenderState?.surfaceDrawGpuBufferHandoffNoSummaryReadback ?? null,
      visibleGpuConsumerReady: afterRenderState?.surfaceDrawVisibleGpuConsumerReady ?? null,
      visibleGpuConsumerStatus: afterRenderState?.surfaceDrawVisibleGpuConsumerStatus ?? null,
      visibleGpuConsumerRuntimeReady:
        afterRenderState?.surfaceDrawVisibleGpuConsumerRuntimeReady ?? null,
      visibleGpuConsumerRenderBridgeMode:
        afterRenderState?.surfaceDrawVisibleGpuConsumerRenderBridgeMode ?? null,
      visibleGpuConsumerRenderBridgeStatus:
        afterRenderState?.surfaceDrawVisibleGpuConsumerRenderBridgeStatus ?? null,
      visibleGpuConsumerRendererCapabilityStatus:
        afterRenderState?.surfaceDrawVisibleGpuConsumerRendererCapabilityStatus ?? null,
      visibleGpuConsumerPixelValidationStatus:
        afterRenderState?.surfaceDrawVisibleGpuConsumerPixelValidationStatus ?? null,
      visibleGpuConsumerSameDeviceMainThreadImportSelected:
        afterRenderState?.surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportSelected ?? null,
      visibleGpuConsumerSameDeviceMainThreadImportRoute:
        afterRenderState?.surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportRoute ?? null,
      visibleGpuConsumerSameDeviceMainThreadImportThread:
        afterRenderState?.surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportThread ?? null,
      visibleGpuConsumerSameDeviceMainThreadImportDeviceScope:
        afterRenderState?.surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportDeviceScope ?? null,
      visibleGpuConsumerSameDeviceMainThreadImportStatus:
        afterRenderState?.surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportStatus ?? null,
      surfaceDrawSameDeviceMainThreadImportStatus:
        surfaceDraw?.surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportStatus ?? null,
      bridgeStatus: bridge?.status ?? null,
      bridgeMode: bridge?.rendererBridge ?? null,
      bridgeLastRenderStatus: bridge?.lastRenderStatus ?? null,
      bridgeFrameCount: bridge?.frameCount ?? null,
      schroederProxyLocalResolverStatus:
        afterRenderState?.surfaceDrawRenderBridgeSchroederRenderProxyLocalResolverStatus
        ?? surfaceDraw?.renderBridgeSchroederRenderProxyLocalResolverStatus
        ?? bridge?.schroederRenderProxyLocalResolverStatus
        ?? null,
      schroederProxyLocalResolverRetainedBufferRefCount:
        afterRenderState?.surfaceDrawRenderBridgeSchroederRenderProxyLocalResolverRetainedBufferRefCount
        ?? surfaceDraw?.renderBridgeSchroederRenderProxyLocalResolverRetainedBufferRefCount
        ?? bridge?.schroederRenderProxyLocalResolverRetainedBufferRefCount
        ?? null,
      schroederProxyNativeExecutorStatus:
        afterRenderState?.surfaceDrawRenderBridgeSchroederRenderProxyNativeExecutorStatus
        ?? surfaceDraw?.renderBridgeSchroederRenderProxyNativeExecutorStatus
        ?? bridge?.schroederRenderProxyNativeExecutorStatus
        ?? null,
      schroederProxyNativeExecutorReady:
        afterRenderState?.surfaceDrawRenderBridgeSchroederRenderProxyNativeExecutorReady
        ?? surfaceDraw?.renderBridgeSchroederRenderProxyNativeExecutorReady
        ?? bridge?.schroederRenderProxyNativeExecutorReady
        ?? null,
      schroederProxyNativeExecutorDrawCommandCount:
        afterRenderState?.surfaceDrawRenderBridgeSchroederRenderProxyNativeExecutorDrawCommandCount
        ?? surfaceDraw?.renderBridgeSchroederRenderProxyNativeExecutorDrawCommandCount
        ?? bridge?.schroederRenderProxyNativeExecutorDrawCommandCount
        ?? null,
      schroederProxyNativeExecutorDrawInstanceCount:
        afterRenderState?.surfaceDrawRenderBridgeSchroederRenderProxyNativeExecutorDrawInstanceCount
        ?? surfaceDraw?.renderBridgeSchroederRenderProxyNativeExecutorDrawInstanceCount
        ?? bridge?.schroederRenderProxyNativeExecutorDrawInstanceCount
        ?? null,
      schroederProxyNativeCameraUpdateStatus:
        afterRenderState?.surfaceDrawRenderBridgeSchroederRenderProxyNativeCameraUpdateStatus
        ?? surfaceDraw?.renderBridgeSchroederRenderProxyNativeCameraUpdateStatus
        ?? bridge?.schroederRenderProxyNativeCameraUpdateStatus
        ?? null,
      schroederProxyNativeLastSubmitStatus:
        afterRenderState?.surfaceDrawRenderBridgeSchroederRenderProxyNativeLastSubmitStatus
        ?? surfaceDraw?.renderBridgeSchroederRenderProxyNativeLastSubmitStatus
        ?? bridge?.lastSchroederRenderProxyNativeSubmitStatus
        ?? null,
      schroederProxyNativeLastSubmitDrawCommandCount:
        afterRenderState?.surfaceDrawRenderBridgeSchroederRenderProxyNativeLastSubmitDrawCommandCount
        ?? surfaceDraw?.renderBridgeSchroederRenderProxyNativeLastSubmitDrawCommandCount
        ?? bridge?.lastSchroederRenderProxyNativeDrawCommandCount
        ?? null,
      schroederProxyNativeLastSubmitDrawInstanceCount:
        afterRenderState?.surfaceDrawRenderBridgeSchroederRenderProxyNativeLastSubmitDrawInstanceCount
        ?? surfaceDraw?.renderBridgeSchroederRenderProxyNativeLastSubmitDrawInstanceCount
        ?? bridge?.lastSchroederRenderProxyNativeDrawInstanceCount
        ?? null,
      publishStatus: publishResult?.status ?? null,
      publishVisibleGpuConsumerReady: publishResult?.visibleGpuConsumerReady ?? null,
      publishSource: publishResult?.source ?? null,
      publishNonzeroPixelCount: publishResult?.nonzeroPixelCount ?? null,
      publishPixelCount: publishResult?.pixelCount ?? null
    };
  });

  expect(result.rendererBackend).toBe('native-webgpu');
  expect(result.stepBackend).toBe('webgpu');
  expect(result.stepReadbackMode).toBe('no-full-readback');
  expect(result.finalStepStatus).toBe('resident-step-webgpu-executed');
  expect(result.firstBatchStatus).toBe('resident-steps-executed');
  expect(result.firstBatchCompletedStepCount).toBe(1);
  expect(result.firstBatchContinuedFromResidentState).toBe(false);
  expect(result.firstBatchContinuationAvailable).toBe(true);
  expect(result.firstBatchNextStep).toBeGreaterThanOrEqual(1);
  expect(result.secondBatchStatus).toBe('resident-steps-executed');
  expect(result.secondBatchCompletedStepCount).toBe(1);
  expect(result.secondBatchContinuedFromResidentState).toBe(true);
  expect(result.secondBatchContinuationAvailable).toBe(true);
  expect(result.secondBatchNextStep).toBeGreaterThan(result.firstBatchNextStep);
  expect([
    'same-device-main-thread-import-awaiting-pixel-validation',
    'same-device-main-thread-import-ready'
  ]).toContain(result.firstBatchImportStatus);
  expect([
    'same-device-main-thread-import-awaiting-pixel-validation',
    'same-device-main-thread-import-blocked-input-not-ready',
    'same-device-main-thread-import-ready'
  ]).toContain(result.secondBatchImportStatus);
  expect([
    'resident-render-field-applied',
    'resident-render-presentation-worker-retained-output-preserved'
  ]).toContain(result.renderStateStatus);
  expect([
    'resident-gpu-render-field',
    'presentation-worker-retained-output'
  ]).toContain(result.renderStateSource);
  expect(result.surfaceDrawDiagnosticMode).toBe('native-webgpu-surface-consumer');
  expect(result.renderFieldReadback).toBe(false);
  expect(result.renderRowsReadback).toBe(false);
  expect(result.renderRowsReadbackMode).toBe('no-full-readback');
  expect(result.renderFieldSurfaceSummaryMode).toBe('skip');
  expect(result.renderFieldSurfaceSummarySkipped).toBe(true);
  expect(result.surfaceDrawStatus).toBe('resident-extension-surface-draw-buffers-retained');
  expect(result.surfaceDrawVisibleRendererBridge).toBe('native-webgpu-surface-consumer');
  expect(result.surfaceDrawVisibleRenderSource).toBe('resident-surface-draw-native-webgpu-consumer');
  expect(result.surfaceDrawRenderBridgeStatus).toBe('native-webgpu-surface-consumer-ready');
  expect(result.surfaceDrawRenderBridgeEngineIntegration)
    .toBe('native-webgpu-engine-main-canvas-no-overlay');
  expect(result.surfaceDrawGpuBufferHandoffReady).toBe(true);
  expect(result.surfaceDrawGpuBufferHandoffKind).toBe('surface-draw-buffers');
  expect(result.surfaceDrawGpuBufferHandoffNoFullReadback).toBe(true);
  expect(result.surfaceDrawGpuBufferHandoffNoSummaryReadback).toBe(true);
  expect(result.visibleGpuConsumerReady).toBe(true);
  expect(result.visibleGpuConsumerStatus).toBe('resident-surface-visible-gpu-consumer-ready');
  expect(result.visibleGpuConsumerRuntimeReady).toBe(true);
  expect(result.visibleGpuConsumerRenderBridgeMode).toBe('native-webgpu-surface-consumer');
  expect(result.visibleGpuConsumerRenderBridgeStatus).toBe('native-webgpu-surface-consumer-ready');
  expect(result.visibleGpuConsumerRendererCapabilityStatus)
    .toBe('native-webgpu-surface-consumer-supported');
  expect(result.visibleGpuConsumerPixelValidationStatus).toBe('passed');
  expect(result.visibleGpuConsumerSameDeviceMainThreadImportSelected).toBe(true);
  expect(result.visibleGpuConsumerSameDeviceMainThreadImportRoute)
    .toBe('native-webgpu-surface-consumer');
  expect(result.visibleGpuConsumerSameDeviceMainThreadImportThread).toBe('main-thread');
  expect(result.visibleGpuConsumerSameDeviceMainThreadImportDeviceScope)
    .toBe('engine-owned-native-webgpu-canvas-device');
  expect(result.visibleGpuConsumerSameDeviceMainThreadImportStatus)
    .toBe('same-device-main-thread-import-ready');
  expect(result.surfaceDrawSameDeviceMainThreadImportStatus)
    .toBe('same-device-main-thread-import-ready');
  expect(result.bridgeStatus).toBe('native-webgpu-surface-consumer-ready');
  expect(result.bridgeMode).toBe('native-webgpu-surface-consumer');
  expect(result.bridgeLastRenderStatus).toMatch(/^native-webgpu-surface-consumer-/);
  expect(result.bridgeFrameCount).toBeGreaterThan(0);
  expect(result.publishStatus).toBe('browser-frame-validation-passed');
  expect(result.publishVisibleGpuConsumerReady).toBe(true);
  expect(result.publishSource).toBe('playwright-same-device-native-route');
  expect(result.publishNonzeroPixelCount).toBeGreaterThan(0);
  expect(result.publishPixelCount).toBeGreaterThan(result.publishNonzeroPixelCount);
  expect(consoleIssues).toEqual([]);
});

test('SPH phase native surface consumer draws scene-local Schroeder render LOD', async ({ page }) => {
  test.setTimeout(240_000);
  const consoleIssues = [];
  page.on('console', (message) => {
    const text = message.text();
    if (/Invalid Buffer|Invalid BindGroup|Invalid CommandBuffer|Error while parsing WGSL|too many warnings|used in submit while destroyed/i.test(text)) {
      consoleIssues.push(text);
    }
  });

  await page.goto('/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1.01&dropn=2&basen=3&boxx=4&boxy=4&boxz=4&mech=mlsmpm&residentAuto=0&visualCapture=1&renderer=native-webgpu&surfaceDraw=native-webgpu-surface-consumer');
  await ensureSphPhaseOverlayVisible(page, { timeout: 180_000 });
  await page.waitForFunction(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const scene = overlay?.__sphScene;
    return Boolean(
      scene?.getSphGpuParticleState?.()?.schema
      && scene?.getMlsMpmGpuParticleState?.()?.schema
      && typeof scene?.refreshMlsMpmResidentSteps === 'function'
      && typeof scene?.refreshSphResidentRenderState === 'function'
    );
  }, null, { timeout: 180_000 });

  const result = await page.evaluate(async () => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const scene = overlay.__sphScene;
    const execution = await scene.refreshMlsMpmResidentSteps({
      preferWebGpu: true,
      stepCount: 1,
      readbackMode: 'no-full-readback',
      compactSummaryScope: 'particle-visual',
      continueFromResidentState: false,
      force: true,
      schroederSimulation: true,
      schroederSelectedLevel: 0,
      schroederEnablePortableSummary: true,
      schroederEnableActiveNodeIndex: true
    });
    const renderState = await scene.refreshSphResidentRenderState({
      preferWebGpu: true,
      residentSteps: execution,
      materialProperties: overlay.__sphPhaseViewState?.materialProperties || {},
      gasPressureSummary:
        overlay.__sphResidentGasPressureSummary
        || overlay.__sphPhaseViewState?.gasPressureSummary
        || null,
      renderFieldReadbackMode: 'no-full-readback',
      renderRowsReadbackMode: 'no-full-readback',
      renderFieldSurfaceSummaryMode: 'skip',
      surfaceDrawDiagnosticMode: 'native-webgpu-surface-consumer',
      allowNativeSurfaceExtraction: true
    });
    overlay.__mlsMpmResidentSteps = execution;
    overlay.__sphResidentRenderState = renderState;
    scene.refreshViewportAndOverlay?.({ reason: 'test-schroeder-scene-native-render-lod' });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const afterRenderState = scene.getSphResidentRenderState?.() || renderState;
    const surfaceDraw = scene.getSphResidentSurfaceDraw?.() || null;
    const bridge = scene.getSphResidentSurfaceDrawRenderBridge?.() || null;
    const renderSource = scene.scene?.userData?.schroederRenderSource || null;
    const drawSource = scene.scene?.userData?.schroederRenderProxyDrawSource || null;
    const backendSelection = scene.scene?.userData?.schroederRenderProxyBackendSelection || null;
    return {
      executionStatus: execution?.status ?? null,
      executionSchroederSimulation: execution?.schroederSimulation ?? null,
      executionSchroederSequenceStatus: execution?.schroederSameLevelSequenceStatus ?? null,
      schroederStatus: execution?.schroederSameLevelMechanics?.status ?? null,
      portableSummaryStatus: execution?.portableSummary?.status ?? null,
      renderLodStatus: execution?.portableSummary?.renderLodStatus ?? null,
      renderLodActiveLeafProxyCount:
        execution?.portableSummary?.renderLod?.activeLeafProxyCount ?? null,
      localResolverStatus: execution?.schroederLocalRetainedRenderBuffers?.status ?? null,
      localResolverRefCount:
        execution?.schroederLocalRetainedRenderBuffers?.retainedBufferRefs?.length ?? null,
      renderSourceStatus: renderSource?.status ?? null,
      renderSourcePresentationReady: renderSource?.renderLodPresentationReady ?? null,
      drawSourceStatus: drawSource?.status ?? null,
      drawSourceDrawBatchCount: drawSource?.drawBatchCount ?? null,
      backendSelectionStatus: backendSelection?.status ?? null,
      backendSelectedBackend: backendSelection?.selectedBackend ?? null,
      renderStateStatus: afterRenderState?.status ?? null,
      nativeExecutorStatus:
        afterRenderState?.surfaceDrawRenderBridgeSchroederRenderProxyNativeExecutorStatus
        ?? surfaceDraw?.renderBridgeSchroederRenderProxyNativeExecutorStatus
        ?? bridge?.schroederRenderProxyNativeExecutorStatus
        ?? null,
      nativeExecutorReady:
        afterRenderState?.surfaceDrawRenderBridgeSchroederRenderProxyNativeExecutorReady
        ?? surfaceDraw?.renderBridgeSchroederRenderProxyNativeExecutorReady
        ?? bridge?.schroederRenderProxyNativeExecutorReady
        ?? null,
      nativeExecutorDrawCommandCount:
        afterRenderState?.surfaceDrawRenderBridgeSchroederRenderProxyNativeExecutorDrawCommandCount
        ?? surfaceDraw?.renderBridgeSchroederRenderProxyNativeExecutorDrawCommandCount
        ?? bridge?.schroederRenderProxyNativeExecutorDrawCommandCount
        ?? null,
      nativeLastSubmitStatus:
        afterRenderState?.surfaceDrawRenderBridgeSchroederRenderProxyNativeLastSubmitStatus
        ?? surfaceDraw?.renderBridgeSchroederRenderProxyNativeLastSubmitStatus
        ?? bridge?.lastSchroederRenderProxyNativeSubmitStatus
        ?? null,
      nativeLastSubmitDrawCommandCount:
        afterRenderState?.surfaceDrawRenderBridgeSchroederRenderProxyNativeLastSubmitDrawCommandCount
        ?? surfaceDraw?.renderBridgeSchroederRenderProxyNativeLastSubmitDrawCommandCount
        ?? bridge?.lastSchroederRenderProxyNativeDrawCommandCount
        ?? null,
      bridgeStatus: bridge?.status ?? null,
      bridgeFrameCount: bridge?.frameCount ?? null,
      bridgeLastRenderStatus: bridge?.lastRenderStatus ?? null
    };
  });

  expect(result.executionStatus).toBe('resident-steps-executed');
  expect(result.executionSchroederSimulation).toBe(true);
  expect(result.executionSchroederSequenceStatus)
    .toBe('schroeder-same-level-resident-steps-executed');
  expect(result.schroederStatus).toBe('schroeder-same-level-mechanics-submitted');
  expect(result.portableSummaryStatus).toBe('schroeder-portable-summary-plan-ready');
  expect(result.renderLodStatus).toBe('schroeder-render-lod-summary-planned');
  expect(result.renderLodActiveLeafProxyCount).toBeGreaterThan(0);
  expect(result.localResolverStatus).toBe('schroeder-local-retained-render-buffers-ready');
  expect(result.localResolverRefCount).toBeGreaterThan(0);
  expect(result.renderSourceStatus).toBe('schroeder-render-source-local-observation-ready');
  expect(result.renderSourcePresentationReady).toBe(true);
  expect(result.drawSourceStatus).toBe('schroeder-render-proxy-draw-source-ready');
  expect(result.drawSourceDrawBatchCount).toBeGreaterThan(0);
  expect([
    'schroeder-render-proxy-backend-native-webgpu-submit-ready',
    'schroeder-render-proxy-backend-native-webgpu-visible-ready'
  ]).toContain(result.backendSelectionStatus);
  expect(result.backendSelectedBackend).toBe('native-webgpu-retained-proxy');
  expect(result.renderStateStatus).toBe('resident-render-field-applied');
  expect(result.nativeExecutorStatus).toBe('schroeder-render-proxy-native-executor-ready');
  expect(result.nativeExecutorReady).toBe(true);
  expect(result.nativeExecutorDrawCommandCount).toBeGreaterThan(0);
  expect(result.nativeLastSubmitStatus)
    .toBe('schroeder-render-proxy-native-executor-submitted-to-pass');
  expect(result.nativeLastSubmitDrawCommandCount).toBeGreaterThan(0);
  expect(result.bridgeStatus).toBe('native-webgpu-surface-consumer-ready');
  expect(result.bridgeFrameCount).toBeGreaterThan(0);
  expect(result.bridgeLastRenderStatus).toMatch(/^native-webgpu-surface-consumer-/);
  expect(consoleIssues).toEqual([]);
});

test('SPH phase Schroeder phase-volume feedback feeds following resident tick', async ({ page }) => {
  test.setTimeout(240_000);
  const consoleIssues = [];
  page.on('console', (message) => {
    const text = message.text();
    if (/Invalid Buffer|Invalid BindGroup|Invalid CommandBuffer|Error while parsing WGSL|too many warnings|used in submit while destroyed/i.test(text)) {
      consoleIssues.push(text);
    }
  });

  await page.goto('/?drop=h2o&base=h2o&dropt=450&baset=300&iceh=0&ironh=1.01&dropn=2&basen=3&boxx=4&boxy=4&boxz=4&mech=mlsmpm&residentAuto=0&visualCapture=1&renderer=native-webgpu&surfaceDraw=native-webgpu-surface-consumer&ss=1&schroederLevel=0&schroederPortableSummary=1&schroederActiveNodeIndex=1');
  await ensureSphPhaseOverlayVisible(page, { timeout: 180_000 });
  await page.waitForFunction(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const scene = overlay?.__sphScene;
    return Boolean(
      scene?.getSphGpuParticleState?.()?.schema
      && scene?.getMlsMpmGpuParticleState?.()?.schema
      && typeof scene?.refreshMlsMpmResidentSteps === 'function'
      && typeof scene?.getSchroederPhaseVolumeAssignmentOverlayFeedback === 'function'
      && overlay?.__sphPeerComputeResidentAuthorityHost?.status === 'ready'
      && typeof globalThis.__ulgResidentAuthorityHost?.publishSchroederStateDeltaMergeAdmission === 'function'
      && typeof globalThis.__ulgResidentAuthorityHost?.publishSchroederPhaseVolumeMigrationAdmission === 'function'
    );
  }, null, { timeout: 180_000 });

  const result = await page.evaluate(async () => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const scene = overlay.__sphScene;
    const host = globalThis.__ulgResidentAuthorityHost;
    const commonOptions = {
      preferWebGpu: true,
      residentAuthorityHost: host,
      stepCount: 1,
      readbackMode: 'no-full-readback',
      compactSummaryScope: 'particle-visual',
      force: true,
      schroederSimulation: true,
      schroederSelectedLevel: 0,
      schroederEnablePortableSummary: true,
      schroederEnableActiveNodeIndex: true
    };
    const first = await scene.refreshMlsMpmResidentSteps({
      ...commonOptions,
      continueFromResidentState: false
    });
    const firstFeedback = scene.getSchroederPhaseVolumeAssignmentOverlayFeedback?.();
    const firstDiagnostics = scene.getSchroederPhaseVolumeDiagnostics?.();
    const second = await scene.refreshMlsMpmResidentSteps({
      ...commonOptions,
      continueFromResidentState: true
    });
    overlay.__mlsMpmResidentSteps = second;
    overlay.__mlsMpmResidentStep = second?.finalStep || null;
    scene.refreshViewportAndOverlay?.({ reason: 'test-schroeder-phase-volume-feedback' });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const secondFeedback = scene.getSchroederPhaseVolumeAssignmentOverlayFeedback?.();
    const secondDiagnostics = scene.getSchroederPhaseVolumeDiagnostics?.();
    const statusText = overlay.querySelector('#sph-status')?.textContent || '';
    return {
      firstStatus: first?.status ?? null,
      firstPhaseVolumeLevelUpdateStatus:
        first?.schroederSameLevelMechanics?.phaseVolumeLevelUpdateStatus ?? null,
      firstPhaseVolumeLevelUpdateRetainedBuffer:
        first?.schroederSameLevelMechanics?.phaseVolumeLevelUpdateRetainedBuffer ?? null,
      firstStateDeltaAdmissionStatus:
        first?.residentExecutionPolicy?.schroederStateDeltaMergeAdmissionStatus ?? null,
      firstStateDeltaAdmissionPublicationStatus:
        first?.residentExecutionPolicy?.schroederStateDeltaMergeAdmissionPublicationStatus ?? null,
      firstStateDeltaAdmissionSourceHotBufferKey:
        first?.residentExecutionPolicy?.schroederStateDeltaMergeAdmissionSourceHotBufferKey ?? null,
      firstPhaseVolumeAdmissionStatus:
        first?.residentExecutionPolicy?.schroederPhaseVolumeMigrationAdmissionStatus ?? null,
      firstPhaseVolumeAdmissionPublicationStatus:
        first?.residentExecutionPolicy?.schroederPhaseVolumeMigrationAdmissionPublicationStatus ?? null,
      firstPhaseVolumeAdmissionSourceHotBufferKey:
        first?.residentExecutionPolicy?.schroederPhaseVolumeMigrationAdmissionSourceHotBufferKey ?? null,
      firstFeedbackStatus: firstFeedback?.status ?? null,
      firstFeedbackReady: firstFeedback?.ready ?? null,
      firstFeedbackRows: firstFeedback?.levelUpdateRowCount ?? null,
      firstFeedbackRawGpuBufferTransferAllowed:
        firstFeedback?.rawGpuBufferTransferAllowed ?? null,
      firstDiagnosticFeedbackStatus:
        firstDiagnostics?.phaseVolumeAssignmentOverlayFeedbackStatus ?? null,
      secondStatus: second?.status ?? null,
      secondSourceMode: second?.residentSourceMode ?? null,
      secondContinuedFromResidentState: second?.continuedFromResidentState ?? null,
      secondNormalHotLoopReadbackFree: second?.normalHotLoopReadbackFree ?? null,
      secondReadbackMode: second?.readbackMode ?? null,
      secondSchroederStatus: second?.schroederSameLevelMechanics?.status ?? null,
      secondPhaseVolumeAssignmentOverlayStatus:
        second?.schroederSameLevelMechanics?.phaseVolumeAssignmentOverlayStatus ?? null,
      secondPhaseVolumeAssignmentOverlayConsumerStatus:
        second?.schroederSameLevelMechanics?.phaseVolumeAssignmentOverlayConsumerStatus ?? null,
      secondPhaseVolumeAssignmentOverlayEnabled:
        second?.schroederSameLevelMechanics?.phaseVolumeAssignmentOverlayEnabled ?? null,
      secondPhaseVolumeAssignmentOverlayIndexRequired:
        second?.schroederSameLevelMechanics?.phaseVolumeAssignmentOverlayIndexRequired ?? null,
      secondPhaseVolumeAssignmentOverlayIndexEnabled:
        second?.schroederSameLevelMechanics?.phaseVolumeAssignmentOverlayIndexEnabled ?? null,
      secondPhaseVolumeLevelSelectionSource:
        second?.schroederSameLevelMechanics?.phaseVolumeLevelSelectionSource ?? null,
      secondPhaseVolumeNextTickAssignmentOverlayStatus:
        second?.phaseVolumeNextTickAssignmentOverlayStatus
          ?? second?.schroederSameLevelMechanics?.phaseVolumeNextTickAssignmentOverlayStatus
          ?? null,
      secondFeedbackStatus: secondFeedback?.status ?? null,
      secondFeedbackReady: secondFeedback?.ready ?? null,
      secondFeedbackRows: secondFeedback?.levelUpdateRowCount ?? null,
      secondFeedbackRawGpuBufferTransferAllowed:
        secondFeedback?.rawGpuBufferTransferAllowed ?? null,
      secondDiagnosticFeedbackStatus:
        secondDiagnostics?.phaseVolumeAssignmentOverlayFeedbackStatus ?? null,
      secondDiagnosticFeedbackReady:
        secondDiagnostics?.phaseVolumeAssignmentOverlayFeedbackReady ?? null,
      statusTextIncludesFeedback:
        statusText.includes('phase-feedback=ready')
        && statusText.includes('phase-feedback-rows=')
    };
  });

  expect(result.firstStatus).toBe('resident-steps-executed');
  expect(result.firstPhaseVolumeLevelUpdateStatus)
    .toBe('schroeder-phase-volume-level-update-submitted');
  expect(result.firstPhaseVolumeLevelUpdateRetainedBuffer).toBe(true);
  expect(result.firstStateDeltaAdmissionStatus)
    .toBe('schroeder-state-delta-merge-admission-admitted');
  expect(result.firstStateDeltaAdmissionPublicationStatus)
    .toBe('schroeder-state-delta-merge-admission-published');
  expect(result.firstStateDeltaAdmissionSourceHotBufferKey)
    .toContain('ulg:schroeder-state-delta-merge-admission');
  expect(result.firstPhaseVolumeAdmissionStatus)
    .toBe('schroeder-phase-volume-migration-admission-admitted');
  expect(result.firstPhaseVolumeAdmissionPublicationStatus)
    .toBe('schroeder-phase-volume-migration-admission-published');
  expect(result.firstPhaseVolumeAdmissionSourceHotBufferKey)
    .toContain('ulg:schroeder-phase-volume-migration-admission');
  expect(result.firstFeedbackStatus)
    .toBe('schroeder-phase-volume-assignment-overlay-feedback-ready');
  expect(result.firstFeedbackReady).toBe(true);
  expect(result.firstFeedbackRows).toBeGreaterThan(0);
  expect(result.firstFeedbackRawGpuBufferTransferAllowed).toBe(false);
  expect(result.firstDiagnosticFeedbackStatus)
    .toBe('schroeder-phase-volume-assignment-overlay-feedback-ready');
  expect(result.secondStatus).toBe('resident-steps-executed');
  expect(result.secondSourceMode).toBe('previous-gpu-resident-output');
  expect(result.secondContinuedFromResidentState).toBe(true);
  expect(result.secondReadbackMode).toBe('no-full-readback');
  expect(result.secondNormalHotLoopReadbackFree).toBe(true);
  expect(result.secondSchroederStatus).toBe('schroeder-same-level-mechanics-submitted');
  expect(result.secondPhaseVolumeAssignmentOverlayStatus)
    .toBe('schroeder-phase-volume-level-update-assignment-overlay-ready');
  expect(result.secondPhaseVolumeAssignmentOverlayConsumerStatus)
    .toBe('phase-volume-level-update-assignment-overlay-consumed-by-active-node-selection');
  expect(result.secondPhaseVolumeAssignmentOverlayEnabled).toBe(true);
  expect(result.secondPhaseVolumeLevelSelectionSource)
    .toBe('state-manager-admitted-phase-volume-level-update');
  if (result.secondPhaseVolumeAssignmentOverlayIndexRequired) {
    expect(result.secondPhaseVolumeAssignmentOverlayIndexEnabled).toBe(true);
  }
  expect(result.secondFeedbackStatus)
    .toBe('schroeder-phase-volume-assignment-overlay-feedback-ready');
  expect(result.secondFeedbackReady).toBe(true);
  expect(result.secondFeedbackRows).toBeGreaterThan(0);
  expect(result.secondFeedbackRawGpuBufferTransferAllowed).toBe(false);
  expect(result.secondDiagnosticFeedbackStatus)
    .toBe('schroeder-phase-volume-assignment-overlay-feedback-ready');
  expect(result.secondDiagnosticFeedbackReady).toBe(true);
  expect(result.statusTextIncludesFeedback).toBe(true);
  expect(consoleIssues).toEqual([]);
});

test('SPH phase URL Schroeder water-to-steam phase-volume diagnostics stay readback-free', async ({ page }) => {
  test.setTimeout(240_000);
  const consoleIssues = [];
  page.on('console', (message) => {
    const text = message.text();
    if (/Invalid Buffer|Invalid BindGroup|Invalid CommandBuffer|Error while parsing WGSL|too many warnings|used in submit while destroyed/i.test(text)) {
      consoleIssues.push(text);
    }
  });

  await page.goto('/?drop=h2o&base=h2o&dropt=650&baset=300&iceh=0&ironh=1.01&dropn=2&basen=3&boxx=4&boxy=4&boxz=4&mech=mlsmpm&residentAuto=1&residentStepsPerSchedule=1&visualCapture=1&renderer=native-webgpu&surfaceDraw=native-webgpu-surface-consumer&ss=1&schroederLevel=0&schroederMaxLevel=8&schroederPortableSummary=1&schroederActiveNodeIndex=1');
  await ensureSphPhaseOverlayVisible(page, { timeout: 180_000 });
  await page.waitForFunction(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const execution = overlay?.__mlsMpmResidentSteps;
    const diagnostics = execution?.schroederPhaseVolumeDiagnostics
      || execution?.phaseVolumeDiagnostics
      || overlay?.__sphScene?.getSchroederPhaseVolumeDiagnostics?.()
      || null;
    return Boolean(
      execution?.status === 'resident-steps-executed'
      && diagnostics?.phaseVolumeDiagnosticSummaryStatus === 'schroeder-phase-volume-diagnostic-summary-submitted'
    );
  }, null, { timeout: 180_000 });

  const result = await page.evaluate(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const overlay = document.querySelector('#sph-phase-overlay');
    const scene = overlay.__sphScene;
    const execution = overlay.__mlsMpmResidentSteps || scene.getMlsMpmResidentSteps?.() || null;
    const diagnostics = execution?.schroederPhaseVolumeDiagnostics
      || execution?.phaseVolumeDiagnostics
      || scene.getSchroederPhaseVolumeDiagnostics?.()
      || null;
    const statusText = overlay.querySelector('#sph-status')?.textContent || '';
    return {
      executionStatus: execution?.status ?? null,
      phaseVolumeAdmissionStatus:
        execution?.residentExecutionPolicy?.schroederPhaseVolumeMigrationAdmissionStatus ?? null,
      phaseVolumeAdmissionPublicationStatus:
        execution?.residentExecutionPolicy?.schroederPhaseVolumeMigrationAdmissionPublicationStatus ?? null,
      phaseVolumeDiagnosticSummaryStatus:
        diagnostics?.phaseVolumeDiagnosticSummaryStatus ?? null,
      phaseVolumeExpansionDetected:
        diagnostics?.phaseVolumeExpansionDetected ?? null,
      phaseVolumeLevelUpdateChanged:
        diagnostics?.phaseVolumeLevelUpdateChanged ?? null,
      phaseVolumeUpdateEffectStatus:
        diagnostics?.phaseVolumeUpdateEffectStatus ?? null,
      representedToRestVolumeRatio:
        diagnostics?.representedToRestVolumeRatio ?? null,
      expectedLevelDeltaFromVolume:
        diagnostics?.expectedLevelDeltaFromVolume ?? null,
      observedPositiveLevelDelta:
        diagnostics?.observedPositiveLevelDelta ?? null,
      observedPositiveLevelUpdateDelta:
        diagnostics?.observedPositiveLevelUpdateDelta ?? null,
      coarsenEligibleCount:
        diagnostics?.coarsenEligibleCount ?? null,
      refineRequiredCount:
        diagnostics?.refineRequiredCount ?? null,
      aggregateCoherentCount:
        diagnostics?.aggregateCoherentCount ?? null,
      conservationResidualIssueCount:
        diagnostics?.conservationResidualIssueCount ?? null,
      refinePressureCount:
        diagnostics?.refinePressureCount ?? null,
      refinePressureReasonMask:
        diagnostics?.refinePressureReasonMask ?? null,
      refinePressurePolicyStatus:
        diagnostics?.refinePressurePolicyStatus ?? null,
      particleCountGrowthFactor:
        diagnostics?.particleCountGrowthFactor ?? null,
      noFullParticleReadback:
        diagnostics?.noFullParticleReadback ?? null,
      statusTextIncludesPhaseTelemetry:
        statusText.includes('phase-migration=changed')
        && statusText.includes('phase-delta=')
        && statusText.includes('phase-update-delta=')
        && statusText.includes('phase-update=changed')
        && statusText.includes('phase-no-full=true')
    };
  });

  expect(result.executionStatus).toBe('resident-steps-executed');
  expect(result.phaseVolumeAdmissionStatus)
    .toBe('schroeder-phase-volume-migration-admission-admitted');
  expect(result.phaseVolumeAdmissionPublicationStatus)
    .toBe('schroeder-phase-volume-migration-admission-published');
  expect(result.phaseVolumeDiagnosticSummaryStatus)
    .toBe('schroeder-phase-volume-diagnostic-summary-submitted');
  expect(result.phaseVolumeExpansionDetected).toBe(true);
  expect(result.phaseVolumeLevelUpdateChanged).toBe(true);
  expect(result.phaseVolumeUpdateEffectStatus)
    .toBe('admitted-phase-volume-level-update-changed-level');
  expect(result.representedToRestVolumeRatio).toBeGreaterThan(100);
  expect(result.expectedLevelDeltaFromVolume).toBeGreaterThan(2);
  expect(result.observedPositiveLevelDelta).toBeGreaterThan(0);
  expect(result.observedPositiveLevelUpdateDelta).toBe(true);
  expect(result.coarsenEligibleCount).toBeGreaterThan(0);
  expect(result.aggregateCoherentCount).toBeGreaterThan(0);
  expect(result.refineRequiredCount).toBe(0);
  expect(result.conservationResidualIssueCount).toBe(0);
  expect(result.refinePressureCount).toBe(0);
  expect(result.refinePressureReasonMask).toBe(0);
  expect(result.refinePressurePolicyStatus).toBe('phase-volume-refine-pressure-clear');
  expect(result.particleCountGrowthFactor).toBeLessThanOrEqual(1);
  expect(result.noFullParticleReadback).toBe(true);
  expect(result.statusTextIncludesPhaseTelemetry).toBe(true);
  expect(consoleIssues).toEqual([]);
});

test('SPH phase URL Schroeder config drives native resident schedule', async ({ page }) => {
  test.setTimeout(240_000);
  const consoleIssues = [];
  page.on('console', (message) => {
    const text = message.text();
    if (/Invalid Buffer|Invalid BindGroup|Invalid CommandBuffer|Error while parsing WGSL|too many warnings|used in submit while destroyed/i.test(text)) {
      consoleIssues.push(text);
    }
  });

  await page.goto('/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1.01&dropn=2&basen=3&boxx=4&boxy=4&boxz=4&mech=mlsmpm&residentAuto=1&residentStepsPerSchedule=1&visualCapture=1&renderer=native-webgpu&surfaceDraw=native-webgpu-surface-consumer&ss=1&schroederLevel=0&schroederPortableSummary=1&schroederActiveNodeIndex=1');
  await ensureSphPhaseOverlayVisible(page, { timeout: 180_000 });
  await page.waitForFunction(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const execution = overlay?.__mlsMpmResidentSteps;
    const renderState = overlay?.__sphResidentRenderState;
    const scene = overlay?.__sphScene;
    const surfaceDraw = scene?.getSphResidentSurfaceDraw?.() || overlay?.__sphResidentSurfaceDraw || null;
    return Boolean(
      overlay?.__sphSchroederSimulationConfig?.enabled === true
      && overlay?.__mlsMpmSchroederExecutionOptions?.schroederSimulation === true
      && execution?.status === 'resident-steps-executed'
      && execution?.schroederSimulation === true
      && execution?.schroederSameLevelSequenceStatus === 'schroeder-same-level-resident-steps-executed'
      && execution?.portableSummary?.renderLod?.activeLeafProxyCount > 0
      && renderState?.status === 'resident-render-field-applied'
      && (
        renderState?.surfaceDrawRenderBridgeSchroederRenderProxyNativeExecutorReady === true
        || surfaceDraw?.renderBridgeSchroederRenderProxyNativeExecutorReady === true
      )
    );
  }, null, { timeout: 180_000 });

  const result = await page.evaluate(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const overlay = document.querySelector('#sph-phase-overlay');
    const scene = overlay.__sphScene;
    const execution = overlay.__mlsMpmResidentSteps || scene.getMlsMpmResidentSteps?.() || null;
    const renderState = overlay.__sphResidentRenderState || scene.getSphResidentRenderState?.() || null;
    const surfaceDraw = scene.getSphResidentSurfaceDraw?.() || overlay.__sphResidentSurfaceDraw || null;
    const bridge = scene.getSphResidentSurfaceDrawRenderBridge?.() || null;
    const renderSource = scene.getSchroederRenderSource?.() || scene.scene?.userData?.schroederRenderSource || null;
    const drawSource = scene.getSchroederRenderProxyDrawSource?.()
      || scene.scene?.userData?.schroederRenderProxyDrawSource
      || null;
    const backendSelection = scene.getSchroederRenderProxyBackendSelection?.()
      || scene.scene?.userData?.schroederRenderProxyBackendSelection
      || null;
    const statusText = overlay.querySelector('#sph-status')?.textContent || '';
    return {
      hash: window.location.hash,
      config: overlay.__sphSchroederSimulationConfig || null,
      options: overlay.__mlsMpmSchroederExecutionOptions || null,
      autoScheduleStatus: overlay.__mlsMpmResidentAutoSchedule?.status || null,
      autoScheduleResidentAuto: overlay.__mlsMpmResidentAutoSchedule?.residentAuto ?? null,
      pendingSchroederSimulation:
        overlay.__mlsMpmResidentStepsPending?.schroederExecutionOptions?.schroederSimulation ?? null,
      executionStatus: execution?.status ?? null,
      executionSchroederSimulation: execution?.schroederSimulation ?? null,
      executionSchroederSequenceStatus: execution?.schroederSameLevelSequenceStatus ?? null,
      executionResidentComputeManagerMode: execution?.residentComputeManagerMode ?? null,
      portableSummaryStatus: execution?.portableSummary?.status ?? null,
      renderLodStatus: execution?.portableSummary?.renderLodStatus ?? null,
      renderLodSelectedLevel: execution?.portableSummary?.renderLod?.selectedLevel ?? null,
      renderLodNativeGridSpacingM: execution?.portableSummary?.renderLod?.nativeGridSpacingM ?? null,
      renderLodActiveLeafProxyCount:
        execution?.portableSummary?.renderLod?.activeLeafProxyCount ?? null,
      localResolverStatus: execution?.schroederLocalRetainedRenderBuffers?.status ?? null,
      localResolverRefCount:
        execution?.schroederLocalRetainedRenderBuffers?.retainedBufferRefs?.length ?? null,
      renderSourceStatus: renderSource?.status ?? null,
      renderSourcePresentationReady: renderSource?.renderLodPresentationReady ?? null,
      drawSourceStatus: drawSource?.status ?? null,
      drawSourceDrawBatchCount: drawSource?.drawBatchCount ?? null,
      backendSelectionStatus: backendSelection?.status ?? null,
      backendSelectedBackend: backendSelection?.selectedBackend ?? null,
      renderStateStatus: renderState?.status ?? null,
      nativeExecutorReady:
        renderState?.surfaceDrawRenderBridgeSchroederRenderProxyNativeExecutorReady
        ?? surfaceDraw?.renderBridgeSchroederRenderProxyNativeExecutorReady
        ?? bridge?.schroederRenderProxyNativeExecutorReady
        ?? null,
      nativeLastSubmitStatus:
        renderState?.surfaceDrawRenderBridgeSchroederRenderProxyNativeLastSubmitStatus
        ?? surfaceDraw?.renderBridgeSchroederRenderProxyNativeLastSubmitStatus
        ?? bridge?.lastSchroederRenderProxyNativeSubmitStatus
        ?? null,
      nativeLastSubmitDrawCommandCount:
        renderState?.surfaceDrawRenderBridgeSchroederRenderProxyNativeLastSubmitDrawCommandCount
        ?? surfaceDraw?.renderBridgeSchroederRenderProxyNativeLastSubmitDrawCommandCount
        ?? bridge?.lastSchroederRenderProxyNativeDrawCommandCount
        ?? null,
      bridgeStatus: bridge?.status ?? null,
      bridgeFrameCount: bridge?.frameCount ?? null,
      statusTextIncludesSchroederLine:
        statusText.includes('schroeder sim') && statusText.includes('request=on'),
      statusTextIncludesSequence:
        statusText.includes('schroeder-same-level-resident-steps-executed')
    };
  });

  expect(result.hash).toContain('ss=1');
  expect(result.config?.enabled).toBe(true);
  expect(result.config?.source).toBe('url');
  expect(result.config?.selectedLevel).toBe(0);
  expect(result.options?.schroederSimulation).toBe(true);
  expect(result.options?.schroederEnablePortableSummary).toBe(true);
  expect(result.options?.schroederEnableActiveNodeIndex).toBe(true);
  expect(result.autoScheduleResidentAuto).toBe(true);
  expect(result.autoScheduleStatus).toBe('resident-auto-schedule-enabled');
  expect(result.executionStatus).toBe('resident-steps-executed');
  expect(result.executionSchroederSimulation).toBe(true);
  expect(result.executionSchroederSequenceStatus)
    .toBe('schroeder-same-level-resident-steps-executed');
  expect(result.executionResidentComputeManagerMode).toBe('direct-schroeder-scene');
  expect(result.portableSummaryStatus).toBe('schroeder-portable-summary-plan-ready');
  expect(result.renderLodStatus).toBe('schroeder-render-lod-summary-planned');
  expect(result.renderLodSelectedLevel).toBe(0);
  expect(result.renderLodNativeGridSpacingM).toBeGreaterThan(0);
  expect(result.renderLodActiveLeafProxyCount).toBeGreaterThan(0);
  expect(result.localResolverStatus).toBe('schroeder-local-retained-render-buffers-ready');
  expect(result.localResolverRefCount).toBeGreaterThan(0);
  expect(result.renderSourceStatus).toBe('schroeder-render-source-local-observation-ready');
  expect(result.renderSourcePresentationReady).toBe(true);
  expect(result.drawSourceStatus).toBe('schroeder-render-proxy-draw-source-ready');
  expect(result.drawSourceDrawBatchCount).toBeGreaterThan(0);
  expect([
    'schroeder-render-proxy-backend-native-webgpu-submit-ready',
    'schroeder-render-proxy-backend-native-webgpu-visible-ready'
  ]).toContain(result.backendSelectionStatus);
  expect(result.backendSelectedBackend).toBe('native-webgpu-retained-proxy');
  expect(result.renderStateStatus).toBe('resident-render-field-applied');
  expect(result.nativeExecutorReady).toBe(true);
  expect(result.nativeLastSubmitStatus)
    .toBe('schroeder-render-proxy-native-executor-submitted-to-pass');
  expect(result.nativeLastSubmitDrawCommandCount).toBeGreaterThan(0);
  expect(result.bridgeStatus).toBe('native-webgpu-surface-consumer-ready');
  expect(result.bridgeFrameCount).toBeGreaterThan(0);
  expect(result.statusTextIncludesSchroederLine).toBe(true);
  expect(result.statusTextIncludesSequence).toBe(true);
  expect(consoleIssues).toEqual([]);
});

test('SPH WebGPU extension surface translation maps MC grid positions into ULG world meters', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const {
      buildWebGpuMarchingCubesExtensionSurfaceRowsWebGpu
    } = await import('/src/runtime/sph/sphMarchingCubesSurfaceAdapter.js');
    if (!navigator.gpu) return { status: 'webgpu-unavailable', reason: 'navigator.gpu unavailable' };
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return { status: 'webgpu-unavailable', reason: 'requestAdapter returned null' };
    const device = await adapter.requestDevice();
    const rows = new Float32Array([
      0.5, 0.5, 0.5, 1,
      1.5, 0.5, 0.5, 1,
      0.5, 1.5, 0.5, 1
    ]);
    const buffer = device.createBuffer({
      label: 'ulg-test-extension-compact-position-rows',
      size: rows.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    });
    device.queue.writeBuffer(buffer, 0, rows);
    const extensionExecution = {
      schema: 'peercompute.webgpu-marching-cubes.surface-execution.v0',
      adapterId: 'test-webgpu-marching-cubes',
      backend: 'webgpu',
      status: 'surface-ready',
      ok: true,
      ownsDevice: false,
      result: {
        schema: 'peercompute.webgpu-marching-cubes.surface.v0',
        status: 'surface-ready',
        vertexCount: 3,
        triangleCount: 1,
        vertexStrideFloats: 4,
        vertexStrideBytes: 16,
        vertexFormat: 'float32x4-position',
        buffer,
        bufferByteLength: rows.byteLength,
        bufferRetained: true,
        resourceOwnership: { ok: true, status: 'same-device' }
      }
    };
    const translated = await buildWebGpuMarchingCubesExtensionSurfaceRowsWebGpu({
      device,
      extensionExecution,
      readbackMode: 'full-parity-readback',
      positionTransformResolution: 8,
      fieldPadding: 0.22,
      refEdgeM: 5,
      waitForQueueCompletion: true,
      retainVertexRowsBuffer: false,
      retainDrawRowsBuffer: false,
      retainDrawIndirectRowsBuffer: false
    });
    buffer.destroy?.();
    return {
      status: translated.status,
      transformStatus: translated.positionTransformStatus,
      vertexRows: Array.from(translated.surfaceVertices.vertexRows.slice(0, 3 * 16)),
      drawIndirectRows: Array.from(translated.surfaceDraw.drawIndirectRows)
    };
  });

  test.skip(result.status === 'webgpu-unavailable', result.reason || 'WebGPU adapter unavailable');
  expect(result.status).toBe('extension-surface-translated-to-ulg-rows');
  expect(result.transformStatus).toBe('ulg-render-field-grid-to-world-transform-ready');
  const span = 1 - 2 * 0.22;
  const scaleM = 5 / (span * 8);
  const originM = -0.22 * 5 / span;
  expect(result.vertexRows[5]).toBeCloseTo(originM, 5);
  expect(result.vertexRows[6]).toBeCloseTo(originM, 5);
  expect(result.vertexRows[7]).toBeCloseTo(originM, 5);
  expect(result.vertexRows[21]).toBeCloseTo(originM + scaleM, 5);
  expect(result.vertexRows[22]).toBeCloseTo(originM, 5);
  expect(result.vertexRows[23]).toBeCloseTo(originM, 5);
  expect(result.vertexRows[37]).toBeCloseTo(originM, 5);
  expect(result.vertexRows[38]).toBeCloseTo(originM + scaleM, 5);
  expect(result.vertexRows[39]).toBeCloseTo(originM, 5);
  expect(result.drawIndirectRows).toEqual([3, 1, 0, 0]);
});

test('SPH phase no-full retained surface draw diagnostics build under budget without overlay', async ({ page }) => {
  test.setTimeout(150_000);
  page.on('console', (message) => {
    const text = message.text();
    if (text.includes('[sph-render-progress]') || text.includes('[sph-resident-progress]')) {
      console.log(text);
    }
  });
  await page.goto('/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1.01&dropn=3&basen=5&boxx=5&boxy=5&boxz=5&residentAuto=0&visualCapture=1');
  if (await page.locator('#sph-phase-overlay').count() === 0) {
    await page.locator('#run-sph-phase').click();
  }
  await expect(page.locator('#sph-phase-overlay')).toBeVisible();
  await page.waitForFunction(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const scene = overlay?.__sphScene;
    return Boolean(
      !overlay?.__sphCpuClosureTask?.active
      && scene?.getSphGpuParticleState?.()?.schema
      && scene?.getMlsMpmGpuParticleState?.()?.schema
      && typeof scene?.refreshMlsMpmResidentSteps === 'function'
      && typeof scene?.refreshSphResidentRenderState === 'function'
    );
  }, null, { timeout: 90_000 });

  const stepResult = await page.evaluate(async () => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const scene = overlay.__sphScene;
    const execution = await scene.refreshMlsMpmResidentSteps({
      preferWebGpu: true,
      stepCount: 1,
      readbackMode: 'no-full-readback',
      compactSummaryScope: 'particle-visual',
      force: true
    });
    overlay.__mlsMpmResidentSteps = execution;
    overlay.__mlsMpmResidentStep = scene.getMlsMpmResidentStep?.() || execution?.finalStep || null;
    return {
      stepBackend: execution?.backend ?? null,
      stepReadbackMode: execution?.readbackMode ?? null,
      compactSummaryScope: execution?.compactSummaryScope ?? null,
      progress: scene.userData?.sphResidentStepsProgress || null
    };
  });

  expect(stepResult.stepBackend, JSON.stringify(stepResult, null, 2)).toBe('webgpu');
  expect(stepResult.stepReadbackMode).toBe('no-full-readback');

  const result = await page.evaluate(async () => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const scene = overlay.__sphScene;
    const execution = overlay.__mlsMpmResidentSteps;
    const renderRefresh = scene.refreshSphResidentRenderState({
      preferWebGpu: true,
      residentSteps: execution,
      renderFieldReadbackMode: 'no-full-readback',
      renderRowsReadbackMode: 'no-full-readback',
      renderFieldSurfaceSummaryMode: 'skip',
      surfaceDrawDiagnosticMode: 'metadata',
      surfaceDrawDiagnosticMaxFieldCells: 100_000,
      surfaceDrawDiagnosticMaxResolution: 8,
      skipPressureInterfaceRefresh: true
    });
    const timeout = new Promise((resolve) => {
      setTimeout(() => resolve({
        status: 'resident-render-refresh-timeout',
        progress: scene.userData?.sphResidentRenderProgress || null,
        renderState: scene.userData?.sphResidentRenderState || null,
        surfaceDraw: scene.getSphResidentSurfaceDraw?.() || null
      }), 45_000);
    });
    const renderResult = await Promise.race([
      renderRefresh.then((renderState) => ({ status: 'resident-render-refresh-complete', renderState })),
      timeout
    ]);
    if (renderResult.status !== 'resident-render-refresh-complete') {
      return {
        status: renderResult.status,
        stepBackend: execution?.backend ?? null,
        stepReadbackMode: execution?.readbackMode ?? null,
        progress: renderResult.progress,
        renderStateStatus: renderResult.renderState?.status ?? null,
        surfaceDrawStatus: renderResult.surfaceDraw?.status ?? null
      };
    }
    const renderState = renderResult.renderState;
    overlay.__sphResidentRenderState = renderState;
    overlay.__sphResidentSurfaceDraw = scene.getSphResidentSurfaceDraw?.() || null;
    console.log('[sph-render-progress] test-retained-surface-draw-before-viewport-refresh');
    scene.refreshViewportAndOverlay?.({ reason: 'test-no-full-retained-surface-draw-diagnostics' });
    console.log('[sph-render-progress] test-retained-surface-draw-after-viewport-refresh');
    console.log('[sph-render-progress] test-retained-surface-draw-before-raf');
    await new Promise((resolve) => requestAnimationFrame(resolve));
    console.log('[sph-render-progress] test-retained-surface-draw-after-raf');
    const surfaceDraw = scene.getSphResidentSurfaceDraw?.() || null;
    console.log('[sph-render-progress] test-retained-surface-draw-after-surface-draw-get');
    const payload = {
      stepBackend: execution?.backend ?? null,
      stepReadbackMode: execution?.readbackMode ?? null,
      renderSource: renderState?.source ?? null,
      renderBackend: renderState?.backend ?? null,
      renderRowsReadback: renderState?.renderRowsReadback ?? null,
      renderFieldReadback: renderState?.renderFieldReadback ?? null,
      renderFieldSurfaceSummaryMode: renderState?.renderFieldSurfaceSummaryMode ?? null,
      renderFieldSurfaceSummarySkipped: renderState?.renderFieldSurfaceSummarySkipped ?? null,
      renderFieldSurfaceSummaryReadback: renderState?.renderFieldSurfaceSummaryReadback ?? null,
      surfaceDrawDiagnosticMode: renderState?.surfaceDrawDiagnosticMode ?? null,
      surfaceDrawDiagnosticMaxFieldCells: renderState?.surfaceDrawDiagnosticMaxFieldCells ?? null,
      surfaceDrawDiagnosticMaxResolution: renderState?.surfaceDrawDiagnosticMaxResolution ?? null,
      surfaceDrawDiagnosticSurfaceTableMaxResolution: renderState?.surfaceDrawDiagnosticSurfaceTableMaxResolution ?? null,
      surfaceDrawDiagnosticsBuilt: renderState?.surfaceDrawDiagnosticsBuilt ?? null,
      surfaceDrawDiagnosticsSkipped: renderState?.surfaceDrawDiagnosticsSkipped ?? null,
      surfaceDrawDiagnosticsSkipReason: renderState?.surfaceDrawDiagnosticsSkipReason ?? null,
      surfaceDrawDiagnosticFieldCellCount: renderState?.surfaceDrawDiagnosticFieldCellCount ?? null,
	      surfaceDrawStatus: renderState?.surfaceDrawStatus ?? null,
	      surfaceDrawActiveSurfaceCount: renderState?.surfaceDrawActiveSurfaceCount ?? null,
	      surfaceDrawVertexCount: renderState?.surfaceDrawVertexCount ?? null,
	      surfaceDrawTriangleCount: renderState?.surfaceDrawTriangleCount ?? null,
	      surfaceDrawSourceVertexRowCount: renderState?.surfaceDrawSourceVertexRowCount ?? null,
	      surfaceDrawVertexRowsBufferRetained: renderState?.surfaceDrawVertexRowsBufferRetained ?? null,
	      surfaceDrawVertexRowsBufferByteLength: renderState?.surfaceDrawVertexRowsBufferByteLength ?? null,
	      surfaceDrawRowsBufferRetained: renderState?.surfaceDrawRowsBufferRetained ?? null,
      surfaceDrawRowsBufferByteLength: renderState?.surfaceDrawRowsBufferByteLength ?? null,
      surfaceDrawIndirectRowsBufferRetained: renderState?.surfaceDrawIndirectRowsBufferRetained ?? null,
      surfaceDrawIndirectRowsBufferByteLength: renderState?.surfaceDrawIndirectRowsBufferByteLength ?? null,
      surfaceDrawCompactedVertexRowsBufferRetained: renderState?.surfaceDrawCompactedVertexRowsBufferRetained ?? null,
      surfaceDrawCompactedVertexRowsBufferByteLength: renderState?.surfaceDrawCompactedVertexRowsBufferByteLength ?? null,
      surfaceDrawReadback: renderState?.surfaceDrawReadback ?? null,
      surfaceDrawSummaryReadback: renderState?.surfaceDrawSummaryReadback ?? null,
      surfaceDrawSummaryReadbackByteLength: renderState?.surfaceDrawSummaryReadbackByteLength ?? null,
      fullSurfaceDrawReadback: renderState?.fullSurfaceDrawReadback ?? null,
      surfaceDrawDiagnosticOnly: renderState?.surfaceDrawDiagnosticOnly ?? null,
      surfaceDrawDiagnosticOnlyMode: renderState?.surfaceDrawDiagnosticOnlyMode ?? null,
      surfaceDrawVisibleRendererBridge: renderState?.surfaceDrawVisibleRendererBridge ?? null,
      surfaceDrawVisibleRenderSource: renderState?.surfaceDrawVisibleRenderSource ?? null,
      surfaceDrawOverlayPolicyStatus: renderState?.surfaceDrawOverlayPolicyStatus ?? null,
      surfaceDrawOverlayPolicyEnabled: renderState?.surfaceDrawOverlayPolicyEnabled ?? null,
	      surfaceDrawRenderBridgeStatus: renderState?.surfaceDrawRenderBridgeStatus ?? null,
	      surfaceDrawHasVertexRowsBuffer: Boolean(surfaceDraw?.surfaceVertices?.vertexRowsBuffer),
	      surfaceDrawHasDrawRowsBuffer: Boolean(surfaceDraw?.surfaceDraw?.drawRowsBuffer),
	      surfaceDrawHasDrawIndirectRowsBuffer: Boolean(surfaceDraw?.surfaceDraw?.drawIndirectRowsBuffer),
	      surfaceDrawHasCompactedVertexRowsBuffer: Boolean(surfaceDraw?.surfaceDraw?.compactedVertexRowsBuffer)
    };
    console.log('[sph-render-progress] test-retained-surface-draw-before-return');
    scene.dispose?.();
    overlay.__sphScene = null;
    overlay.__sphResidentSurfaceDraw = null;
    overlay.__sphResidentRenderState = renderState;
    console.log('[sph-render-progress] test-retained-surface-draw-after-dispose');
    return payload;
  });

  expect(result.stepBackend).toBe('webgpu');
  expect(result.stepReadbackMode).toBe('no-full-readback');
  expect(result.renderSource).toBe('resident-gpu-render-field');
  expect(result.renderBackend).toBe('webgpu');
  expect(result.renderRowsReadback).toBe(false);
  expect(result.renderFieldReadback).toBe(false);
  expect(result.renderFieldSurfaceSummaryMode).toBe('skip');
  expect(result.renderFieldSurfaceSummarySkipped).toBe(true);
  expect(result.renderFieldSurfaceSummaryReadback).toBe(false);
  expect(result.surfaceDrawDiagnosticMode).toBe('metadata');
  expect(result.surfaceDrawDiagnosticMaxFieldCells).toBe(100_000);
  expect(result.surfaceDrawDiagnosticMaxResolution).toBe(8);
  expect(result.surfaceDrawDiagnosticSurfaceTableMaxResolution).toBeLessThanOrEqual(8);
  expect(result.surfaceDrawDiagnosticsBuilt).toBe(true);
  expect(result.surfaceDrawDiagnosticsSkipped).toBe(false);
  expect(result.surfaceDrawDiagnosticsSkipReason).toBe(null);
  expect(result.surfaceDrawDiagnosticFieldCellCount).toBeGreaterThan(0);
  expect(result.surfaceDrawDiagnosticFieldCellCount).toBeLessThanOrEqual(100_000);
	  expect(result.surfaceDrawStatus).toBe('resident-surface-vertex-buffers-retained');
	  expect(result.surfaceDrawSourceVertexRowCount).toBeGreaterThan(0);
	  expect(result.surfaceDrawVertexRowsBufferRetained).toBe(true);
	  expect(result.surfaceDrawVertexRowsBufferByteLength).toBeGreaterThan(0);
	  expect(result.surfaceDrawRowsBufferRetained).toBe(false);
	  expect(result.surfaceDrawRowsBufferByteLength).toBe(0);
	  expect(result.surfaceDrawIndirectRowsBufferRetained).toBe(false);
	  expect(result.surfaceDrawIndirectRowsBufferByteLength).toBe(0);
	  expect(result.surfaceDrawCompactedVertexRowsBufferRetained).toBe(false);
	  expect(result.surfaceDrawCompactedVertexRowsBufferByteLength).toBe(0);
	  expect(result.surfaceDrawReadback).toBe(false);
	  expect(result.surfaceDrawSummaryReadback).toBe(false);
	  expect(result.surfaceDrawSummaryReadbackByteLength).toBe(0);
	  expect(result.fullSurfaceDrawReadback).toBe(false);
	  expect(result.surfaceDrawDiagnosticOnly).toBe(true);
	  expect(result.surfaceDrawDiagnosticOnlyMode).toBe('metadata');
	  expect(result.surfaceDrawVisibleRendererBridge).toBe('diagnostic-only-no-overlay');
	  expect(result.surfaceDrawVisibleRenderSource).toBe('resident-surface-draw-diagnostic-buffers');
	  expect(result.surfaceDrawOverlayPolicyStatus).toBe('surface-draw-overlay-disabled-by-policy');
	  expect(result.surfaceDrawOverlayPolicyEnabled).toBe(false);
	  expect(result.surfaceDrawRenderBridgeStatus).toBe('surface-draw-overlay-disabled-by-policy');
	  expect(result.surfaceDrawHasVertexRowsBuffer).toBe(true);
	  expect(result.surfaceDrawHasDrawRowsBuffer).toBe(false);
	  expect(result.surfaceDrawHasDrawIndirectRowsBuffer).toBe(false);
	  expect(result.surfaceDrawHasCompactedVertexRowsBuffer).toBe(false);
	});

test('SPH phase resident steps can submit through a ComputeManager-shaped GPU lane task', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1&dropn=2&basen=3&boxx=4&boxy=4&boxz=4&residentAuto=0&visualCapture=1');
  if (await page.locator('#sph-phase-overlay').count() === 0) {
    await page.locator('#run-sph-phase').click();
  }
  await expect(page.locator('#sph-phase-overlay')).toBeVisible();
  await page.waitForFunction(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const scene = overlay?.__sphScene;
    return Boolean(
      !overlay?.__sphCpuClosureTask?.active
      && scene?.getSphGpuParticleState?.()?.schema
      && scene?.getMlsMpmGpuParticleState?.()?.schema
      && typeof scene?.refreshMlsMpmResidentSteps === 'function'
    );
  }, null, { timeout: 90_000 });

  const result = await page.evaluate(async () => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const scene = overlay.__sphScene;
    const submitted = [];
    const computeManager = {
      async submitTask(task) {
        submitted.push({
          schema: task.schema,
          id: task.id,
          exportName: task.exportName,
          residency: task.residency,
          laneId: task.gpuResidentLane?.laneId ?? null,
          stateKey: task.gpuResidentLane?.stateKey ?? null,
          lawGraphNodeId: task.lawGraphNode?.nodeId ?? null,
          readbackBytes: task.gpuResidentLane?.copyBudget?.readbackBytes ?? null,
          compactSummaryBytes: task.gpuResidentLane?.copyBudget?.compactSummaryBytes ?? null
        });
        const module = await import('/src/runtime/sph/sphMlsMpmGpuStep.js');
        const execution = await module.runMlsMpmResidentStepsComputeTask(task.data);
        return {
          status: 'accepted-inline',
          acceptedTaskId: task.id,
          result: execution
        };
      }
    };
    const execution = await scene.refreshMlsMpmResidentSteps({
      computeManager,
      preferWebGpu: true,
      stepCount: 1,
      readbackMode: 'no-full-readback',
      compactSummaryScope: 'particle-visual',
      force: true
    });
    scene.dispose?.();
    overlay.__sphScene = null;
    return {
      submitted,
      executionSchema: execution?.schema ?? null,
      status: execution?.status ?? null,
      backend: execution?.backend ?? null,
      completedStepCount: execution?.completedStepCount ?? null,
      computeManagerTaskStatus: execution?.computeManagerTask?.status ?? null,
      computeManagerTaskLaneId: execution?.computeManagerTask?.laneId ?? null,
      computeManagerTaskRequestedLaneId: execution?.computeManagerTask?.requestedLaneId ?? null,
      computeTaskSchema: execution?.computeTaskSchema ?? null,
      computeTaskResultSchema: execution?.computeTaskResultSchema ?? null,
      lawGraphNodeId: execution?.lawGraphNode?.nodeId ?? null,
      gpuFenceStatus: execution?.gpuFence?.status ?? null,
      gpuFenceSatisfied: execution?.gpuFence?.fenceSatisfied ?? null,
      finalStepBackend: execution?.finalStep?.backend ?? null,
      finalStepReadbackMode: execution?.finalStep?.readbackMode ?? null
    };
  });

  expect(result.submitted).toHaveLength(1);
  expect(result.submitted[0].schema).toBe('peercompute.ulg.mls-mpm-resident-steps-compute-task.v0');
  expect(result.submitted[0].exportName).toBe('runMlsMpmResidentStepsComputeTask');
  expect(result.submitted[0].residency).toBe('gpu-lane');
  expect(result.submitted[0].lawGraphNodeId).toBe('ulg-mls-mpm-sph-resident-pass-dag');
  expect(result.submitted[0].readbackBytes).toBeGreaterThan(0);
  expect(result.submitted[0].compactSummaryBytes).toBeGreaterThan(0);
  expect(result.executionSchema).toBe('peercompute.ulg.mls-mpm-gpu-resident-steps-execution.v0');
  expect(result.status).toBe('resident-steps-executed');
  expect(result.backend).toBe('webgpu');
  expect(result.completedStepCount).toBe(1);
  expect(result.computeManagerTaskStatus).toBe('inline-execution-returned');
  expect(result.computeManagerTaskLaneId).toBe('ulg:sph-resident:scene');
  expect(result.computeTaskSchema).toBe('peercompute.ulg.mls-mpm-resident-steps-compute-task.v0');
  expect(result.computeTaskResultSchema).toBe('peercompute.ulg.mls-mpm-resident-steps-compute-task-result.v0');
  expect(result.lawGraphNodeId).toBe('ulg-mls-mpm-sph-resident-pass-dag');
  expect(['queue-work-completed', 'readback-map-completed']).toContain(result.gpuFenceStatus);
  expect(result.gpuFenceSatisfied).toBe(true);
  expect(result.finalStepBackend).toBe('webgpu');
  expect(result.finalStepReadbackMode).toBe('no-full-readback');
});

test('SPH phase resident steps publish after StateManager warm-delta admission', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1&dropn=2&basen=3&boxx=4&boxy=4&boxz=4&residentAuto=0&visualCapture=1');
  if (await page.locator('#sph-phase-overlay').count() === 0) {
    await page.locator('#run-sph-phase').click();
  }
  await expect(page.locator('#sph-phase-overlay')).toBeVisible();
  await page.waitForFunction(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const scene = overlay?.__sphScene;
    return Boolean(
      !overlay?.__sphCpuClosureTask?.active
      && scene?.getSphGpuParticleState?.()?.schema
      && scene?.getMlsMpmGpuParticleState?.()?.schema
      && typeof scene?.refreshMlsMpmResidentSteps === 'function'
    );
  }, null, { timeout: 90_000 });

  const result = await page.evaluate(async () => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const scene = overlay.__sphScene;
    const warm = {};
    const stateManager = {
      commitDelta(delta) {
        const scope = delta.scope || 'deltas';
        warm[scope] ||= {};
        warm[scope][delta.taskId] = {
          version: delta.version ?? null,
          payload: delta.payload ?? null,
          ts: delta.timestamp ?? Date.now()
        };
      },
      getWarmDeltas(scope = 'deltas') {
        return { ...(warm[scope] || {}) };
      }
    };
    const submitted = [];
    const computeManager = {
      async submitTask(task) {
        submitted.push({
          schema: task.schema,
          id: task.id,
          laneId: task.gpuResidentLane?.laneId ?? null,
          stateKey: task.gpuResidentLane?.stateKey ?? null
        });
        const module = await import('/src/runtime/sph/sphMlsMpmGpuStep.js');
        const execution = await module.runMlsMpmResidentStepsComputeTask(task.data);
        stateManager.commitDelta(execution.commitDelta);
        return {
          status: 'accepted-inline-state-manager',
          acceptedTaskId: task.id,
          result: execution
        };
      }
    };
    const execution = await scene.refreshMlsMpmResidentSteps({
      computeManager,
      residentStateManager: stateManager,
      preferWebGpu: true,
      stepCount: 1,
      readbackMode: 'no-full-readback',
      compactSummaryScope: 'particle-visual',
      force: true
    });
    const warmDeltas = stateManager.getWarmDeltas('ulg-sph-resident-pass-dag');
    scene.dispose?.();
    overlay.__sphScene = null;
    return {
      submitted,
      warmDeltaKeys: Object.keys(warmDeltas),
      executionSchema: execution?.schema ?? null,
      computeManagerTaskStatus: execution?.computeManagerTask?.status ?? null,
      stateManagerCommitAccepted: execution?.computeManagerTask?.stateManagerCommitAccepted ?? null,
      stateManagerCommitStatus: execution?.computeManagerTask?.stateManagerCommitStatus ?? null,
      stateManagerCommitSchema: execution?.stateManagerCommit?.schema ?? null,
      stateManagerCommitWarmEntryFound: execution?.stateManagerCommit?.warmEntryFound ?? null,
      stateManagerCommitWarmPayloadSchema: execution?.stateManagerCommit?.warmEntry?.payloadSchema ?? null,
      stateManagerCommitWarmPayloadStateKey: execution?.stateManagerCommit?.warmEntry?.payloadStateKey ?? null,
      stateManagerCommitGpuFenceSatisfied: execution?.stateManagerCommit?.gpuFenceSatisfied ?? null,
      committedPayloadSchema: warmDeltas[submitted[0]?.id]?.payload?.schema ?? null,
      committedCompletedStepCount: warmDeltas[submitted[0]?.id]?.payload?.completedStepCount ?? null,
      finalStepBackend: execution?.finalStep?.backend ?? null,
      finalStepReadbackMode: execution?.finalStep?.readbackMode ?? null
    };
  });

  expect(result.submitted).toHaveLength(1);
  expect(result.warmDeltaKeys).toEqual([result.submitted[0].id]);
  expect(result.executionSchema).toBe('peercompute.ulg.mls-mpm-gpu-resident-steps-execution.v0');
  expect(result.computeManagerTaskStatus).toBe('state-manager-committed-inline-execution-returned');
  expect(result.stateManagerCommitAccepted).toBe(true);
  expect(result.stateManagerCommitStatus).toBe('committed');
  expect(result.stateManagerCommitSchema).toBe('peercompute.ulg.resident-state-commit-admission.v0');
  expect(result.stateManagerCommitWarmEntryFound).toBe(true);
  expect(result.stateManagerCommitWarmPayloadSchema).toBe('peercompute.ulg.mls-mpm-resident-steps-state-delta.v0');
  expect(result.stateManagerCommitWarmPayloadStateKey).toBe(result.submitted[0].stateKey);
  expect(result.stateManagerCommitGpuFenceSatisfied).toBe(true);
  expect(result.committedPayloadSchema).toBe('peercompute.ulg.mls-mpm-resident-steps-state-delta.v0');
  expect(result.committedCompletedStepCount).toBe(1);
  expect(result.finalStepBackend).toBe('webgpu');
  expect(result.finalStepReadbackMode).toBe('no-full-readback');
});

test('SPH phase default PeerCompute resident authority host starts browser compute workers', async ({ page }) => {
  test.setTimeout(90_000);
  const workerFallbackWarnings = [];
  page.on('console', (message) => {
    const text = message.text();
    if (/Web Workers not available|Worker bootstrap failed|falling back to inline execution/i.test(text)) {
      workerFallbackWarnings.push(text);
    }
  });

  await page.goto('/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1&dropn=2&basen=2&boxx=4&boxy=4&boxz=4&mech=mlsmpm&residentAuto=0&residentWorkers=1&visualCapture=1');
  if (await page.locator('#sph-phase-overlay').count() === 0) {
    await page.locator('#run-sph-phase').click();
  }
  await expect(page.locator('#sph-phase-overlay')).toBeVisible();
  await page.waitForFunction(() => {
    const host = globalThis.__ulgResidentAuthorityHost || null;
    return Boolean(
      host?.status === 'ready'
      && host?.workerCapability?.status === 'worker-capability-ready'
      && (host?.computeManager?.getStats?.()?.workerCount ?? 0) > 0
    );
  }, null, { timeout: 60_000 });

  const result = await page.evaluate(() => {
    const host = globalThis.__ulgResidentAuthorityHost || null;
    return {
      pageWorkerType: typeof Worker,
      pageGlobalThisWorkerType: typeof globalThis.Worker,
      hostStatus: host?.status ?? null,
      hostSource: host?.source ?? null,
      workerCapabilityStatus: host?.workerCapability?.status ?? null,
      workerCapabilityBlocker: host?.workerCapability?.blocker ?? null,
      workerConstructorAvailable: host?.workerCapability?.workerConstructorAvailable ?? null,
      requestedEnableWorkers: host?.workerCapability?.requestedEnableWorkers ?? null,
      effectiveEnableWorkers: host?.workerCapability?.effectiveEnableWorkers ?? null,
      workerCount: host?.computeManager?.getStats?.()?.workerCount ?? null,
      targetWorkers: host?.computeManager?.getStats?.()?.targetWorkers ?? null,
      computeManagerSupportsWorkers: host?.computeManager?._supportsWorkers?.() ?? null
    };
  });

  expect(result.pageWorkerType).toBe('function');
  expect(result.pageGlobalThisWorkerType).toBe('function');
  expect(result.hostStatus).toBe('ready');
  expect(result.hostSource).toBe('peercompute-browser-nodekernel-authority-host');
  expect(result.workerCapabilityStatus).toBe('worker-capability-ready');
  expect(result.workerCapabilityBlocker).toBe(null);
  expect(result.workerConstructorAvailable).toBe(true);
  expect(result.requestedEnableWorkers).toBe(true);
  expect(result.effectiveEnableWorkers).toBe(true);
  expect(result.computeManagerSupportsWorkers).toBe(true);
  expect(result.workerCount).toBeGreaterThan(0);
  expect(result.targetWorkers).toBeGreaterThan(0);
  expect(workerFallbackWarnings).toEqual([]);

  await page.evaluate(async () => {
    await globalThis.__ulgResidentAuthorityHost?.destroy?.();
    globalThis.__ulgResidentAuthorityHost = null;
  });
});

test('SPH phase mounted resident scheduler can publish worker-retained mechanics stage lane', async ({ page }) => {
  test.setTimeout(180_000);
  const consoleIssues = [];
  page.on('console', (message) => {
    const text = message.text();
    if (/Web Workers not available|Worker bootstrap failed|falling back to inline execution|Invalid Buffer|Invalid BindGroup|Invalid CommandBuffer|Error while parsing WGSL/i.test(text)) {
      consoleIssues.push(text);
    }
  });

  await page.goto('/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1&dropn=2&basen=2&boxx=4&boxy=4&boxz=4&mech=mlsmpm&residentAuto=1&residentWorkers=1&residentStageWorkers=1&residentFuseSequence=1&visualCapture=1');
  if (await page.locator('#sph-phase-overlay').count() === 0) {
    await page.locator('#run-sph-phase').click();
  }
  await expect(page.locator('#sph-phase-overlay')).toBeVisible();
  await page.waitForFunction(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const lane = overlay?.__sphMountedMechanicsStageWorkerLane || null;
    return lane?.status === 'worker-stage-lane-published'
      || lane?.status === 'worker-stage-lane-error'
      || lane?.status === 'worker-stage-lane-blocked';
  }, null, { timeout: 150_000 });

  const result = await page.evaluate(async () => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const lane = overlay?.__sphMountedMechanicsStageWorkerLane || null;
    const host = overlay?.__sphPeerComputeResidentAuthorityHost || null;
    const execution = overlay?.__mlsMpmResidentSteps || null;
    return {
      lane,
      hostStatus: host?.status ?? null,
      workerCapabilityStatus: host?.workerCapabilityStatus ?? host?.workerCapability?.status ?? null,
      residentComputeManagerTaskStatus: execution?.computeManagerTask?.status ?? null,
      residentExecutionBackend: execution?.backend ?? null
    };
  });

  expect(result.hostStatus).toBe('ready');
  expect(result.workerCapabilityStatus).toBe('worker-capability-ready');
  expect(result.residentComputeManagerTaskStatus).toBe('state-manager-committed-inline-execution-returned');
  expect(result.residentExecutionBackend).toBe('webgpu');
  expect(result.lane?.enabled).toBe(true);
  expect(result.lane?.status).toBe('worker-stage-lane-published');
  expect(result.lane?.authorityHostStatus).toBe('ready');
  expect(result.lane?.authorityHostSource).toBe('peercompute-browser-nodekernel-authority-host');
  expect(result.lane?.stateManagerWarmDeltaScope).toBe('ulg-worker-retained-mechanics-publications');
  expect(result.lane?.stateManagerWarmDeltaFound).toBe(true);
  expect(result.lane?.stateManagerWarmDeltaStatus).toBe('worker-retained-mechanics-output-admitted');
  expect(result.lane?.sameDeviceRetainedBufferImportAvailable).toBe(true);
  expect(result.lane?.sameDeviceRetainedBufferImportSourceHotBufferKey).toContain('ulg:sph-resident-same-device-source');
  expect(result.lane?.gpuResidentLaneStagePlanLaneId).toBe('ulg:mounted:mechanics-stage-worker-lane');
  expect(result.lane?.gpuResidentLaneStagePlanStateKey).toBe('ulg:mounted:mechanics-stage-worker-state');
  expect(result.lane?.gpuResidentLaneStagePlanContractSchema).toBe('peercompute.ulg.mls-mpm-mechanics-stage-lane-contract.v0');
  expect(result.lane?.gpuResidentLaneStageExecutionStageOrder).toEqual([
    'p2g',
    'gridUpdate',
    'g2p'
  ]);
  expect(result.lane?.gpuResidentLaneStageExecutionAuthorityPath).toBe('node-kernel-execution');
  expect(result.lane?.gpuResidentLaneStageExecutionStateFamilyConflictPolicy).toBe('defer-read-write-conflicting-ready-stages');
  expect(result.lane?.gpuResidentLaneStageExecutionStateFamilyConflictDeferralCount).toBeGreaterThanOrEqual(0);
  expect(result.lane?.gpuHubResidentStageExecutorMode).toBe('registered');
  expect(result.lane?.gpuResidentLaneStageExecutionUsedGpuHubExecutors).toBe(true);
  expect(result.lane?.gpuResidentLaneStageExecutionWorkerRunnerSupplied).toBe(true);
  expect(Object.values(result.lane?.gpuResidentLaneStageExecutionWorkerResidencyStatuses || {})).toEqual([
    'worker-ready',
    'worker-ready',
    'worker-ready'
  ]);
  expect(result.lane?.gpuResidentLaneStageTaskReadbackModes).toEqual({
    p2g: 'no-full-readback',
    gridUpdate: 'no-full-readback',
    g2p: 'no-full-readback'
  });
  expect(result.lane?.gpuResidentLaneStageTaskNormalHotLoopReadbackFree).toEqual({
    p2g: true,
    gridUpdate: true,
    g2p: true
  });
  expect(Object.keys(result.lane?.gpuResidentLaneStageTaskCopyBudgets || {})).toEqual([
    'p2g',
    'gridUpdate',
    'g2p'
  ]);
  expect(result.lane?.gpuResidentLaneStageTaskCopyBudgetStatus).toBe('stage-copy-budgets-recorded');
  expect(result.lane?.gpuResidentLaneStageTaskCopyBudgetTotals?.readbackBytes).toBe(0);
  expect(result.lane?.gpuResidentLaneStageTaskCopyBudgetTotals?.retainedBytes).toBeGreaterThan(0);
  expect(result.lane?.gpuResidentLaneStageTaskBufferByteTotals?.totalByteLength).toBeGreaterThan(0);
  expect(result.lane?.workerCompactPublicationCandidateStatus).toBe('worker-retained-compact-publication-candidate-ready');
  expect(result.lane?.workerCompactPublicationCandidateSameDeviceRetainedBufferImportAvailable).toBe(true);
  expect(result.lane?.workerCompactPublicationCandidateSameDeviceSourceHotBufferKey)
    .toBe(result.lane?.sameDeviceRetainedBufferImportSourceHotBufferKey);
  expect(result.lane?.workerCompactPublicationCandidateLocalMaterializationStatus)
    .toBe('same-device-retained-buffer-import-ready');
  expect(result.lane?.workerCompactPublicationCandidateAcceptedMaterializationModes).toEqual([
    'same-device-retained-buffer-import'
  ]);
  expect(result.lane?.workerCompactPublicationStatus).toBe('worker-retained-mechanics-output-published');
  expect(result.lane?.workerCompactPublicationCommitted).toBe(true);
  expect(result.lane?.workerCompactPublicationCommitDeltaTaskId).toContain('ulg-worker-retained-mechanics-publication:');
  expect(result.lane?.workerCompactPublicationSameDeviceRetainedBufferImportAvailable).toBe(true);
  expect(result.lane?.workerCompactPublicationSameDeviceSourceHotBufferKey)
    .toBe(result.lane?.sameDeviceRetainedBufferImportSourceHotBufferKey);
  expect(result.lane?.workerCompactPublicationRecordSchema).toBe('peercompute.ulg.mechanics-worker-retained-hot-buffer-publication.v0');
  expect(result.lane?.workerCompactPublicationRecordStatus).toBe('worker-retained-hot-buffer-source-stored');
  expect(result.lane?.workerCompactPublicationRecordStateKey).toBe('ulg:mounted:mechanics-stage-worker-state');
  expect(result.lane?.workerCompactPublicationRecordSourceStage).toBe('g2p');
  expect(result.lane?.workerCompactPublicationRecordWorkerLocal).toBe(true);
  expect(result.lane?.workerCompactPublicationRecordSameDevice).toBe(false);
  expect(result.lane?.workerCompactPublicationRecordCopyMode).toBe('zero-copy-worker-retained-ref-descriptor');
  expect(result.lane?.workerCompactPublicationRecordSameDeviceRetainedBufferImportAvailable).toBe(true);
  expect(result.lane?.workerCompactPublicationRecordSameDeviceSourceHotBufferKey)
    .toBe(result.lane?.sameDeviceRetainedBufferImportSourceHotBufferKey);
  expect(result.lane?.workerCompactPublicationRecordLocalBufferRefCount).toBe(0);
  expect(result.lane?.workerCompactPublicationRecordWorkerRetainedBufferRefCount).toBeGreaterThan(0);
  expect(result.lane?.workerCompactPublicationRecordHasWorkerRunner).toBe(true);
  expect(result.lane?.workerRetainedAccessContractSchema).toBe('peercompute.ulg.worker-retained-access-contract.v0');
  expect(result.lane?.workerRetainedAccessContractStatus).toBe('worker-local-source-ready-main-thread-refresh-blocked');
  expect(result.lane?.workerRetainedAccessContractWorkerContinuationRequired).toBe(true);
  expect(result.lane?.workerRetainedAccessContractMainThreadGpuHandlesAvailable).toBe(false);
  expect(result.lane?.workerRetainedAccessContractSameDeviceRetainedBufferImportAvailable).toBe(true);
  expect(result.lane?.workerRetainedAccessContractSameDeviceSourceHotBufferKey)
    .toBe(result.lane?.sameDeviceRetainedBufferImportSourceHotBufferKey);
  expect(result.lane?.workerRetainedAccessContractLocalMaterializationStatus)
    .toBe('same-device-retained-buffer-import-ready');
  expect(result.lane?.workerRetainedAccessContractLocalMaterializationBlocker).toBe(null);
  expect(result.lane?.workerRetainedAccessContractAcceptedConsumerModes).toEqual([
    'same-device-retained-buffer-import',
    'same-worker-lane-retained-buffer-ref'
  ]);
  expect(result.lane?.workerRetainedAccessContractAcceptedMaterializationModes).toEqual([
    'same-device-retained-buffer-import'
  ]);
  expect(result.lane?.workerRetainedAccessContractOutputFamilies).toEqual([
    'sph-particle-state',
    'mls-mpm-mechanics'
  ]);
  expect(result.lane?.workerRetainedAccessContractLocalBufferRefCount).toBe(0);
  expect(result.lane?.workerRetainedAccessContractWorkerRetainedBufferRefCount).toBeGreaterThan(0);
  expect(result.lane?.workerRetainedContinuationPlanStatus).toBe('same-worker-retained-continuation-ready');
  expect(result.lane?.workerRetainedContinuationPlanConsumerMode).toBe('same-worker-lane-retained-buffer-ref');
  expect(result.lane?.workerRetainedContinuationPlanWorkerRunnerAvailable).toBe(true);
  expect(result.lane?.workerRetainedContinuationPlanSameDeviceRetainedBufferImportAvailable).toBe(true);
  expect(result.lane?.workerRetainedContinuationPlanSameDeviceSourceHotBufferKey)
    .toBe(result.lane?.sameDeviceRetainedBufferImportSourceHotBufferKey);
  expect(result.lane?.workerRetainedContinuationPlanUseWorkerInput).toBe(true);
  expect(result.lane?.workerRetainedContinuationPlanMissingOutputFamilies).toEqual([]);
  expect(result.lane?.workerRetainedContinuationPlanWorkerRetainedBufferRefCount).toBeGreaterThan(0);
  expect(result.lane?.workerRetainedContinuationPlanLocalBufferRefCount).toBe(0);
  expect(result.lane?.renderHandoffStatus).toBe('blocked-worker-gpu-handles-not-main-thread-renderable');
  expect(consoleIssues).toEqual([]);

  await page.evaluate(async () => {
    document.querySelector('#sph-phase-overlay')?.__sphScene?.dispose?.();
    await globalThis.__ulgResidentAuthorityHost?.destroy?.();
    globalThis.__ulgResidentAuthorityHost = null;
  });
});

test('SPH phase mounted Schroeder materialized storage publishes adopted descriptor and feeds same-device stage chain', async ({ page }) => {
  test.setTimeout(180_000);
  const consoleIssues = [];
  page.on('console', (message) => {
    const text = message.text();
    if (/Invalid Buffer|Invalid BindGroup|Invalid CommandBuffer|Error while parsing WGSL|Compute pass/i.test(text)) {
      consoleIssues.push(text);
    }
  });

  await page.goto('/?drop=h2o&base=h2o&dropt=500&baset=500&iceh=0&ironh=1&dropn=2&basen=2&boxx=4&boxy=4&boxz=4&mech=mlsmpm&residentAuto=0&visualCapture=1');
  await ensureSphPhaseOverlayVisible(page, { timeout: 90_000 });
  await page.waitForFunction(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const scene = overlay?.__sphScene;
    return Boolean(
      scene?.getSphGpuParticleState?.()?.schema
      && scene?.getMlsMpmGpuParticleState?.()?.schema
      && typeof scene?.refreshMlsMpmResidentSteps === 'function'
      && typeof scene?.requestOpticalGpuDevice === 'function'
    );
  }, null, { timeout: 90_000 });

  const result = await page.evaluate(async () => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const scene = overlay.__sphScene;
    const hostModule = await import('/src/runtime/peercomputeBrowserResidentHost.js');
    const schroederModule = await import('/src/runtime/sph/schroederHierarchyGpu.js');
    const host = await hostModule.createPeerComputeResidentAuthorityHost({
      computeTaskModulePath: '/src/runtime/sph/sphMlsMpmGpuStep.js',
      enableWorkers: false,
      enablePersistence: false,
      disableNetworkProvider: true,
      disableBroadcast: true
    });
    window.__ulgResidentAuthorityHost = host;

    const containsRawGpuBuffer = (value, seen = new Set()) => {
      if (!value || typeof value !== 'object') return false;
      if (seen.has(value)) return false;
      seen.add(value);
      const ctor = value.constructor?.name || '';
      if (ctor === 'GPUBuffer') return true;
      if (typeof value.mapAsync === 'function' && typeof value.destroy === 'function') return true;
      for (const entry of Object.values(value)) {
        if (containsRawGpuBuffer(entry, seen)) return true;
      }
      return false;
    };

    try {
      const sourceParticleCount = Math.max(1, Math.round(Number(
        scene.getSphGpuParticleState?.()?.particleCount
        ?? scene.getMlsMpmGpuParticleState?.()?.particleCount
        ?? 1
      ) || 1));
      const rowBudget = Math.max(sourceParticleCount, 4);
      const requiredParticleCapacity = rowBudget + 4;
      const targetStateFamilies = [
        'sph-particle-state',
        'mls-mpm-particle-mechanics',
        'sph-particle-thermo'
      ];
      const phaseVolumeSplitMergeAdmission = {
        schema: schroederModule.ULG_SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_ADMISSION_SCHEMA,
        status: 'schroeder-phase-volume-split-merge-admission-admitted',
        phaseVolumeSplitMergeApproved: true,
        outputFamilies: ['schroeder-phase-volume-split-merge-apply'],
        schroederPhaseVolumeSplitMergeProposalRowCount: rowBudget,
        hotBufferKey: 'ulg:browser:ss-adopted-storage-phase-volume-split-merge-admission',
        sourceHotBufferKey: 'ulg:browser:ss-adopted-storage-phase-volume-split-merge-admission',
        committed: true
      };
      const particleStorageAllocatorAdmission = {
        schema: schroederModule.ULG_SCHROEDER_PARTICLE_STORAGE_ALLOCATOR_ADMISSION_SCHEMA,
        status: 'schroeder-particle-storage-allocator-admission-admitted',
        particleStorageAllocationApproved: true,
        particleCapacityApproved: true,
        outputFamilies: ['schroeder-particle-storage-allocation'],
        targetStateFamilies,
        schroederParticleStorageAllocationRowCount: rowBudget,
        currentParticleCapacity: sourceParticleCount,
        requiredParticleCapacity,
        hotBufferKey: 'ulg:browser:ss-adopted-storage-allocator-admission',
        sourceHotBufferKey: 'ulg:browser:ss-adopted-storage-allocator-admission',
        committed: true
      };
      const particleStorageFreeList = schroederModule.createSchroederParticleStorageFreeListPlan({
        baseSlotIndex: sourceParticleCount,
        slotCapacity: requiredParticleCapacity + rowBudget,
        availableSlotCount: requiredParticleCapacity,
        maxSlotsPerRow: 2
      });
      const particleStorageSlotAssignmentAdmission = {
        schema: schroederModule.ULG_SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_ADMISSION_SCHEMA,
        status: 'schroeder-particle-storage-slot-assignment-admission-admitted',
        particleStorageSlotAssignmentApproved: true,
        freeListDescriptorApproved: true,
        outputFamilies: ['schroeder-particle-storage-slot-assignment'],
        targetStateFamilies,
        schroederParticleStorageSlotAssignmentRowCount: rowBudget,
        hotBufferKey: 'ulg:browser:ss-adopted-storage-slot-assignment-admission',
        sourceHotBufferKey: 'ulg:browser:ss-adopted-storage-slot-assignment-admission',
        committed: true
      };
      const particleStorageMaterializationAdmission = {
        schema: schroederModule.ULG_SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_ADMISSION_SCHEMA,
        status: 'schroeder-particle-storage-materialization-admission-admitted',
        particleStorageMaterializationApproved: true,
        slotAssignmentDescriptorApproved: true,
        outputFamilies: ['schroeder-particle-storage-materialization'],
        targetStateFamilies,
        schroederParticleStorageMaterializationRowCount: rowBudget,
        requiredParticleCapacity,
        hotBufferKey: 'ulg:browser:ss-adopted-storage-materialization-admission',
        sourceHotBufferKey: 'ulg:browser:ss-adopted-storage-materialization-admission',
        committed: true
      };

      const execution = await scene.refreshMlsMpmResidentSteps({
        computeManager: host.computeManager,
        residentStateManager: host.stateManager,
        residentAuthorityHost: host,
        computeTaskModulePath: host.computeTaskModulePath,
        computeTaskLaneId: 'ulg:browser:ss-adopted-storage-resident-lane',
        computeTaskStateKey: 'ulg:browser:ss-adopted-storage-resident-state',
        computeTaskDomainKey: 'ulg:browser:ss-adopted-storage',
        preferWebGpu: true,
        stepCount: 1,
        readbackMode: 'no-full-readback',
        compactSummaryMode: 'none',
        compactSummaryScope: 'particle-visual',
        force: true,
        schroederSimulation: true,
        schroederSelectedLevel: 0,
        schroederBaseGridSpacingM: scene.getSphGpuParticleState?.()?.smoothingLengthM,
        schroederEnablePortableSummary: true,
        schroederEnableCrossLevelCoupling: true,
        schroederPhaseVolumeSplitMergeAdmission: phaseVolumeSplitMergeAdmission,
        schroederParticleStorageAllocatorAdmission: particleStorageAllocatorAdmission,
        schroederParticleStorageFreeList: particleStorageFreeList,
        schroederParticleStorageSlotAssignmentAdmission: particleStorageSlotAssignmentAdmission,
        schroederParticleStorageMaterializationAdmission: particleStorageMaterializationAdmission
      });

      const publication = execution?.schroederAdoptedParticleStoragePublication || null;
      const hotRecord = publication?.hotBufferKey
        ? host.stateManager.getHotBuffer(publication.hotBufferKey)
        : null;
      const warmDeltas = host.stateManager.getWarmDeltas(
        hostModule.ULG_SCHROEDER_ADOPTED_PARTICLE_STORAGE_PUBLICATION_SCOPE
      ) || {};
      const warmPayload = Object.values(warmDeltas)
        .find((entry) => entry?.payload?.hotBufferKey === publication?.hotBufferKey)
        ?.payload || null;
      const sameDevicePlan = host.planSchroederAdoptedParticleStorageContinuation({
        hotBufferKey: publication?.hotBufferKey,
        consumerMode: 'same-device'
      });
      const portableSeed = hostModule.createSchroederAdoptedParticleStoragePortableMaterializationSeed({
        descriptor: publication?.schroederAdoptedParticleStorageDescriptor,
        hotBufferKey: publication?.hotBufferKey,
        cacheKey: publication?.cacheKey,
        stateKey: publication?.stateKey,
        sourceTaskId: 'ulg:browser:ss-adopted-storage-portable-seed'
      });
      const crossPeerSeededPlan = host.planSchroederAdoptedParticleStorageContinuation({
        hotBufferKey: publication?.hotBufferKey,
        consumerMode: 'cross-peer',
        portableMaterializationSeed: portableSeed
      });

      const deviceResult = await scene.requestOpticalGpuDevice();
      const stageChain = await host.runMechanicsStageTaskChain({
        sphParticleState: execution.nextSphParticleState,
        mlsMpmParticleState: execution.nextMlsMpmParticleState,
        stageTaskIdPrefix: 'ulg:browser:ss-adopted-storage-stage-chain',
        preferWebGpu: true,
        useNativeTaskGraph: false,
        deviceResult,
        readbackMode: 'no-full-readback',
        compactSummaryScope: 'particle-visual',
        gpuResidentLaneId: 'ulg:browser:ss-adopted-storage-stage-chain-lane',
        gpuResidentLaneStateKey: 'ulg:browser:ss-adopted-storage-stage-chain-state',
        schroederAdoptedParticleStorageContinuationHotBufferKey: publication?.hotBufferKey,
        schroederAdoptedParticleStorageContinuationConsumerMode: 'same-device'
      });
      const chain = stageChain?.mechanicsStageTaskChain || null;

      const summary = {
        executionStatus: execution?.status ?? null,
        residentComputeManagerMode: execution?.residentComputeManagerMode ?? null,
        schroederSimulation: execution?.schroederSimulation === true,
        finalStepBackend: execution?.finalStep?.backend ?? null,
        finalStepReadbackMode: execution?.finalStep?.readbackMode ?? null,
        particleStorageMaterializationStatus:
          execution?.finalStep?.schroederParticleStorageMaterializationStatus ?? null,
        particleStorageAdoptionStatus:
          execution?.finalStep?.schroederParticleStorageAdoptionStatus ?? null,
        particleStorageAdopted:
          execution?.finalStep?.schroederParticleStorageAdopted === true,
        nextParticleBufferMode: execution?.nextParticleBufferMode ?? null,
        descriptorSchema: execution?.schroederAdoptedParticleStorageDescriptor?.schema ?? null,
        descriptorStatus: execution?.schroederAdoptedParticleStorageDescriptor?.status ?? null,
        descriptorReady: execution?.schroederAdoptedParticleStorageDescriptor?.ready === true,
        descriptorCopyMode: execution?.schroederAdoptedParticleStorageDescriptor?.copyMode ?? null,
        descriptorRawGpuBufferTransferDetected:
          execution?.schroederAdoptedParticleStorageDescriptor?.rawGpuBufferTransferDetected === true,
        descriptorSameDeviceReplayReady:
          execution?.schroederAdoptedParticleStorageDescriptor?.sameDeviceReplayReady === true,
        descriptorCrossPeerReplayReady:
          execution?.schroederAdoptedParticleStorageDescriptor?.crossPeerReplayReady === true,
        publicationSchema: publication?.schema ?? null,
        publicationStatus: publication?.status ?? null,
        publicationAccepted: publication?.accepted === true,
        publicationHotBufferKey: publication?.hotBufferKey ?? null,
        publicationRawGpuBufferTransferDetected:
          publication?.rawGpuBufferTransferDetected === true,
        publicationLocalResolverReady:
          publication?.schroederAdoptedParticleStorageLocalRetainedBufferResolverReady === true,
        publicationLocalResolverStatus:
          publication?.schroederAdoptedParticleStorageLocalRetainedBufferResolverStatus ?? null,
        publicationLocalResolverResolvedRefCount:
          publication?.schroederAdoptedParticleStorageLocalRetainedBufferResolvedRefCount ?? null,
        hotRecordStatus: hotRecord?.status ?? null,
        hotRecordCopyMode: hotRecord?.copyMode ?? null,
        warmPayloadStatus: warmPayload?.status ?? null,
        sameDevicePlanStatus: sameDevicePlan?.status ?? null,
        sameDevicePlanReady: sameDevicePlan?.ready === true,
        sameDevicePlanPrivateLaneRefs: sameDevicePlan?.sameDevicePrivateLaneRefs ?? [],
        portableSeedSchema: portableSeed?.schema ?? null,
        portableSeedStatus: portableSeed?.status ?? null,
        crossPeerSeededPlanStatus: crossPeerSeededPlan?.status ?? null,
        crossPeerSeededPlanReady: crossPeerSeededPlan?.ready === true,
        crossPeerSeededPlanPortableSeedStatus:
          crossPeerSeededPlan?.portableMaterializationSeedStatus ?? null,
        stageChainStatus: chain?.status ?? null,
        stageChainSchedulerStatus: chain?.schedulerStatus ?? null,
        stageChainScheduleStatus:
          chain?.schroederAdoptedParticleStorageContinuationScheduleStatus ?? null,
        stageChainSourceHotBufferKey:
          chain?.schroederAdoptedParticleStorageContinuationSourceHotBufferKey ?? null,
        stageChainLocalResolverStatus:
          chain?.schroederAdoptedParticleStorageLocalResolverStatus ?? null,
        stageChainLocalResolverReady:
          chain?.schroederAdoptedParticleStorageLocalResolverReady === true,
        stageChainRawGpuBufferPeerComputeTransfer:
          chain?.schroederAdoptedParticleStorageLocalResolverRawGpuBufferPeerComputeTransfer === true,
        stageChainSubmittedStageCount: chain?.submittedStageTasks?.length ?? 0,
        localResolverCount:
          host.getSchroederAdoptedParticleStorageLocalRetainedBufferResolverCount?.() ?? null,
        publicationHasRawGpuBuffer: containsRawGpuBuffer(publication),
        hotRecordHasRawGpuBuffer: containsRawGpuBuffer(hotRecord),
        warmPayloadHasRawGpuBuffer: containsRawGpuBuffer(warmPayload)
      };

      scene.dispose?.();
      overlay.__sphScene = null;
      await host.destroy();
      window.__ulgResidentAuthorityHost = null;
      return summary;
    } catch (error) {
      scene.dispose?.();
      overlay.__sphScene = null;
      await host.destroy?.();
      window.__ulgResidentAuthorityHost = null;
      throw error;
    }
  });

  expect(result.executionStatus).toBe('resident-steps-executed');
  expect(result.residentComputeManagerMode).toBe('direct-schroeder-scene');
  expect(result.schroederSimulation).toBe(true);
  expect(result.finalStepBackend).toBe('webgpu');
  expect(result.finalStepReadbackMode).toBe('no-full-readback');
  expect(result.particleStorageMaterializationStatus).toBe('schroeder-particle-storage-materialization-submitted');
  expect(result.particleStorageAdoptionStatus).toBe('schroeder-particle-storage-adopted');
  expect(result.particleStorageAdopted).toBe(true);
  expect(result.nextParticleBufferMode).toBe('retained-schroeder-particle-storage-materialized-buffers');
  expect(result.descriptorSchema).toBe('peercompute.ulg.schroeder-adopted-particle-storage-descriptor.v0');
  expect(result.descriptorStatus).toBe('schroeder-adopted-particle-storage-descriptor-ready');
  expect(result.descriptorReady).toBe(true);
  expect(result.descriptorCopyMode).toBe('descriptor-only-no-raw-gpubuffer-transfer');
  expect(result.descriptorRawGpuBufferTransferDetected).toBe(false);
  expect(result.descriptorSameDeviceReplayReady).toBe(true);
  expect(result.descriptorCrossPeerReplayReady).toBe(false);
  expect(result.publicationSchema).toBe('peercompute.ulg.schroeder-adopted-particle-storage-hot-buffer-publication.v0');
  expect(result.publicationStatus).toBe('schroeder-adopted-particle-storage-descriptor-published');
  expect(result.publicationAccepted).toBe(true);
  expect(result.publicationHotBufferKey).toContain('ulg:sph-resident-schroeder-adopted-storage');
  expect(result.publicationRawGpuBufferTransferDetected).toBe(false);
  expect(result.publicationLocalResolverReady).toBe(true);
  expect(result.publicationLocalResolverStatus)
    .toBe('schroeder-adopted-particle-storage-local-retained-buffer-resolver-ready');
  expect(result.publicationLocalResolverResolvedRefCount).toBe(3);
  expect(result.hotRecordStatus).toBe('schroeder-adopted-particle-storage-hot-buffer-source-stored');
  expect(result.hotRecordCopyMode).toBe('descriptor-only-no-raw-gpubuffer-transfer');
  expect(result.warmPayloadStatus).toBe('schroeder-adopted-particle-storage-descriptor-admitted');
  expect(result.sameDevicePlanStatus).toBe('schroeder-adopted-particle-storage-same-device-continuation-ready');
  expect(result.sameDevicePlanReady).toBe(true);
  expect(result.sameDevicePlanPrivateLaneRefs).toEqual([
    'sph-state-buffer',
    'sph-thermo-buffer',
    'mls-mpm-mechanics-buffer'
  ]);
  expect(result.portableSeedSchema)
    .toBe('peercompute.ulg.schroeder-adopted-particle-storage-portable-materialization-seed.v0');
  expect(result.portableSeedStatus)
    .toBe('schroeder-adopted-particle-storage-portable-materialization-seed-ready');
  expect(result.crossPeerSeededPlanStatus)
    .toBe('schroeder-adopted-particle-storage-cross-peer-continuation-ready');
  expect(result.crossPeerSeededPlanReady).toBe(true);
  expect(result.crossPeerSeededPlanPortableSeedStatus)
    .toBe('schroeder-adopted-particle-storage-portable-materialization-seed-accepted');
  expect(result.stageChainStatus).toBe('compute-manager-stage-task-chain-executed');
  expect(result.stageChainSchedulerStatus).toBe('ulg-helper-stage-runners-used-awaiting-gpu-graph-semantics');
  expect(result.stageChainScheduleStatus).toBe('schroeder-adopted-particle-storage-same-device-scheduled');
  expect(result.stageChainSourceHotBufferKey).toBe(result.publicationHotBufferKey);
  expect(result.stageChainLocalResolverStatus).toBe('schroeder-adopted-particle-storage-local-resolver-ready');
  expect(result.stageChainLocalResolverReady).toBe(true);
  expect(result.stageChainRawGpuBufferPeerComputeTransfer).toBe(false);
  expect(result.stageChainSubmittedStageCount).toBe(3);
  expect(result.localResolverCount).toBe(1);
  expect(result.publicationHasRawGpuBuffer).toBe(false);
  expect(result.hotRecordHasRawGpuBuffer).toBe(false);
  expect(result.warmPayloadHasRawGpuBuffer).toBe(false);
  expect(consoleIssues).toEqual([]);
});

test('SPH phase mounted SS storage policy materializes adopted storage and fail-closes worker-lane continuation', async ({ page }) => {
  // Worker-lane *consumption* of adopted storage requires a worker-owned
  // rematerialization path (future slice). This proof covers the runtime
  // policy contract: admissions publish, materialization and adoption happen,
  // the descriptor publication and host-local resolver are ready, and the
  // stage worker lane still publishes while the same-device continuation is
  // explicitly fail-closed (main-thread GPUBuffer refs cannot cross the
  // worker boundary).
  test.setTimeout(180_000);
  const consoleIssues = [];
  page.on('console', (message) => {
    const text = message.text();
    if (/Invalid Buffer|Invalid BindGroup|Invalid CommandBuffer|Error while parsing WGSL|Compute pass/i.test(text)) {
      consoleIssues.push(text);
    }
  });

  await page.goto('/?drop=h2o&base=h2o&dropt=500&baset=500&iceh=0&ironh=1&dropn=2&basen=2&boxx=4&boxy=4&boxz=4&mech=mlsmpm&residentAuto=1&residentWorkers=1&residentStageWorkers=1&residentFuseSequence=1&ss=1&schroederParticleStorageMaterialization=1&schroederParticleStorageRowBudget=32&schroederParticleStorageCapacityMargin=32&visualCapture=1');
  if (await page.locator('#sph-phase-overlay').count() === 0) {
    await page.locator('#run-sph-phase').click();
  }
  await expect(page.locator('#sph-phase-overlay')).toBeVisible();
  // The mounted scheduler republishes the lane report every schedule tick, so
  // capture the published lane snapshot atomically inside the wait predicate
  // instead of racing a follow-up evaluate against the next tick.
  await page.waitForFunction(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const execution = overlay?.__mlsMpmResidentSteps || null;
    const lane = overlay?.__sphMountedMechanicsStageWorkerLane || null;
    const ready = Boolean(
      execution?.finalStep?.schroederParticleStorageAdoptionStatus === 'schroeder-particle-storage-adopted'
      && lane?.status === 'worker-stage-lane-published'
    );
    if (ready && !globalThis.__ssStoragePolicyPublishedLane) {
      globalThis.__ssStoragePolicyPublishedLane = lane;
    }
    return ready;
  }, null, { timeout: 160_000 });

  const result = await page.evaluate(async () => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const execution = overlay?.__mlsMpmResidentSteps || null;
    const lane = globalThis.__ssStoragePolicyPublishedLane
      || overlay?.__sphMountedMechanicsStageWorkerLane
      || null;
    const policy = execution?.residentExecutionPolicy || overlay?.__mlsMpmResidentExecutionPolicy || {};
    const publication = execution?.schroederAdoptedParticleStoragePublication || null;
    const host = globalThis.__ulgResidentAuthorityHost || null;
    const hotRecord = publication?.hotBufferKey
      ? host?.stateManager?.getHotBuffer?.(publication.hotBufferKey)
      : null;
    await overlay?.__sphScene?.dispose?.();
    await host?.destroy?.();
    globalThis.__ulgResidentAuthorityHost = null;
    return {
      executionStatus: execution?.status ?? null,
      backend: execution?.backend ?? null,
      schroederSimulation: execution?.schroederSimulation === true,
      materializationPolicyEnabled: policy?.schroederParticleStorageMaterializationPolicyEnabled === true,
      phaseSplitMergePublicationStatus:
        policy?.schroederPhaseVolumeSplitMergeAdmissionPublicationStatus ?? null,
      allocatorPublicationStatus:
        policy?.schroederParticleStorageAllocatorAdmissionPublicationStatus ?? null,
      slotAssignmentPublicationStatus:
        policy?.schroederParticleStorageSlotAssignmentAdmissionPublicationStatus ?? null,
      materializationPublicationStatus:
        policy?.schroederParticleStorageMaterializationAdmissionPublicationStatus ?? null,
      freeListStatus: policy?.schroederParticleStorageFreeListStatus ?? null,
      materializationStatus:
        execution?.finalStep?.schroederParticleStorageMaterializationStatus ?? null,
      adoptionStatus:
        execution?.finalStep?.schroederParticleStorageAdoptionStatus ?? null,
      adopted: execution?.finalStep?.schroederParticleStorageAdopted === true,
      publicationStatus: publication?.status ?? null,
      publicationAccepted: publication?.accepted === true,
      publicationLocalResolverReady:
        publication?.schroederAdoptedParticleStorageLocalRetainedBufferResolverReady === true,
      hotRecordCopyMode: hotRecord?.copyMode ?? null,
      laneStatus: lane?.status ?? null,
      laneAdoptedPublicationStatus:
        lane?.schroederAdoptedParticleStoragePublicationStatus ?? null,
      laneAdoptedLocalResolverReady:
        lane?.schroederAdoptedParticleStorageLocalResolverReady === true,
      laneAdoptedScheduleStatus:
        lane?.schroederAdoptedParticleStorageContinuationScheduleStatus ?? null,
      laneAdoptedStageLocalResolverReady:
        lane?.schroederAdoptedParticleStorageStageLocalResolverReady === true,
      laneAdoptedRawGpuBufferTransfer:
        lane?.schroederAdoptedParticleStorageRawGpuBufferPeerComputeTransfer === true,
      laneStageChainStatus: lane?.stageChainStatus ?? null,
      laneStageOrder: lane?.gpuResidentLaneStageExecutionStageOrder ?? []
    };
  });

  expect(result.executionStatus).toBe('resident-steps-executed');
  expect(result.backend).toBe('webgpu');
  expect(result.schroederSimulation).toBe(true);
  expect(result.materializationPolicyEnabled).toBe(true);
  expect(result.phaseSplitMergePublicationStatus)
    .toBe('schroeder-phase-volume-split-merge-admission-published');
  expect(result.allocatorPublicationStatus)
    .toBe('schroeder-particle-storage-allocator-admission-published');
  expect(result.slotAssignmentPublicationStatus)
    .toBe('schroeder-particle-storage-slot-assignment-admission-published');
  expect(result.materializationPublicationStatus)
    .toBe('schroeder-particle-storage-materialization-admission-published');
  expect(result.freeListStatus).toBe('schroeder-particle-storage-free-list-ready');
  expect(result.materializationStatus).toBe('schroeder-particle-storage-materialization-submitted');
  expect(result.adoptionStatus).toBe('schroeder-particle-storage-adopted');
  expect(result.adopted).toBe(true);
  expect(result.publicationStatus).toBe('schroeder-adopted-particle-storage-descriptor-published');
  expect(result.publicationAccepted).toBe(true);
  expect(result.publicationLocalResolverReady).toBe(true);
  expect(result.hotRecordCopyMode).toBe('descriptor-only-no-raw-gpubuffer-transfer');
  expect(result.laneStatus).toBe('worker-stage-lane-published');
  expect(result.laneAdoptedPublicationStatus)
    .toBe('schroeder-adopted-particle-storage-descriptor-published');
  expect(result.laneAdoptedLocalResolverReady).toBe(true);
  expect(result.laneAdoptedScheduleStatus)
    .toBe('blocked-schroeder-adopted-particle-storage-worker-lane-main-thread-refs');
  expect(result.laneAdoptedStageLocalResolverReady).toBe(false);
  expect(result.laneAdoptedRawGpuBufferTransfer).toBe(false);
  expect(result.laneStageChainStatus).toBe('compute-manager-stage-task-chain-executed');
  expect(result.laneStageOrder).toEqual(['p2g', 'gridUpdate', 'g2p']);
  expect(consoleIssues).toEqual([]);
});

test('SPH phase resident steps can use the real browser PeerCompute resident authority host', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1&dropn=2&basen=3&boxx=4&boxy=4&boxz=4&residentAuto=0&visualCapture=1');
  if (await page.locator('#sph-phase-overlay').count() === 0) {
    await page.locator('#run-sph-phase').click();
  }
  await expect(page.locator('#sph-phase-overlay')).toBeVisible();
  await page.waitForFunction(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const scene = overlay?.__sphScene;
    return Boolean(
      !overlay?.__sphCpuClosureTask?.active
      && scene?.getSphGpuParticleState?.()?.schema
      && scene?.getMlsMpmGpuParticleState?.()?.schema
      && typeof scene?.refreshMlsMpmResidentSteps === 'function'
    );
  }, null, { timeout: 90_000 });

  const result = await page.evaluate(async () => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const scene = overlay.__sphScene;
    const hostModule = await import('/src/runtime/peercomputeBrowserResidentHost.js');
    const evidenceModule = await import('/src/runtime/mechanicsPromotionEvidence.js');
    const host = await hostModule.createPeerComputeResidentAuthorityHost({
      computeTaskModulePath: '/src/runtime/sph/sphMlsMpmGpuStep.js',
      enableWorkers: false,
      enablePersistence: false,
      disableNetworkProvider: true,
      disableBroadcast: true
    });
    window.__ulgResidentAuthorityHost = host;
    try {
      const mechanicsOnlyChildTaskInput = {
        sphParticleState: scene.getSphGpuParticleState(),
        mlsMpmParticleState: scene.getMlsMpmGpuParticleState()
      };
      const execution = await scene.refreshMlsMpmResidentSteps({
        computeManager: host.computeManager,
        residentStateManager: host.stateManager,
        residentAuthorityHost: host,
        computeTaskModulePath: host.computeTaskModulePath,
        preferWebGpu: true,
        stepCount: 1,
        readbackMode: 'no-full-readback',
        compactSummaryScope: 'particle-visual',
        force: true
      });
      const warmDeltas = host.stateManager.getWarmDeltas('ulg-sph-resident-pass-dag');
      const taskId = execution?.commitDelta?.taskId ?? null;
      const sameDevicePublication = execution?.sameDeviceHotBufferSourcePublication || null;
      const sameDeviceSourceRecord = sameDevicePublication?.hotBufferKey
        ? host.stateManager.getHotBuffer(sameDevicePublication.hotBufferKey)
        : null;
      const sameDeviceRetainedBufferImport = execution?.sameDeviceRetainedBufferImport
        || sameDevicePublication?.sameDeviceRetainedBufferImport
        || null;
      const stats = host.computeManager.getStats?.();
      const summary = hostModule.summarizePeerComputeResidentAuthorityHost(host);
      const lawGraphManifest = host.lawGraphManifest || host.solverRegistration?.lawGraphManifest || null;
      const mechanicsOnlyChildTask = await host.submitMechanicsOnlyResidentStepsTask({
        ...mechanicsOnlyChildTaskInput,
        taskId: 'ulg:browser:mechanics-only-resident-steps-child',
        preferWebGpu: true,
        stepCount: 1,
        readbackMode: 'full-parity-readback',
        compactSummaryScope: 'particle-visual'
      });
      const mechanicsP2gStageTask = await host.submitMechanicsP2gStageTask({
        ...mechanicsOnlyChildTaskInput,
        taskId: 'ulg:browser:mechanics-p2g-stage-child',
        preferWebGpu: true,
        readbackMode: 'full-parity-readback',
        compactSummaryScope: 'particle-visual'
      });
      const mechanicsGridUpdateStageTask = await host.submitMechanicsGridUpdateStageTask({
        p2gGridProjection: mechanicsP2gStageTask,
        taskId: 'ulg:browser:mechanics-grid-update-stage-child',
        preferWebGpu: mechanicsP2gStageTask.backend === 'webgpu',
        readbackMode: 'full-parity-readback',
        compactSummaryScope: 'particle-visual'
      });
      const mechanicsG2pStageTask = await host.submitMechanicsG2pStageTask({
        ...mechanicsOnlyChildTaskInput,
        gridUpdate: mechanicsGridUpdateStageTask,
        taskId: 'ulg:browser:mechanics-g2p-stage-child',
        preferWebGpu: mechanicsGridUpdateStageTask.backend === 'webgpu',
        readbackMode: 'full-parity-readback',
        compactSummaryScope: 'particle-visual'
      });
      const mechanicsStageTaskChain = await host.runMechanicsStageTaskChain({
        ...mechanicsOnlyChildTaskInput,
        stageTaskIdPrefix: 'ulg:browser:mechanics-stage-task-chain',
        preferWebGpu: false,
        readbackMode: 'full-parity-readback',
        compactSummaryScope: 'particle-visual'
      });
      const mechanicsStageTaskDeviceResult = await scene.requestOpticalGpuDevice();
      const mechanicsStageTaskChainWebGpu = await host.runMechanicsStageTaskChain({
        ...mechanicsOnlyChildTaskInput,
        stageTaskIdPrefix: 'ulg:browser:mechanics-stage-webgpu-task-chain',
        preferWebGpu: true,
        useNativeTaskGraph: false,
        deviceResult: mechanicsStageTaskDeviceResult,
        readbackMode: 'full-parity-readback',
        compactSummaryScope: 'particle-visual',
        gpuResidentLaneId: 'ulg:browser:mechanics-stage-webgpu-task-chain-lane',
        gpuResidentLaneStateKey: 'ulg:browser:mechanics-stage-webgpu-task-chain-state'
      });
      const mechanicsStageTaskChainWebGpuSummary = {
        schema: mechanicsStageTaskChainWebGpu?.mechanicsStageTaskChain?.schema ?? null,
        status: mechanicsStageTaskChainWebGpu?.mechanicsStageTaskChain?.status ?? null,
        schedulerStatus: mechanicsStageTaskChainWebGpu?.mechanicsStageTaskChain?.schedulerStatus ?? null,
        stagePlanSchema: mechanicsStageTaskChainWebGpu?.mechanicsStageTaskChain?.gpuResidentLaneStagePlanSchema ?? null,
        stagePlanContractSchema: mechanicsStageTaskChainWebGpu?.mechanicsStageTaskChain?.gpuResidentLaneStagePlanContractSchema ?? null,
        stageExecutionStatus: mechanicsStageTaskChainWebGpu?.mechanicsStageTaskChain?.gpuResidentLaneStageExecutionStatus ?? null,
        stageExecutionCompletedStageCount: mechanicsStageTaskChainWebGpu?.mechanicsStageTaskChain?.gpuResidentLaneStageExecutionCompletedStageCount ?? null,
        stageExecutionStageOrder: mechanicsStageTaskChainWebGpu?.mechanicsStageTaskChain?.gpuResidentLaneStageExecutionStageOrder ?? [],
        stageExecutionExecutorSources: mechanicsStageTaskChainWebGpu?.mechanicsStageTaskChain?.gpuResidentLaneStageExecutionExecutorSources ?? {},
        stageExecutionUsedGpuHubExecutors: mechanicsStageTaskChainWebGpu?.mechanicsStageTaskChain?.gpuResidentLaneStageExecutionUsedGpuHubExecutors ?? null,
        stageExecutionWorkerResidencyStatuses: mechanicsStageTaskChainWebGpu?.mechanicsStageTaskChain?.gpuResidentLaneStageExecutionWorkerResidencyStatuses ?? {},
        stageExecutionRequestedWorkerResidency: mechanicsStageTaskChainWebGpu?.mechanicsStageTaskChain?.gpuResidentLaneStageExecutionRequestedWorkerResidency ?? null,
        gpuHubResidentStageExecutorMode: mechanicsStageTaskChainWebGpu?.mechanicsStageTaskChain?.gpuHubResidentStageExecutorMode ?? null,
        gpuHubResidentStageExecutorRegisteredCount: mechanicsStageTaskChainWebGpu?.mechanicsStageTaskChain?.gpuHubResidentStageExecutorRegisteredCount ?? null,
        gpuHubResidentStageExecutorStageIds: mechanicsStageTaskChainWebGpu?.mechanicsStageTaskChain?.gpuHubResidentStageExecutorStageIds ?? [],
        stageLeaseFenceSatisfied: mechanicsStageTaskChainWebGpu?.mechanicsStageTaskChain?.gpuResidentLaneStageLeaseFenceSatisfied ?? null,
        stageTaskLaneAligned: mechanicsStageTaskChainWebGpu?.mechanicsStageTaskChain?.gpuResidentLaneStageTaskLaneAligned ?? null,
        stageTaskLaneIds: mechanicsStageTaskChainWebGpu?.mechanicsStageTaskChain?.gpuResidentLaneStageTaskLaneIds ?? {},
        stageTaskStateKeys: mechanicsStageTaskChainWebGpu?.mechanicsStageTaskChain?.gpuResidentLaneStageTaskStateKeys ?? {},
        stageTaskBackends: mechanicsStageTaskChainWebGpu?.mechanicsStageTaskChain?.gpuResidentLaneStageTaskBackends ?? {},
        stageTaskResidencies: mechanicsStageTaskChainWebGpu?.mechanicsStageTaskChain?.gpuResidentLaneStageTaskResidencies ?? {},
        stageTaskFenceSatisfied: mechanicsStageTaskChainWebGpu?.mechanicsStageTaskChain?.gpuResidentLaneStageTaskFenceSatisfied ?? {},
        submittedStageTasks: (mechanicsStageTaskChainWebGpu?.mechanicsStageTaskChain?.submittedStageTasks ?? []).map((task) => ({
          stageId: task.stageId,
          residency: task.residency,
          gpuResidentLaneLaneId: task.gpuResidentLaneLaneId,
          gpuResidentLaneStateKey: task.gpuResidentLaneStateKey,
          gpuFenceRequired: task.gpuFenceRequired
        })),
        allStageTaskEvidencePassed: mechanicsStageTaskChainWebGpu?.mechanicsStageTaskChain?.allStageTaskEvidencePassed ?? null,
        splitStageTaskBoundaries: mechanicsStageTaskChainWebGpu?.mechanicsOnlySplitPath?.stageTaskBoundaries ?? null
      };
      const mechanicsStageWorkerRunner = host.createUlgMechanicsResidentStageWorkerRunner({ timeoutMs: 60000 });
      let mechanicsStageTaskChainWorker = null;
      let mechanicsStageTaskChainWorkerContinuation = null;
      let disposeMechanicsStageWorkerRunner = true;
      try {
        mechanicsStageTaskChainWorker = await host.runMechanicsStageTaskChain({
          ...mechanicsOnlyChildTaskInput,
          stageTaskIdPrefix: 'ulg:browser:mechanics-stage-worker-bridge-chain',
          preferWebGpu: true,
          useNativeTaskGraph: false,
          readbackMode: 'no-full-readback',
          compactSummaryScope: 'particle-visual',
          gpuResidentLaneId: 'ulg:browser:mechanics-stage-worker-bridge-chain-lane',
          gpuResidentLaneStateKey: 'ulg:browser:mechanics-stage-worker-bridge-chain-state',
          gpuHubResidentStageWorkerRunner: mechanicsStageWorkerRunner,
          gpuHubResidentStageWorkerModuleUrl: host.ulgMechanicsResidentStageWorkerModulePath,
          sameDeviceRetainedBufferImport,
          gpuHubResidentStageWorkerOutputPublisher: (payload) => host.publishWorkerRetainedMechanicsStageOutput({
            ...payload,
            sameDeviceRetainedBufferImport
          })
        });
        if (mechanicsStageTaskChainWorker?.mechanicsStageTaskChain?.workerCompactPublicationCommitted === true) {
          mechanicsStageTaskChainWorkerContinuation = await host.runMechanicsStageTaskChain({
            ...mechanicsOnlyChildTaskInput,
            stageTaskIdPrefix: 'ulg:browser:mechanics-stage-worker-retained-continuation',
            preferWebGpu: true,
            useNativeTaskGraph: false,
            readbackMode: 'no-full-readback',
            compactSummaryScope: 'particle-visual',
            gpuResidentLaneId: 'ulg:browser:mechanics-stage-worker-bridge-chain-lane',
            gpuResidentLaneStateKey: 'ulg:browser:mechanics-stage-worker-bridge-chain-state',
            gpuHubResidentStageWorkerRunner: mechanicsStageWorkerRunner,
            gpuHubResidentStageWorkerModuleUrl: host.ulgMechanicsResidentStageWorkerModulePath,
            sameDeviceRetainedBufferImport,
            gpuHubResidentStageWorkerOutputPublisher: (payload) => host.publishWorkerRetainedMechanicsStageOutput({
              ...payload,
              sameDeviceRetainedBufferImport
            }),
            gpuHubResidentThermalStageWorkerOutputPublisher: (payload) => host.publishWorkerRetainedThermalPhaseStageOutput(payload),
            gpuHubResidentStageWorkerUseRetainedInput: true,
            includeThermalPhaseStage: true,
            thermalMaterialTable: scene.getSphThermalMaterialTable?.(),
            thermalClosureGraphSet: scene.getSphThermalClosureGraphBuffers?.(),
            thermalClosureGraphBank: scene.getSphThermalClosureGraphBuffers?.()?.graphBank ?? null,
            thermalPhaseResponseTable: scene.getSphThermalPhaseResponseTable?.(),
            boxDimsM: scene.getBoxDimensionsM?.() ?? [5, 5, 5],
            dtS: mechanicsOnlyChildTaskInput.mlsMpmParticleState?.mechanicsDtS ?? 0
          });
        }
        disposeMechanicsStageWorkerRunner = !(
          mechanicsStageTaskChainWorker?.mechanicsStageTaskChain?.workerCompactPublicationCommitted === true
          || mechanicsStageTaskChainWorkerContinuation?.mechanicsStageTaskChain?.workerCompactPublicationCommitted === true
        );
      } finally {
        if (disposeMechanicsStageWorkerRunner) mechanicsStageWorkerRunner.dispose?.();
      }
      const workerPublicationHotBufferKey = mechanicsStageTaskChainWorker?.mechanicsStageTaskChain?.workerCompactPublicationHotBufferKey || null;
      const workerPublicationRecord = workerPublicationHotBufferKey
        ? host.stateManager.getHotBuffer(workerPublicationHotBufferKey)
        : null;
      const workerPublicationWarmDeltas = host.stateManager.getWarmDeltas('ulg-worker-retained-mechanics-publications') || {};
      const workerPublicationWarmDelta = Object.values(workerPublicationWarmDeltas)
        .find((entry) => entry?.payload?.hotBufferKey === workerPublicationHotBufferKey) || null;
      const workerPublicationAccessContract = workerPublicationRecord?.workerRetainedAccessContract
        || workerPublicationRecord?.workerRetainedBufferImport?.workerRetainedAccessContract
        || workerPublicationWarmDelta?.payload?.workerRetainedAccessContract
        || null;
      const thermalPublicationHotBufferKey = mechanicsStageTaskChainWorkerContinuation?.mechanicsStageTaskChain?.thermalWorkerCompactPublicationHotBufferKey || null;
      const thermalPublicationRecord = thermalPublicationHotBufferKey
        ? host.stateManager.getHotBuffer(thermalPublicationHotBufferKey)
        : null;
      const thermalPublicationWarmDeltas = host.stateManager.getWarmDeltas('ulg-worker-retained-thermal-phase-publications') || {};
      const thermalPublicationWarmDelta = Object.values(thermalPublicationWarmDeltas)
        .find((entry) => entry?.payload?.hotBufferKey === thermalPublicationHotBufferKey) || null;
      const workerThermalLaneSummary = mechanicsStageTaskChainWorkerContinuation?.mechanicsStageTaskChain?.gpuResidentLaneStageTaskLaneSummaries?.thermalPhase || {};
      const mechanicsStageTaskChainWorkerSummary = {
        schema: mechanicsStageTaskChainWorker?.mechanicsStageTaskChain?.schema ?? null,
        status: mechanicsStageTaskChainWorker?.mechanicsStageTaskChain?.status ?? null,
        schedulerStatus: mechanicsStageTaskChainWorker?.mechanicsStageTaskChain?.schedulerStatus ?? null,
        stageExecutionStatus: mechanicsStageTaskChainWorker?.mechanicsStageTaskChain?.gpuResidentLaneStageExecutionStatus ?? null,
        stageExecutionCompletedStageCount: mechanicsStageTaskChainWorker?.mechanicsStageTaskChain?.gpuResidentLaneStageExecutionCompletedStageCount ?? null,
        stageExecutionStageOrder: mechanicsStageTaskChainWorker?.mechanicsStageTaskChain?.gpuResidentLaneStageExecutionStageOrder ?? [],
        stageExecutionExecutorSources: mechanicsStageTaskChainWorker?.mechanicsStageTaskChain?.gpuResidentLaneStageExecutionExecutorSources ?? {},
        stageExecutionWorkerResidencyStatuses: mechanicsStageTaskChainWorker?.mechanicsStageTaskChain?.gpuResidentLaneStageExecutionWorkerResidencyStatuses ?? {},
        stageExecutionWorkerRunnerSupplied: mechanicsStageTaskChainWorker?.mechanicsStageTaskChain?.gpuResidentLaneStageExecutionWorkerRunnerSupplied ?? null,
        stageExecutionWorkerModuleUrl: mechanicsStageTaskChainWorker?.mechanicsStageTaskChain?.gpuResidentLaneStageExecutionWorkerModuleUrl ?? null,
        stageTaskBackends: mechanicsStageTaskChainWorker?.mechanicsStageTaskChain?.gpuResidentLaneStageTaskBackends ?? {},
        stageTaskReadbackModes: mechanicsStageTaskChainWorker?.mechanicsStageTaskChain?.gpuResidentLaneStageTaskReadbackModes ?? {},
        stageTaskNormalHotLoopReadbackFree: mechanicsStageTaskChainWorker?.mechanicsStageTaskChain?.gpuResidentLaneStageTaskNormalHotLoopReadbackFree ?? {},
        stageTaskFenceSatisfied: mechanicsStageTaskChainWorker?.mechanicsStageTaskChain?.gpuResidentLaneStageTaskFenceSatisfied ?? {},
        stageLeaseFenceSatisfied: mechanicsStageTaskChainWorker?.mechanicsStageTaskChain?.gpuResidentLaneStageLeaseFenceSatisfied ?? null,
        workerCompactPublicationCandidate: mechanicsStageTaskChainWorker?.mechanicsStageTaskChain?.workerCompactPublicationCandidate ?? null,
        workerCompactPublication: mechanicsStageTaskChainWorker?.mechanicsStageTaskChain?.workerCompactPublication ?? null,
        workerCompactPublicationCandidateStatus: mechanicsStageTaskChainWorker?.mechanicsStageTaskChain?.workerCompactPublicationCandidateStatus ?? null,
        workerCompactPublicationCandidateSameDeviceRetainedBufferImportAvailable:
          mechanicsStageTaskChainWorker?.mechanicsStageTaskChain?.workerCompactPublicationCandidateSameDeviceRetainedBufferImportAvailable ?? null,
        workerCompactPublicationCandidateSameDeviceSourceHotBufferKey:
          mechanicsStageTaskChainWorker?.mechanicsStageTaskChain?.workerCompactPublicationCandidateSameDeviceSourceHotBufferKey ?? null,
        workerCompactPublicationCandidateLocalMaterializationStatus:
          mechanicsStageTaskChainWorker?.mechanicsStageTaskChain?.workerCompactPublicationCandidateLocalMaterializationStatus ?? null,
        workerCompactPublicationCandidateAcceptedMaterializationModes:
          mechanicsStageTaskChainWorker?.mechanicsStageTaskChain?.workerCompactPublicationCandidateAcceptedMaterializationModes ?? [],
        workerCompactPublicationStatus: mechanicsStageTaskChainWorker?.mechanicsStageTaskChain?.workerCompactPublicationStatus ?? null,
        workerCompactPublicationCommitted: mechanicsStageTaskChainWorker?.mechanicsStageTaskChain?.workerCompactPublicationCommitted ?? null,
        workerCompactPublicationHotBufferKey: workerPublicationHotBufferKey,
        workerCompactPublicationCommitDeltaTaskId: mechanicsStageTaskChainWorker?.mechanicsStageTaskChain?.workerCompactPublicationCommitDeltaTaskId ?? null,
        workerCompactPublicationSameDeviceRetainedBufferImportAvailable:
          mechanicsStageTaskChainWorker?.mechanicsStageTaskChain?.workerCompactPublicationSameDeviceRetainedBufferImportAvailable ?? null,
        workerCompactPublicationSameDeviceSourceHotBufferKey:
          mechanicsStageTaskChainWorker?.mechanicsStageTaskChain?.workerCompactPublicationSameDeviceSourceHotBufferKey ?? null,
        workerCompactPublicationHotBufferStored: Boolean(workerPublicationRecord),
        workerCompactPublicationRecordStatus: workerPublicationRecord?.status ?? null,
        workerCompactPublicationRecordHasWorkerRunner: Boolean(workerPublicationRecord?.workerRunner),
        workerCompactPublicationRecordSameDeviceRetainedBufferImportAvailable:
          workerPublicationRecord?.sameDeviceRetainedBufferImportAvailable ?? null,
        workerCompactPublicationRecordSameDeviceSourceHotBufferKey:
          workerPublicationRecord?.sameDeviceSourceHotBufferKey ?? null,
        workerCompactPublicationWarmDeltaFound: Boolean(workerPublicationWarmDelta),
        workerCompactPublicationWarmDeltaStatus: workerPublicationWarmDelta?.payload?.status ?? null,
        workerCompactPublicationWarmDeltaSameDeviceRetainedBufferImportAvailable:
          workerPublicationWarmDelta?.payload?.sameDeviceRetainedBufferImportAvailable ?? null,
        workerCompactPublicationWarmDeltaSameDeviceSourceHotBufferKey:
          workerPublicationWarmDelta?.payload?.sameDeviceSourceHotBufferKey ?? null,
        workerRetainedAccessContractStatus: workerPublicationAccessContract?.status ?? null,
        workerRetainedAccessContractMainThreadGpuHandlesAvailable:
          workerPublicationAccessContract?.mainThreadGpuHandlesAvailable ?? null,
        workerRetainedAccessContractSameDeviceRetainedBufferImportAvailable:
          workerPublicationAccessContract?.sameDeviceRetainedBufferImportAvailable ?? null,
        workerRetainedAccessContractSameDeviceSourceHotBufferKey:
          workerPublicationAccessContract?.sameDeviceSourceHotBufferKey ?? null,
        workerRetainedAccessContractLocalMaterializationStatus:
          workerPublicationAccessContract?.localMaterializationStatus ?? null,
        workerRetainedAccessContractAcceptedMaterializationModes:
          workerPublicationAccessContract?.acceptedMaterializationModes ?? [],
        workerRetainedAccessContractAcceptedConsumerModes:
          workerPublicationAccessContract?.acceptedConsumerModes ?? [],
        workerCompactSummaryStatus: mechanicsStageTaskChainWorker?.mechanicsStageTaskChain?.workerCompactSummaryStatus ?? null,
        workerRetainedBufferRefCount: mechanicsStageTaskChainWorker?.mechanicsStageTaskChain?.workerRetainedBufferRefCount ?? null,
        workerP2gRetainedThermoInputStatus: mechanicsStageTaskChainWorker?.mechanicsStageTaskChain?.gpuResidentLaneStageTaskLaneSummaries?.p2g?.workerRetainedThermoInputStatus ?? null,
        workerG2pRetainedThermoInputStatus: mechanicsStageTaskChainWorker?.mechanicsStageTaskChain?.gpuResidentLaneStageTaskLaneSummaries?.g2p?.workerRetainedThermoInputStatus ?? null,
        workerContinuationStatus: mechanicsStageTaskChainWorkerContinuation?.mechanicsStageTaskChain?.status ?? null,
        workerContinuationStageTaskBackends: mechanicsStageTaskChainWorkerContinuation?.mechanicsStageTaskChain?.gpuResidentLaneStageTaskBackends ?? {},
        workerContinuationStageTaskFenceSatisfied: mechanicsStageTaskChainWorkerContinuation?.mechanicsStageTaskChain?.gpuResidentLaneStageTaskFenceSatisfied ?? {},
        workerContinuationP2gRetainedInputStatus: mechanicsStageTaskChainWorkerContinuation?.mechanicsStageTaskChain?.gpuResidentLaneStageTaskLaneSummaries?.p2g?.workerRetainedContinuationInputStatus ?? null,
        workerContinuationP2gRetainedThermoInputStatus: mechanicsStageTaskChainWorkerContinuation?.mechanicsStageTaskChain?.gpuResidentLaneStageTaskLaneSummaries?.p2g?.workerRetainedThermoInputStatus ?? null,
        workerContinuationG2pRetainedThermoInputStatus: mechanicsStageTaskChainWorkerContinuation?.mechanicsStageTaskChain?.gpuResidentLaneStageTaskLaneSummaries?.g2p?.workerRetainedThermoInputStatus ?? null,
        workerContinuationPublicationStatus: mechanicsStageTaskChainWorkerContinuation?.mechanicsStageTaskChain?.workerCompactPublicationStatus ?? null,
        workerContinuationPublicationCommitted: mechanicsStageTaskChainWorkerContinuation?.mechanicsStageTaskChain?.workerCompactPublicationCommitted ?? null,
        workerThermalStageInFormalDag: mechanicsStageTaskChainWorkerContinuation?.mechanicsStageTaskChain?.gpuResidentLaneStageExecutionStageOrder?.includes?.('thermalPhase') ?? null,
        workerThermalStageExecutorSource: mechanicsStageTaskChainWorkerContinuation?.mechanicsStageTaskChain?.gpuResidentLaneStageExecutionExecutorSources?.thermalPhase ?? null,
        workerThermalStageWorkerResidencyStatus: mechanicsStageTaskChainWorkerContinuation?.mechanicsStageTaskChain?.gpuResidentLaneStageExecutionWorkerResidencyStatuses?.thermalPhase ?? null,
        workerThermalStageStatus: workerThermalLaneSummary.workerResidentStageStatus ?? null,
        workerThermalStageBackend: mechanicsStageTaskChainWorkerContinuation?.mechanicsStageTaskChain?.gpuResidentLaneStageTaskBackends?.thermalPhase ?? null,
        workerThermalStageExecutionStatus: mechanicsStageTaskChainWorkerContinuation?.mechanicsStageTaskChain?.gpuResidentLaneStageTaskExecutionStatuses?.thermalPhase ?? null,
        workerThermalStageReadbackMode: mechanicsStageTaskChainWorkerContinuation?.mechanicsStageTaskChain?.gpuResidentLaneStageTaskReadbackModes?.thermalPhase ?? null,
        workerThermalStageNormalHotLoopReadbackFree: mechanicsStageTaskChainWorkerContinuation?.mechanicsStageTaskChain?.gpuResidentLaneStageTaskNormalHotLoopReadbackFree?.thermalPhase ?? null,
        workerThermalStageQueueFenceSatisfied: mechanicsStageTaskChainWorkerContinuation?.mechanicsStageTaskChain?.gpuResidentLaneStageTaskFenceSatisfied?.thermalPhase ?? null,
        workerThermalStageThermoInputStatus: workerThermalLaneSummary.workerRetainedThermoInputStatus ?? null,
        workerThermalStageThermoOutputStatus: workerThermalLaneSummary.workerRetainedThermoOutputStatus ?? null,
        workerThermalStageEvidencePassed: mechanicsStageTaskChainWorkerContinuation?.mechanicsStageTaskChain?.stageTaskEvidencePassed?.thermalPhase ?? null,
        workerThermalStageAuthoritativeMutation: workerThermalLaneSummary.thermalPhaseAuthoritativeMutation ?? null,
        thermalWorkerCompactPublicationCandidate: mechanicsStageTaskChainWorkerContinuation?.mechanicsStageTaskChain?.thermalWorkerCompactPublicationCandidate ?? null,
        thermalWorkerCompactPublicationCandidateStatus: mechanicsStageTaskChainWorkerContinuation?.mechanicsStageTaskChain?.thermalWorkerCompactPublicationCandidateStatus ?? null,
        thermalWorkerCompactPublication: mechanicsStageTaskChainWorkerContinuation?.mechanicsStageTaskChain?.thermalWorkerCompactPublication ?? null,
        thermalWorkerCompactPublicationStatus: mechanicsStageTaskChainWorkerContinuation?.mechanicsStageTaskChain?.thermalWorkerCompactPublicationStatus ?? null,
        thermalWorkerCompactPublicationCommitted: mechanicsStageTaskChainWorkerContinuation?.mechanicsStageTaskChain?.thermalWorkerCompactPublicationCommitted ?? null,
        thermalWorkerCompactPublicationHotBufferKey: thermalPublicationHotBufferKey,
        thermalWorkerCompactPublicationCommitDeltaTaskId: mechanicsStageTaskChainWorkerContinuation?.mechanicsStageTaskChain?.thermalWorkerCompactPublicationCommitDeltaTaskId ?? null,
        thermalWorkerCompactPublicationHotBufferStored: Boolean(thermalPublicationRecord),
        thermalWorkerCompactPublicationRecordStatus: thermalPublicationRecord?.status ?? null,
        thermalWorkerCompactPublicationRecordHasWorkerRunner: Boolean(thermalPublicationRecord?.workerRunner),
        thermalWorkerCompactPublicationWarmDeltaFound: Boolean(thermalPublicationWarmDelta),
        thermalWorkerCompactPublicationWarmDeltaStatus: thermalPublicationWarmDelta?.payload?.status ?? null,
        thermalWorkerCompactPublicationWarmDeltaOutputFamilies: thermalPublicationWarmDelta?.payload?.outputFamilies ?? [],
        thermalWorkerRetainedThermoBufferRefCount: mechanicsStageTaskChainWorkerContinuation?.mechanicsStageTaskChain?.thermalWorkerRetainedThermoBufferRefCount ?? null
      };
      const registeredSolvers = host.computeManager.listSolvers?.() || [];
      const residentSolver = registeredSolvers.find((solver) => solver.id === 'ulg-mls-mpm-sph-resident-steps') || null;
      const residentLawFamilySolvers = registeredSolvers
        .filter((solver) => solver.metadata?.parentLawGraphNodeId === 'ulg-mls-mpm-sph-resident-pass-dag')
        .sort((a, b) => a.metadata.lawGraphNode.order - b.metadata.lawGraphNode.order);
      const residentLawFamilyTaskErrors = {};
      for (const solver of residentLawFamilySolvers) {
        try {
          host.computeManager.submitSolverTask?.(solver.id, {
            stateKey: 'ulg:test:browser-metadata-only-law-family'
          });
          residentLawFamilyTaskErrors[solver.id] = null;
        } catch (error) {
          residentLawFamilyTaskErrors[solver.id] = error instanceof Error ? error.message : String(error);
        }
      }
      const missingMechanicsPromotion = host.admitLawFamilyPromotion({
        solverId: 'ulg-mls-mpm-mechanics-law'
      });
      const completeMechanicsEvidence = Object.fromEntries(
        (missingMechanicsPromotion.requiredEvidence || []).map((key) => [key, true])
      );
      const structuredMechanicsEvidence = await evidenceModule.createUlgMechanicsPromotionReferenceEvidence({
        ownerMap: {
          passed: true,
          status: lawGraphManifest?.stateFamilyOwnerMapStatus ?? 'single-current-owner-per-family',
          firstPromotionCandidateNodeId: lawGraphManifest?.firstPromotionCandidateNodeId ?? 'ulg-mls-mpm-mechanics-law'
        },
        gpuFence: {
          passed: execution?.gpuFence?.fenceSatisfied === true,
          fenceSatisfied: execution?.gpuFence?.fenceSatisfied === true,
          sameDevice: true
        },
        stateManagerAdmission: {
          accepted: execution?.computeManagerTask?.stateManagerCommitAccepted === true,
          status: execution?.computeManagerTask?.stateManagerCommitAccepted === true ? 'accepted' : 'rejected'
        },
        committedDeltaAdmission: {
          accepted: execution?.stateManagerCommit?.accepted === true
            || execution?.stateManagerCommit?.status === 'committed',
          status: execution?.stateManagerCommit?.status ?? null
        },
        visualSequence: {
          passed: true,
          status: 'pass',
          failedCount: 0
        }
      });
      const admittedMechanicsPromotion = host.admitLawFamilyPromotion({
        solverId: 'ulg-mls-mpm-mechanics-law',
        evidence: completeMechanicsEvidence
      });
      const blockedThermalPromotion = host.admitLawFamilyPromotion({
        solverId: 'ulg-thermal-phase-law',
        evidence: completeMechanicsEvidence
      });
      const missingMechanicsPromotionTask = await host.submitLawFamilyPromotionAdmissionTask({
        solverId: 'ulg-mls-mpm-mechanics-law',
        taskId: 'ulg:browser:mechanics-promotion-missing-evidence'
      });
      const mechanicsChildDryRunTask = await host.submitMechanicsChildDryRunTask({
        referenceEvidence: structuredMechanicsEvidence,
        mechanicsOnlyChildTaskEvidence: mechanicsOnlyChildTask,
        taskId: 'ulg:browser:mechanics-child-dry-run'
      });
      const mechanicsPromotionEvidenceTask = await host.submitMechanicsPromotionEvidenceTask({
        requiredEvidence: missingMechanicsPromotion.requiredEvidence || [],
        mechanicsEvidence: mechanicsChildDryRunTask,
        taskId: 'ulg:browser:mechanics-promotion-evidence'
      });
      const admittedMechanicsPromotionTask = await host.submitLawFamilyPromotionAdmissionTask({
        solverId: 'ulg-mls-mpm-mechanics-law',
        evidence: mechanicsPromotionEvidenceTask,
        taskId: 'ulg:browser:mechanics-promotion-admitted'
      });
      const taskStatsAfterPromotion = host.computeManager.getStats?.();
      const result = {
        hostSchema: host.schema,
        hostStatus: host.status,
        hostSource: host.source,
        summary,
        lawGraphManifestSchema: lawGraphManifest?.schema ?? null,
        lawGraphManifestNodeCount: lawGraphManifest?.nodeCount ?? null,
        lawGraphManifestEdgeCount: lawGraphManifest?.edgeCount ?? null,
        lawGraphManifestExecutableNodeIds: lawGraphManifest?.executableNodeIds ?? [],
        lawGraphManifestMetadataOnlyNodeIds: lawGraphManifest?.metadataOnlyNodeIds ?? [],
        lawGraphManifestParentEdgeCount: (lawGraphManifest?.edges ?? [])
          .filter((edge) => edge.relation === 'parent-pass-dag-child').length,
        lawGraphManifestDependencyEdgeCount: (lawGraphManifest?.edges ?? [])
          .filter((edge) => edge.relation === 'data-dependency').length,
        lawGraphManifestReadStateFamilies: lawGraphManifest?.readStateFamilies ?? [],
        lawGraphManifestWriteStateFamilies: lawGraphManifest?.writeStateFamilies ?? [],
        lawGraphManifestAuthoritativeWriteResidentStateFamilies: lawGraphManifest?.authoritativeWriteResidentStateFamilies ?? [],
        lawGraphManifestStateFamilyOwnerMapStatus: lawGraphManifest?.stateFamilyOwnerMapStatus ?? null,
        lawGraphManifestStateFamilyOwnerConflicts: lawGraphManifest?.stateFamilyOwnerConflicts ?? [],
        lawGraphManifestCurrentOwnerNodeIds: lawGraphManifest?.currentStateFamilyOwners
          ? Object.fromEntries(
              Object.entries(lawGraphManifest.currentStateFamilyOwners)
                .map(([family, owner]) => [family, owner?.nodeId ?? null])
            )
          : {},
        lawGraphManifestProspectiveOwnerNodeIds: lawGraphManifest?.prospectiveStateFamilyOwners
          ? Object.fromEntries(
              Object.entries(lawGraphManifest.prospectiveStateFamilyOwners)
                .map(([family, owners]) => [family, (owners || []).map((owner) => owner.nodeId)])
            )
          : {},
        lawGraphManifestFirstPromotionCandidateNodeId: lawGraphManifest?.firstPromotionCandidateNodeId ?? null,
        lawGraphManifestFirstPromotionCandidateFamilies: lawGraphManifest?.firstPromotionCandidateFamilies ?? [],
        lawGraphManifestPromotionRule: lawGraphManifest?.promotionPolicy?.rule ?? null,
        nodeKernelFacadeSchema: host.nodeKernel?.schema ?? null,
        nodeKernelAuthoritySchema: host.nodeKernelAuthority?.schema ?? null,
        nodeKernelMode: host.nodeKernelMode ?? null,
        nodeKernelConstructor: host.nodeKernel?.constructor?.name ?? null,
        nodeKernelAuthorityConstructor: host.nodeKernelAuthority?.constructorName ?? null,
        nodeKernelAuthorityInitialized: host.nodeKernelAuthority?.initialized ?? null,
        nodeKernelAuthorityStarted: host.nodeKernelAuthority?.started ?? null,
        nodeKernelNetworkManagerReady: host.nodeKernelAuthority?.networkManagerReady ?? null,
        nodeKernelComputeManagerSame: host.nodeKernel?.getComputeManager?.() === host.computeManager,
        nodeKernelStateManagerSame: host.nodeKernel?.getStateManager?.() === host.stateManager,
        computeManagerConstructor: host.computeManager?.constructor?.name ?? null,
        stateManagerConstructor: host.stateManager?.constructor?.name ?? null,
        taskId,
        warmDeltaKeys: Object.keys(warmDeltas),
        warmPayloadSchema: taskId ? warmDeltas[taskId]?.payload?.schema ?? null : null,
        warmPayloadStateKey: taskId ? warmDeltas[taskId]?.payload?.stateKey ?? null : null,
        executionSchema: execution?.schema ?? null,
        computeManagerTaskStatus: execution?.computeManagerTask?.status ?? null,
        stateManagerCommitAccepted: execution?.computeManagerTask?.stateManagerCommitAccepted ?? null,
        stateManagerCommitStatus: execution?.stateManagerCommit?.status ?? null,
        stateManagerCommitGpuFenceSatisfied: execution?.stateManagerCommit?.gpuFenceSatisfied ?? null,
        sameDevicePublicationSchema: sameDevicePublication?.schema ?? null,
        sameDevicePublicationStatus: sameDevicePublication?.status ?? null,
        sameDevicePublicationSameDevice: sameDevicePublication?.sameDevice ?? null,
        sameDevicePublicationSourceMode: sameDevicePublication?.sourceMode ?? null,
        sameDevicePublicationSourceStage: sameDevicePublication?.sourceStage ?? null,
        sameDevicePublicationSourceTaskId: sameDevicePublication?.sourceTaskId ?? null,
        sameDevicePublicationHotBufferKey: sameDevicePublication?.hotBufferKey ?? null,
        sameDeviceImportSchema: execution?.sameDeviceRetainedBufferImport?.schema ?? null,
        sameDeviceImportSourceHotBufferKey: execution?.sameDeviceRetainedBufferImport?.sourceHotBufferKey ?? null,
        sameDeviceG2pImportSourceHotBufferKey: execution?.finalStep?.g2pReconstruction?.sameDeviceRetainedBufferImport?.sourceHotBufferKey ?? null,
        sameDeviceG2pGpuResultImportSourceHotBufferKey: execution?.finalStep?.g2pReconstruction?.gpuResult?.sameDeviceRetainedBufferImport?.sourceHotBufferKey ?? null,
        sameDeviceSourceRecordStatus: sameDeviceSourceRecord?.status ?? null,
        sameDeviceSourceRecordCopyMode: sameDeviceSourceRecord?.copyMode ?? null,
        sameDeviceSourceRecordHasSphStateBuffer: Boolean(sameDeviceSourceRecord?.sphUpload?.stateBuffer),
        sameDeviceSourceRecordHasSphThermoBuffer: Boolean(sameDeviceSourceRecord?.sphUpload?.thermoBuffer),
        sameDeviceSourceRecordHasMlsMpmMechanicsBuffer: Boolean(sameDeviceSourceRecord?.mlsMpmUpload?.mechanicsBuffer),
        gpuFenceSatisfied: execution?.gpuFence?.fenceSatisfied ?? null,
        finalStepBackend: execution?.finalStep?.backend ?? null,
        finalStepReadbackMode: execution?.finalStep?.readbackMode ?? null,
        peerComputeSolverTaskSchema: execution?.peerComputeSolverTask?.schema ?? null,
        peerComputeSolverTaskCreated: execution?.peerComputeSolverTask?.created ?? null,
        peerComputeSolverTaskStatus: execution?.peerComputeSolverTask?.status ?? null,
        peerComputeSolverTaskSolverId: execution?.peerComputeSolverTask?.solverId ?? null,
        peerComputeSolverTaskAffinityKey: execution?.peerComputeSolverTask?.affinityKey ?? null,
        peerComputeSolverTaskWarmDeltaScope: execution?.peerComputeSolverTask?.warmDeltaScope ?? null,
        computeManagerTaskSolverId: execution?.computeManagerTask?.solverId ?? null,
        computeManagerTaskSolverTaskCreated: execution?.computeManagerTask?.solverTaskCreated ?? null,
        computeManagerTaskSolverTaskSchema: execution?.computeManagerTask?.solverTaskSchema ?? null,
        computeManagerTaskSolverTaskWarmDeltaScope: execution?.computeManagerTask?.solverTaskWarmDeltaScope ?? null,
        totalTasksCompleted: stats?.totalTasksCompleted ?? null,
        laneCompletedLeaseCount: stats?.gpuResidentLanes?.completedLeaseCount ?? null,
        solverRegistrationStatus: host.solverRegistration?.status ?? null,
        solverRegistrationIds: host.solverRegistration?.solverIds ?? [],
        residentSolverSchema: residentSolver?.schema ?? null,
        residentSolverRuntime: residentSolver?.runtime ?? null,
        residentSolverModule: residentSolver?.module ?? null,
        residentSolverWarmDeltaScope: residentSolver?.warmDelta?.scope ?? null,
        residentSolverLawNodeId: residentSolver?.metadata?.lawGraphNode?.nodeId ?? null,
        residentSolverWebGpuResidency: residentSolver?.webgpu?.residency ?? null,
        residentLawFamilySolverIds: residentLawFamilySolvers.map((solver) => solver.id),
        residentLawFamilyRuntimes: Object.fromEntries(
          residentLawFamilySolvers.map((solver) => [solver.id, solver.runtime])
        ),
        residentLawFamilyHasExecutor: Object.fromEntries(
          residentLawFamilySolvers.map((solver) => [solver.id, solver.hasExecutor === true])
        ),
        residentLawFamilyScopes: Object.fromEntries(
          residentLawFamilySolvers.map((solver) => [solver.id, solver.warmDelta?.scope ?? null])
        ),
        residentLawFamilyParentNodes: Object.fromEntries(
          residentLawFamilySolvers.map((solver) => [solver.id, solver.metadata?.lawGraphNode?.parentNodeId ?? null])
        ),
        residentLawFamilyTaskErrors,
        promotionAdmissionFunctionReady: typeof host.computeManager?.ulgLawFamilyPromotionAdmission === 'function',
        promotionAdmissionTaskReady: typeof host.submitLawFamilyPromotionAdmissionTask === 'function',
        promotionAdmissionId: host.computeManager?.ulgLawFamilyPromotionAdmissionId ?? null,
        mechanicsPromotionEvidenceTaskReady: typeof host.submitMechanicsPromotionEvidenceTask === 'function',
        mechanicsChildDryRunTaskReady: typeof host.submitMechanicsChildDryRunTask === 'function',
        mechanicsOnlyResidentStepsTaskReady: typeof host.submitMechanicsOnlyResidentStepsTask === 'function',
        mechanicsP2gStageTaskReady: typeof host.submitMechanicsP2gStageTask === 'function',
        mechanicsGridUpdateStageTaskReady: typeof host.submitMechanicsGridUpdateStageTask === 'function',
        mechanicsG2pStageTaskReady: typeof host.submitMechanicsG2pStageTask === 'function',
        mechanicsStageTaskChainReady: typeof host.runMechanicsStageTaskChain === 'function',
        structuredMechanicsEvidenceSchema: structuredMechanicsEvidence.schema ?? null,
        structuredMechanicsEvidenceGeneratedBy: structuredMechanicsEvidence.generatedBy ?? null,
        structuredMechanicsEvidenceZeroForcePassed: structuredMechanicsEvidence.zeroForceRest?.passed === true,
        structuredMechanicsEvidenceGravityOnlyPassed: structuredMechanicsEvidence.gravityOnly?.passed === true,
        structuredMechanicsEvidenceMechanicsOnlyPassed: structuredMechanicsEvidence.mechanicsOnlyStageContract?.passed === true,
        structuredMechanicsEvidenceMechanicsOnlyEntrypoint: structuredMechanicsEvidence.mechanicsOnlyExecutionPath?.status ?? null,
        structuredMechanicsEvidenceMechanicsOnlyStepSource: structuredMechanicsEvidence.mechanicsOnlyExecutionPath?.zeroForce?.stepSource ?? null,
        missingMechanicsPromotion,
        admittedMechanicsPromotion,
        blockedThermalPromotion,
        missingMechanicsPromotionTask,
        mechanicsOnlyChildTask,
        mechanicsP2gStageTask,
        mechanicsGridUpdateStageTask,
        mechanicsG2pStageTask,
        mechanicsStageTaskChain,
        mechanicsStageTaskChainWebGpu: mechanicsStageTaskChainWebGpuSummary,
        mechanicsStageTaskChainWorker: mechanicsStageTaskChainWorkerSummary,
        mechanicsChildDryRunTask,
        mechanicsPromotionEvidenceTask,
        admittedMechanicsPromotionTask,
        promotionAdmissionTaskFamilyCompleted: taskStatsAfterPromotion?.byTaskFamily?.['ulg-law-family-promotion-admission']?.completed ?? null,
        mechanicsOnlyChildTaskFamilyCompleted: taskStatsAfterPromotion?.byTaskFamily?.['ulg-mls-mpm-mechanics-only-resident-steps']?.completed ?? null,
        mechanicsP2gStageTaskFamilyCompleted: taskStatsAfterPromotion?.byTaskFamily?.['ulg-mls-mpm-mechanics-p2g-stage']?.completed ?? null,
        mechanicsGridUpdateStageTaskFamilyCompleted: taskStatsAfterPromotion?.byTaskFamily?.['ulg-mls-mpm-mechanics-grid-update-stage']?.completed ?? null,
        mechanicsG2pStageTaskFamilyCompleted: taskStatsAfterPromotion?.byTaskFamily?.['ulg-mls-mpm-mechanics-g2p-stage']?.completed ?? null,
        mechanicsChildDryRunTaskFamilyCompleted: taskStatsAfterPromotion?.byTaskFamily?.['ulg-mechanics-child-dry-run']?.completed ?? null,
        mechanicsPromotionEvidenceTaskFamilyCompleted: taskStatsAfterPromotion?.byTaskFamily?.['ulg-mechanics-promotion-evidence']?.completed ?? null
      };
      scene.dispose?.();
      overlay.__sphScene = null;
      await host.destroy();
      return result;
    } catch (error) {
      scene.dispose?.();
      overlay.__sphScene = null;
      await host.destroy?.();
      throw error;
    }
  });

  const expectedResidentLawFamilySolverIds = [
    'ulg-mls-mpm-mechanics-law',
    'ulg-thermal-phase-law',
    'ulg-reaction-product-gas-law',
    'ulg-pressure-interface-law'
  ];

  expect(result.hostSchema).toBe('peercompute.ulg.browser-resident-authority-host.v0');
  expect(result.hostStatus).toBe('ready');
  expect(result.hostSource).toBe('peercompute-browser-nodekernel-authority-host');
  expect(result.summary.computeManagerReady).toBe(true);
  expect(result.summary.stateManagerReady).toBe(true);
  expect(result.summary.bridgeStatus).toBe('attached');
  expect(result.summary.nodeKernelAuthority).toBe('peercompute.ulg.nodekernel-authority.v0');
  expect(result.summary.nodeKernelMode).toBe('real-peercompute-nodekernel');
  expect(result.summary.nodeKernelReady).toBe(true);
  expect(result.summary.nodeKernelStarted).toBe(false);
  expect(result.summary.nodeKernelConstructor).toBe('NodeKernel');
  expect(result.summary.residentSolverRegistrationStatus).toBe('registered');
  expect(result.summary.residentSolverIds).toContain('ulg-mls-mpm-sph-resident-steps');
  expect(result.summary.residentExecutableSolverIds).toEqual(['ulg-mls-mpm-sph-resident-steps']);
  expect(result.summary.residentLawFamilySolverIds).toEqual(expectedResidentLawFamilySolverIds);
  expect(result.summary.residentLawGraphId).toBe('peercompute.ulg.local-sph-law-closure-graph');
  expect(result.summary.residentLawGraphManifestSchema).toBe('peercompute.ulg.law-closure-graph-manifest.v0');
  expect(result.summary.residentLawGraphNodeCount).toBe(5);
  expect(result.summary.residentLawGraphEdgeCount).toBe(7);
  expect(result.summary.residentLawGraphExecutableNodeIds).toEqual(['ulg-mls-mpm-sph-resident-pass-dag']);
  expect(result.summary.residentLawGraphMetadataOnlyNodeIds).toEqual(expectedResidentLawFamilySolverIds);
  expect(result.summary.residentStateFamilyOwnerMapStatus).toBe('single-current-owner-per-family');
  expect(result.summary.residentStateFamilyOwnerConflicts).toEqual([]);
  expect(result.summary.residentCurrentStateFamilyOwnerNodeIds.mechanics).toBe('ulg-mls-mpm-sph-resident-pass-dag');
  expect(result.summary.residentCurrentStateFamilyOwnerNodeIds['gas-pressure']).toBe('ulg-mls-mpm-sph-resident-pass-dag');
  expect(result.summary.residentCurrentStateFamilyOwnerNodeIds['pressure-interface']).toBe('ulg-mls-mpm-sph-resident-pass-dag');
  expect(result.summary.residentProspectiveStateFamilyOwnerNodeIds.mechanics).toEqual(['ulg-mls-mpm-mechanics-law']);
  expect(result.summary.residentFirstPromotionCandidateNodeId).toBe('ulg-mls-mpm-mechanics-law');
  expect(result.summary.residentFirstPromotionCandidateFamilies).toEqual(['particle-kinematics', 'mechanics']);
  expect(result.summary.residentLawFamilyPromotionAdmissionReady).toBe(true);
  expect(result.summary.residentLawFamilyPromotionAdmissionTaskReady).toBe(true);
  expect(result.summary.residentLawFamilyPromotionAdmissionId).toBe('ulg-law-family-promotion-admission');
  expect(result.summary.residentMechanicsPromotionEvidenceTaskReady).toBe(true);
  expect(result.summary.residentMechanicsChildDryRunTaskReady).toBe(true);
  expect(result.summary.residentMechanicsOnlyResidentStepsTaskReady).toBe(true);
  expect(result.summary.residentMechanicsP2gStageTaskReady).toBe(true);
  expect(result.summary.residentMechanicsGridUpdateStageTaskReady).toBe(true);
  expect(result.summary.residentMechanicsG2pStageTaskReady).toBe(true);
  expect(result.summary.residentMechanicsStageTaskChainReady).toBe(true);
  expect(result.summary.peercomputeResidentStageWorkerBridgeAvailable).toBe(true);
  expect(result.summary.residentMechanicsStageWorkerRunnerFactoryReady).toBe(true);
  expect(result.summary.residentMechanicsStageWorkerModulePath).toBe('/src/services/ulgMechanicsResidentStage.worker.js');
  expect(result.lawGraphManifestSchema).toBe('peercompute.ulg.law-closure-graph-manifest.v0');
  expect(result.lawGraphManifestNodeCount).toBe(5);
  expect(result.lawGraphManifestEdgeCount).toBe(7);
  expect(result.lawGraphManifestExecutableNodeIds).toEqual(['ulg-mls-mpm-sph-resident-pass-dag']);
  expect(result.lawGraphManifestMetadataOnlyNodeIds).toEqual(expectedResidentLawFamilySolverIds);
  expect(result.lawGraphManifestParentEdgeCount).toBe(4);
  expect(result.lawGraphManifestDependencyEdgeCount).toBe(3);
  expect(result.lawGraphManifestReadStateFamilies).toContain('sedenion-periodic-table-scope');
  expect(result.lawGraphManifestWriteStateFamilies).toContain('resident-product-mass');
  expect(result.lawGraphManifestWriteStateFamilies).toContain('pressure-interface-force-rows');
  expect(result.lawGraphManifestAuthoritativeWriteResidentStateFamilies).toContain('pressure-interface');
  expect(result.lawGraphManifestAuthoritativeWriteResidentStateFamilies).toContain('gas-pressure');
  expect(result.lawGraphManifestStateFamilyOwnerMapStatus).toBe('single-current-owner-per-family');
  expect(result.lawGraphManifestStateFamilyOwnerConflicts).toEqual([]);
  expect(result.lawGraphManifestCurrentOwnerNodeIds.mechanics).toBe('ulg-mls-mpm-sph-resident-pass-dag');
  expect(result.lawGraphManifestCurrentOwnerNodeIds['thermo-phase']).toBe('ulg-mls-mpm-sph-resident-pass-dag');
  expect(result.lawGraphManifestCurrentOwnerNodeIds['reaction-products']).toBe('ulg-mls-mpm-sph-resident-pass-dag');
  expect(result.lawGraphManifestProspectiveOwnerNodeIds.mechanics).toEqual(['ulg-mls-mpm-mechanics-law']);
  expect(result.lawGraphManifestProspectiveOwnerNodeIds['thermo-phase']).toEqual(['ulg-thermal-phase-law']);
  expect(result.lawGraphManifestProspectiveOwnerNodeIds['gas-pressure']).toEqual(['ulg-reaction-product-gas-law']);
  expect(result.lawGraphManifestFirstPromotionCandidateNodeId).toBe('ulg-mls-mpm-mechanics-law');
  expect(result.lawGraphManifestFirstPromotionCandidateFamilies).toEqual(['particle-kinematics', 'mechanics']);
  expect(result.lawGraphManifestPromotionRule).toBe('metadata-only-until-gated');
  expect(result.nodeKernelFacadeSchema).toBe(null);
  expect(result.nodeKernelAuthoritySchema).toBe('peercompute.ulg.nodekernel-authority.v0');
  expect(result.nodeKernelMode).toBe('real-peercompute-nodekernel');
  expect(result.nodeKernelConstructor).toBe('NodeKernel');
  expect(result.nodeKernelAuthorityConstructor).toBe('NodeKernel');
  expect(result.nodeKernelAuthorityInitialized).toBe(true);
  expect(result.nodeKernelAuthorityStarted).toBe(false);
  expect(result.nodeKernelNetworkManagerReady).toBe(true);
  expect(result.nodeKernelComputeManagerSame).toBe(true);
  expect(result.nodeKernelStateManagerSame).toBe(true);
  expect(result.computeManagerConstructor).toBe('ComputeManager');
  expect(result.stateManagerConstructor).toBe('StateManager');
  expect(result.warmDeltaKeys).toEqual([result.taskId]);
  expect(result.warmPayloadSchema).toBe('peercompute.ulg.mls-mpm-resident-steps-state-delta.v0');
  expect(result.warmPayloadStateKey).toContain('ulg:sph-resident-state:');
  expect(result.executionSchema).toBe('peercompute.ulg.mls-mpm-gpu-resident-steps-execution.v0');
  expect(result.computeManagerTaskStatus).toBe('state-manager-committed-inline-execution-returned');
  expect(result.stateManagerCommitAccepted).toBe(true);
  expect(result.stateManagerCommitStatus).toBe('committed');
  expect(result.stateManagerCommitGpuFenceSatisfied).toBe(true);
  expect(result.sameDevicePublicationSchema).toBe('peercompute.ulg.sph-mls-mpm-same-device-hot-buffer-source-publication.v0');
  expect(result.sameDevicePublicationStatus).toBe('same-device-hot-buffer-source-published');
  expect(result.sameDevicePublicationSameDevice).toBe(true);
  expect(result.sameDevicePublicationSourceMode).toBe('mounted-resident-compute-manager-output');
  expect(result.sameDevicePublicationSourceStage).toBe('resident-steps');
  expect(result.sameDevicePublicationSourceTaskId).toBe(result.taskId);
  expect(result.sameDevicePublicationHotBufferKey).toContain('ulg:sph-resident-same-device-source');
  expect(result.sameDeviceImportSchema).toBe('peercompute.ulg.remote-task-graph-same-device-retained-buffer-import.v0');
  expect(result.sameDeviceImportSourceHotBufferKey).toBe(result.sameDevicePublicationHotBufferKey);
  expect(result.sameDeviceG2pImportSourceHotBufferKey).toBe(result.sameDevicePublicationHotBufferKey);
  expect(result.sameDeviceG2pGpuResultImportSourceHotBufferKey).toBe(result.sameDevicePublicationHotBufferKey);
  expect(result.sameDeviceSourceRecordStatus).toBe('hot-buffer-source-stored');
  expect(result.sameDeviceSourceRecordCopyMode).toBe('zero-copy-local-hot-buffer-source');
  expect(result.sameDeviceSourceRecordHasSphStateBuffer).toBe(true);
  expect(result.sameDeviceSourceRecordHasSphThermoBuffer).toBe(true);
  expect(result.sameDeviceSourceRecordHasMlsMpmMechanicsBuffer).toBe(true);
  expect(result.gpuFenceSatisfied).toBe(true);
  expect(result.finalStepBackend).toBe('webgpu');
  expect(result.finalStepReadbackMode).toBe('no-full-readback');
  expect(result.peerComputeSolverTaskSchema).toBe('peercompute.ulg.mls-mpm-resident-steps-solver-task-bridge.v0');
  expect(result.peerComputeSolverTaskCreated).toBe(true);
  expect(result.peerComputeSolverTaskStatus).toBe('solver-task-created');
  expect(result.peerComputeSolverTaskSolverId).toBe('ulg-mls-mpm-sph-resident-steps');
  expect(result.peerComputeSolverTaskAffinityKey).toContain('ulg-mls-mpm-sph-resident-steps:ulg:sph-resident-state:');
  expect(result.peerComputeSolverTaskWarmDeltaScope).toBe('ulg-sph-resident-pass-dag');
  expect(result.computeManagerTaskSolverId).toBe('ulg-mls-mpm-sph-resident-steps');
  expect(result.computeManagerTaskSolverTaskCreated).toBe(true);
  expect(result.computeManagerTaskSolverTaskSchema).toBe('peercompute.compute.solver-task.v0');
  expect(result.computeManagerTaskSolverTaskWarmDeltaScope).toBe('ulg-sph-resident-pass-dag');
  expect(result.totalTasksCompleted).toBe(1);
  expect(result.laneCompletedLeaseCount).toBe(1);
  expect(result.solverRegistrationStatus).toBe('registered');
  expect(result.solverRegistrationIds).toContain('ulg-mls-mpm-sph-resident-steps');
  for (const solverId of expectedResidentLawFamilySolverIds) {
    expect(result.solverRegistrationIds).toContain(solverId);
  }
  expect(result.residentSolverSchema).toBe('peercompute.compute.solver-descriptor.v0');
  expect(result.residentSolverRuntime).toBe('js');
  expect(result.residentSolverModule).toBe('/src/runtime/sph/sphMlsMpmGpuStep.js');
  expect(result.residentSolverWarmDeltaScope).toBe('ulg-sph-resident-pass-dag');
  expect(result.residentSolverLawNodeId).toBe('ulg-mls-mpm-sph-resident-pass-dag');
  expect(result.residentSolverWebGpuResidency).toBe('gpu-lane');
  expect(result.residentLawFamilySolverIds).toEqual(expectedResidentLawFamilySolverIds);
  for (const solverId of expectedResidentLawFamilySolverIds) {
    expect(result.residentLawFamilyRuntimes[solverId]).toBe('metadata');
    expect(result.residentLawFamilyHasExecutor[solverId]).toBe(false);
    expect(result.residentLawFamilyScopes[solverId]).toBe('ulg-sph-law-family-metadata');
    expect(result.residentLawFamilyParentNodes[solverId]).toBe('ulg-mls-mpm-sph-resident-pass-dag');
    expect(result.residentLawFamilyTaskErrors[solverId]).toContain(`Solver has no executable task target: ${solverId}`);
  }
  expect(result.promotionAdmissionFunctionReady).toBe(true);
  expect(result.promotionAdmissionTaskReady).toBe(true);
  expect(result.promotionAdmissionId).toBe('ulg-law-family-promotion-admission');
  expect(result.mechanicsPromotionEvidenceTaskReady).toBe(true);
  expect(result.mechanicsChildDryRunTaskReady).toBe(true);
  expect(result.mechanicsOnlyResidentStepsTaskReady).toBe(true);
  expect(result.mechanicsP2gStageTaskReady).toBe(true);
  expect(result.mechanicsGridUpdateStageTaskReady).toBe(true);
  expect(result.mechanicsG2pStageTaskReady).toBe(true);
  expect(result.mechanicsStageTaskChainReady).toBe(true);
  expect(result.structuredMechanicsEvidenceSchema).toBe('peercompute.ulg.mechanics-promotion-reference-evidence.v0');
  expect(result.structuredMechanicsEvidenceGeneratedBy).toBe('cpu-resident-mechanics-reference-runs');
  expect(result.structuredMechanicsEvidenceZeroForcePassed).toBe(true);
  expect(result.structuredMechanicsEvidenceGravityOnlyPassed).toBe(true);
  expect(result.structuredMechanicsEvidenceMechanicsOnlyPassed).toBe(true);
  expect(result.structuredMechanicsEvidenceMechanicsOnlyEntrypoint).toBe('mechanics-only-entrypoint-enforced');
  expect(result.structuredMechanicsEvidenceMechanicsOnlyStepSource).toBe('runMlsMpmMechanicsOnlyResidentStepWithOptionalWebGpu');
  expect(result.missingMechanicsPromotion.schema).toBe('peercompute.ulg.law-family-promotion-admission.v0');
  expect(result.missingMechanicsPromotion.accepted).toBe(false);
  expect(result.missingMechanicsPromotion.reason).toBe('required-evidence-missing');
  expect(result.missingMechanicsPromotion.missingEvidence).toContain('cpu-reference-oracle-parity');
  expect(result.missingMechanicsPromotion.missingEvidence).toContain('gravity-only-oracle');
  expect(result.missingMechanicsPromotion.missingEvidence).toContain('mechanics-only-child-task-envelope');
  expect(result.missingMechanicsPromotion.missingEvidence).toContain('mechanics-child-stage-kernel-evidence');
  expect(result.missingMechanicsPromotion.missingEvidence).toContain('mechanics-child-p2g-stage-evidence');
  expect(result.missingMechanicsPromotion.missingEvidence).toContain('mechanics-child-grid-update-stage-evidence');
  expect(result.missingMechanicsPromotion.missingEvidence).toContain('mechanics-child-g2p-stage-evidence');
  expect(result.admittedMechanicsPromotion.accepted).toBe(true);
  expect(result.admittedMechanicsPromotion.admittedFamilies).toEqual(['particle-kinematics', 'mechanics']);
  expect(result.blockedThermalPromotion.accepted).toBe(false);
  expect(result.blockedThermalPromotion.issues).toContain('promotion-order-blocked');
  expect(result.missingMechanicsPromotionTask.schema).toBe('peercompute.ulg.law-family-promotion-admission.v0');
  expect(result.missingMechanicsPromotionTask.taskWrapped).toBe(true);
  expect(result.missingMechanicsPromotionTask.accepted).toBe(false);
  expect(result.missingMechanicsPromotionTask.reason).toBe('required-evidence-missing');
  expect(result.mechanicsOnlyChildTask.computeTaskResultSchema).toBe('peercompute.ulg.mls-mpm-mechanics-only-resident-steps-compute-task-result.v0');
  expect(result.mechanicsOnlyChildTask.computeTaskSchema).toBe('peercompute.ulg.mls-mpm-mechanics-only-resident-steps-compute-task.v0');
  expect(result.mechanicsOnlyChildTask.computeExecution.taskFamily).toBe('ulg-mls-mpm-mechanics-only-resident-steps');
  expect(result.mechanicsOnlyChildTask.computeExecution.gpuFenceSatisfied).toBe(true);
  expect(result.mechanicsOnlyChildTask.lawGraphNode.nodeId).toBe('ulg-mls-mpm-mechanics-law');
  expect(result.mechanicsOnlyChildTask.mechanicsOnlyChildTaskAuthority.status).toBe('compute-manager-owned-non-mutating-child-task');
  expect(result.mechanicsOnlyChildTask.mechanicsOnlyChildTaskAuthority.commitDeltaSuppressed).toBe(true);
  expect(result.mechanicsOnlyChildTask.mechanicsChildStageKernelEvidence.passed).toBe(true);
  expect(result.mechanicsOnlyChildTask.mechanicsChildStageKernelEvidence.requiredStages.map((entry) => entry.id)).toEqual(['p2g', 'gridUpdate', 'g2p']);
  expect(result.mechanicsOnlyChildTask.mechanicsChildP2gStageEvidence.passed).toBe(true);
  expect(result.mechanicsOnlyChildTask.mechanicsChildP2gStageEvidence.stageId).toBe('p2g');
  expect(result.mechanicsOnlyChildTask.mechanicsChildP2gStageEvidence.promotionStatus).toBe('stage-evidence-only-not-authoritative');
  expect(result.mechanicsOnlyChildTask.mechanicsChildGridUpdateStageEvidence.passed).toBe(true);
  expect(result.mechanicsOnlyChildTask.mechanicsChildGridUpdateStageEvidence.stageId).toBe('gridUpdate');
  expect(result.mechanicsOnlyChildTask.mechanicsChildGridUpdateStageEvidence.promotionStatus).toBe('stage-evidence-only-not-authoritative');
  expect(result.mechanicsOnlyChildTask.mechanicsChildG2pStageEvidence.passed).toBe(true);
  expect(result.mechanicsOnlyChildTask.mechanicsChildG2pStageEvidence.stageId).toBe('g2p');
  expect(result.mechanicsOnlyChildTask.mechanicsChildG2pStageEvidence.promotionStatus).toBe('stage-evidence-only-not-authoritative');
  expect(result.mechanicsOnlyChildTask.mechanicsChildStageKernelEvidence.perStageEvidence.p2g.schema).toBe('peercompute.ulg.mechanics-child-p2g-stage-evidence.v0');
  expect(result.mechanicsOnlyChildTask.mechanicsChildStageKernelEvidence.perStageEvidence.gridUpdate.schema).toBe('peercompute.ulg.mechanics-child-grid-update-stage-evidence.v0');
  expect(result.mechanicsOnlyChildTask.mechanicsChildStageKernelEvidence.perStageEvidence.g2p.schema).toBe('peercompute.ulg.mechanics-child-g2p-stage-evidence.v0');
  expect(result.mechanicsOnlyChildTask.mechanicsOnlyExecutionPath.status).toBe('mechanics-only-entrypoint-enforced');
  expect(result.mechanicsOnlyChildTask.mechanicsOnlyExecutionPath.stepSource).toBe('runMlsMpmMechanicsOnlyResidentStepWithOptionalWebGpu');
  expect(result.mechanicsOnlyChildTask.commitDelta).toBeUndefined();
  expect(result.mechanicsP2gStageTask.computeTaskResultSchema).toBe('peercompute.ulg.mls-mpm-mechanics-p2g-stage-compute-task-result.v0');
  expect(result.mechanicsP2gStageTask.computeTaskSchema).toBe('peercompute.ulg.mls-mpm-mechanics-p2g-stage-compute-task.v0');
  expect(result.mechanicsP2gStageTask.computeExecution.taskFamily).toBe('ulg-mls-mpm-mechanics-p2g-stage');
  expect(result.mechanicsP2gStageTask.mechanicsP2gStageTask).toBe(true);
  expect(result.mechanicsP2gStageTask.mechanicsP2gStageTaskAuthority.status).toBe('compute-manager-owned-non-mutating-p2g-stage-task');
  expect(result.mechanicsP2gStageTask.mechanicsP2gStageTaskAuthority.authoritativeStateMutation).toBe(false);
  expect(result.mechanicsP2gStageTask.mechanicsP2gStageTaskEvidence.passed).toBe(true);
  expect(result.mechanicsP2gStageTask.mechanicsP2gStageTaskEvidence.stageId).toBe('p2g');
  expect(result.mechanicsP2gStageTask.mechanicsP2gStageTaskEvidence.transientWriteFamilies).toEqual(['mls-mpm-grid']);
  expect(result.mechanicsP2gStageTask.mechanicsP2gStageTaskEvidence.pressureInterface.suppressed).toBe(true);
  expect(result.mechanicsP2gStageTask.mechanicsP2gStageTaskEvidence.productInput.suppressed).toBe(true);
  expect(result.mechanicsGridUpdateStageTask.computeTaskResultSchema).toBe('peercompute.ulg.mls-mpm-mechanics-grid-update-stage-compute-task-result.v0');
  expect(result.mechanicsGridUpdateStageTask.computeTaskSchema).toBe('peercompute.ulg.mls-mpm-mechanics-grid-update-stage-compute-task.v0');
  expect(result.mechanicsGridUpdateStageTask.computeExecution.taskFamily).toBe('ulg-mls-mpm-mechanics-grid-update-stage');
  expect(result.mechanicsGridUpdateStageTask.mechanicsGridUpdateStageTask).toBe(true);
  expect(result.mechanicsGridUpdateStageTask.mechanicsGridUpdateStageTaskAuthority.status).toBe('compute-manager-owned-non-mutating-grid-update-stage-task');
  expect(result.mechanicsGridUpdateStageTask.mechanicsGridUpdateStageTaskAuthority.authoritativeStateMutation).toBe(false);
  expect(result.mechanicsGridUpdateStageTask.mechanicsGridUpdateStageTaskEvidence.passed).toBe(true);
  expect(result.mechanicsGridUpdateStageTask.mechanicsGridUpdateStageTaskEvidence.stageId).toBe('gridUpdate');
  expect(result.mechanicsGridUpdateStageTask.mechanicsGridUpdateStageTaskEvidence.transientReadFamilies).toEqual(['mls-mpm-grid']);
  expect(result.mechanicsGridUpdateStageTask.mechanicsGridUpdateStageTaskEvidence.transientWriteFamilies).toEqual(['mls-mpm-grid']);
  expect(result.mechanicsGridUpdateStageTask.mechanicsGridUpdateStageTaskEvidence.pressureInterface.suppressed).toBe(true);
  expect(result.mechanicsG2pStageTask.computeTaskResultSchema).toBe('peercompute.ulg.mls-mpm-mechanics-g2p-stage-compute-task-result.v0');
  expect(result.mechanicsG2pStageTask.computeTaskSchema).toBe('peercompute.ulg.mls-mpm-mechanics-g2p-stage-compute-task.v0');
  expect(result.mechanicsG2pStageTask.computeExecution.taskFamily).toBe('ulg-mls-mpm-mechanics-g2p-stage');
  expect(result.mechanicsG2pStageTask.mechanicsG2pStageTask).toBe(true);
  expect(result.mechanicsG2pStageTask.mechanicsG2pStageTaskAuthority.status).toBe('compute-manager-owned-non-mutating-g2p-stage-task');
  expect(result.mechanicsG2pStageTask.mechanicsG2pStageTaskAuthority.authoritativeStateMutation).toBe(false);
  expect(result.mechanicsG2pStageTask.mechanicsG2pStageTaskEvidence.passed).toBe(true);
  expect(result.mechanicsG2pStageTask.mechanicsG2pStageTaskEvidence.stageId).toBe('g2p');
  expect(result.mechanicsG2pStageTask.mechanicsG2pStageTaskEvidence.transientReadFamilies).toEqual(['mls-mpm-grid']);
  expect(result.mechanicsG2pStageTask.mechanicsG2pStageTaskEvidence.candidateWriteFamilies).toEqual(['sph-particle-state', 'mls-mpm-mechanics']);
  expect(result.mechanicsG2pStageTask.mechanicsG2pStageTaskEvidence.authoritativeWriteFamilies).toEqual([]);
  expect(result.mechanicsG2pStageTask.mechanicsG2pStageTaskEvidence.pressureInterface.suppressed).toBe(true);
  expect(result.mechanicsStageTaskChain.mechanicsStageTaskChain.schema).toBe('peercompute.ulg.mls-mpm-mechanics-stage-task-chain.v0');
  expect(result.mechanicsStageTaskChain.mechanicsStageTaskChain.status).toBe('compute-manager-stage-task-chain-executed');
  expect(result.mechanicsStageTaskChain.mechanicsStageTaskChain.schedulerStatus).toBe('peercompute-native-task-graph-used');
  expect(result.mechanicsStageTaskChain.mechanicsStageTaskChain.nativeTaskGraphCacheKeySource)
    .toBe('content-addressed-inputs');
  expect(result.mechanicsStageTaskChain.mechanicsStageTaskChain.nativeTaskGraphCacheInputsSchema)
    .toBe('peercompute.compute.task-graph-cache-inputs.v0');
  expect(result.mechanicsStageTaskChain.mechanicsStageTaskChain.nativeTaskGraphCacheInputHash)
    .toMatch(/^fnv1a32-[0-9a-f]{8}$/);
  expect(result.mechanicsStageTaskChain.mechanicsStageTaskChain.nativeTaskGraphCacheAdmissionStatus)
    .toBe('recorded-not-admitted');
  expect(result.mechanicsStageTaskChain.mechanicsStageTaskChain.nativeTaskGraphCacheArtifactSchema)
    .toBe('peercompute.compute.task-graph-cache-artifact.v0');
  expect(result.mechanicsStageTaskChain.mechanicsStageTaskChain.nativeTaskGraphCacheArtifactStatus)
    .toBe('recorded-not-admitted');
  expect(result.mechanicsStageTaskChain.mechanicsStageTaskChain.nativeTaskGraphCacheArtifactAdmitted)
    .toBe(false);
  expect(result.mechanicsStageTaskChain.mechanicsStageTaskChain.nativeTaskGraphCacheStatus).toBe('recorded');
  expect(result.mechanicsStageTaskChain.mechanicsStageTaskChain.nativeTaskGraphPlacementPolicySchema)
    .toBe('peercompute.compute.task-graph-placement-policy.v0');
  expect(result.mechanicsStageTaskChain.mechanicsStageTaskChain.nativeTaskGraphCancellationStatus).toBe('not-cancelled');
  expect(result.mechanicsStageTaskChain.mechanicsStageTaskChain.nativeTaskGraphLeaseStatus).toBe('not-required');
  expect(result.mechanicsStageTaskChain.mechanicsStageTaskChain.nativeTaskGraphNodeKernelAuthoritySchema)
    .toBe('peercompute.nodekernel.task-graph-authority.v0');
  expect(result.mechanicsStageTaskChain.mechanicsStageTaskChain.nativeTaskGraphNodeKernelAuthorityStatus)
    .toBe('submitted-through-node-kernel');
  expect(result.mechanicsStageTaskChain.mechanicsStageTaskChain.nativeTaskGraphPlacementPreflightSchema)
    .toBe('peercompute.nodekernel.task-graph-placement-preflight.v0');
  expect(result.mechanicsStageTaskChain.mechanicsStageTaskChain.nativeTaskGraphPlacementPreflightStatus)
    .toBe('local-placement-accepted');
  expect(result.mechanicsStageTaskChain.mechanicsStageTaskChain.nativeTaskGraphAuthorityPath)
    .toBe('node-kernel-submit-task-graph');
  expect(result.mechanicsStageTaskChain.mechanicsStageTaskChain.nodeKernelOwned).toBe(true);
  expect(result.mechanicsStageTaskChain.mechanicsStageTaskChain.allStageTaskEvidencePassed).toBe(true);
  expect(result.mechanicsStageTaskChain.mechanicsOnlySplitPath.stageTaskBoundaries).toEqual({
    p2g: true,
    gridUpdate: true,
    g2p: true
  });
  expect(result.mechanicsStageTaskChainWebGpu.schema).toBe('peercompute.ulg.mls-mpm-mechanics-stage-task-chain.v0');
  expect(result.mechanicsStageTaskChainWebGpu.status).toBe('compute-manager-stage-task-chain-executed');
  expect(result.mechanicsStageTaskChainWebGpu.schedulerStatus).toBe('ulg-helper-stage-runners-used-awaiting-gpu-graph-semantics');
  expect(result.mechanicsStageTaskChainWebGpu.stagePlanSchema).toBe('peercompute.compute.gpu-resident-lane-stage-plan.v0');
  expect(result.mechanicsStageTaskChainWebGpu.stagePlanContractSchema).toBe('peercompute.ulg.mls-mpm-mechanics-stage-lane-contract.v0');
  expect(result.mechanicsStageTaskChainWebGpu.stageExecutionStatus).toBe('completed');
  expect(result.mechanicsStageTaskChainWebGpu.stageExecutionCompletedStageCount).toBe(3);
  expect(result.mechanicsStageTaskChainWebGpu.stageExecutionStageOrder).toEqual(['p2g', 'gridUpdate', 'g2p']);
  expect(result.mechanicsStageTaskChainWebGpu.stageExecutionExecutorSources).toEqual({
    p2g: 'gpu-hub-resident-stage-executor',
    gridUpdate: 'gpu-hub-resident-stage-executor',
    g2p: 'gpu-hub-resident-stage-executor'
  });
  expect(result.mechanicsStageTaskChainWebGpu.stageExecutionUsedGpuHubExecutors).toBe(true);
  expect(result.mechanicsStageTaskChainWebGpu.stageExecutionRequestedWorkerResidency).toBe(true);
  expect(result.mechanicsStageTaskChainWebGpu.stageExecutionWorkerResidencyStatuses).toEqual({
    p2g: 'blocked-worker-backend-missing',
    gridUpdate: 'blocked-worker-backend-missing',
    g2p: 'blocked-worker-backend-missing'
  });
  expect(result.mechanicsStageTaskChainWebGpu.gpuHubResidentStageExecutorMode).toBe('registered');
  expect(result.mechanicsStageTaskChainWebGpu.gpuHubResidentStageExecutorRegisteredCount).toBe(3);
  expect(new Set(result.mechanicsStageTaskChainWebGpu.gpuHubResidentStageExecutorStageIds)).toEqual(new Set(['p2g', 'gridUpdate', 'g2p']));
  expect(result.mechanicsStageTaskChainWebGpu.stageLeaseFenceSatisfied).toBe(true);
  expect(result.mechanicsStageTaskChainWebGpu.stageTaskLaneAligned).toBe(true);
  expect(result.mechanicsStageTaskChainWebGpu.stageTaskLaneIds).toEqual({
    p2g: 'ulg:browser:mechanics-stage-webgpu-task-chain-lane',
    gridUpdate: 'ulg:browser:mechanics-stage-webgpu-task-chain-lane',
    g2p: 'ulg:browser:mechanics-stage-webgpu-task-chain-lane'
  });
  expect(result.mechanicsStageTaskChainWebGpu.stageTaskStateKeys).toEqual({
    p2g: 'ulg:browser:mechanics-stage-webgpu-task-chain-state',
    gridUpdate: 'ulg:browser:mechanics-stage-webgpu-task-chain-state',
    g2p: 'ulg:browser:mechanics-stage-webgpu-task-chain-state'
  });
  expect(result.mechanicsStageTaskChainWebGpu.stageTaskBackends).toEqual({
    p2g: 'webgpu',
    gridUpdate: 'webgpu',
    g2p: 'webgpu'
  });
  expect(result.mechanicsStageTaskChainWebGpu.stageTaskResidencies).toEqual({
    p2g: 'gpu-lane',
    gridUpdate: 'gpu-lane',
    g2p: 'gpu-lane'
  });
  expect(result.mechanicsStageTaskChainWebGpu.stageTaskFenceSatisfied).toEqual({
    p2g: true,
    gridUpdate: true,
    g2p: true
  });
  expect(result.mechanicsStageTaskChainWebGpu.submittedStageTasks).toHaveLength(3);
  for (const task of result.mechanicsStageTaskChainWebGpu.submittedStageTasks) {
    expect(task.residency).toBe('gpu-lane');
    expect(task.gpuResidentLaneLaneId).toBe('ulg:browser:mechanics-stage-webgpu-task-chain-lane');
    expect(task.gpuResidentLaneStateKey).toBe('ulg:browser:mechanics-stage-webgpu-task-chain-state');
    expect(task.gpuFenceRequired).toBe(true);
  }
  expect(result.mechanicsStageTaskChainWebGpu.allStageTaskEvidencePassed).toBe(true);
  expect(result.mechanicsStageTaskChainWebGpu.splitStageTaskBoundaries).toEqual({
    p2g: true,
    gridUpdate: true,
    g2p: true
  });
  expect(result.mechanicsStageTaskChainWorker.schema).toBe('peercompute.ulg.mls-mpm-mechanics-stage-task-chain.v0');
  expect(result.mechanicsStageTaskChainWorker.status).toBe('compute-manager-stage-task-chain-executed');
  expect(result.mechanicsStageTaskChainWorker.schedulerStatus).toBe('ulg-helper-stage-runners-used-awaiting-gpu-graph-semantics');
  expect(result.mechanicsStageTaskChainWorker.stageExecutionStatus).toBe('completed');
  expect(result.mechanicsStageTaskChainWorker.stageExecutionCompletedStageCount).toBe(3);
  expect(result.mechanicsStageTaskChainWorker.stageExecutionStageOrder).toEqual(['p2g', 'gridUpdate', 'g2p']);
  expect(result.mechanicsStageTaskChainWorker.stageExecutionExecutorSources).toEqual({
    p2g: 'gpu-hub-resident-stage-executor',
    gridUpdate: 'gpu-hub-resident-stage-executor',
    g2p: 'gpu-hub-resident-stage-executor'
  });
  expect(result.mechanicsStageTaskChainWorker.stageExecutionWorkerResidencyStatuses).toEqual({
    p2g: 'worker-ready',
    gridUpdate: 'worker-ready',
    g2p: 'worker-ready'
  });
  expect(result.mechanicsStageTaskChainWorker.stageExecutionWorkerRunnerSupplied).toBe(true);
  expect(result.mechanicsStageTaskChainWorker.stageExecutionWorkerModuleUrl).toBe('/src/services/ulgMechanicsResidentStage.worker.js');
  expect(result.mechanicsStageTaskChainWorker.stageTaskBackends).toEqual({
    p2g: 'webgpu',
    gridUpdate: 'webgpu',
    g2p: 'webgpu'
  });
  expect(result.mechanicsStageTaskChainWorker.stageTaskReadbackModes).toEqual({
    p2g: 'no-full-readback',
    gridUpdate: 'no-full-readback',
    g2p: 'no-full-readback'
  });
  expect(result.mechanicsStageTaskChainWorker.stageTaskNormalHotLoopReadbackFree).toEqual({
    p2g: true,
    gridUpdate: true,
    g2p: true
  });
  expect(result.mechanicsStageTaskChainWorker.stageTaskFenceSatisfied).toEqual({
    p2g: true,
    gridUpdate: true,
    g2p: true
  });
  expect(result.mechanicsStageTaskChainWorker.stageLeaseFenceSatisfied).toBe(true);
  expect(result.mechanicsStageTaskChainWorker.workerCompactPublicationCandidateStatus).toBe('worker-retained-compact-publication-candidate-ready');
  expect(result.mechanicsStageTaskChainWorker.workerCompactPublicationCandidateSameDeviceRetainedBufferImportAvailable)
    .toBe(true);
  expect(result.mechanicsStageTaskChainWorker.workerCompactPublicationCandidateSameDeviceSourceHotBufferKey)
    .toBe(result.sameDevicePublicationHotBufferKey);
  expect(result.mechanicsStageTaskChainWorker.workerCompactPublicationCandidateLocalMaterializationStatus)
    .toBe('same-device-retained-buffer-import-ready');
  expect(result.mechanicsStageTaskChainWorker.workerCompactPublicationCandidateAcceptedMaterializationModes).toEqual([
    'same-device-retained-buffer-import'
  ]);
  expect(result.mechanicsStageTaskChainWorker.workerCompactPublicationCandidate.publicationStatus).toBe('blocked-authorized-worker-publication-required');
  expect(result.mechanicsStageTaskChainWorker.workerCompactPublicationStatus).toBe('worker-retained-mechanics-output-published');
  expect(result.mechanicsStageTaskChainWorker.workerCompactPublicationCommitted).toBe(true);
  expect(result.mechanicsStageTaskChainWorker.workerCompactPublicationSameDeviceRetainedBufferImportAvailable).toBe(true);
  expect(result.mechanicsStageTaskChainWorker.workerCompactPublicationSameDeviceSourceHotBufferKey)
    .toBe(result.sameDevicePublicationHotBufferKey);
  expect(result.mechanicsStageTaskChainWorker.workerCompactPublicationHotBufferStored).toBe(true);
  expect(result.mechanicsStageTaskChainWorker.workerCompactPublicationRecordStatus).toBe('worker-retained-hot-buffer-source-stored');
  expect(result.mechanicsStageTaskChainWorker.workerCompactPublicationRecordHasWorkerRunner).toBe(true);
  expect(result.mechanicsStageTaskChainWorker.workerCompactPublicationRecordSameDeviceRetainedBufferImportAvailable)
    .toBe(true);
  expect(result.mechanicsStageTaskChainWorker.workerCompactPublicationRecordSameDeviceSourceHotBufferKey)
    .toBe(result.sameDevicePublicationHotBufferKey);
  expect(result.mechanicsStageTaskChainWorker.workerCompactPublicationWarmDeltaFound).toBe(true);
  expect(result.mechanicsStageTaskChainWorker.workerCompactPublicationWarmDeltaStatus).toBe('worker-retained-mechanics-output-admitted');
  expect(result.mechanicsStageTaskChainWorker.workerCompactPublicationWarmDeltaSameDeviceRetainedBufferImportAvailable)
    .toBe(true);
  expect(result.mechanicsStageTaskChainWorker.workerCompactPublicationWarmDeltaSameDeviceSourceHotBufferKey)
    .toBe(result.sameDevicePublicationHotBufferKey);
  expect(result.mechanicsStageTaskChainWorker.workerRetainedAccessContractStatus)
    .toBe('worker-local-source-ready-main-thread-refresh-blocked');
  expect(result.mechanicsStageTaskChainWorker.workerRetainedAccessContractMainThreadGpuHandlesAvailable)
    .toBe(false);
  expect(result.mechanicsStageTaskChainWorker.workerRetainedAccessContractSameDeviceRetainedBufferImportAvailable)
    .toBe(true);
  expect(result.mechanicsStageTaskChainWorker.workerRetainedAccessContractSameDeviceSourceHotBufferKey)
    .toBe(result.sameDevicePublicationHotBufferKey);
  expect(result.mechanicsStageTaskChainWorker.workerRetainedAccessContractLocalMaterializationStatus)
    .toBe('same-device-retained-buffer-import-ready');
  expect(result.mechanicsStageTaskChainWorker.workerRetainedAccessContractAcceptedConsumerModes).toEqual([
    'same-device-retained-buffer-import',
    'same-worker-lane-retained-buffer-ref'
  ]);
  expect(result.mechanicsStageTaskChainWorker.workerRetainedAccessContractAcceptedMaterializationModes).toEqual([
    'same-device-retained-buffer-import'
  ]);
  expect(result.mechanicsStageTaskChainWorker.workerCompactSummaryStatus).toBe('worker-compact-summary-required');
  expect(result.mechanicsStageTaskChainWorker.workerRetainedBufferRefCount).toBeGreaterThan(0);
  expect(result.mechanicsStageTaskChainWorker.workerP2gRetainedThermoInputStatus).toBe('applied-worker-retained-thermo-input');
  expect(result.mechanicsStageTaskChainWorker.workerG2pRetainedThermoInputStatus).toBe('applied-worker-retained-thermo-input');
  expect(result.mechanicsStageTaskChainWorker.workerCompactPublicationCandidate).toMatchObject({
    schema: 'peercompute.ulg.mls-mpm-mechanics-worker-compact-publication-candidate.v0',
    sameDeviceMainThreadHandlesAvailable: false,
    sameDeviceRetainedBufferImportAvailable: true,
    sameDeviceSourceHotBufferKey: result.sameDevicePublicationHotBufferKey,
    workerLocalRetainedRefsOnly: true,
    stateManagerAdmissionRequired: true,
    requiredPublicationProtocol: 'worker-posts-compact-summary-and-retained-ref-descriptor-to-nodekernel-state-manager'
  });
  expect(result.mechanicsStageTaskChainWorker.workerCompactPublication).toMatchObject({
    schema: 'peercompute.ulg.mechanics-worker-retained-hot-buffer-publication.v0',
    authority: 'nodekernel-state-manager',
    workerLocal: true,
    sameDevice: false,
    sameDeviceRetainedBufferImportAvailable: true,
    sameDeviceSourceHotBufferKey: result.sameDevicePublicationHotBufferKey,
    workerRetainedBufferImport: {
      schema: 'peercompute.ulg.mechanics-worker-retained-buffer-import.v0',
      workerLocal: true,
      sameDeviceRetainedBufferImportAvailable: true,
      sameDeviceSourceHotBufferKey: result.sameDevicePublicationHotBufferKey,
      copyMode: 'zero-copy-worker-retained-ref-descriptor'
    }
  });
  expect(result.mechanicsStageTaskChainWorker.workerContinuationStatus).toBe('compute-manager-stage-task-chain-executed');
  expect(result.mechanicsStageTaskChainWorker.workerContinuationStageTaskBackends).toEqual({
    p2g: 'webgpu',
    gridUpdate: 'webgpu',
    g2p: 'webgpu',
    thermalPhase: 'webgpu'
  });
  expect(result.mechanicsStageTaskChainWorker.workerContinuationStageTaskFenceSatisfied).toEqual({
    p2g: true,
    gridUpdate: true,
    g2p: true,
    thermalPhase: true
  });
  expect(result.mechanicsStageTaskChainWorker.workerContinuationP2gRetainedInputStatus).toBe('applied-worker-retained-g2p-input');
  expect(result.mechanicsStageTaskChainWorker.workerContinuationP2gRetainedThermoInputStatus).toBe('applied-worker-retained-thermo-input');
  expect(result.mechanicsStageTaskChainWorker.workerContinuationG2pRetainedThermoInputStatus).toBe('applied-worker-retained-thermo-input');
  expect(result.mechanicsStageTaskChainWorker.workerContinuationPublicationStatus).toBe('worker-retained-mechanics-output-published');
  expect(result.mechanicsStageTaskChainWorker.workerContinuationPublicationCommitted).toBe(true);
  expect(result.mechanicsStageTaskChainWorker.workerThermalStageInFormalDag).toBe(true);
  expect(result.mechanicsStageTaskChainWorker.workerThermalStageExecutorSource).toBe('gpu-hub-resident-stage-executor');
  expect(result.mechanicsStageTaskChainWorker.workerThermalStageWorkerResidencyStatus).toBe('worker-ready');
  expect(result.mechanicsStageTaskChainWorker.workerThermalStageStatus).toBe('worker-stage-completed');
  expect(result.mechanicsStageTaskChainWorker.workerThermalStageBackend).toBe('webgpu');
  expect(result.mechanicsStageTaskChainWorker.workerThermalStageExecutionStatus).toBe('webgpu-accepted-no-full-readback');
  expect(result.mechanicsStageTaskChainWorker.workerThermalStageReadbackMode).toBe('no-full-readback');
  expect(result.mechanicsStageTaskChainWorker.workerThermalStageNormalHotLoopReadbackFree).toBe(true);
  expect(result.mechanicsStageTaskChainWorker.workerThermalStageQueueFenceSatisfied).toBe(true);
  expect(result.mechanicsStageTaskChainWorker.workerThermalStageThermoInputStatus).toBe('applied-worker-retained-thermo-input');
  expect(result.mechanicsStageTaskChainWorker.workerThermalStageThermoOutputStatus).toBe('adopted-worker-retained-thermo-output');
  expect(result.mechanicsStageTaskChainWorker.workerThermalStageEvidencePassed).toBe(true);
  expect(result.mechanicsStageTaskChainWorker.workerThermalStageAuthoritativeMutation).toBe(false);
  expect(result.mechanicsStageTaskChainWorker.thermalWorkerCompactPublicationCandidateStatus).toBe('worker-retained-thermal-phase-publication-candidate-ready');
  expect(result.mechanicsStageTaskChainWorker.thermalWorkerCompactPublicationCandidate.publicationStatus).toBe('blocked-authorized-thermal-phase-publication-required');
  expect(result.mechanicsStageTaskChainWorker.thermalWorkerCompactPublicationStatus).toBe('worker-retained-thermal-phase-output-published');
  expect(result.mechanicsStageTaskChainWorker.thermalWorkerCompactPublicationCommitted).toBe(true);
  expect(result.mechanicsStageTaskChainWorker.thermalWorkerCompactPublicationHotBufferStored).toBe(true);
  expect(result.mechanicsStageTaskChainWorker.thermalWorkerCompactPublicationRecordStatus).toBe('worker-retained-thermal-phase-hot-buffer-source-stored');
  expect(result.mechanicsStageTaskChainWorker.thermalWorkerCompactPublicationRecordHasWorkerRunner).toBe(true);
  expect(result.mechanicsStageTaskChainWorker.thermalWorkerCompactPublicationWarmDeltaFound).toBe(true);
  expect(result.mechanicsStageTaskChainWorker.thermalWorkerCompactPublicationWarmDeltaStatus).toBe('worker-retained-thermal-phase-output-admitted');
  expect(result.mechanicsStageTaskChainWorker.thermalWorkerCompactPublicationWarmDeltaOutputFamilies).toEqual(['sph-thermo-phase']);
  expect(result.mechanicsStageTaskChainWorker.thermalWorkerRetainedThermoBufferRefCount).toBeGreaterThan(0);
  expect(result.mechanicsStageTaskChainWorker.thermalWorkerCompactPublication).toMatchObject({
    schema: 'peercompute.ulg.thermal-phase-worker-retained-hot-buffer-publication.v0',
    authority: 'nodekernel-state-manager',
    workerLocal: true,
    sameDevice: false,
    workerRetainedBufferImport: {
      schema: 'peercompute.ulg.thermal-phase-worker-retained-buffer-import.v0',
      workerLocal: true,
      copyMode: 'zero-copy-worker-retained-ref-descriptor'
    }
  });
  expect(result.mechanicsChildDryRunTask.schema).toBe('peercompute.ulg.mechanics-child-dry-run-evidence.v0');
  expect(result.mechanicsChildDryRunTask.taskWrapped).toBe(true);
  expect(result.mechanicsChildDryRunTask.accepted).toBe(true);
  expect(result.mechanicsChildDryRunTask.dryRunMode).toBe('non-mutating-reference-comparison');
  expect(result.mechanicsChildDryRunTask.mechanicsChildDryRunParity.passed).toBe(true);
  expect(result.mechanicsChildDryRunTask.mechanicsOnlyChildTaskEnvelope.passed).toBe(true);
  expect(result.mechanicsChildDryRunTask.mechanicsChildStageKernelEvidence.passed).toBe(true);
  expect(result.mechanicsChildDryRunTask.mechanicsChildP2gStageEvidence.passed).toBe(true);
  expect(result.mechanicsChildDryRunTask.mechanicsChildGridUpdateStageEvidence.passed).toBe(true);
  expect(result.mechanicsChildDryRunTask.mechanicsChildG2pStageEvidence.passed).toBe(true);
  expect(result.mechanicsChildDryRunTask.satisfiedEvidence).toContain('mechanics-only-child-task-envelope');
  expect(result.mechanicsChildDryRunTask.satisfiedEvidence).toContain('mechanics-child-stage-kernel-evidence');
  expect(result.mechanicsChildDryRunTask.satisfiedEvidence).toContain('mechanics-child-p2g-stage-evidence');
  expect(result.mechanicsChildDryRunTask.satisfiedEvidence).toContain('mechanics-child-grid-update-stage-evidence');
  expect(result.mechanicsChildDryRunTask.satisfiedEvidence).toContain('mechanics-child-g2p-stage-evidence');
  expect(result.mechanicsChildDryRunTask.mechanicsOnlyStageContract.passed).toBe(true);
  expect(result.mechanicsChildDryRunTask.mechanicsOnlyExecutionPath.status).toBe('mechanics-only-entrypoint-enforced');
  expect(result.mechanicsChildDryRunTask.mechanicsOnlyExecutionPath.zeroForce.stepSource).toBe('runMlsMpmMechanicsOnlyResidentStepWithOptionalWebGpu');
  expect(result.mechanicsChildDryRunTask.mechanicsOnlyStageContract.authoritativeWriteFamilies).toEqual(['particle-kinematics', 'mechanics']);
  expect(result.mechanicsChildDryRunTask.mechanicsOnlyStageContract.mustNotWriteFamilies).toContain('thermo-phase');
  expect(result.mechanicsPromotionEvidenceTask.schema).toBe('peercompute.ulg.mechanics-promotion-evidence.v0');
  expect(result.mechanicsPromotionEvidenceTask.taskWrapped).toBe(true);
  expect(result.mechanicsPromotionEvidenceTask.accepted).toBe(true);
  expect(result.mechanicsPromotionEvidenceTask.satisfiedEvidence).toContain('zero-force-rest-oracle');
  expect(result.mechanicsPromotionEvidenceTask.satisfiedEvidence).toContain('gravity-only-oracle');
  expect(result.mechanicsPromotionEvidenceTask.satisfiedEvidence).toContain('cpu-reference-oracle-parity');
  expect(result.mechanicsPromotionEvidenceTask.satisfiedEvidence).toContain('visual-sequence-sanity');
  expect(result.mechanicsPromotionEvidenceTask.satisfiedEvidence).toContain('mechanics-only-child-task-envelope');
  expect(result.mechanicsPromotionEvidenceTask.satisfiedEvidence).toContain('mechanics-child-stage-kernel-evidence');
  expect(result.mechanicsPromotionEvidenceTask.satisfiedEvidence).toContain('mechanics-child-p2g-stage-evidence');
  expect(result.mechanicsPromotionEvidenceTask.satisfiedEvidence).toContain('mechanics-child-grid-update-stage-evidence');
  expect(result.mechanicsPromotionEvidenceTask.satisfiedEvidence).toContain('mechanics-child-g2p-stage-evidence');
  expect(result.mechanicsPromotionEvidenceTask.satisfiedEvidence).toContain('mechanics-child-dry-run-parity');
  expect(result.admittedMechanicsPromotionTask.taskWrapped).toBe(true);
  expect(result.admittedMechanicsPromotionTask.accepted).toBe(true);
  expect(result.admittedMechanicsPromotionTask.admittedFamilies).toEqual(['particle-kinematics', 'mechanics']);
  expect(result.promotionAdmissionTaskFamilyCompleted).toBe(2);
  expect(result.mechanicsOnlyChildTaskFamilyCompleted).toBe(1);
  expect(result.mechanicsP2gStageTaskFamilyCompleted).toBe(3);
  expect(result.mechanicsGridUpdateStageTaskFamilyCompleted).toBe(3);
  expect(result.mechanicsG2pStageTaskFamilyCompleted).toBe(3);
  expect(result.mechanicsChildDryRunTaskFamilyCompleted).toBe(1);
  expect(result.mechanicsPromotionEvidenceTaskFamilyCompleted).toBe(1);
});

test('SPH phase browser PeerCompute NodeKernel network gate starts and stops explicitly', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/');

  const result = await page.evaluate(async () => {
    const hostModule = await import('/src/runtime/peercomputeBrowserResidentHost.js');
    const host = await hostModule.createPeerComputeResidentAuthorityHost({
      computeTaskModulePath: '/src/runtime/sph/sphMlsMpmGpuStep.js',
      enableWorkers: false,
      enablePersistence: false,
      disableNetworkProvider: true,
      disableBroadcast: true,
      nodeKernelConfig: {
        pubsubPeerDiscovery: false,
        maxConnections: 0,
        maxIncomingPendingConnections: 0,
        enableNetVizDebugTelemetry: false,
        enableNetVizSessionBroadcast: false,
        enableNetVizSessionDiscovery: false
      }
    });
    try {
      const before = hostModule.summarizePeerComputeResidentAuthorityHost(host);
      const authorityBefore = host.refreshNodeKernelAuthorityStatus();
      const start = await host.startNodeKernelNetwork();
      const afterStart = hostModule.summarizePeerComputeResidentAuthorityHost(host);
      const stop = await host.stopNodeKernelNetwork();
      const afterStop = hostModule.summarizePeerComputeResidentAuthorityHost(host);
      const stateReadyAfterStop = Boolean(host.stateManager?.getWarmDeltas);
      const computeReadyAfterStop = Boolean(host.computeManager?.submitTask);
      await host.destroy();
      return {
        before,
        authorityBefore,
        start,
        afterStart,
        stop,
        afterStop,
        stateReadyAfterStop,
        computeReadyAfterStop
      };
    } catch (error) {
      await host.destroy?.();
      throw error;
    }
  });

  expect(result.before.nodeKernelMode).toBe('real-peercompute-nodekernel');
  expect(result.before.nodeKernelStarted).toBe(false);
  expect(result.before.nodeKernelNetworkConnected).toBe(false);
  expect(result.before.nodeKernelNetworkGateStatus).toBe('not-started');
  expect(result.authorityBefore.status).toBe('initialized-not-started');
  expect(result.authorityBefore.networkConnected).toBe(false);
  expect(result.start.schema).toBe('peercompute.ulg.nodekernel-network-gate.v0');
  expect(result.start.status).toBe('started');
  expect(result.start.started).toBe(true);
  expect(result.start.authority.status).toBe('started-connected');
  expect(result.start.authority.networkConnected).toBe(true);
  expect(result.start.authority.peerId).toEqual(expect.stringContaining('12D3'));
  expect(result.afterStart.nodeKernelStarted).toBe(true);
  expect(result.afterStart.nodeKernelNetworkConnected).toBe(true);
  expect(result.afterStart.nodeKernelNetworkGateStatus).toBe('started');
  expect(result.stop.schema).toBe('peercompute.ulg.nodekernel-network-gate.v0');
  expect(result.stop.status).toBe('stopped-network-only');
  expect(result.stop.stopped).toBe(true);
  expect(result.stop.authority.status).toBe('initialized-not-started');
  expect(result.stop.authority.networkConnected).toBe(false);
  expect(result.afterStop.nodeKernelStarted).toBe(false);
  expect(result.afterStop.nodeKernelNetworkConnected).toBe(false);
  expect(result.afterStop.nodeKernelNetworkGateStatus).toBe('stopped-network-only');
  expect(result.stateReadyAfterStop).toBe(true);
  expect(result.computeReadyAfterStop).toBe(true);
});

test('SPH phase browser PeerCompute provider transport replays resident warm deltas over relay', async ({ page }) => {
  test.setTimeout(180_000);
  const relay = await startPeerComputeRelayForPlaywright();
  try {
    await page.goto('/');
    const result = await page.evaluate(async ({ relayAddress }) => {
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const waitFor = async (check, { timeoutMs = 30_000, intervalMs = 100, label = 'condition' } = {}) => {
        const startedAt = Date.now();
        while (Date.now() - startedAt < timeoutMs) {
          const value = await check();
          if (value) return value;
          await sleep(intervalMs);
        }
        throw new Error(`Timed out waiting for ${label}`);
      };
      const hostModule = await import('/src/runtime/peercomputeBrowserResidentHost.js');
      const roomId = `ulg-provider-live-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const docName = `${roomId}-doc`;
      const scope = 'ulg-sph-resident-pass-dag';
      const taskId = 'live-provider-preexisting-resident-delta';
      const stateKey = `${roomId}:state:step-7`;
      const makeHost = async (label) => {
        const publications = [];
        const host = await hostModule.createPeerComputeResidentAuthorityHost({
          computeTaskModulePath: '/src/runtime/sph/sphMlsMpmGpuStep.js',
          enableWorkers: false,
          enablePersistence: false,
          disableNetworkProvider: false,
          disableBroadcast: true,
          docName,
          deltaNamespace: 'deltas',
          nodeKernelConfig: {
            topology: 'distributed',
            topologyId: 'ulg-provider-transport-gate',
            roomId,
            gameId: 'ulg',
            topicPrefix: 'ulg',
            useScopedTopics: true,
            bootstrapPeers: [relayAddress],
            enableNetVizDebugTelemetry: false,
            enableNetVizSessionBroadcast: false,
            enableNetVizSessionDiscovery: false,
            enableWarmDeltaProvider: false,
            maxConnections: 4,
            targetConnections: 1,
            maxIncomingPendingConnections: 4,
            maxParallelDials: 2,
            maxDialQueueLength: 4,
            maxPeerAddrsToDial: 4,
            pubsubPeerDiscovery: true,
            onPublishSuccess(topic, payload) {
              publications.push({
                label,
                topic,
                type: payload?.payload?.type || payload?.type || null,
                target: payload?.target || null
              });
            }
          }
        });
        host.__testPublications = publications;
        return host;
      };

      const source = await makeHost('source');
      let replica = null;
      try {
        const sourceStart = await source.startNodeKernelNetwork();
        if (!sourceStart.started) {
          throw new Error(`source network failed: ${sourceStart.error || sourceStart.status}`);
        }
        const delta = {
          schema: 'peercompute.ulg.mls-mpm-resident-steps-commit-delta.v0',
          taskId,
          scope,
          version: 7,
          timestamp: Date.now(),
          payload: {
            schema: 'peercompute.ulg.mls-mpm-resident-steps-state-delta.v0',
            stateKey,
            completedStepCount: 7,
            outputFamilies: ['sph-particle-state'],
            retainedBufferRefs: ['sph-state-buffer'],
            gpuFence: {
              schema: 'peercompute.compute.gpu-fence-report.v0',
              fenceSatisfied: true,
              status: 'satisfied',
              laneId: 'browser-live-provider-test',
              stateKey
            }
          }
        };
        source.computeManager.commitDelta(delta);
        const sourceCommitted = source.readResidentStepsCommittedWarmDelta({ taskId, scope, delta });

        replica = await makeHost('replica');
        const replicaStart = await replica.startNodeKernelNetwork();
        if (!replicaStart.started) {
          throw new Error(`replica network failed: ${replicaStart.error || replicaStart.status}`);
        }

        const replicaWarmEntry = await waitFor(() => (
          replica.stateManager.getWarmDeltas(scope)?.[taskId] || null
        ), {
          timeoutMs: 45_000,
          intervalMs: 250,
          label: 'replica resident warm delta over provider transport'
        });
        const replicaCommitted = replica.readResidentStepsCommittedWarmDelta({ taskId, scope, delta });
        const sourceStats = source.nodeKernel.getStatus?.()?.network || source.nodeKernel.getNetworkManager?.()?.getNetworkStats?.() || null;
        const replicaStats = replica.nodeKernel.getStatus?.()?.network || replica.nodeKernel.getNetworkManager?.()?.getNetworkStats?.() || null;
        return {
          relayAddress,
          sourceStart,
          replicaStart,
          sourceCommitted,
          replicaWarmEntry,
          replicaCommitted,
          sourcePublications: source.__testPublications,
          replicaPublications: replica.__testPublications,
          sourceStats,
          replicaStats
        };
      } finally {
        await replica?.destroy?.();
        await source?.destroy?.();
      }
    }, { relayAddress: relay.address });

    expect(result.relayAddress).toContain('/wss');
    expect(result.sourceStart.started).toBe(true);
    expect(result.replicaStart.started).toBe(true);
    expect(result.sourceCommitted?.accepted).toBe(true);
    expect(result.replicaWarmEntry?.version).toBe(7);
    expect(result.replicaWarmEntry?.payload?.stateKey).toContain(':state:step-7');
    expect(result.replicaWarmEntry?.payload?.gpuFence?.fenceSatisfied).toBe(true);
    expect(result.replicaCommitted?.accepted).toBe(true);
    expect(result.sourceStats?.isConnected).toBe(true);
    expect(result.replicaStats?.isConnected).toBe(true);
    expect(result.replicaPublications.some((entry) => entry.type === 'yjs-sync-request')).toBe(true);
    expect(result.sourcePublications.some((entry) => entry.type === 'yjs-sync-response')).toBe(true);
  } finally {
    await relay.stop();
  }
});

test('SPH phase browser PeerCompute remote placement gate configures hooks without implicit network start', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/');

  const result = await page.evaluate(async () => {
    const hostModule = await import('/src/runtime/peercomputeBrowserResidentHost.js');
    const host = await hostModule.createPeerComputeResidentAuthorityHost({
      computeTaskModulePath: '/src/runtime/sph/sphMlsMpmGpuStep.js',
      enableWorkers: false,
      enablePersistence: false,
      disableNetworkProvider: true,
      disableBroadcast: true,
      nodeKernelConfig: {
        pubsubPeerDiscovery: false,
        maxConnections: 0,
        maxIncomingPendingConnections: 0,
        enableNetVizDebugTelemetry: false,
        enableNetVizSessionBroadcast: false,
        enableNetVizSessionDiscovery: false
      }
    });
    try {
      const before = host.refreshRemotePlacementGateStatus();
      const configured = host.configureRemotePlacement({
        peerId: 'peer-b',
        replicaPeerIds: ['peer-c'],
        targetReplicaCount: 2,
        quorumResultCount: 2,
        timeoutMs: 1234
      });
      const configuredCapabilities = host.computeManager.getCapabilities?.();
      const summary = hostModule.summarizePeerComputeResidentAuthorityHost(host);
      const networkSummary = hostModule.summarizePeerComputeResidentAuthorityHost(host);
      const cleared = host.clearRemotePlacement();
      const clearedCapabilities = host.computeManager.getCapabilities?.();
      const afterClearSummary = hostModule.summarizePeerComputeResidentAuthorityHost(host);
      await host.destroy();
      return {
        before,
        configured,
        configuredCapabilities,
        summary,
        networkSummary,
        cleared,
        clearedCapabilities,
        afterClearSummary
      };
    } catch (error) {
      await host.destroy?.();
      throw error;
    }
  });

  expect(result.before.schema).toBe('peercompute.ulg.remote-placement-gate.v0');
  expect(result.before.status).toBe('not-configured');
  expect(result.before.configured).toBe(false);
  expect(result.before.readyToPlace).toBe(false);
  expect(result.before.issues).toContain('remote-placement-not-configured');
  expect(result.configured.status).toBe('configured-network-not-started');
  expect(result.configured.configured).toBe(true);
  expect(result.configured.readyToPlace).toBe(false);
  expect(result.configured.primaryPeerId).toBe('peer-b');
  expect(result.configured.replicaPeerIds).toEqual(['peer-c']);
  expect(result.configured.quorumEnabled).toBe(true);
  expect(result.configured.quorumResultCount).toBe(2);
  expect(result.configured.executorId).toContain('redundant-network-placement:peer-b:peer-c');
  expect(result.configured.admissionId).toBe('ulg-resident-remote-placement-admission');
  expect(result.configured.resultValidatorId).toBe('ulg-resident-remote-result-quorum');
  expect(result.configured.issues).toContain('nodekernel-network-not-started');
  expect(result.configuredCapabilities.placementExecutor).toBe(true);
  expect(result.configuredCapabilities.placementAdmission).toBe(true);
  expect(result.configuredCapabilities.placementResultValidator).toBe(true);
  expect(result.configuredCapabilities.placementTimeoutMs).toBe(1234);
  expect(result.configuredCapabilities.remoteResultVerification).toBe(true);
  expect(result.summary.remotePlacementStatus).toBe('configured-network-not-started');
  expect(result.summary.remotePlacementConfigured).toBe(true);
  expect(result.summary.remotePlacementReady).toBe(false);
  expect(result.summary.remotePlacementQuorumEnabled).toBe(true);
  expect(result.networkSummary.nodeKernelStarted).toBe(false);
  expect(result.networkSummary.nodeKernelNetworkConnected).toBe(false);
  expect(result.cleared.status).toBe('cleared');
  expect(result.cleared.configured).toBe(false);
  expect(result.clearedCapabilities.placementExecutor).toBe(false);
  expect(result.clearedCapabilities.placementAdmission).toBe(false);
  expect(result.clearedCapabilities.placementResultValidator).toBe(false);
  expect(result.afterClearSummary.remotePlacementStatus).toBe('cleared');
});

test('SPH phase resident auto scheduler can use the default PeerCompute resident authority host', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1&dropn=2&basen=3&boxx=4&boxy=4&boxz=4&residentAuto=1&visualCapture=1');
  if (await page.locator('#sph-phase-overlay').count() === 0) {
    await page.locator('#run-sph-phase').click();
  }
  await expect(page.locator('#sph-phase-overlay')).toBeVisible();
  await page.waitForFunction(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    return Boolean(
      overlay?.__sphPeerComputeResidentAuthorityHost?.status === 'ready'
      && overlay?.__sphResidentComputeManager?.source === 'peercompute-resident-authority-host'
      && overlay?.__sphResidentStateManager?.source === 'peercompute-resident-authority-host'
      && overlay?.__mlsMpmResidentSteps?.computeManagerTask?.status === 'state-manager-committed-inline-execution-returned'
    );
  }, null, { timeout: 150_000 });

  const result = await page.evaluate(async () => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const host = overlay.__sphPeerComputeResidentAuthorityHost;
    const manager = overlay.__sphResidentComputeManager;
    const stateManager = overlay.__sphResidentStateManager;
    const execution = overlay.__mlsMpmResidentSteps;
    const taskId = execution?.commitDelta?.taskId ?? null;
    const warm = window.__ulgResidentAuthorityHost?.stateManager?.getWarmDeltas?.('ulg-sph-resident-pass-dag') || {};
    const sameDevicePublication = execution?.sameDeviceHotBufferSourcePublication || null;
    const sameDeviceSourceRecord = sameDevicePublication?.hotBufferKey
      ? window.__ulgResidentAuthorityHost?.stateManager?.getHotBuffer?.(sameDevicePublication.hotBufferKey)
      : null;
    const out = {
      host,
      manager,
      stateManager,
      executionSchema: execution?.schema ?? null,
      computeManagerTaskStatus: execution?.computeManagerTask?.status ?? null,
      computeManagerTaskLaneId: execution?.computeManagerTask?.laneId ?? null,
      computeManagerTaskRequestedLaneId: execution?.computeManagerTask?.requestedLaneId ?? null,
      stateManagerCommitAccepted: execution?.computeManagerTask?.stateManagerCommitAccepted ?? null,
      stateManagerCommitStatus: execution?.stateManagerCommit?.status ?? null,
      stateManagerCommitGpuFenceSatisfied: execution?.stateManagerCommit?.gpuFenceSatisfied ?? null,
      taskId,
      warmDeltaKeys: Object.keys(warm),
      warmPayloadSchema: taskId ? warm[taskId]?.payload?.schema ?? null : null,
      sameDevicePublicationStatus: sameDevicePublication?.status ?? null,
      sameDevicePublicationSourceMode: sameDevicePublication?.sourceMode ?? null,
      sameDevicePublicationSourceTaskId: sameDevicePublication?.sourceTaskId ?? null,
      sameDevicePublicationHotBufferKey: sameDevicePublication?.hotBufferKey ?? null,
      sameDeviceImportSourceHotBufferKey: execution?.sameDeviceRetainedBufferImport?.sourceHotBufferKey ?? null,
      sameDeviceG2pImportSourceHotBufferKey: execution?.finalStep?.g2pReconstruction?.sameDeviceRetainedBufferImport?.sourceHotBufferKey ?? null,
      sameDeviceSourceRecordStatus: sameDeviceSourceRecord?.status ?? null,
      sameDeviceSourceRecordHasHandles: Boolean(
        sameDeviceSourceRecord?.sphUpload?.stateBuffer
        && sameDeviceSourceRecord?.sphUpload?.thermoBuffer
        && sameDeviceSourceRecord?.mlsMpmUpload?.mechanicsBuffer
      ),
      finalStepBackend: execution?.finalStep?.backend ?? null,
      finalStepReadbackMode: execution?.finalStep?.readbackMode ?? null
    };
    overlay.__sphScene?.dispose?.();
    overlay.__sphScene = null;
    await window.__ulgResidentAuthorityHost?.destroy?.();
    window.__ulgResidentAuthorityHost = null;
    return out;
  });

  expect(result.host.schema).toBe('peercompute.ulg.browser-resident-authority-host.v0');
  expect(result.host.status).toBe('ready');
  expect(result.host.source).toBe('peercompute-browser-nodekernel-authority-host');
  expect(result.host.computeManagerReady).toBe(true);
  expect(result.host.stateManagerReady).toBe(true);
  expect(result.host.nodeKernelAuthority).toBe('peercompute.ulg.nodekernel-authority.v0');
  expect(result.host.nodeKernelMode).toBe('real-peercompute-nodekernel');
  expect(result.host.nodeKernelReady).toBe(true);
  expect(result.host.nodeKernelStarted).toBe(false);
  expect(result.host.nodeKernelConstructor).toBe('NodeKernel');
  expect(result.manager.source).toBe('peercompute-resident-authority-host');
  expect(result.stateManager.source).toBe('peercompute-resident-authority-host');
  expect(result.executionSchema).toBe('peercompute.ulg.mls-mpm-gpu-resident-steps-execution.v0');
  expect(result.computeManagerTaskStatus).toBe('state-manager-committed-inline-execution-returned');
  expect(result.computeManagerTaskRequestedLaneId).toBe('ulg:sph-resident:demo-auto');
  expect(result.computeManagerTaskLaneId).toContain('ulg:sph-resident:demo-auto:state-');
  expect(result.stateManagerCommitAccepted).toBe(true);
  expect(result.stateManagerCommitStatus).toBe('committed');
  expect(result.stateManagerCommitGpuFenceSatisfied).toBe(true);
  expect(result.warmDeltaKeys).toContain(result.taskId);
  expect(result.warmPayloadSchema).toBe('peercompute.ulg.mls-mpm-resident-steps-state-delta.v0');
  expect(result.sameDevicePublicationStatus).toBe('same-device-hot-buffer-source-published');
  expect(result.sameDevicePublicationSourceMode).toBe('mounted-resident-compute-manager-output');
  expect(result.sameDevicePublicationSourceTaskId).toBe(result.taskId);
  expect(result.sameDevicePublicationHotBufferKey).toContain('ulg:sph-resident-same-device-source');
  expect(result.sameDeviceImportSourceHotBufferKey).toBe(result.sameDevicePublicationHotBufferKey);
  expect(result.sameDeviceG2pImportSourceHotBufferKey).toBe(result.sameDevicePublicationHotBufferKey);
  expect(result.sameDeviceSourceRecordStatus).toBe('hot-buffer-source-stored');
  expect(result.sameDeviceSourceRecordHasHandles).toBe(true);
  expect(result.finalStepBackend).toBe('webgpu');
  expect(result.finalStepReadbackMode).toBe('no-full-readback');
});

test('SPH phase resident auto Three sphere bridge refreshes visible rows from live physics', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1.01&dropn=2&basen=3&boxx=4&boxy=4&boxz=4&mech=mlsmpm&residentAuto=1&residentWorkers=1&residentStageWorkers=1&residentFuseSequence=1&surfaceDraw=three-render-row-spheres&visualCapture=1');
  if (await page.locator('#sph-phase-overlay').count() === 0) {
    await page.locator('#run-sph-phase').click();
  }
  await expect(page.locator('#sph-phase-overlay')).toBeVisible();
  await page.waitForFunction(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const scene = overlay?.__sphScene;
    const renderState = scene?.getSphResidentRenderState?.() || overlay?.__sphResidentRenderState || null;
    const cadence = renderState?.renderReadbackCadence || overlay?.__sphResidentRenderReadbackCadence || null;
    return Boolean(
      renderState?.schema
      && renderState.surfaceDrawVisibleRendererBridge === 'three-render-row-spheres'
      && renderState.renderRowsReadbackEffectiveMode === 'full-parity-readback'
      && renderState.renderRowsReadbackRetainedPreviousBridge === false
      && Array.isArray(renderState.renderRowsDecodedCenterOfMassM)
      && renderState.renderRowsDecodedCenterOfMassM.length === 3
      && (cadence?.renderReadbackCount ?? 0) >= 1
    );
  }, null, { timeout: 150_000 });

  const first = await page.evaluate(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const scene = overlay?.__sphScene;
    const renderState = scene?.getSphResidentRenderState?.() || overlay?.__sphResidentRenderState || null;
    const surfaceDraw = scene?.getSphResidentSurfaceDraw?.() || overlay?.__sphResidentSurfaceDraw || null;
    const steps = scene?.getMlsMpmResidentSteps?.() || overlay?.__mlsMpmResidentSteps || null;
    const cadence = renderState?.renderReadbackCadence || overlay?.__sphResidentRenderReadbackCadence || null;
    return {
      center: renderState?.renderRowsDecodedCenterOfMassM ?? null,
      sourceResidentNextStep: renderState?.sourceResidentNextStep
        ?? surfaceDraw?.sourceResidentNextStep
        ?? steps?.finalStep?.particlePingPong?.nextStep
        ?? null,
      sourceResidentNextTimeS: renderState?.sourceResidentNextTimeS
        ?? surfaceDraw?.sourceResidentNextTimeS
        ?? steps?.finalStep?.particlePingPong?.nextTime
        ?? null,
      renderReadbackCount: cadence?.renderReadbackCount ?? 0
    };
  });

  await page.waitForFunction(({ firstNextStep, firstReadbackCount }) => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const scene = overlay?.__sphScene;
    const renderState = scene?.getSphResidentRenderState?.() || overlay?.__sphResidentRenderState || null;
    const surfaceDraw = scene?.getSphResidentSurfaceDraw?.() || overlay?.__sphResidentSurfaceDraw || null;
    const steps = scene?.getMlsMpmResidentSteps?.() || overlay?.__mlsMpmResidentSteps || null;
    const cadence = renderState?.renderReadbackCadence || overlay?.__sphResidentRenderReadbackCadence || null;
    const nextStep = renderState?.sourceResidentNextStep
      ?? surfaceDraw?.sourceResidentNextStep
      ?? steps?.finalStep?.particlePingPong?.nextStep
      ?? null;
    return Boolean(
      renderState?.schema
      && renderState.surfaceDrawVisibleRendererBridge === 'three-render-row-spheres'
      && renderState.renderRowsReadbackEffectiveMode === 'full-parity-readback'
      && renderState.renderRowsReadbackForcedForThreeBridge === true
      && renderState.renderRowsReadbackRetainedPreviousBridge === false
      && renderState.surfaceDrawRenderBridgeRetainedPreviousOverlay === false
      && Array.isArray(renderState.renderRowsDecodedCenterOfMassM)
      && renderState.renderRowsDecodedCenterOfMassM.length === 3
      && (cadence?.renderReadbackCount ?? 0) > firstReadbackCount
      && Number(nextStep) > Number(firstNextStep)
    );
  }, {
    firstNextStep: first.sourceResidentNextStep,
    firstReadbackCount: first.renderReadbackCount
  }, { timeout: 150_000 });

  const result = await page.evaluate((first) => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const scene = overlay?.__sphScene;
    const renderState = scene?.getSphResidentRenderState?.() || overlay?.__sphResidentRenderState || null;
    const surfaceDraw = scene?.getSphResidentSurfaceDraw?.() || overlay?.__sphResidentSurfaceDraw || null;
    const steps = scene?.getMlsMpmResidentSteps?.() || overlay?.__mlsMpmResidentSteps || null;
    const cadence = renderState?.renderReadbackCadence || overlay?.__sphResidentRenderReadbackCadence || null;
    const center = renderState?.renderRowsDecodedCenterOfMassM ?? null;
    const centerDeltaY = Array.isArray(first.center) && Array.isArray(center)
      ? center[1] - first.center[1]
      : null;
    const sourceResidentNextStep = renderState?.sourceResidentNextStep
      ?? surfaceDraw?.sourceResidentNextStep
      ?? steps?.finalStep?.particlePingPong?.nextStep
      ?? null;
    const sourceResidentNextTimeS = renderState?.sourceResidentNextTimeS
      ?? surfaceDraw?.sourceResidentNextTimeS
      ?? steps?.finalStep?.particlePingPong?.nextTime
      ?? null;
    const out = {
      first,
      center,
      centerDeltaY,
      renderReadbackCount: cadence?.renderReadbackCount ?? 0,
      sourceResidentNextStep,
      sourceResidentNextTimeS,
      renderRowsReadbackEffectiveMode: renderState?.renderRowsReadbackEffectiveMode ?? null,
      renderRowsReadbackForcedForThreeBridge: renderState?.renderRowsReadbackForcedForThreeBridge ?? null,
      renderRowsReadbackRetainedPreviousBridge: renderState?.renderRowsReadbackRetainedPreviousBridge ?? null,
      surfaceDrawStatus: renderState?.surfaceDrawStatus ?? null,
      surfaceDrawVisibleRendererBridge: renderState?.surfaceDrawVisibleRendererBridge ?? null,
      surfaceDrawRenderBridgeRetainedPreviousOverlay:
        renderState?.surfaceDrawRenderBridgeRetainedPreviousOverlay ?? null,
      surfaceDrawSourceResidentNextStep: surfaceDraw?.sourceResidentNextStep ?? null
    };
    overlay.__sphScene?.dispose?.();
    overlay.__sphScene = null;
    return out;
  }, first);

  expect(result.renderReadbackCount).toBeGreaterThan(first.renderReadbackCount);
  expect(result.sourceResidentNextStep).toBeGreaterThan(first.sourceResidentNextStep);
  expect(result.sourceResidentNextTimeS).toBeGreaterThan(first.sourceResidentNextTimeS);
  expect(result.surfaceDrawVisibleRendererBridge).toBe('three-render-row-spheres');
  expect(result.renderRowsReadbackEffectiveMode).toBe('full-parity-readback');
  expect(result.renderRowsReadbackForcedForThreeBridge).toBe(true);
  expect(result.renderRowsReadbackRetainedPreviousBridge).toBe(false);
  expect(result.surfaceDrawRenderBridgeRetainedPreviousOverlay).toBe(false);
  expect(Math.abs(result.centerDeltaY)).toBeGreaterThan(1e-5);
});

test('SPH phase resident auto scheduler uses an injected ComputeManager lane host', async ({ page }) => {
  test.setTimeout(150_000);
  await page.addInitScript(() => {
    window.__ulgResidentComputeManager = {
      schema: 'peercompute.ulg.test-resident-compute-manager.v0',
      submissions: [],
      async submitTask(task) {
        this.submissions.push({
          schema: task.schema,
          id: task.id,
          exportName: task.exportName,
          laneId: task.gpuResidentLane?.laneId ?? null,
          stateKey: task.gpuResidentLane?.stateKey ?? null,
          lawGraphNodeId: task.lawGraphNode?.nodeId ?? null
        });
        const module = await import('/src/runtime/sph/sphMlsMpmGpuStep.js');
        const result = await module.runMlsMpmResidentStepsComputeTask(task.data);
        return {
          status: 'accepted-inline-global-compute-manager',
          acceptedTaskId: task.id,
          result
        };
      }
    };
  });
  await page.goto('/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1&dropn=2&basen=3&boxx=4&boxy=4&boxz=4&residentAuto=1&visualCapture=1');
  if (await page.locator('#sph-phase-overlay').count() === 0) {
    await page.locator('#run-sph-phase').click();
  }
  await expect(page.locator('#sph-phase-overlay')).toBeVisible();
  await page.waitForFunction(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    return Boolean(
      overlay?.__mlsMpmResidentSteps?.computeManagerTask?.status === 'inline-execution-returned'
      && window.__ulgResidentComputeManager?.submissions?.length > 0
    );
  }, null, { timeout: 120_000 });

  const result = await page.evaluate(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const manager = window.__ulgResidentComputeManager;
    const execution = overlay.__mlsMpmResidentSteps;
    const managerStatus = overlay.__sphResidentComputeManager;
    overlay.__sphScene?.dispose?.();
    overlay.__sphScene = null;
    return {
      managerStatus,
      submitted: manager.submissions,
      executionSchema: execution?.schema ?? null,
      computeManagerTaskStatus: execution?.computeManagerTask?.status ?? null,
      computeManagerTaskLaneId: execution?.computeManagerTask?.laneId ?? null,
      computeManagerTaskRequestedLaneId: execution?.computeManagerTask?.requestedLaneId ?? null,
      computeTaskSchema: execution?.computeTaskSchema ?? null,
      lawGraphNodeId: execution?.lawGraphNode?.nodeId ?? null,
      gpuFenceStatus: execution?.gpuFence?.status ?? null,
      gpuFenceSatisfied: execution?.gpuFence?.fenceSatisfied ?? null,
      finalStepBackend: execution?.finalStep?.backend ?? null,
      finalStepReadbackMode: execution?.finalStep?.readbackMode ?? null
    };
  });

  expect(result.managerStatus.schema).toBe('peercompute.ulg.sph-demo-resident-compute-manager.v0');
  expect(result.managerStatus.status).toBe('available');
  expect(result.managerStatus.source).toBe('global.__ulgResidentComputeManager');
  expect(result.submitted.length).toBeGreaterThan(0);
  expect(result.submitted[0].schema).toBe('peercompute.ulg.mls-mpm-resident-steps-compute-task.v0');
  expect(result.submitted[0].exportName).toBe('runMlsMpmResidentStepsComputeTask');
  expect(result.submitted[0].laneId).toContain('ulg:sph-resident:demo-auto:state-');
  expect(result.submitted[0].lawGraphNodeId).toBe('ulg-mls-mpm-sph-resident-pass-dag');
  expect(result.executionSchema).toBe('peercompute.ulg.mls-mpm-gpu-resident-steps-execution.v0');
  expect(result.computeManagerTaskStatus).toBe('inline-execution-returned');
  expect(result.computeManagerTaskRequestedLaneId).toBe('ulg:sph-resident:demo-auto');
  expect(result.computeManagerTaskLaneId).toContain('ulg:sph-resident:demo-auto:state-');
  expect(result.computeTaskSchema).toBe('peercompute.ulg.mls-mpm-resident-steps-compute-task.v0');
  expect(result.lawGraphNodeId).toBe('ulg-mls-mpm-sph-resident-pass-dag');
  expect(['queue-work-completed', 'readback-map-completed']).toContain(result.gpuFenceStatus);
  expect(result.gpuFenceSatisfied).toBe(true);
  expect(result.finalStepBackend).toBe('webgpu');
  expect(result.finalStepReadbackMode).toBe('no-full-readback');
});

test('SPH phase CPU-SPH view refreshes after particle sync and page visibility resume', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1.01&dropn=3&basen=5&boxx=5&boxy=5&boxz=5&mech=sph&residentAuto=0&visualCapture=1');
  if (await page.locator('#sph-phase-overlay').count() === 0) {
    await page.locator('#run-sph-phase').click();
  }
  await expect(page.locator('#sph-phase-overlay')).toBeVisible();
  await page.waitForFunction(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const viewState = overlay?.__sphPhaseViewState;
    const sceneState = overlay?.__sphScene?.getSphGpuParticleState?.();
    const workerStatus = overlay?.__sphPhaseRebuildWorker?.status;
    const hasPackedViewState = Boolean(viewState?.positionsM?.length && overlay?.__sphSetParticlesTiming);
    const hasSceneState = Boolean(sceneState?.schema || overlay?.__sphGpuParticleState?.schema);
    return Boolean(
      !overlay?.__sphCpuClosureTask?.active
      && typeof overlay?.__sphStep === 'function'
      && (hasPackedViewState || hasSceneState || overlay?.__sphDriver || workerStatus === 'fallback-main-thread')
    );
  }, null, { timeout: 60_000 });

  const result = await page.evaluate(async () => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const sceneApi = overlay.__sphScene;
    const step = await overlay.__sphStep(1);
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('pageshow'));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    sceneApi.scene.updateMatrixWorld?.(true);
    const surfaces = [];
    sceneApi.scene.traverse?.((node) => {
      if (node.userData?.renderMode !== 'continuous-marching-cubes') return;
      surfaces.push({
        visible: node.visible === true,
        materialKey: node.userData.materialKey ?? null,
        phase: node.userData.phase ?? null,
        renderSource: node.userData.renderSource ?? null,
        particleCount: node.userData.particleCount ?? 0,
        surfaceRadiusM: node.userData.surfaceRadiusM ?? null,
        drawCount: node.geometry?.drawRange?.count ?? null
      });
    });
    return {
      step,
      statusText: overlay.querySelector('#sph-status')?.textContent ?? '',
      setParticlesTiming: sceneApi.scene.userData.sphSetParticlesTiming || null,
      viewportRefresh: sceneApi.scene.userData.sphViewportRefresh || null,
      viewportRefreshBurst: sceneApi.scene.userData.sphViewportRefreshBurst || null,
      visibleSurfaces: surfaces.filter((surface) => surface.visible)
    };
  });

  expect(result.step.blocked).not.toBe(true);
  expect(result.statusText).toContain('mechanics mode   : sph');
  expect(result.setParticlesTiming?.presentationRefresh?.immediateRefresh?.status).toBe('viewport-refresh-rendered');
  expect(result.viewportRefreshBurst?.status).toBe('viewport-refresh-burst-complete');
  expect(result.viewportRefreshBurst?.completedFrameCount).toBeGreaterThanOrEqual(2);
  expect(result.viewportRefresh?.status).toBe('viewport-refresh-rendered');
  expect(result.visibleSurfaces.length).toBeGreaterThan(0);
  expect(result.visibleSurfaces.some((surface) => (
    surface.materialKey === 'h2o'
    && surface.renderSource === 'cpu-particles'
    && surface.particleCount > 0
    && surface.drawCount > 0
  ))).toBe(true);
});

test('ULG oscillator demo consumes a cached closure and emits a simulation artifact', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Run Oscillator' })).toBeVisible();
  await page.waitForFunction(() => typeof window.__ulgDemo?.runOscillatorDemo === 'function');
  const result = await page.evaluate(async () => {
    const run = await window.__ulgDemo.runOscillatorDemo({
      steps: 32,
      dt: 0.002,
      backendPreference: ['webgpu', 'cpu-reference']
    });
    const artifact = await window.__ulgDemo.artifactCache.get(run.artifactRef);
    const summary = await window.__ulgDemo.artifactCache.getSummary(run.artifactRef);
    const closureArtifact = await window.__ulgDemo.artifactCache.get(run.closureRef);
    return {
      status: run.status,
      closureValidity: run.closureValidity,
      artifactRef: run.artifactRef,
      closureRef: run.closureRef,
      closureArtifact,
      artifact,
      summary,
      closureRegistry: window.__ulgDemo.closureRegistry.list(),
      services: window.__ulgDemo.telemetry.services.map((service) => service.serviceId)
    };
  });
  expect(result.status).toBe('complete');
  expect(result.closureValidity).toBe('in-range');
  expect(result.artifactRef.uri).toMatch(/^artifact:\/\/sha256:[0-9a-f]{64}$/);
  expect(result.closureRef.uri).toMatch(/^artifact:\/\/sha256:[0-9a-f]{64}$/);
  expect(result.closureArtifact.tableDescriptor.wgslTableDescriptor.schema).toBe(
    'peercompute.ulg.closure-table-wgsl-descriptor.v0'
  );
  expect(result.closureArtifact.execution.wgslTableDescriptor.status).toBe('declared-table-wgsl-layout');
  expect(result.closureArtifact.execution.wgslTableDescriptor.sampleStruct).toBe('ClosureTableSample');
  expect(result.closureArtifact.execution.wgslTableDescriptor.sampleStrideFloats).toBe(4);
  expect(result.closureArtifact.execution.wgslTableDescriptor.rowLayout).toEqual([
    'axis:f32',
    'value:f32',
    'derivative:f32',
    'pad0:f32'
  ]);
  expect(result.closureArtifact.execution.wgslTableDescriptor.scientificValidation).toBe(false);
  expect(result.closureArtifact.execution.wgslTableDescriptor.fullPhysicsValidation).toBe(false);
  expect(result.closureArtifact.execution.wgslTableDescriptor.materialValidation).toBe(false);
  expect(result.closureArtifact.execution.wgslTableDescriptor.eosValidation).toBe(false);
  expect(result.closureArtifact.execution.wgslTableDescriptor.sphValidation).toBe(false);
  expect(result.closureArtifact.execution.wgslTableDescriptor.phaseChangeValidation).toBe(false);
  expect(result.artifact.schema).toBe('peercompute.ulg.simulation-artifact.v0');
  expect(result.artifact.sourceService).toBe('ulg-runtime');
  expect(result.artifact.representation).toBe('carrier-toy');
  expect(['cpu-reference', 'webgpu']).toContain(result.artifact.execution.backend);
  expect(result.artifact.execution.webgpuStatus.status).not.toBe('not-requested');
  expect(result.artifact.execution.steps).toBe(32);
  if (result.artifact.execution.backend === 'webgpu') {
    expect(result.artifact.execution.webgpuStatus.status).toBe('webgpu-executed');
    expect(result.artifact.execution.webgpuParity.schema).toBe('peercompute.ulg.carrier-webgpu-parity.v0');
    expect(result.artifact.execution.webgpuParity.status).toBe('pass');
  } else {
    expect([
      'blocked-webgpu-unavailable',
      'webgpu-device-lost-fallback',
      'webgpu-error-fallback',
      'webgpu-parity-failed'
    ]).toContain(
      result.artifact.execution.webgpuStatus.status
    );
  }
  expect(result.artifact.outputs.deltas.length).toBe(32);
  expect(result.artifact.outputs.deltas[0].edgeMessageSummary.schema).toBe('peercompute.ulg.edge-message-summary.v0');
  expect(result.artifact.outputs.deltas[0].edgeMessageSummary.status).toBe('pass');
  expect(result.artifact.outputs.deltas[0].fieldObserverSummary.schema).toBe('peercompute.ulg.field-observer-summary.v0');
  expect(result.artifact.outputs.deltas[0].fieldObserverSummary.status).toBe('pass');
  expect(result.artifact.outputs.deltas[0].fieldClosureSampleSummary.schema).toBe('peercompute.ulg.field-closure-sample-summary.v0');
  expect(result.artifact.outputs.deltas[0].fieldClosureSampleSummary.status).toBe('pass');
  expect(result.artifact.outputs.deltas[0].fieldClosureSampleSummary.validityStatus).toBe('in-range');
  expect(result.artifact.outputs.deltas[0].fieldClosureSampleSummary.closureRefreshRequest.status).toBe('not-needed');
  expect(result.artifact.outputs.deltas[0].fieldClosureSampleSummary.closureRefreshRecommended).toBe(false);
  expect(result.artifact.outputs.invariants.status).toBe('pass');
  expect(result.artifact.validation.scientificValidation).toBe(false);
  expect(result.artifact.validation.fullPhysicsValidation).toBe(false);
  expect(result.summary.artifactKind).toBe('simulation-delta');
  expect(result.summary.simulationBackend).toBe(result.artifact.execution.backend);
  expect(result.summary.simulationWebGpuStatus).toBe(result.artifact.execution.webgpuStatus.status);
  expect(result.summary.simulationInvariantStatus).toBe('pass');
  expect(result.summary.simulationDeltaCount).toBe(32);
  expect(result.summary.simulationEdgeMessageSummarySchema).toBe('peercompute.ulg.edge-message-summary.v0');
  expect(result.summary.simulationEdgeMessageSummaryStatus).toBe('pass');
  expect(result.summary.simulationEdgeMessageSummaryCount).toBe(32);
  expect(result.summary.simulationEdgeMessageMaxNetForceAbs).toBe(0);
  expect(result.summary.simulationEdgeMessageMaxAntisymmetricResidualAbs).toBe(0);
  expect(result.summary.simulationEdgeMessageOutOfRangeCount).toBe(0);
  expect(result.summary.simulationEdgeMessageScientificValidation).toBe(false);
  expect(result.summary.simulationEdgeMessageFullPhysicsValidation).toBe(false);
  expect(result.summary.simulationFieldObserverSummarySchema).toBe('peercompute.ulg.field-observer-summary.v0');
  expect(result.summary.simulationFieldObserverSummaryStatus).toBe('pass');
  expect(result.summary.simulationFieldObserverSummaryCount).toBe(32);
  expect(result.summary.simulationFieldObserverObservedFieldNames).toEqual([
    'positionX',
    'velocityX',
    'mass',
    'kineticEnergy',
    'closureAxisR'
  ]);
  expect(result.summary.simulationFieldObserverZeroWeightCount).toBe(0);
  expect(result.summary.simulationFieldObserverScientificValidation).toBe(false);
  expect(result.summary.simulationFieldObserverFullPhysicsValidation).toBe(false);
  expect(result.summary.simulationFieldClosureSampleSummarySchema).toBe('peercompute.ulg.field-closure-sample-summary.v0');
  expect(result.summary.simulationFieldClosureSampleSummaryStatus).toBe('pass');
  expect(result.summary.simulationFieldClosureSampleSummaryCount).toBe(32);
  expect(result.summary.simulationFieldClosureSampleValidityStatus).toBe('in-range');
  expect(result.summary.simulationFieldClosureSampleFieldName).toBe('closureAxisR');
  expect(result.summary.simulationFieldClosureSampleAxisName).toBe('r');
  expect(result.summary.simulationFieldClosureSampleCount).toBe(2);
  expect(result.summary.simulationFieldClosureSampleOutOfRangeCount).toBe(0);
  expect(result.summary.simulationFieldClosureSampleNullFieldCount).toBe(0);
  expect(result.summary.simulationFieldClosureSampleMinSampledValue).toBeGreaterThanOrEqual(0);
  expect(result.summary.simulationFieldClosureSampleMaxSampledValue).toBeGreaterThanOrEqual(
    result.summary.simulationFieldClosureSampleMinSampledValue
  );
  expect(result.summary.simulationFieldClosureSampleRefreshRequestSchema).toBe('peercompute.ulg.closure-refresh-request.v0');
  expect(result.summary.simulationFieldClosureSampleRefreshRequestStatus).toBe('not-needed');
  expect(result.summary.simulationFieldClosureSampleRefreshRecommended).toBe(false);
  expect(result.summary.simulationFieldClosureSampleInvalidationRecommended).toBe(false);
  expect(result.summary.simulationFieldClosureSampleRefreshRegistryAction).toBe('none');
  expect(result.summary.simulationFieldClosureSampleMaterialValidation).toBe(false);
  expect(result.summary.simulationFieldClosureSampleEosValidation).toBe(false);
  expect(result.summary.simulationFieldClosureSampleSphValidation).toBe(false);
  expect(result.summary.simulationFieldClosureSamplePhaseChangeValidation).toBe(false);
  if (result.artifact.execution.webgpuParity) {
    expect(result.summary.simulationWebGpuParitySchema).toBe('peercompute.ulg.carrier-webgpu-parity.v0');
    expect(result.summary.simulationWebGpuParityStatus).toBe(result.artifact.execution.webgpuParity.status);
  }
  expect(result.summary.simulationScientificValidation).toBe(false);
  expect(result.summary.simulationFullPhysicsValidation).toBe(false);
  expect(result.closureRegistry.some((entry) => (
    entry.closureKind === 'toy-two-particle-oscillator'
    && entry.status === 'valid'
  ))).toBe(true);
  expect(result.services).toContain('ulg-runtime');
  await expect(page.getByText(/simulation:carrier-toy/)).toBeVisible();
  await expect(page.getByText(/edge:pass/)).toBeVisible();
  await expect(page.getByText(/field:pass/)).toBeVisible();
  await expect(page.getByText(/closure-field:pass/)).toBeVisible();
  await expect(page.getByText(new RegExp(`sim-gpu:${result.summary.simulationWebGpuStatus}`))).toBeVisible();
  if (result.summary.simulationWebGpuParityStatus) {
    await expect(page.getByText(new RegExp(`sim-parity:${result.summary.simulationWebGpuParityStatus}`))).toBeVisible();
  }
});

async function sampledCanvasPixels(page) {
  return page.locator('canvas').evaluate((canvas) => {
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let nonBlank = 0;
    for (let index = 0; index < pixels.length; index += 64) {
      const r = pixels[index];
      const g = pixels[index + 1];
      const b = pixels[index + 2];
      if (r + g + b > 16) {
        nonBlank += 1;
      }
    }
    return { width, height, nonBlank };
  });
}

async function consumeMoonLabFixturesInBrowserWorker(page) {
  return page.evaluate(async () => {
    const [manifest, taskCapsule] = await Promise.all([
      fetch('/ulg-gpu-abi/examples/moonlab-service-manifest.json').then((response) => response.json()),
      fetch('/ulg-gpu-abi/examples/moonlab-task-capsule.json').then((response) => response.json())
    ]);

    return new Promise((resolve, reject) => {
      const worker = new Worker('/src/services/serviceContractProbe.worker.js', {
        type: 'module',
        name: 'ulg-contract-fixture-probe'
      });
      const timeout = setTimeout(() => {
        worker.terminate();
        reject(new Error('Timed out waiting for contract fixture probe worker'));
      }, 5000);
      worker.addEventListener('message', (event) => {
        clearTimeout(timeout);
        worker.terminate();
        if (event.data.type === 'fixture-error') {
          reject(new Error(event.data.error));
          return;
        }
        resolve(event.data);
      });
      worker.addEventListener('error', (event) => {
        clearTimeout(timeout);
        worker.terminate();
        reject(new Error(event.message));
      });
      worker.postMessage({ manifest, taskCapsule });
    });
  });
}

async function readMoonLabArtifact(page) {
  return readServiceArtifact(page, 'moonlab');
}

async function readServiceArtifact(page, serviceId) {
  await page.waitForFunction(
    (sourceService) => window.__ulgDemo?.telemetry?.artifacts?.some((record) => record.ref.sourceService === sourceService),
    serviceId,
    { timeout: 8000 }
  );
  return page.evaluate(async (sourceService) => {
    const record = window.__ulgDemo.telemetry.artifacts.find((artifact) => (
      artifact.ref.sourceService === sourceService
    ));
    return window.__ulgDemo.artifactCache.get(record.ref);
  }, serviceId);
}

async function readMoonLabArtifactTelemetryRecord(page) {
  return readServiceArtifactTelemetryRecord(page, 'moonlab');
}

async function readServiceArtifactTelemetryRecord(page, serviceId) {
  await page.waitForFunction(
    (sourceService) => window.__ulgDemo?.telemetry?.artifacts?.some((record) => record.ref.sourceService === sourceService),
    serviceId,
    { timeout: 8000 }
  );
  return page.evaluate((sourceService) => window.__ulgDemo.telemetry.artifacts.find((artifact) => (
    artifact.ref.sourceService === sourceService
  )), serviceId);
}

test('Schroeder cross-level grid coupling conserves mass and momentum numerically on GPU', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  const result = await page.evaluate(async () => {
    if (!navigator.gpu) return { status: 'webgpu-unavailable' };
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return { status: 'webgpu-unavailable' };
    const device = await adapter.requestDevice();
    const coupling = await import('/src/runtime/sph/schroederCrossLevelCouplingGpu.js');

    const GPUBufferUsageRef = globalThis.GPUBufferUsage;
    const makeGridBuffer = (label, rows) => {
      const buffer = device.createBuffer({
        label,
        size: Math.max(16, rows.byteLength),
        usage: GPUBufferUsageRef.STORAGE | GPUBufferUsageRef.COPY_DST | GPUBufferUsageRef.COPY_SRC
      });
      device.queue.writeBuffer(buffer, 0, rows);
      return buffer;
    };
    const readbackGridBuffer = async (buffer, floatCount) => {
      const readBuffer = device.createBuffer({
        size: floatCount * 4,
        usage: GPUBufferUsageRef.MAP_READ | GPUBufferUsageRef.COPY_DST
      });
      const encoder = device.createCommandEncoder();
      encoder.copyBufferToBuffer(buffer, 0, readBuffer, 0, floatCount * 4);
      device.queue.submit([encoder.finish()]);
      await readBuffer.mapAsync(GPUMapMode.READ);
      const rows = new Float32Array(readBuffer.getMappedRange()).slice(0, floatCount);
      readBuffer.unmap();
      readBuffer.destroy();
      return rows;
    };

    let seed = 20260702;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    const plan = coupling.createSchroederCrossLevelGridCouplingPlan({
      fineGridDims: [9, 7, 6],
      fineGridSpacingM: 0.25,
      gridOriginM: [0, 0, 0]
    });
    const stride = plan.gridStrideFloats;

    // Random massive/empty fine grid with expected float64 totals.
    const fineRows = new Float32Array(plan.fineNodeCount * stride);
    let expectedMass = 0;
    const expectedMomentum = [0, 0, 0];
    for (let index = 0; index < plan.fineNodeCount; index += 1) {
      const offset = index * stride;
      const mass = random() < 0.3 ? 0 : 0.05 + random() * 2;
      const velocity = [random() * 4 - 2, random() * 4 - 2, random() * 4 - 2];
      fineRows[offset] = mass;
      fineRows[offset + 1] = mass * velocity[0];
      fineRows[offset + 2] = mass * velocity[1];
      fineRows[offset + 3] = mass * velocity[2];
      fineRows[offset + 7] = mass > 0 ? 1 : 0;
      expectedMass += fineRows[offset];
      expectedMomentum[0] += fineRows[offset + 1];
      expectedMomentum[1] += fineRows[offset + 2];
      expectedMomentum[2] += fineRows[offset + 3];
    }
    const fineBuffer = makeGridBuffer('proof-fine-grid', fineRows);

    const restriction = await coupling.runSchroederCrossLevelGridRestrictionWebGpu({
      device,
      plan,
      fineGridBuffer: fineBuffer
    });
    const summary = await coupling.runSchroederCrossLevelGridConservationSummaryWebGpu({
      device,
      plan,
      fineGridBuffer: fineBuffer,
      coarseGridBuffer: restriction.coarseGridBuffer
    });
    const conservation = summary.conservation;

    // Constant velocity field: restrict, zero the fine momentum, prolong the
    // coarse velocity back, then read the fine grid (diagnostic-only readback)
    // and verify every massive node recovers the constant field.
    const constantVelocity = [1.5, -0.75, 2.25];
    const constantRows = new Float32Array(plan.fineNodeCount * stride);
    for (let index = 0; index < plan.fineNodeCount; index += 1) {
      const offset = index * stride;
      const mass = random() < 0.25 ? 0 : 0.1 + random();
      constantRows[offset] = mass;
      constantRows[offset + 1] = mass * constantVelocity[0];
      constantRows[offset + 2] = mass * constantVelocity[1];
      constantRows[offset + 3] = mass * constantVelocity[2];
    }
    const constantFineBuffer = makeGridBuffer('proof-constant-fine-grid', constantRows);
    const constantRestriction = await coupling.runSchroederCrossLevelGridRestrictionWebGpu({
      device,
      plan,
      fineGridBuffer: constantFineBuffer
    });
    const zeroedRows = Float32Array.from(constantRows);
    for (let index = 0; index < plan.fineNodeCount; index += 1) {
      const offset = index * stride;
      zeroedRows[offset + 1] = 0;
      zeroedRows[offset + 2] = 0;
      zeroedRows[offset + 3] = 0;
    }
    const zeroedFineBuffer = makeGridBuffer('proof-zeroed-fine-grid', zeroedRows);
    await coupling.runSchroederCrossLevelGridProlongationWebGpu({
      device,
      plan,
      coarseGridBuffer: constantRestriction.coarseGridBuffer,
      fineGridBuffer: zeroedFineBuffer
    });
    const prolongedRows = await readbackGridBuffer(zeroedFineBuffer, plan.fineNodeCount * stride);
    let maxVelocityError = 0;
    let massiveNodeCount = 0;
    for (let index = 0; index < plan.fineNodeCount; index += 1) {
      const offset = index * stride;
      const mass = prolongedRows[offset];
      if (!(mass > 0)) continue;
      massiveNodeCount += 1;
      for (let axis = 0; axis < 3; axis += 1) {
        const error = Math.abs(prolongedRows[offset + 1 + axis] / mass - constantVelocity[axis]);
        if (error > maxVelocityError) maxVelocityError = error;
      }
    }
    const prolongedSummary = await coupling.runSchroederCrossLevelGridConservationSummaryWebGpu({
      device,
      plan,
      fineGridBuffer: zeroedFineBuffer,
      coarseGridBuffer: constantRestriction.coarseGridBuffer
    });

    // Repeat the conservation check under the real MLS-MPM grid convention:
    // z-fastest flat indexing with gridShift 1 (createMlsMpmGridSpec).
    const mpmPlan = coupling.createSchroederCrossLevelGridCouplingPlan({
      fineGridDims: [9, 7, 6],
      fineGridSpacingM: 0.25,
      gridOriginM: [0, 0, 0],
      indexOrder: 'z-fastest',
      gridShift: 1
    });
    const mpmFineRows = new Float32Array(mpmPlan.fineNodeCount * mpmPlan.gridStrideFloats);
    let mpmExpectedMass = 0;
    const mpmExpectedMomentum = [0, 0, 0];
    for (let index = 0; index < mpmPlan.fineNodeCount; index += 1) {
      const offset = index * mpmPlan.gridStrideFloats;
      const mass = random() < 0.3 ? 0 : 0.05 + random() * 2;
      mpmFineRows[offset] = mass;
      mpmFineRows[offset + 1] = mass * (random() * 4 - 2);
      mpmFineRows[offset + 2] = mass * (random() * 4 - 2);
      mpmFineRows[offset + 3] = mass * (random() * 4 - 2);
      mpmExpectedMass += mpmFineRows[offset];
      mpmExpectedMomentum[0] += mpmFineRows[offset + 1];
      mpmExpectedMomentum[1] += mpmFineRows[offset + 2];
      mpmExpectedMomentum[2] += mpmFineRows[offset + 3];
    }
    const mpmFineBuffer = makeGridBuffer('proof-mpm-fine-grid', mpmFineRows);
    const mpmRestriction = await coupling.runSchroederCrossLevelGridRestrictionWebGpu({
      device,
      plan: mpmPlan,
      fineGridBuffer: mpmFineBuffer
    });
    const mpmSummary = await coupling.runSchroederCrossLevelGridConservationSummaryWebGpu({
      device,
      plan: mpmPlan,
      fineGridBuffer: mpmFineBuffer,
      coarseGridBuffer: mpmRestriction.coarseGridBuffer
    });

    restriction.destroyCoarseGridBuffer?.();
    constantRestriction.destroyCoarseGridBuffer?.();
    mpmRestriction.destroyCoarseGridBuffer?.();
    fineBuffer.destroy();
    constantFineBuffer.destroy();
    zeroedFineBuffer.destroy();
    mpmFineBuffer.destroy();
    device.destroy?.();

    return {
      status: 'ok',
      restrictionStatus: restriction.status,
      restrictionReadbackMode: restriction.readbackMode,
      summaryStatus: summary.status,
      expectedMass,
      expectedMomentum,
      conservation,
      prolongedConservation: prolongedSummary.conservation,
      maxVelocityError,
      massiveNodeCount,
      fineNodeCount: plan.fineNodeCount,
      coarseNodeCount: plan.coarseNodeCount,
      mpmExpectedMass,
      mpmExpectedMomentum,
      mpmConservation: mpmSummary.conservation,
      mpmPlanFlags: mpmPlan.flags,
      mpmCoarseGridDims: mpmPlan.coarseGridDims
    };
  });

  expect(result.status).toBe('ok');
  expect(result.restrictionStatus).toBe('schroeder-cross-level-grid-restriction-submitted');
  expect(result.restrictionReadbackMode).toBe('no-full-readback');
  expect(result.summaryStatus).toBe('schroeder-cross-level-grid-conservation-summary-submitted');

  const conservation = result.conservation;
  expect(conservation).not.toBeNull();
  // GPU totals match the float64 expectation within f32 accumulation error.
  const massScale = Math.max(1, result.expectedMass);
  expect(Math.abs(conservation.fineMassKg - result.expectedMass)).toBeLessThan(1e-4 * massScale);
  // Restriction conserves mass and momentum: residuals from the compact GPU
  // summary row must be numerically tiny relative to the totals.
  expect(Math.abs(conservation.massResidualKg)).toBeLessThan(1e-4 * massScale);
  for (let axis = 0; axis < 3; axis += 1) {
    const momentumScale = Math.max(1, Math.abs(result.expectedMomentum[axis]));
    expect(Math.abs(conservation.momentumResidualKgMPerS[axis])).toBeLessThan(1e-4 * momentumScale);
  }
  expect(conservation.fineActiveNodeCount).toBeGreaterThan(0);
  expect(conservation.coarseActiveNodeCount).toBeGreaterThan(0);
  expect(conservation.coarseActiveNodeCount).toBeLessThanOrEqual(conservation.fineActiveNodeCount);

  // Constant velocity field is preserved exactly (to f32) through
  // restriction followed by prolongation.
  expect(result.massiveNodeCount).toBeGreaterThan(0);
  expect(result.maxVelocityError).toBeLessThan(1e-5);
  // And the prolonged fine grid carries the same totals as the coarse grid.
  const prolonged = result.prolongedConservation;
  expect(Math.abs(prolonged.massResidualKg)).toBeLessThan(1e-4 * massScale);
  for (let axis = 0; axis < 3; axis += 1) {
    expect(Math.abs(prolonged.momentumResidualKgMPerS[axis]))
      .toBeLessThan(1e-4 * Math.max(1, Math.abs(prolonged.fineMomentumKgMPerS[axis])));
  }

  // The same gates hold under the real MLS-MPM grid convention
  // (z-fastest indexing, gridShift 1).
  expect(result.mpmPlanFlags).toBe(2);
  // ceil((n - shift) / 2) + shift per axis: [9,7,6] with shift 1 -> [5,4,4].
  expect(result.mpmCoarseGridDims).toEqual([5, 4, 4]);
  const mpmConservation = result.mpmConservation;
  expect(mpmConservation).not.toBeNull();
  const mpmMassScale = Math.max(1, result.mpmExpectedMass);
  expect(Math.abs(mpmConservation.fineMassKg - result.mpmExpectedMass))
    .toBeLessThan(1e-4 * mpmMassScale);
  expect(Math.abs(mpmConservation.massResidualKg)).toBeLessThan(1e-4 * mpmMassScale);
  for (let axis = 0; axis < 3; axis += 1) {
    expect(Math.abs(mpmConservation.momentumResidualKgMPerS[axis]))
      .toBeLessThan(1e-4 * Math.max(1, Math.abs(result.mpmExpectedMomentum[axis])));
  }
  expect(mpmConservation.coarseActiveNodeCount).toBeGreaterThan(0);
});

test('Schroeder two-level co-simulation couples real P2G grids and preserves a constant velocity field', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  const result = await page.evaluate(async () => {
    if (!navigator.gpu) return { status: 'webgpu-unavailable' };
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return { status: 'webgpu-unavailable' };
    const device = await adapter.requestDevice();
    // Vite may 504 dynamic imports while re-optimizing dependencies on a
    // cold dev-server cache; retry instead of failing the physics proof.
    const importWithRetry = async (path) => {
      for (let attempt = 0; attempt < 4; attempt += 1) {
        try {
          return await import(path);
        } catch (error) {
          if (attempt === 3) throw error;
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }
      return null;
    };
    const gridKernel = await importWithRetry('/src/runtime/sph/sphGridGpuKernel.js');
    const gridUpdateKernel = await importWithRetry('/src/runtime/sph/sphGridUpdateGpuKernel.js');
    const g2pKernel = await importWithRetry('/src/runtime/sph/sphG2pGpuKernel.js');
    const coupling = await importWithRetry('/src/runtime/sph/schroederCrossLevelCouplingGpu.js');
    const buffersModule = await importWithRetry('/src/runtime/sph/sphGpuBuffers.js');
    const abi = await importWithRetry('/ulg-gpu-abi/src/index.js');

    const MECHANICS_FLOATS = buffersModule.MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS;
    const packParticles = ({ positions, velocity, massKg, smoothingLengthM, dt }) => {
      const count = positions.length;
      const state = new Float32Array(count * 8);
      const thermo = new Float32Array(count * 12);
      const mechanics = new Float32Array(count * MECHANICS_FLOATS);
      for (let index = 0; index < count; index += 1) {
        const s = index * 8;
        state[s] = positions[index][0];
        state[s + 1] = positions[index][1];
        state[s + 2] = positions[index][2];
        state[s + 3] = massKg;
        state[s + 4] = velocity[0];
        state[s + 5] = velocity[1];
        state[s + 6] = velocity[2];
        state[s + 7] = 1;
        thermo[index * 12 + 3] = massKg / (smoothingLengthM ** 3);
        const m = index * MECHANICS_FLOATS;
        mechanics.set([1, 0, 0, 0, 1, 0, 0, 0, 1], m);
        mechanics[m + 18] = 1;
        mechanics[m + 19] = massKg / (massKg / (smoothingLengthM ** 3));
        mechanics[m + 20] = 1;
        mechanics[m + 21] = 1;
        mechanics[m + 27] = 1;
      }
      return {
        sphParticleState: {
          schema: abi.ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
          particleCount: count,
          smoothingLengthM,
          step: 0,
          time: 0,
          state,
          thermo
        },
        mlsMpmParticleState: {
          schema: abi.ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
          particleCount: count,
          step: 0,
          time: 0,
          mechanicsDtS: dt,
          mechanics
        }
      };
    };

    const boxDimsM = [6, 6, 6];
    const fineDx = 0.5;
    const coarseDx = 1.0;
    const dt = 1e-4;
    const velocity = [0.3, -0.2, 0.1];
    const gravity = [0, 0, 0];

    // Interior particle blocks: quadratic stencils must not reach nodes
    // inside the wall-barrier band (one grid spacing per level), which
    // zeroes tangential velocity at the walls even in single-level runs.
    // Coarse particles at 2.6..3.4 with dx=1 keep every stencil node at
    // least one coarse spacing from all six walls.
    const finePositions = [];
    for (let x = 0; x < 3; x += 1) {
      for (let y = 0; y < 3; y += 1) {
        finePositions.push([2.6 + x * 0.4, 2.6 + y * 0.4, 2.8]);
      }
    }
    const coarsePositions = [];
    for (let x = 0; x < 2; x += 1) {
      for (let y = 0; y < 2; y += 1) {
        coarsePositions.push([2.6 + x * 0.8, 2.6 + y * 0.8, 3.2]);
      }
    }
    const fineMassKg = 0.5;
    const coarseMassKg = 4.0;
    const fine = packParticles({
      positions: finePositions,
      velocity,
      massKg: fineMassKg,
      smoothingLengthM: fineDx,
      dt
    });
    const coarse = packParticles({
      positions: coarsePositions,
      velocity,
      massKg: coarseMassKg,
      smoothingLengthM: coarseDx,
      dt
    });

    // Same-level P2G on each level's own grid (real production kernel).
    const fineProjection = await gridKernel.runMlsMpmP2gGridProjectionWebGpu({
      device,
      sphParticleState: fine.sphParticleState,
      mlsMpmParticleState: fine.mlsMpmParticleState,
      gridSpacingM: fineDx,
      boxDimsM,
      dt,
      retainGridBuffer: true,
      readbackMode: 'no-full-readback'
    });
    const coarseProjection = await gridKernel.runMlsMpmP2gGridProjectionWebGpu({
      device,
      sphParticleState: coarse.sphParticleState,
      mlsMpmParticleState: coarse.mlsMpmParticleState,
      gridSpacingM: coarseDx,
      boxDimsM,
      dt,
      retainGridBuffer: true,
      readbackMode: 'no-full-readback'
    });
    const fineSpec = gridKernel.createMlsMpmGridSpec({ boxDimsM, gridSpacingM: fineDx });
    const coarseSpec = gridKernel.createMlsMpmGridSpec({ boxDimsM, gridSpacingM: coarseDx });

    // Adjacent-level restriction: accumulate fine momentum into the coarse
    // P2G grid so the coarse level sees combined conserved totals.
    const couplingPlan = coupling.createSchroederCrossLevelGridCouplingPlan({
      fineGridDims: fineSpec.gridDims,
      coarseGridDims: coarseSpec.gridDims,
      fineGridSpacingM: fineDx,
      indexOrder: 'z-fastest',
      gridShift: fineSpec.shift,
      accumulate: true
    });
    await coupling.runSchroederCrossLevelGridRestrictionWebGpu({
      device,
      plan: couplingPlan,
      fineGridBuffer: fineProjection.gridBuffer,
      coarseGridBuffer: coarseProjection.gridBuffer
    });
    const combinedSummary = await coupling.runSchroederCrossLevelGridConservationSummaryWebGpu({
      device,
      plan: couplingPlan,
      fineGridBuffer: fineProjection.gridBuffer,
      coarseGridBuffer: coarseProjection.gridBuffer
    });

    // Snapshot the combined pre-update coarse momentum grid: the delta-form
    // prolongation needs parent velocity before and after the grid update.
    const coarseGridByteLength = coarseSpec.gridNodeCount * 8 * 4;
    const coarsePreGridBuffer = device.createBuffer({
      label: 'proof-coarse-pre-update-grid',
      size: coarseGridByteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    });
    {
      const encoder = device.createCommandEncoder();
      encoder.copyBufferToBuffer(
        coarseProjection.gridBuffer,
        0,
        coarsePreGridBuffer,
        0,
        coarseGridByteLength
      );
      device.queue.submit([encoder.finish()]);
    }

    // Grid updates at both levels (zero gravity, zero stress).
    const fineGridUpdate = await gridUpdateKernel.runMlsMpmGridUpdateWebGpu({
      device,
      p2gGridProjection: fineProjection,
      p2gGridBuffer: fineProjection.gridBuffer,
      dt,
      gravityMPerS2: gravity,
      boxDimsM,
      retainUpdatedGridBuffer: true,
      readbackMode: 'no-full-readback'
    });
    const coarseGridUpdate = await gridUpdateKernel.runMlsMpmGridUpdateWebGpu({
      device,
      p2gGridProjection: coarseProjection,
      p2gGridBuffer: coarseProjection.gridBuffer,
      dt,
      gravityMPerS2: gravity,
      boxDimsM,
      retainUpdatedGridBuffer: true,
      readbackMode: 'no-full-readback'
    });

    // Delta-form prolongation: fine nodes receive their parent's velocity
    // change across the coarse update instead of a raw velocity copy, so a
    // force-free field transfers exactly zero correction.
    const deltaProlongation = await coupling.runSchroederCrossLevelGridVelocityDeltaProlongationWebGpu({
      device,
      fineGridDims: fineSpec.gridDims,
      coarseGridDims: coarseSpec.gridDims,
      fineGridSpacingM: fineDx,
      indexOrder: 'z-fastest',
      gridShift: fineSpec.shift,
      boxDimsM,
      coarsePreGridBuffer,
      coarsePostGridBuffer: coarseGridUpdate.updatedGridBuffer,
      fineGridBuffer: fineGridUpdate.updatedGridBuffer
    });

    // G2P at both levels. Full readback is allowed here: this is a small
    // brute-force diagnostic scene, not the hot path.
    const fineG2p = await g2pKernel.runMlsMpmG2pWebGpu({
      device,
      sphParticleState: fine.sphParticleState,
      mlsMpmParticleState: fine.mlsMpmParticleState,
      gridUpdate: fineGridUpdate,
      updatedGridBuffer: fineGridUpdate.updatedGridBuffer,
      dt,
      boxDimsM
    });
    const coarseG2p = await g2pKernel.runMlsMpmG2pWebGpu({
      device,
      sphParticleState: coarse.sphParticleState,
      mlsMpmParticleState: coarse.mlsMpmParticleState,
      gridUpdate: coarseGridUpdate,
      updatedGridBuffer: coarseGridUpdate.updatedGridBuffer,
      dt,
      boxDimsM
    });

    const particleStats = (state, count, sourcePositions) => {
      let maxVelocityError = 0;
      let maxPositionError = 0;
      let mass = 0;
      const momentum = [0, 0, 0];
      for (let index = 0; index < count; index += 1) {
        const offset = index * 8;
        const particleMass = state[offset + 3];
        mass += particleMass;
        for (let axis = 0; axis < 3; axis += 1) {
          const v = state[offset + 4 + axis];
          momentum[axis] += particleMass * v;
          maxVelocityError = Math.max(maxVelocityError, Math.abs(v - velocity[axis]));
          const expectedPosition = sourcePositions[index][axis] + velocity[axis] * dt;
          maxPositionError = Math.max(
            maxPositionError,
            Math.abs(state[offset + axis] - expectedPosition)
          );
        }
      }
      return { mass, momentum, maxVelocityError, maxPositionError };
    };
    const fineStats = particleStats(fineG2p.state, finePositions.length, finePositions);
    const coarseStats = particleStats(coarseG2p.state, coarsePositions.length, coarsePositions);

    fineProjection.destroyGridBuffer?.();
    coarseProjection.destroyGridBuffer?.();
    coarsePreGridBuffer.destroy();
    fineGridUpdate.destroyUpdatedGridBuffer?.();
    coarseGridUpdate.destroyUpdatedGridBuffer?.();
    device.destroy?.();

    return {
      status: 'ok',
      fineParticleCount: finePositions.length,
      coarseParticleCount: coarsePositions.length,
      expectedFineMass: finePositions.length * fineMassKg,
      expectedCoarseMass: coarsePositions.length * coarseMassKg,
      expectedVelocity: velocity,
      combinedConservation: combinedSummary.conservation,
      deltaProlongationStatus: deltaProlongation.status,
      deltaProlongationMode: deltaProlongation.prolongationMode,
      fineStats,
      coarseStats
    };
  });

  expect(result.status).toBe('ok');
  const totalMass = result.expectedFineMass + result.expectedCoarseMass;

  // Gate 1: after restriction, the combined coarse grid holds the total mass
  // and momentum of BOTH particle sets (fine restricted + coarse projected),
  // read from the compact GPU conservation summary row.
  const combined = result.combinedConservation;
  expect(combined).not.toBeNull();
  expect(Math.abs(combined.fineMassKg - result.expectedFineMass))
    .toBeLessThan(1e-4 * Math.max(1, result.expectedFineMass));
  expect(Math.abs(combined.coarseMassKg - totalMass)).toBeLessThan(1e-4 * totalMass);
  for (let axis = 0; axis < 3; axis += 1) {
    const expectedCombinedMomentum = totalMass * result.expectedVelocity[axis];
    expect(Math.abs(combined.coarseMomentumKgMPerS[axis] - expectedCombinedMomentum))
      .toBeLessThan(1e-4 * Math.max(1, Math.abs(expectedCombinedMomentum)));
  }

  // Gate 2: the constant velocity field survives the full two-level cycle
  // (P2G -> restrict -> grid update -> delta-prolong -> G2P) at both levels.
  // Tolerance floor: the production P2G kernel accumulates with fixed-point
  // atomics, which quantizes to ~1e-4 relative on this scene even in a pure
  // single-level cycle. The gate asserts coupling adds no error class beyond
  // that existing floor.
  expect(result.deltaProlongationStatus)
    .toBe('schroeder-cross-level-grid-velocity-delta-prolongation-submitted');
  expect(result.deltaProlongationMode).toBe('coarse-velocity-delta-correction');
  expect(result.fineStats.maxVelocityError).toBeLessThan(5e-4);
  expect(result.coarseStats.maxVelocityError).toBeLessThan(5e-4);
  expect(result.fineStats.maxPositionError).toBeLessThan(1e-4);
  expect(result.coarseStats.maxPositionError).toBeLessThan(1e-4);

  // Gate 3: particle-level mass and momentum are conserved end to end.
  expect(Math.abs(result.fineStats.mass - result.expectedFineMass))
    .toBeLessThan(1e-4 * Math.max(1, result.expectedFineMass));
  expect(Math.abs(result.coarseStats.mass - result.expectedCoarseMass))
    .toBeLessThan(1e-4 * Math.max(1, result.expectedCoarseMass));
  for (let axis = 0; axis < 3; axis += 1) {
    const expectedFineMomentum = result.expectedFineMass * result.expectedVelocity[axis];
    const expectedCoarseMomentum = result.expectedCoarseMass * result.expectedVelocity[axis];
    // Same 5e-4 fixed-point floor as gate 2: per-particle velocity noise
    // sums into the momentum totals.
    expect(Math.abs(result.fineStats.momentum[axis] - expectedFineMomentum))
      .toBeLessThan(5e-4 * Math.max(1, Math.abs(expectedFineMomentum)));
    expect(Math.abs(result.coarseStats.momentum[axis] - expectedCoarseMomentum))
      .toBeLessThan(5e-4 * Math.max(1, Math.abs(expectedCoarseMomentum)));
  }
});

test('Schroeder admitted split materializes appended particles and grows the adopted count with mass conserved', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  const result = await page.evaluate(async () => {
    if (!navigator.gpu) return { status: 'webgpu-unavailable' };
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return { status: 'webgpu-unavailable' };
    const device = await adapter.requestDevice();
    const hierarchy = await import('/src/runtime/sph/schroederHierarchyGpu.js');
    const countModule = await import('/src/runtime/sph/schroederParticleStorageCountGpu.js');
    const stepModule = await import('/src/runtime/sph/sphMlsMpmGpuStep.js');
    const buffersModule = await import('/src/runtime/sph/sphGpuBuffers.js');
    const abi = await import('/ulg-gpu-abi/src/index.js');

    const MECHANICS_FLOATS = buffersModule.MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS;
    const SLOT_FLOATS = abi.SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_ROW_LAYOUT.length;
    const sourceParticleCount = 3;
    const massKg = 2.0;
    const state = new Float32Array(sourceParticleCount * 8);
    const thermo = new Float32Array(sourceParticleCount * 12);
    const mechanics = new Float32Array(sourceParticleCount * MECHANICS_FLOATS);
    for (let index = 0; index < sourceParticleCount; index += 1) {
      const s = index * 8;
      state[s] = 1 + index * 0.5;
      state[s + 1] = 1.5;
      state[s + 2] = 2;
      state[s + 3] = massKg;
      state[s + 4] = 0.25;
      state[s + 5] = -0.5;
      state[s + 6] = 0.75;
      state[s + 7] = 1;
      thermo[index * 12 + 2] = 1;
      thermo[index * 12 + 3] = 1000;
      const m = index * MECHANICS_FLOATS;
      mechanics.set([1, 0, 0, 0, 1, 0, 0, 0, 1], m);
      mechanics[m + 18] = 1;
      mechanics[m + 19] = massKg / 1000;
      mechanics[m + 20] = 0;
      mechanics[m + 21] = 1;
      mechanics[m + 27] = 1;
    }
    const sphParticleState = {
      schema: abi.ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount: sourceParticleCount,
      smoothingLengthM: 0.5,
      step: 0,
      time: 0,
      state,
      thermo
    };
    const mlsMpmParticleState = {
      schema: abi.ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount: sourceParticleCount,
      step: 0,
      time: 0,
      mechanicsDtS: 1e-4,
      mechanics
    };

    // Admitted slot assignment for one split: source particle 0 becomes two
    // half-mass children appended at slots 3 and 4, and source slot 0 is
    // freed (zero-mass hole awaiting compaction). Rows for particles 1 and 2
    // are keep rows with no slot movement.
    const outputParticleCapacity = 6;
    const rowCount = 3;
    const slotAssignmentRows = new Float32Array(rowCount * SLOT_FLOATS);
    const writeRow = (row, values) => {
      const offset = row * SLOT_FLOATS;
      for (const [column, value] of Object.entries(values)) {
        slotAssignmentRows[offset + Number(column)] = value;
      }
    };
    // status=3 (active+applied), admission=1; split row assigns targets 3..4
    // with per-child target mass massKg/2, frees source slot 0.
    writeRow(0, {
      0: 0,
      3: 3,
      6: 1,
      7: 2,
      9: 3,
      10: 2,
      11: 0,
      12: 1,
      19: massKg / 2,
      22: (massKg / 2) / 1000,
      29: 1,
      30: 7,
      31: 1
    });
    writeRow(1, { 0: 1, 3: 3, 6: 1, 9: -1, 11: -1, 29: 1, 30: 7, 31: 1 });
    writeRow(2, { 0: 2, 3: 3, 6: 1, 9: -1, 11: -1, 29: 1, 30: 7, 31: 1 });
    const particleStorageSlotAssignment = {
      schema: abi.ULG_SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_SCHEMA,
      status: 'schroeder-particle-storage-slot-assignment-submitted',
      allocationRowCount: rowCount,
      slotAssignmentStrideFloats: SLOT_FLOATS,
      slotAssignmentRows,
      freeListCapacity: outputParticleCapacity,
      assignmentEpoch: 1,
      stateFamilyId: 1
    };
    const particleStorageMaterializationAdmission = {
      schema: abi.ULG_SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_ADMISSION_SCHEMA,
      status: 'schroeder-particle-storage-materialization-admission-admitted',
      particleStorageMaterializationApproved: true,
      slotAssignmentDescriptorApproved: true,
      outputFamilies: ['schroeder-particle-storage-materialization'],
      targetStateFamilies: [
        'sph-particle-state',
        'mls-mpm-particle-mechanics',
        'sph-particle-thermo'
      ],
      schroederParticleStorageMaterializationRowCount: rowCount,
      requiredParticleCapacity: outputParticleCapacity,
      hotBufferKey: 'ulg:test:ss-split-materialization-admission',
      sourceHotBufferKey: 'ulg:test:ss-split-materialization-admission',
      committed: true
    };

    // Real GPU materialization of the split.
    const materialization = await hierarchy.runSchroederParticleStorageMaterializationWebGpu({
      device,
      sphParticleState,
      mlsMpmParticleState,
      particleStorageSlotAssignment,
      particleStorageMaterializationAdmission,
      outputParticleCapacity
    });

    // Real GPU count reduction over the retained materialization rows.
    const countSummary = await countModule.runSchroederParticleStorageCountSummaryWebGpu({
      device,
      particleStorageMaterialization: materialization
    });
    materialization.admittedParticleCountDelta = countSummary.admittedParticleCountDelta;

    // Storage adoption consumes the materialization plus the explicit
    // admitted count delta from the compact GPU reduction.
    const adoptionResult = stepModule.createSchroederParticleStorageAdoption({
      schroederParticleStorageMaterialization: materialization,
      sphParticleState,
      mlsMpmParticleState
    });

    // Mass conservation: read the adopted SPH state buffer (small diagnostic
    // scene) and total the live range masses.
    const stateFloats = outputParticleCapacity * 8;
    const readBuffer = device.createBuffer({
      size: stateFloats * 4,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
    });
    const encoder = device.createCommandEncoder();
    encoder.copyBufferToBuffer(materialization.particleStateBuffer, 0, readBuffer, 0, stateFloats * 4);
    device.queue.submit([encoder.finish()]);
    await readBuffer.mapAsync(GPUMapMode.READ);
    const adoptedState = new Float32Array(readBuffer.getMappedRange()).slice(0, stateFloats);
    readBuffer.unmap();
    readBuffer.destroy();

    const liveCount = countSummary.authoritativeParticleCount;
    let adoptedMass = 0;
    const slotMasses = [];
    for (let index = 0; index < liveCount; index += 1) {
      const slotMass = adoptedState[index * 8 + 3];
      slotMasses.push(slotMass);
      adoptedMass += slotMass;
    }

    materialization.destroyParticleBuffers?.();
    materialization.destroyMaterializationBuffer?.();
    device.destroy?.();

    return {
      status: 'ok',
      materializationStatus: materialization.status,
      countSummaryStatus: countSummary.status,
      countSummary: countSummary.countSummary,
      admittedParticleCountDelta: countSummary.admittedParticleCountDelta,
      authoritativeParticleCount: countSummary.authoritativeParticleCount,
      adoptionStatus: adoptionResult?.status ?? null,
      adoptionAdopted: adoptionResult?.adopted === true,
      adoptionAuthoritativeParticleCount: adoptionResult?.authoritativeParticleCount ?? null,
      adoptionOutputParticleCapacity: adoptionResult?.outputParticleCapacity ?? null,
      adoptionAdmittedParticleCountDelta: adoptionResult?.admittedParticleCountDelta ?? null,
      sourceParticleCount,
      sourceMassTotal: sourceParticleCount * massKg,
      adoptedMass,
      slotMasses
    };
  });

  expect(result.status).toBe('ok');
  expect(result.materializationStatus).toBe('schroeder-particle-storage-materialization-submitted');
  expect(result.countSummaryStatus).toBe('schroeder-particle-storage-count-summary-submitted');

  // The admitted split changes the live particle count by an explicit,
  // GPU-reduced delta: +2 children appended, 1 source slot freed
  // (append-only until compaction), so 3 -> 5.
  expect(result.countSummary.admittedRowCount).toBe(3);
  expect(result.countSummary.appendedTargetSlotCount).toBe(2);
  expect(result.countSummary.freedSourceSlotCount).toBe(1);
  expect(result.admittedParticleCountDelta).toBe(2);
  expect(result.authoritativeParticleCount).toBe(5);

  // Storage adoption consumes the explicit delta: the authoritative count
  // grows by exactly the admitted amount while capacity stays separate.
  expect(result.adoptionStatus).toBe('schroeder-particle-storage-adopted');
  expect(result.adoptionAdopted).toBe(true);
  expect(result.adoptionAdmittedParticleCountDelta).toBe(2);
  expect(result.adoptionAuthoritativeParticleCount).toBe(5);
  expect(result.adoptionOutputParticleCapacity).toBe(6);

  // Mass conservation across the split: freed source slot holds zero mass,
  // both children hold half the source mass, untouched particles keep
  // theirs, so the live-range total equals the source total.
  expect(result.slotMasses.length).toBe(5);
  expect(result.slotMasses[0]).toBe(0);
  expect(Math.abs(result.slotMasses[3] - 1.0)).toBeLessThan(1e-6);
  expect(Math.abs(result.slotMasses[4] - 1.0)).toBeLessThan(1e-6);
  expect(Math.abs(result.adoptedMass - result.sourceMassTotal)).toBeLessThan(1e-5);
});

test('Schroeder admitted merge compacts freed slots and shrinks the adopted count with mass conserved', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  const result = await page.evaluate(async () => {
    if (!navigator.gpu) return { status: 'webgpu-unavailable' };
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return { status: 'webgpu-unavailable' };
    const device = await adapter.requestDevice();
    const hierarchy = await import('/src/runtime/sph/schroederHierarchyGpu.js');
    const countModule = await import('/src/runtime/sph/schroederParticleStorageCountGpu.js');
    const compactionModule = await import('/src/runtime/sph/schroederParticleStorageCompactionGpu.js');
    const stepModule = await import('/src/runtime/sph/sphMlsMpmGpuStep.js');
    const buffersModule = await import('/src/runtime/sph/sphGpuBuffers.js');
    const abi = await import('/ulg-gpu-abi/src/index.js');

    const MECHANICS_FLOATS = buffersModule.MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS;
    const SLOT_FLOATS = abi.SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_ROW_LAYOUT.length;
    const sourceParticleCount = 3;
    const massKg = 2.0;
    const state = new Float32Array(sourceParticleCount * 8);
    const thermo = new Float32Array(sourceParticleCount * 12);
    const mechanics = new Float32Array(sourceParticleCount * MECHANICS_FLOATS);
    for (let index = 0; index < sourceParticleCount; index += 1) {
      const s = index * 8;
      state[s] = 1 + index * 0.5;
      state[s + 1] = 1.5;
      state[s + 2] = 2;
      state[s + 3] = massKg;
      state[s + 4] = 0.25;
      state[s + 5] = -0.5;
      state[s + 6] = 0.75;
      state[s + 7] = 1;
      thermo[index * 12 + 2] = 1;
      thermo[index * 12 + 3] = 1000;
      const m = index * MECHANICS_FLOATS;
      mechanics.set([1, 0, 0, 0, 1, 0, 0, 0, 1], m);
      mechanics[m + 18] = 1;
      mechanics[m + 19] = massKg / 1000;
      mechanics[m + 20] = 0;
      mechanics[m + 21] = 1;
      mechanics[m + 27] = 1;
    }
    const sphParticleState = {
      schema: abi.ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount: sourceParticleCount,
      smoothingLengthM: 0.5,
      step: 0,
      time: 0,
      state,
      thermo
    };
    const mlsMpmParticleState = {
      schema: abi.ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount: sourceParticleCount,
      step: 0,
      time: 0,
      mechanicsDtS: 1e-4,
      mechanics
    };

    // Admitted slot assignment for one merge: source particles 0 and 1
    // combine into a single double-mass child appended at slot 3, and both
    // source slots are freed. Particle 2 keeps its slot.
    const outputParticleCapacity = 6;
    const rowCount = 3;
    const slotAssignmentRows = new Float32Array(rowCount * SLOT_FLOATS);
    const writeRow = (row, values) => {
      const offset = row * SLOT_FLOATS;
      for (const [column, value] of Object.entries(values)) {
        slotAssignmentRows[offset + Number(column)] = value;
      }
    };
    writeRow(0, {
      0: 0,
      3: 3,
      6: 1,
      7: -1,
      9: 3,
      10: 1,
      11: 0,
      12: 2,
      19: massKg * 2,
      22: (massKg * 2) / 1000,
      29: 1,
      30: 7,
      31: 1
    });
    writeRow(1, { 0: 1, 3: 3, 6: 1, 9: -1, 11: -1, 29: 1, 30: 7, 31: 1 });
    writeRow(2, { 0: 2, 3: 3, 6: 1, 9: -1, 11: -1, 29: 1, 30: 7, 31: 1 });
    const particleStorageSlotAssignment = {
      schema: abi.ULG_SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_SCHEMA,
      status: 'schroeder-particle-storage-slot-assignment-submitted',
      allocationRowCount: rowCount,
      slotAssignmentStrideFloats: SLOT_FLOATS,
      slotAssignmentRows,
      freeListCapacity: outputParticleCapacity,
      assignmentEpoch: 1,
      stateFamilyId: 1
    };
    const particleStorageMaterializationAdmission = {
      schema: abi.ULG_SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_ADMISSION_SCHEMA,
      status: 'schroeder-particle-storage-materialization-admission-admitted',
      particleStorageMaterializationApproved: true,
      slotAssignmentDescriptorApproved: true,
      outputFamilies: ['schroeder-particle-storage-materialization'],
      targetStateFamilies: [
        'sph-particle-state',
        'mls-mpm-particle-mechanics',
        'sph-particle-thermo'
      ],
      schroederParticleStorageMaterializationRowCount: rowCount,
      requiredParticleCapacity: outputParticleCapacity,
      hotBufferKey: 'ulg:test:ss-merge-materialization-admission',
      sourceHotBufferKey: 'ulg:test:ss-merge-materialization-admission',
      committed: true
    };

    const materialization = await hierarchy.runSchroederParticleStorageMaterializationWebGpu({
      device,
      sphParticleState,
      mlsMpmParticleState,
      particleStorageSlotAssignment,
      particleStorageMaterializationAdmission,
      outputParticleCapacity
    });

    // Append-only count summary: the merge appends 1 child and frees 2
    // slots, so the pre-compaction live range grows to 4 with 2 holes.
    const countSummary = await countModule.runSchroederParticleStorageCountSummaryWebGpu({
      device,
      particleStorageMaterialization: materialization
    });

    // Compaction removes the freed holes so the merge can actually shrink
    // the live particle count.
    const compaction = await compactionModule.runSchroederParticleStorageCompactionWebGpu({
      device,
      particleStorageMaterialization: materialization
    });

    const adoptionResult = stepModule.createSchroederParticleStorageAdoption({
      schroederParticleStorageMaterialization: compaction,
      sphParticleState,
      mlsMpmParticleState
    });

    // Mass and order integrity from the compacted state buffer (small
    // diagnostic scene readback).
    const stateFloats = outputParticleCapacity * 8;
    const readBuffer = device.createBuffer({
      size: stateFloats * 4,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
    });
    const encoder = device.createCommandEncoder();
    encoder.copyBufferToBuffer(compaction.particleStateBuffer, 0, readBuffer, 0, stateFloats * 4);
    device.queue.submit([encoder.finish()]);
    await readBuffer.mapAsync(GPUMapMode.READ);
    const compactedState = new Float32Array(readBuffer.getMappedRange()).slice(0, stateFloats);
    readBuffer.unmap();
    readBuffer.destroy();

    const liveCount = compaction.liveParticleCount;
    let compactedMass = 0;
    const slots = [];
    for (let index = 0; index < outputParticleCapacity; index += 1) {
      const offset = index * 8;
      const slotMass = compactedState[offset + 3];
      if (index < liveCount) compactedMass += slotMass;
      slots.push({
        mass: slotMass,
        x: compactedState[offset],
        vx: compactedState[offset + 4]
      });
    }

    materialization.destroyParticleBuffers?.();
    materialization.destroyMaterializationBuffer?.();
    compaction.destroyParticleBuffers?.();
    device.destroy?.();

    return {
      status: 'ok',
      materializationStatus: materialization.status,
      preCompactionCount: countSummary.authoritativeParticleCount,
      preCompactionFreed: countSummary.countSummary.freedSourceSlotCount,
      compactionStatus: compaction.status,
      compactionSummary: compaction.compactionSummary,
      liveParticleCount: compaction.liveParticleCount,
      admittedParticleCountDelta: compaction.admittedParticleCountDelta,
      adoptionStatus: adoptionResult?.status ?? null,
      adoptionAuthoritativeParticleCount: adoptionResult?.authoritativeParticleCount ?? null,
      adoptionOutputParticleCapacity: adoptionResult?.outputParticleCapacity ?? null,
      sourceMassTotal: sourceParticleCount * massKg,
      compactedMass,
      slots
    };
  });

  expect(result.status).toBe('ok');
  expect(result.materializationStatus).toBe('schroeder-particle-storage-materialization-submitted');

  // Before compaction the merge can only append: live range 4 with 2 holes.
  expect(result.preCompactionCount).toBe(4);
  expect(result.preCompactionFreed).toBe(2);

  // Compaction turns the merge into a real count reduction: 3 -> 2.
  expect(result.compactionStatus).toBe('schroeder-particle-storage-compaction-submitted');
  expect(result.compactionSummary.freedHoleCount).toBe(4);
  expect(result.liveParticleCount).toBe(2);
  expect(result.admittedParticleCountDelta).toBe(-1);
  expect(result.adoptionStatus).toBe('schroeder-particle-storage-adopted');
  expect(result.adoptionAuthoritativeParticleCount).toBe(2);
  expect(result.adoptionOutputParticleCapacity).toBe(6);

  // Order-preserving compaction: slot 0 is the untouched particle 2
  // (x = 2.0, mass 2), slot 1 is the merged double-mass child (x = 1.0 from
  // merge source 0, mass 4), trailing slots are zeroed.
  expect(Math.abs(result.slots[0].mass - 2)).toBeLessThan(1e-6);
  expect(Math.abs(result.slots[0].x - 2.0)).toBeLessThan(1e-6);
  expect(Math.abs(result.slots[1].mass - 4)).toBeLessThan(1e-6);
  expect(Math.abs(result.slots[1].x - 1.0)).toBeLessThan(1e-6);
  expect(Math.abs(result.slots[1].vx - 0.25)).toBeLessThan(1e-6);
  expect(result.slots[2].mass).toBe(0);
  expect(result.slots[3].mass).toBe(0);

  // Mass conservation: the merged child carries both source masses, so the
  // compacted live-range total equals the source total.
  expect(Math.abs(result.compactedMass - result.sourceMassTotal)).toBeLessThan(1e-5);
});

test('Schroeder coarsen-eligible cell merges through the real proposal chain and shrinks the count', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  const result = await page.evaluate(async () => {
    if (!navigator.gpu) return { status: 'webgpu-unavailable' };
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return { status: 'webgpu-unavailable' };
    const device = await adapter.requestDevice();
    const hierarchy = await import('/src/runtime/sph/schroederHierarchyGpu.js');
    const countModule = await import('/src/runtime/sph/schroederParticleStorageCountGpu.js');
    const compactionModule = await import('/src/runtime/sph/schroederParticleStorageCompactionGpu.js');
    const stepModule = await import('/src/runtime/sph/sphMlsMpmGpuStep.js');
    const buffersModule = await import('/src/runtime/sph/sphGpuBuffers.js');
    const abi = await import('/ulg-gpu-abi/src/index.js');

    const MECHANICS_FLOATS = buffersModule.MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS;
    const MIGRATION_FLOATS = abi.SCHROEDER_PHASE_VOLUME_MIGRATION_ROW_LAYOUT.length;
    const sourceParticleCount = 4;
    const massKg = 2.0;
    // Distinct member velocities so the merged child's velocity must be the
    // mass-weighted cell average, not the leader's.
    const velocities = [
      [0.4, 0, 0],
      [-0.2, 0.6, 0],
      [0.1, -0.3, 0.5],
      [0.25, -0.5, 0.75]
    ];
    const state = new Float32Array(sourceParticleCount * 8);
    const thermo = new Float32Array(sourceParticleCount * 12);
    const mechanics = new Float32Array(sourceParticleCount * MECHANICS_FLOATS);
    for (let index = 0; index < sourceParticleCount; index += 1) {
      const s = index * 8;
      state[s] = 1 + index * 0.5;
      state[s + 1] = 1.5;
      state[s + 2] = 2;
      state[s + 3] = massKg;
      state[s + 4] = velocities[index][0];
      state[s + 5] = velocities[index][1];
      state[s + 6] = velocities[index][2];
      state[s + 7] = 1;
      thermo[index * 12 + 2] = 1;
      thermo[index * 12 + 3] = 1000;
      const m = index * MECHANICS_FLOATS;
      mechanics.set([1, 0, 0, 0, 1, 0, 0, 0, 1], m);
      mechanics[m + 18] = 1;
      mechanics[m + 19] = massKg / 1000;
      mechanics[m + 21] = 1;
      mechanics[m + 27] = 1;
    }
    const sphParticleState = {
      schema: abi.ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount: sourceParticleCount,
      smoothingLengthM: 0.5,
      step: 0,
      time: 0,
      state,
      thermo
    };
    const mlsMpmParticleState = {
      schema: abi.ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount: sourceParticleCount,
      step: 0,
      time: 0,
      mechanicsDtS: 1e-4,
      mechanics
    };

    // Admitted migration decision rows: particles 0-2 are coarsen-eligible
    // members of the same aggregate cell (node index 5, aggregate mass 6 kg);
    // particle 3 is active but neither coarsen-eligible nor refine-required.
    const migrationRows = new Float32Array(sourceParticleCount * MIGRATION_FLOATS);
    for (let index = 0; index < sourceParticleCount; index += 1) {
      const offset = index * MIGRATION_FLOATS;
      migrationRows[offset + 0] = index;
      migrationRows[offset + 1] = 0;
      migrationRows[offset + 2] = 1;
      migrationRows[offset + 3] = 1;
      migrationRows[offset + 6] = massKg / 1000;
      migrationRows[offset + 7] = massKg / 1000;
      if (index < 3) {
        migrationRows[offset + 12] = 0;
        migrationRows[offset + 13] = 3;
        migrationRows[offset + 15] = massKg * 3;
        migrationRows[offset + 16] = (massKg * 3) / 1000;
        migrationRows[offset + 22] = 1;
      }
    }
    // The hierarchy aggregate node for the merge cell: status active, cell
    // mass 6 kg, cell momentum = sum(m_i * v_i) over members 0-2.
    const cellMomentum = [0, 1, 2].reduce(
      (sum, index) => [
        sum[0] + massKg * velocities[index][0],
        sum[1] + massKg * velocities[index][1],
        sum[2] + massKg * velocities[index][2]
      ],
      [0, 0, 0]
    );
    const AGG_NODE_FLOATS = abi.SCHROEDER_HIERARCHY_AGGREGATE_NODE_ROW_LAYOUT.length;
    const aggregateNodeRows = new Float32Array(AGG_NODE_FLOATS);
    aggregateNodeRows[3] = 1;
    aggregateNodeRows[8] = massKg * 3;
    aggregateNodeRows[9] = (massKg * 3) / 1000;
    aggregateNodeRows[10] = cellMomentum[0];
    aggregateNodeRows[11] = cellMomentum[1];
    aggregateNodeRows[12] = cellMomentum[2];
    const hierarchyAggregateNode = {
      aggregateNodeCount: 1,
      aggregateNodeRows
    };
    const phaseVolumeMigration = {
      schema: abi.ULG_SCHROEDER_PHASE_VOLUME_MIGRATION_SCHEMA,
      status: 'schroeder-phase-volume-migration-submitted',
      particleCount: sourceParticleCount,
      migrationStrideFloats: MIGRATION_FLOATS,
      migrationRows,
      migrationEpoch: 1
    };

    const targetStateFamilies = [
      'sph-particle-state',
      'mls-mpm-particle-mechanics',
      'sph-particle-thermo'
    ];
    const outputParticleCapacity = 8;
    const phaseVolumeSplitMergeAdmission = {
      schema: abi.ULG_SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_ADMISSION_SCHEMA,
      status: 'schroeder-phase-volume-split-merge-admission-admitted',
      phaseVolumeSplitMergeApproved: true,
      outputFamilies: ['schroeder-phase-volume-split-merge-apply'],
      schroederPhaseVolumeSplitMergeProposalRowCount: sourceParticleCount,
      hotBufferKey: 'ulg:test:ss-real-merge-split-merge-admission',
      sourceHotBufferKey: 'ulg:test:ss-real-merge-split-merge-admission',
      committed: true
    };
    const particleStorageAllocatorAdmission = {
      schema: abi.ULG_SCHROEDER_PARTICLE_STORAGE_ALLOCATOR_ADMISSION_SCHEMA,
      status: 'schroeder-particle-storage-allocator-admission-admitted',
      particleStorageAllocationApproved: true,
      particleCapacityApproved: true,
      outputFamilies: ['schroeder-particle-storage-allocation'],
      targetStateFamilies,
      schroederParticleStorageAllocationRowCount: sourceParticleCount,
      // The admission check reads currentParticleCapacity as the approved
      // capacity ceiling; it must cover requiredParticleCapacity.
      currentParticleCapacity: outputParticleCapacity,
      requiredParticleCapacity: outputParticleCapacity,
      hotBufferKey: 'ulg:test:ss-real-merge-allocator-admission',
      sourceHotBufferKey: 'ulg:test:ss-real-merge-allocator-admission',
      committed: true
    };
    const particleStorageSlotAssignmentAdmission = {
      schema: abi.ULG_SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_ADMISSION_SCHEMA,
      status: 'schroeder-particle-storage-slot-assignment-admission-admitted',
      particleStorageSlotAssignmentApproved: true,
      freeListDescriptorApproved: true,
      outputFamilies: ['schroeder-particle-storage-slot-assignment'],
      targetStateFamilies,
      schroederParticleStorageSlotAssignmentRowCount: sourceParticleCount,
      hotBufferKey: 'ulg:test:ss-real-merge-slot-assignment-admission',
      sourceHotBufferKey: 'ulg:test:ss-real-merge-slot-assignment-admission',
      committed: true
    };
    const particleStorageMaterializationAdmission = {
      schema: abi.ULG_SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_ADMISSION_SCHEMA,
      status: 'schroeder-particle-storage-materialization-admission-admitted',
      particleStorageMaterializationApproved: true,
      slotAssignmentDescriptorApproved: true,
      outputFamilies: ['schroeder-particle-storage-materialization'],
      targetStateFamilies,
      schroederParticleStorageMaterializationRowCount: sourceParticleCount,
      requiredParticleCapacity: outputParticleCapacity,
      hotBufferKey: 'ulg:test:ss-real-merge-materialization-admission',
      sourceHotBufferKey: 'ulg:test:ss-real-merge-materialization-admission',
      committed: true
    };

    // The real production chain, no fixture rows past the migration decision.
    const proposal = await hierarchy.runSchroederPhaseVolumeSplitMergeProposalWebGpu({
      device,
      phaseVolumeMigration,
      hierarchyAggregateNode
    });
    const apply = await hierarchy.runSchroederPhaseVolumeSplitMergeApplyWebGpu({
      device,
      phaseVolumeSplitMergeProposal: proposal,
      phaseVolumeSplitMergeAdmission
    });
    const allocation = await hierarchy.runSchroederParticleStorageAllocationWebGpu({
      device,
      phaseVolumeSplitMergeApply: apply,
      particleStorageAllocatorAdmission,
      currentParticleCapacity: sourceParticleCount,
      requiredParticleCapacity: outputParticleCapacity
    });
    const particleStorageFreeList = hierarchy.createSchroederParticleStorageFreeListPlan({
      baseSlotIndex: sourceParticleCount,
      slotCapacity: outputParticleCapacity - sourceParticleCount,
      availableSlotCount: outputParticleCapacity - sourceParticleCount,
      maxSlotsPerRow: 1
    });
    const slotAssignment = await hierarchy.runSchroederParticleStorageSlotAssignmentWebGpu({
      device,
      particleStorageAllocation: allocation,
      particleStorageFreeList,
      particleStorageSlotAssignmentAdmission
    });
    const materialization = await hierarchy.runSchroederParticleStorageMaterializationWebGpu({
      device,
      sphParticleState,
      mlsMpmParticleState,
      particleStorageSlotAssignment: slotAssignment,
      particleStorageMaterializationAdmission,
      outputParticleCapacity
    });
    const countSummary = await countModule.runSchroederParticleStorageCountSummaryWebGpu({
      device,
      particleStorageMaterialization: materialization
    });
    const compaction = await compactionModule.runSchroederParticleStorageCompactionWebGpu({
      device,
      particleStorageMaterialization: materialization
    });
    const adoption = stepModule.createSchroederParticleStorageAdoption({
      schroederParticleStorageMaterialization: compaction,
      sphParticleState,
      mlsMpmParticleState
    });

    const stateFloats = outputParticleCapacity * 8;
    const readBuffer = device.createBuffer({
      size: stateFloats * 4,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
    });
    const encoder = device.createCommandEncoder();
    encoder.copyBufferToBuffer(compaction.particleStateBuffer, 0, readBuffer, 0, stateFloats * 4);
    device.queue.submit([encoder.finish()]);
    await readBuffer.mapAsync(GPUMapMode.READ);
    const compactedState = new Float32Array(readBuffer.getMappedRange()).slice(0, stateFloats);
    readBuffer.unmap();
    readBuffer.destroy();

    const liveCount = compaction.liveParticleCount;
    let compactedMass = 0;
    const compactedMomentum = [0, 0, 0];
    const liveSlots = [];
    for (let index = 0; index < liveCount; index += 1) {
      const offset = index * 8;
      const slotMass = compactedState[offset + 3];
      compactedMass += slotMass;
      for (let axis = 0; axis < 3; axis += 1) {
        compactedMomentum[axis] += slotMass * compactedState[offset + 4 + axis];
      }
      liveSlots.push({
        mass: slotMass,
        x: compactedState[offset],
        v: [
          compactedState[offset + 4],
          compactedState[offset + 5],
          compactedState[offset + 6]
        ]
      });
    }

    materialization.destroyParticleBuffers?.();
    materialization.destroyMaterializationBuffer?.();
    compaction.destroyParticleBuffers?.();
    device.destroy?.();

    return {
      status: 'ok',
      proposalStatus: proposal.status,
      applyStatus: apply.status,
      allocationStatus: allocation.status,
      slotAssignmentStatus: slotAssignment.status,
      materializationStatus: materialization.status,
      countSummary: countSummary.countSummary,
      liveParticleCount: liveCount,
      admittedParticleCountDelta: compaction.admittedParticleCountDelta,
      adoptionStatus: adoption?.status ?? null,
      adoptionAuthoritativeParticleCount: adoption?.authoritativeParticleCount ?? null,
      sourceMassTotal: sourceParticleCount * massKg,
      compactedMass,
      compactedMomentum,
      cellMomentum,
      survivorVelocity: velocities[3],
      liveSlots
    };
  });

  expect(result.status).toBe('ok');
  expect(result.proposalStatus).toBe('schroeder-phase-volume-split-merge-proposal-submitted');
  expect(result.applyStatus).toBe('schroeder-phase-volume-split-merge-apply-submitted');
  expect(result.allocationStatus).toBe('schroeder-particle-storage-allocation-submitted');
  expect(result.slotAssignmentStatus).toBe('schroeder-particle-storage-slot-assignment-submitted');
  expect(result.materializationStatus).toBe('schroeder-particle-storage-materialization-submitted');

  // The leader wrote one aggregated child (appended), every member freed its
  // own slot: 1 appended, 3 freed.
  expect(result.countSummary.appendedTargetSlotCount).toBe(1);
  expect(result.countSummary.freedSourceSlotCount).toBe(3);

  // The merge is a real count reduction through the production chain: 4 -> 2.
  expect(result.liveParticleCount).toBe(2);
  expect(result.admittedParticleCountDelta).toBe(-2);
  expect(result.adoptionStatus).toBe('schroeder-particle-storage-adopted');
  expect(result.adoptionAuthoritativeParticleCount).toBe(2);

  // Survivor keeps its mass, the merged child carries the whole cell
  // aggregate (3 x 2 kg), and total mass is conserved.
  expect(result.liveSlots.length).toBe(2);
  expect(Math.abs(result.liveSlots[0].mass - 2)).toBeLessThan(1e-6);
  expect(Math.abs(result.liveSlots[0].x - 2.5)).toBeLessThan(1e-6);
  expect(Math.abs(result.liveSlots[1].mass - 6)).toBeLessThan(1e-6);
  expect(Math.abs(result.liveSlots[1].x - 1.0)).toBeLessThan(1e-6);
  expect(Math.abs(result.compactedMass - result.sourceMassTotal)).toBeLessThan(1e-5);

  // Momentum conservation of the merge: the child carries the mass-weighted
  // cell velocity (cell momentum / cell mass), not the leader's velocity,
  // and total momentum over the live range equals the initial total.
  for (let axis = 0; axis < 3; axis += 1) {
    const expectedChildVelocity = result.cellMomentum[axis] / 6;
    expect(Math.abs(result.liveSlots[1].v[axis] - expectedChildVelocity)).toBeLessThan(1e-6);
    const expectedTotalMomentum = result.cellMomentum[axis] + 2 * result.survivorVelocity[axis];
    expect(Math.abs(result.compactedMomentum[axis] - expectedTotalMomentum)).toBeLessThan(1e-5);
  }
});

test('SPH phase URL steam scene coarsens the live particle count through admitted merges', async ({ page }) => {
  test.setTimeout(180_000);
  const consoleIssues = [];
  page.on('console', (message) => {
    const text = message.text();
    if (/Invalid Buffer|Invalid BindGroup|Invalid CommandBuffer|Error while parsing WGSL|Compute pass/i.test(text)) {
      consoleIssues.push(text);
    }
  });

  await page.goto('/?drop=h2o&base=h2o&dropt=650&baset=300&iceh=0&ironh=1.01&dropn=2&basen=3&boxx=4&boxy=4&boxz=4&mech=mlsmpm&residentAuto=1&residentStepsPerSchedule=1&visualCapture=1&renderer=native-webgpu&surfaceDraw=native-webgpu-surface-consumer&ss=1&schroederLevel=0&schroederMaxLevel=8&schroederPortableSummary=1&schroederActiveNodeIndex=1&schroederParticleStorageMaterialization=1');
  await ensureSphPhaseOverlayVisible(page, { timeout: 180_000 });

  // Wait until an admitted merge cycle lands: the adoption source flips to a
  // compaction execution with a negative admitted count delta.
  await page.waitForFunction(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const finalStep = overlay?.__mlsMpmResidentSteps?.finalStep || null;
    const storage = finalStep?.schroederParticleStorageMaterialization || null;
    const ready = Boolean(
      finalStep?.schroederParticleStorageAdoptionStatus === 'schroeder-particle-storage-adopted'
      && storage?.schema === 'peercompute.ulg.schroeder-particle-storage-compaction-execution.v0'
      && Number(storage?.admittedParticleCountDelta) < 0
    );
    if (ready && !globalThis.__ssLiveCoarsenSnapshot) {
      globalThis.__ssLiveCoarsenSnapshot = {
        adoptionStatus: finalStep.schroederParticleStorageAdoptionStatus,
        storageSchema: storage.schema,
        admittedParticleCountDelta: Number(storage.admittedParticleCountDelta),
        sourceParticleCount: Number(storage.sourceParticleCount),
        liveParticleCount: Number(storage.liveParticleCount),
        authoritativeParticleCount:
          Number(finalStep.schroederParticleStorageAuthoritativeParticleCount),
        nextParticleCount: Number(finalStep.nextParticleCount),
        fullParticleReadbackPerformed:
          finalStep.fullParticleReadbackPerformed === true
          || finalStep.diagnostics?.noFullParticleReadback === false
      };
    }
    return ready;
  }, null, { timeout: 150_000 });

  const result = await page.evaluate(() => globalThis.__ssLiveCoarsenSnapshot);

  // The flagship SS coarsening gate, live: coherent bulk steam merges into
  // coarser particles through the full admitted chain (proposal -> apply ->
  // leader-elected allocation -> slot assignment -> materialization ->
  // compaction -> adoption), shrinking the live particle count instead of
  // exploding it.
  expect(result.adoptionStatus).toBe('schroeder-particle-storage-adopted');
  expect(result.storageSchema)
    .toBe('peercompute.ulg.schroeder-particle-storage-compaction-execution.v0');
  expect(result.admittedParticleCountDelta).toBeLessThan(0);
  expect(result.liveParticleCount).toBeLessThan(result.sourceParticleCount);
  expect(result.authoritativeParticleCount).toBe(result.liveParticleCount);
  expect(result.nextParticleCount).toBe(result.liveParticleCount);
  // Count-summary/compaction perform compact single-row readbacks (allowed
  // by the SS GPU-first rules); the hard gate is no full particle readback.
  expect(result.fullParticleReadbackPerformed).toBe(false);
  expect(consoleIssues).toEqual([]);
});
