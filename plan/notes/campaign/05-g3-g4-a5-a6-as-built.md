# Campaign note 5: G3, G4, A5 and A6 as built, read against their designs

Sources, all read in full by Hermes on 2026-11-17 (the first pass, digest
`picture/13`, had only parts): `plan/todo/g3-solids-proposal.md` (394 lines),
`g4-dynamic-laws-proposal.md` (271), `a5-solid-fluid-coupling.md` (289),
`a6-remote-derivation.md` (118). Figures are Claude's, from 2026-11-14/15. The
designs they are read against are in `ss/06` (SOL critique), `direction/04`
(Eshkol plan) and `direction/05` (scale-adaptive activation).

## G3: the rigid lane (`schroederSolidRigid*`)

What was built (`g3:20-51`, `:159-196`):

- A frame record (32 words) and a member record (8 words) per body, in the
  principal frame. "Mass and inertia belong to the members only." "Members are
  regenerated from the frame every step, never advected on their own."
- Integrator: half kick, translation, "the free rotation by the
  Dullweber-Leimkuhler-McLachlan symmetric splitting", half kick. "World
  angular momentum is the integrated variable, so a torque-free body conserves
  it exactly."
- Reductions go "into exact integer counters ... Products are rounded once;
  sums are exact", so results "do not depend on member order, workgroup size
  or dispatch partition. These reductions are the GPU acceptance surface;
  there is no CPU mirror."
- Shape carrier: a voxel mesh in the body frame, drawn by a vertex shader
  that "reads the centre of mass and the quaternion straight from the resident
  frame buffer"; later member-driven, so "melted members vanish and inner faces
  appear with no mesh rebuild".
- Live: `mechanicsMode: 'rigid' | 'continuum'` per body; "Its samples are not
  SPH particles"; the lane steps "after the continuum mechanics, on the same
  device and queue".
- Phase ownership: member conduction on the body's lattice; "a member whose
  liquid fraction reaches 1 leaves the body" and activates "a reserved dormant
  SPH row, the member's own, allocated at seed"; the body is rebased
  (parallel-axis shift, Jacobi re-diagonalization in WGSL).

Gates passed (native): translation across 100 cells; torque-free tumbling
("world L is bit-constant", the Dzhanibekov flip observed); driven rotation;
order and workgroup bit-identity; wall contact (free fall, rest, drop, proxy
swap); silhouette tracking; conduction and melt; release conservation. Live:
a spinning ice block dropped into room air, and a block melting on a 1,500 K
floor (bottom layer released between 11 and 12.5 s).

Stated limits (`:194-196`): "Fluid and air pass through the rigid body ...
Contact is with the box walls only".

## A5: coupling added on top (2026-11-14/15)

- **Thermal** (`a5:6-54`): a member-particle pair law `Q = k_h A ΔT dt / L`,
  quantized to 1e-9 J quanta so "the exchange is exactly antisymmetric in
  quanta". "**Search.** Brute force over particles (members × particles);
  binning belongs to A1." "f32 route only, like release."
- **Mechanical** (`:56-86`): "One thread per particle, Gauss-Seidel over its
  own member contacts." "A member is a sphere of radius a". The particle gets
  an impulse toward a Baumgarte target; "The contact is inelastic and
  frictionless: a fluid slips." The body gets −J, linear and angular.
- **SOL-2 body-body** (`:255-289`): "Each proxy pairs with its nearest proxy on
  another body: a brute-force O(P²/2) search once per step". "One partner per
  proxy." Same contact law as the walls. Ledgers "sum to zero bit-exactly".
- Live check: rigid ice under molten iron: "20 of 256 members released by
  2.0 s".

## G3 and A5 against the SOL contract (Hermes; to verify in code)

| SOL contract (`ss/06`) | As built |
|---|---|
| "Insert those proxies into SS active cells"; "exact-near SS contact queues for body-owned proxies" | The rigid lane does not use the SS spatial authority. Searches are brute force (members × particles, proxies × proxies). The solid is beside the tree, not in it |
| SOL-3: "separate mixed-cell solid/fluid velocity/interface handling"; "Pressure and viscous traction integrated over area-weighted solid samples should produce buoyancy, drag, force, and torque"; gates "float, sink, neutral buoyancy, rotating boundary, and liquid-through-pile" | A per-particle sphere impulse after continuum mechanics. No traction integral; the buoyancy gates are not reported |
| "Rigid approximation admission must come from a physical/error policy, not a UI role" | `mechanicsMode: 'rigid'` is declared per body in the scene |
| "Do not copy: penalty stiffness/damping/friction as material law authority" | One "benchmark contact law is e = 0.3, μ = 0.3" (`SCHROEDER_SOLID_BENCHMARK_CONTACT_LAW`) for every material |
| "an asymmetric rigid body crosses the grid **and SS levels**" | Crosses 100 cells kinematically; SS levels are not involved |
| SOL-4 deformable surface, SOL-5 fracture and solidification, SOL-6 charts and orbits | Melt release exists (part of SOL-5). The rest: see digest `picture/16` |
| "No global serial body/event scan" | The lane is parallel per body and per particle; the searches are O(N·M) |

Two more gaps that matter to G2:

- "Release is enabled only when ... the route is not exact-mass. ... on the
  ledger routes members stay in the body and do not release. Exact release is
  follow-on work, needed for the Iron Ice plume on the ledger route"
  (`g3:307-311`). Coupling is f32 only as well.
- Memory: "roughly 3 MB/s of growth on long runs. It is not yet attributed"
  (`g3:329-333`); a run with 8× finer ice "was OOM-killed at about 5.5 GB of
  render-worker RSS" (`a5:251-253`). This bears on the owner's hard limit.

And one direction recorded in passing (`a5:248-250`): "Resolution is the
second, general factor. ... Adaptive refinement near steep thermal gradients,
through the SS levels, is the general route."

## G4: dormancy as built

- **Thermal** (`g4:88-194`): `schroederThermalDormancyGpu.js` reduces
  temperature min and max "per cell", and a source is dormant when the span
  over its 3 × 3 × 3 cell halo and its wall exposure are within ε_T. "The halo
  symmetry makes the predicate pair-conservative". Wired into the canonical
  thermal producer with no new binding. At ε = 0 the result is bit-identical
  to ungated. On the ledger route a gated far cluster's "integer U rows are
  exactly frozen".
- The cell grid is the predicate's own: "The edge is at least every pair-law
  support ... computed on the GPU each step", "with the grid set to the box".
  (Hermes: it is not the SS node set. The goal's wording is "per node", and the
  Eshkol plan says new closures "must consume that [SS] generation rather than
  construct private grids". To verify in code.)
- "**Compaction.** Dormant threads exit before traversal, but workgroups are
  still launched over the ActiveSource dispatch. ... That is performance work,
  deferred to A1." So a dormant source still costs a launched thread; G4's
  "a dormant law costs no work" holds as a zero-work witness only when nothing
  is active.
- "Radiation keeps every source active, because it is not gated in slice 1."
  Wall and ambient laws are not gated.
- ε > 0: owner, 2026-11-16, "Allow ε > 0 as opt-in". The receipt reports
  `exact: false`.
- Reaction node scope (slice 3) is in digest `picture/13`.

Against the scale-adaptive plan (`direction/05`): this is Tier 1 for one law
with a predicate written for that law. The general form ("an envelope-exit flag
per SS node per law, written by the bulk pass that consumed the closure") and
Tier 2 (laws iterating only triggered nodes' members, by compacted dispatch)
are not built.

## A6: derivation services in the browser

- Owner, 2026-11-15: "eshkol and moonlab should be running in the client under
  wasm"; "use the eshkol wasm build that supports webgpu"; "definitely use the
  webGPU moonlab". "Nothing derives in Node now."
- `src/services/clientDerivationPeers.js`: same-origin pages become PeerCompute
  peers over a `BroadcastChannel`; a `NodeKernel` responder with its own
  `ComputeManager`; a requester with "a redundant placement executor with a
  2-of-2 quorum validator".
- Warm workers: `public/workers/moonlab-warm-webgpu.worker.js` (MoonLab WASM
  with its WebGPU backend) and `eshkol-warm-vm.worker.js` (Eshkol VM with its
  WebGPU compute backend, "sf64 exact tier").
- "MoonLab's browser WebGPU path never ran": every dispatch fell back to the
  CPU (an Emscripten symbol name, and the WGSL reserved word `target`). Fixed
  upstream as `tsotchke/moonlab` PR #50.
- Cache: `remoteDerivationArtifactCache.js`, single-flight, "results stay
  pending until a schedule boundary, and only then are adopted".
- Evidence (`tests/a6ClientDerivation.native.test.mjs`): replica promotion
  after the primary page closes; quorum accepted; warm second calls (40 ms and
  1.2 ms); MoonLab GHZ-12 on "13 of 13 WGSL dispatches"; Eshkol N2 ideal-gas
  density and a 16 × 16 matrix sum.

Limits it states (`a6:110-118`): "**'Remote' here means separate pages in one
browser**"; cross-device "needs the user's go-ahead and named peers" (owner:
not now). "**The Eshkol-side derivations are small.** Wiring them to ULG's
actual closure misses (the G6 `localClosureFitCache` / A3 regional sampler) is
the integration step."

## The closure loop, end to end (Hermes, INFERRED)

The Star Spec's loop is: a law's closure lookup leaves its envelope on some SS
node → PeerCompute schedules a scoped derivation → Eshkol or MoonLab derives
from a sample → a fit with an envelope is validated → it is adopted at a
schedule boundary → the resident evaluator serves the region.

| Link | Exists | Connected to the next link in a running scene |
|---|---|---|
| Envelope exit detected on the GPU per node | Thermal dormancy and reaction scope are activation predicates, not closure envelopes | No |
| PeerCompute task with reservation (G5) | Ledger and same-browser peers | Not triggered by the simulation |
| Derivation in Eshkol / MoonLab (A6) | Warm WASM + WebGPU workers | Runs test derivations |
| Sample of a homogeneous region (A3) | GPU sampler | "no in-step consumer" (digest `picture/12`) |
| Fit with residual bounds and envelope (G6, A4) | `localClosureFitCache`, `fitResponseFunction` | Used offline by the Tait stiffness script |
| Boundary adoption | Requester cache logic | Not into a live law |
| Resident GPU evaluator read by a law | Clenshaw evaluation of K(ρ) in the implicit pressure solve | Yes, for one function, on Tier0, from a checked-in table |

Every link has been built and gated in isolation. The loop has never run. That
is the honest reading of G6, A3, A4 and A6 together, and it is also the most
direct description of the distance between the campaign's deliverables and the
Star Spec.
