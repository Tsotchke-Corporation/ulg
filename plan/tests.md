# ULG Test Plan

## Local Unit Tests

Command: `npm test`

Current result: pass, 22/22 tests on 2026-06-06 after surfacing Eshkol's
declared production handler contract through ULG summaries and browser handoffs.

- ABI descriptor construction and complex64 round trip.
- JSON schema validation for service manifests, task capsules, closure artifacts,
  quantum response artifacts, and tolerance reports.
- Static Eshkol/MoonLab adapter fixtures validate against the shared schemas.
- Service contract builders reproduce the published manifest defaults and emit a
  schema-compatible default MoonLab task capsule.
- MoonLab service asset specs resolve `locateFile("moonlab.wasm")` to the
  `/service-assets/moonlab/moonlab.wasm` convention.
- MoonLab service asset specs declare optional
  `/service-assets/moonlab/magnetar-reference-contracts.json` reference-contract
  JSON while keeping only loader/WASM assets required.
- Eshkol closure-bundle service asset specs resolve manually staged artifact
  JSON, WASM, DOM-free host-import JavaScript, schema snapshot, and bundle
  manifest URLs.
- Service asset probes classify ready, missing, and wrong-MIME loader/WASM
  responses.
- Service asset probes report a missing optional MoonLab reference-contract JSON
  without changing required loader/WASM readiness.
- `npm run stage:service-assets -- --dry-run --json` reports the MoonLab and
  Eshkol source/target plan without mutating the ignored service-asset tree.
- `npm run stage:service-assets -- --moonlab-only` stages the MoonLab compact
  WebGPU parity handoff summary as reduced-scope evidence for the five covered
  operations: `compute_probabilities`, `hadamard`, `pauli_x`, `pauli_z`, and
  `cnot`; it preserves `fullFidelityMagnetarSimulation = false` and
  `fullPhysicsValidation = false`.
- `npm run stage:service-assets -- --eshkol-only` stages the Eshkol
  production-candidate runtime probe as smoke-only evidence and keeps
  production handler/runtime/full-physics readiness blocked.
- `npm run stage:service-assets -- --eshkol-only --created-at ...` forwards a
  fixed timestamp to Eshkol helpers that support reproducible bundle metadata.
  It now also stages the declared
  `eshkol.ulg.production-handler-contract.v0` production handler contract,
  preserving the `main(i32, i32) -> i32` invocation ABI, tensor input/output
  ids, required evidence, and remaining production/full-physics blockers.
- MoonLab service asset specs include the classic core probe worker URL and the
  manifest builder approves it for child-worker leasing.
- Registry resolution, child-worker lease limits, artifact cache behavior,
  artifact-summary telemetry behavior, and GPU fallback probe behavior.
- Child-worker leases preserve `classic` vs `module` worker type metadata.
- Artifact cache summaries preserve Eshkol closure entry signature,
  start-section, import/export, WASM metadata count, and DOM-free host-import
  bundle metadata.
- Artifact cache summaries preserve Eshkol host-import JavaScript asset status,
  service-worker import factory readiness, production-host candidate
  requirements schema/status, runtime scope, implementation status, and required
  non-stub import count.
- The browser demo handoff exporter returns `peercompute.ulg.demo-handoff.v0`
  records with full closure artifacts, compact summaries, refs, and transferred
  Eshkol WASM bytes.
- Artifact cache summaries preserve Eshkol closure output-semantics metadata for
  the deterministic smoke fixture, including schema, scope, entry export/args,
  expected result, stdout hash/length, and `scientificValidation: false`.
- Artifact cache summaries preserve MoonLab magnetar reference/tolerance
  metadata, including schema, role, contract hash, normalized energy units,
  ground-state bitstring/reference energy, energy tolerance, observed energy
  delta, and validation status.
- Artifact cache summaries de-duplicate legacy `outputs.reference` plus plural
  `outputs.references[]`, count ready output references, and can derive the
  MoonLab magnetar reference summary from the plural array when the calibration
  entry does not carry a singular reference.
- Artifact cache summaries preserve the four-entry MoonLab calibrated
  magnetosphere MHD, PIC kinetic plasma, radiation transport, and relativistic
  correction inventory with four ready/scientific-coverage calibrated entries
  when valid supplied contracts are present.
- Artifact cache summaries preserve Eshkol production dispatch preflight
  metadata, including schema `eshkol.ulg.production-handler-dispatch-preflight.v0`,
  `status = blocked`, `ready = false`, ten required production dispatch
  checks, the declared production handler contract, the smoke-only
  production-candidate runtime probe, deterministic runtime-smoke stubs rejected
  for production dispatch, and the computed `10/7/3` check split.
- Focused service-asset/orchestration coverage after the host-import import-glue
  slice:
  `node --test tests/orchestration.test.mjs tests/service-assets.test.mjs`
  passed `14/14`.

## Current Handoff Validation Summary

Validation run on 2026-06-06 after surfacing Eshkol's declared production
handler contract:

- `npm run stage:service-assets -- --eshkol-only --created-at
  2026-06-06T22:15:36-08:00`: passed and staged
  `eshkol.ulg.production-handler-contract.v0`.
- `node --test tests/orchestration.test.mjs --test-name-pattern "artifact
  cache summarizes Eshkol"`: passed, `7/7`.
- `npm test`: passed, `22/22`.
- `npm run build`: passed with the existing Vite large chunk warning.
- `npm run test:e2e`: passed, `1/1` Chromium test.
- `npm run status:live -- --bridge`: passed; live ULG on
  `http://100.86.83.35:5173/` reports
  `productionHandlerContractDeclared = true`,
  `productionHandlerContractInvocationArgumentMode = linear-memory-offsets`,
  `productionHandlerContractRequiredEvidenceCount = 8`, and production
  dispatch preflight counts `10/7/3`.

The MoonLab compact WebGPU parity handoff remains reduced-scope evidence for
five operations only. The Eshkol production-candidate runtime probe remains
smoke-only, and the declared production handler contract records the production
entry ABI without implementing the handler. Production dispatch preflight now
records `10/7/3`; it does not promote production handler readiness, production
runtime execution, scientific validation, full-fidelity magnetar simulation, or
full-physics validation.

## Production Build

Command: `npm run build`

Current result: pass on 2026-06-06 after the declared Eshkol production handler
contract slice, with the existing Vite large chunk warning.

## Browser Smoke

Command: `npm run test:e2e`

Current result: pass, 1/1 Chromium test on 2026-06-06 after the declared Eshkol
production handler contract slice.

- Load the Vite app through Playwright.
- Verify two supervised services register and run.
- Verify worker telemetry appears.
- Verify MoonLab service telemetry includes non-skipped asset probe status.
- Verify the published MoonLab service/task fixtures can be consumed by a browser
  worker and resolve the expected `locateFile` WASM URL.
- Runtime artifact readiness check on 2026-06-05: copied generated MoonLab core
  `moonlab.js` and `moonlab.wasm` into ignored `public/service-assets/moonlab/`;
  `curl -I` returned `text/javascript` for JS and `application/wasm` for WASM;
  a Playwright telemetry probe reported MoonLab `assetProbe.status = ready`.
- Runtime core probe check on 2026-06-05: with copied MoonLab assets present,
  Playwright verified the supervised MoonLab artifact method
  `moonlab-wasm-bell-phi-plus-probe`, `coreProbe.status = ready`, validation
  `pass`, and Bell `phi_plus` probabilities close to `[0.5, 0, 0, 0.5]`.
- Runtime parity artifact check on 2026-06-05: with copied MoonLab assets
  present, Playwright verifies
  `peercompute.ulg.quantum-response-descriptor.v0`,
  `peercompute.ulg.quantum-response-parity.v0`, a passing
  `moonlab-wasm-core` comparison, and an explicit unsupported `moonlab-webgpu`
  comparison for the still-missing browser WebGPU parity kernel.
- Live VPN check on 2026-06-05: `http://100.86.83.35:5173/` returned the same
  MoonLab artifact method, core probe status, validation status, and Bell
  probability vector through `window.__ulgDemo.artifactCache`.
- Runtime magnetar calibration check on 2026-06-05: with copied MoonLab assets
  present, Playwright verifies
  `peercompute.ulg.magnetar-dipole-ising-calibration.v0` under the MoonLab
  artifact's `calibrationArtifacts.magnetarDipoleIsing`, passing WASM-vs-JS
  Ising energy parity with `groundState.bitString = "000"`,
  `maxEnergyDelta = 0`, and `evaluatedBitstrings = 8`.
- Runtime magnetar reference check on 2026-06-06: with copied MoonLab assets
  present, Playwright verifies `outputs.reference` carries
  `moonlab.magnetar-dipole-ising-reference.v0`, role
  `peercompute-reference-tolerance-input`, contract hash
  `sha256:f85763af06f271c414d55e29884ee7b0d5738a4a7ec9351493964b98f8d4e1ec`,
  energy units `normalized-ising`, ground state `000`, reference energy
  `-1.6712962962963`, tolerance `1e-9`, zero observed energy delta, and passing
  reference validation.
- Runtime plural reference check on 2026-06-06: with copied MoonLab assets
  present, Playwright verifies `outputs.reference` still carries the ready
  dipole-Ising compatibility contract while `outputs.references[]` carries the
  calibrated family inventory.
- Runtime calibrated reference inventory check on 2026-06-06: with copied
  MoonLab assets present, Playwright verifies `outputs.references[]` carries the
  scoped analytic `magnetosphere-mhd` dipole-field reference plus staged reduced
  PIC kinetic plasma, radiation transport, and relativistic correction supplied
  contracts. All four calibrated entries report ready/scientific coverage when
  the optional JSON is present; the test still accepts blocked placeholders when
  the optional JSON is absent.
- Runtime optional MoonLab reference-contract asset check on 2026-06-06:
  Playwright verifies the MoonLab service asset probe reports
  `referenceContractModule` for
  `/service-assets/moonlab/magnetar-reference-contracts.json` as
  `required: false`; when the file is absent behind Vite's HTML fallback, the
  service remains `ready` and the core probe records optional
  `referenceContracts.status = "missing"`.
- Live VPN calibrated inventory check on 2026-06-06:
  `http://100.86.83.35:5173/` reported four raw
  `outputs.references[]` entries for magnetosphere MHD, PIC kinetic plasma,
  radiation transport, and relativistic correction, compact
  `outputReferenceCount = 5`, `outputReferenceReadyCount = 5`,
  `magnetarCalibratedReferenceCount = 4`, and four calibrated ready/scientific
  coverage entries.
- Live VPN ULG-to-PeerCompute magnetar handoff check on 2026-06-06:
  ULG exported two handoff artifacts: MoonLab with
  `outputReferenceReadyCount = 5` and
  `magnetarCalibratedReferenceReadyCount = 4`, and Eshkol with
  `closureReady = true`, `wasmByteLength = 33907`. PeerCompute accepted the
  handoff as `handoff-ready`, `2/2` required handoffs ready,
  `scientific-tolerance-suite-ready`, and then recorded five proxy-only runtime
  evidence entries with five SHA-256 evidence hashes, five proxy-validation
  passes, `observedCount = 5`, `proxyOnlyCount = 5`, `validatedCount = 0`, and
  the remaining blocker `proxy-runtime-not-scientific`.
- Live VPN stricter PeerCompute runtime-gate check on 2026-06-06:
  after local PeerCompute commit `c0610ca7`, a fresh browser probe still reports
  `handoff-ready`, `scientific-tolerance-suite-ready`, five proxy-validation
  passes, five SHA-256 runtime evidence hashes, `validatedCount = 0`, and
  scientific runtime gate blocker `proxy-runtime-not-scientific`.
- Service-asset staging command check on 2026-06-06:
  `npm run stage:service-assets` copied MoonLab `moonlab.js`, `moonlab.wasm`,
  generated the normalized `magnetar-reference-contracts.json` suite,
  regenerated the Eshkol `hello` closure bundle with
  `eshkol.ulg.closure-output-semantics.v0`, and `npm run test:e2e` stayed green
  afterward.
- Normalized MoonLab reference suite staging check on 2026-06-06:
  `npm run stage:service-assets -- --moonlab-only --dry-run --json`,
  `npm run stage:service-assets -- --moonlab-only`,
  `npm run stage:service-assets -- --dry-run --json`, and
  `npm run stage:service-assets` passed. The generated browser asset reports
  schema `moonlab.magnetar.normalized-reference-suite.v0`, status
  `reference-contract-suite-ready`, top-level `ready: true`, and four ready
  calibrated references.
- Live VPN normalized-suite and descriptor-closure handoff check on 2026-06-06:
  after generated-suite staging and Eshkol `magnetar-closure` descriptor
  staging, ULG exported MoonLab `outputReferenceReadyCount = 5`,
  `magnetarCalibratedReferenceReadyCount = 4`, and Eshkol
  `wasmByteLength = 53066`. PeerCompute accepted the handoff as `handoff-ready`,
  reported `scientific-tolerance-suite-ready`,
  `transferredWasmByteLength = 53066`, descriptor probe ready, no host-runtime or
  output-semantics execution claim for the descriptor path, five proxy-only
  runtime evidence entries after refresh, and the intended blocker
  `proxy-runtime-not-scientific`.
- Live VPN reduced calibrated runtime evidence check on 2026-06-06:
  after PeerCompute commits `d0dbe1f5` and `df4ea25a`,
  `window.__multiscaleDemo.refreshScenarioCalibratedRuntimeEvidence()` on
  `https://100.86.83.35:5185/?scenario=magnetar` reported
  `manifestEntryCount = 5`, `manifestScientificExecution = true`,
  `runtime-evidence-ready`, `scientificExecution = true`,
  `validatedCount = 5`, `missingCount = 0`, `proxyOnlyCount = 0`,
  `scientific-runtime-ready`, `scenarioScientificReady = true`, and no blockers
  after applying the live ULG handoff from `http://100.86.83.35:5173/`.
- Live VPN durable service-envelope check on 2026-06-06: after PeerCompute
  commit `fbcc4f17`, the live ULG handoff from
  `http://100.86.83.35:5173/` and PeerCompute
  `https://100.86.83.35:5185/?scenario=magnetar` returned
  `peercompute.ulg.handoff-service-envelope.v0` with `ready = true`,
  `status = service-envelope-ready`, `artifactCount = 2`,
  `relaySafeArtifactCount = 2`, `contentAddressedArtifactCount = 2`, no
  envelope blockers, Eshkol transferred WASM length `53066`, and the reduced
  calibrated runtime gate still at `runtime-evidence-ready`,
  `validatedCount = 5`, `scientific-runtime-ready`,
  `scenarioScientificReady = true`, and no blockers after awaited calibrated
  runtime refresh.
- Live VPN Eshkol descriptor-binding check on 2026-06-06: after Eshkol commit
  `31cbbfc` and `npm run stage:service-assets -- --eshkol-only`, the live ULG
  handoff preserved `eshkol.ulg.magnetar-closure-descriptor-binding.v0`, named
  `peercompute.ulg.handoff-service-envelope.v0`, carried MoonLab suite hash
  `sha256:7d4e6372e49689d2202914e210af84d19d776dc6fbc5b7e08b19cbedfb71b455`,
  reported four closure-surface sample ids, kept
  `descriptor-bound-not-executed` / `declared-not-executed`, preserved
  `scientificValidation = false`, and still gave PeerCompute
  `service-envelope-ready`, `runtime-evidence-ready`, `validatedCount = 5`,
  `scientific-runtime-ready`, `scenarioScientificReady = true`, and no blockers.
- PeerCompute envelope-backed service-host check on 2026-06-06: after commit
  `2776682d`, focused service-orchestration coverage passed `14/14`, proving
  `UlgHandoffServiceHost` can run under `WorkerSupervisor`, accept a raw ULG
  handoff task, emit `peercompute.ulg.handoff-service-result.v0`, and store the
  durable `peercompute.ulg.handoff-service-envelope.v0` artifact through the
  supervisor artifact cache.
- PeerCompute envelope-backed service-dispatch check on 2026-06-06: after
  commit `22feae0b`, `node --test
  peercompute/tests/unit/serviceOrchestration.test.js` passed `15/15`, proving
  durable ULG handoff envelopes derive
  `peercompute.ulg.handoff-service-dispatch-plan.v0`, map MoonLab and Eshkol
  artifact refs to concrete service tasks, preserve relay-safe/content-addressed
  refs and transferred Eshkol WASM metadata, optionally execute through an
  injected service executor, and cache dispatch plan/result metadata beside the
  envelope.
- Eshkol production dispatch preflight check on 2026-06-06:
  `npm run stage:service-assets -- --eshkol-only`, `npm test`,
  `npm run build`, `npm run test:e2e`, and
  `npm run status:live -- --bridge` passed. The live Eshkol status reports
  `productionDispatchPreflightStatus = blocked`,
  `productionDispatchPreflightReady = false`,
  required production runtime ABI
  `wasm32-unknown-unknown:eshkol-host-imports-production-candidate-v0`,
  rejected runtime scope `deterministic-runtime-smoke-stubs`, and blockers
  `production-magnetar-handler-not-implemented`,
  `full-physics-validation-not-run`.
- Earlier Eshkol production dispatch preflight computed-evidence check on
  2026-06-06:
  `npm run stage:service-assets -- --eshkol-only`, `npm test`,
  `npm run build`, `npm run test:e2e`, `git diff --check`, and
  `npm run status:live -- --bridge` passed. The live ULG status reports
  `productionDispatchPreflightCheckSummarySchema =
  eshkol.ulg.production-handler-dispatch-preflight-check-summary.v0`,
  `productionDispatchPreflightTotalRequiredCheckCount = 8`,
  `productionDispatchPreflightPassedCheckCount = 4`, and
  `productionDispatchPreflightBlockedCheckCount = 4`. Passed checks are module
  hash, entry signature, f64 tensor memory binding, and production smoke-stub
  rejection; blocked checks are non-stub host imports, handler readiness,
  runtime execution, and full-physics validation. This count has since been
  superseded by the declared production handler contract slice's `10/7/3`
  preflight.
  durable envelope.
- Magnetar fidelity/runtime scope gate on 2026-06-06:
  `npm run stage:service-assets`, `npm test`, `npm run build`, and
  `npm run test:e2e` passed after adding
  `ulg.magnetar.fidelity-runtime-scope.v0` to MoonLab reference summaries and
  Eshkol descriptor-binding summaries. A strict live ULG `5173` to PeerCompute
  `5185` browser probe then reported `runtime-evidence-ready`,
  `validatedCount = 5`, `proxyOnlyCount = 0`, `missingCount = 0`,
  `scientificReady = true`, no blockers, tolerance-scope readiness for
  `pic-kinetic-plasma`, and explicit `fullFidelityMagnetarSimulation = false`
  plus `fullPhysicsValidation = false` in the calibrated runtime scope.
- PeerCompute registry-backed dispatch executor check on 2026-06-06: after
  commit `ae67d31e`, full `node --test
  peercompute/tests/unit/serviceOrchestration.test.js` passed `16/16`, proving
  `createUlgHandoffSupervisorServiceExecutor()` can submit dispatch tasks to
  registered `moonlab-ulg-fixture` and `eshkol-ulg-fixture` service hosts under
  the same `WorkerSupervisor`, preserve nested service task/result metadata,
  and still cache the parent durable envelope plus dispatch plan/result.
- PeerCompute materialized dispatch payload check on 2026-06-06: after commit
  `697f8d8b`, full `node --test
  peercompute/tests/unit/serviceOrchestration.test.js` passed `16/16`, proving
  supervisor-submitted dispatch tasks carry
  `peercompute.ulg.handoff-dispatch-artifact-payload.v0` with MoonLab
  quantum-response summaries and Eshkol closure bodies plus transferred WASM
  bytes for registered service adapters.
- PeerCompute dispatch service-adapter check on 2026-06-06: after commit
  `4d45714b`, full `node --test
  peercompute/tests/unit/serviceOrchestration.test.js` passed `16/16`, proving
  exported `UlgDispatchServiceHost` MoonLab/Eshkol adapters validate materialized
  dispatch payloads, request/release supervised child leases, emit typed dispatch
  service results/artifacts, and cache nested acceptance artifacts beside the
  parent durable handoff envelope.
- Live VPN Multiscale dispatch adapter-worker check on 2026-06-06: after
  PeerCompute commit `c198326c`, `window.__multiscaleDemo.runUlgDispatchServiceAdapterProbe(handoff)`
  on `https://100.86.83.35:5185/?scenario=magnetar` returned
  `peercompute.multiscale.ulg-dispatch-service-adapter-probe.v0`,
  `dispatch-adapters-ready`, `ready = true`, `dispatchCount = 2`,
  `executedDispatchCount = 2`, `acceptedDispatchCount = 2`,
  `failedDispatchCount = 0`, nested dispatch artifact refs for
  `moonlab-ulg-fixture` and `eshkol-ulg-fixture`, MoonLab
  `magnetarDipoleIsingReady = true`, Eshkol `wasmByteLength = 53066`, and no
  blockers.
- Live VPN dispatch adapter-probe check on 2026-06-06: after PeerCompute commit
  `0eae0a68`, the same adapter-worker probe returned MoonLab probe schema
  `peercompute.ulg.moonlab-dispatch-payload-probe.v0` with `probeStatus = pass`
  and Eshkol probe schema `peercompute.ulg.eshkol-dispatch-wasm-probe.v0` with
  `moduleCompiled = true`, `importCount = 33`, `exportCount = 1`,
  `hasEntryExport = true`, Eshkol `wasmByteLength = 53066`, and no blockers.
- Live VPN descriptor-contract adapter check on 2026-06-06: after PeerCompute
  commit `7cae7660`, the live ULG handoff still returned
  `dispatch-adapters-ready` with Eshkol `moduleCompiled = true`,
  `importCount = 33`, `exportCount = 1`, and descriptor contract status
  `descriptor-contract-ready`. A synthetic descriptor-only handoff through the
  same browser Worker API returned `eshkol.ulg.closure.descriptor-bind`,
  `hasTransferredWasmBytes = false`, probe mode
  `descriptor-contract-metadata-only`, `moduleCompiled = false`,
  tensor/table contract matches, MoonLab reference count `4`, runtime status
  `declared-not-executed`, and no blockers.
- Live VPN Eshkol host-runtime dry-probe check on 2026-06-06: after PeerCompute
  commit `b00ac043`, the live ULG handoff returned `dispatch-adapters-ready`
  with Eshkol `moduleCompiled = true`, `importCount = 33`, `exportCount = 1`,
  descriptor contract status `descriptor-contract-ready`, host-runtime probe
  status `host-runtime-dry-probe-ready`, `instantiated = true`, `30` function
  stubs plus memory/global/table stubs, `stubCallCount = 0`,
  `mainInvoked = false`, `scientificExecution = false`, and no blockers.
- Live VPN gated smoke-execution check on 2026-06-06: after PeerCompute commit
  `8259ecb6`, the live magnetar descriptor handoff still returned
  `dispatch-adapters-ready` with host-runtime dry probe ready and
  `hostRuntimeExecution = null`, `mainInvoked = false`, and
  `scientificExecution = false`. A synthetic smoke-output-semantics handoff
  returned `dispatch-adapters-ready`, host-runtime execution status
  `host-runtime-output-semantics-validated`, `entryInvoked = true`,
  `entryResult = 0`, output-semantics validation ready, and
  `scientificExecution = false`.
- Live VPN Multiscale dispatch-plan API check on 2026-06-06: after PeerCompute
  commit `fa33b97f`, a browser probe waited for ULG
  `artifactCache.list().length >= 2`, exported
  `peercompute.ulg.demo-handoff.v0` with `quantum-response` and `closure`
  artifacts plus Eshkol `wasmByteLength = 53066`, then verified
  `window.__multiscaleDemo.applyUlgDemoHandoffForScenario(handoff)` and direct
  `window.__multiscaleDemo.createUlgHandoffServiceDispatchPlan(handoff)` both
  returned `peercompute.ulg.handoff-service-dispatch-plan.v0`,
  `dispatch-ready`, `dispatchCount = 2`, `readyDispatchCount = 2`, service ids
  `moonlab-ulg-fixture` and `eshkol-ulg-fixture`, task kinds
  `moonlab.ulg.quantum-response.ingest` and
  `eshkol.ulg.closure-artifact.ingest`, Eshkol dispatch WASM byte length
  `53066`, and no dispatch blockers.
- Live VPN digest-addressed artifact-ref check on 2026-06-06: after hardening
  ULG `ArtifactCache`, `npm test` passed `18/18`, `npm run build` passed with
  the existing large chunk warning, `npm run test:e2e` passed `1/1`, and a live
  browser probe showed both exported handoff refs as
  `artifact://sha256:<64 hex>` with matching `artifactHash` values. The
  Multiscale dispatch plan stayed `dispatch-ready`, `dispatchCount = 2`,
  `readyDispatchCount = 2`, and reported `digestAddressed = true` for both
  MoonLab and Eshkol dispatches with no blockers.
- Artifact-summary telemetry check on 2026-06-05: Playwright verifies the
  MoonLab artifact telemetry record carries
  `peercompute.ulg.artifact-summary.v0`, magnetar readiness `true`, ground state
  `000`, `maxEnergyDelta = 0`, and `evaluatedBitstrings = 8` without fetching
  the full artifact body.
- MoonLab reference artifact-summary check on 2026-06-06: Playwright verifies
  `peercompute.ulg.artifact-summary.v0` exposes the same reference schema, hash,
  units, ground-state reference energy, tolerance, observed energy delta, and
  pass status without fetching the full artifact body.
- MoonLab plural reference artifact-summary check on 2026-06-06: Playwright
  verifies compact telemetry reports output reference count/ready count and a
  compact plural reference summary.
- Eshkol bundle asset check on 2026-06-05: when the ignored local `hello` bundle
  is copied under `public/service-assets/eshkol/closures/hello/`, Playwright
  verifies the Eshkol service asset probe sees artifact JSON, WASM, schema
  snapshot, and bundle manifest assets.
- Eshkol magnetar closure descriptor summary check on 2026-06-06:
  unit coverage verifies descriptor-only Eshkol artifacts expose
  `closureDescriptorReady = true`, schema
  `eshkol.ulg.magnetar-closure-descriptor.v0`, typed magnetar input/output ids,
  fixture checksum `50`, and guarded smoke `closureOutputSemanticsReady = true`
  while still
  staying service-worker-safe and dynamic-code-free.
- Eshkol magnetar closure browser handoff check on 2026-06-06:
  `npm run stage:service-assets -- --eshkol-only`,
  `npm run stage:service-assets -- --dry-run --json`,
  `npm run stage:service-assets`, `npm test`, `npm run build`, and
  `npm run test:e2e` passed after switching the ULG Eshkol service manifest to
  `magnetar-closure`. The live 5173 handoff exports
  `closureKind = "magnetar-closure-descriptor-fixture"`,
  `closureDescriptorReady = true`, `closureOutputSemanticsReady = true`,
  `scientificValidation = false`, and `wasmByteLength = 53066`.
- Eshkol magnetar interpolation-table fixture check on 2026-06-06:
  `npm run stage:service-assets -- --eshkol-only`, `npm test`,
  `npm run build`, and `npm run test:e2e` passed after the staged descriptor
  gained `eshkol.ulg.magnetar-closure-interpolation-table.v0`,
  `status = computed-fixture`, `sampleCount = 4`, content hash
  `sha256:82ca16463d7ffe1d170adb266be61c3959b22a6c352751e99f0f510738a14165`,
  and `scientificValidation = false`. A live `5173` to Multiscale `5185`
  adapter probe returned `dispatch-adapters-ready`, `acceptedDispatchCount = 2`,
  Eshkol descriptor probe `ready = true`, table status `computed-fixture`,
  no blockers, and service-summary table sample count `4`.
- Eshkol magnetar runtime-smoke check on 2026-06-06:
  `npm run stage:service-assets -- --eshkol-only`, `npm test`,
  `npm run build`, and `npm run test:e2e` passed after the default staged
  magnetar descriptor gained `eshkol.ulg.closure-output-semantics.v0` for
  `main(0, 0) -> 0`, stdout text `1048560\n10485441048528\n`, stdout hash
  `sha256:34a23605b7cacbeb83ef3391ae049c0bbcf38651b552eb9630eeca2165ca5768`,
  byte length `23`, and `scientificValidation = false`. A live ULG `5173` to
  Multiscale `5185` dispatch probe returned
  `host-runtime-output-semantics-validated`, `entryInvoked = true`,
  `mainInvoked = true`, `entryResult = 0`, no output-semantics blockers, and
  `scientificExecution = false`.
- Eshkol closure artifact handoff check on 2026-06-05: Playwright verifies the
  ready Eshkol service returns the staged `wasm-reference` closure artifact,
  preserves `hello.wasm` as the relative module URL, marks it service-worker
  safe, and exposes closure artifact-summary validation status `pass`,
  `closureReady: true`, and bundle relative-URL preservation.
- Eshkol closure execution metadata check on 2026-06-05: Playwright verifies
  the closure artifact-summary telemetry reports `entryExport = "main"`,
  signature `i32,i32 -> i32`, no start section, import count `12`,
  runtime function import count `9`, WASM function/type counts `18/104`, and
  DOM-free host import factory `createEshkolHostImportObject`.
- Live VPN Eshkol bundle check on 2026-06-05: `http://100.86.83.35:5173/`
  reported Eshkol asset status `ready`, with `application/wasm` for the module
  and `application/json` for the artifact, schema, and bundle manifest. A live
  artifact-cache probe also reported closure kind `wasm-reference`, module URL
  `hello.wasm`, validation status `pass`, and bundle manifest
  `preserveRelativeUrls: true`.
- Live VPN Eshkol closure metadata check on 2026-06-05:
  `http://100.86.83.35:5173/` reported `entry:main`, `imports:12`, and
  `host:createEshkolHostImportObject` in the artifact list after
  `window.__ulgDemo.runSmoke()`.
- ULG handoff exporter check on 2026-06-05: Playwright verifies
  `window.__ulgDemo.createPeerComputeHandoff()` returns schema
  `peercompute.ulg.demo-handoff.v0`, preserves the Eshkol closure summary entry
  `main`, marks DOM-free host imports, and transfers `33,907` WASM bytes from
  `/service-assets/eshkol/closures/hello/hello.wasm`.
- ULG MoonLab reference handoff check on 2026-06-06: Playwright verifies
  `window.__ulgDemo.createPeerComputeHandoff()` preserves the MoonLab
  `outputs.references[]` list and compact output reference counts in the
  exported packet.
- Live ULG-to-Multiscale analytic reference check on 2026-06-06:
  `http://100.86.83.35:5173/` exported MoonLab and Eshkol artifacts to
  `https://100.86.83.35:5185/?scenario=magnetar`; Multiscale reported
  `transfer-manifest-ready`, tolerance ready `2/5`, calibrated reference ready
  `1/4`, calibrated scientific ready `1/4`, the `magnetosphere-mhd` entry ready
  with no blocker, and `scenarioScientificReady: false`.
- ULG output-semantics check on 2026-06-05: Playwright verifies the staged
  Eshkol closure artifact, compact artifact-summary telemetry, and demo handoff
  packet all carry `eshkol.ulg.closure-output-semantics.v0`,
  `semanticScope = "smoke-fixture"`, `scientificScope = "none"`,
  `scientificValidation = false`, `entryExport = "main"`, `entryArgs = [0, 0]`,
  `expectedEntryResult = 0`, stdout SHA-256
  `sha256:675d2e8686b6a85ffaa5751fba535c108d23ba941f1890d0a102619ec2cdf20d`,
  and byte length `16`.
- ULG separate Eshkol smoke handoff check on 2026-06-06: Playwright verifies
  `window.__ulgDemo.createPeerComputeEshkolSmokeHandoff()` returns
  `peercompute.ulg.demo-handoff.v0` with exactly MoonLab `quantum-response` and
  Eshkol `closure` artifacts, keeps the default magnetar descriptor handoff
  unchanged, carries `hello.wasm` with module SHA-256
  `sha256:1a4699680cc14ba3cefa78634c1d52425c4d4158e590aa2e3658d3c7cae9f79c`,
  transfers `33,907` WASM bytes, merges the DOM-free host-import bundle
  manifest, and marks output semantics ready with scientific validation false.
- Live ULG-to-PeerCompute smoke execution check on 2026-06-06:
  `http://100.86.83.35:5173/` exported the new smoke handoff to
  `https://100.86.83.35:5185/?scenario=magnetar`; Multiscale returned
  `dispatch-adapters-ready`, `acceptedDispatchCount = 2`,
  `host-runtime-output-semantics-validated`, `entryInvoked = true`,
  `entryResult = 0`, stdout SHA-256
  `sha256:675d2e8686b6a85ffaa5751fba535c108d23ba941f1890d0a102619ec2cdf20d`,
  stdout byte length `16`, no output-semantics blockers, and
  `scientificExecution = false`.
- Live ULG-to-Multiscale bridge check on 2026-06-05:
  `http://100.86.83.35:5173/` exported MoonLab and Eshkol artifacts to
  `https://100.86.83.35:5185/?scenario=magnetar`; Multiscale ingested the
  MoonLab magnetar calibration, executed the Eshkol closure from transferred
  bytes with `entryResult = 0`, reported output preview `1048560\n1048544\n`,
  set `scenarioHandoffReady` and `scenarioClosureHostRuntimeExecutionReady` to
  `true`, and kept `scenarioScientificReady` false.
- Live artifact-cache check on 2026-06-05: `http://100.86.83.35:5173/`
  returned Bell parity `pass` plus magnetar calibration `pass`, ground state
  `000`, `maxEnergyDelta = 0`, and `calibrationArtifactCount = 1` from
  `window.__ulgDemo.artifactCache`.
- Verify the three.js canvas is nonblank at desktop and mobile viewport sizes.
- Save screenshots into `test-results/`.

## Manual Stack Follow-up

- PeerCompute sidecar verified syntax, unit, Multiscale unit, Multiscale build,
  backend dry-run, and VPN coturn dry-run in `/home/cos/projects/peercompute`.
- PeerCompute service orchestration checks on 2026-06-05:
  `node --check` on new modules/tests/index passed,
  `node --test peercompute/tests/unit/serviceOrchestration.test.js` passed 5/5,
  targeted ComputeManager/SolverRegistry integration gate passed 28/28,
  `npm --prefix peercompute run test:unit` passed 121/121, and
  `git diff --check` passed.
- Eshkol sidecar verified `cmake --build build --target eshkol-run -j2`,
  native hello compile/run, WASM hello emission, LLVM 21 build config, CUDA GPU
  enabled config, and RTX 3090 visibility. It also found no real WebGPU/WGSL
  implementation and one JIT derivative hang to avoid in the browser service path.
- Eshkol ULG artifact helper checks on 2026-06-05:
  `ctest --test-dir build -R 'ulg_closure_artifact_test|eshkol_run_profile_cli_test|execution_profile_test' --output-on-failure`
  passed 3/3; native hello compiled and ran; WASM hello emitted a valid
  `\0asm` module; generated `hello.ulg.json` validated against
  `ulg-gpu-abi/src/schemas/closure_artifact.schema.json`.
- MoonLab sidecar verified native unit binaries and `qsim_test`, while JS unit
  and integration tests need fixes before real MoonLab service integration.
- MoonLab core WASM readiness checks on 2026-06-05:
  `pnpm test:unit` passed 90/90, `pnpm --filter @moonlab/quantum-core build`
  passed, `pnpm test:integration` passed 41/41, `pnpm build:wasm` passed, and
  `git diff --check` passed. Full JS workspace `pnpm build` still fails outside
  core because `@moonlab/quantum-algorithms` lacks `src/index.ts`.
- MoonLab WASM allocation export checks on 2026-06-05:
  `pnpm --filter @moonlab/quantum-core build` passed, `pnpm --filter
  @moonlab/quantum-core test:unit` passed 93/93, and the rebuilt loader exposes
  `_quantum_state_create`/`_quantum_state_destroy`.
- Bring up the peercompute relay-backed local stack after the dummy ULG service
  smoke is stable.
- Reuse peercompute's existing runtime P2P smoke harness where possible.
- Add STUN/TURN/ICE/relay coverage once the service registry integration lands
  in peercompute proper.

## 2026-06-06 Tensor Runtime Contract Checks

- Eshkol:
  `python3 -m json.tool examples/magnetar_closure.ulg-metadata.json >/dev/null`
  and `python3 -m py_compile tests/toolchain/ulg_magnetar_closure_fixture_test.py`
  passed.
- Eshkol:
  `ctest --test-dir build -R '^ulg_magnetar_closure_fixture_test$' --output-on-failure`
  passed `1/1`.
- ULG:
  `node --check src/runtime/artifactSummary.js`,
  `node --check scripts/stage-service-assets.mjs`,
  `node --check tests/orchestration.test.mjs`, and
  `node --check tests/demo.e2e.mjs` passed.
- ULG: `npm run stage:service-assets`, `npm test` (`19/19`),
  `npm run test:e2e` (`1/1`), and `npm run build` passed. Build still emits
  the existing large-chunk warning.
- PeerCompute:
  `node --check peercompute/src/peercompute/serviceOrchestration/UlgDispatchServiceAdapters.js`,
  `node --check peercompute/src/peercompute/serviceOrchestration/UlgHandoffServiceHost.js`,
  and `node --check peercompute/tests/unit/serviceOrchestration.test.js`
  passed.
- PeerCompute:
  `node --test peercompute/tests/unit/serviceOrchestration.test.js` passed
  `22/22`.
- PeerCompute: `npm --prefix demos/multiscale run build` passed with the
  existing large-chunk warning.
- Strict live browser probe from `http://127.0.0.1:5173/` to
  `https://127.0.0.1:5185/?scenario=magnetar` passed: ULG and PeerCompute both
  reported the Eshkol tensor runtime contract ready, dispatch adapters returned
  `dispatch-adapters-ready`, calibrated runtime evidence returned
  `runtime-evidence-ready`, `validatedCount = 5`, and blocker count `0`.

## 2026-06-06 Sidecar Staging Refresh Checks

- ULG: `npm run stage:service-assets` should pass after MoonLab/Eshkol local
  rebuilds and should restage MoonLab JS/WASM, the canonical normalized
  MoonLab reference suite, and the Eshkol magnetar closure descriptor bundle.
- ULG: `npm run stage:service-assets -- --dry-run --json` should show MoonLab
  reference-suite normalization with `--canonical` and the Eshkol
  `export_ulg_closure_bundle.py` command for `magnetar_closure.esk`.
- ULG staged hash gate:
  `sha256sum public/service-assets/moonlab/magnetar-reference-contracts.json public/service-assets/eshkol/closures/magnetar-closure/magnetar-closure.wasm`
  should report MoonLab suite
  `7d4e6372e49689d2202914e210af84d19d776dc6fbc5b7e08b19cbedfb71b455` and
  Eshkol WASM
  `38902bb4b3f5ed8abf513a4d739ff9ca99727696df271c3ff17127575785b947`.
- ULG staged descriptor gate: the staged Eshkol artifact should preserve source
  hash
  `sha256:73f2a89ffe3434d995ffe1174185462cf0c2edb653fbe4d1286342b788763052`,
  MoonLab suite binding
  `sha256:7d4e6372e49689d2202914e210af84d19d776dc6fbc5b7e08b19cbedfb71b455`,
  source metadata path `magnetar_closure.ulg-metadata.json`, tensor runtime
  status `declared-fixture-contract`, and false scientific/full-physics flags.
- ULG and live bridge: `npm test`, `npm run test:e2e`, and PeerCompute
  `npm --prefix demos/multiscale run test:ulg-handoff` should pass against the
  live `5173`/`5185` servers with `handoff-ready`, blocker count `0`, and the
  visible magnetar proxy on the solar layer.

## 2026-06-06 MoonLab WebGPU Parity-Scope Staging Checks

- ULG syntax:
  `node --check scripts/stage-service-assets.mjs`,
  `node --check src/runtime/ServiceAssetProbe.js`,
  `node --check ulg-gpu-abi/src/serviceContract.js`, and
  `node --check tests/service-assets.test.mjs` passed.
- ULG staging:
  `npm run stage:service-assets` passed and generated optional
  `public/service-assets/moonlab/webgpu-complex64-parity-scope.json`.
- ULG dry-run staging:
  `npm run stage:service-assets -- --dry-run --json` passed and listed the
  MoonLab WebGPU complex64 parity-scope generation command.
- ULG staged parity-scope gate:
  `public/service-assets/moonlab/webgpu-complex64-parity-scope.json` reports
  schema `moonlab.webgpu.complex64-parity-scope.v0`, status
  `scope-ready-backend-unavailable`, `contractReady = true`,
  `contractValidation.valid = true`, `reducedFixtureOnly = true`,
  `backendAvailable = false`, `webgpuParity.executed = false`,
  `webgpuParity.passed = false`, `complex64Preflight.passed = true`, and the
  blocker `browser-webgpu-kernel-parity-not-executed`.
- ULG staged hashes:
  parity scope
  `8c10f99aaa0dc0f13c6bb3242befbe65bf8ff2d5acad610829017fb548dc83bc`,
  MoonLab suite
  `7d4e6372e49689d2202914e210af84d19d776dc6fbc5b7e08b19cbedfb71b455`,
  and Eshkol WASM
  `38902bb4b3f5ed8abf513a4d739ff9ca99727696df271c3ff17127575785b947`.
- ULG regression:
  `npm test` passed `20/20`, `npm run build` passed with the existing
  large-chunk warning, and `npm run test:e2e` passed `1/1`.
- Live bridge:
  PeerCompute `npm --prefix demos/multiscale run test:ulg-handoff` passed
  against live ULG `5173` and Multiscale `5185` with `handoff-ready`, blocker
  count `0`, `simulationStatus = scientific-ready`, bridge ack
  `handoff-ready`, visible magnetar proxy, and expected canonical/source/WASM
  hashes.

## 2026-06-06 MoonLab WebGPU Parity-Scope Runtime Handoff Checks

- ULG syntax:
  `node --check public/workers/moonlab-core-probe.worker.js`,
  `node --check src/services/dummyService.worker.js`,
  `node --check src/runtime/artifactSummary.js`,
  `node --check src/main.js`, `node --check tests/orchestration.test.mjs`, and
  `node --check tests/demo.e2e.mjs` passed.
- ULG regression:
  `npm test` passed `20/20`, `npm run build` passed with the existing
  large-chunk warning, and `npm run test:e2e` passed `1/1`.
- Live ULG runtime:
  Playwright against `http://100.86.83.35:5173/` reported MoonLab parity-scope
  schema `moonlab.webgpu.complex64-parity-scope.v0`, status
  `scope-ready-backend-unavailable`, `backendAvailable = false`,
  `webgpuParity.executed = false`, `webgpuParity.passed = false`,
  `complex64Preflight.passed = true`, false full-fidelity/full-physics flags,
  and blocker `browser-webgpu-kernel-parity-not-executed` in both telemetry and
  handoff artifact.
- Live ULG UI:
  the MoonLab artifact list line includes `webgpu:no-backend` beside
  `validation:pass`, `parity:pass`, `magnetar:000`, and `refs:5/5`.
- Live bridge:
  PeerCompute `npm --prefix demos/multiscale run test:ulg-handoff` passed
  against live ULG `5173` and Multiscale `5185` with `handoff-ready`, blocker
  count `0`, `simulationStatus = scientific-ready`, bridge ack
  `handoff-ready`, and visible magnetar proxy.

## 2026-06-06 PeerCompute Parity-Scope Consumer Checks

- PeerCompute service orchestration:
  `node --test peercompute/tests/unit/serviceOrchestration.test.js` passed
  `24/24`.
- PeerCompute Multiscale:
  `npm --prefix demos/multiscale test` passed `196/196`.
- PeerCompute Multiscale build:
  `npm --prefix demos/multiscale run build` passed with the existing
  large-chunk warning.
- Live bridge:
  `npm --prefix demos/multiscale run test:ulg-handoff` passed with
  `handoff-ready`, blocker count `0`, `simulationStatus = scientific-ready`,
  bridge ack `handoff-ready`, and visible magnetar proxy.
- Listener check:
  Vite servers remained bound on `0.0.0.0:5173` and `0.0.0.0:5185`.

## 2026-06-06 PeerCompute Relay Smoke Checks

- VPN coturn dry-run:
  `bash scripts/dev-vpn-coturn.sh --dry-run` selected VPN host
  `100.86.83.35`, `RELAY_LISTEN_HOST=0.0.0.0`, dynamic relay port, and TURN
  host `100.86.83.35:3478`.
- Backend dry-run:
  `npm run backend:dry-run` reported relay plus coturn launch commands without
  starting services.
- Focused runtime P2P smoke:
  PeerCompute
  `RUNTIME_P2P_DEMOS=hyperborea DEMO_PORT=4191 RELAY_CONFIG_TIMEOUT_MS=15000 DEMO_TIMEOUT_MS=45000 node demos/tests/runtime-p2p.mjs`
  started the Go relay on a dynamic localhost port, wrote Hyperborea relay
  config, connected headless browser peers, disconnected cleanly, and printed
  `Runtime P2P tests passed`.

## 2026-06-06 Eshkol Handler Boundary and MoonLab Probe Checks

- ULG syntax:
  `node --check scripts/stage-service-assets.mjs`,
  `node --check src/runtime/artifactSummary.js`, `node --check src/main.js`,
  `node --check tests/orchestration.test.mjs`, and
  `node --check tests/demo.e2e.mjs` passed.
- MoonLab WASM rebuild:
  `pnpm build:wasm` in
  `/home/cos/projects/moonlab/bindings/javascript/packages/core` recreated
  `dist/moonlab.js` and `dist/moonlab.wasm` after MoonLab's TypeScript build
  cleaned the browser loader.
- ULG staging:
  `npm run stage:service-assets` passed after stricter validation for Eshkol
  `eshkol.ulg.production-handler-boundary.v0` metadata and MoonLab
  `moonlab.webgpu.complex64-probability-kernel-probe.v0` metadata.
- Staged artifact hashes:
  MoonLab parity scope
  `27b87fcdbd13574df63d83d4fe6aac5a31a740a0f77879c3e70a1a097c27c0bb`,
  MoonLab reference suite
  `7d4e6372e49689d2202914e210af84d19d776dc6fbc5b7e08b19cbedfb71b455`,
  Eshkol WASM
  `38902bb4b3f5ed8abf513a4d739ff9ca99727696df271c3ff17127575785b947`,
  and Eshkol artifact JSON
  `9532159bae058a193fc982113cca781e82182740e82e3f0b5ddbafe8b346b4c1`.
- ULG regression:
  `npm test` passed `20/20`, `npm run build` passed with the existing
  large-chunk warning, and `npm run test:e2e` passed `1/1`.
- Live listener check:
  `ss -ltnp 'sport = :5173'` and `ss -ltnp 'sport = :5185'` showed the ULG and
  PeerCompute Multiscale Vite servers bound to `0.0.0.0`.
- Live ULG runtime:
  Playwright against `http://100.86.83.35:5173/` reported two handoff
  artifacts, Eshkol `closureProductionHandlerBoundaryDeclared = true` with
  `handlerReady = false` and `runtimeExecution = false`, and MoonLab
  `moonlabWebGpuProbabilityKernelProbeDeclared = true` for
  `compute_probabilities` with `executed = false`, `passed = false`, and the
  native-operation-coverage blocker preserved.

## 2026-06-06 PeerCompute Production Handler Boundary Consumer Checks

- PeerCompute focused service orchestration:
  sidecar verification reported
  `node --test peercompute/tests/unit/serviceOrchestration.test.js --test-name-pattern 'production handler boundary|descriptor-only Eshkol closures without WASM bytes'`
  passed `26/26`.
- PeerCompute focused Multiscale model:
  sidecar verification reported
  `node --test demos/multiscale/tests/multiscaleModel.test.mjs --test-name-pattern 'production handler boundary|descriptor-only Eshkol closure'`
  passed `197/197`.
- PeerCompute Multiscale build:
  sidecar verification reported `npm --prefix demos/multiscale run build`
  passed with the existing large-chunk warning.
- PeerCompute diff/worktree:
  sidecar verification reported `git diff --check` passed and the post-commit
  PeerCompute worktree was clean at local commit `cd85fd9e`.
- Coordinator live bridge:
  `npm --prefix demos/multiscale run test:ulg-handoff` passed after
  `cd85fd9e`, reporting ULG `handoff ready / blockers 0`, Multiscale
  `handoff-ready`, blocker count `0`, `simulationStatus = scientific-ready`,
  bridge ack `handoff-ready`, and `magnetarVisible = true`.

## 2026-06-06 ULG Launch Status Checks

- ULG syntax:
  `node --check src/runtime/handoffStatus.js`, `node --check src/main.js`, and
  `node --check tests/handoffStatus.test.mjs` passed.
- ULG unit tests:
  `npm test` passed `22/22`, including the handoff-status formatter preserving
  the `handoff ready / blockers 0` compatibility prefix while surfacing scenario
  and simulation readiness fields.
- ULG browser smoke:
  `npm run test:e2e` passed `1/1`.
- ULG production build:
  `npm run build` passed with the existing large-chunk warning.
- Live bridge:
  PeerCompute `npm --prefix demos/multiscale run test:ulg-handoff` passed and
  reported ULG status
  `handoff ready / blockers 0 / scenario magnetar / scientific ready / 2 artifacts`,
  Multiscale `handoff-ready`, blocker count `0`,
  `simulationStatus = scientific-ready`, bridge ack `handoff-ready`, and
  `magnetarVisible = true`.

## 2026-06-06 ULG Live Status Script Checks

- Script syntax:
  `node --check scripts/live-status.mjs` passed.
- Default live status:
  `npm run status:live` passed against `http://100.86.83.35:5173/`, reporting
  two ready services, two handoff artifacts, MoonLab WebGPU parity scope ready,
  `compute_probabilities` probe declared but unexecuted, MoonLab calibrated
  reference ready count `4`, Eshkol descriptor/tensor runtime ready, and Eshkol
  production-handler boundary declared with handler/runtime execution false.
- Bridge live status:
  `npm run status:live -- --bridge` passed and reported Multiscale ack
  `handoff-ready`, blocker count `0`, `simulationStatus = scientific-ready`,
  and artifact count `2`.

## 2026-06-06 MoonLab Hadamard Probe and Eshkol Tensor Layout Checks

- MoonLab browser assets:
  `pnpm build:wasm` in
  `/home/cos/projects/moonlab/bindings/javascript/packages/core` rebuilt
  `dist/moonlab.js` and `dist/moonlab.wasm`.
- ULG syntax:
  `node --check scripts/stage-service-assets.mjs`,
  `node --check src/runtime/artifactSummary.js`, `node --check src/main.js`,
  `node --check scripts/live-status.mjs`,
  `node --check tests/orchestration.test.mjs`, and
  `node --check tests/demo.e2e.mjs` passed.
- ULG staging:
  `npm run stage:service-assets` passed with guards for MoonLab
  `moonlab.webgpu.complex64-native-operation-probe.v0` and Eshkol
  `eshkol.ulg.tensor-linear-memory-binding.v0`.
- Staged hashes:
  MoonLab WebGPU parity-scope JSON
  `7a4430a3ffa1a0a21807d36fefd1e465ecbad24ad7bfa725d7be4768fecd9f6b`,
  Eshkol magnetar closure artifact JSON
  `a7d77d237dcb9130030f1ea1a3357c0c30cf49932e5e6df978492e928d252841`,
  and Eshkol WASM
  `38902bb4b3f5ed8abf513a4d739ff9ca99727696df271c3ff17127575785b947`.
- ULG unit tests:
  `npm test` passed `22/22`.
- ULG production build:
  `npm run build` passed with the existing large-chunk warning.
- ULG browser smoke:
  `npm run test:e2e` passed `1/1`.
- Live status:
  `npm run status:live` reported MoonLab native-operation probe declared,
  hadamard declared with `executed = false`, `covered = false`, blocker
  `native-operation-probe-not-executed`, Eshkol tensor linear-memory binding
  ready, base offset `131072`, total byte length `168`, and handler/runtime
  execution false.
- Live bridge:
  `npm run status:live -- --bridge` passed and reported Multiscale ack
  `handoff-ready`, blocker count `0`, `simulationStatus = scientific-ready`,
  and artifact count `2`.

## 2026-06-06 PeerCompute Relay-Backed ULG Handoff Checks

- PeerCompute relay smoke syntax:
  sidecar verification reported
  `node --check demos/multiscale/tests/ulgRelayHandoffSmoke.mjs` passed.
- PeerCompute relay smoke:
  sidecar verification reported
  `npm --prefix demos/multiscale run test:ulg-relay-handoff` passed. The smoke
  started a dynamic Go relay, generated STUN/TURN ICE config with
  `iceServerCount = 2`, `hasStun = true`, and `hasTurn = true`, connected two
  Multiscale browser peers in one relay room, imported the live ULG handoff via
  `ulg-post-message`, and verified `handoff-ready`,
  `service-envelope-ready`, `relaySafeArtifactCount = 2`, and `dispatch-ready`.
- PeerCompute live handoff regression:
  sidecar verification reported
  `npm --prefix demos/multiscale run test:ulg-handoff` still passed against live
  ULG `5173` and Multiscale `5185`.
- PeerCompute cleanup:
  sidecar verification reported `git diff --check` passed, relay configs were
  preserved with no diff in `docs/multiscale/relay-config*.json`, and no
  test-owned `4196` server or relay process remained.

## 2026-06-06 MoonLab pauli_x Native Probe Handoff Checks

- MoonLab sidecar validation:
  sidecar verification reported focused WebGPU parity tests passed `12/12`,
  MoonLab unit tests passed `116/116`, `pnpm build:ts` passed with the existing
  package export-order warning, CLI parity artifact generation passed, and
  `git diff --check` passed.
- MoonLab browser assets:
  `pnpm build:wasm` in
  `/home/cos/projects/moonlab/bindings/javascript/packages/core` rebuilt
  `dist/moonlab.js` and `dist/moonlab.wasm`.
- ULG staging:
  `npm run stage:service-assets` passed with `hadamard` and `pauli_x` native
  operation probes both declared but unexecuted/uncovered.
- Staged MoonLab parity-scope hash:
  `61d04ad9eb66aa7804b64e063e7653acb76f4b0683a5035136ecff1e9d0d2bb2`.

## 2026-06-06 Eshkol Tensor Offset ABI Blocker Checks

- Eshkol sidecar validation:
  sidecar verification reported `ulg_magnetar_closure_fixture_test.py`,
  `eshkol_host_imports_smoke_test.js`, `ulg_closure_artifact_test.py`, focused
  `ctest`, and `git diff --check` all passed.
- ULG staging:
  `npm run stage:service-assets` regenerated the Eshkol magnetar artifact with
  `eshkol.ulg.tensor-entry-export-offset-probe.v0` and tensor runtime contract
  hash `sha256:4d16bf10f236832da92974cd341bb40a533cb2fe7c7ceab67ff8f6758645c95f`.
- Offset ABI blocker:
  staged ULG artifact reports `entryExportConsumesOffsets = false`,
  `outputTensorsProducedByEntryExport = false`,
  `changedBytesInDeclaredTensorRange = 0`, and blocker
  `main-export-accepts-two-i32-runtime-args-but-does-not-read-or-write-host-managed-tensor-offsets`.

## 2026-06-06 PeerCompute Relay Dispatch Adapter Diagnostic Checks

- PeerCompute syntax/build:
  sidecar verification reported `node --check demos/multiscale/src/main.js`,
  `node --check demos/multiscale/tests/ulgRelayHandoffSmoke.mjs`, and
  `npm --prefix demos/multiscale run build` passed with the existing large-chunk
  warning.
- Default relay smoke:
  sidecar verification reported
  `npm --prefix demos/multiscale run test:ulg-relay-handoff` passed.
- Adapter-enabled relay diagnostic:
  sidecar verification reported
  `ULG_RELAY_HANDOFF_RUN_DISPATCH=1 npm --prefix demos/multiscale run
  test:ulg-relay-handoff` now exits cleanly with structured diagnostic status
  `dispatchAdapterStatus = dispatch-adapter-popup-context-reset`, reaches
  `start`, `dispatch-plan-created`, and MoonLab `dispatch-start`, and records
  `runtimeGateRelaxed = false` plus `scientificGateRelaxed = false`.
- Strict failure mode:
  sidecar verification reported `ULG_RELAY_HANDOFF_REQUIRE_DISPATCH=1` is
  available to force this diagnostic blocker to fail while debugging adapter
  execution itself.
- Cleanup:
  sidecar verification reported relay config restore diff was empty for
  `docs/multiscale/relay-config*.json`, no test-owned `4196` listener or relay
  process remained, and `git diff --check` passed.
- Coordinator live status:
  `npm run status:live -- --bridge` on 2026-06-06 14:58:03 AKDT reported live
  ULG `5173` and Multiscale `5185` ready, with Multiscale ack
  `handoff-ready`, blocker count `0`, `simulationStatus = scientific-ready`,
  and artifact count `2`.

## 2026-06-06 ULG Generic Native Operation Summary Checks

- Syntax:
  `node --check src/runtime/artifactSummary.js`, `node --check src/main.js`,
  `node --check scripts/live-status.mjs`,
  `node --check tests/orchestration.test.mjs`, and
  `node --check tests/demo.e2e.mjs` passed.
- Unit tests:
  `npm test` passed `22/22`.
- Build and browser smoke:
  `npm run build` passed with the existing large-chunk warning, and
  `npm run test:e2e` passed `1/1`.
- Live status:
  `npm run status:live -- --bridge` reported
  `nativeOperationDeclaredOperations = ["hadamard", "pauli_x"]`,
  `nativeOperationBlockedOperations = ["hadamard", "pauli_x"]`, Multiscale ack
  `handoff-ready`, blocker count `0`, and
  `simulationStatus = scientific-ready`.
- Summary guard:
  `tests/orchestration.test.mjs` now includes a blocked `pauli_z` fixture entry
  in `browserNativeOperationProbe.operationResults[]`, proving ULG preserves
  future declared native operations through generic declared/blocked operation
  lists while still requiring `hadamard` and `pauli_x` compatibility blockers.
- Current live artifact path:
  `tests/demo.e2e.mjs` still expects the staged live MoonLab artifact to report
  the current two declared blocked native operations: `hadamard` and `pauli_x`.

## 2026-06-06 MoonLab pauli_z Native Probe Handoff Checks

- MoonLab sidecar validation:
  sidecar verification reported MoonLab local commit `e9bc324` passed
  `pnpm --dir bindings/javascript/packages/core build:ts`, focused
  `webgpu-complex64-parity.test.ts` with `13/13`, CLI parity artifact
  generation, `ulg-quantum-response-artifact.test.ts` with `14/14`,
  `pnpm --dir bindings/javascript/packages/core build:wasm`, and
  `git diff --check HEAD~1..HEAD`.
- ULG staging:
  `npm run stage:service-assets` passed after requiring `hadamard`, `pauli_x`,
  and `pauli_z` in the MoonLab native-operation probe.
- Staged MoonLab hashes:
  parity-scope JSON
  `5542be2ba09be9541666472a993c4c06e80ecb790cb57ec9cea3191aa3d02f27`,
  browser loader
  `4272298c649ad4141057cb7dc4ccc27dec5a8a79036ddf2a70a6dd76e84a7cfe`, and
  WASM
  `df924d4c907ace13caf58c6c15ba49bd97aadd351fce768bb936875d14475d78`.
- ULG validations:
  `node --check scripts/stage-service-assets.mjs`,
  `node --check src/runtime/artifactSummary.js`,
  `node --check tests/demo.e2e.mjs`, `npm test`, `npm run build`, and
  `npm run test:e2e` passed.
- Live status:
  `npm run status:live -- --bridge` reported
  `nativeOperationDeclaredOperations = ["hadamard", "pauli_x", "pauli_z"]`,
  `nativeOperationBlockedOperations = ["hadamard", "pauli_x", "pauli_z"]`,
  Multiscale ack `handoff-ready`, blocker count `0`, and
  `simulationStatus = scientific-ready`.
- Multiscale handoff:
  PeerCompute `npm --prefix demos/multiscale run test:ulg-handoff` passed with
  `magnetarVisible = true`, `magnetarLayer = solar`, and bridge ack
  `handoff-ready`.

## 2026-06-06 ICC Eshkol Registration Checks

- Parser dependency handling:
  `make install-parsers` in `/home/cos/projects/infinite_context_coder` hit the
  Ubuntu PEP 668 externally-managed system-pip guard, so the same parser package
  check/install was run through ICC's existing `.venv`. The packages were
  already present: `tree-sitter`, `tree-sitter-cpp`, and `tree-sitter-c`.
- Registry:
  `.venv/bin/python scripts/codebase_tool.py register --name eshkol --path
  /home/cos/projects/eshkol ...` succeeded with skips for `.git`, `build`,
  `node_modules`, `dist`, `.venv`, `__pycache__`, `.pytest_cache`, and `site`.
- Index:
  `.venv/bin/python scripts/codebase_tool.py index --repo eshkol` indexed
  `1578` files, `451140` lines, and `14294` symbol records with
  `tree_sitter_available = true`.
- Memory:
  `.venv/bin/python scripts/codebase_tool.py build-memory --repo eshkol` wrote
  `/home/cos/projects/infinite_context_coder/artifacts/repos/eshkol/codebase_memory`
  with `21334` chunks and Eshkol git head
  `ad878d0ab182b238b85e2acb89b329b52566464a`.
- Architecture summary:
  `.venv/bin/python scripts/codebase_tool.py architecture-summary --repo eshkol
  --bundle --include-cheatsheet` succeeded and identified Eshkol integration
  surfaces including `exe/eshkol-server.cpp`,
  `inc/eshkol/bridge/qllm_bridge.h`, `inc/eshkol/core/eval_bridge.h`, and
  tensor/backend paths.

## 2026-06-06 ULG Native Operation Staging Overclaim Guard Checks

- Syntax:
  `node --check scripts/stage-service-assets.mjs` passed.
- MoonLab-only staging:
  `npm run stage:service-assets -- --moonlab-only` passed and regenerated the
  MoonLab loader, WASM, normalized reference suite, and WebGPU complex64 parity
  scope with `hadamard`, `pauli_x`, and `pauli_z` blocked/unexecuted/uncovered.
- Unit tests:
  `npm test` passed `22/22`.
- Diff check:
  `git diff --check` passed.
- Full staging note:
  full `npm run stage:service-assets` was not used for this guard checkpoint
  because the active Eshkol sidecar has uncommitted Eshkol edits that currently
  make the Eshkol bundle export report `@define-ulg-closure ... entryExport='main'`
  while generated artifact execution uses `scheme_main`.

## 2026-06-06 ICC ULG Refresh Checks

- ULG index:
  `.venv/bin/python scripts/codebase_tool.py index --repo ulg` in
  `/home/cos/projects/infinite_context_coder` indexed `63` files, `25557` lines,
  and reported `tree_sitter_available = true` at ULG git head
  `f620e85459f389afd16e9a72134049a8730417cd`.
- ULG memory:
  `.venv/bin/python scripts/codebase_tool.py build-memory --repo ulg` wrote
  `/home/cos/projects/infinite_context_coder/artifacts/repos/ulg/codebase_memory`
  with `224` chunks.
- ULG architecture summary:
  `.venv/bin/python scripts/codebase_tool.py architecture-summary --repo ulg
  --bundle --include-cheatsheet` succeeded and identified `src/runtime`,
  `src/services`, `src`, and `src/visualization` as public module roots.

## 2026-06-06 MoonLab Native Operation Target Visibility Checks

- Syntax:
  `node --check src/runtime/artifactSummary.js`,
  `node --check scripts/live-status.mjs`,
  `node --check tests/orchestration.test.mjs`, and
  `node --check tests/demo.e2e.mjs` passed.
- Unit tests:
  `npm test` passed `22/22`.
- Live status:
  `npm run status:live -- --bridge` reported
  `nativeOperationTargetOperations = ["hadamard", "pauli_x", "pauli_z", "cnot"]`
  and `nativeOperationMissingTargetOperations = ["cnot"]`, while Multiscale
  ack stayed `handoff-ready` with blocker count `0` and
  `simulationStatus = scientific-ready`.

## 2026-06-06 PeerCompute Relay Dispatch Fix Checks

- PeerCompute sidecar validation:
  sidecar verification reported local PeerCompute commit `631b202` passed
  syntax checks for `demos/multiscale/src/main.js` and
  `demos/multiscale/tests/ulgRelayHandoffSmoke.mjs`, built
  `demos/multiscale` with the existing large-chunk warning, and passed both
  default and adapter-enabled relay handoff smokes.
- Adapter-enabled relay smoke:
  sidecar verification reported
  `ULG_RELAY_HANDOFF_RUN_DISPATCH=1 npm --prefix demos/multiscale run
  test:ulg-relay-handoff` now passes with `dispatch-adapters-ready`,
  `acceptedDispatchCount = 2`, and scientific scope flags all `false`.
- Coordinator handoff regression:
  `npm --prefix demos/multiscale run test:ulg-handoff` passed after
  PeerCompute `631b202`, reporting `handoff-ready`, blocker count `0`,
  `simulationStatus = scientific-ready`, and `magnetarVisible = true`.

## 2026-06-06 MoonLab cnot Native Probe Handoff Checks

- MoonLab sidecar validation:
  sidecar verification reported local MoonLab commit `fbc2ddf` passed
  `pnpm --dir bindings/javascript/packages/core build:ts` with the existing
  export-order warning, focused `webgpu-complex64-parity.test.ts` with `14/14`,
  CLI parity artifact generation/inspection for blocked `cnot`,
  `ulg-quantum-response-artifact.test.ts` with `14/14`, `build:wasm`, and
  `git diff --check`.
- ULG MoonLab-only staging:
  `npm run stage:service-assets -- --moonlab-only` passed after requiring
  `hadamard`, `pauli_x`, `pauli_z`, and `cnot` native-operation declarations.
- Staged MoonLab hashes:
  parity-scope JSON
  `dc391fa82a5e384c2b419e78c4066a88d6fbb76255867fbebd5d3b6a6a4a42d0`,
  browser loader
  `4272298c649ad4141057cb7dc4ccc27dec5a8a79036ddf2a70a6dd76e84a7cfe`, and
  WASM
  `df924d4c907ace13caf58c6c15ba49bd97aadd351fce768bb936875d14475d78`.
- Eshkol asset consistency:
  after the failed full staging attempt from active Eshkol sidecar edits, the
  ignored ULG `magnetar-closure.wasm` was restored from committed Eshkol source
  bytes to `53066` bytes with hash
  `38902bb4b3f5ed8abf513a4d739ff9ca99727696df271c3ff17127575785b947`.
- ULG validations:
  `node --check scripts/stage-service-assets.mjs`,
  `node --check src/runtime/artifactSummary.js`,
  `node --check scripts/live-status.mjs`,
  `node --check tests/orchestration.test.mjs`,
  `node --check tests/demo.e2e.mjs`, `npm test`, `npm run build`, and
  `npm run test:e2e` passed.
- Live status:
  `npm run status:live -- --bridge` reported
  `nativeOperationDeclaredOperations = ["hadamard", "pauli_x", "pauli_z", "cnot"]`,
  `nativeOperationBlockedOperations = ["hadamard", "pauli_x", "pauli_z", "cnot"]`,
  `nativeOperationMissingTargetOperations = []`, Multiscale ack
  `handoff-ready`, blocker count `0`, and
  `simulationStatus = scientific-ready`.
- Multiscale handoff:
  PeerCompute `npm --prefix demos/multiscale run test:ulg-handoff` passed with
  `magnetarVisible = true`, `magnetarLayer = solar`, and bridge ack
  `handoff-ready`.

## 2026-06-06 Eshkol Tensor Offset Runtime Smoke Handoff Checks

- Eshkol sidecar integration:
  local Eshkol commit `a13745e` exports a magnetar closure artifact whose
  top-level validation is `runtime-smoke` with validation mode
  `eshkol-deterministic-magnetar-tensor-abi-smoke`.
- Staged Eshkol artifact:
  source hash
  `sha256:630b20dd243be58f8e53631e934d09298696fe7e7ea84b15e7d7b89d18809b69`,
  WASM hash
  `sha256:e0a3c7d280678a8c1e40865daeab6601dc8a6a64cfa5b29b7b6bfcaddc86c5aa`,
  WASM byte length `169528`, and tensor contract hash
  `sha256:2289b8c8068f1a033cda20f09f30a33f2e41588b8ee2ccd1143100f2fe87dd64`.
- Tensor runtime evidence:
  ULG staging and summaries now require
  `runtimeStatus = deterministic-runtime-smoke-executed`,
  `executionClaim = deterministic-tensor-runtime-smoke-only`,
  `linearMemoryBinding.status = entry-export-runtime-smoke-passed`,
  `entryExportConsumesOffsets = true`, all declared tensors consumed by the
  entry export, offset probe `runtime-smoke-passed`, output tensors produced,
  `changedBytesInDeclaredTensorRange = 64`, and stdout invariant false.
- Production boundary:
  ULG requires the exact remaining blockers
  `production-magnetar-handler-not-implemented`,
  `full-physics-validation-not-run`; `handlerReady`, `runtimeExecution`,
  `scientificValidation`, and `fullPhysicsValidation` remain false.
- ULG validations:
  `node --check scripts/stage-service-assets.mjs`,
  `node --check src/runtime/artifactSummary.js`,
  `node --check scripts/live-status.mjs`,
  `node --check tests/orchestration.test.mjs`,
  `node --check tests/demo.e2e.mjs`, `npm run stage:service-assets`,
  `npm test`, `npm run build`, and `npm run test:e2e` passed.
- Live status:
  `npm run status:live -- --bridge` reported Eshkol
  `tensorLinearMemoryEntryExportConsumesOffsets = true`,
  `tensorEntryExportOffsetProbeStatus = runtime-smoke-passed`,
  `tensorEntryExportChangedBytesInDeclaredTensorRange = 64`,
  `productionHandlerReady = false`, Multiscale ack `handoff-ready`, blocker
  count `0`, and `simulationStatus = scientific-ready`.
- Multiscale handoff:
  PeerCompute `npm --prefix demos/multiscale run test:ulg-handoff` passed with
  the new Eshkol source/WASM hashes, `wasmByteLength = 169528`,
  `magnetarVisible = true`, `magnetarLayer = solar`, and bridge ack
  `handoff-ready`.
- PeerCompute sidecar validation:
  local PeerCompute commit `dc497229` updated browser and relay handoff smoke
  expectations for the new Eshkol artifact and passed syntax checks,
  `npm --prefix demos/multiscale run test:ulg-handoff`,
  `npm --prefix demos/multiscale run test:ulg-relay-handoff`, relay config
  cleanup checks, and `git diff --check`.

## 2026-06-06 Eshkol Runtime Smoke Visibility Checks

- UI visibility:
  Playwright now asserts the visible artifact row includes
  `tensor-probe:runtime-smoke-passed:offsets-consumed:64b` and
  `handler:declared-not-executed:3-blockers`.
- Live status:
  `npm run status:live -- --bridge` now reports Eshkol
  `validationStatus = runtime-smoke`,
  `tensorRuntimeStatus = deterministic-runtime-smoke-executed`,
  `tensorEntryExportOutputTensorsProduced = true`, expected entry args
  `[131072, 131136]`, stdout hash
  `sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`,
  `productionHandlerScientificValidation = false`,
  `productionHandlerFullPhysicsValidation = false`, and the exact three
  production blockers.
- Validation:
  `node --check scripts/live-status.mjs`, `node --check src/main.js`,
  `node --check tests/demo.e2e.mjs`, `npm test`, `npm run build`,
  `npm run test:e2e`, and `npm run status:live -- --bridge` passed.

## 2026-06-06 Eshkol Production Host Import Candidate Checks

- Eshkol sidecar validation:
  local Eshkol commit `b025f5d` added a
  `eshkol.ulg.production-host-import-candidate.v0` requirements block and
  passed focused host-import/fixture tests plus `eshkol-run` rebuild.
- ULG staging:
  `npm run stage:service-assets -- --eshkol-only` passed and regenerated the
  Eshkol magnetar closure bundle with `runtimeScope =
  production-candidate-host-imports`, `implementationStatus =
  production-candidate-runtime-imports-present`, production candidate status
  `production-candidate-runtime-imports-implemented`,
  `runtimeSmokeStubsAllowed = false`, f64 tensor-memory imports
  `ulg_read_f64`/`ulg_write_f64`, `23` required non-stub imports, and the
  remaining two production boundary blockers.
- ULG validations:
  `node --check src/runtime/artifactSummary.js`,
  `node --check scripts/stage-service-assets.mjs`,
  `node --check scripts/live-status.mjs`,
  `node --check tests/orchestration.test.mjs`,
  `node --check tests/demo.e2e.mjs`, `npm test`, `npm run build`,
  `npm run test:e2e`, and `npm run status:live -- --bridge` passed.
- Live status:
  `npm run status:live -- --bridge` reported production candidate status
  `production-candidate-runtime-imports-implemented`,
  `runtimeSmokeStubsAllowed = false`, required non-stub import count `23`,
  readiness requirements
  `production-magnetar-handler-implementation`, `non-stub-host-runtime-imports`,
  `validated-f64-tensor-memory-imports`, `full-physics-validation-pass`,
  preflight evidence counts `8/5/3`, Multiscale ack `handoff-ready`, and
  `simulationStatus = scientific-ready`.
- Full staging caveat:
  full `npm run stage:service-assets` was not used for this checkpoint because
  the active MoonLab sidecar temporarily removed or had not rebuilt
  `bindings/javascript/packages/core/dist/moonlab.js`; Eshkol-only staging was
  the relevant gate for this integration slice.

## 2026-06-06 MoonLab Browser Backend Preflight Checks

- MoonLab sidecar validation:
  local MoonLab commit `4e91165` added
  `moonlab.webgpu.complex64-browser-backend-preflight.v0` and passed TypeScript
  build, focused parity tests, CLI parity generation, required-backend failure
  behavior in the no-adapter runtime, quantum-response artifact tests, full core
  tests, WASM build, and `git diff --check`.
- ULG staging:
  `npm run stage:service-assets` passed and regenerated
  `webgpu-complex64-parity-scope.json` with
  `browserBackendPreflight.stage = navigator-gpu-unavailable`,
  `navigatorGpuAvailable = false`, `adapterAvailable = false`, and
  `deviceAcquired = false`.
- ULG validations:
  `node --check src/runtime/artifactSummary.js`,
  `node --check scripts/stage-service-assets.mjs`,
  `node --check scripts/live-status.mjs`, `node --check src/main.js`,
  `node --check tests/orchestration.test.mjs`,
  `node --check tests/demo.e2e.mjs`, `npm test`, `npm run build`,
  `npm run test:e2e`, and `npm run status:live -- --bridge` passed.
- Live status:
  `npm run status:live -- --bridge` reported MoonLab
  `browserBackendPreflightDeclared = true`,
  `browserBackendPreflightStage = navigator-gpu-unavailable`,
  `browserBackendPreflightNavigatorGpuAvailable = false`,
  `browserBackendPreflightAdapterAvailable = false`,
  `browserBackendPreflightDeviceAcquired = false`, Multiscale ack
  `handoff-ready`, and `simulationStatus = scientific-ready`.
- PeerCompute handoff:
  `npm --prefix /home/cos/projects/peercompute/demos/multiscale run test:ulg-handoff`
  passed with `magnetarVisible = true`, `magnetarLayer = solar`, bridge ack
  `handoff-ready`, and `simulationStatus = scientific-ready`.

## 2026-06-06 MoonLab Browser WebGPU Evidence ULG Checks

- ULG staging:
  `npm run stage:service-assets -- --moonlab-only` passed and regenerated
  `public/service-assets/moonlab/webgpu-complex64-parity-scope.json` through
  MoonLab's browser smoke harness with `--require-backend`.
- Staged parity-scope gate:
  the staged artifact reports schema
  `moonlab.webgpu.complex64-parity-scope.v0`, status
  `scope-ready-backend-detected`, `backendAvailable = true`,
  `requireBackend = true`, `browserBackendPreflight.stage = device-acquired`,
  `webgpuParity.executed = true`, `webgpuParity.passed = true`, zero blockers,
  `compute_probabilities` browser-kernel coverage, and native operation
  coverage for `hadamard`, `pauli_x`, `pauli_z`, and `cnot`.
- ULG syntax/regression:
  `node --check public/workers/moonlab-core-probe.worker.js`,
  `node --check src/runtime/artifactSummary.js`, `npm test`, and
  `npm run build` passed. Build retained the existing large-chunk warning.
- ULG browser e2e:
  first `npm run test:e2e` failed because the core-probe worker still rejected
  `backendAvailable = true` / executed browser parity as an overclaim. After
  updating that validator to require the successful reduced browser evidence
  and explicit no-full-physics flags, `npm run test:e2e` passed `1/1`.
- Live ULG runtime:
  Playwright against `http://127.0.0.1:5173/` showed the MoonLab artifact row
  containing `webgpu:backend`, `webgpu-preflight:device-acquired`,
  `wgsl:compute_probabilities-declared`, and covered native operations for
  `hadamard`, `pauli_x`, `pauli_z`, and `cnot`.
- PeerCompute relay-dispatch handoff:
  `ULG_RELAY_HANDOFF_RUN_DISPATCH=1 ULG_RELAY_HANDOFF_REQUIRE_DISPATCH=1 npm --prefix /home/cos/projects/peercompute/demos/multiscale run test:ulg-relay-handoff`
  passed with relay peers connected, `dispatchAdapterStatus =
  dispatch-adapters-ready`, `acceptedDispatchCount = 2`, ack `handoff-ready`,
  and `simulationStatus = scientific-ready`.
