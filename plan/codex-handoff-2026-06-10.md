# Handoff to Codex — SPH phase demo + first-principles material engine

**Date:** 2026-06-10
**From:** Claude (took over the demo work after Codex's `606c23d`; this doc hands it back)
**Scope:** everything under `src/runtime/**` (physics/chemistry engines + demo orchestration)
and `src/visualization/sphPhaseScene.js` / `sphPhaseDemoMount.js` (the interactive overlay).

The guiding constraint throughout (from the user, repeated and firm): **every material
property — mechanical, thermal, optical, and now reactive — must be DERIVED from the
underlying simulation (atomic DFT / molecular HF / jellium) plus universal physical rules
(Lindemann, Richards, Trouton, Poisson, equipartition). No per-material reference tables,
no faked constants.** Validation flags stay `false` everywhere (evidence-only; the
derivations are HF/STO-3G + minimal-model approximations, not validated against measured
references). Commits are **local only — never push.** Treat the demo as "two arbitrary
materials interacting," not iron/water specifically.

---

## 1. The one open bug (NOT fixed — handed to you)

**Symptom (user report):** selecting Na as the drop block and H₂O as the base, the demo
does not visibly react.

**What I found and fixed (headless):** the reaction logic was correct but the reactants
never came within the reaction's contact radius. In MLS-MPM two condensed bodies transfer
momentum through shared grid nodes, so they rest ~1 grid cell apart and never interpenetrate
to particle-spacing range. The reaction contact radius was `gridSpacing × 1.2 ≈ 0.32 m`,
essentially equal to that rest gap, so no Na–H₂O pair ever qualified. I widened it to
`gridSpacing × 2.5` (commit `0f632a4`, `src/runtime/sphPhaseDemo.js`).

**After that fix, headless it WORKS and is stable.** With the exact UI defaults
(box 5³, Na drop @1850 K, H₂O base @233 K, iron base height 2.5, edges 3/5):

```
step 55:  naoh=0   maxT=1850K  maxV=4.3   nan=0  ~26ms/step
step 60:  naoh=18  maxT=4595K  maxV=4.8   nan=0  ~28ms/step
step 70:  naoh=48  maxT=7776K  maxV=4.6   nan=0  ~27ms/step
step 90:  naoh=54  maxT=4562K  maxV=25.0  nan=0  ~30ms/step
```

The Na contacts the water around driver-step 56, converts (h2o 125 + Na 27 → h2o 98 +
naoh 54), releases the derived heat (temperature spikes, products glow), no NaN, no blow-up.

**So the remaining bug is in the live/browser path, not the physics.** The user still
doesn't see it. Concrete leads to chase, roughly in order of likelihood:

1. **"Apply with Reset" UX.** Material/temperature/box/count changes only take effect when
   the user clicks **Reset** (the driver is rebuilt in the reset handler in
   `sphPhaseDemoMount.js`). Selecting Na in the dropdown and pressing Play *without* Reset
   leaves the driver on the previous materials (default `fe`/`h2o`, which don't react —
   Fe is Z=26, outside the STO-3G basis). Verify the running driver actually has
   `driver.demo.dropMaterial === 'Na'` and `driver.demo.reactionNote` is the Na→naoh note.
   If this is it, the fix is to auto-rebuild on material change (or make the gating obvious).
2. **Synchronous HF stall at build.** `createSphPhaseDemo` now runs reaction discovery
   synchronously, which does ~3 s of HF/UHF for a reactive metal pair (cached per pair after
   the first time — see `discoveryCache` in `reactionDiscovery.js`). In the browser this is a
   ~3 s main-thread freeze on the first selection of a reactive pair. Confirm it completes
   (doesn't throw) in-browser; if it throws, `createSphPhaseDemo` throws and the demo won't
   build. Consider moving discovery to a Worker or showing a "computing chemistry…" state.
3. **Visual blends in.** With the default drop temp 1850 K the Na block is *already*
   incandescent before it reacts, so the reaction glow may not stand out. Lower the drop temp
   (e.g. 600 K) to see the cold metal hit water and then flare. Also the product `naoh`
   renders as a generic surface (`SURFACE_CONFIG.default`); confirm the marching-cubes batch
   for `naoh` actually appears.
4. **Which build is being viewed.** `docs/` is the built GitHub-Pages bundle (rebuilt via
   `npm run build:pages`); the dev server (`npm run dev`) uses live `src/`. Make sure the
   user isn't viewing a stale `docs/` bundle from before the fix.

A headless reproducer (works today): create the demo with the defaults above, step ~200
times, assert `naoh` particles appear (`tests/` has the unit-level pieces;
`tests/reactionDiscovery.test.mjs` covers discovery).

---

## 2. What we changed (since taking over from Codex)

Commits are all suffixed `-claude` (older) or carry `Co-Authored-By: Claude` (recent).
Span: `b4cc4a9` … `0f632a4`. Grouped by area:

### Electronic-structure engines (the "derived" foundation)
- **Atomic DFT** (`src/runtime/electronicStructure/`): Kohn-Sham LDA on a log grid across the
  whole periodic table (Aufbau configs), LSDA spin, Koelling-Harmon scalar-relativistic SCF,
  eigensolver perf pass. Fixed an orbital-reconstruction bug (`u = ŵ/√(2r)`) that overbound
  energies by ~4 Ha.
- **Molecular HF** (`molecularHartreeFock.js`): RHF/UHF, MP2, geometry optimization, harmonic
  vibrational frequencies (Hessian), Born-Oppenheimer MD, Mulliken/Mayer population,
  atomization/reaction energies. **Extended the STO-3G basis from {H,He,C,N,O} to Z=1–18
  (H–Ar)** — data pulled verbatim from the Basis Set Exchange, validated against published
  STO-3G atomic energies (Be/Ne/Mg/Ar). This is what makes Na-containing molecules computable.
  Fixed: MP2 destructure bug (`nBasis`), geometry-optimizer double-wrapped coords.

### Derived material closures
- **`material/elementClosures.js`**: `elementMaterialClosure(Z)` derives a solid+liquid closure
  for any free-electron-metal element — jellium + Ashcroft empty-core + atomic-DFT core radius
  → density / bulk modulus / Debye θ / heat capacity / conduction-electron density; Lindemann
  melting, Poisson shear, Richards fusion entropy. `metallicElementSymbols()` lists ~110.
- **`material/materialClosures.js`**: reference closures for `fe`, `h2o`, `air`, plus `h2`,`o2`
  (diatomic equipartition). Reference moduli are flagged (`closureBacked`, not yet ab-initio).
- **`material/opticalClosure.js`**: metal colour from the Drude plasma frequency (derived from
  conduction-electron density); water/ice colour from O–H vibrational overtones (fundamental from
  a molecular OH force-constant scan); no tabulated spectra.
- **`material/compoundClosure.js` (NEW)**: renderable closure for a *reaction product* compound
  — exact molar mass, volume-additive density + mean bulk modulus from the reactants,
  Dulong–Petit cp, and body colour from the product's HOMO–LUMO gap (absorption edge).

### Mechanics
- **`sph/mlsMpmCarrier.js` (NEW)**: MLS-MPM (APIC transfers, quadratic B-splines, deformation
  gradient F, fixed-corotated elasticity via inlined scalar polar decomposition, weakly-
  compressible fluid via J). CFL velocity clamp + separating wall BC for stability. **Now
  supports a per-axis rectangular box** `[Lx,Ly,Lz]` (per-axis node counts gnx/gny/gnz, index,
  wall BC, clamp). Default mechanical backend.
- **`sph/multiMaterialEos.js`**: phase-aware EOS — pressure from current density vs the phase's
  rest density; condensed `c=√(K/ρ)`, gas `c=√(γRT/M)`; single global `soundSpeedScale` set by
  CFL at the chosen dt so accuracy improves as dt→0.
- **`sph/sphOperators.js`**: de-allocated the O(N²) loops (~6.4× faster).

### Thermo + chemistry
- **`sph/thermalPhase.js`**: pairwise conduction + six-wall Dirichlet flux; now per-axis box.
- **`sph/reactiveChemistry.js`**: `reactiveStep` converts reactant pairs in contact to product
  + releases heat. Gate now uses the **contact (max) temperature** so a hot reactant ignites a
  cooler partner.
- **`sph/reactionDiscovery.js` (NEW)**: discovers the reaction for an arbitrary material pair.
  Layer 1 = universal families (active-metal + water → hydroxide + H₂; fuel/metal + O₂ → oxide)
  with **valence-derived stoichiometry**; layer 2 = a conservative combinatorial fallback.
  ΔH derived from the engine (RHF/UHF), fires only when exothermic. Products capped to ≤3-atom
  formula units and **cached per pair** to keep the synchronous build ~3 s (was 38 s for a
  4-atom cluster). Materials with any element Z>18 are gated with a stated reason (e.g. Fe).

### Demo orchestration + rendering
- **`sphPhaseDemo.js`**: unified sim clock (`mechanicalSubsteps` carrier substeps per
  `driver.step`, thermal over the same sim-time — note `state.step` increments by
  `mechanicalSubsteps` per driver step, easy to trip over when writing step loops). Discovers
  reactions, registers product closures into `materialProperties`, derives sound-speed scale,
  derives solid stiffness from closure moduli. `particleColors` uses the compound's derived
  colour when present.
- **`thermoPreflight.js`**: scenario builder; per-axis `boxDimensionsM`.
- **`visualization/sphPhaseScene.js`**: three.js MarchingCubes continuous surfaces. Render fixes
  this session: (a) **no truncation** — field padding 0.22 so a wall-hugging blob's dome fits;
  (b) **non-cube blobs stay spherical** — isotropic field mapping (all axes normalized by the max
  edge, isotropic mesh scale; the box occupies a sub-region of the field cube rather than being
  stretched); (c) **blob size decoupled from container** — `surfaceRadiusScale` (live setter).
- **`visualization/sphPhaseDemoMount.js`**: full-screen overlay. Controls: 6 wall temps,
  drop/base material dropdowns (fe, h2o, h2, o2 + all metallic element symbols), initial temps,
  block heights, **per-axis box size, per-block particle edge (N→N³), live blob-size**. All
  controls **URL-encoded** (refresh restores). Status panel shows the discovered reaction.
  Material/temp/box/count changes apply on **Reset**; blob size is live.

### GitHub Pages
- `docs/`, `vite.pages.config.mjs`, `pages.html`, `src/sphStandalone.js`: standalone build with
  relative paths (`base './'`). Build: `npm run build:pages`.

**Tests:** 189 passing (`npm test`). New this session: `tests/reactionDiscovery.test.mjs`,
extended `tests/molecularHartreeFock.test.mjs` (basis), `tests/reactiveChemistry.test.mjs`.

---

## 3. Known limitations / frontiers (derived but rough, or not yet done)

See also `plan/frontier-todo.md`. Highlights:

- **Reaction kinetics are not modelled.** Activation temperature = max of the two reactants'
  melting points (a *mobility* proxy for the kinetic barrier), not a real transition-state
  barrier. So H₂+O₂ "ignites" at a low temperature instead of needing a spark.
- **Reduced product stoichiometry.** Products are single ≤3-atom units (MOH, MO) for HF speed —
  exact for monovalent Na (NaOH), approximate for multivalent metals. ΔH stays engine-derived.
- **HF/STO-3G accuracy.** Overestimates reaction enthalpies; gets some marginal cases' sign
  wrong (Li+water, Mg+water come out endothermic here, so they won't react in the demo).
- **Reactions limited to Z≤18.** STO-3G basis covers H–Ar. Fe and other heavy metals can't have
  an engine-derived enthalpy and are gated. Extending the basis (BSE has STO-3G for K–Kr incl.
  transition metals) would unlock them, but STO-3G for 3d metals is poor.
- **No H₂ gas product / no flame.** The H₂ released in metal+water is folded into heat; the
  visible "expansion" is the heat-driven steam, not a separate gas phase.
- **MLS-MPM contact gap.** Distinct condensed bodies rest ~1 grid cell apart (the root of the
  reaction bug above). Anything keyed on true surface contact must account for this.
- **Element densities / transition metals are rough** (jellium); Drude damping γ≈ω_p/30 is an
  estimate; reference moduli for fe/h2o are not yet ab-initio (elastic-tensor-from-DFT frontier).

---

## 4. Running it

```
npm test                 # 189 unit tests
npm run dev              # live dev server (uses src/)
npm run build:pages      # rebuild docs/ standalone bundle (relative paths)
```

The demo overlay is launched from the app UI (`#run-sph-phase`) and also exposes a headless
API on `window.__ulgDemo` for e2e/status checks. `tests/demo.e2e.mjs` has the Playwright
smoke test for the overlay.
