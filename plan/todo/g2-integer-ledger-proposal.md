# G2 proposal — exact integer ledgers instead of exact rationals

Status: **proposal for user review, 2026-10-27. Nothing here is built.**
The user paused G2 code changes until this is reviewed ("Stop and review
first", 2026-10-27). Codex's work through R327 is committed locally as
`1ee78bf` (WIP checkpoint, not a milestone). G2 remains 3/6.

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
actual app presents at about 120 Hz (`ui raf 119.9` in the R327 evidence), so
the GPU must time-slice between contexts. Likely mechanism: a pass the driver
cannot preempt within its context-switch timeout kills the channel. This is
**a hypothesis consistent with the evidence, not a proven cause**. It would
explain why the same kernels, at the same capacity, pass in isolation.

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
- Each stage gains a few passes, not thousands.
- Phase 0 below measures this before anything else is built.

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
- **Wall time.** The f32 Iron Ice step rate has not been measured since
  September. The 8,192-step run could take minutes or tens of minutes.
- **The watchdog hypothesis is unproven.** Phase 0 tests it before anything
  else is built.

**Effort.** Roughly two weeks of focused work across Phases 0–6. Phase 0 shows
within about a day whether the premise holds.

## 4. Implementation order and gates

Each phase ends with a gate the user can check. A later phase never starts on a
failed gate.

| Phase | Work | Gate |
|---|---|---|
| 0 | Feasibility probe. Signed energy ledger, pairwise packet kernel, chunked-atomic scatter and projection, at Iron Ice capacity (6,784 rows), inside the actual app while it presents. | No Xid in `journalctl -k`. Measured GPU time per stage. Bit-exact sums over 1,000 random transfers. |
| 1 | Energy ledger through the existing exact-mass continuation (G2P → thermal → refresh → closure → SS publication). Thermal conduction as pairwise integer packets. | GPU test: over N steps, sum U(t) equals sum U(0) plus recorded sources, bit-exact. Host suite and build green. |
| 2 | One phase rule (the type3 caloric model replaces the legacy fixed-boiling writer). Phase change as described in 2.6. | GPU test: mass and energy budgets bit-exact through melt and boil. The actual Iron Ice step runs past vapor onset (~2.2 s simulated). |
| 3 | Reactions: the committed integer allocation plus reaction energy as packets, with lineage ids. | Sodium-water: element and mass budgets, product lineage traced to the admitted reactants. |
| 4 | Room air plus nuclei (dry core and condensed water). Activation and growth/evaporation as exact packet exchange between gas vapor and parcel water. | GPU test: vapor plus parcel water and energy bit-exact. Growth rate checked against an independent CPU reference of the same law. |
| 5 | Parcel transport with the gas velocity (plus settling) and deposition as an exact whole-parcel transfer to a surface carrier. | GPU test: parcel ownership and all budgets bit-exact through transport and deposition. |
| 6 | Optics and desktop evidence: condensate rendered from parcel water mass. Iron Ice run through the plume window, sodium-water lineage trace, Environment UI round trip. | The three `ulg-g2-plumes` oracle criteria, with screenshots and source-bound receipts. |

Phase 0 is small and decisive. If integer ledgers also hit the watchdog in the
live app, this proposal is wrong, and the next step is to prove the
time-slicing hypothesis in 1.2 directly.

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
