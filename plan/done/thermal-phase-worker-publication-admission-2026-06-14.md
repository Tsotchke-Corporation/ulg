# Thermal/Phase Worker Publication Admission - 2026-06-14

Completed: 2026-06-14 23:36 AKDT.

What changed:

- Added thermal/phase worker-retained publication schemas and authority-host
  publication support:
  `peercompute.ulg.thermal-phase-worker-retained-buffer-import.v0` and
  `peercompute.ulg.thermal-phase-worker-retained-hot-buffer-publication.v0`.
- Split worker-retained publication candidates by stage family. Mechanics
  publication now keeps mechanics refs/families, while `thermalPhase` builds a
  dedicated thermal retained-ref candidate for `sph-thermo-phase`.
- The formal `thermalPhase` stage-plan path can now call a thermal-specific
  publisher, store a StateManager hot record with the live Worker backend, and
  commit a warm delta under `ulg-worker-retained-thermal-phase-publications`.
- The browser authority gate asserts thermal publication candidate readiness,
  hot-buffer storage, warm-delta admission, retained thermo refs, and
  `sph-thermo-phase` output family admission.

Validation:

- PASS: `node --check src/runtime/sph/sphMlsMpmGpuStep.js`.
- PASS: `node --check src/runtime/peercomputeBrowserResidentHost.js`.
- PASS: `node --check tests/peercomputeComputeManagerIntegration.test.mjs`.
- PASS: `node --check tests/demo.e2e.mjs`.
- PASS: `git diff --check`.
- PASS:
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "ULG resident solver descriptors publish executable pass-DAG plus metadata law-family nodes"`
  reported `11/11`.
- PASS:
  `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "thermal phase stage compute task"`
  reported `33/33`.
- PASS:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  reported `1/1`.
- PASS: `npm run test:physics-atomics` reported `7` passing checks and `1`
  expected opt-in long-horizon liquid skip.
- PASS: visual matrix `codex-thermal-publication-admission-20260614`
  reported `failedCount=0` for `3` filtered scenarios with two captured frames
  each: `liquid-liquid-h2o-mlsmpm`, `solid-h2o-cpu-sph`, and
  `law-pressure-off-h2o-mlsmpm`.

Remaining:

- Promote pressure/interface and reaction/product stages behind the same
  ComputeManager/GPUHub Worker authority.
- Make downstream stages consume the admitted thermal retained-ref descriptor
  rather than relying only on a same-Worker lane record.
