# ULG GPU ABI Adapter Contract

This package is the repo-local handoff point for PeerCompute, Eshkol, MoonLab,
and the browser demo. It keeps the current ULG v0.5 manifest and task capsule
shape in one place while the real service implementations are still being
prototyped.

## Stable Imports

```js
import {
  createUlgServiceManifest,
  createUlgTaskCapsule,
  getUlgServiceContract,
  ULG_TASK_KINDS
} from '@ulg/gpu-abi/service-contract';
```

The contract export intentionally contains data shapes only. PeerCompute remains
responsible for networking, GPU leases, worker leases, cancellation, artifact
announcement, and provenance indexing.

## Adapter Boundary

Adapters should provide a compute service manifest with:

- `entry.workerModule`: service worker module URL.
- `entry.serviceAssets`: browser-facing loader/WASM paths under
  `/service-assets/<service>/` when real artifacts are copied into the ULG app.
- `childWorkers.allowedModules`: child worker module URLs approved by the host.
- `capabilities` and `taskKinds`: copied from `getUlgServiceContract(serviceId)`
  unless an implementation has a narrower supported set.
- `abi`: ULG IR/GPU ABI versions plus supported dtypes and layouts.
- `validation`: CPU reference and parity modes the service can actually provide.

Adapters should accept task capsules created by `createUlgTaskCapsule` and return
schema-compatible closure or quantum-response artifacts. Services should not
spawn unleased workers, reserve GPU resources directly, or start networking
outside the host runtime.

## Fixtures

The `examples/` directory contains static JSON fixtures for cross-repo tests:

- `eshkol-service-manifest.json`
- `moonlab-service-manifest.json`
- `eshkol-task-capsule.json`
- `moonlab-task-capsule.json`

Use them to validate parser/schema compatibility before wiring real PeerCompute,
Eshkol, or MoonLab adapters into the demo.

## Browser Asset Readiness

The app-level convention is documented in `public/service-assets/README.md`.
MoonLab browser readiness should use:

```js
import { createMoonLabServiceAssetSpec } from '@ulg/gpu-abi/service-contract';

createUlgServiceManifest({
  serviceId: 'moonlab',
  runtime: 'wasm',
  workerModule,
  serviceAssets: createMoonLabServiceAssetSpec()
});
```

That declares `/service-assets/moonlab/moonlab.js`,
`/service-assets/moonlab/moonlab.wasm`, and the expected Emscripten
`locateFile("moonlab.wasm")` resolution. The ULG app probes those URLs in a
browser worker and reports asset readiness in service telemetry.
