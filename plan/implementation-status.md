# Implementation Status

Updated: 2026-06-05 15:18:26 AKDT

## Done

- Read `agents.md`, `/home/cos/projects/AGENTS.md`, and the ULG v0.5 PDF.
- Spawned sidecar agents for MoonLab, Eshkol, peercompute, and ICC/swarm.
- Used ICC repo registry/status and architecture summaries for MoonLab and peercompute.
- Added a vanilla Vite/three.js ULG app.
- Added shared ULG GPU ABI descriptors and JSON schemas.
- Added PeerCompute-style service registry, child-worker leases, GPU broker,
  artifact cache, worker supervisor, dummy Eshkol/MoonLab service workers, and
  browser telemetry.
- Added unit tests and Playwright smoke coverage.
- Verified `npm test`, `npm run build`, and `npm run test:e2e`.
- MoonLab sidecar completed: useful surfaces identified, but JS unit regressions,
  missing WASM dist packaging, and real browser WebGPU parity remain blockers.
- peercompute sidecar completed: current Multiscale/remote-placement tests and
  build pass; reusable targets are `ComputeManager`, `NodeKernel`, `SolverRegistry`,
  relay tooling, NetViz telemetry, and Multiscale ULG schemas.
- ICC/swarm sidecar completed: ICC has MoonLab/peercompute indexes; refreshes need
  parser installation; swarm should be used lightly until a ULG profile exists.
- Eshkol sidecar completed: the compiler can build and emit WASM hello output,
  but browser WebGPU/WGSL support does not exist yet and the service path should
  avoid JIT until the observed derivative hang is understood.

## In Progress

- Keep Vite live for inspection.
- Choose the next cross-repo slice from the verified sidecar findings.

## Next

- Add real peercompute service-hosting modules or adapters based on the working ULG
  demo contract.
- Prototype Eshkol closure artifact output from `--wasm`/LLVM export paths and a
  service-worker-safe import surface.
- Prototype MoonLab quantum response artifact output.
- Run the full peercompute relay-backed local stack.
