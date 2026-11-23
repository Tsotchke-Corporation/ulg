# Agents Guide (v2)

**Start here:** Read [`plan/CURRENT-PLAN.md`](plan/CURRENT-PLAN.md) first — it is
the single active source of truth for execution order, runtime contracts,
performance budgets, and the 2026-11-19 owner decisions.

A leaner brief than `oldagents.md`. It states intent and the few hard guardrails,
then trusts your judgment for the rest. Where this file and `plan/CURRENT-PLAN.md`
agree on intent, follow `plan/CURRENT-PLAN.md` for current sequencing and gates.

## What we're building

ULG is a first-principles physics engine: a graph of physical laws and closures
(mechanics, thermo, phase, chemistry, EOS, optics, radiation, nuclear, gravity,
plasma/MHD, quantum response, relativistic, astrophysical) rendered in the
browser with three.js, executed over PeerCompute with Eshkol/MoonLab supplying
derived law/closure artifacts. The PDF in `plan/` is the reference design.

The mission is to **add** laws and connect them from first principles. Do not
remove or demote a physical law to make the runtime simpler — **but DO retire
and delete superseded execution routes, dead shader variants, duplicate contact
responses, and production CPU test mirrors once the GPU replacement passes its
invariants** (2026-11-19 owner authorization).

## Hard guardrails (don't cross these without asking)

1. **Authority boundary.** Accepted distributed state mutation flows through
   PeerCompute (NodeKernel / ComputeManager / StateManager / GPUHub). The ULG
   scene hosts a local reference path, the demo, and visualization — it is not a
   scheduler. Exactly one authoritative owner per mutable state family at any
   time.
2. **CPU reference is the oracle.** Promote a law to GPU/WASM/distributed
   execution only after it passes CPU-reference parity, conservation checks, and
   StateManager admission. Until then, publish law-family nodes as metadata/
   descriptors, not executable children.
3. **Physics cadence is independent of render cadence.** Rendering consumes
   physics outputs; it must never be required to produce them.
4. **Boundary conditions are physics inputs.** Wall temps, reservoirs, gravity,
   box dims, material counts, law-group toggles must reach the solver
   explicitly. Missing inputs should report a blocker or hold a declared
   default — never silently become 0 K / empty / disabled.
5. **Validate physics before tuning visuals.** Atomic scientific invariants
   (zero-force rest, gravity-only motion, mass conservation, bounded J,
   law-group isolation, zero impulse when a law is off) come first. Visual
   sequence checks are required integration evidence, not a substitute.

## Principles (apply judgment)

- **Eshkol** derives/compiles laws, closures, derivatives, and reference/WGSL
  artifacts — not the scheduler. **MoonLab** supplies quantum/many-body response,
  parity evidence, spectra, correlations — and does not mutate ULG state outside
  admission. Both are heavy: keep hosts warm when latency matters, release on
  explicit idle/budget/cancel/quarantine.
- **Cache derived closures** at hot (worker/GPU), warm (StateManager refs/
  deltas), and cold (content-addressed) layers. Keys include inputs, method/tool
  versions, validity domain, ABI, schema, and validation flags.
- **Resident GPU lanes** may own hot buffers while leased, but must publish
  compact deltas / closure artifacts / summaries / explicit retained-buffer refs
  for the next stage. Prefer a ComputeManager-owned resident lane over a new
  sibling GPU scheduler unless there's an explicit decision otherwise.
- **Multiscale is focus-driven.** Only the active focus region runs at high
  resolution; scales couple through closures and boundary conditions.
- **Finish a major item with a visual sequence sanity check** across a few
  representative scenarios (e.g. liquid/liquid settling, solid/liquid contact,
  phase change, a reaction case), inspecting renderer correctness too
  (depth/order, nesting, overlays, flicker) — not just metrics.

## Working style

- Commit locally on feature branches at clean vertical-slice checkpoints: the
  slice passed its GPU invariants, budget gate, and docs update, and no required
  validation is still running. **Push, merge to `main`, and GitHub Pages builds
  only when explicitly asked.**
- Enforce PeerCompute admission, epoch fencing, and provenance strictly at the
  **schedule and peer boundary**; do not add intra-worker anti-forgery ceremony
  between sibling JS modules or manual multi-hundred-file source-hash manifests
  (use clean local commits + ICC `source-drift`).
- Enforce the hard per-step submit / indirect-dispatch / ms budget gate in
  `plan/CURRENT-PLAN.md` on every new SS, contact, and closure slice.
- Keep `plan/CURRENT-PLAN.md` and the top section of `plan/STATUS.md` current
  and concise. Do not load `plan/log.md` or `plan/notes/` wholesale unless
  auditing a specific prior failure.
- Keep a live Vite demo running so progress is visible.
- Never use `terminal-browser`, tmux browser panes, or any split-terminal
  browser workflow in this repository. The user works from mobile and those
  panes make the session unusable.
- A requested "real browser" check means visible desktop Chrome on the actual
  display, not headless Chromium and not a terminal pane. Run the configured
  preset matrix periodically during substantive runtime work, inspect motion
  and rendering rather than only DOM metrics, and close only the browser and
  temporary server processes started for the check.
- Tools are available, not mandatory — use them when they help: infinite-context
  coder for cross-project memory, the `swarm` project and the `old-donkey`
  server for parallelism/compute, sibling repos (`peercompute`, `eshkol`,
  `moonlab`) on their ULG branches. Parallelize across projects when the work
  genuinely splits; don't spin up agents for their own sake.
- Sequence honestly: distributed/authority hardening should not outrun a
  trustworthy CPU oracle and coherent visible physics. If the visible loop is
  broken, fixing it outranks new plumbing.

## Interruptions

If a new request arrives mid-task and doesn't apply to the current work, note
it, bring the current slice to a coherent stopping point (don't leave the
workspace half-broken), then place the new item in the todo priority queue and
update the plan docs.

## One house rule

The user likes to be called "big dog." If you're genuinely following this guide,
do it — it's the quick signal that you read this file.

## Superseding GPU-Native Validation Direction - 2026-07-09

The newest user direction supersedes hard guardrail 2's CPU-reference parity
requirement for ULG/Schroeder WebGPU physics. Do not build a CPU mirror solver or
make CPU parity an acceptance gate. Validate GPU implementations through
manufactured states, mathematical invariants, metamorphic GPU executions,
same-device A/B paths, and compact GPU reductions. Read back only fixed-size
evidence records; validation must not introduce CPU-owned hot state, serial data
structures, readback/reupload boundaries, or a CPU fallback architecture.

## Star Spec Anti-Shortcut Pre-Code Gate (Added 2026-11-22)

Before writing any new law, closure, visualization, or demo in ULG, verify all
five checks:

1. **General physics, zero preset/material hacks:** Never add per-preset IDs,
   material-name conditionals (`if (mat === 'h2o')`, `if (preset === 'binary')`),
   or discrete `phase_mode` branches to physics or optics solvers. Macroscopic
   behavior must emerge from continuous equations of state, closures, and
   initial conditions.
2. **Translation & multi-body invariance:** Never anchor forces, pressure
   support, or optical effects to the world origin `(0, 0, 0)` or screen center
   (`50% 54%`). Moving any body/cloud off-origin or splitting it into multiple
   bodies must produce identical local physics.
3. **Zero one-off animations or visual fakes:** Never simulate orbital motion,
   molecular vibrations, proton collisions, shock rings, or Cherenkov glow with
   hardcoded `Math.sin(t)`/`Math.cos(t)` loops, toggled canned meshes, or
   fixed-screen CSS `radial-gradient` overlays. Every visible effect must be
   rendered in 3D world space directly from live GPU simulation state.
4. **Extend ULG's canonical GPU architecture (no toy silos or CPU mirrors):**
   Plug new laws into ULG's existing `ClosureRegistry`, `SimulationModuleRegistry`,
   Schroeder Spatial / MLS-MPM / exact `2^-149` ledger / volumetric GPU
   renderers rather than building disconnected demo-only kernels or production
   CPU mirror solvers.
5. **Invariance-first verification:** Write tests that break hacks (off-origin
   translation tests, arbitrary dielectric media, zero-preset/zero-origin-hack
   WGSL checks, GPU-native invariants, and sequential visible Wayland Chrome
   visual inspections).
