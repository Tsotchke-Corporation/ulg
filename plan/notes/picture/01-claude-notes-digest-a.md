# Digest A: Claude memory notes read in full by Hermes on 2026-11-17

Source: `~/.claude/projects/-home-cos-projects-ulg/memory/<name>.md`. Figures are Claude's, not re-measured by Hermes.
Everything described here is uncommitted work in the tree unless it says otherwise.

## G2 conserved plumes

### ulg-g2-phase4-5-modules (2026-11-14)
- Phase 4 vapor-parcel exchange: `src/runtime/sph/sphExactVaporParcelLedgerGpu.js`; gate `tests/sphExactVaporParcelLedger.native.test.mjs` (`ULG_RUN_NATIVE_EXACT_VAPOR_PARCEL=1`).
- Phase 5 parcel transport: `src/runtime/sph/sphExactParcelTransportLedgerGpu.js`; gate `tests/sphExactParcelTransportLedger.native.test.mjs` (`ULG_RUN_NATIVE_EXACT_PARCEL_TRANSPORT=1`).
- Parcel ledger is `[dry | water | U]` per parcel. Exchange: one thread per gas cell after a counting sort (single writer).
- Energy is quasi-steady: water joins/leaves at the parcel's own u, latent difference goes to the cell gas.
- Droplet ODE is stiff: substeps of at most tau/4.
- Phase 6a LIVE: `environmentNucleiPerCm3` seeds ammonium-sulfate nuclei (kappa 0.61) on the ledger route; closure runs `sphLedgerParcelStagesGpu.js` after the ledger phase; water-cycle humid air condenses grams of water with mass and energy exact.
- Phase 6b optics: `sphLedgerParcelOpticsGpu.js`; gate `tests/sphLedgerParcelOptics.native.test.mjs` (`ULG_RUN_NATIVE_LEDGER_PARCEL_OPTICS=1`). Haze at 100/cm3 and 80% RH is honestly faint (tau ~0.1 across 5 m). Do not boost optics.
- Phase 6c: Environment UI round trip passes 7 of 7 (`scripts/g2-environment-roundtrip.mjs`).
- Status line: "G2 Phase 6 is done except the Iron Ice plume". Transport cell lists deferred.
- The 8-ulp rule: every ledger view writer keeps the f32 path's u when within rounding of proj(U)/m (thermal 8 ulps, phase reconcile 8, vapor-parcel exchange 8). The old 4-ulp bound caused the humid-air contact fail-closed (resolved).
- Probe tools: `S0_CONTACT_AUDIT=1` with `S0_PROPOSAL_AUDIT=1`; `S0_TRACE_ROWS=a,b`; `S0_PASS_TRACE_SLOTS=59,60,61` with `S0_PASS_TRACE_ROWS=<rows>`.
- Probe trap: `ledgerAudit[0]` is the page context, whose parcel family never steps. Read the `ulgOffscreenRender.worker.js` entry.
- Lesson: find writers with `S0_PASS_TRACE_SLOTS`; do not guess.

### ulg-iron-ice-collapse-no-vapor (2026-11-13)
- At dt 1 ms the ice collapses ~250x within 0.1 s (the app caps sound speed by dt, so moduli are 4x softer). Iron Ice evidence must run at dt 0.5 ms (the preset default).
- "2.2 s onset" is the preset's initial-rate screen, never a measurement.
- Check body bounds before blaming thermal.
- Clean-HEAD A/B method: git worktree, symlink `node_modules`, copy `.cache/vite-https`, symlink `peercompute` and `webgpu-marching-cubes` beside the worktree, vite on port 5174 with `ULG_VITE_HTTPS=1`, probe with `S0_BASE_URL=https://127.0.0.1:5174/`.

### ulg-contact-owner-cap-thermal-failclosed (2026-11-13 to 11-16)
- Chain: contact owner frontier overflow -> ITERATION_INCOMPLETE -> contact interface receipt READY|FAIL_CLOSED (status 10) -> thermal admits no pairs -> no conduction.
- Owner admission caps: `OWNER_MAX_ACTIVE_PARTICLES` 1024, `OWNER_MAX_ACTIVE_CURSORS` 131072, terminal window 64 from pass budget-16 (`schroederSpatialMechanicalProposalsGpu.js` ~17138, ~17285).
- Raising the cursor cap does not fix it (tried, reverted). Owner design limit; the real fix is the owner redesign (Jacobi-wide pair application): architecture, "contact first".
- ROOT CAUSE FIXED 2026-11-16: `SPH_CANONICAL_CONTACT_POSITION_TRUST_DIAMETERS` 16 -> 1 (`sphCanonicalContactMotionBound.js`, revision `-v2`). Pair rows fell from ~440k to ~12-15k.
- Second fix: contact u checks are gauge-correct (`next_u < start-of-step u`, not `< 0`; ice u is negative in the phase-caloric gauge).
- Third fix: reaction products hosted in place in a freed reactant row caused lineage material mismatch (0x4100). Now the pair is deferred (`reaction_row_hosts_product`, `reaction_pair_deferred`).
- Remaining: ~25% of steps ITERATION_INCOMPLETE (0x4400) = pass-budget convergence failures on impact steps.
- Rule: never read "no conduction" on Iron Ice as a thermal/ledger bug before checking the receipt status (word 15 == 6).
- Rule: thermal proceeding without a contact receipt is an approximation and needs user approval.

### ulg-interface-skin-law (2026-11-14/15); record `plan/todo/interface-resolution.md`
- Refinement cannot resolve phase fronts (a 0.1 s contact needs ~64,000x more carriers). So the user's fallback was built: the Stefan skin partition interface law. Energy conserved by construction; only material/phase-interface pairs.
- Code: `schroederSpatialThermalProposalsGpu.js` (derived words 10..19, `interfacePhaseFront`), `sphPhaseCarrierTransferGpu.js` (binding 9, `front_conversion`), `sphMlsMpmPostMechanicsClosure.js`. Gate `tests/sphPhaseCarrierInterfaceFront.native.test.mjs` (`ULG_RUN_NATIVE_INTERFACE_FRONT=1`).
- The steam stall was the contact pass budget: 512 (interactive default) stalls forever because a failed step holds the lane on the same input; 1024 fails in blocks; 2048 gives zero failures (steam 20 mg at 948 K by 1.6 s, 2-8 steps/s).
- OPEN, A1, user decisions pending: contact-failure liveness (escalate budget or publish partial result rather than hold) and owner convergence speed.
- A 4 s run at 2048 passes decayed to ~1 step/s and LOST THE GPU DEVICE at 3.07 s (`schedule-terminal-gpu-fence-unsatisfied`, "A valid external Instance reference no longer exists", no Xid).
- At dt 0.5 ms with 512 passes: steam forms (11 mg, ~880 K by 2.9 s, ~19 steps/s); contact fails ~40% of late steps but recovers.
- Steam did not rise because the single-level worker lane had no gas/condensed slip transport. Iron Ice two-level fails closed at step 1 (coarseFieldCount = 0 at t = 0; `begin_registry` rejects it). Parked as a robustness item.
- Chosen: S9-C transport on the single-level route (`resolveSingleLevelPhaseVolumeTransportAuthority`, law activation receipt field `phaseVolumeInterfaceTransport`).
- Mechanics freeze from tick 3608: melt release (`schroederSolidReleaseGpu.js`) left represented entities at 0. Fixed (release sets m*N_A/M). Result: 0 of 5,833 rollbacks; steam at y 30-137 mm in a 140 mm box. STEAM RISES.
- Rule: long evidence runs use `&observeSpatialAuthority=1` (a frozen scene looks plausible in a final-state readout).
- Traps: `AB-TEMP` / `DIAG-TEMP` edits must be grepped to zero; the mechanics prewarm test pins contact cache keys; WGSL reserves `active` and `target`.

### ulg-room-air-iron-ice-rollbacks (2026-11-16/17), the longest chain
General fixes, in order:
1. u >= 0 checks removed (finite-only) in G2P, the G2P energy receipt, the aggregate view.
2. Gas slivers dropped below f32 position resolution (`sphEnvironmentParticles.js`).
3. Stencil support floor `weight >= 2^-60` at every field-key support site.
4. Heat-proxy gauge for reactions.
5. Minimum gas fraction 1e-3, USER-APPROVED (`SPH_SPATIAL_GAS_FREE_VOLUME_MINIMUM_GAS_FRACTION`, `sphSpatialGasFreeVolume.js`); overfill is counted in word 20, not rejected.
6. Contact trust 16 -> 1, gauge-independent contact u checks, product-hosting deferral (see above).
7. `roomAirCaloricReference.js` H2O `maxTemperatureK` 600 -> 1100.
8. Bulk explicit fusion authority (law id 2 `PRESSURE_CARRIER_LAW_EXPLICIT_FUSION`, `explicit_fusion_conversion` in `sphPhaseCarrierTransferGpu.js`): room-air ice MELTS. Gate `tests/sphPhaseCarrierExplicitFusion.native.test.mjs` 4/4.
9. `explicit_boiling_conversion`: room-air BOILING works, steam forms. Static table cache (`sphColdStartCache.js`) schema bumped to v1.
10. Drag-pair energy gap was f32 underflow (`dot(D,D)` for ~1e-18 kg sliver fields); operator rewritten without impulse products. Gas-mixture momentum stage (stiff Maxwell-Stefan, CM velocity per node) re-enabled; live room air 6000/6000.
11. Buoyancy double count fixed (Amagat V*p_i/p_amb in `stage_ambient_buoyancy`). Implicit atmosphere stays on for room air.
12. 2026-11-17 room-air drift root causes, all fixed: gas density basis `GAS_MECHANICS_REFERENCE_PRESSURE_PA` = 101325; rows seeded at Amagat volume; implicit atmosphere density matched to the explicit air (`explicitAtmosphereReferenceDensityKgPerM3`); gas-gas pairs conduct over centre distance.

State after those:
- Room-air Iron Ice runs 6000/6000 admitted, oxidation works, species stay co-located, parcel temperature shared.
- Mixture parcels: `environmentAirParcels=mixture`, `src/runtime/material/idealGasMixtureClosure.js`. Stage 1, opt-in. Stage 2 (oxidation reads the composition) is NEXT.
- Oxidation products sit at 5,000-6,800 K as liquids (heat proxy puts all reaction enthalpy in the product; no vaporization record for oxides).
- Contact is ~47% ITERATION_INCOMPLETE once water exists.

Visual matrix, 2026-11-16 (vacuum, headless):
- `standard-iron-ice-quench`: PASS.
- `scientific-calibration-iron-ice-quench` (4.1 s): passes all but **iron-cools** (1850 -> 1842 K against a required 10 K; adiabatic walls, no radiative sink).
- USER DECISIONS 2026-11-16: steam terminal uses a per-carrier ceiling band (`perCarrierClearanceBand`); iron-cools is left failing until A5.
- Root of the small steam yield: molten iron runs off into a puddle beside the ice (small Fe-ice contact area). That is A5. User: "G2 stays open until A5".

User direction 2026-11-16: "treat air as a first class sim object in the sph sim like everything else". Decisions:
- First-class air comes BEFORE the contact redesign.
- Air uses the SS pattern (big cubes in the bulk, fine near other materials).
- The third SS level hold is lifted (3+ levels).
- Air parcels are mixture parcels.
- Plan: `plan/todo/first-class-air.md`.
- Progress: Slice 4 (gas k and mu anchored) done; Slice 1a (split-spare reserve, status 252) and 1b (GPU lineage scan, native-tested) done; Slice 2a graded seeding via `environmentRefineEdgeMm` (17.5 mm runs 521/521 at 7.3 steps/s; 8.75 mm hits the 32 MiB product-history arena cap).

Diagnosis toolkit: `S0_G2P_REJECT_TAG=1`, `S0_P2G_REJECT_TAG=1` (+ `S0_P2G_TAG_START`); `__speciesColocation` audit; capture first failing pair into the transport-scratch tail and replay.
Startup trap: "never started stepping" can be a fail-closed schedule. Read `samples[-1].errorText` (`__mlsMpmResidentAutoSchedule`).
The 75-92% "admitted" figures from short windows were wrong: short windows taken before a freeze mislead.

### ulg-finite-walls (2026-11-15)
- Default wall model for passive containers: `finite-heat-capacity-lumped-face` (fe, 2 mm). State in `src/runtime/sph/sphFiniteWallStateGpu.js` (signed 64-bit count of 1 uJ quanta).
- water-cycle keeps fixed faces (controlled heater/cooler plates). Iron Ice preset stays adiabatic.
- Exact thermal variants refuse finite walls (would need 13-14 storage buffers; limit is 12).
- The default iron-on-ice preflight is now honestly infeasible (sealed finite box mixes to ~300 K).

## G3, G5, G6, G7

### ulg-g3-solids-progress (2026-11-14): G3 = SOL-0/SOL-1, DELIVERED on the f32 route
- `schroederSolidRigidGpu.js` (32-word frame record, DLM free-rotation splitting, warm-started projected Jacobi contact, exact reductions), `schroederSolidShapeCarrier.js`, `schroederSolidRigidLane.js`, `schroederSolidThermalGpu.js`, `schroederSolidReleaseGpu.js`.
- Live: an initial body with `mechanicsMode: 'rigid'` seeds a rigid body. Evidence: `scripts/g3-solid-sequence.mjs`; bodies in `~/.cache/icc/repos/ulg/g3-solids-20261114/bodies.txt`.
- Limits: release is off on exact-mass routes.
- Traps: anisotropic cell pitch fails the app preflight silently (scene falls back); the worker presenter's pass-order contract test forbids new `passOrder` entries.
- Plan and results: `plan/todo/g3-solids-proposal.md`; SOL levels in `plan/todo/sol-critic.md`.

### ulg-g5-g7-delivered (2026-11-14)
- G5: bounded CAS reservation ledger, `peercompute/peercompute/src/peercompute/stateManager/ReservationLedger.js` (a PeerCompute repo edit, uncommitted there). ULG wiring in `schroederWorkerLaneControlPlane.js` (ledger `ulg-schroeder-target-tokens`). One realm; distributed exactly-once is not claimed (that is A6).
- G6: `src/runtime/material/localClosureFitCache.js` (Chebyshev fits of u(T)); host-side only, no GPU resident evaluator (A3/A4).
- G7: `src/tools/scienceReleaseAudit.js`, `scripts/science-snapshot-ingest.mjs`, `scripts/science-release-audit.mjs`. Finding: many bank melting points are wildly off (Hg 2,377 K vs 234 K; Br 9,694 K vs 266 K); preset elements agree. Report `~/.cache/icc/repos/ulg/g7-release-audit-20261114/`.
- Tool: `scripts/wgsl-compile-check.mjs /src/<module>.js <export>` (needs the dev server).

## Architecture tasks

### ulg-a5-solid-fluid-coupling (2026-11-14/15); record `plan/todo/a5-solid-fluid-coupling.md`
- SOL-3 heat: `schroederSolidFluidThermalGpu.js` (integer quanta of 1e-9 J). SOL-3 contact: `schroederSolidFluidContactGpu.js` (frictionless, exact scatter into the frame). Both run only on the f32 route.
- SOL-2 body-body contact DELIVERED 2026-11-15 (`warm_start_pairs`, `contact_pairs` in `schroederSolidRigidGpu.js`; brute force O(P^2/2)).
- Presentation stall with rigid body and no room air: FIXED (`solidReleaseSlot`).
- Plume census on rigid ice at 6 s: no steam. Cause is resolution (coarse 0.115 g parcels heat as a bulk), plus A1 throughput. Walls are NOT the Iron Ice cause (preset is adiabatic).
- 8x finer ice (2,048 rigid members) OOM-killed the render worker (before the leak fix).
- A2 evidence (`plan/todo/a2-incremental-spatial-evidence.md`): SS rebuild is at most ~6% of GPU per step, GPU under 10% of wall time. Do not adopt repair yet.

### ulg-a6-remote-derivation (2026-11-14); record `plan/todo/a6-remote-derivation.md`
- User direction: derivations run IN THE CLIENT under WASM + WebGPU (Eshkol's and MoonLab's WebGPU builds). Never host-side. The Node responders were deleted.
- Test `tests/a6ClientDerivation.native.test.mjs` (`ULG_RUN_NATIVE_A6=1`) passes C1-C6.
- MoonLab browser WebGPU path was dead (2 bugs). Fixed in PR tsotchke/moonlab#50 (branch `fix/webgpu-native-dispatch`).
- Cross-device placement needs the user's go-ahead.
- Trap: editing files under `public/` makes Vite fully reload open app pages.

### A1 supporting notes
- ulg-indirect-dispatch-cost: `dispatchWorkgroupsIndirect` costs ~0.29 ms each on Chromium (Dawn validation). 2026-11-15: the staged-args guard pattern converted 14 more sites exactly (+9-18%). Remaining: P2G (5, must bind the staged argument buffers), contact solve (2), epoch assemble (1), field radix GpuCount (1). Exactness gate `scripts/a1-ab-check.mjs` with `A1_FINGERPRINT_STEP`; throughput gate `A1_TIME_FROM` / `A1_TARGET_STEPS`. Same-build A/B switch `__ulgForceIndirectFieldConsumers`.
  - Trap: a fixed wall window after stepping biases A/Bs (a faster config measures a later, slower scene phase).
  - Standing fact: product history capacity doubles over a run and each doubling materializes a fresh pipeline family (~100 pipelines x ~25 ms compile), which explains long warmups.
- ulg-worker-memory-leak: FIXED 2026-11-15 (heap growth 145 MB/30 s -> 4 MB/30 s). 5-min headless soak at 47.9 steps/s: renderer RSS flat at 1.25-1.3 GB. Tool `scripts/a1-memory-soak.mjs`.
- ulg-owner-lane-parallelism (2026-08-27): the cleanup owner is ~76% of the step on sodium-water. Sodium preset wired to `contactCleanupPasses: '48'` + `contactInnerRounds: '2'` (32 steps/s sustained). Default 512 degrades to ~7 steps/s; a default-quality 30 fps claim needs the owner solver redesign (Jacobi-wide pair application). `?residentGpuTimestampProfile=1` gives real per-stage GPU time. `stageMs` is host enqueue time.
  - The 7-arm STANDARD visual matrix (`ULG_VISUAL_MATRIX_STANDARD=1`) is the campaign gate. The 12-arm generic matrix has 9 pre-existing failures and is not the gate.
- ulg-cesium-fluorine-not-a-hang (2026-11-15): never pass `sdt` to cesium-fluorine; wait 60 s before calling a preset hung; a fresh profile cold-compiles ~462 pipelines (~30 s). The refused private retry (CFL rejection + dormant reaction watch) is a real limitation for larger-dt work. `globalThis.__ulgLaneTrace` in the render worker.

## Machine safety (matters for the user's "don't crash my window manager")
- ulg-gpu-loss-xid-check (2026-10-27): on device loss read `journalctl -k | grep Xid` first. From 10-24 to 10-27 all 116 Chrome losses were Xid 109 CTX SWITCH TIMEOUT, from exact-rational kernels in the live (animating) app. Hypothesis, unproven: the compositor needs a GPU context switch and cannot preempt a long pass. Integer-ledger passes take at most ~32 us and caused no Xid.
- ulg-native-test-oom-crash (2026-11-14): a native WebGPU test OOM-killed the box twice (uncapped error array from an invalid shader, node grew to 20 GB). Rules: cap error collection (20), compile-check WGSL first, run native tests in `systemd-run --user --scope --quiet -p MemoryMax=4G -p MemorySwapMax=0`, request the device with `webGpuDeviceDescriptorForResidentSph(adapter)`. After any session death check `journalctl -k | grep -iE "oom|Xid"` and say plainly if my command caused it. (Claude once said "no crash"; the user called that gaslighting.)

## Standing user feedback
- ulg-finish-goal-before-architecture (2026-11-14): goal order does not matter if all are achieved; a goal may stay open until the architecture it needs lands (G2 waits on A5). Move swiftly; no over-analysis, no over-detailed plans. Speed requirements needing architecture belong to A1 ("yes move it to A1, allow dt 1 ms"). No new per-step host fences or readbacks in goal code.
- ulg-user-general-laws (2026-11-14): no bespoke laws for specific scenarios. Find the general cause (resolution, boundary conditions, non-derived constants). Resolution first; the interface boundary law is the fallback if resolution tanks the frame rate. "Make honest walls that aren't infinite sinks."

## SS background
- ulg-schroeder-simulation: SS = Schroeder Simulation = Schroeder Tree (GPU-resident scale hierarchy whose nodes are both multilevel MLS-MPM grid nodes and law-aggregate nodes) + Schroeder Algorithm. Not Barnes-Hut/AMR. The Law Adapter Contract is at `plan/todo/SS/schroeder-tree-and-algorithm-plan.md:129`; it exists but is not enforced as a type. Do not propose a "law descriptor" as new.
- 2026-11-16 user decisions: the hierarchy generalizes to an N-level chain of 2:1 pairs; the SOL-critic Priority 3 gate (sparsity before a third level) is waived. Blockers: 2:1 pair hard-wired in ~15 places; coverage admission rejects more than 2 levels; Iron Ice runs single-level; ~46 tests pin the two-level contract.
