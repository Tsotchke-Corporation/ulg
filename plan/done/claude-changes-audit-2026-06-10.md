# Claude Changes Audit - 2026-06-10

## Scope

Audited the committed local history after Claude's takeover from `606c23d` through
`2912f5a`, plus the live handoff in `plan/codex-handoff-2026-06-10.md`.
The worktree was clean at the start of this audit; Claude's changes were already
committed locally. No push was made.

## Summary of Claude's Changes

- Added a broad first-principles substrate: atomic Kohn-Sham DFT, molecular
  Hartree-Fock/UHF/MP2 helpers, geometry optimization, vibrational frequencies,
  Born-Oppenheimer MD, and thermochemistry support.
- Added derived material closures for elemental metals, water/air/hydrogen/oxygen,
  optical color, thermal behavior, and reaction-product compounds.
- Replaced the demo mechanics with MLS-MPM, including phase-aware EOS,
  closure-derived stiffness, per-axis box dimensions, wall thermal coupling,
  steam/phase rendering, and continuous MarchingCubes surfaces.
- Added generalized reaction discovery for material pairs, including Na + H2O ->
  NaOH and H2 + O2 -> H2O, with enthalpy derived from the molecular engine.
- Expanded the SPH phase overlay with selectable materials, temperatures, box
  dimensions, particle counts, URL state, live blob-size control, and a standalone
  GitHub Pages build under `docs/`.
- Added handoff/audit planning docs, including `plan/codex-handoff-2026-06-10.md`
  and `plan/frontier-todo.md`.

## Findings

### Fixed: reset-only controls made live reactions look broken

Changing the drop material to Na only updated the URL. The simulation driver was
rebuilt only by the Reset button, so pressing Play after changing the dropdown
could still run the old Fe/H2O driver. This matched the reported "Na + H2O does
not visibly react" symptom.

Fixed in this pass:

- `src/visualization/sphPhaseDemoMount.js` now auto-rebuilds the driver and scene
  for material, temperature, block-height, box-size, particle-count, and wall
  changes.
- The panel labels now say "auto-applies" instead of "apply with Reset".
- `overlay.__sphDriver` is refreshed on rebuild for visual/e2e inspection.

### Fixed: reaction products kept reactant MPM reference state

`reactiveStep()` changed `particle.material` and internal energy, but did not
update `restDensityKgPerM3`, `mpmVolume0`, deformation gradient, affine velocity,
or cached solid state. Product particles could therefore have product EOS targets
while carrying reactant mechanical volume/state.

Fixed in this pass:

- `src/runtime/sph/reactiveChemistry.js` now derives the product rest density
  from the product closure and current post-reaction energy.
- Reacted MPM particles reset `restDensityKgPerM3`, `mpmVolume0`, `mpmF`, `mpmJ`,
  `mpmC`, and `mpmSolid`.
- `tests/reactiveChemistry.test.mjs` covers this state transition.

### Fixed: stale SPH visual regression

The e2e expected the old overlay title and the old water material key. The current
default H2O block is solid ice and renders under the `ice` surface key.

Fixed in this pass:

- `tests/demo.e2e.mjs` expects `SPH PHASE - two materials interacting`.
- The default continuous-surface visual test checks `ice` + `fe`.
- A new visual regression verifies room-temperature Na + liquid H2O, NaOH
  product particles, a visible `naoh` MarchingCubes surface, nonblank canvas
  pixels, and writes `test-results/sph-naoh-room-temperature-reaction.png`.

### Fixed: active-metal + water used metal melting as a fake barrier

The first chemistry pass used `max(metal melting point, water melting point)` as
the reaction gate. That incorrectly required sodium to be molten before reacting
with water. Solid sodium reacts with liquid water at room temperature.

Fixed in this pass:

- `src/runtime/sph/reactionDiscovery.js` now gives the active-metal + water
  family an explicit phase requirement: `h2o` must be `liquid` or `gas`.
- The same reaction family no longer uses the metal melting point as an
  activation temperature. Its thermal gate is zero until a real transition-state
  barrier is derived.
- `src/runtime/sph/reactiveChemistry.js` enforces per-reactant phase
  requirements from the phase-equilibrium closure before converting particles.
- `tests/reactiveChemistry.test.mjs` covers solid Na reacting with liquid water
  at 293.15 K and blocking hot Na against solid ice until liquid water is
  locally available.

### Remaining: generic-material status still has Fe/H2O preflight rows

The demo is now "two arbitrary materials", but status still displays Fe/ice/air
thermodynamic preflight fields. It now also shows `material phases`, which makes
products visible, but the preflight block should be generalized or clearly
separated as the legacy Fe/H2O feasibility reference.

### Remaining: material selector may overstate element applicability

`metallicElementSymbols()` exposes a broad set of elements through the jellium
metal closure path. The UI should categorize or gate elements by
`metallicModelApplicable` and explain unsupported chemistry without implying all
elements have equal physical fidelity.

### Remaining: reaction discovery is synchronous on the browser main thread

First-time reactive pairs run molecular HF discovery synchronously, causing a
multi-second UI stall. This is scientifically honest but poor UX and can make
the demo appear frozen. Move reaction discovery into a worker or precompute/cache
common pairs with provenance.

### Remaining: chemistry model is still reduced

The current reaction network is useful evidence, not validated chemistry:

- active-metal + water availability is phase-gated, but real rate constants and
  transition-state barriers are still not derived;
- product stoichiometry is capped to small formula units;
- H2 byproduct from metal + water is folded into heat, not a separate gas;
- reaction enthalpies are HF/STO-3G and basis-limited to Z <= 18.

## Verification Performed

- `node --check src/runtime/sph/reactiveChemistry.js`
- `node --check src/visualization/sphPhaseDemoMount.js`
- `node --check tests/demo.e2e.mjs`
- `node --test tests/reactiveChemistry.test.mjs tests/reactionDiscovery.test.mjs tests/sphPhaseDemo.test.mjs tests/sphPhaseRenderer.test.mjs`
- Headless room-temperature Na/H2O scenario: after 120 driver steps,
  `counts = { h2o: 101, naoh: 48, Na: 3 }`.
- `npm test` passed: 42/42.
- `npm run build` passed with the existing Vite large-chunk warning.
- `npm run test:e2e -- --grep "SPH phase demo"` passed: 2/2.
- `npm run test:e2e` passed: 4/4.
- `git diff --check` passed.
