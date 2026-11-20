# SS note 2: the law/tree seam and the scheduling regression

Read by Hermes, 2026-11-17, both in full:
`plan/ss-law-architecture-assessment.md` (280 lines, 2026-07-25) and
`plan/todo/ss-regression.md` (259 lines, 2026-08-23, updated 2026-08-25).

## `ss-law-architecture-assessment.md`: "half of an architecture exists"

The owner's question that prompted it (`:3-8`): "is there a well thought out
architectural plan for how the datastructure and algorithms fit together for
the SS tree and the physics laws?" The hypothesis, that the brittleness comes
from fiddly details a clean design would remove, "is correct".

- **The data structure has a real architecture** (`:16-29`):
  `plan/done/SS/shared-spatial-authority-refactor-plan.md`. One canonical
  spatial epoch per step, immutable while read. Five derived views, "not
  competing authorities": mechanics node, exact-near, cross-level,
  aggregate-far, solid proxy, plus render. A scheduler lifecycle: admit and
  freeze → build one epoch → run all readers against that generation → propose
  deltas → reduce and admit → commit topology once → invalidate. Fourteen
  prohibitions, including: no universal widest-law pair list; no coupling of
  physical representation, law query, contact proxy and render LOD authority;
  no host-mediated fallback.
- **The laws' relation to it is specified and not enforced** (`:36-66`). The
  Law Adapter Contract exists (`schroeder-tree-and-algorithm-plan.md:129`), but
  "the contract was specified and never enforced as a type. Laws are still
  hand-wired, so nothing checks a law against its own declaration."
  `src/runtime/closureLawGraph.js` was built for the law-DAG producer and "is
  imported by exactly one physics file, `sphThermalGpuKernel.js`".
- **One failure mode, six times** (`:68-86`): "contracts that live in prose and
  are re-implemented per consumer". Examples: four consumers hand-wrote span
  arithmetic for a row layout; three pipelines bound too few buffers; a GPU
  memory leak because ownership moved by deleting a ledger entry; a contact
  blow-up because `V0` came from the target phase and `J` from the source;
  receipt state machines re-implemented per shader; `replaceRequiredWgsl`
  deriving shader variants by regex, so "which text actually runs is not
  answerable from the source". Later additions (`:265-280`): the "gel bug"
  (artificial viscosity folded into the shear-viscosity lane: water ran at
  ~2000 Pa·s against 0.001) and the phase-materialisation blow-up.
- **Eshkol was meant to be this layer** (`:88-113`). `Agents.md`: Eshkol
  "derives/compiles laws, closures, derivatives, and reference/WGSL artifacts".
  As of 2026-07-23 it emitted no WGSL and no SPH or material law came from it.
  "we will need to extend eshkol and moonlab to improve wasm to webgpu support
  to make this happen" (`oldagents.md`). "That extension was never built."
- **Options and recommendation** (`:128-148`): (1) a WGSL backend in Eshkol;
  (2) a descriptor layer in `ulg-gpu-abi`; (3) narrow Eshkol's charter in
  `Agents.md`. "Recommended sequence: (3) immediately, (2) next, (1)
  eventually."
- **What (2) means concretely** (`:150-173`), in order of bugs prevented:
  1. generate accessors from the lane descriptors
     (`MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT`);
  2. represented volume as a paired type (`V0` and `J` never separately
     assignable);
  3. leases instead of authority conventions, with an empty live set asserted
     at frame end;
  4. a law descriptor `{ id, view, reads[], writes[], accumulates[], stage }`
     from which bind groups and the receipt protocol are generated and "no two
     laws write the same lane in one stage" is checked;
  5. shaders composed from named fragments, not regex substitution.
- **Addendum, Eshkol's IR** (`:185-238`): no retargetable IR (a 39,850-line
  AST-to-LLVM backend), but a small second target exists (StableHLO, 1,729
  lines). ULG needs only "a restricted declarative subset: law and closure
  kernels", so a WGSL emitter of that size is tractable. Option (2) becomes
  "explicitly the specification step for (1)".
- **The same structure is the performance lever** (`:240-263`):
  - "15 of 87 compute entry points in `ulg-gpu-abi/src/wgsl.js` are
    `@workgroup_size(1)`", serial because nothing declares a stage to be a
    scan, compaction or scatter;
  - "The SS tree is queried per law stage rather than once per step";
  - a law descriptor "is the minimum input that makes hoisting, fusion, and
    parallel-pattern selection derivable rather than hand-maintained".
- Stated limits (`:175-181`): inferred from mechanics and phase-change defects;
  reaction, optical and electronic paths were not audited.

**Where this reappears.** The A1 plan's law descriptor
`{id, reads, writes, accumulates, stage}`, the 2026-11-03 audit's "at least
eight partial descriptors exist ... extend one of these so it gates execution",
and the 2026-09-22 Eshkol higher-order law plan are the same thread. The
campaign has not built the descriptor. (INFERRED from Hermes's earlier reading
of those documents; to be confirmed against code.)

## `ss-regression.md`: SS scheduling moved off the page thread

- **The regression (2026-08-10 snapshot, `:140-188`).** GPU kernels were fast,
  but "the page thread owned hierarchy/epoch construction, command authoring,
  schedule publication, presentation gating, status traversal, and one-step
  continuation" (`:16-20`). SS ran as `direct-schroeder-scene`, forced to one
  step per schedule, serialized through rAF and presentation proof. Measured:
  ~19.7 ms resident GPU per step (≈51 steps/s) against ≈3.3 steps/s end to end.
- **The correction (2026-08-25, `:10-14`).** "Eligible same-device interactive
  SS now uses a worker-owned resident WebGPU lane by default, with explicit
  ComputeManager lease and StateManager commit authority." Mode string:
  `residentComputeManagerMode = 'worker-owned-resident-lane'`.
- **Acceptance mapping** (`:22-47`): each worker step creates and seals a fresh
  epoch; continuation follows worker schedule completion while versioned render
  candidates feed presentation; each schedule completes a ComputeManager lease
  and commits a compact StateManager delta; one exact spatial-epoch transaction
  is handed from epoch generation to same-level mechanics; static tables upload
  once per lane; pipelines prewarm on admission; no full particle readback in
  the hot loop.
- **The warning** (`:49-51`): "Do not weaken these properties by increasing
  timeouts, reusing an immutable epoch across positions, inventing lineage,
  admitting a sentinel readback as the required queue fence, or counting
  GPU-only timing as interactive throughput."
- **Evidence** (`:53-68`): sodium-water, two 64-step schedules, drains at steps
  16/32/48 and an authority drain at 64. H2 carriers had negative mean vertical
  velocity at 0.128 s, "so this architecture receipt is deliberately not
  promoted to sustained-plume or full-physics validation".
- **Next, as written then** (`:70-94`): a formal physics validation layer with
  six receipts: conservation across single- and two-level steps; "exact 2:1
  cross-level transfer and phase-volume migration balance, including
  split/merge and storage materialization generations"; thermal, phase, gas
  and reaction closure; monotonic epoch identities and exactly-once admission;
  scenario milestones; separate timings.
- **Follow-ons named** (`:96-104`): strict typing of the control plane and
  single-source WGSL ABI layouts; "selective contact-law admission based on
  interface, kinematic, scale, and settledness predicates"; "algorithmic
  improvement to the sweep admission rate beneath the already chunked matching
  cleanup".

**Where this reappears.** Decoupling physics from presentation (audit Step 1,
A1 slices 1-2) is the third round of the same problem: the August regression
fixed page-thread ownership; September's G1 work added the presentation-proof
hold back (the audit dates it 09-04); November's A1 removed part of it.
The "sweep admission rate" follow-on is the contact-owner redesign that the
owner has scheduled after first-class air. (INFERRED.)
