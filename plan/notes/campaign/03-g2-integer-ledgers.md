# Campaign note 3: G2, the integer ledgers (design, phases, what "exact" means)

Source: `plan/todo/g2-integer-ledger-proposal.md`, all 1,417 lines, read by
Hermes 2026-11-17. Written 2026-10-27 and extended to 2026-11-14. The later G2
work (rigid ice, the interface law, room air, first-class air) is in
`ss/07-interface-resolution.md` and `ss/04-first-class-air-and-level-chain.md`.

## Why the exact-rational route was stopped (`:13-99`)

- "No exact step has ever completed." Codex's last revision, R327, lost the GPU
  device at pass 41 of phase transfer.
- "The kernel log since 2026-10-24 records 116 losses, all `NVRM: Xid 109 ...
  CTX SWITCH TIMEOUT`". The compositor-preemption explanation is "a hypothesis
  consistent with the evidence, not a proven cause".
- The arithmetic: "a 63-limb numerator and a 63-limb denominator (130 words
  per value)", binary-GCD normalisation. One step reached "compute pass
  ~50,586"; "one plume run takes days".
- Scope had grown: "The 2026-10-24 decision was about **mass precision**."
  Exact rational momentum, energy and volume "came later". "The G2 oracle ...
  asks for conservation of **mass, species, enthalpy and parcel ownership**.
  It does not ask for exact momentum."

This history is why GPU passes in this project must stay short, and why the
owner's hard limit is the window manager.

## The design (`:101-231`)

"Store every conserved quantity as an integer number of quanta in one run-wide
binary format." The quantum is 2^-149 (kg or J), nine u32 limbs. "**an f32
packet converts to 9-limb quanta with no rounding at all.** The f32 evaluation
of the packet is the only approximation. After that, application is exact."

Transfer rule (`:115-126`): compute the packet in f32; convert exactly; clamp
to the donor's exact inventory with an integer compare; subtract and add the
same integer; a donor at exact zero mass gives all its remaining energy with
the last packet; a k-way split computes k−1 parts and "give[s] the last part
the exact remainder".

Sources (`:128-144`): mechanics heat, wall and ambient flux and reaction heat
are one-sided. Each is applied as an integer packet and accumulated in a source
ledger S, so "sum U(t) == sum U(0) + sum of applied source packets ... an
integer comparison with no tolerance."

Exact: carrier mass per species; carrier internal energy U = m·u; parcel
dry-core mass, water and energy. Not ledgered: momentum ("MPM P2G/G2P stays
f32"). Derived f32, "never inventories": temperature, velocity, pressure,
rates, kinetic energy. Pass budget: "the ledgers add at most 2 compute passes
per step to the f32 path."

Owner's answers, 2026-10-27 (`:1296-1310`): "1 yes, 2 sure, 3 disabled, 4 25
min is insane these should run near realtime." Momentum stays f32; a bit-exact
budget with recorded sources "satisfies 'enthalpy conserved'"; the rational
stages are disabled and kept; the plume must run near real time (moved to A1
on 11-13).

## Phases and state

| Phase | Work | State in this document |
|---|---|---|
| 0 | Feasibility probe inside the live app at Iron Ice capacity | Passed 10-27: 1,000 steps and a 7,500-step soak, no Xid, sums bit-exact, "whole probe step 89.2 µs" (`:342-359`) |
| 1 | Energy ledger through the exact-mass continuation; conduction as integer packets | Passed 11-13 "on the integer-only route": 8 Fe carriers, 6 cycles; "+0 passes, by construction" (`:574-579`) |
| 2 | One phase rule; melt and boil exact | Owner decisions: "One energy definition: internal energy"; "Keep the type-2 plateau rule and make it exact" (`:592-609`). Slices 2a-2d done. Gate as written not met; owner accepted `water-cycle` as the vapor-onset evidence (`:832-835`) |
| 3 | Reactions with lineage | Gate met on live sodium-water 11-14: 4,635 committed pairs, "0 untraced deliveries", mass exact, `Σ(U − S)` exact (`:969-979`). Energy by the heat proxy (owner decision) |
| 4 | Room air, nuclei, vapor↔parcel exchange | GPU gate passed 11-14 (κ-Köhler, Maxwell-Mason, Fuchs-Sutugin; one thread per gas cell) |
| 5 | Parcel transport and deposition | GPU gate passed 11-14 |
| 6 | Optics and desktop evidence | 6a nuclei live in water-cycle; 6b parcel optics and the Environment UI round trip done 11-14. "the Iron Ice plume, which waits on G3" (`:1199-1204`) |

G2 oracle at the end of this document (`:1109-1117`):
`conserved-phase-transport` "covered" by the GPU tests and two live runs;
`iron-ice-and-reaction-plumes`: sodium-water lineage traced, the Iron Ice
condensate plume "blocked by mechanics".

## Findings in this document that reach beyond G2

1. **Thermal depends on contact** (`:718-750`). "conduction stops whenever
   contact fails closed". The contact owner admits a bounded frontier (1,024
   particles, 131,072 cursors); when it fails, the contact interface receipt is
   `READY|FAIL_CLOSED`, "Thermal requires that receipt", and the whole proposal
   is rejected. In sodium-water "284 of 309 audited f32 steps" had no
   conduction (`:990-994`). Owner decision 11-13: "Contact fail-closed stays";
   "The fix belongs to the contact redesign (A1, 'contact first')". Raising the
   cursor cap was "measured, then reverted" (5 → 1.4 steps/s).
2. **The contact graph was all-pairs in mixed-body scenes** (`:790-794`): the
   mixed-law query radius "`(1 + 2·16)·max diameter` ..., about 92 mm, which
   covers the whole box". (Changed 11-16: trust 16 → 1.)
3. **dt and stiffness** (`:752-770`). "dt 1 ms caps sound speed, which makes
   the moduli 4× softer ..., and the ice collapses under the iron. **Rule: Iron
   Ice evidence must run at dt 0.5 ms.**"
4. **Iron Ice vapor was blocked by mechanics, not accounting** (`:795-802`):
   it "needs a coherent ice solid that does not collapse. That is G3" and "a
   contact graph that is not all-pairs". "The 'about 2.2 s' onset ... is the
   preset's initial-rate screen ..., not a measured run."
5. **The ledger does not run everywhere** (`:852-853`): "The ledger continues
   only through the standard post-mechanics closure. The fused-sequence,
   two-level and phase/reaction/exchange chains end it." And room air runs f32:
   "`ROOM_AIR_EXACT_MASS_DECLARED = false`" (`:1312-1321`).
6. **One-ulp cascades** (`:1160-1192`). A vapor carrier one ulp outside its
   caloric domain was written phase 0 / T 0; "one invalid ActiveSource row (out
   of 1,464) fails the ActiveSource view"; the directory fails closed with 0
   cells; contact rejects; thermal stops for every particle "because phase 0 is
   sticky". The fix aligned ulp tolerances (8 ulps).
7. Hazards: "A `var x: T;` with no initializer inside a loop body kept the
   previous iteration's value on the native compiler" (`:668-674`); compiling
   ledger code into the base proposal template doubled pipeline compile time,
   so "The ledger is now a separate variant" (`:581-586`); a copy from a buffer
   without COPY_SRC "invalidated the whole placement submission, and the first
   live runs silently did nothing" (`:951-953`).
8. Visibility (`:1250-1257`): with 5,000 nuclei per cm³ at 95% RH, 13.8 g of
   water in parcels gives "an optical depth of about 0.1-0.2 across the 5 m
   box ... the empty background is 0.4 grey levels brighter". "nuclei enable a
   condensation route; they do not guarantee an opaque plume."

## What "exact" means here (Hermes, INFERRED)

The identity that is checked is `Σ(U − S)` constant. S holds wall heat and
mechanics heat, and also every f32-decided difference: in reactions "its exact
energy becomes `fl32(m·u)`, and the difference from the energy that arrived is
booked to S. That covers chemical heat, merge kinetic energy and rounding"
(`:943-946`); in thermal "the next step books the view's rounding to S as
mechanics heat" (`:1152-1153`).

- The ledger proves that no energy or mass appears or vanishes unrecorded. It
  does not by itself prove that the recorded sources are physical: S must be
  read. The document gives it each time (6.5e-4 J on Iron Ice, 271 MJ of wall
  heat in water-cycle, 0.84 MJ in sodium-water).
- Mass is exact per carrier, not per element: sodium-water's element residual
  was "≤ 2.4e-6 relative", from table against standard molar masses; "An
  element-exact ledger would need per-element integer inventories; that is not
  built" (`:980-989`). The oracle names "species".
- Routes without the ledger (two-level, fused/Tier0, room air) have none of
  these guarantees. The flagship plume scene (room-air Iron Ice) is one of
  them. This is the largest gap between "G2 ledgers delivered" and the G2
  acceptance scene.

## The real-time gap, 2026-10-27 (`:1323-1417`): A1's starting measurement

"**Result: 6.4 steps/s, about 159 ms per step.**" Idle between batches (the
presentation hold) ~84 ms, 53%; contact solver 44 ms, 28%; about 100 other
passes 16 ms; CPU and queue waits ~13 ms.

"Removing the presentation hold gives the in-batch rate, about 14 steps/s."
"Even a free contact solver ... caps this pass structure near 35 steps/s,
about 57× short of real time."

"**What real time needs.** No more than about 0.5 ms per step": decoupled
presentation; "A parallel contact solver. It must cost about 0.1 ms, not 44.
The serial owner was already identified as the wall in August; the noted fix
was a Jacobi-wide pair application, not more micro-optimization"; "About 15-25
wide passes per step, direct dispatch only, and K steps per submit with no
per-step CPU waits (the Tier0 pattern)"; ledgers inside the budget (28 µs).

Options: A, the real-time route first with ledgers built in; B, ledgers first.
"Recommendation: A." The owner chose G2 first on 11-13 and moved A's content
into A1. The measured rates reached since (about 20-60 steps/s on the
canonical lane) match the predicted ceiling of the unchanged pass structure.
