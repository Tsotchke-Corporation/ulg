# Contact match-retry sub-round (opt-in) — design (2026-08-27)

Goal: recover the ~half of contact members that lose mutual-best matching
each pass (applied ~6/pass vs a ~13 matching ceiling on 27 members), to
cut active pass count ~40% at ~+25% pass cost. Opt-in via
`contactMatchRetry=1`; default builds compile byte-identical WGSL.

## Mechanism

Inside each logical pass, after the mutual-best apply phase:
1. First apply marks every member it applied with a transient
   MATCHED_THIS_PASS owner-flag bit (0x8), template-gated.
2. A retry selection re-runs the wave-grouped scan for unmatched contact
   members with `exclude_matched=true` (skips candidates whose peer is
   matched); overwrites the ledger row; does NOT count selection
   evidence (the completeness prestore already balanced).
3. A retry apply applies the new mutual pairs; does NOT count the
   apply-completeness word; DOES add applied_pair_count (the sweep
   delimiter sees the pass total) and marks cursors inactive + records
   movers exactly like the first apply.
4. The propagate phase clears MATCHED on movers (every matched member
   moved, so propagate visits exactly the set that needs clearing).
5. The owner-flag validation masks admit the bit only when the retry is
   compiled in.

## Physics status

NOT bit-identical to the baseline (more pairs apply per pass; different
f32 application order). Same pair-projection math, same per-pair
conservation receipts, same completeness proofs, same sweep-marker
coverage discipline (retry-applied edges mark their cursors). Gate on
the physics-equivalence train: focused suites, cleanup profile A/B at
identical knobs for the DISABLED path (must stay bit-identical),
enabled-path visual sanity on sodium-water + iron-ice, deep matrix arm
before any default flip.

## Plumbing

URL `contactMatchRetry` -> scene option -> WORKER_RESIDENT_STEP_OPTION_FIELDS
-> step `contactMatchRetry` -> proposal runner -> solver budget
(`resolveSchroederSpatialMechanicalSolverBudget({ ..., contactMatchRetry })`,
cache key `j16.p512.r1`) -> WGSL template conditionals
`${solverBudget.contactMatchRetry ? ... : ''}`.

## Function changes

- `apply_matching_cleanup_edge_for_index(self_index, count_completeness: bool)`
  — every apply-count add gated; MATCHED flag ORs on applied members in
  the template-gated block; callers updated (owner true, standalone true,
  retry false).
- `mechanical_matching_selection_scan_range(..., exclude_matched: bool)`
  — active-candidate loop skips peers whose owner flag has MATCHED.
- `mechanical_matching_selection_epilogue(..., count_evidence: bool)`.
- Owner pass body: retry block (selection waves + apply loop) between the
  first apply's barrier and the wall-count evidence block; propagate
  clears MATCHED on movers.

## Expected

applied/pass ~6 -> ~10-12; active passes ~495 -> ~280-320; owner
~75 -> ~50 ms; step ~86 -> ~60 ms; ~17 steps/s. The next rung (toward
30) is Jacobi-wide pair application with deterministic accumulation —
solver redesign, separate design.
