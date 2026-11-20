# Digest D: larger-dt work, mixture parcels, G2 ledger phases 1-3, probe traps, standing feedback

Sources: Claude memory notes `ulg-eshkol-coarse-dt`, `ulg-mixture-parcels`, `ulg-probe-measurement-traps`, `feedback-gpu-budget`, `feedback-nothing-on-host`, `feedback-no-headed-browsers`, `ulg-g2-energy-ledger-phase1`, `ulg-g2-reaction-ledger-phase3`, `ulg-submit-burst`, `ulg-live-app-gpu-probe`. Figures are Claude's.

## A1 larger-dt slice (user 2026-11-15: "Start, 1% error budget"); plan `plan/todo/a1-eshkol-coarse-dt.md`
- Key fact: `sphPhaseDemo.js` caps sound speed at cflSafety*L/dt and scales moduli by (c_cap/c_real)^2. Changing dt changes the stiffness. Pin cflSafety proportional to dt for a fair A/B (`A1DT_FIXED_CFL_AT_1MS`).
- Harness: `scripts/a1-coarse-dt-error.mjs <scenario> <T> <dt list>` (headless; lane fingerprint via `__ulgFingerprintExport`).
- Eshkol AD EOS stiffness: `src/runtime/material/eshkolEosStiffness.js` (K(rho) = rho*dp/drho for the Tait and linear-gas EOS); native gate `ULG_RUN_NATIVE_ESHKOL_EOS=1 tests/eshkolEosStiffness.native.test.mjs` (AD vs analytic 2.2e-16).
- Prototype `tests/fixtures/semiImplicitMpmPrototype.js`: consistent implicit MPM with matrix-free CG. Reduces exactly to explicit at the same dt; stable at 4-16x dt; KE within 1% up to 8x dt; volume to 0.4%.
- User chose "Second-order stepping" (SSP-RK2). Finding: MPM's dt sensitivity (~2% momentum per dt halving) is NOT time-integration error; it is per-step P2G/G2P transfer filtering, which scales as 1/dt. So "1% against a finer-dt run" is ill-posed for MPM.
- Replacement gate, physics-scored, PASSES: `tests/semiImplicitMpmSloshGate.native.test.mjs` fits the first sloshing mode against omega^2 = g k tanh(kh). At 64^3, semi-implicit at 4 ms (c*dt/dx 6.4) is +0.008% from analytic. 8 ms (c*dt/dx 12.8) diverges. Envelope: c*dt/dx <= 6.4.
- Canonical Tier-0 implicit pressure: `src/runtime/sph/sphImplicitPressureGpu.js`; knobs `implicitPressure=1&implicitCfl=4&implicitIters=N`. Iterations follow max(10, 5*c*dt/dx). Jacobi preconditioning hurts. The flag-on scatter is deterministic 64-bit fixed point.
- water-realtime is REAL TIME BY DEFAULT (user chose this 2026-11-15): preset sets sdt 0.008, implicitPressure, realtimePacing, residentStepsPerSchedule 256. Operating point c*dt/dx 3 (15 CG iterations): 1.29 sim-s/s at 60 fps with no flags; 1.30 with the A4 resident evaluator.
- The live operator's K is Eshkol-derived: `src/runtime/material/eshkolEosStiffnessTable.js` (cached Chebyshev fit; regenerate with `scripts/derive-eshkol-eos-stiffness-table.mjs`; receipt `stiffnessSource: eshkol-derived-chebyshev-v1`).
- A4 resident GPU evaluator: `src/runtime/material/responseFunctionGpu.js` (`rf_eval`, strict: out of box gives ok = 0). The implicit-pressure K comes from it (binding 12).
- ~5% of Tier-0 boundary proofs fail open; pre-existing (`__ulgTier0RealtimePacing.failureReasons`).
- `residentGpuTimestampProfile=1` moves water-realtime OFF Tier-0, so the pass census does not see the solve.
- A residual-based early stop (`implicitTol`) does not track the observables; keep fixed counts.
- Iron Ice does not benefit yet: it runs the canonical route with laws on, and its solids' shear is explicit.

## First-class air slice 3: mixture parcels (2026-11-17)
- Opt-in `environmentAirParcels=mixture` (default `species`).
- Stage 1: `src/runtime/material/idealGasMixtureClosure.js` builds one `air` row per cell (exact constant-Cv mixture of N2/O2/Ar/CO2 with fractional `atomCounts`).
- Stage 2 DONE: composition set (USER DECISION 2026-11-17, instead of a per-row composition sidecar). `reactionDiscovery.js` `liftReactionsOntoIdealGasMixtures` turns 2 Fe + O2 -> 2 FeO into 2 Fe + 4.776 air -> 2 FeO + 3.776 air~o2, closing over residues (air~o2, air~n2, air~n2~o2). Spectator energy: the residue keeps u = (Cv_res/Cv_mix)*u_mix (spectator section, sentinel -7340.25; registered in the ABI, gas layout, watch sections, energy authority, cold cache schema v2).
- Product-history no-host arena ceiling 32 -> 128 MiB.
- Live: FeO forms from parcel O2; the residue keeps 297 K. Tests: `tests/idealGasMixtureClosure.test.mjs`, `tests/idealGasMixtureReactionLifting.test.mjs`.
- OPEN: FeO reaches 6780 K under the heat proxy (pre-existing: no oxide vaporization record). Mixture mode is not yet the default.

## G2 integer ledger, phases 1-3 (plan `plan/todo/g2-integer-ledger-proposal.md`)
- Phase 1 (2026-11-13) passed on the integer-only route: `tests/sphExactThermalEnergy.native.test.mjs` (`ULG_RUN_NATIVE_EXACT_THERMAL_ENERGY=1`); ICC attempt `g2-phase1-energy-ledger-gate-20261113`.
  - Record `[U rows | S rows | control]` per carrier family; `U0 = fl32(m*u)`; budget Sum(U - S) = constant (integer identity, no tolerance).
  - The ledger ends rather than going stale: any step that changes u without a ledger writer ends it.
  - Ledger code lives only in separate WGSL variants (`createSchroederSpatialThermalProposalLedgerWgsl`, `appendSphExactThermalEnergyWgsl`); compiling it into the shared base template made every proposal pipeline slower.
  - Canonical pair evaluation `f(lo, hi)` is required for exactness.
  - Traps: `createReferenceMaterialClosures().fe` has no phase conductivity; undeclared wall faces are 0 K reservoirs; the exact-mass native test needs the tailnet hostname `https://fastbox.tail5c077c.ts.net:5173/`; WGSL `var x: T;` with no initializer inside a loop keeps its old value on the native compiler (write `var x = T();`).
- Phase 2 (2026-11-13). USER DECISIONS: u is INTERNAL energy everywhere (gas uses Cv; vaporization absorbs dh - RT/M); keep the type-2 plateau rule and make it exact. Done: ladder in `thermoState.js`; `sphExactPhaseLedgerReconcileGpu.js`; mechanics heat booked as an exact recorded source (status bit 2); `exactEnergyLedger=1` declares non-air exact mass. Live Iron Ice exact to 2.304 s; water-cycle exact at 0.35 s with 30 MJ of wall heat in S.
- Phase 3 (2026-11-14) gate met on live sodium-water at dt 1 ms: `sphExactReactionLedgerReconcileGpu.js`; evidence `~/.cache/icc/repos/ulg/g2-phase2-iron-ice-20261113/na-ledger-gate2.json`; `node scripts/g2-ledger-audit.mjs <file>`; ICC attempt `g2-phase3-reaction-ledger-20261114`.
  - USER DECISIONS (2026-11-13): heat-proxy reaction law, chemical heat as a recorded source; water-cycle accepted as the Phase 2 live vapor evidence; contact fail-closed stays.
  - Route gate: ledger mode needs the explicit `energyLedger: true` declaration (`sphExactMassParticleSeed.js`).
  - Traps: the placement compact-count buffer is STORAGE|COPY_DST only (a copy from it silently invalidated the whole submission); `S0_PROPOSAL_AUDIT=1` rings make sodium-water crawl (use `S0_LEDGER_AUDIT=1` alone); element residual <= 2.4e-6 relative (mass itself bit-exact).
  - As of 11-14 sodium-water conduction was mostly off on both routes (contact receipt fail-closed in ~92% of steps). Not known to Hermes whether the 11-16 trust fix changed that.

## Submit burst (2026-08-28, commit 1a779dd)
- `armWorkerQueueSubmitBurst` in `src/runtime/webgpuComputeLayout.js` holds command buffers and flushes one submit. Eligibility from the law-activation receipt (all law families quiescent); sodium never opens. Knob `?submitBurstSteps=K`; bulk-water preset bakes K=8.
- +7% at 1k-13.8k particles, -7% at 104k. Write-through measured worse.
- Structural verdict: the exactly-once epoch transaction, single-use contact proposal and strictly-advancing per-step seals forbid K-substeps-per-epoch today. Field-view/compact paths are NOT stale-safe.

## Live-app probing (2026-10-27)
- Dev server is HTTPS only (`https://127.0.0.1:5173/`).
- The app does not step until `#sph-play` is clicked after `overlay.__sphPhaseRebuildWorker.status === 'complete'`. First schedule ~35 s (pipeline compiles).
- Simulation and presentation share ONE device in `ulgOffscreenRender.worker.js`; the page has a second, idle device.
- On a shared device do not push error scopes; filter `uncapturederror` by label.
- `ui raf 119.9` counts rAF callbacks, not presented frames.
- `scripts/g2-ledger-live-probe.mjs` is the template for running a kernel inside the live app; `scripts/realtime-gap-probe.mjs` times every app pass (injects `timestampWrites`).

## Probe traps (each produced a confidently wrong conclusion once)
1. `/tmp` is a 24 GiB tmpfs; when full, Chrome's renderer dies with "Execution context was destroyed". Point output at real disk.
2. `sph-long-horizon-probe.mjs` reads `ULG_PROBE_URL` (`ULG_PROBE_SCENARIO_URL` is silently ignored). Verify the particle count in the output.
3. `ULG_VISUAL_MATRIX_CAPTURE_FRAMES=0` manufactures `resident-render-source-stale`.
4. Past ~90 batches the long probe throws `RangeError: Invalid string length` and writes nothing. Use fewer, longer batches.
5. Scenario presets override matrix run-length env vars (`scenario.batches ?? batches`).
6. Editing `src/` during a live probe reloads the page.
7. `pgrep -f` / `pkill -f` match their own command line. Wait on the PID. Do not wrap background probes in waiters.
8. `net::ERR_CERT_VERIFIER_CHANGED` in the probe JSON `console` = the page never booted; rerun.
9. A failed-closed contact receipt used to hang `readStateLanes` (fixed; derived row stride is now 24).

## Standing feedback (exact words)
- GPU, 2026-11-17: "can you back off of the GPU a little and maybe don't use more than 50% somehow?" Reason: the user is using the GPU themselves (Chrome on Wayland). RAISED to 80% on 2026-11-17 in the Hermes session: "you can increase the budget to 80% gpu. I just don't want it to crash my window manager."
  - Claude's method: every headless GPU probe or native GPU test inside `systemd-run --user --scope -p CPUQuota=<calibrated>%`; no SIGSTOP pauses (risk Chrome's GPU watchdog and device loss); sample `nvidia-smi`; cooldown gaps; prefer CPU work; say when a number was measured under a quota.
- Host, 2026-11-16: "we really shouldn't ever be running anything on the host. I thought we already clarified that." Prompted by Claude proposing a host-side A3 regional sampler and shipping a CPU oracle (`schroederSplitSpareFreeLineagesCpu`) as a parity check.
  - Never add a CPU implementation of a kernel as oracle or reference; never make CPU parity a gate; samplers, closures and law evaluation must be GPU-resident in the step.
  - The A3 sampler was moved to the GPU (`regionalClosureSamplerGpu.js`; host version deleted).
  - Remaining host-side debt to move, not extend: the CPU free-volume oracle, the A4 host fit (`fitResponseFunction`), `runSphReactionStepCpu`.
- Headed browsers, 2026-11-15: "can you stop stealing focus while i'm trying to do work?" Scripts default headless; `ULG_HEADED=1` only when the user asks. Xvfb is not installed. If a measurement truly needs a real display (rAF pacing), ask first.
