# Interface resolution: refine carriers where a phase front is unresolved

Date: 2026-11-14.

**User decision:** "increase the resolution at the interface because we want
to support that kind of dynamic functionality and if it tanks our frame rate
we implement the second method", where the second method is an interface
boundary law. Also "make honest walls that aren't infinite sinks", which is
done; see "Honest walls" below.

## Why

A carrier has one temperature for its whole volume. Where a hot body touches a
cold one across a material interface (molten iron on ice or water, sodium on
water, cesium in fluorine), the real heat transfer is confined to a thermal
boundary layer much thinner than the carrier.
- That layer reaches the phase-change temperature (boiling or melting) at
  once, while the carrier's bulk does not.
- At the current resolution (5 mm, 0.115 g meltwater parcels) the front is
  smeared over the whole parcel, and nothing boils.

This is general: any phase front sitting inside a carrier is unresolved. The
fix is first-principles resolution, not a scenario law.

## Criterion (general, material-agnostic)

A contact pair (i, j) **has an unresolved phase front at i** when:
- i and j are different materials, or the same material in different phases;
- a phase-transition temperature T* of i's material (melt or boil, from i's
  own phase response ladder) lies strictly between T_i and T_j;
- the pair is within contact support.

Such a row gets refine pressure **reason bit 32**
("shock-or-high-gradient-pressure", already reserved in
`SCHROEDER_PHASE_VOLUME_REFINE_PRESSURE_REASON_BITS`). The reason then flows
into the existing split proposal.

**Stopping rule.** Refinement stops at a minimum carrier size. The natural
first-principles bound is the thermal penetration depth over one step,
δ = sqrt(α·dt). Splitting below δ cannot resolve anything more. The level
floor is a second bound.

## Where it plugs in (existing SS machinery)

- **Detection.** The SS thermal proposal stage already enumerates contact
  pairs with both temperatures and materials. It writes a per-row
  phase-front flag into a sidecar.
- **Migration.** `ss_pvm` phase-volume migration (`ulg-gpu-abi/src/wgsl.js`
  around line 18265) ORs that flag into `refine_pressure_reason_mask` as bit 32
  and counts it as an integrity refine. Today only bits 1|2 force a split.
- **Splitting.** The existing pipeline does it: the
  `schroeder-phase-volume-split-merge-proposal`, then `-apply`, then the
  particle-storage allocator, free list, slot assignment and materialization.
  Mass, momentum and internal energy are conserved; children share the
  parent's specific state, with positions spread inside the parent volume.
  - Open residue in the SS plan (2026-07-06): a live end-to-end run where a
    split actually fires has never been exercised. This work is that
    exercise.
- **Merging back.** The existing `bulkCoarsen` merge proposals recombine
  children once the front has passed (no flag for N steps), so carrier count
  is bounded.

## Gates

- **Native unit:** a hot iron carrier touching a 273 K water carrier sets the
  flag on the water row (T_sat = 373 K is between them). Water at 350 K
  touching water at 360 K does not.
- **Conservation:** mass, momentum and energy are bit-exact before and after
  a split and a merge on the ledger route.
- **Live Iron Ice:** meltwater at the iron contact splits; split children
  reach T_sat and produce H2O gas. Carrier count stays bounded and the frame
  rate is measured.
- **Fallback:** if the frame rate collapses, implement the interface boundary
  law (the user's second method).

## Finding (2026-11-14, late): refinement cannot resolve the front, so use the fallback

**The scale analysis.**
- A carrier is a lumped thermal body. That is valid only when its Fourier
  number αt/L² is at least about 1.
- For a 5 mm water parcel, α = 1.4e-7 m²/s and L = 2.5 mm give
  Fo ≈ 0.022·t, so the lumped model is wrong for any contact shorter than
  about 45 s.
- To get Fo ≈ 1 for a 0.1 s contact, L must be about 0.12 mm. That is 40×
  finer in edge, or about 64,000× more carriers per parcel.
- The thermal boundary layer over one step, sqrt(π·α·dt), is about 21 µm at
  dt = 1 ms.

Splitting carriers cannot reach that scale. This is far past "tanks the frame
rate", so per the user's rule the second method applies: an interface law.

**A separate blocker for the split pipeline on the worker lane.** Phase-carrier
v2 uses fixed-stride lanes (`phaseLane*phaseLaneStride+lineageIndex`). The page
path's split/merge appends children and changes the count, which breaks that
addressing. On the worker lane a split would need a reserve of spare lineages
(the reaction product pool is the precedent). The dynamic-refinement
capability stays open as its own item.

## The interface law: skin-first phase partition (Stefan condition)

**What it does.**
- The pair heat across a contact is unchanged: the existing series law
  R = (a_i/2)/(k_i·A) + (a_j/2)/(k_j·A), so both sides see the same energy.
- What changes is where that heat lands inside the receiving (or losing)
  carrier.
- The contact face sits at T_if = (G_i·T_i + G_j·T_j)/(G_i + G_j), with
  G = k·A/(a/2).
- If one of carrier i's own transition temperatures T* (from its response
  ladder) lies strictly between T_i and T_if, the front sits at the face:
  - the bulk can conduct only G_i·(T* − T_i)·dt away from it;
  - the excess E is latent work on the skin;
  - the skin mass m = E/(u_target − u_pre) leaves as the next phase at T*;
  - the remaining mass keeps the rest of the carrier's energy.

**Why it is general.**
- No scenario constants: k, a, T*, u_target and the ladder all come from the
  material bank.
- It covers boiling and melting.
- In reverse it covers condensation and freezing at a cold face.
- It is energy- and mass-conserving by construction.

**Where it runs.**
- **SS thermal proposal derive:** each carrier's adjacent fronts (T*, target
  energy, target phase) go into derived words 10..14.
- **Pair pass:** each row's skin energy goes into module-private
  accumulators, published once per traversal into derived words 15..19,
  stamped (epoch << 3) | target phase. The epoch is in params byte 92.
- **Canonical apply:** unchanged; it applies the full pair energy.
- **Phase-carrier transfer (f32):** reads the rows on binding 9. A row is
  used only when its stamp matches the epoch of the proposal the apply
  consumed. A single-phase carrier splits into its own phase (remainder) and
  the target phase (skin at T*) inside `phase_aggregate`. Evidence word 8
  counts conversions.
- **Exact phase-carrier stage:** not wired. Exact routes keep the full energy
  in the bulk, as before.

**Expected Iron Ice effect.** About 0.26 W of latent per iron→water pair
(0.33 W measured average, minus about 0.07 W bulk capacity). Over 40 pairs
that is about 10 W, or roughly 4 mg/s of steam, within the film-boiling range
for ΔT ≈ 1,400 K over 1.2 cm².

### First live runs (2026-11-14, night)

**Collapse with centre-born vapor.** Iron Ice (rigid ice and molten iron,
`sdt=0.001`) ran at about 24 steps/s until the iron landed at about 1.28 s
sim. After that it decayed to about 3, then 0, steps/s.
- The worker could not answer a paused readout within 300 s, so its GPU queue
  was backed up.
- GPU stage timing (`&residentGpuTimestampProfile=1`) put the contact solver's
  **matching-cleanup owner at 212 ms per step**. Every other stage was about
  2 ms.

**A/B:** the same run with the transfer given no front stays at 8–16 steps/s
after landing, and the readout works. So the conversion's output caused the
collapse.

**Cause.** Each step created about 1e-10 kg of vapor at the liquid carrier's
own centre: distance 0, overlap about 2.9 mm, mass ratio about 10⁻⁶. The
contact owner kept fighting it in every boiling lineage.

**Fix.**
- The vapor is born where physics puts it, at the contact face.
- The proposal also accumulates a skin-energy-weighted face offset, in
  derived words 20..22 (the row is now 24 words). Each face splits the centre
  line in proportion to the half-edges, the same split the series law uses.
- The transfer places the converted component at x + offset and shifts the
  remainder by −m_c·offset/(m − m_c), so the lineage's first moment is exact.

**Native gate:** `tests/sphPhaseCarrierInterfaceFront.native.test.mjs` checks
mass, momentum, energy, first moment, face placement and epoch gating. It
passes.

### The real cause: gas carriers inflated the contact query (general)

Face birth alone did not fix the collapse.

**What the 1.30 s census showed.** It stops just as meltwater first reaches
the iron. Steam is forming: 5 H2O gas rows (2.46 mg, up to 792 K) from
5 meltwater rows (0.57 g at 274 K). The law works.

**Why it stalled.** At its rest density each gas row is about 0.5 mg in
about 8 cm³, a diameter of 11+ mm, and it grows as the gas heats.
- The contact graph's support reduction fed **every** mechanically active
  row into the global maxima: diameter in word 0, swept displacement in
  word 1.
- The mixed-law query radius is (1 + 2·trust)·max diameter
  + 4·max displacement + 2·max wall projection.
- So one steam carrier turned every liquid and solid source's query into
  the whole scene. That is O(N²) cursors in the matching-cleanup owner.
- Yet the graph and the solver reject every class-0 (gas) pair, so those
  diameters could never reach an admitted pair.

**Fix (general; it affects any scene with gas carriers, such as water-cycle
steam).**
- Only pair-capable rows (liquid and solid, classes 1 and 2) feed words 0
  and 1.
- Word 2 (wall projection) still covers every active row, because it also
  gates the zero-edge solver path.
- No admitted pair changes.

### Steam forms; what it costs (2026-11-15)

**The census at 1.76 s** (face birth plus the contact-maxima fix; the probe
readout loop is now bounded):

| Kind | Rows | Mass | T max |
|---|---|---|---|
| H2O gas | 6 | 2.64 mg | 805 K |
| H2O liquid | 21 | 2.4 g | 273.9 K |
| H2O solid | 7 | 0.5 mg | 273.2 K |
| Fe solid | 109 | 7.4 g | 1,811 K |
| Fe liquid | 216 | 25.7 g | 1,850 K |

- **The steam gate's first half is met:** meltwater at the iron contact
  produces H2O gas.
- Production slows once the iron sinks into the pit it melts.
- The meltwater stays near 273 K: the iron's heat goes to boiling, and the
  233 K rigid ice refreezes some of it. Both are physical.

**Cost: contact convergence.**
- **Contact-audit A/B over 1.14–1.7 s** (`S0_CONTACT_AUDIT=1`, with the new
  `S0_RING_SKIP_APPLIES=900`):
  - Without the conversion, contact fails ITERATION_INCOMPLETE on 22% of
    steps in bursts during the landing, then recovers.
  - With it, contact fails on every step from about 1.34 s, and the receipt
    stays READY|FAIL_CLOSED (status 10).
- Graph sizes are the same either way (42–56k candidate visits), so this is
  solver non-convergence, not a graph blow-up.
- Thermal proposals publish on only 142 of 577 steps.
- The rate falls to about 4–8 steps/s after landing, against 8–16 without
  steam.
- The leading hypothesis: tiny refrozen ice components (about 7e-8 kg)
  beside 1e-4 kg iron, a stiff mass ratio for the Jacobi solve.
  A warm-ice run (268 K) discriminates it from steam forcing.

### Root cause of the contact failure: free condensed slivers (2026-11-15)

**Controls run** (contact audit, 1.14–1.6 s; "fail" is the share of steps
with ITERATION_INCOMPLETE):

| Run | Fail | Note |
|---|---|---|
| Cold ice, no law | 22–30% | bursts, then recovers |
| Cold ice, law on | ~75% | persistent from ~1.33 s |
| Warm ice (268 K), no law | 23% | bursts, then recovers |
| Warm ice, law on | 100% | — |
| Law, 1 atm ambient | no change | bit-identical: the knob never reached this route |
| Law, gas targets only | persistent | — |
| Law, condensed skins nested | persistent | early burst removed |

**Mass distribution at 1.36 s.**
- **Law on:** the smallest solid iron carrier is **1.8e-12 kg**, and the
  smallest H2O ice 1.6e-8 kg.
- **Law off:** the smallest solid iron is 7.4e-7 kg, and there is no H2O
  ice.

**Cause: free condensed slivers.**
- A condensed skin (here, liquid iron freezing against colder solid iron)
  converted into an empty lane, nucleating a free solid carrier of about one
  step's skin, about 1e-12 kg, beside 1e-4 kg neighbours.
- The Jacobi contact solve cannot converge at a 10⁸ mass ratio.
- Once contact fails closed, thermal stops publishing, so the sliver never
  goes away. The failure sustains itself.

**Fix (physical).** A freezing or melting skin deposits onto condensed
matter that is already there.
- A condensed-target conversion is admitted only into a non-empty lane whose
  carrier touches the face.
- An empty condensed lane means no conversion; the energy stays in the bulk,
  conserved.
- Boiling into an empty gas lane stays allowed: gas never enters contact.

**Still open:** 1.6e-8 kg H2O ice slivers come from the existing equilibrium
plateau split (`SPH_PHASE_COMPONENT_ACTIVATION_EPSILON = 0` materializes any
positive fraction). That is the same nucleation question, in pre-existing
code.

### Status at the end of the night (2026-11-15): steam forms; contact stalls after it

**Delivered and gated.**
- **The interface skin law.** Gas is born at the face. Condensed skins only
  deposit onto a co-located existing carrier of the same lineage, never
  nucleating a free carrier.
- **Gas excluded from the contact-query maxima.**
- **Gates:**
  - the native gate `tests/sphPhaseCarrierInterfaceFront.native.test.mjs`;
  - the transfer-arithmetic hash guard, which now enumerates the extension
    and still matches the pre-edit baseline;
  - the host suite.
- **Probe fixes:** a bounded receipt loop, `S0_RING_SKIP_APPLIES`, per-kind
  min/max mass, and contact residual, pair and energy fields.

**Live, cold ice.** Steam appears from about 1.25 s and reaches about
3.4 mg by about 1.4 s. Then it stops.

**Open: persistent contact non-convergence after steam forms.**
- From about 1.33 s, every step fails ITERATION_INCOMPLETE. The solver
  aborts before measuring (residual and energy words are 0).
- The pair graph is identical step after step (the same 42,586 or 45,788
  pairs), so the configuration is frozen.
- Thermal stops publishing with it, so nothing changes. Without the law,
  failures are bursty and recover.
- **Ruled out by A/B:**
  - gas pairs;
  - the query-radius inflation (now fixed anyway);
  - free iron slivers (fixed);
  - H2O ice slivers (warm ice still fails);
  - centre-versus-face birth.
- **Not tested:** a valid 1 atm ambient. `&ambientPressurePa=101325` is
  bit-identical to vacuum, so the knob does not reach this worker route.
  Gas pressure is ambient-referenced in P2G
  (`c²(ρ − ρ_rest·p_amb/101325)`), so that plumbing gap matters.
- **Next steps:**
  1. Plumb the explicit ambient to the worker route and rerun at 1 atm, the
     experiment's real boundary condition.
  2. Find which constraint the owner cannot close: trace the rows that are
     still active at budget exhaustion.
  3. Decide (user) whether a failed contact step should keep holding the
     lane state.

### Resolved: the stall was contact pass-budget exhaustion plus hold-on-failure (2026-11-15)

**Owner-flag capture** (new probe ring of the cleanup-dispatch flags, failing
steps only). The rows the owner cannot settle are one pile: 25–29 solid
iron, 51–75 liquid iron and 7–12 meltwater rows, with 12.5k–17.7k active
cursors.
- That is well under the owner's admission cap, so this is cleanup-pass
  budget exhaustion. The interactive demo budget is 512; the batch budget
  of 1024 is documented as covering a measured ~890-pass Iron Ice worst case.
- The flagged set is identical from step to step: a failed step holds the
  lane on the same input, so a budget shortfall becomes a permanent stall.

**`&contactCleanupPasses=2048`:**
- no contact failures over 1.14–1.6 s; 329 of 340 thermal proposals publish;
- **steam keeps forming: 15 rows, 20.2 mg, up to 948 K at 1.6 s**, against
  3.4 mg stalled at 512 passes;
- no ice or iron slivers;
- the cost is about 2–8 steps/s during the steam phase (the owner is
  serial).

**So the interface law was correct.** The fixes it needed were general:
- gas out of the query maxima;
- no free condensed nucleation.

**The remaining work is A1 contact-solver liveness and speed:**
1. A failed contact step must not hold the lane forever. For example, retry
   the step with an escalated budget, or publish the partially converged
   result. This is a user decision; it touches the sealed solver budget.
2. Make the owner converge in fewer serial passes.

### Long run at 2048 passes: device lost at 3.07 s (2026-11-15)

`plume4s-2048`:
- zero contact failures through the steam phase;
- the rate fell from about 8 to about 1 step/s as the pile grew;
- at 3.07 s sim the worker lane failed closed
  (`schedule-terminal-gpu-fence-unsatisfied`), and the console reported
  "A valid external Instance reference no longer exists": the GPU device was
  lost;
- no Xid in the kernel log.

A 2048-pass budget keeps contact exact but makes each steam-phase step one
very long serial owner chain, so it is not sustainable.

**Conclusion.** The interface law works and steam forms. A sustained Iron Ice
plume is blocked on the **A1 contact owner**:
- it needs ~1000–2000 serial passes per step once the iron/meltwater pile
  forms;
- the interactive budget is 512;
- on exhaustion, it fails closed and holds the lane.

**Decisions for the user:**
1. **Failure policy.** Keep fail-closed (exact, but a stall on a hard pile)
   or publish the partially converged state and keep converging next step
   (live, but contact is approximate for that step).
2. Invest now in the owner's serial-pass convergence (the known A1 wall).

### At the evidence-rule dt (0.5 ms): steam forms and the run keeps moving (2026-11-15)

All the stalls above were at `sdt=0.001`. The G2 rule says Iron Ice evidence
runs at dt 0.5 ms; at 1 ms the CFL cap makes moduli 4× softer and the pile
compresses.

**At 0.5 ms with the law and the default 512-pass budget:**
- **to 1.5 s:**
  - zero contact failures (999 of 999 published) at 23 steps/s;
  - the iron spreads across the floor and no ice has melted yet;
- **to 2.9 s:**
  - **steam: 11 rows, 11.1 mg, up to 879 K**, from 1.25 g of meltwater at
    276 K;
  - an average of 19.3 steps/s;
  - contact fails on 39% of the late-window steps but recovers (no freeze).
- The steam stays at the ice surface (y 18–19 mm) because the scene is a
  vacuum (no buoyancy).
- The preset's "steam rises into the headspace" checkpoint needs the
  experiment's 1 atm boundary condition; that run is next.

### 1 atm at dt 0.5 ms: the ambient arrives, but the steam does not rise (2026-11-15)

**The run.** `dt05-skin-3s-atm`, `&ambientPressurePa=101325`, measured to
2.88 s:
- the readout of the scene's resolved evidence shows
  `ambientPressurePa` = 101325, source `explicit-ambient-pressure-option`,
  `explicitVacuumAmbient` false, and
  `ambientBuoyancyMode: field-local-s9ab-current-volume-ambient-source`, so
  the knob works;
- **state at 2.88 s:** steam 11 rows, 10.9 mg, up to 880 K, still at
  y 18–19 mm, with the same vMax as the meltwater (0.208 vs 0.209 m/s).
- Earlier `ambientPressurePa` runs at dt 1 ms were near-identical for the
  same reason: gas pressure uses the CFL-capped sound speed (about 1 m/s
  here), so ρ_ref barely changes it.

**Why it does not rise.** A tiny-mass gas carrier inside condensed matter
takes the grid velocity, which the dense water and iron dominate (a single
velocity field). Buoyancy cannot make it slip upward through them.

**Next for the "steam rises" checkpoint:** gas–condensed relative (slip)
transport, a two-fluid drift velocity for gas carriers. It is separate from
the interface law. Candidate home: the SS phase-volume pressure-drag
operator (`schroederSpatialPhaseVolumePressureDragOperatorWgsl.js`).

**`&ssPhaseVolumeMigration=1` at dt 0.5 ms, 1 atm.** Effectively identical
to the run without it (steam 11.09 vs 11.14 mg, same positions, steam vMax
equal to the meltwater's).
- The gas/condensed pressure-drag transport (S9-A/B/C,
  `schroederSpatialPhaseVolumePressureDragOperatorWgsl.js`) is built in the
  two-level substep path (`phaseVolumeTransportAuthorityRequired` in
  `schroederHierarchyGpu.js` ~16390).
- Iron Ice's single-level worker route runs only the surface-stress stage,
  which reports `ambientBuoyancyMode: field-local-s9ab-current-volume-ambient-source`.
- **Open:** why buoyancy does not separate the gas there. Either wire the S9
  transport into the single-level worker route, or run Iron Ice two-level.
  This is the remaining work for the preset's "steam rises into the
  headspace" checkpoint.

### Why the steam cannot rise yet: no slip transport on the single-level route (2026-11-15)

**What the single-level worker lane runs** (Iron Ice, dt 0.5 ms, 1 atm,
2.48 s; probe `evidence.ambient` walker):
- the law activation receipt shows `phaseVolumeMigration` and
  `phaseVolumeSidecars` true;
- `phaseVolumeMigrationStatus` is submitted;
- surface stress submits 16 of 16, with
  `ambientBuoyancyMode: field-local-s9ab-current-volume-ambient-source`;
- **no** gas/condensed transport, drag or slip stage exists on this route.

**Where that transport lives.** The two-level authoritative path
(`phaseVolumeInterfaceTransportEnabled: twoLevelAuthoritative`,
`schroederHierarchyGpu.js` ~20926).
- Iron Ice under `&ssTwoLevel=1&schroederTwoLevelAuthority=authoritative`
  fails closed at step 1: "private compact header is not admitted and has no
  complete physical rejection witness" (`schroederFusedFineSubstepGpu.js`
  ~4580, the cross-level reflux admission).
- That is before any gas exists and in code this work did not touch, so it
  is pre-existing.

**The two paths to the "steam rises into the headspace" checkpoint** (both
architecture work; user's choice):
1. Wire the S9 gas/condensed pressure-drag transport into the single-level
   worker route, reusing
   `schroederSpatialPhaseVolumePressureDragOperatorWgsl.js`.
2. Make the two-level authoritative route admit Iron Ice, by diagnosing the
   reflux header rejection.

**Single-level cannot simply enable it.**
- `sphMlsMpmGpuStep.js` hard-codes `phaseVolumeInterfaceTransportRequired: false`
  in three places (~28194, ~37463, ~39463).
- The epoch transaction refuses the S9-C interface proposal outside two-level:
  "Read-only phase-volume interface proposal authority requires authoritative
  two-level mechanics" (`schroederSpatialEpochTransaction.js` ~2691).
- Option 1 therefore means lifting that design restriction. Single-level
  epochs would build and authenticate the S9-C artifacts, and the grid
  update's transport authority would consume them.
- That matches the A′ direction: generalize the canonical worker lane rather
  than keep a separate route.

### Two-level authoritative on Iron Ice: rejected at step 1 (2026-11-15)

The S9-C proposal is inherently cross-level: it needs fine and coarse S9-B
receipts plus the parent-field CSR. So option 1 would be a redesign of the
transport, not lifting a gate, and option 2 (make two-level admit Iron Ice)
became the path tried.

**The rejection message now names its failing conditions.**
`schroederFusedTerminalRefluxHeaderRejections` in
`schroederFusedFineSubstepGpu.js`; module tests 11/11.

**Iron Ice under `&ssTwoLevel=1&schroederTwoLevelAuthority=authoritative`**
(dt 0.5 ms, 1 atm):
- `statusFlags=0x204` (failClosed | phaseRejected), `invalidCount=2`,
  `mutationRollbackCount=3`;
- positivity, CFL and mass/CoM status all 0, i.e. not evaluated after the
  fail-closed;
- the flags exclude routeRejected, so the phase-volume transport's own
  `phase_transport_reject` is not the source;
- the candidates are the plain phase rejections in
  `schroederSpatialParentFieldMechanicsWorkspaceWgsl.js`. Most of them
  (~6555, ~6665, ~7588) fire when the coarse field receipt is not admitted at
  `FIELD_RECEIPT_HEAT_BUILDING` for the expected mutation ordinal (workspace
  reason 37). That fits mutationRollbackCount=3. The ordinal checks at ~5110
  are the other possibility.

**Flaky startup.** Three later runs never accepted Play and posted no
rejection text. One of them had the solid lane disabled
(`S0_DISABLE_SOLID_LANE=all`), so that bisect is inconclusive. The two-level
route is unreliable to even start on this scene; diagnose the startup first.

**Next.** Find which coarse-field mutation in the Iron Ice two-level step is
not announced to the receipt ordinal: rigid-lane coupling, gas EOS producer,
or surface stress are the suspects. Read the workspace reason word, or bisect
by disabling the solid lane (`S0_DISABLE_SOLID_LANE=all`).

### Two-level on Iron Ice, bisected (2026-11-15, latest)

**New instruments.**
- `globalThis.__ulgTwoLevelRefluxRejection` holds the full rejection in the
  render worker; the probe reads it when warmup fails.
- The page-facing error message stays short. A long one, or one carrying
  certain labels, did not reach the page and the lane appeared to hang.

**The full rejection.**
- statusFlags failClosed|phaseRejected; with the full two-level knob set it
  is failClosed|keyRejected|phaseRejected.
- `invalidCount` 2–3, `mutationRollbackCount=3`, **`rS=9`** (G2P receipt
  "skip" rejects: the field receipt never reached ENERGY_READY).
- No fine substep is committed or consumed.

**Control.** `cesium-fluorine` (the shipping two-level preset) steps in the
current tree (96 steps to 0.048 s), so two-level works and the failure is
specific to Iron Ice.

**Iron Ice fails identically with:**
- the solid lane disabled;
- surface stress off (`lawst=0`);
- vacuum ambient;
- the full Cs/F knob set (`schroederMaxLevel=1`, `MechanicsFieldPairV2=1`,
  `CrossLevelCoupling=0`, 2 substeps);
- the softened CFL (`cfl=0.8`, `cflSafety=0.2`);
- a matched base spacing (`schroederBaseGridSpacingM=0.001158`).

**Next.** Read the workspace's first reject reason (`ws_reject(…, reason)`;
reason 37 = the coarse receipt is not admitted at HEAT_BUILDING for the
expected mutation ordinal). Compare Iron Ice's fine/coarse population
(rigid-release meltwater lineages, Fe solid/liquid lanes) against Cs/F.

**Workspace-level evidence** (probe `workspaceHeaders`: the header counters
of each `…-arena-N-workspace`; temporary per-site and per-conjunct bit tags,
since removed).
- The failing workspace sits at `phase=1` with every dispatch word and count
  zero, so it never built.
- `invalidSourceCount=5` comes only from the two coarse-publish sites
  (`begin_coarse_terminal_validation` and its sibling ~7588). Their failing
  conjuncts are only "workspace not admitted at PHASE_PREDICTORS" and
  "reflux not accumulating". These are downstream symptoms; the coarse
  receipt itself is fine (HEAT_BUILDING, ordinal 2).
- `registryRejectCount=0` in that arena, yet the reflux reports keyRejected.
  Only `reject_reflux_registry` sets it, so the root rejection happened in
  an earlier macro attempt, or another workspace, before a retry reset this
  one.
- **Next:** capture the workspace header per attempt (on the first
  fail-closed), not after the retries.

**First failing attempt** (reflux tail words, now in the worker diagnostic
global):
- `statusCaptureSentinel` is untouched, so no `prepare_reject` fired;
- `expectedOperationCount=3`, `capturedOperationCount=0`,
  `transactionMutationToken=1`, `mutationRollbackCount=3`,
  `receiptSkipRejectCount=9`.
- So all three fine-substep operations were attempted and rolled back, and
  none applied. Each G2P claim found the fine field receipt before
  ENERGY_READY.
- **The root is one layer down:** the fine-level grid-update energy receipt
  never reaches ENERGY_READY for Iron Ice under two-level.
- **Next:** read the fine mechanics field view receipt (status and phase) on
  the first attempt. The probe's existing `traceBuffers` (canonical field
  authority trace) or a field-view header copy can do this.

**Instrument gap.** `observeSpatialAuthority=1` readbacks do not fire on the
two-level path. `S0_COUNT_FROM_START=1` together with the warmup-failure
summary captured no field traces. The next layer, the fine field view's
receipt status and phase on the first attempt, needs that instrument
extended to the fine/coarse field views of the two-level macro.

### ROOT CAUSE: two-level rejects Iron Ice because its coarse level is empty at t = 0 (2026-11-15)

**The instrument.** `S0_WORKSPACE_TIMELINE=1` snapshots every
`…-arena-N-workspace` header after each of the first 400 queue submits; the
probe prints the first fail-closed snapshot.

**The first failure.** At submit 0 after workspace creation, status is 0x10F
and `registryRejectCount=1`.
- `fineFieldCount=125`, `parentFieldCount=48`, **`coarseFieldCount=0`**.
- `begin_registry` treats `coarse_count == 0` as a key/phase rejection,
  `reject_reflux_registry(REFLUX_KEY_REJECTED | REFLUX_PHASE_REJECTED)`
  (`schroederSpatialParentFieldMechanicsWorkspaceWgsl.js` ~1669).
- Everything else seen earlier (G2P skip, rollbacks, the terminal-validation
  sites) is downstream.

**Why the coarse level is empty.**
- At t = 0 the only live carriers are the 2.8 mm iron carriers, all on the
  fine level.
- The coarser 5 mm meltwater lineages, released from the rigid ice, are
  dormant (zero mass) until the ice melts.
- So the macro fails at step 1, never steps, and the coarse level is never
  populated.
- `cesium-fluorine` works because its two bodies have different pitches, so
  both levels are live from the start.

**General fixes (pick one; architecture):**
1. An empty coarse level is a valid degenerate macro: fine-only substeps,
   with nothing to reflux. The registry, terminal and G2P paths admit
   `coarse_count == 0` instead of failing closed.
2. Per-schedule route selection: run two-level only while both levels hold
   live carriers, single-level otherwise. This is the law-activation
   pattern.

**Trial of option 1 (admit an empty coarse level), reverted.** Relaxing the
two `coarse_count == 0` rejections (workspace init ~1567, `begin_registry`
~1669) lets the workspace build and reach PHASE_PREDICTORS: 448 restricted
edges, 32 active fields. It then fails at:
- `begin_cross_level_phase_volume_admission` (~3082);
- `begin_fine_velocity_correction` (~3971). Its checks
  `ws_load(67u) == fine_substep_ordinal + 1` and `reflux_accumulating()`
  assume coarse dispatch words and a registry-initialized reflux phase,
  neither of which exists with no coarse rows.

**Map of the remaining degenerate-case work:**
- reflux phase initialization without coarse rows;
- coarse dispatch shape words (66–68);
- phase-volume admission;
- the coarse terminal (receipt consumption: `coarseReceiptConsumeCount === 1`);
- the JS admission predicate.

Each needs its conservation argument re-checked (an empty coarse level
carries no mass, momentum or energy, so its reflux terms are exactly zero).
This is a systematic protocol change, not a patch.

**Refinement of the option 1 map (read-through, no further edits).**
- `registry_coarse_dispatch_shape_admitted` already accepts count 0 with a
  (0,0,0) shape. The design anticipates an empty coarse level in places; the
  workspace-init (~1567) and `begin_registry` (~1669) rejections are the
  inconsistent spots.
- `seal_registry` with zero rows passes its coverage checks
  (0 == coarse_count) and would set ACCUMULATING.
- Workspace word 67 is the fine-correction **preparation token**
  (`ws_store(67u, ordinal + 1u)` ~6373, the last word of the preparation),
  not a dispatch dimension, during correction.
- Correction: the registry seal is a direct (1,1,1) dispatch
  (`schroederSpatialParentFieldMechanicsWorkspaceGpu.js` ~2576), so it runs.
  The trial's registry was not rejected (word 87 = 0).
- The trial's first real failure is **site 6, `begin_cross_level_phase_volume_admission`**,
  whose fine-field and receipt checks run before the preparation that writes
  token 67. Site 7 (`begin_fine_velocity_correction`) is downstream: the
  token was never written.
- **Next:** split site 6's conjuncts (the same per-conjunct tagging used for
  the terminal validation) on the trial build, and continue the iteration
  with `S0_WORKSPACE_TIMELINE=1`.
- Gate every change on `coarse_count == 0`, so non-empty-coarse scenes such
  as `cesium-fluorine` stay bit-identical.

**Option 1 iteration, round 3** (trial build: the empty coarse level
admitted at the init and `begin_registry` sites; reverted after each run).
- Site 6 (`begin_cross_level_phase_volume_admission`) fails only on its fine
  checks.
- The fine receipt itself is right: phase 3 (HEAT_BUILDING), ordinal 2,
  matching the expected 2.
- But `fine_admission_mask = 0x10004`:
  - bit 2: the fine field status is not READY_ADMITTED (the receipt status
    reads 5);
  - bit 16: fine word 59, the state encoding, is not FIELD_VELOCITY.
- So the fine field is still momentum-encoded and failed closed: the fine
  substep's grid update or transport failed the fine field view when there
  are no coarse rows.
- **Next instrument:** snapshot the fine mechanics-field-view header (status
  plus reject counters) per submit, like `S0_WORKSPACE_TIMELINE`, to name the
  stage.

**Round 4, the failing pass named.** Per-pass fine (level-0, arena-0)
field-view status, from the probe's `passStatus` under
`S0_WORKSPACE_TIMELINE=1`.
- The status goes 0 → 3 (READY_ADMITTED) after the field-pair finalize, then
  **3 → 5 (fail-closed) at pass 72, `ulg-mls-mpm-grid-update-mechanics-field-sequence`**,
  and 13 two passes later.
- In two-level this sequence runs with
  `phaseVolumeInterfaceTransportRequired: true`, so it includes the S9
  gas/condensed transport (stage, validate, commit). That transport consumes
  fine and coarse S9-B receipts; with an empty coarse level the coarse half
  is empty.
- **Leading hypothesis:** the transport fails closed on the empty coarse
  receipt. It is the same transport the steam needs to rise.
- **Ruled out:** this session's A1 direct-dispatch change. The same trial
  with field consumers forced to indirect dispatch (temporary source switch,
  reverted) fails identically at pass 72.
- **Next:** read the transport scratch or receipt evidence from that pass
  (field consumer words 60..62 and the transport scratch header), then decide
  what an empty-coarse transport should do (no coarse partner, so no
  cross-level exchange; fine-local only).

## Honest walls (done, 2026-11-14)

**What changed.** Fluid wall exchange is now Q = k·a²·(T_wall − T)/max(d, a/2),
applied only while the carrier touches the wall.
- k is the carrier's selected phase conductivity, from the response
  conductivity sidecar bound at slot 13.
- a is the cube edge of its rest volume.
- The change is in `ulg-gpu-abi/src/wgsl.js` and in `runSphThermalStepCpu`.
- `wall_rate` is now only the on/off gate (the wall reservoir authority).

**Before.** A fixed 6e4 W/K per carrier within h of a wall, 10⁵–10⁷ times
conduction, made every wall a thermostat.

**Tests.** Updated to the conduction law: six-wall heat equals the formula,
no overshoot, and the ingress ULP tests. Native canonical thermal passes.

**Effect on presets.** Water-cycle's 400 K floor and 200 K ceiling now act at
conduction rates, so its boil and return stages slow to physical times.

## Honest walls, part 2: finite heat capacity (2026-11-15)

**Why.** Conduction-limited exchange (part 1) removed the 6e4 W/K
thermostat, but every face still held a fixed temperature, so it remained an
infinite reservoir. Each face is now a finite lumped body:
T_face += Q_face / C_face every step.

**Model.**
- `wallModel = 'finite-heat-capacity-lumped-face'`, in
  `thermalEnvironmentAuthority.js`.
- C = ρ·c·A·t of a declared wall material and thickness, from that
  material's own reference data (`sphWallFaceHeatCapacitiesJPerK`).
- Default container: `fe` (steel), 2 mm. Iron Ice's 0.14 m faces get about
  139 J/K each; the 10 m reference box gets 707 kJ/K.
- The authority carries `faceHeatCapacitiesJPerK`, `wallMaterial`,
  `wallThicknessM` and an `instanceId`. The id survives structured clone and
  keys the GPU state, which a scene reset or a wall-temperature override
  starts fresh.

**GPU, no readback** (`src/runtime/sph/sphFiniteWallStateGpu.js`).
- One 64-word state per wall instance: face T, T0, C, pending energy, and the
  exact cumulative energy.
- The cumulative energy is a signed 64-bit count of 1 µJ quanta (two u32 words
  with carry), and the face temperature is always T0 + total/C.
- **Why not incremental.** A per-step increment (sodium-water's floor gets
  about 6e-7 K per step) is far below one f32 ulp at 293 K, so a running
  `T += E/C` never moved.
- **Why not Kahan.** A compensated f32 sum was tried, and the driver folded
  the compensation away.
- The fluid thermal kernel's finite variant (`sphThermalStepFiniteWallWgsl`,
  binding 14, a text transform; the default kernel is byte-identical) and the
  rigid-solid thermal stage (binding 10) read live face temperatures through
  a GPU copy into their uniform params. Each adds −(applied parcel energy)
  into its face with a CAS f32 add.
- One update pass per thermal step applies T += E/C.
- The exact thermal variants (12–13 storage buffers) refuse finite walls with
  a clear error. They are not used by any preset.

**Defaults.**
- Passive containers are finite (the generic default).
- Water-cycle explicitly keeps fixed faces: its 400 K floor and 200 K ceiling
  are controlled heater and cooler plates.
- Iron Ice keeps its preset's adiabatic walls.
- **Fixed alongside:** adiabatic walls no longer leak heat into the rigid
  ice. The rigid stage gated only on face temperature and ignored the model.

**Preflights** (`thermoPreflight.js`, `sphPhaseDemo.js`).
- Finite walls make a closed system that includes the faces. The ledger per
  face is exactly C·(T_eq − T0), so energy closes.
- The reference iron-on-ice box in a sealed finite steel box mixes to 299.6 K,
  so "cold solid iron + ice" is honestly infeasible. It was reachable only
  with infinite −40 °F reservoirs.

**Tests.**
- `tests/sphFiniteWallState.native.test.mjs` (`ULG_RUN_NATIVE_FINITE_WALL=1`)
  passes:
  - T = T0 + ΣE/C per face, the cumulative energy, the cleared pending
    word, and the params copy;
  - sub-ulp heating, where 2,000 × 0.04 J gives exactly 80,000,000 quanta
    and the face rises by 80 J/C.
- **Live in sodium-water:** the floor absorbed 14.5 J in 40 s and rose by
  0.00021 K (= 14.5/63,638), with 0 rollbacks.
- The finite-default and explicit-infinite preflight tests pass, as does the
  view-state test.

## Steam rises: three fixes, 2026-11-15

**Checkpoint met.** In Iron Ice at dt 0.5 ms and 1 atm, measured to 3.0 s
(`s9t-fix-3s`, `&observeSpatialAuthority=1`):
- **0 of 5,833 steps rolled back.**
- **Steam rows sit at y 30–137 mm** (box height 140 mm), moving up at up to
  0.22 m/s, while the meltwater stays at y 2–21 mm.
- No GPU errors, no Xid, 17.4 steps/s with the observer on.
- The preset's "late" expectation, "steam rises into the headspace while
  meltwater remains below", now holds.

### 1. Root cause: melt release dropped the molecules (G3)

**The chain.**
- `schroederSolidReleaseGpu.js` activates a reserved dormant fluid row seeded
  with mass 0, and kept that row's thermo word 9 (represented entities), so
  released meltwater carried 0 molecules.
- Steam born from it, through the interface law or a normal phase split,
  inherits entities × fraction, so it also had 0.
- The particle gas-ledger EOS (`sphSpatialGasLedgerEosGpu.js`) rejects a
  declared-gas row with zero entities (`ERROR_INVALID_CANDIDATE`). That fails
  the gas-pressure authority, then the gas-pressure-boundary transport commit
  (`commit_boundary_transport`, source reject 0x307 = reason 7, gas authority
  not READY).
- The field view goes READY|FAIL_CLOSED, and G2P restores every particle.
  Every step from tick 3608 (1.804 s) was rolled back, freezing the whole
  scene, including the earlier no-transport runs.

**Fix.** Release sets entities = m·N_A/M. The factor is
`thermal.liquidEntitiesPerKg` from the material's molar mass, passed as
release params `liquid.w`; the release cache key is now v1.

**Gate.** `tests/schroederSolidRelease.native.test.mjs` R7
(`ULG_RUN_NATIVE_SOLID_RIGID=1`) passes.

### 2. S9 gas/condensed transport on the single-level route

**Built.** The one-level S9-C proposal (fine local heads, coarse level −2³¹,
no parent, 2 dispatches) was already in the ABI. It is now wired end to end:
- **Transport WGSL** admits one-level proposals (keys v6).
- **Epoch transaction:**
  - `resolveReadOnlyPhaseVolumeInterfaceProposal` and
    `phaseVolumeInterfaceProposalMatchesSnapshot` accept the one-level shape;
  - the new `resolveSingleLevelPhaseVolumeTransportAuthority`;
  - the creation gate no longer requires two-level.
- **Generation** builds the one-level proposal on one level. It steps aside
  when the single level has no V0J/S9-B source or no receipt.
- **Same-level transaction** makes it authoritative.
- **`schroederSingleLevelPhaseVolumeTransportRequired(transaction)`** at the
  three MLS-MPM step sites. The S9 pressure scale is exactly 0 beside the
  exact gas boundary (drag only, as two-level).
- **Law activation receipt field `phaseVolumeInterfaceTransport`**
  = !twoLevel && mechanicsFieldViews && the mechanics table has a gas or
  plasma phase. It implies sidecars and is mirrored in:
  - `schroederTargetScheduleAuthority.js` (shared predicate
    `schroederMechanicsTableHasGasOrPlasmaPhase`, plus the transition delta
    sets);
  - the control plane's exact receipt check.
- **Evidence:** `ambientBuoyancyMode` reports
  `integrated-s9c-current-volume-ambient-source`.

**Tests.** `tests/schroederSpatialEpochTransaction.test.mjs` has 3 new
single-level cases. The generation test was updated: a one-level opt-in steps
aside without a V0J source and still fails closed with sidecars off.

### 3. Two-level empty-coarse (parked)

The empty-coarse trial failed at the transport because the S9-C proposal was
not admitted: reason 1204 means proposal status not READY, because the coarse
receipt, field and parent are empty. Admitting an empty coarse level needs
zero-count relaxations across about five more kernels. That remains a
robustness item for two-level scenes whose coarse level starts empty. Iron
Ice no longer needs it.

### Probe additions

- Authority summary: `rejectReasonHistogram` and `headerDiagHistogram`.
- `fvTransitions`: per-pass field-view status and the boundary-scratch
  header at `S0_PASS_TRACE_SLOTS`.
- In byKind: `__gasLineages` and `__invalidGasCandidates`.
- `tracedSourceRows`/`sourceLevels` under `S0_CONTACT_AUDIT`.
- Velocity in the row trace.

**Rule:** run any long Iron Ice evidence with `&observeSpatialAuthority=1`.
A frozen scene looks plausible in a final-state readout.

## Iron Ice condensate plume: the remaining G2 blocker, 2026-11-15

**Desktop sequence** (`~/.cache/icc/repos/ulg/g2-iron-ice-sequence-20261115/`):
Iron Ice at dt 0.5 ms and 1 atm, 0.3 → 3.0 s. The ice melts (members alive
fall from 256 to 248), but **no plume is visible**. That run declares no air
environment, so no nuclei parcels exist. The steam rows (y 30–137 mm) are
vapor, which is not drawn, and the ledger parcel stage (condensation →
aerosol, the visible condensate) never runs.

**With room air** (`&environmentMode=air`):
- Particles: Ar 32, CO₂ 32, Fe 216, H₂O 288, N₂ 32, O₂ 32.
- Discovered reactions: **2 Fe + O₂ → 2 FeO** (heat proxy −3.79 MJ/kg) and
  **3 Fe + N₂ → Fe₃N₂** (−2.39 MJ/kg).
- Step 1 fails closed: "Phase-specific caloric reaction energy is not yet
  admitted" (`assertNoCondensableCaloricReactionTable`,
  `sphReactionGpuKernel.js`).

**Why the refusal is right.** On the G2 integer-ledger route, reactions keep
the heat proxy (user decision, 2026-11-13). The proxy gives products the
reactants' internal energy plus h. The room-air O₂ and N₂ rows use phase
caloric segments (a reference gauge), while Fe and the products use legacy
segments. Mixing the two gauges would place product energy off by the gauge
difference.

**The general fix already exists on the rational route.**
`buildSphReferenceReactionTable` builds reference thermochemistry from
standard formation enthalpies, with gauge correction and per-phase curves, and
refuses any candidate without a reference. Fe₃N₂ would be rejected on record;
FeO would be admitted. Using it on the ledger route needs the user's approval,
because it reverses the 2026-11-13 heat-proxy decision.


## Gauge-consistent heat proxy (user decision 2026-11-16) and the next blocker

- **Built.** `src/runtime/sph/sphReactionHeatProxyGauge.js` gives each product
  term an offset δ_p = u_p(T_ref) − Σ_r w_r u_r(T_ref):
  - T_ref = 298.15 K, with each u_ref taken from the runtime thermal graph of
    that species.
  - δ_p is stored in product-term word 15 and added where the GPU writes
    product energy (`resolve_particle`, the legacy branch, product events) and
    in the CPU mirror.
  - It applies only to mixed-gauge tables. Single-gauge tables stay
    bit-identical.
  - The worker re-derives and byte-checks received offsets
    (`importSphReactionHeatProxyGauge`).
  - Gauge tables are kept out of the disk cache.
  - Tests: `tests/sphReactionHeatProxyGauge.test.mjs` (4 of 4). At T_ref every
    product's sensible energy equals −h in its own gauge; copies are refused.
- **Result.** Room-air Iron Ice now passes the old step-1 refusal ("Phase-specific
  caloric reaction energy is not yet admitted").
- **Next blocker.** Every step rolls back, with or without reactions
  (`lawr=0`: 721 of 721).
  - The field view's finalize flags INVALID_SOURCE (status 15): header word 35
    (invalidSourceCount) or 58 (invalidFieldKeyCount) is nonzero at
    finalize, though the probe's snapshots read 0.
  - The old step-1 refusal hid this. Diagnose before the visible-plume run.
