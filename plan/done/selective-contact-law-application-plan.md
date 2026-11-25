# Selective contact-law application: MPM and pair-contact where each matters

Date: 2026-08-21. Status: design direction, post-merge implementation; the
solver knobs (`contactJacobiIterations`, `contactCleanupPasses`,
`contactSolver`) land with the contained-merge candidate to make every claim
here measurable before any of it is automated.

## The two laws and their true domains

MLS-MPM's grid transfer already is a contact law: particles sharing grid
nodes exchange momentum through one velocity field, which resists
interpenetration at grid resolution for free. Its character flaws are
well known and visible in this tree: the interaction is diffuse (smeared
over a cell), effectively no-slip and no-separation (one velocity per
node is why generated H2 moves with the naoh it is born in), and blind
below grid resolution.

The mechanical pair-graph solver (16 Jacobi rounds + serial matching
cleanup) is the sharp-contact law: exact non-penetration, separation,
sub-cell resolution, per-pair reciprocal-mass response. Its cost is
structural: cleanup progress on serial contact chains is ~1 pair per 3
passes, the measured worst chain in the iron-ice 768-step diagnostic
needs ~890 passes inside one physics step, and every encoded pass is a
serial single-workgroup dispatch the presentation path must wait behind.

## Evidence the allocation is wrong today

Both laws currently run everywhere, every step, at worst-case strength.
The passing iron-ice run shows the cleanup active on 727 of 768 steps,
applying 36,639 pair corrections across a scene that is visually settled
for most of that time. Either it is doing legitimate resting-contact
maintenance, or the grid law and the pair law disagree about equilibrium
and re-fight the same contacts every half-millisecond. This codebase has
already produced three two-writers-one-quantity defects (the J-reset that
erased G2P strain, the gauge/absolute prestress lane confusion, the
represented-volume aliasing), so the fighting hypothesis carries real
prior weight. Jacobi itself is measurably over-provisioned in steady
state: worst-case position violation falls 20.3x -> 2.6x in rounds 1-5
and only 2.54x -> 2.42x across rounds 6-16.

Note the known headline unrealism (steam-rises, hydrogen-rises) was
diagnosed to transport/EOS lanes, not contact; what contact misallocation
would corrupt is impact feel, splash damping, separation stickiness, and
resting-stack jitter.

## The ULG answer: admission predicates, not global toggles

Which law applies where is the project's own thesis applied to its
solver. Every signal a per-region admission decision needs is already
computed by the SS machinery:

- **Interface predicate.** Pairs spanning different materials/domains
  (the pair graph carries identities) admit the contact law. Same-material
  bulk pairs are the grid law's home turf and skip it.
- **Kinematic predicate.** Relative approach speed above a threshold, or
  penetration beyond a fraction of the native cell, admits contact even
  same-material (splash impact, wave breaking).
- **Scale predicate.** SS level assignment is the router: coarse levels
  (gas, diffuse media) never need pair contact; fine levels near admitted
  interfaces do. The spatial hierarchy exists to make exactly this
  decision cheap.
- **Settledness demotion.** A chain that converged with member velocities
  under threshold demotes to a cheap monitoring pass until re-excited by
  impulse or topology change. Resting stacks stop paying hundreds of
  passes per step for stillness they already proved.

Budgets follow the same logic: cleanup pass budget allocated from
measured chain depth per region rather than one global worst case;
Jacobi defaults near the measured plateau (~5) and escalates on
impact-admitted steps.

## Truthfulness contract

Tolerances (velocity residual 1e-5 m/s, position ratio 1.0) and residual
verification never become knobs; the modes differ only in how long the
solver may try and where it is admitted. Every run seals which laws ran
where and at what budgets; a skipped region is sealed as skipped, and
fail-closed steps remain sealed and counted. The completion oracle's
claim shifts from "contact ran everywhere" to "no unadmitted contact
violation," verifiable by sampled exhaustive checks on regions the
predicates skipped.

## Product modes from one parameterization

- **Real-time plausible:** aggressive predicates, low budgets
  (Jacobi ~5, cleanup ~512 interactive), fail-closed steps accepted and
  visible.
- **Scientific non-real-time:** permissive predicates, run-to-convergence
  cleanup (loop until tolerance, no fixed horizon), fail-closed only on
  true non-convergence.

## Experiments the knobs unlock immediately

1. Contact on/off/gain A/B on the four standard scenarios; judge energy
   drift (sphIronIceEnergyBudgetOracle), velocity divergence, and eyeball
   realism. If bulk-flow scenes improve or hold with contact off while
   sharp-interface scenes degrade, the division of labor above is
   confirmed and the predicates have their thresholds.
2. Jacobi sweep 2/5/16: measure cleanup pass counts inherited by each
   (theory: 2 rounds hands the serial phase 5-6x the disorder and
   balloons chains; 5 matches 16 within noise).
3. Cleanup budget sweep vs fail-closed step counts per scenario, to size
   per-context presets from data instead of anecdote.

Related: plan/todo/SS/ss-law-architecture-assessment.md,
plan/todo/sol-critic.md (priority ordering), the post-merge sweep-rate
debt recorded in the ICC task notes for
complete-ss-five-merge-gates-20260727.
