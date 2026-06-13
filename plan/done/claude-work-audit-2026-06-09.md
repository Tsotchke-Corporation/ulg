# Claude Work Audit - 2026-06-09

Audit time: 2026-06-09 09:59 AKDT

## Scope

This audits the current ULG repository state and recent Claude work visible from
git commits, the implementation log, source files, and local verification. It
does not audit sibling repos except where ULG artifacts refer to MoonLab,
Eshkol, or PeerCompute.

## Executive Summary

Claude is actively building the SPH phase/material-derivation path, not just
planning. Since the prior SPH phase demo plan commit, Claude has made a run of
local commits that add:

- closure refresh lifecycle and opt-in ULG runtime handoff,
- SPH thermodynamic energy preflight,
- SPH phase closure contracts, MaterialRegistry, and thermodynamic core,
- CPU-reference conservative SPH carrier,
- MoonLab-style microphysics references,
- browser SPH phase demo with closure-backed color,
- first-principles-ish thermal/optical/material closure models,
- Gruneisen/Richards/Trouton EOS and phase derivation helpers,
- a general MD/statistical-mechanics engine,
- ab-initio-to-potential fitting,
- condensed-phase MD property estimators,
- a reduced electronic-structure frontier slice: uniform electron gas / LDA
  core and jellium cohesion for simple metals.

The current uncommitted active change is narrower: a mobile-friendly
collapsible control drawer for `src/visualization/sphPhaseDemoMount.js`, plus
the corresponding top-of-log entry.

The work is moving in the right direction for "core technology first", but it
is not yet a GPU-resident 60 Hz architecture and it does not yet satisfy the
full ice-on-molten-iron spec. The most important mismatch: the current default
SPH scenario uses a 0.5 m iron cube, not the requested 1 m iron cube, by setting
iron volume to one eighth of the ice volume.

## Current Git State

Current HEAD:

- `5a9178b` / tag `electronic-structure-frontier-claude`
- commit message: `March into the frontier: periodic electronic structure (UEG/LDA + jellium cohesion)`

Recent Claude-tagged commits:

- `5a9178b` `electronic-structure-frontier-claude`
- `7889cce` `md-condensed-and-fitting-claude`
- `f73f855` `general-md-engine-claude`
- `b63ffa3` `material-eos-claude`
- `cac0084` `first-principles-closures-claude`
- `bf22a0a` `sph-phase-demo-claude`
- `d66da56` `moonlab-microphysics-claude`
- `7049c7c` `sph-phase-p4-carrier-claude`
- `08378e8` `sph-phase-p1p2p3-claude`
- `056aba5` `sph-phase-preflight-claude`
- `bee4449` `closure-refresh-lifecycle-claude`

Aggregate change from `68f9d58` to HEAD:

- 58 files changed.
- 6776 insertions, 20 deletions.
- New major trees include:
  - `src/runtime/material/`
  - `src/runtime/md/`
  - `src/runtime/electronicStructure/`
  - `src/runtime/sph/`
  - `src/visualization/sphPhaseDemoMount.js`
  - `src/visualization/sphPhaseScene.js`
  - many focused tests.

Uncommitted status relevant to this audit:

- `M plan/log.md`
- `M src/visualization/sphPhaseDemoMount.js`
- deleted old moved files:
  - `plans/claudehandoff.md`
  - `plans/sphphasedemo.md`
- untracked moved/new plan files:
  - `plan/claudehandoff.md`
  - `plan/sphphasedemo.md`
  - `plan/perf-upgrade.md`
  - `plan/ulg-runtime-plan.md`
  - `plan/claude-audit.md`
- pre-existing `D agents.md` remains.

## Verification Run

Commands run during this audit:

- `npm test`
- `npm run build`
- `git diff --check`
- ICC status check for ULG.

Results:

- PASS: `npm test` passed all 28 test files.
- PASS: `npm run build` passed.
- PASS: `git diff --check` clean.
- NOTE: Vite still emits the existing large chunk warning for the main bundle.
- NOTE: ICC is stale. It still indexes `9946a125...`, while current HEAD is
  `5a9178b...`. This audit relies on live git/source/log evidence, not the ICC
  architecture summary.

## What Claude Is Working On

### 1. SPH Phase Demo Path

Claude has implemented a reduced browser demo path:

- `src/runtime/sphPhaseDemo.js`
- `src/visualization/sphPhaseDemoMount.js`
- `src/visualization/sphPhaseScene.js`
- `tests/sphPhaseDemo.test.mjs`

The demo builds an ice-on-iron particle cloud, runs thermodynamic preflight,
uses a CPU-reference SPH carrier, derives per-particle phase from internal
energy, and derives render colors from radiation/optical closures.

Current explicit scope in code:

- CPU reference.
- Reduced resolution.
- Evidence-only.
- Condensed-phase EOS, wall heat flux, conduction, and full multi-material
  coupling are still future/P5.

Audit finding:

- The current default scenario does not match the user-requested 1 m iron cube.
  `createSphPhaseScenario()` defaults `ironVolumeFractionOfIce` to `1 / 8`,
  which gives a 0.5 m iron edge for a 1 m ice cube. This may be physically more
  feasible, but it is not the requested demo unless clearly exposed as a
  user-selectable alternate configuration.

### 2. SPH Preflight, Wall Boundaries, And Particle Resolution

Claude added:

- `src/runtime/thermoPreflight.js`
- six wall face temperatures: `xMin`, `xMax`, `yMin`, `yMax`, `zMin`, `zMax`
- particle resolution fields for H2O, Fe, and gas,
- per-wall lumped heat ledger,
- feasibility logic for cold solid iron plus frozen H2O.

Audit findings:

- Six wall temperatures exist in the scenario/preflight path.
- The preflight ledger is still a 0-D lumped equal-area model, not a resolved
  conductive wall/air/particle heat-flux solve.
- Particle-resolution fields exist in the scenario, but the current
  `buildSphPhaseDemoState()` derives particle counts from spacing
  (`ironSpacingM`, `iceSpacingM`) rather than using the scenario's requested
  macro-particle counts. This needs wiring before the UI can honestly claim
  user-selected particle counts.

### 3. Closure Contracts, Material Registry, And Thermodynamic Core

Claude added:

- `ulg-gpu-abi/src/sphPhaseContracts.js`
- `src/runtime/material/MaterialRegistry.js`
- `src/runtime/material/materialClosures.js`
- `src/runtime/material/thermoState.js`
- `src/runtime/material/phaseEquilibrium.js`
- `src/runtime/material/thermodynamicPreflight.js`
- tests for contracts, material thermo, and preflight.

This work lines up with the core ULG contract/provenance direction:

- closure artifacts have validity domains and overclaim guards,
- MaterialRegistry samples through ClosureRegistry,
- out-of-domain material sampling emits refresh requests rather than silently
  extrapolating,
- phase is mapped from specific internal energy with a lever-rule style solver.

Audit finding:

- Much of this is still backed by reference fixtures, not validated
  MoonLab/Eshkol-derived production closures. The code is generally honest
  about validation flags staying false.

### 4. Conservative SPH Carrier

Claude added:

- `src/runtime/sph/sphState.js`
- `src/runtime/sph/sphOperators.js`
- `src/runtime/sph/sphPhaseCarrier.js`
- `src/runtime/sph/sphConservation.js`
- `tests/sphCarrier.test.mjs`

The carrier is a CPU-reference SPH implementation with:

- density summation,
- cubic spline kernel,
- ideal-gas pressure,
- symmetric momentum/energy operators,
- artificial viscosity,
- leapfrog/KDK stepping,
- conservation reporting,
- phase summaries from material energy.

Audit findings:

- This is useful substrate, but it is not yet the required material/EOS SPH
  solve for ice, liquid water, steam, molten iron, and solid iron.
- The operator still uses ideal-gas pressure. Condensed-phase EOS and
  multi-material heat/phase coupling are explicitly pending.
- It is CPU O(N^2)-style reference work, not a 60 Hz WebGPU-resident runtime.

### 5. MoonLab/Microphysics And First-Principles Closure Work

Claude added:

- `src/runtime/material/microphysicsData.js`
- `src/runtime/material/microphysicsReferences.js`
- `tools/moonlab-microphysics/`
- thermal/statistical helpers under `src/runtime/material/`
- optical and radiation closures.

The direction is to derive closure inputs from lower-level evidence rather than
hard-code a color or material constant directly in the renderer.

Audit findings:

- H2O has a produced/model-quality microphysics reference in this ULG tree.
- Fe and air are still marked pending in material closure provenance.
- Optical/radiation closure code is a meaningful step, but it is not validated
  against measured optical/EOS references yet.

### 6. General MD And Ab-Initio To Potential Pipeline

Claude added:

- `src/runtime/md/mdEngine.js`
- `src/runtime/md/propertyEstimators.js`
- `src/runtime/md/pairPotential.js`
- `src/runtime/md/potentialFitting.js`
- `tests/mdEngine.test.mjs`
- `tests/mdCondensed.test.mjs`
- `tests/potentialFitting.test.mjs`

This is the most important architectural correction relative to one-off
material formulas:

- generic MD integration,
- generic property estimators,
- diffusion order parameter,
- EOS scans,
- bulk modulus from pressure/volume response,
- melting scans,
- Morse potential fitting from an ab-initio energy curve.

Audit findings:

- This is CPU MD, not GPU MD.
- It currently proves the method on small fixtures like Lennard-Jones argon and
  H2 potential fitting.
- It does not yet give validated H2O ice/water/steam or Fe solid/liquid
  closures at production fidelity.

### 7. Electronic Structure Frontier Work

Claude added:

- `src/runtime/electronicStructure/uniformElectronGas.js`
- `src/runtime/electronicStructure/jelliumCohesion.js`
- `tests/electronicStructure.test.mjs`

This implements:

- UEG/LDA energy pieces,
- Chachiyo correlation,
- simple-metal jellium cohesion,
- sodium-style validation of density and bulk modulus.

Audit finding:

- The code explicitly scopes this to nearly-free-electron simple metals.
- It does not apply to iron. Iron needs a Kohn-Sham DFT/orbital/eigenvalue
  solve with d-electron treatment or another validated high-fidelity reference.
- This is good frontier scaffolding but should not be used to claim Fe material
  derivation for the demo yet.

### 8. Current Uncommitted Mobile UI Change

The active uncommitted code change is:

- `src/visualization/sphPhaseDemoMount.js`

It changes the SPH demo overlay from a fixed side column to:

- full-viewport scene,
- slide-in control drawer,
- always-visible menu toggle,
- drawer collapsed by default on narrow screens,
- touch-sized controls,
- mobile media query.

This matches the latest `plan/log.md` entry and is UI-only.

## Risks And Issues

### High Priority

1. **Geometry mismatch with requested demo.**
   The requested setup is a 1 m ice cube on a 1 m molten iron cube. The current
   default preflight/demo uses a 1 m ice cube and a 0.5 m iron cube. This should
   be corrected or made an explicit scenario variant.

2. **CPU-reference path is growing while the performance plan says GPU-resident
   hot loop.**
   Current SPH, MD, property estimators, and electronic-structure work are CPU
   implementations. They are useful references, but not the 60 Hz architecture.
   Next work should split CPU reference from GPU hot-loop data layouts and
   kernels.

3. **Particle-count controls are not fully wired.**
   The scenario carries particle-resolution fields, but the demo state builder
   still chooses particle counts from spacing. The user-facing "set particle
   count" requirement is not implemented yet.

4. **Material derivation remains partially fixture/model-backed.**
   The pipeline is better, but Fe, air, high-fidelity H2O, optical properties,
   and DFT-quality references are not fully derived/validated.

### Medium Priority

5. **SPH physics is not yet material EOS/phase physics.**
   The carrier uses ideal-gas pressure and lacks P5 wall heat flux, conduction,
   condensed EOS, evaporation/condensation coupling, and resolved gas pressure.

6. **Jellium/electronic structure scope could be misread.**
   The code comments are honest, but the audit should preserve the warning:
   jellium is not valid for iron.

7. **Plan-folder move remains unstaged.**
   `plans/` deletions and `plan/` additions are still in the working tree. This
   is probably intentional from the user's move, but it needs a clean local
   checkpoint eventually.

8. **ICC is stale.**
   Any agent relying on ICC summaries will miss the entire SPH/MD/electronic
   structure run unless ICC is refreshed.

## Recommended Next Steps

1. Reconcile the demo defaults with the requested physical scenario:
   - 1 m ice cube,
   - 1 m molten iron cube,
   - 10 m sealed box,
   - six independently controlled wall temperatures,
   - user-set macro-particle counts.

2. Keep the reduced 0.5 m iron case only as an explicit alternate fixture, not
   as the default "spec" demo.

3. Wire particle-resolution config into `buildSphPhaseDemoState()` so particle
   counts are user-controlled and represented molecule/atom counts are reported.

4. Preserve all current validation false/blocker flags. Do not claim Fe/H2O
   phase realism until MD/DFT-derived closures are validated against references.

5. Start the performance-upgrade path:
   - GPU buffer layouts,
   - GPU-resident closure sampling,
   - GPU spatial hash/binning,
   - compact summary readbacks only.

6. Refresh ICC after a clean checkpoint so future agents do not work from the
   stale `9946a125...` index.

7. Decide whether to commit the moved plan files and the current mobile drawer
   change together or keep them separated into local-only commits.

## Bottom Line

Claude is building a substantial first-principles/material pipeline and a
reduced SPH phase demo. The work is productive and tests are green, but it is
still mostly CPU-reference, fixture/model-backed, and not yet the exact
requested 1 m ice-on-1 m iron GPU-resident simulation. The next clean break
should tighten spec conformance and begin moving the hot loop onto WebGPU.
