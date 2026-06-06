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
- [x] Surface Eshkol `validation.outputSemantics` smoke-fixture metadata through
  compact artifact-summary telemetry and the browser handoff packet without
  marking the closure scientifically validated.
- [x] Surface Eshkol `validation.closureDescriptor` magnetar fixture metadata
  through compact artifact-summary telemetry and the browser handoff packet,
  preserving transferred WASM bytes while keeping descriptor-only closures out
  of host-runtime/output-smoke execution.
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
- [ ] Start from `ComputeManager`, `NodeKernel`, `SolverRegistry`, relay tooling,
  NetViz telemetry, and Multiscale ULG schemas.
- [ ] Replace demo-local scheduling/GPU/artifact substitutes with explicit service
  lifecycle, child-worker leases, GPU leases, cancellation trees, content-addressed
  artifacts, and provenance indexes.
- [ ] Wire real ULG/Eshkol/MoonLab worker services into the new supervisor and
  adapter layer.

### Eshkol

- [x] Identify compiler/runtime points for ULG closure manifests and WASM exports.
- [x] Prototype closure artifact generation using the shared ABI contract.
- [ ] Add WGSL/table strategy emitter only after descriptor conformance is stable.
- [x] Fold in the Eshkol sidecar report.
- [ ] Start from `eshkol-run` CLI `--wasm`/target/export paths, `llvm_backend.h`,
  `llvm_codegen.cpp`, GPU memory/VM dispatch APIs, and existing web/GPU scripts.
- [x] Add closure artifact JSON emission and named WASM reference export/import
  discovery for the current AOT WASM path.
- [x] Add manual closure-bundle export/deploy helper support to the ULG
  browser-facing service asset convention.
- [ ] Add `define-ulg-closure`, typed closure tensor descriptors, and
  service-worker import glue after the artifact contract stabilizes.
- [ ] Prefer WGSL/table descriptor emission for closure interpolation instead of a
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

### Tooling

- [x] Use ICC registry/status/architecture summaries for MoonLab and peercompute.
- [x] Use sidecar agents for MoonLab, Eshkol, peercompute, and ICC/swarm.
- [ ] Run `make install-parsers` in ICC before refreshing indexes.
- [ ] Register `eshkol` and `ulg` with ICC when persistent tool artifacts are wanted.
- [ ] Use swarm lightly for status/context until a ULG-specific profile exists.

## Integration Rule

PeerCompute remains the orchestration authority. Eshkol and MoonLab services do
not own networking, GPU scheduling, or child worker spawning outside PeerCompute
leases.
