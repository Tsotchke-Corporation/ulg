# Handoff — 2026-07-26/27 run

Branch `ss-spatial-authority-refactor`, 66 commits since `60c4598`, 25 files,
+4,953 / −116. Suite **2029 pass / 0 fail**. Visual matrix **3 of 7 failing —
the same three scenarios with the same checks as the pre-session baseline.**

Read `plan/todo/SS/branch-merge-readiness.md` alongside this. That file carries
the measurements; this one carries the narrative and the state.

---

## 1. The one substantive fix

**`420c525` — the phase-carrier transfer stopped erasing volumetric strain.**

`sphPhaseCarrierTransferGpu.js`'s `preserve_deformation` branch wrote the
*materialization* constant `volume_ratio_j` (a hard `1.0`) into `row4.z`. That
branch is entered when the template carries real mass in the target phase **and**
`mechanics_model_matches_target` — a component *continuing* in the same
constitutive model, not a materialization. It preserved F's shape and C but
renormalized the volume away, resetting every continuing particle to zero
volumetric strain once per step.

With density pinned to rest density the Tait EOS returns *exactly* zero gauge
pressure, so there was no pressure gradient anywhere in the simulation.

| h2o drop, t = 0.384 s | before | after |
| --- | --- | --- |
| `J` | `[1, 1]` bit-exactly, all 152 liquid particles | `[0.999643981, 1.000089049]` |
| liquid ΔP | 3.02 Pa | **5,427.68 Pa** |
| density | pinned 1000.0000 | 999.91 → 1000.36 |
| `maxSpeed` | 3.76579 m/s | 3.76579 m/s |

Safety against the 1667× trap the file documents: J is the template's own J for
its own phase, never a cross-phase ratio, and it is not derived from
`aggregate.current_volume`. Both test pins hold byte-identically —
`let volume_ratio_j = 1.0;` is still there and must stay. `standard-iron-ice-quench`,
the scenario the 78 m/s blowup was measured on, peaks at 6.5 m/s.

**Do not undo this to make a gate pass.** It is what makes pressure exist.

---

## 2. Earlier arcs in this run (all landed before the fix above)

### FIELD-0 — the source-local splat is the default render field
Build cost 24.3 → 3.8 ms, flat to 52,488 particles. A 49 MB per-frame host
allocation and upload was replaced with a pooled buffer plus
`encoder.clearBuffer`. Two mistakes the parity gate caught are recorded in
`branch-merge-readiness.md`: the production arm rendered nothing for a while
(its timings were void), and a velocity smear came from assuming
`queue.writeBuffer` is encoder-ordered — it is not.

### PROF-0 — the profiler had 17 consumers and no producer
`createSphGpuQueueStageRecorder` is that producer. Encoder spans are
deliberately inert (`beginEncoderSpan()` returns null) because current WebGPU has
no `encoder.writeTimestamp`; stage timing goes through queue fences instead.

### Priority 2 — GPU residency, audited by counting calls
Zero per-frame readbacks, proven by counting rather than by reading code.
Per-substep allocations measured at 0.3 % of a batch and closed. Three
optimisations were built, measured at **exactly zero benefit**, and reverted:
fence coalescing (it also broke `ss=1`), a bind-group cache (0 % hit — buffers
differ every substep), and a scratch pool (fence-deferred release cannot feed
same-batch reuse).

### Priority 3 — the neighbour search was 100 % exhaustive fallback
Root cause was an over-broad gate at `schroederHierarchyGpu.js:16898`: the
compact mechanics view nulled the bucket index, so the kernel never consulted
it. ~5.18 billion tile-overlap tests per step. Removing that gate on both the
bucket and sorted indices took the neighbour path from **+2,213 ms (2.32×) to
+51 ms (1.03×)**, byte-identical output at every stage.

The active-node compaction built alongside it (`schroederActiveNodeCompactionGpu.js`,
555 lines, 17 tests) had its **premise falsified** — bucket saturation never
happens; the active-node population is set by domain geometry (54 → 112 nodes as
particles go 9k → 52k), not particle count. It survives as a diagnostic only and
should not be wired into any production path.

---

## 3. Measurement traps found (highest-value section for the next session)

Each of these produced a confident wrong conclusion before being caught.

1. **Mechanics lane 28 holds two different quantities across the `ss` flag.**
   `resolvedAbsolutePressurePa` is written *only* by the field-view G2P, which is
   the SS path. With `ss=0` nothing writes it, so it still holds a host-seeded
   depth-frozen **gauge** prestress authored at t=0. Comparing it across the flag
   is not like-for-like. An entire investigation ("SS collapses the hydrostatic
   gradient by 2,100×") was an artifact of this.

2. **Vacuous gates.** `phase-volume-ratios-bounded` validates J against
   `[0.1, 1000]`; with J pinned to 1.0 it could not fail whatever the mechanics
   did. Fixing the J reset turned it into a real gate, which then reported a real
   pre-existing defect. That is the **third** vacuous gate found on this branch.
   When a gate starts failing after a fix, check whether it was ever capable of
   failing before.

3. **A long probe run can complete and then lose its artifact.** Past ~90
   batches the output exceeds V8's max string and throws
   `RangeError: Invalid string length` at `sph-long-horizon-probe.mjs:12451`,
   writing nothing after doing all the work. Artifacts run ~5.7 MB/batch. Get a
   long horizon with **fewer, longer batches** (`ULG_PROBE_BATCHES=24
   ULG_PROBE_BATCH_STEPS=1024`), not more batches.

4. **Scenario presets override the matrix run-length env vars.**
   `ULG_VISUAL_MATRIX_BATCHES` loses to a preset's own `batches:` field
   (`scenario.batches ?? batches`). `water-cycle` pins 12
   (`src/runtime/sphPhaseScenarioPresets.js:61`). An attempt to lengthen a
   standard scenario that way changes nothing and the run looks identical — it
   cost one wasted experiment here.

5. **`twoLevelMechanicsCoverageComplete: false` is not a coverage gap.** It is a
   benchmark-side config-agreement conjunction
   (`sph-performance-benchmark.mjs:3557`) over authority-requested-vs-observed,
   substep counts, step status and commit verification. In `observation` mode
   its being false is expected and says nothing about whether a particle was
   reconstructed.

6. **Three whitelists sit between a new step field and the probe artifact.**
   `residentStepEnvelope` builds a fresh result object rather than spreading its
   input; `sph-long-horizon-probe.mjs` rebuilds `residentStep` field by field
   (~line 5349); and the Schroeder path substitutes a *synthetic* step object
   entirely when `twoLevelAuthoritative` is true. A new field must be named at
   each hop.

---

## 4. Tools built

### `src/runtime/sph/sphStageMechanicsTracer.js` — per-stage mechanics tracer
`?stageMechanicsTrace=1` → `timeline.metrics[].residentStep.stageMechanicsTrace`.

Runs the same reduction the authoritative checkpoint uses, once per stage,
against that stage's own retained buffers — same fixed-size record, same decode,
so a stage row is directly comparable to a checkpoint row. No particle readback.
7 unit tests. **Opt-in and off by default**: each snapshot is an extra submit
plus a map, which serializes the closure's stage pipeline. Never leave it on in
a timing run.

Build it in the **step**, not the scene — the scene assembles its options object
before device resolution, so a tracer constructed there gets a null device and
silently disables itself. It reports `disabledReason` for exactly that reason.

**The closure runs thermal → reaction → phaseCarrierTransfer → mechanicsRefresh.**
The refresh is the *last* writer of the mechanics buffer. That is the reverse of
how the stage list in `sphMlsMpmPostMechanicsClosure.js` reads, and reading the
list instead of the execution order produced two wrong analyses in this run.

### `scripts/measure-cubic-root-roundtrip.mjs`
Measures the fluid path's `exp(log(J)/3)` cubed on the real GPU. It annihilates
any `|ΔJ| ≤ 1.19e-7` and preserves 4.0e-6. Real, but **not** the cause of
anything found here — the per-step increment clears the dead zone by ~7,900×.
Worth re-running if `dt` is ever reduced.

### Checkpoint evidence grew 7,504 → 12,368 bytes
Still fixed-size, still no per-particle readback. Added: constitutive branch,
density, `trace(C)`, `det(F)`, `eosModelId`, and mass-weighted mean/min/max vy.

---

## 5. Falsified — do not retry these

Every one was measured, not argued.

| claim | how it died |
| --- | --- |
| SS collapses the hydrostatic gradient 2,100× | lane 28 holds different quantities across the flag; the `ss=0` "gradient" is a frozen decoration |
| Gas does not rise at all | measured before `420c525`, when J was pinned and no gradient existed |
| Gas rises ~30× too slowly | that was the population *centroid*, which conflates generation rate with motion; parcels reach +0.22 m/s |
| Gas is velocity-locked to the liquid | true for sodium-water (h2 tracks naoh to ~1 %), false for water-cycle |
| The support radius is inherited from the source particle | the level path recomputes it via `ss_volume_radius`; the inherited one feeds render/smoothing only |
| Run length is why steam never condenses | ran 4× the horizon: `yMax` freezes at 0.2341 m from t≈7 s. Longer runs are strictly worse |
| `write_reacted_mechanics` derives J as current/rest | made it materialize at J=1: **byte-identical** |
| `mechanics_refresh` reset branch keeps the collapsed ratio | set it to J=1: byte-identical, and `should_reset` never fires here |
| `mechanics_refresh` else branch mishandles accreted mass | admitted new mass at rest volume: byte-identical (`rest_volume == row4.w` there) |
| phase-carrier transfer preserve branch, same correction | *nearly* identical — the branch runs but sees no V0 delta either |
| `0.099609375` is `0.1` round-tripped through `cbrt(J)³` | f32 gives `0.10000001`. No match |
| Products are crushed by the velocity field | h2 gas `dt·|div(v)|` is 7.4e-5 → 1.5e-5 against the ~2.3 needed, and divergence is mostly *positive* |
| Products are copy-through rejected in the G2P | naoh's J is constant across all five stage snapshots within a step yet varies between steps — the mechanics core integrates it |
| The SS level structure causes the product defects | single-level re-run: both survive unchanged |
| Products lack field-view descriptors | the field view's `sourceCount` is 684 — full slot capacity, not live (170) or non-product (152) |
| Bucket saturation drives the N² neighbour scan | raising capacity 32 → 16,384 changed nothing, byte-identical |

Six optimisations across the run measured **exactly zero** and were reverted.
Four physics edits on the product defects came back byte-identical and were
reverted. **All reverts are clean; the tree contains none of them.**

---

## 6. Open items

### #10 — steam accumulates unphysical volume and stops moving
`standard-water-cycle`, run to 12.29 s (4× the gate horizon):

| t | gas mass | V0 represented | `yMax` | mean vy |
| --- | --- | --- | --- | --- |
| 3.072 | 28.8 kg | 35.8 m³ | 0.2343 | +0.004 |
| 7.168 | 226.8 kg | 282.1 m³ | **0.2341** | −0.019 |
| 12.288 | **518.5 kg** | **644.9 m³** | **0.2341** | **−0.023** |

`yMax` freezes from t≈7 s. Represented volume reaches **644.9 m³ inside a 125 m³
box** — 5.16× the entire domain. Mean vy goes *negative*: the gas sinks.

The migration overlay (`wgsl.js:12729-12750`) assigns `level`, `native_dx` and
`support_radius`, then derives tiles from `position ± expanded_support`. **It
never writes `position`.** Migration changes a particle's *resolution*, not its
*location*, so nothing in that path can carry a parcel to a ceiling 5 m away.

Also confirmed at source (`wgsl.js:12586-12587`):
```wgsl
let source_volume_m3 = mechanics_volume_m3;
let represented_volume_m3 = mechanics_volume_m3;
```
Same expression, adjacent lines — exactly what the earlier gate-3 reading
predicted.

Separately, `steam-rises` measures `yCenterM` of the **whole live gas
population** against the first sample containing any gas
(`sph-visual-phase-acceptance.mjs:233-243`). Under continuous floor generation
that is unreachable regardless of transport, even though the schema is named
`generated-cohort-trajectory`.

### #13 — h2 gas J pinned at the 0.1 clamp
The stage tracer split the `J = 0.1 × V0_old/V0_new` composition:

| h2 gas `J` | input | thermal | reaction | transfer | refresh |
| --- | --- | --- | --- | --- | --- |
| | 0.1000 | 0.1000 | **0.0999** | 0.0999 | 0.0999 |

The **0.1 floor clamp arrives from upstream of the closure** (G2P / mechanics
core) and the **mass-ratio scaling happens in the reaction stage**. Neither the
transfer nor the refresh touches it. Two independent targets, both outside the
closure.

Discriminator: mass accretion. sodium-water h2 gas grows +0.019 kg/checkpoint at
a constant 9 particles and sits at the clamp; cesium-fluorine gas is static
after t=0.384 and holds J at 0.9999.

### #14 — vapour accumulation has no feedback to pressure
518 kg of steam accumulates at a constant 0.804 kg/m³ needing 644.9 m³ in a
sealed 125 m³ box. It should compress toward ~5 atm, lifting the boiling point
to ~425 K and stopping the boil. Instead pressure never leaves 101,325 Pa and
the liquid pins at exactly 373.09 K and boils indefinitely.

And from t = 5.120 s the liquid mechanics are **bit-identical across fifteen
consecutive checkpoints** (7.2 s) — J 0.999923, minP 101409.34, maxP 103900.79,
divergence 0.006943 — while **36 % of the liquid boils away**. That is
structural: the EOS takes density as `mass/(V0·J)` and `V0` is `mass/ρ_rest`, so
density reduces to `ρ_rest/J` and **the mass cancels**. A pool can drain to
nothing without the pressure field noticing.

### #15 — product pressure lane is exactly 0
`resolvedAbsolutePressurePa` is 0.00 for every reaction product (`naoh`, `h2`,
`csf`) and ~ambient for every original material, at **every stage including the
closure's input**. The closure is exonerated.

Narrowed to the **P2G deposit, and specifically the volume weight**: in
cesium-fluorine `csf` is 102 of 178 live particles — products dominate their own
neighbourhood — and still read 0, so the deposit must be zero. The deposit is a
single call, so lanes cannot diverge:
```wgsl
p2g_field_store_contribution(..., weight * volume, weight * volume * resolved_absolute_pressure_pa)
```
The EOS cannot supply a zero (`volume <= 0` → `max(ambient, 0)` = 101325;
`volume > 0` → `max(0, ambient + gauge)`). That leaves
`let volume = select(0.0, row4.w * row4.z, row4.w > 0.0 && row4.z > 0.0);`.

**Next check, narrow:** is `row4.w` or `row4.z` non-positive for products *at
P2G time*? The checkpoint reads the post-closure buffer, where both are
comfortably positive (h2: V0 0.229, J 0.0999; naoh: V0 0.0079, J 0.979). The P2G
reads the step *input* buffer — a point in the chain no instrument currently
samples.

### Why these four are one story
All four now point at the mechanics core and the P2G/G2P pair, **upstream of
everything edited in this run**. The represented-volume lane and the mechanical
lane do not couple: volume becomes a number and a level, and never becomes
motion or pressure.

---

## 7. Decisions waiting on the user

1. **`steam-rises` gate semantics.** It measures the live population centroid but
   its evidence schema is named `generated-cohort-trajectory`, and the physics
   shows a real rise it structurally cannot see (gas top climbs 0.124 → 0.234 m
   while the centroid is held down by continuous generation). Making it track a
   birth cohort would likely flip it to passing — but that changes what "done"
   means for this branch, so it was left alone.

2. **Whether `iron-ice-quench`'s wall coupling is right.** The iron dumps ~88 %
   of its heat to 293.15 K walls rather than into the ice it landed in, so water
   peaks at 317.8 K and never boils. The exchange is correctly gated to a
   boundary layer, so this is a scenario/parameter question, not a bug.

---

## 8. Conventions and how to run things

- **No CPU readbacks in the hot loop.** Fixed-size evidence records only. This is
  a standing constraint, not a preference.
- Visual matrix: `ULG_VISUAL_MATRIX_STANDARD=1 node scripts/sph-visual-sanity-matrix.mjs`
  against a live vite server on 5174 (`ULG_PROBE_BASE_URL=https://127.0.0.1:5174`,
  `NODE_TLS_REJECT_UNAUTHORIZED=0`). ~25 min for 7 scenarios.
- Long horizons: drive `sph-long-horizon-probe.mjs` directly with the scenario
  URL; the matrix cannot lengthen a standard scenario (trap 4 above).
- The matrix spawns a **child process per scenario**, so never edit source files
  while it runs — later scenarios would use different code.
- Timing numbers have large run-to-run variance (the same config gave 1,689 ms
  and 392 ms). Use a median of medians; never a single run.
- Never measure timing while another probe holds the GPU.
