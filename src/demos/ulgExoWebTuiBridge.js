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

export function applyRetroThemeTokens(theme) {
  if (typeof document === 'undefined' || !theme) return;
  if (!document.documentElement.dataset.ulgRetroCssLoaded) {
    document.documentElement.dataset.ulgRetroCssLoaded = '1';
    import('../styles/ulgRetroTheme.css').catch(() => {});
  }
  const root = document.documentElement;
  if (theme.id) root.dataset.ulgTheme = String(theme.id);
  if (theme.crt !== undefined) {
    root.dataset.ulgCrt = theme.crt ? '1' : '0';
  }
  const bg = rgbTupleToCss(theme.background, null);
  const surface = rgbTupleToRgba(theme.surface, 0.94, null);
  const surfaceStrong = rgbTupleToRgba(theme.surfaceStrong, 0.97, null);
  const accent = rgbTupleToCss(theme.accent, null);
  const accentDim = rgbTupleToRgba(theme.accent, 0.16, null);
  const border = rgbTupleToRgba(theme.accent, 0.36, null);
  const borderStrong = rgbTupleToRgba(theme.accent, 0.72, null);
  const text = rgbTupleToCss(theme.text, null);
  const muted = rgbTupleToCss(theme.muted, null);
  const danger = rgbTupleToCss(theme.danger, null);
  const success = rgbTupleToCss(theme.success, null);
  const warning = rgbTupleToCss(theme.warning, null);

  if (bg) root.style.setProperty('--ulg-retro-bg', bg);
  if (surface) root.style.setProperty('--ulg-retro-surface', surface);
  if (surfaceStrong) root.style.setProperty('--ulg-retro-surface-strong', surfaceStrong);
  if (accent) root.style.setProperty('--ulg-retro-accent', accent);
  if (accentDim) root.style.setProperty('--ulg-retro-accent-dim', accentDim);
  if (border) root.style.setProperty('--ulg-retro-border', border);
  if (borderStrong) root.style.setProperty('--ulg-retro-border-hi', borderStrong);
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

  // Restore saved user theme preference if standalone
  if (!isEmbedded) {
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
        root.dataset.ulgCrt = data.enabled ? '1' : '0';
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
