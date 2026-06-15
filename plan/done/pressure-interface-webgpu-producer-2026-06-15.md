# Pressure/interface WebGPU force-row producer - 2026-06-15

Status: done.

This slice added the first WebGPU-resident producer for pressure/interface
force rows. The producer preserves the existing law content: uniform gas
pressure times material-interface normal-area vector, with equal and opposite
gas reaction force. It writes the same 16-float
`SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT` ABI as the CPU oracle.

Key implementation points:

- Added `sphPressureInterfaceForceRowsWgsl` in `ulg-gpu-abi/src/wgsl.js`.
- Added `src/runtime/sph/sphPressureInterfaceGpuKernel.js` with material
  interface element packing, `PressureInterfaceParams` packing, WebGPU
  dispatch, optional readback, and no-full retained `forceRowsBuffer` output.
- Updated `runSphPressureInterfaceStageComputeTask()` to use the WebGPU
  producer when `preferWebGpu=true` and a WebGPU device is available, while
  preserving CPU fallback.
- Updated the resident Worker so `gridUpdate` can consume the raw
  `forceRowsBuffer` retained by the immediately preceding `pressureInterface`
  stage on the same Worker lane.
- Added the new pressure params uniform to the WebGPU ABI drift guard.

Validation:

- `node --check src/runtime/sph/sphPressureInterfaceGpuKernel.js`
- `node --check src/runtime/sph/sphMlsMpmGpuStep.js`
- `node --check src/services/ulgMechanicsResidentStage.worker.js`
- `node --check tests/sphPressureInterfaceGpuKernel.test.mjs`
- `node --check tests/sphMlsMpmGpuStep.test.mjs`
- `node --test tests/sphPressureInterfaceGpuKernel.test.mjs` passed `2/2`.
- `node --test tests/webgpuKernelAbi.test.mjs` passed `1/1`.
- `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "pressure interface"`
  passed `38/38`.
- `node --test tests/ulgMechanicsResidentStageWorker.test.mjs` passed `4/4`.
- `node --test tests/peercomputeComputeManagerIntegration.test.mjs` passed
  `13/13`.
- `npm run test:physics-atomics` passed `7` checks with `1` expected opt-in
  long-horizon liquid skip.
- Focused browser authority-host Playwright gate passed `1/1`.
- Visual matrix `codex-pressure-interface-webgpu-producer-20260615` passed
  `3/3`, with no issues, no visual-surface issues, and two captured frames per
  scenario.

Next:

- Reduce remaining pressure publication/consumption copies and readback
  surfaces between the WebGPU producer, StateManager admission descriptor, and
  WebGPU grid consumer.
- Keep the renderer z-buffer/draw-order blocker queued separately from physics
  acceptance.
