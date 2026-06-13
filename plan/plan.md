# ULG Implementation Plan

## Current Target

Build the Milestone 0.6 and 0.7 foundation from the v0.5 spec before deeper
physics work:

1. Shared ULG ABI descriptors and schemas.
2. Shared service contract builders, adapter docs, and fixture manifests.
3. Dummy supervised Eshkol and MoonLab services.
4. Child-worker leases and cancellation tree.
5. Browser-visible telemetry and three.js worker-tree visualization.
6. Tests that prove descriptor validation, fixture conformance, lease behavior,
   and the live demo.

## Work Breakdown

### ULG app

- [x] Create vanilla Vite app with three.js visualization.
- [x] Implement shared ABI package in plain ES modules.
- [x] Add JSON schemas for the spec artifacts.
- [x] Export stable service contract builders and cross-repo JSON fixtures.
- [x] Implement PeerCompute-style registry, supervisor, leases, GPU probe, and cache.
- [x] Implement dummy Eshkol and MoonLab service workers.
- [x] Add browser-facing service asset convention and MoonLab WASM locateFile/MIME
  probes for copied artifacts.
- [x] Add a supervised MoonLab classic child worker that instantiates the real
  core WASM runtime and emits Bell-state probabilities into the task artifact.
- [x] Add compact `peercompute.ulg.artifact-summary.v0` browser telemetry so
  PeerCompute-style consumers can see descriptor/parity/calibration readiness
  without fetching full artifact bodies.
- [x] Add an Eshkol closure-bundle service asset convention and browser probe for
  manually staged `scripts/export_ulg_closure_bundle.py` outputs.
- [x] Return staged Eshkol closure bundle artifacts from the supervised service
  worker when the bundle is ready.
- [x] Preserve Eshkol closure entry signature, start-section, import/export,
  WASM metadata count, and DOM-free host-import bundle metadata in compact
  artifact-summary telemetry and the live artifact list.
- [x] Export `peercompute.ulg.demo-handoff.v0` packets from the browser demo
  artifact cache, including same-origin transferred Eshkol WASM bytes for
  PeerCompute/Multiscale ingestion without mixed-content fetches.
- [x] Emit digest-shaped `sha256:` artifact refs from the browser artifact cache
  so relay/service dispatch plans can verify content-addressed handoffs on the
  HTTP VPN demo.
- [x] Surface Eshkol `validation.outputSemantics` smoke-fixture metadata through
  compact artifact-summary telemetry and the browser handoff packet without
  marking the closure scientifically validated.
- [x] Surface Eshkol `validation.closureDescriptor` magnetar fixture metadata
  through compact artifact-summary telemetry and the browser handoff packet,
  preserving transferred WASM bytes while keeping descriptor-only closures out
  of host-runtime/output-smoke execution.
- [x] Expose a separate `createPeerComputeEshkolSmokeHandoff()` browser API that
  keeps the default magnetar descriptor service unchanged while exporting the
  staged `hello` closure bundle with real output semantics and transferred WASM
  bytes for PeerCompute's gated runtime execution proof.
- [x] Surface Eshkol's
  `eshkol.ulg.magnetar-closure-tensor-runtime-contract.v0` through compact
  artifact summaries and staging guards, including tensor ids, contract hash,
  interpolation-table binding, sample-shape validation, and explicit
  non-scientific/full-physics flags.
- [x] Surface Eshkol's `eshkol.ulg.production-handler-boundary.v0` through ULG
  staging guards, compact summaries, browser handoffs, and artifact-list status
  while preserving explicit non-scientific/full-physics flags.
- [x] Surface Eshkol's smoke-only f64 tensor linear-memory layout through ULG
  staging guards, compact summaries, browser handoffs, and live status while
  preserving `entryExportConsumesOffsets = false`.
- [x] Upgrade the staged Eshkol magnetar closure to deterministic tensor-offset
  runtime smoke, including consumed declared offsets, produced output tensors,
  `64` changed declared tensor bytes, and explicit non-production/full-physics
  blockers.
- [x] Surface exact Eshkol tensor-runtime smoke evidence and production blocker
  counts in the visible demo artifact row and `npm run status:live` output.
- [x] Surface Eshkol's production-host-import candidate requirements through
  ULG staging guards, summaries, visible artifact rows, and live status while
  keeping smoke stubs explicitly non-production.
- [x] Surface Eshkol's
  `eshkol.ulg.production-handler-dispatch-preflight.v0` through ULG staging
  guards, compact summaries, browser handoffs, e2e coverage, and live status
  while keeping full-physics readiness blocked.
- [x] Surface Eshkol's computed production dispatch preflight check evidence
  through ULG staging guards, compact summaries, browser handoffs, e2e coverage,
  and live status.
- [x] Surface Eshkol's production-candidate runtime probe as smoke-only evidence
  through ULG staging guards, compact summaries, browser handoffs, e2e coverage,
  and live status while preserving the full-physics blocker.
- [x] Surface Eshkol's declared production handler contract through ULG staging
  guards, compact summaries, browser handoffs, e2e coverage, and live status,
  advancing production dispatch preflight evidence to ten required checks,
  seven passed checks, and three blocked checks before the production-candidate
  handler/runtime evidence slice superseded those counts.
- [x] Surface Eshkol's production-candidate handler implementation and runtime
  execution evidence through ULG staging guards, compact summaries, browser
  handoffs, e2e coverage, and live status, advancing production dispatch
  preflight evidence to ten required checks, nine passed checks, and one
  blocked full-physics check.
- [x] Surface Eshkol's
  `eshkol.ulg.full-physics-validation-requirements.v0` through ULG staging
  guards, compact summaries, browser handoffs, e2e coverage, and live status so
  the remaining full-physics blocker is a concrete five-family evidence contract
  instead of a bare boolean.
- [x] Promote Eshkol's DOM-free `eshkol-host-imports.js` factory to a
  first-class browser/service-worker asset, probe it as JavaScript, import it in
  the supervised Eshkol worker, and expose factory/readiness summary fields
  without invoking the production handler.
- [x] Surface MoonLab's `moonlab.webgpu.complex64-parity-scope.v0` browser
  evidence through ULG staging, core-probe validation, summaries, UI, handoffs,
  and e2e coverage with `device-acquired`, executed/passing
  `compute_probabilities`, `hadamard`, `pauli_x`, `pauli_z`, and `cnot`
  reduced probes, while preserving explicit no-full-physics/no-full-fidelity
  flags.
- [x] Surface MoonLab's compact WebGPU parity handoff summary as reduced-scope
  five-operation evidence for `compute_probabilities`, `hadamard`, `pauli_x`,
  `pauli_z`, and `cnot`, without claiming full MoonLab runtime backend,
  full-fidelity magnetar simulation, or full-physics validation.
- [x] Generalize MoonLab native-operation summary rendering so future blocked
  operations flow through `operationResults[]` without new one-off UI fields.
- [x] Add direct Multiscale launch status detail for scenario/readiness acks
  while preserving the `handoff ready / blockers 0` compatibility prefix.
- [x] Add Phase 1 ULG carrier-runtime foundations: `ClosureRegistry`,
  table-interpolation closure handles, CPU-reference velocity-Verlet carrier
  runtime, invariant drift reports, `peercompute.ulg.simulation-artifact.v0`,
  and a first-class `ulg-runtime` service contract.
- [x] Add `window.__ulgDemo.runOscillatorDemo()` and a retro UI control that
  stores a toy harmonic closure, resolves it from the cache, submits a
  supervised `simulation.step` task, and emits a toy/reference simulation
  artifact without changing the magnetar Eshkol/MoonLab handoff.
- [x] Add Phase 2 WebGPU carrier-runtime plumbing: an optional WGSL
  two-particle carrier step, CPU/WebGPU parity gate, worker-local device-loss
  fallback reporting, GPU broker device-loss lease marking, compact
  simulation WebGPU summary fields, and e2e coverage that accepts WebGPU only
  when parity passes. CPU-reference output remains authoritative and this does
  not claim SPH/material/full-physics validation.
- [x] Add Phase 3A carrier topology primitives without building an SPH demo:
  normalized particle state, deterministic spatial hashes, radius-limited
  neighbor pairs, and closure-sampled edge messages with antisymmetric force
  conservation summaries for future field/material/EOS operators.
- [x] Add Phase 3A field-observer primitives over neighbor graphs, with
  compact-support scalar smoothing summaries and explicit no-SPH/no-material/
  no-phase-change validation scope.
- [x] Surface Phase 3A edge-message conservation summaries through simulation
  artifact summaries, browser artifact rows, and oscillator e2e coverage so
  handoff consumers can distinguish topology/operator evidence from raw deltas.
- [x] Surface Phase 3A field-observer summaries through carrier compact
  deltas, simulation artifact summaries, browser artifact rows, and oscillator
  e2e coverage so handoff consumers can see scalar field-observer operator
  evidence without claiming density, material, SPH, or phase-change readiness.
- [x] Add Phase 3A field-closure sample descriptors over observed scalar fields
  and surface compact `simulationFieldClosureSample*` telemetry without
  claiming material properties, EOS, SPH, or phase-change readiness.
- [x] Fix SPH box/grid scaling so larger container dimensions increase the
  MLS-MPM grid dimensions/node count while continuous surface radii remain tied
  to particle spacing/smoothing length, not box size.
- [x] Add visible SPH demo runtime warnings, decoupled render/physics/resident
  FPS telemetry, and PeerCompute-compatible localStorage closure cache reuse.
- [x] Guard the localStorage closure cache with input/method/validity hashes and
  a material-generator fingerprint so cached material properties persist across
  runs but stale records are ignored when generating code changes.
- [x] Add `sph.phase.rebuild` to the supervised `ulg-runtime` service and wire
  SPH control rebuilds through the worker so material/reaction/view-state
  rebuilds do not block the UI when the runtime is available.
- [x] Add a formula-parser-driven reaction candidate layer for general
  element/compound pairs, including active-metal/water and charge-balanced
  binary ionic candidates, and route the SPH adapter through balanced
  stoichiometry records instead of the old limited compound recognizer.
- [x] Restore visible resident playback motion in the SPH demo after moving
  away from the raw WebGPU overlay: playback now keeps renewing GPU-resident
  continuation chains, preserves the initial render-field pass needed to derive
  pressure-interface force rows, and forces a Three/MarchingCubes visual refresh
  when compact resident diagnostics cross the visible-motion threshold.
- [x] Fix resident MLS-MPM reset-path physics continuity: multi-substep
  GPU-resident runs now use sequence-owned pressure-interface force buffers,
  skip no-op reaction output buffers, and keep G2P as the authoritative
  mechanical state across thermo-only passes. Post-reset browser evidence now
  shows all four continued substeps with active grid nodes and visible
  displacement instead of substep 1+ collapsing to zero.
- [ ] Implement `plan/todo/reaction-stoichiometry-energetics-plan.md`: strict
  first-principles reaction energetics, balanced multi-product CPU/WebGPU
  reaction execution, gas byproduct routing, sealed-box pressure coupling, and
  reaction-closure cache reuse. Current slice complete: packed reactant,
  product, and gas-product rows are uploaded/restored with the reaction table;
  the resident CPU reference computes limiting extent, excess-reactant
  leftovers, event heat, and visible/unplaced product ledgers; the WGSL resolve
  pass now consumes reactant/product term rows for fixed-buffer product
  emission. Current resident slice complete: no-full-readback reaction steps
  produce a 128-byte compact GPU summary with canonical event count, consumed
  mass, visible/unplaced product mass, gas mass/moles, heat, and residuals; the
  demo can derive sealed-box pressure from that resident summary under a
  guarded single gas-species path. Current per-gas slice complete: a separate
  32-byte-per-gas-product compact resident ledger reports material id, mass,
  moles, visible/unplaced mass, event count, gas-product index, and status; the
  demo pressure diagnostic now consumes the per-species GPU ledger for multiple
  gas products before using aggregate fallback. Current product/residual slice
  complete: product-inventory rows and atom/charge residual rows are emitted by
  compact WebGPU summary passes without full particle readback, preserved in
  resident diagnostics, and surfaced in the SPH overlay. Current strict
  gate/pressure slice complete: compact summaries now carry a strict reaction
  gate for atom/charge/provisional-energetics blockers, and gas-pressure
  summaries carry a gauge-pressure six-wall force ledger whose force coupling is
  blocked when strict gates fail or when pressure gradients/normals are not yet
  resolved. Current renderable-storage slice complete: no-full-readback
  reaction steps can retain a sparse particle-major product-event WebGPU buffer
  without copying it back to JavaScript, and resident diagnostics/overlay rows
  expose its capacity, active verification rows, bytes, and lifetime status.
  Current render bridge complete: the SPH render-field ABI can bind the
  retained product-event buffer, and the scene adds generic product-inventory
  surface descriptors so unplaced event products render as spawned volume
  without sparse event readback. Current pressure bridge complete: gas pressure
  can derive gas products from the per-species gas ledger, product-event
  readback rows, or compact product-inventory rows without full particle
  readback. Current resident-mass contract complete:
  `peercompute.ulg.sph-resident-product-mass.v0` exposes the retained
  product-event buffer, row count/stride, unplaced mass, gas mass, consumption
  policy, and guarded destruction to downstream kernels. Current P2G sidecar
  slice complete: repeated resident steps carry the resident product-mass handle
  into the next P2G stage, P2G binds product-event rows as read-only storage,
  and unplaced product mass contributes to grid mass without double-counting
  visible emitted products. Current mechanics/EOS product-event slice complete:
  product-event rows now carry closure-derived product velocity, support volume,
  bulk/shear/Lame constants, sound speed, EOS model id, solid flag, and mechanics
  status, and P2G consumes those fields for product-event momentum and local EOS
  pressure when support volume is present. Remaining: validated gas-cell or
  pressure-gradient force coupling and GPU append/compaction for multiple
  generations of unplaced resident products.
- [ ] Implement `plan/todo/phase-resolved-steam-optics-plan.md`: phase/state
  keyed optical closures, H2O vapor vs condensed-droplet steam scattering,
  state-bucketed optical cache invalidation, and GPU-resident optical lookup
  plumbing.
- [ ] Implement `plan/todo/cold-start-cache-performance-plan.md`: persist and
  reuse reaction/product closures, stop bypassing reaction cache for
  material-property-backed discovery, persist thermal/optical/static table and
  GPU warmup artifacts where valid, expose timing/cache diagnostics for worker
  rebuilds, and add a visible SPH `clear cache` control. First slice complete:
  material-property-backed `discoverReactions()` cache keys, persisted
  reaction/product cold-start records, worker-first SPH startup diagnostics,
  low-FPS CPU-derivation warning messaging, cached interactive Step/Play
  rebuilds, and the `clear cache` button are live. Remaining:
  GPU upload/warmup persistence, stale-record browser probes, measured
  cold/warm/clear deltas, and the long 0.1 FPS cold-start period.
- [ ] Implement `plan/todo/webgpu-material-property-resolvers-plan.md`: move
  expensive material-property resolver families from JavaScript into
  WebGPU-resident kernels/flat closure graphs with worker/PeerCompute fallback,
  including relativistic optics, element/compound thermomechanics, reactions,
  radiation/nuclear effects, cache provenance, and visible CPU fallback
  warnings. First slice complete: an additive
  `src/runtime/material/materialResolverManifest.js` scaffold now enumerates
  the resolver family inventory, CPU anchors/status, WebGPU residency targets,
  cache key ingredients, status labels, and explicit false validation flags.
- [ ] Follow `plan/todo/overarching-completion-plan.md` as the active ordering
  plan for the remaining ULG, SPH, material resolver, performance, reaction,
  steam/gas, nuclear/radiation, PeerCompute, Eshkol, MoonLab, and tooling todo
  items.
- [ ] Add the hot-loop WebGPU-Ocean/marching-cubes performance slice from
  `plan/todo/perf-upgrade.md`: fixed-point/tiled GPU P2G where appropriate,
  GPU cell/neighbor structures, and GPU-resident marching cubes for continuous
  material volumes after pressure/steam contracts stabilize and before
  returning to cold-start timing polish.
- [ ] Replace provisional candidate energetics and heavy product-closure
  derivations with cached worker/WebGPU-resident lower-level solvers for the
  full element/compound reaction space.
- [ ] Keep the dev server running for live inspection.

### PeerCompute

- [x] Review current multiscale runtime and remote-placement branch work.
- [x] Map existing NodeKernel and ComputeManager surfaces to ULG service hosting.
- [x] Add reusable headless service orchestration modules after the ULG app slice is stable.
- [x] Accept ULG MoonLab/Eshkol magnetar handoffs in Multiscale and clear the
  reduced calibrated runtime evidence gate with five hash-backed entries.
- [x] Promote the browser demo handoff into
  `peercompute.ulg.handoff-service-envelope.v0` with content-addressed refs,
  relay-safe counts, transfer manifest preservation, and provenance.
- [x] Add PeerCompute's first envelope-backed ULG service host so
  `WorkerSupervisor` can normalize/store durable handoff envelopes through its
  artifact cache.
- [x] Add PeerCompute's first envelope-backed dispatch plan so durable handoff
  envelope refs become concrete Eshkol/MoonLab service tasks with relay-safe
  artifact refs and transferred WASM metadata.
- [x] Add PeerCompute's registry-backed supervisor executor so dispatch tasks
  can be submitted to registered MoonLab/Eshkol service hosts.
- [x] Materialize normalized ULG artifact payloads in supervisor-submitted
  PeerCompute dispatch service tasks while keeping dispatch plans ref-based.
- [x] Add exported PeerCompute MoonLab/Eshkol dispatch service adapters that
  consume those materialized payloads under `WorkerSupervisor`.
- [x] Expose and verify Multiscale browser Worker execution for the exported
  dispatch adapters through `runUlgDispatchServiceAdapterProbe()`.
- [x] Add MoonLab payload and Eshkol WASM compile probes behind the dispatch
  adapter Worker contract.
- [x] Add metadata-only Eshkol descriptor contract probes so descriptor-ready
  closures can dispatch without requiring transferred WASM bytes.
- [x] Add Eshkol host-runtime dry probes that instantiate complete descriptor
  WASM with inert imports while keeping `main` uninvoked.
- [x] Add gated Eshkol smoke runtime execution behind explicit output-semantics
  preflight without promoting descriptor handoffs to scientific execution.
- [x] Verify PeerCompute adapter Workers execute the real ULG-staged Eshkol
  `hello` smoke closure handoff, validate stdout semantics, and keep
  `scientificExecution = false`.
- [x] Surface the Eshkol magnetar descriptor's reduced interpolation-table
  fixture through ULG artifact summaries and PeerCompute adapter probes while
  keeping `scientificValidation = false`.
- [x] Add guarded runtime-smoke output semantics to the default Eshkol magnetar
  descriptor handoff and verify PeerCompute validates stdout without promoting
  it to scientific execution.
- [x] Expose the derived handoff dispatch plan through the live Multiscale
  browser API for VPN inspection.
- [x] Validate Eshkol descriptor tensor-runtime contracts in dispatch adapter
  probes and service summaries without promoting them to scientific execution.
- [x] Accept Eshkol deterministic tensor-offset runtime-smoke handoffs in
  Multiscale browser and relay smokes while keeping production handler and full
  physics validation blocked.
- [x] Surface Eshkol production-handler boundary metadata in PeerCompute
  dispatch adapters, supervisor summaries, Multiscale ingestion, and browser UI
  without promoting handler/runtime/scientific readiness.
- [x] Surface Eshkol production-host candidate and production dispatch preflight
  metadata through PeerCompute artifact summaries, dispatch ingest, supervisor
  summaries, Multiscale readiness, and packet boundary conditions without
  promoting smoke stubs to production runtime readiness.
- [x] Run relay-backed focused PeerCompute runtime P2P smoke and preserve
  generated relay configs after the test.
- [x] Add relay-backed ULG handoff dispatch diagnostics so adapter-enabled relay
  smoke records the popup context reset instead of failing as an unstructured
  Playwright crash.
- [x] Fix relay-served popup dispatch adapter execution so the optional relay
  smoke reaches adapter `dispatch-complete` without relaxing runtime or
  scientific gates.
- [x] Add Eshkol tensor-runtime candidate probes in PeerCompute and reverify
  browser plus relay-dispatch ULG handoffs against the latest staged artifacts.
- [ ] Start from `ComputeManager`, `NodeKernel`, `SolverRegistry`, relay tooling,
  NetViz telemetry, and Multiscale ULG schemas.
- [ ] Replace demo-local scheduling/GPU/artifact substitutes with explicit service
  lifecycle, child-worker leases, GPU leases, cancellation trees, content-addressed
  artifacts, and provenance indexes.
- [ ] Extend Eshkol descriptor probing from deterministic table-fixture evidence
  to controlled magnetar closure execution once the runtime contract is ready.

### Eshkol

- [x] Identify compiler/runtime points for ULG closure manifests and WASM exports.
- [x] Prototype closure artifact generation using the shared ABI contract.
- [x] Add ABI-level WGSL/table strategy descriptor emission after descriptor
  conformance stabilized.
- [x] Fold in the Eshkol sidecar report.
- [ ] Start from `eshkol-run` CLI `--wasm`/target/export paths, `llvm_backend.h`,
  `llvm_codegen.cpp`, GPU memory/VM dispatch APIs, and existing web/GPU scripts.
- [x] Add closure artifact JSON emission and named WASM reference export/import
  discovery for the current AOT WASM path.
- [x] Add manual closure-bundle export/deploy helper support to the ULG
  browser-facing service asset convention.
- [x] Add deterministic reduced interpolation-table fixture metadata to the
  magnetar descriptor artifact without claiming validated physics.
- [x] Add metadata-level typed closure tensor runtime descriptors to the
  magnetar fixture, including sample-shape validation and contract hash.
- [x] Add production-handler boundary metadata to the magnetar closure fixture
  and reject unsupported runtime/full-physics overclaims.
- [x] Add concrete smoke-only tensor linear-memory layout metadata and
  host-import validation while keeping the WASM entry export disconnected from
  tensor offsets.
- [x] Execute deterministic host-runtime tensor-offset smoke for the magnetar
  closure entry export while preserving production-handler and full-physics
  blockers.
- [x] Add production dispatch preflight metadata to the magnetar closure fixture
  so ULG and PeerCompute can reject deterministic runtime-smoke stubs at the
  production handler boundary.
- [x] Add computed production dispatch preflight `checkResults`/`checkSummary`
  evidence to exported magnetar closure artifacts without promoting production
  handler/runtime/full-physics readiness.
- [x] Add declared production handler contract metadata to exported magnetar
  closure artifacts so ULG and PeerCompute can hand off the production entry
  ABI, tensor offsets, required evidence, and remaining blockers without
  claiming the production handler has been implemented.
- [x] Add language-level `define-ulg-closure` syntax and service-worker import
  glue on top of the stabilized artifact contract.
- [x] Add declared full-physics validation requirements to exported magnetar
  closure artifacts, including the required MHD, PIC, radiation, relativity, and
  cross-family conservation evidence families, without clearing the production
  full-physics blocker.
- [x] Prefer WGSL/table descriptor emission for closure interpolation instead of a
  general LLVM-to-WGSL compiler.
- [ ] Avoid JIT service paths until the observed derivative/JIT hang is profiled.

### MoonLab

- [x] Identify JS/WASM/WebGPU bindings that can emit ULG quantum response artifacts.
- [x] Prototype service worker bootstrap around existing MoonLab core exports.
- [x] Add deterministic CPU/WebGPU parity artifact surface with explicit
  unsupported WebGPU parity reporting.
- [x] Fix JS unit regressions and WASM dist packaging before real service integration.
- [ ] Add browser WebGPU complex64/parity kernels to replace the current
  unsupported parity report.
- [x] Add ULG/browser smoke that verifies MoonLab `locateFile`/WASM asset probe
  wiring and consumes the published service fixtures in a browser worker.
- [x] Copy generated MoonLab core artifacts into ignored local service assets and
  verify live browser asset probe readiness.
- [x] Wrap a minimal MoonLab core task in a supervised service worker using the
  ready asset path.
- [x] Surface the MoonLab `magnetar-dipole-ising-calibration` handoff through
  the ULG browser artifact cache as a WASM-vs-JS parity-checked calibration
  sub-artifact.
- [x] Surface the MoonLab `moonlab.magnetar-dipole-ising-reference.v0`
  tolerance/reference contract through the ULG artifact body, compact
  artifact-summary telemetry, and demo handoff packet.
- [x] Preserve MoonLab tolerance/reference contracts as plural
  `outputs.references[]` entries in the ULG artifact body, compact summary, UI
  status line, and demo handoff packet while keeping `outputs.reference` as a
  compatibility alias.
- [x] Preserve MoonLab's calibrated magnetosphere MHD, PIC kinetic plasma,
  radiation transport, and relativistic correction inventory in raw
  `outputs.references[]` while compact summaries count the singular ready Ising
  reference plus calibrated-family readiness.
- [x] Promote the magnetosphere MHD inventory entry to a scoped analytic dipole
  field reference with solver id, SHA-256 contract/unit hashes, field maps,
  tolerances, observed deltas, and pass validation.
- [x] Declare optional MoonLab calibrated reference-contract JSON assets and
  merge valid supplied reference contracts into the browser core probe inventory
  without blocking loader/WASM readiness when the optional file is absent.
- [x] Stage the reduced MoonLab PIC, radiation, and relativity reference
  contracts in the ignored service-asset directory and verify the live
  ULG-to-PeerCompute magnetar handoff reports `scientific-tolerance-suite-ready`
  while keeping runtime scientific execution blocked.
- [x] Add a reproducible `npm run stage:service-assets` command for refreshing
  ignored MoonLab browser assets and the Eshkol `hello` closure bundle from the
  sibling repos.
- [x] Surface the same handoff through compact ULG artifact-summary telemetry for
  direct PeerCompute/Multiscale scenario ingestion.
- [x] Surface staged Eshkol closure execution metadata through compact ULG
  artifact-summary telemetry for direct PeerCompute/Multiscale scenario
  execution handoff.
- [x] Verify PeerCompute/Multiscale accepts descriptor-only Eshkol magnetar
  closure handoffs as packaging/probe prerequisites while preserving
  `proxy-runtime-not-scientific`.
- [x] Bind Eshkol's descriptor-only magnetar closure metadata to the durable
  PeerCompute handoff envelope, MoonLab normalized reference-suite hash, closure
  surface sample ids, and product-topology binding without claiming scientific
  validation.
- [x] Add a reduced MoonLab WebGPU complex64 parity-scope artifact with browser
  backend-acquired evidence and executed/passing reduced
  `compute_probabilities`, `hadamard`, `pauli_x`, `pauli_z`, and `cnot` probes.
- [ ] Update the PeerCompute receiver to accept MoonLab's successful reduced
  browser WebGPU parity-scope evidence without treating it as a full-runtime or
  full-physics claim.

### Tooling

- [x] Use ICC registry/status/architecture summaries for MoonLab and peercompute.
- [x] Use sidecar agents for MoonLab, Eshkol, peercompute, and ICC/swarm.
- [x] Ensure ICC parser dependencies are available before refreshing indexes.
- [x] Register `eshkol` and `ulg` with ICC when persistent tool artifacts are wanted.
- [x] Add a ULG repo-local `.icc/` configuration modeled on Eshkol's policy
  layout, plus `npm run icc:update` to refresh the ICC index, memory, status,
  and architecture snapshot into `.icc`.
- [x] Rewrite repo-local `.icc` policy docs so the editable configuration reads
  as ULG-native policy rather than copied sibling-repo wording.
- [x] Add a user Codex `icc` skill at `/home/cos/.codex/skills/icc/SKILL.md`
  so future sessions can trigger the ICC workflow from skill metadata.
- [x] Write the 2026-06-12 repo-root todo handoff at `todo-handoff-6-12.md`.
- [ ] Use swarm lightly for status/context until a ULG-specific profile exists.

## Integration Rule

PeerCompute remains the orchestration authority. Eshkol and MoonLab services do
not own networking, GPU scheduling, or child worker spawning outside PeerCompute
leases.
