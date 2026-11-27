# ExoWebTUI Desktop Landing Page, Retro Scientific UI Pass & Mobile Hand-Driving Plan (`U17–U19`, 2026-11-27)

> **Origin:** Explicit `big dog` request sequence (2026-11-27), tracked alongside [`round3-anti-pigeonhole-and-lod-audit-2026-11-27.md`](round3-anti-pigeonhole-and-lod-audit-2026-11-27.md).
> **Active Branch:** `feat/round3-deep-waves-exowebtui-retro-mobile` (**STRICT PUBLICATION HOLD ACTIVE** — local commits only until authorized by `big dog`).

---

## Checklist

### U17 — ExoWebTUI Desktop Landing Page & Multi-Window Lab Host
- [ ] Create ULG's main landing entry (`pages.html` / `index.html` launcher + dedicated `desktop.html` or `?desktop=exowebtui` desktop host) that greets the user and explicitly asks whether they want to launch **Direct Standalone Mode** (Universes / Continuum Studio / Elements Lab / Organic Lab / Bio Lab) OR launch **Inside the ExoWebTUI Desktop Interface**.
- [ ] Integrate real ExoWebTUI (`@ubernaut/exotui` / `../exotui` window-manager/cell-canvas aesthetic + retro TUI desktop chrome, start menu, taskbar, tiling/cascade/maximize/minimize/drag/resize, live animated retro desktop backdrop, CRT scanline toggle, and mobile phone single-window full-screen responsive mode) so ALL 5 ULG labs (**ULG Universes 40-OOM**, **ULG Continuum Studio**, **Elements & Polytope Lab**, **Organic Chemistry Lab**, **Biophysics & Emergent Life Lab**) open as live interactive windows inside the SAME ExoWebTUI desktop interface (and cross-lab links like Bio Lab / Elements Lab open directly as sibling windows in the desktop!).
- [ ] Ensure `vite.config.js`, `vite.pages.config.mjs`, and `scripts/verify-pages-build.mjs` bundle every new entry cleanly with `0` `ort-wasm`/`onnx` assets and relative `./` paths for GitHub Pages.

### U18 — Cohesive Retro Scientific Workstation / TUI UI Theme Pass
- [ ] Create a shared retro scientific workstation stylesheet (`src/styles/ulgRetroTheme.css`) — phosphor-amber/cyan/emerald CRT palette, crisp 1px box-drawing / beveled workstation borders, monospace telemetry readouts, scanline/phosphor subtle glow option (toggleable, zero legibility loss, WCAG contrast clean), tactile retro pushbuttons & segmented selectors, and zero giant glossy web-2.0 blur cards.
- [ ] Apply consistently across the Landing Page, ExoWebTUI Desktop shell, `universes.html`, `elements-lab.html`, `organic-lab.html`, `life-lab.html`, and Continuum Studio (`src/visualization/sphPhaseDemoMount.js` / `sphStandalone.js`) without breaking any existing test selectors or WebGPU canvas sizing!

### U19 — Hand-Driven Mobile Form-Factor Simulation Audit & UI Defect Remediation
- [ ] Hand-drive ULG across real mobile viewports (`390×844` portrait + `844×390` landscape, touch pointer emulation) in headless Vulkan Chrome:
  - Landing Page & ExoWebTUI Desktop (single-window phone mode, taskbar, app drawer, window switching).
  - `universes.html` (L0 Cosmic Web → L1 Galaxy → L2 Solar System → L4 Planet Orbit → Landed Surface + Guided Tour + EM Sensor + Controls Drawer).
  - `elements-lab.html`, `organic-lab.html`, `life-lab.html`, and Continuum Studio (`studio.html` / `pages.html`).
- [ ] Inspect sequential real rendered screenshots with `read_file`, log EVERY UI defect (overlapping HUDs, off-screen/clipped controls, tiny `< 36px` tap targets, horizontal overflow, blocked canvas gesture space, unreadable cramped badges), fix every single defect in source, and re-verify via automated Playwright mobile visual/geometry assertions (`0` overlap, `0` horizontal scroll overflow, crisp touch ergonomics).
