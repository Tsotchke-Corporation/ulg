// ULG ExoWebTUI Full Post-Processing Shader Stack (`src/demos/ulgDesktopShaderStack.js`).
//
// Consumes the canonical `@exotui` (`../exotui/src/web/canvas_shader.ts`) 5-pass
// Ghostty / Trinitron WebGL2 shader catalog (`vhs`, `crt`, `phosphor`, `scanlines`,
// `degauss`) plus every tunable knob, preset, magnetization gauge, and degauss coil
// thump — driving BOTH `@exotui`'s `presenter.shader` WebGL2 chain AND a unified
// full-desktop optical overlay & cross-lab iframe sync so every open ULG lab window
// shares the exact same retro CRT/VHS/phosphor/degauss presentation!

import { CANVAS_SHADERS } from '@exotui/src/web/canvas_shader.ts';

export const ULG_DESKTOP_SHADER_CATALOG = CANVAS_SHADERS;

export const ULG_DESKTOP_SHADER_STORAGE_KEY = 'ulg-exowebtui-shader-stack-v1';

export const ULG_DESKTOP_SHADER_PRESETS = Object.freeze([
  {
    id: 'clean',
    label: 'Clean (Off)',
    enabled: [],
    options: {}
  },
  {
    id: 'trinitron',
    label: 'Trinitron CRT',
    enabled: ['crt', 'phosphor', 'scanlines', 'degauss'],
    options: {
      crt: { curve: 0.04, vignette: 0.25, fringe: 0.0004 },
      phosphor: { glow: 0.75 },
      scanlines: { strength: 0.14, period: 3 },
      degauss: { rate: 0.02 }
    }
  },
  {
    id: 'phosphor-scan',
    label: 'Phosphor Scan',
    enabled: ['phosphor', 'scanlines'],
    options: {
      phosphor: { glow: 0.90 },
      scanlines: { strength: 0.14, period: 3 }
    }
  },
  {
    id: 'vhs-tape',
    label: 'VHS Tape',
    enabled: ['vhs', 'crt', 'scanlines'],
    options: {
      vhs: { tracking: 0.35, noise: 0.12, bleed: 1.25 },
      crt: { curve: 0.04, vignette: 0.30, fringe: 0.0008 },
      scanlines: { strength: 0.18, period: 3 }
    }
  },
  {
    id: 'full-stack',
    label: 'Full Stack (All 5)',
    enabled: ['vhs', 'crt', 'phosphor', 'scanlines', 'degauss'],
    options: {
      vhs: { tracking: 0.25, noise: 0.08, bleed: 0.75 },
      crt: { curve: 0.04, vignette: 0.25, fringe: 0.0004 },
      phosphor: { glow: 0.90 },
      scanlines: { strength: 0.14, period: 3 },
      degauss: { rate: 0.04 }
    }
  }
]);

const SHADER_BY_ID = new Map(CANVAS_SHADERS.map((def) => [def.id, def]));

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function getDefaultShaderStackState() {
  const options = {};
  for (const def of CANVAS_SHADERS) {
    const map = {};
    for (const opt of (def.options ?? [])) {
      map[opt.key] = opt.value;
    }
    options[def.id] = map;
  }
  return {
    enabled: [],
    options
  };
}

export function normalizeShaderStackState(raw = null) {
  const base = getDefaultShaderStackState();
  if (!raw || typeof raw !== 'object') return base;
  const enabledSet = new Set();
  if (Array.isArray(raw.enabled)) {
    for (const id of raw.enabled) {
      if (SHADER_BY_ID.has(id)) enabledSet.add(id);
    }
  }
  // Preserve strict @exotui catalog pass order!
  base.enabled = CANVAS_SHADERS.filter((d) => enabledSet.has(d.id)).map((d) => d.id);
  if (raw.options && typeof raw.options === 'object') {
    for (const def of CANVAS_SHADERS) {
      const src = raw.options[def.id];
      if (!src || typeof src !== 'object') continue;
      for (const opt of (def.options ?? [])) {
        const val = Number(src[opt.key]);
        if (Number.isFinite(val)) {
          base.options[def.id][opt.key] = clamp(val, opt.min, opt.max);
        }
      }
    }
  }
  return base;
}

/**
 * Mounts the full ULG ExoWebTUI shader stack controller synchronized to
 * `@exotui`'s `presenter.shader` WebGL2 chain AND a unified full-desktop
 * optical/VHS/CRT/phosphor/degauss overlay over all hosted lab windows.
 */
export function createUlgDesktopShaderStackController({
  presenterShader = null,
  overlayEl = null,
  workspaceEl = null,
  onStateChange = null
} = {}) {
  let state = getDefaultShaderStackState();
  let magnetism = 0.02;
  let degaussStartedMs = -Infinity;
  let lastTickMs = 0;
  let thumpSeq = 0;
  let rafId = 0;
  let disposed = false;

  // Lightweight animated overlay canvas for VHS tracking band + grain + Trinitron degauss sweep ring
  let fxCanvas = null;
  let fxCtx = null;
  if (overlayEl && typeof document !== 'undefined') {
    fxCanvas = document.createElement('canvas');
    fxCanvas.className = 'exo-shader-fx-canvas';
    fxCanvas.setAttribute('aria-hidden', 'true');
    overlayEl.appendChild(fxCanvas);
    fxCtx = fxCanvas.getContext('2d');
  }

  function syncToPresenterShader() {
    if (!presenterShader) return;
    try {
      for (const def of CANVAS_SHADERS) {
        const opts = state.options[def.id] || {};
        for (const opt of (def.options ?? [])) {
          const val = Number(opts[opt.key] ?? opt.value);
          presenterShader.setOption(def.id, opt.key, val);
        }
      }
      presenterShader.setEnabled(state.enabled);
    } catch {
      // Ignore WebGL context unavailability in headless environments.
    }
  }

  function effectiveMagnet() {
    if (presenterShader && typeof presenterShader.magnetism === 'function') {
      const pm = Number(presenterShader.magnetism());
      if (Number.isFinite(pm)) magnetism = pm;
    }
    return state.enabled.includes('degauss') ? clamp(magnetism, 0.02, 1.0) : 0.5;
  }

  function applyDesktopVisualOverlay(nowMs = performance.now()) {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const en = new Set(state.enabled);
    const hasAny = en.size > 0;
    const thumpAgeS = (nowMs - degaussStartedMs) / 1000;
    const thumpActive = thumpAgeS >= 0 && thumpAgeS < 1.35;
    const mag = effectiveMagnet();
    const magGain = en.has('degauss') ? (0.45 + mag * 1.55) : 1.0;

    root.dataset.ulgShaderActive = (hasAny || thumpActive) ? '1' : '0';
    root.dataset.ulgShaders = state.enabled.join(',');
    root.dataset.ulgCrt = (en.has('crt') || en.has('scanlines')) ? '1' : '0';

    const scanOpt = state.options.scanlines || {};
    const crtOpt = state.options.crt || {};
    const phosOpt = state.options.phosphor || {};
    const vhsOpt = state.options.vhs || {};

    const scanStrength = en.has('scanlines') ? clamp((scanOpt.strength ?? 0.14) * magGain, 0, 0.65) : 0;
    const scanPeriod = Math.max(2, Math.round(scanOpt.period ?? 3));
    const vignette = en.has('crt') ? clamp((crtOpt.vignette ?? 0.25) * magGain, 0, 0.85) : 0;
    const curve = en.has('crt') ? clamp(crtOpt.curve ?? 0.04, 0, 0.25) : 0;
    const fringePx = en.has('crt') ? clamp((crtOpt.fringe ?? 0.0004) * 1800 * magGain, 0, 4.5) : 0;
    const glow = en.has('phosphor') ? clamp((phosOpt.glow ?? 0.9) * (0.6 + 0.4 * magGain), 0, 2.2) : 0;
    const stain = en.has('degauss') ? clamp(mag * 0.42, 0, 0.48) : 0;

    const st = root.style;
    st.setProperty('--exo-scan-strength', scanStrength.toFixed(3));
    st.setProperty('--exo-scan-period', `${scanPeriod}px`);
    st.setProperty('--exo-crt-vignette', vignette.toFixed(3));
    st.setProperty('--exo-crt-radius', `${Math.round(curve * 110)}px`);
    st.setProperty('--exo-crt-fringe', `${fringePx.toFixed(2)}px`);
    st.setProperty('--exo-phosphor-glow', glow.toFixed(3));
    st.setProperty('--exo-degauss-stain', stain.toFixed(3));

    if (workspaceEl) {
      const filters = [];
      if (en.has('phosphor') && glow > 0.02) {
        const bright = 1.0 + glow * 0.06;
        const sat = 1.0 + glow * 0.12;
        filters.push(`brightness(${bright.toFixed(3)}) saturate(${sat.toFixed(3)})`);
      }
      if (en.has('vhs')) {
        const bleed = clamp(vhsOpt.bleed ?? 1.0, 0, 3.0);
        if (bleed > 0.05) {
          filters.push(`contrast(${(1.0 + bleed * 0.03).toFixed(3)})`);
        }
      }
      workspaceEl.style.filter = filters.length ? filters.join(' ') : '';

      if (thumpActive) {
        const settle = Math.exp(-2.6 * thumpAgeS);
        const wob = Math.sin(thumpAgeS * 34.0) * settle;
        const rotDeg = wob * 1.8;
        const scale = 1.0 + wob * 0.022;
        const skewDeg = Math.cos(thumpAgeS * 27.0) * settle * 1.4;
        workspaceEl.style.transform = `scale(${scale.toFixed(4)}) rotate(${rotDeg.toFixed(3)}deg) skewX(${skewDeg.toFixed(3)}deg)`;
      } else if (en.has('degauss') && mag > 0.08) {
        const t = nowMs * 0.001;
        const driftRot = mag * 0.45 * Math.sin(t * 0.4);
        workspaceEl.style.transform = `rotate(${driftRot.toFixed(3)}deg)`;
      } else {
        workspaceEl.style.transform = '';
      }
    }

    if (overlayEl) {
      overlayEl.classList.toggle('active', hasAny || thumpActive);
      overlayEl.classList.toggle('has-crt', en.has('crt'));
      overlayEl.classList.toggle('has-scanlines', en.has('scanlines'));
      overlayEl.classList.toggle('has-phosphor', en.has('phosphor'));
      overlayEl.classList.toggle('has-degauss', en.has('degauss') || thumpActive);
    }

    // Draw dynamic VHS tracking/grain & Trinitron degauss rainbow sweep ring on lightweight low-res overlay canvas!
    if (fxCanvas && fxCtx) {
      const needFx = en.has('vhs') || thumpActive || (en.has('degauss') && mag > 0.05);
      fxCanvas.style.display = needFx ? 'block' : 'none';
      if (needFx) {
        const w = 320;
        const h = 180;
        if (fxCanvas.width !== w || fxCanvas.height !== h) {
          fxCanvas.width = w;
          fxCanvas.height = h;
        }
        fxCtx.clearRect(0, 0, w, h);
        const t = nowMs * 0.001;

        if (en.has('vhs')) {
          const track = clamp((vhsOpt.tracking ?? 0.3) * magGain, 0, 1.5);
          const noise = clamp((vhsOpt.noise ?? 0.1) * magGain, 0, 0.8);
          const bleed = clamp((vhsOpt.bleed ?? 1.0) * magGain, 0, 3.5);
          // Rolling VHS tracking shear band
          const bandY = ((1.0 - ((t * 0.11) % 1.0)) * h);
          const bandH = Math.max(6, Math.round(14 + track * 16));
          const grad = fxCtx.createLinearGradient(0, bandY - bandH, 0, bandY + bandH);
          grad.addColorStop(0, 'rgba(255,255,255,0)');
          grad.addColorStop(0.5, `rgba(215,245,255,${(0.05 + track * 0.14).toFixed(3)})`);
          grad.addColorStop(1, 'rgba(255,255,255,0)');
          fxCtx.fillStyle = grad;
          fxCtx.fillRect(0, bandY - bandH, w, bandH * 2);

          // Head-switch bottom tape noise stripe
          if (track > 0.02) {
            fxCtx.fillStyle = `rgba(255,255,255,${(0.06 + track * 0.14).toFixed(3)})`;
            fxCtx.fillRect(0, h - 5, w, 5);
          }
          // Subtle horizontal chroma-bleed & sparkle streaks
          const streaks = Math.round(8 + noise * 45 + bleed * 6);
          for (let i = 0; i < streaks; i += 1) {
            const sy = Math.floor(Math.abs(Math.sin(t * 61.3 + i * 19.7)) * h);
            const sx = Math.floor(Math.abs(Math.sin(t * 37.1 + i * 43.3)) * w);
            const sw = 10 + ((i * 13) % 44);
            const col = i % 3 === 0
              ? `rgba(255,70,120,${(0.04 + bleed * 0.035).toFixed(3)})`
              : (i % 3 === 1
                ? `rgba(70,220,255,${(0.04 + bleed * 0.035).toFixed(3)})`
                : `rgba(255,255,255,${(0.05 + noise * 0.16).toFixed(3)})`);
            fxCtx.fillStyle = col;
            fxCtx.fillRect(sx, sy, sw, 1);
          }
        }

        if (en.has('degauss') && mag > 0.05) {
          const stainAlpha = clamp(mag * 0.24, 0, 0.28);
          const gL = fxCtx.createRadialGradient(0, 0, 4, 0, 0, w * 0.45);
          gL.addColorStop(0, `rgba(195, 65, 255, ${stainAlpha.toFixed(3)})`);
          gL.addColorStop(1, 'rgba(195, 65, 255, 0)');
          fxCtx.fillStyle = gL;
          fxCtx.fillRect(0, 0, w, h);

          const gR = fxCtx.createRadialGradient(w, h, 4, w, h, w * 0.45);
          gR.addColorStop(0, `rgba(65, 255, 165, ${stainAlpha.toFixed(3)})`);
          gR.addColorStop(1, 'rgba(65, 255, 165, 0)');
          fxCtx.fillStyle = gR;
          fxCtx.fillRect(0, 0, w, h);
        }

        if (thumpActive) {
          const settle = Math.exp(-2.6 * thumpAgeS);
          const ringR = Math.max(8, (thumpAgeS * 2.1) * Math.hypot(w, h) * 0.55);
          fxCtx.save();
          fxCtx.lineWidth = Math.max(2, 16 * settle);
          fxCtx.strokeStyle = `rgba(110, 255, 210, ${(0.42 * settle).toFixed(3)})`;
          fxCtx.beginPath();
          fxCtx.arc(w * 0.5, h * 0.5, ringR, 0, Math.PI * 2);
          fxCtx.stroke();
          fxCtx.strokeStyle = `rgba(255, 95, 210, ${(0.32 * settle).toFixed(3)})`;
          fxCtx.beginPath();
          fxCtx.arc(w * 0.5, h * 0.5, Math.max(4, ringR - 10), 0, Math.PI * 2);
          fxCtx.stroke();
          fxCtx.restore();
        }
      }
    }
  }

  function needsAnimationLoop() {
    const en = state.enabled;
    const thumpActive = ((performance.now() - degaussStartedMs) / 1000) < 1.35;
    return thumpActive || en.includes('vhs') || en.includes('degauss');
  }

  function stepLoop(nowMs) {
    rafId = 0;
    if (disposed) return;
    const dt = lastTickMs ? Math.min(0.25, (nowMs - lastTickMs) / 1000) : 0;
    lastTickMs = nowMs;
    if (state.enabled.includes('degauss') && (!presenterShader || typeof presenterShader.magnetism !== 'function')) {
      const rate = Number(state.options.degauss?.rate ?? 0.02);
      magnetism = Math.min(1.0, magnetism + (dt * rate) / 300);
    }
    applyDesktopVisualOverlay(nowMs);
    if (needsAnimationLoop()) {
      rafId = requestAnimationFrame(stepLoop);
    }
  }

  function ensureLoop() {
    applyDesktopVisualOverlay(performance.now());
    if (needsAnimationLoop() && !rafId && typeof requestAnimationFrame === 'function') {
      lastTickMs = performance.now();
      rafId = requestAnimationFrame(stepLoop);
    }
  }

  function persist() {
    try {
      window.localStorage?.setItem(ULG_DESKTOP_SHADER_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage errors.
    }
  }

  function notify() {
    syncToPresenterShader();
    ensureLoop();
    persist();
    if (typeof onStateChange === 'function') {
      onStateChange(getSnapshot());
    }
  }

  function getSnapshot() {
    const optionsCopy = {};
    for (const def of CANVAS_SHADERS) {
      optionsCopy[def.id] = { ...(state.options[def.id] || {}) };
    }
    return {
      enabled: [...state.enabled],
      options: optionsCopy,
      magnetism: Number(effectiveMagnet().toFixed(4)),
      thumpSeq,
      catalogIds: CANVAS_SHADERS.map((d) => d.id)
    };
  }

  return {
    catalog: CANVAS_SHADERS,
    presets: ULG_DESKTOP_SHADER_PRESETS,
    load(raw) {
      state = normalizeShaderStackState(raw);
      notify();
      return getSnapshot();
    },
    setEnabledIds(ids) {
      state = normalizeShaderStackState({ ...state, enabled: Array.isArray(ids) ? ids : [] });
      notify();
      return getSnapshot();
    },
    toggleShader(id, force = null) {
      if (!SHADER_BY_ID.has(id)) return getSnapshot();
      const set = new Set(state.enabled);
      const next = force === null ? !set.has(id) : Boolean(force);
      if (next) set.add(id);
      else set.delete(id);
      return this.setEnabledIds([...set]);
    },
    setOption(id, key, value) {
      const def = SHADER_BY_ID.get(id);
      if (!def) return getSnapshot();
      const opt = (def.options ?? []).find((o) => o.key === key);
      if (!opt) return getSnapshot();
      const clamped = clamp(Number(value), opt.min, opt.max);
      if (!Number.isFinite(clamped)) return getSnapshot();
      state.options[id][key] = clamped;
      notify();
      return getSnapshot();
    },
    applyPreset(presetId) {
      const preset = ULG_DESKTOP_SHADER_PRESETS.find((p) => p.id === presetId);
      if (!preset) return getSnapshot();
      const mergedOptions = getDefaultShaderStackState().options;
      for (const [sid, kv] of Object.entries(preset.options || {})) {
        if (mergedOptions[sid]) Object.assign(mergedOptions[sid], kv);
      }
      state = normalizeShaderStackState({
        enabled: preset.enabled,
        options: mergedOptions
      });
      notify();
      return getSnapshot();
    },
    degauss() {
      degaussStartedMs = performance.now();
      magnetism = 0.02;
      thumpSeq += 1;
      try { presenterShader?.degauss?.(); } catch {}
      ensureLoop();
      if (typeof onStateChange === 'function') {
        onStateChange(getSnapshot());
      }
      return getSnapshot();
    },
    getMagnetism: () => effectiveMagnet(),
    getSnapshot,
    dispose() {
      disposed = true;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      if (fxCanvas) fxCanvas.remove();
    }
  };
}
