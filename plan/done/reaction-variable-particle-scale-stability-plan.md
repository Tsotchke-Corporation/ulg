# Reaction Variable Particle Scale Stability Plan

Date: 2026-06-19 AKDT

## Problem

Variable scaled particles can explode in apparent size exponentially during
some chemical reactions, then reset or lock up the simulation without a browser
console error. The failure is currently silent, so the runtime can look stable
from console telemetry while the physics state or render state has already
become unusable.

## Scope

Fix reaction-driven particle size growth as a physics/runtime stability issue,
not as a visual-only clamp. Particle radius/support must remain derived from
material mass, density, phase, temperature, pressure, and valid packing or
kernel-support constraints, but the live solver also needs bounded growth,
diagnostics, and fail-closed reset behavior.

## Working Hypotheses

- Reaction/product mass or phase rows can create a feedback loop where product
  visible radius is recomputed from already-expanded particle scale.
- Variable radius may be using visual size as a source value instead of deriving
  from conserved mass/density each step.
- New product or gas/foam particles may lack a maximum support radius relative
  to grid spacing, smoothing length, local mass, or cell occupancy.
- Temperature/pressure-driven expansion may need rate limiting across substeps
  so a single reaction event cannot move radius by orders of magnitude.
- Reset/lockup can happen without console errors because the values remain
  finite enough for WebGPU/Three submission while blowing up bounds, active-grid
  ranges, surface extraction allocation, or camera/render scale.

## Required Fixes

1. Add particle-scale diagnostics to the resident and render summaries:
   max radius, radius growth ratio, source material/product, phase, temperature,
   pressure, mass, density, and reaction event provenance.
2. Add invariant checks that flag runaway radius growth before it reaches the
   renderer or active-grid planner:
   finite radius, positive density, mass-conserving volume, bounded support
   radius relative to grid spacing, and bounded per-substep growth ratio.
3. Replace any visual-size feedback loop with a derived-radius path:
   `radius = f(mass, density(material, phase, T, P), packing/support policy)`.
4. Add physically justified caps:
   maximum visual radius, maximum solver support radius, maximum growth ratio
   per substep, and a separate gas/foam expansion policy when product gas needs
   volume without giant individual particles.
5. Make cap activation explicit in diagnostics and validation. A cap should not
   silently hide invalid chemistry; it should record the material, reaction,
   unclamped radius, clamped radius, and reason.
6. Add a reset/lockup reproduction gate with the reactions that triggered the
   issue, then run it through `npm run test:physics-atomics` and a browser
   no-console-error visual sequence.

## Acceptance

- Reaction scenarios that previously caused exponential particle-size growth
  stay finite, visually bounded, and continue advancing after reset.
- Browser console remains clean, but the test must also assert the new radius
  diagnostics so "no console error" is not treated as success by itself.
- Mass/volume accounting remains explicit; caps must not create or destroy
  material mass without a recorded residual or gas/pressure route.
- The fix works for arbitrary materials/products, not a hard-coded reaction
  pair.

## Implementation Status - 2026-06-19 17:01 AKDT

Implemented the first fail-closed render-row bound for runaway variable
particle scale:

- CPU render-row extraction now reports
  `peercompute.ulg.sph-render-row-particle-scale-stability.v0` diagnostics.
  The diagnostic records raw/effective radius growth, raw/effective `J`, cap
  count, sample capped rows, material id, phase id, and cap reason.
- WebGPU render-row extraction applies the same policy in WGSL before rows
  reach retained render buffers, particle points, particle spheres, or surface
  extraction: max radius growth ratio `4`, max effective volume ratio `J=64`.
- WebGPU retained/no-readback runs report
  `gpu-row-cap-policy-applied-in-shader` without adding a CPU particle scan to
  the hot path. Full cap counts remain a CPU-reference/readback diagnostic.
- The scene and long-horizon probe now expose the cap policy on render-row
  point/sphere bridges and generic surface draw summaries.
- Focused tests cover an artificial runaway MLS-MPM `J=1e9` row and assert
  that CPU rows clamp radius, volume, `J`, and diagnostics. A WGSL source guard
  keeps the shader constants and branch wired.

Validation:

- `node --check src/runtime/sph/sphRenderGpuKernel.js`
- `node --check ulg-gpu-abi/src/wgsl.js`
- `node --check tests/sphRenderGpuKernel.test.mjs`
- `node --check src/visualization/sphPhaseScene.js`
- `node --check scripts/sph-long-horizon-probe.mjs`
- `node --test tests/sphRenderGpuKernel.test.mjs` passed `51/51`.
- `npm run test:physics-atomics` passed `11/11`; the three long-horizon
  liquid acceptance gates remained opt-in/skipped.
- Browser probe `/tmp/ulg-reaction-particle-scale-cap-probe-bridge.json`
  completed `status=good`, analysis `good`, browser console issue count `0`,
  worker capability `worker-capability-ready` with `12` workers, sphere bridge
  `three-render-row-spheres`, closure-derived sphere PBR enabled, and
  render-row particle-scale policy `gpu-row-cap-policy-applied-in-shader`
  with max radius growth `4` and max `J=64`.

Remaining:

- Add a targeted reaction reproduction that actually trips the cap in browser
  telemetry, not only the unit-level synthetic `J=1e9` fixture.
- Split gas/foam product expansion from individual particle visual radius so
  gas volume can be represented without huge per-particle spheres.
- Add reset/lockup regression coverage after the reset functionality fix lands.

## Implementation Status - 2026-06-19 18:44 AKDT

Implemented a resident mechanics-side particle-scale guard for the same runaway
class:

- MLS-MPM G2P now applies a general volume-ratio guard after material-specific
  condensed stabilization and before writing `out_mls_mechanics`: min `J=0.1`,
  max radius growth ratio `4`, and max effective `J=64`.
- The standalone G2P WGSL and fused no-full resident mechanics G2P path now use
  the same cap constants and bumped pipeline cache keys.
- CPU G2P reports
  `peercompute.ulg.mls-mpm-g2p-particle-scale-stability.v0` diagnostics with
  cap counts, invalid counts, raw/effective `J`, radius growth ratios, and
  sample capped particle rows.
- WebGPU no-full and fused no-full runs report
  `gpu-g2p-cap-policy-applied-in-shader` in resident-step diagnostics without
  adding a CPU particle scan to the hot loop.

Validation:

- `node --check src/runtime/sph/sphG2pGpuKernel.js`
- `node --check src/runtime/sph/sphMlsMpmGpuStep.js`
- `node --check ulg-gpu-abi/src/wgsl.js`
- `node --check tests/sphG2pGpuKernel.test.mjs`
- `node --check tests/sphMlsMpmGpuStep.test.mjs`
- `node --test tests/sphG2pGpuKernel.test.mjs` passed `17/17`.
- `node --test tests/sphMlsMpmGpuStep.test.mjs` passed `60/60`.

Remaining:

- Add a targeted reaction reproduction that actually trips the G2P/render cap
  in browser telemetry, not only synthetic G2P/render-row fixtures.
- Split gas/foam product expansion from individual particle visual radius so
  gas volume can be represented without huge per-particle spheres.
- Add active-grid/support-radius admission checks if a future product-expansion
  path can grow per-particle support before G2P sees `J`.
- Add reset/lockup regression coverage after the reset functionality fix lands.

## Implementation Status - 2026-06-19 AKDT

Added a render-row support-radius guard for aggregate/product visual radius:

- CPU render-row extraction now also records the support-radius policy:
  `maxSupportRadiusSmoothingRatioAllowed=2`, the derived `maxSupportRadiusM`,
  and cap samples with reason `max-support-radius`.
- WebGPU render-row extraction passes the same derived support radius into the
  uniform block and clamps `particle_radius_m` in WGSL after the existing
  max-growth/max-`J` guard. Retained/no-full runs expose
  `supportRadiusPolicyAppliedInShader=true` without adding a CPU particle scan.
- Scene and long-horizon probe diagnostics now surface
  `renderRowsParticleScaleMaxSupportRadiusM` and
  `renderRowsParticleScaleSupportRadiusPolicyAppliedInShader` alongside the
  existing decoded `J` cap-boundary fields.
- Focused tests now cover a synthetic aggregate product radius case where
  `J=1` but mass/density would otherwise produce a visual particle larger than
  the solver support radius.

Validation:

- `node --check src/runtime/sph/sphRenderGpuKernel.js`
- `node --check src/visualization/sphPhaseScene.js`
- `node --check scripts/sph-long-horizon-probe.mjs`
- `node --check tests/sphRenderGpuKernel.test.mjs`
- `node --check ulg-gpu-abi/src/wgsl.js`
- `node --test tests/sphRenderGpuKernel.test.mjs` passed `52/52`.
- Browser probe `/tmp/ulg-reaction-support-radius-cap-probe.json` completed
  `status=good`, analysis `good`, browser console issues/warnings `0/0`, four
  nonblank captured visual frames, final resident sphere max radius
  `0.5263000726699829 m`, decoded max `J=1.0000579357147217`, no decoded
  `J=64` cap-boundary rows, and retained shader support policy
  `maxSupportRadiusM=0.6203504908994 m`.

Remaining:

- Add a targeted browser reaction or harness fixture that actually trips the
  support-radius cap in browser telemetry, not only the unit-level synthetic
  aggregate radius fixture.
- Add reset/lockup regression coverage after the reset functionality fix lands.

## Implementation Status - 2026-06-19 AKDT

Split gas-product routing and gas-phase visual radius from individual visible
particle scale:

- Reaction planning no longer assigns explicitly gas-routed product terms to
  visible product slots. CPU reaction events keep those terms in unplaced
  product/gas accounting instead of creating a second visible gas particle row.
- The WebGPU reaction resolve shader now picks visible product terms through a
  condensed-product helper, so gas-routed terms remain ledgered instead of
  being written into visible particle rows.
- Render-row extraction now applies a separate gas-phase visual-radius proxy:
  gas rows remain present in decoded material/phase counts, but individual gas
  spheres are capped to `0.5 * smoothingLengthM`. This keeps gas/product volume
  from rendering as huge per-particle spheres while preserving the gas phase and
  product ledger for later pressure/field work.
- Scene and long-horizon probe diagnostics expose
  `renderRowsParticleScaleMaxGasRadiusSmoothingRatioAllowed` and
  `renderRowsParticleScaleMaxGasParticleRadiusM` for retained WebGPU rows.

Validation:

- `node --check src/runtime/sph/sphRenderGpuKernel.js`
- `node --check src/runtime/sph/sphReactionGpuKernel.js`
- `node --check src/visualization/sphPhaseScene.js`
- `node --check scripts/sph-long-horizon-probe.mjs`
- `node --check tests/sphRenderGpuKernel.test.mjs`
- `node --check tests/sphReactionGpuKernel.test.mjs`
- `node --check ulg-gpu-abi/src/wgsl.js`
- `node --test tests/sphRenderGpuKernel.test.mjs` passed `53/53`.
- `node --test tests/sphReactionGpuKernel.test.mjs` passed `11/11`.
- `npm run test:physics-atomics` passed `11/11`; the three long-horizon
  liquid acceptance gates remained opt-in/skipped.
- Browser probe `/tmp/ulg-reaction-gas-radius-proxy-probe.json` completed
  `status=good`, analysis `good`, browser console issues/warnings `0/0`, four
  nonblank captured visual frames, material/phase counts still included
  `naoh|gas`, and the final sphere max radius dropped from the earlier
  `0.5263000726699829 m` hot `naoh|gas` sphere to
  `0.15508762001991272 m`, matching the reported gas cap
  `0.15508762272485 m`.

Remaining:

- Add reset/lockup regression coverage after the reset functionality fix lands.
- Add a longer browser reaction sequence that proves gas/product ledgers still
  feed later gas pressure or field visualization without reintroducing giant
  visible gas particles.

## Implementation Status - 2026-06-19 AKDT

Added mounted browser reset/lockup coverage for the Na/H2O resident reaction
path:

- The existing mounted Na/H2O resident browser test now captures WebGPU console
  issues, runs a no-full resident reaction step, renders with full parity
  row/field readback, resets, then runs a second resident reaction/render pass.
- The first pass asserts the retained product-event buffer feeds the spatial
  gas ledger producer and gas-cell EOS stages without full product-event
  readback. The retained producer reports positioned product-event rows rather
  than the aggregate fallback.
- Both passes assert G2P particle-scale policy
  `gpu-g2p-cap-policy-applied-in-shader`, render-row particle-scale policy,
  max radius growth `4`, max `J=64`, positive support/gas radius caps, decoded
  gas-phase rows, and max decoded particle radius under the gas visual proxy
  cap.
- The reset pass proves the reaction/product/render path remains live after
  `peercompute.ulg.sph-demo-reset-status.v0` reports
  `particle-state-resynced-after-reset`.

Validation:

- `node --check tests/demo.e2e.mjs`
- `git diff --check`
- `PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:5637 PLAYWRIGHT_WEB_SERVER_URL=http://127.0.0.1:5637 PLAYWRIGHT_WEB_SERVER_COMMAND='npm run dev -- --host 127.0.0.1 --port 5637' PLAYWRIGHT_WEB_SERVER_TIMEOUT_MS=60000 npx playwright test --config tests/playwright.config.mjs --grep "resident Na/H2O promotes product gas pressure"` passed `1/1`.

Remaining:

- Superseded by the consecutive resident reaction pressure sequence below; the
  remaining sequence work is broader long-horizon coverage beyond Na/H2O.

## Implementation Status - 2026-06-19 AKDT

Promoted retained spatial gas pressure back into the no-full resident pressure
summary and render input:

- `gasPressureSummaryFromResidentReaction()` now accepts pressure-interface
  state, finds retained spatial gas species ledgers produced from resident
  product-event rows, aggregates per-species gas moles without full
  product-event readback, and emits
  `gpu-resident-pressure-interface-spatial-gas-summary`.
- Imported gas-cell EOS fields now preserve
  `resident-spatial-gas-species-ledger-eos-ready` status when they are already
  local-gradient ready, so the pressure feedback no longer mislabels a retained
  producer field as empty or invalid.
- The mounted hot loop re-promotes resident gas pressure after
  pressure-interface refresh and after render refresh, then feeds the promoted
  pressure summary into render-state refresh. The focused browser harness now
  mirrors this sequence explicitly.
- The mounted Na/H2O resident browser regression now requires the promoted
  pressure source `gpu-resident-pressure-interface-spatial-gas-ledger`, ready
  spatial gas ledger counts, local gas-cell EOS readiness, and render-state
  pressure input from that promoted summary.

Validation:

- `node --check src/runtime/sphPhaseDemo.js`
- `node --check src/visualization/sphPhaseDemoMount.js`
- `node --check tests/sphPhaseDemo.test.mjs`
- `node --check tests/demo.e2e.mjs`
- `node --test tests/sphPhaseDemo.test.mjs` passed `38/38`.
- `node --test tests/sphRenderGpuKernel.test.mjs` passed `53/53`.
- `PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:5637 PLAYWRIGHT_WEB_SERVER_URL=http://127.0.0.1:5637 PLAYWRIGHT_WEB_SERVER_COMMAND='npm run dev -- --host 127.0.0.1 --port 5637' PLAYWRIGHT_WEB_SERVER_TIMEOUT_MS=60000 npx playwright test --config tests/playwright.config.mjs --grep "resident Na/H2O promotes product gas pressure"` passed `1/1`.

Remaining:

- Add a longer browser reaction sequence so promoted gas/product ledgers feed
  subsequent gas pressure and field visualization over multiple resident
  batches without reintroducing giant visible gas particles.

## Implementation Status - 2026-06-19 AKDT

Extended the mounted Na/H2O browser sequence across consecutive resident
batches:

- The focused Playwright harness now runs first resident pressure/render pass,
  a second consecutive resident pressure/render pass without reset, then reset,
  then a post-reset resident pressure/render pass.
- The consecutive pass requires the promoted pressure source to stay
  `gpu-resident-pressure-interface-spatial-gas-ledger`, pressure to remain above
  baseline, render state to consume the promoted pressure source, and all
  existing G2P/render-row particle-scale bounds to remain active.

Validation:

- `node --check tests/demo.e2e.mjs`
- `PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:5637 PLAYWRIGHT_WEB_SERVER_URL=http://127.0.0.1:5637 PLAYWRIGHT_WEB_SERVER_COMMAND='npm run dev -- --host 127.0.0.1 --port 5637' PLAYWRIGHT_WEB_SERVER_TIMEOUT_MS=60000 npx playwright test --config tests/playwright.config.mjs --grep "resident Na/H2O promotes product gas pressure"` passed `1/1`.

Remaining:

- Superseded by the alkali/H2O browser expansion below. Remaining browser
  coverage is broader long-horizon resident batches and additional
  non-alkali/multivalent reaction pairs.

## Implementation Status - 2026-06-19 AKDT

Extended mounted resident reaction browser coverage beyond Na/H2O:

- The focused Playwright harness now opens Na/H2O first and preserves the
  existing first pass, consecutive pass, reset, and post-reset resident
  pressure/render assertions.
- The same console-guarded harness then opens K/H2O and runs two consecutive
  no-full resident pressure/render passes. K/H2O requires retained product
  mass, KOH/H2 material keys, promoted
  `gpu-resident-pressure-interface-spatial-gas-ledger` pressure, pressure above
  baseline, G2P particle-scale policy, render-row particle-scale caps, and
  support-radius bounds.
- The harness now also opens Cs/H2O and runs two consecutive no-full resident
  pressure/render passes. This covers the heavier alkali material/product path
  (`Cs`, `csoh`, `h2`) that previously appeared in live WebGPU console-error
  reports, while keeping the same retained product mass, promoted spatial gas
  pressure, and scale-bound policy assertions.
- Na/H2O still requires decoded gas render rows and max decoded radius under
  the gas visual proxy cap. K/H2O and Cs/H2O keep product/gas ledger pressure
  coverage without assuming the global max rendered particle is a gas row.

Validation:

- `node --check tests/demo.e2e.mjs`
- `git diff --check -- tests/demo.e2e.mjs`
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "resident alkali/H2O promotes product gas pressure"` passed `1/1`.

Remaining:

- Add broader long-horizon resident batches beyond the current two-pass K/H2O
  and Cs/H2O sequences.
- Add representative non-alkali or multivalent reaction pairs once their
  pressure/product routes have stable browser-ready expectations.

## Implementation Status - 2026-06-20 AKDT

Extended mounted alkali/H2O resident browser coverage into longer consecutive
K/H2O and Cs/H2O sequences:

- K/H2O now runs first pass plus two consecutive no-full resident continuation
  batches. The second continuation asserts resident product carry-forward from
  the first continuation, promoted spatial gas pressure above baseline, render
  pressure consumption from `gpu-resident-pressure-interface-spatial-gas-ledger`,
  and the same G2P/render-row particle-scale policies and support-radius bounds.
- Cs/H2O now mirrors the same first pass plus two consecutive no-full resident
  continuation batches for the heavier `Cs`, `csoh`, and `h2` path.
- Na/H2O still covers first pass, continuation, reset, and post-reset resident
  reaction/render behavior.

Validation:

- `node --check tests/demo.e2e.mjs`
- `git diff --check -- tests/demo.e2e.mjs`
- `PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:5637 PLAYWRIGHT_WEB_SERVER_URL=http://127.0.0.1:5637 PLAYWRIGHT_WEB_SERVER_COMMAND='npm run dev -- --host 127.0.0.1 --port 5637' PLAYWRIGHT_WEB_SERVER_TIMEOUT_MS=60000 npx playwright test --config tests/playwright.config.mjs --grep "resident alkali/H2O promotes product gas pressure"` passed `1/1` in `4.7m`.

Remaining:

- Add representative non-alkali or multivalent reaction pairs once their
  pressure/product routes have stable browser-ready expectations.

## Implementation Status - 2026-06-20 AKDT

Extended mounted resident browser coverage to the first multivalent
active-metal/H2O case:

- `chemistry/reactionCandidates` now has focused coverage proving Ca/H2O emits
  the same `active-metal-water-hydroxide` family as Li/Na/Cs, with exact
  divalent stoichiometry `Ca + 2 H2O -> Ca(OH)2 + H2`.
- The SPH reaction discovery adapter now covers `Ca -> caoh2`, preserving the
  balanced stoichiometry metadata and product closure production.
- The mounted resident browser harness was renamed from alkali/H2O to
  active-metal/H2O and now opens Ca/H2O after the Na/K/Cs sequence. Ca/H2O runs
  a first no-full resident pass plus one continuation, asserting `Ca`, `h2o`,
  `caoh2`, and `h2` material keys, resident product carry-forward, promoted
  spatial gas pressure above baseline, render pressure consumption, clean
  WebGPU console output, and the same G2P/render-row scale-bound policies.

Validation:

- `node --check tests/chemistryReactionCandidates.test.mjs`
- `node --check tests/reactionDiscovery.test.mjs`
- `node --check tests/demo.e2e.mjs`
- `node --test tests/chemistryReactionCandidates.test.mjs tests/reactionDiscovery.test.mjs tests/materialPropertyProvenance.test.mjs` passed `20/20`.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 npx playwright test --config tests/playwright.config.mjs --grep "resident active-metal/H2O promotes product gas pressure"` passed `1/1` in `5.6m`.

Remaining:

- Add broader long-horizon resident batches for Ca/H2O and other non-alkali or
  multivalent pairs. The current Ca/H2O long-horizon and representative
  non-water Mg/O2 browser acceptance are recorded below.

## Implementation Status - 2026-06-20 AKDT

Added the first mounted representative non-water binary product browser
acceptance case:

- `tests/demo.e2e.mjs` now covers hot Mg/O2 -> MgO as a separate mounted
  resident no-full browser workflow instead of overloading the H2 pressure
  assertions.
- The test requires a one-reaction binary-ionic table with balanced
  `2 Mg + O2 -> 2 MgO` stoichiometry, a condensed `mgo` product term,
  product-phase metadata, retained resident product-event rows, fixed-capacity
  reaction-bin diagnostics, and G2P particle-scale policy retention.
- Because MgO is not a gas product, the acceptance signal is deliberately
  different from active-metal/H2O: zero gas-product table rows, zero resident
  gas-species ledger rows, baseline gas-pressure source, render-bound product
  event buffer, and decoded `mgo` render rows.

Validation:

- `node --check tests/demo.e2e.mjs`
- `NODE_TLS_REJECT_UNAUTHORIZED=0 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs tests/demo.e2e.mjs --grep "SPH phase mounted non-water binary reaction retains condensed product events" --timeout 300000` passed `1/1` in `40.3s`.

Remaining:

- Optional broadening to additional pairs such as Cl2 or Al/O2 after their
  UI/product expectations are intentionally selected.

## Implementation Status - 2026-06-20 AKDT

Broadened the mounted representative non-water binary product browser
acceptance case to Al/O2 and Na/Cl2:

- `tests/demo.e2e.mjs` now runs the condensed-product binary route for Mg/O2
  and Al/O2. The Al/O2 case uses hot `Al` at `3200 K`, above the current
  provisional activation threshold, and requires the balanced
  `4 Al + 3 O2 -> 2 Al2O3` binary-ionic table.
- `src/visualization/sphMaterialOptions.js` now exposes `cl2` as a selectable
  first-principles-derived formula material, and the same mounted browser gate
  covers hot Na/Cl2 -> NaCl with balanced `2 Na + Cl2 -> 2 NaCl`
  stoichiometry.
- The shared browser helper asserts condensed product-term metadata, zero
  gas-product/gas-species rows, baseline gas-pressure source, retained resident
  product-event rows, render-bound product-event buffers, fixed-capacity
  reaction-bin diagnostics, G2P particle-scale policy retention, and decoded
  product render rows for `mgo`, `al2o3`, and `nacl`.
- A colder Al/O2 probe at `1800 K` built the correct reaction table but did not
  activate visible Al2O3 product rows, so the browser acceptance now records the
  intentionally selected activation-compatible UI expectation.

Validation:

- `node --check src/visualization/sphMaterialOptions.js`
- `node --check tests/sphMaterialOptions.test.mjs`
- `node --check tests/demo.e2e.mjs`
- `node --test tests/sphMaterialOptions.test.mjs` passed `4/4`.
- `git diff --check -- tests/demo.e2e.mjs tests/reactionDiscovery.test.mjs`
- `NODE_TLS_REJECT_UNAUTHORIZED=0 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs tests/demo.e2e.mjs --grep "SPH phase mounted non-water binary reactions retain condensed product events" --timeout 540000` passed `1/1` in `3.9m`.

Remaining:

- Optional broadening to additional binary/non-water pairs after their
  activation and product-render expectations are intentionally selected.

## Closure - 2026-07-06

All required fixes and acceptance gates in this plan are implemented and
validated (G2P particle-scale stability caps + policy retention, resident
scale diagnostics, mounted browser gates for Na/H2O, Mg/O2, Al/O2, Na/Cl2
product routes). Only "optional broadening to additional pairs" remains,
which is covered by the standing random-element spot-check directive
(today's K->H2O check ran a 2536 K exothermic route in both render modes
with bounded scales and no console issues). Moving to done.
