# SS note 3: the spatial architecture of record

Source: `plan/done/SS/shared-spatial-authority-refactor-plan.md` (2,181 lines,
dated 2026-07-13, "completed execution record; archived 2026-08-31").
Read by Hermes, 2026-11-17. Part A below covers lines 1-560; later parts are
appended as the rest is read.

## Part A: the design (lines 1-415)

### Decision (`:14-38`)

"Build the next Schroeder Simulation slice around one SS-owned, GPU-resident
spatial substrate. For every admitted spatial epoch, each authoritative
particle is classified once, emits one exact structural key, and participates
in one canonical sort/unique build. Mechanics and spatial laws consume derived
views of that generation instead of constructing independent grids, bins, or
full-scan fallbacks."

- It superseded: the July 2 queues; the CPU-first adaptive MLS-MPM track
  (keeping its transfer and conservation gates); the Ocean plan's independent
  neighbour structures; `sol-critic.md` Priorities 2 and 3 spatial routing.
- It did not supersede: the Schroeder architecture, dense MLS-MPM/Ocean
  mechanics, PeerCompute/StateManager authority, coherent-solid requirements,
  material and chemistry laws, rendering ownership, acceptance gates.
- "Do not merge or continue `gpu-resident-physics-refactor`. Port independently
  proven concepts and small primitives only." (An abandoned earlier refactor.)

### Why it came first (`:40-58`)

"The intended Schroeder hierarchy is both the multilevel mechanics grid and the
shared law substrate. Current SS code is not yet that structure": one active
row per particle; particle-proportional fixed candidate budgets; reaction and
pressure/contact building private bins; thermal/radiation falling back to
exhaustive pairs; several paths sorting the same positions; the abandoned
refactor rebuilding a neighbourhood up to thirteen times per four-substep
batch. "The replacement must make the shared structure the first real producer
in the law DAG rather than adding another descriptor next to the old builders."

### Core invariant: one build per spatial epoch (`:60-91`)

A spatial epoch is the immutable tuple of everything that can change spatial
membership: position epoch; topology (add/remove/split/merge) epoch; chart and
chart-transform epoch; physical representation / native-level epoch;
support-profile epoch; particle-storage / source-family generation; device,
lane and lease identity.

- "Velocity-only writes may reuse an epoch. Position integration, topology
  mutation, chart rebasing, phase/support migration, or native-level changes
  invalidate it."
- "Once per tick" means once per authoritative physics integration step. A
  solver that moves positions inside a step makes an explicit micro-epoch.
- **"Reuse across displacement is allowed only after a conservative
  GPU-authored skin/displacement certificate is admitted."** (This is the door
  A2, incremental repair, has to go through.)
- Acceptance target:
  `particleKeyEmissionCount == admittedParticleCount`,
  `canonicalSortUniqueCount == 1`,
  `spatialBuildCount == spatialEpochCount`,
  `spatialEpochCount == physicsIntegrationStepCount`,
  `privateLawSpatialBuildCount == 0`.

### The canonical data (`:93-157`)

- Header (`ss-spatial-epoch.v1`, 48 words): schema, identities (device, lane,
  lease, source family, storage, generation), tick/substep and the five
  epochs, counts, separate required/admitted/capacity/overflow per arena,
  completion state, indirect dispatch arguments.
- "No live count may be used as capacity. Overflow never silently truncates an
  authoritative result: it emits zero indirect work or retains the previous
  admitted generation."
- Arrays: one source row per particle (persistent id, source family, chart,
  native level, material/phase masks, support-profile id); exact integral keys
  `(chart, level, cellX, cellY, cellZ)`; a collision-free sort encoding
  (`bounded-atlas-u32` for bounded scenes, else exact `lexicographic-u32x5`);
  sorted indices; compact unique cell rows; `cellOffsets`, `cellMembers`,
  `particleToCell`; compact parent/child or ancestor closure; law-neutral
  aggregate arrays (mass, volume, momentum, internal energy, centre of mass,
  masks); an optional hash view that "may not become a second owner".
- "Structural identity is integral."
- Support profiles: each law adapter declares radius rule and level range,
  chart policy, mode (exact-near, cross-level, aggregate-far), symmetry and
  direction policy, eligibility masks, aggregate error tolerance, conserved
  quantities and residual evidence. The table must be extensible: no fixed
  eight consumer slots, no fixed candidates per source.

### Six derived views (`:159-188`)

"One universal widest-radius particle-pair list is prohibited."

1. Mechanics node view: compact unique P2G/G2P grid-node stencils per
   chart/level.
2. Exact-near view: direct cell-range traversal or a byte-bounded pair CSR per
   support profile; consumers still apply the exact law predicate.
3. Cross-level view: parent/child adjacency, restriction, prolongation,
   coupling and reflux edges.
4. Aggregate-far view: node reductions and law-specific opening/error traversal.
5. Solid proxy view: body/component-aware contact samples with equal and
   opposite impulse ownership.
6. Render/surface view: derived routes and LOD only.

**Five separate decisions that may share keys but not authority** (`:181-183`):
"Material representation/coarsening level, mechanics/timestep level, law-query
level, solid contact-proxy level, and render LOD may share charts and keys.
They remain separate decisions and authorities."

Source families (hot particles first; gas/product, rigid proxy and render
follow) may need distinct generations, with the same primitives.

### Scheduler lifecycle (`:190-211`)

admit x_n and freeze membership metadata → compute support profiles and native
levels on GPU → build one canonical epoch → run mechanics and all spatial
readers against it → accumulate forces, heat, reaction events and state/topology
proposals → reduce and admit compact invariants/deltas → integrate positions
and commit topology once to x_(n+1) → invalidate the epoch.

- "Reaction products, splits, merges, and phase/support migrations are staged
  for the next epoch unless a deliberately declared micro-epoch is required. No
  stage may quietly rebuild merely because it is enabled or disabled."
- The build is caller-encoded on the ComputeManager/GPUHub-owned lane, with
  persistent fence-safe arenas, cached pipelines, GPU clears and live-count
  indirect dispatch; no `mapAsync`, no JS candidate creation.

### Slices (`:213-325`)

| Slice | Content |
|---|---|
| 0-1 | Recovery checkpoint `bdd3eee`; plan routing |
| 2 | GPU cell-directory foundation: key emission, stable sort/unique, offsets/members, reverse map, overflow evidence |
| 3 | First same-epoch production consumer (mechanics P2G level admission; pressure/contact broad phase) |
| 4 | "First-class law-DAG producer and epoch scheduler": the spatial generation as an explicit read family; "Make laws propose deltas against immutable membership"; commits at the epoch boundary; one build per step; skin reuse only after GPU displacement proof |
| 5 | Remaining exact-near consumers: pressure/interface and contact, reaction discovery, separation plus thermal conduction, radiation, material/interface |
| 6 | Compact mechanics view: unique grid-node topology from the shared directory; keeps node identity "for a later derived (node, material/body/mechanical-field) view"; "does not claim that the current single velocity field solves mixed solid/liquid cells" |
| 7 | Two-level coupling and aggregate traversal. "Keep the third level on hold." Close constant/affine reproduction, partition of unity, mass, centre of mass, linear/angular momentum, internal energy, positivity, CFL, reflux, subcycling, extreme-ratio and chart-error contracts at two levels. "Resume a third level only after two-level correctness and GPU cost gates are green." |
| 8 | Other source families and cleanup: product/gas, solid proxy, sparse render, source-field and surface routes; delete fixed candidate queues, duplicate bins, independent sorts, exhaustive fallbacks, host feedback paths |

### Gates (`:327-382`)

- Correctness: zero missed exact-near candidates against small brute-force
  manufactured cases per support profile; determinism under permutation;
  negative coordinates, chart boundaries, cross-level, extreme mass ratio;
  stale identities reject; overflow never publishes a partial generation;
  GPU-native reductions for mass, momentum, energy, stoichiometry, far-field
  error; "split/merge preserves mass, momentum, represented volume, energy,
  material, phase, body/component, and topology identity".
- "Small brute force is a manufactured diagnostic oracle. It is not a
  production CPU tree or a second solver authority."
- Residency and performance: one key/sort/unique per epoch; no private law
  build; "No production `N^2` fallback or fixed `N * candidateBudget` arena";
  no per-step `GPUBuffer` allocation after warmup; retained bytes
  `O(N + occupiedCells + hierarchyNodes)`; no full readback; GPU timestamps,
  not host enqueue time; "Dispatch-granular timestamp mode is
  instrumented/nonrepresentative"; no slice may regress a non-target batch or
  visual FPS by more than 5% over three-run medians.

### The twelve explicit prohibitions (`:384-399`)

No megacommit or broad orchestrator rewrite. No descriptor/admission status
accepted as physical completion. No active-node row overloaded as a particle
row. No count/capacity conflation or silent truncation. No universal
widest-law pair list. No fixed per-particle candidate reservation. No implicit
exhaustive or host-mediated fallback. No reuse across an invalidated epoch
without admitted GPU evidence. No CPU hot-state readback/reupload or JS
candidate authority. No performance claim from host enqueue timing. No coupling
of physical representation, law query, contact proxy and render LOD authority.
**"No third SS level until the two-level numerical and performance contract is
green."** (Lifted by the owner on 2026-11-16 for the N-level 2:1 chain.)

### First checkpoints (`:416-560`)

- Slice 3 (2026-07-15): P2G binds the canonical `ss-spatial-epoch.v1`
  directory and uses its reverse map for native-level admission. Rejected or
  stale bindings fall back to the retained level-assignment row "so provenance
  loss cannot turn into a zero-physics frame". Not yet "old lookup removed".
- Slice 4A (2026-07-15): the pressure/interface exact-near path borrows the
  caller-owned generation: zero private builds; the generation owner is the
  only release authority; stale, released, cross-device or torn generations
  "fail closed to zero contact rows" and cannot rebuild privately or fall to
  the CPU solver. Raw generations stay out of the worker bridge "because GPU
  buffers and arena functions are not structured-cloneable".

## Hermes's reading of what this means for the campaign (INFERRED)

- **A2** must satisfy the displacement-certificate clause and the "one build
  per epoch" accounting, or change them with the owner's agreement.
- **A1 fusion** (K steps per submission) collides with
  `spatialEpochCount == physicsIntegrationStepCount`: every step needs its own
  epoch, so fusion means building epochs inside one submission, not skipping
  them. The audit's "one immutable hierarchy generation cannot span multiple
  position epochs" is this invariant.
- **First-class air** changes "native level" from a derived property into
  something a split kernel acts on: splits and merges are topology epochs and
  must be "staged for the next epoch".
- **A5 / G3** live in view 5 (solid proxy) and in Slice 6's deferred
  "(node, material/body/mechanical-field)" view: mixed solid/liquid cells were
  explicitly left unsolved by the refactor.
- The five-way separation of levels (representation, mechanics/timestep,
  law-query, contact-proxy, render LOD) is the rule any N-level work has to
  keep.

## Part B: implementation checkpoints, lines 561-1120 (2026-07-15 and 07-16)

### Slice 4B, mounted owner scope and query evidence (`:601-691`)
- First mounted same-device pressure/interface borrower, diagnostic only
  (`forceRowsAppliedToResidentMechanics=false`).
- The generation now carries GPU-authenticated query geometry: chart id, min
  and max level, base spacing; the key pass checks every active row's
  `baseSpacing * 2^level` relationship (`:614-622`).
- "The pressure-local canonical SS producer has been deleted" (`:624`).
- Gap recorded: a carried phase-volume assignment overlay is not supported by
  this adapter ("Overlay support is a future ABI/view slice").

### Slice 4C, artifact ledger and transfer leases (`:693-775`)
- The hierarchy made about thirty retained GPU artifact families with cleanup
  for four. One ledger per invocation now owns them; untransferred buffers
  retire once behind the generation-owner fence (`:695-703`).
- Ownership table (`:705-713`): same-tick temporaries → hierarchy ledger;
  active-node and aggregate-node buffers → render executor; phase level-update
  buffer → next-tick overlay cache; gas-cell buffer → pressure-interface
  state; adopted particle buffers → resident continuation.
- Four native gates "run real admitted split, merge, coarsen, and refine chains
  through materialization/count/adoption or compaction with mass and count
  assertions" (`:741-742`). So the July split/merge storage chain was
  exercised natively, on fixtures.
- Ledger cost: no consistent regression (10k pairs 18.75 vs 18.28 steps/s).

### Slice 4D, the immutable spatial-epoch transaction (`:777-959`)
- One transaction freezes an exact pre-integration `x_n` authority before any
  reader is admitted; admission fails closed on any identity change or a read
  after commit (`:780-789`).
- Order: P2G then G2P must both be admitted before the reader set seals; the
  optional pressure/interface reader is admitted first after a preflight.
- Reaction and thermal were still legacy post-integration consumers here.
- **Two false positives the author caught** (`:818-842`): a 64-step batch had
  mounted only its first three transactions (the arena has three slots) and
  silently ran 61 steps unselected: "only 12/256 ticks built, sorted,
  committed". Fix: bounded flow control. On arena exhaustion the owner waits
  for an already-scheduled release and retries the same frozen epoch. "This is
  bounded flow control, not authority reuse: every changed position epoch still
  receives a fresh generation and transaction."
- Accepted baseline (laws off): 1,024 particles 162.64 steps/s; 9,826 particles
  146.45 steps/s; 192/192 transactions per scenario (`:891-902`).
- SwiftShader trap (`:904-914`): a headless stall was Chromium selecting
  SwiftShader. "SwiftShader runs are not accepted as native GPU or performance
  evidence."
- **Binding statement for fusion** (`:950-953`): "Any future optimization that
  fuses an active-SS multi-tick command stream must still create a distinct
  generation and transaction after every G2P position commit; it may not reuse
  one generation across position epochs."
- "Skin reuse remains prohibited until a GPU displacement certificate exists."
  (`:958-959`)
- Physics debts recorded and not hidden (`:943-948`): "water cycle steam still
  does not rise and condense, iron/ice does not yet cool iron or raise steam,
  desktop sodium/water still exceeds its speed and minimum-J bounds ... and
  cesium/fluorine still reports zero retained reaction events". These are the
  same failures the campaign's G2 and A5 are working on four months later.

### Slice 5, integrated exact-near consumers (`:961-1034`, 2026-07-16)
- "Every enabled exact-near reader now receives an authenticated view or
  traversal of the same immutable `ss-spatial-epoch.v1` generation before
  P2G/G2P changes position or topology." Contact/pressure/interface, reaction
  discovery, separation, conduction, radiation and material/interface "all
  publish proposal artifacts before the single resident commit".
- The scheduler owns the declared reader set, support-profile identity,
  per-consumer receipts, proposal sealing, commit, release and ledger
  retirement. Zero private builds, fixed-candidate builds or exhaustive scans.
- "A plain production `?ss=1` entry point defaults to this supported
  single-level Slice 5 boundary; cross-level coupling, phase-volume migration,
  legacy law queues/candidates, and two-level mechanics remain explicit
  opt-ins" (`:980-984`).
- Query evidence grew to six words (occupied-level mask); traversal skips
  unoccupied levels. Conduction and radiation share one traversal. "uniform
  active temperature is an exact zero-delta fast path, not a material special
  case."
- **Throughput with laws on** (`:996-1006`): 9,826 particles with mechanics,
  pressure, thermal, reaction and viscosity: **89.29 steps/s** complete-engine
  (up from 31.7 after removing per-pair atomic contention).
- Visual matrices: 14 runs, 144 frames, clean; the same four physics debts
  "are not hidden as passes and were not changed with per-material workarounds".

### Slice 6, compact mechanics view (`:1036-1110`, 2026-07-16)
- `ss-spatial-mechanics-view.v1`: a GPU bitset, exclusive scan and scatter give
  a strictly ascending unique list of dense MLS-MPM node indices touched by the
  3x3x3 stencil. Compact indirect dispatch drives node validation, clear, P2G
  finalize and grid update; P2G and G2P stay particle-parallel. Fourteen
  dispatches in the fused path.
- **Driver hazard** (`:1061-1070`): "The original single large preflight shader
  reproducibly destroyed the Dawn/Vulkan instance on this system while
  compiling its combined unsigned-product overflow expression." It was split
  into six small authentication entry points. (Relevant to window-manager
  safety: a shader compile can take the GPU process down.)
- Telemetry cannot report the live compact node count without a readback; it
  reports a full-capacity upper bound and "must not be cited as measured
  compaction".
- **The blocking finding** (`:1105-1110`): "phase change proceeds numerically,
  then the one shared node velocity locks liquid water to overlapping ice/iron
  and eventually destabilizes. Sparse (node, material/body/mechanical-field)
  state and continuous phase-volume transfer are therefore a blocking mechanics
  closure before two-level coupling". This is the origin of the per-material
  field views that Iron Ice requires today.

### Hermes's observation (INFERRED, needs the log to confirm)
In July a ~10k-particle scene with thermal, reaction, pressure and viscosity
ran at 89 steps/s. Iron Ice in November runs 6,784 rows at 21 to 40 steps/s.
The difference is whatever was added after Slice 5: field views, the contact
pair graph and its cleanup passes, two-level coupling, phase-volume transport,
and the presentation coupling. The A1 real-time gap is partly a regression
against this recorded baseline, not only a missing optimization.

## Part C: lines 1121-1660 (2026-07-13 to 07-18)

### Mechanics fields and the four-lane phase topology (`:1112-1186`, 07-16)
- The compact node set derives a second sparse view keyed by
  "`(denseNodeId, mechanicalFamilyId, materialId, continuityDomainId)`".
  P2G, field grid update, "explicit unlike-field contact" and G2P stay in the
  caller's encoder. "The contact operator only removes closing normal velocity
  with equal-and-opposite momentum transfer, leaving tangential slip
  unconstrained." (This is the grid `contact_fields` response the 11-03 audit
  lists as one of the overlapping contact responses.)
- **Phase topology** (`:1134-1147`): "four fixed, phase-pure lanes per original
  lineage under `peercompute.ulg.sph-phase-carrier-plan.v2`. Stable address is
  `phaseLane * phaseLaneStride + lineageIndex`, in solid/liquid/gas/plasma
  order." Adjacent phase fractions are redistributed conservatively (mass,
  momentum, first moment, internal and total energy). "reaction products cannot
  consume reserved phase lanes."
- "Fixed four-lane capacity should later become sparse when measurement
  justifies it" (`:1181-1182`). Inactive reserve lanes are dispatched today.
- July Iron Ice evidence: clean through 2.56 s with ~567 kg of flowing liquid
  water and 55 kg of H2O gas. The scene was far larger than today's.
- Left open: "Geometry/contact/thermal-boundary unification, derived
  viscosity/conductivity/interfacial conductance, and coarse gas thermal
  microphysics"; "transient tiny gas fractions can still reach the thermal
  clamp near 1e6 K".

### Visual-physics restoration before Slice 3 (`:1188-1411`, 07-13)
- Render-field radius is the particle's physical, J-adjusted radius.
- Excluded-volume position projection was separated from pair-normal velocity
  damping (default zero) "so overlap correction does not erase water flow".
- Artificial viscosity `alpha=0.04` is "an explicit temporary stabilizer until
  a compression-only numerical term and closure-derived physical viscosity are
  available; do not reinterpret it as molecular viscosity" (`:1243-1245`).
- **The sodium explosion was a boundary-condition bug** (`:1376-1387`): the gas
  branch computes gauge stress as `p_ideal - p_ambient`, "but every host
  mechanics route left the ambient lane at its vacuum default". Supplying
  101,325 Pa took sodium from 89.6 m/s and J=1000 to 2.4 m/s. The contact
  hypothesis was rejected and moved to moot.
- Still unchecked (`:1228-1230`): "Derive gas transport from a real
  drag/terminal-velocity closure before adding fractional plateau or
  product-gas buoyancy. Repeatedly adding an uncoupled acceleration cap without
  drag is not an admissible substitute."
- Warning (`:1410-1411`): "Do not widen the reaction radius, globally change
  the water damping default, or treat a deliberately relaxed diagnostic
  threshold as scientific acceptance."

### Slice 3 closure: canonical mechanics authority (`:1413-1483`, 07-15)
- Canonical P2G and G2P consume the same `ss-spatial-epoch.v1` directory; the
  legacy route is separate and "not a fallback from selected canonical intent".
- "A single canonical generation is also rejected before submission when a
  multi-step sequence would span post-G2P position epochs."
- **Rejection is global and fail closed** (`:1427-1436`): "P2G finalization
  zeros the entire projected grid, while G2P restores immutable input state
  plus all eight mechanics rows for every particle." This is the silent
  rollback the November work watches for with `observeSpatialAuthority=1`.
- Cost of the canonical route against legacy: +3.3% to +4.6%.

### Slice 7 M0-M3: the two-level mechanics transaction (`:1485-1539`, 07-17)
- M0: authenticated sparse-v2 fine and coarse mechanics fields.
- M1: exact fine correction with a single-use energy receipt.
- M2: one terminal coarse reflux in its own queue-fenced arena; positivity,
  CFL, momentum, angular momentum and energy residuals close.
- M3: the fused controller for fine-substep ratios r = 1..4: "exactly `2r+1`
  P2G passes, `r+1` grid updates, and `r+1` G2P passes; performs `r` fine
  corrections and one terminal coarse operation; advances `r+1` authenticated
  private epochs; and publishes no generic or intermediate `S*`".
- Gates: `ULG_RUN_NATIVE_PARENT_FIELD_MECHANICS_M0/M1/M2=1`,
  `ULG_RUN_NATIVE_CROSS_LEVEL_M3_R1_R4=1`.

### Slice 7 M4: the hierarchy (`:1541-1590`, 07-17)
- "a true Morton-prefix binary hierarchy over compact canonical leaves":
  Karras-style internal topology, stackless escape ropes, leaf and internal
  aggregates, an authenticated topology fingerprint, a replay-bound traversal
  receipt. "Traversal materializes no candidate list and uses no per-source
  candidate budget."
- 4,097 sources: conserves mass, first moment, momentum, angular momentum,
  internal and kinetic energy; a query visits 376.89 nodes on average to cover
  4,091.79 far leaves.
- Gas closure made ambient-referenced:
  `p_gauge = c_cfl^2 * (rho - rho0 * p_ambient / 101325 Pa)`.
- **A rejected experiment, rolled back** (`:1581-1590`): keeping
  `Vcurrent = V0 * J` only in mechanics refresh and phase-lane transfer, while
  reaction birth and phase-volume materialization stayed on
  `mass / targetDensity`. "Keeping that half of the authority would mint
  incompatible geometry at two adjacent producers." ICC attempt
  `slice7-volume-authority-isolated-20260717:abandoned`.

### The follow-on that became G2 (`:1592-1620`)
"Steam and hydrogen currently have no complete buoyancy or phase-interface
path." Seven unchecked items:
1. represented-current-volume and volume-gradient moments per phase-resolved
   field node, from valid `V0 * J`;
2. one shared antisymmetric pressure/drag operator for both the local field
   grid update and the parent-field/reflux path;
3. "Supply a hydrostatic ambient boundary ledger or explicit resolved air;
   uniform gravity plus a shared grid cannot manufacture gas buoyancy";
4. conserve consumed source current volume through phase change and reaction
   birth ("target density remains an EOS target that drives expansion work
   instead of teleporting geometry");
5. materialize phase-volume split/merge before mechanics refresh ("The older
   phase-volume migration record is adaptive representation metadata, not
   thermodynamic phase-transfer authority");
6. "Keep the legacy pressure-interface rows disabled. Their geometry comes from
   render-derived support";
7. prove partial sodium/water reactions conserve
   `sum(active V0*J) + sum(live event support volume)`, then require "visible
   hydrogen rise, visible steam transport, pressure-dependent condensation,
   iron/ice heat-transfer continuity, and less than five-percent throughput
   regression".

Hermes (INFERRED): items 3 and 7 are G2's acceptance in everything but name,
and "explicit resolved air" is the November first-class-air decision. Item 5
answers part of question 1 in note 1: the July storage chain is "adaptive
representation metadata"; whether November's split kernel builds on it is
still to be checked in code. Item 6 conflicts with the 11-03 audit's coupling
no. 8 (a pressure-interface force solver in JS reading render rows, "still
live"); check which is true now.

## Part D: lines 1661-2181 (2026-07-18 to 07-24). The file is now read in full.

### Slice 7 M5 release verification (`:1622-1729`, 07-18)
- **Compute passes cost, not just dispatches** (`:1683-1690`): the
  mechanics-field route first "encoded its 13 additional safety/contact
  dispatches as 13 additional compute passes" and regressed 10.75%. "Keeping
  every dispatch and exact state transition but grouping production work into
  one ordered compute pass plus one post-G2P receipt/rollback pass" brought it
  to 3.3%. (Iron Ice today encodes about 106 compute passes per step.)
- Two-level against single-level: the r=2 authoritative two-level mechanics
  plus law chain costs 2.47x p50 of the single-level control (`:1696-1700`).
- Where the time went then (`:1700-1705`): post-mechanics `reactionStep`
  364-369 ms p50, spatial-epoch generation 61-63 ms, derived-view build ~44 ms,
  mechanics-field view ~4.1 ms.
- Behaviour failures kept explicit: steam does not rise or condense; hydrogen
  does not rise.

### Slice 8 closeout (`:1731-1780`, 07-21)
- Reaction discovery feeds an authenticated product-placement /
  topology-transition successor family; thermal proposal and apply share one
  matched-time reciprocal receipt; the compact gas-ledger EOS stays
  GPU-resident; successor render, source-field and native-surface routes
  publish exact generation lineage. "The aggregate render carrier remains a
  presentation proxy rather than coherent-solid body authority."
- The long-liquid gate fails identically on the clean baseline (0.4657 m/s
  retained bulk motion, resident minJ 0.9833): "inherited solver debts".

### Slice 9A: raw-volume moment sidecar (`:1782-1835`, 07-23)
- `schroeder-spatial-phase-volume-moment.v1`: per mechanics-field
  current-volume and volume-gradient rows from strict `V0 * J` (mechanics words
  19 and 18), scattered with the 27-point stencil. Diagnostic only; fails
  closed; no density, phase-reference, render or host fallback.
- Cost: 0.52 ms p50 at 1,024 particles, 0.75 ms at 8,192, against 6.1 ms and
  13.9 ms for the whole spatial encoder span.
- The rest of Slice 9 (pressure sidecar and transport) is recorded in
  `plan/moot/SS/slice9-continuation-handoff-2026-07-24.md` (83 KB; not read by
  Hermes; a reader slice covers it).

### Slice 9D: the shared exact-near traversal view (`:1854-2181`, 07-23/24)
- Purpose: stop each law re-deriving level/x/y/z ranges from the directory.
  Roles stay distinct: "M4 remains an aggregate-admissible far-field
  accelerator; reactions, thermal conduction, and pressure/contact keep exact
  local pair predicates. No local chemistry or contact path may be approximated
  through a far-tree aggregate."
- The **canonical exact-cell hierarchy**: a complete power-of-two binary tree
  over the directory's cells; leaves point to cell/member spans with
  conservative AABBs; `O(cellCapacity)` storage; no neighbour CSR, pair rows,
  candidate budget or private sort; law-neutral.
- Reaction discovery migrated first, with an `R + D` envelope where "`D` is the
  existing GPU displacement certificate" (`:1895-1899`). So a GPU displacement
  certificate already exists on the reaction path.
- "M4 is deliberately not made mandatory by this slice": its producer needs
  particle/render-mechanics admission and a full Morton sort.
- **S9D-2, rejected** (`:1962-1982`): GPU-authored indirect dispatch per tree
  level was 2.23x slower than the direct complete-tree schedule: "Per-level
  indirect dispatch overhead outweighed skipped invocations." Guarding reducers
  outside the live prefix was 1.098x slower. Both removed.
- **S9D-3, accepted** (`:1984-2078`): diagnostic counters were atomically
  incremented per node, leaf, member and candidate even when nobody asked.
  Accumulating per source and flushing once gives 0.62x (dense), 0.75x
  (sparse), 0.72x (clustered) of the old cost. Pipeline cache version
  `v4-s9d-hot-counter-aggregation`.
- **S9D-4, rejected** (`:2080-2138`): thermal as the second tree consumer was
  byte-identical to direct and slower on sparse (1.23x) and clustered (1.08x).
  "The production decision is therefore **retain direct**. No thermal
  migration, runtime topology selector, hidden direct fallback, or dense-only
  special case is admitted."
- **S9D-5, rejected** (`:2140-2181`): source-cell-batched thermal traversal
  with an `R + 2D` envelope: correct, and 1.196x slower overall (sparse 2.7x).
  `productionDecision=retain-direct`. "Any later hierarchy consumer or layout
  experiment requires a new task, lease, native receipt, and
  no-material-regression gate; direct remains authoritative."

## The SS structure as built, in one list (from this record; code not yet checked)

1. Canonical spatial epoch `ss-spatial-epoch.v1`: key emission, sort/unique,
   cell directory (offsets, members, reverse map), identity header, query
   evidence, three-slot arena with bounded backpressure.
2. Spatial-epoch transaction: freeze x_n, admit readers, seal proposals, commit
   once, release behind the owner fence; rejection rolls the step back.
3. Compact mechanics view `ss-spatial-mechanics-view.v1` (unique dense nodes).
4. Mechanics field view: sparse `(node, family, material, continuity domain)`
   fields with unlike-field contact.
5. Four-lane phase carriers (`sph-phase-carrier-plan.v2`).
6. Two-level parent-field mechanics workspace (M0-M3): fine corrections,
   terminal coarse reflux, ratios r = 1..4.
7. M4 Morton-prefix aggregate hierarchy for far-field laws.
8. Exact-cell tree for exact-near traversal (reaction uses it; thermal stays
   on the direct directory).
9. Phase-volume moment sidecar (diagnostic), then the Slice 9 transport work.
10. Artifact ledger and transfer leases for ~30 hierarchy artifact families.
11. Source families and successor lineage for products, gas, render, surface.

## Recorded dead ends in this file (do not repeat without reading them)

- The `gpu-resident-physics-refactor` branch (abandoned; port primitives only).
- Fixed consumer slots, fixed candidates per source, quadratic direct mode,
  packed maximal candidate CSR, multi-rebuild scheduler.
- A single large preflight shader (destroyed the Dawn/Vulkan instance).
- Half-adopted `V0 * J` volume authority (07-17, abandoned and rolled back).
- Per-level indirect dispatch for the tree build (S9D-2).
- Thermal on the exact-cell tree, per particle (S9D-4) and per source cell
  (S9D-5).
- Uncoupled gas acceleration caps without a drag closure.
