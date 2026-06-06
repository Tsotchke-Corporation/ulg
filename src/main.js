import './styles.css';
import { createDemoRuntime } from './runtime/demoRuntime.js';
import { createWorkerTreeScene } from './visualization/workerTreeScene.js';

const app = document.querySelector('#app');

app.innerHTML = `
  <main class="app-shell">
    <section class="scene-pane">
      <div class="top-bar">
        <div>
          <p class="eyebrow">ULG Triad v0.5</p>
          <h1>PeerCompute</h1>
        </div>
        <div class="controls">
          <button id="run-smoke" type="button">Run Smoke</button>
          <button id="cancel-smoke" type="button">Cancel</button>
        </div>
      </div>
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

runtime.runSmoke();

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
  if (summary.magnetarDipoleIsingReady) {
    parts.push(`magnetar:${summary.magnetarDipoleIsingGroundState || 'ready'}`);
  }
  if (summary.calibrationArtifactCount) {
    parts.push(`cal:${summary.calibrationReadyCount}/${summary.calibrationArtifactCount}`);
  }
  return parts.length ? `<br>${parts.join(' / ')}` : '';
}
