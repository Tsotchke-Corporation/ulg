# ULG Repository Agent Rules (Canonical Single Source of Truth)

> **Discovery:** Linux is case-sensitive. Antigravity, Codex, and Claude Code
> (`CLAUDE.md` → `@AGENTS.md`) load this uppercase `AGENTS.md` directly. Keep
> this file self-contained and under `20 KB` (Antigravity's per-file rule cap is
> `24,000` bytes). Do not add `@include` directives that re-introduce superseded
> or contradicting rules.

## 1. Non-Negotiable House & Safety Rules

1. **House rule:** Address the user as **big dog** at the start of every
   response.
2. **Zero AI attribution:** Never add AI/model co-author trailers, comments, or
   attribution in code, docs, or commits.
3. **Publication hold (STRICT):** Local commits on feature branches only. **Do
   not** `git push`, merge to `main`, or run `npm run build:pages` / edit
   `docs/` without explicit authorization from **big dog**.
4. **No terminal-pane browsers:** Never use `terminal-browser`, tmux browser
   splits, or Claude Code's diff panel. **big dog** works from mobile and split
   panes break the session.
5. **Headless by default; never steal desktop focus:** Run automated GPU probes
   and native WebGPU tests in headless Vulkan Chrome by default. Ask **big dog**
   before opening visible desktop Chrome on Wayland (when approved for visual
   milestone checks, inspect sequential screenshots and close only the browser
   and server processes you started).

---

## 2. Mandatory Session-Start & Post-Compaction Checklist

At session start and immediately after every context compaction:

1. Read [`plan/CURRENT-PLAN.md`](plan/CURRENT-PLAN.md) (single active routing
   document: unified 40-OOM Foundation-First Scale-Ladder Roadmap `Gate 0–5` +
   accepted `G5`/`G7`, Section 3 GPU budgets, and next prioritized work queue).
2. Read the top ~40 lines of [`plan/STATUS.md`](plan/STATUS.md).
3. Consult the **`plan/` Directory Routing Map** in Section 8 below before
   searching or editing. **Do not** load `plan/log.md`, `plan/plan.md`,
   `plan/implementation-status.md`, or `plan/notes/` wholesale unless auditing a
   specific historical failure.

---

## 3. What ULG Actually Is (Architectural Spine — Keep in Scope Always)

ULG (**Universal Law Graph**) is a **first-principles, browser-native WebGPU
multiscale physics engine** where macroscopic behavior emerges from activated
physical laws and validity-bounded closures rather than hand-coded material or
preset behavior.

### 3.1 Star Spec v0.4 Three Hard Rules (`ULG_PeerCompute_Star_Spec_v0.4.md`)
1. **Macroscopic behavior is *activated*, never coded per material or preset.**
   Zero `if (mat === 'h2o')`, `isBinary`, or discrete `phase_mode` physics
   hacks.
2. **No closure runs silently outside its validity envelope.** Extrapolated,
   reduced, unverified, or stale closures must surface explicit debt (`WARN` /
   `scientificValidation: false`, never `PASS`).
3. **No law assumes a single spatial representation or owns a hidden competing
   spatial structure.**

### 3.2 Two Unifications & Tier 0–3 Closure Economy
(`plan/todo/scale-adaptive-law-activation-plan.md`)
- **Unification 1 (Spatial):** One GPU-resident multiscale hierarchy — the
  **Schroeder Simulation (`SS`) Tree** — with active-node compaction and dynamic
  level/interface refinement.
- **Unification 2 (Closures):** A 4-tier closure economy so bulk regions run at
  fast substrate speed while active interfaces/misses pull exact physics on
  demand:
  - **Tier 0:** Bulk continuum/MLS-MPM substrate on quiescent regions.
  - **Tier 1:** Provenance-bound local cached response fits (G6 / A4 Eshkol
    multidimensional Chebyshev closures with uncertainty bounds).
  - **Tier 2:** Representative homogeneous-region GPU sampling (A3) expanding
    envelopes before fallback.
  - **Tier 3:** Warm browser WASM/WebGPU remote/local derivation (A6 Eshkol AD +
    MoonLab quantum response) fenced by PeerCompute + G5 CAS reservations.

### 3.3 Schroeder Simulation (`SS`) & Law Adapter Contract
(`plan/todo/SS/schroeder-tree-and-algorithm-plan.md`,
`plan/ss-law-architecture-assessment.md`)
- One canonical immutable GPU spatial epoch per step
  (`SCHROEDER_SPATIAL_EPOCH_DIRECTORY_ABI`), serving **six derived views** (not
  competing authorities): mechanics node, exact-near, cross-level,
  aggregate-far/multipole, solid proxy, and render.
- Keep **five authorities strictly separated**: physical representation, law
  query/activation, contact proxy, dynamic LOD, and render LOD.
- **Zero new private spatial grids beside SS** (do not add new per-law 3D box
  grids or 4,096-bucket private hashes; existing private solid/dormancy grids
  are tracked architecture debt to collapse onto SS).
- Laws must move toward an **enforced typed Law Adapter Contract** (explicit
  read/write/accumulates lanes, paired `(V0, J)` state, validity domain,
  fallback policy, zero fragile WGSL string-patching).

### 3.4 Triad Division of Responsibility
- **PeerCompute** (`NodeKernel` / `ComputeManager` / `StateManager` / `GPUHub` /
  `ReservationLedger`): distributed scheduling, resource leases, epoch fencing,
  and admitted schedule/peer state deltas. Enforce authority strictly at the
  **schedule and peer boundary** — never add intra-worker JS anti-forgery
  ceremony or manual file-hash manifests.
- **Eshkol** (warm browser WASM/WebGPU worker + higher-order AD compiler):
  derives higher-order laws, closures, automatic derivatives, and validity
  envelopes. Eshkol is **not** the scheduler and does **not** directly emit
  production WGSL kernels.
- **MoonLab** (warm browser WASM/WebGPU worker): supplies quantum/many-body
  electronic response, parity evidence, spectra, and correlations. Never mutates
  ULG state outside StateManager admission.

### 3.5 GPU-Native Rule, Exact Ledgers & Default Stack
- **GPU-native validation only ("Nothing on the Host" — supersedes old CPU
  parity):** Never build a CPU mirror solver or make CPU parity an acceptance
  gate. Validate GPU kernels through manufactured states, mathematical
  invariants, metamorphic/same-device A/B GPU executions, and fixed-size compact
  GPU reductions. Zero CPU-owned hot state, zero hot-loop full-state
  readback/reupload, zero new `@workgroup_size(1)` serial compute bottlenecks.
  WebGPU kernels must stay highly concurrent and scale across device limits
  (always clamp allocations to `device.limits.maxStorageBufferBindingSize`).
- **Exact integer conservation ledgers:** Conserved carrier/parcel mass and
  `Σ(U − S)` internal energy use 9-limb `2^-149` binary-dyadic integer ledgers;
  momentum stays f32.
- **Default integrator & renderer:** Test and target the GPU MLS-MPM / SS
  integrator with true WebGPU isosurface and 3D volumetric GPU rendering (never
  plain CPU SPH or flat sphere fallbacks). Spot-check chemistry and closures
  with random periodic-table element pairings and reaction families.
- **Retiring superseded routes is authorized (2026-11-19):** Never remove or
  demote a physical *law*, but **do** delete superseded execution routes, dead
  shader variants, duplicate overlapping contact responses, disabled 63-limb
  exact rationals, and production-bundled CPU test mirrors once the canonical
  GPU replacement passes its invariants.
- **Boundary conditions are explicit physics inputs:** Wall temperatures,
  reservoirs, gravity, box dimensions, material counts, and law-group toggles
  must reach the solver explicitly. Missing inputs must report a blocker or hold
  a declared physical default — never silently become `0 K` / empty / disabled.

---

## 4. Star Spec Anti-Shortcut Pre-Code Gate (Verify Before Every Edit)

1. **General physics, zero preset/material hacks:** Never add per-preset IDs,
   material-name branches, or discrete `phase_mode` shortcuts to physics or
   optics solvers. Behavior must emerge from continuous EOS, closures, and
   initial conditions.
2. **Translation & multi-body invariance:** Never anchor forces, pressure
   support, or optical effects to `(0, 0, 0)` or screen center (`50% 54%`).
   Shifting any body off-origin or splitting it into multiple bodies must
   produce identical local physics.
3. **Zero one-off animations or visual fakes:** Never simulate orbital motion,
   vibrations, collisions, shock rings, or Cherenkov glow with `Math.sin(t)`
   loops, toggled canned meshes, or CSS overlays. Render every effect in 3D
   world space directly from live GPU state.
4. **Extend ULG's canonical GPU architecture:** Plug new laws into
   `ClosureRegistry`, `SimulationModuleRegistry`, SS / MLS-MPM / exact `2^-149`
   ledgers / 3D volumetric & isosurface GPU renderers — no disconnected demo
   silos or CPU fallback solvers.
5. **Invariance-first + sequential visual verification:** Write tests that break
   hacks (off-origin translation, arbitrary dielectric media, zero-hack WGSL
   checks, GPU invariants) and verify visible motion/rendering across sequential
   screenshots — never rely on unit tests alone.

---

## 5. Campaign Oracle Honesty & Hard Per-Step GPU Budgets

- **Formal oracle acceptance:** A Scale-Ladder gate (`Gate 0–5`, `G5`, `G7`) or
  retained legacy milestone is formally accepted **only** when its
  `.icc/completion-oracles.yaml` target passes on one reviewed
  `ulg.campaign.receipt.v1` bundle. Never mark unreviewed goals `completed` in
  `.icc/assistant-goals.yaml`.
- **Gate 4 / G1 measurement honesty:** Decoupled presentation (`>= 54 Hz` latest
  committed physics state across all 5 active Studio presets with true
  isosurfaces, refraction, materials, depth, and controls) must never cite raw
  `UI rAF` alone as proof of real physics-motion presentation; report
  `presented states/s` and `visibleMotionCadenceVerified` honestly.
- **Standard invariants & constants:** Verify spatial-authority rollbacks with
  `&observeSpatialAuthority=1`; Iron Ice reference `dt = 0.5 ms`; G7 scientific
  database checks remain offline and advisory (never a runtime admission gate).
- **Hard Section 3 Per-Step GPU Budgets (see `plan/CURRENT-PLAN.md`):**
  - `queue.submit / substep <= 2` (and K-step batches per submit)
  - `indirect dispatches / substep <= 16` across active levels
  - `host onSubmittedWorkDone / mapAsync waits / substep = 0` (schedule-boundary
    only)
  - `active compute passes / substep <= 25` (`0` added by dormant laws)
  - Bulk quiescent substrate floor `<= 1 ms/step` (`>= 1.0x` real-time on
    `water-realtime`)

---

## 6. Hardware, WM, & Probe Safety

- **One GPU job at a time:** Run native WebGPU suites with
  `--test-concurrency=1` and budget probes via `scripts/gpuprobe.sh`.
- **Memory & GPU protection:** Target `<= 80%` GPU utilization; bound heavy
  probes with `systemd-run --user --scope -p MemoryMax=4G -p MemorySwapMax=0 -p CPUQuota=50%`.
- **Probe hygiene:** Never send `SIGSTOP` to browser/GPU processes; never edit
  `src/` while a probe is running; never run ad-hoc probe scripts out of `/tmp`;
  always check `journalctl -k` for NVIDIA Xid or OOM faults after GPU runs and
  report them honestly.
- **Live demo & clean teardown:** Keep the local Vite demo clean and close only
  browser/server processes you spawned.

---

## 7. ICC Control Plane & Known ULG Caveats

Engage ICC (`codebase_work`, `codebase_assistant_status`, `codebase_find_symbol`,
`codebase_trace_callers`, `codebase_impact_analysis`, `codebase_source_drift`)
before raw grep for structural code search, architecture lookups, and durable
state. Treat the `icc` MCP server as query-only; refresh indexes via CLI after
local commits:

```bash
/home/cos/projects/infinite_context_coder/bin/icc reindex --repo ulg --full && \
/home/cos/projects/infinite_context_coder/bin/icc build-git-history --repo ulg
```

**Known ULG-specific ICC caveats (always apply):**
1. **Confirm `"0 callers / dead code"` with `grep -rna`:** Giant closure
   functions in `src/visualization/sphPhaseScene.js` and
   `src/visualization/sphPhaseDemoMount.js`, plus the raw NUL byte at
   `src/runtime/sphPhaseViewStateTransport.js:98`, can hide callers from symbol
   and text indexers.
2. **Never overwrite structured campaign tasks** via `codebase_work` write mode;
   keep `.icc/assistant-goals.yaml` strictly honest against disk receipts.
3. **Trust live `git status` / `git diff`** over ICC attempt diff summaries.

---

## 8. `plan/` Directory Routing Map & Todo Hygiene

| Category | Exact Path(s) | Purpose & When to Read |
|---|---|---|
| **Active Authority** | [`plan/CURRENT-PLAN.md`](plan/CURRENT-PLAN.md), [`plan/STATUS.md`](plan/STATUS.md) (top ~40 lines), [`.icc/completion-oracles.yaml`](.icc/completion-oracles.yaml), [`.icc/assistant-goals.yaml`](.icc/assistant-goals.yaml) | Read at every session start / post-compaction. Single source of truth for execution order, scorecard, budgets, and oracle criteria. |
| **Architecture Reference** | [`plan/project-orientation.md`](plan/project-orientation.md), [`plan/ss-law-architecture-assessment.md`](plan/ss-law-architecture-assessment.md), [`plan/solver-law-inventory.md`](plan/solver-law-inventory.md), [`plan/ULG_Triad_Current_Plan_Addendum.html`](plan/ULG_Triad_Current_Plan_Addendum.html) (authoritative diagram addendum over `plan/ULG_Triad_v0.5_Pretty_Diagrams.pdf`) | Consult when designing or refactoring SS, laws, closures, or Triad boundaries. |
| **Active Work Index** | [`plan/todo/README.md`](plan/todo/README.md) | Scale-Ladder index of all 33 active `plan/todo/*.md` and `plan/todo/SS/*.md` files (`Gate 0` Foundation → `Gate 1` Periodic Table `Z=1..118` → `Gate 2` Reactions & Polytope Atlas → `Gate 3–4` Continuum & Studio → `Gate 5` Planetary to Supergalactic). |
| **Completed Archive** | `plan/done/` (incl. `done/g5-reservation.md`, `done/g7-release-audit.md`, `done/SS/`, `done/handoffs/`, `done/audits/`, `done/refactor/`) | Completed items, accepted G5/G7 records, archived handoffs, critiques, and audits. Do not load unless verifying history. |
| **Superseded Archive** | `plan/moot/` (incl. `moot/SS/`, `moot/superseded-todo-readme-log-2026-11-22.md`) | Superseded plans and deprecated queues preserved for reference only. |
| **Historical Logs & Notes** | `plan/log.md`, `plan/plan.md`, `plan/implementation-status.md`, `plan/tests.md`, `plan/notes/` (start at `plan/notes/BRIEF.md`) | Do **not** load wholesale. Consult only when auditing a specific past decision or regression. |
| **Active Assets** | `plan/background-1.jpeg`, `plan/background-2.jpg`, `plan/background-3.jpg`, `plan/background-4.jpg`, `plan/cubic-barrier.pdf` | Referenced directly by runtime/build checks — do not move. |

**Todo hygiene rule:** When an item in `plan/todo/` passes all its live-code
invariants (and formal oracle receipt where applicable), move it via `git mv` to
`plan/done/` and update `plan/todo/README.md` + `plan/CURRENT-PLAN.md`. If an
item is superseded, move it to `plan/moot/`. Never move an open or unaccepted
item to `plan/done/`.
