// Shared ExoWebTUI Multi-Window Desktop & Retro Theme Bridge for all ULG Labs.
//
// Responsibilities:
//   1. Activates ULG's cohesive retro scientific workstation theme (`data-ulg-retro="1"`).
//   2. When a lab runs inside the ExoWebTUI desktop (`desktop.html`), intercepts
//      cross-lab anchor navigation (`./life-lab.html?...`, `./elements-lab.html`,
//      `./organic-lab.html`, `./universes.html`, `./studio.html`, `./index.html`)
//      so clicking any sibling lab link opens/focuses that lab as a window inside
//      the SAME ExoWebTUI desktop instead of replacing the current frame!
//   3. Receives live theme & CRT scanline updates from ExoWebTUI via `postMessage`
//      and maps ExoWebTUI's active `ShellThemeSpec` palette directly onto CSS custom
//      properties across all ULG labs.

const LAB_FILE_TO_ID = Object.freeze({
  'universes.html': 'universes',
  'studio.html': 'studio',
  'index.html': 'studio',
  'pages.html': 'studio',
  'elements-lab.html': 'elements',
  'organic-lab.html': 'organic',
  'life-lab.html': 'life',
  'desktop.html': 'desktop'
});

function rgbTupleToCss(rgb, fallback) {
  if (!Array.isArray(rgb) || rgb.length < 3) return fallback;
  return `rgb(${Math.round(rgb[0])}, ${Math.round(rgb[1])}, ${Math.round(rgb[2])})`;
}

function rgbTupleToRgba(rgb, alpha, fallback) {
  if (!Array.isArray(rgb) || rgb.length < 3) return fallback;
  return `rgba(${Math.round(rgb[0])}, ${Math.round(rgb[1])}, ${Math.round(rgb[2])}, ${alpha})`;
}

function rgbLuminance(rgb) {
  if (!Array.isArray(rgb) || rgb.length < 3) return 0;
  return 0.299 * Number(rgb[0]) + 0.587 * Number(rgb[1]) + 0.114 * Number(rgb[2]);
}

const BUILTIN_QUERY_THEMES = Object.freeze({
  paper: {
    id: 'paper',
    label: 'Paper',
    background: [244, 240, 232],
    surface: [236, 230, 219],
    surfaceStrong: [224, 216, 202],
    border: [164, 152, 134],
    text: [26, 30, 36],
    muted: [88, 96, 108],
    accent: [18, 94, 138],
    onAccent: [250, 252, 255],
    isLight: true,
    success: [22, 128, 72],
    warning: [168, 106, 12],
    danger: [184, 38, 52]
  },
  section9: {
    id: 'section9',
    label: 'Section 9',
    background: [7, 13, 20],
    surface: [12, 22, 34],
    surfaceStrong: [19, 34, 52],
    border: [54, 118, 102],
    text: [226, 246, 240],
    muted: [132, 168, 160],
    accent: [86, 240, 184],
    onAccent: [4, 16, 13],
    isLight: false,
    success: [75, 232, 154],
    warning: [255, 190, 79],
    danger: [255, 107, 125]
  },
  amber: {
    id: 'amber',
    label: 'Amber',
    background: [14, 10, 6],
    surface: [24, 17, 10],
    surfaceStrong: [36, 26, 14],
    border: [152, 98, 28],
    text: [255, 226, 176],
    muted: [192, 148, 86],
    accent: [255, 176, 48],
    onAccent: [18, 11, 4],
    isLight: false,
    success: [142, 220, 96],
    warning: [255, 206, 86],
    danger: [255, 96, 84]
  },
  matrix: {
    id: 'matrix',
    label: 'Matrix',
    background: [4, 12, 7],
    surface: [8, 20, 12],
    surfaceStrong: [14, 32, 20],
    border: [36, 142, 72],
    text: [212, 255, 222],
    muted: [108, 178, 128],
    accent: [64, 245, 128],
    onAccent: [4, 18, 8],
    isLight: false,
    success: [64, 245, 128],
    warning: [220, 212, 76],
    danger: [255, 94, 108]
  }
});

function dispatchCrtSyncEvent(enabled) {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  try {
    window.dispatchEvent(new CustomEvent('ulg-exowebtui-crt-change', {
      detail: { enabled: Boolean(enabled) }
    }));
  } catch {
    // Ignore CustomEvent issues in constrained environments.
  }
}

function dispatchShaderStackSyncEvent(stack) {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function' || !stack) return;
  try {
    window.dispatchEvent(new CustomEvent('ulg-exowebtui-shader-stack', {
      detail: { stack }
    }));
  } catch {
    // Ignore CustomEvent issues in constrained environments.
  }
}

export function applyRetroThemeTokens(theme) {
  if (typeof document === 'undefined' || !theme) return;
  if (!document.documentElement.dataset.ulgRetroCssLoaded) {
    document.documentElement.dataset.ulgRetroCssLoaded = '1';
    import('../styles/ulgRetroTheme.css').catch(() => {});
  }
  const root = document.documentElement;
  const isLight = typeof theme.isLight === 'boolean'
    ? theme.isLight
    : (Array.isArray(theme.background) ? rgbLuminance(theme.background) > 140 : false);
  if (theme.id) root.dataset.ulgTheme = String(theme.id);
  root.dataset.ulgThemeMode = isLight ? 'light' : 'dark';
  if (theme.crt !== undefined) {
    const crtOn = Boolean(theme.crt);
    root.dataset.ulgCrt = crtOn ? '1' : '0';
    dispatchCrtSyncEvent(crtOn);
  }
  const bg = rgbTupleToCss(theme.background, null);
  const surface = rgbTupleToRgba(theme.surface, 0.94, null);
  const surfaceStrong = rgbTupleToRgba(theme.surfaceStrong, 0.97, null);
  const accent = rgbTupleToCss(theme.accent, null);
  const onAccentRgb = Array.isArray(theme.onAccent)
    ? theme.onAccent
    : (Array.isArray(theme.accent) ? (rgbLuminance(theme.accent) > 148 ? [8, 16, 14] : [250, 252, 255]) : null);
  const onAccent = rgbTupleToCss(onAccentRgb, null);
  const accentDim = rgbTupleToRgba(theme.accent, isLight ? 0.14 : 0.16, null);
  const border = rgbTupleToRgba(theme.accent, isLight ? 0.48 : 0.36, null);
  const borderStrong = rgbTupleToRgba(theme.accent, isLight ? 0.85 : 0.72, null);
  const glow = rgbTupleToRgba(theme.accent, isLight ? 0.12 : 0.18, null);
  const text = rgbTupleToCss(theme.text, null);
  const muted = rgbTupleToCss(theme.muted, null);
  const danger = rgbTupleToCss(theme.danger, null);
  const success = rgbTupleToCss(theme.success, null);
  const warning = rgbTupleToCss(theme.warning, null);

  if (bg) root.style.setProperty('--ulg-retro-bg', bg);
  if (surface) root.style.setProperty('--ulg-retro-surface', surface);
  if (surfaceStrong) root.style.setProperty('--ulg-retro-surface-strong', surfaceStrong);
  if (accent) root.style.setProperty('--ulg-retro-accent', accent);
  if (onAccent) root.style.setProperty('--ulg-retro-on-accent', onAccent);
  if (accentDim) root.style.setProperty('--ulg-retro-accent-dim', accentDim);
  if (border) root.style.setProperty('--ulg-retro-border', border);
  if (borderStrong) root.style.setProperty('--ulg-retro-border-hi', borderStrong);
  if (glow) root.style.setProperty('--ulg-retro-glow', `0 0 14px ${glow}`);
  root.style.setProperty(
    '--ulg-retro-bevel',
    isLight
      ? 'inset 1px 1px 0 rgba(255, 255, 255, 0.82), inset -1px -1px 0 rgba(0, 0, 0, 0.18), 0 1px 2px rgba(0, 0, 0, 0.08)'
      : 'inset 1px 1px 0 rgba(255, 255, 255, 0.08), inset -1px -1px 0 rgba(0, 0, 0, 0.68), 0 0 0 1px rgba(0, 0, 0, 0.55)'
  );
  if (text) root.style.setProperty('--ulg-retro-text', text);
  if (muted) root.style.setProperty('--ulg-retro-muted', muted);
  if (danger) root.style.setProperty('--ulg-retro-danger', danger);
  if (success) root.style.setProperty('--ulg-retro-success', success);
  if (warning) root.style.setProperty('--ulg-retro-warning', warning);
}

export function resolveLabIdFromHref(href) {
  if (!href || typeof href !== 'string') return null;
  if (/^(?:https?:|mailto:|javascript:|#)/i.test(href.trim())) return null;
  try {
    const u = new URL(href, window.location.href);
    const base = u.pathname.split('/').pop()?.toLowerCase() || '';
    const labId = LAB_FILE_TO_ID[base] || null;
    if (!labId) return null;
    return {
      labId,
      href: `./${base}${u.search}${u.hash}`
    };
  } catch {
    return null;
  }
}

export function initUlgExoWebTuiBridge({ labId = 'unknown', title = '' } = {}) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { isEmbedded: false, openSiblingLab: () => false };
  }
  const root = document.documentElement;
  if (!root.dataset.ulgRetroCssLoaded) {
    root.dataset.ulgRetroCssLoaded = '1';
    import('../styles/ulgRetroTheme.css').catch(() => {});
  }
  root.dataset.ulgRetro = '1';
  root.dataset.ulgLab = labId;

  const params = new URLSearchParams(window.location.search);
  const isEmbedded = window.parent !== window || params.get('embedded') === 'exowebtui';
  if (isEmbedded) {
    root.dataset.ulgEmbedded = 'exowebtui';
  }
  if (params.get('crt') === '1') {
    root.dataset.ulgCrt = '1';
  }

  // Explicit ?theme= query parameter takes priority (e.g., ?theme=paper or ?theme=section9)
  const themeQuery = String(params.get('theme') || '').trim().toLowerCase();
  if (themeQuery && BUILTIN_QUERY_THEMES[themeQuery]) {
    applyRetroThemeTokens({
      ...BUILTIN_QUERY_THEMES[themeQuery],
      ...(params.get('crt') === '1' ? { crt: true } : {})
    });
  } else if (!isEmbedded) {
    // Restore saved user theme preference if standalone
    try {
      const saved = window.localStorage?.getItem('ulg-exowebtui-theme-json');
      if (saved) applyRetroThemeTokens(JSON.parse(saved));
    } catch {
      // Ignore storage access errors in private browsing.
    }
  }

  const openSiblingLab = (targetHref) => {
    const resolved = resolveLabIdFromHref(targetHref);
    if (!resolved || !isEmbedded || window.parent === window) return false;
    if (resolved.labId === 'desktop') return true;
    try {
      window.parent.postMessage({
        type: 'ulg-exowebtui-open-lab',
        labId: resolved.labId,
        href: resolved.href,
        fromLabId: labId
      }, '*');
      return true;
    } catch {
      return false;
    }
  };

  if (!window.__ulgExoWebTuiBridgeBound) {
    window.__ulgExoWebTuiBridgeBound = true;

    window.addEventListener('message', (event) => {
      const data = event?.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'ulg-exowebtui-theme' && data.theme) {
        applyRetroThemeTokens(data.theme);
      } else if (data.type === 'ulg-exowebtui-crt') {
        const crtOn = Boolean(data.enabled);
        root.dataset.ulgCrt = crtOn ? '1' : '0';
        dispatchCrtSyncEvent(crtOn);
      } else if (data.type === 'ulg-exowebtui-shader-stack' && data.stack) {
        const en = Array.isArray(data.stack.enabled) ? data.stack.enabled : [];
        root.dataset.ulgShaders = en.join(',');
        const crtOn = en.includes('crt') || en.includes('scanlines');
        root.dataset.ulgCrt = crtOn ? '1' : '0';
        dispatchCrtSyncEvent(crtOn);
        dispatchShaderStackSyncEvent(data.stack);
      }
    });

    if (isEmbedded) {
      document.addEventListener('click', (event) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
          return;
        }
        const anchor = event.target?.closest?.('a[href]');
        if (!anchor) return;
        const hrefAttr = anchor.getAttribute('href') || '';
        if (anchor.hasAttribute('download')) return;
        const resolved = resolveLabIdFromHref(hrefAttr);
        if (!resolved) return;
        // Let the ExoWebTUI desktop open/focus the requested sibling lab window!
        event.preventDefault();
        event.stopPropagation();
        if (resolved.labId === 'desktop') return;
        window.parent.postMessage({
          type: 'ulg-exowebtui-open-lab',
          labId: resolved.labId,
          href: resolved.href,
          fromLabId: labId
        }, '*');
      }, true);

      try {
        window.parent.postMessage({
          type: 'ulg-exowebtui-ready',
          labId,
          title: title || document.title
        }, '*');
      } catch {
        // Ignore postMessage restriction.
      }
    }
  }

  return { isEmbedded, openSiblingLab };
}
