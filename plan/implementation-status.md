# Implementation Status

Updated: 2026-06-06 01:25:01 AKDT

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
- Copied generated MoonLab core artifacts into the ignored local runtime
  directory `public/service-assets/moonlab/`. The live browser worker now reports
  MoonLab asset probe status `ready`, with JS served as `text/javascript` and
  WASM served as `application/wasm`.
- MoonLab `ulg` branch now has local commit `5ce415f` exporting
  `quantum_state_create`/`quantum_state_destroy` to the core WASM runtime so
  browser workers can allocate/free states without knowing the C struct layout.
- Added tracked ULG classic child worker
  `public/workers/moonlab-core-probe.worker.js`. When MoonLab assets are ready,
  the supervised root service leases that worker, instantiates `MoonlabModule`
  with `locateFile`, creates a Bell `phi_plus` state in the real WASM module,
  and records `[0.5, 0, 0, 0.5]` basis probabilities in the MoonLab artifact.
- Verified the live VPN demo at `http://100.86.83.35:5173/` reports MoonLab
  `method = moonlab-wasm-bell-phi-plus-probe`, `coreProbe = ready`, and
  `validation = pass`.
- Extended the MoonLab task artifact with
  `peercompute.ulg.quantum-response-descriptor.v0` and
  `peercompute.ulg.quantum-response-parity.v0`, including a passing
  `moonlab-wasm-core` comparison against the analytic Bell `phi_plus`
  probability vector and an explicit unsupported `moonlab-webgpu` parity entry.
- Extended the same supervised MoonLab core probe with
  `peercompute.ulg.magnetar-dipole-ising-calibration.v0`. The browser worker
  now uses MoonLab WASM Ising exports to evaluate the normalized magnetar dipole
  calibration handoff, records eight bitstring energies, reports ground state
  `000`, and passes JavaScript reference parity with `maxEnergyDelta = 0`.
- Added `peercompute.ulg.artifact-summary.v0` telemetry summaries to the local
  artifact cache. Browser telemetry now exposes quantum-response descriptor
  readiness, parity status, unsupported parity modes, and MoonLab magnetar
  calibration readiness without requiring consumers to fetch the full artifact
  body.
- Added an Eshkol closure-bundle service asset convention and readiness probe
  for bundles exported by `scripts/export_ulg_closure_bundle.py`. The current
  live demo can report the ignored local `hello` bundle as ready when copied
  under `public/service-assets/eshkol/closures/hello/`.
- Updated the supervised Eshkol worker to return the staged closure bundle
  artifact when the bundle is ready, with dummy closure output kept as the
  missing-asset fallback.
- Extended compact artifact-summary telemetry with Eshkol closure-bundle fields:
  closure kind, module URL/hash, service-worker safety, dynamic-code flags,
  bundle manifest metadata, and `closureReady`.
- Extended compact artifact-summary telemetry with Eshkol closure execution
  handoff metadata: entry export/signature, start-section state, import/export
  counts, WASM metadata counts, and DOM-free host-import bundle metadata.
- Preserved `ulg_bundle_manifest.json.hostImports` through the supervised
  Eshkol worker artifact runtime and rendered `entry`, `imports`, and host
  factory details in the live artifact list.
- Verified `npm test`, `npm run build`, `npm run test:e2e`, and a live
  `http://100.86.83.35:5173/` artifact-cache probe after the Eshkol closure
  metadata telemetry update.
- Added `window.__ulgDemo.createPeerComputeHandoff()` to export the current ULG
  browser artifact cache as `peercompute.ulg.demo-handoff.v0`, including full
  artifact bodies, compact summaries, refs, and same-origin transferred Eshkol
  closure WASM bytes.
- Verified a live ULG-to-PeerCompute/Multiscale handoff: ULG exported four
  artifacts, transferred the 33,907-byte Eshkol `hello.wasm`, Multiscale ingested
  the MoonLab magnetar calibration and Eshkol closure bundle, executed
  `main(0, 0)` with result `0`, and kept `scenarioScientificReady: false` with
  only the expected scientific validation blockers.
- Added compact Eshkol closure output-semantics summary fields to ULG artifact
  telemetry and the browser handoff packet. The summary carries the deterministic
  `main(0, 0)` smoke-fixture expectation, stdout SHA-256/byte length, and
  `scientificValidation: false`.
- Added MoonLab magnetar dipole Ising reference/tolerance contract fields to the
  live ULG artifact, compact telemetry, and handoff packet. The summary now
  carries the MoonLab reference schema, contract hash, normalized energy units,
  ground-state reference energy, energy tolerance, observed energy delta, and
  pass status.
- Added plural `outputs.references[]` propagation for MoonLab reference/tolerance
  contracts while preserving the legacy `outputs.reference` alias. Compact
  artifact-summary telemetry now counts ready output references and the browser
  handoff packet carries the plural reference list.
- Updated the live ULG MoonLab core probe to mirror MoonLab's four-entry
  calibrated magnetosphere MHD, PIC kinetic plasma, radiation transport, and
  relativistic correction inventory in raw `outputs.references[]`. Compact
  telemetry now reports calibrated inventory counts separately while preserving
  the singular ready dipole-Ising reference as `outputs.reference`.
- Promoted the first calibrated-family entry to a scoped analytic
  `magnetosphere-mhd` dipole-field reference with solver id, field maps,
  tolerances, observed deltas, pass validation, and SHA-256 contract/unit hashes.
  PIC, radiation, relativity, and full MHD/force-free coverage remain blocked.
- Aligned the analytic reference's observed-delta keys with its tolerance keys
  and verified the live ULG-to-Multiscale VPN bridge counts it as one ready
  calibrated/scientific reference while keeping full magnetar scientific
  readiness blocked.
- Added optional MoonLab `magnetar-reference-contracts.json` service asset
  support. The service asset probe fetches and reports the optional JSON, but
  only loader/WASM assets are required for MoonLab readiness.
- Updated the supervised MoonLab core probe to load optional supplied calibrated
  reference contracts, merge only contracts that pass readiness validation, and
  treat missing Vite HTML fallback for the optional JSON as a non-blocking
  missing reference asset.

## In Progress

- Keep Vite live for inspection.
- Continue from the live state where optional MoonLab supplied-reference plumbing
  is in place, no optional reference JSON is currently staged, and the first
  ready calibrated `magnetosphere-mhd` analytic reference remains the only
  calibrated scientific coverage counted by PeerCompute/Multiscale.

## Next

- Stage or generate real calibrated MoonLab reference-contract JSON for
  PIC/radiation/relativity/full-MHD families and verify it through ULG and
  PeerCompute before clearing any scientific blockers.
- Promote the demo-only ULG handoff packet into a durable PeerCompute service
  adapter path with provenance, content addressing, and relay-safe transfer.
- Add real peercompute service-hosting modules or adapters based on the working
  ULG demo contract.
- Extend the Eshkol helper into language-level `define-ulg-closure` metadata and
  real closure tensor descriptors once the descriptor contract is stable.
- Add real MoonLab browser WebGPU quantum-response kernels so the current
  unsupported `moonlab-webgpu` parity entry can become an executed comparison.
- Wire real ULG/Eshkol/MoonLab worker services into the PeerCompute supervisor
  and then run the full peercompute relay-backed local stack.
