# Reaction Stoichiometry And Energetics Plan

Date: 2026-06-11 AKDT

## Purpose

Fix the two remaining chemistry blockers in the SPH phase demo without adding
material-specific patches:

1. Reaction energetics must not fall back to provisional signs when crude
   generated geometries make the lower-level solve look wrong.
2. Runtime chemistry must consume and produce the full balanced equation,
   including multiple products, gas byproducts, heat, mass, charge, and pressure
   effects.

The goal is still first-principles derivation with cache reuse. Cached values are
performance artifacts only; the source of truth remains the lower-level
electronic, molecular, thermodynamic, and closure chain.

## Why The Demo Speeds Up After Minutes

The slow-then-fast behavior is consistent with cold closure work:

- material closure derivation for selected elements/compounds,
- product closure derivation for reaction candidates,
- optical/PBR table construction,
- thermal graph/phase response packing,
- reaction discovery and energy estimates,
- WebGPU buffer/pipeline setup and first dispatch warmup,
- `localStorage` and in-memory cache misses on the first run.

Once those closures, product materials, graph tables, and GPU resources are in
memory or in the v2 browser-local cache, later rebuilds can skip much of the
expensive JavaScript work. A stale cache, a new generator fingerprint, a new
material pair, or a different validity domain should intentionally make the demo
slow again while values are rederived.

## Current Bugs

### Provisional Energetics

`src/runtime/chemistry/reactionCandidates.js` emits balanced candidates, but it
also marks family energetics as
`provisional-heuristic-not-scientifically-validated`. The SPH adapter in
`src/runtime/sph/reactionDiscovery.js` currently uses the derived energy only
when it is negative or when the candidate heuristic is not negative. If a crude
generated geometry creates a false positive/endothermic sign, the adapter can
select the provisional energy instead.

That is acceptable as a visible evidence warning during exploration, but it is a
strict-mode bug. Strict first-principles mode must either derive a valid
thermochemical result or reject/schedule the candidate for refinement.

### Single-Product Runtime Conversion

`discoverReactionCandidates()` can represent balanced equations such as:

`2 Na + 2 H2O -> 2 NaOH + H2`

The SPH adapter flattens this to `{ a, b, product }`. The CPU path in
`src/runtime/sph/reactiveChemistry.js` and the WebGPU table in
`src/runtime/sph/sphReactionGpuKernel.js` then convert both contacting particles
to the one product material. Gas byproducts such as `H2` are folded into heat or
lost instead of becoming gas inventory and pressure.

Current slice status, 2026-06-11 16:34 AKDT:

- CPU reference discovery/execution now preserves balanced `reactants[]` and
  `products[]` terms for stoichiometric candidates.
- Persistent reaction records that lack term arrays are rejected as stale.
- `reactiveStep()` can allocate a contact pair's mass across multiple product
  terms by coefficient times molar mass. Na + H2O now produces NaOH plus H2 in
  the browser demo instead of only NaOH.
- The SPH demo now reports a sealed-box gas-pressure diagnostic with per-species
  partial pressures; H2 byproduct increases the pressure ledger.
- Remaining bug: this is still a reduced macro-particle conversion, not a full
  extent/inventory solver, and the resident WebGPU reaction kernel still uses
  the older single-product table shape.

Current slice status, 2026-06-11 21:08 AKDT:

- The resident reaction table upload now includes reactant term rows, product
  term rows, and gas-product rows in the GPU combined record order instead of
  uploading only reaction/product-phase/header/product rows.
- The resident CPU reference now consumes the packed reactant/product term rows
  to compute limiting extent from coefficient times molar mass, preserve excess
  reactant mass in-place, compute event heat from consumed mass, and record
  visible plus unplaced product inventory in
  `peercompute.ulg.sph-gpu-reaction-ledger.v0`.
- The resident WGSL `resolve()` kernel now reads reactant terms and product
  terms, computes extent on-GPU, preserves leftover reactants, and emits product
  slots from the packed closure rows. This removes the old single-product
  `productMaterialId`-only execution path for term-table reactions.
- Static reaction table cache rehydration now rebuilds the same combined record
  order, including reactant and gas-product rows.
- New tests cover conserved event-energy behavior, gas product mass ledgers,
  excess-reactant preservation, unplaced gas inventory when the fixed particle
  buffer cannot emit every product term, static-cache record restoration, and
  ABI/WGSL term-reader coverage.
- Remaining bug: the normal WebGPU no-full-readback path still needs resident
  gas/product ledger buffers and compact pressure summaries. Extra products are
  no longer silently lost in the CPU reference, but GPU unplaced inventory still
  needs a GPU-visible ledger rather than only fixed-slot products.

Current slice status, 2026-06-11 21:40 AKDT:

- The no-full-readback WebGPU reaction path now runs a resident compact summary
  pass that binds the proposal buffer plus reaction term table and emits a
  128-byte f32x4 summary rather than full particle arrays.
- The compact summary reports canonical mutual-pair event count, consumed
  reactant mass, expected/raw product mass, visible and unplaced product mass,
  visible and unplaced gas-product mass, sealed-box gas moles, reaction heat,
  mass residuals, ready/problem event counts, and compact-ledger availability.
- Resident step diagnostics and repeated-step summaries preserve those compact
  ledger fields, so performance traces and overlay status can inspect gas/product
  inventory without full readback.
- The sealed-box pressure diagnostic can now consume a resident reaction summary
  plus reaction-table gas metadata. It computes GPU-resident pressure only when
  the gas ledger maps to a single gas species; multi-gas aggregate summaries are
  explicitly marked `gpu-resident-reaction-pressure-insufficient-species-resolution`.
- Remaining bug: this is still an aggregate compact ledger, not a per-species
  gas-product buffer for multiple simultaneous gas products, and extra products
  still need either dynamic append or a resident inventory buffer that downstream
  pressure/EOS kernels consume directly.

Current slice status, 2026-06-11 21:55 AKDT:

- Added a separate per-gas-product compact resident ledger buffer and readback.
  Each row carries material id, mass, moles, visible mass, unplaced mass, event
  count, gas-product index, and status without requiring full particle-array
  readback.
- The gas-species decoder maps those rows back through reaction-table
  gas-product metadata and aggregates duplicate product rows by material, so
  simultaneous gas products can contribute independent partial pressures.
- `gasPressureSummaryFromResidentReaction()` now prefers the resident
  per-species ledger over the aggregate summary and reports
  `gpu-resident-reaction-gas-species-summary` for multi-gas pressure inputs.
- Remaining bug: condensed and gas products that do not fit fixed source slots
  are still only represented as unplaced ledger mass. The next runtime slice
  needs pressure feedback into forces/walls and then dynamic append or a
  renderable product buffer.

Current slice status, 2026-06-11 22:30 AKDT:

- Added a compact WebGPU product-inventory pass keyed by product term. Each row
  reports material id, total mass, visible mass, unplaced mass, moles, event
  count, routing id, charge contribution, mass residual, coefficient, molar
  mass, raw mass, and mass scale without full particle-array readback.
- Added atom-term rows to the reaction table and cold-start/static-table
  restore path. Terms are formula-parser derived from reactant/product formulas,
  so they are general across elements and compounds rather than one-off
  material patches.
- Added a compact WebGPU atom/charge residual pass keyed by atom term. The
  decoder collapses residuals by atomic number and total charge, and resident
  diagnostics plus the SPH overlay now report the atom-residual row count.
- Cache correctness fix: worker static-table reuse now ignores particle count
  alone but rejects stale reaction-table bundles when a changed smoothing/contact
  radius changes the derived reaction table.
- Remaining bug: the residual ledger is diagnostic. The next slice must use
  max atom residual, charge residual, mass residual, and provisional energetics
  status as strict gates before pressure/force coupling treats a reaction as
  valid.

Current slice status, 2026-06-11 22:38 AKDT:

- Added `peercompute.ulg.sph-reaction-strict-gate.v0` to compact resident
  reaction summaries. It blocks strict force coupling when provisional
  energetics, atom residual drift, charge residual drift, missing atom residual
  rows, or unbalanced reaction metadata are present. Product raw-mass scaling is
  reported as a warning rather than falsely treated as conservation failure.
- Added `peercompute.ulg.sph-sealed-gas-pressure-feedback.v0` to gas-pressure
  summaries. It computes gauge pressure against external 1 atm by default,
  derives six per-wall force ledgers from the box dimensions, reports net force,
  and carries the strict reaction gate into `forceCouplingStatus`.
- Resident diagnostics and the SPH overlay now show strict-gate status, pressure
  gauge, total wall load, and why force coupling remains blocked.
- Remaining bug: wall-load feedback is a ledger, not a validated force solve.
  Particle/grid force coupling still needs gas-cell or material-surface pressure
  gradients/normals, and unplaced product inventory still needs dynamic or
  renderable storage.

Current slice status, 2026-06-11 22:56 AKDT:

- Added `peercompute.ulg.sph-gpu-reaction-product-event.v0`, a sparse,
  f32x4-aligned product-event row layout for renderable reaction products.
- Added `sphReactionProductEventWgsl`, which stages particle-major rows as
  `sourceParticleIndex * productTermCount + productTermIndex`, marks rows ready
  only for mutual proposal events, and keeps product events in a separate GPU
  buffer rather than appending them to `combinedRecords`.
- `runSphReactionSummaryWebGpu()` can now either read product-event rows back
  for verification or retain the product-event buffer for downstream GPU
  consumers without copying the sparse rows to JavaScript.
- The no-full-readback reaction step retains product-event storage when output
  particle buffers are retained, and resident MLS-MPM cleanup destroys that
  retained buffer with the step.
- Resident diagnostics, repeated-step summaries, and the SPH overlay now expose
  product-event row count, active readback count when present, readback bytes,
  buffer bytes, and retained-buffer status.
- Remaining bug: the renderer and downstream pressure/EOS kernels do not yet
  consume the product-event buffer as spawned product volume. It is staged and
  lifetime-managed, but not yet drawn or folded into surface extraction.

Current slice status, 2026-06-11 23:12 AKDT:

- The SPH render-field ABI now binds the retained product-event buffer as a
  read-only storage buffer and uses `product_event_count` in the uniform row.
- The render-field shader and CPU reference splat only product-event rows with
  positive `unplacedMassKg`, so visible product mass already emitted into
  source/partner particle slots is not double-rendered.
- The scene builds synthetic surface-table entries from generic product
  inventory rows and `productTermMetadata`, allowing event-only gas or
  condensed products to render through the same material/phase optical table
  path without product-specific patches.
- Remaining bug: pressure/EOS and force-field kernels still need to consume the
  product-event buffer as resident product mass. Three.js MarchingCubes also
  still requires compact field readback until the WebGPU marching-cubes hot-loop
  slice lands.

Current slice status, 2026-06-11 23:27 AKDT:

- `gasPressureSummaryFromResidentReaction()` now keeps the per-species GPU gas
  ledger as the first pressure source, then falls back to gas product-event
  rows when verification rows are available, and then to compact
  product-inventory rows when product-event storage stays GPU-resident.
- Product pressure rows are filtered through generic reaction
  `productTermMetadata`/routing, so condensed products are not counted as gas
  and no material-specific reaction cases are introduced.
- The overlay now accepts all `gpu-resident-reaction-*` pressure sources for
  current gas-pressure/render-pressure diagnostics.
- Remaining bug: this is still diagnostic pressure aggregation. EOS, gas-cell,
  and force-field kernels must consume the resident product mass directly before
  pressure can affect dynamics.

Current slice status, 2026-06-11 23:28 AKDT:

- Added `peercompute.ulg.sph-resident-product-mass.v0`, an explicit resident
  product-mass handle derived from reaction summaries.
- Reaction-step outputs and MLS-MPM resident-step envelopes now expose the
  retained product-event buffer, row count/stride, product-inventory count,
  visible/unplaced mass, unplaced gas mass, and the policy
  `unplaced-product-mass-only`.
- Buffer lifetime is now guarded through
  `destroyResidentProductMassBuffers()`, and resident step cleanup uses the
  handle instead of reaching through nested `reactionSummary` fields.
- Sequence summaries and the SPH overlay report the resident product-mass
  handle and its intentionally blocked EOS/force-coupling status.
- Remaining bug: the handle is ready for binding, but the MLS-MPM/SPH grid,
  gas-cell, EOS, and force kernels still do not consume it dynamically.

Current slice status, 2026-06-11 23:43 AKDT:

- MLS-MPM P2G now accepts the resident product-mass handle as an optional
  sidecar in the CPU reference, optional WebGPU wrapper, and WebGPU binding
  contract.
- The P2G shader binds `product_events` as read-only storage and uses
  `resident_product_event_count` to deposit only active product-event rows with
  positive `unplacedMassKg`. Visible product mass already emitted into particle
  slots is still excluded by policy.
- Repeated resident steps carry the previous step's resident product mass into
  the next step's P2G stage, and cleanup can preserve a carried product-event
  buffer until the borrowing step is finished.
- Remaining bug: this is mass-only grid participation. Product events still
  lack velocity, sound speed, EOS model, support volume, and deformation state,
  so validated pressure/force coupling must come from a product mechanics/EOS
  ABI extension or a GPU gas-cell EOS/inventory kernel before strict dynamics
  can be unblocked. Merging multiple generations of unplaced product-event
  buffers also still needs a GPU append/compaction path.

Current slice status, 2026-06-11 23:54 AKDT:

- Expanded `peercompute.ulg.sph-gpu-reaction-product-event.v0` rows from 20 to
  32 f32 values while preserving the original offsets used by render and
  pressure diagnostics.
- `sphReactionProductEventWgsl` now derives product velocity from consumed
  source/partner momentum and derives support volume plus mechanical/EOS fields
  from product phase records generated by the material-property closure chain.
- Product-event decoders now expose velocity, support volume, bulk/shear/Lame
  constants, sound speed, EOS model id, solid flag, and mechanics status.
- MLS-MPM P2G now consumes those fields: unplaced product mass contributes grid
  mass, product velocity contributes momentum, and pressure stress contributes
  only when support volume/rest density/sound speed/EOS metadata are present.
- Remaining bug: this is still a local product-event mechanics contract, not a
  validated sealed-gas pressure-gradient force solve. Strict force coupling also
  still needs resident product-event append/compaction so unplaced products from
  multiple reaction generations are not represented by a single sidecar buffer.

## Target Model

Reaction discovery should produce a `reactionClosure` object:

- stable schema, for example `peercompute.ulg.reaction-closure.v0`,
- reactant terms: material key, formula, coefficient, phase requirements,
  charge/spin state, molar mass, material id,
- product terms: material key, formula, coefficient, target phase policy,
  gas/condensed routing, molar mass, material id,
- exact atom balance, charge balance, and electron accounting,
- enthalpy/free-energy surfaces over validity domain
  `(temperature, pressure, phase, composition)`,
- activation/rate model or an explicit `barrier-not-derived` blocker,
- provenance for every solver used,
- generator/input/method hashes for cache invalidation,
- validation flags that remain false until benchmarked.

Runtime chemistry should consume that same closure without reducing it to a
single product.

## Implementation Plan

### 1. Balanced Reaction ABI

- Add packed ABI layouts for balanced reaction closures:
  - reaction header rows,
  - reactant term rows,
  - product term rows,
  - gas-product routing rows,
  - heat/free-energy rows,
  - status/validity rows.
- Replace the current reaction-table layout fields
  `aMaterialId`, `bMaterialId`, `productMaterialId`, and
  `specificEnthalpyJPerKg` as the only executable state.
- Keep compatibility shims only for tests and status display; strict runtime
  execution should use term tables.

Files likely touched:

- `ulg-gpu-abi/src/index.js`
- `ulg-gpu-abi/src/wgsl.js`
- `src/runtime/sph/sphReactionGpuKernel.js`
- `tests/abi.test.mjs`
- `tests/sphReactionGpuKernel.test.mjs`

### 2. General Candidate Enumeration

- Promote `discoverReactionCandidates()` from family snippets to a general
  reaction candidate graph:
  - parse all element/compound formulas into atom-count vectors,
  - generate possible oxidation/charge states from electronic closure evidence,
  - use the sedenion periodic table reference as a discovery prior, not a table
    of final answers,
  - balance candidate equations with integer linear algebra over element counts,
    charge, and electron transfer,
  - enumerate element-element, element-compound, compound-compound, gas,
    condensed, decomposition, replacement, acid/base, redox, and precipitation
    families through the same candidate interface.
- Candidates whose balance fails are discarded.
- Candidates whose products cannot receive first-principles material closures are
  blocked, not patched.

Files likely touched:

- `src/runtime/chemistry/formula.js`
- `src/runtime/chemistry/reactionCandidates.js`
- `src/runtime/sph/reactionDiscovery.js`
- `tests/chemistryReactionCandidates.test.mjs`
- `tests/reactionDiscovery.test.mjs`

### 3. Replace Provisional Energetics

- Add a `strictEnergetics` mode that rejects
  `PROVISIONAL_ENERGETICS_STATUS` for executable reactions.
- Replace single crude formula-unit geometry evaluation with a staged solver:
  - generate multiple candidate geometries from valence/bond priors,
  - optimize geometry before final energy evaluation,
  - search plausible spin/multiplicity states,
  - use all-element electronic solver as the common baseline,
  - use HF/UHF only inside its known validity domain,
  - use DFT/MD/free-energy refinement when molecule size, condensed phase, or
    ionic/metallic bonding makes isolated-molecule energy unreliable.
- Compute reaction free energy from compatible species/phase baselines:
  - molecular electronic energy,
  - zero-point and thermal corrections where available,
  - condensed lattice/cohesive energy for solids,
  - solvation or phase correction for liquid water/aqueous products,
  - gas ideal/free-energy terms for vapor products.
- If the fast solver gives a suspicious sign, mark the candidate
  `needs-refined-thermochemistry` and queue a worker/WebGPU refinement. Do not
  invert or replace the sign with a heuristic.

Files likely touched:

- `src/runtime/electronicStructure/*`
- `src/runtime/md/*`
- `src/runtime/material/materialDerivation.js`
- `src/runtime/material/compoundClosure.js`
- `src/runtime/sph/reactionDiscovery.js`
- new `src/runtime/chemistry/reactionEnergetics.js`

### 4. Cache Reaction Closures

- Cache reaction closures separately from material closures.
- Key by:
  - sorted reactant material/formula inputs,
  - full balanced equation,
  - phase/pressure/temperature validity domain,
  - solver method chain,
  - generator fingerprint,
  - ABI/schema version,
  - product closure hashes.
- Store in the PeerCompute-compatible local state representation and mirror to
  `localStorage`.
- Reject stale closures on any input/method/generator/product hash mismatch.
- Show status rows for reaction cache hits, misses, stale records, and active
  worker/GPU derivation.

Files likely touched:

- `src/visualization/sphPhaseDemoMount.js`
- `src/runtime/sphPhaseViewState.js`
- `src/services/ulgRuntime.worker.js`
- `src/runtime/demoRuntime.js`

### 5. CPU Reference Multi-Product Runtime

- Replace pair conversion with stoichiometric extent solving:
  - each macro-particle carries represented moles or molecule count,
  - each contact computes the limiting reactant from coefficients,
  - consumed mass is removed from reactant inventories,
  - products are added by coefficient and molar mass,
  - energy release/absorption is applied by reaction extent,
  - atom count, charge, mass, and energy ledgers are updated.
- Use a per-particle composition vector or product-slot inventory first. Split
  into visible product particles only when needed for rendering.
- Route gas products into gas particles or sealed-box gas cells instead of
  condensed product material.
- Keep the CPU path as a clear reference implementation for WebGPU parity.

Files likely touched:

- `src/runtime/sph/reactiveChemistry.js`
- `src/runtime/sphPhaseDemo.js`
- `tests/reactiveChemistry.test.mjs`
- `tests/sphPhaseDemo.test.mjs`

### 6. WebGPU Multi-Product Runtime

- Port the CPU reference model into resident WebGPU buffers:
  - species/material inventory rows,
  - reactant term rows,
  - product term rows,
  - per-particle or per-cell reaction extent rows,
  - gas-product accumulation rows,
  - energy ledger rows.
- Replace the current mutual-pair `resolve` step that writes one
  `productMaterialId` to both particles.
- Add compact readback summaries:
  - reaction extents,
  - product masses,
  - gas moles by species,
  - heat released/absorbed,
  - atom/mass/charge residuals,
  - pressure contribution.
- Preserve no-full-particle-readback in normal resident runs.

2026-06-11 progress:

- Done for fixed particle buffers: `resolve()` reads packed reactant/product
  term rows, computes limiting extent, preserves leftover reactants, and emits
  term-table products into reusable source slots.
- Done for compact resident summaries: aggregate gas/product totals and
  per-gas-product species rows are available without full readback.
- Done for compact product/residual diagnostics: product-inventory rows and
  atom/charge residual rows are available without full readback.
- Done for gate/wall-ledger feedback: strict reaction gates and pressure
  wall-load ledgers are available in compact diagnostics.
- Still pending: validated pressure force coupling and dynamic/renderable
  product storage for unplaced inventory.

Files likely touched:

- `src/runtime/sph/sphReactionGpuKernel.js`
- `src/runtime/sph/sphMlsMpmGpuStep.js`
- `ulg-gpu-abi/src/wgsl.js`
- `tests/sphReactionGpuKernel.test.mjs`
- `tests/sphMlsMpmGpuStep.test.mjs`

### 7. Gas Byproducts And Sealed-Box Pressure

- Add a gas species inventory for the sealed box or gas cells:
  - air components,
  - H2O vapor,
  - H2 and other reaction gases,
  - optional radioactive/nuclear gases later.
- Compute pressure from moles, volume, temperature, and gas-mixture EOS.
- Feed gas pressure back into SPH/MLS-MPM forces and wall diagnostics.
- Condense/vaporize gas species through phase-equilibrium closures.
- Report partial pressures and total pressure in the overlay.

Files likely touched:

- `src/runtime/material/materialDerivation.js`
- `src/runtime/sphPhaseDemo.js`
- `src/runtime/sph/*Gas*` or new gas modules
- `src/visualization/sphPhaseDemoMount.js`

## Acceptance Tests

- `Na + H2O`, `Li + H2O`, and `Cs + H2O` are discovered through the same
  general path and produce hydroxide plus `H2`, not one fused product.
- `Na + Cl2`, `Mg + Cl2`, and `Al + O2` produce balanced multi-coefficient
  equations and conserve atoms exactly.
- Compound-compound fixtures either produce a balanced first-principles-backed
  closure or report `no-derived-reaction`, never a heuristic product.
- Strict mode rejects any executable reaction with
  `provisional-heuristic-not-scientifically-validated`.
- CPU runtime conserves atom counts, mass, charge, and energy to declared
  tolerances across multi-product reactions.
- WebGPU reaction runtime matches CPU reference for product masses, gas moles,
  heat, phase reset, and pressure summary on small fixtures.
- Sealed-box `Na + liquid H2O` increases `H2` partial pressure from generated
  gas moles and EOS; pressure is not scripted.
- The UI stays responsive while cold reaction closures are derived in workers or
  WebGPU tasks.

## First Implementation Slice

1. Add the balanced reaction closure schema and term-table tests.
2. Preserve `candidate.reactants[]` and `candidate.products[]` through
   `discoverReactions()` instead of flattening to one product.
3. Add strict-mode rejection of provisional energetics.
4. Implement CPU reference stoichiometric extent and gas-product ledger for the
   existing macro-particle state.
5. Add Na/Li/Cs + H2O tests proving shared discovery, H2 byproduct production,
   atom conservation, and pressure contribution.
6. Port the term-table execution to the WebGPU reaction kernel after CPU
   behavior is locked.

## Non-Goals

- Do not add material-specific reaction scripts.
- Do not special-case Na/H2O beyond what falls out of the general active-metal
  water candidate family.
- Do not accept a heuristic energy sign as a valid strict-mode closure.
- Do not reintroduce main-thread long-running closure derivation.
