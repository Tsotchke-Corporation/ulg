# Digest L: first-class air, the N-level chain, A2, A3/A4 (plans of record)

Sources: `plan/todo/first-class-air.md` (lines 1-145, 147-159, 220-258, 301-341, 553-897 read), `plan/todo/a3-a4-regional-and-multidimensional-closures.md` (all), `plan/todo/a2-incremental-spatial-evidence.md` (all). Figures are Claude's.

## First-class air (the most recent architecture work; sits under A5's "additional SS levels" and G2's room-air route)
User, 2026-11-16: "treat air as a first class sim object in the sph sim like everything else." / "big ss particles/cubes for contiguous air volumes and smaller ones where they touch other materials."

Why: air was seeded at `environmentCellsPerAxis = 2`: ~24 centimetre-scale parcels per species, one row per species, 10-100x the condensed spacing (~2.4 mm). Every air-specific failure of 2026-11-16 followed from that.

| Slice | What | State |
|---|---|---|
| 1a | Split-spare lineage reserve (status 252; URL knob `splitSpareLineages`, default 0) | done 11-16 |
| 1b | GPU lineage scan (`schroederSplitSpareLineageScanGpu.js`; `ULG_RUN_NATIVE_SPLIT_SPARE_SCAN=1`) | done 11-16 |
| 1c | The split/merge kernel on the worker lane (claims children from the reserve) | NOT done |
| 2a | Graded seeding at t=0 (`environmentRefineEdgeMm`, blank = off) | first cut 11-16. 17.5 mm: 14,584 rows, 521/521 admitted, 7.3 steps/s (coarse air: 19). 8.75 mm hit the then-32 MiB product-history cap |
| 2 (rest) | Dynamic interface refine pressure, merge back | NOT done (needs 1c) |
| 3 stage 1 | Mixture material, opt-in `environmentAirParcels=mixture` | done 11-17 |
| 3 stage 2 | Composition set: reactions lifted onto mixtures, spectator residue | done 11-17, live |
| 4 | Gas transport: dilute-gas k and mu for h2o, o2, n2, ar, co2 anchored to CRC/NIST at 300 K in `data/material-properties/compounds.json` (`anchorGasTransport`) | done 11-16. NOTE: the slice was specified as DERIVED Chapman-Enskog transport with NIST as an advisory check; what landed is reference-anchored values with provenance. The derivation is not done |
| 5 | Gas conduction neighbours from the SS directory, not the contact receipt | Partly: gas-gas pairs conduct over the centre distance (11-17). Gas-condensed via the directory: not recorded as done |
| 6 | Retire air special cases (environment cell controls; minimum gas fraction kept only as a numerical floor; redundant gas exclusions) | NOT done |

Acceptance (from the plan): room-air Iron Ice runs with air coarse in the bulk and fine at the iron/ice surfaces; bounded carrier count with measured steps/s; hot iron heating adjacent air; energy and mass exact under the ledgers; no air-specific branches left in the slice-6 laws.

"The contact-owner redesign follows" first-class air (user order: first-class air first).

Mixture parcels: "a hard prerequisite for fine air" (row counts: 2.4 mm grading means 34,030 per-species gas rows, each with 4 phase lanes).

### N-level 2:1 chain (user 2026-11-16/17: N-level chain, sol-critic Priority 3 gate waived)
- Survey: the volume-based classifier already wants a 70 mm air cube on level 3, 35 mm on level 2, 17.5 mm on level 1; `schroederMaxLevel` 0 for Iron Ice collapses that. The 2:1 pair is hard-wired in ~15 places; coverage admission threw `ERR_SCHROEDER_TWO_LEVEL_COVERAGE_UNPROVEN` beyond two levels; room-air Iron Ice runs the single-level route (surface stress, S9-C transport, single-level cleanup would need porting); levels only coarsen; ~46 test files pin the two-level contract.
- Phases:
  - A. Epoch and admission accept a contiguous chain. DONE 11-16/17: `normalizeMechanicsLevelSpecs` accepts up to `SCHROEDER_SPATIAL_MAX_MECHANICS_LEVELS` = 6; hierarchy and parent-field views for every adjacent pair (`mechanicsAdjacentLevelPairs`); `createSchroederTwoLevelCoverageAdmission` takes `maxChainLevelCount` (default 2). The transaction's two-level contract is untouched, so nothing downstream sees a chain yet.
  - B. Chain runner (`schroederCrossLevelCouplingGpu.js`): P2G on every level, restrict pair by pair, update the coarsest, prolong back; one reflux ledger per pair; shared dt first. NOT done. Finding: `runCanonicalSparseMechanics` (~2,000 lines) is a transactional state machine built for one pair; the chain needs per-pair instances plus nested reflux ordering.
  - C. Port the single-level features onto the chain's fine level (surface stress, S9-C transport with the gas mixture stage, single-level cleanup). NOT done. Iron Ice depends on all three.
  - D. Room air: `schroederMaxLevel` 3, hysteresis against level flicker. NOT done.
  - E. Follow-ups: proximity refinement (needs 1c), capacity by occupancy, the sol-critic sparsity items.

### Open items recorded in this plan
- FeO reaches 6780 K (heat proxy puts all reaction heat in the oxide; no vaporization record).
- Product-property quality: discovery's derived FeO melts at 51.5 K, boils at 59.2 K, density 2903 (reference ~1650 K, ~3687 K, 5745). The compound bank holds only 9 compounds, no iron oxide. Fe3N2 is a stoichiometric-family guess (known nitrides: Fe4N, Fe3N, Fe2N). General fix: anchor product closures to bank records. NEEDS THE USER'S GO-AHEAD (asked 11-17, unanswered).
- Mixture parcels stay opt-in until the visual and acceptance checks are re-run in that mode.
- Roadmap gap named by Claude: neither A3 nor A4 names interface heat transfer. Two candidate closures: gas-side sub-cell conduction; contact patch conductance (representative patches at SS level instead of every condensed pair). "Any closure that weakens G2 acceptance needs approval."

## A2 incremental SS membership repair: PARKED BY EVIDENCE (2026-11-14)
- Measured with `?residentGpuTimestampProfile=1`: on water-cycle (canonical SS) the per-step spatial rebuild is at most ~6% of GPU time and under 1% of wall; bulk-water (fused Tier0) does no per-step rebuild.
- Conclusion: do not adopt now. Revisit when (1) A1 has made the SS route GPU-bound and (2) scenes are large enough (100k+ particles on the SS route).
- Not done: the repair experiment itself (moved-member flags or adjacent-node migration, checked against the trusted GPU rebuild).
- Evidence: `~/.cache/icc/repos/ulg/a2-churn-20261114/`.

## A3 representative regional sampling
- GPU-resident: `src/runtime/material/regionalClosureSamplerGpu.js`. Passes: envelope, plan, fit (tensor Chebyshev, up to 256 terms, held-out bound), lookup (`rf_eval`, never extrapolates; out-of-box counts as debt), async expansion with schedule-boundary adoption, verify.
- Gate: `tests/regionalClosureSamplerGpu.native.test.mjs` (`ULG_RUN_NATIVE_A3_GPU=1`): 800 lookups for 160 exact evaluations instead of 850; envelope exit and strict policy cases; replay bit-identical.
- NOT done: "SS-mounted regional consumers remain: G4's cells as regions, fitted and looked up inside the step." A3 is not used in the live step.

## A4 multidimensional response functions
- Host fit: `fitResponseFunction` / `evaluateResponseFunction` in `localClosureFitCache.js` (tensor Chebyshev over a validity box; refuses a box spanning regimes, a violated declared derivative sign, or a fit over tolerance). Tests `tests/responseFunctionFit.test.mjs` 3/3.
- Resident GPU evaluator: `src/runtime/material/responseFunctionGpu.js` (`rf_eval(index, x) -> (value, ok)`, strict). Tests `tests/responseFunctionGpu.test.mjs`, `tests/responseFunctionGpu.native.test.mjs` (max relative error 6.7e-7).
- ONE live consumer: the semi-implicit pressure solve's stiffness (Eshkol-derived Tait response, storage binding 12), in every water-realtime step. So "not used live" in Claude's table is slightly too pessimistic for A4.
- Limits: domains so far are 2-D first-principles gas and caloric responses; broader compound and property families need their own generators.
- Host-side debt under the "nothing on the host" rule: the A4 fit itself (`fitResponseFunction`) still runs on the host.
