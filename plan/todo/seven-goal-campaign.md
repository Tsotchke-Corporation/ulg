# ULG Seven Goals and Follow-on Architecture Campaign

> **2026-11-22 Live-Code & Oracle Audit (`23a961c4`):** Formal receipt check of
> `/home/cos/.cache/icc/repos/ulg/` confirms **ONLY G5 and G7 are formally
> accepted (`2/13`)**. All other 11 milestones remain `in_progress` with
> line-exact live-code gaps documented in [`plan/CURRENT-PLAN.md`](../CURRENT-PLAN.md)
> Sections 4–6 and [`.icc/assistant-goals.yaml`](../../.icc/assistant-goals.yaml).

## User decision — architecture-first re-sequencing & guardrail reset — 2026-11-19 AKST

On 2026-11-19, after checkpointing the Oct 27–Nov 19 worktree locally (`31fb694`)
and branching `feat/ulg-ga-consolidation`, the user approved a clean reset of
execution order and workflow constraints, consolidated into
[`plan/CURRENT-PLAN.md`](../CURRENT-PLAN.md):

- **Architecture-first order:** Phase 1 builds the A1 substrate floor (decoupled
  presentation, parallel Jacobi contact + thermal decoupling, fused K-step GPU
  epoch slots), fixes the N-level SS chain bottleneck (including eliminating the
  216-indirect-dispatch cross-transport loop), and closes the live Eshkol / A3 /
  A4 / G6 closure loop ON by default. Phase 2 lands G2, G3/A5, G4, and A6
  directly onto that single canonical lane. Phase 3 reassesses G1.
- **Local commits & legacy retirement:** Local commits per verified vertical
  slice on feature branches are authorized (push, merge to `main`, and Pages
  builds remain held). Retiring/deleting superseded legacy code routes, dead
  shaders, duplicate contact impulses, and production CPU test mirrors is
  authorized once GPU replacements pass invariants (physical laws stay intact).
- **Boundary discipline & performance gate:** Keep PeerCompute admission strict
  at schedule/peer boundaries; drop intra-worker anti-forgery ceremony and
  574-file manual hash manifests. Enforce a hard per-step submit /
  indirect-dispatch / ms budget gate on every new SS and closure slice.
- **Runtime contracts & G1 rule:** G1 acceptance updates from
  `presented_steps == physics_steps` to **latest committed physics state
  presented at `>=54 Hz`** across all six presets with full optics/controls.
  GPU-advanced multi-step SS epoch slots (or bounded A2 validity) are permitted
  for K-step batching. Thermal conduction is decoupled from contact pass-cap
  exhaustion. Remaining mega-oracles split into lockable vertical slices that
  turn ON by default once GPU invariants pass.
- **Parked physics defaults:** General bank-anchored product closures (with
  explicit `imported` provenance) are approved for FeO/missing-oxide
  overheating; `environmentAirParcels=mixture` becomes default once visual and
  conservation checks pass.
- **Preserved:** G5 and G7 remain accepted; all historical G1–G7/A1–A6 failure
  records and audit evidence below remain intact.

## User decision — real time moves to A1; dt 1 ms allowed — 2026-11-13

After the [2026-11-03 audit](../done/audits/2026-11-03audit.md), the user said: "actually we
should defer architecural work until we reach the correct phase. and at least
finish out this goal first". When asked where the near-real-time requirement
should live, the user answered: "yes move it to A1, allow dt 1 ms".

- **G2 acceptance no longer requires near-real-time plume runs.** That
  requirement came from the 2026-10-27 Q4 answer in
  `g2-integer-ledger-proposal.md`, and it now belongs to A1.
- **G2's plume evidence may run at dt = 1 ms** (`sdt=0.001`), as sodium–water
  already does. Longer recordings were not approved, so the existing milestone
  cap still applies.
  - **Caveat, measured 2026-11-13 after the approval:** dt 1 ms changes Iron
    Ice's evolution. The app caps sound speed by dt, so moduli are 4× softer.
  - At the same 0.832 s, the two dt values give visibly different scenes. See
    Step 0 in the audit doc.
  - **Confirmed by the user, 2026-11-13:** "stay on 1ms to speed up testing".
    Test and evidence runs pass `sdt=0.001`; the preset default stays 0.5 ms.
- **The audit's architecture steps are deferred to A1 and G4,** in campaign
  order:
  - decoupling physics from presentation;
  - multi-step fusion;
  - the law descriptor;
  - selective contact;
  - the steps/s gate.
- **G2 keeps the audit items that block G2 itself:**
  - the Step 0 baseline and rollback check;
  - wiring vapor exchange's caloric authority;
  - one energy definition (Cp vs Cv);
  - integer ledgers, Phase 1 onward;
  - the reactions that cannot fire (the humid-air step-1 failure, and
    physical-energy reactions limited to undeformed carriers).
- **Design rule for new G2 code:** add no per-step host fences or readbacks,
  and keep counters on the GPU, so A1's later fusion work does not grow.
- **Unchanged:** G1 stays deferred, G3–G7 have not started, and the hold on
  push, merge and Pages stands.

## G2 checkpoint — physical reaction staging and exact event companions — 2026-10-25 UTC

The actual reaction runner now stages physical endpoints and product events
from retained exact routes, and compacts events with their exact integer
companions. Required projection failure restores both endpoints and clears
pair events; exact mass controls event activity. Buffer-identity guards prevent
speculative aliases from entering legacy consumers. The result still grants no
placement, history, closure or SS publication authority.

Final native verification passes 414 rational projections, 72 compaction cases
and 15 genuine reaction chains, including complete product-volume underflow
rollback. All 662 frozen paths matched during that run; the owned browser closed.
Post-native review then caught and fixed a mutable history-handle alias hole:
host copy/append now retains and rechecks admitted buffer identities. Only the
host merge and CPU tests changed afterward; native numerical/physical code is
unchanged. Final regression passes 5,566 tests with 78 opt-in skips; 357 focused/
compatibility tests pass with 3 skips, and normal build passes. Original negative-
zero and alias reproductions, rejected fixture constructions and one console404
are preserved in the [current handoff](../handoff-2026-10-24.md).

Next: carry current exact receiver and incoming quantities through the existing
segmented placement and terminal rollback selector, then genuine durable
history/closure/SS publication and repeated evolution. Chemical discrepancy
accounting and species-specific product energy remain physical-admission work.
Full G2 phase/environment/UI/nuclei/transport/plume scope remains; G2 stays at
3/6 original child items, G3–G6 pending, G1 deferred. Local commits only; no
push, merge or Pages build.

## G2 checkpoint — retained reaction packet routing — 2026-10-25 UTC

The actual reaction runner now consumes independently retained exact packets
and prepares integer endpoint/residual routes. Exact zero controls vacancy;
physical row order, condensed-product priority and single-product splitting
are verified. Quantity bases survive source-owner close and child compilation;
device loss retires without granting publication. The result is a distinct
candidate, with physical S/T/M writes, placement/history and closure adoption
still unadmitted.

Fourteen genuine native routing chains pass at 1/9/66 words, alongside the
previous 999 arithmetic cases and twelve source chains. All 654 frozen paths
match; original failed harness module-alias runs are retained. Full regression
passes 5,520 tests (78 opt-in skips), focused tests and normal build pass.
See the [current handoff](../handoff-2026-10-24.md) for evidence and scope.

Next: couple exact routes to physical endpoint/event writes, compaction and
terminal placement rollback, then genuine history/closure/SS publication and
current exact quantities through repeated evolution. G2 stays at 3/6 original
child items; G3–G6 pending and G1 deferred. All original plume requirements and
the push/merge/Pages hold remain.

## G2 checkpoint — exact product energy and species preparation — 2026-10-25 UTC

The genuine source pipeline now retains the rounded-COM kinetic correction,
physical energy residual and product total energy, plus actual selected and
surviving moles/entities, signed element/charge residuals and original rational
volume bases. Its metadata is bound to original sealed tables; checked widths
and capacity limits reject rather than truncate. Numeric readiness grants no
physical ownership or chemical admission.

Final native verification passes 999 arithmetic cases and twelve genuine source
chains; all 650 frozen paths match. The earlier completed run exposed loop-local
carryover in product survivors and element residuals; explicit initialization
fixes it with unchanged numerical checks. Full regression passes 5,503 tests
(77 opt-in skips), focused tests pass and the normal external build passes.
Failures, one console404, independent reviews and exact evidence are retained
in the [current handoff](../handoff-2026-10-24.md).

Next is actual carrier/history ownership through placement, rollback, compaction
and closure/SS publication, preserving each rational basis across repeated
evolution. Full G2 phase/environment/nuclei/transport/plume requirements remain.
G2 stays active at 3/6 original child items; G3–G6 pending, G1 deferred. Local
commits only; push, merge and Pages build remain held.

## G2 checkpoint — exact rational caloric preparation — 2026-10-25 UTC

The genuine mechanics/thermal/discovery source owner now compares exact
selected product masses through the shared caloric graph, retaining formation
energy's denominator and nonzero endpoint remainders. Native verification
passes 240 caloric, 393 extensive and 174 kinetic-cap cases plus twelve source
chains, including accepted relaxed motion and rejected affine/deformed sources.
Full regression passes 5,472 tests (77 opt-in skips); normal build passes.
Physical publication is still false. Durable carrier/history ownership,
rounded-velocity energy correction, actual executed element/charge accounting,
entities/volume and the full remaining plume scope are next. See the
[current handoff](../handoff-2026-10-24.md) for exact evidence and preserved
failures. G2 stays active at 3/6 original child items; G3–G6 pending, G1 deferred.
Local commits are authorized; push, merge and Pages build remain held.

## G2 input decision accepted — 2026-09-14 UTC

The operator approved documented room air and background condensation nuclei
for the visible-steam demos. The question is answered; older "unresolved" notes
are historical. Use the [accepted environment specification](phase-resolved-steam-optics-plan.md#accepted-environment-decision--2026-09-14-utc):
explicit conserved air/humidity/seed inputs through the shared pipeline, with a
same-air aerosol-free comparison. Preserve cesium–fluorine and the two vacuum
water benchmarks. Quantitative nuclei selection and runtime enrollment remain
implementation work, not another approval gate. This is a decision update, not
new live plume evidence. G2 stays active, G1 failed/deferred, publication held.

## G2 checkpoint — actual shared GPU heat writes — 2026-09-14 UTC

The existing actual-EOS candidate writer now handles shared heat-only gas/
liquid-parcel graphs with distinct caloric species, exact signed packet sums
and independently checked stored energy changes. No new CPU reference or
source-authority branch. This is not kinetic growth, interval adoption, full
resident precision, transported plumes or live preset enrollment.

Final104 focusedPASS;29 exchange/5 current-source native GPU casesPASS;
full5,151PASS/75SKIP/0FAIL; buildPASS. All six configured presets advance in
serial real-desktop checks. Root reviewed12 original first/last PNGs; correct
isosurface/particle modes are distinguished. Material fidelity and identified
plumes remain unaccepted. All failed harness runs and unchanged retries remain.
[Verification and remaining G2 scope](/home/cos/.cache/icc/repos/ulg/g2-gpu-mixture-heat-20260914-GZFNcx/verification.md).

The cost-sensitive checkpoint adds one missing GPU operation without narrowing
success or spawning a research swarm. Next:coupled physical growth and complete
inventory/interval integration, then transport/deposition and actual lineage.
G1 failed/deferred; G2 active,3/6 child items; G3–G7/A1–A6 pending. Publication held.

## G2 checkpoint — finite-time conserved reference — 2026-09-14 UTC

An isolated near-equilibrium cell now evolves shared vapor, multiple existing
liquid parcels and distinct inert-gas temperatures with exact extensive mass/
energy packets, species pressure work and surface energy. Adaptive whole-cell
steps reject invalid trials and retain explicit unprocessed time. This is real
reference evolution, not a live GPU plume or calibrated all-Kn transport law.
It does not authorize merging unequal-temperature vapor rows or inventing nuclei.

Final focused202PASS; full5,142PASS/75opt-inSKIP/0FAIL; buildPASS. Independent
review's boundary-T bug is fixed and regression tested. Previous647 runtime
inputs remain unchanged; final freeze651. No fresh GPU/browser outcome is claimed.
FullG2 resident integration, precision, transport/deposition and preset plume
lineage remain required. G1 failed/deferred; G2 active; G3–G7/A1–A6 pending.
Publication stays held. The operator's token-cost concern prompted a bounded
verification checkpoint, not permission to shrink the seven-goal objective.
[Evidence and remaining scope](/home/cos/.cache/icc/repos/ulg/g2-finite-cell-20260914-UIF2uy/verification.md).

## G2 checkpoint — genuine current gas source — 2026-09-14 UTC

The opt-in completed closure now supplies its actual thermal/reaction/phase/
refresh outputs and complete merged history to a real new classifier, private
SS generation and gas EOS. Existing aerosol reads survive that connection and
reach the conservative candidate writer. Producer identity, latest-consumer
fences and failed-build recovery are tested; no copied assignment or public
successor label supplies authority. Ordinary capture-disabled execution is
preserved. This is current-state integration, not a kinetic law or live plume.

Full regression passes 4,968 tests with 75 opt-in skips; normal build passes.
Five new real-GPU integration cases and the existing 15 exchange, ten caloric
and seven paired-publication cases pass. Retain the initial navigation/fetch
failures and the fixture's duplicate Vite-module-identity failure; only the
fixture import path changed after the full run, not production code or gates.
Cesium/iron/sodium advance 15/18/9 committed sources over 45.582/45.506/45.564
wall seconds; all nine original images reviewed after owned-browser closure.
No preview lockup, identified transported plume, material-fidelity or 54 Hz
acceptance is inferred. Water remains dark/faceted. No all-six claim.

Next: physical coupled vapor/mixture heat exchange, its mass-precision regime
and matched-interval adoption, then transport/deposition and actual preset
lineage. Explicit gas-only/ice models and environment/nuclei inputs remain
unresolved; no default atmosphere, droplet population or extra latent energy
was invented. G1 failed/deferred; G2 active; publication held.
[Verification and remaining scope](/home/cos/.cache/icc/repos/ulg/g2-current-gas-20260914-S9V6FQ/verification.md).

## G2 current-stage integration correction — 2026-09-14 UTC

The live-source audit confirms that no default preset enrolls the explicit
condensable/caloric models yet. Prior conservative transfer tests are real GPU
tests with manufactured inputs, not live plume growth. The next priority is the
actual post-thermal/reaction/transfer/refresh tuple and complete merged history,
with freshly matched private SS/EOS and one terminal publication. Pre-P2G gas
data and injected stage outputs cannot authorize that exchange.

A concrete shared-wiring bug is fixed: reaction, phase-transfer and mechanics
options no longer replace the closure-owned source buffers, tables, interval
or output contract. Thermal already used this precedence. Tuning and diagnostic
options still work. The three regression failures now pass; all35 focused
closure tests pass. No new growth capability or preset enrollment is claimed.

Full regression passes4,940 tests with74 opt-in skips; normal build passes.
Current cesium/iron/sodium desktop runs pass basic progression over45-second
wall windows; all nine originals reviewed after browser closure. Preserve
iron-v1 exit143/no terminal receipt and sodium-v1 initial connection failure;
unchanged retries pass. No plume, material/refraction or54Hz acceptance follows.
[Verification and limitations](/home/cos/.cache/icc/repos/ulg/g2-stage-inputs-20260914-thwXoQ/verification.md).
Physical mixture heat exchange, mass precision at droplet scales,
gas-only/ice model enrollment and the explicit environment/nuclei input remain
unresolved. G1 stays failed/deferred; G2 active; publication held.
[Integration audit and bounded next step](/home/cos/.cache/icc/repos/ulg/g2-stage-inputs-20260914-thwXoQ/integration-audit.md).

## Latest G2 checkpoint — conservative vapor/aerosol writer — 2026-09-14 UTC

The exact paired caloric EOS now owns a real GPU mass/momentum/energy candidate
writer for prescribed transfers to/from existing liquid parcels. It preserves
physical population and residual-only product inventory, separately accounts
for surface internal energy, and leaves pressure refresh explicit. No kinetic
rate, physical interval, live publication or preset enrollment is authorized.

Native testing caught and fixed a real tiny-transfer false READY. Finalization
now checks stored endpoints, exact representable mass exchange and stored energy,
not just proposal arithmetic. Both owners have an explicit factor-two mass-change
domain; no rate clipping or relaxed conservation budget. All15 manufactured
native cases pass, as do three prior native commands, full regressions
(4,936 PASS/74 opt-in SKIP/0 FAIL) and the normal Vite build. Failed runs remain.

Fresh cesium, iron/ice and sodium/water desktop runs pass basic progression over
45.542/45.537/45.112 wall seconds. All nine original images were reviewed after
owned Chrome closure; all640 frozen hashes match. No identified transported
plume, material/refraction fidelity, all-six or54Hz acceptance is claimed.

Next: real coupled growth/heat rates and matched-stage publication, then gas-
following transport and deposition. No invented nuclei or extra latent energy.
G1 stays failed/deferred; G2 active; G3–G7/A1–A6 pending; publication stays held.
[Current evidence and remaining work](/home/cos/.cache/icc/repos/ulg/g2-vapor-aerosol-exchange-20260914-n6amVx/implementation-review.md).

## Latest G2 checkpoint — caloric inputs in the shared EOS — 2026-09-14 UTC

Exact published particle/product pairing now reaches the retained single-level
gas EOS through independently held consumer leases. The optional existing-cell
aggregate authenticates model U(T), Cv and molar mass for every gas member and
derives energy-weighted mixture temperature. Unknown, inconsistent, truncated or
unpaired physical inputs reject; legacy pressure is preserved. Native checks
confirm independent species-reference invariance, unchanged source bytes, final
owner retirement, no initial default allocation and two material-general kernel
variants. This is integrated caloric input admission, not a phase-exchange writer,
preset enrollment, real reaction validation or a transported plume.

576 focused tests (5 opt-in skips), the separate final 32-test source-family run,
4,824 full-suite tests (73 opt-in skips), build and 47 serialized native Node
results pass. Preserve the initial reentrancy red/full-run failure and two
native fixture corrections; runtime gates and numerical tolerances were not
relaxed. A later full-v3 run reports all tests passing but launcher exit143;
that discrepancy is retained, not counted as a clean command pass.
Desktop iron/ice and sodium/water advance 17 and 8 committed sources
over 45.565 and 45.570 wall seconds. Root reviewed all six originals after owned
browser closure: actual changing geometry, no browser error or preview-only
scene. Material fidelity, refraction, 54 Hz and identified plumes are not accepted.
All 633 frozen source hashes match. HTTPS Vite remains available on the tailnet.

Next is conservative, matched-interval vapor/energy exchange into the existing
paired aerosol owner, then growth/evaporation, gas-following transport and
deposition. No invented nuclei, mixed-phase plateau or latent-energy bonus.
Cold/private-fine/cross-level history admission and explicit gas-only H2/ice
domains remain open. G1 stays failed/deferred; G2 active; G3–G7 and A1–A6 pending.
Publication remains on hold.
[Slice evidence and next work](/home/cos/.cache/icc/repos/ulg/g2-mixture-caloric-20260914-bhikZw/implementation-review.md).

## Latest G2 checkpoint — paired sources and gas inventory — 2026-09-14 UTC

The existing SS gas aggregate now conservatively counts residual m/U/n/nT with
raw signed source energy, temperature and phase. Exact carrier/product-history
pairing and one-time single-level history merge are implemented; physical
caloric/interval authority and the new paired-read helper's EOS integration
are still next. This is not an activated or transported plume.

Final 395 focused and 4,772 full-suite tests pass (4/72 opt-in skips); build
passes. Sequential real-desktop GPU commands pass 46 Node tests, including seven
new mixture cases and seven paired-publication cases. Preserve the initial
outer-test certificate-verifier error before GPU setup; the unchanged repeat
passed without disabling certificate checks. Independent review's three
integration findings are resolved. All original scoped guards are retained.

Configured iron/ice and sodium/water desktop checks pass basic committed-source
progression over 45.590/45.562 wall seconds; root inspected all six originals
after owned browser closure. All 628 frozen source hashes match. No identified
plume, material/refraction fidelity or 54 Hz acceptance follows. HTTPS Vite
remains on the tailnet. G1 stays failed/deferred; G2 stays active, G3–G7 and
A1–A6 pending. No commit, push, merge or Pages publication is authorized.
[Slice evidence and next work](/home/cos/.cache/icc/repos/ulg/g2-ss-gas-mixture-20260914-UO6ZxT/implementation-review.md).

## User reprioritization — G1 failed acceptance; G2 next — 2026-09-13 AKDT

The user ends the current G1 performance effort as **FAILED acceptance** and
defers remaining work until the architectural follow-ons. Preserve improvements
and failed evidence; do not claim the all-preset54Hz target was met, impossible,
or relaxed. ICC uses `skipped` for the execution disposition because its plan
statuses have no `failed`; acceptance remains FAIL. A skipped item is not a
delivered milestone, even if a generic ICC closed-item count includes it.

The requested HTTPS and cesium basic-functionality checks now pass. The service
at `https://fastbox.tail5c077c.ts.net:5173/` returns 200 with valid TLS. Current
v5 preserves the four-child recovery first; only a fully retired, authenticated
physical failure permits one whole-root restart with eight fresh children.
No failed prefix is reused, physical gate relaxed, or preset branch introduced.
All 593 focused tests pass; full suite passes 4,335 with 62 opt-in skips and
no failures, and build passes. The actual desktop run advances 16 committed
sources from 15 to 255, through 45.227 wall-clock seconds after the first source,
without a terminal stop or browser error. Root inspected all three originals:
actual isosurface geometry changes, including a spreading lower surface, rather
than control-body previews. Both 574-path source checks and owned-browser
cleanup pass. This is bounded functionality, not long-horizon scientific,
material-fidelity or 54 Hz acceptance.
[Current desktop evidence](/home/cos/.cache/icc/repos/ulg/cesium-usability-20260913-O5rEHT/desktop-v5/probe.json).

Preserve the rejected fixed-eight-first proposal: its 581 focused tests passed,
but the real desktop run stopped after source 15 at private child 5. Root
inspected both original images; source checks and cleanup passed, not usability.
[Failed candidate evidence](/home/cos/.cache/icc/repos/ulg/cesium-usability-20260913-O5rEHT/desktop-v4/probe.json).

The earlier v3 pixel decoder24997 completed: water70.8024, iron55.1651,
sodium76.8349, bulk97.4584 and dam96.6471 observed scene changes/s. These short
sampled windows do not prove sustained54Hz or all-six optics/controls; Cs stopped.
The later tick34 input capture includes the retained-product GPU count record
(zero live rows, not capacity as count). Its fresh native baseline reproduces
the original rejection exactly. Eight smaller full r2 intervals pass unchanged
physical gates over the same0.0005 interval, with independent payload/header
and ownership review. The subsequent live failure above limits that result:
it is not a general stability remedy or a visual-throughput breakthrough.
[Bounded native result](/home/cos/.cache/icc/repos/ulg/task72-production-interval-20260910-vHr98p/tick34-replay-20260913-VFjY2o/eight-run/probe.json).

Delivery sequence is G2–G7, then dependency-led A1–A6 and G1 reassessment.
G2 is active. Its first diagnostic slice now implements opt-in species partial
pressure and explicitly reduced saturation on existing SS-owned gas cells. The
62-case manufactured GPU run passes 44 tests; the actual retained EOS/pressure
consumer native run also passes, including 65,536 sparse rows. Diagnostics leave
physical inputs unchanged, distinguish mixed/fallback temperatures, and retain
private ownership with bounded 128-byte observations. Disabled mode adds no
diagnostic allocation, dispatch or readback. Full regressions pass4,342 tests
with63 opt-in skips and no failures; build passes. Original-baseline scoped
guards pass for owner, shader, host helper and plan edits.

G2's next prerequisite now adds independently owned initial aerosol inventory,
exact u64 physical droplet multiplicity and GPU-derived radius. The existing
resident summary can account for both carrier and aerosol source/terminal
mass, phase, momentum, internal energy and translational kinetic energy; default
mode adds no GPU work. This energy scope excludes constitutive/APIC/surface and
field energy. Native kernel checks pass54 tests over49 cases; the actual
desktop-GPU resident-summary test also passes. 37 focused tests pass. Queue
failure quarantine and carrier-only metric scopes were independently reviewed.
Preserve the two final-candidate harness failures and corrections; neither
changed runtime numerical acceptance or relaxed ownership.
The final combined native run passes55 tests; full regressions pass4,379 with
65 opt-in skips and build passes. Preserve the first full run's single unchanged
process-timeout-test failure and its successful unchanged isolated/full repeats.
All three original-baseline scoped guards pass; no broader release gate is waived.

Conservative pre-transfer extraction now exists as a genuine isolated GPU
debit and one-shot paired residual-carrier/aerosol owner. It retains the original
airborne position, shares exact pressure-adjusted energy endpoints with the
existing phase transfer, and requires explicit already-activated physical N.
Its reduced energy regime rejects affine/shear/surface contributions it cannot
own. Actual SS source binding, same-source replay protection and confirmed-loss
cleanup cover both halves. 92 focused tests pass; the final serialized desktop
native run passes80 (24 new extraction cases plus parent,55 aerosol regressions).
The input remains byte unchanged; real phase transfer and combined inventory
prove mass/phase/momentum/first-moment and U+translational-KE conservation.
Preserve the earlier22-pass native run and the two subsequent owner review fixes.

Next integrate outer SS successor adoption and optical accounting before
enabling presets; local occupied volume is now implemented below. Optics must distinguish pre-extraction
reaction output from residual transfer input; newly condensed extraction must
not blindly debit the older optical subset. Then implement admitted activation,
general energy partition, gas coupling and deposition. An isolated extraction
pair is not a transported plume or a completed G2 goal.
Full regression passes4,413 with66 opt-in skips and no failures; build passes.
All three original fixed-baseline guards pass, preserving the existing
nonblocking helper-relocation notices. No publication hold is lifted.
Iron/ice and identified sodium/water plume acceptance remain open. Milestones
remain unaccepted; no publication hold is lifted.
[Diagnostic slice evidence](/home/cos/.cache/icc/repos/ulg/g2-species-saturation-20260913-25W0TJ/).
[Initial aerosol authority evidence](/home/cos/.cache/icc/repos/ulg/g2-aerosol-authority-20260913-S1KBx8/).
[Conservative extraction evidence](/home/cos/.cache/icc/repos/ulg/g2-condensate-extraction-20260914-exWZA0/).

The preceding local-occupancy G2 slice bound existing aerosol identity/absence to actual SS
transactions, retains the source through its consumer window and preserves it
through ordinary continuation. A generic optional scatter adds m/rho locally
through B/A/W to the actual gas EOS denominator with exact family/generation
and completion checks. Absent aerosol adds no GPU work. Outer paired publication,
successor/lane ownership, optical accounting, activation/growth and transport
remain open; no preset enables the isolated extraction API yet.
512 focused checks,26 manufactured native cases,115 serialized native/regression
checks and the full4,445-test suite pass (67 opt-in skips); build passes.
Preserve all three native fixture failures/corrections without relaxing runtime
gates or positive numerical tolerances. Desktop iron/ice passes basic progression;
sodium/water passes on an unchanged repeat after one retained startup GPU queue
OperationError. That intermittent failure is unresolved. Original image review
confirms changing geometry, not plume lineage, material fidelity or54Hz.
G1 remains failed/deferred, G2 remains active, and publication remains on hold.
[Current local-volume and desktop evidence](/home/cos/.cache/icc/repos/ulg/g2-resident-aerosol-20260914-2SQ7WB/implementation-review.md).

The current outer-publication slice connects a pending extracted population to
the actual shared post-mechanics closure, real phase transfer/refresh, full
successor classifier and paired outer publication. Commit alone cannot expose
the prospective aerosol owner. Exact next-generation leases, shared lane
ownership, immediate rejection and queue-fenced source reuse are covered. The
native test passes all three cases, including independent conserved totals and
unchanged source bytes; the116 prior native/regression checks also pass.
Preserve its first native failure: rejection originally started the lower-owner
cleanup fence only after classifier cleanup. Runtime now schedules pending
abandonment immediately; the native assertions and tolerances are unchanged.

At that checkpoint, reaction-mutated state/thermo plus requested extraction rejected
before extraction allocation or source reservation. Existing lineage-wide
reaction optical credit can double count an extracted donor; separate stage
buffers alone do not solve this. Donor-resolved accounting and physical
activation/energy exchange are next, followed by gas-coupled transport and
deposition. No preset enables the new extracted population yet, and neither
declared physical multiplicity nor manufactured thermal input is a nucleation
law or a full-physics proof.

The final iron/ice and sodium/water desktop runs pass basic progression over
45.582 and45.080 wall seconds; all six originals were reviewed after owned
Chrome closure. No clear source-traced plume or material/54Hz acceptance is
claimed. The preceding sodium startup failure remains an unresolved intermittent
concern. Final full suite4495PASS68opt-inSKIP0FAIL (159.508s) and buildPASS
(2.04s). Preserve the initial incomplete exit143 run and second full run's two
thermal import-order failures. Cached lazy default stage loading fixes the
cycle without changing private authentication or generalized kernels;105
focused checks include the failing files and five fresh-process entry orders.
Final-source native checks have117 passing results across the combined run and
an unchanged isolated repeat, retaining one initial HTTPS connection-closed
failure before the outer harness reached GPU setup. The bounded parcel-owner
item is complete; activation/energy exchange is next. Full G2 and publication
hold remain open.
[Outer-publication evidence and exact remaining work](/home/cos/.cache/icc/repos/ulg/g2-outer-condensate-20260914-G5WqYB/implementation-review.md).

### Current G2 checkpoint — donor-resolved optical accounting — 2026-09-13 AKDT

The temporary combined reaction/extraction rejection is now replaced by exact
donor accounting in the shared producer. Authentic pending extraction supplies
only cold lineage addresses; GPU capture excludes each fully extracted
gas-address liquid/material from both reaction sums and route selection. Old
retained optical D and unrelated retained-carrier birth remain intact. Exact
source/revision and both residual buffers are authenticated, including at
encoding and standalone submission. Copied, omitted, torn, consumed or abandoned
authority rejects. No extra GPU dispatch, hot-state map, material-specific
kernel or default-path allocation was added.

All89 focused tests pass. The final serialized desktop-native/regression run
passes118 with no skips or failures; the outer integration contains seven
cases. Three manufactured optical cases independently conserve14kg and210J
of tracked U+translational KE and retain D=2/2.5/2.5kg after real extraction,
phase transfer and paired publication. A mixed-material route-selection case
retains its physical rejection and is never published. No real chemistry or
aerosol optical-adoption claim follows from these manufactured inputs.

Full suite4507PASS68opt-inSKIP0FAIL and buildPASS. Preserve the first focused
revision-expectation failure and initial native run's headless-adapter and
wrong-default-server fetch failures. Only the old producer harness gained an
opt-in headed switch; the EOS repeat uses the actual HTTPS endpoint. No runtime
numerical tolerance or acceptance gate was changed to make these repeats pass.

Final real-desktop iron/ice and sodium/water checks advance18 and8 committed
sources over45.488 and45.564 wall seconds. All six original screenshots were
inspected after owned Chrome closure: real changing geometry, no control-body
preview or page/console error. No identifiable detached plume is established;
dark water/material fidelity and54Hz are not accepted. Frozen558-path source
checks pass. Earlier intermittent startup/HTTPS failures remain recorded.

No preset enables the new extraction path. Next is physically admitted
activation and coupled mass/energy exchange at matched-time SS species pressure,
then growth/evaporation, gas-coupled transport and conservative deposition.
Current pre-thermal diagnostic pressure is not activation authority. Declared
physical multiplicity is not a nucleation law; do not add latent energy a second
time to already partitioned phase U. The default background-nuclei choice has
been asked but not yet answered. G2 remains active and unaccepted, G1 stays
failed/deferred, and publication remains on hold.
[Donor accounting evidence and next physical contract](/home/cos/.cache/icc/repos/ulg/g2-donor-optics-20260914-wd2AY9/implementation-review.md).

## Latest verification — two live recoveries; later physical rejection remains — 2026-09-09 AKDT

Current frozen candidate v3 (574 paths, SHA6a4f8ec4…) passes root566 focused
tests,4,308 full tests (62 opt-in skips), build and ordinary native r1–r4.
Actual configured Cs completes two16-step schedules and presents sources15→31;
the second admits22 child headers, implying two four-child recovered intervals
under the authenticated1/4 contract. A later schedule3/step3 rejects child4.
Exact new native diagnostic identifies prior field speed1,006.411m/s above the
635.239m/s CFL limit. This is not the corrected host clock comparison bug.
[Source-bound failure review](/home/cos/.cache/icc/repos/ulg/task72-production-interval-20260910-vHr98p/root-live-v3-rejection-review.json).

Other five configured desktop captures finish and original images are reviewed;
offline pixel measurements24997 are in progress. No all-six optics/control or
G1 acceptance. Next capture the exact later original state before choosing a
bounded generic recovery extension; current single-use predecessor ownership
requires fully retired whole-interval restart, not reborrowing a failed prefix.
All seven immediate goals, six follow-ons and publication hold remain open.

## Latest verification — integrated path reaches live clock mismatch — 2026-09-09 AKDT

Integration-v1 passes root's 562 focused tests and build, including exact fresh
worker clock binding and one/four-child ownership/publication checks. Its real
configured Cs run54766 fails at schedule1/step5 before visible physics: four
earlier original macros pass complete GPU admission, but the new seal compares
single-macro clock addition with the producer's repeated fine-substep additions.
Both574 source checks and owned-browser closure pass. [Frozen v1 failure](/home/cos/.cache/icc/repos/ulg/task72-production-interval-20260910-vHr98p/live-cesium-v1-ACggP3/capture.json).
Preserve this failure and prove the exact clock correction with the existing
genuine hierarchy fixture, then repeat live Cs before the broader all-six checks.
Do not change physical dt, conservation gates, private descriptors or G1's
visual target. Previous full/native/oracle results below bind older source;
they do not accept this integration. All G1–G7/A1–A6 and publication holds remain open.

## Latest verification — genuine private chain passes; production integration begins — 2026-09-09 AKDT

The frozen gas-lifecycle candidate passes the real GPU four-child exact-buffer
chain, ordinary native r1–r4, full suite (4,197 PASS / 62 SKIP / 0 FAIL) and build.
This removes the ownership failure below, not the live Cs failure. Its six new
desktop image-change rates are water 49.1123/s, iron/ice 50.5580/s, sodium/water
54.2251/s, Cs/F 1.9670/s then stopped, bulk 55.5448/s and dam 56.1056/s.
Root viewed all twelve originals. Bounded sampled pixels do not prove sustained
54 Hz, all-six optics/controls or solver real-time behavior.
The explicit pre-integration G1 oracle is 4 PASS / 5 FAIL; all nine authored
criteria and original failed evidence remain intact.

Proceed with private compact-header admission, bounded same-W1 interval retry
and complete grouped worker receipts. Keep exact original inputs through failed
cleanup, fresh child authority, all physical gates, actual child clocks and one
final public/thermal/reaction boundary. No per-preset path or diagnostic endpoint
copy is authorized. [Current proof and scope](/home/cos/.cache/icc/repos/ulg/task72-private-gas-lifecycle-20260910-3eQ5EO/root-native-review.md).
All seven goals and six follow-ons remain open; new integration edits require
their own verification. No commit, push, merge or Pages hold is lifted.

## Previous verification — private-source ownership implemented, integration pending — 2026-09-09 AKDT

New four-path candidate: 125 focused tests PASS, fixed-baseline guard PASS, and
root-reviewed exact source hashes. Root's native default fused r=1..4 regression
15943 passes all ratios; the 574-file ownership manifest remains unchanged and
the owned browser closed. This is not native private-chain or live-preset proof.
[Exact ownership handoff](/home/cos/.cache/icc/repos/ulg/task72-private-borrow-20260910-1nOH5q/handoff.md).

Full tests pass (4,193 PASS / 62 SKIP / 0 FAIL), build passes (2.49 s). Six serial
desktop captures and decodes completed with owned browsers closed and all source
checks passing: observed changes/s water 51.1133, iron/ice 50.1212, sodium 54.0199,
Cs 2.4433 then stop, bulk 55.3162, dam 59.5968. Root viewed all twelve stills;
these bounded sampled rates do not establish sustained performance or all-six
optics/lifecycle acceptance. Water/iron are below the target in this observation.

Fresh original-dt native baseline 51412 exactly reproduces the original rejection.
Exact-output four-child run 52881 fails in child 2 at the real gas EOS producer:
the frozen predecessor descriptor lacks its required retained-borrow lifecycle.
Child 1 passes physical gates; all cleanup and source checks pass. This is not a
new numerical rejection or a successful native private chain. Repair the producer
before its descriptor freezes, retain consumer guards, and rerun genuine gas
consumer/ownership tests and the native chain. [Failed run](/home/cos/.cache/icc/repos/ulg/task72-private-borrow-20260910-1nOH5q/native-private-chain-current-20260910/probe.json).
Original
root retention should stay inside the existing awaited hierarchy/W1 owner scope,
not revive a retired spatial generation or introduce a standalone borrow system.
Every-child admission, complete interval/time authority, one outward publication
and desktop acceptance remain required. All G1–G7/A1–A6 stay open; no
commit/push/merge/Pages hold is lifted.

## Latest verification — r4 physical rejection confirmed, ownership slice next — 2026-09-09 AKDT

Progress-only repeat 5695 completed normally in 26.608 s. Native r4 still rejects
field 1492 after one accepted fine substep; its tag and all eleven failed-trace
words exactly equal the old half-step rejection. No successful endpoint/public
epoch. All input/source/served-body checks and private/device/browser cleanup
pass; no GPU validation errors or device loss. [Bound result](/home/cos/.cache/icc/repos/ulg/goal1-actual-cs-premacro-20260907-2A1ScR/single-r4-progress-current-v6-run-20260909/probe.json).
This resolves the alternative's numerical uncertainty, not G1. The earlier
timeout remains intact and its environmental cause remains unproved.

Proceed with the proven four-smaller-macro approach, first authenticating private
successor buffer borrowing in the existing fused owner/coupling and lower G2P
retirement paths. No new publication protocol is accepted by this preparatory
ownership slice. Original-source retention (existing item 64), full interval
admission, motion authority and final publication remain required before live Cs
acceptance. Last verified runtime is v6; new ownership edits require fresh tests
and desktop evidence. No milestone, previous failed gate or publication hold is
cleared. All G1–G7/A1–A6 remain open.

## Previous verification — r4 alternative timed out, not numerically classified — 2026-09-09 AKDT

The bounded existing-r4 alternative ran once on the exact captured Cs input and
unchanged original macro dt/materials. Trial 99736 exited 1 after the watchdog
closed its owned browser; no native result or admission header returned. All
fourteen served-module audits and 574 source checks match. Resource pressure
was observed afterward (about 1.6 GiB RAM available, swap full), not proved as
the cause. No human browser was closed. [Original failed run](/home/cos/.cache/icc/repos/ulg/goal1-actual-cs-premacro-20260907-2A1ScR/single-r4-current-v6-run-20260909/probe.json).

Next: retain the timeout, add only external progress markers, and revalidate
resources before another bounded run. The smaller existing-r4 option remains
unresolved; the four-segment success below is not withdrawn. Shared recovery
must preserve immutable input families, create fresh epoch authority after a
failed candidate, and authenticate all accepted children before one outward
publication. Retired/mutated generations cannot be revived. No source fix or
live-Cs recovery is claimed; all G1–G7/A1–A6 and publication holds remain open.

## Latest verification — actual Cs interval now has an accepted refinement — 2026-09-09 AKDT

Task 72 has new native numerical evidence: current-v6 original-dt replay 25889
exactly reproduces the captured field-973 rejection; trial 34463 accepts four
full r2 macros at dt 0.000125 over the original 0.0005 interval, with fixed
materials and unchanged conservation/positivity/CFL gates. All four endpoints,
three native successor classifications, exact GPU copies and normal retirements
pass. Four raw terminal headers re-decode exactly; nineteen binary payload hashes
and fourteen served-module audits match. No GPU validation errors or device loss;
both owned desktop sessions close and all 574 source hashes remain unchanged.
[Four-segment evidence](/home/cos/.cache/icc/repos/ulg/goal1-actual-cs-premacro-20260907-2A1ScR/four-segment-current-v6-run-20260909/probe.json).
Existing pressure-tail native test 41467 also passes all nine cases.

This does not close G1 or task 72: the replay copies numerical endpoints into
fresh diagnostic ownership and publishes nothing. Shared production continuation,
complete outer schedule and actual Cs visual acceptance are still required. No
material retuning, gate weakening, per-preset production branch or new realtime
solver prerequisite. The exact v6 G1 oracle is 5 PASS / 4 FAIL (blocked), preserving
all prior failures. All G1–G7/A1–A6 remain OPEN; publication remains held.

## Latest verification checkpoint — v6 Reset repair, campaign still open — 2026-09-09 AKDT

The shared cache-ownership repair now has positive normal-desktop Reset → Step
evidence. Sodium/water produces visible refracting water and metal geometry;
reopen and subsequent Play remain functional. Original uninstrumented control
run 66027 exited 0, passed 27 UI assertions, reported no page/console errors,
saved 15 PNGs and closed its owned browser. Root inspected the three critical
Reset/reopen/Play images. [Actual Reset image](/home/cos/.cache/icc/repos/ulg/goal1-appearance-controls-20260907-Etxu3E/control-sodium-v6-20260909-wtNns0/ui-tail-reset-new-source.png).

Thermal and contact cache owners now join the existing spatial owner inventory
before lane cleanup. Actual GPU errors established the destroyed-cache-buffer
hazard; genuine producer/cache worker regressions fail before and pass after the
repair. Whole focused scope: 211 PASS. Full suite: 4,188 PASS / 62 SKIP / 0 FAIL;
build PASS. No physics retuning, cache purge or per-preset runtime fix. Six-path
pre-edit guard PASS does not waive historical broad guard failures.

Frozen v6 source: 574 paths, manifest SHA256
`8b46407107e74ea0ef91ef9d4dc3638af77ed59793f15d7dd4e37b1dd517d20d`.
Both control-run source checks pass. All six new desktop captures also pass
their pre/post source checks and close their owned browsers. Decoded full-wall
changes/s: water 72.0781, iron/ice 56.8324, sodium/water 82.4891, Cs/F 1.9527,
bulk 98.2625, dam 96.6188. Root viewed all twelve stills. Five bounded observed
rates exceed 54/s; this is not scanout, every-second cadence, fresh physics per
frame or a causal improvement claim. Cs stops and its 9.410825 s equal-crop span
is not trimmed. [V6 review](/home/cos/.cache/icc/repos/ulg/goal1-appearance-controls-20260907-Etxu3E/root-reset-v6-review.md).
Whole-candidate, all-six optics/lifecycle and native-invariant acceptance remain
unproved. G1–G7/A1–A6 remain OPEN. No commit/push/merge/Pages release.

## Previous verification checkpoint — v5, no delivery milestone closed — 2026-09-09 AKDT

All seven immediate goals and six follow-ons remain OPEN. The current ownership
candidate passes 175 focused tests, full suite 4,177 PASS / 62 SKIP / 0 FAIL,
and build. All 574 frozen source entries match; no native pass is inferred from
the skips. The ownership repair does not fix the actual empty Reset symptom.

The completed Sep 7 six-preset desktop sweep observes water 51.2971/s, iron/ice
53.4884/s, sodium/water 53.8336/s, Cs/F 2.5575/s (terminal stop), bulk 54.2508/s
and dam 56.1601/s. All twelve original stills were reviewed by root and an
independent reviewer. These full-wall scene-crop lower bounds are not scanout,
sustained every-second cadence or a causal speedup. Water's valid-sample ceiling
is below 54/s; its true display rate is not upper-bounded by this observation.
The fresh nine-criterion review is 2 bounded PASS / 7 FAIL; criteria are unchanged.
See [v5 review and exact bindings](/home/cos/.cache/icc/repos/ulg/goal1-appearance-controls-20260907-Etxu3E/all-six-v5-summary.md).

Sodium Step/Play/reopen and photographic refraction have bounded positive
desktop evidence. Reset remains visually empty despite 27 UI assertions passing.
Next is the actual GPU seed/retirement/first-macro boundary diagnostic. Its first
Sep 9 attempt failed on diagnostic lexical scope before Reset, with source
unchanged and owned browser closed; no physics conclusion follows from it.
The original v4 failures and combined guards remain below. No publication hold
is lifted; actual all-preset real-time physics remains A1, not a G1 prerequisite.

## Previous verification checkpoint — G1 oracle blocked — 2026-09-07 AKDT

Current v4: full suite 4,166 PASS / 62 opt-in SKIP / 0 FAIL; 103 focused tests and
build PASS. The six serial real-desktop scene-change rates are water 50.0765/s,
iron/ice 50.0778/s, sodium/water 54.0514/s, Cs/F 2.5588/s (terminal stop), bulk
56.0748/s and dam 56.0101/s. Root personally reviewed all twelve stills. These are
full-window sampled lower bounds, not universal 54 Hz, scanout or causal gains;
water's 327.741 ms change-start gap / 312.120 ms equal-crop span is retained.
See [current v4 observations](/home/cos/.cache/icc/repos/ulg/goal1-appearance-controls-20260907-Etxu3E/all-six-v4-summary.md).

Control run 88693 confirms real Step/reopen/Play now work, but Reset is still an
empty mesh: all eight actual vertex counters [0,0], indirect [0,1,0,0], guards
present at request 8 / source 63 / lane 2. Root and the independent reviewer
viewed all 15 PNGs. Its 27 UI assertions and three exact 192-byte diagnostic reads
do not override the visual FAIL. Sodium photo/light/camera positives remain
bounded; this instrumented run is not throughput or all-six lifecycle acceptance.
See [current control review](/home/cos/.cache/icc/repos/ulg/goal1-appearance-controls-20260907-Etxu3E/control-sodium-counters-gbUUu4/visual-counter-review.md).

Successor gate diagnostic 4558 closes normally with 574 inputs unchanged. Reset
and reopened source 63 have no history descriptor: gateRequired=0, eight expected
parameter words reconstruct as zero, no actual control copy. Before Reset,
source 383's real control copy passes. The history gate is therefore ruled out
for this observed Reset; all eight mesh counters remain zero and visual FAIL.
Root personally reviewed all 15 original PNGs: Reset empty, other checked controls
preserved. Next is the complete small render input (1,216 rows / 97,280 bytes)
plus exact host surface/parameter expectations: hard 128 KiB/frame, three maps
<=384 KiB; maximum 64 retained records / 8 MiB staging. This targets material,
domain or phase mismatch, not full physics/field arenas, a CPU solve or throughput.
[Gate evidence](/home/cos/.cache/icc/repos/ulg/goal1-appearance-controls-20260907-Etxu3E/control-sodium-gate-fquaal/ui-tail-reset-new-source-product-gate.json).

Actual-Cs unchanged-dt replay reproduces field 973 exactly. Refinement 49897
passes half 1's first fine substep, then rejects field 1492 (prior y-speed
710.475 > 317.619 m/s); half 2 does not run. No accepted endpoint/publication or
production recovery is proved. All 14 module audits and 574 input hashes match;
cleanup and owned-browser closure are confirmed. Original GPU material-byte
equality remains unproved. [Native evidence](/home/cos/.cache/icc/repos/ulg/goal1-actual-cs-premacro-20260907-2A1ScR/refinement-run-v1/probe.json)
does not turn the earlier manufactured refinement success into actual-Cs success.

Existing pressure diagnostic 84425 repeats half 1's selected field-1492 tag
and 11 payload words, not its entire header: eight other reduction words differ.
The field reaches 710.475 m/s y-velocity while its one complete contributor
gathers 4.466 m/s y and raw J 0.999508. This bounded diagnostic is not endpoint
admission or recovery; all 14 module audits, 574 input hashes and cleanup pass.
[Original pressure trace](/home/cos/.cache/icc/repos/ulg/goal1-actual-cs-premacro-20260907-2A1ScR/pressure-diagnostic-run-v1/probe.json).

Actual oracle 50969 exits 0: matched ulg-g1-presentation, one receipt for each
of nine criteria, 3 PASS / 6 FAIL, blocked. A new trace supplies only the missing
matching inner status; the old malformed trace / zero-evidence 9-FAIL result
remain. Criteria and evidence verdicts are unchanged. [Oracle result](/home/cos/.cache/icc/repos/ulg/goal1-appearance-controls-20260907-Etxu3E/g1-v4-completion-oracle-status-bound.json).
All 13 milestones and the commit/push/merge/Pages hold remain.
Historical 924/200 selected-scope and 237/200 combined guard failures remain;
bounded current passes do not waive them. No new throughput gain or real-time
physics prerequisite. Next: resolve empty Reset output and continue from the
actual-Cs failed refinement, preserving all prior failures below.

## Previous verification checkpoint — items 73–75 before current desktop confirmation

Goal 1 remains open through items 73–75. Shared background appearance updates
retain actual sodium/water meshes and photographic refraction in desktop runs
79310 and 22144. The misleading optional compact-motion warning is routed by
current admitted geometry without hiding terminal/admission errors. This is
bounded UI evidence, not a throughput gain or complete optics/controls acceptance.

Reset's preview-generation repair passes 100 focused tests and build, and run
22144 confirms the preview retired at generation 3. Its screenshot still shows
an empty box/photo: Reset is not accepted. Reopened Step then times out after
60 seconds because residentAuto=0 was lost from the URL and no manual intent was
deferred. All 574 v3 hashes match and the owned browser is closed. Item 75 now
preserves that URL preference and queues explicit Step independently of autoplay;
103 focused tests pass with independent review. Desktop confirmation and the
current combined full suite are pending. The earlier 4,161 PASS / 62 SKIP full
suite predates the final item-73 clear-caller repair; do not promote it to current.
See external `goal1-appearance-controls-20260907-Etxu3E`.

Actual Cs pre-macro run-v2 acquired eight authentic payloads (438,384 bytes)
bound to the original field-973 rejection. CPU material fingerprints are checked;
independent original GPU material-byte equality is unavailable without COPY_SRC.
The unchanged-dt external replay is prepared, not run; no actual-Cs recovery or
production continuation is proved. See external
`goal1-actual-cs-premacro-20260907-2A1ScR/run-v2-input-binding-review.md`.
Finish combined regression and real Reset/reopen checks, then the bounded replay.
Prior restored all-six observations (five moving presets 49.86–56.47/s; Cs 2.64/s
and stopped) are not current-patch acceptance. All seven immediate goals, six
architectural follow-ons and the commit/push/main/Pages hold remain open.

## Previous verification checkpoint — items 69–71

Goal 1 remains open after items 69–71. Item 69's shared device-loss relays
preserve live cleanup while isolating callback scopes. Full suite: 4,152 PASS /
62 SKIP; actual heap review confirms the bounded scope isolation, but old
families remain and no total-memory or causal throughput gain is claimed.
Its serial all-six desktop observations are water 51.5973/s, iron/ice 49.7152/s,
sodium/water 53.3966/s, Cs/F 1.7637/s (terminal stop), bulk 55.3992/s and dam
56.0101/s. All twelve stills were reviewed. The G1 oracle remains 2 PASS/7 FAIL.

Item 70 is a real native numerical result: the manufactured full step rejects,
then two linked half-steps cover exactly the same interval with unchanged
materials and pass full fine/coarse, reflux and conservation checks. The normal
r1..4 native regression also passes. This is not an actual-Cs fix or production
retry/publication proof. Next is the authentic Cs pre-macro/full-interval case
and shared private continuation with all-child admission before outward effects;
see external `goal1-coupled-refinement-20260907-Ug7q98`.

Item 71's camera-upload cache was **withdrawn**, not delivered: controlled iron
OFF/ON/ON/OFF gives pooled 50.3855/s OFF versus 50.3178/s ON, with opposite-signed
pairs. The exact original runtime and 455-line test file are restored; only the
nine experimental cache tests were archived. All eight stills and raw windows
were reviewed. The tested candidate's full suite passed 4,161/62, but that is
not a post-withdrawal result. Evidence: external
`goal1-uniform-upload-20260907-Iqz8wE`; no repeatable throughput gain claimed.
Post-withdrawal full suite passes 4,152 tests / 62 opt-in skips / zero failures;
refreshed control/visual checks are pending.
All thirteen delivery milestones and the commit/push/main/Pages hold remain.

## Previous verification checkpoint — item 68

Goal 1 remains open after item 68. Thermal loss-holder detachment is verified
by 38 focused tests, the full suite (4,046 PASS / 62 SKIP), build, and an actual
worker heap (528/528 null targets, 1,056 isolated callback scopes). Other old
generation retention remains; no total memory or causal throughput win claimed.

All six presets received fresh serial real-desktop checks and twelve personally
reviewed stills. Full-wall-window scene-change observations are water 52.2061/s,
iron/ice 49.9903/s, sodium/water 53.8117/s, Cs/F 2.6533/s, bulk 56.9756/s and dam
break 55.6044/s. Cs stops after its first mesh on field-973 CFL rejection. The
two sphere demos provide bounded above-floor observations; all-six cadence,
full materials/controls and combined-candidate acceptance remain unproven.
These measurements do not substitute simulation time or HUD callbacks for
visible changes. All 572 frozen runtime/test/tool hashes remain unchanged.

Evidence: external `goal1-thermal-loss-retirement-20260907-HRMbDZ`. Keep every
campaign milestone and the publication hold open. Continue toward shared
isosurface presentation and the Cs correctness stop; do not expand a narrow
retention fix into a claim that any whole goal is complete.

Date: 2026-09-06 AKDT. User-authorized execution campaign; setup is not delivery.
ICC parent task: `ulg-seven-goals-and-architecture`.
Native seven-goal objective remains active, not replaced with a smaller setup goal.

## Delivery order and acceptance

G1's current effort failed acceptance and is deferred by the September13 user
decision above. Continue G2–G7 in their September4 order; none is accepted yet.
Goal 1's existing task, attempts, partial successes and failed gates remain under
`goal1-all-preset-wallclock-rendering-20260904`; do not regenerate that plan.
Priority order is not a claim that each adjacent item is a technical dependency.
`.icc/assistant-goals.yaml` records technical/integration dependencies separately.

| ID | Required outcome | Completion oracle |
|---|---|---|
| G1 | Shared presentation pipeline, >=54 visibly advancing scene presentations per wall-clock second for all six configured presets; preserve refraction, materials, depth and controls | `ulg-g1-presentation` |
| G2 | Conserved species/phase/enthalpy and shared participating-volume transport; real iron/ice plume and identified Na/water gas/aerosol lineage | `ulg-g2-plumes` |
| G3 | Coherent-solid foundation SOL-0/SOL-1, GPU invariants, resident rest mesh and compatible phase ownership | `ulg-g3-solids` |
| G4 | Generic conservative per-node activation beyond the reaction seed; relevant generalized kernels stay warm; scoped laws and zero-work evidence | `ulg-g4-dynamic-laws` |
| G5 | Bounded CAS multi-consumer reservation, epoch fencing, single-winner ownership and lifecycle correctness | `ulg-g5-reservation` |
| G6 | One local provenance-bound online sample/fit/cache with residual bounds, envelope invalidation and schedule-boundary adoption | `ulg-g6-local-fit` |
| G7 | Operator-side offline scientific release audit using immutable versioned database snapshots cached on shitbox; deviations advisory | `ulg-g7-release-audit` |

G1 covers `water-cycle`, `iron-ice-quench`, `sodium-water`, `cesium-fluorine`,
`bulk-water`, and `water-realtime` (dam break). The first four retain true
isosurfaces; the two water throughput demos retain configured sphere impostors.
No per-preset physics branches or geometry substitutions to improve a score.
Measure scene pixels against wall time, excluding HUD/camera-only changes;
record sampling cadence, holds, timestamps and uncertainty. UI rAF, submitted
frames, admitted input serials, solver steps/s and sim time are diagnostics,
not visible-rate proof. Report canonical source publications separately from
bounded display-only interpolation. A genuinely static state must remain static;
measure the preset's moving interval rather than fabricate movement.

The goal is approximately 60 Hz visual presentation, not 60 Hz real-time physics.
All-preset solver real-time speed belongs to A1. Existing Cs admission rejection
and combined mechanics regression/guard failures remain real open work, not
waivers. Keep the user hold on commit/push/merge/Pages until Goal 1 and the
combined candidate are accepted. Then follow the requested meaningful-commit
push, main merge and Pages workflow; setup alone authorizes none of these.

## Architectural follow-ons

Start implementation after the immediate sequence. Select bounded slices by
dependencies and measurement, not by treating every earlier architecture row
as a prerequisite. In particular A2/A3/A4 can help achieve A1; do not require
the final A1 performance outcome before researching those improvements.

| ID | Bounded track | Technical prerequisites |
|---|---|---|
| A1 | Real-time physics: fused/batched bulk substrate, cheap inactive laws, >=100k quiescent carriers and all-preset measured solver real-time behavior, including near-real-time G2 plume scenarios (moved from G2, 2026-11-13) | G4; A2-A4 may provide optimizations; deferred G1 is not a prerequisite |
| A2 | Investigate incremental SS membership repair/particle migration, then adopt only with GPU rebuild equivalence, conservative certificates and measured benefit | Existing immutable spatial-generation contracts |
| A3 | Representative homogeneous-region samples, conservative envelope expansion and bounded region-wide interpolation/lookup | G4, G6 |
| A4 | Broader multidimensional material/compound/property domain functions derived from simulation samples, held-out residuals, provenance and invalidation | G6; optional reuse/integration with A3, not a hard prerequisite |
| A5 | Dependency-gated SOL-2/3 contact/coupling, SOL-4 deformation, SOL-5 topology, then eligible SOL-6 and additional SS levels | G3, each slice's own contracts |
| A6 | PeerCompute-owned warm remote derivation using Eshkol/MoonLab-compatible services, with actual remote failure/recovery proof | G5, G6 |

These are six tracks, not six atomic patches. Split each into small ICC items
when activated; passing one subslice does not complete its whole track.
A2 is an evidence-gated investigation, not an assumption that mutable in-place
tree updates are safe or always faster. Reject a failed approach and retain
its evidence; do not mark an unimplemented architectural improvement delivered.

Strict fits never extrapolate. Any permitted async policy records out-of-domain
debt and adoption ordinals; frozen preview behavior is explicit. Never relabel
approximation, cached evidence or stale closure use as fresh exact physics.
Generic warm kernels are data-driven across materials, reactions and placement.
No CPU mirror solver/parity gate or CPU-owned hot-state fallback: use GPU
manufactured states, invariants, metamorphic runs, same-device A/B and fixed-size
reductions. PeerCompute remains the sole authority/admission framework.

Full frontier-law expansion, electron-cloud inspection, broad material-bank
growth and WSS/STUN/TURN deployment remain separately routed active backlog.
They are not silently added to these thirteen campaign milestones.

## Oracle protocol: evidence, not labels

The campaign has thirteen required target-specific development oracles, a
separate clean-release target, and a separate advisory scientific signal.
All legacy oracles are retained, but old 30 physics-steps/s or water-only gates
cannot complete G1. Static test-name indexing cannot establish executed tests.

Current ICC `quality-campaign` is inventory bookkeeping: its CLI does not wire
the oracle callback, and the acceptance metric is metadata. It reports declared
oracles as unknown/pending. Run `completion-oracle` for each exact target and
record actual results in the durable task plan. Never promote artifact presence
or the campaign's aggregate output into application acceptance.

Development checks match `ulg.campaign.receipt.v1` events of kind
`ulg_campaign_receipt`, with a target-specific `value.contract.id` and
`value.contract.lane: development-review`. The required event names are in
`.icc/completion-oracles.yaml`. Outer `status` and `value.status` must agree.
The completion-oracle runtime reader requires top-level `kind`; an
`event_kind` field alone does not create a direct event. When both are present,
they must agree. A September 6 exact-file CLI check consumed nine FAIL receipts
only after this envelope correction; the original heuristic parse is retained.
PASS and FAIL are both admitted so a newer failure is not filtered out.
Unproven, partial, missing or unknown required checks stay FAIL with their reason;
do not emit WARN as required-check acceptance. Absence remains incomplete.

These are **reviewed evidence attestations**, not implemented ULG numerical
payload validators. ICC does not authenticate arbitrary receipt payloads,
measure 54 Hz, check all-six numeric contents, or bind a dirty worktree itself.
No new producer may stamp PASS just because a probe returned successfully.
Before emitting or accepting a development bundle:

1. Execute the actual domain checks and inspect the original results. Record
   command exits, tests/skips, environment, preset inputs, units, wall-clock
   measurement interval and instrumentation limitations.
2. Bind exact worktree/source fingerprint and relevant source hashes, run ID,
   and SHA-256 references to logs, numeric outputs and reviewed image sequences.
   Confirm the candidate did not change during the run. Keep runtime/session
   artifacts outside the repository under the external ICC artifact root.
3. Independently review each acceptance claim against those artifacts. Unknown
   proof is not PASS. Reject mismatched, duplicated, contradictory or malformed
   records; each required event must have one final verdict for this run.
4. Pass only that exact run's receipt bundle via `--trace-file`. Do not use a
   broad directory, accumulated history, or an unrelated latest trace. Check the
   resolved input list for automatic extra traces and reject contamination.
5. Inspect `target_matched`, exact oracle identity, all authored criteria,
   per-criterion evidence, and any truncation/dropped fields. An oracle PASS
   without steps 1-4 does not close a goal. Keep independent review as an
   explicit additional durable-plan gate.

Only the separate `ulg-campaign-clean-release` target uses
`event_source_policy: exact_clean_current`. ICC supports no exact-dirty-current
policy. This release-source check runs after an authorized commit and source
refresh; it is not a circular prerequisite to accepting pre-commit development.
It does not replace the domain gates for the milestone being released.

G7's required gate tests the audit tool and cache integrity, offline execution,
provenance, missing-data handling and advisory reporting. **Agreement with a
scientific database is not required.** `ulg-science-advisory-signal` is neither a
campaign stage nor a required dependency, release gate or runtime admission gate.
Even an alarming deviation is reported for investigation, not silently converted
into an automatic blocker. Run comparisons on our side at releases/major changes,
not in the physics hot loop or every ordinary edit/test workflow.

## Operating loop

Use direct ICC, native agents for bounded independent work, and non-overlapping
edit leases. Resume parent state, then the current child task. Preserve failed
experiments and source-specific evidence; use `task-plan --merge-existing` for
updates and `task-attempt` only after actually executing recorded commands.
Finish each runtime slice with owned, visible real-desktop browser checks,
including periodic all-six preset sequences. No terminal-browser or pane splits.
One GPU probe at a time; stop only the owned browser. Keep VPN HTTPS Vite running.

```bash
ICC=/home/cos/projects/infinite_context_coder/bin/icc
"$ICC" assistant-status --repo ulg --format markdown
"$ICC" task-show --repo ulg --task-id ulg-seven-goals-and-architecture --format markdown
"$ICC" quality-campaign --repo ulg --format json
"$ICC" completion-oracle --repo ulg --validate --format json
# Substitute the one reviewed, source-bound run bundle; do not use historical globs.
"$ICC" completion-oracle --repo ulg --target ulg-g1-presentation \
  --trace-file /absolute/external/path/to/current-run.jsonl \
  --criteria-limit 200 --evidence-limit 5 --format json
```

Baseline at campaign setup: all thirteen delivery milestones are open; no new
runtime acceptance receipts have been produced. Last restored sodium observation
was 53.715 cropped changes/s, not a full scanout or >=54 Hz all-six pass. Last
strict all-six sweep was 0/6. Optics/motion repairs and partial G2 work survive;
campaign setup does not reset that work or count it as completed goals.
Current bounded G1 slice: use the existing opt-in rejection capture to distinguish
actual particle motion/deformation from a low-mass grid-node velocity tail in Cs.
The 512-byte GPU contributor packet is diagnostic only, never an admission input.
Its initial hand-written field layout was wrong; production ABI constants and
canonical fixture builders now replace that assumption. Actual-preset evidence
now shows complete, finite local gathers at the first Cs nodal rejection, but
not a complete coupled candidate; energy and coarse-endpoint safety remain open.
The desktop checker's obsolete pass-order expectations are corrected without
weakening optics or cadence acceptance. Final all-six remains strict 0/6.
The 800x450 observer's paused control has zero crop changes, while its moving
sodium run observes 42.296/s, not >=54 Hz.

The follow-up camera isolation now proves ordinary input works and reproduces a
real freeze after a newer source loses its post-GPU opportunity. A bounded
one-slot recovery is implemented: later explicit camera/resize input admits that
same source only after fresh fence/opportunity proof. Focused 207/207 and full
Node 3853 pass/62 skip/zero fail, build, independent recovery review, and both
headed fault checks pass. Six candidate images and all 11 final default images
were personally reviewed. Final all-six remains strict 0/6; input proxies are
not pixel-rate evidence, and Cs still rejects after its initial frame.

Item54's explicit shared pause is now verified across mount/scene/bridge and both
rendering geometries. Final configured sodium and bulk desktop checks each pass
11 assertions with >10-second holds, camera/resize, Step and resume; both timeout
recovery variants also hold the exact recovered source at age zero. A real bulk
resize receipt-binding regression and independent retirement/late-receipt races
were fixed before final freeze. Full Node: 3894 pass/62 opt-in skip/zero fail;
build passes. All 18 final control/recovery and 11 all-six PNGs personally reviewed.
Final all-six still strictly fails 0/6: no >=54 Hz actual-pixel evidence, Cs still
rejects at field973. Input proxies are not performance acceptance. Source hashes
match all 572 candidate-v2 runtime/test/script/config paths after the runs;
documentation was updated afterward. Artifacts: external
`goal1-explicit-pause-20260906-liMOpi`. Wider failed guards remain unwaived.

Item55 now implements shared four-iteration contact submissions plus a bounded
retained-frame submission acknowledgement, without changing16 Jacobi iterations,
physics authority, materials or motion caps. Same-device native ordinary/batched
contact passes18 exact final-state comparisons and unchanged intermediate
canonical states. Final full Node3946PASS62SKIP0FAIL and build pass. Independent
source review and13 current candidate PNGs reviewed. Owned iron capture observes
49.709 scene changes/s versus42.095 (+18.09%, one pair/incomplete sampling), while
three source-publication intervals average11.4% longer. This is a presentation
improvement, not >=54Hz acceptance or a solver speedup. Final all-six still0/6;
current Cs witness field621/owner101/ordinal10 differs from historical973. All574
runtime hashes match across final runs. External evidence:
`goal1-active-batch-cadence-20260906-QqSn1G`. Wider runtime/docs preflight237/200
fails and stays unwaived; source-scoped or bookkeeping passes do not replace it.

Next: bounded final-Jacobi-boundary slot-wait A/B before cleanup, with the existing
strict submission deadline and one full proof retained, then item52's complete
bounded coupled-tail fixture. Back-to-back gap declines are a hypothesis to test,
not permission to split/change owner physics or expand motion. Keep stale paused
HUD wording on the remaining lifecycle cleanup list.
Do not repeat the failed same-image wait merger, expand motion horizons/retries,
or start a new measurement framework. Evidence: external
`goal1-camera-isolation-20260906-aPUWdf`; runtime hashes were frozen through the
runs and documentation updated afterward. No new >=54 Hz claim or publishing
authorization; previous combined failures and the commit/main/Pages hold remain.

## Plan crosswalk and superseded guidance

Controlling inputs: `README.md` immediate order; `scale-adaptive-law-activation-plan.md`
envelope/scoped/sample architecture; `material-polytope-registry-and-property-fit-plan.md`
derived function domains; `sol-critic.md` slice prerequisites. The August 28 handoff
was read last and is historical, not today's priority or performance baseline.

Older diagram HTML/PDF text still conflates G1 with >=1x simulation/wall time;
the overarching plan still begins authority-first; the adaptive plan's old M7
ending says validation-next/throughput-later. Those sequencing statements are
superseded here and by September 4's todo index. Synchronize that presentation
packet at the next plan-publication slice; do not enforce its stale gates.

The previous eight broad assistant goals remain verbatim under `legacy_goals`
for traceability, not as duplicate active queue entries. Coverage is preserved:
resident continuity/hot loop -> G1/A1/A2; material properties -> G2/G6/A4;
general reactions -> G2/G4; sealed phase demo -> G2; cold cache -> G4/G6/A6;
triad handoff and docs hygiene -> every slice plus A6. This is routing, not an
assertion that those original broad ambitions have already been completed.

## Previous checkpoint - item56, 2026-09-06 AKDT

The final-Jacobi-only retained-slot wait is implemented and independently
correctness-reviewed, not accepted as a throughput improvement. It retains the
strict original deadline, ordinary initial batching readiness, one full proof
and unchanged physics/terminal authority. Focused presenter216/integration136
pass; full Node3977PASS62SKIP0FAIL (4039 total,194.2478 s), build1.72 s, native
contact1PASS0SKIP with18 comparisons/4136 exact final-state words all pass.

Iron519/10.374 wall seconds =50.0289 observed scene changes/s versus49.7093
(+0.643% in separate incomplete captures): no proven rate win or >=54 Hz claim.
Largest observed change interval47.319 versus56.119 ms; complete source interval
means2671.27 versus2748.83 ms, only three/run. Root reviewed all13 current PNGs;
first four true meshes/two water sphere modes remain, iron/Na/bulk/dam change
shape, water little and Cs initial only. Final strict all-six0/6; input proxies
50.2984/47.2432/35.1122/0/57.6260/60.7842 per second are not pixel rates. Current
Cs field973 rejects first-fine at ordinal10/owner101/gen26 with zero/two commits;
item55's field621 remains distinct. Current all-six controls and full photographic
background optics acceptance remain incomplete.

External evidence: `goal1-final-contact-gap-20260906-PGc7lA`; frozen574 runtime
hashes unchanged. Scoped eight-file guard159 passes without waiving historical
wider237/200 or older failures. All owned probes terminal, VPN HTTPS200 retained,
no commit/push/merge/Pages. All seven goals and six follow-ons remain open.

This checkpoint supersedes the immediate-next sequencing above: item56's
performance experiment stays in progress. Run a controlled same-source final-wait
OFF/ON comparison using the existing desktop helper before retaining/rejecting
the option. No further speculative scheduler changes. Item52's complete coupled
tail and stage-accurate Cs diagnostics remain open for later, not immediate next.

## Previous checkpoint - item56 comparison complete, 2026-09-06 AKDT

Retain the final wait after the independently reviewed iron OFF/ON/ON/OFF
comparison: pooled 49.3606 to 52.2135 observed scene changes/wall second (+5.7797%),
both ON runs above both OFF runs, two short runs/arm. Complete source-arrival
means 2742.20 to 2558.03 ms (six intervals/arm) are not pure GPU timings. Tails are
mixed; incomplete compositor sampling and environment/order confounds remain.
This modest benefit closes the bounded experiment, not G1 or >=54 Hz acceptance.
The one boolean delta leaves batching, strict deadline, one full proof and all
physics/authority rules intact; all 574 ON runtime hashes are restored.

Current 352 focused tests actually rerun PASS with zero FAIL/SKIP. Full 3977 PASS/
62 SKIP, build 1.72 s and native 18 exact comparisons/4136 final words are previous
PGc7lA evidence on the same exact ON runtime, NOT rerun for this checkpoint.
Root reviewed eight A/B plus eleven default PNGs; expected geometry present,
iron/sodium deformations and bulk/dam motion, water little obvious displacement.
No optics/plume/control/54 Hz acceptance implied. Final sweep still strict 0/6;
sodium input proxy 31.785/s with 686.8 ms maximum gap is not a pixel-rate result.
Current Cs field 621 prior y=342.0265 versus 158.8097 m/s stays distinct from the
previous PGc7lA field 973. Historical inconclusive results/failed guards survive.

Evidence: external `goal1-final-gap-ab-20260906-tbeXGT`, including
`ab-results.json` and `independent-ab-review.md`. Next immediate action is sodium
actual scene-pixel baseline with the existing desktop helper. Use the existing
Chrome trace only after real holds reproduce, if needed to localize them. Keep
one shared pipeline; no scenario-specific fix or speculative scheduler work.
Item52 remains parked; G1-G7 and A1-A6 all open. No commit/push/merge/Pages.

## Previous checkpoint - item57 shared kernel reuse, 2026-09-06 AKDT

Exact-device caches now reuse five byte-identical gas-free-volume pipelines and
three fixed-ABI spatial pipelines across private runtimes. ActiveRank remains
capacity-specific; shader bytes, arenas, bindings, physics/bounds and authority
are unchanged. Source review passes; the growth mock does not establish
multi-capacity ActiveRank execution. Current gas 20/spatial 69 focused pass;
combined 150 PASS/1 opt-in SKIP/0 FAIL; full 3991 PASS/62 SKIP/0 FAIL, build 1.70 s
and native exact-gas 1 PASS/0 SKIP/0 FAIL. The native check is not cross-capacity
or two-level equivalence evidence.

Trace compute-pipeline API creations 52 to 4; targeted gas 30 and spatial 18
creations disappear from the post-ready candidate window while sources 63 to 127
advance. Host API durations are not GPU time or visual-stall savings; absent
buffer/dispatch capacity witnesses prevent a native growth-equivalence claim.
Unprofiled sodium 53.38113 versus 52.25769 scene changes/s has much earlier
first-image coverage but worse maximum change interval and mismatched source
phases. No general sustained 54 Hz claim. Root reviewed 13 current representative
PNGs; configured geometry remains, iron/Na/bulk/dam move, water little and Cs
initial only. Final strict all-six 0/6; its input proxies are not pixel rates.
Current Cs field973 first-fine failure remains distinct from tbeXGT field621;
no full-control/photographic-optics/plume identity acceptance is implied.

Evidence: external `goal1-sodium-scene-stalls-20260906-wjPPPD`; 574 post-sweep
runtime hashes match. Historical failed gates, including wider 237/200, remain.
Next bounded work is native 2:1 pressure-tail endpoint and signed-energy evidence;
field973's historical full gather is already done. Preserve all admission/physics
bounds and do not add real-time physics as a G1 blocker. G1-G7/A1-A6 all open;
no commit/push/merge/Pages.

## Previous checkpoint - item52 native coupled tail, 2026-09-06 AKDT

Executed the proposed coarse support-edge cases; both pass but their fine gas
receiver is not pressure-loaded. A phase-consistent fine-liquid/coarse-gas input
now exercises the actual fine boundary. At fine x0.8750000596046448, macro1e-4
passes the complete native r2 contract; macro3.2e-4 rejects the first fine field
with prior687.41449 versus625m/s. Complete27-node fine gather remains bounded
(~0.20m/s, rawJ1.00000036), but effective deformation is disabled in the original
fixture and coupled phase/full current/successor endpoint safety is still open.
This is manufactured mechanism evidence, not exact Cs reproduction or a fix.

Only native tests/helper changed. Same-encoder raw snapshots retain parent keys,
workspace/field/reflux operands; successful staging reuses header words, and
later fail-closed banks are not actual visited endpoints. A test scratch fanout
fix restores the existing failed-particle capture. The crossing test stays FAIL;
no bound/scale/pressure/authority relaxation. Final native r1..4 and loaded r2
control PASS; focused81PASS/2SKIP, buildPASS, lifecycle mocks5PASS. Evidence:
external `goal1-coupled-pressure-tail-20260906-cFuVDX` with independent v4 review.
Next: finish actual coupled endpoint and signed-work coverage using these
nonvacuous native inputs. Do not rerun the old zero-load cases as progress or
claim full safety from low particle speed. All13 milestones/publication hold
remain unchanged; this diagnostic itself does not improve display cadence.
Final owned-desktop all-six strict0/6, all11 PNGs root-reviewed: expected geometry
present; iron/Na/bulk/dam motion, water little and Cs initial only. Current Cs973
failure persists. Input proxies are not pixel proof; full optics/lifecycle/plume
acceptance remains open. No new production runtime changes in this slice.

## Previous checkpoint - item58 controlled substeps, 2026-09-06 AKDT

Prior native checkpoint is now fully recorded: independently reviewed575source
hashes38artifacts11images4docs; exact G1 oracle1provenancePASS/8domainFAIL,
one source/nine receipts with no truncation. No domain goal accepted.

Three actual owned-desktop controls share six exact initial packed input hashes:
default macro0.0005/r2 fails field973 after one committed schedule;
macro0.0005/r4 fails field2151 after one committed schedule;
macro0.00025/r2 presents source15->31 then fails field377 after two schedules.
The last committed clock remains0.008s in all three. Worker ratio/CFL0.8,
authority coverage and complete terminal admission are checked per successful
schedule; dt/time labels are page-maintained, not independent GPU measurements.
All three probes terminate2, no pending invocations/page errors. Root reviewed
six PNGs; no cadence claim. Evidence lives outside repo in
`goal1-substep-rejection-20260906-oY3rmN`. Preserve the earlier sealed-to-r2
override and pre-physics click failure as distinct experiments.

Do not promote fixed dt/ratio settings or keep trying arbitrary smaller values.
No force duplication was found; exact pressure follows the earlier nodal clamp.
Rejected validation does not finish all proposals or seal candidate scales.
Next item52: explicitly counterfactual first-fine GPU evaluation from exact
pre-correction inputs, complete production-derived proposals on owned clones,
declared scales, signed work and full raw particle C/F/J; compare a passing
control to actual prepared rows. Full-r2 terminal/coarse/successor safety remains
required before any replacement admission, not silently replaced by this probe.
No gate/default/runtime changes, goal closure or publication. All13 milestones
stay open; latest unchanged-runtime default all-six result is still strict0/6.

## Previous checkpoint - item52 first-fine counterfactual, 2026-09-06 AKDT

Test-only clones now complete all first-fine proposals, signed channel work and
particle gathers at explicitly declared1/1 scales. Passing native r2 control:
297/297 non-angular prepared components exact, 16/81 angular mismatches;
full equality remains FAIL. Original crossing still rejects field22 before any
fine commit, while the separate counterfactual field26 remains outside nodal
CFL. Full27-sample fine gather is bounded in this manufactured fixture, whose
effective deformation is disabled. This does not establish actual-Cs or full
coupled/coarse/successor safety. Source31PASS, lifecycle5PASS and probe-disabled
native r1..4 PASS; independent v3 review preserves the failed comparisons.

Actual-Cs v1 heap failure is preserved; v2 completes the bounded12,592-byte
capture with default GPU dt/r2 and exact current failure973.259active/143fine
gathers are complete with deformation enabled, positive rawJ0.99926245..1.00860059
and maxtravel/dx0.02287576; six of2481 nodes remain outside nodal CFL. Independent
source/reducer/witness review passes; omitted full rows limit offline recomputation.
The actual fine-only diagnostic is complete, not coupled/coarse/successor admission.
Do not bypass gates or extend into more fine-only variants.42 transport assertions
pass on retained GPU data and corrupt cases. Production physics/defaults unchanged.

Item52g fixes the shared terminal warning with current generation/token/error
precedence (95focusedPASS); all-six desktop UI checks6/6, all12 PNGs personally
reviewed, no preview layers and current Cs terminal-stop message. Owned browser
closed. This is not optics/plume/54Hz acceptance. Next presentation-only A/B:
allow initial contact batching while a valid retained draw proof is pending,
without changing existing deadlines, source/cancellation guards or physics.
No new visual-rate acceptance or publication. Evidence: external
`goal1-first-fine-candidate-20260906-xSHmEs`. G1-G7/A1-A6 stay open; real-time
solver optimization remains A1, not an extra G1 requirement.

## Previous checkpoint - item59 initial batching not retained, 2026-09-06 AKDT

Initial busy-slot eligibility was implemented/tested without changing per-gap
requests, physics or deadlines. Candidate357focusedPASS; independent review
corrected swallowed test assertions. Owned-desktop sodium OFF/ON/ON/OFF captures
and original PNG analyzer exit0:53.5523/52.8117/54.7163/53.1382 actual cropped scene
changes per full wall second. Pooled+0.7955% is not a repeatable gain. ON's largest
observed interval82.628ms versus OFF68.387ms does not prove continuous scanout
holds; OFF's worst is dominated by recorder teardown. No source errors, all
source63->127, no complete source-arrival interval or batching activation proof.
All8 routed pairs verify the initial-query-only toggle. Startup analysis overlap
and short non-phase-locked runs remain explicit limitations.

The candidate is archived, not retained. Exact four-file apply_patch restoration
preserves all earlier work;580 code-input hashes match and restored352focused
tests pass. Next bounded investigation: existing native Chrome trace of autonomous
pre-submit wake-up/render-lane/frame callback ordering. The observer already arms
early; no evidence justifies removing a proof wait or extending a deadline.
Submit-to-opportunity timing includes GPU completion, not a second additive stage.
Evidence: `goal1-initial-batch-20260906-I9AhQS`. No new G1 acceptance, goal closure,
commit/push/merge/Pages. All seven goals and six follow-ons remain open.
Restored all-six desktop sanity6/6/UI-only, all12 PNGs root-reviewed, browser
closed. Geometry and existing terminal warning work; Cs physics rejection and
full optical/plume/cadence acceptance remain open.

## Previous checkpoint - item60 native CPU attribution, 2026-09-06 AKDT

Restored sodium native trace executed exit0/no reported trace loss or browser
errors. An80.051ms offscreen-worker message task postpones renderer timer586:
requested4ms, actual83.811ms installation-to-fire. Root checks the original events;
sampled stacks show repeated authority/transition/configuration validation and
stable-token/TextEncoder/SHA256 fingerprinting. Separate38.987ms worker major GC
coincides with another late opportunity. Profiling adds overhead; not a rate gate.

Next candidate removes redundant HASH work, not authority checks: private
invocation-local memo keyed by each freshly serialized configuration-token string.
Preserve structural validation, property reads, stableToken and catch order;
public/reentrant calls get fresh context. No object-identity trust cache, mutable
global cache, cross-await trust or changed fingerprint bytes. Add encoding-count,
mutation/getter/cycle/error/reentrancy regressions before a measured comparison.
No validator edit yet. All580 code hashes remain restored; build1.95s and
focused352PASS. Evidence: `goal1-initial-batch-20260906-I9AhQS/restored-native-trace`.
G1-G7/A1-A6 and publication hold remain open; no more initial-batching flag sweep.

## Previous checkpoint - item61 bounded authority CPU savings, 2026-09-06 AKDT

Private call-local exact-configuration-token SHA reuse is implemented and retained.
No checks/serialization/property reads/catches skipped; no identity/global trust,
public memo injection or cross-await reuse. New21 regressions, focused168 and
final full4030PASS/62SKIP/0FAIL; build1.88s. Earlier full-suite cycle-fixture failure
is retained, not relabeled green. Clean v2 authority fixture calls14.6–21.1% shorter,
configuration encodes9/24→2; standalone reaction-transition17.3% slower disclosed.

Same-source sodium real-desktop ABBA yields54.7033/54.0410/54.8852/53.6538 decoded
changes/s over complete wall windows. Equal1125 changes per arm, mixed results,
pooled+0.5228% from108ms shorter ON observation windows: NOT a proven delivery win.
No physics changes/guard weakening or material swap. Current all-six desktop
sanity6/6 UI-only, all12 screenshots personally reviewed, no previews, owned
browser closed; existing Cs physics rejection remains.581 frozen code hashes match.
Evidence and independent reviews: `goal1-authority-hash-20260906-BnINTT`.

Next: obtain actual scene-pixel coverage for currently unmeasured presets with
existing capture/decoder tooling. The current admitted-input sweep hardcodes
visibleMotionCadenceVerified false and consequently adds missing-visible-evidence
failure; historical strict0/6 is NOT evidence all six are currently below54Hz.
Do not turn that diagnostic flag on without actual pixel proof, rerun a guaranteed
missing-evidence sweep as if it measured pixels, or start speculative hash variants.
Keep actual Cs rejection, unverified optics/lifecycle/plume behavior and all13
delivery goals open. All-preset solver real-time remains A1, not an extra G1 gate.

## Previous checkpoint - item62 actual remaining-preset pixels, 2026-09-07 AKDT

Existing real-desktop capture/decoder on unchanged item61 code measures iron49.9565,
early water48.9939, bulk55.1004, dam55.0744 cropped changes per full wall second.
Paused water and dam controls each record zero changes with fixed source/Play.
One predeclared later water source511..575 interval (0.256..0.288s) gives48.0824,
with visible developed shape change; it does not replace the early window.
Seven serial browser runs exit0, all14 stills root-reviewed, owned sessions closed.

Early water has metre-scale bodies and only0.008..0.040s elapsed; iron bodies are
millimetre-scale. Direct RGB analysis confirms early-water median34 changed pixels
versus iron737; source arrivals correlate with the largest image changes. This is
not evidence to amplify motion, enlarge bounds or introduce field morphing. The
fixed crop contains the upper moving interfaces but excludes lower material pixels.
These short compositor observations and paused controls do not establish full
scanout, repeatability, all-preset54Hz, optics, steam or full control lifecycle.

Later water additionally has matching sampled images320.183ms apart (310ms
sampling gap, not uninterrupted-freeze proof) and a156.7ms main-rAF gap while
source543/serial4564 last appeared below the motion-age cap. Prioritize the existing
native trace on this same predeclared source511 flow window, not another mean-rate
flag sweep; no GC/GPU cause is established. Scheduler review finds no simple
unconditional double wait: prearmed proof waits overlap; timer is remainder-only.
The Cs failure separately needs a valid mechanics outcome. Adaptive macro retry is
a possible conservative correctness path, requiring same-source retirement/retry,
fresh exact authorities, full solver rerun and elapsed/envelope accounting; not
implemented and not permission to relax CFL or reuse consumed predecessor tokens.
Evidence `goal1-preset-pixels-20260906-2yKS5i`;581 frozen code inputs still match.
All seven goals/six follow-ons and publication hold remain open.

## Previous checkpoint - item63 current delivery and GPU cost, 2026-09-07 AKDT

Same source511 water native trace does not reproduce the prior320ms sampled hold.
Regular callback delivery remains slow: worker next-request median0.383ms versus
request-to-delivery18.35ms. Profiling captures494 changes/10.290s, not acceptance.
Slow callbacks also occur before PNG recording. No extra timer/proof removal is
justified. Bounded browser-only use of the existing GPU pass profiler produces
12 complete seven-pass samples, median total0.060016ms (outlier0.830176ms retained).
Backface median0.015584ms rejects deformed-vertex caching as the next G1 priority;
these pass sums do not include copies/queue/compositor latency. Instrumented
528/10.260s is not a delivered speed improvement. No production source was edited.

Original-code compositor trace now exists with the previously used delivery
categories and no V8 CPU profiler:504 changes/10.235s, no lost trace or browser
errors. Inspect its exact pending demand/native frame flow and current worker
tasks before choosing a host-scheduling change. Three owned browser runs and
three original decoders finish; all six full stills inspected. No all-preset,
material, plume or full-control acceptance claim; Cs still separately rejects.
Evidence roots: `goal1-late-water-native-20260907-1Gf6Mb`,
`goal1-water-render-pass-20260907-Te6glf`, `goal1-water-compositor-20260907-En5fjx`.
All581 code inputs still match; previous full4030PASS/62SKIP/build remains current,
not rerun. All thirteen milestones and publication hold remain open.

## Previous checkpoint - item65 declined host-task yield rejected, 2026-09-07 AKDT

Item63 now attributes46 expired worker deliveries and32 short deadline-abort
tasks, plus a separate241.020ms MajorGC; allocation/retention source unproven.
Item65's browser-only candidate adds one real task after a current, actually
declined presentation. Twelve exact-transform lifecycle tests pass; production
code, solver operations, deadline/proof/authority semantics remain unchanged.

Four final desktop captures/decoders finish0, all eight stills reviewed:
OFF49.4447 / ON49.6682 / ON50.0145 / OFF50.8211 scene changes per full wall-second.
Clean reverse pair-1.5871%, exploratory pool-0.5758%; no repeatable benefit, so
reject production adoption. ON deltas61/62 actual host tasks, all ports closed,
no timer fallback. First OFF long hold does not recur in last OFF: no stall fix
claim. Preserve full wall windows, original exclusions3/6/0/0 and fixed crop.

Keep v1 pilot, v2 pre-window request-count assertion failure, corrected v3 exact
module identity and run-deviations.md. First ON early warmup overlaps preceding
decoder (terminal by source127 before measured511), so not a clean strict ABBA
gate. Counter snapshots bracket with unmeasured async latency; no scanout,
all-six54Hz, material/plume/full-control acceptance. External evidence C9QxyZ.

Next inspect an old completed worker output/generation's actual heap retaining
path: device.lost reactions versus live-generation/cache or current/quarantined
ownership. Do not infer a leak from source or delete authentication/lifetime
checks. All581 code inputs still match prior4030PASS/62SKIP/build (not rerun);
all13 milestones, Cs correctness issue and publication hold remain open.

## Latest checkpoint - items66/67 actual worker retention, 2026-09-07 AKDT

Baseline6T8Aaq contains527retired/1active families at public source527. A complete
3028-edge root path proves a selected normally retired source26 family retained
through GPUDevice.lost and a weak callback's strong parent context. Exact private
retirement/zero leases and matching producer lineage establish old completed
identity; schema labels and raw counts are not blanket path attribution.

Source-family callback isolation is implemented with separate module-level
factories; the weak factory receives only WeakRef. Focused23PASS, including a
beforepatch failing structural regression; full4037PASS/62SKIP/0FAIL, buildPASS.
Final comment/regex tightening is focused-retested. Loss/rejection/fallback and
lease/owned-buffer retirement behavior remain covered. Only two of581 frozen
code inputs change; source/test actual scoped guard has no violations/warnings.

Postpatch POCGUv at source511 has512callbacks all without a direct raw family
binding before the module boundary. Yet511retired/1active families remain; the
528to512 difference is producer count, not a memory improvement. A positive
2937-edge loss-promise path still retains a released spatial thermal proposal
artifact and producer26, with a rooted commit receipt conditionally retaining
its successor family. Next bounded fix is that actual thermal-artifact loss
lifetime, not removal of authority/retirement checks or another physics change.
Both diagnostic browsers and parsers close; paused stills root-reviewed. Heap
inspection is not cadence evidence, a GC-cause proof or all-six acceptance.

G1 and the full campaign remain open; record postpatch desktop pixels separately.
Keep the Cs rejection, complete controls/material checks and publication hold.

Postpatch f6zL9i owned desktop water and unchanged decoder now finish0, both
stills root-reviewed, no browser/errors/preview.516scene changes/10.287s =50.1604Hz,
zero timestamp exclusions, source511..575;254.300ms max observed change interval.
No demonstrated throughput gain, GC-cause or54Hz/all-six acceptance. Next thermal
loss-target fix preserves strong live cleanup ownership, detaching its heavy
links only after successful releaseLease; both loss outcomes still mark the
device lost. All heavyweight jobs are terminal before desktop warmup and decoding
starts only after owned browser closure.
