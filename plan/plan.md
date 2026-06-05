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
- [ ] Keep the dev server running for live inspection.

### PeerCompute

- [x] Review current multiscale runtime and remote-placement branch work.
- [x] Map existing NodeKernel and ComputeManager surfaces to ULG service hosting.
- [ ] Add or refactor reusable orchestration modules after the ULG app slice is stable.
- [ ] Start from `ComputeManager`, `NodeKernel`, `SolverRegistry`, relay tooling,
  NetViz telemetry, and Multiscale ULG schemas.
- [ ] Replace demo-local scheduling/GPU/artifact substitutes with explicit service
  lifecycle, child-worker leases, GPU leases, cancellation trees, content-addressed
  artifacts, and provenance indexes.

### Eshkol

- [x] Identify compiler/runtime points for ULG closure manifests and WASM exports.
- [x] Prototype closure artifact generation using the shared ABI contract.
- [ ] Add WGSL/table strategy emitter only after descriptor conformance is stable.
- [x] Fold in the Eshkol sidecar report.
- [ ] Start from `eshkol-run` CLI `--wasm`/target/export paths, `llvm_backend.h`,
  `llvm_codegen.cpp`, GPU memory/VM dispatch APIs, and existing web/GPU scripts.
- [x] Add closure artifact JSON emission and named WASM reference export/import
  discovery for the current AOT WASM path.
- [ ] Add `define-ulg-closure`, typed closure tensor descriptors, and
  service-worker import glue after the artifact contract stabilizes.
- [ ] Prefer WGSL/table descriptor emission for closure interpolation instead of a
  general LLVM-to-WGSL compiler.
- [ ] Avoid JIT service paths until the observed derivative/JIT hang is profiled.

### MoonLab

- [x] Identify JS/WASM/WebGPU bindings that can emit ULG quantum response artifacts.
- [ ] Prototype service worker bootstrap around existing MoonLab core exports.
- [ ] Add deterministic CPU/WebGPU parity artifact surface.
- [ ] Fix JS unit regressions and WASM dist packaging before real service integration.
- [ ] Add browser WebGPU complex64/parity kernels with unsupported fallback reporting.

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
