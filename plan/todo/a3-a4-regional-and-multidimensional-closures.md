# A3 regional sampling and A4 multidimensional response functions

> **2026-11-22 Live-Code Status (`23a961c4`):** **OPEN** (`0` formal oracle
> receipts for A3 or A4). `sphImplicitPressureGpu.js` closes the A3 GPU loop
> only when `implicitPressure=1` (OFF on all standard presets);
> `sphThermalRegionalClosureGpu.js` runs on schedule boundaries by default **but
> has ZERO live GPU law consumers** (`getSphThermalRegionalClosureLane` never
> called in `src/`, tables never bound to any shader); all A4 fitting
> (`fitResponseFunction`, `gasResponseFunctions`, `eshkolEosStiffness`,
> `eshkolTriadClosures`) still executes **100% on CPU JS**; and
> `eshkolHigherOrderLawCompiler.js` is not wired into live SPH steps. See
> [`plan/CURRENT-PLAN.md`](../CURRENT-PLAN.md).

Date: 2026-11-14. Tracks A3 and A4. These build on G6 (`localClosureFitCache.js`)
and G4 (homogeneity as a span test).

## A4: `fitResponseFunction` and `evaluateResponseFunction` (localClosureFitCache.js)

**Generator.** It declares:
- its axes (`{ name, unit }`) and output unit;
- a source fingerprint;
- `evaluate(xs)`;
- `regimeOf(xs)`, a phase or domain label.

**Fit.** Tensor Chebyshev over a validity box (per-axis degrees):
- **Regimes.** A box that spans regimes is refused, so a fit never crosses a
  phase or domain transition.
- **Residuals.** Held-out interior and boundary (face) residuals are
  measured separately. The bound is the held-out maximum × a safety factor,
  labelled empirical.
- **Physical order.** Declared signs of the partial derivatives are enforced
  on the held-out points; a violating fit is refused.
- **Tolerance.** A fit over its relative tolerance is refused.

**Evaluation is strict.** It refuses out-of-box points, other regimes, and a
stale source fingerprint.

**Tests:** `tests/responseFunctionFit.test.mjs`, 3 of 3.
- **N2 ideal-gas density** ρ(T, P) = P·M/(R·T), from first principles, with
  M from the material bank.
  - Box: T 300–1000 K, P 50–200 kPa; degrees [14, 1].
  - Held-out relative residual: 1.9e-8 on both interior and boundary points.
  - On 500 fresh points the bound holds, and ∂ρ/∂T < 0 and ∂ρ/∂P > 0.
- **Refusals:** a box crossing H2O melting; a wrong declared sign; a degree-2
  fit.
- **Strict evaluation:** out-of-domain points and a stale source are refused.

## A3: `src/runtime/material/regionalClosureSamplerGpu.js` (GPU-resident)

Moved to the GPU on 2026-11-16 (user: "move the A3 sampler to the gpu too";
"we really shouldn't ever be running anything on the host"). The host-side
`regionalClosureSampler.js` and its host test are deleted. The host now only
builds pipelines, writes the control uniform and reads fixed-size evidence.

The law is a consumer-supplied WGSL generator: `a3_generator(x) -> f32` and
`a3_regime(x) -> u32`. Members are `vec4(x0, x1, x2, region id bits)`.

Passes per evaluation:
1. **Envelope** (per member): min and max per axis via order-preserving u32
   atomics, plus the member count, the regime range and a non-finite flag.
2. **Plan** (per region):
   - empty;
   - direct-heterogeneous (span over the per-axis tolerance, mixed regime or
     non-finite);
   - lookup, if a fit is already accepted;
   - otherwise fit-now over the envelope expanded by `margin`.
3. **Fit** (one workgroup per region):
   - tensor Chebyshev on first-kind nodes in workgroup memory, up to 256
     terms;
   - a held-out interior lattice and every box face; the bound is the
     maximum relative residual × the safety factor;
   - the fit is refused on a regime crossing, a non-finite sample or a bound
     over `relativeTolerance`.
   Accepted fits are written in the A4 response-function table layout (one
   record per region), so lookups use `rf_eval`.
4. **Lookup** (per member):
   - a bounded `rf_eval`;
   - out-of-box or other-regime members are evaluated directly and counted
     as debt (never extrapolated);
   - heterogeneous and refused regions are evaluated directly.
5. **Async expansion.** A fitted region with debt and nothing pending gets
   one pending fit over the union of its accepted box and its envelope. A
   separate schedule-boundary pass adopts it. Strict policy queues nothing.
6. **Verify** (GPU self-check). Every member is compared with a direct
   evaluation against its bound plus a 2-ulp f32 slack. It produces a
   violation count and the maximum relative error.

The decision log is now fixed-size evidence: per-region state (accepted,
pending, action, regime, debt) and global counters (exact evaluations,
lookups, fits, refused fits, direct regions, debt, adoptions). Determinism
holds because every fit output is one thread's fixed-order sum and every
maximum is an order-independent atomic.

**Test:** `tests/regionalClosureSamplerGpu.native.test.mjs`
(`ULG_RUN_NATIVE_A3_GPU=1`), the three host cases ported:
- **Bounded lookups.** Two homogeneous regions of 400 members and one
  heterogeneous region of 50. There are 800 lookups and no verify
  violations. The cost is exactly 160 exact evaluations (2 × (10 nodes + 45
  held-out) + 50 direct) against 850.
- **Envelope exit.** A 1.6 K warming gives 100 debt and one pending fit.
  - The same schedule still debts and does not refit.
  - The boundary adopts the pending fit.
  - After it, there is 0 debt and 100 lookups.
- **Strict.** No adoption, and the debt stays. Replay is bit-identical
  (counters, region state, table records).

f32 note: the GPU fit is f32, so `relativeTolerance` defaults to 1e-5. The
host's f64 fits used 1e-6.

## A4 resident GPU evaluator (2026-11-15)

- **`src/runtime/material/responseFunctionGpu.js`** packs any 1–3-axis
  `fitResponseFunction` result into one f32 storage table: a header, 16-float
  records (axes, coefficient offset, terms per axis, box, residual bound) and
  the coefficients in the host's row-major tensor layout.
- **`responseFunctionGpuWgsl()`** provides `rf_eval(index, x) -> (value, ok)`,
  a Chebyshev recurrence over the tensor sum.
- **Strict.** Out of box returns ok = 0, never an extrapolated value.
  Source-fingerprint and regime checks stay host-side, at table adoption.
- **Tests.**
  - `tests/responseFunctionGpu.test.mjs` covers layout and refusals (2 of 2).
  - `tests/responseFunctionGpu.native.test.mjs` compares GPU against the
    host's `evaluateResponseFunction` on 300 points per function. Maximum
    relative error: 6.0e-7 for the 1-D Eshkol Tait stiffness, 4.5e-7 for the
    2-D N2 ρ(T, P), 6.7e-7 for the 3-D synthetic. Every ok flag matches, and
    the three out-of-box probes are refused.
- **First live consumer.** The semi-implicit pressure solve
  (`sphImplicitPressureGpu.js`) now evaluates its stiffness K / (ρ0 c²) from
  this table: function 0, the Eshkol-derived Tait response, bound at storage
  binding 12. It runs in every water-realtime step, at 1.30 sim-s/wall-s and
  60 fps. The closed form stands only where the strict lookup refuses.

## Limits

- **A3 is GPU-resident.** SS-mounted regional consumers remain: G4's cells
  as regions, fitted and looked up inside the step.
- **A4.** The resident evaluator exists, with one live consumer.
- A4's domains so far are 2-D first-principles gas and caloric responses.
  Broader compound and property families need their own generators.
