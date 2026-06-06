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
      <bundle-name>/
        <bundle-name>.wasm
        <bundle-name>.ulg.json
        ulg_bundle_manifest.json
        schemas/ulg/closure_artifact.schema.json
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
`bell_phi_plus` probability vector into the MoonLab task artifact. The artifact
also carries `peercompute.ulg.quantum-response-descriptor.v0` and
`peercompute.ulg.quantum-response-parity.v0` metadata so consumers can see the
passing MoonLab WASM/analytic comparison and the currently unsupported MoonLab
WebGPU parity mode separately. When the copied MoonLab runtime includes the
Ising exports, the same worker also emits
`peercompute.ulg.magnetar-dipole-ising-calibration.v0` as a calibration
sub-artifact with normalized dipole fields, eight bitstring energy evaluations,
ground state `000`, and zero WASM-vs-JS energy delta.

For Eshkol ULG closure bundles, use the sibling repo helper:

```bash
cd /home/cos/projects/eshkol
scripts/export_ulg_closure_bundle.py examples/hello.esk \
  --eshkol-run build/eshkol-run \
  --output-dir build/ulg/manual-deploy-smoke \
  --name hello
```

Then copy the files listed in `ulg_bundle_manifest.json` into:

```text
public/service-assets/eshkol/closures/hello/
```

The ULG demo declares that `hello` bundle by default and probes the artifact
JSON, WASM module, schema snapshot, and bundle manifest. With those ignored
files present, the Eshkol service telemetry reports asset status `ready`.
