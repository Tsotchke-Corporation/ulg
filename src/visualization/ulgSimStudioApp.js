import './ulgSimStudioStyles.css';
import {
  SPH_PHASE_SCENARIO_PRESETS,
  sphPhaseScenarioPresetById
} from '../runtime/sphPhaseScenarioPresets.js';
import {
  allocateNextSphInitialBodyIdentity,
  clampSphInitialBodyToContainer,
  containerBoundsForFrame,
  deriveSphInitialBodySizeM,
  duplicateSphInitialBody,
  findNonOverlappingPlacementForBody,
  moveSphInitialBody,
  separateOverlappingSphInitialBodies
} from '../runtime/sphInitialBodies.js';
import { ELEMENT_MATERIAL_OPTIONS, MATERIAL_OPTIONS } from './sphMaterialOptions.js';
import {
  SPH_SCENE_LIGHTING_MODE_DARK_LAB,
  SPH_SCENE_LIGHTING_MODE_DEFAULT,
  normalizeSphSceneBackgroundColorHex
} from './sphPhaseScene.js';
import {
  clearSphLocalDerivedCaches,
  mountSphPhaseDemoOverlay,
  validateSphLocalBackgroundImageFile
} from './sphPhaseDemoMount.js';
import {
  buildBlankCustomConfig,
  buildLaunchParamsFromStagedConfig,
  buildStagedConfigFromPreset,
  deriveSimulationLoadingStatus,
  fmtMeters,
  fmtTempC,
  hasSimulationUrlParams,
  parseStagedConfigFromUrlSearchParams,
  roundNice,
  serializeStagedConfigToUrlSearchParams,
  totalParticlesOf,
  validateStagedSimulationConfig
} from './ulgSimStudioModel.js';

export {
  buildBlankCustomConfig,
  buildLaunchParamsFromStagedConfig,
  buildStagedConfigFromPreset,
  deriveSimulationLoadingStatus,
  hasSimulationUrlParams,
  parseStagedConfigFromUrlSearchParams,
  serializeStagedConfigToUrlSearchParams,
  validateStagedSimulationConfig
};

const WALL_FACES = Object.freeze([
  ['xMin', 'Left (X−)'],
  ['xMax', 'Right (X+)'],
  ['yMin', 'Floor (Y−)'],
  ['yMax', 'Ceiling (Y+)'],
  ['zMin', 'Back (Z−)'],
  ['zMax', 'Front (Z+)']
]);

const CURATED_BG_SWATCHES = Object.freeze([
  ['#091018', 'Obsidian'],
  ['#101a24', 'Dark Lab'],
  ['#16222c', 'Slate'],
  ['#05080d', 'Deep Void'],
  ['#1e293b', 'Steel'],
  ['#f1f5f9', 'Studio Light']
]);

const FORWARD_LAW_TOGGLES = Object.freeze([
  ['gravity', 'Gravity'],
  ['thermal', 'Thermal & Phase Change'],
  ['reactions', 'Chemical Reactions'],
  ['viscosity', 'Viscosity'],
  ['surfaceTension', 'Surface Tension'],
  ['rigidSolids', 'Coherent Rigid Solids'],
  ['cohesiveFracture', 'Cohesive Fracture & Refreeze (SOL-5)'],
  ['multilevelSolids', 'Multilevel Solid Proxies (SOL-6)']
]);

const BODY_MECHANICS_MODE_OPTIONS = Object.freeze([
  ['auto', 'Auto (phase-admitted)'],
  ['rigid', 'Coherent Rigid Solid (SOL-1/5/6)'],
  ['deformable', 'Deformable Solid Carrier (SOL-4)'],
  ['continuum', 'Continuum MLS-MPM']
]);

function configSignature(config) {
  return JSON.stringify({
    presetId: config.presetId,
    boxDimensionsM: config.boxDimensionsM,
    wallModel: config.wallModel,
    walls: config.walls,
    environment: config.environment,
    laws: config.laws,
    bodies: config.bodies
  });
}

function openPeriodicTableDialog({ root, currentValue, title, onSelect }) {
  root.querySelector('.ulg-pt-backdrop')?.remove();
  const backdrop = document.createElement('div');
  backdrop.className = 'ulg-pt-backdrop';
  const dialog = document.createElement('section');
  dialog.className = 'ulg-pt-modal';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', `Periodic table for ${title}`);

  const head = document.createElement('div');
  head.className = 'ulg-section-head';
  head.style.marginBottom = '0';
  const heading = document.createElement('div');
  heading.innerHTML = `<div class="ulg-modal-title">Periodic Table · ${title}</div><div class="ulg-section-help" style="margin:2px 0 0;">Every element resolves from first-principles atomic &amp; electronic closures.</div>`;
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'ulg-modal-close';
  closeBtn.setAttribute('aria-label', 'Close periodic table');
  closeBtn.innerHTML = '✕';
  head.append(heading, closeBtn);

  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'ulg-input';
  search.placeholder = 'Search by element name, symbol, or atomic number…';

  const scroll = document.createElement('div');
  scroll.className = 'ulg-pt-scroll';
  const grid = document.createElement('div');
  grid.className = 'ulg-pt-grid';
  scroll.appendChild(grid);

  const close = () => {
    window.removeEventListener('keydown', onKey);
    backdrop.remove();
  };
  const onKey = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
    }
  };
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) close();
  });
  window.addEventListener('keydown', onKey, true);

  function renderGrid() {
    const query = search.value.trim().toLowerCase();
    grid.replaceChildren();
    for (const option of ELEMENT_MATERIAL_OPTIONS) {
      const hay = `${option.name} ${option.symbol} ${option.Z}`.toLowerCase();
      if (query && !hay.includes(query)) continue;
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = `ulg-pt-cell ulg-pt-cat-${option.category}`;
      cell.dataset.selected = String(option.key === currentValue);
      cell.style.gridColumn = String(option.group);
      cell.style.gridRow = String(option.period);
      cell.title = option.label;
      cell.innerHTML = `<span class="ulg-pt-z">${option.Z}</span><span class="ulg-pt-sym">${option.symbol}</span><span class="ulg-pt-name">${option.name}</span>`;
      cell.addEventListener('click', () => {
        onSelect(option.key);
        close();
      });
      grid.appendChild(cell);
    }
  }
  search.addEventListener('input', renderGrid);
  dialog.append(head, search, scroll);
  backdrop.appendChild(dialog);
  root.appendChild(backdrop);
  renderGrid();
  search.focus();
}

/**
 * Mount the forward-looking ULG Simulation Studio directly on the page.
 * Starts completely empty with zero simulation workers or GPU buffers allocated
 * until the user launches a scenario.
 */
export function mountUlgSimStudioApp({
  container = document.querySelector('#app'),
  createRuntime = null,
  peercomputeModule = undefined,
  residentMechanicsStageWorkerModuleUrl = undefined,
  residentComputeTaskModulePath = undefined
} = {}) {
  if (!container) throw new Error('ULG Studio mount requires a container element');

  const initialUrlParsed = typeof window !== 'undefined'
    ? parseStagedConfigFromUrlSearchParams(window.location.search)
    : null;

  let stagedConfig = initialUrlParsed
    ? initialUrlParsed.config
    : buildStagedConfigFromPreset('iron-ice-quench');
  let activeSession = null;
  let activeSignature = null;
  let activePresetLabel = null;
  let sharedRuntimePromise = null;
  let launchInFlight = false;
  let loadingActive = false;
  let loadingStartedAtMs = 0;
  let loadingMaxPercent = 0;
  let loadingAutoPlay = false;
  let loadingErrorMessage = null;
  let autoPlayWhenReady = false;
  let activeTab = 'presets';
  let modalOpen = false;
  let diagnosticsOpen = false;
  let miniHudPinned = true;
  let pendingLocalBgFile = null;
  let diagnosticsPollTimer = null;

  const root = document.createElement('div');
  root.id = 'ulg-sim-studio';
  root.className = 'ulg-studio-root';
  root.innerHTML = `
    <div id="ulg-stage" class="ulg-studio-stage"></div>
    <div id="ulg-empty-state" class="ulg-studio-empty">
      <div class="ulg-empty-card">
        <p class="ulg-empty-eyebrow">ULG · Schroeder Spatial Physics</p>
        <h1 class="ulg-empty-title">Simulation ready</h1>
        <p class="ulg-empty-copy">Nothing is allocated yet. Open the menu in the top right to choose a preset or assemble custom bodies, then launch on WebGPU.</p>
        <button id="ulg-empty-open-btn" class="ulg-btn ulg-btn-primary" type="button">Configure &amp; Launch</button>
      </div>
    </div>
    <div id="ulg-loading-overlay" class="ulg-loading-overlay" role="status" aria-live="polite" hidden>
      <div class="ulg-loading-card">
        <div class="ulg-spinner-wrap" aria-hidden="true">
          <div class="ulg-spinner"></div>
          <span id="ulg-loading-pct" class="ulg-spinner-pct">0%</span>
        </div>
        <h2 id="ulg-loading-phase" class="ulg-loading-phase">Initializing WebGPU runtime &amp; workers…</h2>
        <p id="ulg-loading-detail" class="ulg-loading-detail">Preparing first-principles closures and GPU pipelines.</p>
        <div class="ulg-loading-bar" aria-hidden="true">
          <div id="ulg-loading-bar-fill" class="ulg-loading-bar-fill"></div>
        </div>
        <button id="ulg-loading-settings-btn" class="ulg-btn ulg-btn-subtle ulg-btn-sm" type="button" hidden>Open Settings</button>
      </div>
    </div>
    <div id="ulg-mini-hud" class="ulg-mini-hud" hidden>idle</div>
    <div id="ulg-playback-bar" class="ulg-playback-bar" hidden>
      <button id="ulg-play-btn" class="ulg-btn ulg-btn-primary" type="button">Play</button>
      <button id="ulg-step-btn" class="ulg-btn ulg-btn-subtle" type="button">Step</button>
    </div>
    <button id="ulg-menu-toggle" class="ulg-menu-btn" type="button" aria-label="Open simulation settings" aria-expanded="false" aria-controls="ulg-settings-modal">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M3 5.5H17M3 10H17M3 14.5H17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      </svg>
      <span class="ulg-menu-btn-dot" aria-hidden="true"></span>
    </button>
    <div id="ulg-settings-backdrop" class="ulg-modal-backdrop" hidden>
      <section id="ulg-settings-modal" class="ulg-modal" role="dialog" aria-modal="true" aria-labelledby="ulg-modal-heading">
        <header class="ulg-modal-header">
          <div class="ulg-modal-brand">
            <h2 id="ulg-modal-heading" class="ulg-modal-title">Simulation Setup</h2>
            <span id="ulg-status-pill" class="ulg-status-pill" data-state="idle">Unallocated</span>
          </div>
          <button id="ulg-modal-close" class="ulg-modal-close" type="button" aria-label="Close settings">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M4.5 4.5L13.5 13.5M13.5 4.5L4.5 13.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
          </button>
        </header>
        <nav class="ulg-modal-tabs" role="tablist" aria-label="Simulation settings sections">
          <button class="ulg-tab-btn" type="button" role="tab" data-tab="presets" aria-selected="true">Presets</button>
          <button class="ulg-tab-btn" type="button" role="tab" data-tab="bodies" aria-selected="false">Bodies</button>
          <button class="ulg-tab-btn" type="button" role="tab" data-tab="container" aria-selected="false">Container &amp; Laws</button>
          <button class="ulg-tab-btn" type="button" role="tab" data-tab="display" aria-selected="false">Display</button>
        </nav>
        <div class="ulg-modal-body">
          <div id="ulg-validation-alert" class="ulg-alert" role="alert" hidden>
            <span id="ulg-validation-text"></span>
            <button id="ulg-fit-all-btn" class="ulg-btn ulg-btn-sm" type="button">Fit in Container</button>
          </div>
          <div class="ulg-tab-panel" data-panel="presets"></div>
          <div class="ulg-tab-panel" data-panel="bodies" hidden></div>
          <div class="ulg-tab-panel" data-panel="container" hidden></div>
          <div class="ulg-tab-panel" data-panel="display" hidden></div>
        </div>
        <div id="ulg-diagnostics-drawer" class="ulg-diagnostics-drawer" hidden>
          <div class="ulg-section-head" style="margin-bottom:4px;">
            <span class="ulg-section-title">Diagnostics</span>
            <label style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--ulg-text-muted);cursor:pointer;">
              <input id="ulg-pin-hud-toggle" type="checkbox" checked style="accent-color:var(--ulg-accent);" />
              Pin compact HUD
            </label>
          </div>
          <div id="ulg-diagnostics-summary" style="font-family:var(--ulg-font-mono);font-size:11.5px;color:var(--ulg-accent);">No simulation allocated.</div>
          <pre id="ulg-diagnostics-pre" class="ulg-diagnostics-pre"></pre>
        </div>
        <footer class="ulg-modal-footer">
          <div class="ulg-footer-group">
            <button id="ulg-stop-btn" class="ulg-btn ulg-btn-subtle ulg-btn-danger" type="button" hidden>Unload</button>
            <button id="ulg-diagnostics-toggle" class="ulg-btn ulg-btn-subtle" type="button" aria-expanded="false">Diagnostics</button>
          </div>
          <div class="ulg-footer-group">
            <label class="ulg-autoplay-label">
              <input id="ulg-autoplay-toggle" type="checkbox" />
              Play automatically when ready
            </label>
            <button id="ulg-launch-btn" class="ulg-btn ulg-btn-primary" type="button">Launch Simulation</button>
          </div>
        </footer>
      </section>
    </div>
  `;
  container.replaceChildren(root);

  const emptyStateEl = root.querySelector('#ulg-empty-state');
  const emptyOpenBtn = root.querySelector('#ulg-empty-open-btn');
  const loadingOverlayEl = root.querySelector('#ulg-loading-overlay');
  const loadingPctEl = root.querySelector('#ulg-loading-pct');
  const loadingPhaseEl = root.querySelector('#ulg-loading-phase');
  const loadingDetailEl = root.querySelector('#ulg-loading-detail');
  const loadingBarFillEl = root.querySelector('#ulg-loading-bar-fill');
  const loadingSettingsBtn = root.querySelector('#ulg-loading-settings-btn');
  const menuToggleBtn = root.querySelector('#ulg-menu-toggle');
  const miniHudEl = root.querySelector('#ulg-mini-hud');
  const playbackBarEl = root.querySelector('#ulg-playback-bar');
  const modalBackdrop = root.querySelector('#ulg-settings-backdrop');
  const modalCloseBtn = root.querySelector('#ulg-modal-close');
  const statusPillEl = root.querySelector('#ulg-status-pill');
  const validationAlertEl = root.querySelector('#ulg-validation-alert');
  const validationTextEl = root.querySelector('#ulg-validation-text');
  const fitAllBtn = root.querySelector('#ulg-fit-all-btn');
  const playBtn = root.querySelector('#ulg-play-btn');
  const stepBtn = root.querySelector('#ulg-step-btn');
  const stopBtn = root.querySelector('#ulg-stop-btn');
  const autoplayToggle = root.querySelector('#ulg-autoplay-toggle');
  const launchBtn = root.querySelector('#ulg-launch-btn');
  const diagnosticsToggleBtn = root.querySelector('#ulg-diagnostics-toggle');
  const diagnosticsDrawerEl = root.querySelector('#ulg-diagnostics-drawer');
  const diagnosticsSummaryEl = root.querySelector('#ulg-diagnostics-summary');
  const diagnosticsPreEl = root.querySelector('#ulg-diagnostics-pre');
  const pinHudToggle = root.querySelector('#ulg-pin-hud-toggle');
  pinHudToggle.checked = miniHudPinned;
  autoplayToggle.checked = autoPlayWhenReady;

  const tabButtons = [...root.querySelectorAll('.ulg-tab-btn')];
  const tabPanels = Object.fromEntries(
    [...root.querySelectorAll('.ulg-tab-panel')].map((el) => [el.dataset.panel, el])
  );

  function clearBrowserUrlParams() {
    if (typeof window === 'undefined' || !window.history?.replaceState) return;
    try {
      if (window.location.search) {
        window.history.replaceState(null, '', window.location.pathname);
      }
    } catch {
      // History replacement may be restricted in sandboxed contexts.
    }
  }

  function syncUrlFromStagedConfig() {
    if (typeof window === 'undefined' || !window.history?.replaceState) return;
    try {
      const params = serializeStagedConfigToUrlSearchParams(stagedConfig, {
        autoPlayWhenReady
      });
      const qs = params.toString();
      const nextUrl = `${window.location.pathname}${qs ? `?${qs}` : ''}`;
      if (window.location.pathname + window.location.search !== nextUrl) {
        window.history.replaceState(null, '', nextUrl);
      }
    } catch {
      // History replacement may be restricted in sandboxed contexts.
    }
  }

  function hasStagedChanges() {
    if (!activeSession || !activeSignature) return false;
    return configSignature(stagedConfig) !== activeSignature;
  }

  function updateLoadingOverlay(snap) {
    if (!loadingActive && !launchInFlight) {
      loadingOverlayEl.hidden = true;
      return;
    }
    if (loadingErrorMessage) {
      loadingOverlayEl.hidden = false;
      loadingPctEl.textContent = `${loadingMaxPercent}%`;
      loadingBarFillEl.style.width = `${loadingMaxPercent}%`;
      loadingPhaseEl.textContent = 'Launch failed';
      loadingDetailEl.textContent = loadingErrorMessage;
      loadingSettingsBtn.hidden = false;
      return;
    }
    const elapsedMs = Math.max(0, performance.now() - loadingStartedAtMs);
    const status = deriveSimulationLoadingStatus(snap, {
      launchInFlight,
      elapsedMs,
      autoPlay: loadingAutoPlay,
      previousPercent: loadingMaxPercent
    });
    loadingMaxPercent = status.percent;
    loadingPctEl.textContent = `${status.percent}%`;
    loadingBarFillEl.style.width = `${status.percent}%`;
    loadingPhaseEl.textContent = status.phase;
    loadingDetailEl.textContent = status.detail;
    loadingSettingsBtn.hidden = !status.blocked;
    if (status.ready) {
      loadingActive = false;
      loadingOverlayEl.hidden = true;
    } else {
      loadingOverlayEl.hidden = false;
    }
  }

  function updateChromeAndStatus() {
    const validation = validateStagedSimulationConfig(stagedConfig);
    const dirty = hasStagedChanges();
    const snap = activeSession?.getTelemetrySnapshot?.() || null;
    updateLoadingOverlay(snap);

    menuToggleBtn.classList.toggle('has-staged-changes', dirty);
    emptyStateEl.hidden = Boolean(activeSession || launchInFlight || loadingActive);

    if (!validation.valid) {
      validationAlertEl.hidden = false;
      validationTextEl.textContent = validation.errors[0];
      fitAllBtn.hidden = validation.bodyErrors.size === 0;
      fitAllBtn.textContent = validation.overlaps?.length > 0
        ? 'Fit & Separate Bodies'
        : 'Fit in Container';
    } else {
      validationAlertEl.hidden = true;
    }

    launchBtn.disabled = launchInFlight || !validation.valid;
    if (launchInFlight) {
      launchBtn.textContent = 'Launching…';
    } else if (activeSession) {
      launchBtn.textContent = dirty ? 'Relaunch (Apply Changes)' : 'Relaunch';
    } else {
      launchBtn.textContent = 'Launch Simulation';
    }

    const hasActive = Boolean(activeSession);
    const visuallyReady = Boolean(
      hasActive
      && !loadingActive
      && !launchInFlight
      && snap?.visualUpdatesReady === true
      && snap?.pendingPreviewActive !== true
    );
    stopBtn.hidden = !hasActive;
    playbackBarEl.hidden = !visuallyReady;

    if (hasActive) {
      playBtn.textContent = snap?.playing ? 'Pause' : 'Play';
      playBtn.disabled = !visuallyReady || Boolean(snap?.blocked);
      stepBtn.disabled = !visuallyReady || Boolean(snap?.blocked);
    }

    if (launchInFlight || loadingActive) {
      statusPillEl.dataset.state = 'staged';
      statusPillEl.textContent = `${loadingPhaseEl.textContent} (${loadingMaxPercent}%)`;
    } else if (!validation.valid) {
      statusPillEl.dataset.state = 'error';
      statusPillEl.textContent = validation.overlaps?.length > 0 ? 'Bodies overlap' : 'Fix setup bounds';
    } else if (snap?.blocked) {
      statusPillEl.dataset.state = 'error';
      statusPillEl.textContent = 'Blocked';
    } else if (dirty) {
      statusPillEl.dataset.state = 'staged';
      statusPillEl.textContent = 'Staged edits · Live unaffected';
    } else if (hasActive) {
      statusPillEl.dataset.state = 'running';
      const label = activePresetLabel || 'Custom';
      statusPillEl.textContent = snap?.playing ? `Running · ${label}` : `Paused · ${label}`;
    } else {
      statusPillEl.dataset.state = 'idle';
      statusPillEl.textContent = 'Unallocated';
    }

    miniHudEl.hidden = !miniHudPinned || !visuallyReady;
    if (!miniHudEl.hidden && snap) {
      const label = activePresetLabel || 'Custom';
      if (snap.playing && !snap.workerVisualReady && snap.stepCount === 0) {
        miniHudEl.textContent = `${label} · compiling WebGPU shaders…`;
      } else {
        const stateTag = snap.playing ? '▶' : '❚❚';
        miniHudEl.textContent = `${stateTag} ${label} · t=${snap.simTimeS.toFixed(3)}s · ${snap.stepCount} steps`;
      }
    }

    if (diagnosticsOpen) {
      if (!snap) {
        diagnosticsSummaryEl.textContent = 'No simulation allocated (0 GPU buffers, 0 particles).';
        diagnosticsPreEl.textContent = '';
      } else {
        diagnosticsSummaryEl.textContent = snap.fpsText
          || `sim t=${snap.simTimeS.toFixed(3)}s · steps=${snap.stepCount} · rebuild=${snap.rebuildStatus || 'ready'}`;
        const archLines = [];
        const a2 = globalThis.__ulgA2IncrementalSpatialStatus;
        if (a2) {
          archLines.push(`A2 incremental CSR: hits=${a2.incrementalHits ?? 0} full=${a2.fullRadixBuilds ?? 0} mode=${a2.lastMode ?? 'n/a'}`);
        }
        const a3 = globalThis.__ulgA3RegionalClosureStatus;
        const a3t = globalThis.__ulgA3ThermalRegionalClosureStatus;
        if (a3 || a3t) {
          archLines.push(`A3 regional closures: pressure=${a3?.adoptedSchedules ?? 0} thermalG4=${a3t?.adoptedSchedules ?? 0} (${a3t?.regionCount ?? 0} regions)`);
        }
        const a4 = globalThis.__ulgA4GasResponseStatus;
        if (a4) {
          archLines.push(`A4 2-D gas closures: ${a4.functionCount ?? 0} fns / ${a4.materialCount ?? 0} mats (gpu=${Boolean(a4.gpuTableUploaded)})`);
        }
        const a5 = globalThis.__ulgA5SolidStatus;
        if (a5) {
          archLines.push(`A5 solids: rigid=${a5.rigidBodyCount ?? 0} deformable=${a5.sol4DeformableSurfaceCount ?? 0} sol5=${Boolean(a5.sol5FractureActive)} sol6=${Boolean(a5.sol6MultilevelActive)}`);
        }
        const a6Mesh = globalThis.__ulgA6PeerMeshStatus;
        const a6Bridge = globalThis.__ulgA6ClosureBridgeStatus;
        if (a6Mesh || a6Bridge) {
          const rtcCount = Array.isArray(a6Mesh?.webrtcDataChannelPeers) ? a6Mesh.webrtcDataChannelPeers.length : 0;
          archLines.push(`A6 derivation: transport=${a6Mesh?.transport ?? 'local'} connected=${Boolean(a6Mesh?.connected)} peers=${a6Mesh?.remotePeerCount ?? 0} webrtc=${rtcCount} quorum=${Boolean(a6Mesh?.quorumReady)} debt=${a6Bridge?.remoteDebtCount ?? 0}`);
        }
        const archSuffix = archLines.length > 0 ? `\n\n--- Architecture ---\n${archLines.join('\n')}` : '';
        diagnosticsPreEl.textContent = `${snap.statusText || ''}${archSuffix}`.trim();
      }
    }
  }

  function setActiveTab(nextTab) {
    activeTab = nextTab;
    for (const btn of tabButtons) {
      btn.setAttribute('aria-selected', String(btn.dataset.tab === activeTab));
    }
    for (const [name, panel] of Object.entries(tabPanels)) {
      panel.hidden = name !== activeTab;
    }
    if (nextTab === 'presets') {
      clearBrowserUrlParams();
    }
  }

  function setModalOpen(nextOpen) {
    modalOpen = Boolean(nextOpen);
    modalBackdrop.hidden = !modalOpen;
    menuToggleBtn.setAttribute('aria-expanded', String(modalOpen));
    if (modalOpen) {
      renderAllTabs();
      updateChromeAndStatus();
      activeSession?.setDiagnosticsVisible?.(diagnosticsOpen);
    } else {
      activeSession?.setDiagnosticsVisible?.(false);
      const snap = activeSession?.getTelemetrySnapshot?.() || null;
      if (
        activeSession
        && !launchInFlight
        && !loadingErrorMessage
        && !snap?.blocked
        && !(snap?.visualUpdatesReady === true && snap?.pendingPreviewActive !== true)
      ) {
        loadingActive = true;
      }
      updateChromeAndStatus();
    }
  }

  function renderPresetsTab() {
    const panel = tabPanels.presets;
    panel.replaceChildren();
    const head = document.createElement('div');
    head.className = 'ulg-section-head';
    head.innerHTML = '<h3 class="ulg-section-title">Curated Scenarios</h3><span class="ulg-section-help" style="margin:0;">Selecting a preset only stages its setup — live runs stay untouched until you relaunch.</span>';
    panel.appendChild(head);

    const grid = document.createElement('div');
    grid.className = 'ulg-preset-grid';

    for (const entry of SPH_PHASE_SCENARIO_PRESETS) {
      const preview = buildStagedConfigFromPreset(entry.id);
      const count = totalParticlesOf(preview.bodies);
      const box = preview.boxDimensionsM;
      const materials = [...new Set(preview.bodies.map((b) => b.material.toUpperCase()))].join(' + ');
      const boxStr = box[0] < 0.5
        ? `${Math.round(box[0] * 1000)} mm cube`
        : `${fmtMeters(box[0])} m cube`;

      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'ulg-preset-card';
      card.dataset.presetId = entry.id;
      card.dataset.selected = String(stagedConfig.presetId === entry.id);
      card.innerHTML = `
        <div class="ulg-preset-card-title">${entry.label}</div>
        <div class="ulg-preset-card-copy">${entry.summary || ''}</div>
        <div class="ulg-chip-row">
          <span class="ulg-chip">${materials}</span>
          <span class="ulg-chip">${count.toLocaleString()} particles</span>
          <span class="ulg-chip">${boxStr}</span>
          <span class="ulg-chip">Isosurface</span>
        </div>
      `;
      card.addEventListener('click', () => {
        const next = buildStagedConfigFromPreset(entry.id);
        next.display = { ...stagedConfig.display };
        stagedConfig = next;
        syncUrlFromStagedConfig();
        renderAllTabs();
        updateChromeAndStatus();
      });
      grid.appendChild(card);
    }

    const customCard = document.createElement('button');
    customCard.type = 'button';
    customCard.className = 'ulg-preset-card';
    customCard.dataset.presetId = 'custom';
    customCard.dataset.selected = String(stagedConfig.presetId === 'custom');
    customCard.innerHTML = `
      <div class="ulg-preset-card-title">Custom Sandbox</div>
      <div class="ulg-preset-card-copy">Start from a clean floor-centered container and assemble any materials from the periodic table.</div>
      <div class="ulg-chip-row">
        <span class="ulg-chip">118 Elements</span>
        <span class="ulg-chip">Floor Origin (0,0,0)</span>
      </div>
    `;
    customCard.addEventListener('click', () => {
      const next = buildBlankCustomConfig();
      next.display = { ...stagedConfig.display };
      stagedConfig = next;
      syncUrlFromStagedConfig();
      renderAllTabs();
      updateChromeAndStatus();
    });
    grid.appendChild(customCard);
    panel.appendChild(grid);
  }

  function markStagedCustom() {
    stagedConfig.presetId = 'custom';
    syncUrlFromStagedConfig();
  }

  function renderBodiesTab() {
    const panel = tabPanels.bodies;
    panel.replaceChildren();
    const validation = validateStagedSimulationConfig(stagedConfig);
    const bounds = containerBoundsForFrame(stagedConfig.boxDimensionsM, 'floor-centered');

    const head = document.createElement('div');
    head.className = 'ulg-section-head';
    const summary = document.createElement('div');
    summary.innerHTML = `
      <h3 class="ulg-section-title">Material Bodies (${stagedConfig.bodies.length}) · ${totalParticlesOf(stagedConfig.bodies).toLocaleString()} particles</h3>
      <p class="ulg-section-help" style="margin:3px 0 0;">
        Origin <code>(0, 0, 0)</code> is locked at the center of the container floor:
        X ∈ [${fmtMeters(bounds.minM[0])}, ${fmtMeters(bounds.maxM[0])}] m,
        Y ∈ [0, ${fmtMeters(bounds.maxM[1])}] m,
        Z ∈ [${fmtMeters(bounds.minM[2])}, ${fmtMeters(bounds.maxM[2])}] m.
      </p>
    `;
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.id = 'ulg-add-body-btn';
    addBtn.className = 'ulg-btn ulg-btn-sm';
    addBtn.textContent = '+ Add Body';
    addBtn.addEventListener('click', () => {
      const box = stagedConfig.boxDimensionsM;
      const template = stagedConfig.bodies[stagedConfig.bodies.length - 1] || {
        material: 'h2o',
        sizeM: [box[0] * 0.25, box[1] * 0.25, box[2] * 0.25],
        centerM: [0, box[1] * 0.125, 0],
        temperatureK: 293.15,
        particlesPerEdge: [3, 3, 3],
        velocityMPerS: [0, 0, 0]
      };
      const idInfo = stagedConfig.bodies.length > 0
        ? allocateNextSphInitialBodyIdentity(stagedConfig.bodies)
        : { id: 'body-1', domainId: 1 };
      const topY = stagedConfig.bodies.reduce(
        (maxY, b) => Math.max(maxY, b.centerM[1] + b.sizeM[1] / 2),
        0
      );
      const pitchY = template.sizeM[1] / template.particlesPerEdge[1];
      const desiredCenterY = Math.min(
        box[1] - template.sizeM[1] / 2,
        topY + pitchY * 0.5 + template.sizeM[1] / 2
      );
      const candidate = {
        id: idInfo.id,
        domainId: idInfo.domainId,
        material: template.material,
        sizeM: [...template.sizeM],
        centerM: [0, Math.max(template.sizeM[1] / 2, roundNice(desiredCenterY, 5)), 0],
        temperatureK: template.temperatureK,
        particlesPerEdge: [...template.particlesPerEdge],
        velocityMPerS: [0, 0, 0]
      };
      const placed = findNonOverlappingPlacementForBody(candidate, stagedConfig.bodies, box, {
        coordinateFrame: 'floor-centered'
      }) || clampSphInitialBodyToContainer(candidate, box, { coordinateFrame: 'floor-centered' }) || candidate;
      stagedConfig.bodies = [...stagedConfig.bodies, {
        ...placed,
        centerM: Array.from(placed.centerM).map((v) => roundNice(v, 6)),
        sizeM: Array.from(placed.sizeM).map((v) => roundNice(v, 6)),
        particlesPerEdge: [...placed.particlesPerEdge],
        velocityMPerS: [...placed.velocityMPerS]
      }];
      markStagedCustom();
      renderAllTabs();
      updateChromeAndStatus();
    });
    head.append(summary, addBtn);
    panel.appendChild(head);

    const list = document.createElement('div');
    list.className = 'ulg-body-list';

    stagedConfig.bodies.forEach((body, index) => {
      const card = document.createElement('article');
      card.className = 'ulg-body-card';
      card.dataset.bodyId = body.id;
      const errMsg = validation.bodyErrors.get(body.id) || null;
      if (errMsg) card.dataset.invalid = 'true';

      const count = body.particlesPerEdge.reduce((p, n) => p * n, 1);
      const cardHead = document.createElement('div');
      cardHead.className = 'ulg-body-card-head';
      cardHead.innerHTML = `
        <div class="ulg-body-meta">
          <span class="ulg-body-name">${body.id}</span>
          <span class="ulg-chip">${count.toLocaleString()} particles</span>
          <span class="ulg-chip">${fmtMeters(body.sizeM[0])} × ${fmtMeters(body.sizeM[1])} × ${fmtMeters(body.sizeM[2])} m</span>
        </div>
      `;

      const actions = document.createElement('div');
      actions.className = 'ulg-body-actions';
      const mkBtn = (label, title, onClick, disabled = false, extraClass = '') => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `ulg-btn ulg-btn-subtle ulg-btn-sm ${extraClass}`.trim();
        b.textContent = label;
        b.title = title;
        b.disabled = disabled;
        b.addEventListener('click', onClick);
        return b;
      };
      actions.append(
        mkBtn('Floor', 'Seat body bottom on floor (Y = sizeY/2)', () => {
          body.centerM = [body.centerM[0], roundNice(body.sizeM[1] / 2, 6), body.centerM[2]];
          markStagedCustom();
          renderBodiesTab();
          updateChromeAndStatus();
        }),
        mkBtn('Center', 'Center horizontally over floor origin (X=0, Z=0)', () => {
          body.centerM = [0, body.centerM[1], 0];
          markStagedCustom();
          renderBodiesTab();
          updateChromeAndStatus();
        }),
        mkBtn('↑', 'Move up', () => {
          stagedConfig.bodies = moveSphInitialBody(stagedConfig.bodies, body.id, index - 1).bodies.map((b) => ({
            ...b, centerM: [...b.centerM], sizeM: [...b.sizeM], particlesPerEdge: [...b.particlesPerEdge], velocityMPerS: [...b.velocityMPerS]
          }));
          markStagedCustom();
          renderBodiesTab();
          updateChromeAndStatus();
        }, index === 0),
        mkBtn('↓', 'Move down', () => {
          stagedConfig.bodies = moveSphInitialBody(stagedConfig.bodies, body.id, index + 1).bodies.map((b) => ({
            ...b, centerM: [...b.centerM], sizeM: [...b.sizeM], particlesPerEdge: [...b.particlesPerEdge], velocityMPerS: [...b.velocityMPerS]
          }));
          markStagedCustom();
          renderBodiesTab();
          updateChromeAndStatus();
        }, index === stagedConfig.bodies.length - 1),
        mkBtn('Copy', 'Duplicate body (placed without overlapping)', () => {
          const existingIds = new Set(stagedConfig.bodies.map((b) => b.id));
          const dupResult = duplicateSphInitialBody(stagedConfig.bodies, body.id);
          const duplicated = dupResult.bodies.find((b) => !existingIds.has(b.id))
            || dupResult.bodies[dupResult.bodies.length - 1];
          const placed = findNonOverlappingPlacementForBody(duplicated, stagedConfig.bodies, stagedConfig.boxDimensionsM, {
            coordinateFrame: 'floor-centered'
          }) || duplicated;
          stagedConfig.bodies = [
            ...stagedConfig.bodies,
            {
              ...placed,
              centerM: Array.from(placed.centerM).map((v) => roundNice(v, 6)),
              sizeM: Array.from(placed.sizeM).map((v) => roundNice(v, 6)),
              particlesPerEdge: [...placed.particlesPerEdge],
              velocityMPerS: [...placed.velocityMPerS]
            }
          ];
          markStagedCustom();
          renderBodiesTab();
          updateChromeAndStatus();
        }),
        mkBtn('Remove', 'Remove body', () => {
          stagedConfig.bodies = stagedConfig.bodies.filter((b) => b.id !== body.id);
          markStagedCustom();
          renderBodiesTab();
          updateChromeAndStatus();
        }, stagedConfig.bodies.length <= 1, 'ulg-btn-danger')
      );
      cardHead.appendChild(actions);
      card.appendChild(cardHead);

      if (errMsg) {
        const inlineErr = document.createElement('div');
        inlineErr.className = 'ulg-body-inline-error';
        inlineErr.textContent = errMsg;
        card.appendChild(inlineErr);
      }

      // Row 1: Material + Temperature
      const row1 = document.createElement('div');
      row1.className = 'ulg-grid-2';

      const matField = document.createElement('div');
      matField.className = 'ulg-field';
      matField.innerHTML = '<label class="ulg-field-label"><span>Material</span></label>';
      const matRow = document.createElement('div');
      matRow.className = 'ulg-material-row';
      const matSelect = document.createElement('select');
      matSelect.className = 'ulg-select';
      let found = false;
      for (const opt of MATERIAL_OPTIONS) {
        const o = document.createElement('option');
        o.value = opt.key;
        o.textContent = opt.label;
        if (opt.key === body.material) { o.selected = true; found = true; }
        matSelect.appendChild(o);
      }
      if (!found) {
        const o = document.createElement('option');
        o.value = body.material;
        o.textContent = `${body.material} (custom)`;
        o.selected = true;
        matSelect.prepend(o);
      }
      matSelect.addEventListener('change', () => {
        body.material = matSelect.value;
        markStagedCustom();
        renderPresetsTab();
        updateChromeAndStatus();
      });
      const ptBtn = document.createElement('button');
      ptBtn.type = 'button';
      ptBtn.className = 'ulg-btn ulg-btn-sm';
      ptBtn.textContent = 'PT';
      ptBtn.title = 'Choose from periodic table';
      ptBtn.addEventListener('click', () => {
        openPeriodicTableDialog({
          root,
          currentValue: body.material,
          title: body.id,
          onSelect: (materialKey) => {
            body.material = materialKey;
            markStagedCustom();
            renderAllTabs();
            updateChromeAndStatus();
          }
        });
      });
      matRow.append(matSelect, ptBtn);
      matField.appendChild(matRow);

      const tempField = document.createElement('label');
      tempField.className = 'ulg-field';
      tempField.innerHTML = `<span class="ulg-field-label"><span>Temperature (K)</span><span class="ulg-field-hint">${fmtTempC(body.temperatureK)}</span></span>`;
      const tempInput = document.createElement('input');
      tempInput.type = 'number';
      tempInput.className = 'ulg-input';
      tempInput.step = 'any';
      tempInput.min = '1';
      tempInput.value = String(body.temperatureK);
      tempInput.addEventListener('change', () => {
        const v = Number(tempInput.value);
        if (Number.isFinite(v) && v > 0) {
          body.temperatureK = v;
          markStagedCustom();
          renderBodiesTab();
          updateChromeAndStatus();
        }
      });
      tempField.appendChild(tempInput);
      row1.append(matField, tempField);
      card.appendChild(row1);

      // Row 1b: Solid Mechanics Mode (Auto / Rigid / Deformable SOL-4 / Continuum)
      const mechField = document.createElement('label');
      mechField.className = 'ulg-field';
      mechField.innerHTML = '<span class="ulg-field-label"><span>Mechanics Carrier</span><span class="ulg-field-hint">Auto promotes cold non-reactive solids to coherent rigid frames</span></span>';
      const mechSelect = document.createElement('select');
      mechSelect.className = 'ulg-select';
      mechSelect.dataset.bodyMechanicsMode = body.id;
      const currentMode = body.mechanicsMode || 'auto';
      for (const [modeVal, modeLabel] of BODY_MECHANICS_MODE_OPTIONS) {
        const o = document.createElement('option');
        o.value = modeVal;
        o.textContent = modeLabel;
        if (modeVal === currentMode) o.selected = true;
        mechSelect.appendChild(o);
      }
      mechSelect.addEventListener('change', () => {
        if (mechSelect.value === 'auto') {
          delete body.mechanicsMode;
          delete body.angularVelocityRadPerS;
        } else {
          body.mechanicsMode = mechSelect.value;
          if (mechSelect.value !== 'rigid') delete body.angularVelocityRadPerS;
        }
        markStagedCustom();
        renderBodiesTab();
        updateChromeAndStatus();
      });
      mechField.appendChild(mechSelect);
      card.appendChild(mechField);

      // Row 2: Particles per edge (X, Y, Z) -> derives size
      const ppeField = document.createElement('div');
      ppeField.className = 'ulg-field';
      ppeField.innerHTML = '<span class="ulg-field-label"><span>Particles per Edge</span><span class="ulg-field-hint">Preserves particle pitch</span></span>';
      const ppeGrid = document.createElement('div');
      ppeGrid.className = 'ulg-grid-3';
      ['X', 'Y', 'Z'].forEach((axisLabel, axis) => {
        const wrap = document.createElement('label');
        wrap.className = 'ulg-field';
        wrap.innerHTML = `<span class="ulg-field-label"><span>${axisLabel}</span><span class="ulg-field-hint">${fmtMeters(body.sizeM[axis])} m</span></span>`;
        const inp = document.createElement('input');
        inp.type = 'number';
        inp.className = 'ulg-input';
        inp.min = '1';
        inp.step = '1';
        inp.value = String(body.particlesPerEdge[axis]);
        inp.addEventListener('change', () => {
          const nextCount = Math.max(1, Math.round(Number(inp.value) || 1));
          const nextPpe = [...body.particlesPerEdge];
          nextPpe[axis] = nextCount;
          try {
            const derivedSize = deriveSphInitialBodySizeM(body, nextPpe);
            body.particlesPerEdge = nextPpe;
            body.sizeM = Array.from(derivedSize).map((v) => roundNice(v, 6));
            markStagedCustom();
            renderAllTabs();
            updateChromeAndStatus();
          } catch {
            renderBodiesTab();
          }
        });
        wrap.appendChild(inp);
        ppeGrid.appendChild(wrap);
      });
      ppeField.appendChild(ppeGrid);
      card.appendChild(ppeField);

      // Row 3: Floor-centered Center Position (X, Y, Z) with live allowed ranges
      const posField = document.createElement('div');
      posField.className = 'ulg-field';
      posField.innerHTML = '<span class="ulg-field-label"><span>Center Position (m · floor origin)</span><span class="ulg-field-hint">Bounds must remain inside container</span></span>';
      const posGrid = document.createElement('div');
      posGrid.className = 'ulg-grid-3';
      ['X', 'Y', 'Z'].forEach((axisLabel, axis) => {
        const half = body.sizeM[axis] / 2;
        const minCenter = bounds.minM[axis] + half;
        const maxCenter = bounds.maxM[axis] - half;
        const wrap = document.createElement('label');
        wrap.className = 'ulg-field';
        wrap.innerHTML = `<span class="ulg-field-label"><span>${axisLabel}</span><span class="ulg-field-hint">[${fmtMeters(minCenter)}, ${fmtMeters(maxCenter)}]</span></span>`;
        const inp = document.createElement('input');
        inp.type = 'number';
        inp.className = 'ulg-input';
        inp.step = 'any';
        inp.min = String(roundNice(minCenter, 6));
        inp.max = String(roundNice(maxCenter, 6));
        inp.value = String(roundNice(body.centerM[axis], 6));
        inp.addEventListener('change', () => {
          const v = Number(inp.value);
          if (Number.isFinite(v)) {
            body.centerM[axis] = v;
            markStagedCustom();
            renderBodiesTab();
            updateChromeAndStatus();
          }
        });
        wrap.appendChild(inp);
        posGrid.appendChild(wrap);
      });
      posField.appendChild(posGrid);
      card.appendChild(posField);

      // Collapsible initial velocity
      const velDetails = document.createElement('details');
      velDetails.className = 'ulg-details';
      if (body.velocityMPerS.some((v) => v !== 0)) velDetails.open = true;
      velDetails.innerHTML = '<summary>Initial Velocity (m/s)</summary>';
      const velGrid = document.createElement('div');
      velGrid.className = 'ulg-grid-3';
      ['Vx', 'Vy', 'Vz'].forEach((axisLabel, axis) => {
        const wrap = document.createElement('label');
        wrap.className = 'ulg-field';
        wrap.innerHTML = `<span class="ulg-field-label"><span>${axisLabel}</span></span>`;
        const inp = document.createElement('input');
        inp.type = 'number';
        inp.className = 'ulg-input';
        inp.step = 'any';
        inp.value = String(body.velocityMPerS[axis]);
        inp.addEventListener('change', () => {
          const v = Number(inp.value);
          if (Number.isFinite(v)) {
            body.velocityMPerS[axis] = v;
            markStagedCustom();
            updateChromeAndStatus();
          }
        });
        wrap.appendChild(inp);
        velGrid.appendChild(wrap);
      });
      velDetails.appendChild(velGrid);
      card.appendChild(velDetails);

      list.appendChild(card);
    });
    panel.appendChild(list);
  }

  function renderContainerTab() {
    const panel = tabPanels.container;
    panel.replaceChildren();
    const bounds = containerBoundsForFrame(stagedConfig.boxDimensionsM, 'floor-centered');

    // Container Dimensions block
    const boxBlock = document.createElement('div');
    boxBlock.className = 'ulg-card-block';
    boxBlock.innerHTML = `
      <div class="ulg-section-head">
        <h3 class="ulg-section-title">Container Dimensions (m)</h3>
        <span class="ulg-chip">Floor center = (0, 0, 0)</span>
      </div>
      <p class="ulg-section-help">
        Active bounds: X ∈ [${fmtMeters(bounds.minM[0])}, ${fmtMeters(bounds.maxM[0])}] m ·
        Y ∈ [0, ${fmtMeters(bounds.maxM[1])}] m ·
        Z ∈ [${fmtMeters(bounds.minM[2])}, ${fmtMeters(bounds.maxM[2])}] m.
      </p>
    `;
    const boxGrid = document.createElement('div');
    boxGrid.className = 'ulg-grid-3';
    ['Width (X)', 'Height (Y)', 'Depth (Z)'].forEach((label, axis) => {
      const wrap = document.createElement('label');
      wrap.className = 'ulg-field';
      wrap.innerHTML = `<span class="ulg-field-label"><span>${label}</span></span>`;
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.className = 'ulg-input';
      inp.step = 'any';
      inp.min = '0.01';
      inp.value = String(roundNice(stagedConfig.boxDimensionsM[axis], 6));
      inp.addEventListener('change', () => {
        const v = Number(inp.value);
        if (Number.isFinite(v) && v > 0) {
          stagedConfig.boxDimensionsM[axis] = v;
          markStagedCustom();
          renderContainerTab();
          renderBodiesTab();
          updateChromeAndStatus();
        }
      });
      wrap.appendChild(inp);
      boxGrid.appendChild(wrap);
    });
    boxBlock.appendChild(boxGrid);
    panel.appendChild(boxBlock);

    // Walls & Atmosphere block
    const envBlock = document.createElement('div');
    envBlock.className = 'ulg-card-block';
    envBlock.innerHTML = '<div class="ulg-section-head"><h3 class="ulg-section-title">Walls &amp; Atmosphere</h3></div>';

    const topGrid = document.createElement('div');
    topGrid.className = 'ulg-grid-2';

    const wallModelField = document.createElement('label');
    wallModelField.className = 'ulg-field';
    wallModelField.innerHTML = '<span class="ulg-field-label"><span>Wall Thermal Boundary</span></span>';
    const wallModelSel = document.createElement('select');
    wallModelSel.className = 'ulg-select';
    for (const [value, text] of [
      ['adiabatic', 'Adiabatic (insulated walls)'],
      ['finite-heat-capacity-lumped-face', 'Finite heat-capacity walls'],
      ['infinite-fixed-temperature-reservoir', 'Fixed-temperature walls']
    ]) {
      const o = document.createElement('option');
      o.value = value;
      o.textContent = text;
      if (stagedConfig.wallModel === value) o.selected = true;
      wallModelSel.appendChild(o);
    }
    wallModelSel.addEventListener('change', () => {
      stagedConfig.wallModel = wallModelSel.value;
      markStagedCustom();
      renderContainerTab();
      updateChromeAndStatus();
    });
    wallModelField.appendChild(wallModelSel);

    const atmModeField = document.createElement('label');
    atmModeField.className = 'ulg-field';
    atmModeField.innerHTML = '<span class="ulg-field-label"><span>Atmosphere</span></span>';
    const atmModeSel = document.createElement('select');
    atmModeSel.className = 'ulg-select';
    for (const [value, text] of [['vacuum', 'Vacuum'], ['air', 'Humid room air']]) {
      const o = document.createElement('option');
      o.value = value;
      o.textContent = text;
      if (stagedConfig.environment.mode === value) o.selected = true;
      atmModeSel.appendChild(o);
    }
    atmModeSel.addEventListener('change', () => {
      stagedConfig.environment.mode = atmModeSel.value;
      markStagedCustom();
      renderContainerTab();
      updateChromeAndStatus();
    });
    atmModeField.appendChild(atmModeSel);
    topGrid.append(wallModelField, atmModeField);
    envBlock.appendChild(topGrid);

    if (stagedConfig.wallModel !== 'adiabatic') {
      const wallDetails = document.createElement('details');
      wallDetails.className = 'ulg-details';
      wallDetails.style.marginTop = '12px';
      wallDetails.open = stagedConfig.wallModel === 'infinite-fixed-temperature-reservoir';
      wallDetails.innerHTML = '<summary>Wall Temperatures (K)</summary>';
      const wallGrid = document.createElement('div');
      wallGrid.className = 'ulg-grid-3';
      for (const [faceKey, label] of WALL_FACES) {
        const wrap = document.createElement('label');
        wrap.className = 'ulg-field';
        wrap.innerHTML = `<span class="ulg-field-label"><span>${label}</span><span class="ulg-field-hint">${fmtTempC(stagedConfig.walls[faceKey])}</span></span>`;
        const inp = document.createElement('input');
        inp.type = 'number';
        inp.className = 'ulg-input';
        inp.step = '5';
        inp.min = '1';
        inp.value = String(stagedConfig.walls[faceKey]);
        inp.addEventListener('change', () => {
          const v = Number(inp.value);
          if (Number.isFinite(v) && v > 0) {
            stagedConfig.walls[faceKey] = v;
            markStagedCustom();
            renderContainerTab();
            updateChromeAndStatus();
          }
        });
        wrap.appendChild(inp);
        wallGrid.appendChild(wrap);
      }
      wallDetails.appendChild(wallGrid);
      envBlock.appendChild(wallDetails);
    }

    if (stagedConfig.environment.mode === 'air') {
      const airGrid = document.createElement('div');
      airGrid.className = 'ulg-grid-3';
      airGrid.style.marginTop = '12px';
      for (const [key, label] of [
        ['temperatureK', 'Air Temp (K)'],
        ['pressurePa', 'Pressure (Pa)'],
        ['humidityPercent', 'Humidity (%)']
      ]) {
        const wrap = document.createElement('label');
        wrap.className = 'ulg-field';
        wrap.innerHTML = `<span class="ulg-field-label"><span>${label}</span></span>`;
        const inp = document.createElement('input');
        inp.type = 'number';
        inp.className = 'ulg-input';
        inp.step = 'any';
        inp.value = String(stagedConfig.environment[key]);
        inp.addEventListener('change', () => {
          const v = Number(inp.value);
          if (Number.isFinite(v)) {
            stagedConfig.environment[key] = v;
            markStagedCustom();
            updateChromeAndStatus();
          }
        });
        wrap.appendChild(inp);
        airGrid.appendChild(wrap);
      }
      envBlock.appendChild(airGrid);

      // First-Class Air 2-Level SS toggle (strictly 2 levels: L0 fine + L1 coarse ambient)
      const twoLevelAirLabel = document.createElement('label');
      twoLevelAirLabel.className = 'ulg-toggle-item';
      twoLevelAirLabel.style.marginTop = '10px';
      const twoLevelAirCb = document.createElement('input');
      twoLevelAirCb.type = 'checkbox';
      twoLevelAirCb.checked = Boolean(stagedConfig.environment.twoLevelAir);
      twoLevelAirCb.addEventListener('change', () => {
        stagedConfig.environment.twoLevelAir = twoLevelAirCb.checked;
        markStagedCustom();
        updateChromeAndStatus();
      });
      const twoLevelAirText = document.createElement('span');
      twoLevelAirText.textContent = '2-Level First-Class Air (L1 coarse ambient + L0 fine interface, retires implicit atmosphere stand-in)';
      twoLevelAirLabel.append(twoLevelAirCb, twoLevelAirText);
      envBlock.appendChild(twoLevelAirLabel);
    }
    panel.appendChild(envBlock);

    // Physical Laws block
    const lawsBlock = document.createElement('div');
    lawsBlock.className = 'ulg-card-block';
    lawsBlock.style.marginBottom = '0';
    lawsBlock.innerHTML = `
      <div class="ulg-section-head">
        <h3 class="ulg-section-title">Physical Laws</h3>
        <span class="ulg-section-help" style="margin:0;">Applied on Launch / Relaunch</span>
      </div>
    `;
    const lawGrid = document.createElement('div');
    lawGrid.className = 'ulg-toggle-grid';
    for (const [key, label] of FORWARD_LAW_TOGGLES) {
      const item = document.createElement('label');
      item.className = 'ulg-toggle-item';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = Boolean(stagedConfig.laws[key]);
      cb.addEventListener('change', () => {
        stagedConfig.laws[key] = cb.checked;
        markStagedCustom();
        updateChromeAndStatus();
      });
      const span = document.createElement('span');
      span.textContent = label;
      item.append(cb, span);
      lawGrid.appendChild(item);
    }
    lawsBlock.appendChild(lawGrid);
    panel.appendChild(lawsBlock);
  }

  function renderDisplayTab() {
    const panel = tabPanels.display;
    panel.replaceChildren();

    // Lighting
    const lightBlock = document.createElement('div');
    lightBlock.className = 'ulg-card-block';
    lightBlock.innerHTML = '<div class="ulg-section-head"><h3 class="ulg-section-title">Scene Lighting</h3><span class="ulg-chip">Applies live</span></div>';
    const seg = document.createElement('div');
    seg.className = 'ulg-segmented';
    for (const [mode, label] of [
      [SPH_SCENE_LIGHTING_MODE_DEFAULT, 'Normal Lab'],
      [SPH_SCENE_LIGHTING_MODE_DARK_LAB, 'Dark Lab']
    ]) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = label;
      btn.setAttribute('aria-pressed', String(stagedConfig.display.lightingMode === mode));
      btn.addEventListener('click', () => {
        stagedConfig.display.lightingMode = mode;
        activeSession?.setLightingMode?.(mode, { reason: 'studio-display-lighting' });
        if (hasSimulationUrlParams(window.location.search) || activeSession) syncUrlFromStagedConfig();
        renderDisplayTab();
      });
      seg.appendChild(btn);
    }
    lightBlock.appendChild(seg);
    panel.appendChild(lightBlock);

    // Background & Surface
    const bgBlock = document.createElement('div');
    bgBlock.className = 'ulg-card-block';
    bgBlock.innerHTML = '<div class="ulg-section-head"><h3 class="ulg-section-title">Background &amp; Surface</h3><span class="ulg-chip">Applies live</span></div>';

    const bgGrid = document.createElement('div');
    bgGrid.className = 'ulg-grid-2';

    const colorCol = document.createElement('div');
    colorCol.className = 'ulg-field';
    colorCol.innerHTML = '<span class="ulg-field-label"><span>Background Color</span></span>';
    const swatchRow = document.createElement('div');
    swatchRow.className = 'ulg-swatch-row';
    for (const [hex, name] of CURATED_BG_SWATCHES) {
      const sw = document.createElement('button');
      sw.type = 'button';
      sw.className = 'ulg-swatch';
      sw.style.background = hex;
      sw.title = name;
      sw.dataset.active = String(stagedConfig.display.backgroundColor.toLowerCase() === hex.toLowerCase());
      sw.addEventListener('click', () => {
        stagedConfig.display.backgroundColor = hex;
        activeSession?.setBackgroundColor?.(hex);
        if (hasSimulationUrlParams(window.location.search) || activeSession) syncUrlFromStagedConfig();
        renderDisplayTab();
      });
      swatchRow.appendChild(sw);
    }
    const colorPicker = document.createElement('input');
    colorPicker.type = 'color';
    colorPicker.className = 'ulg-input';
    colorPicker.style.width = '48px';
    colorPicker.style.padding = '3px';
    colorPicker.value = normalizeSphSceneBackgroundColorHex(stagedConfig.display.backgroundColor);
    colorPicker.addEventListener('input', () => {
      stagedConfig.display.backgroundColor = colorPicker.value;
      activeSession?.setBackgroundColor?.(colorPicker.value);
      if (hasSimulationUrlParams(window.location.search) || activeSession) syncUrlFromStagedConfig();
    });
    swatchRow.appendChild(colorPicker);
    colorCol.appendChild(swatchRow);

    const scaleCol = document.createElement('label');
    scaleCol.className = 'ulg-field';
    scaleCol.innerHTML = `<span class="ulg-field-label"><span>Isosurface Scale</span><span class="ulg-field-hint">${stagedConfig.display.blobScale.toFixed(2)}×</span></span>`;
    const scaleInput = document.createElement('input');
    scaleInput.type = 'range';
    scaleInput.min = '0.5';
    scaleInput.max = '2.0';
    scaleInput.step = '0.05';
    scaleInput.value = String(stagedConfig.display.blobScale);
    scaleInput.style.accentColor = 'var(--ulg-accent)';
    scaleInput.addEventListener('input', () => {
      stagedConfig.display.blobScale = Number(scaleInput.value);
      activeSession?.setBlobScale?.(stagedConfig.display.blobScale);
      if (hasSimulationUrlParams(window.location.search) || activeSession) syncUrlFromStagedConfig();
      const hint = scaleCol.querySelector('.ulg-field-hint');
      if (hint) hint.textContent = `${stagedConfig.display.blobScale.toFixed(2)}×`;
    });
    scaleCol.appendChild(scaleInput);
    bgGrid.append(colorCol, scaleCol);
    bgBlock.appendChild(bgGrid);

    // Local background image upload
    const imgRow = document.createElement('div');
    imgRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:14px;flex-wrap:wrap;';
    const imgInput = document.createElement('input');
    imgInput.type = 'file';
    imgInput.accept = 'image/avif,image/jpeg,image/png,image/webp';
    imgInput.style.cssText = 'font-size:12px;color:var(--ulg-text-muted);flex:1;min-width:180px;';
    const imgStatus = document.createElement('span');
    imgStatus.className = 'ulg-field-hint';
    imgStatus.textContent = pendingLocalBgFile ? `Loaded: ${pendingLocalBgFile.name}` : 'Optional local background image (stays on device)';
    const clearImgBtn = document.createElement('button');
    clearImgBtn.type = 'button';
    clearImgBtn.className = 'ulg-btn ulg-btn-subtle ulg-btn-sm';
    clearImgBtn.textContent = 'Clear Image';
    clearImgBtn.disabled = !pendingLocalBgFile;
    imgInput.addEventListener('change', () => {
      const file = imgInput.files?.[0] || null;
      if (!file) return;
      const check = validateSphLocalBackgroundImageFile(file);
      if (!check.accepted) {
        imgStatus.textContent = check.reason;
        return;
      }
      pendingLocalBgFile = file;
      activeSession?.setLocalBackgroundImageFile?.(file);
      clearImgBtn.disabled = false;
      imgStatus.textContent = `Loaded: ${file.name}`;
    });
    clearImgBtn.addEventListener('click', () => {
      pendingLocalBgFile = null;
      imgInput.value = '';
      activeSession?.clearBackgroundImage?.();
      clearImgBtn.disabled = true;
      imgStatus.textContent = 'Restored solid background color.';
    });
    imgRow.append(imgInput, clearImgBtn);
    bgBlock.append(imgRow, imgStatus);
    panel.appendChild(bgBlock);

    // Scene HUD & Display toggles
    const hudBlock = document.createElement('div');
    hudBlock.className = 'ulg-card-block';
    hudBlock.innerHTML = '<div class="ulg-section-head"><h3 class="ulg-section-title">Viewport Overlay</h3><span class="ulg-chip">Applies live</span></div>';
    const hudToggleLabel = document.createElement('label');
    hudToggleLabel.className = 'ulg-toggle-item';
    const hudToggleCb = document.createElement('input');
    hudToggleCb.type = 'checkbox';
    hudToggleCb.checked = miniHudPinned;
    hudToggleCb.addEventListener('change', () => {
      miniHudPinned = hudToggleCb.checked;
      pinHudToggle.checked = miniHudPinned;
      updateChromeAndStatus();
    });
    const hudToggleText = document.createElement('span');
    hudToggleText.textContent = 'Pin compact HUD (shows active scenario, sim time, and step count)';
    hudToggleLabel.append(hudToggleCb, hudToggleText);
    hudBlock.appendChild(hudToggleLabel);
    panel.appendChild(hudBlock);

    // Remote Derivation Peers (A6 cross-machine WebRTC / signaling relay)
    stagedConfig.network = stagedConfig.network || { peerRelayUrl: '', peerRoomId: '' };
    const peerBlock = document.createElement('div');
    peerBlock.className = 'ulg-card-block';
    const peerDetails = document.createElement('details');
    peerDetails.className = 'ulg-details';
    if (stagedConfig.network.peerRelayUrl || stagedConfig.network.peerRoomId) peerDetails.open = true;
    peerDetails.innerHTML = '<summary>Remote Derivation Peers (A6 WebRTC / Signaling Relay)</summary><p class="ulg-section-help" style="margin-top:8px;">Optional WebSocket signaling relay for cross-machine PeerCompute 2-of-2 quorum derivation over WebRTC DataChannels. Leave blank to use local warm workers and sibling same-origin tabs.</p>';
    const peerGrid = document.createElement('div');
    peerGrid.className = 'ulg-grid-2';
    peerGrid.style.marginTop = '8px';

    const relayField = document.createElement('label');
    relayField.className = 'ulg-field';
    relayField.innerHTML = '<span class="ulg-field-label"><span>Signaling Relay URL</span><span class="ulg-field-hint">wss://…</span></span>';
    const relayInp = document.createElement('input');
    relayInp.type = 'text';
    relayInp.className = 'ulg-input';
    relayInp.placeholder = 'wss://relay.example/ws';
    relayInp.value = stagedConfig.network.peerRelayUrl || '';
    relayInp.addEventListener('change', () => {
      stagedConfig.network.peerRelayUrl = relayInp.value.trim();
      if (hasSimulationUrlParams(window.location.search) || activeSession) syncUrlFromStagedConfig();
      updateChromeAndStatus();
    });
    relayField.appendChild(relayInp);

    const roomField = document.createElement('label');
    roomField.className = 'ulg-field';
    roomField.innerHTML = '<span class="ulg-field-label"><span>Mesh Room ID</span><span class="ulg-field-hint">optional</span></span>';
    const roomInp = document.createElement('input');
    roomInp.type = 'text';
    roomInp.className = 'ulg-input';
    roomInp.placeholder = 'ulg-a6-derivation-peers-v1';
    roomInp.value = stagedConfig.network.peerRoomId || '';
    roomInp.addEventListener('change', () => {
      stagedConfig.network.peerRoomId = roomInp.value.trim();
      if (hasSimulationUrlParams(window.location.search) || activeSession) syncUrlFromStagedConfig();
      updateChromeAndStatus();
    });
    roomField.appendChild(roomInp);

    peerGrid.append(relayField, roomField);
    peerDetails.appendChild(peerGrid);
    peerBlock.appendChild(peerDetails);
    panel.appendChild(peerBlock);

    // Cache block
    const cacheBlock = document.createElement('div');
    cacheBlock.className = 'ulg-card-block';
    cacheBlock.style.marginBottom = '0';
    cacheBlock.innerHTML = '<div class="ulg-section-head" style="margin-bottom:6px;"><h3 class="ulg-section-title">Derived Closure Cache</h3></div><p class="ulg-section-help">First-principles material and reaction closures are cached locally in browser storage for instant relaunches.</p>';
    const cacheRow = document.createElement('div');
    cacheRow.style.cssText = 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;';
    const clearCacheBtn = document.createElement('button');
    clearCacheBtn.type = 'button';
    clearCacheBtn.className = 'ulg-btn ulg-btn-subtle ulg-btn-sm';
    clearCacheBtn.textContent = 'Clear Derived Cache';
    const cacheMsg = document.createElement('span');
    cacheMsg.className = 'ulg-field-hint';
    clearCacheBtn.addEventListener('click', () => {
      const result = clearSphLocalDerivedCaches();
      cacheMsg.textContent = `Cleared ${(result.materialRecords || 0) + (result.reactionRecords || 0) + (result.tableRecords || 0)} cached records.`;
    });
    cacheRow.append(clearCacheBtn, cacheMsg);
    cacheBlock.appendChild(cacheRow);
    panel.appendChild(cacheBlock);
  }

  function renderAllTabs() {
    renderPresetsTab();
    renderBodiesTab();
    renderContainerTab();
    renderDisplayTab();
  }

  async function ensureRuntime() {
    if (typeof createRuntime !== 'function') return null;
    if (!sharedRuntimePromise) {
      sharedRuntimePromise = Promise.resolve().then(() => createRuntime());
    }
    return sharedRuntimePromise;
  }

  function unloadActiveSimulation() {
    loadingActive = false;
    loadingErrorMessage = null;
    loadingMaxPercent = 0;
    if (!activeSession) {
      updateChromeAndStatus();
      return;
    }
    const session = activeSession;
    activeSession = null;
    activeSignature = null;
    activePresetLabel = null;
    try {
      session.close();
    } catch {
      // Best-effort cleanup of prior GPU session.
    }
    updateChromeAndStatus();
  }

  async function launchFromStaged({
    closeModalAfter = true,
    autoStartOverride = null,
    syncUrl = true
  } = {}) {
    if (launchInFlight) return false;
    const validation = validateStagedSimulationConfig(stagedConfig);
    if (!validation.valid) {
      updateChromeAndStatus();
      return false;
    }
    if (syncUrl) syncUrlFromStagedConfig();

    const shouldAutoPlay = autoStartOverride != null ? Boolean(autoStartOverride) : autoPlayWhenReady;
    launchInFlight = true;
    loadingActive = true;
    loadingAutoPlay = shouldAutoPlay;
    loadingStartedAtMs = performance.now();
    loadingMaxPercent = 5;
    loadingErrorMessage = null;

    const snapshot = structuredClone(stagedConfig);
    const sig = configSignature(snapshot);
    const launchParams = buildLaunchParamsFromStagedConfig(snapshot);
    const presetEntry = sphPhaseScenarioPresetById(snapshot.presetId);
    const label = presetEntry ? presetEntry.label : 'Custom';

    if (closeModalAfter) setModalOpen(false);
    updateChromeAndStatus();

    try {
      if (activeSession) {
        const prior = activeSession;
        activeSession = null;
        activeSignature = null;
        activePresetLabel = null;
        try { prior.close(); } catch { /* Best-effort prior GPU teardown. */ }
      }
      const runtime = await ensureRuntime();
      const session = await mountSphPhaseDemoOverlay({
        studioManaged: true,
        launchParams,
        autoStart: shouldAutoPlay,
        hideMenu: true,
        runtime,
        peercomputeModule,
        residentMechanicsStageWorkerModuleUrl,
        residentComputeTaskModulePath
      });
      activeSession = session;
      activeSignature = sig;
      activePresetLabel = label;
      if (pendingLocalBgFile) {
        session.setLocalBackgroundImageFile?.(pendingLocalBgFile);
      }
      session.setDiagnosticsVisible?.(modalOpen && diagnosticsOpen);
      return true;
    } catch (error) {
      loadingErrorMessage = error instanceof Error ? error.message : String(error);
      statusPillEl.dataset.state = 'error';
      statusPillEl.textContent = `Launch failed: ${loadingErrorMessage}`;
      return false;
    } finally {
      launchInFlight = false;
      updateChromeAndStatus();
    }
  }

  // Event wiring
  menuToggleBtn.addEventListener('click', () => setModalOpen(!modalOpen));
  emptyOpenBtn.addEventListener('click', () => setModalOpen(true));
  loadingSettingsBtn.addEventListener('click', () => {
    loadingActive = false;
    loadingErrorMessage = null;
    setModalOpen(true);
    updateChromeAndStatus();
  });
  modalCloseBtn.addEventListener('click', () => setModalOpen(false));
  modalBackdrop.addEventListener('click', (event) => {
    if (event.target === modalBackdrop) setModalOpen(false);
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modalOpen && !root.querySelector('.ulg-pt-backdrop')) {
      setModalOpen(false);
    } else if (
      event.code === 'Space'
      && !modalOpen
      && !loadingActive
      && activeSession
      && document.activeElement === document.body
    ) {
      const snap = activeSession.getTelemetrySnapshot?.() || null;
      if (snap?.visualUpdatesReady === true && snap?.pendingPreviewActive !== true) {
        event.preventDefault();
        activeSession.togglePlay?.();
        updateChromeAndStatus();
      }
    }
  });

  for (const btn of tabButtons) {
    btn.addEventListener('click', () => setActiveTab(btn.dataset.tab));
  }

  fitAllBtn.addEventListener('click', () => {
    const box = stagedConfig.boxDimensionsM;
    stagedConfig.bodies = separateOverlappingSphInitialBodies(stagedConfig.bodies, box, {
      coordinateFrame: 'floor-centered'
    }).map((body) => ({
      ...body,
      centerM: Array.from(body.centerM).map((v) => roundNice(v, 6)),
      sizeM: Array.from(body.sizeM).map((v) => roundNice(v, 6)),
      particlesPerEdge: [...body.particlesPerEdge],
      velocityMPerS: [...body.velocityMPerS]
    }));
    markStagedCustom();
    renderAllTabs();
    updateChromeAndStatus();
  });

  playBtn.addEventListener('click', () => {
    activeSession?.togglePlay?.();
    updateChromeAndStatus();
  });
  stepBtn.addEventListener('click', () => {
    activeSession?.step?.();
    updateChromeAndStatus();
  });
  stopBtn.addEventListener('click', () => {
    unloadActiveSimulation();
  });
  autoplayToggle.addEventListener('change', () => {
    autoPlayWhenReady = autoplayToggle.checked;
    if (hasSimulationUrlParams(window.location.search) || activeSession) {
      syncUrlFromStagedConfig();
    }
  });
  launchBtn.addEventListener('click', () => {
    void launchFromStaged({ closeModalAfter: true });
  });

  diagnosticsToggleBtn.addEventListener('click', () => {
    diagnosticsOpen = !diagnosticsOpen;
    diagnosticsDrawerEl.hidden = !diagnosticsOpen;
    diagnosticsToggleBtn.setAttribute('aria-expanded', String(diagnosticsOpen));
    activeSession?.setDiagnosticsVisible?.(modalOpen && diagnosticsOpen);
    updateChromeAndStatus();
  });

  pinHudToggle.addEventListener('change', () => {
    miniHudPinned = pinHudToggle.checked;
    renderDisplayTab();
    updateChromeAndStatus();
  });

  diagnosticsPollTimer = window.setInterval(() => {
    if (loadingActive || launchInFlight || activeSession) {
      updateChromeAndStatus();
    }
  }, 180);

  renderAllTabs();
  updateChromeAndStatus();

  if (initialUrlParsed) {
    const initialValidation = validateStagedSimulationConfig(stagedConfig);
    if (initialValidation.valid) {
      void launchFromStaged({
        closeModalAfter: true,
        autoStartOverride: initialUrlParsed.autoPlay,
        syncUrl: false
      });
    } else {
      setModalOpen(true);
    }
  }

  const api = {
    root,
    openMenu: () => setModalOpen(true),
    closeMenu: () => setModalOpen(false),
    isMenuOpen: () => modalOpen,
    setActiveTab: (tab) => setActiveTab(tab),
    isLoading: () => Boolean(loadingActive || launchInFlight),
    getLoadingStatus: () => ({
      active: Boolean(loadingActive || launchInFlight),
      percent: loadingMaxPercent,
      phase: loadingPhaseEl.textContent,
      detail: loadingDetailEl.textContent
    }),
    getAutoPlayWhenReady: () => autoPlayWhenReady,
    setAutoPlayWhenReady(next) {
      autoPlayWhenReady = Boolean(next);
      autoplayToggle.checked = autoPlayWhenReady;
      return autoPlayWhenReady;
    },
    isMiniHudPinned: () => miniHudPinned,
    selectPreset(presetId) {
      const next = buildStagedConfigFromPreset(presetId);
      next.display = { ...stagedConfig.display };
      stagedConfig = next;
      syncUrlFromStagedConfig();
      renderAllTabs();
      updateChromeAndStatus();
      return stagedConfig;
    },
    getStagedConfig: () => structuredClone(stagedConfig),
    setStagedConfig(updater) {
      const next = typeof updater === 'function' ? updater(structuredClone(stagedConfig)) : updater;
      stagedConfig = next;
      syncUrlFromStagedConfig();
      renderAllTabs();
      updateChromeAndStatus();
      return validateStagedSimulationConfig(stagedConfig);
    },
    launch: (opts) => launchFromStaged(opts),
    unload: unloadActiveSimulation,
    isAllocated: () => Boolean(activeSession),
    getActiveSession: () => activeSession,
    getTelemetry: () => activeSession?.getTelemetrySnapshot?.() || null,
    dispose() {
      window.clearInterval(diagnosticsPollTimer);
      unloadActiveSimulation();
      root.remove();
    }
  };
  globalThis.__ulgStudio = api;
  return api;
}
