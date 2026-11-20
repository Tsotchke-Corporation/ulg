# SS note 7: interface resolution (what happened when the campaign first asked SS to refine)

Source: `plan/todo/interface-resolution.md` (924 lines; 2026-11-14 to 11-16,
uncommitted). Read by Hermes in full, 2026-11-17. It is the first time the
campaign needed SS to do what SS exists to do (put resolution where the
physics is), and it records what was missing.

## The owner's decisions

- 2026-11-14 (`:5-9`): "increase the resolution at the interface because we
  want to support that kind of dynamic functionality and if it tanks our frame
  rate we implement the second method", the second method being an interface
  boundary law. And "make honest walls that aren't infinite sinks".
- 2026-11-13 (cited `:886-887`): on the G2 integer-ledger route, reactions keep
  the heat proxy.
- 2026-11-16 (`:901`): a gauge-consistent heat proxy.

## The refinement design, and why it was not used (`:25-97`)

Criterion (general): a contact pair has an unresolved phase front at i when the
materials or phases differ, a transition temperature T* of i's material "lies
strictly between T_i and T_j", and the pair is within contact support. Such a
row gets refine-pressure reason bit 32, which "flows into the existing split
proposal". Stopping rule: the thermal penetration depth δ = sqrt(α·dt).

Two findings stopped it:

1. **Scale** (`:76-90`). "A carrier is a lumped thermal body. That is valid
   only when its Fourier number αt/L² is at least about 1." For a 5 mm water
   parcel the lumped model is wrong for any contact shorter than about 45 s.
   Fo ≈ 1 for a 0.1 s contact needs L ≈ 0.12 mm: "40× finer in edge, or about
   64,000× more carriers per parcel". The boundary layer over one step is about
   21 µm. "Splitting carriers cannot reach that scale."
2. **Split does not run on the worker lane** (`:92-97`). "Phase-carrier v2
   uses fixed-stride lanes (`phaseLane*phaseLaneStride+lineageIndex`). The page
   path's split/merge appends children and changes the count, which breaks
   that addressing. On the worker lane a split would need a reserve of spare
   lineages ... The dynamic-refinement capability stays open as its own item."
   And (`:56-58`): "Open residue in the SS plan (2026-07-06): a live
   end-to-end run where a split actually fires has never been exercised."

So the campaign took the fallback. Dynamic refinement is still open; it became
first-class-air slice 1 (1a and 1b done, the kernel 1c not).

Hermes, INFERRED: finding 1 is a general statement about SS, not about Iron
Ice. Geometric refinement alone cannot reach a phase front; the front needs a
subgrid closure (the interface law), and refinement serves the scales above
it. That is the Star Spec's ladder: a closure where the regime allows it,
resolution where it does not.

## The interface law (`:99-140`): general, and it lives in SS thermal

"Skin-first phase partition (Stefan condition)". The pair heat is the existing
series law; what changes is where the heat lands inside the carrier. The
contact face sits at `T_if = (G_i·T_i + G_j·T_j)/(G_i + G_j)`; if a transition
temperature of carrier i lies between `T_i` and `T_if`, the excess over what
the bulk can conduct is latent work on a skin, and the skin mass leaves as the
next phase at T*. "No scenario constants"; covers boiling, melting, and in
reverse condensation and freezing.

Where it runs: the SS thermal proposal derive (derived words 10..14), the pair
pass (words 15..22, epoch-stamped), then the f32 phase-carrier transfer.
"**Exact phase-carrier stage:** not wired. Exact routes keep the full energy in
the bulk, as before."

## What broke, in order, and the general fix each time

| Symptom | Cause | Fix |
|---|---|---|
| Rate decays to 0 after the iron lands; "matching-cleanup owner at 212 ms per step" (`:144-151`) | Vapor born at the liquid carrier's own centre, mass ratio ~10⁻⁶ | Vapor is born at the contact face; first moment exact |
| Still stalls (`:173-199`) | "one steam carrier turned every liquid and solid source's query into the whole scene. That is O(N²) cursors": the contact graph's support maxima took every active row, gas included, though gas pairs are never admitted | "Only pair-capable rows (liquid and solid, classes 1 and 2) feed words 0 and 1." General: "any scene with gas carriers" |
| Contact fails every step (`:236-271`) | "free condensed slivers": a freezing skin nucleated a 1.8e-12 kg carrier beside 1e-4 kg neighbours; "The Jacobi contact solve cannot converge at a 10⁸ mass ratio." | A condensed-target conversion is admitted only into a non-empty lane touching the face |
| Permanent stall (`:321-339`) | "cleanup-pass budget exhaustion": the interactive budget is 512 passes, and "a failed step holds the lane on the same input, so a budget shortfall becomes a permanent stall" | Not fixed. 2,048 passes works at 2-8 steps/s and lost the GPU device at 3.07 s of simulated time (`:351-363`) |
| Stalls gone at dt 0.5 ms (`:378-396`) | At 1 ms "the CFL cap makes moduli 4× softer and the pile compresses" | Evidence runs at dt 0.5 ms: 19.3 steps/s, contact fails on 39% of late steps "but recovers" |
| Steam does not rise at 1 atm (`:398-434`) | "A tiny-mass gas carrier inside condensed matter takes the grid velocity ... (a single velocity field)". Slip transport (S9-A/B/C pressure-drag) existed only in the two-level path | See the next section |
| Every step rolled back from 1.804 s (`:794-816`) | Melt release from a rigid solid kept 0 molecules in thermo word 9; steam inherited 0; the gas-ledger EOS rejected it | Release sets entities = m·N_A/M |

"The remaining work is A1 contact-solver liveness and speed" (`:345-349`):
a failed contact step must not hold the lane forever ("This is a user decision;
it touches the sealed solver budget"), and the owner must converge in fewer
serial passes. Both are still open.

## Two-level SS on Iron Ice (`:436-697`, `:848-855`): the most important SS finding

To get slip transport the campaign tried to run Iron Ice two-level
(`&ssTwoLevel=1&schroederTwoLevelAuthority=authoritative`). It failed closed at
step 1. After four rounds of instrumentation:

"**ROOT CAUSE: two-level rejects Iron Ice because its coarse level is empty at
t = 0**". `fineFieldCount=125`, `parentFieldCount=48`, `coarseFieldCount=0`.
"`begin_registry` treats `coarse_count == 0` as a key/phase rejection". The
only live carriers at t = 0 are the 2.8 mm iron carriers on the fine level; the
5 mm meltwater lineages are dormant until the ice melts. "`cesium-fluorine`
works because its two bodies have different pitches, so both levels are live
from the start."

Two general fixes were named (`:609-615`):

1. "An empty coarse level is a valid degenerate macro: fine-only substeps, with
   nothing to reflux."
2. "Per-schedule route selection: run two-level only while both levels hold
   live carriers, single-level otherwise. This is the law-activation pattern."

Option 1 was trialled and reverted: "This is a systematic protocol change, not
a patch"; it "needs zero-count relaxations across about five more kernels".
Status: "**parked** ... a robustness item for two-level scenes whose coarse
level starts empty. Iron Ice no longer needs it."

Instead the transport was brought to one level (`:818-846`): "The one-level
S9-C proposal (fine local heads, coarse level −2³¹, no parent, 2 dispatches)
was already in the ABI. It is now wired end to end" (transport WGSL keys v6,
`resolveSingleLevelPhaseVolumeTransportAuthority`, a new law-activation
receipt field `phaseVolumeInterfaceTransport`). The document says this
"matches the A′ direction: generalize the canonical worker lane rather than
keep a separate route" (`:474-475`).

Result (`:785-792`): "0 of 5,833 steps rolled back. Steam rows sit at y 30-137
mm ... while the meltwater stays at y 2-21 mm ... 17.4 steps/s with the
observer on."

**Why this matters for the N-level chain (Hermes, INFERRED).** A chain whose
levels are populated by carrier size will have empty levels all the time: at
t = 0, and whenever a level's last carrier melts, merges or leaves. The
two-level protocol treats an empty level as a rejection. Chain phase B (the
runner) inherits this unless "empty level is a valid degenerate macro" is
designed in from the start, per pair. This is not listed among the chain's
phases in `first-class-air.md`.

It also shows the cost of the present split: features were added to the
single-level route (surface stress, one-level S9-C, cleanup) because that is
where Iron Ice runs, so the two routes have diverged further. Chain phase C
("port the single-level features") is the bill for that.

## Honest walls (`:699-781`): not SS, but a model of the owner's bar

Wall exchange became conduction-limited (`Q = k·a²·(T_wall − T)/max(d, a/2)`),
replacing "A fixed 6e4 W/K per carrier ..., 10⁵-10⁷ times conduction, [which]
made every wall a thermostat". Then each face became a finite lumped body. Its
energy is "a signed 64-bit count of 1 µJ quanta ... and the face temperature is
always T0 + total/C", because a per-step f32 increment was below one ulp and
"A compensated f32 sum was tried, and the driver folded the compensation
away." Consequence stated plainly: the reference iron-on-ice box "mixes to
299.6 K, so 'cold solid iron + ice' is honestly infeasible. It was reachable
only with infinite −40 °F reservoirs."

Two things there look like departures to check in code: `runSphThermalStepCpu`
and "the CPU mirror" (`:706`, `:909`) are still maintained alongside the GPU
kernels, against the nothing-on-the-host rule; and "Water-cycle explicitly
keeps fixed faces" as "controlled heater and cooler plates" is a declared
boundary condition, which is allowed.

## The G2 plume at the end of this document (`:869-924`)

- "**no plume is visible**" in the 1 atm run: it "declares no air environment,
  so no nuclei parcels exist. The steam rows ... are vapor, which is not
  drawn, and the ledger parcel stage (condensation → aerosol, the visible
  condensate) never runs."
- With room air, discovered reactions appear (2 Fe + O₂ → 2 FeO; 3 Fe + N₂ →
  Fe₃N₂) and step 1 failed closed on mixed caloric gauges. The gauge-consistent
  proxy fixed that.
- "**Next blocker.** Every step rolls back, with or without reactions" (721 of
  721), INVALID_SOURCE at the field view's finalize. `first-class-air.md`
  continues from here.

## Rule recorded for evidence (`:866-867`)

"run any long Iron Ice evidence with `&observeSpatialAuthority=1`. A frozen
scene looks plausible in a final-state readout."
