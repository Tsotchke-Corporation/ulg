# ULG Test Plan

## Local Unit Tests

Command: `npm test`

Current result: pass, 10/10 tests on 2026-06-05 after adding adapter fixture
coverage.

- ABI descriptor construction and complex64 round trip.
- JSON schema validation for service manifests, task capsules, closure artifacts,
  quantum response artifacts, and tolerance reports.
- Static Eshkol/MoonLab adapter fixtures validate against the shared schemas.
- Service contract builders reproduce the published manifest defaults and emit a
  schema-compatible default MoonLab task capsule.
- Registry resolution, child-worker lease limits, artifact cache behavior, and
  GPU fallback probe behavior.

## Production Build

Command: `npm run build`

Current result: pass on 2026-06-05 after the service-contract runtime refactor,
with the existing large three.js chunk warning.

## Browser Smoke

Command: `npm run test:e2e`

Current result: pass, 1/1 Chromium test on 2026-06-05 after the demo runtime
started consuming the shared service contract builders.

- Load the Vite app through Playwright.
- Verify two supervised services register and run.
- Verify worker telemetry appears.
- Verify the three.js canvas is nonblank at desktop and mobile viewport sizes.
- Save screenshots into `test-results/`.

## Manual Stack Follow-up

- PeerCompute sidecar verified syntax, unit, Multiscale unit, Multiscale build,
  backend dry-run, and VPN coturn dry-run in `/home/cos/projects/peercompute`.
- Eshkol sidecar verified `cmake --build build --target eshkol-run -j2`,
  native hello compile/run, WASM hello emission, LLVM 21 build config, CUDA GPU
  enabled config, and RTX 3090 visibility. It also found no real WebGPU/WGSL
  implementation and one JIT derivative hang to avoid in the browser service path.
- MoonLab sidecar verified native unit binaries and `qsim_test`, while JS unit
  and integration tests need fixes before real MoonLab service integration.
- Bring up the peercompute relay-backed local stack after the dummy ULG service
  smoke is stable.
- Reuse peercompute's existing runtime P2P smoke harness where possible.
- Add STUN/TURN/ICE/relay coverage once the service registry integration lands
  in peercompute proper.
