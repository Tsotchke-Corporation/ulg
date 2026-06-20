# Drop Edge Large Size Respect Plan

Date: 2026-06-19 AKDT

## Problem

The drop edge setting does not appear to be respected for values larger than
`6`. Larger requested drop sizes either clamp, normalize incorrectly, or fail
to affect the initialized drop geometry/particle placement in the expected
way.

## Scope

Fix drop sizing through the actual initialization and particle placement path,
not with a visual-only scale. The setting should consistently control the drop
domain used by particle generation, material cohort counts, render bounds,
resident GPU uploads, and reset/rebuild flows.

## Required Investigation

1. Trace the URL/UI parameter for drop edge through state creation, particle
   sampling, spacing/radius selection, render-domain counts, and MLS-MPM GPU
   upload packing.
2. Identify whether values above `6` are clamped by UI limits, URL parsing,
   box/domain bounds, particle-count budgeting, sampling density, active-grid
   bounds, or render-field extraction limits.
3. Add diagnostics that report requested drop edge, effective drop edge,
   clamp reason, generated drop particle count, drop bounds, and resident upload
   bounds.
4. Reproduce with representative values below, at, and above `6`, including
   reset/rebuild and mobile-sized viewport paths.

## Acceptance

- Drop edge values larger than `6` are either honored physically or rejected
  with an explicit diagnostic reason tied to box/domain or particle-budget
  constraints.
- Generated particles, render bounds, resident upload metadata, and reset state
  agree on the effective drop dimensions.
- The fix is material-agnostic and works with variable particle spacing/radius.

## Implementation Status

2026-06-19 AKDT update:

- Broadened the explicit same-material mounted reset/rebuild regression from
  `dropn=7, basen=7` to `dropn=8, basen=8`, keeping the mobile-shaped MLS-MPM
  render-row sphere path. The browser test now verifies requested/effective
  drop/base edges `8/8`, generated counts `8^3 + 8^3`, render-domain counts,
  reset resync, and SPH plus MLS-MPM upload counts.
- Added unit coverage for `dropn=8, basen=8` in
  `tests/sphPhaseDemo.test.mjs`, asserting the same-material strategy
  `preserve-both-requested-edges`, total count `1024`, and preservation
  diagnostics.
- Focused evidence:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173
  PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config
  tests/playwright.config.mjs --grep "SPH phase reset preserves drop edge above
  six through mounted render diagnostics"` passed `1/1` with the console issue
  guard active.

2026-06-19 AKDT update:

- Added non-H2O coverage for Fe/H2O with `dropn=8, basen=5`. Unit coverage
  proves the material spacing resolver preserves the requested Fe drop edge at
  `8`, adapts the H2O base edge to `7`, reports
  `requested-large-edge-preserved` for the drop, and keeps generated/view
  counts aligned at `512 + 343 = 855`.
- Added a mounted mobile-shaped MLS-MPM browser regression for the same URL
  path with `surfaceDraw=three-render-row-spheres`. It verifies reset resync,
  requested/effective edge diagnostics, render-domain counts, domain position
  bounds, SPH and MLS-MPM GPU uploads, selected variable-size sphere render
  mode, and clean WebGPU console output.
- A diagnostic probe showed this Fe/H2O single-step path does not produce a
  resident render-state bridge object, so the browser regression keeps resident
  bridge internals optional and treats them as renderer-roadmap evidence rather
  than a drop-edge contract requirement.

2026-06-19 AKDT live report update:

- User still reports that drop edge is not respected for anything larger than
  `6` in the live demo. Keep this task open despite the prior `dropn=7`
  initialization/reset evidence.
- Next diagnostic pass should reproduce from the exact URL/UI path, include
  values `7`, `8`, and a visibly larger value, and compare requested edge,
  effective initialized edge, render-domain counts, resident upload counts,
  surface/sphere bounds, reset state, and mobile render bounds.
- Treat failures above `6` as likely downstream of initialization or render
  domain consumption until proven otherwise; do not mask it with a visual-only
  scale or overlay workaround.

2026-06-19 AKDT update:

- Added render-domain position bounds to
  `peercompute.ulg.sph-scene-set-particles-timing.v0`. These diagnostics are
  derived from the render-facing `positionsM` array plus normalized
  `renderDomainCounts`, and report base/drop count, finite position count,
  center, and center-to-center bounds.
- Added a mounted mobile-shaped regression for `dropn=7, basen=5`, H2O/H2O,
  MLS-MPM, reset, and render-row spheres. It proves the common "only raise the
  drop edge" path preserves `7^3` drop particles after reset and expands the
  same-material base to `14^3` particles for equal particle radius.
- CPU continuous surface batching now applies fallback role-domain assignment
  from `renderDomainCounts`, matching the resident seed path. Count-only
  resident seed batches can merge by domain, so render-row sphere mode reports
  an intentional same-material visible merge without forcing CPU geometry.
- The scene now exposes
  `peercompute.ulg.sph-same-material-domain-merge-diagnostics.v0`, proving
  when same-material same-phase base/drop domains are intentionally merged for
  one continuous visible material surface.
- This narrows the live report away from URL parsing, UI input clamping,
  initialization, render-domain counting, reset state, and the common H2O/H2O
  visible-merge confusion for `dropn=7`.

2026-06-19 AKDT update:

- Reopened by live demo report: drop edge still does not appear to be
  respected for anything larger than `6`.
- The prior `dropn=7, basen=7` mounted reset/rebuild evidence is now treated as
  incomplete rather than definitive. The next pass must capture the actual
  failing URL/UI path and compare requested edge, effective initialized edge,
  particle/render-domain counts, resident uploads, reset state, and visible
  bounds for values above `6`.
- Keep this as an engine integration/initialization bug. Do not solve it with a
  visual-only scale, and do not collapse it into the separate performance issue
  where same-material spacing can intentionally expand the paired base block.

2026-06-19 AKDT:

- The initializer now treats explicit role edge requests above `6` as a lower
  bound for adaptive spacing. The density/temperature resolver can still refine
  particle size and paired-role spacing, but it no longer silently lowers a
  high requested drop edge.
- Same-material/same-temperature matching preserves high requested drop edges
  and scales the paired base edge when needed to keep equal physical particle
  radius. Equal high drop/base requests preserve both explicit role edges and
  report that same-material spacing was not unified.
- Demo and view state now expose
  `peercompute.ulg.sph-initial-particle-edge-diagnostics.v0` with requested and
  effective edge, generated count, block edge, spacing, radius, and preservation
  status. Long-horizon probes and performance benchmarks carry the same
  diagnostics.
- Focused coverage is in `tests/sphPhaseDemo.test.mjs` for `dropn=7, basen=5`,
  non-matching adaptive spacing, and `dropn=basen=7` benchmark-count
  preservation.

2026-06-19 AKDT:

- Added mounted reset/rebuild coverage for a mobile-shaped `dropn=7,
  basen=7` MLS-MPM scene. The scene now exposes normalized
  `renderDomainCounts` on `peercompute.ulg.sph-scene-set-particles-timing.v0`,
  so tests can verify the render-facing domain partition after rebuild instead
  of inferring it from particle arrays.
- The mounted regression clicks Reset, waits for
  `particle-state-resynced-after-reset`, verifies requested/effective high
  drop/base edges, generated particle counts, render-domain counts, and then
  explicitly steps once to force SPH/MLS-MPM GPU particle uploads. Both uploads
  report the same total particle count as the high-edge diagnostics.

Remaining:

- Keep this active only for broader visual-mode coverage above `dropn=7`, a
  true live repro outside the covered H2O/H2O and Fe/H2O URL paths, and render
  bridge batches that actually publish resident render-state diagnostics.
- Full resident stepping at the expanded `dropn=7, basen=5` total remains
  performance-roadmap work rather than an initialization/drop-edge contract
  blocker.
