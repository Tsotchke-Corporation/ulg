// ULG ExoWebTUI Multi-Window Desktop Host (`src/demos/ulgExoWebTuiDesktop.js`).
//
// Integrates the real `@exotui` (`../exotui`) browser presenter, TiledWorkspace +
// WorkbenchWindowHost state engine, shared `SHELL_THEMES`, and live animated
// `SHELL_BACKGROUND_FIELDS` cell-canvas wallpapers to host all 5 ULG WebGPU labs
// as live draggable, resizable, tileable, minimizable, maximizable windows inside
// one unified retro workstation desktop — with responsive single-window phone mode!

import { runShellApp } from '@exotui/src/app/shell_presenter.ts';
if (typeof document !== 'undefined') {
  import('../styles/ulgRetroTheme.css').catch(() => {});
}
import { webPresenter } from '@exotui/src/web/web_presenter.ts';
import { createTiledWorkspaceController } from '@exotui/src/layout/tiled_workspace.ts';
import { createWorkbenchWindowHostController } from '@exotui/src/app/workbench_window_host.ts';
import {
  SHELL_THEMES,
  shellActiveTitlebarForeground,
  shellThemeById
} from '@exotui/src/app/shell_theme.ts';
import { SHELL_BACKGROUND_FIELDS } from '@exotui/src/app/backgrounds/mod.ts';
import {
  resolveVisualizationTheme,
  screenFrame
} from '@exotui/src/viz/mod.ts';

export const ULG_DESKTOP_APPS = Object.freeze([
  {
    id: 'universes',
    shortLabel: 'Universes',
    title: 'ULG Universes (40-OOM)',
    icon: '✦',
    scale: '10⁺²⁵ → 10⁻¹⁵ m',
    desc: 'Continuous WebGPU Cosmic Web, Galaxies, Star Systems, Stellar Fusion, SPH Planets, Weather & Nuclei.',
    src: './universes.html?embedded=exowebtui',
    defaultRect: { x: 0.03, y: 0.03, w: 0.72, h: 0.84 }
  },
  {
    id: 'studio',
    shortLabel: 'Studio',
    title: 'Continuum Studio (MLS-MPM)',
    icon: '◈',
    scale: '10⁻³ → 10⁺² m',
    desc: '3D WebGPU MLS-MPM fluids, rigid solids, phase transitions, refraction & chemical reactions.',
    src: './index.html?embedded=exowebtui&studio=1',
    defaultRect: { x: 0.08, y: 0.06, w: 0.68, h: 0.82 }
  },
  {
    id: 'elements',
    shortLabel: 'Elements',
    title: 'Material Physics Lab (Z=1..118)',
    icon: '⚛',
    scale: '10⁻¹⁵ → 10⁻⁹ m',
    desc: '4-component Dirac–KS atoms, nuclear fission/tunneling, Yee–Taflove FDTD optics, MD & Polytope Atlas.',
    src: './elements-lab.html?embedded=exowebtui',
    defaultRect: { x: 0.14, y: 0.08, w: 0.72, h: 0.84 }
  },
  {
    id: 'organic',
    shortLabel: 'Organic',
    title: 'Organic Chemistry Lab',
    icon: '⬡',
    scale: '10⁻¹⁰ → 10⁻⁶ m',
    desc: 'GPU Hückel π-MO orbitals, R↔S chirality, QEq reactive bond-order MD & autocatalytic networks.',
    src: './organic-lab.html?embedded=exowebtui',
    defaultRect: { x: 0.18, y: 0.10, w: 0.72, h: 0.82 }
  },
  {
    id: 'life',
    shortLabel: 'Bio Lab',
    title: 'Biophysics & Emergent Life Lab',
    icon: '🧬',
    scale: '10⁻⁹ → 10⁻² m',
    desc: 'Vivarium alien organisms, amphiphile protocells, biopolymer folding, Eigen evolution & morphogenesis.',
    src: './life-lab.html?embedded=exowebtui',
    defaultRect: { x: 0.22, y: 0.12, w: 0.72, h: 0.82 }
  },
  {
    id: 'console',
    shortLabel: 'Settings',
    title: 'ExoWebTUI Theme & System Console',
    icon: '⚙',
    scale: 'SHELL // WM',
    desc: 'Switch ExoWebTUI palettes, live animated cell-canvas wallpapers, CRT scanlines & window tiling.',
    src: null,
    defaultRect: { x: 0.56, y: 0.08, w: 0.40, h: 0.74 }
  }
]);

const APP_BY_ID = new Map(ULG_DESKTOP_APPS.map((a) => [a.id, a]));
const CURATED_THEME_IDS = ['section9', 'midnight', 'amber', 'matrix', 'unit01', 'arcane', 'forge', 't2', 'paper'];
const CURATED_WALLPAPER_IDS = ['circuit', 'matrix', 'metaballs', 'rainy windows', 'vaporwave', 'biomech', 'fire', 'dots', 'plain'];

function rgbCss(rgb) {
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

function rgbaCss(rgb, a) {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})`;
}

function withEmbeddedParam(href) {
  try {
    const u = new URL(href, window.location.href);
    u.searchParams.set('embedded', 'exowebtui');
    if (u.pathname.endsWith('studio.html') || u.pathname.endsWith('index.html') || u.pathname.endsWith('pages.html')) {
      u.searchParams.set('studio', '1');
    }
    const base = u.pathname.split('/').pop() || 'universes.html';
    const targetBase = (base === 'studio.html' || base === 'pages.html') ? 'index.html' : base;
    return `./${targetBase}${u.search}${u.hash}`;
  } catch {
    return href;
  }
}

export function mountUlgExoWebTuiDesktop() {
  const tuiRoot = document.getElementById('exotui-canvas-root');
  const windowsLayer = document.getElementById('exo-windows-layer');
  const tabStrip = document.getElementById('exo-tab-strip');
  const startBtn = document.getElementById('exo-start-btn');
  const startMenu = document.getElementById('exo-start-menu');
  const desktopIcons = document.getElementById('exo-desktop-icons');
  const mobileDock = document.getElementById('exo-mobile-dock');
  const mobileActiveTitle = document.getElementById('exo-mobile-active-title');
  const tileBtn = document.getElementById('exo-tile-btn');
  const cascadeBtn = document.getElementById('exo-cascade-btn');
  const crtBtn = document.getElementById('exo-crt-btn');
  const consoleBtn = document.getElementById('exo-console-btn');
  const clockEl = document.getElementById('exo-clock');

  // --- ExoWebTUI Theme & Wallpaper State ---
  let activeThemeSpec = shellThemeById('section9');
  let activeWallpaperId = 'circuit';
  let crtEnabled = false;
  let layoutMode = 'floating'; // 'floating' | 'tiled'
  let startMenuOpen = false;
  let zCounter = 40;

  try {
    const savedThemeId = window.localStorage?.getItem('ulg-exowebtui-theme-id');
    if (savedThemeId) activeThemeSpec = shellThemeById(savedThemeId);
    const savedWall = window.localStorage?.getItem('ulg-exowebtui-wallpaper-id');
    if (savedWall) activeWallpaperId = savedWall;
    const savedCrt = window.localStorage?.getItem('ulg-exowebtui-crt');
    if (savedCrt === '1') crtEnabled = true;
  } catch {
    // Ignore storage errors in restricted contexts.
  }

  // --- Real @exotui TiledWorkspace + WorkbenchWindowHost Controller ---
  const workspace = createTiledWorkspaceController({});
  const windowHost = createWorkbenchWindowHostController({
    workspace,
    ownerId: 'ulg-exowebtui-desktop',
    snapDistance: 2,
    snapOnRelease: true,
    historyCapacity: 64,
    compactMode: 'auto',
    windows: ULG_DESKTOP_APPS.map((app, index) => ({
      id: app.id,
      title: app.title,
      minWidth: 28,
      minHeight: 10,
      state: 'closed',
      placement: 'floating',
      floatingRect: {
        column: 3 + index * 3,
        row: 1 + index * 2,
        width: 72,
        height: 26
      }
    }))
  });

  // Pixel window records synchronized with ExoWebTUI windowHost state
  const winStates = new Map();
  for (const app of ULG_DESKTOP_APPS) {
    winStates.set(app.id, {
      id: app.id,
      open: false,
      minimized: false,
      maximized: false,
      z: ++zCounter,
      rectPx: null,
      el: null,
      iframe: null,
      currentSrc: app.src
    });
  }
  let activeWinId = null;

  const isMobileViewport = () => window.innerWidth < 680;

  function workspaceDims() {
    const r = windowsLayer.getBoundingClientRect();
    return {
      width: Math.max(240, Math.round(r.width)),
      height: Math.max(200, Math.round(r.height))
    };
  }

  function themePayload() {
    return {
      id: activeThemeSpec.id,
      label: activeThemeSpec.label,
      background: activeThemeSpec.background,
      surface: activeThemeSpec.surface,
      surfaceStrong: activeThemeSpec.surfaceStrong,
      border: activeThemeSpec.border,
      text: activeThemeSpec.text,
      muted: activeThemeSpec.muted,
      accent: activeThemeSpec.accent,
      success: activeThemeSpec.success,
      warning: activeThemeSpec.warning,
      danger: activeThemeSpec.danger,
      crt: crtEnabled
    };
  }

  function broadcastThemeToIframes() {
    const payload = themePayload();
    for (const st of winStates.values()) {
      if (st.iframe?.contentWindow) {
        try {
          st.iframe.contentWindow.postMessage({ type: 'ulg-exowebtui-theme', theme: payload }, '*');
        } catch {
          // Ignore cross-origin or unloading frame errors.
        }
      }
    }
  }

  function applyTheme(themeId) {
    activeThemeSpec = shellThemeById(themeId);
    const onAccent = shellActiveTitlebarForeground(activeThemeSpec);
    const r = document.documentElement.style;
    r.setProperty('--exo-bg', rgbCss(activeThemeSpec.background));
    r.setProperty('--exo-surface', rgbCss(activeThemeSpec.surface));
    r.setProperty('--exo-surface-strong', rgbCss(activeThemeSpec.surfaceStrong));
    r.setProperty('--exo-border', rgbaCss(activeThemeSpec.accent, 0.42));
    r.setProperty('--exo-accent', rgbCss(activeThemeSpec.accent));
    r.setProperty('--exo-on-accent', rgbCss(onAccent));
    r.setProperty('--exo-text', rgbCss(activeThemeSpec.text));
    r.setProperty('--exo-muted', rgbCss(activeThemeSpec.muted));
    r.setProperty('--exo-danger', rgbCss(activeThemeSpec.danger));
    r.setProperty('--ulg-retro-bg', rgbCss(activeThemeSpec.background));
    r.setProperty('--ulg-retro-surface', rgbaCss(activeThemeSpec.surface, 0.94));
    r.setProperty('--ulg-retro-surface-strong', rgbaCss(activeThemeSpec.surfaceStrong, 0.97));
    r.setProperty('--ulg-retro-accent', rgbCss(activeThemeSpec.accent));
    r.setProperty('--ulg-retro-text', rgbCss(activeThemeSpec.text));
    r.setProperty('--ulg-retro-muted', rgbCss(activeThemeSpec.muted));
    r.setProperty('--ulg-retro-border', rgbaCss(activeThemeSpec.accent, 0.38));
    r.setProperty('--ulg-retro-border-hi', rgbaCss(activeThemeSpec.accent, 0.80));
    try {
      window.localStorage?.setItem('ulg-exowebtui-theme-id', activeThemeSpec.id);
      window.localStorage?.setItem('ulg-exowebtui-theme-json', JSON.stringify(themePayload()));
    } catch {
      // Ignore storage error.
    }
    broadcastThemeToIframes();
    renderConsoleWindow();
    renderStartMenu();
  }

  function setCrt(enabled) {
    crtEnabled = Boolean(enabled);
    document.documentElement.dataset.ulgCrt = crtEnabled ? '1' : '0';
    crtBtn.classList.toggle('active', crtEnabled);
    try {
      window.localStorage?.setItem('ulg-exowebtui-crt', crtEnabled ? '1' : '0');
    } catch {
      // Ignore storage error.
    }
    broadcastThemeToIframes();
    renderConsoleWindow();
  }

  // --- Real ExoWebTUI Cell-Canvas Wallpaper Engine ---
  let bgField = null;
  let bgFieldId = '';
  let bgCells = null;
  let bgCellsKey = '';
  let lastBgTickMs = 0;
  let presentedSize = { columns: 100, rows: 32 };

  function ensureBackgroundField() {
    if (bgFieldId === activeWallpaperId) return bgField;
    if (bgField && typeof bgField.dispose === 'function') {
      try { bgField.dispose(); } catch {}
    }
    bgFieldId = activeWallpaperId;
    bgCells = null;
    bgCellsKey = '';
    if (activeWallpaperId === 'plain' || activeWallpaperId === 'dots') {
      bgField = null;
      return null;
    }
    const entry = SHELL_BACKGROUND_FIELDS.find((e) => e.id === activeWallpaperId)
      || SHELL_BACKGROUND_FIELDS.find((e) => e.id === 'circuit');
    bgField = entry ? entry.create() : null;
    return bgField;
  }

  function setWallpaper(id) {
    activeWallpaperId = id;
    try {
      window.localStorage?.setItem('ulg-exowebtui-wallpaper-id', id);
    } catch {}
    ensureBackgroundField();
    renderConsoleWindow();
  }

  const wallpaperTheme = resolveVisualizationTheme({});
  let shellHandle = null;
  if (tuiRoot) {
    try {
      const presenter = webPresenter({
        root: tuiRoot,
        storeDatabase: 'ulg-exowebtui',
        host: {
          sinkOptions: {
            cellWidth: 9,
            cellHeight: 18,
            font: '14px "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
          }
        }
      });
      shellHandle = runShellApp(presenter, {
        init(p) {
          presentedSize = p?.size?.() || presentedSize;
        },
        resize(size) {
          presentedSize = size;
          bgCells = null;
        },
        frame(now, size) {
          if (size && size.columns > 0 && size.rows > 0) {
            presentedSize = size;
          }
          const width = Math.max(10, presentedSize.columns);
          const height = Math.max(6, presentedSize.rows);
          const frame = screenFrame({ width, height }, wallpaperTheme);
          const bg = activeThemeSpec.background;
          const dot = activeThemeSpec.surfaceStrong;
          for (let r = 0; r < height; r += 1) {
            const line = frame[r];
            for (let c = 0; c < width; c += 1) {
              line[c] = { char: ' ', background: bg };
            }
          }
          // Skip heavy wallpaper field simulation when a maximized/mobile window covers the desktop
          const openList = [...winStates.values()].filter((w) => w.open && !w.minimized);
          const fullyCovered = isMobileViewport()
            ? openList.length > 0
            : openList.some((w) => w.maximized);
          if (fullyCovered) return frame;
          if (activeWallpaperId === 'dots') {
            for (let r = 1; r < height; r += 3) {
              for (let c = r % 2 === 0 ? 2 : 4; c < width; c += 6) {
                frame[r][c] = { char: '·', foreground: dot, background: bg };
              }
            }
          } else if (activeWallpaperId !== 'plain') {
            const field = ensureBackgroundField();
            if (field) {
              const bounds = { column: 0, row: 0, width, height };
              let advanced = false;
              if (now - lastBgTickMs >= 140) {
                lastBgTickMs = now;
                advanced = field.advance({ bounds, obstacles: [], now });
              }
              const key = `${activeWallpaperId}|${activeThemeSpec.id}|${width}x${height}`;
              if (advanced || !bgCells || bgCellsKey !== key) {
                bgCells = field.rasterizeCells(bounds, activeThemeSpec);
                bgCellsKey = key;
              }
              if (bgCells) {
                for (let r = 0; r < bgCells.length && r < height; r += 1) {
                  const srcLine = bgCells[r];
                  const dstLine = frame[r];
                  if (!srcLine || !dstLine) continue;
                  for (let c = 0; c < srcLine.length && c < width; c += 1) {
                    const cell = srcLine[c];
                    if (!cell) continue;
                    dstLine[c] = cell.char === '█'
                      ? { char: ' ', background: cell.foreground }
                      : { char: cell.char, foreground: cell.foreground, background: bg };
                  }
                }
              }
            }
          }
          return frame;
        }
      });
    } catch (err) {
      console.warn('ExoWebTUI cell-canvas wallpaper fallback:', err);
    }
  }

  // --- Window Management Helpers ---
  function clampRect(rect) {
    const { width: W, height: H } = workspaceDims();
    const minW = Math.min(340, W);
    const minH = Math.min(240, H);
    const w = Math.max(minW, Math.min(W, Math.round(rect.w)));
    const h = Math.max(minH, Math.min(H, Math.round(rect.h)));
    const x = Math.max(0, Math.min(Math.max(0, W - w), Math.round(rect.x)));
    const y = Math.max(0, Math.min(Math.max(0, H - h), Math.round(rect.y)));
    return { x, y, w, h };
  }

  function defaultRectFor(app) {
    const { width: W, height: H } = workspaceDims();
    const openCount = [...winStates.values()].filter((w) => w.open).length;
    const shift = (openCount % 5) * 26;
    const d = app.defaultRect;
    return clampRect({
      x: Math.round(W * d.x) + shift,
      y: Math.round(H * d.y) + shift,
      w: Math.round(W * d.w),
      h: Math.round(H * d.h)
    });
  }

  function syncExoHostBounds(id, stateObj) {
    const cols = Math.max(40, presentedSize.columns || 120);
    const rows = Math.max(16, presentedSize.rows || 40);
    const bounds = { column: 0, row: 0, width: cols, height: rows };
    try {
      if (!stateObj.open) {
        windowHost.execute({ kind: 'close', id }, bounds, {});
        return;
      }
      if (stateObj.minimized) {
        windowHost.execute({ kind: 'minimize', id }, bounds, {});
        return;
      }
      windowHost.execute({ kind: 'restore', id }, bounds, {});
      if (stateObj.maximized || isMobileViewport()) {
        windowHost.execute({ kind: 'maximize', id }, bounds, {});
      } else if (layoutMode === 'tiled') {
        windowHost.execute({ kind: 'set-placement', id, placement: 'tiled' }, bounds, {});
      } else if (stateObj.rectPx) {
        const { width: W, height: H } = workspaceDims();
        const rectCells = {
          column: Math.round((stateObj.rectPx.x / W) * cols),
          row: Math.round((stateObj.rectPx.y / H) * rows),
          width: Math.max(28, Math.round((stateObj.rectPx.w / W) * cols)),
          height: Math.max(10, Math.round((stateObj.rectPx.h / H) * rows))
        };
        windowHost.execute({ kind: 'set-placement', id, placement: 'floating', rect: rectCells }, bounds, {});
      }
      if (activeWinId === id) {
        windowHost.execute({ kind: 'focus', id }, bounds, {});
      }
    } catch {
      // Never block DOM rendering on host bounds edge cases.
    }
  }

  function buildConsoleDom() {
    const wrap = document.createElement('div');
    wrap.className = 'exo-console-body';
    wrap.id = 'exo-console-content';
    return wrap;
  }

  function renderConsoleWindow() {
    const el = document.getElementById('exo-console-content');
    if (!el) return;
    const openWindows = [...winStates.values()].filter((w) => w.open);
    const themeBtns = CURATED_THEME_IDS.map((tid) => {
      const spec = shellThemeById(tid);
      const isAct = spec.id === activeThemeSpec.id;
      return `<button type="button" class="exo-bar-btn ${isAct ? 'active' : ''}" data-exo-theme="${spec.id}">${spec.label}</button>`;
    }).join('');
    const wallBtns = CURATED_WALLPAPER_IDS.map((wid) => {
      const isAct = wid === activeWallpaperId;
      return `<button type="button" class="exo-bar-btn ${isAct ? 'active' : ''}" data-exo-wall="${wid}">${wid}</button>`;
    }).join('');
    const labBtns = ULG_DESKTOP_APPS.filter((a) => a.id !== 'console').map((a) => {
      const st = winStates.get(a.id);
      const tag = st.open ? (st.minimized ? 'MIN' : 'OPEN') : 'LAUNCH';
      return `<button type="button" class="exo-bar-btn ${st.open && !st.minimized ? 'active' : ''}" data-exo-launch="${a.id}">${a.icon} ${a.shortLabel} [${tag}]</button>`;
    }).join('');

    el.innerHTML = `
      <div class="exo-console-sec">
        <h3>▣ ULG // EXOWEB TUI WORKSPACE</h3>
        <div style="color:var(--exo-muted);margin-bottom:8px;">
          Open Windows: <b style="color:var(--exo-text);">${openWindows.length}</b> ·
          Layout: <b style="color:var(--exo-accent);">${isMobileViewport() ? 'MOBILE SINGLE-WINDOW' : layoutMode.toUpperCase()}</b> ·
          Theme: <b style="color:var(--exo-text);">${activeThemeSpec.label}</b> ·
          CRT: <b style="color:var(--exo-text);">${crtEnabled ? 'ON' : 'OFF'}</b>
        </div>
        <div class="exo-chip-grid">
          <button type="button" class="exo-bar-btn" data-exo-act="tile">⊞ Tile Open Labs</button>
          <button type="button" class="exo-bar-btn" data-exo-act="cascade">❐ Cascade Floating</button>
          <button type="button" class="exo-bar-btn ${crtEnabled ? 'active' : ''}" data-exo-act="crt">📺 CRT Scanlines: ${crtEnabled ? 'ON' : 'OFF'}</button>
          <a class="exo-bar-btn" href="./index.html" style="text-decoration:none;">↩ Landing Page</a>
        </div>
      </div>
      <div class="exo-console-sec">
        <h3>✦ QUICK LAUNCH ULG WEBGPU LABS</h3>
        <div class="exo-chip-grid">${labBtns}</div>
      </div>
      <div class="exo-console-sec">
        <h3>🎨 EXOWEB TUI SHELL THEME (SYNCS LIVE TO ALL LABS)</h3>
        <div class="exo-chip-grid">${themeBtns}</div>
      </div>
      <div class="exo-console-sec">
        <h3>▒ ANIMATED TUI CELL WALLPAPER</h3>
        <div class="exo-chip-grid">${wallBtns}</div>
      </div>
    `;
    el.querySelectorAll('[data-exo-theme]').forEach((btn) => {
      btn.addEventListener('click', () => applyTheme(btn.dataset.exoTheme));
    });
    el.querySelectorAll('[data-exo-wall]').forEach((btn) => {
      btn.addEventListener('click', () => setWallpaper(btn.dataset.exoWall));
    });
    el.querySelectorAll('[data-exo-launch]').forEach((btn) => {
      btn.addEventListener('click', () => openLab(btn.dataset.exoLaunch));
    });
    el.querySelector('[data-exo-act="tile"]')?.addEventListener('click', () => tileAll());
    el.querySelector('[data-exo-act="cascade"]')?.addEventListener('click', () => cascadeAll());
    el.querySelector('[data-exo-act="crt"]')?.addEventListener('click', () => setCrt(!crtEnabled));
  }

  function ensureWindowDom(id) {
    const st = winStates.get(id);
    const app = APP_BY_ID.get(id);
    if (!st || !app) return null;
    if (st.el) return st.el;

    const winEl = document.createElement('section');
    winEl.className = 'exo-win';
    winEl.dataset.winId = id;
    winEl.setAttribute('aria-label', app.title);

    const titlebar = document.createElement('div');
    titlebar.className = 'exo-win-titlebar';
    titlebar.innerHTML = `
      <span class="exo-win-title-text"><span>${app.icon}</span><span>${app.title}</span></span>
      <span class="exo-win-controls">
        <button type="button" class="exo-win-ctl min" title="Minimize window" aria-label="Minimize ${app.title}">─</button>
        <button type="button" class="exo-win-ctl max" title="Maximize / Restore" aria-label="Maximize ${app.title}">□</button>
        <button type="button" class="exo-win-ctl close" title="Close window" aria-label="Close ${app.title}">×</button>
      </span>
    `;

    const body = document.createElement('div');
    body.className = 'exo-win-body';

    if (app.src) {
      const iframe = document.createElement('iframe');
      iframe.className = 'exo-win-iframe';
      iframe.title = app.title;
      iframe.allow = 'fullscreen; xr-spatial-tracking; gamepad';
      iframe.src = withEmbeddedParam(st.currentSrc || app.src);
      iframe.addEventListener('load', () => {
        try {
          iframe.contentWindow?.postMessage({ type: 'ulg-exowebtui-theme', theme: themePayload() }, '*');
        } catch {}
      });
      body.appendChild(iframe);
      st.iframe = iframe;
    } else {
      body.appendChild(buildConsoleDom());
    }

    const focusShield = document.createElement('div');
    focusShield.className = 'exo-win-focus-shield';
    focusShield.addEventListener('pointerdown', (ev) => {
      ev.stopPropagation();
      focusLab(id);
    });
    body.appendChild(focusShield);

    const rE = document.createElement('div');
    rE.className = 'exo-resize-handle exo-resize-e';
    const rS = document.createElement('div');
    rS.className = 'exo-resize-handle exo-resize-s';
    const rSE = document.createElement('div');
    rSE.className = 'exo-resize-handle exo-resize-se';

    winEl.append(titlebar, body, rE, rS, rSE);
    windowsLayer.appendChild(winEl);
    st.el = winEl;

    // Titlebar button controls
    titlebar.querySelector('.min').addEventListener('click', (ev) => {
      ev.stopPropagation();
      minimizeLab(id);
    });
    titlebar.querySelector('.max').addEventListener('click', (ev) => {
      ev.stopPropagation();
      toggleMaximizeLab(id);
    });
    titlebar.querySelector('.close').addEventListener('click', (ev) => {
      ev.stopPropagation();
      closeLab(id);
    });
    titlebar.addEventListener('dblclick', (ev) => {
      if (ev.target.closest('.exo-win-ctl')) return;
      toggleMaximizeLab(id);
    });

    // Pointer drag on titlebar
    titlebar.addEventListener('pointerdown', (ev) => {
      if (ev.target.closest('.exo-win-ctl') || isMobileViewport()) return;
      focusLab(id);
      if (st.maximized || layoutMode === 'tiled') {
        layoutMode = 'floating';
        st.maximized = false;
        if (!st.rectPx) st.rectPx = defaultRectFor(app);
      }
      const startX = ev.clientX;
      const startY = ev.clientY;
      const startRect = { ...st.rectPx };
      document.body.classList.add('exo-dragging');
      titlebar.setPointerCapture?.(ev.pointerId);

      const onMove = (mEv) => {
        const dx = mEv.clientX - startX;
        const dy = mEv.clientY - startY;
        st.rectPx = clampRect({
          x: startRect.x + dx,
          y: startRect.y + dy,
          w: startRect.w,
          h: startRect.h
        });
        applyLayout();
      };
      const onUp = () => {
        document.body.classList.remove('exo-dragging');
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        syncExoHostBounds(id, st);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    });

    // Pointer resize handles
    function bindResize(handleEl, edges) {
      handleEl.addEventListener('pointerdown', (ev) => {
        if (isMobileViewport() || st.maximized || layoutMode === 'tiled') return;
        ev.stopPropagation();
        focusLab(id);
        const startX = ev.clientX;
        const startY = ev.clientY;
        const startRect = { ...st.rectPx };
        document.body.classList.add('exo-dragging');
        const onMove = (mEv) => {
          const dx = mEv.clientX - startX;
          const dy = mEv.clientY - startY;
          st.rectPx = clampRect({
            x: startRect.x,
            y: startRect.y,
            w: edges.includes('e') ? startRect.w + dx : startRect.w,
            h: edges.includes('s') ? startRect.h + dy : startRect.h
          });
          applyLayout();
        };
        const onUp = () => {
          document.body.classList.remove('exo-dragging');
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          window.removeEventListener('pointercancel', onUp);
          syncExoHostBounds(id, st);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
      });
    }
    bindResize(rE, 'e');
    bindResize(rS, 's');
    bindResize(rSE, 'se');

    if (id === 'console') renderConsoleWindow();
    return winEl;
  }

  function applyLayout() {
    const { width: W, height: H } = workspaceDims();
    const mobile = isMobileViewport();
    const visibleWins = [...winStates.values()]
      .filter((w) => w.open && !w.minimized)
      .sort((a, b) => a.z - b.z);

    if (mobile) {
      // Single-window edge-to-edge mobile viewport mode!
      if ((!activeWinId || !winStates.get(activeWinId)?.open || winStates.get(activeWinId)?.minimized) && visibleWins.length > 0) {
        activeWinId = visibleWins[visibleWins.length - 1].id;
      }
      for (const st of winStates.values()) {
        if (!st.el) continue;
        const show = st.open && !st.minimized && st.id === activeWinId;
        st.el.classList.toggle('hidden-win', !show);
        st.el.classList.toggle('active', show);
        st.el.classList.add('maximized');
        st.el.classList.remove('tiled');
        if (show) {
          st.el.style.left = '0px';
          st.el.style.top = '0px';
          st.el.style.width = `${W}px`;
          st.el.style.height = `${H}px`;
          st.el.style.zIndex = '60';
        }
      }
      const actApp = APP_BY_ID.get(activeWinId);
      if (mobileActiveTitle) {
        mobileActiveTitle.textContent = actApp ? `${actApp.icon} ${actApp.shortLabel.toUpperCase()}` : 'ULG // EXOWEB TUI';
      }
    } else if (layoutMode === 'tiled' && visibleWins.length > 0) {
      // Deterministic clean tiled grid with zero dead space
      const n = visibleWins.length;
      const cols = n === 1 ? 1 : 2;
      const rows = Math.ceil(n / cols);
      const gap = 4;
      const cellW = Math.floor((W - gap * (cols + 1)) / cols);
      const cellH = Math.floor((H - gap * (rows + 1)) / rows);
      visibleWins.forEach((st, idx) => {
        if (!st.el) return;
        const c = idx % cols;
        const r = Math.floor(idx / cols);
        const isLastOdd = (idx === n - 1) && (n % cols === 1) && cols > 1;
        const w = isLastOdd ? (W - gap * 2) : cellW;
        const x = gap + c * (cellW + gap);
        const y = gap + r * (cellH + gap);
        st.el.classList.remove('hidden-win', 'maximized');
        st.el.classList.add('tiled');
        st.el.classList.toggle('active', st.id === activeWinId);
        st.el.style.left = `${x}px`;
        st.el.style.top = `${y}px`;
        st.el.style.width = `${w}px`;
        st.el.style.height = `${cellH}px`;
        st.el.style.zIndex = String(st.id === activeWinId ? 80 : 40 + idx);
      });
      for (const st of winStates.values()) {
        if (st.el && (!st.open || st.minimized)) {
          st.el.classList.add('hidden-win');
        }
      }
    } else {
      // Floating / Maximized windows
      for (const st of winStates.values()) {
        if (!st.el) continue;
        if (!st.open || st.minimized) {
          st.el.classList.add('hidden-win');
          continue;
        }
        st.el.classList.remove('hidden-win', 'tiled');
        st.el.classList.toggle('active', st.id === activeWinId);
        st.el.classList.toggle('maximized', st.maximized);
        if (st.maximized) {
          st.el.style.left = '0px';
          st.el.style.top = '0px';
          st.el.style.width = `${W}px`;
          st.el.style.height = `${H}px`;
        } else {
          if (!st.rectPx) st.rectPx = defaultRectFor(APP_BY_ID.get(st.id));
          st.rectPx = clampRect(st.rectPx);
          st.el.style.left = `${st.rectPx.x}px`;
          st.el.style.top = `${st.rectPx.y}px`;
          st.el.style.width = `${st.rectPx.w}px`;
          st.el.style.height = `${st.rectPx.h}px`;
        }
        st.el.style.zIndex = String(st.z);
      }
    }

    tileBtn?.classList.toggle('active', layoutMode === 'tiled');
    cascadeBtn?.classList.toggle('active', layoutMode === 'floating');
    renderTaskbars();
  }

  function renderTaskbars() {
    const openWins = [...winStates.values()].filter((w) => w.open);

    // Desktop top taskbar tabs
    if (tabStrip) {
      tabStrip.innerHTML = '';
      for (const st of openWins) {
        const app = APP_BY_ID.get(st.id);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `exo-tab-btn${st.id === activeWinId && !st.minimized ? ' active' : ''}${st.minimized ? ' minimized' : ''}`;
        btn.dataset.tabWinId = st.id;
        btn.textContent = `${app.icon} ${app.shortLabel}${st.minimized ? ' [min]' : ''}`;
        btn.addEventListener('click', () => {
          if (st.id === activeWinId && !st.minimized && !isMobileViewport()) {
            minimizeLab(st.id);
          } else {
            focusLab(st.id);
          }
        });
        tabStrip.appendChild(btn);
      }
    }

    // Mobile bottom switcher dock (quick 1-tap jump across all labs!)
    if (mobileDock) {
      mobileDock.innerHTML = '';
      for (const app of ULG_DESKTOP_APPS.filter((a) => a.id !== 'console')) {
        const st = winStates.get(app.id);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `exo-dock-btn${st.open && !st.minimized && activeWinId === app.id ? ' active' : ''}`;
        btn.dataset.dockLabId = app.id;
        btn.textContent = `${app.icon} ${app.shortLabel}`;
        btn.addEventListener('click', () => openLab(app.id));
        mobileDock.appendChild(btn);
      }
    }
  }

  function renderDesktopIcons() {
    if (!desktopIcons) return;
    desktopIcons.innerHTML = '';
    for (const app of ULG_DESKTOP_APPS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'exo-desktop-icon';
      btn.dataset.iconLabId = app.id;
      btn.innerHTML = `<span class="ico">${app.icon}</span><span>${app.shortLabel}</span>`;
      btn.addEventListener('click', () => openLab(app.id));
      desktopIcons.appendChild(btn);
    }
  }

  function setStartMenuOpen(next) {
    startMenuOpen = Boolean(next);
    startMenu.classList.toggle('open', startMenuOpen);
    startBtn.setAttribute('aria-expanded', String(startMenuOpen));
    document.body.classList.toggle('exo-menu-open', startMenuOpen);
    if (startMenuOpen) renderStartMenu();
  }

  function renderStartMenu() {
    if (!startMenu) return;
    const labItemsHtml = ULG_DESKTOP_APPS.map((app) => {
      const st = winStates.get(app.id);
      const badge = st.open ? (st.minimized ? 'MINIMIZED' : '● OPEN') : app.scale;
      return `
        <button type="button" class="exo-menu-item" data-menu-lab="${app.id}">
          <span class="exo-menu-item-top"><span>${app.icon} ${app.title}</span><span class="tag">${badge}</span></span>
          <span class="exo-menu-item-desc">${app.desc}</span>
        </button>
      `;
    }).join('');

    startMenu.innerHTML = `
      <div class="exo-menu-hdr">
        <span>⏻ ULG // EXOWEB TUI LAUNCHER</span>
        <span>${activeThemeSpec.label}</span>
      </div>
      <div class="exo-menu-section">Physics Labs &amp; Simulators</div>
      ${labItemsHtml}
      <div class="exo-menu-section">Workspace Actions</div>
      <button type="button" class="exo-menu-item" data-menu-action="tile-dual">
        <span class="exo-menu-item-top"><span>⊞ Tiled Workspace: Universes + Elements</span><span class="tag">SPLIT</span></span>
        <span class="exo-menu-item-desc">Run astrophysics &amp; quantum/material physics side-by-side.</span>
      </button>
      <button type="button" class="exo-menu-item" data-menu-action="tile-all">
        <span class="exo-menu-item-top"><span>⊞ Tile All Open Windows</span><span class="tag">GRID</span></span>
        <span class="exo-menu-item-desc">Arrange every running lab window into a clean zero-overlap grid.</span>
      </button>
      <a class="exo-menu-item" href="./index.html">
        <span class="exo-menu-item-top"><span>↩ Return to ULG Landing Gate</span><span class="tag">EXIT</span></span>
        <span class="exo-menu-item-desc">Back to standalone lab launcher &amp; Continuum Studio entry.</span>
      </a>
    `;

    startMenu.querySelectorAll('[data-menu-lab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        setStartMenuOpen(false);
        openLab(btn.dataset.menuLab);
      });
    });
    startMenu.querySelector('[data-menu-action="tile-dual"]')?.addEventListener('click', () => {
      setStartMenuOpen(false);
      openLab('universes');
      openLab('elements');
      tileAll();
    });
    startMenu.querySelector('[data-menu-action="tile-all"]')?.addEventListener('click', () => {
      setStartMenuOpen(false);
      tileAll();
    });
  }

  function focusLab(id) {
    const st = winStates.get(id);
    if (!st || !st.open) return;
    st.minimized = false;
    st.z = ++zCounter;
    activeWinId = id;
    syncExoHostBounds(id, st);
    applyLayout();
    renderConsoleWindow();
  }

  function openLab(id, customHref = null) {
    const st = winStates.get(id);
    const app = APP_BY_ID.get(id);
    if (!st || !app) return false;
    if (customHref && app.src) {
      const nextSrc = withEmbeddedParam(customHref);
      if (st.currentSrc !== nextSrc) {
        st.currentSrc = nextSrc;
        if (st.iframe) st.iframe.src = nextSrc;
      }
    }
    if (!st.open) {
      st.open = true;
      st.minimized = false;
      st.maximized = isMobileViewport();
      if (!st.rectPx) st.rectPx = defaultRectFor(app);
      ensureWindowDom(id);
    } else {
      st.minimized = false;
    }
    st.z = ++zCounter;
    activeWinId = id;
    syncExoHostBounds(id, st);
    applyLayout();
    renderConsoleWindow();
    return true;
  }

  function minimizeLab(id) {
    const st = winStates.get(id);
    if (!st || !st.open) return;
    st.minimized = true;
    if (activeWinId === id) {
      const next = [...winStates.values()]
        .filter((w) => w.open && !w.minimized)
        .sort((a, b) => b.z - a.z)[0];
      activeWinId = next ? next.id : null;
    }
    syncExoHostBounds(id, st);
    applyLayout();
    renderConsoleWindow();
  }

  function toggleMaximizeLab(id) {
    const st = winStates.get(id);
    if (!st || !st.open) return;
    if (layoutMode === 'tiled') {
      layoutMode = 'floating';
      st.maximized = true;
    } else {
      st.maximized = !st.maximized;
    }
    st.minimized = false;
    st.z = ++zCounter;
    activeWinId = id;
    syncExoHostBounds(id, st);
    applyLayout();
  }

  function closeLab(id) {
    const st = winStates.get(id);
    if (!st || !st.open) return;
    st.open = false;
    st.minimized = false;
    st.maximized = false;
    if (st.el) {
      st.el.remove();
      st.el = null;
      st.iframe = null;
    }
    if (activeWinId === id) {
      const next = [...winStates.values()]
        .filter((w) => w.open && !w.minimized)
        .sort((a, b) => b.z - a.z)[0];
      activeWinId = next ? next.id : null;
    }
    syncExoHostBounds(id, st);
    applyLayout();
    renderConsoleWindow();
  }

  function tileAll() {
    layoutMode = 'tiled';
    for (const st of winStates.values()) {
      if (st.open) {
        st.minimized = false;
        st.maximized = false;
        syncExoHostBounds(st.id, st);
      }
    }
    applyLayout();
    renderConsoleWindow();
  }

  function cascadeAll() {
    layoutMode = 'floating';
    const { width: W, height: H } = workspaceDims();
    let idx = 0;
    for (const st of winStates.values()) {
      if (!st.open) continue;
      st.minimized = false;
      st.maximized = false;
      const app = APP_BY_ID.get(st.id);
      st.rectPx = clampRect({
        x: 24 + idx * 34,
        y: 18 + idx * 28,
        w: Math.round(W * Math.min(0.76, app.defaultRect.w)),
        h: Math.round(H * Math.min(0.84, app.defaultRect.h))
      });
      st.z = ++zCounter;
      activeWinId = st.id;
      syncExoHostBounds(st.id, st);
      idx += 1;
    }
    applyLayout();
    renderConsoleWindow();
  }

  // --- Wire Controls, Clock, Cross-Lab Messages & Keyboard Shortcuts ---
  startBtn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    setStartMenuOpen(!startMenuOpen);
  });
  tileBtn.addEventListener('click', () => {
    setStartMenuOpen(false);
    tileAll();
  });
  cascadeBtn.addEventListener('click', () => {
    setStartMenuOpen(false);
    cascadeAll();
  });
  crtBtn.addEventListener('click', () => setCrt(!crtEnabled));
  consoleBtn.addEventListener('click', () => {
    setStartMenuOpen(false);
    const st = winStates.get('console');
    if (st.open && !st.minimized && activeWinId === 'console') {
      closeLab('console');
    } else {
      openLab('console');
    }
  });

  document.addEventListener('pointerdown', (ev) => {
    if (startMenuOpen && !ev.target.closest('#exo-start-menu') && !ev.target.closest('#exo-start-btn')) {
      setStartMenuOpen(false);
    }
  });

  window.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && startMenuOpen) {
      setStartMenuOpen(false);
    }
  });

  window.addEventListener('resize', () => applyLayout());

  window.addEventListener('message', (event) => {
    const data = event?.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'ulg-exowebtui-open-lab' && data.labId) {
      openLab(String(data.labId), data.href || null);
    } else if (data.type === 'ulg-exowebtui-ready') {
      broadcastThemeToIframes();
    }
  });

  const updateClock = () => {
    if (!clockEl) return;
    clockEl.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  updateClock();
  window.setInterval(updateClock, 15000);

  // --- Initial Boot ---
  renderDesktopIcons();
  applyTheme(activeThemeSpec.id);
  setCrt(crtEnabled);

  const params = new URLSearchParams(window.location.search);
  const openParam = params.get('open');
  const layoutParam = params.get('layout');
  const themeParam = params.get('theme');
  if (themeParam) applyTheme(themeParam);
  if (params.get('crt') === '1') setCrt(true);

  const initialLabs = openParam
    ? openParam.split(',').map((s) => s.trim()).filter((id) => APP_BY_ID.has(id))
    : ['universes'];
  const toOpen = initialLabs.length > 0 ? initialLabs : ['universes'];
  for (const labId of toOpen) {
    openLab(labId);
  }
  if (layoutParam === 'tile' && !isMobileViewport()) {
    tileAll();
  } else if (toOpen.length === 1 && !isMobileViewport()) {
    // Open the single default lab comfortably filling ~92% of the workspace so you can see the retro ExoWebTUI frame & icons
    const st = winStates.get(toOpen[0]);
    const { width: W, height: H } = workspaceDims();
    st.rectPx = clampRect({ x: 132, y: 12, w: Math.max(600, W - 148), h: Math.max(420, H - 24) });
    applyLayout();
  }

  const api = {
    openLab,
    closeLab,
    focusLab,
    minimizeLab,
    toggleMaximizeLab,
    tileAll,
    cascadeAll,
    setTheme: applyTheme,
    setWallpaper,
    setCrt,
    setStartMenuOpen,
    getState: () => ({
      activeWinId,
      layoutMode,
      mobile: isMobileViewport(),
      themeId: activeThemeSpec.id,
      wallpaperId: activeWallpaperId,
      crtEnabled,
      startMenuOpen,
      hostInspection: windowHost.controller.inspect(),
      windows: [...winStates.values()].map((w) => ({
        id: w.id,
        open: w.open,
        minimized: w.minimized,
        maximized: w.maximized,
        rectPx: w.rectPx
      }))
    }),
    dispose: () => {
      try { shellHandle?.dispose?.(); } catch {}
    }
  };
  window.__ulgExoWebTui = api;
  return api;
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => mountUlgExoWebTuiDesktop(), { once: true });
  } else {
    mountUlgExoWebTuiDesktop();
  }
}
