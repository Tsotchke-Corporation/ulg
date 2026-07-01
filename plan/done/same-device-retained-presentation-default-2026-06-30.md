# Same-Device Retained Presentation Default

Date: 2026-06-30 AKDT

## Outcome

Interactive scene probes now default to the same-device retained presentation
route when render ownership is otherwise unclaimed. The demo supplies
`renderUseCase=same-device-interactive` for absent or `auto` ownership, while
explicit non-auto URL/PeerCompute ownership remains an escape hatch. Scene
benchmarks mirror that default so benchmark URLs exercise the intended
interactive path.

## Evidence

- Direct-resident throughput after the sidecar-fused sequence reset remained
  healthy: `residentStageMs=19.1`, `residentStageStepsPerSecond=52.36`, no
  queue fence requested.
- Explicit queue-fence diagnostics still reproduce the slow path:
  `residentGpuQueueFenceMs=1248.8`,
  `residentStageStepsPerSecond=0.79`, `queue.onSubmittedWorkDone`.
- Main-thread scene rendering before the default route spent about
  `2993 ms` in `renderRowsMs`, with `probeWallStepsPerSecond=0.66`; the
  compute stage itself was about `9.6 ms`.
- The same-device retained-presentation route with the defaulted use case now
  reports `probeStatus=good`, `renderRefreshAwaitMs=1.0`,
  `probeWallStepsPerSecond=55.40`, `probeEngineStepsPerSecond=56.98`,
  `estimatedReadbackBytesPerStep=0`, and
  `surfaceDrawStatus=resident-render-presentation-worker-retained-output-preserved`.
- A normal smoke-scale default scene run also passed at `1024` particles:
  `probeWallStepsPerSecond=42.37`, `probeEngineStepsPerSecond=43.57`,
  `residentStageMs=10.8`, `renderRefreshAwaitMs=1.4`, and
  `renderRowsReadbackByteLength=0`.

## Implication

The current 1 fps/slideshow symptom was not the fused MLS-MPM compute path. It
was the legacy main-thread Three render-row bridge forcing a full render-row
readback and browser GPU queue drain. For same-device interactive presentation,
the worker-owned presented canvas is now the default; throughput and explicit
PeerCompute modes can still select compute-manager or main-thread ownership.

## Remaining Work

- Keep native WebGPU surface-consumer promotion separate from this default. It
  still needs browser-frame/pixel validation before replacing the retained
  worker presentation route.
- Keep portable cross-peer replay separate. Same-worker retained refs are local
  materialization only; cross-peer replay still needs compact snapshot
  publication or peer-local materialization.
