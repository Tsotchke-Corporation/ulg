# Direction note 1: the Star Spec v0.4 (the destination)

Source: `/home/cos/projects/peercompute/plan/refs/ulg/ULG_PeerCompute_Star_Spec_v0.4.md`
(2,397 lines, "ULG-Star Runtime Spec v0.4", draft dated 2026-06-05, "not a
validated physics code"). Read by Hermes in full, 2026-11-17.

This is the document `plan/project-orientation.md` calls the Star Spec. It
defines what ULG is for. Everything in the G+A campaign is a step on its
Stage 5 (see "Where the campaign sits" at the end).

## The claim (`:14-22`)

- Not: "all macroscopic physics emerges from the nonrelativistic molecular
  Schrödinger Hamiltonian alone".
- But: "ULG allows macroscopic behavior to emerge from a hierarchy of active
  first-principles substrates, quantum/statistical ensembles, coarse-graining
  operators, and validity-checked closures."
- The test case: start "a large mass of hydrogen". "the runtime should not
  instantiate a `Star` object. It should instantiate a carrier graph with mass,
  composition, internal energy, fields, and geometry. The star-like behavior
  appears only if the graph activates the required substrates: gravity,
  quantum-statistical EOS, ionization, opacity, radiation transport,
  nuclear/electroweak fusion, plasma/MHD, and magnetic induction."
- "The graph never calls `makeStar()`." (`:1092`)

## Three hard rules (`:28-66`)

1. **No material property is primitive.** It is (1) directly resolved from
   active microscopic dynamics, or (2) derived from a first-principles task and
   cached as a response closure, or (3) imported as an approximation with
   explicit provenance, validity and uncertainty. "The runtime must never label
   case 3 as fully emergent."
2. **No named phenomenon emerges without the substrate that can generate it.**
   Degeneracy pressure needs Fermi-Dirac statistics; opacity needs light-matter
   coupling and populations; fusion needs nuclear and weak provenance;
   "Dissipation requires coarse-graining, environmental coupling, stochastic
   assumptions, or low-entropy initial state."
3. **Schrödinger is foundational for ordinary electronic matter, not
   universal.** The runtime selects "the deepest active substrate required by
   the local regime" (Schrödinger/BO/DFT; Pauli/Dirac; QED-effective response;
   nuclear + weak; GR/TOV/GRMHD; ensemble + coarse-graining; beyond-DFT).

## The runtime it targets (`:70-104`)

- JS/TS: graph orchestration, validity checks, closure selection, PeerCompute
  task capsules, state deltas, provenance.
- WebGPU/WGSL workers: dense kernels over flat buffers, neighbour lists,
  reductions, stencils, closure interpolation, validation reductions.
- WASM/CPU fallback: f64 reference solves, stiff reaction networks,
  high-precision reductions, small exact eigensystems, validation audits,
  closure fitting.
- "WGSL should not walk the law graph. The graph compiler emits a pass plan
  over flat buffers."

Later owner directions narrow this: 2026-07-09 (GPU-native validation, no CPU
mirror or parity gate for the WebGPU physics) and 2026-11-16 ("we really
shouldn't ever be running anything on the host"). The spec's "CPU reference"
tier is therefore not the current rule for the physics lane.

## The pattern for every closure (`:140-150`)

microphysical substrate + statistical ensemble + response operator +
coarse-grain projection + validity envelope + numerical solver = usable closure.

- "Fundamental material properties are cached response functions derived from
  microphysics plus ensemble state. They are not constants assigned to material
  types." (`:556-558`)
- Mechanical, thermal, electromagnetic and optical properties are derivatives
  of a free energy `F(T, V, N, strain, E, B, ...)`; transport comes from
  correlation functions (Green-Kubo); surface and interface energies from slab
  differences (`:562-674`).
- The mandatory route (`:695-709`): nuclei + electrons + geometry + boundary →
  Hamiltonian task → energy surface / density / DOS / forces → statistical
  ensemble → free energy or response function → closure fit with uncertainty →
  carrier graph uses closure → "state leaves envelope" → closure invalidated or
  refined.
- **"A closure without a validity envelope is invalid by default."** (`:1453`)
- A cache key covers species, geometry, boundary, field, ensemble, method and
  requested output; closures with different methods "are not interchangeable"
  (`:762-776`).
- The closure registry (`:2103-2134`): `register`, `resolve`, `invalidate`,
  `requestRefinement`; "Closure lookup must be deterministic for the same state
  summary and registry snapshot."

## Carriers and the generic pass loop (`:156-244`)

- "A carrier is a sample of physical state", not necessarily a particle: atom,
  molecule, SPH-like parcel, plasma parcel, star macro-particle, radiation
  packet, field sample, grain node, quantum coefficient block.
- Carrier channels include a `frameId` (local coordinate frame), species
  vector, internal energy, entropy, temperature ("observer/ensemble output, not
  a primitive"), fields, phase order, `activeRegimeMask`, `closureIds`.
- The loop: load domain and closures → build spatial hash / neighbour graph /
  long-range approximation → observe local state → **activate valid
  interaction terms** → evaluate edge and field messages → accumulate →
  integrate → project constraints → validate residuals and envelopes →
  **trigger refinement, regime escalation or closure invalidation** → pack a
  compact delta for PeerCompute.
- Stable pass names: `buildSpatialHash`, `buildNeighborEdges`,
  `buildLongRangeGraph`, `observeCoarseState`, `activateTerms`,
  `evaluateEdgeMessages`, `evaluateFieldMessages`, `evaluateSourceTerms`,
  `accumulateMessages`, `integrateState`, `projectConstraints`,
  `validateDomain`, `refineOrCoarsen`, `packPeerDelta`.

## Liquids (`:1014-1058`)

"ULG should not make Navier-Stokes the primitive liquid law. It should use
carriers and smoothing observers." Pressure comes from a free-energy/EOS
response. "Bad version: Hardcode Navier-Stokes or hardcode an SPH pressure
equation and call it emergence. Better version: Use SPH smoothing as
observation/coarse-graining, then derive pressure, viscosity, surface behavior,
and phase response from the active substrate/closure."

Phase change (`:2099`): "Phase evolution is not an if-statement on temperature.
It is a transition between free-energy basins with barriers, nucleation sites,
and energy accounting."

## Contracts the spec requires of every pass (`:1266-1302`)

`KernelPassSpec { id, backend, kernel, dispatch, reads, writes, barriers,
units, precision, deterministic, validates }`. "Every WGSL pass must have a
pass contract. The graph compiler can refuse to schedule passes with missing
units, missing bounds, or incompatible buffer layouts." In the example shader:
"Production kernels are generated from a closure term list, not hardcoded
here." (`:1339`)

This is the third statement of the same idea: SS's Law Adapter Contract
(2026-07-01), the law descriptor of `ss-law-architecture-assessment.md`
(2026-07-25) and A1's law descriptor (2026-10-27) all describe it. It is not
built.

## State tiers, precision and frames (`:1354-1427`)

- Hot GPU state (carrier buffers, edges, accumulators, closure parameters,
  field grids); warm PeerCompute state (manifests, compact deltas, halos,
  closure hashes, residual and validation reports); cold cache (snapshots,
  quantum task results, closure tables, shader modules, provenance).
  "Never replicate full hot buffers every tick unless the domain is tiny."
- Precision modes include `compensated_f32` for global reductions,
  `double_double_f32`, `fixed_point_i64_emulated`, `wasm_f64`.
- "Coordinate frames must be nested: universe frame → galaxy frame → star
  frame → local plasma domain → material patch → atomic frame." (SS calls
  these charts.)

## Refinement and escalation (`:1457-1486`)

Triggers: large residual or gradient, shock, phase boundary, crack tip, closure
uncertainty, out-of-envelope state, degeneracy, compactness, non-LTE,
reconnection, stiff fusion source. Actions: "split carriers", "spawn
lower-scale quantum/material task", switch closure, validator rerun, escalate
geometry or the electronic model.

## PeerCompute side (`:1213-1262`, `:2138-2192`)

- `LawTaskCapsule`: pass plan, state and closure refs, unit/law-graph/closure
  provenance hashes, tolerances, validation, commit policy (`authoritative`,
  `quorum`, `optimistic`, `local_only`).
- `SimulationDomain`: a spatial/scale partition with its own hot buffers,
  owner peer, validator peers, halo depth; split and merge criteria; boundary
  exchange of halo summaries, fluxes, closure hashes and invariant accounting.
- A commit requires: units, finite values, mass/charge/species accounting,
  energy/momentum drift report, entropy budget, closure-envelope report, peer
  validation, state and delta hashes (`:1510-1524`).

## The compliance checklist (`:2345-2364`)

A module must answer: what channels it reads and writes; units; the physical
substrate that justifies it; the ensemble assumed; the coarse-graining
inserted; its validity envelope; its uncertainty model; its provenance; what
happens outside the envelope; which passes implement it; which invariants it
preserves; which acceptance tests prove simple limits. "No module that answers
these with 'unknown' should be allowed into an authoritative simulation run."

## The spec's own build order (`:1600-1686`)

| Stage | Content |
|---|---|
| 1 | Runtime skeleton: CarrierState, LawTerm, ClosureRef, ValidityEnvelope, ProvenanceChain, TaskCapsule, KernelPassSpec, InvariantReport |
| 2 | WebGPU core passes: spatial hash, neighbour edges, messages, accumulation, integration, observation, validation reductions, delta packing |
| 3 | First-principles mini-pipeline: finite-difference Schrödinger kernel, sparse matvec, a closure from a toy quantum response, cache/provenance/invalidation |
| 4 | Statistical/EOS closures: ideal gas, Fermi gas, Saha ionization, free-energy derivative framework |
| 5 | Emergent fluid/material demo: cohesive carriers, SPH-style observer, liquid droplet, cooling/crystallization, phase energy and latent-heat accounting |
| 6 | Hydrogen star: self-gravity, EOS pressure, ionization, radiative cooling, simple fusion network, **adaptive carrier splitting** |
| 7 | Magnetic dynamo |
| 8 | Regime escalation: closure invalidation, quantum task spawn, Newtonian-to-GR trigger, QED trigger |

Acceptance tests are listed per area (`:1528-1596`): atomic/quantum, quantum
statistical, material property, liquid/phase ("carrier fluid forms droplets
without Navier-Stokes primitive", "latent heat accounting prevents free energy
creation during phase transition"), star, dynamo, relativistic.

## Where the campaign sits (Hermes, INFERRED)

- The six presets (water, iron on ice, sodium-water, cesium-fluorine) are
  **Stage 5** demos: liquids, phase change with latent-heat accounting,
  reactions. G2's conserved species/phase/enthalpy ledgers are Stage 5's
  "phase energy/latent heat accounting" and the commit rule "mass/charge/species
  accounting pass", done exactly.
- **SS is what makes Stages 6-8 reachable.** A star needs a gravity hierarchy
  (SS far-aggregate traversal is the spec's `GRAV-1`), adaptive carrier
  splitting (SS split/merge and level migration), nested frames (SS charts),
  and per-law near/far admissibility (SS law adapters). That is the plain
  reading of why the owner calls SS critical: it is the only scale mechanism
  the destination has.
- **G6, A3, A4 and A6** are the closure pipeline of sections 8-9 and 33:
  sample → fit with residual bounds → cache with provenance and validity →
  invalidate when the state leaves the envelope; remote derivation is "spawn
  lower-scale quantum/material task".
- **G4** is `activateTerms`: laws switch on where their substrate is active.
- **G5** and the authority work are the task-capsule and commit side.
- **G7** is the provenance/validation audit for imported (case 3) properties.
- **G1 and A1** are not in the spec at all. They are what it takes to watch
  and iterate on the simulation; the spec says only that rendering consumes
  closures.
- **G3 and A5** (coherent solids) are the "Material/phase memory" channels and
  the crystal/fracture response; the spec has no rigid-body concept, so
  `sol-critic.md` is ULG's own addition.
- The spec's pass contract (`KernelPassSpec`) and "kernels are generated from a
  closure term list" are unbuilt. Today's laws are hand-written WGSL.
