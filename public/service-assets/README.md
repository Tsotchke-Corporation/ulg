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
    magnetar-reference-contracts.json
    webgpu-complex64-parity-scope.json
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

The optional `webgpu-complex64-parity-scope.json` asset records MoonLab's
`moonlab.webgpu.complex64-parity-scope.v0` reduced-fixture parity scope. In the
current Node-generated staging path this is explicit no-backend evidence:
`backendAvailable = false`, browser WebGPU parity has not executed, and
`fullFidelityMagnetarSimulation` / `fullPhysicsValidation` remain false.

To refresh the local ignored service assets from the sibling repos, run:

```bash
npm run stage:service-assets
```

The command copies `moonlab.js` and `moonlab.wasm`, generates the normalized
MoonLab magnetar reference suite and WebGPU complex64 parity-scope asset from
`/home/cos/projects/moonlab`, then exports the Eshkol `magnetar-closure`
descriptor bundle directly into this tree with descriptor-only metadata
required by the ULG handoff tests. Use
`ULG_PROJECTS_ROOT=/path/to/projects` when the sibling repos are not under
`/home/cos/projects`. Use `--created-at <iso-timestamp>` or
`ULG_STAGE_CREATED_AT=<iso-timestamp>` with an Eshkol helper that supports
`--created-at` when byte-stable artifact and manifest timestamps are needed.

For manual Eshkol ULG closure bundle exports, use the sibling repo helper:

```bash
cd /home/cos/projects/eshkol
scripts/export_ulg_closure_bundle.py examples/magnetar_closure.esk \
  --eshkol-run build/eshkol-run \
  --output-dir build/ulg/manual-deploy-magnetar-closure \
  --name magnetar-closure \
  --metadata-json examples/magnetar_closure.ulg-metadata.json \
  --require-export main \
  --created-at 2026-06-06T12:34:56Z
```

The magnetar descriptor metadata uses
`validation.closureDescriptor.schema =
"eshkol.ulg.magnetar-closure-descriptor.v0"` and keeps
`scientificValidation = false`. It is a contract seed for tensor/closure
handoff integration, not validated magnetar closure physics.

For the older hello smoke fixture, attach output semantics explicitly:

```bash
cd /home/cos/projects/eshkol
scripts/export_ulg_closure_bundle.py examples/hello.esk \
  --eshkol-run build/eshkol-run \
  --output-dir build/ulg/manual-deploy-smoke \
  --name hello \
  --created-at 2026-06-06T12:34:56Z \
  --validation-json '{"status":"pass","validationMode":"eshkol-static-closure-smoke","outputSemantics":{"schema":"eshkol.ulg.closure-output-semantics.v0","semanticScope":"smoke-fixture","scientificScope":"none","scientificValidation":false,"entryExport":"main","entryArgs":[0,0],"expectedEntryResult":0,"stdout":{"encoding":"utf-8","expectedText":"1048560\n1048544\n","sha256":"sha256:675d2e8686b6a85ffaa5751fba535c108d23ba941f1890d0a102619ec2cdf20d","byteLength":16}}}'
```

Then copy the files listed in `ulg_bundle_manifest.json` into the matching
bundle directory, for example:

```text
public/service-assets/eshkol/closures/magnetar-closure/
public/service-assets/eshkol/closures/hello/
```

The ULG demo declares the `magnetar-closure` bundle by default and probes the
artifact JSON, WASM module, schema snapshot, and bundle manifest. With those
ignored files present, the Eshkol service telemetry reports asset status
`ready`.
