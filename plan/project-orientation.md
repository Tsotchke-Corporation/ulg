# ULG Project Orientation

Written 2026-07-25 after a full read of the design surface across `ulg`,
`peercompute`, `eshkol`, and `moonlab`. This is the document to read first when
picking the project up cold. It states what the project *is*, what the four
repos are for, what the current architectural direction is, and which rules are
load-bearing. It is not a status file — `plan/STATUS.md` and
`plan/implementation-status.md` carry status.

## The thesis

ULG is a **Universal Law Graph runtime**. Macroscopic behaviour is not
implemented, it is *activated*. From the v0.4 Star Spec:

> ULG must not claim that all macroscopic physics emerges from the
> nonrelativistic molecular Schrödinger Hamiltonian alone. ULG allows
> macroscopic behavior to emerge from a hierarchy of active first-principles
> substrates, quantum/statistical ensembles, coarse-graining operators, and
> validity-checked closures.

A star started as "a large mass of hydrogen" never instantiates a `Star`. It
instantiates a carrier graph — mass, composition, internal energy, fields,
geometry — and star-like behaviour appears only if the graph activates gravity,
quantum-statistical EOS, ionization, opacity, radiation transport,
nuclear/electroweak fusion, plasma/MHD, and induction. **The graph never calls
`makeStar()`.**

### Three hard rules from the spec

1. **No material property is primitive.** It is resolved from active microscopic
   dynamics, derived from a first-principles task and cached as a response
   closure, or imported with explicit provenance/validity/uncertainty. Case 3
   must never be labelled emergent.
2. **No named phenomenon emerges without the substrate that can generate it.**
   Degeneracy pressure requires Fermi-Dirac. Opacity requires quantum
   light-matter coupling and populations. Fusion requires nuclear and weak
   provenance, not electronic Schrödinger physics. A black hole requires GR.
3. **Schrödinger is foundational for ordinary electronic matter, not universal.**
   The runtime selects the deepest substrate the local regime demands, along a
   declared escalation ladder.

The implementation pattern the whole codebase is shaped around:

```text
microphysical substrate
  + statistical ensemble
  + response operator
  + coarse-grain projection
  + validity envelope
  + numerical solver
  = usable closure
```

A closure without a validity envelope is invalid by default.

## The four repos

| Repo | Size | Role |
| --- | --- | --- |
| `ulg` | — | The law graph, carrier runtime, WebGPU physics, browser demo (three.js) |
| `peercompute` | 776 files / 522k lines | Orchestration authority: libp2p P2P, NodeKernel stack, hot/warm/cold state, JS/WASM/WebGPU/hybrid task runtime |
| `eshkol` | 1337 files / 477k lines | Scheme-derived, LLVM-compiled language with native AD and arena memory; derives/compiles laws, closures, derivatives, reference artifacts |
| `moonlab` | 444 files / 194k lines | Quantum framework: state vector to 32 qubits, tensor networks past 100, topological QC, skyrmion braiding; supplies quantum/many-body response |

**Integration rule:** PeerCompute remains the orchestration authority. Eshkol
and MoonLab do not own networking, GPU scheduling, or child-worker spawning
outside PeerCompute leases.

**Authority boundary:** accepted distributed state mutation flows through
PeerCompute (NodeKernel / ComputeManager / StateManager / GPUHub). The ULG scene
hosts a local reference path, the demo, and visualization — it is *not* a
scheduler. Exactly one authoritative owner per mutable state family at a time.

## Schroeder Simulation (SS)

The current architectural direction, named for the tree *and* the algorithm
together:

- the **Schroeder Tree** — a GPU-resident scale hierarchy whose nodes are
  simultaneously multilevel MLS-MPM grid nodes and law-aggregate nodes;
- the **Schroeder Algorithm** — a multiscale solver moving particles, fields,
  reactions, contact, optics, and long-range laws through that hierarchy with
  conservative level coupling and law-specific admissibility.

Explicitly *not* Barnes-Hut, not AMR, not adaptive MPM, not Ocean-style tiling.
Barnes-Hut is demoted to one law-adapter mode among seven. One continuous
scale-aware substrate for physics from atomic to supergalactic scale.

### The Law Adapter Contract already exists

`plan/todo/SS/schroeder-tree-and-algorithm-plan.md:129`. Every law declares:
scale range and chart assumptions; read/write state families; exact near-field
requirements; **aggregate traversal admissibility and error bounds**;
cross-level coupling rules; conserved quantities and residual outputs; and
fallback policy when the level/tile/node cannot satisfy the law.

Adapter modes: `sameLevelMpm`, `crossLevelConservative`, `nearExactPairs`,
`farAggregate`, `bulkCoarsen`, `surfaceRefine`, `renderLod`.

This contract is **specified but not enforced as a type** — laws are still
hand-wired. That gap, not the absence of a design, is what produces the
recurring class of defect (see `plan/ss-law-architecture-assessment.md`).

## Rules that are load-bearing

1. **GPU-native validation, superseding CPU parity (2026-07-09).** Do not build
   a CPU mirror solver or make CPU parity an acceptance gate. Validate through
   manufactured states, mathematical invariants, metamorphic GPU executions,
   same-device A/B paths, and compact GPU reductions. Read back only fixed-size
   evidence records. No CPU-owned hot state, serial structures,
   readback/reupload boundaries, or CPU fallback architecture.
2. **Add laws, never remove or demote one** to make the runtime simpler.
3. **Physics cadence is independent of render cadence.** Rendering consumes
   physics outputs; it must never be required to produce them.
4. **Boundary conditions are physics inputs.** Wall temps, reservoirs, gravity,
   box dims, counts, law toggles must reach the solver explicitly — never
   silently become 0 K / empty / disabled.
5. **Validate physics before tuning visuals.** Atomic scientific invariants
   first; visual sequence checks are required integration evidence, not a
   substitute.
6. **Epistemic discipline is the project's spine.** `scientificValidation=false`
   and `fullPhysicsValidation=false` are load-bearing, not placeholders. "A name
   in a descriptor or todo is not enough to count as an implementation"
   (`plan/solver-law-inventory.md`). The inventory's status terms — Runtime,
   Oracle, Reduced, Kernel suite, Metadata only, Missing — are the vocabulary
   for honest claims.

## Where the design lives

| Document | What it is |
| --- | --- |
| `peercompute/plan/refs/ulg/ULG_PeerCompute_Star_Spec_v0.4.md` | The reference design, 2397 lines. Foundational — read first. |
| `plan/ULG_Triad_v0.5_Pretty_Diagrams.pdf` | The checked-in reference design PDF |
| `plan/todo/SS/schroeder-tree-and-algorithm-plan.md` | SS tree + algorithm, law adapter contract, slices |
| `plan/todo/sol-critic.md` | Active architecture correction: coherent solids, measured performance critique, Priority 0A-6 ordering |
| `plan/solver-law-inventory.md` | What is actually executable, by backend and maturity |
| `Agents.md` | Intent and hard guardrails |
| `plan/STATUS.md`, `plan/implementation-status.md`, `plan/log.md` | Status and history |

## Coverage of this orientation

Read in full: the v0.4 Star Spec, `sol-critic.md`, the SS tree/algorithm plan,
SS README, `Agents.md`, `STATUS.md`, the Triad v0.5 addendum, PeerCompute's
`plan/arch/arch.md` and README capability map, Eshkol's ULG closure-artifact and
branch-scope-review docs, plus ICC architecture summaries for all four repos.

Sampled rather than read line by line: `plan/log.md` (41k lines),
`plan/implementation-status.md` (6.1k), PeerCompute's `plan/log.md` (55k),
Eshkol's remaining ~140k-line doc tree, MoonLab's ~51k-line API reference. Those
are append-only narrative and per-call API reference; the design content is in
the documents listed above. Total documentation surface across the four repos is
roughly 353k lines.
