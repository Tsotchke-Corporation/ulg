# Phase-Resolved Steam Optics Plan

## Accepted environment decision — 2026-09-14 UTC

The operator explicitly approved: **"Yes—use documented room-air and nuclei
inputs."** This resolves the environment/nuclei permission question in older
checkpoints and handoffs. Parameter selection and integration are implementation
work, not a reason to wait for another user choice. This decision does not mean
that an atmosphere or nucleation law has already been enabled in the presets.

Apply the shared physical input path to the visible-steam scenarios:
`water-cycle`, `iron-ice-quench`, and `sodium-water`. Preserve cesium–fluorine's
authored reactants and the bulk-water/dam-break vacuum benchmarks. Retain a
same-air, zero-background-nuclei comparison; aerosol-free does not mean vacuum,
and removing seeds must not silently remove humidity or disable condensation
on existing bulk interfaces.

Use a declared initial reference of **293.15 K, 101325 Pa, 50% relative
humidity, and zero mean air velocity**. These are chosen reproducible scenario
conditions, not measurements of the operator's room. Existing hot/cold bodies
and wall conditions remain as authored. Document dry molecular air composition,
any omitted trace species, and humidity's saturation convention. The
[CIPM-2007 reference composition](https://www.nist.gov/system/files/documents/calibrations/CIPM-2007.pdf)
is a source for that composition, not a claim about today's indoor CO2 level or
an admission of the full CIPM equation of state. Allocate actual gas inventory
from physical free volume; an ambient-pressure force setting alone is not air.
Do not imply an infinite atmosphere or ventilation without modeled boundary
mass and energy fluxes.

Before enrollment, specify nuclei number concentration in physical units, dry
size distribution, composition/density, physical multiplicity and provenance,
initial hydration/phase history, and the activation model's validity domain.
Literature-supported material properties and explicitly chosen benchmark
concentrations must be distinguished from measured room-air data. A candidate
[hygroscopic activation reference](https://acp.copernicus.org/articles/7/1961/2007/acp-7-1961-2007.pdf)
does not itself choose those inputs or justify applying a cloud-activation fit
at every subsaturated humidity. Do not substitute already-visible pure-water
droplets for dry seeds; account for core/solute and condensed water separately.

Air must participate in conserved heat, gas motion and applicable chemistry;
oxygen is not an inert visual aid. Seed activation must consume real available
vapor and carry coupled energy, then use the shared transport and optics path.
Nuclei enable a condensation route but do not guarantee an opaque plume.
Acceptance still requires no spurious cloud in the initial room-air control,
conservation, population-resolution invariance and traced transported droplets
in real desktop checks. No per-preset kernels, opacity tuning or weakened gates.

This checkpoint records the decision only: runtime/test/ABI inputs are unchanged,
G2 remains active (3/6 child items), G1 stays failed/deferred, and publication is
held. Next implementation remains coupled growth and complete inventory/interval
integration, now with this approved physical environment included in enrollment.

## Current checkpoint — shared resident GPU heat writer — 2026-09-14 UTC

Prescribed heat-only edges now connect actual retained gas owners to existing
liquid parcels across caloric species, with shared endpoints gathered once from
immutable source. No diagnostic LTE substitution or new resource-authority
layer. Integer packet summation preserves cancellation; actual stored energy
changes are checked against packet-sized budgets. Mass transfers remain
disjoint; mixed mass/heat endpoint sharing, kinetics/interval/adoption and the
broader small-inventory representation are still open.

Final104 focusedPASS,29 exchange GPU cases and5 current-source GPU casesPASS;
full5,151PASS/75SKIP/0FAIL; buildPASS. Six configured desktop presets advance;
root reviewed12 original first/last PNGs after browser closure. Water remains
dark/coarse-looking; no identified transported steam/aerosol plume is accepted.
Do not infer visible FPS from source counts or HUD presentation counters.
[Exact evidence, failed attempts and limitations](/home/cos/.cache/icc/repos/ulg/g2-gpu-mixture-heat-20260914-GZFNcx/verification.md).
G2 remains active,3/6 child items; G1 failed/deferred; publication stays held.

Date: 2026-06-11 AKDT

## Current checkpoint — finite-time cell reference — 2026-09-14 UTC

Actual reference mass/energy evolution now follows a declared near-equilibrium
Onsager law for one thermodynamic vapor reservoir, multiple existing fixed-N
liquid parcels and distinct inert species with separate temperatures. Gas pressure
work, phase offsets and surfaceU=aA are coupled without a second latent credit.
Exact dyadic extensive inventories retain sub-ULP transfers; coupled midpoint
step doubling controls numerical error and returns explicit incomplete intervals.
The current SS bridge and prescribed GPU writer are unchanged.

83 new tests plus119 related tests pass; full5,142PASS/75opt-inSKIP/0FAIL;
normal buildPASS. Review's endpoint-temperature cancellation bug is fixed and
regression tested. This does not establish continuous-interval enclosure,
general discrete entropy proof, calibrated all-Kn transport or GPU inventory
precision. It cannot merge unequal-temperature vapor rows or introduce an
unmodeled vapor seed, physical droplet population or atmosphere.

Goal2 still requires transport coefficients/physical closure, full resident
mass-and-energy integration, matched adoption, transport/deposition and actual
iron/ice and sodium/water lineage. No new live plume or browser evidence is
claimed. The prior647 runtime inputs remain unchanged; final freeze has651.
G1 failed/deferred; G2 active; publication held. No goal acceptance was narrowed
in response to the user's token-cost concern.
[Verification and remaining scope](/home/cos/.cache/icc/repos/ulg/g2-finite-cell-20260914-UIF2uy/verification.md).

## Current checkpoint — physical interface rates, reference only — 2026-09-14 UTC

`condensableInterfaceKinetics.js` now evaluates coupled stationary-interface
mass and molecular energy rates from explicit material/surface parameters and
actual incoming vapor/inert temperatures. It supports heat with zero net mass,
multiple vapor populations with one surface emission, and fixed-physical-N
radius/area/surface-energy derivatives. Kelvin/Poynting enters once through
explicit mechanical normal stress plus Laplace pressure. Incident pressure
has its own aggregate domain, independent of the liquid-pressure bound.

This is a binary64 numerical reference, not a GPU cell/timestep writer or a
far-field growth law. Surface-side half-Maxwellians, negligible drift and
equilibrated internal modes are explicit assumptions. It does not supply
continuum/transition transport, moving-interface pressure work, temperature
evolution, donor allocation or new nuclei. No air/default plume is introduced.
Its molecular energy is not continuum enthalpy; no second latent or Fourier
term is added. Surface internal energy remains `a*A` for `sigma=a+b*T`.

Independent quadrature/Gibbs tests cover91 cases;28 existing thermodynamic/
equilibrium cases also pass. Review found and corrected premature underflow
in mass/accommodation products. Truly unrepresentable nonzero rates reject;
scaled binary64 rates are not a solution to the GPU's separate f32 inventory
problem. Final full suite5,059 PASS/75 opt-in SKIP/0 FAIL; normal build PASS.
Fresh real-desktop cesium advances15 committed sources15→239 over45.574 wall
seconds. All three original images reviewed after owned-browser closure;
no browser/schedule error or preview-only scene. This is not plume/material/
all-six/54Hz acceptance. The647-file final source freeze matches throughout.
[Verification and physical scope](/home/cos/.cache/icc/repos/ulg/g2-interface-rates-20260914-5PlfaD/verification.md).

G2 remains active (3/6 child items complete). Next is the coupled finite-time
reference with a justified moving-boundary/transport closure, then a cell-owned
all-member mass/heat writer and one matched adoption. Reuse the already verified
current SS/EOS source; do not rebuild that authority layer. Shared donors,
spatial moments, persistent surface/precision inventory, successor occupied
volume/EOS, explicit gas-only/ice domains and physical population inputs remain
open. Keep the existing exact f32 writer gates; a writer-only low-mass sidecar
or delayed flux accumulator cannot preserve all unequal-binade transfers.
[Integration review](/home/cos/.cache/icc/repos/ulg/g2-interface-rates-20260914-5PlfaD/integration-audit.md).

## Current checkpoint — completed closure to current gas — 2026-09-14 UTC

The real completed thermal/reaction/phase-transfer/refresh tuple and full live
history now reach fresh private SS/free-volume/EOS through an opt-in one-shot
source read. The original population, including a retiring aerosol family,
remains held through all current consumers. Actual classifier/build lineage
and original box/grid policy are preserved. Unplaced condensed history rejects
this gas view because its missing occupied-volume projection is not supported.
There is no interim publication, kinetic interval or default-preset enrollment.

Five new real-GPU cases pass, including full32-word old+new history membership,
independent aerosol free volume and an actual conservative writer consuming
the fresh state. Existing 15 exchange, ten caloric and seven paired-publication
cases also pass. Full suite: 4,968 PASS / 75 opt-in SKIP / 0 FAIL; build PASS.
Only fixture import identity changed afterward; production hashes stayed fixed.
Keep the initial native navigation/fetch failures and module-identity failure.

Fresh cesium/iron/sodium checks advance 15/18/9 committed sources in about45.5
wall seconds each. All nine original images were reviewed after browser close.
Changing geometry is established, not plume identity, material/refraction
fidelity, all-six coverage or54Hz. Dark/faceted material appearance remains.
[Current evidence and limitations](/home/cos/.cache/icc/repos/ulg/g2-current-gas-20260914-S9V6FQ/verification.md).

Next remains real growth/mixture heat coupling, numerical mass representation
and matched-interval adoption, followed by transport/deposition. Persistent
surface energy, shared/nonlocal donors, explicit gas-only/ice model domains and
the physical environment/nuclei choice remain open. No extra L*dm, atmosphere,
radius/population or renderer cloud was introduced. G2 stays in progress.

## Current checkpoint — real stage inputs before growth — 2026-09-14 UTC

No default preset yet enrolls the explicit condensable/caloric models. The
conservative writer remains a manufactured-input candidate, not a live plume
law. Next bind the genuine completed closure tuple and fully merged history to
fresh private SS/free-volume/EOS, then couple actual rates and one publication.
Do not promote pre-P2G gas data or caloric equilibrium T to current gas state.

Reaction, phase-transfer and mechanics-refresh options previously could replace
closure-owned source buffers and contracts; reaction options could also replace
the actual interval. Their precedence now matches thermal: the closure owns
those inputs while tuning/diagnostic options remain usable. Three demonstrated
red cases turn green; all35 focused closure tests pass. This does not issue a
new source/interval capability or accept arbitrary injected stage producers.

Full suite passes4,940 tests with74 opt-in skips; normal build passes. Fresh
cesium/iron/sodium desktop runs show actual changing geometry over45-second
wall windows; all nine originals reviewed after owned-browser closure. Keep
iron-v1's unexplained exit143/no terminal receipt and sodium-v1's navigation
connection failure beside the unchanged passing retries. No identified plume,
material/refraction or54Hz acceptance is claimed.
[Current verification](/home/cos/.cache/icc/repos/ulg/g2-stage-inputs-20260914-thwXoQ/verification.md).

The next physical operation still needs all-member gas heat changes, persistent
surface energy, nonlocal/shared-donor treatment and an explicit mass-precision
design. Temporal unexecuted-flux residuals alone cannot cross every two-f32 mass
binade. Legacy fixed-boiling/ice/gas-only model enrollment and atmosphere/nuclei
inputs are unresolved. No new default cloud or physical population is added.
[Current source/physics audit](/home/cos/.cache/icc/repos/ulg/g2-stage-inputs-20260914-thwXoQ/integration-audit.md).

## Latest checkpoint — conservative existing-droplet transfer — 2026-09-14 UTC

The private paired caloric EOS now produces independently owned GPU S/T/M,
residual-product and aerosol candidates for prescribed signed vapor/liquid
exchange. Donor-resolved U/velocity, mixing heat, independent phase temperatures
and separate linear-interface surface internal energy are conserved within the
declared regime. N and nuclei identity are preserved, never invented. Historical
pressure cannot authorize continuation; actual successor SS volume/EOS remains
required. This is not kinetic growth, a physical interval or live publication.

The native tiny-transfer false READY is fixed by separate-dispatch stored-state
validation. Both old/new owner masses must stay within factor2 for exact f32
debits/credits; oversized proposals reject, not clip. Fifteen manufactured native
cases pass, including actual source immutability, energy/gauge tests and genuine
numeric refusals. Three prior native commands, full4,936-test regression (74
opt-in skips) and build pass. Preserve all earlier fixture and kernel failures.

Fresh cesium/iron-ice/sodium-water desktop checks show actual changing geometry
over45-second wall windows; root inspected all nine originals after browser
closure. No identified transported plume or material/refraction/54Hz acceptance.
Next is a coupled diffusion/heat producer with real stage/interval and publication
ownership, then drag/transport/deposition and actual preset lineage. The existing
nuclei choice and gas-only H2/ice model domains remain open. G2 remains active.
[Exact scope, evidence and limitations](/home/cos/.cache/icc/repos/ulg/g2-vapor-aerosol-exchange-20260914-n6amVx/implementation-review.md).

## Latest checkpoint — paired caloric EOS admission — 2026-09-14 UTC

The retained gas EOS now holds its own exact published particle/product-history
read through real single-level consumer leases, including requested retirement.
Fork/resolver admission rechecks private liveness after public-envelope access;
queue-ordered release also rechecks the still-live parent at the actual drain.
Exact counts, history identity/absence and source epochs cannot be replaced by
prefixes or public lookalikes. Raw GPU-buffer borrowing remains independently
necessary. Cold/private-fine/cross-level inventories without this complete pair
remain pressure-only inputs, not physical exchange authority.

An explicit opt-in caloric table authenticates the original thermal model's
material ID, molar mass, Cv and affine U(T) domain. The existing SS cell loop
checks every gas member's raw U/T/m/n and accumulates mCv and reference-centered
energy. Unequal-temperature mixtures use energy-weighted equilibrium temperature,
not nT/n. Independent nonreacting-species energy-reference shifts preserve this
result; incompatible or unknown members reject whole-cell caloric admission.
Reaction conversion still needs its existing physical reference correction.
Two shared kernel variants serve all admitted materials; no material/reaction
compilation, extra traversal, default caloric allocation or host readback is
introduced. Pressure remains byte-identical in the manufactured control.

576 focused tests pass (5 opt-in skips), with a separate final 32-test source-
family pass. Full regression passes 4,824 with 73 opt-in skips; build passes.
Serialized owned desktop-GPU commands pass 47 Node results, including ten new
caloric/source cases, seven existing mixture cases, the 65,536-row real pressure
consumer and seven paired-publication cases. New native evidence uses actual
cold packing, thermal/refresh, SS and published-owner paths, but manufactured
assignment/product inputs and a controlled no-motion publication, not real
chemistry or mechanics transport. It checks unchanged source bytes, final owner
retirement, exact rejection flags and only two pipeline variants. Preserve the
initial reentrancy red tests/full-run failure, invalid fixture model and fixture
arena exhaustion; fixes did not relax numerical or ownership acceptance.
Also retain the later full-v3 launcher exit143 despite its complete passing
TAP summary; that command is not itself a clean pass.

Final configured iron/ice and sodium/water desktop runs advance 17 and 8
committed sources over 45.565 and 45.570 wall seconds. All six original images
were inspected after owned Chrome closure: actual geometry changes without
preview-only output or browser errors. Dark/faceted water remains unaccepted;
no identified transported plume, material/refraction fidelity or 54 Hz follows.
All 633 frozen runtime/test/ABI/tool hashes remain identical.

Caloric admission is now integrated, but `exchangeIntervalAdmitted=false` stays
explicit. No phase/mass/energy writer or preset enrollment is added. Next build
the conservative exchange consumer with a matched physical interval, actual
residual-product debit, aerosol mass credit, energy/momentum accounting and SS
occupied-volume projection, then growth/evaporation, transport and deposition.
Do not fabricate a legacy mixed-phase plateau or a second latent-energy credit
to connect the explicit thermal models. Their gas-only H2 and ice domains and
the initial nuclei choice remain unresolved. G2 stays active, G1 failed/deferred,
and publication stays on hold.
[Evidence and limitations](/home/cos/.cache/icc/repos/ulg/g2-mixture-caloric-20260914-bhikZw/implementation-review.md).

## Latest checkpoint — SS gas inventory moments — 2026-09-14 UTC

G2 now preserves raw signed specific U, actual temperature and phase beside
each material/source address in the existing SS compact gas union. The shared
aggregate accumulates residual gas m/U/n/nT and temperature bounds in the same
cell loop and free-volume geometry. Partially placed reaction products count
only unplaced mass; fully placed products cannot double count their energy.
Invalid raw inputs and arithmetic overflow publish unavailable observations,
not fallback physical temperatures or zero-energy substitutes. The retained
compact ABI is 16 floats; legacy full-parity compact rows remain 12. An eight-
float moment buffer belongs to the same EOS arena. No extra production spatial
traversal, dispatch or host readback is added; the optional full oracle observes
the new buffer explicitly.

Post-mechanics closure and successor publication now privately bind the exact
carrier envelope and selected product-history handle/buffer, including absence.
The single-level path selects/promotes/merges that history once inside closure
and carries it unchanged into the envelope. Later failures retire only the new
logical history view, preserving borrowed inputs. Independent review caught
and resolved retained-stride metadata, species shader cache version and this
expanded failure-window cleanup. Raw-buffer compatibility does not become a
paired-envelope capability.

Final verification: 395 focused tests and 4,772 full-suite tests pass (4 and 72
opt-in skips respectively), with no failures; build passes. Three serialized
headed system-Chrome native commands pass 46 Node test results, including seven
new mixture cases, the real 65,536-row EOS/pressure consumer and seven paired
aerosol publication cases. Preserve the outer harness's first certificate-
verifier initialization failure before GPU setup; an unchanged repeat passed
with TLS verification enabled. The 628-file freeze remains identical.

Real-desktop iron/ice and sodium/water advance 18 and 8 committed sources over
45.590 and 45.562 wall seconds after the first source. Root inspected all six
original images after owned Chrome closure: actual changing geometry, no
control-body-only preview or browser error. Dark water/faceted surfaces remain;
these checks do not prove material fidelity, 54 Hz or an identified plume.

This is inventory groundwork, not caloric or exchange authority. Next bind the
published-successor read capability through actual EOS/fine-step leases, then
admit compatible material U references/Cv/molar masses and a matched physical
interval before equal-and-opposite vapor/energy exchange. Physical activation,
gas-following aerosol transport, deposition and traced plume acceptance remain
open. The requested nuclei choice is unresolved; do not invent it. G1 remains
failed/deferred, G2 in progress, and publication stays on hold.
Evidence: `/home/cos/.cache/icc/repos/ulg/g2-ss-gas-mixture-20260914-UO6ZxT/`.

## Current checkpoint - 2026-09-13 AKDT

The user has ended G1 as failed acceptance/deferred execution and moved on to
G2 after HTTPS and real-desktop cesium usability passed. Historical throughput
and mechanics prerequisites below no longer prescribe the current task order.
Do not restart the all-preset54Hz effort as a prerequisite for this work.

The first G2 slice adds a diagnostic-only GPU pass after the existing SS gas EOS
finalizer. It computes species contributions using `R sum(nT) / Vfree`, reading
the same admitted free volume and exact material/source identities. It never
substitutes represented parcel volume or a mole fraction of a non-isothermal
total pressure. Original product temperatures preserve the distinction between
actual and fallback temperature; mixed cells do not assert scalar equilibrium.
The uniquely admitted packed constant-latent-heat law can provide a labeled
reduced saturation inverse, not an IAPWS/database-calibrated material model.

The optional sidecar stays private to the retained EOS arena, allocates no GPU
resources when disabled, and exposes only an explicit 128-byte diagnostic
snapshot while its exact owner remains live. It changes no mass, phase,
enthalpy, mechanics pressure, spatial directory, or optics. Manufactured native
GPU checks pass 44 tests over 62 cases; actual producer/pressure-consumer native
verification also passes, including the 65,536-row workload. The test-only
identity revision and independent ordered-capacity volume expectations were
updated to the current existing contracts; earlier failed fixture runs remain
preserved. Full regressions pass4,342 tests with63 opt-in skips and no failures;
build passes. The four original-baseline scoped guards also pass. These are
bounded implementation checks, not completion of the full G2 plume oracle.

The next prerequisite now exists: a separate, privately owned sparse aerosol
inventory with exact u64 physical multiplicity, material/phase and nucleus
provenance. Its initial-condition importer requires explicit mass, density,
position, velocity, internal energy and physical population; it cannot label
new mass as a carrier transfer. GPU initialization derives radius from those
physical inputs. This is independent initial inventory, not a nucleation law.

The opt-in resident-summary path now appends source/terminal GPU reductions of
carriers plus aerosols to the same submission and compact readback. Totals cover
phase mass, momentum, first moment, internal energy and translational kinetic
energy. They do not prove constitutive, APIC, surface or field-energy closure.
Original carrier-only statistics remain separately available; carrier counts,
cohorts, displacement/J and MPM grid dispatch keep explicit carrier-only scope.
Absent aerosol families add no allocation, dispatch or readback. Failed queue
fences quarantine both readers and dependent resources until confirmed device
loss; release never substitutes for completed reads.

37 focused tests pass. The native kernel passes54 tests over49 manufactured
cases, including fixed-mass/fixed-population partition invariance and exact
u64 carry/overflow checks. The actual resident-summary native test also passes
on the real desktop, including an aerosol-only reservoir and independent
positions across successive observations. Its two earlier final-candidate
harness failures are retained: duplicate Vite HMR owner instances, then an
incorrect expectation about legacy summary readiness. Both were corrected in
the harness without runtime gate or numerical-tolerance changes.
The final combined native run passes55 tests. Full regressions pass4,379 with
65 opt-in skips on the unmodified repeat; build passes. Preserve the first full
run's single unchanged process-timeout-test failure (4,378 passes). Its isolated
file repeat also passed23 tests. This is intermittent evidence, not a suppressed
test or an aerosol numerical failure. All three original scoped guards pass.

The September13/14 extraction slice now performs a real GPU carrier debit,
retaining condensed liquid at the original gas-carrier position. It uses the
exact shared pressure-adjusted phase endpoints, authenticates prior pure-gas
input through the SS transaction, and produces a private, one-shot pair of
residual S/T/M plus aerosol inventory. No latent energy is added a second time.
An explicit already-activated physical population is required; this is not a
nucleation law. The reduced regime rejects nonzero affine C, solid/shear/surface
energy, invalid pressure provenance, ambiguous closure and degenerate residuals.
F/C/J are preserved; proof remains internal plus translational kinetic energy.

92 focused tests pass. The final serialized native desktop run passes80 tests:
24 extraction cases plus their parent test, and55 prior aerosol regressions.
Actual SS generation and the unchanged four-lane phase-transfer consumer are
used. GPU source bytes, mass, phase, momentum, first moment and tracked energy
are checked, including shifted pressure, signed energy, liquid-dominant donors,
physical-population/capacity changes and whole-batch rejection.
Preserve the first22-pass native run: review subsequently found missing carrier
source replay protection and adopted-pair loss cleanup. Both are now fixed and
tested. Source-generation admission prevents another aerosol owner or a second
transaction from debiting the same source again. Queue-fence failures quarantine
resources until confirmed loss. The old ABI exact-enum expectation was updated
for distinct extracted provenance; initial import still accepts initial mass only.

Next bind the pair into actual SS successor publication and the pre-transfer
closure. The local occupied-volume portion is implemented below; outer paired
publication is not. Preserve post-reaction /
pre-extraction S/T separately from residual pre-transfer S/T for optics. Newly
condensed extracted mass has not entered the prior optical subset: do not blindly
subtract it there; residual transfer input must omit its new condensation credit.
Already-credited extraction will need an explicit subset debit.
These connections, physical activation/growth, general energy partition,
gas coupling/deposition and source-traced iron/ice and sodium/water desktop
plumes remain open. No preset enables the isolated extraction API yet.
An isolated paired inventory is not the outer resident successor authority.
Full regression passes4,413 tests with66 opt-in skips and no failures
(168.956s); build passes. All three original fixed-baseline guards pass;
the helper-relocation notices remain documented, not suppressed.

The preceding local-occupancy slice seals an existing aerosol family (or absence)
in actual SS source transactions and retains its buffer before the first
consumer. Independent consumer reads and actual abort/confirmed retirement
preserve queue-fenced lifetime; failed retirement retains the owner. Ordinary
continuation and commit/private-advance receipts preserve exact family identity.
Unpaired replacement/drop remains forbidden. Successor/lane ownership beyond
this source-generation window still belongs to the pending paired publication.

A material-general optional scatter now adds raw aerosol m/rho to the existing
local B/A/W gas-free-volume path and actual EOS denominator. The exact family,
generation, capacity and GPU completion must agree; supplied uploads cannot
silently omit a known reservoir. No aerosol means no added GPU allocation,
dispatch or readback. 512 focused checks pass. The final headed native fixture
passes all26 cases, including one/two levels, wall and sparse support, partition
invariance, carrier+aerosol addition, owner release before first consumer and
invalid-input rejection. The115 serialized native/regression checks also pass,
including real extraction/phase transfer and65,536-row gas EOS. Preserve earlier
fixture failures: Vite module identity, wrong declared fine spacing, then an
incorrect diagnostic expectation about where that bad spacing first rejects.
Runtime gates and positive numerical tolerances were not relaxed.

Full regression passes4,445 with67 opt-in skips and no failures (177.396s);
build passes (2.08s). Actual desktop iron/ice passes basic geometry progression
15→287 over45.562 wall seconds; sodium/water's unchanged repeat passes63→575
over45.125 seconds. All originals were inspected after owned sessions closed.
Preserve sodium/water's first blank-scene failure: worker queue OperationError,
“A valid external Instance reference no longer exists.” Its cause is unresolved;
the passing repeat does not prove startup reliability. These short visual
checks establish neither54Hz nor source-traced airborne plumes. No preset yet
enables the isolated extraction API, and G2 remains open.

The current outer-publication slice now connects pending extraction to the
shared closure and actual successor owner. Real phase/refresh terminal outputs,
full classifier and an exact private publication window admit the carrier and
aerosol together; a commit alone, copied token or dropped old family cannot.
The new actual native integration passes three cases with fixed independent
mass/phase/momentum/first-moment and U+translational-KE budgets, plus unchanged
source bytes and exact next-SS-generation lease handover. The116 prior native
regression checks pass. Same-child published lanes share ownership until the
last retires; rejected transitions invalidate immediately but buffer disposal
and source reuse remain gated by the lower owner's actual consumer fence.

The first native post-commit retry failed because that lower fence was started
only after the classifier's fence. The runtime correction leaves classifier
retirement separate; the unchanged native test now passes. Preserve both runs.
Distinct actual post-reaction and residual pre-transfer optical inputs are now
wired; at that checkpoint combined state/thermo reaction mutation plus requested
extraction was unsupported and rejected before extraction allocation. Lineage-wide
reaction birth can double credit extracted mass; blindly subtracting extracted
mass can instead erase unrelated retained-carrier birth. Next implement exact
donor-resolved optical accounting alongside admitted activation/energy exchange,
then gas coupling, growth/evaporation and conservative deposition.

No preset yet enables this new population. Current iron/ice and sodium/water
owned desktop checks show actual changing geometry without preview/error, but
not source-traced airborne plumes or verified material fidelity. Six originals
were inspected after Chrome closed; source manifests stayed unchanged. Final
full suite4495PASS68SKIP0FAIL and buildPASS. Preserve the initial incomplete
exit143 run and the second full run's two eager thermal import-cycle failures;
cached lazy default thermal/reaction module loading fixes those without
changing physical kernels or private claims.105 focused checks and five fresh
entry orders cover the correction.117 final-source native checks pass across
the combined run and unchanged isolated repeat; a pre-GPU HTTPS connection
failure remains recorded. The bounded parcel-owner item is complete; admitted
activation/energy exchange is next. Full G2 acceptance stays open.
Evidence: `/home/cos/.cache/icc/repos/ulg/g2-outer-condensate-20260914-G5WqYB/implementation-review.md`.

### Current donor-resolved optical checkpoint — 2026-09-13 AKDT

The combined-path rejection above is now removed behind exact donor accounting.
The private pending owner supplies unique cold lineage addresses, not GPU mass
or material readback. Capture excludes the extracted gas-address donor's liquid
of its actual post-reaction material from both pre/post sums and route choice.
This preserves older retained D and unrelated birth; it is not general debit
of a previously credited subset. Both residual buffers and snapshotted particle
identity/revision authenticate the capability. Omission, copies, torn pairing,
source substitution, consumption and abandonment reject. The64-byte public
evidence header and existing dispatch counts are unchanged.

89 focused tests pass;118 final serialized native/regression checks pass. The
actual outer integration preserves its three old cases and adds three positive
manufactured optical cases (14kg,210J tracked energy, D=2/2.5/2.5kg) plus an
explicitly rejected mixed-material capture case. Real extraction, phase transfer,
optics and paired publication are tested; reaction/thermal inputs are
manufactured and no aerosol optical admission or full chemistry is claimed.
Full suite4507PASS68SKIP0FAIL; buildPASS. Preserve the initial revision-expectation
failure and native headless-adapter/wrong-default-origin failures. The optional
headed harness switch and correct HTTPS URL resolve those test setup cases;
runtime arithmetic and positive tolerances were not relaxed.

Actual desktop iron/ice and sodium/water show changing isosurfaces over45.488
and45.564 wall seconds. All six originals were viewed after owned browser
closure; no preview/page error occurred and frozen sources match. No identifiable
detached plume, water-refraction fidelity or54Hz acceptance follows. No preset
yet enables extraction. Activation needs matched-time species partial pressure
and declared nuclei; existing diagnostic-only pre-thermal pressure cannot be
silently promoted. Growth/evaporation must conserve mass and coupled energy,
including noncondensable heat capacity when temperature changes, without a
second latent-energy credit. The background-nuclei default is awaiting the
user's choice. Activation, transport/deposition and full G2 remain open.
Evidence: `/home/cos/.cache/icc/repos/ulg/g2-donor-optics-20260914-wd2AY9/implementation-review.md`.

### Explicit caloric reference work — 2026-09-13 AKDT

The activation audit found a pre-existing energy-convention limitation, not a
new render regression. `cpJPerKgK` contains Cp in some constructors and Cv in
others; the legacy ladder also uses latent enthalpy as an internal-energy
proxy. Its total-pressure equilibrium map would reassign a correctly cooled
vapor on a subsequent thermal/reaction pass. Existing diagnostic and extraction
proofs remain valid for their declared reduced model; they cannot establish
closed-cell physical condensation under a different energy convention.

The next bounded implementation is an explicit constant-Cp, ideal-vapor,
incompressible-liquid reference record with declared basis, provenance and
temperature/pressure limits. Phase-specific U/T continuation and equilibrium
pressure derive from the same Gibbs potentials, including the liquid pressure
correction. The isolated rigid-cell CPU reference includes every participating
noncondensable's Cv and prospective liquid volume, conserves signed phase
energy without a second latent credit, and refuses phase creation without an
activation model. It is not a live SS proposal, a kinetic growth law, calibrated
water data, or authorization to adopt its output into a carrier/aerosol owner.
No preset or legacy energy buffer is changed by this reference implementation.

Actual adoption still requires phase-specific thermal/reaction continuation,
authenticated mixture endpoints for extraction, and current successor SS
occupancy plus complete residual product gas. Aerosol B→(A)→W occupancy affects
multiple cells; the isolated-cell volume equation must not replace that
projection with a single vapor-owner-cell debit. All these requirements remain
inside the open activation/energy item. Nuclei choice, transport/deposition,
and full desktop transported-plume acceptance remain open; G1 stays deferred.
Verification:28 focused CPU tests pass, including independently selected
coexistence endpoints, Gibbs/Clapeyron identities, inert heat capacity, signed
energy-zero invariance, dry-interface rejection and explicit phase inversion.
Full suite4535PASS68SKIP0FAIL; buildPASS. Root reviewed all six original images
after both real-desktop browser sessions closed: iron/ice advances15→287 over
45.558 wall seconds; sodium/water63→511 over45.606. Geometry changes, no preview
or browser error, and all562 frozen source/ABI/test hashes match. No detached
plume, water-refraction fidelity, new GPU phase-continuation proof or54Hz
acceptance follows. The earlier test-only rejection-status failure is retained.
Next: consume the explicit phase-specific caloric evaluator in the actual
thermal path and prove supported cool vapor survives real consecutive
thermal/transfer/refresh ticks without energy rebasing or phase relabeling;
then connect matched-time conservative species exchange and physical activation.
Evidence workspace: `/home/cos/.cache/icc/repos/ulg/g2-activation-energy-20260914-WGmFjS/`.

### Actual phase-specific thermal consumer — 2026-09-13 AKDT

The explicit model now compiles two independent liquid/gas caloric responses
through the existing graph/table bindings. Type3 identifies this domain; it
does not overload pressure-law lanes or add material-specific kernels. CPU
and actual classic/canonical GPU thermal selectors, reachable energy bounds,
temperature inverses and final writers use the same exact pure phase. Invalid
or mixed phase/U input fails closed instead of selecting the old global
equilibrium ladder. f32 compilation checks finite spans, Cv precision and
endpoint temperature error without changing the energy origin.

Explicit table/graph/response contents must agree before upload. A cached
reaction upload must also match its device and the resolved response content.
Reaction chemistry still cold-rejects explicit caloric tables: its energy
contract has not been migrated. At that checkpoint the initial particle packer
also still used the old equilibrium mapping. No preset is enrolled, no old live U is
rebased, and no new condensate extraction or physical activation is admitted.

Native acceptance for this slice is fresh same-basis canonical phase lanes
through actual retained thermal -> phase transfer -> mechanics refresh, twice
without heat, followed by known wall and reciprocal pair exchange. General
multi-donor merge calorics, reaction/product energy, matching current SS
species exchange, physical activation, aerosol transport and deposition remain
open. G1 stays failed/deferred. Frozen-source verification passed: 22 new CPU
checks, 88 existing focused regressions, all 26 native observations, and the
full suite (4557 pass, 69 opt-in skips, no failures); build passed. The native
test includes genuine admitted canonical spatial work, analytic reciprocal
heat, and distinct spatial-source versus caloric-domain rejection. Two earlier
fixture/assertion failures are preserved; no numerical tolerances were relaxed.

End-of-slice iron/ice and sodium/water desktop checks advanced through 17 and
8 committed sources over 45.074 and 45.090 wall seconds, respectively, with
no browser errors. Both owned Chrome sessions closed before all six original
screenshots were reviewed. Geometry visibly advances rather than remaining
in the control-body preview. Dark/reflective material appearance remains an
unaccepted fidelity limitation; no identifiable transported steam, species
identity, or 54 Hz presentation acceptance follows from these captures.

Next: matching reaction/product caloric authority and genuine current
successor SS mixture state before conservative phase exchange, followed by
physical activation, gas-coupled aerosol transport/deposition and plume proof.
No existing live energy buffer or preset has been converted to the new model.
Evidence: `/home/cos/.cache/icc/repos/ulg/g2-caloric-thermal-20260914-sGnAsv/`.

### Shared cold phase-caloric initialization — 2026-09-13 AKDT

The actual SPH and MLS particle packers now accept the same explicit
`condensableThermodynamicsByMaterial` option as the thermal table. A particle
must declare exact pure phase/fractions in `phaseCaloric` and already carry U
in that model's energy basis. The state constructor/clone preserve this
declaration; missing or string-valued U is not silently turned into zero.
Both packers share one phase-specific selector, the thermal compiler's f32
domain checks, and reference density/volume. Material Cp, molar mass and phase
reference densities must agree with the declared model. The vapor Cp-minus-R
calculation must also retain a positive Cv consistent with the declared model
within the compiler's existing 1e-4 relative budget; matching f32 Cp/M alone
does not protect a near-cancellation case. No legacy live U is
converted, no phase is inferred from U, and ordinary unmarked legacy seeds
keep their existing behavior.

The two packed inputs carry a deterministic caloric-row/Cp/molar-mass
consistency declaration. Thermal CPU/GPU entry checks it against the actual
table rows and model metadata, and mechanics refresh checks SPH/MLS agreement.
This is cold-input consistency, not authentication of arbitrary unmarked raw
ABI fixtures. Host/preset enrollment and full chemistry remain unimplemented.
Native acceptance for this slice starts with the real constructor and both
real packers/uploads, then uses retained thermal/refresh buffers for known
heat pulses. It does not reuse manually authored thermal/particle rows as
evidence of initial packing.

An independent reaction audit confirmed why the type3 guard must remain:
the existing reaction scalar is a reduced heat proxy, and all products receive
one specific U despite different material energy origins/Cv. The next chemistry
slice needs explicit reference phases/T/P, physical DeltaH-to-DeltaU conversion,
runtime energy-zero correction, and common product temperature with each
product's own phase-specific U. Direct and unplaced products must share the
same complete state/extent law. This uses the existing thermal response graphs,
not a parallel caloric framework. Reaction reference-data comparisons remain
scientifically advisory; missing units/energy authority are runtime input
contract errors, not a new scientific release blocker.

Verification completed for this bounded checkpoint: 103 focused initialization
tests; full Node suite 4,660 pass / 70 opt-in skip / 0 fail; ordinary build pass;
and the real-desktop native initialization test passed with actual packers,
two retained thermal/refresh cycles, independent heat-pulse expectations and
an unchanged legacy-only GPU control. The first native run exposed the old
sampled iron thermal graph's 0.137 K constructor/inverse difference; the test
now compares the retained iron row to an independent legacy-only execution,
not a relaxed temperature tolerance. A later raw-module fetch failure occurred
before GPU work; both that failure and the unchanged-source successful retry
are retained. Final source manifest is `sources-v3.sha256` in the evidence below.

Final-source iron/ice and sodium/water checks produced 17 and 8 committed
sources over 45.131 and 45.125 wall seconds after their first source, respectively.
Both owned desktop Chrome sessions closed before all six original screenshots
were reviewed. Geometry visibly deforms/spreads, with no page/console errors
or control-body preview lock. Dark/reflective materials remain unaccepted;
these captures do not prove transported steam, species identity, or 54 Hz.

The cold initializer's gas sound speed uses the actual seed temperature, but
the existing mechanics refresh table still uses a fixed phase representative
temperature. The native artifact exposes that older limitation (168.857 m/s
initially versus 7,162.485 m/s after refresh in the manufactured gas case).
This slice verifies phase/U/reference-volume continuation, not a physically
temperature-correct gas constitutive refresh. Preserve this gap for the shared
G2 gas-state work; do not treat the native pass as full mechanical validation.

Evidence and the detailed reaction migration audit:
`/home/cos/.cache/icc/repos/ulg/g2-caloric-initialization-20260914-3pj1vM/`.
G2 activation/energy exchange, successor SS mixture state, physical nuclei,
transport/deposition and transported-plume acceptance remain open. G1 stays
failed/deferred and publication remains on hold.

### Reference-corrected reaction products — 2026-09-14 UTC

The actual reaction-table builder and CPU/GPU apply path now support an explicit
reference-energy mode. Its declared phases, temperature, pressure, signed
DeltaH or DeltaU per mole of extent, and source provenance are mandatory. The
compiler checks atom/charge balance and the packed stoichiometric mass budget;
DeltaH becomes DeltaU using gas RT and finite condensed PV. It reuses the exact
existing pure-phase caloric graph samples, appended as data to the existing
reaction buffer. There is no reaction/material-specific kernel or second fit.
The private authority rejects copied/stale tables and inconsistent optional
thermal graphs before GPU allocation. Unenrolled legacy heat-proxy behavior is
unchanged; the type3 rejection is lifted only for a completely enrolled table.

Products share a solved temperature but retain their own material/phase U.
The balance uses actual consumed/product masses, each material's reference U,
the declared chemical DeltaU and relative translational kinetic energy.
Formation/latent offsets are not credited twice; external reaction heat is
zero. The same generic GPU evaluator feeds direct products and full unplaced
records (mass, U, T, phase, COM velocity and support volume). Positive-dt extent
uses the existing interface-flux law. Nonzero representable reactant remainders
are retained rather than erased by the old free-slot epsilon. Product/remainder
reference mass and represented entities follow their actual mass.

The first admitted domain is deliberately limited: two distinct reactant
carriers, exact pure solid/liquid/gas caloric graphs, fixed declared product
phases, and relaxed F=I/C=0/J=1 sources. Mixtures, plasma, non-monotone or
out-of-domain calorics, unknown reference conventions and unaccounted elastic
or affine kinetic energy do not silently fall back to the legacy proxy.
Direct products retain their parent positions, preserving the existing
position-invariant reaction boundary; unplaced products use consumed COM
position. This is not full mechanical/free-energy/chemical-rate validation.
Gas product mechanics and subsequent refresh still use the older static phase
representative constitutive table. Temperature-correct gas constitutive
refresh remains an explicit shared G2 prerequisite before preset enrollment.

Independent CPU tests pass88 cases, including energy-zero shifts, embedded
formation offsets, latent changes, finite PV, inelastic COM energy, partial
products, nonzero remainders, invalid live state and five mocked GPU-entry
preallocation refusals. Real-desktop native GPU checks pass eight manufactured
cases plus two retained thermal continuations, including moving reactants,
positive-dt fully unplaced products, tiny remainders and rejected reactions.
Both parents' full live thermo records are checked before writes. Non-finite
partner entity counts and debits too small to change an f32 carrier mass leave
the pair and all product ledgers unchanged. Relabeled species metadata is also
rejected. These counterexamples have actual CPU and native regressions.
Apply, product/atom/gas diagnostics and product-event publication agree that
an unchanged rejected pair creates no product mass. The atom diagnostic now
reads committed next-state/thermo, requiring two additional diagnostic-only
bindings; the existing width assertion also checks their exact buffer identity.
The first native run caught a reserved WGSL identifier; it is fixed and that
failed artifact is preserved. The first full suite also caught a structural
ABI assertion and a new eager-import initialization cycle. An equivalent free
slot expression and cached execution-time summary authority import fix those
without disabling tests. Numerical bounds and scientific criteria were not
relaxed. The final full suite passes4,748 tests with71 opt-in skips and no
failures (194.397s); ordinary build passes (1.68s), with chunking warnings.

Real-desktop iron/ice and sodium/water checks used the exact same572-file
runtime/test manifest as the final native test. All three owned browser
sessions closed, sources stayed frozen and no final-run browser/GPU errors
were reported. Main inspected all six original preset screenshots after both
preset sessions closed: actual meshes change beyond the preview, with17 and8
distinct sampled committed sources respectively over45.6 wall seconds. This
is basic liveness only, not54Hz. Metal remains angular and the dark-background
captures do not establish quantitative refraction or a transported condensate
plume; G2 visual/domain acceptance stays open. See `visual-review.md` beside
the implementation review for exact screenshots, limitations and observations.

No preset or live legacy U has been migrated. Current successor SS mixture
state, complete residual gas heat capacity/occupancy, conservative phase
exchange with admissible physical activation, transport/deposition and genuine
source-traced desktop plumes still remain. G2 activation/energy exchange stays
in progress, not complete; G1 and the publication hold are unchanged.
Evidence: `/home/cos/.cache/icc/repos/ulg/g2-reaction-energy-20260914-49X4Ku/implementation-review.md`.

### Current-temperature gas carrier mechanics — 2026-09-14 UTC

The shared constant-Cp ideal-gas sound-speed law now evaluates actual carrier
temperature before numerical scaling/capping/flooring. Initialization, reaction
direct/unplaced product birth, phase transfer, mechanics refresh, and extracted
gas residuals use the same data-driven JS/WGSL law. This fixes representative-T
clamp rescaling, the reaction builder ignoring CFL, and the initial particle
packer ignoring an explicitly supplied CFL option. Kernels remain material- and
scenario-agnostic; no reaction/latent-energy convention was changed.

One versioned vec4 law per phase is appended after the existing 12-float phase
prefix, preserving bindings and legacy offsets. Strict tail validation, upload
identity, private reaction-energy snapshots, watch admission, persistent cache
round trips, and scene signatures cover the new bytes. Physical reaction-energy
capabilities are not serialized as reusable disk authority. Unknown trailing
data and stripped version metadata reject, rather than selecting static c.

Condensate extraction occurs before final mechanics refresh. It therefore
checks c against either the exact pure-gas predecessor T or the current
post-reaction T, then publishes current-T c in the conserved gas residual.
These two derived-state witnesses do not substitute for existing source
lineage/phase/energy authority. A general pre-extraction mechanics refresh would
incorrectly give a liquid-dominant mixed donor liquid mechanics. Native tests
cover both witnesses, liquid-dominant donors and third-temperature rejection.

Frozen-source desktop-GPU checks pass for initialization/retained refresh,
reference-corrected direct/unplaced reaction products, two actual thermal
continuations, and 29 extraction/phase-transfer tests. Both configured iron/ice
and sodium/water desktop runs progress using committed true isosurfaces, with
all six original captures reviewed after owned Chrome sessions closed. These
are basic rendering/progression checks; neither short run establishes a
transported plume, quantitative refraction, or the deferred G1 throughput goal.

Final v4 verification: 317 focused integration tests and the full Node suite
(4,761 pass, 72 opt-in skips, zero failures), plus the ordinary build, pass.
All four targeted desktop-GPU commands were rerun sequentially against the
final 626-file source freeze and passed (32 Node tests including extraction
subtests); every owned browser closed and source hashes remained unchanged.
The v3 desktop images precede only the final legacy-count compatibility,
watch-error diagnostic and test-fixture corrections, not a shader or material
change. Exact legacy combined prefixes may omit a redundant count; typed
tails and the narrower authorized-watch domain still require exact counts.
Initial full-suite/native failures and the independent source review are
preserved in the evidence directory, not overwritten as successful runs.

The remaining next slice is current-successor SS mixture/constitutive state:
complete residual gas m/U/n/nT and free-volume accounting, then matched-time
conservative activation/exchange and gas-coupled aerosol transport/deposition.
Local/cross-level SS field drag still uses representative c because its field
view has no authenticated current-T moment; this carrier fix does not claim
that boundary is corrected. Nuclei selection is still an explicit physical
model choice, not permission to invent a population. G2 remains in progress;
G1 remains failed/deferred and the publication hold is unchanged.
Evidence: `/home/cos/.cache/icc/repos/ulg/g2-gas-constitutive-20260914-S6Y2Ms/`.

Artifacts: `/home/cos/.cache/icc/repos/ulg/g2-species-saturation-20260913-25W0TJ/`.
Initial-aerosol checkpoint:
`/home/cos/.cache/icc/repos/ulg/g2-aerosol-authority-20260913-S1KBx8/`.
Conservative extraction checkpoint:
`/home/cos/.cache/icc/repos/ulg/g2-condensate-extraction-20260914-exWZA0/`.
Existing-family SS/local-volume checkpoint:
`/home/cos/.cache/icc/repos/ulg/g2-resident-aerosol-20260914-2SQ7WB/`.

## Historical checkpoint - 2026-09-04 AKDT

Goal 2 remains open. Conserved phase-transfer/reaction-born condensed mass now
feeds an authenticated resident optical sidecar and one material-general
participating-volume renderer. Its optical state is not inferred from a gas
label or scripted opacity. Pure vapor and condensed collective routes remain
distinct; ordinary material surfaces use their own route.

The desktop canonical water-cycle run reached 4.608 simulated seconds and
showed vaporization/recondensation with negligible mass drift, but did not show
a convincing transported steam plume. A follow-up shared render fix excludes
the sidecar's matching condensed mass from bulk geometry without changing the
physics ledger; mixed phases, other materials, and motion-smear re-sampling are
covered by focused tests and a native GPU metamorphic test.

The present compact-sphere-per-carrier morphology is a declared reduced model,
not an unresolved droplet population closure. Droplet number/size evolution,
airborne versus bulk deposition, and direct long-horizon plume evidence remain
required work. The historical reduced CPU descriptor work below does not prove
those resident microphysics requirements, and this plan must not be archived
on renderer readiness alone.

### Mechanics prerequisite: current uncommitted QCV slice

The ordered quadratic basis-capacity dual is now implemented on the GPU:
forward W/WA condensed volume and matching W-transpose/A-transpose pressure
share one immutable sealed geometry descriptor. Supported halo nodes,
translation, thin cells, sparse ambient pressure, and parent work identities
are covered by 66 native geometry cases plus actual pressure/mechanics route
and malformed-authority tests. The earlier clipped-dual and nearest-wall-fold
candidates remain rejected; neither conserves the required wall capacity.

The external pressure sign is corrected against an independent native gas-
potential derivative. Subsequent compact GPU evidence identifies the remaining
Cs/F macro-26 rejection: a 1.76-microgram quadratic field receives a vertical
pressure increment about 162.64 m/s from 45.54 kPa effective gauge. The velocity
is already excessive immediately after pressure, before later grid stages.
This does not establish equally fast or unsafe particle motion.

The diagnostic reads only one selected 256-byte packet plus fixed headers,
checks exact macro/substep/field/moment/scratch identity, and captures before
G2P clears rejected counts. Default runtime remains readback-free. Its 22 native
cases, four combined GPU tests, 3,509 Node tests (58 skipped) and build pass.
The fresh post-sign sodium run passes 24 x 128 steps (3.072 s); all 24 sampled
mechanics receipts admit, and inspected frames 15-18/24 lack the old jump.
Final products: 3.65577 kg NaOH and 0.09213 kg H2. Not a plume or full-energy proof.

Do not land the slice yet: the repeated six-default desktop sweep passes five
presets; Cs/F has only its first accepted frame. All eleven available PNGs were
inspected. Bulk-water/dam-break visible throughput is 114.22/115.49 Hz; true
isosurface throughput is still much lower and is not cadence-gated.

The actual S9/pressure/G2P single-particle fixture now passes nine cases with
all 27 mechanics nodes and 64 populated gas cells. It distinguishes bounded
particle/affine motion under a divergent nodal tail from a true zero-COM affine
fold, captures signed external work separately from APIC energy, and asserts
position advection. One 256-byte GPU packet per case uses the shared production
trial-F helper with retained C and fixture F; it is not pre-cap-local capture.
Next mechanics evidence must gather actual rejected Cs contributors and the
2:1 transfer. Measure full particle velocity and raw C/F/J before caps, not only the largest grid speed.
The grid maximum is sufficient but not necessary for particle stability;
finite pressure-tail kinetic work and APIC transfer energy still require
accounting. Any new certificate must preserve phase/full endpoints on both
levels and successor states, including clipped-support behavior. No clamps,
tiny-mass exclusions or endpoint bypass. Source gas inventory and coupled
thermodynamic energy closure remain separate questions.

Artifacts under /tmp/ulg-goal2-qcv-integration-Pd6GTb/:
cesium-field-pressure-v3/summary.json, sodium-long-post-sign/summary.json,
desktop-six-post-sign/summary.json and its SHA-bound eleven-image review,
native-pressure-diagnostic-all.log, full-tests-post-sign-diagnostic.log and
build-post-sign-diagnostic.log. Earlier sign RED/GREEN remains retained.
Goal 2 remains open.

2026-09-04 user-visible correction: user confirms faint clouds only in sodium/
water, possibly smoke, with a screenshot at 3.072 s. Keep the observation, but trace
the producing material/phase/parcel before claiming completed transported mist.
Iron/ice is an explicit required plume case, not satisfied by hot-solid glow.
The user has reopened Goal 1 for >=54 visibly advancing frames per wall-clock
second on ALL presets, including true isosurfaces, not UI rAF or sim-time rates.
Before expanding Goal 2 mechanics diagnostics, restore worker material/refraction and
color-output fidelity and diagnose triangular depth/overlap artifacts. The
worker's simplified alpha lighting has no existing native refraction path;
changed appearance is not scientific validation. Isosurface updates remain
0.4-0.6 Hz at that checkpoint. That full sweep is 4/6 (Cs and bulk-water cadence fail), while
an isolated water repeat reaches 112.97/104.80 Hz. Preserve both sets of evidence.

The subsequent user-approved Goal 1 reset prioritizes observable motion before
further mechanics diagnostics. A shared retained GPU velocity field now drives
bounded presentation-only true-isosurface deformation. Desktop sodium cropped
recordings show 372 pixel changes in 10.091 s versus 3 in 10.088 s before;
this is not a 54 Hz pass. The new all-six sweep has five advancing screenshot
pairs, Cs still failing after its first frame, and no all-preset pixel-cadence
acceptance. All eleven available images inspected. Materials remain regressed;
the early water/iron/sodium screenshots do not verify transported steam or
smoke. See the current implementation status for evidence and queue/optics next
steps. All microphysics and actual-Cs follow-ons below remain preserved.

### Next resident microphysics slices (not yet implemented)

After the mechanics prerequisite, resume the following sequence. The existing
reduced constant-latent-heat carrier closure can supply a clearly labeled
saturation diagnostic; do not imply IAPWS calibration or silently assume an
isothermal mixed gas cell. Any pressure/volume compatibility solve must still
use admitted Tait/corotated response and reconcile gas work, signed particle
energy and constitutive energy ownership.

The current four-lane transfer merges each lineage's target-phase mass into
one position/velocity. A single liquid lane therefore cannot represent both a
bulk pool and spatially separate airborne fog. Adding a smaller optical radius
would not repair that transport mismatch.

1. Derive species partial-pressure and saturation diagnostics on existing
   SS-owned gas cells. Use vapor-species moles and free volume, not total mixed
   gas pressure, for supersaturation. Keep this first slice diagnostic-only.
2. Introduce an admitted sparse aerosol parcel family with conserved mass,
   physical droplet multiplicity, position, material/phase and nucleus
   provenance. Derive radius from mass, density and multiplicity; SPH sample
   count and molecular entity count are not droplet count. Include this mass
   in global phase/energy reductions before moving it out of bulk carriers.
3. Add material-general activation/growth with equal-and-opposite vapor,
   aerosol and latent-energy deltas. Nuclei population is an explicit
   environmental input; homogeneous nucleation requires a declared kinetic
   closure. Missing physical inputs must not manufacture a cloud.
4. Couple airborne motion to the carrier gas with a declared drag/slip validity
   domain. Classify direct bulk condensation and subsequent aerosol deposition
   through an admitted interface witness, preserving mass/momentum/energy.
5. Prove parcel-count invariance at fixed mass/multiplicity, no spurious
   activation, phase/energy conservation, gas-following motion, bulk deposition,
   and a real desktop transported scattering plume. Stochastic coalescence and
   higher-order size spectra can follow this minimum coherent slice.

This proposed representation follows the physical-multiplicity and coupled
growth/transport approach of [Shima et al.](https://arxiv.org/html/physics/0701103v2),
not one rendered sphere per simulated material sample. Its first low-inertia
regime must be declared rather than assumed for all particles. For water,
[Petters and Kreidenweis](https://acp.copernicus.org/articles/7/1961/2007/acp-7-1961-2007.html)
provides a candidate hygroscopic activation closure, and
[IAPWS saturation properties](https://iapws.org/technical-guidance/release/Supp-sat)
provides a reference thermodynamic function. These are design inputs, not
claims of implemented or scientifically calibrated runtime behavior.

## Purpose

Make water, ice, water vapor, and visible steam render from phase-resolved
optical closures instead of collapsing to similar clear/transmissive surfaces.
The goal is not to fake a white cloud. Pure H2O vapor should remain nearly
invisible; visible steam should appear only when the low-level thermodynamic and
microphysical chain predicts condensed droplets or aerosols that scatter light.

## Current Behavior

- H2O particles carry material identity `h2o`.
- The render descriptor maps H2O gas to `renderKey: steam` and `phase: gas`.
- `opticalRenderParams()` and the WebGPU optical table are keyed by
  `material|phase`, so liquid and gas are not intentionally sharing one cache
  row.
- The vapor optical closure sets IOR near one, low opacity, high transmission,
  and a long attenuation distance. That is physically reasonable for pure water
  vapor, but it makes steam look too similar to clear water in the current
  MarchingCubes/PBR bridge.
- The missing piece is a condensation/nucleation/droplet scattering closure.

## Target Model

Optical closure identity must include:

- material/formula,
- phase,
- temperature,
- pressure,
- density,
- phase fractions,
- path length,
- particle or droplet size distribution,
- mixture composition,
- generator/method hash.

For H2O:

- solid ice: transparent dielectric with ice IOR, lower absorption, optional
  grain-boundary scattering when microstructure exists;
- liquid water: dielectric with liquid IOR, Beer-Lambert absorption and
  path-length tint;
- water vapor: dilute gas with near-unity IOR and weak absorption, normally
  almost invisible;
- visible steam/cloud: two-phase mixture of vapor plus condensed droplets, with
  Mie/Rayleigh scattering derived from droplet radius distribution and liquid
  water mass fraction.

## Implementation Plan

### 1. Phase/Thermodynamic Optical Cache Keys

- Extend optical cache keys beyond `material|phase|pathLength` to include the
  state fields that can change optical response:
  - temperature,
  - pressure,
  - density,
  - phase fractions,
  - mixture/droplet summary,
  - generator fingerprint.
- Keep material-only fallback rows only for coarse UI placeholders; strict SPH
  render rows should use material-phase-state keys.

### 2. Condensation And Droplet Closure

- Add a derived H2O microphysics closure:
  - saturation vapor pressure from thermodynamics,
  - supersaturation ratio,
  - nucleation/condensation trigger,
  - condensed droplet mass fraction,
  - droplet radius distribution or effective radius,
  - evaporation when local state returns below saturation.
- The closure may be reduced at first, but it must be driven by temperature,
  pressure, H2O vapor mass, air/gas mixture state, and available condensed
  nuclei. No scripted white alpha.

### 3. Scattering Optical Response

- Add a visible-steam optical model:
  - Mie scattering for droplets when radius is comparable to visible
    wavelengths,
  - Rayleigh limit for very small droplets,
  - absorption from liquid H2O path length,
  - phase function/asymmetry and extinction coefficient,
  - PBR mapping to base color, transmission, opacity, roughness, scattering, and
    attenuation.
- Pure vapor should keep low opacity and high transmission.

### 4. Runtime State Plumbing

- Add per-particle or per-gas-cell microphysics fields:
  - H2O vapor mass fraction,
  - condensed droplet mass fraction,
  - effective droplet radius,
  - local pressure,
  - local temperature,
  - phase fractions.
- Feed those fields into optical table construction and, later, the resident
  WebGPU render-field path.
- Cache derived optical rows by state buckets so the renderer does not rebuild a
  unique optical row for every particle every frame.

### 5. WebGPU Residency

- Extend the optical GPU table/query ABI with state-bucket ids or compact
  microphysics rows.
- Run the optical lookup on GPU-resident render rows so phase/microstructure
  changes do not require heavy JavaScript table rebuilding.
- Read back only compact diagnostics:
  - vapor mass,
  - condensed droplet mass,
  - mean droplet radius,
  - optical depth,
  - scattering coefficient,
  - cache hit/miss/stale counts.

## Acceptance Tests

- Liquid H2O and H2O gas produce distinct optical cache keys and distinct optical
  GPU records.
- Pure vapor remains nearly invisible at low droplet fraction.
- Supersaturated vapor with derived condensed droplets produces a visible white
  scattering volume.
- Increasing droplet mass or path length increases optical depth through the
  derived scattering model.
- Cache invalidation rejects optical rows when phase, state bucket,
  microphysics, path length, or generator hash changes.
- Browser e2e can distinguish:
  - liquid-water transmissive surface,
  - pure vapor weak/clear surface,
  - condensed steam/cloud scattering surface.

## First Slice

1. Add state-bucketed optical cache keys and tests for H2O solid/liquid/gas.
2. Add a reduced condensation droplet summary derived from saturation state.
3. Add CPU optical response for droplet scattering and pack it into existing PBR
   fields.
4. Add WebGPU table/query fields for the droplet/scattering summary.
5. Add browser diagnostics that report pure-vapor vs condensed-steam optical
   mode.

Status, 2026-06-12:

- Items 1-4 are implemented as a first reduced slice. H2O gas descriptors now
  carry a bucketed sealed-box vapor optical state derived from temperature,
  total pressure, H2O partial pressure, saturation pressure, condensed mass
  fraction, droplet radius, vapor/condensed density, droplet number density,
  and scattering coefficient. The optical CPU cache key handles nested/string
  state fields, and the optical GPU lookup output ABI now exposes optical
  depth, scattering coefficient, absorption coefficient, and optical-state id.
- Browser diagnostics now indirectly cover the wider lookup row and derived
  material-property path through the SPH Playwright smoke. A more explicit UI
  readout for pure-vapor versus condensed-steam optical mode is still pending.
- Remaining runtime work is to move the microphysics state into resident
  per-cell/per-particle GPU data and gate vapor surface visibility from derived
  optical depth/scattering rather than from the `steam` render label.

Status, 2026-06-12 08:12 AKDT:

- Vapor surface visibility is now gated by derived optical response. Gas-phase
  H2O surfaces remain geometrically hidden when optical depth and droplet
  scattering are below the visibility threshold; condensed droplet steam remains
  visible from the Clausius-Clapeyron droplet-scattering closure.
- The same visibility gate runs for CPU particle batches and resident
  render-field surfaces, while the existing grace-frame hysteresis still
  prevents abrupt flicker when vapor crosses the threshold.
- Remaining runtime work is to move the microphysics state into resident
  per-cell/per-particle GPU data and add an explicit UI readout for pure-vapor
  versus condensed-steam optical mode.

## Non-Goals

- Do not fake steam as a hard-coded white transparent material.
- Do not make all gas-phase H2O cloudy by default.
- Do not reuse one material-level optical closure when phase and microstructure
  differ.

Status, 2026-07-06:

- The explicit pure-vapor vs condensed-steam UI readout is implemented: the
  mounted status panel now shows `steam optics : <key>=<mode>(tau=.. sigma=../m
  shown|hidden)` where mode is condensed-steam / optically-thick-vapor /
  pure-vapor-thin, derived by resolveOpticalSurfaceVisibility. It reads Three
  mesh userData on the MarchingCubes lanes and the retained
  drawState.surfaces metadata on the native WebGPU consumer lane, and reports
  `no-gas-surfaces` when no gas-phase surface exists.
- Live checks: 430K water base and the Fe(1900K)->ice quench both report
  no-gas-surfaces at short horizons (steam appears later in the quench chain);
  the readout mechanics are covered by mount tests. A longer-horizon browser
  check that catches condensed-steam mode live is still worth one run.
- Remaining runtime work is unchanged: move microphysics state into resident
  per-cell/per-particle GPU data so the vapor gate reads GPU-resident state
  under no-full-readback instead of CPU descriptors.
