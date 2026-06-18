# WGSL Render-Field Surface Summary Reserved Identifier

Date: 2026-06-18 AKDT

Status: completed parser fix.

## What Landed

- Renamed `let active` to `has_active_cells` in
  `sphRenderFieldSurfaceSummaryWgsl`.
- Added a WebGPU ABI guard that rejects exact WGSL local declarations matching
  `let|var|const active`.

## Validation

- `node --check ulg-gpu-abi/src/wgsl.js`
- `node --check tests/webgpuKernelAbi.test.mjs`
- `node --test tests/webgpuKernelAbi.test.mjs`: `2/2` pass.
- Visual matrix `codex-nodekernel-stage-execution-authority-20260618` passed
  with no `Invalid ShaderModule`, `Invalid ComputePipeline`, or
  reserved-`active` matches in the collected run artifacts.
- Later browser-console-capturing probes under the WebGPU console harness
  reported no WGSL parser or invalid shader/pipeline issue counts.

## Remaining Follow-Up

- The separate `ulg-sph-thermal-output-state used in submit while destroyed`
  console warning remains open under thermal hot-buffer lifetime/lease cleanup.
