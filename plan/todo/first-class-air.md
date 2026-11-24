# First-class air on the SS hierarchy

> **2026-11-22 Live-Code Status (`2fe9e47b`, Consolidated into Gate 3):** **OPEN.**
> Slice 4 first-principles Chapman–Enskog `μ(T)` & Modified Eucken `k(T)` landed
> in `pairPotential.js` + `referenceBankAnchoring.js` (P2), mixture parcels are
> default when `environmentMode='air'`, and Slice 5 gas–condensed conduction is
> live in WGSL. **Remaining under Gate 3 (after Gate 0D restores Section 3
> budget headroom):** enable multi-level room air & Slice 1c worker split/merge
> on default presets and retire the Slice 6 single-level implicit-atmosphere
> stand-in. See [`plan/CURRENT-PLAN.md`](../CURRENT-PLAN.md).

User direction (2026-11-16):

- "treat air as a first class sim object in the sph sim like everything else."
- "big ss particles/cubes for contiguous air volumes and smaller ones where
  they touch other materials."

## Why: today's air is second-class

Seeding and representation:

- `buildSphEnvironmentParticles` seeds air at `environmentCellsPerAxis = 2`
  (`sphPhaseDemo.js` ~2892).
- That gives about 24 centimetre-scale parcels per species, with one row per
  species: N2, O2, Ar, CO2 and H2O.
- These parcels are 10–100× the condensed spacing (~2.4 mm).

The air-specific failures hit on 2026-11-16 all follow from that
representation:

- **Gas slivers.** A one-ulp body/cell gap made gas pieces of about 20
  molecules. Fixed generally: pieces thinner than f32 position resolution are
  dropped.
- **Parked parcels.** Parcels parked near half-integer grid coordinates got
  weights of about 1e-31. Fixed generally: stencil support requires
  weight ≥ 2^-60.
- **Condensed overfill.** In a few cells the condensed volume reads above the
  cell, which left air with no free volume. Handled by the user-approved
  minimum gas fraction of 1e-3.
- **No gas transport properties.** No gas phase of any species has a thermal
  conductivity or viscosity (k = 0, sidecar MISSING). Air can never warm or
  carry heat.
- **Exclusion from contact.** Gas is correctly excluded from contact pairs: it
  has no contact surface. But thermal conduction uses the contact interface
  receipt, so gas also has no conduction neighbors.

## What exists to build on

- **Level assignment from physical state.** The SS plan keeps fine
  representation near surfaces, reactions and walls, and lets coherent bulk
  coarsen (`plan/todo/SS/schroeder-tree-and-algorithm-plan.md`).
- **Phase-volume split/merge.** The `schroeder-phase-volume-split-merge`
  proposal and apply passes exist, with refine-pressure reasons
  (`SCHROEDER_PHASE_VOLUME_REFINE_PRESSURE_REASON_BITS`):
  - aggregate-missing-or-interface;
  - conservation residual;
  - sparse-surface-preserve-fine;
  - reaction-front (reserved);
  - wall (reserved).
- **They do not run on the worker lane.** Phase-carrier v2 uses fixed-stride
  lanes, so a split cannot append children. It needs a spare-lineage reserve,
  with the reaction product pool as the precedent
  (`plan/todo/interface-resolution.md`, "A separate blocker").
- **Only two SS grid levels are active** (fine, and coarse at 2×). The third
  level is on user hold.

## Decisions (user, 2026-11-16)

- **SS levels:** the third-level hold is lifted. Use 3+ levels (4× spacing
  and beyond, as needed) so contiguous air is genuinely coarse.
- **Air parcels are mixture parcels:** one carrier per parcel with a
  moles-per-species composition (slice 3), not five rows per species.

## Roadmap links (2026-11-16)

User: "hoping this will be solved with optimizations around simulating only
representative samples and with Eshkol approximated functions for complex
underlying behavior."

- **Representative samples = A3** (`seven-goal-campaign.md` A-table;
  `a3-a4-regional-and-multidimensional-closures.md`).
  - The sampler is GPU-resident now (`regionalClosureSamplerGpu.js`, moved
    2026-11-16 at the user's request; the host version is deleted).
  - In-step consumers mounted on SS regions do not exist yet.
  - Slices 2–3 here (coarse carriers, mixture parcels) are the state half.
    A3 is the law half: one fit per homogeneous air region, not one
    evaluation per parcel.
- **Eshkol functions = A4, Goal 6 and the coarse-grain transform** of
  `eshkol-higher-order-law-closure-plan.md`.
  - The resident GPU evaluator exists, with one live consumer: the Tait K in
    the implicit pressure solve.
- **Gap.** Neither track names interface heat transfer. Two candidate
  closures:
  1. **Gas-side sub-cell conduction.** A coarse-grained flux law for a coarse
     air carrier next to a surface. Air would then not need condensed spacing
     near bodies, which would also sidestep the 8.75 mm arena cap.
  2. **Contact patch conductance.** Representative patches at SS level
     instead of every condensed pair. This targets the owner-frontier overflow
     that leaves conduction at zero.
- **Constraint.** A closure sets a flux rate; the ledgers stay exact. Any
  closure that weakens G2 acceptance needs approval.

## Slices

1. **Worker-lane split/merge.**
   - Add a spare-lineage reserve per phase lane, like the product pool.
   - The split proposal and apply passes claim children from the reserve;
     merge returns them.
   - Mass, momentum and energy stay exact (integer ledger where enrolled).
   - This also closes the open dynamic-refinement item for phase fronts.
2. **Air carriers on the hierarchy.**
   - Seed contiguous air as coarse SS carriers (big cubes).
   - Give carriers within the stencil reach of condensed matter an interface
     refine pressure, so they split down to the condensed spacing.
   - Carriers that leave the interface merge back.
   - Seeding resolution is then a derived consequence, not a control.
3. **Mixture parcels (decision needed).**
   - One carrier holds a composition vector (moles per species) instead of
     one row per species, which cuts rows 5×.
   - Species consumers read the composition: oxidation O2, vapor exchange, the
     gas EOS mixture moments, and optics.
   - Alternative: keep species rows but split and merge them in lockstep per
     parcel.
4. **Derived gas transport.**
   - Dilute-gas viscosity and conductivity from Chapman–Enskog collision
     integrals of each species' pair potential (`src/runtime/md/pairPotential.js`).
   - Modified Eucken for polyatomics; Mason–Saxena / Wassiljewa for mixtures.
   - Provenance `derived-chapman-enskog`; NIST at 300 K is an advisory check.
5. **Gas conduction neighbors.**
   - Gas–gas and gas–condensed conduction pairs come from the SS directory
     neighbor set, not the contact receipt.
   - Same Fourier pair law and harmonic-mean k. Energy stays exact.
6. **Retire air special cases** that the general laws now cover. Audit list:
   - environment cell controls;
   - the minimum gas fraction, which stays only as a numerical floor;
   - gas exclusions that are now redundant.

The contact-owner redesign follows: iron-on-ice overflow of the fixed owner
frontier, which stops conduction in vacuum (~12% of steps) and room air (every
step after contact). See
`~/.claude/.../memory/ulg-contact-owner-cap-thermal-failclosed.md`.

## Acceptance

Room-air Iron Ice runs with:

- air carriers coarse in the bulk and fine at the iron/ice surfaces;
- bounded carrier count, with measured steps/s;
- hot iron heating adjacent air;
- energy and mass exact under the existing ledgers;
- no air-specific branches left in the laws listed in slice 6.


## Progress

### Slice 1c checkpoint — real-preset air interface refinement — 2026-11-19 UTC

A test-only 128-byte GPU reduction on the actual migration pass found 120
valid gas sources, 64 oversized carriers, and zero detected interfaces. The
27-node center stencil missed the physical extent of coarse gas. Migration
now retains that local query and searches occupied dictionary ranges across
physical support bounds. No hot CPU state, added production fence, material
exception, or preset default was introduced.

Eleven native worker scenarios pass (87.4 s), including a condensed neighbor
beyond the old stencil, far/resolved controls, split/merge/reuse, capacity and
material guards. The GPU conservation receipts pass; 269 relevant host tests
and the normal build pass. The first fixed-duration actual-preset probe split
28 spares but failed its step>=4 assertion because it completed only two steps.
The subsequent owned desktop run waits for three committed schedules: six
steps, 56 active spares, 176 gas carriers/80 nitrogen, zero GPU/receipt errors.
These preset checks cover mass projections, current temperature, ledger error
controls and optical routes; they do not prove total preset conservation.

The desktop captures are black and provide no visual acceptance. Optical
mass remains zero. Coarse/fine levels, mixture parcels, contact/heat coupling
and the visible conserved plume remain open. Only G5/G7 are accepted across
G1–G7/A1–A6. Evidence: `~/.cache/icc/repos/ulg/air-interface-preset-20261119/`.
No commit, push, merge or Pages build.


### Slice 4 (gas transport) — done 2026-11-16

- `data/material-properties/compounds.json`:
  - The h2o and o2 gas phases now carry dilute-gas k, μ and `transportTemperatureK`.
  - New gas-only records for n2, ar and co2.
  - Values are CRC/NIST at 300 K and 100 kPa; water vapor at 373.15 K.
  - Each entry has a `gas-transport` provenance entry.
- `referenceBankAnchoring.js` `anchorGasTransport`:
  - Sets only `phases.gas.thermalConductivityWPerMK` and `dynamicViscosityPaS`. Density, cp and the caloric gauges are unchanged.
  - Provenance uses the standard conductivity-provenance schema.
- Live check: every air species reads sidecar READY. k values are N2 0.0259, O2 0.0265, Ar 0.0178, CO2 0.0168 and H2O(g) 0.0251; the oxide product derives 0.053.
- Conduction is still 0, because the contact interface receipt fails closed (status 10). That is true even with `lawr=0`: 433k rows, about 356 candidates per condensed row, from the mixed-law envelope of about 5 diameters. In room air the owner frontier overflows from the start (vacuum: about 12% of steps), so this needs the contact redesign.

### Slice 1 map (worker-lane split/merge), from a read-only survey

Key: H = `schroederHierarchyGpu.js`, W = the worker, S = `sphMlsMpmGpuStep.js`,
G = `ulg-gpu-abi/src/wgsl.js`, PCT = `sphPhaseCarrierTransferGpu.js`,
RP = `sphReactionProductEventSpatialClassificationWgsl.js`.

**What exists.** One orchestrator, `runSchroederSameLevelMechanicsWebGpuImpl`
(H:17559), chains the stages at H:21612–21756:
1. migration;
2. split/merge proposal;
3. apply (needs `phaseVolumeSplitMergeAdmission`);
4. allocation;
5. slot assignment (needs `particleStorageFreeList`);
6. materialization;
7. count summary and compaction;
8. the adoption guards.

The page path (`sphPhaseScene.js`:39545) passes every admission. The worker
(W:6272) passes only `enablePhaseVolumeMigration`, so the chain stops with
`disabled-phase-volume-split-merge-admission-not-provided`.

**Blockers in the step.**
- S:17505 refuses with `schroeder-particle-storage-materialization-not-phase-pair-aware`.
- Under a phase plan, materialization is marked not required (S:35569).
- It is exclusive with phase-carrier transfer (S:35461).
- With exact mass, H:17844 throws on materialization.

**The free list** (stride 8) is only an append window. Slot assignment reads
row 0 and places writers at base + a prefix sum; freed slots are never
returned.

**Phase-carrier v2 layout.** 4 lanes (solid, liquid, gas, plasma);
row = (phase−1)·stride + lineage, with stride = lineage capacity. All four
lanes of a lineage hold one material. Empty lanes are companions (status 254).

**Precedent: the reaction product spare pool** (status 253).
- Spare lineages are appended in lane 0 (`sphPhaseDemo.js` 2640–2685).
- The GPU rebuilds the pool each commit with mark → group scan → scatter →
  assign (RP:679–955). That is exact and deterministic, with no free list: a
  row is free when its mass is zero.

**Design.**
1. Split-spare gas lineages with status 252 and reserve identities. Gas
   children take reserve identities, so no identity is mutated (the reaction
   pool's rule). Solids are deferred.
2. A GPU lineage scan, reusing the product spare pipelines with a
   lineage-granular predicate. It writes the free-list row, so allocation and
   slot assignment run unchanged.
3. Allocation: a split keeps the source row in place (alloc = delta,
   free = 0, mass / (delta + 1)). A merge leader absorbs in place and the
   members free their rows.
4. Materializer: write children at `phase_lane_index(spare_lineages[rank],
   phase)`, in place, with a count delta of 0. Free rows with
   `clear_phase_slot` semantics.
5. A merge returns the lineage once all four lanes are empty (status 252).
6. The commit bumps `topologyEpoch` and `identityRevision` before the next
   generation. Level assignment already treats zero-mass rows as dormant.
7. The f32 route comes first. Room air runs f32, since exact-rational is
   disabled for room air; the exact-ledger division comes later.

### Slice 1a (split-spare reserve) — done 2026-11-16

- Status 252, `SPH_GPU_PARTICLE_STATUS.splitSpareReserved`, for zero-mass
  `spareSplitSlot` rows. The reaction spare scan
  (`sphReactionProductEventSpatialClassificationWgsl.js`) and the legacy
  placement cursor (`wgsl.js`) exclude it, so the two pools never contend.
- `appendSplitSpareLineages` (`sphPhaseDemo.js`) appends N zero-mass lane-0
  lineages after the product spares, in both builders.
  - Each gets a stable identity past every live and product identity.
  - Its companion lanes come from the phase-carrier plan.
  - The state reports `counts.splitSpareLineages` and `splitSpareReserve`
    (count and first identity).
- URL knob `splitSpareLineages` (default 0; nothing changes without it).
- The flag is carried through state metadata (both builders), view-state
  transport, packed metadata, the exact-mass field list, class statistics and
  the mount's skip lists.
- Test: `tests/sphGpuBuffers.test.mjs` "SS split-spare lineages…".
- Host suite: 6003 tests, 5898 pass, 0 fail.

**Next, 1b.** A GPU lineage scan over the split pool, reusing the product
spare mark, group-scan and scatter pipelines. A lineage is free when all four
lanes have zero mass and its identity is in
[firstContinuityDomainId, +count). That needs no status restamp after a merge.

### Slice 1b (lineage scan) — done 2026-11-16

`src/runtime/sph/schroederSplitSpareLineageScanGpu.js`:
- `create…` / `encodeSchroederSplitSpareLineageScan` run three passes: mark
  with a workgroup prefix, a serial group-total scan, and an ascending
  scatter.
- A spare lineage is free when every lane has zero, finite mass.
- It publishes `spare_lineages[]` (0xffffffff past the count) and one stride-8
  free-list row for the existing slot-assignment stage.
- No CPU implementation: the native test checks a manufactured state whose free set is known from construction (user, 2026-11-16: nothing on the host).
- Native test `tests/schroederSplitSpareLineageScanGpu.native.test.mjs`
  (`ULG_RUN_NATIVE_SPLIT_SPARE_SCAN=1`) passes. It covers partial and
  multi-group, all-free and none-free cases, NaN mass, and occupied
  companion lanes.

### Slice 1c checkpoint — allocation and assignment, 2026-11-18

The worker slice remains **in progress**. Allocation and assignment now accept
an opt-in `preservePhaseSlots` mode:

- Splits request only the additional spare-lineage ranks; their source slot
  remains occupied. Fixed-layout merges write into the lowest-index leader's
  existing slot and retire only the other admitted members. They need no spare.
- Separate intent actions (5 split, 6 merge leader, 7 merge member) prevent the
  append materializer from consuming fixed-layout assignments. Both the host
  materialization plan and its WGSL reject these intents. Legacy behavior is
  unchanged when the option is absent; the worker does not enable it yet.
- A negative delta without a merge group cannot free a fixed slot. A denied
  leader cannot free its members. Exhausted reserves deny splits without
  retiring their sources.
- The spare scan now requires exactly zero finite mass in every lane. It
  previously treated negative finite mass as free, contradicting its contract.

Evidence: `tests/schroederPhaseSlotAllocation.native.test.mjs` runs the production
scan, allocator and assignment shaders against seven manufactured cases and
reduces assertions on the GPU. Receipt `[0,7,0,0,0,0,0,0]`, no validation errors;
only 32 bytes read back. It compiles all four affected shaders, starts no app
solver, runs headless in a 3 GiB memory-capped scope, and destroys owned buffers,
device and browser. Sixteen focused storage/admission host checks also pass.
Logs and the pre-edit source copies are outside the repository at
`~/.cache/icc/repos/ulg/air-worker-split-20261118/`. The first native attempt
returned no adapter before shader execution; the project-standard bounded
startup retry resolved it. No kernel GPU/OOM fault was recorded.

**Next:** phase-aware materialization into the fixed lane-major buffers, with
unchanged reserve identities, coherent companion material tags, zero count
delta, conserved particle state and fence-owned resources. Then wire the
worker admission and final authoritative state adoption, including epoch and
identity revision changes. Trace ordering against the post-mechanics closure:
pre-mechanics storage must not replace later thermal/reaction/phase outputs.
Keep the exact-inventory and phase-pair guards until their replacement has
native conservation and live-worker evidence. This checkpoint does not complete
slice 1c, G2, first-class air, or any campaign milestone.

### Slice 1c checkpoint — private materialization candidate, 2026-11-18

`schroederPhaseSlotMaterializationGpu.js` now prepares and writes a private
fixed-layout f32 gas candidate. It reads immutable source buffers, validates
split destinations and merge groups before writing, and copies unaffected rows.
Splits retain the source row, allocate only spare lineages, center child
positions on the original first moment, divide represented volume/entities,
and set all four companion material tags. Merges conserve mass, momentum,
first moment, represented current/rest volume, entities and reference mass.
Relative translational kinetic energy becomes internal energy; temperature is
resolved from the packed explicit physical caloric branches. Identity is never
bound or written. Candidate storage count is unchanged.

The stage is single-use and has explicit destruction, input byte-length and
device-limit checks. It requires a subsequent constitutive refresh; the result
is **not an admitted terminal particle family**. Exact-ledger mutation is not
implemented here. Legacy pressure-carrier caloric tables are rejected for
merges until their owner supplies a physical caloric closure; the native test
verifies that refusal leaves every particle field unchanged. This is a pending
integration requirement, not a reduced campaign acceptance criterion.

Native evidence: `tests/schroederPhaseSlotMaterialization.native.test.mjs`,
`ULG_RUN_NATIVE_PHASE_SLOT_MATERIALIZATION=1`, nine cases, fixed receipt
`[0,9,0,0,0,0,0,0]`, no GPU validation errors. Includes the actual scan →
allocation → assignment → materialization chain, a GPU split/merge round trip,
mixed-material rejection, occupied companion rejection, competing writes,
missing admission and legacy caloric rejection. Mass, momentum, total energy,
first moment, volume, reference mass, entity count and det(F)/J checks all run
on the GPU; only 32 bytes are read back. Headless 3 GiB memory-capped runs; no
app solver started. The first compile found reserved WGSL identifiers; fixed
before execution. Logs: `air-worker-split-20261118/native-materialization-*.log`
under the existing external artifact directory.

**Next remains live integration:** carry an authenticated split-reserve layout
into the worker (only individual `spareSplitSlot` metadata currently survives
packing), insert the candidate after the final phase transfer, refresh
constitutive properties, and publish through the existing source-family and
PeerCompute admission/fence owners. Bump topology/identity revisions without
changing lineage stride. Add the integer-ledger and legacy caloric producers
where needed. Keep existing phase-pair/exact-inventory guards until the new
path has native ownership and live-worker evidence. Full slice 1c is still open.

### Slice 1c checkpoint — reserve transport, 2026-11-18

The cold builder now records `firstLineageIndex` alongside the count and
continuity-domain start, and carries an allowlisted `splitSpareReserve` inside
`phaseCarrierPlan`. The existing plan transport preserves it through both
packers, view-state structured clone, SPH/MLS uploads and worker seeding. The
worker checks matching declarations across the seed, packed states and uploads;
its plan comparison and the resident family comparison include the reserve.
Unsupported layouts, out-of-range/noninteger bounds and identity overflow
reject. Upload validation precedes GPU allocation. Existing no-reserve plans
keep their behavior; single-lane cold declarations are transportable, while the
current private materializer still requires four lanes.

This descriptor states fixed capacity, not free occupancy or PeerCompute
admission. The GPU spare scan and the final writer must still revalidate every
destination. The live worker does not invoke split/merge yet.

Evidence: 15 host descriptor/transport checks and two worker ownership checks
pass (`reserve-transport-host.log`, `reserve-worker-host.log` in the external
ICC artifact directory). The tests use manufactured cold rows and a fake GPU
for ownership only; no CPU physics solver or law oracle runs. They cover
structured clone, both uploads, bounds, conflict refusal, immutable copies,
local-property stripping, rejection before allocation/law evaluation, seeding
and a two-step existing continuation. Initial fixture failures (missing identity
revision; expecting a reserve error before the existing reseed guard) were
corrected; no production guard was weakened. The normal Vite build also
passes (`reserve-build.log`, 9.58 s, 3 GiB memory-capped scope).

Next: produce allocation assignments under the worker's existing PeerCompute
admissions, insert the private writer after the last phase transfer and before
constitutive refresh, capture its source family, then update continuation
selection, topology/identity revision and retirement fences as one change.
The generic materializer's phase-pair guard and exact-ledger guard remain.
Integer-ledger and legacy caloric integration, native final-family tests and a
bounded live-worker proof are still required before slice 1c is complete.

### Slice 1c checkpoint — hierarchy and worker policy, 2026-11-18

The single-level hierarchy now owns the native spare scan and consumes its
GPU free list for phase-preserving allocation/assignment. The private writer
runs after phase transfer, before constitutive refresh. Resident continuation
selects the refined S/T and refreshed M, advances both topology epochs and the
identity revision, and retains the reserved identity buffer. Scan scratch is
tracked by the hierarchy artifact ledger. Generic append materialization is
bypassed only for this explicitly enabled path.

The scene carries its four existing PeerCompute admission publications through
an immutable, clone-safe worker policy. A content fingerprint binds those
receipts into hierarchy configuration and target-schedule writer identity. This
is configuration binding, not a cryptographic signature or new admission.
Host tests prove forwarding and rejection of missing/changed receipts before
execution. No preset/default is enabled.

The native fixture executes the real scan, allocator, assignment, phase writer,
refinement and constitutive refresh with manufactured mechanics/split intent.
It reads one fixed 32-byte GPU receipt (`[0,1,0,0,0,0,0,0]`) and reports zero
validation errors. Fresh owning inputs prove that envelope rejection, a failed
retirement fence, and a late hierarchy failure restore shared source ownership,
retire private outputs and support idempotent cleanup retry. The fixture shares
one Vite module graph, avoiding duplicate private owner maps under HMR.

Evidence: `~/.cache/icc/repos/ulg/air-worker-integration-20261118/`, final native
`native-hierarchy-j.log`, 72 metadata/ownership tests and 20 focused worker/storage
tests (overlapping suites), and the normal build. Earlier failures are retained:
fixture gas prerequisites, a frozen envelope that prevented cleanup bookkeeping,
duplicate HMR module identities, unresolved async envelope capture, and a public
telemetry alias that correctly stayed unknown for incomplete manufactured-stage
telemetry. The final check requires a positive observed fence count and rejects
a zero-fence/no-host-sync claim. Numerical tolerances were not relaxed.

Still required, in order:

1. Replace the explicit retirement wait with safe queue-ordered ownership. It is
   currently reported as a host fence, so strict worker admission is not proven.
2. Exercise canonical spatial successor publication and a second resident worker
   step through real PeerCompute admissions. The current native fixture disables
   canonical generation and does not execute an actual worker schedule.
3. Enroll exact mass/energy ledgers, current gas, condensate and optics; the
   existing guards still reject these combinations. Validate legacy caloric
   merges and pressure consumers before enabling a preset.
4. Complete multilevel air and coupled solid/fluid physics, then G2 visible plume
   conservation/transport/deposition evidence under the original acceptance.

Slice 1c and the full campaign remain open. G5/G7 acceptance is separate.

### Slice 1c checkpoint — pressure and optical routes — 2026-11-19 UTC

The actual scene/worker split → merge → hold → split cycle now has matched
EOS-on/off evidence. With otherwise identical cold inputs, condensation causes
gas motion only with EOS enabled. Fixed GPU reductions verify current-T sound
speed, finite volume/deformation/velocity and the existing mass and accounted
energy invariants. These are manufactured explicit-caloric inputs, not a
claim about the Iron Ice plume or legacy caloric models.

The demo now carries opt-in `schroederPhaseSlotRefinement` from URL/policy to
worker configuration and the continuation signature. No preset default changed.
The first real room-air run rejected the unsupported optics combination.
Optics now resolves active routes on the GPU and drops obsolete empty-slot
routes. It runs against the final refined/parcel-updated particle family before
constitutive refresh, with the successor topology bound separately from the
unchanged identity buffer. Only the standard optics producer is admitted;
rational inventory, captured-gas/condensate and multilevel guards remain.

A manufactured native optical gate verifies two replacement species, removal
of an obsolete route, preserved prior condensate, and zero invented births.
The ownership regression rejects skipped epochs and wrong buffer families.
The ten-mode scene matrix passes in 115.6 s. Its subsequent optics launch failed
before execution due to Chrome ERR_CERT_VERIFIER_CHANGED; process-start local
TLS configuration fixes the harness and the independent optical gate passes
in 2.38 s. 434 host tests pass (3 opt-in skips); normal build passes in 3.04 s.
All failed runs remain in `~/.cache/icc/repos/ulg/air-pressure-20261119/`.

Iron Ice with room air, nuclei, integer energy, dt 1 ms and opt-in refinement
commits 24 steps in the compatibility probe. Fixed GPU checks show valid mass
projections, active temperatures and energy control. **It uses zero split spare
slots** and retains 24 nitrogen carriers. This proves compatible continuation,
not adaptive air in the preset, total preset conservation, visible steam, or
real-time performance. Headless screenshots retain the known GPU-canvas capture
limitation. The final sidecar-inclusive check commits 20 steps: its 64-byte
GPU receipt has zero errors, 24 ready optical routes and zero dispersed mass.
It likewise uses zero split spares; this is not plume evidence.

Next: inspect the real preset's interface/refinement decisions and complete
coarse-air/multilevel behavior, then contact-owner/heat coupling and actual G2
plume acceptance. Room-air materials already use explicit caloric branches;
legacy pressure-ladder support is not the observed preset blocker. First-class
air slice 1c, G2 and A5 remain open. Only G5/G7 are accepted across G1–G7/A1–A6.
No commit, push, merge or Pages build.

### Slice 1c checkpoint — ledger parcels — 2026-11-19 UTC

The standard integer-ledger parcel stages now run after optional gas refinement
and use its newest mass/energy records and physical buffers. A GPU caloric pass
refreshes explicit-model temperatures after vapor exchange and deposition,
before mechanics/pressure reads them. It preserves ledger U/S and phase; no
extra awaited per-step fence or hot particle readback was added. The rational
current-gas reader is a separate path and its guards remain.

The actual scene and worker now pass the split → merge → hold → split cycle
with a condensing parcel. All mass and accounted-energy words are conserved
across carriers, parcel and sinks; identities and current temperatures pass.
Condensed water and optical extinction increase through all four schedules.
The production optical writer reads the actual retained parcel owner, but its
isolated diagnostic field does not prove a visible plume in the presenter.

Final native matrix: six scene modes (f32, integer and parcel, direct/worker),
plus integer/refusal and materialization regressions, pass in 96.77 s with zero
GPU errors. 141 host ownership/lifecycle tests and the normal build pass.
Evidence: `~/.cache/icc/repos/ulg/air-parcels-20261119/native-final.log`,
`host.log` and `build.log`. The initial WGSL reserved-word failure is retained.

The short Iron Ice check exposed an evidence limitation. Its query URL selected
an explicit main renderer; the canonical preset hash instead produces an
admitted worker isosurface frame at step 16. Both screenshots are blank. A
separate main/worker WebGPU color check proves the headless screenshot omits
GPU canvases: fixed one-pixel GPU reads contain red/green while the screenshot
contains neither. This is not visual acceptance or proof of a broken app.
The query run also had a later seed/drain timeout; it is retained, not passed.
No plume appearance or preset refinement enablement is claimed.

Next: legacy pressure/caloric compatibility, remaining current-consumer guards,
multilevel air and contact/heat coupling, then actual G2 plume acceptance.
The standard parcel integration gate passes; slice 1c, G2 and A5 remain open.
Only G5/G7 are accepted across G1–G7/A1–A6. No commit or publication.

### Slice 1c checkpoint — integer scene cycle — 2026-11-19 UTC

The integer worker/scene gate now passes through the public scene API, real
PeerCompute admissions and actual presentation-worker commits. Four schedules
on one lane execute eight production steps: split to eight gas carriers, merge
to one after a neighboring liquid is displaced, hold one in the bulk, then
split back to eight when the neighbor returns. Every integer mass and accounted
energy word (sum(U-S)) is conserved, projected masses agree, immutable identities
remain unchanged and ledger controls stay clear. Topology epochs advance
9/11/13/15 and mass generations 4/8/12/16.

Cold inputs use production particle packers and the material's explicit caloric
model. Only fixed 32-byte GPU diagnostic records leave the device. Neighbor
motion is an explicitly manufactured GPU position change between schedules;
this proves adaptive response, not unforced liquid dynamics or plume behavior.
No admissions, proposals or hot gas/ledger state are supplied by the fixture.
The direct scene also passes the cycle, without claiming worker commits for it.

Final native-c.log passes all four modes (f32 direct/worker and integer
direct/worker), zero GPU errors, in 56.6 s. native-b.log independently passes the
integer worker cycle. native-a.log is retained: its gas volume was below the
existing refinement threshold, and the unchanged population assertion failed.
The cold gas mass was corrected before the successful cycle. Production source
is unchanged in this checkpoint; this completes missing integration evidence.
Evidence: `~/.cache/icc/repos/ulg/air-scene-ledger-20261119/`.

Next: current gas/condensate/optics and pressure/caloric integration, then
multilevel air and contact/coupling before actual G2 plume acceptance. In
particular, mintExactGasRead still selects rational exactMechanics/quantity
records rather than the newest standard energy ledger; its consumers need
source-correct enrollment before removing guards. No preset enables refinement.
First-class-air slice 1c, G2 and A5 remain open. G5/G7 remain accepted; all other
campaign targets remain open. No commit, push, merge or Pages publication.

### Slice 1c checkpoint — integer refinement — 2026-11-19 UTC

The opt-in phase-slot writer now carries standard integer mass, internal energy
U and cumulative source S through gas splitting and merging. Splits retain
all division remainders; merges add thermalized relative kinetic energy to U
and S together. GPU preflight rejects the whole operation before physical writes
if arithmetic, projection, caloric lookup or spare ownership fails. The spare
scan checks all mass/U/S words in all four lanes, including quantities hidden
below the f32 view. Supported caloric branches remain explicit types 3/4/5.

The actual single-level hierarchy now carries the sealed phase ledger through
refinement, constitutive refresh, spatial publication and the next step. Two
integration defects were fixed: capture retirement preceded spatial ledger
adoption, and fixed-slot refinement changed the immutable identity revision.
Retirement now follows spatial publication; topology advances separately from
unchanged identity. No extra awaited GPU fence or hot-state readback was introduced; existing
ledger retirement uses deferred queue-fence callbacks.

Native verification passes nine integer/refusal cases, including signed energy,
non-power-of-two splitting, retained low-word remainders, merge heat, split/merge
recovery and hidden spare records. Three actual hierarchy steps progress from
one gas carrier to eight, then retain eight, with exact mass and sum(U-S)
conservation, clear ledger errors and unchanged identity association. All GPU
readbacks are fixed 32-byte receipts. This hierarchy fixture supplies admission
descriptors; it is not integer-ledger worker/scene StateManager evidence.

Final native evidence: `air-ledger-20261119/native-l.log` (zero GPU errors).
Existing materialization, spare-scan and direct/worker scene native checks pass
(three tests, 41.1 s); 167 host tests pass with one opt-in skip; normal build
passes (4.83 s). Original failed runs are retained in the same external directory.

Next: prove integer refinement and physical merge-back through the actual worker
and scene, then enroll current gas/condensate/optics and pressure/caloric consumers,
followed by multilevel air and A5/G2. Rational inventory, parcel/current-gas and
optical topology guards remain. No preset enables refinement. Slice 1c, G2 and
A5 remain open; G5/G7 remain accepted. No commit, push, merge or Pages publication.

### Slice 1c checkpoint — real scene admission — 2026-11-19 UTC

The supported f32 scene-admission gate passes. The native fixture calls the real
scene API with a real PeerCompute host; it supplies no admission booleans or
physics runner substitutions. The scene publishes all four storage admissions
into StateManager. Two schedules on the same actual presentation-worker lane
each complete two production steps and receive separate StateManager commits.
Fixed 32-byte GPU receipts from the worker's retained family prove eight gas
carriers plus one condensed neighbor, mass/energy conservation and unchanged
identities. Steps advance 2 → 4, topology epochs 9 → 11. The direct scene route
passes the same numerical/continuation checks (its outputs are not labeled
StateManager-committed). The worker wrapper only adds the read-only reduction.

Fixed two scene defects: overwriting hierarchy-owned sealed render references,
and false stale-publication rejection caused by omitted original boundary,
pacing and contact settings during signature revalidation. Final native evidence
is `air-scene-20261118/native-n.log` (both routes, zero GPU errors); 49 focused
lifecycle/control checks and normal build pass. Earlier failures are preserved.

This is isolated manufactured gas/liquid integration. Integer-ledger and current
gas/condensate/optics enrollment, physical merge-back through the live scene,
pressure/caloric consumers and multilevel air remain required before any preset
enablement. Slice 1c, A5 and G2 remain open; G5/G7 are separately accepted.

### Slice 1c checkpoint — worker merge-back — 2026-11-18 UTC

The opt-in single-level worker now coarsens compatible bulk gas by material,
source level, chart and cell without changing immutable particle identities.
Coarsening requires 2–8 members, no condensed interface, valid conservation
residuals and a merged support radius inside the lower 2:1 hysteresis envelope.
Existing material/caloric/constitutive checks still gate actual writes. A GPU
check also proves that an invalid spatial dictionary or inactive gas descriptor
cannot authorize coarsening.

Ten native worker scenarios pass. An eight-step cycle splits one gas carrier
into eight, merges back after the neighboring liquid is moved away, holds the
single carrier for another schedule, and splits again when the neighbor returns.
Freed reserve slots are reused. Fixed 32-byte GPU receipts check every identity,
mass, total energy, represented volume, entity count, momentum and first moment
within the existing f32 tolerances. The first moment accounts for the externally
prescribed neighbor translation; no gas state, proposal or assignment is injected.
The first step after each translation refreshes the canonical spatial state; the
second consumes it. This is a manufactured GPU perturbation, not live-scene
motion/admission evidence. Separate cases refuse different-material, excessive
occupancy and oversized merges; interface/resolution/capacity controls also pass.

The canonical two-step continuation and rejection/cleanup regression also passes
with zero GPU errors. 119 focused ownership/metadata checks and the normal Vite
build pass. Evidence,
including the earlier heat-pulse fixture failure, is in
`~/.cache/icc/repos/ulg/air-merge-20261118/`. The heat-pulse attempt merged but did
not restore the condensed interface and failed its volume/return checks; it is
not counted as a successful thermodynamics or condensation test.

This completes the worker physical-merge-back gate, not slice 1c, A5 or G2.
Next: actual scene StateManager admission, conserved integer-ledger and current
gas/condensate/optics integration, then multilevel air and A5/G2 plume evidence.
No preset enables refinement. G5/G7 remain accepted; the other eleven campaign
targets remain open. No commit, push, merge or Pages build.

### Slice 1c checkpoint — actual worker interface refinement — 2026-11-18 UTC

The opt-in single-level worker now actually splits coarse gas next to condensed
material. It queries the current admitted mechanics dictionary (27 stencil keys,
binary search per node), requests an eight-child split when physical support
exceeds the grid's resolution envelope, and prevents interface coarsening. The
existing spare allocator refuses the whole split when seven spare lineages are
unavailable. No material-specific law or host particle scan was added.

Five native worker cases pass through two real mechanics/closure/publication
steps each: interface gas becomes eight carriers; uniform bulk, distant contact,
already resolved gas and insufficient reserve remain unsplit. Fixed 32-byte GPU
receipts verify mass, total energy, represented volume, entity count, momentum
and first position moment within declared f32 tolerances. Identities remain
unchanged and there are no validation errors. This uses manufactured cold inputs
and admission descriptors; actual scene StateManager admission is still pending.

The preceding queue-retirement change is now verified with canonical two-step
continuation and rejection/cleanup retry: refinement retirement uses the actual
final-refresh submission capability, with no added awaited GPU completion fence.
The canonical test still observes 31 existing deferred fence requests; this is
not a claim that the entire hierarchy has no synchronization.

Validation: five worker cases, the canonical ownership regression, 116 host
metadata/ownership tests, and normal Vite build pass. Evidence and prior failures:
`~/.cache/icc/repos/ulg/air-interface-20261118/` and
`~/.cache/icc/repos/ulg/air-worker-queue-20261118/`.

Next: physical coarsening/merge-back and scene admission, then exact ledgers and
current gas/condensate/optics, multilevel air and the A5/G2 plume path. Refinement
remains opt-in, with existing exact-inventory and multilevel guards intact.
G5/G7 remain accepted; all other eleven campaign targets remain open.

The preceding worker test failed honestly: a single uniform gas carrier at one
level had no physical split demand. Its source conservation passed, but its
occupancy assertion failed (`air-worker-queue-20261118/worker-c.log`). The new
case includes a condensed neighbor and unresolved gas support, and the production
migration/proposal/apply path derives the split. Integrity-fault injection or
manufactured split intents are not used by this worker test. Canonical cleanup
regression still uses manufactured mechanics/split intent and is labeled so.

The interface policy currently uses same-level mechanics stencils. Cross-level
interface demand and wall refinement are not established by these tests. Coarsen
eligibility still uses the old expansion/aggregate policy: merge-back of split
children must be verified before enabling a live preset. This checkpoint does
not close slice 1c or change any campaign acceptance rule.

### Slice 3 survey (mixture parcels), read-only, 2026-11-16

Every gas consumer keys off one f32 `materialId` per row (`thermo[0]`). That
single id selects the molar mass, caloric ladder, mechanics record and
reactant identity. Only the total-molecule count (`thermo[9]`) is blind to
composition.

**Hardest consumers:**
1. **Reactions.**
   - Matching the row material to the reactant:
     `schroederSpatialReactionDiscoveryProposalGpu.js` ~2112.
   - Dormancy: `schroederReactionDormancyGpu.js`.
   - Extent: `wgsl.js` ~3069–3164, row mass / (ν·M).
   - Exact ledger: `sphExactReactionLedgerReconcileGpu.js` ~300.
2. **The exact quantity plane** stores one molar identity per row
   (`sphExactPlacementQuantityWgsl.js`, `sphExactHistoryP2gGpu.js` ~126).
3. **Gas caloric admission** (`sphSpatialGasCaloricAdmission.js` ~348–390):
   one material record per cell member, with mass ≈ n·M.
4. **Vapor exchange** finds H2O by row material:
   - `sphExactVaporParcelLedgerGpu.js` ~148;
   - `sphVaporAerosolExchangeWgsl.js` ~274;
   - `sphPhaseCarrierTransferGpu.js` ~427–520 (the interface skin).
5. **Product capture** needs a receiver of the same material and phase
   (`sphReactionProductEventSpatialClassificationWgsl.js` ~254,
   `sphReactionProductPlacementSegmentedWgsl.js` ~857).

**Survives as-is:**
- The gas ledger EOS (moles from `thermo[9]`, p = ΣnRT/V).
- Free volume.
- Phase-volume transport.
- Melt release.

**Templates to reuse:**
- The G2 ledger parcel `[dry | water | water U]`
  (`sphExactVaporParcelLedgerGpu.js`).
- The per-row conductivity sidecar in the SS thermal pass.
- Per-cell mixture moments.

**Cost.** A staged refactor across about 25 files. It is not a single
slice. Fine air near bodies is the case that needs it; coarse air with a
sub-cell interface closure (Roadmap links, gap 1) would not.

### Ordering

Graded seeding (slice 2a) comes before the dynamic split kernel. Graded
seeding is the same layout at t=0: an octree over free space, fine at the
condensed spacing next to bodies and coarse in open air, with exact species
totals. Dynamic split/merge (1c) then maintains it as interfaces move.

### Slice 2a (graded seeding) — first cut 2026-11-16

- `buildSphEnvironmentParticles({ refineEdgeM })`: an octree over each coarse
  cell. Any cell within one of its own edges of a condensed body is split
  until its edge reaches `refineEdgeM`.
  - Slivers are dropped and species totals stay exact.
  - Free volume is identical at every grading.
  - Leaf budget: 200k.
- Control `environmentRefineEdgeMm` (blank = off), threaded to both builders.
- Test: `sphEnvironmentParticles` "graded seeding…".
- Cost on Iron Ice (box 0.14 m), per-species rows:

  | Fine edge | Air cells | Gas rows |
  |---|---|---|
  | none | 32 | 160 |
  | 17.5 mm | 397 | 1,985 |
  | 8.75 mm | 877 | 4,385 |
  | 4.4 mm | 2,486 | 12,430 |
  | 2.4 mm | 6,806 | 34,030 |

  Each gas row has 4 phase lanes on top. **Mixture parcels (slice 3) are a
  hard prerequisite for fine air.**
- At 8.75 mm the resident schedule fails closed: the product-history
  GPU-count arena needs 53 MB against its 32 MiB no-host cap
  (`RESIDENT_PRODUCT_HISTORY_NO_HOST_OBSERVATION_MAX_BYTES`).
- At 17.5 mm: 14,584 rows, 521/521 admitted, 7.3 steps/s (coarse air: 19).
  - That needed one fix. Anchoring gas μ switched on the phase-volume
    gas–condensed drag path for ice–air pairs. Its velocity-differenced
    energy check then missed by 4–8 ulps of the kinetic state.
  - The state floor in `stage_gas_condensed_pair` now counts 16 operations
    instead of 6 (rounding bound, documented).
- Conduction is still 0: the contact receipt is still fail-closed (about 500k
  rows).

### Contact all-pairs graph — root cause fixed 2026-11-16

Conduction was 0 because the contact interface receipt failed closed. That
was not an owner-design limit.

**Cause 1: the position trust radius.**
- `SPH_CANONICAL_CONTACT_POSITION_TRUST_DIAMETERS` was 16
  (`sphCanonicalContactMotionBound.js`).
- The pair predicate is `rest + 2·swept + T·(dA + dB) + walls`, and the
  mixed-law query radius is `(1 + 2T)·maxD + 4·maxDisp + 2·wall`. With T = 16
  both reach about 33 diameters, an all-pairs graph across iron and ice
  (about 440k rows).
- T is now 1. New overlap in one step is bounded by the pair's CFL travel,
  which is at most one cell. The revision string is bumped to `-v2`.

**Cause 2: a gauge-dependent energy check.**
- The contact solver flagged NEGATIVE_INTERNAL_ENERGY when `next_u < 0`.
  Ice u is negative in the phase-caloric gauge, so this fired for ice.
- The 5 sites now check against the step-start u (contact only dissipates).
  The 2 publish sites are finite-only.

**Result on room-air Iron Ice (0.46 sim-s):**
- 927/927 steps admitted.
- Pair rows: 12–15k (was 440k). The receipt publishes in about 75% of steps.
- Ice warms 233 → 315 K, and some Fe solidifies.
- 9.2 steps/s (19 before, when contact never ran).

**Remaining:** about 25% of steps are ITERATION_INCOMPLETE on impact steps
(frontier about 150 particles, 6k cursors). That is the owner's pass budget,
not its caps.

**Late contact loss (found 2026-11-16):**
- Room-air contact published early but failed every step from somewhere
  between steps 1,024 and 2,000. Failure word 0x4100 =
  LEVEL_OR_SOURCE_IDENTITY|PUBLICATION_INCOMPLETE, with traversal counter 46
  (lineage material mismatch) = 2.
- Cause: the f32 reaction kernel writes a product into a fully consumed
  ("freed") reactant row in place. A liquid Fe row whose lineage had already
  partly frozen (solid lane active) hosted liquid FeO. That made a
  two-material lineage, against the phase-carrier v2 invariant.
- Fix: a pair is deferred (does not react this step) when a freed parent row
  cannot host its product in place, i.e. another phase lane of its lineage
  still holds mass. `reaction_row_hosts_product` is the test.
  - Routing such products out as events instead was tried and fails. In
    mechanics-field mode the product-history route certificate
    (`certify_resident_product_gas_only`, `sphGridGpuKernel.js`) admits
    unplaced mass only for gas products. A condensed FeO event fail-closed the
    field view from tick 1270, so every step rolled back.
  - Every kernel that accounts a pair uses the same predicate: the step
    kernel (pair rejected, code 8 on the pair-allocation route), the product
    event kernel, the summary partials, the product inventory, the atom
    residual and the gas-species summary.
  - Lineage capacity comes from the state's phase-carrier plan
    (`sphReactionPhaseLineage.js`). The ReactionParams uniform is now 64
    bytes; the shared summary params carry it in word 44.

### Phase change for explicit-branch (room-air) materials — 2026-11-16

Room-air H2O uses the phase-caloric explicit-branch model
(`sphCondensableCaloricTable.js` types 3/4/5). Its phase is selected
explicitly and energy never moves a row between branches; by design, "phase
exchange belongs to a separate equilibrium/kinetic authority". No such
authority existed, and skin fronts need plateau rows. So room-air ice heated
as a solid to its 600 K branch top and never melted.

Two general bulk equilibrium authorities now live in the phase-carrier
transfer, after the interface skin front (`front_conversion`: skin, then
fusion, then boiling):

- **Fusion** (`explicit_fusion_conversion`).
  - The thermal record carries law 2 (`PRESSURE_CARRIER_LAW_EXPLICIT_FUSION`)
    with T_f, taken from the model's `solidCaloric.referenceTemperatureK`.
  - u_s(T_f) and u_l(T_f) come from the packed branch lines.
  - Melt: m(u − u_s)/(u_l − u_s) goes to the liquid lane at u_l. Freezing is
    symmetric.
  - The remainder is energy-exact.
  - An empty lane nucleates only at ≥1e-3 of the carrier; merging into an
    existing lane needs adjacency.
- **Boiling** (`explicit_boiling_conversion`).
  - Per material, `explicitVaporizationRecords` (thermal table) carries the
    model's own saturation curve (Kirchhoff + Poynting terms).
  - The GPU bisects p_eq(T_sat, P) = P at the row's absolute pressure.
  - m(u − u_l(T_sat))/(u_g − u_l) goes to the gas lane at u_g(T_sat).
  - Liquid → gas only. Below boiling, evaporation and condensation depend on
    partial pressure: that is the vapor-exchange law.
  - It needs the transfer's absolute-pressure authority.
- The transfer has its own closure tail: vaporization records after the
  shared rows. Params are 96 B, with an explicit gas-record count. The other
  stages keep the shared layout.
- The room-air H2O domain is 233.15–1100 K. That allows supercooling, and
  vapor heated by hot oxide stays in the table.
- **Test:** `tests/sphPhaseCarrierExplicitFusion.native.test.mjs`, 6 cases,
  exact by construction: melt, freeze, nucleation, no authority, boil, below
  boiling. The extraction hash test enumerates these as extensions, and every
  pre-existing transfer line is byte-identical.
- **Live (fusion only):** 39 meltwater rows, 48 mg, at 4 s; 6000/6000
  admitted.

**Live room air with boiling (2026-11-16, `boilAir3`):**
- Liquid caps at 373.7 K (boiling at the reference-ladder pressure).
- 3.6 mg boiled into 10 new vapor rows at the headspace.
- 6000/6000 admitted.
- Two cache fixes were needed: the static table cache dropped the new
  records, and the gas caloric admission rejected the law-2 lanes.
- Contact: `contactInnerRounds=2` (now in the iron-ice-quench preset) cut
  pass-budget non-convergence from 46% to 7% at the same rate.

**Observation: per-species air stratifies.** In the same run, all 24 N2 rows
sit at the ceiling (y = 138.3 mm) while O2, Ar and CO2 spread lower. With one
row per species, each species moves as its own fluid under gravity, and no
law couples their momenta. Mixture parcels (slice 3) remove this by
construction. Interspecies momentum exchange (Maxwell–Stefan
friction, K_ij = p x_i x_j / D_ij) is the general law that
keeps separate species comoving except for diffusion, and mixture parcels
of different composition need it too.

**Stiff gas-mixture momentum law: tried, reverted (2026-11-16).**
- `stage_gas_mixture` in the phase-volume transport set every non-condensed
  field at a node to the node's gas centre-of-mass velocity; the
  centre-of-mass-frame kinetic energy became heat (exact).
- The species then stayed co-located: all five air species shared the same
  bounds. The native transport test passed.
- Live, from tick 460 the existing gas–condensed drag pair failed its energy
  residual (temporary diagnostic tag 0x3b4). The tolerance is
  1024·γ6·Σ|terms| + the 16-op state floor, so this is an accounting gap in
  `schroeder_phase_volume_pressure_drag_pair` under the new air dynamics, not
  rounding. Every step rolled back.
- **Next:** find that gap (the impulse cap is the likely suspect), then re-add
  the mixture stage. Mixture parcels would face the same drag-pair path.
- **Drag-pair gap: diagnosis so far (2026-11-16, with the mixture stage
  temporarily on).**
  - Failing pairs are finite, and drag heat dominates the residual.
  - |residual| is 4–8× the tolerance, about 0.2% of the drag heat. That is
    far above f32 rounding.
  - Mass ratio m_gas/m_cond ≈ 1e-2 and |v_c|/|Δv| < 2. The f32 absorption
    hypothesis (heavy partner's velocity change rounding away) is therefore
    refuted.
  - **Next:** a closed-form review of
    `schroeder_phase_volume_pressure_drag_pair`: the drag Δv reuses the
    rounded post-pressure velocities, and the heat is clamped
    (max(0, −ΔKE_drag)). Then a native manufactured test of a pair at these
    ratios.
  - Diagnostic scripts: `diag_pair2.py` / `diag_pair3.py` in the scratchpad.
    They re-add the mixture stage and encode the failure.
- **Operator verified in isolation (GPU, 2 × 65,536 manufactured pure-drag
  pairs).**
  - Ranges: m_gas/m_cond 1e-1 to 1e-3, |v_c| up to 2|Δv|, viscosities from
    1e-6 to 1e4 (up to fully stiff), gas volumes up to 1e-3 m³.
  - Every pair is within the caller's exact tolerance; the worst is 0.14× of
    it.
  - The live failure (first failing pair: pure drag, pressure compensation
    0, residual +0.6% of heat) therefore comes from caller-side inputs these
    ranges do not reproduce.
  - **Next:** capture the first failing pair's full input vector into a
    debug buffer and replay it through the isolated harness
    (`scratchpad/drag-operator-check3.mjs`).

**Drag-pair gap found and fixed (2026-11-16): f32 underflow, not physics.**
- A probe capture (transport scratch tail; the probe now reads it when a
  DIAG build adds COPY_SRC) recorded the first failing pair: a microscopic
  sliver field, m_cond 4.7e-16 kg and m_gas 1.4e-18 kg.
- Its drag impulse is ~9e-20 N s, so `dot(D, D)` (~8e-39) is below the f32
  normal range and the GPU flushed it to zero. The quadratic kinetic term
  vanished and the heat was over-stated by α/2 (0.6%).
- Replayed in isolation, the captured inputs reproduced the residual to 0.1%.
- **Fix** in `schroederSpatialPhaseVolumePressureDragOperatorWgsl.js`, with no
  product of two impulses:
  - drag ΔKE = D·(v_c − v_g)·(1 − α/2), an exact identity since
    D = μα(v_g − v_c);
  - pressure quadratic = ½ (J·rim)·J.
- Replay residual: 2.9e-21 → 4.7e-24 (tolerance 4.8e-22). The 65,536-pair
  sweep stays within tolerance.
- With the fix, the stiff gas-mixture stage is back in. Live room air: all
  6000/6000 steps admitted, contact clean in 1023 of 1024 audited steps, and
  melting and boiling intact.

**Still open: implicit ambient buoyancy double-counts in room air.**
- `stage_ambient_buoyancy` applies ρ_amb·V·g (ρ_amb = 1.2041·p/1 atm) to
  every gas field whenever the phase-volume authority is active. That is
  right for "vacuum" mode, where it stands in for unsimulated air and lifts
  the steam.
- In room air the atmosphere is explicit, so this double-counts. Each
  species row spans the whole cell volume, so every species is lifted: N2 is
  still at the ceiling.
- **Fix:** `ambientReferenceDensityKgPerM3 = 0` when the atmosphere is
  explicit (`demo.environmentInitialization` non-null). Plumbing:
  - mount runtime → the scene's three execution paths (sphPhaseScene ~36066,
    ~36453, ~37094) and the worker's `laneResidentOptions`;
  - step hops: sphMlsMpmGpuStep 20394, 27002, 28277, 41636, 41783;
  - `runMlsMpmResidentStepWithOptionalWebGpu` (grid update ~37562) and
    `runMlsMpmMechanicsOnlyResidentStepWithOptionalWebGpu` (~39570);
  - then `runMlsMpmGridUpdateWebGpu`, which already takes it with default
    1.2041.
- **Plumbing landed; room air left on the implicit atmosphere.**
  `ambientReferenceDensityKgPerM3` now flows end to end: the worker
  whitelist, the scene's `residentStepsOptions`, step hops 20395, 27004,
  28280, 41644 and 41792, both resident-step functions, and the
  grid-update calls.
- Measured with the value at 0 in room air (`noAmbientAir`, 6000/6000
  admitted, contact 1004/1024):
  - the five air species and the vapor share one height range (the mixture
    law works);
  - but that range is 1.7–57 mm of a 140 mm box: the coarse air **sank**;
  - and the steam no longer rose.
- Cause: a coarse explicit parcel (~7 cm) acts on the grid only within its
  ~5 mm support, so parcels never press on one another. The air is not
  pressure-supported, and the implicit atmosphere was what held it up.
- The mount therefore still passes the default. The real fix is air
  carriers on SS levels whose grid spacing matches their size: the 3+ level
  decision, slice 2 dynamic coarsening. After that, pass 0.

### Coarse air on matching SS levels — survey (2026-11-16, read-only)

- **The classifier already wants it.** Volume-based level assignment
  (`ulg-gpu-abi/src/wgsl.js` ~14406–14543, 1.5 target support cells) puts a
  70 mm air cube on level 3 (8×), 35 mm on level 2 and 17.5 mm on level 1.
  The max-level clamp (`schroederMaxLevel` 0 for Iron Ice) collapses that.
- **Blocker: the 2:1 adjacent pair is hard-wired in about 15 places.**
  - epoch `schroederSpatialEpochGpu.js` ~4040–4066;
  - transaction ~1452;
  - two-level runner `schroederCrossLevelCouplingGpu.js` ~2587–3065;
  - reflux ledger, hierarchy view (`floor_div2`, `*0.5`), parent-field view
    and workspace;
  - interface proposal, gas boundary, invariant evidence.
- **Blocker: coverage admission** throws `ERR_SCHROEDER_TWO_LEVEL_COVERAGE_UNPROVEN`
  when max − min level > 1 (`schroederHierarchyGpu.js` ~8054).
- **Blocker: room-air Iron Ice runs the single-level route** (surface stress,
  S9-C transport, single-level cleanup). The two-level runner has none of
  those, so they would need porting.
- **Blocker: levels only coarsen** (`max(physical, source)`), and split is
  not on the worker lane (slice 1c). Hysteresis is stored but unapplied.
- **Blocker: the SOL-critic Priority 3 gate** (`plan/todo/sol-critic.md`
  ~869–875: no third level until two-level is genuinely sparse) conflicts
  with the user's "3+ levels" decision. It must be explicitly waived or met.
- **Options:**
  - **N-level chain of 2:1 pairs.** Robust and SS-native: per-level field
    views (the loop exists), plus L−1 hierarchy/parent views and reflux
    ledgers, nested restriction and prolongation, capacity by occupancy.
  - **Skip-level pair** (0 and k, ratio 2^k). Minimal, but no level fits the
    graded 17.5–35 mm leaves, and an 8–32× composite sits right at the
    bodies.
- About 46 test files pin the two-level contract.
- **User decisions (2026-11-16):**
  - N-level 2:1 chain (not a skip-level pair).
  - SOL-critic Priority 3 gate waived (recorded in `sol-critic.md`).

### N-level 2:1 chain — phases

A. **Epoch and admission.**
   - Coverage admission accepts a contiguous chain [min..max] instead of at
     most two levels.
   - The epoch keeps the per-level views (the loop exists) and builds the
     hierarchy view and parent-field view for every adjacent pair (l, l+1),
     not only when exactly two levels are present.
   - Each adjacent pair keeps its exact 2:1 checks.
B. **Chain runner** (`schroederCrossLevelCouplingGpu.js`).
   - P2G on every level.
   - Restrict pair by pair up to the coarsest, update the coarsest, then
     prolong pair by pair back down.
   - One reflux ledger per pair, nested.
   - Start with shared dt (fine substep count 1) so no nested subcycling is
     needed; subcycling comes later.
C. **Port the single-level features** onto the fine level of the chain:
   surface stress, the S9-C phase-volume transport (including the gas
   mixture stage) and single-level cleanup. Iron Ice depends on all three.
D. **Room air.** `schroederMaxLevel` 3 for room-air scenes, so the
   classifier places air by size. Then ambient density 0 for an explicit
   atmosphere, and hysteresis against level flicker.
E. **Follow-ups:** proximity refinement (needs split, slice 1c), capacity by
   occupancy, the SOL-critic sparsity items, and mixture parcels.

**Phase A progress (2026-11-16):**
- `normalizeMechanicsLevelSpecs` (`schroederSpatialEpochGpu.js`) accepts a
  chain of up to `SCHROEDER_SPATIAL_MAX_MECHANICS_LEVELS` = 6 levels. Every
  adjacent link must be consecutive with exact 2:1 f32 spacing.
- The epoch builds the hierarchy view and parent-field view for every
  adjacent pair. They are published as `mechanicsAdjacentLevelPairs`, finest
  first. Pair 0 keeps the existing `hierarchyView` / `parentFieldView` fields.
- `createSchroederTwoLevelCoverageAdmission` takes `maxChainLevelCount`
  (default 2, so the two-level runner is unchanged) and publishes
  `chainLevels`.
- The initial transaction contract admitted exactly two descriptors. The
  2026-11-19 chain-authority checkpoint below adds a separate all-pair mode.
- Test `tests/schroederSpatialEpochGpu.test.mjs` is updated: broken third
  link, 7-level chain, nonadjacent, non-2:1.
- **Phase B finding.** The canonical two-level runner
  (`schroederCrossLevelCouplingGpu.js` `runCanonicalSparseMechanics`,
  ~2,000 lines) is a transactional state machine built for one pair: macro
  and micro-epoch authorities, fine-substep and coarse-terminal
  transactions, pending closure and retirement capabilities. The chain
  needs per-pair instances of these, plus nested reflux ordering.

**Inherited topology verified (2026-11-19):**
- Later pairs consume the preceding parent union, including fields with no
  native middle-level particle. The parent ABI stays explicit; native and
  inherited inputs have separate GPU admission and edge construction.
- All pairs are submitted and retired; partial builds release already encoded
  pairs. Cache capacity accommodates all six levels. Parent output capacity is
  bounded by 27 fields per source; candidate scratch remains complete.
- Native GPU 2/3/4/6-level cases pass two build/release cycles each, partition
  and first-moment checks, domain/native-map preservation, capacity/stale-source
  rejection and cloned-owner refusal. 107 host tests and normal build pass.
  Evidence: `~/.cache/icc/repos/ulg/air-level-chain-20261119/`.
- At this checkpoint Phase B remained open: the transaction admitted one pair
  and the workspace could not carry composite inherited mechanics state. The
  new checkpoint below advances authority and upward restriction. The old
  pair workspace still rejects inherited topology until its consumers port.
  No full room-air, plume, performance or campaign-goal acceptance is implied.

**Chain authority and composite restriction verified (2026-11-19):**
- Explicit chain transactions authenticate all 2–6 levels/pairs and their
  phase-moment/receipt buffers. Both phase caches now accommodate six levels.
  Single-level cleanup and unported phase consumers continue to refuse chains.
- `schroederSpatialCompositeMechanicsGpu.js` consumes the exact admitted
  transaction and current native P2G momentum states. Each pair has a distinct
  composite ABI, with restricted baseline and combined state. Bounded,
  deterministic 27-neighbor GPU gather reads sparse keys and admitted weights;
  no dense/CPU field representation or floating atomic reduction is used.
- Mass, momentum, gradients and transported nodal kinetic energy survive
  every upward link. The kinetic budget is retained separately from kinetic
  energy after averaging; downward reflux/heat must still account for it.
- Real P2G → restriction passes 2/3/4/6 levels plus overlapping six-level
  fluid fields, two cycles each; stale GPU mutation fails closed through all
  successors. Final native run 89.2 s, zero GPU errors. 131 host tests pass
  (one opt-in skip), normal build 2.50 s. Evidence:
  `~/.cache/icc/repos/ulg/air-chain-authority-20261119/`.
- Next: force update, conservative downward correction/reflux and G2P at
  shared dt; then phase/mixture/contact/heat consumers and room-air/preset
  proof. The new restriction runtime is not yet enrolled in the production
  runner. Phase B, slice 1c, A5 and G2 stay open; only G5/G7 are accepted.

**Force/downward proposal gate verified (2026-11-19):**
- The composite runtime now optionally encodes coarsest gravity, static-wall
  and normal-contact responses followed by downward correction of every pair.
  Native-level outputs have their own immutable proposal ABI. No native P2G
  field is overwritten or mislabelled as a velocity/heat receipt.
- Mass/CSR-weighted impulse and work preserve linear momentum and the
  transported nodal energy budget. Parent heat and interpolation variance
  remain available for later native heat publication. Force-off is identity;
  gravity gives the expected acceleration/work on every native level.
- Final admission checks all native levels. Stale GPU mutation propagates
  rejection; a timestep fault with one ready/five rejected native levels
  cannot publish a globally ready chain. Seven scenarios/two cycles pass in
  148.0 s, zero GPU errors, fixed 128-byte records. 131 host tests pass
  (one opt-in skip), build 3.06 s. Evidence and derivation:
  `~/.cache/icc/repos/ulg/air-chain-correction-20261119/`.
- Next: native velocity/heat publisher (exact P2G producer/dt binding is now
  verified in the checkpoint below)
  through the existing grid-update/G2P lifecycle, then the production runner.
  Preserve fine-scale forces and phase/pressure consumers without applying
  forces twice. The proposal gate is not a complete particle step, total
  thermodynamic conservation or room-air proof. Phase B, A5 and G2 stay open.

**Exact P2G producer/dt gate verified (2026-11-19):**
- The force/correction path requires every actual unfused submitted P2G
  result, matched to the chain's generation, source buffers, native field,
  mutation ordinal and shared f32 timestep. Private registration remains
  distinct from fused producer admission. Inputs are checked again before
  submission; copies, reordered/missing levels, changed pressure/grid/source
  metadata and stale producers fail before allocating an execution arena.
- Seven native GPU scenarios pass two cycles each in 149.8 s, zero GPU
  errors, twelve provenance checks per cycle. The excess-CFL case now uses
  the same timestep in both real P2G and correction. 353 host tests and the
  normal build pass. Evidence: `air-chain-publication-20261119/`.
- Next: all-level native mutation ownership and velocity/heat publication
  through the existing grid-update/G2P lifecycle. Preserve fine-scale laws,
  pressure and phase receipts; retain correction buffers until their final
  consumer. Production runner, room-air proof, A5 and G2 remain open.

**Native velocity/heat publication verified (2026-11-19):**
- All native fields are reserved before publication; each grid-update call
  receives a private capability for its exact producer and mutation. The
  canonical native receipt lifecycle publishes velocity and sidecar heat
  from the correction budget without another force application.
- Eight native scenarios/two cycles each pass in 167.1 s, zero GPU errors.
  Mass/gradients are preserved and native kinetic energy plus heat matches
  the proposal budget within f32 tolerance. CFL refusal and unconsumed
  pressure obligations fail closed. 353 host tests and build pass; evidence
  is in `air-chain-native-state-20261119/`.
- Next: one coherent G2P particle output for all selected levels, preserving
  exact inventory/quantity ownership and energy receipts. Retain publication
  control until the final consumer. Production runner, phase/mixture and
  fine-scale law integration, actual room air, A5 and G2 remain open.

**Buoyancy double count, root cause (2026-11-16).**
`stage_ambient_buoyancy` used each gas field's own volume. Room-air species
rows are Dalton rows: each fills its whole parcel at its partial pressure. A
5-species parcel therefore received 5× the displaced-air lift; N2 rose to the
ceiling (`mixAir2`). The fix is general Archimedes: the displaced volume is
the field's volume at the atmosphere's pressure, V·p_i/p_amb (Amagat). It
uses the field's admitted absolute pressure row and fails closed on a
non-finite value. A mixture at ambient composition and temperature is then
neutral; warmer or lighter gas rises.

**Amagat buoyancy, measured live (`amagatAir`, 2026-11-16).**
- 6000/6000 steps admitted; contact 1024/1024 clean; no GPU errors.
- Per-species lift is now correct: N2 (M 28.0 < 28.97) rises, O2 (32)
  sinks, vapor (18) rises.
- But each parcel's species rows still separate: N2 sits at the ceiling,
  O2 and Ar on the floor.

**Species co-location audit** (probe `__speciesColocation`: for each row of
the most populous gas, the nearest row of every other gas):
- **~50 steps:** 17–21 of 24 pairs co-located (< 1 µm; median 0.2–0.7 µm).
  But co-located rows already differ by up to 5.7e-6 m/s, about 2% of
  their speed.
- **~2,200 steps:** only 1–3 of 24 co-located; median nearest distance
  2–15 mm, max 45 mm. Nearest-row temperatures differ by up to 61 K (vapor:
  780 K).
- The node mixture binding itself holds: rows still co-located have Δv
  ~1e-6.
- Ruled out as the source of the residual:
  - the lifecycle (confirmed `integrated-s9c` live);
  - surface stress (same-key bonds with nonzero surface tension only, so
    gas is untouched);
  - field contact (gas–gas and gas–condensed are excluded);
  - particle contact and separation (gas is class 0 and rejected);
  - grid-to-particle (APIC from each row's own field's committed, bound
    velocity).
- **Not the cause: the rest-volume wall clearance.** CO2 clamps at 139.0 mm
  against 138.3 mm for the rest. Switching the clearance to the current
  volume J·V0 left the stratification unchanged and coincided with the ice
  block sliding about 60 mm, so it was reverted.
- **Decision:** mixture parcels (slice 3) remove the failure by
  construction. One row per parcel carries the composition, so a parcel's
  species cannot separate.

**Side finding:** in room air, iron oxidation products are liquid (phase 2)
at 5,000–6,800 K. Only materials with an explicit vaporization record can
boil, so an oxide with no vapor data heats as a liquid without bound. A
general fix needs either vaporization data for the products or a caloric
domain limit that fails closed.

**User decision (2026-11-17): mixture parcels with full composition.**
- Each air row carries moles of N2, O2, Ar and CO2.
- EOS, heat capacity and conductivity come from mixing rules.
- Oxidation reads and debits the row's O2.
- Water vapor stays as its own rows, because it condenses.
- Delivered in stages behind an opt-in until complete, so the species-row
  default does not regress.

### Slice 3, stage 1 — mixture parcels (2026-11-17)

- **Material.** `src/runtime/material/idealGasMixtureClosure.js` builds an
  exact mixture of constant-Cv ideal gases that share T_ref = 293.15 K and
  the u = Cv·T convention:
  - M = Σ xᵢMᵢ; Cv = Σ yᵢCvᵢ (yᵢ = mass fractions);
  - Wilke viscosity and Wassiljewa/Mason–Saxena conductivity;
  - the lowest electronic band (O2, 8.6 eV) with oscillator strength × x_O2.
- **Dry air (CIPM-2007, four major species):** M 28.966 g/mol, cp 1004,
  γ 1.400, ρ 1.2042 kg/m³, k 0.0259 W/m/K, μ 1.85e-5 Pa·s. It passes the
  first-principles gate.
- **Opt-in.** Control `environmentAirParcels` (`species` default, or
  `mixture`), threaded like the refine edge. In mixture mode the scene
  replaces the legacy `air` closure with the mixture closure
  (`createSphEnvironmentAirMixtureClosure`).
- **Seeding.** One `air` row per cell plus one h2o vapor row.
  - The parcel's exact mass units are the sum of its species allocations.
    Per-species totals equal species mode to the last unit.
  - `gasComposition` (per-species exact words) rides on the particle for
    stage 2.
  - Test: `tests/idealGasMixtureClosure.test.mjs`.
- **Two general fixes found on the way:**
  1. **Gas rest density basis** (`phaseCaloricBranches`). The gas branch
     density is now on the 101325 Pa basis that the mechanics EOS (ρ_ref =
     ρ_rest·p_amb/101325) and the implicit atmosphere assume. Room-air water
     used its 2339 Pa caloric reference, so vapor's rest density was
     0.0173 kg/m³ instead of 0.749.
  2. **Amagat seeding.** Each gas row starts at m·R_s·T/p (zero gauge), not
     the whole cell. The ambient-referenced EOS reports about 1 atm for any
     row near its rest density, so Dalton rows filling the whole cell had
     claimed the cell at ambient pressure. Humidity vapor got ~140× its
     weight in lift, and the mixture binding then lifted whole parcels.
  - Fixtures moved to the new basis: `tests/fixtures/sphExtendedPhaseCaloric.js`
    and `tests/sphCondensableParticleInitialization.test.mjs`.
- **Matched implicit atmosphere.** Room air sets
  `ambientReferenceDensityKgPerM3` to the explicit atmosphere's initial
  density at the 1-atm basis (mount helper
  `explicitAtmosphereReferenceDensityKgPerM3`). The dry 1.2041 stand-in had
  lifted 50%-RH air at 0.0045 g, about 2 cm in 1 s, as measured.
- **Live** (room-air Iron Ice, `environmentAirParcels=mixture`,
  `mixtureNeutral`):
  - 2243/2243 traced steps admitted; no GPU errors;
  - air holds its seeded layout (14–105 mm, vMax 0.013 m/s);
  - vapor stays in its parcel (21 of 24 rows within 1 µm, median 7.5 nm).
- **Open:**
  - **Parcel temperature equilibrium.** Vapor rows next to the iron reach
    the 1100 K domain cap while their co-located air stays at 293 K: water
    absorbs the iron's infrared and dry air does not. Rows of one parcel need
    the thermal analogue of the momentum binding.
  - **Stage 2.** Oxidation and nitridation read and debit the parcel
    composition. Until then mixture mode has no O2/N2 reactant rows, so it
    stays opt-in.
  - **Re-measure species mode and water-cycle** on the new density basis and
    seeding.
- **Gas mixing conduction (2026-11-17).** The thermal pair visit
  (`schroederSpatialThermalProposalsGpu.js`) no longer treats two gas
  carriers (phase id ≥ 3) as a finite-volume material interface.
  - That geometry's face area comes from the mechanical contact receipt,
    which gases never have, so air and vapor rows of one parcel never
    conducted.
  - Gas–gas pairs now use the overlap geometry, with the centre distance as
    the path (floored at the 0.1 µm mean free path). The pair clamp bounds
    the exchange at equalization.
  - Live (`mixtureThermal`): vapor 319.9 K beside air at 315.1 K, at most
    4.8 K between co-located rows (was 228 K). Conduction ±7.97e-4 J, equal
    and opposite. 2268/2268 admitted.
  - Same-material gas pairs change only at exactly zero distance.
- **Species mode re-measured** on the new basis and seeding (`speciesBasis`):
  - every species holds the seeded layout (14–105 mm);
  - 18–20 rows per species co-located within 1 µm;
  - 1978/1978 admitted.
  - The stratification left unexplained on 2026-11-16 was this same EOS and
    buoyancy inconsistency, not the binding.
- Host suite: 6006 tests, 5898 pass, 0 fail (before the thermal change;
  thermal tests 45/45 after it).

### Slice 3, stage 2 — composition-aware reactions: design (2026-11-17)

Survey (read-only). The GPU has no composition path:
- thermo[0] (`materialId`) is the only species key;
- nothing overrides Cv or molar mass per row.

**Mixture mode today has no oxidation at all.** Discovery runs on the
species keys, so the Fe+O2 rule carries the o2 id, and no o2 rows exist in
mixture mode. (`describeChemicalFormula('air')` throws.)

Room air runs the **f32 mass route** (`ROOM_AIR_EXACT_MASS_DECLARED = false`),
so the sidecar can be f32.

**Blockers** (file:line from the survey):
1. Reactants are matched by row material id:
   - DISC 2112, DORM 141;
   - `reactant_term_for_material` at wgsl.js 2399;
   - LED 323–326.
   - The host packs the reactant molar mass from the *carrier*
     (sphReactionGpuKernel 893–895).
2. Availability is the whole row mass, duplicated at wgsl.js 3176, 6121,
   6704, 7156, 7620 and 7945 (they must agree, per wgsl.js 2309), plus
   pair allocation and the exact source.
3. The survivor update assumes a uniform row: `copy_particle_with_mass`
   (wgsl.js 2166–2203) scales thermo[9], rest volume and reference mass by
   the mass fraction. The energy debit uses the row's u; it should use
   m_O2·Cv_O2·T.
4. u↔T is keyed by material (wgsl.js 734–900, 1240–1500; TK 126–261,
   844–990; SS 2810–3320). Gas caloric admission rejects |m − n·M| > 1e-5
   (CAL 394).
5. Discovery picks one reaction per row, and oxidation and nitridation tie on
   the same (Fe, air) pair (DISC 2133–2155).
6. The reserve-plan material-set key mismatches in mixture mode (DEMO
   177–193, 2686–2697).

**Increments**, each verified before the next:
1. **Composition sidecar.** f32 species masses [N2, O2, Ar, CO2] per row,
   uploaded from `gasComposition`, resident beside thermo, copied wherever
   rows are copied, restored on rollback. No consumers yet.
2. **Thermal T = u/Cv_row** for mixture rows (exact: all four gases share
   u = Cv·T at 293.15 K), at:
   - the SS derived row;
   - `write_thermal_state`;
   - the classic per-particle and neighbour reads.
   - A/B gate: bit-identical while the composition is unchanged.
3. **Host catalog.** Hosted terms: the carrier is `air`, word 9 is the
   O2/N2 formula id, the molar mass is the species'. Energy-authority
   curves are keyed on word 9. Fix the reserve-plan key.
4. **GPU availability and debit** from the sidecar at the six extent
   sites, the step and pair allocation:
   - survivor: thermo[9] −= Δm/M_i·N_A;
   - u kept consistent with T unchanged;
   - rest volume ∝ the new n.
   - Discovery skips a hosted reaction whose component mass is 0, and keeps
     both oxidation and nitridation eligible.
5. **Gas caloric admission** with per-row M and Cv from the sidecar.
- Accepted approximation for now: the mechanics gas EOS keeps the `air`
  R_s/γ (≈3% off for O2-depleted rows; gauge pressure stays zero because V0
  is mass-proportional).

**User decision (2026-11-17): stage 2 uses a composition set, not a per-row
composition.** Only reactions change a parcel's makeup, so the compositions
that can arise form a small closed set:
- air;
- air − O2;
- air − N2;
- the inert Ar + CO2 remainder.
Each is its own exact ideal-gas mixture material. Species reactions are
lifted onto the mixtures, for example
2 Fe + (1/x_O2) air → 2 FeO + (1/x_O2 − 1)(air − O2). The residue gas is
placed as a product. The existing material-keyed reaction, thermal and
admission code is reused, with no new per-row buffer.

### Slice 3, stage 2 — composition set: delivered (2026-11-17)

- **Discovery** (`reactionDiscovery.js` `liftReactionsOntoIdealGasMixtures`):
  - Species reactions are lifted onto every live ideal-gas mixture and onto
    every residue, until the set closes: air, air~o2, air~n2, air~n2~o2.
  - Example: 2 Fe + 4.7756 air → 2 FeO + 3.7756 air~o2.
  - Atoms, mass and moles balance exactly. The enthalpy per equation equals
    the species reaction's, rescaled to the consumed-reactant-mass basis.
  - Residue closures (`createIdealGasMixtureResidue`) come back as product
    closures. Mixture closures carry fractional `atomCounts`.
- **Live-set pruning.** With `liveMaterialKeys`, reactions of a species that
  exists only inside a live mixture are dropped, since their lifted forms
  replace them.
- **Reserve authority.** Live mixture keys are compared through their
  components (`reactionDiscoveryMaterialKeys`).
- **Spectator energy.** The residue is a spectator. It leaves with
  u_res = (Cv_res/Cv_mix)·u_mix of the consumed mixture row (exact under
  u = Cv·T), and the real products share the rest plus the heat. This is
  the species reaction's energy balance.
  - Host: a spectator section, one vec4 per product term [flag, ratio,
    mixture id, sentinel −7340.25], sits just before the gas constitutive
    records. Kernels find it at gas_constitutive_offset − product_term_count.
  - Registered in the ABI layout, `assertSphReactionGasLayout`, the
    target-schedule watch sections, the energy authority, the cold-start
    cache (schema v2) and `combinedRecordCount`.
  - Heat proxy gauge: spectators get gauge 0, and the real products' average
    excludes the spectator mass and reference energy.
  - GPU: step kernel (validation and emission) and product-event kernel,
    identical formulas.
- **Product-history arena ceiling** raised 32 → 128 MiB. The requirement is
  rows × product terms × 1 KiB, so 8 terms on 6320 rows is 52 MB. It is
  still bounded by device limits.
- **Live** (`mixtureLift4`, room-air Iron Ice, mixture parcels):
  - 2131/2131 admitted; no GPU errors;
  - FeO formed from parcel O2 (81 mg, 5 rows); 3 air parcels fully consumed
    into product slots;
  - air~o2 residue 60 mg at 296.9 K (the spectator kept its temperature).
    It rises to the ceiling, being 2.9% lighter than air.
- **Open:**
  - FeO still reaches 6780 K: the heat proxy puts all the reaction heat in
    the oxide, and it cannot boil (no vaporization record). This is
    pre-existing, as in species mode.
  - Mixture parcels stay opt-in until the visual and acceptance checks are
    re-run on them.

**Product-property quality (finding, 2026-11-17).**
- FeO and Fe3N2 come from discovery's derived product closures.
  - FeO melts at 51.5 K, boils at 59.2 K and has density 2903 kg/m³.
    Reference values are about 1650 K, a boiling point of about 3687 K, and
    5745 kg/m³.
  - The compound bank holds only 9 compounds, with no iron oxide.
  - The live scene's FeO (liquid, rest density 10130) comes through a
    reduced product path and heats as a liquid to 6780 K.
- **General fix:** anchor product closures to bank records (add reference
  FeO, and the nitride question). Then the explicit boiling authority, or
  the legacy ladder's boiling plateau, caps product temperatures.
- Fe3N2 itself is a stoichiometric-family guess. The known nitrides are
  Fe4N, Fe3N and Fe2N.

## Chain particle integration checkpoint — 2026-11-19 UTC

The shared-dt native chain now feeds the original per-level G2P and contact
solver and gathers one physical/exact-quantity candidate. Unique row ownership
and every native energy receipt gate the whole batch. Later-level rejection
restores earlier successful levels as well. Native-g passes seven cases twice,
including genuine exact inventory and quantity rollback; 451 host tests and
build pass. Evidence: `~/.cache/icc/repos/ulg/air-chain-g2p-20261119/`.

Remaining: original post-mechanics energy/thermo closure and batch-control
admission, production enrollment/repeated successor evolution, native exact
residual-history support, required fine-scale pressure/phase/mixture/surface
consumers, then actual room-air/plume proof. Gather allocations remain
unpooled. G2/A5 and the full campaign stay open; only G5/G7 are accepted.

## Multilevel thermal closure candidate — 2026-11-19 UTC

The combined G2P result now enters the real thermal and constitutive refresh
stages with its original caller timestep and a private producer capture.
A final GPU check rejects upstream/refresh/thermal faults or missing particle
output, restoring every original state, thermo, mechanics and exact-quantity
word. Pending candidates cannot claim continuation or advance the live clock.
Contact warming survives the closure; gravity preserves the GPU caloric
baseline. Exact thermal's missing conductivity binding and 13-storage-buffer
capability check are repaired; retained refresh validation stays alive.

Five native scenarios pass twice in 86.9 s with zero GPU errors. 538 focused
host tests and the normal build pass. Evidence and earlier failures:
`~/.cache/icc/repos/ulg/air-chain-closure-20261119/`.

This verifies the exact-quantity thermal/refresh candidate, not production
closure acceptance. Next: canonical integer-energy ledger and phase/reaction/
parcel/finite-wall batch integration, then resident state/clock admission and
repeated successors. Native exact residual history, pressure/mixture/surface
consumers and actual room-air/plume proof remain. No new G1–G7/A1–A6 acceptance;
only G5/G7 accepted, G1 deferred. No commit/push/merge/Pages build.

