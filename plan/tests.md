# ULG Test Plan

## Local Unit Tests

Command: `npm test`

Current result: pass, 18/18 tests on 2026-06-06 after adding optional MoonLab
reference-contract asset probing, normalized supplied reference staging,
four-family ready calibrated-reference summaries, and Eshkol magnetar closure
descriptor summaries.

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
  JSON, WASM, schema snapshot, and bundle manifest URLs.
- Service asset probes classify ready, missing, and wrong-MIME loader/WASM
  responses.
- Service asset probes report a missing optional MoonLab reference-contract JSON
  without changing required loader/WASM readiness.
- `npm run stage:service-assets -- --dry-run --json` reports the MoonLab and
  Eshkol source/target plan without mutating the ignored service-asset tree.
- `npm run stage:service-assets -- --eshkol-only --created-at ...` forwards a
  fixed timestamp to Eshkol helpers that support reproducible bundle metadata.
- MoonLab service asset specs include the classic core probe worker URL and the
  manifest builder approves it for child-worker leasing.
- Registry resolution, child-worker lease limits, artifact cache behavior,
  artifact-summary telemetry behavior, and GPU fallback probe behavior.
- Child-worker leases preserve `classic` vs `module` worker type metadata.
- Artifact cache summaries preserve Eshkol closure entry signature,
  start-section, import/export, WASM metadata count, and DOM-free host-import
  bundle metadata.
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

## Production Build

Command: `npm run build`

Current result: pass on 2026-06-06 after optional MoonLab reference-contract
asset support, with the existing large three.js chunk warning.

## Browser Smoke

Command: `npm run test:e2e`

Current result: pass, 1/1 Chromium test on 2026-06-06 after optional MoonLab
reference-contract asset support.

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
  fixture checksum `50`, and `closureOutputSemanticsReady = false` while still
  staying service-worker-safe and dynamic-code-free.
- Eshkol magnetar closure browser handoff check on 2026-06-06:
  `npm run stage:service-assets -- --eshkol-only`,
  `npm run stage:service-assets -- --dry-run --json`,
  `npm run stage:service-assets`, `npm test`, `npm run build`, and
  `npm run test:e2e` passed after switching the ULG Eshkol service manifest to
  `magnetar-closure`. The live 5173 handoff exports
  `closureKind = "magnetar-closure-descriptor-fixture"`,
  `closureDescriptorReady = true`, `closureOutputSemanticsReady = false`,
  `scientificValidation = false`, and `wasmByteLength = 53066`.
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
