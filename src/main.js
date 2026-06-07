import './styles.css';
import { createDemoRuntime } from './runtime/demoRuntime.js';
import { formatHandoffAckStatus } from './runtime/handoffStatus.js';
import { createWorkerTreeScene } from './visualization/workerTreeScene.js';

const app = document.querySelector('#app');
const multiscaleUrl = new URL(
  '/?scenario=magnetar',
  `https://${window.location.hostname || '127.0.0.1'}:5185`
).href;
const MULTISCALE_HANDOFF_POST_SCHEMA = 'ulg.peercompute.browser-handoff-post.v0';
const MULTISCALE_HANDOFF_ACK_SCHEMA = 'peercompute.multiscale.browser-handoff-ack.v0';
const MULTISCALE_HANDOFF_POST_INTERVAL_MS = 750;
const MULTISCALE_HANDOFF_ACK_TIMEOUT_MS = 30000;

app.innerHTML = `
  <main class="app-shell">
    <section class="scene-pane">
      <div class="top-bar">
        <div>
          <p class="eyebrow">ULG Triad v0.5</p>
          <h1>PeerCompute</h1>
        </div>
        <div class="controls">
          <a id="open-multiscale" class="button-link" href="${multiscaleUrl}" target="_blank" rel="noreferrer">Open Multiscale</a>
          <button id="launch-magnetar" type="button">Launch Magnetar</button>
          <button id="copy-handoff" type="button">Copy Handoff</button>
          <button id="run-smoke" type="button">Run Smoke</button>
          <button id="cancel-smoke" type="button">Cancel</button>
        </div>
      </div>
      <div id="handoff-status" class="handoff-status">handoff idle</div>
      <div id="scene"></div>
    </section>
    <aside class="telemetry-pane">
      <div class="terminal-head">
        <span>service registry</span>
        <span id="gpu-status">gpu probe</span>
      </div>
      <div id="capabilities" class="terminal-list"></div>
      <div class="terminal-head">
        <span>worker tree</span>
        <span id="task-count">0 tasks</span>
      </div>
      <div id="tasks" class="terminal-list"></div>
      <div class="terminal-head">
        <span>leases</span>
        <span id="lease-count">0 active</span>
      </div>
      <div id="leases" class="terminal-list"></div>
      <div class="terminal-head">
        <span>artifacts</span>
        <span id="artifact-count">0 cached</span>
      </div>
      <div id="artifacts" class="terminal-list"></div>
    </aside>
  </main>
`;

const scene = createWorkerTreeScene(document.querySelector('#scene'));
const launchMagnetarButton = document.querySelector('#launch-magnetar');
const copyHandoffButton = document.querySelector('#copy-handoff');
const handoffStatus = document.querySelector('#handoff-status');
const runButton = document.querySelector('#run-smoke');
const cancelButton = document.querySelector('#cancel-smoke');
const gpuStatus = document.querySelector('#gpu-status');
const capabilitiesEl = document.querySelector('#capabilities');
const tasksEl = document.querySelector('#tasks');
const leasesEl = document.querySelector('#leases');
const artifactsEl = document.querySelector('#artifacts');
const taskCount = document.querySelector('#task-count');
const leaseCount = document.querySelector('#lease-count');
const artifactCount = document.querySelector('#artifact-count');

const runtime = await createDemoRuntime();
runtime.launchPeerComputeMagnetarDemo = launchPeerComputeMagnetarDemo;
runtime.sendPeerComputeHandoffToMultiscale = launchPeerComputeMagnetarDemo;
window.__ulgDemo = runtime;

runtime.subscribe((_event, telemetry) => {
  scene.setTelemetry(telemetry);
  renderTelemetry(telemetry);
});

runButton.addEventListener('click', () => {
  runtime.runSmoke();
});
cancelButton.addEventListener('click', () => {
  runtime.cancelActive();
});
launchMagnetarButton.addEventListener('click', async () => {
  launchMagnetarButton.disabled = true;
  handoffStatus.textContent = 'handoff preparing for Multiscale';
  try {
    const ack = await launchPeerComputeMagnetarDemo();
    handoffStatus.textContent = formatHandoffAckStatus(ack);
  } catch (error) {
    handoffStatus.textContent = `handoff launch failed: ${String(error?.message || error)}`;
  } finally {
    launchMagnetarButton.disabled = false;
  }
});
copyHandoffButton.addEventListener('click', async () => {
  copyHandoffButton.disabled = true;
  handoffStatus.textContent = 'handoff exporting';
  try {
    const handoff = await createReadyPeerComputeHandoff();
    await copyTextToClipboard(JSON.stringify(handoff, null, 2));
    handoffStatus.textContent = `handoff copied: ${handoff.artifactCount} artifacts`;
  } catch (error) {
    handoffStatus.textContent = `handoff failed: ${String(error?.message || error)}`;
  } finally {
    copyHandoffButton.disabled = false;
  }
});

runtime.runSmoke();

async function launchPeerComputeMagnetarDemo() {
  const handoff = await createReadyPeerComputeHandoff();
  const targetWindow = window.open(multiscaleUrl, 'peercompute-multiscale-magnetar');
  if (!targetWindow) {
    throw new Error('Multiscale popup blocked');
  }
  handoffStatus.textContent = `handoff sending: ${handoff.artifactCount} artifacts`;
  return postPeerComputeHandoffToMultiscale(targetWindow, handoff);
}

async function createReadyPeerComputeHandoff() {
  if (runtime.telemetry.artifacts.length < 2) {
    handoffStatus.textContent = 'handoff waiting for services';
    await runtime.runSmoke();
  }
  return runtime.createPeerComputeHandoff();
}

function postPeerComputeHandoffToMultiscale(targetWindow, handoff) {
  const targetOrigin = new URL(multiscaleUrl).origin;
  const handoffId = createBrowserHandoffId();
  const payload = {
    schema: MULTISCALE_HANDOFF_POST_SCHEMA,
    handoffId,
    source: 'ulg-demo',
    createdAt: new Date().toISOString(),
    handoff
  };

  return new Promise((resolve, reject) => {
    let settled = false;
    let postTimer = null;
    let timeoutTimer = null;

    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      window.clearInterval(postTimer);
      window.clearTimeout(timeoutTimer);
    };
    const settle = (fn, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn(value);
    };
    const post = () => {
      if (targetWindow.closed) {
        settle(reject, new Error('Multiscale window closed'));
        return;
      }
      targetWindow.postMessage(payload, targetOrigin);
    };
    const onMessage = (event) => {
      const message = event.data || {};
      if (
        event.origin !== targetOrigin
        || message.schema !== MULTISCALE_HANDOFF_ACK_SCHEMA
        || message.handoffId !== handoffId
      ) {
        return;
      }
      settle(resolve, message);
    };

    window.addEventListener('message', onMessage);
    post();
    postTimer = window.setInterval(post, MULTISCALE_HANDOFF_POST_INTERVAL_MS);
    timeoutTimer = window.setTimeout(() => {
      settle(reject, new Error('Multiscale handoff ack timed out'));
    }, MULTISCALE_HANDOFF_ACK_TIMEOUT_MS);
  });
}

function createBrowserHandoffId() {
  return `ulg-browser-handoff-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'readonly');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);
  if (!copied) {
    throw new Error('clipboard unavailable');
  }
}

function renderTelemetry(telemetry) {
  gpuStatus.textContent = telemetry.gpu.supported ? 'webgpu ready' : 'wasm/cpu fallback';
  capabilitiesEl.innerHTML = telemetry.services.map((service) => `
    <div class="terminal-row service-row">
      <span class="service-name">${service.serviceId}</span>
      <span>${service.status}</span>
      <span>${formatAssetProbe(service.assetProbe)}</span>
      <span>${service.capabilities.length} caps</span>
    </div>
    <p class="cap-line">${service.capabilities.join(' / ')}${renderAssetProbeLine(service.assetProbe)}</p>
  `).join('');

  taskCount.textContent = `${telemetry.tasks.length} tasks`;
  tasksEl.innerHTML = telemetry.tasks.map((task) => `
    <div class="terminal-row">
      <span class="service-name">${task.serviceId}</span>
      <span>${task.status}</span>
      <span>${Math.round((task.progress ?? 0) * 100)}%</span>
    </div>
    <p class="cap-line">${task.taskKind} :: ${task.rootTaskId}</p>
  `).join('');

  const activeLeases = telemetry.leases.filter((lease) => lease.status === 'active').length;
  leaseCount.textContent = `${activeLeases} active`;
  leasesEl.innerHTML = telemetry.leases.map((lease) => `
    <div class="terminal-row">
      <span>${lease.status}</span>
      <span>${lease.count} child</span>
      <span>${lease.leaseId}</span>
    </div>
  `).join('');

  artifactCount.textContent = `${telemetry.artifacts.length} cached`;
  artifactsEl.innerHTML = telemetry.artifacts.map((record) => `
    <div class="terminal-row">
      <span>${record.artifactKind}</span>
      <span>${record.ref.sourceService}</span>
    </div>
    <p class="cap-line">${record.ref.uri}${renderArtifactSummaryLine(record.artifactSummary)}</p>
  `).join('');
}

function formatAssetProbe(probe) {
  if (!probe) {
    return 'assets pending';
  }
  if (probe.status === 'skipped') {
    return 'assets n/a';
  }
  return `assets ${probe.status}`;
}

function renderAssetProbeLine(probe) {
  if (!probe || probe.status === 'skipped') {
    return '';
  }
  const assets = probe.assets
    .map((asset) => `${asset.kind}:${asset.status}`)
    .join(' / ');
  const locateFile = probe.locateFile ? ` :: locateFile(${probe.locateFile.input}) -> ${probe.locateFile.resolved}` : '';
  return `<br>${assets}${locateFile}`;
}

function renderArtifactSummaryLine(summary) {
  if (!summary) {
    return '';
  }
  const parts = [];
  if (summary.validationStatus) parts.push(`validation:${summary.validationStatus}`);
  if (summary.parityStatus) parts.push(`parity:${summary.parityStatus}`);
  if (summary.moonlabWebGpuParityScopeReady) {
    parts.push(`webgpu:${summary.moonlabWebGpuParityScopeBackendAvailable ? 'backend' : 'no-backend'}`);
  }
  if (summary.moonlabWebGpuParityHandoffSummaryReady) {
    const runtimeScope = summary.moonlabWebGpuParityHandoffSummaryRuntimeBackendReady ? 'runtime' : 'reduced';
    const operationCount = Array.isArray(summary.moonlabWebGpuParityHandoffSummaryCoveredOperations)
      ? summary.moonlabWebGpuParityHandoffSummaryCoveredOperations.length
      : 0;
    parts.push(`webgpu-handoff:${runtimeScope}:${operationCount}ops`);
  }
  if (summary.moonlabWebGpuBrowserBackendPreflightDeclared) {
    parts.push(`webgpu-preflight:${summary.moonlabWebGpuBrowserBackendPreflightStage || 'declared'}`);
  }
  if (summary.moonlabWebGpuProbabilityKernelProbeDeclared) {
    parts.push(`wgsl:${summary.moonlabWebGpuProbabilityKernel || 'probe'}-declared`);
  }
  const nativeOperationResults = Array.isArray(summary.moonlabWebGpuNativeOperationProbeOperationResults)
    ? summary.moonlabWebGpuNativeOperationProbeOperationResults
    : [];
  for (const nativeOperation of nativeOperationResults) {
    if (nativeOperation?.operation) {
      parts.push(`native:${nativeOperation.operation}-${nativeOperation.covered ? 'covered' : 'blocked'}`);
    }
  }
  if (summary.magnetarDipoleIsingReady) {
    parts.push(`magnetar:${summary.magnetarDipoleIsingGroundState || 'ready'}`);
  }
  if (summary.magnetarReferenceReady) {
    parts.push(`ref:${summary.magnetarReferenceEnergyUnits || 'ready'}`);
  }
  if (summary.outputReferenceCount) {
    parts.push(`refs:${summary.outputReferenceReadyCount}/${summary.outputReferenceCount}`);
  }
  if (summary.calibrationArtifactCount) {
    parts.push(`cal:${summary.calibrationReadyCount}/${summary.calibrationArtifactCount}`);
  }
  if (summary.closureKind) {
    parts.push(`closure:${summary.closureKind}`);
  }
  if (summary.closureEntryExport) {
    parts.push(`entry:${summary.closureEntryExport}`);
  }
  if (summary.closureImportCount) {
    parts.push(`imports:${summary.closureImportCount}`);
  }
  if (summary.closureHostImportsDomFree) {
    parts.push(`host:${summary.closureHostImportsFactory || 'dom-free'}`);
  }
  if (summary.closureOutputSemanticsReady) {
    parts.push(`output:${summary.closureOutputSemanticScope}`);
  }
  if (summary.closureDescriptorReady) {
    parts.push(`descriptor:${summary.closureDescriptorRole || 'ready'}`);
  }
  if (summary.closureTensorRuntimeRuntimeStatus) {
    parts.push(`tensor-runtime:${summary.closureTensorRuntimeRuntimeStatus}`);
  }
  if (summary.closureTensorEntryExportOffsetProbeStatus) {
    const changedBytes = Number.isFinite(summary.closureTensorEntryExportChangedBytesInDeclaredTensorRange)
      ? `:${summary.closureTensorEntryExportChangedBytesInDeclaredTensorRange}b`
      : '';
    const offsetStatus = summary.closureTensorEntryExportConsumesOffsets ? 'offsets-consumed' : 'offsets-blocked';
    parts.push(`tensor-probe:${summary.closureTensorEntryExportOffsetProbeStatus}:${offsetStatus}${changedBytes}`);
  }
  if (summary.closureProductionHandlerBoundaryDeclared) {
    const blockerCount = Array.isArray(summary.closureProductionHandlerBoundaryBlockers)
      ? summary.closureProductionHandlerBoundaryBlockers.length
      : 0;
    parts.push(`handler:declared-not-executed:${blockerCount}-blockers`);
    if (summary.closureProductionHostImportCandidateStatus) {
      const nonStubImportCount = Array.isArray(summary.closureProductionHostImportCandidateRequiredNonStubImports)
        ? summary.closureProductionHostImportCandidateRequiredNonStubImports.length
        : 0;
      parts.push(`prod-host:${summary.closureProductionHostImportCandidateStatus}:${nonStubImportCount}-imports`);
    }
    if (summary.closureProductionCandidateRuntimeProbeReady) {
      const changedBytes = summary.closureProductionCandidateRuntimeProbeChangedBytesInDeclaredTensorRange ?? 0;
      parts.push(`prod-probe:${summary.closureProductionCandidateRuntimeProbeStatus}:${changedBytes}b`);
    }
  } else if (summary.closureProductionHandlerBoundarySchema) {
    parts.push(`handler:${summary.closureProductionHandlerBoundaryStatus || 'not-ready'}`);
  }
  return parts.length ? `<br>${parts.join(' / ')}` : '';
}
