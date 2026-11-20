# SS note 4: first-class air and the N-level chain (the newest SS work)

Source: `plan/todo/first-class-air.md` (897 lines; written 2026-11-16 and
11-17, uncommitted). Read by Hermes in full, 2026-11-17. This is the most
recent document that changes SS, and it is where the campaign last touched the
hierarchy before the pause.

## The direction (owner, 2026-11-16; `:3-7`)

- "treat air as a first class sim object in the sph sim like everything else."
- "big ss particles/cubes for contiguous air volumes and smaller ones where
  they touch other materials."

That is the Schroeder Algorithm's own rule (refine near surfaces, coarsen
coherent bulk) applied to air. Decisions the same day (`:58-63`, `:584-586`):
the third-level hold is lifted ("Use 3+ levels ... so contiguous air is
genuinely coarse"); an **N-level chain of 2:1 pairs**, not a skip-level pair;
the `sol-critic.md` Priority 3 gate is waived; air parcels become mixture
parcels.

The owner's hope for cost (`:67-69`): "hoping this will be solved with
optimizations around simulating only representative samples and with Eshkol
approximated functions for complex underlying behavior." The doc maps that to
A3 (representative samples) and A4 / Goal 6 (Eshkol functions), and records a
gap: neither names interface heat transfer (`:83-92`).

## What SS actually runs today, per this document

- "Only two SS grid levels are active (fine, and coarse at 2×)" (`:55-56`).
- **Iron Ice does not use the two-level runner at all.** "room-air Iron Ice
  runs the single-level route (surface stress, S9-C transport, single-level
  cleanup). The two-level runner has none of those, so they would need
  porting" (`:568-570`). `schroederMaxLevel` is 0 for Iron Ice (`:558`).
- The level classifier already assigns by volume: "a 70 mm air cube on level 3
  (8×), 35 mm on level 2 and 17.5 mm on level 1. The max-level clamp ...
  collapses that" (`:555-558`).
- "levels only coarsen (`max(physical, source)`), and split is not on the
  worker lane ... Hysteresis is stored but unapplied" (`:571-572`).
- The 2:1 adjacent pair "is hard-wired in about 15 places": the epoch, the
  transaction, the two-level runner, the reflux ledger, hierarchy view
  (`floor_div2`, `*0.5`), parent-field view and workspace, interface proposal,
  gas boundary, invariant evidence (`:559-565`). Coverage admission throws
  `ERR_SCHROEDER_TWO_LEVEL_COVERAGE_UNPROVEN` when max − min level > 1.
  "About 46 test files pin the two-level contract."

## Why coarse air needs levels, not just big parcels (`:535-551`)

With ambient density set to 0 in room air, "the coarse air **sank**" and steam
no longer rose. "a coarse explicit parcel (~7 cm) acts on the grid only within
its ~5 mm support, so parcels never press on one another. The air is not
pressure-supported, and the implicit atmosphere was what held it up." "The real
fix is air carriers on SS levels whose grid spacing matches their size: the 3+
level decision, slice 2 dynamic coarsening. After that, pass 0."

So explicit air is still held up by a matched implicit atmosphere
(`:725-729`). Removing that stand-in depends on chain phases B to D.

## The N-level chain: phases and state (`:588-632`)

| Phase | Content | State |
|---|---|---|
| A | Epoch and admission: coverage accepts a contiguous chain; hierarchy view and parent-field view for every adjacent pair; exact 2:1 checks per pair | **Done 11-16.** Up to `SCHROEDER_SPATIAL_MAX_MECHANICS_LEVELS` = 6; pairs published as `mechanicsAdjacentLevelPairs`; `maxChainLevelCount` defaults to 2. "The transaction's two-level contract is untouched ... so nothing downstream sees a chain yet." |
| B | Chain runner: P2G on every level; restrict pair by pair to the coarsest, update, prolong back; one reflux ledger per pair, nested; shared dt first, subcycling later | Not started. Finding: the two-level runner (`runCanonicalSparseMechanics`, ~2,000 lines) "is a transactional state machine built for one pair"; the chain "needs per-pair instances of these, plus nested reflux ordering" |
| C | Port the single-level features to the fine level of the chain: surface stress, S9-C phase-volume transport (with the gas mixture stage), single-level cleanup. "Iron Ice depends on all three" | Not started |
| D | Room air: `schroederMaxLevel` 3, then ambient density 0, and hysteresis against level flicker | Not started |
| E | Proximity refinement (needs the split kernel), capacity by occupancy, the sol-critic sparsity items, mixture parcels | Mixture parcels delivered separately; the rest not started |

## Split and merge on the worker lane (slice 1; `:160-257`)

This reuses the July storage chain (SS note 1), which answers the question
raised there.

- One orchestrator, `runSchroederSameLevelMechanicsWebGpuImpl`, chains
  migration → split/merge proposal → apply → allocation → slot assignment →
  materialization → count/compaction → adoption guards.
- "The page path ... passes every admission. The worker ... passes only
  `enablePhaseVolumeMigration`, so the chain stops with
  `disabled-phase-volume-split-merge-admission-not-provided`."
- Blockers inside the step: materialization is "not-phase-pair-aware"; under a
  phase plan it is marked not required; it is exclusive with phase-carrier
  transfer; with exact mass it throws.
- The free list is "only an append window ... freed slots are never returned".
- Design: split-spare gas lineages (status 252) with reserve identities,
  modelled on the reaction-product spare pool (status 253); a GPU lineage scan
  that writes the free-list row; in-place materialization at
  `phase_lane_index(spare_lineages[rank], phase)`; merge returns the lineage
  when all four lanes are empty; the commit bumps `topologyEpoch` and
  `identityRevision`; f32 route first.
- **1a done** (reserve; URL knob `splitSpareLineages`, default 0).
  **1b done** (`schroederSplitSpareLineageScanGpu.js`, native gate
  `ULG_RUN_NATIVE_SPLIT_SPARE_SCAN=1`, no CPU implementation).
  **1c not done**: the split/merge kernel itself on the worker lane. Dynamic
  refinement, hence "smaller ones where they touch other materials" while
  things move, waits on it.

## The other slices

| Slice | State |
|---|---|
| 2a graded seeding (static octree at t = 0) | Done as opt-in (`environmentRefineEdgeMm`). Cost on Iron Ice: 160 gas rows ungraded; 1,985 at 17.5 mm; 4,385 at 8.75 mm; 34,030 at 2.4 mm, times four phase lanes. At 17.5 mm: 14,584 rows, 7.3 steps/s against 19 for coarse air |
| 2 dynamic (interface refine pressure, merge back) | Not done (needs 1c) |
| 3 mixture parcels | Stage 1 and stage 2 delivered 11-17, opt-in (`environmentAirParcels=mixture`). Stage 2 uses a closed **composition set** (air, air~o2, air~n2, air~n2~o2) with reactions lifted onto mixtures, by owner decision, instead of a per-row composition buffer |
| 4 gas transport | Done 11-16, but as bank values: "Values are CRC/NIST at 300 K" with a `gas-transport` provenance entry. The slice as planned was Chapman-Enskog derivation with NIST as "an advisory check" (`:115-119`). **The delivered form is an imported property, not a derived one** |
| 5 gas conduction neighbours | Gas-gas mixing conduction done 11-17 (overlap geometry). Gas-condensed pairs from the SS directory are not reported as done |
| 6 retire air special cases | Not done |

## Fixes found on the way that are general, not about air

- Contact trust radius: `SPH_CANONICAL_CONTACT_POSITION_TRUST_DIAMETERS` 16 → 1
  turned an all-pairs graph of ~440k rows into 12-15k (`:342-355`).
- A gauge-dependent energy check (`next_u < 0`) fired for ice, whose u is
  negative in the phase-caloric gauge (`:357-361`).
- Reaction products written into a freed row of a partly frozen lineage made a
  two-material lineage, against the phase-carrier v2 invariant; such pairs are
  now deferred (`:373-396`). Routing them out as events "was tried and fails".
- Explicit fusion and boiling authorities for explicit-branch materials
  (`:398-446`).
- Drag-pair energy residual: an f32 underflow in `dot(D, D)` for sliver fields
  (`:499-516`).
- Buoyancy: Amagat displaced volume `V·p_i/p_amb`; gas rest density on the
  101,325 Pa basis; Amagat seeding (`:634-642`, `:712-724`).
- A stiff gas-mixture momentum stage (`stage_gas_mixture`): tried, reverted,
  then restored after the drag fix (`:458-516`).

## Open at the pause

- Chain phases B, C, D; split kernel 1c; dynamic refinement; slice 6.
- Mixture parcels stay opt-in "until the visual and acceptance checks are
  re-run on them".
- FeO reaches 6,780 K; derived product closures are poor ("FeO melts at 51.5
  K"; the compound bank has 9 compounds and no iron oxide; "Fe3N2 itself is a
  stoichiometric-family guess"). The proposed general fix is to anchor product
  closures to bank records (`:885-897`). This is the question waiting on the
  owner.
- About 25% of steps were ITERATION_INCOMPLETE on impact (the contact owner's
  pass budget); `contactInnerRounds=2` cut non-convergence from 46% to 7%.
- "The contact-owner redesign follows" first-class air (`:129-132`).

## The document's own acceptance, against what exists (Hermes)

| Acceptance item (`:134-142`) | State |
|---|---|
| Air carriers coarse in the bulk and fine at the iron/ice surfaces | Only as static graded seeding, opt-in. Not on matching SS levels, not dynamic |
| Bounded carrier count, with measured steps/s | Measured for graded seeding (7.3 steps/s at 17.5 mm) |
| Hot iron heating adjacent air | Not shown in this document |
| Energy and mass exact under the existing ledgers | Room air "runs the f32 mass route (`ROOM_AIR_EXACT_MASS_DECLARED = false`)" (`:777-778`), so the exact ledgers are not in force there |
| No air-specific branches left | Slice 6 not done; the implicit atmosphere still holds explicit air up |

## What this means for "the SS work is critical" (Hermes, INFERRED)

1. The campaign's flagship scene runs on **one** SS level. Two-level coupling
   exists and is verified natively (July, M0-M4) but lacks surface stress,
   phase-volume transport and cleanup, so no campaign scene exercises it.
2. The owner has now asked for the thing SS was designed for: carriers sized by
   their physics, coarse in bulk and fine at interfaces, across three or more
   levels. Only phase A of five is built, and "nothing downstream sees a chain".
3. Every remaining first-class-air item is SS work: the chain runner (B), the
   feature port (C), level policy with hysteresis (D), and topology change on
   the worker lane (1c).
4. Slice 4 swapped a derivation for bank values. That is allowed by the Star
   Spec only as case 3, "imported ... with explicit provenance", and must not
   be reported as derived.
