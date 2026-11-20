# Direction note 3: the standing direction in the plan folder, and where the A-tracks came from

Read by Hermes, 2026-11-17: `plan/greenfield.md` in full (2026-09-06);
`plan/todo/README.md` lines 1-272 and 3252-3300 (the goal order, the
non-negotiable direction and the three rules; its 2,980-line "Active Priority
Order" section is left to the reader slice); `plan/Agents.md` and the root
`Agents.md` in full; `plan/todo/seven-goal-campaign.md` lines 41-310 (the
Codex-era G2 checkpoints) in addition to the sections read earlier.

## The non-negotiable direction (`plan/todo/README.md:244-272`)

- "Do not remove or demote physics laws. ULG exists to add more laws and
  connect them from first principles."
- "Do separate law content from law authority." Laws may be authored in ULG,
  Eshkol, MoonLab or service artifacts; "distributed execution and accepted
  state mutation must be supervised through PeerCompute's NodeKernel,
  ComputeManager, and StateManager path."
- "Do not let the browser scene become a second scheduler. ... the long-term
  runtime is a PeerCompute-managed graph of laws, closures, workers, leases,
  caches, and admitted compact state deltas."
- "Do not let renderer cadence decide physics cadence. ... pressure, interface,
  gas, and product state cannot depend on whether a visible mesh was drawn this
  frame."
- "Every major todo item must finish with a dense visual sequence sanity check
  over representative scenarios, not only unit tests."
- "Physics behavior work must run atomic scientific invariant checks before
  visual tuning or integrated demo fixes" (`npm run test:physics-atomics`).

## The scale rule (`plan/todo/README.md:3280-3286`)

"The same law graph must be able to focus resolution by context: quantum and
molecular closures for small scales, continuum SPH/MLS-MPM/finite-volume laws
for materials, and gravity/MHD/PIC/radiation/relativistic laws for
astrophysical contexts. Higher and lower scales can provide boundary conditions
and closures, but only the active focus region should receive hot
high-resolution compute."

Root `Agents.md:55-56` says the same: "Multiscale is focus-driven. Only the
active focus region runs at high resolution; scales couple through closures and
boundary conditions." SS is the mechanism for this rule.

Also there: the cache layering rule (hot worker-local GPU buffers under leases;
warm StateManager deltas and closure handles; cold content-addressed artifacts;
invalidation keyed on input hash, method hash, validity domain, schema, ABI and
validation status) and the copy-avoidance rule ("First keep each active
resident state key on one GPU lane and move only compact summaries,
retained-buffer refs, and admitted deltas across the control plane.").

## The owner's working rules (`plan/Agents.md`, 10 lines, verbatim in part)

- "solutions for misbehaving physics should be general not scoped to
  particular materials or reactions."
- "behavior should be derived from underlying physics."
- "run visual checks and take sequential screenshots to verify behavior. you
  can't rely only on unit tests."
- "use ICC for code search and retrieval"
- "make good use of peercompute, moonlab, eshkol, etc"
- "tackle all items in todo, when you complete them move them to done. if they
  are no longer relevant move them to moot"
- "most important to test with the GPU integrator (mlsmpm should be the default
  not plain sph cpu reference) with webgpu surface and particle spheres
  rendering"
- "you should be spot checking with random element combinations and reaction
  families."
- "webGPU implementations should be highly concurrent and scale to whatever the
  device can support to maintain framerate."

Root `Agents.md` adds the five hard guardrails (authority boundary; CPU
reference as oracle, superseded 2026-07-09 by GPU-native validation; physics
cadence independent of render cadence; boundary conditions are physics inputs;
validate physics before tuning visuals) and "Sequence honestly ... If the
visible loop is broken, fixing it outranks new plumbing."

## The seven goals as first ordered (`plan/todo/README.md:10-39`, 2026-09-04)

1. Visually advancing presentation "within 10% of 60 Hz, measured against
   wall-clock time, across ALL configured presets, including true
   isosurfaces", with material/refraction/depth fidelity.
2. "conserved phase/transport optics and a shared participating-volume display
   for physically derived visible steam and aerosol smoke".
3. Minimum coherent-solid foundation, SOL-0/SOL-1.
4. "Generalize per-node dynamic-law activation beyond the reaction seed,
   keeping relevant generalized kernels warm across envelope transitions."
5. "a bounded compare-and-swap multi-consumer reservation slice".
6. "one local provenance-bound online closure fit/cache slice with envelope
   invalidation before extending it to remote derivation services".
7. "an external fuzzy scientific release audit over immutable, versioned
   database snapshots ... offline and nonblocking; it never becomes runtime
   authority."

Update of 2026-10-24: G1 was failed by the owner on 2026-09-13 and delayed
"until architecture work makes it feasible"; order is G2 to G7, then A1 to A6,
then G1 reassessment.

## `greenfield.md` (2026-09-06): where the six architecture tracks come from

"Recorded from a side conversation at the user's request. This is architectural
analysis, not an adopted replacement plan, authorization for a rewrite, or a
change to the active seven-goal campaign." It is dated the same day as the
campaign coordination entry, and its seven sections line up with the A-tracks.

"I would keep the vision, but change the construction order and make the core
much smaller. My strongest criticism is not that ULG lacks architectural ideas.
It is that integration machinery has grown faster than dependable, demonstrated
capabilities."

| Section | Content | Campaign counterpart (Hermes, INFERRED) |
|---|---|---|
| 1 | "Establish a trustworthy local simulator before expanding the system": one GPU, one state owner, one execution path, one renderer; complete experiments (water at rest and falling, heat exchange with energy accounting, melting and evaporation with conserved material, one reaction with accounted energy). "Presets would remain data, not alternative implementations." | G2's ledgers; the "no per-preset branch" rule |
| 2 | "Make the law contract executable from the beginning. This is probably the most important architectural change." One declaration generates or checks buffer layouts and accessors, read/write dependencies and accumulation, resource ownership, required spatial views, kernel identity. "rest volume versus current volume should appear in the interface". No shader variants by source-text replacement. "a small, restricted generator, not a prerequisite project to build an entire programming language". | The law descriptor (A1 step 3; unbuilt) |
| 3 | "Treat presentation as an independent product": physics advancement, publication of coherent renderable state, and display refresh are three things; the renderer consumes retained, versioned snapshots; rendering testable from recorded output. | A1 decoupling; the G1 acceptance question |
| 4 | "Make cheap approximation and expensive refinement foundational. The user's representative-sampling and derived-material-function ideas belong near the foundation of this project." "Use a valid inexpensive closure; detect when it becomes insufficient; refine only the affected region; adopt a replacement coherently." "An inactive expensive solver does **not** mean its physics disappears; a valid closure represents its contribution." "Generic kernels stay warm; material identity supplies data rather than generating reaction-specific programs." | G4, G6, A3, A4, A6 |
| 5 | "Separate spatial validity from rebuilding everything": track position, support, topology and representation changes separately; consumers reuse views whose assumptions still hold; "incremental maintenance is not automatically cheaper or simpler". One shared spatial authority, law-specific views. | A2 |
| 6 | Three kinds of evidence kept apart: implementation correctness (GPU invariants, conservation, manufactured states; "These can block a change"); scientific agreement against external data ("the advisory release signal the user described"); presentation quality. "A plausible cloud is not evidence that the producing physics is correct." | G7; the oracle protocol |
| 7 | Development discipline: the scene file was ~55,600 lines and the MPM step ~41,500; "State the hypothesis and the observation that would reject it"; "Track delivered behavior, not accumulated patches, tests, or plan items"; "Keep one concise current plan"; "Use ICC to preserve evidence and decisions without letting control-plane work become the deliverable." | The owner's "don't fall into a pitfall of over analysis" |

Bottom line: "a small, trustworthy GPU physics laboratory that grows into an
adaptive engine, with distribution and deep derivation added through
established boundaries." "This is **not** a recommendation to throw the
repository away."

## The Codex-era G2 checkpoints (`seven-goal-campaign.md:41-310`)

Thirteen checkpoints from 2026-09-14 and 2026-10-25, all on the exact-rational
route that the owner stopped on 2026-10-27. What still binds:

- **Environment decision, 2026-09-14** (`:129-138`): "The operator approved
  documented room air and background condensation nuclei for the visible-steam
  demos." Use "explicit conserved air/humidity/seed inputs through the shared
  pipeline, with a same-air aerosol-free comparison. Preserve cesium-fluorine
  and the two vacuum water benchmarks."
- **Cost sensitivity** (`:155-156`, `:174-175`): "The cost-sensitive checkpoint
  adds one missing GPU operation without narrowing success or spawning a
  research swarm." "The operator's token-cost concern prompted a bounded
  verification checkpoint, not permission to shrink the seven-goal objective."
- Repeated in every entry: no invented nuclei, no extra latent energy, no
  relaxed conservation budget; failed runs are kept, not hidden; "No identified
  transported plume, material/refraction fidelity ... or 54 Hz acceptance is
  claimed."
- State at 2026-10-25: "G2 stays at 3/6 original child items, G3-G6 pending,
  G1 deferred."

## One paragraph of synthesis so far (Hermes, INFERRED)

The destination is the Star Spec: any physical behaviour, at any scale, from
activated laws and validity-checked closures, with nothing hand-authored per
phenomenon. The Triad spec assigns ownership (PeerCompute authority, Eshkol
closure compiler, MoonLab quantum backend, ULG carrier runtime). SS is ULG's
mechanism for the scale rule. The seven goals are the owner's September
selection of the smallest set of visible, checkable capabilities, and the six
architecture tracks are the greenfield retrospective turned into incremental
work on the existing code. The three contracts every document asks for and
none has yet (an executable law contract, presentation as an independent
consumer, and closures with validity envelopes in the hot loop) are the
threads that tie G1, G4, G6, A1, A3 and A4 together.
