# G2 proposal — exact integer ledgers instead of exact rationals

Status: **section 5 answered, 2026-10-27; new real-time requirement.** The
user paused G2 code changes for this review ("Stop and review first"),
approved Phase 0 and the pass budget in 2.5 ("yes add it, then start phase
0"), and Phase 0 passed. The user then answered section 5: momentum stays
f32, the exact energy budget counts, the exact-rational code is disabled
rather than deleted, and the plume evidence must run near real time ("25 min
is insane these should run near realtime"). That last answer is new scope:
see the real-time gap in section 6. Codex's work through R327 is committed
locally as `1ee78bf` (WIP checkpoint, not a milestone). G2 remains 3/6.

## 1. Evidence: why the R2xx–R327 path cannot deliver G2

### 1.1 No exact step has ever completed

R327 is Codex's last revision. Its bounded replay of the actual
`iron-ice-quench` room-air step completes 40 phase-transfer passes. Pass 41,
`ulg-execute_phase_add` (the first nonzero mass + mass add), exceeds 15 s and
the device is lost. The unmodified production run loses the device at the same
stage. Evidence, under `~/.cache/icc/repos/ulg/g2-exact-placement-chain-20261026/`:
`native-r327phase-room-air.json`, `native-r327actual-room-air.json`.

Every fix from R296 to R327 split or specialised the kernel that had just
failed. Each fix moved the failure one stage later: placement physical volume
(R296–R305), phase mass selection (R306–R309), mechanics reference and ratio
(R310–R313), G2P (R316–R317), the thermal budget resolver (R318), thermal
arithmetic (R319), carried reaction (R320), then phase normalisation, multiply
and add (R321–R327).

### 1.2 The loss is a GPU watchdog, not a numeric fault

The kernel log since 2026-10-24 records 116 losses, all
`NVRM: Xid 109 ... CTX SWITCH TIMEOUT` from Chrome. It also records two Xid 13
graphics exceptions. One of them (2026-10-26 21:32) reads
`SKEDCHECK02_LOCAL_MEMORY_LOW_SIZE failed`: a shader needed more per-thread
local memory than the driver had allocated. Check with
`journalctl -k --since 2026-10-24 | grep Xid`.

The isolated native fixtures that pass are static pages with no canvas or
animation (for example `probe-phase-quantity-production-limits.mjs`). The
actual app runs its UI loop at about 120 Hz (`ui raf 119.9` in the R327
evidence) and keeps updating the page, so Chrome's compositor needs the GPU
while the simulation pass runs. (Correction, from Phase 0: `ui raf` counts
animation callbacks, not rendered frames. In R327 no simulation state was
presented, and an idle app encodes almost no GPU work.) Likely mechanism: the
compositor's context switch waits on a pass the driver cannot preempt within
its timeout, and the channel is killed. This is **a hypothesis consistent with
the evidence, not a proven cause**. It would explain why the same kernels, at
the same capacity, pass in isolation.

### 1.3 The arithmetic is GPU-hostile by construction

`src/runtime/sph/sphExactRationalQuantityWgsl.js` represents each scalar
(momentum component, energy, volume, kinetic energy, ratios) as a signed
rational:

- a 63-limb numerator and a 63-limb denominator (130 words per value);
- a 127-word scratch width;
- a 16-bit schoolbook multiply into a 254-word digit array;
- binary-GCD normalisation, with full-width shift, compare and subtract on
  every iteration.

One thread therefore holds thousands of words of private arrays, in local
memory. Splitting kernels shortens each pass, but each wide operation still
needs this footprint.

### 1.4 Step cost and the plume horizon

- **Passes per step:** in R300 the placement volume check was compute pass
  ~50,586 of a single step (`native-r300tail-room-air.json`). Phase transfer
  alone grew from 112 passes (R320) to 462 (R327) as kernels were split. The
  R327 actual run creates 488 compute pipelines (445 distinct labels).
- **Step time:** partial steps that did run took tens of seconds. In R314,
  placement, phase transfer and optics took about 35 s of recording alone.
- **Plume horizon:** `iron-ice-quench` steam needs about 2.2 s of simulated
  time before one carrier of vapor exists. Its scientific arm is 16 × 512 =
  8,192 steps (`src/runtime/sphPhaseScenarioPresets.js:229-236`). At tens of
  seconds per step, one plume run takes days.
- **Missing physics:** nuclei activation, growth, airborne transport and
  deposition are not yet connected to this path at all.

### 1.5 How the scope grew

The 2026-10-24 decision was about **mass precision**. Two f32 endpoints cannot
conserve a transfer between masses many binades apart (handoff, "Open G2 design
decisions" #1). Codex's integer mass format fixes exactly that:

- 9 u32 limbs, quantum 2^-149 kg;
- committed in `2b14763`..`1b09ac9`;
- natively verified through standard, fused, two-level and SS continuation.

Exact general-rational momentum, energy and volume came later, during
R2xx–R327, under the label "complete low-part M/P/E coupling".

The G2 oracle (`.icc/completion-oracles.yaml:66-82`) asks for conservation of
**mass, species, enthalpy and parcel ownership**. It does not ask for exact
momentum. The inventory plan itself says "Grid momentum arithmetic is not an
inventory ledger" (`plan/todo/g2-exact-gpu-inventory.md:87`).

## 2. Proposal

### 2.1 Principle

Store every conserved quantity as an integer number of quanta in one run-wide
binary format. This is the existing mass format, extended to a signed energy
variant. Physics (rates, temperature, velocity, pressure, caloric inversion)
stays in f32 and reads projections of the ledgers, as the solver already does.

Every finite f32 is an integer multiple of 2^-149, and 2^128 / 2^-149 = 2^277
fits in 288 bits. So **an f32 packet converts to 9-limb quanta with no
rounding at all.** The f32 evaluation of the packet is the only approximation.
After that, application is exact.

### 2.2 Transfer rule (applies to every exchange)

1. Compute the packet in f32 from the current projections.
2. Convert it exactly to quanta.
3. Clamp it to the donor's exact inventory with an integer compare. Depletion
   is then exact zero; an f32 projection never decides availability.
4. Subtract the same integer from the donor and add it to the receiver.
5. When a donor's mass reaches exact zero, move all of its remaining energy
   (and any other component) with the last packet. No empty row keeps orphaned
   energy.
6. For a split into k parts, compute k−1 parts and give the last part the
   exact remainder. Codex's R308 phase-mass change already uses this rule.

### 2.3 Sources that are not pairwise

Some terms are physical sources, not exchanges between two ledgers:

- heat written by mechanics: contact-solver and mechanics-field heat, pressure
  compensation and drag heat, and kinetic energy thermalized in phase transfer
  and reactions. The base P2G/G2P path adds no p·dV or viscous heat today.
- wall and ambient heat flux (adiabatic walls give zero);
- reaction heat release, if it is modelled as a source rather than as a
  formation-enthalpy difference carried in the energy ledger.

Apply each as an integer packet to its particle. Accumulate the same integers
into a per-step source ledger. The global budget then closes bit-exactly:

    sum U(t) == sum U(0) + sum of applied source packets

This is the GPU conservation test: an integer comparison with no tolerance.

### 2.4 What is and is not exact

| Quantity | Proposal |
|---|---|
| Carrier mass (per species) | Exact integer ledger. Already implemented. |
| Carrier internal energy U = m·u (signed) | Exact integer ledger. New signed variant of the same format. |
| Aerosol parcel dry-core mass, condensed water, energy | Exact integer ledgers. Multiplicity is already an exact u64. |
| Water vapor | Each carrier holds one species, so vapor is the mass and energy ledgers of H2O gas carriers. SS gas cells remain derived mixture views. |
| Momentum | Not ledgered. MPM P2G/G2P stays f32 (open question Q1). |
| Temperature, velocity, pressure, rates, kinetic energy | Derived f32 values, never inventories. |

### 2.5 Cost

- A pairwise transfer is two 9-limb add/subtract loops on storage, about 40
  integer operations.
- A projection is one 9-limb scan plus one rounding.
- No GCD, no wide multiply and no private arrays.
- Most ledger work fuses into passes the solver already runs. Thermal,
  contact, phase transfer, reaction and exchange compute their packets in an
  existing kernel, and each endpoint applies its own side, so every row keeps
  one writer.
- Only order-independent scatter needs passes of its own: one carry pass that
  also rewrites the f32 projections, plus the opt-in budget check.
- **Pass budget: the ledgers add at most 2 compute passes per step to the f32
  path.** Phases 0 and 1 gate on it (section 4).

### 2.6 Integration map

What the f32 path does today, from a source survey of `1ee78bf`, and what
changes. Paths are under `src/runtime/sph/` unless noted.

**State.** The state row is 8 × f32: position, `massKg`, velocity and
**specific internal energy `u`** (`ulg-gpu-abi/src/index.js:369-378`). T is a
cached f32 that the thermal writer derives from `u`. Mass is duplicated in
mechanics lane 31, and rest volume and entity count derive from mass.
The ledger stores extensive `U = m·u` as a signed integer in 2^-149 J quanta,
one row per carrier beside the existing mass row. The f32 `massKg`, `u`, lane
31 and derived volume become projections, rewritten from the ledgers whenever
a ledger changes.

| Stage (step order) | Today | With ledgers |
|---|---|---|
| P2G, grid, G2P, separation | `u` copied through. No p·dV, and viscosity is not turned into heat (`ulg-gpu-abi/src/wgsl.js:10592-10616`). | Unchanged. Momentum stays f32. |
| Mechanics-field route, contact solver | Contact heat split by mass (rounding remainder to the second field). Wall heat, pressure compensation and drag heat are written into `u` (`sphMlsMpmGpuStep.js:9674-9686`, `schroederSpatialMechanicalProposalsGpu.js:7780-7856`). | The pair split becomes one integer packet plus its remainder. One-sided terms become recorded source packets. |
| Thermal | Each endpoint forms E_ij and adds E_ij/m_i to its own f32 `u`, so the pair is **not exactly equal-and-opposite** (`schroederSpatialThermalProposalsGpu.js:6665-6749`, `sphThermalGpuKernel.js:349-361`). A final domain clamp can discard energy (`sphThermalGpuKernel.js:376-380`). | One packet per pair, evaluated in canonical (min, max) index order so both ends see identical bits. Integer debit/credit. Wall and ambient terms become sources. The clamp is replaced by limiting the packet, so energy is never silently discarded. |
| Reaction | Both threads recompute the pair; product `u` comes from an energy balance; chemical heat is a source (`ulg-gpu-abi/src/wgsl.js:3061-3261`). | Keep the committed integer allocation and routing. Product energy is an integer packet; chemical heat is a recorded source. |
| Phase transfer | One thread rebuilds all four lanes of a lineage, with f32 lane masses that need not sum to m (`sphPhaseCarrierTransferGpu.js:479-563`). Thermalized ΔKE goes into `u` (`:632-637`). | The same thread uses the remainder rule: lanes 1..k−1 are computed, the last lane takes the exact remainder of M and U. ΔKE is a recorded source. |
| Vapor/aerosol exchange | Already two-endpoint with one writer per endpoint. One shared mass amount. Latent heat rides on per-phase energy offsets. Heat sums are exact in 10 u32 limbs at 2^-149 (`sphVaporAerosolExchangeWgsl.js:347-350, 428-524`). Test-only, and it requires the exact-rational quantities to retain anything. | Keep the edge physics and the Onsager rate law (`sphVaporAerosolRatesWgsl.js`), but read f32 projections and apply integer packets. This is the closest existing piece to the proposal. |

**Phase rule.** Two conflicting rules coexist: the legacy fixed-boiling plateau
(segment type 2) and the type3 per-phase branches. Under type3, thermal never
changes phase; only explicit mass edges do. For the three steam presets, use
type3 only. Melting and boiling then become explicit mass-and-energy packets
between lanes, which the remainder rule makes exact.

**Parcels.** The 24-word f32 parcel record (`ulg-gpu-abi/src/sphAerosolParcel.js:23-62`)
gains a ledger sidecar: dry-core mass, condensed-water mass and U. The f32
mass, `u` and radius fields become projections. Multiplicity is already an
exact u64, and lineage ids already exist.

**Transport.** Parcels become passive tracers. Each step they move with the
grid velocity interpolated at their position (the G2P stencil), plus Stokes
settling with a Cunningham correction. The coupling is declared one-way, with
Stokes number ≪ 1. A parcel that violates the declaration is flagged, not
silently moved. Exchange binds each parcel to its SS gas cell (the
`sphAerosolSpatialBinding.js` binding), not to one carrier. Vapor donors are
that cell's H2O gas carriers. The packet is split across them by mass with the
remainder rule.

**Deposition.** A parcel within contact distance of a condensed carrier
transfers all of its ledgers to that carrier exactly, and its row becomes
exact zero. A parcel reaching a wall is deposited into a wall ledger instead.
The wall ledger is a recorded sink, so the budget still closes.

**Nuclei.** Air-mode carriers seed a dry-nucleus parcel population: number
concentration, dry-radius bins, composition and hygroscopicity κ, labelled as
benchmark choices with sources. The rate law's equilibrium vapor pressure
gains the κ-Köhler water-activity (Raoult) term beside the existing Kelvin
term. Its coefficients are documented continuum values (vapor diffusivity and
air conductivity) with a Fuchs–Sutugin transition correction.

**Optics.** Parcels are never drawn today. The only physics-to-pixels chain is
liquid on gas carriers, through the dispersed-medium optics producer, to the
ray-marched participating medium (`sphDispersedMediumOpticsProducerGpu.js`,
`sphParticipatingMediumGpu.js`). Feed the producer parcel number, radius and
water mass, so the extinction comes from the parcels themselves.

## 3. Keep, retire, build

**Keep.** All committed, integer-based, and natively verified where noted:

- The integer mass format, WGSL operations, owner, cold seed and transfer
  gather (`sphExactMass*`, `ulg-gpu-abi/src/sphExactMassInventory.js`).
- Exact-mass continuation through G2P → thermal → refresh → closure → SS
  publication, in standard, fused and two-level execution.
- Integer reaction allocation, routing, packets and outputs (`sphExactReaction*`).
  Review each for rational helpers (`sphExactRationalProjectionWgsl.js`)
  before reuse.
- The room-air environment: CIPM-2007 composition, free-volume carriers, the
  Atmosphere UI panel, URL keys and worker plumbing (`sphEnvironment*`,
  `material/roomAirCaloricReference.js`, in `1ee78bf`).
- The vapor/aerosol edge physics and rate law; the parcel family; the
  dispersed-medium optics producer and renderer; the type3 caloric tables.

**Retire.** Disable it, and keep it in `1ee78bf` history:

- `sphExactRationalQuantityWgsl.js` and its 22 dependents: thermal, carried
  reaction, placement, phase, G2P, history and mechanics-refresh quantity
  stages, and exact vapor quantities.
- The `initialQuantities` exact-rational cold declaration. Air mode switches
  to integer ledgers instead.
- The `exact-rational` and `rounded-dyadic-53` packet modes. f32 packets
  converted exactly replace both.
- The legacy fixed-boiling plateau, in the three steam presets only.

**Build:**

- The signed energy ledger: seed, projection and owner. It shares the mass
  owner's lifecycle.
- Ledger apply kernels:
  - pairwise gather;
  - order-independent scatter using 16-bit chunk atomics followed by a
    carry-propagation pass;
  - an opt-in per-step source ledger and budget check.
- Integer packets in thermal, contact, phase transfer, reaction and exchange.
- Dry-core nuclei with κ-Köhler activation, plus Environment UI nuclei
  controls.
- Parcel ledgers, tracer transport, deposition and the optics feed.
- Desktop evidence: the Iron Ice plume run, the sodium-water lineage trace,
  and the Environment UI round trip.

**Risks:**

- **Resolution.** Air mode has one gas carrier per species per cell, so a
  plume may look coarse. Visual quality is not a G2 criterion, but it affects
  whether the evidence is convincing.
- **Coefficients.** The documented continuum coefficients still need an
  independent check of growth rates against a CPU reference.
- **Wall time.** The user requires the plume scenarios to run near real time
  (section 5, Q4). Iron Ice runs dt = 0.5 ms, so that means about 2,000
  steps/s. The f32 app averaged about 6 steps/s on 2026-10-27, so an
  8,192-step run took about 23 minutes. Section 6 has the gap.
- **The watchdog hypothesis is unproven.** Phase 0 tests it before anything
  else is built.

**Effort.** Roughly two weeks of focused work across Phases 0–6. Phase 0 shows
within about a day whether the premise holds.

## 4. Implementation order and gates

Each phase ends with a gate the user can check. A later phase never starts on a
failed gate.

| Phase | Work | Gate |
|---|---|---|
| 0 | Feasibility probe. Signed energy ledger, pairwise packet kernel, chunked-atomic scatter and projection, at Iron Ice capacity (6,784 rows), inside the actual app while it presents. | No Xid in `journalctl -k`. Measured GPU time per stage. Bit-exact sums over 1,000 random transfers. At most 2 ledger passes per step that cannot fuse into an existing solver pass. |
| 1 | Energy ledger through the existing exact-mass continuation (G2P → thermal → refresh → closure → SS publication). Thermal conduction as pairwise integer packets. | GPU test: over N steps, sum U(t) equals sum U(0) plus recorded sources, bit-exact. Measured compute passes per step at most the f32 baseline plus 2. Host suite and build green. |
| 2 | One phase rule (the type3 caloric model replaces the legacy fixed-boiling writer). Phase change as described in 2.6. | GPU test: mass and energy budgets bit-exact through melt and boil. The actual Iron Ice step runs past vapor onset (~2.2 s simulated). |
| 3 | Reactions: the committed integer allocation plus reaction energy as packets, with lineage ids. | Sodium-water: element and mass budgets, product lineage traced to the admitted reactants. |
| 4 | Room air plus nuclei (dry core and condensed water). Activation and growth/evaporation as exact packet exchange between gas vapor and parcel water. | GPU test: vapor plus parcel water and energy bit-exact. Growth rate checked against an independent CPU reference of the same law. |
| 5 | Parcel transport with the gas velocity (plus settling) and deposition as an exact whole-parcel transfer to a surface carrier. | GPU test: parcel ownership and all budgets bit-exact through transport and deposition. |
| 6 | Optics and desktop evidence: condensate rendered from parcel water mass. Iron Ice run through the plume window, sodium-water lineage trace, Environment UI round trip. | The three `ulg-g2-plumes` oracle criteria, with screenshots and source-bound receipts. |

Phase 0 is small and decisive. If integer ledgers also hit the watchdog in the
live app, this proposal is wrong, and the next step is to prove the
time-slicing hypothesis in 1.2 directly.

### Phase 0 results, 2026-10-27: gate passed

**What ran.**

- The signed ledger library (`src/runtime/sph/sphExactLedgerWgsl.js`) sits on
  the committed mass format, and `ulg-gpu-abi/src/sphExactSignedLedger.js` is
  its host codec. It provides signed add, subtract and compare; exact f32 →
  quanta conversion; nearest-even projection; and order-independent scatter
  through 16-bit chunk counters with a one-pass carry.
- The probe (`tests/fixtures/sphExactLedgerProbeNative.js`) works at Iron Ice
  capacity: 6,784 rows. Each step runs six passes:
  - **match:** 3,392 disjoint random pairs, with mass clamped exactly to the
    donor and all of a depleted donor's energy moved with it;
  - **conduct:** canonical-order f32 conduction packets over a lattice graph
    of 194,124 directed edges;
  - **f32:** the same loop in plain f32, for comparison;
  - **scatter:** four many-to-one transfers per row, whole-row deposits and
    sparse recorded sources;
  - **carry:** folds the scatter counters into the ledgers and refreshes the
    projections;
  - **budget:** checks ΣM = M0 and ΣU = U0 + sources.
- `scripts/g2-ledger-live-probe.mjs` opens the actual app
  (`pages.html?scenario=iron-ice-quench&residentAuto=1&residentGpuTimestampFeature=1`)
  and presses Play. Once the app steps, it runs the probe on the app's own
  GPUDevice: the one in the offscreen render worker, which both simulates and
  presents. Probe submissions interleave with the app's.
- `tests/sphExactLedger.native.test.mjs` runs the arithmetic against BigInt,
  then the probe, on a static page.

| Gate item | Result |
|---|---|
| No Xid | None in `journalctl -k` during either live run: 1,000 steps unpaced, and a 120 s soak of 7,500 steps paced at 16 ms. |
| Bit-exact sums | Live, 1,000 steps: 3,392,000 pair transfers, 97,062,000 conduction packets, 27,136,000 scatter transfers, 106,189 deposits, 795,251 sources, no non-finite packets. ΣM equals the host's initial total. ΣU equals the host's initial total plus its own recomputation of every source. The GPU budget held on every step. An independent single-thread audit agrees. |
| GPU time per stage | Table below. |
| At most 2 ledger-only passes per step | 2: carry (22.8 µs median) and budget (5.5 µs). |

GPU time per pass, in µs, in the live app over 1,000 steps (timestamp queries):

| Pass | Median | p99 | Max | Static-page median (7,500 steps) |
|---|---|---|---|---|
| match | 16.9 | 19.9 | 25.3 | 16.8 |
| conduct | 21.5 | 26.5 | 31.1 | 21.5 |
| f32 (same loop, f32 only) | 11.9 | 13.3 | 23.7 | 11.9 |
| scatter | 8.7 | 14.5 | 22.8 | 8.4 |
| carry | 22.8 | 29.5 | 30.6 | 22.8 |
| budget | 5.5 | 6.7 | 18.5 | 5.6 |
| whole probe step | 89.2 | 110.0 | 121.2 | 88.8 |

- **Exact versus f32.** Exact conversion and accumulation add 9.6 µs to the
  same neighbour loop.
- **Longest pass.** The longest ledger pass took 31.1 µs. R327's failing
  exact-rational pass ran for more than 15 s.
- **Audit.** The one-time single-thread audit takes 1.5 ms; it is a test,
  not a per-step pass.

**Soak inside the live app** (`live-soak-7500.json`): 7,500 steps over
120 s, paced at 16 ms per step, about 4× the app's own average step rate.

- **Exactness.** Every check passed again over 25,440,000 pair transfers,
  727,965,000 conduction packets, 203,520,000 scatter transfers, 794,539
  deposits and 5,964,281 sources. 666 conduction packets were non-finite
  (4.6 × 10^-7); both endpoints skip them identically.
- **Pass times.** Medians were unchanged (match 17.1, conduct 22.6,
  carry 23.0, budget 5.6 µs), and the p99 was at most 47.5 µs. A few passes
  reached 0.45–0.54 ms while the app's own work was in flight; the longest
  probe step took 0.62 ms.
- **App.** It kept stepping at the same rate: 0.0030 simulated s per wall s
  before and during the probe. Presented states fell from 56 to 50 per
  second, and the UI loop from 115 to 107 callbacks per second.

**What Phase 0 does not show.**

- **The time-slicing hypothesis (1.2) is untested.** Ledger passes are about
  10^5 times shorter than the failing passes, so they cannot exercise it either
  way.
- **Fusion is still a design claim.** The probe runs match, conduct and scatter
  as their own passes. Fusing them into thermal, phase transfer, reaction and
  exchange is gated in Phase 1 (f32 baseline plus 2).
**A probe defect found and fixed during the soak.**

- **What the first soak showed.** It flagged `OVERFLOW` and
  `PROJECTION_OVERFLOW` from step 4,129 onward, and 8 per-step budget
  failures. Its final totals were still bit-exact, and the audit agreed.
- **Cause.** The probe's first version sent random-sign energy packets. Those
  let row energies random-walk past the f32 range (about 10^38 J). By the end,
  70% of conduction packets were non-finite.
- **Errors were flagged, not silent.** The flags came from two range limits.
  First, the f32 projection (2^128 J). Second, the budget's positive and
  negative halves, each of which must stay below 2^287 quanta.
- **Fix.** Packets now move a fraction of the donor's own signed energy, which
  never grows Σ|U|. Earlier `-unbounded` evidence files are kept.
- **Phase 1 design note.** A production budget accumulator needs log2(rows)
  bits of headroom (one extra word). The sum of |U| over rows can exceed the
  range of any single legal row value.

**App baseline (non-air Iron Ice, f32 path, unmodified).**

- **Warm-up.** The first schedule compiles for about 35 s.
- **Rates.** After that the app runs 16-step schedules: the readout shows
  16 steps/s while a schedule runs. Measured from sim time, it averages
  0.0030 simulated s per wall s, about 6 steps/s at its 0.5 ms step. It
  presents 50–57 states/s.
- **Plume horizon.** At that rate, vapor onset (about 2.2 s simulated) takes
  about 12 minutes, and the 8,192-step arm about 23 minutes.
- **Air mode not measured.** Air mode adds gas carriers and still runs the
  exact-rational path today, so its f32 rate is not yet measured.

Evidence, in `~/.cache/icc/repos/ulg/g2-ledger-phase0-20261027/`:

- `live-1000.json` and `.png` (the app right after the probe);
- `live-soak-7500.json` and `.png`;
- the first-dynamics runs, kept as `*-unbounded.*`.

The static-page run is `ULG_RUN_NATIVE_EXACT_LEDGER=1
ULG_EXACT_LEDGER_STEPS=7500 node --test tests/sphExactLedger.native.test.mjs`.

## 5. Questions for the user

1. **Momentum.** May momentum stay an f32 mechanics quantity, outside the
   ledgers? The G2 oracle does not name it, and exact MPM momentum would need
   exact grid transfers.
2. **Energy budget with mechanics.** Is a bit-exact budget acceptable for G2's
   "enthalpy conserved" criterion? Budget here means exchanges exact, with
   mechanics heat and wall heat as recorded sources. The alternative, a closed
   total-energy invariant with mechanics on, would need exact kinetic energy,
   which is the path being abandoned.
3. **Exact-rational code.** Should the exact-rational stages be disabled (kept
   in `1ee78bf` history) and room-air mode moved to the integer-ledger path?
   Alternatively they could be deleted once Phase 2 passes.
4. **Wall time for the plume evidence.** Even the f32 path needs about 8,192
   steps to reach Iron Ice steam. G1 performance is deferred. Is a long
   recorded run (for example 20–60 minutes) acceptable as the desktop plume
   evidence?

**Answers (user, 2026-10-27): "1 yes, 2 sure, 3 disabled, 4 25 min is insane
these should run near realtime."**

1. Momentum stays an f32 mechanics quantity, outside the ledgers.
2. A bit-exact energy budget, with mechanics heat and wall heat as recorded
   sources, satisfies "enthalpy conserved".
3. The exact-rational stages are disabled and kept in `1ee78bf` history. They
   are not scheduled for deletion.
4. **No.** A 25-minute recording is not acceptable evidence. The plume scenarios
   must run near real time. Iron Ice uses dt = 0.5 ms, so real time is about
   2,000 steps/s. The f32 app averaged about 6 steps/s on 2026-10-27
   (Phase 0 results). Section 6 measures where that time goes.

**Answer 3 is applied.** `ROOM_AIR_EXACT_MASS_DECLARED = false` in
`src/runtime/sphPhaseDemo.js` stops room air from declaring exact mass. That
declaration was the only production route into the exact-rational stages:
exact mass made the post-mechanics closure pass exact thermal and reaction
results to phase transfer and refresh. The stages stay in the tree; no scene
reaches them. Humid-air Iron Ice now fails closed at its first step with
"Phase-specific caloric reaction energy is not yet admitted": room air adds
O2, so Fe/O2 reactions are discovered, and the f32 reaction stage refuses
per-phase calorics. That is a clean refusal with no Xid, where R327 lost the
GPU. Air mode returns with Phases 3 and 4.

## 6. Real-time gap, measured 2026-10-27

Real time for Iron Ice (dt = 0.5 ms) is 2,000 steps/s. Half real time is
1,000 steps/s, or 1 ms per step with everything included.

**Method.** The live app ran non-air f32 Iron Ice (6,784 rows) on the RTX
5060 Ti, headed, after warm-up. Three 30 s windows followed:

- a census of every WebGPU call;
- the same census plus a timestamp pair injected into every compute and
  render pass;
- a census again.

Steps come from the worker lane's own counter. The timed window ran at the
same rate (6.5 vs 6.4 steps/s), so the timestamps did not slow the app. A
second run polled the page scheduler and the app's opt-in cadence timeline
across batch boundaries.

- Probe: `scripts/realtime-gap-probe.mjs`.
- Evidence: `~/.cache/icc/repos/ulg/realtime-gap-20261027/`
  (`iron-ice-f32.json`, `schedule-gap-2.json`). No Xid.

**Result: 6.4 steps/s, about 159 ms per step.** The app runs 16-step
batches; one batch takes 2.55 s.

| Where a step's time goes | ms/step | Share |
|---|---:|---:|
| Idle between batches. The page holds the next batch until it has proof that the previous batch's last state was drawn (`native-surface-post-step-presentation-proof-pending` in `sphPhaseDemoMount.js`). The GPU is mostly idle. | ~84 | 53% |
| GPU, contact solver: `contact-graph-solve` (3.9 passes of 6.8 ms each) and `matching-cleanup-global-owner` (1 pass of 17.7 ms) | 44 | 28% |
| GPU, everything else (about 100 passes) | 16 | 10% |
| CPU and queue waits inside a batch | ~13 | 8% |
| Tail fence | ~2 | 1% |

- **CPU and queue waits.** Each step makes 108 compute passes, 405
  dispatches (54 of them indirect), 32 submits, 235 buffer writes and about
  10 queue waits.
- **The other GPU passes.** The largest, in ms per step:
  - thermal directional budget 2.3;
  - contact graph build 2.0;
  - mechanics-field view radix sort 1.4;
  - thermal reciprocal-limited proposal 1.35;
  - grid update 0.8;
  - phase-volume migration 0.7;
  - G2P 0.6;
  - epoch radix sort and P2G clear, 0.4 each.

  The render-field build costs 49 ms once per batch. Passes of 0.3–2.5 ms
  over 6,784 rows are latency-bound, not bandwidth-bound.

**The current route cannot reach it.**

- Removing the presentation hold gives the in-batch rate, about 14 steps/s.
- Even a free contact solver leaves about 28 ms per step in the remaining
  passes and waits. That caps this pass structure near 35 steps/s, about
  57× short of real time.

**What real time needs.** No more than about 0.5 ms per step, everything
included:

1. **Decoupled presentation.** Physics batches run back to back, and the
   presenter shows the newest state at display rate.
2. **A parallel contact solver.** It must cost about 0.1 ms, not 44. The
   serial owner was already identified as the wall in August; the noted fix
   was a Jacobi-wide pair application, not more micro-optimization.
3. **A lean pass structure.** About 15–25 wide passes per step, direct
   dispatch only, and K steps per submit with no per-step CPU waits (the
   Tier0 pattern).
4. **Ledgers inside the budget.** The two ledger-only passes measured 28 µs
   per step in Phase 0, about 6% of 0.5 ms.

**Why it is plausible.**

- Phase 0's six-pass step took 89 µs on the live app's device, at the same
  capacity. It covered random matching, conduction over 194,124 edges,
  scatter, carry and budget.
- Tier0 bulk water ran 1,100–1,260 steps/s at 33–37k particles (2026-09-01).
- Neither includes contact or phase change. Those are the unproven parts.

**Options (user decision pending):**

- **A. Real-time route first, with the ledgers built in.** Build a lean,
  fused K-step route for the three steam presets: MLS-MPM, conduction, phase
  transfer, parallel contact and the two ledger passes, with presentation
  decoupled.
  - Gate it like Phase 0: a probe at Iron Ice capacity in the live app, at
    least 1,000 steps/s and no Xid, before any porting.
  - G2's remaining phases then land on that route.
  - This moves the campaign's A1 (real-time substrate) ahead of G2's
    remaining items.
- **B. Ledgers first, on the current route (Phases 1–5); real time after.**
  - Every plume check runs at about 6 steps/s: about 12 minutes to vapor
    onset.
  - Most ledger wiring would land in kernels the real-time work replaces.

Recommendation: A.
