# ULG Carrier Runtime — Implementation Plan

**Author:** Claude (Opus 4.8)
**Date:** 2026-06-08
**Companion to:** `plan/claude-audit.md` (gap analysis), `plan/ULG_Triad_v0.5_Pretty_Diagrams.pdf` (spec)
**Goal:** Close the "headline gap" — stand up the **ULG carrier runtime** that *consumes a
validated closure and runs a simulation*, satisfying Spec §2.4, Layer D (§3.4.4), Conformance
tests #1 and #8, and Demos B and C.

---

## 0. Read this first — scope decision vs. the dev log

The dev log (`plan/log.md`) records **repeated** directives that work should *not pivot from the
"core technology" to support an "SPH demo,"* and that the simulation should be treated as a
"downstream evidence slice rather than the core objective" (entries 2026-06-06 17:05, 17:45, 18:16,
18:57). In that vocabulary, **"core technology" = the Eshkol→PeerCompute→MoonLab closure /
production-dispatch boundary**, and **"SPH demo" = the carrier simulation this plan builds.**

So this plan is the work that was previously deprioritized. Pursuing it now is a deliberate
reversal of that steer. The v0.5 spec, by contrast, treats the carrier runtime as ULG's reason to
exist (§2.4). Both views are defensible; the point is the choice should be explicit.

**This plan is written to respect the prior constraint even while building the runtime:**

- It is **additive** — no changes to the magnetar-closure boundary, staging, or handoff code.
- It is **CPU-reference-first and minimal** — a toy two-particle oscillator, not a physics engine.
- It **reuses** the existing ABI, `ArtifactCache`, `GpuBroker`, and `WorkerSupervisor`.
- It keeps the **same non-overclaim discipline**: simulation outputs are explicitly `toy` /
  `reference`, never `scientificValidation: true` / `fullPhysics: true`.

If the intent is still to keep the simulation as an evidence slice only, stop after **Phase 1**
(the minimal vertical slice) — that alone flips Conformance #1/#8 and §4.15 to ✅ without touching
the core boundary work.

---

## 1. Target (spec acceptance this plan satisfies)

| Spec target | Closed by |
|---|---|
| Conformance #1 — register Eshkol, MoonLab, **ULG** services | Phase 1 (`ulg-runtime` manifest) |
| Conformance #8 — use a cached closure in a ULG **WebGPU** kernel | Phase 2 (CPU ref in Phase 1) |
| Demo B — MoonLab energy → Eshkol closure → ULG two-particle oscillator → NetViz provenance | Phase 1 |
| Demo C — EOS table → ULG carrier collapse toy → closure invalidation + refresh | Phase 3 |
| §2.4 capability list (carrier, spatial hash, edge messages, SPH observers, interpolation, invariants, compact deltas) | Phases 1 + 3 |
| §3.6.5 `ClosureRegistry` (resolve/store/invalidate) + validity invalidation (M0.8) | Phase 1 |
| Design rule #5 — CPU/WASM is the reference path; WebGPU only with tolerance + parity | Phases 1 + 2 |
| §3.10.3 cold layer (IndexedDB) | Phase 4 |

---

## 2. What already exists to build on (reuse, don't rebuild)

- **ABI** (`ulg-gpu-abi/src/index.js`): `D_TYPES` (incl. `complex64`), `createTensorDescriptor`,
  `createClosureTableDescriptor` (axes/outputs/layout/interpolation/validity), `createToleranceReport`,
  `createProvenanceBlock`, `stableStringify`.
- **WGSL** (`ulg-gpu-abi/src/wgsl.js`): `commonWgsl` with a `TensorDescriptor` struct +
  `complex64_mul`/`complex64_norm2`. Extend, don't replace.
- **`GpuBroker`** (`src/runtime/GpuBroker.js`): probe + lease + release + pressure, with CPU
  fallback. **Has no kernel dispatch and no device-lost handling — both added here.**
- **`ArtifactCache`** (`src/runtime/ArtifactCache.js`): content-addressed (`sha256:`), summaries.
  Closure registry wraps it.
- **`WorkerSupervisor`** (`src/runtime/WorkerSupervisor.js`): spawn/submit/cancelTree/telemetry.
  The ULG runtime registers + runs as a supervised root task here.
- **`ClosureArtifact` schema**: already models `execution.mode ∈ {wasm-reference, wgsl-kernel,
  table-interpolation, hybrid}`, `table`/`wgslModule`/`wasmRef`, and a `validity` envelope. The
  closure already tells the runtime how to execute and when it is in range.

---

## 3. Phase 0 — Decisions to lock first

1. **Reference backend first.** Build CPU/JS reference (rule #5), treat WebGPU as the accelerated
   path validated against it. *Recommended.*
2. **Closure execution mode for the first slice = `table-interpolation`.** Simplest: sample a 1-D
   table for `E(r)` and obtain `dE/dr` (table-provided or central finite difference). Defer
   `wgsl-kernel` / `hybrid` closures.
3. **Demo B closure source.** Start from a **staged fixture** energy table (decoupled, deterministic
   tests); wire to a live MoonLab `QuantumResponseArtifact.outputs.forceSamples/energyLevels` after
   the slice works. Avoids coupling the first slice to MoonLab availability.
4. **ULG runtime shape = supervised service worker** (`serviceId: "ulg-runtime"`), not a first-party
   in-supervisor object — so Conformance #1/#2 (register + spawn under supervisor) are literally met
   and cancellation flows through `cancelTree`.

---

## 4. Phase 1 — Minimal vertical slice (Demo B + Conformance #1/#8-CPU + ClosureRegistry)

This is the critical path. Each item is a new file unless noted.

### 4.1 `src/runtime/ClosureRegistry.js`
Wraps `ArtifactCache`; adds resolution-by-query and validity-driven invalidation (also Milestone
0.8's missing piece).

```js
export class ClosureRegistry {
  constructor({ artifactCache }) {}

  // validate against closure schema, index by {closureKind, inputHash, methodHash}, store body
  async store(closureArtifact) { /* -> ArtifactRef */ }

  // returns { ref, closure, validity: 'in-range' | 'out-of-range' | 'miss' }
  async resolve({ closureKind, inputHash, methodHash, point }) {}

  // checks point against closure.validity envelope axis ranges
  isWithinValidity(closure, point) { /* -> boolean */ }

  // mark a stored closure invalid; emit 'closure-invalidated' for NetViz + re-derivation
  async invalidate({ ref, reason }) {}

  subscribe(listener) {} // hits/misses/invalidations for telemetry
}
```

### 4.2 `src/runtime/closureHandle.js`
Turns a `ClosureArtifact` into a runtime-callable sampler.

```js
// mode 'table-interpolation': load table samples, linear interp, derivative (table or finite-diff)
export function createClosureHandle(closureArtifact) {
  return {
    mode,                       // 'table-interpolation' for the slice
    sample(coords) {            // coords e.g. { r }
      return { value, derivatives }; // { E, dEdr }
    },
    validity,                   // envelope for in-range checks
  };
}
```

### 4.3 `src/runtime/carrierRuntime.js` (CPU reference)
The integrator. Demo B = two-particle oscillator; force = `-dE/dr` from the closure handle.

```js
export function createCarrierRuntime({ closureHandle, dt, integrator = 'velocity-verlet' }) {
  return {
    init(state) {},                       // positions/velocities of 2 bodies (hot-layer tensors)
    step(state) {                         // one integration step
      // r = |x1 - x0|; { dEdr } = closureHandle.sample({ r }); F = -dEdr * unit(x1-x0)
      return { state: next, delta };      // compact delta (warm layer), not full state
    },
    run(state, steps) { return { deltas, invariants }; },
  };
}
```

### 4.4 `src/runtime/invariants.js`
Energy/momentum reduction → drives `ValidationReport` / `ToleranceReport` (schemas already exist).

```js
export function computeInvariants(state, closureHandle) { /* { energy, momentum } */ }
export function invariantDriftReport(series, toleranceProfile) { /* ToleranceReport */ }
```

### 4.5 ABI: register the ULG runtime service
In `ulg-gpu-abi/src/serviceContract.js` (additive — does not touch eshkol/moonlab entries):
- `ULG_SERVICE_IDS.ulgRuntime = 'ulg-runtime'`
- `ULG_TASK_KINDS.simulationStep = 'simulation.step'` (+ `closure.consume` if useful)
- capabilities `['ulg.simulation.step', 'ulg.closure.consume']`, a `SERVICE_CONTRACTS['ulg-runtime']`
  entry, and `outputArtifactKind: 'simulation-delta'`.

### 4.6 `src/services/ulgRuntime.worker.js`
Supervised ULG runtime service worker:
- on `submit-task` (`simulation.step`): resolve the cited closure ref from the cache, build a
  closure handle, run `carrierRuntime` for N steps, request an **optional** GPU lease (Phase 1 uses
  CPU), emit a simulation artifact + heartbeat + cancel handling (mirror `dummyService.worker.js`).

### 4.7 Simulation artifact + schema
New `ulg-gpu-abi/src/schemas/simulation_artifact.schema.json` and a builder. Shape:
```
{
  artifactId, sourceService: 'ulg-runtime', taskKind: 'simulation.step',
  closureRef,                       // content-addressed closure consumed
  representation: 'carrier-toy',
  outputs: { deltas: [...], invariants: {...}, finalState? },
  execution: { backend: 'cpu-reference' | 'webgpu', dt, steps, integrator },
  validity, uncertainty, validation,   // toleranceProfile, status
  provenance                           // parents: closureRef + MoonLab/Eshkol ancestors
}
```
Keep `scientificValidation:false` / `fullPhysics:false` — this is a toy reference.

### 4.8 Demo B wiring (`demoRuntime.js` + `src/main.js`)
- Register `ulg-runtime`; add `runOscillatorDemo()` that: loads/derives a closure table (staged
  fixture in Phase 1), `closureRegistry.store(...)`, submits a `simulation.step` task, renders the
  trajectory + provenance chain (closure → MoonLab/Eshkol) in the telemetry pane.
- Add a "Run Oscillator" control next to "Run Smoke".

### 4.9 Tests
- `tests/closureRegistry.test.mjs` — store/resolve hit, miss, in-range vs out-of-range, invalidate.
- `tests/carrierRuntime.test.mjs` — deterministic step; **energy conserved within tolerance** over
  N steps; momentum conserved; compact-delta shape.
- e2e: Demo B renders trajectory and exposes `window.__ulgDemo.runOscillatorDemo()` result with a
  provenance chain back to the closure.

**Phase 1 exit:** Conformance #1 + #8 (CPU) + §4.15 two-demo bar all flip to ✅; `ClosureRegistry`
closes the M0.8 gap. No core-boundary files touched.

---

## 5. Phase 2 — WebGPU execution path (literal Conformance #8)

- `src/runtime/webgpuCarrierKernel.js` — under a `GpuBroker` lease: `createShaderModule` →
  `createComputePipeline` → bind groups (closure table as a storage buffer, state buffers) →
  `dispatchWorkgroups`. **None of these calls exist in the repo today.**
- Extend `ulg-gpu-abi/src/wgsl.js` with a carrier-step WGSL kernel + a closure-table sampling
  function (reuse the `TensorDescriptor` struct).
- **Parity:** run the same integrator on GPU and CPU; emit a `ToleranceReport` (abs/rel/parity).
  Accept GPU result only if within tolerance, else fall back to CPU and mark the artifact.
- **Device-lost:** add a `device-lost` handler in `GpuBroker` → invalidate lease → mark running
  tasks retryable → retry on CPU/quarantine (closes the M0.8 device-lost gap; satisfies §2.14).
- Tests: CPU/GPU parity within tolerance (skips cleanly when `navigator.gpu` is unavailable, as the
  log notes it is in this runtime); device-lost simulated → task retried, no untracked allocations.

---

## 6. Phase 3 — Full carrier passes (§2.4) + Demo C

Only after the slice runs end to end. Each is a hot-layer pass over fields, emitting compact deltas:

- `src/runtime/spatialHash.js` — neighborhood construction.
- `src/runtime/edgeMessages.js` — edge-message evaluation.
- `src/runtime/observers.js` — SPH-like smoothing observers.
- closure **field** interpolation (sample the closure over fields, not just a scalar `r`).
- invariant/reduction passes over fields → validation.
- **Demo C** (`src/main.js` + runtime): Eshkol EOS table → carrier collapse toy → when state leaves
  the closure's sampled range, `ClosureRegistry.invalidate(...)` fires → re-derive/refresh closure →
  continue. Exercises the invalidation path end to end.

---

## 7. Phase 4 — Persistence + NetViz (rounds out M0.8 / M1.3)

- IndexedDB cold-layer backend behind `ArtifactCache`/`ClosureRegistry` (cached closure tables,
  WASM, WGSL modules, snapshots).
- NetViz panels: closure-cache hits/misses, physics-residual overlay, validation/provenance. Much
  of the data already exists in `artifactSummary.js`; this is surfacing, not new computation.

---

## 8. File-level summary

**New (Phase 1):** `src/runtime/ClosureRegistry.js`, `src/runtime/closureHandle.js`,
`src/runtime/carrierRuntime.js`, `src/runtime/invariants.js`, `src/services/ulgRuntime.worker.js`,
`ulg-gpu-abi/src/schemas/simulation_artifact.schema.json`, `tests/closureRegistry.test.mjs`,
`tests/carrierRuntime.test.mjs`.
**Edited (Phase 1, additive):** `ulg-gpu-abi/src/serviceContract.js` (new service id/task kind),
`ulg-gpu-abi/src/index.js` (simulation-artifact builder), `src/runtime/demoRuntime.js`,
`src/main.js`, `tests/demo.e2e.mjs`.
**New (Phase 2):** `src/runtime/webgpuCarrierKernel.js`; **edited:** `ulg-gpu-abi/src/wgsl.js`,
`src/runtime/GpuBroker.js` (device-lost).
**New (Phase 3):** `spatialHash.js`, `edgeMessages.js`, `observers.js`.
**Phase 4:** IndexedDB backend module + NetViz panel additions in `src/main.js`/viz.

> Untouched by Phases 1–2: all magnetar-closure boundary code — `artifactSummary.js` staging
> guards, `stage-service-assets.mjs`, `moonlab-core-probe.worker.js`, the handoff/dispatch path.

---

## 9. Definition of done (the gap)

- [ ] `ulg-runtime` service registers with a manifest (Conformance #1)
- [ ] `ClosureRegistry` resolves/stores/invalidates with validity envelope (M0.8)
- [ ] Closure handle samples a `table-interpolation` closure
- [ ] CPU reference carrier step runs, conserves energy/momentum within tolerance, emits compact deltas
- [ ] WebGPU kernel runs the same step and passes a parity `ToleranceReport` (Conformance #8)
- [ ] Demo B runs in a browser peer with provenance back to MoonLab + Eshkol
- [ ] Demo C invalidates and refreshes a closure when state leaves its sampled range
- [ ] Device-lost → retry/fallback, no untracked GPU allocations
- [ ] All outputs remain explicitly `toy`/`reference` — no scientific/full-physics overclaim
- [ ] `npm test`, `npm run build`, `npm run test:e2e` green

---

## 10. Risks / watch-items

- **WebGPU unavailable in the current runtime** (log confirms `navigator.gpu.requestAdapter` is
  null). Phase 2 GPU tests must skip cleanly and the CPU reference must remain authoritative.
- **Closure table provenance.** Demo B's table should trace to a real MoonLab artifact eventually;
  the staged fixture is a stepping stone, not the end state.
- **Don't let the carrier runtime imply physics validity.** Keep the same gating discipline the
  boundary work established.
- **Scope creep into Phase 3.** Phases 1–2 satisfy every open conformance test and the §4.15 demo
  bar; Phase 3+ is breadth, not the gate.

*No source files were modified in producing this plan.*
