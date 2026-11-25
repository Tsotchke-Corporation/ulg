# A1: Eshkol-derived operators for larger dt

Date: 2026-11-15. Track A1 (real time).

**User decision (2026-11-15).** Asked whether to start the Eshkol-derived
larger-dt slice, the user chose "Start, 1% error budget": build a derived
operator and accept it only inside an envelope whose measured error against
exact small-dt runs stays within 1%. Outside the envelope the lane sub-steps
exactly.

## Why dt, and what limits it today

- **Real time needs about 2,000 steps/s.** Near real time at Iron Ice's
  dt 0.5 ms means 2,000 steps/s. Today the lane runs 35–75 steps/s depending
  on the preset; a derived operator valid at 5–10 ms would cut the requirement
  to 100–200 steps/s.
- **The sound speed is tied to dt.** `sphPhaseDemo.js` caps each phase's
  sound speed at `cflSafety × L / dt` and scales the moduli by
  (c_cap / c_real)².
  - Liquids are therefore already weakly compressible: an artificial sound
    speed of a few m/s instead of water's 1,480 m/s.
  - Doubling dt halves the cap and makes the moduli 4× softer. That is why
    Iron Ice behaves differently at 1 ms.
  - So the "exact small-dt run" is itself stiffness-dependent. The fair
    reference holds the effective sound speed fixed and varies only dt
    (`cflSafety ∝ dt`).

## Harness

`scripts/a1-coarse-dt-error.mjs <scenario> <T> <dt list>`:
- **Capture.** It captures the exact particle state at the same simulated time
  in every run. The lane fingerprint at step round(T/dt) is copied in queue
  order and exported raw with `__ulgFingerprintExport`.
- **Metrics,** each coarser run against the finest: position RMS and max error
  (also relative to the motion scale, rms speed × T), centre of mass, momentum,
  kinetic energy, internal energy.
- **Fixed sound speed.** `A1DT_FIXED_CFL_AT_1MS=<cflSafety at 1 ms>` pins the
  effective sound speed across dt.

**Gate (the 1% budget).** Apply it to momentum, kinetic energy, internal
energy and centre of mass. Per-particle positions in a splashing flow diverge
from tiny perturbations, so they are reported but are not the gate.

## Baseline (water-cycle, T = 0.2 s, 608 particles, versus dt 0.25 ms)

Default cflSafety, so stiffness changes with dt:

| dt | position RMS (rel. motion) | momentum | kinetic |
| --- | --- | --- | --- |
| 0.5 ms | 18 mm (6.3%) | 0.7% | 0.1% |
| 1 ms | 41 mm (14%) | 1.8% | 0.8% |
| 2 ms | 62 mm (22%) | 3.0% | 2.4% |

**Fixed sound speed** (`A1DT_FIXED_CFL_AT_1MS=0.4`, so cflSafety ∝ dt; pure
time-integration error), versus dt 0.5 ms:

| dt | position (rel. motion) | centre of mass (rel.) | momentum | kinetic |
| --- | --- | --- | --- | --- |
| 1 ms | 25 mm (8.7%) | 5.9% | 1.0% | 0.58% |
| 2 ms (CFL number 0.8) | 47 mm (16%) | 12% | 2.1% | 1.8% |

**Reading.**
- Even at fixed physics, the explicit scheme's own time error is about 1% in
  momentum and kinetic energy per doubling of dt.
- The centre of mass of this splashing scene moves several percent.
- A dt 0.25 ms run with cflSafety 0.1 did not reach its step within 400 s;
  that is not yet diagnosed.
- **Consequence for the gate.** For a derived operator to stay within 1% of
  the fine run at 4× the dt, it must beat the explicit scheme's own time
  error, not only remove the stiffness cap. The gate is therefore set against
  the finest converged run on momentum and kinetic and internal energy.
  Centre of mass and positions are reported with each scene's
  explicit-scheme spread as their noise floor.

## Candidate operator

**A semi-implicit (linearized backward-Euler) pressure update.**
- Each particle's EOS is linearized at the current state as p(ρ + δρ) ≈ p + K/ρ · δρ.
- K = ρ ∂p/∂ρ comes from the material's EOS program, differentiated by
  Eshkol (forward-mode automatic differentiation). This is the "Eshkol-derived"
  part, and it is general for every EOS (Tait, ideal gas, solids' bulk modulus).
- The pressure correction is solved on the MLS-MPM grid with a few Jacobi
  iterations, as the contact solver already does.
- This decouples stiffness from dt: it stays stable past the acoustic CFL and
  is limited by the advective CFL (v·dt < Δx). Real moduli can then be used,
  or the current ones at larger dt.

**Envelope and fallback.**
- Envelope per node or region: the linearization residual
  |p(ρ + δρ) − linearized| / p stays below a bound; δρ/ρ is small; v·dt/Δx
  stays below the advective limit.
- Outside the envelope the lane sub-steps at the explicit dt.
- Receipts record which regions used the operator, in the style of
  `lawScopeReceipt`.

**Acceptance.** At fixed physics, the coarse-dt run with the operator stays
within 1% of the fine explicit run on the gate metrics, on water-cycle, Iron
Ice and sodium-water.

## Order

1. Harness and baselines (done for water-cycle; the fixed-sound-speed run is
   below).
2. **The Eshkol EOS-derivative path: done (2026-11-15).**
   `src/runtime/material/eshkolEosStiffness.js` builds each phase's EOS
   program (Tait γ 7 and linear gas, the same forms as the GPU's
   `packed_pressure`) and defines `(eos-stiffness rho) = rho · (derivative
   eos-pressure rho)`.
   - Eshkol's forward-mode AD samples it in the warm client VM worker (A6).
   - An A4 `fitResponseFunction` (Chebyshev, held-out residuals, strict box,
     rising sign) turns the samples into a GPU-evaluable K(ρ).
   - **Native gate** (`ULG_RUN_NATIVE_ESHKOL_EOS=1
     tests/eshkolEosStiffness.native.test.mjs`, headless): Eshkol's AD
     matches the analytic derivative to 2.2e-16 (Tait) and 0 (gas). The fit's
     residual bound is 3.8e-15, and the probes are about 1e-15. Each phase
     takes 21 samples in about 0.23 s.
   - Host tests use a JS stand-in sampler (`tests/eshkolEosStiffness.test.mjs`).
3. **Semi-implicit pressure prototype: in progress (2026-11-15).**
   GPU-native and standalone (`tests/fixtures/semiImplicitMpmPrototype.js`;
   `ULG_RUN_NATIVE_SEMI_IMPLICIT_MPM=1 tests/semiImplicitMpm.native.test.mjs`,
   headless). Setup: an MLS-MPM dam break, 11,552 particles on a 32³ grid,
   Tait EOS, c = 25 m/s fixed, T = 0.3 s, all runs against explicit at
   0.25 ms.

   | run | momentum | kinetic | centre of mass | mean J |
   | --- | --- | --- | --- | --- |
   | semi 0.25 ms | 7% | 19% | 1.3% | 1.02 |
   | explicit 1 ms | blows up | | | |
   | semi 1 ms | 12% | 16% | 2.6% | 1.26 |
   | semi 2 ms, 4 ms | blow up | | | |

   **Fixes made along the way:**
   - a consistent wide Laplacian (= central divergence · central gradient);
   - mass-weighted particle density instead of m/dx³, which exploded on the
     kernel's surface nodes;
   - a fluid-node mass threshold, with lighter nodes as ambient air.

   **Reading.**
   - The grid-node pressure operator is stable where explicit fails (1 ms).
   - It differs from explicit by about 19% even at the fine dt. That is a
     spatial inconsistency: grid-node pressure gradients versus the explicit
     scheme's particle-stress forces. It also drifts volume (J 1.26).

   **Result: consistent implicit MPM with CG (2026-11-15, later).**
   - **Formulation.** Linearize the explicit P2G particle-stress force in
     J_{n+1}: p_{n+1} ≈ p_n − θ K dt div_p(v_{n+1}), where div_p is the
     particle's APIC divergence and K is the Eshkol-derived ρ dp/dρ. The grid
     system is (I + A)v = b, with b the explicit update and
     A = (dt²/m) Dᵀ K D, symmetric positive definite in the mass inner product.
   - **Solve.** Matrix-free conjugate gradients. Each iteration is one
     particle-divergence pass, one scatter, an apply with a dot product, an
     update with a dot product, and a p-update. Dot products are workgroup
     reductions with a compare-and-swap f32 add into a scalar buffer, so there
     is no host round trip. Wall-normal components are held at b.
   - **Limit.** It binds 10 storage buffers, so it needs
     `maxStorageBuffersPerShaderStage` above the default 8.

   Dam break, all runs against explicit at 0.25 ms (c = 25 m/s fixed):

   | run | momentum | kinetic | centre of mass | mean J | GPU ms (0.3 s) |
   | --- | --- | --- | --- | --- | --- |
   | explicit 0.125 ms | 2.0% | 0.85% | 0.69% | 0.9985 | — |
   | explicit 0.5 ms | 1.95% | 0.37% | 0.75% | 0.9999 | — |
   | semi 0.25 ms | 3e-5 | 4e-5 | 6e-6 | 0.9992 | — |
   | semi 0.5 ms | 1.95% | 0.36% | 0.75% | 0.9999 | — |
   | explicit 1 ms | blows up | | | | |
   | **semi 1 ms (4×)** | 3.7% | **0.06%** | 1.5% | 1.001 | 359–759 (10 it.) |
   | **semi 2 ms (8×)** | 5.5% | **0.95%** | 2.2% | 1.003 | 182–688 |
   | semi 4 ms (16×), θ 1 | 7.5% | 2.6% | 2.9% | 1.004 | |

   **What it shows.**
   - The operator reduces exactly to explicit at the same dt (semi 0.25 ms,
     and semi 0.5 ms = explicit 0.5 ms).
   - It is stable at 4–16× the explicit stability limit, holds volume to
     0.4%, and keeps kinetic energy within 1% up to 8× dt.
   - CG converges within 10 iterations (10, 20 and 80 give identical results).
   - θ makes no difference to momentum, and θ = 0.5 blows up at 16×.
   - **Gate caveat.** On this dam break the momentum metric is not converged
     in dt even for explicit (2% between 0.125 and 0.25 ms). The momentum
     error at 4× dt (3.7%) is about twice the explicit scheme's own dt
     sensitivity, not a 1% result. A literal 1% momentum gate needs a scene
     whose momentum converges in dt (a sloshing tank or a settling column).
   - **Cost.** At 4× dt the implicit step costs about the same GPU time per
     simulated second as explicit fine-dt, but takes 4× fewer steps. In the
     app, per-step overhead dominates (about 20–25 ms wall against about
     10 ms GPU), so fewer steps is the gain.

   **Sloshing gate scene** (`SEMI_SCENE=slosh`: 8,400 particles, a thin
   tank with a tilted free surface and no splash), all runs against explicit
   at 0.25 ms. *Correction (later the same day):* this scene was flawed. The
   block filled only z ≤ 0.3, so the fluid also dam-broke along z, and the
   walls were one cell asymmetric. The physics-scored gate below supersedes
   these numbers.

   Superseded numbers:

   | run | momentum | kinetic | centre of mass |
   | --- | --- | --- | --- |
   | explicit 0.125 ms | 1.8% | 0.20% | 1.3% |
   | explicit 0.5 ms | 1.9% | 0.26% | 1.3% |
   | semi 1 ms (4×) | 3.9% | 1.05% | 2.6% |
   | semi 2 ms (8×) | 5.8% | 1.7% | 3.5% |
   | semi 4 ms (16×) | 8.6% | 2.4% | 4.5% |

   **Reading.**
   - The whole MPM step (advection, gravity, walls, APIC) is first order in
     time, explicit included: halving dt still moves momentum by about 1.8%.
   - A literal 1% momentum budget therefore needs dt ≤ about 0.15 ms for
     *any* integrator of this kind. The implicit pressure operator removes the
     stiffness (stability) limit, not the integrator's first-order time error.
   - Options: a second-order time integrator for the whole step; a gate set
     against the explicit scheme's own dt sensitivity; or the operator used
     for realistic stiffness at the current dt rather than for larger dt (the
     app now softens liquids about 1e5×).

   **User decision (2026-11-15): "Second-order stepping".** Done and
   measured. The prototype has `rk2` (SSP-RK2 / Heun: save uₙ, take two
   stages, average) and forward-Euler advection inside the stages, so each
   stage is u + dt f(u). The sloshing scene can also use equality walls.

   **Finding: the dt sensitivity is not time-integration error.**
   - At 0.5 ms, RK2 and Euler differ by only 0.04% in momentum. Halving dt
     still moves momentum by about 1.95%, with RK2 or Euler alike.
   - Equality walls change nothing.
   - The cause is MPM's per-step transfer filtering. Every P2G/G2P round trip
     smooths sub-grid velocity, so the smoothing per simulated second scales
     with 1/dt. At a fixed grid a smaller dt is not "more converged", only
     differently smoothed. RK2's average carries about one transfer per dt,
     which is why it matches Euler at the same dt.
   - **Consequence.** "1% against a finer-dt run" is not a well-posed gate for
     MPM: the reference is no closer to the true solution.

   **Proposed gate.** Score the coarse-dt run against physics, not against a
   finer dt:
   - the sloshing mode's analytic frequency, ω² = g k tanh(k h), and its
     measured decay;
   - hydrostatic pressure in a settled column (p = ρ g depth);
   - conservation receipts (mass exact; energy budget against wall work).
   The 1% budget then applies to physical observables, and the implicit
   operator is accepted where it reproduces them within 1%. Implementing
   this is the next step.

   **Physics-scored gate: built and passing** (`tests/semiImplicitMpmSloshGate.native.test.mjs`).
   - **Scene.** The first sloshing mode of a full-width rectangular tank:
     tilt 0.05, depth 0.1575 m, c = 25 m/s, 3 s.
   - **Scoring.** x(t) of the centre of mass is fitted as a damped sinusoid
     against ω² = g k tanh(k h), k = π / L.
   - **Prototype wall fix.** The zero-velocity wall nodes now sit on the
     particle clamp planes, symmetric about the grid centre. Before, the fluid
     piled into the floor clamp, and the centre of mass sank by 25% of its
     height in 3 s. Now it drops 0.0006 m, which is hydrostatic compression.

   | run (64³, 244k particles) | ω vs analytic | damping γ (1/s) |
   | --- | --- | --- |
   | explicit 0.125 ms | −0.51% | 0.236 |
   | explicit 0.25 ms | −0.24% | 0.151 |
   | semi 2 ms | −0.013% | 0.068 |
   | semi 4 ms (16×, c·dt/dx 6.4) | +0.008% | 0.053 |
   | semi 8 ms (c·dt/dx 12.8) | diverges, with 10 or 30 CG iterations | |

   - **32³ grid, 29k particles.** All runs from explicit 0.125 ms to semi 8 ms
     (c·dt/dx 6.4) are within 0.8% of the analytic frequency. Semi 8 ms is
     −0.16%, with γ 0.062. Explicit 0.125 ms has γ 0.55.
   - **CG iterations.** 10 and 30 give the same answer at 4 ms on both grids.

   **Reading.**
   - The implicit operator meets the 1% budget on the physical observable
     (the mode frequency) through **c·dt/dx ≤ 6.4**, on both grids.
   - Its numerical damping is 3–9× lower than the explicit scheme's.
     Numerical damping scales with the number of transfers, so coarser dt is
     *closer* to water's real damping, about 0.01/s.
   - At c·dt/dx = 12.8 it diverges, independent of CG iterations, so that is
     a stability limit and not under-convergence.
   - **Envelope rule.** Accept the operator for c·dt/dx ≤ 6.4. Outside that,
     sub-step exactly.
   - **What the gain buys.** About 13–16× dt over the explicit limit
     (c·dt/dx about 0.4) at the same sound speed. Equivalently, a liquid
     13–16× stiffer at the same dt.

   **Canonical route, behind a flag: wired (2026-11-15).**
   - `src/runtime/sph/sphImplicitPressureGpu.js` is the solver. It encodes
     matrix-free CG (10 iterations, θ = 1) on the Tier-0 fused sequence,
     between grid update and G2P (`sphMlsMpmGpuStep.js`, Tier-0 substep
     loop), and rewrites `updated_grid_nodes` velocities in place.
   - **Stiffness K.** K = ρ dp/dρ of the same packed Tait EOS that P2G uses:
     rest density from thermo row 0 `.w`, scaled c from mechanics row 6 `.y`,
     and the same cavitation floor. Solids, gas and invalid volumes
     contribute nothing. Eshkol AD reproduces this closed form to 2e-16.
   - **Walls.** The normal components in the grid-update wall-barrier bands
     are Dirichlet, so the barrier stays authoritative.
   - **Liquid stiffness cap.** `phaseSoundSpeedScaleFor` takes
     `liquidCflMaxSoundSpeedMPerS`, which raises only liquid bulk stiffness
     to `implicitCfl · dx / dt`. It is clamped to the measured 6.4 envelope.
     It is threaded through the particle rows, the mechanics material table
     and hydrostatic initialization. The reaction-table product rows are not
     threaded: reaction scenes do not run Tier-0.
   - **URL knobs.** `implicitPressure=1`, `implicitCfl` (default 4) and
     `implicitIters` (default 10).
   - **Receipt.** The result carries `implicitPressure` (null when off), and
     the worker sets the `__ulgImplicitPressure` tap. The probe reads both.
   - **Flag off** encodes nothing, and the liquid cap is 0, so the per-phase
     scale is unchanged.
   - **Determinism.** The scatter uses f32 compare-and-swap, so flag-on runs
     are not bit-reproducible.

   **Gates.**
   - Host test `tests/sphImplicitPressureGpu.test.mjs` (5 pass).
   - Native test `tests/sphImplicitPressureGpu.native.test.mjs` passes. The
     WGSL compiles (the check caught the reserved word `meta`). A uniform flow
     is a fixed point to 3e-6, and compression drops from 3.0 to 0.13 at
     c·dt/dx 4.

   **Live, water-realtime (36,864 particles, headless, 40 s windows).**

   | run | steps/s | sim-s per wall-s |
   | --- | --- | --- |
   | off, 1 ms | 111.8 | 0.112 |
   | on, 1 ms (liquid 10× stiffer, c·dt/dx 4) | 60.6 | 0.061 |
   | on, 4 ms | 68.2 | **0.273 (2.4×)** |

   No GPU errors and no rollbacks. The solve costs about 45% of the step at
   10 iterations.

   **Harness fix.** The lane fingerprint never fired on Tier-0: the Tier-0
   adoption did not call the hook, and the hook counted adoptions, not
   steps. It now counts the steps of each fused sequence and records a
   target inside a sequence as `missed`. Choose T so that T/dt is a multiple
   of 64 for every dt.

   **Dam-break sanity at a fixed sound speed** (`scripts/a1-coarse-dt-error.mjs`,
   with `A1DT_RUNS` per-run queries; T = 1.024 s, so T/dt is a multiple of
   64).
   - **CG iterations, not the velocity cap, decide the 4 ms result.** At
     c·dt/dx 4 with 10 iterations the dam break lags: centre of mass 2.9%,
     kinetic energy −31%. With 20, 40 or 60 iterations all runs agree.
   - **Iteration rule.** The default is now max(10, ⌈5·c·dt/dx⌉), so 20 at
     c·dt/dx 4. At c·dt/dx 2, 10 iterations equal 20.
   - **Jacobi preconditioning** slowed the convergence of the bulk motion
     (10 iterations: centre of mass 18% of motion off, against 3.9% without),
     so it is opt-in (`implicitPrecond=1`).
   - **The explicit scheme has the same per-step drift.** At a fixed c its
     own kinetic energy moves −5.2% at 0.2 ms and +6.6% at 0.8 ms relative to
     0.4 ms, and positions move 3–4% per dt doubling. This is the same
     transfer-dissipation effect the sloshing gate showed.

   | at c = 500·dx, against explicit 0.8 ms | positions | centre of mass | momentum | KE |
   | --- | --- | --- | --- | --- |
   | explicit 0.4 ms (½ dt) | 2.9% | 0.01% | 0.6% | −4.3% |
   | implicit 4 ms (5×) | 3.6% | 0.06% | 2.1% | +7.9% |
   | implicit 8 ms (10×) | 5.6% | 0.6% | 3.8% | −13.9% |

   **Cost.**
   - **Fusion.** Fusing the particle gather and scatter, and folding the
     accumulator clears into the reads, cut the dispatches from 145 to 104
     at 20 iterations.
   - **Reductions.** The CG dot products were the cost: every node workgroup
     did a compare-and-swap on one scalar. A two-stage reduction (one partial
     per workgroup, then a fixed-order 256-thread sum) halved the step time,
     and the CG scalars are now deterministic. Only the f32 scatter sums
     still vary run to run.

   | water-realtime, 20 iterations | steps/s | sim-s per wall-s |
   | --- | --- | --- |
   | off, 1 ms (baseline) | 111.8 | 0.112 |
   | on, 4 ms | 67.4 | 0.27 (2.4×) |
   | on, 8 ms | 67.4 | **0.54 (4.8×)** |

   **Where the step went** (pass census on Tier-0; residentGpuTimestampProfile=1
   moves water-realtime off Tier-0, so the census hook is now installed on
   Tier-0 directly).
   - `ip_particle_apply` was 85% of GPU time, at 0.36 ms × 21 per step. The
     whole explicit step is only 0.5 ms of GPU per step.
   - **f32 CAS → deterministic fixed point.** A single 31-bit global scale
     failed: low-mass surface nodes make max |p| large, so the bulk quantized
     away (compression ended at 0.187 instead of 0.1295, and one node moved
     43 m/s). Now each component keeps positive and negative 64-bit magnitudes
     (u32 lo/hi, carry on lo), with the scale from GPU-reduced max(K V θ) and
     max |source|. The pass takes 0.225 ms, and **flag-on steps are now
     bit-reproducible**, which the native test asserts. A timing hack that
     suggested 45× faster integer atomics was an artefact: values that
     quantized to 0 made the adds nearly free.
   - **The wall was presentation QoS, not the GPU.** Tier-0 submits 2
     substeps per presented frame
     (`ULG_WORKER_TIER0_PRESENTATION_QOS_MAX_SUBSTEPS_PER_SUBMISSION`), and
     each boundary is a blocking round trip, so flag-off was capped at about
     112 steps/s with the GPU 6% busy.

   **Real-time pacing** (`realtimePacing=1`, threaded mount → scene →
   control plane → worker as `tier0RealtimePacing`). Each schedule sizes the
   chunk as k = ⌈measured frame period / dt⌉, floored at the shared 2 and
   capped at 32, so simulated time per frame covers wall time: a fixed
   timestep with a variable number of steps per frame. It is off by default.

   | water-realtime (36,864 particles, headless) | steps/s | sim-s per wall-s | display |
   | --- | --- | --- | --- |
   | default (explicit, 1 ms, 2 per frame) | 112 | 0.11 | about 56 fps |
   | explicit 1 ms, pacing, 512 steps/schedule | 645 | 0.65 | 60 fps |
   | implicit 8 ms, default pacing | 67 | 0.54 | about 33 fps |
   | **implicit 8 ms, pacing, 256 steps/schedule** | **127** | **1.02** | about 19 fps (k = 7) |

   - **Real time on a canonical preset.** The liquid there has c = 500·dx,
     slightly stiffer than the default explicit 1 ms run (400·dx).
   - **Remaining.** The display falls to about 19 fps at real time, because
     each boundary is a blocking round trip of about one frame. Pipelining the
     presentation boundary would recover it. At 8 ms, 20 CG iterations is
     about 10% short of the 40-iteration kinetic energy.
   - **User decision (2026-11-15): "Default for water-realtime".** The
     preset now sets `sdt 0.008`, `implicitPressure 1`, `realtimePacing 1`
     and `residentStepsPerSchedule 256`; other presets are unchanged. With
     no URL flags it measures 1.04 sim-s/wall-s. Serial pacing then crept to
     k = 16 (8 fps), because k = ⌈period / dt⌉ chases a period that grows
     with k whenever per-step GPU cost is close to dt.
   - **Pipelined boundaries** (`pipelinePresentationBoundaries`, on under
     real-time pacing). At most one boundary is outstanding while the next
     chunk is encoded and submitted. Boundaries are still called in order,
     and the last settles before the terminal work. The frame's draw is an
     extrapolated temporal frame submitted at the boundary's start.
   - **Measured with no URL flags:** **1.11 sim-s/wall-s at k = 3, a 22.8 ms
     frame period (about 44 fps)**, against 1.07 at 20 fps serial.
   - **The live K is now Eshkol-derived (2026-11-15).**
     - `scripts/derive-eshkol-eos-stiffness-table.mjs` runs Eshkol AD of the
       packed Tait EOS in the client warm VM, then the A4 Chebyshev fit of
       K / (ρ0 c²) over x = ρ/ρ0 ∈ [0.9, 1.1]. The held-out residual is
       2.8e-15 and the AD cross-check 2.4e-16.
     - It writes `src/runtime/material/eshkolEosStiffnessTable.js`. The GPU
       solve evaluates the table by Clenshaw from the params uniform, and
       the receipt reads `stiffnessSource: eshkol-derived-chebyshev-v1`.
     - The closed form remains as the out-of-domain fallback and the A/B
       arm.
     - `tests/eshkolEosStiffnessTable.native.test.mjs` re-derives the table
       and checks the cache to 1e-12. The native solver test shows the table
       and the closed form agree on the GPU to 1e-4.
     - water-realtime then measured 1.14 sim-s/wall-s with an 18 ms frame
       period (about 55 fps).
     - A new liquid EOS now needs only its Eshkol definition and a table
       regeneration.
   - **Operating point c·dt/dx 3 (2026-11-15).**
     - At 8 ms, c·dt/dx 4 needs about 40 CG iterations (20 leave KE −9.9%
       and positions 3.9% against 60).
     - c·dt/dx 3 converges by 15 (KE 0.26%, positions 0.8%), exactly the
       rule max(10, 5·cfl).
     - A GPU-side early stop on the relative residual (`implicitTol`) did
       not track the observables (tolerance 0.01 left KE −27%), so fixed
       counts stay.
     - The default liquid c·dt/dx is now 3, and water-realtime sets
       `implicitCfl 3`. That gives c = 375·dx, 94% of the explicit 1 ms
       default's 400·dx.
   - **At c = 375·dx, against explicit 1 ms:**

     | run | positions | centre of mass | momentum | KE |
     | --- | --- | --- | --- | --- |
     | explicit 0.5 ms (½ dt) | 2.7% | 0.02% | 0.8% | −4.4% |
     | implicit 8 ms (8×, 15 iterations) | 3.8% | 0.22% | 1.2% | +5.0% |

   - **Live, no URL flags: 1.29 sim-s/wall-s at 16.7 ms frames (60 fps),
     k = 3.**
   - **Boundary proof failures (fail-open) are pre-existing.** There are 106
     pipelined against 109 serial over 30 s: 63 "presentation unavailable",
     then horizon exhausted, deadline missed and not submitted. They are not
     introduced by pipelining. The "unavailable" count is exactly 63 in every
     run, so it looks like a fixed startup window (the first schedule before
     the temporal presentation is armed), not steady-state loss; open. Then the canonical
   route, behind a flag: the CG passes in the grid-update sequence, K from
   the Eshkol-derived response, and the sound-speed cap lifted to the
   implicit-stable value.
   The earlier note follows:
   **(superseded) Next: implicit MPM in the explicit scheme's own discretization.**
   - Linearize the P2G particle-stress force in J_{n+1} = J_n(1 + dt tr C_{n+1}).
   - Solve over grid velocities matrix-free: each iteration is one
     G2P-divergence pass and one P2G-force pass, by Jacobi or CG.
   - Semi-implicit then reduces exactly to explicit as dt → 0. That is
     required before the 1% gate can be met at larger dt.
4. The pass on the canonical route, behind a flag, default off, only after
   the prototype meets the gate.
4. Measure against the gate; widen the envelope only with evidence.

## Iron Ice (canonical route): where the wall time goes (2026-11-15)

- **Plain headless Iron Ice runs about 19 steps/s at dt 0.5 ms, 0.0095 sim-s/s**
  (seven runs, 16.6–20.4). The lane trace (`S0_LANE_TRACE=1`, with the ring
  widened by `__ulgLaneTraceCapacity`) puts 48% of wall time in
  `schedule-terminal-fence` (about 800 ms per 16-step schedule).
  - The GPU sits at 77% utilization and full clocks (nvidia-smi, P0).
  - Longer schedules (64 steps) do not help.
  - Ruled out: the contact apply's presentation-slot wait
    (`waitForPendingSlot`, made non-blocking: no change) and a device tick
    pump (no change).
- **The pass census made it about 2.5× faster** (42–49 steps/s), so earlier
  "48 steps/s headless" figures were likely census-regime numbers.
- **Bisection of the census:**

  | variant | steps/s |
  | --- | --- |
  | timestamps only | 19.4 |
  | wrapping only | 19.3 |
  | copy, no map | 20.4 |
  | map, no copy | 18.3 |
  | per-submit `onSubmittedWorkDone` | 19.3 |
  | separate per-submit copy + map | 17.8 |
  | **copy inside each command buffer + map of its destination** | **57.6** |

- **Lean version.** `src/runtime/sph/sphSubmitCompletionReadback.js` adds a
  4-byte copy per command buffer into a pooled MAP_READ buffer, mapped after
  submit. It touches no app data. It is armed only by the diagnostic worker
  global `__ulgSubmitCompletionReadback`. Results:
  - Iron Ice: 52.3 steps/s (2.7×).
  - sodium-water: 56.9 steps/s, against 48.5 plain.
  - water-realtime: 1.32 sim-s/s, against 1.29.
- **The mechanism is below the app** (GPU-process scheduling of
  command-buffer completion).
- **Headed check.** The user asked for one in a regular browser session, with
  "make it the default if it is still faster with persistent visual updates".
  Run in Wayland Chrome with `S0_FRAME_SAMPLE=1` (a page screenshot every
  250 ms):

  | headed | without | with |
  | --- | --- | --- |
  | Iron Ice | 18.7 steps/s, 63 of 63 frames distinct | **40.6 steps/s (2.2×)**, 98 of 98 distinct |
  | water-realtime | 1.27 sim-s/s, 85 of 85 | 1.25 sim-s/s (neutral), 89 of 89 |

  The longest static stretch was 0 ms in every run.
- **Now the default** in the resident worker. Opt out with
  `completionReadback=0`, threaded mount → scene → control plane → worker
  as `submitCompletionReadback`. Arming never throws: it reports
  `unavailable` on mock devices or when WebGPU constants are missing.
- Headless, with no flags: Iron Ice 50.95 steps/s; opt-out 19.8.
- **Remaining Iron Ice levers.**
  - dt. Solids' elasticity is explicit: ice collapses at 1 ms, and the
    implicit pressure covers liquids on Tier-0 only.
  - Per-schedule terminal fence latency.


## CORRECTION (2026-11-16): the completion readback "speedup" was dropped work

- **What happened.** The per-command-buffer copy + map (and the pass census)
  were installed above the worker queue submit burst. They mapped buffers of
  held command buffers before the burst's real submit. The flush failed
  validation ("used in submit while mapped"), and 1,151 of 1,152 Iron Ice
  steps rolled back (`observeSpatialAuthority=1`).
- **Why the headed check missed it.** The "persistent visual updates" check
  could not see it, because presentation extrapolates motion.
- **Correct arrangement.** Hooked below the burst, the readback gives no
  speedup (19.1 steps/s).
- **Actions.**
  - The feature was removed: module, URL knob and default.
  - The pass census now maps through
    `wrapWorkerQueueRealSubmit(device, wrap)`. A verified census run had 0
    rollbacks in 543 steps, at 17.7 steps/s.
- **The true Iron Ice rate** is about 19 steps/s at 0.5 ms (0.0095 sim-s/s),
  about 105× from real time.
- **Water-realtime results are unaffected.** They were measured without the
  census, and no run showed GPU errors.
