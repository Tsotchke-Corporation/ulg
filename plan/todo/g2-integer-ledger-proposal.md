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

### Phase 1 design, 2026-11-13

The user said "proceed with g2" after moving the real-time requirement to A1.
Phase 1 is the next step. This design comes from two read-only source surveys
at `f6f7a5e`. Claims marked (verified) were also read directly.

**Finding 1: where exact mass can run today.**
- **Integer exact mass runs without the rational stages on one route only:**
  thermal plus mechanics refresh, with no phase lanes and no reactions.
  `tests/fixtures/sphExactMassContinuationNative.js` covers that route with a
  solid Fe carrier.
- **Phase lanes pull the rational stages back in.** Whenever a mass capture
  exists, the closure passes `exactThermalResult` to phase transfer
  (`sphMlsMpmPostMechanicsClosure.js:3001-3004`). That always selects the exact
  phase stage. The stage builds rational quantities
  (`sphExactPhaseCarrierStageGpu.js:101-111`) and gathers successor mass from
  them.
- **Non-air Iron Ice cannot reach exact mass at all:**
  - the only declarations are the two room-air sites in `sphPhaseDemo.js`;
  - the worker lane accepts a cold seed
    (`ulgMechanicsResidentStage.worker.js:4143-4148`, verified), but nothing
    calls `exportSphExactParticleMassColdInput`.
- **Consequence:** Phase 1 builds and gates on the integer-only route. Iron Ice
  joins in Phase 2, which needs two things:
  - phase transfer becomes integer packets, replacing the rational phase stage;
  - the worker lane gets its cold seed.

**Finding 2: what writes `u` on Iron Ice's live route.** Only thermal
conduction is a pairwise exchange.

| Writer | Kind | Note |
|---|---|---|
| Field wall heat (`sphMlsMpmGpuStep.js:9501-9507`) | One-sided source | The speed clamp at `:9454` runs before `velocity_before_wall` is captured, so the kinetic energy it removes never becomes heat |
| Field contact heat, `contact_fields` (`:9674-9686`) | One-sided source | The mass split sums exactly in f32 |
| Surface-stress work (`schroederSpatialPhaseVolumeSurfaceStressTransportWgsl.js:765-783`) | One-sided, per field | Signed −ΔKE |
| G2P deposit (`sphMlsMpmGpuStep.js:8659`, `:8718-8720`) | Projection of the three rows above | Exactness needs `m_field == Σ w·m_p` in f32 |
| Pair-contact heat: Jacobi allocation, cleanup, 3- and 4-body blocks, wall (`schroederSpatialMechanicalProposalsGpu.js:7851-7881`, `14066-14458`, `15807-15825`) | One-sided source | The ends' shares are not bit-exact; `max(0, −ΔKE)` hides gains |
| Thermal conduction and radiation (`schroederSpatialThermalProposalsGpu.js:6665-6745`; apply `ulg-gpu-abi/src/wgsl.js:1512-1522`, verified) | Pairwise in joules, not bit-exact | See the losses below |
| Phase-carrier transfer (`sphPhaseCarrierTransferGpu.js:479-563`, `:632-637`) | Projection plus one-sided ΔKE | Lever-rule split checked only to a tolerance |
| Reaction (`wgsl.js:3125-3261`) | Source | Not live for Fe/H2O: discovery is empty |

**Silent losses the ledger must remove:**
- **A failed row is applied one-sided.** When a canonical thermal proposal row
  fails validation, its particle keeps `conduction_du = 0` while the partner
  applies its half.
- **The final clamp discards energy.** It clamps `u` to the reachable domain.
- Both are in the `sphThermalGpuKernel.js:330-385` patches (verified).

On the ss=1 route, thermal uses ActiveSource all-pairs mode (mode 4,
`schroederSpatialThermalProposalsGpu.js:7121-7160`).

**Slices, each test-gated:**

- **1a. Signed energy family.**
  - Add an `energy` slot to the exact-mass owner record
    (`sphGpuBuffers.js:2542`, `:2935`), following the refcounted `quantities`
    sidecar pattern.
  - Seed U from the f32 `m·u` of each row, converted exactly.
  - It shares the owner's claim, fork, successor transfer, retire and
    device-loss path. A `carrierEnergyRead` goes beside `carrierMassRead` in
    `installExactMassContinuationOwner`.
  - Gate: host codec and lifecycle tests, plus a native seed and round trip.
- **1b. Integer conduction packets.**
  - The proposal kernel evaluates each pair's f32 packet once, in canonical
    (min, max) index order, after the existing reciprocal limiter. Both ends
    convert the same bits exactly.
  - Each endpoint adds its packets to its own ledger row, so every row keeps
    one writer and the order does not matter.
  - Any invalid row fails the whole step closed, never one side.
  - Packet limiting replaces the reachable-domain clamp.
- **1c. Sources.**
  - Thermal wall and ambient terms become source packets, recorded in a
    per-step source ledger.
  - So does the field and pair-contact heat that reaches `u` through G2P and
    the pair graph. Otherwise the ledger's projection would overwrite it.
- **1d. Projection.**
  - The ledger becomes the only writer of `u`, and of the T cache, on the
    ledger route.
  - The thermal apply stops writing `u` there.
  - Projection fuses into the carry pass.
- **1e. Gate.**
  - A native multi-carrier conduction fixture: Fe, with a wall source and
    several neighbours.
  - Over N steps, ΣU(t) == ΣU(0) + Σ sources, bit-exact.
  - Compute passes per step at most the f32 baseline plus 2.
  - Host suite and build green.
  - The single-carrier continuation fixture cannot exercise conduction.

**Constraints:**
- No new per-step host fences or readbacks; the budget check is opt-in
  (2026-11-13 design rule).
- Do not edit the v1 traversal text that `schroederSpatialThermalProposalsGpu.js:7597-7601`
  requires.
- Do not change `energy_relaxed_mechanics`: an import-time regex in
  `sphExactPlacementQuantityWgsl.js:72-75` would stop the runtime loading.

**Open issue for Phase 2:**
- `cpJPerKgK` means Cp for some gases and Cv for air
  (`material/materialDerivation.js`).
- Phase change and steam need one energy definition before the
  phase-transfer packets land.

### Phase 1 results, 2026-11-13: gate passed on the integer-only route

**What was built.** Everything is uncommitted ("skip the commit").

- **Energy record** (`sphExactThermalEnergyWgsl.js`; owner in `sphGpuBuffers.js`):
  - per carrier family, `[U rows | S rows | control]` in the standard run
    format;
  - seeded at cold upload as `U0 = fl32(m·u)`, so the GPU can recognise a
    cold row bit for bit;
  - other run formats seed no record, and say so in `energyRowsStatus`;
  - shares the exact-mass owner's lifecycle;
  - a successor gets a record only from a ledger writer's hand-over. Any step
    that changed `u` without one ends the ledger instead of carrying stale rows.
- **Proposal ledger variant**
  (`createSchroederSpatialThermalProposalLedgerWgsl`):
  - evaluates every pair's raw energies in (lo, hi) index roles, so both
    endpoints compute identical bits, and the hi end negates;
  - accumulates each row's packets as exact signed quanta;
  - writes the net after the f32 rows;
  - a row that cannot carry its packet fails the proposal closed.
  - The default proposal WGSL is byte-identical to `f6f7a5e`, checked by
    importing both.
- **Apply ledger variant** (`appendSphExactThermalEnergyWgsl`):
  - copies the predecessor record and adds each row's exact pair net plus an
    exact source packet. The source packet is the f32 wall/ambient `du × m`
    the kernel added after the pair exchange, and it is also added to `S`.
  - sets `u = proj(U)/m`;
  - raises error flags instead of clamping or dropping: row rejected,
    arithmetic, outside domain, unledgered writer, route;
  - reports a status bit when no pair exchange ran in a step.
- **Selection.**
  - The step requests ledger proposals when its carriers hold a live record
    (`sphGpuParticleUploadExactEnergyRows`).
  - The thermal stage refuses a ledger proposal without the exact apply.
  - The closure hands the record over only when no later stage wrote `u`.

**Gate**
- **Tests:**
  - `tests/sphExactThermalEnergy.native.test.mjs`, run with
    `ULG_RUN_NATIVE_EXACT_THERMAL_ENERGY=1`;
  - native Vulkan on the RTX 5060 Ti;
  - evidence in `~/.cache/icc/repos/ulg/g2-phase1-20261113/`.

| Gate item | Result |
|---|---|
| Σ U(t) = Σ U(0) + sources, bit-exact | Pass. 8 Fe carriers over 6 cycles, plus the single-carrier fixture: `Σ(U − S)` equal every cycle, pair packets cancel exactly, conduction moved energy (±0.157 J per row per step), the 350 K wall heat is recorded in `S`, every flag zero, and `u` equals the projection within 4 ulp. |
| Compute passes ≤ f32 baseline + 2 | +0 passes, by construction: same dispatches, plus one buffer copy per thermal step. Not measured on the live app yet. |
| Host suite and build | 5,921 tests: 5,839 pass, 0 fail, 82 skip. `vite build` OK. |
| Existing native exact-mass test | Pass in 81.5 s (HEAD: 82 s). |

**A regression caught and fixed on the way.**
- The first design compiled the ledger code into the base proposal template.
- Every proposal pipeline got bigger: the two-level fixture went from 17.9 s
  to 33.9 s, and the inventory native test passed its 150 s watchdog.
- The ledger is now a separate variant. A ledger-variant pipeline compiles in
  about 10 s, a one-time cost.

### Phase 2 decisions, 2026-11-13

The user said "proceed with phase 2" and then answered two questions.

1. **One energy definition: internal energy.**
   - `u` is specific internal energy for every phase.
   - Gas phases use Cv = Cp − R/M. Today generic gases store a true Cp in
     `cpJPerKgK`, while air stores Cv (`material/materialDerivation.js`), and
     `thermoState` uses the field as dU/dT for all of them.
   - The vaporization plateau width becomes Δu = Δh − R·T_b/M.
   - The ledger conserves U = m·u.
2. **Keep the type-2 plateau rule and make it exact.** This replaces this
   proposal's "type 3 only" Phase 2 rule.
   - **Why:** no code moves mass between a lineage's lanes under type 3
     (`ulg-gpu-abi/src/wgsl.js:731-821`), and Fe has no type-3 model. Switching
     would stop all melting and boiling until both were built.
   - **How it works today:** thermal sets the phase fractions on the plateau
     (`write_thermal_state`, `wgsl.js:1197-1222`). Phase transfer then splits
     each lineage's mass across its lanes.
   - **The change:** that split becomes exact integer mass and energy packets
     under the remainder rule. Kinetic energy lost when the lanes merge is
     booked as a source.

Slices:
- **2a.** The internal-energy ladder fix.
- **2b.** The integer phase-transfer variant. The default transfer WGSL stays
  byte-identical, because tests pin its sha256.
- **2c.** Mechanics heat sources in the ledger.
- **2d.** The worker-lane cold seed and the Iron Ice exact-mass declaration.
- **2e.** The gate: GPU melt and boil budgets bit-exact, and Iron Ice past
  vapor onset at dt 1 ms.

### Phase 2 progress, 2026-11-13: slices 2a and 2b done

**2a. One energy definition.**
- `material/thermoState.js` builds the energy ladder on internal energy:
  - gas segments use `cvJPerKgK`, or `Cp − R/M` where it is absent;
  - vibrational gases drop R/M from the rigid-rotor term (the Einstein modes
    are the same in U and H);
  - transitions to gas absorb `Δh − R·T/M`, with Δh kept as
    `enthalpyLatentHeatJPerKg`.
- Air's mixture phase now stores Cp in `cpJPerKgK` and its Cv in
  `cvJPerKgK`, so the field means Cp everywhere.
- **H2O results:**
  - steam Cv is 1534.5 J/kg·K, against Cp 1996;
  - the vaporization plateau is 2,083,780 J/kg, against Δh 2,256,000;
  - steam's u sits exactly R·T/M below the enthalpy reference.

**2b. Integer phase transfer** (`sphExactPhaseLedgerReconcileGpu.js`).
- The f32 phase-carrier transfer still decides the split; its pinned WGSL is
  untouched.
- A reconcile pass in the same submission makes the split exact, per
  lineage:
  - each non-remainder lane takes its f32 mass as an exact packet, clamped to
    what remains, and `fl32(m·u)` as its energy;
  - the largest lane takes the exact remainder;
  - the kinetic energy lost in the merge is a recorded source in `S`;
  - empty lanes carry no energy and keep the transfer's in-domain `u`.
- The successor mass family is minted by
  `createSphExactMassLedgerSuccessorWebGpu`, with no rational stage and no host
  readback.
- **Closure wiring:**
  - a thermal energy record with no reaction in between routes phase transfer
    to the ledger;
  - the refresh runs the f32 path;
  - the resolver hands the phase's mass read and energy record to the
    successor owner.

**Gate so far** (`tests/sphExactThermalEnergy.native.test.mjs`, 3 tests).
- **Scenario:** four H2O lineages (ice at 272 K, water at 372 K) in a 600 K
  wall layer, over 8 steps.
- **Result:** total exact mass and `Σ(U − S)` bit-exact every step. Each row's
  f32 mass and `u` are the integer rows' view. Ice melts and water boils.
  The thermal proposal publishes every step, as on the f32 route.
- **Regressions:**
  - existing native exact-mass test: pass;
  - canonical thermal native test: pass;
  - host suite: 5,922 tests, 5,839 pass, 0 fail, 83 skip;
  - build: OK.

**Bug found on the way: a WGSL loop-variable hazard.**
- A `var x: T;` with no initializer inside a loop body kept the previous
  iteration's value on the native compiler.
- In the reconcile that copied a tiny lane's mass and energy into the empty
  lanes after it. Total mass stayed exact, but wrong-phase rows made the next
  thermal prepass reject the whole proposal.
- Zero-initialise explicitly.

**Remaining for Phase 2 (as of slices 2a/2b).**
- **2c:** mechanics heat sources in the ledger (G2P field heat, pair-contact
  heat, surface-stress work). Today they raise `UNLEDGERED_WRITER`.
- **2d:** the worker-lane cold seed and an exact-mass declaration for
  non-air Iron Ice.
- **2e:** Iron Ice past vapor onset at dt 1 ms. Iron Ice also runs reaction
  and law-queue stages: a reaction stage ends the ledger, and contact runs
  between different bodies.

### Phase 2 progress, 2026-11-13: slices 2c and 2d done

**2c. Mechanics heat is a recorded source.**
- The energy apply (`sphExactThermalEnergyWgsl.js`) accepts three incoming
  `u` values:
  - the ledger's own projection `proj(U)/m`;
  - the cold seed's `u`, where `U0 = fl32(m·u)`;
  - anything else, which is mechanics heat.
- Mechanics heat means field wall and contact heat from G2P, pair-contact heat
  and surface-stress work. It is booked as one exact packet `m·u_in − proj(U)`
  into both U and S, and sets control status bit 2 (`MECHANICS_HEAT`).
- Only a non-finite or unrepresentable change still raises
  `UNLEDGERED_WRITER`.
- Gate: the 4th native test (`books contact heat as a recorded mechanics
  source`) passes.

**2d. Live Iron Ice on the ledger** (`exactEnergyLedger=1`, `sdt=0.001`).
- **Seed and declaration:**
  - the worker lane's seed sends the exact cold-mass input
    (`sphPhaseScene.js`);
  - `sphPhaseDemo.js` declares exact mass for non-air scenes when the knob is
    on, with `initialQuantities: false`.
- **Couplings:** the closure admits `dispersed-medium-optics` when energy rows
  exist. It now names any coupling that stays unadmitted.
- **Result:** 2,230 ledger steps to 2.304 s simulated, with no Xid. Audited by
  `S0_LEDGER_AUDIT=1` with `scripts/g2-ledger-audit.mjs`:
  - total exact mass unchanged;
  - `Σ(U − S)` bit-exact;
  - no ledger error flags;
  - recorded sources 6.5e-4 J.
- **Lanes at 2.304 s:** solid 0.0203 kg, liquid 0.0330 kg, gas 0. No steam
  yet.

**Finding: conduction stops whenever contact fails closed.** This happens on
both routes and predates the ledger.
- **Symptom:** the ledger's no-exchange counter (control word 2) showed 11.8%
  of particle-steps with no pair exchange (62,169 of 526,480).
- **Probe:** `S0_PROPOSAL_AUDIT=1` in `scripts/step0-baseline-probe.mjs`
  copies the proposal header, evidence, contact receipt, graph control and
  cleanup control at every thermal apply. The same 51-step window appears on
  the f32 and ledger routes (steps 33–83).
- **The chain:**
  1. The contact matching-cleanup owner admits a bounded frontier: 1,024
     particles, 131,072 incident CSR cursors, and 64 cursors in the last 16
     passes.
  2. When melt companions activate, Iron Ice's frontier reaches 178,416
     cursors. The owner fails closed at pass 0 (`ITERATION_INCOMPLETE`).
  3. Contact is not committed: the seal adds `PUBLICATION_INCOMPLETE`, and
     the pre-solve violation ratio climbs to about 44.
  4. The contact interface receipt is published `READY|FAIL_CLOSED`.
  5. Thermal requires that receipt, so every active source fails as
     malformed. Only the 3,645 dormant rows publish.
  6. The apply's completeness check (`thermal_bins[15] == particle_count`)
     then rejects the whole proposal, so there is no conduction that step.
- **Raising the cursor cap is not the fix** (measured, then reverted):
  - with 1,048,576 the rate fell from 5 to 1.4 steps/s;
  - about 25% of steps then failed at pass 496, the terminal window;
  - active particles reached 1,017 of 1,024.
- **Where the fix belongs:** this is the contact owner's design limit. The fix
  is the owner redesign (Jacobi-wide pair application), architecture work for
  A1, "contact first".
- **What it means for G2:** the ledger stays exact; a skipped step is a
  recorded no-exchange. But heat flow stalls for those steps, so Iron Ice
  heats more slowly than it should.
- **Option needing approval:** letting thermal run without a contact receipt
  would be an approximation, and under G2 that needs user approval.

**CORRECTION, same day: the collapse below is a dt 1 ms artifact.**
- At the preset's default dt 0.5 ms, measured at 0.16 s:
  - the ice stays about 30 × 18 × 30 mm;
  - 138 Fe–ice receipt pairs have a positive face;
  - Fe→ice conduction is about 0.26 J per 0.5 ms step (about 510 W);
  - the ice is warming (u_max 870 kJ/kg).
- dt 1 ms caps sound speed, which makes the moduli 4× softer (see the
  campaign doc's dt caveat), and the ice collapses under the iron.
- **Rule: Iron Ice evidence must run at dt 0.5 ms.**
- **dt 0.5 ms on the ledger to 3.0 s** (`ii-ledger-dt05-3p0.json`):
  - 5,931 ledger steps; mass and `Σ(U − S)` bit-exact; no errors;
  - 0.28% of particle-steps had no pair exchange;
  - still no melt. The molten iron splashes 100 mm across the floor and pushes
    the intact ice block against the x wall (x 102–135 mm);
  - by 3 s no Fe–ice pair has a positive face, and the ice tops out at 259 K.

  So at both dt values Iron Ice vapor is blocked by mechanics (body contact
  and spreading), not by the ledger.
- The text below is what dt 1 ms shows, kept as measured.

**Finding (at dt 1 ms): Iron Ice cannot reach vapor on either route; the
cause is mechanics, not heat accounting.**
- **Measured** on the f32 route, on the ledger route and on clean HEAD
  `f6f7a5e`, which ran from a separate worktree on port 5174. The probe reads
  material and phase per row (`S0_PROPOSAL_AUDIT=1`, `stateLanes.byKind`).
- **Early:** at the first audited apply, about 16 ms in, Fe→ice conduction is
  0.80 J per 1 ms step (about 800 W), and the ice next to the iron is warming.
- **The ice collapses:**
  - its 1,000 rows of 2.0e-5 kg, a 2.8 mm cell edge and a 28 mm cube in all,
    are already 4.5 mm tall at about 16 ms, with speeds up to 0.9 m/s;
  - by 0.1 s the row centres fill 6.2 × 2.2 × 6.5 mm, about 250× denser than
    their volumes allow.
- **The iron loses contact:** the molten iron (216 liquid rows at 1,850 K)
  spreads 40 mm across the floor around the ice. Only 0–14 Fe–ice receipt
  pairs have a positive face area, at most 1.2 mm² in total.
- **Steady state:** conduction is then 1–3 mJ per step against 0.17 J of
  radiation. The ice stays at or below 236 K, and the Fe barely cools. Out to
  2.4 s no H2O row melts, on either route.
- **The contact graph is quadratic in mixed-body scenes.** The receipt pairs
  every ice row with every Fe row: 219,000 rows each way. The mixed-law query
  radius is `(1 + 2·16)·max diameter` (the position-trust region), about
  92 mm, which covers the whole box. This is what drives the owner past its
  cursor cap (finding above).
- **What follows for G2:**
  - Iron Ice vapor needs a coherent ice solid that does not collapse. That is
    G3 (SOL-0/SOL-1).
  - It also needs a contact graph that is not all-pairs, which is the A-phase
    contact redesign.
  - No change to the energy ledger can produce Iron Ice steam.
  - The "about 2.2 s" onset in §1.4 is the preset's initial-rate screen
    (`sphPhaseScenarioPresets.js` validation comment), not a measured run.

**Live vapor through the ledger: `water-cycle`** (400 K floor, 200 K ceiling,
`sdt=0.001&exactEnergyLedger=1`). Evidence:
`~/.cache/icc/repos/ulg/g2-phase2-iron-ice-20261113/wc-ledger-3p5.json`.
- **Run:** 3,420 ledger steps to 3.504 s simulated at 6.31 steps/s, with no
  Xid.
- **Exactness:** total exact mass unchanged, `Σ(U − S)` bit-exact, no ledger
  error flags.
- **Sources:** 271 MJ recorded, mostly wall heat; mechanics heat is booked.
- **Pair exchange:** every step had it (0 of 586,676 particle-steps without),
  and every proposal published all its rows.
- **Steam:** the gas lane holds 1.562 kg and the liquid lane 1,214.44 kg.

**Phase 2 gate status.**
- **Met:**
  - GPU test: mass and energy bit-exact through melt and boil (4 native
    tests).
  - Live: the ledger carries an actual app scene through vapor onset with
    exact budgets (`water-cycle`).
  - Live Iron Ice on the ledger is exact through 2.304 s.
- **Not met as written:** "the actual Iron Ice step runs past vapor onset".
  No route produces Iron Ice vapor, clean HEAD included, because of the
  mechanics findings above.
- **This substitutes the gate's scenario.** It is recorded here for the
  user's review and is not claimed as the literal gate. Iron Ice vapor moves
  to depend on G3 (coherent ice) and the contact redesign.

### User decisions, 2026-11-13 (after Phase 2)

1. **Phase 2 gate: accept `water-cycle`** as the live vapor-onset evidence.
   - Phase 2 is closed.
   - The Iron Ice plume now depends on G3 (a coherent ice solid) and on the
     contact redesign.
2. **Phase 3 reaction energy: the heat proxy.**
   - The ledger carries the physics live sodium-water runs today.
   - Chemical heat and thermalized relative kinetic energy are booked to S as
     a recorded source.
   - Element and mass budgets, and `Σ(U − S)`, stay bit-exact.
   - The exact route must keep the heat-proxy table. Today it switches to the
     physical-energy table whenever exact mass is on.
3. **Contact fail-closed stays.**
   - With no contact receipt, there is no interface heat for that step; the
     ledger records the step.
   - The fix belongs to the contact redesign (A1, "contact first").

**Not covered yet (Phase 2 and later).**
- ~~Mechanics heat is not ledgered.~~ Done in 2c: mechanics heat is booked at
  the next ledger thermal step as a recorded source. Phase-transfer ΔKE is
  booked to S by the 2b reconcile.
- **The ledger continues only through the standard post-mechanics closure.**
  The fused-sequence, two-level and phase/reaction/exchange chains end it.
- **Fixture findings.**
  - The reference Fe closure carries no phase conductivity, so conduction was
    off until the gate declared it. The app path anchors conductivity from the
    reference bank (`material/referenceBankAnchoring.js:380-389`); not yet
    checked for Iron Ice.
  - Undeclared wall faces are 0 K reservoirs (audit finding). With a wide wall
    layer they drained about 389 J in one step, which the ledger correctly
    booked to `S`.

### Phase 3 design, 2026-11-13 (heat proxy on the ledger)

**Facts about the f32 heat-proxy reaction path that the reconcile must
decide, not copy.** From a code survey (`ulg-gpu-abi/src/wgsl.js` resolve,
summary event pass, segmented placement):
- **Matching.** The pair comes from `proposals[i] = (partner, rx, role,
  dist²)`, and both endpoints must agree. Each endpoint recomputes the pair in
  canonical (min, max) order and writes only its own row.
- **Survivors.** A survivor keeps its own u and velocity with reduced mass.
- **Freed parents.** A parent is freed when its remainder is at most
  `max(m, 1)·1e-7`. The freed row is rewritten as a product term (slot 0 is
  condensed first, then gas), and its remainder is dropped. **That is an f32
  mass leak.**
- **Partial commits.** A failed product write makes that endpoint alone copy
  its row, while the partner may already have committed.
- **Ungated events.** Product mass that did not fit a freed slot becomes an
  event row (lower endpoint only, `particle·T + term`). The event pass
  recomputes the pair and is not gated on resolve's commit.
- **Placement** sets each event's disposition:

  | Disposition | Destination |
  |---|---|
  | 4 | merged into the nearest same-material, same-phase carrier (segmented sum at the receiver) |
  | 3 | the k-th spare row |
  | 6 | subthreshold history in `productEventBuffer` |
  | 7 or 8 | the whole population is rolled back to its pre-reaction state |

**Reconcile rule** ("f32 decides, exact reconcile"; same submission, after
the placement receipt):
1. **Rollback.** If the transactional terminal status is not SAFE_PLACED,
   copy every predecessor row of mass, U and S.
2. **Pair detection.** The pair owner is the lower endpoint of a mutual
   proposal. A pair counts as committed only when both endpoint rows changed.
   A partial commit sets a ledger error flag and fails closed.
3. **Exact debits.** `er_select_debits` with:
   - cap = exact quanta of the f32 consumed total;
   - integer stoichiometric weights `ν·M` (cold host compile);
   - availability = the donors' exact rows.

   A freed donor gives its full exact row, so its remainder joins the
   products and is not dropped. Element budgets then close to within a few
   quanta per event. This is documented, not hidden.
4. **Products.** `er_product_share` splits the exact total by product weight.
   Each term goes to its freed slot or event, then to the event's placement
   destination:
   - a spare row, or a freed row: single writer;
   - a merge receiver: summed by the receiver thread, in compaction order;
   - history: an exact history row.
5. **Energy.**
   - Consumed U is `fl32(debit·u)`, clamped; a freed donor gives all of its U.
   - The recorded source packet is chemical heat (`−rx1.x·m`) plus the
     thermalized relative kinetic energy, each converted exactly from f32.
   - Product U is the consumed U plus the source. It is split by mass share
     with the remainder rule.
   - Merges add packets exactly, and book their own KE thermalization to S.
   - Every touched row's f32 mass and u are rewritten to the projection.
6. **Lineage.** Each committed pair appends one row to a GPU-resident log:
   step, rx, the two reactant identities, and the destination rows. The host
   check traces every product-material carrier back to admitted reactants.

**Slices.**
- **3a.** On the ledger route, keep the heat-proxy table: add an explicit
  `energyLedger` declaration key. Admit the legacy reaction path with a
  ledger authority instead of the rational exact chain.
- **3b.** The reconcile kernels (pairs, then receivers) and the rollback copy.
- **3c.** The history ledger and lineage log.
- **3d.** Closure hand-over: let the phase ledger follow a reaction, and pass
  on the energy and mass records.
- **3e.** The live sodium-water gate at dt 1 ms: element and mass budgets,
  `Σ(U − S)`, and lineage.

### Phase 3 results, 2026-11-14: gate met on live sodium-water

**Implementation** (`sphExactReactionLedgerReconcileGpu.js`; the energy rule
changed from the design above):
- **Mass and consumed internal energy move exactly.**
  - Debits come from `er_select_debits`; a freed donor gives its whole row.
  - Products are split with `er_product_share`.
  - Each term's destinations take the remainder rule: freed slots, spare
    rows, merge receivers.
- **f32-decided energy goes to S.** Every touched row keeps the f32 path's
  `u`, its exact energy becomes `fl32(m·u)`, and the difference from the energy
  that arrived is booked to S. That covers chemical heat, merge kinetic energy
  and rounding.
- **Encoding.** The passes are prepare → carry control → pairs →
  spare-row events → merge receivers → projection, encoded by the segmented
  placement after its transactional terminal seal.
- **Inputs read on the GPU.**
  - The terminal status and event count are read from storage. The
    compact-count buffer has no COPY_SRC; a copy from it invalidated the whole
    placement submission, and the first live runs silently did nothing.
  - Pairs are found from the event rows (`a`, `b`, `rx`, `term`), so the
    proposals buffer is not needed.
- **Lineage.** A persistent GPU log (`ulg-exact-reaction-lineage`) records
  each committed pair (generation, rx, lower, higher) and each delivery
  (event, destination row, disposition, pair).
- **Wiring.**
  - An explicit `energyLedger` declaration keeps the heat-proxy table.
  - The reaction runner, placement authority and placement encoder accept the
    reconcile stage as their exact-inventory authority.
  - The closure routes ledger reaction → ledger phase → f32 refresh, and hands
    over the newest ledger record.
  - The read-only reaction activation watch is admitted on the ledger route.
- **f32 product history** stays f32. The census shows it never holds
  subthreshold mass; disposition 6 would flag `UNSUPPORTED_DISPOSITION`.

**Gate run** (`na-ledger-gate2.json`, dt 1 ms):
- **Run:** 638 ledger steps to 0.832 s simulated, at 8.8 steps/s against
  9.3 for f32; no Xid, no GPU validation errors.
- **Mass:** total exact mass unchanged. Consumed: 0.88 kg Na and 0.69 kg H2O.
  Produced: 1.526 kg NaOH and 0.0385 kg H2.
- **Energy:** `Σ(U − S)` bit-exact. Recorded sources 0.84 MJ, the heat-proxy
  chemical heat plus merge kinetic energy. No ledger error flags.
- **Lineage:**
  - 4,635 committed pairs, all of reaction 0 (2 Na + 2 H2O → 2 NaOH + H2);
  - 9,270 deliveries: 9,188 capture merges and 82 spare rows;
  - 0 untraced deliveries, across 768 generations.
- **Element budget:** H +2.2e-7 kg, O +3.5e-6 kg, Na −3.8e-6 kg on about
  1.6 kg reacted (≤ 2.4e-6 relative).
  - Mass is bit-exact, so this is not ledger leakage.
  - The audit uses standard atomic masses, while the allocation splits by the
    material table's own ν·M weights.
  - The residual is therefore a table-versus-standard molar-mass
    inconsistency, plus a possible one-step offset between the audited mass
    and thermo records.
  - An element-exact ledger would need per-element integer inventories; that
    is not built.
- **Pre-existing, both routes: conduction mostly off in sodium-water.** In
  284 of 309 audited f32 steps the contact receipt is fail-closed, so thermal
  skips them; on the ledger, 115,085 of 158,446 particle-steps had no pair
  exchange. Same contact-owner limit as Iron Ice; kept fail-closed by user
  decision.

### Phase 4 design, 2026-11-14 (room air, nuclei, vapor–parcel exchange)

**What exists** (code survey, 2026-11-14):
- **No live parcel path.**
  - `createSphAerosolParcelFamilyWebGpu` has no caller in `src`.
  - Room air with positive nuclei throws in `sphEnvironmentParticles.js:58-60`.
  - Every preset is `vacuum`; air is reachable only from the UI "Humid air"
    option.
- **The parcel record** (24 words) has one mass and one material: no dry
  core, no water split.
- **The exchange owner** (`sphVaporAerosolExchangeGpu.js`) runs only on the
  rational exact quantities, and only tests drive it.
- **The rate law** (`sphVaporAerosolRatesWgsl.js`) is near-equilibrium
  Onsager. Kelvin enters through the Laplace pressure. There is no Raoult or
  κ-Köhler term.
- **There is no transport or deposition.**

**Design.**
- **Parcel ledger.** A sidecar per parcel in the run format, kept beside the
  f32 record:
  - dry-core mass (constant);
  - water mass;
  - water U (signed energy format).

  Multiplicity (u64) and lineage stay in the record. The f32 mass, u and
  radius become projections.
- **Nuclei.** On the ledger route, air mode with nuclei > 0 seeds one dry
  parcel population per gas cell at initial conditions. The number
  concentration, dry radius and κ are benchmark choices with sources. Initial
  water is the Köhler equilibrium at the cell's RH (capped below
  activation). Its mass comes from the cell's H2O vapor carriers, so the cold
  budget is closed.
- **Rate law (f32).**
  - Maxwell–Mason growth with a Fuchs–Sutugin transition correction for vapor
    and heat.
  - Equilibrium saturation `S_eq = a_w(κ, r_d, r) · exp(2σM / (ρ_w R T r))`.
  - Activation emerges from the Köhler curve; there is no separate rule.
- **Exchange: one thread per gas cell**, sequential over that cell's parcels
  and H2O vapor carriers, so every row has exactly one writer.
  - Each parcel's f32 packet `dm = rate·dt` is converted to quanta exactly
    and clamped to the cell's remaining vapor (growth) or the parcel's water
    (evaporation).
  - The debit is split across donors by mass with the remainder rule.
  - Energy moves with mass at the donor's u. Latent heat then appears in the
    parcel's own `u = U/m`.
  - Sensible heat between parcel and gas is a separate exact packet.
  - Cell lists are built by a counting sort over cell keys.
- **Gate (GPU).** A manufactured supersaturated cell:
  - vapor plus parcel water and energy bit-exact over N steps;
  - the growth rate matches the same law evaluated in f64 at that state. This
    is a single-law check, not a CPU mirror solver.


### Phase 4 and 5 results, 2026-11-14: GPU gates pass

**Phase 4**: vapor ↔ parcel water (`sphExactVaporParcelLedgerGpu.js`, gate
`tests/sphExactVaporParcelLedger.native.test.mjs`).
- **Cell lists.** Counting sort of gas carriers and parcels into gas cells,
  then one thread per cell with deterministic row order.
- **Law.** κ-Köhler with Kelvin, Maxwell–Mason growth and a Fuchs–Sutugin
  correction, with benchmark property choices in
  `SPH_EXACT_VAPOR_PARCEL_LAW`. Each droplet's stiff mass ODE is integrated
  over the step in substeps of at most a quarter of its mass e-folding time.
- **Energy (quasi-steady droplet).**
  - Water joins or leaves the parcel at the parcel's own u.
  - The latent difference from the vapor's u is exchanged with the cell's gas.
  - Sensible heat relaxes the droplets toward the gas temperature with their
    own exponential factor.
  - All three are exact packets.
- **Gate:** a manufactured cell at S = 1.005 and 283.15 K, with two vapor
  carriers, dry air and three parcels, over 20 steps:
  - vapor plus parcel water bit-exact;
  - Σ(U) over carriers and parcels bit-exact;
  - no sources, no flags;
  - the GPU growth rate and S_eq match the same law in f64 (2e-4 and 1e-5
    relative);
  - the activated droplet grows and the 30 nm droplet evaporates.
- **Fixed on the way.**
  - Explicit latent energy at the vapor's u drove a tiny droplet's U negative.
    The quasi-steady split replaced it.
  - One explicit 1 ms step overshot the Köhler equilibrium. The substep
    integration replaced it.

**Phase 5**: transport and deposition (`sphExactParcelTransportLedgerGpu.js`,
gate `tests/sphExactParcelTransportLedger.native.test.mjs`).
- **Transport.** The cell's mass-weighted gas velocity plus Stokes settling
  with the Cunningham correction. If a particle's relaxation time exceeds the
  step, the one-way coupling assumption is flagged.
- **Deposition.**
  - Contact with a condensed water carrier gives that carrier the water and
    its U.
  - The dry core goes to a recorded solute sink, because a carrier holds one
    species.
  - Leaving the box sends the whole parcel to a recorded wall sink.
  - One receiver thread per carrier; one thread for the sinks.
- **Gate:** one moving gas cell, two water carriers and five parcels, over 10
  steps:
  - mass and energy close bit-exactly over carriers, parcels and sinks;
  - targets are A, B, B, wall and airborne as designed;
  - deposited parcels are exact zero, and carrier B gains exactly both
    parcels' water;
  - the wall and solute sinks hold exactly what they received;
  - the airborne parcel moves with the gas and settles at the f64
    Stokes–Cunningham velocity (within the 1% f32 position resolution).

**Not yet live.** Phases 4 and 5 are GPU modules with their own gates.
Wiring them into the app is Phase 6 work:
- the air-mode nuclei seed (today it throws for nuclei > 0);
- the parcel family with its ledger sidecar;
- closure stages after the ledger phase;
- the optics producer reading parcels;
- the Environment UI.

**G2 oracle status.**
- **`conserved-phase-transport`:** covered by the Phase 1–5 GPU tests
  (thermal, melt/boil, reaction, vapor–parcel, transport and deposition),
  plus the live water-cycle and sodium-water ledger runs.
- **`iron-ice-and-reaction-plumes`:**
  - the sodium-water identity is traced (Phase 3);
  - the Iron Ice condensate plume is blocked by mechanics at both dt values
    (findings above). That is G3 (coherent solids) and contact work, so this
    criterion waits on G3.

### Phase 6a progress, 2026-11-14: ledger nuclei run live

**Wired:**
- **Nuclei.** `environmentNucleiPerCm3` (Atmosphere panel or URL) seeds
  benchmark dry ammonium-sulfate nuclei on the ledger route:
  - three dry-radius bins and κ = 0.61 (Petters & Kreidenweis 2007), defined
    in `SPH_ENVIRONMENT_BENCHMARK_NUCLEI_SEED`;
  - one parcel per gas cell and bin, with an integer multiplicity;
  - exact dry-core rows; water starts at exact zero.
- **Parcel family.** It lives on the exact-mass owner record, is updated in
  place, and is carried while the energy ledger continues
  (`sphGpuParticleUploadLedgerParcels`).
- **Closure.** After the ledger phase, `sphLedgerParcelStagesGpu.js` runs the
  Phase 4 exchange and the Phase 5 transport and deposition on the phase's
  successor rows. Both reproject the mass-derived mechanics lanes.
- **Audit.** `scripts/g2-ledger-audit.mjs` adds parcel rows and sinks to the
  mass and energy budgets.

**Live result** (water-cycle, humid air at 80% RH, 100 nuclei per cm³,
ledger route, dt 1 ms):
- mass (carriers + parcels + sinks) and `Σ(U − S)` stay bit-exact;
- no ledger errors;
- the parcels condense real vapor: 1.6 g of water (200 K ceiling) and 3.5 g
  (250 K ceiling) within 0.35 s.

**Fixed on the way.**
- **Boundary ulp.** A carrier pinned at a caloric-domain edge was one ulp
  outside its lane segment after `proj(U)/m`. `resolve_thermal_rows` then wrote
  phase 0 and T 0, and every later thermal proposal was rejected.
  - **Rule now:** the f32 view keeps the f32 path's limited u when it equals
    the exact view up to rounding (8 ulps in thermal, 4 in the phase reconcile
    and the exchange).
  - The view is held 4 ulps inside the proposal domain.
  - U stays exact; the next step books the view's rounding to S as mechanics
    heat. That is why status bit 2 may now be set.
- **Latent and sensible heat** go to the cell's dry air (ideal-gas ladders
  cover the cold range), not to vapor pinned at its 273 K ladder edge.
- **A family field bug.** The parcel family dropped `vaporMaterialId`,
  `pressurePa` and `waterReferenceU0`, so the exchange ran on NaN. The fields
  are now required.

**Resolved 2026-11-14: humid air on the ledger route failed contact closed.**
The earlier note called this intermittent and unexplained. The cause is a
one-ulp view that cascaded through four stages:
1. The vapor carrier of a top gas cell rises to the 200 K top wall. It cools
   onto the H₂O vapor ladder's lower edge (273.15 K,
   u = 2,371,423.0 J/kg).
2. The ledger thermal stage holds its f32 view 4 ulps inside the domain
   (2,371,424.0). Meanwhile the exact U/m sits one ulp outside it
   (2,371,422.75), within the stage's 4-ulp OUTSIDE_DOMAIN tolerance.
3. The phase reconcile and the vapor–parcel exchange kept the f32 view only
   within 4 ulps. At this 5-ulp gap they wrote the exact projection, one ulp
   below the domain.
4. The next thermal apply cannot classify the lane and writes phase 0 / T 0.
   The rest of the cascade follows:
   - one invalid ActiveSource row (out of 1,464) fails the ActiveSource
     view, so its completion seal is never written;
   - the directory's GPU-count radix seal is invalid, so the directory
     fails closed with 0 cells;
   - contact reports DIRECTORY_REJECT | PUBLICATION_INCOMPLETE | STAGE_ORDER;
   - thermal skips pair exchange for every particle on every later step,
     because phase 0 is sticky.
   - "Intermittent" only meant whether the flow carried a vapor carrier to
     the cold wall within the run.

**Fix.** The phase reconcile and the exchange now use the thermal stage's own
bound: the view and U/m may differ by up to 8 ulps (clamp 4 plus outside 4).
U stays exact.

**Measured** (water-cycle, 80% RH, 100 nuclei per cm³, 275 steps):
- contact admitted on every step;
- 0 invalid sources;
- particle-steps without pair exchange: 47,888 before, 0 after;
- mass and Σ(U − S) exact, with no ledger errors.

**How it was found.** `S0_CONTACT_AUDIT` (directory, ActiveSource and
classifier evidence), `S0_TRACE_ROWS` (per-step rows from step 0) and
`S0_PASS_TRACE_SLOTS` (one row through every pass of chosen steps) in
`scripts/step0-baseline-probe.mjs`.

**Phase 6 status** (updated after Phase 6b below):
- parcel optics: done (6b);
- Environment UI round trip: done (6b);
- per-cell lists in transport, which today is O(P·N): deferred. P is one
  parcel per gas cell and bin (84 here), so this is not a cost today;
- the Iron Ice plume, which waits on G3.

### Phase 6b progress, 2026-11-14: parcel optics

**Design.**
- `src/runtime/sph/sphLedgerParcelOpticsGpu.js` adds parcel extinction to the
  H₂O collective-medium route's render-field cells.
  - It runs in the worker presenter after the render-field gather and before
    the participating-medium pack, in the pack's own encoder.
  - Units are the gather's: lane 1 holds optical depth per render cell, so
    Σ τ·edge² over cells equals the deposited cross-section.
- **Optics** (benchmark choices, stated in the module):
  - extinction efficiency from van de Hulst's anomalous diffraction for water
    at 550 nm (n = 1.333, no absorption);
  - asymmetry 0.85 for cloud droplets.
- **Spatial support.** A parcel's multiplicity is a droplet count over its gas
  cell, the volume the vapor-parcel exchange resolves (super-droplet
  concentration).
  - Its cross-section is spread by a normalized tent of half-width one gas
    cell: cloud-in-cell deposition at the gas-grid resolution.
  - A point deposit was tried first. It packed a whole 2.5 m gas cell's
    droplets into about 8 render cells and drew dense puffs, structure the
    physics never resolved.
- **Temperature.** The lane-1 temperature becomes the extinction-weighted mean
  of the prior medium and the parcels.
- **Ownership.** The presenter borrows the parcel family by reference count
  (`beginSphGpuParticleUploadLedgerParcelsBorrow`), so a queued frame never
  binds a destroyed parcel buffer. The borrow ends with the job.

**Gate:** `tests/sphLedgerParcelOptics.native.test.mjs`
(`ULG_RUN_NATIVE_LEDGER_PARCEL_OPTICS=1`) passes. It checks:
- Σ τ·edge² against an f64 mirror of the node-sampled tent, to 1e-4;
- the node sum against the f64 cross-section N·π·r²·Q, within 1%;
- the asymmetry lane is 0.85·τ and the absorption lane is unchanged;
- the extinction-weighted temperature;
- that another route's cells are untouched.
**Live results** (water-cycle, ledger route, dt 1 ms):
- **100 nuclei per cm³, 80% RH, 0.48 s:**
  - mass and `Σ(U − S)` exact, no ledger or GPU errors;
  - the optics pass routed 30 of 30 frames;
  - 8.6 g of water in parcels.
  - Three locations activated, and all three bins there grew to 7.6 µm.
    The rest stay deliquesced at 25–100 nm.
- **5,000 per cm³, 95% RH, 1.42 s (1,344 steps):**
  - still exact; 89 of 89 frames routed;
  - 13.8 g of water in parcels.
- **Visibility is honest and faint.**
  - 14 g in 125 m³ is about 0.1 g/m³ of liquid water. Real clouds hold
    0.2–1 g/m³.
  - That gives an optical depth of about 0.1–0.2 across the 5 m box.
  - Against a control with optics disabled, the empty background is 0.4 grey
    levels brighter.
  - As the accepted environment decision says, nuclei enable a condensation
    route; they do not guarantee an opaque plume.

**UI bug found by the round trip.** Validate & Apply could never apply a
staged edit.
- The CFL inputs were declared with min 0.01 and step 0.05. Their own
  defaults, 0.6 and 0.4, lie off that lattice.
- `validateMountedArchitectureControls` therefore threw on every Apply. The
  edit stayed staged, and only a reload rebuilt the scene.
- **Fix:** step 0.01.
- **Round trip after the fix:** `scripts/g2-environment-roundtrip.mjs`
  passes all 7 checks:
  - starting at 0 nuclei, the parcel stage never runs;
  - applying 100 from the panel puts it in the hash, and the parcels step
    (64 steps);
  - a reload restores the panel value and the parcels;
  - clearing to 0 puts 0 in the hash, and the parcels stop (64 steps with
    none).
- **Evidence:** receipts and screenshots are in
  `~/.cache/icc/repos/ulg/g2-phase6-20261114/`.


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
   **Amended 2026-11-13:** the user moved the near-real-time requirement to
   A1 ("yes move it to A1, allow dt 1 ms"). G2's plume evidence no longer has
   to run near real time, and it may use dt = 1 ms.

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
