# Agents Guide (v2)

A leaner brief than `Agents.md`. It states intent and the few hard guardrails,
then trusts your judgment for the rest. Where this file and `Agents.md` disagree
on *process*, prefer this one; where they disagree on *physics/architecture
intent*, they should already agree — if they don't, ask.

## What we're building

ULG is a first-principles physics engine: a graph of physical laws and closures
(mechanics, thermo, phase, chemistry, EOS, optics, radiation, nuclear, gravity,
plasma/MHD, quantum response, relativistic, astrophysical) rendered in the
browser with three.js, executed over PeerCompute with Eshkol/MoonLab supplying
derived law/closure artifacts. The PDF in `plan/` is the reference design.

The mission is to **add** laws and connect them from first principles. Do not
remove or demote a law to make the runtime simpler.

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

- Commit locally at clean points: the slice passed its validation, docs/log are
  updated, and no required validation is still running. Push only when asked.
- Keep two living docs current: a **short** `plan/implementation-status.md`
  (current focus, in-flight, last-green, next) and a development `log.md`
  narrative. Keep them short enough to actually read.
- Keep a live Vite demo running so progress is visible.
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
