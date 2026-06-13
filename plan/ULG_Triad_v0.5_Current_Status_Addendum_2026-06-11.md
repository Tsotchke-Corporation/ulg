---
title: ULG Triad v0.5 Current Status Addendum
subtitle: Worker-first SPH cold-start, cache, reaction, and gas-pressure slice
date: 2026-06-11
geometry: margin=0.8in
fontsize: 10pt
---

# Purpose

This addendum updates the checked-in `ULG_Triad_v0.5_Pretty_Diagrams.pdf` with
the current implementation status as of 2026-06-11. The original PDF source was
not present in the repository, so the original 68-page PDF is preserved and this
status packet is appended as reproducible markdown-generated pages.

# Current Status

The ULG browser demo remains an evidence-oriented integration scaffold for
PeerCompute, Eshkol, MoonLab, and the ULG runtime. It does not claim calibrated
magnetar science, full SPH validation, full phase-change validation, or complete
first-principles material solver residency.

Completed since the original v0.5 PDF:

- Strict material-property provenance gates are active in the SPH path.
- Element and compound material closures are derived through the generic
  lower-level material pipeline instead of reference constants in the default
  runtime.
- Relativistic/interband optical response is implemented on the CPU and packed
  into WebGPU-consumable optical rows for the renderer.
- SPH/MLS-MPM state, mechanics, P2G, grid update, G2P, resident stepping,
  thermal response, reaction conversion, and render-field slices now have
  explicit ABI records and optional WebGPU paths, with validation flags kept
  false unless the local parity/evidence actually exists.
- The SPH phase renderer now renders continuous material surfaces, keeps
  transparent H2O visible, and preserves material/phase render ordering.
- General reaction candidate discovery now handles balanced element/compound
  pairs such as Li/H2O, Na/H2O, Cs/H2O, Na/Cl, Na/Cl2, Mg/O2, Fe/O2, and Fe/H2O
  without the old Na-only branch.
- The live SPH overlay shows independent render, physics, and resident FPS
  counters plus WebGPU/CPU fallback warnings.

# Cold-Start Cache Slice

The first cold-start cache/performance slice is complete.

Implemented:

- `discoverReactions()` no longer disables its cache when
  `materialProperties` is provided. It now includes stable material-property
  provenance hashes in the cache key.
- Reaction discovery can return `memory-cache-hit`, `persistent-cache-hit`, or
  `derived-cache-miss` status.
- Persisted reaction records and product reuse records are written to an SPH
  cold-start localStorage cache namespace guarded by generator fingerprints.
- Product closures supplied by the cache are reused during reaction discovery
  before deriving a new product closure.
- Initial SPH material/reaction/view-state rebuilds run through the supervised
  `ulg-runtime` worker when available, so cold first-principles derivation does
  not block initial UI construction.
- The SPH overlay exposes `cold cache`, `cache clear`, and `perf trace` status
  rows.
- A scoped `Clear Cache` button clears ULG SPH derived material and cold-start
  cache families plus the in-memory reaction discovery cache.
- When render FPS drops below 30 during active CPU closure work, the warning
  banner reports `deriving material or reaction properties`.
- The ultra-low-FPS cache-miss auto-pause path was removed; the long 0.1 FPS
  cold-start period remains a performance target to fix by reducing or
  offloading work.
- Manual Step/Play can reconstruct the interactive driver from cache after the
  worker prepopulates material/reaction closures, preserving the existing
  reaction-step path without forcing cold derivation during initial load.
- The follow-up cold-start slice consumes partial material cache hits instead of
  discarding all cached closures when one runtime default is missing.
- Missing required runtime materials are derived individually through the
  generic derivation path instead of forcing a full default closure rebuild.
- `ulg-runtime` is pre-spawned with the other demo services.
- Worker rebuild, resident MLS-MPM, and scene particle-sync stages now expose
  timing breakdowns in the overlay.
- Deterministic thermal material tables, thermal closure graph banks, phase
  response tables, optical/PBR rows, reaction tables, and GPU warmup signatures
  are written into the cold-start cache as derived artifact records.
- Balanced stoichiometric discovery now preserves reactant/product term arrays
  and rejects stale persistent reaction records that lack them.
- The CPU reference reaction path can produce multiple products. Na + liquid
  H2O now produces NaOH plus H2 in the browser demo.
- The SPH demo now reports sealed-box gas pressure diagnostics, including H2
  partial pressure from reaction byproducts.

Remaining:

- Rehydrate persisted static table rows into scene/WebGPU upload paths on warm
  reload.
- Move large cache serialization/parsing and remaining resolver work farther out
  of the UI thread and into workers, PeerCompute state, or WebGPU kernels.
- Add stale-record browser probes and measured cold/warm/clear/repopulate
  startup deltas.
- Mirror cacheable derived closures into PeerCompute state so peers can reuse
  valid first-principles derivation artifacts.

# Current Validation

Validated locally on 2026-06-11:

- `node --test tests/reactionDiscovery.test.mjs`: 8/8 pass.
- `node --test tests/reactiveChemistry.test.mjs`: 7/7 pass.
- `node --test tests/sphPhaseDemo.test.mjs`: 7/7 pass.
- Focused contract, renderer, and chemistry tests: 16/16 pass.
- Focused HTTPS Chromium SPH browser tests against `https://127.0.0.1:5173`: 3/3 pass.
- Focused HTTPS Chromium Na/H2O pressure test: 1/1 pass.
- `npm test`: 336/336 pass.
- `npm run build`: pass with the existing Vite large-chunk warning.
- `npm run build:pages`: pass with the existing Vite large-chunk warning; `docs/` regenerated.

# Active Risks

- The broad material/optics/reaction derivation stack is still CPU-heavy. The
  current worker-first path protects initial UI responsiveness but does not make
  every resolver WebGPU-resident yet.
- Reaction energetics still include provisional candidate cases when crude
  generated geometries give bad signs. CPU reference multi-product conversion
  and gas-pressure diagnostics exist, but full reaction extent solving,
  validated free-energy refinement, and WebGPU resident multi-product execution
  remain active todo items.
- Steam optics are not yet phase/state keyed enough to distinguish vapor from
  condensed droplets in a general optical closure cache.
- Nuclear, radiation, Cherenkov, fission, fusion, and radioactive decay
  closures remain planned but not implemented.

# Immediate Next Work

1. Rehydrate static table cache rows into warm scene/WebGPU uploads and move
   cache serialization/parsing off the UI thread.
2. Promote balanced multi-product reaction execution into a full extent solver
   and then into the resident WebGPU reaction kernel.
3. Add phase-resolved H2O/steam optics keyed by phase, temperature, pressure,
   density, and droplet fraction.
4. Continue migrating material property resolvers to worker/WebGPU-resident
   execution while keeping CPU reference parity and provenance checks.
