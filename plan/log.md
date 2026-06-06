# ULG Implementation Log

## 2026-06-05 18:31:10 AKDT

Prompt: Continue the ULG implementation plan after the Eshkol sidecar added a local closure bundle export helper. Standing instructions remain: keep commits local only, keep the Vite server reachable on `0.0.0.0`, and do not push.

Actions attempted:

- Added `createEshkolClosureBundleAssetSpec()` for Eshkol bundles exported by
  `scripts/export_ulg_closure_bundle.py`.
- Extended service asset probing to validate JSON assets in addition to JS and
  WASM assets.
- Declared the default Eshkol `hello` closure bundle in the ULG demo runtime.
- Copied the ignored local Eshkol smoke bundle into
  `public/service-assets/eshkol/closures/hello/` for live readiness probing.
- Updated the supervised Eshkol worker to load the ready bundle artifact at init
  time and return it for closure tasks instead of the dummy fallback.
- Extended compact artifact-summary telemetry with Eshkol closure-specific
  readiness fields for module URL/hash, service-worker safety, dynamic-code
  flags, bundle manifest metadata, and `closureReady`.
- Added unit coverage for Eshkol artifact JSON, WASM, schema snapshot, and
  bundle manifest URL probing.
- Extended the browser smoke to verify the Eshkol service declares/probes its
  bundle assets, reports the four expected asset kinds when ready, and returns
  the staged `wasm-reference` closure artifact with validation status `pass`.
- Updated service asset docs, implementation status, plan, and test notes.

Files touched:

- `ulg-gpu-abi/src/serviceContract.js`
- `src/runtime/ServiceAssetProbe.js`
- `src/runtime/demoRuntime.js`
- `src/services/dummyService.worker.js`
- `src/runtime/artifactSummary.js`
- `tests/orchestration.test.mjs`
- `tests/service-assets.test.mjs`
- `tests/demo.e2e.mjs`
- `public/service-assets/README.md`
- `plan/implementation-status.md`
- `plan/plan.md`
- `plan/tests.md`
- `plan/log.md`

Ignored local files staged for live demo only:

- `public/service-assets/eshkol/closures/hello/hello.ulg.json`
- `public/service-assets/eshkol/closures/hello/hello.wasm`
- `public/service-assets/eshkol/closures/hello/ulg_bundle_manifest.json`
- `public/service-assets/eshkol/closures/hello/schemas/ulg/closure_artifact.schema.json`

Commands planned/run:

- `node --check ulg-gpu-abi/src/serviceContract.js`
- `node --check src/runtime/ServiceAssetProbe.js`
- `node --check src/runtime/demoRuntime.js`
- `node --check src/services/dummyService.worker.js`
- `node --check tests/demo.e2e.mjs`
- `node --check tests/service-assets.test.mjs`
- `npm test`
- `npm run build`
- `npm run test:e2e`
- Live VPN artifact-cache probe against `http://100.86.83.35:5173/`
- `git diff --check`

Results:

- PASS: syntax checks completed for the service contract builder, asset probe,
  and demo runtime.
- PASS: `npm test` completed with `15/15` tests passing.
- PASS: `npm run build` completed with the existing large three.js chunk warning.
- PASS: `npm run test:e2e` completed with `1/1` Chromium test passing.
- PASS: live VPN probe against `http://100.86.83.35:5173/` reported Eshkol
  asset status `ready`, with the WASM module served as `application/wasm` and
  the artifact JSON, schema snapshot, and bundle manifest served as
  `application/json`.
- PASS: live VPN artifact-cache probe reported Eshkol closure kind
  `wasm-reference`, module URL `hello.wasm`, service-worker-safe execution,
  validation status `pass`, artifact-summary validation status `pass`, and
  bundle manifest `preserveRelativeUrls: true`.
- PASS: live VPN artifact-summary probe reported `closureReady: true`,
  `closureModuleUrl: "hello.wasm"`, `closureServiceWorkerSafe: true`, and
  `closureBundlePreserveRelativeUrls: true`.

Failures / open questions:

- No failures in this checkpoint.
- This proves browser-facing readiness for a manually staged Eshkol bundle; real
  closure tensor semantics and PeerCompute execution of that bundle remain next
  integration work.

## 2026-06-05 18:23:32 AKDT

Prompt: Continue the ULG implementation plan after PeerCompute accepted the MoonLab magnetar calibration summary into the Multiscale scenario. Standing instructions remain: keep commits local only, keep the Vite server reachable on `0.0.0.0`, and do not push.

Actions attempted:

- Added a local `peercompute.ulg.artifact-summary.v0` helper for compact artifact telemetry.
- Wired `ArtifactCache` to store and list artifact summaries beside content-addressed refs.
- Exposed cache summaries through `window.__ulgDemo.telemetry.artifacts` so PeerCompute/Multiscale consumers can see descriptor, parity, unsupported parity mode, and magnetar calibration readiness without fetching the full artifact body.
- Updated the ULG sidebar artifact list to show validation/parity/calibration summary state.
- Added unit coverage for closure and MoonLab quantum-response artifact summaries.
- Extended the Playwright smoke to assert the live MoonLab artifact telemetry record carries magnetar calibration readiness, ground state `000`, `maxEnergyDelta = 0`, and `evaluatedBitstrings = 8`.
- Updated implementation status, plan, and test notes.

Files touched:

- `src/runtime/artifactSummary.js`
- `src/runtime/ArtifactCache.js`
- `src/main.js`
- `tests/orchestration.test.mjs`
- `tests/demo.e2e.mjs`
- `plan/implementation-status.md`
- `plan/plan.md`
- `plan/tests.md`
- `plan/log.md`

Commands planned/run:

- `node --check src/runtime/artifactSummary.js`
- `node --check src/runtime/ArtifactCache.js`
- `node --check src/main.js`
- `npm test`
- `npm run build`
- `npm run test:e2e`
- `git diff --check`

Results:

- PASS: syntax checks completed for the artifact summary helper, artifact cache,
  and app entrypoint.
- PASS: `npm test` completed with `14/14` tests passing.
- PASS: `npm run build` completed with the existing large three.js chunk warning.
- PASS: `npm run test:e2e` completed with `1/1` Chromium test passing.

Failures / open questions:

- No failures in this checkpoint.
- This exposes compact handoff telemetry only; it does not add MoonLab WebGPU
  parity or promote the magnetar path beyond the calibration artifact handoff.

## 2026-06-05 18:04:15 AKDT

Prompt: Continue the ULG implementation plan after the PeerCompute magnetar scenario checkpoint. Standing instructions remain: keep commits local only, keep the Vite server reachable on `0.0.0.0`, and do not push.

Actions attempted:

- Extended `public/workers/moonlab-core-probe.worker.js` so the supervised MoonLab browser worker also evaluates the MoonLab WASM Ising exports.
- Added `peercompute.ulg.magnetar-dipole-ising-calibration.v0` as a calibration sub-artifact with normalized dipole fields, nearest-neighbor Ising couplings, eight bitstring energy evaluations, JavaScript reference parity, dipole monotonicity validation, and ground state `000`.
- Threaded the calibration object into the persisted MoonLab artifact under `calibrationArtifacts.magnetarDipoleIsing`, plus summary fields in `outputs.magnetarDipoleIsing` and validation metrics.
- Extended Playwright e2e coverage to assert the magnetar calibration schema, validation status, parity status, ground state, zero max energy delta, and evaluated-bitstring count when MoonLab assets are ready.
- Verified the live `5173` demo artifact cache reports Bell parity pass plus magnetar calibration pass.
- Updated README, service-asset docs, implementation status, plan, and test notes.

Files touched:

- `README.md`
- `public/service-assets/README.md`
- `public/workers/moonlab-core-probe.worker.js`
- `src/services/dummyService.worker.js`
- `tests/demo.e2e.mjs`
- `plan/implementation-status.md`
- `plan/plan.md`
- `plan/tests.md`
- `plan/log.md`

Commands run:

- `node --check public/workers/moonlab-core-probe.worker.js`
- `node --check src/services/dummyService.worker.js`
- `npm test`
- `npm run build`
- `npm run test:e2e`
- Playwright live artifact-cache probe against `http://127.0.0.1:5173/`

Results:

- PASS: syntax checks completed for the worker and dummy service.
- PASS: `npm test` completed with `13/13` tests passing.
- PASS: `npm run build` completed with the existing large chunk warning.
- PASS: `npm run test:e2e` completed with `1/1` Chromium test passing.
- PASS: live artifact-cache probe reported `magnetarStatus = pass`, `magnetarParityStatus = pass`, `groundState = "000"`, `maxEnergyDelta = 0`, `evaluatedBitstrings = 8`, and `calibrationArtifactCount = 1`.

Failures / open questions:

- This is a calibration handoff primitive, not a full magnetar simulation. It does not include plasma, radiation, relativistic, or MHD evolution.
- MoonLab WebGPU parity remains unsupported until browser WebGPU quantum-response kernels exist.

## 2026-06-05 17:36:55 AKDT

Prompt: Continued the ULG implementation plan after the PeerCompute remote-solver cadence checkpoint. User standing instructions: keep going, keep commits local, keep the Vite server reachable on `0.0.0.0`, and do not push.

Actions attempted:

- Picked the next ULG-local MoonLab gap from `plan/implementation-status.md`: extend the Bell-state readiness probe into deterministic quantum-response descriptors and CPU/WebGPU parity metadata.
- Extended `public/workers/moonlab-core-probe.worker.js` so the real MoonLab WASM Bell `phi_plus` probe emits `peercompute.ulg.quantum-response-descriptor.v0` plus `peercompute.ulg.quantum-response-parity.v0`.
- Added analytic Bell `phi_plus` reference probabilities, MoonLab WASM/core comparison metrics, normalization delta, purity/entropy invariants, and an explicit unsupported `moonlab-webgpu` parity comparison.
- Threaded the descriptor/parity reports into the persisted MoonLab quantum-response artifact in `src/services/dummyService.worker.js`.
- Extended ABI and Playwright smoke tests to assert the descriptor/parity surface.
- Updated README, service-asset docs, plan, implementation status, and test-plan docs.

Files touched:

- `README.md`
- `public/service-assets/README.md`
- `public/workers/moonlab-core-probe.worker.js`
- `src/services/dummyService.worker.js`
- `tests/abi.test.mjs`
- `tests/demo.e2e.mjs`
- `plan/implementation-status.md`
- `plan/plan.md`
- `plan/tests.md`
- `plan/log.md`

Commands planned/run:

- `node --check public/workers/moonlab-core-probe.worker.js`
- `node --check src/services/dummyService.worker.js`
- `npm test`
- `npm run build`
- `npm run test:e2e`
- `git diff --check`

Results:

- PASS: `node --check public/workers/moonlab-core-probe.worker.js`
- PASS: `node --check src/services/dummyService.worker.js`
- PASS: `npm test` completed with `13/13` tests passing.
- PASS: `npm run build` completed with the existing large three.js chunk warning.
- PASS: `npm run test:e2e` completed with `1/1` Chromium test passing.
- PASS: `git diff --check`

Failures / open questions:

- The artifact truthfully reports MoonLab WebGPU parity as unsupported until MoonLab exposes browser WebGPU response kernels.

## 2026-06-05 15:05:57 AKDT

Prompt: "read the agents.md file and get to work we are already on relevant branches for moonlab eshkol and peercompute. they're all in ~/projects."

Actions attempted:

- Read `/home/cos/projects/ulg/agents.md`.
- Read `/home/cos/projects/AGENTS.md`.
- Checked `plan/agents.md`, which is currently empty.
- Checked repo status for ULG, peercompute, Eshkol, and MoonLab.
- Extracted text from `plan/ULG_Triad_v0.5_Pretty_Diagrams.pdf` with `pdftotext`.
- Reviewed the spec sections for service manifests, task capsules, worker
  supervision, GPU broker, Milestones 0.6 and 0.7, Demo A, library extension
  plans, and schema sketches.
- Checked npm registry versions for Vite, three, Ajv, and Playwright.
- Used ICC status and architecture summaries for MoonLab and peercompute.
- Spawned four sidecar agents:
  - MoonLab implementation surface review.
  - Eshkol implementation surface review.
  - peercompute orchestration/runtime review.
  - ICC/swarm tooling review.

Commands run:

```bash
rg --files -g 'AGENTS.md' -g 'agents.md' /home/cos/projects/ulg /home/cos/projects
rg -n "moonlab|MoonLab|eshkol|peercompute|ulg" /home/cos/.codex/memories/MEMORY.md
sed -n '1,240p' agents.md
sed -n '1,220p' /home/cos/projects/AGENTS.md
sed -n '1,240p' plan/agents.md
git status --short --branch
find plan -maxdepth 3 -type f | sort
pdfinfo plan/ULG_Triad_v0.5_Pretty_Diagrams.pdf
pdftotext -layout plan/ULG_Triad_v0.5_Pretty_Diagrams.pdf /tmp/ulg_triad_spec.txt
npm view vite version
npm view three version
npm view ajv version
npm view @playwright/test version
python3 /home/cos/projects/infinite_context_coder/scripts/codebase_tool.py status --repo moonlab
python3 /home/cos/projects/infinite_context_coder/scripts/codebase_tool.py status --repo peercompute
python3 /home/cos/projects/infinite_context_coder/scripts/codebase_tool.py architecture-summary --repo moonlab --bundle --include-cheatsheet
python3 /home/cos/projects/infinite_context_coder/scripts/codebase_tool.py architecture-summary --repo peercompute --bundle --include-cheatsheet
```

Files touched:

- `README.md`
- `package.json`
- `index.html`
- `.gitignore`
- `plan/plan.md`
- `plan/tests.md`
- `plan/implementation-status.md`
- `plan/log.md`
- `src/**`
- `ulg-gpu-abi/**`
- `tests/**`

Test results:

- `npm install` completed with 0 vulnerabilities.
- First `npm test` failed because plain Ajv did not load the draft-2020 schema meta-schema.
- Patched `tests/abi.test.mjs` to use `ajv/dist/2020.js`.
- `npm test` passed: 7/7 tests.
- `npm run build` passed with the expected large-chunk warning from three.js.
- First `npm run test:e2e` failed because the Playwright Chromium binary was missing.
- Ran `npx playwright install chromium`.
- `npm run test:e2e` passed: 1/1 Chromium test.
- Visual screenshots checked:
  - `test-results/ulg-desktop.png`
  - `test-results/ulg-mobile.png`

Failures and open questions:

- A parallel `pdftotext` extraction/read raced once; reran reads after the text file existed.
- Cross-repo code edits are deferred until sidecar reports return and the ULG local smoke is stable.
- MoonLab sidecar found JS unit failures and missing WASM dist packaging:
  `pnpm --filter @moonlab/quantum-core test:unit` fails 2/90, and integration
  tests fail because `packages/core/dist/moonlab.js` is missing.
- peercompute sidecar verified the current branch is clean and core tests/builds pass.
- ICC/swarm sidecar found ICC indexes for MoonLab and peercompute, but parser refresh
  dependencies are missing until `make install-parsers` runs.
- Eshkol sidecar completed after the first commit. It found useful surfaces in
  `exe/eshkol-run.cpp`, `inc/eshkol/llvm_backend.h`,
  `lib/backend/llvm_codegen.cpp`, `inc/eshkol/backend/gpu/gpu_memory.h`,
  `lib/backend/vm_gpu_dispatch.h`, `docs/breakdown/GPU_ACCELERATION.md`,
  `scripts/run_web_tests.sh`, `scripts/check_wasm_imports.py`, and
  `scripts/run_gpu_tests.sh`.
- Eshkol sidecar verified `build/eshkol-run --version`,
  `cmake --build build --target eshkol-run -j2`, native hello compile/run,
  WASM hello emission, LLVM 21 config, CUDA GPU enabled config, and RTX 3090
  visibility.
- Eshkol sidecar found no real WebGPU/WGSL/Dawn/wgpu implementation. It also saw
  a derivative/JIT command hang, so the service path should avoid JIT until that
  is profiled.

Additional commands run:

```bash
npm install
npm test
npm run build
npm run test:e2e
npx playwright install chromium
npm run test:e2e
```

## 2026-06-05 15:32:53 AKDT

Prompt: "big dog, you are the Eshkol implementation agent for the ULG effort. Work in /home/cos/projects/eshkol on the current branch only; do not switch branches. Read /home/cos/projects/ulg/agents.md and /home/cos/projects/AGENTS.md before editing. Do not use or log any SSH password. The user lacks push rights on Eshkol, so local commits/patches are fine but note they may need manual deployment. Scope: implement the smallest Eshkol-side ULG closure artifact readiness slice. Prefer additive files/tests around a ULG ABI/closure manifest emitter or a service-worker-safe JSON artifact command/helper, using existing examples and WASM export paths. Avoid JIT paths. Run feasible build/test/hello/WASM checks. Commit locally at a coherent checkpoint if appropriate. Final report must list files changed, exact commands, test results, and how to manually deploy/apply the patch elsewhere."

Actions attempted:

- Read `/home/cos/projects/ulg/agents.md` and `/home/cos/projects/AGENTS.md`.
- Checked Eshkol branch/worktree and stayed on the current `ulg` branch.
- Reviewed the ULG plan, status, tests, ABI closure schema, and Eshkol
  `eshkol-run --wasm` path.
- Added Eshkol helper `scripts/emit_ulg_closure_artifact.py`.
- Added Eshkol regression test `tests/toolchain/ulg_closure_artifact_test.py`.
- Wired the test into Eshkol CTest when Python 3 is available.
- Added `docs/breakdown/ULG_CLOSURE_ARTIFACTS.md` and linked it from
  `docs/breakdown/README.md`.

Commands run:

```bash
rg -n "eshkol|ULG|WASM|wasm|LLVM|closure|manifest" /home/cos/.codex/memories/MEMORY.md
sed -n '1,220p' /home/cos/projects/ulg/agents.md
sed -n '1,220p' /home/cos/projects/AGENTS.md
git -C /home/cos/projects/eshkol status --short --branch
python3 /home/cos/projects/infinite_context_coder/scripts/codebase_tool.py status --repo eshkol
sed -n '1,260p' /home/cos/projects/ulg/plan/plan.md
sed -n '1,260p' /home/cos/projects/ulg/plan/log.md
sed -n '1,260p' /home/cos/projects/ulg/ulg-gpu-abi/src/index.js
sed -n '1,260p' /home/cos/projects/ulg/ulg-gpu-abi/src/schemas/closure_artifact.schema.json
sed -n '1,260p' /home/cos/projects/eshkol/exe/eshkol-run.cpp
rg -n "Usage|while \\(|getopt|case '|wasm|emit_object|compile_only|output|run|profile|target|link|eshkol_compile|dump" exe/eshkol-run.cpp
python3 -m py_compile scripts/emit_ulg_closure_artifact.py tests/toolchain/ulg_closure_artifact_test.py
scripts/emit_ulg_closure_artifact.py examples/hello.esk --eshkol-run build/eshkol-run --wasm-output /tmp/eshkol-ulg-artifact-smoke/hello.wasm --artifact /tmp/eshkol-ulg-artifact-smoke/hello.ulg.json
python3 tests/toolchain/ulg_closure_artifact_test.py --repo-root /home/cos/projects/eshkol --eshkol-run /home/cos/projects/eshkol/build/eshkol-run
cmake -S . -B build
cmake --build build --target eshkol-run -j2
ctest --test-dir build -R 'ulg_closure_artifact_test|eshkol_run_profile_cli_test|execution_profile_test' --output-on-failure
build/eshkol-run examples/hello.esk -o /tmp/eshkol-ulg-final-smoke/hello-native
/tmp/eshkol-ulg-final-smoke/hello-native
build/eshkol-run --wasm examples/hello.esk -o /tmp/eshkol-ulg-wasm-smoke/hello.wasm
scripts/emit_ulg_closure_artifact.py examples/hello.esk --eshkol-run build/eshkol-run --wasm-output /tmp/eshkol-ulg-schema-smoke/hello.wasm --artifact /tmp/eshkol-ulg-schema-smoke/hello.ulg.json
node --input-type=module - <<'JS'
import fs from 'node:fs';
import Ajv2020 from '/home/cos/projects/ulg/node_modules/ajv/dist/2020.js';
const schema = JSON.parse(fs.readFileSync('/home/cos/projects/ulg/ulg-gpu-abi/src/schemas/closure_artifact.schema.json', 'utf8'));
const artifact = JSON.parse(fs.readFileSync('/tmp/eshkol-ulg-schema-smoke/hello.ulg.json', 'utf8'));
const ajv = new Ajv2020({ allErrors: true });
const validate = ajv.compile(schema);
if (!validate(artifact)) {
  console.error(validate.errors);
  process.exit(1);
}
console.log(`schema-ok closureId=${artifact.closureId} entry=${artifact.execution.entryExport}`);
JS
```

Files touched:

- `/home/cos/projects/eshkol/CMakeLists.txt`
- `/home/cos/projects/eshkol/docs/breakdown/README.md`
- `/home/cos/projects/eshkol/docs/breakdown/ULG_CLOSURE_ARTIFACTS.md`
- `/home/cos/projects/eshkol/scripts/emit_ulg_closure_artifact.py`
- `/home/cos/projects/eshkol/tests/toolchain/ulg_closure_artifact_test.py`
- `/home/cos/projects/ulg/plan/implementation-status.md`
- `/home/cos/projects/ulg/plan/plan.md`
- `/home/cos/projects/ulg/plan/tests.md`
- `/home/cos/projects/ulg/plan/log.md`

Test results:

- `python3 -m py_compile scripts/emit_ulg_closure_artifact.py tests/toolchain/ulg_closure_artifact_test.py` passed.
- `scripts/emit_ulg_closure_artifact.py examples/hello.esk ...` passed and wrote
  `/tmp/eshkol-ulg-artifact-smoke/hello.ulg.json`.
- `python3 tests/toolchain/ulg_closure_artifact_test.py --repo-root /home/cos/projects/eshkol --eshkol-run /home/cos/projects/eshkol/build/eshkol-run` passed.
- `cmake -S . -B build && cmake --build build --target eshkol-run -j2` passed;
  existing LLVM deprecation and `fread` warnings were observed.
- `ctest --test-dir build -R 'ulg_closure_artifact_test|eshkol_run_profile_cli_test|execution_profile_test' --output-on-failure` passed 3/3.
- Native hello compiled and ran, printing `Hello, Eshkol!` and
  `Version: v1.2.1-scale`.
- WASM hello emitted `/tmp/eshkol-ulg-wasm-smoke/hello.wasm` with size 33907 and
  WASM magic `b'\x00asm'`.
- Generated `/tmp/eshkol-ulg-schema-smoke/hello.ulg.json` validated against the
  ULG closure artifact schema and reported `entry=main`.

Failures and open questions:

- ICC registry lookup for `eshkol` returned `Unknown repo: eshkol`, so direct
  checked-in Eshkol summaries and source inspection were used.
- The helper is intentionally a readiness slice. It does not implement
  `define-ulg-closure`, typed closure tensor descriptors, WGSL/table emission,
  or real service-worker import glue yet.
- No SSH password was used or logged.

## 2026-06-05 15:36:52 AKDT

Prompt: "big dog, you are the MoonLab implementation agent for the ULG effort. Work in /home/cos/projects/moonlab on the current branch only; do not switch branches. Read /home/cos/projects/ulg/agents.md and /home/cos/projects/AGENTS.md before editing. Do not use or log any SSH password. Scope: fix the smallest browser/WASM readiness blockers found in the previous report: JS unit regressions around circuit depth including measure and complex conjugate returning -0, then investigate/fix WASM dist packaging so packages/core/dist gets moonlab.js/moonlab.wasm when build:wasm/build runs. Keep changes focused to MoonLab JS/core packaging/tests. Run pnpm unit/integration/build commands that are feasible. Commit locally at a coherent passing checkpoint if appropriate. Final report must list files changed, exact commands, test results, and remaining blockers for ULG service worker integration."

Actions attempted:

- MoonLab agent worked on current `ulg` branch and committed local checkpoint
  `2461d15 Fix core WASM readiness blockers`.
- Fixed `conjugate()` so imaginary zero stays `0`, not `-0`.
- Fixed circuit depth so measurement gates do not add depth.
- Fixed core build order and explicit WASM artifact copying so
  `packages/core/dist` keeps `moonlab.js` and `moonlab.wasm`.
- Fixed Emscripten runtime-ready hook placement, export parsing, link
  dependencies, missing WASM support sources, `quantum_state_t` amplitude pointer
  offset, `i64` measurement return conversion, q0-as-LSB integration tests, and
  `quantum_state_purity()` documented pure-state behavior.
- Coordinator verified the final dist artifacts exist with `ls -lh`.

Commands run:

```bash
pnpm test:unit
pnpm --filter @moonlab/quantum-core build
pnpm test:integration
pnpm build:wasm
git diff --check
pnpm build
ls -lh bindings/javascript/packages/core/dist/moonlab.js bindings/javascript/packages/core/dist/moonlab.wasm
```

Files touched in MoonLab:

- `/home/cos/projects/moonlab/bindings/javascript/packages/core/src/complex.ts`
- `/home/cos/projects/moonlab/bindings/javascript/packages/core/src/circuit.ts`
- `/home/cos/projects/moonlab/bindings/javascript/packages/core/package.json`
- `/home/cos/projects/moonlab/bindings/javascript/packages/core/emscripten/CMakeLists.txt`
- `/home/cos/projects/moonlab/bindings/javascript/packages/core/emscripten/pre.js`
- `/home/cos/projects/moonlab/bindings/javascript/packages/core/emscripten/post.js`
- `/home/cos/projects/moonlab/bindings/javascript/packages/core/src/quantum-state.ts`
- `/home/cos/projects/moonlab/bindings/javascript/packages/core/src/memory.ts`
- `/home/cos/projects/moonlab/bindings/javascript/packages/core/src/__tests__/quantum-state.integration.test.ts`
- `/home/cos/projects/moonlab/src/quantum/state.c`

Test results:

- `pnpm test:unit` in `bindings/javascript` passed 90/90.
- `pnpm --filter @moonlab/quantum-core build` in `bindings/javascript` passed.
- `pnpm test:integration` in `bindings/javascript` passed 41/41.
- `pnpm build:wasm` in `bindings/javascript` passed.
- `git diff --check` passed.
- `pnpm build` in `bindings/javascript` still fails outside core because
  `@moonlab/quantum-algorithms` cannot find `src/index.ts`.
- Coordinator verified `bindings/javascript/packages/core/dist/moonlab.js` and
  `bindings/javascript/packages/core/dist/moonlab.wasm` both exist.

Failures and open questions:

- ULG still needs app-side service-worker cache/copy wiring and browser smoke
  verification for MoonLab core.

## 2026-06-05 15:49:09 AKDT

Prompt: "big dog, second-wave ULG app task. Work in /home/cos/projects/ulg on current branch only; do not switch branches. Read agents.md, plan/plan.md, plan/tests.md, and plan/log.md first. Keep the existing Vite server live on 0.0.0.0; do not restart unless necessary. Do not use or log any SSH password. Scope: add browser-facing service asset/probe glue for real service readiness without copying sibling repo source. Examples: a documented `service-assets/` convention, a MoonLab WASM locateFile/MIME probe that can be pointed at copied artifacts, or tests proving the ULG service contract fixtures can be consumed by a browser worker. Keep vanilla JS/three.js. Run npm test/build/e2e if behavior changes. Commit locally if passing. Final report: files changed, tests, demo impact."

Actions attempted:

- Read `agents.md`, `plan/plan.md`, `plan/tests.md`, and `plan/log.md` first.
- Confirmed the current ULG worktree was clean on `main` and did not switch
  branches.
- Confirmed the existing Vite server stayed live on `0.0.0.0:5173` under PID
  3893171; did not restart it.
- Added `public/service-assets/` as the documented browser asset convention for
  copied service artifacts while ignoring real copied artifacts by default.
- Added ABI service asset helpers for MoonLab and extended service manifests with
  `entry.loaderModule`, `entry.wasmModule`, and `entry.serviceAssets`.
- Added browser/worker service asset probe code that checks loader/WASM
  fetchability, expected WASM MIME, and MoonLab `locateFile("moonlab.wasm")`
  resolution.
- Classified Vite's app-shell `text/html` fallback for declared service assets
  as `missing`, so absent copied artifacts are reported clearly.
- Wired probe status through the dummy service worker, supervisor telemetry,
  `window.__ulgDemo.telemetry`, and the service registry UI.
- Updated the MoonLab service fixture to declare `/service-assets/moonlab/`
  artifacts without committing MoonLab source or real build outputs.
- Added unit tests for asset spec/probe behavior and a Playwright browser-worker
  smoke that consumes the published MoonLab manifest/task fixtures.

Commands run:

```bash
sed -n '1,240p' agents.md
sed -n '1,260p' plan/plan.md
sed -n '1,260p' plan/tests.md
sed -n '1,260p' plan/log.md
git status --short --branch
ss -ltnp
npm test
npm run build
npm run test:e2e
git diff --check
```

Files touched:

- `.gitignore`
- `README.md`
- `public/service-assets/README.md`
- `public/service-assets/eshkol/.gitkeep`
- `public/service-assets/moonlab/.gitkeep`
- `src/main.js`
- `src/runtime/ServiceAssetProbe.js`
- `src/runtime/WorkerSupervisor.js`
- `src/runtime/demoRuntime.js`
- `src/services/dummyService.worker.js`
- `src/services/serviceContractProbe.worker.js`
- `src/styles.css`
- `tests/contract-fixtures.test.mjs`
- `tests/demo.e2e.mjs`
- `tests/service-assets.test.mjs`
- `ulg-gpu-abi/README.md`
- `ulg-gpu-abi/examples/moonlab-service-manifest.json`
- `ulg-gpu-abi/src/schemas/compute_service_manifest.schema.json`
- `ulg-gpu-abi/src/serviceContract.js`
- `plan/implementation-status.md`
- `plan/plan.md`
- `plan/tests.md`
- `plan/log.md`

Test results:

- `npm test` passed 13/13.
- `npm run build` passed with the existing large three.js chunk warning.
- `npm run test:e2e` passed 1/1 Chromium test.
- `git diff --check` passed.

Demo impact:

- The live demo still runs the dummy Eshkol/MoonLab smoke.
- MoonLab telemetry now reports asset probe status for the conventional
  `/service-assets/moonlab/moonlab.js` and `.wasm` paths. With no copied
  artifacts present, the status is expected to report missing; copying real
  artifacts there turns the same probe into the readiness check.
- The published MoonLab fixture can now be consumed from a browser worker, and
  the worker resolves the expected `locateFile("moonlab.wasm")` URL.

Failures and open questions:

- No SSH password was used or logged.
- All commits for this slice are local-only; no push should be attempted.
- No real MoonLab or Eshkol artifacts were copied into the ULG app in this slice.
- A minimal MoonLab core task still needs to be wrapped once artifacts are copied
  into `public/service-assets/moonlab/`.
- Verify `moonlab.wasm` MIME type and `locateFile` resolution from the ULG
  service-worker/cache path.
- Whole MoonLab JS workspace build remains blocked by the separate
  `@moonlab/quantum-algorithms` package issue.
- No SSH password was used or logged.

## 2026-06-05 15:39:15 AKDT

Prompt: "big dog, you are the peercompute implementation agent for the ULG effort. Work in /home/cos/projects/peercompute on the current branch only; do not switch branches. Read /home/cos/projects/peercompute/AGENTS.md, /home/cos/projects/ulg/agents.md, /home/cos/projects/AGENTS.md, and /home/cos/projects/ulg/plan/plan.md before editing. Do not use or log any SSH password. Scope: implement the first reusable PeerCompute service-orchestration slice inspired by the ULG demo contract, preferably in vanilla JS under peercompute/src/peercompute or a nearby existing pattern. Target modules: ComputeServiceRegistry, ChildWorkerLeaseManager, WorkerSupervisor or an adapter layer that can be tested without a browser. Reuse existing ComputeManager/SolverRegistry/NodeKernel patterns where reasonable, but keep the patch focused. Add unit tests. Run relevant node tests. Commit locally when you reach a passing, coherent checkpoint if the repo policy allows; otherwise leave changes staged/unstaged and report exact files. Final report must list files changed, tests run, pass/fail, and any follow-up needed."

Actions attempted:

- PeerCompute agent worked on current `multi-scale-physics-sim` branch and
  committed local checkpoint `975c23e1 Add service orchestration primitives`.
- Added reusable headless service orchestration primitives:
  `ComputeServiceRegistry`, `ChildWorkerLeaseManager`, `WorkerSupervisor`, and
  `ComputeManagerServiceAdapter`.
- Exported the new package through `peercompute/src/peercompute/index.js`.
- Added service orchestration unit tests.
- Updated peercompute README and plan/test/log docs.
- Coordinator verified peercompute is clean and ahead of origin by one commit.

Commands run:

```bash
node --check peercompute/src/peercompute/serviceOrchestration/ComputeServiceRegistry.js
node --check peercompute/src/peercompute/serviceOrchestration/ChildWorkerLeaseManager.js
node --check peercompute/src/peercompute/serviceOrchestration/WorkerSupervisor.js
node --check peercompute/src/peercompute/serviceOrchestration/ComputeManagerServiceAdapter.js
node --check peercompute/src/peercompute/serviceOrchestration/index.js
node --check peercompute/tests/unit/serviceOrchestration.test.js
node --check peercompute/src/peercompute/index.js
node --test peercompute/tests/unit/serviceOrchestration.test.js
node --test peercompute/tests/unit/serviceOrchestration.test.js peercompute/tests/unit/computeManager.worker.test.js peercompute/tests/unit/solverRegistry.test.js
npm --prefix peercompute run test:unit
git diff --check
```

Files touched in PeerCompute:

- `/home/cos/projects/peercompute/README.md`
- `/home/cos/projects/peercompute/peercompute/src/peercompute/index.js`
- `/home/cos/projects/peercompute/peercompute/src/peercompute/serviceOrchestration/ComputeServiceRegistry.js`
- `/home/cos/projects/peercompute/peercompute/src/peercompute/serviceOrchestration/ChildWorkerLeaseManager.js`
- `/home/cos/projects/peercompute/peercompute/src/peercompute/serviceOrchestration/WorkerSupervisor.js`
- `/home/cos/projects/peercompute/peercompute/src/peercompute/serviceOrchestration/ComputeManagerServiceAdapter.js`
- `/home/cos/projects/peercompute/peercompute/src/peercompute/serviceOrchestration/index.js`
- `/home/cos/projects/peercompute/peercompute/tests/unit/serviceOrchestration.test.js`
- `/home/cos/projects/peercompute/plan/plan.md`
- `/home/cos/projects/peercompute/plan/tests.md`
- `/home/cos/projects/peercompute/plan/log.md`

Test results:

- `node --check` on new modules, test, and public index passed.
- `node --test peercompute/tests/unit/serviceOrchestration.test.js` passed 5/5.
- Targeted integrated gate with ComputeManager/SolverRegistry tests passed 28/28.
- `npm --prefix peercompute run test:unit` passed 121/121.
- `git diff --check` passed.

Failures and open questions:

- No browser or relay smoke was run for this slice because it is a headless
  unit-tested orchestration foundation.
- Next step is wiring real ULG/Eshkol/MoonLab worker services into this
  supervisor/adapter layer.
- No SSH password was used or logged.

## 2026-06-05 15:24:38 AKDT

Prompt: "big dog, you are the ULG app integration agent. Work in /home/cos/projects/ulg on the current branch only; do not switch branches. Read /home/cos/projects/ulg/agents.md, /home/cos/projects/AGENTS.md, /home/cos/projects/ulg/plan/plan.md, /home/cos/projects/ulg/plan/tests.md, and /home/cos/projects/ulg/plan/log.md before editing. Do not stop or restart the existing Vite server unless needed. Scope: improve the ULG app/ABI scaffold without overlapping peercompute/MoonLab/Eshkol repo edits. Add a small service contract export or docs/tests that will make cross-repo integration easier, such as shared manifests/examples, schema fixture tests, or a stable adapter README. Keep the demo vanilla JS/three.js. Run npm test/build/e2e if your changes affect behavior. Commit locally if you reach a passing checkpoint. Final report must list files changed, tests run, and any user-visible demo change."

Actions attempted:

- Read `/home/cos/projects/ulg/agents.md`, `/home/cos/projects/AGENTS.md`,
  `plan/plan.md`, `plan/tests.md`, and `plan/log.md` before editing.
- Confirmed the current branch is `main` and did not switch branches.
- Inspected the ULG ABI package, JSON schemas, runtime, dummy service worker,
  tests, README, and Playwright config.
- Added `ulg-gpu-abi/src/serviceContract.js` with stable Eshkol/MoonLab service
  contract constants, manifest builders, and task capsule builders.
- Added `ulg-gpu-abi/examples/` JSON fixtures for Eshkol and MoonLab service
  manifests and task capsules.
- Added `ulg-gpu-abi/README.md` as the stable adapter boundary doc for
  PeerCompute, Eshkol, MoonLab, and the ULG browser demo.
- Exported `./service-contract` and `./examples/*` from `ulg-gpu-abi/package.json`.
- Added `taskKinds` to the compute service manifest schema properties.
- Refactored `src/runtime/demoRuntime.js` to use the shared service-contract
  builders while keeping the vanilla JS/three.js demo behavior.
- Added `tests/contract-fixtures.test.mjs` to validate fixtures and builder
  output against the shared schemas.
- Updated `README.md`, `plan/plan.md`, `plan/tests.md`, and
  `plan/implementation-status.md`.

Files touched:

- `README.md`
- `src/runtime/demoRuntime.js`
- `tests/contract-fixtures.test.mjs`
- `ulg-gpu-abi/README.md`
- `ulg-gpu-abi/examples/eshkol-service-manifest.json`
- `ulg-gpu-abi/examples/eshkol-task-capsule.json`
- `ulg-gpu-abi/examples/moonlab-service-manifest.json`
- `ulg-gpu-abi/examples/moonlab-task-capsule.json`
- `ulg-gpu-abi/package.json`
- `ulg-gpu-abi/src/schemas/compute_service_manifest.schema.json`
- `ulg-gpu-abi/src/serviceContract.js`
- `plan/plan.md`
- `plan/tests.md`
- `plan/implementation-status.md`
- `plan/log.md`

Commands run:

```bash
pwd && git branch --show-current && git status --short
sed -n '1,220p' agents.md
sed -n '1,220p' /home/cos/projects/AGENTS.md
sed -n '1,240p' plan/plan.md
sed -n '1,240p' plan/tests.md
sed -n '1,260p' plan/log.md
rg --files
sed -n '1,240p' package.json
sed -n '1,260p' README.md
find src ulg-gpu-abi tests -maxdepth 4 -type f | sort
git status --short --branch
sed -n '1,280p' ulg-gpu-abi/src/index.js
sed -n '1,240p' ulg-gpu-abi/src/wgsl.js
sed -n '1,320p' tests/abi.test.mjs
sed -n '1,320p' tests/orchestration.test.mjs
sed -n '1,280p' src/runtime/demoRuntime.js
sed -n '1,260p' src/main.js
sed -n '1,260p' src/runtime/ComputeServiceRegistry.js
sed -n '1,360p' src/runtime/WorkerSupervisor.js
sed -n '1,260p' src/runtime/ChildWorkerLeaseManager.js
sed -n '1,260p' src/runtime/ArtifactCache.js
sed -n '1,260p' ulg-gpu-abi/src/schemas/compute_service_manifest.schema.json
sed -n '1,260p' ulg-gpu-abi/package.json
sed -n '1,260p' ulg-gpu-abi/src/schemas/task_capsule.schema.json
sed -n '1,260p' ulg-gpu-abi/src/schemas/closure_artifact.schema.json
sed -n '1,260p' ulg-gpu-abi/src/schemas/quantum_response_artifact.schema.json
sed -n '1,220p' ulg-gpu-abi/src/schemas/tolerance_report.schema.json
sed -n '1,220p' ulg-gpu-abi/src/schemas/validation_report.schema.json
sed -n '1,280p' src/services/dummyService.worker.js
sed -n '1,260p' plan/implementation-status.md
date '+%Y-%m-%d %H:%M:%S %Z'
npm test
git diff -- README.md src/runtime/demoRuntime.js ulg-gpu-abi/src/serviceContract.js tests/contract-fixtures.test.mjs | sed -n '1,260p'
git diff -- ulg-gpu-abi/src/schemas/compute_service_manifest.schema.json ulg-gpu-abi/package.json ulg-gpu-abi/README.md ulg-gpu-abi/examples | sed -n '1,320p'
git status --short
find peercompute -maxdepth 3 -type f | sort | sed -n '1,120p'
git diff --stat
find ulg-gpu-abi/examples -maxdepth 1 -type f -print | sort
ls -la peercompute
find peercompute -depth -type d -empty -delete && git status --short
find peercompute -maxdepth 5 -print | sort | sed -n '1,160p'
find peercompute -maxdepth 5 -name '.git' -o -name '.gitignore' -o -name '.keep' -print
ls -la peercompute peercompute/src
sed -n '1,220p' peercompute/src/peercompute/serviceOrchestration/ComputeServiceRegistry.js
sed -n '1,220p' peercompute/src/peercompute/serviceOrchestration/ChildWorkerLeaseManager.js
sed -n '1,260p' peercompute/src/peercompute/serviceOrchestration/WorkerSupervisor.js
find peercompute -type f -printf '%p %s bytes\n' | sort
sed -n '1,220p' tests/playwright.config.mjs && sed -n '1,240p' tests/demo.e2e.mjs
npm run build
npm run test:e2e
find test-results -maxdepth 2 -type f -printf '%p %s bytes\n' | sort | sed -n '1,80p'
date '+%Y-%m-%d %H:%M:%S %Z'
```

Test results:

- `npm test` passed: 10/10 tests.
- `npm run build` passed with the existing Vite large-chunk warning for the
  three.js bundle.
- `npm run test:e2e` passed: 1/1 Chromium test.
- Playwright refreshed screenshots at `test-results/ulg-desktop.png` and
  `test-results/ulg-mobile.png`; these remain ignored by git.

Failures and open questions:

- `git status --short --branch` reports `main...origin/main [gone]`; no branch
  switch was attempted.
- An untracked `peercompute/` directory containing service orchestration files
  appeared under the ULG checkout during this prompt. It is outside the requested
  ULG ABI/app checkpoint and was not staged or committed.
- No MoonLab, Eshkol, or sibling peercompute repo edits were made.

## 2026-06-05 15:30:32 AKDT

Prompt: "big dog, quick correction: I see a `peercompute/` subtree in /home/cos/projects/ulg. Please do not duplicate PeerCompute source modules inside the ULG repo unless it is explicitly a tiny documented fixture. The real serviceOrchestration implementation belongs in /home/cos/projects/peercompute and the peercompute agent is working there. For the ULG repo, keep scope to @ulg/gpu-abi service-contract exports, JSON fixtures, docs, and demo usage. If you added copied PeerCompute source under /home/cos/projects/ulg/peercompute, remove or replace it with a short README/fixture before your final. Avoid touching paths the main peercompute agent owns."

Actions attempted:

- Re-checked `git status --short`.
- Ran `find peercompute -maxdepth 6 -print` from the ULG repo root.
- Confirmed `peercompute/` no longer exists in `/home/cos/projects/ulg`.
- Kept the current checkpoint scoped to `@ulg/gpu-abi` service-contract exports,
  JSON fixtures, docs, tests, and demo usage only.

Commands run:

```bash
git status --short
find peercompute -maxdepth 6 -print | sort | sed -n '1,200p'
date '+%Y-%m-%d %H:%M:%S %Z'
git diff --check
test ! -e peercompute && printf 'peercompute subtree absent\n'
git add README.md plan/implementation-status.md plan/log.md plan/plan.md plan/tests.md src/runtime/demoRuntime.js tests/contract-fixtures.test.mjs ulg-gpu-abi/README.md ulg-gpu-abi/examples/eshkol-service-manifest.json ulg-gpu-abi/examples/eshkol-task-capsule.json ulg-gpu-abi/examples/moonlab-service-manifest.json ulg-gpu-abi/examples/moonlab-task-capsule.json ulg-gpu-abi/package.json ulg-gpu-abi/src/schemas/compute_service_manifest.schema.json ulg-gpu-abi/src/serviceContract.js && git status --short
npm test
```

Test results:

- `npm test` passed again after staging: 10/10 tests.
- The earlier `npm run build` and `npm run test:e2e` checkpoint remains valid
  because only docs/log updates were made after those behavior checks.

Failures and open questions:

- `find peercompute` reported `No such file or directory`, which is the desired
  final state for this ULG-scoped checkpoint.

## 2026-06-05 16:20:34 AKDT

Prompt: "keep going until i tell you to stop. youre doing great"

Actions attempted:

- Kept the existing Vite server running on `0.0.0.0:5173`.
- Inspected the ULG service asset convention and confirmed real artifacts are
  ignored by git under `public/service-assets/`.
- Copied generated MoonLab core artifacts from
  `/home/cos/projects/moonlab/bindings/javascript/packages/core/dist/` into
  the ignored local runtime path `public/service-assets/moonlab/`.
- Checked HTTP response headers for both copied artifacts through the live Vite
  server.
- Used Playwright against the running app to inspect `window.__ulgDemo` service
  telemetry and verify the MoonLab browser worker asset probe reports `ready`.

Commands run:

```bash
find public -maxdepth 4 -type f -o -type d | sort
sed -n '1,220p' .gitignore
sed -n '1,260p' src/runtime/ServiceAssetProbe.js
sed -n '1,220p' public/service-assets/README.md
ls -lh /home/cos/projects/moonlab/bindings/javascript/packages/core/dist/moonlab.js /home/cos/projects/moonlab/bindings/javascript/packages/core/dist/moonlab.wasm
cp /home/cos/projects/moonlab/bindings/javascript/packages/core/dist/moonlab.js public/service-assets/moonlab/moonlab.js
cp /home/cos/projects/moonlab/bindings/javascript/packages/core/dist/moonlab.wasm public/service-assets/moonlab/moonlab.wasm
curl -sI http://100.86.83.35:5173/service-assets/moonlab/moonlab.js
curl -sI http://100.86.83.35:5173/service-assets/moonlab/moonlab.wasm
node --input-type=module - <<'JS'
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
await page.goto('http://127.0.0.1:5173/');
await page.waitForFunction(() => window.__ulgDemo?.telemetry?.services?.some((service) => service.serviceId === 'moonlab' && service.assetProbe?.status));
const telemetry = await page.evaluate(() => {
  const moonlab = window.__ulgDemo.telemetry.services.find((service) => service.serviceId === 'moonlab');
  return {
    status: moonlab.assetProbe.status,
    reason: moonlab.assetProbe.reason,
    locateFile: moonlab.assetProbe.locateFile,
    assets: moonlab.assetProbe.assets.map((asset) => ({ kind: asset.kind, status: asset.status, contentType: asset.contentType, httpStatus: asset.httpStatus }))
  };
});
console.log(JSON.stringify(telemetry, null, 2));
await browser.close();
JS
```

Files touched:

- `/home/cos/projects/ulg/public/service-assets/moonlab/moonlab.js` ignored runtime artifact.
- `/home/cos/projects/ulg/public/service-assets/moonlab/moonlab.wasm` ignored runtime artifact.
- `/home/cos/projects/ulg/plan/implementation-status.md`
- `/home/cos/projects/ulg/plan/plan.md`
- `/home/cos/projects/ulg/plan/tests.md`
- `/home/cos/projects/ulg/plan/log.md`

Test results:

- `curl -I` for `/service-assets/moonlab/moonlab.js` returned `200` with
  `Content-Type: text/javascript`.
- `curl -I` for `/service-assets/moonlab/moonlab.wasm` returned `200` with
  `Content-Type: application/wasm`.
- Playwright telemetry inspection reported `assetProbe.status = ready`,
  `loaderModule.status = ready`, and `wasmModule.status = ready`.

Failures and open questions:

- The real MoonLab artifacts are intentionally ignored local runtime files, not
  committed source artifacts.
- Next step is loading the MoonLab module in a supervised worker and running a
  minimal core task or quantum response artifact path.
- No push was attempted; all commits remain local per user instruction.

## 2026-06-05 16:34:33 AKDT

Prompt: "keep going until i tell you to stop. youre doing great"

Actions attempted:

- Continued with the live Vite server on `0.0.0.0:5173`.
- Spawned a read-only MoonLab sidecar to confirm the smallest browser-callable
  WASM API and traps around Emscripten `MODULARIZE`.
- Confirmed the copied MoonLab loader is a classic/UMD Emscripten factory named
  `MoonlabModule`, not an ES module.
- Found that the existing MoonLab C source already has
  `quantum_state_create`/`quantum_state_destroy`, but those helpers were not in
  `bindings/javascript/packages/core/emscripten/exports.txt`.
- Added those two state allocation helpers to the MoonLab WASM export list,
  rebuilt core, verified the rebuilt loader exposes the helpers, and committed
  the MoonLab repo locally as `5ce415f Export MoonLab state allocation helpers`.
- Copied the rebuilt ignored `moonlab.js`/`moonlab.wasm` artifacts back into
  ULG `public/service-assets/moonlab/`.
- Ran temporary Chromium worker probes against the live Vite app:
  the first blob-worker probe failed because root-relative `importScripts()` is
  invalid from a blob URL; the second probe instantiated the module but failed
  because `_quantum_state_get_probability` expects a BigInt basis index for its
  `uint64_t`; the third probe passed with `0n..3n` and returned
  `[0.5000000000000001, 0, 0, 0.5000000000000001]`, purity `1.0`, and entropy
  `1.0`.
- Added ULG support for child worker lease `workerType` metadata so MoonLab can
  lease a classic child worker while the existing dummy child remains a module
  worker.
- Added `public/workers/moonlab-core-probe.worker.js`, a tracked classic child
  worker that loads `MoonlabModule` with `importScripts()`, resolves the WASM
  with `locateFile`, allocates a two-qubit state, creates Bell `phi_plus`, reads
  the basis probabilities, and destroys the WASM heap state.
- Extended the MoonLab service asset contract with `coreProbeWorkerModule` and
  made the manifest builder automatically approve that worker for child leases.
- Updated the root service worker so MoonLab chooses the classic core probe only
  when the asset probe is `ready`; otherwise it keeps the dummy fallback.
- Fixed an initialization race where `runSmoke()` could submit tasks before the
  async asset probe finished. Task start now waits on `initPromise`.
- Exposed `artifactCache` on `window.__ulgDemo` for Playwright/manual inspection
  of artifact bodies.
- Updated README, service asset docs, plan, status, and tests docs.
- Closed the MoonLab sidecar after receiving its read-only report. Its
  alternative verified path uses `_gate_hadamard`, `_gate_cnot`, `_malloc`,
  `_measurement_probability_distribution`, `_measurement_probability_one`, and
  `_measurement_correlation_zz`; the implemented path uses the exported Bell
  helper and BigInt basis indices.

Commands run:

```bash
git status --short --branch
rg -n "WorkerSupervisor|ChildWorkerLease|dummyService|createUlgServiceManifest|moonlab|serviceAssets|assetProbe|Worker\\(" src tests public plan package.json
sed -n '1,220p' agents.md
sed -n '1,220p' /home/cos/projects/AGENTS.md
sed -n '1,260p' src/services/dummyService.worker.js
sed -n '1,280p' src/runtime/ChildWorkerLeaseManager.js
sed -n '1,280p' src/runtime/WorkerSupervisor.js
sed -n '1,220p' src/runtime/demoRuntime.js
sed -n '1,320p' ulg-gpu-abi/src/serviceContract.js
sed -n '1,260p' tests/orchestration.test.mjs
sed -n '1,280p' tests/demo.e2e.mjs
sed -n '1,220p' src/services/dummyChild.worker.js
find public -maxdepth 3 -type f | sort
cat .gitignore
rg -n "quantum_state_create|quantum_state_destroy" public/service-assets/moonlab/moonlab.js /home/cos/projects/moonlab/bindings/javascript/packages/core/dist/moonlab.js /home/cos/projects/moonlab/bindings/javascript/packages/core/emscripten/exports.txt
sed -n '280,320p' /home/cos/projects/moonlab/src/quantum/state.h
sed -n '560,590p' /home/cos/projects/moonlab/src/quantum/state.c
sed -n '1,115p' /home/cos/projects/moonlab/src/algorithms/bell_tests.c
pnpm --filter @moonlab/quantum-core build
rg -n "_quantum_state_create|_quantum_state_destroy" bindings/javascript/packages/core/dist/moonlab.js bindings/javascript/packages/core/emscripten/build/moonlab.js bindings/javascript/packages/core/emscripten/exports.txt
pnpm --filter @moonlab/quantum-core test:unit
git add bindings/javascript/packages/core/emscripten/exports.txt && git commit -m "Export MoonLab state allocation helpers"
cp /home/cos/projects/moonlab/bindings/javascript/packages/core/dist/moonlab.js public/service-assets/moonlab/moonlab.js
cp /home/cos/projects/moonlab/bindings/javascript/packages/core/dist/moonlab.wasm public/service-assets/moonlab/moonlab.wasm
node --input-type=module - <<'NODE'
// temporary Chromium worker probes for MoonlabModule, locateFile, and Bell probabilities
NODE
node --check src/services/dummyService.worker.js
node --check public/workers/moonlab-core-probe.worker.js
node --check src/runtime/ChildWorkerLeaseManager.js
node --check src/runtime/WorkerSupervisor.js
npm test
npm run build
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' http://100.86.83.35:5173/workers/moonlab-core-probe.worker.js
npm run test:e2e
node --input-type=module - <<'NODE'
// live VPN probe against http://100.86.83.35:5173/ reading window.__ulgDemo.artifactCache
NODE
```

Files touched:

- `/home/cos/projects/moonlab/bindings/javascript/packages/core/emscripten/exports.txt`
- `/home/cos/projects/ulg/README.md`
- `/home/cos/projects/ulg/public/service-assets/README.md`
- `/home/cos/projects/ulg/public/workers/moonlab-core-probe.worker.js`
- `/home/cos/projects/ulg/src/runtime/ChildWorkerLeaseManager.js`
- `/home/cos/projects/ulg/src/runtime/WorkerSupervisor.js`
- `/home/cos/projects/ulg/src/runtime/demoRuntime.js`
- `/home/cos/projects/ulg/src/services/dummyService.worker.js`
- `/home/cos/projects/ulg/tests/demo.e2e.mjs`
- `/home/cos/projects/ulg/tests/orchestration.test.mjs`
- `/home/cos/projects/ulg/tests/service-assets.test.mjs`
- `/home/cos/projects/ulg/ulg-gpu-abi/examples/moonlab-service-manifest.json`
- `/home/cos/projects/ulg/ulg-gpu-abi/src/schemas/compute_service_manifest.schema.json`
- `/home/cos/projects/ulg/ulg-gpu-abi/src/serviceContract.js`
- `/home/cos/projects/ulg/plan/implementation-status.md`
- `/home/cos/projects/ulg/plan/plan.md`
- `/home/cos/projects/ulg/plan/tests.md`
- `/home/cos/projects/ulg/plan/log.md`

Test results:

- MoonLab `pnpm --filter @moonlab/quantum-core build` passed with the existing
  package exports warning.
- MoonLab `pnpm --filter @moonlab/quantum-core test:unit` passed 93/93.
- ULG syntax checks passed for `dummyService.worker.js`,
  `moonlab-core-probe.worker.js`, `ChildWorkerLeaseManager.js`, and
  `WorkerSupervisor.js`.
- ULG `npm test` passed 13/13.
- ULG `npm run build` passed with the existing large three.js chunk warning.
- First ULG `npm run test:e2e` failed because `artifactCache` was not exposed on
  `window.__ulgDemo`; after exposing it, the next e2e run failed because the
  MoonLab task selected the fallback child before the async asset probe finished.
- After the init race fix, ULG `npm run test:e2e` passed 1/1.
- Live VPN probe at `http://100.86.83.35:5173/` returned MoonLab
  `assetStatus = ready`, `method = moonlab-wasm-bell-phi-plus-probe`,
  `bellState = bell_phi_plus`, probabilities
  `[0.5000000000000001, 0, 0, 0.5000000000000001]`,
  `validation = pass`, and `coreProbe = ready`.

Failures and open questions:

- The real MoonLab runtime files under `public/service-assets/moonlab/` remain
  ignored local artifacts, not committed source.
- The sidecar also verified a measurement-buffer path that may be better for the
  next quantum-response expansion, but the current committed ULG path uses the
  simpler exported Bell helper and direct probability reads.
- No push was attempted; all commits remain local per user instruction.

## 2026-06-05 23:24:36 AKDT - Eshkol closure metadata telemetry

Prompt:

- Continued the long-running ULG/PeerCompute/Eshkol/MoonLab implementation plan
  after PeerCompute could consume transferred Eshkol closure bytes and execute
  `main(0, 0)` in Multiscale.
- Local commits only; no push.

Actions:

- Extended `src/runtime/artifactSummary.js` so ULG artifact-cache summaries
  preserve Eshkol closure entry export/signature, start-section state,
  import/export counts, WASM metadata counts, and DOM-free host-import bundle
  metadata.
- Updated `src/services/dummyService.worker.js` to preserve
  `ulg_bundle_manifest.json.hostImports` when returning the staged Eshkol
  closure artifact.
- Updated the live artifact list in `src/main.js` to render compact closure
  metadata: `closure`, `entry`, `imports`, and host-import factory.
- Updated unit and e2e coverage for the new summary fields.
- Updated plan, implementation status, and test-plan docs.

Commands run:

```bash
rg --files -g 'AGENTS.md' -g 'agents.md'
git status --short --branch
sed -n '1,240p' src/runtime/artifactSummary.js
rg -n "artifactSummary|closureBundle|closureReady|magnetarDipole|Eshkol" src tests package.json
sed -n '1,220p' agents.md
sed -n '1,160p' tests/orchestration.test.mjs
sed -n '1,105p' tests/demo.e2e.mjs
node --check src/runtime/artifactSummary.js && node --check src/main.js && node --check tests/orchestration.test.mjs && node --check tests/demo.e2e.mjs
npm test
node --input-type=module
# live Playwright probe against http://100.86.83.35:5173/ checking window.__ulgDemo.runSmoke() and artifactCache.list()
rg -n "bundleManifest|hostImports|artifactModule|eshkol" src/services/dummyService.worker.js src/runtime/WorkerSupervisor.js src/runtime/ArtifactCache.js
node --check src/runtime/artifactSummary.js && node --check src/services/dummyService.worker.js && node --check src/main.js && node --check tests/orchestration.test.mjs && node --check tests/demo.e2e.mjs
npm test
node --input-type=module
# live Playwright probe against http://100.86.83.35:5173/ confirming host import metadata and UI line
npm run build
npm run test:e2e
curl -sS -o /dev/null -w 'ulg %{http_code} %{url_effective}\n' 'http://100.86.83.35:5173/'
curl -k -sS -o /dev/null -w 'multiscale %{http_code} %{url_effective}\n' 'https://100.86.83.35:5185/?scenario=magnetar'
git diff --check
```

Files touched:

- `/home/cos/projects/ulg/src/runtime/artifactSummary.js`
- `/home/cos/projects/ulg/src/services/dummyService.worker.js`
- `/home/cos/projects/ulg/src/main.js`
- `/home/cos/projects/ulg/tests/orchestration.test.mjs`
- `/home/cos/projects/ulg/tests/demo.e2e.mjs`
- `/home/cos/projects/ulg/plan/plan.md`
- `/home/cos/projects/ulg/plan/implementation-status.md`
- `/home/cos/projects/ulg/plan/tests.md`
- `/home/cos/projects/ulg/plan/log.md`

Test results:

- PASS: syntax checks completed for changed ULG source and tests.
- PASS: `npm test` passed `15/15`.
- PASS: live VPN probe reported closure summary metadata:
  `entryExport = "main"`, signature `i32,i32 -> i32`, no start section,
  import/export counts `12/1`, runtime function import count `9`, WASM
  function/type counts `18/104`, host import factory
  `createEshkolHostImportObject`, and `closureReady: true`.
- PASS: live artifact list includes `entry:main`, `imports:12`, and
  `host:createEshkolHostImportObject`.
- PASS: `npm run build` completed with the existing large bundle warning.
- PASS: `npm run test:e2e` passed `1/1`.
- PASS: final ULG and Multiscale endpoint checks returned HTTP `200`.
- PASS: `git diff --check` reported no whitespace errors.

Failures and open questions:

- The first live probe showed host-import metadata missing because the worker
  preserved only the bundle manifest schema/copy-file fields. This was fixed by
  copying the `hostImports` block into the returned closure artifact runtime.
- The real MoonLab runtime files and Eshkol closure bundle under
  `public/service-assets/` remain ignored local service assets.
- No push was attempted; all commits remain local per user instruction.

## 2026-06-05 23:31:11 AKDT - ULG PeerCompute handoff exporter

Prompt:

- Continued the long-running ULG/PeerCompute/Eshkol/MoonLab implementation plan
  after the ULG closure metadata and PeerCompute transferred-byte execution
  slices.
- User asked why work was not still continuing; resumed from the dirty ULG
  handoff-exporter worktree state.
- Local commits only; no push.

Actions:

- Added `window.__ulgDemo.createPeerComputeHandoff()` to the ULG browser runtime.
- The exporter walks the current artifact cache and returns
  `peercompute.ulg.demo-handoff.v0` with each artifact ref, kind, compact
  summary, full artifact body, and closure WASM bytes fetched same-origin from
  the ULG service-asset URL.
- Extended the Chromium smoke test so the demo handoff exporter proves the
  staged Eshkol closure summary and transfers the expected 33,907-byte WASM
  module.
- Ran a live bridge probe from `http://100.86.83.35:5173/` into
  `https://100.86.83.35:5185/?scenario=magnetar` using the exported ULG
  MoonLab and Eshkol artifacts.
- Updated plan, implementation status, and test-plan docs.

Commands run:

```bash
pwd && git status --short --branch
sed -n '1,220p' agents.md
git status --short --branch
git diff -- src/runtime/demoRuntime.js tests/demo.e2e.mjs
git diff --check
pgrep -af 'vite|node.*5173|node.*5185'
node --input-type=module
# live Playwright ULG-to-Multiscale handoff probe using createPeerComputeHandoff()
sed -n '1,240p' plan/plan.md
sed -n '1,240p' plan/implementation-status.md
sed -n '1,260p' plan/tests.md
tail -n 120 plan/log.md
date '+%Y-%m-%d %H:%M:%S %Z'
node --check src/runtime/demoRuntime.js && node --check tests/demo.e2e.mjs
git diff --check
git status --short --branch
npm test
npm run build
npm run test:e2e
curl -sS -o /dev/null -w 'ulg %{http_code} %{url_effective}\n' 'http://100.86.83.35:5173/'
curl -k -sS -o /dev/null -w 'multiscale %{http_code} %{url_effective}\n' 'https://100.86.83.35:5185/?scenario=magnetar'
git diff --check && git status --short --branch
git diff --stat
git diff -- src/runtime/demoRuntime.js tests/demo.e2e.mjs plan/plan.md plan/implementation-status.md plan/tests.md plan/log.md
```

Test results:

- PASS: syntax checks completed for the changed runtime and e2e test.
- PASS: `npm test` passed `15/15`.
- PASS: `git diff --check` reported no whitespace errors before doc updates.
- PASS: live ULG-to-Multiscale bridge exported four ULG artifacts and the
  33,907-byte Eshkol WASM module.
- PASS: Multiscale ingested the MoonLab magnetar calibration and Eshkol closure
  artifact from the ULG handoff packet.
- PASS: Multiscale instantiated the transferred Eshkol WASM bytes, executed
  `main(0, 0)`, returned `entryResult = 0`, and captured output preview
  `1048560\n1048544\n`.
- PASS: packet boundary conditions reported `scenarioHandoffReady: true`,
  `scenarioClosureHostRuntimeExecutionReady: true`, and
  `scenarioScientificReady: false`.
- PASS: old readiness blockers for missing MoonLab calibration summary, missing
  Eshkol closure bundle summary, required host runtime execution, and unvalidated
  closure execution were absent; remaining blockers were the expected output
  semantics/scientific tolerance/reference validation gaps.
- PASS: `npm run build` completed with the existing large bundle warning.
- PASS: `npm run test:e2e` passed `1/1`.
- PASS: final ULG and Multiscale endpoint checks returned HTTP `200`.
- PASS: final `git diff --check` reported no whitespace errors.

Failures and open questions:

- The handoff exporter is still demo-runtime API surface, not yet a durable
  PeerCompute service adapter with content addressing or relay-safe transfer.
- The real MoonLab runtime files and Eshkol closure bundle under
  `public/service-assets/` remain ignored local service assets.
- No push was attempted; all commits remain local per user instruction.
