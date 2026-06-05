# ULG Implementation Log

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
