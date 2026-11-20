# G6 local provenance-bound online closure fit and cache

## G6 production worker acknowledgement verified — 2026-11-19 UTC

The worker retains a private GPU fit candidate after a physical schedule. The
page control plane persists its exact descriptor with the actual completed
schedule, then rereads that StateManager entry before acknowledging adoption
in the next schedule. Lane/state, producing/consuming schedule, physical epoch,
particle count, original thermal source and parent generation are bound. The
scene forwards the acknowledgement independently of presentation. Missing or
mismatched acknowledgement cancels the candidate; old fitted/direct behavior
continues. Capacity pressure defers fitting, cancellation/error retires pending
ownership, and changed cold thermal sources require a fresh lane.

The final native test uses a real module Worker and actual seed, hierarchy,
thermal, mechanics, queue fence, ComputeManager lease and StateManager owners.
Two sequences cover normal acknowledgement and a deliberately dropped one:
12 direct/fitted physical intervals, exact mass/U-S and hot-to-cold transfer.
Fit ordinals are 0/1/1 and 0/0/1 respectively; cumulative consumer hits are
0/2/4 and 0/0/2. Maximum relative transfer disagreement is 4.236e-6 against
the declared 1e-3 budget. Two source changes reject before physics advances.
Zero GPU validation errors. Candidate completion reads 32 bytes, included in
the existing schedule copy budget; independent physical proofs read 128 bytes.
Proof snapshots stay on GPU and precede production predecessor retirement.

Final host suite: 732 pass, three existing opt-in skips, zero failures. Build
passes. Host fault coverage includes tampered/missing warm commits, wrong
acknowledgements, replay, source/epoch changes, device loss and bounded capacity.
The native fixture uses its own IPC dispatcher; it does not exercise the
mounted scene/offscreen presentation bridge. Full G6 also retains G4 uncertainty,
source-potential identities/closed cycles, Eshkol pinning, two-level numerical
coverage and resource/latency acceptance. Default scenes remain unenrolled.
Only G5/G7 are accepted. Evidence:
`~/.cache/icc/repos/ulg/g6-worker-adoption-20261119/`.

## Complete physical thermal intervals verified — 2026-11-19 UTC

The ordinary resident step and two-level hierarchy forward the optional
potential to the original thermal proposal. The new native fixture exercises
the actual single-level hierarchy, MLS-MPM mechanics, matched-time thermal
proposal, exact thermal apply, mechanics refresh and physical successor owner.
It never substitutes a physical producer or maps particle/ledger payloads.

Three cold manufactured scenarios cover isolated pair conduction, actual
parcel-wall contact with a 400 K reservoir, and reversed hot/cold placement
with unequal masses. Each runs three direct and three fitted intervals at
1 us. Original 2 GPa bulk stiffness and type-2 phase selection remain. GPU
reductions verify exact mass, exact sum(U-S), hot-to-cold exchange, source
booking and actual physical-time continuation. Same-device comparison uses
the full-width exchanged U-S increments before f32 projection: declared
relative transfer error <= 1e-3 plus eight relative f32 epsilons; observed
maximum 1.2588936e-5. Total-state energy/temperature bounds also pass.

The first interval supplies real GPU misses; its completed fit binds the
actual interval delta. A real StateManager accepts after the fixture observes
the actual device queue. The next two intervals each record two fit hits.
Eighty state/thermo/energy words remain bit-identical across fitting/adoption.
A deliberately reversed proof input still conserves total U-S but fails the
direction and transfer-accuracy checks. Original physical owners retire before
continuation. Interval/identity observations read fixed 128/16-byte proofs;
candidate completion uses the existing fixed 32-byte receipt.

Final native run `native-g.log`: 18 intervals PASS, zero GPU errors. Host suite:
621 pass, three opt-in skips, zero failures. Build and diff checks pass.
Earlier attempts remain: missing fixture completion receipt, wrong wall enum,
and noncontact wall inputs. Increasing the obsolete wall-rate scalar could
not create contact; placing the manufactured parcels within their actual
edge distance fixes the input. No wall law, tolerance or guard was changed.

This closes the bounded same-level physical conservation/adoption checkpoint.
It does not prove two-level numerical integration, production worker or
ComputeManager acknowledgement, G4 uncertainty-aware activation, all potential
identities, Eshkol provenance, latency/resource benefit or mounted evolution.
G6 stays open at its original scope; only G5/G7 are accepted.
Evidence: `~/.cache/icc/repos/ulg/g6-thermal-interval-20261119/`.

## GPU caloric fit reaches the canonical spatial consumer — 2026-11-19 UTC

`thermalPotentialGpu.js` now derives a bounded degree-seven entropy chart on
GPU from one affine, positive-capacity liquid branch of the retained thermal
graph. The energy coordinate and original type-2 phase selection are preserved.
The source-fixed entropy reference is the graph's lower-temperature endpoint;
fit-centred normalization carries an explicit gauge offset. This is a caloric
Helmholtz slice at fixed phase/composition/mechanical coordinates, not a pressure
EOS replacement or scientific validation of the material source.

The opt-in canonical thermal prepass consumes its temperature and slope. GPU
misses request a replacement in separate buffers. A private candidate binds its
original source, parent generation and G5 reservation. Completion requires its
actual submission and a fixed-size GPU validation receipt. Only the existing
resident commit bridge can associate that candidate with an accepted delta;
old consumers retain their original generation. Failed fits retain old records,
miss envelopes clear after each job, and revoked parents cannot be copied into
newly admitted generations. Partial allocation and callback failure cleanup,
re-entrant retirement, cancellation, single-flight completion and three bounded
reservation slots are covered by control tests.

Predeclared numerical limits: eight terms, 65 held-out points including faces,
|normalised energy| <= 0.25, twice-observed relative temperature error <= 1e-4,
slope error <= 1e-3, and dimensionless entropy error <= 2e-6. These are empirical
held-out bounds. Consumer points also require positive temperature/slope. The
first raw-log fit failed at about 1.6% slope error; fitting the stable nonlinear
residual plus its exact affine part passes without changing these limits.

Verification: 84 focused host checks pass; the final native cycle passes with
zero GPU errors. It rejects an invalid envelope, obtains fresh misses from the
actual directory-v2 spatial consumer, fits on GPU, adopts through a real
StateManager using a manufactured commit receipt, and obtains two hits in a
subsequent spatial generation. An old retained generation remains unchanged.
The direct numerical test has 65 in-domain probes plus phase/domain refusals.
Independent review reran all ten ownership tests and approved the exact source.
Build passes. Evidence: `~/.cache/icc/repos/ulg/g6-thermal-potential-20261119/`.

**G6 remains open.** This is opt-in prepass integration, not the default worker
or a complete physical interval. G4 dormancy is conservatively disabled for
this candidate route until approximation uncertainty participates in its bounds.
Remaining: actual worker/StateManager acknowledgement wiring, full thermal and
exact-energy conservation across adoption, potential-value/thermodynamic
identity evidence, original Eshkol backend pin, resource/latency measurements,
and mounted surface/sphere evolution. Only G5/G7 remain accepted.


## Host repair verified — 2026-11-19 UTC; original GPU integration remains

The four reproduced defects below are repaired, along with overlapping
training/held-out sample points and incomplete identity/unit invalidation.
Fit degree, sample count and cache size have finite integer bounds; residual
safety factors and derivative steps are validated. Nonfinite samples/bounds
reject. Requested domains are normalized and frozen before keying or sampling,
and fit options cannot replace the source, regime or domain. Pending/live fits
are checked against identity, units, regime and source fingerprint.

The first eight nonphysical-polynomial regressions fail against the original
source and pass on the repair. Independent review then found mutable caloric
inputs, ignored/re-entrantly revoked reservation commits, and consumed keys
stranded by eviction. These are repaired: the caloric source owns a frozen
canonical-data snapshot and evaluator-source binding; unsupported shared/lossy
representations reject. Reservations remain fenced through adoption/use and
release only their owned epochs on eviction, invalidation or cache destruction.
The original seven G6 checks, fourteen new regressions and eight A4 fit/table/
stiffness compatibility checks pass (29 total).

**This does not complete G6.** Independent review confirmed that the original
S0–S2 plan expressly includes GPU-detected envelope exit, one real SS consumer,
bounded local derivation, conservative replacement adoption, cache reuse,
resource/latency measurements and mounted visual evidence. The former note
below assigning the resident consumer to A3/A4 was an unsupported scope
reduction. The earlier approximately 95% estimate overstated readiness.
Host-only tests cannot satisfy those integration requirements. They remain
explicitly pending; only G5/G7 are accepted across the campaign.
Artifacts: `~/.cache/icc/repos/ulg/g6-validation-20261119/`.

## Acceptance review — 2026-11-19 UTC: still open

Direct review reproduced four admission/provenance defects using a nonphysical
polynomial generator (no CPU physics reference or solver):

- `heldOutCount: 0` admits a degree-one fit with a claimed zero error bound,
  despite a 0.25 error at the origin.
- `safetyFactor: 0` admits a zero bound despite a measured residual of 0.7345.
- `derivativeRelativeStep: 0` admits a nonfinite derivative bound.
- `fitOptions.domain` overrides the requested domain after its cache key has
  been calculated. A request for [-1, 1] returns a [10, 11] fit with a different
  key, stored under the requested key.

These require bounded input validation and immutable binding of the requested
source/regime/domain before G6 acceptance. The existing seven passing tests do
not cover them. Reproduction output is retained at
`~/.cache/icc/repos/ulg/air-chain-cross-transport-20261119/g6-review-reproductions.json`.
Runtime source was not changed during this review; the cross-level GPU workload
remained the only active GPU job. G6 remains open at its original scope.

Date: 2026-11-14. Task: ICC `ulg-g6-local-fit`. Oracle: `ulg-g6-local-fit`.
Plan lineage: [eshkol-higher-order-law-closure-plan.md](eshkol-higher-order-law-closure-plan.md),
S2.

## Delivered: `src/runtime/material/localClosureFitCache.js`

**Generator.** An exact closure x → f(x) with declared input and output units
and a source fingerprint. `caloricClosureGenerator` wraps thermoState
`specificInternalEnergyJPerKg(properties, T)` for one material; its
fingerprint is the SHA-256 of the properties.

**`fitLocalClosure`.**
- Samples the generator at Chebyshev nodes on a declared domain and builds
  the interpolant.
- Measures held-out value and derivative residuals at 257 interior points it
  never trained on.
- The admitted bound is the held-out maximum × a safety factor (2), labelled
  `held-out-empirical`.
- A fit over its value tolerance is refused (`LOCAL_CLOSURE_FIT_RESIDUAL`).

**Fit record.**
- Units, `regimeKey`, the domain, the schema and ABI version.
- Provenance: generator id, source fingerprint, sampling and held-out design,
  basis, degree, derive time.
- Coefficients and residuals.

**Cache key.** SHA-256 over regime, domain, units, generator source, ABI and
schema. Any change is a miss, never a stale hit.

**`evaluateLocalClosureFit`.** Strictly in-domain; it never extrapolates.

**`createLocalClosureFitCache`.**
- **Adoption is schedule-bound.** A derived or hit fit stays `pending` until
  `scheduleBoundary()`, and every event logs its schedule ordinal.
- **Domain exit invalidates.** The first out-of-domain evaluation records an
  envelope exit, and the live fit is unusable until a refit is adopted.
- **Policies:**
  - `async-exact-fallback` evaluates the exact generator meanwhile, counted
    as debt (evaluations and maximum out-of-domain distance);
  - `strict` refuses.
- **Source change invalidates.** `sourceChanged` drops entries of the old
  fingerprint and the live fit. A pending fit from a stale source is
  rejected at the boundary.
- **Derive jobs are single-flight** through the G5 `ReservationLedger`.

## Evidence: `tests/localClosureFitCache.test.mjs`, 7 of 7 pass

| Test | Result |
| --- | --- |
| Solid Fe u(T), 300–1000 K, degree 12 | held-out relative value residual 1.3e-8, relative derivative residual 9.7e-7. A degree-2 fit, at about 1%, is refused at a 1 J/kg tolerance. 1,000 fresh points stay within the admitted bound |
| Crossing H2O's 273.15 K melting plateau | refused (a discontinuity) |
| Cache keys | change with regime, domain and source fingerprint |
| Adoption | pending until the boundary; envelope exit invalidates; a refit is adopted at the next boundary; exact-fallback debt = 5 evaluations, maximum distance 5 K; log ordinals [0, 1, 1, 1, 2] |
| Strict policy | refuses rather than extrapolates |
| Cache reuse | a second compatible request hits; a source change drops the entry and the live fit; a stale pending fit is rejected |
| Single flight | two caches share one ledger; the second requester derives nothing |

## Original S0–S2 requirements still open

- This cache path is host-side. G6 still requires the original plan's GPU
  envelope/derive/adoption cycle connected to a real SS consumer and mounted
  evidence. Existing A3 GPU sampler and A4 evaluator are reusable foundations,
  not proof that the integrated G6 path exists.
- Integrate G4 activation and G5 reservation interfaces without a second
  scheduler, host physics fallback, hot payload readback or per-step host fence.
- Verify invalidation for source/domain/ABI/evidence changes, cross-region cache
  reuse, conservative adoption/reconciliation, cancellation and bounded lifetime.
- Record fit/evaluation/lookup cost, memory and dispatch/submit counts, advancing
  simulation and original mounted WebGPU surface/sphere acceptance.
- The bound is empirical (held-out), not a proven remainder bound.
