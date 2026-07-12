# ULG Triad Demo

Browser-native ULG integration scaffold for the PeerCompute + Eshkol + MoonLab plan in
`plan/ULG_Triad_v0.5_Pretty_Diagrams.pdf`.

This repo currently implements the first executable slice:

- shared ULG GPU ABI descriptors and JSON schemas;
- ABI-level closure-table WGSL descriptors plus a stable f32x4 sample-buffer
  encoder for table interpolation without a general LLVM-to-WGSL compiler;
- shared service contract builders and adapter fixtures;
- PeerCompute-style compute service registry;
- supervised root service workers;
- child-worker leases with cancellation;
- GPU capability probing with CPU/WASM fallback status;
- browser-facing service asset probes for real MoonLab/Eshkol readiness;
- a supervised MoonLab WASM Bell-state probe with deterministic response/parity metadata and a magnetar dipole Ising calibration sub-artifact when copied core artifacts are available;
- a staged Eshkol magnetar closure descriptor fixture with explicit tensor-runtime and production-handler boundary metadata for Demo A handoff wiring;
- a compact MoonLab WebGPU complex64 parity handoff with reduced-scope browser evidence for `hadamard`, `pauli_x`, `pauli_z`, `cnot`, and `compute_probabilities` without claiming full MoonLab runtime or full magnetar physics validation;
- a Phase 2 ULG carrier runtime with a `ClosureRegistry`, table-interpolation closure handle, CPU-reference two-particle oscillator, optional WebGPU carrier step, CPU/WebGPU parity gate, device-loss CPU fallback reporting, invariant drift report, `ulg-runtime` service contract, and simulation artifacts that remain explicitly toy/reference scoped;
- Phase 3A carrier topology primitives: normalized particle state, deterministic spatial hashes, radius-limited neighbor pairs, and closure-sampled edge messages with antisymmetric force checks for future field/material/EOS operators, without claiming SPH or phase-change validation;
- Phase 3A field observers over neighbor graphs with compact-support scalar smoothing summaries for future material/EOS closure inputs, still without claiming an SPH solver or phase-change validation;
- Phase 3A field-closure sample descriptors over observed scalar fields for future closure-field interpolation, without claiming material, EOS, SPH, or phase-change validation;
- an SPH Phase overlay that starts first-principles material/reaction/view-state
  rebuilds in the supervised `ulg-runtime` worker when available, persists
  derived material plus reaction/product cold-start records in browser storage,
  exposes cache/timing diagnostics and a scoped `Clear Cache` control, and
  warns when CPU-backed derivation is dragging FPS instead of silently hiding
  the stall;
- a direct browser handoff launcher that opens PeerCompute Multiscale and reports scenario/readiness ack status;
- a three.js worker-tree visualization.

The current executable solver/law inventory, maturity classifications, and
explicitly missing physics are maintained in
[`plan/solver-law-inventory.md`](plan/solver-law-inventory.md).

## Commands

```bash
npm install
npm run dev
npm run stage:service-assets
npm run status:live
npm run status:live -- --bridge
npm test
npm run build
npm run test:e2e
npm run test:sph-standard-visual
```

The Vite demo exports `window.__ulgDemo` for smoke tests and browser inspection.
`window.__ulgDemo.createPeerComputeHandoff()` exports the current artifact cache
as `peercompute.ulg.demo-handoff.v0` packets for PeerCompute/Multiscale
ingestion.
Use the `SPH Phase` button for the two-material SPH/MLS-MPM evidence slice. The
overlay reports separate render, physics, and resident FPS; warns when WebGPU or
closure work falls back to CPU; and includes `Clear Cache` for ULG SPH
localStorage cache families only. Its scenario menu includes the standard
`water-cycle`, `iron-ice-quench`, `sodium-water`, and `cesium-fluorine`
setups; the same immutable preset records drive
`npm run test:sph-standard-visual`. That command records interval compositor
frames, authoritative GPU material/phase checkpoints, performance timing, and
three deterministic seeded random element-pair checks. Visual acceptance is
pinned to `renderer=native-webgpu` with the
`native-webgpu-surface-consumer`; captures suppress overlay UI and fail on any
blank, uniform, stale, wrong-canvas, or fallback interval. Particle spheres
and offscreen draws are diagnostic-only.
The `gpu-resident-physics-refactor` branch now presents one native WebGPU
triangle surface with generation-owned packed octahedral normals. The
production framebuffer path is alpha-one, unblended, and depth writing; the
selected background image is drawn by the native opaque pass so it is visible
and included in the scene-color copy. A bounded two-submission presentation
window restored the measured cadence from about 30 FPS to about 60 FPS without
weakening submit-fenced resource retirement. Accepted visual checkpoints are
`/tmp/ulg-background-native-after2.png` and
`/tmp/ulg-thickness-refraction-live2.png`.

Dielectric refraction now requires an exact, nonblocked, provenance-bearing
spectral optical-state match with distinct blue, green, and red samples. A
same-encoder `depth32float` backface pass supplies geometric thickness and is
cached for a stable camera; it adds no queue submission. Missing authority or
valid rear geometry fails closed to opaque reflective PBR. The current
molecular response is a reduced, scientifically unvalidated STO-3G RHF
occupied/virtual dipole response with Lorentz-Lorenz local-field conversion,
not a validated first-principles optical solution.

Presentation-resource liveness, sparse FIELD-0 execution, and removal of the
300k reaction step's 192 MB of host zero uploads are implemented. The overall
refactor is not accepted: manufactured/metamorphic thickness tests, a fresh
standard named/random visual matrix, parallel product placement, removal of
redundant neighborhood generations, exact live-prefix dispatch, thermal
indexing, and persistent workspaces remain open. New Schroeder WebGPU work is
validated with GPU manufactured states, invariants, same-device A/B paths, and
fixed-size reductions, never a CPU mirror/parity acceptance gate. Optional
same-device timestamps use `gpuProfile=1` /
`ULG_PROBE_GPU_PROFILE=1`; host enqueue and queue-fence time are reported
separately from GPU time.
`window.__ulgDemo.runOscillatorDemo()` stores a toy harmonic table closure in
the `ClosureRegistry`, resolves it in range, submits a supervised
`simulation.step` task to `ulg-runtime`, requests WebGPU with CPU-reference
fallback, and emits a `peercompute.ulg.simulation-artifact.v0` carrier delta
artifact. WebGPU output is accepted only when it passes CPU-reference parity;
otherwise the artifact records the fallback reason. This is a
core-runtime/provenance slice, not calibrated SPH or full-physics validation.
The runtime also includes standalone Phase 3A topology primitives:
`normalizeParticleState()`, `buildSpatialHash()`, `queryNeighborPairs()`, and
`evaluateEdgeMessages()` are deterministic CPU-reference building blocks for
future field operators, and the two-body carrier force path now consumes them
before emitting compact deltas with edge-message conservation summaries. They
also include `evaluateFieldObservers()` for compact-support scalar field
observations over the neighbor graph. Carrier simulation deltas now preserve
field-observer summaries for scalar carrier fields including mass without
calling those observations density, EOS, phase, or SPH state. They do not yet
implement a material model, EOS phase changes, or an SPH solver.
The same topology pass now emits `fieldClosureSampleSummary` telemetry through
`evaluateFieldClosureSamples()`, sampling the toy closure over the observed
`closureAxisR` scalar field as an operator descriptor. This is closure-field
interpolation evidence for future material/EOS operators, not material
properties, density, SPH dynamics, phase behavior, or scientific validation.
Those summaries include a `peercompute.ulg.closure-refresh-request.v0`
decision object. When observed fields leave the declared closure table domain,
the runtime can recommend `invalidate-and-rerun-closure-derive` through
`ClosureRegistry.applyRefreshRequest()` without claiming material, EOS, SPH, or
phase-change validation.
Simulation artifact summaries and the live artifact row surface this topology
operator evidence as `edge:pass`, `field:pass`, and `closure-field:pass` when
compact deltas carry valid edge-message, field-observer, and field-closure
sample summaries.
`npm run status:live` probes the live VPN-served demo and prints a compact JSON
readiness report. Add `-- --bridge` to also launch/post the handoff to
PeerCompute Multiscale and report the browser ack.

The cross-repo adapter contract lives in `ulg-gpu-abi/README.md` with fixture
manifests and task capsules in `ulg-gpu-abi/examples/`.
`createClosureTableDescriptor()` also emits a
`peercompute.ulg.closure-table-wgsl-descriptor.v0` layout contract for
`ClosureTableSample` storage-buffer rows, and
`createClosureTableSampleBuffer()` encodes normalized table samples into the
same f32x4 row layout consumed by the carrier WGSL path.
The oscillator closure cached by `runOscillatorDemo()` now carries the same
descriptor in `tableDescriptor.wgslTableDescriptor` and
`execution.wgslTableDescriptor`, so the browser cache exposes the table/WGSL
contract before any production compiler path exists.

## Service Assets

Vite serves `public/service-assets/` at `/service-assets/`. Run
`npm run stage:service-assets` to refresh the ignored browser-facing artifacts
from the sibling MoonLab and Eshkol repos, or copy individual artifacts there
when testing real services, for example
`public/service-assets/moonlab/moonlab.js` and
`public/service-assets/moonlab/moonlab.wasm`. Pass
`--created-at <iso-timestamp>` to make the regenerated Eshkol closure artifact
and bundle manifest timestamps byte-stable when the sibling Eshkol helper
supports that option. The MoonLab manifest convention
uses `entry.serviceAssets` plus `locateFile("moonlab.wasm")` so workers can
probe loader/WASM fetchability and MIME readiness before running the supervised
MoonLab core probe. The optional
`public/service-assets/moonlab/magnetar-reference-contracts.json` file can
provide MoonLab's normalized calibrated reference suite; a missing optional
file is reported but does not block MoonLab loader/WASM readiness. When the
assets are ready, the MoonLab task artifact records
the `bell_phi_plus` basis probabilities from the real WASM module, an analytic
Bell-state response descriptor, a passing `moonlab-wasm-core` comparison, and an
explicit `moonlab-webgpu` unsupported parity entry until MoonLab exposes browser
WebGPU response kernels. The same core probe also evaluates the
`magnetar-dipole-ising-calibration` handoff through MoonLab WASM Ising exports,
recording normalized dipole fields, eight bitstring energies, ground state
`000`, and `maxEnergyDelta = 0` against the JavaScript reference. The MoonLab
artifact keeps the legacy `outputs.reference` field and also emits
`outputs.references[]` as the four-entry calibrated magnetosphere MHD, PIC,
radiation, and relativistic-reference inventory. The magnetosphere entry now
carries a scoped analytic dipole-field reference with field maps, tolerances,
observed deltas, and SHA-256 contract/unit hashes. When the optional normalized
MoonLab reference suite is staged, all four calibrated families can be promoted
to ready reference entries; compact
artifact-summary telemetry reports both the ready Ising reference and the
calibrated inventory counts so handoff consumers can inventory tolerance inputs
without fetching the full artifact body. The staged suite contains reduced scalar
tolerance plumbing and does not claim full PIC, radiation-transport, GR, GRMHD, or
magnetar scientific simulation. The optional
`public/service-assets/moonlab/webgpu-complex64-parity-scope.json` artifact
records MoonLab's reduced browser WebGPU complex64 evidence and compact handoff
summary. ULG staging now requires `browserBackendPreflight.stage =
device-acquired`, executed/passing `compute_probabilities`, `hadamard`,
`pauli_x`, `pauli_z`, and `cnot` probes, browser-native coverage for those five
reduced operations, zero parity-scope blockers, and explicit
`fullFidelityMagnetarSimulation = false` / `fullPhysicsValidation = false`
flags. This is a reduced five-operation handoff, not a full MoonLab runtime
backend or full magnetar physics validation.

For Eshkol, the default staged bundle is
`public/service-assets/eshkol/closures/magnetar-closure/`. It packages
`magnetar-closure.wasm` with deterministic runtime-smoke metadata under
`validation.closureDescriptor.schema =
"eshkol.ulg.magnetar-closure-descriptor.v0"`, including typed magnetar
input/output tensor ids, a declared tensor-runtime contract, derivative
placeholders, and explicit non-scientific/full-physics flags. The descriptor
also carries `eshkol.ulg.production-handler-boundary.v0`, which identifies the
intended PeerCompute handler boundary and now records deterministic
production-candidate handler/runtime smoke evidence with `handlerReady: true`
and `runtimeExecution: true`. Its tensor-runtime contract includes a concrete
smoke-only f64 linear-memory layout at byte range `131072..131240`; the staged
metadata records that the `main` export consumes the declared input offsets,
produces output tensors, and changes `64` bytes in the declared tensor range.
The boundary also exposes a production-host-import candidate contract:
`runtimeSmokeStubsAllowed: false`, `23` required non-stub runtime imports, f64
tensor-memory imports `ulg_read_f64`/`ulg_write_f64`, and readiness requirements
for non-stub host imports, validated tensor memory imports, and full physics
validation. The current ULG staging sync preserves Eshkol's
production-candidate runtime probe: it runs the deterministic
`main(131072, 131136)` tensor smoke path through production-candidate host
imports and records the output tensor evidence. The bundle also declares the
transferable `eshkol.ulg.production-handler-contract.v0` production handler
contract for PeerCompute dispatch: `main(i32 inputOffset, i32 outputOffset) ->
i32`, backed by content-addressed WASM, production-candidate host imports,
validated f64 linear-memory tensors, the runtime probe,
production-candidate handler implementation evidence, and
production-candidate runtime-execution evidence. Its
`eshkol.ulg.full-physics-validation-requirements.v0` block declares the five
runtime evidence families still required from PeerCompute/MoonLab:
magnetosphere MHD, PIC kinetic plasma, radiation transport, relativistic
correction, and cross-family conservation coupling, with reference, tolerance,
runtime-output, and evidence hashes required. The computed production dispatch
preflight is still blocked at `10/9/1`: nine checks pass, while full-physics
validation remains blocked by `full-physics-validation-not-run`. ULG now treats
the bundle's DOM-free
`eshkol-host-imports.js` as a first-class browser/service-worker asset: the
service asset probe fetches it as JavaScript, the supervised Eshkol worker
imports it, verifies the `createEshkolHostImportObject` and tensor-memory
binding factory surface, and exposes production-host candidate requirement
metadata in compact artifact summaries. This advances production-boundary
evidence without claiming a full-fidelity or scientifically validated magnetar
simulation.
