# SS Tree and Physics Laws: Architecture Assessment

Written 2026-07-25, after the Slice 9 debugging run. The question that prompted
it: *is there a well thought out architectural plan for how the datastructure
and algorithms fit together for the SS tree and the physics laws?* The
hypothesis behind the question — that the brittleness we keep hitting comes
from fiddly details a clean design with clear interfaces would remove — is
correct, and this note tries to say exactly where the seam is.

## Short answer

Half of one exists. The **datastructure** has a real architecture. The
**laws' relationship to it** does not, and every defect in the Slice 9 run
lived in that gap.

## What exists

`plan/todo/SS/shared-spatial-authority-refactor-plan.md` (2176 lines) is a
genuine architecture of the spatial side, and a good one:

- one canonical spatial epoch per step, immutable while it is read;
- five *derived views*, explicitly "not competing authorities" — mechanics
  node, exact-near, cross-level, aggregate-far, solid proxy, plus render;
- a scheduler lifecycle: admit and freeze -> build one epoch -> run all readers
  against that generation -> propose deltas -> reduce and admit -> commit
  topology once -> invalidate;
- 14 explicit prohibitions, several load-bearing: no universal widest-law pair
  list, no coupling of physical representation / law query / contact proxy /
  render LOD authority, no host-mediated fallback.

`plan/solver-law-inventory.md` (400 lines) is a **catalog** of the laws and
solvers that exist. It is an inventory, not a type.

## What does not exist

There is no interface that says what a physics law *is*: what it may read, what
it may write, how it publishes, how it proves it ran. Slice 4 of the SS plan
promised exactly this —

> Slice 4 - First-class law-DAG producer and epoch scheduler
> - Make laws propose deltas against immutable membership.

— and `src/runtime/closureLawGraph.js` was built for it. In practice it is
imported by exactly one physics file, `sphThermalGpuKernel.js`. Every other law
is wired case by case.

So the spatial side is designed and the law side is convention.

## The evidence

Six defects from one debugging run, each traced to a missing contract rather
than to a careless line:

| What broke | Missing abstraction |
| --- | --- |
| Mechanics-field view v4: four consumers asserted v3 span arithmetic | Layout descriptors (`*_ROW_LAYOUT`) exist, but consumers still hand-write `row4.z * row4.w`. Offsets are re-typed per consumer, not derived. |
| Three workspace pipelines bound too few buffers | Bind groups authored per pipeline instead of generated from declared reads/writes |
| Unbounded GPU memory leak (`ulg-mls-mpm-separation-bins`) | Ownership transferred by *deleting the buffer from your own ledger*. "Who frees this" was a comment. The two-level path never learned it had inherited the duty. |
| Contact blow-up (78 m/s, J to 8.7e-4) | `V0` taken from the target phase's rest density, `J` from the source's current volume, combined in one expression. Nothing anywhere states that `V0` and `J` must describe the same configuration. |
| Receipt phases, consumer masks, seals | A hand-rolled state machine re-implemented per shader |
| Shader edits that silently did not apply | `replaceRequiredWgsl` derives variants by regex substitution, so *which text actually runs* is not answerable from the source |

That is not six unrelated bugs. It is one failure mode six times: **contracts
that live in prose and are re-implemented per consumer**. `Vcurrent = V0 * J`,
"density is an EOS target, not geometry authority", "the receipt advances
EMPTY -> ... -> CONSUMED" are all real rules, all written in English in a
handoff, and all enforced by hand at each site that happens to remember them.

## Eshkol was supposed to be this layer

`Agents.md` line 43 states it directly:

> **Eshkol** derives/compiles laws, closures, derivatives, and reference/**WGSL
> artifacts** — not the scheduler.

So the declarative layer is not missing from the *design*. It was designed,
named, and assigned. What is missing is the connection. As of upstream
v1.3.4-evolve (2026-07-23):

- **Eshkol emits no WGSL.** No occurrence of `wgsl` anywhere in that repo —
  not in source, not in docs, not in the roadmap. Its GPU work targets Metal
  SF64 and CUDA cuBLAS for tensor/BLAS dispatch; "Vulkan Compute for
  cross-platform GPU" is still an unchecked roadmap item and WebGPU is not on
  it at all.
- **ULG consumes Eshkol only through the service path** — `demoRuntime.js` and
  `artifactSummary.js`, i.e. the magnetar-closure descriptor, tensor
  linear-memory bindings, and production-handler contracts. That is PeerCompute
  plumbing and WASM smoke fixtures.
- **No SPH or material law comes from Eshkol.** `src/runtime/sph/` and
  `src/runtime/material/` contain zero references to it.

This was known at the outset. `oldagents.md`: *"we will need to extend eshkol
and moonlab to improve wasm to webgpu support to make this happen."* That
extension was never built.

## Why that explains the specific brittleness

Every law in the SS/mechanics path is hand-written WGSL — roughly 17k lines in
`ulg-gpu-abi/src/wgsl.js` plus the generators in `sphMlsMpmGpuStep.js`,
assembled by regex substitution. The architecture says those should be *derived
artifacts*. They are primary sources.

When WGSL is derived, `V0` and `J` come from one declaration and cannot
disagree; renaming a lane regenerates its consumers; bind groups follow from
declared reads. When it is hand-written, each of those becomes an independent
opportunity to make the same mistake — which is exactly what the v4 cascade,
the bins leak, and the materialization blow-up each were.

## Options

1. **Build a WGSL backend in Eshkol**, as originally intended. Highest ceiling
   and it is the stated architecture. But WGSL is not a port of the Metal/CUDA
   tensor path; it is a new target, and this is a compiler backend project.
2. **Put the descriptor layer in `ulg-gpu-abi`** — generate accessors and bind
   groups from the lane layouts that already live there, and keep paired
   physical quantities as host types. Much smaller, prevents the same class of
   bug, but ULG grows the thing Eshkol was supposed to provide and the two will
   drift.
3. **Narrow Eshkol's charter in `Agents.md`** to what it actually does —
   closures, derivatives, reference artifacts — and own the WGSL guardrails
   locally on purpose rather than by default.

Recommended sequence: **(3) immediately, (2) next, (1) eventually.**

(3) is nearly free and matters most right now, because the documented
architecture currently claims a component owns physics-law compilation, that
component does not do it, and anyone reading the architecture will keep
assuming a safety net that is not there. That gap is what allowed hand-written
invariants to proliferate without anyone treating it as a deviation.

## Concretely, if we do (2)

In order of bugs-prevented per unit of work:

1. **Generate accessors from the lane descriptors.** Emit
   `fn particle_rest_volume(i) -> f32` from
   `MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT`. A v4-style change then
   regenerates every consumer; the cascade becomes impossible rather than
   merely caught.
2. **Make represented volume a paired type.** `V0` and `J` never separately
   assignable; one constructor `atRestState(mass, rho)` and one
   `fromCurrent(V0, Vcurrent)`. The Slice 9 blow-up becomes unconstructible.
3. **Leases instead of authority conventions.** A transferred resource returns
   a lease that must be consumed or released; assert the live set is empty at
   frame end. The bins leak becomes a failed assertion on step one.
4. **A law descriptor** — `{ id, view, reads[], writes[], accumulates[], stage }`
   — from which bind-group layouts and the receipt protocol are *generated*,
   and from which "no two laws write the same lane in one stage" is *checked*.
5. **Compose shaders from named fragments**, not regex substitution, so the
   live variant is identifiable from source.

Steps 1 and 2 alone would have prevented the two worst defects of the Slice 9
run. Neither is a rewrite, so the standing prohibition on a "megacommit or
broad orchestrator rewrite" is not in tension with them.

## Limits of this assessment

This is inferred from the defects actually hit, which cluster in mechanics and
phase change. The reaction, optical, and electronic paths were not audited; I
do not know whether they share the pattern or already carry tighter contracts.
I also have not read Eshkol's IR closely enough to judge how tractable a WGSL
backend would be — that is the input needed before choosing (1) over (2).
