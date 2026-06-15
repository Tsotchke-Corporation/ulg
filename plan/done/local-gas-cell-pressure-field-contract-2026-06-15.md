# Local Gas-Cell Pressure Field Contract - 2026-06-15

## Summary

ULG now has the first concrete local gas-cell pressure field contract for
pressure/interface force production. The existing uniform sealed-gas pressure
law remains available, but CPU and WebGPU pressure force-row producers can also
consume per-cell pressure plus pressure-gradient rows and reconstruct local
interface pressure at material-interface centroids.

## Completed

- Extended `gasPressureCellFieldSummary()` to normalize caller-supplied local
  gas pressure cells with `centerM`, `pressurePa`, `pressureGradientPaPerM`,
  volume, grid index, and ready status.
- Updated CPU pressure/interface preview and solver to use nearest-cell
  pressure plus first-order gradient reconstruction when
  `localPressureGradientReady=true`.
- Added `packGasPressureCellRows()` with a 12-float row layout for WebGPU
  pressure/interface execution.
- Expanded `PressureInterfaceParams` to 32 bytes and added WGSL binding 3 for
  gas pressure cell rows.
- Updated the WGSL pressure/interface force-row producer so each interface
  element uses either uniform pressure or nearest-cell/gradient local pressure
  before writing the existing 16-float force-row ABI.
- Added CPU, WebGPU, and ABI tests for the new local pressure-cell field path.

## Validation

- PASS: syntax checks for changed runtime/test modules.
- PASS:
  `node --test tests/sphPhaseDemo.test.mjs --test-name-pattern "sealed gas pressure feedback|gas pressure interface"`
  reported `26/26`.
- PASS: `node --test tests/sphPressureInterfaceGpuKernel.test.mjs` reported
  `3/3`.
- PASS:
  `node --test tests/webgpuKernelAbi.test.mjs --test-name-pattern "uniform buffer ABI"`
  reported `1/1`.
- PASS:
  `node --test tests/abi.test.mjs --test-name-pattern "pressure|SPH GPU render field ABI|WebGPU"`
  reported `17/17`.
- PASS:
  `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "pressure interface stage|pressure interface|grid admission|grid force"`
  reported `38/38`.
- PASS: `npm run test:physics-atomics` reported `7` passing checks and `1`
  expected opt-in long-horizon liquid skip.
- PASS:
  `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "SPH phase resident steps can use the real browser PeerCompute resident authority host"`
  reported `1/1`.
- PASS:
  `ULG_VISUAL_MATRIX_RUN_ID=codex-pressure-local-gas-cell-field-20260615 ULG_VISUAL_MATRIX_SCENARIOS=liquid-liquid-h2o-mlsmpm,liquid-liquid-h2o-cpu-sph,solid-h2o-cpu-sph ULG_VISUAL_MATRIX_BATCHES=1 ULG_VISUAL_MATRIX_BATCH_STEPS=4 ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_FRAME_MAX=2 ULG_VISUAL_MATRIX_FRAME_EVERY=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=240000 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run probe:sph-visual-matrix`
  reported `failedCount=0`.

## Open

- The field can be consumed by CPU/WebGPU pressure rows, but it is still
  caller-supplied. The next slice should publish/admit retained local gas-cell
  buffers through NodeKernel/StateManager and make the pressureInterface stage
  consume those admitted refs inside the ComputeManager/GPUHub DAG.
- Renderer z-buffer/focus-change issues remain separate visual-correctness
  blockers.
