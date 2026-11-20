# Direction note 2: the Triad Spec v0.5 (the reference design in `plan/`)

Source: `plan/ULG_Triad_v0.5_Pretty_Diagrams.pdf` (75 pages, dated 2026-06-05,
"draft specification"), text extracted with `pdftotext -layout`.
`Agents.md:14` calls it "the reference design". Read by Hermes, 2026-11-17:
Parts 0 to 4 in full (extracted lines 1-1920). Not read: Appendix A (Mermaid
sources of the same figures) and Appendix B (JSON schema sketches), extracted
lines 1921-2921. Line numbers below are of the extracted text, not the PDF.

Where the Star Spec (direction note 1) says what the physics must be, this
says who owns what across the four projects.

## One sentence (`:258-261`)

"PeerCompute supervises distributed worker trees and visualization; Eshkol
derives and compiles physics closures; Moonlab supplies quantum/many-body
response artifacts; ULG/WebGPU workers consume validated closures to run
scalable carrier simulations."

The goal (`:211-213`): "let distributed browser peers run multiscale physics
workloads where low-level quantum and mathematical tasks generate validated
closures that are consumed by scalable WebGPU simulation kernels."

## Roles

- **PeerCompute: the authority.** NodeKernel session authority, P2P topology,
  hot/warm/cold shared state, compute-service registry, worker supervisor and
  child-worker leases, GPU broker, artifact and closure cache, validation
  manager, task lineage, NetViz telemetry. It "should evolve from a flat task
  runner into a supervised distributed worker-tree runtime."
- **Eshkol: the law and closure compiler.** ULG law macros; free-energy,
  response-function and EOS definitions; symbolic/forward/reverse AD;
  derivative metadata; closure-table generation; WASM reference functions;
  "optional WGSL/table-interpolation kernel generation"; Moonlab task
  invocation. Service tasks include `eshkol.law.compile`,
  `eshkol.closure.derive`, `eshkol.closure.table.generate`, `eshkol.wgsl.emit`.
  "Eshkol does not own P2P networking, visualization, distributed authority, or
  unsupervised GPU scheduling."
- **Moonlab: the quantum and many-body backend.** State-vector and
  tensor-network tasks, Hamiltonian matvec, Lanczos/Krylov, response and
  transition samples, CPU/WebGPU parity checks, quantum response artifacts.
- **ULG carrier runtime.** "consumes validated closures and runs scalable
  simulation kernels": carrier integration, spatial hash and neighbourhoods,
  edge messages, SPH-like observers, plasma/MHD/radiation kernels, closure
  interpolation, invariant passes, compact delta emission.

## Eight core design rules (Part 1, section 3)

1. PeerCompute owns orchestration; Eshkol and Moonlab are service workers.
2. Nested workers are supervised: child workers only through PeerCompute
   leases.
3. **GPU use is brokered.** "Services request WebGPU leases from PeerCompute
   instead of independently competing with rendering and simulation kernels."
4. Every result is provenance-bearing: method, input hash, source service,
   assumptions, validity, uncertainty, validation status.
5. "CPU/WASM remains the reference path. WebGPU acceleration is accepted only
   with tolerance policies and parity testing."
6. Shared ABI before performance work (`ulg-gpu-abi`).
7. No opaque compute islands: worker trees, GPU leases, memory pressure and
   cache state are visible to PeerCompute and NetViz.
8. No full-state replication by default: exchange hashes, manifests, compact
   deltas, artifacts, closure handles and boundary data.

Rule 5 was superseded for the WebGPU physics on 2026-07-09 (`Agents.md:99-107`:
"Do not build a CPU mirror solver or make CPU parity an acceptance gate").
It still describes how closure artifacts from Eshkol and Moonlab are checked.

## GPU broker (Part 2, section 5.4)

`GpuBroker { probe, requestLease, releaseLease, reportPressure }`. "Priority
order should be: render / UI > interactive simulation > simulation step >
closure generation > quantum reference > background validation". Listed risk:
"GPU compute starves visualization", mitigated by "GPU broker priority
classes". Milestone 0.8 acceptance includes "Render-priority lease preempts
background compute lease" and "Device-lost event marks running tasks
retryable".

## Artifacts and contracts

- `ComputeServiceManifest`, `ULGTaskCapsule` (task kinds `closure.derive`,
  `closure.table.generate`, `quantum.response`, `simulation.step`,
  `validation.reference`, ...; priority classes render, interactive,
  simulation, background, validation), `ChildWorkerLease`, `GpuLease`.
- `ClosureArtifact`: kind (eos, opacity, interatomic_potential, transport,
  optical_response, material_tensor, reaction_rate), inputs, outputs,
  derivatives, execution mode (`wasm-reference`, `wgsl-kernel`,
  `table-interpolation`, `hybrid`), validity, uncertainty, validation,
  provenance.
- `ValidationReport.status`: unchecked, pass, warn, fail, quarantined.
- Data lifecycle: hot (GPU buffers, carrier fields, domain state), warm
  (compact deltas, telemetry, closure handles), cold (IndexedDB snapshots,
  closure tables, WASM and WGSL modules, quantum artifacts, validation reports).
- "No service may publish distributed state directly. State commits go through
  PeerCompute."

## Roadmap (Part 3)

"The implementation should not start by building a full multiscale physics
engine. It should start by building the contracts and orchestration substrate
that make the physics stack credible: shared ABI → supervised workers →
closure artifacts → quantum artifacts → validation → end-to-end demo."

| Milestone | Goal |
|---|---|
| 0.5 | This specification package |
| 0.6 | Shared ULG IR and GPU ABI (`ulg-gpu-abi`) |
| 0.7 | PeerCompute service orchestration (registry, supervisor, child leases, cancellation tree) |
| 0.8 | PeerCompute GPU broker and artifact cache / closure registry |
| 0.9 | Eshkol closure service (law macro prototype, closure manifest, derivative metadata, WASM reference, table tiles, optional WGSL strategy) |
| 1.0 | Moonlab quantum service (task API, WebGPU probe, parity report) |
| 1.1 | Moonlab → Eshkol closure pipeline. Demo: quantum-derived bond potential, "Force equals -dE/dr within tolerance", "Closure invalidates outside sampled range" |
| 1.2 | EOS closure pipeline. Demo: hydrogen/plasma EOS closure; "Carrier simulation can use the closure without pulling full Eshkol into the hot kernel" |
| 1.3 | Distributed visualization and telemetry (NetViz) |
| 1.4 | Hardening: worker-leak soaks, simulated device loss, peer churn, cache quarantine |

Three demos: A, supervised service smoke test; B, quantum-derived potential;
C, "Eshkol EOS table → ULG carrier collapse toy model → closure invalidation
and refresh".

Definition of done for a v1-compatible integration: PeerCompute supervises all
root and child workers; Moonlab and Eshkol never publish distributed state
directly; heavy artifacts are content-addressed; closure artifacts carry
validity, uncertainty and provenance; NetViz can debug a failed closure; the
first two end-to-end demos run in a browser peer.

## What not to build (Part 4, section 9)

An independent Eshkol or Moonlab P2P scheduler; separate GPU ABIs; hidden
child-worker spawns; full tensor replication through network messages; artifact
caches without provenance; "WebGPU-only correctness paths without CPU/WASM
fallback" (this last one is the rule the owner later reversed for the physics
lane).

## Where the campaign sits against this design (Hermes, INFERRED)

- **G5** (reservation ledger) is Milestone 0.7/0.8 material: leases with epoch
  fencing and single-winner ownership.
- **G6, A4** are the closure factory of Milestones 0.9 and 1.2, run locally:
  sample, fit, residual bounds, cache, invalidate outside the envelope.
- **A6** is Milestones 0.9 to 1.1 as running services: Eshkol and MoonLab as
  WASM + WebGPU workers under PeerCompute, with failure and recovery.
- **A3** has no counterpart here; it is a ULG-side cost reduction.
- **G7** is the provenance and validation side for imported data.
- **The GPU broker is the design's answer to "do not let compute starve the
  desktop".** Whether ULG's lanes actually request leases with a priority class
  is to be checked in code (PeerCompute `GpuResidentLaneManager`, GPUHub).
- Neither this document nor the Star Spec contains SS. The spatial hierarchy
  is ULG's own answer (2026-07-01) to how "scalable carrier simulations" span
  scales, and the campaign's physics goals (G2, G3, A5, first-class air) all
  run on it.
- The design expects Eshkol to emit WGSL (`eshkol.wgsl.emit`). On 2026-07-25
  it emitted none (`ss-law-architecture-assessment.md`). The November work
  added Eshkol AD for EOS stiffness and browser-side Eshkol/MoonLab workers
  (per Claude's notes); whether any WGSL is Eshkol-generated today is to be
  checked.
