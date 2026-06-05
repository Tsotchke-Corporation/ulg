# Implementation Status

Updated: 2026-06-05 15:49:09 AKDT

## Done

- Read `agents.md`, `/home/cos/projects/AGENTS.md`, and the ULG v0.5 PDF.
- Spawned sidecar agents for MoonLab, Eshkol, peercompute, and ICC/swarm.
- Used ICC repo registry/status and architecture summaries for MoonLab and peercompute.
- Added a vanilla Vite/three.js ULG app.
- Added shared ULG GPU ABI descriptors and JSON schemas.
- Added PeerCompute-style service registry, child-worker leases, GPU broker,
  artifact cache, worker supervisor, dummy Eshkol/MoonLab service workers, and
  browser telemetry.
- Added unit tests and Playwright smoke coverage.
- Verified `npm test`, `npm run build`, and `npm run test:e2e`.
- Added `@ulg/gpu-abi/service-contract` builders for Eshkol/MoonLab service
  manifests and task capsules.
- Added cross-repo adapter README and static Eshkol/MoonLab manifest/task
  fixtures under `ulg-gpu-abi/examples/`.
- Refactored the demo runtime to consume the shared service contract builders
  instead of maintaining private manifest/task construction.
- Confirmed no copied `peercompute/` source subtree remains in the ULG checkout;
  PeerCompute-owned service orchestration stays in `/home/cos/projects/peercompute`.
- Verified `npm test`, `npm run build`, and `npm run test:e2e` after the contract
  refactor.
- MoonLab sidecar completed: useful surfaces identified, but JS unit regressions,
  missing WASM dist packaging, and real browser WebGPU parity remain blockers.
- peercompute sidecar completed: current Multiscale/remote-placement tests and
  build pass; reusable targets are `ComputeManager`, `NodeKernel`, `SolverRegistry`,
  relay tooling, NetViz telemetry, and Multiscale ULG schemas.
- ICC/swarm sidecar completed: ICC has MoonLab/peercompute indexes; refreshes need
  parser installation; swarm should be used lightly until a ULG profile exists.
- Eshkol sidecar completed: the compiler can build and emit WASM hello output,
  but browser WebGPU/WGSL support does not exist yet and the service path should
  avoid JIT until the observed derivative hang is understood.
- Added the Eshkol-side `scripts/emit_ulg_closure_artifact.py` helper on the
  `ulg` branch. It compiles `.esk` through `eshkol-run --wasm` or inspects an
  existing `.wasm`, parses WASM imports/exports, and emits a ULG v0.5
  service-worker-safe closure artifact JSON file.
- Added Eshkol CTest coverage for the helper and verified the generated artifact
  against the ULG closure artifact schema.
- MoonLab `ulg` branch now has local commit `2461d15` fixing core JS/WASM
  readiness blockers: unit regressions, WASM dist packaging, Emscripten runtime
  readiness, JS/WASM ABI issues, integration-test bit ordering, and documented
  pure-state purity behavior.
- Verified `bindings/javascript/packages/core/dist/moonlab.js` and
  `moonlab.wasm` exist after the MoonLab core build.
- PeerCompute `multi-scale-physics-sim` branch now has local commit `975c23e1`
  adding reusable service orchestration primitives: `ComputeServiceRegistry`,
  `ChildWorkerLeaseManager`, `WorkerSupervisor`, and
  `ComputeManagerServiceAdapter`.
- PeerCompute service orchestration tests passed headlessly and the package is
  exported through the public peercompute index.
- Added the browser-facing `public/service-assets/` convention for copied
  MoonLab/Eshkol artifacts without copying sibling repo source.
- Added MoonLab service asset manifest helpers and worker-side probes for
  `moonlab.js`, `moonlab.wasm`, expected WASM MIME, and
  `locateFile("moonlab.wasm")` resolution.
- Added service telemetry for asset probe status and a browser worker smoke that
  consumes the published MoonLab service manifest/task fixtures.
- Verified `npm test`, `npm run build`, `npm run test:e2e`, and
  `git diff --check` after the asset-probe slice.

## In Progress

- Keep Vite live for inspection.
- Use the published ABI fixtures and the Eshkol ULG closure artifact helper as
  the next adapter handshake for PeerCompute, Eshkol, and MoonLab.

## Next

- Add real peercompute service-hosting modules or adapters based on the working ULG
  demo contract.
- Extend the Eshkol helper into language-level `define-ulg-closure` metadata and
  real closure tensor descriptors once the descriptor contract is stable.
- Prototype MoonLab quantum response artifact output now that core WASM artifacts
  can be copied into `public/service-assets/moonlab/` and probed by the browser
  worker.
- Wire real ULG/Eshkol/MoonLab worker services into the PeerCompute supervisor
  and then run the full peercompute relay-backed local stack.
