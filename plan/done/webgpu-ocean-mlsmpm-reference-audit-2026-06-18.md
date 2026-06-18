# WebGPU-Ocean MLS-MPM Reference Audit

Date: 2026-06-18 AKDT

Status: completed Phase 1 architecture audit and routing decision.

## What Landed

- Cloned WebGPU-Ocean locally at `/tmp/ulg-webgpu-ocean-audit`.
- Inspected the MLS-MPM hot-loop files:
  `mls-mpm/mls-mpm.ts`, `clearGrid.wgsl`, `p2g_1.wgsl`, `p2g_2.wgsl`,
  `updateGrid.wgsl`, `g2p.wgsl`, and `copyPosition.wgsl`.
- Inspected the GPU render path in `render/fluidRender.ts` and related depth,
  thickness, blur, fluid, and sphere shaders.
- Confirmed the reference architecture uses particle-parallel P2G/G2P,
  fixed-point integer atomics for grid accumulation, grid-only clear/update
  passes, and GPU particle render buffers.
- Mapped the relevant ideas onto ULG: keep closure/provenance and validation in
  the control plane, but move the hot loop into an Ocean-style resident lane
  with scatter/tiled P2G, resident sidecars, throttled compact diagnostics, and
  GPU-resident surface/render generation.
- Corrected the Worker warning interpretation in the plan docs: the current
  code passes `enableWorkers=true`, so `peercompute-worker-inline-fallback`
  remains a Worker capability/bootstrap blocker.

## Decision

Do not spend major effort optimizing fallback readbacks or CPU mesh extraction
that the resident lane should replace. Tactical fixes remain worthwhile only
when they clear console errors, keep the fallback path truthful, or protect
current browser probes while the replacement backend is built.

## Validation

- H2O/H2O MLS-MPM probe
  `/tmp/ulg-h2o-h2o-mlsmpm-no-reaction-summary-readback-20260618.json`
  classified `good` with zero browser-console issues/warnings.
- Na/H2O MLS-MPM probe
  `/tmp/ulg-na-h2o-mlsmpm-compact-gas-only-reaction-summary-20260618.json`
  classified `good` with zero browser-console issues/warnings and preserved
  `gpu-resident-reaction-pressure-summary`.
- Focused reaction summary/kernel and resident-step tests passed.

## Remaining Follow-Up

- Build the explicit Ocean-style resident lane backend.
- Fix browser Worker bootstrap/capability so Worker-requested resident tasks do
  not remain inline.
- Keep console-harness probes in the acceptance path for every browser
  performance claim.
