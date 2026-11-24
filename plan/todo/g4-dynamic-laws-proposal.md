# G4 generalized per-node warm dynamic laws

> **2026-11-22 Live-Code Status (`2fe9e47b`, Consolidated into Gate 3):** **OPEN**
> (`0` formal oracle receipts). P1 fixed `radiationEpsilonFluxWPerM2`, propagated
> packed G6 `uncertaintyBuffer` into reaction & phase dormancy, and wired real
> `dispatchWorkgroupsIndirect` (`propose_active`) on reaction discovery +
> optional indirect dispatch on phase transfer (verified on Vulkan). **Remaining
> under Gate 3:** replace private 3D box grids in thermal/reaction dormancy with
> canonical SS tree nodes and switch thermal & radiation law steps from dense
> launches to real `dispatchWorkgroupsIndirect`. See
> [`plan/CURRENT-PLAN.md`](../CURRENT-PLAN.md).

Date: 2026-11-14. Task: ICC `ulg-g4-dynamic-laws`. Oracle:
`ulg-g4-dynamic-laws`. The design lineage is
[scale-adaptive-law-activation-plan.md](scale-adaptive-law-activation-plan.md),
Phases B and C: the envelope watch gates law stages at node scope, and the
activated laws iterate triggered regions only.

## Oracle criteria

1. Candidate review: exact source, activation lineage, and random
   reaction-family evidence.
2. Generic warm activation, beyond the reaction seed:
   - conservative per-node envelope tests route relevant generalized warm
     kernels;
   - no material or scenario compilation;
   - no second scheduler.
3. Scoped-law invariants:
   - the dormant, breach, activation, recovery and zero-work paths pass GPU
     A/B and conservation tests;
   - configured presets and scientifically grounded random pairs use the same
     pipeline.

## What exists (M7, 2026-08-29/30)

- Schedule-level activation for reactions (the "reaction seed"). An
  authenticated dormant → executing transition, triggered by a watch table.
- Motion and contact envelopes, and a thermal/phase false-zero closure. These
  latch whole law stages for a schedule.
- `lawActivationReceipt` per schedule, the closure regime store (envelopes,
  invalidation keys), and the on-GPU conditional-with-receipt pattern (the
  contact zero-edge bypass).

**Missing:** node scope. A law today runs for every particle once any node
needs it.

## Proposal

Each law family gets a **conservative activation predicate**, evaluated per
SS node on the GPU before the law's stage, writing the node's activation bit
into the existing law queue rows (`runSchroederLawQueueWebGpu`, today an
allow-gate):
- **Thermal conduction.** Active when the node's member temperature span, or
  its wall/radiation source term, can move energy by more than the declared
  per-step envelope ε_E. Concretely: conductance × ΔT_max × dt ≥ ε_E.
  - Dormant nodes contribute zero flux. A pair crossing an active and a
    dormant node is evaluated by the active side's thread, so exchange stays
    antisymmetric.
- **Phase change.** Active when any member's u lies within the reachable
  energy band of a transition plateau this step (|u − edge| ≤ max dU over one
  step).
- **Reactions** keep the M7 watch table, now at node scope: reactant-pair
  co-residence in the node and a temperature threshold.

The kernels stay generalized and warm. One compiled pipeline per law family,
data-driven by the material tables; activation only changes which nodes'
rows the dispatch walks, using the compacted active-node list (Tier 2), via
indirect dispatch from the GPU-written count. There is no host readback and
no per-material compilation.

**Receipts.** Per schedule:
- the per-law active node count;
- an exact zero-work witness when it is zero;
- debt: the energy the dormant nodes did not move, bounded by the per-node
  ε_E sum.

## Gates (GPU, declared tolerances)

- **A/B bit identity.** In a scene where every node is above the envelope,
  gated equals ungated bit for bit.
- **Dormant zero work.** A uniform-temperature scene launches zero thermal
  workgroups (indirect count 0) and moves exactly zero energy.
- **Breach.** A hot body entering a dormant region activates its nodes in the
  same step: no missed flux beyond ε_E per node-step.
- **Recovery.** Gradients decaying under ε_E return nodes to dormant. Total
  untransferred energy ≤ Σ ε_E, recorded as debt.
- **Conservation.** Σ U is exact on the ledger route under gating, because
  dormant fluxes are exactly zero.
- **Presets and random pairs.** Water-cycle, sodium-water, Iron Ice and a
  random scientifically grounded material pair run the same pipeline.
  Activation lineage appears in the receipts.

## Order

G3 Phase 4 (melt ownership) finishes first. Then thermal node gating, then
phase, then reaction node scope, then the receipts and the A/B suite.

## Slice 1 results, 2026-11-14: conservative thermal dormancy predicate

**Module.** `src/runtime/sph/schroederThermalDormancyGpu.js`.
1. Temperatures are reduced per cell, as order-preserving u32 atomic min and
   max.
2. Each present source checks the span over its 3 × 3 × 3 cell halo (cells at
   least the conduction support) and its wall exposure.
3. A source is dormant when both are within ε_T. Radiation keeps every source
   active, because it is not gated in slice 1.

The halo symmetry makes the predicate pair-conservative: an above-ε pair is
seen by both endpoints.

**Gate.** `tests/schroederThermalDormancy.native.test.mjs`: 4,000 sources,
2 m box, 0.25 m cells, ε 0.01 K, 0.2 m support.
- **D1, uniform:** 0 active, all 3,764 present sources dormant (zero-work
  witness).
- **D2, two-temperature field with sub-ε noise:**
  - 1,009 above-ε pairs, with 0 cases of a dormant endpoint;
  - active sources confined to x ∈ [0.75, 1.25] around the interface at
    x = 1;
  - 75% of sources dormant.
- **D3, hot floor:** exactly the 145 sources within its 0.1 m support are
  active.

**Next: kernel wiring.** In the canonical thermal proposals:
- a dormant source publishes a zero proposal;
- active sources skip pairs with dormant partners (|ΔT| ≤ ε by construction),
  so both sides skip;
- compacted indirect dispatch over active sources;
- receipts and the A/B suite.

## Slice 2 results, 2026-11-14: dormancy wired into the canonical thermal producer

**Kernel** (`schroederSpatialThermalProposalsGpu.js`). No new binding and no
pipeline-layout change:
- **Flags.** They live in a second tail of the derived buffer, after the
  ActiveSource rank sidecar: word `10 + P·11 + i`. The tail is cleared with
  the derived buffer every encode, so an unwritten flag means active.
- **Switch.** Params word 22 (`thermal_dormancy_enabled`) turns gating on.
- **Encode order.** The dormancy stage runs after the derived prepass and the
  conductivity finalize, and before the budget pass. It reads this step's
  derived temperatures (row word 0) and the maximum radius (header word 0).
- **Cell edge.** The edge is at least every pair-law support:
  max(floor, 2h, 2·RADIATION_PAIR_RANGE_RADII·r_max) × 1.0001, computed on
  the GPU each step.
- **Out-of-grid sources** are clamped into the boundary cells. Clamping is
  1-Lipschitz, so the halo stays conservative.
- **Bad temperatures.** A present source with a nonfinite or non-positive T
  poisons its cell, which keeps every source near it active.
- **Dormant source.** In the budget pass it records [T, T] as its band, with
  zero requests (an isolated source's budget). In the propose pass it
  publishes a zero row and marks CSR route bit 8 (DORMANT).
- **Pairs.** The pair visit returns NO_REPLAY when either endpoint is
  dormant, so both sides skip the pair.
- **CSR validation.** A dormant source must not claim a candidate row, so
  CSR replay stays sealed and valid.
- **Ungated laws.** Wall and ambient laws (applied after the proposals) are
  not gated.

**API.** `runSchroederSpatialThermalProposalWebGpu({ thermalDormancy: { epsilonK, boxM, originM?, minCellEdgeM? } })`.
- The step passes `thermalStepOptions.thermalDormancy` (`{ epsilonK }`),
  with the grid set to the box.
- Receipt: `artifact.thermalDormancy`, holding the schema, ε, gated laws,
  the counts buffer `[active, dormant, present, overflow]` and the flags.
- Default off; null means the established route.

**Gates (native Vulkan).**
- **Canonical producer.** `ULG_RUN_NATIVE_THERMAL_DORMANCY=1`
  `tests/sphThermalCanonicalNativeWebGpu.test.mjs`, 15 s: a 640-source Fe
  lattice (8 mm pitch, overlapping contact), hot half against cold half.

  | Gate | Measured |
  | --- | --- |
  | **D-A** bit identity, ε = 0, clean lattice | applied state, thermo and proposal rows are bit-identical to ungated; 400 of 641 sources dormant; CSR replay route |
  | **D-C** sub-ε noise, ε = 0.1 K | 400 dormant; 1,000 contacting pairs skipped, max skipped \|ΔT\| 0.025 K ≤ ε |
  | **D-C** debt | skipped \|raw\| energy 0.0126 J ≤ its ε bound 0.268 J |
  | **D-C** conservation | reciprocal residual 1.1e-6 J; dormant rows move zero pair energy |
  | **D-Z** decayed field (every span ≤ ε) | counts [0, 641, 641, 0]; zero conduction; zero support-mask hits; route DORMANT only (the stateless predicate's recovery case) |
  | **D-B** breach (one 1,200 K source in a dormant 240 K field) | source active; its proposal row is bit-identical to ungated; its halo is active in the same step |

- **Ledger route.** `ULG_RUN_NATIVE_EXACT_THERMAL_ENERGY=1`, the "closes sum"
  test: a far Fe cluster spanning 0.35 K, at ε = 0.5 K.
  - **Gated:** its integer U rows are exactly frozen, while the near cluster
    still exchanges.
  - **Ungated:** the far cluster exchanges.
  - **Both:** ΣU − S is bit-exact.
- **Regressions with gating off:**
  - the full canonical thermal native suite passes (2/2);
  - the exact thermal energy suite passes (4/4);
  - the host thermal proposal tests pass (45/45; two layout expectations
    updated: one more publish site, and the dormancy tail).

**Not done yet:**
- **Compaction.** Dormant threads exit before traversal, but workgroups are
  still launched over the ActiveSource dispatch. Compacting them (an
  indirect count of 0 in the zero-work gate) needs a thermal-active ordinal
  map under the ActiveSource view. That is performance work, deferred to A1.
- **ε > 0: approved as an opt-in (user, 2026-11-16: "Allow ε > 0 as
  opt-in").** Exact ε = 0 stays the default.
  - It skips pairs with |ΔT| ≤ ε, a bounded approximation (the debt).
  - It is set per run with `thermalDormancyK=<ε>`; the canonical hash
    persists it.
  - Live check (water-cycle, `thermalDormancyK=0.01`): the dormancy readout
    shows epsilonK 0.01, and the law-scope receipt reports `epsilon: 0.01`,
    `exact: false`. The approximation is labelled in the receipt, never as
    exact.
- **Phase-change and reaction node scope** (the next G4 slices).

## Slice 3 results, 2026-11-14/15: exact reaction node scope

**Module.** `src/runtime/sph/schroederReactionDormancyGpu.js`, consumed by
canonical reaction discovery (`schroederSpatialReactionDiscoveryProposalGpu.js`).

**Predicate** (exact, no ε). A source is active when its 3×3×3 cell halo (cell
edge ≥ the maximum contact radius) satisfies, for some enabled reaction that
has the source's material as a reactant, both:
- the halo holds the co-reactant's material (a 32-bit presence mask, a superset);
- the halo's maximum temperature reaches T_act.

Otherwise the source has no feasible pair. Skipping its traversal leaves its
proposal row bit-identical. The predicate is symmetric, so a feasible pair has
both endpoints active.

**Gates** (native, `tests/sphReactionRuleIndexNativeWebGpu.test.mjs`):
- **All active:** the proposals are bit-identical to ungated.
- **T_act = 1e9 K:** every source is dormant, and the proposals are the same (empty).
- The thermal/phase-ineligible table and a moved state also pass.

## Slice 4, 2026-11-15: the same pipeline on every configured preset

**Change.** Exact dormancy is now the default for every preset
(`src/visualization/sphPhaseDemoMount.js`):
- thermal ε_T = 0, reaction node scope on;
- `thermalDormancyK=off` and `reactionDormancy=0` restore the ungated route;
- ε_T > 0 stays an explicit opt-in that needs approval;
- the canonical hash persists only opt-outs and ε > 0.

**Live A/B.** Exact-step fingerprints (`scripts/a1-ab-check.mjs`,
`A1_FINGERPRINT_STEP=300`; fluid state and thermo copied in queue order) with
dormancy on and off:

| Preset (dt) | State / thermo hash at step 300, on = off | steps/s off → on | Dormant (thermal; reaction) |
| --- | --- | --- | --- |
| iron-ice-quench (0.5 ms) | 22f79fe7 / 5cc83de4 (frames ada83cf) | about the same, 33.9–37.0 vs 35.7 | 0 of 235 (hot scene); no reactions |
| sodium-water (1 ms) | e0746337 / c8be8e2c | 34.4 → 41.0 | 0 of 194; 122 of 194 reaction sources |
| water-cycle (1 ms) | 4a6bd7e0 / a1017df5 | 41.4 → 76.5 | uniform-temperature sources |
| cesium-fluorine (default dt) | not comparable: the ungated route itself is nondeterministic run to run (two off runs gave state 43ce17dd vs d8f06a83 at step 64) | 1.84 → 1.84 | — |

The steps/s figures are one run each. Bit identity is the gate; the speedups
are supporting evidence. Cesium–fluorine cannot use a hash gate, because two
ungated runs already differ (likely order-dependent float atomics on its
two-level or reaction route). Its exactness rests on the native gates and the
three deterministic presets. Its nondeterminism is a separate open item.

**Phase change.** The phase-carrier transfer is a per-particle local law with
no neighbour traversal, and its kernel already applies the exact local test
(apply pass about 0.014 ms per step on Iron Ice). A node-scope predicate would
add a classification pass without removing work, so it is not adopted. This
is a measured decision, not a gap.

**Per-schedule receipt (done, 2026-11-15).**
`src/runtime/sph/lawActivationReceiptRing.js`:
- **Recording.** Each gated stage (thermal dormancy, reaction node scope)
  copies its 16-byte counts into a per-schedule ring inside its own command
  encoder. That adds no pass, no submit and no host wait.
- **Reading.** The worker opens the ring at the first step's epoch stage and
  maps it once after the schedule's terminal fence (fixed-size compact
  evidence).
- **Publication.** The receipt is published as `lawScopeReceipt` in the
  schedule result. `lawActivationReceipt` remains the schedule-level
  activation.
- **Contents, per law:** gated encodes; active, dormant and present
  source-steps; overflow; zero-work steps (sources present, none active); ε;
  and whether it is exact.
- **Live, sodium-water at dt 1 ms, one schedule:**
  - thermal: 63 encodes, 12,222 active of 12,222 present source-steps (ε 0);
  - reaction: 4,536 active and 7,686 dormant of 12,222 (63% dormant), exact;
  - no overflow.
- **Tests:** `tests/lawActivationReceiptRing.test.mjs`.

**Still open:**
- workgroup compaction (A1);
- ε > 0 (needs user approval).
