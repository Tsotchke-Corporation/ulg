# ULG Audit — Current State vs. v0.5 Spec

**Auditor:** Claude (Opus 4.8)
**Date:** 2026-06-08
**Spec of record:** `plan/ULG_Triad_v0.5_Pretty_Diagrams.pdf` (ULG Triad Spec v0.5, dated 2026-06-05, 68 pp.)
**Scope:** The `ulg/` repository only. MoonLab, Eshkol, and PeerCompute were read for context but not audited as deliverables.

> Path note: the request named `ulg/plans/`. The actual folder is `ulg/plan/` (singular),
> which holds the PFD and the other planning docs, so this audit lives there.

---

## 1. Executive summary

ULG is the **coordinator / integration app** of the triad. The repo today is a working
**PeerCompute-style supervised-service demo + shared ABI package + cross-repo handoff harness**.
It is healthy where it is built: `npm test` passes **22/22**, the Vite build succeeds, and the
single Playwright e2e drives a real two-service supervised smoke with a three.js worker tree.

Two things are true at once:

1. **The orchestration substrate and ABI (Milestones 0.5–0.8) are largely met or exceeded.**
   The shared `ulg-gpu-abi` package, JSON schemas, service registry, worker supervisor,
   child-worker leases, GPU broker, content-addressed artifact cache, and supervised
   Eshkol/MoonLab service workers all exist and are tested.

2. **The actual "ULG carrier runtime" — the reason ULG exists per §2.4 / Layer D — is not
   implemented.** There is no carrier simulation, no WebGPU compute kernel, no SPH/spatial-hash
   /edge-message/closure-interpolation/compact-delta path. The repo consumes and *hands off*
   closures; it does not yet *run* them.

A large, sophisticated body of work has gone into a **magnetar-closure handoff evidence lattice**
(`production-handler-boundary`, `dispatch-preflight`, `tensor-runtime-contract`,
`full-physics-validation-requirements`, etc.). This is far more elaborate than anything the v0.5
spec asks for, and it is carefully gated to never overclaim scientific validity — but it has grown
well *beyond* the spec while the spec's headline deliverable (a runnable browser carrier
simulation, Demos B & C) remains unbuilt.

**Headline verdict:** Strong on contracts and orchestration plumbing (Demo A). Missing the ULG
runtime kernel and the quantum-derived / EOS simulation demos (Demos B & C).

---

## 2. Verification performed

| Check | Result |
|-------|--------|
| `npm test` (node --test) | ✅ 22 pass / 0 fail |
| `npm run build` (vite) | builds (known large-chunk warning, per status log) |
| `npm run test:e2e` | not re-run here (needs browser); status log records 1/1 |
| Read spec Parts 0–3 + Appendix B schema sketches | ✅ |
| Read `ulg-gpu-abi/` source + schemas | ✅ |
| Read `src/runtime/*`, `src/main.js`, viz, workers | ✅ |
| Grep for WebGPU kernel dispatch / ClosureRegistry / IndexedDB | ✅ (absent — see §5) |
| Git working tree | essentially clean (one `agents.md`→`Agents.md` case rename pending) |

---

## 3. Milestone-by-milestone audit

### Milestone 0.5 — Specification package — ✅ Done
Versioned spec PDF, architecture/roadmap/extension content, schema sketches, and abstracts all
present in `plan/`. Diagrams are embedded; the standalone `.mmd` sources referenced in Appendix A
are described in the PDF but not checked into `ulg/` (they may live with the spec authoring repo).

### Milestone 0.6 — Shared ULG IR and GPU ABI — ✅ Mostly done (one deviation)
Deliverables vs. `ulg-gpu-abi/`:

| Spec deliverable | Status | Evidence |
|---|---|---|
| `ulg-gpu-abi` package | ✅ | `ulg-gpu-abi/package.json`, importable by fixtures |
| JSON schemas | ✅ | 6 schemas incl. `tolerance_report` (a 0.6 deliverable) |
| WGSL layout snippets | ✅ | `src/wgsl.js` (`TensorDescriptor` struct, complex64 helpers) |
| complex64 + tensor descriptor tests | ✅ | `tests/abi.test.mjs` round-trips complex64; tensor/closure descriptors |
| closure table descriptor tests | ✅ | `createClosureTableDescriptor` + tests |
| tolerance report schema | ✅ | `schemas/tolerance_report.schema.json` |
| provenance block schema | ⚠️ Partial | Provenance is a *builder* (`createProvenanceBlock`) and embedded in artifact schemas; no standalone `provenance.schema.json` |
| **TypeScript type definitions** | ❌ Deviation | Package is plain ES modules (`index.js`), not TS. Spec §3.9 recommends `src/types.ts`. Acceptable but a divergence from the spec. |

**Structural deviation:** Spec §3.9 recommends `ulg-gpu-abi/{src/types.ts, src/schemas/, src/wgsl/,
src/layouts/, src/validation/, conformance/}`. Repo has `{src/index.js, src/schemas/, src/wgsl.js,
src/serviceContract.js}` — no `layouts/`, no `validation/`, no `conformance/` directory, JS not TS.
Acceptance test ("Eshkol, MoonLab, and a dummy ULG worker can import the same ABI package") is met
in spirit via the published fixtures in `ulg-gpu-abi/examples/` and the shared contract builders.

### Milestone 0.7 — PeerCompute service orchestration — ✅ Done as a demo (ownership caveat)
The spec assigns this to PeerCompute. ULG implements **demo-local equivalents** of every interface,
and they match the spec signatures closely:

| Spec interface | ULG implementation | Match |
|---|---|---|
| `ComputeServiceRegistry` (register/listCapabilities/resolve) | `src/runtime/ComputeServiceRegistry.js` | ✅ |
| `WorkerSupervisor` (spawnService/submitTask/cancelTree/getTreeTelemetry) | `src/runtime/WorkerSupervisor.js` | ✅ |
| `ChildWorkerLeaseManager` (request/release/revokeByRootTask) | `src/runtime/ChildWorkerLeaseManager.js` | ✅ |
| heartbeat protocol | dummy worker emits 500ms heartbeats | ✅ |
| cancellation tree | `cancelTree` → revoke leases → worker `cancel-task` | ✅ |
| `TaskLineageTracker` | ⚠️ no dedicated tracker; task→children captured inline in supervisor | Partial |

Acceptance tests (register dummy Eshkol + MoonLab, submit tasks, grant child leases, cancel root
and children stop, show worker tree in NetViz) are all demonstrably exercised by `demoRuntime.js` +
the e2e. **Caveat:** these are intentionally demo substitutes. `plan/plan.md` lines 187–191 still
mark "replace demo-local scheduling/GPU/artifact substitutes with explicit service lifecycle … in
PeerCompute" as open — consistent with the Integration Rule that PeerCompute is the authority.

### Milestone 0.8 — GPU broker and artifact cache — ⚠️ Partial
| Spec item | Status | Notes |
|---|---|---|
| `GpuBroker` probe/lease/release/pressure | ✅ | `src/runtime/GpuBroker.js`; CPU fallback when `navigator.gpu` absent |
| Priority classes | ✅ | `PRIORITY_ORDER = render>interactive>simulation>background>validation` matches spec §3.6.4 |
| **Device-lost recovery path** | ❌ | No `device-lost` handling / task-retry on lost device |
| `ArtifactCache` put/get/announce | ✅ | content-addressed; real SHA-256 (incl. pure-JS fallback for non-secure HTTP VPN) |
| IndexedDB storage backend | ❌ | In-memory `Map` only; no cold-layer persistence |
| Cache announcement protocol | ⚠️ | `announce()` returns `{status:'local-only'}` stub |
| **`ClosureRegistry`** (resolve/store/invalidate) | ❌ | Not implemented anywhere. Spec §3.6.5 requires a closure registry with validity invalidation; the closure-derivation flow (Fig. 4/10) depends on it |
| Closure invalidation on validity failure | ❌ | No invalidation path |

### Milestone 0.9 — Eshkol closure service — ⚠️ Fixture-level only
Real Eshkol compilation lives in the Eshkol repo. In ULG, Eshkol is a **staged-asset + dummy
supervised worker**: `public/service-assets/eshkol/closures/{hello,magnetar-closure}/` carry a
real WASM module, closure-artifact JSON validated against the schema, bundle manifest, and DOM-free
host-imports factory. ClosureArtifacts with validity/provenance are emitted and schema-valid.
Child-worker tiling and a live closure-table generator are not present in ULG (by design — they're
Eshkol's).

### Milestone 1.0 — MoonLab quantum service — ✅ Strong (CPU/WASM); ⚠️ WebGPU declared-only
`public/workers/moonlab-core-probe.worker.js` (1,236 lines) leases a real MoonLab core WASM module,
builds a Bell `phi_plus` state, records basis probabilities, and runs a magnetar dipole-Ising
calibration with JS-reference parity. It emits a `QuantumResponseArtifact` and CPU/WASM parity
reports — meeting the bulk of the M1.0 acceptance tests. **WebGPU complex64 parity is declared as a
reduced fixture with `backendAvailable=false` / `executed=false`** in this environment (correctly
flagged, never overclaimed), so real browser-WebGPU parity is still pending.

### Milestone 1.1 / 1.2 — Closure pipelines (quantum-derived / EOS) — ❌ Not built as runtime
The magnetar descriptor/interpolation-table fixtures encode the *shape* of these pipelines and bind
to MoonLab reference hashes, but there is no executing pipeline that turns MoonLab energy samples
into an Eshkol closure consumed by a ULG kernel. (Full physics is explicitly out of scope for v0.5,
so this is partially expected — but the runnable toy demo is not there either; see Demos B/C.)

### Milestone 1.3 — Distributed visualization and telemetry — ⚠️ Partial
Present: three.js supervised worker-tree scene (`workerTreeScene.js`), plus terminal panels for
service registry/capabilities, tasks, child leases, GPU status, and content-addressed artifacts
with compact summaries (`main.js`). Missing relative to spec §3.13 VizTelemetryBus: dedicated
panels for closure-cache hits/misses, validation/provenance, physics residuals, peer topology, and
domain-ownership. The artifact-summary telemetry (`artifactSummary.js`, 1,778 lines) is very rich,
so much of the data exists; it just isn't surfaced as the full NetViz panel set.

### Milestone 1.4 — Hardening — ❌ Not started (expected)
No fuzz/soak/stress/device-loss/peer-churn harnesses. Appropriate for current stage.

---

## 4. Conformance tests (Spec §2.15) — status

| # | Conformance test | Status |
|---|---|---|
| 1 | Register Eshkol, MoonLab, ULG services with manifests | ⚠️ Eshkol + MoonLab ✅; no ULG-runtime service registered |
| 2 | Spawn root service workers under PeerCompute | ✅ (demo supervisor) |
| 3 | Grant and revoke child-worker leases | ✅ |
| 4 | Grant and revoke GPU leases | ✅ |
| 5 | Run MoonLab CPU/WebGPU parity task → `QuantumResponseArtifact` | ✅ CPU/WASM; WebGPU declared-only |
| 6 | Run Eshkol closure derivation task → `ClosureArtifact` | ⚠️ staged/dummy, schema-valid; not live derivation |
| 7 | Cache artifact by input/method/artifact hash | ✅ (artifact hash; input/method hashes exist on capsules) |
| 8 | **Use a cached closure in a ULG WebGPU kernel** | ❌ No ULG kernel exists |
| 9 | Show worker tree, GPU lease, cache, validation telemetry in NetViz | ⚠️ worker tree + cache + leases ✅; validation panel partial |
| 10 | Cancel a root task and confirm all children stop | ✅ |

**7.5 / 10 effectively.** The hard miss is #8 — the core ULG execution path.

---

## 5. Definition of done for v1-compatible integration (Spec §4.15)

| Criterion | Status |
|---|---|
| PeerCompute supervises all root and child workers | ✅ (demo) |
| MoonLab and Eshkol never publish distributed state directly | ✅ (services only) |
| All heavy artifacts are content-addressed | ✅ (`sha256:` refs, incl. transferred WASM bytes) |
| WebGPU tasks have CPU/WASM fallback or explicit unsupported status | ✅ (broker fallback; WebGPU explicitly `no-backend`) |
| Closure artifacts include validity, uncertainty, provenance | ✅ (schema-required) |
| NetViz shows enough to debug a failed closure or quantum task | ⚠️ Partial (no validation/provenance/residual panels) |
| **First two end-to-end demos run in a browser peer** | ❌ Demo A ✅; **Demo B not implemented** |

---

## 6. Demos (Spec §4.14)

- **Demo A — Supervised service smoke test:** ✅ **Implemented.** `runSmoke()` starts Eshkol +
  MoonLab, both spawn leased child workers and report heartbeat telemetry, and `cancelActive()` /
  `cancelTree()` tears the tree down. This is the substance of the passing e2e test.
- **Demo B — Quantum-derived potential** (MoonLab energy samples → Eshkol closure → ULG
  two-particle oscillator → NetViz provenance): ❌ **Not implemented.** No ULG oscillator/carrier
  kernel.
- **Demo C — Hydrogen/plasma closure** (Eshkol EOS table → ULG carrier collapse toy → closure
  invalidation/refresh): ❌ **Not implemented.** Requires the missing `ClosureRegistry` invalidation
  path and a ULG kernel.

---

## 7. Biggest gaps (ranked)

1. **No ULG carrier runtime (the core purpose).** Spec §2.4 / Layer D (§3.4.4) require carrier
   integration, spatial-hash/neighborhood, edge-message evaluation, SPH-like observers,
   plasma/MHD/radiation kernels, closure interpolation, invariant/reduction passes, and compact
   delta emission. A `grep` for `createComputePipeline` / `dispatchWorkgroups` / carrier / SPH finds
   **nothing** in `src/`. `wgsl.js` has only a struct + two complex64 helpers. ULG currently hands
   off closures but never executes one.
2. **No `ClosureRegistry` and no closure invalidation** (Milestone 0.8 / Figs. 4, 10, 11). The
   cache stores artifacts but cannot resolve/store/invalidate closures by validity — which the
   end-to-end flows depend on.
3. **No persistence (cold layer).** ArtifactCache is in-memory only; spec §3.10.3 wants IndexedDB
   snapshots / cached closure tables / WASM / WGSL modules.
4. **Demos B and C missing** → §4.15 "first two end-to-end demos run in a browser peer" fails.
5. **WebGPU parity is declared-only**, not executed — both for MoonLab kernels and for any ULG
   kernel (which doesn't exist). Honest gating, but still a functional gap.
6. **Minor:** no standalone provenance schema; ABI is JS not TS; no `TaskLineageTracker`; no
   device-lost recovery; reduced NetViz panel set.

---

## 8. Scope-drift observation (not a defect, but worth flagging)

The repo has invested heavily in a deep **magnetar-closure handoff evidence chain** —
`production-handler-boundary.v0`, `production-handler-contract.v0`,
`production-handler-dispatch-preflight.v0` (10-check summary), `production-host-import-candidate.v0`,
`magnetar-closure-tensor-runtime-contract.v0`, `tensor-linear-memory-binding.v0`,
`full-physics-validation-requirements.v0`, and more. `artifactSummary.js` alone is 1,778 lines and
the e2e asserts on hundreds of these fields.

None of this vocabulary appears in the v0.5 spec. It is **scrupulously gated** — every layer
asserts `scientificValidation=false` / `fullPhysicsValidation=false` and refuses to promote smoke
stubs — which is commendable discipline. But it represents a large build-out *orthogonal* to the
spec's roadmap, accumulated while Milestone 0.8's `ClosureRegistry` and the ULG runtime kernel (the
spec's actual critical path) went unbuilt. Recommend a deliberate decision: either (a) fold this
evidence model back into the spec as a v0.6 amendment so it's the agreed contract, or (b) freeze it
and redirect effort to the ULG carrier kernel + Demo B.

---

## 9. What's genuinely solid

- Shared ABI: complex64 SoA/interleaved handling, row-major stride computation, tensor/closure
  descriptors, deterministic `stableStringify` hashing, and a real SHA-256 with a non-secure-context
  fallback. Clean, tested.
- Supervised worker tree: registry → supervisor → leased child workers → heartbeat → cancel-tree,
  with three.js visualization. Demo A is real and passes.
- Content-addressed handoff envelopes (`peercompute.ulg.demo-handoff.v0`) with transferred WASM
  bytes and compact summaries — a credible cross-repo integration surface.
- Discipline around never overclaiming scientific validity. The gating is consistent and explicit.

---

## 10. Recommended next steps (to close the spec, in order)

1. **Implement a minimal ULG WebGPU carrier kernel** that consumes one cached `ClosureArtifact`
   (start with a CPU/WASM reference + optional WebGPU path) → satisfies conformance #8 and Layer D.
2. **Add `ClosureRegistry`** (resolve/store/invalidate) over the existing `ArtifactCache`, with
   validity-envelope invalidation → unblocks Demo C and the closure-derivation flow.
3. **Build Demo B** (MoonLab energy samples → Eshkol closure → ULG two-particle oscillator → NetViz
   provenance) → satisfies §4.15's two-demo bar.
4. **Add IndexedDB cold-layer persistence** to the artifact/closure cache.
5. **Round out NetViz panels:** closure-cache hits/misses, validation/provenance, physics residual.
6. **Register a `ulg-runtime` service** so conformance #1 is fully met.
7. Decide what to do with the magnetar evidence lattice (§8): standardize it or freeze it.

---

*End of audit. No source files were modified.*
