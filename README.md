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
- dummy Eshkol and MoonLab services for Demo A;
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

The cross-repo adapter contract lives in `ulg-gpu-abi/README.md` with fixture
manifests and task capsules in `ulg-gpu-abi/examples/`.
