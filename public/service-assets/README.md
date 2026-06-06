# ULG Service Assets

Vite serves this directory at `/service-assets/` during local development and
from `dist/service-assets/` after `npm run build`.

Use this tree for browser-facing artifacts copied from sibling implementation
repos without copying their source into the ULG app:

```text
public/service-assets/
  moonlab/
    moonlab.js
    moonlab.wasm
  eshkol/
    closures/
      <closure-id>.wasm
      <closure-id>.ulg.json
```

The app does not require these files for the dummy smoke. When a service
manifest declares `entry.serviceAssets`, the worker probes the declared loader
and WASM URLs with browser `fetch()` and reports `ready`, `missing`, or
`mime-mismatch` in service telemetry.

For MoonLab Emscripten output, the manifest convention expects
`locateFile("moonlab.wasm")` to resolve to:

```text
/service-assets/moonlab/moonlab.wasm
```

Real artifacts under this directory are ignored by git by default. Keep only
small documentation or placeholder files checked in unless a fixture is
intentionally part of the ULG ABI contract.

When MoonLab assets are present and ready, the ULG demo leases
`/workers/moonlab-core-probe.worker.js` as a classic child worker. That worker
loads the Emscripten `MoonlabModule` factory with `importScripts()`, uses
`locateFile()` to resolve the WASM next to `moonlab.js`, and emits the
`bell_phi_plus` probability vector into the MoonLab task artifact.
