# ULG Current Plan (Authoritative Routing Document)

**Effective:** 2026-11-19 AKST  
**Baseline checkpoint:** `main` @ `31fb694`  
**Active branch:** `feat/ulg-ga-consolidation`  
**Status of original 13 campaign targets:** **G5** ([done/g5-reservation.md](done/g5-reservation.md)) and **G7** ([done/g7-release-audit.md](done/g7-release-audit.md)) accepted. All other goals remain open and are re-sequenced architecture-first below.

This file is the **single active source of truth** for execution order, runtime rules, performance budgets, and slice acceptance. Historical logs (`plan/log.md`, `plan/implementation-status.md`, `plan/notes/`), detailed design specs (`plan/todo/*.md`), and prior failed evidence are preserved verbatim as reference and audit history; where older routing or sequencing prose conflicts with this document, **this document governs**.

---

## 1. Non-Negotiable Core Rules (Unchanged)

1. **Star Spec physics-first:** Macroscopic behavior emerges from activated laws and validity-checked closures. Never add per-preset or per-material physics branches, scripted clouds, or tuned visual overrides. Never remove or demote a physical law.
2. **GPU-native validation only:** No CPU mirror solver, no CPU parity gate, no full-state hot-loop readback/reupload. Validate via GPU manufactured states, mathematical invariants, metamorphic/same-device A/B runs, and fixed-size GPU reductions.
3. **Exact integer conservation ledgers:** Keep 9-limb `2^-149` binary-dyadic integer ledgers for conserved carrier/parcel mass and `Σ(U − S)` internal energy accounting.
4. **PeerCompute authority at the real boundary:** ComputeManager, GPUHub, and StateManager own scheduling, resource leases, and admitted schedule/peer state deltas. Rendering consumes admitted outputs and never owns physics cadence.
5. **Visual verification & browser hygiene:** Major runtime slices finish with sequential desktop Chrome visual checks on the actual display (never `terminal-browser` or terminal pane splits; close only owned browser/server processes). One GPU workload at a time; protect host VRAM/WM responsiveness.
6. **G7 stays advisory:** Scientific database comparisons remain offline, operator-side, and advisory — never a blocking runtime admission gate.
7. **Publication hold:** **No `git push`, no merge to `main`, and no GitHub Pages build** without explicit owner authorization.
8. **House rule:** Address the user as **big dog** in every response.

---

## 2. Owner Decisions & Guardrail Updates (2026-11-19)

These explicit decisions supersede earlier campaign restrictions that were stalling progress:

1. **Architecture-first sequencing:** Build the real-time bulk substrate, fast N-level SS chain, and live Eshkol/A3/A4/G6 closure loop **first** (Phase 1), then land G2, G3/A5, G4, and A6 directly onto that single canonical lane (Phase 2), then reassess G1 (Phase 3).
2. **Local slice commits allowed:** Commit verified vertical slices locally on feature branches (`feat/ulg-ga-consolidation`). Keep the hold on push, merge, and Pages builds.
3. **Retire superseded code routes:** Deleting dead or superseded execution paths (disabled 63-limb exact rationals, redundant f32/v1 schedulers, string-patched shader duplicates, duplicate contact responses, and CPU test mirrors living inside production modules) is **explicitly authorized** once the replacement passes its GPU invariant gates. Preserving a *physical law* does not require keeping four parallel implementations of it.
4. **Drop intra-worker ceremony:** Keep PeerCompute admission, epoch fencing, and provenance strict at the **schedule and peer boundary**. Drop intra-worker anti-forgery ceremony between sibling JS modules and 574-file manual source-hash manifests (clean local commits + ICC `source-drift` / git HEAD handle source identity).
5. **Hard per-step performance budget gate:** Every new SS, contact, and closure slice must pass a **pass / submit / indirect-dispatch / step-ms budget gate** alongside conservation tests. Regressions like O(200+) indirect dispatches per level pair are hard blockers.
6. **G1 decoupled presentation rule:** Update G1 acceptance from `presented_steps == physics_steps` to **latest committed physics state presented at `>=54 Hz`** across all six configured presets with true isosurfaces, refraction, materials, depth, and controls preserved.
7. **GPU-advanced multi-step SS epochs:** Lift the single-step host epoch rebuild requirement. Allow GPU-advanced multi-step SS epoch slots (or bounded A2 spatial validity) so K-step GPU batches execute without host round-trips.
8. **Parallel contact & thermal decoupling:** Replace the 512-pass serial contact owner with a parallel Jacobi contact pass, eliminate duplicate overlapping contact impulses, and decouple thermal conduction from contact pass-cap exhaustion.
9. **Lockable vertical slices turned ON by default:** Split remaining mega-oracles into vertical slices that enable **by default in live scenes** as soon as their GPU invariants and budget gates pass — stop leaving delivered architecture permanently parked behind opt-in URL flags.
10. **Bank-anchored product closures:** Approve general bank-anchored product closures (carrying explicit `imported` provenance per Star Spec case 3) to resolve unanchored stoichiometry overheating (e.g. FeO 6,780 K / missing oxides).
11. **Mixture parcels default:** Promote `environmentAirParcels=mixture` to default once visual and conservation checks pass.

---

## 3. Hard Per-Step Performance & Dispatch Budget Gate

Every Phase 1–2 runtime slice touching the step loop, SS chain, contact, or closures must report and pass these targets (measured headless/desktop on the canonical lane, one GPU job at a time):

| Metric | Old Baseline (Nov 3 Audit) | Phase 1 Target | Hard Regression Rule |
|---|---:|---:|---|
| `queue.submit` per substep | 30.5 | `<= 2` (and `K` steps per submit) | No slice may increase submits/step |
| Indirect dispatches per substep | 52 (216/pair in Nov 19 cross-transport!) | `<= 16` total across active levels | **Hard fail** if any pass loops `> 16` indirect dispatches per level |
| Host `onSubmittedWorkDone` / `mapAsync` waits per substep | 9.1 | `0` per substep (schedule-boundary only) | Zero per-step host waits |
| Compute passes per substep | 106 | `<= 25` active passes | Dormant laws must add `0` active passes |
| Bulk quiescent substrate (A1 Tier-0 floor) | ~159 ms/step canonical | `<= 1 ms/step` at bulk scale, `>= 1.0x` real-time on `water-realtime` | Must hold after retiring redundant routes |

---

## 4. Ordered Execution Queue (Vertical Slices)

### Phase 1 — Substrate Floor, Fast SS Chain, and Live Closure Loop

- **Slice 1.1 — Decouple Physics ↔ Presentation (`A1` Step 1)**
  - Break the remaining physics↔presentation couplings in `sphPhaseScene.js` / `ulgMechanicsResidentStage.worker.js`: latest-committed-state presentation snapshot, guaranteed presentation slot without stalling physics batches, move JS pressure-interface force rows to GPU physics cadence.
  - *Gate:* Presentation remains responsive while physics batches run; zero per-step frame-proof waits; GPU invariants + desktop Chrome smoke pass.

- **Slice 1.2 — Parallel Jacobi Contact & Thermal Decoupling (`A1` Step 2)**
  - A/B the five overlapping contact responses at the iron-ice interface, delete duplicate impulses, replace the 512-pass serial contact owner with a parallel Jacobi contact kernel, and decouple thermal conduction from contact pass-cap exhaustion.
  - *Gate:* Contact GPU invariants pass, thermal never drops out on `sodium-water`, contact pass time drops from ~44 ms toward sub-millisecond scale.

- **Slice 1.3 — Canonical Fused Multi-Step Substrate & Legacy Retirement (`A1` Step 3 + `A2`)**
  - Shared command-encoder stage runner, GPU-advanced epoch slots (or bounded A2 validity) enabling K-step batches without host round-trips, executable law descriptor enforcing single-writer / `accumulates` contracts.
  - Retire disabled 63-limb exact-rational paths, superseded non-fused/v1 shader-patch routes, and production-bundled CPU test mirrors once GPU gates pass.
  - *Gate:* Meets the Section 3 submit/pass/wait budget; all active GPU invariants and host tests green; measurable LOC reduction in `sphMlsMpmGpuStep.js` and `sphPhaseScene.js`.

- **Slice 1.4 — Fast N-Level SS Chain & Dynamic Split/Merge (`SS` + First-Class Air)**
  - Redesign `schroederSpatialChainCrossTransportGpu.js` to eliminate the 216-indirect-dispatch loop (replace with compact single/few-pass GPU work under Section 3 budget).
  - Wire the N-level chain + exact integer ledgers + worker split/merge (slice 1c) into the single canonical lane so contiguous air runs on coarse SS levels and interface regions refine automatically, retiring the implicit-atmosphere stand-in.
  - *Gate:* 3–6 level manufactured + room-air conservation (`Σ mass`, `Σ(U−S)`, momentum, angular momentum), zero budget violations, live Iron Ice / room-air progression faster than single-level fine air.

- **Slice 1.5 — Close the Live Eshkol / A3 / A4 / G6 Closure Loop**
  - Connect the already-built components into one live GPU loop running **by default**:
    1. Per-node envelope watch detects out-of-envelope regime on GPU.
    2. **A3** (`regionalClosureSamplerGpu.js`) samples representative homogeneous regions on GPU.
    3. **G6 / A4** (`thermalPotentialGpu.js`, `responseFunctionGpu.js`, Eshkol AD stiffness) fits bounded Chebyshev/response closures with held-out error bounds and G4 uncertainty intervals.
    4. Schedule-boundary admission promotes the immutable fit generation via StateManager + G5 reservations.
    5. Resident GPU evaluators (`rf_eval`, caloric potential, semi-implicit CG pressure) serve the region; out-of-envelope falls back cleanly with explicit debt/exact sub-stepping.
  - *Gate:* End-to-end live scene executes miss → sample → fit → adopt → cache hit → measurable step/dt speedup with exact mass/`U−S` conservation and zero silent extrapolation.

### Phase 2 — Land Domain Goals on the Single Canonical Lane

- **Slice 2.1 — G2 Conserved Plumes & Mixture Air Default**
  - Run room-air `iron-ice-quench` and `sodium-water` on the exact-ledger canonical N-level lane, enable general bank-anchored product closures (`imported` provenance) for FeO/oxides, flip `environmentAirParcels=mixture` to default.
  - *Gate:* Desktop Chrome sequential visual proof of conserved rising Iron Ice condensate plume + traced `sodium-water` gas/aerosol lineage; G2 oracle criteria pass.

- **Slice 2.2 — G3 / A5 Coherent Solids Inside SS**
  - Insert solid body proxies into SS spatial cells (retiring brute-force O(N·M) / O(P²) searches), wire solid melt release and solid-fluid traction/buoyancy onto the exact-ledger canonical lane, and turn coherent rigid ice ON by default where physically admitted.
  - *Gate:* SOL-0/SOL-1 + SOL-2/SOL-3 GPU invariants (including float/sink/neutral buoyancy and melt conservation) + desktop visual sequences.

- **Slice 2.3 — G4 Compacted Per-Node Dynamic Law Activation**
  - Extend conservative per-node envelope masks (carrying G6/A4 uncertainty bounds) and compacted GPU indirect dispatch across thermal, phase, radiation, and reaction stages so dormant regions execute zero kernel work.
  - *Gate:* GPU A/B bit-identity at `ε = 0`, conservative activation when uncertainty straddles threshold, zero-work witness on quiescent bulk, random element-pair spot checks.

- **Slice 2.4 — A6 Warm Browser WASM/WebGPU Eshkol & MoonLab Wired to Live Misses**
  - Connect `eshkol-warm-vm.worker.js` and `moonlab-warm-webgpu.worker.js` to real Slice 1.5 closure misses through PeerCompute + G5 reservations, proving warm reuse and worker failure/recovery on live runs.

### Phase 3 — G1 Reassessment & Release Readiness

- **Slice 3.1 — G1 Decoupled Presentation Reassessment**
  - Measure decoupled latest-committed-state presentation (`>=54 Hz`) across all six configured presets (`water-cycle`, `iron-ice-quench`, `sodium-water`, `cesium-fluorine`, `bulk-water`, `water-realtime`) with true isosurfaces, refraction, depth, controls, and clean lifecycle.
  - Present complete evidence to big dog before lifting any hold on merge, push, or GitHub Pages.

---

## 5. Document & Evidence Map

- **Active plan (read first):** `plan/CURRENT-PLAN.md` (this file)
- **Live checkpoint summary:** `plan/STATUS.md` (keep top section concise)
- **ICC durable state:** `.icc/assistant-goals.yaml`, `.icc/quality-campaigns.yaml`, `.icc/completion-oracles.yaml` (external artifacts under `/home/cos/.cache/icc/repos/ulg/`)
- **Detailed subsystem designs (reference):** `plan/todo/SS/`, `plan/todo/a1-*.md`, `plan/todo/a3-a4-*.md`, `plan/todo/a5-*.md`, `plan/todo/a6-*.md`, `plan/todo/first-class-air.md`, `plan/todo/g2-integer-ledger-proposal.md`, `plan/todo/g3-solids-proposal.md`, `plan/todo/g4-dynamic-laws-proposal.md`, `plan/todo/g6-local-fit.md`, `plan/todo/sol-critic.md`, `plan/todo/scale-adaptive-law-activation-plan.md`, `plan/todo/eshkol-higher-order-law-closure-plan.md`
- **Historical archive (do not load wholesale unless auditing a past failure):** `plan/log.md`, `plan/implementation-status.md`, `plan/handoff-*.md`, `plan/notes/`
