# ULG Triad Demo

Browser-native ULG integration scaffold for the PeerCompute + Eshkol + MoonLab plan in
`plan/ULG_Triad_v0.5_Pretty_Diagrams.pdf`.

This repo currently implements the first executable slice:

- shared ULG GPU ABI descriptors and JSON schemas;
- shared service contract builders and adapter fixtures;
- PeerCompute-style compute service registry;
- supervised root service workers;
- child-worker leases with cancellation;
- GPU capability probing with CPU/WASM fallback status;
- browser-facing service asset probes for real MoonLab/Eshkol readiness;
- a supervised MoonLab WASM Bell-state probe with deterministic response/parity metadata and a magnetar dipole Ising calibration sub-artifact when copied core artifacts are available;
- dummy Eshkol service output and MoonLab fallback output for Demo A;
- a three.js worker-tree visualization.

## Commands

```bash
npm install
npm run dev
npm test
npm run build
npm run test:e2e
```

The Vite demo exports `window.__ulgDemo` for smoke tests and browser inspection.
`window.__ulgDemo.createPeerComputeHandoff()` exports the current artifact cache
as `peercompute.ulg.demo-handoff.v0` packets for PeerCompute/Multiscale
ingestion.

The cross-repo adapter contract lives in `ulg-gpu-abi/README.md` with fixture
manifests and task capsules in `ulg-gpu-abi/examples/`.

## Service Assets

Vite serves `public/service-assets/` at `/service-assets/`. Copy browser-facing
artifacts there when testing real services, for example
`public/service-assets/moonlab/moonlab.js` and
`public/service-assets/moonlab/moonlab.wasm`. The MoonLab manifest convention
uses `entry.serviceAssets` plus `locateFile("moonlab.wasm")` so workers can
probe loader/WASM fetchability and MIME readiness before running the supervised
MoonLab core probe. When the assets are ready, the MoonLab task artifact records
the `bell_phi_plus` basis probabilities from the real WASM module, an analytic
Bell-state response descriptor, a passing `moonlab-wasm-core` comparison, and an
explicit `moonlab-webgpu` unsupported parity entry until MoonLab exposes browser
WebGPU response kernels. The same core probe also evaluates the
`magnetar-dipole-ising-calibration` handoff through MoonLab WASM Ising exports,
recording normalized dipole fields, eight bitstring energies, ground state
`000`, and `maxEnergyDelta = 0` against the JavaScript reference. The MoonLab
artifact keeps the legacy `outputs.reference` field and also emits
`outputs.references[]` as the four-entry calibrated magnetosphere MHD, PIC,
radiation, and relativistic-reference inventory. Those calibrated entries remain
`ready: false` and `scientificCoverage: false` blockers until MoonLab provides
real calibrated multiphysics references; compact artifact-summary telemetry
reports both the ready Ising reference and the calibrated inventory counts so
handoff consumers can inventory tolerance inputs without fetching the full
artifact body.
