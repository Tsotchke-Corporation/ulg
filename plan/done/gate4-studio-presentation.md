# Gate 4 — Decoupled Interactive Studio Presentation (`>= 54 Hz`, All 5 Active Presets)

## Accepted — 2026-11-23 UTC

All three `ulg-gate4-studio-presentation` criteria pass on one exact,
committed, source-bound receipt bundle (`feat/star-spec-generalization-audit` @
`44bb6f1367bf4f00dde90f855411c4f99dc92189`, `dirty: false`):

1. `gate4-presentation-candidate-review`: **PASS**
2. `gate4-five-preset-visible-cadence`: **PASS**
3. `gate4-shared-optics-and-gpu-invariants`: **PASS**

ICC selected `HEAD:.icc/completion-oracles.yaml` (`ulg-gate4-studio-presentation`)
on a fresh index (`FRESH` at `44bb6f13`), reporting `status: "complete"`,
`Criteria: 3`, and `Summary: {'PASS': 3}`.

## Adversarial 2-Round Independent Review Lineage

Acceptance followed two rigorous independent audit rounds by fresh read-only
research subagents, with the earlier honest FAIL report preserved on disk:

- **Round 1 FAIL (`2d955c07`, reviewer `1f1af049-4aa2-418e-8247-8b30385e72ed`,
  preserved at `independent-review-round1-fail.md`):** Found an unconditional
  Zeno's-paradox infinite motion horizon in `workerOwnedIsosurfacePresenter.js`
  (repeating `slowIsosurfaceMotionPacing(..., 0.25, ...)` without successor
  liveness or one-shot latch, gated behind `isRealGpuDevice`, emitting
  bit-identical `f32` shader uniforms), a blind `1000 ms` Reset wait in the
  sweep script hiding a real `cesium-fluorine` `#sph-reset` destroyed-buffer
  WebGPU validation error, and two documentation precision gaps (`0 AI/ort-wasm`
  vs 3 intentional Triad `.wasm` modules; `Min Sustained 500ms Hz`).
- **Round 2 ACCEPT (`44bb6f13`, reviewer `1b886022-7693-4d69-9233-0f0f79f59c94`,
  preserved at `independent-review.md`):** Independently verified `41/41`
  source manifest SHA-256 hashes, `15/15` PNG hashes, `10/10` visually
  inspected `t0`/`t2` Wayland Vulkan PNG pairs, strict finite-horizon
  termination with distinct `f32` shader ages and zero Zeno loop, device-cached
  buffer ownership across lane resets (`5/5` Pause/Step/Reset verified across
  brand-new worker lanes `:1 → :2` with `resetStep: 4`), `3/3` native Vulkan
  optics/Cherenkov/parcel-optics proofs, `6,212/6,212` host tests, `37M` clean
  build (`0` AI/`ort-wasm` assets), and `KERNEL_CLEAN`.

## Delivered & Verified Evidence (`44bb6f13`)

### 1. Visible Wayland Vulkan 5-Preset Cadence & Pixel Motion
Honest separation of raw UI rAF (~120 Hz) vs actual admitted presented states/s,
source states/s, and temporal states/s (`report.json` `sha256:
a0114b9ae0d74c330d379a0a35652c45a869ff74f614e986e38842a66e8e8ed8`):

| Preset | Geometry | Mean Presented Hz (`>=54`) | Source Hz | Temporal Hz | Min Sustained 500ms Hz (`>=54`) | Max Gap Ms (`<=55.56`) | UI rAF Hz | Steps Δ | Changed Px (`t0→t2`) | Pause/Step/Reset |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| `water-cycle` | `worker-owned-true-isosurface` | **89.96** | 11.00 | 78.97 | **78** | **25.3** | 119.89 | +452 | 18,908 | `stepAdvanced: true`, `resetStep: 4`, `resetVerified: true` |
| `iron-ice-quench` | `worker-owned-true-isosurface` | **72.96** | 7.33 | 65.63 | **62** | **33.5** | 119.88 | +304 | 25,663 | `stepAdvanced: true`, `resetStep: 4`, `resetVerified: true` |
| `sodium-water` | `worker-owned-true-isosurface` | **76.82** | 6.83 | 69.99 | **70** | **30.6** | 119.88 | +280 | 56,131 | `stepAdvanced: true`, `resetStep: 4`, `resetVerified: true` |
| `cesium-fluorine` | `worker-owned-true-isosurface` | **74.29** | 3.33 | 70.96 | **62** | **28.5** | 119.72 | +132 | 9,024 | `stepAdvanced: true`, `resetStep: 4`, `resetVerified: true` |
| `water-realtime` | `worker-owned-true-isosurface` | **113.25** | 23.12 | 90.14 | **100** | **25.7** | 119.73 | +2,431 (`1.84–2.09x` RT) | 119,001 | `stepAdvanced: true`, `resetStep: 4`, `resetVerified: true` |

### 2. Core Engineering Remedies Landed (`2d955c07`, `44bb6f13`)
- **Finite-Horizon Honesty (`workerOwnedIsosurfacePresenter.js`):** Removed the
  repeating Zeno slowdown loop; added `Math.fround(dampedIsosurfaceShaderMotionAgeS(...))`
  distinct-`f32` guard; added measured end-to-end `recentScheduleHandoffMs` +
  strictly one-shot, liveness-gated (`latestJob || activeJob ||
  captureInFlightCount > 0 || (pendingScheduleSourceTimeS != null &&
  pendingScheduleSourceTimeS >= frame.sourceTimeS)` AND `measuredHandoffLatencyMs
  >= 1.0`, cleared on admission/pause/invalidate/dispose) finite handoff segment
  (`0.12–0.20 s`). Halted/paused physics terminates strictly at
  `maxSimulationAgeS` (pinned by `tests/workerOwnedIsosurfacePresenter.test.mjs`).
- **Zero-Extra-Fence Shared-Queue Interleaving (`workerOwnedIsosurfacePresenter.js`,
  `ulgMechanicsResidentStage.worker.js`, `ulgOffscreenRender.worker.js`):**
  Reuses the presenter's already-in-flight `activePresentationQueueCompletion`
  fence (`0` extra GPU fences) + live-latency-scaled `targetTurns` (`1 → 2 → 3`
  from measured `recentPresentationGpuCompleteMs`, zero per-preset branches) so
  canonical physics steps and multi-surface marching-cubes never stack ahead of
  a display draw.
- **Lane-Reset GPU Buffer Ownership (`schroederHierarchyGpu.js`,
  `schroederFrozenLevelAssignmentRefreshGpu.js`, `webgpuComputeLayout.js`,
  `ulgMechanicsResidentStage.worker.js`, `sphMlsMpmGpuStep.js`):** Added
  `schroederHierarchyDeviceRuntimeAllocationOwnership` and
  `queueOrderedPooledDeviceAllocationOwnership` (pinned by
  `tests/webgpuSubmitBurst.test.mjs`) so `#sph-reset` never destroys buffers
  still held by device-cached hierarchy or pool records.
- **Supporting Verification Matrix:**
  - `3/3` native Vulkan optics/Cherenkov/parcel-optics proofs PASS (`native-optics.log`)
  - `6,212/6,212` host tests PASS (`0` fail, `0` cancelled, `197` opt-in skips; `npm-test.log`)
  - `npm run build` PASS (`4.05 s`, `37M` `dist/`, `0` AI/`ort-wasm` assets; 3 intentional Triad `.wasm` modules in `dist/service-assets/`)
  - `journalctl -k`: `KERNEL_CLEAN` (`0` NVIDIA Xid/NVRM/OOM faults)
  - Evidence bundle: `/home/cos/.cache/icc/repos/ulg/gate4-acceptance-20261123/`

## Scope & Honesty Boundary
- Covers `ulg-gate4-studio-presentation` (`Gate 4`) only; `scientificValidation: false`
  and offline advisory-only G7 remain preserved throughout.
- Gates 0 (`ulg-gate0-foundation-arch`), 3 (`ulg-gate3-continuum-substrate-and-physics`),
  and 5 (`ulg-gate5-planetary-to-supergalactic`) remain honestly `in_progress`
  pending their own reviewed `ulg.campaign.receipt.v1` bundles.
