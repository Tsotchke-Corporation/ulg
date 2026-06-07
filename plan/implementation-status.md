# Implementation Status

Updated: 2026-06-06 17:45:00 AKDT

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
- Staged the MoonLab reduced calibrated reference-contract suite in the ignored
  manual service-asset directory and hardened the core probe loader to accept
  array, suite `references[]`, and full-artifact `outputs.references[]` JSON
  shapes.
- Verified the live ULG handoff at `http://100.86.83.35:5173/` now carries two
  artifacts: MoonLab with `outputReferenceReadyCount = 5` and
  `magnetarCalibratedReferenceReadyCount = 4`, plus Eshkol with
  `closureReady = true` and `33907` transferred WASM bytes.
- Verified the live PeerCompute magnetar page at
  `https://100.86.83.35:5185/?scenario=magnetar` accepts the ULG handoff as
  `handoff-ready` with `2/2` required handoffs ready and
  `scientific-tolerance-suite-ready`. The remaining scientific blocker is
  `proxy-runtime-not-scientific`.
- Added `npm run stage:service-assets` to refresh ignored MoonLab and Eshkol
  browser assets from sibling repos. The command copies MoonLab JS/WASM,
  generates the normalized MoonLab reference suite, and regenerates the Eshkol
  `hello` closure bundle with deterministic smoke output-semantics metadata.
- Added optional `--created-at` / `ULG_STAGE_CREATED_AT` pass-through for Eshkol
  bundle exports when byte-stable closure artifact and manifest timestamps are
  needed.
- Recorded sidecar completions: Eshkol commit `f942f31` adds reproducible ULG
  closure bundle timestamps, and PeerCompute commit `c0610ca7` hardens the
  magnetar scientific runtime evidence gate.
- Re-verified the live VPN ULG-to-PeerCompute handoff after the stricter
  PeerCompute gate: handoff and tolerance suite remain ready, runtime evidence
  remains five proxy-only entries, and scientific readiness remains correctly
  blocked by `proxy-runtime-not-scientific`.
- Updated the ULG staging command to generate MoonLab's normalized calibrated
  reference suite through MoonLab's `pnpm ulg:artifact -- --normalize-references`
  path instead of raw-copying reference JSON. The staged browser asset now has
  schema `moonlab.magnetar.normalized-reference-suite.v0`, status
  `reference-contract-suite-ready`, and four ready calibrated families.
- Replaced the staged Eshkol `hello` smoke bundle in ULG with Eshkol's
  `magnetar-closure` descriptor fixture. The ULG service manifest now targets
  `/service-assets/eshkol/closures/magnetar-closure/`, staging exports
  `magnetar-closure.wasm`, and artifact summaries expose
  `closureDescriptorReady` separately from smoke `closureOutputSemanticsReady`.
- Re-verified the live VPN ULG-to-PeerCompute handoff after normalized-suite
  staging and Eshkol magnetar descriptor staging: ULG exported MoonLab `5/5`
  ready output references and Eshkol `53066` transferred WASM bytes for the
  `magnetar-closure` descriptor fixture; PeerCompute reported `handoff-ready`,
  `scientific-tolerance-suite-ready`, descriptor probe ready, no host-runtime or
  output-semantics execution claim for the descriptor path, and only the intended
  `proxy-runtime-not-scientific` scientific blocker.
- Integrated and committed the PeerCompute descriptor-closure acceptance sidecar
  locally as commit `2f694522`. Descriptor-ready Eshkol closure fixtures now
  clear closure packaging/probe prerequisites with or without transferred WASM
  bytes, preserve those bytes in the transfer manifest, and do not clear
  scientific readiness.
- Added and committed PeerCompute reduced calibrated runtime evidence locally:
  commit `d0dbe1f5` validates the four solver-family runtime entries against
  MoonLab calibrated references, and commit `df4ea25a` derives the fifth
  cross-family conservation/coupling validation from packet telemetry.
- Verified the live VPN ULG-to-PeerCompute path now reaches reduced calibrated
  magnetar runtime readiness: ULG exports the MoonLab reference suite and
  Eshkol descriptor handoff, PeerCompute reports `runtime-evidence-ready`,
  `validatedCount = 5`, `scientific-runtime-ready`,
  `scenarioScientificReady = true`, and no blockers after
  `refreshScenarioCalibratedRuntimeEvidence()`.
- Added and committed PeerCompute durable handoff service-envelope support
  locally as commit `fbcc4f17`. `peercompute.ulg.handoff-service-envelope.v0`
  wraps the ULG demo handoff with content-addressed artifact refs, transfer
  manifest, relay-safe counts, source/provenance metadata, and blockers; the
  live VPN bridge reports envelope ready with two relay-safe/content-addressed
  artifacts and no blockers.
- Added and committed PeerCompute materialized dispatch artifact payload support
  locally as commit `697f8d8b`. Registered service-host dispatch tasks now carry
  `peercompute.ulg.handoff-dispatch-artifact-payload.v0` with normalized artifact
  bodies/summaries and transferred Eshkol WASM bytes while dispatch plans remain
  ref-based.
- Added and committed PeerCompute dispatch service adapters locally as commit
  `4d45714b`. `UlgDispatchServiceHost` and MoonLab/Eshkol manifest helpers now
  validate and cache materialized dispatch payloads through `WorkerSupervisor`
  without relying on private fixture service hosts.
- Added and committed Multiscale dispatch adapter worker execution locally as
  PeerCompute commit `c198326c`. The live `5185` API now runs ULG handoffs
  through browser MoonLab/Eshkol adapter Workers and caches nested dispatch
  acceptance artifacts.
- Added and committed PeerCompute dispatch adapter probe logic locally as commit
  `0eae0a68`. The live Eshkol adapter Worker now compiles the transferred
  `53066`-byte descriptor WASM module and records `33` imports, `1` export, and
  `main` export availability without clearing scientific validation.
- Added and committed PeerCompute descriptor-aware Eshkol dispatch probes
  locally as commit `7cae7660`. Descriptor-ready closures can now dispatch as
  metadata-only `eshkol.ulg.closure.descriptor-bind` tasks without transferred
  WASM bytes, while closure-artifact ingest still compiles complete modules and
  records descriptor contract readiness.
- Added and committed PeerCompute Eshkol host-runtime dry probes locally as
  commit `b00ac043`. The live Eshkol adapter Worker now dry-instantiates the
  `53066`-byte descriptor WASM module with inert host-import stubs, confirms the
  `main` export is available, records `30` function stubs plus memory/global/table
  stubs, and keeps `mainInvoked = false` and `scientificExecution = false`.
- Added and committed PeerCompute gated Eshkol smoke runtime execution locally as
  commit `8259ecb6`. The adapter now invokes `main` only after an explicit
  `eshkol.ulg.closure-output-semantics.v0` smoke preflight passes; the live
  magnetar descriptor handoff remains dry-only, while a browser smoke fixture
  executes `main`, returns `0`, validates output semantics, and still reports
  `scientificExecution = false`.
- Added a separate ULG browser handoff API,
  `window.__ulgDemo.createPeerComputeEshkolSmokeHandoff()`, that keeps the
  default Eshkol service on the magnetar descriptor fixture while exporting the
  staged `hello` closure bundle plus the current MoonLab artifact as a real
  `peercompute.ulg.demo-handoff.v0` smoke packet. The packet carries the
  `33,907`-byte `hello.wasm`, merged bundle manifest/DOM-free host-import
  metadata, and explicit non-scientific output semantics.
- Verified the live ULG-to-PeerCompute smoke handoff on the VPN: ULG `5173`
  exports exactly two artifacts, PeerCompute Multiscale `5185` dispatches both
  through adapter Workers, Eshkol reports
  `host-runtime-output-semantics-validated`, invokes `main`, returns `0`,
  validates stdout hash
  `sha256:675d2e8686b6a85ffaa5751fba535c108d23ba941f1890d0a102619ec2cdf20d`,
  and keeps `scientificExecution = false`.
- Added and committed Eshkol magnetar descriptor binding metadata locally as
  commit `31cbbfc`. The staged Eshkol `magnetar-closure` artifact now carries
  `eshkol.ulg.magnetar-closure-descriptor-binding.v0`, names the durable
  PeerCompute envelope schema, binds to the MoonLab normalized reference suite
  hash `sha256:7d4e6372e49689d2202914e210af84d19d776dc6fbc5b7e08b19cbedfb71b455`,
  declares four MoonLab closure-surface samples, and keeps runtime/derivatives
  declared-not-executed/computed with `scientificValidation = false`.
- Added Eshkol reduced interpolation-table fixture evidence to the staged
  magnetar descriptor handoff. The browser-served `magnetar-closure` artifact
  now exposes `eshkol.ulg.magnetar-closure-interpolation-table.v0`,
  `status = computed-fixture`, four MoonLab-aligned sample ids, sample payload
  hash `sha256:82ca16463d7ffe1d170adb266be61c3959b22a6c352751e99f0f510738a14165`,
  and `scientificValidation = false`; ULG artifact summaries surface the same
  table status/count/hash for PeerCompute consumers.
- Added Eshkol magnetar runtime-smoke output semantics to the default staged
  descriptor artifact. The browser handoff now marks
  `closureOutputSemanticsReady = true` for `magnetar-closure`, with expected
  `main(0, 0) -> 0`, stdout hash
  `sha256:34a23605b7cacbeb83ef3391ae049c0bbcf38651b552eb9630eeca2165ca5768`,
  byte length `23`, and `scientificValidation = false`.
- Added and committed PeerCompute's first envelope-backed service host locally
  as commit `2776682d`. `UlgHandoffServiceHost` runs under
  `WorkerSupervisor`, accepts raw ULG demo handoff tasks, normalizes them to
  durable handoff envelopes, emits `peercompute.ulg.handoff-service-result.v0`,
  and stores the envelope artifact through the supervisor artifact cache.
- Added and committed PeerCompute's first envelope-backed service dispatch plan
  locally as commit `22feae0b`. Durable handoff envelopes now produce
  `peercompute.ulg.handoff-service-dispatch-plan.v0`, map MoonLab
  quantum-response refs to `moonlab.ulg.quantum-response.ingest`, map Eshkol
  closure refs to `eshkol.ulg.closure-artifact.ingest` or descriptor-bind tasks,
  and can optionally execute those dispatches through an injected service
  executor while preserving relay-safe/content-addressed/WASM-transfer metadata.
- Added and committed PeerCompute's registry-backed dispatch executor locally as
  commit `ae67d31e`. `createUlgHandoffSupervisorServiceExecutor()` submits
  dispatch tasks to registered MoonLab/Eshkol services through
  `WorkerSupervisor`, preserves nested service results in the handoff dispatch
  result, and proves fixture service hosts can execute behind the durable
  envelope boundary.
- Added and committed PeerCompute's Multiscale live dispatch-plan API locally as
  commit `fa33b97f`. `applyUlgDemoHandoffForScenario()` now returns
  `serviceDispatchPlan`, and
  `window.__multiscaleDemo.createUlgHandoffServiceDispatchPlan()` exposes the
  derived MoonLab/Eshkol service tasks for live VPN inspection.
- Hardened ULG artifact refs so `ArtifactCache` emits `sha256:` artifact URIs
  even on the non-secure HTTP VPN demo where `crypto.subtle` is unavailable.
  Live Multiscale dispatch plans now report `digestAddressed = true` for both
  MoonLab and Eshkol refs.
- Added end-to-end `ulg.magnetar.fidelity-runtime-scope.v0` propagation through
  ULG. MoonLab calibrated reference summaries and Eshkol descriptor-binding
  summaries now preserve fidelity/runtime scope metadata with
  `fullFidelityMagnetarSimulation = false` and `fullPhysicsValidation = false`.
- Hardened `npm run stage:service-assets` so ignored MoonLab/Eshkol browser
  assets fail staging when fidelity/runtime scope metadata is missing or
  overclaims full-fidelity/full-physics validation.
- Verified the strict live ULG-to-PeerCompute probe from `5173` to `5185`:
  ULG exported two scoped artifacts, PeerCompute returned
  `runtime-evidence-ready`, `validatedCount = 5`, `proxyOnlyCount = 0`,
  `missingCount = 0`, `scientificReady = true`, no blockers, tolerance-scope
  readiness for `pic-kinetic-plasma`, and explicit non-full-fidelity runtime
  scope flags.
- Recorded the next sidecar/local commits: Eshkol commit `6188573` adds
  `eshkol.ulg.magnetar-closure-tensor-runtime-contract.v0` to the magnetar
  descriptor fixture, PeerCompute commit `d5acd481` validates and summarizes
  that contract in dispatch adapter probes, and MoonLab commit `bf5d1d1`
  documents the remaining browser WebGPU complex64 parity blocker.
- Added ULG compact artifact-summary and staging guards for Eshkol tensor
  runtime contracts. ULG reports `closureTensorRuntimeContractReady = true`
  only when the contract schema, hash, tensor ids, interpolation-table binding,
  sample-shape validation, and non-scientific/full-physics flags line up.
- Verified the live ULG-to-PeerCompute path at `http://127.0.0.1:5173/` and
  `https://127.0.0.1:5185/?scenario=magnetar`: ULG and PeerCompute both report
  the tensor runtime contract ready, PeerCompute dispatch adapters are ready,
  calibrated runtime evidence remains `runtime-evidence-ready` with
  `validatedCount = 5`, and blocker count remains `0`.
- Added a direct browser launch bridge in ULG. The `Launch Magnetar` control
  opens PeerCompute Multiscale at `/?scenario=magnetar`, sends the existing ULG
  handoff over `postMessage`, retries during popup load, and stops once the
  Multiscale page acknowledges the import.
- Verified the direct live bridge from `http://127.0.0.1:5173/` to
  `https://127.0.0.1:5185/?scenario=magnetar`: ULG status
  `handoff ready / blockers 0`, Multiscale `handoff-ready`, blocker count `0`,
  `simulationStatus = scientific-ready`, and the magnetar proxy visual visible
  on the solar layer.
- Updated `npm run stage:service-assets` to call MoonLab normalized reference
  suite generation with `--canonical`.
- Aligned the Eshkol descriptor binding to the canonical MoonLab suite bytes
  ULG serves:
  `sha256:7d4e6372e49689d2202914e210af84d19d776dc6fbc5b7e08b19cbedfb71b455`.
- Verified staged Eshkol provenance now carries source hash
  `sha256:73f2a89ffe3434d995ffe1174185462cf0c2edb653fbe4d1286342b788763052`,
  WASM hash
  `sha256:38902bb4b3f5ed8abf513a4d739ff9ca99727696df271c3ff17127575785b947`,
  and the `magnetar_closure.ulg-metadata.json` source marker path.
- Re-verified the direct live ULG-to-Multiscale bridge after canonical staging:
  ULG status `handoff ready / blockers 0`, Multiscale `handoff-ready`, blocker
  count `0`, `simulationStatus = scientific-ready`, and the magnetar proxy
  visible on the solar layer.
- Recorded the next sidecar/local commits: PeerCompute `7fc6b7a3` hardens
  descriptor-aware table binding, PeerCompute `4d90f3b6` adds handler-backed
  ULG dispatch adapters, Eshkol `ca617e6` accepts language-level
  `define-ulg-closure` metadata forms, and MoonLab `ff6727a` adds
  `moonlab.webgpu.complex64-parity-scope.v0` reduced-fixture parity evidence.
- Refreshed ignored ULG service assets after the Eshkol/MoonLab commits.
  Staged artifacts still bind to MoonLab suite
  `sha256:7d4e6372e49689d2202914e210af84d19d776dc6fbc5b7e08b19cbedfb71b455`,
  Eshkol source
  `sha256:73f2a89ffe3434d995ffe1174185462cf0c2edb653fbe4d1286342b788763052`,
  and Eshkol WASM
  `sha256:38902bb4b3f5ed8abf513a4d739ff9ca99727696df271c3ff17127575785b947`.
- Re-verified the refreshed direct live ULG-to-Multiscale bridge after the
  sidecar commits: `npm test` passed `20/20`, `npm run test:e2e` passed `1/1`,
  and PeerCompute `npm --prefix demos/multiscale run test:ulg-handoff` reported
  `handoff-ready`, blocker count `0`, `simulationStatus = scientific-ready`,
  bridge ack `handoff-ready`, and the visible magnetar proxy on the solar layer.
- Added optional MoonLab `webgpu-complex64-parity-scope.json` service-asset
  staging. The ULG staging command now generates and validates MoonLab's
  `moonlab.webgpu.complex64-parity-scope.v0` reduced-fixture no-backend
  evidence while keeping the MoonLab loader/WASM assets as the only required
  runtime readiness assets.
- Verified the new parity-scope staging guard: `npm run stage:service-assets`
  generated parity-scope hash
  `sha256:8c10f99aaa0dc0f13c6bb3242befbe65bf8ff2d5acad610829017fb548dc83bc`,
  kept the MoonLab suite hash
  `sha256:7d4e6372e49689d2202914e210af84d19d776dc6fbc5b7e08b19cbedfb71b455`,
  kept the Eshkol WASM hash
  `sha256:38902bb4b3f5ed8abf513a4d739ff9ca99727696df271c3ff17127575785b947`,
  and preserved false full-fidelity/full-physics/WebGPU-executed claims.
- Re-verified the ULG checkpoint after parity-scope staging: `npm test` passed
  `20/20`, `npm run build` passed with the existing large-chunk warning,
  `npm run test:e2e` passed `1/1`, and PeerCompute
  `npm --prefix demos/multiscale run test:ulg-handoff` still reported
  `handoff-ready`, blocker count `0`, `simulationStatus = scientific-ready`,
  bridge ack `handoff-ready`, visible magnetar proxy, and the expected
  canonical/source/WASM hashes.
- Wired the optional MoonLab WebGPU complex64 parity-scope asset into the live
  ULG MoonLab worker artifact, compact artifact summaries, browser handoff
  packet, and artifact list UI. The artifact remains explicitly no-backend:
  `backendAvailable = false`, `webgpuParity.executed = false`,
  `webgpuParity.passed = false`, `fullFidelityMagnetarSimulation = false`, and
  `fullPhysicsValidation = false`.
- Verified the live VPN demo after parity-scope runtime wiring:
  `http://100.86.83.35:5173/` reports
  `moonlab.webgpu.complex64-parity-scope.v0` ready in the MoonLab handoff,
  shows `webgpu:no-backend` in the artifact list, and PeerCompute
  `npm --prefix demos/multiscale run test:ulg-handoff` still reports
  `handoff-ready`, blocker count `0`, `simulationStatus = scientific-ready`,
  bridge ack `handoff-ready`, and visible magnetar proxy.
- Integrated the PeerCompute parity-scope consumer sidecar locally as commit
  `c0a6d1af`. Multiscale and the handler-backed dispatch summaries now surface
  MoonLab WebGPU complex64 parity-scope evidence while preserving
  `backendAvailable = false`, `webgpuParityExecuted = false`,
  `webgpuParityPassed = false`, `fullFidelityMagnetarSimulation = false`, and
  `fullPhysicsValidation = false`, and without relaxing the scientific runtime
  gate.
- Integrated the PeerCompute relay-smoke checkpoint locally as commit
  `1e384104`. VPN coturn/backend dry-runs passed, and focused Hyperborea
  runtime P2P smoke started an isolated Go relay, connected headless browser
  peers, and exited with `Runtime P2P tests passed`.
- Integrated Eshkol's production-handler boundary sidecar commit `f06973c` into
  ULG staging, compact artifact summaries, browser handoff packets, and the
  artifact list UI. ULG now reports
  `closureProductionHandlerBoundaryDeclared = true` only when the boundary
  remains explicitly non-executable: `handlerReady = false`,
  `runtimeExecution = false`, `derivativeStatus = declared-not-computed`,
  `scientificValidation = false`, `fullPhysicsValidation = false`, and
  `fullFidelityMagnetarSimulation = false`.
- Integrated MoonLab's browser WebGPU probability-kernel probe sidecar commit
  `17765f4` into ULG staging and summaries. The staged parity-scope artifact now
  exposes `moonlab.webgpu.complex64-probability-kernel-probe.v0` for
  `compute_probabilities`, while ULG preserves
  `executed = false`, `passed = false`, empty native operation coverage, and the
  `native-webgpu-operation-coverage-not-yet-recorded` blocker.
- Verified the live VPN ULG demo at `http://100.86.83.35:5173/` after the
  boundary/probe checkpoint: two artifacts exported, Eshkol boundary declared
  with handler/runtime execution still false, MoonLab WebGPU probability-kernel
  probe declared but unexecuted, and the handoff packet preserved the same
  flags.
- Integrated the PeerCompute production-handler boundary consumer sidecar
  locally as commit `cd85fd9e`. Multiscale ingestion, dispatch-adapter probes,
  supervisor summaries, and browser UI now surface Eshkol
  `eshkol.ulg.production-handler-boundary.v0` while preserving
  `handlerReady = false`, `runtimeExecution = false`,
  `scientificValidation = false`, `fullPhysicsValidation = false`, and
  `fullFidelityMagnetarSimulation = false`.
- Re-ran PeerCompute `npm --prefix demos/multiscale run test:ulg-handoff`
  after `cd85fd9e`: ULG handoff was ready with blockers `0`, Multiscale was
  `handoff-ready`, `simulationStatus = scientific-ready`, and
  `magnetarVisible = true`.
- Improved ULG's launch-status line so Multiscale browser acks preserve the
  existing `handoff ready / blockers 0` prefix and append scenario/readiness
  evidence. The live bridge now reports
  `handoff ready / blockers 0 / scenario magnetar / scientific ready / 2 artifacts`
  while Multiscale still reports `magnetarVisible = true`.
- Added `npm run status:live` as a reusable live VPN status probe. Default mode
  reports service/artifact readiness and current MoonLab/Eshkol boundary flags;
  `npm run status:live -- --bridge` also posts the handoff to Multiscale and
  reports the browser ack.
- Integrated MoonLab's hadamard native-operation probe sidecar commit `69c5f47`
  into ULG staging, compact summaries, UI, handoffs, and live status. ULG now
  reports `moonlab.webgpu.complex64-native-operation-probe.v0` with `hadamard`
  declared, but preserves `executed = false`, `passed = false`,
  `covered = false`, and blocker `native-operation-probe-not-executed`.
- Integrated Eshkol's smoke tensor layout sidecar commit `6146520` into ULG
  staging, compact summaries, UI, handoffs, and live status. ULG now validates
  the f64 linear-memory binding at byte range `131072..131240`, reports
  `closureTensorLinearMemoryBindingReady = true`, and keeps
  `entryExportConsumesOffsets = false`, `handlerReady = false`, and
  `runtimeExecution = false`.
- Integrated PeerCompute's relay-backed ULG handoff smoke sidecar commit
  `ab88a62c`. The new PeerCompute smoke starts a dynamic relay, generates
  STUN/TURN ICE config, connects two Multiscale browser peers in a relay room,
  imports the live ULG handoff via `postMessage`, and verifies handoff,
  service-envelope, relay-safe artifact, and dispatch-plan readiness without
  relaxing runtime or scientific gates.
- Integrated MoonLab's `pauli_x` native-operation probe sidecar commit
  `dc43106` into ULG staging, compact summaries, UI, handoffs, and live status.
  ULG now reports both `hadamard` and `pauli_x` native probes as declared but
  unexecuted/uncovered in the no-adapter environment.
- Integrated Eshkol's tensor-offset ABI blocker sidecar commit `ad878d0`. ULG
  now validates and summarizes `eshkol.ulg.tensor-entry-export-offset-probe.v0`:
  `main(i32,i32)->i32` can be called with declared offsets, but stdout is
  invariant and `changedBytesInDeclaredTensorRange = 0`, so tensor closure ABI
  execution remains blocked.
- Recorded PeerCompute relay dispatch diagnostic sidecar commit `16fe9296`.
  Adapter-enabled relay handoff smoke no longer fails as an unstructured
  Playwright crash; it records `dispatchAdapterStatus =
  dispatch-adapter-popup-context-reset`, proves stages reach
  `dispatch-plan-created` and first MoonLab `dispatch-start`, and keeps
  `runtimeGateRelaxed = false` plus `scientificGateRelaxed = false`.
- Hardened ULG's MoonLab native-operation summary path for future operations.
  Artifact summaries now expose generic declared/blocked native operation lists
  and the UI/live-status script render `operationResults[]`, while compatibility
  fields for `hadamard` and `pauli_x` remain intact.
- Integrated MoonLab's `pauli_z` native-operation probe sidecar commit
  `e9bc324` into ULG staging, summaries, UI, handoffs, and live status. ULG now
  requires `hadamard`, `pauli_x`, and `pauli_z` native probes to remain
  declared but unexecuted/uncovered unless real browser WebGPU evidence exists.
- Registered and indexed Eshkol in Infinite Context Coder. ICC now has
  `eshkol`, `ulg`, `moonlab`, and `peercompute` registered; the Eshkol memory
  artifact was built with tree-sitter available at Eshkol head `ad878d0`.
- Hardened ULG MoonLab staging so every `browserNativeOperationProbe`
  `operationResults[]` entry must remain blocked/unexecuted/uncovered in the
  no-adapter environment, not only the currently required operation names.
- Refreshed the ICC ULG index and memory at local ULG commit `f620e85`, so the
  coordinator repo's latest staging and live-status code is available in
  persistent codebase memory.
- Added ULG target-operation visibility for MoonLab native WebGPU probes. The
  live status now reports target operations `hadamard`, `pauli_x`, `pauli_z`,
  and `cnot`.
- Recorded PeerCompute relay dispatch fix sidecar commit `631b202`. The
  relay-served popup dispatch adapter now reaches `dispatch-adapters-ready` with
  two accepted dispatches and no relaxed runtime/scientific gates.
- Integrated MoonLab's `cnot` native-operation probe sidecar commit `fbc2ddf`
  into ULG staging, summaries, UI, handoffs, and live status. The current live
  handoff reports no missing native-operation target declarations, while all
  four operations remain blocked/unexecuted/uncovered.
- Integrated Eshkol's tensor-offset runtime-smoke sidecar commit `a13745e` into
  ULG staging, summaries, browser e2e, and live handoff status. The staged
  magnetar closure now reports source hash
  `sha256:630b20dd243be58f8e53631e934d09298696fe7e7ea84b15e7d7b89d18809b69`,
  WASM hash
  `sha256:e0a3c7d280678a8c1e40865daeab6601dc8a6a64cfa5b29b7b6bfcaddc86c5aa`,
  byte length `169528`, tensor contract hash
  `sha256:2289b8c8068f1a033cda20f09f30a33f2e41588b8ee2ccd1143100f2fe87dd64`,
  `entryExportConsumesOffsets = true`, and
  `changedBytesInDeclaredTensorRange = 64` while keeping
  `handlerReady = false`, `runtimeExecution = false`, and full physics
  validation false.
- Recorded PeerCompute sidecar commit `dc497229`, which refreshed Multiscale
  browser and relay handoff smoke expectations for the same Eshkol deterministic
  tensor-offset runtime-smoke artifact without pushing.
- Added live/demo visibility for the current Eshkol runtime-smoke evidence and
  production blockers. The artifact row now shows
  `tensor-probe:runtime-smoke-passed:offsets-consumed:64b` and
  `handler:declared-not-executed:3-blockers`; `npm run status:live -- --bridge`
  prints the exact blocker list, expected entry args, stdout hash, output tensor
  production flag, and production validation flags.
- Integrated Eshkol production-candidate host-import commit `8ce5ca4` into ULG
  staging, summaries, UI, and live status. ULG now requires the production
  boundary to declare `runtimeScope = production-candidate-host-imports`,
  `implementationStatus = production-candidate-runtime-imports-present`,
  production candidate status
  `production-candidate-runtime-imports-implemented`,
  `runtimeSmokeStubsAllowed = false`, f64 tensor-memory imports, `23` required
  non-stub imports, and readiness requirements for production handler
  implementation, non-stub imports, validated tensor memory imports, and full
  physics validation.
- Integrated Eshkol production dispatch preflight metadata into ULG staging,
  compact summaries, browser handoffs, e2e checks, and live status. ULG now
  requires `eshkol.ulg.production-handler-dispatch-preflight.v0`, rejects
  deterministic runtime-smoke stubs for production dispatch, tracks eight
  required checks, and preserves the three production blockers while keeping
  `handlerReady`, runtime execution, and full physics validation false.
- Integrated Eshkol computed production dispatch preflight evidence into ULG
  staging, compact summaries, browser handoffs, e2e checks, and live status.
  ULG now reports the source artifact's `8/5/3` evidence split: module hash,
  entry signature, non-stub host imports, f64 tensor binding, and smoke-stub
  rejection pass; handler readiness, runtime execution, and full-physics
  validation remain blocked.
  ULG now preserves the eight `checkResults`, the
  `eshkol.ulg.production-handler-dispatch-preflight-check-summary.v0` summary,
  and the current four-pass/four-blocked split without promoting the production
  handler boundary to ready.
- Integrated MoonLab backend-preflight sidecar commit `4e91165` into ULG
  staging, summaries, UI, e2e coverage, and live status. The staged
  `moonlab.webgpu.complex64-parity-scope.v0` artifact now requires
  `moonlab.webgpu.complex64-browser-backend-preflight.v0` with
  `stage = navigator-gpu-unavailable`, `navigatorGpuAvailable = false`,
  `adapterAvailable = false`, and `deviceAcquired = false` in this runtime.
- Integrated MoonLab browser WebGPU parity sidecar commit `2dd3802` into ULG
  staging, the MoonLab core-probe worker, compact summaries, visible artifact
  rows, handoff artifacts, and e2e coverage. ULG now requires the staged
  `moonlab.webgpu.complex64-parity-scope.v0` artifact to report
  `scope-ready-backend-detected`, `device-acquired`, executed/passing reduced
  browser probes for `compute_probabilities`, `hadamard`, `pauli_x`, `pauli_z`,
  and `cnot`, zero blockers, and explicit no-full-fidelity/no-full-physics
  flags.
- Recorded PeerCompute tensor-runtime candidate sidecar commit `b5b0dcec` and
  reverified Multiscale browser and relay-dispatch ULG handoffs with the latest
  staged MoonLab/Eshkol artifacts. Both handoff paths reported
  `handoff-ready`, `simulationStatus = scientific-ready`, and
  `magnetarVisible = true` for the browser smoke.
- Integrated Eshkol compiler-level `define-ulg-closure` metadata support commit
  `99e8115` with ULG service-worker import glue: Eshkol closure bundle specs now
  declare `eshkol-host-imports.js`, service asset probes fetch it as JavaScript,
  the supervised Eshkol worker imports the DOM-free factory and verifies
  `createEshkolHostImportObject` plus tensor-memory binding readiness, and
  compact artifact summaries expose the factory status, production-host
  candidate requirements, runtime scope, implementation status, and required
  non-stub import count without invoking the production handler.

## In Progress

- Keep Vite live for inspection.
- Keep using `npm run stage:service-assets` after MoonLab/Eshkol rebuilds so the
  ignored live asset tree does not drift from sibling source outputs.
- Replace the fixture MoonLab/Eshkol service hosts with production adapters that
  plug concrete MoonLab/Eshkol runtime handlers into PeerCompute's new
  handler-backed dispatch host.
- Keep both ULG handoff paths available: magnetar descriptor for descriptor
  binding/table-fixture/runtime-smoke evidence, and `hello` smoke as the smaller
  gated runtime execution proof.
- Keep the new direct launch bridge and the manual copy/paste path in sync
  until the Multiscale receiver has formal UI-test coverage.
- Keep the MoonLab canonical body digest and ULG-served file digest distinct:
  MoonLab's pinned `canonicalJson()` hash excludes the trailing newline, while
  ULG's cross-repo handoff hash covers the served file bytes.
- Keep the relay-served dispatch adapter reset as an explicit blocker until the
  popup path reaches `dispatch-complete` without context destruction.

## Next

- Replace the reduced calibrated reference/runtime contracts with higher
  fidelity PIC, radiation, relativity, MHD/force-free, and eventually GRMHD
  validation artifacts.
- Add real peercompute service-hosting modules or adapters based on the working
  ULG demo contract.
- Update PeerCompute's receiver-side MoonLab WebGPU expectations so
  `scope-ready-backend-detected` reduced browser evidence is accepted without
  being interpreted as full MoonLab runtime or full magnetar physics readiness.
- Commit the PeerCompute receiver-side production dispatch preflight propagation
  once focused service orchestration, Multiscale, ULG handoff, and build checks
  are green.
- Wire real ULG/Eshkol/MoonLab worker services into the PeerCompute supervisor
  and then run the full peercompute relay-backed local stack.
